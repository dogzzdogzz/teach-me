/* grade-2/math/length（公分與公尺）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的關鍵在「同一個長度有好幾種寫法」：100 公分和 1 公尺是同一個答案，
   1 公尺 30 公分和 130 公分也是。字串比對看不出來（simgen 的 vkey 會說它們不同），
   孩子卻看得出來 —— 所以這裡所有的去重與比較一律換算成公分再比。 */

/* ---------- 長度值的工具（設定檔自己的一套，不呼叫 review.html 的） ---------- */
function cmOf(v){
  if (!v || typeof v !== 'object') return NaN;
  if (v.t === 'cm') return v.n;
  if (v.t === 'm') return v.n * 100;
  if (v.t === 'comp') return v.m * 100 + v.c;
  return NaN;
}
function fmtCm(n, lang){ return lang === 'zh' ? (n + ' 公分') : (n + ' cm'); }
function fmtM(n, lang){ return lang === 'zh' ? (n + ' 公尺') : (n + ' m'); }
function fmtComp(m, c, lang){
  return lang === 'zh' ? (m + ' 公尺 ' + c + ' 公分') : (m + ' m ' + c + ' cm');
}
function fmtVal(v, lang){
  if (v.t === 'cm') return fmtCm(v.n, lang);
  if (v.t === 'm') return fmtM(v.n, lang);
  return fmtComp(v.m, v.c, lang);
}
/* 從畫面上真的會顯示的字串反推長度（前面可以有物品名稱：「書桌 80 公分」）。 */
function parseLen(s, lang){
  const t = String(s).trim();
  let m;
  if (lang === 'zh'){
    m = t.match(/(\d+)\s*公尺\s*(\d+)\s*公分$/); if (m) return Number(m[1]) * 100 + Number(m[2]);
    m = t.match(/(\d+)\s*公尺$/); if (m) return Number(m[1]) * 100;
    m = t.match(/(\d+)\s*公分$/); if (m) return Number(m[1]);
    return null;
  }
  m = t.match(/(\d+)\s*m\s*(\d+)\s*cm$/); if (m) return Number(m[1]) * 100 + Number(m[2]);
  m = t.match(/(\d+)\s*cm$/); if (m) return Number(m[1]);
  m = t.match(/(\d+)\s*m$/); if (m) return Number(m[1]) * 100;
  return null;
}

/* 兩兩比對「換算成公分之後的值」—— simgen 的通用去重只比字串，
   在這一課會放過「100 公分」和「1 公尺」同時出現。 */
function distinctOpts(d){
  const vals = d.opts.map(cmOf);
  for (let i = 0; i < vals.length; i++){
    if (!Number.isFinite(vals[i])) return 'option ' + i + ' is not a length value';
    for (let j = i + 1; j < vals.length; j++){
      if (vals[i] === vals[j]) return 'two options are the same real length: ' + vals[i] + ' cm';
    }
  }
  return null;
}
function answerIs(d, cm){
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (cmOf(d.correct) !== cm) return 'correct is ' + cmOf(d.correct) + ' cm, expected ' + cm + ' cm';
  return null;
}
function base(d, cm){ return distinctOpts(d) || answerIs(d, cm); }
/* 誘答不可以是題幹裡印出來的那幾個數字。 */
function noStemEcho(d, banned){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans) continue;
    if (banned.indexOf(cmOf(d.opts[i])) >= 0){
      return 'a distractor (' + cmOf(d.opts[i]) + ' cm) is copied straight out of the stem';
    }
  }
  return null;
}

/* 每個產生器的選項範圍（公分）。每一條都要寫得出「這個上限是怎麼算出來的」——
   隨手給一個大數等於沒有範圍檢查（2026-08-25 grade-2/numbers 的教訓）。 */
const RANGE = {
  /* 尺只到 15 公分，to ≤ 13、最大的誘答是 to+2 → 15。 */
  readRuler:       [1, 15],
  /* 正解 ≤ 11；最大的誘答是「頭尾相加」from+to ≤ 4+15 ＝ 19（那是真的會犯的錯，
     算出來本來就會超出尺長）。 */
  readRulerOffset: [1, 19],
  /* m ≤ 9，最大的誘答是「多一個 0」m×1000 ＝ 9000 公分。 */
  mToCm:           [1, 9000],
  /* 正解 m ≤ 9 公尺；最大的誘答是 m×10 ＝ 90 公尺 ＝ 9000 公分。 */
  cmToM:           [100, 9000],
  /* m ≤ 2、c ≤ 94 → 正解 ≤ 294；保底 n+10 ＝ 304。下限是誘答 CM(c)，c 最小 3。 */
  compoundToCm:    [3, 304],
  /* 最大的誘答是 (m+1) 公尺 c 公分 ≤ 3 公尺 95 公分 ＝ 395。 */
  cmToCompound:    [1, 395],
  /* a ≤ 68、b ≤ 39 → 和 ≤ 107；保底 sum+20 ＝ 127。
     下限留 1：誘答 a−b（用錯運算）可以小到個位數。 */
  addLength:       [1, 127],
  /* 最大的誘答是 a+b ≤ 96+34 ＝ 130。 */
  subLength:       [1, 130],
  /* 最大的誘答是 total+b ≤ 200+70 ＝ 270。 */
  meterMinus:      [1, 270],
  /* 最大的物品是 8 公尺，最大的誘答是 num×10 ＝ 80 公尺 ＝ 8000 公分。 */
  pickUnit:        [1, 8000],
  /* 四個長度都抽自 30~260 公分，選項就是那四個值本身。 */
  compareLength:   [30, 260]
};

/* C2-8：估測題的正解不能只靠 review.html 自己的物品表 —— 那等於自己比自己。
   這裡放一份設定檔自己的物品真值，索引和 review.html 的 OBJS 對齊。 */
const PICK_UNIT_TRUTH = [
  { unit:'cm', num:18 },   /* 一枝新鉛筆 */
  { unit:'cm', num:26 },   /* 課本的長邊 */
  { unit:'cm', num:75 },   /* 書桌的高度 */
  { unit:'cm', num:1  },   /* 小指的寬度 */
  { unit:'m',  num:2  },   /* 教室門的高度 */
  { unit:'m',  num:8  }    /* 教室的長邊 */
];

/* C2-1：三層題庫沒有答案神諭時，任何一個在範圍內的選項都會通過。
   這裡把每一題的正解（公分）獨立寫一次，中英共用 —— 改了選項或 ans 就會被抓到。 */
/* C2-6：哪幾題的題幹該畫出「被量的長條」，以及該畫多長（公分）。
   檢查腳本自己記著，所以「該畫卻沒畫」和「不該畫卻畫了」兩邊都會被抓到 ——
   只靠掃描渲染結果的話，樣式一改檢查就會靜靜失效。 */
const BANK_RULER = {
  qs:      { 1: 8 },
  qsBoost: { 0: 8 }
};

const BANK_EXPECTED = {
  qs:      [1, 8, 100, 200, 13, 200],
  qsAdv:   [55, 60, 125, 200],
  qsBoost: [8, 105]
};

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithLength = require('./lib/arith.js').makeArith({
  units: ["公分", "公尺", "個", "條", "枝", "根"],
  unitsEn: ["cm", "centimetres?", "centimeters?", "metres?", "meters?", "strings?", "sticks?"],
  conversions: {"公尺": 100, "公分": 1, "metre": 100, "metres": 100, "meter": 100, "meters": 100, "m": 100, "cm": 1, "centimetre": 1, "centimetres": 1}
});

