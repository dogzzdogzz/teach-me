/* grade-2/math/divide（分裝與平分）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的關鍵在「同一個數字、不同的單位是不同的答案」：
   「4 包」和「4 顆」數字一樣，卻是兩個完全不同的答案（一個是份數，一個是每份的個數），
   而這正是這個單元最容易搞混的地方。所以：
   - 去重的鍵一定要含單位種類（grp／item），不能只比數字；
   - 正解字串要由這個設定檔自己的情境表（SCENE_TRUTH）重算一次，
     不能呼叫 review.html 的格式化函式 —— 那等於自己比自己。
   2026-10-02：小遊戲改成 §六之五 的五關五種玩法（舊的五題選擇題 ROUNDS 拿掉了），
   檢查在 gameCheck()（照規則重玩每一題、版面與觸控、nearestOpen／星星真的跑），breaks 在清單最後一段。 */

/* ---------- 設定檔自己的情境表（和 review.html 的 SCENES 對齊，但是獨立的一份） ---------- */
const SCENE_TRUTH = [
  { zh:{ thing:'糖果', item:'顆', grp:'包' }, en:{ item:'sweet',   itemN:'sweets',   grp:'bag',    grpN:'bags'    } },
  { zh:{ thing:'蘋果', item:'個', grp:'籃' }, en:{ item:'apple',   itemN:'apples',   grp:'basket', grpN:'baskets' } },
  { zh:{ thing:'餅乾', item:'片', grp:'盤' }, en:{ item:'biscuit', itemN:'biscuits', grp:'plate',  grpN:'plates'  } },
  { zh:{ thing:'鉛筆', item:'枝', grp:'盒' }, en:{ item:'pencil',  itemN:'pencils',  grp:'box',    grpN:'boxes'   } }
];
function fItem(si, n, lang){
  const s = SCENE_TRUTH[si];
  return lang === 'zh' ? (n + ' ' + s.zh.item) : (n + ' ' + (n === 1 ? s.en.item : s.en.itemN));
}
function fGrp(si, n, lang){
  const s = SCENE_TRUTH[si];
  return lang === 'zh' ? (n + ' ' + s.zh.grp) : (n + ' ' + (n === 1 ? s.en.grp : s.en.grpN));
}

/* 這一課的選項一律是物件。去重鍵含單位種類 —— 只比數字的話，
   「4 包」和「4 顆」會被當成重複而被擋掉，可是它們是刻意的單位誘答。
   反過來說，只比字串就會放過「4 包」和「4 包」。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'item' || v.u === 'grp') return v.u + '#' + v.n;
  if (v.u === 'eq') return 'eq#' + v.op;
  if (v.u === 'phr') return 'phr#' + v.p + '#' + v.n;
  if (v.u === 'triple') return 'triple#' + v.a + ',' + v.b + ',' + v.c;
  return 'bad';
}
function distinctOpts(d){
  const keys = d.opts.map(keyOf);
  for (let i = 0; i < keys.length; i++){
    if (keys[i] === 'bad') return 'option ' + i + ' is not a value object this lesson knows';
    for (let j = i + 1; j < keys.length; j++){
      if (keys[i] === keys[j]) return 'two options are the same answer: ' + keys[i];
    }
  }
  return null;
}
function answerIs(d, want){
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 每一個帶單位的選項都要用「這一題自己的情境」。少了這一條，一題糖果題裡
   冒出「5 籃」也會通過：形狀對、去重也過，孩子卻看到不相干的單位。 */
function optScenesOk(d){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || (o.u !== 'item' && o.u !== 'grp' && o.u !== 'phr')) continue;
    if (!Number.isInteger(o.si) || o.si !== d.si){
      return 'option ' + i + ' uses scene ' + o.si + ', but the question is scene ' + d.si;
    }
  }
  return null;
}
/* 算式題的誘答不可以「照著算也得到正解」。乘法可以交換，而加法在
   k ＝ 2、答案 ＝ 2（總數 4）時剛好也成立（2 ＋ □ ＝ 4）——
   所以每一個誘答都要把 □ 解出來，跟正解比一次。 */
function eqDistractorsWrong(d, ansWant){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || o.u !== 'eq') return 'option ' + i + ' is not a number sentence';
    if (o === d.correct) continue;
    let box = null;
    if (o.op === 'addBox') box = o.total - o.k;
    else if (o.op === 'subBox') box = o.k - o.total;
    else if (o.op === 'mulFlip') box = o.total * o.k;
    else if (o.op === 'mulBox' || o.op === 'boxMul') box = o.total / o.k;
    else return 'option ' + i + ' has an unknown sentence shape ' + o.op;
    if (box === ansWant){
      return 'distractor ' + o.op + ' also solves to the correct answer ' + ansWant;
    }
  }
  return null;
}
function base(d, want){ return distinctOpts(d) || optScenesOk(d) || answerIs(d, want); }
/* 情境編號一定要落在設定檔認得的範圍裡，否則 SCENE_TRUTH[si] 會是 undefined，
   接下來每一個字串比對都會變成 undefined 對 undefined —— 整題沒被驗到卻是綠的。 */
function sceneOk(d){
  if (!Number.isInteger(d.si) || d.si < 0 || d.si >= SCENE_TRUTH.length){
    return 'scene index ' + d.si + ' is outside the checker catalogue (0~' + (SCENE_TRUTH.length - 1) + ')';
  }
  return null;
}
/* 「總數 ＝ 每份幾個 × 幾份」是這一課唯一的算式，每個產生器都要成立。 */
function productOk(total, a, b){
  if (total !== a * b) return 'total is not per × groups (' + total + ' vs ' + a + ' × ' + b + ')';
  return null;
}
/* 每份至少 2 個、至少 2 份 —— 一份 1 個或只有 1 份的「分東西」沒有意義，
   而且會讓英文的單複數判斷失去保護對象。 */
function sizesOk(per, groups){
  if (!(per >= 2 && per <= 9)) return 'each group must hold 2~9 items, got ' + per;
  if (!(groups >= 2 && groups <= 9)) return 'there must be 2~9 groups, got ' + groups;
  return null;
}

/* 每個產生器的選項可以長什麼樣（單位種類），以及數字的範圍。
   每一條都要寫得出「這個上限是怎麼算出來的」—— 隨手給一個大數等於沒有範圍檢查。 */
const SHAPE = {
  packing:    ['grp'],
  sharing:    ['item'],
  packEq:     ['eq'],
  shareEq:    ['eq'],
  unitPick:   ['grp','item'],   /* 刻意的單位誘答：同一個數字、錯的單位 */
  totalCheck: ['item'],
  arrayRow:   ['item'],
  meaningOf:  ['phr'],
  equalCheck: ['triple']
};
const RANGE = {
  /* 每份 ≤ 9、份數 ≤ 6 → 總數 ≤ 54；最大的誘答是「把總數當份數」＝ 54。 */
  packing:    [1, 54],
  sharing:    [1, 54],
  /* 算式裡出現的數字：每份 2~9，總數 ＝ 每份 × 份數 ≤ 9 × 9 ＝ 81。 */
  packEq:     [2, 81],
  shareEq:    [2, 81],
  unitPick:   [1, 54],
  /* 誘答最大的是「每份的數字乘自己」9 × 9 ＝ 81（總數 ＋ 每份最多 54 ＋ 9 ＝ 63）。 */
  totalCheck: [1, 81],
  arrayRow:   [1, 54],
  /* 選項裡的數字就是份數，2~6（份數 < 2 由 sizesOk 先擋掉，這裡是第二道）。 */
  meaningOf:  [2, 6],
  /* 每人 3~9，最大的誘答是 q ＋ 2 ＝ 11。 */
  equalCheck: [1, 11]
};

/* 選項字串的形狀。單位詞的清單就是 SCENE_TRUTH 裡的那些，不多不少。 */
const ZH_ITEM = '顆|個|片|枝';
const ZH_GRP = '包|籃|盤|盒';
const EN_ITEM = 'sweet|sweets|apple|apples|biscuit|biscuits|pencil|pencils';
const EN_GRP = 'bag|bags|basket|baskets|plate|plates|box|boxes';
const EN_SING = ['bag','basket','plate','box','sweet','apple','biscuit','pencil'];
const EN_PLUR = ['bags','baskets','plates','boxes','sweets','apples','biscuits','pencils'];
const SHAPES = {
  zh: {
    item:   new RegExp('^\\d+ (?:' + ZH_ITEM + ')$'),
    grp:    new RegExp('^\\d+ (?:' + ZH_GRP + ')$'),
    eq:     /^(?:\d+ × □|□ × \d+|\d+ ＋ □|\d+ － □) ＝ \d+$|^\d+ × \d+ ＝ □$/,
    phr:    new RegExp('^(?:有 \\d+ (?:' + ZH_GRP + ')|每(?:' + ZH_GRP + ')有 \\d+ (?:' + ZH_ITEM +
                       ')|一共有 \\d+ (?:' + ZH_ITEM + ')|剩下 \\d+ (?:' + ZH_ITEM + '))$'),
    triple: /^\d+、\d+、\d+$/
  },
  en: {
    item:   new RegExp('^\\d+ (?:' + EN_ITEM + ')$'),
    grp:    new RegExp('^\\d+ (?:' + EN_GRP + ')$'),
    eq:     /^(?:\d+ × □|□ × \d+|\d+ \+ □|\d+ − □) = \d+$|^\d+ × \d+ = □$/,
    phr:    new RegExp('^(?:\\d+ (?:' + EN_GRP + ') in total|\\d+ (?:' + EN_ITEM + ') in each (?:bag|basket|plate|box)' +
                       '|\\d+ (?:' + EN_ITEM + ') in total|\\d+ (?:' + EN_ITEM + ') left over)$'),
    triple: /^\d+, \d+, \d+$/
  }
};

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithDivide = require('./lib/arith.js').makeArith({
  units: ["顆", "包", "盒", "個", "人", "份", "排", "袋", "塊", "張"],
  unitsEn: ["sweets?", "bags?", "boxes", "box", "pieces?", "people", "person", "plates?", "rows?", "packs?", "items?"]
});

