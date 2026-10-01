/* grade-3/math/time 的檢查設定（時間偵察兵：秒與 60 進位、長針每個數字 5 分、時間量相加滿 60 進位、時刻 ＋ 時間量、時刻 − 時刻）。
   2026-10-01 新增 —— 和小遊戲「趕上下一班車」改成五關五種玩法（§六之五）同一次寫成。在這之前這一課沒有設定檔，
   simgen／verify_lesson_data 一律直接報 no check config。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算），
   renderCheck 把題幹裡的鐘面 SVG 讀回幾點幾分、把每個選項換成「幾分」兩兩比值、把解釋裡的算式逐條重算。
   第一次跑就抓到的舊缺陷（都修在 review.html）：中文選項「2分15秒」數字和中文黏在一起；readClock 的解釋說
   「短針指的是 h」（3:55 的短針幾乎指著 4）；diffTime 會出「0分」誘答、會出 95 分（課程範例 5 只到 1 時以內）；
   fwdTime 的第一個誘答就是題幹自己的時刻；durAddNoCarry 的 |a − b| 會是 0 或抄回題幹的 a；addsub 的 |a − b| 在 a = 2b 時就是 b。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算（掃描器跳過 9:40 這種時刻裡的數字）；
     題幹有鐘面的三題，從 SVG 讀回時間再和標的正解比。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關**照遊戲的規則把每一題從頭玩一次**（換一換把所有裝法走完；撥時鐘每一個數字；進位卡每一張卡 × 每一格；
     先到整點每一格 × 停在出發點／整點；分段數每一個打得出來的數），證明每一題都解得完、而且解完一定是對的；
     每一條「為什麼」都驗它在觸發它的那個情況下是真的，再逐個比數字。
     頁面的純函式（handIdx／hopTick／bundTrayXY／…）一律拿整個範圍去呼叫再和自己的算法比；
     nearestOpen()、roundMiss()、分段數的 submit() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-time 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function hm(t){ const h = Math.floor(t / 60), m = t % 60; return h + ':' + (m < 10 ? '0' + m : m); }
const hmn = t => [Math.floor(t / 60), t % 60];

/* 算式掃描：「數 op 數 … ＝ 結果」逐條重算（× 先算，再由左到右 ＋ −）。
   9:40、10:00 這種時刻裡的數字不算（前後緊貼著「:」）；＝ 後面是時刻的也不算。 */
function scanEquations(text){
  const t = String(text).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/:])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(\d+)(?![\d.\/:])/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1], got = +m[2];
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0) bad = 'a division in a time lesson';
    else {
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

/* 時刻的算式：「9:40 ＋ 50 分 ＝ 10:30」「10:30 − 9:40 ＝ 50 分」—— scanEquations() 跳過時刻裡的數字，這裡另外算（codex 第一輪抓到） */
function scanClockEq(text){
  const t = String(text).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/\s+/g, ' ');
  const out = [], T = (h, m) => +h * 60 + +m;
  for (const m of t.matchAll(/(?<![\d:])(\d{1,2}):(\d{2}) ?\+ ?(\d+) ?(?:分|min(?:utes)?)? ?= ?(\d{1,2}):(\d{2})(?![\d:])/g))
    out.push({ text:m[0], bad: T(m[1], m[2]) + +m[3] === T(m[4], m[5]) ? null : 'should be ' + hm(T(m[1], m[2]) + +m[3]) });
  for (const m of t.matchAll(/(?<![\d:])(\d{1,2}):(\d{2}) ?- ?(\d{1,2}):(\d{2}) ?= ?(\d+)(?![\d:])/g))
    out.push({ text:m[0], bad: T(m[1], m[2]) - T(m[3], m[4]) === +m[5] ? null : 'should be ' + (T(m[1], m[2]) - T(m[3], m[4])) });
  return out;
}

/* clockSVG() 的輸出讀回幾點幾分：短針（橘 #E8871E）與長針（藍 #3B7DD8）的角度。
   長針決定分；短針必須真的在 (h + m/60) × 30° —— 只讀長針會放過畫錯的短針。 */
function readClocks(html){
  const out = [];
  (String(html).match(/<svg[\s\S]*?<\/svg>/g) || []).forEach(svg => {
    const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="(#E8871E|#3B7DD8)"/g)];
    const hr = lines.find(l => l[5] === '#E8871E'), mn = lines.find(l => l[5] === '#3B7DD8');
    if (!hr || !mn || lines.length !== 2) return out.push(null);
    const ang = l => { const a = Math.atan2(+l[3] - +l[1], +l[2] - +l[4]) * 180 / Math.PI; return a < 0 ? a + 360 : a; };
    const am = ang(mn), ah = ang(hr), m = Math.round(am / 6) % 60;
    if (Math.abs(am - m * 6) > 1 && Math.abs(am - m * 6) < 359) return out.push(null);
    let h = Math.floor(((ah - m / 2) + 360.5) % 360 / 30); if (h === 0) h = 12;
    const want = ((h % 12) + m / 60) * 30, diff = Math.min(Math.abs(ah - want), 360 - Math.abs(ah - want));
    out.push(diff < 1 ? { h, m } : null);
  });
  return out;
}

