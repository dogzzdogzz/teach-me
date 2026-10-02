/* grade-2/math/time 的檢查設定。
   斷言的邊界一律取自這一課自己講出來的規則（時 1~12、分 0~59、一個數字 5 分、
   月份天數表），不是「看起來夠寬」的數字 —— numbers 那一課就是因為上限寫 9999
   才讓 1001 溜進 1000 以內的數。 */

const DIM = [31,28,31,30,31,30,31,31,30,31,30,31];
const WD_ZH = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const WD_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/* review.html 的 SCENES 在這裡獨立寫一次 —— 檢查腳本抄產生器的資料就等於沒檢查。 */
const SCENE_HALF = ['am','am','night','night'];
const SCENE_HOURS = [[6,7],[7,8],[6,7],[8,9]];

/* 每個產生器的選項長什麼樣子。正解與誘答分開驗：
   dateAfter 的「7 月 33 日」是刻意的誘答（忘記換月），但正解永遠是合法日期。 */
const SHAPE = {
  readClock:'time', readClockTrap:'time', halfPast:'time',
  minuteOfNumber:'min', numberOfMinute:'num',
  ampmLife:'ampm', weekdayAfter:'wd',
  daysInMonth:'monthdays', dateAfter:'date',
  weeksToDays:'days', birthdayCountdown:'days'
};

function checkShape(shape, s, lang, isCorrect, genId){
  let m;
  switch (shape){
    case 'time':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 點(?: (\d{1,2}) 分|整)$/) : s.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return 'not a clock time: ' + s;
      if (!(Number(m[1]) >= 1 && Number(m[1]) <= 12)) return 'hour outside 1~12: ' + s;
      if (m[2] !== undefined && !(Number(m[2]) >= 0 && Number(m[2]) <= 59)) return 'minute outside 0~59: ' + s;
      if (isCorrect && genId === 'halfPast' && Number(m[2]) !== 30) return 'half past must be :30, got ' + s;
      return null;
    case 'min':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 分$/) : s.match(/^(\d{1,2}) minutes$/);
      if (!m) return 'not a minute count: ' + s;
      if (!(Number(m[1]) >= 1 && Number(m[1]) <= 59)) return 'minutes outside 1~59: ' + s;
      if (isCorrect && Number(m[1]) % 5 !== 0) return 'the correct minute must be a multiple of 5: ' + s;
      return null;
    case 'num':
      if (!/^\d{1,2}$/.test(s)) return 'not a dial number: ' + s;
      if (!(Number(s) >= 1 && Number(s) <= 12)) return 'dial number outside 1~12: ' + s;
      if (isCorrect && Number(s) > 11) return 'the correct dial number here is 1~11 (12 would be 0 minutes): ' + s;
      return null;
    case 'ampm':
      m = (lang === 'zh') ? s.match(/^(上午|晚上) (\d{1,2}) 點$/) : s.match(/^(\d{1,2}):00 (a\.m\.|p\.m\.)$/);
      if (!m) return 'not an a.m./p.m. time: ' + s;
      { const h = Number(lang === 'zh' ? m[2] : m[1]);
        if (!(h >= 1 && h <= 12)) return 'hour outside 1~12: ' + s; }
      return null;
    case 'wd':
      if ((lang === 'zh' ? WD_ZH : WD_EN).indexOf(s) < 0) return 'not a weekday name: ' + s;
      return null;
    case 'monthdays':
      m = (lang === 'zh') ? s.match(/^(\d{2}) 天$/) : s.match(/^(\d{2}) days$/);
      if (!m) return 'not a day count: ' + s;
      if (isCorrect && [30, 31].indexOf(Number(m[1])) < 0) return 'a month (other than February) has 30 or 31 days, got ' + s;
      /* 誘答也必須是「某個月真的有的天數」—— 26 天、27 天不是月長，放進選項只是雜訊。 */
      if ([28, 29, 30, 31].indexOf(Number(m[1])) < 0) return 'not a real month length: ' + s;
      return null;
    case 'date':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 月 (\d{1,2}) 日$/) : s.match(/^(\d{1,2}) ([A-Z][a-z]+)$/);
      if (!m) return 'not a date: ' + s;
      { const mo = (lang === 'zh') ? Number(m[1]) : MON_EN.indexOf(m[2]) + 1;
        const dd = Number(lang === 'zh' ? m[2] : m[1]);
        if (!(mo >= 1 && mo <= 12)) return 'month outside 1~12: ' + s;
        if (isCorrect){
          if (!(dd >= 1 && dd <= DIM[mo - 1])) return 'the correct date must really exist: ' + s;
        } else if (!(dd >= 1 && dd <= 35)){
          return 'distractor date wildly out of range: ' + s;
        } }
      return null;
    case 'days':
      /* 上限依產生器各自的參數推出來，不是隨手給一個大數：
         weeksToDays 的 k 是 2~5 → 7k 最大 35，誘答最多 7k+7 = 42；
         birthdayCountdown 的日期都在 1~31，誘答最多 n+7，也不可能超過 31。 */
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 天$/) : s.match(/^(\d{1,2}) days$/);
      if (!m) return 'not a day count: ' + s;
      { const hi = (genId === 'weeksToDays') ? 42 : 31;
        if (!(Number(m[1]) >= 1 && Number(m[1]) <= hi)) return 'day count outside 1~' + hi + ': ' + s; }
      return null;
    default:
      return 'NO SHAPE DEFINED for ' + genId;
  }
}

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithTime = require('./lib/arith.js').makeArith({
  units: ["點", "分", "時", "秒", "個", "次"],
  unitsEn: ["minutes?", "mins?", "hours?", "seconds?", "times?", "oclock"]
});

const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 小遊戲「對時大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   撥長針（一個數字 5 分、一圈 60 分）、讀時間（先看短針還沒走到哪、再數長針的 5）、排一天（上午 → 下午 → 晚上）、
   補日曆（一排 7 天，往下一格多 7）、數日子（+1 天、+7 天，差 7 天同一個星期幾）。做法照 grade-2-length.js：
   - 頁面的純函式（dialSVG／dialAngle／dialNumber／angleStep／snapMinutes／hourAfter／calCellXY／dayMin）拿整個定義域去呼叫，
     再和這裡**自己的**公式比（星期幾用 Sakamoto 公式算，不用 Date）；
   - 每一關的 RENDER 函式本體**真的跑**（假的 DOM），照遊戲的規則對每一題做每一種動作，看頁面自己的程式收不收、說哪一句、
     畫出來的指針指幾度、什麼時候過關；
   - nearestOpen()、roundSolved()、roundMiss()、shuffle() 從原始碼切出來真的跑；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯），而且那句話說的事要成立；
   - 版面與觸控 ≥ 44px 從 index.html 的常數與 CSS 讀。
   已知極限：拖拉的手勢（第一根手指、capture 遺失、畫板縮放、375px 實際尺寸）由
   teaching-workspace/game-harness/g2-time 的端對端測試驗；這裡的「拖」是直接呼叫 B.onGrab／P.place／B.onMove。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

