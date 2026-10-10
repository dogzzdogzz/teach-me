/* grade-5/math/time 的檢查設定（時間管理局：時刻 vs 時間量、60 進位、時間量的乘與除）。
   2026-10-10 新增 —— 和小遊戲「準時出發」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmtHM）、
   選項的形狀與範圍（從各產生器自己的參數推出來），renderCheck 把解釋裡的每一個等號用 timeClaims() 重算。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）與範例 3、4 的逐步說明（mulSteps／divStepsConvert／divStepsBorrow 用頁面自己的範例資料呼叫）裡
     「數 ＝ 數」的每一個等號逐個重算 —— 時間量先換成分（「2 時 30 分」→ 150），只在一邊有單位時「5 時」可以是 5（4 ＋ 1 ＝ 5 時）。
     掃描器自己先跑正反例；驗過幾條要夠多。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的算法重算：
       點與段 —— 每一張卡 × 每一個位置（時刻只進那一點、時間量只進那一段而且是那一段的長度）；錯卡真的是「只數整點」而且不是答案；
                 分段數（到整點、整整幾時、剩下的分）加起來是那一段；判斷放進哪一格的範圍蓋住畫出來的格子、虛線與那一點、長條，
                 兩種範圍不重疊；整片畫板每 1px 用頁面的 nearestOpen() 和這裡自己的「最近的那一塊」比。
       滿 60 進位 —— 0～3 時 × 0～130 分每一組打法，收不收和這裡自己的規則一致；readInt() 只收寫法正常的整數。
       一天一天疊起來 —— 六張卡兩兩不同、每一張 × 每一格；每一句「為什麼不收」說的那件事要成立（還滿 60、比 A 多、不是 60 的倍數……）。
       把時間平分 —— shareSnap 每 0.25px 和這裡自己的「吸到最近的 5 分」比；每一個 5 分的一份按一次「就是這個」：少／多、差多少、
                 「忘了借位」「當成 320 分」只在那件事成立時才說。
       由短排到長 —— 每一張 × 每一格；每一組都有「讀成 140」會排反的兩張。
     每一句說明兩種語言逐個比數字（這裡自己算的數字清單），說的那件事要成立；
     shuffle()、unsorted()、nearestOpen()、roundMiss()、roundAgain()、missOnce() 從原始碼切出來真的跑（missOnce 照 A、B、A、A、B 跑：只能扣兩次）；
     托盤 3000 次不出現答案的排法；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去／打進去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   換畫板保護、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-time 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const hmD = t => { const h = Math.floor(t / 60), m = t % 60; return h > 0 ? (m > 0 ? [h, m] : [h]) : [m]; };   /* 「1 時 40 分」「2 時」「50 分」印出來的數字 */
const clkD = t => [Math.floor(t / 60), t % 60];   /* 「3:40」印出來的數字（「3:00」的 00 讀成 0） */
const fmtZ = t => { const h = Math.floor(t / 60), m = t % 60; return h > 0 ? h + ' 時 ' + m + ' 分' : m + ' 分'; };
const fmtE = t => { const h = Math.floor(t / 60), m = t % 60; return h > 0 ? h + ' h ' + m + ' min' : m + ' min'; };
const clock = t => Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);

/* ---- 時間量的等號掃描 ----
   先把時刻（3:40）換成不是數字的記號；「1 時 25 分」「75 分」換成分鐘數 M、「5 時」「1.5 小時」記成 H（只有時）。
   再把每一個「左邊的算式 ＝ 右邊的算式」逐個算：兩邊都有單位 → H 一律 × 60；一邊有單位、一邊是純數字 → H 可以是 h 或 60h
   （「4 ＋ 1 ＝ 5 時」「3 時 ＝ 3 × 60」都對）。左邊的算式前面緊貼著文字（「進位的 2 時 ＝ 7 時」）不是一條完整的宣稱，算進 skipped。 */
function timeClaims(text){
  let t = String(text).replace(/<[^>]+>/g, ' ').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/＝/g, '=');
  t = t.replace(/\d{1,2}:\d\d/g, ' § ');
  /* 「3 ÷ 4 ＝ 0 餘 3」「3 ÷ 4 = 0 remainder 3」：商與餘數另外驗（q × b ＋ r ＝ a，r < b），驗完換成記號 */
  const out = { claims:[], skipped:0 };
  t = t.replace(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)\s*(?:餘|remainder)\s*(\d+)/g, (m, a, b, q, r) => {
    out.claims.push({ text:m, bad:(+q * +b + +r === +a && +r < +b) ? null : 'quotient and remainder do not check' });
    return ' § ';
  });
  t = t.replace(/(\d+)\s*(?:時|h)\s*(\d+)\s*(?:分鐘|分|min(?:utes?)?)/g, (m, h, mm) => ' M' + (+h * 60 + +mm) + ' ');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:分鐘|分|minutes?|min)(?![A-Za-z])/g, (m, x) => ' M' + x + ' ');
  t = t.replace(/(\d+(?:\.\d+)?)\s*(?:小時|時|hours?|h)(?![A-Za-z])/g, (m, x) => ' H' + x + ' ');
  const EXPR = /^[\s\d.+\-*/()MH]*$/;
  t.split(/[，。；;,\n：:]|(?:\s—\s)|——|—/).forEach(cl => {
    const seg = cl.split('=');
    for (let i = 0; i + 1 < seg.length; i++){
      const L = seg[i].match(/((?:[MH]?\d[\d.]*|[()])(?:\s*[+\-*/]?\s*(?:[MH]?\d[\d.]*|[()]))*)\s*$/), R = seg[i + 1].match(/^\s*((?:[MH]?\d[\d.]*|[()])(?:\s*[+\-*/]?\s*(?:[MH]?\d[\d.]*|[()]))*)/);
      if (!L || !R) continue;
      const before = seg[i].slice(0, seg[i].length - L[0].length);
      if (/[+\-*/]\s*$/.test(before) || (/\S$/.test(before) && !/[\s(（「]$/.test(before))){ out.skipped++; continue; }
      if (/[A-Za-z一-鿿]\s*$/.test(before)){ out.skipped++; continue; }
      const bal = x => (x.match(/\(/g) || []).length - (x.match(/\)/g) || []).length;
      let le = L[1].trim(), re = R[1].trim();
      while (bal(re) > 0 && /\(\s*$/.test(re)) re = re.replace(/\(\s*$/, '').trim();
      while (bal(re) < 0 && /\)\s*$/.test(re)) re = re.replace(/\)\s*$/, '').trim();
      while (bal(le) < 0 && /^\s*\)/.test(le)) le = le.replace(/^\s*\)/, '').trim();
      while (bal(le) > 0 && /^\s*\(/.test(le)) le = le.replace(/^\s*\(/, '').trim();
      if (!/\d/.test(le) || !/\d/.test(re) || bal(le) || bal(re)) continue;
      if (!EXPR.test(le) || !EXPR.test(re)) continue;
      const unit = s => /[MH]/.test(s);
      const ev = (s, hMul) => Function('return (' + s.replace(/M(\d[\d.]*)/g, '$1').replace(/H(\d[\d.]*)/g, '($1*' + hMul + ')').replace(/(\d)\s+(?=\d)/g, '$1+') + ')')();
      let ok = false, a, b;
      try {
        if (unit(le) && unit(re)){ a = ev(le, 60); b = ev(re, 60); ok = Math.abs(a - b) < 1e-9; }
        else if (unit(le) || unit(re)){ ok = [1, 60].some(k => Math.abs(ev(le, k) - ev(re, k)) < 1e-9); a = ev(le, 60); b = ev(re, 60); }
        else { a = ev(le, 1); b = ev(re, 1); ok = Math.abs(a - b) < 1e-9; }
      } catch (e){ out.claims.push({ text:le + ' = ' + re, bad:'cannot evaluate' }); continue; }
      out.claims.push({ text:le + ' = ' + re, bad:ok ? null : 'left is ' + a + ', right is ' + b });
    }
  });
  return out;
}

/* 選項換成分鐘數（時刻選項換成從 0:00 起算的分鐘數） */
function minutesOf(s, lang){
  let m;
  if (lang === 'zh'){
    if ((m = s.match(/^(\d+) 時 (\d+) 分$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) 分$/))) return +m[1];
  } else {
    if ((m = s.match(/^(\d+) h (\d+) min$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) min$/))) return +m[1];
  }
  return null;
}
const DUR_GENS = ['timeMulCarry', 'timeDivExact', 'timeRollover', 'decimalHourTrap'];

