/* grade-3/math/divide 的檢查設定（分東西大隊：等分除與包含除、餘數一定比除數小、用乘法驗算、二位數 ÷ 一位數的直式）。
   2026-10-01 新增 —— 和小遊戲「分裝出貨」改成五關五種玩法（§六之五）同一次寫成。

   sim（review.html 的九個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，
   商餘題自己拼「商 q、餘 r」／「q r r」）。maxRemainder 的不變條件是「除了正解以外，每一個選項都是
   這個除數真的可能出現的餘數」—— 跑起來抓到舊缺陷：k + 1 也是不可能的餘數，一題兩個正解。
   刻意的迷思誘答（把題幹的數字當答案）白名單只放行那一個值，見 stemEchoOk。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算：a × b ＝ c、a ＋ b ＝ c、a − b ＝ c、
     連在一起的 a × b ＋ c ＝ d，以及 a ÷ b ＝ q／a ÷ b ＝ 商 q、餘 r／a ÷ b = q r r（餘數也要比除數小）。
     題幹寫成「a ÷ b ＝ ？」的題目，標的正解要等於自己算的商餘。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的算法重算答案，並且**照遊戲的規則把每一題從頭玩一次**（平分的輪流規則、裝袋的「裝不滿不算」、
     補裝的「一次一袋、剩不到一袋不能開新袋」），證明每一題都解得完、而且解完一定是對的商與餘數；
     頁面的純函式（longSteps／pileDotXY／shareDotXY／fixSlotXY／fixTrayXY／…）一律拿整個題庫去呼叫再和自己的算法比，
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一步、每一種放錯、每一個錯的數字卡）。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 scratchpad 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function qr(q, r, lang){ return lang === 'zh' ? '商 ' + q + '、餘 ' + r : q + ' r ' + r; }

/* 自己的直式除法（二位數 ÷ 一位數）：每一格寫什麼、照什麼順序 */
function myLong(n, d){
  const T = Math.floor(n / 10), O = n % 10, q1 = Math.floor(T / d), m1 = q1 * d, s1 = T - m1;
  const br = s1 * 10 + O, q2 = Math.floor(br / d), m2 = q2 * d, s2 = br - m2;
  const cells = [['q', 't', 'q', q1], ['m', 't', 'm1', m1], ['s', 't', 's1', s1], ['b', 'o', 's1', O], ['q', 'o', 'q', q2]];
  if (m2 >= 10) cells.push(['m', 't', 'm2', Math.floor(m2 / 10)]);
  cells.push(['m', 'o', 'm2', m2 % 10], ['s', 'o', 's2', s2]);
  return { T, O, q1, m1, s1, br, q2, m2, s2, Q:q1 * 10 + q2, R:s2, cells };
}

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果」找出來重算 */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(?:商 ?)?(\d+)(?![\d.\/])(?:(?: ?、? ?餘 ?| r )(\d+))?/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1], got = +m[2], rem = m[3] === undefined ? null : +m[3];
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0){
      if (toks.length !== 3) bad = 'a division chained with other operations';
      else {
        const a = +toks[0], b = +toks[2], q = Math.floor(a / b), r = a % b;
        if (got !== q || (rem === null ? r !== 0 : rem !== r)) bad = 'should be ' + q + (r ? ' remainder ' + r : '');
      }
    } else {
      /* × 先算，再由左到右 ＋ − */
      const terms = [];
      let cur = +toks[0], sign = 1;
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], v = +toks[i + 1];
        if (op === '×') cur *= v;
        else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
      }
      terms.push(sign * cur);
      const want = terms.reduce((x, y) => x + y, 0);
      if (rem !== null) bad = 'a remainder after a non-division';
      else if (want !== got) bad = 'should be ' + want;
    }
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['share', 'pack', 'fix', 'check', 'long'];", replace:"var GAME_ORDER = ['share', 'fix', 'pack', 'check', 'long'];" },
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
    { file:'index', expect:'pileDotXY(', find:'function pileDotXY(i, top){ return { x:150 + ((i % 10) - 4.5) * PILE_STEP,', replace:'function pileDotXY(i, top){ return { x:150 + ((i % 10) - 4) * PILE_STEP,' },
    { file:'index', expect:'pile dots', find:'var PILE_STEP = 24, PILE_DOT = 16;', replace:'var PILE_STEP = 18, PILE_DOT = 16;' },

    /* 平分 */
    { file:'index', expect:'does not share out evenly', find:'var GAME_SHARE = [ { n:12, g:3 },', replace:'var GAME_SHARE = [ { n:13, g:3 },' },
    { file:'index', expect:'per plate — should be 2~5', find:'{ n:10, g:2 }, { n:8, g:4 } ];', replace:'{ n:12, g:2 }, { n:8, g:4 } ];' },
    { file:'index', expect:'plates — should be 2~4', find:'{ n:16, g:4 }, { n:10, g:2 },', replace:'{ n:10, g:5 }, { n:10, g:2 },' },
    { file:'index', expect:'shareDotXY(', find:'x:SHARE_PLATE.w / 2 + ((k % 2) - 0.5) * SHARE_PLATE.step', replace:'x:SHARE_PLATE.w / 2 + ((k % 2) - 1) * SHARE_PLATE.step' },
    { file:'index', expect:'plates 0 and 1 overlap', find:'SHARE_PLATE = { y:76, w:66, h:108, gap:8,', replace:'SHARE_PLATE = { y:76, w:66, h:108, gap:-4,' },
    { file:'index', expect:'runs into the edge or the count', find:'SHARE_PLATE = { y:76, w:66, h:108,', replace:'SHARE_PLATE = { y:76, w:66, h:88,' },
    { file:'index', expect:'reach the cookie pile', find:'SHARE_PILE = { x:22, y:150, w:256, h:58, top:166 }', replace:'SHARE_PILE = { x:22, y:132, w:256, h:58, top:148 }' },
    { file:'index', expect:'the pile overlaps the cookie you drag', find:'var SHARE_TOKEN = { y:252, size:52 };', replace:'var SHARE_TOKEN = { y:230, size:52 };' },
    { file:'index', expect:'a plate that is ahead accepts', find:'        if (pl.n > min){ roundMiss(d.gShareAhead(pl.n, min)); return false; }', replace:'        if (pl.n > min + 1){ roundMiss(d.gShareAhead(pl.n, min)); return false; }' },
    { file:'index', expect:'gShareAhead zh', find:"return '這一盤已經有 ' + have + ' 片，別的盤子才 ' + min + ' 片", replace:"return '這一盤已經有 ' + have + ' 片，別的盤子才 ' + (min + 1) + ' 片" },
    { file:'index', expect:'gShareDone en', find:"return n + ' ÷ ' + g + ' = ' + per + ': every plate has ' + per", replace:"return n + ' ÷ ' + g + ' = ' + (per + 1) + ': every plate has ' + per" },

    /* 裝袋 */
    { file:'index', expect:'no entry divides evenly', find:'{ n:13, k:3 }, { n:20, k:4 }, { n:29, k:6 } ];', replace:'{ n:13, k:3 }, { n:21, k:4 }, { n:29, k:6 } ];' },
    { file:'index', expect:'no entry leaves k − 1', find:'var GAME_PACK = [ { n:14, k:4 }, { n:23, k:5 }, { n:22, k:6 }, { n:13, k:3 }, { n:20, k:4 }, { n:29, k:6 } ];', replace:'var GAME_PACK = [ { n:14, k:4 }, { n:23, k:5 }, { n:22, k:6 }, { n:13, k:3 }, { n:20, k:4 }, { n:26, k:6 } ];' },
    { file:'index', expect:'bags — should be 2~5', find:'var GAME_PACK = [ { n:14, k:4 },', replace:'var GAME_PACK = [ { n:26, k:4 },' },
    { file:'index', expect:'the pile holds 3 rows of 10', find:'{ n:23, k:5 }, { n:22, k:6 },', replace:'{ n:23, k:5 }, { n:33, k:6 },' },
    { file:'index', expect:'bags 50 apart overlap', find:'PACK_BAG = { x0:40, y:150, w:50, h:66, step:56 }', replace:'PACK_BAG = { x0:40, y:150, w:50, h:66, step:50 }' },
    { file:'index', expect:'the bag row overlaps the pile', find:'PACK_BAG = { x0:40, y:150,', replace:'PACK_BAG = { x0:40, y:130,' },
    { file:'index', expect:'overlaps "per bag" label', find:'var PACK_TOKEN = { x:110, y:250, size:56 }', replace:'var PACK_TOKEN = { x:150, y:250, size:56 }' },
    { file:'index', expect:'a bag that cannot be filled is accepted', find:'        if (left < e.k){ roundMiss(d.gPackShort(left, e.k)); return false; }', replace:'        if (left < 1){ roundMiss(d.gPackShort(left, e.k)); return false; }' },
    { file:'index', expect:'"done" is accepted while a full bag', find:'        if (left >= e.k){ roundMiss(d.gPackMore(left, e.k)); return; }', replace:'        if (left > e.k){ roundMiss(d.gPackMore(left, e.k)); return; }' },
    { file:'index', expect:'gPackDone zh', find:"n + ' ÷ ' + k + ' ＝ 商 ' + q + '、餘 ' + r + '：裝了 ' + q + ' 袋，剩下 ' + r + ' 顆（比 ' + k", replace:"n + ' ÷ ' + k + ' ＝ 商 ' + q + '、餘 ' + r + '：裝了 ' + q + ' 袋，剩下 ' + r + ' 顆（比 ' + (k + 1)" },
    { file:'index', expect:'gPack2 en', find:"return left >= k ? left + ' left — enough to fill a bag of ' + k", replace:"return left > k ? left + ' left — enough to fill a bag of ' + k" },

    /* 補裝 */
    { file:'index', expect:'is already smaller than', find:'var GAME_FIX = [ { k:5, q0:2, L:7 },', replace:'var GAME_FIX = [ { k:5, q0:2, L:4 },' },
    { file:'index', expect:'no entry ends with nothing left over', find:'{ k:4, q0:1, L:5 }, { k:3, q0:2, L:6 } ];', replace:'{ k:4, q0:1, L:5 }, { k:3, q0:2, L:7 } ];' },
    { file:'index', expect:'no entry needs two more bags', find:'var GAME_FIX = [ { k:5, q0:2, L:7 }, { k:3, q0:3, L:7 }, { k:4, q0:3, L:9 }, { k:5, q0:1, L:8 }, { k:4, q0:1, L:5 }, { k:3, q0:2, L:6 } ];', replace:'var GAME_FIX = [ { k:5, q0:2, L:7 }, { k:3, q0:3, L:5 }, { k:4, q0:3, L:5 }, { k:5, q0:1, L:8 }, { k:4, q0:1, L:5 }, { k:3, q0:2, L:4 } ];' },
    { file:'index', expect:'do not fit two rows of', find:'{ k:4, q0:3, L:9 },', replace:'{ k:4, q0:3, L:11 },' },
    { file:'index', expect:'fixSlotXY(', find:'y:FIX_BOX.h / 2 + (Math.floor(s / 3) - (rows - 1) / 2) * FIX_BOX.step', replace:'y:FIX_BOX.h / 2 + Math.floor(s / 3) * FIX_BOX.step' },
    { file:'index', expect:'empty bags closer than 12', find:'FIX_BOX = { y:158, w:84, h:84, gap:12,', replace:'FIX_BOX = { y:158, w:84, h:84, gap:8,' },
    { file:'index', expect:'reach the candies', find:'var FIX_TRAY = { y:240, step:54, perRow:5 };', replace:'var FIX_TRAY = { y:226, step:54, perRow:5 };' },
    { file:'index', expect:'leftover candies 0 and 1 overlap', find:'var FIX_TRAY = { y:240, step:54, perRow:5 };', replace:'var FIX_TRAY = { y:240, step:44, perRow:5 };' },
    { file:'index', expect:'one more than needed', find:'      var nb = Math.floor(e.L / e.k) + 1, boxes = [];', replace:'      var nb = Math.floor(e.L / e.k), boxes = [];' },
    { file:'index', expect:'a second bag can be started', find:'          if (cur){ roundMiss(d.gFixFinish(cur.n, e.k)); return false; }\n', replace:'' },
    { file:'index', expect:'a second bag can be started', find:'          if (left < e.k){ roundMiss(d.gFixShort(left, e.k)); return false; }\n          cur = bx;', replace:'          cur = bx;' },
    { file:'index', expect:'"all sorted" is accepted', find:'        if (cur){ roundMiss(d.gFixPartial(cur.n, e.k)); return; }\n', replace:'' },
    { file:'index', expect:'"all sorted" is accepted', find:'        if (left >= e.k){ roundMiss(d.gFixMore(left, e.k)); return; }\n        finish();', replace:'        finish();' },
    { file:'index', expect:'meant to be a wrong claim', find:"return '小明：' + n + ' ÷ ' + k + ' ＝ 商 ' + q0 + '、餘 ' + L + ' ❓'; }", replace:"return '小明：' + n + ' ÷ ' + k + ' ＝ 商 ' + Math.floor(n / k) + '、餘 ' + (n % k) + ' ❓'; }" },
    { file:'index', expect:'gFixMore en', find:"'. The remainder must be smaller than the divisor ' + k + '.'; }", replace:"'. The remainder must be smaller than the divisor ' + left + '.'; }" },

    /* 驗算 */
    { file:'index', expect:'are not all different', find:'{ k:4, q:5, r:3 }, { k:5, q:6, r:2 },', replace:'{ k:4, q:3, r:3 }, { k:5, q:6, r:2 },' },
    { file:'index', expect:'should be 1~', find:'var GAME_CHECK = [ { k:6, q:5, r:4 },', replace:'var GAME_CHECK = [ { k:6, q:5, r:0 },' },
    { file:'index', expect:'bags — the picture holds 2~6', find:'{ k:3, q:6, r:2 }, { k:8, q:3, r:5 } ];', replace:'{ k:3, q:7, r:2 }, { k:8, q:3, r:5 } ];' },
    { file:'index', expect:'does not fit the 1-digit answer box', find:'inp.maxLength = 3;', replace:'inp.maxLength = 1;' },
    { file:'index', expect:'number sentence parts', find:"CHECK_EQ = { y:186, slot:46, x:[30, 102, 174], ops:[66, 138, 211], res:{ x:254, w:60 } }", replace:"CHECK_EQ = { y:186, slot:46, x:[30, 92, 174], ops:[66, 138, 211], res:{ x:254, w:60 } }" },
    { file:'index', expect:'the fact line reaches the boxes', find:'CHECK_FACT = { y:98, h:36 }', replace:'CHECK_FACT = { y:128, h:36 }' },
    { file:'index', expect:'the card tray reaches the boxes', find:'CHECK_TRAY = { y:256, step:72 }', replace:'CHECK_TRAY = { y:236, step:72 }' },
    { file:'index', expect:'check: cards', find:'CHECK_TRAY = { y:256, step:72 }', replace:'CHECK_TRAY = { y:256, step:44 }' },
    { file:'index', expect:'the remainder is accepted in a × box', find:"        if (s.kind === 'x' && v === e.r){ roundMiss(d.gCheckRemTimes(e.r)); return false; }\n", replace:'' },
    { file:'index', expect:'accepted after ＋', find:"        if (s.kind === 'p' && v !== e.r){ roundMiss(d.gCheckPlusNot(v, e.r)); return false; }\n", replace:'' },
    { file:'index', expect:'a wrong dividend is accepted', find:'        else if (v === kq) roundMiss(d.gCheckForgot(e.k, e.q, kq, e.r));', replace:'        else if (v === kq) roundSolved(d.gCheckForgot(e.k, e.q, kq, e.r));' },
    { file:'index', expect:'is counted as a mistake or read as a number', find:"if (!/^(0|[1-9]\\d*)$/.test(t)){ gMsg.textContent = d.gCheckEmpty; return; }", replace:"if (!/^\\d+$/.test(t)){ gMsg.textContent = d.gCheckEmpty; return; }" },
    { file:'index', expect:'is counted as a mistake or read as a number', find:"        var t = inp.value.trim();", replace:"        var t = inp.value.replace(/\\s/g, '');" },
    { file:'index', expect:'not sent home', find:"if (!P.locked) P.lock(P.homeX, P.homeY); });", replace:"if (!P.locked) P.lock(P.cx, P.cy); });" },
    { file:'index', expect:'gCheckForgot zh', find:"return k + ' × ' + q + ' ＝ ' + kq + ' 只是袋子裡的糖，別忘了加上剩下的 ' + r + ' 顆。'; }", replace:"return k + ' × ' + q + ' ＝ ' + (kq + r) + ' 只是袋子裡的糖，別忘了加上剩下的 ' + r + ' 顆。'; }" },
    { file:'index', expect:'gCheckDone en', find:"return k + ' × ' + q + ' + ' + r + ' = ' + n + ': the dividend is '", replace:"return k + ' × ' + q + ' + ' + r + ' = ' + (n - r) + ': the dividend is '" },

    /* 直式 */
    { file:'index', expect:'the quotient would be one digit', find:'var GAME_LONG = [ { n:74, d:3 },', replace:'var GAME_LONG = [ { n:54, d:6 },' },
    { file:'index', expect:'nothing is left in the tens', find:'{ n:65, d:4 }, { n:96, d:4 },', replace:'{ n:85, d:4 }, { n:96, d:4 },' },
    { file:'index', expect:'no entry divides evenly', find:'{ n:96, d:4 }, { n:87, d:5 },', replace:'{ n:97, d:4 }, { n:87, d:5 },' },
    { file:'index', expect:'longSteps(', find:"    if (m2 >= 10) S.push({ k:'m', col:'t', row:'m2', v:Math.floor(m2 / 10), q:q2, d:d, m:m2, part:'t' });\n", replace:'' },
    { file:'index', expect:'longSteps(', find:"      { k:'b', col:'o', row:'s1', v:O },", replace:"      { k:'b', col:'o', row:'s1', v:s1 }," },
    { file:'index', expect:'should divide', find:"      { k:'q', col:'o', row:'q', v:q2, top:br, d:d }", replace:"      { k:'q', col:'o', row:'q', v:q2, top:O, d:d }" },
    { file:'index', expect:'the divisor touches the division bracket', find:'LONG_X = { div:96, t:156, o:208 }', replace:'LONG_X = { div:116, t:156, o:208 }' },
    { file:'index', expect:'closer than their drop pads', find:'LONG_X = { div:96, t:156, o:208 }', replace:'LONG_X = { div:96, t:156, o:204 }' },
    { file:'index', expect:'the digit cards reach the last box', find:'LONG_KEYS = { y:328, step:56, rowStep:56, size:48 }', replace:'LONG_KEYS = { y:310, step:56, rowStep:56, size:48 }' },
    { file:'index', expect:'long: digit cards', find:'LONG_KEYS = { y:328, step:56, rowStep:56, size:48 }', replace:'LONG_KEYS = { y:328, step:46, rowStep:56, size:48 }' },
    { file:'index', expect:'overlap', find:'LONG_Y = { q:28, n:80, m1:128, s1:176, m2:224, s2:272 }', replace:'LONG_Y = { q:28, n:80, m1:128, s1:166, m2:224, s2:272 }' },
    { file:'index', expect:'a box can be filled out of order', find:'        if (s.i !== next){ roundMiss(d.gLongOrder(d.gLongKinds[N.k])); return false; }', replace:'        if (s.i < next){ roundMiss(d.gLongOrder(d.gLongKinds[N.k])); return false; }' },
    { file:'index', expect:'other than "bring down"', find:"        if (P.data.bring && N.k !== 'b'){ roundMiss(d.gLongBringNot(LS.O)); return false; }\n", replace:'' },
    { file:'index', expect:'a wrong digit is accepted', find:'        if (v !== N.v){\n', replace:'        if (v === -1){\n' },
    { file:'index', expect:'too big or too small', find:'roundMiss(v * N.d > N.top ? d.gLongQBig(', replace:'roundMiss(v * N.d >= N.top ? d.gLongQBig(' },
    { file:'index', expect:'cards must never run out', find:'        else { P.home(); P.el.classList.remove', replace:'        else { P.lock(P.cx, P.cy); P.el.classList.remove' },
    { file:'index', expect:'zh card 0 gLongQSmall', find:"'，' + t + ' − ' + p + ' ＝ ' + rest + '，還夠再分一個 ' + d", replace:"'，' + t + ' − ' + p + ' ＝ ' + (rest + 1) + '，還夠再分一個 ' + d" },
    { file:'index', expect:'gLongM2 does not say "tens"', find:"' — this box takes its ' + (part === 't' ? 'tens' : 'ones') + ' digit", replace:"' — this box takes its ' + (part === 't' ? 'ones' : 'tens') + ' digit" },
    { file:'index', expect:'gLongDone zh', find:"'！驗算：' + d + ' × ' + q + ' ＋ ' + r + ' ＝ ' + n + '。'", replace:"'！驗算：' + d + ' × ' + q + ' ＋ ' + r + ' ＝ ' + (n + 1) + '。'" },
    { file:'index', expect:'en gLong2q', find:"return 'In ' + t + ', how many ' + d + 's fit? ' + q + ' × ' + d + ' = ' + p", replace:"return 'In ' + t + ', how many ' + d + 's fit? ' + q + ' × ' + d + ' = ' + (p + d)" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'should be 3 remainder 2', find:"why:'5 × 3 ＝ 15，17 − 15 ＝ 2，所以商 3 餘 2；", replace:"why:'5 × 3 ＝ 15，17 − 15 ＝ 2，所以 17 ÷ 5 ＝ 商 3、餘 3；" },
    { file:'index', expect:'should be 46', find:"why:'被除數 ＝ 除數 × 商 ＋ 餘數 ＝ 6 × 7 ＋ 4 ＝ 46", replace:"why:'被除數 ＝ 除數 × 商 ＋ 餘數 ＝ 6 × 7 ＋ 4 ＝ 48" },
    { file:'index', expect:'marked answer is', find:"{ stem:'17 ÷ 5 = ?', opts:['4 r 3', '2 r 7', '3 r 5', '3 r 2'], ans:3,", replace:"{ stem:'17 ÷ 5 = ?', opts:['4 r 3', '2 r 7', '3 r 5', '3 r 2'], ans:1," },

    /* ---- review.html ---- */
    { file:'review', expect:'is not a possible remainder', find:'        var m = mixOptsNum(k, [k - 1, k - 2, 0]);', replace:'        var m = mixOptsNum(k, [k - 1, k - 2, k + 1]);' },
    { file:'review', expect:'is copied straight out of the stem', find:'        var m = mixOptsNum(answer, [q, q + 2], [total, k]);', replace:'        var m = mixOptsNum(answer, [q, q + 2, total], [k]);' },
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'opts[ans] != correct', find:"        var dividend = k * q + r;\n        var m = mixOptsNum(dividend, [k * q,", replace:"        var dividend = k * q;\n        var m = mixOptsNum(dividend, [k * q + r," },
    { file:'review', expect:'the right (q, r) appears 2 times', find:'          { q:q - 1, r:r + k },', replace:'          { q:q - 1, r:r + k }, { q:q, r:r },' },
    { file:'review', expect:'option count', find:'          { q:q - 1, r:r + k },', replace:'' }
  ],

  sim: {
    blockStart: '  var TXT = {',
    INVARIANTS: {
      equalShare: d => {
        if (d.total !== d.n * d.per) return 'total != n*per';
        if (d.n < 2 || d.per < 2) return 'n and per must be at least 2';
      },
      groupPack: d => {
        if (d.total !== d.k * d.bags) return 'total != k*bags';
      },
      remainderCalc: d => {
        if (d.dividend !== d.k * d.q + d.r) return 'dividend != k*q + r';
        if (!(d.r >= 1 && d.r < d.k)) return 'remainder ' + d.r + ' is not 1..k-1';
        const right = d.tuples.filter(t => t.q === d.q && t.r === d.r);
        if (right.length !== 1) return 'the right (q, r) appears ' + right.length + ' times';
        if (d.tuples[d.ans].q !== d.q || d.tuples[d.ans].r !== d.r) return 'ans does not point at the right (q, r)';
        /* 每一個誘答都真的是錯的：k × q' + r' ≠ dividend，或者 r' ≥ k（那正是迷思） */
        for (const t of d.tuples){ if (t === d.tuples[d.ans]) continue; if (d.k * t.q + t.r === d.dividend && t.r < d.k) return 'distractor ' + t.q + ' r ' + t.r + ' is also correct'; if (t.q < 0 || t.r < 0) return 'negative distractor'; }
      },
      leftoverCount: d => {
        if (d.total !== d.k * d.q + d.r) return 'total != k*q + r';
        if (!(d.r >= 1 && d.r < d.k)) return 'remainder not 1..k-1';
      },
      roundUpTrip: d => {
        if (d.total !== d.k * d.q + d.r) return 'total != k*q + r';
        if (d.r < 1) return 'no one is left over — rounding up would be wrong';
        if (d.answer !== d.q + 1) return 'answer != q + 1';
      },
      reverseDividend: d => {
        if (d.dividend !== d.k * d.q + d.r) return 'dividend != k*q + r';
        if (!(d.r >= 1 && d.r < d.k)) return 'remainder not 1..k-1';
      },
      /* 「除以 k，餘數不可能是多少？」—— 正解 k；其他三個選項都必須是真的可能出現的餘數 0..k−1，不然一題有兩個正解 */
      maxRemainder: d => {
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          const o = +d.opts[i];
          if (!(isInt(o) && o >= 0 && o < d.k)) return 'option ' + d.opts[i] + ' is not a possible remainder of ÷ ' + d.k + ' — it is also an answer';
        }
      },
      verifyMultiply: d => {
        if (d.dividend !== d.k * d.q) return 'dividend != k*q';
      },
      shareFraction: d => {
        if (!(d.n >= 2)) return 'n must be at least 2';
        const val = s => { const m = String(s).match(/^(\d+)\/(\d+)$/); return m ? +m[1] / +m[2] : NaN; };
        for (let i = 0; i < d.opts.length; i++) if (i !== d.ans && Math.abs(val(d.opts[i]) - 1 / d.n) < 1e-9) return 'option ' + d.opts[i] + ' is also 1/' + d.n;
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'equalShare': return String(d.total / d.n);
        case 'groupPack': return String(d.total / d.k);
        case 'remainderCalc': return qr(Math.floor(d.dividend / d.k), d.dividend % d.k, lang);
        case 'leftoverCount': return String(d.total % d.k);
        case 'roundUpTrip': return String(Math.ceil(d.total / d.k));
        case 'reverseDividend': return String(d.k * d.q + d.r);
        case 'maxRemainder': return String(d.k);
        case 'verifyMultiply': return String(d.k * d.q);
        case 'shareFraction': return '1/' + d.n;
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'remainderCalc'){
        const m = lang === 'zh' ? s.match(/^商 (\d+)、餘 (\d+)$/) : s.match(/^(\d+) r (\d+)$/);
        if (!m) return 'option "' + s + '" is not a quotient-and-remainder in ' + lang;
        return;
      }
      if (genId === 'shareFraction'){ if (!/^[1-9]\d*\/[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a fraction'; return; }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      if (n > 99) return 'option ' + n + ' outside 0~99';
      if (n === 0 && genId !== 'maxRemainder') return 'option 0 makes no sense for ' + genId;
    },
    /* 刻意的迷思誘答：把「分成幾份」和「每份幾個」搞混（這一課的核心 —— 等分除與包含除），以及「剩下一整袋」。
       只放行那一個值；review.html 那一側用 avoidExcept() 各自獨立地說出同一件事。 */
    stemEchoOk: {
      equalShare: (d, opt) => String(opt) === String(d.n),
      groupPack: (d, opt) => String(opt) === String(d.k),
      leftoverCount: (d, opt) => String(opt) === String(d.k)
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「分裝出貨」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, PILE_STEP, PILE_DOT, pileDotXY, SHARE_H, SHARE_PLATE, SHARE_PILE, SHARE_TOKEN, GAME_SHARE, sharePlateX, shareDotXY, PACK_H, PACK_PILE, PACK_BAG, PACK_TOKEN, PACK_CAP, GAME_PACK, FIX_H, FIX_LBL, FIX_OLD, FIX_BOX, FIX_TRAY, GAME_FIX, fixOldX, fixBoxX, fixSlotXY, fixTrayXY, CHECK_H, CHECK_BAG, CHECK_LOOSE, CHECK_FACT, CHECK_EQ, CHECK_CARD, CHECK_TRAY, GAME_CHECK, checkBagX, checkLooseX, LONG_H, LONG_X, LONG_Y, LONG_SLOT, LONG_PAD, LONG_KEYS, GAME_LONG, longSteps}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
      [['17 ÷ 5 ＝ 商 3、餘 2', true], ['17 ÷ 5 ＝ 商 2、餘 7', false], ['35 ÷ 4 = 8 r 3', true], ['12 ÷ 3 = 4', true], ['12 ÷ 3 = 5', false],
       ['14 ÷ 4 = 3', false], ['6 × 7 ＋ 4 ＝ 46', true], ['6 × 7 ＋ 4 ＝ 42', false], ['28 − 24 ＝ 4', true], ['28 − 24 ＝ 5', false], ['4 ＋ 1 ＝ 5', true], ['5 × 6 ＋ 2 ＝ 32', true], ['28 ÷ 6 ＝ 商 4 餘 4', true], ['28 ÷ 6 ＝ 商 4 餘 3', false]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

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
      if (checkedEq < 40) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 直接寫成「a ÷ b ＝ ？」的題目：標的正解要等於自己算的商餘 */
      let qrStems = 0;
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const m = String(q.stem).replace(/<[^>]+>/g, '').match(/(\d+) ÷ (\d+) [＝=] [？?]/);
        if (!m) return;
        qrStems++;
        const want = qr(Math.floor(m[1] / m[2]), m[1] % m[2], L);
        if (q.opts[q.ans] !== want) fail(bank + '[' + i + '] ' + L + ': ' + m[1] + ' ÷ ' + m[2] + ' is "' + want + '", marked answer is "' + q.opts[q.ans] + '"');
      })));
      if (qrStems < 2) fail('no "a ÷ b = ?" quiz stem found in both languages — the quotient/remainder answer check is not reading them');

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['share', 'pack', 'fix', 'check', 'long'];
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
      /* 每一句說明：數字照順序逐個比，而且句子裡的每一條算式都要算得對 */
      const seq = (where, text, want, wrongOnPurpose) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        /* wrongOnPurpose：那一句本來就是錯的說法（小明的答案）—— 反過來要求它真的是錯的 */
        const bad = scanEquations(text).filter(e => e.bad);
        if (wrongOnPurpose){ if (!bad.length) fail(where + ': this is meant to be a wrong claim, but it adds up: ' + text); }
        else bad.forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_SHARE', 'GAME_PACK', 'GAME_FIX', 'GAME_CHECK', 'GAME_LONG'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。
         點目的地的格子（驗算與直式的空格）也要點得到：格子加上兩邊的 pad 至少 44。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the cookie (' + D.SHARE_TOKEN.size + ')', D.SHARE_TOKEN.size);
      tooSmall('the bag (' + D.PACK_TOKEN.size + ')', D.PACK_TOKEN.size);
      tooSmall('a check card (' + D.CHECK_CARD + ')', D.CHECK_CARD);
      tooSmall('a digit card (' + D.LONG_KEYS.size + ')', D.LONG_KEYS.size);
      tooSmall('a check box with its pad', D.CHECK_EQ.slot + 2 * 4);
      tooSmall('a long-division box with its pad', D.LONG_SLOT + 2 * D.LONG_PAD);
      [D.SHARE_TOKEN.size, D.PACK_TOKEN.size, D.CHECK_CARD, D.LONG_KEYS.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('fix', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:t\.x, cy:t\.y, text:'🍬'/, 'the candies are not GPICK × GPICK at fixTrayXY()');
      need('check', /addPiece\(B, \{ w:CHECK_CARD, h:CHECK_CARD, cx:cx, cy:cy,/, 'the cards are not CHECK_CARD × CHECK_CARD');

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
         ① 點在格子裡的，一定判給那一格（直式的格子上下只差 4px，放寬之後會重疊）
         ② 最近的那格已經放好了，就不收（不可以跳過它、改放進旁邊的空格）③ 離每一格都遠 → 不收 */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const h = D.LONG_SLOT / 2, cells = myLong(D.GAME_LONG[0].n, D.GAME_LONG[0].d).cells;
          const list = cells.map((c, i) => ({ id:i, cx:D.LONG_X[c[1]], cy:D.LONG_Y[c[2]], hw:h, hh:h, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, D.LONG_PAD); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a long-division box are given to another box (or none)');
          /* 大小不一樣的兩塊（補裝的袋子 vs 驗算的空格那種）：大塊裡、靠近小塊邊上的點要判給大塊 */
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }
      /* 一堆點：十個一排 */
      const myPile = (i, top) => ({ x:150 + ((i % 10) - 4.5) * D.PILE_STEP, y:top + Math.floor(i / 10) * D.PILE_STEP });
      if (D.PILE_STEP < D.PILE_DOT + 4) fail('pile dots ' + D.PILE_STEP + ' apart touch (dot ' + D.PILE_DOT + ')');
      const pileFits = (n, top, box, what) => {
        for (let i = 0; i < n; i++){
          const p = D.pileDotXY(i, top), m = myPile(i, top);
          if (!near(p.x, m.x) || !near(p.y, m.y)) return fail(what + ': pileDotXY(' + i + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          const r = D.PILE_DOT / 2;
          if (m.x - r < box.x + 2 || m.x + r > box.x + box.w - 2 || m.y - r < box.y + 2 || m.y + r > box.y + box.h - 2) return fail(what + ': dot ' + i + ' of ' + n + ' sticks out of the pile');
        }
      };

      /* --- 第 1 關：平分（範例 1 的等分除） --- */
      {
        const P = D.SHARE_PLATE, PB = D.SHARE_PILE, TK = D.SHARE_TOKEN;
        D.GAME_SHARE.forEach((e, i) => {
          const w = 'GAME_SHARE[' + i + ']';
          if (!isInt(e.n) || !isInt(e.g)) return fail(w + ' is not whole numbers');
          if (e.g < 2 || e.g > 4) fail(w + ': ' + e.g + ' plates — should be 2~4');
          if (e.n % e.g !== 0) return fail(w + ': ' + e.n + ' ÷ ' + e.g + ' does not share out evenly — this round has no remainder');
          const per = e.n / e.g;
          if (per < 2 || per > 5) fail(w + ': ' + per + ' per plate — should be 2~5 (a plate holds 3 rows of 2)');
          pileFits(e.n, PB.top, PB, w);
          const plates = [];
          for (let k = 0; k < e.g; k++){
            const cx = 150 + (k - (e.g - 1) / 2) * (P.w + P.gap);
            if (!near(D.sharePlateX(e.g, k), cx)) fail(w + ': sharePlateX(' + e.g + ', ' + k + ') should be ' + cx);
            plates.push(sq(cx, P.y, P.w, P.h));
          }
          plates.forEach((r, k) => inside(r, w + ' plate ' + k, W, D.SHARE_H)); noHits(plates, w + ': plates');
          /* 遊戲的規則（一盤只在片數最少時收）從頭玩到尾：每一個狀態都有盤子收、收完一定一樣多 */
          const seen = new Set(), stack = [Array(e.g).fill(0)];
          let ends = 0;
          while (stack.length){
            const c = stack.pop(), key = c.join(); if (seen.has(key)) continue; seen.add(key);
            const sum = c.reduce((x, y) => x + y, 0), min = Math.min(...c);
            if (sum === e.n){ ends++; if (!c.every(x => x === per)) fail(w + ': the dealing rule can end unequal: ' + key); continue; }
            const ok = c.map((x, k) => k).filter(k => c[k] === min);
            if (!ok.length) fail(w + ': stuck at ' + key);
            ok.forEach(k => { const nx = c.slice(); nx[k]++; stack.push(nx); });
          }
          if (!ends) fail(w + ': the dealing never finishes');
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let left = 0; left <= e.n; left++) seq(w + ' gShareNow ' + L, d.gShareNow(e.n, e.g, left), [e.n, e.g, left]);
            for (let m = 0; m < per; m++){ seq(w + ' gShareAhead ' + L, d.gShareAhead(m + 1, m), [m + 1, m]); seq(w + ' gShare2 ' + L, d.gShare2(m), [m]); }
            seq(w + ' gShareDone ' + L, d.gShareDone(e.n, e.g, per), [e.n, e.g, per, per]);
            for (let k = 1; k <= e.g; k++) seq(w + ' gSharePlate ' + L, d.gSharePlate(k), [k]);
          });
        });
        /* 盤子裡的餅乾：兩片一排、在盤子裡、不碰到數字、不互相碰到 */
        const dotsIn = [];
        for (let k = 0; k < 5; k++){
          const p = D.shareDotXY(k), m = { x:P.w / 2 + ((k % 2) - 0.5) * P.step, y:P.top + D.PILE_DOT / 2 + Math.floor(k / 2) * P.step };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('shareDotXY(' + k + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          dotsIn.push(sq(m.x, m.y, D.PILE_DOT));
          if (m.x - 8 < 4 || m.x + 8 > P.w - 4 || m.y + 8 > P.h - 32) fail('share: cookie ' + (k + 1) + ' on a plate runs into the edge or the count');
        }
        noHits(dotsIn, 'share: cookies on a plate');
        if (P.y + P.h / 2 + 6 > PB.y) fail('share: the plates (with their drop pad) reach the cookie pile');
        if (PB.y + PB.h > TK.y - TK.size / 2 - 4) fail('share: the pile overlaps the cookie you drag');
        inside(sq(150, TK.y, TK.size), 'share: the cookie', W, D.SHARE_H);
        need('share', /var e = pick\(GAME_SHARE\), per = e\.n \/ e\.g, left = e\.n/, 'the share is not n ÷ g');
        need('share', /if \(pl\.n > min\)\{ roundMiss\(d\.gShareAhead\(pl\.n, min\)\); return false; \}/, 'a plate that is ahead accepts a cookie (sharing equally means taking turns)');
        need('share', /addDot\(pl\.el, shareDotXY\(pl\.n\)\);\s*pl\.n\+\+; pl\.num\.textContent = pl\.n;\s*left--; dots\[left\]\.style\.visibility = 'hidden';/, 'a dealt cookie is not drawn on the plate and taken off the pile');
        need('share', /if \(left === 0\)\{\s*P\.lock\(P\.homeX, P\.homeY\); P\.el\.classList\.add\('gone'\);\s*roundSolved\(d\.gShareDone\(e\.n, e\.g, per\)\);/, 'the round is not solved exactly when the pile is empty');
        need('share', /var p = pileDotXY\(k, SHARE_PILE\.top\); dots\.push\(addDot\(pz, \{ x:p\.x - SHARE_PILE\.x, y:p\.y - SHARE_PILE\.y \}\)\);/, 'the pile is not drawn with pileDotXY()');
        need('share', /var cx = sharePlateX\(e\.g, i\);/, 'the plates are not drawn at sharePlateX()');
      }

      /* --- 第 2 關：裝袋（範例 1 的包含除＋範例 2 的餘數） --- */
      {
        const A = D.PACK_PILE, BG = D.PACK_BAG, TK = D.PACK_TOKEN, CP = D.PACK_CAP;
        let anyZero = false, anyMax = false;
        D.GAME_PACK.forEach((e, i) => {
          const w = 'GAME_PACK[' + i + ']';
          if (!isInt(e.n) || !isInt(e.k)) return fail(w + ' is not whole numbers');
          const q = Math.floor(e.n / e.k), r = e.n % e.k;
          if (e.k < 3 || e.k > 6) fail(w + ': ' + e.k + ' per bag — should be 3~6');
          if (q < 2 || q > 5) fail(w + ': ' + q + ' bags — should be 2~5 (the bag row holds 5)');
          if (e.n > 30) fail(w + ': ' + e.n + ' candies — the pile holds 3 rows of 10');
          if (r === 0) anyZero = true;
          if (r === e.k - 1) anyMax = true;
          pileFits(e.n, A.top, A, w);
          for (let b = 0; b < q; b++) inside(sq(BG.x0 + b * BG.step, BG.y, BG.w, BG.h), w + ' bag ' + b, W, D.PACK_H);
          /* 照遊戲的規則從頭玩：還有 k 顆以上就一定要再裝（「裝完了」不收），不到 k 顆就不能再裝 */
          let left = e.n, bags = 0;
          while (left >= e.k){ left -= e.k; bags++; }
          if (bags !== q || left !== r) fail(w + ': packing ends at ' + bags + ' bags, ' + left + ' left — not ' + q + ' r ' + r);
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let b = 0; b <= q; b++){
              const lf = e.n - b * e.k;
              seq(w + ' gPackNow ' + L, d.gPackNow(e.n, e.k, b, lf), [e.n, e.k, b, lf]);
              seq(w + ' gPack2 ' + L, d.gPack2(lf, e.k), [lf, e.k]);
              if (lf >= e.k) seq(w + ' gPackMore ' + L, d.gPackMore(lf, e.k), [lf, e.k]);
            }
            if (r) seq(w + ' gPackShort ' + L, d.gPackShort(r, e.k), [r, e.k]);
            seq(w + ' gPackDone ' + L, d.gPackDone(e.n, e.k, q, r), r ? [e.n, e.k, q, r, q, r, e.k] : [e.n, e.k, q, q]);
            seq(w + ' gPackCap ' + L, d.gPackCap(e.k), [e.k]);
            seq(w + ' gPackTok ' + L, d.gPackTok(e.k), [e.k]);
          });
          /* 「裝完了」那一句只在不到一袋時出現；還夠一袋時，提示要說「再裝一袋」 */
          LANGS.forEach(L => { if (I18N[L].gPack2(e.k, e.k) === I18N[L].gPack2(e.k - 1, e.k).replace(String(e.k - 1), String(e.k))) fail(w + ': gPack2 ' + L + ' says the same thing with a full bag left and without one'); });
        });
        if (!anyZero) fail('GAME_PACK: no entry divides evenly — "nothing left over" is never practised');
        if (!anyMax) fail('GAME_PACK: no entry leaves k − 1 — the biggest possible remainder is never practised');
        if (BG.step < BG.w + 4) fail('pack: bags ' + BG.step + ' apart overlap (bag ' + BG.w + ')');
        if (BG.y - BG.h / 2 < A.y + A.h + 6) fail('pack: the bag row overlaps the pile (or its drop pad)');
        const tok = sq(TK.x, TK.y, TK.size), cap = { x:CP.x, y:CP.y, w:CP.w, h:CP.h };
        if (BG.y + BG.h / 2 > Math.min(tok.y, cap.y) - 4) fail('pack: the bag row overlaps the bag you drag or its label');
        if (hit(tok, cap)) fail('pack: the bag you drag overlaps "per bag" label');
        inside(tok, 'pack: the bag', W, D.PACK_H); inside(cap, 'pack: the label', W, D.PACK_H);
        if (Math.abs(TK.y - (A.y + A.h / 2)) <= A.h / 2 + 6) fail('pack: the bag at home is already on the pile');
        need('pack', /if \(left < e\.k\)\{ roundMiss\(d\.gPackShort\(left, e\.k\)\); return false; \}/, 'a bag that cannot be filled is accepted');
        need('pack', /if \(left >= e\.k\)\{ roundMiss\(d\.gPackMore\(left, e\.k\)\); return; \}/, '"done" is accepted while a full bag is still possible');
        need('pack', /for \(var j = 0; j < e\.k; j\+\+\) dots\[left - 1 - j\]\.style\.visibility = 'hidden';\s*left -= e\.k; bags\+\+;/, 'a bag does not take exactly k candies');
        need('pack', /if \(left === 0\) finish\(\);/, 'an even split does not finish on its own');
        need('pack', /roundSolved\(d\.gPackDone\(e\.n, e\.k, bags, left\)\);/, 'the result is not read from the bags and the leftovers');
        need('pack', /var bz = addZone\(B, BG\.x0 \+ \(bags - 1\) \* BG\.step - BG\.w \/ 2, BG\.y - BG\.h \/ 2, BG\.w, BG\.h, 'gbag'\);/, 'cannot read where the packed bags are drawn');
        need('pack', /if \(!nearestOpen\(\[pile\], pt, 6\)\) return false;/, 'a drop away from the pile is not silent');
      }

      /* --- 第 3 關：補裝（範例 2：餘數一定比除數小） --- */
      {
        const FB = D.FIX_BOX, FO = D.FIX_OLD, FT = D.FIX_TRAY;
        let anyZero = false, anyTwo = false;
        D.GAME_FIX.forEach((e, i) => {
          const w = 'GAME_FIX[' + i + ']';
          if (![e.k, e.q0, e.L].every(isInt)) return fail(w + ' is not whole numbers');
          const n = e.k * e.q0 + e.L, q = Math.floor(n / e.k), r = n % e.k, more = Math.floor(e.L / e.k), nb = more + 1;
          if (e.k < 3 || e.k > 5) fail(w + ': ' + e.k + ' per bag — should be 3~5 (a bag holds 2 rows of 3)');
          if (e.q0 < 1 || e.q0 > 4) fail(w + ': Max packed ' + e.q0 + ' bags — should be 1~4');
          if (e.L < e.k) fail(w + ': Max\'s remainder ' + e.L + ' is already smaller than ' + e.k + ' — there is nothing to fix');
          if (e.L > 2 * FT.perRow) fail(w + ': ' + e.L + ' leftover candies do not fit two rows of ' + FT.perRow);
          if (nb > 3) fail(w + ': ' + nb + ' empty bags do not fit');
          if (r === 0) anyZero = true;
          if (more >= 2) anyTwo = true;
          if (q !== e.q0 + more || r !== e.L - more * e.k) fail(w + ': the arithmetic of the fix is off');
          /* 照遊戲的規則把每一種玩法都走一遍：一次一袋、裝滿才算、剩不到一袋不能開新袋、半袋時不能按「分好了」 */
          const seen = new Set(), stack = [[e.L, 0, e.q0, 0]];   /* left, 正在裝的那一袋裡有幾顆, 袋數, 用掉幾個空袋 */
          let ends = 0;
          while (stack.length){
            const [left, cur, bags, used] = stack.pop(), key = [left, cur, bags, used].join(); if (seen.has(key)) continue; seen.add(key);
            const moves = [];
            if (cur > 0 && left > 0) moves.push([left - 1, cur + 1 === e.k ? 0 : cur + 1, cur + 1 === e.k ? bags + 1 : bags, used]);
            if (cur === 0 && left >= e.k && used < nb) moves.push([left - 1, 1, bags, used + 1]);
            if (cur === 0 && left < e.k){ ends++; if (bags !== q || left !== r) fail(w + ': can finish at ' + bags + ' bags, ' + left + ' left'); continue; }
            if (!moves.length) { fail(w + ': stuck at ' + key); continue; }
            moves.forEach(m => stack.push(m));
          }
          if (!ends) fail(w + ': can never be finished');
          if (more > nb - 1) fail(w + ': not enough empty bags');
          /* 版面：舊袋子、空袋子在畫板裡不重疊；袋子裡的格子不出界；剩下的糖果兩排不重疊 */
          const olds = []; for (let b = 0; b < e.q0; b++){ const cx = 150 + (b - (e.q0 - 1) / 2) * FO.step; if (!near(D.fixOldX(e.q0, b), cx)) fail(w + ': fixOldX(' + e.q0 + ', ' + b + ') should be ' + cx); olds.push(sq(cx, FO.y, FO.w, FO.h)); }
          olds.forEach((o, b) => inside(o, w + ' old bag ' + b, W, D.FIX_H)); noHits(olds, w + ': old bags');
          const boxes = []; for (let b = 0; b < nb; b++){ const cx = 150 + (b - (nb - 1) / 2) * (FB.w + FB.gap); if (!near(D.fixBoxX(nb, b), cx)) fail(w + ': fixBoxX(' + nb + ', ' + b + ') should be ' + cx); boxes.push(sq(cx, FB.y, FB.w, FB.h)); }
          boxes.forEach((o, b) => inside(o, w + ' empty bag ' + b, W, D.FIX_H)); noHits(boxes, w + ': empty bags');
          if (FB.gap < 12) fail('fix: empty bags closer than 12 — their drop pads (6 each) touch');
          const slots = [];
          for (let s = 0; s < e.k; s++){
            const rows = Math.ceil(e.k / 3), inRow = Math.min(3, e.k - Math.floor(s / 3) * 3);
            const m = { x:FB.w / 2 + ((s % 3) - (inRow - 1) / 2) * FB.step, y:FB.h / 2 + (Math.floor(s / 3) - (rows - 1) / 2) * FB.step }, p = D.fixSlotXY(e.k, s);
            if (!near(p.x, m.x) || !near(p.y, m.y)) fail(w + ': fixSlotXY(' + e.k + ', ' + s + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
            const r0 = sq(m.x, m.y, D.PILE_DOT);
            if (r0.x < 4 || r0.y < 4 || r0.x + r0.w > FB.w - 4 || r0.y + r0.h > FB.h - 4) fail(w + ': slot ' + s + ' sticks out of the bag');
            slots.push(r0);
          }
          noHits(slots, w + ': slots in a bag');
          const tray = [];
          for (let c = 0; c < e.L; c++){
            const row = Math.floor(c / FT.perRow), inRow = Math.min(FT.perRow, e.L - row * FT.perRow);
            const m = { x:150 + ((c % FT.perRow) - (inRow - 1) / 2) * FT.step, y:FT.y + row * FT.step }, p = D.fixTrayXY(c, e.L);
            if (!near(p.x, m.x) || !near(p.y, m.y)) fail(w + ': fixTrayXY(' + c + ', ' + e.L + ') should be ' + JSON.stringify(m));
            tray.push(sq(m.x, m.y, D.GPICK));
          }
          tray.forEach((o, c) => inside(o, w + ' candy ' + c, W, D.FIX_H)); noHits(tray, w + ': leftover candies');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gFixClaim ' + L, d.gFixClaim(n, e.k, e.q0, e.L), [n, e.k, e.q0, e.L], true);
            for (let j = 0; j <= more; j++){
              const lf = e.L - j * e.k;
              seq(w + ' gFixNow ' + L, d.gFixNow(n, e.k, e.q0 + j, lf), [n, e.k, e.q0 + j, lf]);
              seq(w + ' gFix2 ' + L, d.gFix2(lf, e.k, 0), [lf, e.k]);
              if (lf >= e.k) seq(w + ' gFixMore ' + L, d.gFixMore(lf, e.k), [lf, e.k, e.k]);
            }
            for (let h = 1; h < e.k; h++){
              seq(w + ' gFixFinish ' + L, d.gFixFinish(h, e.k), [h, e.k]);
              seq(w + ' gFixPartial ' + L, d.gFixPartial(h, e.k), [h, e.k]);
              seq(w + ' gFix2(need) ' + L, d.gFix2(e.L, e.k, e.k - h), [e.k - h]);
            }
            if (r) seq(w + ' gFixShort ' + L, d.gFixShort(r, e.k), [r, e.k]);
            seq(w + ' gFixDone ' + L, d.gFixDone(n, e.k, q, r), r ? [n, e.k, q, r, r, e.k] : [n, e.k, q, q]);
          });
        });
        if (!anyZero) fail('GAME_FIX: no entry ends with nothing left over');
        if (!anyTwo) fail('GAME_FIX: no entry needs two more bags — "the leftovers fill one bag, so stop" would always be right');
        if (FO.step < FO.w + 4) fail('fix: old bags overlap');
        if (D.FIX_LBL.y + D.FIX_LBL.h > FO.y - FO.h / 2 - 2) fail('fix: Max\'s claim overlaps his bags');
        if (FO.y + FO.h / 2 > FB.y - FB.h / 2 - 8) fail('fix: Max\'s bags reach the empty bags');
        if (FB.y + FB.h / 2 + 6 > FT.y - D.GPICK / 2 - 4) fail('fix: the empty bags (with their drop pad) reach the candies');
        if (FT.step < D.GPICK + 4) fail('fix: candies ' + FT.step + ' apart touch');
        need('fix', /var nb = Math\.floor\(e\.L \/ e\.k\) \+ 1, boxes = \[\];/, 'the empty bags are not one more than needed');
        need('fix', /if \(bx !== cur\)\{\s*if \(cur\)\{ roundMiss\(d\.gFixFinish\(cur\.n, e\.k\)\); return false; \}\s*if \(left < e\.k\)\{ roundMiss\(d\.gFixShort\(left, e\.k\)\); return false; \}\s*cur = bx;\s*\}/, 'a second bag can be started before the first is full, or a bag that cannot be filled can be started');
        need('fix', /if \(cur\)\{ roundMiss\(d\.gFixPartial\(cur\.n, e\.k\)\); return; \}\s*if \(left >= e\.k\)\{ roundMiss\(d\.gFixMore\(left, e\.k\)\); return; \}\s*finish\(\);/, '"all sorted" is accepted with a half-full bag or a remainder that is too big');
        need('fix', /if \(bx\.n === e\.k\)\{ bx\.done = true; bx\.el\.classList\.add\('full'\); bags\+\+; cur = null; \}/, 'a bag is not counted exactly when it holds k');
        need('fix', /roundSolved\(d\.gFixDone\(n, e\.k, bags, left\)\);/, 'the result is not read from the bags and the leftovers');
        need('fix', /var e = pick\(GAME_FIX\), n = e\.k \* e\.q0 \+ e\.L, left = e\.L, bags = e\.q0/, 'the total is not k × q0 + L');
      }

      /* --- 第 4 關：驗算（範例 3） --- */
      {
        const CB = D.CHECK_BAG, EQ = D.CHECK_EQ, TR = D.CHECK_TRAY, CD = D.CHECK_CARD;
        const maxLen = +((B.check.match(/inp\.maxLength = (\d+);/) || [])[1]);
        if (!maxLen) fail('check: cannot read the answer box maxLength');
        D.GAME_CHECK.forEach((e, i) => {
          const w = 'GAME_CHECK[' + i + ']';
          if (![e.k, e.q, e.r].every(isInt)) return fail(w + ' is not whole numbers');
          const n = e.k * e.q + e.r, kq = e.k * e.q;
          if (e.k < 3 || e.k > 9) fail(w + ': divisor ' + e.k + ' should be 3~9');
          if (e.q < 2 || e.q > 6) fail(w + ': ' + e.q + ' bags — the picture holds 2~6');
          if (!(e.r >= 1 && e.r < e.k)) fail(w + ': remainder ' + e.r + ' should be 1~' + (e.k - 1) + ' (smaller than the divisor, and not 0 — "forgot the remainder" must be a different number)');
          if (new Set([e.k, e.q, e.r]).size !== 3) fail(w + ': the three cards ' + [e.k, e.q, e.r].join(',') + ' are not all different');
          if (String(n).length > maxLen) fail(w + ': the dividend ' + n + ' does not fit the ' + maxLen + '-digit answer box');
          const bags = []; for (let b = 0; b < e.q; b++){ const cx = 150 + (b - (e.q - 1) / 2) * CB.step; if (!near(D.checkBagX(e.q, b), cx)) fail(w + ': checkBagX should be ' + cx); bags.push(sq(cx, CB.y, CB.w, CB.h)); }
          bags.forEach((o, b) => inside(o, w + ' bag ' + b, W, D.CHECK_H)); noHits(bags, w + ': bags');
          const dots = []; for (let k = 0; k < e.r; k++){ const cx = 150 + (k - (e.r - 1) / 2) * D.CHECK_LOOSE.step; if (!near(D.checkLooseX(e.r, k), cx)) fail(w + ': checkLooseX should be ' + cx); dots.push(sq(cx, D.CHECK_LOOSE.y, D.PILE_DOT)); }
          dots.forEach((o, k) => inside(o, w + ' loose candy ' + k, W, D.CHECK_H)); noHits(dots, w + ': loose candies');
          /* 照規則：× 兩格收 k 或 q（順序不拘）、＋ 收 r。每一種排得出來的算式都要等於被除數 */
          const perms = [[e.k, e.q, e.r], [e.q, e.k, e.r], [e.r, e.k, e.q], [e.k, e.r, e.q], [e.q, e.r, e.k], [e.r, e.q, e.k]];
          const okPerms = perms.filter(p => p[0] !== e.r && p[1] !== e.r && p[2] === e.r);
          if (okPerms.length !== 2 || okPerms.some(p => p[0] * p[1] + p[2] !== n)) fail(w + ': the accepted number sentences do not all make ' + n);
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gCheckFact ' + L, d.gCheckFact(e.k, e.q, e.r, null), [e.k, e.q, e.r]);
            seq(w + ' gCheckFact(n) ' + L, d.gCheckFact(e.k, e.q, e.r, n), [n, e.k, e.q, e.r]);
            okPerms.forEach(p => { seq(w + ' gCheckNow ' + L, d.gCheckNow(p[0], p[1], p[2], null), p); seq(w + ' gCheckNow(n) ' + L, d.gCheckNow(p[0], p[1], p[2], n), p.concat([n])); });
            seq(w + ' gCheckNow(empty) ' + L, d.gCheckNow(null, null, null, null), []);
            seq(w + ' gCheckRemTimes ' + L, d.gCheckRemTimes(e.r), [e.r]);
            [e.k, e.q].forEach(v => seq(w + ' gCheckPlusNot ' + L, d.gCheckPlusNot(v, e.r), [e.r, v]));
            seq(w + ' gCheckForgot ' + L, d.gCheckForgot(e.k, e.q, kq, e.r), [e.k, e.q, kq, e.r]);
            [n - 1, n + 1, n + e.k, 7].forEach(v => seq(w + ' gCheckWrong ' + L, d.gCheckWrong(e.k, e.q, kq, e.r, v), [v, e.k, e.q, kq, e.r]));
            seq(w + ' gCheck2 ' + L, d.gCheck2(e.k, e.q, kq, e.r), [e.q, e.k, e.k, e.q, kq, e.r]);
            seq(w + ' gCheckDone ' + L, d.gCheckDone(e.k, e.q, e.r, n), [e.k, e.q, e.r, n, n, n, e.k, e.q, e.r]);
          });
        });
        /* 算式那一排：三格、三個符號、答案格在畫板裡、互不重疊；格子之間的距離放得下符號 */
        const h = EQ.slot / 2, row = [];
        EQ.x.forEach((x, s) => row.push(sq(x, EQ.y, EQ.slot)));
        EQ.ops.forEach(x => row.push({ x:x - 10, y:EQ.y - h, w:20, h:EQ.slot }));
        row.push({ x:EQ.res.x - EQ.res.w / 2, y:EQ.y - h, w:EQ.res.w, h:EQ.slot });
        row.forEach((o, k) => inside(o, 'check: number sentence part ' + k, W, D.CHECK_H)); noHits(row, 'check: number sentence parts');
        for (let s = 1; s < 3; s++) if (EQ.x[s] - EQ.x[s - 1] < EQ.slot + 2 * 4 + 6) fail('check: boxes ' + (s - 1) + ' and ' + s + ' — their drop pads touch');
        if (!(EQ.ops[0] > EQ.x[0] && EQ.ops[0] < EQ.x[1] && EQ.ops[1] > EQ.x[1] && EQ.ops[1] < EQ.x[2] && EQ.ops[2] > EQ.x[2] && EQ.ops[2] < EQ.res.x)) fail('check: the ×, ＋, ＝ signs are not between the boxes');
        if (D.CHECK_FACT.y < Math.max(CB.y + CB.h / 2, D.CHECK_LOOSE.y + D.PILE_DOT / 2) + 2) fail('check: the fact line overlaps the picture');
        if (D.CHECK_FACT.y + D.CHECK_FACT.h > EQ.y - h - 4 - 4) fail('check: the fact line reaches the boxes');
        const tray = [0, 1, 2].map(k => sq((W - 2 * TR.step) / 2 + k * TR.step, TR.y, CD));
        tray.forEach((o, k) => inside(o, 'check: card ' + k, W, D.CHECK_H)); noHits(tray, 'check: cards');
        if (TR.y - CD / 2 < EQ.y + h + 4 + 4) fail('check: the card tray reaches the boxes');
        need('check', /var e = pick\(GAME_CHECK\), n = e\.k \* e\.q \+ e\.r, kq = e\.k \* e\.q/, 'the dividend is not k × q + r');
        need('check', /return \{ kind:s < 2 \? 'x' : 'p',/, 'the first two boxes are not the × boxes');
        need('check', /if \(s\.kind === 'x' && v === e\.r\)\{ roundMiss\(d\.gCheckRemTimes\(e\.r\)\); return false; \}/, 'the remainder is accepted in a × box');
        need('check', /if \(s\.kind === 'p' && v !== e\.r\)\{ roundMiss\(d\.gCheckPlusNot\(v, e\.r\)\); return false; \}/, 'something other than the remainder is accepted after ＋');
        need('check', /renderTray\(B, \[e\.k, e\.q, e\.r\], CHECK_TRAY\.y,/, 'the cards are not k, q and r');
        need('check', /if \(v === n\)\{/, 'the typed dividend is not compared with k × q + r');
        need('check', /else if \(v === kq\) roundMiss\(d\.gCheckForgot\(e\.k, e\.q, kq, e\.r\)\);\s*else roundMiss\(d\.gCheckWrong\(e\.k, e\.q, kq, e\.r, v\)\);/, 'a wrong dividend is accepted, or forgetting the remainder has no reason of its own');
        need('check', /var t = inp\.value\.trim\(\);[\s\S]*?if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\)\)\{ gMsg\.textContent = d\.gCheckEmpty; return; \}/, 'an empty or malformed answer ("3 4", "034") is counted as a mistake or read as a number');
        need('fix', /candies\.forEach\(function\(P\)\{ if \(!P\.locked\) P\.lock\(P\.homeX, P\.homeY\); \}\);/, 'a candy being dragged when the round ends is locked where it was, not sent home');
        need('check', /if \(gSolved \|\| filled < 3\) return;/, 'the answer can be checked before the number sentence is built');
        need('check', /var h = EQ\.slot \/ 2;[\s\S]*?var z = addZone\(B, EQ\.x\[s\] - h, EQ\.y - h, EQ\.slot, EQ\.slot, 'gslot'\);/, 'cannot read where the boxes are drawn');
        need('check', /var s = nearestOpen\(slots, pt, 4\);/, 'the check boxes do not use a pad of 4');
      }

      /* --- 第 5 關：直式（範例 4） --- */
      {
        const X = D.LONG_X, Y = D.LONG_Y, h = D.LONG_SLOT / 2, KY = D.LONG_KEYS;
        let anyZero = false, anyRem = false;
        D.GAME_LONG.forEach((e, i) => {
          const w = 'GAME_LONG[' + i + ']';
          if (!isInt(e.n) || !isInt(e.d)) return fail(w + ' is not whole numbers');
          if (e.n < 10 || e.n > 99 || e.d < 2 || e.d > 9) return fail(w + ': should be a two-digit number ÷ a one-digit number');
          const M = myLong(e.n, e.d);
          if (M.q1 < 1) fail(w + ': the tens digit ' + M.T + ' is smaller than ' + e.d + ' — the quotient would be one digit');
          if (M.s1 < 1) fail(w + ': nothing is left in the tens — "bring down" would make a one-digit number');
          if (M.m2 < 10) fail(w + ': the second product ' + M.m2 + ' is one digit');
          if (M.Q * e.d + M.R !== e.n || M.R >= e.d) fail(w + ': my own long division is off');
          if (M.R === 0) anyZero = true; else anyRem = true;
          const LS = D.longSteps(e.n, e.d);
          const theirs = LS.steps.map(s => [s.k, s.col, s.row, s.v].join(':')).join(), mine = M.cells.map(c => c.join(':')).join();
          if (theirs !== mine) fail(w + ': longSteps(' + e.n + ', ' + e.d + ') is ' + theirs + ', should be ' + mine);
          if (LS.Q !== M.Q || LS.R !== M.R || LS.T !== M.T || LS.O !== M.O) fail(w + ': longSteps() result is ' + LS.Q + ' r ' + LS.R + ', should be ' + M.Q + ' r ' + M.R);
          /* 每一格的數字，和那一格要說的理由 */
          const ctx = [{ top:M.T, q:M.q1 }, { q:M.q1, m:M.m1, part:'' }, { a:M.T, b:M.m1 }, {}, { top:M.br, q:M.q2 }]
            .concat(M.m2 >= 10 ? [{ q:M.q2, m:M.m2, part:'t' }] : []).concat([{ q:M.q2, m:M.m2, part:M.m2 >= 10 ? 'o' : '' }, { a:M.br, b:M.m2 }]);
          LS.steps.forEach((s, k) => {
            const c = ctx[k];
            if (s.k === 'q' && (s.top !== c.top || s.d !== e.d)) fail(w + ': step ' + k + ' divides ' + s.top + ', should divide ' + c.top);
            if (s.k === 'm' && (s.q !== c.q || s.m !== c.m || s.part !== c.part || s.d !== e.d)) fail(w + ': step ' + k + ' is ' + s.q + ' × ' + s.d + ' = ' + s.m + ' (' + s.part + '), should be ' + c.q + ' × ' + e.d + ' = ' + c.m + ' (' + c.part + ')');
            if (s.k === 's' && (s.a !== c.a || s.b !== c.b)) fail(w + ': step ' + k + ' subtracts ' + s.a + ' − ' + s.b + ', should be ' + c.a + ' − ' + c.b);
          });
          /* 版面：每一格在畫板裡、互不重疊；數字卡在最下面那一格下面 */
          const boxes = M.cells.map(c => sq(X[c[1]], Y[c[2]], D.LONG_SLOT));
          boxes.forEach((o, k) => inside(o, w + ' box ' + k, W, D.LONG_H)); noHits(boxes, w + ': boxes');
          const lowest = Math.max(...M.cells.map(c => Y[c[2]]));
          if (KY.y - KY.size / 2 < lowest + h + D.LONG_PAD + 4) fail(w + ': the digit cards reach the last box');
          LANGS.forEach(L => {
            const d = I18N[L];
            ['q', 'm', 's', 'b'].forEach(k => { if (typeof d.gLongKinds[k] !== 'string' || !d.gLongKinds[k]) fail('gLongKinds.' + k + ' missing in ' + L); else { seq(w + ' gLongNow ' + L, d.gLongNow(e.n, e.d, d.gLongKinds[k]), [e.n, e.d]); if (d.gLongOrder(d.gLongKinds[k]).indexOf(d.gLongKinds[k]) < 0) fail('gLongOrder ' + L + ' does not name the step'); } });
            seq(w + ' gLongLine ' + L, d.gLongLine(e.n, e.d, M.Q, M.R), M.R ? [e.n, e.d, M.Q, M.R] : [e.n, e.d, M.Q]);
            seq(w + ' gLongDone ' + L, d.gLongDone(e.n, e.d, M.Q, M.R), M.R ? [e.n, e.d, M.Q, M.R, e.d, M.Q, M.R, e.n] : [e.n, e.d, M.Q, e.d, M.Q, e.n]);
            seq(w + ' gLongBringNot ' + L, d.gLongBringNot(M.O), [M.O]);
            seq(w + ' gLongBringTok ' + L, d.gLongBringTok(M.O), [M.O]);
            M.cells.forEach((cell, k) => {
              const [kind, , , v] = cell, c = ctx[k], tag = w + ' step ' + k + ' ' + L;
              if (kind === 'q') seq(tag + ' gLong2q', d.gLong2q(c.top, e.d, v, v * e.d), [c.top, e.d, v, e.d, v * e.d, c.top]);
              if (kind === 'm') seq(tag + ' gLong2m', d.gLong2m(c.q, e.d, c.m), [c.q, e.d, c.m]);
              if (kind === 's') seq(tag + ' gLong2s', d.gLong2s(c.a, c.b, v), [c.a, c.b, v]);
              if (kind === 'b') seq(tag + ' gLong2b', d.gLong2b(v), [v]);
              /* 每一張錯的數字卡 */
              for (let x = 0; x <= 9; x++){
                if (x === v) continue;
                const t2 = tag + ' card ' + x;
                if (kind === 'q'){
                  /* 自己的判斷：比正確的商大 → 乘出來超過；比較小 → 減完還夠再分一個 */
                  if (x > v) seq(t2 + ' gLongQBig', d.gLongQBig(c.top, e.d, x, x * e.d), [x, e.d, x * e.d, c.top]);
                  else seq(t2 + ' gLongQSmall', d.gLongQSmall(c.top, e.d, x, x * e.d, c.top - x * e.d), [x, e.d, x * e.d, c.top, x * e.d, c.top - x * e.d, e.d]);
                  if (x > v && !(x * e.d > c.top)) fail(t2 + ': a quotient ' + x + ' that is too big does not go over ' + c.top);
                  if (x < v && !(c.top - x * e.d >= e.d)) fail(t2 + ': a quotient ' + x + ' that is too small does not leave room for another ' + e.d);
                }
                if (kind === 'm'){
                  if (c.part){
                    const txt = d.gLongM2(c.q, e.d, c.m, c.part, x);
                    seq(t2 + ' gLongM2', txt, [c.q, e.d, c.m, x]);
                    const word = L === 'zh' ? (c.part === 't' ? '十位' : '個位') : (c.part === 't' ? 'tens' : 'ones');
                    if (txt.indexOf(word) < 0) fail(t2 + ': gLongM2 does not say "' + word + '"');
                  } else seq(t2 + ' gLongM', d.gLongM(c.q, e.d, c.m, x), [c.q, e.d, c.m, x]);
                }
                if (kind === 's') seq(t2 + ' gLongS', d.gLongS(c.a, c.b, v, x), [c.a, c.b, v, x]);
                if (kind === 'b') seq(t2 + ' gLongBring', d.gLongBring(v, x), [v, x, v]);
              }
            });
          });
        });
        if (!anyZero) fail('GAME_LONG: no entry divides evenly');
        if (!anyRem) fail('GAME_LONG: no entry has a remainder');
        /* 直式的其他東西：除數、十位、括號、減號不碰到格子；個位（拉得動的那一塊）不碰到十位與商 */
        const divisor = sq(X.div, Y.n, 44), tens = sq(X.t, Y.n, 44), ones = sq(X.o, Y.n, KY.size);
        const bar = { x:X.t - 30, y:Y.n - 26, w:3, h:50 };
        if (hit(divisor, bar)) fail('long: the divisor touches the division bracket');
        if (hit(tens, ones)) fail('long: the ones digit you drag overlaps the tens digit');
        if (hit(ones, sq(X.o, Y.q, D.LONG_SLOT))) fail('long: the ones digit you drag overlaps the quotient box');
        if (X.o - X.t < D.LONG_SLOT + 2 * D.LONG_PAD) fail('long: the tens and ones boxes are closer than their drop pads');
        const rows = ['q', 'n', 'm1', 's1', 'm2', 's2'];
        for (let k = 1; k < rows.length; k++) if (Y[rows[k]] - Y[rows[k - 1]] < D.LONG_SLOT + 2) fail('long: rows ' + rows[k - 1] + ' and ' + rows[k] + ' overlap');
        [Y.m1, Y.m2].forEach(y => { if (hit({ x:X.t - 52, y:y - 22, w:24, h:44 }, sq(X.t, y, D.LONG_SLOT))) fail('long: a minus sign overlaps its box'); });
        inside(divisor, 'long: the divisor', W, D.LONG_H);
        const keys = []; for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * KY.step, KY.y + Math.floor(v / 5) * KY.rowStep, KY.size));
        keys.forEach((o, k) => inside(o, 'long: digit card ' + k, W, D.LONG_H)); noHits(keys, 'long: digit cards');
        need('long', /cx:150 \+ \(\(v % 5\) - 2\) \* LONG_KEYS\.step, cy:LONG_KEYS\.y \+ Math\.floor\(v \/ 5\) \* LONG_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
        need('long', /var bring = addPiece\(B, \{ w:LONG_KEYS\.size, h:LONG_KEYS\.size, cx:X\.o, cy:Y\.n,/, 'the ones digit you drag is not on the dividend');
        need('long', /var cx = X\[s\.col\], cy = Y\[s\.row\];/, 'the boxes are not drawn at their column and row');
        need('long', /var s = nearestOpen\(slots, pt, LONG_PAD\);/, 'a box is not picked as the nearest open box');
        need('long', /if \(s\.i !== next\)\{ roundMiss\(d\.gLongOrder\(d\.gLongKinds\[N\.k\]\)\); return false; \}/, 'a box can be filled out of order');
        need('long', /if \(P\.data\.bring && N\.k !== 'b'\)\{ roundMiss\(d\.gLongBringNot\(LS\.O\)\); return false; \}/, 'the dividend ones digit can go into a box other than "bring down"');
        need('long', /\n {8}if \(v !== N\.v\)\{\n/, 'a wrong digit is accepted');
        need('long', /if \(N\.k === 'q'\) roundMiss\(v \* N\.d > N\.top \? d\.gLongQBig\(N\.top, N\.d, v, v \* N\.d\) : d\.gLongQSmall\(N\.top, N\.d, v, v \* N\.d, N\.top - v \* N\.d\)\);/, 'a wrong quotient does not say whether it is too big or too small');
        need('long', /else if \(N\.k === 'm'\) roundMiss\(N\.part \? d\.gLongM2\(N\.q, N\.d, N\.m, N\.part, v\) : d\.gLongM\(N\.q, N\.d, N\.m, v\)\);\s*else if \(N\.k === 's'\) roundMiss\(d\.gLongS\(N\.a, N\.b, N\.v, v\)\);\s*else roundMiss\(d\.gLongBring\(N\.v, v\)\);/, 'a wrong product, difference or brought-down digit has no reason of its own');
        need('long', /else \{ P\.home\(\);/, 'the digit card does not go back (cards must never run out)');
        need('long', /if \(next === steps\.length\)\{/, 'the round is not solved exactly when every box is filled');
      }
    }
  }
};
module.exports._test = { scanEquations, myLong };
