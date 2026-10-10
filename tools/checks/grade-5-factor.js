/* grade-5/math/factor 的檢查設定（因數工廠：排長方形找因數、因數成雙成對、配到中間收工、1／質數／平方數、因數與倍數）。
   2026-10-10 新增 —— 和小遊戲「因數獵人」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔。

   sim（review.html 的十個產生器 —— 因數、倍數、公因數／公倍數三課交錯的複習）：每個產生器一組不變條件、
   正解的第二套實作（只用原始參數重算，不呼叫頁面的格式化函式）、選項的形狀。
   跑起來抓到的舊缺陷（都在 review.html 修掉，各有一筆 break）：
     - multiplesCount 的誘答把題幹的數字抄回來（k = 6、1～30 → 選項 6；k = 8、1～50 → 選項 8；§六之三第 4 點）；
     - concept 的正解永遠在第二個按鈕（「哪一句是錯的」永遠在第三個）—— 改成每一批洗一次；
     - concept 「哪一句是錯的」中英文的第四個選項意思不一樣（中文「24 的因數包含 8」和第一個選項是同一句話）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）裡的「a × b ＝ c」「a ÷ b ＝ q（餘 r）」逐條重算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍（排積木的每一種每排塊數、配對的每兩張卡、試除的每一個「下一個」× 每一個鈕、
     分類的每一張卡 × 每一個箱子、箭頭的每一列 × 每一張字卡），證明一定解得完、解完一定是對的；
     每一句說明兩種語言逐個比數字，而且它說的那件事要真的成立（「沒有超過」就真的 ≤、「除不盡」就真的有餘數……）；
     shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-factor 的端對端測試驗（合成 PointerEvent）。 */

const { extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number); }
function facRef(n){ const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; }
function isqrtRef(n){ let r = 0; while ((r + 1) * (r + 1) <= n) r++; return r; }
function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }
function kindRef(v){ const c = facRef(v).length; return c === 2 ? 'prime' : (c % 2 === 1 ? 'square' : 'other'); }
function relRef(a, b){ return b % a === 0 ? 'f' : (a % b === 0 ? 'm' : 'n'); }
function sameList(a, b){ return a.length === b.length && a.every((v, i) => v === b[i]); }

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果（餘 r）」找出來重算 */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷x] ?\d+)+) ?= ?(\d+)(?![\d.\/])(?:(?: ?餘 ?| r | remainder )(\d+))?/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1].replace(/x/g, '×'), got = +m[2], rem = m[3] === undefined ? null : +m[3];
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0){
      if (toks.length !== 3) bad = 'a division chained with other operations';
      else {
        const a = +toks[0], b = +toks[2], q = Math.floor(a / b), r = a % b;
        if (got !== q || (rem === null ? r !== 0 : rem !== r)) bad = 'should be ' + q + (r ? ' remainder ' + r : '');
      }
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
      if (rem !== null) bad = 'a remainder after a non-division';
      else if (want !== got) bad = 'should be ' + want;
    }
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}