/* 自己的星期幾（Sakamoto）：0 ＝ 星期日。和頁面的 Date 寫法是兩條路 */
function dowOwn(y, m, d){
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  if (m < 3) y -= 1;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[m - 1] + d) % 7;
}
function dimOwn(y, m){ const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; return m === 2 ? (leap ? 29 : 28) : DIM[m - 1]; }

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const has = (where, text, re) => { if (!re.test(String(text))) fail(where + ': should say ' + re + ' — ' + text); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board (' + JSON.stringify(o) + ')'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const W = D.GAME_W, Y = D.CAL_YEAR;
  /* 自己的鐘點運算 */
  const nextOwn = h => h % 12 + 1;
  const plusHours = (h, q) => { let x = h; for (let i = 0; i < Math.abs(q); i++) x = q > 0 ? x % 12 + 1 : (x + 10) % 12 + 1; return x; };
  const timeOwn = (L, h, m) => L === 'zh' ? (m === 0 ? h + ' 點整' : h + ' 點 ' + m + ' 分') : h + ':' + (m < 10 ? '0' : '') + m;
  const dayKey = v => (v.half === 'am' ? v.h : v.h + 12);   /* 一天裡的第幾個鐘頭 */
  const WDZ = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['long', 'read', 'day', 'fill', 'hop'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
    if (!/\broundSolved\(/.test(B[t].replace(/\/\*[\s\S]*?\*\//g, ''))) fail(t + ': the round never calls roundSolved()');
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 第 5 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外）；其他四關要寫出「先點、再點」 */
  if (!/用點的/.test(I18N.zh.gAsks.hop) || !/all taps/.test(I18N.en.gAsks.hop)) fail('hop: the round has no drag — its instructions must say it is all taps');
  ['long', 'read', 'day', 'fill'].forEach(t => {
    if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way');
  });
  /* 第 1 關的說明要先講「順著 1、2、3 的方向」—— 倒著轉會被擋下來，不可以等犯了錯才第一次聽到 */
  if (!/1、2、3 的方向/.test(I18N.zh.gAsks.long) || !/1, 2, 3 way/.test(I18N.en.gAsks.long)) fail('long: the instructions do not say which way to turn');
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;(?:\s*\/\*[\s\S]*?\*\/)*\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); if \(B\.onHome\) B\.onHome\(P\); return; \}/.test(src))
    fail('a piece that was tapped and then dragged stays selected — a later tap would drop it again');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src) || !/gCtx = \{\}; gGen\+\+;/.test(extractFunction(src, 'startRound') || ''))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');
  /* 拖長針時：每一次移動都要算進「轉了幾分」，彈回去要歸零（不然下一次拖會從舊的角度接著加） */
  if (!/if \(moved\)\{ P\.place\(orig\.x \+ dx, orig\.y \+ dy\); if \(B\.onMove\) B\.onMove\(P\); \}/.test(src)) fail('a drag does not report every move to the round (the long hand would not turn)');
  if (!/if \(B\.onGrab\) B\.onGrab\(P\);/.test(src)) fail('a new drag does not tell the round it started (the turn would not start from 0)');

  /* 「下一關」真的往下一關走、「重新開始」回到第 1 關、每一關開頭照 GAME_ORDER 畫（字面掃描；e2e 實際按過五關） */
  if (!/gNext\.addEventListener\('click', function\(\)\{\s*if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}\s*\}\);/.test(src)) fail('lifecycle: Next does not move to the next round');
  if (!/function restartGame\(\)\{\s*gRound = 0; gScore = 0; elScore\.textContent = '0'; startRound\(\);\s*\}/.test(src)) fail('lifecycle: Restart does not go back to round 1 with 0 stars');
  if (!/var type = GAME_ORDER\[gRound\];[\s\S]*?RENDER\[type\]\(d\);/.test(extractFunction(src, 'startRound') || '')) fail('lifecycle: startRound() does not draw the round GAME_ORDER[gRound]');
  if (!/function renderAll\(\)\{[\s\S]*?restartGame\(\);\s*\}/.test(src)) fail('lifecycle: a language switch does not rebuild the game');

  /* --- 觸控：375px 手機上畫板能用的寬度從頁面的 CSS 算 --- */
  const cssPx = (sel, re) => { const m = src.match(new RegExp('\\n\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); const v = m && m[1].match(re); return v ? v.slice(1).map(Number) : null; };
  const wrapPad = cssPx('.wrap', /padding:(\d+)px (\d+)px/), cardPad = cssPx('.card', /padding:(\d+)px/), cardBorder = cssPx('.card', /border:(\d+)px/), stagePad = cssPx('.gstage', /padding:\s*(\d+)px (\d+)/);
  if (!wrapPad || !cardPad || !cardBorder || !stagePad) fail('touch: cannot read .wrap / .card / .gstage padding from the CSS');
  const avail = 375 - 2 * ((wrapPad || [0, 0])[1] + (cardPad || [0])[0] + (cardBorder || [0])[0] + (stagePad || [0, 0])[1]);
  const scale = Math.min(1.5, avail / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK (the ring on the long hand)', D.GPICK);
  small('a number card (' + D.READ_CARD.w + '×' + D.READ_CARD.h + ')', Math.min(D.READ_CARD.w, D.READ_CARD.h));
  small('a time-of-day card (' + D.DAY_CARD.w + '×' + D.DAY_CARD.h + ')', Math.min(D.DAY_CARD.w, D.DAY_CARD.h));
  small('a date card (' + D.FILL_CARD.w + '×' + D.FILL_CARD.h + ')', Math.min(D.FILL_CARD.w, D.FILL_CARD.h));
  [D.READ_CARD.w, D.READ_CARD.h, D.DAY_CARD.w, D.DAY_CARD.h, D.FILL_CARD.w, D.FILL_CARD.h].forEach(s => { if (s < D.GPICK) fail('a card side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\n\s*\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('hop: the step buttons (.btn) are not at least 46px tall'); }
  need('long', /var ring = addPiece\(B, \{ w:GPICK, h:GPICK, cx:home\.x, cy:home\.y,/, 'the ring is not GPICK × GPICK at its home on the long hand');
  need('read', /addPiece\(B, \{ w:READ_CARD\.w, h:READ_CARD\.h, cx:cx, cy:cy,/, 'the number cards are not READ_CARD.w × READ_CARD.h');
  need('day', /addPiece\(B, \{ w:DAY_CARD\.w, h:DAY_CARD\.h, cx:cx, cy:cy,/, 'the time cards are not DAY_CARD.w × DAY_CARD.h');
  need('fill', /addPiece\(B, \{ w:FILL_CARD\.w, h:FILL_CARD\.h, cx:cx, cy:cy,/, 'the date cards are not FILL_CARD.w × FILL_CARD.h');

  /* --- 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = R0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = { disabled:true }, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves, r0) => new Function(env.replace('S0', s0).replace('R0', r0 || 0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes, next:gNext.disabled, hint:gHintBtn.disabled };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
        /* 過關之後：前四關打開「下一關」、最後一關不打開而且說全過（codex 第一輪：只驗分數的話，下一關可以永遠是灰的） */
        for (let r0 = 0; r0 < 5; r0++){
          const r = run(0, 0, 1, r0);
          if (r0 < 4 && (r.next !== false || /W/.test(r.html))) fail('lifecycle: solving round ' + (r0 + 1) + ' does not enable Next (or already says the game is won)');
          if (r0 === 4 && (r.next !== true || !/W2/.test(r.html))) fail('lifecycle: solving the last round enables Next or does not say the game is won');
          if (r.hint !== true) fail('lifecycle: the hint button stays on after the round is solved');
        }
      } catch (e){ fail('stars: roundSolved()/roundMiss() could not run: ' + e.message); }
    }
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    seq('gStars ' + L, d.gStars(2), [2]);
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' missing or has a number in it');
  });

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }

  /* ================= 鐘面的純函式（第 1、2 關） ================= */
  const polarOwn = (cx, cy, a, r) => ({ x:cx + r * Math.sin(a * Math.PI / 180), y:cy - r * Math.cos(a * Math.PI / 180) });
  const angOf = (x1, y1, x2, y2) => { let a = Math.atan2(x2 - x1, y1 - y2) * 180 / Math.PI; return a < 0 ? a + 360 : a; };
  const angDiff = (a, b) => { const d = ((a - b) % 360 + 360) % 360; return d > 180 ? 360 - d : d; };
  /* 從畫出來的 SVG 讀兩根指針（class hh／mh 的 <line>） */
  const hands = svg => {
    const g = cls => { const m = String(svg).match(new RegExp('<line class="' + cls + '" x1="([\\d.\\-]+)" y1="([\\d.\\-]+)" x2="([\\d.\\-]+)" y2="([\\d.\\-]+)"')); return m ? angOf(+m[1], +m[2], +m[3], +m[4]) : NaN; };
    return { hh:g('hh'), mh:g('mh') };
  };
  {
    let n = 0;
    [D.LONG_DIAL.size, D.READ_DIAL.size].forEach(size => {
      for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 2.5){
        const svg = D.dialSVG(h, m, size), a = hands(svg); n++;
        if (!(angDiff(a.mh, m * 6) < 0.05)) fail('dialSVG(' + h + ', ' + m + ', ' + size + '): the long hand points at ' + a.mh + '°, should be ' + m * 6 + '°');
        if (!(angDiff(a.hh, ((h % 12) + m / 60) * 30) < 0.05)) fail('dialSVG(' + h + ', ' + m + ', ' + size + '): the short hand is at ' + a.hh + '°, should be ' + ((h % 12) + m / 60) * 30 + '° — it must sit between the numbers');
        if (Number.isInteger(m) && m % 5 === 0) canvasProblems(svg).forEach(p => fail('dialSVG(' + h + ':' + m + ', ' + size + '): ' + p));
      }
      /* 12 個數字在自己的位置上（角度 k × 30°），字的大小跟著鐘面走 */
      const svg = D.dialSVG(3, 0, size), R = D.dialR(size);
      for (let k = 1; k <= 12; k++){
        const m = svg.match(new RegExp('<text x="([\\d.]+)" y="([\\d.]+)" font-size="(\\d+)"[^>]*>' + k + '</text>'));
        if (!m) { fail('dialSVG(' + size + '): number ' + k + ' is not drawn'); continue; }
        const fsz = +m[3], ang = angOf(size / 2, size / 2, +m[1], +m[2] - fsz * 0.36);
        if (!(angDiff(ang, k * 30) < 0.3)) fail('dialSVG(' + size + '): number ' + k + ' is at ' + ang.toFixed(1) + '°');
        if (!(fsz * scale >= 11)) fail('dialSVG(' + size + '): the numbers are ' + (fsz * scale).toFixed(1) + 'px on a phone — too small to read');
        if (k === 1 && !(near(Math.hypot(+m[1] - size / 2, +m[2] - fsz * 0.36 - size / 2), R * 0.79, 0.2))) fail('dialSVG(' + size + '): numbers are not on the 0.79 R ring');
      }
      /* 長針要比短針長，而且長針的尖端在數字的圈圈裡面（看得出指著哪一個數字），短針碰不到數字 */
      const s0 = D.dialSVG(1, 10, size), get = cls => s0.match(new RegExp('<line class="' + cls + '" x1="([\\d.]+)" y1="([\\d.]+)" x2="([\\d.]+)" y2="([\\d.]+)"'));
      const lh = get('hh'), lm = get('mh'), len = mm => Math.hypot(+mm[3] - +mm[1], +mm[4] - +mm[2]);
      if (!(lh && lm && len(lm) > len(lh) * 1.3)) fail('dialSVG(' + size + '): the long hand is not clearly longer than the short hand');
      if (!(lm && len(lm) < R * 0.79 && len(lm) > R * 0.6)) fail('dialSVG(' + size + '): the long hand tip should reach just inside the numbers');
    });
    if (n !== 2 * 12 * 24) fail('dialSVG check covered ' + n + ' faces, expected 576');
  }
  {
    const Dl = D.LONG_DIAL, R = D.dialR(Dl.size);
    let bad = 0, n = 0;
    for (let a = 0; a < 360; a += 0.5) for (const rr of [R * Dl.inner - 0.5, R * Dl.inner + 0.5, R * 0.5, R, R * Dl.outer - 0.5, R * Dl.outer + 0.5]){
      const pt = polarOwn(Dl.cx, Dl.cy, a, rr); n++;
      const own = (rr < R * Dl.inner || rr > R * Dl.outer) ? 0 : ((Math.floor((a + 15) / 30) % 12) || 12);
      const got = D.dialNumber(Dl, pt);
      /* 正好在兩個數字中間（15°、45°…）兩邊都算對 */
      if (got !== own && !(a % 30 === 15 && got === ((Math.floor((a - 15) / 30) % 12) || 12))) bad++;
      if (!(angDiff(D.dialAngle(Dl, pt), a) < 1e-6)) bad++;
    }
    if (bad) fail('dialNumber()/dialAngle() disagree with the nearest number by angle in ' + bad + ' of ' + n + ' points');
    for (let a0 = 0; a0 < 360; a0 += 7) for (let a1 = 0; a1 < 360; a1 += 11){
      let d = a1 - a0; if (d > 180) d -= 360; if (d <= -180) d += 360;
      if (!near(D.angleStep(a0, a1), d)) { fail('angleStep(' + a0 + ', ' + a1 + ') = ' + D.angleStep(a0, a1) + ', should be ' + d); break; }
    }
    for (let t = -130; t <= 130; t += 0.25){ const w = 5 * Math.round(t / 5); if (D.snapMinutes(t) !== w){ fail('snapMinutes(' + t + ') = ' + D.snapMinutes(t)); break; } }
    for (let h = 1; h <= 12; h++) for (let q = -3; q <= 3; q++) if (D.hourAfter(h, q) !== plusHours(h, q)) fail('hourAfter(' + h + ', ' + q + ') = ' + D.hourAfter(h, q) + ', should be ' + plusHours(h, q));
    /* 圈圈在每一個數字上都在畫板裡，而且不壓到數字（數字在 0.79 R、圈圈半徑 GPICK / 2） */
    inside(box(Dl.cx, Dl.cy, Dl.size, Dl.size), 'long: the dial', W, D.LONG_H);
    for (let k = 0; k < 12; k++){ const p = D.ringXY(Dl, k * 30); inside(box(p.x, p.y, D.GPICK, D.GPICK), 'long: the ring at ' + k * 30 + '°', W, D.LONG_H); }
    if (!(R * Dl.ring + D.GPICK / 2 < R * 0.79 - Math.round(R * 0.17) * 0.6)) fail('long: the ring covers the numbers');
    if (!(R * Dl.ring - D.GPICK / 2 > R * Dl.inner)) fail('long: the ring reaches into the dead zone at the centre');
  }

  /* ================= 題庫 ================= */
  {
    const keys = new Set();
    let trap = 0;
    D.GAME_LONG.forEach((e, i) => {
      const w = 'GAME_LONG[' + i + ']';
      if (!(e.h >= 1 && e.h <= 12)) fail(w + ': hour outside 1~12');
      if (!(e.m % 5 === 0 && e.m > 0 && e.m < 60)) fail(w + ': m must be 5~55 in fives (one number = 5 minutes; 0 / 60 would be no turn)');
      if (e.m / 5 <= 2) trap++;   /* 5 分、10 分：「把分鐘數當數字」的迷思會指著 5／10 —— 那一格要說得出來 */
      keys.add(e.h + ':' + e.m);
    });
    if (keys.size !== D.GAME_LONG.length) fail('GAME_LONG has a repeated time');
    if (!trap) fail('GAME_LONG has no 5- or 10-minute task (the "the number is the minutes" trap never comes up)');
    if (!D.GAME_LONG.some(e => e.m >= 40)) fail('GAME_LONG has no task past the half (the long hand never goes far)');
  }
  {
    let wrap = 0;
    D.GAME_READ.forEach((e, i) => {
      const w = 'GAME_READ[' + i + ']', n = e.m / 5, nx = nextOwn(e.h);
      if (!(e.h >= 1 && e.h <= 12)) fail(w + ': hour outside 1~12');
      if (!(e.m % 5 === 0 && e.m >= 35 && e.m <= 55)) fail(w + ': m must be 35~55 (the short hand nearly at the next number is the whole point)');
      if (new Set([e.h, nx, n, e.m]).size !== 4) fail(w + ': the four cards ' + [e.h, nx, n, e.m].join(',') + ' are not all different');
      if (e.h >= 11) wrap++;
    });
    if (!wrap) fail('GAME_READ never crosses 12 (11 → 12, 12 → 1)');
  }
  D.GAME_DAY.forEach((set, i) => {
    const w = 'GAME_DAY[' + i + ']';
    if (set.length !== 4) fail(w + ': ' + set.length + ' cards');
    set.forEach(v => {
      const okH = v.half === 'am' ? v.h >= 6 && v.h <= 11 : v.half === 'pm' ? v.h >= 1 && v.h <= 4 : v.half === 'night' ? v.h >= 7 && v.h <= 10 : false;
      if (!okH) fail(w + ': ' + v.half + ' ' + v.h + ' is not a clear a.m. / afternoon / evening hour (no 12, no 5–6)');
      if (D.dayMin(v) !== dayKey(v) * 60) fail(w + ': dayMin(' + JSON.stringify(v) + ') = ' + D.dayMin(v));
      if (!D.DAY_ICON[v.half]) fail(w + ': no icon for ' + v.half);
    });
    if (new Set(set.map(dayKey)).size !== 4) fail(w + ': two cards are the same time');
    if (!set.some(a => a.half === 'am' && set.some(b => b.half !== 'am' && b.h < a.h))) fail(w + ': no p.m. card with a smaller number than an a.m. card (the trap of the round)');
    const naive = set.slice().sort((a, b) => a.h - b.h).map(dayKey).join(), right = set.map(dayKey).sort((a, b) => a - b).join();
    if (naive === right) fail(w + ': sorting by the number alone already gives the right order');
  });
  {
    const rowsOf = mo => Math.ceil((dowOwn(Y, mo, 1) + dimOwn(Y, mo)) / 7);
    D.GAME_FILL.forEach((e, i) => {
      const w = 'GAME_FILL[' + i + ']', len = dimOwn(Y, e.mo), first = dowOwn(Y, e.mo, 1);
      if (rowsOf(e.mo) > 5) fail(w + ': month ' + e.mo + ' needs ' + rowsOf(e.mo) + ' rows — the board has room for 5');
      if (e.holes.length !== 3 || new Set(e.holes).size !== 3) fail(w + ': needs three different holes');
      e.holes.forEach(x => {
        if (!(x >= 1 && x <= len)) fail(w + ': hole ' + x + ' is not a date of month ' + e.mo);
        if (x - 7 < 1) fail(w + ': hole ' + x + ' is in the first row — there is no date above it for the reason');
        if (e.holes.indexOf(x - 7) >= 0) fail(w + ': the box above hole ' + x + ' is a hole too');
        if (e.holes.indexOf(x - 1) >= 0 || e.holes.indexOf(x + 1) >= 0) fail(w + ': two holes side by side');
      });
      if (!e.holes.some(x => (first + x - 1) % 7 > 0)) fail(w + ': every hole is in the Sunday column — the overlap test has no box to its left');
    });
    D.GAME_HOP.forEach((e, i) => {
      const w = 'GAME_HOP[' + i + ']', len = dimOwn(Y, e.mo);
      if (rowsOf(e.mo) > 5) fail(w + ': month ' + e.mo + ' needs ' + rowsOf(e.mo) + ' rows');
      if (!(e.s >= 1 && e.n >= 7 && e.s + e.n <= len)) fail(w + ': ' + e.s + ' + ' + e.n + ' is not a date of month ' + e.mo);
    });
    if (!D.GAME_HOP.some(e => e.n % 7 === 0) || !D.GAME_HOP.some(e => e.n % 7 !== 0)) fail('GAME_HOP needs both whole weeks and weeks-and-days tasks');
    /* calCellXY ＝ 這裡自己的日曆（Sakamoto）：第 d 日在星期 dow 那一欄、第 floor((first + d − 1) / 7) 排 */
    [3, 4, 6, 7, 9, 10, 11].forEach(mo => {
      const first = D.firstWeekday(Y, mo);
      if (first !== dowOwn(Y, mo, 1)) fail('firstWeekday(' + Y + ', ' + mo + ') = ' + first + ', Sakamoto says ' + dowOwn(Y, mo, 1));
      if (D.daysInMonth(Y, mo) !== dimOwn(Y, mo)) fail('daysInMonth(' + Y + ', ' + mo + ')');
      for (let d0 = 1; d0 <= dimOwn(Y, mo); d0++){
        const c = D.calCellXY(D.CAL_GRID, 0, first, d0), col = dowOwn(Y, mo, d0), row = Math.floor((dowOwn(Y, mo, 1) + d0 - 1) / 7);
        if (!near(c.x, D.CAL_GRID.x0 + col * D.CAL_GRID.cw + D.CAL_GRID.cw / 2) || !near(c.y, D.CAL_GRID.head + row * D.CAL_GRID.ch + D.CAL_GRID.ch / 2)) { fail('calCellXY: ' + mo + '/' + d0 + ' is not in the ' + WDZ[col] + ' column, row ' + row); break; }
        if (d0 + 7 <= dimOwn(Y, mo)){ const b = D.calCellXY(D.CAL_GRID, 0, first, d0 + 7); if (!near(b.x, c.x) || !near(b.y, c.y + D.CAL_GRID.ch)) { fail('calCellXY: ' + (d0 + 7) + ' is not straight under ' + d0); break; } }
      }
    });
  }

  /* ================= 版面（畫板裡、不重疊） ================= */
  {
    const S = D.READ_SLOT, Cd = D.READ_CARD, H = D.READ_H, Dl = D.READ_DIAL;
    const slots = S.x.map(x => box(x, S.y, S.w, S.h)), cards = [0, 1, 2, 3].map(i => box((W - 3 * Cd.step) / 2 + i * Cd.step, Cd.y, Cd.w, Cd.h));
    const dial = box(Dl.cx, Dl.cy, Dl.size, Dl.size), lbl = S.x.map(x => ({ x:x - D.READ_LBL_W / 2, y:D.READ_LBL_Y, w:D.READ_LBL_W, h:22 }));
    [dial].concat(slots, cards, lbl).forEach((o, i) => inside(o, 'read: item ' + i, W, H));
    noHits([dial, lbl[0], slots[0], cards[0]], 'read: dial / label / box / cards (column 1)');
    noHits([dial, lbl[1], slots[1], cards[3]], 'read: dial / label / box / cards (column 2)');
    noHits(cards, 'read: cards'); noHits(slots, 'read: boxes'); noHits(lbl, 'read: labels');
  }
  {
    const S = D.DAY_SLOT, Cd = D.DAY_CARD, H = D.DAY_H;
    const slots = S.x.map(x => box(x, S.y, S.w, S.h)), cards = [0, 1, 2, 3].map(i => box((W - 3 * Cd.step) / 2 + i * Cd.step, Cd.y, Cd.w, Cd.h));
    slots.concat(cards).forEach((o, i) => inside(o, 'day: item ' + i, W, H));
    noHits(slots.concat(cards), 'day: boxes/cards');
    /* 相鄰兩格只隔一條小縫、吸附範圍重疊：縫裡每 0.25px 都判給比較近的那一格（nearestOpen 真的跑） */
    if (nearestOpen){
      const list = slots.map((r, i) => ({ id:i, cx:r.x + r.w / 2, cy:r.y + r.h / 2, hw:r.w / 2, hh:r.h / 2, done:false }));
      let checked = 0;
      for (let i = 0; i < 3; i++){
        const r = slots[i].x + slots[i].w, l = slots[i + 1].x;
        if (!(l - r < 2 * D.GPAD)) fail('day: boxes ' + i + ' and ' + (i + 1) + ' do not overlap their drop pads — the nearest-box test has nothing to test');
        for (let x = r - 2; x <= l + 2; x += 0.25){ const g = nearestOpen(list, { x, y:S.y }, D.GPAD); checked++; const want = (x - r) < (l - x) ? i : i + 1; if (Math.abs((x - r) - (l - x)) > 1e-9 && (!g || g.id !== want)) { fail('day: a drop at x ' + x + ' goes to box ' + (g && g.id) + ', the nearer is ' + want); break; } }
      }
      if (checked < 30) fail('day: overlap zones barely checked');
    }
  }
  {
    const G = D.CAL_GRID;
    if (!(G.x0 >= 0 && G.x0 + 7 * G.cw <= W)) fail('calendar: 7 columns do not fit the board');
    const gridBottom = y0 => y0 + G.head + 5 * G.ch;
    if (!(gridBottom(D.FILL_Y0) <= D.FILL_CARD.y - D.FILL_CARD.h / 2 - 4)) fail('fill: the date cards overlap the calendar');
    if (!(D.FILL_CARD.y + D.FILL_CARD.h / 2 <= D.FILL_H)) fail('fill: the date cards are below the board');
    const cards = [0, 1, 2].map(i => box((W - 2 * D.FILL_CARD.step) / 2 + i * D.FILL_CARD.step, D.FILL_CARD.y, D.FILL_CARD.w, D.FILL_CARD.h));
    cards.forEach((c, i) => inside(c, 'fill: date card ' + i, W, D.FILL_H)); noHits(cards, 'fill: date cards');
    if (!(gridBottom(D.HOP_Y0) <= D.HOP_H)) fail('hop: the calendar is below the board');
    if (!(D.FILL_Y0 >= 40 && D.HOP_Y0 >= 56)) fail('calendar: the title / task is squeezed into the weekday row');
    /* 格子之間沒有縫：放在空格左邊 2px 以內，左邊那一格（陣列裡在前面、已經寫好）也搆得到 —— 判給比較近的空格 */
    if (nearestOpen){
      const spots = [{ day:1, cx:G.x0 + G.cw / 2, cy:50, hw:G.cw / 2, hh:G.ch / 2, done:true }, { day:2, cx:G.x0 + 1.5 * G.cw, cy:50, hw:G.cw / 2, hh:G.ch / 2, done:false }];
      for (let dx = 0.25; dx <= D.GPAD; dx += 0.25){ const g = nearestOpen(spots, { x:G.x0 + G.cw + dx, y:50 }, D.GPAD); if (!g || g.day !== 2){ fail('fill: a drop ' + dx + 'px inside a hole, next to a filled box, does not go in the hole'); break; } }
      const g2 = nearestOpen(spots, { x:G.x0 + G.cw - 1, y:50 }, D.GPAD); if (g2) fail('fill: a drop on a filled box (1px from the hole) is taken — it must bounce silently');
    }
  }

  /* ================= 每一句說明：數字與「字」 ================= */
  LANGS.forEach(L => {
    const d = I18N[L];
    for (let k = 1; k <= 11; k++) [5, 10, 20, 40, 55].forEach(m => {
      if (k * 5 === m) return;
      seq('gLongWrong ' + L + ' ' + k + '/' + m, d.gLongWrong(k, m), L === 'zh' ? [k, k, 5, k * 5, m] : [k, k, k * 5, m]);
    });
    if (L === 'en'){ if (d.fives(1) !== '1 five' || d.fives(8) !== '8 fives') fail('fives(): singular/plural'); if (!/1 five →/.test(d.gLongWrong(1, 20))) fail('en: "1 fives"'); }
    D.GAME_LONG.forEach(e => {
      const n = e.m / 5, nx = nextOwn(e.h);
      seq('gLongDone ' + L + ' ' + e.h + ':' + e.m, d.gLongDone(e.h, e.m, n), L === 'zh' ? [n, n, 5, n, 5, e.m, e.h, nx] : [n, n, n, 5, e.m, e.h, nx]);
      if (n * 5 !== e.m) fail('gLongDone: ' + n + ' × 5 is not ' + e.m);
      seq('gLong2 ' + L, d.gLong2(e.m, n), L === 'zh' ? [e.m, n, 5, n] : [e.m, n, n]);
      if (d.gLongTask(e.h, e.m).indexOf(timeOwn(L, e.h, e.m)) < 0) fail('gLongTask ' + L + ': does not say ' + timeOwn(L, e.h, e.m));
      const lapNow = timeOwn(L, plusHours(e.h, 1), e.m), backNow = timeOwn(L, plusHours(e.h, -1), e.m);
      const lap = d.gLongLap(1, lapNow, n), back = d.gLongBack(backNow, n);
      if (lap.indexOf(lapNow) < 0 || nums(lap).indexOf(60) < 0 || nums(lap).indexOf(n) < 0) fail('gLongLap ' + L + ': ' + lap);
      if (back.indexOf(backNow) < 0 || nums(back).indexOf(n) < 0) fail('gLongBack ' + L + ': ' + back);
      has('gLongLap ' + L, lap, L === 'zh' ? /1 小時/ : /1 hour/);
      /* 轉過 12 一次、兩次：句子裡的圈數、單複數、現在的時刻、要撥到的數字都自己驗（codex 第二輪：只和頁面自己的函式比） */
      [1, 2].forEach(q => {
        const nowQ = timeOwn(L, plusHours(e.h, q), e.m), t = d.gLongLap(q, nowQ, n);
        const lapWord = L === 'zh' ? '走滿 ' + q + ' 圈' : (q === 1 ? '1 whole lap)' : q + ' whole laps)');
        if (t.indexOf(lapWord) < 0 || t.indexOf(nowQ) < 0 || nums(t.replace(nowQ, '')).join() !== (L === 'zh' ? [12, q, 60, 1, 12, n] : [12, q, 60, 1, 12, n]).join())
          fail('gLongLap ' + L + ' q=' + q + ': ' + t);
      });
      has('gLongBack ' + L, back, L === 'zh' ? /倒著/ : /backwards/);
    });
    D.GAME_READ.forEach(e => {
      const n = e.m / 5, nx = nextOwn(e.h), w = 'read ' + L + ' ' + e.h + ':' + e.m;
      seq(w + ' gReadNext', d.gReadNext(e.h, nx), [e.h, nx, nx, e.h]);
      seq(w + ' gReadHourHand', d.gReadHourHand(e.h, nx), [e.h, nx, e.h]);
      seq(w + ' gReadNum', d.gReadNum(n, e.m), L === 'zh' ? [n, n, 5, e.m, n] : [n, n, e.m, n]);
      seq(w + ' gReadMinHand', d.gReadMinHand(n, e.m), [n, e.m]);
      seq(w + ' gRead2H', d.gRead2H(e.h, nx), [e.h, nx, nx]);
      seq(w + ' gRead2M', d.gRead2M(n), L === 'zh' ? [n, n, 5] : [n, n]);
      seq(w + ' gReadDone', d.gReadDone(e.h, nx, n, e.m), [nx, e.h, n, e.m, e.h, e.m]);
      if (d.gReadDone(e.h, nx, n, e.m).indexOf(timeOwn(L, e.h, e.m)) < 0) fail(w + ' gReadDone does not say ' + timeOwn(L, e.h, e.m));
      seq(w + ' gReadNow', d.gReadNow(e.h, e.m), [e.h, e.m]);
      has(w + ' gReadHourHand', d.gReadHourHand(e.h, nx), L === 'zh' ? /短針/ : /short hand/);
      has(w + ' gReadMinHand', d.gReadMinHand(n, e.m), L === 'zh' ? /長針/ : /long hand/);
    });
    if (!/^\?/.test(d.gReadNow(null, null)) || nums(d.gReadNow(null, null)).length) fail('gReadNow ' + L + ' (empty) gives a number away');
    /* 提醒句要真的告訴孩子按哪兩顆（codex 第一輪：只和頁面自己的字比，空字串也會過） */
    if (!(typeof d.gHopStay === 'string' && d.gHopStay.indexOf(d.gHop1) >= 0 && d.gHop1 && d.gHopStay.indexOf(d.gHop7) >= 0 && /\+1/.test(d.gHop1) && /\+7/.test(d.gHop7))) fail('gHopStay ' + L + ' does not name the +1 / +7 buttons: ' + d.gHopStay);
    D.GAME_DAY.forEach((set, i) => {
      set.forEach(v => set.forEach(c => {
        if (v === c) return;
        const later = dayKey(v) > dayKey(c), t = later ? d.gDayLater(v, c) : d.gDayEarlier(v, c);
        const want = L === 'zh' ? [v.h, c.h] : [v.h, 0, c.h, 0];
        seq('day[' + i + '] ' + L + ' ' + JSON.stringify(v) + ' vs ' + JSON.stringify(c), t, want);
        has('day ' + L, t, later ? (L === 'zh' ? /晚.*比較早的/ : /later than.*earlier one/) : (L === 'zh' ? /早.*比較晚的/ : /earlier than.*later one/));
        const ampm = L === 'zh' ? v.half !== c.half : (v.half === 'am') !== (c.half === 'am');
        if (ampm !== (t.indexOf(d.gDayOrder) >= 0)) fail('day ' + L + ': the a.m./p.m. reason ' + (ampm ? 'is missing' : 'appears for the same part of the day') + ': ' + t);
        if (t.indexOf(d.dayText(v)) < 0 || t.indexOf(d.dayText(c)) < 0) fail('day ' + L + ': the reason does not name both times: ' + t);
      }));
      set.forEach(v => {
        const own = L === 'zh' ? { am:'上午', pm:'下午', night:'晚上' }[v.half] + ' ' + v.h + ' 點' : v.h + ':00 ' + (v.half === 'am' ? 'a.m.' : 'p.m.');
        if (d.dayText(v) !== own) fail('dayText ' + L + ': ' + d.dayText(v) + ', should be ' + own);
        if (d.dayCard(v).replace(/\n/g, ' ').indexOf(L === 'zh' ? own.split(' ')[0] : own.split(' ')[1]) < 0 || nums(d.dayCard(v)).indexOf(v.h) < 0) fail('dayCard ' + L + ': ' + d.dayCard(v));
      });
      const ord = set.slice().sort((a, b) => dayKey(a) - dayKey(b));
      for (let k = 0; k < 4; k++) if (d.gDay2(k, ord[k]).indexOf(d.dayText(ord[k])) < 0 || nums(d.gDay2(k, ord[k]))[0] !== k + 1) fail('gDay2 ' + L + ': ' + d.gDay2(k, ord[k]));
      if (d.gDayDone(ord).split(' → ').length !== 4) fail('gDayDone ' + L + ': ' + d.gDayDone(ord));
    });
    D.GAME_FILL.forEach(e => {
      e.holes.forEach(x => e.holes.forEach(y => { if (x !== y) seq('gFillWrong ' + L + ' ' + x + '/' + y, d.gFillWrong(x, y), [x - 7, 7, x - 7, 7, x, y]); }));
      e.holes.forEach(x => seq('gFill2 ' + L + ' ' + x, d.gFill2(x), L === 'zh' ? [x - 7, x - 7, 7] : [x - 7, x - 7, 7]));
      seq('gFillDone ' + L, d.gFillDone(e.holes), [].concat.apply([], e.holes.map(x => [x - 7, 7, x])).concat(L === 'zh' ? [7] : [7]));
      const title = d.calTitle(Y, e.mo);
      if (L === 'zh' ? title !== Y + ' 年 ' + e.mo + ' 月' : title !== ['January','February','March','April','May','June','July','August','September','October','November','December'][e.mo - 1] + ' ' + Y) fail('calTitle ' + L + ': ' + title);
    });
    for (let k = 0; k <= 3; k++) seq('gFillNow ' + L, d.gFillNow(k), [k, 3]);
    D.GAME_HOP.forEach(e => {
      const T = e.s + e.n, len = dimOwn(Y, e.mo), w = 'hop ' + L + ' ' + e.mo + '/' + e.s + '+' + e.n, wd = (L === 'zh' ? WDZ : WD_EN)[dowOwn(Y, e.mo, T)];
      const k = Math.floor(e.n / 7), j = e.n % 7;
      const task = d.gHopTask(e.mo, e.s, e.n).replace(/<br>/g, ' ');
      seq(w + ' gHopTask', task, L === 'zh' ? (j ? [e.mo, e.s, e.n] : [e.mo, e.s, k]) : (j ? [e.s, e.n] : [e.s, k]));
      if (L === 'en' && task.indexOf(MON_EN[e.mo - 1]) < 0) fail(w + ': the task does not name the month');
      if (L === 'en' && !/(\d+ weeks?|\d+ days) later/.test(task)) fail(w + ': ' + task);
      if (L === 'en' && /1 weeks/.test(task)) fail(w + ': "1 weeks"');
      for (let x = e.s + 1; x <= len; x++) if (x !== T) seq(w + ' gHopWrong ' + x, d.gHopWrong(e.s, x, e.n), [e.s, x, x - e.s, e.n].concat(j ? [] : [k]));
      if (L === 'en' && !/is 1 day;/.test(d.gHopWrong(e.s, e.s + 1, e.n))) fail(w + ': gHopWrong singular');
      if (L === 'zh') seq(w + ' gHop2', d.gHop2(e.n), j ? [e.n, k, j, k, 7, j, 1] : [e.n, k, k, 7]);
      const done = d.gHopDone(e.mo, e.s, e.n, T, wd);
      seq(w + ' gHopDone', done, L === 'zh' ? [e.s, e.n, T, e.mo, T].concat(j ? [] : [e.n, k, e.s]) : [e.s, e.n, T, T].concat(j ? [] : [e.n, k, e.s]));
      if (done.indexOf(wd) < 0) fail(w + ': the message does not name ' + wd);
      if (!j && dowOwn(Y, e.mo, e.s) !== dowOwn(Y, e.mo, T)) fail(w + ': says "same weekday" but ' + e.s + ' and ' + T + ' are not');
      seq(w + ' gHopEnd', d.gHopEnd(len), [len]);
      seq(w + ' gHopNow', d.gHopNow(e.mo, T), L === 'zh' ? [e.mo, T] : [T]);
    });
  });
  /* 英文 gHop2 的數字順序和中文不一樣（「press +7 days twice」），只驗「拆得對」：k 個星期又 j 天 */
  D.GAME_HOP.forEach(e => {
    const k = Math.floor(e.n / 7), j = e.n % 7, t = I18N.en.gHop2(e.n);
    const want = new RegExp('^' + e.n + ' days = ' + (k === 1 ? '1 week' : k + ' weeks') + (j ? ' and ' + (j === 1 ? '1 day' : j + ' days') + ': press “\\+7 days” ' + (k === 1 ? 'once' : k + ' times') + ', then “\\+1 day” ' + (j === 1 ? 'once' : j + ' times') + '\\.$' : ': press “\\+7 days” ' + (k === 1 ? 'once' : k + ' times') + '\\.$'));
    if (!want.test(t)) fail('gHop2 en ' + e.n + ': ' + t);
  });

  /* ================= 每一關的 RENDER 函式本體「真的跑」 ================= */
  const EXEC = (() => {
    const fns = ['target', 'nearestOpen', 'renderTray', 'shuffle', 'drawCal'].map(n => {
      const f = extractFunction(src, n); if (!f) fail('exec: cannot cut ' + n + '() out of index.html'); return f || '';
    }).join('\n');
    const decl = Object.keys(D).map(k => 'var ' + k + ' = D.' + k + ';').join('\n');
    const stub = `
      var LOG = { miss:[], solved:[], info:[], zones:[], pieces:[], created:[], board:null, B:null, line:null, drop:null, btns:null };
      function el(){ var o = { style:{}, textContent:'', innerHTML:'', className:'', children:[], disabled:false, cls:{},
        classList:{ add:function(c){ o.cls[c] = true; }, remove:function(c){ delete o.cls[c]; }, contains:function(c){ return !!o.cls[c]; } },
        appendChild:function(x){ o.children.push(x); return x; }, setAttribute:function(){}, remove:function(){ o.removed = true; },
        addEventListener:function(t, f){ o['on' + t] = f; } }; return o; }
      var document = { createElement:function(tag){ var e = el(); e.tag = tag; LOG.created.push(e); return e; } };
      var gameStage = el(), gSolved = false, gCtx = {}, gMistakes = 0;
      var gMsg = el();
      function pick(arr){ return arr[PICK]; }
      function makeBoard(W, H){ LOG.board = { W:W, H:H }; LOG.B = { el:el(), W:W, k:1, selected:null }; return LOG.B; }
      function addZone(B, x, y, w, h, cls, text){ var z = el(); z.x = x; z.y = y; z.w = w; z.h = h; z.className = cls; if (text !== undefined) z.textContent = text; LOG.zones.push(z); return z; }
      function trailLine(text){ LOG.line = el(); LOG.line.textContent = text; return LOG.line; }
      function addPiece(B, o){ var P = { el:el(), w:o.w, h:o.h, homeX:o.cx, homeY:o.cy, cx:o.cx, cy:o.cy, locked:false, data:o.data || {}, text:o.text, cls:o.cls };
        P.place = function(x, y){ P.cx = x; P.cy = y; }; P.home = function(){ P.place(P.homeX, P.homeY); }; P.lock = function(x, y){ P.locked = true; P.place(x, y); };
        P.busy = function(){ return false; }; LOG.pieces.push(P); return P; }
      function useTapSelect(B, fn){ LOG.drop = fn; }
      function roundMiss(t){ gMistakes++; LOG.miss.push(t); }
      function roundSolved(t){ if (gSolved) return; gSolved = true; LOG.solved.push(t); }
      function roundInfo(t){ LOG.info.push(t); }
      function refreshHint(){}
      function actionButtons(list){ LOG.btns = list.map(function(it){ var b = el(); b.textContent = it[0]; b.f = it[1]; return b; }); return LOG.btns; }
    `;
    return (type, pickIdx, d) => {
      const code = decl + '\nvar PICK = ' + pickIdx + ';\n' + stub + fns + '\n(function(d){' + B[type] + '\n})(d);\nreturn { LOG:LOG, solved:function(){ return gSolved; }, misses:function(){ return gMistakes; }, msg:function(){ return gMsg.textContent; }, hint2:function(){ return gCtx.hint2 ? gCtx.hint2() : null; } };';
      try { return new Function('D', 'd', code)(D, d); }
      catch (e){ fail('exec: RENDER.' + type + ' could not run in the stub DOM: ' + e.message); return null; }
    };
  })();
  [['long', 'LONG_H'], ['read', 'READ_H'], ['day', 'DAY_H'], ['fill', 'FILL_H'], ['hop', 'HOP_H']].forEach(([t, h]) => {
    const r = EXEC(t, 0, I18N.zh);
    if (r && !(r.LOG.board && r.LOG.board.W === W && r.LOG.board.H === D[h])) fail('exec: RENDER.' + t + ' opens a board of ' + JSON.stringify(r.LOG.board) + ', should be ' + W + ' × ' + h);
  });

  /* --- 第 1 關（跑起來）：拖圈圈轉 sweep 度（每 10° 一步，倒著是負的），放開 —— 看收不收、說哪一句、畫出來的指針在哪 --- */
  D.GAME_LONG.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], Dl = D.LONG_DIAL, R = D.dialR(Dl.size), rr = R * Dl.ring, n = e.m / 5, w = 'exec long[' + i + '] ' + L;
    const face = r => r.LOG.zones.filter(z => z.className === 'gface')[0];
    const turn = (r, sweep, endR) => {
      const P = r.LOG.pieces[0], Bd = r.LOG.B, steps = Math.max(2, Math.ceil(Math.abs(sweep) / 10));
      if (Bd.onGrab) Bd.onGrab(P);
      for (let s = 1; s <= steps; s++){ const p = polarOwn(Dl.cx, Dl.cy, sweep * s / steps, rr); P.place(p.x, p.y); if (Bd.onMove) Bd.onMove(P); }
      if (endR !== undefined){ const p = polarOwn(Dl.cx, Dl.cy, sweep, endR); P.place(p.x, p.y); if (Bd.onMove) Bd.onMove(P); }
      const got = r.LOG.drop(P, { x:P.cx, y:P.cy });
      if (!got){ P.home(); if (Bd.onHome) Bd.onHome(P); }
      return got;
    };
    let r = EXEC('long', i, d); if (!r) return;
    const P0 = r.LOG.pieces[0], f0 = face(r);
    if (!P0 || P0.w !== D.GPICK || !near(P0.cx, Dl.cx) || !near(P0.cy, Dl.cy - rr)) return fail(w + ': the ring is not on the long hand at 12');
    if (!f0) return fail(w + ': no dial');
    { const a = hands(f0.innerHTML); if (!(angDiff(a.mh, 0) < 0.05 && angDiff(a.hh, (e.h % 12) * 30) < 0.05)) fail(w + ': the clock does not start at ' + e.h + ' o’clock'); }
    if (r.LOG.line.textContent !== d.gLongTask(e.h, e.m)) fail(w + ': the line should show the task');
    if (r.hint2() !== d.gLong2(e.m, n)) fail(w + ': the second hint is not gLong2(' + e.m + ', ' + n + ')');
    /* 往前轉到每一個數字 k（1～12）＋多轉一圈＋倒著轉：每一種各開一局 */
    const cases = [];
    for (let a = -750; a <= 750; a += 30) cases.push(a);
    cases.push(8, -8, 0, 5, -5, 25, 35, 365, -355);
    cases.forEach(sweep => {
      const q = EXEC('long', i, d); if (!q) return;
      const S = 5 * Math.round(sweep / 6 / 5), r60 = ((S % 60) + 60) % 60;
      const got = !!turn(q, sweep);
      let want;
      /* 自己的規則：S ＝ 0 等於沒撥；S ＝ m 收；倒著轉（S < 0）→ 時間往回走；轉過 12（S ≥ 60）→ 多了幾個小時；其他 → 指錯數字。
         「現在幾點」自己算：長針走過 12 幾次（往下取整）就加幾個小時（codex 第一輪：方向和圈數要先講） */
      const laps = Math.floor(S / 60), now = timeOwn(L, plusHours(e.h, laps), r60);
      if (S === 0) want = { ok:false, said:'' };
      else if (S === e.m) want = { ok:true, said:'' };
      else if (S < 0) want = { ok:false, said:d.gLongBack(now, n) };
      else if (S >= 60) want = { ok:false, said:d.gLongLap(laps, now, n) };
      else want = { ok:false, said:d.gLongWrong(r60 / 5, e.m) };
      const said = q.LOG.miss.join('|');
      if (got !== want.ok || said !== want.said) fail(w + ': a turn of ' + sweep + '° (' + S + ' min) → ' + (got ? 'set' : 'bounced') + ' "' + said + '", expected ' + (want.ok ? 'set' : 'bounced') + ' "' + want.said + '"');
      const a = hands(face(q).innerHTML), P = q.LOG.pieces[0];
      if (got){
        if (!(P.locked && angDiff(a.mh, e.m * 6) < 0.05 && angDiff(a.hh, ((e.h % 12) + e.m / 60) * 30) < 0.05)) fail(w + ': set, but the hands read ' + a.mh.toFixed(1) + '° / ' + a.hh.toFixed(1) + '°');
        const at = polarOwn(Dl.cx, Dl.cy, e.m * 6, rr); if (!near(P.cx, at.x, 1e-6) || !near(P.cy, at.y, 1e-6)) fail(w + ': the ring is not locked on the long hand');
        if (q.LOG.solved.join() !== d.gLongDone(e.h, e.m, n) || q.LOG.line.textContent !== d.gLongNow(e.h, e.m)) fail(w + ': solved / line text wrong');
      } else {
        if (P.locked || q.solved()) fail(w + ': bounced but locked / solved');
        if (!(angDiff(a.mh, 0) < 0.05 && angDiff(a.hh, (e.h % 12) * 30) < 0.05)) fail(w + ': after a bounce (' + sweep + '°) the clock is not back at ' + e.h + ' o’clock');
      }
    });
    /* 拖到一半：短針跟著長針走（齒輪） */
    {
      const q = EXEC('long', i, d), P = q.LOG.pieces[0], Bd = q.LOG.B;
      Bd.onGrab(P);
      for (let s = 1; s <= 9; s++){ const p = polarOwn(Dl.cx, Dl.cy, s * 10, rr); P.place(p.x, p.y); Bd.onMove(P); }
      const a = hands(face(q).innerHTML);
      if (!(angDiff(a.mh, 90) < 0.05 && angDiff(a.hh, ((e.h % 12) + 15 / 60) * 30) < 0.05)) fail(w + ': while dragging to 90°, the hands read ' + a.mh.toFixed(1) + '° / ' + a.hh.toFixed(1) + '° (should be 90° / short hand 1/4 of the way to the next number)');
      /* 經過圓心不算轉：進到圓心附近、再從對面出來，指針不動；出來之後從出來的角度接著算（codex 第一輪） */
      const c = { x:Dl.cx - 2, y:Dl.cy + 1 }; P.place(c.x, c.y); Bd.onMove(P);
      if (!(angDiff(hands(face(q).innerHTML).mh, 90) < 0.05)) fail(w + ': a move through the centre turned the hand');
      const out = polarOwn(Dl.cx, Dl.cy, 270, rr); P.place(out.x, out.y); Bd.onMove(P);
      if (!(angDiff(hands(face(q).innerHTML).mh, 90) < 0.05)) fail(w + ': coming out of the centre on the other side turned the hand');
      const on = polarOwn(Dl.cx, Dl.cy, 280, rr); P.place(on.x, on.y); Bd.onMove(P);
      if (!(angDiff(hands(face(q).innerHTML).mh, 100) < 0.05)) fail(w + ': after the centre the turn does not continue from the exit angle');
    }
    /* 從 12 直直拖過圓心到 n 的對面再放開：沒有轉，靜靜放回去（不可以替 30 分那種題目過關） */
    {
      const q = EXEC('long', i, d), P = q.LOG.pieces[0], Bd = q.LOG.B, far = (e.m * 6 + 0) % 360;
      Bd.onGrab(P);
      [[0, rr * 0.6], [0, rr * 0.2], [far, rr * 0.2], [far, rr * 0.6], [far, rr]].forEach(([a, rad]) => { const p = polarOwn(Dl.cx, Dl.cy, a, rad); P.place(p.x, p.y); Bd.onMove(P); });
      const got = q.LOG.drop(P, { x:P.cx, y:P.cy });
      if (got || q.LOG.miss.length) fail(w + ': a straight drag through the centre to ' + n + ' is ' + (got ? 'accepted' : 'counted as a mistake') + ' — it never turned');
    }
    /* 放在圓心、鐘面外：靜靜放回去 */
    [R * 0.1, R * 1.3].forEach(endR => { const q = EXEC('long', i, d); if (turn(q, n * 30, endR) || q.LOG.miss.length) fail(w + ': a drop ' + (endR < R ? 'on the centre' : 'outside the clock') + ' is not silent'); });
    /* 先點、再點：點數字 k ＝ 從 12 往前撥到 k */
    for (let k = 1; k <= 12; k++){
      const q = EXEC('long', i, d), p = polarOwn(Dl.cx, Dl.cy, k * 30, R * 0.79);
      const got = q.LOG.drop(q.LOG.pieces[0], { x:p.x, y:p.y, tap:true }), want = k * 5 === e.m;
      if (!!got !== want) fail(w + ': tap on ' + k + ' → ' + (got ? 'set' : 'bounced'));
      if (k === 12 && q.LOG.miss.length) fail(w + ': a tap on 12 (no turn) is not silent');
      if (!want && k !== 12 && q.LOG.miss.join() !== d.gLongWrong(k, e.m)) fail(w + ': tap on ' + k + ' says ' + q.LOG.miss.join());
    }
    { const q = EXEC('long', i, d); if (q.LOG.drop(q.LOG.pieces[0], { x:Dl.cx, y:Dl.cy, tap:true }) || q.LOG.miss.length) fail(w + ': a tap on the centre is not silent'); }
  }));

  /* --- 第 2 關（跑起來）：每一張卡 × 每一格（各開一局），再照順序放好 --- */
  D.GAME_READ.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], S = D.READ_SLOT, n = e.m / 5, nx = nextOwn(e.h), w = 'exec read[' + i + '] ' + L;
    const r = EXEC('read', i, d); if (!r) return;
    const a = hands(r.LOG.zones.filter(z => z.className === 'gface')[0].innerHTML);
    if (!(angDiff(a.mh, e.m * 6) < 0.05 && angDiff(a.hh, ((e.h % 12) + e.m / 60) * 30) < 0.05)) fail(w + ': the clock does not show ' + e.h + ':' + e.m);
    /* 畫出來的短針確實還沒到 nx（在 h 和 nx 中間），而且比到 h 更靠近 nx —— 這一題的陷阱是真的 */
    if (!(a.hh > (e.h % 12) * 30 && a.hh < (e.h % 12) * 30 + 30 && (e.h % 12) * 30 + 30 - a.hh < a.hh - (e.h % 12) * 30)) fail(w + ': the short hand is not between ' + e.h + ' and ' + nx + ', nearer ' + nx);
    const vals = r.LOG.pieces.map(P => P.data.v);
    if (vals.slice().sort((x, y) => x - y).join() !== [e.h, nx, n, e.m].sort((x, y) => x - y).join()) fail(w + ': the cards are ' + vals.join(','));
    r.LOG.pieces.forEach(P => { if (P.text !== String(P.data.v)) fail(w + ': a card reads ' + P.text); });
    if (r.LOG.line.textContent !== d.gReadNow(null, null)) fail(w + ': the line gives the answer away');
    [0, 1].forEach(k => [e.h, nx, n, e.m].forEach(v => {
      const q = EXEC('read', i, d), P = q.LOG.pieces.filter(x => x.data.v === v)[0];
      const got = q.LOG.drop(P, { x:S.x[k], y:S.y }), right = k === 0 ? v === e.h : v === e.m;
      const why = k === 0 ? (v === nx ? d.gReadNext(e.h, nx) : d.gReadHourHand(e.h, nx)) : (v === n ? d.gReadNum(n, e.m) : d.gReadMinHand(n, e.m));
      if (right){ if (got !== true || !P.locked || q.LOG.miss.length || q.solved()) fail(w + ': ' + v + ' is refused in box ' + k); }
      else if (got !== false || P.locked || q.LOG.miss.join() !== why) fail(w + ': ' + v + ' in box ' + k + ' → ' + q.LOG.miss.join() + ' (expected ' + why + ')');
    }));
    const P = v => r.LOG.pieces.filter(x => x.data.v === v)[0];
    if (r.LOG.drop(P(e.h), { x:S.x[0], y:S.y + S.h / 2 + D.GPAD + 2 }) !== false || r.LOG.miss.length) fail(w + ': a drop below the hour box is not silent');
    if (r.hint2() !== d.gRead2H(e.h, nx)) fail(w + ': before the hour, the second hint should be about the short hand');
    r.LOG.drop(P(e.h), { x:S.x[0], y:S.y, tap:true });
    if (r.hint2() !== d.gRead2M(n)) fail(w + ': after the hour, the second hint should move on to the long hand');
    if (r.solved() || r.LOG.line.textContent !== d.gReadNow(e.h, null)) fail(w + ': after the hour the line reads ' + r.LOG.line.textContent);
    if (r.LOG.drop(P(e.m), { x:S.x[0], y:S.y }) !== false || r.LOG.miss.length) fail(w + ': a drop on the filled hour box is not silent');
    r.LOG.drop(P(e.m), { x:S.x[1], y:S.y });
    if (!r.solved() || r.LOG.solved.join() !== d.gReadDone(e.h, nx, n, e.m) || r.LOG.line.textContent !== d.gReadNow(e.h, e.m)) fail(w + ': not solved with gReadDone');
  }));

  /* --- 第 3 關（跑起來）：每一張卡 × 每一格（各開一局），再照順序排好 --- */
  D.GAME_DAY.forEach((set, i) => LANGS.forEach(L => {
    const d = I18N[L], S = D.DAY_SLOT, w = 'exec day[' + i + '] ' + L, ord = set.slice().sort((a, b) => dayKey(a) - dayKey(b));
    const r = EXEC('day', i, d); if (!r) return;
    const cards = r.LOG.pieces;
    if (cards.length !== 4 || cards.map(P => dayKey(P.data.v)).sort((a, b) => a - b).join() !== ord.map(dayKey).join()) return fail(w + ': the tray does not hold the four times');
    cards.forEach(P => { if (P.text !== d.dayCard(P.data.v)) fail(w + ': a card reads ' + JSON.stringify(P.text)); });
    const tray = cards.slice().sort((a, b) => a.homeX - b.homeX).map(P => dayKey(P.data.v));
    if (tray.every((v, j) => j === 0 || tray[j - 1] < v)) fail(w + ': the tray starts already in order');
    ord.forEach((want, k) => set.forEach(v => {
      const q = EXEC('day', i, d), Pc = q.LOG.pieces.filter(x => x.data.v === v)[0];
      const got = q.LOG.drop(Pc, { x:S.x[k], y:S.y });
      if (v === want){ if (got !== true || !Pc.locked || q.LOG.miss.length) fail(w + ': ' + d.dayText(v) + ' is refused in box ' + (k + 1)); }
      else { const why = dayKey(v) > dayKey(want) ? d.gDayLater(v, want) : d.gDayEarlier(v, want); if (got !== false || Pc.locked || q.LOG.miss.join() !== why) fail(w + ': ' + d.dayText(v) + ' in box ' + (k + 1) + ' is not refused with the right reason'); }
    }));
    S.x.forEach((x, k) => {
      const right = cards.filter(P => P.data.v === ord[k])[0];
      if (r.hint2() !== d.gDay2(k, ord[k])) fail(w + ': before box ' + (k + 1) + ' the second hint is ' + r.hint2());
      if (r.LOG.drop(right, { x, y:S.y }) !== true) fail(w + ': ' + d.dayText(ord[k]) + ' is refused in box ' + (k + 1));
      if (k < 3 && r.solved()) fail(w + ': solved after ' + (k + 1) + ' boxes');
      const other = cards.filter(P => !P.locked)[0];
      if (other){ const m1 = r.LOG.miss.length; if (r.LOG.drop(other, { x, y:S.y }) !== false || r.LOG.miss.length !== m1) fail(w + ': a drop on the filled box ' + (k + 1) + ' is not silent'); }
    });
    if (!r.solved() || r.LOG.solved.join() !== d.gDayDone(ord)) fail(w + ': not solved with gDayDone');
    if (r.LOG.line.textContent !== ord.map(v => d.dayText(v)).join(d.gDaySep)) fail(w + ': the line says ' + r.LOG.line.textContent);
  }));

  /* --- 第 4 關（跑起來）：日曆畫得對；每一張卡 × 每一個空格；放在寫好的格子上靜靜彈回 --- */
  D.GAME_FILL.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], G = D.CAL_GRID, w = 'exec fill[' + i + '] ' + L, first = dowOwn(Y, e.mo, 1), len = dimOwn(Y, e.mo);
    const r = EXEC('fill', i, d); if (!r) return;
    const dates = r.LOG.zones.filter(z => /^gdate/.test(z.className)), heads = r.LOG.zones.filter(z => z.className === 'gwd');
    if (heads.map(z => z.textContent).join() !== d.wdShort.join() || heads.some((z, c) => z.x !== G.x0 + c * G.cw)) fail(w + ': the weekday row is not Sun..Sat left to right');
    if (dates.length !== len) fail(w + ': ' + dates.length + ' day boxes, the month has ' + len);
    dates.forEach((z, j) => {
      const day = j + 1, col = dowOwn(Y, e.mo, day), row = Math.floor((first + day - 1) / 7);
      if (z.x !== G.x0 + col * G.cw || z.y !== D.FILL_Y0 + G.head + row * G.ch) fail(w + ': ' + day + ' is not under ' + WDZ[col]);
      const hole = e.holes.indexOf(day) >= 0;
      if (hole ? (z.textContent !== '' || z.className !== 'gdate hole') : (z.textContent !== String(day) || z.className !== 'gdate')) fail(w + ': box ' + day + ' is ' + JSON.stringify(z.textContent) + ' / ' + z.className);
    });
    const title = r.LOG.zones.filter(z => /gorder/.test(z.className))[0];
    if (!title || title.textContent !== d.calTitle(Y, e.mo)) fail(w + ': the calendar has no month title');
    if (r.LOG.pieces.map(P => P.data.v).sort((a, b) => a - b).join() !== e.holes.slice().sort((a, b) => a - b).join()) fail(w + ': the cards are not the missing dates');
    e.holes.forEach(x => e.holes.forEach(v => {
      const q = EXEC('fill', i, d), Pc = q.LOG.pieces.filter(P => P.data.v === v)[0], c = D.calCellXY(G, D.FILL_Y0, first, x);
      const got = q.LOG.drop(Pc, { x:c.x, y:c.y });
      if (v === x){ if (got !== true || !Pc.locked || q.LOG.miss.length) fail(w + ': ' + v + ' is refused in its own box'); }
      else if (got !== false || Pc.locked || q.LOG.miss.join() !== d.gFillWrong(x, v)) fail(w + ': ' + v + ' in the box of ' + x + ' → ' + q.LOG.miss.join());
    }));
    /* 放在每一個寫好日期的格子上：靜靜彈回 */
    { const q = EXEC('fill', i, d), Pc = q.LOG.pieces[0]; let bad = 0;
      for (let day = 1; day <= len; day++) if (e.holes.indexOf(day) < 0){ const c = D.calCellXY(G, D.FILL_Y0, first, day); if (q.LOG.drop(Pc, { x:c.x, y:c.y }) !== false) bad++; }
      if (bad || q.LOG.miss.length) fail(w + ': drops on filled boxes are taken (' + bad + ') or counted as mistakes (' + q.LOG.miss.length + ')'); }
    e.holes.slice().sort((a, b) => b - a).forEach((x, k, arr) => {
      const left = arr.slice(k).sort((a, b) => a - b)[0];
      if (r.hint2() !== d.gFill2(left)) fail(w + ': with ' + arr.slice(k).join(',') + ' still empty the second hint is ' + r.hint2() + ' (should point at the first empty box, ' + left + ')');
      const Pc = r.LOG.pieces.filter(P => P.data.v === x)[0], c = D.calCellXY(G, D.FILL_Y0, first, x);
      if (r.LOG.drop(Pc, { x:c.x, y:c.y, tap:k === 1 }) !== true) fail(w + ': ' + x + ' refused');
      const z = dates[x - 1];
      if (z.className !== 'gdate filled' || z.textContent !== String(x)) fail(w + ': after placing ' + x + ' its box shows ' + JSON.stringify(z.textContent));
      if (r.LOG.line.textContent !== d.gFillNow(k + 1)) fail(w + ': line ' + r.LOG.line.textContent);
      if (k < 2 && r.solved()) fail(w + ': solved early');
    });
    if (!r.solved() || r.LOG.solved.join() !== d.gFillDone(e.holes)) fail(w + ': not solved with gFillDone');
  }));

  /* --- 第 5 關（跑起來）：走到每一個 x（s ～ 月底）按「就是這一天」；+7 走過月底；回到今天 --- */
  D.GAME_HOP.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], G = D.CAL_GRID, w = 'exec hop[' + i + '] ' + L, first = dowOwn(Y, e.mo, 1), len = dimOwn(Y, e.mo), T = e.s + e.n;
    const wd = (L === 'zh' ? WDZ : WD_EN)[dowOwn(Y, e.mo, T)];
    const ringDay = q => { const z = q.LOG.zones.filter(x => /^ghop/.test(x.className))[0]; for (let day = 1; day <= len; day++){ const c = D.calCellXY(G, D.HOP_Y0, first, day); if (near(parseFloat(z.style.left) + (G.cw - 4) / 2, c.x) && near(parseFloat(z.style.top) + (G.ch - 2) / 2, c.y)) return day; } return null; };
    const r0 = EXEC('hop', i, d); if (!r0) return;
    if (!r0.LOG.btns || r0.LOG.btns.length !== 4) return fail(w + ': not four buttons');
    if (r0.LOG.btns.map(b => b.textContent).join('|') !== [d.gHop1, d.gHop7, d.gHopBack, d.gHopGo].join('|')) fail(w + ': buttons ' + r0.LOG.btns.map(b => b.textContent).join('|'));
    const today = r0.LOG.zones.filter(z => /^gdate/.test(z.className))[e.s - 1];
    if (!today || today.className !== 'gdate today' || ringDay(r0) !== e.s) fail(w + ': today / the ring is not on ' + e.s);
    const task = r0.LOG.zones.filter(z => /gorder/.test(z.className))[0];
    if (!task || task.innerHTML !== d.gHopTask(e.mo, e.s, e.n)) fail(w + ': the task is not shown');
    if (r0.hint2() !== d.gHop2(e.n)) fail(w + ': the second hint is not gHop2(' + e.n + ')');
    r0.LOG.btns[3].f();
    if (r0.LOG.miss.length || r0.solved() || r0.msg() !== d.gHopStay) fail(w + ': "this is the day" on today should only remind');
    for (let x = e.s + 1; x <= len; x++){
      const q = EXEC('hop', i, d), b = q.LOG.btns;
      let g = 0; while (ringDay(q) + 7 <= x && g++ < 10) b[1].f();
      g = 0; while (ringDay(q) < x && g++ < 10) b[0].f();
      if (ringDay(q) !== x) { fail(w + ': could not walk to ' + x); continue; }
      if (q.LOG.line.textContent !== d.gHopNow(e.mo, x)) fail(w + ': line at ' + x + ': ' + q.LOG.line.textContent);
      b[3].f();
      if (x === T){ if (!q.solved() || q.LOG.miss.length || q.LOG.solved.join() !== d.gHopDone(e.mo, e.s, e.n, T, wd) || !b.every(z => z.disabled)) fail(w + ': stopping on ' + T + ' does not solve'); }
      else if (q.solved() || q.LOG.miss.join() !== d.gHopWrong(e.s, x, e.n)) fail(w + ': stopping on ' + x + ' → ' + q.LOG.miss.join());
    }
    /* +7 是往下一排、同一欄；走過月底不動、只提醒 */
    { const q = EXEC('hop', i, d), b = q.LOG.btns; let g = 0;
      while (ringDay(q) + 7 <= len && g++ < 10){ const a0 = ringDay(q); b[1].f(); if (ringDay(q) !== a0 + 7) fail(w + ': +7 from ' + a0 + ' lands on ' + ringDay(q)); }
      const a1 = ringDay(q); b[1].f();
      if (ringDay(q) !== a1 || q.LOG.miss.length || q.msg() !== d.gHopEnd(len)) fail(w + ': +7 past the end of the month moved / was a mistake');
      g = 0; while (ringDay(q) < len && g++ < 10) b[0].f(); b[0].f();
      if (ringDay(q) !== len || q.LOG.miss.length || q.msg() !== d.gHopEnd(len)) fail(w + ': +1 past the end of the month');
      b[2].f(); if (ringDay(q) !== e.s || q.LOG.miss.length) fail(w + ': "back to today" does not go back to ' + e.s + ' silently'); }
  }));

  /* --- 每一關的狀態前進：讓這一關往前走的那一行（改掉就玩不完） --- */
  need('long', /P\.lock\(at\.x, at\.y\); P\.el\.classList\.add\('placed'\);\s*line\.textContent = d\.gLongNow\(e\.h, e\.m\);/, 'the line does not show the time after the hand is set');
  need('read', /line\.textContent = d\.gReadNow\(got\.h, got\.m\);/, 'the line does not show the reading so far');
  need('day', /line\.textContent = shown\(\);/, 'the line does not show the boxes filled so far');
}


