/* grade-5/math/statistics 的檢查設定（資料偵察隊：長條圖的一格代表多少、折線圖、複合長條圖、選對圖表、會騙人的圖）。
   2026-10-11 新增 —— 和小遊戲「偵察隊出任務」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的九個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算）、選項的形狀與範圍；
   renderCheck 把題目畫出來的圖再驗一次：**沒有寫數字的長條與折線，每一個值都要剛好在一條格線上**（圖決定得了答案），
   解釋裡的算式逐條重算（lib/arith.js），誘答不可以把題幹印出來的數抄回來。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）的算式逐條重算；中文和數字之間要有空格。
   - 題庫的圖：沒有寫數字的圖（折線、複合長條），題目要讀的每一個值都要在格線上；每一題的正解用這裡自己的算法重算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫每一題玩一遍、答案用這裡自己的算法重算：
       畫長條 —— 每一根 × 每一個高度 0～10（barWhy 和自己的規則一致；「把數量當成格數」那一句只在它成立時出現）；
       描點連線 —— 每一個點 × 每一直行 × 每一條線（plotWhy）；變化最大的那一段只有一段；segPick 整片畫板每 1px 和自己的「最近的線段、相接點不算」比；
       讀複合長條圖 —— 0～60 每一個數（groupWhy），每一根長條的頂端在格線上；parseCount 的正反例；
       選對圖表 —— 每一張卡 × 每一個箱子（sortWhy），卡片的種類用這裡自己的表；sortPick 3000 次：三種都有、不會照箱子排；
       抓出騙人的圖 —— 每一組兩張騙人、兩張從 0 開始；騙人的那幾張看起來的倍數 ≥ 1.4、真的倍數 < 1.2；truncPick 每 1px。
     每一句說明兩種語言逐個比數字（它說的那件事也要成立：「太高」就真的比較高、「減少也算變化」只在答案是減少而點的是增加時出現）；
     shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px、標籤放得下從資料區讀；
     RENDER 裡「判斷的是放下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-statistics 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arith = makeArith({ units:['本', '人', '公斤', '杯', '毫米', '度', '把', '個', '格', '分'], unitsEn:['books?', 'people', 'kg', 'cups?', 'mm', 'squares?', 'points?'] });
/* 一句話：沒有 undefined／NaN、英文沒有中文、中文和數字之間有空格、算式全部驗得過 */
function sayProblems(text, L){
  const s = String(text), out = [];
  if (/undefined|NaN|\[object/.test(s)) out.push('undefined/NaN in "' + s + '"');
  if (L === 'en' && /[一-鿿]/.test(s)) out.push('Chinese characters in the English text "' + s + '"');
  if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) out.push('missing space between Chinese and a digit in "' + s + '"');
  /* 「一格 ＝ 5」「1 square = 5」是刻度的定義，不是算式；「總和 = 2+4+…」左邊是名稱（換成冒號）。
     小數的商（「12 ÷ 5 = 2.4」，平均那一課的連結題）lib/arith.js 不收：這裡自己驗，驗過就拿掉 */
  let t = s.replace(/一格\s*[＝=]\s*/g, '一格是 ').replace(/\b1 square\s*=\s*/g, 'one square is ').replace(/([A-Za-z一-鿿])\s*[=＝]\s*(?=\d)/g, '$1：');
  t = t.replace(/(\d+)\s*÷\s*(\d+)\s*[=＝]\s*(\d+\.\d+)/g, (m, a, b, c) => { if (Math.abs(a / b - Number(c)) > 1e-9) out.push('arithmetic: ' + m + ' is wrong'); return 'OK'; });
  const r = arith(t);
  r.problems.forEach(p => out.push('arithmetic: ' + p + ' in "' + s.slice(0, 120) + '"'));
  return out;
}
/* 字串寬度的估計（px）：中文一個字 1 em，其他 0.6 em（粗體、偏寬的估法） */
function textW(s, px, latin){ let w = 0; for (const ch of String(s)) w += /[一-鿿　-〿＀-￯]/.test(ch) ? px : (latin || 0.6) * px; return w; }

/* ---- the test's own tables ---- */
/* 選對圖表：每一張卡是哪一種（這裡自己的判斷，不讀頁面的 SORT_TYPES） */
const CARD_KIND = {
  '四種水果各有幾人喜歡':'bar', '五個年級各有幾人參賽':'bar', '四種飲料各賣出幾杯':'bar',
  '豆芽 10 天裡長高的變化':'line', '一年 12 個月雨量的升降':'line', '這學期每週跳繩次數的變化':'line',
  '男生女生最喜歡的水果':'grouped', '兩班參加四種球隊的人數':'grouped', '兩家店四種飲料的銷量':'grouped',
  'Votes for 4 fruits':'bar', 'Players from 5 grades':'bar', 'Cups of 4 drinks sold':'bar',
  'Change in bean height':'line', 'Monthly rain trend':'line', 'Change in rope skips':'line',
  'Boys vs girls: fruits':'grouped', '2 classes in 4 teams':'grouped', '2 shops, 4 drinks sold':'grouped'
};
const BIN_NAME = { zh:{ bar:'長條圖', line:'折線圖', grouped:'複合長條圖' }, en:{ bar:'Bar chart', line:'Line graph', grouped:'Grouped bar' } };