const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 小遊戲「分一分大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   一包一包裝（點起來裝成一包）、一個一個輪流發（拖到盤子）、兩種問法（答案卡配格子）、
   寫算式（三張卡排算式＋數字卡填 □）、一跳一份（點 +k 在數線上跳）。做法照 grade-3-divide.js／grade-2-numbers.js：
   - 每一關**照遊戲的規則把每一題玩一遍**（這裡自己寫的規則），證明一定解得完、解完一定是對的答案，
     而且規則真的擋得住「做出來但教錯」的那一種解法（不平均的包、不輪流的發法、單位錯、總數放錯邊、跳錯步長）；
   - 頁面的純函式（groupBagXY／groupPileXY／dealPlateX／dealDotXY／bothRowX／bothCardXY／eqKeyXY／hopX…）
     拿整個題庫去呼叫，再和自己的公式比，量每一個東西在不在畫板裡、會不會互相碰到；
   - nearestOpen()、roundSolved()、roundMiss() 從原始碼切出來**真的跑**；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯）；
   - 版面與觸控 ≥ 44px 從 index.html 的常數讀（不在這裡另抄一份數字）。
   已知極限：RENDER 函式本體裡的規則是字面掃描（need()：證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g2-divide 的端對端測試驗。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board (' + JSON.stringify(o) + ')'); };
  const within = (o, R, what) => { if (!(o.x >= R.x - 1e-9 && o.y >= R.y - 1e-9 && o.x + o.w <= R.x + R.w + 1e-9 && o.y + o.h <= R.y + R.h + 1e-9)) fail(what + ' sticks out of its frame'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const W = D.GAME_W;
  const unit = (L, si, kind, n) => {        /* 這個設定檔自己的單位詞（SCENE_TRUTH），不用頁面的格式化函式 */
    const s = SCENE_TRUTH[si];
    if (L === 'zh') return n + ' ' + (kind === 'grp' ? s.zh.grp : s.zh.item);
    return n + ' ' + (kind === 'grp' ? (n === 1 ? s.en.grp : s.en.grpN) : (n === 1 ? s.en.item : s.en.itemN));
  };

  /* --- 順序、每一關的說明與提示 --- */
  const TYPES = ['group', 'deal', 'both', 'eq', 'hop'];
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
  /* 第 1、5 關沒有拖拉：點一下本身就是操作，說明要寫出來（§六之五第 4 點的例外） */
  ['group', 'hop'].forEach(t => {
    if (!/這一關用點的/.test(I18N.zh.gAsks[t]) || !/all taps/.test(I18N.en.gAsks[t])) fail(t + ': the round has no drag — its instructions must say it is all taps');
  });
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/function startRound\(\)\{[\s\S]*?gameStage\.textContent = '';/.test(src)) fail('startRound() does not clear the stage before rendering');
  if (!/function renderAll\(\)\{[\s\S]*?restartGame\(\);/.test(src)) fail('a language switch does not rebuild the game');

  /* --- 觸控：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍 --- */
  const scale = Math.min(1.5, 290 / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK (a thing to tap in round 1)', D.GPICK);
  small('the dealing token', D.DEAL_TOKEN.size);
  small('an answer card (' + D.BOTH_CARD.w + '×' + D.BOTH_CARD.h + ')', Math.min(D.BOTH_CARD.w, D.BOTH_CARD.h));
  small('a sentence card (' + D.EQ_CARD.w + '×' + D.EQ_CARD.h + ')', Math.min(D.EQ_CARD.w, D.EQ_CARD.h));
  small('a number card', D.EQ_KEYS.size);
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 48) fail('the pack / jump buttons (.btn) are not at least 48px tall'); }
  /* 板上的尺寸本身也要 ≥ 48（§六之五 GPICK）：只看「縮放後 ≥ 44」的話，46 也會過（codex 第一輪） */
  if (!(D.GPICK >= 48)) fail('GPICK is ' + D.GPICK + ' — pieces must be at least 48 board px');
  [['the dealing token', D.DEAL_TOKEN.size], ['an answer card width', D.BOTH_CARD.w], ['an answer card height', D.BOTH_CARD.h],
   ['a sentence card width', D.EQ_CARD.w], ['a sentence card height', D.EQ_CARD.h], ['a number card', D.EQ_KEYS.size]].forEach(([w, v]) => {
    if (!(v >= D.GPICK)) fail(w + ' is ' + v + ' board px — smaller than GPICK ' + D.GPICK);
  });
  need('group', /c\.style\.width = GPICK \+ 'px'; c\.style\.height = GPICK \+ 'px';/, 'the things to tap are not GPICK × GPICK');
  need('group', /c\.style\.left = \(p\.x - GPICK \/ 2\) \+ 'px'; c\.style\.top = \(p\.y - GPICK \/ 2\) \+ 'px';[\s\S]*?\}\)\(groupPileXY\(i, e\.n\)\);/, 'the things to tap are not drawn at groupPileXY()');
  need('deal', /addPiece\(B, \{ w:DEAL_TOKEN\.size, h:DEAL_TOKEN\.size, cx:GAME_W \/ 2, cy:DEAL_TOKEN\.y,/, 'the token is not DEAL_TOKEN.size at (GAME_W / 2, DEAL_TOKEN.y)');
  need('both', /var p = bothCardXY\(i\);\s*addPiece\(B, \{ w:BOTH_CARD\.w, h:BOTH_CARD\.h, cx:p\.x, cy:p\.y,/, 'the answer cards are not BOTH_CARD.w × BOTH_CARD.h at bothCardXY()');
  need('eq', /addPiece\(B, \{ w:EQ_CARD\.w, h:EQ_CARD\.h, cx:cx, cy:cy,/, 'the sentence cards are not EQ_CARD.w × EQ_CARD.h');
  need('eq', /var p = eqKeyXY\(v\);\s*addPiece\(B, \{ w:EQ_KEYS\.size, h:EQ_KEYS\.size, cx:p\.x, cy:p\.y,/, 'the number cards are not EQ_KEYS.size at eqKeyXY()');
  /* 英文的答案卡「4 baskets」要放得下（粗體 22px 的拉丁字母估 0.52em 一個字；卡片左右各 3px 邊框） */
  D.GAME_BOTH.forEach(e => {
    const q = e.total / e.k;
    [unit('en', e.si, 'grp', q), unit('en', e.si, 'item', q), unit('en', e.si, 'grp', e.k), unit('en', e.si, 'item', e.k)].forEach(t => {
      if (t.length * 22 * 0.52 > D.BOTH_CARD.w - 6) fail('both: the card "' + t + '" (~' + Math.round(t.length * 22 * 0.52) + 'px) does not fit a ' + D.BOTH_CARD.w + '-wide card');
    });
  });

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
    if (!/⭐ \+2/.test(d.gStars(2))) fail('gStars ' + L + ' must read "⭐ +2"');
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' is missing or has a number in it');
    if (/扣|−|-\s*\d|lose|minus/.test(d.gWin(7) + d.gClear + d.gStars(1))) fail('star texts ' + L + ' talk about losing points');
  });
  if (!/gScoreLabel:'星星'/.test(src) || !/gScoreLabel:'Stars'/.test(src)) fail('the scoreboard label must say 星星 / Stars (low grades collect stars, not a score)');

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }
  const tgt = (R, id) => ({ id, cx:R.x + R.w / 2, cy:R.y + R.h / 2, hw:R.w / 2, hh:R.h / 2, done:false });
  /* 一排相鄰的格子（大小可以不同）：格子裡每一點判給那一格；兩格中間的縫判給比較近的那一格（一樣近不管）；整排外面都不收；
     已經放好的那一格不可以把東西塞給旁邊 */
  const rowCheck = (rects, p, what) => {
    if (!nearestOpen) return;
    const list = rects.map(tgt);
    let bad = 0, gapBad = 0, overlap = false;
    list.forEach((b, i) => {
      for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, p); if (!g || g.id !== i) bad++; }
      if (i + 1 < list.length){
        const r = rects[i].x + rects[i].w, l = rects[i + 1].x, y = b.cy;
        if (l - r < 2 * p) overlap = true;
        for (let x = r + 0.25; x < l; x += 0.25){ const want = x - r < l - x ? i : i + 1, g = nearestOpen(list, { x, y }, p); if (x - r !== l - x && (x - r <= p || l - x <= p) && (!g || g.id !== want)) gapBad++; }
      }
    });
    if (!overlap) fail(what + ': no two neighbours are closer than 2 × pad (' + p + ') — the nearest-box rule is never exercised');
    if (bad) fail('nearestOpen(): ' + bad + ' points inside a ' + what + ' are given to another box (or none)');
    if (gapBad) fail('nearestOpen(): ' + gapBad + ' points between two ' + what + 'es go to the farther box (or none) — it takes the first match instead of the nearest');
    const done = list.map((b, i) => Object.assign({}, b, { done:i === 0 }));
    const edge = { x:done[0].cx + done[0].hw - 0.5, y:done[0].cy };
    if (nearestOpen(done, edge, p) !== null || nearestOpen(done, { x:done[0].cx, y:done[0].cy }, p) !== null) fail('nearestOpen(): a drop on a finished ' + what + ' is moved into its neighbour');
    if (nearestOpen(list, { x:-50, y:-50 }, p) !== null) fail('nearestOpen(): a drop far from every ' + what + ' is accepted');
  };

  /* ================= 第 1 關：一包一包裝（範例 1，分裝） ================= */
  {
    const GB = D.GROUP_BAG, GP = D.GROUP_PILE, LB = D.GROUP_LBL, H = D.GROUP_H;
    if (!(D.GAME_GROUP.length >= 3)) fail('GAME_GROUP should have at least 3 entries');
    D.GAME_GROUP.forEach((e, i) => {
      const w = 'GAME_GROUP[' + i + ']';
      if (!SCENE_TRUTH[e.si]) return fail(w + ': unknown scene ' + e.si);
      if (![e.n, e.k].every(Number.isInteger) || e.n % e.k !== 0) return fail(w + ': ' + e.n + ' does not pack into whole bags of ' + e.k);
      const bags = e.n / e.k;
      if (!(e.k >= 2 && e.k <= 6)) fail(w + ': ' + e.k + ' in a bag — the bag draws 2~6 in one row');
      if (!(bags >= 2 && bags <= 6)) fail(w + ': ' + bags + ' bags — the shelf holds 2~6');
      if (!(e.n <= GP.perRow * 3)) fail(w + ': ' + e.n + ' things — the pile holds three rows of ' + GP.perRow);
      if (bags === e.k) fail(w + ': as many bags as things in a bag (' + bags + ') — counting the wrong one still gives the right number');
      /* 照遊戲規則玩一遍（自己的規則）：一次只收剛好 k 個；k − 1 與 k ＋ 1 都不收 */
      let left = e.n, b = 0, guard = 0;
      const accept = m => m === e.k;
      while (left > 0 && guard++ < 20){
        [e.k - 1, e.k + 1].forEach(m => { if (m >= 1 && m <= left && accept(m)) fail(w + ': a pick of ' + m + ' would be packed'); });
        if (!accept(e.k)) return fail(w + ': a pick of exactly ' + e.k + ' is refused');
        left -= e.k; b++;
      }
      if (b !== bags || left !== 0) fail(w + ': replay ends with ' + b + ' bags and ' + left + ' left');
      /* 版面：一堆東西（每個 GPICK）不碰、在畫板裡、在標籤下面；袋子不碰、在標籤上面；袋子裡 k 個點在袋子裡 */
      const pile = [];
      for (let j = 0; j < e.n; j++){
        const p = D.groupPileXY(j, e.n), row = Math.floor(j / GP.perRow), inRow = Math.min(GP.perRow, e.n - row * GP.perRow);
        const m = { x:W / 2 + (j % GP.perRow - (inRow - 1) / 2) * GP.step, y:GP.y + row * GP.rowStep };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('groupPileXY(' + j + ', ' + e.n + ') should be ' + JSON.stringify(m));
        const r = box(m.x, m.y, D.GPICK, D.GPICK); pile.push(r); inside(r, w + ' thing ' + (j + 1), W, H);
        if (r.y < LB.y + LB.h) fail(w + ': thing ' + (j + 1) + ' overlaps the "picked" label');
      }
      noHits(pile, w + ': things');
      const shelf = [];
      for (let j = 0; j < bags; j++){
        const p = D.groupBagXY(j), m = { x:W / 2 + ((j % GB.perRow) - 1) * (GB.w + GB.gap), y:GB.y + GB.h / 2 + Math.floor(j / GB.perRow) * GB.rowStep };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('groupBagXY(' + j + ') should be ' + JSON.stringify(m));
        const r = box(m.x, m.y, GB.w, GB.h); shelf.push(r); inside(r, w + ' bag ' + (j + 1), W, H);
        if (r.y + r.h > LB.y) fail(w + ': bag ' + (j + 1) + ' overlaps the "picked" label');
      }
      noHits(shelf, w + ': bags');
      const dots = [];
      for (let j = 0; j < e.k; j++){
        const p = D.bagDotXY(j, e.k), m = { x:GB.w / 2 + (j - (e.k - 1) / 2) * GB.step, y:GB.h / 2 };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('bagDotXY(' + j + ', ' + e.k + ') should be ' + JSON.stringify(m));
        const r = box(m.x, m.y, GB.dot, GB.dot); dots.push(r); within(r, { x:3, y:3, w:GB.w - 6, h:GB.h - 6 }, w + ': dot ' + (j + 1) + ' in a bag');
      }
      noHits(dots, w + ': dots in a bag');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gGroupProb ' + L, d.gGroupProb(e), [e.n, e.k]);
        if (d.gGroupProb(e).indexOf(unit(L, e.si, 'item', e.k)) < 0) fail(w + ' gGroupProb ' + L + ' never says "' + unit(L, e.si, 'item', e.k) + '"');
        seq(w + ' gGroupNow ' + L, d.gGroupNow(e.si, 1, e.n - e.k), [1, e.n - e.k]);
        seq(w + ' gGroupFew ' + L, d.gGroupFew(e.si, e.k - 1, e.k), [e.k - 1, e.k]);
        seq(w + ' gGroupMany ' + L, d.gGroupMany(e.si, e.k + 1, e.k), [e.k + 1, e.k]);
        seq(w + ' gGroupDone ' + L, d.gGroupDone(e.si, e.n, e.k, bags), [e.n, bags, e.k, bags, e.n]);
        if (d.gGroupDone(e.si, e.n, e.k, bags).indexOf(unit(L, e.si, 'grp', bags)) < 0) fail(w + ' gGroupDone ' + L + ' does not give the answer as "' + unit(L, e.si, 'grp', bags) + '"');
        seq(w + ' gGroup2 ' + L + ' (fewer)', d.gGroup2(e.si, 1, e.k), [1, e.k - 1]);
        seq(w + ' gGroup2 ' + L + ' (exact)', d.gGroup2(e.si, e.k, e.k), [e.k]);
        seq(w + ' gGroup2 ' + L + ' (more)', d.gGroup2(e.si, e.k + 2, e.k), [2]);
        [[1, d.gGroup2(e.si, 1, e.k)], [e.k, d.gGroup2(e.si, e.k, e.k)], [2, d.gGroup2(e.si, e.k + 2, e.k)]].forEach(([c, t]) => {
          if (t.indexOf(unit(L, e.si, 'item', c)) < 0) fail(w + ' gGroup2 ' + L + ' does not say "' + unit(L, e.si, 'item', c) + '": ' + t);
        });
        if (/\d/.test(d.gGroupBtn(e.si))) fail(w + ' gGroupBtn ' + L + ' has a number in it');
        if (d.gGroupBtn(e.si).indexOf(L === 'zh' ? SCENE_TRUTH[e.si].zh.grp : SCENE_TRUTH[e.si].en.grp) < 0) fail(w + ' gGroupBtn ' + L + ' does not name the ' + SCENE_TRUTH[e.si].en.grp);
      });
    });
    need('group', /var m = picked\.length;\s*if \(m === 0\) return;/, 'pressing the button with nothing picked is not a silent no-op');
    need('group', /if \(m !== e\.k\)\{ roundMiss\(m < e\.k \? d\.gGroupFew\(si, m, e\.k\) : d\.gGroupMany\(si, m, e\.k\)\); return; \}/, 'a pick that is not exactly k is packed (bags would not be equal), or the reason is the wrong way round');
    need('group', /left -= e\.k;[\s\S]*?for \(var j = 0; j < e\.k; j\+\+\) addDot\(bz, bagDotXY\(j, e\.k\), GB\.dot\);\s*bags\+\+;/, 'a packed bag is not drawn with k dots');
    need('group', /if \(left === 0\)\{ btn\.disabled = true; roundSolved\(d\.gGroupDone\(si, e\.n, e\.k, bags\)\); \}/, 'the round is not solved exactly when nothing is left');
    need('group', /if \(gSolved \|\| c\.disabled\) return;/, 'a packed (hidden) thing can still be picked');
  }

  /* ================= 第 2 關：一個一個輪流發（範例 2，平分） ================= */
  {
    const SP = D.DEAL_PLATE, PI = D.DEAL_PILE, TK = D.DEAL_TOKEN, H = D.DEAL_H;
    if (!(D.GAME_SHARE.length >= 3)) fail('GAME_SHARE should have at least 3 entries');
    D.GAME_SHARE.forEach((e, i) => {
      const w = 'GAME_SHARE[' + i + ']';
      if (!SCENE_TRUTH[e.si]) return fail(w + ': unknown scene ' + e.si);
      if (![e.n, e.g].every(Number.isInteger) || e.n % e.g !== 0) return fail(w + ': ' + e.n + ' does not share equally among ' + e.g);
      const per = e.n / e.g;
      if (!(e.g >= 2 && e.g <= 4)) fail(w + ': ' + e.g + ' plates — the board holds 2~4');
      if (!(per >= 2 && per <= 6)) fail(w + ': ' + per + ' each — a plate draws 2~6');
      if (!(e.n <= 20)) fail(w + ': ' + e.n + ' in the pile — it draws two rows of 10');
      /* 照規則走遍所有狀態（BFS）：一個盤子只在它是最少的時候收。每一種走法都走得到終點，終點每盤都是 per；
         而且還沒發完的每一步都至少有一個「不收」的盤子 —— 規則真的擋得住「先給已經比較多的人」 */
      const seen = new Set(), queue = [new Array(e.g).fill(0)];
      let ends = 0, blocked = 0, steps = 0;
      while (queue.length && steps++ < 20000){
        const s = queue.shift(), key = s.join();
        if (seen.has(key)) continue;
        seen.add(key);
        const sum = s.reduce((a, b) => a + b, 0), min = Math.min.apply(null, s);
        if (Math.max.apply(null, s) - min > 1) fail(w + ': the rule lets one child get 2 more than another (' + key + ')');
        if (sum === e.n){ ends++; if (!s.every(x => x === per)) fail(w + ': dealing ends unequal (' + key + ')'); continue; }
        if (s.some(x => x > min)) blocked++;
        s.forEach((x, p) => { if (x === min){ const t = s.slice(); t[p]++; queue.push(t); } });
      }
      if (ends !== 1) fail(w + ': dealing can end in ' + ends + ' different states');
      if (!blocked) fail(w + ': the round-robin rule never refuses a plate — nothing is being taught');
      /* 版面 */
      const plates = [];
      for (let p = 0; p < e.g; p++){
        const x = D.dealPlateX(e.g, p), mx = W / 2 + (p - (e.g - 1) / 2) * (SP.w + SP.gap);
        if (!near(x, mx)) fail('dealPlateX(' + e.g + ', ' + p + ') should be ' + mx);
        const r = box(mx, SP.y, SP.w, SP.h); plates.push(r); inside(r, w + ' plate ' + (p + 1), W, H);
      }
      noHits(plates, w + ': plates');
      rowCheck(plates, D.GPAD, w + ' plate');
      const pileR = { x:PI.x, y:PI.y, w:PI.w, h:PI.h }, tokR = box(W / 2, TK.y, TK.size, TK.size);
      inside(pileR, w + ' pile', W, H); inside(tokR, w + ' token', W, H);
      noHits(plates.concat([pileR, tokR]), w + ': plates / pile / token');
      for (let k = 0; k < e.n; k++){
        const p = D.pileDotXY(k, PI.top), m = { x:W / 2 + ((k % 10) - 4.5) * D.PILE_STEP, y:PI.top + Math.floor(k / 10) * D.PILE_STEP };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('pileDotXY(' + k + ') should be ' + JSON.stringify(m));
        within(box(m.x, m.y, D.PILE_DOT, D.PILE_DOT), pileR, w + ': pile dot ' + (k + 1));
      }
      const pd = [];
      for (let k = 0; k < per; k++){
        const p = D.dealDotXY(k), m = { x:SP.w / 2 + ((k % 2) - 0.5) * SP.step, y:SP.top + D.PILE_DOT / 2 + Math.floor(k / 2) * SP.step };
        if (!near(p.x, m.x) || !near(p.y, m.y)) fail('dealDotXY(' + k + ') should be ' + JSON.stringify(m));
        const r = box(m.x, m.y, D.PILE_DOT, D.PILE_DOT); pd.push(r);
        /* 上面 24px 畫小朋友、下面 28px 寫數字 */
        within(r, { x:3, y:24, w:SP.w - 6, h:SP.h - 24 - 28 }, w + ': dot ' + (k + 1) + ' on a plate (between the child and the count)');
      }
      noHits(pd, w + ': dots on a plate');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gDealProb ' + L, d.gDealProb(e), [e.n, e.g]);
        seq(w + ' gDealNow ' + L, d.gDealNow(e.si, e.n - 1), [e.n - 1]);
        seq(w + ' gDealAhead ' + L, d.gDealAhead(e.si, 2, 1), [2, 1]);
        seq(w + ' gDealDone ' + L, d.gDealDone(e.si, e.n, e.g, per), [e.n, per, per, e.g, e.n]);
        if (d.gDealDone(e.si, e.n, e.g, per).indexOf(unit(L, e.si, 'item', per)) < 0) fail(w + ' gDealDone ' + L + ' does not give the answer as "' + unit(L, e.si, 'item', per) + '"');
        seq(w + ' gDeal2 ' + L, d.gDeal2(e.si, 1), [1]);
        /* 每一個數量都要帶單位，0 和 1 也是（codex 第一、二輪：英文「someone has only 0」） */
        [0, 1, 2].forEach(c => {
          if (d.gDealAhead(e.si, c + 1, c).indexOf(unit(L, e.si, 'item', c)) < 0) fail(w + ' gDealAhead ' + L + ' does not say "' + unit(L, e.si, 'item', c) + '": ' + d.gDealAhead(e.si, c + 1, c));
          if (d.gDeal2(e.si, c).indexOf(unit(L, e.si, 'item', c)) < 0) fail(w + ' gDeal2 ' + L + ' does not say "' + unit(L, e.si, 'item', c) + '": ' + d.gDeal2(e.si, c));
        });
        if (L === 'en' && !/ are shared equally among /.test(d.gDealProb(e))) fail(w + ' gDealProb en has no verb ("N things are shared ..."): ' + d.gDealProb(e));
      });
    });
    need('deal', /var pl = nearestOpen\(plates, pt, GPAD\);\s*if \(!pl\) return false;/, 'a plate is not picked as the nearest (empty space must be silent)');
    need('deal', /var min = minCount\(\);\s*if \(pl\.n > min\)\{ roundMiss\(d\.gDealAhead\(si, pl\.n, min\)\); return false; \}/, 'a plate that already has more than another is accepted (no round-robin)');
    need('deal', /if \(left === 0\)\{\s*P\.lock\(P\.homeX, P\.homeY\); P\.el\.classList\.add\('gone'\);\s*roundSolved\(d\.gDealDone\(si, e\.n, e\.g, per\)\);/, 'the round is not solved exactly when the pile is empty');
    need('deal', /if \(pt\.tap\) keepSelected\(B, P\);/, 'tap-then-tap does not keep the token selected');
  }

  /* ================= 第 3 關：同樣的數字，兩種問法（範例 3） ================= */
  {
    const P0 = D.BOTH_PANEL, S = D.BOTH_SLOT, C = D.BOTH_CARD, M = D.BOTH_MINI, H = D.BOTH_H;
    if (!(D.GAME_BOTH.length >= 3)) fail('GAME_BOTH should have at least 3 entries');
    const panels = P0.y.map(y => ({ x:0, y, w:W, h:P0.h }));
    panels.forEach((r, j) => inside(r, 'both: panel ' + (j + 1), W, H));
    noHits(panels, 'both: panels');
    const slots = P0.y.map(y => ({ x:(W - S.w) / 2, y:y + P0.slotY, w:S.w, h:S.h }));
    slots.forEach((r, j) => within(r, panels[j], 'both: answer box ' + (j + 1)));
    const cardR = [0, 1, 2, 3].map(i => {
      const p = D.bothCardXY(i), m = { x:W / 2 + ((i % 2) - 0.5) * C.stepX, y:C.y + Math.floor(i / 2) * C.rowStep };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('bothCardXY(' + i + ') should be ' + JSON.stringify(m));
      const r = box(m.x, m.y, C.w, C.h); inside(r, 'both: card ' + (i + 1), W, H); return r;
    });
    noHits(cardR.concat(panels), 'both: cards / panels');
    D.GAME_BOTH.forEach((e, i) => {
      const w = 'GAME_BOTH[' + i + ']';
      if (!SCENE_TRUTH[e.si]) return fail(w + ': unknown scene ' + e.si);
      if (SCENE_TRUTH[e.si].zh.grp === '盤') fail(w + ': the plate scene — the packing picture would be plates, the same as the sharing plates');
      if (![e.total, e.k].every(Number.isInteger) || e.total % e.k !== 0) return fail(w + ': ' + e.total + ' does not divide by ' + e.k);
      const q = e.total / e.k;
      if (q === e.k) fail(w + ': the answer ' + q + ' equals the given number — the k cards would be right answers too');
      if (!(q >= 2 && q <= 6 && e.k >= 2 && e.k <= 6)) fail(w + ': ' + q + ' / ' + e.k + ' — both pictures draw 2~6');
      /* 照規則：四張卡 × 兩格，只有兩個組合收，原因照「數字先、單位後」 */
      const cards = [{ n:q, u:'grp' }, { n:q, u:'item' }, { n:e.k, u:'grp' }, { n:e.k, u:'item' }];
      let okCount = 0;
      ['pack', 'share'].forEach(kind => cards.forEach(c => {
        const want = kind === 'pack' ? 'grp' : 'item', ok = c.n === q && c.u === want;
        if (ok) okCount++;
        else {
          const why = (c.n !== q ? 'K' : 'U') + kind;
          LANGS.forEach(L => {
            const d = I18N[L], t = why === 'Kpack' ? d.gBothKPack(e.si, e.k) : why === 'Kshare' ? d.gBothKShare(e.si, e.k) : why === 'Upack' ? d.gBothUnitPack(e.si) : d.gBothUnitShare(e.si);
            seq(w + ' ' + kind + ' ← ' + c.n + ' ' + c.u + ' ' + L, t, c.n !== q ? [e.k] : []);
          });
        }
      }));
      if (okCount !== 2) fail(w + ': ' + okCount + ' card/box pairs are accepted, should be exactly 2');
      /* 小圖：q 包每包 k 個、k 盤每盤 q 個，排一排要在畫板裡；高度要在題目和答案格之間 */
      const bw = D.bothBagW(e.k), bh = M.pad * 2 + M.dot, ph = D.bothPlateH(q);
      if (!near(bw, M.pad * 2 + (e.k - 1) * M.step + M.dot)) fail(w + ': bothBagW(' + e.k + ') is ' + bw);
      if (!near(ph, M.pad * 2 + (Math.ceil(q / 2) - 1) * M.step + M.dot)) fail(w + ': bothPlateH(' + q + ') is ' + ph);
      [['pack', q, bw, bh], ['share', e.k, M.plateW, ph]].forEach(([kind, count, iw, ih], j) => {
        const top = P0.y[j] + P0.picY - ih / 2, list = [];
        for (let t = 0; t < count; t++){
          const x = D.bothRowX(t, count, iw), mx = W / 2 - (count * iw + (count - 1) * M.gap) / 2 + t * (iw + M.gap);
          if (!near(x, mx)) fail(w + ': bothRowX(' + t + ', ' + count + ', ' + iw + ') should be ' + mx);
          const r = { x:mx, y:top, w:iw, h:ih }; list.push(r);
          within(r, { x:4, y:P0.y[j] + P0.lblY + P0.lblH, w:W - 8, h:P0.slotY - P0.lblY - P0.lblH }, w + ' ' + kind + ' picture ' + (t + 1) + ' (between the question and the answer box)');
        }
        noHits(list, w + ' ' + kind + ' picture');
      });
      /* 盤子裡 q 個點（兩個一排）要在盤子裡 */
      for (let n = 0; n < q; n++){
        const r = box(M.plateW / 2 + ((n % 2) - 0.5) * M.step, M.pad + M.dot / 2 + Math.floor(n / 2) * M.step, M.dot, M.dot);
        within(r, { x:0, y:0, w:M.plateW, h:ph }, w + ': dot ' + (n + 1) + ' on a small plate');
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gBothPack ' + L, d.gBothPack(e), [e.total, e.k]);
        seq(w + ' gBothShare ' + L, d.gBothShare(e), [e.total, e.k]);
        if (L === 'en' && !/ go to \d+ children\./.test(d.gBothShare(e))) fail(w + ' gBothShare en has no verb ("N things go to k children."): ' + d.gBothShare(e));
        cards.forEach(c => { if (d.gBothCard(e.si, c.n, c.u) !== unit(L, e.si, c.u, c.n)) fail(w + ' card ' + L + ' reads "' + d.gBothCard(e.si, c.n, c.u) + '", the checker expects "' + unit(L, e.si, c.u, c.n) + '"'); });
        seq(w + ' gBothNow ' + L, d.gBothNow(e.si, q, q), [q, q]);
        seq(w + ' gBothDone ' + L, d.gBothDone(e.si, q), [q, q, q]);
        if (d.gBothDone(e.si, q).indexOf(unit(L, e.si, 'grp', q)) < 0 || d.gBothDone(e.si, q).indexOf(unit(L, e.si, 'item', q)) < 0) fail(w + ' gBothDone ' + L + ' does not name both units');
        seq(w + ' gBoth2 ' + L, d.gBoth2(e.si, q), [q, q]);
        if (L === 'zh' && (d.gBothPack(e).indexOf('幾' + SCENE_TRUTH[e.si].zh.grp) < 0 || d.gBothShare(e).indexOf('每人幾' + SCENE_TRUTH[e.si].zh.item) < 0)) fail(w + ': the zh questions do not ask "幾' + SCENE_TRUTH[e.si].zh.grp + '" / "每人幾' + SCENE_TRUTH[e.si].zh.item + '"');
      });
    });
    need('both', /var s = nearestOpen\(slots, pt, GPAD\), c = P\.data;\s*if \(!s\) return false;/, 'an answer box is not picked as the nearest (empty space must be silent)');
    need('both', /var want = s\.kind === 'pack' \? 'grp' : 'item';\s*if \(c\.n !== q\)\{ roundMiss\(s\.kind === 'pack' \? d\.gBothKPack\(si, e\.k\) : d\.gBothKShare\(si, e\.k\)\); return false; \}\s*if \(c\.u !== want\)\{ roundMiss\(s\.kind === 'pack' \? d\.gBothUnitPack\(si\) : d\.gBothUnitShare\(si\)\); return false; \}/, 'a card with the given number, or with the wrong unit, is accepted');
    need('both', /if \(slots\[0\]\.done && slots\[1\]\.done\) roundSolved\(d\.gBothDone\(si, q\)\);/, 'the round is not solved exactly when both boxes are filled');
    need('both', /shuffle\(cards\)\.forEach\(function\(c, i\)\{/, 'the answer cards are not shuffled');
    need('both', /for \(i = 0; i < q; i\+\+\)\{\s*var bz = addZone\(B, bothRowX\(i, q, bw\)/, 'the packing picture is not q bags');
    need('both', /for \(n = 0; n < e\.k; n\+\+\) addDot\(bz,/, 'a bag in the packing picture does not hold k');
    need('both', /for \(i = 0; i < e\.k; i\+\+\)\{\s*var pz = addZone\(B, bothRowX\(i, e\.k, M\.plateW\)/, 'the sharing picture is not k plates');
    need('both', /for \(n = 0; n < q; n\+\+\) addDot\(pz,/, 'a plate in the sharing picture does not hold q');
  }

  /* ================= 第 4 關：用乘法算式找答案（範例 4） ================= */
  {
    const S = D.EQ_SLOT, R = D.EQ_RES, C = D.EQ_CARD, K = D.EQ_KEYS, H = D.EQ_H, P = D.EQ_PAD;
    const f0 = { x:S.x[0], y:S.y, w:S.w, h:S.h }, f1 = { x:S.x[1], y:S.y, w:S.w, h:S.h }, res = { x:R.x, y:S.y, w:R.w, h:S.h };
    [f0, f1, res].forEach((r, j) => inside(r, 'eq: box ' + (j + 1), W, H));
    noHits([f0, f1, res], 'eq: boxes');
    if (!(S.x[1] - (S.x[0] + S.w) >= 20)) fail('eq: no room for the × between the two factor boxes');
    if (!(R.eqW >= 24 && R.eqW < R.w - C.w)) fail('eq: the "=" inside the result box leaves no room for the total card');
    const rc = D.eqResCardX();
    if (!near(rc, R.x + R.eqW + (R.w - R.eqW) / 2)) fail('eqResCardX() should be ' + (R.x + R.eqW + (R.w - R.eqW) / 2));
    within(box(rc, S.y + S.h / 2, C.w, C.h), { x:R.x + R.eqW, y:S.y - 2, w:R.w - R.eqW, h:S.h + 4 }, 'eq: the total card in the result box (right of the =)');
    rowCheck([f0, f1, res], P, 'sentence box');
    /* 量中心 vs 量方框：在「＝」那一格的左緣、第二格的吸附範圍裡，至少要有一點是「中心比較近第二格」——
       不然把 nearestOpen() 改成量中心，這一課也不會出錯，端對端的重疊測試就驗不到它 */
    {
      const px = res.x + 1, cy = S.y + S.h / 2;
      if (!(px - (f1.x + f1.w) <= P)) fail('eq: the left edge of the result box is outside box 2\'s drop pad — no overlap zone');
      if (!(Math.abs(px - (f1.x + f1.w / 2)) < Math.abs(px - (res.x + res.w / 2)))) fail('eq: at the result box\'s left edge the centre of box 2 is not nearer — a centre-distance bug would go unnoticed');
      if (nearestOpen){ const g = nearestOpen([tgt(f0, 0), tgt(f1, 1), tgt(res, 2)], { x:px, y:cy }, P); if (!g || g.id !== 2) fail('nearestOpen(): a drop 1px inside the result box goes to ' + (g ? 'box ' + (g.id + 1) : 'nothing')); }
    }
    const cards = [];
    for (let i = 0; i < 3; i++){ const r = box((W - 2 * C.step) / 2 + i * C.step, C.y, C.w, C.h); cards.push(r); inside(r, 'eq: card ' + (i + 1), W, H); }
    noHits(cards.concat([f0, f1, res]), 'eq: cards / boxes');
    const keys = [];
    for (let v = 1; v <= 9; v++){
      const p = D.eqKeyXY(v), row = v <= 5 ? 0 : 1, ii = row ? v - 6 : v - 1, inRow = row ? 4 : 5;
      const m = { x:W / 2 + (ii - (inRow - 1) / 2) * K.step, y:K.y + row * K.rowStep };
      if (!near(p.x, m.x) || !near(p.y, m.y)) fail('eqKeyXY(' + v + ') should be ' + JSON.stringify(m));
      const r = box(m.x, m.y, K.size, K.size); keys.push(r); inside(r, 'eq: number card ' + v, W, H);
    }
    noHits(keys.concat([f0, f1, res]), 'eq: number cards / boxes');
    if (!(D.GAME_EQ.length >= 3)) fail('GAME_EQ should have at least 3 entries');
    let sawPack = false, sawShare = false;
    D.GAME_EQ.forEach((e, i) => {
      const w = 'GAME_EQ[' + i + ']';
      if (!SCENE_TRUTH[e.si]) return fail(w + ': unknown scene ' + e.si);
      if (e.kind === 'pack') sawPack = true; else if (e.kind === 'share') sawShare = true; else fail(w + ': unknown kind ' + e.kind);
      if (![e.total, e.k].every(Number.isInteger) || e.total % e.k !== 0) return fail(w + ': ' + e.total + ' does not divide by ' + e.k);
      const ans = e.total / e.k;
      if (!(ans >= 2 && ans <= 9 && e.k >= 2 && e.k <= 9)) fail(w + ': ' + e.k + ' × ' + ans + ' is outside the times tables 2~9');
      if (ans === e.k) fail(w + ': the □ equals the given ' + e.k + ' — the given card and the answer look the same');
      /* 照規則：三張卡排進三格的 6 種排法，只有 × 兩邊互換的那 2 種排得完 */
      const vals = [e.k, e.total, 'box'];
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      let built = 0;
      perms.forEach(pm => {
        const put = pm.map(j => vals[j]);
        const okSlot = (j, v) => j === 2 ? v === e.total : v !== e.total;
        if (put.every((v, j) => okSlot(j, v))){
          built++;
          /* 排好之後：數字卡 1～9 只收一張，就是答案 */
          const good = [];
          for (let m = 1; m <= 9; m++){
            const a = put[0] === 'box' ? m : put[0], b = put[1] === 'box' ? m : put[1];
            if (a * b === e.total) good.push(m);
            else LANGS.forEach(L => {
              const t = I18N[L].gEqTry(a, b, a * b, e.total);
              seq(w + ' gEqTry ' + L + ' m=' + m, t, [a, b, a * b, e.total]);
              const more = L === 'zh' ? /多/.test(t) : /more/.test(t), less = L === 'zh' ? /少/.test(t) : /less/.test(t);
              if ((a * b > e.total) !== more || (a * b < e.total) !== less) fail(w + ' gEqTry ' + L + ' m=' + m + ' says more/less the wrong way: ' + t);
            });
          }
          if (good.join() !== String(ans)) fail(w + ': the number cards accepted are ' + good.join() + ', should be only ' + ans);
          LANGS.forEach(L => {
            const a = put[0] === 'box' ? ans : put[0], b = put[1] === 'box' ? ans : put[1], t = I18N[L].gEqDone(e, a, b, ans);
            seq(w + ' gEqDone ' + L, t, [a, b, e.total, ans, ans]);
            const u = unit(L, e.si, e.kind === 'pack' ? 'grp' : 'item', ans);
            if (t.indexOf(u) < 0) fail(w + ' gEqDone ' + L + ' does not give the answer as "' + u + '"');
            seq(w + ' gEqNow ' + L, I18N[L].gEqNow(a, b, e.total), [a, b, e.total]);
          });
        }
      });
      if (built !== 2) fail(w + ': ' + built + ' of the 6 card orders complete the sentence, should be 2 (the two factor orders)');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gEqProb ' + L, d.gEqProb(e), [e.total, e.k]);
        if (L === 'en' && e.kind === 'share' && !/ are shared equally among /.test(d.gEqProb(e))) fail(w + ' gEqProb en has no verb: ' + d.gEqProb(e));
        if (d.gEqProb(e).indexOf(e.kind === 'pack' ? (L === 'zh' ? '幾' + SCENE_TRUTH[e.si].zh.grp : SCENE_TRUTH[e.si].en.grpN) : (L === 'zh' ? '每人幾' + SCENE_TRUTH[e.si].zh.item : 'each child')) < 0) fail(w + ' gEqProb ' + L + ' does not ask the ' + e.kind + ' question');
        seq(w + ' gEqTotalSlot ' + L, d.gEqTotalSlot(e.total), [e.total]);
        seq(w + ' gEqNotTotal ' + L, d.gEqNotTotal(e.total), [e.total]);
        seq(w + ' gEq2a ' + L, d.gEq2a(e), [e.total, e.k]);
        seq(w + ' gEq2b ' + L, d.gEq2b(e.k, e.total), [e.k, e.total]);
      });
    });
    if (!sawPack || !sawShare) fail('GAME_EQ needs both a packing and a sharing problem');
    need('eq', /var s = nearestOpen\(all, pt, EQ_PAD\), v = P\.data\.v;\s*if \(!s\) return false;/, 'a sentence box is not picked as the nearest (empty space must be silent)');
    need('eq', /if \(s === res && v !== e\.total\)\{ roundMiss\(d\.gEqNotTotal\(e\.total\)\); return false; \}/, 'something other than the total is accepted after the =');
    need('eq', /if \(s !== res && v === e\.total\)\{ roundMiss\(d\.gEqTotalSlot\(e\.total\)\); return false; \}/, 'the total is accepted next to the ×');
    need('eq', /var all = \[f0, f1, res\];/, 'the result box is not last in the target list (the overlap test needs the nearer box NOT to be first)');
    need('eq', /if \(!nearestOpen\(\[\{ cx:boxAt\.cx, cy:boxAt\.cy, hw:boxAt\.hw, hh:boxAt\.hh, done:false \}\], pt, EQ_PAD\)\) return false;/, 'a number card is accepted somewhere other than the □');
    need('eq', /if \(a \* b !== e\.total\)\{ roundMiss\(d\.gEqTry\(a, b, a \* b, e\.total\)\); return false; \}/, 'a number card whose product is not the total is accepted');
    need('eq', /P\.home\(\);\s*boxP\.el\.textContent = String\(m\);/, 'a number card does not go back (cards must never run out)');
    need('eq', /roundSolved\(d\.gEqDone\(e, a, b, ans\)\);/, 'the round does not end with the answer');
  }

  /* ================= 第 5 關：一跳一份（範例 1、2 的數數線） ================= */
  {
    const HL = D.HOP_LINE, HP = D.HOP_PLATE, GB = D.GROUP_BAG, H = D.HOP_H;
    if (!(D.GAME_HOP.length >= 3)) fail('GAME_HOP should have at least 3 entries');
    let sawPack = false, sawShare = false;
    D.GAME_HOP.forEach((e, i) => {
      const w = 'GAME_HOP[' + i + ']';
      if (!SCENE_TRUTH[e.si]) return fail(w + ': unknown scene ' + e.si);
      if (e.kind === 'pack') sawPack = true; else if (e.kind === 'share') sawShare = true; else fail(w + ': unknown kind ' + e.kind);
      if (![e.total, e.k, e.x].every(Number.isInteger) || e.total % e.k !== 0) return fail(w + ': ' + e.total + ' does not divide by ' + e.k);
      const ans = e.total / e.k, btns = [e.k, ans, e.x];
      if (new Set(btns).size !== 3) fail(w + ': the three buttons ' + btns.join(', ') + ' are not all different');
      if (!(e.x >= 2 && e.x <= 9)) fail(w + ': the third button +' + e.x + ' should be 2~9');
      if (!(ans >= 2 && ans <= 6 && e.k >= 2 && e.k <= 6)) fail(w + ': ' + ans + ' jumps of ' + e.k + ' — the pictures draw 2~6');
      if (e.kind === 'share' && e.k > 4) fail(w + ': ' + e.k + ' children — the board draws at most 4 plates');
      if (e.kind === 'share' && ans > 6) fail(w + ': ' + ans + ' each — a plate draws at most 6');
      /* 照規則：只收 +k。跳 ans 次剛好到終點、從不跳過頭；跳「答案」那麼多也會剛好到終點 —— 規則一定要擋它 */
      let pos = 0, j = 0;
      while (pos < e.total && j < 20){ pos += e.k; j++; if (pos > e.total) fail(w + ': a jump of ' + e.k + ' passes the finish'); }
      if (j !== ans || pos !== e.total) fail(w + ': ' + j + ' jumps end at ' + pos);
      if (e.total % ans !== 0 || e.total / ans !== e.k) fail(w + ': inconsistent pool entry');
      /* 數線：每 1 一個刻度，間隔至少 10px；0 與總數在畫板裡 */
      const unitPx = (HL.x1 - HL.x0) / e.total;
      if (!(unitPx >= 10)) fail(w + ': ticks are ' + unitPx.toFixed(1) + 'px apart — too dense to count');
      for (let v = 0; v <= e.total; v++){
        const x = D.hopX(v, e.total), m = HL.x0 + (HL.x1 - HL.x0) * v / e.total;
        if (!near(x, m)) fail('hopX(' + v + ', ' + e.total + ') should be ' + m);
      }
      inside({ x:D.hopX(0, e.total) - 15, y:HL.frogY, w:30, h:28 }, w + ' frog at 0', W, H);
      inside({ x:D.hopX(e.total, e.total) - 15, y:HL.frogY, w:30, h:28 }, w + ' frog at the finish', W, H);
      for (let v = e.k; v <= e.total; v += e.k){
        const lx = D.hopX(v, e.total) - 14, prev = D.hopX(v - e.k, e.total) - 14;
        if (v > e.k && lx - prev < 28) fail(w + ': the landing labels ' + (v - e.k) + ' and ' + v + ' overlap');
        inside({ x:lx, y:HL.lblY, w:28, h:18 }, w + ' label ' + v, W, H);
      }
      /* 圖：分裝畫 ans 包（每包 k 個），平分畫 k 個盤子（每盤 ans 個），都在數線下面、畫板裡 */
      const pic = [];
      if (e.kind === 'pack'){
        for (let b = 0; b < ans; b++){
          const p = D.hopBagXY(b), g = D.groupBagXY(b);
          if (!near(p.x, g.x) || !near(p.y, g.y - GB.y + D.HOP_PIC.y)) fail('hopBagXY(' + b + ') should be groupBagXY shifted to HOP_PIC.y');
          pic.push(box(p.x, p.y, GB.w, GB.h));
        }
      } else {
        for (let c = 0; c < e.k; c++){
          const x = D.hopPlateX(e.k, c), mx = W / 2 + (c - (e.k - 1) / 2) * (HP.w + HP.gap);
          if (!near(x, mx)) fail('hopPlateX(' + e.k + ', ' + c + ') should be ' + mx);
          pic.push({ x:mx - HP.w / 2, y:D.HOP_PIC.y, w:HP.w, h:HP.h });
        }
        const dots = [];
        for (let t = 0; t < ans; t++){
          const p = D.hopDotXY(t), m = { x:HP.w / 2 + ((t % 2) - 0.5) * HP.stepX, y:HP.top + HP.dot / 2 + Math.floor(t / 2) * HP.stepY };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('hopDotXY(' + t + ') should be ' + JSON.stringify(m));
          const r = box(m.x, m.y, HP.dot, HP.dot); dots.push(r);
          within(r, { x:3, y:22, w:HP.w - 6, h:HP.h - 22 - 26 }, w + ': dot ' + (t + 1) + ' on a plate (between the child and the count)');
        }
        noHits(dots, w + ': dots on a plate');
      }
      pic.forEach((r, t) => { inside(r, w + ' picture ' + (t + 1), W, H); if (r.y < HL.lblY + 18) fail(w + ': picture ' + (t + 1) + ' overlaps the number line labels'); });
      noHits(pic, w + ': picture');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gHopProb ' + L, d.gHopProb(e), [e.total, e.k]);
        if (L === 'en' && e.kind === 'share' && !/ are shared among /.test(d.gHopProb(e))) fail(w + ' gHopProb en has no verb: ' + d.gHopProb(e));
        seq(w + ' gHopNow ' + L, d.gHopNow(e.k, e.total, 1), [1, e.k, e.total]);
        [ans, e.x].forEach(s => {
          const t = e.kind === 'pack' ? d.gHopWrongPack(e.si, s, e.k) : d.gHopWrongShare(e.si, s, e.k);
          seq(w + ' wrong jump +' + s + ' ' + L, t, e.kind === 'pack' ? [e.k, e.k, s] : [e.k, e.k, e.k, s]);
        });
        const done = d.gHopDone(e, ans);
        seq(w + ' gHopDone ' + L, done, e.kind === 'pack' ? [ans, e.total, ans, e.k, ans, e.total] : [ans, ans, ans, e.k, e.total]);
        const u = unit(L, e.si, e.kind === 'pack' ? 'grp' : 'item', ans);
        if (done.indexOf(u) < 0) fail(w + ' gHopDone ' + L + ' does not give the answer as "' + u + '"');
        seq(w + ' gHop2 ' + L, d.gHop2(e.k, e.k), [e.k, 2 * e.k]);
      });
    });
    if (!sawPack || !sawShare) fail('GAME_HOP needs both a packing and a sharing problem');
    need('hop', /var btns = shuffle\(\[e\.k, ans, e\.x\]\)\.map\(function\(s\)\{/, 'the three jump buttons are not +k, +answer, +x (shuffled)');
    need('hop', /if \(s !== e\.k\)\{ roundMiss\(e\.kind === 'pack' \? d\.gHopWrongPack\(si, s, e\.k\) : d\.gHopWrongShare\(si, s, e\.k\)\); return; \}/, 'a jump that is not +k is accepted (jumping by the answer also reaches the finish — that is the swapped meaning)');
    need('hop', /if \(pos === e\.total\)\{\s*btns\.forEach\(function\(x\)\{ x\.disabled = true; \}\);\s*roundSolved\(d\.gHopDone\(e, jumps\)\);/, 'the round is not solved exactly at the finish (or the buttons stay live)');
    need('hop', /plates\.forEach\(function\(pl\)\{ addDot\(pl\.el, hopDotXY\(jumps - 1\), HP\.dot\); pl\.num\.textContent = jumps; \}\);/, 'a sharing jump does not give every child one');
  }
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/divide */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'two options are the same answer',
      find:'      if (ok(c)){ seen[vkeyOf(c)] = true; out.push(c); }',
      replace:'      if (c){ out.push(c); }' },
    { file:'review', expect:'option count',
      find:'    var i = 0;\n    while (out.length < 3 && i < 60){',
      replace:'    var i = 0;\n    while (out.length < 3 && i < 0){' },
    /* 去重鍵不含單位種類的話，「4 包」和「4 顆」會被當成重複 ——
       unitPick 的單位誘答就會被擋掉，選項只剩三個。 */
    { file:'review', expect:'needs the same-number-wrong-unit distractor',
      find:"    if (v.u === 'item' || v.u === 'grp') return v.u + '#' + v.n;",
      replace:"    if (v.u === 'item' || v.u === 'grp') return 'n#' + v.n;" },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    return lang === 'zh' ? (n + ' ' + s.zh.grp)",
      replace:"    return lang === 'zh' ? (n + ' ' + s.zh.item)" },
    { file:'review', expect:'plural does not match',
      find:"                         : (n + ' ' + (n === 1 ? s.en.grp : s.en.grpN));",
      replace:"                         : (n + ' ' + s.en.grp);" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.op === 'mulBox')  return v.k + ' × □' + eq + v.total;",
      replace:"    if (v.op === 'mulBox')  return v.k + ' × □' + eq + (v.total + 1);" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.op === 'boxMul')  return '□ × ' + v.k + eq + v.total;",
      replace:"    if (v.op === 'boxMul')  return '□ × ' + v.total + eq + v.k;" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (v.p === 'grpCount')  return '有 ' + n + ' ' + grpWord(si, 'zh');",
      replace:"      if (v.p === 'grpCount')  return '有 ' + n + ' ' + itemWord(si, 'zh');" },

    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'correct is',
      find:'        var correct = GR(si, g);\n        /* 誘答：把「每包幾顆」抄回來當包數（最經典的錯）、多數一包、用減的。 */',
      replace:'        var correct = GR(si, per);\n        /* 誘答：把「每包幾顆」抄回來當包數（最經典的錯）、多數一包、用減的。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, q);\n        /* 誘答：把「幾個人」抄回來當每人幾個、多發一輪、用減的。 */',
      replace:'        var correct = IT(si, n);\n        /* 誘答：把「幾個人」抄回來當每人幾個、多發一輪、用減的。 */' },
    { file:'review', expect:'the answer must be counted in groups',
      find:'        var correct = GR(si, g);\n        /* 刻意的單位誘答：同一個數字、錯的單位。 */',
      replace:'        var correct = IT(si, g);\n        /* 刻意的單位誘答：同一個數字、錯的單位。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, total);\n        /* 誘答：用加的、少乘一份、把每份的數字乘自己。 */',
      replace:'        var correct = IT(si, total - per);\n        /* 誘答：用加的、少乘一份、把每份的數字乘自己。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, c);\n        var cands = [ IT(si, r), IT(si, c + 1), IT(si, total - r) ];',
      replace:'        var correct = IT(si, r);\n        var cands = [ IT(si, r), IT(si, c + 1), IT(si, total - r) ];' },
    { file:'review', expect:'total is not per × groups',
      find:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);",
      replace:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per + g;\n        var correct = EQ('mulBox', per, total);" },
    { file:'review', expect:'total is not per × groups',
      find:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);",
      replace:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n + q;\n        var correct = EQ('boxMul', n, total);" },
    { file:'review', expect:'total is not per × groups',
      find:'        var q = pickPer();\n        var total = n * q;\n        var correct = IT(si, q);',
      replace:'        var q = pickPer();\n        var total = n + q;\n        var correct = IT(si, q);' },
    { file:'review', expect:'total is not per × groups',
      find:'        var r = pickUnused([2,3,4,5,6], used);\n        var c = pickPer();\n        var total = r * c;',
      replace:'        var r = pickUnused([2,3,4,5,6], used);\n        var c = pickPer();\n        var total = r + c;' },
    { file:'review', expect:'total is not 3 shares',
      find:'        var q = pickUnused([3,4,5,6,7,8,9], used);\n        var total = 3 * q;',
      replace:'        var q = pickUnused([3,4,5,6,7,8,9], used);\n        var total = 4 * q;' },
    { file:'review', expect:'each share must be 3~9',
      find:'        var q = pickUnused([3,4,5,6,7,8,9], used);',
      replace:'        var q = pickUnused([1,2,3,4,5,6,7,8,9], used);' },
    /* 份額下限那一條要有自己的改壞版本：這一組誘答加起來還是總數，
       但 q ＝ 3 的時候會生出「0 份」—— 只驗總和的話這一筆會靜靜通過。 */
    { file:'review', expect:'a share must be at least 1',
      find:'        var opts = shuffle([correct, TR(q - 1, q, q + 1), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);',
      replace:'        var opts = shuffle([correct, TR(q - 3, q, q + 3), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);' },
    { file:'review', expect:'does not add up to the total',
      find:'        var opts = shuffle([correct, TR(q - 1, q, q + 1), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);',
      replace:'        var opts = shuffle([correct, TR(q - 1, q, q + 2), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);' },
    /* 這兩題的誘答只有在「每份 ≠ 份數」時才真的是錯的答案 ——
       每份 ＝ 份數 的時候，「每包 g 個」變成一句真話，就有兩個正確選項了。 */
    { file:'review', expect:'must differ from the number of groups',
      find:'        var per = pickPer(g);              /* per ≠ g，不然「每包 g 個」會變成真的 */',
      replace:'        var per = pickPer();              /* per ≠ g，不然「每包 g 個」會變成真的 */' },
    { file:'review', expect:'must differ from the number of groups',
      find:'        var per = pickPer(g);              /* per ≠ g，不然「每包 g 個」也會是對的 */',
      replace:'        var per = pickPer();              /* per ≠ g，不然「每包 g 個」也會是對的 */' },
    { file:'review', expect:'each group must hold 2~9 items',
      find:'    var pool = [2,3,4,5,6,7,8,9].filter(function(x){ return x !== avoid; });',
      replace:'    var pool = [1,2,3,4,5,6,7,8,9].filter(function(x){ return x !== avoid; });' },
    { file:'review', expect:'outside 1~54',
      find:'          return (v >= 1 && v <= 54) ? GR(si, v) : null;\n        });\n        return { si:si, per:per, g:g, total:total, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'          return (v >= 1 && v <= 54) ? GR(si, v) : null;\n        });\n        mix.opts[(mix.ans + 1) % 4] = GR(si, 400);\n        return { si:si, per:per, g:g, total:total, correct:correct, opts:mix.opts, ans:mix.ans };' },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? (d.per + ' × ' + d.g + ' ＝ ' + d.total + '，' + d.total + ' 裡面有 ' + d.g + ' 個 ' + d.per +",
      replace:"            ? (d.per + ' × ' + d.g + ' ＝ ' + d.total + '，' + d.total + ' 裡面有' + d.g + ' 個 ' + d.per +" },
    { file:'review', expect:'doubled punctuation',
      find:"               ' groups of ' + d.per + ' — that is ' + qtyGrp(d.si, d.g, 'en') + '.')",
      replace:"               ' groups of ' + d.per + ' — that is ' + qtyGrp(d.si, d.g, 'en') + '..')" },

    /* --- index.html：範例資料、題庫與遊戲關卡 --- */
    { file:'index', expect:'PACK_EX total is not a whole number of groups',
      find:'  var PACK_EX = { si:0, total:12, per:3 };',
      replace:'  var PACK_EX = { si:0, total:13, per:3 };' },
    { file:'index', expect:'SHARE_EX total is not a whole number of shares',
      find:'  var SHARE_EX = { si:1, total:12, n:3 };',
      replace:'  var SHARE_EX = { si:1, total:12, n:5 };' },
    { file:'index', expect:'BOTH_EX total is not a whole number of groups',
      find:'  var BOTH_EX = { si:0, total:12, k:3 };',
      replace:'  var BOTH_EX = { si:0, total:12, k:5 };' },
    { file:'index', expect:'is not a whole number of parts',
      find:"    { kind:'share', si:2, total:20, k:4 },",
      replace:"    { kind:'share', si:2, total:20, k:3 }," },
    { file:'index', expect:'the item unit and the group unit must differ',
      find:"        { thing:'蘋果', item:'個', grp:'籃' },",
      replace:"        { thing:'蘋果', item:'個', grp:'個' }," },
    { file:'index', expect:'singular and plural must differ',
      find:"        { item:'apple',   itemN:'apples',   grp:'basket', grpN:'baskets' },",
      replace:"        { item:'apple',   itemN:'apples',   grp:'basket', grpN:'basket' }," },
    { file:'index', expect:'p1End zh never shows the full number sentence',
      find:"               c.per + ' × ' + g + ' ＝ ' + c.total + '</span>';",
      replace:"               c.per + ' × ' + g + '</span>';" },
    { file:'index', expect:'p2End zh never states the answer with its unit',
      find:"        return '發完了！每人 <span class=\"bigans\">' + this.qtyItem(c.si, q) +",
      replace:"        return '發完了！每人 <span class=\"bigans\">' + q +" },
    { file:'index', expect:'b2 zh/pack never counts up to the total',
      find:"          for (var i = 1; i <= ans; i++) seq.push(i * c.k);\n          return '一' + this.grpWord(c.si) + '一' + this.grpWord(c.si) + '裝：' + seq.join('、') + ' —— 剛好裝完。';",
      replace:"          for (var i = 1; i <= ans; i++) seq.push(i * c.k + 1);\n          return '一' + this.grpWord(c.si) + '一' + this.grpWord(c.si) + '裝：' + seq.join('、') + ' —— 剛好裝完。';" },
    { file:'index', expect:'b3 zh/pack never states the answer with its unit',
      find:"          ? ('答案是 <span class=\"bigans\">' + this.qtyGrp(c.si, ans) + '</span>（單位是「' + this.grpWord(c.si) +",
      replace:"          ? ('答案是 <span class=\"bigans\">' + ans + '</span>（單位是「' + this.grpWord(c.si) +" },
    { file:'index', expect:'e2 never shows the empty box',
      find:"               (c.kind === 'pack' ? (c.k + ' × □ ＝ ' + c.total) : ('□ × ' + c.k + ' ＝ ' + c.total)) +",
      replace:"               (c.kind === 'pack' ? (c.k + ' × ? ＝ ' + c.total) : ('? × ' + c.k + ' ＝ ' + c.total)) +" },
    { file:'index', expect:'the checker expects',
      find:"          opts:['3 包','4 包','9 包','12 包'], ans:1,",
      replace:"          opts:['3 包','4 包','9 包','12 包'], ans:0," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['4 顆','5 包','4 包','20 包'], ans:2,",
      replace:"          opts:['4 顆','5 包','4 包','20 包'], ans:9," },
    /* --- 第一輪審查抓到的那幾筆，各自要有自己的改壞版本 --- */
    /* per ＝ g ＝ 2（總數 4）時，「2 ＋ □ ＝ 4」也解得出 2 —— 加法誘答變成第二個正解。 */
    { file:'review', expect:'also solves to the correct answer',
      find:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);",
      replace:"        var per = pickPer(0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);" },
    { file:'review', expect:'also solves to the correct answer',
      find:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);",
      replace:"        var q = pickPer(0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);" },
    /* 糖果題裡冒出「5 籃」：形狀對、去重也過，只有情境綁定擋得住。 */
    { file:'review', expect:'but the question is scene',
      find:'        var cands = [ GR(si, per), GR(si, g + 1), GR(si, total - per) ];',
      replace:'        var cands = [ GR((si + 1) % 4, per), GR(si, g + 1), GR(si, total - per) ];' },
    /* 字典的單位詞打錯字（顆 → 棵）：後面每一條渲染檢查用的都是同一本字典，
       只有逐字比對真值表才抓得到。 */
    { file:'index', expect:'zh scenes[0].item is',
      find:"        { thing:'糖果', item:'顆', grp:'包' },",
      replace:"        { thing:'糖果', item:'棵', grp:'包' }," },
    /* 12.5 顆糖分成每包 2.5 顆：整除、範圍、字串全都對得上。 */
    { file:'index', expect:'must be a whole number',
      find:'  var PACK_EX = { si:0, total:12, per:3 };',
      replace:'  var PACK_EX = { si:0, total:12.5, per:2.5 };' },
    /* 把題幹的 12 改成 13、答案還留著「4 包」—— 位置式神諭抓不到，數字神諭才抓得到。 */
    { file:'index', expect:'never appears in the stem',
      find:"        { stem:'🍬 12 顆糖果，每包裝 3 顆。<br>可以裝幾包？',",
      replace:"        { stem:'🍬 13 顆糖果，每包裝 3 顆。<br>可以裝幾包？'," },
    /* 只驗正解的話，把某個誘答換成垃圾字串也不會有人發現。 */
    { file:'index', expect:'does not look like an answer',
      find:"          opts:['3 包','4 包','9 包','12 包'], ans:1,",
      replace:"          opts:['3 包','4 包','banana','12 包'], ans:1," },
    /* 圖的寬度只算袋子／盤子的話，一開始那一排散落的東西會被整段切掉。 */
    { file:'index', expect:'px wide but the text',
      find:'    var w = Math.max(cols * (bagW + gap) + 10, looseW);',
      replace:'    var w = cols * (bagW + gap) + 10;' },
    { file:'index', expect:'px wide but the text',
      find:'    var w = Math.max(n * (plateW + gap) + 10, looseW);',
      replace:'    var w = n * (plateW + gap) + 10;' },
    /* --- 第二輪審查（審「修正本身」）抓到的那幾筆 --- */
    /* 只驗頭尾兩格的話，中間那一格被切掉不會有人發現。 */
    { file:'index', expect:'draws out to x=',
      find:'    var w = Math.max(cols * (bagW + gap) + 10, looseW);',
      replace:'    var w = (bags === 2) ? 40 : Math.max(cols * (bagW + gap) + 10, looseW);' },
    /* 只讀元素的起點 x 的話，一個比畫布還寬的矩形也會過關。 */
    { file:'index', expect:'draws out to x=',
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + by + '\" width=\"' + bagW + '\" height=\"' + bagH +",
      replace:"      s += '<rect x=\"' + bx + '\" y=\"' + by + '\" width=\"' + (bagW * 3) + '\" height=\"' + bagH +" },
    /* 刪掉最後一題英文題目：中文長度還是對的，英文那一圈就少驗一題。 */
    { file:'index', expect:'en qs: 5 questions but 6 expected',
      find:"        { stem:'🍪 15 biscuits are shared equally among 3 children.<br>Which way of splitting them is equal sharing?',\n          opts:['4, 5, 6','5, 5, 5','3, 5, 7','6, 6, 3'], ans:1,\n          why:'Equal sharing means everyone gets the same: 5, 5, 5 adds up to exactly 15 biscuits.' }\n      ],",
      replace:"      ]," },
    /* 題幹多塞一個數字：原本的兩個運算元還在，答案照樣重算得出來。 */
    { file:'index', expect:'unexpected number',
      find:"        { stem:'🍎 12 個蘋果，平分給 3 個小朋友。<br>每人幾個？',",
      replace:"        { stem:'🍎 12 個蘋果，平分給 3 個小朋友（另外還有 7 個梨子）。<br>每人幾個？'," },
    /* --- 第三輪審查（審第二輪的修正）抓到的 --- */
    /* 只看 x 的話，一段「起點在畫布內、內容卻長到畫出去」的居中文字量不到 ——
       這一筆證明新的量法真的把字數與 text-anchor 算進去了。 */
    { file:'index', expect:'draws out to x=',
      find:"           '\" font-size=\"13\" text-anchor=\"middle\" fill=\"#3B7DD8\" font-weight=\"800\">' + rounds + '</text>';",
      replace:"           '\" font-size=\"13\" text-anchor=\"middle\" fill=\"#3B7DD8\" font-weight=\"800\">' + String(rounds).repeat(30) + '</text>';" },
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'🍪 15 片餅乾平分給 3 個小朋友。<br>哪一種分法才是平分？',\n          opts:['4、5、6','5、5、5','3、5、7','6、6、3'], ans:1,\n          why:'平分就是每個人一樣多：5、5、5，加起來剛好 15 片。' }",
      replace:"        { stem:'🍪 15 片餅乾平分給 3 個小朋友。<br>哪一種分法才是平分？',\n          opts:['4、5、6','5、5、5','3、5、7','6、6、3'], ans:1,\n          why:'平分就是每個人一樣多：5、5、5，加起來剛好 15 片。' },\n        { stem:'🍬 4 顆糖果平分給 2 個小朋友。<br>每人幾顆？',\n          opts:['2 顆','1 顆','3 顆','4 顆'], ans:0, why:'2 × 2 ＝ 4，每人 2 顆。' }" },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'一包一包裝：3、6、9、12 —— 裝了 4 包。3 × 4 ＝ 12。'",
      replace:"why:'一包一包裝：3、6、9、12 —— 裝了 4 包。3 × 4 ＝ 13。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'一個一個輪流發，發 4 輪剛好發完，每人 4 個。4 × 3 ＝ 12。'",
      replace:"why:'一個一個輪流發，發四輪剛好發完，每人四個。'" },
    { file:'index', expect:"px tall but",
      find:"    var w = cols * size + 14, h = rows * size + 12;",
      replace:"    var w = cols * size + 14, h = 1;" },

    /* --- 小遊戲（2026-10-02 改版，§六之五）：每一條規則各自要有改壞版本 --- */
    /* 第 1 關：選太多也裝成一包 —— 包就不一樣多了 */
    { file:'index', expect:'a pick that is not exactly k is packed',
      find:"if (m !== e.k){ roundMiss(m < e.k ? d.gGroupFew(si, m, e.k) : d.gGroupMany(si, m, e.k)); return; }",
      replace:"if (m < e.k){ roundMiss(m < e.k ? d.gGroupFew(si, m, e.k) : d.gGroupMany(si, m, e.k)); return; }" },
    { file:'index', expect:'not a silent no-op',
      find:"        if (m === 0) return;   /* 沒選就按：什麼都不做，不算錯 */",
      replace:"        if (m === 0){ roundMiss(d.gGroupFew(si, 0, e.k)); return; }" },
    { file:'index', expect:'bags — the shelf holds 2~6',
      find:"{ si:1, n:12, k:2 }", replace:"{ si:1, n:14, k:2 }" },
    { file:'index', expect:'does not pack into whole bags',
      find:"{ si:0, n:12, k:4 }", replace:"{ si:0, n:13, k:4 }" },
    { file:'index', expect:'gGroupDone zh: numbers should read',
      find:"'剛好裝完，一共 ' + this.qtyGrp(si, b) + '。' + k + ' × ' + b + ' ＝ ' + n + '。'; },",
      replace:"'剛好裝完，一共 ' + this.qtyGrp(si, b) + '。' + b + ' × ' + b + ' ＝ ' + n + '。'; }," },
    { file:'index', expect:'overlaps the "picked" label',
      find:"  var GROUP_LBL = { y:104, h:22 }, GROUP_PILE = { y:156, step:50, rowStep:52, perRow:6 };",
      replace:"  var GROUP_LBL = { y:104, h:22 }, GROUP_PILE = { y:140, step:50, rowStep:52, perRow:6 };" },
    { file:'index', expect:'things 0 and 1 overlap',
      find:"  var GROUP_LBL = { y:104, h:22 }, GROUP_PILE = { y:156, step:50, rowStep:52, perRow:6 };",
      replace:"  var GROUP_LBL = { y:104, h:22 }, GROUP_PILE = { y:156, step:44, rowStep:52, perRow:6 };" },
    /* 第 2 關：不必輪流也收 */
    { file:'index', expect:'no round-robin',
      find:"if (pl.n > min){ roundMiss(d.gDealAhead(si, pl.n, min)); return false; }",
      replace:"if (pl.n > min + 1){ roundMiss(d.gDealAhead(si, pl.n, min)); return false; }" },
    { file:'index', expect:'plates — the board holds 2~4',
      find:"{ si:2, n:8, g:4 }", replace:"{ si:2, n:10, g:5 }" },
    { file:'index', expect:'between the child and the count',
      find:"  var DEAL_H = 290, DEAL_PLATE = { y:72, w:66, h:112, gap:8, step:20, top:28 },",
      replace:"  var DEAL_H = 290, DEAL_PLATE = { y:72, w:66, h:112, gap:8, step:20, top:40 }," },
    { file:'index', expect:'the nearest-box rule is never exercised',
      find:"  var DEAL_H = 290, DEAL_PLATE = { y:72, w:66, h:112, gap:8, step:20, top:28 },",
      replace:"  var DEAL_H = 290, DEAL_PLATE = { y:72, w:60, h:112, gap:14, step:20, top:28 }," },
    { file:'index', expect:'the dealing token is',
      find:"  var DEAL_TOKEN = { y:250, size:52 };", replace:"  var DEAL_TOKEN = { y:250, size:42 };" },
    { file:'index', expect:'gDealAhead en: numbers should read',
      find:"'This child already has ' + this.qtyItem(si, has) + ', but someone has only ' + this.qtyItem(si, min) + '. Take turns!'",
      replace:"'This child already has ' + this.qtyItem(si, has) + ', but someone has fewer. Take turns!'" },
    /* 第 3 關：把題目給的數字抄回來也收；單位不對也收 */
    { file:'index', expect:'a card with the given number, or with the wrong unit, is accepted',
      find:"if (c.n !== q){ roundMiss(", replace:"if (c.n !== q && c.n !== e.k){ roundMiss(" },
    { file:'index', expect:'a card with the given number, or with the wrong unit, is accepted',
      find:"if (c.u !== want){ roundMiss(", replace:"if (false){ roundMiss(" },
    { file:'index', expect:'equals the given number',
      find:"{ si:0, total:12, k:4 }, { si:1, total:10, k:2 }", replace:"{ si:0, total:16, k:4 }, { si:1, total:10, k:2 }" },
    { file:'index', expect:'the plate scene',
      find:"{ si:1, total:8, k:2 } ];", replace:"{ si:2, total:8, k:2 } ];" },
    { file:'index', expect:'does not fit a',
      find:"BOTH_CARD = { y:342, w:120, h:52, stepX:132, rowStep:56 };", replace:"BOTH_CARD = { y:342, w:68, h:52, stepX:132, rowStep:56 };" },
    { file:'index', expect:'between the question and the answer box',
      find:"  var BOTH_H = 428, BOTH_PANEL = { y:[0, 158], h:152, lblY:4, lblH:40, picY:70, slotY:96 };",
      replace:"  var BOTH_H = 428, BOTH_PANEL = { y:[0, 158], h:152, lblY:4, lblH:40, picY:80, slotY:96 };" },
    { file:'index', expect:'share ← ',
      find:"      gBothKShare:function(si, k){ return k + ' 是小朋友的人數，",
      replace:"      gBothKShare:function(si, k){ return '這個數是小朋友的人數，" },
    { file:'index', expect:'does not name both units',
      find:"'，可是一個是 ' + this.qtyGrp(si, q) + '，一個是每人 ' + this.qtyItem(si, q) + '。'; },",
      replace:"'，可是一個是 ' + this.qtyGrp(si, q) + '，一個是每人 ' + q + '。'; }," },
    /* 第 4 關：＝ 後面放別的、總數放進 × 旁邊、乘起來不對的數字卡 */
    { file:'index', expect:'something other than the total is accepted after the =',
      find:"if (s === res && v !== e.total){ roundMiss(", replace:"if (s === res && v === 'box'){ roundMiss(" },
    { file:'index', expect:'the total is accepted next to the ×',
      find:"if (s !== res && v === e.total){ roundMiss(", replace:"if (false){ roundMiss(" },
    { file:'index', expect:'whose product is not the total is accepted',
      find:"if (a * b !== e.total){ roundMiss(", replace:"if (a * b > e.total){ roundMiss(" },
    { file:'index', expect:'is not last in the target list',
      find:"      var all = [f0, f1, res];", replace:"      var all = [f0, res, f1];" },
    { file:'index', expect:'the □ equals the given',
      find:"{ kind:'share', si:1, total:18, k:3 }", replace:"{ kind:'share', si:1, total:9, k:3 }" },
    { file:'index', expect:'a centre-distance bug would go unnoticed',
      find:"EQ_RES = { x:152, w:138, eqW:34 };", replace:"EQ_RES = { x:152, w:60, eqW:0 };" },
    { file:'index', expect:'says more/less the wrong way',
      find:"(p > t ? '比 ' + t + ' 多' : '比 ' + t + ' 少')", replace:"(p < t ? '比 ' + t + ' 多' : '比 ' + t + ' 少')" },
    { file:'index', expect:'gEqDone en',
      find:"(e.kind === 'pack' ? (this.qtyGrp(e.si, ans) + ' can be filled') : (this.qtyItem(e.si, ans) + ' each')) + '.';",
      replace:"(e.kind === 'pack' ? (this.qtyGrp(e.si, ans) + ' can be filled') : (ans + ' each')) + '.';" },
    /* 第 5 關：跳「答案」那麼多也收（份數和每份的數搞反） */
    { file:'index', expect:'a jump that is not +k is accepted',
      find:"if (s !== e.k){ roundMiss(", replace:"if (s !== e.k && s !== ans){ roundMiss(" },
    { file:'index', expect:'are not all different',
      find:"{ kind:'share', si:2, total:12, k:4, x:2 }", replace:"{ kind:'share', si:2, total:12, k:4, x:3 }" },
    { file:'index', expect:'too dense to count',
      find:"var HOP_H = 200, HOP_LINE = { x0:18, x1:282,", replace:"var HOP_H = 200, HOP_LINE = { x0:18, x1:200," },
    { file:'index', expect:'wrong jump +',
      find:"，發一輪用掉 ' + this.qtyItem(si, k) + '，要跳 +' + k + '，不是 +' + s + '。'; },",
      replace:"，發一輪用掉 ' + this.qtyItem(si, k) + '，要跳 +' + k + '。'; }," },
    { file:'index', expect:'does not give every child one',
      find:"plates.forEach(function(pl){ addDot(pl.el, hopDotXY(jumps - 1), HP.dot); pl.num.textContent = jumps; });",
      replace:"plates.slice(1).forEach(function(pl){ addDot(pl.el, hopDotXY(jumps - 1), HP.dot); pl.num.textContent = jumps; });" },
    /* 共用：nearestOpen 取第一個／量中心、低年級扣星、提示、說明 */
    { file:'index', expect:'it takes the first match instead of the nearest',
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop 1px inside the result box goes to',
      find:"var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;", replace:"var dd = dx * dx + dy * dy, dc = dd;" },
    { file:'index', expect:'a drop on a finished',
      find:"    return best && !best.done ? best : null;", replace:"    return best;" },
    { file:'index', expect:'low grades never lose points',
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML", replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    { file:'index', expect:'gives 2 stars, should be 1',
      find:"    var stars = gMistakes === 0 ? 2 : 1;", replace:"    var stars = 2;" },
    { file:'index', expect:'ahead mode does not show hint level 1',
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"" },
    { file:'index', expect:'must say it is all taps',
      find:"        hop:'每一跳要跳多少？點按鈕往前跳。這一關用點的。'", replace:"        hop:'每一跳要跳多少？點按鈕往前跳。'" },
    { file:'index', expect:'gEq2b zh',
      find:"      gEq2b:function(k, t){ return '想九九乘法：' + k + ' × 幾 ＝ ' + t + '？'; },", replace:"      gEq2b:function(k, t){ return '想九九乘法。'; }," },
    { file:'index', expect:'a number card is 46 board px',
      find:"EQ_KEYS = { y:112, step:56, rowStep:62, size:GPICK };", replace:"EQ_KEYS = { y:112, step:56, rowStep:62, size:46 };" },
    /* codex 第一、二輪：英文少了單位或動詞 —— 改回舊的寫法要被抓到 */
    { file:'index', expect:'gDealAhead en does not say',
      find:"', but someone has only ' + this.qtyItem(si, min) + '. Take turns!'", replace:"', but someone has only ' + min + '. Take turns!'" },
    { file:'index', expect:'gDeal2 en does not say',
      find:"'Give the next one to a child who has only ' + this.qtyItem(si, min) + '.'", replace:"'Give the next one to a child who has only ' + min + '.'" },
    { file:'index', expect:'gGroup2 en does not say',
      find:"'You have picked ' + this.qtyItem(si, m) + '; pick '", replace:"'You have picked ' + m + '; pick '" },
    { file:'index', expect:'gDealProb en has no verb',
      find:"this.qtyThing(e.si, e.n) + ' are shared equally among '", replace:"this.qtyThing(e.si, e.n) + ' shared equally among '" },
    { file:'index', expect:'gEqProb en has no verb',
      find:"          : (this.qtyThing(e.si, e.total) + ' are shared equally among '", replace:"          : (this.qtyThing(e.si, e.total) + ' shared equally among '" },
    { file:'index', expect:'gHopProb en has no verb',
      find:"this.qtyThing(e.si, e.total) + ' are shared among '", replace:"this.qtyThing(e.si, e.total) + ' shared among '" },
    { file:'index', expect:'gBothShare en has no verb',
      find:"this.qtyThing(e.si, e.total) + ' go to ' + e.k + ' children.", replace:"this.qtyThing(e.si, e.total) + ' for ' + e.k + ' children." },
    { file:'index', expect:'the answer cards are not shuffled',
      find:"      shuffle(cards).forEach(function(c, i){", replace:"      cards.forEach(function(c, i){" },
  ],

  sim: {
    /* simgen 的通用「誘答抄題幹」檢查在這一課永遠不會響：選項是「4 包」，
       題幹的數字是「4」，字串比不到。所以「刻意把題幹的數字當誘答」這件事
       由每個產生器自己的不變條件把關（例如 unitPick 與 meaningOf 的 per ≠ g），
       這裡不需要白名單。 */
    stemEchoOk: {},

    INVARIANTS: {
      /* 分裝：知道每份幾個，要找幾份。正解的單位是「份」。 */
      packing: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.g > 6 ? 'packing draws at most 6 groups, got ' + d.g : null) ||
        (d.correct.u !== 'grp' ? 'the answer must be counted in groups' : null) ||
        base(d, 'grp#' + (d.total / d.per)),
      /* 平分：知道幾份，要找每份幾個。正解的單位是「個」。 */
      sharing: d => sceneOk(d) || productOk(d.total, d.q, d.n) || sizesOk(d.q, d.n) ||
        (d.n > 6 ? 'sharing uses at most 6 shares, got ' + d.n : null) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.total / d.n)),
      /* 分裝的算式：空格在後面（每份 × □ ＝ 總數）。 */
      packEq: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.correct.op !== 'mulBox' ? 'the packing sentence must be per × box = total' : null) ||
        /* 誘答不可以是「□ × 每份 ＝ 總數」—— 乘法可以交換，那也算得出答案。 */
        (d.opts.some(o => o.u === 'eq' && o.op === 'boxMul')
          ? 'box × per = total also solves it, so it cannot be a distractor' : null) ||
        eqDistractorsWrong(d, d.total / d.per) ||
        base(d, 'eq#mulBox'),
      /* 平分的算式：空格在前面（□ × 份數 ＝ 總數）。 */
      shareEq: d => sceneOk(d) || productOk(d.total, d.q, d.n) || sizesOk(d.q, d.n) ||
        (d.correct.op !== 'boxMul' ? 'the sharing sentence must be box × groups = total' : null) ||
        (d.opts.some(o => o.u === 'eq' && o.op === 'mulBox')
          ? 'per × box = total also solves it, so it cannot be a distractor' : null) ||
        eqDistractorsWrong(d, d.total / d.n) ||
        base(d, 'eq#boxMul'),
      /* 單位題：正解是份數，刻意放一個「同一個數字、錯的單位」的誘答。 */
      unitPick: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.per === d.g ? 'per must differ from the number of groups, otherwise the wrong-unit distractor is true too' : null) ||
        (d.correct.u !== 'grp' ? 'the answer must be counted in groups' : null) ||
        (!d.opts.some(o => o.u === 'item' && o.n === d.g)
          ? 'unitPick needs the same-number-wrong-unit distractor' : null) ||
        base(d, 'grp#' + (d.total / d.per)),
      /* 乘回去：每份幾個 × 幾份 ＝ 總數。 */
      totalCheck: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.per * d.g)),
      /* 排成幾排：等分除的另一種說法，正解是每排幾個。 */
      arrayRow: d => sceneOk(d) || productOk(d.total, d.c, d.r) || sizesOk(d.c, d.r) ||
        (d.r > 6 ? 'arrayRow uses at most 6 rows, got ' + d.r : null) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.total / d.r)),
      /* 這個數字是什麼意思：正解是「有 g 份」。 */
      meaningOf: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.per === d.g ? 'per must differ from the number of groups, otherwise the per-group phrase is true too' : null) ||
        (d.correct.p !== 'grpCount' ? 'the answer must be the group count' : null) ||
        base(d, 'phr#grpCount#' + (d.total / d.per)),
      /* 平分要一樣多：四種分法加起來都等於總數，只有一種是平分。 */
      equalCheck: d => {
        const bad = sceneOk(d);
        if (bad) return bad;
        if (d.total !== 3 * d.q) return 'total is not 3 shares of q (' + d.total + ' vs 3 × ' + d.q + ')';
        if (!(d.q >= 3 && d.q <= 9)) return 'each share must be 3~9, got ' + d.q;
        for (let i = 0; i < d.opts.length; i++){
          const o = d.opts[i];
          if (!o || o.u !== 'triple') return 'option ' + i + ' is not a three-way split';
          if (o.a + o.b + o.c !== d.total){
            return 'option ' + i + ' does not add up to the total (' + [o.a, o.b, o.c].join('+') + ' vs ' + d.total + ')';
          }
          if (!(o.a >= 1 && o.b >= 1 && o.c >= 1)) return 'a share must be at least 1 in option ' + i;
        }
        /* 只有一個選項可以是「三份一樣多」，不然就有兩個正確答案。 */
        const equalOnes = d.opts.filter(o => o.a === o.b && o.b === o.c);
        if (equalOnes.length !== 1) return 'exactly one option must be an equal split, found ' + equalOnes.length;
        return base(d, 'triple#' + d.q + ',' + d.q + ',' + d.q);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的情境表重算，
       完全不呼叫 review.html 的 valStr／qtyGrp —— 拿產生器自己的格式化函式來比
       等於自己比自己（2026-08-25 time 那一課的教訓）。 */
    expectedCorrect: function(d, genId, lang){
      const eq = lang === 'zh' ? ' ＝ ' : ' = ';
      switch (genId){
        case 'packing':    return fGrp(d.si, d.total / d.per, lang);
        case 'unitPick':   return fGrp(d.si, d.total / d.per, lang);
        case 'sharing':    return fItem(d.si, d.total / d.n, lang);
        case 'arrayRow':   return fItem(d.si, d.total / d.r, lang);
        case 'totalCheck': return fItem(d.si, d.per * d.g, lang);
        case 'packEq':     return d.per + ' × □' + eq + d.total;
        case 'shareEq':    return '□ × ' + d.n + eq + d.total;
        case 'meaningOf': {
          const g = d.total / d.per;
          return lang === 'zh' ? ('有 ' + fGrp(d.si, g, 'zh')) : (fGrp(d.si, g, 'en') + ' in total');
        }
        case 'equalCheck': {
          const q = d.total / 3;
          return lang === 'zh' ? (q + '、' + q + '、' + q) : (q + ', ' + q + ', ' + q);
        }
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀（單位種類）要是這個產生器允許的，數字要落在範圍裡，
       英文還要單複數一致。正解與誘答用同一組規則 —— 這一課沒有刻意寫錯的選項。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      /* 英文的單複數：2 個以上一定要用複數，1 個一定要用單數。
         「4 bag」看起來像小事，但它是「複數規則整條被拿掉」的唯一症狀。 */
      if (lang === 'en'){
        const m = t.match(/(\d+) ([a-z]+)/);
        if (m){
          const n = Number(m[1]), w = m[2];
          if (EN_SING.indexOf(w) >= 0 && n !== 1) return 'plural does not match the number: ' + t;
          if (EN_PLUR.indexOf(w) >= 0 && n === 1) return 'plural does not match the number: ' + t;
        }
      }
      const bounds = RANGE[genId] || [1, 81];
      const nums = (t.match(/\d+/g) || []).map(Number);
      if (!nums.length) return 'no number in option ' + t;
      for (const v of nums){
        if (!(v >= bounds[0] && v <= bounds[1])){
          return 'option ' + t + ' contains ' + v + ', outside ' + bounds[0] + '~' + bounds[1];
        }
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{SCENES, PACK_EX, SHARE_EX, BOTH_EX, EQ_CASES, itemsSVG, packSVG, shareSVG, ' +
      'GAME_W, GPICK, GPAD, GAME_ORDER, PILE_STEP, PILE_DOT, pileDotXY, ' +
      'GAME_GROUP, GROUP_H, GROUP_BAG, GROUP_LBL, GROUP_PILE, groupBagXY, bagDotXY, groupPileXY, ' +
      'GAME_SHARE, DEAL_H, DEAL_PLATE, DEAL_PILE, DEAL_TOKEN, dealPlateX, dealDotXY, ' +
      'GAME_BOTH, BOTH_H, BOTH_PANEL, BOTH_SLOT, BOTH_CARD, BOTH_MINI, bothBagW, bothPlateH, bothRowX, bothCardXY, ' +
      'GAME_EQ, EQ_H, EQ_PAD, EQ_SLOT, EQ_RES, EQ_CARD, EQ_KEYS, eqResCardX, eqKeyXY, ' +
      'GAME_HOP, HOP_H, HOP_LINE, HOP_PIC, HOP_PLATE, hopDotXY, hopX, hopPlateX, hopBagXY}',
    check: function(data, I18N, fail, src){
      const LANGS = ['zh','en'];

      /* --- 情境表：圖案（資料區）與單位詞（字典）用 si 對齊，兩邊長度一定要一樣 --- */
      if (data.SCENES.length !== 4) fail(`SCENES has ${data.SCENES.length} scenes; this lesson uses 4`);
      data.SCENES.forEach((s, i) => { if (!s.icon) fail(`SCENES[${i}] has no icon`); });
      LANGS.forEach(L => {
        const sc = I18N[L].scenes;
        if (!Array.isArray(sc) || sc.length !== data.SCENES.length){
          fail(`${L} scenes: ${(sc || []).length} entries but SCENES has ${data.SCENES.length}`);
          return;
        }
        sc.forEach((s, i) => {
          const t = SCENE_TRUTH[i] || { zh:{}, en:{} };
          /* 只驗「有沒有填」擋不住錯字：顆 → 棵、bag → sack 都會照樣通過，
             而後面每一條渲染檢查用的又是同一本字典 —— 等於自己比自己。
             所以每一個欄位都要跟設定檔的真值逐字比對。 */
          if (L === 'zh'){
            ['thing','item','grp'].forEach(k => {
              if (!s[k]) fail(`zh scenes[${i}] is missing ${k}`);
              else if (s[k] !== t.zh[k]) fail(`zh scenes[${i}].${k} is "${s[k]}", the checker expects "${t.zh[k]}"`);
            });
            /* 單位詞一樣的話，「4 包」和「4 顆」在畫面上就變成同一個字串 ——
               這一課刻意用「同一個數字、不同單位」當誘答，那時會出現兩個一樣的選項。 */
            if (s.item === s.grp) fail(`zh scenes[${i}]: the item unit and the group unit must differ (${s.item})`);
          } else {
            ['item','itemN','grp','grpN'].forEach(k => {
              if (!s[k]) fail(`en scenes[${i}] is missing ${k}`);
              else if (s[k] !== t.en[k]) fail(`en scenes[${i}].${k} is "${s[k]}", the checker expects "${t.en[k]}"`);
            });
            if (s.item === s.itemN) fail(`en scenes[${i}]: singular and plural must differ (${s.item})`);
            if (s.grp === s.grpN) fail(`en scenes[${i}]: singular and plural must differ (${s.grp})`);
            if (s.item === s.grp) fail(`en scenes[${i}]: the item unit and the group unit must differ (${s.item})`);
          }
        });
      });
      const sceneCount = data.SCENES.length;
      const siOk = (si, where) => {
        if (!Number.isInteger(si) || si < 0 || si >= sceneCount){
          fail(`${where}: scene index ${si} is outside 0~${sceneCount - 1}`);
        }
      };

      /* --- 範例 1：分裝。每份幾個是已知，份數是答案 --- */
      /* 每一個數量都必須是整數。只驗範圍與整除的話，total 12.5 / per 2.5 會整除、
         會落在範圍裡、字串也對得上 —— 一堂全整數的二年級課就這樣端出小數。 */
      const wholeOk = (where, obj, keys) => keys.forEach(k => {
        if (!Number.isInteger(obj[k])) fail(`${where}.${k} must be a whole number, got ${obj[k]}`);
      });
      const P = data.PACK_EX;
      siOk(P.si, 'PACK_EX');
      wholeOk('PACK_EX', P, ['total','per']);
      if (P.total % P.per !== 0) fail(`PACK_EX total is not a whole number of groups (${P.total} / ${P.per})`);
      const pg = P.total / P.per;
      if (!(P.per >= 2 && P.per <= 9)) fail(`PACK_EX per must be 2~9, got ${P.per}`);
      if (!(pg >= 2 && pg <= 6)) fail(`PACK_EX would need ${pg} bags; the picture holds 2~6`);
      LANGS.forEach(L => {
        const d = I18N[L];
        const start = d.p1Start(P), step = d.p1Step(P, 1, P.total - P.per), end = d.p1End(P, pg);
        [start, step, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`p1 ${L}: ${s}`); });
        if (start.indexOf(String(P.per)) < 0) fail(`p1Start ${L} never says how many go in each group`);
        if (step.indexOf(String(P.total - P.per)) < 0) fail(`p1Step ${L} never says how many are left`);
        if (end.indexOf(String(pg)) < 0) fail(`p1End ${L} never states the answer ${pg}`);
        /* 「有沒有印出總數」擋不住「算式整段被刪掉」—— 開頭的「12 顆糖果」裡本來就有 12。
           要驗的是算式的結果那一段（「＝ 12」／「= 12」）。 */
        const eqTail = (L === 'zh' ? ' ＝ ' : ' = ') + P.total;
        if (end.indexOf(eqTail) < 0) fail(`p1End ${L} never shows the full number sentence ending in "${eqTail}"`);
      });

      /* --- 圖的寬度：一開始（0 袋／0 輪）幾乎所有東西都還散在下面，
         只按袋子／盤子算寬度的話那一排會被整段切掉，孩子數到的總數就是錯的。
         這裡讀 SVG 真正吐出來的座標，不看樣式。 --- */
      /* 圖畫不畫得下 —— 實作在 tools/checks/lib/canvas.js（全站唯一一份）。
         ⚠️ 2026-09-02 之前這裡只驗**寬度**（當初那個事故是寬度的問題），
         所以一個 height="1" 的畫布可以通過所有幾何斷言（issue #2）。
         共用版本四個邊都驗，而且讀不到幾何、或碰到讀不懂的標籤都會回報 ——
         讀不到是「沒檢查」，不是「通過」。 */
      const widthOk = (label, svg) => {
        canvasProblems(svg).forEach(m => fail(`${label}: ${m}`));
      };
      /* 每一個孩子按得到的畫面都要驗，不只頭尾 —— 中間那幾格被切掉一樣是缺陷。 */
      for (let b = 0; b <= pg; b++) widthOk(`packSVG(${b} bags)`, data.packSVG(P.total, P.per, b, '🍬'));
      widthOk('itemsSVG', data.itemsSVG(P.total, '🍬'));

      /* --- 範例 2：平分。份數是已知，每份幾個是答案 --- */
      const S = data.SHARE_EX;
      siOk(S.si, 'SHARE_EX');
      wholeOk('SHARE_EX', S, ['total','n']);
      if (S.total % S.n !== 0) fail(`SHARE_EX total is not a whole number of shares (${S.total} / ${S.n})`);
      const sq = S.total / S.n;
      if (!(S.n >= 2 && S.n <= 4)) fail(`SHARE_EX draws 2~4 plates, got ${S.n}`);
      if (!(sq >= 2 && sq <= 9)) fail(`SHARE_EX gives ${sq} per plate; keep it 2~9`);
      LANGS.forEach(L => {
        const d = I18N[L];
        const start = d.p2Start(S), step = d.p2Step(S, 1, S.total - S.n), end = d.p2End(S, sq);
        [start, step, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`p2 ${L}: ${s}`); });
        if (start.indexOf(String(S.n)) < 0) fail(`p2Start ${L} never says how many children there are`);
        if (step.indexOf(String(S.total - S.n)) < 0) fail(`p2Step ${L} never says how many are left`);
        const unit = L === 'zh' ? I18N.zh.scenes[S.si].item : I18N.en.scenes[S.si].itemN;
        if (end.indexOf(sq + ' ' + unit) < 0) fail(`p2End ${L} never states the answer with its unit (${sq} ${unit})`);
      });

      for (let rd = 0; rd <= sq; rd++) widthOk(`shareSVG(${rd} rounds)`, data.shareSVG(S.total, S.n, rd, '🍎'));

      /* --- 範例 3：同一組數字、兩種問法。兩邊都要整除，答案的單位不一樣 --- */
      const B = data.BOTH_EX;
      siOk(B.si, 'BOTH_EX');
      wholeOk('BOTH_EX', B, ['total','k']);
      if (B.total % B.k !== 0) fail(`BOTH_EX total is not a whole number of groups (${B.total} / ${B.k})`);
      const bans = B.total / B.k;
      LANGS.forEach(L => {
        const d = I18N[L];
        ['pack','share'].forEach(kind => {
          const chip = d.bothChip(B, kind), b1 = d.b1(B, kind), b2 = d.b2(B, kind, bans), b3 = d.b3(B, kind, bans);
          [chip, b1, b2, b3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`both ${L}/${kind}: ${s}`); });
          if (kind === 'pack' && b2.indexOf(String(B.total)) < 0){
            fail(`b2 ${L}/pack never counts up to the total ${B.total}`);
          }
          const unit = kind === 'pack'
            ? (L === 'zh' ? I18N.zh.scenes[B.si].grp : I18N.en.scenes[B.si].grpN)
            : (L === 'zh' ? I18N.zh.scenes[B.si].item : I18N.en.scenes[B.si].itemN);
          if (b3.indexOf(bans + ' ' + unit) < 0){
            fail(`b3 ${L}/${kind} never states the answer with its unit (${bans} ${unit})`);
          }
          /* 這一段的重點就是「數字一樣、單位不一樣」，所以結語一定要提到那個數字兩次以上。 */
          if (b3.split(String(bans)).length - 1 < 2) fail(`b3 ${L}/${kind} should point out that the number is the same`);
        });
        if (d.b0(B).indexOf(String(B.k)) < 0) fail(`b0 ${L} never mentions the shared number ${B.k}`);
      });

      /* --- 範例 4：用乘法算式找答案 --- */
      let sawPack = false, sawShare = false;
      data.EQ_CASES.forEach((c, i) => {
        siOk(c.si, `EQ_CASES[${i}]`);
        wholeOk(`EQ_CASES[${i}]`, c, ['total','k']);
        if (c.kind !== 'pack' && c.kind !== 'share') fail(`EQ_CASES[${i}] has an unknown kind ${c.kind}`);
        if (c.kind === 'pack') sawPack = true; else sawShare = true;
        if (c.total % c.k !== 0) fail(`EQ_CASES[${i}] total is not a whole number of parts (${c.total} / ${c.k})`);
        const ans = c.total / c.k;
        if (!(ans >= 2 && ans <= 9)) fail(`EQ_CASES[${i}] answer ${ans} should be inside the times tables (2~9)`);
        if (!(c.k >= 2 && c.k <= 9)) fail(`EQ_CASES[${i}] k must be 2~9, got ${c.k}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const chip = d.eqChip(c), e1 = d.e1(c), e2 = d.e2(c), e3 = d.e3(c, ans), e4 = d.e4(c, ans);
          [chip, e1, e2, e3, e4].forEach(s => { if (/undefined|NaN/.test(s)) fail(`EQ_CASES[${i}] ${L}: ${s}`); });
          if (e2.indexOf('□') < 0) fail(`EQ_CASES[${i}] ${L}: e2 never shows the empty box`);
          if (e2.indexOf(String(c.total)) < 0) fail(`EQ_CASES[${i}] ${L}: e2 never prints the total`);
          if (e3.indexOf(String(ans)) < 0) fail(`EQ_CASES[${i}] ${L}: e3 never says what the box is`);
          const unit = c.kind === 'pack'
            ? (L === 'zh' ? I18N.zh.scenes[c.si].grp : I18N.en.scenes[c.si].grpN)
            : (L === 'zh' ? I18N.zh.scenes[c.si].item : I18N.en.scenes[c.si].itemN);
          if (e4.indexOf(ans + ' ' + unit) < 0){
            fail(`EQ_CASES[${i}] ${L}: e4 never states the answer with its unit (${ans} ${unit})`);
          }
        });
      });
      if (!sawPack) fail('EQ_CASES needs a packing case');
      if (!sawShare) fail('EQ_CASES needs an equal-sharing case');

      /* --- 小遊戲（五關五種玩法）：見檔案上方的 gameCheck() --- */
      gameCheck(data, I18N, fail, src);

      /* --- 三層題庫的神諭表 ---
         每一題記三件事，而且都跟題目本身分開維護：
         - nums：題幹裡「一定要出現」的數字（中英都驗）。少了這一條，把題幹的
           12 改成 13、答案還留著「4 包」，每一條檢查都會是綠的。
         - rel：從 nums 把答案「算出來」的方式，不是抄答案。
         - optRe：這一題四個選項各自該長什麼樣。只驗正解的話，把某個誘答換成
           「banana」也不會有人發現。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[12,3], rel:'groups', zh:'4 包',  en:'4 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[12,3], rel:'per',    zh:'4 個',  en:'4 apples',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ apples?$/ } },
          { nums:[5,4],  rel:'total',  zh:'20 片', en:'20 biscuits',
            optRe:{ zh:/^\d+ 片$/, en:/^\d+ biscuits?$/ } },
          /* 這一題刻意混單位（同一個數字、錯的單位），所以兩種形狀都放行。 */
          { nums:[20,5], rel:'groups', zh:'4 包',  en:'4 bags',
            optRe:{ zh:/^\d+ (?:包|顆)$/, en:/^\d+ (?:bags?|sweets?)$/ } },
          { nums:[18,6], rel:'eq',     zh:'6 × □ ＝ 18', en:'6 × □ = 18',
            optRe:{ zh:/^(?:\d+ (?:×|＋|－) □ ＝ \d+|\d+ × \d+ ＝ □)$/,
                    en:/^(?:\d+ (?:×|\+|−) □ = \d+|\d+ × \d+ = □)$/ } },
          { nums:[15,3], rel:'triple', zh:'5、5、5', en:'5, 5, 5',
            optRe:{ zh:/^\d+、\d+、\d+$/, en:/^\d+, \d+, \d+$/ } }
        ],
        qsAdv: [
          { nums:[24,4], rel:'groups', zh:'6 包', en:'6 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[30,5], rel:'per',    zh:'6 個', en:'6 apples',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ apples?$/ } },
          { nums:[12,2,6], rel:'twostep', zh:'4 片', en:'4 biscuits',
            optRe:{ zh:/^\d+ 片$/, en:/^\d+ biscuits?$/ } },
          { nums:[28,7], rel:'phrase', zh:'一共有 4 盒', en:'4 boxes in total',
            optRe:{ zh:/^(?:每盒 \d+ 枝|一共有 \d+ 盒)$/,
                    en:/^(?:\d+ pencils? in each box|\d+ boxes? in total)$/ } }
        ],
        qsBoost: [
          { nums:[20,4], rel:'groups', zh:'5 包', en:'5 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[18,3,6], rel:'meaning', zh:'有 3 個小朋友', en:'there are 3 children',
            optRe:{ zh:/^(?:每人分到 \d+ 片|有 \d+ 個小朋友|一共 \d+ 片|剩下 \d+ 片)$/,
                    en:/^(?:each child gets \d+ biscuits?|there are \d+ children|\d+ biscuits? altogether|\d+ biscuits? left over)$/ } }
        ]
      };
      /* 答案是算出來的，不是抄的。 */
      const ansFor = (rel, n) => {
        if (rel === 'groups' || rel === 'per' || rel === 'phrase' || rel === 'triple') return n[0] / n[1];
        if (rel === 'total') return n[0] * n[1];
        if (rel === 'twostep') return n[0] * n[1] / n[2];
        if (rel === 'meaning') return n[1];
        return NaN;
      };
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次。只比中文的話，刪掉最後一題英文題目時中文長度還是對的，
           而英文那一圈 forEach 會少跑一題 —— 那一題和它的選項就整個沒被驗到。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            /* ans 先驗合法，否則 q.opts[q.ans] 會是 undefined，接下來的檢查
               都在比對 undefined —— 整題沒被驗到卻是綠的。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。
               只驗「有沒有出現」擋不住「題幹多塞一個 13」——
               12 和 3 還在，答案照樣重算成 4，整題就這樣蒙過去。
               範圍說清楚：這一條只看**阿拉伯數字**。這一課每一個運算元都是
               阿拉伯數字，所以夠用；但如果哪天有人把數量寫成「七個梨子」或
               “seven pears”，這一條抓不到（中文數字沒辦法一律當數量看 ——
               「一共」「一盒」「一樣多」裡的「一」就不是）。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            const stemNums = [...new Set((plain.match(/\d+/g) || []).map(Number))];
            stemNums.forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ')})`);
              }
            });
            /* 2. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 3. 神諭寫下的字串本身要能從 nums 重算出來。 */
            if (o.rel === 'eq'){
              const eqWant = o.nums[1] + (L === 'zh' ? ' × □ ＝ ' : ' × □ = ') + o.nums[0];
              if (want !== eqWant) fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not "${eqWant}"`);
            } else if (o.rel === 'triple'){
              const v = ansFor('triple', o.nums);
              const tWant = L === 'zh' ? [v, v, v].join('、') : [v, v, v].join(', ');
              if (want !== tWant) fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not "${tWant}"`);
            } else {
              const v = ansFor(o.rel, o.nums);
              if (!Number.isInteger(v)){
                fail(`${bank}[${i}]: ${o.nums.join(' / ')} does not give a whole-number answer`);
              } else if (!hasNum(want, v)){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain ${v}, recomputed from ${o.nums.join(' / ')}`);
              }
              if (o.rel === 'meaning' && o.nums[0] / o.nums[1] !== o.nums[2]){
                fail(`${bank}[${i}]: the stem's own numbers are inconsistent (${o.nums.join(' / ')})`);
              }
            }
            /* 4. 每一個選項的形狀與數字範圍 —— 誘答也要驗，不只是正解。 */
            const re = L === 'zh' ? o.optRe.zh : o.optRe.en;
            q.opts.forEach(opt => {
              if (!re.test(opt)){
                fail(`${bank}[${i}] ${L}: option "${opt}" does not look like an answer to this question`);
              }
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= 40)) fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~40`);
              });
            });
            /* 5. 選項字串兩兩不同（含空白正規化的版本）。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
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
                    const r = arithDivide(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 20) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 20`);
            if (qSum !== 4) fail(`question-shaped equations changed: found ${qSum}, expected 4`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithDivide.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithDivide.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithDivide.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== 'a3c2f6a74ecf'){
                fail(`the set of verified equations changed (digest ${digest}, expected a3c2f6a74ecf)\n      now: ${list.join(' | ')}`);
              }
            }
          }

    }
  }
};
