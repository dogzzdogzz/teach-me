/* grade-2/math/multiply（九九乘法）的檢查設定。

   和 grade-2/numbers 一樣，這一課是設定檔機制出現「之前」上線的，補上之前
   `node tools/simgen.js grade-2/math/multiply/review.html` 會直接報 no check config。

   範圍取自課程自己說的話：這一課是「九九乘法」，乘數與被乘數都在 2~9，
   所以積最大 81，選項上限就是 81 —— 不是隨手給一個寬鬆的大數。

   2026-10-01：小遊戲「餅乾工廠」從五題選擇題改成五關五種玩法（§六之五）—— 舊的 ROUNDS 檢查拿掉，
   換成 checkGame()（見下面那一段的說明）：每一關照遊戲的規則把每一題玩一次、每一句說明逐個比數字、
   nearestOpen()／roundSolved()／roundMiss() 從原始碼切出來真的跑、版面與觸控從資料區讀。 */

const MAXF = 9;            // 九九乘法：因數上限
const MAXP = MAXF * MAXF;  // 積上限 81

/* 選項是「算式字串」而不是數字的兩個產生器。 */
const EXPR_GENS = { repeatedAdd: true, sameTotal: true };

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithMultiply = require('./lib/arith.js').makeArith({
  units: ["個", "顆", "排", "盒", "包", "隻", "張", "人", "組", "倍"],
  unitsEn: ["groups?", "rows?", "boxes", "box", "items?", "pieces?", "times", "people", "person", "legs?"]
});

/* ---------- 小遊戲「餅乾工廠」（2026-10-01 改成五關五種玩法，§六之五）的檢查 ----------
   每一關照遊戲自己的規則把**每一題**從頭玩一次（裝盤把所有放法走完），證明一定解得完、解完一定是對的答案；
   每一句說明的數字逐個比（每一題、每一個狀態、每一種放錯），句子裡的算式（含連等式）逐段重算；
   頁面的純函式（addsOf／plateX／plateCookieXY／writePlateX／trayDotXY／trayCards／hopCellXY／timesX0）拿整個題庫去呼叫；
   nearestOpen()、roundSolved()、roundMiss() 從原始碼切出來**真的跑**；RENDER 裡切不出來的規則用原始碼形狀守住（need()）。
   版面數字一律從 index.html 的資料區讀，不在這裡另抄一份。

   已知極限：need() 是字面掃描 —— 證明那一行寫著，證明不了它被執行；拖拉、點選、兩根手指、capture 遺失、
   375px 的實際尺寸、重疊區「放進最近的那一格」的實際行為由 teaching-workspace/game-harness/g2-multiply 的端對端測試驗。 */
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }

/* 算式鏈：「4 + 4 + 4 = 12」「6 × 3 = 3 × 6 = 18」「18 − 3 = 15」—— 每一段都算出來，要全部相等（× 先算，再由左到右 + −） */
function scanChains(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const EXPR = '\\d+(?: ?[×+\\-] ?\\d+)*';
  const re = new RegExp('(?<![\\d.\\/])(?<![×+\\-=] ?)(' + EXPR + '(?: ?= ?' + EXPR + ')+)(?!\\d|\\.\\d|\\/)(?! ?[×+\\-=] ?\\d)', 'g');
  const evalExpr = e => {
    const toks = e.trim().split(/ ?([×+\-]) ?/), terms = [];
    let cur = +toks[0], sign = 1;
    for (let i = 1; i < toks.length; i += 2){
      const op = toks[i], v = +toks[i + 1];
      if (op === '×') cur *= v; else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
    }
    terms.push(sign * cur);
    return terms.reduce((x, y) => x + y, 0);
  };
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const parts = m[1].split(/ ?= ?/), vals = parts.map(evalExpr);
    out.push({ text:m[1], bad:vals.every(v => v === vals[0]) ? null : 'sides are ' + vals.join(' / ') });
  }
  return out;
}

