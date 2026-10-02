/* grade-2/math/add-sub 的檢查設定（原本寫死在 tools/simgen.js 與
   tools/verify_lesson_data.js 裡，2026-08-25 拆出來，讓每一課都能各自驗）。 */

function digits(n){ return [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100) % 10]; }
function needsBorrow(a, b){ const A = digits(a), B = digits(b); return A.some((d, k) => d < B[k]); }

/* 這一課是「二、三位數的加減」：選項一律 0~999，問個位數字的那一題 0~9。 */
const RANGE = { onesDigit: [0, 9] };

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithAddSub = require('./lib/arith.js').makeArith({
  units: ["個", "顆", "元", "張", "本", "枝", "人", "題"],
  unitsEn: ["stickers?", "marbles?", "books?", "pens?", "cards?", "coins?", "people", "person", "items?"],
  wrongOnPurpose: ["71 - 28 = 57"]
});

/* ---------- 小遊戲「直式工作站」（§六之五：五關五種玩法，2026-10-02 改版）----------
   對齊（數字卡排進同一位）、換一換（10 個一換 1 個十）、寫直式（照順序寫答案與進位）、拆一拆（退位，用點的）、驗算（排出檢查的算式再判斷）。
   做法照 grade-3-divide.js／grade-2-numbers.js：
   - 每一關**照遊戲的規則把每一題玩一遍**（自己的規則實作），證明一定解得完、解完一定是對的答案；
     拆一拆把**每一種點法**都走完（廣度優先），證明走得到的每一個狀態都還解得完、每一條路的結果都是 a − b；
   - 頁面的純函式（colSteps／colMissKind／borrowRule／checkSlotRule／tradeCubeXY／tradeBarXY／tradeCellXY／borBlockXY）
     拿整個題庫或整個狀態空間去呼叫，再和自己的實作比；
   - nearestOpen()、roundSolved()、roundMiss() 從原始碼切出來**真的跑**；
   - 每一句說明逐個比數字（兩種語言、每一題、每一步、每一種放錯），而且那句話說的事要成立；
   - 版面與觸控 ≥ 44px 從 index.html 的常數讀（不在這裡另抄一份數字）。
   已知極限：RENDER 函式本體裡的規則是字面掃描（need()：證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g2-add-sub 的端對端測試驗。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const dig3 = n => [Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];
  const len = n => String(n).length;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
  const within = (o, R, what) => { if (!(o.x >= R.x - 1e-9 && o.y >= R.y - 1e-9 && o.x + o.w <= R.x + R.w + 1e-9 && o.y + o.h <= R.y + R.h + 1e-9)) fail(what + ' sticks out of its frame'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const pad = (R, p) => ({ x:R.x - p, y:R.y - p, w:R.w + 2 * p, h:R.h + 2 * p });
  const W = D.GAME_W, P = D.GPAD;
  const tray = (n, step) => { const x0 = (W - (n - 1) * step) / 2; return Array.from({ length:n }, (_, i) => x0 + i * step); };

  /* --- 順序、每一關的說明與提示 --- */
  const TYPES = ['align', 'trade', 'column', 'borrow', 'check'];
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
  /* 第 4 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外） */
  if (!/用點的/.test(I18N.zh.gAsks.borrow) || !/all taps/.test(I18N.en.gAsks.borrow)) fail('borrow: the round has no drag — its instructions must say it is all taps');
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');

  /* --- 觸控：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍 --- */
  const scale = Math.min(1.5, 290 / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK', D.GPICK);
  small('an align card', D.ALIGN_TILE.size); small('an align box', D.ALIGN_CELL);
  small('a loose one', D.TRADE_CUBE.size);
  small('a digit card', D.COL_KEYS.size); small('a carry box', Math.min(D.COL_CARRY.w, D.COL_CARRY.h)); small('an answer box', D.COL_RES.size);
  small('a borrow column', Math.min(D.BOR_COL.w, D.BOR_COL.h));
  small('a check card', Math.min(D.CHK_CARD.w, D.CHK_CARD.h)); small('a check box', Math.min(D.CHK_SLOT.w, D.CHK_SLOT.h));
  [D.ALIGN_TILE.size, D.TRADE_CUBE.size, D.COL_KEYS.size, D.CHK_CARD.w, D.CHK_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('borrow/check: the Take away / right / wrong buttons (.btn) are not at least 46px tall'); }
  need('align', /addPiece\(B, \{ w:ALIGN_TILE\.size, h:ALIGN_TILE\.size, cx:cx, cy:cy,/, 'the digit cards are not ALIGN_TILE.size');
  need('align', /renderTray\(B, tiles, ALIGN_TILE\.y, function\(q, cx, cy\)\{[\s\S]*?\}, ALIGN_TILE\.step\);/, 'cannot read where the align cards are drawn');
  need('trade', /var p = tradeCubeXY\(i\);\s*cubes\.push\(addPiece\(B, \{ w:TRADE_CUBE\.size, h:TRADE_CUBE\.size, cx:p\.x, cy:p\.y,/, 'the loose ones are not TRADE_CUBE.size at tradeCubeXY()');
  need('column', /addPiece\(B, \{ w:COL_KEYS\.size, h:COL_KEYS\.size, cx:GAME_W \/ 2 \+ \(\(v % 5\) - 2\) \* COL_KEYS\.step,\s*cy:COL_KEYS\.y \+ Math\.floor\(v \/ 5\) \* COL_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
  need('check', /renderTray\(B, \['a', 'b', 'g'\], CHK_CARD\.y, function\(key, cx, cy\)\{\s*addPiece\(B, \{ w:CHK_CARD\.w, h:CHK_CARD\.h, cx:cx, cy:cy,/, 'the check cards are not CHK_CARD.w × CHK_CARD.h in the tray');
  need('borrow', /btn\.style\.left = x \+ 'px'; btn\.style\.top = C\.y \+ 'px'; btn\.style\.width = C\.w \+ 'px'; btn\.style\.height = C\.h \+ 'px';/, 'the tap columns are not BOR_COL-sized');

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
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' is missing or has a number in it');
    [0, 1, 2].forEach(k => { if (typeof d.colName(k) !== 'string' || !d.colName(k)) fail('colName(' + k + ') missing in ' + L); });
  });

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }
  const tgt = (R, id) => ({ id, cx:R.x + R.w / 2, cy:R.y + R.h / 2, hw:R.w / 2, hh:R.h / 2, done:false });
  /* 一排相鄰的格子：格子裡每一點判給那一格；兩格中間的縫判給比較近的那一格；放好的格子不可以讓給隔壁；整排外面都不收 */
  const rowCheck = (rects, what) => {
    if (!nearestOpen) return;
    const list = rects.map(tgt);
    let bad = 0, gapBad = 0;
    list.forEach((b, i) => {
      for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1.5) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, P); if (!g || g.id !== i) bad++; }
      if (i + 1 < list.length){
        const r = rects[i].x + rects[i].w, l = rects[i + 1].x, y = b.cy;
        if (!(l - r < 2 * P)) fail(what + ': the boxes are ' + (l - r) + ' apart — the drop pads (' + P + ') no longer overlap, so the nearest-box rule is never exercised');
        for (let x = r + 0.25; x < l; x += 0.5){ const want = x - r < l - x ? i : i + 1, g = nearestOpen(list, { x, y }, P); if (x - r !== l - x && (!g || g.id !== want)) gapBad++; }
      }
    });
    if (bad) fail('nearestOpen(): ' + bad + ' points inside a ' + what + ' are given to another box (or none)');
    if (gapBad) fail('nearestOpen(): ' + gapBad + ' points between two ' + what + 'es go to the farther box — it takes the first match instead of the nearest');
    const done = list.map((b, i) => Object.assign({}, b, { done:i === 1 }));
    const edge = { x:done[1].cx + done[1].hw - 0.5, y:done[1].cy };
    if (nearestOpen(done, edge, P) !== null || nearestOpen(done, { x:done[1].cx, y:done[1].cy }, P) !== null) fail('nearestOpen(): a drop on a finished ' + what + ' is moved into its neighbour');
    if (nearestOpen(list, { x:-50, y:-50 }, P) !== null) fail('nearestOpen(): a drop far from every ' + what + ' is accepted');
  };

  /* ================= 第 1 關：對齊（個位對個位） ================= */
  {
    const C = D.ALIGN_CELL, H = D.ALIGN_H, T = D.ALIGN_TILE;
    const slots = D.ALIGN_X.map(x => ({ x:x - C / 2, y:D.ALIGN_BOTY, w:C, h:C }));
    const tops = D.ALIGN_X.map(x => ({ x:x - C / 2, y:D.ALIGN_TOPY, w:C, h:C }));
    const ress = D.ALIGN_X.map(x => ({ x:x - C / 2, y:D.ALIGN_RESY, w:C, h:C }));
    const heads = D.ALIGN_X.map(x => ({ x:x - 32, y:D.ALIGN_HDY, w:64, h:18 }));
    const op = { x:D.ALIGN_OPX - 20, y:D.ALIGN_BOTY, w:40, h:C }, ln = { x:D.ALIGN_OPX - 20, y:D.ALIGN_LINEY, w:D.ALIGN_X[2] + C / 2 - D.ALIGN_OPX + 20, h:4 };
    [].concat(slots, tops, ress, heads, [op, ln]).forEach((r, i) => inside(r, 'align: part ' + i, W, H));
    noHits([].concat(tops, slots, ress, [op, ln]), 'align: rows');
    rowCheck(slots, 'align box');
    if (!(D.GAME_ALIGN.length >= 4)) fail('GAME_ALIGN should have at least 4 entries');
    if (!D.GAME_ALIGN.some(e => len(e.a) < len(e.b)) || !D.GAME_ALIGN.some(e => len(e.a) > len(e.b)) || !D.GAME_ALIGN.some(e => e.op === '-'))
      fail('GAME_ALIGN should have a short number on top, a short number underneath, and a subtraction');
    D.GAME_ALIGN.forEach((e, i) => {
      const w = 'GAME_ALIGN[' + i + ']', sub = e.op === '-', res = sub ? e.a - e.b : e.a + e.b, bs = String(e.b);
      if (!(e.op === '+' || e.op === '-')) return fail(w + ': op ' + e.op);
      if (len(e.a) === len(e.b)) fail(w + ': both numbers have ' + len(e.a) + ' digits — nothing to line up');
      if (len(e.a) < 2 || len(e.b) < 2 || len(e.a) > 3 || len(e.b) > 3) fail(w + ': this lesson stacks two- and three-digit numbers');
      if (res < 0 || res > 999) fail(w + ': the answer ' + res + ' is outside 0~999');
      if (/0/.test(bs) || new Set(bs).size !== bs.length) fail(w + ': the cards of ' + e.b + ' must be different digits and not 0');
      if (len(res) < len(e.a) && sub) fail(w + ': the answer ' + res + ' loses a place');
      /* 照遊戲的規則玩一遍：卡片 q 放進第 k 格，只有 k === q 收；放完 len(b) 張就算完 */
      const want = dig3(e.b), k0 = 3 - bs.length;
      let placed = 0;
      for (let q = k0; q < 3; q++) for (let k = 0; k < 3; k++){
        const ok = k === q;
        if (ok) placed++;
        else LANGS.forEach(L => {
          const t = I18N[L].gAlignWrong(want[q], q, k);
          seq(w + ' gAlignWrong ' + L, t, [want[q], want[q]]);
          if (t.indexOf(I18N[L].colName(q)) < 0 || t.indexOf(I18N[L].colName(k)) < 0) fail(w + ' gAlignWrong ' + L + ' does not name both places: ' + t);
          if (L === 'en' && /\b1 (hundreds|tens|ones)\b/.test(t)) fail(w + ' gAlignWrong en: "1 ..." must be singular: ' + t);
        });
      }
      if (placed !== bs.length) fail(w + ': not every card has a place');
      const R3 = dig3(res);
      if (R3.join('').replace(/^0+/, '') !== String(res)) fail(w + ': the answer row would not read ' + res);
      LANGS.forEach(L => {
        const d = I18N[L], sign = sub ? '−' : '+';
        seq(w + ' gAlignQ ' + L, d.gAlignQ(e.a, sign, e.b), [e.a, e.b]);
        seq(w + ' gAlignQ(res) ' + L, d.gAlignQ(e.a, sign, e.b, res), [e.a, e.b, res]);
        seq(w + ' gAlignDone ' + L, d.gAlignDone(e.a, sign, e.b, res), [e.a, e.b, res]);
        for (let q = k0; q < 3; q++){ seq(w + ' gAlign2 ' + L, d.gAlign2(want[q], q), [want[q], want[q]]); if (L === 'en' && /\b1 (hundreds|tens|ones)\b/.test(d.gAlign2(want[q], q))) fail(w + ' gAlign2 en singular'); }
      });
      const cards = tray(bs.length, T.step).map(x => box(x, T.y, T.size, T.size));
      cards.forEach((r, j) => { inside(r, w + ' card ' + j, W, H); slots.concat(ress).forEach(S => { if (hit(r, pad(S, P))) fail(w + ': card ' + j + ' sits inside a drop pad or the answer row'); }); });
      noHits(cards, w + ': cards');
    });
    need('align', /var s = nearestOpen\(slots, pt, GPAD\);\s*if \(!s\) return false;\s*if \(s\.k !== P\.data\.k\)\{ roundMiss\(d\.gAlignWrong\(P\.data\.v, P\.data\.k, s\.k\)\); return false; \}/, 'a card is accepted under another place, or the box is not the nearest one (empty space must be silent)');
    need('align', /if \(placed === lenB\)\{[\s\S]*?roundSolved\(d\.gAlignDone\(e\.a, sign, e\.b, res\)\);/, 'the round is not solved exactly when every card is placed');
    need('align', /res = e\.op === '\+' \? e\.a \+ e\.b : e\.a - e\.b;/, 'the answer is not a + b / a − b');
    need('align', /for \(var k = 3 - lenB; k < 3; k\+\+\) tiles\.push\(k\);/, 'the cards are not exactly the digits of the bottom number');
  }

  /* ================= 第 2 關：換一換（10 個一換 1 個十） ================= */
  {
    const T0 = D.TRADE_T, O0 = D.TRADE_O, F = D.TRADE_FRAME, H = D.TRADE_H, CU = D.TRADE_CUBE, BR = D.TRADE_BAR;
    const frame = { x:F.x, y:F.y, w:F.cw * 5, h:F.ch * 2 };
    [[T0, 'the tens box'], [O0, 'the ones box'], [frame, 'the ten-frame'], [{ x:F.x - 40, y:F.lblY, w:F.cw * 5 + 80, h:22 }, 'the frame label']].forEach(([r, w]) => inside(r, 'trade: ' + w, W, H));
    noHits([T0, O0, frame], 'trade: boxes');
    if (!(frame.y - (T0.y + T0.h) < P && frame.x < T0.x + T0.w)) fail('trade: the ten-frame is not tucked under the tens box within GPAD — the overlap test has nothing to test');
    if (nearestOpen){
      const zones = [tgt(T0, 't'), tgt(frame, 'f')];
      let bad = 0;
      [[T0, 't'], [frame, 'f']].forEach(([R, want]) => {
        for (let x = R.x + 0.5; x < R.x + R.w; x += 2) for (let y = R.y + 0.5; y < R.y + R.h; y += 2){ const g = nearestOpen(zones, { x, y }, P); if (!g || g.id !== want) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside the tens box or the ten-frame are given to the other one — measure to the box, not the centre');
      if (nearestOpen(zones, { x:O0.x + O0.w / 2, y:O0.y + O0.h / 2 }, P) !== null) fail('trade: a drop back in the ones box counts as a drop on a target (should be empty space)');
    }
    for (let i = 0; i < 10; i++){
      const p = D.tradeCellXY(i), m = { x:F.x + F.cw / 2 + (i % 5) * F.cw, y:F.y + F.ch / 2 + Math.floor(i / 5) * F.ch };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('tradeCellXY(' + i + ') should be ' + JSON.stringify(m));
      within(box(m.x, m.y, F.cube, F.cube), frame, 'trade: a placed one in cell ' + (i + 1));
    }
    const head = { x:O0.x, y:O0.y, w:O0.w, h:D.TRADE_HDH }, headT = { x:T0.x, y:T0.y, w:T0.w, h:D.TRADE_HDH };
    const cubes = [];
    for (let i = 0; i < 18; i++){
      const p = D.tradeCubeXY(i), m = { x:O0.x + O0.w / 2 + (i % CU.per - (CU.per - 1) / 2) * CU.step, y:O0.y + CU.top + Math.floor(i / CU.per) * CU.step };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('tradeCubeXY(' + i + ') should be ' + JSON.stringify(m));
      cubes.push(box(m.x, m.y, CU.size, CU.size));
    }
    const bars = [];
    for (let i = 0; i < 10; i++){
      const p = D.tradeBarXY(i), m = { x:T0.x + T0.w / 2 + (i % BR.per - (BR.per - 1) / 2) * BR.sx, y:T0.y + BR.top + Math.floor(i / BR.per) * BR.sy };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('tradeBarXY(' + i + ') should be ' + JSON.stringify(m));
      bars.push(box(m.x, m.y, BR.w, BR.h));
    }
    if (!(D.GAME_TRADE.length >= 4)) fail('GAME_TRADE should have at least 4 entries');
    D.GAME_TRADE.forEach((e, i) => {
      const w = 'GAME_TRADE[' + i + ']', A = dig3(e.a), Bd = dig3(e.b), ones = A[2] + Bd[2], tens = A[1] + Bd[1], sum = e.a + e.b;
      if (len(e.a) !== 2 || len(e.b) !== 2) return fail(w + ': this round is two-digit + two-digit');
      if (ones < 11 || ones > 17) fail(w + ': ' + ones + ' ones — should be 11~17 (exactly one ten-frame fills, and more than 10 so some are left)');
      if (tens > 8) fail(w + ': ' + tens + ' tens — after the carry the tens must still be one digit');
      /* 照遊戲的規則玩一遍：一個一個放進框，滿 10 個換 1 條十 */
      let inF = 0, left = ones;
      while (inF < 10 && left > 0){ left--; inF++; }
      if (inF !== 10) return fail(w + ': the ten-frame never fills');
      if ((tens + 1) * 10 + left !== sum) fail(w + ': the picture after the swap reads ' + ((tens + 1) * 10 + left) + ', not ' + sum);
      cubes.slice(0, ones).forEach((r, j) => { within(r, O0, w + ' loose one ' + (j + 1)); if (hit(r, head)) fail(w + ': loose one ' + (j + 1) + ' covers the ones header'); [T0, frame].forEach(Z => { if (hit(r, pad(Z, P))) fail(w + ': loose one ' + (j + 1) + ' sits inside a drop pad'); }); });
      noHits(cubes.slice(0, ones), w + ': loose ones');
      bars.slice(0, tens + 1).forEach((r, j) => { within(r, T0, w + ' ten ' + (j + 1)); if (hit(r, headT)) fail(w + ': ten ' + (j + 1) + ' covers the tens header'); });
      noHits(bars.slice(0, tens + 1), w + ': tens');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gTradeQ ' + L, d.gTradeQ(e.a, e.b), [e.a, e.b]);
        seq(w + ' gTradeQ(sum) ' + L, d.gTradeQ(e.a, e.b, sum), [e.a, e.b, sum]);
        seq(w + ' gTradeDone ' + L, d.gTradeDone(A[2], Bd[2], A[1], Bd[1], sum), [A[2], Bd[2], ones, 10, 1, ones - 10, A[1], Bd[1], 1, tens + 1, sum]);
        if (L === 'en' && /\b1 ones are\b/.test(d.gTradeDone(A[2], Bd[2], A[1], Bd[1], sum))) fail(w + ' en: "1 ones are left"');
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      for (let n = 0; n <= 18; n++){ seq('gTradeHdT ' + L, d.gTradeHdT(n), [n]); seq('gTradeHdO ' + L, d.gTradeHdO(n), [n]); }
      for (let n = 0; n <= 10; n++) seq('gTradeFrame ' + L, d.gTradeFrame(n), [n, 10]);
      for (let k = 1; k <= 10; k++) seq('gTrade2 ' + L, d.gTrade2(k), [k, 10]);
      seq('gTradeNotT ' + L, d.gTradeNotT, [1, 1, 10, 1]);
      if (L === 'en' && (/\b1 (tens|ones)\b/.test(d.gTradeHdT(1) + ' ' + d.gTradeHdO(1) + ' ' + d.gTrade2(1)))) fail('en: "1 tens" / "1 ones" must be singular');
    });
    need('trade', /var z = nearestOpen\(\[tz, fr\], pt, GPAD\);\s*if \(!z\) return false;\s*if \(z === tz\)\{ roundMiss\(d\.gTradeNotT\); return false; \}/, 'a one is accepted on the tens, or the target is not the nearest of the two (empty space must be silent)');
    need('trade', /if \(inFrame\.length === 10\)\{[\s\S]*?addBlock\(B, 't', tradeBarXY\(tens\), TRADE_BAR, 'gnew'\);[\s\S]*?roundSolved\(d\.gTradeDone\(A\[2\], Bd\[2\], A\[1\], Bd\[1\], sum\)\);/, 'the frame does not turn into one more ten exactly at 10');
    need('trade', /var tens = A\[1\] \+ Bd\[1\], ones = A\[2\] \+ Bd\[2\], sum = e\.a \+ e\.b/, 'the blocks are not the tens and ones of a and b');
    need('trade', /for \(i = 0; i < tens; i\+\+\) addBlock\(B, 't', tradeBarXY\(i\), TRADE_BAR\);/, 'the tens drawn are not a\'s and b\'s tens');
  }

  /* ================= 第 3 關：寫直式（從個位開始、滿十進位） ================= */
  {
    const S = D.COL_RES, CC = D.COL_CARRY, H = D.COL_H, K = D.COL_KEYS;
    const res = D.COL_X.map(x => ({ x:x - S.size / 2, y:S.y, w:S.size, h:S.size }));
    const car = D.COL_X.slice(0, 2).map(x => ({ x:x - CC.w / 2, y:CC.y, w:CC.w, h:CC.h }));
    const rowA = D.COL_X.map(x => ({ x:x - S.size / 2, y:D.COL_ROWY[0], w:S.size, h:D.COL_ROWH }));
    const rowB = D.COL_X.map(x => ({ x:x - S.size / 2, y:D.COL_ROWY[1], w:S.size, h:D.COL_ROWH }));
    const ln = { x:D.COL_OPX - 20, y:D.COL_LINEY, w:D.COL_X[2] + S.size / 2 - D.COL_OPX + 20, h:4 };
    const keys = [];
    for (let v = 0; v <= 9; v++) keys.push(box(W / 2 + ((v % 5) - 2) * K.step, K.y + Math.floor(v / 5) * K.rowStep, K.size, K.size));
    [].concat(res, car, rowA, rowB, keys, [ln]).forEach((r, i) => inside(r, 'column: part ' + i, W, H));
    noHits([].concat(res, car, rowA, rowB, [ln]), 'column: the written column');
    noHits(keys, 'column: digit cards');
    keys.forEach((r, v) => res.concat(car).forEach(Z => { if (hit(r, pad(Z, P))) fail('column: digit card ' + v + ' sits inside a drop pad'); }));
    rowCheck(res, 'answer box');
    /* 自己的直式加法：照順序要寫的格子 */
    const mySteps = (a, b) => {
      const A = dig3(a), Bd = dig3(b), s = a + b, n = Math.max(len(a), len(b), len(s)), out = [];
      let cin = 0;
      for (let p = 0; p < n; p++){
        const k = 2 - p, sum = A[k] + Bd[k] + cin;
        out.push({ kind:'r', p, v:sum % 10, da:A[k], db:Bd[k], cin, sum, blank:p >= len(a) && p >= len(b) });
        if (sum >= 10) out.push({ kind:'c', p:p + 1, v:1 });
        cin = sum >= 10 ? 1 : 0;
      }
      return out;
    };
    const myMiss = (s, v) => {
      if (s.kind === 'c') return 'carryOne';
      if (s.blank) return 'last';
      if (s.cin && v === (s.da + s.db) % 10) return 'forgot';
      if (s.sum >= 10 && v === 1) return 'tens';
      return 'redo';
    };
    let zeroWrite = false, tensOnly = false, lastOne = false;
    if (!(D.GAME_COLUMN.length >= 4)) fail('GAME_COLUMN should have at least 4 entries');
    D.GAME_COLUMN.forEach((e, i) => {
      const w = 'GAME_COLUMN[' + i + ']', sum = e.a + e.b, mine = mySteps(e.a, e.b), page = D.colSteps(e.a, e.b);
      if (sum > 999) return fail(w + ': the sum ' + sum + ' needs a thousands place');
      if (len(e.a) < 2 || len(e.b) < 2) fail(w + ': this lesson adds two- and three-digit numbers');
      if (!mine.some(s => s.kind === 'c')) fail(w + ': no carry at all');
      if (mine.some(s => s.kind === 'r' && s.p === 1 && s.sum === 10)) zeroWrite = true;
      if (mine.some(s => s.kind === 'c' && s.p === 2) && !mine.some(s => s.kind === 'c' && s.p === 1)) tensOnly = true;
      if (mine.some(s => s.blank)) lastOne = true;
      if (mine.some(s => s.kind === 'c' && s.p > 2)) fail(w + ': a carry past the hundreds — there is no box for it');
      if (page.map(s => s.kind + s.p + ':' + s.v).join() !== mine.map(s => s.kind + s.p + ':' + s.v).join())
        fail(w + ': colSteps() is ' + page.map(s => s.kind + s.p + ':' + s.v).join() + ', should be ' + mine.map(s => s.kind + s.p + ':' + s.v).join());
      /* 照遊戲的規則玩一遍：寫完每一格，答案格讀出來就是和 */
      const written = mine.filter(s => s.kind === 'r').sort((x, y) => y.p - x.p).map(s => s.v).join('');
      if (+written !== sum || written.length !== len(sum)) fail(w + ': the answer boxes would read ' + written + ', not ' + sum);
      mine.forEach((s, j) => {
        const ps = page[j];
        for (let v = 0; v <= 9; v++){
          if (v === s.v) continue;
          const want = myMiss(s, v), got = ps ? D.colMissKind(ps, v) : null;
          if (got !== want) fail(w + ' step ' + j + ' (' + s.kind + s.p + '): colMissKind for ' + v + ' is ' + got + ', should be ' + want);
          /* 那句話說的事要成立 */
          if (want === 'forgot' && !(s.cin === 1 && v === (s.da + s.db) % 10 && v !== s.v)) fail(w + ': "forgot the carry" fires when it is not true');
          if (want === 'tens' && !(s.sum >= 10 && v === Math.floor(s.sum / 10))) fail(w + ': "you wrote the 1 that carries" fires when it is not true');
        }
        LANGS.forEach(L => {
          const d = I18N[L], st = ps && ps.st, lhs = [s.da, s.db].concat(s.cin ? [1] : []);
          if (s.kind === 'c'){ seq(w + ' gColCarryOne ' + L, d.gColCarryOne(s.p), [1, 10, 1, 1]); seq(w + ' gCol2Carry ' + L, d.gCol2Carry(s.p), [1]); return; }
          if (!st) return fail(w + ': colSteps() step ' + j + ' has no planAdd step');
          if (s.blank){ seq(w + ' gColLast ' + L, d.gColLast(s.p), [1, 1]); seq(w + ' gCol2Res ' + L, d.gCol2Res(st), [1, 1]); return; }
          seq(w + ' gColRedo ' + L, d.gColRedo(st), lhs);
          seq(w + ' gCol2Res ' + L, d.gCol2Res(st), lhs.concat([s.sum, s.v]));
          if (s.cin) seq(w + ' gColForgot ' + L, d.gColForgot(st), [1].concat(lhs, [s.sum, s.v]));
          if (s.sum >= 10) seq(w + ' gColTens ' + L, d.gColTens(st), lhs.concat([s.sum, s.v, 1]));
          else seq(w + ' gColNoCarry ' + L, d.gColNoCarry(st), lhs.concat([s.sum]));
          if (d.gColRedo(st).indexOf(d.colName(2 - s.p)) < 0) fail(w + ' ' + L + ': the reason does not name the place it is about');
        });
      });
      LANGS.forEach(L => {
        seq(w + ' gColDone ' + L, I18N[L].gColDone(e.a, e.b, sum), [e.a, e.b, sum]);
        if (I18N[L].gColCarryOne(1).indexOf(I18N[L].colUnit(2, 10)) < 0 || I18N[L].gColCarryOne(2).indexOf(I18N[L].colUnit(1, 10)) < 0) fail('gColCarryOne ' + L + ': the carry into the tens must be "10 ones", into the hundreds "10 tens"');
      });
    });
    if (!zeroWrite) fail('GAME_COLUMN: no entry where the tens make exactly 10 (write 0 and carry)');
    if (!tensOnly) fail('GAME_COLUMN: no entry where only the tens carry');
    if (!lastOne) fail('GAME_COLUMN: no entry that ends with only the carried 1');
    LANGS.forEach(L => seq('gColOrder ' + L, I18N[L].gColOrder, []));
    need('column', /if \(c !== cellOf\(s\)\)\{\s*var src = -1;\s*if \(c\.kind === 'c' && !steps\.some\(function\(x\)\{ return x\.kind === 'c' && x\.p === c\.p; \}\)\)\{\s*steps\.forEach\(function\(x, i\)\{ if \(x\.kind === 'r' && x\.p === c\.p - 1\) src = i; \}\);\s*\}\s*roundMiss\(src >= 0 && src < at \? d\.gColNoCarry\(steps\[src\]\.st\) : d\.gColOrder\);\s*return false;\s*\}/, 'a box that is not lit takes a card, or the "no carry here" reason fires before that place was added');
    need('column', /if \(v !== s\.v\)\{\s*var kind = colMissKind\(s, v\);\s*roundMiss\(kind === 'carryOne' \? d\.gColCarryOne\(s\.p\) : kind === 'last' \? d\.gColLast\(s\.p\)\s*: kind === 'forgot' \? d\.gColForgot\(s\.st\) : kind === 'tens' \? d\.gColTens\(s\.st\) : d\.gColRedo\(s\.st\)\);\s*return false;\s*\}/, 'a wrong digit is accepted in the lit box, or the reason does not follow colMissKind()');
    need('column', /var c = nearestOpen\(cells, pt, GPAD\), v = P\.data\.v, s = steps\[at\];\s*if \(!c\) return false;/, 'the box is not picked as the nearest open box (empty space must be silent)');
    need('column', /at\+\+; mark\(\);[\s\S]*?if \(at === steps\.length\)\{[\s\S]*?roundSolved\(d\.gColDone\(e\.a, e\.b, sum\)\);/, 'the round is not solved exactly after the last box');
    need('column', /var e = pick\(GAME_COLUMN\), steps = colSteps\(e\.a, e\.b\)/, 'the boxes do not follow colSteps()');
  }

  /* ================= 第 4 關：拆一拆（退位；這一關用點的） ================= */
  {
    const C = D.BOR_COL, H = D.BOR_H;
    const cols = C.x.map(x => ({ x, y:C.y, w:C.w, h:C.h }));
    cols.forEach((r, k) => { inside(r, 'borrow: column ' + k, W, H); inside({ x:r.x, y:D.BOR_NEEDY, w:C.w, h:24 }, 'borrow: the "take" label ' + k, W, H); });
    noHits(cols.concat(C.x.map(x => ({ x, y:D.BOR_NEEDY, w:C.w, h:24 }))), 'borrow: columns and labels');
    const myRule = (cnt, need, cur, c) => {
      if (c >= cur) return 'ignore';
      if (cnt[c] === 0) return 'empty';
      if (cnt[cur] >= need[cur]) return 'enough';
      for (let m = c + 1; m < cur; m++) if (cnt[m] > 0) return 'near';
      return 'ok';
    };
    const kinds = ['h', 't', 'o'];
    const maxSeen = [0, 0, 0];
    let across = false;
    if (!(D.GAME_BORROW.length >= 4)) fail('GAME_BORROW should have at least 4 entries');
    D.GAME_BORROW.forEach((e, i) => {
      const w = 'GAME_BORROW[' + i + ']', res = e.a - e.b, need = dig3(e.b), last = 3 - len(e.a);
      if (!(res > 0)) return fail(w + ': ' + e.a + ' − ' + e.b + ' is not positive');
      if (len(e.b) > len(e.a) || len(e.a) < 2) return fail(w + ': numbers out of shape');
      if (len(res) !== len(e.a)) fail(w + ': the answer ' + res + ' has fewer places than ' + e.a + ' — the leftover blocks would read with a leading 0');
      if (!dig3(e.a).some((x, k) => k >= last && x < need[k])) fail(w + ': no place needs a borrow');
      if (dig3(e.a)[1] === 0 && dig3(e.a)[2] < need[2]) across = true;
      /* 每一種點法都走一遍：狀態 = (cnt, cur)。動作 = 點第 c 位（頁面的 borrowRule 說 ok 才拆）或按「拿走」（夠才拿）。 */
      const seen = new Map(), finals = new Set();
      const keyOf = (cnt, cur) => cnt.join(',') + '|' + cur;
      const q = [{ cnt:dig3(e.a), cur:2 }];
      let ruleBad = 0, deadEnd = 0, hintBad = 0;
      while (q.length){
        const s = q.shift(), kk = keyOf(s.cnt, s.cur);
        if (seen.has(kk)) continue;
        seen.set(kk, s);
        s.cnt.forEach((x, k) => { if (x > maxSeen[k]) maxSeen[k] = x; if (x < 0) fail(w + ': a negative count'); });
        if (s.cur < last){ finals.add(s.cnt.slice(last).join('')); continue; }
        let moves = 0;
        for (let c = 0; c < 3; c++){
          const got = D.borrowRule(s.cnt.slice(), need, s.cur, c), want = myRule(s.cnt, need, s.cur, c);
          if (got !== want) ruleBad++;
          if (want === 'ok'){ const n = s.cnt.slice(); n[c]--; n[c + 1] += 10; q.push({ cnt:n, cur:s.cur }); moves++; }
        }
        if (s.cnt[s.cur] >= need[s.cur]){
          const n = s.cnt.slice(); n[s.cur] -= need[s.cur];
          if (n[s.cur] > 9) fail(w + ': taking from place ' + s.cur + ' leaves ' + n[s.cur] + ' — not a digit (a split happened that was not needed)');
          q.push({ cnt:n, cur:s.cur - 1 }); moves++;
        } else {
          /* 第二層提示：跟隔壁拆；隔壁是 0 就跟再左邊拆 —— 要有東西可以拆 */
          if (!(s.cnt[s.cur - 1] > 0 || (s.cur - 2 >= 0 && s.cnt[s.cur - 2] > 0))) hintBad++;
        }
        if (!moves) deadEnd++;
      }
      if (ruleBad) fail(w + ': borrowRule() disagrees with the rule in ' + ruleBad + ' state/tap pairs');
      if (deadEnd) fail(w + ': ' + deadEnd + ' reachable state(s) where nothing can be done — the round can get stuck');
      if (hintBad) fail(w + ': the second-level hint would point at an empty place');
      if (finals.size !== 1 || +[...finals][0] !== res) fail(w + ': the blocks left at the end read ' + [...finals].join('/') + ', should only ever be ' + res);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gAlignQ ' + L, d.gAlignQ(e.a, '−', e.b, res), [e.a, e.b, res]);
        seq(w + ' gBorDone ' + L, d.gBorDone(e.a, e.b, res), [e.a, e.b, res]);
        for (let k = last; k < 3; k++) seq(w + ' gBorNeed ' + L, d.gBorNeed(need[k]), [need[k]]);
      });
    });
    if (!across) fail('GAME_BORROW: no entry where the tens are 0 and the hundreds must be split first');
    /* 版面：每一位在整個狀態空間裡出現過的最多個數，都要放得進那一欄、不碰到計數 */
    kinds.forEach((kind, k) => {
      const b = D.BOR_BLK[kind], list = [], cx = C.x[k] + C.w / 2, top = C.y + D.BOR_TOP;
      for (let i = 0; i < maxSeen[k]; i++){
        const p = D.borBlockXY(kind, i, cx, top), m = { x:cx + (i % b.per - (b.per - 1) / 2) * b.sx, y:top + b.h / 2 + Math.floor(i / b.per) * b.sy };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('borBlockXY(' + kind + ', ' + i + ') should be ' + JSON.stringify(m));
        list.push(box(m.x, m.y, b.w, b.h));
      }
      noHits(list, 'borrow: ' + kind + ' blocks');
      const room = { x:C.x[k], y:C.y + 24, w:C.w, h:C.h - 24 - 30 };
      list.forEach((r, i) => within(r, room, 'borrow: ' + kind + ' block ' + (i + 1) + ' of ' + maxSeen[k]));
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      [0, 1].forEach(k => { seq('gBorSwap ' + L, d.gBorSwap(k), [1, 10]); seq('gBorEmpty ' + L, d.gBorEmpty(k), [0]); });
      if (I18N[L].gBorSwap(0).indexOf(I18N[L].colUnit(0, 1)) < 0 || I18N[L].gBorSwap(1).indexOf(I18N[L].colUnit(2, 10)) < 0) fail('gBorSwap ' + L + ': a hundred splits into tens, a ten into ones');
      seq('gBorEnough ' + L, d.gBorEnough(2, 12, 7), [12, 7]);
      seq('gBorNear ' + L, d.gBorNear(1, 4), [4]);
      seq('gBorShort ' + L, d.gBorShort(2, 2, 7), [2, 7, 1]);
      seq('gBorTook ' + L, d.gBorTook(2, 12, 7, 5), [12, 7, 5]);
      seq('gBorCalc ' + L, d.gBorCalc(12, 7, 5), [12, 7, 5]);
      seq('gBor2Tap ' + L, d.gBor2Tap(2, 1), [1]);
      seq('gBor2Zero ' + L, d.gBor2Zero(2, 0), [0, 1]);
      seq('gBor2Take ' + L, d.gBor2Take(2, 12, 7), [12, 7]);
      if (L === 'en' && /there are still 1\b/.test(d.gBorNear(1, 1))) fail('en: "there are still 1"');
    });
    need('borrow', /var r = borrowRule\(cnt, need, cur, k\);\s*if \(r === 'ignore'\) return;\s*if \(r === 'empty'\)\{ roundInfo\(d\.gBorEmpty\(k\)\); return; \}\s*if \(r === 'enough'\)\{ roundMiss\(d\.gBorEnough\(cur, cnt\[cur\], need\[cur\]\)\); return; \}\s*if \(r === 'near'\)\{ roundMiss\(d\.gBorNear\(cur - 1, cnt\[cur - 1\]\)\); return; \}\s*cnt\[k\]--; cnt\[k \+ 1\] \+= 10;/, 'a tap does not follow borrowRule() (split only when the place being taken from is short, from the nearest place that has some)');
    need('borrow', /if \(cnt\[cur\] < need\[cur\]\)\{ roundMiss\(d\.gBorShort\(cur, cnt\[cur\], need\[cur\]\)\); return; \}\s*var k = cur, before = cnt\[k\];\s*cnt\[k\] -= need\[k\];/, 'Take away works when the place is short, or takes the wrong number');
    need('borrow', /cur--;\s*if \(cur < last\)\{[\s\S]*?roundSolved\(d\.gBorDone\(e\.a, e\.b, res\)\);/, 'the round is not solved exactly after the last place is taken');
    need('borrow', /var e = pick\(GAME_BORROW\), cnt = digits3\(e\.a\), need = digits3\(e\.b\)/, 'the blocks are not a, or the amounts to take are not b');
    need('borrow', /var cur = 2, last = 3 - lenA, res = e\.a - e\.b/, 'the round does not start at the ones, or stops at the wrong place');
  }

  /* ================= 第 5 關：驗算（減法用加法、加法用減法） ================= */
  {
    const S = D.CHK_SLOT, H = D.CHK_H, CD = D.CHK_CARD;
    const slots = S.x.map(x => ({ x, y:S.y, w:S.w, h:S.h }));
    const parts = slots.concat([{ x:D.CHK_SIGNX - 12, y:S.y, w:24, h:S.h }, { x:D.CHK_EQX - 12, y:S.y, w:24, h:S.h }, { x:D.CHK_RES.x, y:S.y, w:D.CHK_RES.w, h:S.h }]);
    parts.concat([{ x:0, y:D.CHK_CMPY, w:W, h:26 }, { x:0, y:8, w:W, h:24 }]).forEach((r, i) => inside(r, 'check: part ' + i, W, H));
    noHits(parts, 'check: the check row');
    const cards = tray(3, CD.step).map(x => box(x, CD.y, CD.w, CD.h));
    cards.forEach((r, j) => { inside(r, 'check: card ' + j, W, H); slots.forEach(Z => { if (hit(r, pad(Z, P))) fail('check: card ' + j + ' sits inside a drop pad'); }); if (hit(r, { x:0, y:D.CHK_CMPY, w:W, h:26 })) fail('check: card ' + j + ' covers the compare line'); });
    noHits(cards, 'check: cards');
    const myRule = (op, i, key) => op === '-' ? (key === 'a' ? 'minuend' : null) : ((i === 0) === (key === 'g') ? null : 'sumFirst');
    ['-', '+'].forEach(op => [0, 1].forEach(i => ['a', 'b', 'g'].forEach(key => {
      if (D.checkSlotRule(op, i, key) !== myRule(op, i, key)) fail('checkSlotRule(' + op + ', ' + i + ', ' + key + ') is ' + D.checkSlotRule(op, i, key) + ', should be ' + myRule(op, i, key));
    })));
    let nRight = 0, nWrong = 0, nSub = 0, nAdd = 0;
    D.GAME_CHECK.forEach((e, i) => {
      const w = 'GAME_CHECK[' + i + ']', sub = e.op === '-', right = sub ? e.a - e.b : e.a + e.b, ok = e.given === right;
      if (sub) nSub++; else nAdd++;
      if (ok) nRight++; else nWrong++;
      if (new Set([e.a, e.b, e.given]).size !== 3) fail(w + ': two of the three cards show the same number');
      if (right < 0 || right > 999 || e.given < 0 || e.given > 999) fail(w + ': out of 0~999');
      /* 照遊戲的規則把每一種排法都排一遍：收的排法算出來的數，和「要變回的數」一樣 ⇔ 那一題算對了 */
      const vals = { a:e.a, b:e.b, g:e.given };
      let ways = 0;
      ['a', 'b', 'g'].forEach(k0 => ['a', 'b', 'g'].forEach(k1 => {
        if (k0 === k1 || myRule(e.op, 0, k0) || myRule(e.op, 1, k1)) return;
        ways++;
        const back = sub ? vals[k0] + vals[k1] : vals[k0] - vals[k1], other = sub ? e.a : (k1 === 'a' ? e.b : e.a);
        if (back < 0 || back > 999) fail(w + ': the check ' + vals[k0] + (sub ? ' + ' : ' − ') + vals[k1] + ' = ' + back + ' leaves 0~999');
        if ((back === other) !== ok) fail(w + ': the check ' + back + ' vs ' + other + ' says ' + (back === other ? 'right' : 'wrong') + ', but ' + e.a + (sub ? ' − ' : ' + ') + e.b + ' = ' + right);
        LANGS.forEach(L => {
          const d = I18N[L];
          seq(w + ' gChkCmp ' + L, d.gChkCmp(other), [other]);
          seq(w + ' gChk2Cmp ' + L, d.gChk2Cmp(back, other), [back, other]);
          seq(w + ' ' + (ok ? 'gChkSaidWrong' : 'gChkSaidRight') + ' ' + L, ok ? d.gChkSaidWrong(back, other) : d.gChkSaidRight(back, other), [back, other]);
          seq(w + ' ' + (ok ? 'chkOk' : 'chkBad') + ' ' + L, ok ? d.chkOk(back, other) : d.chkBad(back, other, right), ok ? [back, other] : [back, other, right]);
        });
      }));
      if (ways !== 2) fail(w + ': ' + ways + ' ways to build the check — should be 2 (either order for subtraction; either addend for addition)');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gChkGiven ' + L, d.gChkGiven(e.a, sub ? '−' : '+', e.b, e.given), [e.a, e.b, e.given]);
        if (sub){ seq(w + ' gChkMinuend ' + L, d.gChkMinuend(e.a, e.given, e.b), [e.a, e.given, e.b]); seq(w + ' gChk2Sub ' + L, d.gChk2Sub(e.given, e.b), [e.given, e.b]); }
        else { seq(w + ' gChkSumFirst ' + L, d.gChkSumFirst(e.given), [e.given]); seq(w + ' gChk2Add ' + L, d.gChk2Add(e.given, e.a, e.b), [e.given, e.a, e.b]); }
      });
    });
    if (nRight < 3 || nWrong < 3 || nSub < 3 || nAdd < 2) fail('GAME_CHECK should have at least 3 right and 3 wrong, 3 subtractions and 2 additions (' + nRight + '/' + nWrong + '/' + nSub + '/' + nAdd + ')');
    LANGS.forEach(L => seq('gChkAsk ' + L, I18N[L].gChkAsk, []));
    need('check', /var why = checkSlotRule\(e\.op, s\.i, key\);\s*if \(why === 'minuend'\)\{ roundMiss\(d\.gChkMinuend\(e\.a, e\.given, e\.b\)\); return false; \}\s*if \(why === 'sumFirst'\)\{ roundMiss\(d\.gChkSumFirst\(e\.given\)\); return false; \}/, 'a card is accepted in a box checkSlotRule() refuses');
    need('check', /back = sub \? x0 \+ x1 : x0 - x1;\s*other = sub \? e\.a : \(slots\[1\]\.key === 'a' \? e\.b : e\.a\);/, 'the check number or the number it should come back to is not computed from the cards in the boxes');
    need('check', /var same = back === other;\s*if \(saidRight !== same\)\{ roundMiss\(same \? d\.gChkSaidWrong\(back, other\) : d\.gChkSaidRight\(back, other\)\); return; \}/, 'a wrong verdict is accepted');
    need('check', /if \(gSolved \|\| back === null\) return;/, 'the verdict can be given before the check is built');
    need('check', /var row = actionRow\(\);\s*row\.style\.display = 'none';/, 'the right/wrong buttons are not hidden until the check is built');
    need('check', /if \(slots\[0\]\.done && slots\[1\]\.done\)\{[^}]*?row\.style\.display = '';/, 'the right/wrong buttons are never shown once both boxes are filled — the round could not be finished');
    LANGS.forEach(L => { if (/\bnot ten\b/.test(I18N[L].gColNoCarry({ p:0, da:4, db:3, cin:0, sum:7 }))) fail('gColNoCarry ' + L + ': "not ten" — carrying happens at ten OR MORE; say "less than ten"'); });
    need('check', /roundSolved\(same \? d\.chkOk\(back, other\) : d\.chkBad\(back, other, right\)\);/, 'the closing line does not say right/wrong from the check');
  }
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/add-sub */
  breaks: [
    { file:'review', expect:'copied straight out of the stem',
      find:'    function ok(v){ return v >= lo && v <= hi && ban.indexOf(v) < 0; }',
      replace:'    function ok(v){ return v >= lo && v <= hi; }' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (ok(c) && !seen[k]){ seen[k] = true; out.push(c); }',
      replace:'      if (ok(c)){ out.push(c); }' },
    { file:'review', expect:'correct is not the ones digit',
      find:'        var s = oa + ob;\n        var correct = s % 10;',
      replace:'        var s = oa + ob;\n        var correct = s;' },
    { file:'index', expect:"first match",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"measure to the box, not the centre",
      find:"var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"var dd = dx * dx + dy * dy, dc = dd;" },
    { file:'index', expect:"is moved into its neighbour",
      find:"return best && !best.done ? best : null;",
      replace:"return best;" },
    { file:'index', expect:"a card is accepted under another place",
      find:"if (s.k !== P.data.k){ roundMiss(",
      replace:"if (false){ roundMiss(" },
    { file:'index', expect:"must be different digits and not 0",
      find:"{ a:156, b:47, op:'+' }",
      replace:"{ a:156, b:44, op:'+' }" },
    { file:'index', expect:"is outside 0~999",
      find:"{ a:362, b:48, op:'-' }",
      replace:"{ a:36, b:48, op:'-' }" },
    { file:'index', expect:"gAlignWrong zh does not name both places",
      find:"'，要排在' + this.colName(q)",
      replace:"'，要排在' + this.colName(k)" },
    { file:'index', expect:"must be singular",
      find:"'This ' + v + ' means ' + v + ' ' + this.colUnit(q, v)",
      replace:"'This ' + v + ' means ' + v + ' ' + this.colUnit(q, 2)" },
    { file:'index', expect:"a one is accepted on the tens",
      find:"if (z === tz){ roundMiss(d.gTradeNotT); return false; }",
      replace:"if (false){ roundMiss(d.gTradeNotT); return false; }" },
    { file:'index', expect:"should be 11~17",
      find:"{ a:27, b:15 }",
      replace:"{ a:27, b:13 }" },
    { file:'index', expect:"tucked under the tens box",
      find:"var TRADE_FRAME = { x:50, y:316,",
      replace:"var TRADE_FRAME = { x:50, y:330," },
    { file:'index', expect:"tradeCubeXY(",
      find:"C.top + Math.floor(i / C.per) * C.step",
      replace:"C.top + Math.floor(i / 5) * C.step" },
    { file:'index', expect:"gTradeDone zh",
      find:"' 個一。十位 ' + ta + ' + ' + tb + ' + 1 = '",
      replace:"' 個一。十位 ' + ta + ' + ' + tb + ' = '" },
    { file:'index', expect:"colSteps() is",
      find:"      if (st.cout) out.push({ kind:'c', p:st.p + 1, v:1, st:st });\n",
      replace:"" },
    { file:'index', expect:"colMissKind for",
      find:"if (st.cin && v === (st.da + st.db) % 10) return 'forgot';",
      replace:"if (st.cin && v === (st.da + st.db + 1) % 10) return 'forgot';" },
    { file:'index', expect:"a box that is not lit takes a card",
      find:"if (c !== cellOf(s)){",
      replace:"if (false){" },
    { file:'index', expect:"a wrong digit is accepted in the lit box",
      find:"if (v !== s.v){\n          var kind",
      replace:"if (false){\n          var kind" },
    { file:'index', expect:"no entry where only the tens carry",
      find:"{ a:264, b:53 },",
      replace:"{ a:265, b:58 }," },
    { file:'index', expect:"gColCarryOne zh",
      find:"'滿十只進 1：10 個' + this.colUnit(3 - p)",
      replace:"'滿十只進 1：10 個' + this.colUnit(2 - p)" },
    { file:'index', expect:"borrowRule() disagrees",
      find:"    if (cnt[cur] >= need[cur]) return 'enough';\n",
      replace:"" },
    { file:'index', expect:"borrowRule() disagrees",
      find:"    for (var m = c + 1; m < cur; m++) if (cnt[m] > 0) return 'near';\n",
      replace:"" },
    { file:'index', expect:"Take away works when the place is short",
      find:"if (cnt[cur] < need[cur]){ roundMiss(d.gBorShort(",
      replace:"if (false){ roundMiss(d.gBorShort(" },
    { file:'index', expect:"no entry where the tens are 0",
      find:"{ a:62, b:27 }, { a:305, b:148 }, { a:352, b:175 }, { a:83, b:46 }, { a:402, b:165 }",
      replace:"{ a:62, b:27 }, { a:315, b:148 }, { a:352, b:175 }, { a:83, b:46 }, { a:412, b:165 }" },
    { file:'index', expect:"no place needs a borrow",
      find:"{ a:83, b:46 }, { a:402",
      replace:"{ a:87, b:46 }, { a:402" },
    { file:'index', expect:"borBlockXY(",
      find:"top + b.h / 2 + Math.floor(i / b.per) * b.sy };",
      replace:"top + b.h / 2 + Math.floor(i / b.per) * b.sy * 2 };" },
    { file:'index', expect:"checkSlotRule(-",
      find:"if (op === '-') return key === 'a' ? 'minuend' : null;",
      replace:"if (op === '-') return null;" },
    { file:'index', expect:"a card is accepted in a box checkSlotRule() refuses",
      find:"if (why === 'minuend'){ roundMiss(",
      replace:"if (false){ roundMiss(" },
    { file:'index', expect:"a wrong verdict is accepted",
      find:"if (saidRight !== same){ roundMiss(",
      replace:"if (false){ roundMiss(" },
    { file:'index', expect:"leaves 0~999",
      find:"{ a:168, b:245, op:'+', given:313 }",
      replace:"{ a:264, b:53, op:'+', given:217 }" },
    { file:'index', expect:"two of the three cards show the same number",
      find:"{ a:83, b:46, op:'-', given:43 }",
      replace:"{ a:83, b:46, op:'-', given:83 }" },
    { file:'index', expect:"a mistake changed the score",
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    { file:'index', expect:"stars: a round with",
      find:"var stars = gMistakes === 0 ? 2 : 1;",
      replace:"var stars = 2;" },
    { file:'index', expect:"must say it is all taps",
      find:"borrow:'這一關用點的：",
      replace:"borrow:'" },
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"if (false){ hintLevel = 1; showHint(); }" },
    { file:'index', expect:"a carry box is",
      find:"COL_CARRY = { w:48, h:46, y:4 }",
      replace:"COL_CARRY = { w:48, h:40, y:4 }" },
    { file:'index', expect:"renders its options without shuffle",
      find:"shuffle(items).forEach(",
      replace:"items.forEach(" },
    { file:'index', expect:"never shown once both boxes are filled",
      find:"          row.style.display = '';\n",
      replace:"" },
    { file:'index', expect:"say \"less than ten\"",
      find:"' — less than ten, so nothing carries.'",
      replace:"' — not ten, so nothing carries.'" },
    { file:'index', expect:"exactly at 10",
      find:"if (inFrame.length === 10){",
      replace:"if (inFrame.length === 9){" },
    { file:'index', expect:"the check number or the number it should come back to",
      find:"other = sub ? e.a : (slots[1].key === 'a' ? e.b : e.a);",
      replace:"other = sub ? e.a : (slots[1].key === 'a' ? e.a : e.b);" },
    { file:'index', expect:'CHECK_CASES should contain exactly one wrong answer',
      find:"    { a:45,  b:38,  op:'+', given:73 },",
      replace:"    { a:45,  b:38,  op:'+', given:83 }," },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'個位 5 + 4 = 9，十位 2 + 3 = 5，沒有滿十，不用進位 → 59。'",
      replace:"why:'個位 5 + 4 = 8，十位 2 + 3 = 5，沒有滿十，不用進位 → 59。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'個位 8 + 6 = 14，寫 4、進位 1；十位 4 + 2 + 1 = 7 → 74。'",
      replace:"why:'個位八加六，寫 4、進位 1；十位四加二加一 → 74。'" },
    { file:'index', expect:"set of verified equations changed",
      find:"why:'個位 5 + 4 = 9，十位 2 + 3 = 5，沒有滿十，不用進位 → 59。'",
      replace:"why:'個位 5 + 4 = 9，十位 2 + 3 = 5，另外 1 + 1 = 2 → 59。'" },
    { file:'index', expect:"was excused 3 time(s)",
      find:"why:'用加法檢查：57 + 28 = 85，不是 71，所以算錯了。正確是 71 − 28 = 43。'",
      replace:"why:'用加法檢查：57 + 28 = 85，不是 71，所以算錯了。旁邊那本也寫 71 − 28 = 57。正確是 71 − 28 = 43。'" }
  ],

  sim: {
    INVARIANTS: {
      addNoCarry: d => {
        if (d.oa + d.ob > 9) return 'ones carry but why says no carry';
        if (d.ta + d.tb > 9) return 'tens overflow but why says no carry';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      addCarryOnes: d => {
        if (d.oa + d.ob < 10) return 'why claims a ones carry but there is none';
        if (d.ta + d.tb + 1 > 9) return 'result is not 2-digit as the why implies';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      addCarryTens: d => {
        if (d.oa + d.ob > 9) return 'why says the ones do not carry, but they do';
        if (d.ta + d.tb < 10) return 'why says the tens carry, but they do not';
        if (d.ha + d.hb + 1 > 9) return 'sum exceeds 999';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      subNoBorrow: d => {
        if (needsBorrow(d.a, d.b)) return 'why says no borrowing, but a borrow is needed';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      subBorrowOnes: d => {
        if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
        if (d.ta - 1 < d.tb) return 'tens cannot cover after lending';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      subBorrowZero: d => {
        if (Math.floor(d.a / 10) % 10 !== 0) return 'why says the tens are 0, but they are not';
        if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
        if (d.ha - 1 < d.hb) return 'hundreds cannot cover after lending';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      onesDigit: d => {
        if (d.oa + d.ob < 10) return 'why says the 1 carries, but the ones do not reach ten';
        if ((d.oa + d.ob) % 10 !== d.correct) return 'correct is not the ones digit';
        if (d.a + d.b > 999) return 'sum out of lesson range';
      },
      missingAddend: d => {
        if (d.b + d.correct !== d.sum) return 'b + correct != sum';
        if (d.sum > 999) return 'sum out of lesson range';
      },
      missingMinuend: d => {
        if (d.correct - d.b !== d.c) return 'correct - b != c';
        if (d.correct > 999) return 'minuend out of lesson range';
      },
      wordAdd: d => {
        if (d.oa + d.ob < 10) return 'why says carry 1, but the ones do not reach ten';
        if (d.x + d.y !== d.correct) return 'correct != x+y';
        if (d.correct > 999) return 'sum out of lesson range';
      },
      wordSub: d => {
        if (d.oa >= d.ob) return 'why says the ones need a borrow, but they do not';
        if (d.x - d.y !== d.correct) return 'correct != x-y';
        if (d.correct <= 0) return 'non-positive result';
      }
    },
    /* 選項一律是純數字，而且要落在這一課自己的數字範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [0, 999];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{ADD_CASES, SUB_CASES, CHECK_CASES, planAdd, planSub, digitsOf, GAME_W, GPICK, GPAD, GAME_ORDER, digits3, ' +
      'GAME_ALIGN, ALIGN_X, ALIGN_OPX, ALIGN_CELL, ALIGN_HDY, ALIGN_TOPY, ALIGN_BOTY, ALIGN_LINEY, ALIGN_RESY, ALIGN_TILE, ALIGN_H, ' +
      'GAME_TRADE, TRADE_T, TRADE_O, TRADE_HDH, TRADE_CUBE, TRADE_BAR, TRADE_FRAME, TRADE_H, tradeCubeXY, tradeBarXY, tradeCellXY, ' +
      'GAME_COLUMN, COL_X, COL_OPX, COL_CARRY, COL_ROWY, COL_ROWH, COL_LINEY, COL_RES, COL_KEYS, COL_H, colSteps, colMissKind, ' +
      'GAME_BORROW, BOR_COL, BOR_TOP, BOR_NEEDY, BOR_H, BOR_BLK, borBlockXY, borrowRule, ' +
      'GAME_CHECK, CHK_SLOT, CHK_SIGNX, CHK_EQX, CHK_RES, CHK_CMPY, CHK_CARD, CHK_H, checkSlotRule}',
    /* 三層題庫的數字選項不可以超過這一課的範圍（qs 有「614」這種刻意的迷思誘答，故只驗進階／迷思兩層）。 */
    optionValueMax: 999,
    check: function(data, I18N, fail, src){
      /* --- 範例 1：加法逐步 --- */
      data.ADD_CASES.forEach(c => {
        const p = data.planAdd(c.a, c.b);
        if (p.res !== c.a + c.b) fail(`planAdd ${c.a}+${c.b} res=${p.res}`);
        const digs = String(p.res).split('').reverse().map(Number);
        p.steps.forEach(st => {
          if (st.digit !== (digs[st.p] || 0)) fail(`planAdd ${c.a}+${c.b} place ${st.p} digit ${st.digit} != ${digs[st.p]}`);
          if (st.da + st.db + st.cin !== st.sum) fail(`planAdd ${c.a}+${c.b} step sum mismatch`);
          ['zh','en'].forEach(L => {
            const t = I18N[L].addWhy(st, I18N[L].places[st.p], I18N[L].places[st.p+1] || '');
            if (/undefined|NaN/.test(t)) fail(`addWhy ${L} ${c.a}+${c.b}: ${t}`);
          });
        });
        if (p.steps.length !== String(p.res).length && p.steps.length !== Math.max(String(c.a).length, String(c.b).length))
          fail(`planAdd ${c.a}+${c.b} step count ${p.steps.length}`);
      });

      /* --- 範例 2：減法逐步（含連續退位） --- */
      data.SUB_CASES.forEach(c => {
        const p = data.planSub(c.a, c.b);
        if (p.res !== c.a - c.b) fail(`planSub ${c.a}-${c.b} res=${p.res}`);
        if (p.res < 0) fail(`planSub ${c.a}-${c.b} negative`);
        const digs = String(p.res).split('').reverse().map(Number);
        p.steps.forEach(st => {
          if (st.digit !== (digs[st.p] || 0)) fail(`planSub ${c.a}-${c.b} place ${st.p} digit ${st.digit} != ${digs[st.p]}`);
          if (st.digit < 0 || st.digit > 9) fail(`planSub ${c.a}-${c.b} bad digit ${st.digit}`);
          if (st.from !== null && st.da - 10 >= st.db) fail(`planSub ${c.a}-${c.b} borrowed when it did not need to`);
          if (st.from === null && st.da < st.db) fail(`planSub ${c.a}-${c.b} did not borrow when needed`);
          ['zh','en'].forEach(L => {
            const t = I18N[L].subWhy(st, I18N[L].places[st.p], st.from === null ? '' : I18N[L].places[st.from]);
            if (/undefined|NaN/.test(t)) fail(`subWhy ${L} ${c.a}-${c.b}: ${t}`);
          });
        });
      });
      const kinds = data.SUB_CASES.map(c => {
        const st = data.planSub(c.a, c.b).steps;
        if (st.every(s => s.from === null)) return 'none';
        if (st.some(s => s.across)) return 'across';
        return 'simple';
      });
      ['none','simple','across'].forEach(k => { if (kinds.indexOf(k) < 0) fail('SUB_CASES missing kind ' + k); });

      /* --- 範例 3：驗算 --- */
      let wrongCount = 0;
      data.CHECK_CASES.forEach(c => {
        const back = (c.op === '-') ? c.given + c.b : c.given - c.b;
        const right = (c.op === '-') ? c.a - c.b : c.a + c.b;
        const ok = back === c.a;
        if (!ok) wrongCount++;
        if (ok && c.given !== right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check passes but the given answer is not the right one`);
        if (!ok && c.given === right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check fails but the given answer IS right`);
        if (right < 0 || right > 999) fail(`CHECK ${c.a}${c.op}${c.b} out of lesson range`);
      });
      if (wrongCount !== 1) fail(`CHECK_CASES should contain exactly one wrong answer, found ${wrongCount}`);

      /* --- 遊戲：五關五種玩法（見上面的 gameCheck） --- */
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
                    const r = arithAddSub(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 48) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 48`);
            if (qSum !== 8) fail(`question-shaped equations changed: found ${qSum}, expected 8`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithAddSub.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {"71 - 28 = 57": 2};
              const got = arithAddSub.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithAddSub.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== '0f97340e061f'){
                fail(`the set of verified equations changed (digest ${digest}, expected 0f97340e061f)\n      now: ${list.join(' | ')}`);
              }
            }
          }

    }
  }
};
