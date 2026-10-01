/* grade-3/math/fraction 的檢查設定（分數蛋糕店：平分才有分數、分母分子、同分母比大小、單位分數比大小、同分母加減）。
   2026-10-01 新增 —— 和小遊戲「蛋糕出貨」改成五關五種玩法（§六之五）同一次寫成。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算），
   renderCheck 拿渲染出來的那一題再驗：每一個選項的值、誘答不可以是題幹上印出來的分數（抄題）、
   比 1 大的分數只放行「分子分母寫顛倒」那一個刻意的迷思、解釋裡的算式逐條重算。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的整數算式逐條重算（分數那一側由 / 擋掉，不會被當成整數）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的算法重算答案，並且**照遊戲的規則把每一題從頭玩一次**（切蛋糕的每一種切法順序），
     證明每一題都解得完、而且解完一定是對的；頁面的純函式（cutTickXY／cutOk／fracVal／joinResult／joinPlace）
     一律拿整個題庫或整片格點去呼叫，再和自己的算法比（joinPlace 另外用不抄公式的性質驗）；nearestOpen() 與 roundMiss()
     從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一種放錯、每一張錯的卡、每一個打錯的答案），而且說明裡的理由要真的成立
     （「比較小」就真的比較小、「要排在更左邊」就真的排在左邊）。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸、畫出來的蛋糕塊數由 HDIR 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function gcd(a, b){ return b ? gcd(b, a % b) : a; }
/* 分數字串 → [分子, 分母]；不是分數回 null */
function frac(s){ const m = String(s).match(/^(\d+)\/(\d+)$/); return m ? [+m[1], +m[2]] : null; }
const same = (p, q) => p[0] * q[1] === q[0] * p[1];

/* 算式掃描：把一段文字裡所有整數的「數 op 數 … ＝ 結果」找出來重算；分數（數字旁邊有 /）不算整數 */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+(?![\d.\/]))+) ?= ?(\d+)(?![\d.\/])/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1], got = +m[2];
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0){
      if (toks.length !== 3) bad = 'a division chained with other operations';
      else if (+toks[0] % +toks[2] !== 0 || +toks[0] / +toks[2] !== got) bad = 'should be ' + (+toks[0] / +toks[2]);
    } else {
      const terms = [];
      let cur = +toks[0], sign = 1;
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], v = +toks[i + 1];
        if (op === '×') cur *= v;
        else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
      }
      terms.push(sign * cur);
      const want = terms.reduce((x, y) => x + y, 0);
      if (want !== got) bad = 'should be ' + want;
    }
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}

