/* grade-2/math/numbers（1000 以內的數）的檢查設定。

   這一課和 grade-2/multiply 是設定檔機制出現「之前」上線的，所以從 2026-08-25
   到 2026-08-26 之間，它們的產生器沒有任何 simgen／verify_lesson_data／breaktest
   的保護（`node tools/simgen.js …` 會直接報 no check config）。這份補上。

   範圍取自課程自己說的話：標題就是「1000 以內的數」，所以選項上限是 1000，
   不是隨手給一個寬鬆的大數 —— 2026-08-25 那一輪的教訓就是「斷言的上限要來自
   這一課自己宣告的限制」。 */

const PLACES = [100, 10, 1];          // 百、十、個
const MAX = 1000;                     // 課名就是 1000 以內

/* 每個產生器的選項範圍。沒列到的走預設 0~MAX。
   digitOf 問的是「某一位的數字」，答案與誘答都只能是一個數字。 */
const RANGE = { digitOf: [0, 9] };

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithNumbers = require('./lib/arith.js').makeArith({
  units: ["個", "十", "百", "顆", "元", "張"],
  unitsEn: ["tens?", "hundreds?", "ones?", "items?", "coins?"]
});

/* ---------- 小遊戲「倉庫點貨」（§六之五：五關五種玩法，2026-10-02 改版）----------
   裝一箱（10 個十換 1 個百）、寫數字（位值表，0 佔位）、備貨（照數放積木）、排排站（比大小）、開貨車（+100／+10／+1）。
   做法照 grade-3-divide.js：
   - 每一關**照遊戲的規則把每一題玩一遍**（自己的規則實作），證明一定解得完、解完一定是對的數；
   - 頁面的純函式（blockXY／crateSlotXY／packPileXY）拿整個題庫去呼叫，再和自己的公式比；
   - nearestOpen()、roundSolved()、roundMiss()、sort 的 why()、開貨車的兩條「滿十換」條件從原始碼切出來**真的跑**；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯），而且那句話說的事要成立；
   - 版面與觸控 ≥ 44px 從 index.html 的常數讀（不在這裡另抄一份數字）。
   已知極限：RENDER 函式本體裡的規則是字面掃描（need()：證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g2-numbers 的端對端測試驗。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const dig3 = n => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
  const within = (o, R, what) => { if (!(o.x >= R.x && o.y >= R.y && o.x + o.w <= R.x + R.w && o.y + o.h <= R.y + R.h)) fail(what + ' sticks out of its frame'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const pad = (R, p) => ({ x:R.x - p, y:R.y - p, w:R.w + 2 * p, h:R.h + 2 * p });
  const W = D.GAME_W;

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['pack', 'write', 'build', 'sort', 'hop'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 第 5 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外） */
  if (!/用點的/.test(I18N.zh.gAsks.hop) || !/all taps/.test(I18N.en.gAsks.hop)) fail('hop: the round has no drag — its instructions must say it is all taps');
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');

  /* --- 觸控：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍 --- */
  const scale = Math.min(1.5, 290 / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK', D.GPICK);
  small('a loose ten (' + D.PACK_PILE.w + '×' + D.PACK_PILE.h + ')', Math.min(D.PACK_PILE.w, D.PACK_PILE.h));
  small('a digit card', D.WRITE_KEYS.size);
  small('a write box', D.WRITE_SLOT.size);
  small('a block source', D.BUILD_TOK.size);
  small('a sort crate (' + D.SORT_CARD.w + '×' + D.SORT_CARD.h + ')', Math.min(D.SORT_CARD.w, D.SORT_CARD.h));
  small('a sort box', Math.min(D.SORT_SLOT.w, D.SORT_SLOT.h));
  [D.PACK_PILE.w, D.PACK_PILE.h, D.WRITE_KEYS.size, D.BUILD_TOK.size, D.SORT_CARD.w, D.SORT_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('hop: the +100/+10/+1 buttons (.btn) are not at least 46px tall'); }
  need('pack', /addPiece\(B, \{ w:PACK_PILE\.w, h:PACK_PILE\.h, cx:p\.x, cy:p\.y, cls:'gten'/, 'the loose tens are not PACK_PILE.w × PACK_PILE.h at packPileXY()');
  need('write', /addPiece\(B, \{ w:WRITE_KEYS\.size, h:WRITE_KEYS\.size, cx:GAME_W \/ 2 \+ \(\(v % 5\) - 2\) \* WRITE_KEYS\.step,\s*cy:WRITE_KEYS\.y \+ Math\.floor\(v \/ 5\) \* WRITE_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
  need('build', /addPiece\(B, \{ w:BUILD_TOK\.size, h:BUILD_TOK\.size, cx:cx, cy:cy,/, 'the block sources are not BUILD_TOK.size');
  need('sort', /addPiece\(B, \{ w:SORT_CARD\.w, h:SORT_CARD\.h, cx:cx, cy:cy,/, 'the crates are not SORT_CARD.w × SORT_CARD.h');

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
    if (typeof d.gClear !== 'string' || !d.gClear) fail('gClear missing in ' + L);
    if (/\d/.test(d.gClear)) fail('gClear ' + L + ' has a number in it');
  });

  /* --- 英文的單複數（「1 hundreds」是改版前就有的錯：範例 1 從 195 開始就會印） --- */
  if (I18N.en.blkSay(1, 1, 1) !== '1 hundred, 1 ten, 1 one.' || I18N.en.blkSay(2, 0, 5) !== '2 hundreds, 0 tens, 5 ones.')
    fail('en: 1 hundred / 1 ten / 1 one must be singular, others plural: "' + I18N.en.blkSay(1, 1, 1) + '" / "' + I18N.en.blkSay(2, 0, 5) + '"');

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }
  const tgt = (R, id) => ({ id, cx:R.x + R.w / 2, cy:R.y + R.h / 2, hw:R.w / 2, hh:R.h / 2, done:false });
  /* 一排相鄰的格子：格子裡每一點判給那一格；兩格中間的縫判給比較近的那一格（一樣近不收也不算錯）；整排外面都不收 */
  const rowCheck = (rects, p, what) => {
    if (!nearestOpen) return;
    const list = rects.map(tgt);
    let bad = 0, gapBad = 0;
    list.forEach((b, i) => {
      for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1.5) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, p); if (!g || g.id !== i) bad++; }
      if (i + 1 < list.length){
        const r = rects[i].x + rects[i].w, l = rects[i + 1].x, y = b.cy;
        if (!(l - r < 2 * p)) fail(what + ': the boxes are ' + (l - r) + ' apart — the drop pads (' + p + ') no longer overlap, so the nearest-box rule is never exercised');
        for (let x = r + 0.25; x < l; x += 0.5){ const want = x - r < l - x ? i : i + 1, g = nearestOpen(list, { x, y }, p); if (x - r !== l - x && (!g || g.id !== want)) gapBad++; }
      }
    });
    if (bad) fail('nearestOpen(): ' + bad + ' points inside a ' + what + ' are given to another box (or none)');
    if (gapBad) fail('nearestOpen(): ' + gapBad + ' points between two ' + what + 'es go to the farther box — it takes the first match instead of the nearest');
    const done = list.map((b, i) => Object.assign({}, b, { done:i === 1 }));
    /* 放在已經放好的那格裡、緊貼著下一格（在下一格的吸附範圍裡）：不可以改塞進下一格 */
    const edge = { x:done[1].cx + done[1].hw - 0.5, y:done[1].cy };
    if (nearestOpen(done, edge, p) !== null || nearestOpen(done, { x:done[1].cx, y:done[1].cy }, p) !== null) fail('nearestOpen(): a drop on a finished ' + what + ' is moved into its neighbour');
    if (nearestOpen(list, { x:-50, y:-50 }, p) !== null) fail('nearestOpen(): a drop far from every ' + what + ' is accepted');
  };

  /* --- 板上畫的積木：blockXY() 和自己的公式比，每一種 0～9 個都不互相碰到、都在一欄（94 × 86）裡 --- */
  const myBlock = (kind, i, cx, top) => {
    const b = D.BLK[kind];
    return { x:cx + (i % b.per - (b.per - 1) / 2) * b.sx, y:top + b.h / 2 + Math.floor(i / b.per) * b.sy };
  };
  ['h', 't', 'o'].forEach(kind => {
    const b = D.BLK[kind], list = [];
    for (let i = 0; i < 9; i++){
      const p = D.blockXY(kind, i, 100, 50), m = myBlock(kind, i, 100, 50);
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('blockXY(' + kind + ', ' + i + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
      list.push(box(m.x, m.y, b.w, b.h));
    }
    noHits(list, 'blocks of kind ' + kind);
    list.forEach((r, i) => within(r, { x:100 - 45, y:50, w:90, h:86 }, kind + ' block ' + (i + 1)));
  });
  const colFits = (cnt, cx, top, frame, what) => ['h', 't', 'o'].forEach((kind, c) => {
    for (let i = 0; i < cnt[c]; i++){ const m = myBlock(kind, i, cx[c], top); within(box(m.x, m.y, D.BLK[kind].w, D.BLK[kind].h), frame(c), what + ' ' + kind + ' ' + (i + 1)); }
  });

  /* ================= 第 1 關：裝一箱（範例 1：10 個十換 1 個百） ================= */
  {
    const C = D.PACK_CRATE, HC = D.PACK_HCOL, OC = D.PACK_OCOL, PP = D.PACK_PILE, H = D.PACK_H;
    const crate = { x:C.x, y:C.y, w:C.w, h:C.h };
    [[crate, 'the crate'], [HC, 'the hundreds column'], [OC, 'the ones column']].forEach(([r, w]) => inside(r, 'pack: ' + w, W, H));
    noHits([crate, HC, OC], 'pack: crate/columns');
    /* 「百」那一欄的吸附範圍刻意伸進箱子（不然端對端測試的「重疊區挑最近」無從驗起） */
    if (!(HC.y - (C.y + C.h) < D.PACK_PAD)) fail('pack: the hundreds column is ' + (HC.y - (C.y + C.h)) + ' below the crate — no longer inside PACK_PAD, the overlap test has nothing to test');
    const bars = [];
    for (let i = 0; i < 10; i++){
      const p = D.crateSlotXY(i), m = { x:C.x + C.w / 2 + (i - 4.5) * C.step, y:C.y + C.h / 2 };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('crateSlotXY(' + i + ') should be ' + JSON.stringify(m));
      bars.push(box(m.x, m.y, C.barW, C.barH));
    }
    noHits(bars, 'pack: tens in the crate'); bars.forEach((r, i) => within(r, crate, 'pack: ten ' + (i + 1) + ' in the crate'));
    if (nearestOpen){
      const zones = [tgt(HC, 'h'), tgt(OC, 'o'), tgt(crate, 'crate')];
      let bad = 0;
      [crate, HC, OC].forEach((R, zi) => { const want = ['crate', 'h', 'o'][zi];
        for (let x = R.x + 0.5; x < R.x + R.w; x += 2) for (let y = R.y + 0.5; y < R.y + R.h; y += 2){ const g = nearestOpen(zones, { x, y }, D.PACK_PAD); if (!g || g.id !== want) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside the crate or a column are given to another target — the crate is last in the list and its centre is far away, so the nearest must be measured to the box');
    }
    if (!(D.GAME_PACK.length >= 3)) fail('GAME_PACK should have at least 3 entries');
    D.GAME_PACK.forEach((e, i) => {
      const w = 'GAME_PACK[' + i + ']';
      if (![e.h, e.t, e.o].every(Number.isInteger)) return fail(w + ' is not whole numbers');
      if (e.h < 1 || e.h > 5) fail(w + ': ' + e.h + ' hundreds — should be 1~5 (after packing they must fit two rows of the column)');
      if (e.t < 11 || e.t > 14) fail(w + ': ' + e.t + ' tens — should be 11~14 (exactly one crate fills; three rows of loose tens at most)');
      if (e.o < 0 || e.o > 9) fail(w + ': ' + e.o + ' ones');
      /* 照遊戲的規則玩一遍：十一條一條進箱子，滿 10 條就換成一個百、這一關結束 */
      let h = e.h, t = e.t, inCrate = 0, steps = 0;
      while (inCrate < 10 && t > 0){ t--; inCrate++; steps++; }
      if (inCrate !== 10) return fail(w + ': the crate never fills');
      h++;
      const n = h * 100 + t * 10 + e.o;
      if (t > 9) fail(w + ': ' + t + ' tens are left after the crate — still not a proper three-digit reading');
      if (n !== (e.h + 1) * 100 + (e.t - 10) * 10 + e.o || n > 999) fail(w + ': the result ' + n + ' is wrong or past 999');
      colFits([h, 0, 0], [HC.x + HC.w / 2], HC.y + D.PACK_COLTOP, () => HC, w + ' hundreds column:');
      colFits([0, 0, e.o], [0, 0, OC.x + OC.w / 2], OC.y + D.PACK_COLTOP, () => OC, w + ' ones column:');
      const pile = [];
      for (let k = 0; k < e.t; k++){
        const p = D.packPileXY(k, e.t), row = Math.floor(k / PP.perRow), inRow = Math.min(PP.perRow, e.t - row * PP.perRow);
        const m = { x:W / 2 + (k % PP.perRow - (inRow - 1) / 2) * PP.step, y:PP.y + row * PP.rowStep };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail(w + ': packPileXY(' + k + ') should be ' + JSON.stringify(m));
        const r = box(m.x, m.y, PP.w, PP.h); pile.push(r); inside(r, w + ' loose ten ' + (k + 1), W, H);
        [crate, HC, OC].forEach(Z => { if (hit(r, pad(Z, D.PACK_PAD))) fail(w + ': loose ten ' + (k + 1) + ' sits inside a drop zone'); });
      }
      noHits(pile, w + ': loose tens');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gPackNow ' + L, d.gPackNow(e.h, e.t, e.o), [e.h, e.t, e.o]);
        seq(w + ' gPackDone ' + L, d.gPackDone(e.h, e.t, e.o, n), [10, 1, e.h, e.t, e.o, e.h + 1, e.t - 10, e.o, n]);
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      for (let k = 0; k <= 10; k++) seq('gPackCrate ' + L, d.gPackCrate(k), [k, 10]);
      for (let k = 1; k <= 10; k++) seq('gPack2 ' + L, d.gPack2(k), [k]);
      seq('gPackNotH ' + L, d.gPackNotH, [10, 1]);
      seq('gPackNotO ' + L, d.gPackNotO, []);
      seq('gPackPile ' + L, d.gPackPile, []);
    });
    need('pack', /var e = pick\(GAME_PACK\), n = \(e\.h \+ 1\) \* 100 \+ \(e\.t - 10\) \* 10 \+ e\.o, inCrate = 0/, 'the result is not (h + 1) hundreds, (t − 10) tens and o ones');
    need('pack', /var zones = \[hcol, ocol, crate\];\s*useTapSelect\(B, function\(P, pt\)\{\s*var z = nearestOpen\(zones, pt, PACK_PAD\);\s*if \(!z\) return false;/, 'the drop does not pick the nearest of the two columns and the crate (empty space must be silent)');
    need('pack', /if \(z === hcol\)\{ roundMiss\(d\.gPackNotH\); return false; \}/, 'a single ten is accepted in the hundreds column (one ten is not a hundred)');
    need('pack', /if \(z === ocol\)\{ roundMiss\(d\.gPackNotO\); return false; \}/, 'a ten is accepted in the ones column');
    need('pack', /if \(inCrate === 10\)\{[\s\S]*?addBlock\(B, 'h', blockXY\('h', e\.h, hx, top\)\);[\s\S]*?roundSolved\(d\.gPackDone\(e\.h, e\.t, e\.o, n\)\);/, 'the crate does not turn into one more hundred exactly at 10');
    need('pack', /for \(i = 0; i < e\.h; i\+\+\) addBlock\(B, 'h', blockXY\('h', i, hx, top\)\);\s*for \(i = 0; i < e\.o; i\+\+\) addBlock\(B, 'o', blockXY\('o', i, ox, top\)\);/, 'the hundreds and ones are not drawn from the pool entry');
    need('pack', /for \(i = 0; i < e\.t; i\+\+\)\{\s*var p = packPileXY\(i, e\.t\);/, 'the loose tens are not one piece per ten');
  }

  /* ================= 第 2 關：寫數字（範例 2：位值表，0 佔位） ================= */
  {
    const S = D.WRITE_SLOT, K = D.WRITE_KEYS, H = D.WRITE_H, P = D.WRITE_PIC;
    const slots = S.x.map(x => box(x, S.y, S.size, S.size));
    slots.forEach((r, k) => inside(r, 'write: box ' + k, W, H));
    rowCheck(slots, D.GPAD, 'write box');
    const keys = [];
    for (let v = 0; v <= 9; v++){
      const r = box(W / 2 + ((v % 5) - 2) * K.step, K.y + Math.floor(v / 5) * K.rowStep, K.size, K.size);
      keys.push(r); inside(r, 'write: digit card ' + v, W, H);
      slots.forEach(s => { if (hit(r, pad(s, D.GPAD))) fail('write: digit card ' + v + ' sits inside a box\'s drop zone'); });
    }
    noHits(keys, 'write: digit cards');
    const frames = P.x.map(x => ({ x:x - 47, y:P.top - 4, w:94, h:94 }));
    frames.forEach((f, c) => { inside(f, 'write: picture frame ' + c, W, H); if (f.y + f.h > S.hdY) fail('write: the picture runs into the box labels'); });
    noHits(frames, 'write: picture frames');
    if (!(D.GAME_WRITE.length >= 3)) fail('GAME_WRITE should have at least 3 entries');
    D.GAME_WRITE.forEach((e, i) => {
      const w = 'GAME_WRITE[' + i + ']', cnt = [e.h, e.t, e.o], n = e.h * 100 + e.t * 10 + e.o;
      if (!cnt.every(c => Number.isInteger(c) && c >= 0 && c <= 9) || e.h < 1) return fail(w + ' is not a three-digit number');
      if (e.t !== 0 && e.o !== 0) fail(w + ': ' + n + ' has no 0 — this round is about the 0 that holds a place');
      colFits(cnt, P.x, P.top, c => frames[c], w + ' picture');
      /* 照規則玩：一格只收「那一種積木的個數」。每一個（格子, 數字卡）組合：收或不收、不收時是哪一句、那句話說的事成立 */
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let k = 0; k < 3; k++) for (let v = 0; v <= 9; v++){
          if (v === cnt[k]) continue;
          const j = cnt.indexOf(v);
          if (cnt[k] === 0) seq(w + ' gWriteZero ' + L, d.gWriteZero(k), [0]);
          else if (j >= 0 && cnt[j] !== 0){
            if (cnt[j] !== v || j === k) fail(w + ': gWriteSwap says ' + v + ' is the count of place ' + j + ', but it is not');
            seq(w + ' gWriteSwap ' + L, d.gWriteSwap(v, j, k), [v]);
          } else seq(w + ' gWriteCount ' + L, d.gWriteCount(k), []);
        }
        for (let k = 0; k < 3; k++) seq(w + ' gWrite2 ' + L, d.gWrite2(k, cnt[k]), [cnt[k]]);
        seq(w + ' gWriteDone ' + L, d.gWriteDone(e.h, e.t, e.o, n), [e.h, e.t, e.o, n, 0]);
        seq(w + ' line ' + L, d.gPackNow(e.h, e.t, e.o) + ' = ' + n, [e.h, e.t, e.o, n]);
      });
    });
    /* 說明裡的名字：位名（百位／十位／個位）與積木名（大方塊／長條／小方塊）要一一對上 */
    for (let k = 0; k < 3; k++){
      const z = I18N.zh.gWriteZero(k), e = I18N.en.gWriteZero(k);
      if (z.indexOf(['百位', '十位', '個位'][k]) < 0 || z.indexOf(['大方塊', '長條', '小方塊'][k]) < 0) fail('gWriteZero zh ' + k + ' names the wrong place or block: ' + z);
      if (e.indexOf(['hundreds', 'tens', 'ones'][k]) < 0 || e.indexOf(['big squares', 'bars', 'little cubes'][k]) < 0) fail('gWriteZero en ' + k + ' names the wrong place or block: ' + e);
    }
    need('write', /var e = pick\(GAME_WRITE\), cnt = \[e\.h, e\.t, e\.o\]/, 'the counts are not the pool entry');
    need('write', /drawColumns\(B, cnt, WRITE_PIC\.x, WRITE_PIC\.top\);/, 'the picture is not drawn from the counts');
    need('write', /var s = nearestOpen\(slots, pt, GPAD\), v = P\.data\.v;\s*if \(!s\) return false;/, 'a box is not picked as the nearest open box (empty space must be silent)');
    need('write', /if \(v !== cnt\[s\.k\]\)\{\s*var j = cnt\.indexOf\(v\);\s*if \(cnt\[s\.k\] === 0\) roundMiss\(d\.gWriteZero\(s\.k\)\);\s*else if \(j >= 0 && cnt\[j\] !== 0\) roundMiss\(d\.gWriteSwap\(v, j, s\.k\)\);\s*else roundMiss\(d\.gWriteCount\(s\.k\)\);\s*return false;\s*\}/, 'a wrong digit is accepted, or the reason does not follow the 0 / other place / recount rule');
    need('write', /s\.done = true; s\.v = v; s\.z\.textContent = String\(v\); s\.z\.classList\.add\('filled'\);\s*P\.home\(\);/, 'a digit card does not go back (cards must never run out)');
    need('write', /if \(slots\.every\(function\(x\)\{ return x\.done; \}\)\)\{[\s\S]*?roundSolved\(d\.gWriteDone\(e\.h, e\.t, e\.o, n\)\);/, 'the round is not solved exactly when all three boxes are written');
  }

  /* ================= 第 3 關：備貨（照數放積木；0 就不放） ================= */
  {
    const C = D.BUILD_COL, T = D.BUILD_TOK, H = D.BUILD_H;
    const cols = C.x.map(x => ({ x, y:C.y, w:C.w, h:C.h }));
    cols.forEach((r, k) => inside(r, 'build: column ' + k, W, H));
    rowCheck(cols, D.GPAD, 'build column');
    const toks = [0, 1, 2].map(i => box((W - 2 * T.step) / 2 + i * T.step, T.y, T.size, T.size));
    toks.forEach((r, i) => { inside(r, 'build: block source ' + i, W, H); cols.forEach(c => { if (hit(r, pad(c, D.GPAD))) fail('build: block source ' + i + ' sits inside a column\'s drop zone'); }); });
    noHits(toks, 'build: block sources');
    if (!(D.GAME_BUILD.length >= 3)) fail('GAME_BUILD should have at least 3 entries');
    D.GAME_BUILD.forEach((n, i) => {
      const w = 'GAME_BUILD[' + i + '] ' + n, want = dig3(n);
      if (!(Number.isInteger(n) && n >= 100 && n <= 999)) return fail(w + ' is not a three-digit number');
      if (want[1] !== 0 && want[2] !== 0) fail(w + ' has no 0 — this round is about leaving a place empty');
      if (want[0] + want[1] + want[2] > 10) fail(w + ': ' + (want[0] + want[1] + want[2]) + ' blocks to place — too many for one round');
      /* 每一欄放滿也要在欄裡、不碰到下面的個數 */
      colFits(want, C.x.map(x => x + C.w / 2), C.y + C.top, c => ({ x:cols[c].x, y:cols[c].y, w:C.w, h:C.h - 30 }), w + ' column');
      /* 照規則玩：每一欄收到 want 為止；收滿再放 → 不收；0 那一欄一個都不收 */
      const have = [0, 0, 0];
      let moves = 0;
      for (let k = 0; k < 3; k++) while (have[k] < want[k] && moves++ < 50) have[k]++;
      if (have.join() !== want.join()) fail(w + ': the round never reaches the order');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gBuildOrder ' + L, d.gBuildOrder(n), [n]);
        seq(w + ' gBuildDone ' + L, d.gBuildDone(want[0], want[1], want[2], n), [want[0], want[1], want[2], n]);
        for (let k = 0; k < 3; k++){
          if (want[k] === 0) seq(w + ' gBuildZero ' + L, d.gBuildZero(n, k), [n, 0]);
          else seq(w + ' gBuildEnough ' + L, d.gBuildEnough(n, k, want[k]), [n, want[k], want[k]]);
        }
        /* 每一個到得了的狀態（三欄可以用任何順序放）：「已經放」和「還要放」兩句都要對 */
        for (let a = 0; a <= want[0]; a++) for (let b = 0; b <= want[1]; b++) for (let c = 0; c <= want[2]; c++){
          seq(w + ' gBuildNow ' + L, d.gBuildNow(a, b, c), [a, b, c]);
          seq(w + ' gBuild2 ' + L, d.gBuild2(want[0] - a, want[1] - b, want[2] - c), [want[0] - a, want[1] - b, want[2] - c]);
        }
      });
    });
    LANGS.forEach(L => { for (let k = 0; k < 3; k++) seq('gBuildCol ' + L, I18N[L].gBuildCol(k), []); });
    for (let k = 0; k < 3; k++){
      if (I18N.zh.gBuildCol(k).indexOf(['百位', '十位', '個位'][k]) < 0) fail('gBuildCol zh ' + k + ' names the wrong column: ' + I18N.zh.gBuildCol(k));
      if (I18N.en.gBuildCol(k).indexOf('“' + ['hundreds', 'tens', 'ones'][k] + '”') < 0) fail('gBuildCol en ' + k + ' names the wrong column: ' + I18N.en.gBuildCol(k));
    }
    need('build', /var n = pick\(GAME_BUILD\), want = digits3\(n\), have = \[0, 0, 0\]/, 'the order is not read digit by digit');
    need('build', /var c = nearestOpen\(cols, pt, GPAD\), k = P\.data\.k;\s*if \(!c\) return false;/, 'a column is not picked as the nearest (empty space must be silent)');
    need('build', /if \(c\.k !== k\)\{ roundMiss\(d\.gBuildCol\(k\)\); return false; \}/, 'a block is accepted in another place\'s column');
    need('build', /if \(have\[k\] >= want\[k\]\)\{ roundMiss\(want\[k\] === 0 \? d\.gBuildZero\(n, k\) : d\.gBuildEnough\(n, k, want\[k\]\)\); return false; \}/, 'a block is accepted past the order (or into a place that is 0)');
    need('build', /if \(have\.join\(\) === want\.join\(\)\) roundSolved\(d\.gBuildDone\(want\[0\], want\[1\], want\[2\], n\)\);/, 'the round is not solved exactly when every column matches the order');
    need('build', /renderTray\(B, \[0, 1, 2\], BUILD_TOK\.y, function\(k, cx, cy\)\{/, 'the block sources are not shuffled (they would line up under their own columns)');
    need('build', /P\.home\(\);/, 'a block source does not go back after a drop (it must never run out)');
  }

  /* ================= 第 4 關：排排站（範例 3：先看位數，再從百位比） ================= */
  {
    const S = D.SORT_SLOT, CD = D.SORT_CARD, H = D.SORT_H;
    const slots = S.x.map(x => box(x, S.y, S.w, S.h));
    slots.forEach((r, k) => inside(r, 'sort: box ' + k, W, H));
    rowCheck(slots, D.GPAD, 'sort box');
    const cards = [0, 1, 2, 3].map(i => box((W - 3 * CD.step) / 2 + i * CD.step, CD.y, CD.w, CD.h));
    cards.forEach((r, i) => { inside(r, 'sort: crate ' + i, W, H); slots.forEach(s => { if (hit(r, pad(s, D.GPAD))) fail('sort: crate ' + i + ' sits inside a box\'s drop zone'); }); });
    noHits(cards, 'sort: crates');
    /* 自己的比大小：位數多的大；位數一樣，從最高位往下比 —— 不用減法 */
    const bigger = (a, b) => { const sa = String(a), sb = String(b); if (sa.length !== sb.length) return sa.length > sb.length; for (let p = 0; p < sa.length; p++) if (sa[p] !== sb[p]) return sa[p] > sb[p]; return false; };
    /* 頁面的 why() 從原始碼切出來，跟著那一種語言的字典真的跑 */
    const wsrc = extractFunction(src, 'why');
    let whyOf = null;
    if (!wsrc) fail('sort: cannot find why() in index.html');
    else { try { whyOf = d => new Function('d', wsrc + '\nreturn why;')(d); } catch (e){ fail('sort: why() could not be evaluated: ' + e.message); } }
    if (!(D.GAME_SORT.length >= 3)) fail('GAME_SORT should have at least 3 entries');
    D.GAME_SORT.forEach((set, i) => {
      const w = 'GAME_SORT[' + i + '] ' + set.join(',');
      if (set.length !== 4 || new Set(set).size !== 4) return fail(w + ': needs four different numbers');
      if (!set.every(v => Number.isInteger(v) && v >= 10 && v <= 999)) fail(w + ': numbers must be 10~999');
      if (!set.some(v => v < 100) || !set.some(v => v >= 100)) fail(w + ': needs a two-digit number next to three-digit ones (the "more digits" step)');
      if (!set.some(a => set.some(b => a !== b && a >= 100 && b >= 100 && Math.floor(a / 100) === Math.floor(b / 100) && Math.floor(a / 10) % 10 !== Math.floor(b / 10) % 10))) fail(w + ': needs a pair with the same hundreds and different tens (the "look at the tens" step)');
      const order = [];
      const rest = set.slice();
      while (rest.length){ let m = rest[0]; rest.forEach(v => { if (bigger(m, v)) m = v; }); order.push(m); rest.splice(rest.indexOf(m), 1); }
      if (order.join() !== set.slice().sort((a, b) => a - b).join()) fail(w + ': digit-by-digit comparison disagrees with the number order');
      /* 照規則玩：第 k 格只收第 k 小的；每一個放錯的組合都要說出對的「誰大、哪一位決定」 */
      LANGS.forEach(L => {
        const d = I18N[L], why = whyOf ? whyOf(d) : null;
        for (let k = 0; k < 4; k++) set.forEach(v => {
          const c = order[k];
          if (v === c) return;
          const big = bigger(v, c) ? v : c, sm = big === v ? c : v, sb = String(big), ss = String(sm);
          let wantWhy;
          if (sb.length !== ss.length) wantWhy = d.gSortWhyLen(big, sm);
          else { let p = 0; while (sb[p] === ss[p]) p++; wantWhy = d.gSortWhyPlace(p, +sb[p], +ss[p]);
            seq(w + ' gSortWhyPlace ' + L, wantWhy, [+sb[p], +ss[p]]);
            if (wantWhy.indexOf(L === 'zh' ? ['百位', '十位', '個位'][p] : ['hundreds', 'tens', 'ones'][p]) < 0) fail(w + ': the reason for ' + big + ' > ' + sm + ' names the wrong place: ' + wantWhy);
          }
          if (why && why(big, sm) !== wantWhy) fail(w + ' ' + L + ': why(' + big + ', ' + sm + ') says "' + why(big, sm) + '", should be "' + wantWhy + '"');
          const msgT = big === v ? d.gSortBig(v, c, wantWhy) : d.gSortSmall(v, c, wantWhy);
          seq(w + ' ' + (big === v ? 'gSortBig ' : 'gSortSmall ') + L, msgT, [v, c].concat(nums(wantWhy)));
        });
        for (let k = 0; k < 4; k++) seq(w + ' gSort2 ' + L, d.gSort2(k, order[k]), [k + 1, order[k]]);
        seq(w + ' gSortDone ' + L, d.gSortDone(order), order);
      });
    });
    LANGS.forEach(L => {
      seq('gSortWhyLen ' + L, I18N[L].gSortWhyLen(105, 89), [105, 89]);
      if (/\d/.test(I18N[L].gSortArrow)) fail('gSortArrow ' + L + ' has a number in it');
    });
    need('sort', /order = set\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\)/, 'the target order is not the numbers sorted smallest first');
    need('sort', /var s = nearestOpen\(slots, pt, GPAD\), v = P\.data\.v;\s*if \(!s\) return false;\s*var c = order\[s\.k\];/, 'a box is not picked as the nearest, or box k does not want the k-th smallest');
    need('sort', /if \(v !== c\)\{ roundMiss\(v > c \? d\.gSortBig\(v, c, why\(v, c\)\) : d\.gSortSmall\(v, c, why\(c, v\)\)\); return false; \}/, 'a crate is accepted in the wrong box, or the reason compares the wrong way round');
    need('sort', /if \(slots\.every\(function\(x\)\{ return x\.done; \}\)\) roundSolved\(d\.gSortDone\(order\)\);/, 'the round is not solved exactly when all four boxes are filled');
    need('sort', /renderTray\(B, set, SORT_CARD\.y,/, 'the crates are not shuffled');
  }

  /* ================= 第 5 關：開貨車（+100／+10／+1，滿十換） ================= */
  {
    const P = D.HOP_PIC, H = D.HOP_H;
    if (D.HOP_STEPS.slice().sort((a, b) => a - b).join() !== '1,10,100') fail('HOP_STEPS should be 100, 10 and 1');
    const frames = P.x.map(x => ({ x:x - 47, y:4, w:94, h:H - 8 }));
    frames.forEach((f, c) => inside(f, 'hop: column ' + c, W, H));
    noHits(frames, 'hop: columns');
    /* 頁面的兩條「滿十換」條件從原始碼切出來真的跑，和自己的「那一位繞回 0」比 */
    const m10 = B.hop.match(/\n\s*if \(([^\n]*?)\) say\.push\(d\.gHopCarry10\);/);
    const m100 = B.hop.match(/\n\s*if \(([^\n]*?)\) say\.push\(d\.gHopCarry100\);/);
    if (!m10 || !m100) fail('hop: cannot find the two swap conditions (say.push(d.gHopCarry10 / gHopCarry100))');
    else {
      const f10 = new Function('k', 'before', 'cur', 'return ' + m10[1] + ';'), f100 = new Function('k', 'before', 'cur', 'return ' + m100[1] + ';');
      let bad = 0;
      for (let before = 100; before < 990; before++) D.HOP_STEPS.forEach(k => {
        const cur = before + k; if (cur > 999) return;
        const b = dig3(before), a = dig3(cur);
        /* 「滿 10 個一」＝個位繞回去（變小了）；「滿 10 個十」＝十位繞回去。+100 不動十位與個位 */
        if (f10(k, before, cur) !== (a[2] < b[2])) bad++;
        if (f100(k, before, cur) !== (a[1] < b[1])) bad++;
      });
      if (bad) fail('hop: the swap messages fire ' + bad + ' times when no place wraps around (or stay silent when one does)');
    }
    if (!(D.GAME_HOP.length >= 3)) fail('GAME_HOP should have at least 3 entries');
    D.GAME_HOP.forEach((e, i) => {
      const w = 'GAME_HOP[' + i + '] ' + e.from + '→' + e.to;
      if (!(Number.isInteger(e.from) && Number.isInteger(e.to) && e.from >= 100 && e.to <= 999 && e.to > e.from)) return fail(w + ': needs 100 ≤ from < to ≤ 999');
      if (e.to - e.from > 150) fail(w + ': ' + (e.to - e.from) + ' to drive — too far for one round');
      /* 每一題都要跨過一個十：+1 那一段一定會讓個位繞回 0 */
      if (e.from % 10 + (e.to - e.from) % 10 < 10) fail(w + ': the +1 part never crosses a ten — the swap is never seen');
      /* 照規則玩：每一個到得了的位置都還有一個按鈕不會開過頭（+1），所以一定開得到；開過頭的每一種按法說明都對 */
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let cur = e.from; cur <= e.to; cur++){
          if (cur < e.to && cur + 1 > e.to) fail(w + ': stuck at ' + cur);
          D.HOP_STEPS.forEach(k => { if (cur + k > e.to) seq(w + ' gHopOver ' + L, d.gHopOver(cur, k, cur + k, e.to), [cur, k, cur + k, e.to]); });
          const r = e.to - cur, r3 = dig3(r);
          if (r3[0] * 100 + r3[1] * 10 + r3[2] !== r) fail(w + ': the hint splits ' + r + ' wrongly');
          seq(w + ' gHop2 ' + L, d.gHop2(r, r3[0], r3[1], r3[2]), [r, r3[0], r3[1], r3[2]]);
          seq(w + ' gHopNow ' + L, d.gHopNow(cur, e.to), [cur, e.to]);
        }
        seq(w + ' gHopDone ' + L, d.gHopDone(e.from, e.to), [e.from, e.to]);
      });
      colFits([9, 9, 9], P.x, P.top, c => ({ x:frames[c].x, y:frames[c].y, w:94, h:H - 8 - 28 }), 'hop: a full column');
    });
    seq('gHopCarry10 zh', I18N.zh.gHopCarry10, [10, 1]); seq('gHopCarry100 zh', I18N.zh.gHopCarry100, [10, 1]);
    seq('gHopCarry10 en', I18N.en.gHopCarry10, [1]); seq('gHopCarry100 en', I18N.en.gHopCarry100, [1]);
    if (!/個一/.test(I18N.zh.gHopCarry10) || !/個百/.test(I18N.zh.gHopCarry100) || !/ones/.test(I18N.en.gHopCarry10) || !/hundred/.test(I18N.en.gHopCarry100)) fail('hop: the two swap messages are mixed up');
    need('hop', /var e = pick\(GAME_HOP\), cur = e\.from;/, 'the truck does not start at from');
    need('hop', /var to = cur \+ k;\s*if \(to > e\.to\)\{ roundMiss\(d\.gHopOver\(cur, k, to, e\.to\)\); return; \}/, 'a hop past the finish is accepted (or moves the truck)');
    need('hop', /if \(cur === e\.to\)\{\s*btns\.forEach\(function\(x\)\{ x\.disabled = true; \}\);\s*roundSolved\(/, 'the round is not solved exactly at the finish (or the buttons stay live)');
    need('hop', /var btns = HOP_STEPS\.map\(function\(k\)\{[\s\S]*?b\.textContent = '\+' \+ k;/, 'the buttons are not +100 / +10 / +1');
    need('hop', /drawn = drawColumns\(B, c3, HOP_PIC\.x, HOP_PIC\.top\);/, 'the picture is not redrawn from the current number');
  }
  /* --- codex 第一輪：狀態真的往前走（每一關讓答案前進的那一行；改壞就永遠解不完） --- */
  need('pack', /var s = crateSlotXY\(inCrate\); inCrate\+\+;/, 'a ten in the crate does not count one more');
  need('write', /s\.done = true; s\.v = v;/, 'a written box is not marked done');
  need('build', /addBlock\(B, kinds\[k\], blockXY\(kinds\[k\], have\[k\], c\.cx, C\.y \+ C\.top\)\);\s*have\[k\]\+\+;/, 'a placed block does not count one more');
  need('sort', /s\.done = true; P\.lock\(s\.cx, s\.cy\);/, 'a crate in its box is not marked done');
  need('hop', /var before = cur, say = \[\];\s*cur = to;\s*draw\(\);/, 'a hop does not move the truck');
  /* 先點選、又直接拖走的那一塊不可以還是「選起來」的（codex 第一輪） */
  if (!/el\.classList\.remove\('dragging'\);\s*\/\*[\s\S]*?\*\/\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); return; \}/.test(src)) fail('a piece that was tapped and then dragged stays selected — a later tap on a box drops it again');

  /* --- codex 第一輪：說明的「字」也要對，不只是數字 --- */
  LANGS.forEach(L => {
    const d = I18N[L], zh = L === 'zh';
    const has = (where, text, words) => words.forEach(w => { if (String(text).indexOf(w) < 0) fail(where + ' ' + L + ' should say "' + w + '": ' + text); });
    has('gSortBig', d.gSortBig(307, 215, 'x'), [zh ? '307 比 215 大' : '307 is bigger than 215']);
    has('gSortSmall', d.gSortSmall(215, 307, 'x'), [zh ? '215 比 307 小' : '215 is smaller than 307']);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++){
      if (j === k) continue;
      has('gWriteSwap', d.gWriteSwap(4, j, k), zh ? ['是' + D.kindNameZh(j) + '的個數，要寫在' + D.cmpNameZh(j), D.cmpNameZh(k) + '寫' + D.kindNameZh(k)]
        : ['how many ' + D.kindNameEn(j, 0) + ' there are — it goes in the ' + D.cmpNameEn(j) + ' box', 'The ' + D.cmpNameEn(k) + ' box counts the ' + D.kindNameEn(k, 0)]);
    }
    has('gHopCarry10', d.gHopCarry10, zh ? ['10 個一', '1 個十'] : ['Ten ones', '1 ten']);
    has('gHopCarry100', d.gHopCarry100, zh ? ['10 個十', '1 個百'] : ['Ten tens', '1 hundred']);
    has('gPackNotH', d.gPackNotH, zh ? ['10 條十', '1 個百'] : ['10 tens', '1 hundred']);
    has('gHopOver', d.gHopOver(300, 100, 400, 315), zh ? ['開過頭'] : ['past the finish']);
  });

  /* --- 托盤不可以一開始就由小到大（team-lead 2026-10-02；三年級 numbers 同一條）：shuffle() 從原始碼切出來，
     Math.random 換成「一定洗回原樣」的假亂數，題庫裡每一組（已經排好的）都必須被打亂；真亂數跑 2000 次也一次都不可以是由小到大 --- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    const up = a => a.every((v, i) => i === 0 || a[i - 1] < v);
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else {
      try {
        const fake = { floor:Math.floor, random:() => 0.999999 };   /* k = j：每一步都和自己交換 = 原樣 */
        const forced = new Function('Math', fsrc + '\nreturn shuffle;')(fake);
        const real = new Function(fsrc + '\nreturn shuffle;')();
        const sets = D.GAME_SORT.map(x => x.slice().sort((a, b) => a - b)).concat([[0, 1, 2]]);
        sets.forEach(a => {
          const out = forced(a);
          if (out.slice().sort((x, y) => x - y).join() !== a.join()) fail('shuffle() changed the set ' + a.join());
          if (up(out)) fail('shuffle() can leave the tray already sorted (' + out.join() + ') — the sort round is solved before it starts');
          for (let i = 0; i < 2000; i++) if (up(real(a))){ fail('shuffle() returned ' + a.join() + ' already sorted with a real Math.random'); break; }
        });
      } catch (e){ fail('shuffle() could not run: ' + e.message); }
    }
  }

}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/numbers */
  breaks: [
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'correct is not the digit at that place',
      find:'        var correct = digs[pos];',
      replace:'        var correct = digs[(pos + 1) % 3];' },
    { file:'review', expect:'correct != dg * placeValue',
      find:'        var correct = dg * scale;',
      replace:'        var correct = dg * scale * 10;' },
    { file:'review', expect:'correct != t*10',
      find:'        var correct = t * 10;\n        /* 誘答都是「位值放錯」',
      replace:'        var correct = t * 100;\n        /* 誘答都是「位值放錯」' },
    { file:'review', expect:'correct != a*100 + b*10 + c',
      find:'        var n = a * 100 + b * 10 + c;\n        var m = mixOpts(n, [a * 100 + c * 10 + b,',
      replace:'        var n = a * 100 + b * 10 + c + 1;\n        var m = mixOpts(n, [a * 100 + c * 10 + b,' },
    { file:'review', expect:'correct != a*10',
      find:'        var correct = a * 10;\n        var m = mixOpts(correct, [a, correct + 10, correct - 10, correct + 100]);',
      replace:'        var correct = a * 100;\n        var m = mixOpts(correct, [a, correct + 10, correct - 10, correct + 100]);' },
    { file:'review', expect:'correct != b*100 + c',
      find:'        var correct = b * 100 + c;',
      replace:'        var correct = b * 100 + c * 10;' },
    { file:'review', expect:'biggest: correct is not the largest option',
      find:'        var correct = Math.max.apply(null, nums);',
      replace:'        var correct = Math.min.apply(null, nums);' },
    { file:'review', expect:'smallest: correct is not the smallest option',
      find:'        var correct = Math.min.apply(null, nums);\n        var m = pickAmong(nums, correct);\n        return { h1:h1,',
      replace:'        var correct = Math.max.apply(null, nums);\n        var m = pickAmong(nums, correct);\n        return { h1:h1,' },
    { file:'review', expect:'why says the tens decide it, but the tens are equal',
      find:'        var d1 = rand(10), d2 = rand(10);\n        while (d2 === d1) d2 = rand(10);',
      replace:'        var d1 = rand(10), d2 = d1;' },
    { file:'review', expect:'correct != n + 2',
      find:'        var correct = n + 2;',
      replace:'        var correct = n + 3;' },
    { file:'review', expect:'correct != start + 30',
      find:'        var correct = start + 30;',
      replace:'        var correct = start + 20;' },
    { file:'review', expect:'correct != n + 200',
      find:'        var correct = n + 200;',
      replace:'        var correct = n + 100;' },
    { file:'review', expect:'outside 0~1000',
      find:'        var base = pickUnused([1,2,3], used);\n        var n = base * 100 + rand(10) * 10 + rand(10);',
      replace:'        var base = pickUnused([7,8,9], used);\n        var n = base * 100 + rand(10) * 10 + rand(10);' },
    /* 這一行有兩個守門條件，只有 `v !== h * 100` 那一半有保護對象：
       把 9×9×9 的參數空間整個跑過一遍，`v === o` 一次都不會發生
       （候選只有 t、t*100、correct±10、correct+100，都碰不到個位數 o），
       所以改壞那一半不會有任何反應。改壞測試要打在打得到的那一半。
       `v !== o` 是多餘的守門條件，留著無害，但不要以為它有被驗過。 */
    { file:'review', expect:'copied straight out of the stem',
      find:'        cands = cands.filter(function(v){ return v !== h * 100 && v !== o; });',
      replace:'        cands = cands.filter(function(v){ return v !== o; });' },
    /* codex 第一輪（2026-08-26）指出的 fail-open：dg 與 pos 都是產生器給的，
       只比它們兩個等於自己比自己。 */
    { file:'review', expect:'is not the digit at position',
      find:'        var dg = digs[pos];',
      replace:'        var dg = digs[(pos + 1) % 3];' },
    { file:'review', expect:'does not name the',
      find:"            ? d.n + ' 的' + t.places[d.pos] + '數字是多少？'",
      replace:"            ? d.n + ' 的' + t.places[(d.pos + 1) % 3] + '數字是多少？'" },
    { file:'review', expect:'the skip-ten stem is not start',
      find:"        stem: d.start + '、' + (d.start + 10) + '、' + (d.start + 20) + '、?',",
      replace:"        stem: d.start + '、' + (d.start + 10) + '、' + (d.start + 30) + '、?'," },
    { file:'review', expect:'wrong singular/plural',
      find:"function nEn(n, k){ return n + ' ' + (n === 1 ?",
      replace:"function nEn(n, k){ return n + ' ' + (n === -1 ?" },
    /* --- 小遊戲「倉庫點貨」（§六之五，2026-10-02）：每一條遊戲斷言一筆 --- */
    { file:'index', expect:"a single ten is accepted in the hundreds column",
      find:"if (z === hcol){ roundMiss(d.gPackNotH); return false; }",
      replace:"if (false){ roundMiss(d.gPackNotH); return false; }" },
    { file:'index', expect:"a ten is accepted in the ones column",
      find:"if (z === ocol){ roundMiss(d.gPackNotO); return false; }",
      replace:"if (false){ roundMiss(d.gPackNotO); return false; }" },
    { file:'index', expect:"takes the first match instead of the nearest",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"points inside the crate or a column are given to another target",
      find:"var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"var dd = dx * dx + dy * dy, dc = dd;" },
    { file:'index', expect:"is moved into its neighbour",
      find:"    list.forEach(function(b){\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;\n      if (Math.abs(dx) > b.hw + pad",
      replace:"    list.filter(function(b){ return !b.done; }).forEach(function(b){\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;\n      if (Math.abs(dx) > b.hw + pad" },
    { file:'index', expect:"no longer inside PACK_PAD",
      find:"var PACK_HCOL = { x:8, y:110, w:140, h:112 }, PACK_OCOL = { x:156, y:110, w:136, h:112 }",
      replace:"var PACK_HCOL = { x:8, y:116, w:140, h:106 }, PACK_OCOL = { x:156, y:116, w:136, h:106 }" },
    { file:'index', expect:"tens — should be 11~14",
      find:"var GAME_PACK = [ { h:1, t:13, o:5 },",
      replace:"var GAME_PACK = [ { h:1, t:9, o:5 }," },
    { file:'index', expect:"does not turn into one more hundred exactly at 10",
      find:"if (inCrate === 10){",
      replace:"if (inCrate === 9){" },
    { file:'index', expect:"the result is not (h + 1) hundreds",
      find:"n = (e.h + 1) * 100 + (e.t - 10) * 10 + e.o, inCrate = 0",
      replace:"n = e.h * 100 + (e.t - 10) * 10 + e.o, inCrate = 0" },
    { file:'index', expect:"gPackDone zh: numbers should read",
      find:"' 個百、' + (t - 10) + ' 個十、'",
      replace:"' 個百、' + t + ' 個十、'" },
    { file:'index', expect:"loose tens 0 and 1 overlap",
      find:"var PACK_PILE = { y:266, step:50,",
      replace:"var PACK_PILE = { y:266, step:46," },
    { file:'index', expect:"a loose ten (44×56) is",
      find:"perRow:6, w:GPICK, h:56",
      replace:"perRow:6, w:44, h:56" },
    { file:'index', expect:"sits inside a drop zone",
      find:"var PACK_PILE = { y:266,",
      replace:"var PACK_PILE = { y:250," },
    { file:'index', expect:"a wrong digit is accepted",
      find:"if (v !== cnt[s.k]){",
      replace:"if (v !== cnt[s.k] && false){" },
    { file:'index', expect:"does not follow the 0 / other place / recount rule",
      find:"if (cnt[s.k] === 0) roundMiss(d.gWriteZero(s.k));",
      replace:"if (cnt[s.k] === 9) roundMiss(d.gWriteZero(s.k));" },
    { file:'index', expect:"has no 0 — this round is about the 0",
      find:"var GAME_WRITE = [ { h:4, t:0, o:7 },",
      replace:"var GAME_WRITE = [ { h:4, t:1, o:7 }," },
    { file:'index', expect:"cards must never run out",
      find:"s.z.classList.add('filled');\n        P.home();",
      replace:"s.z.classList.add('filled');\n        P.lock(s.cx, s.cy);" },
    { file:'index', expect:"write box: the boxes are",
      find:"var WRITE_SLOT = { y:150, size:56, x:[90, 150, 210]",
      replace:"var WRITE_SLOT = { y:150, size:56, x:[80, 150, 220]" },
    { file:'index', expect:"gWriteZero en 0 names the wrong place or block",
      find:"return 'There are no ' + kindNameEn(k, 0)",
      replace:"return 'There are no ' + kindNameEn((k + 1) % 3, 0)" },
    { file:'index', expect:"gWriteSwap zh: numbers should read",
      find:"return v + ' 是' + kindNameZh(j)",
      replace:"return (v + 1) + ' 是' + kindNameZh(j)" },
    { file:'index', expect:"the picture runs into the box labels",
      find:"x:[90, 150, 210], hdY:102 }",
      replace:"x:[90, 150, 210], hdY:92 }" },
    { file:'index', expect:"accepted in another place's column",
      find:"if (c.k !== k){ roundMiss(d.gBuildCol(k)); return false; }",
      replace:"if (false){ roundMiss(d.gBuildCol(k)); return false; }" },
    { file:'index', expect:"accepted past the order",
      find:"if (have[k] >= want[k]){",
      replace:"if (have[k] > want[k]){" },
    { file:'index', expect:"renders its options without shuffle",
      find:"shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:"has no 0 — this round is about leaving a place empty",
      find:"var GAME_BUILD = [306,",
      replace:"var GAME_BUILD = [316," },
    { file:'index', expect:"gBuildCol zh 0 names the wrong column",
      find:"'，要放在「' + cmpNameZh(k) + '」那一欄。'",
      replace:"'，要放在「' + cmpNameZh(2 - k) + '」那一欄。'" },
    { file:'index', expect:"block source 0 sits inside",
      find:"BUILD_TOK = { y:250, size:60, step:96 }",
      replace:"BUILD_TOK = { y:212, size:60, step:96 }" },
    { file:'index', expect:"gBuildEnough en: numbers should read",
      find:"' is ' + w + ', so ' + w + ' ' + unitEn(k, w) + ' is enough.'",
      replace:"' is ' + w + ', so ' + (w + 1) + ' ' + unitEn(k, w) + ' is enough.'" },
    { file:'index', expect:"a crate is accepted in the wrong box",
      find:"if (v !== c){ roundMiss(",
      replace:"if (v !== c && false){ roundMiss(" },
    { file:'index', expect:"compares the wrong way round",
      find:"v > c ? d.gSortBig(v, c, why(v, c)) : d.gSortSmall(v, c, why(c, v))",
      replace:"v > c ? d.gSortBig(v, c, why(c, v)) : d.gSortSmall(v, c, why(c, v))" },
    { file:'index', expect:": why(",
      find:"if (sa.length !== sb.length) return d.gSortWhyLen(a, b);",
      replace:"if (sa.length !== sb.length) return d.gSortWhyLen(b, a);" },
    { file:'index', expect:"names the wrong place",
      find:"+ cmpNameZh(p) + ' ' + a + ' 比 '",
      replace:"+ cmpNameZh((p + 1) % 3) + ' ' + a + ' 比 '" },
    { file:'index', expect:"needs a two-digit number",
      find:"[ [89, 307, 370, 215],",
      replace:"[ [189, 307, 370, 215]," },
    { file:'index', expect:"needs a pair with the same hundreds",
      find:"[731, 713, 88, 317]",
      replace:"[731, 613, 88, 317]" },
    { file:'index', expect:"sort box: the boxes are",
      find:"SORT_SLOT = { y:72, w:66, h:56, x:[42, 114, 186, 258] }",
      replace:"SORT_SLOT = { y:72, w:66, h:56, x:[36, 114, 186, 264] }" },
    { file:'index', expect:"a hop past the finish is accepted",
      find:"if (to > e.to){ roundMiss(",
      replace:"if (to > e.to + 100){ roundMiss(" },
    { file:'index', expect:"swap messages fire",
      find:"if (k === 1 && before % 10 === 9) say.push(d.gHopCarry10);",
      replace:"if (k === 1 && before % 10 === 8) say.push(d.gHopCarry10);" },
    { file:'index', expect:"swap messages fire",
      find:"if (k !== 100 && Math.floor(cur / 100) > Math.floor(before / 100)) say.push(d.gHopCarry100);",
      replace:"if (Math.floor(cur / 100) > Math.floor(before / 100)) say.push(d.gHopCarry100);" },
    { file:'index', expect:"never crosses a ten",
      find:"{ from:296, to:315 }",
      replace:"{ from:291, to:315 }" },
    { file:'index', expect:"not solved exactly at the finish",
      find:"if (cur === e.to){",
      replace:"if (cur >= e.to - 1){" },
    { file:'index', expect:"gHopOver en: numbers should read",
      find:"' = ' + res + ' — that drives past",
      replace:"' = ' + (res + 1) + ' — that drives past" },
    { file:'index', expect:"gHop2 zh: numbers should read",
      find:"'還差 ' + diff + '，就是 ' + a +",
      replace:"'還差 ' + diff + '，就是 ' + b +" },
    { file:'index', expect:"its instructions must say it is all taps",
      find:"（這一關用點的）",
      replace:"" },
    { file:'index', expect:"mistake(s) gives 2 stars, should be 1",
      find:"var stars = gMistakes === 0 ? 2 : 1;",
      replace:"var stars = 2;" },
    { file:'index', expect:"a mistake changed the score",
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); gMsg.innerHTML" },
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"if (mode === 'ahead'){ hintLevel = 1; }" },
    { file:'index', expect:"not disabled after the second level",
      find:"if (hintLevel >= 2) gHintBtn.disabled = true;",
      replace:"if (hintLevel >= 3) gHintBtn.disabled = true;" },
    { file:'index', expect:"must be singular",
      find:"function unitEn(k, n){ return (n === 1 ?",
      replace:"function unitEn(k, n){ return (n === 0 ?" },
    { file:'index', expect:"GPICK is",
      find:"var GAME_W = 300, GPICK = 48,",
      replace:"var GAME_W = 300, GPICK = 44," },
    { file:'index', expect:"blockXY(t,",
      find:"return { x:cx + (i % b.per - (b.per - 1) / 2) * b.sx,",
      replace:"return { x:cx + (i % b.per - (b.per - 1) / 2) * b.sx * (b.w === 10 ? 0.6 : 1)," },
    { file:'index', expect:"blocks of kind t",
      find:"t:{ w:10, h:40, per:5, sx:14, sy:46 }",
      replace:"t:{ w:10, h:40, per:5, sx:9, sy:46 }" },
    /* --- codex 第一輪（2026-10-02）補的 --- */
    { file:'index', expect:"a ten in the crate does not count one more",
      find:"var s = crateSlotXY(inCrate); inCrate++;",
      replace:"var s = crateSlotXY(inCrate); inCrate += 0;" },
    { file:'index', expect:"a written box is not marked done",
      find:"s.done = true; s.v = v;",
      replace:"s.done = false; s.v = v;" },
    { file:'index', expect:"a placed block does not count one more",
      find:"        have[k]++; c.cnt.textContent",
      replace:"        have[k] += 0; c.cnt.textContent" },
    { file:'index', expect:"a crate in its box is not marked done",
      find:"s.done = true; P.lock(s.cx, s.cy);",
      replace:"s.done = false; P.lock(s.cx, s.cy);" },
    { file:'index', expect:"a hop does not move the truck",
      find:"          cur = to;\n          draw();",
      replace:"          cur = before;\n          draw();" },
    { file:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"" },
    { file:'index', expect:"gBuildNow en: numbers should read",
      find:"return 'Packed so far: ' + htoEn(a, b, c);",
      replace:"return 'Packed so far: ' + htoEn(a, b + 1, c);" },
    { file:'index', expect:"gBuild2 zh: numbers should read",
      find:"return '還要放 ' + a + ' 個百、' + b + ' 個十、' + c + ' 個一。';",
      replace:"return '還要放 ' + a + ' 個百、' + b + ' 個十、' + (b === 0 && c < 2 ? c + 1 : c) + ' 個一。';" },
    { file:'index', expect:"same hundreds and different tens",
      find:"[731, 713, 88, 317]",
      replace:"[731, 739, 88, 317]" },
    { file:'index', expect:"gSortBig en should say",
      find:"return v + ' is bigger than ' + c",
      replace:"return v + ' is smaller than ' + c" },
    { file:'index', expect:"gWriteSwap zh should say",
      find:"'的個數，要寫在' + cmpNameZh(j) + '。'",
      replace:"'的個數，要寫在' + cmpNameZh(k) + '。'" },
    { file:'index', expect:"gHopCarry100 en should say",
      find:"gHopCarry100:'Ten tens! They swap for 1 hundred.',",
      replace:"gHopCarry100:'Ten hundreds! They swap for 1 hundred.'," },
    /* --- codex 第二輪（2026-10-02）補的 --- */
    { file:'index', expect:"gSortSmall en should say",
      find:"return v + ' is smaller than ' + c + ' (' + why + ') — it goes further left.'",
      replace:"return v + ' is bigger than ' + c + ' (' + why + ') — it goes further left.'" },
    { file:'index', expect:"gHopCarry10 zh should say",
      find:"gHopCarry10:'滿 10 個一，換成 1 個十！',",
      replace:"gHopCarry10:'滿 10 個十，換成 1 個十！'," },
    { file:'index', expect:"gPackNotH en should say",
      find:"gPackNotH:'One bar is not a hundred yet: fill the crate with 10 tens, then they swap for 1 hundred.',",
      replace:"gPackNotH:'One bar is not a hundred yet: fill the crate with 10 ones, then they swap for 1 hundred.'," },
    { file:'index', expect:"gHopOver zh should say",
      find:"'，開過頭了（終點是 '",
      replace:"'，還沒到（終點是 '" },
    { file:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n      if (cancelled || gSolved){",
      replace:"      if (cancelled || gSolved){ P.home(); return; }\n      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n      if (cancelled || gSolved){" },
    /* --- 托盤不可以一開始就排好（team-lead，2026-10-02） --- */
    { file:'index', expect:'can leave the tray already sorted',
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"" },
    { file:'index', expect:'PLACE_NUMS has no number with a 0 in the tens place',
      find:'  var PLACE_NUMS = [345, 508, 470, 906];',
      replace:'  var PLACE_NUMS = [345, 581, 470, 916];' },
    { file:'index', expect:'has no reading in',
      find:"      reads:{ 345:'三百四十五', 508:'五百零八', 470:'四百七十', 906:'九百零六' },",
      replace:"      reads:{ 345:'三百四十五', 508:'五百零八', 470:'四百七十' }," },
    { file:'index', expect:'PAIRS has no pair with a different number of digits',
      find:'    { a:89,  b:105 }',
      replace:'    { a:189, b:105 }' },
    { file:'index', expect:'PAIRS has no pair that ties on the hundreds',
      find:'    { a:307, b:370 },\n    { a:485, b:458 },',
      replace:'    { a:307, b:470 },\n    { a:485, b:258 },' },
    { file:'index', expect:'walks past 1000',
      find:'  var START_NUMS = [8, 97, 195];\n  var MAX_STEPS = 12;',
      replace:'  var START_NUMS = [8, 97, 995];\n  var MAX_STEPS = 12;' },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'300 + 50 + 2 = 352。'",
      replace:"why:'300 + 50 + 2 = 353。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'300 + 50 + 2 = 352.'",
      replace:"why:'Three hundred fifty two.'" }
  ],

  sim: {
    /* 這一課的 fmt() 會用 TXT（題幹要印「百位／十位／個位」），而 TXT 宣告在
       「工具」那一段之前，所以把切片起點往前移到 TXT。中間那 37 行是純資料，
       不碰 DOM。 */
    blockStart: '  var TXT = {',

    /* 每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
       沒有定義的產生器會被 simgen 判 NO INVARIANT DEFINED。 */
    INVARIANTS: {
      digitOf: d => {
        if (d.n !== d.h * 100 + d.t * 10 + d.o) return 'n != h*100+t*10+o';
        if (d.h < 1) return 'not a three-digit number';
        const digs = [d.h, d.t, d.o];
        if (digs[d.pos] !== d.correct) return 'correct is not the digit at that place';
        if (d.correct < 0 || d.correct > 9) return 'a place digit must be 0~9';
      },
      valueOfDigit: d => {
        /* dg 與 pos 都是產生器給的，只比它們兩個等於拿它自己比自己：
           先從 n 把那一位的數字挖出來，確認 dg 真的站在 pos 那一格。 */
        const digs = [Math.floor(d.n / 100), Math.floor(d.n / 10) % 10, d.n % 10];
        if (digs[d.pos] !== d.dg)
          return 'dg ' + d.dg + ' is not the digit at position ' + d.pos + ' of ' + d.n;
        if (d.dg * PLACES[d.pos] !== d.correct) return 'correct != dg * placeValue';
        /* 產生器刻意只挑非 0 的位（題幹是「N 表示多少」，N = 0 讀起來不成立）。
           將來若要出「0 表示多少」，這一條要連同題幹一起重新想。 */
        if (d.dg < 1) return 'why reads "the N stands for" — N must be a real digit, not 0';
        if (String(d.n).split('').filter(c => c === String(d.dg)).length !== 1)
          return 'the digit appears more than once, so "the {dg}" is ambiguous';
      },
      expandBlank: d => {
        if (d.correct !== d.t * 10) return 'correct != t*10';
        if (d.h * 100 + d.correct + d.o !== d.n) return 'the expansion does not add up to n';
        if (d.t < 1 || d.o < 1) return 'a 0 part would print "+ 0 +", which the stem does not intend';
      },
      buildFromParts: d => {
        if (d.n !== d.a * 100 + d.b * 10 + d.c) return 'correct != a*100 + b*10 + c';
        if (d.a < 1) return 'why talks about hundreds, so a must be >= 1';
      },
      regroupTens: d => {
        if (d.correct !== d.a * 10) return 'correct != a*10';
        if (d.a < 10) return 'why says "10 tens swap for 1 hundred" — needs at least 10 tens';
        if (d.correct > MAX) return 'result above the lesson range';
      },
      wordHundreds: d => {
        if (d.correct !== d.b * 100 + d.c) return 'correct != b*100 + c';
        if (d.c > 9) return 'the loose items must stay under one ten, or the stem is ambiguous';
        if (d.kind < 0 || d.kind > 2) return 'kind out of range';
      },
      biggest: d => {
        const nums = d.opts.map(Number);
        if (Math.max.apply(null, nums) !== d.correct) return 'biggest: correct is not the largest option';
        if (nums.some(v => Math.floor(v / 100) !== d.h))
          return 'why says every option shares the hundreds digit, but they do not';
      },
      smallest: d => {
        const nums = d.opts.map(Number);
        if (Math.min.apply(null, nums) !== d.correct) return 'smallest: correct is not the smallest option';
        if (Math.floor(d.correct / 100) !== d.h1) return 'the smallest is not in the low-hundreds group';
        /* why 說「百位一樣的再比十位」—— 要讓那句話成立，正解的十位必須**嚴格小於**
           同百位那一組裡其他每一個數的十位。（比「全部十位互不相同」寬，
           但更貼近解釋真正宣稱的事：決勝的是十位，不是個位。） */
        const lowOthers = nums.filter(v => Math.floor(v / 100) === d.h1 && v !== d.correct)
                              .map(v => Math.floor(v / 10) % 10);
        const ct = Math.floor(d.correct / 10) % 10;
        if (lowOthers.some(t => t <= ct)) return 'why says the tens decide it, but the tens are equal';
      },
      nextNumber: d => {
        if (d.correct !== d.n + 2) return 'correct != n + 2';
        if (d.n % 10 !== 8) return 'why is about crossing a ten — the stem must end in 8';
      },
      skipTen: d => {
        if (d.correct !== d.start + 30) return 'correct != start + 30';
        if (d.correct > MAX) return 'result above the lesson range';
      },
      skipHundred: d => {
        if (d.correct !== d.n + 200) return 'correct != n + 200';
        if (d.correct > MAX) return 'result above the lesson range';
        if (Math.floor(d.n / 100) + 2 > 9) return 'the hundreds digit would overflow';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不碰產生器自己的 correct（拿它來比等於自己比自己）。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'digitOf':        return String([d.h, d.t, d.o][d.pos]);
        case 'valueOfDigit':   return String(d.dg * PLACES[d.pos]);
        case 'expandBlank':    return String(d.t * 10);
        case 'buildFromParts': return String(d.a * 100 + d.b * 10 + d.c);
        case 'regroupTens':    return String(d.a * 10);
        case 'wordHundreds':   return String(d.b * 100 + d.c);
        /* 這兩題的選項就是那四個數，正解是其中的極值 —— 從選項重算，
           不從 d.correct 讀。 */
        case 'biggest':        return String(Math.max.apply(null, d.opts.map(Number)));
        case 'smallest':       return String(Math.min.apply(null, d.opts.map(Number)));
        case 'nextNumber':     return String(d.n + 2);
        case 'skipTen':        return String(d.start + 30);
        case 'skipHundred':    return String(d.n + 200);
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：位名（百位／十位／個位）從 TXT 取，數列的三個數
       也是現算的。資料全對、選項全對，印錯位名一樣會教錯 —— 所以在這裡把
       「畫面上真的印了什麼」再驗一次。位名在這裡寫第二份，正是神諭的意義。 */
    renderCheck: function(d, q, lang, genId){
      const PLACE_WORDS = { zh: ['百位', '十位', '個位'], en: ['hundreds', 'tens', 'ones'] };
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const nums = (stem.match(/\d+/g) || []).map(Number);
      /* 英文的單複數：「1 hundreds」「1 ones」是錯的（2026-10-02 修；index.html 的 blkSay 有同一個錯） */
      if (lang === 'en'){
        const both = (stem + ' ' + String(q.why).replace(/<[^>]+>/g, ' ')).replace(/[\s\u00a0]+/g, ' ');
        const m = both.match(/(?:^|[^\d.])1 (hundreds|tens|ones)\b/i) || both.match(/(?:^|[^\d.])(?:[02-9]|\d\d+) (hundred|ten|one)\b(?!-)/i);
        if (m) return genId + ' en: wrong singular/plural "' + m[0].trim() + '" — ' + both.slice(0, 120);
      }
      if (genId === 'digitOf' || genId === 'valueOfDigit'){
        const words = PLACE_WORDS[lang];
        const want = words[d.pos];
        /* 兩個產生器把位名印在不同地方：digitOf 的位名在**題幹**
           （「345 的十位數字是多少？」），valueOfDigit 的題幹只有數字，
           位名在**解釋**裡。所以要分開驗 —— 合起來驗的話，只改壞其中一邊
           另一邊會替它掩護（第一版就是這樣漏掉的）。 */
        const where = genId === 'digitOf' ? stem : String(q.why).replace(/<[^>]+>/g, ' ');
        const said = words.filter(w => where.indexOf(w) >= 0);
        if (said.indexOf(want) < 0)
          return genId + ' does not name the ' + want + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.some(w => w !== want))
          return genId + ' names more than one place (' + said.join('/') + '), so the question is ambiguous';
        if (nums.indexOf(d.n) < 0) return genId + ' stem does not print the number ' + d.n;
      }
      if (genId === 'nextNumber' && (nums[0] !== d.n || nums[1] !== d.n + 1))
        return 'the counting stem is not n, n+1 (printed ' + nums.join(',') + ')';
      if (genId === 'skipTen' &&
          (nums[0] !== d.start || nums[1] !== d.start + 10 || nums[2] !== d.start + 20))
        return 'the skip-ten stem is not start, +10, +20 (printed ' + nums.join(',') + ')';
      if (genId === 'skipHundred' && (nums[0] !== d.n || nums[1] !== d.n + 100))
        return 'the skip-hundred stem is not n, n+100 (printed ' + nums.join(',') + ')';
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的迷思誘答。
       兩個都是這一課明講要抓的錯，而且**只放行那一個值** —— 整個產生器全開的話，
       不小心抄回別的數字也會被一起蓋掉。 */
    stemEchoOk: {
      /* 「25 個十是多少？」→ 直接答 25：把「幾個十」的個數當成答案。 */
      regroupTens: function(d, opt){ return Number(opt) === d.a; },
      /* 「508 的 5 表示多少？」→ 直接答 5：只看數字、沒看它站在哪一位。 */
      valueOfDigit: function(d, opt){ return Number(opt) === d.dg; },
      /* 「1 個百、0 個十、0 個一」的誘答 a+b+c（把位值當成加起來）在數字小的時候
         剛好等於題幹印出來的某個數字。誘答本身是設計好的迷思，不是題幹被抄回來，
         所以只放行「剛好等於 a+b+c」的那一個值。 */
      buildFromParts: function(d, opt){ return Number(opt) === d.a + d.b + d.c; }
    },

    /* 選項一律是純數字，而且要落在這一課自己宣告的範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [0, MAX];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{START_NUMS, MAX_STEPS, PLACE_NUMS, PAIRS, cmpNameZh, cmpNameEn, kindNameZh, kindNameEn, unitZh, unitEn, htoEn, ' +
      'GAME_W, GPICK, GPAD, GAME_ORDER, BLK, blockXY, GAME_PACK, PACK_H, PACK_PAD, PACK_CRATE, PACK_HCOL, PACK_OCOL, PACK_COLTOP, PACK_PILE, ' +
      'crateSlotXY, packPileXY, GAME_WRITE, WRITE_H, WRITE_PIC, WRITE_SLOT, WRITE_KEYS, GAME_BUILD, BUILD_H, BUILD_COL, BUILD_TOK, ' +
      'GAME_SORT, SORT_H, SORT_SLOT, SORT_CARD, GAME_HOP, HOP_H, HOP_PIC, HOP_STEPS}',
    /* 這一課**故意不設** optionValueMax。三層題庫裡「超出範圍」正是考點本身：
       608 寫成 6008、304 寫成 3004、30 個十算成 3000 —— 那些四位數誘答就是
       這一課要抓的迷思，設上限只會把刻意的教材判成缺陷。
       產生器那一側的範圍檢查在 sim.optionOk（0~1000），沒有放寬。 */

    check: function(data, I18N, fail, src){
      const LANGS = ['zh', 'en'];

      /* --- 範例 1：積木化聚（按 +1／+10 走 MAX_STEPS 步） --- */
      if (!data.START_NUMS.length) fail('START_NUMS is empty');
      data.START_NUMS.forEach(start => {
        if (start < 0 || start > MAX) fail(`START_NUMS ${start} outside 0~${MAX}`);
        /* 每一種步伐都要走得完 MAX_STEPS 步而不越界 —— 越界的話畫面上會出現
           四位數，而這一課只教到 1000。 */
        [1, 10].forEach(step => {
          const end = start + step * data.MAX_STEPS;
          if (end > MAX) fail(`START_NUMS ${start} +${step} × ${data.MAX_STEPS} = ${end} walks past ${MAX}`);
        });
      });
      /* 化聚是這一課的重點，所以起點裡一定要有一個會撞到「滿十進位」的。 */
      if (!data.START_NUMS.some(n => n % 10 === 8 || n % 10 === 9 || n % 100 >= 95))
        fail('no START_NUMS sits just below a regrouping boundary');

      /* --- 範例 2：位值表 --- */
      data.PLACE_NUMS.forEach(n => {
        if (n < 100 || n > 999) fail(`PLACE_NUMS ${n} is not a three-digit number`);
        LANGS.forEach(L => {
          const r = I18N[L].reads[n];
          if (!r) fail(`PLACE_NUMS ${n} has no reading in ${L}`);
          else if (/undefined|NaN/.test(String(r))) fail(`reads[${n}] ${L}: ${r}`);
        });
        const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
        LANGS.forEach(L => {
          const say = I18N[L].plcSay(h, t, o);
          if (/undefined|NaN/.test(say)) fail(`plcSay ${L} ${n}: ${say}`);
          [h, t, o].forEach(dg => {
            if (String(say).indexOf(String(dg)) < 0) fail(`plcSay ${L} ${n} does not mention ${dg}`);
          });
        });
      });
      /* 這一課明講的兩個迷思：0 佔位。範例裡一定要看得到。 */
      if (!data.PLACE_NUMS.some(n => Math.floor(n / 10) % 10 === 0))
        fail('PLACE_NUMS has no number with a 0 in the tens place (the lesson\'s main misconception)');
      if (!data.PLACE_NUMS.some(n => n % 10 === 0))
        fail('PLACE_NUMS has no number ending in 0');

      /* --- 範例 3：比大小 --- */
      data.PAIRS.forEach(p => {
        if (p.a === p.b) fail(`PAIRS ${p.a}/${p.b} are equal, so there is nothing to compare`);
        if (p.a > MAX || p.b > MAX) fail(`PAIRS ${p.a}/${p.b} outside the lesson range`);
        LANGS.forEach(L => {
          const big = Math.max(p.a, p.b), small = Math.min(p.a, p.b);
          const t = String(p.a).length !== String(p.b).length
            ? I18N[L].cmpLen(big, small)
            : I18N[L].cmpBig(0, String(big)[0], String(small)[0]);
          if (/undefined|NaN/.test(t)) fail(`compare text ${L} ${p.a}/${p.b}: ${t}`);
        });
      });
      if (!data.PAIRS.some(p => String(p.a).length !== String(p.b).length))
        fail('PAIRS has no pair with a different number of digits (the "more digits wins" case)');
      /* 兩個兩位數的 Math.floor(n/100) 都是 0，不加「三位數」這個條件的話，
         89/58 這種資料也會被當成「百位相同」而通過。 */
      if (!data.PAIRS.some(p => p.a >= 100 && p.b >= 100 &&
                                String(p.a).length === String(p.b).length &&
                                Math.floor(p.a / 100) === Math.floor(p.b / 100)))
        fail('PAIRS has no pair that ties on the hundreds (the "look at the next place" case)');

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
                    const r = arithNumbers(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 2) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 2`);
            if (qSum !== 2) fail(`question-shaped equations changed: found ${qSum}, expected 2`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithNumbers.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithNumbers.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithNumbers.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== '1c13a95d070c'){
                fail(`the set of verified equations changed (digest ${digest}, expected 1c13a95d070c)\n      now: ${list.join(' | ')}`);
              }
            }
          }

    }
  }
};