module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/time
     每一筆都是「這條斷言真的會響嗎」的證據。改課程檔時如果 find 字串對不上，
     breaktest 會直接報 SETUP-FAIL —— 那也是要修的（斷言失去了保護對象）。 */
  breaks: [
    /* ---- 小遊戲「對時大挑戰」（2026-10-02 改版）：每一筆改壞一條規則，設定檔都要響 ---- */
    { file:'index', expect:"a turn of",
      find:"        if (S !== e.m){\n",
      replace:"        if (S !== e.m && false){\n" },
    { file:'index', expect:"a turn of",
      find:"          if (S < 0) roundMiss(d.gLongBack(now, n));",
      replace:"          if (S < -60) roundMiss(d.gLongBack(now, n));" },
    { file:'index', expect:"a turn of",
      find:"var S = pt.tap ? (dialNumber(Dl, pt) % 12) * 5 : snapMinutes(total);",
      replace:"var S = pt.tap ? (dialNumber(Dl, pt) % 12) * 5 : ((snapMinutes(total) % 60) + 60) % 60;" },
    { file:'index', expect:"a turn of",
      find:"          else if (q >= 1) roundMiss(d.gLongLap(q, now, n));",
      replace:"          else if (q >= 2) roundMiss(d.gLongLap(q, now, n));" },
    { file:'index', expect:"it must sit between the numbers",
      find:"var hp = polar(cx, cy, ((h % 12) + mins / 60) * 30, r * 0.48);",
      replace:"var hp = polar(cx, cy, (h % 12) * 30, r * 0.48);" },
    { file:'index', expect:"while dragging to 90",
      find:"total += angleStep(lastAng, a) / 6; lastAng = a;",
      replace:"total += angleStep(lastAng, a); lastAng = a;" },
    { file:'index', expect:"a tap on 12 (no turn) is not silent",
      find:"var S = pt.tap ? (dialNumber(Dl, pt) % 12) * 5",
      replace:"var S = pt.tap ? dialNumber(Dl, pt) * 5" },
    { file:'index', expect:"a move through the centre turned the hand",
      find:"        if (Math.hypot(P.cx - Dl.cx, P.cy - Dl.cy) < dialR(Dl.size) * Dl.inner){ lost = true; return; }\n",
      replace:"" },
    { file:'index', expect:"straight drag through the centre",
      find:"        if (lost){ lost = false; lastAng = a; return; }\n",
      replace:"" },
    { file:'index', expect:"a new drag does not tell the round",
      find:"      if (B.onGrab) B.onGrab(P);\n",
      replace:"" },
    { file:'index', expect:"the ring covers the numbers",
      find:"ring:0.50, inner:0.22",
      replace:"ring:0.56, inner:0.22" },
    { file:'index', expect:"too small to read",
      find:"fs = Math.round(r * 0.17);",
      replace:"fs = Math.round(r * 0.09);" },
    { file:'index', expect:"long hand is not clearly longer",
      find:"var mp = polar(cx, cy, mins * 6, r * 0.74);",
      replace:"var mp = polar(cx, cy, mins * 6, r * 0.5);" },
    { file:'index', expect:"has no 5- or 10-minute task",
      find:"{ h:8, m:10 }, { h:5, m:25 }, { h:10, m:35 }, { h:2, m:5 }",
      replace:"{ h:8, m:30 }, { h:5, m:25 }, { h:10, m:35 }, { h:2, m:45 }" },
    { file:'index', expect:"m must be 5~55",
      find:"{ h:9, m:20 } ];\n  var LONG_H",
      replace:"{ h:9, m:60 } ];\n  var LONG_H" },
    { file:'index', expect:"in box 0 →",
      find:"        if (v !== s.want){\n",
      replace:"        if (v !== s.want && v !== nx){\n" },
    { file:'index', expect:"in box 0 →",
      find:"roundMiss(v === nx ? d.gReadNext(e.h, nx) : d.gReadHourHand(e.h, nx));",
      replace:"roundMiss(v !== nx ? d.gReadNext(e.h, nx) : d.gReadHourHand(e.h, nx));" },
    { file:'index', expect:"in box 1 →",
      find:"roundMiss(v === n ? d.gReadNum(n, e.m) : d.gReadMinHand(n, e.m));",
      replace:"roundMiss(v === e.h ? d.gReadNum(n, e.m) : d.gReadMinHand(n, e.m));" },
    { file:'index', expect:"m must be 35~55",
      find:"var GAME_READ = [ { h:3, m:50 },",
      replace:"var GAME_READ = [ { h:3, m:15 }," },
    { file:'index', expect:"are not all different",
      find:"{ h:3, m:50 }, { h:4, m:45 },",
      replace:"{ h:3, m:50 }, { h:9, m:45 }," },
    { file:'index', expect:"never crosses 12",
      find:"{ h:1, m:40 }, { h:11, m:50 }, { h:12, m:40 } ];",
      replace:"{ h:1, m:40 }, { h:7, m:50 }, { h:2, m:40 } ];" },
    { file:'index', expect:"is not refused with the right reason",
      find:"if (v !== c){ roundMiss(dayMin(v) > dayMin(c) ? d.gDayLater(v, c) : d.gDayEarlier(v, c)); return false; }",
      replace:"if (v !== c && false){ roundMiss(dayMin(v) > dayMin(c) ? d.gDayLater(v, c) : d.gDayEarlier(v, c)); return false; }" },
    { file:'index', expect:"dayMin(",
      find:"function dayMin(v){ return ((v.half === 'am' ? 0 : 12) + v.h) * 60; }",
      replace:"function dayMin(v){ return v.h * 60; }" },
    { file:'index', expect:"no p.m. card with a smaller number",
      find:"[ { half:'pm', h:2 }, { half:'am', h:8 }, { half:'night', h:9 }, { half:'am', h:11 } ]",
      replace:"[ { half:'am', h:6 }, { half:'am', h:8 }, { half:'night', h:9 }, { half:'night', h:10 } ]" },
    { file:'index', expect:"is not a clear a.m.",
      find:"[ { half:'night', h:8 }, { half:'am', h:6 }, { half:'pm', h:4 }, { half:'am', h:9 } ]",
      replace:"[ { half:'night', h:8 }, { half:'am', h:6 }, { half:'pm', h:5 }, { half:'am', h:9 } ]" },
    { file:'index', expect:"a.m./p.m. reason is missing",
      find:"'晚' + (v.half !== c.half ? '（' + this.gDayOrder + '）' : '')",
      replace:"'晚' + ''" },
    { file:'index', expect:"in the box of",
      find:"if (v !== s.day){ roundMiss(d.gFillWrong(s.day, v)); return false; }",
      replace:"if (false){ roundMiss(d.gFillWrong(s.day, v)); return false; }" },
    { file:'index', expect:"goes to box",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"is in the first row",
      find:"{ mo:6, holes:[10, 16, 24] }",
      replace:"{ mo:6, holes:[3, 16, 24] }" },
    { file:'index', expect:"two holes side by side",
      find:"{ mo:9, holes:[11, 17, 23] }",
      replace:"{ mo:9, holes:[11, 12, 23] }" },
    { file:'index', expect:"gFillWrong zh",
      find:"'這一格的上面是 ' + (x - 7) + ' 日，往下一格多 7 天：' + (x - 7) + ' ＋ 7 ＝ ' + x",
      replace:"'這一格的上面是 ' + (x - 7) + ' 日，往下一格多 7 天：' + (x - 1) + ' ＋ 1 ＝ ' + x" },
    { file:'index', expect:"calCellXY",
      find:"y:y0 + G.head + Math.floor(i / 7) * G.ch + G.ch / 2 };",
      replace:"y:y0 + G.head + Math.floor(i / 6) * G.ch + G.ch / 2 };" },
    { file:'index', expect:"its box shows",
      find:"s.z.className = 'gdate filled'; s.z.textContent = String(v);",
      replace:"s.z.className = 'gdate filled';" },
    { file:'index', expect:"stopping on",
      find:"if (x !== T){ roundMiss(d.gHopWrong(e.s, x, e.n)); return; }",
      replace:"if (x < e.s + 1){ roundMiss(d.gHopWrong(e.s, x, e.n)); return; }" },
    { file:'index', expect:"past the end of the month",
      find:"if (x + k > len){ gMsg.textContent = d.gHopEnd(len); return; }",
      replace:"if (x + k > len + 7){ gMsg.textContent = d.gHopEnd(len); return; }" },
    { file:'index', expect:"should only remind",
      find:"if (x === e.s){ gMsg.textContent = d.gHopStay; return; }",
      replace:"if (x === e.s){ roundMiss(d.gHopStay); return; }" },
    { file:'index', expect:"does not solve",
      find:"d.wdLong[weekdayOf(CAL_YEAR, e.mo, T)]",
      replace:"d.wdLong[weekdayOf(CAL_YEAR, e.mo, T + 1)]" },
    { file:'index', expect:"+7 from",
      find:"        [d.gHop7, function(){ step(7); }],",
      replace:"        [d.gHop7, function(){ step(6); }]," },
    { file:'index', expect:"is not a date of month 9",
      find:"{ mo:9, s:2, n:21 }",
      replace:"{ mo:9, s:12, n:21 }" },
    { file:'index', expect:"both whole weeks and weeks-and-days",
      find:"{ mo:10, s:6, n:9 }, { mo:3, s:10, n:8 },\n                   { mo:11, s:4, n:7 }, { mo:4, s:8, n:16 } ];",
      replace:"{ mo:10, s:6, n:7 }, { mo:3, s:10, n:14 },\n                   { mo:11, s:4, n:7 }, { mo:4, s:8, n:14 } ];" },
    { file:'index', expect:"stars: a mistake changed the score",
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    { file:'index', expect:"tray starts already in order",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"    a.sort(function(x, y){ return x - y; });\n" },
    { file:'index', expect:"a piece still held when the board is rebuilt",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    { file:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"" },
    { file:'index', expect:"lost pointer capture does not put the piece back",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"if (mode === 'xahead'){ hintLevel = 1; showHint(); }" },
    { file:'index', expect:"GPICK (the ring on the long hand)",
      find:"var GAME_W = 300, GPICK = 48, GPAD = 6;",
      replace:"var GAME_W = 300, GPICK = 40, GPAD = 6;" },
    { file:'index', expect:"read: labels",
      find:"READ_LBL_W = 92,",
      replace:"READ_LBL_W = 100," },
    { file:'index', expect:"singular/plural",
      find:"fives:function(n){ return n === 1 ? '1 five' : n + ' fives'; },",
      replace:"fives:function(n){ return n + ' fives'; }," },
    { file:'index', expect:"gLongWrong zh",
      find:"' 個 5 分 → ' + (n * 5) + ' 分，不是 ' + m + ' 分。'",
      replace:"' 個 5 分 → ' + (n * 6) + ' 分，不是 ' + m + ' 分。'" },
    { file:'index', expect:"do not say which way to turn",
      find:"long:'拖長針上的圈圈，順著 1、2、3 的方向轉，",
      replace:"long:'拖長針上的圈圈轉一轉，" },
    { file:'index', expect:"the round has no drag",
      find:"（這一關用點的）'",
      replace:"'" },
    { file:'index', expect:"gReadDone does not say",
      find:"合起來是 ' + this.timeText(h, m) + '。';",
      replace:"合起來是 ' + h + ' 點。';" },
    { file:'index', expect:"Next does not move to the next round",
      find:"if (gRound < GAME_ORDER.length - 1){ gRound++; startRound(); }",
      replace:"if (gRound < GAME_ORDER.length - 1){ gRound += 0; startRound(); }" },
    { file:'index', expect:"does not enable Next",
      find:"    if (!last) gNext.disabled = false;",
      replace:"    if (!last) gNext.disabled = true;" },
    { file:'index', expect:"after the hour, the second hint",
      find:"got.h === null ? d.gRead2H(e.h, nx) : d.gRead2M(n)",
      replace:"got.m === null ? d.gRead2H(e.h, nx) : d.gRead2M(n)" },
    { file:'index', expect:"should point at the first empty box",
      find:"return left.length ? d.gFill2(left[0].day) : '';",
      replace:"return left.length ? d.gFill2(left[left.length - 1].day) : '';" },
    { file:'index', expect:"does not name the +1 / +7 buttons",
      find:"gHopStay:'先按「+1 天」或「+7 天」往後走。',",
      replace:"gHopStay:''," },
    { file:'index', expect:"gLongLap en q=1",
      find:"(q === 1 ? '1 whole lap' : q + ' whole laps')",
      replace:"(q + ' whole laps')" },
    { file:'index', expect:"gLongLap zh q=2",
      find:"'長針轉過了 12（走滿 ' + q + ' 圈）",
      replace:"'長針轉過了 12（走滿 1 圈）" },
    { file:'index', expect:"the short hand is not between",
      find:"var GAME_READ = [ { h:3, m:50 },",
      replace:"var GAME_READ = [ { h:3, m:55 }, { h:5, m:0 }," },
    /* ---- 範例、試題、複習挑戰 ---- */
    { file:'review', expect:'duplicate option value',
      find:'      if (!seen[k]){ seen[k] = true; out.push(c); }',
      replace:'      out.push(c);' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'the trap needs the long hand past 6',
      find:'        var n = 7 + rand(5);',
      replace:'        var n = 1 + rand(11);' },
    { file:'review', expect:'correct is not the minute count',
      find:'        var correct = m;\n        var cands = [n, m + 5, m - 5, m + 10]',
      replace:'        var correct = n;\n        var cands = [m, m + 5, m - 5, m + 10]' },
    { file:'review', expect:'February has 28 or 29 days',
      find:'        var mo = pickUnused([1,3,4,5,6,7,8,9,10,11,12], used);',
      replace:'        var mo = pickUnused([1,2,3,4,5,6,7,8,9,10,11,12], used);' },
    { file:'review', expect:'correct date is wrong',
      find:'        var correct = over ? { mo:mo + 1, d:y + n - len } : { mo:mo, d:y + n };',
      replace:'        var correct = { mo:mo, d:y + n };' },
    { file:'review', expect:'the scene does not happen in that half of the day',
      find:"    { icon:'🌆', half:'night', hours:[6,7],",
      replace:"    { icon:'🌆', half:'am', hours:[6,7]," },
    { file:'review', expect:'correct != 7 * k',
      find:'        var correct = 7 * k;',
      replace:'        var correct = 7 * k + 1;' },
    { file:'review', expect:'but the stem never says it',
      find:"            ? '半就是 30 分：長針指著 6，短針停在 '",
      replace:"            ? '「一共」就是 30 分：長針指著 6，短針停在 '" },
    { file:'review', expect:'hour outside 1~12',
      find:'        var h = pickUnused([1,2,3,4,5,6,7,8,9,10,11,12], used);\n        var n = 1 + rand(6);',
      replace:'        var h = pickUnused([0,1,2,3,4,5,6,7,8,9,10,11,12], used);\n        var n = 1 + rand(6);' },
    { file:'review', expect:'the birthday must still be ahead',
      find:'        var today = b - n;',
      replace:'        var today = b + n;' },
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? ('今天是 ' + mn + ' ' + d.today + ' 日。",
      replace:"            ? ('今天是' + mn + ' ' + d.today + ' 日。" },
    { file:'review', expect:'opts[ans] != correct',
      find:"  function dayStr(n, lang){ return lang === 'zh' ? (n + ' 天') : (n + ' days'); }",
      replace:"  function dayStr(n, lang){ return lang === 'zh' ? ((n + 1) + ' 天') : ((n + 1) + ' days'); }" },
    { file:'review', expect:'copied straight out of the stem',
      find:"            ? (d.m + ' 分的時候，長針指著哪個數字？')",
      replace:"            ? (d.m + ' 分的時候（不是 ' + (d.k + 1) + '），長針指著哪個數字？')" },
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"          stem: lang === 'zh' ? (d.k + ' 個星期有幾天？')",
      replace:"          stem: lang === 'zh' ? ('共<strong>' + d.k + '</strong>個星期有幾天？')" },
    { file:'review', expect:'not a real month length',
      find:'        var cands = [28,29,30,31].filter(function(x){ return x !== correct; });',
      replace:'        var cands = [26,28,29,30,31].filter(function(x){ return x !== correct; });' },
    { file:'review', expect:'day count outside 1~42',
      find:'        var cands = [ 7 * k - 7, 7 * k + 7, k + 7, 7 * k + 1 ]',
      replace:'        var cands = [ 7 * k - 7, 7 * k + 30, k + 7, 7 * k + 1 ]' },
    { file:'review', expect:'month outside 1~12',
      find:'        var mo = pickUnused([3,4,5,6,9,10,11], used);\n        var w0 = rand(7);',
      replace:'        var mo = pickUnused([3,4,5,6,9,10,13], used);\n        var w0 = rand(7);' },
    { file:'review', expect:'doubled punctuation',
      find:"            : ('One week is 7 days, so ' + d.k + ' weeks is ' + d.k + ' × 7 = ' + d.correct + ' days.')",
      replace:"            : ('One week is 7 days, so ' + d.k + ' weeks is ' + d.k + ' × 7 = ' + d.correct + ' days..')" },
    { file:'index', expect:'minute outside 1~59',
      find:'    { h:3,  m:50 },',
      replace:'    { h:3,  m:65 },' },
    { file:'index', expect:'the short hand is ON a number',
      find:'    { h:2,  m:10 },',
      replace:'    { h:2,  m:0 },' },
    { file:'index', expect:'does not name hour 7',
      find:"        { act:'起床', when:'上午 7 點', note:'同樣的鐘面，晚上 7 點是吃晚餐的時候。' },",
      replace:"        { act:'起床', when:'上午 8 點', note:'同樣的鐘面，晚上 8 點是吃晚餐的時候。' }," },
    { file:'index', expect:'should cover 28 / 30 / 31-day months',
      find:'  var CAL_MONTHS = [2, 6, 7];',
      replace:'  var CAL_MONTHS = [6, 9];' },
    { file:'index', expect:'ans differs zh=1 en=0',
      find:"          opts:['2 點 15 分','2 點 3 分','3 點 15 分','2 點 45 分'], ans:0,",
      replace:"          opts:['2 點 15 分','2 點 3 分','3 點 15 分','2 點 45 分'], ans:1," },
    { file:'index', expect:'duplicate option strings',
      find:"          opts:['5 天','7 天','12 天','30 天'], ans:1,",
      replace:"          opts:['7 天','7 天','12 天','30 天'], ans:1," },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'長針每指過一個數字就是 5 分：指著 8 就是 8 個 5 分，8 × 5 = 40 分。'",
      replace:"why:'長針每指過一個數字就是 5 分：指著 8 就是 8 個 5 分，8 × 5 = 45 分。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'兩個星期是 7 + 7 = 14 天。3 + 14 = 17 → 6 月 17 日。'",
      replace:"why:'兩個星期是十四天。三加十四是十七 → 6 月 17 日。'" },
    { file:'index', expect:"aspect ratios differ",
      find:"    var s = '<svg class=\"clock\" width=\"' + size + '\" height=\"' + size + '\" viewBox=\"0 0 ' + size + ' ' + size +",
      replace:"    var s = '<svg class=\"clock\" width=\"' + size + '\" height=\"1\" viewBox=\"0 0 ' + size + ' ' + size +" }
  ],

  sim: {
    INVARIANTS: {
      readClock: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.m !== d.n * 5) return 'why says n fives, but m != n*5';
        if (!(d.n >= 1 && d.n <= 6)) return 'this generator promises the first half of the dial (1~6)';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
        if (d.correct.h !== d.h || d.correct.m !== d.m) return 'correct does not match the clock that is drawn';
      },
      readClockTrap: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.m !== d.n * 5) return 'why says n fives, but m != n*5';
        if (!(d.n >= 7 && d.n <= 11)) return 'the trap needs the long hand past 6 (35~55 minutes)';
        if (d.m < 35) return 'why says the hour hand is almost at the next number, but it is not';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
        if (d.correct.h !== d.h || d.correct.m !== d.m) return 'correct does not match the clock that is drawn';
      },
      minuteOfNumber: d => {
        if (!(d.n >= 1 && d.n <= 11)) return 'n outside 1~11';
        if (d.m !== d.n * 5) return 'm != n*5';
        if (d.correct !== d.m) return 'correct is not the minute count';
        if (!(d.h >= 1 && d.h <= 12)) return 'clock hour outside 1~12';
      },
      numberOfMinute: d => {
        if (!(d.k >= 1 && d.k <= 11)) return 'k outside 1~11';
        if (d.m !== d.k * 5) return 'm != k*5';
        if (d.correct !== d.k) return 'correct is not the dial number';
      },
      halfPast: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.correct.m !== 30) return 'half past must be 30 minutes';
        if (d.correct.h !== d.h) return 'correct hour does not match the stem';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
      },
      ampmLife: d => {
        if (SCENE_HALF[d.si] !== d.half) return 'the scene does not happen in that half of the day';
        if (SCENE_HOURS[d.si].indexOf(d.h) < 0) return 'hour ' + d.h + ' is not one of the plausible hours for this scene';
        if (d.correct.h !== d.h || d.correct.half !== d.half) return 'correct does not match the clock that is drawn';
      },
      weekdayAfter: d => {
        if (!(d.w0 >= 0 && d.w0 <= 6)) return 'w0 is not a weekday index';
        if (!(d.mo >= 1 && d.mo <= 12)) return 'month outside 1~12';
        if (!(d.y >= 1 && d.y <= 28)) return 'start date outside 1~28';
        if (!(d.n >= 1 && d.n <= 6)) return 'n outside 1~6 (7 would land on the same weekday)';
        if (d.correct !== (d.w0 + d.n) % 7) return 'correct is not w0 + n days later';
        if (d.y + d.n > 28) return 'the second date may not exist in every month';
        if (d.mo === 2) return 'February is excluded from this lesson';
      },
      daysInMonth: d => {
        if (d.mo === 2) return 'February has 28 or 29 days — not a unique answer';
        if (d.correct !== DIM[d.mo - 1]) return 'correct is not the real length of month ' + d.mo;
      },
      dateAfter: d => {
        if (d.mo === 2 || d.mo === 12) return 'February and December are excluded (leap year / year rollover)';
        if (d.len !== DIM[d.mo - 1]) return 'len is not the real length of month ' + d.mo;
        if (!(d.y >= 1 && d.y <= d.len - 1)) return 'start date must leave at least one day in the month';
        if (!(d.n >= 2 && d.n <= 5)) return 'n outside 2~5';
        if (d.over !== (d.y + d.n > d.len)) return 'the over flag disagrees with the arithmetic';
        const want = d.over ? { mo:d.mo + 1, d:d.y + d.n - d.len } : { mo:d.mo, d:d.y + d.n };
        if (d.correct.mo !== want.mo || d.correct.d !== want.d) return 'correct date is wrong';
        if (d.correct.d < 1) return 'correct date is not a real day';
      },
      weeksToDays: d => {
        if (!(d.k >= 2 && d.k <= 5)) return 'k outside 2~5';
        if (d.correct !== 7 * d.k) return 'correct != 7 * k';
      },
      birthdayCountdown: d => {
        if (d.b <= d.today) return 'the birthday must still be ahead';
        if (d.correct !== d.b - d.today) return 'correct != birthday - today';
        if (d.n !== d.correct) return 'n and correct disagree';
        if (!(d.today >= 1 && d.b <= 31)) return 'dates outside 1~31';
      }
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (/undefined|NaN/.test(s)) return 'undefined/NaN option ' + s;
      return checkShape(SHAPE[genId], s, lang, isCorrect, genId);
    },
    /* 刻意的迷思誘答：題幹說「20 分」，選項就放 20 —— 那正是要抓的錯誤讀法。
       只有 k=1、2（5 分、10 分）時 5k 才落在 1~12，所以只有那兩種會觸發。 */
    stemEchoOk: {
      /* 只有「把題幹的分鐘數 m 本身當成盤面數字」這一個值是刻意的迷思誘答
         （只有 k=1、2 時 5k 才落在 1~12）。同一個產生器抄回別的數字仍然要報錯。 */
      numberOfMinute: function(d, opt){ return Number(opt) === d.m; }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不碰 review.html 的格式化函式 —— 那邊寫錯時這邊才會不一樣。 */
    expectedCorrect: function(d, genId, lang){
      const zh = (lang === 'zh');
      const time = (h, m) => zh ? (m === 0 ? (h + ' 點整') : (h + ' 點 ' + m + ' 分'))
                                : (h + ':' + (m < 10 ? '0' : '') + m);
      const mins = (n) => zh ? (n + ' 分') : (n + ' minutes');
      const days = (n) => zh ? (n + ' 天') : (n + ' days');
      const date = (mo, dd) => zh ? (mo + ' 月 ' + dd + ' 日') : (dd + ' ' + MON_EN[mo - 1]);
      switch (genId){
        case 'readClock':
        case 'readClockTrap':   return time(d.h, d.n * 5);
        case 'minuteOfNumber':  return mins(d.n * 5);
        case 'numberOfMinute':  return String(d.k);
        case 'halfPast':        return time(d.h, 30);
        case 'ampmLife':        return zh ? ((SCENE_HALF[d.si] === 'am' ? '上午 ' : '晚上 ') + d.h + ' 點')
                                          : (d.h + ':00 ' + (SCENE_HALF[d.si] === 'am' ? 'a.m.' : 'p.m.'));
        case 'weekdayAfter':    return (zh ? WD_ZH : WD_EN)[(d.w0 + d.n) % 7];
        case 'daysInMonth':     return days(DIM[d.mo - 1]);
        case 'dateAfter': {
          const len = DIM[d.mo - 1];
          return (d.y + d.n > len) ? date(d.mo + 1, d.y + d.n - len) : date(d.mo, d.y + d.n);
        }
        case 'weeksToDays':     return days(7 * d.k);
        case 'birthdayCountdown': return days(d.b - d.today);
        default: return 'NO EXPECTED-CORRECT DEFINED for ' + genId;
      }
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIVE_HOUR, HOUR_CASES, DAY_CASES, CAL_YEAR, CAL_MONTHS, daysInMonth, firstWeekday, weekdayOf, minuteToNumber, clockSVG, ' +
      'GAME_W, GPICK, GPAD, GAME_ORDER, GAME_LONG, LONG_H, LONG_DIAL, GAME_READ, READ_H, READ_DIAL, READ_SLOT, READ_LBL_Y, READ_LBL_W, READ_CARD, ' +
      'GAME_DAY, DAY_ICON, DAY_H, DAY_SLOT, DAY_CARD, dayMin, GAME_FILL, CAL_GRID, FILL_H, FILL_Y0, FILL_CARD, GAME_HOP, HOP_H, HOP_Y0, calCellXY, ' +
      'dialR, dialSVG, dialAngle, dialNumber, ringXY, angleStep, snapMinutes, hourAfter}',
    check: function(data, I18N, fail, src){
      const LANGS = ['zh','en'];

      /* --- 範例 1：長針一次走 5 分 --- */
      if (!(data.FIVE_HOUR >= 1 && data.FIVE_HOUR <= 12)) fail('FIVE_HOUR outside 1~12');
      LANGS.forEach(L => {
        for (let step = 1; step <= 11; step++){
          const t = I18N[L].fiveStep(step, step * 5, data.FIVE_HOUR);
          if (/undefined|NaN/.test(t)) fail(`fiveStep ${L} step ${step}: ${t}`);
          if (t.indexOf(String(step * 5)) < 0) fail(`fiveStep ${L} step ${step} never prints ${step * 5}`);
        }
        const end = I18N[L].fiveEnd(data.FIVE_HOUR + 1);
        if (end.indexOf('60') < 0) fail(`fiveEnd ${L} does not mention the 60 minutes of a full lap`);
      });

      /* --- 範例 2：短針卡在兩個數字中間 --- */
      let trap = 0, early = 0;
      data.HOUR_CASES.forEach(c => {
        if (!(c.h >= 1 && c.h <= 12)) fail(`HOUR_CASES hour ${c.h} outside 1~12`);
        if (c.m % 5 !== 0) fail(`HOUR_CASES ${c.h}:${c.m} minute is not a multiple of 5`);
        if (c.m === 0) fail(`HOUR_CASES ${c.h}:${c.m} — at an exact hour the short hand is ON a number, so the lesson point disappears`);
        if (!(c.m >= 1 && c.m <= 59)) fail(`HOUR_CASES ${c.h}:${c.m} minute outside 1~59`);
        const dial = data.minuteToNumber(c.m);
        if (dial * 5 !== c.m) fail(`minuteToNumber(${c.m}) is not the dial number`);
        if (!(dial >= 1 && dial <= 11)) fail(`HOUR_CASES ${c.h}:${c.m} dial number ${dial} outside 1~11`);
        if (c.m >= 35) trap++;
        if (c.m <= 15) early++;
        LANGS.forEach(L => {
          const nx = (c.h % 12) + 1;
          const a = I18N[L].s2Hour(c.h, nx, c.h);
          const b = I18N[L].s2Min(data.minuteToNumber(c.m), c.m);
          const d3 = I18N[L].s2Done(c.h, c.m);
          [a, b, d3].forEach(t => { if (/undefined|NaN/.test(t)) fail(`s2 text ${L} ${c.h}:${c.m}: ${t}`); });
          if (b.indexOf(String(c.m)) < 0) fail(`s2Min ${L} never prints ${c.m}`);
        });
      });
      if (!trap) fail('HOUR_CASES has no case where the short hand is nearly at the next number (the whole point of example 2)');
      if (!early) fail('HOUR_CASES has no easy case (minute hand in the first quarter)');

      /* --- 範例 3：上午／晚上。字典的 dayCases 和 DAY_CASES 是索引對齊的兩個陣列，
             所以要逐一驗「文字裡的鐘點就是畫出來的那個鐘點」。 --- */
      LANGS.forEach(L => {
        const dc = I18N[L].dayCases;
        if (!dc || dc.length !== data.DAY_CASES.length) fail(`${L} dayCases length != DAY_CASES length`);
        data.DAY_CASES.forEach((c, i) => {
          if (!(c.h >= 1 && c.h <= 12)) fail(`DAY_CASES[${i}] hour outside 1~12`);
          if (c.m !== 0) fail(`DAY_CASES[${i}] should be an exact hour`);
          const t = dc[i] || {};
          if (!t.act || !t.when || !t.note) fail(`${L} dayCases[${i}] incomplete`);
          if (t.when && t.when.indexOf(String(c.h)) < 0)
            fail(`${L} dayCases[${i}].when "${t.when}" does not name hour ${c.h} of the clock that is drawn`);
          if (t.note && t.note.indexOf(String(c.h)) < 0)
            fail(`${L} dayCases[${i}].note "${t.note}" does not name hour ${c.h}`);
        });
      });

      /* --- 範例 4：月曆。用一份獨立的天數表對照 Date 算出來的結果。 --- */
      const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      data.CAL_MONTHS.forEach(mo => {
        if (!(mo >= 1 && mo <= 12)) fail(`CAL_MONTHS ${mo} outside 1~12`);
        const want = (mo === 2 && leap(data.CAL_YEAR)) ? 29 : DIM[mo - 1];
        if (data.daysInMonth(data.CAL_YEAR, mo) !== want)
          fail(`daysInMonth(${data.CAL_YEAR}, ${mo}) = ${data.daysInMonth(data.CAL_YEAR, mo)}, expected ${want}`);
        const f = data.firstWeekday(data.CAL_YEAR, mo);
        if (!(f >= 0 && f <= 6)) fail(`firstWeekday(${data.CAL_YEAR}, ${mo}) = ${f}`);
        if (data.weekdayOf(data.CAL_YEAR, mo, 1) !== f) fail(`weekdayOf day 1 != firstWeekday for month ${mo}`);
        /* 差 7 天一定是同一個星期幾 —— 這是課程頁教的規則，也順便驗 weekdayOf。 */
        if (data.daysInMonth(data.CAL_YEAR, mo) >= 8 &&
            data.weekdayOf(data.CAL_YEAR, mo, 8) !== f)
          fail(`month ${mo}: day 8 is not the same weekday as day 1`);
      });
      if (data.CAL_MONTHS.map(mo => DIM[mo - 1]).filter((v, i, a) => a.indexOf(v) === i).length < 3)
        fail('CAL_MONTHS should cover 28 / 30 / 31-day months');

      /* --- 小遊戲：五關五種玩法（gameCheck 在檔案上方） --- */
      gameCheck(data, I18N, fail, src);

          /* --- 三層題庫的題幹與解釋：算式逐條驗算（issue #2） ---
             ⚠️ 光是「跑過沒報錯」不算數：一個壞掉的正規化會讓每一條算式都
             靜靜地讀不到，那樣也是零錯誤。所以**驗過幾條要對得上數字** ——
             少掉就表示有宣稱沒被驗到。 */
          {
            let vSum = 0, qSum = 0;
            ['qs','qsAdv','qsBoost'].forEach(bank => {
              ['zh','en'].forEach(L => {
                (I18N[L][bank] || []).forEach((q, i) => {
                  [['stem', q && q.stem], ['why', q && q.why]].forEach(([field, text]) => {
                    if (typeof text !== 'string') return;
                    const r = arithTime(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 8) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 8`);
            if (qSum !== 0) fail(`question-shaped equations changed: found ${qSum}, expected 0`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithTime.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithTime.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithTime.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== 'd82cd4471c8d'){
                fail(`the set of verified equations changed (digest ${digest}, expected d82cd4471c8d)\n      now: ${list.join(' | ')}`);
              }
            }
          }


          /* --- 圖畫不畫得下（issue #2：這一課本來完全沒有幾何檢查） ---
             實作在 tools/checks/lib/canvas.js（全站唯一一份），四個邊都驗。
             鐘面是圓的，12 個鐘點都要各驗一次 —— 只驗一個角度的話，
             指針往別的方向畫出界完全看不到。 */
          {
            let shots = 0;
            for (let hh = 1; hh <= 12; hh++){
              /* 每 5 分一格，12 個位置都要走過 —— 只驗整點的話，指針指向別的方向
                 時畫出界完全看不到。 */
              for (let mm = 0; mm < 60; mm += 5){
                shots++;
                canvasProblems(data.clockSVG(hh, mm)).forEach(m => fail(`clockSVG(${hh}:${mm}): ${m}`));
              }
            }
            if (shots !== 144) fail(`clockSVG canvas check covered ${shots} clock faces, expected 144`);
          }

    }
  }
};
