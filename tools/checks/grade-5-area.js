/* grade-5/math/area 的檢查設定（面積魔術師：平行四邊形、三角形、梯形的面積，高要垂直量）。
   2026-10-10 新增 —— 和小遊戲「面積工地」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt）、選項的形狀與範圍。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）裡「數 ＝ 數」的每一個等號逐個重算（規則式「底 × 高 ÷ 2 ＝ …」左邊不是數，不算宣稱，另外數）。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的幾何重算：
       剪一刀 —— 每一條直的格線剪下去，剪出來的兩塊移過去是不是剛好一個長方形（面積、外框、斜邊對得上），剪錯的那一刀是不是真的只剪下一個角；
       轉半圈 —— 每一種轉法 × 每一邊，轉 180° 的那一個是不是繞著那一邊的中點轉、和原來的拼成平行四邊形；90°、0° 是不是真的拼不起來；
       梯形公式 —— 每一張卡 × 每一格；斜邊真的是畫出來那麼長（3-4-5）；
       分一分 —— 每一張圖 × 每一個箱子，「別忘了除以 2」「平行四邊形不用除以 2」只在它說的那件事成立時才出現；
       拉高 —— 每一個高按「就是這個」，說的面積、比目標少／多、「那是平行四邊形的面積」都要成立。
     每一句說明兩種語言逐個比數字、句子裡的算式逐條重算（lib/arith.js）；
     cutPick、turnPick、pullH 整片畫板逐點和這裡自己的「最近的線／最近的三角形」比；shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；
     托盤 3000 次不出現答案的排法；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   刻意的 44px 例外：剪一刀的「點一條格線」每條線只收左右 CUT.tol（9）px（手機上約 ±8.7px，約 17px 寬），比 44px 窄 ——
   相鄰兩條線只隔 26px，放寬到 44px 就會蓋過格子中間（格子中間點下去必須什麼都不做，不然點偏一點就變成剪錯線、被扣分）。
   和四年級 area「格線的點擊範圍是刻意的例外：至少 32、格子中間留空白」同一個道理；這裡守住 tol ≥ 8、而且 tol < U/2 − 2（格子中間留白）。
   線的上下兩端與中間、偏離線 6px 都點得到由 e2e 驗；拿得起來的東西（三角形、卡片、頂點的把手）仍然 ≥ 44px。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；卡片上的小圖（sortCardSvg）的比例、拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-area 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arithGame = makeArith({ units:['平方公分', '公分'], unitsEn:['cm²', 'cm'] });

/* 靜態字串的等號：每一個「數的算式 ＝ 數的算式」逐個重算。左邊緊貼著運算子（「× 高 ÷ 2 ＝」）的是規則式，不是宣稱，另外數。 */
function chainClaims(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/＝/g, '=');
  const out = { claims:[], rules:0 };
  t.split(/[，。；;,\n]|(?:\s—\s)|——/).forEach(cl => {
    const seg = cl.split('=');
    for (let i = 0; i + 1 < seg.length; i++){
      const L = seg[i].match(/([\d\s+\-*/().]*\d[\d\s+\-*/().]*)$/), R = seg[i + 1].match(/^([\d\s+\-*/().]*\d[\d\s+\-*/().]*)/);
      if (!L || !R) continue;
      let le = L[1].trim(), re = R[1].trim();
      const before = seg[i].slice(0, seg[i].length - L[1].length).trim();
      if (/^[+\-*/]/.test(le) || /[+\-*/]$/.test(before)) { out.rules++; continue; }
      /* 括號要成對：「(5+9)」的左括號被切掉的話就是規則式的一部分 */
      const bal = s => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      while (bal(le) < 0 && /^\S/.test(le)) { out.rules++; le = null; break; }
      if (le === null) continue;
      while (bal(re) > 0) re = re.replace(/\([^()]*$/, '').trim();
      while (bal(re) < 0) re = re.replace(/\)\s*$/, '').trim();
      if (!re || !/\d/.test(re)) continue;
      let a, b;
      try { a = Function('return (' + le + ')')(); b = Function('return (' + re + ')')(); } catch (e){ out.claims.push({ text:le + ' = ' + re, bad:'cannot evaluate' }); continue; }
      out.claims.push({ text:le + ' = ' + re, bad:Math.abs(a - b) > 1e-9 ? 'left is ' + a + ', right is ' + b : null });
    }
  });
  return out;
}

