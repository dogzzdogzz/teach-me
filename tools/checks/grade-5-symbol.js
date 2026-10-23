/* grade-5/math/symbol 的檢查設定（符號偵探社：用 ☐ 或甲、乙代表不知道的數，列式，再用相反的運算把它找出來）。
   2026-10-11 新增 —— 和小遊戲「破解密碼箱」改成五關五種玩法（§六之五）同一次寫成；在那之前這一課沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的九個產生器）：每個產生器一組不變條件；正解的第二套實作只用原始參數重算；
   renderCheck 從**渲染出來的題幹**讀出算式或情境，用這裡自己的算法算出答案再和正解比，
   解釋裡的每一條算式逐條驗算（lib/arith.js），刻意的迷思誘答要真的出現。
   跑起來抓到的舊缺陷：七個產生器把題幹的數字直接當誘答（☐ ＋ k ＝ n 的選項裡有 n、k）—— makeWrongs 加上 avoid，
   誘答換成這一課的迷思（把加的數再加一次、反過來減、把「多 k」當成 k 倍……）；readBack 的解釋用「」引了一句題幹沒有的話。

   data（index.html）：
   - I18N 靜態字串（含三層題庫的題幹、選項與解釋）裡的算式逐條重算；中文的字和數字之間有空格；英文字典沒有中文；
     題庫每一題的正解用這裡自己的算法重算（不是讀 ans）。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的算法重算：
       天平 —— 每一題把**所有**拿法走完（每一步的每一塊 × 每一個去處），收不收和這裡自己的物理模型一致（重的往下、一樣重才平；
               比較輕的那一邊不能再拿）；走得到的每一個狀態都還解得完，解完一定是左邊只剩 ☐、右邊剩 (n − m) 塊；
               每一個位置都在自己的盤子上、不出界、不重疊（三種歪法都量）；「拿走」盤和兩個盤子的範圍不重疊。
       紙條 —— splitSnap 每 0.25px 和這裡自己的「最近的刻度」比；每一個 0～T 的一份按一次「就是這個」：少／多、差多少、
               「用減的（T − k）」只在那件事成立時才說；尺上的數字不擠在一起。
       拼算式 —— 這裡自己從**故事的字**讀出關係與數（不讀頁面的 t），每一張卡 × 每一格，收不收和自己的模型一致；
               把 6 張卡放進 3 格的每一種放法都試：收下的放法剛好就是對的算式。
       甲乙表 —— 每一題自己算出三格的答案；三種迷思（做反了、當成倍、倒回去又做一次）一定打得出來、不是答案；
               readInt() 的正反例；每一句說明的數字、說的那件事要成立。
       排一排 —— 四個 ☐ 用這裡自己的算法算、兩兩不同、每一種運算各一個；「把加的數再加一次」的迷思會排出不一樣的順序。
     每一句說明兩種語言逐個比數字；shuffle()、unsorted()、nearestOpen()、roundMiss()、roundAgain()、missOnce() 從原始碼切出來真的跑；
     托盤 3000 次不出現答案的排法；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去／打進去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   換畫板保護、天平畫出來的歪法、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-symbol 的端對端測試驗
   （合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
/* ☐、甲、乙（英文的 A、B）是未知數：換成 lib/arith.js 認得的 □，「☐ ＋ 15 ＝ 42」才是題目不是宣稱 */
/* 未知數之後的等號：左邊含 □ 的那一段只是「題目」，把它切掉，右邊的宣稱（「☐ ＝ 3 × 7 ＝ 21」的 3 × 7 ＝ 21）才驗得到 ——
   lib/arith.js 看到鏈的一端是 □ 就把整條鏈當成題目跳過，「甲 ＝ 15 ＋ 8 ＝ 24」這種寫錯的宣稱會被靜靜放行。 */
function ph(t){
  return String(t).replace(/<[^>]+>/g, ' ').replace(/☐/g, '□').replace(/[甲乙]/g, '□')
    .replace(/(^|[^A-Za-z])[AB](?=\s*[=+−\-×÷＝＋])/g, '$1□').replace(/([=+−\-×÷＝＋]\s*)[AB](?![A-Za-z])/g, '$1□')
    .replace(/[\d\s+\-−×÷＋()（）]*□[^=＝，。；：:,;\n]*[=＝]/g, ' ； ');   /* 切掉的只有「緊貼在 □ 左邊的算式」：前面一條宣稱的右邊（「＝ 27 所以 □」）不會被吃掉 */
}
const ARITH = makeArith({ units:['張', '顆', '元', '本', '包', '片', '公克', '格', '盒', '個', '份', '塊', '倍', '欄'], unitsEn:['stickers?', 'marbles?', 'books?', 'packs?', 'cookies?', 'g', 'blocks?', 'boxes', 'eggs?', 'parts?', 'groups?'] });
function arith(t){ return ARITH(ph(t)); }

/* review.html 的四種算式讀法（第二套實作，不呼叫頁面的 OPWORDS） */
const READ = {
  zh: { add:'加上', sub:'減去', mul:'乘以', div:'除以' },
  en: { add:'plus', sub:'minus', mul:'times', div:'divided by' }
};
function readSentence(t, k, n, lang){ return lang === 'zh' ? '☐ ' + READ.zh[t] + ' ' + k + ' 等於 ' + n : '☐ ' + READ.en[t] + ' ' + k + ' equals ' + n; }

