/* grade-3/math/add-sub 的檢查設定（加減直式大挑戰：進位加法、退位與借過 0、先估再算、用加法驗算減法）。
   2026-10-01 新增 —— 和小遊戲「加減工作坊」改成五關五種玩法（§六之五）同一次寫成；在這之前這一課沒有設定檔，
   simgen／verify_lesson_data 一跑就報「no check config」。

   sim（review.html 的九個產生器）：每個產生器一組不變條件（解釋說了什麼，資料就必須是那樣）、正解的第二套實作
   （只用 make() 的原始參數重算）、選項的形狀與範圍，以及 renderCheck：渲染出來的題幹與解釋裡每一條算式逐條驗算，
   估算題的「a 接近 X」逐個重算。跑起來抓到的舊缺陷（同一次修掉）：估算題的誘答有 799／899 這種「不是整百」的數、
   有 0；除法題的被除數到 278（三年級的除法課只教二位數 ÷ 一位數）；周長題的「長」比「寬」短；乘法題在個位沒有進位時
   也說「別忘了進位」；誘答把題幹的數字抄回來（乘法的 noCarry 剛好等於 a 或 d、借過 0 的誘答等於 b）、加法有 0 的誘答。

   data（index.html）：
   - 所有 I18N 靜態字串裡的算式逐條重算（lib/arith.js），驗過的算式集合用指紋釘住；刻意寫錯的選項（驗算題的兩個錯式子）
     逐條放行、放行次數也釘住。估算題：正解是自己估的整百、誘答都是整百而且離精確答案至少 100（不放近乎精確的數）；
     「錢夠不夠」那一題的正解理由必須是「兩個數都往上估」，而且那件事要真的成立。
   - 範例 1、2 的旁白：S1_EX／S2_EX 從原始碼讀出來，每一步的數字用自己的直式重算。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd，含數學引擎），由 dataReturn 交給 check()。
     每一關**照遊戲自己的規則把每一題從頭玩一遍**：綁一綁只有一條路（一定先綁最右邊滿十的那一欄）、
     拆一拆把所有拆法都走完（每一個走到底的狀態都一定每一欄都夠，拿走之後一定是 a − b），
     填直式逐格比、估一估逐張分類、驗算逐題判斷；每一句說明逐個比數字，而且句子裡的每一條算式都要算得對。
     頁面的純函式（blockXY／takeShort／columnSteps／round100／estOf／estOk／matX／colX）一律拿整個題庫去呼叫、和自己的算法比；
     nearestOpen()、roundMiss()、valueOf() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。
     版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-add-sub/ 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');
const crypto = require('crypto');

const isInt = v => Number.isInteger(v);
const digitsR = n => String(n).split('').reverse().map(Number);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
const round100 = n => Math.floor((n + 50) / 100) * 100;   /* 自己的四捨五入到整百（不出 50 的平手，所以和 Math.round 一致） */
const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

/* 自己的直式加法：每一欄的和（含進位） */
function myAddCols(a, b){
  const A = digitsR(a), B = digitsR(b), out = [];
  let c = 0;
  for (let i = 0; i < Math.max(A.length, B.length) || c; i++){
    const x = A[i] || 0, y = B[i] || 0, t = x + y + c;
    out.push({ x, y, cin:c, t });
    c = t >= 10 ? 1 : 0;
  }
  return out;
}
/* 自己的直式減法：哪幾欄要借位 */
function mySubCols(a, b){
  const A = digitsR(a), B = digitsR(b), w = A.slice(), out = [];
  for (let i = 0; i < A.length; i++){
    const y = B[i] || 0;
    let borrow = false;
    if (w[i] < y){ borrow = true; let j = i + 1; while (w[j] === 0){ w[j] = 9; j++; } w[j] -= 1; w[i] += 10; }
    out.push({ top:A[i], y, borrow, d:w[i] - y });
  }
  return out;
}
/* 兩種常見的減法錯（驗算關的「小明」用）：每一欄大的減小的；借了位卻忘了把借出去的那一位減 1 */
function bigMinusSmall(a, b){ const A = digitsR(a), B = digitsR(b); return +A.map((x, i) => Math.abs(x - (B[i] || 0))).reverse().join(''); }
function forgotToReduce(a, b){
  /* 借位時 0 照樣變成 9、借位的那一欄照樣加 10，只是「真正借出去的那一位」忘了減 1 */
  const A = digitsR(a), B = digitsR(b), w = A.slice(), r = [];
  for (let i = 0; i < A.length; i++){
    const y = B[i] || 0;
    if (w[i] < y){ let j = i + 1; while (w[j] === 0){ w[j] = 9; j++; } w[i] += 10; }
    r.push(w[i] - y);
  }
  return +r.reverse().join('');
}
/* 估一估：三種常見的錯（每一欄的和並排寫、少寫最前面的進位、b 往左錯一位） */
function sideBySide(a, b){ const A = digitsR(a), B = digitsR(b); return +A.map((x, i) => String(x + (B[i] || 0))).reverse().join(''); }

/* 自己的「不夠」：第 j 欄要用掉 take[j]，右邊不夠的話還要再借 1 個給它 */
function myShort(cnt, tk){ const o = []; let lend = 0; for (let j = 0; j < cnt.length; j++){ const sh = cnt[j] < tk[j] + lend; o.push(sh); lend = sh ? 1 : 0; } return o; }

/* review.html：渲染出來的題幹與解釋，逐條驗算（每一批換數字，所以不釘指紋，只要求每一題至少驗到一條） */
const simArith = makeArith({ units:['公分'], unitsEn:['cm'] });

/* index.html：靜態字串（指紋釘住）與遊戲訊息（每一句都要算得對）各用一份，互不墊高覆蓋率 */
const STATIC_WRONG = ['178 + 456 = 278', '178 - 278 = 456'];
const arithStatic = makeArith({ wrongOnPurpose:STATIC_WRONG });
const arithGame = makeArith({});