const WHOLE = { zh: n => n + '/' + n + '，也就是 1（整個蛋糕）', en: n => n + '/' + n + ', which equals 1 (the whole cake)' };
const UNEQ_RIGHT = { zh:'不可以，因為每一塊大小不一樣', en:'No, the pieces are not the same size' };
const FRACTION_GENS = ['idFrac', 'compareSameDen', 'addSameDen', 'subSameDen', 'unitInversion', 'shareWord'];

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['cut', 'name', 'take', 'sort', 'join'];", replace:"var GAME_ORDER = ['cut', 'take', 'name', 'sort', 'join'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },

    /* 切蛋糕 */
    { file:'index', expect:'does not divide the 12 marks', find:'var GAME_CUT = [ { n:3 }, { n:4 }, { n:6 } ];', replace:'var GAME_CUT = [ { n:3 }, { n:5 }, { n:6 } ];' },
    { file:'index', expect:'people — should be 3~6', find:'var GAME_CUT = [ { n:3 }, { n:4 }, { n:6 } ];', replace:'var GAME_CUT = [ { n:3 }, { n:4 }, { n:12 } ];' },
    { file:'index', expect:'cutOk(', find:'function cutOk(n, t){ return t % (CUT_TICKS / n) === 0; }', replace:'function cutOk(n, t){ return t % 2 === 0; }' },
    { file:'index', expect:'cutTickXY(', find:'return { x:CUT_PIE.cx + CUT_RING * Math.sin(a), y:CUT_PIE.cy - CUT_RING * Math.cos(a) }; }', replace:'return { x:CUT_PIE.cx + CUT_RING * Math.cos(a), y:CUT_PIE.cy - CUT_RING * Math.sin(a) }; }' },
    { file:'index', expect:'marks on the edge touch', find:'CUT_RING = 126, CUT_TICK = 46,', replace:'CUT_RING = 100, CUT_TICK = 46,' },
    { file:'index', expect:'outside the 300', find:'CUT_RING = 126, CUT_TICK = 46,', replace:'CUT_RING = 132, CUT_TICK = 46,' },
    { file:'index', expect:'the knife at home reaches a mark', find:'CUT_KNIFE = { x:150, y:336, size:52 }', replace:'CUT_KNIFE = { x:150, y:316, size:52 }' },
    { file:'index', expect:'a cut that makes unequal pieces is accepted', find:'        if (!cutOk(e.n, tk.t)){ roundMiss(d.gCutUneven(e.n, step)); return false; }\n', replace:'' },
    { file:'index', expect:'the first cut is not drawn at the top', find:'      drawCut(0);   /* 第一刀已經切好：正上方 */', replace:'      drawCut(1);   /* 第一刀已經切好：正上方 */' },
    { file:'index', expect:'the round is not solved exactly when n cuts', find:'        if (cuts === e.n){', replace:'        if (cuts === e.n - 1){' },
    { file:'index', expect:'gCutUneven zh', find:"' 人，每一塊都要 12 ÷ ' + n + ' ＝ ' + s + ' 格。'; }", replace:"' 人，每一塊都要 12 ÷ ' + n + ' ＝ ' + (s + 1) + ' 格。'; }" },
    { file:'index', expect:'gCutDone en', find:"return 'Cut into ' + n + ' pieces that are all the same size: each piece is 1/' + n + ' of the cake!'; }", replace:"return 'Cut into ' + n + ' pieces that are all the same size: each piece is 1/' + (n + 1) + ' of the cake!'; }" },
    { file:'index', expect:'gCut2 zh', find:"return '12 ÷ ' + n + ' ＝ ' + s + '：從最上面那一刀開始，每數 ' + s + ' 格切一刀。'; }", replace:"return '12 ÷ ' + n + ' ＝ ' + s + '：從最上面那一刀開始，每數 ' + n + ' 格切一刀。'; }" },

    /* 寫分數 */
    { file:'index', expect:'the trap card n − m equals m', find:'var GAME_NAME = [ { n:5, m:2 },', replace:'var GAME_NAME = [ { n:4, m:2 },' },
    { file:'index', expect:'should be 1~', find:'{ n:7, m:4 }, { n:4, m:3 }, { n:6, m:5 } ];', replace:'{ n:7, m:4 }, { n:4, m:3 }, { n:6, m:6 } ];' },
    { file:'index', expect:'pieces — should be 3~8', find:'{ n:6, m:1 }, { n:8, m:3 },', replace:'{ n:6, m:1 }, { n:10, m:3 },' },
    { file:'index', expect:'the cards are not m, n and n − m', find:'renderTray(B, [e.m, e.n, u], NAME_TRAY.y,', replace:'renderTray(B, [e.m, e.n, e.n + e.m], NAME_TRAY.y,' },
    { file:'index', expect:'is accepted on top', find:"        if (s.kind === 'num' && v !== e.m){", replace:"        if (s.kind === 'num' && v === u){" },
    { file:'index', expect:'is accepted at the bottom', find:"        if (s.kind === 'den' && v !== e.n){", replace:"        if (s.kind === 'den' && v === e.m){" },
    { file:'index', expect:'the wrong reason for a card on top', find:'roundMiss(v === e.n ? d.gNameNumDen(e.n, e.m) : d.gNameNumUn(u, e.m))', replace:'roundMiss(v === u ? d.gNameNumDen(e.n, e.m) : d.gNameNumUn(u, e.m))' },
    { file:'index', expect:'the boxes overlap', find:'NAME_FR = { x:212, num:70, den:166, slot:52, line:118 }', replace:'NAME_FR = { x:212, num:70, den:116, slot:52, line:118 }' },
    { file:'index', expect:'the card tray reaches the bottom box', find:'NAME_TRAY = { y:252, step:76 }', replace:'NAME_TRAY = { y:220, step:76 }' },
    { file:'index', expect:'the pie overlaps the boxes', find:'NAME_PIE = { cx:78, cy:118, r:64 }', replace:'NAME_PIE = { cx:118, cy:118, r:64 }' },
    { file:'index', expect:'gNameDenUn zh', find:"分母要數全部：' + m + ' ＋ ' + u + ' ＝ ' + n + ' 塊。'; }", replace:"分母要數全部：' + m + ' ＋ ' + u + ' ＝ ' + (n + 1) + ' 塊。'; }" },
    { file:'index', expect:'gNameDone en', find:"': cut into ' + n + ' pieces (denominator), ' + m + ' shaded (numerator).'; }", replace:"': cut into ' + m + ' pieces (denominator), ' + n + ' shaded (numerator).'; }" },

    /* 照訂單 */
    { file:'index', expect:'no order is a whole cake', find:'{ n:8, m:5 }, { n:6, m:6 }, { n:4, m:3 },', replace:'{ n:8, m:5 }, { n:6, m:4 }, { n:4, m:3 },' },
    { file:'index', expect:'more than the cake has', find:'var GAME_TAKE = [ { n:5, m:3 },', replace:'var GAME_TAKE = [ { n:5, m:6 },' },
    { file:'index', expect:'too thin to tap', find:'{ n:7, m:2 }, { n:6, m:1 } ];\n\n  /* 第 4 關', replace:'{ n:7, m:2 }, { n:16, m:1 } ];\n\n  /* 第 4 關' },
    { file:'index', expect:'with too few or too many', find:'        if (x < e.m){ roundMiss(d.gTakeFew(x, e.m, e.n)); return; }\n', replace:'' },
    { file:'index', expect:'with too few or too many', find:'        if (x > e.m){ roundMiss(d.gTakeMany(x, e.m, e.n)); return; }\n', replace:'' },
    { file:'index', expect:'the cake is outside', find:'TAKE_PIE = { cx:150, cy:130, r:118 }', replace:'TAKE_PIE = { cx:150, cy:130, r:140 }' },
    { file:'index', expect:'gTakeFew zh', find:"' 塊 —— 還差 ' + (m - x) + ' 塊。'; }", replace:"' 塊 —— 還差 ' + (m - x + 1) + ' 塊。'; }" },
    { file:'index', expect:'gTakeDone en', find:"if (m === n) return n + '/' + n + ' is 1 whole cake: all ' + n + ' pieces sent!';", replace:"if (m === n) return n + '/' + n + ' is 2 whole cakes: all ' + n + ' pieces sent!';" },

    /* 排排站 */
    { file:'index', expect:'are not all different', find:'{ fr:[[2, 8], [5, 8], [7, 8]] },', replace:'{ fr:[[2, 8], [5, 8], [1, 4]] },' },
    { file:'index', expect:'neither the same denominator nor all unit', find:'{ fr:[[1, 3], [1, 4], [1, 8]] },', replace:'{ fr:[[1, 3], [2, 4], [1, 8]] },' },
    { file:'index', expect:'differ by less than', find:'{ fr:[[1, 2], [1, 3], [1, 6]] } ];', replace:'{ fr:[[1, 4], [1, 6], [1, 8]] } ];' },
    { file:'index', expect:'no unit-fraction set', find:'var GAME_SORT = [ { fr:[[1, 6], [4, 6], [5, 6]] }, { fr:[[1, 2], [1, 4], [1, 8]] }, { fr:[[2, 8], [5, 8], [7, 8]] },\n                    { fr:[[1, 3], [1, 4], [1, 8]] }, { fr:[[1, 5], [2, 5], [4, 5]] }, { fr:[[1, 2], [1, 3], [1, 6]] } ];', replace:'var GAME_SORT = [ { fr:[[1, 6], [4, 6], [5, 6]] }, { fr:[[2, 8], [5, 8], [7, 8]] }, { fr:[[1, 5], [2, 5], [4, 5]] } ];' },
    { file:'index', expect:'fracVal(', find:'function fracVal(f){ return f[0] / f[1]; }', replace:'function fracVal(f){ return f[0] - f[1]; }' },
    { file:'index', expect:'a card is accepted in the wrong place', find:'        if (f !== want){ roundMiss(d.gSortWrong(f[0], f[1], want[0], want[1])); return false; }\n', replace:'' },
    { file:'index', expect:'the order is not smallest to biggest', find:'var order = e.fr.slice().sort(function(p, q){ return fracVal(p) - fracVal(q); });', replace:'var order = e.fr.slice().sort(function(p, q){ return fracVal(q) - fracVal(p); });' },
    { file:'index', expect:'slots 0 and 1', find:'SORT_SLOT = { y:110, w:88, h:84, xs:[52, 150, 248] }', replace:'SORT_SLOT = { y:110, w:88, h:84, xs:[60, 150, 248] }' },
    { file:'index', expect:'a card does not fit its box', find:'SORT_CARD = { w:80, h:76, bar:64, barH:14 }', replace:'SORT_CARD = { w:92, h:76, bar:64, barH:14 }' },
    { file:'index', expect:'belongs further', find:"var less = a * d < c * b, s = (less ? '小' : '大'), side = (less ? '左邊' : '右邊');", replace:"var less = a * d < c * b, s = (less ? '小' : '大'), side = (less ? '右邊' : '左邊');" },
    { file:'index', expect:'belongs further', find:"var less = a * d < c * b, s = (less ? 'smaller' : 'bigger'),", replace:"var less = a < c, s = (less ? 'smaller' : 'bigger')," },
    { file:'index', expect:'gSortDone', find:"return t + '：' + (same ? '分母一樣，分子越大就越大！' : '分子都是 1，分母越大，每一塊反而越小！'); }", replace:"return t + '：' + (same ? '分子都是 1，分母越大，每一塊反而越小！' : '分母一樣，分子越大就越大！'); }" },

    /* 合起來 */
    { file:'index', expect:'should have both addition and subtraction', find:"                    { op:'-', n:6, a:5, b:2 }, { op:'-', n:8, a:7, b:3 }, { op:'-', n:5, a:4, b:1 } ];", replace:"                    { op:'+', n:6, a:3, b:2 }, { op:'+', n:8, a:2, b:3 }, { op:'+', n:5, a:2, b:1 } ];" },
    { file:'index', expect:'no addition makes a whole', find:"{ op:'+', n:4, a:1, b:3 },", replace:"{ op:'+', n:4, a:1, b:2 }," },
    { file:'index', expect:'more than the bar holds', find:"{ op:'+', n:8, a:3, b:4 },", replace:"{ op:'+', n:8, a:5, b:4 }," },
    { file:'index', expect:'takes away more than', find:"{ op:'-', n:8, a:7, b:3 },", replace:"{ op:'-', n:8, a:3, b:3 }," },
    { file:'index', expect:'joinResult(', find:"function joinResult(e){ return e.op === '+' ? e.a + e.b : e.a - e.b; }", replace:"function joinResult(e){ return e.a + e.b; }" },
    { file:'index', expect:'by more than half a piece', find:"    for (i = start; i < start + e.b; i++) if (i < lo || i >= hi) return { bad:i < e.a ? 'blue' : 'empty' };\n", replace:"    var mid = Math.floor((pt.x - B.x) / sw); if (mid < lo || mid >= hi) return { bad:mid < e.a ? 'blue' : 'empty' };\n" },
    { file:'index', expect:'joinPlace() disagrees', find:'Math.abs(pt.y - (B.y + B.h / 2)) > B.h / 2 + JOIN_PAD) return null;', replace:'Math.abs(pt.y - (B.y + B.h / 2)) > B.h + JOIN_PAD) return null;' },
    { file:'index', expect:'forbidden (or off-bar) cells', find:'      return { start:Math.min(c, hi - e.b) };', replace:'      return { start:c };' },
    { file:'index', expect:'hanging off the bar is not a silent bounce', find:'    if (start < 0 || start + e.b > e.n) return null;\n    for (i = start; i < start + e.b; i++) if (i < lo || i >= hi)', replace:'    for (i = start; i < start + e.b; i++) if (i >= 0 && i < e.n && (i < lo || i >= hi))' },
    { file:'index', expect:'a tap on an allowed piece is not accepted', find:"      if (c < lo || c >= hi) return { bad:c < e.a ? 'blue' : 'empty' };", replace:"      if (c <= lo || c >= hi) return { bad:c < e.a ? 'blue' : 'empty' };" },
    { file:'index', expect:'the strip at home is on the bar', find:'JOIN_STRIP = { y:156, h:48 }', replace:'JOIN_STRIP = { y:104, h:48 }' },
    { file:'index', expect:'piling onto the blue cake / eating', find:"        if (at.bad === 'blue'){ roundMiss(d.gJoinOnTop); return false; }\n", replace:'' },
    { file:'index', expect:'piling onto the blue cake / eating', find:"        if (at.bad === 'empty'){ roundMiss(d.gJoinEatEmpty); return false; }\n", replace:'' },
    { file:'index', expect:'the pieces the strip covers', find:"kinds[c] = e.op === '+' ? 'o' : 'x';", replace:"kinds[c] = 'o';" },
    { file:'index', expect:'a wrong answer is accepted', find:'        if (b === e.n && a === r){', replace:'        if (a === r){' },
    { file:'index', expect:'adding the denominators has no reason of its own', find:"        else if (e.op === '+' && b === 2 * e.n) roundMiss(d.gJoinDenAdd(e.n));\n", replace:'' },
    { file:'index', expect:'is counted as a mistake or read as a number', find:"function canon(t){ t = t.trim(); return /^(0|[1-9]\\d*)$/.test(t) ? +t : null; }", replace:"function canon(t){ t = t.replace(/\\s/g, ''); return /^\\d+$/.test(t) ? +t : null; }" },
    { file:'index', expect:'does not fit the', find:'inp.maxLength = 2; inp.disabled = true;', replace:'inp.maxLength = 1; inp.disabled = true;' },
    { file:'index', expect:'gJoinNum zh', find:"'，不是 ' + v + '。'; },\n      gJoin2: function(op, a, b, n){ return '分子：'", replace:"'，不是 ' + (v + 1) + '。'; },\n      gJoin2: function(op, a, b, n){ return '分子：'" },
    { file:'index', expect:'gJoinDone en', find:"' = ' + r + '.';\n        return r === n ? t + ' ' + n + '/' + n + ' is 1 whole cake!' : t;", replace:"' = ' + r + '.';\n        return r === n ? t + ' ' + n + '/' + n + ' is 2 whole cakes!' : t;" },
    { file:'index', expect:'gJoinDen zh', find:"return '數數看長條一共切成幾塊：' + n + ' 塊，所以分母是 ' + n + '，不是 ' + v + '。'; }", replace:"return '數數看長條一共切成幾塊：' + v + ' 塊，所以分母是 ' + n + '，不是 ' + v + '。'; }" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'should be 3', find:"why:'分母不變，只把分子相加：1 + 2 = 3，所以答案是 3/5。", replace:"why:'分母不變，只把分子相加：1 + 2 = 4，所以答案是 3/5。" },
    { file:'index', expect:'should be 2', find:"leaving 7 − 5 = 2 sections", replace:"leaving 7 − 5 = 3 sections" },
    { file:'index', expect:'is printed in the stem', find:"= ？',\n          opts:['3/5','3/10','4/5','1/10'], ans:0,", replace:"= ？',\n          opts:['3/5','3/10','2/5','1/10'], ans:0," },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:"var mix = mixTextOpts(correct, [String(d.quotient - 1), String(d.quotient + 1), String(d.dividend - d.divisor)], [d.dividend, d.divisor]);", replace:"var mix = mixTextOpts(correct, [String(d.quotient - 1), String(d.quotient + 1), String(d.dividend)]);" },
    { file:'review', expect:'is copied straight out of the stem', find:"var mix = mixTextOpts(correct, [String(d.a * (d.b - 1)), String(d.a * (d.b + 1)), String(d.a + d.b)], [d.a, d.b]);", replace:"var mix = mixTextOpts(correct, [String(d.a * (d.b - 1)), String(d.a * (d.b + 1)), String(d.a + d.b)]);" },
    { file:'review', expect:'a fraction printed in the stem', find:"(d.sum + 1) + '/' + d.n, d.sum + '/' + (d.n + 1)], [d.a + '/' + d.n, d.b + '/' + d.n]);", replace:"(d.sum + 1) + '/' + d.n, d.sum + '/' + (d.n + 1), d.a + '/' + d.n]);" },
    { file:'review', expect:'a fraction printed in the stem',
      find:"    (avoid || []).forEach(function(v){ seen[fracKey(v)] = true; });",
      replace:"    ([]).forEach(function(v){ seen[fracKey(v)] = true; });" },
    { file:'review', expect:'bigger than 1', find:"(d.a + d.b <= d.n) ? (d.a + d.b) + '/' + d.n : null,", replace:"(d.a + d.b) + '/' + d.n," },
    { file:'review', expect:'opts[ans] != correct', find:"        var correct = d.diff + '/' + d.n;", replace:"        var correct = d.diff + '/' + (d.n + 1);" },
    { file:'review', expect:'is not a fraction', find:"    while (wrongs.length < 3) wrongs.push(correctText + '·' + wrongs.length); /* 真正最後的保底 */", replace:"    while (wrongs.length < 4) wrongs.push(correctText + '·' + wrongs.length); /* 真正最後的保底 */" }
  ],

  sim: {
    /* randUnequalAngles() 在「工具」那一段之前（純函式、不碰 DOM），unequalCheck 的 make() 會呼叫它 */
    blockStart: '  function randUnequalAngles(n){',
    INVARIANTS: {
      idFrac: d => { if (!(isInt(d.n) && d.n >= 4 && d.n <= 10 && d.m >= 1 && d.m < d.n)) return 'need 1 <= m < n, n 4..10'; },
      compareSameDen: d => {
        if (!(d.a >= 1 && d.a < d.n && d.b >= 1 && d.b < d.n)) return 'numerators must be 1..n-1';
        if (d.a === d.b) return 'the two fractions are equal';
        if (d.bigger !== Math.max(d.a, d.b)) return 'bigger is not the bigger numerator';
      },
      addSameDen: d => {
        if (!(d.a >= 1 && d.b >= 1 && d.a + d.b <= d.n - 1)) return 'need a, b >= 1 and a + b < n (a proper sum)';
        if (d.sum !== d.a + d.b) return 'sum != a + b';
      },
      subSameDen: d => {
        if (!(d.b >= 1 && d.b < d.a && d.a <= d.n - 1)) return 'need 1 <= b < a < n';
        if (d.diff !== d.a - d.b) return 'diff != a - b';
      },
      unitInversion: d => {
        if (d.p === d.q) return 'the two unit fractions are equal';
        if (d.smaller !== Math.min(d.p, d.q)) return 'smaller is not the smaller denominator';
      },
      wholeConcept: d => { if (!(isInt(d.n) && d.n >= 4)) return 'n must be at least 4'; },
      shareWord: d => {
        if (!(d.k >= 1 && d.k < d.n)) return 'need 1 <= k < n';
        if (!(d.ctxIdx >= 0 && d.ctxIdx <= 2)) return 'no such context';
      },
      /* 題幹說「切成大小不一樣的 n 塊」：角度加起來 360，每一塊都和平分的那一塊差 6° 以上，最小的一塊也要畫得出來 */
      unequalCheck: d => {
        if (d.angles.length !== d.n) return 'drew ' + d.angles.length + ' pieces, the stem says ' + d.n;
        const sum = d.angles.reduce((x, y) => x + y, 0);
        if (Math.abs(sum - 360) > 1e-6) return 'angles add up to ' + sum;
        if (d.angles.some(a => Math.abs(a - 360 / d.n) <= 6)) return 'a piece is within 6° of an equal share — the picture does not show "unequal"';
        if (d.angles.some(a => a < 15)) return 'a piece under 15° is too thin to see';
        if (!(d.shadedIdx >= 0 && d.shadedIdx < d.n)) return 'shadedIdx out of range';
      },
      divideShare: d => { if (d.dividend !== d.divisor * d.quotient || d.quotient < 2) return 'dividend != divisor * quotient'; },
      multiplyBasic: d => { if (d.product !== d.a * d.b || d.b < 2) return 'product != a * b'; }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'idFrac': return d.m + '/' + d.n;
        case 'compareSameDen': return Math.max(d.a, d.b) + '/' + d.n;
        case 'addSameDen': return (d.a + d.b) + '/' + d.n;
        case 'subSameDen': return (d.a - d.b) + '/' + d.n;
        case 'unitInversion': return '1/' + Math.min(d.p, d.q);
        case 'wholeConcept': return WHOLE[lang](d.n);
        case 'shareWord': return d.k + '/' + d.n;
        case 'unequalCheck': return UNEQ_RIGHT[lang];
        case 'divideShare': return String(d.dividend / d.divisor);
        case 'multiplyBasic': return String(d.a * d.b);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'divideShare' || genId === 'multiplyBasic'){
        if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a whole number';
        if (+s > 99) return 'option ' + s + ' outside 1~99';
        return;
      }
      if (genId === 'compareSameDen' || genId === 'unitInversion'){
        const txt = lang === 'zh' ? ['一樣大', '沒辦法比較'] : ['They are equal', 'Cannot be compared'];
        if (txt.indexOf(s) < 0 && !/^[1-9]\d*\/[1-9]\d*$/.test(s)) return 'option "' + s + '" is neither a fraction nor the equal/cannot text';
        return;
      }
      if (genId === 'wholeConcept'){
        if (s !== '0' && !/^[1-9]\d*\/[1-9]\d*$/.test(s) && !(lang === 'zh' ? /^\d+\/\d+，也就是 1（整個蛋糕）$/ : /^\d+\/\d+, which equals 1 \(the whole cake\)$/).test(s)) return 'option "' + s + '" is not a fraction, 0 or the whole-cake text';
        return;
      }
      if (genId === 'unequalCheck'){
        const ok = lang === 'zh' ? /^(不可以|可以)，因為/ : /^(No|Yes), /;
        if (!ok.test(s)) return 'option "' + s + '" is not a yes/no reason';
        return;
      }
      const f = frac(s);
      if (!f || f[1] < 1 || f[0] < 0) return 'option "' + s + '" is not a fraction';
      if (f[1] > 20) return 'option ' + s + ': denominator over 20';
    },
    /* 拿渲染出來的那一題再驗：每一個選項的值、抄題、比 1 大的分數、解釋的算式 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      for (const e of scanEquations(q.why)) if (e.bad) return 'why: "' + e.text + '" ' + e.bad;
      if (FRACTION_GENS.indexOf(genId) < 0) return;
      const right = frac(q.opts[q.ans]);
      const stemFr = (stem.match(/\d+\/\d+/g) || []).map(frac);
      for (let i = 0; i < q.opts.length; i++){
        const f = frac(q.opts[i]);
        if (!f || i === q.ans) continue;
        if (same(f, right)) return 'distractor ' + q.opts[i] + ' has the same value as the answer';
        /* 抄題：題幹上印出來的分數當誘答。只有「哪一個比較大？」本來就是在兩個題幹分數裡選一個 */
        if ((genId === 'addSameDen' || genId === 'subSameDen') && stemFr.some(g => same(f, g))) return 'distractor ' + q.opts[i] + ' is a fraction printed in the stem';
        /* 三年級只學真分數（以及 n/n ＝ 1）：比 1 大的只放行「分子分母寫顛倒」那一個刻意的迷思 */
        if (f[0] > f[1]){
          const inv = genId === 'idFrac' ? d.n + '/' + d.m : genId === 'shareWord' ? d.n + '/' + d.k : null;
          if (q.opts[i] !== inv) return 'distractor ' + q.opts[i] + ' is bigger than 1 (improper fractions are grade 4)';
        }
      }
      if (genId === 'compareSameDen' || genId === 'unitInversion'){
        const fs = q.opts.map(frac).filter(Boolean);
        if (fs.length !== 2 || !fs.every(f => stemFr.some(g => g[0] === f[0] && g[1] === f[1]))) return 'the two fraction options are not the two fractions in the stem';
      }
    },
    /* 刻意的迷思誘答（題幹上的整數）：沒有。divideShare／multiplyBasic 的 avoid 已經把題幹數字擋掉。 */
    stemEchoOk: {}
  },

  data: {
    dataStart: '  /* ============ 小遊戲「蛋糕出貨」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, CUT_H, CUT_PIE, CUT_TICKS, CUT_RING, CUT_TICK, CUT_KNIFE, GAME_CUT, cutTickXY, cutOk, NAME_H, NAME_PIE, NAME_FR, NAME_CARD, NAME_TRAY, GAME_NAME, TAKE_H, TAKE_PIE, GAME_TAKE, SORT_H, SORT_LBL, SORT_SLOT, SORT_CARD, SORT_TRAY, SORT_GAP, GAME_SORT, fracVal, JOIN_H, JOIN_BAR, JOIN_STRIP, JOIN_PAD, GAME_JOIN, joinResult, joinPlace}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
      [['1 + 2 = 3', true], ['1 + 2 = 4', false], ['7 − 5 = 2', true], ['7 － 5 = 3', false], ['12 ÷ 4 ＝ 3', true], ['12 ÷ 5 ＝ 2', false],
       ['3 ＋ 2 ＝ 5', true], ['分子 2 ＋ 1 ＝ 4', false]].forEach(([t, good]) => {
        const r = scanEquations(t);
        if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
      });
      ['1/5 + 2/5 = 3/5', '3/8 ＋ 1/8 ＝ 4/8'].forEach(t => { if (scanEquations(t).length) fail('scanEquations() self-test: the fraction sum "' + t + '" was read as whole numbers'); });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 6) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 題庫裡「a/n + b/n = ?」：標的正解要是 (a+b)/n；誘答不可以是題幹上印出來的分數（抄題） */
      let sumStems = 0;
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const st = String(q.stem).replace(/<[^>]+>/g, '');
        const m = st.match(/^(\d+)\/(\d+) \+ (\d+)\/(\d+) = [？?]$/);
        if (!m) return;
        sumStems++;
        if (m[2] !== m[4]) return fail(bank + '[' + i + '] ' + L + ': not a same-denominator sum');
        const want = (+m[1] + +m[3]) + '/' + m[2];
        if (q.opts[q.ans] !== want) fail(bank + '[' + i + '] ' + L + ': marked answer is ' + q.opts[q.ans] + ', should be ' + want);
        q.opts.forEach((o, k) => { if (k !== q.ans && (o === m[1] + '/' + m[2] || o === m[3] + '/' + m[4])) fail(bank + '[' + i + '] ' + L + ': distractor ' + o + ' is printed in the stem'); });
      })));
      if (sumStems < 2) fail('no "a/n + b/n = ?" quiz stem found in both languages — the sum check is not reading them');

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['cut', 'name', 'take', 'sort', 'join'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the five examples), got ' + types.join());
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
      /* 每一句說明：數字照順序逐個比，而且句子裡的每一條整數算式都要算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const grow = (o, p) => ({ x:o.x - p, y:o.y - p, w:o.w + 2 * p, h:o.h + 2 * p });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_CUT', 'GAME_NAME', 'GAME_TAKE', 'GAME_SORT', 'GAME_JOIN'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the knife (' + D.CUT_KNIFE.size + ')', D.CUT_KNIFE.size);
      tooSmall('a mark you tap on the cake (' + D.CUT_TICK + ')', D.CUT_TICK);
      tooSmall('a number card (' + D.NAME_CARD + ')', D.NAME_CARD);
      tooSmall('a fraction box with its pad', D.NAME_FR.slot + 2 * 4);
      tooSmall('a fraction card (' + D.SORT_CARD.w + '×' + D.SORT_CARD.h + ')', Math.min(D.SORT_CARD.w, D.SORT_CARD.h));
      tooSmall('the strip (' + D.JOIN_STRIP.h + ' tall)', D.JOIN_STRIP.h);
      [D.CUT_KNIFE.size, D.NAME_CARD, D.SORT_CARD.w, D.SORT_CARD.h, D.JOIN_STRIP.h].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('join', /var strip = addPiece\(B, \{ w:Math\.max\(GPICK, e\.b \* sw\), h:JOIN_STRIP\.h, cx:150, cy:JOIN_STRIP\.y,/, 'the strip is not at least GPICK wide at JOIN_STRIP');
      need('name', /addPiece\(B, \{ w:NAME_CARD, h:NAME_CARD, cx:cx, cy:cy,/, 'the number cards are not NAME_CARD × NAME_CARD');
      need('sort', /addPiece\(B, \{ w:C\.w, h:C\.h, cx:cx, cy:cy,/, 'the fraction cards are not SORT_CARD');
      need('cut', /addPiece\(B, \{ w:CUT_KNIFE\.size, h:CUT_KNIFE\.size, cx:CUT_KNIFE\.x, cy:CUT_KNIFE\.y,/, 'the knife is not drawn at CUT_KNIFE');

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
        seq('gPts ' + L, I18N[L].gPts(20), [20]);
        seq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 ---
         ① 點在格子裡的，一定判給那一格 ② 最近的那格已經放好了，就不收（不可以跳過它、改放進旁邊的空格）
         ③ 離每一格都遠 → 不收 ④ 大小不一樣的兩塊：大塊裡、靠近小塊邊上的點判給大塊 */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const h = D.CUT_TICK / 2, list = [];
          for (let t = 0; t < D.CUT_TICKS; t++){ const p = D.cutTickXY(t); list.push({ id:t, cx:p.x, cy:p.y, hw:h, hh:h, done:false }); }
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, 6); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a mark on the cake are given to another mark (or none)');
          const S = D.SORT_SLOT, sl = S.xs.map((x, i) => ({ id:i, cx:x, cy:S.y, hw:S.w / 2, hh:S.h / 2, done:false }));
          let bad2 = 0;
          sl.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 4){ const g = nearestOpen(sl, { x, y }, 4); if (!g || g.id !== b.id) bad2++; } });
          if (bad2) fail('nearestOpen(): ' + bad2 + ' points inside a sort box are given to another box (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：切蛋糕（範例 1、2：平分才有分數） --- */
      {
        const C = D.CUT_PIE, T = D.CUT_TICKS, K = D.CUT_KNIFE, h = D.CUT_TICK / 2;
        if (T !== 12) fail('CUT_TICKS is ' + T + ' — every sentence says "12 marks"');
        LANGS.forEach(L => { if (nums(I18N[L].gHints.cut).indexOf(12) < 0) fail('gHints.cut ' + L + ' does not say there are 12 marks'); });
        const marks = [];
        for (let t = 0; t < T; t++){
          const a = t * 2 * Math.PI / T, m = { x:C.cx + D.CUT_RING * Math.sin(a), y:C.cy - D.CUT_RING * Math.cos(a) }, p = D.cutTickXY(t);
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('cutTickXY(' + t + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m) + ' (0 at the top, clockwise)');
          marks.push(sq(m.x, m.y, D.CUT_TICK));
        }
        marks.forEach((o, t) => inside(o, 'cut: mark ' + t, W, D.CUT_H));
        /* 相鄰刻度的 pad 會重疊（斜對角的方框）—— 由 nearestOpen() 挑最近的，上面已經整片格點驗過；方框本身不可以疊在一起 */
        noHits(marks, 'cut: marks on the edge touch —');
        if (D.CUT_RING - 6 < C.r + 9 + 2) fail('cut: the dot of a mark touches the edge of the cake');
        inside(sq(C.cx, C.cy, 2 * C.r), 'cut: the cake', W, D.CUT_H);
        const knife = sq(K.x, K.y, K.size);
        inside(knife, 'cut: the knife', W, D.CUT_H);
        if (marks.some(o => hit(grow(o, 6), knife))) fail('cut: the knife at home reaches a mark (with its drop pad)');
        const seenN = new Set();
        D.GAME_CUT.forEach((e, i) => {
          const w = 'GAME_CUT[' + i + ']';
          if (!isInt(e.n)) return fail(w + ' is not a whole number');
          if (e.n < 3 || e.n > 6) fail(w + ': ' + e.n + ' people — should be 3~6');
          if (T % e.n !== 0) return fail(w + ': ' + e.n + ' does not divide the 12 marks — there is no way to cut it equally on the marks');
          seenN.add(e.n);
          const s = T / e.n;
          for (let t = 0; t < T; t++) if (D.cutOk(e.n, t) !== (t % s === 0)) fail(w + ': cutOk(' + e.n + ', ' + t + ') is ' + D.cutOk(e.n, t) + ' — a cut belongs at every ' + s + ' marks');
          /* 照遊戲的規則（只收 cutOk 的刻度、切過的靜靜彈回）把每一種切的順序都走一遍：每一個狀態都有刀可切、切完一定一樣大 */
          const seen = new Set(), stack = [[0]];
          let ends = 0;
          while (stack.length){
            const c = stack.pop().slice().sort((x, y) => x - y), key = c.join(); if (seen.has(key)) continue; seen.add(key);
            if (c.length === e.n){
              ends++;
              const gaps = c.map((m, k) => (k + 1 < c.length ? c[k + 1] : c[0] + T) - m);
              if (!gaps.every(g => g === s)) fail(w + ': the cutting rule can end with unequal pieces: ' + key);
              continue;
            }
            const moves = []; for (let t = 0; t < T; t++) if (c.indexOf(t) < 0 && D.cutOk(e.n, t)) moves.push(t);
            if (!moves.length) fail(w + ': stuck at ' + key);
            moves.forEach(t => stack.push(c.concat([t])));
          }
          if (!ends) fail(w + ': the cutting never finishes');
          /* 「切在這裡會不一樣大」要真的成立：任何一個不收的刻度 t，和最上面那一刀之間的格數不是 s 的倍數 */
          for (let t = 1; t < T; t++) if (!D.cutOk(e.n, t) && t % s === 0) fail(w + ': mark ' + t + ' is refused although it is on an equal cut');
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let c = 1; c <= e.n; c++) seq(w + ' gCutNow ' + L, d.gCutNow(e.n, c), [e.n, c, e.n]);
            seq(w + ' gCutUneven ' + L, d.gCutUneven(e.n, s), [e.n, 12, e.n, s]);
            seq(w + ' gCut2 ' + L, d.gCut2(e.n, s), [12, e.n, s, s]);
            seq(w + ' gCutDone ' + L, d.gCutDone(e.n), [e.n, 1, e.n]);
          });
        });
        if (seenN.size < 2) fail('GAME_CUT: only one way of sharing — the child would learn one fixed pattern');
        LANGS.forEach(L => { for (let t = 0; t < T; t++) seq('gCutTick ' + L, I18N[L].gCutTick(t), [t]); });
        need('cut', /var e = pick\(GAME_CUT\), C = CUT_PIE, step = CUT_TICKS \/ e\.n, cuts = 0;/, 'the piece size is not 12 ÷ n marks');
        need('cut', /var tk = nearestOpen\(ticks, pt, 6\);\s*if \(!tk\) return false;\s*if \(!cutOk\(e\.n, tk\.t\)\)\{ roundMiss\(d\.gCutUneven\(e\.n, step\)\); return false; \}\s*drawCut\(tk\.t\);/, 'a cut that makes unequal pieces is accepted (or a drop away from every mark is not silent)');
        need('cut', /drawCut\(0\);/, 'the first cut is not drawn at the top');
        need('cut', /ticks\[t\]\.done = true;/, 'a mark that is already cut can be cut again');
        need('cut', /if \(cuts === e\.n\)\{/, 'the round is not solved exactly when n cuts are made');
        need('cut', /roundSolved\(d\.gCutDone\(e\.n\)\);/, 'the result does not say 1/n');
        need('cut', /p = cutTickXY\(t\), h = CUT_TICK \/ 2;[\s\S]*?var z = addZone\(B, p\.x - h, p\.y - h, CUT_TICK, CUT_TICK, 'gtick'\);/, 'the marks are not drawn at cutTickXY()');
      }

      /* --- 第 2 關：寫分數（範例 3） --- */
      {
        const F = D.NAME_FR, NP = D.NAME_PIE, TR = D.NAME_TRAY, CD = D.NAME_CARD, h = F.slot / 2;
        let anyUnit = false;
        D.GAME_NAME.forEach((e, i) => {
          const w = 'GAME_NAME[' + i + ']';
          if (!isInt(e.n) || !isInt(e.m)) return fail(w + ' is not whole numbers');
          if (e.n < 3 || e.n > 8) fail(w + ': ' + e.n + ' pieces — should be 3~8 (countable in the picture)');
          if (!(e.m >= 1 && e.m < e.n)) fail(w + ': ' + e.m + ' shaded — should be 1~' + (e.n - 1));
          const u = e.n - e.m;
          if (u === e.m) fail(w + ': the trap card n − m equals m — two cards would read the same');
          if (new Set([e.m, e.n, u]).size !== 3) fail(w + ': the three cards are not all different');
          if (e.m === 1) anyUnit = true;
          /* 收卡的規則（上面只收 m、下面只收 n）由下面的 need() 守住原始碼那兩行；這裡驗的是每一張錯卡的那一句 */
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gNameNow ' + L, d.gNameNow(null, null), []);
            seq(w + ' gNameNow(m) ' + L, d.gNameNow(e.m, null), [e.m]);
            seq(w + ' gNameNow(n) ' + L, d.gNameNow(null, e.n), [e.n]);
            seq(w + ' gNameNow(m, n) ' + L, d.gNameNow(e.m, e.n), [e.m, e.n]);
            seq(w + ' gNameNumDen ' + L, d.gNameNumDen(e.n, e.m), [e.n, e.m]);
            seq(w + ' gNameNumUn ' + L, d.gNameNumUn(u, e.m), [u, e.m]);
            seq(w + ' gNameDenNum ' + L, d.gNameDenNum(e.m, e.n), [e.m, e.n]);
            seq(w + ' gNameDenUn ' + L, d.gNameDenUn(u, e.m, e.n), [u, e.m, u, e.n]);
            seq(w + ' gName2 ' + L, d.gName2(e.n, e.m), [e.n, e.m]);
            seq(w + ' gNameDone ' + L, d.gNameDone(e.m, e.n), [e.m, e.n, e.n, e.m]);
          });
        });
        if (!anyUnit) fail('GAME_NAME: no unit fraction (m = 1)');
        const pie = sq(NP.cx, NP.cy, 2 * (NP.r + 6)), num = sq(F.x, F.num, F.slot), den = sq(F.x, F.den, F.slot), rule = { x:F.x - 34, y:F.line - 1, w:68, h:3 };
        [pie, num, den, rule].forEach((o, k) => inside(o, 'name: part ' + k, W, D.NAME_H));
        if (hit(grow(num, 4), grow(den, 4))) fail('name: the boxes overlap (with their drop pads)');
        if (hit(pie, grow(num, 4)) || hit(pie, grow(den, 4))) fail('name: the pie overlaps the boxes (with their drop pads)');
        if (!(F.line > F.num + h && F.line < F.den - h)) fail('name: the fraction line is not between the two boxes');
        const tray = [0, 1, 2].map(k => sq((W - 2 * TR.step) / 2 + k * TR.step, TR.y, CD));
        tray.forEach((o, k) => inside(o, 'name: card ' + k, W, D.NAME_H)); noHits(tray, 'name: cards');
        if (tray.some(o => hit(o, grow(den, 4 + 4)) || hit(o, pie))) fail('name: the card tray reaches the bottom box or the pie');
        need('name', /var e = pick\(GAME_NAME\), u = e\.n - e\.m,/, 'the trap card is not n − m');
        need('name', /renderTray\(B, \[e\.m, e\.n, u\], NAME_TRAY\.y,/, 'the cards are not m, n and n − m');
        need('name', /var slots = \[\['num', F\.num\], \['den', F\.den\]\]\.map/, 'the top box is not the numerator');
        need('name', /if \(s\.kind === 'num' && v !== e\.m\)\{ roundMiss\(v === e\.n \? d\.gNameNumDen\(e\.n, e\.m\) : d\.gNameNumUn\(u, e\.m\)\); return false; \}/, 'the denominator (or the unshaded count) is accepted on top, or the wrong reason for a card on top');
        need('name', /if \(s\.kind === 'den' && v !== e\.n\)\{ roundMiss\(v === e\.m \? d\.gNameDenNum\(e\.m, e\.n\) : d\.gNameDenUn\(u, e\.m, e\.n\)\); return false; \}/, 'the numerator (or the unshaded count) is accepted at the bottom, or the wrong reason');
        need('name', /var s = nearestOpen\(slots, pt, 4\);/, 'the boxes do not use a pad of 4');
        need('name', /if \(filled === 2\) roundSolved\(d\.gNameDone\(e\.m, e\.n\)\);/, 'the round is not solved exactly when both boxes are filled');
        need('name', /var pie = makePie\(e\.n, e\.m, 2 \* \(NP\.r \+ 6\)\);/, 'the pie is not n pieces with m shaded');
      }

      /* --- 第 3 關：照訂單塗色（範例 3 反過來；n/n ＝ 1） --- */
      {
        const T = D.TAKE_PIE;
        let anyWhole = false, anyUnit = false;
        inside(sq(T.cx, T.cy, 2 * T.r + 8), 'take: the cake', W, D.TAKE_H);
        D.GAME_TAKE.forEach((e, i) => {
          const w = 'GAME_TAKE[' + i + ']';
          if (!isInt(e.n) || !isInt(e.m)) return fail(w + ' is not whole numbers');
          if (e.n < 4 || e.n > 8) fail(w + ': ' + e.n + ' pieces — should be 4~8');
          if (!(e.m >= 1 && e.m <= e.n)) fail(w + ': ' + e.m + ' pieces is more than the cake has (or none)');
          if (e.m === e.n) anyWhole = true;
          if (e.m === 1) anyUnit = true;
          /* 點的那一塊：一塊扇形裡放得下的最大的圓，直徑至少 44px（手機上） */
          const th = Math.PI / e.n, dia = 2 * T.r * Math.sin(th) / (1 + Math.sin(th));
          if (!(dia * scale >= 44)) fail(w + ': a piece of a cake cut into ' + e.n + ' is ' + (dia * scale).toFixed(1) + 'px wide at most — too thin to tap');
          /* 照規則：塗了 x 塊（0 ～ n）按出貨 → 只有 x ＝ m 收 */
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let x = 0; x <= e.n; x++){
              seq(w + ' gTakeNow ' + L, d.gTakeNow(e.m, e.n, x), [e.m, e.n, x]);
              seq(w + ' gTake2 ' + L, d.gTake2(e.m, x), [e.m, x]);
              if (x < e.m) seq(w + ' gTakeFew ' + L, d.gTakeFew(x, e.m, e.n), [x, e.m, e.n, e.m, e.m - x]);
              if (x > e.m) seq(w + ' gTakeMany ' + L, d.gTakeMany(x, e.m, e.n), [x, e.m, e.n, e.m, x - e.m]);
            }
            for (let k = 1; k <= e.n; k++) seq(w + ' gTakeWedge ' + L, d.gTakeWedge(k), [k]);
            seq(w + ' gTakeDone ' + L, d.gTakeDone(e.m, e.n), e.m === e.n ? [e.n, e.n, 1, e.n] : [e.m, e.n, e.n, e.m]);
          });
        });
        if (!anyWhole) fail('GAME_TAKE: no order is a whole cake (n/n = 1 is never practised)');
        if (!anyUnit) fail('GAME_TAKE: no unit-fraction order');
        need('take', /if \(x < e\.m\)\{ roundMiss\(d\.gTakeFew\(x, e\.m, e\.n\)\); return; \}\s*if \(x > e\.m\)\{ roundMiss\(d\.gTakeMany\(x, e\.m, e\.n\)\); return; \}\s*btn\.disabled = true;\s*roundSolved\(d\.gTakeDone\(e\.m, e\.n\)\);/, '"send" is accepted with too few or too many pieces');
        need('take', /for \(var i = 0; i < e\.n; i\+\+\)\{\s*var w = svgEl\('path', \{ d:sectorPath\(c, c, T\.r, -90 \+ i \* 360 \/ e\.n, -90 \+ \(i \+ 1\) \* 360 \/ e\.n\)/, 'the cake is not cut into n equal pieces');
        need('take', /x \+= on \? -1 : 1;/, 'a tap does not toggle one piece');
        need('take', /if \(gSolved\) return;\s*var el = ev\.currentTarget/, 'the cake can still change after sending');
      }

      /* --- 第 4 關：排排站（範例 4：同分母比分子、單位分数比分母） --- */
      {
        const S = D.SORT_SLOT, C = D.SORT_CARD, TR = D.SORT_TRAY;
        let anySame = false, anyUnit = false;
        if (!(D.SORT_GAP >= 4)) fail('SORT_GAP ' + D.SORT_GAP + ' — strips closer than 4px cannot be told apart');
        D.GAME_SORT.forEach((e, i) => {
          const w = 'GAME_SORT[' + i + ']', fr = e.fr;
          if (!Array.isArray(fr) || fr.length !== 3) return fail(w + ' should be three fractions');
          if (!fr.every(f => isInt(f[0]) && isInt(f[1]) && f[0] >= 1 && f[0] < f[1] && f[1] <= 8)) return fail(w + ': every card should be a proper fraction with denominator 2~8');
          const sameDen = fr.every(f => f[1] === fr[0][1]), unit = fr.every(f => f[0] === 1);
          if (!sameDen && !unit) fail(w + ': neither the same denominator nor all unit fractions — out of this lesson\'s scope');
          if (sameDen) anySame = true; if (unit) anyUnit = true;
          for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (same(fr[a], fr[b])) fail(w + ': the cards are not all different');
          fr.forEach(f => { if (!near(D.fracVal(f), f[0] / f[1])) fail(w + ': fracVal(' + f.join('/') + ') is ' + D.fracVal(f)); });
          const ord = fr.slice().sort((p, q) => p[0] / p[1] - q[0] / q[1]);
          /* 畫面決定得了答案：卡片上的長條，塗色的長度兩兩至少差 SORT_GAP */
          const wd = ord.map(f => C.bar * f[0] / f[1]);
          for (let k = 1; k < 3; k++) if (wd[k] - wd[k - 1] < D.SORT_GAP) fail(w + ': the shaded strips of ' + ord[k - 1].join('/') + ' and ' + ord[k].join('/') + ' differ by less than ' + D.SORT_GAP + 'px');
          /* 照規則：每一張卡放進每一格 —— 只有排在那一名的收；每一種擺的順序最後都排成由小到大 */
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let k = 0; k <= 3; k++) seq(w + ' gSortNow ' + L, d.gSortNow(k), [k, 3]);
            ord.forEach((want, s) => {
              seq(w + ' gSort2 ' + L, d.gSort2(s + 1, want[0], want[1]), [s + 1, want[0], want[1]]);
              fr.forEach(f => {
                if (f === want) return;
                const txt = d.gSortWrong(f[0], f[1], want[0], want[1]);
                seq(w + ' gSortWrong ' + L, txt, sameDen ? [f[0], f[1], want[0], want[1], f[1], f[0], want[0]] : [f[0], f[1], want[0], want[1], f[1], want[1]]);
                /* 理由要真的成立：比較小的卡，真的排在這一格的左邊 */
                const less = f[0] / f[1] < want[0] / want[1], rank = ord.indexOf(f);
                if (less !== (rank < s)) fail(w + ': rank logic');
                const word = L === 'zh' ? (less ? '小' : '大') : (less ? 'smaller' : 'bigger'), side = L === 'zh' ? (less ? '左邊' : '右邊') : (less ? 'left' : 'right');
                const wrongWord = L === 'zh' ? (less ? '比 ' + want[0] + '/' + want[1] + ' 大' : '比 ' + want[0] + '/' + want[1] + ' 小') : (less ? 'bigger than' : 'smaller than');
                if (txt.indexOf(word) < 0 || txt.indexOf(side) < 0 || txt.indexOf(wrongWord) >= 0) fail(w + ' ' + L + ': "' + txt + '" — ' + f.join('/') + ' is ' + (less ? 'smaller' : 'bigger') + ' and belongs further ' + (less ? 'left' : 'right'));
                if (sameDen && (f[0] < want[0]) !== less) fail(w + ': the numerator reason does not hold');
                if (!sameDen && (f[1] > want[1]) !== less) fail(w + ': the denominator reason does not hold');
              });
            });
            const t = ord.map(f => f.join('/')).join(' < ');
            const done = d.gSortDone(t, sameDen);
            seq(w + ' gSortDone ' + L, done, [].concat(...ord).concat(sameDen ? [] : [1]));
            const unitWord = L === 'zh' ? '分子都是 1' : 'all numerators are 1';
            if ((done.indexOf(unitWord) >= 0) === sameDen) fail(w + ' ' + L + ': gSortDone gives the ' + (sameDen ? 'unit-fraction' : 'same-denominator') + ' reason');
          });
        });
        if (!anySame) fail('GAME_SORT: no same-denominator set');
        if (!anyUnit) fail('GAME_SORT: no unit-fraction set (the 1/8 < 1/4 trap is never practised)');
        const slots = S.xs.map(x => sq(x, S.y, S.w, S.h));
        slots.forEach((o, k) => inside(o, 'sort: box ' + k, W, D.SORT_H));
        noHits(slots.map(o => grow(o, 4)), 'sort: slots');
        if (C.w > S.w || C.h > S.h) fail('sort: a card does not fit its box');
        if (C.bar > C.w - 8) fail('sort: the strip does not fit the card');
        if (!(S.xs[0] < S.xs[1] && S.xs[1] < S.xs[2])) fail('sort: the boxes are not left to right');
        const lbls = [sq(S.xs[0], D.SORT_LBL.y + D.SORT_LBL.h / 2, S.w, D.SORT_LBL.h), sq(S.xs[2], D.SORT_LBL.y + D.SORT_LBL.h / 2, S.w, D.SORT_LBL.h)];
        lbls.forEach((o, k) => inside(o, 'sort: label ' + k, W, D.SORT_H));
        if (lbls.some(o => slots.some(s => hit(o, grow(s, 4))))) fail('sort: a label reaches a box');
        const tray = [0, 1, 2].map(k => sq((W - 2 * TR.step) / 2 + k * TR.step, TR.y, C.w, C.h));
        tray.forEach((o, k) => inside(o, 'sort: card ' + k, W, D.SORT_H)); noHits(tray, 'sort: cards');
        if (tray.some(o => slots.some(s => hit(o, grow(s, 4 + 4))))) fail('sort: the card tray reaches the boxes');
        need('sort', /var order = e\.fr\.slice\(\)\.sort\(function\(p, q\)\{ return fracVal\(p\) - fracVal\(q\); \}\);/, 'the order is not smallest to biggest');
        need('sort', /var same = e\.fr\.every\(function\(f\)\{ return f\[1\] === e\.fr\[0\]\[1\]; \}\);/, 'cannot tell a same-denominator set');
        need('sort', /if \(f !== want\)\{ roundMiss\(d\.gSortWrong\(f\[0\], f\[1\], want\[0\], want\[1\]\)\); return false; \}/, 'a card is accepted in the wrong place');
        need('sort', /var f = P\.data\.f, want = order\[s\.i\];/, 'a box does not want the card of its rank');
        need('sort', /P\.el\.appendChild\(makeBar\(f\[1\], f\[0\], 0, C\.bar, C\.barH\)\);/, 'the card does not draw its own strip');
        need('sort', /if \(placed === order\.length\) roundSolved\(d\.gSortDone\(order\.map\(function\(q\)\{ return q\[0\] \+ '\/' \+ q\[1\]; \}\)\.join\(' < '\), same\)\);/, 'the round is not solved exactly when all three are placed');
      }

      /* --- 第 5 關：合起來／拿走（範例 5） --- */
      {
        const J = D.JOIN_BAR, ST = D.JOIN_STRIP;
        const maxLen = +((B.join.match(/inp\.maxLength = (\d+);/) || [])[1]);
        if (!maxLen) fail('join: cannot read the answer box maxLength');
        let anyAdd = false, anySub = false, anyWhole = false;
        inside({ x:J.x, y:J.y, w:J.w, h:J.h }, 'join: the bar', W, D.JOIN_H);
        D.GAME_JOIN.forEach((e, i) => {
          const w = 'GAME_JOIN[' + i + ']';
          if (![e.n, e.a, e.b].every(isInt) || (e.op !== '+' && e.op !== '-')) return fail(w + ' is malformed');
          if (e.n < 4 || e.n > 8) fail(w + ': ' + e.n + ' pieces — should be 4~8');
          if (e.op === '+'){ anyAdd = true; if (!(e.a >= 1 && e.b >= 1 && e.a + e.b <= e.n)) fail(w + ': ' + e.a + ' + ' + e.b + ' is more than the bar holds (' + e.n + ')'); if (e.a + e.b === e.n) anyWhole = true; }
          else { anySub = true; if (!(e.b >= 1 && e.b < e.a && e.a < e.n)) fail(w + ': ' + e.a + ' − ' + e.b + ' takes away more than (or all of) the cake, or there is no empty piece'); }
          const r = e.op === '+' ? e.a + e.b : e.a - e.b, sw = J.w / e.n;
          if (D.joinResult(e) !== r) fail(w + ': joinResult() is ' + D.joinResult(e) + ', should be ' + r);
          [String(r), String(e.n), String(2 * e.n)].forEach(v => { if (v.length > maxLen) fail(w + ': ' + v + ' does not fit the ' + maxLen + '-digit answer box'); });
          /* joinPlace()：整片格點，兩種放法（拖、點目的地）。判斷不抄頁面的算式，用性質驗：
             ① 收下來的每一格都是該收的格子、而且都在長條裡（＋ 只蓋空格、− 只蓋藍色）
             ② 拖的時候，長條自己畫出來的那一段蓋到「不該蓋的格子」超過半格 → 一定不收（codex 第一輪：只看中心點會收）
             ③ 拖到正好對齊的位置一定收、而且就蓋那幾格；④ 點目的地：收下來的一定蓋住點到的那一格
             ⑤ 第二套實作（拖：在所有格線裡找最近的那一條當左緣；點：列舉放得下的起點）和頁面逐點一致
             ⑥ 點到該收的格子一定收 ⑦ 拖的時候長條畫出來的那一段掛出長條超過半格 → 一定靜靜彈回（正好半格時，對齊方向看 Math.round，不要求） */
          const lo = e.op === '+' ? e.a : 0, hi = e.op === '+' ? e.n : e.a, okCell = c => c >= lo && c < hi;
          const mine = (pt) => {
            if (Math.abs(pt.y - (J.y + J.h / 2)) > J.h / 2 + D.JOIN_PAD) return null;
            if (pt.tap){
              if (pt.x < J.x || pt.x >= J.x + J.w) return null;
              const c = Math.floor((pt.x - J.x) / sw);
              if (!okCell(c)) return { bad:c < e.a ? 'blue' : 'empty' };
              /* 所有放得下的起點裡，蓋得住點到的那一格、最靠右的那一個 */
              let st = null; for (let k = lo; k + e.b <= hi; k++) if (k <= c && c < k + e.b) st = k;
              return { start:st };
            }
            const left = pt.x - e.b * sw / 2;
            let best = null, bd = Infinity;
            for (let k = -e.b - 1; k <= e.n + 1; k++){ const dd = Math.abs(J.x + k * sw - left); if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && k > best)){ bd = dd; best = k; } }
            /* 對齊格線之後有一格落在長條外面 → 靜靜彈回（就算同時蓋到不該蓋的格子也一樣：沒放準不扣分） */
            if (best < 0 || best + e.b > e.n) return null;
            for (let c = best; c < best + e.b; c++) if (!okCell(c)) return { bad:c < e.a ? 'blue' : 'empty' };
            return { start:best };
          };
          let badP = 0, bad1 = 0, bad2 = 0, bad4 = 0, bad5 = 0, bad6 = 0;
          for (let x = -10; x <= 310; x += 1.25) for (let y = 0; y <= D.JOIN_H; y += 3) [false, true].forEach(tap => {
            const pt = { x, y, tap }, got = D.joinPlace(e, pt), want = mine(pt);
            if (JSON.stringify(got) !== JSON.stringify(want)) badP++;
            if (got && got.start !== undefined){
              for (let c = got.start; c < got.start + e.b; c++) if (c < 0 || c >= e.n || !okCell(c)) bad1++;
              if (tap){ const c = Math.floor((x - J.x) / sw); if (!(got.start <= c && c < got.start + e.b)) bad4++; }
            }
            /* ⑥ 點在長條上、點到該收的格子 → 一定收 */
            if (tap && x >= J.x && x < J.x + J.w && Math.abs(y - (J.y + J.h / 2)) <= J.h / 2 + D.JOIN_PAD && okCell(Math.floor((x - J.x) / sw)) && !(got && got.start !== undefined)) bad6++;
            /* ⑦ 拖的時候，長條自己畫出來的那一段有一部分在長條外面（超過半格）→ 一定是靜靜彈回，不扣分 */
            if (!tap && Math.abs(y - (J.y + J.h / 2)) <= J.h / 2 && (x - e.b * sw / 2 < J.x - sw / 2 - 1e-6 || x + e.b * sw / 2 > J.x + J.w + sw / 2 + 1e-6) && got !== null) bad5++;
            if (!tap && Math.abs(y - (J.y + J.h / 2)) <= J.h / 2){
              const L0 = x - e.b * sw / 2, R0 = x + e.b * sw / 2;
              for (let c = 0; c < e.n; c++){
                if (okCell(c)) continue;
                const ov = Math.min(R0, J.x + (c + 1) * sw) - Math.max(L0, J.x + c * sw);
                if (ov > sw / 2 + 1e-6 && got && got.start !== undefined) bad2++;
              }
            }
          });
          if (badP) fail(w + ': joinPlace() disagrees with the second implementation at ' + badP + ' points');
          if (bad1) fail(w + ': joinPlace() accepts a placement that covers ' + bad1 + ' forbidden (or off-bar) cells');
          if (bad2) fail(w + ': joinPlace() accepts a strip that overlaps the ' + (e.op === '+' ? 'blue cake' : 'empty pieces') + ' by more than half a piece (' + bad2 + ' points)');
          if (bad4) fail(w + ': a tap on a piece places the strip somewhere that does not cover the tapped piece (' + bad4 + ' points)');
          if (bad5) fail(w + ': a strip hanging off the bar is not a silent bounce (' + bad5 + ' points)');
          if (bad6) fail(w + ': a tap on an allowed piece is not accepted (' + bad6 + ' points)');
          for (let st = lo; st + e.b <= hi; st++){
            const got = D.joinPlace(e, { x:J.x + (st + e.b / 2) * sw, y:J.y + J.h / 2 });
            if (!got || got.start !== st) fail(w + ': a strip dropped exactly on pieces ' + st + '..' + (st + e.b - 1) + ' is not placed there');
          }
          /* 收的位置一定存在：＋ 要有空格、− 要有藍色 */
          const strip = sq(150, ST.y, Math.max(D.GPICK, e.b * sw), ST.h);
          inside(strip, w + ' strip', W, D.JOIN_H);
          if (hit(strip, { x:J.x, y:J.y - D.JOIN_PAD, w:J.w, h:J.h + 2 * D.JOIN_PAD })) fail(w + ': the strip at home is on the bar');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gJoinNow ' + L, d.gJoinNow(e.op, e.a, e.b, e.n), [e.a, e.n, e.b, e.n]);
            seq(w + ' gJoinLine ' + L, d.gJoinLine(e.op, e.a, e.b, e.n), [e.a, e.n, e.b, e.n, r, e.n]);
            seq(w + ' gJoinDone ' + L, d.gJoinDone(e.op, e.a, e.b, e.n), [e.a, e.n, e.b, e.n, r, e.n, e.n, e.a, e.b, r].concat(r === e.n ? [e.n, e.n, 1] : []));
            seq(w + ' gJoin2 ' + L, d.gJoin2(e.op, e.a, e.b, e.n), [e.a, e.b, r, e.n]);
            seq(w + ' gJoinAdd/Eat ' + L, e.op === '+' ? d.gJoinAdd(e.b) : d.gJoinEat(e.b), [e.b]);
            seq(w + ' gJoin2Add/Eat ' + L, e.op === '+' ? d.gJoin2Add(e.b) : d.gJoin2Eat(e.b), [e.b]);
            seq(w + ' gJoinDenAdd/Sub ' + L, e.op === '+' ? d.gJoinDenAdd(e.n) : d.gJoinDenSub(e.n), [e.n]);
            for (let v = 0; v <= 2 * e.n; v++){
              if (v !== r) seq(w + ' gJoinNum ' + L, d.gJoinNum(e.op, e.a, e.b, v), [e.a, e.b, r, v]);
              if (v !== e.n) seq(w + ' gJoinDen ' + L, d.gJoinDen(v, e.n), [e.n, e.n, v]);
            }
            const sign = e.op === '+' ? (L === 'zh' ? '＋' : '+') : '−';
            if (d.gJoinNow(e.op, e.a, e.b, e.n).indexOf(sign) < 0) fail(w + ' ' + L + ': gJoinNow does not show the ' + e.op + ' sign');
          });
        });
        if (!anyAdd || !anySub) fail('GAME_JOIN: should have both addition and subtraction');
        if (!anyWhole) fail('GAME_JOIN: no addition makes a whole cake');
        need('join', /var at = joinPlace\(e, pt\);\s*if \(!at\) return false;\s*if \(at\.bad === 'blue'\)\{ roundMiss\(d\.gJoinOnTop\); return false; \}\s*if \(at\.bad === 'empty'\)\{ roundMiss\(d\.gJoinEatEmpty\); return false; \}/, 'piling onto the blue cake / eating from the empty pieces is accepted, or a drop off the bar is not silent');
        need('join', /for \(var c = at\.start; c < at\.start \+ e\.b; c\+\+\) kinds\[c\] = e\.op === '\+' \? 'o' : 'x';\s*drawBar\(\);/, 'the bar after the drop does not show the pieces the strip covers');
        need('join', /for \(var i = 0; i < e\.n; i\+\+\) kinds\.push\(i < e\.a \? 'b' : 'w'\);/, 'the bar does not start with a blue pieces');
        need('join', /if \(b === e\.n && a === r\)\{/, 'a wrong answer is accepted');
        need('join', /else if \(e\.op === '\+' && b === 2 \* e\.n\) roundMiss\(d\.gJoinDenAdd\(e\.n\)\);\s*else if \(e\.op === '-' && b === 0\) roundMiss\(d\.gJoinDenSub\(e\.n\)\);\s*else if \(b !== e\.n\) roundMiss\(d\.gJoinDen\(b, e\.n\)\);\s*else roundMiss\(d\.gJoinNum\(e\.op, e\.a, e\.b, a\)\);/, 'adding the denominators has no reason of its own, or a wrong answer has no reason');
        need('join', /function canon\(t\)\{ t = t\.trim\(\); return \/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\) \? \+t : null; \}[\s\S]*?if \(a === null \|\| b === null\)\{ gMsg\.textContent = d\.gJoinEmpty; return; \}/, 'an empty or malformed answer ("3 4", "03") is counted as a mistake or read as a number');
        need('join', /if \(gSolved \|\| !ready\) return;/, 'the answer can be checked before the strip is placed');
        need('join', /var e = pick\(GAME_JOIN\), J = JOIN_BAR, sw = J\.w \/ e\.n, r = joinResult\(e\)/, 'the answer is not joinResult()');
      }
    }
  }
};
module.exports._test = { scanEquations };