module.exports = {
  breaks: [
    { file:"index", expect:"GAME_ORDER should be", find:"var GAME_ORDER = ['bal', 'split', 'build', 'table', 'rank'];", replace:"var GAME_ORDER = ['split', 'bal', 'build', 'table', 'rank'];" },
    { file:"index", expect:"GPICK", find:"  var GPICK = 48;", replace:"  var GPICK = 44;" },
    { file:"index", expect:"shuffle(): only", find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足", replace:"      var k = j;   /* 自足" },
    { file:"index", expect:"starts in the answer order", find:"    if (inOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }\n", replace:"" },
    { file:"index", expect:"scoring: a round should give", find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:"index", expect:"a mistake does not cost 5", find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    elScore.textContent = gScore;" },
    { file:"index", expect:"shown although nothing was taken", find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:"index", expect:"does not clear the hint", find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:"index", expect:"does not open the box", find:"'<span class=\"yes\">' + text + ' ' + L().gOpen + ' ' + L().gPts(pts)", replace:"'<span class=\"yes\">' + text + ' ' + L().gPts(pts)" },
    { file:"index", expect:"nearestOpen(): a point inside", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"first match instead of nearest", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"slides into the neighbour", find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:"index", expect:"board generation", find:"      if (gen !== gGen) return;   /* 這一張屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:"" },
    { file:"index", expect:"board generation", find:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; gGen++; BOARD_TAP = null; PIECE_PTR = {};", replace:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; BOARD_TAP = null; PIECE_PTR = {};" },
    { file:"index", expect:"fresh list of explained mistakes", find:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; gGen++; BOARD_TAP = null; PIECE_PTR = {};", replace:"    gSolved = false; gMistake = false; gCtx.ask = null; gGen++; BOARD_TAP = null; PIECE_PTR = {};" },
    { file:"index", expect:"second finger", find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:"index", expect:"second finger can start a board tap", find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      if (false) return;   /* 第二根手指" },
    { file:"index", expect:"losing pointer capture", find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:"" },
    { file:"index", expect:"no release safety", find:"      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });", replace:"      document.addEventListener('pointercancel', onDocEnd);\n    });" },
    { file:"index", expect:"6px threshold", find:"      if (!moved && dx * dx + dy * dy > 36){ moved = true;", replace:"      if (!moved){ moved = true;" },
    { file:"index", expect:"placed pieces still catch taps", find:"  .gpiece.locked{cursor:default;pointer-events:none}", replace:"  .gpiece.locked{cursor:default}" },
    { file:"index", expect:"touch-action:none", find:"    touch-action:none;cursor:grab;", replace:"    cursor:grab;" },
    { file:"index", expect:"snap to a tick while it is dragged", find:"      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);", replace:"      if (o.axis === 'x') P.place(orig.x + dx, orig.y);" },
    { file:"index", expect:"another finger is still dragging", find:"      if (P.busy()) return;   /* 這一張正被另一根手指拖著", replace:"      if (false) return;   /* 這一張正被另一根手指拖著" },
    { file:"index", expect:"ahead mode", find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:"index", expect:"second level", find:"    if (hintLevel >= 2) gHintBtn.disabled = true;", replace:"" },
    { file:"index", expect:"roundNote() changes the score", find:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", replace:"  function roundNote(text){ gMistake = true; gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }" },
    { file:"index", expect:"wrong A, B, A, A, B should be charged twice", find:"    if (gCtx.bad[key]){ roundAgain(text); return; }", replace:"    if (gCtx.bad[key] === 1){ roundAgain(text); return; }" },
    { file:"index", expect:"wrong A, B, A, A, B should be charged twice", find:"    gCtx.bad[key] = true;\n    roundMiss(text);", replace:"    gCtx.bad = {}; gCtx.bad[key] = true;\n    roundMiss(text);" },
    { file:"index", expect:"roundAgain() charges again", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMistake = true; gScore = Math.max(0, gScore - 5); gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:"index", expect:"does not show the reason", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMsg.innerHTML = ''; }" },
    { file:"index", expect:"the round has no tap-then-tap alternative", find:"      useTapSelect(B, function(P, pt){\n        var z = nearestOpen(zones, pt, BAL.pad);", replace:"      B.onDrop = (function(P, pt){\n        var z = nearestOpen(zones, pt, BAL.pad);" },
    { file:"index", expect:"a tap on the ruler no longer moves the dot", find:"      B.onBoardTap = function(pt){ if (inBand(pt)) moveTo(splitSnap(T, pt.x)); };", replace:"      B.onBoardTap = null;" },
    { file:"index", expect:"judges while the dot is still held", find:"        if (gSolved || grip.busy()) return;   /* 圓點正被拖著：先放開才判斷 */", replace:"        if (gSolved) return;   /* 圓點正被拖著：先放開才判斷 */" },
    { file:"index", expect:"does not draw the k parts before judging", find:"        copies(v);\n        var r = splitRefuse(k, q, v);", replace:"        var r = splitRefuse(k, q, v);" },
    { file:"index", expect:"the balance does not judge the block", find:"        var side = P.data.side, why = balRefuse(side, z.k, wL(), wR());", replace:"        var side = P.data.side, why = balRefuse(side, z.k, X + e[1] * u, e[2] * u);" },
    { file:"index", expect:"is not redrawn from the new weights", find:"        st.tilt = balTilt(wL(), wR());\n        draw();", replace:"        draw();" },
    { file:"index", expect:"exactly when only", find:"        if (st.mL === 0 && st.tilt === 0) roundSolved(d.gBalDone(st.nR, u, X));", replace:"        if (st.mL === 0) roundSolved(d.gBalDone(st.nR, u, X));" },
    { file:"index", expect:"build does not judge the card", find:"        var c = P.data, why = buildRefuse(e, sl.k, c);", replace:"        var c = P.data, why = buildRefuse(e, sl.k, { k:c.k, v:'X' });" },
    { file:"index", expect:"free reminder", find:"        if (why === 'kind'){ roundNote(d.gBuildKind); return false; }", replace:"        if (why === 'kind'){ missOnce('kind', d.gBuildKind); return false; }" },
    { file:"index", expect:"rank does not judge the card", find:"        var c = P.data.c, k = rankOf(set, c);", replace:"        var c = P.data.c, k = P.data.j;" },
    { file:"index", expect:"the \"moved to the other pan\" mistake key", find:"missOnce('move:' + side, ", replace:"missOnce('move', " },
    { file:"index", expect:"the \"lighter side\" mistake key", find:"missOnce('light:' + side, ", replace:"missOnce('light', " },
    { file:"index", expect:"the strip mistake key", find:"missOnce('v' + v, ", replace:"missOnce('v', " },
    { file:"index", expect:"the wrong-operation key", find:"missOnce('op:' + c.v, ", replace:"missOnce('op', " },
    { file:"index", expect:"the wrong-side key", find:"missOnce('pos:' + sl.k + ':' + c.v, ", replace:"missOnce('pos', " },
    { file:"index", expect:"the table mistake key", find:"missOnce(i + ':' + v, ", replace:"missOnce(String(i), " },
    { file:"index", expect:"the rank mistake key", find:"missOnce(P.data.j + ':' + sl.i, ", replace:"missOnce(String(sl.i), " },
    { file:"index", expect:"the solved message does not undo the story", find:"var inv = e.t === 'add' ? [e.r, '-', e.a] : e.t === 'sub' ? [e.r, '+', e.a]", replace:"var inv = e.t === 'add' ? [e.r, '+', e.a] : e.t === 'sub' ? [e.r, '-', e.a]" },
    { file:"index", expect:"the table columns are not", find:"{ a:e[4], b:tableB(op, k, e[4]), ask:'b' }];", replace:"{ b:e[4], a:tableA(op, k, e[4]), ask:'a' }];" },
    { file:"index", expect:"does not judge the number typed", find:"          var want = c.ask === 'a' ? c.a : c.b;\n          if (v !== want){", replace:"          var want = c.ask === 'a' ? c.b : c.a;\n          if (v !== want){" },
    { file:"index", expect:"gPts zh", find:"      gPts: function(p){ return '＋' + p + ' 分'; },", replace:"      gPts: function(p){ return '＋20 分'; }," },
    { file:"index", expect:"gMinus en should say 5", find:"      gMinus: '−5 points',", replace:"      gMinus: 'points taken'," },
    { file:"index", expect:"gOp[-] zh", find:"      gOp: { '+':'＋', '-':'−', '*':'×', '/':'÷' },", replace:"      gOp: { '+':'＋', '-':'＋', '*':'×', '/':'÷' }," },
    { file:"index", expect:"s6lead zh does not say", find:"再用相反的運算把它找出來</strong>。放錯扣 5 分，但不會出局 —— 想清楚比手快重要；五關都沒放錯，最後再加 20 分。',", replace:"再把它算出來</strong>。放錯扣 5 分，但不會出局 —— 想清楚比手快重要；五關都沒放錯，最後再加 20 分。'," },
    { file:"index", expect:"the markup fallback is not the same sentence", find:"<p class=\"lead\" data-i18n=\"s6lead\">五個密碼箱，五種開法", replace:"<p class=\"lead\" data-i18n=\"s6lead\">五個密碼箱、五種開法" },
    { file:"index", expect:"does not name the round \"paper strip\"", find:"a balance, a paper strip, building an equation", replace:"a balance, a ribbon, building an equation" },
    { file:"index", expect:"the game name changed", find:"      s6h2: 'Crack the Code Box',", replace:"      s6h2: 'Code Box Missions'," },
    { file:"index", expect:"gHints.bal zh: must say", find:"        bal: '天平兩邊一樣重：兩邊同時拿走一樣多，天平還是平的。", replace:"        bal: '天平兩邊一樣重：拿走一些積木，天平還是平的。" },
    { file:"index", expect:"gHints.table en: must say", find:"work backwards with the opposite operation — the opposite of adding is subtracting, and the opposite of subtracting is adding.',", replace:"work backwards — undo what the rule did.'," },
    { file:"index", expect:"gHints.rank zh: must say", find:"        rank: '加的反面是減、減的反面是加、乘的反面是除、除的反面是乘 —— 先把每一個 ☐ 算出來，再比大小。'", replace:"        rank: '先把每一個 ☐ 算出來，再比大小。'" },
    { file:"index", expect:"balBag", find:"  function balBag(u, m, n){ return (n - m) * u; }", replace:"  function balBag(u, m, n){ return (n - m + 1) * u; }" },
    { file:"index", expect:"balTilt(): heavier left should be 1", find:"  function balTilt(wL, wR){ return wL > wR ? 1 : (wL < wR ? -1 : 0); }", replace:"  function balTilt(wL, wR){ return wL > wR ? -1 : (wL < wR ? 1 : 0); }" },
    { file:"index", expect:"balRefuse", find:"    return mine < other ? 'light' : null;", replace:"    return mine <= other && mine !== other ? null : null;" },
    { file:"index", expect:"balRefuse", find:"    if (target !== 'tray') return 'move';", replace:"    if (target !== 'tray') return 'stay';" },
    { file:"index", expect:"does not sit on its plate row", find:"BAL.plateY + down - 4 - BAL.size / 2 - Math.floor(i / 2) * BAL.cell", replace:"BAL.plateY + down - 4 - BAL.size / 2 - Math.floor(i / 2) * (BAL.cell - 2)" },
    { file:"index", expect:"does not sit on its plate row", find:"    var down = (side === 'L' ? tilt : -tilt) * BAL.tilt;", replace:"    var down = 0;" },
    { file:"index", expect:"the tray and pan zones overlap once widened", find:"tray:{ cx:150, cy:292, hw:140, hh:36 }", replace:"tray:{ cx:150, cy:272, hw:140, hh:56 }" },
    { file:"index", expect:"needs 2..3 blocks on the left", find:"var GAME_BAL = [[5, 2, 6], [10, 3, 6]", replace:"var GAME_BAL = [[5, 4, 6], [10, 3, 6]" },
    { file:"index", expect:"needs 2..3 blocks on the left", find:"[9, 2, 6], [7, 3, 6]];", replace:"[9, 2, 6], [4, 3, 7]];" },
    { file:"index", expect:"tray chip", find:"addZone(B, (side === 'L' ? 30 : 168) + n * 36,", replace:"addZone(B, (side === 'L' ? 30 : 198) + n * 36," },
    { file:"index", expect:"gBalDone", find:"      gBalDone: function(n, u, x){ return '左邊只剩 ☐，右邊還有 ' + n + ' 塊：' + n + ' × ' + u + ' ＝ ' + x", replace:"      gBalDone: function(n, u, x){ return '左邊只剩 ☐，右邊還有 ' + n + ' 塊：' + n + ' × ' + u + ' ＝ ' + (x + u)" },
    { file:"index", expect:"gBalLight L", find:"      gBalLight: function(side, u){ var me = side === 'L' ? '左' : '右', other = side === 'L' ? '右' : '左';", replace:"      gBalLight: function(side, u){ var me = side === 'L' ? '左' : '右', other = side === 'L' ? '左' : '右';" },
    { file:"index", expect:"gBalOkTilt", find:"'You took ' + u + ' g off the ' + (side === 'L' ? 'left' : 'right') + ', so the balance tips ' + (side === 'L' ? 'right' : 'left')", replace:"'You took ' + u + ' g off the ' + (side === 'L' ? 'left' : 'right') + ', so the balance tips ' + (side === 'L' ? 'left' : 'right')" },
    { file:"index", expect:"gBalNow", find:"(tilt > 0 ? ' 比 ' + w + ' 重，天平往左歪' : ' 比 ' + w + ' 輕，天平往右歪')", replace:"(tilt > 0 ? ' 比 ' + w + ' 輕，天平往右歪' : ' 比 ' + w + ' 重，天平往左歪')" },
    { file:"index", expect:"smaller than GPICK", find:"cell:54, size:48, pad:10", replace:"cell:54, size:44, pad:10" },
    { file:"index", expect:"splitSnap(", find:"  function splitSnap(T, x){ var v = Math.round((x - SPLIT.x0) * T / SPLIT.w);", replace:"  function splitSnap(T, x){ var v = Math.floor((x - SPLIT.x0) * T / SPLIT.w);" },
    { file:"index", expect:"splitRefuse(", find:"    return { x:x, less:x < T, diff:Math.abs(T - x), sub:v === T - k };", replace:"    return { x:x, less:x < T, diff:Math.abs(T - x), sub:v === T - k - 1 };" },
    { file:"index", expect:"= null, expected x", find:"    if (x === T) return null;\n    return { x:x, less", replace:"    if (x >= T) return null;\n    return { x:x, less" },
    { file:"index", expect:"ruler labels", find:"  function splitLabels(T){ var out = []; for (var t = 0; t <= T - 5; t += 10) out.push(t); out.push(T); return out; }", replace:"  function splitLabels(T){ var out = []; for (var t = 0; t < T; t += 10) out.push(t); out.push(T); return out; }" },
    { file:"index", expect:"k 2..5, one part", find:"var GAME_SPLIT = [[3, 12], [4, 9]", replace:"var GAME_SPLIT = [[3, 18], [4, 9]" },
    { file:"index", expect:"gSplitBad(", find:"(less ? ' 少 ' : ' 多 ') + diff + '。'; },", replace:"(less ? ' 多 ' : ' 少 ') + diff + '。'; }," },
    { file:"index", expect:"gSplitBad(", find:"(less ? ' less than ' : ' more than ') + T + '.'; },", replace:"(less ? ' more than ' : ' less than ') + T + '.'; }," },
    { file:"index", expect:"gSplitSub", find:"      gSplitSub: function(T, k, v){ return T + ' − ' + k + ' ＝ ' + v + ' 是把 ' + k + ' 拿掉了；'", replace:"      gSplitSub: function(T, k, v){ return T + ' − ' + k + ' ＝ ' + v + ' 是把 ' + v + ' 拿掉了；'" },
    { file:"index", expect:"gSplitDone", find:"      gSplitDone: function(k, T, v){ return k + ' parts × ' + v + ' = ' + T + ' — exactly filled: ' + T + ' ÷ ' + k + ' = ' + v", replace:"      gSplitDone: function(k, T, v){ return k + ' parts × ' + v + ' = ' + T + ' — exactly filled: ' + T + ' ÷ ' + v + ' = ' + k" },
    { file:"index", expect:"the grip covers the strip or the ruler", find:"gripY:150, ry:186", replace:"gripY:160, ry:186" },
    { file:"index", expect:"buildRule says", find:"    if (e.t === 'add') return { ops:['+'], first:['X', e.a], second:['X', e.a], R:e.r, X:e.r - e.a };", replace:"    if (e.t === 'add') return { ops:['+'], first:['X', e.a], second:['X', e.a], R:e.r, X:e.r + e.a };" },
    { file:"index", expect:"buildRefuse(box", find:"    if (slotK === 1) return r.ops.indexOf(card.v) >= 0 ? null : 'op';", replace:"    if (slotK === 1) return null;" },
    { file:"index", expect:"buildRefuse(box", find:"    if ((slotK === 1) !== (card.k === 'o')) return 'kind';", replace:"    if (slotK === 1 && card.k !== 'o') return 'kind';" },
    { file:"index", expect:"fills accepted", find:"    if (e.t === 'sub') return { ops:['-'], first:['X'], second:[e.a], R:e.r, X:e.r + e.a };", replace:"    if (e.t === 'sub') return { ops:['-'], first:['X', e.a], second:['X', e.a], R:e.r, X:e.r + e.a };" },
    { file:"index", expect:"zh and en stories describe different equations", find:"        books: '書架上原本有 ☐ 本書，又放上 18 本，現在有 45 本。',", replace:"        books: '書架上原本有 ☐ 本書，又放上 18 本，現在有 46 本。'," },
    { file:"index", expect:"the story reads as", find:"        money: 'Ming had $☐. He spent $35 on stationery and has $28 left.',", replace:"        money: 'Ming had $☐. He used $35 on stationery and has $28 left.'," },
    { file:"index", expect:"gBuildOp", find:"      gBuildOp: function(act, need, op){ return '「' + act + '」，要用 ' + need + '，不是 ' + op + '。'; },", replace:"      gBuildOp: function(act, need, op){ return '「' + act + '」，要用 ' + op + '，不是 ' + need + '。'; }," },
    { file:"index", expect:"no gBuildPos", find:"        money: '先有 ☐ 元，才花掉 35 元 —— ☐ 要寫在 − 的前面。',\n", replace:"" },
    { file:"index", expect:"gBuildAct names a number that is not in the story", find:"books: '18 more were put on — there are more books now'", replace:"books: '19 more were put on — there are more books now'" },
    { file:"index", expect:"gBuildDone", find:"      gBuildDone: function(eq, calc, x){ return '拼好了：' + eq + '。用它算出 ☐：' + calc + ' ＝ ' + x", replace:"      gBuildDone: function(eq, calc, x){ return '拼好了：' + eq + '。用它算出 ☐：' + x" },
    { file:"index", expect:"one of each kind", find:"    { id:'cards', t:'more', a:24, b:7 },", replace:"    { id:'cards', t:'add', a:24, r:31 }," },
    { file:"index", expect:"build tray cards and boxes", find:"cardY:[142, 206], pad:12 };", replace:"cardY:[100, 206], pad:12 };" },
    { file:"index", expect:"readInt(\"07\")", find:"  function readInt(s){ var t = String(s).trim(); return /^(0|[1-9]\\d{0,2})$/.test(t) ? +t : null; }", replace:"  function readInt(s){ var t = String(s).trim(); return /^\\d{1,3}$/.test(t) ? +t : null; }" },
    { file:"index", expect:"tableA/tableB disagree", find:"  function tableB(op, k, a){ return op === '+' ? a - k : a + k; }", replace:"  function tableB(op, k, a){ return op === '+' ? a + k : a - k; }" },
    { file:"index", expect:"misconception value", find:"['-', 4, 10, 15, 8], ['-', 7, 15, 22, 9]];", replace:"['-', 4, 10, 15, 8], ['-', 7, 15, 22, 6]];" },
    { file:"index", expect:"tableMiss", find:"    if (v === given * k) return 'times';", replace:"" },
    { file:"index", expect:"typed", find:"        ? '你打的 ' + v + ' 是 ' + a + ' ＋ ' + k + '，又加了一次。", replace:"        ? '你打的 ' + v + ' 是 ' + a + ' ＋ ' + k + '，算錯了。" },
    { file:"index", expect:"must say \"8 less than B\"", find:"        ? 'Your ' + v + ' is ' + k + ' less than B (' + b + '); A = B + ' + k + ' means A is ' + k + ' more than B.'", replace:"        ? 'Your ' + v + ' is ' + k + ' more than B (' + b + '); A = B + ' + k + ' means A is ' + k + ' more than B.'" },
    { file:"index", expect:"(other)", find:"(v > b ? ' 比 ' + b + ' 多 ' + (v - b) : v < b ? ' 比 ' + b + ' 少 ' + (b - v) : ' 和 ' + b + ' 一樣')", replace:"(v > b ? ' 比 ' + b + ' 多 ' + (v - b + 1) : v < b ? ' 比 ' + b + ' 少 ' + (b - v) : ' 和 ' + b + ' 一樣')" },
    { file:"index", expect:"(other)", find:"      gTableOtherB: function(op, k, a, v){ return 'If B = ' + v + ', then A = ' + v + (op === '+' ? ' + ' + k + ' = ' + (v + k)", replace:"      gTableOtherB: function(op, k, a, v){ return 'If B = ' + v + ', then A = ' + v + (op === '+' ? ' + ' + k + ' = ' + (v - k)" },
    { file:"index", expect:"gTableDone", find:"'，倒回去就是 乙 ＝ 甲 ' + (op === '+' ? '− ' : '＋ ') + k + '。'; },", replace:"'，倒回去就是 乙 ＝ 甲 ' + (op === '+' ? '＋ ' : '− ') + k + '。'; }," },
    { file:"index", expect:"gTableOkB", find:"      gTableOkB: function(op, k, a, b){ return 'Right: going back with the opposite operation, B = ' + a + (op === '+' ? ' − ' : ' + ') + k + ' = ' + b + '.'; },", replace:"      gTableOkB: function(op, k, a, b){ return 'Right: B = ' + a + (op === '+' ? ' − ' : ' + ') + k + ' = ' + b + '.'; }," },
    { file:"index", expect:"rankX(", find:"c[0] === 'mul' ? c[2] / c[1] : c[2] * c[1]; }\n  /* 第幾小", replace:"c[0] === 'mul' ? c[2] / c[1] : c[2] * c[1] + 1; }\n  /* 第幾小" },
    { file:"index", expect:"four different whole numbers", find:"    [['add', 9, 17], ['sub', 6, 15], ['mul', 4, 28], ['div', 5, 9]],", replace:"    [['add', 9, 17], ['sub', 6, 15], ['mul', 4, 32], ['div', 5, 9]]," },
    { file:"index", expect:"does not catch the misconception", find:"    [['add', 12, 20], ['sub', 5, 10], ['mul', 5, 60], ['div', 2, 9]],", replace:"    [['add', 2, 8], ['sub', 2, 13], ['mul', 2, 40], ['div', 2, 2]]," },
    { file:"index", expect:"gEq zh", find:"      gEq: function(c){ return c[0] === 'add' ? '☐ ＋ ' + c[1] + ' ＝ ' + c[2] : c[0] === 'sub' ? '☐ − ' + c[1] + ' ＝ ' + c[2] : c[0] === 'mul' ? c[1] + ' × ☐ ＝ ' + c[2]", replace:"      gEq: function(c){ return c[0] === 'add' ? '☐ ＋ ' + c[1] + ' ＝ ' + c[2] : c[0] === 'sub' ? '☐ − ' + c[1] + ' ＝ ' + c[2] : c[0] === 'mul' ? '☐ × ' + c[2] + ' ＝ ' + c[1]" },
    { file:"index", expect:"gInv en", find:"      gInv: function(c){ return c[0] === 'add' ? c[2] + ' − ' + c[1] : c[0] === 'sub' ? c[2] + ' + ' + c[1] :", replace:"      gInv: function(c){ return c[0] === 'add' ? c[2] + ' + ' + c[1] : c[0] === 'sub' ? c[2] + ' + ' + c[1] :" },
    { file:"index", expect:"gRankBad", find:"      gRankBad: function(eq, inv, x, k, s){ return eq + '：☐ ＝ ' + inv + ' ＝ ' + x + '，它是第 ' + k + ' 小，不是第 ' + s + ' 小。'; },", replace:"      gRankBad: function(eq, inv, x, k, s){ return eq + '：☐ ＝ ' + inv + ' ＝ ' + x + '，它是第 ' + s + ' 小，不是第 ' + k + ' 小。'; }," },
    { file:"index", expect:"caption 0 overlaps a box", find:"capTop:[2, 26]", replace:"capTop:[2, 34]" },
    { file:"index", expect:"keyed", find:"          opts:['57','630','27','2'], ans:2,\n          why:'用加法的反運算", replace:"          opts:['57','630','27','2'], ans:0,\n          why:'用加法的反運算" },
    { file:"index", expect:"says it is the correct one", find:"opts:['再加一次 15：42 ＋ 15 ＝ 57','用減法消去 15：42 − 15 ＝ 27',", replace:"opts:['再加一次 15：42 ＋ 15 ＝ 57','用減法消去 15：42 − 15 ＝ 27（正確）'," },
    { file:"index", expect:"arithmetic is wrong", find:"用加法還原：☐ ＝ 45 ＋ 30 ＝ 75 元。' },", replace:"用加法還原：☐ ＝ 45 ＋ 30 ＝ 76 元。' }," },
    { file:"index", expect:"no space between a Chinese character and a digit", find:"why:'甲比乙多 8，甲 ＝ 乙 ＋ 8 ＝ 15 ＋ 8 ＝ 23。' },", replace:"why:'甲比乙多8，甲 ＝ 乙 ＋ 8 ＝ 15 ＋ 8 ＝ 23。' }," },
    { file:"index", expect:"the reading of ☐ ÷ 4", find:"          opts:['A number divided by 4 equals 6','A number times 4 equals 6','A number minus 4 equals 6','4 divided by a number equals 6'], ans:0,", replace:"          opts:['A number divided by 4 equals 6','A number times 4 equals 6','A number minus 4 equals 6','4 divided by a number equals 6'], ans:3," },
    { file:"index", expect:"the pool should have 6 different entries", find:"var GAME_SPLIT = [[3, 12], [4, 9], [3, 14], [4, 8], [5, 7], [3, 16]];", replace:"var GAME_SPLIT = [[3, 12], [4, 9], [3, 14], [4, 8], [5, 7]];" },
    { file:"index", expect:"the pool should have 6 different entries", find:"var GAME_TABLE = [", replace:"var GAME_TABLE = [['+', 8, 11, 9, 20], " },
    { file:"index", expect:"a zero-length part is not only a reminder", find:"        if (v === 0){ roundNote(d.gSplitZero); return; }", replace:"        if (v === 0){ missOnce('v0', d.gSplitZero); return; }" },
    { file:"index", expect:"the refusal verdict is assigned 2 times in RENDER.bal", find:"        if (why === 'stay') return false;   /* 放回自己的盤子：靜靜彈回 */", replace:"        if (why === 'light') why = null;\n        if (why === 'stay') return false;   /* 放回自己的盤子：靜靜彈回 */" },
    { file:"index", expect:"the refusal verdict is assigned 2 times in RENDER.rank", find:"        if (k !== sl.i){ missOnce(", replace:"        k = sl.i;\n        if (k !== sl.i){ missOnce(" },
    { file:"index", expect:"the refusal verdict is assigned 2 times in RENDER.split", find:"        var r = splitRefuse(k, q, v);\n        if (r){", replace:"        var r = splitRefuse(k, q, v);\n        if (r && r.sub) r = null;\n        if (r){" },
    { file:"index", expect:"a Check does not stop at the first wrong box", find:"            missOnce(i + ':' + v, msg);\n            return;", replace:"            missOnce(i + ':' + v, msg);\n            continue;" },
    { file:"index", expect:"left in the answer order", find:"    if (inOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }", replace:"    if (inOrder(t) && t.length > 6){ var x = t[0]; t[0] = t[1]; t[1] = x; }" },
    { file:"index", expect:"the refusal verdict is assigned 2 times in RENDER.build", find:"        if (why === 'kind'){ roundNote(d.gBuildKind); return false; }", replace:"        why ||= null;\n        if (why === 'kind'){ roundNote(d.gBuildKind); return false; }" },
    { file:"index", expect:"the pool should have 6 different entries", find:"var GAME_RANK = [\n    [['add', 9, 17], ['sub', 6, 15], ['mul', 4, 28], ['div', 5, 9]],\n", replace:"var GAME_RANK = [\n    ,\n" },
    { file:"index", expect:"should swap the first two", find:"    if (inOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }", replace:"    if (inOrder(t)){ var x = t[0]; t[0] = t[2]; t[2] = x; }" },
    { file:"index", expect:"no pointercancel release safety on the document", find:"      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });", replace:"      document.addEventListener('pointerup', onDocEnd);\n    });" },
    { file:"index", expect:"10px limit gone", find:"      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", replace:"      if (t.far) return;" },
    { file:"index", expect:"can still be placed after it", find:"      if (!gSolved) tryDrop(P, { x:pt.x, y:pt.y, tap:true });", replace:"      tryDrop(P, { x:pt.x, y:pt.y, tap:true });" },
    { file:"index", expect:"could give the answer away", find:"cls:'gcard' + (c.k === 'o' ? ' gopcard' : ''), data:", replace:"cls:'gcard' + (c.k === 'o' ? ' gopcard' : '') + (buildRefuse(e, 0, c) && buildRefuse(e, 1, c) && buildRefuse(e, 2, c) ? ' gdecoy' : ''), data:" },
    { file:"index", expect:"rank card style is not one neutral style", find:"cls:'gcard geqcard', data:", replace:"cls:'gcard geqcard' + (rankOf(set, c) === 0 ? ' gfirst' : ''), data:" },
    { file:"index", expect:"is not treated as a cancel", find:"    function onDocEnd(e){ end(e, true); }", replace:"    function onDocEnd(e){ end(e, false); }" },
    { file:"index", expect:"only the engine’s state classes", find:"        sl.el = addZone(B, RANK.slotX - RANK.w / 2, cy - RANK.h / 2, RANK.w, RANK.h, 'gslot gph geqslot', String(i + 1));\n        return sl;\n      });", replace:"        sl.el = addZone(B, RANK.slotX - RANK.w / 2, cy - RANK.h / 2, RANK.w, RANK.h, 'gslot gph geqslot', String(i + 1));\n        return sl;\n      });\n      if (set.length) Array.prototype.forEach.call(B.el.children, function(x){ if (x.textContent === '1') x.classList.add('gfirst'); });" },
    { file:"index", expect:"piece looks may not change at runtime", find:"        P.el.style.visibility = 'hidden';\n        var n = taken[side]++;", replace:"        P.el.style.visibility = 'hidden'; P.el.style.borderColor = 'red';\n        var n = taken[side]++;" },
    { file:"index", expect:"another finger is not ignored while a piece is dragged", find:"    function end(e, cancelled){\n      if (!start || e.pointerId !== pid) return;", replace:"    function end(e, cancelled){\n      if (!start) return;" },
    { file:"index", expect:"rewrites style/className at runtime", find:"        P.el.style.visibility = 'hidden';\n        var n = taken[side]++;", replace:"        P.el.style.visibility = 'hidden'; P.el.style.setProperty('border-color', 'red');\n        var n = taken[side]++;" },
    { file:"index", expect:"rewrites style/className at runtime", find:"    P.el.style.visibility = 'hidden';\n    slot.done = true;", replace:"    P.el.style.visibility = 'hidden'; P.el.setAttribute(\"style\", P.el.getAttribute(\"style\") + ';color:red');\n    slot.done = true;" },
    { file:"index", expect:"another finger is not ignored while a piece is dragged", find:"      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e), dx", replace:"      if (!start) return;\n      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e), dx" },
    { file:"index", expect:"do not stack from the plate up", find:"var s = balSpot(P.data.side, P.data.side === 'L' ? kL++ : kR++, st.tilt);", replace:"var s = balSpot(P.data.side, P.data.i, st.tilt);" },
    { file:"index", expect:"do not ride on their plate", find:"var s = balSpot(P.data.side, P.data.side === 'L' ? kL++ : kR++, st.tilt); P.rehome(s.cx, s.cy);", replace:"var s = balSpot(P.data.side, P.data.side === 'L' ? kL++ : kR++, 0); P.rehome(s.cx, s.cy);" },
    { file:"index", expect:"not recomputed from what is drawn", find:"zones = [zones[0]].concat(balZones('L', st.mL + 1, st.tilt), balZones('R', st.nR, st.tilt));", replace:"zones = [zones[0]].concat(balZones('L', 4, 0), balZones('R', 6, 0));" },
    { file:"index", expect:"belongs to a pan", find:"    for (var i = 0; i < n; i++){ var p = balSpot(side, i, tilt); out.push({ k:side, cx:p.cx, cy:p.cy, hw:BAL.size / 2, hh:BAL.size / 2 }); }", replace:"    for (var i = 0; i < n + (n % 2); i++){ var p = balSpot(side, i, tilt); out.push({ k:side, cx:p.cx, cy:p.cy, hw:BAL.size / 2, hh:BAL.size / 2 }); }" },
    { file:"index", expect:"is not the block drawn there", find:"out.push({ k:side, cx:p.cx, cy:p.cy, hw:BAL.size / 2, hh:BAL.size / 2 });", replace:"out.push({ k:side, cx:p.cx + 3, cy:p.cy, hw:BAL.size / 2, hh:BAL.size / 2 });" },
    { file:"index", expect:"does not switch the hint button off", find:"    gHintBtn.disabled = true;\n    elHint.textContent = '';   /* 過關了", replace:"    elHint.textContent = '';   /* 過關了" },
    { file:"index", expect:"a badly written box after a right one does not update the trail", find:"          if (v === null){ show(); roundNote((okMsg ? okMsg + ' ' : '') + d.gTableBlank); return; }", replace:"          if (v === null){ roundNote(d.gTableBlank); return; }" },
    { file:"index", expect:"is not only a reminder", find:"          if (v === null){ show(); roundNote((okMsg ? okMsg + ' ' : '') + d.gTableBlank); return; }", replace:"          if (v === null){ show(); missOnce('blank', (okMsg ? okMsg + ' ' : '') + d.gTableBlank); return; }" },
    { file:"index", expect:"leaves hint 2 talking about the locked box", find:"            show();\n            missOnce(i + ':' + v, msg);", replace:"            line.textContent = d.gTableNow(done);\n            missOnce(i + ':' + v, msg);" },
    { file:"index", expect:"the last exits of submit() do not update", find:"        show();\n        if (!any){ roundNote(d.gTableBlank); return; }", replace:"        if (!any){ roundNote(d.gTableBlank); return; }\n        line.textContent = d.gTableNow(done);" },
    { file:"index", expect:"has no show()", find:"        function show(){ line.textContent = d.gTableNow(done); refreshHint(); }", replace:"        function show(){ line.textContent = d.gTableNow(done); }" },
    { file:"review", expect:"copied straight out of the stem", find:"        var m = mixOpts(ans, [n + k], [n, k]);", replace:"        var m = mixOpts(ans, [n + k, n, k], []);" },
    { file:"review", expect:"the \"added again\" distractor", find:"        var m = mixOpts(ans, [n + k], [n, k]);", replace:"        var m = mixOpts(ans, [], [n, k]);" },
    { file:"review", expect:"the \"multiplied again\" distractor", find:"        var m = mixOpts(ans, [n * k, n - k], [n, k]);", replace:"        var m = mixOpts(ans, [n - k], [n, k]);" },
    { file:"review", expect:"the \"times instead of more\" distractor", find:"        var m = mixOpts(a, [b - diff, b * diff], [b, diff]);", replace:"        var m = mixOpts(a, [b - diff], [b, diff]);" },
    { file:"review", expect:"the \"more = times\" distractor", find:"        var m = mixOpts(total, [base * diff, base - diff], [base, diff]);", replace:"        var m = mixOpts(total, [base - diff], [base, diff]);" },
    { file:"review", expect:"why quotes", find:"          why: lang === 'zh' ? expr + ' 讀作：' + d.optsZh[d.ansIdx] + '。'", replace:"          why: lang === 'zh' ? expr + ' 讀作：「' + d.optsZh[d.ansIdx] + '」。'" },
    { file:"review", expect:"why: arithmetic is wrong", find:"why: lang === 'zh' ? d.n + ' − ' + d.k + ' = ' + d.ans + '（用減法把加的數去掉）。'", replace:"why: lang === 'zh' ? d.n + ' − ' + d.k + ' = ' + (d.ans + 1) + '（用減法把加的數去掉）。'" },
    { file:"index", expect:"bonus: gWin zh", find:"return bonus ? ('五個密碼箱全部打開了，而且一次都沒放錯，再加 20 分！總分 ' + s + ' 分 🏆')", replace:"return bonus ? ('五個密碼箱全部打開了，而且一次都沒放錯！總分 ' + s + ' 分 🏆')" },
    { file:"index", expect:"bonus: gWin en", find:"return bonus ? ('All 5 code boxes are open without a single wrong move — +20 bonus! Total score ' + s + ' 🏆')", replace:"return bonus ? ('All 5 code boxes are open without a single wrong move! Total score ' + s + ' 🏆')" },
    { file:"index", expect:"bonus: gWin zh (no bonus)", find:" 按「重新開始」，挑戰一次都不放錯（再加 20 分）。');", replace:"');" },
    { file:"index", expect:"bonus: gWin en (no bonus)", find:" Press “Restart” and try a run with no wrong moves (+20 bonus).');", replace:"');" },
    { file:"index", expect:"bonus: restartGame() does not reset", find:"gScore = 0; gAnyMistake = false; elScore.textContent = '0'; startRound(); }", replace:"gScore = 0; elScore.textContent = '0'; startRound(); }" },
    { file:"index", expect:"bonus: gAnyMistake is written", find:"    gSolved = false; gMistake = false; gCtx = { bad:{} };", replace:"    gSolved = false; gMistake = false; gAnyMistake = false; gCtx = { bad:{} };" },
    { file:"index", expect:"bonus: roundSolved() does not grant", find:"bonus = last && !gAnyMistake;", replace:"bonus = last;" },
    { file:"index", expect:"round 5 without a charged mistake gives", find:"    if (bonus) gScore += 20;\n", replace:"" },
    { file:"index", expect:"bonus: roundMiss() does not record", find:"    gMistake = true; gAnyMistake = true;", replace:"    gMistake = true;" },
    { file:"index", expect:"bonus: roundNote() touches", find:"  function roundNote(text){ gMsg.innerHTML", replace:"  function roundNote(text){ gAnyMistake = true; gMsg.innerHTML" },
    { file:"index", expect:"bonus: roundAgain() touches", find:"  function roundAgain(text){ gMsg.innerHTML", replace:"  function roundAgain(text){ gAnyMistake = true; gMsg.innerHTML" },
    { file:"index", expect:"bonus: s6lead zh", find:"；五關都沒放錯，最後再加 20 分。',", replace:"。'," },
    { file:"index", expect:"bonus: s6lead en", find:"; clear all five rounds with no wrong move and you get 20 bonus points at the end.", replace:"." },
    { file:"review", expect:"works out to", find:"          stem: lang === 'zh' ? '☐ ÷ ' + d.k + ' ＝ ' + d.q + '，☐ 是多少？'", replace:"          stem: lang === 'zh' ? '☐ ÷ ' + d.k + ' ＝ ' + (d.q + 1) + '，☐ 是多少？'" },
    { file:"review", expect:"!= whole × pct / 100", find:"        var part = whole * pct / 100;", replace:"        var part = whole * pct / 100 + 1;" },
    { file:"review", expect:"opts[ans] != correct", find:"    mul: { zh:function(k,n){ return '☐ 乘以 ' + k + ' 等於 ' + n; }", replace:"    mul: { zh:function(k,n){ return '☐ 乘上 ' + k + ' 等於 ' + n; }" },
    { file:"review", expect:"is not a positive whole number", find:"      if (!seen[key] && c > 0 && Math.floor(c) === c){ seen[key] = true; out.push(c); }", replace:"      if (!seen[key] && c > 0){ seen[key] = true; out.push(c); }" },
    { file:"review", expect:"is not one of the four sentence forms", find:"    div: { zh:function(k,n){ return '☐ 除以 ' + k + ' 等於 ' + n; }, en:function(k,n){ return '☐ divided by ' + k + ' equals ' + n; } }", replace:"    div: { zh:function(k,n){ return '☐ 除以 ' + k + ' 等於 ' + n; }, en:function(k,n){ return '☐ divided ' + k + ' equals ' + n; } }" }
  ],

  sim: {
    INVARIANTS: {
      solveAdd: d => {
        if (d.n !== d.ans + d.k || !(d.k >= 3 && d.k <= 12 && d.ans >= 4)) return 'n ' + d.n + ' != ans + k';
        /* 把加的數再加一次（n ＋ k）是刻意的迷思誘答：一定在選項裡 */
        if (d.opts.indexOf(d.n + d.k) < 0) return 'the "added again" distractor (' + (d.n + d.k) + ') is not offered';
      },
      solveSub: d => {
        if (d.n !== d.ans - d.k || !(d.n > 0)) return 'n ' + d.n + ' != ans − k';
        /* 把減的數再減一次（n − k）：正數、而且不是題幹上的 k（那是抄題，不端出來）時一定在選項裡 */
        if (d.n - d.k > 0 && d.n - d.k !== d.k && d.opts.indexOf(d.n - d.k) < 0) return 'the "subtracted again" distractor (' + (d.n - d.k) + ') is not offered';
      },
      solveMul: d => {
        if (d.n !== d.k * d.ans) return 'n ' + d.n + ' != k × ans';
        if (d.opts.indexOf(d.n * d.k) < 0) return 'the "multiplied again" distractor (' + (d.n * d.k) + ') is not offered';
      },
      solveDiv: d => {
        if (d.ans !== d.q * d.k) return 'ans ' + d.ans + ' != q × k';
        if (d.opts.indexOf(d.q + d.k) < 0 && d.q + d.k !== d.ans) return 'the "added instead" distractor (' + (d.q + d.k) + ') is not offered';
      },
      twoSym: d => {
        if (d.a !== d.b + d.diff) return 'a ' + d.a + ' != b + diff';
        if (d.opts.indexOf(d.b * d.diff) < 0) return 'the "times instead of more" distractor (' + (d.b * d.diff) + ') is not offered';
      },
      readBack: d => {
        if (['add', 'sub', 'mul', 'div'].indexOf(d.t) < 0) return 'unknown type ' + d.t;
        if (d.t === 'mul' && d.n % d.k) return 'k × ☐ = n with n not a multiple of k';
        if (d.t === 'sub' && !(d.n > 0)) return 'sub: n must be positive';
        if (d.optsZh.length !== 4 || d.optsEn.length !== 4 || new Set(d.optsZh).size !== 4) return 'readBack needs four different readings';
      },
      misconception: d => {
        if (d.total !== d.base + d.diff) return 'total ' + d.total + ' != base + diff';
        if (d.opts.indexOf(d.base * d.diff) < 0) return 'the "more = times" distractor (' + (d.base * d.diff) + ') is not offered';
      },
      avgReverse: d => { if (d.sum !== d.avg * d.n) return 'sum ' + d.sum + ' != avg × n'; },
      percentOf: d => { if (d.part !== d.whole * d.pct / 100 || !isInt(d.part)) return 'part ' + d.part + ' != whole × pct / 100'; }
    },
    expectedCorrect: function(d, genId, lang){
      if (genId === 'solveAdd') return String(d.n - d.k);
      if (genId === 'solveSub') return String(d.n + d.k);
      if (genId === 'solveMul') return String(d.n / d.k);
      if (genId === 'solveDiv') return String(d.q * d.k);
      if (genId === 'twoSym') return String(d.b + d.diff);
      if (genId === 'readBack') return readSentence(d.t, d.k, d.n, lang);
      if (genId === 'misconception') return String(d.base + d.diff);
      if (genId === 'avgReverse') return String(d.avg * d.n);
      if (genId === 'percentOf') return String(d.whole * d.pct / 100);
      return null;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'readBack'){
        const re = lang === 'zh' ? /^☐ (加上|減去|乘以|除以) \d+ 等於 \d+$/ : /^☐ (plus|minus|times|divided by) \d+ equals \d+$/;
        return re.test(s) ? null : 'reading "' + s + '" is not one of the four sentence forms';
      }
      if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a positive whole number';
      /* 範圍從產生器自己的參數推：solveMul 的 n × k 最大 12 × 9 × 9 ＝ 972，百分率 200 的 50%… 都在 999 以內 */
      if (+s > 999) return 'option ' + s + ' above 999';
      return null;
    },
    /* 從渲染出來的題幹讀出算式或情境，自己算出答案；解釋裡的算式逐條驗算 */
    renderCheck: function(d, q, lang, genId){
      const stem = q.stem.replace(/<[^>]+>/g, ' ').replace(/＋/g, '+').replace(/[－−]/g, '-').replace(/＝/g, '=');
      const n = nums(stem);
      let want = null, m;
      if (genId === 'solveAdd' && (m = stem.match(/^☐ \+ (\d+) = (\d+)/))) want = String(+m[2] - +m[1]);
      else if (genId === 'solveSub' && (m = stem.match(/^☐ - (\d+) = (\d+)/))) want = String(+m[2] + +m[1]);
      else if (genId === 'solveMul' && (m = stem.match(/^(\d+) × ☐ = (\d+)/))) want = String(+m[2] / +m[1]);
      else if (genId === 'solveDiv' && (m = stem.match(/^☐ ÷ (\d+) = (\d+)/))) want = String(+m[2] * +m[1]);
      else if (genId === 'twoSym' && (m = stem.match(lang === 'zh' ? /^甲 = 乙 \+ (\d+)，乙 = (\d+)，/ : /^A = B \+ (\d+)\. If B = (\d+),/))) want = String(+m[1] + +m[2]);
      else if (genId === 'misconception' && n.length === 2) want = String(n[0] + n[1]);
      else if (genId === 'avgReverse' && n.length >= 2) want = String(n[0] * n[1]);
      else if (genId === 'percentOf' && n.length === 2) want = String(lang === 'zh' ? n[0] * n[1] / 100 : n[1] * n[0] / 100);
      else if (genId === 'readBack' && (m = stem.match(/☐ ([+\-×÷]) (\d+) = (\d+)|(\d+) × ☐ = (\d+)/))){
        const t = m[4] ? 'mul' : { '+':'add', '-':'sub', '÷':'div' }[m[1]];
        want = readSentence(t, m[4] ? +m[4] : +m[2], m[4] ? +m[5] : +m[3], lang);
        /* 其他三個讀法都不可以是這個算式的意思 */
        if (q.opts.filter(o => o === want).length !== 1) return 'readBack: the right reading is not offered exactly once';
      }
      if (want === null) return 'cannot read the stem "' + stem + '"';
      if (String(q.opts[q.ans]) !== want) return 'the stem "' + stem + '" works out to ' + want + ', but the keyed option is ' + q.opts[q.ans];
      /* 「比……多」的情境題：題幹真的說「多」，誘答裡有「多 = 乘」 */
      if (genId === 'misconception' && !(lang === 'zh' ? /多 \d+ 張/.test(stem) : /\d+ more stickers/.test(stem))) return 'misconception stem does not say "more"';
      const r = arith(q.why);
      if (r.problems.length) return 'why: ' + r.problems.join('; ');
      if (genId !== 'readBack' && r.verified < 1) return 'why: no arithmetic verified in "' + q.why + '"';
      return null;
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「破解密碼箱」的題庫與版面',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, pick, unsorted, GAME_BAL, BAL, BAL_H, balBag, balTilt, balSpot, balZones, balRefuse, GAME_SPLIT, SPLIT, SPLIT_H, splitX, splitSnap, splitLabels, splitRefuse, GAME_BUILD, BUILD, BUILD_H, OPS, buildRule, buildCards, buildInOrder, buildRefuse, GAME_TABLE, tableA, tableB, readInt, tableMiss, GAME_RANK, RANK, RANK_H, rankX, rankOf, rankInOrder}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9, W = 300;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: no space between a Chinese character and a digit in "' + s + '"');
        arith(s).problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 算式掃描器自己先證明會響（正反例）：☐、甲乙、A B 是未知數 --- */
      [['☐ ＋ 15 ＝ 42，所以 42 − 15 ＝ 27', 1, 0], ['42 − 15 ＝ 28', 1, 1], ['甲 ＝ 乙 ＋ 8 ＝ 15 ＋ 8 ＝ 23', 1, 0], ['甲 ＝ 15 ＋ 8 ＝ 24', 1, 1],
       ['A = B + 8 = 15 + 8 = 23', 1, 0], ['42 − 15 ＝ 28 所以 ☐ ＝ 27', 1, 1], ['42 − 15 ＝ 27 所以 ☐ ＝ 28', 1, 0], ['3 × 14 = 42', 1, 0], ['3 × 14 = 43', 1, 1], ['☐ = 3 × 7 = 21', 1, 0], ['36 ÷ 3 = 13', 1, 1]].forEach(([t, n, bad]) => {
        const r = arith(t);
        if (r.verified !== n - bad || r.problems.length !== bad) fail('arith self-test: "' + t + '" should verify ' + (n - bad) + ' and flag ' + bad + ' — got ' + r.verified + ' verified, ' + JSON.stringify(r.problems));
      });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹、選項與解釋）的算式逐個重算；中文的數字與字之間有空格 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => {
        walk(I18N[L], L, []).forEach(([where, s]) => {
          const r = arith(s);
          checkedEq += r.verified;
          r.problems.forEach(p => fail(where + ': ' + p + ' — "' + s + '"'));
          if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ': no space between a Chinese character and a digit: ' + s);
          if (L === 'en' && /[一-鿿]/.test(s) && where !== 'en.btn') fail(where + ': Chinese characters in the English dictionary: ' + s);
        });
      });
      if (checkedEq < 24) fail('only ' + checkedEq + ' equations verified in the I18N strings (24 expected: the quiz explanations and the misconception options) — the arithmetic scan is not reading them');

      /* --- 2. 題庫每一題的正解用這裡自己的算法重算（不讀 ans 以外的東西） --- */
      {
        const KEY = {
          qs: [['☐+9=23', '☐ ＋ 9 ＝ 23'], 42 - 15, 51 / 3, null, 15 + 8, 12 + 5],
          qsAdv: [45 + 50 - 20, (50 - 10) / 2, 42 / 6, 215 - 45 + 30],
          qsBoost: [12 + 4, 42 - 15]
        };
        Object.keys(KEY).forEach(bank => LANGS.forEach(L => (I18N[L][bank] || []).forEach((q, i) => {
          const k = KEY[bank][i], o = String(q.opts[q.ans]);
          if (k === null){
            if (L === 'zh' ? o !== '一個數除以 4 等於 6' : o !== 'A number divided by 4 equals 6') fail(bank + '[' + i + '] ' + L + ': the reading of ☐ ÷ 4 ＝ 6 should be "a number divided by 4 is 6", keyed "' + o + '"');
          } else if (Array.isArray(k)){
            if (o.replace(/\s/g, '') !== k[0]) fail(bank + '[' + i + '] ' + L + ': keyed equation "' + o + '" should be ☐ + 9 = 23');
          } else if (bank === 'qsBoost' && i === 1){
            if (nums(o).slice(-1)[0] !== k || !/[−-]/.test(o)) fail(bank + '[' + i + '] ' + L + ': the keyed method should subtract to ' + k + ' — "' + o + '"');
          } else if (+o !== k) fail(bank + '[' + i + '] ' + L + ': keyed ' + o + ', expected ' + k);
          if (/正確|\(correct\)/i.test(q.opts.join(' '))) fail(bank + '[' + i + '] ' + L + ': an option says it is the correct one');
          if (q.why && nums(q.why).indexOf(+o) < 0 && /^\d+$/.test(o)) fail(bank + '[' + i + '] ' + L + ': the explanation never says the answer ' + o);
        })));
      }

      /* ================= 3. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 6. 小遊戲：破解密碼箱');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H, m) => { m = m || 0; if (!(fin(o.x) && fin(o.y) && o.x >= m - EPS && o.y >= m - EPS && o.x + o.w <= W - m + EPS && o.y + o.h <= H - m + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board (margin ' + m + '): ' + JSON.stringify(o)); };
      const hit = (a, b, g) => { g = g || 0; return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -g + EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -g + EPS; };
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const zbox = z => ({ x:z.cx - z.hw, y:z.cy - z.hh, w:2 * z.hw, h:2 * z.hh });
      const noHits = (list, what, g) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j], g)){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap' + (g ? ' (or are closer than ' + g + 'px)' : '')); return; } };
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);
      /* 每一個題庫都要有 6 題、彼此不同：空的題庫會讓下面「每一題」的檢查全部靜靜通過 */
      [['GAME_BAL', D.GAME_BAL], ['GAME_SPLIT', D.GAME_SPLIT], ['GAME_BUILD', D.GAME_BUILD], ['GAME_TABLE', D.GAME_TABLE], ['GAME_RANK', D.GAME_RANK]].forEach(([nm, pool]) => {
        if (!Array.isArray(pool) || pool.length !== 6 || ![0, 1, 2, 3, 4, 5].every(i => Object.prototype.hasOwnProperty.call(pool, i) && pool[i] !== undefined) || new Set(pool.map(x => JSON.stringify(x))).size !== pool.length) fail('GAME ' + nm + ': the pool should have 6 different entries (has ' + (pool && pool.length) + ')');
      });
      if (!(D.GPICK >= 48)) fail('GAME: GPICK ' + D.GPICK + ' — pieces under 48 are under 44px on a phone');

      /* --- 五關的順序、RENDER、提示 --- */
      const TYPES = ['bal', 'split', 'build', 'table', 'rank'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 2, 2, 3, 4, then 1 and the footer rule), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        bal: { zh:['兩邊同時拿走一樣多', '比較重'], en:['take the same amount off both sides', 'heavier side'] },
        split: { zh:['平分', '乘的反面是除'], en:['share', 'opposite of multiplying is dividing'] },
        build: { zh:['變多（＋）', '變少（−）', '平分（÷）', '☐'], en:['bigger (+)', 'smaller (−)', 'shared equally (÷)', '☐'] },
        table: { zh:['相反的運算', '加的反面是減'], en:['opposite operation', 'opposite of adding is subtracting'] },
        rank: { zh:['加的反面是減', '乘的反面是除', '再比大小'], en:['opposite of + is −', 'of × is ÷', 'then compare'] }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, []); has('gHints.' + t, L, h, HINT_SEM[t]); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };

      /* --- 開場白：說的每一件事五關都成立；頁面上的備用字和中文字典是同一句 --- */
      {
        const LEAD = { zh:'<strong>用 ☐ 或甲、乙代表不知道的數，列出算式，再用相反的運算把它找出來</strong>', en:'<strong>use ☐, or A and B, for a number you don’t know yet, write the equation, then find it with the opposite operation</strong>' };
        const NAMES = { zh:['天平', '紙條', '拼算式', '甲乙表', '排一排'], en:['balance', 'paper strip', 'building an equation', 'A-and-B table', 'putting things in order'] };
        LANGS.forEach(L => {
          const t = I18N[L].s6lead || '';
          if (t.indexOf(LEAD[L]) < 0) fail('GAME s6lead ' + L + ' does not say "' + LEAD[L] + '"');
          NAMES[L].forEach(nm => { if (t.indexOf(nm) < 0) fail('GAME s6lead ' + L + ' does not name the round "' + nm + '"'); });
          hasNot('s6lead', L, t, { zh:['愈快', '算出它的值', '每個密碼箱都藏著'], en:['faster you', 'Every code box hides', 'work out its value'] });
          if ((I18N[L].s6h2 || '') !== (L === 'zh' ? '破解密碼箱' : 'Crack the Code Box')) fail('GAME s6h2 ' + L + ': the game name changed — parents.html names it in its mastery line');
        });
        const m = src.match(/<p class="lead" data-i18n="s6lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s6lead) fail('GAME s6lead: the markup fallback is not the same sentence as the zh dictionary');
      }

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{ bad:\{\} \}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation (gGen++) with a fresh list of explained mistakes');
      need(null, /if \(gen !== gGen\) return;   \/\* 這一張屬於已經拿掉的畫板/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /document\.addEventListener\('pointerup', onDocEnd\);/, 'no release safety on the document while a piece is dragged');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      {
        const ap = extractFunction(gsrc, 'addPiece') || '';
        if (!/el\.addEventListener\('pointermove', function\(e\)\{\n\s*if \(!start \|\| e\.pointerId !== pid\) return;/.test(ap) || !/function end\(e, cancelled\)\{\n\s*if \(!start \|\| e\.pointerId !== pid\) return;/.test(ap)) fail('GAME: a move or release from another finger is not ignored while a piece is dragged (pointerId check in pointermove and end())');
        if (!/function onDocEnd\(e\)\{ end\(e, true\); \}/.test(ap)) fail('GAME: a release that reaches only the document is not treated as a cancel (onDocEnd → end(e, true))');
        if (!/start = B\.toBoard\(e\); orig = \{ x:P\.cx, y:P\.cy \}; moved = false;\n\s*document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(ap)) fail('GAME: no pointercancel release safety on the document while a piece is dragged (addPiece must add both document listeners when a drag starts)');
      }
      need(null, /if \(t\.far \|\| Math\.hypot\(e\.clientX - t\.x, e\.clientY - t\.y\) > 10\) return;/, 'a slide on the board still counts as a tap on a target (10px limit gone)');
      need(null, /if \(!gSolved\) tryDrop\(P, \{ x:pt\.x, y:pt\.y, tap:true \}\);/, 'a piece selected before the round was solved can still be placed after it');
      /* 不可以用外觀洩漏答案：卡片的樣式只看「是數還是運算」（build）、所有積木／算式卡同一個樣式 —— 不看對錯 */
      need('build', /cls:'gcard' \+ \(c\.k === 'o' \? ' gopcard' : ''\), data:/, 'build card style depends on more than number/operation (could give the answer away)');
      need('rank', /cls:'gcard geqcard', data:/, 'rank card style is not one neutral style');
      /* 卡片做出來之後也不可以再換樣子：遊戲裡只准加引擎自己的狀態 class，不准寫顏色、邊框、透明度這類樣式 */
      {
        const adds = (gsrc.match(/classList\.add\(([^)]*)\)/g) || []).map(x => x.replace(/^classList\.add\(|\)$/g, ''));
        adds.forEach(a => { if (["'locked'", "'dragging'", "'sel'", "'filled'"].indexOf(a.trim()) < 0) fail('GAME: classList.add(' + a + ') — only the engine’s state classes may be added to pieces (no answer-dependent look)'); });
        const styl = (gsrc.match(/\.style\.([A-Za-z]+)\s*=/g) || []).map(x => x.replace(/^\.style\.|\s*=$/g, ''));
        styl.forEach(k => { if (['width', 'height', 'left', 'top', 'transform', 'visibility', 'justifyContent'].indexOf(k) < 0) fail('GAME: a .style.' + k + ' write in the game — piece looks may not change at runtime'); });
        if (/\.style\.cssText|\.style\s*\[|\.style\.setProperty|setAttribute\(\s*['"`]style|className\s*\+=|\.style\s*=(?!=)/.test(gsrc)) fail('GAME: the game rewrites style/className at runtime');
      }
      need('bal', /text:String\(u\), cls:'gblock', data:\{ side:'L', i:i \} \}\)\);\n[^\n]*text:String\(u\), cls:'gblock', data:\{ side:'R', i:j \} \}\)\);/, 'balance blocks are not one neutral style');
      need(null, /if \(!moved && dx \* dx \+ dy \* dy > 36\)\{ moved = true;/, 'a tap that wobbles is no longer told apart from a drag (6px threshold)');
      need(null, /if \(o\.axis === 'x'\) P\.place\(o\.snapX\(orig\.x \+ dx\), orig\.y\);/, 'the strip dot does not snap to a tick while it is dragged');
      need(null, /if \(P\.busy\(\)\) return;   \/\* 這一張正被另一根手指拖著/, 'a tap on a target places a card that another finger is still dragging');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('GAME: pieces do not set touch-action:none');
      ['bal', 'build', 'rank'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      need('split', /B\.onBoardTap = function\(pt\)\{ if \(inBand\(pt\)\) moveTo\(splitSnap\(T, pt\.x\)\); \};/, 'a tap on the ruler no longer moves the dot (no tap alternative to the drag)');
      need('split', /if \(gSolved \|\| grip\.busy\(\)\) return;   \/\* 圓點正被拖著：先放開才判斷 \*\//, '"This one" judges while the dot is still held');
      need('split', /var v = gCtx\.v;\n\s*if \(v === 0\)\{ roundNote\(d\.gSplitZero\); return; \}/, 'a zero-length part is not only a reminder');
      need('split', /copies\(v\);\n\s*var r = splitRefuse\(k, q, v\);/, '"This one" does not draw the k parts before judging');
      need('bal', /var side = P\.data\.side, why = balRefuse\(side, z\.k, wL\(\), wR\(\)\);/, 'the balance does not judge the block that was dropped against the current weights');
      need('bal', /st\.tilt = balTilt\(wL\(\), wR\(\)\);\n\s*draw\(\);/, 'the balance is not redrawn from the new weights after a block is taken off');
      need('bal', /if \(st\.mL === 0 && st\.tilt === 0\) roundSolved/, 'the balance round is not solved exactly when only ☐ is left and it is level');
      need('bal', /var kL = 1, kR = 0;\n\s*pieces\.forEach\(function\(P\)\{ if \(!P\.locked\)\{ var s = balSpot\(P\.data\.side, P\.data\.side === 'L' \? kL\+\+ : kR\+\+, st\.tilt\); P\.rehome\(s\.cx, s\.cy\); \} \}\);/, 'the blocks do not ride on their plate when the balance tips, or do not stack from the plate up (an empty cell under a block)');
      need('bal', /zones = \[zones\[0\]\]\.concat\(balZones\('L', st\.mL \+ 1, st\.tilt\), balZones\('R', st\.nR, st\.tilt\)\);/, 'the pan zones are not recomputed from what is drawn after every change');
      need('bal', /var zones = \[\{ k:'tray', cx:BAL\.tray\.cx, cy:BAL\.tray\.cy, hw:BAL\.tray\.hw, hh:BAL\.tray\.hh \}\];\n\s*draw\(\);/, 'the pan zones are not set by draw() before the first drop');
      need('build', /var c = P\.data, why = buildRefuse\(e, sl\.k, c\);/, 'build does not judge the card that was dropped');
      need('build', /if \(why === 'kind'\)\{ roundNote\(d\.gBuildKind\); return false; \}/, 'a number in the round box (or + − × ÷ in a number box) is no longer a free reminder');
      need('table', /var v = readInt\(c\.inp\.value\);\n\s*if \(v === null\)\{ show\(\); roundNote\(\(okMsg \? okMsg \+ ' ' : ''\) \+ d\.gTableBlank\); return; \}/, 'a badly written number is not only a reminder');
      {
        /* 每一個出口（寫法不對、打錯、全空白、對了）都先 show()：讀數與第二層提示跟著剛鎖好的格子走 */
        const sb = (RB.table.match(/function submit\(\)\{([\s\S]*?)\n {6}\}\n/) || [])[1] || '';
        if (!/function show\(\)\{ line\.textContent = d\.gTableNow\(done\); refreshHint\(\); \}/.test(sb)) fail('GAME table: submit() has no show() that updates the trail and hint 2');
        if (!/if \(v === null\)\{ show\(\); roundNote\(\(okMsg \? okMsg \+ ' ' : ''\) \+ d\.gTableBlank\); return; \}/.test(sb)) fail('GAME table: a badly written box after a right one does not update the trail / confirm the right box');
        if (!/show\(\);\n\s*missOnce\(i \+ ':' \+ v, msg\);/.test(sb)) fail('GAME table: a wrong box after a right one does not update the trail and hint 2 (leaves hint 2 talking about the locked box)');
        if (!/\n\s*show\(\);\n\s*if \(!any\)/.test(sb)) fail('GAME table: the last exits of submit() do not update the trail and hint 2');
        if ((sb.match(/return;/g) || []).length !== 4 || (sb.match(/show\(\);/g) || []).length !== 3) fail('GAME table: submit() has an exit that skips show()');
      }
      need('rank', /var c = P\.data\.c, k = rankOf\(set, c\);/, 'rank does not judge the card that was dropped');
      /* 判斷的結果只指定一次、之後不再被改寫（why ＝ null、k ＝ sl.i 之類的一行就能讓錯的動作被收下） */
      /* 也算 ||=、+=、++ 這類「改寫」；不算 ==、=== 和箭頭函式的 => */
      const asg = v => new RegExp('\\b' + v + '\\s*(?:[-+*/%|&?^]|\\*\\*|<<|>>>?|\\|\\||&&|\\?\\?)?=(?![=>])|\\b' + v + '\\s*(?:\\+\\+|--)|(?:\\+\\+|--)\\s*' + v + '\\b', 'g');
      [['bal', asg('why')], ['build', asg('why')], ['split', asg('r')], ['rank', asg('k')], ['table', asg('kind')]].forEach(([t, re]) => {
        const n = ((RB[t] || '').match(re) || []).length;
        if (n !== 1) fail('GAME ' + t + ': the refusal verdict is assigned ' + n + ' times in RENDER.' + t + ' — it must be assigned once, straight from the pure function');
      });
      need('table', /missOnce\(i \+ ':' \+ v, msg\);\n\s*return;/, 'a Check does not stop at the first wrong box');
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint');
        if (!rs || !/L\(\)\.gOpen/.test(rs)) fail('GAME: roundSolved() does not open the box');
        if (!rs || !/gHintBtn\.disabled = true;/.test(rs)) fail('GAME: roundSolved() does not switch the hint button off (a hint after solving is stale)');
      }
      need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(gsrc, 'roundMiss');
        if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if (typeof r.html !== 'string') return fail('GAME scoring: roundMiss() does not show the reason (no message written)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      /* ---- 完美通關加 20 分（五年級每個遊戲都有）：一次都沒被扣分才有 ---- */
      {
        const ssrc = extractFunction(gsrc, 'roundSolved');
        if (!ssrc) fail('bonus: cannot find roundSolved()');
        else [[0, false, false, 20], [0, true, true, 10], [4, false, false, 40], [4, true, true, 10], [4, false, true, 20]].forEach(([round, mis, any, want]) => {
          let r;
          try {
            r = new Function('var gSolved = false, gScore = 0, gMistake = ' + mis + ', gAnyMistake = ' + any + ', gRound = ' + round + ', GAME_ORDER = [1,2,3,4,5];' +
              'var gameStage = { querySelectorAll:function(){ return []; } }, elScore = {}, gHintBtn = {}, elHint = { textContent:"old hint" }, gMsg = {}, gNext = { disabled:true };' +
              'function L(){ return { gPts:function(p){ return "+" + p; }, gOpen:"OPEN", gWin:function(s, b){ return "WIN" + s + (b ? "B" : ""); }, gClear:"CLEAR" }; }\n' + ssrc +
              '\nroundSolved("ok"); return { s:gScore, html:gMsg.innerHTML, next:gNext.disabled };')();
          } catch (e){ return fail('bonus: roundSolved() could not run: ' + e.message); }
          if (r.s !== want) fail('bonus: round ' + (round + 1) + (mis ? ' with' : ' without') + ' a charged mistake' + (any ? ' (earlier ones in the run)' : '') + ' gives ' + r.s + ', expected ' + want);
          if (round === 4 && /B/.test(r.html.replace(/OPEN/, '')) !== (!any)) fail('bonus: the clean-run bonus line is ' + (any ? 'shown after a charged mistake' : 'missing'));
          if (round < 4 && /WIN/.test(r.html)) fail('bonus: the win line is shown before the last round');
        });
        if (ssrc && !/bonus = last && !gAnyMistake;/.test(ssrc)) fail('bonus: roundSolved() does not grant the bonus exactly when the last round ends with no charged mistake in the run');
      }
      {
        /* gAnyMistake：只在「真的被扣分」（roundMiss）時設成 true；只在 restartGame() 設回 false —— 不在 Next、startRound、切換語言 */
        const wr = v => new RegExp('\\b' + v + '\\s*(?:[-+*/%|&?^]|\\*\\*|<<|>>>?|\\|\\||&&|\\?\\?)?=(?![=>])|\\b' + v + '\\s*(?:\\+\\+|--)|(?:\\+\\+|--)\\s*' + v + '\\b', 'g');
        const all = (gsrc.match(wr('gAnyMistake')) || []).length;
        const rg = extractFunction(gsrc, 'restartGame'), rm = extractFunction(gsrc, 'roundMiss');
        if (!rg || !/gAnyMistake = false;/.test(rg)) fail('bonus: restartGame() does not reset gAnyMistake (a clean run after a run with mistakes would never get the bonus)');
        else if (!rm || !/gAnyMistake = true;/.test(rm)) fail('bonus: roundMiss() does not record gAnyMistake (a charged mistake would not cost the bonus)');
        else {
          const rest = gsrc.replace(rg, '').replace(rm, '');
          const left = (rest.match(wr('gAnyMistake')) || []);
          if (left.length !== 1 || !/var gRound = 0, [^;]*\bgAnyMistake = false, hintLevel/.test(rest)) fail('bonus: gAnyMistake is written ' + left.length + ' times outside restartGame()/roundMiss() — only the declaration may be (a reset on Next/startRound would hand out the bonus after a mistake in an earlier round)');
          if (all !== 3) fail('bonus: gAnyMistake is written ' + all + ' times — expected exactly 3 (declaration, roundMiss, restartGame)');
        }
        ['roundInfo', 'roundNote', 'roundAgain'].forEach(n => { const f = extractFunction(gsrc, n); if (!f || /gAnyMistake/.test(f)) fail('bonus: ' + n + '() touches gAnyMistake (or is missing) — a free reminder must not cost the bonus'); });
        LANGS.forEach(L => {
          const w1 = I18N[L].gWin(125, true), w0 = I18N[L].gWin(105, false);
          if (nums(w1).indexOf(20) < 0) fail('bonus: gWin ' + L + ' does not name the 20-point bonus');
          if (nums(w0).indexOf(20) < 0 || !(L === 'zh' ? /重新開始/ : /Restart/).test(w0) || !(L === 'zh' ? /不放錯/ : /no wrong moves/).test(w0)) fail('bonus: gWin ' + L + ' (no bonus) does not invite a restart for a run with no wrong moves (+20)');
          if (/Restart|重新開始/.test(w1)) fail('bonus: gWin ' + L + ' (bonus) still shows the restart invite');
          if (nums(I18N[L].s6lead).join() !== '5,20') fail('bonus: s6lead ' + L + ' should state the 5-point cost and the 20-point bonus: ' + nums(I18N[L].s6lead).join());
        });
      }
      ['roundInfo', 'roundNote'].forEach(n => { const ri = extractFunction(gsrc, n); if (!ri || /gMistake|gScore/.test(ri)) fail('GAME: ' + n + '() changes the score or records a mistake (or is missing)'); });
      {
        const ra = extractFunction(gsrc, 'roundAgain'), mo = extractFunction(gsrc, 'missOnce');
        if (!ra || !mo) fail('GAME: cannot find roundAgain() / missOnce() (repeat an explained mistake without charging it)');
        else {
          let r;
          try {
            r = new Function('var gMistake = false, gScore = 20, elScore = { textContent:"20" }, gMsg = {}, gCtx = { bad:{} }, log = [];' +
              'function roundMiss(t){ log.push("miss:" + t); gScore -= 5; }\n' + ra + '\n' + mo + '\n' +
              'var real = roundAgain; roundAgain = function(t){ log.push("again:" + t); real(t); };' +
              '["A", "B", "A", "A", "B"].forEach(function(k){ missOnce(k, "why " + k); });' +
              'return { s:gScore, log:log.join(" "), html:gMsg.innerHTML, m:gMistake };')();
          } catch (e){ r = null; fail('GAME: missOnce()/roundAgain() could not run: ' + e.message); }
          if (r && r.log !== 'miss:why A miss:why B again:why A again:why A again:why B') fail('GAME: wrong A, B, A, A, B should be charged twice and the rest only explained again — got "' + r.log + '"');
          if (r && (r.s !== 10 || r.m || typeof r.html !== 'string' || r.html.indexOf('why B') < 0 || !/class="no"/.test(r.html))) fail('GAME: roundAgain() charges again (score ' + r.s + ', mistake ' + r.m + ') or does not show the reason');
        }
      }
      /* 每一種錯的 key：同一個錯（同一張卡放同一格、同一個值）才算「一樣」 */
      need('bal', /missOnce\('move:' \+ side, /, 'the "moved to the other pan" mistake key is not per side');
      need('bal', /missOnce\('light:' \+ side, /, 'the "lighter side" mistake key is not per side');
      need('split', /missOnce\('v' \+ v, /, 'the strip mistake key is not the value tried');
      need('build', /missOnce\('op:' \+ c\.v, /, 'the wrong-operation key is not the card');
      need('build', /missOnce\('pos:' \+ sl\.k \+ ':' \+ c\.v, /, 'the wrong-side key is not box and card');
      need('table', /missOnce\(i \+ ':' \+ v, /, 'the table mistake key is not column and value');
      need('rank', /missOnce\(P\.data\.j \+ ':' \+ sl\.i, /, 'the rank mistake key is not card and box');
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85, false), L === 'zh' ? [85, 20] : [5, 85, 20]);
        say('gWin bonus', L, d.gWin(105, true), L === 'zh' ? [20, 105] : [5, 20, 105]);
        say('gClear', L, d.gClear, []);
        say('gOpen', L, d.gOpen, []);
        ['gOk', 'gCheck', 'gHintBtn', 'gNextBtn', 'gRestartBtn'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + k + ' missing in ' + L); });
        const OPW = { zh:{ '+':'＋', '-':'−', '*':'×', '/':'÷' }, en:{ '+':'+', '-':'−', '*':'×', '/':'÷' } }[L];
        D.OPS.forEach(o => { if (d.gOp[o] !== OPW[o]) fail('GAME gOp[' + o + '] ' + L + ' = "' + d.gOp[o] + '", expected ' + OPW[o]); });
      });

      /* --- shuffle()、unsorted()、nearestOpen()：切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'shuffle');
        let shuffleFn = null;
        if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
        else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
        if (shuffleFn){
          const seen = new Set();
          for (let i = 0; i < 400; i++){
            const a = [1, 2, 3, 4], r = shuffleFn(a);
            if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
            seen.add(r.join());
          }
          if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders seen in 400 shuffles');
        }
        const nsrc = extractFunction(gsrc, 'nearestOpen');
        if (!nsrc) fail('GAME: cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(nsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const big = { cx:100, cy:100, hw:60, hh:40 }, small = { cx:175, cy:100, hw:12, hh:12 };
          if (nearestOpen([small, big], { x:158, y:100 }, 10) !== big) fail('GAME nearestOpen(): a point inside the big box near the small one is not given to the big box (measures to the centre?)');
          const a1 = { cx:50, cy:50, hw:20, hh:20, done:true }, a2 = { cx:96, cy:50, hw:20, hh:20 };
          if (nearestOpen([a1, a2], { x:72, y:50 }, 8) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot slides into the neighbour');
          if (nearestOpen([a1, a2], { x:200, y:200 }, 8) !== null) fail('GAME nearestOpen(): a drop far away is caught');
          const b1 = { cx:50, cy:50, hw:20, hh:20 };
          if (nearestOpen([b1, a2], { x:74, y:50 }, 8) !== a2) fail('GAME nearestOpen(): a drop nearer the second box goes to the first (first match instead of nearest)');
        }
      }
      {
        const us = extractFunction(src, 'unsorted');
        let r = null;
        try { r = new Function('function shuffle(a){ return a.slice(); }\n' + us + '\nreturn unsorted([1, 2, 3, 4], function(l){ return l.join() === "1,2,3,4"; });')(); } catch (e){ fail('GAME unsorted() could not run: ' + e.message); }
        if (JSON.stringify(r) !== '[2,1,3,4]') fail('GAME unsorted(): a shuffle that happens to give the answer order is left in the answer order (should swap the first two: 2,1,3,4; got ' + JSON.stringify(r) + ')');
      }
      const unsortedOk = (name, make, inOrder, n) => {
        for (let i = 0; i < (n || 3000); i++){ const t = make(); if (inOrder(t)){ fail('GAME ' + name + ': the tray starts in the answer order: ' + JSON.stringify(t)); return; } }
      };
      /* 自己的「放進哪一塊」：在 pad 以內的所有塊裡，到方框最近的（一樣近比到中心），最近的那塊已經放好就不收 */
      const myNearest = (zones, p, pad) => {
        let best = null, bd = Infinity, bc = Infinity;
        zones.forEach(z => {
          const dx = Math.abs(p.x - z.cx), dy = Math.abs(p.y - z.cy);
          if (dx > z.hw + pad || dy > z.hh + pad) return;
          const ex = Math.max(0, dx - z.hw), ey = Math.max(0, dy - z.hh), dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;
          if (dd < bd - EPS || (Math.abs(dd - bd) <= EPS && dc < bc)){ bd = dd; bc = dc; best = z; }
        });
        return best && !best.done ? best : null;
      };
      /* 整片畫板每 1px：頁面的 nearestOpen() 和自己的「最近的那一塊」要一致 */
      const sweepNearest = (what, zones, pad, H) => {
        if (!nearestOpen) return;
        for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++){
          const a = nearestOpen(zones, { x:x, y:y }, pad), b = myNearest(zones, { x:x, y:y }, pad);
          if (a !== b){ fail('GAME ' + what + ': nearestOpen at (' + x + ', ' + y + ') picks ' + (a && (a.k !== undefined ? a.k : a.i)) + ', the nearest box is ' + (b && (b.k !== undefined ? b.k : b.i))); return; }
        }
      };

      /* ================= 第 1 關：天平 ================= */
      {
        const B = D.BAL, H = D.BAL_H;
        if (!(B.size >= D.GPICK)) fail('GAME bal: blocks ' + B.size + ' are smaller than GPICK');
        tooSmall('bal block', B.size);
        if (!(B.tilt > 0)) fail('GAME bal: the balance does not move when it tips (tilt ' + B.tilt + ')');
        const tray = { x:B.tray.cx - B.tray.hw, y:B.tray.cy - B.tray.hh, w:2 * B.tray.hw, h:2 * B.tray.hh };
        inside(tray, 'bal tray', H, 2);
        /* 判斷放到哪裡的三塊範圍（和 RENDER 裡寫的一樣）：拿走盤、左盤、右盤 —— 放寬 pad 之後拿走盤和盤子不重疊 */
        /* 判斷放到哪裡：拿走盤 ＋ 兩個盤子上每一塊畫出來的東西各自的方框（balZones，draw() 每次重算）。
           每一題的每一個走得到的狀態都驗：方框就是那些積木與袋子（自己算位置）、放寬 pad 之後和拿走盤不重疊、左右兩盤不重疊；
           兩個盤子中間的空隙、積木上面的空白、單數時旁邊那一個空格，都不屬於任何一塊；每一個狀態整片畫板每 1px 和自己的「最近的那一塊」比。 */
        const padded = z => ({ x:z.cx - z.hw - B.pad, y:z.cy - z.hh - B.pad, w:2 * (z.hw + B.pad), h:2 * (z.hh + B.pad) });
        const inPad = (z, p) => Math.abs(p.x - z.cx) <= z.hw + B.pad && Math.abs(p.y - z.cy) <= z.hh + B.pad;
        const trayZ = { k:'tray', cx:B.tray.cx, cy:B.tray.cy, hw:B.tray.hw, hh:B.tray.hh };
        const myCell = (side, i, t) => ({ cx:B.panX[side === 'L' ? 0 : 1] + ((i % 2) - 0.5) * B.cell, cy:B.plateY + (side === 'L' ? t : -t) * B.tilt - 4 - B.size / 2 - Math.floor(i / 2) * B.cell });
        let swept = 0;
        const zoneState = (where, mL, nR, t) => {
          const zL = D.balZones('L', mL + 1, t), zR = D.balZones('R', nR, t);
          [[zL, 'L', mL + 1], [zR, 'R', nR]].forEach(([zs, sd, n]) => {
            if (!Array.isArray(zs) || zs.length !== n) return fail(where + ': balZones(' + sd + ') gives ' + (zs && zs.length) + ' boxes for ' + n + ' things on the pan');
            zs.forEach((z, i) => { const m = myCell(sd, i, t); if (z.k !== sd || Math.abs(z.cx - m.cx) > EPS || Math.abs(z.cy - m.cy) > EPS || Math.abs(z.hw - B.size / 2) > EPS || Math.abs(z.hh - B.size / 2) > EPS) fail(where + ': balZones(' + sd + ')[' + i + '] ' + JSON.stringify(z) + ' is not the block drawn there'); });
          });
          if (zL.concat(zR).some(z => hit(padded(trayZ), padded(z)))) fail(where + ': the tray and pan zones overlap once widened — a drop could land in either');
          if (zL.some(a => zR.some(b => hit(padded(a), padded(b))))) fail(where + ': a left-pan box and a right-pan box overlap once widened');
          /* 空的地方：中間的空隙、積木上面、單數時旁邊那一格 */
          const gap = [{ x:145, y:150 }, { x:150, y:150 }, { x:155, y:150 }, { x:150, y:20 }, { x:150, y:100 }];
          [['L', mL + 1], ['R', nR]].forEach(([sd, n]) => {
            const above = myCell(sd, n % 2 ? n + 1 : n, t); gap.push({ x:above.cx, y:above.cy });   /* 下一排的那一格 */
            if (n % 2){ const side = myCell(sd, n, t); gap.push({ x:side.cx, y:side.cy }); }   /* 單數：旁邊那一格 */
          });
          gap.forEach(p => { if (p.y > 0 && zL.concat(zR).some(z => inPad(z, p))) fail(where + ': the empty point (' + Math.round(p.x) + ', ' + Math.round(p.y) + ') belongs to a pan — a drop there would be judged as "moved to the other pan"'); });
          swept++; sweepNearest('bal ' + where, [trayZ].concat(zL, zR), B.pad, H);
        };
        /* 拿走盤裡的小積木（每邊最多 3 塊）在盤子裡、不碰到標題 */
        const capY = B.tray.cy - B.tray.hh + 4, cap = { x:B.tray.cx - 100, y:capY, w:200, h:26 };
        if (!new RegExp("addZone\\(B, BAL\\.tray\\.cx - 100, BAL\\.tray\\.cy - BAL\\.tray\\.hh \\+ 4, 200, 26, 'gcap', d\\.gBalTray\\);").test(RB.bal)) fail('GAME bal: the tray caption is not where this check expects it');
        const chipM = RB.bal.match(/addZone\(B, \(side === 'L' \? (\d+) : (\d+)\) \+ n \* (\d+), BAL\.tray\.cy - 1, BAL\.chip, BAL\.chip, 'gchip', String\(u\)\)/);
        if (!chipM) fail('GAME bal: cannot read where the taken blocks go in the tray');
        else {
          const chips = [];
          [0, 1].forEach(s => [0, 1, 2].forEach(n => chips.push({ x:+chipM[1 + s] + n * +chipM[3], y:B.tray.cy - 1, w:B.chip, h:B.chip })));
          chips.forEach((c, i) => { if (!(c.x >= tray.x + 3 && c.x + c.w <= tray.x + tray.w - 3 && c.y >= tray.y + 3 && c.y + c.h <= tray.y + tray.h - 3)) fail('GAME bal: tray chip ' + i + ' is not inside the tray'); if (hit(c, cap)) fail('GAME bal: tray chip ' + i + ' covers the tray caption'); });
          noHits(chips, 'bal tray chips', 2);
        }
        if (!(D.balTilt(5, 3) === 1 && D.balTilt(3, 5) === -1 && D.balTilt(4, 4) === 0)) fail('GAME balTilt(): heavier left should be 1, heavier right −1, equal 0');
        D.GAME_BAL.forEach(entry => {
          const [u, m, n] = entry, where = 'GAME bal [' + entry + ']', X = (n - m) * u;
          if (!(isInt(u) && u >= 2 && u <= 10 && m >= 2 && m <= 3 && n - m >= 2 && n <= 6)) fail(where + ': needs 2..3 blocks on the left, at most 6 on the right, at least 2 more on the right, each 2..10 g');
          if (D.balBag(u, m, n) !== X) fail(where + ': balBag ' + D.balBag(u, m, n) + ' != (n − m) × u = ' + X);
          /* 位置：每一種歪法，每一個位置都在自己的盤子上（盤面上方）、在範圍裡、互不重疊、不出界 */
          [-1, 0, 1].forEach(t => {
            const plate = side => B.plateY + (side === 'L' ? t : -t) * B.tilt;
            const spots = [];
            for (let i = 0; i <= m; i++) spots.push(['L', i]);
            for (let i = 0; i < n; i++) spots.push(['R', i]);
            const boxes = spots.map(([s, i]) => { const p = D.balSpot(s, i, t); return { s:s, i:i, b:box(p.cx, p.cy, B.size, B.size) }; });
            boxes.forEach(o => {
              inside(o.b, where + ' ' + o.s + i2s(o.i) + ' (tilt ' + t + ')', H, 2);
              const gap = plate(o.s) - (o.b.y + o.b.h), rows = (gap - 4) / B.cell;
              if (Math.abs(rows - Math.round(rows)) > EPS || rows < -EPS) fail(where + ': ' + o.s + i2s(o.i) + ' does not sit on its plate row (tilt ' + t + ')');
              const zs = D.balZones(o.s, o.s === 'L' ? m + 1 : n, t), z = zs && zs[o.i];
              if (!z || Math.abs(o.b.x - (z.cx - z.hw)) > EPS || Math.abs(o.b.y - (z.cy - z.hh)) > EPS || Math.abs(o.b.w - 2 * z.hw) > EPS || Math.abs(o.b.h - 2 * z.hh) > EPS) fail(where + ': ' + o.s + i2s(o.i) + ' is not covered by its own drop box (tilt ' + t + ')');
            });
            noHits(boxes.map(o => o.b), where + ' blocks (tilt ' + t + ')', 4);
          });
          /* 每一句說明 */
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gBalAsk', L, d.gBalAsk(u), [u]);
            say(where + ' gBalDone', L, d.gBalDone(n - m, u, X), [n - m, n - m, u, X, X]);
            ['L', 'R'].forEach(s => {
              const me = L === 'zh' ? (s === 'L' ? '左' : '右') : (s === 'L' ? 'left' : 'right'), other = L === 'zh' ? (s === 'L' ? '右' : '左') : (s === 'L' ? 'right' : 'left');
              say(where + ' gBalLight ' + s, L, d.gBalLight(s, u), [u]);
              has(where + ' gBalLight ' + s, L, d.gBalLight(s, u), { zh:[me + '邊已經比較輕', '先從' + other + '邊拿走'], en:['The ' + me + ' side is already lighter', 'off the ' + other] });
              say(where + ' gBalMove ' + s, L, d.gBalMove(s, u), [u, u]);
              say(where + ' gBalOkTilt ' + s, L, d.gBalOkTilt(s, u), L === 'zh' ? [u, u] : [u, u]);
              has(where + ' gBalOkTilt ' + s, L, d.gBalOkTilt(s, u), { zh:[me + '邊拿走了', '天平往' + other + '歪', other + '邊也要拿走'], en:['off the ' + me, 'tips ' + other, 'off the ' + other + ' too'] });
              say(where + ' gBalOkLevel ' + s, L, d.gBalOkLevel(s, u), [u]);
              has(where + ' gBalOkLevel ' + s, L, d.gBalOkLevel(s, u), { zh:[me + '邊也拿走了', '又平了'], en:['off the ' + me + ' too', 'level again'] });
              say(where + ' gBal2Tilt ' + s, L, d.gBal2Tilt(s), []);
              has(where + ' gBal2Tilt ' + s, L, d.gBal2Tilt(s), { zh:[me + '邊比較重', '從' + me + '邊拿走'], en:['The ' + me + ' side is heavier', 'off the ' + me] });
            });
          });
          /* 照遊戲的規則把所有拿法走完：狀態 (mL, nR)；每一步試每一邊的一塊 × 每一個去處 */
          const seen = new Set(), stack = [[m, n]];
          let finals = 0;
          while (stack.length){
            const [mL, nR] = stack.pop(), key = mL + ',' + nR;
            if (seen.has(key)) continue;
            seen.add(key);
            const wL = X + mL * u, wR = nR * u, tilt = D.balTilt(wL, wR);
            zoneState(where + ' state ' + key, mL, nR, tilt);
            if (mL === 0 && tilt === 0){ finals++; if (nR !== n - m || nR * u !== X) fail(where + ': solved with ' + nR + ' blocks on the right — expected ' + (n - m)); continue; }
            if (Math.abs(wL - wR) > u + EPS) fail(where + ': state ' + key + ' tips by more than one block (' + wL + ' vs ' + wR + ')');
            let moves = 0;
            [['L', mL], ['R', nR]].forEach(([s, cnt]) => {
              if (!cnt) return;
              ['tray', 'L', 'R'].forEach(tg => {
                const mine = s === 'L' ? wL : wR, oth = s === 'L' ? wR : wL;
                const want = tg === s ? 'stay' : (tg !== 'tray' ? 'move' : (mine < oth ? 'light' : null));
                const got = D.balRefuse(s, tg, wL, wR);
                if (got !== want) fail(where + ': state ' + key + ', a ' + s + ' block to ' + tg + ': balRefuse ' + got + ', expected ' + want);
                if (got === null){ moves++; stack.push(s === 'L' ? [mL - 1, nR] : [mL, nR - 1]); }
              });
            });
            if (!moves) fail(where + ': stuck at state ' + key + ' (no block can be taken)');
            /* 讀數那一行與第二層提示 */
            LANGS.forEach(L => {
              const d = I18N[L], line = d.gBalNow(d.gBalLeft(mL * u), wR, tilt);
              say(where + ' gBalNow ' + key, L, line, mL ? [mL * u, wR] : [wR]);
              if (tilt === 0 && !/[＝=]/.test(line)) fail(where + ' gBalNow ' + key + ' ' + L + ': level but no "=": ' + line);
              if (tilt > 0) has(where + ' gBalNow ' + key, L, line, { zh:['重', '往左歪'], en:['heavier', 'tips left'] });
              if (tilt < 0) has(where + ' gBalNow ' + key, L, line, { zh:['輕', '往右歪'], en:['lighter', 'tips right'] });
              if (tilt === 0) say(where + ' gBal2Level ' + key, L, d.gBal2Level(mL), [mL]);
            });
          }
          if (finals !== 1) fail(where + ': ' + finals + ' finishing states reachable (expected exactly 1)');
          if (seen.size < 2 * m + 1) fail(where + ': only ' + seen.size + ' states reachable');
        });
        if (swept < 40) fail('GAME bal: only ' + swept + ' balance states had their drop boxes swept (every reachable state of every pool entry should be)');
      }
      function i2s(i){ return '#' + i; }

      /* ================= 第 2 關：紙條 ================= */
      {
        const S = D.SPLIT, H = D.SPLIT_H;
        tooSmall('split grip', D.GPICK);
        if (!(S.gripY - D.GPICK / 2 >= S.rowY + S.rowH && S.gripY + D.GPICK / 2 <= S.ry - 6)) fail('GAME split: the grip covers the strip or the ruler');
        if (!(S.bagY + S.bag / 2 + 6 <= S.totY - 8 - 12)) fail('GAME split: the bags run into the total label');
        if (!(S.ry + 26 + 4 <= H)) fail('GAME split: the ruler labels run off the board');
        if (!(S.band[0] <= S.totY && S.band[1] >= S.ry + 26)) fail('GAME split: the tap band does not cover the strips and the ruler');
        D.GAME_SPLIT.forEach(entry => {
          const [k, q] = entry, T = k * q, where = 'GAME split [' + entry + ']';
          if (!(k >= 2 && k <= 5 && q >= 5 && T <= 48)) fail(where + ': k 2..5, one part ≥ 5, T ≤ 48');
          const step = S.w / T;
          if (!(step >= 4.5)) fail(where + ': ticks only ' + step.toFixed(2) + 'px apart');
          /* 吸附：每 0.25px 和自己的「最近的刻度」比；每一個刻度自己一格 */
          for (let x = S.x0 - 20; x <= S.x0 + S.w + 20; x += 0.25){
            const mine = Math.max(0, Math.min(T, Math.round((x - S.x0) / step)));
            if (D.splitSnap(T, x) !== mine){ fail(where + ': splitSnap(' + x + ') = ' + D.splitSnap(T, x) + ', the nearest tick is ' + mine); break; }
          }
          for (let v = 0; v <= T; v++) if (Math.abs(D.splitX(T, v) - (S.x0 + v * step)) > EPS){ fail(where + ': splitX(' + v + ') is not on the ruler'); break; }
          const lb = D.splitLabels(T);
          if (lb[0] !== 0 || lb[lb.length - 1] !== T || lb.some((l, i) => i && (l - lb[i - 1]) * step < 28) || lb.slice(0, -1).some(l => l % 10)) fail(where + ': ruler labels ' + lb + ' are not 0, every 10 and T, at least 28px apart');
          const r0 = D.splitRefuse(k, q, q);
          if (r0 !== null) fail(where + ': the right part ' + q + ' is refused');
          if (!(T - k > 0 && T - k <= T && T - k !== q)) fail(where + ': the "subtract" part T − k = ' + (T - k) + ' cannot be reached or is the answer');
          for (let v = 1; v <= T; v++){
            const r = D.splitRefuse(k, q, v), x = v * k;
            if (v === q){ if (r !== null) fail(where + ': ' + v + ' refused'); continue; }
            if (!r || r.x !== x || r.less !== (x < T) || r.diff !== Math.abs(T - x) || r.sub !== (v === T - k)) { fail(where + ': splitRefuse(' + v + ') = ' + JSON.stringify(r) + ', expected x ' + x + ', less ' + (x < T) + ', diff ' + Math.abs(T - x) + ', sub ' + (v === T - k)); continue; }
            LANGS.forEach(L => {
              const d = I18N[L], t = d.gSplitBad(k, v, x, T, r.less, r.diff);
              say(where + ' gSplitBad(' + v + ')', L, t, L === 'zh' ? [k, v, x, T, r.diff] : [k, v, x, r.diff, T]);
              has(where + ' gSplitBad(' + v + ')', L, t, r.less ? { zh:['少'], en:['less than'] } : { zh:['多'], en:['more than'] });
              hasNot(where + ' gSplitBad(' + v + ')', L, t, r.less ? { zh:[' 多 '], en:['more than'] } : { zh:[' 少 '], en:['less than'] });
              if (r.sub) say(where + ' gSplitSub', L, d.gSplitSub(T, k, v), [T, k, v, k, k, T, k]);
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gSplitAsk', L, d.gSplitAsk(k, T), [k, T]);
            say(where + ' gSplitDone', L, d.gSplitDone(k, T, q), [k, q, T, T, k, q, q, k]);
            say(where + ' gSplit2', L, d.gSplit2(k, T), [T, k, T, k]);
            say(where + ' gSplitNow', L, d.gSplitNow(q), [q]);
          });
        });
      }

      /* ================= 第 3 關：拼算式 ================= */
      {
        const Bd = D.BUILD, H = D.BUILD_H;
        tooSmall('build card', Math.min(Bd.cardW, Bd.cardH)); tooSmall('build box', Math.min(Bd.opW, Bd.h));
        if (!(Bd.cardH >= D.GPICK && Bd.cardW >= D.GPICK)) fail('GAME build: cards smaller than GPICK');
        const slotBoxes = [0, 1, 2].map(i => box(Bd.slotX[i], Bd.rowY, i === 1 ? Bd.opW : Bd.numW, Bd.h));
        slotBoxes.forEach((b, i) => inside(b, 'build box ' + i, H, 2));
        noHits(slotBoxes.concat([{ x:Bd.eqX[0], y:Bd.rowY - Bd.h / 2, w:Bd.eqX[1] - Bd.eqX[0], h:Bd.h }]), 'build boxes and the "= result" text', 4);
        const tray = [];
        Bd.cardY.forEach(y => Bd.cardX.forEach(x => tray.push(box(x, y, Bd.cardW, Bd.cardH))));
        tray.forEach((b, i) => inside(b, 'build tray card ' + i, H, 2));
        noHits(tray.concat(slotBoxes), 'build tray cards and boxes', 6);
        if (tray.length !== 6) fail('GAME build: the tray has room for ' + tray.length + ' cards, needs 6');
        const zones = slotBoxes.map((b, i) => ({ k:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2 }));
        sweepNearest('build', zones, Bd.pad, H);
        /* 這裡自己的故事模型：從故事的字讀出關係（不讀頁面的 t），數字從故事讀 */
        const KIND = {
          zh:[['add', /又放上/], ['sub', /花了/], ['mul', /每盒有/], ['div', /平分給/], ['more', /比\S+多 \d+/], ['less', /比\S+少 \d+/]],
          en:[['add', /more were put on/], ['sub', /spent/], ['mul', /Each box holds/], ['div', /shared equally/], ['more', /\d+ more than/], ['less', /\d+ fewer than/]]
        };
        const ids = new Set();
        D.GAME_BUILD.forEach(e => {
          const where = 'GAME build ' + e.id;
          if (ids.has(e.id)) fail(where + ': duplicate story id');
          ids.add(e.id);
          let model = null;
          LANGS.forEach(L => {
            const story = I18N[L].gBuildStory[e.id];
            if (typeof story !== 'string'){ fail(where + ' ' + L + ': no story'); return; }
            say(where + ' story', L, story, null);
            if ((story.match(/☐/g) || []).length !== 1) fail(where + ' ' + L + ': the story must name ☐ exactly once');
            const kinds = KIND[L].filter(([, re]) => re.test(story)).map(([k]) => k);
            if (kinds.length !== 1){ fail(where + ' ' + L + ': the story reads as ' + (kinds.join('/') || 'nothing') + ' — "' + story + '"'); return; }
            const n = nums(story), kind = kinds[0];
            /* 數在故事裡出現的順序：add/sub/mul/div 是 a 然後結果；more/less 是 a 然後 b */
            const a = n[0], b = n[1];
            const m = { add:{ ok:[['X', '+', a], [a, '+', 'X']], R:b, x:b - a }, sub:{ ok:[['X', '-', a]], R:b, x:b + a }, mul:{ ok:[[a, '*', 'X'], ['X', '*', a]], R:b, x:b / a },
                        div:{ ok:[['X', '/', a]], R:b, x:a * b }, more:{ ok:[[a, '+', b], [b, '+', a]], R:'X', x:a + b }, less:{ ok:[[a, '-', b]], R:'X', x:a - b } }[kind];
            if (n.length !== 2) fail(where + ' ' + L + ': the story should have exactly two numbers, has ' + n.join());
            if (!(isInt(m.x) && m.x > 0)) fail(where + ' ' + L + ': ☐ = ' + m.x + ' is not a positive whole number');
            m.kind = kind;
            if (model && JSON.stringify(model) !== JSON.stringify(m)) fail(where + ': zh and en stories describe different equations');
            model = model || m;
          });
          if (!model) return;
          const r = D.buildRule(e);
          if (r.X !== model.x || String(r.R) !== String(model.R) || e.t !== model.kind) fail(where + ': buildRule says ☐ = ' + r.X + ' (result ' + r.R + ', ' + e.t + '); the story says ☐ = ' + model.x + ' (result ' + model.R + ', ' + model.kind + ')');
          const cards = D.buildCards(e);
          const numCards = cards.filter(c => c.k === 'n').map(c => c.v), opCards = cards.filter(c => c.k === 'o').map(c => c.v);
          const wantNums = model.kind === 'more' || model.kind === 'less' ? [model.ok[0][0], model.ok[0][2]] : ['X', model.ok[0][0] === 'X' ? model.ok[0][2] : model.ok[0][0]];
          if (numCards.slice().sort().join() !== wantNums.slice().sort().join() || opCards.join() !== '+,-,*,/') fail(where + ': cards ' + JSON.stringify(cards) + ' should be ' + wantNums + ' and + − × ÷');
          /* 每一張卡 × 每一格：收不收和自己的模型一致 */
          cards.forEach(c => [0, 1, 2].forEach(s => {
            const okHere = model.ok.some(t => t[s] === c.v);
            const want = (s === 1) !== (c.k === 'o') ? 'kind' : okHere ? null : (s === 1 ? 'op' : 'pos');
            const got = D.buildRefuse(e, s, c);
            if (got !== want) fail(where + ': buildRefuse(box ' + s + ', ' + JSON.stringify(c) + ') = ' + got + ', expected ' + want);
          }));
          /* 6 張卡放進 3 格的每一種放法：每一格都收下的，剛好就是對的算式 */
          let accepted = 0;
          cards.forEach(c0 => cards.forEach(c1 => cards.forEach(c2 => {
            if (c0 === c1 || c1 === c2 || c0 === c2) return;
            if (D.buildRefuse(e, 0, c0) || D.buildRefuse(e, 1, c1) || D.buildRefuse(e, 2, c2)) return;
            accepted++;
            if (!model.ok.some(t => t[0] === c0.v && t[1] === c1.v && t[2] === c2.v)) fail(where + ': the fill ' + [c0.v, c1.v, c2.v] + ' is accepted but is not the story’s equation');
          })));
          if (accepted !== model.ok.length) fail(where + ': ' + accepted + ' fills accepted, the story has ' + model.ok.length);
          /* pos 只會發生在減法與除法：那一種故事一定有一句為什麼 */
          const canPos = cards.some(c => [0, 2].some(s => D.buildRefuse(e, s, c) === 'pos'));
          LANGS.forEach(L => {
            const d = I18N[L], act = d.gBuildAct[e.id], need = d.gOp[model.ok[0][1]];
            if (typeof act !== 'string'){ fail(where + ' ' + L + ': no gBuildAct'); return; }
            say(where + ' gBuildAct', L, act, null);
            if (nums(act).some(x => nums(d.gBuildStory[e.id]).indexOf(x) < 0)) fail(where + ' ' + L + ': gBuildAct names a number that is not in the story: ' + act);
            D.OPS.filter(o => o !== model.ok[0][1]).forEach(o => {
              const t = d.gBuildOp(act, need, d.gOp[o]);
              say(where + ' gBuildOp ' + o, L, t, null);
              if (t.indexOf(need) < 0 || t.indexOf(d.gOp[o]) < 0 || t.indexOf(need) > t.indexOf(d.gOp[o])) fail(where + ' gBuildOp ' + L + ': should say "needs ' + need + ', not ' + d.gOp[o] + '": ' + t);
            });
            if (canPos){
              const p = d.gBuildPos[e.id];
              if (typeof p !== 'string') fail(where + ' ' + L + ': a number can be refused for its side but there is no gBuildPos');
              else { say(where + ' gBuildPos', L, p, null); has(where + ' gBuildPos', L, p, { zh:['前面'], en:['before'] }); has(where + ' gBuildPos', L, p, { zh:[need], en:[need] }); }
            } else if (d.gBuildPos[e.id] !== undefined) fail(where + ' ' + L + ': gBuildPos exists but no number can be refused for its side');
            /* 解完的那一句：算式、用它算 ☐ */
            const t0 = model.ok[0], face = v => v === 'X' ? '☐' : (typeof v === 'number' ? String(v) : d.gOp[v]);
            const eq = face(t0[0]) + ' ' + face(t0[1]) + ' ' + face(t0[2]) + ' ' + (L === 'zh' ? '＝ ' : '= ') + face(model.R);
            const inv = { add:[model.R, '-', t0[2]], sub:[model.R, '+', t0[2]], mul:[model.R, '/', t0[0]], div:[model.R, '*', t0[2]], more:[t0[0], '+', t0[2]], less:[t0[0], '-', t0[2]] }[model.kind];
            const calc = inv[0] + ' ' + d.gOp[inv[1]] + ' ' + inv[2];
            if ((inv[1] === '+' ? inv[0] + inv[2] : inv[1] === '-' ? inv[0] - inv[2] : inv[1] === '*' ? inv[0] * inv[2] : inv[0] / inv[2]) !== model.x) fail(where + ': the inverse calculation does not give ☐');
            const done = d.gBuildDone(eq, calc, model.x);
            say(where + ' gBuildDone', L, done, nums(eq).concat([inv[0], inv[2], model.x, model.x]));
            if (!new RegExp('[(（]?' + inv[0] + ' [' + d.gOp[inv[1]] + '] ' + inv[2]).test(done)) fail(where + ' gBuildDone ' + L + ': does not compute ☐ with ' + calc);
            say(where + ' gBuild2Op', L, d.gBuild2Op(act, need), null);
          });
          /* RENDER 用同一套：答案 calc 的寫法要和這裡一樣 */
          unsortedOk('build ' + e.id + ' tray', () => D.unsorted(D.buildCards(e), l => D.buildInOrder(e, l)), l => model.ok.some(t => l[0].v === t[0] && l[1].v === t[1] && l[2].v === t[2]), 2000);
        });
        need('build', /var inv = e\.t === 'add' \? \[e\.r, '-', e\.a\] : e\.t === 'sub' \? \[e\.r, '\+', e\.a\] : e\.t === 'mul' \? \[e\.r, '\/', e\.a\] : e\.t === 'div' \? \[e\.r, '\*', e\.a\] : e\.t === 'more' \? \[e\.a, '\+', e\.b\] : \[e\.a, '-', e\.b\];/, 'the solved message does not undo the story with the opposite operation');
        if (D.GAME_BUILD.map(e => e.t).sort().join() !== 'add,div,less,more,mul,sub') fail('GAME build: the six stories should be one of each kind (add, sub, mul, div, more, less)');
        LANGS.forEach(L => { say('gBuildKind', L, I18N[L].gBuildKind, []); say('gBuild2Rest', L, I18N[L].gBuild2Rest, []); say('gBuildHow', L, I18N[L].gBuildHow, []); });
      }

      /* ================= 第 4 關：甲乙表 ================= */
      {
        ['0', '7', '12', ' 9 ', '999'].forEach(s => { if (D.readInt(s) !== +s.trim()) fail('GAME readInt("' + s + '") should be ' + s.trim()); });
        ['', ' ', '07', '1 2', '1.5', '-3', '12a', '1,2', '1000', '+4'].forEach(s => { if (D.readInt(s) !== null) fail('GAME readInt("' + s + '") should be refused (null), got ' + D.readInt(s)); });
        D.GAME_TABLE.forEach(entry => {
          const [op, k, b1, b2, a3] = entry, where = 'GAME table [' + entry + ']';
          const A = b => op === '+' ? b + k : b - k, Bv = a => op === '+' ? a - k : a + k;
          if (['+', '-'].indexOf(op) < 0) fail(where + ': op should be + or − (the lesson’s 甲 ＝ 乙 ＋ 8)');
          const cells = [A(b1), A(b2), Bv(a3)];
          if (cells.some(v => !(isInt(v) && v > 0 && v < 100))) fail(where + ': the answers ' + cells + ' are not whole numbers 1..99');
          if (D.tableA(op, k, b1) !== cells[0] || D.tableA(op, k, b2) !== cells[1] || D.tableB(op, k, a3) !== cells[2]) fail(where + ': tableA/tableB disagree with A = B ' + op + ' ' + k);
          if (new Set([b1, b2, Bv(a3)]).size !== 3) fail(where + ': two columns have the same B');
          /* 三種迷思都打得出來（正整數）、都不是答案 */
          const flip = op === '+' ? b1 - k : b1 + k, times = b1 * k, again = op === '+' ? a3 + k : a3 - k;
          [['flip (column 1)', flip, cells[0]], ['times (column 1)', times, cells[0]], ['again (column 3)', again, cells[2]]].forEach(([nm, v, ans]) => {
            if (!(isInt(v) && v > 0 && v <= 999 && v !== ans)) fail(where + ': the ' + nm + ' misconception value ' + v + ' cannot be typed or equals the answer');
          });
          if (D.tableMiss(op, k, 0, b1, flip) !== 'flip' || D.tableMiss(op, k, 0, b1, times) !== 'times' || D.tableMiss(op, k, 2, a3, again) !== 'again') fail(where + ': tableMiss does not name the three misconceptions');
          /* 每一個打得出來的錯值，說明要成立 */
          for (let col = 0; col < 3; col++){
            const given = [b1, b2, a3][col], ans = cells[col];
            for (let v = 0; v <= 999; v++){
              if (v === ans) continue;
              const kind = D.tableMiss(op, k, col, given, v);
              const mine = col === 2 ? (v === (op === '+' ? given + k : given - k) ? 'again' : 'other') : (v === (op === '+' ? given - k : given + k) ? 'flip' : v === given * k ? 'times' : 'other');
              if (kind !== mine){ fail(where + ': tableMiss(col ' + col + ', ' + v + ') = ' + kind + ', expected ' + mine); continue; }
              if (v % 7 && kind === 'other' && v > 120) continue;   /* 0～120 每一個都驗說明；更大的每 7 個一個（分類本身 0～999 全驗） */
              LANGS.forEach(L => {
                const d = I18N[L], sym = L === 'zh' ? '' : '';
                let t, want, words;
                if (kind === 'again'){ t = d.gTableAgain(op, k, given, v); want = [v, given, k, k, k]; words = { zh:[op === '+' ? '又加了一次' : '又減了一次', op === '+' ? '用減的' : '用加的'], en:[op === '+' ? 'added again' : 'subtracted again', op === '+' ? 'subtract' : 'add.'] }; }
                else if (kind === 'flip'){ t = d.gTableFlip(op, k, given, v); want = L === 'zh' ? [v, given, k, k, k] : [v, k, given, k, k]; words = { zh:[op === '+' ? '少 ' + k : '多 ' + k, op === '+' ? '甲要比乙多' : '甲要比乙少'], en:[op === '+' ? k + ' less than B' : k + ' more than B', op === '+' ? 'A is ' + k + ' more than B' : 'A is ' + k + ' less than B'] }; }
                else if (kind === 'times'){ t = d.gTableTimes(op, k, given, v); want = [v, given, k, k, k, k]; words = { zh:['倍'], en:['times as many'] }; }
                else if (col < 2){
                  t = d.gTableOtherA(op, k, given, v);
                  want = v === given ? [k, given, given, k, v, given] : [k, given, given, k, v, given, Math.abs(v - given)];
                  words = { zh:[v > given ? '比 ' + given + ' 多 ' + (v - given) : v < given ? '比 ' + given + ' 少 ' + (given - v) : '一樣'], en:[v > given ? (v - given) + ' more than ' + given : v < given ? (given - v) + ' less than ' + given : 'the same as'] };
                  if (L === 'en') want = v === given ? [k, given, k, given, v, given] : [k, given, k, given, v, Math.abs(v - given), given];
                } else {
                  t = d.gTableOtherB(op, k, given, v);
                  const res = op === '+' ? v + k : v - k;
                  want = op === '-' && v < k ? [v, v, k, given] : [v, v, k, res, given];
                  words = { zh:['不是 ' + given], en:['not ' + given] };
                  /* 代回去算出來的甲，真的不是表上的甲 */
                  if (res === given) fail(where + ': gTableOtherB says ' + v + ' gives A ≠ ' + given + ' but it does');
                }
                say(where + ' col ' + col + ' typed ' + v + ' (' + kind + ')', L, t, want);
                has(where + ' col ' + col + ' typed ' + v, L, t, words);
              });
            }
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gTableRule', L, d.gTableRule(op, k), [k]);
            has(where + ' gTableRule', L, d.gTableRule(op, k), { zh:[op === '+' ? '甲 ＝ 乙 ＋ ' + k : '甲 ＝ 乙 − ' + k], en:[op === '+' ? 'A = B + ' + k : 'A = B − ' + k] });
            [b1, b2].forEach(b => { say(where + ' gTableOkA', L, d.gTableOkA(op, k, b, A(b)), [b, k, A(b)]); say(where + ' gTable2A', L, d.gTable2A(op, k, b), [b, b, k]); });
            say(where + ' gTableOkB', L, d.gTableOkB(op, k, a3, Bv(a3)), [a3, k, Bv(a3)]);
            has(where + ' gTableOkB', L, d.gTableOkB(op, k, a3, Bv(a3)), { zh:['相反的運算', op === '+' ? ' − ' : ' ＋ '], en:['opposite operation', op === '+' ? ' − ' : ' + '] });
            say(where + ' gTable2B', L, d.gTable2B(op, k, a3), [a3, a3, k]);
            has(where + ' gTable2B', L, d.gTable2B(op, k, a3), { zh:[op === '+' ? a3 + ' − ' + k : a3 + ' ＋ ' + k], en:[op === '+' ? a3 + ' − ' + k : a3 + ' + ' + k] });
            say(where + ' gTableDone', L, d.gTableDone(op, k), [k, k]);
            has(where + ' gTableDone', L, d.gTableDone(op, k), { zh:['乙 ＝ 甲 ' + (op === '+' ? '− ' : '＋ ') + k], en:['B = A ' + (op === '+' ? '− ' : '+ ') + k] });
          });
        });
        LANGS.forEach(L => { say('gTableBlank', L, I18N[L].gTableBlank, [0]); say('gTableAsk', L, I18N[L].gTableAsk, []); });
        need('table', /var cols = \[\{ b:e\[2\], a:tableA\(op, k, e\[2\]\), ask:'a' \}, \{ b:e\[3\], a:tableA\(op, k, e\[3\]\), ask:'a' \}, \{ a:e\[4\], b:tableB\(op, k, e\[4\]\), ask:'b' \}\];/, 'the table columns are not two "know B" and one "know A"');
        need('table', /var want = c\.ask === 'a' \? c\.a : c\.b;\n\s*if \(v !== want\)\{/, 'the table does not judge the number typed against the column’s own answer');
      }

      /* ================= 第 5 關：排一排 ================= */
      {
        const Rk = D.RANK, H = D.RANK_H;
        tooSmall('rank card', Math.min(Rk.w, Rk.h));
        const cardsB = Rk.rowY.map(y => box(Rk.cardX, y, Rk.w, Rk.h)), slotsB = Rk.rowY.map(y => box(Rk.slotX, y, Rk.w, Rk.h));
        cardsB.concat(slotsB).forEach((b, i) => inside(b, 'rank box ' + i, H, 2));
        noHits(cardsB.concat(slotsB), 'rank cards and boxes', 6);
        const caps = [{ x:Rk.slotX - Rk.w / 2, y:Rk.capTop[0], w:Rk.w, h:Rk.capTop[1] - Rk.capTop[0] }, { x:Rk.slotX - Rk.w / 2, y:Rk.capBot[0], w:Rk.w, h:Rk.capBot[1] - Rk.capBot[0] }];
        caps.forEach((c, i) => { inside(c, 'rank caption ' + i, H, 0); if (slotsB.some(b => hit(b, c))) fail('GAME rank: caption ' + i + ' overlaps a box'); });
        const zones = slotsB.map((b, i) => ({ i:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2 }));
        sweepNearest('rank', zones, Rk.pad, H);
        const myX = c => c[0] === 'add' ? c[2] - c[1] : c[0] === 'sub' ? c[2] + c[1] : c[0] === 'mul' ? c[2] / c[1] : c[2] * c[1];
        const again = c => c[0] === 'add' ? c[2] + c[1] : c[0] === 'sub' ? c[2] - c[1] : c[0] === 'mul' ? c[2] * c[1] : c[2] / c[1];
        D.GAME_RANK.forEach((set, si) => {
          const where = 'GAME rank set ' + si;
          if (set.map(c => c[0]).sort().join() !== 'add,div,mul,sub') fail(where + ': one equation of each operation');
          const xs = set.map(myX);
          if (xs.some(x => !(isInt(x) && x > 0 && x < 100)) || new Set(xs).size !== 4) fail(where + ': ☐ values ' + xs + ' are not four different whole numbers');
          set.forEach(c => { if (D.rankX(c) !== myX(c)) fail(where + ': rankX(' + c + ') = ' + D.rankX(c) + ', expected ' + myX(c)); if (D.rankOf(set, c) !== xs.filter(x => x < myX(c)).length) fail(where + ': rankOf(' + c + ') is wrong'); });
          if (set.some(c => c[1] < 2 || c[2] < 2 || (c[0] === 'sub' && c[2] < 1))) fail(where + ': every equation needs numbers ≥ 2');
          /* 「再做一次同一個運算」的迷思會排出不一樣的順序 —— 要真的算 ☐ 才排得對 */
          const order = arr => arr.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]).map(p => p[1]).join();
          if (order(set.map(again)) === order(xs)) fail(where + ': doing the same operation again gives the same order — the round does not catch the misconception');
          const sorted = set.slice().sort((a, b) => myX(a) - myX(b));
          if (!D.rankInOrder(sorted) || D.rankInOrder(sorted.slice().reverse())) fail(where + ': rankInOrder() is wrong');
          unsortedOk('rank set ' + si + ' tray', () => D.unsorted(set, D.rankInOrder), l => l.every((c, i) => !i || myX(l[i - 1]) <= myX(c)), 2000);
          LANGS.forEach(L => {
            const d = I18N[L];
            set.forEach(c => {
              const eq = d.gEq(c), inv = d.gInv(c), x = myX(c), k1 = xs.filter(v => v < x).length + 1;
              const sym = { add:L === 'zh' ? '＋' : '+', sub:'−', mul:'×', div:'÷' }[c[0]], isym = { add:'−', sub:L === 'zh' ? '＋' : '+', mul:'÷', div:'×' }[c[0]], eqs = L === 'zh' ? '＝' : '=';
              const wantEq = c[0] === 'mul' ? c[1] + ' × ☐ ' + eqs + ' ' + c[2] : '☐ ' + sym + ' ' + c[1] + ' ' + eqs + ' ' + c[2];
              if (eq !== wantEq) fail(where + ' gEq ' + L + ': "' + eq + '", expected "' + wantEq + '"');
              if (inv !== c[2] + ' ' + isym + ' ' + c[1]) fail(where + ' gInv ' + L + ': "' + inv + '", expected "' + c[2] + ' ' + isym + ' ' + c[1] + '"');
              say(where + ' gRankOk', L, d.gRankOk(eq, inv, x, k1), nums(eq).concat([c[2], c[1], x, k1]));
              for (let s = 1; s <= 4; s++) if (s !== k1) say(where + ' gRankBad', L, d.gRankBad(eq, inv, x, k1, s), nums(eq).concat([c[2], c[1], x, k1, s]));
              say(where + ' gRank2', L, d.gRank2(eq, inv), nums(eq).concat([c[2], c[1]]));
            });
            say(where + ' gRankDone', L, d.gRankDone(sorted.map(myX)), sorted.map(myX));
          });
        });
        LANGS.forEach(L => { ['gRankAsk', 'gRankTop', 'gRankBot', 'gRank2None'].forEach(k => say(k, L, I18N[L][k], [])); });
      }
    }
  }
};