module.exports = {
  breaks: [
    { file:"index", expect:"GAME_ORDER should be", find:"var GAME_ORDER = ['span', 'carry', 'times', 'share', 'rank'];", replace:"var GAME_ORDER = ['carry', 'span', 'times', 'share', 'rank'];" },
    { file:"index", expect:"GPICK", find:"  var GPICK = 48;", replace:"  var GPICK = 44;" },
    { file:"index", expect:"shuffle(): only", find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足", replace:"      var k = j;   /* 自足" },
    { file:"index", expect:"starts in the answer order", find:"    if (inOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }\n", replace:"" },
    { file:"index", expect:"scoring: a round should give", find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:"index", expect:"a mistake does not cost 5", find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    elScore.textContent = gScore;" },
    { file:"index", expect:"shown although nothing was taken", find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:"index", expect:"does not clear the hint", find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:"index", expect:"nearestOpen(): a point inside", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"nearestOpen at", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"nearestOpen(): a drop nearest to a finished slot", find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:"index", expect:"board generation", find:"      if (gen !== gGen) return;   /* 這一張屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:"" },
    { file:"index", expect:"board generation", find:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; gGen++; BOARD_TAP = null; PIECE_PTR = {};", replace:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; BOARD_TAP = null; PIECE_PTR = {};" },
    { file:"index", expect:"fresh list of explained mistakes", find:"    gSolved = false; gMistake = false; gCtx = { bad:{} }; gGen++; BOARD_TAP = null; PIECE_PTR = {};", replace:"    gSolved = false; gMistake = false; gCtx.ask = null; gGen++; BOARD_TAP = null; PIECE_PTR = {};" },
    { file:"index", expect:"second finger", find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:"index", expect:"second finger can start a board tap", find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      if (false) return;   /* 第二根手指" },
    { file:"index", expect:"losing pointer capture", find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:"" },
    { file:"index", expect:"placed pieces still catch taps", find:"  .gpiece.locked{cursor:default;pointer-events:none}", replace:"  .gpiece.locked{cursor:default}" },
    { file:"index", expect:"does not snap to 5 minutes while it is dragged", find:"      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);", replace:"      if (o.axis === 'x') P.place(orig.x + dx, orig.y);" },
    { file:"index", expect:"another finger is still dragging", find:"      if (P.busy()) return;   /* 這一張正被另一根手指拖著", replace:"      if (false) return;   /* 這一張正被另一根手指拖著" },
    { file:"index", expect:"ahead mode", find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:"index", expect:"second level", find:"    if (hintLevel >= 2) gHintBtn.disabled = true;", replace:"" },
    { file:"index", expect:"roundNote() changes the score", find:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", replace:"  function roundNote(text){ gMistake = true; gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }" },
    { file:"index", expect:"wrong A, B, A, A, B should be charged twice", find:"    if (gCtx.bad[key]){ roundAgain(text); return; }", replace:"    if (gCtx.bad[key] === 1){ roundAgain(text); return; }" },
    { file:"index", expect:"wrong A, B, A, A, B should be charged twice", find:"    gCtx.bad[key] = true;\n    roundMiss(text);", replace:"    gCtx.bad = {}; gCtx.bad[key] = true;\n    roundMiss(text);" },
    { file:"index", expect:"roundAgain() charges again", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMistake = true; gScore = Math.max(0, gScore - 5); gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:"index", expect:"does not show the reason", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMsg.innerHTML = ''; }" },
    { file:"index", expect:"gDur(", find:"      gDur: function(t){ var h = Math.floor(t / 60), m = t % 60; return h > 0 ? (m > 0 ? h + ' 時 ' + m + ' 分' : h + ' 時') : m + ' 分'; },", replace:"      gDur: function(t){ var h = Math.floor(t / 60), m = t % 60; return h > 0 ? h + ' 時 ' + m + ' 分' : m + ' 分'; }," },
    { file:"index", expect:"gDur(", find:"      gDur: function(t){ var h = Math.floor(t / 60), m = t % 60; return h > 0 ? (m > 0 ? h + ' h ' + m + ' min' : h + ' h') : m + ' min'; },", replace:"      gDur: function(t){ var h = Math.floor(t / 100), m = t % 100; return h > 0 ? (m > 0 ? h + ' h ' + m + ' min' : h + ' h') : m + ' min'; }," },
    { file:"index", expect:"gClk(", find:"      gClk: function(t){ var h = Math.floor(t / 60), m = t % 60; return h + ':' + (m < 10 ? '0' + m : String(m)); },\n      gHints: {\n        span: '時刻", replace:"      gClk: function(t){ var h = Math.floor(t / 60), m = t % 60; return h + ':' + m; },\n      gHints: {\n        span: '時刻" },
    { file:"index", expect:"gPts zh", find:"      gPts: function(p){ return '分數 ＋' + p; },", replace:"      gPts: function(p){ return '分數 ＋20'; }," },
    { file:"index", expect:"gHints.rank zh: must say", find:"        rank: '先把每一段都換成分再比：1 時 ＝ 60 分，不是 100 分。'", replace:"        rank: '先把每一段都換成分再比。'" },
    { file:"index", expect:"gHints.share en: must say", find:"        share: 'First turn the whole length of time into minutes (1 hour = 60 minutes), then divide by the number of parts.',", replace:"        share: 'Divide each part by the number of parts.'," },
    { file:"index", expect:"s6lead zh does not say", find:"      s6lead: '點與段、滿 60 進位、一天一天疊起來、把時間平分、由短排到長 —— 五關五種玩法，練的都是上面的範例：<strong>時刻和時間量、60 進位、時間量的乘和除</strong>。", replace:"      s6lead: '點與段、滿 60 進位、一天一天疊起來、把時間平分、由短排到長 —— 五關五種玩法，每一關都在<strong>先統一成分再計算</strong>。" },
    { file:"index", expect:"the markup fallback is not the same sentence", find:"<p class=\"lead\" data-i18n=\"s6lead\">點與段、滿 60 進位", replace:"<p class=\"lead\" data-i18n=\"s6lead\">點與段，滿 60 進位" },
    { file:"index", expect:"must not say \"faster\"", find:"A wrong move costs points, but you are never out — thinking it through beats being fast.',", replace:"A wrong move costs points, but you are never out — the faster you answer, the more points you score.'," },
    { file:"index", expect:"is wrong (", find:"          why:'20 × 4 = 80 分，80 = 60 + 20，等於 1 時 20 分。' },", replace:"          why:'20 × 4 = 80 分，80 = 60 + 30，等於 1 時 20 分。' }," },
    { file:"index", expect:"is wrong (", find:"          why:'4 時 15 分 = 255 分，255 ÷ 3 = 85 分 = 1 時 25 分。' }", replace:"          why:'4 時 15 分 = 255 分，255 ÷ 3 = 85 分 = 1 時 35 分。' }" },
    { file:"index", expect:"is wrong (", find:"          why:'Minutes: 15 × 4 = 60 = 1 h 0 min (carry 1 hour). Hours: 1 × 4 = 4, plus the carried 1 = 5 hours. Answer: 5 h 0 min.' },", replace:"          why:'Minutes: 15 × 4 = 60 = 1 h 10 min (carry 1 hour). Hours: 1 × 4 = 4, plus the carried 1 = 5 hours. Answer: 5 h 0 min.' }," },
    { file:"index", expect:"is wrong (", find:"        var hDiv = Math.floor(h / parts), hRem = h % parts, borrowedM = hRem * 60;\n        var totalForDiv = borrowedM + m, perM = totalForDiv / parts;\n        var finalH = hDiv + Math.floor(perM / 60), finalM = perM % 60;\n        var final = finalH > 0 ? (finalH + ' 時 ' + finalM + ' 分') : (finalM + ' 分');", replace:"        var hDiv = Math.floor(h / parts), hRem = h % parts, borrowedM = hRem * 50;\n        var totalForDiv = borrowedM + m, perM = totalForDiv / parts;\n        var finalH = hDiv + Math.floor(perM / 60), finalM = perM % 60;\n        var final = finalH > 0 ? (finalH + ' 時 ' + finalM + ' 分') : (finalM + ' 分');" },
    { file:"index", expect:"without spaces", find:"          opts:['1 時 75 分','1 時 15 分','7 時 5 分','75 時'], ans:1,", replace:"          opts:['1時75分','1 時 15 分','7 時 5 分','75 時'], ans:1," },
    { file:"index", expect:"without spaces", find:"      dur: function(h, m, forceH){ return (h > 0 || forceH) ? (h + ' 時 ' + m + ' 分') : (m + ' 分'); },", replace:"      dur: function(h, m, forceH){ return (h > 0 || forceH) ? (h + '時' + m + '分') : (m + '分'); }," },
    { file:"index", expect:"EXAMPLE mulSteps", find:"        var mTotal = m * days, carry = Math.floor(mTotal / 60), remM = mTotal % 60;\n        var hMul = h * days, hFinal = hMul + carry;\n        return [\n          '題目：", replace:"        var mTotal = m * days, carry = Math.floor(mTotal / 100), remM = mTotal % 100;\n        var hMul = h * days, hFinal = hMul + carry;\n        return [\n          '題目：" },
    { file:"index", expect:"spanRefuse(", find:"    if (slotK === 'span') return card.k === 'clock' ? 'clockOnSpan' : (card.t !== e - s ? 'badDur' : null);", replace:"    if (slotK === 'span') return card.k === 'clock' ? 'clockOnSpan' : null;" },
    { file:"index", expect:"spanRefuse(", find:"    return card.t !== (slotK === 'start' ? s : e) ? 'otherPoint' : null;", replace:"    return null;" },
    { file:"index", expect:"spanRefuse(", find:"    if (card.k === 'dur') return 'durOnPoint';\n", replace:"" },
    { file:"index", expect:"spanDecoy", find:"  function spanDecoy(s, e){ return (Math.floor(e / 60) - Math.floor(s / 60)) * 60; }", replace:"  function spanDecoy(s, e){ return e - s + 10; }" },
    { file:"index", expect:"spanParts", find:"    var a = Math.ceil(s / 60) * 60, b = Math.floor(e / 60) * 60, out = [[s, a]];", replace:"    var a = Math.ceil(s / 60) * 60 + 10, b = Math.floor(e / 60) * 60, out = [[s, a]];" },
    { file:"index", expect:"the end minutes must be smaller", find:"var GAME_SPAN = [[3, 40, 140], [8, 40, 90],", replace:"var GAME_SPAN = [[3, 20, 140], [8, 40, 90]," },
    { file:"index", expect:"the stretch is only", find:"var GAME_SPAN = [[3, 40, 140], [8, 40, 90],", replace:"var GAME_SPAN = [[3, 40, 140], [8, 50, 80]," },
    { file:"index", expect:"is not on a 12-hour clock", find:"[9, 40, 140], [2, 40, 150]];", replace:"[10, 40, 140], [2, 40, 150]];" },
    { file:"index", expect:"start/end minutes must be 20, 30 or 40", find:"[9, 40, 140], [2, 40, 150]];", replace:"[9, 40, 130], [2, 40, 150]];" },
    { file:"index", expect:"zones of place", find:"               zones:[rect(x - SPAN.boxW / 2, SPAN.boxY, x + SPAN.boxW / 2, SPAN.boxY + SPAN.boxH), rect(x - SPAN_PIN, SPAN.boxY + SPAN.boxH, x + SPAN_PIN, low)] };", replace:"               zones:[rect(x - SPAN.boxW / 2, SPAN.boxY, x + SPAN.boxW / 2, SPAN.boxY + SPAN.boxH), rect(x - SPAN_PIN, SPAN.boxY + SPAN.boxH, x + SPAN_PIN, end)] };" },
    { file:"index", expect:"is not in its zone", find:"               zones:[rect(x - SPAN.boxW / 2, SPAN.boxY, x + SPAN.boxW / 2, SPAN.boxY + SPAN.boxH), rect(x - SPAN_PIN, SPAN.boxY + SPAN.boxH, x + SPAN_PIN, low)] };", replace:"               zones:[rect(x - SPAN.boxW / 2, SPAN.boxY, x + SPAN.boxW / 2, SPAN.boxY + SPAN.boxH), rect(x - SPAN_PIN, SPAN.boxY + SPAN.boxH, x + SPAN_PIN, top)] };" },
    { file:"index", expect:"is not in the stretch zone", find:"               zones:[rect(l, top, r, bot), rect(Math.min(l, mid - SPAN.durW / 2), low, Math.max(r, mid + SPAN.durW / 2), end)] });", replace:"               zones:[rect(l, top + 9, r, bot), rect(Math.min(l, mid - SPAN.durW / 2), low, Math.max(r, mid + SPAN.durW / 2), end)] });" },
    { file:"index", expect:"SPAN_PIN", find:"  var SPAN_PIN = 8;", replace:"  var SPAN_PIN = 14;" },
    { file:"index", expect:"boxes 0 and 1 overlap", find:"var SPAN = { x0:24, ppm:1.4, len:180, ry:150, boxW:64,", replace:"var SPAN = { x0:24, ppm:1.4, len:180, ry:150, boxW:72," },
    { file:"index", expect:"under 44", find:"boxW:64, boxH:46, boxY:22,", replace:"boxW:64, boxH:42, boxY:22," },
    { file:"index", expect:"runs through the", find:"var SPAN = { x0:24, ppm:1.4,", replace:"var SPAN = { x0:24, ppm:1.0," },
    { file:"index", expect:"span tray cards", find:"cardX:[77, 223], cardY:[262, 316], pad:12 };", replace:"cardX:[77, 200], cardY:[262, 316], pad:12 };" },
    { file:"index", expect:"span: the place judged", find:"        var sl = z.slot, c = P.data, why = spanRefuse(s, e, sl.k, c);", replace:"        var sl = slots[0], c = P.data, why = spanRefuse(s, e, sl.k, c);" },
    { file:"index", expect:"span: a refused card is not charged once", find:"          missOnce(sl.k + ':' + c.j, msg);\n          return false;", replace:"          roundMiss(msg);\n          return false;" },
    { file:"index", expect:"span: a placed card does not close every zone", find:"        sl.zones.forEach(function(q){ q.done = true; });\n", replace:"" },
    { file:"index", expect:"span: the round is not solved exactly", find:"        if (placed === 3) roundSolved(d.gSpanDone(clk(s), clk(e), d.gDur(e - s)));", replace:"        if (placed === 2) roundSolved(d.gSpanDone(clk(s), clk(e), d.gDur(e - s)));" },
    { file:"index", expect:"span: the round is not solved exactly", find:"        if (placed === 3) roundSolved(d.gSpanDone(clk(s), clk(e), d.gDur(e - s)));", replace:"        if (placed === 4) roundSolved(d.gSpanDone(clk(s), clk(e), d.gDur(e - s)));" },
    { file:"index", expect:"span: the tray is not shuffled", find:"      unsorted(spanCards(s, e), spanInOrder).forEach(function(c, j){", replace:"      spanCards(s, e).forEach(function(c, j){" },
    { file:"index", expect:"span: \"this point is …\" does not describe", find:"d.gSpanOtherPoint(text(c), H0 + Math.floor(sl.t / 60), sl.t % 60)", replace:"d.gSpanOtherPoint(text(c), H0 + Math.floor(c.t / 60), c.t % 60)" },
    { file:"index", expect:"span: the hour labels", find:"        if (hr) gText(svg, x, SPAN.ry - 18, clk(t), { 'font-size':13, 'class':'ghourlbl' });", replace:"        if (hr) gText(svg, x, SPAN.ry - 18, d.gClk(t), { 'font-size':13, 'class':'ghourlbl' });" },
    { file:"index", expect:"gSpanBadDur zh", find:"      gSpanBadDur: function(bad, real, s, e, parts){ return '從 ' + s + ' 到 ' + e + ' 是 ' + real + '，不是 ' + bad", replace:"      gSpanBadDur: function(bad, real, s, e, parts){ return '從 ' + s + ' 到 ' + e + ' 是 ' + bad + '，不是 ' + real" },
    { file:"index", expect:"gSpanOtherPoint en", find:"      gSpanOtherPoint: function(c, hh, mm){ return 'This point is ' + mm + ' min after ' + hh + ':00, not ' + c + '.'; },", replace:"      gSpanOtherPoint: function(c, hh, mm){ return 'This point is ' + mm + ' min before ' + (hh + 1) + ':00, not ' + c + '.'; }," },
    { file:"index", expect:"gSpan2 zh: must say", find:"      gSpan2: function(which, hh, mm){ return '提示 2：' + which + '的點在 '", replace:"      gSpan2: function(which, hh, mm){ return '提示 2：' + '開始的點在 '" },
    { file:"index", expect:"gSpanDurOnPoint en: must say", find:"a stretch, so it goes on the stretch below; the points of the line take points in time.'; },", replace:"so it goes on a point above.'; }," },
    { file:"index", expect:"carryRefuse(", find:"  function carryRefuse(A, h, m){ return m >= 60 ? 'over' : (h * 60 + m !== A ? 'value' : null); }", replace:"  function carryRefuse(A, h, m){ return m > 60 ? 'over' : (h * 60 + m !== A ? 'value' : null); }" },
    { file:"index", expect:"carryRefuse(", find:"  function carryRefuse(A, h, m){ return m >= 60 ? 'over' : (h * 60 + m !== A ? 'value' : null); }", replace:"  function carryRefuse(A, h, m){ return h * 60 + m !== A ? 'value' : null; }" },
    { file:"index", expect:"readInt(", find:"  function readInt(s){ var t = String(s).trim(); return /^(0|[1-9]\\d{0,2})$/.test(t) ? +t : null; }", replace:"  function readInt(s){ var t = String(s).replace(/\\s+/g, ''); return /^\\d{1,3}$/.test(t) ? +t : null; }" },
    { file:"index", expect:"must be over 60 and under 120", find:"var GAME_CARRY = [[45, 30], [20, 50],", replace:"var GAME_CARRY = [[45, 30], [20, 40]," },
    { file:"index", expect:"a bar under 20 min", find:"[55, 30], [40, 50]];", replace:"[55, 30], [80, 15]];" },
    { file:"index", expect:"carry: the numbers judged", find:"        var h = readInt(inH.value), m = readInt(inM.value);", replace:"        var h = readInt(inM.value), m = readInt(inH.value);" },
    { file:"index", expect:"carry: a wrong entry is not charged once", find:"        if (why === 'over'){ missOnce(h + ':' + m, d.gCarryOver(m)); return; }", replace:"        if (why === 'over'){ roundMiss(d.gCarryOver(m)); return; }" },
    { file:"index", expect:"carry: the right answer does not lock", find:"        inH.disabled = true; inM.disabled = true; ok.disabled = true;\n", replace:"" },
    { file:"index", expect:"carry: Enter does not submit", find:"if (ev.key === 'Enter') submit();", replace:"if (ev.key === 'Tab') submit();" },
    { file:"index", expect:"carry: the input boxes", find:"  .gnum{width:68px;height:48px;", replace:"  .gnum{width:68px;height:40px;" },
    { file:"index", expect:"gCarryDone en", find:"      gCarryDone: function(a, b, A, h, m){ return a + ' min + ' + b + ' min = ' + A + ' min = ' + h + ' h ' + m + ' min", replace:"      gCarryDone: function(a, b, A, h, m){ return a + ' min + ' + b + ' min = ' + A + ' min = ' + m + ' h ' + h + ' min" },
    { file:"index", expect:"gCarryOver zh: must say", find:"      gCarryOver: function(m){ return m + ' 分已經滿 60 了 —— 分一定小於 60，滿 60 分要換成 1 時。'; },", replace:"      gCarryOver: function(m){ return m + ' 分已經滿 60 了 —— 分可以等於 60，滿 60 分要換成 1 時。'; }," },
    { file:"index", expect:"timesRefuse(", find:"  function timesRefuse(slotK, card){ return card.k === slotK ? null : card.k; }", replace:"  function timesRefuse(slotK, card){ return card.k === slotK || (slotK === 'c' && card.k === 'c10') ? null : card.k; }" },
    { file:"index", expect:"timesParts", find:"    return { A:A, c:Math.floor(A / 60), r:A % 60, H0:h * n, H:h * n + Math.floor(A / 60), c10:Math.floor(A / 100), r10:A % 100 };", replace:"    return { A:A, c:Math.floor(A / 60), r:A % 60, H0:h * n, H:h * n + Math.floor(A / 100), c10:Math.floor(A / 100), r10:A % 100 };" },
    { file:"index", expect:"must be 120..179", find:"var GAME_TIMES = [[2, 25, 5], [1, 35, 4],", replace:"var GAME_TIMES = [[2, 25, 5], [1, 35, 3]," },
    { file:"index", expect:"the six cards are not all different", find:"var GAME_TIMES = [[2, 25, 5], [1, 35, 4],", replace:"var GAME_TIMES = [[1, 25, 5], [1, 35, 4]," },
    { file:"index", expect:"times: the carry and minutes boxes do not overlap", find:"slots:{ c:140, r:220, H:156 }", replace:"slots:{ c:120, r:240, H:156 }" },
    { file:"index", expect:"reaches the tray", find:"cardX:[52, 150, 248], cardY:[252, 306], pad:20 };", replace:"cardX:[52, 150, 248], cardY:[236, 290], pad:20 };" },
    { file:"index", expect:"times boxes and words", find:"{ id:'h1', x:168, w:24, y:78, align:'center' }", replace:"{ id:'h1', x:160, w:24, y:78, align:'center' }" },
    { file:"index", expect:"times: the box judged", find:"        var sl = nearestOpen(slots, pt, TIMES.pad);\n        if (!sl) return false;\n        var c = P.data;\n        if (timesRefuse(sl.k, c)){", replace:"        var sl = nearestOpen(slots, pt, TIMES.pad);\n        if (!sl) return false;\n        var c = P.data;\n        if (timesRefuse('c', c)){" },
    { file:"index", expect:"times: the reason does not match", find:"            : sl.k === 'r' ? d.gTimesR(c.v, X.A, c.k === 'r10')", replace:"            : sl.k === 'r' ? d.gTimesR(c.v, X.A, false)" },
    { file:"index", expect:"times: the round is not solved exactly", find:"        if (placed === 3) roundSolved(d.gTimesDone(h, m, n, X.H, X.r));", replace:"        if (placed === 2) roundSolved(d.gTimesDone(h, m, n, X.H, X.r));" },
    { file:"index", expect:"times: the round is not solved exactly", find:"        if (placed === 3) roundSolved(d.gTimesDone(h, m, n, X.H, X.r));", replace:"        if (placed === 4) roundSolved(d.gTimesDone(h, m, n, X.H, X.r));" },
    { file:"index", expect:"times: a card does not show the value", find:"text:String(c.v), cls:'gcard', data:{ k:c.k, v:c.v }", replace:"text:String(c.v + 1), cls:'gcard', data:{ k:c.k, v:c.v }" },
    { file:"index", expect:"gTimesC", find:"      gTimesC: function(v, A){ return v * 60 > A ? v + ' 時 ＝ ' + (v * 60) + ' 分，比 ' + A + ' 分還多。'", replace:"      gTimesC: function(v, A){ return v * 60 < A ? v + ' 時 ＝ ' + (v * 60) + ' 分，比 ' + A + ' 分還多。'" },
    { file:"index", expect:"gTimesR", find:"' − ' + v + ' ＝ ' + (A - v) + ' 分，不是 60 的倍數，換不成整整幾時。'; },", replace:"' − ' + v + ' ＝ ' + (A - v + 60) + ' 分，不是 60 的倍數，換不成整整幾時。'; }," },
    { file:"index", expect:"gTimesHless", find:"      gTimesHless: function(v, h, n, H0){ return v + ' is less than ' + h + ' × ' + n + ' = ' + H0", replace:"      gTimesHless: function(v, h, n, H0){ return v + ' is less than ' + h + ' × ' + n + ' = ' + (H0 + 1)" },
    { file:"index", expect:"gTimes2c", find:"      gTimes2c: function(A){ return '提示 2：60 × 2 ＝ 120，60 × 3 ＝ 180 —— ' + A + ' 在這兩個中間。'; },", replace:"      gTimes2c: function(A){ return '提示 2：60 × 2 ＝ 120，60 × 3 ＝ 160 —— ' + A + ' 在這兩個中間。'; }," },
    { file:"index", expect:"gTimesTen", find:"      gTimesTen: function(A, v){ return A + ' ＝ ' + (v * 100) + ' ＋ ' + (A - v * 100) + ' 是十進位的拆法；時間是 60 進位，1 時只有 60 分。'; },", replace:"      gTimesTen: function(A, v){ return A + ' ＝ ' + (v * 100) + ' ＋ ' + (A - v * 100) + ' 是拆法。'; }," },
    { file:"index", expect:"shareSnap(", find:"  function shareSnap(T, x){ var v = Math.round((x - SHARE.x0) * T / SHARE.w / SHARE.step) * SHARE.step; return Math.max(0, Math.min(T, v)); }", replace:"  function shareSnap(T, x){ var v = Math.floor((x - SHARE.x0) * T / SHARE.w / SHARE.step) * SHARE.step; return Math.max(0, Math.min(T, v)); }" },
    { file:"index", expect:"shareSnap(", find:"  function shareSnap(T, x){ var v = Math.round((x - SHARE.x0) * T / SHARE.w / SHARE.step) * SHARE.step; return Math.max(0, Math.min(T, v)); }", replace:"  function shareSnap(T, x){ var v = Math.round((x - SHARE.x0) * T / SHARE.w / SHARE.step) * SHARE.step; return Math.max(0, v); }" },
    { file:"index", expect:"shareRefuse(", find:"    if (x === T) return null;", replace:"    if (x >= T) return null;" },
    { file:"index", expect:"shareRefuse(", find:"             borrow:h % n !== 0 && m % n === 0 && v === Math.floor(h / n) * 60 + m / n,", replace:"             borrow:m % n === 0 && v === Math.floor(h / n) * 60 + m / n + 5," },
    { file:"index", expect:"shareRefuse(", find:"             ten:(h * 100 + m) % n === 0 && v === (h * 100 + m) / n };", replace:"             ten:false };" },
    { file:"index", expect:"needs a borrow", find:"var GAME_SHARE = [[3, 20, 4], [2, 40, 4],", replace:"var GAME_SHARE = [[4, 20, 4], [2, 40, 4]," },
    { file:"index", expect:"is not a whole number of 5-min steps", find:"[3, 20, 2], [1, 50, 2]];", replace:"[3, 20, 2], [1, 50, 3]];" },
    { file:"index", expect:"is not on the 5-min grid", find:"[3, 20, 2], [1, 50, 2]];", replace:"[3, 20, 2], [2, 30, 3]];" },
    { file:"index", expect:"gShareBorrow q=0", find:"' 這是把 ' + h + ' 時整個丟掉了（' + h + ' 時不夠分給 ' + n + ' 份、每份 1 時）'", replace:"' 這是 ' + h + ' ÷ ' + n + ' 只拿了商 ' + q + ' 時、把餘下的 ' + rem + ' 時丟掉了'" },
    { file:"index", expect:"gShareBorrow q=0", find:"' That drops the whole ' + h + ' h (' + h + ' h is not enough to give each of the ' + n + ' parts 1 h)'", replace:"' That is ' + h + ' ÷ ' + n + ' keeping only the ' + q + ' h and dropping the ' + rem + ' h left over'" },
    { file:"index", expect:"gSpan2Span", find:"(whole ? '再數整整幾時，最後數剩下的分。' : '再數剩下的分。')", replace:"'再數整整幾時，最後數剩下的分。'" },
    { file:"index", expect:"gSpan2Span", find:"(whole ? 'then the whole hours, then the minutes left.' : 'then the minutes left.')", replace:"'then the minutes left.'" },
    { file:"index", expect:"hint 2 does not know whether there are whole hours", find:"        return d.gSpan2Span(spanParts(s, e).length === 3);", replace:"        return d.gSpan2Span(true);" },
    { file:"index", expect:"is charged — it should be a free reminder", find:"        if (why === 'durOnPoint' && z !== sl.zones[0]){ roundNote(d.gSpanDurOnPoint(text(c))); return false; }\n", replace:"" },
    { file:"index", expect:"the dot covers the orange part", find:"rowY:62, rowH:22, gripY:110, ry:146,", replace:"rowY:62, rowH:22, gripY:100, ry:146," },
    { file:"index", expect:"a tap on the bars or the ruler does not move the dot", find:"step:5, band:[24, 184] };", replace:"step:5, band:[100, 184] };" },
    { file:"index", expect:"share: the share judged", find:"        var r = shareRefuse(h, m, n, v);", replace:"        var r = shareRefuse(h, m, n, v + 5);" },
    { file:"index", expect:"share: That’s it judges while the dot is held", find:"        if (gSolved || grip.busy()) return;   /* 圓點正被拖著：先放開才判斷 */", replace:"        if (gSolved) return;   /* 圓點正被拖著：先放開才判斷 */" },
    { file:"index", expect:"share: a tap on the line or ◀ ▶ moves the dot while it is held", find:"        if (gSolved || grip.busy()) return;   /* 圓點正被拖著：點線、按 ◀ ▶ 都不算數", replace:"        if (gSolved) return;   /* 圓點正被拖著：點線、按 ◀ ▶ 都不算數" },
    { file:"index", expect:"share: the readout and the orange part do not follow", find:"onPlace:function(P){ set(shareSnap(T, P.cx)); } });", replace:"onPlace:function(P){} });" },
    { file:"index", expect:"share: the right share does not lock", find:"        copies(v);   /* lock() 會重畫一次", replace:"        /* lock() 會重畫一次" },
    { file:"index", expect:"share: the right share does not lock", find:"        grip.lock(grip.cx, grip.cy);\n        copies(v);", replace:"        copies(v);" },
    { file:"index", expect:"share: the orange part drawn is not the share being judged", find:"        bar.setAttribute('width', shareX(T, v) - SHARE.x0);", replace:"        bar.setAttribute('width', shareX(T, v + 5) - SHARE.x0);" },
    { file:"index", expect:"gCarry2 en: must say", find:"' minutes contain one group of 60 minutes.'; },", replace:"' minutes hold one 60 minutes.'; }," },
    { file:"index", expect:"drawn somewhere besides set(v)", find:"        ghosts.textContent = '';\n      }\n      /* n 份", replace:"        ghosts.textContent = '';\n        bar.setAttribute('width', shareX(T, v + 5) - SHARE.x0);\n      }\n      /* n 份" },
    { file:"index", expect:"gSpanOtherPoint en: must say", find:"'This point is ' + mm + ' min after ' + hh + ':00, not ' + c + '.'", replace:"'This point is ' + mm + ' min before ' + hh + ':00, not ' + c + '.'" },
    { file:"index", expect:"gCarryValue en: must say", find:"      gCarryValue: function(h, m, x, A){ return h + ' h ' + m + ' min = ' + x + ' min, not ' + A + ' min.'; },", replace:"      gCarryValue: function(h, m, x, A){ return h + ' h ' + m + ' min = ' + x + ' min, exactly ' + A + ' min.'; }," },
    { file:"index", expect:"gTimesR en: must say", find:"' min, not a multiple of 60 — not a whole number of hours.'; },", replace:"' min, a multiple of 60 — a whole number of hours.'; }," },
    { file:"index", expect:"gRankBad en: must say", find:"' — in minutes it is ' + this.gRankOrd(k) + ', not ' + this.gRankOrd(i) + '.'; },", replace:"' — in minutes it is ' + this.gRankOrd(i) + ', not ' + this.gRankOrd(k) + '.'; }," },
    { file:"index", expect:"gRankOk en", find:"      gRankOrd: function(k){ return k === 1 ? 'the shortest' : 'the ' + k + ['', 'st', 'nd', 'rd', 'th'][k] + ' shortest'; },", replace:"      gRankOrd: function(k){ return k === 1 ? 'the longest' : 'the ' + k + ['', 'st', 'nd', 'rd', 'th'][k] + ' shortest'; }," },
    { file:"index", expect:"gRankOk zh: must say", find:"      gRankOk: function(txt, t, hm, k){ return '對：' + (hm ? txt + ' ＝ ' + t + ' 分' : txt) + ' 是第 ' + k + ' 短。'; },", replace:"      gRankOk: function(txt, t, hm, k){ return '對：' + (hm ? txt + ' ＝ ' + t + ' 分' : txt) + ' 是第 ' + k + ' 長。'; }," },
    { file:"index", expect:"gShareBorrow en: must say", find:"keeping only the ' + q + ' h and dropping the ' + rem + ' h left over", replace:"dropping the ' + q + ' h and keeping only the ' + rem + ' h left over" },
    { file:"index", expect:"gShareBorrow zh: must say", find:"' 只拿了商 ' + q + ' 時、把餘下的 ' + rem + ' 時丟掉了", replace:"' 把商 ' + q + ' 時丟掉了、只拿了餘下的 ' + rem + ' 時" },
    { file:"index", expect:"gTimesHmore zh: must say", find:"      gTimesHmore: function(v, H0, A){ return H0 + ' 加上進位的時，不會是 ' + v", replace:"      gTimesHmore: function(v, H0, A){ return H0 + ' 加上進位的時，就是 ' + v" },
    { file:"index", expect:"share: a tap on the line does not move the dot", find:"      B.onBoardTap = function(pt){ if (inBand(pt)) moveTo(shareSnap(T, pt.x)); };", replace:"      B.onBoardTap = function(pt){};" },
    { file:"index", expect:"gShareBad", find:"      gShareBad: function(n, v, x, T, less, diff){ return n + ' 份 × ' + v + ' ＝ ' + x + '，這比 ' + T + (less ? ' 少 ' : ' 多 ') + diff + '。'; },", replace:"      gShareBad: function(n, v, x, T, less, diff){ return n + ' 份 × ' + v + ' ＝ ' + x + '，這比 ' + T + (less ? ' 多 ' : ' 少 ') + diff + '。'; }," },
    { file:"index", expect:"gShareBad", find:"+ ' = ' + x + ', which is ' + diff + (less ? ' less than ' : ' more than ') + T + '.'; },", replace:"+ ' = ' + x + ', ' + diff + (less ? ' less than ' : ' more than ') + T + '.'; }," },
    { file:"index", expect:"gShareBad", find:"+ ' ＝ ' + x + '，這比 ' + T + (less ?", replace:"+ ' ＝ ' + x + '，比 ' + T + (less ?" },
    { file:"index", expect:"gShareBorrow", find:"' — those ' + rem + ' h must become ' + (rem * 60) + ' min", replace:"' — those ' + rem + ' h must become ' + (rem * 100) + ' min" },
    { file:"index", expect:"gShareDone", find:"      gShareDone: function(h, m, n, T, v, vtxt){ return h + ' 時 ' + m + ' 分 ＝ ' + T + ' 分，' + T + ' ÷ ' + n + ' ＝ ' + v + ' 分'", replace:"      gShareDone: function(h, m, n, T, v, vtxt){ return h + ' 時 ' + m + ' 分 ＝ ' + T + ' 分，' + T + ' ÷ ' + n + ' ＝ ' + (v + 5) + ' 分'" },
    { file:"index", expect:"gShareTen en: must say", find:"      gShareTen: function(h, m, X, T){ return ' That treats ' + h + ' h ' + m + ' min as ' + X + ' min — 1 hour is 60 minutes, so ' + h + ' h ' + m + ' min = ' + T + ' min.'; },", replace:"      gShareTen: function(h, m, X, T){ return ' That is ' + h + ' h ' + m + ' min as ' + X + ' min — so ' + h + ' h ' + m + ' min = ' + T + ' min, 1, 60.'; }," },
    { file:"index", expect:"rankOf(", find:"  function rankOf(set, t){ return set.filter(function(c){ return c[0] < t; }).length; }", replace:"  function rankOf(set, t){ return set.filter(function(c){ return (c[1] ? Math.floor(c[0] / 60) * 100 + c[0] % 60 : c[0]) < (t); }).length; }" },
    { file:"index", expect:"rankInOrder does not recognise", find:"  function rankInOrder(list){ for (var i = 1; i < list.length; i++) if (list[i - 1][0] > list[i][0]) return false; return true; }", replace:"  function rankInOrder(list){ return false; }" },
    { file:"index", expect:"reading \"1 時 40 分\" as 140 never", find:"    [[65, 0], [70, 1], [75, 0], [80, 1]],", replace:"    [[65, 0], [70, 0], [75, 0], [80, 1]]," },
    { file:"index", expect:"needs no converting", find:"    [[65, 0], [70, 1], [75, 0], [80, 1]],", replace:"    [[55, 0], [70, 1], [75, 0], [80, 1]]," },
    { file:"index", expect:"four different lengths", find:"    [[100, 0], [105, 1], [115, 0], [125, 1]],", replace:"    [[100, 0], [105, 1], [105, 0], [125, 1]]," },
    { file:"index", expect:"rank boxes, cards and captions", find:"capTop:[2, 26], capBot:[246, 270], pad:12 };", replace:"capTop:[2, 30], capBot:[246, 270], pad:12 };" },
    { file:"index", expect:"neighbouring boxes do not overlap when widened", find:"capTop:[2, 26], capBot:[246, 270], pad:12 };", replace:"capTop:[2, 26], capBot:[246, 270], pad:2 };" },
    { file:"index", expect:"rank: the box judged", find:"        if (k !== sl.i){ missOnce(c.j + ':' + sl.i, d.gRankBad(txt, c.t, c.hm, k + 1, sl.i + 1)); return false; }", replace:"        if (k !== sl.i){ roundMiss(d.gRankBad(txt, c.t, c.hm, k + 1, sl.i + 1)); return false; }" },
    { file:"index", expect:"rank: the tray is not shuffled", find:"      var pieces = unsorted(set, rankInOrder).map(function(c, j){", replace:"      var pieces = set.map(function(c, j){" },
    { file:"index", expect:"rank: a card does not show the length", find:"text:text(c), cls:'gcard', data:{ t:c[0], hm:c[1], j:j }", replace:"text:text(c), cls:'gcard', data:{ t:c[0] + 5, hm:c[1], j:j }" },
    { file:"index", expect:"gRankBad", find:"      gRankBad: function(txt, t, hm, k, i){ return (hm ? txt + ' ＝ ' + t + ' 分' : txt) + ' —— 四段都換成分來比，它是第 ' + k + ' 短，不是第 ' + i + ' 短。'; },", replace:"      gRankBad: function(txt, t, hm, k, i){ return (hm ? txt + ' ＝ ' + t + ' 分' : txt) + ' —— 四段都換成分來比，它是第 ' + i + ' 短，不是第 ' + k + ' 短。'; }," },
    { file:"index", expect:"gRankDone en: must say", find:"'Shortest to longest: ' + list.join(' < ') + ' — turn everything into minutes first, then compare.'", replace:"'Shortest to longest: ' + list.join(' < ') + '.'" },
    { file:"index", expect:"gRank2", find:"      gRank2: function(txt, h, m, t){ return '提示 2：' + txt + ' ＝ 60 × ' + h + ' ＋ ' + m + ' ＝ ' + t + ' 分。'; },", replace:"      gRank2: function(txt, h, m, t){ return '提示 2：' + txt + ' ＝ 100 × ' + h + ' ＋ ' + m + ' ＝ ' + t + ' 分。'; }," },
    { file:"review", expect:"is copied from the list of numbers", find:"        var m = mixOpts(avg, [avg - 1, avg + 1, s], nums);", replace:"        var m = mixOpts(avg, [avg - 1, avg + 1, s]);" },
    { file:"review", expect:"copied straight out of the stem", find:"        var mo = mixOpts(correct, cands, [a, b, c]);", replace:"        var mo = mixOpts(correct, cands);" },
    { file:"review", expect:"not a length of time written", find:"    if (lang === 'zh') return t.h > 0 ? (t.h + ' 時 ' + t.m + ' 分') : (t.m + ' 分');", replace:"    if (lang === 'zh') return t.h > 0 ? (t.h + '時' + t.m + '分') : (t.m + '分');" },
    { file:"review", expect:"outside 1~", find:"        var cands = [sumM - 60, sumM + 60, a].filter(function(v){ return v > 0 && v !== sumM; });", replace:"        var cands = [sumM - 60, sumM + 60, a].filter(function(v){ return v >= 0 && v !== sumM; });" },
    { file:"review", expect:"the decimal-as-minutes distractor", find:"        if (c.dec === 0.5) trapCands.push(50);    // 0.5小時看成50分", replace:"        if (c.dec === 0.5) trapCands.push(40);    // 0.5小時看成50分" },
    { file:"review", expect:"the \"did not divide\" distractor", find:"        var cands = [totalMin, answerMin - parts, answerMin + parts].filter(function(v){ return v > 0 && v !== answerMin; });", replace:"        var cands = [answerMin - parts, answerMin + parts].filter(function(v){ return v > 0 && v !== answerMin; });" },
    { file:"review", expect:"why: \"", find:"            ? fmtHM(d.totalMin, 'zh') + ' = ' + d.totalMin + ' 分，' + d.totalMin + ' ÷ ' + d.parts + ' = ' + d.answerMin + ' 分 = ' + fmtHM(d.answerMin, 'zh') + '。'", replace:"            ? fmtHM(d.totalMin, 'zh') + ' = ' + d.totalMin + ' 分，' + d.totalMin + ' ÷ ' + d.parts + ' = ' + (d.answerMin + 5) + ' 分 = ' + fmtHM(d.answerMin, 'zh') + '。'" },
    { file:"review", expect:"why: \"", find:"            : d.m0 + ' + ' + d.dm + ' = ' + d.rawM + ' minutes' + (carried ? ', over 60 so carry 1 hour, leaving ' + d.mFinal : '')", replace:"            : d.m0 + ' + ' + d.dm + ' = ' + (d.rawM + 1) + ' minutes' + (carried ? ', over 60 so carry 1 hour, leaving ' + d.mFinal : '')" },
    { file:"review", expect:"the \"forgot the carried hour\" distractor", find:"        var cands = [noCarryEnc, answerEnc - 60, answerEnc + 60].filter(function(v){ return v >= 0 && v !== answerEnc; });", replace:"        var cands = [answerEnc + 60].filter(function(v){ return v >= 0 && v !== answerEnc; });" },
    { file:"review", expect:"is not a 12-hour time", find:"        var h0 = pickUnused([1,2,3,4,5,6,7,8,9], used);", replace:"        var h0 = pickUnused([1,2,3,4,5,6,7,8,9,10,11], used);" },
  ],

  sim: {
    INVARIANTS: {
      timeMulCarry: d => {
        if (d.answerMin !== (d.perH * 60 + d.perM) * d.days) return 'answer ' + d.answerMin + ' != (perH × 60 + perM) × days';
        if (!(d.days >= 3 && d.days <= 7 && d.perH >= 0 && d.perH <= 2 && d.perM % 5 === 0 && d.perM > 0 && d.perM < 60)) return 'parameters out of the lesson range';
      },
      timeDivExact: d => {
        if (d.totalMin !== d.answerMin * d.parts || !(d.answerMin > 0)) return 'totalMin ' + d.totalMin + ' != answer × parts';
        /* 被除數（不除）是刻意的迷思誘答：一定在選項裡 */
        if (d.opts.indexOf(d.totalMin) < 0) return 'the "did not divide" distractor (' + d.totalMin + ') is not offered';
      },
      timeRollover: d => { if (d.sumM !== d.a + d.b) return 'sum ' + d.sumM + ' != a + b'; },
      timeClockAdd: d => {
        const raw = d.m0 + d.dm, carry = raw >= 60 ? 1 : 0;
        if (d.answerEnc !== (d.h0 + d.dh) * 60 + raw || d.mFinal !== raw - 60 * carry || d.hFinal !== d.h0 + d.dh + carry) return 'clock sum is wrong';
        if (!(d.hFinal <= 12 && d.mFinal < 60)) return 'the answer ' + d.hFinal + ':' + d.mFinal + ' is not a 12-hour clock time';
        /* 「分有進位、時忘了加 1」是刻意的迷思誘答：有進位時一定在選項裡 */
        if (carry && d.opts.indexOf((d.h0 + d.dh) * 60 + d.mFinal) < 0) return 'the "forgot the carried hour" distractor is not offered';
      },
      decimalHourTrap: d => {
        if (d.answerMin !== d.dec * 60) return 'answer ' + d.answerMin + ' != dec × 60';
        /* 「0.5 小時 ＝ 50 分」這一類把小數直接當分的誘答，一定在選項裡 */
        const trap = { 0.25:25, 0.5:50, 0.75:75, 1.5:110, 2.5:170 }[d.dec];
        if (d.opts.indexOf(trap) < 0) return 'the decimal-as-minutes distractor (' + trap + ') is not offered for ' + d.dec;
      },
      decimalDivide: d => {
        if (d.qt * d.k !== d.dividendTenths || Math.abs(d.q - d.qt / 10) > 1e-9 || Math.abs(d.dividend - d.dividendTenths / 10) > 1e-9) return 'decimal division does not check';
      },
      avgCalc: d => {
        if (d.nums.length !== d.n || d.sum !== d.nums.reduce((a, b) => a + b, 0) || d.sum !== d.avg * d.n || d.nums.some(v => v <= 0)) return 'average does not check';
        /* 誘答不可以是題幹裡的數（§六之三第 4 點） */
        if (d.opts.some((o, i) => i !== d.ans && d.nums.indexOf(o) >= 0)) return 'a distractor is copied from the list of numbers';
      },
      orderOfOps: d => {
        if (d.correct !== d.a + d.b * d.c) return 'a + b × c is wrong';
        if ((d.a + d.b) * d.c !== d.correct && d.opts.indexOf((d.a + d.b) * d.c) < 0) return 'the "left to right" distractor is not offered';
      }
    },
    /* 正解的第二套實作：只用 make() 留下的原始參數，自己格式化 */
    expectedCorrect: function(d, genId, lang){
      const f = lang === 'zh' ? fmtZ : fmtE;
      switch (genId){
        case 'timeMulCarry': return f((d.perH * 60 + d.perM) * d.days);
        case 'timeDivExact': return f(d.totalMin / d.parts);
        case 'timeRollover': return f(d.a + d.b);
        case 'timeClockAdd': return clock((d.h0 + d.dh) * 60 + d.m0 + d.dm);
        case 'decimalHourTrap': return f(Math.round(d.dec * 60));
        case 'decimalDivide': return String(Math.round(d.dividendTenths / d.k) / 10);
        case 'avgCalc': return String(d.nums.reduce((a, b) => a + b, 0) / d.nums.length);
        case 'orderOfOps': return String(d.a + d.b * d.c);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (DUR_GENS.indexOf(genId) >= 0){
        const v = minutesOf(s, lang);
        if (v === null) return 'option "' + s + '" is not a length of time written as "h 時 m 分" / "m 分"';
        /* 範圍從各產生器自己的參數推出來：最大的正解或誘答 */
        const MAX = { timeMulCarry:(2 * 60 + 55) * 7 + 60, timeDivExact:(2 * 60 + 50) * 6, timeRollover:55 + 40 + 60, decimalHourTrap:170 }[genId];
        if (v < 1 || v > MAX) return 'option ' + v + ' min outside 1~' + MAX;
        return;
      }
      if (genId === 'timeClockAdd'){
        const m = String(s).match(/^(\d{1,2}):(\d\d)$/);
        if (!m || +m[2] > 59) return 'option "' + s + '" is not a clock time';
        if (isCorrect && !(+m[1] >= 1 && +m[1] <= 12)) return 'the answer "' + s + '" is not a 12-hour time';
        if (!(+m[1] >= 0 && +m[1] <= 13)) return 'option "' + s + '" hour out of range';
        return;
      }
      if (genId === 'decimalDivide'){
        if (!/^\d+(\.\d)?$/.test(s)) return 'option "' + s + '" is not a one-place decimal';
        /* 正解 2.0～8.9；誘答是 ±0.1、× 2，被題幹的數字擋掉時往外補 ±1、±2…（不會小於 0.1） */
        if (+s < 0.1 || +s > 8.9 * 2 + 3) return 'option ' + s + ' out of range';
        if (isCorrect && (+s < 2 || +s > 8.9)) return 'the answer ' + s + ' is outside 2.0~8.9';
        return;
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const MAX = { avgCalc:25 * 5, orderOfOps:(8 + 5) * 6 }[genId];
      if (+s < 1 || +s > MAX) return 'option ' + s + ' outside 1~' + MAX;
    },
    /* 解釋裡的每一個等號重算；時間題的選項換成分鐘數兩兩不同 */
    renderCheck: function(d, q, lang, genId){
      const r = timeClaims(q.why);
      for (const c of r.claims) if (c.bad) return 'why: "' + c.text + '" ' + c.bad + ' — ' + q.why;
      if (!r.claims.length) return 'why: no equation could be checked — ' + q.why;
      if (DUR_GENS.indexOf(genId) >= 0){
        const v = q.opts.map(o => minutesOf(o, lang));
        if (new Set(v).size !== 4) return 'two options are the same length of time: ' + q.opts.join(' | ');
      }
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「準時出發」的題庫與版面',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, pick, unsorted, GAME_SPAN, SPAN, SPAN_H, SPAN_PIN, spanX, spanDecoy, spanSlots, spanParts, spanCards, spanInOrder, spanRefuse, GAME_CARRY, CARRY, CARRY_H, carryX, readInt, carryRefuse, GAME_TIMES, TIMES, TIMES_H, TIMES_SYMS, timesParts, timesCards, timesInOrder, timesRefuse, GAME_SHARE, SHARE, SHARE_H, shareX, shareSnap, shareRefuse, GAME_RANK, RANK, RANK_H, rankOf, rankInOrder}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9, W = 300;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: no space between a Chinese character and a digit in "' + s + '"');
        timeClaims(s).claims.forEach(c => { if (c.bad) fail(where + ' ' + L + ': "' + c.text + '" is wrong (' + c.bad + ') — "' + s + '"'); });
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 等號掃描器自己先證明會響（正反例） --- */
      [['75 分 = 60 分 + 15 分 = 1 時 15 分', 2, 0], ['2 時 30 分 = 150 分', 1, 0], ['2 時 30 分 = 140 分', 1, 1], ['20 × 4 = 80 分', 1, 0], ['20 × 4 = 70 分', 1, 1],
       ['時：1 × 4 = 4，4 + 1 = 5 時', 2, 0], ['4 + 1 = 6 時', 1, 1], ['借位：3 時 = 3×60 = 180 分', 2, 0], ['3 時 = 3×60 = 170 分', 2, 1], ['1 h 15 min = 75 min', 1, 0],
       ['1 h 15 min = 85 minutes', 1, 1], ['0.5 小時 = 30 分', 1, 0], ['1.5 小時 = 1 時 50 分', 1, 1], ['4:20 − 1:40：20 + 60 = 80', 1, 0], ['5 時 + 進位的 2 時 = 7 時', 0, 0],
       ['125 分 ≥ 60，要進位：125 = 120 + 5 = 2 時 5 分', 2, 0], ['125 = 120 + 5 = 2 時 15 分', 2, 1], ['3:20，過了 25 分鐘', 0, 0], ['220 ÷ 2 = 110 分 = 1 時 50 分', 2, 0], ['3 ÷ 4 = 0 餘 3', 1, 0], ['3 ÷ 4 = 1 餘 3', 1, 1], ['7 ÷ 2 = 3 remainder 1', 1, 0], ['75 minutes = 60 minutes + 15 minutes = 1 h 15 min (minutes never exceed 59)', 2, 0], ['(20 + 4) × 2 = 48', 1, 0]]
        .forEach(([t, n, bad]) => {
          const r = timeClaims(t);
          if (r.claims.length !== n || r.claims.filter(c => c.bad).length !== bad) fail('timeClaims() self-test: "' + t + '" should give ' + n + ' claims, ' + bad + ' wrong — got ' + JSON.stringify(r.claims));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）與範例 3、4 的逐步說明裡的等號逐個重算；中文的數字與字之間有空格 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      const MUL = [[1, 25, 5], [2, 15, 3]], DIV = [3, 20, 4];
      if (src.indexOf('var MUL_EXAMPLES = [ {h:1,m:25,days:5}, {h:2,m:15,days:3} ];') < 0 || src.indexOf('var DIV_EXAMPLE = { h:3, m:20, parts:4 };') < 0) fail('EXAMPLES: the example data changed — update MUL / DIV here');
      let checkedEq = 0;
      LANGS.forEach(L => {
        const d = I18N[L], list = walk(d, L, []);
        MUL.forEach(e => d.mulSteps(...e).forEach((s, i) => list.push([L + '.mulSteps(' + e + ')[' + i + ']', s])));
        d.divStepsConvert(...DIV).forEach((s, i) => list.push([L + '.divStepsConvert[' + i + ']', s]));
        d.divStepsBorrow(...DIV).forEach((s, i) => list.push([L + '.divStepsBorrow[' + i + ']', s]));
        /* 範例 1、2、3 的字也是函式拼出來的：一起掃（中文的數字與字之間有空格） */
        list.push([L + '.dur(1, 20)', d.dur(1, 20)], [L + '.dur(0, 15)', d.dur(0, 15)], [L + '.nlLine', d.nlLine(45, 30, 75, 1, 15)], [L + '.mulChipLabel', d.mulChipLabel(1, 25, 5)], [L + '.clk', d.clk(3, 40)]);
        list.forEach(([where, s]) => {
          timeClaims(s).claims.forEach(c => { checkedEq++; if (c.bad) fail(where + ': "' + c.text + '" is wrong (' + c.bad + ')'); });
          if (L === 'zh' && /\d(?:時|分)|(?:時|分)\d/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ': a length of time is written without spaces ("1 時 25 分", not "1時25分"): ' + s);
        });
      });
      if (checkedEq < 60) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 範例 3：每一步的數字（分、進位、時、答案）用這裡自己的算法重算 */
      LANGS.forEach(L => MUL.forEach(([h, m, n]) => {
        const s = I18N[L].mulSteps(h, m, n), A = m * n, c = Math.floor(A / 60), r = A % 60;
        if (nums(s[1]).join() !== [m, n, A].join()) fail('EXAMPLE mulSteps ' + L + ' [' + h + ',' + m + ',' + n + '] minutes step: ' + s[1]);
        if (nums(s[s.length - 1]).join() !== [h * n + c, r].join()) fail('EXAMPLE mulSteps ' + L + ' answer: ' + s[s.length - 1]);
        if (c > 0 && nums(s[4]).join() !== [h * n, c, h * n + c].join()) fail('EXAMPLE mulSteps ' + L + ' hours step: ' + s[4]);
      }));

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 6. 小遊戲：準時出發');
      const ge = src.indexOf('  /* ---------- 語言／模式切換', gs);
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
      if (!(D.GPICK >= 48)) fail('GAME: GPICK ' + D.GPICK + ' — pieces under 48 are under 44px on a phone');

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['span', 'carry', 'times', 'share', 'rank'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, then the footer rule), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        span: { has:{ zh:['時刻', '一個點', '時間量', '一段長度'], en:['point in time', 'one point', 'length of time', 'stretch'] } },
        carry: { has:{ zh:['滿 60 分', '1 時'], en:['60 minutes', '1 hour'] } },
        times: { has:{ zh:['分開乘', '滿 60', '1 時'], en:['separately', '60 minutes', '1 hour'] } },
        share: { has:{ zh:['換成分', '1 時 ＝ 60 分', '除以'], en:['into minutes', '1 hour = 60 minutes', 'divide'] } },
        rank: { has:{ zh:['換成分', '1 時 ＝ 60 分', '不是 100 分'], en:['into minutes', '1 hour = 60 minutes', 'not 100'] } }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, null); has('gHints.' + t, L, h, HINT_SEM[t].has); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };

      /* --- 開場白：說的每一件事五關都成立；頁面上的備用字和中文字典是同一句 --- */
      {
        const LEAD = { zh:'練的都是上面的範例：<strong>時刻和時間量、60 進位、時間量的乘和除</strong>', en:'all practising the examples above: <strong>points in time and lengths of time, base 60, multiplying and dividing lengths of time</strong>' };
        LANGS.forEach(L => {
          const t = I18N[L].s6lead || '';
          if (t.indexOf(LEAD[L]) < 0) fail('GAME s6lead ' + L + ' does not say "' + LEAD[L] + '"');
          hasNot('s6lead', L, t, { zh:['愈快', '選出正確答案'], en:['faster', 'pick the correct answer'] });
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
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.axis === 'x'\) P\.place\(o\.snapX\(orig\.x \+ dx\), orig\.y\);/, 'the share dot does not snap to 5 minutes while it is dragged');
      need(null, /if \(P\.busy\(\)\) return;   \/\* 這一張正被另一根手指拖著/, 'a tap on a target places a card that another finger is still dragging');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      ['span', 'times', 'rank'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint');
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
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85), L === 'zh' ? [85] : [5, 85]);
        say('gClear', L, d.gClear, []);
        ['gOk', 'gHintBtn', 'gNextBtn', 'gRestartBtn'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + k + ' missing in ' + L); });
        for (let t = 0; t <= 300; t += 5){
          if (d.gDur(t) !== (t >= 60 && t % 60 === 0 ? (L === 'zh' ? t / 60 + ' 時' : t / 60 + ' h') : (L === 'zh' ? fmtZ(t) : fmtE(t)))) fail('GAME gDur(' + t + ') ' + L + ' = "' + d.gDur(t) + '"');
          if (d.gMin(t) !== t + (L === 'zh' ? ' 分' : ' min')) fail('GAME gMin(' + t + ') ' + L);
          if (d.gClk(t + 60) !== clock(t + 60)) fail('GAME gClk(' + (t + 60) + ') ' + L + ' = ' + d.gClk(t + 60));
        }
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
        }
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

      /* ================= 第 1 關：點與段 ================= */
      {
        const S = D.SPAN, X = D.spanX;
        if (!(S.cardH >= D.GPICK && S.cardW >= D.GPICK)) fail('GAME span: cards ' + S.cardW + '×' + S.cardH + ' are smaller than GPICK');
        tooSmall('span card', Math.min(S.cardW, S.cardH)); tooSmall('span box', Math.min(S.boxW, S.boxH));
        for (let t = 0; t <= S.len; t += 10) if (Math.abs(X(t) - (S.x0 + t * S.ppm)) > EPS) fail('GAME spanX(' + t + ') is not on the ruler');
        if (!(X(0) - 20 >= 2 && X(S.len) + 20 <= W - 2)) fail('GAME span: the end labels of the ruler (±20px) do not fit the board');
        const tray = [];
        S.cardY.forEach(y => S.cardX.forEach(x => tray.push(box(x, y, S.cardW, S.cardH))));
        tray.forEach((b, i) => inside(b, 'span tray card ' + i, D.SPAN_H, 2));
        noHits(tray, 'span tray cards', 4);
        D.GAME_SPAN.forEach(entry => {
          const [H0, s, e] = entry, where = 'GAME span [' + entry + ']', Dl = e - s;
          if (!(isInt(H0) && H0 >= 1 && H0 + 3 <= 12)) fail(where + ': the ruler ' + H0 + ':00..' + (H0 + 3) + ':00 is not on a 12-hour clock');
          if (!(s % 10 === 0 && e % 10 === 0 && s > 0 && e < S.len)) fail(where + ': start and end must be on 10-min ticks inside the ruler');
          if (!([20, 30, 40].indexOf(s % 60) >= 0 && [20, 30, 40].indexOf(e % 60) >= 0)) fail(where + ': start/end minutes must be 20, 30 or 40 (≥ 20 min = 28px from an hour label)');
          if (!(e % 60 < s % 60)) fail(where + ': the end minutes must be smaller than the start minutes (crossing an hour needs a borrow)');
          if (!(Dl >= 50)) fail(where + ': the stretch is only ' + Dl + ' min — the two point boxes would overlap');
          const decoy = D.spanDecoy(s, e), hours = Math.floor(e / 60) - Math.floor(s / 60);
          if (decoy !== hours * 60 || decoy === Dl || decoy <= 0) fail(where + ': spanDecoy ' + decoy + ' is not the o’clock count ' + hours + ' h, or equals the stretch');
          const parts = D.spanParts(s, e);
          if (parts.reduce((x, p) => x + p[1] - p[0], 0) !== Dl || parts[0][0] !== s || parts[parts.length - 1][1] !== e || parts.some((p, i) => i && p[0] !== parts[i - 1][1]) ||
              parts[0][1] % 60 || parts[parts.length - 1][0] % 60 || parts.some(p => !(p[1] > p[0]))) fail(where + ': spanParts ' + JSON.stringify(parts) + ' is not up-to-the-hour / whole hours / the rest');
          const cards = D.spanCards(s, e);
          if (JSON.stringify(cards) !== JSON.stringify([{ k:'clock', t:s }, { k:'clock', t:e }, { k:'dur', t:Dl }, { k:'dur', t:decoy }])) fail(where + ': spanCards should be start, end, length, o’clock count');
          /* 每一張卡 × 每一格：時刻只進那一點、時間量只進那一段而且是那一段的長度 */
          const slots = D.spanSlots(s, e);
          if (slots.map(x => x.k).join() !== 'start,end,span') fail(where + ': spanSlots order should be start, end, span');
          cards.forEach(c => slots.forEach(sl => {
            const want = sl.k === 'span' ? (c.k === 'clock' ? 'clockOnSpan' : (c.t !== Dl ? 'badDur' : null)) : (c.k === 'dur' ? 'durOnPoint' : (c.t !== (sl.k === 'start' ? s : e) ? 'otherPoint' : null));
            const got = D.spanRefuse(s, e, sl.k, c);
            if (got !== want) fail(where + ': spanRefuse(' + sl.k + ', ' + JSON.stringify(c) + ') = ' + got + ', expected ' + want);
          }));
          /* 照遊戲的規則玩一遍：每一格剛好一張卡收，錯卡哪裡都不收 */
          const taken = slots.map(sl => cards.filter(c => !D.spanRefuse(s, e, sl.k, c)));
          if (taken.some(l => l.length !== 1) || cards.filter(c => slots.every(sl => D.spanRefuse(s, e, sl.k, c))).length !== 1) fail(where + ': not exactly one card per place, with exactly one card left over');
          /* 畫出來的格子、虛線、點、長條 */
          const xs = X(s), xe = X(e), top = S.ry - 9;
          [slots[0], slots[1]].forEach(sl => { const x = sl.k === 'start' ? xs : xe; if (Math.abs(sl.bx + sl.bw / 2 - x) > EPS || sl.bw !== S.boxW || sl.by !== S.boxY) fail(where + ': the ' + sl.k + ' box is not drawn above its point'); });
          const boxes = slots.map(sl => ({ x:sl.bx, y:sl.by, w:sl.bw, h:sl.bh }));
          boxes.forEach((b, i) => inside(b, where + ' box ' + i, D.SPAN_H, 2));
          noHits(boxes, where + ': boxes', 2);
          if (!(S.durY >= S.ry + 30 && S.durY + S.boxH + 6 <= Math.min(...S.cardY) - S.cardH / 2)) fail(where + ': the length box sits on the ruler labels or the tray');
          /* 時刻的標籤（寬約 ±18px）不碰到虛線 */
          for (let hh = 0; hh <= S.len; hh += 60) [xs, xe].forEach(x => { if (Math.abs(X(hh) - x) < 18 + 4) fail(where + ': a dashed pin at x ' + x + ' runs through the ' + (H0 + hh / 60) + ':00 label'); });
          /* 範圍：蓋住畫出來的東西；兩種範圍不重疊 */
          const zones = [];
          slots.forEach((sl, i) => sl.zones.forEach(z => zones.push(Object.assign({ i:i }, z))));
          const inZ = (i, p) => zones.some(z => z.i === i && Math.abs(p.x - z.cx) <= z.hw + EPS && Math.abs(p.y - z.cy) <= z.hh + EPS);
          [[0, xs], [1, xe]].forEach(([i, x]) => {
            for (let y = S.boxY; y <= S.ry + 9; y += 1) if (!inZ(i, { x:x, y:y })){ fail(where + ': point ' + i + ': (' + x + ', ' + y + ') on its box / pin / dot is not in its zone'); break; }
            for (let dx = -S.boxW / 2; dx <= S.boxW / 2; dx += 2) for (let y = S.boxY; y <= S.boxY + S.boxH; y += 2) if (!inZ(i, { x:x + dx, y:y })){ fail(where + ': point ' + i + ' box is not all in its zone'); dx = 1e9; break; }
            for (let dx = -5; dx <= 5; dx++) if (!inZ(i, { x:x + dx, y:S.ry })){ fail(where + ': the dot of point ' + i + ' is not in its zone'); break; }
          });
          for (let x = xs + D.SPAN_PIN + 0.5; x < xe - D.SPAN_PIN; x += 1) for (let y = top; y <= S.ry + 9; y += 3) if (!inZ(2, { x:x, y:y })){ fail(where + ': the bar at (' + x + ', ' + y + ') is not in the stretch zone'); x = 1e9; break; }
          for (let x = slots[2].bx; x <= slots[2].bx + slots[2].bw; x += 2) for (let y = slots[2].by; y <= slots[2].by + slots[2].bh; y += 2) if (!inZ(2, { x:x, y:y })){ fail(where + ': the length box is not all in its zone'); x = 1e9; break; }
          if (!(D.SPAN_PIN >= 6 && D.SPAN_PIN <= 10)) fail('GAME span: SPAN_PIN ' + D.SPAN_PIN + ' — the dot (r 5) must be in the point zone, and the bar ±35% of a 50-min stretch must stay in the stretch zone');
          for (let a = 0; a < zones.length; a++) for (let b = a + 1; b < zones.length; b++) if (zones[a].i !== zones[b].i && hit(zbox(zones[a]), zbox(zones[b]))) fail(where + ': zones of place ' + zones[a].i + ' and ' + zones[b].i + ' overlap (without the pad)');
          /* 整片畫板每 1px：頁面的 nearestOpen() 和這裡自己的「最近的那一塊」一樣 */
          if (nearestOpen){
            let bad = 0;
            for (let y = 0; y <= D.SPAN_H && bad < 3; y += 1) for (let x = 0; x <= W && bad < 3; x += 1){
              const g = nearestOpen(zones, { x, y }, S.pad), w = myNearest(zones, { x, y }, S.pad);
              if ((g && g.i) !== (w && w.i)){ bad++; fail(where + ': nearestOpen at (' + x + ', ' + y + ') picks ' + (g && g.i) + ', expected ' + (w && w.i)); }
            }
            const z0 = zones.filter(z => z.i === 2)[0];
            const g = nearestOpen(zones, { x:xs + D.SPAN_PIN + 3, y:S.ry }, S.pad);
            if (!(g && g.i === 2)) fail(where + ': on the bar just past the start dot (inside the start pin’s widened zone too) a drop does not go to the stretch');
            if (!z0) fail(where + ': no stretch zone');
          }
          unsortedOk('span ' + entry, () => D.unsorted(cards, D.spanInOrder), D.spanInOrder, 3000);
          if (!D.spanInOrder(cards) || D.spanInOrder([cards[1], cards[0], cards[2], cards[3]]) || D.spanInOrder([cards[0], cards[1], cards[3], cards[2]])) fail(where + ': spanInOrder does not recognise the answer order (start, end, length first)');
          /* 每一句說明逐個比數字，說的事要成立 */
          LANGS.forEach(L => {
            const d = I18N[L], base = H0 * 60, ck = t => d.gClk(base + t), du = t => d.gDur(t);
            const head = clkD(base + s).concat(clkD(base + e), hmD(Dl), hmD(decoy));
            let want = head.slice();
            parts.forEach(p => { want = want.concat(clkD(base + p[0]), clkD(base + p[1]), hmD(p[1] - p[0])); });
            const bd = d.gSpanBadDur(du(decoy), du(Dl), ck(s), ck(e), parts.map(p => [ck(p[0]), ck(p[1]), du(p[1] - p[0])]));
            say(where + ' gSpanBadDur', L, bd, want);
            has(where + ' gSpanBadDur', L, bd, { zh:['不是 ' + du(decoy)], en:['not ' + du(decoy)] });
            [s, e].forEach((t, i) => {
              const other = i ? s : e;
              const msg = d.gSpanOtherPoint(ck(other), H0 + Math.floor(t / 60), t % 60);
              has(where + ' gSpanOtherPoint', L, msg, { zh:['再過', '不是 ' + ck(other)], en:['min after', 'not ' + ck(other)] });
              hasNot(where + ' gSpanOtherPoint', L, msg, { zh:['之前', '前 '], en:['before'] });
              say(where + ' gSpanOtherPoint', L, msg, L === 'zh' ? [H0 + Math.floor(t / 60), 0, t % 60].concat(clkD(base + other)) : [t % 60, H0 + Math.floor(t / 60), 0].concat(clkD(base + other)));
              /* 第二層提示的「整整幾時」只在中間真的有整整幾時（分三段）的時候才說（驗證者第一輪：50 分的那兩題沒有） */
              if (i === 0){
                const hs = d.gSpan2Span(parts.length === 3);
                say(where + ' gSpan2Span', L, hs, [2]);
                (parts.length === 3 ? has : hasNot)(where + ' gSpan2Span', L, hs, { zh:['整整幾時'], en:['whole hours'] });
              }
              const h2 = d.gSpan2(i ? d.gSpanEnd : d.gSpanStart, H0 + Math.floor(t / 60), t % 60);
              say(where + ' gSpan2', L, h2, L === 'zh' ? [2, H0 + Math.floor(t / 60), 0, t % 60] : [2, t % 60, H0 + Math.floor(t / 60), 0]);
              has(where + ' gSpan2', L, h2, { zh:[i ? '結束的點' : '開始的點'], en:[i ? 'the end point' : 'the start point'] });
            });
            say(where + ' gSpanDone', L, d.gSpanDone(ck(s), ck(e), du(Dl)), clkD(base + s).concat(clkD(base + e), hmD(Dl)));
            say(where + ' gSpanOkClock', L, d.gSpanOkClock(ck(s)), clkD(base + s));
            say(where + ' gSpanOkDur', L, d.gSpanOkDur(du(Dl)), hmD(Dl));
            say(where + ' gSpanDurOnPoint', L, d.gSpanDurOnPoint(du(decoy)), hmD(decoy));
            say(where + ' gSpanClockOnSpan', L, d.gSpanClockOnSpan(ck(e)), clkD(base + e));
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gSpanAsk', L, d.gSpanAsk, []); if (typeof d.gSpan2Span !== 'function') fail('GAME gSpan2Span must be a function of "are there whole hours" (' + L + ')');
          has('gSpanDurOnPoint', L, d.gSpanDurOnPoint('X'), { zh:['時間量', '一段長度', '下面那一段'], en:['length of time', 'stretch below'] });
          has('gSpanClockOnSpan', L, d.gSpanClockOnSpan('X'), { zh:['時刻', '一個點', '上面的點'], en:['point in time', 'one point', 'point above'] });
          ['gSpanStart', 'gSpanEnd', 'gSpanHow'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + k + ' missing in ' + L); });
          say('gSpanNow', L, d.gSpanNow(2), [2, 3]);
        });
        need('span', /var z = nearestOpen\(zones, pt, SPAN\.pad\);\s*if \(!z\) return false;\s*var sl = z\.slot, c = P\.data, why = spanRefuse\(s, e, sl\.k, c\);/, 'span: the place judged is not the one dropped on, or the card judged is not the one dropped');
        need('span', /missOnce\(sl\.k \+ ':' \+ c\.j, msg\);\s*return false;/, 'span: a refused card is not charged once per place and card');
        need('span', /if \(why === 'durOnPoint' && z !== sl\.zones\[0\]\)\{ roundNote\(d\.gSpanDurOnPoint\(text\(c\)\)\); return false; \}\s*if \(why\)\{/, 'span: a length card let go on a dot or its dashed pin (a slip next to the stretch) is charged — it should be a free reminder');
        need('span', /return d\.gSpan2Span\(spanParts\(s, e\)\.length === 3\);/, 'span: hint 2 does not know whether there are whole hours in between');
        need('span', /fillSlot\(P, sl, text\(c\)\);\s*sl\.zones\.forEach\(function\(q\)\{ q\.done = true; \}\);\s*placed\+\+;/, 'span: a placed card does not close every zone of its place');
        need('span', /if \(placed === 3\) roundSolved\(d\.gSpanDone\(clk\(s\), clk\(e\), d\.gDur\(e - s\)\)\);/, 'span: the round is not solved exactly when all three places are filled');
        need('span', /unsorted\(spanCards\(s, e\), spanInOrder\)\.forEach/, 'span: the tray is not shuffled away from the answer order');
        need('span', /'class':'gspanbar', x:spanX\(s\), y:SPAN\.ry - 9, width:spanX\(e\) - spanX\(s\)/, 'span: the bar is not drawn from the start to the end');
        need('span', /if \(hr\) gText\(svg, x, SPAN\.ry - 18, clk\(t\)/, 'span: the hour labels are not the ruler’s own o’clock times');
        need('span', /d\.gSpanOtherPoint\(text\(c\), H0 \+ Math\.floor\(sl\.t \/ 60\), sl\.t % 60\)/, 'span: "this point is …" does not describe the point it was dropped on');
      }

      /* ================= 第 2 關：滿 60 進位 ================= */
      {
        const C = D.CARRY;
        if (Math.abs(D.carryX(C.len) - (C.x0 + 260)) > EPS || C.x0 - 10 < 2) fail('GAME carry: the ruler does not span ' + C.x0 + '..' + (C.x0 + 260));
        if (!(C.ry + 24 + 4 <= D.CARRY_H && C.barY - 8 - 15 >= 2)) fail('GAME carry: the labels do not fit the board');
        D.GAME_CARRY.forEach(entry => {
          const [a, b] = entry, A = a + b, where = 'GAME carry [' + entry + ']';
          if (!(a % 5 === 0 && b % 5 === 0 && A > 60 && A < 120)) fail(where + ': a + b = ' + A + ' must be over 60 and under 120 (one carry, minutes not 0)');
          if (!(a >= 20 && b >= 20)) fail(where + ': a bar under 20 min is too short for its label');
          const lbl = [D.carryX(a / 2), D.carryX(a + b / 2)];
          if (!(lbl[1] - lbl[0] >= 40)) fail(where + ': the two bar labels are closer than 40px');
          for (let h = 0; h <= 3; h++) for (let m = 0; m <= 130; m++){
            const want = m >= 60 ? 'over' : (h * 60 + m !== A ? 'value' : null);
            if (D.carryRefuse(A, h, m) !== want){ fail(where + ': carryRefuse(' + h + ', ' + m + ') = ' + D.carryRefuse(A, h, m) + ', expected ' + want); h = 9; break; }
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gCarryDone', L, d.gCarryDone(a, b, A, 1, A - 60), [a, b, A, 1, A - 60, 60, 1]);
            say(where + ' gCarry2', L, d.gCarry2(a, b, A), [2, a, b, A, A, 60]);
            has(where + ' gCarry2', L, d.gCarry2(a, b, A), { zh:[A + ' 分裡面有一個 60 分'], en:[A + ' minutes contain one group of 60 minutes'] });
            say(where + ' gCarryNow', L, d.gCarryNow(a, b), [a, b]);
            say(where + ' gCarryOver', L, d.gCarryOver(A), [A, 60, 60, 60, 1]);
            [[0, 45], [1, A - 50], [2, 5]].forEach(([h, m]) => {
              const msg = d.gCarryValue(h, m, h * 60 + m, A);
              say(where + ' gCarryValue', L, msg, [h, m, h * 60 + m, A]);
              has(where + ' gCarryValue', L, msg, { zh:['＝ ' + (h * 60 + m) + ' 分，不是 ' + A + ' 分'], en:['= ' + (h * 60 + m) + ' min, not ' + A + ' min'] });
            });
          });
        });
        [['1', 1], [' 1 ', 1], ['0', 0], ['75', 75], ['01', null], ['1.5', null], ['1 5', null], ['', null], ['-1', null], ['1000', null], ['１', null], ['1e2', null]].forEach(([s, v]) => {
          if (D.readInt(s) !== v) fail('GAME readInt("' + s + '") = ' + D.readInt(s) + ', expected ' + v);
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gCarryAsk', L, d.gCarryAsk, []); say('gCarry60', L, d.gCarry60, [60, 1]); say('gCarryBlank', L, d.gCarryBlank, L === 'zh' ? [0] : []);
          has('gCarryOver', L, d.gCarryOver(75), { zh:['小於 60', '1 時'], en:['under 60', '1 hour'] });
          ['gCarryH', 'gCarryM', 'gCarryAriaH', 'gCarryAriaM'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + k + ' missing in ' + L); });
        });
        need('carry', /var h = readInt\(inH\.value\), m = readInt\(inM\.value\);\s*if \(h === null \|\| m === null\)\{ roundNote\(d\.gCarryBlank\); return; \}\s*var why = carryRefuse\(A, h, m\);/, 'carry: the numbers judged are not the ones typed, or a malformed entry is charged');
        need('carry', /if \(why === 'over'\)\{ missOnce\(h \+ ':' \+ m, d\.gCarryOver\(m\)\); return; \}\s*if \(why\)\{ missOnce\(h \+ ':' \+ m, d\.gCarryValue\(h, m, h \* 60 \+ m, A\)\); return; \}/, 'carry: a wrong entry is not charged once per entry, or the reason does not match');
        need('carry', /inH\.disabled = true; inM\.disabled = true; ok\.disabled = true;\s*roundSolved\(d\.gCarryDone\(a, b, A, h, m\)\);/, 'carry: the right answer does not lock the boxes and solve the round');
        need('carry', /\[\[0, a, '#3B7DD8', 'gbarA'\], \[a, A, '#2F9E69', 'gbarB'\]\]/, 'carry: the two bars are not drawn end to end from 0');
        need('carry', /if \(ev\.key === 'Enter'\) submit\(\);/, 'carry: Enter does not submit');
        if (!/\.gnum\{width:68px;height:48px;/.test(src)) fail('GAME carry: the input boxes are not 68×48');
      }

      /* ================= 第 3 關：一天一天疊起來 ================= */
      {
        const T = D.TIMES;
        tooSmall('times card', Math.min(T.cardW, T.cardH)); tooSmall('times box', Math.min(T.slotW, T.slotH));
        const slotB = { c:box(T.slots.c, T.row2, T.slotW, T.slotH), r:box(T.slots.r, T.row2, T.slotW, T.slotH), H:box(T.slots.H, T.row4, T.slotW, T.slotH) };
        const syms = D.TIMES_SYMS.map(q => ({ x:q.x, y:q.y - T.slotH / 2, w:q.w, h:T.slotH }));
        const tray = [];
        T.cardY.forEach(y => T.cardX.forEach(x => tray.push(box(x, y, T.cardW, T.cardH))));
        [slotB.c, slotB.r, slotB.H].concat(syms, tray).forEach((b, i) => inside(b, 'times element ' + i, D.TIMES_H, 2));
        noHits([slotB.c, slotB.r, slotB.H].concat(syms), 'times boxes and words', 1);
        noHits(tray, 'times tray cards', 4);
        /* c、r 兩格放寬之後重疊（nearestOpen 挑近的）；H 格放寬之後碰不到托盤 */
        if (!(slotB.r.x - (slotB.c.x + slotB.c.w) < 2 * T.pad)) fail('GAME times: the carry and minutes boxes do not overlap when widened — nothing for nearest-slot to decide');
        if (!(slotB.H.y + slotB.H.h + T.pad < tray[0].y)) fail('GAME times: the total-hours box (widened by ' + T.pad + ') reaches the tray — a card let go in the tray would be judged');
        if (D.TIMES_SYMS.map(q => q.id).join() !== 'A,h1,m1,eq,h2') fail('GAME times: TIMES_SYMS should be A, h1, m1, eq, h2');
        if (!(T.row1 - 13 >= 2 && T.row3 > T.row2 + T.slotH / 2 + 10 && T.row3 + 10 < T.row4 - T.slotH / 2)) fail('GAME times: the written rows collide with the boxes');
        D.GAME_TIMES.forEach(entry => {
          const [h, m, n] = entry, where = 'GAME times [' + entry + ']';
          const A = m * n, c = Math.floor(A / 60), r = A % 60, H0 = h * n, H = H0 + c, c10 = Math.floor(A / 100), r10 = A % 100;
          const P = D.timesParts(h, m, n);
          if (JSON.stringify(P) !== JSON.stringify({ A, c, r, H0, H, c10, r10 })) fail(where + ': timesParts ' + JSON.stringify(P));
          if (!(A >= 120 && A < 180 && r > 0 && m % 5 === 0 && n >= 3 && h >= 1)) fail(where + ': the minutes product ' + A + ' must be 120..179 with minutes left (two carried hours; hint 2 brackets it between 120 and 180)');
          const cards = D.timesCards(h, m, n);
          if (new Set(cards.map(x => x.v)).size !== 6) fail(where + ': the six cards are not all different (' + cards.map(x => x.v) + ')');
          if (cards.map(x => x.k).join() !== 'c,r,H,c10,r10,H0' || cards.map(x => x.v).join() !== [c, r, H, c10, r10, H0].join()) fail(where + ': timesCards ' + JSON.stringify(cards));
          ['c', 'r', 'H'].forEach(k => cards.forEach(cd => { const want = cd.k === k ? null : cd.k; if (D.timesRefuse(k, cd) !== want) fail(where + ': timesRefuse(' + k + ', ' + cd.k + ')'); }));
          unsortedOk('times ' + entry, () => D.unsorted(cards, D.timesInOrder), D.timesInOrder, 3000);
          LANGS.forEach(L => {
            const d = I18N[L], zh = L === 'zh';
            say(where + ' gTimesAsk', L, d.gTimesAsk(h, m, n), [h, m, n]);
            say(where + ' gTimesRow1', L, d.gTimesRow1(m, n, A), [m, n, A]);
            say(where + ' gTimesRow3', L, d.gTimesRow3(h, n), [h, n]);
            say(where + ' gTimesDone', L, d.gTimesDone(h, m, n, H, r), [h, m, n, H, r, 60]);
            say(where + ' gTimesOkC', L, d.gTimesOkC(A, c), [A, c, 60]);
            say(where + ' gTimesOkR', L, d.gTimesOkR(A, c, r), [A, c * 60, r]);
            say(where + ' gTimesOkH', L, d.gTimesOkH(H0, c, H), [H0, c, H]);
            say(where + ' gTimes2c', L, d.gTimes2c(A), [2, 60, 2, 120, 60, 3, 180, A]);
            say(where + ' gTimes2r', L, d.gTimes2r(A, c), [2, A, c * 60]);
            say(where + ' gTimes2H', L, d.gTimes2H(h, n, H0), [2, h, n, H0]);
            const sy = d.gTimesSyms(A);
            if (nums(sy.A).join() !== String(A) || ['h1', 'm1', 'eq', 'h2'].some(k => typeof sy[k] !== 'string' || /\d/.test(sy[k]))) fail(where + ' gTimesSyms ' + L);
            /* 每一張錯卡 × 每一格：那一句說的事要成立 */
            cards.forEach(cd => {
              const v = cd.v;
              if (cd.k !== 'c'){
                const msg = cd.k === 'c10' ? d.gTimesTen(A, v) : d.gTimesC(v, A);
                if (cd.k === 'c10'){
                  say(where + ' gTimesTen', L, msg, zh ? [A, 100 * v, A - 100 * v, 60, 1, 60] : [A, 100 * v, A - 100 * v, 1, 60]);
                  if (!(v * 100 <= A && A - 100 * v < 100)) fail(where + ': "A = 100 + …" is not the hundreds split of ' + A);
                } else if (v * 60 > A){ say(where + ' gTimesC more', L, msg, [v, v * 60, A]); has(where + ' gTimesC', L, msg, { zh:['還多'], en:['more than'] }); }
                else {
                  say(where + ' gTimesC less', L, msg, [v, v * 60, A, v * 60, A - v * 60, 60]);
                  has(where + ' gTimesC', L, msg, { zh:['還滿 60', '再進位'], en:['still 60 or more', 'carry again'] });
                  if (!(A - v * 60 >= 60)) fail(where + ': "still 60 or more" is false for ' + v);
                }
              }
              if (cd.k !== 'r'){
                const msg = d.gTimesR(v, A, cd.k === 'r10');
                if (v >= 60){ say(where + ' gTimesR ≥60', L, msg, zh ? [v, 60, 60, 60, 1] : [v, 60, 60, 60]); has(where + ' gTimesR ≥60', L, msg, { zh:['已經滿 60', '小於 60'], en:['already 60 or more', 'under 60'] }); }
                else {
                  say(where + ' gTimesR', L, msg, (cd.k === 'r10' ? [A, 100, v, 1, 60] : []).concat([A, v, A - v, 60]));
                  has(where + ' gTimesR', L, msg, { zh:['不是 60 的倍數'], en:['not a multiple of 60'] });
                  if ((A - v) % 60 === 0) fail(where + ': "' + (A - v) + ' is not a multiple of 60" is false');
                  if (cd.k === 'r10' && A !== 100 + v) fail(where + ': "' + A + ' = 100 + ' + v + '" is false');
                }
              }
              if (cd.k !== 'H'){
                if (cd.k === 'H0') say(where + ' gTimesH0', L, d.gTimesH0(h, n, H0), zh ? [h, n, H0, 60] : [h, n, H0]);
                else if (v < H0) say(where + ' gTimesHless', L, d.gTimesHless(v, h, n, H0), [v, h, n, H0, H0]);
                else {
                  const msg = d.gTimesHmore(v, H0, A);
                  say(where + ' gTimesHmore', L, msg, zh ? [H0, v, A, 60] : [H0, v, 60, A]);
                  has(where + ' gTimesHmore', L, msg, { zh:['不會是 ' + v], en:['can’t make ' + v] });
                  /* 「H0 加上進位的時不會是 v」：進位的時是 c，所以 v ≠ H0 ＋ c 才成立 */
                  if (v === H0 + c) fail(where + ': "' + H0 + ' plus the carry can’t make ' + v + '" is false');
                }
              }
            });
          });
        });
        LANGS.forEach(L => {
          has('gTimesH0', L, I18N[L].gTimesH0(2, 5, 10), { zh:['還要加上', '進位'], en:['add the hours carried'] });
          has('gTimesTen', L, I18N[L].gTimesTen(125, 1), { zh:['十進位', '1 時只有 60 分'], en:['hundreds', '1 hour is only 60 minutes'] });
        });
        need('times', /var sl = nearestOpen\(slots, pt, TIMES\.pad\);\s*if \(!sl\) return false;\s*var c = P\.data;\s*if \(timesRefuse\(sl\.k, c\)\)\{/, 'times: the box judged is not the one dropped on, or the card judged is not the one dropped');
        need('times', /var msg = sl\.k === 'c' \? \(c\.k === 'c10' \? d\.gTimesTen\(X\.A, c\.v\) : d\.gTimesC\(c\.v, X\.A\)\)\s*: sl\.k === 'r' \? d\.gTimesR\(c\.v, X\.A, c\.k === 'r10'\)\s*: \(c\.k === 'H0' \? d\.gTimesH0\(h, n, X\.H0\) : c\.v < X\.H0 \? d\.gTimesHless\(c\.v, h, n, X\.H0\) : d\.gTimesHmore\(c\.v, X\.H0, X\.A\)\);\s*missOnce\(sl\.k \+ ':' \+ c\.k, msg\);/, 'times: the reason does not match the box and the card, or a refusal is not charged once per box and card');
        need('times', /if \(placed === 3\) roundSolved\(d\.gTimesDone\(h, m, n, X\.H, X\.r\)\);/, 'times: the round is not solved exactly when all three boxes are filled');
        need('times', /unsorted\(timesCards\(h, m, n\), timesInOrder\)\.forEach/, 'times: the tray is not shuffled away from the answer order');
        need('times', /text:String\(c\.v\), cls:'gcard', data:\{ k:c\.k, v:c\.v \}/, 'times: a card does not show the value it is judged by');
        need('times', /gText\(svg, GW \/ 2, TIMES\.row1 \+ 6, d\.gTimesRow1\(m, n, X\.A\)/, 'times: the minutes row is not printed from the question');
      }

      /* ================= 第 4 關：把時間平分 ================= */
      {
        const S = D.SHARE;
        tooSmall('share dot', D.GPICK);
        if (!(S.x0 - D.GPICK / 2 >= 2 && S.x0 + S.w + D.GPICK / 2 <= W - 2)) fail('GAME share: the dot at 0 or at the end leaves the board');
        if (!(S.gripY - D.GPICK / 2 >= S.rowY + S.rowH && S.gripY + D.GPICK / 2 <= S.ry - 9)) fail('GAME share: the dot covers the orange part or the ruler');
        if (!(S.ry + 26 + 4 <= D.SHARE_H && S.totY - 8 - 15 >= 2)) fail('GAME share: the labels do not fit the board');
        if (!(S.band[0] <= S.totY && S.band[1] >= S.ry + 26)) fail('GAME share: a tap on the bars or the ruler does not move the dot');
        D.GAME_SHARE.forEach(entry => {
          const [h, m, n] = entry, T = h * 60 + m, v0 = T / n, where = 'GAME share [' + entry + ']';
          if (!(isInt(v0) && v0 % 5 === 0)) fail(where + ': ' + T + ' ÷ ' + n + ' is not a whole number of 5-min steps');
          if (!(T % 60 !== 0 && h % n !== 0 && m % n === 0 && T <= 270)) fail(where + ': needs a borrow (h not a multiple of n), m a multiple of n, T not on the hour and ≤ 270');
          /* 兩種迷思的那一份都要拖得到（5 分一格、0 < v ≤ T、不是答案）—— 不然那兩句說明永遠看不到（驗證者第一輪：[3, 45, 5] 的 9 分、69 分） */
          [['forgot-to-borrow', Math.floor(h / n) * 60 + m / n, 'borrow'], ['read-as-' + (100 * h + m), (100 * h + m) / n, 'ten']].forEach(([what, tv, flag]) => {
            if (!(isInt(tv) && tv % 5 === 0 && tv > 0 && tv <= T && tv !== v0)) fail(where + ': the ' + what + ' share ' + tv + ' is not on the 5-min grid inside 0..' + T + ' (or is the answer) — the slider can never show its explanation');
            else if (!(D.shareRefuse(h, m, n, tv) || {})[flag]) fail(where + ': the ' + what + ' share ' + tv + ' is not recognised by shareRefuse');
          });
          for (let x = S.x0 - 40; x <= S.x0 + S.w + 40; x += 0.25){
            const want = Math.max(0, Math.min(T, Math.round((x - S.x0) / (S.w / T) / 5) * 5));
            if (Math.abs(D.shareSnap(T, x) - want) > EPS){ fail(where + ': shareSnap(' + x + ') = ' + D.shareSnap(T, x) + ', expected ' + want); break; }
          }
          for (let v = 0; v <= T; v += 5){
            if (Math.abs(D.shareX(T, v) - (S.x0 + v * S.w / T)) > EPS) fail(where + ': shareX(' + v + ')');
            [0, 0.35, -0.35].forEach(f => { if (D.shareSnap(T, D.shareX(T, v) + f * 5 * S.w / T) !== v) fail(where + ': a tap ' + f + ' of a cell from ' + v + ' does not pick ' + v); });
            const x = v * n, less = x < T, diff = Math.abs(T - x);
            const borrow = h % n !== 0 && m % n === 0 && v === Math.floor(h / n) * 60 + m / n, ten = (h * 100 + m) % n === 0 && v === (h * 100 + m) / n;
            const want = x === T ? null : { x, less, diff, borrow, ten };
            const got = D.shareRefuse(h, m, n, v);
            if (JSON.stringify(got) !== JSON.stringify(want)) fail(where + ': shareRefuse(' + v + ') = ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want));
            if (v === 0 || !got) continue;
            LANGS.forEach(L => {
              const d = I18N[L], du = d.gDur;
              const bad = d.gShareBad(n, du(v), du(x), du(T), less, du(diff));
              say(where + ' gShareBad(' + v + ')', L, bad, L === 'zh' ? [n].concat(hmD(v), hmD(x), hmD(T), hmD(diff)) : [n].concat(hmD(v), hmD(x), hmD(diff), hmD(T)));
              /* 「＝ 3 時，比 3 時 20 分 少 20 分」讀起來像「3 時 20 分」：結果和比較之間要有「這比／which is」（驗證者第一輪） */
              has(where + ' gShareBad(' + v + ')', L, bad, { zh:['＝ ' + du(x) + '，這比 ' + du(T)], en:['= ' + du(x) + ', which is ' + du(diff)] });
              has(where + ' gShareBad(' + v + ')', L, bad, less ? { zh:[' 少 '], en:[' less than '] } : { zh:[' 多 '], en:[' more than '] });
            });
          }
          const vb = Math.floor(h / n) * 60 + m / n;
          if (vb % 5 === 0 && vb > 0 && !(D.shareRefuse(h, m, n, vb) || {}).borrow) fail(where + ': the forgot-to-borrow share ' + vb + ' is not recognised');
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gShareAsk', L, d.gShareAsk(h, m, n), [h, m, n]);
            say(where + ' gShareDone', L, d.gShareDone(h, m, n, T, v0, d.gDur(v0)), [h, m, T, T, n, v0].concat(v0 >= 60 ? hmD(v0) : [], [n]));
            say(where + ' gShare2', L, d.gShare2(h, m, n, T), [2, h, m, h, 60, m, T, n]);
            const q = Math.floor(h / n), rem = h % n;
            const bm = d.gShareBorrow(h, n, q, rem, m);
            if (q > 0){
              say(where + ' gShareBorrow', L, bm, [h, n, q, rem, rem, rem * 60, m]);
              has(where + ' gShareBorrow', L, bm, { zh:['只拿了商 ' + q + ' 時', '把餘下的 ' + rem + ' 時丟掉了', '剩下的 ' + rem + ' 時要換成 ' + rem * 60 + ' 分'],
                                                  en:['keeping only the ' + q + ' h', 'dropping the ' + rem + ' h left over', rem + ' h must become ' + rem * 60 + ' min'] });
            } else {
              /* 商是 0：不要說「只拿了商 0 時」—— 說整個 h 時都丟掉了，因為 h 時不夠每份分到 1 時（驗證者第一輪） */
              say(where + ' gShareBorrow q=0', L, bm, [h, h, n, 1, rem, rem * 60, m]);
              if (!(h < n && rem === h)) fail(where + ': "' + h + ' h is not enough to give each of the ' + n + ' parts 1 h" is false');
              has(where + ' gShareBorrow q=0', L, bm, { zh:['把 ' + h + ' 時整個丟掉了', '不夠分給 ' + n + ' 份', '這 ' + h + ' 時要換成 ' + h * 60 + ' 分'],
                                                       en:['drops the whole ' + h + ' h', 'not enough to give each of the ' + n + ' parts 1 h', h + ' h must become ' + h * 60 + ' min'] });
              hasNot(where + ' gShareBorrow q=0', L, bm, { zh:['商 0'], en:['the 0 h'] });
            }
            say(where + ' gShareTen', L, d.gShareTen(h, m, h * 100 + m, T), [h, m, h * 100 + m, 1, 60, h, m, T]);
            say(where + ' gShareNow', L, d.gShareNow(d.gDur(v0)), hmD(v0));
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gShareZero', L, d.gShareZero, []); say('gShareH', L, d.gShareH(2), [2]);
          say('gShareLess', L, d.gShareLess, [5]); say('gShareMore', L, d.gShareMore, [5]);
          has('gShareBorrow', L, d.gShareBorrow(3, 2, 1, 1, 30), { zh:['餘下的', '換成'], en:['left over', 'must become'] });
          has('gShareTen', L, d.gShareTen(3, 20, 320, 200), { zh:['當成', '1 時是 60 分'], en:['treats', '1 hour is 60 minutes'] });
        });
        need('share', /var r = shareRefuse\(h, m, n, v\);\s*if \(r\)\{\s*missOnce\('v' \+ v, d\.gShareBad\(n, d\.gDur\(v\), d\.gDur\(r\.x\), d\.gDur\(T\), r\.less, d\.gDur\(r\.diff\)\)\s*\+ \(r\.borrow \? d\.gShareBorrow\(h, n, Math\.floor\(h \/ n\), h % n, m\) : ''\) \+ \(r\.ten \? d\.gShareTen\(h, m, h \* 100 \+ m, T\) : ''\)\);\s*return;/, 'share: the share judged is not the one shown, a wrong share is not charged once per value, or the reason does not match');
        need('share', /if \(gSolved \|\| grip\.busy\(\)\) return;   \/\* 圓點正被拖著：先放開才判斷 \*\/\s*var v = gCtx\.v;\s*if \(v === 0\)\{ roundNote\(d\.gShareZero\); return; \}/, 'share: That’s it judges while the dot is held, or charges an empty share');
        need('share', /if \(gSolved \|\| grip\.busy\(\)\) return;   \/\* 圓點正被拖著：點線、按 ◀ ▶ 都不算數/, 'share: a tap on the line or ◀ ▶ moves the dot while it is held');
        need('share', /snapX:function\(x\)\{ return shareX\(T, shareSnap\(T, x\)\); \}, onPlace:function\(P\)\{ set\(shareSnap\(T, P\.cx\)\); \}/, 'share: the readout and the orange part do not follow the dot');
        need('share', /line\.textContent = d\.gShareNow\(d\.gDur\(v\)\);/, 'share: the readout is not the share being judged');
        /* 橘色那一段只在 set(v) 裡畫一次 —— 後面再多畫一次（例如 v ＋ 5）也算畫錯（codex 第二輪） */
        if ((RB.share.match(/bar\.setAttribute\(/g) || []).length !== 1 || (RB.share.match(/stem\.setAttribute\(/g) || []).length !== 2) fail('GAME share: the orange part (bar / stem) is drawn somewhere besides set(v)');
        need('share', /function set\(v\)\{\s*gCtx\.v = v;\s*bar\.setAttribute\('width', shareX\(T, v\) - SHARE\.x0\);\s*stem\.setAttribute\('x1', shareX\(T, v\)\); stem\.setAttribute\('x2', shareX\(T, v\)\);/, 'share: the orange part drawn is not the share being judged');
        need('share', /grip\.lock\(grip\.cx, grip\.cy\);\s*copies\(v\);[^\n]*\n\s*less\.disabled = true; more\.disabled = true; ok\.disabled = true;\s*roundSolved\(d\.gShareDone\(h, m, n, T, v, d\.gDur\(v\)\)\);/, 'share: the right share does not lock the dot, draw the n parts and solve the round');
        need('share', /B\.onBoardTap = function\(pt\)\{ if \(inBand\(pt\)\) moveTo\(shareSnap\(T, pt\.x\)\); \};/, 'share: a tap on the line does not move the dot');
      }

      /* ================= 第 5 關：由短排到長 ================= */
      {
        const R = D.RANK;
        tooSmall('rank card', Math.min(R.w, R.h));
        const slots = R.rowY.map(y => box(R.slotX, y, R.w, R.h)), tray = R.rowY.map(y => box(R.cardX, y, R.w, R.h));
        const caps = [{ x:R.slotX - R.w / 2, y:R.capTop[0], w:R.w, h:R.capTop[1] - R.capTop[0] }, { x:R.slotX - R.w / 2, y:R.capBot[0], w:R.w, h:R.capBot[1] - R.capBot[0] }];
        slots.concat(tray, caps).forEach((b, i) => inside(b, 'rank element ' + i, D.RANK_H, 2));
        noHits(slots.concat(tray, caps), 'rank boxes, cards and captions', 2);
        if (!(caps[0].h >= 22 && caps[1].h >= 22)) fail('GAME rank: a caption is under 22px tall');
        if (!(R.rowY[1] - R.rowY[0] - R.h < 2 * R.pad)) fail('GAME rank: neighbouring boxes do not overlap when widened — nothing for nearest-slot to decide');
        if (nearestOpen){
          const zs = slots.map((b, i) => ({ i:i, cx:R.slotX, cy:R.rowY[i], hw:R.w / 2, hh:R.h / 2 }));
          let bad = 0;
          for (let y = 0; y <= D.RANK_H && bad < 3; y += 0.5){ const g = nearestOpen(zs, { x:R.slotX, y }, R.pad), w = myNearest(zs, { x:R.slotX, y }, R.pad); if ((g && g.i) !== (w && w.i)){ bad++; fail('GAME rank: nearestOpen at y ' + y + ' picks ' + (g && g.i) + ', expected ' + (w && w.i)); } }
          tray.forEach((b, i) => { if (nearestOpen(zs, { x:R.cardX, y:R.rowY[i] }, R.pad)) fail('GAME rank: a card let go at its own tray place is judged'); });
        }
        D.GAME_RANK.forEach((set, si) => {
          const where = 'GAME rank set ' + si, ts = set.map(c => c[0]);
          if (set.length !== 4 || new Set(ts).size !== 4) fail(where + ': four different lengths');
          if (!set.some(c => c[1]) || !set.some(c => !c[1])) fail(where + ': needs both "h 時 m 分" and "m 分" cards');
          set.forEach(c => {
            if (c[1] && !(c[0] > 60 && c[0] % 60 !== 0)) fail(where + ': an hours-and-minutes card ' + c[0] + ' must have hours and minutes');
            if (!c[1] && !(c[0] >= 60)) fail(where + ': a minutes card ' + c[0] + ' under 60 needs no converting');
            if (c[0] % 5 !== 0) fail(where + ': ' + c[0] + ' is not a multiple of 5');
          });
          const dec = c => c[1] ? Math.floor(c[0] / 60) * 100 + c[0] % 60 : c[0];
          if (!set.some(a => set.some(b => a[0] < b[0] && dec(a) > dec(b)))) fail(where + ': reading "1 時 40 分" as 140 never puts two of them the wrong way round');
          set.forEach(c => { const k = ts.filter(t => t < c[0]).length; if (D.rankOf(set, c[0]) !== k) fail(where + ': rankOf(' + c[0] + ') = ' + D.rankOf(set, c[0]) + ', expected ' + k); });
          unsortedOk('rank set ' + si, () => D.unsorted(set, D.rankInOrder), list => list.every((c, i) => !i || list[i - 1][0] < c[0]), 3000);
          if (!D.rankInOrder(set.slice().sort((a, b) => a[0] - b[0])) || D.rankInOrder(set.slice().sort((a, b) => b[0] - a[0]))) fail(where + ': rankInOrder does not recognise the answer order');
          LANGS.forEach(L => {
            const d = I18N[L], txt = c => c[1] ? d.gDur(c[0]) : d.gMin(c[0]), dg = c => c[1] ? hmD(c[0]).concat([c[0]]) : [c[0]];
            /* 英文說「the 2nd shortest」，第 1 名就是「the shortest」（不寫 1）—— 這裡自己拼，不用頁面的 gRankOrd */
            const ord = k => k === 1 ? 'the shortest' : 'the ' + k + ['', 'st', 'nd', 'rd', 'th'][k] + ' shortest', kd = k => (L === 'en' && k === 1) ? [] : [k];
            const sorted = set.slice().sort((a, b) => a[0] - b[0]);
            say(where + ' gRankDone', L, d.gRankDone(sorted.map(c => d.gRankItem(txt(c), c[0], c[1]))), [].concat(...sorted.map(dg)));
            set.forEach(c => {
              const k = ts.filter(t => t < c[0]).length;
              for (let i = 0; i < 4; i++) if (i !== k){
                const msg = d.gRankBad(txt(c), c[0], c[1], k + 1, i + 1);
                say(where + ' gRankBad', L, msg, dg(c).concat(kd(k + 1), kd(i + 1)));
                has(where + ' gRankBad', L, msg, { zh:['它是第 ' + (k + 1) + ' 短，不是第 ' + (i + 1) + ' 短'], en:['it is ' + ord(k + 1) + ', not ' + ord(i + 1) + '.'] });
                hasNot(where + ' gRankBad', L, msg, { zh:['長'], en:['longest'] });
              }
              const okm = d.gRankOk(txt(c), c[0], c[1], k + 1);
              say(where + ' gRankOk', L, okm, dg(c).concat(kd(k + 1)));
              has(where + ' gRankOk', L, okm, { zh:['是第 ' + (k + 1) + ' 短'], en:['is ' + ord(k + 1) + '.'] });
              hasNot(where + ' gRankOk', L, okm, { zh:['長'], en:['longest'] });
              if (c[1]) say(where + ' gRank2', L, d.gRank2(txt(c), Math.floor(c[0] / 60), c[0] % 60, c[0]), [2].concat(hmD(c[0]), [60], hmD(c[0]), [c[0]]));
            });
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gRankAsk', L, d.gRankAsk, []); say('gRank2None', L, d.gRank2None, [2]); say('gRankNow', L, d.gRankNow(3), [3, 4]);
          has('gRankTop', L, d.gRankTop, { zh:['最短'], en:['shortest'] }); has('gRankBot', L, d.gRankBot, { zh:['最長'], en:['longest'] });
          has('gRankDone', L, d.gRankDone(['a', 'b']), { zh:['先統一成分'], en:['into minutes first'] });
        });
        need('rank', /var sl = nearestOpen\(slots, pt, RANK\.pad\);\s*if \(!sl\) return false;\s*var c = P\.data, k = rankOf\(set, c\.t\), txt = text\(\[c\.t, c\.hm\]\);\s*if \(k !== sl\.i\)\{ missOnce\(c\.j \+ ':' \+ sl\.i, d\.gRankBad\(txt, c\.t, c\.hm, k \+ 1, sl\.i \+ 1\)\); return false; \}/, 'rank: the box judged is not the one dropped on, the card judged is not the one dropped, or a refusal is not charged once per card and box');
        need('rank', /if \(placed === 4\)\{/, 'rank: the round is not solved when all four boxes are filled');
        need('rank', /var pieces = unsorted\(set, rankInOrder\)\.map/, 'rank: the tray is not shuffled away from the answer order');
        need('rank', /text:text\(c\), cls:'gcard', data:\{ t:c\[0\], hm:c\[1\], j:j \}/, 'rank: a card does not show the length it is judged by');
      }
    }
  }
};
module.exports._test = { timeClaims, minutesOf };