function checkGame(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = 300;
  const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

  /* --- 0. 算式鏈掃描器自己先證明會響（positive / negative control） --- */
  [['4 + 4 + 4 = 12', true], ['4 + 4 + 4 = 13', false], ['6 × 3 = 3 × 6 = 18', true], ['6 × 3 = 3 × 5 = 18', false],
   ['18 − 3 = 15', true], ['18 − 3 = 16', false], ['寫成 3 × 4 = 12。', true], ['3 × 4 = 13', false], ['so 3 × 2 = 6.', true]]
    .forEach(([t, good]) => {
      const r = scanChains(t);
      if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanChains() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
    });
  /* 每一條 I18N 靜態字串的算式鏈（題庫的解釋另外由 arithMultiply 驗，這裡多驗一次連等式） */
  const walk = (v, where, out) => {
    if (typeof v === 'string') out.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
    return out;
  };
  let staticEq = 0;
  LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => scanChains(s).forEach(e => { staticEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); })));
  if (staticEq !== 24) fail('found ' + staticEq + ' equations in the static I18N strings, expected 24 — the chain scan stopped reading some (or new ones were added: update the pin)');

  /* 每一句說明：數字照順序逐個比，句子裡的算式鏈都要算得對 */
  let seqCount = 0;
  const seq = (where, text, want) => {
    seqCount++;
    if (typeof text !== 'string' || /undefined|NaN|null|\[object/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    const got = nums(text).join();
    if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
    scanChains(text).forEach(e => { if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
  };

  /* --- 1. 五關的順序、每一關的題目與兩層提示的第一層（兩種語言） --- */
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  const TYPES = ['plate', 'write', 'tray', 'hop', 'times'];
  if ((D.GAME_ORDER || []).join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 1, 2, 3, then 倍), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const needSrc = (re, what) => { if (!re.test(src)) fail(what); };
  TYPES.forEach(t => LANGS.forEach(L => {
    ['gAsks', 'gHints'].forEach(g => { if (!(I18N[L][g] && typeof I18N[L][g][t] === 'string' && I18N[L][g][t])) fail(g + '.' + t + ' missing in ' + L); });
  }));
  ['GAME_PLATE', 'GAME_WRITE', 'GAME_TRAY', 'GAME_HOP', 'GAME_TIMES'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 3) fail(k + ' should be a pool of at least 3 entries (pick() of an empty pool crashes the round)');
  });

  /* --- 2. 互動規範（§六之五 實作要點）：寫在引擎裡、切不出來的，用原始碼形狀守住 --- */
  needSrc(/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'hints: ahead mode does not show hint level 1 automatically');
  needSrc(/hintLevel\+\+;\s*showHint\(\);\s*if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'hints: the second hint does not disable the hint button (two levels)');
  needSrc(/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'pointer: no lostpointercapture safety (a piece could get stuck)');
  needSrc(/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/, 'pointer: no pointercancel safety');
  needSrc(/if \(!start \|\| e\.pointerId !== pid\) return;\s*var p = B\.toBoard\(e\)/, 'pointer: pointermove does not follow only the first finger');
  needSrc(/\.gpiece\.locked\{ cursor:default; pointer-events:none \}/, 'pointer: placed pieces still take pointer events');
  needSrc(/\.gpiece\{[^}]*touch-action:none/, 'pointer: pieces do not set touch-action:none');
  needSrc(/gameStage\.textContent = '';\s*var ask/, 'render: startRound() does not clear the stage before drawing');
  needSrc(/function renderAll\(\)\{[\s\S]*?restartGame\(\);\s*\}/, 'render: a language switch does not rebuild the game');
  needSrc(/var k = Math\.min\(1\.5, avail \/ W\);/, 'board: the board is not scaled with k ≤ 1.5');
  needSrc(/return \{ x:\(e\.clientX - r\.left\) \/ k, y:\(e\.clientY - r\.top\) \/ k \};/, 'board: pointer positions are not converted to board coordinates (÷ k)');

  /* --- 3. 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = 0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = {}, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves) => new Function(env.replace('S0', s0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore, missHtml = gMsg.innerHTML;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, missHtml:missHtml, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
          if (misses && String(r.missHtml).indexOf('why') < 0) fail('stars: roundMiss() does not show the reason');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
      } catch (e){ fail('stars: roundSolved()/roundMiss() could not run: ' + e.message); }
    }
    needSrc(/gSolved = false; gMistakes = 0; gCtx = \{\};/, 'stars: startRound() does not reset the mistakes of the previous round');
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    seq('gStars ' + L, d.gStars(2), [2]);
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' missing or has a number in it');
  });

  /* --- 3b. 先點、再點（useTapSelect + keepSelected 從原始碼切出來真的跑）：拿不完的東西（data.reuse）放好、或放錯被說明之後
         都繼續選著；點到空白處（沒放、也沒算錯）取消選取；一次用完的卡片點完一律取消選取（codex 第一輪） --- */
  {
    const fu = extractFunction(src, 'useTapSelect'), fk = extractFunction(src, 'keepSelected');
    if (!fu || !fk) fail('tap-select: cannot find useTapSelect()/keepSelected() in index.html');
    else {
      try {
        const run = (reuse, outcome) => new Function('var gSolved = false, gMistakes = 0;\n' + fu + '\n' + fk + '\n' +
          'var cls = {}; var P = { locked:false, data:' + (reuse ? '{ reuse:true }' : '{}') + ', busy:function(){ return false; }, el:{ classList:{ add:function(c){ cls[c] = 1; }, remove:function(c){ delete cls[c]; } } } };' +
          'var B = {}; useTapSelect(B, function(Q, pt){ if (!pt.tap) throw new Error("no tap flag"); ' +
          (outcome === 'ok' ? 'return true;' : outcome === 'miss' ? 'gMistakes++; return false;' : 'return false;') + ' });' +
          'B.onTap(P); var first = B.selected === P && !!cls.sel; B.onPointTap(P, { x:1, y:1 }); return { first:first, kept:B.selected === P, sel:!!cls.sel };')();
        [[true, 'ok', true], [true, 'miss', true], [true, 'empty', false], [false, 'ok', false], [false, 'miss', false], [false, 'empty', false]].forEach(([reuse, oc, want]) => {
          const r = run(reuse, oc);
          if (!r.first) fail('tap-select: tapping a piece does not select it');
          if (r.kept !== want || r.sel !== want) fail('tap-select: a ' + (reuse ? 'reusable' : 'one-use') + ' piece after a tap-drop that is ' + oc + ' is ' + (r.kept ? 'still' : 'no longer') + ' selected — should be ' + (want ? 'kept' : 'cleared'));
        });
      } catch (e){ fail('tap-select: useTapSelect() could not run: ' + e.message); }
    }
  }

  /* --- 4. nearestOpen()：從原始碼切出來真的跑 --- */
  const fsrc = extractFunction(src, 'nearestOpen');
  let nearestOpen = null;
  if (!fsrc) fail('cannot find nearestOpen() in index.html');
  else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  const box = (id, x, y, w, h) => ({ id, cx:x + w / 2, cy:y + h / 2, hw:w / 2, hh:h / 2, done:false });
  if (nearestOpen){
    /* ① 第 1 關的五個盤子：點在盤子裡的，一定判給那一個盤子（相鄰盤子只隔 PLATE.gap，放寬 PLATE_PAD 之後重疊） */
    const plates = []; for (let i = 0; i < D.PLATE_N; i++) plates.push(box(i, D.plateX(i) - D.PLATE.w / 2, D.PLATE.y - D.PLATE.h / 2, D.PLATE.w, D.PLATE.h));
    let bad = 0;
    plates.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 4){ const g = nearestOpen(plates, { x, y }, D.PLATE_PAD); if (!g || g.id !== b.id) bad++; } });
    if (bad) fail('nearestOpen(): ' + bad + ' points inside a plate are given to another plate (or none)');
    /* ② 第 3 關的兩個籃子（真的版面）：✅ 裡面靠近 ❌ 的點 → ✅（量方框不是量中心）；中間空隙靠近 ❌ 的點 → ❌（不是陣列裡第一個） */
    const bins = [box('ok', D.TRAY_OK.x, D.TRAY_OK.y, D.TRAY_OK.w, D.TRAY_OK.h), box('no', D.TRAY_NO.x, D.TRAY_NO.y, D.TRAY_NO.w, D.TRAY_NO.h)];
    const cy = D.TRAY_OK.y + D.TRAY_OK.h / 2, okR = D.TRAY_OK.x + D.TRAY_OK.w, noL = D.TRAY_NO.x;
    for (let x = D.TRAY_OK.x + 0.5; x < okR; x += 0.5){ const g = nearestOpen(bins, { x, y:cy }, D.TRAY_PAD); if (!g || g.id !== 'ok') { fail('nearestOpen(): a drop inside ✅ at x ' + x + ' is given to ' + (g && g.id) + ' (measure to the box, not the centre)'); break; } }
    for (let x = noL + 0.5; x < D.TRAY_NO.x + D.TRAY_NO.w; x += 0.5){ const g = nearestOpen(bins, { x, y:cy }, D.TRAY_PAD); if (!g || g.id !== 'no') { fail('nearestOpen(): a drop inside ❌ at x ' + x + ' is given to ' + (g && g.id)); break; } }
    for (let x = okR + 0.25; x < noL; x += 0.25){
      const g = nearestOpen(bins, { x, y:cy }, D.TRAY_PAD), want = (x - okR) < (noL - x) ? 'ok' : (x - okR) > (noL - x) ? 'no' : null;
      if (want && (!g || g.id !== want)){ fail('nearestOpen(): a drop in the gap at x ' + x + ' goes to ' + (g && g.id) + ', the nearer bin is ' + want + ' (not the first in the list)'); break; }
    }
    const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
    if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
    if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
  }

  /* --- 5. 版面與觸控（§六之五第 6 點）：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍 --- */
  const scale = Math.min(1.5, 290 / W);
  const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  const R = (x, y, w, h) => ({ x, y, w, h });
  const sq = (cx, cy, w, h) => R(cx - w / 2, cy - (h === undefined ? w : h) / 2, w, h === undefined ? w : h);
  const grow = (r, p) => R(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p);
  const inside = (o, what, H, Wd) => { Wd = Wd || W; if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  tooSmall('GPICK ' + D.GPICK, D.GPICK);

  /* ===== 第 1 關：裝盤 ===== */
  {
    const P = D.PLATE, H = D.PLATE_H;
    const plates = []; for (let i = 0; i < D.PLATE_N; i++) plates.push(sq(D.plateX(i), P.y, P.w, P.h));
    plates.forEach((r, i) => inside(r, 'plate: plate ' + i, H));
    noHits(plates, 'plate: plates');
    tooSmall('plate: a plate (drop target) ' + P.w + ' wide', P.w);
    const jar = sq(D.PLATE_JAR.x, D.PLATE_JAR.y, D.PLATE_JAR.size);
    inside(jar, 'plate: the jar', H); tooSmall('plate: the jar', D.PLATE_JAR.size);
    if (D.PLATE_JAR.size < D.GPICK) fail('plate: the jar is smaller than GPICK');
    plates.forEach((r, i) => { if (hit(grow(r, D.PLATE_PAD), jar)) fail('plate: the jar sits inside plate ' + i + '\'s drop pad'); });
    /* 盤子裡最多 5 顆：每一顆都在盤子裡、在數字標籤上面、兩兩不碰 */
    const ck = []; for (let k = 0; k < 5; k++){ const q = D.plateCookieXY(k); ck.push(sq(q.x, q.y, D.COOKIE_SIZE)); }
    ck.forEach((r, k) => { if (!(r.x >= 2 && r.x + r.w <= P.w - 2 && r.y >= 2 && r.y + r.h <= P.h - 28)) fail('plate: cookie ' + (k + 1) + ' is outside the plate or on its count label: ' + JSON.stringify(r)); });
    noHits(ck, 'plate: cookies');
    need('plate', /addPiece\(B, \{ w:PLATE_JAR\.size, h:PLATE_JAR\.size, cx:PLATE_JAR\.x, cy:PLATE_JAR\.y,/, 'the jar is not drawn at PLATE_JAR');
    need('plate', /target\(B, plateX\(i\) - PLATE\.w \/ 2, PLATE\.y - PLATE\.h \/ 2, PLATE\.w, PLATE\.h, 'gdish'/, 'the plates are not drawn at plateX()');
    need('plate', /var t = nearestOpen\(dishes, pt, PLATE_PAD\);\s*if \(!t\) return false;/, 'a drop away from every plate is not silent');
    need('plate', /if \(t\.n >= e\.a\)\{ roundMiss\(d\.gPlateFull\(e\.a\)\); return false; \}/, 'a cookie is accepted on a plate that already holds a');
    need('plate', /if \(t\.n === 0 && used >= e\.b\)\{ roundMiss\(d\.gPlateMany\(e\.b, e\.a\)\); return false; \}/, 'a plate past the b-th can be started');
    need('plate', /addCookie\(t\.z, plateCookieXY\(t\.n\)\);\s*t\.n\+\+; t\.num\.textContent = t\.n;/, 'a cookie is not drawn on the plate and counted');
    need('plate', /if \(full === e\.b\)\{[\s\S]*?line\.textContent = addsOf\(e\.a, e\.b\);\s*roundSolved\(d\.gPlateDone\(e\.a, e\.b, e\.a \* e\.b\)\);/, 'the round is not solved exactly when b plates are full');
    need('plate', /cls:'gjar', label:d\.gJar, data:\{ reuse:true \} \}\);/, 'the jar is not marked reuse (it would not stay selected after a tap-then-tap)');

    D.GAME_PLATE.forEach((e, i) => {
      const a = e.a, b = e.b, p = a * b, tag = 'plate ' + b + '個' + a;
      if (!(a >= 2 && a <= 5 && b >= 2 && b < D.PLATE_N)) fail(tag + ': needs 2 ≤ a ≤ 5 (fits a plate) and 2 ≤ b < ' + D.PLATE_N + ' (a spare plate, or "too many plates" is never tested)');
      if (a === b) fail(tag + ': a ≠ b — with a = b the number of plates and the size of a plate cannot be told apart');
      /* 照遊戲的規則把所有放法走完：每一個走得到的狀態都還有一步可走，走完一定是 b 盤、每盤 a 顆 */
      const seen = new Set(), queue = [Array(D.PLATE_N).fill(0)], why = { full:0, many:0 };
      let finals = 0;
      while (queue.length){
        const st = queue.pop(), key = st.join();
        if (seen.has(key)) continue;
        seen.add(key);
        const full = st.filter(x => x === a).length, used = st.filter(x => x > 0).length;
        if (full === b){
          finals++;
          if (used !== b || st.some(x => x !== 0 && x !== a) || st.reduce((x, y) => x + y, 0) !== p) fail(tag + ': finished as ' + key + ' — not ' + b + ' plates of ' + a);
          continue;
        }
        let moves = 0;
        for (let t = 0; t < D.PLATE_N; t++){
          if (st[t] >= a){ why.full++; continue; }
          if (st[t] === 0 && used >= b){ why.many++; continue; }
          const nx = st.slice(); nx[t]++; queue.push(nx); moves++;
        }
        if (!moves) fail(tag + ': stuck at ' + key);
      }
      if (!finals) fail(tag + ': can never be finished');
      if (!why.full || !why.many) fail(tag + ': the "full plate" / "too many plates" rules are never reachable');
      const adds = D.addsOf(a, b), want = []; for (let k = 0; k < b; k++) want.push(a); want.push(p);
      seq(tag + ' addsOf', adds, want);
      if (scanChains(adds).length !== 1) fail(tag + ': addsOf() is not one equation: ' + adds);
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let f = 0; f <= b; f++) seq(tag + ' gPlateNow ' + L, d.gPlateNow(a, b, f), [b, a, f, b]);
        for (let left = 1; left <= b; left++) seq(tag + ' gPlate2 ' + L, d.gPlate2(a, left), [left, a]);
        seq(tag + ' gPlateFull ' + L, d.gPlateFull(a), [a]);
        seq(tag + ' gPlateMany ' + L, d.gPlateMany(b, a), [b, a, b]);
        seq(tag + ' gPlateDone ' + L, d.gPlateDone(a, b, p), [b, a, p, a, b, p]);
      });
    });
    LANGS.forEach(L => { for (let i = 1; i <= D.PLATE_N; i++) seq('gDish ' + L, I18N[L].gDish(i), [i]); });
  }

  /* ===== 第 2 關：寫算式 ===== */
  {
    const WP = D.WRITE_PLATE, EQ = D.WRITE_EQ, TR = D.WRITE_TRAY, H = D.WRITE_H;
    const slots = EQ.xs.map((cx, s) => sq(cx, EQ.y, s === 2 ? EQ.wide : EQ.slot, EQ.slot));
    slots.forEach((r, s) => { inside(r, 'write: box ' + s, H); tooSmall('write: box ' + s + ' with its pad', Math.min(r.w, r.h) + 2 * D.WRITE_PAD); });
    const ops = EQ.ops.map(x => sq(x, EQ.y, 28, EQ.slot));
    noHits(slots.concat(ops), 'write: boxes and signs');
    if (!(EQ.xs[0] < EQ.ops[0] && EQ.ops[0] < EQ.xs[1] && EQ.xs[1] < EQ.ops[1] && EQ.ops[1] < EQ.xs[2])) fail('write: the boxes and signs are not in the order □ × □ = □');
    tooSmall('write: a card', TR.card); if (TR.card < D.GPICK) fail('write: a card is smaller than GPICK');
    const cards = [0, 1, 2, 3].map(i => sq((W - 3 * TR.step) / 2 + i * TR.step, TR.y, TR.card));
    cards.forEach((r, i) => { inside(r, 'write: card ' + i, H); slots.forEach((s, j) => { if (hit(grow(s, D.WRITE_PAD), r)) fail('write: card ' + i + ' sits inside box ' + j + '\'s drop pad'); }); });
    noHits(cards, 'write: cards');
    const ck = []; for (let k = 0; k < 5; k++){ const q = D.plateCookieXY(k); ck.push(sq(q.x, q.y, D.COOKIE_SIZE)); }
    ck.forEach((r, k) => { if (!(r.x >= 2 && r.x + r.w <= WP.w - 2 && r.y >= 2 && r.y + r.h <= WP.h - 2)) fail('write: cookie ' + (k + 1) + ' is outside a drawn plate'); });
    need('write', /renderTray\(B, \[e\.a, e\.b, p, e\.a \+ e\.b\], WRITE_TRAY\.y, function\(v, cx, cy\)\{\s*addPiece\(B, \{ w:WRITE_TRAY\.card, h:WRITE_TRAY\.card, cx:cx, cy:cy,/, 'the cards are not a, b, a × b, a + b (WRITE_TRAY.card, shuffled)');
    need('write', /var z = addZone\(B, writePlateX\(e\.b, i\) - WP\.w \/ 2, WP\.y - WP\.h \/ 2, WP\.w, WP\.h, 'gdish full'\);\s*for \(var k = 0; k < e\.a; k\+\+\) addCookie\(z, plateCookieXY\(k\)\);/, 'the picture is not b plates of a');
    need('write', /if \(s\.k === 0 && v !== e\.a\)\{ roundMiss\(v === e\.b \? d\.gWriteOrderA\(e\.a, e\.b\) : d\.gWriteFirst\(e\.a\)\); return false; \}/, 'the first box takes something other than a (one plate goes first), or the reason is wrong');
    need('write', /if \(s\.k === 1 && v !== e\.b\)\{ roundMiss\(v === e\.a \? d\.gWriteOrderB\(e\.b, e\.a\) : d\.gWriteSecond\(e\.b\)\); return false; \}/, 'the second box takes something other than b, or the reason is wrong');
    need('write', /if \(s\.k === 2 && v !== p\)\{ roundMiss\(v === e\.a \+ e\.b \? d\.gWriteSum\(e\.a, e\.b, e\.a \+ e\.b\) : d\.gWriteTotal\(e\.b, e\.a\)\); return false; \}/, 'the total box takes something other than a × b, or the reason is wrong');
    need('write', /if \(slots\.every\(function\(x\)\{ return x\.done; \}\)\) roundSolved\(d\.gWriteDone\(e\.a, e\.b, p\)\);/, 'the round is not solved exactly when all three boxes are filled');
    D.GAME_WRITE.forEach(e => {
      const a = e.a, b = e.b, p = a * b, s = a + b, tag = 'write ' + a + '×' + b;
      if (!(a >= 2 && a <= 5 && b >= 2 && b <= 4)) fail(tag + ': needs 2 ≤ a ≤ 5 (fits a plate) and 2 ≤ b ≤ 4 (plates fit the board)');
      if (a === b) fail(tag + ': a ≠ b — otherwise "one plate goes first" cannot be seen');
      const pl = []; for (let i = 0; i < b; i++) pl.push(sq(D.writePlateX(b, i), WP.y, WP.w, WP.h));
      pl.forEach(r => inside(r, tag + ': a plate', H)); noHits(pl, tag + ': plates');
      pl.forEach(r => slots.concat(cards).forEach(o => { if (hit(r, o)) fail(tag + ': a plate overlaps a box or a card'); }));
      const vals = [a, b, p, s];
      if (new Set(vals).size !== 4) fail(tag + ': the cards ' + vals.join(',') + ' are not four different numbers');
      /* 照規則放：第一格只收 a、第二格只收 b、第三格只收 a × b；每一格剛好一張、每一張最多一格 → 一定解得完，解完是 a × b = p */
      const want = [a, b, p];
      want.forEach((w, k) => { const ok = vals.filter(v => v === w).length; if (ok !== 1) fail(tag + ': box ' + k + ' takes ' + ok + ' cards'); });
      LANGS.forEach(L => {
        const d = I18N[L];
        vals.forEach(v => {
          if (v !== a) seq(tag + ' box1 ' + v + ' ' + L, v === b ? d.gWriteOrderA(a, b) : d.gWriteFirst(a), v === b ? [a, a, b] : [a]);
          if (v !== b) seq(tag + ' box2 ' + v + ' ' + L, v === a ? d.gWriteOrderB(b, a) : d.gWriteSecond(b), v === a ? [b, a] : [b]);
          if (v !== p){
            /* gWriteTotal 說「不是一盤，也不是盤數」—— 只有 a 和 b 會走到那一句 */
            if (v !== s && v !== a && v !== b) fail(tag + ': card ' + v + ' in the total box gets a reason that says it is one plate or the number of plates');
            seq(tag + ' box3 ' + v + ' ' + L, v === s ? d.gWriteSum(a, b, s) : d.gWriteTotal(b, a), v === s ? [a, b, s, b, a, b] : [b, a]);
          }
        });
        seq(tag + ' gWrite2 ' + L, d.gWrite2(a, b), [a, b]);
        seq(tag + ' gWriteDone ' + L, d.gWriteDone(a, b, p), [a, b, a, b, p]);
      });
    });
  }

  /* ===== 第 3 關：排烤盤 ===== */
  {
    const H = D.TRAY_H, OK = D.TRAY_OK, NO = D.TRAY_NO, C = D.TRAY_CARD, pan = R(D.TRAY_PAN.x, D.TRAY_PAN.y, D.TRAY_PAN.w, D.TRAY_PAN.h);
    inside(pan, 'tray: the tray', H); inside(R(OK.x, OK.y, OK.w, OK.h), 'tray: ✅', H); inside(R(NO.x, NO.y, NO.w, NO.h), 'tray: ❌', H);
    noHits([pan, R(OK.x, OK.y, OK.w, OK.h), R(NO.x, NO.y, NO.w, NO.h)], 'tray: tray and bins');
    tooSmall('tray: a card', Math.min(C.w, C.h)); if (Math.min(C.w, C.h) < D.GPICK) fail('tray: a card is smaller than GPICK');
    const home = []; C.ys.forEach(y => C.xs.forEach(x => home.push(sq(x, y, C.w, C.h))));
    if (home.length !== 4) fail('tray: the card tray does not have 4 places');
    home.forEach((r, i) => { inside(r, 'tray: card place ' + i, H); [OK, NO].forEach(bn => { if (hit(grow(R(bn.x, bn.y, bn.w, bn.h), D.TRAY_PAD), r)) fail('tray: card place ' + i + ' sits inside a bin\'s drop pad'); }); });
    noHits(home, 'tray: card places');
    /* 放進籃子之後：✅ 兩張並排、❌ 兩張上下疊（縮成 38 高），都在籃子裡、在標籤下面、不互相蓋到 */
    const inOk = [0, 1].map(n => sq(OK.x + 46 + n * 88, OK.y + 70, C.w, C.h)), inNo = [0, 1].map(n => sq(NO.x + NO.w / 2, NO.y + 46 + n * 42, C.w, 38));
    inOk.forEach(r => { if (!(r.x >= OK.x && r.x + r.w <= OK.x + OK.w && r.y >= OK.y + 26 && r.y + r.h <= OK.y + OK.h)) fail('tray: a sorted card sticks out of ✅ or covers its label'); });
    inNo.forEach(r => { if (!(r.x >= NO.x && r.x + r.w <= NO.x + NO.w && r.y >= NO.y + 26 && r.y + r.h <= NO.y + NO.h)) fail('tray: a sorted card sticks out of ❌ or covers its label'); });
    noHits(inOk, 'tray: cards in ✅'); noHits(inNo, 'tray: cards in ❌');
    need('tray', /P\.lock\(TRAY_OK\.x \+ 46 \+ bin\.n \* 88, TRAY_OK\.y \+ 70\);/, 'cannot read where a card sorted into ✅ goes');
    need('tray', /shrink\(P, TRAY_CARD\.w, 38\); P\.lock\(TRAY_NO\.x \+ TRAY_NO\.w \/ 2, TRAY_NO\.y \+ 46 \+ bin\.n \* 42\);/, 'cannot read where a card sorted into ❌ goes');
    need('tray', /var cards = shuffle\(trayCards\(r, c\)\);/, 'the four cards are not trayCards(r, c), shuffled');
    need('tray', /addPiece\(B, \{ w:TRAY_CARD\.w, h:TRAY_CARD\.h, cx:TRAY_CARD\.xs\[i % 2\], cy:TRAY_CARD\.ys\[Math\.floor\(i \/ 2\)\], text:cd\.t,/, 'the cards are not drawn at TRAY_CARD');
    need('tray', /var q = trayDotXY\(i, j, r, c\);\s*addZone\(B, q\.x - TRAY\.dot \/ 2, q\.y - TRAY\.dot \/ 2, TRAY\.dot, TRAY\.dot, 'gtdot'\);/, 'the cookies are not drawn at trayDotXY()');
    need('tray', /for \(var i = 0; i < r; i\+\+\) for \(var j = 0; j < c; j\+\+\)\{/, 'the tray is not r rows × c columns');
    need('tray', /if \(bin\.yes && !cd\.yes\)\{ roundMiss\(cd\.kind === 'sum' \? d\.gTraySum\(r, c, r \+ c\) : d\.gTrayMiss\(c, r - 1, r\)\); return false; \}/, 'a card that does not count the tray is accepted in ✅, or the reason is wrong');
    need('tray', /if \(!bin\.yes && cd\.yes\)\{ roundMiss\(cd\.kind === 'row' \? d\.gTrayRow\(r, c, N\) : d\.gTrayCol\(r, c, N\)\); return false; \}/, 'a card that counts the tray is accepted in ❌, or the reason is wrong');
    need('tray', /if \(placed === 4\)\{\s*line\.textContent = c \+ ' × ' \+ r \+ ' = ' \+ r \+ ' × ' \+ c \+ ' = ' \+ N;\s*roundSolved\(d\.gTrayDone\(r, c, N\)\);/, 'the round is not solved exactly when all four cards are sorted');
    need('tray', /var bin = nearestOpen\(bins, pt, TRAY_PAD\);\s*if \(!bin\) return false;/, 'a drop away from both bins is not silent');
    D.GAME_TRAY.forEach(e => {
      const r = e.r, c = e.c, N = r * c, tag = 'tray ' + r + '排×' + c;
      if (!(r >= 3 && r <= 4 && c >= 2 && c <= 6)) fail(tag + ': needs 3 ≤ r ≤ 4 (one row short is still a multiplication) and 2 ≤ c ≤ 6');
      if (r === c) fail(tag + ': r ≠ c — otherwise across and down are the same card');
      /* 畫出來的點：都在烤盤裡、兩兩不碰；排數 r、每排 c 個 */
      const dots = [], xs = new Set(), ys = new Set();
      for (let i = 0; i < r; i++) for (let j = 0; j < c; j++){ const q = D.trayDotXY(i, j, r, c); xs.add(q.x); ys.add(q.y); dots.push(sq(q.x, q.y, D.TRAY.dot)); }
      dots.forEach(o => { if (!(o.x >= pan.x + 4 && o.y >= pan.y + 4 && o.x + o.w <= pan.x + pan.w - 4 && o.y + o.h <= pan.y + pan.h - 4)) fail(tag + ': a cookie sticks out of the tray'); });
      noHits(dots, tag + ': cookies');
      if (xs.size !== c || ys.size !== r) fail(tag + ': drawn as ' + ys.size + ' rows × ' + xs.size + ' columns');
      /* 四張卡：自己判斷哪幾張算得出這盤（× 而且兩個數就是 r 和 c）；❌ 的卡算出來也不可以剛好等於 N（不然孩子用算的會被騙） */
      const cards = D.trayCards(r, c);
      if (!Array.isArray(cards) || cards.length !== 4 || new Set(cards.map(x => x.t)).size !== 4) return fail(tag + ': trayCards() is not four different cards');
      const parsed = cards.map(cd => { const m = String(cd.t).match(/^(\d+) ([×+]) (\d+)$/); return m ? { x:+m[1], op:m[2], y:+m[3], cd } : null; });
      if (parsed.some(q => !q)) return fail(tag + ': a card is not "a × b" or "a + b": ' + cards.map(x => x.t).join(' | '));
      parsed.forEach(q => {
        const v = q.op === '×' ? q.x * q.y : q.x + q.y, mine = q.op === '×' && ((q.x === c && q.y === r) || (q.x === r && q.y === c));
        if (mine !== !!q.cd.yes) fail(tag + ': card ' + q.cd.t + ' is marked ' + (q.cd.yes ? '✅' : '❌'));
        if (!mine && v === N) fail(tag + ': the ❌ card ' + q.cd.t + ' equals ' + N + ' — computing it gives the tray count');
      });
      const kinds = {}; parsed.forEach(q => { kinds[q.cd.kind] = q; });
      const ok1 = kinds.row && kinds.row.x === c && kinds.row.y === r && kinds.row.op === '×', ok2 = kinds.col && kinds.col.x === r && kinds.col.y === c && kinds.col.op === '×';
      const ok3 = kinds.sum && kinds.sum.op === '+' && kinds.sum.x === r && kinds.sum.y === c, ok4 = kinds.miss && kinds.miss.op === '×' && kinds.miss.x === c && kinds.miss.y === r - 1;
      if (!(ok1 && ok2 && ok3 && ok4)) fail(tag + ': the cards should be row ' + c + ' × ' + r + ', col ' + r + ' × ' + c + ', sum ' + r + ' + ' + c + ', miss ' + c + ' × ' + (r - 1) + ' — got ' + cards.map(x => x.kind + ' ' + x.t).join(' | '));
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(tag + ' gTraySum ' + L, d.gTraySum(r, c, r + c), [r, c, r + c, r, c]);
        seq(tag + ' gTrayMiss ' + L, d.gTrayMiss(c, r - 1, r), [c, r - 1, r - 1, c, r]);
        seq(tag + ' gTrayRow ' + L, d.gTrayRow(r, c, N), [r, c, c, r, N]);
        seq(tag + ' gTrayCol ' + L, d.gTrayCol(r, c, N), [c, r, r, c, N]);
        seq(tag + ' gTray2 ' + L, d.gTray2(r, c), [r, c]);
        seq(tag + ' gTrayAria ' + L, d.gTrayAria(r, c), [r, c]);
        seq(tag + ' gTrayDone ' + L, d.gTrayDone(r, c, N), [c, r, N, r, c, N]);
      });
    });
    LANGS.forEach(L => { for (let n = 0; n <= 4; n++) seq('gTrayNow ' + L, I18N[L].gTrayNow(n), [n, 4]); ['gTrayYes', 'gTrayNo'].forEach(k => { if (typeof I18N[L][k] !== 'string' || /\d/.test(I18N[L][k])) fail(k + ' ' + L + ' missing or has a number'); }); });
  }

  /* ===== 第 4 關：跳格子 ===== */
  {
    const HP = D.HOP, H = D.HOP_H, cells = [];
    for (let v = 1; v <= HP.max; v++){
      const q = D.hopCellXY(v), r = sq(q.x, q.y, HP.cell);
      cells.push(r); inside(r, 'hop: square ' + v, H);
      const row = Math.floor((v - 1) / HP.cols), col = (v - 1) % HP.cols;
      if (Math.abs(q.x - (150 + (col - (HP.cols - 1) / 2) * HP.step)) > 1e-6 || Math.abs(q.y - (HP.top + HP.cell / 2 + row * HP.step)) > 1e-6) fail('hopCellXY(' + v + ') is not row ' + row + ', column ' + col + ' (squares must read left to right, top to bottom)');
    }
    noHits(cells, 'hop: squares'); tooSmall('hop: a square', HP.cell);
    if (HP.cell < D.GPICK) fail('hop: a square (' + HP.cell + ') is smaller than GPICK ' + D.GPICK);
    need('hop', /var z = addZone\(B, q\.x - HOP\.cell \/ 2, q\.y - HOP\.cell \/ 2, HOP\.cell, HOP\.cell, 'gcell', String\(v\)\);/, 'the squares are not drawn at hopCellXY()');
    need('hop', /for \(var v = 1; v <= HOP\.max; v\+\+\)/, 'the squares are not 1..HOP.max');
    need('hop', /if \(v === n\) land\(z, v\);/, 'the first hop (0 → n) is not shown — the picture would not tell how far one hop is');
    need('hop', /var e = pick\(GAME_HOP\), n = e\.n, cur = n, seq = \[n\];/, 'the round does not start after the first hop');
    need('hop', /if \(gSolved \|\| z\.classList\.contains\('hit'\)\) return;\s*var want = cur \+ n;\s*if \(v !== want\)\{ roundMiss\(v < want \? d\.gHopShort\(n, cur\) : d\.gHopFar\(n, cur\)\); return; \}/, 'a square other than the next hop is accepted, or "too short"/"too far" is the wrong way round');
    need('hop', /if \(seq\.length === e\.k\) roundSolved\(d\.gHopDone\(n, e\.k, cur\)\);/, 'the round is not solved exactly after k hops');
    D.GAME_HOP.forEach(e => {
      const n = e.n, k = e.k, tag = 'hop ' + n + '×' + k;
      if (!(n >= 2 && n <= 9 && k >= 4 && k <= 9)) fail(tag + ': needs 2 ≤ n ≤ 9 and 4 ≤ k ≤ 9 (several hops, 九九 range)');
      if (n * k > HP.max) fail(tag + ': the last hop lands on ' + n * k + ', past ' + HP.max);
      /* 照規則跳：每一步只收 cur + n；k − 1 步之後在 n × k */
      let cur = n; const s = [n];
      for (let j = 2; j <= k; j++){
        for (let v = 1; v <= HP.max; v++){
          if (s.indexOf(v) >= 0 || v === cur + n) continue;
          LANGS.forEach(L => {
            const d = I18N[L], t = v < cur + n ? d.gHopShort(n, cur) : d.gHopFar(n, cur);
            if (v === 1 || v === HP.max || v === cur + n - 1 || v === cur + n + 1) seq(tag + ' tap ' + v + ' from ' + cur + ' ' + L, t, L === 'en' ? [n, n, cur] : [n, cur, n]);
          });
        }
        cur += n; s.push(cur);
        LANGS.forEach(L => { seq(tag + ' gHopNow ' + L, I18N[L].gHopNow(k, s), [k, 0].concat(s)); seq(tag + ' gHop2 ' + L, I18N[L].gHop2(cur, n), [cur, n]); });
      }
      if (cur !== n * k) fail(tag + ': ends on ' + cur);
      LANGS.forEach(L => seq(tag + ' gHopDone ' + L, I18N[L].gHopDone(n, k, n * k), [k, n, n, k, n * k]));
    });
    /* 「還沒跳到」只能給比下一跳小的格子、「跳太遠了」只能給比較大的 */
    LANGS.forEach(L => {
      if (!/還沒|Not there/.test(I18N[L].gHopShort(3, 6)) || !/太遠|Too far/.test(I18N[L].gHopFar(3, 6))) fail('gHopShort / gHopFar ' + L + ' do not say short / far');
    });
  }

  /* ===== 第 5 關：比長短（倍） ===== */
  {
    const T = D.TIMES, H = D.TIMES_H;
    const track = R(4, T.trackY, 292, T.trackH);
    inside(track, 'times: the track', H); tooSmall('times: the track', T.trackH);
    const slot = R(T.slotX, T.sentY - T.slot / 2, T.slot, T.slot), pre = R(4, slot.y, T.slotX - 10, T.slot), post = R(T.slotX + T.slot + 6, slot.y, 296 - (T.slotX + T.slot + 6), T.slot);
    [slot, pre, post].forEach((o, i) => inside(o, 'times: sentence part ' + i, H)); noHits([slot, pre, post], 'times: sentence parts');
    tooSmall('times: the □ with its pad', T.slot + 2 * T.pad);
    const cards = [0, 1, 2].map(i => sq((W - 2 * T.step) / 2 + i * T.step, T.trayY, T.card));
    cards.forEach((r, i) => { inside(r, 'times: card ' + i, H); if (hit(grow(slot, T.pad), r)) fail('times: card ' + i + ' sits inside the □\'s drop pad'); });
    noHits(cards, 'times: cards'); tooSmall('times: a card', T.card); if (T.card < D.GPICK) fail('times: a card is smaller than GPICK');
    need('times', /stickBg\(addZone\(B, x0, T\.longY, p \* T\.u, T\.h, 'glong'\), '#E2B66E', p\);/, 'the long biscuit is not p squares at timesX0(p)');
    need('times', /var src = addPiece\(B, \{ w:Math\.max\(GPICK \+ 8, n \* T\.u \+ 16\), h:52, cx:150, cy:T\.srcY,/, 'cannot read the short biscuit\'s size and place');
    need('times', /cls:'gcard gsrc', label:d\.gTimesStick\(n\), data:\{ stick:true, reuse:true \} \}\);/, 'the short biscuit is not marked reuse');
    need('times', /var track = target\(B, 4, T\.trackY, 292, T\.trackH, 'gtrack', \{\}\);/, 'cannot read the track');
    need('times', /if \(!P\.data\.stick \|\| !nearestOpen\(\[track\], pt, T\.pad\)\) return false;\s*if \(len \+ n > p\)\{ roundMiss\(d\.gTimesOver\(len, n, len \+ n, p\)\); return false; \}/, 'a piece past the end of the long biscuit is accepted');
    need('times', /var z = addZone\(B, x0 \+ len \* T\.u, T\.trackY \+ \(T\.trackH - T\.h\) \/ 2, n \* T\.u, T\.h, 'gstick', String\(sticks \+ 1\)\);/, 'a joined piece is not drawn n squares long at the end of the row');
    need('times', /len \+= n; sticks\+\+;/, 'a joined piece does not add n squares');
    need('times', /if \(gSolved \|\| phase !== 1\) return;\s*if \(len < p\)\{ roundMiss\(d\.gTimesShort\(len, p\)\); return; \}/, '"Same length!" is accepted before the pieces match');
    need('times', /renderTray\(B, \[k, p - n, p\], T\.trayY, function\(v, cx, cy\)\{\s*addPiece\(B, \{ w:T\.card, h:T\.card, cx:cx, cy:cy,/, 'the cards are not k, p − n, p (T.card, shuffled)');
    need('times', /if \(v !== k\)\{ roundMiss\(v === p - n \? d\.gTimesDiff\(p, n, p - n\) : d\.gTimesLongNo\(p\)\); return false; \}/, 'a card other than k is accepted, or the reason is wrong');
    need('times', /roundSolved\(d\.gTimesDone\(p, n, k\)\);/, 'the round is not solved with gTimesDone(p, n, k)');
    need('times', /var e = pick\(GAME_TIMES\), n = e\.n, k = e\.k, p = n \* k, T = TIMES, x0 = timesX0\(p\)/, 'the long biscuit is not n × k');
    D.GAME_TIMES.forEach(e => {
      const n = e.n, k = e.k, p = n * k, x0 = D.timesX0(p), tag = 'times ' + p + '是' + n + '的' + k + '倍';
      if (!(n >= 2 && n <= 5 && k >= 3 && k <= 9)) fail(tag + ': needs 2 ≤ n ≤ 5 and 3 ≤ k ≤ 9 (with k = 2, n = 2 the difference equals the answer)');
      if (p - n === k) fail(tag + ': the difference ' + (p - n) + ' equals the answer — the misconception card would be right');
      if (new Set([k, p - n, p]).size !== 3) fail(tag + ': the cards ' + [k, p - n, p].join(',') + ' are not three different numbers');
      const longR = R(x0, T.longY, p * T.u, T.h); inside(longR, tag + ': the long biscuit', H);
      if (!(x0 >= track.x && x0 + p * T.u <= track.x + track.w)) fail(tag + ': the joined pieces would not fit the track');
      if (Math.abs(x0 + p * T.u / 2 - 150) > 1e-6) fail(tag + ': the long biscuit is not centred');
      const srcW = Math.max(D.GPICK + 8, n * T.u + 16), src = sq(150, T.srcY, srcW, 52);
      inside(src, tag + ': the short biscuit', H); tooSmall(tag + ': the short biscuit', Math.min(srcW, 52));
      if (hit(grow(track, T.pad), src)) fail(tag + ': the short biscuit sits inside the track\'s drop pad');
      /* 照規則接：每一條只在 len + n ≤ p 時收；「一樣長了」只在 len = p 時收 → 剛好 k 條；再接一條才會超過 */
      let len = 0, sticks = 0, guard = 0;
      while (guard++ < 40){
        LANGS.forEach(L => { const t = I18N[L].gTimes2a(len, p, n); seq(tag + ' gTimes2a ' + len + ' ' + L, t, len === p ? [len] : [len, p, n]); });
        if (len === p) break;
        LANGS.forEach(L => seq(tag + ' gTimesShort ' + len + ' ' + L, I18N[L].gTimesShort(len, p), [len, p]));
        if (len + n > p){ fail(tag + ': a piece cannot be joined at ' + len + ' but the pieces do not match yet — stuck'); break; }
        len += n; sticks++;
        LANGS.forEach(L => seq(tag + ' gTimesNow ' + L, I18N[L].gTimesNow(sticks, len), [sticks, len]));
      }
      if (sticks !== k) fail(tag + ': matched after ' + sticks + ' pieces, not ' + k);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(tag + ' gTimesOver ' + L, d.gTimesOver(p, n, p + n, p), [p, n, p + n, p]);
        seq(tag + ' gTimesDiff ' + L, d.gTimesDiff(p, n, p - n), [p, n, p - n]);
        seq(tag + ' gTimesLongNo ' + L, d.gTimesLongNo(p), [p]);
        seq(tag + ' gTimes2b ' + L, d.gTimes2b(k), [k]);
        seq(tag + ' gTimesLongLbl ' + L, d.gTimesLongLbl(p), [p]);
        seq(tag + ' gTimesShortLbl ' + L, d.gTimesShortLbl(n), [n]);
        seq(tag + ' sentence ' + L, d.gTimesPre(p, n) + ' □ ' + d.gTimesPost(n), [p, n]);
        seq(tag + ' gTimesDone ' + L, d.gTimesDone(p, n, k), L === 'en' ? [k, n, n, k, p, p, k, n] : [k, n, n, k, p, p, n, k]);
      });
    });
  }
  if (seqCount !== 1444) fail(seqCount + ' message checks ran, expected 1444 — a loop stopped reaching the messages (or a pool changed: update the pin)');
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/multiply */
  breaks: [
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'p != a*b',
      find:'        var p = a * b;\n        var m = mixOpts(p, [p - a, p + a, a + b]);',
      replace:'        var p = a * b + 1;\n        var m = mixOpts(p, [p - a, p + a, a + b]);' },
    { file:'review', expect:'p != a*b',
      find:'        var p = a * b;\n        var m = mixOpts(p, [a + b, p - a, p + a]);',
      replace:'        var p = a * b + 2;\n        var m = mixOpts(p, [a + b, p - a, p + a]);' },
    /* 這一筆會被「正解的第二套實作」先攔下來（expectedCorrect 從 a、b 重建
       `a × b` 字串），所以噴的是通用的 opts[ans] != correct，不是自訂訊息 ——
       比自訂訊息更強，因為那代表神諭真的獨立算過一次。 */
    { file:'review', expect:'opts[ans] != correct',
      find:"        var correct = { t: a + ' × ' + b, v: a * b };",
      replace:"        var correct = { t: a + ' × ' + (b + 1), v: a * b };" },
    { file:'review', expect:'the stem does not repeat a exactly b times',
      find:'        for (var i = 0; i < d.b; i++) adds.push(d.a);',
      replace:'        for (var i = 0; i < d.b + 1; i++) adds.push(d.a);' },
    { file:'review', expect:'correct is not the missing factor',
      find:'        var m = mixOpts(b, [p - a, b + 1, b - 1]);',
      replace:'        var m = mixOpts(b + 1, [p - a, b + 1, b - 1]);' },
    { file:'review', expect:'correct is not the multiplier k',
      find:'        var m = mixOpts(k, [p - a, k + 1, a]);',
      replace:'        var m = mixOpts(p - a, [k, k + 1, a]);' },
    { file:'review', expect:'p != r*c',
      find:'        var p = r * c;\n        var m = mixOpts(p, [r + c, p - c, p + c]);',
      replace:'        var p = r * c + 1;\n        var m = mixOpts(p, [r + c, p - c, p + c]);' },
    { file:'review', expect:'the commuted expression is not b × a',
      find:"        var correct = { t: b + ' × ' + a, v: a * b };",
      replace:"        var correct = { t: a + ' × ' + b, v: a * b };" },
    { file:'review', expect:'sameTotal: a and b are equal',
      find:'        var b = 2 + rand(8);\n        while (b === a) b = 2 + rand(8);',
      replace:'        var b = a;' },
    { file:'review', expect:'correct is not the per-plate share',
      find:'        var m = mixOpts(a, [p - b, a + 1, b]);',
      replace:'        var m = mixOpts(a + 1, [p - b, a + 1, b]);' },
    { file:'review', expect:'next != a*4',
      find:'        var next = a * 4;',
      replace:'        var next = a * 5;' },
    { file:'index', expect:'ARRAYS never shows a non-square array',
      find:'    { r:3, c:4 },\n    { r:2, c:5 },\n    { r:4, c:6 }',
      replace:'    { r:3, c:3 },\n    { r:2, c:2 },\n    { r:4, c:4 }' },
    { file:'index', expect:'outside the 九九 range',
      find:'  var TABLE_NS = [2, 3, 4, 5, 6, 7, 8, 9];',
      replace:'  var TABLE_NS = [2, 3, 4, 5, 6, 7, 8, 12];' },
    { file:'index', expect:'GROUP_SIZES 15 outside',
      find:'  var GROUP_SIZES = [2, 3, 4, 5];',
      replace:'  var GROUP_SIZES = [2, 3, 4, 15];' },
    { file:'index', expect:'one plate cannot show repeated groups',
      find:'  var MAX_PLATES = 5;',
      replace:'  var MAX_PLATES = 1;' },
    /* ---- index.html：小遊戲「餅乾工廠」（2026-10-01 改成五關五種玩法）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:"without shuffle(...)",
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:"under 44",
      find:"  var GPICK = 48; ",
      replace:"  var GPICK = 40; " },
    { file:'index', expect:"nearestOpen(",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"nearestOpen(",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"      var dd = dx * dx + dy * dy, dc = dd;" },
    { file:'index', expect:"nearestOpen(",
      find:"    return best && !best.done ? best : null;",
      replace:"    return best;" },
    { file:'index', expect:"stars:",
      find:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"  function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    { file:'index', expect:"stars:",
      find:"    var stars = gMistakes === 0 ? 2 : 1;",
      replace:"    var stars = 2;" },
    { file:'index', expect:"stars:",
      find:"    if (gSolved) return;\n    gSolved = true;",
      replace:"    gSolved = true;" },
    { file:'index', expect:"stars: startRound()",
      find:"    gSolved = false; gMistakes = 0; gCtx = {};",
      replace:"    gSolved = false; gCtx = {};" },
    { file:'index', expect:"hints: ahead",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'ahead'){ hintLevel = 0; }" },
    { file:'index', expect:"hints: the second hint",
      find:"    if (hintLevel >= 2) gHintBtn.disabled = true;\n  });",
      replace:"  });" },
    { file:'index', expect:"lostpointercapture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    { file:'index', expect:"first finger",
      find:"      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e)",
      replace:"      if (!start) return;\n      var p = B.toBoard(e)" },
    { file:'index', expect:"placed pieces still take pointer events",
      find:".gpiece.locked{ cursor:default; pointer-events:none }",
      replace:".gpiece.locked{ cursor:default }" },
    { file:'index', expect:"does not clear the stage",
      find:"    gameStage.textContent = '';\n    var ask",
      replace:"    var ask" },
    { file:'index', expect:"÷ k",
      find:"      return { x:(e.clientX - r.left) / k, y:(e.clientY - r.top) / k };",
      replace:"      return { x:(e.clientX - r.left), y:(e.clientY - r.top) };" },
    { file:'index', expect:"GAME_ORDER should be",
      find:"  var GAME_ORDER = ['plate', 'write', 'tray', 'hop', 'times'];",
      replace:"  var GAME_ORDER = ['plate', 'write', 'hop', 'tray', 'times'];" },
    { file:'index', expect:"a cookie is accepted on a plate that already holds a",
      find:"        if (t.n >= e.a){ roundMiss(d.gPlateFull(e.a)); return false; }",
      replace:"        if (t.n > e.a){ roundMiss(d.gPlateFull(e.a)); return false; }" },
    { file:'index', expect:"a plate past the b-th can be started",
      find:"        if (t.n === 0 && used >= e.b){ roundMiss(d.gPlateMany(e.b, e.a)); return false; }",
      replace:"        if (t.n === 0 && used > e.b){ roundMiss(d.gPlateMany(e.b, e.a)); return false; }" },
    { file:'index', expect:"a ≠ b",
      find:"  var GAME_PLATE = [ {a:3, b:2},",
      replace:"  var GAME_PLATE = [ {a:3, b:3}," },
    { file:'index', expect:"a spare plate",
      find:"{a:2, b:3}, {a:5, b:2} ];",
      replace:"{a:2, b:5}, {a:5, b:2} ];" },
    { file:'index', expect:"plates 0 and 1 overlap",
      find:"  var PLATE = { y:66, w:54, h:110, gap:4 };",
      replace:"  var PLATE = { y:66, w:54, h:110, gap:-2 };" },
    { file:'index', expect:"cookie 5 is outside the plate",
      find:"y:18 + Math.floor(k / 2) * 24 }; }",
      replace:"y:18 + Math.floor(k / 2) * 34 }; }" },
    { file:'index', expect:"the jar sits inside plate",
      find:"  var PLATE_JAR = { x:150, y:196, size:56 };",
      replace:"  var PLATE_JAR = { x:150, y:150, size:56 };" },
    { file:'index', expect:"addsOf",
      find:"return s.join(' + ') + ' = ' + (a * b); }",
      replace:"return s.join(' + ') + ' = ' + (a * b + a); }" },
    { file:'index', expect:"gPlateDone zh",
      find:"return b + ' 個 ' + a + ' 是 ' + p + '！寫成 ' + a + ' × ' + b + ' = ' + p + '。'; }",
      replace:"return b + ' 個 ' + a + ' 是 ' + p + '！寫成 ' + b + ' × ' + a + ' = ' + p + '。'; }" },
    { file:'index', expect:"gPlateMany en",
      find:"return b + ' groups of ' + a + ' needs only ' + b + ' plates",
      replace:"return b + ' groups of ' + a + ' needs only ' + a + ' plates" },
    { file:'index', expect:"tap-select: a reusable piece after a tap-drop that is miss",
      find:"      if (P.data.reuse && (ok || gMistakes > m0)) keepSelected(B, P);",
      replace:"      if (P.data.reuse && ok) keepSelected(B, P);" },
    { file:'index', expect:"tap-select: a reusable piece after a tap-drop that is ok",
      find:"      if (P.data.reuse && (ok || gMistakes > m0)) keepSelected(B, P);",
      replace:"      if (P.data.reuse && gMistakes > m0) keepSelected(B, P);" },
    { file:'index', expect:"the jar is not marked reuse",
      find:"cls:'gjar', label:d.gJar, data:{ reuse:true } });",
      replace:"cls:'gjar', label:d.gJar });" },
    { file:'index', expect:"the first box takes something other than a",
      find:"        if (s.k === 0 && v !== e.a){",
      replace:"        if (s.k === 0 && v !== e.a && v !== e.b){" },
    { file:'index', expect:"the total box takes something other than a × b",
      find:"        if (s.k === 2 && v !== p){",
      replace:"        if (s.k === 2 && v !== p && v !== e.a + e.b){" },
    { file:'index', expect:"the cards are not a, b, a × b, a + b",
      find:"      renderTray(B, [e.a, e.b, p, e.a + e.b], WRITE_TRAY.y,",
      replace:"      renderTray(B, [e.a, e.b, p, p + 1], WRITE_TRAY.y," },
    { file:'index', expect:"a ≠ b — otherwise",
      find:"  var GAME_WRITE = [ {a:3, b:2},",
      replace:"  var GAME_WRITE = [ {a:3, b:3}," },
    { file:'index', expect:"box3",
      find:"' 盤要把 ' + a + ' 加 ' + b + ' 次。'; },",
      replace:"' 盤要把 ' + a + ' 加 ' + a + ' 次。'; }," },
    { file:'index', expect:"box1",
      find:"'The size of one group goes first: ' + a + ' on a plate, so ' + a + ' goes first (' + b + ' is",
      replace:"'The size of one group goes first: ' + a + ' on a plate, so ' + b + ' goes first (' + b + ' is" },
    { file:'index', expect:"write: boxes and signs 0 and 1 overlap",
      find:"  var WRITE_EQ = { y:150, slot:56, wide:64, xs:[50, 140, 240], ops:[95, 190] };",
      replace:"  var WRITE_EQ = { y:150, slot:56, wide:64, xs:[50, 100, 240], ops:[95, 190] };" },
    { file:'index', expect:"the picture is not b plates of a",
      find:"        for (var k = 0; k < e.a; k++) addCookie(z, plateCookieXY(k));",
      replace:"        for (var k = 0; k < e.b; k++) addCookie(z, plateCookieXY(k));" },
    { file:'index', expect:"is marked",
      find:"             { t:r + ' + ' + c, yes:false, kind:'sum' }",
      replace:"             { t:r + ' + ' + c, yes:true, kind:'sum' }" },
    { file:'index', expect:"the cards should be",
      find:"{ t:c + ' × ' + (r - 1), yes:false, kind:'miss' } ];",
      replace:"{ t:(r - 1) + ' × ' + (c + 1), yes:false, kind:'miss' } ];" },
    { file:'index', expect:"a card that does not count the tray is accepted in ✅",
      find:"        if (bin.yes && !cd.yes){",
      replace:"        if (false && bin.yes && !cd.yes){" },
    { file:'index', expect:"a card that counts the tray is accepted in ❌",
      find:"        if (!bin.yes && cd.yes){",
      replace:"        if (false && !bin.yes && cd.yes){" },
    { file:'index', expect:"needs 3 ≤ r ≤ 4",
      find:"  var GAME_TRAY = [ {r:3, c:4},",
      replace:"  var GAME_TRAY = [ {r:2, c:4}," },
    { file:'index', expect:"r ≠ c",
      find:"{r:3, c:6}, {r:4, c:6} ];",
      replace:"{r:3, c:6}, {r:4, c:4} ];" },
    { file:'index', expect:"cookies 0 and 1 overlap",
      find:"  var TRAY = { dot:18, step:24, cx:150, cy:64 };",
      replace:"  var TRAY = { dot:18, step:16, cx:150, cy:64 };" },
    { file:'index', expect:"tray and bins",
      find:"  var TRAY_OK = { x:4, y:134, w:180, h:112 }, TRAY_NO = { x:192, y:134, w:104, h:112 };",
      replace:"  var TRAY_OK = { x:4, y:134, w:180, h:112 }, TRAY_NO = { x:170, y:134, w:104, h:112 };" },
    { file:'index', expect:"sits inside a bin",
      find:"  var TRAY_CARD = { w:84, h:48, xs:[100, 200], ys:[288, 344] };",
      replace:"  var TRAY_CARD = { w:84, h:48, xs:[100, 200], ys:[276, 332] };" },
    { file:'index', expect:"gTrayCol zh",
      find:"return '直著看是 ' + c + ' 個 ' + r + '：' + r + ' × ' + c + ' = ' + N",
      replace:"return '直著看是 ' + r + ' 個 ' + c + '：' + r + ' × ' + c + ' = ' + N" },
    { file:'index', expect:"gTrayDone en",
      find:"return 'Across ' + c + ' × ' + r + ' = ' + N + ', down ' + r + ' × ' + c + ' = ' + N",
      replace:"return 'Across ' + c + ' × ' + r + ' = ' + N + ', down ' + r + ' × ' + c + ' = ' + (N + 1)" },
    { file:'index', expect:"a square other than the next hop is accepted",
      find:"          if (v !== want){",
      replace:"          if (v < want){" },
    { file:'index', expect:"the wrong way round",
      find:"roundMiss(v < want ? d.gHopShort(n, cur) : d.gHopFar(n, cur)); return; }",
      replace:"roundMiss(v > want ? d.gHopShort(n, cur) : d.gHopFar(n, cur)); return; }" },
    { file:'index', expect:"the first hop (0 → n) is not shown",
      find:"        if (v === n) land(z, v);\n",
      replace:"" },
    { file:'index', expect:"past 36",
      find:"{n:5, k:6}, {n:6, k:5}, {n:2, k:7} ];",
      replace:"{n:5, k:6}, {n:6, k:7}, {n:2, k:7} ];" },
    { file:'index', expect:"several hops",
      find:"  var GAME_HOP = [ {n:3, k:5},",
      replace:"  var GAME_HOP = [ {n:3, k:3}," },
    { file:'index', expect:"under 44",
      find:"  var HOP = { cols:6, cell:48, step:49, top:6, max:36 };",
      replace:"  var HOP = { cols:6, cell:44, step:49, top:6, max:36 };" },
    { file:'index', expect:"hop: a square (46) is smaller than GPICK",
      find:"  var HOP = { cols:6, cell:48, step:49, top:6, max:36 };",
      replace:"  var HOP = { cols:6, cell:46, step:49, top:6, max:36 };" },
    { file:'index', expect:"hopCellXY(",
      find:"  function hopCellXY(v){ return { x:150 + (((v - 1) % HOP.cols)",
      replace:"  function hopCellXY(v){ return { x:150 - (((v - 1) % HOP.cols)" },
    { file:'index', expect:"not solved exactly after k hops",
      find:"          if (seq.length === e.k) roundSolved(",
      replace:"          if (seq.length === e.k - 1) roundSolved(" },
    { file:'index', expect:"gHopDone en",
      find:"return k + ' hops of ' + n + ': ' + n + ' × ' + k + ' = ' + p + '.'; }",
      replace:"return k + ' hops of ' + n + ': ' + n + ' + ' + k + ' = ' + p + '.'; }" },
    { file:'index', expect:"a piece past the end of the long biscuit is accepted",
      find:"          if (len + n > p){ roundMiss(",
      replace:"          if (len > p){ roundMiss(" },
    { file:'index', expect:"\"Same length!\" is accepted before the pieces match",
      find:"        if (len < p){ roundMiss(d.gTimesShort(len, p)); return; }",
      replace:"        if (len < n){ roundMiss(d.gTimesShort(len, p)); return; }" },
    { file:'index', expect:"the cards are not k, p − n, p",
      find:"        renderTray(B, [k, p - n, p], T.trayY,",
      replace:"        renderTray(B, [k, k + 1, p], T.trayY," },
    { file:'index', expect:"a card other than k is accepted",
      find:"        if (v !== k){ roundMiss(",
      replace:"        if (v !== k && v !== p - n){ roundMiss(" },
    { file:'index', expect:"with k = 2, n = 2",
      find:"  var GAME_TIMES = [ {n:3, k:4},",
      replace:"  var GAME_TIMES = [ {n:2, k:2}," },
    { file:'index', expect:"would not fit the track",
      find:"  var TIMES = { u:14,",
      replace:"  var TIMES = { u:16," },
    { file:'index', expect:"a joined piece does not add n squares",
      find:"          len += n; sticks++;",
      replace:"          len += n + 1; sticks++;" },
    { file:'index', expect:"gTimesDone zh",
      find:"'，所以 ' + p + ' 是 ' + n + ' 的 ' + k + ' 倍。'; }",
      replace:"'，所以 ' + p + ' 是 ' + k + ' 的 ' + n + ' 倍。'; }" },
    { file:'index', expect:"gTimesDiff en",
      find:"return p + ' − ' + n + ' = ' + dd + ' is how much longer it is",
      replace:"return p + ' − ' + n + ' = ' + (dd + 1) + ' is how much longer it is" },
    { file:'index', expect:"sentence",
      find:"gTimesPost:function(n){ return 'times ' + n; },",
      replace:"gTimesPost:function(n){ return 'times'; }," },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'3 + 3 = 6，所以 3 × 2 = 6。'",
      replace:"why:'3 + 3 = 7，所以 3 × 2 = 6。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'7 + 7 = 14，所以 7 × 2 = 14。'",
      replace:"why:'七加七是十四，所以七乘二是十四。'" },
    { file:'index', expect:"set of verified equations changed",
      find:"why:'3 + 3 = 6，所以 3 × 2 = 6。'",
      replace:"why:'3 + 3 = 6，所以 2 + 4 = 6。'" }
  ],

  sim: {
    INVARIANTS: {
      productDirect: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b < 2 || d.b > MAXF) return 'factors outside the 九九 range 2~9';
      },
      groupsOf: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        /* why 說「a 加 b 次」——這句話要成立，b 必須是「幾次」而不是別的東西。 */
        if (d.b < 2 || d.b > MAXF) return 'b must be a real repeat count in 2~9';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range';
      },
      repeatedAdd: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range 2~9';
        if (d.b < 2) return 'the stem writes a repeated addition — it needs at least two terms';
        if (d.b > 5) return 'too many terms for a grade-2 stem';
        /* a + b === a × b（只有 2、2）時產生器自己就不會用連加式誘答，
           所以這裡**不能**判失敗 —— 那是它處理好的情況，不是缺陷。
           真正要驗的是「選項裡沒有和正解等值的東西」，那條在 simgen 本體。 */
      },
      missingFactor: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b < 2 || d.b > MAXF) return 'factors outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.b) return 'correct is not the missing factor';
      },
      wordGroups: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.kind < 0 || d.kind > 2) return 'kind out of range';
        if (d.a < 2 || d.b < 2) return 'a one-item group makes the word problem trivial';
        if (d.a > MAXF || d.b > MAXF) return 'factors outside the 九九 range 2~9';
      },
      timesWord: d => {
        if (d.p !== d.a * d.k) return 'p != a*k';
        if (d.k < 2) return 'why says "k groups of a" — k must be at least 2';
        if (d.a < 2 || d.a > MAXF || d.k > MAXF) return 'a or k outside the 九九 range 2~9';
        if (d.a * (d.k + 1) > MAXP) return 'a distractor would leave the 九九 range';
      },
      howManyTimes: d => {
        if (d.p !== d.a * d.k) return 'p != a*k';
        if (d.a < 2 || d.a > MAXF || d.k < 2 || d.k > MAXF) return 'a or k outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.k) return 'correct is not the multiplier k';
        /* 這一題整個重點是「倍 ≠ 差」，所以那個誘答必須真的和正解不同，
           不然孩子選 p − a 也會被判對，迷思就考不到了。 */
        if (d.p - d.a === d.k) return 'the difference equals the multiple, so the misconception cannot be tested';
      },
      arrayCount: d => {
        if (d.p !== d.r * d.c) return 'p != r*c';
        if (d.r < 2 || d.c < 2) return 'a single row/column is not an array';
        if (d.r > MAXF || d.c > MAXF) return 'array outside the 九九 range';
      },
      sameTotal: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a === d.b) return 'sameTotal: a and b are equal, so the commuted expression is the stem itself';
        const key = String(d.opts[d.ans]).replace(/\s/g, '');
        if (key !== (d.b + '×' + d.a)) return 'the commuted expression is not b × a';
      },
      shareOut: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b > MAXF) return 'a or b outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.a) return 'correct is not the per-plate share';
        if (d.b < 2) return 'sharing onto one plate is not sharing';
      },
      skipCount: d => {
        if (d.next !== d.a * 4) return 'next != a*4';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range';
      }
    },

    /* 正解的第二套實作，只用原始參數重算。
       兩個「選項是算式」的產生器要重建字串，不是重算數字。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'productDirect': return String(d.a * d.b);
        case 'groupsOf':      return String(d.a * d.b);
        case 'repeatedAdd':   return d.a + ' × ' + d.b;
        case 'missingFactor': return String(d.b);
        case 'wordGroups':    return String(d.a * d.b);
        case 'timesWord':     return String(d.a * d.k);
        case 'howManyTimes':  return String(d.k);
        case 'arrayCount':    return String(d.r * d.c);
        case 'sameTotal':     return d.b + ' × ' + d.a;
        case 'shareOut':      return String(d.a);
        case 'skipCount':     return String(d.a * 4);
        default: return null;
      }
    },

    /* 選項形狀：多數是純數字（0~81）；兩個產生器的選項是算式字串。
       正解與誘答分開驗 —— 算式誘答可以是 `a + b`，但正解永遠是乘法算式。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (EXPR_GENS[genId]){
        const m = String(s).match(/^\s*(\d+)\s*([×+])\s*(\d+)\s*$/);
        if (!m) return 'option ' + s + ' is not an a × b / a + b expression';
        if (isCorrect && m[2] !== '×') return 'the correct option must be a multiplication, got ' + s;
        const x = Number(m[1]), y = Number(m[3]);
        if (x < 2 || x > MAXF || y < 2 || y > MAXF)
          return 'option ' + s + ' uses a factor outside the 九九 range 2~9';
        if (m[2] === '×' && x * y > MAXP) return 'option ' + s + ' multiplies past ' + MAXP;
        return null;
      }
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      /* 正解一定是九九表裡的積（≤ 81）。誘答可以剛好越過一點點：「多加一組」
         在 9 × 9 時是 90，那是設計好的迷思，不是超綱 —— 但也不能無上限，
         最寬的誘答就是 p + a ≤ 81 + 9。正解與誘答分開驗。 */
      const hi = isCorrect ? MAXP : MAXP + MAXF;
      if (!(v >= 0 && v <= hi))
        return 'option ' + s + ' outside 0~' + hi + (isCorrect ? ' (key)' : ' (distractor)');
      return null;
    },

    /* 題幹是拼出來的，資料對不代表印出來的字是對的。連加題的題幹會印出
       b 個加項 —— 那個數量必須真的等於 b，不然孩子看到的是另一道題。 */
    renderCheck: function(d, q, lang, genId){
      if (genId === 'repeatedAdd'){
        const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
        const terms = (stem.match(new RegExp('(?<![0-9])' + d.a + '(?![0-9])', 'g')) || []).length;
        if (terms !== d.b)
          return 'the stem does not repeat a exactly b times (printed ' + terms + ', b = ' + d.b + ')';
      }
      if (genId === 'skipCount'){
        /* 抽出題幹裡真正的數字 token 再比對整個數列 —— 用 indexOf 的話，
           題幹印成 19 也會「含有」9，第三跳寫錯反而看不出來。 */
        const nums = (String(q.stem).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        const want = [d.a, d.a * 2, d.a * 3];
        if (nums.length < want.length || want.some((v, i) => nums[i] !== v))
          return 'the skip-count stem is not a, 2a, 3a (printed ' + nums.join(',') + ')';
      }
      return null;
    },

    /* 刻意的迷思誘答：把題幹的數字端回來，而且那正是要考的錯。 */
    stemEchoOk: {
      /* 「p 是 a 的幾倍？」→ 誘答 a（把被比較的數本身當答案）與 p−a（差當成倍）。 */
      howManyTimes: function(d, opt){
        const v = Number(opt);
        return v === d.a || v === d.p - d.a;
      },
      /* 「p 顆平分到 b 盤」→ 誘答 b（把盤數當成每盤幾顆）。 */
      shareOut: function(d, opt){ return Number(opt) === d.b; },
      /* 「a × ? = p」→ 誘答 p−a（把乘法當成減法），以及 b±1（差一個）。
         b±1 在 b = a±1 時剛好等於題幹的 a，那是算術上的必然，不是題目被端回去。 */
      missingFactor: function(d, opt){
        const v = Number(opt);
        return v === d.p - d.a || v === d.b + 1 || v === d.b - 1;
      },
      /* 跳著數的題幹印了 a、2a、3a，誘答 3a 就是「沒有再跳一次」。 */
      skipCount: function(d, opt){ return Number(opt) === d.a * 3; },
      /* 「加起來」而不是「乘起來」是這一課最主要的迷思，所以 a+b 一定要在選項裡；
         而 b = 2（或 r = 2）時 p − a 剛好等於 a，看起來像把題幹抄回來 ——
         那是算術上的必然，不是把題目端回去。兩種都只放行「那一個算出來的值」。 */
      productDirect: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.a;
      },
      groupsOf: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.a;
      },
      wordGroups: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.b;
      },
      timesWord: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.k || v === d.p - d.a || v === d.a * (d.k + 1);
      },
      arrayCount: function(d, opt){
        const v = Number(opt);
        return v === d.r + d.c || v === d.p - d.c || v === d.p + d.c;
      },
      /* 連加式與交換律那兩題的選項本來就是用題幹的 a、b 組出來的算式。 */
      repeatedAdd: function(d, opt){ return /[×+]/.test(String(opt)); },
      sameTotal: function(d, opt){ return /[×+]/.test(String(opt)); }
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{GROUP_SIZES, MAX_PLATES, COOKIE, ARRAYS, TABLE_NS, GPICK, GAME_ORDER, addsOf, GAME_PLATE, PLATE_N, PLATE_H, PLATE_PAD, PLATE, PLATE_JAR, plateX, plateCookieXY, COOKIE_SIZE, GAME_WRITE, WRITE_H, WRITE_PAD, WRITE_PLATE, WRITE_EQ, WRITE_TRAY, writePlateX, GAME_TRAY, TRAY_H, TRAY_PAD, TRAY, TRAY_PAN, TRAY_OK, TRAY_NO, TRAY_CARD, trayDotXY, trayCards, GAME_HOP, HOP_H, HOP, hopCellXY, GAME_TIMES, TIMES_H, TIMES, timesX0}',
    optionValueMax: MAXP,

    check: function(data, I18N, fail, src){
      const LANGS = ['zh', 'en'];

      /* --- 範例 1：一盤一盤數 --- */
      if (data.MAX_PLATES < 2) fail(`MAX_PLATES ${data.MAX_PLATES} — one plate cannot show repeated groups`);
      data.GROUP_SIZES.forEach(a => {
        if (a < 2 || a > MAXF) fail(`GROUP_SIZES ${a} outside the 九九 range 2~${MAXF}`);
        if (a * data.MAX_PLATES > MAXP)
          fail(`GROUP_SIZES ${a} × MAX_PLATES ${data.MAX_PLATES} = ${a * data.MAX_PLATES} leaves the 九九 range`);
        LANGS.forEach(L => {
          for (let b = 1; b <= data.MAX_PLATES; b++){
            const say = I18N[L].grpSay(a, b, a * b);
            if (/undefined|NaN/.test(say)) fail(`grpSay ${L} ${a}×${b}: ${say}`);
            if (String(say).indexOf(String(a * b)) < 0)
              fail(`grpSay ${L} ${a}×${b} does not state the total ${a * b}`);
          }
          const plate = I18N[L].grpPlateNum(1);
          if (/undefined|NaN/.test(plate)) fail(`grpPlateNum ${L}: ${plate}`);
        });
      });
      if (!data.COOKIE) fail('COOKIE glyph is empty — the plates would render blank');

      /* --- 範例 2：排排隊看兩次（交換律） --- */
      data.ARRAYS.forEach(A => {
        if (A.r < 2 || A.c < 2) fail(`ARRAYS ${A.r}×${A.c}: a single row or column is not an array`);
        if (A.r > MAXF || A.c > MAXF) fail(`ARRAYS ${A.r}×${A.c} outside the 九九 range`);
        LANGS.forEach(L => {
          const total = A.r * A.c;
          const row = I18N[L].arrRow(A.r, A.c, total), col = I18N[L].arrCol(A.r, A.c, total);
          [row, col].forEach(t => {
            if (/undefined|NaN/.test(t)) fail(`array text ${L} ${A.r}×${A.c}: ${t}`);
            if (String(t).indexOf(String(total)) < 0)
              fail(`array text ${L} ${A.r}×${A.c} does not state the total ${total}`);
          });
          const aria = I18N[L].arrAria(A.r, A.c);
          if (/undefined|NaN/.test(aria)) fail(`arrAria ${L} ${A.r}×${A.c}: ${aria}`);
        });
      });
      /* 交換律要看得出來「橫著看和直著看一樣多」，正方形陣列示範不了那件事。 */
      if (!data.ARRAYS.some(A => A.r !== A.c))
        fail('ARRAYS never shows a non-square array, so 交換律 cannot be seen');

      /* --- 範例 3：乘法表跳跳看 --- */
      data.TABLE_NS.forEach(n => {
        if (n < 2 || n > MAXF) fail(`TABLE_NS ${n} outside the 九九 range 2~${MAXF}`);
        LANGS.forEach(L => {
          for (let k = 1; k <= MAXF; k++){
            const t = I18N[L].tabSay(n, k, n * k);
            if (/undefined|NaN/.test(t)) fail(`tabSay ${L} ${n}×${k}: ${t}`);
            if (String(t).indexOf(String(n * k)) < 0)
              fail(`tabSay ${L} ${n}×${k} does not state ${n * k}`);
          }
          const done = I18N[L].tabDone(n);
          if (/undefined|NaN/.test(done)) fail(`tabDone ${L} ${n}: ${done}`);
        });
      });

      /* --- 遊戲：餅乾工廠（五關五種玩法）—— 見 checkGame() --- */
      checkGame(data, I18N, fail, src);

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
                    const r = arithMultiply(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 20) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 20`);
            if (qSum !== 12) fail(`question-shaped equations changed: found ${qSum}, expected 12`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithMultiply.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithMultiply.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithMultiply.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== '1a160a0440fe'){
                fail(`the set of verified equations changed (digest ${digest}, expected 1a160a0440fe)\n      now: ${list.join(' | ')}`);
              }
            }
          }

    }
  }
};