/* 選項換成「幾分」（時刻選項不換，回傳 null）：兩兩比值用 */
function minutesOf(s, lang){
  let m;
  if (lang === 'zh'){
    if ((m = s.match(/^(\d+) 時 (\d+) 分$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) 分 (\d+) 秒$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) 分$/))) return +m[1];
  } else {
    if ((m = s.match(/^(\d+) h (\d+) min$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) min (\d+) sec$/))) return +m[1] * 60 + +m[2];
    if ((m = s.match(/^(\d+) min$/))) return +m[1];
  }
  return null;
}
const SHAPE = { readClock:'clock', minuteRead:'min', secToMin:'ms', minToHour:'hm', durAddNoCarry:'min', durAddCarry:'hm', fwdTime:'clock', diffTime:'min', addsub:'int', multiply:'int', numbers:'digit' };

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['bundle', 'hand', 'carry', 'hop', 'span'];", replace:"var GAME_ORDER = ['hand', 'bundle', 'carry', 'hop', 'span'];" },
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
    { file:'index', expect:'gPts', find:"      gPts: function(p){ return '（分數 +' + p + '）'; },", replace:"      gPts: function(p){ return '（分數 +' + (p + 10) + '）'; }," },

    /* 換一換 */
    { file:'index', expect:'a box of 60', find:'var BUND_H = 312, BUND_FULL = 6,', replace:'var BUND_H = 312, BUND_FULL = 10,' },
    { file:'index', expect:'no entry leaves nothing over', find:'{ u:\'sec\', n:12 },', replace:'{ u:\'sec\', n:10 },' },
    { file:'index', expect:'no entry leaves 50', find:'{ u:\'sec\', n:11 },', replace:'{ u:\'sec\', n:10 },' },
    { file:'index', expect:'sticks — should be 7~15', find:'{ u:\'min\', n:15 },', replace:'{ u:\'min\', n:17 },' },
    { file:'index', expect:'only one unit', find:"var GAME_BUNDLE = [ { u:'sec', n:13 }, { u:'min', n:9 }, { u:'sec', n:12 }, { u:'min', n:15 }, { u:'sec', n:11 }, { u:'min', n:14 } ];", replace:"var GAME_BUNDLE = [ { u:'sec', n:13 }, { u:'sec', n:9 }, { u:'sec', n:12 }, { u:'sec', n:15 }, { u:'sec', n:11 }, { u:'sec', n:14 } ];" },
    { file:'index', expect:'bundSlotXY(', find:'y:BUND_BOX.top + Math.floor(s / 3) * BUND_BOX.step }; }', replace:'y:BUND_BOX.top + (s % 3) * BUND_BOX.step }; }' },
    { file:'index', expect:'boxes closer than 12', find:'var BUND_BOX = { y:58, w:84, h:84, gap:12,', replace:'var BUND_BOX = { y:58, w:84, h:84, gap:6,' },
    { file:'index', expect:'reach the sticks', find:'BUND_TRAY = { y:170, step:54, perRow:5 };', replace:'BUND_TRAY = { y:130, step:54, perRow:5 };' },
    { file:'index', expect:'sticks 0 and 1 overlap', find:'BUND_TRAY = { y:170, step:54, perRow:5 };', replace:'BUND_TRAY = { y:170, step:44, perRow:5 };' },
    { file:'index', expect:'one more than needed', find:'      var nb = Math.floor(n / BUND_FULL) + 1, boxes = [];', replace:'      var nb = Math.floor(n / BUND_FULL), boxes = [];' },
    { file:'index', expect:'a second box can be started', find:'          if (cur){ roundMiss(d.gBundFinish(cur.n * 10, u)); return false; }\n', replace:'' },
    { file:'index', expect:'a second box can be started', find:'          if (left < BUND_FULL){ roundMiss(d.gBundShort(left * 10, u)); return false; }\n          cur = bx;', replace:'          cur = bx;' },
    { file:'index', expect:'"done" is accepted', find:'        if (cur){ roundMiss(d.gBundPartial(cur.n * 10, u)); return; }\n', replace:'' },
    { file:'index', expect:'"done" is accepted', find:'        if (left >= BUND_FULL){ roundMiss(d.gBundMore(left * 10, u)); return; }\n        finish();', replace:'        finish();' },
    { file:'index', expect:'a box is not sealed exactly at 60', find:'        if (bx.n === BUND_FULL){ bx.done = true;', replace:'        if (bx.n === BUND_FULL + 1){ bx.done = true;' },
    { file:'index', expect:'not sent home', find:"        sticks.forEach(function(P){ if (!P.locked) P.lock(P.homeX, P.homeY); });", replace:"        sticks.forEach(function(P){ if (!P.locked) P.lock(P.cx, P.cy); });" },
    { file:'index', expect:'gBundDone zh', find:"return r ? (total + ' ' + s + ' ＝ ' + q + ' ' + b + ' ' + r + ' ' + s + '：' + q + ' 盒都是 60 '", replace:"return r ? (total + ' ' + s + ' ＝ ' + q + ' ' + b + ' ' + (r + 10) + ' ' + s + '：' + q + ' 盒都是 60 '" },
    { file:'index', expect:'gBundMore en', find:"return left + ' ' + U[u] + ' still left — that’s 60 '", replace:"return (left - 10) + ' ' + U[u] + ' still left — that’s 60 '" },
    { file:'index', expect:'a reason trades for', find:"return '只剩 ' + left + ' ' + U[u] + '，不到 60 ' + U[u] + '，換不成 1 ' + U[BUND_BIG[u]] + '。'; }", replace:"return '只剩 ' + left + ' ' + U[u] + '，不到 60 ' + U[u] + '，換不成 1 ' + U[u] + '。'; }" },

    /* 撥時鐘 */
    { file:'index', expect:'is o\'clock', find:'{ h:4, m:5 },', replace:'{ h:4, m:0 },' },
    { file:'index', expect:'is not a multiple of 5', find:'{ h:6, m:50 },', replace:'{ h:6, m:52 },' },
    { file:'index', expect:'"pointing at m" misconception', find:"var GAME_HAND = [ { h:3, m:10 }, { h:8, m:25 }, { h:4, m:5 },", replace:"var GAME_HAND = [ { h:3, m:20 }, { h:8, m:25 }, { h:4, m:15 }," },
    { file:'index', expect:'handIdx(', find:'    return Math.round(handAngle(pt) / 30) % 12;', replace:'    return Math.floor(handAngle(pt) / 30) % 12;' },
    { file:'index', expect:'handIdx(', find:'    if (r < HAND_C.pad || r > HAND_C.r + 12) return -1;', replace:'    if (r > HAND_C.r + 12) return -1;' },
    { file:'index', expect:'handAngle(', find:'function handAngle(pt){ var deg = Math.atan2(pt.x - HAND_C.x, HAND_C.y - pt.y)', replace:'function handAngle(pt){ var deg = Math.atan2(pt.x - HAND_C.x, pt.y - HAND_C.y)' },
    { file:'index', expect:'the knob covers its number', find:'num:106, knob:64, hand:84,', replace:'num:106, knob:84, hand:96,' },
    { file:'index', expect:'clock face is outside the', find:'var HAND_H = 300, HAND_C = { x:150, y:150, r:132,', replace:'var HAND_H = 300, HAND_C = { x:150, y:150, r:152,' },
    { file:'index', expect:'a wrong number is accepted', find:'        if (k === t){\n          var tip', replace:'        if (k === t || k === e.m){\n          var tip' },
    { file:'index', expect:'the short hand does not follow', find:"hp = polar(C.r, C.r, ((e.h % 12) + deg / 360) * 30, C.short);", replace:"hp = polar(C.r, C.r, (e.h % 12) * 30, C.short);" },
    { file:'index', expect:'has no reason of its own (the trap', find:"        if (k === e.m) roundMiss(d.gHandTrap(k));\n        else roundMiss(d.gHandWrong(k, e.m));", replace:"        roundMiss(d.gHandWrong(k, e.m));" },
    { file:'index', expect:'a drop back on 12 is not silent', find:'        if (k <= 0) return false;', replace:'        if (k < 0) return false;' },
    { file:'index', expect:'en gHandTrap', find:"return 'The long hand on ' + k + ' is not ' + k + ' minutes: ' + k + ' × 5 = ' + (k * 5) + ' minutes.'; }", replace:"return 'The long hand on ' + k + ' is not ' + k + ' minutes: ' + k + ' × 5 = ' + (k * 6) + ' minutes.'; }" },
    { file:'index', expect:'gHandDone zh', find:"'：' + t + ' × 5 ＝ ' + m + ' 分，短針在 ' + h + ' 和 ' + (h % 12 + 1) + ' 中間", replace:"'：' + t + ' × 5 ＝ ' + m + ' 分，短針在 ' + h + ' 和 ' + (h % 12 + 2) + ' 中間" },

    /* 進位卡 */
    { file:'index', expect:'never reach 60', find:'{ ah:0, am:40, bm:35 },', replace:'{ ah:0, am:20, bm:35 },' },
    { file:'index', expect:'leaves 0 minutes', find:'{ ah:0, am:50, bm:30 },', replace:'{ ah:0, am:30, bm:30 },' },
    { file:'index', expect:'no entry starts with an hour', find:'{ ah:1, am:20, bm:50 }, { ah:0, am:50, bm:30 }, { ah:1, am:35, bm:40 },', replace:'{ ah:0, am:20, bm:50 }, { ah:0, am:50, bm:30 }, { ah:0, am:35, bm:40 },' },
    { file:'index', expect:'is too short for its label', find:'{ ah:0, am:45, bm:40 },', replace:'{ ah:0, am:45, bm:20 },' },
    { file:'index', expect:'beyond the ruler', find:'var CARRY_H = 296, CARRY_RULER = { x0:24, x1:276, y:104, max:150 }', replace:'var CARRY_H = 296, CARRY_RULER = { x0:24, x1:276, y:104, max:120 }' },
    { file:'index', expect:'carryX(', find:'function carryX(t){ return CARRY_RULER.x0 + t / CARRY_RULER.max * (CARRY_RULER.x1 - CARRY_RULER.x0); }', replace:'function carryX(t){ return CARRY_RULER.x0 + t / CARRY_RULER.max * (CARRY_RULER.x1 - CARRY_RULER.x0 - 10); }' },
    { file:'index', expect:'carry: slot', find:'var CARRY_EQ = { y:178, slot:52, hx:80, mx:176, ux:[122, 226] }', replace:'var CARRY_EQ = { y:178, slot:52, hx:80, mx:150, ux:[122, 226] }' },
    { file:'index', expect:'the card tray reaches the slots', find:'CARRY_TRAY = { y:260, step:64 };', replace:'CARRY_TRAY = { y:226, step:64 };' },
    { file:'index', expect:'carry: cards', find:'CARRY_TRAY = { y:260, step:64 };', replace:'CARRY_TRAY = { y:260, step:48 };' },
    { file:'index', expect:'the cards are not', find:'renderTray(B, [H, M, H - 1, s], CARRY_TRAY.y,', replace:'renderTray(B, [H, M, H + 1, s], CARRY_TRAY.y,' },
    { file:'index', expect:'"h" accepts', find:"        if (sl.kind === 'h' && v !== H){", replace:"        if (sl.kind === 'h' && v !== H && v !== H - 1){" },
    { file:'index', expect:'"min" accepts', find:"        if (sl.kind === 'm' && v !== M){", replace:"        if (sl.kind === 'm' && v !== M && v !== s){" },
    { file:'index', expect:'forgetting to carry has no reason', find:'          if (v === H - 1) roundMiss(d.gCarryNoCarry(e.am, e.bm, s));\n          else roundMiss(d.gCarryHourWrong(v));', replace:'          roundMiss(d.gCarryHourWrong(v));' },
    { file:'index', expect:'bar B does not start where bar A ends', find:"addZone(B, carryX(a), BR.yb - BR.h / 2, carryX(total) - carryX(a), BR.h, 'gbar gb'", replace:"addZone(B, carryX(0), BR.yb - BR.h / 2, carryX(e.bm) - carryX(0), BR.h, 'gbar gb'" },
    { file:'index', expect:'zh gCarryNoCarry', find:"return am + ' ＋ ' + bm + ' ＝ ' + s + ' 分，已經滿 60 分", replace:"return am + ' ＋ ' + bm + ' ＝ ' + (s + 5) + ' 分，已經滿 60 分" },
    { file:'index', expect:'gCarryDone en', find:"' min = 1 h ' + (s - 60) + ' min, plus the '", replace:"' min = 1 h ' + (s - 50) + ' min, plus the '" },

    /* 先到整點 */
    { file:'index', expect:'is not a multiple of 10', find:'var GAME_HOP = [ { h:9, m:40, add:50 },', replace:'var GAME_HOP = [ { h:9, m:45, add:50 },' },
    { file:'index', expect:'lands exactly on the hour', find:'{ h:4, m:20, add:30 } ];', replace:'{ h:4, m:20, add:40 } ];' },
    { file:'index', expect:'no entry stays inside the hour', find:'{ h:3, m:10, add:40 }, { h:7, m:40, add:30 }, { h:4, m:20, add:30 } ];', replace:'{ h:3, m:30, add:40 }, { h:7, m:40, add:30 }, { h:4, m:40, add:30 } ];' },
    { file:'index', expect:'is too close to the end of the line', find:'var HOP_H = 160, HOP_LINE = { x0:20, x1:280, y:112, span:80, step:10, back:10 }', replace:'var HOP_H = 160, HOP_LINE = { x0:20, x1:280, y:112, span:70, step:10, back:10 }' },
    { file:'index', expect:'hopTick(', find:'    var k = Math.min(L.span / L.step, Math.max(0, Math.round((pt.x - L.x0) / gap)));', replace:'    var k = Math.min(L.span / L.step, Math.max(0, Math.floor((pt.x - L.x0) / gap)));' },
    { file:'index', expect:'hopTick(', find:'    if (pt.y < L.y - HOP_BUS.dy - 40 || pt.y > L.y + 30 ||', replace:'    if (pt.y > L.y + 30 ||' },
    { file:'index', expect:'hopX(', find:'function hopX(t, S){ return HOP_LINE.x0 + (t - S) / HOP_LINE.span * (HOP_LINE.x1 - HOP_LINE.x0); }', replace:'function hopX(t, S){ return HOP_LINE.x0 + (t - S) / HOP_LINE.span * (HOP_LINE.x1 - HOP_LINE.x0 - 6); }' },
    { file:'index', expect:'driving backwards', find:'        if (tk < pos){ roundMiss(d.gHopBack); return false; }\n', replace:'' },
    { file:'index', expect:'the hour stop', find:'        if (crossed && pos === s && tk === hour){', replace:'        if (crossed && tk === hour){' },
    { file:'index', expect:'riding the whole time again', find:'        if (pos === hour && tk === hour + e.add) roundMiss(d.gHopFromHour(s, hour, used, e.add));\n        else roundMiss(d.gHopOff(s, tk, e.add));', replace:'        roundMiss(d.gHopOff(s, tk, e.add));' },
    { file:'index', expect:'a wrong stop is accepted', find:'        if (tk === end){\n          P.lock(hopX(tk, S), y);', replace:'        if (tk >= end){\n          P.lock(hopX(tk, S), y);' },
    { file:'index', expect:'says the wrong direction', find:"(k < add ? '還不到 ' : '超過了 ')", replace:"(k > add ? '還不到 ' : '超過了 ')" },
    { file:'index', expect:'gHopDone en', find:"' = ' + (add - used) + ' more minutes — ' + clockText(end) + '.')", replace:"' = ' + (add - used) + ' more minutes — ' + clockText(end + 10) + '.')" },
    { file:'index', expect:'gHop2b zh', find:"return add + ' − ' + used + ' ＝ ' + (add - used) + '：從 '", replace:"return add + ' − ' + used + ' ＝ ' + (add + used) + '：從 '" },

    /* 分段數 */
    { file:'index', expect:'an hour or more', find:'var GAME_SPAN = [ { h1:9, m1:40, h2:10, m2:30 },', replace:'var GAME_SPAN = [ { h1:9, m1:40, h2:10, m2:50 },' },
    { file:'index', expect:'no entry stays inside one hour', find:'{ h1:2, m1:15, h2:2, m2:50 }, { h1:8, m1:45, h2:9, m2:20 }, { h1:3, m1:45, h2:4, m2:35 }, { h1:6, m1:10, h2:6, m2:55 },', replace:'{ h1:2, m1:15, h2:3, m2:5 }, { h1:8, m1:45, h2:9, m2:20 }, { h1:3, m1:45, h2:4, m2:35 }, { h1:6, m1:10, h2:7, m2:5 },' },
    { file:'index', expect:'two wrong ways give the same number', find:'{ h1:8, m1:45, h2:9, m2:20 },', replace:'{ h1:8, m1:45, h2:9, m2:15 },' },
    { file:'index', expect:'labels overlap', find:'{ h1:3, m1:45, h2:4, m2:35 },', replace:'{ h1:3, m1:55, h2:4, m2:35 },' },
    { file:'index', expect:'spanX(', find:'function spanX(t, s, e){ return SPAN_LINE.cx + (t - (s + e) / 2) * SPAN_LINE.ppm; }', replace:'function spanX(t, s, e){ return SPAN_LINE.cx + (t - s) * SPAN_LINE.ppm; }' },
    { file:'index', expect:'clocks overlap', find:'SPAN_CLOCK = { size:140, y:76, x:[76, 224] }', replace:'SPAN_CLOCK = { size:140, y:76, x:[96, 204] }' },
    { file:'index', expect:'submit() on', find:"        if (!/^(0|[1-9]\\d*)$/.test(tv)){ gMsg.textContent = d.gSpanEmpty; return; }", replace:"        if (!/^\\d+$/.test(tv)){ gMsg.textContent = d.gSpanEmpty; return; }" },
    { file:'index', expect:'submit() on', find:"        var tv = inp.value.trim();", replace:"        var tv = inp.value.replace(/\\s/g, '');" },
    { file:'index', expect:'submit() on', find:"        else if (crossed && v === raw4) roundMiss(d.gSpanRaw(s, t2));\n", replace:'' },
    { file:'index', expect:'submit() on', find:"        if (v === total){", replace:"        if (v === total || v === raw4){" },
    { file:'index', expect:'submit() on', find:"        else if (crossed && v === hour - s) roundMiss(d.gSpanSeg1(s, hour, hour - s));", replace:"        else if (crossed && v === hour - s) roundMiss(d.gSpanSeg2(hour, t2, hour - s));" },
    { file:'index', expect:'gSpanRaw en', find:"' and subtracted: 1 hour is 60 minutes, not 100.'; }", replace:"' and subtracted: 1 hour is 100 minutes, not 60.'; }" },
    { file:'index', expect:'gSpanDone zh', find:"' 分，' + a + ' ＋ ' + b + ' ＝ ' + (a + b) + ' 分。')", replace:"' 分，' + a + ' ＋ ' + b + ' ＝ ' + (a + b + 5) + ' 分。')" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'should be 35', find:"why: '20 ＋ 15 ＝ 35，一共花了 35 分。' },", replace:"why: '20 ＋ 15 ＝ 25，一共花了 35 分。' }," },
    { file:'index', expect:'the clock reads', find:"{ stem: '看時鐘，現在是幾點幾分？' + clockSVG(3, 25),", replace:"{ stem: '看時鐘，現在是幾點幾分？' + clockSVG(3, 30)," },
    { file:'index', expect:'the two clocks are', find:"{ stem: '迷思檢查：' + clockSVG(9, 40) + clockSVG(10, 30)", replace:"{ stem: '迷思檢查：' + clockSVG(9, 40) + clockSVG(10, 40)" },

    /* ---- review.html ---- */
    { file:'review', expect:'missing space between Chinese and a digit', find:"          opts: d.opts.map(function(v){ return lang === 'zh' ? v + ' 分' : v + ' min'; }), ans: d.ans,", replace:"          opts: d.opts.map(function(v){ return lang === 'zh' ? v + '分' : v + ' min'; }), ans: d.ans," },
    { file:'review', expect:'the short hand is BETWEEN', find:"短針在 ' + d.h + ' 和 ' + (d.h % 12 + 1) + ' 中間、還沒到 ' + (d.h % 12 + 1) + '，所以是 '", replace:"短針指的是 ' + d.h + '，所以是 '" },
    { file:'review', expect:'the stem\'s own start time', find:"        uniqPush(wrongs, seen, clk(h, r.m));             // 分過了 60", replace:"        uniqPush(wrongs, seen, clk(h, m));             // 分過了 60" },
    { file:'review', expect:'an hour or more', find:"        var m2 = 5 * (1 + rand(m1 / 5 - 1)); //", replace:"        var m2 = 5 * rand(12); //" },
    { file:'review', expect:'is copied straight out of the stem', find:"        var seen = { '0':true }; seen[String(a)] = true; seen[String(b)] = true; seen[String(sum)] = true; var wrongs = [];\n        uniqPush(wrongs, seen, sum + 10);\n        uniqPush(wrongs, seen, sum - 100);\n        uniqPush(wrongs, seen, Math.abs(a - b));", replace:"        var seen = {}; seen[String(sum)] = true; var wrongs = [];\n        uniqPush(wrongs, seen, sum + 10);\n        uniqPush(wrongs, seen, sum - 100);\n        uniqPush(wrongs, seen, b);" },
    { file:'review', expect:'diffTime: zh distractor', find:"seen[m1 + ' 分'] = true; seen[m2 + ' 分'] = true;", replace:'' },
    { file:'review', expect:'has 60 or more in the smaller unit', find:"        uniqPush(wrongs, seen, '0 時 ' + m + ' 分');", replace:"        uniqPush(wrongs, seen, '0 時 ' + sum + ' 分');" },
    { file:'review', expect:'durAddNoCarry', find:"        [sum + 5, sum - 5, sum + 10, sum - 10, sum + 15].forEach(function(v){ if (v > 0) uniqPush(wrongs, seen, v); });", replace:"        [Math.abs(a - b), sum + 5, sum + 10].forEach(function(v){ uniqPush(wrongs, seen, v); });" },
    { file:'review', expect:'opts[ans] != correct', find:"        var r = addMinutes(h, m, add);\n        var correct = clk(r.h, r.m);", replace:"        var r = addMinutes(h, m, add);\n        var correct = clk(r.h, r.m + 5);" },
    { file:'review', expect:'why', find:"? d.total + ' 秒裡面有 ' + d.k + ' 個 60 秒，剩下 ' + d.r + ' 秒", replace:"? d.total + ' 秒裡面有 ' + d.k + ' 個 60 秒，剩下 ' + (d.r + 1) + ' 秒" }
  ],

  sim: {
    INVARIANTS: {
      readClock: d => {
        if (!(isInt(d.h) && d.h >= 1 && d.h <= 12)) return 'hour ' + d.h + ' outside 1~12';
        if (!(isInt(d.idx) && d.idx >= 1 && d.idx <= 11)) return 'long-hand number ' + d.idx + ' outside 1~11 (12 would be o\'clock)';
        if (d.m !== d.idx * 5) return 'minutes ' + d.m + ' != number × 5';
      },
      minuteRead: d => {
        if (!(isInt(d.idx) && d.idx >= 1 && d.idx <= 11)) return 'long-hand number ' + d.idx + ' outside 1~11';
        if (d.m !== d.idx * 5) return 'minutes != number × 5';
        if (!(d.showH >= 1 && d.showH <= 12)) return 'clock hour outside 1~12';
      },
      secToMin: d => {
        if (d.total !== d.k * 60 + d.r) return 'total != k × 60 + r';
        if (!(d.r >= 1 && d.r <= 59 && d.k >= 1 && d.k <= 3)) return 'k or r out of range';
      },
      minToHour: d => {
        if (d.total !== d.k * 60 + d.r) return 'total != k × 60 + r';
        if (!(d.r >= 1 && d.r <= 59 && d.k >= 1 && d.k <= 3)) return 'k or r out of range';
      },
      durAddNoCarry: d => {
        if (d.sum !== d.a + d.b) return 'sum != a + b';
        if (!(d.sum < 60)) return 'sum ' + d.sum + ' reaches 60 — this generator is the no-carry one';
        if (d.a % 5 || d.b % 5 || d.b < 5) return 'a, b must be multiples of 5';
      },
      durAddCarry: d => {
        if (d.sum !== d.a + d.b) return 'sum != a + b';
        if (!(d.sum >= 65 && d.sum < 120)) return 'sum ' + d.sum + ' — the why says "= 60 + m = 1 h m min"';
        if (d.h !== 1 || d.m !== d.sum - 60) return 'h:m is not 1 h (sum − 60) min';
      },
      fwdTime: d => {
        if (!(d.m >= 25 && d.m <= 55 && d.m % 5 === 0)) return 'start minutes ' + d.m;
        const toHour = 60 - d.m;
        if (!(d.add > toHour)) return 'add ' + d.add + ' does not pass the hour — the why says "first reach the hour"';
        if (!(d.add - toHour < 60)) return 'passes two hours';
        const t = d.h * 60 + d.m + d.add;
        if (d.r.h !== Math.floor(t / 60) || d.r.m !== t % 60) return 'result is not start + add';
        if (d.r.h > 12) return 'result hour ' + d.r.h + ' past 12';
      },
      diffTime: d => {
        if (d.h2 !== d.h1 + 1) return 'the end is not in the next hour';
        if (d.total !== (d.h2 * 60 + d.m2) - (d.h1 * 60 + d.m1)) return 'total is wrong';
        if (!(d.total > 0 && d.total < 60)) return 'total ' + d.total + ' — an hour or more (the lesson\'s example 5 stays under 1 h)';
        if (!(d.m2 >= 5)) return 'the end is exactly on the hour — "then " + m2 + " minutes" would be 0';
      },
      addsub: d => { if (d.sum !== d.a + d.b) return 'sum != a + b'; },
      multiply: d => { if (d.product !== d.a * d.b) return 'product != a × b'; },
      numbers: d => {
        const ds = String(d.n).split('').map(Number);
        if (ds.length !== 4 || new Set(ds).size !== 4) return 'n is not four different digits';
        if (d.correct !== ds[0]) return 'correct is not the thousands digit';
      }
    },
    /* 正解的第二套實作：只用原始參數重算、自己格式化 */
    expectedCorrect: function(d, genId, lang){
      const Z = lang === 'zh';
      switch (genId){
        case 'readClock': return hm(d.h * 60 + d.idx * 5);
        case 'minuteRead': return Z ? (d.idx * 5) + ' 分' : (d.idx * 5) + ' min';
        case 'secToMin': { const k = Math.floor(d.total / 60), r = d.total % 60; return Z ? k + ' 分 ' + r + ' 秒' : k + ' min ' + r + ' sec'; }
        case 'minToHour': { const k = Math.floor(d.total / 60), r = d.total % 60; return Z ? k + ' 時 ' + r + ' 分' : k + ' h ' + r + ' min'; }
        case 'durAddNoCarry': return Z ? (d.a + d.b) + ' 分' : (d.a + d.b) + ' min';
        case 'durAddCarry': { const t = d.a + d.b; return Z ? Math.floor(t / 60) + ' 時 ' + (t % 60) + ' 分' : Math.floor(t / 60) + ' h ' + (t % 60) + ' min'; }
        case 'fwdTime': return hm(d.h * 60 + d.m + d.add);
        case 'diffTime': { const t = (d.h2 * 60 + d.m2) - (d.h1 * 60 + d.m1); return Z ? t + ' 分' : t + ' min'; }
        case 'addsub': return String(d.a + d.b);
        case 'multiply': return String(d.a * d.b);
        case 'numbers': return String(Math.floor(d.n / 1000));
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      const sh = SHAPE[genId];
      let m;
      if (sh === 'clock'){
        if (!(m = s.match(/^(\d{1,2}):(\d{2})$/))) return 'option "' + s + '" is not a clock time';
        if (!(+m[1] >= 1 && +m[1] <= 12)) return 'hour outside 1~12: ' + s;
        if (!(+m[2] >= 0 && +m[2] <= 59)) return 'minute outside 0~59: ' + s;
        if (isCorrect && (+m[2] % 5 || +m[2] === 0) && genId === 'readClock') return 'the correct reading must be a 5-minute time that is not o\'clock: ' + s;
        return;
      }
      if (sh === 'int' || sh === 'digit'){
        if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a whole number';
        if (sh === 'digit' && +s > 9) return 'option ' + s + ' is not a digit';
        if (+s > 9999) return 'option ' + s + ' outside 1~9999';
        return;
      }
      const v = minutesOf(s, lang);
      if (v === null) return 'option "' + s + '" is not a ' + sh + ' in ' + lang;
      const parts = nums(s);
      if (sh === 'min' && !/^\d+ (分|min)$/.test(s)) return 'option "' + s + '" should be minutes only';
      if (sh === 'ms' && !/(秒|sec)$/.test(s)) return 'option "' + s + '" should be minutes and seconds';
      if (sh === 'hm' && !/^\d+ (時|h) \d+ (分|min)$/.test(s)) return 'option "' + s + '" should be hours and minutes';
      if (!(v >= 1)) return 'option "' + s + '" is zero';
      if (sh !== 'min'){
        /* 「幾時幾分」「幾分幾秒」的第二個數一律 0~59：「0 時 75 分」和「1 時 15 分」是同一個長度，正確推理也走得到（codex 第一輪抓到），沒有例外 */
        if (parts[1] > 59) return 'option "' + s + '" has 60 or more in the smaller unit — the same length as a normalized answer';
      }
      /* 上限從每個產生器自己的參數推出來（不是隨手給一個大數）：
         secToMin／minToHour 的 k 是 1~3 → 正解最多 3:59＝239，誘答最多 k ＋ 2 ＝ 5 → 359；
         durAddNoCarry 的和 < 60、誘答最多 ＋15 → 70；durAddCarry 的和最多 45 ＋ 60 ＝ 105，誘答「多 1 時」→ 165；
         diffTime 不到 1 時 → 55，誘答「當四位數相減」＝ 正解 ＋ 40 → 95；minuteRead 的長針最多指到 60 分。 */
      const MAX = { minuteRead:[55, 60], secToMin:[239, 359], minToHour:[239, 359], durAddNoCarry:[55, 70], durAddCarry:[105, 165], diffTime:[55, 95] }[genId];
      if (MAX && v > MAX[isCorrect ? 0 : 1]) return 'option "' + s + '" is above ' + MAX[isCorrect ? 0 : 1] + ' min, the most this generator can make' + (isCorrect ? ' as an answer' : '');
    },
    /* 渲染出來的那一題：鐘面讀回時間、選項兩兩比「值」、解釋的算式重算、解釋裡的數字照順序 */
    renderCheck: function(d, q, lang, genId){
      const Z = lang === 'zh', ans = q.opts[q.ans];
      for (const e of scanEquations(q.why)) if (e.bad) return 'why: "' + e.text + '" ' + e.bad;
      const vals = q.opts.map(o => minutesOf(o, lang));
      for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++){
        if (vals[i] === null || vals[i] !== vals[j]) continue;
        return 'options "' + q.opts[i] + '" and "' + q.opts[j] + '" are the same length of time';
      }
      /* 帶單位的選項（「10 分」）不會被 simgen 的抄題檢查看到（它比整串字）：在這裡比題幹的分 */
      const echo = { diffTime:[d.m1, d.m2], durAddNoCarry:[d.a, d.b] }[genId];
      if (echo) for (let i = 0; i < q.opts.length; i++) if (i !== q.ans && echo.indexOf(minutesOf(q.opts[i], lang)) >= 0) return 'distractor "' + q.opts[i] + '" is copied straight out of the stem';
      for (const e of scanClockEq(q.why)) if (e.bad) return 'why: "' + e.text + '" ' + e.bad;
      const W = nums(q.why);
      const seq = want => { if (W.join() !== want.join()) return 'why numbers should read ' + want.join() + ', got ' + W.join() + ' — ' + q.why; };
      if (genId === 'readClock' || genId === 'minuteRead'){
        const c = readClocks(q.stem);
        if (c.length !== 1 || !c[0]) return 'cannot read the clock in the stem (or its short hand is off)';
        if (genId === 'readClock' && hm(c[0].h * 60 + c[0].m) !== ans) return 'the clock shows ' + hm(c[0].h * 60 + c[0].m) + ', the answer is ' + ans;
        if (genId === 'minuteRead'){
          if (c[0].m !== d.idx * 5 || nums(q.stem.replace(/<svg[\s\S]*?<\/svg>/g, ''))[0] !== c[0].m / 5) return 'the stem\'s number and the drawn long hand disagree';
          if (minutesOf(ans, lang) !== c[0].m) return 'the long hand shows ' + c[0].m + ' minutes, the answer is ' + ans;
        }
        if (genId === 'readClock'){
          const nx = d.h % 12 + 1;
          if (!(Z ? /短針在 \d+ 和 \d+ 中間/ : /short hand is between \d+ and \d+/).test(q.why)) return 'why must say the short hand is BETWEEN two numbers (it only points at h on the hour)';
          const r = seq([d.idx, d.idx, 5, d.m, d.h, nx, nx, d.h, d.m]); if (r) return r;
        } else { const r = seq([5, d.idx, 5, d.m]); if (r) return r; }
      }
      if (genId === 'secToMin' || genId === 'minToHour'){ const r = seq([d.total, d.k, 60, d.r, d.k, d.r]); if (r) return r; }
      if (genId === 'durAddNoCarry'){ const r = seq([d.a, d.b, d.sum, d.sum]); if (r) return r; }
      if (genId === 'durAddCarry'){ const r = seq([d.a, d.b, d.sum, 60, d.m, d.h, d.m, 60, 1]); if (r) return r; }
      if (genId === 'fwdTime'){
        const toHour = 60 - d.m, rest = d.add - toHour;
        const r = seq([d.h + 1, 0, 60, d.m, toHour, d.add, toHour, rest, d.r.h, d.r.m, 60]); if (r) return r;
        /* 誘答不可以是題幹的時刻（那不是誘答，是抄題） */
        if (q.opts.some((o, i) => i !== q.ans && o === hm(d.h * 60 + d.m))) return 'a distractor is the stem\'s own start time';
      }
      if (genId === 'diffTime'){
        const a = 60 - d.m1;
        const r = seq([d.h1, d.m1, d.h1 + 1, 0, a, d.h2, d.m2, d.m2, a, d.m2, d.total]); if (r) return r;
      }
      if (genId === 'addsub'){ const r = seq([d.a, d.b, d.sum]); if (r) return r; }
      if (genId === 'multiply'){ const r = seq([d.a, d.b, d.product]); if (r) return r; }
      if (genId === 'numbers'){ const r = seq([d.n, d.correct]); if (r) return r; }
    }
  },

  data: {
    dataStart: '  /* ---------- 語言無關的小工具：時鐘 SVG ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{clockSVG, addMinutes, diffMinutes, GPICK, shuffle, clockText, BUND_H, BUND_FULL, BUND_BIG, GDOT, BUND_BOX, BUND_TRAY, GAME_BUNDLE, bundBoxX, bundSlotXY, bundTrayXY, HAND_H, HAND_C, HAND_KNOB, GAME_HAND, handAngle, handIdx, CARRY_H, CARRY_RULER, CARRY_BAR, CARRY_EQ, CARRY_CARD, CARRY_TRAY, GAME_CARRY, carryX, HOP_H, HOP_LINE, HOP_BUS, GAME_HOP, hopX, hopTick, SPAN_H, SPAN_CLOCK, SPAN_LINE, GAME_SPAN, spanX}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 算式掃描器與鐘面讀取器自己先證明會響（positive / negative control） --- */
      [['20 ＋ 15 ＝ 35', true], ['20 ＋ 15 ＝ 25', false], ['60－40＝20', true], ['60 − 40 ＝ 30', false], ['7×5＝35', true], ['7 × 5 = 30', false],
       ['45 ＋ 20 ＝ 65 分', true], ['50 − 20 = 30', true], ['50 − 20 = 20', false]].forEach(([t, good]) => {
        const r = scanEquations(t);
        if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
      });
      ['9:40 ＋ 50 分', '從 9:40 到 10:30', '是 10:30。', '先走到整點 10:00，用了 20 分'].forEach(t => {
        if (scanEquations(t).length) fail('scanEquations() self-test: "' + t + '" has no equation, but the scanner found ' + JSON.stringify(scanEquations(t)));
      });
      [['9:40 ＋ 50 分 ＝ 10:30', true], ['9:40 ＋ 20 ＝ 10:10', false], ['10:30 − 9:40 ＝ 50 分', true], ['10:30 − 9:40 ＝ 90 分', false]].forEach(([t, good]) => {
        const r = scanClockEq(t);
        if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanClockEq() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
      });
      [[3, 25], [12, 55], [6, 5], [9, 40]].forEach(([h, m]) => {
        const c = readClocks(D.clockSVG(h, m));
        if (c.length !== 1 || !c[0] || c[0].h !== h || c[0].m !== m) fail('readClocks() self-test: clockSVG(' + h + ', ' + m + ') reads ' + JSON.stringify(c));
      });
      { const bad = D.clockSVG(3, 25).replace(/(stroke="#E8871E")/, '$1').replace(/x2="([\d.]+)" y2="([\d.]+)" stroke="#E8871E"/, 'x2="75" y2="20" stroke="#E8871E"');
        if (readClocks(bad)[0]) fail('readClocks() self-test: a short hand pointing straight at 12 at 3:25 is accepted'); }

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
        scanClockEq(s).forEach(e => { if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 20) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 題幹有鐘面的題目：從 SVG 讀回時間，和標的正解比 */
      LANGS.forEach(L => {
        const qs = I18N[L].qs, qb = I18N[L].qsBoost;
        const c0 = readClocks(qs[0].stem)[0], c1 = readClocks(qs[1].stem)[0], cb = readClocks(qb[1].stem);
        if (!c0 || hm(c0.h * 60 + c0.m) !== qs[0].opts[qs[0].ans]) fail('qs[0] ' + L + ': the clock reads ' + JSON.stringify(c0) + ', marked answer is ' + qs[0].opts[qs[0].ans]);
        if (!c1 || nums(qs[1].opts[qs[1].ans])[0] !== c1.m || nums(qs[1].stem.replace(/<svg[\s\S]*?<\/svg>/g, ''))[0] !== c1.m / 5) fail('qs[1] ' + L + ': the long hand shows ' + JSON.stringify(c1) + ', the stem / answer disagree');
        if (cb.length !== 2 || !cb[0] || !cb[1]) fail('qsBoost[1] ' + L + ': cannot read the two clocks');
        else {
          const t0 = cb[0].h * 60 + cb[0].m, t1 = cb[1].h * 60 + cb[1].m, st = qb[1].stem.replace(/<svg[\s\S]*?<\/svg>/g, '');
          if (st.indexOf(hm(t0)) < 0 || st.indexOf(hm(t1)) < 0) fail('qsBoost[1] ' + L + ': the two clocks are ' + hm(t0) + ' and ' + hm(t1) + ', the stem says otherwise');
          if (nums(qb[1].opts[qb[1].ans])[0] !== t1 - t0) fail('qsBoost[1] ' + L + ': ' + hm(t0) + ' → ' + hm(t1) + ' is ' + (t1 - t0) + ' min, marked answer is ' + qb[1].opts[qb[1].ans]);
        }
      });

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['bundle', 'hand', 'carry', 'hop', 'span'];
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
      /* 每一句說明：數字照順序逐個比，而且句子裡的每一條算式都要算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
        scanClockEq(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_BUNDLE', 'GAME_HAND', 'GAME_CARRY', 'GAME_HOP', 'GAME_SPAN'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      LANGS.forEach(L => { if (D.clockText(9 * 60 + 5) !== '9:05' || D.clockText(600) !== '10:00') fail('clockText() does not write h:mm'); });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the long-hand knob (' + D.HAND_KNOB + ')', D.HAND_KNOB);
      tooSmall('a carry card (' + D.CARRY_CARD + ')', D.CARRY_CARD);
      tooSmall('the bus (' + D.HOP_BUS.size + ')', D.HOP_BUS.size);
      tooSmall('a carry slot with its pad', D.CARRY_EQ.slot + 2 * 4);
      [D.HAND_KNOB, D.CARRY_CARD, D.HOP_BUS.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('bundle', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:t\.x, cy:t\.y,/, 'the sticks are not GPICK × GPICK at bundTrayXY()');
      need('carry', /addPiece\(B, \{ w:CARRY_CARD, h:CARRY_CARD, cx:cx, cy:cy,/, 'the cards are not CARRY_CARD × CARRY_CARD');
      need('hand', /addPiece\(B, \{ w:HAND_KNOB, h:HAND_KNOB, cx:C\.x, cy:C\.y - C\.knob,/, 'the knob is not HAND_KNOB, or does not start on 12');
      need('hop', /addPiece\(B, \{ w:HOP_BUS\.size, h:HOP_BUS\.size, cx:hopX\(s, S\), cy:LN\.y - HOP_BUS\.dy,/, 'the bus is not HOP_BUS.size, or does not start at the start time');

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

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const EQ = D.CARRY_EQ, h = EQ.slot / 2;
          const list = [EQ.hx, EQ.mx].map((x, i) => ({ id:i, cx:x, cy:EQ.y, hw:h, hh:h, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, 4); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a carry slot are given to the other slot (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：換一換（範例 1：滿 60 就進位） --- */
      {
        const BX = D.BUND_BOX, TR = D.BUND_TRAY, FULL = D.BUND_FULL;
        if (FULL * 10 !== 60) fail('bundle: a box of ' + FULL + ' sticks of 10 is ' + FULL * 10 + ', not a box of 60');
        if (D.BUND_BIG.sec !== 'min' || D.BUND_BIG.min !== 'hour') fail('bundle: BUND_BIG should trade seconds for minutes and minutes for hours');
        let anyZero = false, anyMax = false, units = new Set();
        D.GAME_BUNDLE.forEach((e, i) => {
          const w = 'GAME_BUNDLE[' + i + ']';
          if (!isInt(e.n) || ['sec', 'min'].indexOf(e.u) < 0) return fail(w + ' is not { u:sec|min, n }');
          units.add(e.u);
          const q = Math.floor(e.n / FULL), r = e.n % FULL, nb = q + 1;
          if (e.n < 7 || e.n > 15) fail(w + ': ' + e.n + ' sticks — should be 7~15 (three rows of 5, at least one full box)');
          if (r === 0) anyZero = true;
          if (r === FULL - 1) anyMax = true;
          /* 照遊戲的規則把每一種裝法都走一遍：一次一盒、裝滿才換、剩不到 60 不能開新盒、半滿時不能按「換好了」 */
          const seen = new Set(), stack = [[e.n, 0, 0, 0]];   /* left, 正在裝的那一盒有幾根, 換好幾個, 用掉幾個盒子 */
          let ends = 0;
          while (stack.length){
            const [left, cur, done, used] = stack.pop(), key = [left, cur, done, used].join(); if (seen.has(key)) continue; seen.add(key);
            const moves = [];
            if (cur > 0) moves.push([left - 1, cur + 1 === FULL ? 0 : cur + 1, cur + 1 === FULL ? done + 1 : done, used]);
            if (cur === 0 && left >= FULL && used < nb) moves.push([left - 1, 1, done, used + 1]);
            if (cur === 0 && left < FULL){ ends++; if (done !== q || left !== r) fail(w + ': can finish at ' + done + ' traded, ' + left + ' left'); continue; }
            if (!moves.length){ fail(w + ': stuck at ' + key); continue; }
            moves.forEach(m => stack.push(m));
          }
          if (!ends) fail(w + ': can never be finished');
          /* 版面 */
          const boxes = []; for (let b = 0; b < nb; b++){ const cx = 150 + (b - (nb - 1) / 2) * (BX.w + BX.gap); if (!near(D.bundBoxX(nb, b), cx)) fail(w + ': bundBoxX(' + nb + ', ' + b + ') should be ' + cx); boxes.push(sq(cx, BX.y, BX.w, BX.h)); }
          boxes.forEach((o, b) => inside(o, w + ' box ' + b, W, D.BUND_H)); noHits(boxes, w + ': boxes');
          const tray = [];
          for (let c = 0; c < e.n; c++){
            const row = Math.floor(c / TR.perRow), inRow = Math.min(TR.perRow, e.n - row * TR.perRow);
            const m = { x:150 + ((c % TR.perRow) - (inRow - 1) / 2) * TR.step, y:TR.y + row * TR.step }, p = D.bundTrayXY(c, e.n);
            if (!near(p.x, m.x) || !near(p.y, m.y)) fail(w + ': bundTrayXY(' + c + ', ' + e.n + ') should be ' + JSON.stringify(m));
            tray.push(sq(m.x, m.y, D.GPICK));
          }
          tray.forEach((o, c) => inside(o, w + ' stick ' + c, W, D.BUND_H)); noHits(tray, w + ': sticks');
          LANGS.forEach(L => {
            const d = I18N[L], U = d.unitLabel, big = U[D.BUND_BIG[e.u]], small = U[e.u];
            for (let c = 0; c <= q; c++) for (let lf = 0; lf <= e.n; lf++) if (lf + c * FULL <= e.n) seq(w + ' gBundNow ' + L, d.gBundNow(e.n * 10, c, lf * 10, e.u), [e.n * 10, c, lf * 10]);
            for (let k = 1; k < FULL; k++){
              seq(w + ' gBundFinish ' + L, d.gBundFinish(k * 10, e.u), [k * 10, 60]);
              seq(w + ' gBundPartial ' + L, d.gBundPartial(k * 10, e.u), [k * 10, 1, 60]);
              seq(w + ' gBundBox ' + L, d.gBundBox(k * 10, e.u), [k * 10]);
              seq(w + ' gBund2(need) ' + L, d.gBund2(e.n * 10, (FULL - k) * 10, e.u), [(FULL - k) * 10]);
            }
            for (let lf = FULL; lf <= e.n; lf++){ seq(w + ' gBundMore ' + L, d.gBundMore(lf * 10, e.u), [lf * 10, 60, 1]); seq(w + ' gBund2(more) ' + L, d.gBund2(lf * 10, 0, e.u), [lf * 10, 1]); }
            if (r){ seq(w + ' gBundShort ' + L, d.gBundShort(r * 10, e.u), [r * 10, 60, 1]); seq(w + ' gBund2(stop) ' + L, d.gBund2(r * 10, 0, e.u), [r * 10, 60]); }
            const done = d.gBundDone(e.n * 10, q, r * 10, e.u);
            seq(w + ' gBundDone ' + L, done, r ? [e.n * 10, q, r * 10, q, 60, r * 10, 60] : [e.n * 10, q, q, 60]);
            /* 單位要對：秒換分、分換時 —— 「130 秒 ＝ 2 時 10 秒」數字全對也是錯的 */
            const unitRe = new RegExp((r ? '\\d+ ' + small + '\\W+' : '') + '\\d+ ' + big + (r ? ' \\d+ ' + small : ''));
            if (!new RegExp('^' + e.n * 10 + ' ' + small).test(done) || done.indexOf(q + ' ' + big) < 0) fail(w + ' gBundDone ' + L + ': units should be ' + small + ' → ' + big + ': ' + done);
            [d.gBundShort(10, e.u), d.gBundMore(70, e.u), d.gBundPartial(10, e.u)].forEach(t => { if (!new RegExp('1 (more )?' + big + '(?![A-Za-z])').test(t)) fail(w + ' ' + L + ': a reason trades for "1 ' + big + '" but says: ' + t); });
            if (d.gBundFull(e.u).indexOf('1 ' + big) < 0) fail(w + ' gBundFull ' + L + ' should say 1 ' + big);
            if (nums(d.gBundStick(e.u)).join() !== '10' || d.gBundStick(e.u).indexOf(small) < 0) fail(w + ' gBundStick ' + L + ' should say 10 ' + small);
            void unitRe;
          });
        });
        if (!anyZero) fail('GAME_BUNDLE: no entry leaves nothing over — "trades exactly" is never practised');
        if (!anyMax) fail('GAME_BUNDLE: no entry leaves 50 — the biggest leftover is never practised');
        if (units.size !== 2) fail('GAME_BUNDLE: only one unit (' + [...units] + ') — the lesson trades both 60 sec → 1 min and 60 min → 1 h');
        if (BX.gap < 12) fail('bundle: boxes closer than 12 — their drop pads (6 each) touch');
        const slots = [];
        for (let s = 0; s < FULL; s++){
          const m = { x:BX.w / 2 + ((s % 3) - 1) * BX.step, y:BX.top + Math.floor(s / 3) * BX.step }, p = D.bundSlotXY(s);
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('bundSlotXY(' + s + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          const o = sq(m.x, m.y, D.GDOT);
          if (o.x < 4 || o.x + o.w > BX.w - 4 || o.y + o.h > BX.h - 4 || o.y < 30) fail('bundle: dot ' + s + ' runs into the box edge or its total');
          slots.push(o);
        }
        noHits(slots, 'bundle: dots in a box');
        if (BX.y + BX.h / 2 + 6 > TR.y - D.GPICK / 2 - 4) fail('bundle: the boxes (with their drop pad) reach the sticks');
        if (TR.step < D.GPICK + 4) fail('bundle: sticks ' + TR.step + ' apart touch');
        need('bundle', /var nb = Math\.floor\(n \/ BUND_FULL\) \+ 1, boxes = \[\];/, 'the empty boxes are not one more than needed');
        need('bundle', /if \(bx !== cur\)\{\s*if \(cur\)\{ roundMiss\(d\.gBundFinish\(cur\.n \* 10, u\)\); return false; \}\s*if \(left < BUND_FULL\)\{ roundMiss\(d\.gBundShort\(left \* 10, u\)\); return false; \}\s*cur = bx;\s*\}/, 'a second box can be started before the first is full, or with less than 60 left');
        need('bundle', /if \(cur\)\{ roundMiss\(d\.gBundPartial\(cur\.n \* 10, u\)\); return; \}\s*if \(left >= BUND_FULL\)\{ roundMiss\(d\.gBundMore\(left \* 10, u\)\); return; \}\s*finish\(\);/, '"done" is accepted with a half-full box or 60 or more left');
        need('bundle', /if \(bx\.n === BUND_FULL\)\{ bx\.done = true; bx\.el\.classList\.add\('full'\); bx\.tt\.textContent = d\.gBundFull\(u\); units\+\+; cur = null; \}/, 'a box is not sealed exactly at 60');
        need('bundle', /sticks\.forEach\(function\(P\)\{ if \(!P\.locked\) P\.lock\(P\.homeX, P\.homeY\); \}\);/, 'a stick being dragged when the round ends is locked where it was, not sent home');
        need('bundle', /roundSolved\(d\.gBundDone\(n \* 10, units, left \* 10, u\)\);/, 'the result is not read from the boxes and the leftovers');
        need('bundle', /if \(left === 0 && !cur\) finish\(\);/, 'an exact trade does not finish on its own');
        need('bundle', /var bx = nearestOpen\(boxes, pt, 6\);/, 'a box is not picked as the nearest open box');
      }

      /* --- 第 2 關：撥時鐘（範例 2：長針每指一個數字是 5 分） --- */
      {
        const C = D.HAND_C;
        let trap = 0, late = 0;
        const myAngle = p => { const a = Math.atan2(p.x - C.x, C.y - p.y) * 180 / Math.PI; return a < 0 ? a + 360 : a; };
        const myIdx = p => { const r = Math.hypot(p.x - C.x, p.y - C.y); if (r < C.pad || r > C.r + 12) return -1; return Math.round(myAngle(p) / 30) % 12; };
        /* handIdx() 對整塊畫板每 1.5px 和自己的算法一樣；每一個數字的位置一定判給那個數字 */
        let bad = 0;
        for (let x = 0; x <= W; x += 1.5) for (let y = 0; y <= D.HAND_H; y += 1.5){ const p = { x, y }; if (D.handIdx(p) !== myIdx(p)) bad++; if (myIdx(p) >= 0 && Math.abs(D.handAngle(p) - myAngle(p)) > 1e-9) bad++; }
        if (bad) fail('handIdx()/handAngle(): ' + bad + ' points on the board disagree with my own reading of the dial');
        for (let k = 1; k <= 12; k++){ const p = { x:C.x + C.num * Math.sin(k * Math.PI / 6), y:C.y - C.num * Math.cos(k * Math.PI / 6) }; if (D.handIdx(p) !== k % 12) fail('handIdx(): the number ' + k + ' is read as ' + D.handIdx(p)); }
        if (D.handIdx({ x:C.x, y:C.y }) !== -1 || D.handIdx({ x:C.x + C.r + 20, y:C.y }) !== -1) fail('handIdx(): the centre or outside the face is not "empty space"');
        D.GAME_HAND.forEach((e, i) => {
          const w = 'GAME_HAND[' + i + ']';
          if (!isInt(e.h) || !isInt(e.m) || e.h < 1 || e.h > 12) return fail(w + ': hour ' + e.h + ' outside 1~12');
          if (e.m % 5) return fail(w + ': ' + e.m + ' minutes is not a multiple of 5 — the long hand would not point at a number');
          if (e.m === 0) return fail(w + ': ' + e.h + ':00 is o\'clock — there is nothing to turn');
          if (e.m < 0 || e.m > 55) return fail(w + ': minutes outside 5~55');
          const t = e.m / 5;
          if (e.m <= 11) trap++;
          if (e.m >= 30) late++;
          /* 照規則：每一個數字放下去，只有 m ÷ 5 收；其他每一個都有一句真的理由 */
          for (let k = 0; k < 12; k++){
            LANGS.forEach(L => {
              const d = I18N[L], tag = w + ' number ' + (k || 12) + ' ' + L;
              if (k === t) return;
              if (k === 0) return;   /* 放回 12：它本來就在那裡，靜靜彈回（need() 守住 k <= 0） */
              if (k === e.m){ seq(tag + ' gHandTrap', d.gHandTrap(k), [k, k, k, 5, k * 5]); if (k * 5 === e.m) fail(tag + ': the trap is not a trap'); }
              else { seq(tag + ' gHandWrong', d.gHandWrong(k, e.m), [k, k, 5, k * 5, e.m]); if (k * 5 === e.m) fail(tag + ': a right number is called wrong'); }
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gHandNow ' + L, d.gHandNow(e.h, e.m), [e.h, e.m]);
            seq(w + ' gHandDone ' + L, d.gHandDone(e.h, e.m, t), [t, t, 5, e.m, e.h, e.h % 12 + 1, e.h, e.m]);
            seq(w + ' gHand2 ' + L, d.gHand2(e.m, t), [t, 5, e.m, t]);
          });
        });
        if (trap < 2) fail('GAME_HAND: fewer than 2 entries with minutes ≤ 11 — the "pointing at m" misconception (long hand on 10 for 10 minutes) can never happen');
        if (late < 2) fail('GAME_HAND: fewer than 2 entries in the second half hour');
        inside({ x:C.x - C.r, y:C.y - C.r, w:2 * C.r, h:2 * C.r }, 'hand: the clock face', W, D.HAND_H);
        if (C.num - C.knob < D.HAND_KNOB / 2 + 12) fail('hand: the knob covers its number (knob at ' + C.knob + ', numbers at ' + C.num + ')');
        if (!(C.hand > C.knob && C.hand < C.num - 14)) fail('hand: the long hand (' + C.hand + ') should reach past the knob but not into the numbers');
        if (!(C.short < C.hand - 20)) fail('hand: the short hand is not clearly shorter than the long hand');
        if (C.knob - D.HAND_KNOB / 2 < C.pad) fail('hand: the knob at home already sits in the "empty" centre');
        if (2 * C.num * Math.sin(Math.PI / 12) * scale < 44) fail('hand: numbers are ' + (2 * C.num * Math.sin(Math.PI / 12) * scale).toFixed(1) + 'px apart on a phone — under 44');
        need('hand', /var e = pick\(GAME_HAND\), C = HAND_C, t = e\.m \/ 5;/, 'the target number is not m ÷ 5');
        need('hand', /var k = handIdx\(pt\);\s*if \(k <= 0\) return false;[^\n]*\n\s*if \(k === t\)\{/, 'a drop is not read with handIdx(), a drop back on 12 is not silent, or a wrong number is accepted');
        need('hand', /if \(k === e\.m\) roundMiss\(d\.gHandTrap\(k\)\);\s*else roundMiss\(d\.gHandWrong\(k, e\.m\)\);\s*return false;/, 'a wrong number has no reason of its own (the trap / another number)');
        need('hand', /hp = polar\(C\.r, C\.r, \(\(e\.h % 12\) \+ deg \/ 360\) \* 30, C\.short\);/, 'the short hand does not follow the long hand ((h + minutes/60) × 30°)');
        need('hand', /mp = polar\(C\.r, C\.r, deg, C\.hand\)/, 'the long hand is not drawn at the knob\'s angle');
        need('hand', /var tip = polar\(C\.x, C\.y, t \* 30, C\.knob\);\s*P\.lock\(tip\.x, tip\.y\);/, 'the knob is not locked on the hand at m ÷ 5');
      }

      /* --- 第 3 關：進位卡（範例 3：時間量相加，分滿 60 要換成 1 時） --- */
      {
        const RU = D.CARRY_RULER, BR = D.CARRY_BAR, EQ = D.CARRY_EQ, TR = D.CARRY_TRAY, CD = D.CARRY_CARD;
        const ppm = (RU.x1 - RU.x0) / RU.max;
        if (!near(D.carryX(0), RU.x0) || !near(D.carryX(60), RU.x0 + 60 * ppm) || !near(D.carryX(RU.max), RU.x1)) fail('carryX(): the ruler is not linear from x0 to x1');
        let anyHour = false, anyZero = false;
        D.GAME_CARRY.forEach((e, i) => {
          const w = 'GAME_CARRY[' + i + ']';
          if (![e.ah, e.am, e.bm].every(isInt)) return fail(w + ' is not whole numbers');
          if (e.ah === 1) anyHour = true; else if (e.ah === 0) anyZero = true; else fail(w + ': ' + e.ah + ' hours — should be 0 or 1');
          const a = e.ah * 60 + e.am, s = e.am + e.bm, total = a + e.bm, H = Math.floor(total / 60), M = total % 60;
          if (e.am % 5 || e.bm % 5 || e.am >= 60 || e.bm >= 60) fail(w + ': minutes should be multiples of 5 under 60');
          if (s < 60) fail(w + ': ' + e.am + ' + ' + e.bm + ' = ' + s + ' — the minutes never reach 60, there is nothing to carry');
          if (M < 5) fail(w + ': ' + total + ' min leaves 0 minutes — "□ h 0 min" makes the "min" card trivial');
          if (total > RU.max) fail(w + ': ' + total + ' min is beyond the ruler (' + RU.max + ')');
          const cards = [H, M, H - 1, s];
          if (new Set(cards).size !== 4) fail(w + ': the cards ' + cards + ' are not all different');
          if (e.bm * ppm < 48) fail(w + ': bar B (' + e.bm + ' min, ' + (e.bm * ppm).toFixed(0) + 'px) is too short for its label');
          if (a * ppm < 48 + (e.ah ? 40 : 0)) fail(w + ': bar A is too short for its label');
          /* 照規則：每一張卡 × 每一格；只收 H 進「時」、M 進「分」；每一句理由在觸發它的情況下是真的 */
          LANGS.forEach(L => {
            const d = I18N[L];
            cards.forEach(v => {
              ['h', 'm'].forEach(k => {
                const tag = w + ' card ' + v + ' in ' + k + ' ' + L;
                const ok = (k === 'h' && v === H) || (k === 'm' && v === M);
                if (ok) return;
                if (k === 'h'){
                  if (v === H - 1){ seq(tag + ' gCarryNoCarry', d.gCarryNoCarry(e.am, e.bm, s), [e.am, e.bm, s, 60, 60, 1, 1]); if (s < 60) fail(tag + ': "already 60" is false'); }
                  else { seq(tag + ' gCarryHourWrong', d.gCarryHourWrong(v), [v, v, 60]); if (!(v * 60 > total)) fail(tag + ': "' + v + ' h is more than the whole ride" is false'); }
                } else {
                  if (v === s){ seq(tag + ' gCarryOver60', d.gCarryOver60(s), [s, 60, 1]); if (s < 60) fail(tag + ': "' + s + ' is 60 or more" is false'); }
                  else { seq(tag + ' gCarryMinWrong', d.gCarryMinWrong(v), [60, v]); if (v === M) fail(tag + ': the right minutes are called wrong'); }
                }
              });
            });
            seq(w + ' gCarryNow ' + L, d.gCarryNow(e.ah, e.am, e.bm, null, null), e.ah ? [e.ah, e.am, e.bm] : [e.am, e.bm]);
            seq(w + ' gCarryNow(H) ' + L, d.gCarryNow(e.ah, e.am, e.bm, H, null), (e.ah ? [e.ah] : []).concat([e.am, e.bm, H]));
            seq(w + ' gCarryNow(H, M) ' + L, d.gCarryNow(e.ah, e.am, e.bm, H, M), (e.ah ? [e.ah] : []).concat([e.am, e.bm, H, M]));
            seq(w + ' gCarryBar A ' + L, d.gCarryBar(e.ah, e.am), e.ah ? [e.ah, e.am] : [e.am]);
            seq(w + ' gCarryBar B ' + L, d.gCarryBar(0, e.bm), [e.bm]);
            seq(w + ' gCarry2 ' + L, d.gCarry2(e.am, e.bm), [e.am, e.bm, s, 60, s - 60]);
            seq(w + ' gCarryDone ' + L, d.gCarryDone(e.ah, e.am, e.bm, H, M), e.ah ? [e.ah, e.am, e.bm, e.am, e.bm, s, 1, s - 60, e.ah, H, M] : [e.am, e.bm, s, 60, M, H, M]);
          });
          /* 每一種放的順序都會走到「H 時 M 分」：兩格各自只收一張，所以一定是 */
          if (H * 60 + M !== total || M >= 60) fail(w + ': H h M min is not the total');
          inside({ x:RU.x0, y:BR.ya - BR.h / 2, w:total * ppm, h:BR.yb + BR.h / 2 - (BR.ya - BR.h / 2) }, w + ' bars', W, D.CARRY_H);
        });
        if (!anyHour) fail('GAME_CARRY: no entry starts with an hour — "1 h 20 min + 50 min" (carry into hours that already exist) is never practised');
        if (!anyZero) fail('GAME_CARRY: no entry starts with minutes only');
        LANGS.forEach(L => { seq('gCarryTick(0) ' + L, I18N[L].gCarryTick(0), [0]); seq('gCarryTick(1) ' + L, I18N[L].gCarryTick(1), [1]); seq('gCarryTick(2) ' + L, I18N[L].gCarryTick(2), [2]); });
        if (BR.yb - BR.ya < BR.h + 4) fail('carry: the two bar rows overlap');
        if (BR.yb + BR.h / 2 + 4 > RU.y - 6) fail('carry: bar B reaches the ruler');
        const h = EQ.slot / 2, row = [sq(EQ.hx, EQ.y, EQ.slot), sq(EQ.mx, EQ.y, EQ.slot), { x:EQ.ux[0] - 14, y:EQ.y - h, w:28, h:EQ.slot }, { x:EQ.ux[1] - 22, y:EQ.y - h, w:44, h:EQ.slot }];
        row.forEach((o, k) => inside(o, 'carry: slot row part ' + k, W, D.CARRY_H)); noHits(row, 'carry: slot row parts');
        if (EQ.mx - EQ.hx < EQ.slot + 2 * 4 + 6) fail('carry: slot pads touch');
        if (!(EQ.ux[0] > EQ.hx && EQ.ux[0] < EQ.mx && EQ.ux[1] > EQ.mx)) fail('carry: "h" and "min" are not after their slots');
        if (RU.y + 10 + 18 > EQ.y - h - 4 - 4) fail('carry: the ruler labels reach the slots');
        const tray = [0, 1, 2, 3].map(k => sq((W - 3 * TR.step) / 2 + k * TR.step, TR.y, CD));
        tray.forEach((o, k) => inside(o, 'carry: card ' + k, W, D.CARRY_H)); noHits(tray, 'carry: cards');
        if (TR.y - CD / 2 < EQ.y + h + 4 + 4) fail('carry: the card tray reaches the slots');
        need('carry', /var a = e\.ah \* 60 \+ e\.am, s = e\.am \+ e\.bm, total = a \+ e\.bm, H = Math\.floor\(total \/ 60\), M = total % 60;/, 'H and M are not the total in hours and minutes');
        need('carry', /renderTray\(B, \[H, M, H - 1, s\], CARRY_TRAY\.y,/, 'the cards are not H, M, H − 1 and the unconverted minutes');
        need('carry', /if \(sl\.kind === 'h' && v !== H\)\{\s*if \(v === H - 1\) roundMiss\(d\.gCarryNoCarry\(e\.am, e\.bm, s\)\);\s*else roundMiss\(d\.gCarryHourWrong\(v\)\);\s*return false;\s*\}/, '"h" accepts a wrong card, or forgetting to carry has no reason of its own');
        need('carry', /if \(sl\.kind === 'm' && v !== M\)\{\s*if \(v === s\) roundMiss\(d\.gCarryOver60\(s\)\);\s*else roundMiss\(d\.gCarryMinWrong\(v\)\);\s*return false;\s*\}/, '"min" accepts a wrong card, or 60+ minutes has no reason of its own');
        need('carry', /addZone\(B, carryX\(0\), BR\.ya - BR\.h \/ 2, carryX\(a\) - carryX\(0\), BR\.h, 'gbar ga'/, 'bar A is not drawn from 0 to the first ride');
        need('carry', /addZone\(B, carryX\(a\), BR\.yb - BR\.h \/ 2, carryX\(total\) - carryX\(a\), BR\.h, 'gbar gb'/, 'bar B does not start where bar A ends');
        need('carry', /if \(filled === 2\) roundSolved\(d\.gCarryDone\(e\.ah, e\.am, e\.bm, H, M\)\);/, 'the round is not solved exactly when both slots are filled');
        need('carry', /var sl = nearestOpen\(slots, pt, 4\);/, 'the slots do not use a pad of 4');
      }

      /* --- 第 4 關：先到整點（範例 4：時刻 ＋ 時間量） --- */
      {
        const LN = D.HOP_LINE, BU = D.HOP_BUS, gap = (LN.x1 - LN.x0) / (LN.span / LN.step);
        let anyCross = false, anyStay = false;
        const myTick = (p, S) => {
          if (p.y < LN.y - BU.dy - 40 || p.y > LN.y + 30 || p.x < LN.x0 - gap / 2 || p.x > LN.x1 + gap / 2) return null;
          return S + Math.min(LN.span / LN.step, Math.max(0, Math.round((p.x - LN.x0) / gap))) * LN.step;
        };
        if (LN.span % LN.step || LN.back % LN.step) fail('hop: the line does not start and end on a tick');
        if (gap * scale < 30) fail('hop: ticks are ' + (gap * scale).toFixed(1) + 'px apart on a phone — the drop targets get too small (pinned at ≥ 30)');
        D.GAME_HOP.forEach((e, i) => {
          const w = 'GAME_HOP[' + i + ']';
          if (![e.h, e.m, e.add].every(isInt)) return fail(w + ' is not whole numbers');
          if (e.m % LN.step || e.add % LN.step) return fail(w + ': ' + e.m + ' / ' + e.add + ' is not a multiple of 10 — the bus could not stop on a tick');
          if (e.h < 1 || e.h > 11 || e.m < 10 || e.m > 50) fail(w + ': start ' + e.h + ':' + e.m + ' — should be 1:10~11:50');
          if (e.add < 20 || e.add > 50) fail(w + ': a ' + e.add + '-minute ride — should be 20~50');
          const s = e.h * 60 + e.m, end = s + e.add, S = s - LN.back, hour = (e.h + 1) * 60, used = hour - s, crossed = e.add > used;
          if (e.add === used) fail(w + ': the ride lands exactly on the hour — "stop at the hour first" and "arrive" would be the same tick');
          if (crossed) anyCross = true; else anyStay = true;
          if (end > S + LN.span - 20) fail(w + ': the end ' + hm(end) + ' is too close to the end of the line (the line would give the answer away)');
          if (crossed && hour > S + LN.span) fail(w + ': the hour is not on the line');
          const ticks = []; for (let t = S; t <= S + LN.span; t += LN.step){ ticks.push(t); if (!near(D.hopX(t, S), LN.x0 + (t - S) / LN.span * (LN.x1 - LN.x0))) fail(w + ': hopX(' + hm(t) + ') is off'); }
          /* hopTick()：每一格正上方（公車那一排）一定判給那一格；整條數線每 1px 和自己的算法一樣 */
          ticks.forEach(t => { if (D.hopTick({ x:D.hopX(t, S), y:LN.y - BU.dy }, S) !== t) fail(w + ': a drop right above ' + hm(t) + ' is read as ' + D.hopTick({ x:D.hopX(t, S), y:LN.y - BU.dy }, S)); });
          let bad = 0; for (let x = -10; x <= W + 10; x += 1) for (let y = 0; y <= D.HOP_H; y += 2) if (D.hopTick({ x, y }, S) !== myTick({ x, y }, S)) bad++;
          if (bad) fail(w + ': hopTick() disagrees with my own reading at ' + bad + ' points');
          if (D.hopTick({ x:150, y:10 }, S) !== null) fail(w + ': a drop far above the line is accepted');
          /* 照規則把每一種開法走一遍：從出發點、從整點，每一格放下去會怎樣；收下的一定通往 end，理由都是真的 */
          const outcome = (pos, t) => t === pos ? 'silent' : t < pos ? 'back' : t === end ? 'solved' : (crossed && pos === s && t === hour) ? 'hour' : (pos === hour && t === hour + e.add) ? 'fromHour' : 'off';
          let reachable = false;
          [s].concat(crossed ? [hour] : []).forEach(pos => ticks.forEach(t => {
            const o = outcome(pos, t);
            if (o === 'solved') reachable = true;
            if (o === 'hour' && !ticks.includes(end)) fail(w + ': stopping at the hour leads nowhere');
            LANGS.forEach(L => {
              const d = I18N[L], tag = w + ' from ' + hm(pos) + ' to ' + hm(t) + ' ' + L;
              if (o === 'off'){
                const txt = d.gHopOff(s, t, e.add);
                seq(tag + ' gHopOff', txt, hmn(s).concat(hmn(t), [t - s, e.add]));
                if (t - s === e.add) fail(tag + ': a right stop is called wrong');
                const short = L === 'zh' ? '還不到' : 'not yet', over = L === 'zh' ? '超過了' : 'more than';
                if (txt.indexOf(t - s < e.add ? short : over) < 0) fail(tag + ': gHopOff says the wrong direction (' + (t - s) + ' vs ' + e.add + '): ' + txt);
              }
              if (o === 'fromHour') seq(tag + ' gHopFromHour', d.gHopFromHour(s, hour, used, e.add), hmn(s).concat(hmn(hour), [used], hmn(hour), [e.add]));
            });
          }));
          if (!reachable) fail(w + ': the end is never reachable');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gHopNow ' + L, d.gHopNow(s, e.add, s), hmn(s).concat([e.add]));
            seq(w + ' gHopNow(end) ' + L, d.gHopNow(s, e.add, end), hmn(s).concat([e.add], hmn(end), [e.add]));
            seq(w + ' gHopDone ' + L, d.gHopDone(s, e.add, hour, crossed), crossed ? hmn(s).concat([e.add], hmn(hour), [used, e.add, used, e.add - used], hmn(end)) : hmn(s).concat([e.add, e.m, e.add, e.m + e.add, 60], hmn(end)));
            if (crossed){
              seq(w + ' gHopNow(hour) ' + L, d.gHopNow(s, e.add, hour), hmn(s).concat([e.add], hmn(hour), [used]));
              seq(w + ' gHopHour ' + L, d.gHopHour(e.m, used, hour), hmn(hour).concat([60, e.m, used, used]));
              seq(w + ' gHop2a ' + L, d.gHop2a(e.m, used, hour), [60, e.m, used, used].concat(hmn(hour)));
              seq(w + ' gHop2b ' + L, d.gHop2b(e.add, used, hour), [e.add, used, e.add - used].concat(hmn(hour), [e.add - used]));
            } else seq(w + ' gHop2c ' + L, d.gHop2c(e.m, e.add), [e.m, e.add, e.m + e.add, 60]);
          });
          /* 版面：公車在每一個會停的格子都在畫板裡；格子的標籤在畫板裡 */
          /* 公車只會停在出發點、整點（有經過時）、下車的時刻 —— 放錯一律彈回 */
          [s, end].concat(crossed ? [hour] : []).forEach(t => inside(sq(D.hopX(t, S), LN.y - BU.dy, BU.size), w + ' the bus at ' + hm(t), W, D.HOP_H));
          ticks.forEach(t => inside({ x:D.hopX(t, S) - 20, y:LN.y + 12, w:40, h:18 }, w + ' label ' + hm(t), W, D.HOP_H));
        });
        if (!anyCross) fail('GAME_HOP: no entry passes the hour');
        if (!anyStay) fail('GAME_HOP: no entry stays inside the hour — "reach the hour first" would always be right without checking');
        LANGS.forEach(L => { if (typeof I18N[L].gHopBack !== 'string' || nums(I18N[L].gHopBack).length) fail('gHopBack ' + L + ' missing or has numbers'); });
        if (LN.y - BU.dy + BU.size / 2 > LN.y - 10) fail('hop: the bus sits on the ticks');
        need('hop', /var hour = \(e\.h \+ 1\) \* 60, used = hour - s, crossed = e\.add > used, pos = s;/, 'the hour, the minutes to it, or "passes the hour" is not computed from the start');
        need('hop', /var tk = hopTick\(pt, S\);\s*if \(tk === null \|\| tk === pos\) return false;\s*if \(tk < pos\)\{ roundMiss\(d\.gHopBack\); return false; \}/, 'a drop off the line / on the bus is not silent, or driving backwards is accepted');
        need('hop', /if \(tk === end\)\{\s*P\.lock\(hopX\(tk, S\), y\);/, 'a wrong stop is accepted, or the bus is not locked on the end tick');
        need('hop', /if \(crossed && pos === s && tk === hour\)\{\s*pos = hour; P\.homeX = hopX\(hour, S\); P\.homeY = y; P\.home\(\);/, 'the hour stop is accepted when it should not be, or the bus does not wait there');
        need('hop', /if \(pos === hour && tk === hour \+ e\.add\) roundMiss\(d\.gHopFromHour\(s, hour, used, e\.add\)\);\s*else roundMiss\(d\.gHopOff\(s, tk, e\.add\)\);\s*return false;/, 'riding the whole time again from the hour has no reason of its own');
      }

      /* --- 第 5 關：分段數（範例 5：時刻 − 時刻） --- */
      {
        const SC = D.SPAN_CLOCK, SL = D.SPAN_LINE;
        let anyCross = 0, anySame = false;
        const fsrc = extractFunction(src, 'submit');
        if (!fsrc) fail('span: cannot find submit() in index.html');
        D.GAME_SPAN.forEach((e, i) => {
          const w = 'GAME_SPAN[' + i + ']';
          if (![e.h1, e.m1, e.h2, e.m2].every(isInt)) return fail(w + ' is not whole numbers');
          const s = e.h1 * 60 + e.m1, t2 = e.h2 * 60 + e.m2, total = t2 - s, crossed = e.h2 !== e.h1, hour = (e.h1 + 1) * 60;
          if (e.m1 % 5 || e.m2 % 5) fail(w + ': minutes are not multiples of 5 — the line ticks every 5');
          if (!(total > 0 && total < 60)) return fail(w + ': ' + total + ' minutes — an hour or more (the lesson\'s example 5 stays under 1 h)');
          if (crossed && e.h2 !== e.h1 + 1) fail(w + ': skips an hour');
          if (e.h1 < 1 || e.h2 > 12) fail(w + ': hours outside 1~12');
          const raw4 = (e.h2 * 100 + e.m2) - (e.h1 * 100 + e.m1), minOnly = Math.abs(e.m2 - e.m1), seg1 = hour - s, seg2 = t2 - hour;
          if (crossed){
            anyCross++;
            const ways = [total, raw4, minOnly, seg1, seg2];
            if (new Set(ways).size !== 5) fail(w + ': two wrong ways give the same number (' + ways + ') — the reasons would mix up');
            if (seg1 * SL.ppm < 46 || seg2 * SL.ppm < 46) fail(w + ': a segment under 46px — the labels overlap');
          } else anySame = true;
          if (total * SL.ppm > W - 2 * 24) fail(w + ': the line does not fit the board');
          /* 鐘面：clockSVG() 讀回來就是上車、下車的時刻 */
          [s, t2].forEach(t => { const c = readClocks(D.clockSVG(Math.floor(t / 60), t % 60, { size:SC.size }))[0]; if (!c || c.h * 60 + c.m !== t) fail(w + ': the clock for ' + hm(t) + ' reads ' + JSON.stringify(c)); });
          if (!near(D.spanX(s, s, t2) + D.spanX(t2, s, t2), 2 * SL.cx) || !near(D.spanX(t2, s, t2) - D.spanX(s, s, t2), total * SL.ppm)) fail(w + ': spanX() does not centre the line at ' + SL.cx + ' px/min ' + SL.ppm);
          /* submit() 從原始碼切出來，拿每一個打得出來的答案跑一次 */
          if (fsrc){
            const run = v => {
              const log = [];
              const env = 'var gSolved = false, gMsg = { textContent:"" }, line = {}, go = {}, inp = { value:' + JSON.stringify(v) + ', disabled:false };\n' +
                'var s = ' + s + ', t2 = ' + t2 + ', total = ' + total + ', crossed = ' + crossed + ', hour = ' + hour + ', raw4 = ' + raw4 + ', minOnly = ' + minOnly + ', e = ' + JSON.stringify(e) + ';\n' +
                'var d = new Proxy({}, { get: function(o, k){ return k === "gSpanEmpty" ? "@EMPTY@" : function(){ return k; }; } });\n' +
                'function roundMiss(t){ log.push("miss:" + t); } function roundSolved(t){ log.push("solved:" + t); gSolved = true; }\n';
              try { new Function('log', env + fsrc + '\nsubmit(); log.push("msg:" + gMsg.textContent);')(log); } catch (err){ log.push('threw:' + err.message); }
              return log;
            };
            for (let v = 0; v <= 200; v++){
              const r = run(String(v)).join('|');
              const want = v === total ? 'solved:gSpanDone' : !crossed ? 'miss:gSpanWrong' : v === raw4 ? 'miss:gSpanRaw' : v === minOnly ? 'miss:gSpanMinOnly' : v === seg1 ? 'miss:gSpanSeg1' : v === seg2 ? 'miss:gSpanSeg2' : 'miss:gSpanWrong';
              if (r.indexOf(want) !== 0) { fail(w + ': submit() on ' + v + ' gives ' + r + ', should be ' + want); break; }
            }
            ['', ' ', '3 5', '0' + total, total + '.0', '-' + total, total + 'x', '０'].forEach(v => {
              const r = run(v).join('|');
              if (r !== 'msg:@EMPTY@') fail(w + ': submit() on "' + v + '" gives ' + r + ' — a malformed answer must only show a reminder');
            });
            if (run(' ' + total + ' ').join('|').indexOf('solved') !== 0) fail(w + ': submit() does not accept the answer with spaces around it');
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gSpanNow ' + L, d.gSpanNow(s, t2, null), hmn(s).concat(hmn(t2)));
            seq(w + ' gSpanNow(total) ' + L, d.gSpanNow(s, t2, total), hmn(s).concat(hmn(t2), [total]));
            seq(w + ' gSpanFrom ' + L, d.gSpanFrom(s), hmn(s)); seq(w + ' gSpanTo ' + L, d.gSpanTo(t2), hmn(t2));
            seq(w + ' gSpanWrong ' + L, d.gSpanWrong(s, t2, total + 5), hmn(s).concat(hmn(t2), [total + 5, 5]));
            seq(w + ' gSpanDone ' + L, d.gSpanDone(s, t2, hour, crossed), crossed ? hmn(s).concat(hmn(hour), [seg1], hmn(hour), hmn(t2), [seg2, seg1, seg2, total]) : [e.m2, e.m1, total]);
            seq(w + ' gSpan2 ' + L, d.gSpan2(s, t2, hour, crossed), crossed ? hmn(s).concat(hmn(hour), [seg1], hmn(hour), hmn(t2), [seg2]) : [e.m2, e.m1]);
            if (crossed){
              seq(w + ' gSpanRaw ' + L, d.gSpanRaw(s, t2), hmn(t2).concat(hmn(s), [e.h2 * 100 + e.m2, e.h1 * 100 + e.m1, 1, 60, 100]));
              seq(w + ' gSpanMinOnly ' + L, d.gSpanMinOnly(e.m1, e.m2), [Math.max(e.m1, e.m2), Math.min(e.m1, e.m2)]);
              seq(w + ' gSpanSeg1 ' + L, d.gSpanSeg1(s, hour, seg1), hmn(s).concat(hmn(hour), [seg1], hmn(hour)));
              seq(w + ' gSpanSeg2 ' + L, d.gSpanSeg2(hour, t2, seg2), hmn(hour).concat(hmn(t2), [seg2], hmn(hour)));
            }
          });
        });
        if (anyCross < 2) fail('GAME_SPAN: fewer than 2 entries pass the hour');
        if (!anySame) fail('GAME_SPAN: no entry stays inside one hour');
        const clocks = SC.x.map(x => sq(x, SC.y, SC.size));
        clocks.forEach((o, k) => inside(o, 'span: clock ' + k, W, D.SPAN_H)); noHits(clocks, 'span: clocks overlap —');
        if (SC.y + SC.size / 2 + 2 + 22 > SL.y - 14) fail('span: the clock labels reach the line');
        inside({ x:0, y:SL.y + 14, w:W, h:18 }, 'span: the line labels', W, D.SPAN_H);
        need('span', /var raw4 = \(e\.h2 \* 100 \+ e\.m2\) - \(e\.h1 \* 100 \+ e\.m1\), minOnly = Math\.abs\(e\.m2 - e\.m1\);/, 'the four-digit and minutes-only misconceptions are not computed from the drawn times');
        need('span', /z\.innerHTML = clockSVG\(Math\.floor\(v \/ 60\), v % 60, \{ size:SC\.size \}\);/, 'the clocks are not drawn from the start and end times');
        need('span', /for \(var t = s; t <= t2; t \+= 5\)\{/, 'the line does not tick every 5 minutes from start to end');
        need('span', /inp\.maxLength = 3;/, 'the answer box is not 3 characters');
      }
    }
  }
};
module.exports._test = { scanEquations, scanClockEq, readClocks, minutesOf };