const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 小遊戲「量長度大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   推到 0（一端要對準 0）、數格子（數的是格子不是線）、接成 1 公尺（m 公尺 c 公分換成公分）、剪一刀（剪掉用減的）、
   排長短（單位不一樣先換成公分）。做法照 grade-2-numbers.js／grade-3-divide.js：
   - 每一關**照遊戲的規則把每一題玩一遍**（自己的規則實作），證明一定解得完、而且只有對的做法收得進去；
   - 頁面的純函式（zeroTickX／countTickX／cutX／lenCm／rankWhy）拿整個題庫去呼叫，再和自己的公式比；
   - nearestOpen()、roundSolved()、roundMiss()、shuffle() 從原始碼切出來**真的跑**；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯），而且那句話說的事要成立（剪在 x，右邊真的是 s − x）；
   - 版面與觸控 ≥ 44px 從 index.html 的常數讀（不在這裡另抄一份數字）。
   已知極限：RENDER 函式本體裡的規則是字面掃描（need()：證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g2-length 的端對端測試驗。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const has = (where, text, re) => { if (!re.test(String(text))) fail(where + ': should say ' + re + ' — ' + text); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board (' + JSON.stringify(o) + ')'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const pad = (R, p) => ({ x:R.x - p, y:R.y - p, w:R.w + 2 * p, h:R.h + 2 * p });
  const W = D.GAME_W;
  /* 自己的長度表示法（不呼叫頁面的 len()）：{m, c} → 公分 */
  const cmOf = v => (v.m || 0) * 100 + (v.c || 0);

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['zero', 'count', 'build', 'cut', 'rank'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
    if (/\broundSolved\(/.test(B[t].replace(/\/\*[\s\S]*?\*\//g, '')) !== true) fail(t + ': the round never calls roundSolved()');
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 第 2 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外）；其他四關要寫出「先點、再點」 */
  if (!/用點的/.test(I18N.zh.gAsks.count) || !/all taps/.test(I18N.en.gAsks.count)) fail('count: the round has no drag — its instructions must say it is all taps');
  ['zero', 'build', 'cut', 'rank'].forEach(t => {
    if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way');
  });
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;(?:\s*\/\*[\s\S]*?\*\/)*\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); return; \}/.test(src))
    fail('a piece that was tapped and then dragged stays selected — a later tap would drop it again');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src) || !/gCtx = \{\}; gGen\+\+;/.test(extractFunction(src, 'startRound') || ''))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round — codex round 1');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');

  /* --- 觸控：375px 手機上畫板能用的寬度從頁面的 CSS 算（.wrap 左右 padding、.card 的 padding 與邊框、.gstage 左右 padding），
     不在這裡寫死（codex 第一輪）。300 寬的畫板縮成 avail / 300 倍 --- */
  const cssPx = (sel, re) => { const m = src.match(new RegExp('\\n\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); const v = m && m[1].match(re); return v ? v.slice(1).map(Number) : null; };
  const wrapPad = cssPx('.wrap', /padding:(\d+)px (\d+)px/), cardPad = cssPx('.card', /padding:(\d+)px/), cardBorder = cssPx('.card', /border:(\d+)px/), stagePad = cssPx('.gstage', /padding:\s*(\d+)px (\d+)/);
  if (!wrapPad || !cardPad || !cardBorder || !stagePad) fail('touch: cannot read .wrap / .card / .gstage padding from the CSS');
  const avail = 375 - 2 * ((wrapPad || [0, 0])[1] + (cardPad || [0])[0] + (cardBorder || [0])[0] + (stagePad || [0, 0])[1]);
  const scale = Math.min(1.5, avail / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK', D.GPICK);
  small('the pencil (height)', D.ZERO_PEN.h);
  small('a space on the counting ruler (' + D.COUNT_RULER.unit + '×' + D.COUNT_RULER.h + ')', Math.min(D.COUNT_RULER.unit, D.COUNT_RULER.h));
  small('a stick/cube source (' + D.BUILD_TOK.w + '×' + D.BUILD_TOK.h + ')', Math.min(D.BUILD_TOK.w, D.BUILD_TOK.h));
  small('the scissors', D.CUT_SCI.size);
  small('a length card (' + D.RANK_CARD.w + '×' + D.RANK_CARD.h + ')', Math.min(D.RANK_CARD.w, D.RANK_CARD.h));
  small('a rank box', Math.min(D.RANK_SLOT.w, D.RANK_SLOT.h));
  [D.ZERO_PEN.h, D.BUILD_TOK.w, D.BUILD_TOK.h, D.CUT_SCI.size, D.RANK_CARD.w, D.RANK_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('build: the Done button (.btn) is not at least 46px tall'); }
  need('zero', /var pen = addPiece\(B, \{ w:w, h:Pn\.h, cx:zeroTickX\(e\.from\) \+ w \/ 2, cy:Pn\.y,/, 'the pencil is not len × ZERO_PEN.h with its left end on from');
  need('count', /c\.style\.left = countTickX\(k - 1\) \+ 'px'; c\.style\.top = R\.y \+ 'px'; c\.style\.width = R\.unit \+ 'px'; c\.style\.height = R\.h \+ 'px';/, 'a space button is not exactly one space (unit × ruler height)');
  need('build', /addPiece\(B, \{ w:BUILD_TOK\.w, h:BUILD_TOK\.h, cx:GAME_W \/ 2 \+ \(i - 0\.5\) \* BUILD_TOK\.step, cy:BUILD_TOK\.y,/, 'cannot read where the stick/cube sources are drawn');
  need('cut', /addPiece\(B, \{ w:CUT_SCI\.size, h:CUT_SCI\.size, cx:GAME_W \/ 2, cy:CUT_SCI\.y,/, 'the scissors are not CUT_SCI.size at (GAME_W / 2, CUT_SCI.y)');
  need('rank', /addPiece\(B, \{ w:RANK_CARD\.w, h:RANK_CARD\.h, cx:cx, cy:cy,/, 'the length cards are not RANK_CARD.w × RANK_CARD.h');

  /* --- 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = 0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = {}, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves) => new Function(env.replace('S0', s0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
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

  /* ================= 第 1 關：推到 0（範例 2：一端要對準 0） ================= */
  {
    const R = D.ZERO_RULER, Pn = D.ZERO_PEN, H = D.ZERO_H, P = D.ZERO_PAD;
    for (let k = 0; k <= R.max; k++) if (!near(D.zeroTickX(k), R.x0 + k * R.unit)) fail('zeroTickX(' + k + ') should be ' + (R.x0 + k * R.unit));
    if (!near(D.zeroEdgeX(), R.x0 - R.edge)) fail('zeroEdgeX() should be ' + (R.x0 - R.edge));
    inside({ x:R.x0 - R.edge, y:R.y, w:R.max * R.unit + 2 * R.edge, h:R.h }, 'zero: the ruler', W, H);
    for (let k = 0; k <= R.max; k++) inside({ x:R.x0 + k * R.unit - R.numW / 2, y:R.numY, w:R.numW, h:18 }, 'zero: ruler number ' + k, W, H);
    if (!(R.numY >= R.y + 16 && R.numY + 18 <= R.y + R.h)) fail('zero: the ruler numbers are not inside the ruler, under the ticks');
    if (!(R.numW <= R.unit + 8)) fail('zero: ruler numbers ' + R.numW + ' wide on a ' + R.unit + 'px space would run into each other');
    /* 尺的邊緣離 0 只有 R.edge：比 2 × ZERO_PAD 小，吸附範圍刻意重疊（不然端對端測試的「重疊區挑最近」無從驗起） */
    if (!(R.edge < 2 * P)) fail('zero: the ruler edge is ' + R.edge + ' from 0 — the drop pads (' + P + ') no longer overlap, the nearest-line rule is never exercised');
    if (!(R.unit > P)) fail('zero: ticks ' + R.unit + ' apart with pads of ' + P + ' — one drop would reach three lines');
    /* 鉛筆的兩條虛線（.gguide）從長條底下拉到尺的刻度：top ＝ 長條底、height 到刻度的下端 */
    {
      const m = src.match(/\.gguide\{[^}]*top:(\d+)px; height:(\d+)px/), bar = +((src.match(/\.gpen\{[^}]*center \/ 100% (\d+)px/) || [])[1]);
      if (!m || !bar) fail('zero: cannot read .gguide top/height or the pencil bar height from the CSS');
      else {
        const top = +m[1], h = +m[2], barBottom = (Pn.h + bar) / 2;
        if (top !== barBottom) fail('zero: the guide lines start at ' + top + ', the pencil bar ends at ' + barBottom);
        if (Pn.y - Pn.h / 2 + top + h !== R.y + 16) fail('zero: the guide lines end at ' + (Pn.y - Pn.h / 2 + top + h) + ', the ruler ticks end at ' + (R.y + 16));
      }
    }
    if (!(Pn.y + Pn.h / 2 <= R.y)) fail('zero: the pencil sits on top of the ruler');
    const top = Pn.y - Pn.band, bot = R.y + R.h, mid = (top + bot) / 2, hh = (bot - top) / 2;
    if (!(top - P > 0)) fail('zero: the drop band starts at ' + (top - P) + ' — there is no empty space above the pencil on the board');
    const marks = [{ cx:R.x0 - R.edge, cy:mid, hw:0, hh, k:-1, done:false }];
    for (let k = 0; k <= R.max; k++) marks.push({ cx:R.x0 + k * R.unit, cy:mid, hw:0, hh, k, done:false });
    need('zero', /var top = Pn\.y - Pn\.band, bot = R\.y \+ R\.h, mid = \(top \+ bot\) \/ 2, hh = \(bot - top\) \/ 2;\s*var marks = \[\{ cx:zeroEdgeX\(\), cy:mid, hw:0, hh:hh, k:-1, done:false \}\];\s*for \(var k = 0; k <= R\.max; k\+\+\) marks\.push\(\{ cx:zeroTickX\(k\), cy:mid, hw:0, hh:hh, k:k, done:false \}\);/,
      'the drop targets are not [ruler edge, line 0 … line max] over the pencil band and the ruler');
    need('zero', /var left = pt\.tap \? pt\.x : pt\.x - P\.w \/ 2;\s*var m = nearestOpen\(marks, \{ x:left, y:pt\.y \}, ZERO_PAD\);\s*if \(!m \|\| m\.k === e\.from\) return false;/, 'the drop is not judged by the pencil\'s LEFT end (drag: centre − half the length; tap: the tapped line), or empty space / a drop back on its own line is not silent');
    need('zero', /if \(m\.k < 0\)\{ roundMiss\(d\.gZeroEdge\); return false; \}/, 'the edge of the ruler is accepted as 0');
    need('zero', /if \(m\.k > 0\)\{ roundMiss\(d\.gZeroTick\(m\.k\)\); return false; \}/, 'a left end on another line is accepted');
    need('zero', /P\.lock\(zeroTickX\(0\) \+ P\.w \/ 2, Pn\.y\);[\s\S]*?roundSolved\(d\.gZeroDone\(e\.from, to, e\.len\)\);/, 'the pencil is not locked with its left end on 0, or the round is not solved there');
    need('zero', /var e = pick\(GAME_ZERO\), to = e\.from \+ e\.len,/, 'the right end is not from + len');
    /* 每一個左端的位置：只有 0 那一條線（而且比邊緣近）收；其他都說得出是邊緣還是哪一條線 */
    if (nearestOpen){
      let acc = 0, bad = 0;
      for (let x = R.x0 - R.edge - P - 3; x <= R.x0 + R.max * R.unit + P + 3; x += 0.25){
        const g = nearestOpen(marks, { x, y:Pn.y }, P);
        const dE = Math.abs(x - (R.x0 - R.edge)), d0 = Math.abs(x - R.x0);
        let want = null, bd = Infinity;
        marks.forEach(m => { const dd = Math.abs(x - m.cx); if (dd <= P && dd < bd){ bd = dd; want = m.k; } });
        if ((g ? g.k : null) !== want) bad++;
        if (g && g.k === 0){ acc++; if (!(d0 <= P && d0 <= dE)) bad++; }
      }
      if (bad) fail('zero: nearestOpen() gives ' + bad + ' left-end positions to the wrong line (or the edge) — it must pick the nearest');
      if (!acc) fail('zero: no left-end position is ever accepted as 0');
      if (nearestOpen(marks, { x:R.x0, y:top - P - 2 }, P) !== null) fail('zero: a pencil dropped above the band still counts');
      if (nearestOpen(marks, { x:R.x0 - R.edge - P - 1, y:Pn.y }, P) !== null) fail('zero: a left end left of the ruler edge still counts');
    }
    if (!(D.GAME_ZERO.length >= 4)) fail('GAME_ZERO should have at least 4 entries');
    D.GAME_ZERO.forEach((e, i) => {
      const w = 'GAME_ZERO[' + i + ']', to = e.from + e.len;
      if (![e.from, e.len].every(Number.isInteger)) return fail(w + ' is not whole numbers');
      if (e.from < 2) fail(w + ': the pencil starts at ' + e.from + ' — it must start away from 0 (and away from 1, whose miss says "on 1")');
      if (e.len < 5) fail(w + ': only ' + e.len + ' cm long');
      if (to > R.max) fail(w + ': runs off the 0~' + R.max + ' ruler (to ' + to + ')');
      if (!e.icon) fail(w + ': no icon');
      const home = box(R.x0 + e.from * R.unit + e.len * R.unit / 2, Pn.y, e.len * R.unit, Pn.h);
      inside(home, w + ' the pencil at home', W, H);
      inside(box(R.x0 + e.len * R.unit / 2, Pn.y, e.len * R.unit, Pn.h), w + ' the pencil on 0', W, H);
      /* 照遊戲的規則玩一遍：從家往左推，左端每經過一個位置 —— 只有到 0 才收 */
      if (nearestOpen){
        let got = null;
        for (let x = R.x0 + e.from * R.unit; x >= R.x0 - R.edge - P - 2; x -= 0.5){ const g = nearestOpen(marks, { x, y:Pn.y }, P); if (g && g.k === 0){ got = x; break; } }
        if (got === null) fail(w + ': pushing the pencil left never reaches 0');
        const atHome = nearestOpen(marks, { x:R.x0 + e.from * R.unit, y:Pn.y }, P);
        if (!atHome || atHome.k !== e.from) fail(w + ': dropped back at home, the left end should read ' + e.from);
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gZeroDone ' + L, d.gZeroDone(e.from, to, e.len), [0, e.len, to, e.from, e.len]);
        has(w + ' gZeroDone ' + L, d.gZeroDone(e.from, to, e.len), L === 'zh' ? /－/ : /−/);
        seq(w + ' gZeroNow ' + L, d.gZeroNow(e.len), [0, e.len, e.len]);
        seq(w + ' gZero2 ' + L, d.gZero2(e.from), [e.from, e.from]);
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      for (let k = 1; k <= R.max; k++) seq('gZeroTick(' + k + ') ' + L, d.gZeroTick(k), [k, 0, 0]);
      seq('gZeroEdge ' + L, d.gZeroEdge, [0, 0]);
      has('gZeroEdge ' + L, d.gZeroEdge, L === 'zh' ? /邊緣/ : /edge/);
      seq('gZeroAsk ' + L, d.gZeroAsk, []);
    });
  }

  /* ================= 第 2 關：數格子（範例 1：一大格 1 公分；範例 2：沒對準 0） ================= */
  {
    const R = D.COUNT_RULER, H = D.COUNT_H, RB = D.COUNT_RIB;
    for (let k = 0; k <= R.max; k++) if (!near(D.countTickX(k), R.x0 + k * R.unit)) fail('countTickX(' + k + ') should be ' + (R.x0 + k * R.unit));
    inside({ x:R.x0 - R.edge, y:R.y, w:R.max * R.unit + 2 * R.edge, h:R.h }, 'count: the ruler', W, H);
    for (let k = 0; k <= R.max; k++) inside({ x:R.x0 + k * R.unit - R.numW / 2, y:R.numY, w:R.numW, h:18 }, 'count: ruler number ' + k, W, H);
    if (!(R.numY >= R.y + 16 && R.numY + 18 <= R.y + R.h)) fail('count: the ruler numbers are not inside the ruler');
    if (!(RB.y >= 0 && RB.y + RB.h < R.y)) fail('count: the ribbon is not above the ruler');
    const cells = [];
    for (let k = 1; k <= R.max; k++){ const c = { x:R.x0 + (k - 1) * R.unit, y:R.y, w:R.unit, h:R.h }; inside(c, 'count: space ' + k, W, H); cells.push(c); }
    noHits(cells, 'count: space buttons');
    need('count', /if \(gSolved \|\| c\.classList\.contains\('counted'\)\) return;/, 'a counted space can be counted twice (or counting goes on after the round)');
    need('count', /if \(k <= e\.a \|\| k > e\.b\)\{ roundMiss\(d\.gCountOut\); return; \}/, 'a space outside the ribbon is counted');
    need('count', /seen\+\+;\s*c\.classList\.add\('counted'\);/, 'a tap inside the ribbon does not count one more');
    need('count', /if \(seen === n\)\{ line\.textContent = d\.gCountNow\(n\) \+ ' → ' \+ d\.cm\(n\); roundSolved\(d\.gCountDone\(e\.a, e\.b, n\)\); \}/, 'the round is not solved exactly when every space under the ribbon is counted');
    need('count', /var e = pick\(GAME_COUNT\), n = e\.b - e\.a,/, 'the count is not b − a');
    need('count', /addZone\(B, countTickX\(e\.a\), COUNT_RIB\.y, n \* R\.unit, COUNT_RIB\.h, 'gribbon'\);/, 'the ribbon is not drawn from a to b');
    need('count', /for \(var k = 1; k <= R\.max; k\+\+\)/, 'not every space of the ruler is a button');
    if (!(D.GAME_COUNT.length >= 4)) fail('GAME_COUNT should have at least 4 entries');
    D.GAME_COUNT.forEach((e, i) => {
      const w = 'GAME_COUNT[' + i + ']', n = e.b - e.a;
      if (!(Number.isInteger(e.a) && Number.isInteger(e.b))) return fail(w + ' is not whole numbers');
      if (e.a < 1) fail(w + ': the ribbon starts on 0 — this round is about a ribbon that does NOT start at 0');
      if (e.b > R.max) fail(w + ': the ribbon runs off the 0~' + R.max + ' ruler');
      if (n < 2) fail(w + ': only ' + n + ' space(s) to count');
      /* 照遊戲的規則：點每一格；只有 a < k ≤ b 的格子算 —— 數完就是 b − a */
      let seen = 0, outside = 0;
      for (let k = 1; k <= R.max; k++){ if (k <= e.a || k > e.b) outside++; else seen++; }
      if (seen !== n) fail(w + ': ' + seen + ' spaces under the ribbon, should be ' + n);
      if (!outside) fail(w + ': every space is under the ribbon');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gCountDone ' + L, d.gCountDone(e.a, e.b, n), [e.a, e.b, n, e.b, e.a, n, n + 1]);
        for (let left = 1; left <= n; left++) seq(w + ' gCount2 ' + L, d.gCount2(e.a, e.b, left), [e.a, e.b, left]);
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      for (let m = 0; m <= R.max; m++) seq('gCountNow(' + m + ') ' + L, d.gCountNow(m), [m]);
      seq('gCountOut ' + L, d.gCountOut, []);
    });
    if (I18N.en.gCountNow(1) !== 'Counted 1 space' || I18N.en.gCountNow(2) !== 'Counted 2 spaces') fail('en: "1 space" must be singular, others plural');
    if (!/ 1 space /.test(I18N.en.gCount2(1, 4, 1) + ' ') || !/ 2 spaces /.test(I18N.en.gCount2(1, 4, 2) + ' ')) fail('en gCount2: "1 space" must be singular, others plural');
  }

  /* ================= 第 3 關：接成 1 公尺（範例 3：100 公分接成 1 公尺） ================= */
  {
    const Tr = D.BUILD_TRACK, H = D.BUILD_H, K = D.BUILD_TOK;
    if (D.BUILD_PIECES.join() !== '10,1') fail('build: the pieces should be a 10 cm stick and a 1 cm cube, got ' + D.BUILD_PIECES.join());
    inside({ x:Tr.x, y:Tr.y, w:Tr.w, h:Tr.h }, 'build: the frame', W, H);
    if (!(D.BUILD_BAR <= Tr.h - 6)) fail('build: the built bar (' + D.BUILD_BAR + ') does not fit in the frame');
    const toks = D.BUILD_PIECES.map((p, i) => box(W / 2 + (i - 0.5) * K.step, K.y, K.w, K.h));
    toks.forEach((t, i) => { inside(t, 'build: source ' + i, W, H); if (hit(t, pad({ x:Tr.x, y:Tr.y, w:Tr.w, h:Tr.h }, D.GPAD))) fail('build: source ' + i + ' sits inside the frame\'s drop zone'); });
    noHits(toks, 'build: sources');
    if (!(Tr.y + Tr.h + 6 + 18 <= K.y - K.h / 2)) fail('build: the "100" label runs into the sources');
    need('build', /var e = pick\(GAME_BUILD\), T = e\.m \* 100 \+ e\.c,/, 'the target is not m × 100 + c');
    need('build', /if \(!nearestOpen\(\[track\], pt, GPAD\)\) return false;/, 'a drop outside the frame is not silent');
    need('build', /var p = P\.data\.p, n = now\(\);\s*if \(n \+ p > T\)\{ roundMiss\(d\.gBuildOver\(n, p, T\)\); return false; \}/, 'a piece that makes it longer than the target is accepted');
    need('build', /if \(p === 10\) sticks\+\+; else cubes\+\+;/, 'a placed piece does not add its length');
    need('build', /function now\(\)\{ return sticks \* 10 \+ cubes; \}/, 'the length is not 10 × sticks + cubes');
    need('build', /meters = Math\.floor\(sticks \/ 10\), i;\s*for \(i = 0; i < meters; i\+\+\)\{ segs\.push\(addZone\(B, x, y, 100 \* Tr\.px, BUILD_BAR, 'gmeter', d\.gMeterLbl\)\);/, 'ten sticks are not drawn as one metre bar');
    need('build', /if \(p === 10 && sticks === 10\) roundInfo\(d\.gBuildMeter\);/, 'the tenth stick does not say 100 cm = 1 m');
    need('build', /if \(n === 0\)\{ gMsg\.textContent = d\.gBuildEmpty; return; \}/, 'Done with nothing built is treated as a mistake (it should only remind)');
    need('build', /if \(n < T\)\{ roundMiss\(d\.gBuildShort\(n, e\.m, e\.c, T\)\); return; \}\s*doneBtn\.disabled = true;\s*roundSolved\(d\.gBuildDone\(e\.m, e\.c, T\)\);/, 'Done is accepted before the ribbon is the full length');
    need('build', /P\.home\(\);/, 'a source does not go back after a drop (it must never run out)');
    /* 拼到剛好也不會自己過關：要自己按「做好了」（停在哪裡就是這一關要孩子決定的事） */
    { const drop = (B.build.match(/useTapSelect\(B, function\(P, pt\)\{([\s\S]*?)\n {6}\}\);/) || [])[1];
      if (!drop) fail('build: cannot cut the drop handler'); else if (/roundSolved/.test(drop)) fail('build: the round is solved by a drop — the child must press Done'); }
    const px = Tr.px;
    let sawSmall = false, sawBig = false;
    if (!(D.GAME_BUILD.length >= 4)) fail('GAME_BUILD should have at least 4 entries');
    D.GAME_BUILD.forEach((e, i) => {
      const w = 'GAME_BUILD[' + i + ']', T = cmOf(e);
      if (e.m !== 1) fail(w + ': ' + e.m + ' m — the frame holds 1 m and a bit');
      if (!(e.c >= 1 && e.c <= 39)) fail(w + ': ' + e.c + ' cm on top of the metre');
      if (e.c < 10) sawSmall = true; else sawBig = true;
      if (!(Tr.pad + T * px <= Tr.w - Tr.pad / 2)) fail(w + ': ' + T + ' cm (' + T * px + 'px) does not fit in the frame');
      /* 照遊戲的規則玩一遍：先放 10 公分、放不下了再放 1 公分；每一步都不能超過，到 T 才按「做好了」 */
      let sticks = 0, cubes = 0, guard = 0;
      const now = () => sticks * 10 + cubes;
      while (now() < T && guard++ < 200){ if (now() + 10 <= T) sticks++; else if (now() + 1 <= T) cubes++; }
      if (now() !== T) fail(w + ': the greedy build ends at ' + now() + ', not ' + T);
      if (sticks < 10) fail(w + ': never reaches the metre');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gBuildOrder ' + L, d.gBuildOrder(e.m, e.c), [e.m, e.c]);
        seq(w + ' gBuildDone ' + L, d.gBuildDone(e.m, e.c, T), [e.m, e.c, e.m * 100, e.c, T]);
        for (let n = 1; n < T; n++){
          seq(w + ' gBuildShort(' + n + ') ' + L, d.gBuildShort(n, e.m, e.c, T), [n, e.m, e.c, e.m * 100, e.c, T, T - n]);
          seq(w + ' gBuild2(' + n + ') ' + L, d.gBuild2(e.m, e.c, T, n), [e.m, e.c, T, n, T - n]);
        }
        for (let n = T - 9; n <= T; n++) seq(w + ' gBuildOver ' + L, d.gBuildOver(n, 10, T), [10, n + 10, T]);
        seq(w + ' gBuildOver ' + L, d.gBuildOver(T, 1, T), [1, T + 1, T]);
      });
    });
    if (!sawSmall) fail('GAME_BUILD needs a "1 m and a few cm" entry (the 1 m 5 cm → 15 cm mistake)');
    if (!sawBig) fail('GAME_BUILD needs a "1 m and tens of cm" entry');
    LANGS.forEach(L => {
      const d = I18N[L];
      seq('gBuildMeter ' + L, d.gBuildMeter, [10, 10, 100, 1]);
      for (let n = 0; n <= 139; n++) seq('gBuildNow ' + L, d.gBuildNow(n), [n]);
      seq('gMeterLbl ' + L, d.gMeterLbl, [1]);
      if (/\d/.test(d.gBuildBtn)) fail('gBuildBtn ' + L + ' has a number');
    });
  }

  /* ================= 第 4 關：剪一刀（範例 4：剪掉用減的；1 公尺先換成 100 公分） ================= */
  {
    const C = D.CUT_ROPE, H = D.CUT_H, P = D.CUT_PAD, S = D.CUT_SCI;
    for (let cm = 0; cm <= 100; cm += 10) if (!near(D.cutX(cm), C.x + cm * C.px)) fail('cutX(' + cm + ') should be ' + (C.x + cm * C.px));
    const pitch = 10 * C.px;
    if (!(pitch < 2 * P)) fail('cut: notches ' + pitch + ' apart with pads of ' + P + ' — the pads no longer overlap, the nearest-notch rule is never exercised');
    if (!(pitch >= P)) fail('cut: notches too close for the pad');
    if (!(28 <= pitch + 4)) fail('cut: notch labels (28 wide) run into each other at ' + pitch + 'px');
    const cy = C.y + C.h / 2;
    if (!(S.y - S.size / 2 > cy + C.band + P)) fail('cut: the scissors start inside the cutting band');
    if (!(C.numY >= C.y + C.h + 6)) fail('cut: the notch numbers sit on the string');
    if (!(C.offY > C.numY + 16)) fail('cut: the piece that falls off lands on the numbers');
    if (!(S.placed <= S.size)) fail('cut: the placed scissors should not grow');
    if (!(cy - S.placed / 2 >= 60 && cy + S.placed / 2 <= C.numY + 2)) fail('cut: the placed scissors cover the task or the numbers');
    need('cut', /if \(k > 0 && k < e\.s \/ 10\) marks\.push\(\{ cx:x, cy:cy, hw:0, hh:C\.band, at:k \* 10, done:false \}\);/, 'the targets are not the inner notches (the two ends cut nothing)');
    need('cut', /var m = nearestOpen\(marks, pt, CUT_PAD\);\s*if \(!m\) return false;/, 'a drop away from the notches is not silent');
    need('cut', /if \(m\.at !== keep\)\{ roundMiss\(d\.gCutWrong\(m\.at, e\.s, e\.c\)\); return false; \}/, 'a cut at the wrong notch is accepted');
    need('cut', /var e = pick\(GAME_CUT\), C = CUT_ROPE, keep = e\.s - e\.c,/, 'the cut is not at s − c');
    need('cut', /P\.lock\(m\.cx, cy\);[\s\S]*?roundSolved\(d\.gCutDone\(e\.s, e\.c\)\);/, 'the scissors are not locked on the notch, or the round is not solved there');
    need('cut', /rope\.style\.width = \(keep \* C\.px\) \+ 'px';\s*addZone\(B, cutX\(keep\) \+ 6, C\.offY, e\.c \* C\.px, C\.h, 'grope off'\);/, 'the drawn string is not cut into keep and c');
    if (!(D.GAME_CUT.length >= 4)) fail('GAME_CUT should have at least 4 entries');
    let saw100 = false;
    D.GAME_CUT.forEach((e, i) => {
      const w = 'GAME_CUT[' + i + ']', keep = e.s - e.c;
      if (!(e.s % 10 === 0 && e.c % 10 === 0 && e.s <= 100 && e.s >= 50)) return fail(w + ': the string and the cut must be whole tens, string 50~100 cm');
      if (e.s === 100) saw100 = true;
      if (!(e.c >= 20 && keep >= 20)) fail(w + ': cut ' + e.c + ' leaves ' + keep + ' — both pieces need at least two notches (and keep − 10 must be a notch for the overlap test)');
      if (e.c === keep) fail(w + ': cutting at ' + e.c + ' is also right — the "cut from the wrong end" mistake cannot happen');
      inside({ x:C.x, y:C.y, w:e.s * C.px, h:C.h }, w + ' the string', W, H);
      inside({ x:C.x + keep * C.px + 6, y:C.offY, w:Math.max(e.c * C.px, 90), h:C.h + 20 }, w + ' the piece that falls off + its label', W, H);
      for (let k = 0; k <= e.s / 10; k++) inside({ x:C.x + k * pitch - 14, y:C.numY, w:28, h:16 }, w + ' notch number ' + k * 10, W, H);
      /* 照遊戲的規則：把剪刀沿著繩子放在每一個位置 —— 收得下的只有 s − c，其他每一刀說的「右邊剪掉的」都是真的 */
      const marks = [];
      for (let k = 1; k < e.s / 10; k++) marks.push({ cx:C.x + k * pitch, cy, hw:0, hh:C.band, at:k * 10, done:false });
      if (nearestOpen){
        let ok = 0, bad = 0;
        for (let x = C.x - P - 2; x <= C.x + e.s * C.px + P + 2; x += 0.25){
          const g = nearestOpen(marks, { x, y:cy }, P);
          let want = null, bd = Infinity;
          marks.forEach(m => { const dd = Math.abs(x - m.cx); if (dd <= P && dd < bd){ bd = dd; want = m.at; } });
          if ((g ? g.at : null) !== want) bad++;
          if (g && g.at === keep) ok++;
        }
        if (bad) fail(w + ': nearestOpen() gives ' + bad + ' positions to the wrong notch — it must pick the nearest');
        if (!ok) fail(w + ': no position cuts at ' + keep);
        if (nearestOpen(marks, { x:C.x + keep * C.px, y:S.y }, P) !== null) fail(w + ': the scissors at home already count as a cut');
      }
      marks.forEach(m => {
        if (m.at === keep) return;
        if (e.s - m.at === e.c) fail(w + ': cutting at ' + m.at + ' also takes off ' + e.c);
        LANGS.forEach(L => seq(w + ' gCutWrong(' + m.at + ') ' + L, I18N[L].gCutWrong(m.at, e.s, e.c), [m.at, e.s - m.at, e.c]));
      });
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gCutTask ' + L, d.gCutTask(e.s, e.c), e.s === 100 ? [1, e.c] : [e.s, e.c]);
        if (e.s === 100) has(w + ' gCutTask ' + L, d.gCutTask(e.s, e.c), L === 'zh' ? /1 公尺/ : /1 m /);
        seq(w + ' gCutDone ' + L, d.gCutDone(e.s, e.c), (e.s === 100 ? [1, 100] : []).concat([e.c, e.s, e.c, keep, keep]));
        seq(w + ' gCutNow ' + L, d.gCutNow(e.s, e.c), [e.s, e.c, keep]);
        seq(w + ' gCut2 ' + L, d.gCut2(e.s, e.c), [e.c / 10, keep]);
        seq(w + ' gCutOff ' + L, d.gCutOff(e.c), [e.c]);
      });
    });
    if (!saw100) fail('GAME_CUT needs a 1 m string (the metre has to be turned into 100 cm)');
    seq('gCutAsk zh', I18N.zh.gCutAsk, []); seq('gCutAsk en', I18N.en.gCutAsk, []);
    if (!/1 piece/.test(I18N.en.gCut2(100, 10)) || !/3 pieces/.test(I18N.en.gCut2(100, 30))) fail('en gCut2: "1 piece" singular, others plural');
  }

  /* ================= 第 5 關：排長短（單位不一樣先換成公分） ================= */
  {
    const S = D.RANK_SLOT, Cd = D.RANK_CARD, H = D.RANK_H;
    const slots = S.x.map(x => ({ x:x - S.w / 2, y:S.y - S.h / 2, w:S.w, h:S.h }));
    slots.forEach((r, k) => inside(r, 'rank: box ' + (k + 1), W, H));
    noHits(slots, 'rank: boxes');
    const x0 = (W - 3 * Cd.step) / 2, cards = [0, 1, 2, 3].map(i => box(x0 + i * Cd.step, Cd.y, Cd.w, Cd.h));
    cards.forEach((r, i) => { inside(r, 'rank: card ' + (i + 1), W, H); slots.forEach(sl => { if (hit(r, pad(sl, D.GPAD))) fail('rank: card ' + (i + 1) + ' sits inside a drop zone'); }); });
    noHits(cards, 'rank: cards');
    need('rank', /order = set\.slice\(\)\.sort\(function\(a, b\)\{ return lenCm\(a\) - lenCm\(b\); \}\)/, 'the target order is not shortest first by centimetres');
    need('rank', /var s = nearestOpen\(slots, pt, GPAD\), v = P\.data\.v;\s*if \(!s\) return false;\s*var c = order\[s\.k\];/, 'a box is not picked as the nearest, or box k does not want the k-th shortest');
    need('rank', /if \(v !== c\)\{ roundMiss\(lenCm\(v\) > lenCm\(c\) \? d\.gRankBig\(v, c\) : d\.gRankSmall\(v, c\)\); return false; \}/, 'a card is accepted in the wrong box, or the reason compares the wrong way round');
    need('rank', /s\.done = true; P\.lock\(s\.cx, s\.cy\);/, 'a card in its box is not marked done');
    need('rank', /if \(slots\.every\(function\(x\)\{ return x\.done; \}\)\) roundSolved\(d\.gRankDone\(order\)\);/, 'the round is not solved exactly when all four boxes are filled');
    need('rank', /renderTray\(B, set\.map\(lenCm\), RANK_CARD\.y,/, 'the cards are not shuffled by their centimetres (objects cannot be compared, so the not-in-order guard would never fire)');
    /* 卡片上的字放得下：CSS 的 .glen 字級；中文字 1 em、數字與英文字母約 0.6 em、空白約 0.3 em */
    const fs = +((src.match(/\.glen\{ font-size:(\d+)px/) || [])[1]);
    if (!fs) fail('rank: cannot read the .glen font size');
    const textW = t => [...t].reduce((s, ch) => s + (/[一-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6) * fs, 0);
    /* nearestOpen() 在四格上：格子裡判給那一格、縫裡判給比較近的那一格 */
    if (nearestOpen){
      const list = slots.map((r, i) => ({ id:i, cx:r.x + r.w / 2, cy:r.y + r.h / 2, hw:r.w / 2, hh:r.h / 2, done:false }));
      let bad = 0, gapBad = 0;
      list.forEach((b, i) => {
        for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1.5) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, D.GPAD); if (!g || g.id !== i) bad++; }
        if (i + 1 < list.length){
          const r = slots[i].x + slots[i].w, l = slots[i + 1].x;
          if (!(l - r < 2 * D.GPAD)) fail('rank: the boxes are ' + (l - r) + ' apart — the drop pads no longer overlap, the nearest-box rule is never exercised');
          for (let x = r + 0.25; x < l; x += 0.5){ const want = x - r < l - x ? i : i + 1, g = nearestOpen(list, { x, y:b.cy }, D.GPAD); if (x - r !== l - x && (!g || g.id !== want)) gapBad++; }
        }
      });
      if (bad) fail('rank: nearestOpen() gives ' + bad + ' points inside a box to another box');
      if (gapBad) fail('rank: nearestOpen() gives ' + gapBad + ' points between two boxes to the farther box');
      const done = list.map((b, i) => Object.assign({}, b, { done:i === 1 }));
      if (nearestOpen(done, { x:done[1].cx + done[1].hw - 0.5, y:done[1].cy }, D.GPAD) !== null) fail('rank: a drop on a filled box is moved into its neighbour');
    }
    if (!(D.GAME_RANK.length >= 4)) fail('GAME_RANK should have at least 4 entries');
    D.GAME_RANK.forEach((set, i) => {
      const w = 'GAME_RANK[' + i + ']';
      if (set.length !== 4) return fail(w + ' should have 4 lengths');
      const cms = set.map(cmOf);
      cms.forEach((v, j) => { if (!near(D.lenCm(set[j]), v)) fail(w + ': lenCm() of item ' + j + ' is ' + D.lenCm(set[j]) + ', should be ' + v); });
      if (new Set(cms).size !== 4) fail(w + ': two lengths are the same (' + cms.join(',') + ')');
      if (!cms.every(v => v >= 1 && v <= 300)) fail(w + ': a length outside 1~300 cm (' + cms.join(',') + ')');
      set.forEach((v, j) => { if ((v.c !== undefined && !(v.c >= 1 && v.c <= 299)) || (v.m !== undefined && !(v.m >= 1 && v.m <= 3)) || (v.m && v.c >= 100)) fail(w + ': item ' + j + ' is not a proper length ' + JSON.stringify(v)); });
      if (!set.some(v => v.m && v.c)) fail(w + ': no "m and cm" card');
      if (!set.some(v => v.m && !v.c)) fail(w + ': no whole-metre card (2 m, 1 m …)');
      /* 這一關要擋的迷思：只比數字。要有一張「公分的數字比某一張公尺的數字大、其實比較短」 */
      const trap = set.some(a => !a.m && set.some(b => b.m && a.c > b.m && cmOf(a) < cmOf(b)));
      if (!trap) fail(w + ': no card whose centimetre number is bigger but which is shorter — comparing the numbers alone would still sort it right');
      /* 只比「第一個數字」的排法一定要排錯 —— 不然這一組沒有在教 */
      const naive = set.slice().sort((a, b) => (a.m || a.c) - (b.m || b.c)).map(cmOf), order = cms.slice().sort((a, b) => a - b);
      if (naive.join() === order.join()) fail(w + ': sorting by the first number already gives the right order');
      /* 照遊戲的規則：第 k 格只收第 k 短的；每一張放進每一個錯的格子，說的話逐個比數字、而且說得對 */
      const ord = set.slice().sort((a, b) => cmOf(a) - cmOf(b));
      LANGS.forEach(L => {
        const d = I18N[L];
        set.forEach(v => {
          const lines = d.lenCard(v).split('\n');
          lines.forEach(t => { if (textW(t) > Cd.w - 6) fail(w + ' ' + L + ': card line "' + t + '" is about ' + textW(t).toFixed(0) + 'px, the card is ' + Cd.w); });
          if (cmOf(v) !== (() => { const t = d.len(v); const m = t.match(L === 'zh' ? /(\d+) 公尺/ : /(\d+) m\b/), c = t.match(L === 'zh' ? /(\d+) 公分/ : /(\d+) cm\b/); return (m ? +m[1] * 100 : 0) + (c ? +c[1] : 0); })()) fail(w + ' ' + L + ': len() writes ' + d.len(v) + ' for ' + JSON.stringify(v));
          if (d.lenCard(v).replace('\n', ' ') !== d.len(v)) fail(w + ' ' + L + ': the card text and len() differ');
        });
        const conv = v => v.m ? [v.m].concat(v.c ? [v.c] : []).concat([cmOf(v)]) : [];
        ord.forEach((want, k) => set.forEach(v => {
          if (v === want) return;
          const longer = cmOf(v) > cmOf(want);
          const t = longer ? d.gRankBig(v, want) : d.gRankSmall(v, want);
          const L1 = longer ? v : want, S1 = longer ? want : v;
          seq(w + ' ' + L + ' put ' + cmOf(v) + ' in box ' + (k + 1), t, conv(L1).concat(conv(S1)).concat([cmOf(L1), cmOf(S1)]));
          has(w + ' ' + L + ' put ' + cmOf(v) + ' in box ' + (k + 1), t, longer ? (L === 'zh' ? /比較短的/ : /shorter/) : (L === 'zh' ? /比較長的/ : /longer/));
          has(w + ' ' + L + ' put ' + cmOf(v) + ' in box ' + (k + 1), t, L === 'zh' ? /公分比 \d+ 公分長/ : /cm is longer than \d+ cm/);
          /* 有公尺的那一張一定要先換成公分（自己的寫法，不呼叫頁面的 len()） */
          [L1, S1].filter(x => x.m).forEach(x => {
            const own = L === 'zh' ? (x.c ? x.m + ' 公尺 ' + x.c + ' 公分' : x.m + ' 公尺') + ' 是 ' + cmOf(x) + ' 公分' : (x.c ? x.m + ' m ' + x.c + ' cm' : x.m + ' m') + ' is ' + cmOf(x) + ' cm';
            if (t.indexOf(own) < 0) fail(w + ' ' + L + ': rankWhy omitted metre conversion "' + own + '" — ' + t);
          });
        }));
        seq(w + ' gRankDone ' + L, d.gRankDone(ord), [].concat.apply([], ord.map(v => [v.m, v.c].filter(x => x))));
        ord.forEach((v, k) => seq(w + ' gRank2 ' + L, d.gRank2(k, v), [k + 1, k + 1].concat([v.m, v.c].filter(x => x)).concat(v.m ? [cmOf(v)] : [])));
      });
    });
    /* shuffle()：托盤一開始不可以已經由短排到長（四張有 1/24 的機會）。用「一定洗回原樣」的假亂數跑每一組，再用真亂數跑 2000 次 */
    {
      const fsrc = extractFunction(src, 'shuffle');
      if (!fsrc) fail('cannot find shuffle() in index.html');
      else {
        try {
          const fake = Object.create(Math); fake.random = () => 0.999999;
          const forced = new Function('Math', fsrc + '\nreturn shuffle;')(fake);
          const real = new Function(fsrc + '\nreturn shuffle;')();
          const up = a => a.every((v, j) => j === 0 || a[j - 1] < v);
          D.GAME_RANK.forEach((set, i) => {
            const sorted = set.map(cmOf).sort((a, b) => a - b);
            const out = forced(sorted);
            if (up(out) || out.slice().sort((a, b) => a - b).join() !== sorted.join()) fail('GAME_RANK[' + i + ']: shuffle() of an already sorted tray leaves it sorted (' + out.join(',') + ')');
            for (let r = 0; r < 2000; r++){ const o = real(set.map(cmOf)); if (up(o)){ fail('GAME_RANK[' + i + ']: shuffle() produced a tray already in order'); break; } }
          });
        } catch (e){ fail('shuffle() could not run: ' + e.message); }
      }
    }
    LANGS.forEach(L => { seq('gRankArrow ' + L, I18N[L].gRankArrow, []); });
  }


  /* ================= 每一關的 RENDER 函式本體「真的跑」（codex 第一輪：need() 只證明那一行寫著）=================
     把 RENDER.<關> 的原始碼切出來，放進一個假的 DOM 裡執行：makeBoard／addZone／addPiece／useTapSelect／actionButton
     換成記錄用的替身，target()／drawRuler()／nearestOpen()／renderTray()／shuffle() 用頁面自己的原始碼。
     然後照遊戲的規則對每一題做每一種動作（每一個放開的位置、每一格、每一張卡），看頁面自己的程式收不收、說什麼、
     畫板開多高、什麼時候過關。 */
  const EXEC = (() => {
    const fns = ['target', 'drawRuler', 'nearestOpen', 'renderTray', 'shuffle'].map(n => {
      const f = extractFunction(src, n); if (!f) fail('exec: cannot cut ' + n + '() out of index.html'); return f || '';
    }).join('\n');
    const decl = Object.keys(D).map(k => 'var ' + k + ' = D.' + k + ';').join('\n');
    const stub = `
      var LOG = { miss:[], solved:[], info:[], zones:[], pieces:[], created:[], board:null, line:null, drop:null, action:null, kept:0 };
      function el(){ var o = { style:{}, textContent:'', innerHTML:'', children:[], disabled:false, cls:{},
        classList:{ add:function(c){ o.cls[c] = true; }, remove:function(c){ delete o.cls[c]; }, contains:function(c){ return !!o.cls[c]; } },
        appendChild:function(x){ o.children.push(x); return x; }, setAttribute:function(){}, remove:function(){ o.removed = true; },
        addEventListener:function(t, f){ o['on' + t] = f; } }; return o; }
      var document = { createElement:function(tag){ var e = el(); e.tag = tag; LOG.created.push(e); return e; } };
      var gameStage = el(), gMsg = el(), gSolved = false, gCtx = {}, gMistakes = 0;
      function pick(arr){ return arr[PICK]; }
      function makeBoard(W, H){ LOG.board = { W:W, H:H }; return { el:el(), W:W, k:1, selected:null }; }
      function addZone(B, x, y, w, h, cls, text){ var z = el(); z.x = x; z.y = y; z.w = w; z.h = h; z.className = cls; if (text !== undefined) z.textContent = text; LOG.zones.push(z); return z; }
      function trailLine(text){ LOG.line = el(); LOG.line.textContent = text; return LOG.line; }
      function addPiece(B, o){ var P = { el:el(), w:o.w, h:o.h, homeX:o.cx, homeY:o.cy, cx:o.cx, cy:o.cy, locked:false, data:o.data || {}, text:o.text, cls:o.cls };
        P.place = function(x, y){ P.cx = x; P.cy = y; }; P.home = function(){ P.place(P.homeX, P.homeY); }; P.lock = function(x, y){ P.locked = true; P.place(x, y); };
        P.busy = function(){ return false; }; LOG.pieces.push(P); return P; }
      function useTapSelect(B, fn){ LOG.drop = fn; }
      function keepSelected(B, P){ LOG.kept++; }
      function roundMiss(t){ gMistakes++; LOG.miss.push(t); }
      function roundSolved(t){ if (gSolved) return; gSolved = true; LOG.solved.push(t); }
      function roundInfo(t){ LOG.info.push(t); }
      function refreshHint(){}
      function actionButton(text, f){ var b = el(); b.textContent = text; LOG.action = { b:b, f:f }; return b; }
    `;
    return (type, pickIdx, d) => {
      const code = decl + '\nvar PICK = ' + pickIdx + ';\n' + stub + fns + '\n(function(d){' + B[type] + '\n})(d);\nreturn { LOG:LOG, solved:function(){ return gSolved; }, misses:function(){ return gMistakes; }, msg:function(){ return gMsg.textContent; } };';
      try { return new Function('D', 'd', code)(D, d); }
      catch (e){ fail('exec: RENDER.' + type + ' could not run in the stub DOM: ' + e.message); return null; }
    };
  })();
  const live = z => !z.removed;
  /* 每一關一開始：畫板的高度就是那一關的 <TYPE>_H（版面檢查量的就是那個高度） */
  [['zero', 'ZERO_H'], ['count', 'COUNT_H'], ['build', 'BUILD_H'], ['cut', 'CUT_H'], ['rank', 'RANK_H']].forEach(([t, h]) => {
    const r = EXEC(t, 0, I18N.zh);
    if (r && !(r.LOG.board && r.LOG.board.W === W && r.LOG.board.H === D[h])) fail('exec: RENDER.' + t + ' opens a board of ' + JSON.stringify(r.LOG.board) + ', should be ' + W + ' × ' + h + ' (' + D[h] + ')');
  });

  /* --- 第 1 關（跑起來）：每一個左端的位置 --- */
  D.GAME_ZERO.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], R = D.ZERO_RULER, Pn = D.ZERO_PEN, P = D.ZERO_PAD, w = 'exec zero[' + i + '] ' + L, to = e.from + e.len;
    const lines = [{ x:R.x0 - R.edge, k:-1 }].concat(Array.from({ length:R.max + 1 }, (_, k) => ({ x:R.x0 + k * R.unit, k })));
    let r = EXEC('zero', i, d); if (!r) return;
    const pen0 = r.LOG.pieces[0];
    if (!pen0 || pen0.w !== e.len * R.unit || pen0.cx - pen0.w / 2 !== R.x0 + e.from * R.unit || pen0.cy !== Pn.y) return fail(w + ': the pencil is not drawn ' + e.len + ' cm long with its left end on ' + e.from);
    if (r.LOG.line.textContent !== d.gZeroAsk) fail(w + ': the line should ask, not answer: ' + r.LOG.line.textContent);
    let accepted = 0, bad = [];
    for (let x = R.x0 - R.edge - P - 3; x <= R.x0 + R.max * R.unit + P + 3; x += 0.5){
      let best = null, bd = Infinity;
      lines.forEach(l => { const dd = Math.abs(x - l.x); if (dd <= P && dd < bd){ bd = dd; best = l.k; } });
      const pen = r.LOG.pieces[0], m0 = r.LOG.miss.length;
      const got = r.LOG.drop(pen, { x:x + pen.w / 2, y:Pn.y });
      const said = r.LOG.miss.slice(m0);
      let want;
      if (best === null || best === e.from) want = { ok:false, said:[] };
      else if (best < 0) want = { ok:false, said:[d.gZeroEdge] };
      else if (best > 0) want = { ok:false, said:[d.gZeroTick(best)] };
      else want = { ok:true, said:[] };
      if (!!got !== want.ok || said.join('|') !== want.said.join('|')) bad.push(x + ' → ' + (got ? 'accepted' : 'bounced') + ' ' + JSON.stringify(said));
      if (got){
        accepted++;
        if (!(pen.locked && pen.cx - pen.w / 2 === R.x0)) bad.push('accepted at ' + x + ' but the left end is locked at ' + (pen.cx - pen.w / 2));
        if (r.LOG.solved.join() !== d.gZeroDone(e.from, to, e.len)) bad.push('solved with ' + JSON.stringify(r.LOG.solved));
        if (r.LOG.line.textContent !== d.gZeroNow(e.len)) bad.push('line ' + r.LOG.line.textContent);
        r = EXEC('zero', i, d);
      } else if (pen.locked || r.solved()) bad.push(x + ': bounced but the pencil is locked / the round solved');
    }
    if (bad.length) fail(w + ': ' + bad.length + ' left-end positions behave wrongly, e.g. ' + bad.slice(0, 3).join('; '));
    if (!accepted) fail(w + ': no left-end position is accepted');
    /* 點目的地：點的位置就是左端要去的地方；點在鉛筆帶的上面 → 不算 */
    r = EXEC('zero', i, d);
    if (r.LOG.drop(r.LOG.pieces[0], { x:R.x0 + 1, y:R.y + R.h / 2, tap:true }) !== true) fail(w + ': tap-then-tap on the 0 line (on the ruler) is not accepted');
    r = EXEC('zero', i, d);
    if (r.LOG.drop(r.LOG.pieces[0], { x:R.x0, y:Pn.y - Pn.band - P - 2, tap:true }) !== false || r.LOG.miss.length) fail(w + ': a tap above the pencil band is not silent');
    if (r.LOG.drop(r.LOG.pieces[0], { x:R.x0 + e.from * R.unit, y:Pn.y, tap:true }) !== false || r.LOG.miss.length) fail(w + ': a tap on the pencil\'s own starting line is not silent');
  }));

  /* --- 第 2 關（跑起來）：每一格點一下、點兩下、亂序點 --- */
  D.GAME_COUNT.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], R = D.COUNT_RULER, n = e.b - e.a, w = 'exec count[' + i + '] ' + L;
    const orders = [];
    const inside = []; for (let k = e.a + 1; k <= e.b; k++) inside.push(k);
    orders.push(inside.slice(), inside.slice().reverse(), inside.slice(1).concat(inside.slice(0, 1)));
    orders.forEach((ord, oi) => {
      const r = EXEC('count', i, d); if (!r) return;
      const cells = r.LOG.created.filter(c => c.tag === 'button' && typeof c.onclick === 'function');
      if (cells.length !== R.max) return fail(w + ': ' + cells.length + ' space buttons, should be ' + R.max);
      cells.forEach((c, j) => { if (c.style.left !== (R.x0 + j * R.unit) + 'px' || c.style.width !== R.unit + 'px') fail(w + ': space button ' + (j + 1) + ' is not at space ' + (j + 1)); });
      const rib = r.LOG.zones.filter(z => z.className === 'gribbon')[0];
      if (!rib || rib.x !== R.x0 + e.a * R.unit || rib.w !== n * R.unit) fail(w + ': the ribbon is not drawn from ' + e.a + ' to ' + e.b);
      /* 先點緞帶外面的每一格：每一下都說為什麼、什麼都不數 */
      for (let k = 1; k <= R.max; k++) if (k <= e.a || k > e.b){
        const m0 = r.LOG.miss.length; cells[k - 1].onclick();
        if (r.LOG.miss.length !== m0 + 1 || r.LOG.miss[m0] !== d.gCountOut) fail(w + ': tapping space ' + k + ' (outside) does not say why');
        if (cells[k - 1].classList.contains('counted') || r.LOG.line.textContent !== d.gCountNow(0)) fail(w + ': tapping space ' + k + ' (outside) counts something');
      }
      ord.forEach((k, j) => {
        const m0 = r.LOG.miss.length;
        cells[k - 1].onclick();
        if (r.LOG.miss.length !== m0) fail(w + ': tapping space ' + k + ' (under the ribbon) is a mistake');
        if (j < n - 1){
          if (r.LOG.line.textContent !== d.gCountNow(j + 1) || r.solved()) fail(w + ' order ' + oi + ': after ' + (j + 1) + ' taps the line says ' + r.LOG.line.textContent + (r.solved() ? ' and the round is solved' : ''));
          cells[k - 1].onclick();
          if (r.LOG.miss.length !== m0 || r.LOG.line.textContent !== d.gCountNow(j + 1)) fail(w + ': tapping a counted space again changes something');
        }
      });
      if (!r.solved() || r.LOG.solved.join() !== d.gCountDone(e.a, e.b, n)) fail(w + ' order ' + oi + ': not solved with gCountDone after the ' + n + ' spaces');
      if (r.LOG.line.textContent !== d.gCountNow(n) + ' → ' + d.cm(n)) fail(w + ': final line ' + r.LOG.line.textContent);
      const m1 = r.LOG.miss.length; cells.forEach(c => c.onclick());
      if (r.LOG.miss.length !== m1 || r.LOG.solved.length !== 1) fail(w + ': taps after the round is solved still do something');
    });
  }));

  /* --- 第 3 關（跑起來）：每一個長度 n、每一種棒子、每一次按「做好了」 --- */
  D.GAME_BUILD.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], Tr = D.BUILD_TRACK, T = cmOf(e), w = 'exec build[' + i + '] ' + L;
    const r = EXEC('build', i, d); if (!r) return;
    const tok = p => r.LOG.pieces.filter(P => P.data.p === p)[0];
    if (!tok(10) || !tok(1) || r.LOG.pieces.length !== 2) return fail(w + ': the sources are not one 10 cm and one 1 cm');
    if (tok(10).text !== d.cm(10) || tok(1).text !== d.cm(1)) fail(w + ': the source labels do not say 10 / 1 cm');
    if (!r.LOG.action) return fail(w + ': no Done button');
    const mid = { x:Tr.x + Tr.w / 2, y:Tr.y + Tr.h / 2 };
    const drawn = () => r.LOG.zones.filter(z => live(z) && /^(gmeter|gstick|gcubes)$/.test(z.className)).reduce((s, z) => s + z.w, 0) / Tr.px;
    /* 什麼都沒放就按：只提醒、不算錯 */
    r.LOG.action.f();
    if (r.LOG.miss.length || r.solved() || r.msg() !== d.gBuildEmpty) fail(w + ': Done with nothing built should only remind (got miss ' + r.LOG.miss.length + ', msg ' + r.msg() + ')');
    /* 框外面放開：不收、不算錯 */
    if (r.LOG.drop(tok(10), { x:Tr.x + Tr.w / 2, y:Tr.y + Tr.h + D.GPAD + 2 }) !== false || r.LOG.miss.length) fail(w + ': a drop below the frame is not silent');
    let n = 0, guard = 0, meterSaid = 0;
    while (n < T && guard++ < 300){
      /* 每一步：先試會超過的那一種（說為什麼、長度不變），再按一次「做好了」（還不夠：說還差多少），再放對的那一種 */
      [10, 1].forEach(p => { if (n + p > T){ const m0 = r.LOG.miss.length; if (r.LOG.drop(tok(p), Object.assign({}, mid)) !== false || r.LOG.miss[m0] !== d.gBuildOver(n, p, T) || drawn() !== n) fail(w + ': at ' + n + ' cm a ' + p + ' cm piece is not refused with gBuildOver'); } });
      if (n > 0){ const m0 = r.LOG.miss.length; r.LOG.action.f(); if (r.solved() || r.LOG.miss[m0] !== d.gBuildShort(n, e.m, e.c, T)) fail(w + ': Done at ' + n + ' cm is not refused with gBuildShort'); }
      const p = n + 10 <= T ? 10 : 1, tap = guard % 3 === 0, k0 = r.LOG.kept, i0 = r.LOG.info.length;
      if (r.LOG.drop(tok(p), Object.assign({ tap:tap }, mid)) !== true) { fail(w + ': at ' + n + ' cm a ' + p + ' cm piece is refused'); break; }
      n += p;
      if (r.solved()) fail(w + ': a drop solved the round at ' + n + ' cm (Done must be pressed)');
      if (drawn() !== n) fail(w + ': at ' + n + ' cm the drawn bar is ' + drawn() + ' cm');
      if (r.LOG.line.textContent !== d.gBuildNow(n)) fail(w + ': the line says ' + r.LOG.line.textContent + ' at ' + n + ' cm');
      if (tap && r.LOG.kept !== k0 + 1) fail(w + ': a tap placement does not keep the source selected');
      if (!tap && r.LOG.kept !== k0) fail(w + ': a drag placement keeps the source selected');
      if (r.LOG.info.length > i0){ meterSaid++; if (n !== 100 || r.LOG.info[i0] !== d.gBuildMeter) fail(w + ': at ' + n + ' cm it says ' + r.LOG.info[i0]); }
      const meters = r.LOG.zones.filter(z => live(z) && z.className === 'gmeter').length, sticks = r.LOG.zones.filter(z => live(z) && z.className === 'gstick').length;
      if (meters !== Math.floor(Math.floor(n / 10) / 10) || sticks !== Math.floor(n / 10) % 10) fail(w + ': at ' + n + ' cm the bar shows ' + meters + ' metre(s) and ' + sticks + ' stick(s)');
    }
    if (meterSaid !== 1) fail(w + ': "100 cm = 1 m" was said ' + meterSaid + ' times');
    /* 每一個長度 n（0～T）各開一局重來：先拼到 n，再分別試 1 公分、10 公分、「做好了」（codex 第二輪：上面那一條路只走貪心的一條） */
    const reach = n => {
      const q = EXEC('build', i, d); if (!q) return null;
      const t = p => q.LOG.pieces.filter(P => P.data.p === p)[0];
      for (let k = 0; k < Math.floor(n / 10); k++) q.LOG.drop(t(10), Object.assign({}, mid));
      for (let k = 0; k < n % 10; k++) q.LOG.drop(t(1), Object.assign({}, mid));
      return { q, t };
    };
    for (let n0 = 0; n0 <= T; n0++){
      const now = q => q.LOG.zones.filter(z => live(z) && /^(gmeter|gstick|gcubes)$/.test(z.className)).reduce((s, z) => s + z.w, 0) / Tr.px;
      [1, 10].forEach(p => {
        const h = reach(n0); if (!h) return;
        if (now(h.q) !== n0 || h.q.LOG.miss.length) return fail(w + ': could not build ' + n0 + ' cm');
        const got = h.q.LOG.drop(h.t(p), Object.assign({}, mid));
        if (n0 + p <= T){ if (got !== true || now(h.q) !== n0 + p || h.q.LOG.miss.length || h.q.solved()) fail(w + ': at ' + n0 + ' cm a ' + p + ' cm piece is not simply added'); }
        else if (got !== false || now(h.q) !== n0 || h.q.LOG.miss.join() !== d.gBuildOver(n0, p, T)) fail(w + ': at ' + n0 + ' cm a ' + p + ' cm piece is not refused with gBuildOver');
      });
      const h = reach(n0); if (!h) continue;
      h.q.LOG.action.f();
      if (n0 === 0){ if (h.q.LOG.miss.length || h.q.solved() || h.q.msg() !== d.gBuildEmpty) fail(w + ': Done at 0 cm does not just remind'); }
      else if (n0 < T){ if (h.q.solved() || h.q.LOG.miss.join() !== d.gBuildShort(n0, e.m, e.c, T)) fail(w + ': Done at ' + n0 + ' cm is not refused with gBuildShort'); }
      else if (!h.q.solved() || h.q.LOG.solved.join() !== d.gBuildDone(e.m, e.c, T) || h.q.LOG.miss.length) fail(w + ': Done at ' + T + ' cm does not solve the round');
    }
    if (n !== T) return fail(w + ': the build ended at ' + n);
    [10, 1].forEach(p => { const m0 = r.LOG.miss.length; if (r.LOG.drop(tok(p), Object.assign({}, mid)) !== false || r.LOG.miss[m0] !== d.gBuildOver(T, p, T)) fail(w + ': at the target a ' + p + ' cm piece is accepted'); });
    r.LOG.action.f();
    if (!r.solved() || r.LOG.solved.join() !== d.gBuildDone(e.m, e.c, T) || !r.LOG.action.b.disabled) fail(w + ': Done at ' + T + ' cm does not solve the round with gBuildDone');
  }));

  /* --- 第 4 關（跑起來）：剪刀放在繩子的每一個位置 --- */
  D.GAME_CUT.forEach((e, i) => LANGS.forEach(L => {
    const d = I18N[L], C = D.CUT_ROPE, P = D.CUT_PAD, keep = e.s - e.c, w = 'exec cut[' + i + '] ' + L, cy = C.y + C.h / 2;
    let r = EXEC('cut', i, d); if (!r) return;
    const task = r.LOG.zones.filter(z => z.className === 'gorder')[0];
    if (!task || task.textContent !== d.gCutTask(e.s, e.c)) fail(w + ': the task does not say gCutTask');
    const labels = r.LOG.zones.filter(z => z.className === 'gnum').map(z => +z.textContent);
    if (labels.join() !== Array.from({ length:e.s / 10 + 1 }, (_, k) => k * 10).join()) fail(w + ': the notch numbers read ' + labels.join());
    let ok = 0; const bad = [];
    for (let x = C.x - P - 3; x <= C.x + e.s * C.px + P + 3; x += 0.5){
      let best = null, bd = Infinity;
      for (let k = 1; k < e.s / 10; k++){ const dd = Math.abs(x - (C.x + k * 10 * C.px)); if (dd <= P && dd < bd){ bd = dd; best = k * 10; } }
      const sci = r.LOG.pieces[0], m0 = r.LOG.miss.length;
      const got = r.LOG.drop(sci, { x, y:cy });
      const said = r.LOG.miss.slice(m0).join('|');
      const want = best === null ? '' : best === keep ? '' : d.gCutWrong(best, e.s, e.c);
      if (!!got !== (best === keep) || said !== want) bad.push(x + ' → ' + (got ? 'cut' : 'bounced') + ' ' + said);
      if (got){
        ok++;
        const rope = r.LOG.zones.filter(z => z.className === 'grope')[0], off = r.LOG.zones.filter(z => z.className === 'grope off')[0];
        if (!(sci.locked && Math.abs(sci.cx - (C.x + keep * C.px)) < 1e-9 && rope.style.width === (keep * C.px) + 'px' && off && off.w === e.c * C.px)) bad.push('cut at ' + x + ' does not leave ' + keep + ' + ' + e.c);
        if (r.LOG.solved.join() !== d.gCutDone(e.s, e.c) || r.LOG.line.textContent !== d.gCutNow(e.s, e.c)) bad.push('solved/line text wrong');
        r = EXEC('cut', i, d);
      }
    }
    if (bad.length) fail(w + ': ' + bad.length + ' positions behave wrongly, e.g. ' + bad.slice(0, 3).join('; '));
    if (!ok) fail(w + ': no position cuts at ' + keep);
    r = EXEC('cut', i, d);
    if (r.LOG.drop(r.LOG.pieces[0], { x:C.x + keep * C.px, y:cy + C.band + P + 2, tap:true }) !== false || r.LOG.miss.length) fail(w + ': a tap below the cutting band is not silent');
  }));

  /* --- 第 5 關（跑起來）：每一張卡放進每一格 --- */
  D.GAME_RANK.forEach((set, i) => LANGS.forEach(L => {
    const d = I18N[L], S = D.RANK_SLOT, w = 'exec rank[' + i + '] ' + L;
    const r = EXEC('rank', i, d); if (!r) return;
    const cards = r.LOG.pieces, ord = set.slice().sort((a, b) => cmOf(a) - cmOf(b));
    if (cards.length !== 4 || cards.map(P => cmOf(P.data.v)).sort((a, b) => a - b).join() !== ord.map(cmOf).join()) return fail(w + ': the tray does not hold the four lengths');
    cards.forEach(P => { if (P.text !== d.lenCard(P.data.v)) fail(w + ': a card reads ' + JSON.stringify(P.text)); });
    /* 每一張卡 × 每一格，各開一局重來（四格都還空著）：只有第 k 短的收進第 k 格（codex 第二輪：依序放的話後面的格子試到的錯卡越來越少） */
    ord.forEach((want, k) => set.forEach(v => {
      const q = EXEC('rank', i, d); if (!q) return;
      const P = q.LOG.pieces.filter(x => x.data.v === v)[0];
      if (!P) return fail(w + ': no card ' + JSON.stringify(v));
      const got = q.LOG.drop(P, { x:S.x[k], y:S.y });
      if (v === want){ if (got !== true || !P.locked || q.LOG.miss.length) fail(w + ': ' + cmOf(v) + ' is refused in an empty box ' + (k + 1)); }
      else {
        const why = cmOf(v) > cmOf(want) ? d.gRankBig(v, want) : d.gRankSmall(v, want);
        if (got !== false || P.locked || q.LOG.miss.join() !== why) fail(w + ': ' + cmOf(v) + ' in the empty box ' + (k + 1) + ' is not refused with the right reason');
      }
    }));
    const trayOrder = cards.slice().sort((a, b) => a.homeX - b.homeX).map(P => cmOf(P.data.v));
    if (trayOrder.every((v, j) => j === 0 || trayOrder[j - 1] < v)) fail(w + ': the tray starts already in order');
    S.x.forEach((x, k) => {
      cards.forEach(P => {
        if (P.locked || P.data.v === ord[k]) return;
        const m0 = r.LOG.miss.length, want = cmOf(P.data.v) > cmOf(ord[k]) ? d.gRankBig(P.data.v, ord[k]) : d.gRankSmall(P.data.v, ord[k]);
        if (r.LOG.drop(P, { x, y:S.y }) !== false || r.LOG.miss[m0] !== want) fail(w + ': ' + cmOf(P.data.v) + ' in box ' + (k + 1) + ' is not refused with the right reason');
      });
      const right = cards.filter(P => P.data.v === ord[k])[0];
      if (!right) return fail(w + ': no card in the tray is ' + JSON.stringify(ord[k]));
      if (r.LOG.drop(right, { x, y:S.y }) !== true || !right.locked) fail(w + ': ' + cmOf(ord[k]) + ' is refused in box ' + (k + 1));
      if (k < 3 && r.solved()) fail(w + ': solved after only ' + (k + 1) + ' boxes');
      /* 放在已經放好的格子上：不收、不算錯（§六之五第 3 點：放到已經放好的位置也是靜靜彈回） */
      const other = cards.filter(P => !P.locked)[0];
      if (other){ const m1 = r.LOG.miss.length; if (r.LOG.drop(other, { x, y:S.y }) !== false || r.LOG.miss.length !== m1) fail(w + ': a drop on the filled box ' + (k + 1) + ' is not silent'); }
    });
    if (!r.solved() || r.LOG.solved.join() !== d.gRankDone(ord)) fail(w + ': not solved with gRankDone after four boxes');
    if (r.LOG.line.textContent !== ord.map(v => d.len(v)).join(' < ')) fail(w + ': the line says ' + r.LOG.line.textContent);
  }));

  /* --- 每一關的狀態前進：讓這一關往前走的那一行（改掉就玩不完，但上面的字面掃描未必看得到） --- */
  need('zero', /P\.el\.classList\.add\('placed'\);\s*line\.textContent = d\.gZeroNow\(e\.len\);/, 'the line does not show the reading after the pencil is on 0');
  need('cut', /line\.textContent = d\.gCutNow\(e\.s, e\.c\);/, 'the line does not show s − c after the cut');
  need('rank', /line\.textContent = shown\(\);/, 'the line does not show the boxes filled so far');
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/length */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'the same real length',
      find:'      if (ok(c)){ seen[cmOf(c)] = true; out.push(c); }',
      replace:'      if (c !== null && c !== undefined){ out.push(c); }' },
    { file:'review', expect:'copied straight out of the stem',
      find:'      if (ban.indexOf(cmOf(v)) >= 0) return false;',
      replace:'      if (ban.indexOf(cmOf(v)) >= 0 && false) return false;' },
    /* review.html 的 cmOf 只被「去重」和「compareLength 選最大」用到 ——
       設定檔的不變條件有自己一套 cmOf，所以這一條的觀察點是比長短那一題。 */
    { file:'review', expect:'the correct option is not the longest',
      find:"    if (v.t === 'm') return v.n * 100;",
      replace:"    if (v.t === 'm') return v.n;" },
    /* --- review.html：格式化寫錯（這一條證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.t === 'm') return lang === 'zh' ? (v.n + ' 公尺') : (v.n + ' m');",
      replace:"    if (v.t === 'm') return lang === 'zh' ? (v.n + ' 公分') : (v.n + ' cm');" },
    { file:'review', expect:'bad option shape',
      find:"    return lang === 'zh' ? (v.m + ' 公尺 ' + v.c + ' 公分') : (v.m + ' m ' + v.c + ' cm');",
      replace:"    return lang === 'zh' ? (v.m + ' 公尺 ' + v.c) : (v.m + ' m ' + v.c);" },
    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'correct is',
      find:'        var correct = CM(len);\n        var cands = [ CM(to), CM(from + to), CM(len + 1) ];',
      replace:'        var correct = CM(to);\n        var cands = [ CM(len), CM(from + to), CM(len + 1) ];' },
    { file:'review', expect:'n is not m*100 + c',
      find:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 100 + c;',
      replace:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 10 + c;' },
    { file:'review', expect:'not the right metres-and-centimetres split',
      find:'        var correct = COMP(m, c);',
      replace:'        var correct = COMP(c, m);' },
    { file:'review', expect:'correct != a + b',
      find:'        var sum = a + b;',
      replace:'        var sum = a - b;' },
    { file:'review', expect:'correct != m*100 - b',
      find:'        var total = m * 100;',
      replace:'        var total = m * 10;' },
    { file:'review', expect:'the correct option is not the longest',
      find:'        objs.forEach(function(o){ if (cmOf(o) > cmOf(best)) best = o; });',
      replace:'        objs.forEach(function(o){ if (cmOf(o) < cmOf(best)) best = o; });' },
    { file:'review', expect:'needs at least one length under 100 cm',
      find:'        var small = 30 + rand(14) * 5;',
      replace:'        var small = 130 + rand(14) * 5;' },
    { file:'review', expect:'why never mentions the answer number',
      find:"      zhWhy:'鉛筆放在尺上，大約從 0 量到 18，所以是 18 公分。',",
      replace:"      zhWhy:'鉛筆放在尺上量一量就知道了。'," },
    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? '左邊對準 0，右邊對著 ' + d.to + ' → ' + (d.to - d.from) + ' 公分。'",
      replace:"            ? '左邊對準 0，右邊對著' + d.to + '→' + (d.to - d.from) + ' 公分。'" },
    { file:'review', expect:'doubled punctuation',
      find:"            : 'Left end on 0, right end at ' + d.to + ' → ' + (d.to - d.from) + ' cm.'",
      replace:"            : 'Left end on 0, right end at ' + d.to + ' → ' + (d.to - d.from) + ' cm..'" },
    /* --- index.html：範例資料、題庫與遊戲關卡 --- */
    { file:'index', expect:'the ruler drawn in the stem',
      find:"        { stem:'這枝鉛筆有多長？' + rulerSVG({ from:0, to:8, icon:'✏️', mark0:true }),\n          opts:['7 公分','9 公分','8 公分','8 公尺'], ans:2,",
      replace:"        { stem:'這枝鉛筆有多長？' + rulerSVG({ from:0, to:9, icon:'✏️', mark0:true }),\n          opts:['7 公分','9 公分','8 公分','8 公尺'], ans:2," },
    { file:'index', expect:'aUnit is m but a is not a whole number of metres',
      find:"    { op:'-', a:100, b:40, aUnit:'m'  }",
      replace:"    { op:'-', a:105, b:40, aUnit:'m'  }" },
    { file:'index', expect:'METER_MAX must be a whole number of METER_STEP blocks',
      find:'  var METER_MAX = 130;',
      replace:'  var METER_MAX = 135;' },
    { file:'index', expect:'ZERO_CASES needs a case that starts at 0',
      find:"    { from:0, to:9,  icon:'✏️' },",
      replace:"    { from:1, to:9,  icon:'✏️' }," },
    /* --- 新加的守門條件也要各有一筆改壞版本（C2-7） --- */
    { file:'review', expect:'correct != a - b',
      find:'        var rest = a - b;',
      replace:'        var rest = a + b;' },
    { file:'review', expect:'cm is not a whole number of metres',
      find:'        var cm = m * 100;',
      replace:'        var cm = m * 100 + 1;' },
    { file:'review', expect:'outside 1~15',
      find:'          return (v >= 1 && v <= 15) ? CM(v) : null;\n        }, []);\n        return { from:0, to:to, icon:pick(PENS), correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'          return (v >= 1 && v <= 15) ? CM(v) : null;\n        }, []);\n        mix.opts[(mix.ans + 1) % 4] = CM(400);\n        return { from:0, to:to, icon:pick(PENS), correct:correct, opts:mix.opts, ans:mix.ans };' },
    { file:'review', expect:'but the checker says',
      find:"      zhAsk:'✏️ 一枝新鉛筆大約多長？',      enAsk:'✏️ About how long is a brand-new pencil?',",
      replace:"      zhAsk:'✏️ 一枝新鉛筆大約多長？',      enAsk:'✏️ About how long is a brand-new pencil?', num:19," },
    { file:'index', expect:"this lesson's ruler is 0~15 cm",
      find:'  var RULER_MAX = 15;',
      replace:'  var RULER_MAX = 16;' },
    { file:'index', expect:'the checker expects',
      find:"          opts:['100 公分','10 公分','1000 公分','50 公分'], ans:0,",
      replace:"          opts:['100 公分','10 公分','1000 公分','50 公分'], ans:3," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,",
      replace:"          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:9," },
    { file:'index', expect:'cannot decode it',
      find:"      s = s.replace('<svg ', '<svg data-from=\"' + o.from + '\" data-to=\"' + o.to + '\" ');",
      replace:"      s = s.replace('<svg ', '<svg data-a=\"' + o.from + '\" data-b=\"' + o.to + '\" ');" },
    /* --- 第三輪審查後補的守門條件也要有改壞版本 --- */
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'200 公分是幾公尺？',\n          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,\n          why:'100 公分是 1 公尺，200 公分裡面有 2 個 100，所以是 2 公尺。' }",
      replace:"        { stem:'200 公分是幾公尺？',\n          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,\n          why:'100 公分是 1 公尺，200 公分裡面有 2 個 100，所以是 2 公尺。' },\n        { stem:'1 公分是幾公分？',\n          opts:['1 公分','2 公分','3 公分','4 公分'], ans:0, why:'一樣。' }" },
    { file:'index', expect:'no data-from/data-to for the checker to read',
      find:"      s = s.replace('<svg ', '<svg data-from=\"' + o.from + '\" data-to=\"' + o.to + '\" ');",
      replace:"      /* data-* 被拿掉了 */" },
    { file:'review', expect:'c is outside the draw pool (3~94)',
      find:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 100 + c;',
      replace:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,95], used);\n        var n = m * 100 + c;' },
    { file:'index', expect:'does not know about',
      find:"        { stem:'1 公尺是幾公分？',",
      replace:"        { stem:'1 公尺是幾公分？' + rulerSVG({ from:0, to:5 })," },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'接起來要用加的：8 ＋ 5 ＝ 13 公分。'",
      replace:"why:'接起來要用加的：8 ＋ 5 ＝ 14 公分。'" },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'1 公尺是 100 公分，100 ＋ 5 ＝ 105 公分，不是 15 公分。'",
      replace:"why:'1 公尺是 100 公分，100 ＋ 5 ＝ 106 公分，不是 15 公分。'" },
    { file:'index', expect:"px tall but",
      find:"    var h = rTop + rH + 4;",
      replace:"    var h = 1;" },
    { file:'index', expect:"px wide but",
      find:"    var w = padL + max * unit + padR;",
      replace:"    var w = padL + max * unit;" },
    /* --- 小遊戲（§六之五，2026-10-02 改版）：每一條規則、每一句說明、每一個版面常數都要有一筆改壞版本 --- */
    { file:'index', expect:"must pick the nearest",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"low grades never lose points",
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); gMsg.innerHTML" },
    { file:'index', expect:"should be 1",
      find:"var stars = gMistakes === 0 ? 2 : 1;",
      replace:"var stars = 2;" },
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"" },
    { file:'index', expect:"disabled after the second level",
      find:"if (hintLevel >= 2) gHintBtn.disabled = true;",
      replace:"" },
    { file:'index', expect:"tapped and then dragged",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"" },
    { file:'index', expect:"lost pointer capture does not put the piece back",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    { file:'index', expect:"second finger",
      find:"if (P.locked || gSolved || start) return;",
      replace:"if (P.locked || gSolved) return;" },
    { file:'index', expect:"leaves it sorted",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"" },
    { file:'index', expect:"does not clear the stage",
      find:"    elHint.textContent = '';\n    gameStage.textContent = '';\n",
      replace:"    elHint.textContent = '';\n" },
    { file:'index', expect:"edge of the ruler is accepted as 0",
      find:"if (m.k < 0){ roundMiss(d.gZeroEdge); return false; }",
      replace:"if (m.k < -1){ roundMiss(d.gZeroEdge); return false; }" },
    { file:'index', expect:"a left end on another line is accepted",
      find:"if (m.k > 0){ roundMiss(d.gZeroTick(m.k)); return false; }",
      replace:"if (m.k > 99){ roundMiss(d.gZeroTick(m.k)); return false; }" },
    { file:'index', expect:"LEFT end",
      find:"var left = pt.tap ? pt.x : pt.x - P.w / 2;",
      replace:"var left = pt.x;" },
    { file:'index', expect:"the drop pads (10) no longer overlap",
      find:"var ZERO_RULER = { x0:30, unit:20, max:12, edge:14,",
      replace:"var ZERO_RULER = { x0:30, unit:20, max:12, edge:22," },
    { file:'index', expect:"must start away from 0",
      find:"{ from:3, len:8, icon:'✏️' }",
      replace:"{ from:1, len:8, icon:'✏️' }" },
    { file:'index', expect:"runs off the 0~12 ruler",
      find:"{ from:2, len:10, icon:'✏️' }",
      replace:"{ from:3, len:10, icon:'✏️' }" },
    { file:'index', expect:"gZeroDone zh",
      find:"' 公分。原本是 ' + to + ' － ' + from + ' ＝ ' + len + '，一樣長！'",
      replace:"' 公分。原本是 ' + to + ' － ' + from + ' ＝ ' + (len + 1) + '，一樣長！'" },
    { file:'index', expect:"gZeroTick(",
      find:"return 'The left end is at ' + k + ', not 0.",
      replace:"return 'The left end is at ' + (k + 1) + ', not 0." },
    { file:'index', expect:"the guide lines end at",
      find:".gguide{ position:absolute; top:39px; height:45px;",
      replace:".gguide{ position:absolute; top:39px; height:40px;" },
    { file:'index', expect:"left end on 0, or the round is not solved there",
      find:"P.lock(zeroTickX(0) + P.w / 2, Pn.y);",
      replace:"P.lock(zeroTickX(1) + P.w / 2, Pn.y);" },
    { file:'index', expect:"a drop back on its own line is not silent",
      find:"if (!m || m.k === e.from) return false;",
      replace:"if (!m) return false;" },
    { file:'index', expect:"the drop targets are not [ruler edge",
      find:"var marks = [{ cx:zeroEdgeX(), cy:mid, hw:0, hh:hh, k:-1, done:false }];",
      replace:"var marks = [];" },
    { file:'index', expect:"outside the ribbon is counted",
      find:"if (k <= e.a || k > e.b){ roundMiss(d.gCountOut); return; }",
      replace:"if (k < e.a || k > e.b){ roundMiss(d.gCountOut); return; }" },
    { file:'index', expect:"counted twice",
      find:"if (gSolved || c.classList.contains('counted')) return;",
      replace:"if (gSolved) return;" },
    { file:'index', expect:"the ribbon starts on 0",
      find:"{ a:1, b:5 }, { a:2, b:6 }",
      replace:"{ a:0, b:5 }, { a:2, b:6 }" },
    { file:'index', expect:"gCountDone zh",
      find:"'。刻度線有 ' + (n + 1) + ' 條，數的是格子。'",
      replace:"'。刻度線有 ' + n + ' 條，數的是格子。'" },
    { file:'index', expect:"must be singular",
      find:"return n === 1 ? 'Counted 1 space' : ",
      replace:"return n === 0 ? 'Counted 1 space' : " },
    { file:'index', expect:"under 44",
      find:"var COUNT_RULER = { x0:12, unit:46,",
      replace:"var COUNT_RULER = { x0:12, unit:44," },
    { file:'index', expect:"solved exactly when every space",
      find:"if (seen === n){ line.textContent",
      replace:"if (seen === n - 1){ line.textContent" },
    { file:'index', expect:"longer than the target is accepted",
      find:"if (n + p > T){ roundMiss(d.gBuildOver(n, p, T)); return false; }",
      replace:"if (n + p > T + 10){ roundMiss(d.gBuildOver(n, p, T)); return false; }" },
    { file:'index', expect:"Done is accepted before",
      find:"if (n < T){ roundMiss(d.gBuildShort(n, e.m, e.c, T)); return; }",
      replace:"if (n < T - 10){ roundMiss(d.gBuildShort(n, e.m, e.c, T)); return; }" },
    { file:'index', expect:"should only remind",
      find:"if (n === 0){ gMsg.textContent = d.gBuildEmpty; return; }",
      replace:"if (n === 0){ roundMiss(d.gBuildEmpty); return; }" },
    { file:'index', expect:"solved by a drop",
      find:"        line.textContent = d.gBuildNow(now());\n",
      replace:"        line.textContent = d.gBuildNow(now());\n        if (now() === T) roundSolved(d.gBuildDone(e.m, e.c, T));\n" },
    { file:'index', expect:"not m × 100 + c",
      find:"T = e.m * 100 + e.c,",
      replace:"T = e.m * 10 + e.c," },
    { file:'index', expect:"gBuildShort(",
      find:"'現在 ' + n + ' 公分。' + m + ' 公尺 ' + c + ' 公分 ＝ ' + (m * 100) + ' ＋ '",
      replace:"'現在 ' + n + ' 公分。' + m + ' 公尺 ' + c + ' 公分 ＝ ' + (m * 10) + ' ＋ '" },
    { file:'index', expect:"cm on top of the metre",
      find:"{ m:1, c:5 }, { m:1, c:8 }",
      replace:"{ m:1, c:45 }, { m:1, c:8 }" },
    { file:'index', expect:"gBuildMeter zh",
      find:"gBuildMeter:'10 根 10 公分接起來：100 公分 ＝ 1 公尺！'",
      replace:"gBuildMeter:'10 根 10 公分接起來：100 公分 ＝ 10 公尺！'" },
    { file:'index', expect:"never run out",
      find:"        draw();\n        P.home();\n",
      replace:"        draw();\n" },
    { file:'index', expect:"does not add its length",
      find:"if (p === 10) sticks++; else cubes++;",
      replace:"if (p === 10) sticks++; else sticks++;" },
    { file:'index', expect:"wrong notch is accepted",
      find:"if (m.at !== keep){",
      replace:"if (m.at !== keep && m.at !== e.c){" },
    { file:'index', expect:"inner notches",
      find:"if (k > 0 && k < e.s / 10) marks.push(",
      replace:"if (k >= 0 && k <= e.s / 10) marks.push(" },
    { file:'index', expect:"the pads no longer overlap",
      find:"var CUT_H = 244, CUT_PAD = 13;",
      replace:"var CUT_H = 244, CUT_PAD = 11;" },
    { file:'index', expect:"gCutWrong(",
      find:"'Cutting at ' + x + ' takes ' + (s - x) + ' cm off",
      replace:"'Cutting at ' + x + ' takes ' + (s - x + 10) + ' cm off" },
    { file:'index', expect:"is also right",
      find:"{ s:80, c:30 }",
      replace:"{ s:80, c:40 }" },
    { file:'index', expect:"the cut is not at s − c",
      find:"keep = e.s - e.c, cy",
      replace:"keep = e.c, cy" },
    { file:'index', expect:"gCutDone zh",
      find:"return (s === 100 ? '1 公尺 ＝ 100 公分，' : '') + '剪掉 '",
      replace:"return '剪掉 '" },
    { file:'index', expect:"is not cut into keep and c",
      find:"rope.style.width = (keep * C.px) + 'px';",
      replace:"rope.style.width = (e.s * C.px) + 'px';" },
    { file:'index', expect:"accepted in the wrong box",
      find:"if (v !== c){ roundMiss(",
      replace:"if (v !== c && false){ roundMiss(" },
    { file:'index', expect:"shuffled by their centimetres",
      find:"renderTray(B, set.map(lenCm), RANK_CARD.y,",
      replace:"renderTray(B, set.map(lenCm).sort(function(a, b){ return a - b; }), RANK_CARD.y," },
    { file:'index', expect:"wrong way round",
      find:"lenCm(v) > lenCm(c) ? d.gRankBig(v, c) : d.gRankSmall(v, c)",
      replace:"lenCm(v) < lenCm(c) ? d.gRankBig(v, c) : d.gRankSmall(v, c)" },
    { file:'index', expect:"rankWhy omitted metre conversion",
      find:"return (conv.length ? conv.join(D.gRankSep) + D.gRankColon : '') + D.gRankLonger(a, b);",
      replace:"return D.gRankLonger(a, b);" },
    { file:'index', expect:"no card whose centimetre number is bigger",
      find:"[ { m:2, c:5 }, { c:150 }, { c:60 }, { m:1 } ]",
      replace:"[ { m:1 }, { m:1, c:5 }, { c:150 }, { c:180 } ]" },
    { file:'index', expect:"card line",
      find:"RANK_CARD = { y:170, w:72, h:64, step:74 };",
      replace:"RANK_CARD = { y:170, w:62, h:64, step:74 };" },
    { file:'index', expect:"len() writes",
      find:"return v.m && v.c ? v.m + ' m ' + v.c + ' cm' : v.m ? v.m + ' m' : v.c + ' cm';",
      replace:"return v.m && v.c ? v.m + ' m ' + v.c + 'cm' : v.m ? v.m + ' m' : v.c + ' cm';" },
    { file:'index', expect:"two lengths are the same",
      find:"[ { m:1, c:20 }, { c:99 }, { m:2 }, { c:110 } ]",
      replace:"[ { m:1, c:20 }, { c:99 }, { m:2 }, { c:120 } ]" },
    { file:'index', expect:"sorting by the first number already gives the right order",
      find:"[ { c:40 }, { m:1, c:4 }, { c:140 }, { m:2 } ]",
      replace:"[ { m:1, c:4 }, { m:2 }, { c:240 }, { c:290 } ]" },
    /* --- codex 第一輪之後補的：跑起來的關卡、畫板高度、從 CSS 算的手機寬度、整數公尺卡、舊畫板的積木 --- */
    { file:'index', expect:"taps the line says",
      find:"          if (k <= e.a || k > e.b){ roundMiss(d.gCountOut); return; }",
      replace:"          seen++;\n          if (k <= e.a || k > e.b){ roundMiss(d.gCountOut); return; }" },
    { file:'index', expect:"opens a board of",
      find:"var B = makeBoard(GAME_W, ZERO_H);",
      replace:"var B = makeBoard(GAME_W, 20);" },
    { file:'index', expect:"under 44",
      find:"    padding:22px;margin-top:16px;",
      replace:"    padding:80px;margin-top:16px;" },
    { file:'index', expect:"no whole-metre card",
      find:"[ { c:80 }, { m:2 }, { m:1, c:5 }, { c:120 } ]",
      replace:"[ { c:80 }, { m:2, c:1 }, { m:1, c:5 }, { c:120 } ]" },
    { file:'index', expect:"still held when the board is rebuilt",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    { file:'index', expect:"a drag placement keeps the source selected",
      find:"if (pt.tap) keepSelected(B, P);",
      replace:"keepSelected(B, P);" },
    { file:'index', expect:"a drop on the filled box",
      find:"return best && !best.done ? best : null;",
      replace:"return best;" },
    { file:'index', expect:"taps after the round is solved",
      find:"if (gSolved || c.classList.contains('counted')) return;",
      replace:"if (c.classList.contains('counted')) return;" },
    /* --- codex 第二輪：只走貪心那一條路／依序放卡時碰不到的缺陷 --- */
    { file:'index', expect:"is not simply added",
      find:"if (n + p > T){ roundMiss(d.gBuildOver(n, p, T)); return false; }",
      replace:"if (n + p > T || (p === 1 && n < 100)){ roundMiss(d.gBuildOver(n, p, T)); return false; }" },
    { file:'index', expect:"Done at 55 cm is not refused",
      find:"if (n < T){ roundMiss(d.gBuildShort(n, e.m, e.c, T)); return; }",
      replace:"if (n < T && n !== 55){ roundMiss(d.gBuildShort(n, e.m, e.c, T)); return; }" },
    { file:'index', expect:"in the empty box 4 is not refused",
      find:"        var c = order[s.k];\n",
      replace:"        var c = s.k === 3 ? v : order[s.k];\n" }
  ],

  sim: {
    /* simgen 的通用「誘答抄題幹」檢查在這一課永遠不會響：選項是「9 公分」，
       題幹的數字是「9」，字串比不到。所以每個「題幹裡真的印出數字」的產生器
       都要自己呼叫 noStemEcho。
       兩個讀尺的產生器不呼叫它，但理由不一樣：
       readRuler 從 0 開始，「讀另一端的數字」就是**正確解法**，正解本來就是那個數字；
       readRulerOffset 則是**刻意**把那個數字當誘答（沒對準 0 卻直接讀）。
       兩者的數字都畫在尺上而不是寫在題幹文字裡。 */
    stemEchoOk: {},

    INVARIANTS: {
      readRuler: d => {
        if (d.from !== 0) return 'why says it starts at 0, but from is ' + d.from;
        if (!(d.to >= 1 && d.to <= 15)) return 'to is outside the 0~15 ruler: ' + d.to;
        return base(d, d.to - d.from);
      },
      readRulerOffset: d => {
        if (d.from < 1) return 'why says it does NOT start at 0, but from is ' + d.from;
        if (d.to > 15) return 'to is off the 0~15 ruler: ' + d.to;
        if (d.to <= d.from) return 'the bar has no length (from ' + d.from + ', to ' + d.to + ')';
        return base(d, d.to - d.from);
      },
      mToCm: d => {
        if (!(d.m >= 1 && d.m <= 9)) return 'm outside the lesson range: ' + d.m;
        if (d.correct.t !== 'cm') return 'the answer must be written in centimetres';
        return base(d, d.m * 100) || noStemEcho(d, [d.m]);
      },
      cmToM: d => {
        if (d.cm !== d.m * 100) return 'cm is not a whole number of metres: ' + d.cm;
        if (!(d.m >= 2 && d.m <= 9)) return 'm outside the lesson range: ' + d.m;
        if (d.correct.t !== 'm') return 'the answer must be written in metres';
        /* 題幹印的是 d.cm，而正解剛好也是 d.cm 公分 —— noStemEcho 會跳過正解，
           所以這裡擋掉的是「把題幹的公分數原封不動當成公尺數」那種誘答。 */
        return base(d, d.m * 100) || noStemEcho(d, [d.cm]);
      },
      compoundToCm: d => {
        if (d.n !== d.m * 100 + d.c) return 'n is not m*100 + c (' + d.n + ')';
        if (!(d.c >= 3 && d.c <= 94)) return 'c is outside the draw pool (3~94): ' + d.c;
        if (!(d.m >= 1 && d.m <= 2)) return 'm must be 1~2, got ' + d.m;
        if (d.correct.t !== 'cm') return 'the answer must be written in centimetres only';
        /* 只擋 d.m：「1 公尺 25 公分」出現「1 公分」這種選項是沒有意義的。
           d.c（這裡是 25 公分）**刻意**留著 —— 那正是「把公尺整個忘掉」的迷思誘答，
           是這一題想抓的錯誤，不是抄題幹。 */
        return base(d, d.n) || noStemEcho(d, [d.m]);
      },
      cmToCompound: d => {
        if (d.n !== d.m * 100 + d.c) return 'n is not m*100 + c (' + d.n + ')';
        if (d.correct.t !== 'comp') return 'the answer must be written in metres and centimetres';
        if (d.correct.m !== Math.floor(d.n / 100) || d.correct.c !== d.n % 100){
          return 'correct is not the right metres-and-centimetres split of ' + d.n;
        }
        if (!(d.correct.c >= 1 && d.correct.c <= 99)) return 'the centimetre part must be 1~99';
        if (!(d.correct.m >= 1)) return 'a 0-metre compound form is not used in this lesson';
        if (!(d.m >= 1 && d.m <= 2)) return 'm must be 1~2, got ' + d.m;
        if (!(d.c >= 12 && d.c <= 95)) return 'c is outside the draw pool (12~95): ' + d.c;
        return base(d, d.n) || noStemEcho(d, [d.n]);
      },
      addLength: d => {
        if (!(d.a >= 12 && d.a <= 68)) return 'a outside the lesson range: ' + d.a;
        if (!(d.b >= 5 && d.b <= 39)) return 'b outside the lesson range: ' + d.b;
        if (d.a + d.b !== cmOf(d.correct)) return 'correct != a + b';
        if (d.a + d.b > 130) return 'the total is outside the lesson range';
        return base(d, d.a + d.b) || noStemEcho(d, [d.a, d.b]);
      },
      subLength: d => {
        if (!(d.a >= 42 && d.a <= 96)) return 'a outside the lesson range: ' + d.a;
        if (!(d.b >= 10 && d.b <= 34)) return 'b outside the lesson range: ' + d.b;
        if (d.a - d.b !== cmOf(d.correct)) return 'correct != a - b';
        if (d.a - d.b < 1) return 'nothing is left after cutting';
        return base(d, d.a - d.b) || noStemEcho(d, [d.a, d.b]);
      },
      meterMinus: d => {
        if (!(d.m >= 1 && d.m <= 2)) return 'm outside the lesson range: ' + d.m;
        if (!(d.b >= 10 && d.b <= 70)) return 'b outside the lesson range: ' + d.b;
        if (d.m * 100 - d.b !== cmOf(d.correct)) return 'correct != m*100 - b';
        if (!(d.b >= 1 && d.b < d.m * 100)) return 'you cannot cut off ' + d.b + ' cm here';
        return base(d, d.m * 100 - d.b) || noStemEcho(d, [d.b]);
      },
      pickUnit: d => {
        /* 正解不能只靠 review.html 的物品表 —— 拿設定檔自己的那一份比對。 */
        if (!Number.isInteger(d.idx) || d.idx < 0 || d.idx >= PICK_UNIT_TRUTH.length){
          return 'object index ' + d.idx + ' is outside the checker catalogue (0~' + (PICK_UNIT_TRUTH.length - 1) + ')';
        }
        const truth = PICK_UNIT_TRUTH[d.idx];
        if (d.obj.unit !== truth.unit || d.obj.num !== truth.num){
          return 'object ' + d.idx + ' is ' + d.obj.num + ' ' + d.obj.unit +
                 ', but the checker says ' + truth.num + ' ' + truth.unit;
        }
        const want = truth.unit === 'cm' ? truth.num : truth.num * 100;
        if (d.correct.t !== truth.unit) return 'correct uses the wrong unit for this object';
        /* 解釋一定要說出那個數字，不然「大約多長」等於沒回答。 */
        if (d.obj.zhWhy.indexOf(String(d.obj.num)) < 0) return 'the zh why never mentions the answer number';
        if (d.obj.enWhy.indexOf(String(d.obj.num)) < 0) return 'the en why never mentions the answer number';
        return base(d, want);
      },
      compareLength: d => {
        if (d.opts.length !== 4) return 'compareLength must offer 4 lengths';
        const vals = d.opts.map(cmOf);
        const max = Math.max.apply(null, vals);
        if (vals.filter(v => v === max).length !== 1) return 'there is no single longest length';
        if (cmOf(d.correct) !== max) return 'the correct option is not the longest';
        if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
        /* 至少要有一個 100 公分以上、一個 100 公分以下，這一題才真的需要換算。 */
        if (!vals.some(v => v >= 100)) return 'compareLength needs at least one length of 100 cm or more';
        if (!vals.some(v => v < 100)) return 'compareLength needs at least one length under 100 cm';
        return distinctOpts(d);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的 lenStr —— 拿產生器自己的格式化函式來比
       等於自己比自己（2026-08-25 time 那一課的教訓）。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'readRuler':
        case 'readRulerOffset': return fmtCm(d.to - d.from, lang);
        case 'mToCm':           return fmtCm(d.m * 100, lang);
        case 'cmToM':           return fmtM(d.cm / 100, lang);
        case 'compoundToCm':    return fmtCm(d.m * 100 + d.c, lang);
        case 'cmToCompound':    return fmtComp(Math.floor(d.n / 100), d.n % 100, lang);
        case 'addLength':       return fmtCm(d.a + d.b, lang);
        case 'subLength':       return fmtCm(d.a - d.b, lang);
        case 'meterMinus':      return fmtCm(d.m * 100 - d.b, lang);
        case 'pickUnit': {
          /* 用設定檔自己的物品真值，不是 review.html 的 OBJS。 */
          const t = PICK_UNIT_TRUTH[d.idx] || { unit:'?', num:NaN };
          return t.unit === 'cm' ? fmtCm(t.num, lang) : fmtM(t.num, lang);
        }
        case 'compareLength': {
          let best = d.opts[0];
          d.opts.forEach(o => { if (cmOf(o) > cmOf(best)) best = o; });
          return fmtVal(best, lang);
        }
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：一定帶單位，而且落在這一課自己的範圍裡。
       正解與誘答用同一組規則 —— 這一課沒有「刻意畫錯的選項」。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const shapes = lang === 'zh'
        ? [/^\d+ 公分$/, /^\d+ 公尺$/, /^\d+ 公尺 \d+ 公分$/]
        : [/^\d+ cm$/, /^\d+ m$/, /^\d+ m \d+ cm$/];
      if (!shapes.some(re => re.test(t))) return 'bad option shape: ' + t;
      const comp = lang === 'zh' ? t.match(/^(\d+) 公尺 (\d+) 公分$/) : t.match(/^(\d+) m (\d+) cm$/);
      if (comp){
        if (!(Number(comp[2]) >= 1 && Number(comp[2]) <= 99)) return 'the centimetre part of ' + t + ' must be 1~99';
        if (!(Number(comp[1]) >= 1)) return 'the metre part of ' + t + ' must be at least 1';
      }
      const cm = parseLen(t, lang);
      if (cm === null) return 'cannot read a length out of ' + t;
      const bounds = RANGE[genId] || [1, 400];
      if (!(cm >= bounds[0] && cm <= bounds[1])){
        return 'option ' + t + ' is ' + cm + ' cm, outside ' + bounds[0] + '~' + bounds[1];
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{RULER_MAX, RULER_TARGET, ZERO_CASES, METER_STEP, METER_MAX, CALC_CASES, rulerSVG, GAME_W, GPICK, GPAD, GAME_ORDER, ' +
      'GAME_ZERO, ZERO_H, ZERO_PAD, ZERO_RULER, ZERO_PEN, zeroTickX, zeroEdgeX, GAME_COUNT, COUNT_H, COUNT_RULER, COUNT_RIB, countTickX, ' +
      'GAME_BUILD, BUILD_H, BUILD_PIECES, BUILD_BAR, BUILD_TRACK, BUILD_TOK, GAME_CUT, CUT_H, CUT_PAD, CUT_ROPE, CUT_SCI, cutX, ' +
      'GAME_RANK, RANK_H, RANK_SLOT, RANK_CARD, lenCm, rankWhy}',
    check: function(data, I18N, fail, src){
      /* --- 這一課的常數：釘死，不然改了也沒人會發現 --- */
      if (data.RULER_MAX !== 15) fail(`RULER_MAX is ${data.RULER_MAX}; this lesson's ruler is 0~15 cm`);
      if (data.METER_STEP !== 10) fail(`METER_STEP is ${data.METER_STEP}; example 3 is built from 10 cm blocks`);

      /* --- 範例 1：一格一格量到 RULER_TARGET --- */
      if (!(data.RULER_TARGET >= 1 && data.RULER_TARGET <= data.RULER_MAX)){
        fail(`RULER_TARGET ${data.RULER_TARGET} does not fit on a 0~${data.RULER_MAX} ruler`);
      }
      ['zh','en'].forEach(L => {
        const t = I18N[L].r1Step(data.RULER_TARGET - 1);
        if (/undefined|NaN/.test(t)) fail(`r1Step ${L}: ${t}`);
        if (t.indexOf(String(data.RULER_TARGET - 1)) < 0) fail(`r1Step ${L} never prints the count`);
      });

      /* --- 範例 2：左邊對準 0 與沒對準 0 都要有 --- */
      if (!data.ZERO_CASES.some(c => c.from === 0)) fail('ZERO_CASES needs a case that starts at 0');
      if (!data.ZERO_CASES.some(c => c.from > 0)) fail('ZERO_CASES needs a case that does NOT start at 0');
      data.ZERO_CASES.forEach((c, i) => {
        if (c.to <= c.from) fail(`ZERO_CASES[${i}] has no length`);
        if (c.to > data.RULER_MAX) fail(`ZERO_CASES[${i}] runs off the ruler (to=${c.to})`);
        if (c.from < 0) fail(`ZERO_CASES[${i}] starts before 0`);
        ['zh','en'].forEach(L => {
          const line = I18N[L].z3(c.from, c.to, c.to - c.from);
          if (/undefined|NaN/.test(line)) fail(`z3 ${L} case ${i}: ${line}`);
          /* 結論那一行一定要印出答案，而且沒對準 0 的時候要真的出現相減。 */
          if (line.indexOf(String(c.to - c.from)) < 0) fail(`z3 ${L} case ${i} never prints the length`);
          if (c.from > 0 && line.indexOf(String(c.from)) < 0){
            fail(`z3 ${L} case ${i} never mentions the start number ${c.from}`);
          }
          const z1 = I18N[L].z1(c.from);
          if (/undefined|NaN/.test(z1)) fail(`z1 ${L} case ${i}: ${z1}`);
        });
      });

      /* --- 範例 3：10 公分一段，接到 1 公尺再多接幾段 --- */
      if (data.METER_MAX % data.METER_STEP !== 0){
        fail(`METER_MAX must be a whole number of METER_STEP blocks (${data.METER_MAX} / ${data.METER_STEP})`);
      }
      if (100 % data.METER_STEP !== 0) fail('METER_STEP must divide 100, otherwise 1 metre is never reached exactly');
      if (data.METER_MAX <= 100) fail('METER_MAX must go past 100 so both ways of writing it show up');
      ['zh','en'].forEach(L => {
        const over = data.METER_MAX;
        const line = I18N[L].mOver(over, over - 100);
        if (/undefined|NaN/.test(line)) fail(`mOver ${L}: ${line}`);
        if (line.indexOf(String(over - 100)) < 0) fail(`mOver ${L} never prints the leftover centimetres`);
        if (I18N[L].mHundred.indexOf('100') < 0) fail(`mHundred ${L} never prints 100`);
      });

      /* --- 範例 4：接起來、剪掉 --- */
      let sawPlus = false, sawMinus = false, sawMeter = false;
      data.CALC_CASES.forEach((c, i) => {
        if (c.op !== '+' && c.op !== '-') fail(`CALC_CASES[${i}] has an unknown op ${c.op}`);
        if (c.op === '+') sawPlus = true; else sawMinus = true;
        if (c.aUnit !== 'cm' && c.aUnit !== 'm') fail(`CALC_CASES[${i}] has an unknown aUnit ${c.aUnit}`);
        if (c.aUnit === 'm'){
          sawMeter = true;
          if (c.a % 100 !== 0) fail(`CALC_CASES[${i}] aUnit is m but a is not a whole number of metres (${c.a})`);
        }
        const res = c.op === '+' ? c.a + c.b : c.a - c.b;
        if (res < 1) fail(`CALC_CASES[${i}] leaves ${res} cm`);
        if (res > 300) fail(`CALC_CASES[${i}] result ${res} is outside the lesson range`);
        ['zh','en'].forEach(L => {
          const c1 = I18N[L].c1(c), c2 = I18N[L].c2(c), c3 = I18N[L].c3(c, res);
          [c1, c2, c3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CALC_CASES[${i}] ${L}: ${s}`); });
          if (c3.indexOf(String(res)) < 0) fail(`CALC_CASES[${i}] ${L}: the result line never prints ${res}`);
          if (c2.indexOf(String(c.b)) < 0) fail(`CALC_CASES[${i}] ${L}: the second step never prints ${c.b}`);
          /* 公尺的那一例一定要把換算講出來，不然孩子看不到 100 是哪裡來的。 */
          if (c.aUnit === 'm' && c1.indexOf(String(c.a)) < 0){
            fail(`CALC_CASES[${i}] ${L}: the metre case never shows the ${c.a} cm conversion`);
          }
          const chip = I18N[L].calcChip(c);
          if (/undefined|NaN/.test(chip)) fail(`calcChip ${L} case ${i}: ${chip}`);
        });
      });
      if (!sawPlus) fail('CALC_CASES needs an addition case');
      if (!sawMinus) fail('CALC_CASES needs a subtraction case');
      if (!sawMeter) fail('CALC_CASES needs a case whose first length is written in metres');

      /* --- 遊戲：五關五種玩法（§六之五） --- */
      gameCheck(data, I18N, fail, src);

      /* --- 三層題庫：選項一律是長度，換算成公分之後不可以有兩個一樣 --- */
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        /* 神諭表的長度要等於題庫長度 —— 只比對「有的題目」的話，
           刪掉一題不會有人發現（多的那筆神諭永遠不會被讀到）。 */
        const oracle = BANK_EXPECTED[bank] || [];
        if ((I18N.zh[bank] || []).length !== oracle.length){
          fail(`${bank}: ${(I18N.zh[bank] || []).length} questions but ${oracle.length} expected answers recorded`);
        }
        /* BANK_RULER 也一樣：留著一筆指向已刪除題目的設定等於什麼都沒驗。 */
        Object.keys(BANK_RULER[bank] || {}).forEach(k => {
          if (!(I18N.zh[bank] || [])[Number(k)]) fail(`BANK_RULER.${bank}[${k}] points at a question that no longer exists`);
        });
        ['zh','en'].forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const cms = q.opts.map(o => parseLen(o, L));
            if (cms.some(v => v === null)){
              fail(`${bank}[${i}] ${L}: an option is not a length (${q.opts.join(' / ')})`);
              return;
            }
            for (let a = 0; a < cms.length; a++){
              for (let b = a + 1; b < cms.length; b++){
                if (cms[a] === cms[b]){
                  fail(`${bank}[${i}] ${L}: "${q.opts[a]}" and "${q.opts[b]}" are the same real length`);
                }
              }
            }
            /* ans 先驗合法，否則 cms[q.ans] 會是 undefined，而 undefined > 800 是 false ——
               題目整個沒有被驗到卻是綠的。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 上限 20000 公分來自 qs[5] 刻意的「200 公尺」誘答（把公分讀成公尺）。 */
            cms.forEach((v, k) => {
              if (!(v >= 1 && v <= 20000)) fail(`${bank}[${i}] ${L}: option "${q.opts[k]}" is ${v} cm, out of range`);
            });
            if (cms[q.ans] > 800){
              fail(`${bank}[${i}] ${L}: the correct answer ${cms[q.ans]} cm is outside what this lesson measures`);
            }
            /* 答案神諭：正解的公分數要等於設定檔自己寫下的那一份，中英共用。
               沒有這一條的話，任何一個在範圍內的選項被標成正解都會通過。 */
            const want = (BANK_EXPECTED[bank] || [])[i];
            if (typeof want !== 'number'){
              fail(`${bank}[${i}]: no expected answer recorded in the checker`);
            } else if (cms[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is ${cms[q.ans]} cm, the checker expects ${want} cm`);
            }
            /* 「哪一個最長」的題目，標為正解的那一個一定要真的是最長的。 */
            const asksLongest = L === 'zh' ? /最長/.test(q.stem) : /longest/i.test(q.stem);
            if (asksLongest && cms[q.ans] !== Math.max.apply(null, cms)){
              fail(`${bank}[${i}] ${L}: asks for the longest, but the marked answer is not the largest`);
            }
            /* 題幹裡畫出來的那把尺，長度一定要等於標為正解的那個長度。
               （只驗資料不夠：選項改了、圖沒改，靜態檢查是看不出來的。） */
            const bar = /data-from="(\d+)" data-to="(\d+)"/.exec(q.stem);
            const wantDrawn = (BANK_RULER[bank] || {})[i];
            /* 第二個、和 data-* 無關的偵測器：被量的長條是畫在尺上方的矩形
               （y="16" height="30"）。有這種矩形卻沒有 data-*，表示那張圖
               不是 rulerSVG 畫的，或 rulerSVG 不再輸出座標 —— 兩種都要噴錯，
               不能因為「這一題本來就不在 BANK_RULER 裡」而靜靜放過。 */
            if (/<rect[^>]*y="16"[^>]*height="30"/.test(q.stem) && !bar){
              fail(`${bank}[${i}] ${L}: the stem draws a measured bar with no data-from/data-to for the checker to read`);
            }
            if (typeof wantDrawn === 'number' && !bar){
              fail(`${bank}[${i}] ${L}: this question is supposed to draw a measured bar, but the checker cannot decode it — did rulerSVG stop emitting data-from/data-to?`);
            } else if (typeof wantDrawn !== 'number' && bar){
              fail(`${bank}[${i}] ${L}: the stem draws a measured bar the checker does not know about — add it to BANK_RULER`);
            } else if (bar){
              const from = Number(bar[1]), to = Number(bar[2]);
              const drawn = to - from;
              if (from < 0 || to > data.RULER_MAX){
                fail(`${bank}[${i}] ${L}: the bar runs from ${from} to ${to}, off the 0~${data.RULER_MAX} ruler`);
              }
              if (drawn !== wantDrawn){
                fail(`${bank}[${i}] ${L}: the ruler drawn in the stem is ${drawn} cm, the checker expects ${wantDrawn} cm`);
              }
              if (drawn !== cms[q.ans]){
                fail(`${bank}[${i}] ${L}: the ruler drawn in the stem is ${drawn} cm, but the marked answer is ${cms[q.ans]} cm`);
              }
            }
          });
        });
      });

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
                    const r = arithLength(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 13) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 13`);
            if (qSum !== 0) fail(`question-shaped equations changed: found ${qSum}, expected 0`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithLength.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithLength.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithLength.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== 'b044e4cc2a53'){
                fail(`the set of verified equations changed (digest ${digest}, expected b044e4cc2a53)\n      now: ${list.join(' | ')}`);
              }
            }
          }


          /* --- 圖畫不畫得下（issue #2：這一課本來完全沒有幾何檢查） ---
             實作在 tools/checks/lib/canvas.js（全站唯一一份），四個邊都驗。 */
          /* ⚠️ rulerSVG 收的是**選項物件**，不是數字。傳數字進去的話 `o.max`
             永遠是 undefined，每一次都畫出同一張圖 —— 看起來跑了十幾次，
             其實只驗過一種輸入。要照頁面真正的用法涵蓋整個範圍。 */
          {
            const shots = [];
            for (let to = 0; to <= data.RULER_MAX; to++){
              shots.push([`from0-to${to}`, { from:0, to:to, icon:'✏️', mark0:true }]);
              for (let from = 0; from < to; from++) shots.push([`from${from}-to${to}`, { from:from, to:to, icon:'🖍️' }]);
            }
            shots.push(['max8-unit34', { max:8, unit:34 }]);
            shots.forEach(([label, o]) => {
              canvasProblems(data.rulerSVG(o)).forEach(m => fail(`rulerSVG(${label}): ${m}`));
            });
            if (shots.length < data.RULER_MAX) fail(`rulerSVG canvas check only covered ${shots.length} drawings`);
          }

    }
  }
};