const W = 300;
const polyAreaRef = P => { let s = 0; for (let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const key = P => P.map(p => p.map(v => +v.toFixed(6)).join(',')).sort().join(' ');
const rot180 = (P, m) => P.map(p => [2 * m[0] - p[0], 2 * m[1] - p[1]]);
const segDistRef = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
/* 點在三角形裡（含邊上）：三個叉積同號 */
const inTriRef = (p, T) => { const c = (a, b) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); const s = [c(T[0], T[1]), c(T[1], T[2]), c(T[2], T[0])]; return s.every(v => v >= -1e-9) || s.every(v => v <= 1e-9); };
const triDistRef = (p, T) => inTriRef(p, T) ? 0 : Math.min(segDistRef(p, T[0], T[1]), segDistRef(p, T[1], T[2]), segDistRef(p, T[2], T[0]));

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲「面積工地」的引擎與計分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['cut', 'turn', 'trap', 'sort', 'pull'];", replace:"var GAME_ORDER = ['turn', 'cut', 'trap', 'sort', 'pull'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'shuffle(): only', find:'      var k = Math.floor(Math.random() * (j + 1));   /* 自足', replace:'      var k = j;   /* 自足' },
    { file:'index', expect:'starts in the answer order', find:'    if (inOrder(t)) t.reverse();\n', replace:'' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'does not clear the hint', find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:'nearestOpen(): a point inside', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop nearest to a finished slot', find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:'' },
    { file:'index', expect:'second finger', find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:'second finger can start a board tap', find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      if (false) return;   /* 第二根手指" },
    { file:'index', expect:'losing pointer capture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'placed pieces still catch taps', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'does not snap', find:"      if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));", replace:"      if (o.axis === 'y') P.place(orig.x, orig.y + dy);" },
    { file:'index', expect:'ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:'index', expect:'gets a viewBox', find:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", replace:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });" },
    { file:'index', expect:'roundNote', find:"  function roundInfo(text){ gMsg.innerHTML = '<span class=\"yes\">' + text + '</span>'; }", replace:"  function roundInfo(text){ gMistake = true; gMsg.innerHTML = '<span class=\"yes\">' + text + '</span>'; }" },

    /* 第 1 關：剪一刀 */
    { file:'index', expect:'cut: s should be', find:'var GAME_CUT = [[4, 3, 2], [4, 4, 2],', replace:'var GAME_CUT = [[4, 3, 1], [4, 4, 2],' },
    { file:'index', expect:'cut: s must be smaller than b', find:'[5, 3, 4], [5, 4, 4]];   /* [b, h, s] */', replace:'[5, 3, 4], [5, 4, 5]];   /* [b, h, s] */' },
    { file:'index', expect:'cut: the picture does not fit', find:'[5, 3, 4], [5, 4, 4]];   /* [b, h, s] */', replace:'[5, 3, 4], [6, 4, 4]];   /* [b, h, s] */' },
    { file:'index', expect:'cut: the tap zone', find:'var CUT = { U:26, oy:128, tol:9 }', replace:'var CUT = { U:26, oy:128, tol:13 }' },
    { file:'index', expect:'cut: the labels do not fit', find:'var CUT = { U:26, oy:128, tol:9 }, CUT_H = 164;', replace:'var CUT = { U:26, oy:128, tol:9 }, CUT_H = 150;' },
    { file:'index', expect:'cutPick(', find:'      if (d <= CUT.tol && d < bd){ bd = d; best = c; }', replace:'      if (d <= CUT.tol && d <= bd){ bd = d; best = c; }\n      if (best === null && d <= CUT.U / 2) best = c;' },
    { file:'index', expect:'cutPick(', find:'    if (pt.y < CUT.oy - h * CUT.U - CUT.tol || pt.y > CUT.oy + CUT.tol) return null;', replace:'    if (pt.y < CUT.oy - h * CUT.U - CUT.tol) return null;' },
    { file:'index', expect:'cutRefuse(', find:"  function cutRefuse(b, s, c){ return c < s ? 'left' : (c > b ? 'right' : null); }", replace:"  function cutRefuse(b, s, c){ return c < s ? 'left' : (c > b + 1 ? 'right' : null); }" },
    { file:'index', expect:'cutRefuse(', find:"  function cutRefuse(b, s, c){ return c < s ? 'left' : (c > b ? 'right' : null); }", replace:"  function cutRefuse(b, s, c){ return c < s ? 'right' : (c > b ? 'left' : null); }" },
    { file:'index', expect:'cutPieces(', find:'return { moved:[[0, 0], [c, 0], [c, h], [s, h]],', replace:'return { moved:[[0, 0], [c, 0], [c, h], [s + 1, h]],' },
    { file:'index', expect:'cutPieces(', find:'rect:[[c, 0], [c + b, 0], [c + b, h], [c, h]] };', replace:'rect:[[c, 0], [c + b + 1, 0], [c + b + 1, h], [c, h]] };' },
    { file:'index', expect:'cutCorner(', find:'    return c < s ? [[0, 0], [c, 0], [c, c * h / s]] :', replace:'    return c < s ? [[0, 0], [c, 0], [c, h]] :' },
    { file:'index', expect:'cut: the tapped line is not the one judged', find:'        var c = cutPick(b, h, s, pt);', replace:'        var c = cutPick(b, h, s, pt); if (c !== null) c = s;' },
    { file:'index', expect:'a second tap on the same wrong line costs again', find:'          if (badSeen[c]){ if (lastBad !== c){ lastBad = c; roundAgain(d.gCutBad(bad)); } return; }', replace:'          if (lastBad === c) return;' },
    { file:'index', expect:'a second tap on the same wrong line costs again', find:'          badSeen[c] = true; lastBad = c;\n          roundMiss(d.gCutBad(bad));', replace:'          lastBad = c;\n          roundMiss(d.gCutBad(bad));' },
    { file:'index', expect:'cut: wrong A, B, A, A, B should be charged twice', find:'          badSeen[c] = true; lastBad = c;\n          roundMiss(d.gCutBad(bad));', replace:'          badSeen = {}; badSeen[c] = true; lastBad = c;\n          roundMiss(d.gCutBad(bad));' },
    { file:'index', expect:'pull: wrong A, B, A, A, B should be charged twice', find:'          badSeen[hh] = true; lastBad = hh;\n          roundMiss(d.gPullBad(b, hh, bad.x, A, bad.less, bad.forgot));', replace:'          badSeen[hh] = true; lastBad = hh;\n          roundMiss(d.gPullBad(b, hh, bad.x, A, bad.less, bad.forgot)); badSeen = {};' },
    { file:'index', expect:'cut: wrong A, B, A, A, B should be charged twice', find:'          if (badSeen[c]){ if (lastBad !== c){ lastBad = c; roundAgain(d.gCutBad(bad)); } return; }', replace:'          if (badSeen[c]){ if (lastBad !== c){ lastBad = c; roundMiss(d.gCutBad(bad)); } return; }' },
    { file:'index', expect:'s6lead zh does not say', find:"      s6lead: '剪一刀、轉半圈、拼梯形公式、分一分、拉高 —— 五關五種玩法，每一關都在練同一件事：<strong>找出底和高，算出面積</strong>。", replace:"      s6lead: '剪一刀、轉半圈、拼梯形公式、分一分、拉高 —— 五關五種玩法，每一關都在做同一件事：<strong>把圖形變回長方形</strong>。" },
    { file:'index', expect:'the markup fallback is not the same sentence', find:'<p class="lead" data-i18n="s6lead">剪一刀、轉半圈', replace:'<p class="lead" data-i18n="s6lead">剪一刀，轉半圈' },
    { file:'index', expect:'roundAgain() charges again', find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){}" },
    { file:'index', expect:'roundAgain() charges again', find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMistake = true; gScore = Math.max(0, gScore - 5); gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:'index', expect:'cut: the piece does not slide by the base', find:"        g.style.transform = 'translate(' + (b * CUT.U) + 'px,0px)';", replace:"        g.style.transform = 'translate(' + (c * CUT.U) + 'px,0px)';" },
    { file:'index', expect:'gCutDone zh', find:"'，' + b + ' × ' + h + ' ＝ ' + (b * h) + ' 平方公分 —— 平行四邊形的面積就是底 × 高。'", replace:"'，' + b + ' × ' + h + ' ＝ ' + (b * h + b) + ' 平方公分 —— 平行四邊形的面積就是底 × 高。'" },
    { file:'index', expect:'gCutBad left zh', find:"'這一刀只剪下' + (side === 'left' ? '左下角' : '右上角')", replace:"'這一刀只剪下' + (side === 'left' ? '右上角' : '左下角')" },
    { file:'index', expect:'gCutBad left en', find:"(side === 'left' ? 'bottom-left' : 'top-right') + ' corner — it doesn’t run from the top side to the bottom side", replace:"(side === 'left' ? 'top-right' : 'bottom-left') + ' corner — it doesn’t run from the top side to the bottom side" },
    { file:'index', expect:'gCutNow zh: must say', find:"      gCutNow: function(b, h){ return '長方形 ' + b + ' × ' + h + ' ＝ ' + (b * h); },", replace:"      gCutNow: function(b, h){ return '三角形 ' + b + ' × ' + h + ' ＝ ' + (b * h); }," },
    { file:'index', expect:'gCutNow en', find:"gCutNow: function(b, h){ return 'Rectangle ' + b + ' × ' + h + ' = ' + (b * h); },", replace:"gCutNow: function(b, h){ return 'Rectangle ' + b + ' × ' + h + ' = ' + (b + h); }," },

    /* 第 2 關：轉半圈 */
    { file:'index', expect:'turn: b × h must be even', find:'var GAME_TURN = [[5, 2, 4], [4, 1, 3],', replace:'var GAME_TURN = [[5, 2, 3], [4, 1, 3],' },
    { file:'index', expect:'turn: a right angle', find:'[5, 3, 4], [4, 2, 3]];   /* [b, a, h] */', replace:'[5, 3, 4], [4, 2, 2]];   /* [b, a, h] */' },
    { file:'index', expect:'turn: the apex must be above the base', find:'[5, 3, 4], [4, 2, 3]];   /* [b, a, h] */', replace:'[5, 3, 4], [4, 4, 3]];   /* [b, a, h] */' },
    { file:'index', expect:'turn: the picture does not fit', find:'[5, 3, 4], [4, 2, 3]];   /* [b, a, h] */', replace:'[5, 3, 4], [6, 2, 3]];   /* [b, a, h] */' },
    { file:'index', expect:'turnCopy(', find:"return side === 'R' ? [[a, h], [b, 0], [a + b, h]]", replace:"return side === 'R' ? [[a, h], [b, 0], [a + b, 0]]" },
    { file:'index', expect:'turnCopy(', find:": [[0, 0], [a, h], [a - b, h]]; }", replace:": [[0, 0], [a, h], [-b, h]]; }" },
    { file:'index', expect:'turnCenter(', find:"var x = side === 'R' ? a + b / 2 : a - b / 2; return turnPt(a, x, h / 2); }", replace:"var x = side === 'R' ? a + b / 2 : a - b / 2; return turnPt(a, x, h / 3); }" },
    { file:'index', expect:'turnPick(', find:'      if (d > TURN.pad) return;', replace:'      if (d > TURN.pad * 3) return;' },
    { file:'index', expect:'turnPick(', find:"      if (d < bd || (d === bd && dc < bc)){ bd = d; bc = dc; best = side; }", replace:"      if (!best){ bd = d; bc = dc; best = side; }" },
    { file:'index', expect:'turnRefuse(', find:"return r === 2 ? null : (r === 0 ? 'same' : 'quarter'); }", replace:"return r % 2 === 0 ? null : 'quarter'; }" },
    { file:'index', expect:'turn: the piece does not fit its square', find:'  function turnSq(b, h){ return Math.max(b, h) * TURN.U; }', replace:'  function turnSq(b, h){ return Math.min(b, h) * TURN.U; }' },
    { file:'index', expect:'turn: the tray piece overlaps', find:'var TURN = { U:26, oy:128, ax:150, homeY:240, pad:14 }', replace:'var TURN = { U:26, oy:128, ax:150, homeY:200, pad:14 }' },
    { file:'index', expect:'turn: the orientation judged', find:'        var bad = turnRefuse(Q.rot);', replace:'        var bad = turnRefuse(2);' },
    { file:'index', expect:'the side judged is not where it was dropped', find:'        var side = turnPick(b, a, h, pt);', replace:"        var side = turnPick(b, a, h, pt) && 'R';" },
    { file:'index', expect:'gTurnDone en', find:"'. One triangle is half of it: ' + (b * h) + ' ÷ 2 = ' + (b * h / 2) + ' cm².'", replace:"'. One triangle is half of it: ' + (b * h) + ' ÷ 2 = ' + (b * h / 2 + 1) + ' cm².'" },
    { file:'index', expect:'gTurnQuarter zh', find:"gTurnQuarter: function(deg){ return '轉了 ' + deg + '°，邊對不上", replace:"gTurnQuarter: function(deg){ return '轉了 ' + (deg + 90) + '°，邊對不上" },
    { file:'index', expect:'gTurn2(90) en', find:"' + deg + '° now; turn it to 180° (upside down), then put it", replace:"' + deg + '° now; keep it at 180° (upside down), then put it" },
    { file:'index', expect:'gTurnNow zh should read', find:"      gTurnNow: function(deg){ return '↻ 轉了 ' + deg + '°'; },", replace:"      gTurnNow: function(deg){ return '↻ 還要轉 ' + deg + '°'; }," },
    { file:'index', expect:'gTurn2(180) zh', find:"return deg === 180 ? '提示 2：已經倒過來了（180°），放到三角形的左邊或右邊。'", replace:"return deg === 90 ? '提示 2：已經倒過來了（180°），放到三角形的左邊或右邊。'" },
    { file:'index', expect:'gTurnSame en', find:"gTurnSame: 'It hasn’t turned: two triangles facing the same way side by side don’t make a parallelogram.", replace:"gTurnSame: 'It hasn’t turned: two triangles facing the same way side by side make a parallelogram." },

    /* 第 3 關：梯形公式 */
    { file:'index', expect:'trap: the slanted side', find:'var GAME_TRAP = [[3, 8, 3, 4], [2, 6, 3, 4],', replace:'var GAME_TRAP = [[3, 8, 2, 4], [2, 6, 3, 4],' },
    { file:'index', expect:'trap: four different cards', find:'[2, 6, 3, 4], [3, 7, 3, 4],', replace:'[2, 6, 3, 4], [4, 9, 3, 4],' },
    { file:'index', expect:'trap: the right slanted side', find:'[6, 10, 3, 4], [2, 8, 4, 3],', replace:'[6, 10, 3, 4], [2, 6, 4, 3],' },
    { file:'index', expect:'trap: the area is not a whole number', find:'[4, 10, 4, 3], [2, 10, 4, 3]];', replace:'[4, 10, 4, 3], [3, 10, 4, 3]];' },
    { file:'index', expect:'trap: the picture does not fit', find:'[4, 10, 4, 3], [2, 10, 4, 3]];', replace:'[4, 10, 4, 3], [2, 12, 4, 3]];' },
    { file:'index', expect:'trapRefuse(', find:"  function trapRefuse(i, k){ return (i < 2 ? (k === 't' || k === 'd') : k === 'h') ? null : k; }", replace:"  function trapRefuse(i, k){ return (i < 2 ? (k === 't' || k === 'd') : (k === 'h' || k === 'L')) ? null : k; }" },
    { file:'index', expect:'trapRefuse(', find:"  function trapRefuse(i, k){ return (i < 2 ? (k === 't' || k === 'd') : k === 'h') ? null : k; }", replace:"  function trapRefuse(i, k){ return (i < 1 ? (k === 't') : (i < 2 ? k === 'd' : k === 'h')) ? null : k; }" },
    { file:'index', expect:'trapLeg(', find:'  function trapLeg(p, h){ return Math.round(Math.sqrt(p * p + h * h)); }', replace:'  function trapLeg(p, h){ return p + h; }' },
    { file:'index', expect:'the tray starts in the answer order', find:"(list[1].k === 't' || list[1].k === 'd') && list[2].k === 'h'; }", replace:"(list[1].k === 't' || list[1].k === 'd') && list[2].k === 'L'; }" },
    { file:'index', expect:'trap: slots overlap', find:"slotW:52, slotH:50, slotX:[48, 124, 218],", replace:"slotW:52, slotH:50, slotX:[48, 100, 218]," },
    { file:'index', expect:'a symbol overlaps a slot', find:"[')', 159, 16], ['×', 179, 22],", replace:"[')', 159, 16], ['×', 189, 22]," },
    { file:'index', expect:'trap: cards overlap', find:'cardX:[45, 115, 185, 255], pad:10 }, TRAP_H', replace:'cardX:[45, 95, 185, 255], pad:10 }, TRAP_H' },
    { file:'index', expect:'trap: the card judged', find:'        var bad = trapRefuse(sl.i, P.data.k);', replace:'        var bad = trapRefuse(sl.i, \'h\');' },
    { file:'index', expect:'or does not show the card that was placed', find:'        sl.z.textContent = P.data.v;', replace:'        sl.z.textContent = \'✓\';' },
    { file:'index', expect:'trap: a filled slot is not marked done', find:'        sl.done = true;\n        sl.z.textContent = P.data.v;', replace:'        sl.done = false;\n        sl.z.textContent = P.data.v;' },
    { file:'index', expect:'trap: the round is not solved exactly when all three', find:'        if (done === slots.length){ line.textContent', replace:'        if (done >= slots.length - 1){ line.textContent' },
    { file:'index', expect:'gTrapOk t en', find:"return v + ' is the ' + (k === 't' ? 'top base' : (k === 'd' ? 'bottom base' : 'height')) + ' ✓'; },", replace:"return v + ' is the ' + (k === 't' ? 'bottom base' : (k === 'd' ? 'top base' : 'height')) + ' ✓'; }," },
    { file:'index', expect:'gTrapNotH L zh', find:"return k === 'L' ? v + ' 是斜邊，不是高 —— 高要和底垂直（虛線那一條）。'", replace:"return k === 'L' ? v + ' 是上底，不是高 —— 高要和底垂直（虛線那一條）。'" },
    { file:'index', expect:'gTrapNotBase h en', find:"return v + (k === 'h' ? ' is the height' : ' is the slanted side') + ', not the top or bottom base", replace:"return v + (k === 'h' ? ' is the slanted side' : ' is the height') + ', not the top or bottom base" },
    { file:'index', expect:'gTrapDone zh', find:"'，一個梯形是一半：' + ((t + d) * h) + ' ÷ 2 ＝ ' + ((t + d) * h / 2) + ' 平方公分。'; },", replace:"'，一個梯形是一半：' + ((t + d) * h) + ' ÷ 2 ＝ ' + ((t + d) * h) + ' 平方公分。'; }," },
    { file:'index', expect:'gTrap2H en', find:"return 'Hint 2: the dashed line at a right angle to the bottom base is ' + h + ' — it goes after the ×.'", replace:"return 'Hint 2: the dashed line at a right angle to the bottom base is ' + (h + 1) + ' — it goes after the ×.'" },

    /* 第 4 關：分一分 */
    { file:'index', expect:'sort: two cards per box', find:"    [12, [['tri', 6, 4, 2], ['para', 6, 4, 3],", replace:"    [12, [['tri', 6, 4, 2], ['para', 6, 2, 3]," },
    { file:'index', expect:'sort: the parallelogram slanted side', find:"    [16, [['tri', 8, 4, 3], ['para', 8, 4, 3],", replace:"    [16, [['tri', 8, 4, 3], ['para', 8, 4, 2]," },
    { file:'index', expect:'sort: one parallelogram, one trapezoid, two triangles', find:"['trap', 3, 6, 4, 1], ['tri', 12, 6, 4]]],", replace:"['trap', 3, 6, 4, 1], ['para', 9, 8, 3]]]," },
    { file:'index', expect:'sort: the forgot-÷2 trap', find:"    [14, [['tri', 7, 4, 3], ['para', 7, 4, 3], ['trap', 2, 5, 4, 1], ['tri', 8, 7, 2]]],", replace:"    [14, [['tri', 7, 4, 3], ['para', 7, 4, 3], ['trap', 2, 6, 4, 1], ['tri', 8, 7, 2]]]," },
    { file:'index', expect:'sort: the apex', find:"['trap', 4, 6, 4, 1], ['tri', 10, 8, 3]]]", replace:"['trap', 4, 6, 4, 1], ['tri', 10, 8, 10]]]" },
    { file:'index', expect:'sortArea(', find:"  function sortArea(c){ return c[0] === 'tri' ? c[1] * c[2] / 2 :", replace:"  function sortArea(c){ return c[0] === 'tri' ? c[1] * c[2] :" },
    { file:'index', expect:'sortRefuse(', find:"    if (c[0] === 'para' && a / 2 === bin) return 'whole';\n", replace:'' },
    { file:'index', expect:'sortRefuse(', find:"    if (a === bin) return null;\n    if (c[0] !== 'para'", replace:"    if (a === bin || a * 2 === bin) return null;\n    if (c[0] !== 'para'" },
    { file:'index', expect:'sortFormula(', find:"(c[0] === 'para' ? c[1] + ' × ' + c[2] : '(' + c[1] + ' + ' + c[2] + ') × ' + c[3] + ' ÷ 2'); }", replace:"(c[0] === 'para' ? c[1] + ' × ' + c[2] + ' ÷ 2' : '(' + c[1] + ' + ' + c[2] + ') × ' + c[3] + ' ÷ 2'); }" },
    { file:'index', expect:'sortInOrder(', find:'return function(list){ return sortArea(list[0]) === A && sortArea(list[1]) === A; }; }', replace:'return function(list){ return false; }; }' },
    { file:'index', expect:'sort: the boxes do not overlap', find:'binX:[6, 154], binY:220, binW:140,', replace:'binX:[0, 160], binY:220, binW:140,' },
    { file:'index', expect:'sort: a chip covers the box label', find:'chipH:30, chipY:[275, 309], pad:8 }', replace:'chipH:30, chipY:[262, 309], pad:8 }' },
    { file:'index', expect:'sort: tray cards overlap', find:'trayX:[76, 224], trayY:[56, 162],', replace:'trayX:[76, 224], trayY:[56, 140],' },
    { file:'index', expect:'sort: the box judged', find:'        var c = P.data.c, why = sortRefuse(c, bin.v), name = d.gShapes[c[0]];', replace:'        var c = P.data.c, why = sortRefuse(c, A), name = d.gShapes[c[0]];' },
    { file:'index', expect:'sort: a box label does not show', find:"'gbinlbl', d.gBin(v));", replace:"'gbinlbl', d.gBin(A));" },
    { file:'index', expect:'or the round is not solved exactly when all four', find:'        bin.n++; done++;', replace:'        bin.n++;' },
    { file:'index', expect:'gSortOk zh', find:"      gSortOk: function(name, f, a){ return name + '：' + f + ' ＝ ' + a + ' ✓'; },", replace:"      gSortOk: function(name, f, a){ return name + '：' + f + ' ＝ ' + a + ' 不是 ✓'; }," },
    { file:'index', expect:'gSortBad zh', find:"(why === 'half' ? ' —— 別忘了除以 2。' : (why === 'whole' ? ' —— 平行四邊形不用除以 2。' : '。')); },", replace:"(why === 'whole' ? ' —— 別忘了除以 2。' : (why === 'half' ? ' —— 平行四邊形不用除以 2。' : '。')); }," },
    { file:'index', expect:'gSortBad tri,6,4,2 → 24 en', find:"return name + ': ' + f + ' = ' + a + ', not ' + bin + (why === 'half'", replace:"return name + ': ' + f + ' = ' + bin + ', not ' + a + (why === 'half'" },
    { file:'index', expect:'gShapes en', find:"gShapes: { tri:'Triangle', para:'Parallelogram', trap:'Trapezoid' },", replace:"gShapes: { tri:'Triangle', para:'Trapezoid', trap:'Parallelogram' }," },

    /* 第 5 關：拉高 */
    { file:'index', expect:'pull: b must be even', find:'var GAME_PULL = [[6, 4, 12], [8, 2, 24],', replace:'var GAME_PULL = [[5, 4, 15], [8, 2, 24],' },
    { file:'index', expect:'pull: the target height', find:'[4, 1, 16], [10, 3, 30]];   /* [b, a, A] */', replace:'[4, 1, 16], [10, 3, 50]];   /* [b, a, A] */' },
    { file:'index', expect:'pull: the forgot-÷2 height', find:'[4, 1, 16], [10, 3, 30]];   /* [b, a, A] */', replace:'[4, 1, 16], [10, 3, 25]];   /* [b, a, A] */' },
    { file:'index', expect:'pull: the start already', find:'var PULL = { U:22, oy:212, hMin:1, hMax:8, h0:1 }', replace:'var PULL = { U:22, oy:212, hMin:1, hMax:8, h0:6 }' },
    { file:'index', expect:'pull: the handle runs off', find:'var PULL = { U:22, oy:212, hMin:1, hMax:8, h0:1 }', replace:'var PULL = { U:22, oy:212, hMin:1, hMax:9, h0:1 }' },
    { file:'index', expect:'pullH(', find:'Math.round((PULL.oy - y) / PULL.U))); }', replace:'Math.floor((PULL.oy - y) / PULL.U))); }' },
    { file:'index', expect:'pullRefuse(', find:'  function pullRefuse(b, h, A){ var x = b * h / 2; return x === A ? null', replace:'  function pullRefuse(b, h, A){ var x = b * h / 2; return x >= A ? null' },
    { file:'index', expect:'pullRefuse(', find:'{ x:x, less:x < A, forgot:b * h === A }; }', replace:'{ x:x, less:x < A, forgot:b * h >= A }; }' },
    { file:'index', expect:'pull: the height judged', find:'        var bad = pullRefuse(b, hh, A);', replace:'        var bad = pullRefuse(b, PULL.h0, A);' },
    { file:'index', expect:'That’s it on the same height costs again', find:'          if (badSeen[hh]){ if (lastBad !== hh){ lastBad = hh; roundAgain(d.gPullBad(b, hh, bad.x, A, bad.less, bad.forgot)); } return; }', replace:'          if (lastBad === hh) return;' },
    { file:'index', expect:'pull: the right height does not lock', find:'          roundSolved(d.gPullDone(b, hh, A));'.replace('          ', '        '), replace:'        roundInfo(d.gPullDone(b, hh, A));' },
    { file:'index', expect:'gPullDone en', find:"' — height ' + h + ' is exactly right! You can also work backwards:", replace:"' — height ' + h + ' is not right! You can also work backwards:" },
    { file:'index', expect:'That’s it judges while the corner is held', find:'        if (gSolved || grip.busy()) return;   /* 頂點正被拖著', replace:'        if (gSolved) return;   /* 頂點正被拖著' },
    { file:'index', expect:'gPullNow zh', find:"      gPullNow: function(b, h){ return '底 ' + b + '　高 ' + h; },", replace:"      gPullNow: function(b, h){ return '底 ' + b + '　高 ' + h + '　面積 ' + (b * h / 2); }," },
    { file:'index', expect:'gPullBad 1 zh', find:"' ÷ 2 ＝ ' + x + '，比 ' + A + (less ? ' 少' : ' 多') + '。'", replace:"' ÷ 2 ＝ ' + x + '，比 ' + A + (less ? ' 多' : ' 少') + '。'" },
    { file:'index', expect:'gPullBad 1 en', find:"(forgot ? ' ' + b + ' × ' + h + ' = ' + A + ' is a parallelogram’s area — a triangle still needs ÷ 2.' : ''); },", replace:"(forgot ? '' : ' ' + b + ' × ' + h + ' = ' + A + ' is a parallelogram’s area — a triangle still needs ÷ 2.'); }," },
    { file:'index', expect:'gPullDone zh', find:"'，高 ' + h + ' 剛好！也可以倒過來算：' + A + ' × 2 ÷ ' + b + ' ＝ ' + h + '。'", replace:"'，高 ' + h + ' 剛好！也可以倒過來算：' + A + ' ÷ ' + b + ' ＝ ' + h + '。'" },
    { file:'index', expect:'gPull2 en', find:"', so ' + b + ' × height must be ' + A + ' × 2 = ' + (A * 2) + '.'", replace:"', so ' + b + ' × height must be ' + A + ' × 2 = ' + (A * 2 + 2) + '.'" },

    /* ---- 圖上的數字標籤不碰線（驗證者 2026-10-10） ---- */
    { file:'index', expect:'px from a stroke — labels must keep', find:"    var free = function(r){ return inBounds(r, B) && lblClear(r, strokes) && !lblCovered(r, covers); };", replace:"    var free = function(r){ return inBounds(r, B) && !lblCovered(r, covers); };" },
    { file:'index', expect:'px from a stroke — labels must keep', find:"  var LBL_CLEAR = 1.5, LBL_FS = 17,", replace:"  var LBL_CLEAR = -1, LBL_FS = 17," },
    /* 蓋住：被蓋住的標籤一定也跨過了共用的那一條邊（規則 ③ 本來就擋），所以只拿掉 covers 不會改變位置；
       這裡直接把高的數字放到那一塊的重心（舊版的 bug），規則 ② 自己的訊息要響 */
    { file:'index', expect:'is covered by a filled shape drawn on top of it', find:"{ k:'h', v:h, fs:LBL_FS, own:seg(top, foot), side:'any' }], strokes, [copy], BOARD_IN(TURN_H)) };", replace:"{ k:'h', v:h, fs:LBL_FS, own:seg(top, foot), side:'any' }], strokes, [copy], BOARD_IN(TURN_H)).map(function(L){ if (L.k === 'h'){ L.at = centroid(copy); L.leader = null; } return L; }) };" },
    { file:'index', expect:'it would read as that edge’s label', find:"      return rectSegDist(r, s.a, s.b) >= dOwn + LBL_MARGIN;", replace:"      return rectSegDist(r, s.a, s.b) >= dOwn - 30;" },
    { file:'index', expect:'is not beside what it labels', find:"      if (L.side === 'left' && cx >= (a.x + b.x) / 2) return false;", replace:"      if (L.side === 'left' && cx <= (a.x + b.x) / 2) return false;" },
    { file:'index', expect:'its leader does not start on what it labels', find:"      if (okLead){ ld = len; lead = { x:x2, y:y2, from:m, to:e }; }", replace:"      if (okLead){ ld = len; lead = { x:x2, y:y2, from:{ x:m.x + 9, y:m.y }, to:e }; }" },
    { file:'index', expect:'labels use a leader line', find:"    if (dOwn > LBL_NEAR) return false;", replace:"    if (dOwn > LBL_NEAR / 4) return false;" },
    { file:'index', expect:'they read as one number', find:"{ k:'h', v:h, fs:LBL_FS, own:seg(top, foot), side:'any' }], strokes, [], BOARD_IN(PULL_H)) };", replace:"{ k:'h', v:h, fs:LBL_FS, own:seg(top, foot), side:'any' }], strokes, [], BOARD_IN(PULL_H)).map(function(L, i, A){ if (L.k === 'h' && L.leader){ L.at = { x:A[0].at.x + 13, y:A[0].at.y - 20 }; L.leader.b = { x:L.at.x, y:L.at.y + 6 }; } return L; }) };" },
    { file:'index', expect:'sits below the base', find:"      if (L.side === 'any' && r2.y + r2.h > Math.max(a.y, b.y) - 2) continue;", replace:"" },
    { file:'index', expect:'drawLabels() does not draw the leader lines', find:"x2:L.leader.b.x, y2:L.leader.b.y, stroke:a.fill, 'stroke-width':1.5,", replace:"x2:L.leader.b.x, y2:L.leader.b.y, stroke:'transparent', 'stroke-width':1.5," },
    { file:'index', expect:'the height leader is not drawn as a visible line', find:"var hLead = svgEl('line', { stroke:'#3B7DD8', 'stroke-width':1.5,", replace:"var hLead = svgEl('line', { stroke:'transparent', 'stroke-width':1.5," },
    { file:'index', expect:'drawLabels() does not draw the leader lines', find:"      if (L.leader) svg.appendChild(svgEl('line', { x1:L.leader.a.x,", replace:"      if (false) svg.appendChild(svgEl('line', { x1:L.leader.a.x," },
    { file:'index', expect:'the height label’s leader is not drawn', find:"        if (ld){ hLead.setAttribute('x1', ld.a.x);", replace:"        if (false){ hLead.setAttribute('x1', ld.a.x);" },
    { file:'index', expect:'pull: the labels are not re-placed', find:"        [bLbl, hLbl].forEach(function(el, i){ var at = lblAttrs(sc.labels[i]); el.setAttribute('x', at.x); el.setAttribute('y', at.y); });", replace:"        hLbl.setAttribute('x', top.x + 28); hLbl.setAttribute('y', (top.y + foot.y) / 2 + 6);" },
    { file:'index', expect:'the picture card labels are not the ones sortScene placed', find:"    drawLabels(s, sc.labels, { h:'#D64545' }, { 'class':'gclbl' });", replace:"    sc.labels.forEach(function(L){ gText(s, sc.top.x + 6, (sc.top.y + sc.foot.y) / 2 + 5, L.v, { 'font-size':15 }); });" },

    { file:'index', expect:'they show while the piece is still sliding', find:"var lg = svgEl('g', { 'class':'gcutlbl', style:'visibility:hidden' }), gen0 = gGen;", replace:"var lg = svgEl('g', { 'class':'gcutlbl' }), gen0 = gGen;" },
    { file:'index', expect:'before the slide ends', find:"if (gen0 === gGen) lg.style.visibility = ''; }, 650);", replace:"if (gen0 === gGen) lg.style.visibility = ''; }, 100);" },
    { file:'index', expect:'the corner handle is not hollow', find:'  .ggrip{background:transparent;', replace:'  .ggrip{background:var(--card);' },

    /* ---- 範例的圖照比例畫 ---- */
    { file:'index', expect:'EXAMPLE s1aria: not drawn to scale', find:'<g class="pstep" data-step="0">\n          <polygon points="60,170 240,170 300,50 120,50"', replace:'<g class="pstep" data-step="0">\n          <polygon points="60,170 240,170 300,60 120,60"' },
    { file:'index', expect:'EXAMPLE s3aria: not drawn to scale', find:'<polygon points="100,60 160,60 200,140 60,140" fill="#E8F0FB"', replace:'<polygon points="100,60 160,60 200,140 50,140" fill="#E8F0FB"' },

    /* ---- 靜態字串的算式 ---- */
    { file:'index', expect:'is wrong', find:"why:'梯形面積 = (上底＋下底) × 高 ÷ 2 = (5+9) × 4 ÷ 2 = 56 ÷ 2 = 28（平方公分）。' },", replace:"why:'梯形面積 = (上底＋下底) × 高 ÷ 2 = (5+9) × 4 ÷ 2 = 54 ÷ 2 = 28（平方公分）。' }," },
    { file:'index', expect:'is wrong', find:"p1resultText: 'The rectangle has base = 6, height = 4, so area = 6 × 4 = 24 cm².", replace:"p1resultText: 'The rectangle has base = 6, height = 4, so area = 6 × 4 = 26 cm²." },

    /* ---- review.html ---- */
    { file:'review', expect:'is the other length given in the stem', find:"        var m = mixOpts(h, nearbyWrongs(h, 3, [b, area]));", replace:"        var m = mixOpts(h, nearbyWrongs(h, 3));" },
    { file:'review', expect:'is the other length given in the stem', find:"        var m = mixOpts(b, nearbyWrongs(b, 3, [h, area]));", replace:"        var m = mixOpts(b, nearbyWrongs(b, 3));" },
    { file:'review', expect:'inverseBase: the correct answer', find:"        var hs = [4,6,8], bs = [4,5,6,7,8,9,10];", replace:"        var hs = [2,4,6,8], bs = [4,5,6,7,8,9,10];" },
    { file:'review', expect:'inverseHeight: the correct answer', find:"h = pick(hs.filter(function(v){ return v !== b; })); key = b + 'x' + h; tries++; }\n        while (used.indexOf(key) >= 0 && tries < 30);\n        used.push(key);\n        var area = b * h;\n", replace:"h = pick(hs); key = b + 'x' + h; tries++; }\n        while (used.indexOf(key) >= 0 && tries < 30);\n        used.push(key);\n        var area = b * h;\n" },
    { file:'review', expect:'inverseBase: the correct answer', find:"h = pick(hs.filter(function(v){ return v !== b; })); key = b + 'x' + h; tries++; }\n        while (used.indexOf(key) >= 0 && tries < 30);\n        used.push(key);\n        var area = b * h / 2;\n", replace:"h = pick(hs); key = b + 'x' + h; tries++; }\n        while (used.indexOf(key) >= 0 && tries < 30);\n        used.push(key);\n        var area = b * h / 2;\n" },
    { file:'review', expect:'angleMissing: the correct answer', find:"        function bad(a, b){ return a + b >= 170 || 180 - a - b === a || 180 - a - b === b; }", replace:"        function bad(a, b){ return a + b >= 170; }" },
    { file:'review', expect:'paraArea:', find:"        var area = b * h;\n        var m = mixOpts(area, nearbyWrongs(area, 3));\n        return { b:b, h:h, area:area, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        var unit = lang === 'zh' ? ' 平方公分' : ' cm²';\n        return {\n          stem: lang === 'zh' ? '平行四邊形", replace:"        var area = b * h + 1;\n        var m = mixOpts(area, nearbyWrongs(area, 3));\n        return { b:b, h:h, area:area, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        var unit = lang === 'zh' ? ' 平方公分' : ' cm²';\n        return {\n          stem: lang === 'zh' ? '平行四邊形" },
    { file:'review', expect:'trapArea', find:"        var area = (top + bottom) * h / 2;", replace:"        var area = (top + bottom) * h;" },
    { file:'review', expect:'composite', find:"        var wrongs = [missTri, missDiv2, candidates[0]];", replace:"        var wrongs = [missTri, total + 50, candidates[0]];" }
  ],

  sim: {
    INVARIANTS: {
      paraArea: d => { if (d.area !== d.b * d.h) return 'area ' + d.area + ' != b × h'; },
      triArea: d => { if (d.area !== d.b * d.h / 2 || !isInt(d.area)) return 'triangle area ' + d.area + ' != b × h ÷ 2 (or not whole)'; },
      trapArea: d => {
        if (!(d.bottom > d.top)) return 'bottom ' + d.bottom + ' is not longer than top ' + d.top;
        if (d.area !== (d.top + d.bottom) * d.h / 2 || !isInt(d.area)) return 'trapArea: area ' + d.area + ' != (top + bottom) × h ÷ 2';
      },
      inverseHeight: d => { if (d.area !== d.b * d.h) return 'inverseHeight: area != b × h'; },
      inverseBase: d => { if (d.area !== d.b * d.h / 2 || !isInt(d.area)) return 'inverseBase: area != b × h ÷ 2'; },
      composite: d => {
        if (d.rectArea !== d.L * d.W || d.triArea !== d.L * d.h2 / 2 || !isInt(d.triArea) || d.total !== d.rectArea + d.triArea) return 'composite: the parts do not add up';
        /* 兩個迷思誘答：漏了三角形（只算長方形）、三角形忘了除以 2 —— 都要真的在選項裡，而且都不是正解 */
        if (d.opts.indexOf(d.rectArea) < 0 || d.opts.indexOf(d.rectArea + d.L * d.h2) < 0) return 'composite: the two misconception distractors (rectangle only, forgot ÷ 2) are not both offered';
      },
      volumeCuboid: d => { if (d.vol !== d.l * d.w * d.h) return 'volume != l × w × h'; },
      angleMissing: d => { if (d.missing !== 180 - d.a - d.b || d.missing <= 0) return 'angle: missing ' + d.missing + ' != 180 − a − b (or not positive)'; }
    },
    expectedCorrect: function(d, genId, lang){
      const U = { area:lang === 'zh' ? ' 平方公分' : ' cm²', len:lang === 'zh' ? ' 公分' : ' cm', vol:lang === 'zh' ? ' 立方公分' : ' cm³' };
      switch (genId){
        case 'paraArea': return d.b * d.h + U.area;
        case 'triArea': return d.b * d.h / 2 + U.area;
        case 'trapArea': return (d.top + d.bottom) * d.h / 2 + U.area;
        case 'inverseHeight': return d.area / d.b + U.len;
        case 'inverseBase': return d.area * 2 / d.h + U.len;
        case 'composite': return d.L * d.W + d.L * d.h2 / 2 + U.area;
        case 'volumeCuboid': return d.l * d.w * d.h + U.vol;
        case 'angleMissing': return (180 - d.a - d.b) + '°';
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      const unit = { paraArea:'area', triArea:'area', trapArea:'area', composite:'area', inverseHeight:'len', inverseBase:'len', volumeCuboid:'vol', angleMissing:'deg' }[genId];
      const RE = { area:lang === 'zh' ? /^(\d+) 平方公分$/ : /^(\d+) cm²$/, len:lang === 'zh' ? /^(\d+) 公分$/ : /^(\d+) cm$/, vol:lang === 'zh' ? /^(\d+) 立方公分$/ : /^(\d+) cm³$/, deg:/^(\d+)°$/ }[unit];
      if (!RE) return 'unknown generator ' + genId;
      const m = String(s).match(RE);
      if (!m) return 'option "' + s + '" is not a whole number with the right unit';
      const n = +m[1];
      /* 範圍從各產生器自己的參數推出來：最大的正解 ＋ 誘答最遠 ±3 */
      const MAX = { paraArea:12 * 9, triArea:14 * 9 / 2, trapArea:(7 + 13) * 8 / 2, composite:10 * 7 + 10 * 6, inverseHeight:9, inverseBase:10, volumeCuboid:8 * 8 * 8, angleMissing:120 }[genId];
      if (n < 1 || n > MAX + 3) return 'option ' + n + ' outside 1~' + (MAX + 3);
    },
    /* 「高／底」的反推題：誘答不可以是題幹裡的另一個邊長（§六之三第 4 點）。simgen 的通用檢查也會抓，這裡另外鎖死這兩題的語意 */
    renderCheck: function(d, q, lang, genId){
      if (genId === 'angleMissing'){
        const vals = q.opts.map(o => +String(o).match(/\d+/)[0]);
        if (nums(q.stem).indexOf(vals[q.ans]) >= 0) return 'angleMissing: the correct answer ' + vals[q.ans] + ' is an angle given in the stem (' + nums(q.stem).join(', ') + ')';
      }
      if (genId === 'inverseHeight' || genId === 'inverseBase'){
        const other = genId === 'inverseHeight' ? d.b : d.h;
        const vals = q.opts.map(o => +String(o).match(/\d+/)[0]);
        if (vals.some((v, i) => i !== q.ans && v === other)) return genId + ': option ' + other + ' is the other length given in the stem';
        /* 正解也不可以就是題幹裡的一個數（高 2 的三角形：面積 ＝ 底；底 ＝ 高的平行四邊形：答案就是底）—— 不用算就猜得到（驗證者 2026-10-10） */
        const stemNums = nums(q.stem);
        if (stemNums.indexOf(vals[q.ans]) >= 0) return genId + ': the correct answer ' + vals[q.ans] + ' is a number given in the stem (' + stemNums.join(', ') + ')';
        const ex = genId === 'inverseHeight' ? [d.b, d.area] : [d.h, d.area];
        if (vals.some((v, i) => i !== q.ans && ex.indexOf(v) >= 0)) return genId + ': a distractor repeats a number given in the stem';
      }
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「面積工地」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{LBL_CLEAR, LBL_FS, CARD_FS, cutScene, turnScene, trapScene, sortScene, pullScene, GAME_ORDER, GW, GPICK, shuffle, unsorted, polyArea, segDist, inPoly, polyDist, centroid, CUT, CUT_H, GAME_CUT, cutOx, cutPt, cutPick, cutRefuse, cutPieces, cutCorner, TURN, TURN_H, GAME_TURN, turnOx, turnPt, turnTri, turnCopy, turnSq, turnCenter, turnPoly, turnPick, turnRefuse, TRAP, TRAP_H, TRAP_SYMS, GAME_TRAP, TRAP_KEYS, trapOx, trapPt, trapLeg, trapShape, trapCards, trapInOrder, trapTray, trapRefuse, SORT, SORT_H, GAME_SORT, sortArea, sortShape, sortFormula, sortSlant, sortInOrder, sortTray, sortRefuse, PULL, PULL_H, GAME_PULL, pullOx, pullY, pullH, pullRefuse}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        const r = arithGame(s);
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 等號掃描器自己先證明會響（正反例） --- */
      [['6 × 4 = 24', 1, 0], ['6 × 4 = 25', 1, 1], ['(5+9) × 4 ÷ 2 = 56 ÷ 2 = 28', 2, 0], ['(5+9) × 4 ÷ 2 = 56 ÷ 2 = 29', 2, 1],
       ['面積 = 底 × 高 ÷ 2 = 10 × 6 ÷ 2 = 30', 1, 0], ['底 × 高 = 面積', 0, 0], ['高 = 面積 ÷ 底 = 42 ÷ 7 = 6', 1, 0], ['42 ÷ 7 = 7', 1, 1],
       ['(上底＋下底) × 高 ÷ 2 = (5+9) × 6 ÷ 2 = 84 ÷ 2 = 41', 2, 1], ['base = 6, height = 4, so area = 6 × 4 = 24 cm²', 1, 0], ['3 + 7 = 10，高 = 4', 1, 0]]
        .forEach(([t, n, bad]) => {
          const r = chainClaims(t);
          if (r.claims.length !== n || r.claims.filter(c => c.bad).length !== bad) fail('chainClaims() self-test: "' + t + '" should give ' + n + ' claims, ' + bad + ' wrong — got ' + JSON.stringify(r.claims));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的等號逐個重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        chainClaims(s).claims.forEach(c => { checkedEq++; if (c.bad) fail(where + ': "' + c.text + '" is wrong (' + c.bad + ')'); });
      }));
      if (checkedEq < 40) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* --- 1b. 範例的圖照比例畫：每一張圖「一單位幾 px」在底和高上要一樣（標的數字就是畫出來的長度） --- */
      {
        const svgOf = aria => { const i = src.indexOf('data-i18n-aria="' + aria + '"'); return i < 0 ? '' : src.slice(i, src.indexOf('</svg>', i)); };
        const P = (blk, re) => { const m = blk.match(re); return m ? m[1].split(/[\s,]+/).map(Number) : null; };
        const ex = [
          ['s1aria', /<g class="pstep" data-step="0">\s*<polygon points="([^"]+)"/, 6, 4],
          ['s2aria', /<polygon points="([^"]+)" fill="#E3F4EB"/, 8, 5],
          ['s3aria', /<polygon points="([^"]+)" fill="#E8F0FB"/, 7, 4]
        ];
        ex.forEach(([aria, re, base, hgt]) => {
          const v = P(svgOf(aria), re);
          if (!v){ fail('EXAMPLE ' + aria + ': cannot read the shape'); return; }
          const xs = [], ys = []; for (let i = 0; i < v.length; i += 2){ xs.push(v[i]); ys.push(v[i + 1]); }
          const yb = Math.max(...ys), bottom = xs.filter((x, i) => ys[i] === yb), bpx = Math.max(...bottom) - Math.min(...bottom), hpx = yb - Math.min(...ys);
          if (Math.abs(bpx / base - hpx / hgt) > 0.01) fail('EXAMPLE ' + aria + ': not drawn to scale — base ' + base + ' is ' + bpx + 'px (' + (bpx / base) + '/unit) but height ' + hgt + ' is ' + hpx + 'px (' + (hpx / hgt) + '/unit)');
        });
      }

      /* --- 1c. 遊戲的開場白：說的那件事五關都成立（codex 第一輪：舊句「把圖形變回長方形」對轉半圈、分一分、拉高都不對）；
             頁面上的備用字和中文字典是同一句（兩份一樣的句子，被蓋掉的那一份最容易爛掉） --- */
      {
        const LEAD = { zh:'每一關都在練同一件事：<strong>找出底和高，算出面積</strong>', en:'every round practises the same thing: <strong>find the base and the height, then the area</strong>' };
        LANGS.forEach(L => {
          const t = I18N[L].s6lead || '';
          if (t.indexOf(LEAD[L]) < 0) fail('GAME s6lead ' + L + ' does not say "' + LEAD[L] + '"');
          hasNot('s6lead', L, t, { zh:['變回長方形'], en:['back into a rectangle'] });
        });
        const m = src.match(/<p class="lead" data-i18n="s6lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s6lead) fail('GAME s6lead: the markup fallback is not the same sentence as the zh dictionary');
      }

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：面積工地');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['cut', 'turn', 'trap', 'sort', 'pull'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, then 2 backwards), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        cut: { has:{ zh:['高', '從上面的邊', '下面的邊'], en:['height', 'top side', 'bottom side'] }, not:{ zh:['斜邊'], en:['slanted'] } },
        turn: { has:{ zh:['轉半圈', '平行四邊形'], en:['half a turn', 'parallelogram'] }, not:{ zh:['不用轉'], en:['no need to turn'] } },
        trap: { has:{ zh:['平行', '垂直', '不是旁邊斜斜的邊'], en:['parallel', 'right angle', 'not the slanted side'] }, not:{} },
        sort: { has:{ zh:['除以 2', '平行四邊形不用', '不是斜邊'], en:['÷ 2', 'parallelograms don’t', 'not a slanted side'] }, not:{} },
        pull: { has:{ zh:['底 × 高 ÷ 2'], en:['base × height ÷ 2'] }, not:{} }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (t === 'pull'){ if (typeof a !== 'function') fail('GAME: gAsks.pull must be a function of the target area (' + L + ')'); }
          else if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a, []);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, (t === 'sort' || t === 'pull') ? [2] : []); has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };
      /* 「同一個錯不重複扣分」真的跑一次：把 RENDER 裡從 badSeen 判斷到 roundMiss 那一段切出來，換上假的 roundMiss／roundAgain，
         照 A、B、A、A、B 的順序判：只能扣兩次（A、B 各一次），A 第二次（前面是 B）要再說一次，連著的同一個什麼都不做（codex 第二輪） */
      const repeatRun = (round, body, k, call) => {
        /* 從「if (badSeen[k])」切到「badSeen[k] = true;」的下一行（roundMiss 那一行）整行 —— 那一行後面多接的東西也要一起跑 */
        const i = body.indexOf('if (badSeen[' + k + '])'), j0 = body.indexOf('badSeen[' + k + '] = true;', i), j1 = j0 < 0 ? -1 : body.indexOf('\n', j0), j = j1 < 0 ? -1 : body.indexOf('\n', j1 + 1);
        if (i < 0 || j < 0 || body.slice(j1, j).indexOf('roundMiss(d.' + call + ');') < 0){ fail('GAME ' + round + ': cannot cut the repeat-mistake branch out of RENDER.' + round + ' (wrong A, B, A, A, B should be charged twice)'); return; }
        const snip = body.slice(i, j);
        let log;
        try {
          log = new Function('var log = [], badSeen = {}, lastBad = null, bad = { x:1, less:true, forgot:false }, b = 1, A = 1;' +
            'var d = { gCutBad:function(x){ return "why"; }, gPullBad:function(){ return "why"; } };' +
            'function roundMiss(t){ log.push("miss"); } function roundAgain(t){ log.push("again"); }' +
            'function judge(' + k + '){ ' + snip + ' }' +
            '[3, 7, 3, 3, 7].forEach(function(v){ log.push("@" + v); judge(v); }); return log.join(" ");')();
        } catch (e){ fail('GAME ' + round + ': the repeat-mistake branch could not run (wrong A, B, A, A, B should be charged twice): ' + e.message); return; }
        if (log !== '@3 miss @7 miss @3 again @3 @7 again') fail('GAME ' + round + ': wrong A, B, A, A, B should be charged twice (and repeat A, then B) — got "' + log + '"');
      };

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.axis === 'y'\) P\.place\(orig\.x, o\.snapY\(orig\.y \+ dy\)\);/, 'the corner handle does not snap to a grid line while it is dragged');
      need(null, /P\.turn = function\(\)\{ P\.rot = \(P\.rot \+ 1\) % 4; P\.place\(P\.cx, P\.cy\); \};/, 'turning does not turn the piece by 90° and redraw it');
      need(null, /' rotate\(' \+ \(P\.rot \* 90\) \+ 'deg\)'/, 'the piece is not drawn turned by its rotation');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      /* 頁尾的「讓 SVG 的畫布容得下自己的標籤」只撐開有 viewBox 的圖：遊戲畫板的 SVG 不可以有 viewBox（一撐開，畫出來的位置就和量的位置對不上） */
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — the page-wide label fitter could rescale it and the drawing would no longer match the hit zones'); }
      if (/viewBox/.test((extractFunction(gsrc, 'sortCardSvg') || 'viewBox').replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: a picture card SVG gets a viewBox (or sortCardSvg is missing)');
      ['turn', 'trap', 'sort'].forEach(t => need(t, /useTapSelect\(B, function\((P|Q), pt\)\{/, 'the round has no tap-then-tap alternative'));
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
      { const ri = extractFunction(gsrc, 'roundInfo'); if (!ri || /gMistake|gScore/.test(ri)) fail('GAME: roundInfo() (a roundNote-style message) changes the score or records a mistake'); }
      {
        const ra = extractFunction(gsrc, 'roundAgain');
        if (!ra) fail('GAME: cannot find roundAgain() (repeat an explained mistake without charging it)');
        else {
          let r;
          try { r = new Function('var gMistake = false, gScore = 20, elScore = { textContent:"20" }, gMsg = {};\n' + ra + '\nroundAgain("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ r = null; fail('GAME: roundAgain() could not run: ' + e.message); }
          if (r && (r.s !== 20 || r.shown !== '20' || r.m || typeof r.html !== 'string' || r.html.indexOf('why') < 0 || !/class="no"/.test(r.html))) fail('GAME: roundAgain() charges again (score ' + r.s + ', mistake ' + r.m + ') or does not show the reason');
        }
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85), L === 'zh' ? [85] : [5, 85]);
        say('gClear', L, d.gClear, []);
      });

      /* --- shuffle()、nearestOpen()：切出來真的跑 --- */
      let shuffleFn = null, nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'shuffle');
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
          /* 一大一小兩格、放寬之後重疊：大格裡靠近小格的點要給大格（量到方框，不是量到中心） */
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

      /* ================= 圖上的數字標籤（驗證者 2026-10-10，兩輪）：每一題（剪一刀每一條對的線、轉半圈兩邊、拉高每一個高 1～8）都要守三條規則 =================
         ① 不碰線：字的墨跡框離每一條線（形狀的邊、虛線的高、直角記號、拉高的把手）≥ 2px，不出界、不和別的標籤重疊；
         ② 不被蓋住：轉半圈放好的那一塊三角形是另一層、在上面 —— 墨跡框不可以碰到它的裡面；
         ③ 看得出是誰的標籤（只看位置，不看顏色）：離它標的那一段 ≤ 14px、比離任何別的邊或虛線至少近 2px、中心落在那一段的範圍裡、在對的那一邊；
            放不下的（太扁、高只有 1～2 格）可以用引線：引線一端在它標的那一段上、另一端貼著字，≤ 60px，不碰別的虛線、記號與標籤。
         線、蓋在上面的形狀、它標的那一段都用這裡自己的幾何重算；墨跡框用這裡自己的估計（字數 × 0.56 × 字級 寬、0.74 × 字級 高，中心就是標籤的位置）；
         距離用這裡自己的「框到線段」。 */
      {
        const rsd = (r, a, b) => {
          const pr = p => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));
          if (pr(a) === 0 || pr(b) === 0) return 0;
          const C = [{ x:r.x, y:r.y }, { x:r.x + r.w, y:r.y }, { x:r.x + r.w, y:r.y + r.h }, { x:r.x, y:r.y + r.h }];
          for (let i = 0; i < 4; i++) if (crossRef(a, b, C[i], C[(i + 1) % 4])) return 0;
          return Math.min(pr(a), pr(b), ...C.map(c => segDistRef(c, a, b)));
        };
        const crossRef = (p, q, u, v) => { const d = (q.x - p.x) * (v.y - u.y) - (q.y - p.y) * (v.x - u.x); if (!d) return false; const t = ((u.x - p.x) * (v.y - u.y) - (u.y - p.y) * (v.x - u.x)) / d, w = ((u.x - p.x) * (q.y - p.y) - (u.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && w >= 0 && w <= 1; };
        const ssd = (p, q, u, v) => crossRef(p, q, u, v) ? 0 : Math.min(segDistRef(p, u, v), segDistRef(q, u, v), segDistRef(u, p, q), segDistRef(v, p, q));
        const inPolyRef = (p, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++){ if ((P[i].y > p.y) !== (P[j].y > p.y) && p.x < (P[j].x - P[i].x) * (p.y - P[i].y) / (P[j].y - P[i].y) + P[i].x) c = !c; } return c; };
        const edges = (P, w) => P.map((p, i) => ({ a:p, b:P[(i + 1) % P.length], w, role:'edge' }));
        const hgt = (top, foot, m) => [{ a:top, b:foot, w:2.5, role:'dash' }, { a:{ x:foot.x + m, y:foot.y }, b:{ x:foot.x + m, y:foot.y - m }, w:1.5, role:'mark' }, { a:{ x:foot.x + m, y:foot.y - m }, b:{ x:foot.x, y:foot.y - m }, w:1.5, role:'mark' }];
        const onSeg = (s, o) => segDistRef(s.a, o.a, o.b) < 0.5 && segDistRef(s.b, o.a, o.b) < 0.5;
        let nLbl = 0, nLead = 0;
        const checkScene = (where, sc, strokes, covers, want, bounds) => {
          const boxes = [], leads = [];
          want.forEach(([k, v, own, side]) => {
            const L = sc.labels.filter(x => x.k === k)[0];
            if (!L){ fail(where + ': no label "' + k + '"'); return; }
            if (L.v !== v) fail(where + ': label ' + k + ' reads ' + L.v + ', expected ' + v);
            if (!L.at){ fail(where + ': the label ' + k + ' has nowhere to go'); return; }
            nLbl++;
            const w = String(L.v).length * 0.56 * L.fs, h = 0.74 * L.fs, r = { x:L.at.x - w / 2, y:L.at.y - h / 2, w, h };
            const tag = where + ': label ' + k + ' (' + L.v + ')';
            if (r.x < bounds.x0 - EPS || r.y < bounds.y0 - EPS || r.x + w > bounds.x1 + EPS || r.y + h > bounds.y1 + EPS) fail(tag + ' sticks out of its drawing');
            strokes.forEach(st => { const dd = rsd(r, st.a, st.b) - st.w / 2; if (dd < 2) fail(tag + ' is ' + dd.toFixed(1) + 'px from a stroke — labels must keep ≥ 2px'); });
            const P = [{ x:r.x, y:r.y }, { x:r.x + w, y:r.y }, { x:r.x + w, y:r.y + h }, { x:r.x, y:r.y + h }, { x:L.at.x, y:L.at.y }];
            covers.forEach(cv => { if (P.some(p => inPolyRef(p, cv)) || cv.some((p, i) => rsd(r, p, cv[(i + 1) % cv.length]) === 0)) fail(tag + ' is covered by a filled shape drawn on top of it'); });
            const others = strokes.filter(st => (st.role === 'edge' || st.role === 'dash') && !onSeg(st, own));
            if (L.leader){
              nLead++;
              const la = L.leader.a, lb = L.leader.b, len = Math.hypot(lb.x - la.x, lb.y - la.y);
              if (segDistRef(la, own.a, own.b) > 0.5) fail(tag + ': its leader does not start on what it labels');
              const ed = Math.hypot(Math.max(r.x - lb.x, 0, lb.x - r.x - w), Math.max(r.y - lb.y, 0, lb.y - r.y - h));
              if (ed > 2.5) fail(tag + ': its leader ends ' + ed.toFixed(1) + 'px away from the number');
              if (len > 60) fail(tag + ': its leader is ' + len.toFixed(0) + 'px long');
              strokes.filter(st => (st.role === 'dash' || st.role === 'mark') && !onSeg(st, own)).forEach(st => { if (ssd(la, lb, st.a, st.b) < st.w / 2 + 1) fail(tag + ': its leader touches another dashed line or mark'); });
              boxes.forEach(o => { if (rsd(o, la, lb) < 1) fail(tag + ': its leader runs through another label'); });
              /* 用引線的數字：離別的數字夠遠（不會和旁邊的數字讀成一個數），高的數字不跑到底的下面（那是底的標籤的地盤） */
              sc.labels.filter(o => o !== L && o.at).forEach(o => { const ow = String(o.v).length * 0.56 * o.fs, oh = 0.74 * o.fs, ob = { x:o.at.x - ow / 2, y:o.at.y - oh / 2, w:ow, h:oh };
                const gap = Math.hypot(Math.max(ob.x - r.x - w, r.x - ob.x - ow, 0), Math.max(ob.y - r.y - h, r.y - ob.y - oh, 0)); if (gap < 10) fail(tag + ' (with a leader) is only ' + gap.toFixed(1) + 'px from the number ' + o.v + ' — they read as one number'); });
              if (k === 'h' && r.y + h > Math.max(own.a.y, own.b.y)) fail(tag + ' (with a leader) sits below the base — that is where the base’s number goes');
              leads.push([la, lb]);
            } else {
              const dOwn = rsd(r, own.a, own.b), cx = L.at.x, cy = L.at.y;
              if (dOwn > 14) fail(tag + ' is ' + dOwn.toFixed(1) + 'px from what it labels — too far to read as its label');
              const inSpan = (side === 'below' || side === 'above') ? (cx >= Math.min(own.a.x, own.b.x) && cx <= Math.max(own.a.x, own.b.x)) : (cy >= Math.min(own.a.y, own.b.y) && cy <= Math.max(own.a.y, own.b.y));
              const onSide = side === 'below' ? cy > Math.max(own.a.y, own.b.y) : side === 'above' ? cy < Math.min(own.a.y, own.b.y) : side === 'left' ? cx < (own.a.x + own.b.x) / 2 : true;
              if (!inSpan || !onSide) fail(tag + ' is not beside what it labels (within its span ' + inSpan + ', on the ' + side + ' side ' + onSide + ')');
              others.forEach(st => { const dO = rsd(r, st.a, st.b); if (dO < dOwn + 2) fail(tag + ' is nearer another edge (' + dO.toFixed(1) + 'px) than what it labels (' + dOwn.toFixed(1) + 'px) — it would read as that edge’s label'); });
            }
            leads.forEach(([la, lb]) => { if (rsd(r, la, lb) < 1 && !(L.leader && L.leader.a === la)) fail(tag + ' sits on another label’s leader'); });
            boxes.push(r);
          });
          noHits(boxes, where + ': labels overlap —');
        };
        const B = H => ({ x0:2, y0:2, x1:W - 2, y1:H - 2 });
        const S = (p, q) => ({ a:p, b:q });
        D.GAME_CUT.forEach(([b, h, s0]) => { for (let c = s0; c <= b; c++){
          const px = q => D.cutPt(b, q[0], q[1]), pc = D.cutPieces(b, h, s0, c);
          const st = edges(pc.stay.map(px), 3).concat(edges(pc.moved.map(q => px([q[0] + b, q[1]])), 3), edges(pc.rect.map(px), 2));
          checkScene('GAME labels cut [' + [b, h, s0] + '] c=' + c, D.cutScene(b, h, s0, c), st, [], [['b', b, S(px([c, 0]), px([c + b, 0])), 'below'], ['h', h, S(px([c, 0]), px([c, h])), 'left']], B(D.CUT_H));
        } });
        D.GAME_TURN.forEach(([b, a, h]) => ['L', 'R'].forEach(side => {
          const px = q => D.turnPt(a, q[0], q[1]), top = px([a, h]), foot = px([a, 0]), copy = D.turnCopy(b, a, h, side).map(px);
          const st = edges(D.turnTri(b, a, h).map(px), 3).concat(edges(copy, 3), hgt(top, foot, 8));
          checkScene('GAME labels turn [' + [b, a, h] + '] ' + side, D.turnScene(b, a, h, side), st, [copy], [['b', b, S(px([0, 0]), px([b, 0])), 'below'], ['h', h, S(top, foot), 'any']], B(D.TURN_H));
        }));
        D.GAME_TRAP.forEach(e => {
          const [t, dd, p, h] = e, px = q => D.trapPt(dd, q[0], q[1]), top = px([p, h]), foot = px([p, 0]);
          const st = edges(D.trapShape(e).map(px), 3).concat(hgt(top, foot, 8));
          checkScene('GAME labels trap [' + e + ']', D.trapScene(e), st, [], [['t', t, S(px([p, h]), px([p + t, h])), 'above'], ['d', dd, S(px([0, 0]), px([dd, 0])), 'below'], ['h', h, S(top, foot), 'any'], ['L', D.trapLeg(p, h), S(px([0, 0]), px([p, h])), 'left']], { x0:2, y0:2, x1:W - 2, y1:D.TRAP.slotY - 2 });
        });
        D.GAME_SORT.forEach(e => e[1].forEach(c => {
          const sc = D.sortScene(c), hU = c[0] === 'trap' ? c[3] : c[2], base = c[0] === 'trap' ? c[2] : c[1];
          /* 卡片自己的比例：從畫出來的形狀量回來（每一格幾 px），再自己算每一條線 */
          const P = sc.pts, xs = P.map(q => q.x), ys = P.map(q => q.y), u = (Math.max(...ys) - Math.min(...ys)) / hU, x0 = Math.min(...xs), y0 = Math.max(...ys);
          const px = q => ({ x:x0 + q[0] * u, y:y0 - q[1] * u });
          const shape = D.sortShape(c).map(px);
          if (shape.some((q, i) => Math.abs(q.x - P[i].x) > 1e-6 || Math.abs(q.y - P[i].y) > 1e-6)) fail('GAME labels sort ' + c + ': the card shape is not drawn to one scale');
          const fx = c[0] === 'trap' ? c[4] : c[3], top = px([fx, hU]), foot = px([fx, 0]);
          const st = edges(shape, 2.5).concat(hgt(top, foot, 6));
          const want = [['b', base, S(px([0, 0]), px([base, 0])), 'below'], ['h', hU, S(top, foot), 'any']];
          if (c[0] === 'para') want.push(['L', D.sortSlant(c), S(px([0, 0]), px([c[3], hU])), 'left']);
          if (c[0] === 'trap') want.push(['t', c[1], S(px([c[4], hU]), px([c[4] + c[1], hU])), 'above']);
          checkScene('GAME labels sort ' + c, sc, st, [], want, { x0:3, y0:3, x1:D.SORT.cardW - 9, y1:D.SORT.cardH - 9 });
        }));
        D.GAME_PULL.forEach(([b, a, A]) => { for (let h = D.PULL.hMin; h <= D.PULL.hMax; h++){
          const ox = D.pullOx(b), px = q => ({ x:ox + q[0] * D.PULL.U, y:D.PULL.oy - q[1] * D.PULL.U }), top = px([a, h]), foot = px([a, 0]);
          const st = edges([px([0, 0]), px([b, 0]), top], 3).concat([{ a:top, b:foot, w:2.5, role:'dash' }, { a:top, b:top, w:D.GPICK + 4, role:'grip' }]);
          checkScene('GAME labels pull [' + [b, a, A] + '] h=' + h, D.pullScene(b, a, h), st, [], [['b', b, S(px([0, 0]), px([b, 0])), 'below'], ['h', h, S(top, foot), 'any']], B(D.PULL_H));
        } });
        if (nLbl < 290) fail('GAME labels: only ' + nLbl + ' labels checked');
        /* 引線只給放不下的：拉高關高 1～2 格（8 題 × 2 個高 ＝ 16 條）；多出來就表示有標籤放得下卻用了引線 */
        if (nLead > 16) fail('GAME labels: ' + nLead + ' labels use a leader line — only the 16 short heights of round 5 should need one');
        need('cut', /var lg = svgEl\('g', \{ 'class':'gcutlbl', style:'visibility:hidden' \}\), gen0 = gGen;\s*svg\.appendChild\(lg\);\s*drawLabels\(lg, cutScene\(b, h, s, c\)\.labels, \{ h:'#3B7DD8' \}\);\s*setTimeout\(function\(\)\{ if \(gen0 === gGen\) lg\.style\.visibility = ''; \}, (\d+)\);/, 'cut: the labels are not the ones cutScene placed, or they show while the piece is still sliding through them');
        { const m = gsrc.match(/lg\.style\.visibility = ''; \}, (\d+)\);/), t = (src.match(/\.gslide\{transition:transform ([\d.]+)s/) || [])[1];
          if (!m || !t || +m[1] < +t * 1000) fail('GAME cut: the labels show (' + (m && m[1]) + 'ms) before the slide ends (' + t + 's) — the moving piece sweeps through them'); }
        if (!/\.ggrip\{background:transparent;/.test(src)) fail('GAME pull: the corner handle is not hollow — it hides the corner and the dashed height at heights 1~2');
        need('turn', /var sc = turnScene\(b, a, h, side\);\s*gHeight\(svg, sc\.top, sc\.foot, '#3B7DD8'\);\s*drawLabels\(svg, sc\.labels, \{ h:'#3B7DD8' \}\);/, 'turn: the labels are not the ones turnScene placed');
        need('trap', /var sc = trapScene\(e\);\s*gHeight\(svg, sc\.top, sc\.foot, '#E8871E'\);\s*drawLabels\(svg, sc\.labels, \{ h:'#E8871E' \}, \{ 'class':'glbl' \}\);/, 'trap: the labels are not the ones trapScene placed');
        need('pull', /var sc = scenes\[hh\] \|\| \(scenes\[hh\] = pullScene\(b, a, hh\)\), top = sc\.top, foot = sc\.foot;[\s\S]{0,400}\[bLbl, hLbl\]\.forEach\(function\(el, i\)\{ var at = lblAttrs\(sc\.labels\[i\]\); el\.setAttribute\('x', at\.x\); el\.setAttribute\('y', at\.y\); \}\);/, 'pull: the labels are not re-placed by pullScene at every height');
        { const dl = extractFunction(gsrc, 'drawLabels') || ''; if (!/if \(L\.leader\) svg\.appendChild\(svgEl\('line', \{ x1:L\.leader\.a\.x, y1:L\.leader\.a\.y, x2:L\.leader\.b\.x, y2:L\.leader\.b\.y, stroke:a\.fill, 'stroke-width':1\.5,/.test(dl)) fail('GAME labels: drawLabels() does not draw the leader lines (visible, in the label’s colour)'); }
        /* 拉高關自己管的那一條引線：看得見、和「高」的數字同一個顏色（codex 第七輪） */
        { const m1 = gsrc.match(/hLbl = gText\(svg, 0, 0, hh, \{ fill:'(#[0-9A-Fa-f]{6})', 'data-k':'h' \}\);\s*var hLead = svgEl\('line', \{ stroke:'(#[0-9A-Fa-f]{6})', 'stroke-width':1\.5,/);
          if (!m1 || m1[1] !== m1[2]) fail('GAME pull: the height leader is not drawn as a visible line in the height number’s colour'); }
        need('pull', /var ld = sc\.labels\[1\]\.leader;\s*if \(ld\)\{ hLead\.setAttribute\('x1', ld\.a\.x\); hLead\.setAttribute\('y1', ld\.a\.y\); hLead\.setAttribute\('x2', ld\.b\.x\); hLead\.setAttribute\('y2', ld\.b\.y\);/, 'pull: the height label’s leader is not drawn where pullScene put it');
        const card = extractFunction(gsrc, 'sortCardSvg') || '';
        if (!/var sc = sortScene\(c\);/.test(card) || !/drawLabels\(s, sc\.labels, \{ h:'#D64545' \}, \{ 'class':'gclbl' \}\);/.test(card) || /gText\(/.test(card)) fail('GAME sort: the picture card labels are not the ones sortScene placed');
      }

      /* ================= 第 1 關：剪一刀 ================= */
      {
        const C = D.CUT, U = C.U;
        if (!(C.tol < U / 2 - 2)) fail('GAME cut: the tap zone of a line (±' + C.tol + ') leaves no blank in the middle of a cell (U ' + U + ')');
        if (!(C.tol >= 8)) fail('GAME cut: the tap zone of a line is only ±' + C.tol + ' — too thin to hit');
        let lines = 0;
        D.GAME_CUT.forEach(e => {
          const [b, h, s] = e, where = 'GAME cut [' + e + ']';
          if (!(isInt(b) && isInt(h) && isInt(s))) return fail(where + ': not whole numbers');
          if (!(s >= 2)) fail(where + ': cut: s should be ≥ 2 (else no line cuts only the bottom-left corner)');
          if (!(s < b)) fail(where + ': cut: s must be smaller than b (else no line runs from the top side to the bottom side except one, and the right corner cut does not exist)');
          const ox = D.cutOx(b);
          if (!(ox >= 10 && ox + 2 * b * U <= W - 10)) fail(where + ': cut: the picture does not fit the board (2b wide, from ' + ox + ')');
          if (!(C.oy - h * U >= 8 && C.oy + 22 + 6 <= D.CUT_H)) fail(where + ': cut: the labels do not fit (top ' + (C.oy - h * U) + ', base label to ' + (C.oy + 28) + ' of ' + D.CUT_H + ')');
          const para = [[0, 0], [b, 0], [b + s, h], [s, h]], A = polyAreaRef(para);
          let good = 0, left = 0, right = 0;
          for (let c = 1; c < b + s; c++){
            lines++;
            /* 這一條直線在平行四邊形裡從哪裡到哪裡：下緣 max(0, ·)、上緣 min(h, ·) */
            const yLo = c <= b ? 0 : (c - b) * h / s, yHi = c >= s ? h : c * h / s, full = yLo < EPS && yHi > h - EPS;
            const want = full ? null : (c < s ? 'left' : 'right');
            const got = D.cutRefuse(b, s, c);
            if (got !== want) fail(where + ': cutRefuse(' + c + ') = ' + got + ', expected ' + want + ' (the line covers y ' + yLo + '…' + yHi + ')');
            if (!want){
              good++;
              const pc = D.cutPieces(b, h, s, c);
              const moved = pc.moved.map(p => [p[0] + b, p[1]]), all = pc.stay.concat(moved);
              const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
              const ok = Math.abs(polyAreaRef(pc.moved) + polyAreaRef(pc.stay) - A) < EPS && Math.abs(A - b * h) < EPS
                && Math.min(...xs) === c && Math.max(...xs) === c + b && Math.min(...ys) === 0 && Math.max(...ys) === h
                && key(pc.rect) === key([[c, 0], [c + b, 0], [c + b, h], [c, h]])
                && pc.moved.some(p => p[0] === 0 && p[1] === 0) && pc.moved.some(p => p[0] === s && p[1] === h)
                && pc.stay.some(p => p[0] === b && p[1] === 0) && pc.stay.some(p => p[0] === b + s && p[1] === h);
              if (!ok) fail(where + ': cutPieces(' + c + ') — the two pieces do not make a ' + b + ' × ' + h + ' rectangle when the left one moves over by ' + b);
            } else {
              (want === 'left' ? left++ : right++);
              const cn = D.cutCorner(b, h, s, c), cys = cn.map(p => p[1]);
              const exp = c < s ? [[0, 0], [c, 0], [c, c * h / s]] : [[c, (c - b) * h / s], [c, h], [b + s, h]];
              if (key(cn) !== key(exp)) fail(where + ': cutCorner(' + c + ') is not the corner the line cuts off');
              if (!(Math.max(...cys) - Math.min(...cys) < h - EPS)) fail(where + ': the "only a corner" piece spans the whole height — the reason would be false');
            }
          }
          if (!(good >= 1 && left >= 1 && right >= 1)) fail(where + ': needs good lines and corner-only lines on both sides (' + good + '/' + left + '/' + right + ')');
          /* cutPick：整片畫板每 0.5px，和這裡自己的「最近的直線、在 tol 以內、在上下範圍裡」比 */
          let bad = 0;
          for (let y = C.oy - h * U - 20; y <= C.oy + 20 && bad < 3; y += 3){
            for (let x = 0; x <= W && bad < 3; x += 0.5){
              let want = null, bd = Infinity;
              if (y >= C.oy - h * U - C.tol && y <= C.oy + C.tol)
                for (let c = 1; c < b + s; c++){ const dd = Math.abs(x - (ox + c * U)); if (dd <= C.tol && dd < bd){ bd = dd; want = c; } }
              const got = D.cutPick(b, h, s, { x, y });
              if (got !== want){ bad++; fail(where + ': cutPick(' + x + ', ' + y + ') = ' + got + ', expected ' + want); }
            }
          }
          /* 自然動作：每一條線上、線的上下兩端與中間都點得到它；格子正中間點不到任何一條 */
          for (let c = 1; c < b + s; c++){
            const x = ox + c * U;
            [C.oy, C.oy - h * U / 2, C.oy - h * U, C.oy - 0.15 * h * U, C.oy - 0.85 * h * U].forEach(y => { if (D.cutPick(b, h, s, { x, y }) !== c) fail(where + ': a tap on line ' + c + ' at y ' + y + ' does not pick it'); });
            if (D.cutPick(b, h, s, { x:x + U / 2, y:C.oy - U / 2 }) !== null) fail(where + ': a tap in the middle of a cell cuts a line');
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gCutDone', L, d.gCutDone(b, h), [b, h, b, h, b * h]);
            say(where + ' gCutNow', L, d.gCutNow(b, h), [b, h, b * h]);
            has(where + ' gCutNow', L, d.gCutNow(b, h), { zh:['長方形'], en:['Rectangle'] });
          });
        });
        if (lines < 60) fail('GAME cut: only ' + lines + ' cut lines checked');
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gCutBad left', L, d.gCutBad('left'), []); say('gCutBad right', L, d.gCutBad('right'), []);
          has('gCutBad left', L, d.gCutBad('left'), { zh:['左下角', '沒有從上面的邊剪到下面的邊', '高'], en:['bottom-left', 'doesn’t run from the top side to the bottom side', 'height'] });
          has('gCutBad right', L, d.gCutBad('right'), { zh:['右上角', '沒有從上面的邊剪到下面的邊'], en:['top-right', 'doesn’t run from the top side to the bottom side'] });
          hasNot('gCutBad left', L, d.gCutBad('left'), { zh:['右上角'], en:['top-right'] });
          hasNot('gCutBad right', L, d.gCutBad('right'), { zh:['左下角'], en:['bottom-left'] });
          has('gCutDone', L, d.gCutDone(5, 4), { zh:['長方形', '底 × 高'], en:['rectangle', 'base × height'] });
          if (typeof d.gCutNow0 !== 'string' || nums(d.gCutNow0).length) fail('GAME gCutNow0 ' + L + ' should be a plain "not cut yet"');
          has('gCut2', L, d.gCut2, { zh:['左上角', '高'], en:['top-left', 'height'] });
          say('gCut2', L, d.gCut2, [2]);
        });
        need('cut', /var c = cutPick\(b, h, s, pt\);\s*if \(c === null\) return;\s*var bad = cutRefuse\(b, s, c\);\s*if \(bad\)\{\s*corner\.setAttribute\('points', poly\(cutCorner\(b, h, s, c\)\)\);/, 'cut: the tapped line is not the one judged (or its corner is not the one drawn red)');
        need('cut', /if \(badSeen\[c\]\)\{ if \(lastBad !== c\)\{ lastBad = c; roundAgain\(d\.gCutBad\(bad\)\); \} return; \}\s*badSeen\[c\] = true; lastBad = c;\s*roundMiss\(d\.gCutBad\(bad\)\);/, 'cut: a second tap on the same wrong line costs again (even after another line), or the reason does not match');
        need('cut', /var e = pick\(GAME_CUT\), b = e\[0\], h = e\[1\], s = e\[2\], lastBad = null, badSeen = \{\};/, 'cut: the explained wrong lines are not remembered per board');
        repeatRun('cut', RB.cut, 'c', 'gCutBad(bad)');
        need('cut', /var pc = cutPieces\(b, h, s, c\);/, 'cut: the pieces drawn are not cutPieces of the tapped line');
        need('cut', /g\.style\.transform = 'translate\(' \+ \(b \* CUT\.U\) \+ 'px,0px\)';/, 'cut: the piece does not slide by the base');
        need('cut', /line\.textContent = d\.gCutNow\(b, h\);\s*roundSolved\(d\.gCutDone\(b, h\)\);/, 'cut: the readout or the message is not about this parallelogram');
        need('cut', /if \(!cutRefuse\(b, s, c\)\)\{ ln\.setAttribute\('stroke', '#E8871E'\)/, 'cut: hint 2 does not make exactly the good lines glow');
        need('cut', /for \(var c = 1; c < b \+ s; c\+\+\)\{\s*var p0 = px\(c, 0\), p1 = px\(c, h\);/, 'cut: the dashed lines are not every vertical grid line inside the shape');
      }

      /* ================= 第 2 關：轉半圈 ================= */
      {
        const T = D.TURN, U = T.U;
        if (!(T.pad >= 8 && T.pad <= 20)) fail('GAME turn: the drop tolerance ' + T.pad + ' is out of 8~20');
        D.GAME_TURN.forEach(e => {
          const [b, a, h] = e, where = 'GAME turn [' + e + ']';
          if (!(isInt(b) && isInt(a) && isInt(h))) return fail(where + ': not whole numbers');
          if (!(a > 0 && a < b)) fail(where + ': turn: the apex must be above the base (0 < a < b)');
          if ((b * h) % 2) fail(where + ': turn: b × h must be even (half of it is said as a whole number)');
          const tri = D.turnTri(b, a, h);
          if (key(tri) !== key([[0, 0], [b, 0], [a, h]])) fail(where + ': turnTri is not the drawn triangle');
          /* 沒有直角：90° 轉過去的三角形不可能剛好有一條邊和原來的對上（那句「邊對不上」才是真的） */
          const V = tri.map(p => ({ x:p[0], y:p[1] }));
          for (let i = 0; i < 3; i++){ const o = V[i], p = V[(i + 1) % 3], q = V[(i + 2) % 3]; if (Math.abs((p.x - o.x) * (q.x - o.x) + (p.y - o.y) * (q.y - o.y)) < EPS) fail(where + ': turn: a right angle — a quarter turn could line a side up, and "the sides don’t line up" would be false'); }
          const ox = D.turnOx(a), lo = ox + (a - b) * U, hi = ox + (a + b) * U;
          if (!(lo >= 10 && hi <= W - 10)) fail(where + ': turn: the picture does not fit the board (' + lo + '…' + hi + ')');
          const S = D.turnSq(b, h);
          if (!(S >= Math.max(b, h) * U - EPS)) fail(where + ': turn: the piece does not fit its square (' + S + ')');
          tooSmall('turn piece [' + e + ']', S);
          const home = box(T.ax, T.homeY, S, S);
          inside(home, 'turn tray piece [' + e + ']', D.TURN_H);
          if (!(home.y >= T.oy + 30)) fail(where + ': turn: the tray piece overlaps the triangle or its labels (top ' + home.y + ')');
          ['L', 'R'].forEach(side => {
            const want = rot180(tri, side === 'R' ? [(a + b) / 2, h / 2] : [a / 2, h / 2]);
            const got = D.turnCopy(b, a, h, side);
            if (key(got) !== key(want)) fail(where + ': turnCopy(' + side + ') is not the triangle turned half a turn about the middle of that side');
            /* 兩個合起來是平行四邊形：四個不同的頂點，兩組對邊平行且一樣長，面積 b × h */
            const pts = []; tri.concat(got).forEach(p => { if (!pts.some(q => q[0] === p[0] && q[1] === p[1])) pts.push(p); });
            if (pts.length !== 4 || Math.abs(polyAreaRef(tri) + polyAreaRef(got) - b * h) > EPS) fail(where + ': side ' + side + ' — the two triangles do not make a parallelogram of area ' + b * h);
            const cx = got.reduce((s0, p) => s0 + p[0], 0), xs = got.map(p => p[0]);
            const c = D.turnCenter(b, a, h, side), wantC = D.turnPt(a, (Math.min(...xs) + Math.max(...xs)) / 2, h / 2);
            if (Math.abs(c.x - wantC.x) > EPS || Math.abs(c.y - wantC.y) > EPS) fail(where + ': turnCenter(' + side + ') is not the centre of the copy’s box — the locked piece would not sit on it');
            if (!isFinite(cx)) fail(where + ': bad copy');
            /* 0° 放在那裡：方向一樣的三角形（平移）不是那一個 */
            const shifted = tri.map(p => [p[0] + (Math.min(...xs) - 0), p[1]]);
            if (key(shifted) === key(want)) fail(where + ': a same-way triangle would fit — "it hasn’t turned" would be false');
            /* 90°、270°：繞著盒子中心轉，和該放的那一個不一樣 */
            [1, 3].forEach(r => {
              const m = [(Math.min(...xs) + Math.max(...xs)) / 2, h / 2];
              const tb = tri.map(p => [p[0] - b / 2 + m[0], p[1] - h / 2 + m[1]]);
              const turned = tb.map(p => { const dx = p[0] - m[0], dy = p[1] - m[1]; return r === 1 ? [m[0] + dy, m[1] - dx] : [m[0] - dy, m[1] + dx]; });
              if (key(turned) === key(want)) fail(where + ': a quarter turn would fit on side ' + side);
            });
          });
          /* turnPick：整片畫板每 1px，和這裡自己的「到兩個該放的三角形的距離」比 */
          const P = side => D.turnCopy(b, a, h, side).map(q => ({ x:ox + q[0] * U, y:T.oy - q[1] * U }));
          let bad = 0;
          for (let y = 0; y <= D.TURN_H && bad < 3; y += 1){
            for (let x = 0; x <= W && bad < 3; x += 1){
              let want = null, bd = Infinity, bc = Infinity, edge = false;
              const ds = ['L', 'R'].map(side => {
                const Q = P(side), d0 = triDistRef({ x, y }, Q), m = { x:(Q[0].x + Q[1].x + Q[2].x) / 3, y:(Q[0].y + Q[1].y + Q[2].y) / 3 }, dc = Math.hypot(x - m.x, y - m.y);
                if (Math.abs(d0 - T.pad) < 1e-6) edge = true;   /* 剛好在範圍的邊上：浮點誤差，兩種答案都對 */
                if (d0 > T.pad) return [d0, dc];
                if (d0 < bd - 1e-9 || (Math.abs(d0 - bd) <= 1e-9 && dc < bc)){ bd = d0; bc = dc; want = side; }
                return [d0, dc];
              });
              if (edge || (Math.abs(ds[0][0] - ds[1][0]) < 1e-6 && Math.abs(ds[0][1] - ds[1][1]) < 1e-6)) continue;   /* 兩邊一樣近：哪一邊都對 */
              const got = D.turnPick(b, a, h, { x, y });
              if (got !== want){ bad++; fail(where + ': turnPick(' + x + ', ' + y + ') = ' + got + ', expected ' + want); }
            }
          }
          /* 拿起來的地方不是目標；原來那一個的正中間（疊在上面）也不是 */
          if (D.turnPick(b, a, h, { x:T.ax, y:T.homeY }) !== null) fail(where + ': the tray spot counts as a drop on the triangle');
          const g0 = { x:ox + (b + a) / 3 * U, y:T.oy - h / 3 * U };
          if (D.turnPick(b, a, h, g0) !== null) fail(where + ': a drop right on top of the triangle (its centre) counts as putting it beside it');
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gTurnDone', L, d.gTurnDone(b, h), [b, h, b * h, b * h, 2, b * h / 2]);
            has(where + ' gTurnDone', L, d.gTurnDone(b, h), { zh:['平行四邊形', '一半'], en:['parallelogram', 'half'] });
          });
        });
        [0, 1, 2, 3, 4, 5, 6, 7, -1, -2].forEach(r => {
          const m = ((r % 4) + 4) % 4, want = m === 2 ? null : (m === 0 ? 'same' : 'quarter');
          if (D.turnRefuse(r) !== want) fail('GAME turnRefuse(' + r + ') = ' + D.turnRefuse(r) + ', expected ' + want);
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          [90, 270].forEach(deg => { say('gTurnQuarter', L, d.gTurnQuarter(deg), [deg, 180]); has('gTurnQuarter', L, d.gTurnQuarter(deg), { zh:['對不上', '半圈'], en:['don’t line up', 'half a turn'] }); });
          say('gTurnSame', L, d.gTurnSame, []);
          has('gTurnSame', L, d.gTurnSame, { zh:['不是平行四邊形', '轉半圈'], en:['don’t make a parallelogram', 'half a turn'] });
          [0, 90, 180, 270].forEach(deg => {
            say('gTurnNow', L, d.gTurnNow(deg), [deg]);
            if (d.gTurnNow(deg) !== (L === 'zh' ? '↻ 轉了 ' + deg + '°' : '↻ turned ' + deg + '°')) fail('GAME gTurnNow ' + L + ' should read the angle turned: "' + d.gTurnNow(deg) + '"');
            const t = d.gTurn2(deg);
            say('gTurn2(' + deg + ')', L, t, deg === 180 ? [2, 180] : [2, deg, 180]);
            if (deg === 180){ hasNot('gTurn2(180)', L, t, { zh:['要轉到'], en:['turn it to'] }); has('gTurn2(180)', L, t, { zh:['已經倒過來'], en:['already upside down'] }); }
            else has('gTurn2(' + deg + ')', L, t, { zh:['要轉到 180°'], en:['turn it to 180°'] });
          });
          say('gTurnBtn', L, d.gTurnBtn, [90]);
        });
        need('turn', /var side = turnPick\(b, a, h, pt\);\s*if \(!side\) return false;\s*var bad = turnRefuse\(Q\.rot\);\s*if \(bad\)\{ roundMiss\(bad === 'same' \? d\.gTurnSame : d\.gTurnQuarter\(Q\.rot \* 90\)\); return false; \}\s*var c = turnCenter\(b, a, h, side\);\s*Q\.lock\(c\.x, c\.y\);/, 'turn: the orientation judged is not the piece’s, the side judged is not where it was dropped, or the reason does not match');
        need('turn', /var P = addPiece\(B, \{ w:S, h:S, cx:TURN\.ax, cy:TURN\.homeY, cls:'gtri', node:pieceSvg \}\);/, 'turn: the piece is not the square drawn in the tray');
        need('turn', /return \{ x:S \/ 2 \+ \(q\[0\] - b \/ 2\) \* U, y:S \/ 2 - \(q\[1\] - h \/ 2\) \* U \};/, 'turn: the piece’s triangle is not drawn centred in its square at the same size');
        need('turn', /P\.turn\(\);\s*line\.textContent = d\.gTurnNow\(P\.rot \* 90\);/, 'turn: ↻ does not turn the piece and show the angle');
        need('turn', /gCtx\.hint2 = function\(\)\{ return d\.gTurn2\(P\.rot \* 90\); \};/, 'turn: hint 2 does not follow the current angle');
        need('turn', /roundSolved\(d\.gTurnDone\(b, h\)\);/, 'turn: the message is not about this triangle');
      }

      /* ================= 第 3 關：梯形公式 ================= */
      {
        const T = D.TRAP;
        if (D.TRAP_KEYS.join() !== 't,d,h,L') fail('GAME TRAP_KEYS should be t,d,h,L');
        D.GAME_TRAP.forEach(e => {
          const [t, dd, p, h] = e, where = 'GAME trap [' + e + ']';
          const L2 = p * p + h * h, Lr = Math.round(Math.sqrt(L2));
          if (Lr * Lr !== L2) fail(where + ': trap: the slanted side √(' + p + '² + ' + h + '²) is not a whole number — the card would not be the drawn length');
          if (D.trapLeg(p, h) !== Lr) fail(where + ': trapLeg(' + p + ', ' + h + ') = ' + D.trapLeg(p, h) + ', expected ' + Lr);
          if (!(t < dd && p >= 1 && dd - t - p >= 1)) fail(where + ': trap: the right slanted side must lean outwards too (d − t − p ≥ 1)');
          const vals = [t, dd, h, Lr];
          if (new Set(vals).size !== 4) fail(where + ': trap: four different cards are needed (t, d, h, L = ' + vals + ')');
          if (((t + dd) * h) % 2) fail(where + ': trap: the area is not a whole number');
          const ox = D.trapOx(dd);
          if (!(ox >= 30 && ox + dd * T.U <= W - 10)) fail(where + ': trap: the picture does not fit (needs room for the slanted-side label on the left)');
          if (!(T.oy - h * T.U - 8 - 17 >= 2 && T.oy + 22 + 5 <= T.slotY - 2)) fail(where + ': trap: the labels do not fit above / below the trapezoid');
          if (key(D.trapShape(e)) !== key([[0, 0], [dd, 0], [p + t, h], [p, h]])) fail(where + ': trapShape is not the drawn trapezoid');
          const cards = D.trapCards(e);
          if (cards.map(c => c.k + c.v).join() !== ['t' + t, 'd' + dd, 'h' + h, 'L' + Lr].join()) fail(where + ': trapCards is not top, bottom, height, slanted side');
          unsortedOk('trap [' + e + ']', () => D.trapTray(e), l => (l[0].k === 't' || l[0].k === 'd') && (l[1].k === 't' || l[1].k === 'd') && l[2].k === 'h');
          for (let i = 0; i < 200; i++){ const r = D.trapTray(e); if (r.map(c => c.k).sort().join() !== 'L,d,h,t'){ fail(where + ': trapTray is not the four cards'); break; } }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gTrapDone', L, d.gTrapDone(t, dd, h), [t, dd, t + dd, h, t, dd, h, (t + dd) * h, (t + dd) * h, 2, (t + dd) * h / 2]);
            say(where + ' gTrapDoneNow', L, d.gTrapDoneNow((t + dd) * h / 2), [(t + dd) * h / 2]);
            has(where + ' gTrapDoneNow', L, d.gTrapDoneNow((t + dd) * h / 2), { zh:['梯形面積是'], en:['Trapezoid area'] });
            say(where + ' gTrap2Base', L, d.gTrap2Base(t, dd), [2, t, dd]);
            say(where + ' gTrap2H', L, d.gTrap2H(h), [2, h]);
            [['h', h], ['L', Lr]].forEach(([k, v]) => {
              const s = d.gTrapNotBase(v, k);
              say(where + ' gTrapNotBase ' + k, L, s, [v]);
              has(where + ' gTrapNotBase ' + k, L, s, k === 'h' ? { zh:['是高'], en:['is the height'] } : { zh:['斜斜的邊'], en:['slanted side'] });
              hasNot(where + ' gTrapNotBase ' + k, L, s, k === 'h' ? { zh:['斜'], en:['slanted'] } : { zh:['是高'], en:['is the height'] });
            });
            [['t', t], ['d', dd], ['L', Lr]].forEach(([k, v]) => {
              const s = d.gTrapNotH(v, k);
              say(where + ' gTrapNotH ' + k, L, s, [v]);
              const own = { t:{ zh:['是上底'], en:['is the top base'] }, d:{ zh:['是下底'], en:['is the bottom base'] }, L:{ zh:['是斜邊'], en:['is the slanted side'] } }[k];
              has(where + ' gTrapNotH ' + k, L, s, own);
              ['t', 'd', 'L'].filter(o => o !== k).forEach(o => hasNot(where + ' gTrapNotH ' + k, L, s, { zh:[{ t:'是上底', d:'是下底', L:'是斜邊' }[o]], en:[{ t:'is the top base', d:'is the bottom base', L:'is the slanted side' }[o]] }));
            });
            const OKW = { t:{ zh:'是上底 ✓', en:'is the top base ✓' }, d:{ zh:'是下底 ✓', en:'is the bottom base ✓' }, h:{ zh:'是高 ✓', en:'is the height ✓' } };
            [['t', t], ['d', dd], ['h', h]].forEach(([k, v]) => {
              const s0 = d.gTrapOk(v, k);
              say(where + ' gTrapOk ' + k, L, s0, [v]);
              if (s0 !== v + ' ' + OKW[k][L]) fail(where + ' gTrapOk ' + k + ' ' + L + ' should read "' + v + ' ' + OKW[k][L] + '", got "' + s0 + '"');
            });
          });
        });
        /* 每一格 × 每一種卡 */
        [0, 1, 2].forEach(i => D.TRAP_KEYS.forEach(k => {
          const want = (i < 2 ? (k === 't' || k === 'd') : k === 'h') ? null : k;
          if (D.trapRefuse(i, k) !== want) fail('GAME trapRefuse(' + i + ', ' + k + ') = ' + D.trapRefuse(i, k) + ', expected ' + want);
        }));
        /* 版面：公式一排（括號、格子、符號）左右不重疊、照順序；說明在格子下面；卡片不重疊、拿得到 */
        const row = [];
        D.TRAP_SYMS.forEach(sy => row.push({ x:sy[1] - sy[2] / 2, y:T.slotY, w:sy[2], h:T.slotH, t:sy[0] }));
        T.slotX.forEach((x, i) => row.push({ x:x - T.slotW / 2, y:T.slotY, w:T.slotW, h:T.slotH, t:'slot' + i }));
        row.sort((a, b) => a.x - b.x);
        if (row.map(r => r.t).join() !== '(,slot0,+,slot1,),×,slot2,÷ 2') fail('GAME trap: the formula row should read ( □ + □ ) × □ ÷ 2, got ' + row.map(r => r.t).join(' '));
        noHits(row, 'trap: slots overlap or a symbol overlaps a slot —');
        row.forEach(r => inside(r, 'trap formula "' + r.t + '"', D.TRAP_H));
        D.TRAP_SYMS.forEach(sy => { if (!(sy[2] >= sy[0].replace(/ /g, '').length * 13 + 2)) fail('GAME trap: the symbol "' + sy[0] + '" box is too narrow'); });
        const caps = [{ x:T.slotX[0] - T.slotW / 2, y:T.capY, w:T.slotX[1] - T.slotX[0] + T.slotW, h:T.capH }, { x:T.slotX[2] - T.slotW / 2 - 10, y:T.capY, w:T.slotW + 20, h:T.capH }];
        caps.forEach((c, i) => { inside(c, 'trap caption ' + i, D.TRAP_H); if (!(c.y >= T.slotY + T.slotH + 2)) fail('GAME trap: a caption overlaps the slots'); });
        if (!(T.capH >= 22)) fail('GAME trap: the caption box (' + T.capH + ') is too short for a line of 13px text');
        const cardBoxes = T.cardX.map(x => box(x, T.cardY, T.cardW, T.cardH));
        noHits(cardBoxes, 'trap: cards overlap —');
        noHits(cardBoxes.concat(caps), 'trap: a card overlaps a caption —');
        cardBoxes.forEach((c, i) => inside(c, 'trap card ' + i, D.TRAP_H));
        tooSmall('trap card', Math.min(T.cardW, T.cardH)); tooSmall('trap slot', Math.min(T.slotW, T.slotH));
        if (nearestOpen){
          const sl = T.slotX.map((x, i) => ({ i, cx:x, cy:T.slotY + T.slotH / 2, hw:T.slotW / 2, hh:T.slotH / 2 }));
          sl.forEach(s => [[0, 0], [-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35]].forEach(([fx, fy]) => {
            const g = nearestOpen(sl, { x:s.cx + fx * T.slotW, y:s.cy + fy * T.slotH }, T.pad);
            if (g !== s) fail('GAME trap: a drop at ' + fx + ', ' + fy + ' of slot ' + s.i + ' does not land in it');
          }));
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          say('gTrapNow', L, d.gTrapNow(2), [2, 3]);
          if (d.gTrapCapH !== (L === 'zh' ? '高' : 'height')) fail('GAME gTrapCapH ' + L + ' should read "' + (L === 'zh' ? '高' : 'height') + '"');
          if (d.gTrapCapBase !== (L === 'zh' ? '上底 ＋ 下底' : 'top + bottom')) fail('GAME gTrapCapBase ' + L + ' should read the two bases');
        });
        need('trap', /var sl = nearestOpen\(slots, pt, TRAP\.pad\);\s*if \(!sl\) return false;\s*var bad = trapRefuse\(sl\.i, P\.data\.k\);\s*if \(bad\)\{ roundMiss\(sl\.i < 2 \? d\.gTrapNotBase\(P\.data\.v, bad\) : d\.gTrapNotH\(P\.data\.v, bad\)\); return false; \}/, 'trap: the card judged is not the one dropped, the slot judged is not the one it landed in, or the reason does not match');
        need('trap', /sl\.done = true;\s*sl\.z\.textContent = P\.data\.v;/, 'trap: a filled slot is not marked done, or does not show the card that was placed');
        need('trap', /done\+\+;\s*if \(done === slots\.length\)\{ line\.textContent = d\.gTrapDoneNow\(area\); roundSolved\(d\.gTrapDone\(t, dd, h\)\); \}/, 'trap: the round is not solved exactly when all three slots are filled');
        need('trap', /addPiece\(B, \{ w:TRAP\.cardW, h:TRAP\.cardH, cx:TRAP\.cardX\[j\], cy:TRAP\.cardY, text:String\(cd\.v\), cls:'gcard gnumcard', data:\{ k:cd\.k, v:cd\.v \} \}\);/, 'trap: a card does not show the value it is judged by');
        need('trap', /trapTray\(e\)\.forEach/, 'trap: the tray is not shuffled with trapTray');
      }

      /* ================= 第 4 關：分一分 ================= */
      {
        const S = D.SORT;
        D.GAME_SORT.forEach((e, ei) => {
          const A = e[0], cs = e[1], where = 'GAME sort [' + A + ']';
          if (cs.length !== 4) fail(where + ': 4 cards per set');
          const kinds = cs.map(c => c[0]).sort().join();
          if (kinds !== 'para,trap,tri,tri') fail(where + ': sort: one parallelogram, one trapezoid, two triangles per set (' + kinds + ')');
          const own = c => c[0] === 'tri' ? c[1] * c[2] / 2 : c[0] === 'para' ? c[1] * c[2] : (c[1] + c[2]) * c[3] / 2;
          cs.forEach(c => {
            if (D.sortArea(c) !== own(c)) fail(where + ': sortArea(' + c + ') = ' + D.sortArea(c) + ', expected ' + own(c));
            if (!isInt(own(c))) fail(where + ': card ' + c + ' has a non-whole area');
            const f = D.sortFormula(c), fw = c[0] === 'tri' ? c[1] + ' × ' + c[2] + ' ÷ 2' : c[0] === 'para' ? c[1] + ' × ' + c[2] : '(' + c[1] + ' + ' + c[2] + ') × ' + c[3] + ' ÷ 2';
            if (f !== fw) fail(where + ': sortFormula(' + c + ') is "' + f + '", expected "' + fw + '"');
            if (arithGame(f + ' = ' + own(c)).problems.length) fail(where + ': the formula ' + f + ' is not ' + own(c));
            if (c[0] === 'tri' && !(c[3] > 0 && c[3] < c[1])) fail(where + ': sort: the apex of ' + c + ' is not above the base (the height foot must fall on the base)');
            if (c[0] === 'para'){
              const L2 = c[3] * c[3] + c[2] * c[2], Lr = Math.round(Math.sqrt(L2));
              if (Lr * Lr !== L2 || D.sortSlant(c) !== Lr) fail(where + ': sort: the parallelogram slanted side is not a whole number drawn to scale');
              if (Lr === c[2] || Lr === c[1]) fail(where + ': the slanted side equals another label');
            }
            if (c[0] === 'trap' && !(c[1] < c[2] && c[4] >= 1 && c[2] - c[1] - c[4] >= 0)) fail(where + ': trapezoid ' + c + ' is not drawable (top shorter, legs leaning out)');
            if (key(D.sortShape(c)) !== key(c[0] === 'tri' ? [[0, 0], [c[1], 0], [c[3], c[2]]] : c[0] === 'para' ? [[0, 0], [c[1], 0], [c[1] + c[3], c[2]], [c[3], c[2]]] : [[0, 0], [c[2], 0], [c[4] + c[1], c[3]], [c[4], c[3]]])) fail(where + ': sortShape(' + c + ') is not the shape');
          });
          if (cs.filter(c => own(c) === A).length !== 2 || cs.filter(c => own(c) === 2 * A).length !== 2) fail(where + ': sort: two cards per box (A = ' + A + ', areas ' + cs.map(own) + ')');
          /* 迷思誘答：同底同高的三角形（A）、平行四邊形（2A）、梯形（A）—— 忘了除以 2／多除了 2 會剛好掉進另一個箱子 */
          const tri = cs.filter(c => c[0] === 'tri' && own(c) === A)[0], para = cs.filter(c => c[0] === 'para')[0], trap = cs.filter(c => c[0] === 'trap')[0];
          if (!tri || !para || own(para) !== 2 * A || tri[1] !== para[1] || tri[2] !== para[2]) fail(where + ': sort: the set needs a triangle and a parallelogram with the same base and height (A and 2A)');
          if (!trap || own(trap) !== A) fail(where + ': sort: the forgot-÷2 trap — the trapezoid must have area A so that forgetting ÷ 2 lands in the 2A box');
          cs.forEach(c => [A, 2 * A].forEach(bin => {
            const a = own(c), want = a === bin ? null : (c[0] !== 'para' && a * 2 === bin ? 'half' : (c[0] === 'para' && a / 2 === bin ? 'whole' : 'other'));
            const got = D.sortRefuse(c, bin);
            if (got !== want) fail(where + ': sortRefuse(' + c + ', ' + bin + ') = ' + got + ', expected ' + want);
            if (!want) return;
            /* 「別忘了除以 2」只在不除以 2 的算式剛好是箱子時說；「不用除以 2」只在平行四邊形除了 2 剛好是箱子時說 */
            const noHalf = c[0] === 'tri' ? c[1] * c[2] : c[0] === 'trap' ? (c[1] + c[2]) * c[3] : null;
            if ((want === 'half') !== (noHalf === bin)) fail(where + ': "don’t forget ÷ 2" for ' + c + ' in box ' + bin + ' would be ' + (want === 'half' ? 'false' : 'missing'));
            if ((want === 'whole') !== (c[0] === 'para' && c[1] * c[2] / 2 === bin)) fail(where + ': "a parallelogram doesn’t need ÷ 2" for ' + c + ' would be wrong');
            LANGS.forEach(L => {
              const d = I18N[L], s = d.gSortBad(d.gShapes[c[0]], D.sortFormula(c), a, bin, want);
              say(where + ' gSortBad ' + c + ' → ' + bin, L, s, nums(D.sortFormula(c)).concat([a, bin], want === 'other' ? [] : [2]));
              const half = { zh:['別忘了除以 2'], en:['don’t forget to divide by 2'] }, whole = { zh:['平行四邊形不用除以 2'], en:['a parallelogram doesn’t need ÷ 2'] };
              if (want === 'half'){ has(where + ' gSortBad', L, s, half); hasNot(where + ' gSortBad', L, s, whole); }
              else if (want === 'whole'){ has(where + ' gSortBad', L, s, whole); hasNot(where + ' gSortBad', L, s, half); }
              else { hasNot(where + ' gSortBad', L, s, half); hasNot(where + ' gSortBad', L, s, whole); }
              if (s.indexOf(d.gShapes[c[0]]) !== 0) fail(where + ': gSortBad ' + L + ' does not start with the shape name');
            });
          }));
          LANGS.forEach(L => {
            const d = I18N[L];
            cs.forEach(c => {
              const s0 = d.gSortOk(d.gShapes[c[0]], D.sortFormula(c), own(c));
              say(where + ' gSortOk', L, s0, nums(D.sortFormula(c)).concat([own(c)]));
              if (s0.indexOf(d.gShapes[c[0]]) !== 0 || !/✓$/.test(s0)) fail(where + ' gSortOk ' + L + ': should start with the shape name and end with ✓: "' + s0 + '"');
              hasNot(where + ' gSortOk', L, s0, { zh:['不是', '錯'], en:['not', 'wrong', 'Incorrect'] });
            });
            say(where + ' gSort2', L, d.gSort2(D.sortFormula(cs[0]), own(cs[0])), [2].concat(nums(D.sortFormula(cs[0])), [own(cs[0])]));
            [A, 2 * A].forEach(v => say(where + ' gBin', L, d.gBin(v), [v]));
          });
          const inOrder = l => own(l[0]) === A && own(l[1]) === A;
          unsortedOk('sort [' + A + ']', () => D.sortTray(e), inOrder);
          for (let i = 0; i < 200; i++){ const r = D.sortTray(e); if (r.length !== 4 || key(r.map(c => [cs.indexOf(c), 0])) !== key([[0, 0], [1, 0], [2, 0], [3, 0]])){ fail(where + ': sortTray is not the four cards'); break; } }
          if (ei === 0 && D.sortInOrder(A)([cs.filter(c => own(c) === A)[0], cs.filter(c => own(c) === A)[1], cs[0], cs[1]]) !== true) fail('GAME sortInOrder(): does not recognise the answer order');
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          if (JSON.stringify(d.gShapes) !== JSON.stringify(L === 'zh' ? { tri:'三角形', para:'平行四邊形', trap:'梯形' } : { tri:'Triangle', para:'Parallelogram', trap:'Trapezoid' })) fail('GAME gShapes ' + L + ' does not name the three shapes right');
          say('gSortNow', L, d.gSortNow(3, 4), [3, 4]);
          say('gSortDone', L, d.gSortDone, [2]);
          has('gSortDone', L, d.gSortDone, { zh:['平行四邊形不用'], en:['parallelograms don’t'] });
        });
        /* 版面：托盤四張不重疊、箱子在畫板裡、兩個箱子的放寬範圍重疊（e2e 要在重疊處放）、箱子裡的算式不蓋到標籤 */
        const cards = []; for (let j = 0; j < 4; j++) cards.push(box(S.trayX[j % 2], S.trayY[Math.floor(j / 2)], S.cardW, S.cardH));
        noHits(cards, 'sort: tray cards overlap —'); cards.forEach((c, i) => inside(c, 'sort card ' + i, D.SORT_H));
        tooSmall('sort card', Math.min(S.cardW, S.cardH));
        const bins = S.binX.map(x => ({ x, y:S.binY, w:S.binW, h:S.binH }));
        bins.forEach((b, i) => inside(b, 'sort box ' + i, D.SORT_H));
        noHits(bins.concat(cards), 'sort: a box overlaps a tray card —');
        const gap = S.binX[1] - (S.binX[0] + S.binW);
        if (!(gap >= 0 && gap < 2 * S.pad)) fail('GAME sort: the boxes do not overlap when widened (gap ' + gap + ', pad ' + S.pad + ') — the nearest-box rule is never exercised');
        bins.forEach((b, i) => {
          const lbl = { x:b.x + 4, y:b.y + 4, w:b.w - 8, h:S.lblH };
          S.chipY.forEach((cy, k) => {
            const ch = box(b.x + b.w / 2, cy, S.chipW, S.chipH);
            if (!(ch.x >= b.x + 3 && ch.x + ch.w <= b.x + b.w - 3 && ch.y + ch.h <= b.y + b.h - 3)) fail('GAME sort: chip ' + k + ' sticks out of box ' + i);
            if (!(ch.y >= lbl.y + lbl.h + 2)) fail('GAME sort: a chip covers the box label (chip ' + k + ' top ' + ch.y + ', label bottom ' + (lbl.y + lbl.h) + ')');
          });
          if (!(S.chipY[1] - S.chipY[0] >= S.chipH + 2)) fail('GAME sort: the two chips in a box overlap');
        });
        if (nearestOpen){
          const bz = bins.map((b, i) => ({ i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2 }));
          const g = nearestOpen(bz, { x:S.binX[1] - 2, y:S.binY + S.binH / 2 }, S.pad);
          if (!g || g.i !== 1) fail('GAME sort: a drop 2px left of the right box (inside both widened zones) does not go to the nearer (right) box');
        }
        need('sort', /var bin = nearestOpen\(bins, pt, SORT\.pad\);\s*if \(!bin\) return false;\s*var c = P\.data\.c, why = sortRefuse\(c, bin\.v\), name = d\.gShapes\[c\[0\]\];\s*if \(why\)\{ roundMiss\(d\.gSortBad\(name, sortFormula\(c\), sortArea\(c\), bin\.v, why\)\); return false; \}/, 'sort: the box judged is not the one dropped on, the card is not the one dropped, or the reason does not match');
        need('sort', /addZone\(B, SORT\.binX\[i\] \+ 4, SORT\.binY \+ 4, SORT\.binW - 8, SORT\.lblH, 'gbinlbl', d\.gBin\(v\)\);\s*return \{ v:v, i:i,/, 'sort: a box label does not show the area it is judged by');
        need('sort', /var cards = sortTray\(e\)\.map\(function\(c, j\)\{\s*return addPiece\(B, \{ w:SORT\.cardW, h:SORT\.cardH, cx:SORT\.trayX\[j % 2\], cy:SORT\.trayY\[Math\.floor\(j \/ 2\)\], cls:'gcard gshape', node:sortCardSvg\(c\),/, 'sort: a card does not show the picture it is judged by, or the tray is not shuffled');
        need('sort', /'gplaced', sortFormula\(c\)\);\s*bin\.n\+\+; done\+\+;\s*line\.textContent = d\.gSortNow\(done, cards\.length\);\s*if \(done === cards\.length\) roundSolved\(d\.gSortDone\);/, 'sort: a placed card does not show its formula, or the round is not solved exactly when all four cards are in');
        /* 卡片上的圖：形狀、高（虛線＋直角記號）、底、高、平行四邊形的斜邊、梯形的上底都要畫出來（標籤由上面「圖上的數字標籤」那一段驗） */
        const cardSrc = extractFunction(gsrc, 'sortCardSvg') || '';
        [/s\.appendChild\(svgEl\('polygon', \{ points:ptsAttr\(sc\.pts\)/, /gHeight\(s, sc\.top, sc\.foot, '#D64545', 6\);/]
          .forEach(re => { if (!re.test(cardSrc)) fail('GAME sort: the picture card no longer draws ' + re); });
        D.GAME_SORT.forEach(e => e[1].forEach(c => { const ks = D.sortScene(c).labels.map(l => l.k).sort().join(); const want = ['b', 'h'].concat(c[0] === 'para' ? ['L'] : c[0] === 'trap' ? ['t'] : []).sort().join(); if (ks !== want) fail('GAME sort ' + c + ': the card labels are ' + ks + ', expected ' + want); }));
      }

      /* ================= 第 5 關：拉高 ================= */
      {
        const P = D.PULL, U = P.U;
        if (!(P.hMin === 1 && P.hMax === 8 && P.h0 === P.hMin)) fail('GAME pull: heights should run 1~8 from 1');
        if (!(D.pullY(P.hMax) - D.GPICK / 2 >= 0)) fail('GAME pull: the handle runs off the top of the board at the top height');
        if (!(P.oy + 22 + 5 <= D.PULL_H)) fail('GAME pull: the base label does not fit');
        tooSmall('pull handle', D.GPICK);
        D.GAME_PULL.forEach(e => {
          const [b, a, A] = e, where = 'GAME pull [' + e + ']';
          if (b % 2) fail(where + ': pull: b must be even (b × h ÷ 2 is said as a whole number for every h)');
          if (!(a > 0 && a < b)) fail(where + ': the apex is not above the base');
          const hs = 2 * A / b;
          if (!(isInt(hs) && hs >= P.hMin && hs <= P.hMax)) fail(where + ': pull: the target height 2A ÷ b = ' + hs + ' is not a reachable grid line');
          if (hs === P.h0) fail(where + ': pull: the start already is the answer');
          const hf = A / b;
          if (!(isInt(hf) && hf >= P.hMin && hf !== hs)) fail(where + ': pull: the forgot-÷2 height A ÷ b = ' + hf + ' is not a reachable wrong height');
          const ox = D.pullOx(b);
          if (!(ox >= 20 && ox + b * U <= W - 20)) fail(where + ': pull: the picture does not fit');
          for (let h = P.hMin; h <= P.hMax; h++){
            const x = b * h / 2, got = D.pullRefuse(b, h, A);
            if (x === A){ if (got !== null) fail(where + ': pullRefuse(' + h + ') refuses the right height'); continue; }
            if (!got || got.x !== x || got.less !== (x < A) || got.forgot !== (b * h === A)) fail(where + ': pullRefuse(' + h + ') = ' + JSON.stringify(got));
            LANGS.forEach(L => {
              const s = I18N[L].gPullBad(b, h, x, A, x < A, b * h === A);
              say(where + ' gPullBad ' + h, L, s, [b, h, 2, x, A].concat(b * h === A ? [b, h, A, 2] : []));
              has(where + ' gPullBad ' + h, L, s, x < A ? { zh:['少'], en:['less'] } : { zh:['多'], en:['more'] });
              hasNot(where + ' gPullBad ' + h, L, s, x < A ? { zh:['多'], en:['more'] } : { zh:['少'], en:['less'] });
              (b * h === A ? has : hasNot)(where + ' gPullBad ' + h, L, s, { zh:['平行四邊形'], en:['parallelogram'] });
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            say(where + ' gPullDone', L, d.gPullDone(b, hs, A), [b, hs, 2, A, hs, A, 2, b, hs]);
            has(where + ' gPullDone', L, d.gPullDone(b, hs, A), { zh:['剛好'], en:['exactly right'] });
            hasNot(where + ' gPullDone', L, d.gPullDone(b, hs, A), { zh:['不', '少', '多'], en:['not', 'less', 'more'] });
            say(where + ' gPull2', L, d.gPull2(b, A), [2, b, 2, A, b, A, 2, 2 * A]);
            say(where + ' gAsks.pull', L, d.gAsks.pull(A), [A]);
            for (let h = 1; h <= 8; h++){ const s = d.gPullNow(b, h); say(where + ' gPullNow', L, s, [b, h]); if (s !== (L === 'zh' ? '底 ' + b + '　高 ' + h : 'base ' + b + ' · height ' + h)) fail(where + ' gPullNow ' + L + ' should read only the base and the height: "' + s + '"'); }
          });
        });
        /* pullH：每 0.25px，和這裡自己的「最近的一條橫線，夾在 1～8」比 */
        let bad = 0;
        for (let y = -40; y <= D.PULL_H + 40 && bad < 3; y += 0.25){
          const want = Math.max(P.hMin, Math.min(P.hMax, Math.round((P.oy - y) / U)));
          if (D.pullH(y) !== want){ bad++; fail('GAME pullH(' + y + ') = ' + D.pullH(y) + ', expected ' + want); }
        }
        for (let h = P.hMin; h <= P.hMax; h++){
          if (D.pullY(h) !== P.oy - h * U) fail('GAME pullY(' + h + ') is not the grid line');
          [0, 0.45, -0.45].forEach(f => { if (D.pullH(D.pullY(h) + f * U) !== h) fail('GAME pull: a tap ' + f + ' of a cell from grid line ' + h + ' does not pick it'); });
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          ['gPullBtn', 'gPullUp', 'gPullDown'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + k + ' missing in ' + L); });
          say('gPullUp', L, d.gPullUp, [1]); say('gPullDown', L, d.gPullDown, [1]);
          hasNot('gPullNow', L, d.gPullNow(6, 4), { zh:['面積'], en:['area'] });
        });
        need('pull', /var bad = pullRefuse\(b, hh, A\);\s*if \(bad\)\{\s*\/\*[^\n]*\*\/\s*if \(badSeen\[hh\]\)\{ if \(lastBad !== hh\)\{ lastBad = hh; roundAgain\(d\.gPullBad\(b, hh, bad\.x, A, bad\.less, bad\.forgot\)\); \} return; \}\s*badSeen\[hh\] = true; lastBad = hh;\s*roundMiss\(d\.gPullBad\(b, hh, bad\.x, A, bad\.less, bad\.forgot\)\);/, 'pull: the height judged is not the one shown, That’s it on the same height costs again (even after another height), or the reason does not match');
        need('pull', /var e = pick\(GAME_PULL\), b = e\[0\], a = e\[1\], A = e\[2\], U = PULL\.U, hh = PULL\.h0, lastBad = null, badSeen = \{\};/, 'pull: the judged heights are not remembered per board');
        repeatRun('pull', RB.pull, 'hh', 'gPullBad(b, hh, bad.x, A, bad.less, bad.forgot)');
        need('pull', /grip\.lock\(grip\.cx, grip\.cy\);\s*down\.disabled = up\.disabled = ok\.disabled = true;\s*roundSolved\(d\.gPullDone\(b, hh, A\)\);/, 'pull: the right height does not lock the corner, turn the buttons off and solve the round');
        need('pull', /if \(gSolved \|\| grip\.busy\(\)\) return;/, 'pull: That’s it judges while the corner is held');
        need('pull', /axis:'y', snapY:function\(y\)\{ return pullY\(pullH\(y\)\); \},\s*onPlace:function\(P\)\{ var nh = pullH\(P\.cy\); if \(nh !== hh\)\{ hh = nh; draw\(\); \} \} \}\);/, 'pull: the drawn height does not follow the handle');
        need('pull', /line\.textContent = d\.gPullNow\(b, hh\);/, 'pull: the readout is not the height being judged');
        need('pull', /gCtx\.ask\.textContent = d\.gAsks\.pull\(A\);/, 'pull: the question does not show the target');
        need('pull', /B\.onBoardTap = function\(pt\)\{[\s\S]{0,200}setH\(pullH\(pt\.y\)\);/, 'pull: tapping a grid line does not set the height');
        need('pull', /var sc = scenes\[hh\] \|\| \(scenes\[hh\] = pullScene\(b, a, hh\)\), top = sc\.top, foot = sc\.foot;[^\n]*\s*tri\.setAttribute\('points', ptsAttr\(\[b0, b1, top\]\)\);/, 'pull: the triangle drawn is not base b with the corner at height hh');
        D.GAME_PULL.forEach(([b, a]) => { for (let h = 1; h <= 8; h++){ const t = D.pullScene(b, a, h).top; if (t.x !== D.pullOx(b) + a * D.PULL.U || t.y !== D.pullY(h)) fail('GAME pullScene: the corner is not at (a, h)'); } });
      }
    }
  }
};