module.exports = {
  breaks: [
    /* ---- review.html：產生器 ---- */
    { file:'index', expect:'gTradeFew en', find:"' — fewer than 10, so there aren’t enough to make a bundle yet.'; },", replace:"' — fewer than 10, so they can’t make 1 ' + ['ten', 'hundred', 'thousand', 'ten-thousand'][i] + '.'; }," },
    { file:'index', expect:'names the lent block as a ten', find:"return '這一位借 1 給右邊（到右邊那一位就是 10），'", replace:"return '這一位借出去 1 個十（到右邊那一位就是 10），'" },
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });\n    (candidates || []).forEach(function(c){',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });\n    (candidates || []).forEach(function(c){' },
    { file:'review', expect:'zero or less makes no sense', find:'      if (c >= 1 && !seen[key]){ seen[key] = true; out.push(c); }', replace:'      if (c >= 0 && !seen[key]){ seen[key] = true; out.push(c); }' },
    { file:'review', expect:'is not a whole hundred', find:'var candidates = [estimate - 100, estimate + 100, estimate - 200, estimate + 200, estimate + 300]', replace:'var candidates = [estimate - 100, estimate + 100, estimate - 1, estimate + 200, estimate + 300]' },
    { file:'review', expect:'a tie at 50', find:'function fair(){ return a % 100 !== 50 && b % 100 !== 50 && a % 100 !== 0', replace:'function fair(){ return a % 100 !== 0' },
    { file:'review', expect:'the grade-3 divide lesson only does two-digit', find:'        var q = 10 + rand(Math.floor(99 / k) - 9);\n        var r = rand(Math.min(k, 99 - k * q + 1));', replace:'        var q = 10 + rand(21);\n        var r = rand(k);' },
    { file:'review', expect:'is not longer than width', find:'W = 10 + rand(89); L = W + 1 + rand(99 - W);', replace:'W = 10 + rand(89); L = 10 + rand(90);' },
    { file:'review', expect:'the ones do not carry', find:'a = (1 + rand(9)) * 10 + minOnes + rand(10 - minOnes);', replace:'a = 11 + rand(88);' },
    { file:'review', expect:'opts[ans] != correct', find:"        var correct = stepsAddToNumber(steps);\n        var m = mixOpts(correct, [ noCarryAdd(a,b), transposeLastTwo(correct), correct + 10 ], [a, b]);", replace:"        var correct = stepsAddToNumber(steps) + 1;\n        var m = mixOpts(correct, [ noCarryAdd(a,b), transposeLastTwo(correct), correct + 10 ], [a, b]);" },
    { file:'review', expect:'the ones do not have to borrow across a zero tens', find:'        var onesB = onesA + 1 + rand(9 - onesA);', replace:'        var onesB = rand(10);' },
    { file:'review', expect:'arithmetic is wrong', find:"? d.a + ' − ' + d.b + ' = ' + d.correct + '（不夠減就要老實跟左邊借位）。'", replace:"? d.a + ' − ' + d.b + ' = ' + (d.correct + 1) + '（不夠減就要老實跟左邊借位）。'" },
    { file:'review', expect:'should be "close to"', find:"? d.a + ' 接近 ' + (Math.round(d.a/100)*100) + '、'", replace:"? d.a + ' 接近 ' + (Math.round(d.a/100)*100 + 100) + '、'" },

    /* ---- index.html：靜態題庫與範例 ---- */
    { file:'index', expect:'set of verified equations changed', find:"why:'個位 7+8=15 寫 5 進位 1；十位 6+5+1=12 寫 2 進位 1；百位 2+1+1=4，合起來是 425。' },", replace:"why:'個位 7+8=15 寫 5 進位 1；十位 6+5+1=12 寫 2 進位 1；百位 2+1+1=4，合起來是 425。2+2=4。' }," },
    { file:'index', expect:'arithmetic is wrong', find:"why:'個位 7+8=15 寫 5 進位 1；", replace:"why:'個位 7+8=16 寫 5 進位 1；" },
    { file:'index', expect:'is not a whole hundred', find:"opts:['700','800','900','600'], ans:1,\n          why:'486 接近", replace:"opts:['700','800','900','810'], ans:1,\n          why:'486 接近" },
    { file:'index', expect:'rounded UP', find:"'夠，因為 386 比 400 少、295 比 300 少，加起來一定比 400 + 300 = 700 少',", replace:"'夠，因為先估 400 + 300 = 700，跟實際的 681 元很接近'," },
    { file:'index', expect:'S2 ', find:"msg += d.s2narrBorrowSimple(place, step.effectiveTop - 10, step.bottom, step.diff);", replace:"msg += d.s2narrBorrowSimple(place, step.origTop, step.bottom, step.diff);" },
    { file:'index', expect:'S1 ', find:"return place + '：' + x + ' + ' + y + (carryIn ? '，再加上進位的 ' + carryIn : '') + ' = ' + total + '。';", replace:"return place + '：' + x + ' + ' + y + ' = ' + total + '。';" },
    { file:'index', expect:'should be the three named mistakes', find:"{ a:267, b:158, op:'+', opts:['315','425','452','435'], ans:1, stem:'267 + 158 = ？',", replace:"{ a:267, b:158, op:'+', opts:['267','425','452','435'], ans:1, stem:'267 + 158 = ？'," },
    { file:'index', expect:'marked answer', find:"opts:['453','547','435','443'], ans:0, stem:'800 − 347 = ? (borrow across a zero)'", replace:"opts:['453','547','435','443'], ans:1, stem:'800 − 347 = ? (borrow across a zero)'" },

    /* ---- index.html：小遊戲（每一條新的不變量一筆） ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step,", replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step," },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['trade', 'take', 'column', 'est', 'verify'];", replace:"var GAME_ORDER = ['take', 'trade', 'column', 'est', 'verify'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'valueOf(', find:'function valueOf(cnt){ var v = 0; for (var i = cnt.length - 1; i >= 0; i--) v = v * 10 + cnt[i]; return v; }', replace:'function valueOf(cnt){ var v = 0; for (var i = 0; i < cnt.length; i++) v = v * 10 + cnt[i]; return v; }' },
    /* 位值板 */
    { file:'index', expect:'mat: columns 0 and 1 overlap', find:'var MAT = { x0:4, cw:70, gap:4,', replace:'var MAT = { x0:4, cw:70, gap:-2,' },
    { file:'index', expect:'blockXY(', find:"return { x:MAT.cw / 2 + ((k % inRow) - (inRow - 1) / 2) * b.sx,", replace:"return { x:MAT.cw / 2 + ((k % inRow) - inRow / 2) * b.sx," },
    { file:'index', expect:'runs out of its column', find:'    { w:6,  h:26, perRow:5, sx:11, sy:30, gap10:4 },   /* 十：一條 */', replace:'    { w:6,  h:26, perRow:2, sx:11, sy:30, gap10:4 },   /* 十：一條 */' },
    { file:'index', expect:'blocks', find:'    { w:10, h:10, perRow:5, sx:12, sy:12, gap10:6 },   /* 個：小方塊 */', replace:'    { w:10, h:10, perRow:5, sx:9, sy:12, gap10:6 },   /* 個：小方塊 */' },
    { file:'index', expect:'the count row', find:'cntY:176, cntH:30, takeY:208,', replace:'cntY:160, cntH:30, takeY:208,' },
    /* 綁一綁 */
    { file:'index', expect:'one bundle only', find:'var GAME_TRADE = [ { a:267, b:158 }, { a:238, b:145 },', replace:'var GAME_TRADE = [ { a:267, b:158 }, { a:268, b:145 },' },
    { file:'index', expect:'a new digit', find:'{ a:475, b:548 }, { a:386, b:467 }', replace:'{ a:375, b:548 }, { a:386, b:467 }' },
    { file:'index', expect:'should be three-digit', find:'{ a:386, b:467 }, { a:549, b:376 } ];', replace:'{ a:386, b:467 }, { a:549, b:76 } ];' },
    { file:'index', expect:'a left column is bundled first', find:'        if (f >= 0 && f < c.i){ roundMiss(d.gTradeOrder(f, cnt[f])); return false; }\n', replace:'' },
    { file:'index', expect:'fewer than 10 is bundled', find:'        if (cnt[c.i] < 10){ roundMiss(d.gTradeFew(c.i, cnt[c.i])); return false; }', replace:'        if (cnt[c.i] < 9){ roundMiss(d.gTradeFew(c.i, cnt[c.i])); return false; }' },
    { file:'index', expect:'"all done" is accepted', find:'        if (f >= 0){ roundMiss(d.gTradeMore(f, cnt[f])); return; }', replace:'        if (f > 0){ roundMiss(d.gTradeMore(f, cnt[f])); return; }' },
    { file:'index', expect:'a bundle does not take 10', find:'        cnt[c.i] -= 10; cnt[c.i + 1] += 1;', replace:'        cnt[c.i] -= 10; cnt[c.i + 1] += 10;' },
    { file:'index', expect:'not sent home', find:"        tok.lock(tok.homeX, tok.homeY); tok.el.classList.add('gone');   /* 另一根手指", replace:"        tok.lock(tok.cx, tok.cy); tok.el.classList.add('gone');   /* 另一根手指" },
    { file:'index', expect:'gTradeFew zh', find:"'，不到 10 ' + U + '，還不能綁。'; },", replace:"'，不到 10 ' + U + '，綁不成 1 個。'; }," },
    { file:'index', expect:'gTradeDid en', find:"return 'Bundled: 10 ' + ['ones', 'tens', 'hundreds', 'thousands'][i] + ' became 1 ' + ['ten', 'hundred',", replace:"return 'Bundled: 10 ' + ['ones', 'tens', 'hundreds', 'thousands'][i] + ' became 1 ' + ['hundred', 'hundred'," },
    { file:'index', expect:'gTradeDone zh', find:"return a + ' + ' + b + ' ＝ ' + s + '：每一欄都不到 10 個了", replace:"return a + ' + ' + b + ' ＝ ' + (s + 1) + '：每一欄都不到 10 個了" },
    /* 拆一拆 */
    { file:'index', expect:'borrowing across a zero', find:'var GAME_TAKE = [ { a:800, b:347 },', replace:'var GAME_TAKE = [ { a:850, b:347 },' },
    { file:'index', expect:'takeShort(', find:'for (var j = 0; j < cnt.length; j++){ var sh = cnt[j] < take[j] + lend; out.push(sh); lend = sh ? 1 : 0; }', replace:'for (var j = 0; j < cnt.length; j++){ var sh = cnt[j] < take[j]; out.push(sh); lend = sh ? 1 : 0; }' },
    { file:'index', expect:'a split is accepted when the right column has enough', find:'        if (!sh[r]){\n', replace:'        if (false){\n' },
    { file:'index', expect:'an empty column can be split', find:"        if (cnt[i] === 0){ roundMiss(d.gBreakZero(i)); return; }\n", replace:'' },
    { file:'index', expect:'a split does not give 10', find:'        cnt[i] -= 1; cnt[r] += 10;', replace:'        cnt[i] -= 1; cnt[r] += 9;' },
    { file:'index', expect:'"take away" is accepted with a short column', find:'        for (var j = 0; j < MAT.cols; j++) if (sh[j]){ roundMiss(d.gTakeShort(j, cnt[j], tk[j])); return; }\n', replace:'' },
    { file:'index', expect:'(gBreakNoNeedLend)', find:"          if (r > 0 && sh[r - 1]) roundMiss(d.gBreakNoNeedLend(r, cnt[r], tk[r]));", replace:"          if (false) roundMiss(d.gBreakNoNeedLend(r, cnt[r], tk[r]));" },
    { file:'index', expect:'gTakeShort en', find:"' column only has ' + have + ' — not enough to take away ' + take + '. Split 1", replace:"' column only has ' + (have + 1) + ' — not enough to take away ' + take + '. Split 1" },
    { file:'index', expect:'hint points at', find:'        var k = j + 1; while (k < MAT.cols - 1 && cnt[k] === 0) k++;', replace:'        var k = j + 1;' },
    { file:'index', expect:'split buttons', find:'var TAKE_H = 292, TAKE_BTN = { y:262, w:68, h:48 };', replace:'var TAKE_H = 292, TAKE_BTN = { y:262, w:68, h:40 };' },
    /* 填直式 */
    { file:'index', expect:'the ones do not carry', find:'var GAME_COLUMN = [ { a:2768, b:1457 },', replace:'var GAME_COLUMN = [ { a:2762, b:1457 },' },
    { file:'index', expect:'no entry has a column without a carry', find:'{ a:3546, b:2379 }, { a:4085, b:3926 }, { a:6758, b:4392 }, { a:1947, b:2386 }, { a:5629, b:2183 } ];', replace:'{ a:3646, b:2379 }, { a:4085, b:3926 }, { a:6758, b:4392 }, { a:1947, b:2386 }, { a:5929, b:2183 } ];' },
    { file:'index', expect:'no entry gains a fifth digit', find:'{ a:6758, b:4392 },', replace:'{ a:5758, b:3392 },' },
    { file:'index', expect:'columnSteps(', find:"      if (t >= 10) out.push(Object.assign({ kind:last ? 'r' : 'c', col:i + 1, v:1 }, base));", replace:"      if (t >= 10) out.push(Object.assign({ kind:'c', col:i + 1, v:1 }, base));" },
    { file:'index', expect:'columnSteps(', find:'      c = t >= 10 ? 1 : 0;\n    }\n    return out;', replace:'      c = 0;\n    }\n    return out;' },
    { file:'index', expect:'a wrong digit is accepted', find:'        if (v !== N.v){\n          if (N.kind', replace:'        if (v === -1){\n          if (N.kind' },
    { file:'index', expect:'a box can be filled out of order', find:"        if (s.kind !== N.kind || s.col !== N.col){", replace:"        if (s.kind !== N.kind && false){" },
    { file:'index', expect:'cards must never run out', find:'        P.home();             /* 數字卡拿不完', replace:'        P.lock(P.cx, P.cy);             /* 數字卡拿不完' },
    { file:'index', expect:'gColForgot', find:"return x + ' ＋ ' + y + ' ＝ ' + (x + y) + ' 之後，別忘了", replace:"return x + ' ＋ ' + y + ' ＝ ' + (x + y + 1) + ' 之後，別忘了" },
    { file:'index', expect:'en gColNoNeed', find:"return 'That column is ' + x + ' + ' + y + (cin ? ' + 1' : '') + ' = ' + t +", replace:"return 'That column is ' + x + ' + ' + y + ' = ' + t +" },
    { file:'index', expect:'column: boxes', find:'COL_Y = { carry:26, a:76, b:122, rule:148, res:178 }', replace:'COL_Y = { carry:26, a:56, b:122, rule:148, res:178 }' },
    { file:'index', expect:'digit cards reach the answer row', find:'COL_KEYS = { y:248, step:56, rowStep:56, size:48 }', replace:'COL_KEYS = { y:220, step:56, rowStep:56, size:48 }' },
    /* 估一估 */
    { file:'index', expect:'is wrong but close to the estimate', find:'[486, \'+\', 329, 815]', replace:'[486, \'+\', 329, 825]' },
    { file:'index', expect:'is not 300 or more away', find:'[805, \'-\', 62, 185]', replace:'[805, \'-\', 62, 500]' },
    { file:'index', expect:'a tie at 50', find:"[391, '+', 412, 803]", replace:"[350, '+', 412, 762]" },
    { file:'index', expect:'no − card', find:"[ [538, '+', 274, 812], [912, '-', 387, 525], [870, '+', 260, 130], [456, '+', 72, 1176] ]", replace:"[ [538, '+', 274, 812], [612, '+', 387, 999], [870, '+', 260, 130], [456, '+', 72, 1176] ]" },
    { file:'index', expect:'estOk(', find:'  function estOk(c){ return Math.abs(c[3] - estOf(c)) < 100; }', replace:'  function estOk(c){ return Math.abs(c[3] - estOf(c)) < 600; }' },
    { file:'index', expect:'a card in the wrong box is accepted', find:'        if (bin.ok !== ok){ roundMiss(why); return false; }', replace:'        if (bin.ok !== ok && false){ roundMiss(why); return false; }' },
    { file:'index', expect:'gEstNear/Far zh', find:"'。' + c + ' 跟 ' + E + ' 只差 ' + Math.abs(c - E) + '，很接近", replace:"'。' + c + ' 跟 ' + E + ' 只差 ' + Math.abs(c - E + 1) + '，很接近" },
    { file:'index', expect:'a box holds 2 cards', find:'EST_BIN = { y:4, w:144, h:156,', replace:'EST_BIN = { y:4, w:144, h:120,' },
    /* 驗算 */
    { file:'index', expect:'is not a known mistake', find:'{ a:800, b:347, c:553 }', replace:'{ a:800, b:347, c:554 }' },
    { file:'index', expect:'right and', find:'{ a:702, b:465, c:363 }, { a:800, b:347, c:553 }, { a:904, b:357, c:647 }', replace:'{ a:702, b:465, c:237 }, { a:800, b:347, c:453 }, { a:904, b:357, c:547 }' },
    { file:'index', expect:'the starting number is accepted', find:"        if (v === e.a){ roundMiss(d.gVerMinuend(e.a)); return false; }\n", replace:'' },
    { file:'index', expect:'is counted as a mistake or read as a number', find:"if (!/^(0|[1-9]\\d*)$/.test(tx)){ gMsg.textContent = d.gVerEmpty; return; }", replace:"if (!/^\\d+$/.test(tx)){ gMsg.textContent = d.gVerEmpty; return; }" },
    { file:'index', expect:'is counted as a mistake or read as a number', find:'        var tx = inp.value.trim();', replace:"        var tx = inp.value.replace(/\\s/g, '');" },
    { file:'index', expect:'a wrong verdict is accepted', find:'        if (saysRight !== right){', replace:'        if (false){' },
    { file:'index', expect:'does not fit the', find:'inp.maxLength = 4;', replace:'inp.maxLength = 3;' },
    { file:'index', expect:'gVerWrong zh', find:"'，所以小明算錯了；正確是 ' + a + ' − ' + b + ' ＝ ' + t + '。'; },", replace:"'，所以小明算錯了；正確是 ' + a + ' − ' + b + ' ＝ ' + (t + 10) + '。'; }," },
    { file:'index', expect:'verify: number sentence parts', find:'VER_EQ = { y:96, sw:76, sh:48, x:[46, 148],', replace:'VER_EQ = { y:96, sw:76, sh:48, x:[46, 118],' }
  ],

  sim: {
    blockStart: '  /* ===================== 數學引擎',
    INVARIANTS: {
      addCarry: d => {
        if (!(d.a >= 100 && d.a <= 999 && d.b >= 100 && d.b <= 999)) return 'a and b should be three-digit';
        if (!myAddCols(d.a, d.b).some(c => c.t >= 10)) return 'no column carries — the explanation says to carry';
      },
      addCascade: d => {
        if (d.a + d.b < 1000) return 'the answer does not gain a digit';
        const cols = myAddCols(d.a, d.b);
        if (!(cols[2] && cols[2].t >= 10)) return 'the hundreds column does not carry to the front';
      },
      subBorrow: d => {
        if (!(d.a > d.b && d.b >= 1)) return 'a must be bigger than b';
        if (!mySubCols(d.a, d.b).some(c => c.borrow)) return 'no column borrows — the explanation says to borrow';
      },
      subBorrowZero: d => {
        const A = digitsR(d.a), B = digitsR(d.b);
        if (!(d.a > d.b)) return 'a must be bigger than b';
        if (!(A[1] === 0 && A[0] < (B[0] || 0))) return 'the ones do not have to borrow across a zero tens';
      },
      estimate: d => {
        if (d.a % 100 === 50 || d.b % 100 === 50) return 'a tie at 50 — "close to" which hundred is ambiguous';
        if (d.a % 100 === 0 || d.b % 100 === 0) return 'a whole hundred in the stem needs no estimating';
        const E = d.op === '+' ? round100(d.a) + round100(d.b) : round100(d.a) - round100(d.b);
        if (E !== d.estimate) return 'estimate ' + d.estimate + ' should be ' + E;
        if (E < 100) return 'the estimate is ' + E;
        if (Math.abs(d.correct - E) >= 100) return 'the actual answer is not close to the estimate';
        for (const o of d.opts) if (o % 100 !== 0) return 'option ' + o + ' is not a whole hundred — not an estimate';
      },
      checkByAddition: d => {
        if (d.c !== d.a - d.b || d.c + d.b !== d.a) return 'c + b != a';
        if (!mySubCols(d.a, d.b).some(c => c.borrow)) return 'no borrowing';
      },
      multiply: d => {
        if ((d.a % 10) * d.d < 10) return 'the ones do not carry — the explanation says to carry into the tens';
      },
      divide: d => {
        if (d.dividend !== d.k * d.q + d.r || !(d.r >= 0 && d.r < d.k)) return 'dividend != k*q + r with 0 <= r < k';
        if (d.dividend > 99 || d.q < 10) return 'dividend ' + d.dividend + ' — the grade-3 divide lesson only does two-digit ÷ one-digit with a two-digit quotient';
      },
      perimeter: d => {
        if (!(d.L > d.W)) return 'length ' + d.L + ' is not longer than width ' + d.W;
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'addCarry': case 'addCascade': return String(d.a + d.b);
        case 'subBorrow': case 'subBorrowZero': return String(d.a - d.b);
        case 'estimate': return String(d.op === '+' ? round100(d.a) + round100(d.b) : round100(d.a) - round100(d.b));
        case 'checkByAddition': return String(d.a);
        case 'multiply': return String(d.a * d.d);
        case 'divide': { const q = Math.floor(d.dividend / d.k), r = d.dividend % d.k; return lang === 'zh' ? '商 ' + q + ' 餘 ' + r : q + ' r ' + r; }
        case 'perimeter': return String(2 * (d.L + d.W));
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'divide'){
        const m = lang === 'zh' ? s.match(/^商 (\d+) 餘 (\d+)$/) : s.match(/^(\d+) r (\d+)$/);
        if (!m) return 'option "' + s + '" is not a quotient-and-remainder in ' + lang;
        return;
      }
      if (!/^(0|[1-9]\d*)$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      if (n < 1) return 'option ' + n + ' — zero or less makes no sense here';
      if (n > 9999) return 'option ' + n + ' outside 1~9999 (three- and four-digit numbers)';
    },
    /* 渲染出來的題幹與解釋：每一條算式都要算得對；估算題的「a 接近 X」要真的是 a 四捨五入到整百 */
    renderCheck: function(d, q, lang, genId){
      let verified = 0, bad = null;
      [['stem', q.stem], ['why', q.why]].forEach(([f, t]) => {
        const r = simArith(t);
        verified += r.verified;
        if (r.problems.length && !bad) bad = genId + ' ' + lang + '.' + f + ': ' + r.problems[0];
      });
      if (bad) return bad;
      if (genId !== 'estimate' && verified < 1) return genId + ' ' + lang + ': no equation in the explanation was verified';
      if (genId === 'estimate'){
        const n = nums(q.why);
        if (n[0] !== d.a || n[1] !== round100(d.a) || n[2] !== d.b || n[3] !== round100(d.b) || n[4] !== d.estimate || n[5] !== d.correct) return 'estimate ' + lang + ': the explanation should read ' + [d.a, round100(d.a), d.b, round100(d.b), d.estimate, d.correct].join() + ' — should be "close to" the right hundreds, got ' + n.join();
      }
    }
  },

  data: {
    dataStart: '  /* ===================== 數學引擎',
    dataEnd: '  /* ===================== i18n',
    dataReturn: '{GPICK, MAT, matX, BLOCK, blockXY, TRADE_H, TRADE_TOKEN, GAME_TRADE, TAKE_H, TAKE_BTN, GAME_TAKE, takeShort, COL_H, COL, COL_Y, COL_SLOT, COL_CARRY, COL_PAD, COL_KEYS, GAME_COLUMN, colX, columnSteps, EST_H, EST_BIN, EST_CARD, EST_TRAY, GAME_EST, round100, estOf, estOk, VER_H, VER_CLAIM, VER_EQ, VER_CARD, VER_TRAY, GAME_VER}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 1. 每一條 I18N 靜態字串裡的算式逐條重算（lib/arith.js），驗過的集合用指紋釘住 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      {
        let vSum = 0, qSum = 0;
        LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
          const r = arithStatic(s);
          vSum += r.verified; qSum += r.questions;
          r.problems.forEach(p => fail(where + ': ' + p));
        }));
        arithStatic.unmatched().forEach(w => fail('wrongOnPurpose "' + w + '" never matched — stale, and it would silently excuse that equation'));
        const ex = arithStatic.excuseCounts();
        STATIC_WRONG.forEach(k => { if (ex[k] !== 2) fail('wrongOnPurpose "' + k + '" was excused ' + ex[k] + ' time(s), expected 2 (zh + en of the check-by-addition question)'); });
        const list = arithStatic.verifiedAll(), dg = sha(list.join(' | '));
        if (vSum !== VERIFIED_N || qSum !== QUESTIONS_N) fail('arithmetic coverage changed: verified ' + vSum + ' equations and ' + qSum + ' question-shaped ones, expected ' + VERIFIED_N + ' and ' + QUESTIONS_N);
        if (dg !== VERIFIED_SHA) fail('the set of verified equations changed (digest ' + dg + ', expected ' + VERIFIED_SHA + ')\n      now: ' + list.join(' | '));
      }

      /* --- 2. 靜態題庫裡兩題的推理（§六之二：正確的推理走不到任何一個錯誤選項） --- */
      LANGS.forEach(L => {
        const q = I18N[L].qs.filter(x => x.op === 'estimate')[0];
        if (!q) return fail('cannot find the estimate question in ' + L);
        const exact = q.a + q.b, key = round100(q.a) + round100(q.b);
        if (q.opts[q.ans] !== String(key)) fail('estimate question ' + L + ': the key should be ' + key + ', marked ' + q.opts[q.ans]);
        /* 選項都是整百；只有正解是「離精確答案最近的整百」—— 算出 815 再四捨五入的孩子也只會走到正解 */
        q.opts.forEach(o => {
          const v = +o;
          if (v % 100) fail('estimate question ' + L + ': option ' + o + ' is not a whole hundred — not an estimate');
          else if (v !== key && v === round100(exact)) fail('estimate question ' + L + ': option ' + o + ' is the exact answer rounded — also reachable');
        });
        if (round100(exact) !== key) fail('estimate question ' + L + ': the exact answer ' + exact + ' rounds to ' + round100(exact) + ', the key is ' + key);
        if (!(q.a > 300 && q.b > 300)) fail('estimate question ' + L + ': "600 is too small — both are more than 300" no longer holds');
        const w = I18N[L].qsAdv.filter(x => x.op === 'estword')[0];
        if (!w) return fail('cannot find the "is it enough" question in ' + L);
        const key2 = w.opts[w.ans], rA = round100(w.a), rB = round100(w.b);
        if (!(w.a < rA && w.b < rB && rA + rB === 700 && w.a + w.b < 700)) fail('"is it enough" ' + L + ': the reason must be that both prices were rounded UP and the total stays under 700');
        if (nums(key2).join() !== [w.a, rA, w.b, rB, rA, rB, 700].join()) fail('"is it enough" ' + L + ': the key option should say both were rounded UP (' + [w.a, rA, w.b, rB].join() + '), got: ' + key2);
      });
      /* 純加減題：正解自己算；三個誘答一定是三種叫得出名字的錯（忘了進位／大的減小的、最後兩位寫反、差了一個十），不抄題幹 */
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => I18N[L][bank].forEach((q, i) => {
        if (q.op !== '+' && q.op !== '-') return;
        const w = bank + '[' + i + '] ' + L, want = q.op === '+' ? q.a + q.b : q.a - q.b;
        if (q.opts[q.ans] !== String(want)) return fail(w + ': marked answer ' + q.opts[q.ans] + ', should be ' + want);
        const miscon = q.op === '+' ? +myAddCols(q.a, q.b).map(c => (c.x + c.y) % 10).reverse().join('').replace(/^0+(?=\d)/, '') : bigMinusSmall(q.a, q.b);
        const sw = String(want), tr = sw.length < 2 ? want + 3 : (sw[sw.length - 1] === sw[sw.length - 2] ? want + 11 : +(sw.slice(0, -2) + sw[sw.length - 1] + sw[sw.length - 2]));
        const named = [miscon, tr, q.op === '+' ? want + 10 : want - 10].map(String).sort().join();
        const wrongs = q.opts.filter((o, k) => k !== q.ans).slice().sort().join();
        if (wrongs !== named) fail(w + ': the distractors ' + wrongs + ' should be the three named mistakes ' + named);
        if (q.opts.some(o => o === String(q.a) || o === String(q.b))) fail(w + ': an option copies a stem number');
        if (q.boost === 'noCarryAdd' && q.opts.indexOf(String(miscon)) < 0) fail(w + ': the "forgot to carry" answer is not an option');
      })));

      /* --- 3. 範例 1、2 的旁白：每一步的數字用自己的直式重算 --- */
      {
        const ex = name => { const m = src.match(new RegExp('var ' + name + ' = (\\[[^\\]]*\\]);')); return m ? new Function('return ' + m[1])() : null; };
        const S1 = ex('S1_EX'), S2 = ex('S2_EX');
        if (!S1 || !S2) fail('cannot read S1_EX / S2_EX');
        else LANGS.forEach(L => {
          const d = I18N[L];
          S1.forEach(e => {
            myAddCols(e.a, e.b).forEach((c, i) => {
              /* 「6 + 5，再加上進位的 1 = 12」是給人讀的句子，算式解析器讀成「1 = 12」—— 這一句只逐個比數字 */
              const t = d.s1narrCol(d.places[i], c.x, c.y, c.cin, c.t);
              gseq('S1 ' + e.a + '+' + e.b + ' col ' + i + ' ' + L, t, c.cin ? [c.x, c.y, c.cin, c.t] : [c.x, c.y, c.t], false, true);
              if (c.x + c.y + c.cin !== c.t) fail('S1: my own column sum is off');
              if (c.t >= 10) gseq('S1 carry ' + L, d.s1narrCarry(1), [1]);
            });
            gseq('S1 done ' + L, d.s1narrDone(e.a, e.b, e.a + e.b), [e.a, e.b, e.a + e.b]);
          });
          S2.forEach(e => {
            /* 自己的退位：每一欄在「輪到它」的時候是多少（借出去過的要先減 1，借過的 0 是 9） */
            const A = digitsR(e.a), Bd = digitsR(e.b), wk = A.slice();
            for (let i = 0; i < A.length; i++){
              const y = Bd[i] || 0, tag = 'S2 ' + e.a + '-' + e.b + ' col ' + i + ' ' + L;
              if (wk[i] < y){
                let j = i + 1; while (wk[j] === 0){ wk[j] = 9; j++; } wk[j] -= 1;
                gseq(tag, d.s2narrBorrowSimple(d.places[i], wk[i], y, wk[i] + 10 - y), [wk[i], y, 1, 10, wk[i], wk[i] + 10, wk[i] + 10, y, wk[i] + 10 - y]);
                wk[i] += 10;
              } else gseq(tag, d.s2narrNoBorrow(d.places[i], wk[i], y, wk[i] - y), [wk[i], y, wk[i] - y]);
            }
            gseq('S2 lent ' + L, d.s2narrLent(6), [1, 10, 6, 1, 5]);
            /* 借出去的那一位可能是十位、百位或千位：句子不可以說它借出去的是「一個十」 */
            if (/個十|1 ten\b/.test(d.s2narrLent(6))) fail('S2 lent ' + L + ': names the lent block as a ten — false when the hundreds or thousands lend');
            gseq('S2 done ' + L, d.s2narrDone(e.a, e.b, e.a - e.b), [e.a, e.b, e.a - e.b]);
          });
        });
        /* 範例 2 的「下一步」照上面那個模型講：借過位的那一欄從借出去之後的數講起，借過的 0 也要講自己的減法 */
        if (!/if \(step\.borrow\)\{\s*msg \+= d\.s2narrBorrowSimple\(place, step\.effectiveTop - 10, step\.bottom, step\.diff\);\s*\} else \{\s*msg \+= d\.s2narrNoBorrow\(place, step\.effectiveTop, step\.bottom, step\.diff\);\s*\}/.test(src))
          fail('S2 narration: a borrowing column is not told from its value after lending, or a zero column skips its own subtraction');
      }

      /* --- 4. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['trade', 'take', 'column', 'est', 'verify'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the four examples), got ' + types.join());
      }
      TYPES.forEach(t => {
        if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
        LANGS.forEach(L => {
          if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
          if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
        });
      });
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_TRADE', 'GAME_TAKE', 'GAME_COLUMN', 'GAME_EST', 'GAME_VER'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the rubber band (height ' + D.TRADE_TOKEN.h + ')', Math.min(D.TRADE_TOKEN.w, D.TRADE_TOKEN.h));
      tooSmall('the split buttons (' + D.TAKE_BTN.w + '×' + D.TAKE_BTN.h + ')', Math.min(D.TAKE_BTN.w, D.TAKE_BTN.h));
      tooSmall('a digit card (' + D.COL_KEYS.size + ')', D.COL_KEYS.size);
      tooSmall('an estimate card', Math.min(D.EST_CARD.w, D.EST_CARD.h));
      tooSmall('a verify card', Math.min(D.VER_CARD.w, D.VER_CARD.h));
      tooSmall('a column-addition box with its pad', D.COL_SLOT + 2 * D.COL_PAD);
      tooSmall('a carry box with its pad', D.COL_CARRY + 2 * D.COL_PAD);
      tooSmall('a verify box with its pad', Math.min(D.VER_EQ.sw, D.VER_EQ.sh) + 2 * 4);
      [Math.min(D.TRADE_TOKEN.w, D.TRADE_TOKEN.h), D.COL_KEYS.size, Math.min(D.EST_CARD.w, D.EST_CARD.h), Math.min(D.VER_CARD.w, D.VER_CARD.h)].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 —— 中年級「輕度計分，答錯小扣分但不會結束」（§三） */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(src, 'roundMiss');
        if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      LANGS.forEach(L => {
        gseq('gPts ' + L, I18N[L].gPts(20), [20]);
        gseq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- valueOf()：板上每一欄的塊數讀成一個數（綁一綁、拆一拆的答案都是從板上讀的） --- */
      let valueOf = null;
      {
        const fsrc = extractFunction(src, 'valueOf');
        if (!fsrc) fail('cannot find valueOf() in index.html');
        else { try { valueOf = new Function(fsrc + '\nreturn valueOf;')(); } catch (e){ fail('valueOf() could not be evaluated: ' + e.message); } }
        if (valueOf) [[[5, 2, 4, 0], 425], [[0, 0, 5, 0], 500], [[3, 2, 0, 1], 1023], [[7, 3, 4, 1], 1437]].forEach(([c, v]) => { if (valueOf(c) !== v) fail('valueOf(' + c.join() + ') is ' + valueOf(c) + ', should be ' + v); });
      }

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          /* ① 位值板的四欄：欄和欄之間只隔 MAT.gap，放寬 6 之後會重疊 —— 欄裡的每一點都要判給那一欄 */
          const M = D.MAT, hh = (M.cntY + M.cntH - M.top) / 2;
          const cols = [0, 1, 2, 3].map(i => ({ id:i, cx:D.matX(i), cy:M.top + hh, hw:M.cw / 2, hh:hh, done:false }));
          let bad = 0;
          cols.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 6){ const g = nearestOpen(cols, { x, y }, 6); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a mat column are given to another column (or none)');
          /* ② 直式的格子 */
          const la = 4, sl = [];
          for (let i = 0; i <= la; i++) sl.push({ id:'r' + i, cx:D.colX(i), cy:D.COL_Y.res, hw:D.COL_SLOT / 2, hh:D.COL_SLOT / 2, done:false });
          for (let j = 1; j < la; j++) sl.push({ id:'c' + j, cx:D.colX(j), cy:D.COL_Y.carry, hw:D.COL_CARRY / 2, hh:D.COL_CARRY / 2, done:false });
          let bad2 = 0;
          sl.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 2){ const g = nearestOpen(sl, { x, y }, D.COL_PAD); if (!g || g.id !== b.id) bad2++; } });
          if (bad2) fail('nearestOpen(): ' + bad2 + ' points inside a column-addition box are given to another box (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 位值板（第 1、2 關） --- */
      const M = D.MAT;
      {
        const colR = i => ({ x:D.matX(i) - M.cw / 2, y:M.top, w:M.cw, h:M.h });
        for (let i = 0; i < 4; i++){
          const mx = M.x0 + (M.cols - 1 - i) * (M.cw + M.gap) + M.cw / 2;
          if (!near(D.matX(i), mx)) fail('matX(' + i + ') is ' + D.matX(i) + ', should be ' + mx);
        }
        const cr = [0, 1, 2, 3].map(colR);
        cr.forEach((r, i) => { inside(r, 'mat column ' + i, W, D.TRADE_H); inside(r, 'mat column ' + i, W, D.TAKE_H); });
        noHits(cr, 'mat: columns');
        if (M.gap < 2) fail('mat: columns ' + M.gap + 'px apart — they touch');
        if (M.headY + M.headH > M.top) fail('mat: the column heads overlap the columns');
        if (M.top + M.h > M.cntY) fail('mat: the count row overlaps the columns');
        if (M.cntY + M.cntH > M.takeY) fail('mat: the count row overlaps the "take away" row');
      }
      /* 一欄裡第 k 塊：自己的排法，和頁面的 blockXY 比；最多會有幾塊由兩關的重播量出來（maxCnt） */
      const myBlock = (i, k) => { const b = D.BLOCK[i]; return { x:M.cw / 2 + ((k % b.perRow) - (b.perRow - 1) / 2) * b.sx, y:6 + b.h / 2 + Math.floor(k / b.perRow) * b.sy + Math.floor(k / 10) * b.gap10 }; };
      const maxCnt = [0, 0, 0, 0];
      const blocksFit = () => {
        for (let i = 0; i < 4; i++){
          const b = D.BLOCK[i], rects = [];
          for (let k = 0; k < maxCnt[i]; k++){
            const p = D.blockXY(i, k), m = myBlock(i, k);
            if (!near(p.x, m.x) || !near(p.y, m.y)) return fail('blockXY(' + i + ', ' + k + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
            const r = sq(m.x, m.y, b.w, b.h);
            if (r.x < 3 || r.y < 3 || r.x + r.w > M.cw - 3 || r.y + r.h > M.h - 3) return fail('mat: block ' + (k + 1) + ' of column ' + i + ' (' + maxCnt[i] + ' at most) runs out of its column');
            rects.push(r);
          }
          noHits(rects, 'mat: blocks in column ' + i);
        }
      };
      const P_ZH = ['個位', '十位', '百位', '千位'], U_ZH = ['個', '條', '片', '塊', '個'];
      const P_EN = ['ones', 'tens', 'hundreds', 'thousands'], ONE_EN = ['one', 'ten', 'hundred', 'thousand', 'ten-thousand'];
      LANGS.forEach(L => { const h = I18N[L].gMatHead; if (!(Array.isArray(h) && h.join() === (L === 'zh' ? P_ZH : P_EN).join())) fail('gMatHead ' + L + ' should be ' + (L === 'zh' ? P_ZH : P_EN).join()); });

      /* --- 第 1 關：綁一綁（範例 1 的進位） --- */
      {
        let anyOne = false, anyCascade = false, anyNew = false, anyZero = false;
        D.GAME_TRADE.forEach((e, n) => {
          const w = 'GAME_TRADE[' + n + ']';
          if (!isInt(e.a) || !isInt(e.b) || e.a < 100 || e.a > 999 || e.b < 100 || e.b > 999) return fail(w + ': ' + e.a + ' + ' + e.b + ' should be three-digit');
          const A = digitsR(e.a), Bd = digitsR(e.b), s = e.a + e.b;
          let cnt = [0, 1, 2, 3].map(i => (A[i] || 0) + (Bd[i] || 0)), trades = 0;
          if (cnt[0] < 10) fail(w + ': the ones do not reach 10 — nothing to bundle in the first move');
          /* 照遊戲的規則從頭玩：只收「最右邊滿十的那一欄」；每一個狀態都把每一種放法的說明驗過 */
          for (let guard = 0; guard < 10; guard++){
            cnt.forEach((c, i) => { maxCnt[i] = Math.max(maxCnt[i], c); });
            const f = cnt.findIndex(c => c >= 10);
            LANGS.forEach(L => {
              const d = I18N[L];
              for (let i = 0; i < 4; i++){
                if (f >= 0 && f < i) gseq(w + ' gTradeOrder ' + L, d.gTradeOrder(f, cnt[f]), [cnt[f]]);
                else if (cnt[i] < 10){
                  const t = d.gTradeFew(i, cnt[i]);
                  gseq(w + ' gTradeFew ' + L, t, [cnt[i], 10]);
                  /* 不說「綁不成 1 個什麼」：千位的下一個單位畫面上沒有，說了就是一個不存在的積木 */
                  if (L === 'zh' && t !== P_ZH[i] + '只有 ' + cnt[i] + ' ' + U_ZH[i] + '，不到 10 ' + U_ZH[i] + '，還不能綁。') fail(w + ' gTradeFew zh: wrong place or unit words: ' + t);
                  if (L === 'en' && t !== 'The ' + P_EN[i] + ' column only has ' + cnt[i] + ' — fewer than 10, so there aren’t enough to make a bundle yet.') fail(w + ' gTradeFew en: wrong place words: ' + t);
                }
              }
              if (f >= 0){
                gseq(w + ' gTradeMore ' + L, d.gTradeMore(f, cnt[f]), [cnt[f], 10, 1]);
                gseq(w + ' gTrade2 ' + L, d.gTrade2(f, cnt[f]), [cnt[f]]);
                const did = d.gTradeDid(f);
                gseq(w + ' gTradeDid ' + L, did, [10, 1]);
                if (L === 'zh' && did.indexOf('10 ' + U_ZH[f] + '綁成 1 ' + U_ZH[f + 1] + '，放進' + ['十位', '百位', '千位', '萬位'][f]) < 0) fail(w + ' gTradeDid zh: wrong unit words: ' + did);
                if (L === 'en' && did.indexOf('10 ' + P_EN[f] + ' became 1 ' + ONE_EN[f + 1] + ' in the ' + ['tens', 'hundreds', 'thousands', 'ten-thousands'][f]) < 0) fail(w + ' gTradeDid en: wrong unit words: ' + did);
              } else gseq(w + ' gTrade2(done) ' + L, d.gTrade2(-1, 0), [10]);
            });
            if (f < 0) break;
            if (f === 3) return fail(w + ': the thousands column reaches 10 — there is no fifth column to bundle into');
            const before = cnt[f + 1];
            cnt[f] -= 10; cnt[f + 1] += 1; trades++;
            if (before === 9 && cnt[f + 1] === 10) anyCascade = true;
          }
          if (cnt.some(c => c >= 10)) return fail(w + ': bundling never finishes');
          const got = cnt[0] + 10 * cnt[1] + 100 * cnt[2] + 1000 * cnt[3];
          if (got !== s) fail(w + ': the board reads ' + got + ' after bundling, not ' + s);
          if (valueOf && valueOf(cnt) !== s) fail(w + ': valueOf() reads ' + valueOf(cnt));
          if (trades === 1) anyOne = true;
          if (cnt[3] > 0) anyNew = true;
          if (cnt.slice(0, String(s).length).some(c => c === 0)) anyZero = true;
          LANGS.forEach(L => {
            const d = I18N[L];
            gseq(w + ' gTradeNow ' + L, d.gTradeNow(e.a, e.b, null), [e.a, e.b]);
            gseq(w + ' gTradeNow(s) ' + L, d.gTradeNow(e.a, e.b, s), [e.a, e.b, s]);
            gseq(w + ' gTradeDone ' + L, d.gTradeDone(e.a, e.b, s), [e.a, e.b, s, 10]);
          });
        });
        if (!anyOne) fail('GAME_TRADE: no entry needs one bundle only — "keep bundling until every column" would always be the same length');
        if (!anyCascade) fail('GAME_TRADE: no entry where a column reaches 10 only because of the carry (9 + 1)');
        if (!anyNew) fail('GAME_TRADE: no entry carries into a new digit (the thousands)');
        if (!anyZero) fail('GAME_TRADE: no entry has a 0 in the answer');
        const T = D.TRADE_TOKEN, tok = sq(150, T.y, T.w, T.h);
        inside(tok, 'trade: the rubber band', W, D.TRADE_H);
        if (tok.y < M.cntY + M.cntH + 6 + 4) fail('trade: the rubber band at home is inside a column\'s drop pad');
        LANGS.forEach(L => { if (I18N[L].gTradeTok.length > 14) fail('trade: the band label "' + I18N[L].gTradeTok + '" may not fit ' + T.w + 'px'); });
        need('trade', /cnt\.push\(\(A\[i\] \|\| 0\) \+ \(Bd\[i\] \|\| 0\)\);/, 'the board is not the two numbers\' digits added column by column');
        need('trade', /var c = nearestOpen\(M\.cols, pt, 6\);\s*if \(!c\) return false;/, 'a drop away from every column is not silent');
        need('trade', /if \(f >= 0 && f < c\.i\)\{ roundMiss\(d\.gTradeOrder\(f, cnt\[f\]\)\); return false; \}/, 'a left column is bundled first while a column to its right still has 10');
        need('trade', /if \(cnt\[c\.i\] < 10\)\{ roundMiss\(d\.gTradeFew\(c\.i, cnt\[c\.i\]\)\); return false; \}/, 'a column with fewer than 10 is bundled');
        need('trade', /cnt\[c\.i\] -= 10; cnt\[c\.i \+ 1\] \+= 1;\s*M\.paint\(\);/, 'a bundle does not take 10 and give 1 to the left');
        need('trade', /if \(f >= 0\)\{ roundMiss\(d\.gTradeMore\(f, cnt\[f\]\)\); return; \}/, '"all done" is accepted while a column still has 10');
        need('trade', /tok\.lock\(tok\.homeX, tok\.homeY\);/, 'the band is not sent home when the round ends (a band mid-drag would stay on a column)');
        need('trade', /var s = valueOf\(cnt\);\s*line\.textContent = d\.gTradeNow\(e\.a, e\.b, s\);\s*roundSolved\(d\.gTradeDone\(e\.a, e\.b, s\)\);/, 'the answer is not read from the board');
        need('trade', /if \(pt\.tap\) keepSelected\(B, P\);/, 'after a tap-then-tap bundle the band is not kept selected');
      }

      /* --- 第 2 關：拆一拆（範例 2 的退位與借過 0）：把所有拆法都走一遍 --- */
      {
        let anyLend = false, anyTwoZeros = false, lendMatters = false;
        D.GAME_TAKE.forEach((e, n) => {
          const w = 'GAME_TAKE[' + n + ']';
          if (!isInt(e.a) || !isInt(e.b) || e.a < 100 || e.a > 9999 || e.b < 10 || e.b >= e.a) return fail(w + ': ' + e.a + ' − ' + e.b + ' should be a three- or four-digit number minus a smaller one');
          const A = digitsR(e.a), Bd = digitsR(e.b), tk = [0, 1, 2, 3].map(i => Bd[i] || 0), start = [0, 1, 2, 3].map(i => A[i] || 0), res = e.a - e.b;
          if (!(start[0] < tk[0] && start[1] === 0)) fail(w + ': the ones are not short with a 0 in the tens — this round is about borrowing across a zero');
          if (start[1] === 0 && start[2] === 0) anyTwoZeros = true;
          const seen = new Set(), stack = [start];
          let ends = 0;
          while (stack.length){
            const c = stack.pop(), key = c.join(); if (seen.has(key)) continue; seen.add(key);
            c.forEach((x, i) => { maxCnt[i] = Math.max(maxCnt[i], x); });
            const sh = myShort(c, tk), page = D.takeShort(c.slice(), tk.slice());
            if (c.some((x, i) => x < tk[i]) !== sh.some(x => x) || sh.some((x, i) => x !== (c[i] < tk[i]))) lendMatters = true;
            if (page.join() !== sh.join()) fail(w + ': takeShort(' + key + ') is ' + page.join() + ', should be ' + sh.join());
            const moves = [];
            LANGS.forEach(L => {
              const d = I18N[L];
              for (let i = 1; i < 4; i++){
                const r = i - 1;
                if (!sh[r]){
                  const lend = r > 0 && sh[r - 1];
                  if (lend){ anyLend = true; if (!(c[r] >= tk[r] + 1)) fail(w + ': "enough to take ' + tk[r] + ' and split 1" is false at ' + key); gseq(w + ' gBreakNoNeedLend ' + L, d.gBreakNoNeedLend(r, c[r], tk[r]), [c[r], tk[r], 1]); }
                  else { if (!(c[r] >= tk[r])) fail(w + ': "enough to take" is false at ' + key); gseq(w + ' gBreakNoNeed ' + L, d.gBreakNoNeed(r, c[r], tk[r]), [c[r], tk[r]]); }
                } else if (c[i] === 0){
                  gseq(w + ' gBreakZero ' + L, d.gBreakZero(i), []);
                  if (!c.slice(i + 1).some(x => x > 0)) fail(w + ': "split one further left" — there is nothing further left at ' + key);
                } else {
                  gseq(w + ' gBreakDid ' + L, d.gBreakDid(i), [1, 10]);
                  if (L === 'zh') moves.push(i);
                }
              }
              const j = sh.indexOf(true);
              if (j >= 0){
                gseq(w + ' gTakeShort ' + L, d.gTakeShort(j, c[j], tk[j]), [c[j], tk[j], 1]);
                if (!(c[j] < tk[j])) fail(w + ': "not enough to take away" is false at ' + key);
                let k = j + 1; while (k < 3 && c[k] === 0) k++;
                if (!(c[k] > 0 && sh[k - 1])) fail(w + ': the hint points at the ' + P_EN[k] + ' split, which is not allowed at ' + key);
                gseq(w + ' gTake2 ' + L, d.gTake2(j, c[j], tk[j], k), k === j + 1 ? [c[j], tk[j]] : [c[j], tk[j], 0]);
              } else gseq(w + ' gTake2(done) ' + L, d.gTake2(-1), []);
            });
            if (!moves.length){
              ends++;
              if (sh.some(x => x)) { fail(w + ': stuck at ' + key + ' — a column is short and nothing can be split'); continue; }
              const left = c.map((x, i) => x - tk[i]);
              if (left.some(x => x < 0 || x > 9)) fail(w + ': taking away leaves ' + left.join() + ' — not one digit per column');
              const got = left[0] + 10 * left[1] + 100 * left[2] + 1000 * left[3];
              if (got !== res) fail(w + ': the board reads ' + got + ' after taking away, not ' + res);
              if (valueOf && valueOf(left) !== res) fail(w + ': valueOf() reads ' + valueOf(left));
              continue;
            }
            moves.forEach(i => { const nx = c.slice(); nx[i] -= 1; nx[i - 1] += 10; stack.push(nx); });
          }
          if (!ends) fail(w + ': the round can never be finished');
          LANGS.forEach(L => {
            const d = I18N[L];
            gseq(w + ' gTakeNow ' + L, d.gTakeNow(e.a, e.b, null), [e.a, e.b]);
            gseq(w + ' gTakeNow(c) ' + L, d.gTakeNow(e.a, e.b, res), [e.a, e.b, res]);
            gseq(w + ' gTakeDone ' + L, d.gTakeDone(e.a, e.b, res), [e.a, e.b, res]);
            gseq(w + ' gTakeBtn ' + L, d.gTakeBtn(e.b), [e.b]);
          });
        });
        if (!anyLend) fail('GAME_TAKE: "enough, even after lending 1 to the right" is never reachable');
        if (!anyTwoZeros) fail('GAME_TAKE: no entry borrows across two zeros');
        if (!lendMatters) fail('GAME_TAKE: no entry where a column looks like it has enough but must still lend 1 to its right — takeShort()\'s lend rule is never exercised');
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let i = 1; i < 4; i++){
            const a = d.gBreakAria(i), did = d.gBreakDid(i);
            if (L === 'zh' && (a !== '把' + P_ZH[i] + '的 1 ' + U_ZH[i] + '拆成 10 ' + U_ZH[i - 1] || did.indexOf('1 ' + U_ZH[i] + '拆成 10 ' + U_ZH[i - 1] + '，放進' + P_ZH[i - 1]) < 0)) fail('gBreakAria/gBreakDid zh ' + i + ': wrong unit words: ' + a + ' / ' + did);
            if (L === 'en' && (a.indexOf('1 ' + ONE_EN[i] + ' into 10 ' + P_EN[i - 1]) < 0 || did.indexOf('1 ' + ONE_EN[i] + ' became 10 ' + P_EN[i - 1] + ' in the ' + P_EN[i - 1]) < 0)) fail('gBreakAria/gBreakDid en ' + i + ': wrong unit words: ' + a + ' / ' + did);
          }
          if (d.gBreakBtn.length > 8) fail('take: the split label "' + d.gBreakBtn + '" may not fit ' + D.TAKE_BTN.w + 'px');
        });
        /* 三個「拆」按鈕在十、百、千三欄下面，在畫板裡、不碰到「拿走」那一排 */
        const TB = D.TAKE_BTN, btns = [1, 2, 3].map(i => sq(D.matX(i), TB.y, TB.w, TB.h));
        btns.forEach((b, i) => inside(b, 'take: split button ' + (i + 1), W, D.TAKE_H)); noHits(btns, 'take: split buttons');
        if (TB.y - TB.h / 2 < M.takeY + M.takeH + 2) fail('take: the split buttons overlap the red "take away" row');
        need('take', /if \(!sh\[r\]\)\{\s*if \(r > 0 && sh\[r - 1\]\) roundMiss/, 'a split is accepted when the right column has enough');
        need('take', /if \(r > 0 && sh\[r - 1\]\) roundMiss\(d\.gBreakNoNeedLend\(r, cnt\[r\], tk\[r\]\)\);\s*else roundMiss\(d\.gBreakNoNeed\(r, cnt\[r\], tk\[r\]\)\);\s*return;\s*\}/, '"enough" does not say whether it still has to lend 1 to the right (gBreakNoNeedLend)');
        need('take', /if \(cnt\[i\] === 0\)\{ roundMiss\(d\.gBreakZero\(i\)\); return; \}\s*cnt\[i\] -= 1; cnt\[r\] \+= 10;/, 'an empty column can be split, or a split does not give 10 to the right');
        need('take', /var sh = takeShort\(cnt, tk\), r = i - 1;/, 'a split is not judged by takeShort()');
        need('take', /for \(var j = 0; j < MAT\.cols; j\+\+\) if \(sh\[j\]\)\{ roundMiss\(d\.gTakeShort\(j, cnt\[j\], tk\[j\]\)\); return; \}\s*for \(var k = 0; k < MAT\.cols; k\+\+\)\{ cnt\[k\] -= tk\[k\]; takes\[k\]\.textContent = ''; \}/, '"take away" is accepted with a short column, or does not take b');
        need('take', /var c = valueOf\(cnt\);\s*line\.textContent = d\.gTakeNow\(e\.a, e\.b, c\);\s*roundSolved\(d\.gTakeDone\(e\.a, e\.b, c\)\);/, 'the answer is not read from the board');
        need('take', /var k = j \+ 1; while \(k < MAT\.cols - 1 && cnt\[k\] === 0\) k\+\+;\s*return d\.gTake2\(j, cnt\[j\], tk\[j\], k\);/, 'the hint points at the wrong split button');
        need('take', /for \(var b = 1; b < MAT\.cols; b\+\+\)/, 'there is no split button under the tens, hundreds and thousands');
        need('take', /btn\.style\.left = \(matX\(i\) - TAKE_BTN\.w \/ 2\) \+ 'px'; btn\.style\.top = \(TAKE_BTN\.y - TAKE_BTN\.h \/ 2\) \+ 'px';\s*btn\.style\.width = TAKE_BTN\.w \+ 'px'; btn\.style\.height = TAKE_BTN\.h \+ 'px';/, 'cannot read where the split buttons are drawn');
      }
      blocksFit();
      if (maxCnt[0] < 10 || maxCnt[1] < 10) fail('mat: the replays never put 10 blocks in a column — the block layout is not exercised');

      /* --- 第 3 關：填直式（範例 1 的寫法，四位數） --- */
      {
        const CY = D.COL_Y, h = D.COL_SLOT / 2;
        let anyNoCarry = false, anyLead = false;
        D.GAME_COLUMN.forEach((e, n) => {
          const w = 'GAME_COLUMN[' + n + ']';
          if (!isInt(e.a) || !isInt(e.b) || e.a < 1000 || e.a > 9999 || e.b < 1000 || e.b > 9999) return fail(w + ': ' + e.a + ' + ' + e.b + ' should be four-digit + four-digit');
          const cols = myAddCols(e.a, e.b), s = e.a + e.b, la = 4;
          if (cols[0].t < 10) fail(w + ': the ones do not carry');
          if (cols.slice(0, la).filter(c => c.t >= 10).length < 2) fail(w + ': fewer than two carries');
          if (cols.slice(0, la - 1).some(c => c.t < 10)) anyNoCarry = true;
          if (s >= 10000) anyLead = true;
          /* 自己的格子順序 */
          const mine = [];
          cols.slice(0, la).forEach((c, i) => {
            mine.push(['r', i, c.t % 10].join(':'));
            if (c.t >= 10) mine.push([i === la - 1 ? 'r' : 'c', i + 1, 1].join(':'));
          });
          const steps = D.columnSteps(e.a, e.b), theirs = steps.map(t => [t.kind, t.col, t.v].join(':'));
          if (theirs.join() !== mine.join()) fail(w + ': columnSteps(' + e.a + ', ' + e.b + ') is ' + theirs.join() + ', should be ' + mine.join());
          steps.forEach((t, k) => { const c = cols[t.from]; if (!c || t.x !== c.x || t.y !== c.y || t.carryIn !== c.cin || t.total !== c.t) fail(w + ': step ' + k + ' says column ' + t.from + ' is ' + t.x + ' + ' + t.y + ' + ' + t.carryIn + ' = ' + t.total); });
          const read = +mine.filter(x => x[0] === 'r').map(x => +x.split(':')[2]).reverse().join('');
          if (read !== s) fail(w + ': the answer row would read ' + read + ', not ' + s);
          LANGS.forEach(L => {
            const d = I18N[L];
            gseq(w + ' gColNow ' + L, d.gColNow(e.a, e.b, null), [e.a, e.b]);
            gseq(w + ' gColDone ' + L, d.gColDone(e.a, e.b, s), [e.a, e.b, s]);
            cols.slice(0, la).forEach((c, i) => {
              const tag = w + ' column ' + i + ' ' + L;
              const k = c.t >= 10 ? (i === la - 1 ? 'lead' : 'carry') : null;
              gseq(tag + ' gCol2', d.gCol2('main', d.gColPlaces[i], c.x, c.y, c.cin, c.t), [c.x, c.y].concat(c.cin ? [1] : []).concat([c.t, c.t % 10]).concat(c.t >= 10 ? [1] : []));
              if (d.gCol2('main', d.gColPlaces[i], c.x, c.y, c.cin, c.t).indexOf(d.gColPlaces[i]) < 0) fail(tag + ': gCol2 does not name the column');
              if (k){ gseq(tag + ' gCol2 ' + k, d.gCol2(k, d.gColPlaces[i], c.x, c.y, c.cin, c.t), [c.t, 1]); gseq(tag + ' gColCarryNow', d.gColCarryNow(c.t), [c.t, 1]); gseq(tag + ' gColResFirst', d.gColResFirst(c.t), [c.t]); }
              else gseq(tag + ' gColNoNeed', d.gColNoNeed(c.x, c.y, c.cin, c.t), [c.x, c.y].concat(c.cin ? [1] : []).concat([c.t]));
              if (d.gColOrder(d.gColPlaces[i]).indexOf(d.gColPlaces[i]) < 0) fail(tag + ': gColOrder does not name the column');
              /* 每一張錯的數字卡：自己的分類（忘了進位／把十位寫下來／其他） */
              for (let v = 0; v <= 9; v++){
                if (v === c.t % 10) continue;
                if (c.cin && v === (c.x + c.y) % 10) gseq(tag + ' card ' + v + ' gColForgot', d.gColForgot(c.x, c.y), [c.x, c.y, c.x + c.y, 1]);
                else if (c.t >= 10 && v === 1) gseq(tag + ' card ' + v + ' gColTens', d.gColTens(c.t), [c.t, c.t % 10, 1]);
                else gseq(tag + ' card ' + v + ' gColWrong', d.gColWrong(c.x, c.y, c.cin, v), [c.x, c.y].concat(c.cin ? [1] : []).concat([v]));
                if (k === 'carry' && v !== 1) gseq(tag + ' carry card ' + v, d.gColWrongCarry(c.t, v), [c.t, 1, v]);
                if (k === 'lead' && v !== 1) gseq(tag + ' lead card ' + v, d.gColWrongLead(c.t, v), [c.t, 1, v]);
              }
            });
          });
          /* 版面：格子、數字、符號在畫板裡、互不重疊 */
          const parts = [];
          for (let i = 0; i <= la; i++) parts.push(sq(D.colX(i), CY.res, D.COL_SLOT));
          for (let j = 1; j < la; j++) parts.push(sq(D.colX(j), CY.carry, D.COL_CARRY));
          for (let i = 0; i < la; i++){ parts.push(sq(D.colX(i), CY.a, 44)); parts.push(sq(D.colX(i), CY.b, 44)); }
          parts.push(sq(D.COL.opX, CY.b, 44));
          parts.forEach((o, k) => inside(o, w + ' column part ' + k, W, D.COL_H)); noHits(parts, 'column: boxes, digits and the + sign');
        });
        for (let c = 0; c < 5; c++){ const mx = D.COL.right - D.COL.cw / 2 - c * D.COL.cw; if (!near(D.colX(c), mx)) fail('colX(' + c + ') should be ' + mx); }
        if (!anyNoCarry) fail('GAME_COLUMN: no entry has a column without a carry — the empty carry box is never practised');
        if (!anyLead) fail('GAME_COLUMN: no entry gains a fifth digit');
        const KY = D.COL_KEYS, keys = [];
        for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * KY.step, KY.y + Math.floor(v / 5) * KY.rowStep, KY.size));
        keys.forEach((o, k) => inside(o, 'column: digit card ' + k, W, D.COL_H)); noHits(keys, 'column: digit cards');
        if (KY.y - KY.size / 2 < CY.res + h + D.COL_PAD + 4) fail('column: the digit cards reach the answer row');
        if (CY.rule < CY.b + 22 || CY.rule + 3 > CY.res - h) fail('column: the rule line is not between b and the answer row');
        need('column', /for \(var i = 0; i <= la; i\+\+\) mkSlot\('r', i, COL_Y\.res, COL_SLOT\);\s*for \(var j = 1; j < la; j\+\+\) mkSlot\('c', j, COL_Y\.carry, COL_CARRY\);/, 'the answer row is not la + 1 boxes with carry boxes above the tens…thousands');
        need('column', /var s = nearestOpen\(slots, pt, COL_PAD\);\s*if \(!s\) return false;/, 'a box is not picked as the nearest open box');
        need('column', /if \(s\.kind !== N\.kind \|\| s\.col !== N\.col\)\{/, 'a box can be filled out of order');
        need('column', /if \(!inSteps\)\{ var t0 = stepOfCol\(sf\); roundMiss\(d\.gColNoNeed\(t0\.x, t0\.y, t0\.carryIn, t0\.total\)\); \}/, 'a carry box of a column that did not reach ten has no reason of its own');
        need('column', /else if \(sf > N\.from\) roundMiss\(N\.col > N\.from \? d\.gColCarryNow\(N\.total\) : d\.gColOrder\(d\.gColPlaces\[N\.from\]\)\);\s*else roundMiss\(d\.gColResFirst\(N\.total\)\);/, 'the order messages are not tied to the step');
        need('column', /\n {8}if \(v !== N\.v\)\{\n/, 'a wrong digit is accepted');
        need('column', /if \(N\.kind === 'c'\) roundMiss\(d\.gColWrongCarry\(N\.total, v\)\);\s*else if \(N\.col > N\.from\) roundMiss\(d\.gColWrongLead\(N\.total, v\)\);\s*else if \(N\.carryIn > 0 && v === \(N\.x \+ N\.y\) % 10\) roundMiss\(d\.gColForgot\(N\.x, N\.y\)\);\s*else if \(N\.total >= 10 && v === Math\.floor\(N\.total \/ 10\)\) roundMiss\(d\.gColTens\(N\.total\)\);\s*else roundMiss\(d\.gColWrong\(N\.x, N\.y, N\.carryIn, v\)\);/, 'a wrong digit is not classified the way the config checks it');
        need('column', /P\.home\(\);\s*\/\* 數字卡拿不完/, 'the digit card does not go back (cards must never run out)');
        need('column', /cy:COL_KEYS\.y \+ Math\.floor\(v \/ 5\) \* COL_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
        need('column', /if \(next === steps\.length\)\{/, 'the round is not solved exactly when every box is filled');
      }

      /* --- 第 4 關：估一估（範例 3） --- */
      {
        const EB = D.EST_BIN, EC = D.EST_CARD, ET = D.EST_TRAY;
        D.GAME_EST.forEach((set, n) => {
          const w = 'GAME_EST[' + n + ']';
          if (!Array.isArray(set) || set.length !== 4) return fail(w + ' should hold 4 cards');
          let okN = 0, farN = 0, plus = 0, minus = 0;
          set.forEach((c, k) => {
            const ww = w + '[' + k + ']', [a, op, b, v] = c;
            if (![a, b, v].every(isInt) || (op !== '+' && op !== '-')) return fail(ww + ' is not [a, "+"/"-", b, c]');
            if (op === '+') plus++; else minus++;
            if (a % 100 === 50 || b % 100 === 50) fail(ww + ': a tie at 50 — which hundred is "nearest" is ambiguous');
            const E = op === '+' ? round100(a) + round100(b) : round100(a) - round100(b), exact = op === '+' ? a + b : a - b;
            if (D.round100(a) !== round100(a) || D.round100(b) !== round100(b) || D.estOf(c) !== E) fail(ww + ': estOf() is ' + D.estOf(c) + ', should be ' + E);
            if (E <= 0) fail(ww + ': the estimate is ' + E);
            const right = v === exact, ok = Math.abs(v - E) < 100;
            if (D.estOk(c) !== ok) fail(ww + ': estOk() says ' + D.estOk(c) + ', should be ' + ok);
            if (right){ okN++; if (!ok) fail(ww + ': a right answer is not close to its estimate'); }
            else {
              if (ok) fail(ww + ': ' + v + ' is wrong but close to the estimate ' + E + ' — estimating cannot catch it, "reasonable" would be taught for a wrong answer');
              else if (Math.abs(v - E) < 300) fail(ww + ': ' + v + ' is not 300 or more away from ' + E + ' — the sort is not clear-cut');
              else farN++;
              /* 錯的答案必須是一種叫得出名字的錯：並排寫、少寫最前面的 1、b 往左錯一位 */
              const named = [sideBySide(a, b), exact - 1000, op === '+' ? a + b * 10 : a - b * 10];
              if (named.indexOf(v) < 0) fail(ww + ': ' + v + ' is not a known mistake (side by side ' + named[0] + ', dropped leading 1 ' + named[1] + ', misaligned ' + named[2] + ')');
            }
            if (!right && v === exact) fail(ww + ' is not right');
            if ((String(a).length + String(b).length + 3) > 11 || String(v).length + 2 > 9) fail(ww + ': the card text may not fit ' + EC.w + 'px');
            LANGS.forEach(L => {
              const d = I18N[L], sym = op === '+' ? '+' : '−', diff = Math.abs(v - E);
              gseq(ww + ' gEstNear/Far ' + L, (ok ? d.gEstNear : d.gEstFar)(round100(a), sym, round100(b), E, v), [round100(a), round100(b), E, v, E, diff]);
              gseq(ww + ' gEst2 ' + L, d.gEst2(a, sym, b, round100(a), round100(b), E), [a, b, round100(a), round100(b), E]);
            });
          });
          if (okN !== 2 || farN !== 2) fail(w + ': should be 2 right answers and 2 way-off ones, got ' + okN + ' / ' + farN);
          if (!plus || !minus) fail(w + ': no ' + (plus ? '−' : '+') + ' card');
        });
        /* estOk 的規則對「任何對的答案」都成立：a、b 在 100～999（沒有 50 的平手）時，精確答案離估計一定不到 100 */
        for (let a = 101; a < 1000; a += 7) for (let b = 103; b < 1000; b += 11){
          if (a % 100 === 50 || b % 100 === 50) continue;
          if (!D.estOk([a, '+', b, a + b])) return fail('estOk(): the right answer ' + a + ' + ' + b + ' = ' + (a + b) + ' is called way off');
          if (a > b && !D.estOk([a, '-', b, a - b])) return fail('estOk(): the right answer ' + a + ' − ' + b + ' = ' + (a - b) + ' is called way off');
        }
        LANGS.forEach(L => { gseq('gEstDone ' + L, I18N[L].gEstDone(2), [2]); gseq('gEstNow ' + L, I18N[L].gEstNow(1, 4), [1, 4]); });
        /* 兩個框放得下兩張卡；托盤 2 × 2 在框下面 */
        const bins = EB.x.map(x => ({ x, y:EB.y, w:EB.w, h:EB.h }));
        bins.forEach((o, k) => inside(o, 'est: box ' + k, W, D.EST_H)); noHits(bins, 'est: boxes');
        if (EB.lbl + 6 + 2 * EC.h + 4 > EB.h) fail('est: a box holds 2 cards only if it is ' + (EB.lbl + 6 + 2 * EC.h + 4) + ' tall, it is ' + EB.h);
        if (EC.w > EB.w - 4) fail('est: a card is wider than its box');
        const x0 = (W - ET.step) / 2, tray = [0, 1, 2, 3].map(i => sq(x0 + (i % 2) * ET.step, ET.y + Math.floor(i / 2) * ET.rowStep, EC.w, EC.h));
        tray.forEach((o, k) => inside(o, 'est: card ' + k, W, D.EST_H)); noHits(tray, 'est: cards');
        if (ET.y - EC.h / 2 < EB.y + EB.h + 6 + 2) fail('est: the card tray reaches the boxes (or their drop pad)');
        need('est', /var c = P\.data\.c, ok = estOk\(c\), E = estOf\(c\);/, 'the sort is not judged by estOk()');
        need('est', /var why = \(ok \? d\.gEstNear : d\.gEstFar\)\(round100\(c\[0\]\), sym\(c\), round100\(c\[2\]\), E, c\[3\]\);\s*if \(bin\.ok !== ok\)\{ roundMiss\(why\); return false; \}/, 'a card in the wrong box is accepted, or the reason is not its own');
        need('est', /P\.lock\(bin\.cx, EST_BIN\.y \+ EST_BIN\.lbl \+ 6 \+ EST_CARD\.h \/ 2 \+ bin\.n \* \(EST_CARD\.h \+ 4\)\);/, 'cannot read where a sorted card goes');
        need('est', /if \(left === 0\) roundSolved\(d\.gEstDone\(bins\[1\]\.n\)\);/, 'the round is not solved exactly when every card is sorted');
        need('est', /\}, EST_TRAY\.step, 2, EST_TRAY\.rowStep\);/, 'the tray is not 2 × 2');
      }

      /* --- 第 5 關：驗算（範例 4） --- */
      {
        const EQ = D.VER_EQ, maxLen = +((B.verify.match(/inp\.maxLength = (\d+);/) || [])[1]);
        if (!maxLen) fail('verify: cannot read the answer box maxLength');
        let rights = 0, wrongs = 0;
        D.GAME_VER.forEach((e, n) => {
          const w = 'GAME_VER[' + n + ']';
          if (![e.a, e.b, e.c].every(isInt)) return fail(w + ' is not whole numbers');
          if (e.a < 100 || e.a > 999 || e.b < 100 || e.b >= e.a) fail(w + ': ' + e.a + ' − ' + e.b + ' should be three-digit minus a smaller three-digit');
          if (new Set([e.a, e.b, e.c]).size !== 3) fail(w + ': the cards ' + [e.a, e.b, e.c].join() + ' are not all different');
          const s = e.c + e.b, t = e.a - e.b, right = e.c === t;
          if (String(s).length > maxLen) fail(w + ': the sum ' + s + ' does not fit the ' + maxLen + '-digit answer box');
          if (!mySubCols(e.a, e.b).some(c => c.borrow)) fail(w + ': no borrowing — nothing to get wrong');
          if (right) rights++;
          else {
            wrongs++;
            if (s === e.a) fail(w + ': the claim is wrong but c + b still equals a');
            if ([bigMinusSmall(e.a, e.b), forgotToReduce(e.a, e.b)].indexOf(e.c) < 0) fail(w + ': Max\'s ' + e.c + ' is not a known mistake (bigger-minus-smaller ' + bigMinusSmall(e.a, e.b) + ', forgot to take 1 off ' + forgotToReduce(e.a, e.b) + ')');
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            gseq(w + ' gVerClaim ' + L, d.gVerClaim(e.a, e.b, e.c), [e.a, e.b, e.c], !right);
            gseq(w + ' gVerMinuend ' + L, d.gVerMinuend(e.a), [e.a, e.a]);
            gseq(w + ' gVerCopied ' + L, d.gVerCopied(e.a, e.c, e.b), [e.a, e.c, e.b]);
            gseq(w + ' gVerWrongSum ' + L, d.gVerWrongSum(e.c, e.b, s + 1), [e.c, e.b, s + 1]);
            gseq(w + ' gVerCompare ' + L, d.gVerCompare(e.c, e.b, s, e.a), [e.c, e.b, s, e.a]);
            if (right){ gseq(w + ' gVerSaidNo ' + L, d.gVerSaidNo(s, e.a), [s, e.a]); gseq(w + ' gVerRight ' + L, d.gVerRight(e.a, e.b, e.c), [e.c, e.b, e.a, e.a, e.b, e.c]); }
            else { gseq(w + ' gVerSaidYes ' + L, d.gVerSaidYes(s, e.a), [s, e.a]); gseq(w + ' gVerWrong ' + L, d.gVerWrong(e.a, e.b, e.c, s, t), [e.c, e.b, s, e.a, e.a, e.b, t]); }
            gseq(w + ' gVer2c ' + L, d.gVer2c(e.a, e.b, e.c), [e.c, e.b, e.a]);
            const x = e.c % 10, y = e.b % 10;
            gseq(w + ' gVer2s ' + L, d.gVer2s(x, y), [x, y, x + y].concat(x + y >= 10 ? [(x + y) % 10, 1] : []));
            gseq(w + ' gVer2v ' + L, d.gVer2v(s, e.a), [s, e.a]);
            gseq(w + ' gVerNow ' + L, d.gVerNow(e.b, e.c, s), [e.b, e.c, s]);
          });
        });
        if (rights < 2 || wrongs < 2) fail('GAME_VER: should have at least 2 right and 2 wrong claims (' + rights + ' right and ' + wrongs + ' wrong)');
        const row = [sq(EQ.x[0], EQ.y, EQ.sw, EQ.sh), sq(EQ.x[1], EQ.y, EQ.sw, EQ.sh)].concat(EQ.ops.map(x => ({ x:x - 10, y:EQ.y - EQ.sh / 2, w:20, h:EQ.sh }))).concat([sq(EQ.res.x, EQ.y, EQ.res.w, EQ.sh)]);
        row.forEach((o, k) => inside(o, 'verify: number sentence part ' + k, W, D.VER_H)); noHits(row, 'verify: number sentence parts');
        if (EQ.x[1] - EQ.x[0] < EQ.sw + 2 * 4 + 6) fail('verify: the two boxes — their drop pads touch');
        if (!(EQ.ops[0] > EQ.x[0] && EQ.ops[0] < EQ.x[1] && EQ.ops[1] > EQ.x[1] && EQ.ops[1] < EQ.res.x)) fail('verify: the ＋ and ＝ signs are not between the boxes');
        if (D.VER_CARD.w > EQ.sw - 2) fail('verify: a card does not fit inside a box');
        if (D.VER_CLAIM.y + D.VER_CLAIM.h > EQ.y - EQ.sh / 2 - 4 - 4) fail('verify: Max\'s claim reaches the boxes');
        const tray = [0, 1, 2].map(k => sq((W - 2 * D.VER_TRAY.step) / 2 + k * D.VER_TRAY.step, D.VER_TRAY.y, D.VER_CARD.w, D.VER_CARD.h));
        tray.forEach((o, k) => inside(o, 'verify: card ' + k, W, D.VER_H)); noHits(tray, 'verify: cards');
        if (D.VER_TRAY.y - D.VER_CARD.h / 2 < EQ.y + EQ.sh / 2 + 4 + 4) fail('verify: the card tray reaches the boxes');
        need('verify', /var e = pick\(GAME_VER\), s = e\.c \+ e\.b, t = e\.a - e\.b/, 'the check is not c + b, or the right answer is not a − b');
        need('verify', /var sl = nearestOpen\(slots, pt, 4\);\s*if \(!sl\) return false;\s*var v = P\.data\.v;\s*if \(v === e\.a\)\{ roundMiss\(d\.gVerMinuend\(e\.a\)\); return false; \}/, 'the starting number is accepted into the addition');
        need('verify', /renderTray\(B, \[e\.a, e\.b, e\.c\], VER_TRAY\.y,/, 'the cards are not a, b and c');
        need('verify', /var tx = inp\.value\.trim\(\);\s*\/\*[^*]*\*\/\s*if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(tx\)\)\{ gMsg\.textContent = d\.gVerEmpty; return; \}/, 'an empty or malformed answer ("4 56", "0456") is counted as a mistake or read as a number');
        need('verify', /if \(v === s\)\{/, 'the typed sum is not compared with c + b');
        need('verify', /else if \(v === e\.a\) roundMiss\(d\.gVerCopied\(e\.a, e\.c, e\.b\)\);\s*else roundMiss\(d\.gVerWrongSum\(e\.c, e\.b, v\)\);/, 'a wrong sum is accepted, or copying the starting number has no reason of its own');
        need('verify', /var right = \(s === e\.a\);\s*if \(saysRight !== right\)\{ roundMiss\(right \? d\.gVerSaidNo\(s, e\.a\) : d\.gVerSaidYes\(s, e\.a\)\); return; \}/, 'a wrong verdict is accepted');
        need('verify', /if \(gSolved \|\| stage !== 'verdict'\) return;/, 'a verdict can be given before the sum');
        need('verify', /if \(gSolved \|\| stage !== 'sum'\) return;/, 'the sum can be typed before the addition is built');
        need('verify', /cards\.forEach\(function\(c\)\{ if \(!c\.locked\) c\.lock\(c\.homeX, c\.homeY\); \}\);/, 'the leftover card is not locked at home once both boxes are filled');
        need('verify', /var z = addZone\(B, EQ\.x\[k\] - EQ\.sw \/ 2, EQ\.y - EQ\.sh \/ 2, EQ\.sw, EQ\.sh, 'gslot'\);/, 'cannot read where the boxes are drawn');
      }

      /* 遊戲訊息的覆蓋率：每一句都驗過算式；釘一個下限，正規化壞掉時不會靜靜變成零 */
      if (gameVerified !== GAME_VERIFIED_N) fail('the game messages verified ' + gameVerified + ' equations, expected ' + GAME_VERIFIED_N + ' — a message lost (or gained) an equation, or the scan stopped reading them');

      /* ----- helpers（function 宣告會被提升，上面就能用） ----- */
      var gameVerified;
      function gseq(where, text, want, wrongOnPurpose, numbersOnly){
        if (gameVerified === undefined) gameVerified = 0;
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        if (numbersOnly) return;
        const r = arithGame(text);
        gameVerified += r.verified;
        if (wrongOnPurpose){ if (!r.problems.some(p => /arithmetic is wrong/.test(p))) fail(where + ': this is meant to be a wrong claim, but it adds up: ' + text); }
        else r.problems.forEach(p => fail(where + ': ' + p + ' — ' + text));
      }
    }
  }
};
/* 靜態字串的算術覆蓋率（第一次跑完填入；字串改了要重新確認再改這三個數） */
const VERIFIED_N = 86, QUESTIONS_N = 12, VERIFIED_SHA = '8833e3661b48', GAME_VERIFIED_N = 316;
module.exports._test = { myAddCols, mySubCols, myShort, bigMinusSmall, forgotToReduce, sideBySide };