const SEP = { zh:'、', en:', ' };

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲「因數獵人」—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['rect', 'pair', 'stop', 'sort', 'rel'];", replace:"var GAME_ORDER = ['pair', 'rect', 'stop', 'sort', 'rel'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 44;' },
    { file:'index', expect:'shuffle(): only', find:'      var k = Math.floor(Math.random() * (j + 1));   /* 自足', replace:'      var k = j;   /* 自足' },
    { file:'index', expect:'starts in the answer order', find:'    if (sorted) t.reverse();\n', replace:'' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'does not clear the hint', find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:'nearestOpen(): a point inside the big box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop nearest to a finished slot', find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:'' },
    { file:'index', expect:'second finger', find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:'losing pointer capture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'placed pieces still catch taps', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'does not snap', find:"      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);", replace:"      if (o.axis === 'x') P.place(orig.x + dx, orig.y);" },
    { file:'index', expect:'ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },

    /* 第 1 關：排積木 */
    { file:'index', expect:'rect: n should be', find:'var GAME_RECT = [14, 15, 21, 22];', replace:'var GAME_RECT = [14, 15, 21, 23];' },
    { file:'index', expect:'one long strip', find:'var GAME_RECT = [14, 15, 21, 22];', replace:'var GAME_RECT = [14, 15, 21, 10];' },
    { file:'index', expect:'the start already fills', find:'kMin:2, kMax:10, k0:4,', replace:'kMin:2, kMax:10, k0:7,' },
    { file:'index', expect:'rows of 2 do not fit', find:'var RECT = { x0:30, y0:56, pitch:24,', replace:'var RECT = { x0:30, y0:86, pitch:24,' },
    { file:'index', expect:'↔ runs off the board', find:'var RECT = { x0:30, y0:56, pitch:24, blk:20, kMin:2, kMax:10,', replace:'var RECT = { x0:30, y0:56, pitch:24, blk:20, kMin:2, kMax:11,' },
    { file:'index', expect:'blocks overlap', find:'pitch:24, blk:20,', replace:'pitch:24, blk:26,' },
    { file:'index', expect:'↔ covers the first row', find:'k0:4, handleY:26 }', replace:'k0:4, handleY:40 }' },
    { file:'index', expect:'rectK(', find:'Math.round((x - RECT.x0) / RECT.pitch))); }', replace:'Math.floor((x - RECT.x0) / RECT.pitch))); }' },
    { file:'index', expect:'rectCol(', find:'Math.floor((x - RECT.x0) / RECT.pitch) + 1); }', replace:'Math.round((x - RECT.x0) / RECT.pitch) + 1); }' },
    { file:'index', expect:'rectBlock(', find:'return { x:RECT.x0 + (i % k) * RECT.pitch', replace:'return { x:RECT.x0 + (i % (k + 1)) * RECT.pitch' },
    { file:'index', expect:'leftover blocks', find:'(RECT.pitch - RECT.blk) / 2, left:i >= full };', replace:'(RECT.pitch - RECT.blk) / 2, left:i > full };' },
    { file:'index', expect:'rectRefuse(', find:'  function rectRefuse(n, k){ return n % k === 0 ? null', replace:'  function rectRefuse(n, k){ return n % k <= 1 ? null' },
    { file:'index', expect:'rectFirstK(', find:'for (var k = RECT.kMin; k <= RECT.kMax; k++) if (n % k === 0) return k;', replace:'for (var k = RECT.kMin + 1; k <= RECT.kMax; k++) if (n % k === 0) return k;' },
    { file:'index', expect:'rect: the judged width', find:'        var bad = rectRefuse(n, k);', replace:'        var bad = rectRefuse(n, RECT.k0);' },
    { file:'index', expect:'Done on the same width costs again', find:'          if (lastBad === k) return;   /* 同一個排法', replace:'          if (false) return;   /* 同一個排法' },
    { file:'index', expect:'gRectNo zh', find:"return n + ' ÷ ' + k + ' ＝ ' + q + ' 餘 ' + r + '：最後一排只有 ' + r + ' 塊", replace:"return n + ' ÷ ' + k + ' ＝ ' + q + ' 餘 ' + r + '：最後一排只有 ' + (k - r) + ' 塊" },
    { file:'index', expect:'gRectYes en', find:"return 'It fills up! ' + q + ' rows of ' + k + ': ' + k + ' × ' + q", replace:"return 'It fills up! ' + k + ' rows of ' + q + ': ' + k + ' × ' + q" },
    { file:'index', expect:'gRect2 zh', find:"return '提示 2：' + n + ' ÷ ' + k + ' 沒有餘數", replace:"return '提示 2：' + n + ' ÷ ' + (k + 1) + ' 沒有餘數" },

    /* 第 2 關：配成一對 */
    { file:'index', expect:'is a square', find:'var GAME_PAIR = [24, 30, 20, 18, 28, 40];', replace:'var GAME_PAIR = [24, 30, 20, 18, 28, 36];' },
    { file:'index', expect:'cards — the board holds', find:'var GAME_PAIR = [24, 30, 20, 18, 28, 40];', replace:'var GAME_PAIR = [24, 30, 20, 18, 28, 60];' },
    { file:'index', expect:'pairTray(', find:'  function pairTray(n){ return unsorted(factorsOf(n),', replace:'  function pairTray(n){ return unsorted(factorsOf(n).slice(1),' },
    { file:'index', expect:'pairRefuse(', find:'  function pairRefuse(n, a, b){ return a * b === n ? null : a * b; }', replace:'  function pairRefuse(n, a, b){ return n % (a * b) === 0 ? null : a * b; }' },
    { file:'index', expect:'pair cards overlap', find:'var PAIR = { w:56, h:48, x:[45, 115, 185, 255],', replace:'var PAIR = { w:56, h:48, x:[45, 95, 185, 255],' },
    { file:'index', expect:'shelf runs off', find:'shelfH:38, shelfStep:44 }, PAIR_H = 320;', replace:'shelfH:38, shelfStep:44 }, PAIR_H = 300;' },
    { file:'index', expect:'pair: the drop zones never overlap', find:'y:[36, 100], pad:10,', replace:'y:[36, 100], pad:4,' },
    { file:'index', expect:'pair: the pair judged', find:'        var a = P.data.v, b = Q.data.v, bad = pairRefuse(n, a, b);', replace:'        var a = P.data.v, b = P.data.v, bad = pairRefuse(n, a, b);' },
    { file:'index', expect:'pair: the drop target', find:'        var t = nearestOpen(targetsFor(P), pt, PAIR.pad);', replace:'        var t = nearestOpen(targetsFor(null), pt, PAIR.pad);' },
    { file:'index', expect:'gPairBad en', find:"return a + ' × ' + b + ' = ' + p + ', not ' + n + '. Think: ' + n + ' ÷ ' + a + ' = ?'", replace:"return a + ' × ' + b + ' = ' + p + ', not ' + n + '. Think: ' + n + ' ÷ ' + b + ' = ?'" },
    { file:'index', expect:'gPair2 zh', find:"return '提示 2：還沒配的最小的是 ' + u + '，' + n + ' ÷ ' + u + ' ＝ ' + v", replace:"return '提示 2：還沒配的最小的是 ' + u + '，' + n + ' ÷ ' + u + ' ＝ ' + (v + 1)" },
    { file:'index', expect:'gPairShelf zh', find:"gPairShelf: function(a, b, n){ return a + ' × ' + b + ' ＝ ' + n; },", replace:"gPairShelf: function(a, b, n){ return a + ' × ' + b + ' ＝ ' + (a + b); }," },

    /* 第 3 關：試到中間收工 */
    { file:'index', expect:'past the middle', find:'var GAME_STOP = [30, 36, 40, 28, 45, 48, 24, 32];', replace:'var GAME_STOP = [30, 36, 40, 28, 45, 48, 24, 100];' },
    { file:'index', expect:'stops after 3', find:'var GAME_STOP = [30, 36, 40, 28, 45, 48, 24, 32];', replace:'var GAME_STOP = [30, 36, 40, 28, 45, 48, 24, 12];' },
    { file:'index', expect:'stopAct(', find:'    if (v * v > n) return \'beyond\';', replace:'    if (v * v >= n) return \'beyond\';' },
    { file:'index', expect:'stopAct(', find:"    if (v !== next) return 'order';\n", replace:'' },
    { file:'index', expect:'stopCanFinish(', find:'  function stopCanFinish(n, next){ return next * next > n; }', replace:'  function stopCanFinish(n, next){ return next * next >= n; }' },
    { file:'index', expect:'the trials do not fit', find:'logX:4, logY:122, logW:292, logH:26 }', replace:'logX:4, logY:122, logW:292, logH:30 }' },
    { file:'index', expect:'stopXY(', find:'  function stopXY(v){ return { x:STOP.x[(v - 1) % 5], y:STOP.y[Math.floor((v - 1) / 5)] }; }', replace:'  function stopXY(v){ return { x:STOP.x[v % 5], y:STOP.y[Math.floor((v - 1) / 5)] }; }' },
    { file:'index', expect:'the number judged is not the one tapped', find:'        var a = stopAct(n, next, v);', replace:'        var a = stopAct(n, next, next);' },
    { file:'index', expect:'stop: Stop is judged', find:'        if (!stopCanFinish(n, next)){', replace:'        if (!stopCanFinish(n, next + 1)){' },
    { file:'index', expect:'a past-the-middle tap costs twice', find:'          if (beyondSeen[v]) return;   /* 同一個鈕', replace:'          if (false) return;   /* 同一個鈕' },
    { file:'index', expect:'a skipped number counts as a mistake', find:"        if (a === 'order'){ roundNote(d.gStopOrder(next)); return; }", replace:"        if (a === 'order'){ roundMiss(d.gStopOrder(next)); return; }" },
    { file:'index', expect:'gStopEarly zh', find:"return '還不能收工：還沒試 ' + next + '，' + next + ' × ' + next + ' ＝ ' + (next * next) + '，沒有超過 '", replace:"return '還不能收工：還沒試 ' + next + '，' + next + ' × ' + next + ' ＝ ' + (next * next + 1) + '，沒有超過 '" },
    { file:'index', expect:'gStopBeyond en', find:"' is already past ' + n + ': even if ' + k + ' were a factor, its partner would be smaller than ' + k", replace:"' is already past ' + n + ': even if ' + k + ' were a factor, its partner would be smaller than ' + (k - 1)" },
    { file:'index', expect:'gStopHit zh', find:"' ✓ 抓到 ' + (k === q ? k + '（只算一次）' : k + '、' + q)", replace:"' ✓ 抓到 ' + (k === q ? k + '（只算一次）' : k + '、' + (q + 1))" },
    { file:'index', expect:'gStop2 (not past) en', find:"(next * next > n ? ', already past ' + n + ' — you can stop.'", replace:"(next * next >= n ? ', already past ' + n + ' — you can stop.'" },

    /* 第 4 關：特別的數 */
    { file:'index', expect:'two of each kind', find:'var GAME_SORT = [ [7, 21, 25, 13, 36, 15],', replace:'var GAME_SORT = [ [7, 21, 25, 13, 36, 49],' },
    { file:'index', expect:'cannot be a card', find:'[2, 9, 27, 31, 16, 33]', replace:'[2, 9, 27, 31, 1, 33]' },
    { file:'index', expect:'sortKind(', find:"    return c === 2 ? 'prime' : (c % 2 === 1 ? 'square' : 'other');", replace:"    return c === 2 ? 'prime' : (c % 3 === 0 ? 'square' : 'other');" },
    { file:'index', expect:'smallPair(', find:'  function smallPair(v){ for (var a = 2; a * a <= v; a++)', replace:'  function smallPair(v){ for (var a = 3; a * a <= v; a++)' },
    { file:'index', expect:'sort boxes overlap', find:'var SORT = { x:6, w:288, h:72, y:[8, 88, 168],', replace:'var SORT = { x:6, w:288, h:72, y:[8, 70, 168],' },
    { file:'index', expect:'the tray reaches the boxes', find:'trayY:[274, 330] }, SORT_H = 362;', replace:'trayY:[250, 330] }, SORT_H = 362;' },
    { file:'index', expect:'sort: the drop zones never overlap', find:'slotW:46, slotH:40, pad:8,', replace:'slotW:46, slotH:40, pad:2,' },
    { file:'index', expect:'placed card runs into the label', find:'lblW:120, slotX:[160, 212, 264],', replace:'lblW:120, slotX:[146, 212, 264],' },
    { file:'index', expect:'sortWhy(', find:"    return bin === 'prime' ? d.gSortBad.otherAsPrime(v, p[0], p[1]) : d.gSortBad.otherAsSquare(v, r, r + 1);", replace:"    return bin === 'prime' ? d.gSortBad.otherAsSquare(v, r, r + 1) : d.gSortBad.otherAsPrime(v, p[0], p[1]);" },
    { file:'index', expect:'sortWhy(', find:"    if (kind === bin) return null;\n    if (kind === 'prime') return d.gSortBad.prime(v);", replace:"    if (kind === 'prime') return d.gSortBad.prime(v);\n    if (kind === bin) return null;" },
    { file:'index', expect:'sort: the box judged', find:'        var v = P.data.v, why = sortWhy(d, v, bin.kind);', replace:"        var v = P.data.v, why = sortWhy(d, v, 'other');" },
    { file:'index', expect:', square) zh: numbers', find:"otherAsSquare: function(v, lo, hi){ return lo + ' × ' + lo + ' ＝ ' + (lo * lo) + '、' + hi + ' × ' + hi + ' ＝ ' + (hi * hi) + '，沒有", replace:"otherAsSquare: function(v, lo, hi){ return lo + ' × ' + lo + ' ＝ ' + (lo * lo) + '、' + hi + ' × ' + hi + ' ＝ ' + (hi * lo) + '，沒有" },
    { file:'index', expect:', prime) en: numbers', find:"otherAsPrime: function(v, a, b){ return v + ' = ' + a + ' × ' + b + ' also makes ' + a + ' rows of ' + b", replace:"otherAsPrime: function(v, a, b){ return v + ' = ' + a + ' × ' + b + ' also makes ' + a + ' rows of ' + v" },
    { file:'index', expect:', other) zh: numbers', find:"squareAsOther: function(v, r){ return v + ' ＝ ' + r + ' × ' + r + '，排得出正方形", replace:"squareAsOther: function(v, r){ return v + ' ＝ ' + r + ' × ' + (r + 1) + '，排得出正方形" },
    { file:'index', expect:'sortOkText(', find:"other: function(v, a, b){ return v + ' = ' + a + ' × ' + b + ' makes other rectangles, but no square.'; }", replace:"other: function(v, a, b){ return v + ' = ' + a + ' × ' + a + ' makes other rectangles, but no square.'; }" },
    { file:'index', expect:'sortWhy prime', find:"prime: function(v){ return v + ' 只能排成 1 × ' + v + ' 一長條", replace:"prime: function(v){ return v + ' 也排得出別的長方形，不只 1 × ' + v + ' 一長條" },

    /* 第 5 關：因數還是倍數 */
    { file:'index', expect:'needs factor, multiple and neither', find:'[[3, 12], [12, 3], [8, 12], [1, 7]]', replace:'[[3, 12], [12, 3], [6, 12], [1, 7]]' },
    { file:'index', expect:'same number on both ends', find:'[[9, 45], [45, 9], [6, 9], [7, 28]]', replace:'[[9, 45], [45, 9], [6, 9], [7, 7]]' },
    { file:'index', expect:'relKind(', find:"  function relKind(a, b){ return b % a === 0 ? 'f' : (a % b === 0 ? 'm' : 'n'); }", replace:"  function relKind(a, b){ return a < b ? 'f' : (a > b ? 'm' : 'n'); }" },
    { file:'index', expect:'relWhy(', find:"    if (t === 'f') return a < b ? d.gRelBad.nAsFsmall(a, b, x.q, x.r) : d.gRelBad.nAsFbig(a, b);", replace:"    if (t === 'f') return a > b ? d.gRelBad.nAsFsmall(a, b, x.q, x.r) : d.gRelBad.nAsFbig(a, b);" },
    { file:'index', expect:'relWhy(', find:"    if (t === k) return null;\n    if (k === 'f')", replace:"    if (t === k || t === 'n') return null;\n    if (k === 'f')" },
    { file:'index', expect:'rel rows overlap', find:'var REL = { headY:2, headH:30, y0:38, step:58, h:46,', replace:'var REL = { headY:2, headH:30, y0:38, step:44, h:46,' },
    { file:'index', expect:'rel: the drop zones never overlap', find:'xr:236, pad:10,', replace:'xr:236, pad:4,' },
    { file:'index', expect:'the blank covers a number', find:'blankX:96, blankW:116,', replace:'blankX:56, blankW:116,' },
    { file:'index', expect:'rel: tiles overlap', find:'tileX:[52, 150, 248], tileY:300 }', replace:'tileX:[52, 110, 248], tileY:300 }' },
    { file:'index', expect:'rel: the row judged', find:'        var why = relWhy(d, s.a, s.b, P.data.t);', replace:"        var why = relWhy(d, s.a, s.b, s.kind);" },
    { file:'index', expect:', m) zh: numbers', find:"fAsM: function(a, b, q){ return a + ' 比 ' + b + ' 小：' + b + ' ÷ ' + a + ' ＝ ' + q + '，' + a + ' 是因數，' + b + ' 才是倍數。'; },", replace:"fAsM: function(a, b, q){ return a + ' 比 ' + b + ' 小：' + b + ' ÷ ' + a + ' ＝ ' + q + '，' + b + ' 是因數，' + a + ' 才是倍數。'; }," },
    { file:'index', expect:', f) en: numbers', find:"nAsFsmall: function(a, b, q, r){ return b + ' ÷ ' + a + ' = ' + q + ' r ' + r + ' — not exact", replace:"nAsFsmall: function(a, b, q, r){ return b + ' ÷ ' + a + ' = ' + q + ' r ' + (r + 1) + ' — not exact" },
    { file:'index', expect:'relOkText(', find:"n: function(a, b, big, small, q, r){ return big + ' ÷ ' + small + ' ＝ ' + q + ' 餘 ' + r + '，除不盡", replace:"n: function(a, b, big, small, q, r){ return small + ' ÷ ' + big + ' ＝ ' + q + ' 餘 ' + r + '，除不盡" },

    /* codex 第一輪：畫出來的字和被判斷的值綁在一起（1b #1）；提示與說明的「意思」（1b #2～#5）；第 1 直排、長條的說法（1a） */
    { file:'index', expect:'a card does not show the value it is judged by', find:"cx:p.x, cy:p.y, text:String(v), cls:'gcard gnumcard'", replace:"cx:p.x, cy:p.y, text:String(v + 1), cls:'gcard gnumcard'" },
    { file:'index', expect:'a card does not show the value it is judged by', find:"SORT.trayY[Math.floor(j / 3)], text:String(v),", replace:"SORT.trayY[Math.floor(j / 3)], text:String(v + 1)," },
    { file:'index', expect:'a number button does not show the number it tries', find:"b.textContent = String(v);", replace:"b.textContent = String(v + 1);" },
    { file:'index', expect:'gBins.prime zh', find:"gBins: { prime:'質數：只排得出一長條', square:'平方數：排得出正方形',", replace:"gBins: { prime:'平方數：排得出正方形', square:'質數：只排得出一長條'," },
    { file:'index', expect:'gTiles.f en', find:"gTiles: { f:'factor', m:'multiple', n:'neither' },", replace:"gTiles: { f:'multiple', m:'factor', n:'neither' }," },
    { file:'index', expect:'an arrow does not show the two numbers', find:"addZone(B, REL.xl, y, REL.numW, REL.h, 'grelnum', String(r[0]));", replace:"addZone(B, REL.xl, y, REL.numW, REL.h, 'grelnum', String(r[1]));" },
    { file:'index', expect:'gHints.stop zh', find:"整除就同時抓到一對；「試的數 × 自己」超過總數就收工。", replace:"整除就同時抓到一對；「試的數 × 自己」還沒超過總數就收工。" },
    { file:'index', expect:'gHints.rel en', find:"the smaller one is the factor and the bigger one the multiple; if neither", replace:"the smaller one is the multiple and the bigger one the factor; if neither" },
    { file:'index', expect:'gRect2 en', find:"' leaves no remainder — try '", replace:"' leaves a remainder — try '" },
    { file:'index', expect:'gRect2 zh', find:"' 沒有餘數 —— 試試每排 '", replace:"' 除不盡 —— 試試每排 '" },
    { file:'index', expect:'gTiles.f en is', find:"gTiles: { f:'factor', m:'multiple', n:'neither' },", replace:"gTiles: { f:'not a factor', m:'multiple', n:'neither' }," },
    { file:'index', expect:'gBins.prime en is', find:"gBins: { prime:'Prime: only one long strip',", replace:"gBins: { prime:'Prime: not a long strip'," },
    { file:'index', expect:'the column-1 reminder stays after a width is chosen', find:"function setK(nk){ if (nk >= RECT.kMin && nk <= RECT.kMax) clearNote(); nk =", replace:"function setK(nk){ nk =" },
    { file:'index', expect:'the column-1 reminder stays after a width is chosen', find:"function setK(nk){ if (nk >= RECT.kMin && nk <= RECT.kMax) clearNote(); nk =", replace:"function setK(nk){ clearNote(); nk =" },
    { file:'index', expect:'◀ at the least width does not just remind', find:"if (k <= RECT.kMin) roundNote(d.gRectMin); else setK(k - 1); });", replace:"setK(k - 1); });" },
    { file:'index', expect:'gRect2 en', find:"' leaves no remainder — try '", replace:"' divides exactly, with a remainder of ' + k + ' — try '" },
    { file:'index', expect:'gRect2 zh', find:"' 沒有餘數 —— 試試每排 '", replace:"' 整除，但餘數是 ' + k + ' —— 試試每排 '" },
    { file:'index', expect:'the column-1 reminder stays after ↔ is dragged', find:"if (nk !== k && !gSolved){ k = nk; clearNote(); draw(); }", replace:"if (nk !== k && !gSolved){ k = nk; draw(); }" },
    { file:'index', expect:'gPair2 zh', find:"'提示 2：還沒配的最小的是 '", replace:"'提示 2：還沒配的最大的是 '" },
    { file:'index', expect:'gPairBad zh', find:"' ＝ ' + p + '，不是 ' + n + '。想一想", replace:"' ＝ ' + p + '，就是 ' + n + '。想一想" },
    { file:'index', expect:'gStopHit en', find:"' ✓ caught ' + (k === q", replace:"' ✓ missed ' + (k === q" },
    { file:'index', expect:'gStopMiss zh', find:"' ＝ ' + q + ' 餘 ' + r + ' ✗'; },", replace:"' ＝ ' + q + ' 餘 ' + r + ' ✓'; }," },
    { file:'index', expect:'gStopEarly zh', find:"return '還不能收工：還沒試 '", replace:"return '可以收工了：還沒試 '" },
    { file:'index', expect:'gStopBeyond zh', find:"試那個比較小的數時就會一起抓到，不用試 '", replace:"試那個比較小的數時就會一起抓到，還是要試 '" },
    { file:'index', expect:'before its partner was tried) zh: must not say "早就"', find:"' 小 —— 試那個比較小的數時就會一起抓到，不用試 ' + k + '。'; },", replace:"' 小，配對的時候早就抓到了 —— 試那個比較小的數時就會一起抓到，不用試 ' + k + '。'; }," },
    { file:'index', expect:'before its partner was tried) en: must not say "already caught"', find:"', and trying that smaller number catches both — no need to try ' + k + '.'; },", replace:"' and already caught in a pair, and trying that smaller number catches both — no need to try ' + k + '.'; }," },
    { file:'index', expect:'gStopDone en', find:"' is past ' + n + ' → stop! Factors of '", replace:"' is not past ' + n + ' → stop! Factors of '" },
    { file:'index', expect:'gSortDone en', find:"and a square number has an odd number of factors.'", replace:"and a square number has an even number of factors.'" },
    { file:'index', expect:'sortOkText square en', find:"' makes a square, so it is a square number.'", replace:"' makes no square, so it is a prime.'" },
    { file:'index', expect:'sortHintText other zh', find:"'，可是沒有一個數乘自己等於 ' + v + '。'; }", replace:"'，所以是質數，等於 ' + v + '。'; }" },
    { file:'index', expect:'relOkText f zh', find:"' ＝ ' + q + '，' + a + ' 是 ' + b + ' 的因數。'; },", replace:"' ＝ ' + q + '，' + a + ' 不是 ' + b + ' 的因數。'; }," },
    { file:'index', expect:'gRelDone zh', find:"小的當因數，大的當倍數。',", replace:"小的當倍數，大的當因數。'," },
    { file:'index', expect:'a tap in column 1 is not just a reminder', find:"if (c < RECT.kMin){ roundNote(d.gRectMin); return; } setK(c); }", replace:"setK(c); }" },
    { file:'index', expect:'rectCol(): a tap at', find:"  function rectCol(x){ return Math.min(RECT.kMax, Math.floor((x - RECT.x0) / RECT.pitch) + 1); }", replace:"  function rectCol(x){ return Math.max(RECT.kMin, Math.min(RECT.kMax, Math.floor((x - RECT.x0) / RECT.pitch) + 1)); }" },
    { file:'index', expect:'sortWhy squareAsPrime', find:"' also makes a square, not just one long strip.'; },", replace:"' — it makes more than one long strip.'; }," },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'should be 3 remainder 2', find:"why:'20 ÷ 6 = 3 餘 2，排不滿長方形。", replace:"why:'20 ÷ 6 = 3 餘 3，排不滿長方形。" },
    { file:'index', expect:'should be 4 remainder 4', find:"no 5 (24 ÷ 5 = 4 r 4).'", replace:"no 5 (24 ÷ 5 = 4 r 3).'" },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:'if (wrongs.length < 3 && v > 0 && v !== c && v !== k && v !== range && v !== 1 && wrongs.indexOf(v) < 0) wrongs.push(v);', replace:'if (wrongs.length < 3 && v > 0 && v !== c && wrongs.indexOf(v) < 0) wrongs.push(v);' },
    { file:'review', expect:'concept: the answer always sits at button', find:"        var d = { v:v, order:shuffle([0, 1, 2, 3]) };", replace:"        var d = { v:v, order:[0, 1, 2, 3] };" },
    { file:'review', expect:'two options are the same sentence', find:"? ['8 是 24 的因數','24 是 8 的倍數','8 的因數包含 24','8 是自己的因數']", replace:"? ['8 是 24 的因數','24 是 8 的倍數','8 的因數包含 24','24 的因數包含 8']" },
    { file:'review', expect:'opts[ans] != correct', find:"        var s = Math.floor(Math.sqrt(n));\n        var m = mixOpts(s, [s + 1, s + 2, Math.floor(n / 2)]);", replace:"        var s = Math.floor(Math.sqrt(n)) + 1;\n        var m = mixOpts(s, [s + 1, s + 2, Math.floor(n / 2)]);" },
    { file:'review', expect:'not every listed factor', find:"        var facs = factorsOf(n), c = facs.length;\n        var m = mixOpts(c, [c-1, c+1, c+2]);", replace:"        var facs = factorsOf(n).slice(1), c = facs.length;\n        var m = mixOpts(c, [c-1, c+1, c+2]);" },
    { file:'review', expect:'is also a factor', find:"          if (n % cand !== 0) w = cand;", replace:"          if (n % cand !== 1) w = cand;" },
    { file:'review', expect:'is a multiple of', find:"          if (cand > 0 && cand % k !== 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand);", replace:"          if (cand > 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand);" },
    { file:'review', expect:'is the right common-factor list', find:"{a:12,b:20, correct:[1,2,4],   wrongs:[[1,2,3],[1,2,5],[1,4,5]]},", replace:"{a:12,b:20, correct:[1,2,4],   wrongs:[[1,2,3],[1,2,4],[1,4,5]]}," },
    { file:'review', expect:'lcmQ: a × b', find:"        var POOL = [[4,6],[6,9],[4,10],[6,8],[8,12],[10,15]];", replace:"        var POOL = [[4,6],[6,9],[4,10],[6,8],[8,12],[4,9]];" },
    { file:'review', expect:'sentence: ', find:"        var m = mixOpts(correct, [['fac', c, a], ['mul', a, c], ['fac', c, b]]);", replace:"        var m = mixOpts(correct, [['fac', c, a], ['mul', c, a], ['fac', c, b]]);" },
    { file:'review', expect:'is not the smallest multiple', find:"        var m = mixOpts(k, [1, d2, 2 * k]);", replace:"        var m = mixOpts(k, [1, d2, 0]);" }
  ],

  sim: {
    INVARIANTS: {
      factorCount: d => {
        if (!sameList(d.facs, facRef(d.n))) return 'not every listed factor of ' + d.n + ' is a factor (or one is missing)';
        if (d.c !== facRef(d.n).length) return 'count ' + d.c + ' != ' + facRef(d.n).length;
        if (d.opts.some(o => !(isInt(o) && o > 0))) return 'a count option is not a positive whole number';
      },
      isMultiple: d => {
        if (d.c % d.k !== 0 || d.q !== d.c / d.k) return d.c + ' is not ' + d.k + ' × ' + d.q;
        for (const o of d.opts) if (o !== d.c && o % d.k === 0) return 'distractor ' + o + ' is a multiple of ' + d.k + ' too — two right answers';
      },
      notFactor: d => {
        if (d.n % d.w === 0) return d.w + ' is also a factor of ' + d.n;
        const bad = d.opts.filter(o => d.n % o !== 0);
        if (bad.length !== 1) return bad.length + ' options are not factors of ' + d.n;
        if (!sameList(d.facs, facRef(d.n))) return 'the listed factors are wrong';
        for (const o of d.opts) if (o !== d.w && (o <= 1 || o >= d.n)) return 'factor option ' + o + ' is 1 or the number itself — too easy';
      },
      smallestMultiple: d => {
        for (const o of d.opts) if (o !== d.k && o % d.k === 0 && o <= d.k) return 'option ' + o + ' is not the smallest multiple of ' + d.k + ' but is a multiple no bigger than it';
        if (d.opts.some(o => !(isInt(o) && o > 0))) return 'option is not a positive whole number';
      },
      commonFactors: d => {
        const want = facRef(d.a).filter(x => d.b % x === 0);
        if (!sameList(d.correct, want)) return 'the marked list ' + d.correct + ' is not the common factors of ' + d.a + ' and ' + d.b;
        for (const o of d.opts) if (o !== d.correct && sameList(o, want)) return 'a distractor ' + o + ' is the right common-factor list';
      },
      sentence: d => {
        if (d.c !== d.a * d.b) return 'c != a × b';
        const truth = o => o[0] === 'fac' ? (o[2] % o[1] === 0 && o[1] <= o[2]) : (o[1] % o[2] === 0 && o[1] >= o[2]);
        const t = d.opts.filter(truth);
        if (t.length !== 1 || t[0] !== d.opts[d.ans]) return 'sentence: ' + t.length + ' true sentences among the options (the marked one true: ' + truth(d.opts[d.ans]) + ')';
      },
      stopTrying: d => {
        if (!(d.s * d.s <= d.n && (d.s + 1) * (d.s + 1) > d.n)) return 'stop point ' + d.s + ' is not the last number whose square is ≤ ' + d.n;
      },
      multiplesCount: d => {
        if (d.c !== Math.floor(d.range / d.k)) return 'count != floor(range / k)';
        if (d.opts.some(o => !(isInt(o) && o > 0))) return 'a count option is not a positive whole number';
      },
      lcmQ: d => {
        const l = d.a * d.b / gcdRef(d.a, d.b);
        if (d.l !== l) return 'lcm ' + d.l + ' != ' + l;
        if (gcdRef(d.a, d.b) === 1) return 'lcmQ: a × b is the lcm itself — a distractor equals the answer';
      },
      concept: d => {
        if (!Array.isArray(d.order) || d.order.slice().sort().join() !== '0,1,2,3') return 'concept: the option order is not a permutation';
      }
    },
    /* 正解的第二套實作：只用原始參數重算，不呼叫頁面的 fmt */
    expectedCorrect: function(d, genId, lang){
      const u = lang === 'zh' ? ' 個' : '';
      switch (genId){
        case 'factorCount': return facRef(d.n).length + u;
        case 'isMultiple': return String(d.opts.filter(o => o % d.k === 0)[0]);
        case 'notFactor': return String(d.opts.filter(o => d.n % o !== 0)[0]);
        case 'smallestMultiple': return String(d.k);
        case 'commonFactors': return facRef(d.a).filter(x => d.b % x === 0).join(SEP[lang]);
        case 'sentence': return lang === 'zh' ? Math.min(d.a, d.b) + ' 是 ' + d.a * d.b + ' 的因數' : Math.min(d.a, d.b) + ' is a factor of ' + d.a * d.b;
        case 'stopTrying': return String(isqrtRef(d.n));
        case 'multiplesCount': return Math.floor(d.range / d.k) + u;
        case 'lcmQ': return String(d.a * d.b / gcdRef(d.a, d.b));
        case 'concept':
          if (d.v === 'prime') return '2' + u;
          if (d.v === 'one') return '1' + u;
          if (d.v === 'square') return lang === 'zh' ? '平方數' : 'square number';
          if (d.v === 'wrongSent') return lang === 'zh' ? '8 的因數包含 24' : '24 is a factor of 8';
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'commonFactors'){ if (!/^\d+(?:(、|, )\d+)*$/.test(s) || (lang === 'zh' ? /, /.test(s) : /、/.test(s))) return 'option "' + s + '" is not a ' + lang + ' list of numbers'; return; }
      if (genId === 'sentence'){
        const re = lang === 'zh' ? /^\d+ 是 \d+ 的(因數|倍數)$/ : /^\d+ is a (factor|multiple) of \d+$/;
        if (!re.test(s)) return 'option "' + s + '" is not a factor/multiple sentence in ' + lang;
        return;
      }
      if (genId === 'concept'){ if (!s.trim()) return 'empty option'; return; }
      const m = (genId === 'factorCount' || genId === 'multiplesCount') && lang === 'zh' ? s.match(/^(\d+) 個$/) : s.match(/^(\d+)$/);
      if (!m) return 'option "' + s + '" is not a whole number' + (lang === 'zh' && (genId === 'factorCount' || genId === 'multiplesCount') ? ' with 個' : '');
      const n = +m[1];
      if (n < 1 || n > 200) return 'option ' + n + ' outside 1~200';
    },
    /* 渲染出來的那一題再驗兩件事：
       ① 同一個產生器的正解不可以永遠在同一個按鈕（concept 以前永遠是第二個）；
       ② concept「哪一句是錯的」：四個選項讀成「x 是 y 的因數／倍數」，中英文逐個意思相同、四句兩兩不同、正好一句是錯的而且就是正解。 */
    renderCheck: (function(){
      const seen = {}, zhOf = new WeakMap();
      let calls = 0;
      const read = (s, lang) => {
        let m;
        if (lang === 'zh'){
          if ((m = s.match(/^(\d+) 是 (\d+) 的(因數|倍數)$/))) return [+m[1], m[3] === '因數' ? 'f' : 'm', +m[2]];
          if ((m = s.match(/^(\d+) 的因數包含 (\d+)$/))) return [+m[2], 'f', +m[1]];
          if ((m = s.match(/^(\d+) 是自己的因數$/))) return [+m[1], 'f', +m[1]];
        } else {
          if ((m = s.match(/^(\d+) is a (factor|multiple) of (\d+)$/))) return [+m[1], m[2] === 'factor' ? 'f' : 'm', +m[3]];
          if ((m = s.match(/^(\d+) is a factor of itself$/))) return [+m[1], 'f', +m[1]];
        }
        return null;
      };
      const truth = t => t[1] === 'f' ? t[2] % t[0] === 0 : t[0] % t[2] === 0;
      return function(d, q, lang, genId){
        let slot;
        if (lang === 'zh'){
          const key = genId + (d.v ? '/' + d.v : '');   /* concept 的四種題各自算：每一種都不可以永遠同一個按鈕 */
          (seen[key] = seen[key] || new Set()).add(q.ans);
          if (++calls === 4000){
            const stuck = Object.keys(seen).filter(k => seen[k].size < 2);
            if (stuck.length) slot = 'concept: the answer always sits at button ' + [...seen[stuck[0]]][0] + ' (' + stuck.join(', ') + ')';
          }
        }
        if (genId === 'concept' && d.v === 'wrongSent'){
          const T = q.opts.map(o => read(o, lang));
          if (T.some(t => !t)) return 'concept wrongSent: an option is not a factor/multiple sentence: ' + q.opts.join(' | ');
          const keys = T.map(t => t.join());
          if (new Set(keys).size !== keys.length) return 'concept wrongSent: two options are the same sentence: ' + q.opts.join(' | ');
          const wrong = T.filter(t => !truth(t));
          if (wrong.length !== 1 || truth(T[q.ans])) return 'concept wrongSent: ' + wrong.length + ' false sentences, the marked one is ' + (truth(T[q.ans]) ? 'true' : 'false');
          if (lang === 'zh') zhOf.set(d, keys.join('|'));
          else if (zhOf.get(d) !== keys.join('|')) return 'concept wrongSent: the zh and en options do not say the same sentences in the same order';
        }
        return slot;
      };
    })()
  },

  data: {
    dataStart: '  /* ============ 小遊戲「因數獵人」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GPICK, shuffle, factorsOf, unsorted, RECT, RECT_H, GAME_RECT, rectK, rectCol, rectEdgeX, rectBlock, rectRefuse, rectFirstK, PAIR, PAIR_H, GAME_PAIR, pairXY, pairTray, pairRefuse, STOP, STOP_H, GAME_STOP, stopXY, stopAct, stopCanFinish, SORT_KINDS, SORT, SORT_H, GAME_SORT, sortKind, sortTray, smallPair, sortWhy, sortOkText, sortHintText, REL_KINDS, REL, REL_H, GAME_REL, relKind, relRows, relQR, relWhy, relOkText}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300, EPS = 1e-9;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        scanEquations(s).forEach(e => { if (e.bad) fail(where + ' ' + L + ': "' + e.text + '" ' + e.bad); });
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
      };
      const has = (where, L, text, words) => {
        const s = String(text);
        words[L].forEach(w => { if (s.indexOf(w) < 0) fail(where + ' ' + L + ': must say "' + w + '": ' + s); });
      };
      const hasNot = (where, L, text, words) => {
        const s = String(text);
        words[L].forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); });
      };

      /* --- 0. 算式掃描器自己先證明會響（正反例） --- */
      [['20 ÷ 6 = 3 餘 2', true], ['20 ÷ 6 = 3 餘 3', false], ['24 ÷ 5 = 4 r 4', true], ['24 ÷ 5 = 4 r 3', false], ['18 ÷ 2 = 9', true], ['18 ÷ 4 = 4', false],
       ['3 × 4 ＝ 12', true], ['3 × 4 ＝ 13', false], ['30 ÷ 4 = 7 remainder 2', true], ['1x30', true], ['6 × 6 = 36', true], ['5 × 5 = 24', false]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (t === '1x30'){ if (r.length) fail('scanEquations() self-test: "1x30" has no "=" and must not be scanned'); return; }
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
      if (checkedEq < 12) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：因數獵人');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['rect', 'pair', 'stop', 'sort', 'rel'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 5), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L); else say('gHints.' + t, L, h, (t === 'pair' || t === 'sort') ? [1, 1] : [1]);   /* 「提示 1」＋ 1 是最小的因數／1 × 自己 */
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };
      /* 第一層提示的意思（寫死的關鍵詞：必須說／不可以說）—— 數字不變、意思反過來的改法也要抓得到（codex 第一輪 1b #2） */
      const HINT_SEM = {
        rect: { has:{ zh:['整除', '排滿'], en:['divide', 'full'] }, not:{ zh:['除不盡', '不能整除'], en:['not divide', 'remainder'] } },
        pair: { has:{ zh:['相乘', '最小的 1', '夥伴'], en:['multiplies', 'smallest, 1', 'partner'] }, not:{ zh:['最大'], en:['largest'] } },
        stop: { has:{ zh:['一對', '超過總數就收工'], en:['pair', 'passes the total, stop'] }, not:{ zh:['還沒超過', '沒有超過'], en:['before', 'not pass'] } },
        sort: { has:{ zh:['一長條', '質數', '自己', '平方數'], en:['long strip', 'prime', 'itself', 'square'] }, not:{ zh:['合數'], en:['composite'] } },
        rel: { has:{ zh:['整除', '小的是因數', '大的是倍數', '都不是'], en:['divides exactly', 'smaller one is the factor', 'bigger one the multiple', 'neither'] },
               not:{ zh:['小的是倍數', '大的是因數'], en:['smaller one is the multiple', 'bigger one the factor'] } }
      };
      TYPES.forEach(t => LANGS.forEach(L => {
        const h = I18N[L].gHints && I18N[L].gHints[t];
        if (typeof h !== 'string') return;
        has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not);
      }));
      /* 畫出來的字就是被判斷的那一個（codex 第一輪 1b #1）：卡片／數字鈕／箱子標籤／字卡／箭頭兩端的字，和它們帶的資料是同一個值 */
      need('pair', /return addPiece\(B, \{ w:PAIR\.w, h:PAIR\.h, cx:p\.x, cy:p\.y, text:String\(v\), cls:'gcard gnumcard', data:\{ v:v \} \}\);/, 'a card does not show the value it is judged by');
      need('stop', /var p = stopXY\(v\), b = document\.createElement\('button'\);\s*b\.type = 'button'; b\.className = 'gtile'; b\.textContent = String\(v\);[\s\S]{0,320}b\.addEventListener\('click', function\(\)\{ act\(v, b\); \}\);/, 'a number button does not show the number it tries');
      need('sort', /text:String\(v\), cls:'gcard gnumcard', data:\{ v:v \} \}\);/, 'a card does not show the value it is judged by');
      need('sort', /addZone\(B, SORT\.x \+ 6, SORT\.y\[i\] \+ 4, SORT\.lblW, SORT\.h - 8, 'gbinlbl', d\.gBins\[kind\]\);\s*return \{ kind:kind, i:i,/, 'a box does not show the label of the kind it is judged as');
      need('rel', /text:d\.gTiles\[t\], cls:'gcard gword', data:\{ t:t \} \}\);/, 'a word tile does not show the word it is judged as');
      need('rel', /addZone\(B, REL\.xl, y, REL\.numW, REL\.h, 'grelnum', String\(r\[0\]\)\);\s*addZone\(B, REL\.xr, y, REL\.numW, REL\.h, 'grelnum', String\(r\[1\]\)\);[\s\S]{0,120}return \{ a:r\[0\], b:r\[1\], kind:relKind\(r\[0\], r\[1\]\)/, 'an arrow does not show the two numbers it is judged by (left = a, right = b)');
      need('rel', /s\.z\.textContent = d\.gTiles\[P\.data\.t\];/, 'a filled blank does not show the tile that was placed');
      need('rect', /line\.textContent = d\.gRectNow\(n, k\);/, 'the trail does not show the width being judged');
      const LBL_SEM = {
        gBins: { prime:{ zh:['質數', '一長條'], en:['Prime', 'long strip'] }, square:{ zh:['平方數', '排得出正方形'], en:['Square', 'can make a square'] }, other:{ zh:['其他', '沒有正方形'], en:['Other', 'no square'] } },
        gTiles: { f:{ zh:['因數'], en:['factor'] }, m:{ zh:['倍數'], en:['multiple'] }, n:{ zh:['都不是'], en:['neither'] } }
      };
      /* 有限的幾個標籤直接逐字釘住：子字串比對擋不住「not a factor」「Prime: not a long strip」這種否定（codex 第二輪 #2） */
      const LBL_EXACT = {
        zh:{ gBins:{ prime:'質數：只排得出一長條', square:'平方數：排得出正方形', other:'其他：好幾種長方形，沒有正方形' }, gTiles:{ f:'因數', m:'倍數', n:'都不是' } },
        en:{ gBins:{ prime:'Prime: only one long strip', square:'Square: can make a square', other:'Other: several rectangles, no square' }, gTiles:{ f:'factor', m:'multiple', n:'neither' } }
      };
      LANGS.forEach(L => Object.keys(LBL_EXACT[L]).forEach(g => Object.keys(LBL_EXACT[L][g]).forEach(k => {
        const txt = I18N[L][g] && I18N[L][g][k];
        if (txt !== LBL_EXACT[L][g][k]) fail('GAME ' + g + '.' + k + ' ' + L + ' is "' + txt + '", the label must read "' + LBL_EXACT[L][g][k] + '"');
      })));
      LANGS.forEach(L => Object.keys(LBL_SEM).forEach(g => Object.keys(LBL_SEM[g]).forEach(k => {
        const txt = I18N[L][g] && I18N[L][g][k];
        if (typeof txt !== 'string'){ fail('GAME ' + g + '.' + k + ' missing in ' + L); return; }
        has(g + '.' + k, L, txt, LBL_SEM[g][k]);
        Object.keys(LBL_SEM[g]).forEach(o => { if (o !== k) hasNot(g + '.' + k, L, txt, { zh:[LBL_SEM[g][o].zh[0]], en:[LBL_SEM[g][o].en[0]] }); });
      })));

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.axis === 'x'\) P\.place\(o\.snapX\(orig\.x \+ dx\), orig\.y\);/, 'the ↔ does not snap to an edge while it is dragged');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      ['rect', 'sort', 'rel'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint — a level-2 hint ("next is 5") stays on the solved board');
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
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      if (/function roundNote\(text\)\{[^}]*(gMistake|gScore)/.test(gsrc)) fail('GAME: roundNote() changes the score or records a mistake');
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85), L === 'zh' ? [85] : [5, 85]);
        say('gClear', L, d.gClear, []);
        if (d.gSep !== SEP[L]) fail('GAME gSep ' + L + ' should be "' + SEP[L] + '"');
      });

      /* --- shuffle()：切出來真的跑 --- */
      let shuffleFn = null;
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
          if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
        }
      }
      /* 托盤不可以一開始就照答案排好（每一種托盤 3000 次） */
      const neverSorted = (what, make, keyOf, want) => {
        for (let i = 0; i < 3000; i++){
          const t = make();
          if (t.slice().sort((a, b) => a - b).join() !== want.slice().sort((a, b) => a - b).join()){ fail('GAME ' + what + ': the tray is not the round\'s own cards: ' + t); return; }
          if (t.every((x, j) => j === 0 || keyOf(t[j - 1]) <= keyOf(x))){ fail('GAME ' + what + ': the tray starts in the answer order (' + t + ')'); return; }
        }
      };

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(gsrc, 'nearestOpen');
        if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const two = [{ id:0, cx:60, cy:100, hw:60, hh:40, done:false }, { id:1, cx:140, cy:100, hw:20, hh:20, done:false }];
          const r0 = nearestOpen(two, { x:115, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:144, cy:100, hw:20, hh:20, done:false }];
          if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
          const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:false }];
          if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
          if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
        }
      }
      const nearestBox = (list, p, pad) => {
        let best = null, bd = Infinity, bc = Infinity;
        for (const b of list){
          const dx = Math.abs(p.x - b.cx), dy = Math.abs(p.y - b.cy);
          if (dx > b.hw + pad || dy > b.hh + pad) continue;
          const dd = Math.hypot(Math.max(0, dx - b.hw), Math.max(0, dy - b.hh)), dc = Math.hypot(dx, dy);
          if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
        }
        return best;
      };
      /* 一整片區域每 0.5px 問頁面的 nearestOpen 和自己的 nearestBox；兩個放寬的方框重疊的地方至少要有幾個點 */
      const sweep = (what, list, pad, x0, x1, y0, y1, minOverlap) => {
        if (!nearestOpen) return;
        let n = 0, overlap = 0;
        for (let y = y0; y <= y1; y += 0.5) for (let x = x0; x <= x1; x += 0.5){
          const p = { x:x, y:y }, got = nearestOpen(list, p, pad), want = nearestBox(list, p, pad);
          if (got !== want){ fail('GAME ' + what + ': a drop at (' + x + ', ' + y + ') goes to ' + (got ? got.i : 'nothing') + ', the nearest box is ' + (want ? want.i : 'nothing')); return; }
          if (list.filter(b => Math.abs(x - b.cx) < b.hw + pad && Math.abs(y - b.cy) < b.hh + pad).length > 1) overlap++;
          n++;
        }
        if (overlap < minOverlap) fail('GAME ' + what + ': only ' + overlap + ' of ' + n + ' sampled points lie where two padded boxes overlap — the drop zones never overlap, the nearest-box rule is never exercised');
      };

      tooSmall('GPICK', D.GPICK);

      /* ================= 第 1 關：排積木 ================= */
      {
        const R = D.RECT, H = D.RECT_H;
        if (!(R.kMin === 2 && R.kMax === 10)) fail('GAME rect: rows must be 2~10 blocks wide (the same chips as example 1 without the strip), got ' + R.kMin + '~' + R.kMax);
        if (!Array.isArray(D.GAME_RECT) || D.GAME_RECT.length < 4) fail('GAME rect: GAME_RECT should hold at least 4 entries');
        /* ↔ 的拖拉範圍在畫板裡、拿取範圍夠大、不壓到第一排積木 */
        inside(sq(D.rectEdgeX(R.kMin), R.handleY, D.GPICK, D.GPICK), 'rect: ↔ at ' + R.kMin + ' per row', H);
        inside(sq(D.rectEdgeX(R.kMax), R.handleY, D.GPICK, D.GPICK), 'rect: ↔ runs off the board at ' + R.kMax + ' per row', H);
        if (D.rectEdgeX(R.kMax) + D.GPICK / 2 > W + EPS) fail('GAME rect: ↔ runs off the board at ' + R.kMax + ' per row');
        if (R.handleY + D.GPICK / 2 > R.y0 + EPS) fail('GAME rect: ↔ covers the first row of blocks');
        if (!(R.pitch >= R.blk)) fail('GAME rect: blocks overlap (pitch ' + R.pitch + ' < block ' + R.blk + ')');
        if (!(R.pitch - R.blk >= 2)) fail('GAME rect: blocks overlap or touch (gap ' + (R.pitch - R.blk) + ')');
        /* ↔ 吸到最近的邊：x 每 0.25px 和自己的「最近的邊」比；點一下看第幾直排 */
        for (let x = 0; x <= W; x += 0.25){
          const raw = (x - R.x0) / R.pitch;
          const near = Math.max(R.kMin, Math.min(R.kMax, Math.round(raw)));
          if (D.rectK(x) !== near){ fail('GAME rectK(): at x=' + x + ' it snaps to ' + D.rectK(x) + ', the nearest edge is ' + near); break; }
          const col = Math.min(R.kMax, Math.floor(raw) + 1);   /* 第 1 直排（和它左邊）是 1 以下：只提醒，不可以和第 2 直排共用 2 */
          if (D.rectCol(x) !== col){ fail('GAME rectCol(): a tap at x=' + x + ' gives ' + D.rectCol(x) + ', it is in column ' + col); break; }
        }
        for (let k = R.kMin; k <= R.kMax; k++) if (Math.abs(D.rectEdgeX(k) - (R.x0 + k * R.pitch)) > EPS || D.rectK(D.rectEdgeX(k)) !== k) fail('GAME rect: edge ' + k + ' is not where ↔ snaps for ' + k);
        if (!(R.k0 >= R.kMin && R.k0 <= R.kMax)) fail('GAME rect: the start width is outside 2~10');
        D.GAME_RECT.forEach(n => {
          if (!(isInt(n) && n > R.kMax)) fail('GAME rect: n should be more than ' + R.kMax + ' (so no width 2~10 is one long strip), got ' + n);
          const ks = []; for (let k = R.kMin; k <= R.kMax; k++) if (n % k === 0) ks.push(k);
          if (!ks.length) fail('GAME rect: n should be fillable by some width 2~10, ' + n + ' is not');
          if (n <= R.kMax) fail('GAME rect: ' + n + ' blocks can be one long strip within 2~10');
          if (n % R.k0 === 0) fail('GAME rect: the start already fills (' + n + ' blocks, ' + R.k0 + ' per row)');
          if (D.rectFirstK(n) !== ks[0]) fail('GAME rectFirstK(' + n + ') = ' + D.rectFirstK(n) + ', the smallest width that fills is ' + ks[0]);
          const rowsMax = Math.ceil(n / R.kMin);
          if (R.y0 + rowsMax * R.pitch > H + EPS) fail('GAME rect: rows of 2 do not fit — ' + n + ' blocks need ' + rowsMax + ' rows down to y=' + (R.y0 + rowsMax * R.pitch) + ' on a ' + H + '-tall board');
          for (let k = R.kMin; k <= R.kMax; k++){
            /* 照遊戲的規則：按「排好了」只收排滿的 */
            const got = D.rectRefuse(n, k), q = Math.floor(n / k), r = n % k;
            if (r === 0 ? got !== null : !(got && got.q === q && got.r === r)) fail('GAME rectRefuse(' + n + ', ' + k + ') = ' + JSON.stringify(got) + ' — ' + (r ? 'should be ' + q + ' remainder ' + r : 'it fills'));
            /* 畫出來的積木：第 i 塊在第 i % k 直排、第 floor(i / k) 排；排不滿的那幾塊（最後 r 塊）畫成虛線 */
            const boxes = [];
            let left = 0;
            for (let i = 0; i < n; i++){
              const b = D.rectBlock(n, k, i), x = R.x0 + (i % k) * R.pitch + (R.pitch - R.blk) / 2, y = R.y0 + Math.floor(i / k) * R.pitch + (R.pitch - R.blk) / 2;
              if (Math.abs(b.x - x) > EPS || Math.abs(b.y - y) > EPS){ fail('GAME rectBlock(' + n + ', ' + k + ', ' + i + ') is drawn at (' + b.x + ', ' + b.y + '), its row/column says (' + x + ', ' + y + ')'); break; }
              if (b.left !== (i >= n - r)){ fail('GAME rect: block ' + i + ' of ' + n + ' at ' + k + ' per row — the leftover blocks are the last ' + r + ', got left=' + b.left); break; }
              if (b.left) left++;
              boxes.push({ x:b.x, y:b.y, w:R.blk, h:R.blk });
              if (b.x + R.blk > D.rectEdgeX(k) + EPS) fail('GAME rect: block ' + i + ' pokes past the edge at ' + k);
            }
            if (left !== r) fail('GAME rect: ' + left + ' leftover blocks drawn for ' + n + ' at ' + k + ' per row, there are ' + r);
            boxes.forEach((b, i) => { if (i < 3 || i === boxes.length - 1) inside(b, 'rect block ' + i + ' (' + n + ' at ' + k + ')', H); });
            noHits(boxes.slice(0, Math.min(boxes.length, 2 * k + 1)), 'rect: blocks overlap at ' + k + ' per row:');
            LANGS.forEach(L => {
              const d = I18N[L];
              say('gRectNow', L, d.gRectNow(n, k), [n, k]);
              if (r){
                say('gRectNo', L, d.gRectNo(n, k, q, r), [n, k, q, r, r, k, n]);
                has('gRectNo', L, d.gRectNo(n, k, q, r), { zh:['排不滿', '不是'], en:['doesn’t fill', 'is not a factor'] });
              } else {
                say('gRectYes', L, d.gRectYes(n, k, q), [q, k, k, q, n, k, q, n]);
                has('gRectYes', L, d.gRectYes(n, k, q), { zh:['排滿了', '都是'], en:['fills up', 'both factors'] });
              }
            });
          }
          LANGS.forEach(L => {
            const k1 = D.rectFirstK(n);
            say('gRect2', L, I18N[L].gRect2(n, k1), [2, n, k1, k1]);
            /* 說「整除／沒有餘數」的任何一種寫法都可以；不可以說出一個餘數、說除不盡（codex 第二輪 #3：別把正確的換句話說擋掉） */
            const g2r = I18N[L].gRect2(n, k1);
            if (!(L === 'zh' ? /沒有餘數|整除|不會有餘數/ : /no remainder|exactly|without (a )?remainder/).test(g2r)) fail('gRect2 ' + L + ': must say it divides exactly (no remainder): ' + g2r);
            hasNot('gRect2', L, g2r, { zh:[/餘(?:數)?(?:是|為|有)?\s*\d/, '除不盡', '排不滿'], en:[/\b(?:remainder|r)(?:\s+of)?\s*(?:is\s*)?\d/, 'has a remainder', 'not exact', 'doesn’t fill'] });   /* 「餘數是 3」「remainder of 3」也算說出餘數（codex 第三輪 #1） */
            if (n % k1) fail('GAME gRect2: it says ' + n + ' ÷ ' + k1 + ' leaves no remainder — it does');
          });
        });
        need('rect', /var n = pick\(GAME_RECT\), k = RECT\.k0, lastBad = null;/, 'the round does not start at RECT.k0 from GAME_RECT');
        /* 第 1 直排的提醒：換了每排塊數就收掉（點、◀ ▶ 都走 setK；拖 ↔ 走 onPlace）（codex 第二輪 #1） */
        need('rect', /function setK\(nk\)\{ if \(nk >= RECT\.kMin && nk <= RECT\.kMax\) clearNote\(\); nk = Math\.max\(RECT\.kMin, Math\.min\(RECT\.kMax, nk\)\);/, 'the column-1 reminder stays after a width is chosen by tap or ◀ ▶ (or an out-of-range request clears it)');
        need('rect', /less\.addEventListener\('click', function\(\)\{ if \(gSolved \|\| grip\.busy\(\)\) return; if \(k <= RECT\.kMin\) roundNote\(d\.gRectMin\); else setK\(k - 1\); \}\);/, '◀ at the least width does not just remind (codex round 3 #2)');
        need('rect', /if \(nk !== k && !gSolved\)\{ k = nk; clearNote\(\); draw\(\); \}/, 'the column-1 reminder stays after ↔ is dragged');
        if (!/function clearNote\(\)\{ if \(gMsg\.querySelector\('\.gnote'\)\) gMsg\.textContent = ''; \}/.test(gsrc)) fail('GAME: clearNote() must clear only a reminder, never a mistake\'s explanation');
        need('rect', /var bad = rectRefuse\(n, k\);\s*if \(bad\)\{\s*if \(lastBad === k\) return;[^\n]*\s*lastBad = k;\s*roundMiss\(d\.gRectNo\(n, k, bad\.q, bad\.r\)\);/, 'the judged width is not the one shown (k), Done on the same width costs again, or the reason does not match');
        need('rect', /if \(grip\.busy\(\)\) return;/, 'Done is judged while another finger still drags ↔');
        need('rect', /snapX:function\(x\)\{ return rectEdgeX\(rectK\(x\)\); \},\s*onPlace:function\(P\)\{ var nk = rectK\(P\.cx\); if \(nk !== k && !gSolved\)\{ k = nk; clearNote\(\); draw\(\); \} \}/, '↔ does not snap to an edge and re-draw the rows while it moves');
        need('rect', /useTapSelect\(B, function\(P, pt\)\{ if \(pt\.tap\) tapCol\(pt\.x\); else setK\(rectK\(pt\.x\)\); return true; \}\);/, 'a tap is not read by column / a drag by the nearest edge');
        need('rect', /B\.onBoardTap = function\(pt\)\{ if \(!grip\.busy\(\)\) tapCol\(pt\.x\); \};/, 'a tap on the blocks does not set the width by column');
        need('rect', /function tapCol\(x\)\{ var c = rectCol\(x\); if \(c < RECT\.kMin\)\{ roundNote\(d\.gRectMin\); return; \} setK\(c\); \}/, 'a tap in column 1 is not just a reminder (it must not share column 2\'s width, and it is not a mistake)');
        LANGS.forEach(L => { say('gRectMin', L, I18N[L].gRectMin, [2, 1]); has('gRectMin', L, I18N[L].gRectMin, { zh:['至少 2', '一長條'], en:['At least 2', 'long strip'] }); });
        need('rect', /var p = rectBlock\(n, k, i\);/, 'the blocks are not drawn from rectBlock()');
      }

      /* ================= 第 2 關：配成一對 ================= */
      {
        const P = D.PAIR, H = D.PAIR_H;
        if (!Array.isArray(D.GAME_PAIR) || D.GAME_PAIR.length < 4) fail('GAME pair: GAME_PAIR should hold at least 4 entries');
        tooSmall('pair: card', Math.min(P.w, P.h));
        const maxCards = P.x.length * P.y.length;
        const slots = []; for (let j = 0; j < maxCards; j++){ const p = D.pairXY(j); if (p.x !== P.x[j % 4] || p.y !== P.y[Math.floor(j / 4)]) fail('GAME pairXY(' + j + ') is not column ' + (j % 4) + ', row ' + Math.floor(j / 4)); slots.push(sq(p.x, p.y, P.w, P.h)); }
        slots.forEach((b, i) => inside(b, 'pair card ' + i, H));
        noHits(slots, 'pair cards overlap:');
        const shelves = [];
        for (let s = 0; s < maxCards / 2; s++) shelves.push({ x:P.shelfX, y:P.shelfY + s * P.shelfStep, w:P.shelfW, h:P.shelfH });
        shelves.forEach((b, i) => inside(b, 'pair: the shelf runs off the board — line ' + i, H));
        noHits(slots.concat(shelves), 'pair: a card and a shelf line (or two shelf lines) overlap:');
        D.GAME_PAIR.forEach(n => {
          const f = facRef(n);
          if (isqrtRef(n) * isqrtRef(n) === n) fail('GAME pair: ' + n + ' is a square — its middle factor has no partner card');
          if (!(f.length >= 6 && f.length <= maxCards)) fail('GAME pair: ' + n + ' has ' + f.length + ' factors = cards — the board holds 6~' + maxCards);
          if (!sameList(D.factorsOf(n), f)) fail('GAME factorsOf(' + n + ') is wrong');
          neverSorted('pairTray(' + n + ')', () => D.pairTray(n), v => v, f);
          /* 每兩張卡：相乘剛好是 n 才收 */
          f.forEach(a => f.forEach(b => {
            if (a === b) return;
            const got = D.pairRefuse(n, a, b);
            if ((a * b === n) !== (got === null) || (got !== null && got !== a * b)) fail('GAME pairRefuse(' + n + ', ' + a + ', ' + b + ') = ' + got);
            LANGS.forEach(L => {
              if (a * b === n){ has('gPairOk', L, I18N[L].gPairOk(Math.min(a, b), Math.max(a, b), n), { zh:['配好一對'], en:['a pair'] }); say('gPairOk', L, I18N[L].gPairOk(Math.min(a, b), Math.max(a, b), n), [Math.min(a, b), Math.max(a, b), n]); say('gPairShelf', L, I18N[L].gPairShelf(Math.min(a, b), Math.max(a, b), n), [Math.min(a, b), Math.max(a, b), n]); }
              else { say('gPairBad', L, I18N[L].gPairBad(a, b, a * b, n), [a, b, a * b, n, n, a]); has('gPairBad', L, I18N[L].gPairBad(a, b, a * b, n), { zh:['，不是 ' + n, '想一想'], en:[', not ' + n, 'Think'] }); }
            });
          }));
          /* 照遊戲的規則從頭配到完：每一對拿掉兩張，最後一定配完、而且架子上正好 f.length / 2 行 */
          let left = f.slice(), pairs = 0;
          while (left.length){
            const a = left[0], b = left.filter(x => x !== a && D.pairRefuse(n, a, x) === null);
            if (b.length !== 1){ fail('GAME pair: card ' + a + ' of ' + n + ' has ' + b.length + ' partners on the board'); break; }
            left = left.filter(x => x !== a && x !== b[0]); pairs++;
            LANGS.forEach(L => { if (left.length){ const u = Math.min(...left), g2 = I18N[L].gPair2(n, u, n / u); say('gPair2', L, g2, [2, u, n, u, n / u, u, n / u]); has('gPair2', L, g2, { zh:['還沒配的最小的'], en:['smallest one left'] }); hasNot('gPair2', L, g2, { zh:['最大'], en:['largest'] }); } });
          }
          if (pairs * 2 !== f.length) fail('GAME pair: ' + n + ' does not pair up completely');
          LANGS.forEach(L => {
            say('gPairNow', L, I18N[L].gPairNow(n, 0, f.length / 2), [n, 0, f.length / 2]);
            say('gPairDone', L, I18N[L].gPairDone(n, f.join(I18N[L].gSep), f.length), [n].concat(f, [f.length]));
          });
        });
        /* 卡片的收件範圍：整片每 0.5px，相鄰兩張放寬之後要真的重疊 */
        const zl = slots.map((b, i) => ({ i:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:P.w / 2, hh:P.h / 2, done:false }));
        sweep('pair: the drop zones never overlap /', zl, P.pad, 0, W, 0, P.y[1] + P.h, 40);
        need('pair', /var a = P\.data\.v, b = Q\.data\.v, bad = pairRefuse\(n, a, b\);\s*if \(bad !== null\)\{ roundMiss\(d\.gPairBad\(a, b, bad, n\)\); return false; \}/, 'the pair judged is not the card dropped and the card it landed on, or the reason does not match');
        need('pair', /var t = nearestOpen\(targetsFor\(P\), pt, PAIR\.pad\);\s*return t \? tryPair\(P, t\.P\) : false;/, 'the drop target is not the nearest other card (or a miss is not silent)');
        need('pair', /return cards\.filter\(function\(c\)\{ return c !== P && !c\.locked; \}\)/, 'a card can be paired with itself or with a card already paired');
        need('pair', /if \(S && S !== P\)\{\s*S\.el\.classList\.remove\('sel'\); B\.selected = null;\s*if \(S\.busy\(\) \|\| S\.locked \|\| gSolved\) return;[^\n]*\s*tryPair\(S, P\);/, 'tap one card then another does not try that pair');
        need('pair', /var cards = pairTray\(n\)\.map\(/, 'the cards are not laid out from pairTray()');
      }

      /* ================= 第 3 關：試到中間收工 ================= */
      {
        const S = D.STOP, H = D.STOP_H;
        tooSmall('stop: number button', S.tile);
        const tiles = [];
        for (let v = 1; v <= 10; v++){
          const p = D.stopXY(v);
          if (p.x !== S.x[(v - 1) % 5] || p.y !== S.y[Math.floor((v - 1) / 5)]) fail('GAME stopXY(' + v + ') is not where ' + v + ' belongs (rows of five, in order)');
          tiles.push(sq(p.x, p.y, S.tile, S.tile));
        }
        tiles.forEach((b, i) => inside(b, 'stop button ' + (i + 1), H));
        noHits(tiles, 'stop buttons overlap:');
        if (!Array.isArray(D.GAME_STOP) || D.GAME_STOP.length < 4) fail('GAME stop: GAME_STOP should hold at least 4 entries');
        D.GAME_STOP.forEach(n => {
          const s = isqrtRef(n), f = facRef(n);
          if (s < 4) fail('GAME stop: ' + n + ' stops after ' + s + ' — too short a hunt (at least 4 tries)');
          if (s + 1 > 10) fail('GAME stop: ' + n + ' — the first number past the middle (' + (s + 1) + ') is not on the board');
          const lastLog = { x:S.logX, y:S.logY + (s - 1) * S.logH, w:S.logW, h:S.logH };
          inside(lastLog, 'stop: the trials do not fit — the ' + s + 'th line for ' + n, H);
          noHits(tiles.concat([{ x:S.logX, y:S.logY, w:S.logW, h:s * S.logH }]), 'stop: the trial log runs into the buttons:');
          /* 每一個「下一個」× 每一個鈕：照自己的規則 */
          for (let next = 1; next <= s + 1; next++){
            const can = D.stopCanFinish(n, next);
            if (can !== (next * next > n)) fail('GAME stopCanFinish(' + n + ', ' + next + ') = ' + can);
            for (let v = 1; v <= 10; v++){
              const want = v < next ? 'dup' : (v * v > n ? 'beyond' : (v !== next ? 'order' : 'try'));
              const got = D.stopAct(n, next, v);
              if (got !== want){ fail('GAME stopAct(' + n + ', next ' + next + ', ' + v + ') = ' + got + ', the rule says ' + want); break; }
            }
          }
          /* 照遊戲的規則玩一遍：1, 2, …, s 一個一個試；抓到的就是全部的因數，收工的時候 next = s + 1 */
          const got = [];
          let next = 1;
          while (!D.stopCanFinish(n, next)){
            if (D.stopAct(n, next, next) !== 'try'){ fail('GAME stop: ' + n + ' — trying ' + next + ' is refused'); break; }
            if (n % next === 0){ got.push(next); if (n / next !== next) got.push(n / next); }
            LANGS.forEach(L => {
              const q = Math.floor(n / next), r = n % next, d = I18N[L];
              if (r){ say('gStopMiss', L, d.gStopMiss(n, next, q, r), [n, next, q, r]); has('gStopMiss', L, d.gStopMiss(n, next, q, r), { zh:['餘', '✗'], en:[' r ', '✗'] }); hasNot('gStopMiss', L, d.gStopMiss(n, next, q, r), { zh:['✓', '抓到'], en:['✓', 'caught'] }); }
              else {
                say('gStopHit', L, d.gStopHit(n, next, q), next === q ? [n, next, q, next] : [n, next, q, next, q]);
                has('gStopHit', L, d.gStopHit(n, next, q), next === q ? { zh:['✓ 抓到', '只算一次'], en:['✓ caught', 'counts once'] } : { zh:['✓ 抓到'], en:['✓ caught'] });
                hasNot('gStopHit', L, d.gStopHit(n, next, q), { zh:['餘', '✗'], en:[' r ', '✗'] });
              }
              say('gStopEarly', L, d.gStopEarly(n, next), [next, next, next, next * next, n]);
              has('gStopEarly', L, d.gStopEarly(n, next), { zh:['還不能收工', '還沒試', '沒有超過', '還有一對沒抓到'], en:['Not yet', 'haven’t tried', 'is not past', 'pair may still be missing'] });
              hasNot('gStopEarly', L, d.gStopEarly(n, next), { zh:['已經超過'], en:['already past'] });
              say('gStop2', L, d.gStop2(n, next), [2, next, next, next, next * next, n]);
              has('gStop2 (not past)', L, d.gStop2(n, next), { zh:['還沒超過'], en:['not past'] });
              say('gStopOrder', L, d.gStopOrder(next), [next]);
            });
            next++;
            if (next > 11) break;
          }
          if (next !== s + 1) fail('GAME stop: ' + n + ' — Stop is allowed at ' + next + ', it should be ' + (s + 1));
          if (got.slice().sort((a, b) => a - b).join() !== f.join()) fail('GAME stop: trying 1..' + s + ' catches ' + got.sort((a, b) => a - b) + ', the factors of ' + n + ' are ' + f);
          for (let v = s + 1; v <= 10; v++) LANGS.forEach(L => {
            if (!(v * v > n)) fail('GAME stop: ' + v + ' is called past the middle of ' + n);
            say('gStopBeyond', L, I18N[L].gStopBeyond(n, v), [v, v, v * v, n, v, v, v]);
            has('gStopBeyond', L, I18N[L].gStopBeyond(n, v), { zh:['已經超過', '夥伴也比', '試那個比較小的數時就會一起抓到', '不用試'], en:['already past', 'partner would be smaller', 'trying that smaller number catches both', 'no need to try'] });
            /* 這一句在任何時候都可能出現 —— 包括還沒試到它的夥伴的時候（n = 48、下一個是 2、點 8：夥伴 6 還沒試）。
               所以不可以說夥伴「已經抓到了」（驗證者抓到的）：只准說「試那個比較小的數時就會抓到」。 */
            hasNot('gStopBeyond (tapped ' + v + ' before its partner was tried)', L, I18N[L].gStopBeyond(n, v), { zh:['早就', '已經抓到', '抓過了'], en:['already caught', 'were caught', 'has been caught'] });
            hasNot('gStopBeyond', L, I18N[L].gStopBeyond(n, v), { zh:['還沒超過', '沒有超過'], en:['not past'] });
          });
          LANGS.forEach(L => {
            const d = I18N[L];
            say('gStopNow', L, d.gStopNow(n), [n]);
            say('gStop2 (past)', L, d.gStop2(n, s + 1), [2, s + 1, s + 1, s + 1, (s + 1) * (s + 1), n]);
            has('gStop2 (past)', L, d.gStop2(n, s + 1), { zh:['已經超過'], en:['already past'] });
            hasNot('gStop2 (past)', L, d.gStop2(n, s + 1), { zh:['還沒超過'], en:['not past'] });
            say('gStopDone', L, d.gStopDone(n, s + 1, f.join(d.gSep), f.length), [s + 1, s + 1, (s + 1) * (s + 1), n, n].concat(f, [f.length]));
            has('gStopDone', L, d.gStopDone(n, s + 1, f.join(d.gSep), f.length), { zh:['已經超過', '收工', '的因數：', '共 '], en:['is past', 'stop', 'Factors of', 'in total'] });
            hasNot('gStopDone', L, d.gStopDone(n, s + 1, f.join(d.gSep), f.length), { zh:['還沒', '沒有超過'], en:['not past', 'Not yet'] });
            has('gStopOrder', L, d.gStopOrder(1), { zh:['一個一個試', '先試'], en:['one by one', 'comes first'] });
          });
        });
        need('stop', /var a = stopAct\(n, next, v\);\s*if \(a === 'dup'\) return;\s*if \(a === 'beyond'\)\{\s*if \(beyondSeen\[v\]\) return;[^\n]*\s*beyondSeen\[v\] = true;\s*roundMiss\(d\.gStopBeyond\(n, v\)\);\s*return;\s*\}\s*if \(a === 'order'\)\{ roundNote\(d\.gStopOrder\(next\)\); return; \}/, 'the number judged is not the one tapped, a past-the-middle tap costs twice (or not at all), or a skipped number counts as a mistake');
        need('stop', /if \(!stopCanFinish\(n, next\)\)\{\s*if \(earlyAt === next\) return;[^\n]*\s*earlyAt = next;\s*roundMiss\(d\.gStopEarly\(n, next\)\);/, 'Stop is judged on something other than the next untried number, or pressing it twice costs twice');
        need('stop', /b\.addEventListener\('click', function\(\)\{ act\(v, b\); \}\);/, 'a button does not try its own number');
      }

      /* ================= 第 4 關：特別的數 ================= */
      {
        const S = D.SORT, H = D.SORT_H;
        if ((D.SORT_KINDS || []).join() !== 'prime,square,other') fail('GAME sort: the boxes should be prime, square, other');
        tooSmall('sort: card', Math.min(S.cardW, S.cardH));
        const bins = S.y.map(y => ({ x:S.x, y:y, w:S.w, h:S.h }));
        bins.forEach((b, i) => inside(b, 'sort box ' + i, H));
        noHits(bins, 'sort boxes overlap:');
        const lbls = S.y.map(y => ({ x:S.x + 6, y:y + 4, w:S.lblW, h:S.h - 8 }));
        const placed = [];
        S.y.forEach((y, i) => S.slotX.forEach(x => placed.push({ x:x - S.slotW / 2, y:y + (S.h - S.slotH) / 2, w:S.slotW, h:S.slotH, i:i })));
        placed.forEach(p => { const b = bins[p.i]; if (!(p.x >= b.x && p.y >= b.y && p.x + p.w <= b.x + b.w && p.y + p.h <= b.y + b.h)) fail('GAME sort: a placed card pokes out of its box'); });
        noHits(lbls.concat(placed), 'sort: a placed card runs into the label (or two placed cards overlap):');
        const tray = []; for (let j = 0; j < 6; j++) tray.push(sq(S.trayX[j % 3], S.trayY[Math.floor(j / 3)], S.cardW, S.cardH));
        tray.forEach((b, i) => inside(b, 'sort tray card ' + i, H));
        noHits(tray.concat(bins), 'sort: the tray reaches the boxes (or two tray cards overlap):');
        for (let v = 2; v <= 60; v++) if (D.sortKind(v) !== kindRef(v)) fail('GAME sortKind(' + v + ') = ' + D.sortKind(v) + ', it has ' + facRef(v).length + ' factors → ' + kindRef(v));
        for (let v = 2; v <= 60; v++){
          const p = D.smallPair(v), want = (() => { for (let a = 2; a * a <= v; a++) if (v % a === 0) return [a, v / a]; return [1, v]; })();
          if (p[0] !== want[0] || p[1] !== want[1]) fail('GAME smallPair(' + v + ') = ' + p + ', should be ' + want);
        }
        if (!Array.isArray(D.GAME_SORT) || D.GAME_SORT.length < 4) fail('GAME sort: GAME_SORT should hold at least 4 entries');
        const BIN_WORDS = {   /* 每一種理由自己的關鍵詞（必須說／不可以說） */
          prime: { zh:['只能排成', '1 和'], en:['only makes', '1 and'] },
          squareAsPrime: { zh:['還排得出正方形', '不只一長條'], en:['also makes a square', 'not just one long strip'] },
          squareAsOther: { zh:['正方形', '奇數個'], en:['makes a square', 'odd number'] },
          otherAsPrime: { zh:['也排得出', '不只一長條'], en:['also makes', 'not just one long strip'] },
          otherAsSquare: { zh:['沒有一個數乘自己', '排不出正方形'], en:['no number times itself', 'no square'] }
        };
        D.GAME_SORT.forEach((e, ei) => {
          if (!(Array.isArray(e) && e.length === 6 && new Set(e).size === 6)) fail('GAME sort: entry ' + ei + ' should be six different numbers');
          if (e.indexOf(1) >= 0) fail('GAME sort: 1 cannot be a card (1 × 1 is both a strip and a square)');
          const cnt = { prime:0, square:0, other:0 };
          e.forEach(v => cnt[kindRef(v)]++);
          if (!(cnt.prime === 2 && cnt.square === 2 && cnt.other === 2)) fail('GAME sort: entry ' + ei + ' needs two of each kind (prime/square/other), got ' + JSON.stringify(cnt));
          if (e.some(v => v > 60)) fail('GAME sort: entry ' + ei + ' has a number over 60');
          neverSorted('sortTray(' + ei + ')', () => D.sortTray(e), v => D.SORT_KINDS.indexOf(kindRef(v)), e);
          e.forEach(v => {
            const k = kindRef(v), r = isqrtRef(v), a = (() => { for (let x = 2; x * x <= v; x++) if (v % x === 0) return x; return 0; })();
            D.SORT_KINDS.forEach(bin => LANGS.forEach(L => {
              const d = I18N[L], why = D.sortWhy(d, v, bin);
              if (bin === k){ if (why !== null) fail('GAME sortWhy(' + v + ', ' + bin + '): the right box is refused'); return; }
              if (why === null){ fail('GAME sortWhy(' + v + ', ' + bin + '): ' + v + ' (' + k + ') is accepted in the ' + bin + ' box'); return; }
              /* 理由說的那件事要真的成立 */
              let want, key;
              if (k === 'prime'){ want = [v, 1, v, 1, v]; key = 'prime'; }
              else if (k === 'square'){ want = bin === 'prime' ? [v, r, r] : [v, r, r, r, r]; key = bin === 'prime' ? 'squareAsPrime' : 'squareAsOther'; if (r * r !== v) fail('GAME sort: ' + v + ' is called a square'); }
              else if (bin === 'prime'){ want = [v, a, v / a, a, v / a]; key = 'otherAsPrime'; if (!(a > 1 && v % a === 0 && v / a > 1)) fail('GAME sort: ' + v + ' = ' + a + ' × ' + v / a + ' is not a real second rectangle'); }
              else { want = [r, r, r * r, r + 1, r + 1, (r + 1) * (r + 1), v]; key = 'otherAsSquare'; if (!(r * r < v && v < (r + 1) * (r + 1))) fail('GAME sort: ' + v + ' is not between ' + r * r + ' and ' + (r + 1) * (r + 1)); }
              say('sortWhy(' + v + ', ' + bin + ')', L, why, want);
              has('sortWhy ' + key + ' (' + v + ')', L, why, BIN_WORDS[key]);
              /* 一個正方形、一個 a × b 長方形都不是「另一條長條」（codex 第一輪 1a #2） */
              hasNot('sortWhy ' + key + ' (' + v + ')', L, why, { zh:['不只排得出一長條'], en:['more than one long strip'] });
            }));
            LANGS.forEach(L => {
              const d = I18N[L], okt = D.sortOkText(d, v), hint = D.sortHintText(d, v);
              if (k === 'prime'){
                say('sortOkText(' + v + ')', L, okt, [v, 1, v, 1, v]); say('sortHintText(' + v + ')', L, hint, [2, v, 1, v]);
                has('sortOkText prime', L, okt, { zh:['只能排成', '是質數'], en:['only makes', 'it is prime'] }); has('sortHintText prime', L, hint, { zh:['只能排成'], en:['only makes'] });
              } else if (k === 'square'){
                say('sortOkText(' + v + ')', L, okt, [v, r, r]); say('sortHintText(' + v + ')', L, hint, [2, v, r, r]);
                has('sortOkText square', L, okt, { zh:['排得出正方形', '是平方數'], en:['makes a square', 'square number'] }); hasNot('sortOkText square', L, okt, { zh:['排不出', '質數'], en:['no square', 'prime'] });
              } else {
                say('sortOkText(' + v + ')', L, okt, [v, a, v / a]); say('sortHintText(' + v + ')', L, hint, [2, v, a, v / a, v]);
                has('sortOkText other', L, okt, { zh:['別的長方形', '排不出正方形'], en:['other rectangles', 'no square'] }); hasNot('sortOkText other', L, okt, { zh:['質數', '平方數'], en:['prime', 'square number'] });
                has('sortHintText other', L, hint, { zh:['沒有一個數乘自己'], en:['no number times itself'] }); hasNot('sortHintText other', L, hint, { zh:['質數'], en:['prime'] });
              }
            });
          });
          LANGS.forEach(L => say('gSortNow', L, I18N[L].gSortNow(3, 6), [3, 6]));
        });
        LANGS.forEach(L => { say('gSortDone', L, I18N[L].gSortDone, [2]); has('gSortDone', L, I18N[L].gSortDone, { zh:['質數只有 2 個因數', '平方數的因數是奇數個'], en:['prime has exactly 2 factors', 'odd number of factors'] }); hasNot('gSortDone', L, I18N[L].gSortDone, { zh:['偶數'], en:['even'] }); ['prime', 'square', 'other'].forEach(k => { if (!I18N[L].gBins[k]) fail('GAME sort: box label ' + k + ' missing in ' + L); }); });
        /* 箱子上下相鄰，放寬之後要真的重疊；整片每 0.5px 和自己的「最近的箱子」比 */
        const zl = bins.map((b, i) => ({ i:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2, done:false }));
        sweep('sort: the drop zones never overlap /', zl, S.pad, 0, W, 0, S.y[2] + S.h + S.pad + 2, 40);
        need('sort', /var bin = nearestOpen\(bins, pt, SORT\.pad\);\s*if \(!bin\) return false;/, 'a drop is not given to the nearest box (or a miss is not silent)');
        need('sort', /var v = P\.data\.v, why = sortWhy\(d, v, bin\.kind\);\s*if \(why\)\{ roundMiss\(why\); return false; \}/, 'the box judged is not the one dropped on (or the card is not the one dropped)');
        need('sort', /var cards = sortTray\(e\)\.map\(/, 'the tray is not laid out from sortTray()');
      }

      /* ================= 第 5 關：因數還是倍數 ================= */
      {
        const R = D.REL, H = D.REL_H;
        if ((D.REL_KINDS || []).join() !== 'f,m,n') fail('GAME rel: the tiles should be factor, multiple, neither');
        tooSmall('rel: word tile', Math.min(R.tileW, R.tileH));
        const rowsBoxes = [];
        for (let j = 0; j < 4; j++){
          const y = R.y0 + j * R.step;
          rowsBoxes.push({ x:R.xl, y:y, w:R.numW, h:R.h, what:'left number ' + j }, { x:R.blankX, y:y, w:R.blankW, h:R.h, what:'blank ' + j }, { x:R.xr, y:y, w:R.numW, h:R.h, what:'right number ' + j });
        }
        rowsBoxes.forEach(b => inside(b, 'rel ' + b.what, H));
        noHits(rowsBoxes, 'rel rows overlap or the blank covers a number:');
        if (!(R.blankX - (R.xl + R.numW) >= 16 && R.xr - (R.blankX + R.blankW) >= 16)) fail('GAME rel: the arrow does not show on both sides of the blank (the blank covers a number)');
        const tiles = R.tileX.map(x => sq(x, R.tileY, R.tileW, R.tileH));
        tiles.forEach((b, i) => inside(b, 'rel tile ' + i, H));
        noHits(tiles.concat(rowsBoxes, [{ x:0, y:R.headY, w:W, h:R.headH }]), 'rel: tiles overlap (or reach the arrows / the heading):');
        for (let a = 1; a <= 60; a++) for (let b = 1; b <= 60; b++){ if (a === b) continue; if (D.relKind(a, b) !== relRef(a, b)){ fail('GAME relKind(' + a + ', ' + b + ') = ' + D.relKind(a, b) + ', should be ' + relRef(a, b)); a = 99; break; } }
        if (!Array.isArray(D.GAME_REL) || D.GAME_REL.length < 4) fail('GAME rel: GAME_REL should hold at least 4 entries');
        const REL_WORDS = {
          fAsM: { zh:['小', '是因數', '才是倍數'], en:['smaller', 'is the factor', 'is the multiple'] },
          fAsN: { zh:['整除', '的因數'], en:['exactly', 'is a factor'] },
          mAsF: { zh:['大', '是倍數'], en:['bigger', 'is a multiple'] },
          mAsN: { zh:['整除', '的倍數'], en:['exactly', 'is a multiple'] },
          nAsFsmall: { zh:['除不盡', '不是'], en:['not exact', 'is not a factor'] },
          nAsFbig: { zh:['大', '不會是'], en:['bigger', 'can’t be a factor'] },
          nAsMbig: { zh:['除不盡', '不是'], en:['not exact', 'is not a multiple'] },
          nAsMsmall: { zh:['小', '不會是'], en:['smaller', 'can’t be a multiple'] }
        };
        D.GAME_REL.forEach((e, ei) => {
          if (!(Array.isArray(e) && e.length === 4)) { fail('GAME rel: entry ' + ei + ' should have four arrows'); return; }
          if (e.some(r => r[0] === r[1])) fail('GAME rel: entry ' + ei + ' has the same number on both ends');
          const kinds = e.map(r => relRef(r[0], r[1]));
          ['f', 'm', 'n'].forEach(k => { if (kinds.indexOf(k) < 0) fail('GAME rel: entry ' + ei + ' needs factor, multiple and neither — ' + k + ' is missing'); });
          neverSorted('relRows(' + ei + ')', () => D.relRows(e).map(r => e.indexOf(r)), i => 'fmn'.indexOf(kinds[i]), [0, 1, 2, 3]);
          e.forEach(([a, b]) => {
            const k = relRef(a, b), big = Math.max(a, b), small = Math.min(a, b), q = Math.floor(big / small), r = big % small;
            const x = D.relQR(a, b);
            if (x.big !== big || x.small !== small || x.q !== q || x.r !== r) fail('GAME relQR(' + a + ', ' + b + ') = ' + JSON.stringify(x));
            if (k === 'n' && r === 0) fail('GAME rel: ' + a + ' → ' + b + ' is called "neither" but divides');
            ['f', 'm', 'n'].forEach(t => LANGS.forEach(L => {
              const d = I18N[L], why = D.relWhy(d, a, b, t);
              if (t === k){ if (why !== null) fail('GAME relWhy(' + a + ', ' + b + ', ' + t + '): the right tile is refused'); return; }
              if (why === null){ fail('GAME relWhy(' + a + ', ' + b + ', ' + t + '): "' + t + '" is accepted on ' + a + ' → ' + b + ' (' + k + ')'); return; }
              let want, key;
              if (k === 'f'){ key = t === 'm' ? 'fAsM' : 'fAsN'; want = t === 'm' ? [a, b, b, a, q, a, b] : [b, a, q, a, b]; }
              else if (k === 'm'){ key = t === 'f' ? 'mAsF' : 'mAsN'; want = t === 'f' ? [a, b, a, b, q, a] : [a, b, q, a, b]; }
              else if (t === 'f'){ key = a < b ? 'nAsFsmall' : 'nAsFbig'; want = a < b ? [b, a, q, r, a, b] : [a, b, b]; }
              else { key = a > b ? 'nAsMbig' : 'nAsMsmall'; want = a > b ? [a, b, q, r, a, b] : [a, b, b]; }
              say('relWhy(' + a + ', ' + b + ', ' + t + ')', L, why, want);
              has('relWhy ' + key + ' (' + a + ', ' + b + ')', L, why, REL_WORDS[key]);
            }));
            LANGS.forEach(L => {
              const d = I18N[L], okt = D.relOkText(d, a, b);
              say('relOkText(' + a + ', ' + b + ')', L, okt, k === 'f' ? [b, a, q, a, b] : k === 'm' ? [a, b, q, a, b] : [big, small, q, r, a, b]);
              const OKSEM = { f:{ has:{ zh:[' 的因數'], en:['is a factor of'] }, not:{ zh:['不是', '倍數'], en:['not', 'multiple'] } },
                              m:{ has:{ zh:[' 的倍數'], en:['is a multiple of'] }, not:{ zh:['不是', '因數'], en:['not', 'factor'] } },
                              n:{ has:{ zh:['除不盡', '不是', '也不是倍數'], en:['not exact', 'neither a factor nor a multiple'] }, not:{ zh:['整除'], en:['exactly'] } } };
              has('relOkText ' + k, L, okt, OKSEM[k].has); hasNot('relOkText ' + k, L, okt, OKSEM[k].not);
              const g2 = d.gRel2(big, small, q, r);
              say('gRel2(' + a + ', ' + b + ')', L, g2, r ? [2, big, small, q, r] : [2, big, small, q]);
              if (r){ has('gRel2', L, g2, { zh:['餘'], en:[' r '] }); hasNot('gRel2', L, g2, { zh:['整除'], en:['exactly'] }); }
              else { has('gRel2', L, g2, { zh:['整除'], en:['exactly'] }); hasNot('gRel2', L, g2, { zh:['餘'], en:[' r '] }); }
            });
          });
        });
        LANGS.forEach(L => { const d = I18N[L]; say('gRelNow', L, d.gRelNow(1, 4), [1, 4]); say('gRelDone', L, d.gRelDone, []);
          has('gRelDone', L, d.gRelDone, { zh:['能整除', '小的當因數', '大的當倍數'], en:['divides exactly', 'the smaller one is the factor', 'the bigger one the multiple'] });
          hasNot('gRelDone', L, d.gRelDone, { zh:['小的當倍數', '大的當因數'], en:['smaller one is the multiple', 'bigger one the factor'] }); say('gRelHead', L, d.gRelHead, []); ['f', 'm', 'n'].forEach(t => { if (!d.gTiles[t]) fail('GAME rel: tile ' + t + ' missing in ' + L); }); });
        const zl = [0, 1, 2, 3].map(j => ({ i:j, cx:R.blankX + R.blankW / 2, cy:R.y0 + j * R.step + R.h / 2, hw:R.blankW / 2, hh:R.h / 2, done:false }));
        sweep('rel: the drop zones never overlap /', zl, R.pad, 60, 240, 0, R.y0 + 3 * R.step + R.h + R.pad + 2, 40);
        need('rel', /var s = nearestOpen\(blanks, pt, REL\.pad\);\s*if \(!s\) return false;/, 'a drop is not given to the nearest blank (or a miss is not silent)');
        need('rel', /var why = relWhy\(d, s\.a, s\.b, P\.data\.t\);\s*if \(why\)\{ roundMiss\(why\); return false; \}/, 'the row judged is not the one dropped on, or the tile judged is not the one dropped');
        need('rel', /var rows = relRows\(pick\(GAME_REL\)\)/, 'the arrows are not laid out from relRows()');
        need('rel', /backHome\(B, P\);/, 'a word tile does not go back to the tray (tiles never run out)');
      }
    }
  }
};