function checkData(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], EPS = 1e-9;
  const gsrc = src.slice(src.indexOf('小遊戲：偵察隊出任務'));
  const say = (where, L, text, want) => {
    sayProblems(text, L).forEach(p => fail(where + ' ' + L + ': ' + p));
    if (want){ const got = nums(text).map(String); if (got.join() !== want.map(String).join()) fail(where + ' ' + L + ': reads ' + got.join(',') + ', expected ' + want.join(',') + ' — "' + String(text).slice(0, 140) + '"'); }
  };
  const fin = v => typeof v === 'number' && isFinite(v);

  /* ===== 1. 所有靜態字串：算式、英文沒有中文、中文和數字之間有空格 ===== */
  LANGS.forEach(L => {
    const d = I18N[L];
    const walk = (v, path) => {
      if (typeof v === 'string') sayProblems(v, L).forEach(p => fail('I18N.' + L + '.' + path + ': ' + p));
      else if (Array.isArray(v)) v.forEach((x, i) => walk(x, path + '[' + i + ']'));
      else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (k !== 'cats') walk(v[k], path + '.' + k); });
    };
    Object.keys(d).forEach(k => { if (typeof d[k] !== 'function' && !(L === 'en' && k === 'btn')) walk(d[k], k); });   /* en.btn 是「中」：切換到中文的按鈕 */
  });

  /* ===== 2. 題庫：圖決定得了答案、正解用自己的算法重算 ===== */
  const qsum = a => a.reduce((x, y) => x + y, 0);
  LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
    const where = bank + '[' + i + '] ' + L;
    const vals = q.values || (q.a ? q.a.concat(q.b) : q.squares ? q.squares.map(s => s * q.unit) : null);
    /* 沒有寫數字的圖：題目要讀的值都要在格線上（和頁面 renderQuizChart 一樣的軸） */
    if (['line', 'line-two-step', 'grouped', 'grouped-two-step'].indexOf(q.kind) >= 0){
      /* 軸的刻度：這裡自己的表（≤ 10 → 1、≤ 20 → 2、≤ 50 → 5、其他 10），再和頁面的 niceStep 比 */
      const mx = Math.max(...vals), step = mx <= 10 ? 1 : mx <= 20 ? 2 : mx <= 50 ? 5 : 10;
      if (D.niceStep(mx) !== step) fail(where + ': niceStep(' + mx + ') = ' + D.niceStep(mx) + ', expected ' + step);
      const axMax = Math.ceil((mx + 0.0001) / step) * step;   /* 這裡自己算：比最大值高的下一條線 */
      if (D.niceAxisMax(mx, step) !== axMax) fail(where + ': niceAxisMax(' + mx + ', ' + step + ') = ' + D.niceAxisMax(mx, step) + ', expected ' + axMax + ' (the axis must cover ' + mx + ')');
      if (axMax / step + 1 > 12) fail(where + ': ' + (axMax / step + 1) + ' grid lines — the tick labels collide');
      const off = vals.filter(v => v % step);
      const asked = q.kind === 'line' ? [q.values[1], q.values[2]] : q.kind === 'grouped' ? [q.a[1], q.b[1]] : vals;
      const offAsked = asked.filter(v => v % step);
      if (offAsked.length) fail(where + ': the chart has no value labels and ' + offAsked.join(',') + ' sit between grid lines (step ' + step + ') — the picture does not determine the answer');
      void off;
    }
    const ans = String(q.opts[q.ans]);
    let want = null;
    if (q.kind === 'bar-read') want = String(q.squares[q.qIdx] * q.unit);
    if (q.kind === 'bar-total') want = String(qsum(q.values));
    if (q.kind === 'bar-avg') want = String(qsum(q.values) / q.values.length);
    if (q.kind === 'grouped') want = String(Math.abs(q.a[1] - q.b[1]));
    if (q.kind === 'misleading' && /^\d+$/.test(ans)) want = String(q.values[1] - q.values[0]);
    if (want !== null && ans !== want) fail(where + ': the marked answer is ' + ans + ', recomputed ' + want);
    if (q.kind === 'misleading' && !(q.axisMin > 0)) fail(where + ': a "misleading" chart that starts at 0');
    if (q.kind === 'line-two-step'){
      const dd = [0, 1, 2].map(j => q.values[j + 1] - q.values[j]), best = dd.indexOf(Math.max(...dd));
      if (nums(ans).slice(-1)[0] !== dd[best] || (L === 'zh' ? nums(ans)[0] !== best + 1 : ans.indexOf(['Jan', 'Feb', 'Mar'][best]) !== 0)) fail(where + ': the marked answer "' + ans + '" is not the biggest increase (' + dd.join(',') + ')');
    }
    if (q.kind === 'grouped-two-step'){
      const A = qsum(q.a), B = qsum(q.b);
      if (nums(ans).slice(-1)[0] !== Math.abs(A - B) || !(B > A ? /二班|Class 2/ : /一班|Class 1/).test(ans)) fail(where + ': the marked answer "' + ans + '" is not ' + (B > A ? 'class 2' : 'class 1') + ' by ' + Math.abs(A - B));
    }
  })));

  /* ===== 3. 小遊戲 ===== */
  const TYPES = ['bar', 'plot', 'group', 'sort', 'trunc'];
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1–5 in order), got ' + D.GAME_ORDER);
  const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const RB = {};
  TYPES.forEach(t => {
    RB[t] = body(t);
    if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
      if (typeof a !== 'string' || (t !== 'group' && !a)) fail('GAME: gAsks.' + t + ' missing in ' + L);
      if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };
  const W = 300, scale = (375 - 40 - 44) / W;   /* 375px 手機：頁面左右 20、卡片左右 22 → 畫板寬 291px */
  const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
  const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  if (!(D.GPICK >= 46)) tooSmall('GPICK', D.GPICK);
  /* 文字框（中文 1 em、其他 0.6 em 寬；1.45 em 高）*/
  const lbl = (x, y, s, px, anchor) => { const w = textW(s, px), h = 1.45 * px; return { x:anchor === 'end' ? x - w : anchor === 'start' ? x : x - w / 2, y:y - 1.1 * px, w:w, h:h }; };

  /* --- 計分與引擎：從原始碼切出來真的跑 --- */
  {
    const rs = extractFunction(gsrc, 'roundSolved');
    if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint — a level-2 hint stays on the solved board');
  }
  need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
  {
    const fsrc = extractFunction(gsrc, 'roundMiss');
    if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
    else {
      const run = (s0, keys) => new Function('var gMistake = false, gScore = ' + s0 + ', gCtx = {}, elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc +
        '\nvar out = []; ' + JSON.stringify(keys) + '.forEach(function(k){ roundMiss("why " + k, k); out.push({ s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake }); }); return out;')();
      let r;
      try {
        [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          r = run(s0, ['a'])[0];
          if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5, or the score goes below 0');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why a') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
        });
        r = run(20, ['a', 'a', 'b', 'a']);
        if (r.map(x => x.s).join() !== '15,15,10,10') fail('GAME scoring: the same mistake again is charged again (scores ' + r.map(x => x.s).join() + ', expected 15,15,10,10)');
        if (r[1].html.indexOf('@MINUS@') >= 0 || r[1].html.indexOf('why a') < 0) fail('GAME scoring: a repeated mistake should show its reason again without "−5"');
      } catch (e){ fail('GAME scoring: roundMiss() could not run: ' + e.message); }
    }
  }
  if (/function roundNote\(text\)\{[^}]*(gMistake|gScore)/.test(gsrc)) fail('GAME: roundNote() changes the score or records a mistake');
  /* 每一個 roundMiss 都帶著「哪一個錯」的 key（同一個錯不重複扣分要靠它） */
  need('bar', /, first \+ ':' \+ h\);/, 'mistake key: Done is not keyed by (bar, height) — the bar judged');
  need('plot', /roundMiss\(d\.gPlotCol\(months\[m\]\), m \+ '>c' \+ cell\.i\);/, 'mistake key: a point in a wrong column is not keyed by (point, column)');
  need('plot', /roundMiss\(d\.gPlotOff\(months\[m\], e\.vals\[m\], cell\.k \* e\.s\), m \+ '>' \+ cell\.i \+ ':' \+ cell\.k\);/, 'mistake key: a point at a wrong height is not keyed by (point, cell)');
  need('plot', /roundMiss\(d\.gSegBad\(txt, segDelta\(e\.vals, best\) < 0 && segDelta\(e\.vals, j\) > 0\), 's' \+ j\);/, 'the "going down counts too" sentence is not tied to (answer goes down AND the tapped piece goes up), or the key is not the piece');
  need('group', /roundMiss\(d\.gGroupSwap\(n, e\.kind\), 'n' \+ n\);/, 'mistake key: a typed number is not keyed by the number');
  need('group', /roundMiss\(d\.gGroupOne\(n, n === a \? A : Bn, e\.kind\), 'n' \+ n\);/, 'the "just one class" reason does not name the class whose bar it is');
  need('group', /roundMiss\(d\.gGroupOff\(n, why === 'high'\), 'n' \+ n\);/, 'mistake key: a typed number is not keyed by the number');
  need('sort', /if \(why\)\{ roundMiss\(d\.gSortWhy\(d\.gSortCards\[c\], d\.gSortWhyKind\[why\], d\.gSortBins\[SORT_BINS\.indexOf\(why\)\]\), c \+ '>' \+ bin\.b\); return false; \}/, 'a wrong card does not name ITS OWN box, or the key is not (card, box)');
  need('trunc', /roundMiss\(d\.gTruncBad\(d\.gTruncNo\[i\], c\.a, c\.b\), 'c' \+ i\);/, 'mistake key: an honest chart is not keyed by the chart');
  if ((gsrc.match(/roundMiss\(/g) || []).length !== 10) fail('GAME: roundMiss() is called ' + (gsrc.match(/roundMiss\(/g) || []).length + ' times, expected 10 (definition + bar + 2 plot + seg + 3 group + sort + trunc) — a new call has an unchecked key');
  LANGS.forEach(L => {
    const d = I18N[L];
    if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
    if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
    say('gWin', L, d.gWin(85), ['85']);
  });
  /* shuffle()：切出來真的跑 */
  {
    const fsrc = extractFunction(src, 'shuffle'), rsrc = extractFunction(src, 'rand');
    let fn = null;
    try { fn = new Function(rsrc + '\n' + fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); }
    if (fn){
      const seen = new Set();
      for (let i = 0; i < 400; i++){
        const a = [1, 2, 3, 4], r = fn(a);
        if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
        seen.add(r.join());
      }
      if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
    }
  }
  /* nearestOpen()：切出來真的跑 */
  {
    const fsrc = extractFunction(gsrc, 'nearestOpen');
    let nearestOpen = null;
    try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated'); }
    if (nearestOpen){
      const two = [{ id:0, cx:60, cy:100, hw:60, hh:40, done:false }, { id:1, cx:140, cy:100, hw:20, hh:20, done:false }];
      const r0 = nearestOpen(two, { x:115, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:144, cy:100, hw:20, hh:20, done:false }];
      if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
      const pair = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:false }, { id:1, cx:146, cy:100, hw:20, hh:20, done:false }];
      const r1 = nearestOpen(pair, { x:124.5, y:100 }, 6);
      if (!r1 || r1.id !== 1) fail('GAME nearestOpen(): a drop in the overlap nearer to the second box goes to the first match');
      /* 這一課的三個箱子：整片每 1px 和自己的「最近的方框」比，重疊處要真的存在 */
      const bins = D.SORT_BINS.map((t, b) => ({ b:b, cx:D.sortBinX(b) + D.SORT.binW / 2, cy:D.SORT.binY + D.sortBinH() / 2, hw:D.SORT.binW / 2, hh:D.sortBinH() / 2, done:false }));
      let overlap = 0, bad = 0;
      for (let x = -20; x <= W + 20; x += 1) for (let y = -20; y <= D.SORT.H; y += 4){
        const inPad = bins.filter(b => Math.abs(x - b.cx) <= b.hw + D.SORT.pad && Math.abs(y - b.cy) <= b.hh + D.SORT.pad);
        if (inPad.length > 1) overlap++;
        let want = null, bd = Infinity;
        inPad.forEach(b => { const dd = Math.hypot(Math.max(0, Math.abs(x - b.cx) - b.hw), Math.max(0, Math.abs(y - b.cy) - b.hh)); if (dd < bd - EPS || (Math.abs(dd - bd) < EPS && Math.abs(x - b.cx) < Math.abs(x - want.cx))){ bd = dd; want = b; } });
        const got = nearestOpen(bins, { x:x, y:y }, D.SORT.pad);
        if ((got ? got.b : -1) !== (want ? want.b : -1)) bad++;
      }
      if (bad) fail('GAME sort: nearestOpen() disagrees with the nearest box at ' + bad + ' points');
      if (!overlap) fail('GAME sort: the boxes\' padded drop zones never overlap — the nearest-box rule is untested');
    }
  }
  /* 拖拉引擎的保護（原始碼形狀） */
  need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
  need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
  need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
  need(null, /if \(gen !== gGen\) return;/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
  need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
  need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
  need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
  need(null, /if \(o\.axis === 'y'\) P\.place\(orig\.x, o\.snapY\(orig\.y \+ dy\)\);/, 'the bar handle does not snap to a grid line while it is dragged');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('GAME engine: placed pieces still catch taps');
  if (/class':'gsvg', width:W, height:H, viewBox/.test(gsrc) || !/var s = gEl\('svg', \{ 'class':'gsvg', width:W, height:H, 'aria-hidden':'true' \}\);/.test(gsrc)) fail('GAME: the game SVG must not have a viewBox (the page\'s label fitter would stretch it off the snap / tap geometry)');
  ['plot', 'sort'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
  need(null, /document\.addEventListener\('pointerup', onDocEnd\);\s*document\.addEventListener\('pointercancel', onDocEnd\);/, 'a release that reaches only the document (pointerup / pointercancel, no capture) no longer puts the held piece back');
  need(null, /if \(!moved && dx \* dx \+ dy \* dy > 36\)\{/, 'the tap-vs-drag threshold is not 6px (a jittery tap must still select; a slide must not)');
  need(null, /if \(t\.far \|\| Math\.hypot\(e\.clientX - t\.x, e\.clientY - t\.y\) > 10\) return;/, 'a board press that slides away still counts as a tap');
  need(null, /if \(B\.onBoardTap && !gSolved\) B\.onBoardTap\(pt\);/, 'board taps still act after the round is solved');
  need('bar', /if \(i < 0 \|\| ok\[i\] \|\| handles\[i\]\.busy\(\)/, 'a bar already judged right can still be moved by a tap in its column');
  need('trunc', /if \(i < 0 \|\| found\[i\]\) return;/, 'a chart already found can be counted again');
  /* 沒有視覺洩題：情境卡一律同一個樣子（class 不帶種類） */
  need('sort', /cls:'gcard gscard', text:d\.gSortCards\[c\], data:\{ c:c \}/, 'the sort cards are not all one neutral style (a style that depends on the card would give the answer away)');
  if (/SORT_TYPES\[c\][^;]*cls|cls:[^,]*SORT_TYPES/.test(RB.sort || '')) fail('GAME sort: a card\'s class depends on its type — the answer is visible');
  need('bar', /B\.onBoardTap = function\(pt\)\{ setH\(gColOf\(ch, pt\.x\), pt\); \};/, 'tapping a grid line in a column does not move that bar (the tap alternative)');
  need('bar', /B\.onTap = function\(P, pt\)\{ setH\(P\.data\.i, pt\); \};/, 'a tap on a handle does not move the bar to the tapped line (the handle covers part of its own column)');
  need('bar', /handles\.forEach\(function\(P, i\)\{ if \(P\.busy\(\)\) P\.rehome\(ch\.cx\[i\], gLineY\(ch, hs\[i\]\)\); \}\);/, 'Done does not end a held handle first (it would judge one height and keep showing another)');
  need('bar', /var why = barWhy\(e, i, h\);/, 'Done does not judge the drawn height of each bar');
  need('bar', /onPlace:function\(P\)\{ var k = gSnapK\(ch, P\.cy\); if \(k !== hs\[i\]\)\{ hs\[i\] = k; drawBar\(i\); show\(i\); \} \}/, 'the bar does not follow its handle (snapped) while dragged');
  need('bar', /gGrid\(s, ch, function\(k\)\{ return k \* e\.u; \}, barLabelled\);/, 'the bar chart\'s tick labels are not k × (one square)');
  need('plot', /var m = P\.data\.m, why = plotWhy\(e, m, cell\.i, cell\.k\);/, 'the point judged is not the one dropped');
  need('plot', /var cell = plotCell\(ch, \{ x:P\.cx, y:P\.cy \}\);\s*preview\(cell\);\s*line\.textContent = cell \? d\.gPlotAt\(months\[cell\.i\], cell\.k \* e\.s\)/, 'the preview while dragging is not the cell that will be judged');
  need('plot', /if \(phase !== 2\) return;\s*var j = segPick\(ch, e, pt\);\s*if \(j < 0\) return;/, 'a tap on the line before every point is placed is not ignored (phase guard), or a tap off the line / on a joint is not');
  need('group', /var n = parseCount\(inp\.value\);\s*if \(n === null\)\{ roundNote\(d\.gTypeInt\); return; \}/, 'a badly written number is not just a reminder');
  need('group', /var why = groupWhy\(e, n\), a = e\.a\[e\.k\], b = e\.b\[e\.k\];/, 'the number judged is not the one typed');
  need('group', /s\.appendChild\(gEl\('rect', \{ x:g\.x, y:y, width:g\.w, height:ch\.y1 - y, rx:3, fill:side \? hatch : COLOR_GREEN, 'class':side \? 'gbarB' : 'gbarA', 'data-i':i \}\)\);/, 'class 1 is not solid green and class 2 hatched (the key would lie)');
  need('sort', /var c = P\.data\.c, why = sortWhy\(c, bin\.b\);/, 'the card judged is not the one dropped');
  need('sort', /text:d\.gSortCards\[c\], data:\{ c:c \} \}\);/, 'a card does not show the job it is judged as');
  need('sort', /addZone\(B, x \+ 2, SORT\.binY \+ SORT\.lblY, SORT\.binW - 4, SORT\.lblH - SORT\.lblY - 2, 'gbinlbl', d\.gSortBins\[b\]\);/, 'a box does not show the chart it is judged as');
  need('trunc', /var i = truncPick\(pt\);\s*if \(i < 0 \|\| found\[i\]\) return;/, 'a tap between charts or on a found chart is not ignored');
  need('trunc', /if \(!truncLie\(c\)\)\{/, 'the chart judged is not the one tapped');
  need('trunc', /for \(var v = c\.min; v <= c\.max; v \+= c\.step\)\{/, 'the side axis does not label every line from the bottom (the bottom number is what the round is about)');

  /* --- 第 1 關：畫長條 --- */
  {
    const B = D.BAR, ch = D.barChart();
    if (ch.rows !== 10 || Math.abs(ch.cellH * 10 - (B.y1 - B.y0)) > EPS) fail('GAME bar: the chart is not 10 squares');
    if (!(D.GAME_BAR.length >= 4)) fail('GAME bar: fewer than 4 entries');
    D.GAME_BAR.forEach((e, n) => {
      const where = 'GAME bar[' + n + ']';
      if ([2, 5, 10].indexOf(e.u) < 0) fail(where + ': one square = ' + e.u + ' (must not be 1 — the round is about a scale that is not 1)');
      if (e.vals.length !== 4) fail(where + ': not 4 bars');
      e.vals.forEach(v => { if (!(isInt(v / e.u) && v / e.u >= 1 && v / e.u <= 10)) fail(where + ': ' + v + ' is not a whole number of squares that fits the 10-square chart'); });
      if (!e.vals.some(v => v <= 10 && v !== v / e.u)) fail(where + ': no value ≤ 10 — the "number drawn as squares" misconception cannot be drawn, its explanation never shows');
      LANGS.forEach(L => {
        const cats = I18N[L][e.cat], unit = I18N[L].gUnits[e.unit];
        if (!Array.isArray(cats) || cats.length < 4 || !unit) { fail(where + ' ' + L + ': no item names / unit'); return; }
        cats.slice(0, 4).forEach(c => { if (textW(c, 13) > ch.slot - 4) fail(where + ' ' + L + ': item "' + c + '" (' + textW(c, 13).toFixed(0) + 'px) does not fit its column (' + (ch.slot - 4).toFixed(0) + ')'); if (textW(c, 13) > ch.slot - 6) fail(where + ' ' + L + ': table cell "' + c + '" too wide'); });
        /* 每一根 × 每一個高度：barWhy 和自己的規則一致；說明的數字與意思都成立 */
        e.vals.forEach((v, i) => {
          for (let h = 0; h <= 10; h++){
            const own = h * e.u === v ? null : h === 0 ? 'empty' : h === v ? 'count' : h * e.u > v ? 'high' : 'low';
            const got = D.barWhy(e, i, h);
            if (got !== own) fail(where + ' bar ' + i + ' at ' + h + ' squares: barWhy says ' + got + ', expected ' + own);
          }
          if (L !== 'zh') return;   /* 說明兩種語言一起驗（下面），只驗一次 */
          LANGS.forEach(L2 => {
            const d = I18N[L2], cat = I18N[L2][e.cat][i], u2 = d.gUnits[e.unit];
            for (let h = 1; h <= 10; h++){
              const own = h * e.u === v ? null : h === v ? 'count' : h * e.u > v ? 'high' : 'low';
              if (!own) continue;
              if (own === 'count'){
                const t = d.gBarCount(cat, h, e.u, u2);
                say(where + ' gBarCount', L2, t);
                if (t.indexOf(h + ' × ' + e.u + (L2 === 'zh' ? ' ＝ ' : ' = ') + h * e.u) < 0 || t.indexOf(h + ' ÷ ' + e.u) < 0) fail(where + ' gBarCount ' + L2 + ': does not say ' + h + ' × ' + e.u + ' = ' + h * e.u + ' and ' + h + ' ÷ ' + e.u);
              } else {
                const t = d.gBarOff(cat, h, e.u, v, u2);
                say(where + ' gBarOff', L2, t);
                if (t.indexOf(h + ' × ' + e.u + (L2 === 'zh' ? ' ＝ ' : ' = ') + h * e.u) < 0 || t.indexOf(String(v)) < 0) fail(where + ' gBarOff ' + L2 + ': does not say ' + h + ' × ' + e.u + ' = ' + h * e.u + ' against ' + v);
                const says = L2 === 'zh' ? (/多了/.test(t) ? 'high' : /少了/.test(t) ? 'low' : '?') : (/— more than/.test(t) ? 'high' : /— less than/.test(t) ? 'low' : '?');
                if (says !== own) fail(where + ' gBarOff ' + L2 + ': at ' + h + ' squares it says ' + says + ' but it is ' + own + ' — "' + t + '"');
              }
            }
            const h2 = d.gBarH2(cat, v, e.u, u2);
            say(where + ' gBarH2', L2, h2.replace(cat, ''), [v, v, e.u, v / e.u, v / e.u]);
          });
        });
        /* 照遊戲的規則玩一遍：每一根拉到 v ÷ u → 全部對 */
        if (e.vals.some((v, i) => D.barWhy(e, i, v / e.u) !== null)) fail(where + ': drawing every bar at value ÷ u is not accepted');
        say(where + ' gBarCap', L, I18N[L].gBarCap(e.u, unit), L === 'zh' ? [e.u] : [1, e.u]);
        say(where + ' gBarWin', L, I18N[L].gBarWin(e.u), [e.u]);
      });
    });
    /* 縱軸只在雙數格寫數字、兩個標籤不擠；吸附：每 0.5px 和自己的「最近的格線」比 */
    for (let k = 0; k <= 10; k++) if (D.barLabelled(k) !== (k % 2 === 0)) fail('GAME bar: line ' + k + ' labelled=' + D.barLabelled(k) + ' — only the even lines are labelled (the odd lines must be counted: that is "one square = u")');
    if (2 * ch.cellH < 18) fail('GAME bar: labelled lines are only ' + 2 * ch.cellH + 'px apart');
    for (let y = B.y0 - 40; y <= B.y1 + 40; y += 0.5){
      const own = Math.max(0, Math.min(10, Math.round((B.y1 - y) / ch.cellH)));
      if (D.gSnapK(ch, y) !== own){ fail('GAME gSnapK(): at y ' + y + ' gives ' + D.gSnapK(ch, y) + ', nearest line is ' + own); break; }
    }
    for (let x = 0; x <= W; x += 0.5){
      const own = x < ch.x0 || x >= ch.x1 ? -1 : Math.floor((x - ch.x0) / ch.slot);
      if (D.gColOf(ch, x) !== own){ fail('GAME gColOf(): at x ' + x + ' gives ' + D.gColOf(ch, x) + ', expected ' + own); break; }
    }
    /* 版面：把手不互相重疊、不蓋到標題字（最高 10 格時）與項目名（0 格時）、在畫板裡 */
    const hs = ch.cx.map(cx => sq(cx, B.y1, B.handle, B.handle));
    for (let i = 0; i + 1 < 4; i++) if (hit(hs[i], hs[i + 1])) fail('GAME bar: handles ' + i + ' and ' + (i + 1) + ' overlap');
    tooSmall('bar handle', B.handle);
    LANGS.forEach(L => D.GAME_BAR.forEach(e => {
      const cap = lbl(4, B.capY, I18N[L].gBarCap(e.u, I18N[L].gUnits[e.unit]), 14, 'start');
      ch.cx.forEach((cx, i) => {
        if (hit(sq(cx, B.y0, B.handle, B.handle), cap)) fail('GAME bar ' + L + ': a handle at 10 squares covers the caption "' + I18N[L].gBarCap(e.u, I18N[L].gUnits[e.unit]) + '"');
        const cl = lbl(cx, B.catY, I18N[L][e.cat][i], 13);
        if (hit(hs[i], cl)) fail('GAME bar ' + L + ': a handle at 0 covers the item name ' + I18N[L][e.cat][i]);
        inside(cl, 'bar item name', B.H);
      });
      if (B.tblY + 2 * B.tblRowH > cap.y) fail('GAME bar: the table runs into the caption');
      if (cap.y + cap.h > B.y0 - 6) fail('GAME bar ' + L + ': the caption runs into the top tick label');
    }));
    inside(sq(ch.cx[3], B.y0, B.handle, B.handle), 'bar handle at the top', B.H);
  }

  /* --- 第 2 關：描點連線＋變化最大的一段 --- */
  {
    const P = D.PLOT;
    let decrBest = 0, incrBest = 0;
    D.GAME_PLOT.forEach((e, n) => {
      const where = 'GAME plot[' + n + ']', ch = D.plotChart(e);
      if (e.vals.length !== 5) fail(where + ': not 5 months');
      if (e.from + 5 > 12) fail(where + ': runs past December');
      e.vals.forEach(v => { if (!(isInt(v / e.s) && v > 0 && v / e.s <= e.rows)) fail(where + ': ' + v + ' is not on a grid line of the ' + e.rows + '-line chart (step ' + e.s + ')'); });
      if (ch.cellH < 18) fail(where + ': grid lines ' + ch.cellH + 'px apart — tick labels collide');
      const dd = [0, 1, 2, 3].map(j => e.vals[j + 1] - e.vals[j]);
      if (dd.some(x => x === 0)) fail(where + ': a flat piece');
      const mx = Math.max(...dd.map(Math.abs)), bests = dd.map((x, j) => Math.abs(x) === mx ? j : -1).filter(j => j >= 0);
      if (bests.length !== 1) fail(where + ': ' + bests.length + ' pieces share the biggest change — the answer is not unique');
      if (D.segBest(e.vals) !== bests[0]) fail(where + ': segBest says ' + D.segBest(e.vals) + ', the biggest change is piece ' + bests[0]);
      if (dd[bests[0]] < 0){ decrBest++; if (!(Math.abs(dd[bests[0]]) > Math.max(...dd))) fail(where + ': the biggest change goes down but is not bigger than every rise'); }
      else incrBest++;
      /* plotWhy：每一個點 × 每一直行 × 每一條線 */
      for (let m = 0; m < 5; m++) for (let i = 0; i < 5; i++) for (let k = 0; k <= e.rows; k++){
        const own = i !== m ? 'col' : k * e.s === e.vals[m] ? null : k * e.s > e.vals[m] ? 'high' : 'low';
        if (D.plotWhy(e, m, i, k) !== own){ fail(where + ': plotWhy(' + m + ', ' + i + ', ' + k + ') = ' + D.plotWhy(e, m, i, k) + ', expected ' + own); }
      }
      /* plotCell：整片畫板每 1px */
      for (let x = 0; x <= W; x += 1) for (let y = 0; y <= P.H; y += 1){
        const inZ = x >= ch.x0 && x < ch.x1 && y >= ch.y0 - ch.cellH / 2 && y <= ch.y1 + ch.cellH / 2;
        const got = D.plotCell(ch, { x:x, y:y });
        if (!inZ){ if (got){ fail(where + ': plotCell accepts (' + x + ',' + y + ') outside the chart'); x = W + 1; break; } continue; }
        const own = { i:Math.floor((x - ch.x0) / ch.slot), k:Math.max(0, Math.min(e.rows, Math.round((ch.y1 - y) / ch.cellH))) };
        if (!got || got.i !== own.i || got.k !== own.k){ fail(where + ': plotCell(' + x + ',' + y + ') = ' + JSON.stringify(got) + ', expected ' + JSON.stringify(own)); x = W + 1; break; }
      }
      /* segPick：整片每 1px 和自己的「最近的線段（≤ segHit）、相接的點附近不算」比；每一段的 25/50/75% 都點得到 */
      const pts = e.vals.map((v, i) => ({ x:ch.cx[i], y:ch.y1 - v / e.s * ch.cellH }));
      const dist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y; let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy); t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
      /* 參考值用寫死的 16 / 10（不讀頁面的常數：頁面把 segHit 改成 1，參考值也跟著縮就驗不到了） */
      if (P.segHit !== 16 || P.vtxSkip !== 10) fail(where + ': segHit / vtxSkip are ' + P.segHit + ' / ' + P.vtxSkip + ', expected 16 / 10 (a 32px-wide line target, joints ignored within 10px)');
      let segBad = 0;
      for (let x = 0; x <= W; x += 1) for (let y = 0; y <= P.H; y += 1){
        let own = -1, bd = Infinity;
        if (![1, 2, 3].some(v => Math.hypot(x - pts[v].x, y - pts[v].y) < 10))
          for (let j = 0; j < 4; j++){ const q = dist({ x:x, y:y }, pts[j], pts[j + 1]); if (q <= 16 && q < bd){ bd = q; own = j; } }
        if (D.segPick(ch, e, { x:x, y:y }) !== own) segBad++;
      }
      if (segBad) fail(where + ': segPick disagrees with the nearest piece of line at ' + segBad + ' points');
      for (let j = 0; j < 4; j++) [0.25, 0.5, 0.75].forEach(f => {
        const p = { x:pts[j].x + (pts[j + 1].x - pts[j].x) * f, y:pts[j].y + (pts[j + 1].y - pts[j].y) * f };
        if (D.segPick(ch, e, p) !== j) fail(where + ': a tap ' + f * 100 + '% along piece ' + j + ' does not pick it');
      });
      if (P.vtxSkip >= ch.slot / 4) fail('GAME plot: the joint dead zone (' + P.vtxSkip + ') eats a quarter of a piece');
      /* 說明：每一段都說對方向、數字；「減少也算變化」只在答案減少而這一段增加時 */
      LANGS.forEach(L => {
        const d = I18N[L], mo = d.MONTHS.slice(e.from, e.from + 5);
        for (let j = 0; j < 4; j++){
          const txt = d.gSegText(mo[j], mo[j + 1], e.vals[j], e.vals[j + 1]);
          say(where + ' gSegText', L, txt, [e.vals[j], e.vals[j + 1], Math.abs(dd[j])]);
          const dir = L === 'zh' ? (/增加/.test(txt) ? 1 : /減少/.test(txt) ? -1 : 0) : (/, up /.test(txt) ? 1 : /, down /.test(txt) ? -1 : 0);
          if (dir !== Math.sign(dd[j])) fail(where + ' gSegText ' + L + ': piece ' + j + ' says the wrong direction — "' + txt + '"');
          if (j === bests[0]) { say(where + ' gSegWin', L, d.gSegWin(txt)); continue; }
          const decr = dd[bests[0]] < 0 && dd[j] > 0, t = d.gSegBad(txt, decr);
          say(where + ' gSegBad', L, t);
          if (decr && !(Math.abs(dd[bests[0]]) > dd[j])) fail(where + ' gSegBad ' + L + ': "goes down by more than this goes up" is false');
        }
        mo.forEach((m, i) => {
          if (textW(m, 13) > P.chipW - 10) fail(where + ' ' + L + ': month "' + m + '" does not fit its point card');
          if (textW(m, 13) > ch.slot - 4) fail(where + ' ' + L + ': month "' + m + '" does not fit its column');
          const h2 = d.gPlotH2(m, e.vals[i]);
          say(where + ' gPlotH2', L, h2, [e.vals[i], e.vals[i]]);
          const off = e.vals[i] + e.s <= e.rows * e.s ? e.vals[i] + e.s : e.vals[i] - e.s;
          const t = d.gPlotOff(m, e.vals[i], off);
          say(where + ' gPlotOff', L, t, [e.vals[i], off]);
          if (/太高|too high/.test(t) !== off > e.vals[i]) fail(where + ' gPlotOff ' + L + ': says too high/low the wrong way round — "' + t + '"');
          say(where + ' gPlotCol', L, d.gPlotCol(m));
        });
        const h2 = d.gSegH2(dd.map((x, j) => mo[j] + '→' + mo[j + 1] + ' ' + (x > 0 ? '+' : '−') + Math.abs(x)));
        say(where + ' gSegH2', L, h2);
      });
    });
    if (decrBest < 2 || incrBest < 1) fail('GAME plot: the pool needs ≥ 2 entries whose biggest change goes DOWN (the "only rises count" trap) and ≥ 1 that goes up (' + decrBest + ' / ' + incrBest + ')');
    /* 托盤：五張卡在畫板裡、不重疊、不碰到月份名；觸控夠大 */
    const chips = [0, 1, 2, 3, 4].map(j => sq(D.plotTrayX(j), P.trayY, P.chipW, D.GPICK));
    chips.forEach((c, j) => inside(c, 'plot card ' + j, P.H));
    for (let j = 0; j + 1 < 5; j++) if (hit(chips[j], chips[j + 1])) fail('GAME plot: tray cards ' + j + ' and ' + (j + 1) + ' overlap');
    if (P.trayY - D.GPICK / 2 < P.catY + 6) fail('GAME plot: the tray touches the month names');
    tooSmall('plot card', Math.min(P.chipW, D.GPICK));
  }

  /* --- 第 3 關：讀複合長條圖 --- */
  {
    const G = D.GROUP, ch = D.groupChart();
    if (G.rows * G.step !== 20 || ch.cellH < 18) fail('GAME group: the chart is not 0–20 in steps of 2 with room for every tick label');
    D.GAME_GROUP.forEach((e, n) => {
      const where = 'GAME group[' + n + ']';
      e.a.concat(e.b).forEach(v => { if (!(isInt(v / G.step) && v > 0 && v <= G.rows * G.step)) fail(where + ': ' + v + ' is not on a grid line (the bars have no value labels — the picture must determine the answer)'); });
      const a = e.a[e.k], b = e.b[e.k], ans = e.kind === 'diff' ? Math.abs(a - b) : a + b, swap = e.kind === 'diff' ? a + b : Math.abs(a - b);
      if (['diff', 'total'].indexOf(e.kind) < 0) fail(where + ': kind ' + e.kind);
      if (D.groupAnswer(e) !== ans) fail(where + ': groupAnswer ' + D.groupAnswer(e) + ', recomputed ' + ans);
      if (new Set([ans, swap, a, b]).size !== 4) fail(where + ': the answer, the swapped operation and the two bars are not four different numbers (' + [ans, swap, a, b] + ') — a reason would be ambiguous');
      for (let x = 0; x <= 9999; x++){   /* parseCount 收到 4 位數：整個範圍都要判對 */
        const own = x === ans ? null : x === swap ? 'swap' : (x === a || x === b) ? 'one' : x > ans ? 'high' : 'low';
        if (D.groupWhy(e, x) !== own){ fail(where + ': groupWhy(' + x + ') = ' + D.groupWhy(e, x) + ', expected ' + own); break; }
      }
      LANGS.forEach(L => {
        const d = I18N[L], wk = d.WEEKS[e.k], A = d.CLASSES[0], B = d.CLASSES[1];
        const ask = d.gAskGroup(wk, e.kind);
        say(where + ' gAskGroup', L, ask.replace(wk, ''));
        if (ask.indexOf(wk) < 0 || !(e.kind === 'diff' ? /相差|apart/ : /一共|altogether/).test(ask)) fail(where + ' gAskGroup ' + L + ': does not ask ' + e.kind + ' for ' + wk);
        const win = d.gGroupWin(A, a, B, b, e.kind);
        say(where + ' gGroupWin', L, win.replace(A, '').replace(B, ''), e.kind === 'diff' ? [a, b, Math.max(a, b), Math.min(a, b), ans] : [a, b, a, b, ans]);
        say(where + ' gGroupSwap', L, d.gGroupSwap(swap, e.kind), [swap]);
        if (!(e.kind === 'diff' ? /加起來|added together/ : /相差|how far apart/).test(d.gGroupSwap(swap, e.kind))) fail(where + ' gGroupSwap ' + L + ': does not name the operation that was done');
        [a, b].forEach(v => { const t = d.gGroupOne(v, v === a ? A : B, e.kind); say(where + ' gGroupOne', L, t.replace(A, '').replace(B, ''), [v]); });
        say(where + ' gGroupOff', L, d.gGroupOff(ans + 2, true), L === 'zh' ? [ans + 2, 2] : [ans + 2, 1, 2]);
        const h2 = d.gGroupH2(A, a, B, b, e.kind);
        say(where + ' gGroupH2', L, h2.replace(A, '').replace(B, ''), [a, b]);
        if (textW(wk, 13) > ch.slot - 4) fail(where + ' ' + L + ': week "' + wk + '" does not fit its column');
      });
      [0, 1, 2, 3].forEach(i => {
        const ga = D.groupBarX(ch, i, 0), gb = D.groupBarX(ch, i, 1);
        if (!(ga.x + ga.w < gb.x && ga.x >= ch.cx[i] - ch.slot / 2 && gb.x + gb.w <= ch.cx[i] + ch.slot / 2 && ga.w >= 12)) fail('GAME group: the two bars of week ' + i + ' overlap, leave their column, or are too thin');
      });
    });
    [['6', 6], [' 6 ', 6], ['16', 16], ['0', 0], ['06', null], ['6.0', null], ['1 6', null], ['', null], ['-4', null], ['12345', null], ['６', null], ['1e1', null]].forEach(([s, want]) => {
      if (D.parseCount(s) !== want) fail('GAME group: parseCount("' + s + '") = ' + D.parseCount(s) + ', expected ' + want);
    });
    if (G.legY < G.catY + 8 || G.legY + G.legH > G.H) fail('GAME group: the key overlaps the week names or leaves the board');
  }

  /* --- 第 4 關：選對圖表 --- */
  {
    const S = D.SORT;
    LANGS.forEach(L => {
      const cards = I18N[L].gSortCards;
      if (!Array.isArray(cards) || cards.length !== D.SORT_TYPES.length) { fail('GAME sort ' + L + ': gSortCards does not match SORT_TYPES'); return; }
      cards.forEach((t, c) => {
        if (CARD_KIND[t] !== D.SORT_TYPES[c]) fail('GAME sort ' + L + ': "' + t + '" is a ' + CARD_KIND[t] + ' job, the page files it as ' + D.SORT_TYPES[c]);
        say('GAME sort card', L, t);
        /* 字放得下：托盤的卡（14px，兩行）與箱子裡的格子（12px，三行） */
        /* 換行的估計：中文一個字一個字斷、英文一個字一個字（空白）斷，貪心地塞滿每一行 */
        const lines = (w, px) => {
          const words = /[一-鿿]/.test(t) ? Array.from(t) : t.split(' ').map((x, i, a) => i < a.length - 1 ? x + ' ' : x);
          let n = 1, cur = 0;
          /* 英文用 0.5 em：和實際畫出來的量過（game-harness/g5-statistics/probe-cards.html，每一張都是兩行）；真正的字框由 e2e 量 */
          words.forEach(x => { const xw = textW(x, px, 0.5); if (cur + xw > w + 0.5 && cur > 0){ n++; cur = textW(x.trimStart(), px, 0.5); } else cur += xw; });
          return words.some(x => textW(x.trim(), px, 0.5) > w) ? 99 : n;   /* 一個字本身就比框寬：折不下 */
        };
        if (lines(S.cardW - 18, 14) > 2) fail('GAME sort ' + L + ': "' + t + '" needs ' + lines(S.cardW - 18, 14) + ' lines on its card (2 fit)');
        if (lines(S.binW - 16, 12) > 2 || lines(S.binW - 16, 12) * 12 * 1.45 > S.slotH - 6) fail('GAME sort ' + L + ': "' + t + '" does not fit a slot in its box');
        for (let b = 0; b < 3; b++){
          const own = D.SORT_BINS[b] === CARD_KIND[t] ? null : CARD_KIND[t];
          if (D.sortWhy(c, b) !== own) fail('GAME sort: sortWhy(' + c + ', ' + b + ') = ' + D.sortWhy(c, b) + ', expected ' + own);
          if (own){
            const why = I18N[L].gSortWhy(t, I18N[L].gSortWhyKind[own], I18N[L].gSortBins[D.SORT_BINS.indexOf(own)]);
            say('GAME gSortWhy', L, why);
            if (why.indexOf(BIN_NAME[L][own]) < 0 || why.indexOf(t) < 0) fail('GAME gSortWhy ' + L + ': does not name the card and its own box ' + BIN_NAME[L][own] + ' — "' + why + '"');
          }
        }
      });
      I18N[L].gSortBins.forEach((nm, b) => { if (nm !== BIN_NAME[L][D.SORT_BINS[b]]) fail('GAME sort ' + L + ': box ' + b + ' is labelled "' + nm + '", expected ' + BIN_NAME[L][D.SORT_BINS[b]]); if (textW(nm, 13) > S.binW - 10) fail('GAME sort ' + L + ': box label "' + nm + '" does not fit'); });
    });
    ['bar', 'line', 'grouped'].forEach(t => { if (D.SORT_TYPES.filter(x => x === t).length < 1) fail('GAME sort: no ' + t + ' card'); });
    if (D.SORT_BINS.join() !== 'bar,line,grouped') fail('GAME sort: boxes should be bar, line, grouped');
    let bad = 0, sortedN = 0;
    for (let r = 0; r < 3000; r++){
      const p = D.sortPick();
      const kinds = p.map(c => CARD_KIND[I18N.zh.gSortCards[c]]);
      if (p.length !== 4 || new Set(p).size !== 4 || ['bar', 'line', 'grouped'].some(t => kinds.indexOf(t) < 0) || ['bar', 'line', 'grouped'].some(t => kinds.filter(k => k === t).length > 2)) bad++;
      const rank = kinds.map(k => ['bar', 'line', 'grouped'].indexOf(k));
      if (rank.every((x, i) => i === 0 || rank[i - 1] <= x)) sortedN++;
    }
    if (bad) fail('GAME sortPick(): ' + bad + ' of 3000 draws are not 4 different cards with every chart type (and ≤ 2 per box)');
    if (sortedN) fail('GAME sortPick(): the tray starts in the answer order in ' + sortedN + ' of 3000 draws');
    /* 版面 */
    const binH = D.sortBinH(), bins = [0, 1, 2].map(b => ({ x:D.sortBinX(b), y:S.binY, w:S.binW, h:binH }));
    bins.forEach((b, i) => { inside(b, 'sort box ' + i, S.H); if (i && !(D.sortBinX(i) - D.sortBinX(i - 1) - S.binW > 0)) fail('GAME sort: boxes ' + (i - 1) + ' and ' + i + ' touch'); });
    if (S.lblH + 2 * (S.slotH + S.slotGap) > binH) fail('GAME sort: two slots do not fit in a box');
    const cards = [0, 1, 2, 3].map(j => sq(S.trayX[j % 2], S.trayY[Math.floor(j / 2)], S.cardW, S.cardH));
    cards.forEach((c, j) => { inside(c, 'sort card ' + j, S.H); bins.forEach(b => { if (hit(c, b)) fail('GAME sort: tray card ' + j + ' overlaps a box'); }); });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (hit(cards[i], cards[j])) fail('GAME sort: tray cards ' + i + ' and ' + j + ' overlap');
    tooSmall('sort card', Math.min(S.cardW, S.cardH));
  }

  /* --- 第 5 關：抓出騙人的圖 --- */
  {
    const T = D.TRUNC;
    const frac0 = (c, v) => (v - c.min) / (c.max - c.min);
    /* 不靠讀 0 就猜得到的線索：A、B 的數，A、B 的高度，兩根看起來差幾倍（codex 第九輪）、兩根頂端看起來差多高（第十輪）。真正的差距與真正的倍數不列 ——
       那是讀了長條上的數算出來的，正是範例 5 要孩子做的事（「實際只差多少」），而且誠實的「差很多」那一張本來就真的差最多 */
    const TRUNC_KEYS = [['A value', c => c.a], ['B value', c => c.b], ['B bar height', c => frac0(c, c.b)], ['A bar height', c => frac0(c, c.a)], ['look ratio', c => (c.b - c.min) / (c.a - c.min)], ['look gap', c => (c.b - c.a) / (c.max - c.min)]];
    const truncSeq = {};
    D.GAME_TRUNC.forEach((set, n) => {
      const where = 'GAME trunc[' + n + ']';
      if (set.length !== 4) fail(where + ': not 4 charts');
      const lie = set.filter(c => c.min > 0), honest = set.filter(c => c.min === 0);
      if (lie.length !== 2 || honest.length !== 2) fail(where + ': ' + lie.length + ' lying / ' + honest.length + ' honest charts (want 2 / 2)');
      set.forEach((c, i) => {
        if (D.truncLie(c) !== (c.min > 0)) fail(where + ' chart ' + i + ': truncLie says ' + D.truncLie(c) + ' for an axis starting at ' + c.min);
        if (!((c.max - c.min) % c.step === 0 && c.min % c.step === 0)) fail(where + ' chart ' + i + ': the axis ' + c.min + '–' + c.max + ' is not whole steps of ' + c.step);
        if ((T.py1 - T.py0) / ((c.max - c.min) / c.step) < 20) fail(where + ' chart ' + i + ': tick labels only ' + ((T.py1 - T.py0) / ((c.max - c.min) / c.step)).toFixed(1) + 'px apart');
        if (!(c.a > c.min && c.b > c.a && c.b <= c.max)) fail(where + ' chart ' + i + ': A ' + c.a + ' / B ' + c.b + ' are not inside the axis with B > A');
        if (Math.abs(D.truncY(c, c.min) - T.py1) > EPS || Math.abs(D.truncY(c, c.max) - T.py0) > EPS) fail(where + ' chart ' + i + ': truncY does not map the axis ends to the plot');
        /* 長條上的數：這裡自己算格線與長條頂端（不呼叫頁面的 truncY），字框（13px：基線上 1.1 em、下 0.35 em）離每一條格線與長條頂端 ≥ 2px、
           不出卡片、離自己的長條不超過 32px（驗證者抓到的：舊版固定在頂端上 5px，被格線穿過） */
        const gy = t => T.py1 - (t - c.min) / (c.max - c.min) * (T.py1 - T.py0);
        [c.a, c.b].forEach(v => {
          const y = D.truncLabelY(c, v), top = gy(v);
          /* 自己找「第一個」放得下的位置（從長條頂端往上每 0.5px），必須和頁面的一樣（不可以隨便放在更遠但也放得下的地方） */
          let own = null;
          for (let yy = top - 2 - 0.35 * 13; yy - 1.1 * 13 >= 2; yy -= 0.5){
            let clear = true;
            for (let t = c.min; t <= c.max; t += c.step) if (!(gy(t) < yy - 1.1 * 13 - 2 || gy(t) > yy + 0.35 * 13 + 2)) clear = false;
            if (clear){ own = yy; break; }
          }
          if (own === null || !fin(y) || Math.abs(own - y) > 1e-6) fail(where + ' chart ' + i + ': the value label ' + v + ' is at ' + y + ', the first clear spot above its bar is ' + own);
          if (!fin(y)) { fail(where + ' chart ' + i + ': no place for the value label ' + v); return; }
          const bt = y - 1.1 * 13, bb = y + 0.35 * 13;
          for (let t = c.min; t <= c.max; t += c.step) if (!(gy(t) < bt - 2 || gy(t) > bb + 2)) fail(where + ' chart ' + i + ': the value label ' + v + ' is ' + Math.min(Math.abs(gy(t) - bt), Math.abs(gy(t) - bb)).toFixed(1) + 'px from the ' + t + ' grid line (needs 2px clear)');
          if (bb > top - 2) fail(where + ' chart ' + i + ': the value label ' + v + ' touches its bar');
          if (bt < 2) fail(where + ' chart ' + i + ': the value label ' + v + ' leaves the card');
          if (top - bb > 32) fail(where + ' chart ' + i + ': the value label ' + v + ' floats ' + (top - bb).toFixed(1) + 'px above its bar');
        });
        const looks = (c.b - c.min) / (c.a - c.min), real = c.b / c.a;
        if (c.min > 0 && !(looks >= 1.4 && real < 1.2)) fail(where + ' chart ' + i + ': a lying chart that does not look much bigger (looks ×' + looks.toFixed(2) + ', really ×' + real.toFixed(2) + ')');
        LANGS.forEach(L => {
          const d = I18N[L], no = d.gTruncNo[i];
          if (c.min > 0){
            /* 說的「B 看起來是 A 的幾倍高」要和畫出來的一樣：用這裡自己的格線幾何量兩根長條的高度（驗證者抓到的：舊的「一點點的差距被畫得很大」對 42／46、7／8 這種圖不成立 ——
               那兩張誇大的是倍數，不是差距） */
            const gy2 = t => T.py1 - (t - c.min) / (c.max - c.min) * (T.py1 - T.py0), hA = T.py1 - gy2(c.a), hB = T.py1 - gy2(c.b), k = Math.round(hB / hA * 10) / 10;
            if (D.truncLooks(c) !== k) fail(where + ' chart ' + i + ': truncLooks says ' + D.truncLooks(c) + ', the drawn bars are ' + k + ' times');
            if (!(hB / hA > c.b / c.a + 0.2)) fail(where + ' chart ' + i + ': B does not look clearly more times as big as A than the numbers say (' + (hB / hA).toFixed(2) + ' vs ' + (c.b / c.a).toFixed(2) + ') — the win message would be false');
            say(where + ' gTruncFound', L, d.gTruncFound(no, c.min, c.a, c.b, k), [c.min, k, c.a, c.b, c.b - c.a]);
          }
          else say(where + ' gTruncBad', L, d.gTruncBad(no, c.a, c.b), [0, c.a, c.b]);
        });
      });
      if (!honest.some(c => c.b / c.a >= 2)) fail(where + ': no honest chart with a real big gap (an honest chart can look dramatic too)');
      /* 沒有視覺洩題：每一張都是 3 格；騙人的兩張與誠實的兩張用同一對刻度 —— 看「一格多少」猜不出誰騙人 */
      set.forEach((c, i) => { if ((c.max - c.min) / c.step !== 3) fail(where + ' chart ' + i + ': ' + (c.max - c.min) / c.step + ' squares tall — every chart must be 3 (the height of the axis must not tell)'); });
      const st = l => l.map(c => c.step).sort((x, y) => x - y).join();
      if (st(lie) !== st(honest)) fail(where + ': the lying charts use steps ' + st(lie) + ' and the honest ones ' + st(honest) + ' — the step gives the answer away');
      /* 數的大小、長條的高矮也不可以把騙人的與誠實的分成兩邊（照 A 的數、B 的數、B 的高度排，騙人的不可以剛好是前兩名或後兩名） */
      const frac = (c, v) => (v - c.min) / (c.max - c.min);
      TRUNC_KEYS.forEach(([what, key]) => {
        if (new Set(set.map(key)).size !== 4) fail(where + ': two charts tie on ' + what + ' (the order is ambiguous)');
        const seq = set.slice().sort((x, y) => key(x) - key(y)).map(c => c.min > 0 ? 'L' : 'H').join('');
        (truncSeq[what] = truncSeq[what] || []).push(seq);
        if (seq === 'LLHH' || seq === 'HHLL') fail(where + ': sorted by ' + what + ' the charts go ' + seq + ' — the ' + what + ' gives the answer away');
      });
    });
    /* 整個題庫：沒有一個「排第幾名就是騙人的」規則在每一組都成立（最大的、最小的在不同組裡有時騙人、有時誠實；三組的排法不全一樣） */
    Object.keys(truncSeq).forEach(what => {
      const q = truncSeq[what];
      if (new Set(q).size < 2) fail('GAME trunc: sorted by ' + what + ' every set goes ' + q[0] + ' — a rank rule finds the lying charts');
      if (new Set(q.map(x => x[3])).size < 2) fail('GAME trunc: the chart with the largest ' + what + ' is always ' + (q[0][3] === 'L' ? 'lying' : 'honest') + ' — a rank rule finds the lying charts');
      if (new Set(q.map(x => x[0])).size < 2) fail('GAME trunc: the chart with the smallest ' + what + ' is always ' + (q[0][0] === 'L' ? 'lying' : 'honest') + ' — a rank rule finds the lying charts');
    });
    /* truncPick：整片每 1px */
    let bad = 0;
    for (let x = -5; x <= W + 5; x += 1) for (let y = -5; y <= T.H + 5; y += 1){
      let own = -1;
      for (let i = 0; i < 4; i++){ const o = { x:(i % 2) * (T.cw + T.gap), y:Math.floor(i / 2) * (T.ch + T.gap) }; if (x >= o.x && x <= o.x + T.cw && y >= o.y && y <= o.y + T.ch) own = i; }
      if (D.truncPick({ x:x, y:y }) !== own) bad++;
    }
    if (bad) fail('GAME truncPick(): disagrees with the chart under the finger at ' + bad + ' points');
    [0, 1, 2, 3].forEach(i => { const o = D.truncXY(i); inside({ x:o.x, y:o.y, w:T.cw, h:T.ch }, 'trunc chart ' + i, T.H); });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++){ const a = D.truncXY(i), b = D.truncXY(j); if (hit({ x:a.x, y:a.y, w:T.cw, h:T.ch }, { x:b.x, y:b.y, w:T.cw, h:T.ch })) fail('GAME trunc: charts ' + i + ' and ' + j + ' overlap'); }
    tooSmall('trunc chart', Math.min(T.cw, T.ch));
    /* 每一張圖裡的東西都在自己的卡片裡：縱軸數字（靠右對齊在 px0 − 5）、兩根長條（± 14）、長條上的數、A／B、編號 */
    /* 上面兩條估的是畫出來的位置與字級：從原始碼釘住（縱軸數字在線下 4px、12px；長條上的數在頂端上 5px、13px） */
    need('trunc', /gText\(s, TRUNC\.px0 - 5, y \+ 4, v, \{ 'font-size':12, /, 'the tick labels are not drawn 12px at their line + 4 (the containment check assumes it)');
    need('trunc', /gText\(s, cx, truncLabelY\(c, v\), v, \{ 'font-size':TLBL, /, 'the value labels are not drawn at truncLabelY() in TLBL px (the label checks assume it)');
    if (D.TLBL !== 13) fail('GAME trunc: TLBL is ' + D.TLBL + ', the label checks assume 13px');
    need('trunc', /gText\(s, 14, TRUNC\.catY \+ 8, d\.gTruncNo\[i\], \{ 'font-size':15, /, 'the chart number is not drawn 15px at the bottom-left (the layout check assumes it)');
    need('trunc', /var cx = TRUNC\.px0 \+ \(TRUNC\.px1 - TRUNC\.px0\) \* \(side \? 0\.72 : 0\.28\), y = truncY\(c, v\);/, 'the bars are not at 28% / 72% of the plot (the containment check assumes it)');
    need('trunc', /gEl\('rect', \{ x:cx - 14, y:y, width:28, height:TRUNC\.py1 - y,/, 'the bars are not 28px wide from bar top to the bottom line (the containment check assumes it)');
    need('trunc', /gText\(s, cx, TRUNC\.catY, side \? 'B' : 'A', \{ 'class':'gcat' \}\);/, 'the A / B names are not drawn at catY in the default 13px (the containment check assumes it)');
    if (!/function gText\(svg, x, y, text, attrs\)\{\s*var a = \{ x:x, y:y, 'font-size':13,/.test(gsrc)) fail('GAME: gText() default font size is not 13px (the label checks assume it)');
    if (T.py0 + 4 - 1.1 * 12 < 2) fail('GAME trunc: the top tick label (at py0 + 4, 12px) leaves its card');
    if (!(T.px0 > 0 && T.px1 > T.px0 && T.px1 <= T.cw - 4 && T.py0 > 0 && T.py1 > T.py0 && T.catY > T.py1 + 12 && T.catY + 10 <= T.ch)) fail('GAME trunc: the plot / labels do not fit inside a ' + T.cw + '×' + T.ch + ' card');
    D.GAME_TRUNC.forEach(set => set.forEach(c => {
      const tw = textW(String(c.max), 12);
      if (T.px0 - 5 - tw < 2) fail('GAME trunc: the tick label ' + c.max + ' leaves its card');
      [0.28, 0.72].forEach(f => { const cx = T.px0 + (T.px1 - T.px0) * f; if (cx - 14 <= T.px0 + 1 || cx + 14 >= T.px1) fail('GAME trunc: a bar leaves its plot'); });
    }));
    if (textW('④', 15) + 14 / 2 > D.TRUNC.px0 + (D.TRUNC.px1 - D.TRUNC.px0) * 0.28 - 14 - 2) fail('GAME trunc: the chart number runs into bar A');
    if (!(T.gap > 0)) fail('GAME trunc: the charts touch — there is no gap that does nothing');
    LANGS.forEach(L => {
      const d = I18N[L];
      say('GAME gTruncNow', L, d.gTruncNow(1, 2), [1, 2]);
      say('GAME gTruncH2', L, d.gTruncH2(2, [40, 25]), [2, 40, 25]);
    });
  }

  /* --- 說明的「意思」：每一個分支都呼叫，必須說／不可以說（數字不變、意思反過來的改法要抓得到；codex 第一輪） --- */
  {
    const has = (where, t, must, not) => {
      (must || []).forEach(m => { if (String(t).indexOf(m) < 0) fail('GAME meaning ' + where + ': must say "' + m + '" — "' + t + '"'); });
      (not || []).forEach(m => { if (String(t).indexOf(m) >= 0) fail('GAME meaning ' + where + ': must not say "' + m + '" — "' + t + '"'); });
    };
    const Z = I18N.zh, E = I18N.en;
    has('gBarCount zh', Z.gBarCount('甲', 10, 5, '本'), ['不是 10 本', '10 格是 10 × 5 ＝ 50 本', '要畫的格數是 10 ÷ 5'], ['正是']);
    has('gBarCount en', E.gBarCount('A', 10, 5, 'books'), ['not 10 books', '10 squares is 10 × 5 = 50 books', 'the number of squares is 10 ÷ 5'], ['exactly']);
    has('gBarOff zh high', Z.gBarOff('甲', 9, 5, 35, '本'), ['比表上的 35 本多了'], ['少了']);
    has('gBarOff zh low', Z.gBarOff('甲', 3, 5, 35, '本'), ['比表上的 35 本少了'], ['多了']);
    has('gBarOff en high', E.gBarOff('A', 9, 5, 35, 'books'), ['more than the 35 books'], ['less than']);
    has('gBarOff en low', E.gBarOff('A', 3, 5, 35, 'books'), ['less than the 35 books'], ['more than']);
    has('gBarEmpty zh', Z.gBarEmpty('甲'), ['還沒畫'], []);
    has('gBarEmpty en', E.gBarEmpty('A'), ['isn’t drawn yet'], []);
    has('gPlotCol zh', Z.gPlotCol('三月'), ['這是「三月」的點', '要放在橫軸「三月」那一直行上'], ['任何', '都可以']);
    has('gPlotCol en', E.gPlotCol('Mar'), ['This is the Mar point', 'it goes in the Mar column'], ['any column']);
    has('gPlotOff zh high', Z.gPlotOff('三月', 20, 25), ['「三月」是 20', '你放在 25 那一條線', '太高了'], ['太低']);
    has('gPlotOff zh low', Z.gPlotOff('三月', 20, 15), ['太低了'], ['太高']);
    has('gPlotOff en high', E.gPlotOff('Mar', 20, 25), ['Mar is 20', 'on the 25 line', 'too high'], ['too low']);
    has('gPlotOff en low', E.gPlotOff('Mar', 20, 15), ['too low'], ['too high']);
    has('gSegText zh up', Z.gSegText('一月', '二月', 15, 25), ['15 → 25，增加了 10'], ['減少']);
    has('gSegText zh down', Z.gSegText('一月', '二月', 25, 15), ['25 → 15，減少了 10'], ['增加']);
    has('gSegText en up', E.gSegText('Jan', 'Feb', 15, 25), ['15 → 25, up 10'], ['down']);
    has('gSegText en down', E.gSegText('Jan', 'Feb', 25, 15), ['25 → 15, down 10'], [', up']);
    has('gSegBad zh decr', Z.gSegBad('X', true), ['減少也算變化', '有一段減少得比這一段增加的還多'], ['還有一段變得更多', '這一段變得更多']);
    has('gSegBad zh other', Z.gSegBad('X', false), ['還有一段變得更多'], ['減少也算變化', '這一段變得最多']);
    has('gSegBad en decr', E.gSegBad('X', true), ['Going down is a change too', 'one piece goes down by more than this one goes up'], ['Another piece']);
    has('gSegBad en other', E.gSegBad('X', false), ['Another piece changes by more'], ['Going down', 'this piece changes more']);
    has('gSegWin zh', Z.gSegWin('X'), ['變化最大', '最陡'], []);
    has('gSegWin en', E.gSegWin('X'), ['the biggest change', 'steepest'], []);
    has('gGroupSwap zh diff', Z.gGroupSwap(26, 'diff'), ['26 是兩班加起來的', '題目問的是相差', '大的減小的'], ['一共']);
    has('gGroupSwap zh total', Z.gGroupSwap(6, 'total'), ['6 是兩班相差的', '題目問的是一共', '兩個加起來'], ['大的減小的']);
    has('gGroupSwap en diff', E.gGroupSwap(26, 'diff'), ['26 is the two classes added together', 'how far apart', 'bigger minus smaller'], ['altogether']);
    has('gGroupSwap en total', E.gGroupSwap(6, 'total'), ['6 is how far apart', 'altogether', 'add the two'], ['bigger minus smaller']);
    has('gGroupOne zh diff', Z.gGroupOne(10, '五年一班', 'diff'), ['10 只是五年一班那一根長條', '大的減小的'], ['加起來']);
    has('gGroupOne zh total', Z.gGroupOne(10, '五年一班', 'total'), ['10 只是五年一班那一根長條', '兩班加起來'], ['減小的']);
    has('gGroupOne en diff', E.gGroupOne(10, 'Class 1', 'diff'), ['10 is just Class 1’s bar', 'bigger minus smaller'], ['adding']);
    has('gGroupOne en total', E.gGroupOne(10, 'Class 1', 'total'), ['10 is just Class 1’s bar', 'adding both classes'], ['minus']);
    has('gGroupOff zh hi', Z.gGroupOff(30, true), ['30 太大了', '一格是 2 公斤'], ['太小']);
    has('gGroupOff zh lo', Z.gGroupOff(3, false), ['3 太小了'], ['太大']);
    has('gGroupOff en hi', E.gGroupOff(30, true), ['30 is too big', '1 square is 2 kg'], ['too small']);
    has('gGroupOff en lo', E.gGroupOff(3, false), ['3 is too small'], ['too big']);
    has('gSortWhyKind.bar zh', Z.gSortWhyKind.bar, ['比較不同的種類', '只有一組資料'], ['時間', '兩組']);
    has('gSortWhyKind.line zh', Z.gSortWhyKind.line, ['隨著時間在變化'], ['種類', '兩組']);
    has('gSortWhyKind.grouped zh', Z.gSortWhyKind.grouped, ['兩組資料要並排比較'], ['時間', '一組資料']);
    has('gSortWhyKind.bar en', E.gSortWhyKind.bar, ['different kinds of things', 'one set of data'], ['time', 'two sets']);
    has('gSortWhyKind.line en', E.gSortWhyKind.line, ['changing over time'], ['kinds', 'two sets']);
    has('gSortWhyKind.grouped en', E.gSortWhyKind.grouped, ['two sets of data to compare side by side'], ['time', 'one set']);
    has('gTruncFound zh', Z.gTruncFound('①', 40, 48, 52, 1.5), ['① 的縱軸從 40 開始', 'B 看起來大約是 A 的 1.5 倍高', '可是 A 是 48、B 是 52', '其實只差 4'], ['從 0 開始', '差距']);
    has('gTruncFound en', E.gTruncFound('①', 40, 48, 52, 1.5), ['①’s axis starts at 40', 'B looks about 1.5 times as tall as A', 'but A is 48 and B is 52', 'only 4 apart'], ['starts at 0', 'gap']);
    has('gTruncBad zh', Z.gTruncBad('②', 20, 50), ['② 的縱軸從 0 開始', '就真的差多少', '它沒有騙人'], ['會騙人的', '騙人的圖']);
    has('gTruncBad en', E.gTruncBad('②', 20, 50), ['②’s axis starts at 0', 'the gap you see is the real gap', 'It doesn’t lie'], ['misleading', 'It lies']);
    [2, 5, 10].forEach(u => {
      has('gBarWin zh ' + u, Z.gBarWin(u), ['每一根的格數 × ' + u, '就是表上的數'], ['÷']);
      has('gBarWin en ' + u, E.gBarWin(u), ['each bar’s squares × ' + u, 'is the number in the table'], ['÷']);
    });
    has('gBarH2 zh', Z.gBarH2('甲', 35, 5, '本'), ['「甲」是 35 本', '35 ÷ 5 ＝ 7', '畫 7 格'], ['×']);
    has('gBarH2 en', E.gBarH2('A', 35, 5, 'books'), ['A is 35 books', '35 ÷ 5 = 7', 'draw 7 squares'], ['×']);
    has('gBarH2 en 1', E.gBarH2('A', 5, 5, 'books'), ['draw 1 square.'], ['1 squares']);
    has('gPlotH2 zh', Z.gPlotH2('三月', 20), ['「三月」是 20', '三月 那一直行', '20 那一條線'], []);
    has('gPlotH2 en', E.gPlotH2('Mar', 20), ['Mar is 20', 'the Mar column', 'the 20 line'], []);
    has('gPlotNow zh', Z.gPlotNow(2, 5), ['畫好 2 / 5 個點'], []);
    has('gPlotNow en', E.gPlotNow(2, 5), ['2 / 5 points plotted'], []);
    has('gPlotAt zh', Z.gPlotAt('三月', 20), ['三月・20'], []);
    has('gPlotAt en', E.gPlotAt('Mar', 20), ['Mar · 20'], []);
    has('gAskSeg zh', Z.gAskSeg, ['變化最大'], ['增加最多']);
    has('gAskSeg en', E.gAskSeg, ['the biggest change'], ['goes up the most']);
    has('gSegH2 zh', Z.gSegH2(['一月→二月 +10']), ['每一段的變化', '一月→二月 +10'], []);
    has('gSegH2 en', E.gSegH2(['Jan→Feb +10']), ['The changes', 'Jan→Feb +10'], []);
    has('gGroupWin zh diff', Z.gGroupWin('一班', 10, '二班', 16, 'diff'), ['一班 10 公斤、二班 16 公斤', '16 − 10 ＝ 6 公斤'], ['＋']);
    has('gGroupWin zh total', Z.gGroupWin('一班', 10, '二班', 16, 'total'), ['10 ＋ 16 ＝ 26 公斤'], ['−']);
    has('gGroupWin en diff', E.gGroupWin('C1', 10, 'C2', 16, 'diff'), ['C1 10 kg, C2 16 kg', '16 − 10 = 6 kg'], [' + ']);
    has('gGroupWin en total', E.gGroupWin('C1', 10, 'C2', 16, 'total'), ['10 + 16 = 26 kg'], ['−']);
    has('gGroupH2 zh diff', Z.gGroupH2('一班', 10, '二班', 16, 'diff'), ['一班 是 10', '二班 是 16', '相差就是大的減小的'], ['加起來']);
    has('gGroupH2 zh total', Z.gGroupH2('一班', 10, '二班', 16, 'total'), ['一共就是兩個加起來'], ['減小的']);
    has('gGroupH2 en diff', E.gGroupH2('C1', 10, 'C2', 16, 'diff'), ['C1 is 10', 'C2 is 16', 'bigger minus smaller'], ['added']);
    has('gGroupH2 en total', E.gGroupH2('C1', 10, 'C2', 16, 'total'), ['altogether is the two added'], ['minus']);
    has('gAskGroup zh diff', Z.gAskGroup('第 3 週', 'diff'), ['第 3 週', '兩班相差多少公斤'], ['一共']);
    has('gAskGroup zh total', Z.gAskGroup('第 3 週', 'total'), ['兩班一共多少公斤'], ['相差']);
    has('gAskGroup en diff', E.gAskGroup('Week 3', 'diff'), ['In Week 3', 'how many kg apart'], ['altogether']);
    has('gAskGroup en total', E.gAskGroup('Week 3', 'total'), ['altogether'], ['apart']);
    has('gGroupEmpty zh', Z.gGroupEmpty, ['先在格子裡打一個數'], []);
    has('gGroupEmpty en', E.gGroupEmpty, ['Type a number in the box first'], []);
    has('gAsks.bar en', E.gAsks.bar, ['Pull each bar to the height the table says', 'tap a grid line in its column', 'press “Done”'], []);
    has('gAsks.plot zh', Z.gAsks.plot, ['把每個月的點拖到折線圖上對的位置', '先點一個點、再點位置'], []);
    has('gAsks.plot en', E.gAsks.plot, ['Drag each month’s point to the right spot on the line graph', 'tap a point, then tap the spot'], []);
    has('gAsks.sort zh', Z.gAsks.sort, ['每一件事要用哪一種圖', '先點卡片、再點箱子'], []);
    has('gAsks.sort en', E.gAsks.sort, ['Which chart fits each job', 'tap a card, then tap a box'], []);
    has('gBarStart zh', Z.gBarStart, ['幾格'], []);
    has('gBarStart en', E.gBarStart, ['number of squares'], []);
    has('gTypeInt zh', Z.gTypeInt, ['整數', '不要有空格、小數點或開頭的 0'], []);
    has('gTypeInt en', E.gTypeInt, ['whole number', 'no spaces, decimal points or leading zeros'], []);
    ['bar', 'line', 'grouped'].forEach((k, b) => {
      has('gSortH2 zh ' + k, Z.gSortH2('卡', Z.gSortWhyKind[k], Z.gSortBins[b]), ['「卡」' + Z.gSortWhyKind[k], '→ ' + BIN_NAME.zh[k]], []);
      has('gSortH2 en ' + k, E.gSortH2('card', E.gSortWhyKind[k], E.gSortBins[b]), ['“card”' + E.gSortWhyKind[k], '→ ' + BIN_NAME.en[k]], []);
    });
    has('gSortNow zh', Z.gSortNow(1, 4), ['分好 1 / 4 張'], []);
    has('gSortNow en', E.gSortNow(1, 4), ['1 / 4 cards sorted'], []);
    has('gTruncNow zh', Z.gTruncNow(1, 2), ['找到 1 / 2 張會騙人的圖'], []);
    has('gTruncNow en', E.gTruncNow(1, 2), ['1 / 2 lying charts found'], []);
    has('gTruncH2 zh', Z.gTruncH2(2, [40, 25]), ['還沒找到的 2 張', '縱軸最下面那一條線寫的是 40、25'], []);
    has('gTruncH2 en 2', E.gTruncH2(2, [40, 25]), ['The 2 still to find have 40 and 25 on the bottom line'], []);
    has('gTruncH2 en 1', E.gTruncH2(1, [40]), ['The one still to find has 40 on the bottom line'], ['The 1 ']);
    has('gHints.plot zh', Z.gHints.plot, ['那個月的那一直行', '那個數的那一條線', '交叉的地方就是點'], []);
    has('gHints.plot en', E.gHints.plot, ['the month’s column', 'the line for the number', 'where they cross'], []);
    has('gHints.group zh', Z.gHints.group, ['圖例', '那一週', '一格 2 公斤'], []);
    has('gHints.group en', E.gHints.group, ['the key', 'the week in the question', '1 square = 2 kg'], []);
    has('gHints.sort zh', Z.gHints.sort, ['不同的種類', '隨著時間的變化', '兩組要並排比'], []);
    has('gHints.sort en', E.gHints.sort, ['different kinds of things', 'change over time', 'two groups to compare side by side'], []);
    has('gAsks.bar zh', Z.gAsks.bar, ['照表上的數量', '畫好了'], []);
    has('gAsks.trunc zh', Z.gAsks.trunc, ['縱軸沒有從 0 開始', '點出所有會騙人的圖'], []);
    has('gAsks.trunc en', E.gAsks.trunc, ['don’t start at 0', 'Tap every chart that lies'], []);
    /* 過關那一句對每一張騙人的圖都要成立：它說的是「倍數」（上面每一張都驗過看起來的倍數 > 真正的倍數），不可以說「差距被畫得很大」 */
    has('gTruncWin zh', Z.gTruncWin, ['沒有從 0 開始', '長條的高矮就和數字對不起來', '看起來的倍數比數字真正的倍數大'], ['差距', '畫得很大']);
    has('gTruncWin en', E.gTruncWin, ['doesn’t start at 0', 'the bar heights no longer match the numbers', 'B looks bigger compared with A than the numbers really show'], ['gap', 'huge', 'more times']);
    has('gHints.bar zh', Z.gHints.bar, ['表上的數 ÷ 一格代表的數', '要畫幾格'], ['×']);
    has('gHints.bar en', E.gHints.bar, ['the table’s number ÷ what one square is worth', 'how many squares to draw'], ['×']);
    has('gHints.seg zh', Z.gHints.seg, ['增加和減少都算', '線越陡，變化越大'], ['只算增加']);
    has('gHints.seg en', E.gHints.seg, ['Going up and going down both count', 'The steeper the line, the bigger the change'], ['only']);
    has('gHints.trunc zh', Z.gHints.trunc, ['最下面那一條線', '是不是 0'], []);
    has('gHints.trunc en', E.gHints.trunc, ['bottom line', 'is it 0'], []);
    has('gSortWin zh', Z.gSortWin, ['比種類用長條圖', '看隨時間的變化用折線圖', '兩組並排比用複合長條圖'], []);
    has('gSortWin en', E.gSortWin, ['compare kinds with a bar chart', 'change over time with a line graph', 'two groups side by side with a grouped bar chart'], []);
  }

  /* --- 每一關的提示、題目、說明（兩種語言都在、沒有 undefined、英文沒有中文） --- */
  LANGS.forEach(L => {
    const d = I18N[L];
    Object.keys(d.gHints).forEach(k => say('GAME gHints.' + k, L, d.gHints[k]));
    Object.keys(d.gAsks).forEach(k => say('GAME gAsks.' + k, L, d.gAsks[k]));
    ['gBarStart', 'gBarDone', 'gAskSeg', 'gSegNow', 'gGroupEmpty', 'gTypeInt', 'gSortWin', 'gTruncWin'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME ' + L + ': ' + k + ' missing'); else say('GAME ' + k, L, d[k]); });
  });
}

module.exports = {
  breaks: [
    /* ---- 引擎與計分 ---- */
    {"file": "index", "expect": "GAME_ORDER should be", "find": "  var GAME_ORDER = ['bar', 'plot', 'group', 'sort', 'trunc'];", "replace": "  var GAME_ORDER = ['plot', 'bar', 'group', 'sort', 'trunc'];"},
    {"file": "index", "expect": "under 44", "find": "  var GPICK = 48;", "replace": "  var GPICK = 44;"},
    {"file": "index", "expect": "shuffle(): only", "find": "    for (var j = a.length - 1; j > 0; j--){ var k = rand(j + 1); var t = a[j]; a[j] = a[k]; a[k] = t; }", "replace": "    for (var j = a.length - 1; j > 0; j--){ var k = j; var t = a[j]; a[j] = a[k]; a[k] = t; }"},
    {"file": "index", "expect": "starts in the answer order", "find": "    return sorted ? a.reverse() : a;", "replace": "    return a;"},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = 20;"},
    {"file": "index", "expect": "a mistake does not cost 5", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = 0;"},
    {"file": "index", "expect": "the same mistake again is charged again", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = gScore >= 5 ? 5 : 0;"},
    {"file": "index", "expect": "below 0", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = !again ? 5 : 0;"},
    {"file": "index", "expect": "shown although nothing was taken", "find": "'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", "replace": "'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');"},
    {"file": "index", "expect": "does not clear the hint", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "nearestOpen(): a point inside the big box", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (dc < bc){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "goes to the first match", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (!best){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "board generation", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", "replace": ""},
    {"file": "index", "expect": "second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "board tap", "find": "      if (!e.isPrimary) return;   /* 第二根手指：不理", "replace": "      if (false) return;   /* 第二根手指：不理"},
    {"file": "index", "expect": "losing pointer capture", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "placed pieces still catch taps", "find": "  .gpiece.locked{cursor:default;pointer-events:none}", "replace": "  .gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "does not snap", "find": "      if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));", "replace": "      if (o.axis === 'y') P.place(orig.x, orig.y + dy);"},
    {"file": "index", "expect": "ahead mode", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", "replace": "    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式"},
    {"file": "index", "expect": "viewBox", "find": "    var s = gEl('svg', { 'class':'gsvg', width:W, height:H, 'aria-hidden':'true' });", "replace": "    var s = gEl('svg', { 'class':'gsvg', width:W, height:H, viewBox:'0 0 ' + W + ' ' + H, 'aria-hidden':'true' });"},

    /* ---- 第 1 關：畫長條 ---- */
    {"file": "index", "expect": "barWhy says", "find": "    if (h === v) return 'count';\n", "replace": ""},
    {"file": "index", "expect": "barWhy says", "find": "    return h * e.u > v ? 'high' : 'low';", "replace": "    return h * e.u > v ? 'low' : 'high';"},
    {"file": "index", "expect": "only the even lines are labelled", "find": "  function barLabelled(k){ return k % 2 === 0; }", "replace": "  function barLabelled(k){ return true; }"},
    {"file": "index", "expect": "whole number of squares", "find": "    { cat:'WEEKDAYS', unit:'book', u:5, vals:[35, 10, 45, 20] },", "replace": "    { cat:'WEEKDAYS', unit:'book', u:5, vals:[35, 12, 45, 20] },"},
    {"file": "index", "expect": "misconception cannot be drawn", "find": "    { cat:'CLASSES', unit:'kg', u:10, vals:[60, 10, 80, 40] },", "replace": "    { cat:'CLASSES', unit:'kg', u:10, vals:[60, 20, 80, 40] },"},
    {"file": "index", "expect": "gSnapK", "find": "  function gSnapK(ch, y){ return Math.max(0, Math.min(ch.rows, Math.round((ch.y1 - y) / ch.cellH))); }", "replace": "  function gSnapK(ch, y){ return Math.max(0, Math.min(ch.rows, Math.floor((ch.y1 - y) / ch.cellH))); }"},
    {"file": "index", "expect": "gColOf", "find": "  function gColOf(ch, x){ if (x < ch.x0 || x >= ch.x1) return -1; return Math.floor((x - ch.x0) / ch.slot); }", "replace": "  function gColOf(ch, x){ if (x < ch.x0 || x >= ch.x1) return -1; return Math.round((x - ch.x0) / ch.slot); }"},
    {"file": "index", "expect": "gBarCount", "find": "' 格是 ' + v + ' × ' + u + ' ＝ ' + (v * u) + ' ' + unit + '，不是 '", "replace": "' 格是 ' + v + ' × ' + u + ' ＝ ' + (v * u + 1) + ' ' + unit + '，不是 '"},
    {"file": "index", "expect": "gBarOff", "find": "' + unit + (h * u > v ? '多' : '少') + '了。'; },", "replace": "' + unit + (h * u > v ? '少' : '多') + '了。'; },"},
    {"file": "index", "expect": "gBarH2", "find": "gBarH2:function(cat, v, u, unit){ return '「' + cat + '」是 ' + v + ' ' + unit + '：' + v + ' ÷ ' + u + ' ＝ ' + (v / u) + '，畫 ' + (v / u) + ' 格。'; },", "replace": "gBarH2:function(cat, v, u, unit){ return '「' + cat + '」是 ' + v + ' ' + unit + '：' + v + ' ÷ ' + u + ' ＝ ' + (v / u) + '，畫 ' + v + ' 格。'; },"},
    {"file": "index", "expect": "covers the caption", "find": "var BAR = { W:300, H:360, x0:40, x1:292, tblY:2, tblRowH:28, capY:76, y0:108,", "replace": "var BAR = { W:300, H:360, x0:40, x1:292, tblY:2, tblRowH:28, capY:76, y0:92,"},
    {"file": "index", "expect": "the bar judged", "find": "          roundMiss(why === 'count' ? d.gBarCount(cats[first], h, e.u, unit) : d.gBarOff(cats[first], h, e.u, e.vals[first], unit), first + ':' + h);", "replace": "          roundMiss(why === 'count' ? d.gBarCount(cats[first], h, e.u, unit) : d.gBarOff(cats[first], h, e.u, e.vals[first], unit), 'bar');"},
    {"file": "index", "expect": "held handle", "find": "        handles.forEach(function(P, i){ if (P.busy()) P.rehome(ch.cx[i], gLineY(ch, hs[i])); });", "replace": ""},
    {"file": "index", "expect": "tap on a handle", "find": "      B.onTap = function(P, pt){ setH(P.data.i, pt); };", "replace": "      B.onTap = function(){};"},

    /* ---- 第 2 關：描點連線 ---- */
    {"file": "index", "expect": "plotWhy(", "find": "    if (i !== m) return 'col';\n", "replace": ""},
    {"file": "index", "expect": "plotWhy(", "find": "    return k * e.s > e.vals[m] ? 'high' : 'low';", "replace": "    return k * e.s < e.vals[m] ? 'high' : 'low';"},
    {"file": "index", "expect": "plotCell", "find": "    if (p.x < ch.x0 || p.x >= ch.x1 || p.y < ch.y0 - ch.cellH / 2 || p.y > ch.y1 + ch.cellH / 2) return null;", "replace": "    if (p.x < ch.x0 || p.x >= ch.x1 || p.y < ch.y0 - ch.cellH * 2 || p.y > ch.y1 + ch.cellH * 2) return null;"},
    {"file": "index", "expect": "segBest", "find": "for (var j = 1; j < vals.length - 1; j++) if (Math.abs(segDelta(vals, j)) > Math.abs(segDelta(vals, best))) best = j;", "replace": "for (var j = 1; j < vals.length - 1; j++) if (segDelta(vals, j) > segDelta(vals, best)) best = j;"},
    {"file": "index", "expect": "segPick", "find": "    for (var v = 1; v < pts.length - 1; v++) if (Math.hypot(p.x - pts[v].x, p.y - pts[v].y) < PLOT.vtxSkip) return -1;\n", "replace": ""},
    {"file": "index", "expect": "segPick", "find": "      if (dd <= PLOT.segHit && dd < bd){ bd = dd; best = j; }", "replace": "      if (dd <= PLOT.segHit && best < 0){ bd = dd; best = j; }"},
    {"file": "index", "expect": "the answer is not unique", "find": "    { from:0, unit:'person', s:5, rows:8, vals:[15, 25, 20, 35, 10] },", "replace": "    { from:0, unit:'person', s:5, rows:8, vals:[15, 25, 20, 35, 20] },"},
    {"file": "index", "expect": "goes DOWN", "find": "    { from:2, unit:'mm', s:10, rows:8, vals:[30, 50, 70, 20, 40] },", "replace": "    { from:2, unit:'mm', s:10, rows:8, vals:[30, 40, 80, 70, 60] },"},
    {"file": "index", "expect": "going down counts too", "find": "roundMiss(d.gSegBad(txt, segDelta(e.vals, best) < 0 && segDelta(e.vals, j) > 0), 's' + j);", "replace": "roundMiss(d.gSegBad(txt, segDelta(e.vals, best) < 0), 's' + j);"},
    {"file": "index", "expect": "gSegText", "find": "gSegText:function(a, b, va, vb){ return a + ' → ' + b + '：' + va + ' → ' + vb + '，' + (vb > va ? '增加' : '減少') + '了 ' + Math.abs(vb - va); },", "replace": "gSegText:function(a, b, va, vb){ return a + ' → ' + b + '：' + va + ' → ' + vb + '，' + (vb > va ? '減少' : '增加') + '了 ' + Math.abs(vb - va); },"},
    {"file": "index", "expect": "gPlotOff", "find": "' 那一條線 —— ' + (at > v ? '太高' : '太低') + '了。'; },", "replace": "' 那一條線 —— ' + (at > v ? '太低' : '太高') + '了。'; },"},
    {"file": "index", "expect": "tray cards 0 and 1 overlap", "find": "  function plotTrayX(j){ return 3 + PLOT.chipW / 2 + j * (PLOT.chipW + 6); }", "replace": "  function plotTrayX(j){ return 3 + PLOT.chipW / 2 + j * (PLOT.chipW - 6); }"},
    {"file": "index", "expect": "the point judged", "find": "        var m = P.data.m, why = plotWhy(e, m, cell.i, cell.k);", "replace": "        var m = cell.i, why = plotWhy(e, m, cell.i, cell.k);"},

    /* ---- 第 3 關：讀複合長條圖 ---- */
    {"file": "index", "expect": "groupWhy(", "find": "    if (n === (e.kind === 'diff' ? a + b : Math.abs(a - b))) return 'swap';", "replace": "    if (n === (e.kind === 'diff' ? a + b : Math.abs(a - b))) return null;"},
    {"file": "index", "expect": "groupWhy(", "find": "    if (n === a || n === b) return 'one';\n", "replace": ""},
    {"file": "index", "expect": "groupAnswer", "find": "  function groupAnswer(e){ var a = e.a[e.k], b = e.b[e.k]; return e.kind === 'diff' ? Math.abs(a - b) : a + b; }", "replace": "  function groupAnswer(e){ var a = e.a[e.k], b = e.b[e.k]; return e.kind === 'diff' ? a - b : a + b; }"},
    {"file": "index", "expect": "on a grid line", "find": "    { a:[12, 16, 10, 18], b:[8, 14, 16, 12], k:2, kind:'diff' },", "replace": "    { a:[12, 16, 11, 18], b:[8, 14, 16, 12], k:2, kind:'diff' },"},
    {"file": "index", "expect": "four different numbers", "find": "    { a:[14, 6, 18, 12], b:[10, 16, 12, 20], k:1, kind:'total' },", "replace": "    { a:[14, 8, 18, 12], b:[10, 16, 12, 20], k:1, kind:'total' },"},
    {"file": "index", "expect": "parseCount", "find": "return /^(0|[1-9]\\d{0,3})$/.test(t) ? Number(t) : null;", "replace": "return /^\\d+$/.test(t) ? Number(t) : null;"},
    {"file": "index", "expect": "gGroupWin", "find": "(kind === 'diff' ? Math.max(a, b) + ' − ' + Math.min(a, b) + ' ＝ ' + Math.abs(a - b) : a + ' ＋ ' + b + ' ＝ ' + (a + b)) + ' 公斤。'; },", "replace": "(kind === 'diff' ? Math.max(a, b) + ' − ' + Math.min(a, b) + ' ＝ ' + (a + b) : a + ' ＋ ' + b + ' ＝ ' + (a + b)) + ' 公斤。'; },"},
    {"file": "index", "expect": "just one class", "find": "else if (why === 'one') roundMiss(d.gGroupOne(n, n === a ? A : Bn, e.kind), 'n' + n);", "replace": "else if (why === 'one') roundMiss(d.gGroupOne(n, A, e.kind), 'n' + n);"},
    {"file": "index", "expect": "the two bars of week", "find": "  function groupBarX(ch, i, side){ var pairW = ch.slot * 0.62, w = pairW / 2 - 2; return { x:ch.cx[i] - pairW / 2 + (side ? pairW / 2 + 2 : 0), w:w }; }", "replace": "  function groupBarX(ch, i, side){ var pairW = ch.slot * 0.62, w = pairW / 2 + 2; return { x:ch.cx[i] - pairW / 2 + (side ? pairW / 2 - 2 : 0), w:w }; }"},

    /* ---- 第 4 關：選對圖表 ---- */
    {"file": "index", "expect": "sortWhy(", "find": "  function sortWhy(c, b){ var t = SORT_TYPES[c]; return SORT_BINS[b] === t ? null : t; }", "replace": "  function sortWhy(c, b){ var t = SORT_TYPES[c]; return SORT_BINS[b] === t || b === 0 ? null : t; }"},
    {"file": "index", "expect": "the page files it as", "find": "  var SORT_TYPES = ['bar', 'bar', 'bar', 'line', 'line', 'line', 'grouped', 'grouped', 'grouped'];", "replace": "  var SORT_TYPES = ['bar', 'bar', 'line', 'bar', 'line', 'line', 'grouped', 'grouped', 'grouped'];"},
    {"file": "index", "expect": "sortPick", "find": "    cards.push(pick(rest));", "replace": "    cards.push(pick(rest)); cards.push(pick(rest));"},
    {"file": "index", "expect": "sortPick", "find": "    var cards = SORT_BINS.map(function(t){ return pick(by[t]); });", "replace": "    var cards = SORT_BINS.slice(0, 2).map(function(t){ return pick(by[t]); }); cards.push(by.bar[2]);"},
    {"file": "index", "expect": "ITS OWN box", "find": "if (why){ roundMiss(d.gSortWhy(d.gSortCards[c], d.gSortWhyKind[why], d.gSortBins[SORT_BINS.indexOf(why)]), c + '>' + bin.b); return false; }", "replace": "if (why){ roundMiss(d.gSortWhy(d.gSortCards[c], d.gSortWhyKind[why], d.gSortBins[bin.b]), c + '>' + bin.b); return false; }"},
    {"file": "index", "expect": "touch", "find": "  function sortBinX(b){ return b * (SORT.binW + SORT.binGap); }", "replace": "  function sortBinX(b){ return b * (SORT.binW - SORT.binGap); }"},
    {"file": "index", "expect": "two slots", "find": "  function sortBinH(){ return SORT.lblH + 2 * (SORT.slotH + SORT.slotGap) + 4; }", "replace": "  function sortBinH(){ return SORT.lblH + (SORT.slotH + SORT.slotGap) + 4; }"},
    {"file": "index", "expect": "does not fit a slot", "find": "binY:0, lblY:30, lblH:58, slotH:52, slotGap:4,", "replace": "binY:0, lblY:30, lblH:58, slotH:34, slotGap:4,"},

    /* ---- 第 5 關：抓出騙人的圖 ---- */
    {"file": "index", "expect": "truncLie", "find": "  function truncLie(c){ return c.min > 0; }", "replace": "  function truncLie(c){ return c.min >= 0; }"},
    {"file": "index", "expect": "lying /", "find": "{ a:39, b:45, min:30, max:45, step:5 }", "replace": "{ a:39, b:45, min:0, max:45, step:5 }"},
    {"file": "index", "expect": "looks", "find": "{ a:7, b:8, min:5, max:20, step:5 }", "replace": "{ a:7, b:14, min:5, max:20, step:5 }"},
    {"file": "index", "expect": "truncY", "find": "  function truncY(c, v){ return TRUNC.py1 - (v - c.min) / (c.max - c.min) * (TRUNC.py1 - TRUNC.py0); }", "replace": "  function truncY(c, v){ return TRUNC.py1 - v / c.max * (TRUNC.py1 - TRUNC.py0); }"},
    {"file": "index", "expect": "truncPick", "find": "      if (p.x >= o.x && p.x <= o.x + TRUNC.cw && p.y >= o.y && p.y <= o.y + TRUNC.ch) return i;", "replace": "      if (p.x >= o.x - 6 && p.x <= o.x + TRUNC.cw + 6 && p.y >= o.y && p.y <= o.y + TRUNC.ch) return i;"},
    {"file": "index", "expect": "gTruncFound", "find": "其實只差 ' + (b - a) + '。'; },", "replace": "其實只差 ' + (b + a) + '。'; },"},
    {"file": "index", "expect": "squares tall", "find": "{ a:13, b:27, min:0, max:30, step:10 }", "replace": "{ a:13, b:27, min:0, max:30, step:5 }"},

    /* ---- codex 第一輪補的：刻度表、整個輸入範圍、線段的點擊範圍、小圖的觸控、說明的意思、情境卡的種類 ---- */
    {"file": "index", "expect": "niceStep(", "find": "  function niceStep(maxVal){\n    if (maxVal <= 10) return 1;", "replace": "  function niceStep(maxVal){\n    return 1;"},
    {"file": "index", "expect": "groupWhy(", "find": "  function groupWhy(e, n){\n    var a = e.a[e.k], b = e.b[e.k], ans = groupAnswer(e);", "replace": "  function groupWhy(e, n){\n    var a = e.a[e.k], b = e.b[e.k], ans = groupAnswer(e);\n    if (n > 60) return null;"},
    {"file": "index", "expect": "segHit / vtxSkip", "find": "segHit:16, vtxSkip:10 };", "replace": "segHit:1, vtxSkip:10 };"},
    {"file": "index", "expect": "segHit / vtxSkip", "find": "segHit:16, vtxSkip:10 };", "replace": "segHit:16, vtxSkip:0 };"},
    {"file": "index", "expect": "trunc chart", "find": "var TRUNC = { W:300, H:308, cw:146,", "replace": "var TRUNC = { W:300, H:308, cw:40,"},
    {"file": "index", "expect": "meaning gBarCount", "find": "' ' + unit + '，不是 ' + v + ' ' + unit + ' —— 要畫的格數是 '", "replace": "' ' + unit + '，正是 ' + v + ' ' + unit + ' —— 要畫的格數是 '"},
    {"file": "index", "expect": "meaning gPlotCol", "find": "'」的點 —— 要放在橫軸「' + m + '」那一直行上。'; },", "replace": "'」的點 —— 放在任何一直行都可以。'; },"},
    {"file": "index", "expect": "meaning gSegBad", "find": "'Another piece changes by more.'", "replace": "'This piece changes the most.'"},
    {"file": "index", "expect": "meaning gGroupOff", "find": "gGroupOff:function(n, hi){ return n + (hi ? ' 太大了' : ' 太小了')", "replace": "gGroupOff:function(n, hi){ return n + (hi ? ' 太大了' : ' 太大了')"},
    {"file": "index", "expect": "meaning gSortWhyKind", "find": "gSortWhyKind:{ bar:'是在比較不同的種類，而且只有一組資料',", "replace": "gSortWhyKind:{ bar:'是隨著時間在變化',"},
    {"file": "index", "expect": "meaning gTruncBad", "find": "長條看起來差多少，就真的差多少 —— 它沒有騙人。'; },", "replace": "長條看起來差多少，就真的差多少 —— 它會騙人。'; },"},
    {"file": "index", "expect": "job", "find": "'豆芽 10 天裡長高的變化', '一年 12 個月雨量的升降',", "replace": "'豆芽 10 天裡長高的變化', '一年 12 個月的雨量',"},

    /* ---- codex 第二輪補的 ---- */
    {"file": "index", "expect": "meaning gBarWin", "find": "gBarWin:function(u){ return '四根長條都畫對了：每一根的格數 × ' + u + '，就是表上的數。'; },", "replace": "gBarWin:function(u){ return '四根長條都畫對了：每一根的格數 ÷ ' + u + '，就是表上的數。'; },"},
    {"file": "index", "expect": "niceAxisMax(", "find": "  function niceAxisMax(maxVal, step){ return Math.ceil((maxVal + 0.0001) / step) * step; }", "replace": "  function niceAxisMax(maxVal, step){ return step; }"},
    {"file": "index", "expect": "top tick label", "find": "var TRUNC = { W:300, H:308, cw:146, ch:150, gap:8, px0:40, px1:136, py0:24,", "replace": "var TRUNC = { W:300, H:308, cw:146, ch:150, gap:8, px0:40, px1:136, py0:1,"},
    {"file": "index", "expect": "does not fit a slot", "find": "gSortCards:['Votes for 4 fruits',", "replace": "gSortCards:['Votesforfourfruitstoday',"},
    {"file": "index", "expect": "meaning gGroupWin", "find": "Math.max(a, b) + ' − ' + Math.min(a, b) + ' = ' + Math.abs(a - b) : a + ' + ' + b + ' = ' + (a + b)) + ' kg.'; },", "replace": "Math.max(a, b) + ' + ' + Math.min(a, b) + ' = ' + Math.abs(a - b) : a + ' + ' + b + ' = ' + (a + b)) + ' kg.'; },"},
    {"file": "index", "expect": "meaning gHints.sort", "find": "sort:'提示 1：先問自己 —— 是在比「不同的種類」，還是在看「隨著時間的變化」？有沒有兩組要並排比？',", "replace": "sort:'提示 1：先問自己 —— 是在比「不同的種類」？',"},

    /* ---- codex 第三輪補的 ---- */
    {"file": "index", "expect": "gBarWin en 10", "find": "gBarWin:function(u){ return 'All four bars are right: each bar’s squares × ' + u + ' is the number in the table.'; },", "replace": "gBarWin:function(u){ return 'All four bars are right: each bar’s squares ' + (u === 10 ? '÷ ' : '× ') + u + ' is the number in the table.'; },"},
    {"file": "index", "expect": "gGroupEmpty en", "find": "gGroupEmpty:'Type a number in the box first.',", "replace": "gGroupEmpty:'Press Check first.',"},
    {"file": "index", "expect": "tick labels are not drawn 12px", "find": "gText(s, TRUNC.px0 - 5, y + 4, v, { 'font-size':12,", "replace": "gText(s, TRUNC.px0 - 5, y + 4, v, { 'font-size':20,"},

    /* ---- codex 第四輪補的 ---- */
    {"file": "index", "expect": "bars are not at 28%", "find": "var cx = TRUNC.px0 + (TRUNC.px1 - TRUNC.px0) * (side ? 0.72 : 0.28), y = truncY(c, v);", "replace": "var cx = TRUNC.px0 + (TRUNC.px1 - TRUNC.px0) * (side ? 0.98 : 0.28), y = truncY(c, v);"},

    /* ---- 每一個保護單獨拿掉都要抓得到（BRIEF 2026-10-11） ---- */
    {"file": "index", "expect": "document (pointerup", "find": "      document.addEventListener('pointercancel', onDocEnd);\n", "replace": ""},
    {"file": "index", "expect": "tap-vs-drag threshold", "find": "      if (!moved && dx * dx + dy * dy > 36){", "replace": "      if (!moved && dx * dx + dy * dy > 0){"},
    {"file": "index", "expect": "slides away", "find": "      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", "replace": ""},
    {"file": "index", "expect": "after the round is solved", "find": "      if (B.onBoardTap && !gSolved) B.onBoardTap(pt);", "replace": "      if (B.onBoardTap) B.onBoardTap(pt);"},
    {"file": "index", "expect": "already judged right", "find": "        if (i < 0 || ok[i] || handles[i].busy()", "replace": "        if (i < 0 || handles[i].busy()"},
    {"file": "index", "expect": "already found", "find": "        if (i < 0 || found[i]) return;", "replace": "        if (i < 0) return;"},
    {"file": "index", "expect": "neutral style", "find": "cls:'gcard gscard', text:d.gSortCards[c]", "replace": "cls:'gcard gscard' + (SORT_TYPES[c] === 'line' ? ' gchip' : ''), text:d.gSortCards[c]"},

    /* ---- 驗證者第一次：長條上的數碰到格線、第二步的保護、刻度洩題 ---- */
    {"file": "index", "expect": "grid line (needs 2px clear)", "find": "    for (var y = top - 2 - 0.35 * TLBL; y - 1.1 * TLBL >= 2; y -= 0.5){", "replace": "    for (var y = top - 2 - 0.35 * TLBL; y - 1.1 * TLBL >= 2; y -= 0.5){ return top - 5;"},
    {"file": "index", "expect": "truncLabelY()", "find": "gText(s, cx, truncLabelY(c, v), v, { 'font-size':TLBL,", "replace": "gText(s, cx, truncY(c, v) - 5, v, { 'font-size':TLBL,"},
    {"file": "index", "expect": "gives the answer away", "find": "{ a:5, b:10, min:0, max:15, step:5 }, { a:49, b:54, min:0, max:60, step:20 }", "replace": "{ a:5, b:10, min:0, max:60, step:20 }, { a:49, b:54, min:0, max:60, step:20 }"},
    {"file": "index", "expect": "phase", "find": "        if (phase !== 2) return;\n", "replace": ""},

    {"file": "index", "expect": "a rank rule", "find": "{ a:42, b:46, min:40, max:100, step:20 }", "replace": "{ a:44, b:46, min:40, max:100, step:20 }"},
    {"file": "index", "expect": "first clear spot", "find": "      if (lines.every(function(l){ return l < bt - 2 || l > bb + 2; })) return y;", "replace": "      if (lines.every(function(l){ return l < bt - 2 || l > bb + 2; })) return y - 10 >= 16 ? y - 10 : y;"},

    /* ---- 驗證者第二次：過關那一句要對每一張騙人的圖都成立 ---- */
    {"file": "index", "expect": "meaning gTruncWin", "find": "      gTruncWin:'Found them all: when the axis doesn’t start at 0, the bar heights no longer match the numbers — B looks bigger compared with A than the numbers really show.',", "replace": "      gTruncWin:'Found them all: when the axis doesn’t start at 0, a tiny gap gets drawn as a huge one.',"},
    {"file": "index", "expect": "truncLooks says", "find": "  function truncLooks(c){ return Math.round((c.b - c.min) / (c.a - c.min) * 10) / 10; }", "replace": "  function truncLooks(c){ return Math.round(c.b / c.a * 10) / 10; }"},

    /* ---- 題庫：圖決定得了答案、算式、空格 ---- */
    {"file": "index", "expect": "between grid lines", "find": "values:[10,40,60,50], yUnit:'毫米'", "replace": "values:[10,40,58,50], yUnit:'毫米'"},
    {"file": "index", "expect": "arithmetic", "find": "why:'第 2 週，五年一班是 14，五年二班是 10，14 − 10 = 4。' }", "replace": "why:'第 2 週，五年一班是 14，五年二班是 10，14 − 10 = 3。' }"},
    {"file": "index", "expect": "missing space", "find": "WEEKS:['第 1 週','第 2 週',", "replace": "WEEKS:['第1週','第 2 週',"},
    {"file": "index", "expect": "ans differs", "find": "      opts:['4','24','2','14'], ans:0,\n      why:'第 2 週，五年一班是 14", "replace": "      opts:['4','24','2','14'], ans:3,\n      why:'第 2 週，五年一班是 14"},

    /* ---- review.html 的產生器 ---- */
    {"file": "review", "expect": "grid line", "find": "        a = idxs.map(function(){ return 2 * randInt(4, 10); });", "replace": "        a = idxs.map(function(){ return randInt(8, 20); });"},
    {"file": "review", "expect": "grid line", "find": "          do { nv = prev + step * (pick([-1, 1]) * randInt(1, 3)); } while (nv < step || nv > top);", "replace": "          do { nv = prev + (pick([-1, 1]) * randInt(1, 7)); } while (nv < step || nv > top);"},
    {"file": "review", "expect": "copies the number", "find": "        var m = mixOpts(avg, [avg - 1, avg + 1, s], nums);", "replace": "        var m = mixOpts(avg, [avg - 1, avg + 1, s]);"},
    {"file": "review", "expect": "copies the number", "find": "        var m = mixOpts(q, [round1(q - 0.1), round1(q + 0.1), round1(q * 2)], [k, dividend]);", "replace": "        var m = mixOpts(q, [round1(q - 0.1), round1(q + 0.1), round1(q * 2)]);"},
    {"file": "review", "expect": "arithmetic is wrong", "find": "            ? cats[d.qIdx] + '是 ' + d.squares[d.qIdx] + ' 格，一格代表 ' + d.unit + '，' + d.squares[d.qIdx] + ' × ' + d.unit + ' = ' + d.values[d.qIdx] + '。'", "replace": "            ? cats[d.qIdx] + '是 ' + d.squares[d.qIdx] + ' 格，一格代表 ' + d.unit + '，' + d.squares[d.qIdx] + ' × ' + d.unit + ' = ' + (d.values[d.qIdx] + 1) + '。'"},
    {"file": "review", "expect": "is wrong or 0", "find": "        if (a[qIdx] === b[qIdx]) b[qIdx] = a[qIdx] === 20 ? 18 : a[qIdx] + 2;", "replace": ""},
    {"file": "review", "expect": "copies the number", "find": "        if (squares[qIdx] < 3){ squares[qIdx] = randInt(3, 9); values[qIdx] = squares[qIdx] * unit; }", "replace": ""}
  ],

  sim: {
    blockStart: '  /* ---------- 靜態文字 ---------- */',
    INVARIANTS: {
      statBarRead: d => {
        if (d.values.some((v, i) => v !== d.squares[i] * d.unit)) return 'a value is not squares × unit';
        if (d.squares.some(s => !(isInt(s) && s >= 2 && s <= 9))) return 'squares outside 2~9 (the axis is 9 squares tall)';
        if (d.squares[d.qIdx] < 3) return 'the asked bar is under 3 squares — "one square too few" would be the stem\'s unit';
      },
      statBarTotal: d => { if (d.values.some(v => !(isInt(v) && v >= 3 && v <= 20))) return 'a value outside 3~20'; },
      statLineTrend: d => {
        if (![2, 5].includes(d.step)) return 'step ' + d.step;
        if (d.values.some(v => v % d.step || v < d.step || v > 10 * d.step)) return 'a point is not on a grid line (' + d.values.join(',') + ' step ' + d.step + ')';
        if (d.values.some((v, i) => i && v === d.values[i - 1])) return 'a flat piece';
        if (d.delta !== d.values[d.segIdx + 1] - d.values[d.segIdx] || d.absD !== Math.abs(d.delta)) return 'delta wrong';
      },
      statGroupedDiff: d => {
        if (d.a.concat(d.b).some(v => v % 2 || v < 8 || v > 20)) return 'a bar is not an even number 8~20 (not on the 2-step grid)';
        if (d.diff !== Math.abs(d.a[d.qIdx] - d.b[d.qIdx]) || d.diff === 0) return 'diff ' + d.diff + ' is wrong or 0';
      },
      statChooseType: d => { if (!(d.idx >= 0 && d.idx < 6) || d.types.length !== 4) return 'bad scenario/types'; },
      statMisleading: d => {
        if (!(d.axisMin > 0 && d.axisMin < d.vA && d.vB <= d.axisMax)) return 'the axis does not start above 0 under the bars';
        if (d.diff !== d.vB - d.vA || d.diff < 3) return 'diff wrong';
      },
      avgFromList: d => {
        if (d.nums.length !== d.n || d.nums.some(v => !(isInt(v) && v > 0)) || d.nums.reduce((a, b) => a + b, 0) !== d.avg * d.n) return 'the numbers do not average to ' + d.avg;
      },
      decimalDivide: d => {
        if (d.dividendTenths !== d.qt * d.k || Math.abs(d.dividend * 10 - d.dividendTenths) > 1e-9 || Math.abs(d.q * 10 - d.qt) > 1e-9) return 'dividend / q not consistent';
      },
      percentOfWhole: d => { if (d.whole * d.pct !== d.result * 100) return d.pct + '% of ' + d.whole + ' is not ' + d.result; }
    },
    /* 正解的第二套實作：只用原始參數重算 */
    expectedCorrect: function(d, genId, L){
      switch (genId){
        case 'statBarRead': return String(d.squares[d.qIdx] * d.unit);
        case 'statBarTotal': return String(d.values.reduce((a, b) => a + b, 0));
        case 'statLineTrend': { const dd = d.values[d.segIdx + 1] - d.values[d.segIdx]; return (L === 'zh' ? (dd >= 0 ? '上升' : '下降') : (dd >= 0 ? 'Up' : 'Down')) + ' ' + Math.abs(dd); }
        case 'statGroupedDiff': return String(Math.abs(d.a[d.qIdx] - d.b[d.qIdx]));
        case 'statChooseType': return ({ zh:{ bar:'長條圖', line:'折線圖', grouped:'複合長條圖' }, en:{ bar:'Bar chart', line:'Line graph', grouped:'Grouped bar chart' } })[L][['bar', 'line', 'grouped', 'line', 'bar', 'line'][d.idx]];
        case 'statMisleading': return String(d.vB - d.vA);
        case 'avgFromList': return String(d.nums.reduce((a, b) => a + b, 0) / d.nums.length);
        case 'decimalDivide': return String(Math.round(d.dividendTenths / d.k) / 10);
        case 'percentOfWhole': return String(d.whole * d.pct / 100);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, L){
      const range = (v, lo, hi) => (v >= lo && v <= hi) ? null : 'option ' + s + ' outside ' + lo + '~' + hi;
      if (genId === 'statChooseType') return /^(長條圖|折線圖|複合長條圖|圓餅圖|Bar chart|Line graph|Grouped bar chart|Pie chart)$/.test(s) ? null : 'option "' + s + '" is not a chart type';
      if (genId === 'statLineTrend'){
        const m = s.match(L === 'zh' ? /^(上升|下降) (\d+)$/ : /^(Up|Down) (\d+)$/);
        if (!m) return 'option "' + s + '" is not "up/down n"';
        return range(+m[2], 1, 60);
      }
      if (genId === 'decimalDivide'){ if (!/^\d+(\.\d)?$/.test(s)) return 'option "' + s + '" is not a one-decimal number'; return range(+s, 0.1, 40); }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const v = +s;
      if (genId === 'statBarRead') return range(v, 1, 100);
      if (genId === 'statBarTotal') return range(v, 1, 120);
      if (genId === 'statGroupedDiff') return range(v, 1, 45);
      if (genId === 'statMisleading') return range(v, 1, 70);
      if (genId === 'avgFromList') return range(v, 1, 130);
      if (genId === 'percentOfWhole') return range(v, 1, 200);
    },
    /* 刻意的迷思誘答：只放行「那一個值、那一種情況」 */
    stemEchoOk: {
      statBarRead: (d, o) => Number(o) === d.squares[d.qIdx],      /* 只讀了格數，忘了乘一格代表的數 —— 剛好等於「一格 = u」的 u */
      percentOfWhole: (d, o) => Number(o) === d.pct                /* 把百分率本身當成答案 */,
      /* simgen 的共用檢查用 /\d+/ 切題幹，「7.5 ÷ 3」會切出一個「5」—— 2.5 × 2 ＝ 5 不是抄題幹（題幹印的是 7.5）。
         只放行「不是題幹真正印出來的數」的那一種；真正印出來的數（除數、被除數）由下面 renderCheck 用含小數的比法擋 */
      decimalDivide: (d, o) => Number(o) !== d.k && Number(o) !== d.dividend
    },
    renderCheck: function(d, q, L, genId){
      /* 圖決定得了答案：沒有寫數字的長條（showValue 沒開）與折線，每一個值都要剛好在一條格線上 */
      const c = q.chart;
      if (c){
        const vals = c.kind === 'grouped' ? c.valuesA.concat(c.valuesB) : c.values;
        if (!(c.gridStep > 0) || !(c.axisMax >= Math.max(...vals)) || !(c.axisMin <= Math.min(...vals))) return 'the axis does not cover the data';
        if (!c.showValue){
          const off = vals.filter(v => Math.abs((v - c.axisMin) / c.gridStep - Math.round((v - c.axisMin) / c.gridStep)) > 1e-9);
          if (off.length) return 'unlabelled ' + c.kind + ' value(s) ' + off.join(',') + ' sit between grid lines (step ' + c.gridStep + ') — the picture does not determine the answer';
        }
        if ((c.axisMax - c.axisMin) / c.gridStep > 12) return 'more than 12 grid lines — the tick labels collide';
      }
      /* 誘答不可以抄題幹印出來的數（含小數；simgen 的共用檢查只比整數字串） */
      const stemNums = nums(q.stem.replace(/第 \d+ 週|Week \d+/g, ' '));
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const v = nums(q.opts[i]);
        if (v.length === 1 && stemNums.indexOf(v[0]) >= 0 && !(module.exports.sim.stemEchoOk[genId] && module.exports.sim.stemEchoOk[genId](d, q.opts[i]))) return 'distractor "' + q.opts[i] + '" copies the number ' + v[0] + ' out of the stem';
      }
      /* 解釋的算式逐條重算（題幹的「一格 = 5」不是算式，只驗解釋）。decimalDivide／percentOfWhole 是別課（小數、百分率）的複習題，
         lib/arith.js 不收小數與 %：它們的數由 expectedCorrect 與不變條件驗，解釋裡的數在這裡逐個比。 */
      if (genId === 'decimalDivide'){
        const want = (L === 'zh' ? [d.dividend, d.dividendTenths, 0.1, d.dividendTenths, d.k, d.qt, 0.1, d.q] : [d.dividend, d.dividendTenths, d.dividendTenths, d.k, d.qt, d.q]).map(Number), got = nums(q.why);
        if (got.join() !== want.join()) return 'the explanation reads ' + got.join(',') + ', expected ' + want.join(',');
        return;
      }
      if (genId === 'percentOfWhole'){
        const want = [d.whole, d.pct, d.whole, d.pct, 100, d.result], got = nums(q.why);
        if (got.join() !== want.join()) return 'the explanation reads ' + got.join(',') + ', expected ' + want.join(',');
        return;
      }
      const r = arith(q.why);
      if (r.problems.length) return 'arithmetic: ' + r.problems[0];
      if (genId !== 'statChooseType' && genId !== 'statLineTrend' && !r.verified) return 'the explanation has no verifiable equation: ' + q.why;
    }
  },

  data: {
    dataStart: "  var SVGNS = 'http://www.w3.org/2000/svg';",
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{shuffle, pick, niceStep, niceAxisMax, GAME_ORDER, GPICK, gChart, gLineY, gSnapK, gColOf, unsorted, BAR, GAME_BAR, barChart, barWhy, barLabelled, PLOT, GAME_PLOT, plotChart, plotTrayX, plotCell, plotWhy, segDelta, segBest, segDist, segPts, segPick, GROUP, GAME_GROUP, groupChart, groupAnswer, parseCount, groupWhy, groupBarX, SORT_TYPES, SORT_BINS, SORT, sortBinX, sortBinH, sortPick, sortWhy, TRUNC, GAME_TRUNC, truncLie, truncLooks, truncXY, truncY, truncPick, TLBL, truncLabelY}',
    check: function(D, I18N, fail, src){ checkData(D, I18N, fail, src); }
  }
};
