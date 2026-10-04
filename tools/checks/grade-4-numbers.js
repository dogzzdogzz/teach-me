/* grade-4/math/numbers（大數：萬、十萬、百萬、千萬、億）的檢查設定。

   範圍取自課程自己說的話：`index.html` 的資料區寫著「這一課的數字最多九位數
   （到 9 億多）」，`parents.html` 也對家長講了同一句，所以上限是 999999999，
   不是隨手給一個寬鬆的大數。

   這一課有兩個別課沒有的守門重點：
   ① **位名一律從右邊數起** —— 課程、速查卡、家長頁三頁都在教這條規則，
      產生器的題幹與解釋也靠它。所以位名表在這裡再寫一份（真值表），
      拿去和字典逐字比對；拿字典比字典等於自己比自己。
   ② **中文讀法** —— `toChineseBig()` 是這一課唯一「會算出一串字」的函式。
      神諭必須把它**跑起來**（每一個 READ_NUMS ＋ 三條補零規則的邊界），
      而期望值是手寫的，不是讓它自己回答自己。 */

const MAXN = 999999999;          // 九位數，課程自己宣告的上限
const P = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000];

/* 位名真值表（index 0 ＝ 個位）—— 和 index.html／review.html 的字典各自獨立。 */
const PLACES = {
  zh: ['個位','十位','百位','千位','萬位','十萬位','百萬位','千萬位','億位'],
  en: ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions']
};
/* 「幾個X」用的單位詞真值表。 */
const UNITS = {
  zh: ['一','十','百','千','萬','十萬','百萬','千萬','億'],
  en: ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions']
};

/* 中文讀法的期望值：**手寫**，不是從 toChineseBig 抄回來的。
   前五筆是 READ_NUMS（畫面上真的會出現的），後面是補零三條規則的邊界：
   ① 億級有值＋萬級不滿 1000 → 零   ② 億級有值＋萬級整節是 0 → 零
   ③ 上面有值＋個級不滿 1000 → 零   ＋「十」與「一十」的分界。 */
const READ_EXPECTED = {
  350020:    '三十五萬零二十',
  30040000:  '三千零四萬',
  100010000: '一億零一萬',
  60000700:  '六千萬零七百',
  90000000:  '九千萬',
  /* --- 邊界 --- */
  0:         '零',
  5:         '五',
  10:        '十',
  15:        '十五',
  115:       '一百一十五',
  1015:      '一千零一十五',
  3005:      '三千零五',
  10000:     '一萬',
  100000:    '十萬',
  150000:    '十五萬',
  1150000:   '一百一十五萬',
  1000000:   '一百萬',
  10000000:  '一千萬',
  100000000: '一億',
  100000001: '一億零一',
  100001000: '一億零一千',
  100200000: '一億零二十萬',
  120000000: '一億二千萬',
  123456789: '一億二千三百四十五萬六千七百八十九',
  305040000: '三億零五百零四萬',
  400300000: '四億零三十萬',
  400030000: '四億零三萬',
  47530000:  '四千七百五十三萬',
  999999999: '九億九千九百九十九萬九千九百九十九'
};

/* 每個產生器的選項範圍。沒列到的走預設 1~MAXN。
   digitOf 問的是「某一位的數字」，答案與誘答都只能是 0~9；
   howManyWan 問的是「幾個萬」，最多 99999 個（因為整個數最多九位）；
   unitSwap 問的是「幾個小一格的單位」，1~9 換過去最多 90。 */
const RANGE = { digitOf: [0, 9], howManyWan: [1, 99999], unitSwap: [1, 1000] };

/* 從 n 直接挖出第 pos 位的數字（不看產生器留下的 digs）。 */
function digitAt(n, pos){ return Math.floor(n / P[pos]) % 10; }

const fs = require('fs');
const path = require('path');

/* 三層題庫的第二套實作（codex 審查 #1）。`verify_lesson_data.js` 內建的算術重算
   只認得「a ＋ b ＝ ?」那種題幹，這一課一題都不符合 —— 也就是說在這之前，
   把 ans:2 改成 ans:0 是**完全不會被抓到**的。
   每一題記兩件事：題幹裡一定要出現的數字（位置式神諭擋不住「把 47530000 改成
   47531000」），以及**從那些數字重算一次**的正解字串。 */
/* 從題幹把「數字＋單位」的組合抓出來（中文「N 個X」，英文「N X」）。
   單位詞互為子字串（萬 ⊂ 十萬、millions ⊂ hundred-millions），所以由長到短掃，
   抓到就把那一段挖掉，避免同一個數字被兩個單位重複認領。 */
function unitPairs(stem, L){
  const order = UNITS[L].map((w, i) => ({ w:w, i:i }))
                        .sort((a, b) => b.w.length - a.w.length);
  let rest = stem;
  const found = [];
  order.forEach(u => {
    /* 邊界：中文的「3 個萬位數字」裡的「萬」是位名不是單位，所以單位後面
       不可以緊接著「位」；英文要求單位後面是非字母（第三輪 codex #5）。 */
    const pat = L === 'zh' ? '(\\d+)\\s*個' + u.w + '(?!位)'
                           : '(\\d+)\\s+' + u.w.replace(/-/g, '\\-') + '(?![A-Za-z-])';
    const re = new RegExp(pat);
    let m;
    while ((m = rest.match(re))){
      const at = rest.indexOf(m[0]);
      found.push({ at:at, count:Number(m[1]), unit:u.i });
      rest = rest.slice(0, at) + ' '.repeat(m[0].length) + rest.slice(at + m[0].length);
    }
  });
  return found.sort((a, b) => a.at - b.at).map(f => [f.count, f.unit]);
}

/* 「哪一個最大／最小」的方向也要從題幹讀 —— 不然把題幹的「最大」改成「最小」，
   神諭還是照樣算最大值（第二輪 codex #2）。 */
function directionFromStem(stem, L){
  const big = (L === 'zh') ? '最大' : 'biggest';
  const small = (L === 'zh') ? '最小' : 'smallest';
  const hasBig = stem.indexOf(big) >= 0, hasSmall = stem.indexOf(small) >= 0;
  if (hasBig === hasSmall) return null;      // 兩個都有或都沒有 → 題幹不明確
  /* 否定句會把意思整個翻過來（「哪一個不是最大？」），關鍵字卻還在
     —— 判為不明確，讓它響（第三輪 codex #6）。 */
  if (/不是|沒有/.test(stem) || /\bnot\b/i.test(stem)) return null;
  return hasBig ? 'max' : 'min';
}

const BANK_EXPECTED = {
  qs: [
    { nums:[47530000], zh:'3',        en:'3',        calc: n => String(digitAt(n[0], 4)) },
    { nums:[7, 6],     zh:'76000000', en:'76000000', calc: n => String(n[0] * P[7] + n[1] * P[6]) },
    { nums:[350000],   zh:'35',       en:'35',       calc: n => String(n[0] / 10000) },
    /* 「1 億等於幾個萬」：中文題幹只印得出 1，所以常數寫在這裡，
       但仍然是獨立算的（10^8 ÷ 10^4），不是從課程抄回來的。 */
    /* 兩種語言的題幹都印出 100000000，所以從題幹的那個數重算。
       在這之前這裡是一個常數，把題幹改成「1 百萬等於幾個萬」也不會響。 */
    { nums:[1, 100000000], zh:'10000', en:'10000',  calc: n => String(Math.max.apply(null, n) / P[4]) },
    /* 「哪一個最大」：方向從題幹讀，值從選項重算。兩邊都不是寫死的。 */
    { nums:[],         zh:'10000000', en:'10000000', byDirection:true },
    { nums:[45002000, 45020000], zh:'萬位', en:'ten-thousands',
      calc: (n, L) => {
        const a = String(n[0]), b = String(n[1]);
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return PLACES[L][a.length - 1 - i];
        return 'no difference';
      } }
  ],
  qsAdv: [
    { nums:[2450000, 1550000], zh:'400', en:'400', calc: n => String((n[0] + n[1]) / 10000) },
    { nums:[3, 4], zh:'340000000', en:'340000000', calc: n => String(n[0] * P[8] + n[1] * P[7]) },
    { nums:[10000, 68, 3500], zh:'683500', en:'683500', calc: n => String(n[1] * n[0] + n[2]) },
    /* 兩個「數量＋單位」都從題幹解析出來再比大小；標籤是那三個選項的字面值。
       在這之前單位是寫死的，把題幹的「5 個百萬」改成「5 個億」也不會響。 */
    { nums:[5, 60], zh:'乙數', en:'B', compareUnits:true,
      labels:{ A:{ zh:'甲數', en:'A' }, B:{ zh:'乙數', en:'B' },
               EQ:{ zh:'一樣大', en:'They are equal' } } },
  ],
  qsBoost: [
    { nums:[30040000], zh:'0', en:'0', calc: n => String(digitAt(n[0], 5)) },
    { nums:[3, 30], zh:'一樣大', en:'They are the same', compareUnits:true,
      labels:{ A:{ zh:'3 個十萬比較大', en:'3 hundred-thousands is bigger' },
               B:{ zh:'30 個萬比較大',  en:'30 ten-thousands is bigger' },
               EQ:{ zh:'一樣大', en:'They are the same' } } }
  ]
};

/* 速查卡與家長頁在這之前**一條斷言都沒有**（codex 審查 #2）——
   三頁都在教「位名從右邊數起」，可是只有上課頁被驗過。
   這兩張表釘的是「規則的措辭」與「位名表的順序」。 */
const SIBLING_RULES = {
  'reference.html': {
    /* [文字, 至少要出現幾次]。中文字串在這些頁面上一定出現兩次 —— markup 的
       fallback 一次、字典一次。只要求「至少一次」的話，改掉其中一份仍然是綠的，
       而畫面上第一眼看到的正是 markup 那一份。 */
    must: [['位名一律從右邊數起', 2], ['從右邊數第幾位', 2],
           ['位名從右邊數，不是從左邊', 2], ['from the right', 1],
           ['從右邊每四位切一刀', 2],
           /* 第一輪審查修好的化聚規則 —— 「整個數 ÷ 10000」在除不盡時是假的，
              現在寫的是「商就是幾個萬」。誰在盯它？這一條。 */
           ['商就是幾個萬', 2], ['商就是幾個千', 2], ['the quotient is the count', 2]],
    forbid: ['位名從左邊數', '從左邊數第幾位', '位名一律從左邊數起'],
    /* 位名表在速查卡上是九個 td，順序必須由高到低。 */
    orderedZh: ['億位','千萬位','百萬位','十萬位','萬位','千位','百位','十位','個位']
  },
  'parents.html': {
    must: [['位名一律從右邊數起', 2],
           ['place names are always counted from the right', 1],
           ['從右邊每四位切成一節', 2],
           /* 第一輪審查修好的範圍聲明 —— 數線那一段確實會算「最靠近的整千萬」，
              所以這一頁不能再說「不教四捨五入取概數」，只能說不教它的算則。 */
           ['不教四捨五入取概數的算則', 2],
           ['does not cover the rounding procedure', 1]],
    forbid: ['位名一律從左邊數起', 'counted from the left',
             '不教四捨五入取概數，也不教', 'does not cover rounding, and does not cover'],
    orderedZh: null
  }
};

/* ================= 小遊戲「大數城市闖關」（§六之五，2026-10-04 改版） =================
   舊版「大數城市點名」是五題選擇題；新版五關五種玩法：填位值、切一節、蓋一蓋、排大小、放數線。
   這一段的原則（和三年級 numbers／divide 的設定檔一樣）：
     - 每一關**照遊戲的規則把每一題玩一遍**，證明一定解得完、解完一定是對的答案；
     - 每一句說明逐個比數字，而且那句話的理由要真的成立（「沒有說到十萬位」時說明裡真的沒有十萬）；
     - 版面與觸控 ≥ 44px 從 index.html 的資料區讀，不另抄一份數字；
     - nearestOpen()、roundMiss()、shuffle() 從原始碼切出來真的跑；
     - 中文讀法用這裡自己的一套（myZhBig）比，不拿課程的 toChineseBig() 比它自己。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

/* 自己的中文讀法（0 ~ 999999999）：四位一節，節和節之間補零 */
const ZD = ['零','一','二','三','四','五','六','七','八','九'];
function zh4(x, first){
  const u = ['千','百','十',''], ds = [Math.floor(x / 1000), Math.floor(x / 100) % 10, Math.floor(x / 10) % 10, x % 10];
  let s = '', gap = false, seen = false;
  for (let i = 0; i < 4; i++){
    if (ds[i] === 0){ if (seen) gap = true; continue; }
    if (gap) s += '零';
    gap = false;
    s += (i === 2 && ds[i] === 1 && first && !seen) ? '十' : ZD[ds[i]] + u[i];
    seen = true;
  }
  return s;
}
function myZhBig(n){
  const secs = [[Math.floor(n / 1e8), '億'], [Math.floor(n / 1e4) % 1e4, '萬'], [n % 1e4, '']];
  let out = '', zero = false;
  secs.forEach(([v, u]) => {
    if (v === 0){ if (out) zero = true; return; }
    if (out && (zero || v < 1000)) out += '零';
    out += zh4(v, !out) + u;
    zero = false;
  });
  return out || '零';
}
const nums = t => (String(t).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
/* 「a ÷ b ＝ c」逐條重算（蓋一蓋的結論句） */
function scanDiv(t){
  const out = [], re = /(\d+)\s*÷\s*(\d+)\s*[＝=]\s*(\d+)/g;
  let m;
  while ((m = re.exec(String(t)))) out.push({ text:m[0], bad:Math.floor(+m[1] / +m[2]) === +m[3] && +m[1] % +m[2] === 0 ? null : 'is not exact' });
  return out;
}

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = 300;
  const isInt = Number.isInteger;
  const dig = (n, p) => Math.floor(n / Math.pow(10, p)) % 10;
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    const got = nums(text).join();
    if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
  };
  const has = (where, text, word) => { if (String(text).indexOf(word) < 0) fail(where + ': should say "' + word + '": ' + text); };
  const hasNot = (where, text, word) => { if (String(text).indexOf(word) >= 0) fail(where + ': should not say "' + word + '": ' + text); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const noneHit = (a, list, what) => list.forEach((b, i) => { if (hit(a, b)) fail(what + ' overlaps #' + i); });
  const PLZ = I18N.zh.places, PLE = I18N.en.places;

  /* --- 0. 自己的工具先證明會響 --- */
  [[350020, '三十五萬零二十'], [100010000, '一億零一萬'], [100001000, '一億零一千'], [60000700, '六千萬零七百'], [123456789, '一億二千三百四十五萬六千七百八十九'],
   [305040000, '三億零五百零四萬'], [10000000, '一千萬'], [150000, '十五萬'], [1015, '一千零一十五'], [700012345, '七億零一萬二千三百四十五']].forEach(([n, w]) => {
    if (myZhBig(n) !== w) fail('myZhBig() self-test: ' + n + ' should read ' + w + ', got ' + myZhBig(n));
  });
  /* 自己的讀法也要和課程的讀法在一大片範圍裡一樣（READ_EXPECTED 只有十幾個手寫的點） */
  {
    let bad = 0, first = '';
    for (let n = 1; n <= 999999999; n += (n < 20000 ? 7 : n < 2e6 ? 997 : 99991)){
      if (D.toChineseBig(n) !== myZhBig(n)){ bad++; if (!first) first = n + ': ' + D.toChineseBig(n) + ' / mine ' + myZhBig(n); }
    }
    if (bad) fail('toChineseBig() and the config’s own reading disagree on ' + bad + ' numbers, e.g. ' + first);
  }
  [['35000000 ÷ 10000 ＝ 3500', true], ['35000000 ÷ 10000 ＝ 350', false], ['350000 ÷ 1000 = 350', true]].forEach(([t, good]) => {
    const r = scanDiv(t);
    if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanDiv() self-test: "' + t + '"');
  });

  /* --- 1. 五關的順序、每一關的題目與提示 --- */
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  const TYPES = ['place', 'cut', 'cover', 'sort', 'line'];
  const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
  if (order === undefined) fail('cannot find GAME_ORDER in index.html');
  else if (order.split(',').map(x => x.trim().replace(/^'|'$/g, '')).join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the five examples), got ' + order);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  ['GAME_PLACE', 'GAME_CUT', 'GAME_COVER', 'GAME_SORT', 'GAME_LINE'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries');
  });
  for (let n = 1; n < 999999999; n += 7777777) for (let p = 0; p < 9; p++) if (D.placeDigit(n, p) !== dig(n, p)){ fail('placeDigit(' + n + ', ' + p + ') should be ' + dig(n, p)); break; }
  [1, 9, 10, 99999, 100000, 99999999, 100000000, 999999999].forEach(n => { if (D.digitCount(n) !== String(n).length) fail('digitCount(' + n + ')'); });

  /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
  const scale = Math.min(1.5, 290 / W);
  const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  tooSmall('GPICK ' + D.GPICK, D.GPICK);
  [['a digit card', D.PLACE_KEYS.size], ['a cut (w)', D.CUT_TAG.w], ['a cut (h)', D.CUT_TAG.h], ['the 🙈 knob', D.COVER_KNOB.size],
   ['a sort card (w)', D.SORT_SLOT.w], ['a sort card (h)', D.SORT_SLOT.h], ['a number-line card (w)', D.LINE_CARD.w], ['a number-line card (h)', D.LINE_CARD.h]].forEach(([w, s]) => {
    tooSmall(w + ' (' + s + ')', s); if (s < D.GPICK) fail(w + ' of size ' + s + ' is smaller than GPICK ' + D.GPICK);
  });
  tooSmall('a place box with its pad (h)', D.PLACE_SLOT.h + 2 * D.PLACE_SLOT.pad);
  tooSmall('a place box with its pad (w)', D.PLACE_SLOT.w + 2 * D.PLACE_SLOT.pad);
  need('place', /addPiece\(B, \{ w:PLACE_KEYS\.size, h:PLACE_KEYS\.size, cx:kxy\.x, cy:kxy\.y,/, 'the digit cards are not PLACE_KEYS.size at placeKeyXY()');
  need('cut', /addPiece\(B, \{ w:CUT_TAG\.w, h:CUT_TAG\.h, cx:CUT_TAG\.x\[i\], cy:CUT_TAG\.y,/, 'the cuts are not CUT_TAG');
  need('cover', /addPiece\(B, \{ w:KB\.size, h:KB\.size, cx:R, cy:KB\.y,/, 'the knob is not COVER_KNOB.size at the right end');
  need('sort', /addPiece\(B, \{ w:SS\.w, h:SS\.h, cx:SORT_TRAY\.x, cy:SS\.y\[i\],/, 'the cards are not the size of a box');
  need('line', /addPiece\(B, \{ w:LC\.w, h:LC\.h, cx:x0 \+ i \* LINE_TRAY\.step, cy:LINE_TRAY\.y,/, 'the cards are not LINE_CARD');
  [['place', 'PLACE_H'], ['cut', 'CUT_H'], ['cover', 'COVER_H'], ['sort', 'SORT_H'], ['line', 'LINE_H']].forEach(([k, h]) => need(k, new RegExp('makeBoard\\(300, ' + h + '\\)'), 'board is not 300 × ' + h));

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
    /* nums() 不看正負號：「+20」「−5」的符號要另外驗（codex 第一輪） */
    if (!/\+\s*20/.test(I18N[L].gPts(20)) || /[−-]\s*20/.test(I18N[L].gPts(20))) fail('gPts ' + L + ': the points for a round should read +20: ' + I18N[L].gPts(20));
    if (!/^[−-]\s*5\b/.test(I18N[L].gMinus)) fail('gMinus ' + L + ': a mistake should read −5: ' + I18N[L].gMinus);
    if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score');
    if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
  });
  /* 拿著積木時重新開始／切換語言：舊畫板的積木放開不可以作用在新的一關（二年級 length 的 codex 第一輪） */
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/if \(gen !== gGen\) return;/.test(src) || !/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src))
    fail('a piece held across Restart / language switch is not tied to its board (gen / gGen guard missing)');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('no lostpointercapture safety on pieces');
  if (!/if \(!start \|\| e\.pointerId !== pid\) return;\n      start = null; pid = null;/.test(src)) fail('a second finger can end the drag (pointerId not checked)');

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
    if (nearestOpen){
      const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
      const r0 = nearestOpen(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const adj = [ { id:0, cx:100, cy:100, hw:15, hh:40, done:false }, { id:1, cx:130, cy:100, hw:15, hh:40, done:false } ];
      const r1 = nearestOpen(adj, { x:116, y:100 }, 4);
      if (!r1 || r1.id !== 1) fail('nearestOpen(): a point just inside the second box (still in the first one’s pad) goes to the first — it takes the first match');
      const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
    }
  }
  const runNearest = (list, pt, pad) => nearestOpen ? nearestOpen(list, pt, pad) : null;

  /* --- 托盤題庫的形狀先驗（codex 第一輪：不是陣列的一題會讓下面的 shuffle 測試直接當掉，印不出 [FAIL]） --- */
  const poolOk = (set, k) => Array.isArray(set) && set.length === k && set.every(v => isInt(v));
  [['GAME_SORT', 4], ['GAME_LINE', 3]].forEach(([name, k]) => (Array.isArray(D[name]) ? D[name] : []).forEach((set, i) => {
    if (!poolOk(set, k)) fail(name + '[' + i + '] ' + JSON.stringify(set) + ' should be an array of ' + k + ' whole numbers');
  }));
  /* --- shuffle()：托盤一開始不可以已經由小到大；切出來跑 --- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    const up = a => a.every((v, k) => k === 0 || a[k - 1] < v);
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else {
      let calls = 0, sh = null;
      const fake = { random:() => { if (++calls > 100) throw new Error('shuffle() keeps asking for random numbers — it may never return'); return 0.9999; }, floor:Math.floor };
      try { sh = new Function('Math', fsrc + '\nreturn shuffle;')(fake); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); }
      if (sh){
        let first = [9876543, 35002000, 35020000, 100010000];
        try { first = sh(first); } catch (e){ fail(e.message); }
        if (first.slice().sort((a, b) => a - b).join() !== '9876543,35002000,35020000,100010000') fail('shuffle() is not a permutation: ' + first.join());
        if (up(first)) fail('shuffle(): the tray can come out already sorted from smallest to biggest — the sort round would be done before it starts');
        const real = new Function(fsrc + '\nreturn shuffle;')();
        D.GAME_SORT.concat(D.GAME_LINE).filter(set => Array.isArray(set) && set.every(v => isInt(v))).forEach(set => {
          const sorted = set.slice().sort((a, b) => a - b), seen = set.map(() => new Set());
          for (let k = 0; k < 2000; k++){
            const o = real(sorted);
            if (up(o)){ fail('shuffle(): ' + set.join('/') + ' came out already sorted'); break; }
            o.forEach((v, pos) => seen[pos].add(v));
          }
          if (seen.some(x => x.size < 2)) fail('shuffle(): a tray position always holds the same card for ' + set.join('/'));
        });
      }
    }
  }

  /* ================= 第 1 關：填位值（範例 1） ================= */
  {
    const S = D.PLACE_SLOT, G = D.PLACE_GRP, LB = D.PLACE_LBL, H = D.PLACE_H;
    /* 幾何：個級在下排、萬級在上排、同一位對齊；億位在萬級左邊、多空一點；由右往左位序變大 */
    const ys = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(p => D.placeSlotY(p)), xs = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(p => D.placeSlotX(p));
    if (!(ys[0] === ys[1] && ys[1] === ys[2] && ys[2] === ys[3] && ys[4] === ys[5] && ys[5] === ys[6] && ys[6] === ys[7] && ys[7] === ys[8] && ys[4] < ys[0]))
      fail('place: the ten-thousands group (and hundred-millions) should be one row above the ones group: ' + ys.join());
    for (let p = 1; p < 9; p++) if (p !== 4 && !(xs[p] < xs[p - 1])) fail('place: place ' + p + ' is not left of place ' + (p - 1) + ' (place names count from the right)');
    for (let p = 4; p < 8; p++) if (!near(xs[p], xs[p - 4])) fail('place: place ' + p + ' is not right above place ' + (p - 4));
    if (!(xs[7] - xs[8] > S.pitch)) fail('place: the hundred-millions box has no gap from the ten-millions box — the groups would look like one');
    const boxes = xs.map((x, p) => sq(x, ys[p], S.w, S.h));
    boxes.forEach((b, p) => inside(b, 'place: box ' + p, H));
    noHits(boxes, 'place: boxes');
    const lbls = xs.map((x, p) => ({ x:x - S.pitch / 2, y:ys[p] - S.h / 2 - LB.gap - LB.h, w:S.pitch, h:LB.h }));
    lbls.forEach((l, p) => { inside(l, 'place: label ' + p, H); noneHit(l, boxes, 'place: label ' + p); });
    noHits(lbls, 'place: labels');
    const grp = [[8, 8], [7, 4], [3, 0]].map(([a, b]) => ({ x:xs[a] - S.w / 2 - G.pad, y:ys[a] - G.top, w:xs[b] - xs[a] + S.w + 2 * G.pad, h:G.top + G.bottom }));
    grp.forEach((g, i) => inside(g, 'place: group box ' + i, H));
    noHits(grp, 'place: group boxes');
    const within = (r, g) => r.x >= g.x && r.y >= g.y && r.x + r.w <= g.x + g.w && r.y + r.h <= g.y + g.h;
    [[8, 8], [7, 4], [3, 0]].forEach(([a, b], i) => { for (let p = b; p <= a; p++) if (!within(boxes[p], grp[i]) || !within(lbls[p], grp[i])) fail('place: the box or label of place ' + p + ' sticks out of its group'); });
    const keys = [];
    for (let v = 0; v <= 9; v++){ const k = D.placeKeyXY(v); keys.push(sq(k.x, k.y, D.PLACE_KEYS.size)); }
    keys.forEach((k, v) => { inside(k, 'place: digit card ' + v, H); noneHit(k, grp, 'place: digit card ' + v); });
    noHits(keys, 'place: digit cards');
    if (nearestOpen){
      const list = xs.map((x, p) => ({ p, cx:x, cy:ys[p], hw:S.w / 2, hh:S.h / 2, done:false }));
      let bad = 0;
      list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = runNearest(list, { x, y }, S.pad); if (!g || g.p !== b.p) bad++; } });
      if (bad) fail('place: nearestOpen() gives ' + bad + ' points inside a box to another box (or none)');
    }
    need('place', /var n = pick\(GAME_PLACE\), len = digitCount\(n\), text = d\.gPlaceParts\(placeParts\(n\)\)/, 'the description is not the parts of the number');
    need('place', /for \(var p = len - 1; p >= 0; p--\)\{/, 'the boxes are not one per digit of the number');
    need('place', /c:placeDigit\(n, p\)/, 'a box does not want exactly its digit');
    need('place', /if \(v !== bx\.c\)\{ roundMiss\(bx\.c === 0 \? d\.gPlaceZero\(d\.places\[bx\.p\]\) : d\.gPlaceDigit\(d\.places\[bx\.p\], bx\.c, d\.units\[bx\.p\]\)\); return false; \}/, 'a wrong digit is accepted, or the wrong reason is given');
    need('place', /if \(filled === len\) roundSolved\(d\.gPlaceDone\(n, text\)\)/, 'the round does not end when every box is filled');
    need('place', /var bx = nearestOpen\(boxes, pt, S\.pad\);\s*if \(!bx\) return false;/, 'a drop away from every box is not a silent bounce');
    need('place', /'glbl gplace' \+ \(lang === 'en' \? ' gen' : ''\), d\.places\[p\]\)/, 'a box is not labelled with its place name');
    D.GAME_PLACE.forEach((n, i) => {
      const w = 'GAME_PLACE[' + i + '] ' + n, len = String(n).length, ds = []; for (let p = 0; p < len; p++) ds.push(dig(n, p));
      if (!(isInt(n) && n <= 999999999 && (len === 8 || len === 9))) return fail(w + ' should be an 8- or 9-digit number within the lesson range');
      const nz = ds.filter(x => x > 0);
      if (nz.length !== 3) fail(w + ': ' + nz.length + ' non-zero digits — the round wants exactly 3 (the rest are placeholders)');
      if (nz.indexOf(1) >= 0) fail(w + ': a digit is 1 — “1 ten-millions” would be wrong English');
      if (ds.slice(0, 4).every(x => x === 0) || ds.slice(4, 8).every(x => x !== 0)) fail(w + ': should have a non-zero digit in the ones group and a 0 in the ten-thousands group');
      const mine = []; for (let p = len - 1; p >= 0; p--) if (ds[p]) mine.push([ds[p], p]);
      if (JSON.stringify(D.placeParts(n)) !== JSON.stringify(mine)) fail(w + ': placeParts() is ' + JSON.stringify(D.placeParts(n)) + ', should be ' + JSON.stringify(mine));
      /* 照遊戲的規則填：每一格只收 placeDigit(n, p) —— 填完一定是 n */
      if (+ds.slice().reverse().join('') !== n) fail(w + ': filling every box with its digit does not give back ' + n);
      LANGS.forEach(L => {
        const d = I18N[L], text = d.gPlaceParts(mine);
        /* 說明讀回來就是 n：自己的單位表，由長到短 */
        let rest = text, back = 0, found = 0, foundP = [];
        const U = L === 'zh' ? ['一','十','百','千','萬','十萬','百萬','千萬','億'] : ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions'];
        U.map((u, p) => ({ u, p })).sort((a, b) => b.u.length - a.u.length).forEach(({ u, p }) => {
          const re = L === 'zh' ? new RegExp('(\\d+) 個' + u + '(?![十百千萬億])') : new RegExp('(\\d+) ' + u + '(?![a-z-])');
          let m; while ((m = rest.match(re))){ back += +m[1] * Math.pow(10, p); found++; foundP.push(p); rest = rest.replace(m[0], '\u0001'); }
        });
        if (back !== n || found !== 3 || /\d/.test(rest)) fail(w + ' ' + L + ': the description "' + text + '" reads back as ' + back);
        /* 說明裡除了「N 個X」和分隔符號之外什麼都沒有 —— 不然「沒有說到十萬位」可能是假的（codex 第一輪） */
        /* 用一個不會出現在文字裡的記號（U+0001）代替抓到的部分：剩下的必須「剛好」是三個記號加上那一種語言的分隔符號（codex 第二輪：用 # 時，文字裡多一個 # 會被放過） */
        const shape = ['\u0001', '\u0001', '\u0001'].join(L === 'zh' ? '、' : ', ');
        if (rest !== shape) fail(w + ' ' + L + ': the description has words besides the three parts: "' + text + '" (left over: ' + JSON.stringify(rest) + ')');
        seq(w + ' gPlaceNow ' + L, d.gPlaceNow(text), nz.slice().reverse());
        seq(w + ' gPlaceDone ' + L, d.gPlaceDone(n, text), nz.slice().reverse().concat([n]));
        for (let p = 0; p < len; p++){
          const pl = d.places[p];
          if (ds[p] === 0){
            const t = d.gPlaceZero(pl);
            seq(w + ' gPlaceZero(' + p + ') ' + L, t, [0, 0]); has(w + ' gPlaceZero ' + L, t, pl);
            /* 「說明裡沒有說到這一位」要是真的 */
            if (foundP.indexOf(p) >= 0) fail(w + ' ' + L + ': gPlaceZero says the description skips the ' + pl + ', but the description shown names it');
          } else {
            const t = d.gPlaceDigit(pl, ds[p], d.units[p]);
            seq(w + ' gPlaceDigit(' + p + ') ' + L, t, [ds[p], ds[p]]); has(w + ' gPlaceDigit ' + L, t, pl);
            has(w + ' gPlaceDigit ' + L, t, (L === 'zh' ? ds[p] + ' 個' : ds[p] + ' ') + d.units[p]);
            if (text.indexOf(L === 'zh' ? ds[p] + ' 個' + d.units[p] : ds[p] + ' ' + d.units[p]) < 0) fail(w + ' ' + L + ': gPlaceDigit quotes "' + ds[p] + ' ' + d.units[p] + '", which is not in the description');
          }
          seq(w + ' gPlace2(' + p + ') ' + L, d.gPlace2(pl, ds[p]), [ds[p]]);
        }
      });
    });
    if (!D.GAME_PLACE.some(n => n >= 1e8) || !D.GAME_PLACE.some(n => n < 1e8)) fail('GAME_PLACE should have both 8- and 9-digit numbers (with and without the hundred-millions box)');
  }

  /* ================= 第 2 關：切一節（範例 2） ================= */
  {
    const DG = D.CUT_DIG, GP = D.CUT_GAP, T = D.CUT_TAG, H = D.CUT_H;
    if (D.CUT_NEED.wan !== 4 || D.CUT_NEED.yi !== 8) fail('cut: the ten-thousands cut should leave 4 digits to its right and the hundred-millions cut 8, got ' + JSON.stringify(D.CUT_NEED));
    const len = 9, digs = [];
    for (let i = 0; i < len; i++){ const x = D.digitX(len, i, DG.cx); digs.push(sq(x, DG.y, DG.w, DG.h)); }
    digs.forEach((r, i) => inside(r, 'cut: digit ' + i, H));
    noHits(digs, 'cut: digits');
    /* 縫 j 正好在「右邊有 j 位」的兩個數字中間 */
    for (let j = 1; j < len; j++){
      const a = D.digitX(len, len - 1 - j, DG.cx), b = D.digitX(len, len - j, DG.cx);
      if (!near(D.gapX(len, j, DG.cx), (a + b) / 2)) fail('cut: gapX(' + j + ') is not midway between the two digits with ' + j + ' on its right');
    }
    const tags = T.x.map(x => sq(x, T.y, T.w, T.h));
    tags.forEach((t, i) => { inside(t, 'cut: cut card ' + i, H); noneHit(t, digs, 'cut: cut card ' + i); });
    noHits(tags, 'cut: cut cards');
    const zones = []; for (let j = 1; j < len; j++) zones.push({ x:D.gapX(len, j, DG.cx) - DG.pitch / 2 - GP.pad, y:DG.y - GP.hh - GP.pad, w:DG.pitch + 2 * GP.pad, h:2 * GP.hh + 2 * GP.pad });
    zones.forEach((z, k) => noneHit(z, tags, 'cut: the catch area of gap ' + (k + 1)));
    if (DG.y - GP.hh < D.CUT_MARK.y.wan + D.CUT_MARK.h || D.CUT_MARK.y.yi + D.CUT_MARK.h > D.CUT_MARK.y.wan) fail('cut: the two cut names overlap each other or the cut lines');
    for (let j = 1; j < len; j++){ const x = Math.max(2, Math.min(298 - D.CUT_MARK.w, D.gapX(len, j, DG.cx) - D.CUT_MARK.w / 2)); inside({ x, y:D.CUT_MARK.y.yi, w:D.CUT_MARK.w, h:D.CUT_MARK.h }, 'cut: a cut name', H); }
    /* ⚠️ 已知例外（同三年級 numbers 的數線）：九位數排在 300 寬的畫板上，一條縫的落點只有 pitch 寬，做不到 44。
       拿得起來的刀子卡是 CUT_TAG（≥ 44）；縫與縫之間沒有空隙、落點高 2 × hh。這裡釘住它不會更窄。 */
    if (DG.pitch < 30) fail('cut: a gap is only ' + DG.pitch + ' wide — narrower than the documented 30');
    if (2 * GP.hh * scale < 44) fail('cut: a gap’s catch area is under 44 tall');
    if (nearestOpen){
      const list = []; for (let j = len - 1; j >= 1; j--) list.push({ j, cx:D.gapX(len, j, DG.cx), cy:DG.y, hw:DG.pitch / 2, hh:GP.hh, done:false });
      let bad = 0;
      list.forEach(g => { for (let x = g.cx - g.hw + 0.25; x < g.cx + g.hw - 0.2; x += 0.5) [DG.y - GP.hh + 1, DG.y, DG.y + GP.hh - 1].forEach(y => { const r = runNearest(list, { x, y }, GP.pad); if (!r || r.j !== g.j) bad++; }); });
      if (bad) fail('cut: nearestOpen() gives ' + bad + ' points over one gap to another (or none)');
    }
    need('cut', /gaps\.push\(\{ j:j, cx:gapX\(len, j, DG\.cx\), cy:DG\.y, hw:DG\.pitch \/ 2, hh:GP\.hh, done:false \}\)/, 'the gaps are not one per pair of digits, j = digits to the right');
    need('cut', /var u = P\.data\.u, need = CUT_NEED\[u\];\s*if \(g\.j !== need\)\{ roundMiss\(d\.gCutWrong\(u, g\.j, need, g\.j === len - need\)\); return false; \}/, 'a cut in the wrong gap is accepted, or the "from the left" note is wrong');
    need('cut', /if \(cuts === 2\) roundSolved\(d\.gCutDone\(n, sectionsOf\(n\)\)\)/, 'the round does not end after both cuts');
    need('cut', /el\.className = 'gdig' \+ \(made\.wan && p < 4 \? ' ge' : made\.yi && p >= 8 \? ' yi' : made\.wan && made\.yi \? ' wan' : ''\);/, 'the groups are not coloured ones / ten-thousands / hundred-millions after the cuts');
    D.GAME_CUT.forEach((n, i) => {
      const w = 'GAME_CUT[' + i + '] ' + n, s = String(n);
      if (!(isInt(n) && s.length === 9 && n <= 999999999)) return fail(w + ' should be a 9-digit number (both cuts are needed)');
      if (new Set(s).size < 4) fail(w + ': too few different digits to tell the gaps apart');
      /* 照遊戲的規則：萬只收 j = 4、億只收 j = 8 —— 切完右邊四位是個級、中間四位是萬級 */
      const ge = +s.slice(5), wan = +s.slice(1, 5), yi = +s.slice(0, 1);
      if (yi * 1e8 + wan * 1e4 + ge !== n) fail(w + ': the cut pieces do not add back to n');
      const sec = { yi, wan, ge }, bits = [yi, wan, ge].filter(x => x > 0);
      LANGS.forEach(L => {
        const d = I18N[L], t = d.gCutDone(n, sec);
        seq(w + ' gCutDone ' + L, t, [n].concat(bits));
        if (L === 'zh') has(w + ' gCutDone zh', t, '讀作' + myZhBig(n) + '。');
        if (L === 'en' && /\b1 (hundred-millions|ten-thousands|ones)\b/.test(t)) fail(w + ' gCutDone en: a count of 1 with a plural unit: ' + t);
        ['wan', 'yi'].forEach(u => {
          const nd = D.CUT_NEED[u];
          for (let j = 1; j < 9; j++){
            if (j === nd) continue;
            const left = j === 9 - nd, tt = d.gCutWrong(u, j, nd, left);
            seq(w + ' gCutWrong(' + u + ', ' + j + ') ' + L, tt, u === 'yi' ? [j, nd, 4] : [j, nd]);
            has(w + ' gCutWrong ' + L, tt, d.gCutName[u]);
            if (L === 'en' && /\b1 (digits|zeros)\b/.test(tt)) fail(w + ' gCutWrong en: "1 digits" — singular needed: ' + tt);
            const note = L === 'zh' ? '不是從左邊' : 'not from the left';
            if ((tt.indexOf(note) >= 0) !== left) fail(w + ' gCutWrong(' + u + ', ' + j + ') ' + L + ': the "from the left" note should appear only when the cut is ' + nd + ' digits from the left');
          }
          seq('gCut2(' + u + ') ' + L, d.gCut2(u, nd), [nd, nd]);
        });
      });
    });
    LANGS.forEach(L => { seq('gCutNow ' + L, I18N[L].gCutNow(1), [1, 2]); seq('gHints.cut ' + L, I18N[L].gHints.cut, [4, 4, 4, 8, 8]); });
    if (I18N.zh.gCutName.wan !== '萬' || I18N.zh.gCutName.yi !== '億' || I18N.en.gCutName.wan !== 'ten-thousands' || I18N.en.gCutName.yi !== 'hundred-millions') fail('cut: the cut names are not ten-thousands / hundred-millions');
  }

  /* ================= 第 3 關：蓋一蓋（範例 3） ================= */
  {
    const KB = D.COVER_KNOB, CB = D.COVER_BOX, H = D.COVER_H, DG = D.CUT_DIG;
    if (D.COVER_ASK.join() !== '4,3') fail('cover: should ask ten-thousands (cover 4) and then thousands (cover 3), got ' + D.COVER_ASK.join());
    for (let len = 6; len <= 9; len++){
      const R = D.coverRight(len);
      if (!near(R, D.digitX(len, len - 1, D.COVER_DIG.cx) + DG.pitch / 2)) fail('cover: coverRight(' + len + ') is not just right of the last digit');
      for (let k = 0; k < len; k++){
        if (!near(D.coverX(len, k), D.gapX(len, k, D.COVER_DIG.cx)) && k > 0) fail('cover: coverX(' + len + ', ' + k + ') is not the gap with ' + k + ' digits to its right');
        if (D.coverK(len, D.coverX(len, k)) !== k) fail('cover: coverK(coverX(' + k + ')) is ' + D.coverK(len, D.coverX(len, k)));
        if (D.coverK(len, D.coverX(len, k) + DG.pitch * 0.45) !== k || D.coverK(len, D.coverX(len, k) - DG.pitch * 0.45) !== k) fail('cover: coverK() does not snap to the nearest gap around k = ' + k);
      }
      if (D.coverK(len, -50) !== len - 1 || D.coverK(len, 400) !== 0) fail('cover: coverK() should cover at most ' + (len - 1) + ' and at least 0');
      for (let i = 0; i < len; i++) inside(sq(D.digitX(len, i, D.COVER_DIG.cx), D.COVER_DIG.y, DG.w, DG.h), 'cover: digit ' + i + ' of ' + len, H);
      [0, len - 1].forEach(k => inside(sq(D.coverX(len, k), KB.y, KB.size), 'cover: the knob covering ' + k + ' of ' + len, H));
    }
    if (!(CB.top <= D.COVER_DIG.y - DG.h / 2 && CB.top + CB.h >= D.COVER_DIG.y + DG.h / 2)) fail('cover: the cover does not cover the digits top to bottom');
    if (!(KB.y - KB.size / 2 > CB.top + CB.h)) fail('cover: the knob overlaps the cover');
    inside({ x:0, y:D.COVER_KL.y, w:W, h:D.COVER_KL.h }, 'cover: the "covering k" line', H);
    if (D.COVER_KL.y < KB.y + KB.size / 2) fail('cover: the "covering k" line overlaps the knob');
    need('cover', /axis:'x', minX:coverX\(len, len - 1\), maxX:R,/, 'the knob does not slide only sideways between covering nothing and all but one digit');
    need('cover', /if \(k === 0 \|\| k >= len\) return false;/, 'covering nothing, or a tap on the leftmost digit (everything), is not a silent bounce');
    need('cover', /if \(pt\.tap && \(pt\.y < CB\.top \|\| pt\.y > CB\.top \+ CB\.h\)\) return false;/, 'a tap below the digit row (blank space) is read as a digit');
    if (!(CB.top <= D.COVER_DIG.y - DG.h / 2 && CB.top + CB.h >= D.COVER_DIG.y + DG.h / 2) || CB.h * scale < 44) fail('cover: the tap band (the cover box) does not hold the digits or is under 44px tall');
    if (CB.top + CB.h >= KB.y - KB.size / 2) fail('cover: the tap band reaches the knob row — blank space there would count as a digit');
    need('cover', /var k = pt\.tap \? coverTapK\(len, pt\.x\) : coverK\(len, pt\.x\), need = COVER_ASK\[step\];/, 'a tap on a digit is not read with coverTapK() (rounding to the nearest gap covers one digit too few on the right half)');
    /* 點在一個數字上（框裡任何地方、含兩邊各半條縫）＝ 蓋到那個數字為止：k ＝ 它到最右邊有幾位（驗證者第二輪） */
    for (let len = 6; len <= 9; len++){
      let bad = 0, first = '';
      for (let i = 0; i < len; i++){
        const cx = D.digitX(len, i, D.COVER_DIG.cx), want = len - i;
        [-0.5 * DG.pitch + 0.01, -0.35 * DG.w, -0.2 * DG.w, 0, 0.2 * DG.w, 0.35 * DG.w, 0.49 * DG.w, 0.5 * DG.pitch - 0.01].forEach(off => {
          const got = D.coverTapK(len, cx + off);
          if (got !== want){ bad++; if (!first) first = 'digit ' + (len - i) + ' from the right, offset ' + off.toFixed(1) + ' → ' + got + ' (want ' + want + ')'; }
        });
      }
      if (D.coverTapK(len, D.coverRight(len) + 1) !== 0 || D.coverTapK(len, 299) !== 0) bad++, first = first || 'a tap right of the number covers something';
      if (D.coverTapK(len, 0) !== len) bad++, first = first || 'a tap left of the number is not "everything" (len)';
      if (bad) fail('cover: coverTapK() — a tap on a digit does not cover through that digit (' + bad + ' points, len ' + len + '), e.g. ' + first);
    }
    need('cover', /if \(step === 1 && k === COVER_ASK\[0\]\) return false;/, 'dropping the knob back on the answered ten-thousands cover is counted as a mistake');
    need('cover', /if \(k !== need\)\{ roundMiss\(d\.gCoverWrong\(n, k, need\)\); return false; \}/, 'a wrong cover is accepted, or the reason uses other numbers');
    need('cover', /roundInfo\(d\.gCoverOk\(Math\.floor\(n \/ 10000\), placeDigit\(n, 4\)\)\);/, 'the first answer is not n ÷ 10000 against the ten-thousands digit');
    need('cover', /roundSolved\(d\.gCoverDone\(n, Math\.floor\(n \/ 10000\), Math\.floor\(n \/ 1000\)\)\);/, 'the end is not n ÷ 10000 and n ÷ 1000');
    need('cover', /if \(step === 0\)\{[\s\S]*?step = 1;[\s\S]*?P\.homeX = coverX\(len, need\); P\.home\(\);/, 'after the ten-thousands the knob does not stay on the cover that was right');
    D.GAME_COVER.forEach((n, i) => {
      const w = 'GAME_COVER[' + i + '] ' + n, s = String(n), len = s.length, wq = Math.floor(n / 10000), q = Math.floor(n / 1000);
      if (!(isInt(n) && len >= 6 && len <= 9 && n <= 999999999)) return fail(w + ' should be a 6- to 9-digit number');
      if (n % 10000 !== 0) fail(w + ': not whole ten-thousands — covering 4 would hide a remainder the round never mentions');
      if (wq < 10) fail(w + ': only ' + wq + ' ten-thousands — the same as the ten-thousands digit, the misconception never shows');
      if (wq === dig(n, 4)) fail(w + ': the count of ten-thousands equals the ten-thousands digit');
      /* 畫面決定答案：蓋住 need 位之後看得到的字就是答案 */
      [4, 3].forEach(k => { if (+s.slice(0, len - k) !== Math.floor(n / Math.pow(10, k))) fail(w + ': covering ' + k + ' does not leave n ÷ 10^' + k); });
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gCoverAsk(4) ' + L, d.gCoverAsk(n, 4), [n]); has(w + ' gCoverAsk(4) ' + L, d.gCoverAsk(n, 4), L === 'zh' ? '幾個萬' : 'ten-thousands');
        seq(w + ' gCoverAsk(3) ' + L, d.gCoverAsk(n, 3), [n]); has(w + ' gCoverAsk(3) ' + L, d.gCoverAsk(n, 3), L === 'zh' ? '幾個千' : 'thousands');
        if (L === 'en') hasNot(w + ' gCoverAsk(3) en', d.gCoverAsk(n, 3), 'ten-thousands');
        const ok1 = d.gCoverOk(wq, dig(n, 4));
        seq(w + ' gCoverOk ' + L, ok1, [wq, wq, dig(n, 4)]);
        const done = d.gCoverDone(n, wq, q);
        seq(w + ' gCoverDone ' + L, done, [n, wq, n, 10000, wq, q, n, 1000, q]);
        const eq = scanDiv(done);
        if (eq.length !== 2 || eq.some(e => e.bad)) fail(w + ' gCoverDone ' + L + ': the two divisions are not both right: ' + done);
        [4, 3].forEach(nd => {
          for (let k = 1; k < len; k++){
            if (k === nd) continue;
            const t = d.gCoverWrong(n, k, nd), left = Math.floor(n / Math.pow(10, k));
            seq(w + ' gCoverWrong(' + k + ', ' + nd + ') ' + L, t, L === 'zh' ? [k, left, Math.pow(10, k), k, 0, nd] : [k, left, Math.pow(10, k), k, nd]);
            has(w + ' gCoverWrong ' + L, t, d.units[k]); has(w + ' gCoverWrong ' + L, t, d.units[nd]);
            if (L === 'en' && /\b1 (digits|zeros)\b/.test(t)) fail(w + ' gCoverWrong en: "1 digits / 1 zeros" — singular needed: ' + t);
            if (+s.slice(0, len - k) !== left) fail(w + ': "covering ' + k + ' leaves ' + left + '" is not what the picture shows');
          }
          seq('gCover2(' + nd + ') ' + L, d.gCover2(nd), [nd]);
        });
        seq('gCoverK ' + L, d.gCoverK(3), [3]);
      });
    });
    LANGS.forEach(L => seq('gHints.cover ' + L, I18N[L].gHints.cover, L === 'zh' ? [1, 10000, 4, 0, 1, 1000, 3, 0, 4] : [10000, 4, 1000, 3, 4]));
  }

  /* ================= 第 4 關：排大小（範例 4） ================= */
  {
    const SS = D.SORT_SLOT, H = D.SORT_H, LB = D.SORT_LBL;
    const slots = SS.y.map(y => sq(SS.x, y, SS.w, SS.h)), tray = SS.y.map(y => sq(D.SORT_TRAY.x, y, SS.w, SS.h));
    if (SS.y.length !== 4) fail('sort: should have 4 boxes');
    slots.concat(tray).forEach((r, i) => inside(r, 'sort: box/card ' + i, H));
    noHits(slots.concat(tray), 'sort: boxes and tray cards');
    for (let i = 1; i < 4; i++) if (!(SS.y[i] > SS.y[i - 1])) fail('sort: the boxes are not top to bottom');
    [LB.top, LB.bottom].forEach((y, i) => { const l = { x:SS.x - SS.w / 2, y, w:SS.w, h:LB.h }; inside(l, 'sort: label ' + i, H); noneHit(l, slots, 'sort: label ' + i); });
    if (!(LB.top + LB.h <= SS.y[0] - SS.h / 2 && LB.bottom >= SS.y[3] + SS.h / 2)) fail('sort: "smallest" is not above the top box or "biggest" not below the bottom one');
    if (SS.w < 9 * 0.6 * 18 + 10) fail('sort: a card is too narrow for a 9-digit number at 18px');
    need('sort', /var set = pick\(GAME_SORT\), sorted = set\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\)/, 'the boxes do not want the numbers in numeric order');
    need('sort', /var x = P\.data\.v, y = sorted\[s\.i\];\s*if \(x !== y\)\{ roundMiss\(d\.gSortWhy\(x, y, sortCompare\(x, y\)\)\); return false; \}/, 'a card in the wrong box is accepted, or the reason compares the wrong two numbers');
    need('sort', /if \(placed === 4\) roundSolved\(d\.gSortDone\(sorted\)\)/, 'the round does not end with the sorted row');
    need('sort', /renderTray\(set, function\(v, i\)\{/, 'the cards are not laid out by renderTray() (shuffled)');
    const myCmp = (x, y) => {
      const a = String(x), b = String(y);
      if (a.length !== b.length) return { kind:'len', lx:a.length, ly:b.length };
      const ties = [];
      for (let i = 0; i < a.length; i++){ const pl = a.length - 1 - i; if (a[i] !== b[i]) return { kind:'digit', len:a.length, place:pl, a:+a[i], b:+b[i], ties }; ties.push(pl); }
      return null;
    };
    let cmpBad = 0;
    for (let x = 1; x < 999999999; x = Math.floor(x * 1.37) + 11) for (let y = 3; y < 999999999; y = Math.floor(y * 1.61) + 7){ if (x !== y && JSON.stringify(D.sortCompare(x, y)) !== JSON.stringify(myCmp(x, y))) cmpBad++; }
    [[35002000, 35020000], [400300000, 400030000], [9999999, 10000000], [60000700, 60007000]].forEach(([x, y]) => { if (JSON.stringify(D.sortCompare(x, y)) !== JSON.stringify(myCmp(x, y))) cmpBad++; });
    if (cmpBad) fail('sortCompare() disagrees with the config’s own comparison on ' + cmpBad + ' pairs');
    D.GAME_SORT.forEach((set, i) => {
      if (!poolOk(set, 4)) return;
      const w = 'GAME_SORT[' + i + '] ' + set.join('/');
      if (!Array.isArray(set) || set.length !== 4 || new Set(set).size !== 4 || !set.every(v => isInt(v) && v > 0 && v <= 999999999)) return fail(w + ': should be 4 different numbers within the lesson range');
      const seven = set.filter(v => String(v).length === 7);
      if (seven.length !== 1 || String(seven[0])[0] !== '9') fail(w + ': should have exactly one 7-digit number, starting with 9');
      else if (!set.every(v => v === seven[0] || +String(v)[0] < 9)) fail(w + ': the 7-digit ' + seven[0] + ' should have the biggest first digit (the "more digits wins" trap)');
      const deep = set.some(a => set.some(b => a !== b && String(a).length === String(b).length && myCmp(a, b).place <= 4));
      if (!deep) fail(w + ': no two same-length numbers first differ at the ten-thousands place or lower — nobody has to compare down to the ten-thousands');
      const sorted = set.slice().sort((a, b) => a - b);
      for (let k = 1; k < 4; k++) if (!(sorted[k - 1] < sorted[k])) fail(w + ': the row is not increasing');
      LANGS.forEach(L => {
        const d = I18N[L], pl = d.places;
        seq(w + ' gSortDone ' + L, d.gSortDone(sorted), sorted);
        sorted.forEach((v, k) => seq(w + ' gSort2 ' + L, d.gSort2(k + 1, v), [k + 1, v]));
        set.forEach(x => set.forEach(y => {
          if (x === y) return;
          const m = myCmp(x, y), t = d.gSortWhy(x, y, m);
          seq(w + ' gSortWhy(' + x + ', ' + y + ') ' + L, t, m.kind === 'len' ? [x, m.lx, y, m.ly, x] : [x, y, m.len, m.a, m.b, x, x]);
          const up = L === 'zh' ? '往上' : 'higher up', down = L === 'zh' ? '往下' : 'further down';
          if (t.indexOf(x < y ? up : down) < 0 || t.indexOf(x < y ? down : up) >= 0) fail(w + ' gSortWhy ' + L + ': ' + x + ' vs ' + y + ' points the wrong way: ' + t);
          if (m.kind === 'len'){
            const rule = L === 'zh' ? (x < y ? '位數少的比較小' : '位數多的比較大') : (x < y ? 'fewer digits means smaller' : 'more digits means bigger');
            has(w + ' gSortWhy ' + L, t, rule);
          } else {
            has(w + ' gSortWhy ' + L, t, pl[m.place]);
            if ((m.a < m.b) !== (x < y)) fail(w + ': the first different digit does not decide ' + x + ' vs ' + y);
            has(w + ' gSortWhy ' + L, t, L === 'zh' ? m.a + ' 比 ' + m.b + (m.a < m.b ? ' 小' : ' 大') : m.a + ' is ' + (m.a < m.b ? 'smaller' : 'bigger') + ' than ' + m.b);
            m.ties.forEach(p => { if (dig(x, p) !== dig(y, p)) fail(w + ': ' + pl[p] + ' is called the same but differs'); has(w + ' gSortWhy (tied places) ' + L, t, pl[p]); });
            /* 沒有一樣的位，就不可以說「都一樣」 */
            if (!m.ties.length) hasNot(w + ' gSortWhy ' + L, t, L === 'zh' ? '都一樣' : 'are the same');
          }
        }));
      });
    });
    LANGS.forEach(L => seq('gSortNow ' + L, I18N[L].gSortNow(2), [2, 4]));
  }

  /* ================= 第 5 關：放數線（範例 5） ================= */
  {
    const LN = D.LINE, LS = D.LINE_SLOT, C = D.LINE_CARD, TR = D.LINE_TRAY, H = D.LINE_H, LB = D.LINE_LBL, STEP = D.LINE_STEP, TOP = D.LINE_TOP;
    if (STEP !== 10000000 || TOP !== 100000000) fail('line: the line should run 0~100000000 in steps of 10000000');
    const pitch = (LN.x1 - LN.x0) / 10;
    for (let v = 0; v <= TOP; v += 2500000){ if (!near(D.lineX(v), LN.x0 + (LN.x1 - LN.x0) * v / TOP)) { fail('lineX(' + v + ')'); break; } }
    for (let v = 0; v <= TOP; v += 1000000){ if (v % STEP === STEP / 2) continue; if (D.lineNearest(v) !== Math.round(v / STEP) * STEP){ fail('lineNearest(' + v + ')'); break; } }
    inside({ x:LN.x0, y:LN.y - 2, w:LN.x1 - LN.x0, h:4 }, 'line: the axis', H);
    for (let t = 1; t <= 9; t++){ const c = sq(LN.x0 + t * pitch, LS.cardY, C.w, C.h); inside(c, 'line: a card on tick ' + t, H); if (c.y + c.h > LN.y - 8) fail('line: a placed card covers the axis'); }
    /* ⚠️ 已知例外（同三年級 numbers）：11 個整千萬放在 300 寬的畫板上，一格只有 pitch 寬，「目的地 ≥ 44」做不到；
       拿得起來的卡片是 LINE_CARD。釘住：一格至少 24，整條線沒有空隙，卡片不寬過 3 格（相隔 3 格的卡片不會疊在一起）。 */
    if (pitch < 24) fail('line: one step is only ' + pitch.toFixed(1) + ' wide — narrower than the documented 24');
    if (C.w > 3 * pitch) fail('line: a card (' + C.w + ') is wider than 3 steps (' + (3 * pitch).toFixed(1) + ')');
    if (C.w < 8 * 0.6 * 13 + 8) fail('line: a card is too narrow for an 8-digit number at 13px');
    /* 落點要蓋住「卡片放好的高度」一直到刻度的下緣：把卡片放在刻度上（拖或點）一定要收（驗證者第一輪：舊版只收刻度上方，點刻度沒反應） */
    if (LS.y - LS.hh < 0) fail('line: the drop zone starts above the board');
    if (!(LS.y - LS.hh <= LS.cardY && LS.y + LS.hh >= LN.y + 10)) fail('line: the drop zone does not cover the ticks and the axis (y ' + (LS.y - LS.hh) + '~' + (LS.y + LS.hh) + ', ticks reach ' + (LN.y + 10) + ')');
    if (LS.y + LS.hh + LS.pad >= TR.y - C.h / 2) fail('line: the drop zone reaches the tray cards');
    if (LS.y + LS.hh + LS.pad >= LB.y) fail('line: the drop zone (with its pad) reaches the tick labels — a tap on a label would place a card (codex delta round)');
    const labels = [0, 5, 10].map(t => { const x = LN.x0 + t * pitch, lw = Math.min(LB.w, 2 * Math.min(x, W - x)); return { x:x - lw / 2, y:LB.y, w:lw, h:LB.h, t }; });
    labels.forEach(l => { inside(l, 'line: label ' + l.t, H); if (String(l.t * STEP).length * 0.6 * 11 > l.w + 0.5) fail('line: label ' + (l.t * STEP) + ' does not fit its ' + l.w.toFixed(1) + 'px box'); });
    noHits(labels, 'line: tick labels');
    const x0 = (W - 2 * TR.step) / 2, tray = [0, 1, 2].map(i => sq(x0 + i * TR.step, TR.y, C.w, C.h));
    tray.forEach((t, i) => { inside(t, 'line: tray card ' + i, H); noneHit(t, labels, 'line: tray card ' + i); });
    noHits(tray, 'line: tray cards');
    need('line', /var v = P\.data\.v, want = lineNearest\(v\);\s*if \(s\.t !== want\)\{ var b = bounds\(v\); roundMiss\(d\.gLineWhy\(v, b\.lo, b\.hi, want\)\); return false; \}/, 'a card on the wrong ten-million is accepted, or the reason uses other numbers');
    need('line', /slots\.push\(\{ t:t \* LINE_STEP, cx:x, cy:LS\.y, hw:pitch \/ 2, hh:LS\.hh, done:false \}\)/, 'the drop zones are not one per ten-million, a step wide');
    need('line', /P\.lock\(s\.cx, LS\.cardY\);/, 'a placed card is not parked at LINE_SLOT.cardY');
    need('line', /addZone\(B, lineX\(v\) - 6, LINE\.y - 6, 12, 12, 'gmark'\)/, 'the exact position is not marked at lineX(v)');
    need('line', /var lo = Math\.floor\(v \/ LINE_STEP\) \* LINE_STEP; return \{ lo:lo, hi:lo \+ LINE_STEP \};/, 'the two neighbouring ten-millions are not the ones around v');
    if (nearestOpen){
      const list = []; for (let t = 0; t <= 10; t++) list.push({ t, cx:LN.x0 + t * pitch, cy:LS.y, hw:pitch / 2, hh:LS.hh, done:false });
      let bad = 0;
      list.forEach(s => { for (let x = s.cx - pitch / 2 + 0.25; x < s.cx + pitch / 2 - 0.2; x += 0.5) [LS.y - LS.hh + 1, LS.y, LS.y + LS.hh - 1].forEach(y => { const g = runNearest(list, { x, y }, LS.pad); if (!g || g.t !== s.t) bad++; }); });
      if (bad) fail('line: nearestOpen() gives ' + bad + ' points over one ten-million to another (or none)');
    }
    D.GAME_LINE.forEach((set, i) => {
      if (!poolOk(set, 3)) return;
      const w = 'GAME_LINE[' + i + '] ' + set.join('/');
      if (!Array.isArray(set) || set.length !== 3 || new Set(set).size !== 3) return fail(w + ': should be 3 different numbers');
      set.forEach(v => {
        if (!(isInt(v) && v > 0 && v < TOP)) fail(w + ': ' + v + ' is not between 0 and ' + TOP);
        if (v % STEP === 0) fail(w + ': ' + v + ' is exactly on a tick — nothing to estimate');
        if (v % STEP === STEP / 2) fail(w + ': ' + v + ' is exactly halfway — no single closest ten-million');
        const t = Math.round(v / STEP); if (t < 1 || t > 9) fail(w + ': ' + v + ' is closest to tick ' + t + ' — its card would stick out of the board');
      });
      const ts = set.map(v => Math.round(v / STEP)).sort((a, b) => a - b);
      for (let k = 1; k < 3; k++) if (ts[k] - ts[k - 1] < 3) fail(w + ': closest ticks ' + ts[k - 1] + ' and ' + ts[k] + ' are less than 3 apart — the cards would overlap');
      const s = set.slice().sort((a, b) => a - b);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gLineDone ' + L, d.gLineDone(s.map(v => [v, Math.round(v / STEP) * STEP])), [].concat.apply([], s.map(v => [v, Math.round(v / STEP) * STEP])));
        s.forEach(v => {
          const lo = Math.floor(v / STEP) * STEP, hi = lo + STEP, t = Math.round(v / STEP) * STEP;
          if ((t === lo) !== (v - lo < hi - v)) fail(w + ': ' + v + ' is not closer to ' + t);
          const tt = d.gLineWhy(v, lo, hi, t);
          seq(w + ' gLineWhy(' + v + ') ' + L, tt, L === 'zh' ? [v, lo, hi, lo, v - lo, hi, hi - v, t] : [v, lo, hi, v - lo, lo, hi - v, hi, t]);
          has(w + ' gLineWhy ' + L, tt, L === 'zh' ? '比較靠近 ' + t : 'closer to ' + t);
          seq(w + ' gLine2(' + v + ') ' + L, d.gLine2(v, lo, hi), [v, lo, hi]);
        });
      });
    });
    LANGS.forEach(L => { seq('gHints.line ' + L, I18N[L].gHints.line, [10000000]); seq('gLineNow ' + L, I18N[L].gLineNow(1), [1, 3]); });
  }
  LANGS.forEach(L => seq('gHints.place ' + L, I18N[L].gHints.place, L === 'zh' ? [0] : [0]));
  LANGS.forEach(L => seq('gHints.sort ' + L, I18N[L].gHints.sort, []));
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-4/math/numbers */
  breaks: [
    /* ---------- review.html：產生器 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'correct is not the digit at that place',
      find:'        var correct = digs[pos];\n        var others = [];',
      replace:'        var correct = digs[(pos + 1) % 8];\n        var others = [];' },
    { file:'review', expect:'does not name the',
      find:"            ? d.n + ' 的' + t.places[d.pos] + '數字是多少？'",
      replace:"            ? d.n + ' 的' + t.places[(d.pos + 1) % 9] + '數字是多少？'" },
    { file:'review', expect:'stem does not print the number',
      find:"            : 'What is the ' + t.places[d.pos] + ' digit of ' + d.n + '?',",
      replace:"            : 'What is the ' + t.places[d.pos] + ' digit of ' + (d.n + 1) + '?'," },
    /* 最高位變成 0 的話 n 會少一位，所以**長度**那一條先響。
       `digs[7] < 1` 因此是一條到不了的守門條件（留著無害，但它沒有被證明過）。 */
    { file:'review', expect:'digitOf needs an 8-digit number',
      find:'        digs[7] = 1 + rand(9);',
      replace:'        digs[7] = 0;' },
    { file:'review', expect:'correct != dg * placeValue',
      find:'        var correct = dg * POW[pos];',
      replace:'        var correct = dg * POW[pos - 1];' },
    { file:'review', expect:'appears more than once',
      find:'        var digs = shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0, 8);',
      replace:'        var digs = [1,1,2,2,3,3,4,4];' },
    { file:'review', expect:'valueOfDigit does not name the',
      find:"            ? d.dg + ' 站在' + t.places[d.pos] + '，表示 ' + d.dg + ' 個' + t.units[d.pos] + '，也就是 ' + d.correct + '。'",
      replace:"            ? d.dg + ' 站在' + t.places[(d.pos + 1) % 9] + '，表示 ' + d.dg + ' 個' + t.units[d.pos] + '，也就是 ' + d.correct + '。'" },
    { file:'review', expect:'correct != b * 1000000',
      find:'        var correct = b * POW[6];',
      replace:'        var correct = b * POW[5];' },
    { file:'review', expect:'the expansion does not add up to n',
      find:'        var n = a * POW[7] + b * POW[6] + c * POW[4];',
      replace:'        var n = a * POW[7] + b * POW[6] + c * POW[3];' },
    { file:'review', expect:'expandBlank stem does not print',
      find:"        stem: d.n + ' ＝ ' + (d.a * POW[7]) + ' ＋ ? ＋ ' + (d.c * POW[4]),",
      replace:"        stem: d.n + ' ＝ ' + (d.a * POW[6]) + ' ＋ ? ＋ ' + (d.c * POW[4])," },
    { file:'review', expect:'n != a * 10000',
      find:'        var n = a * 10000;\n        var cands = [a * 10, Math.floor(a / 10), a + 1, a - 1, a + 10];',
      replace:'        var n = a * 1000;\n        var cands = [a * 10, Math.floor(a / 10), a + 1, a - 1, a + 10];' },
    { file:'review', expect:'howManyWan stem does not print',
      find:"          stem: lang === 'zh' ? d.n + ' 裡面有幾個萬？' : 'How many ten-thousands are there in ' + d.n + '?',",
      replace:"          stem: lang === 'zh' ? (d.n + 1) + ' 裡面有幾個萬？' : 'How many ten-thousands are there in ' + (d.n + 1) + '?'," },
    { file:'review', expect:'correct != a * 10000',
      find:'        var correct = a * 10000;\n        var cands = [a * 1000, a * 100000, a, correct + 10000, correct - 10000];',
      replace:'        var correct = a * 100000;\n        var cands = [a * 1000, a * 100000, a, correct + 10000, correct - 10000];' },
    { file:'review', expect:'correct != a * 10000 + b',
      find:'        var correct = a * 10000 + b;',
      replace:'        var correct = a * 10000 + b * 10;' },
    { file:'review', expect:'the loose ones must stay under one ten-thousand',
      find:'        var b = 1 + rand(9999);',
      replace:'        var b = 10000 + rand(9999);' },
    { file:'review', expect:'correct != a * 10',
      find:'        var correct = a * 10;\n        var cands = [a, a * 100, correct + 10, correct - 10, a + 10];',
      replace:'        var correct = a * 100;\n        var cands = [a, a * 100, correct + 10, correct - 10, a + 10];' },
    { file:'review', expect:'unitSwap does not name the',
      find:"        var big = t.units[d.p], small = t.units[d.p - 1];",
      replace:"        var big = t.units[d.p], small = t.units[d.p - 2];" },
    { file:'review', expect:'biggest: correct is not the largest option',
      find:'        var correct = Math.max.apply(null, nums);',
      replace:'        var correct = Math.min.apply(null, nums);' },
    { file:'review', expect:'do not all share it',
      find:'        var nums = tails.map(function(x){ return h * POW[7] + x; });',
      replace:'        var nums = tails.map(function(x){ return (1 + ((h + x) % 9)) * POW[7] + x; });' },
    { file:'review', expect:'smallest: correct is not the smallest option',
      find:'        var correct = Math.min.apply(null, nums);',
      replace:'        var correct = Math.max.apply(null, nums);' },
    { file:'review', expect:'the two 7-digit numbers tie there',
      find:'        var m2 = m1 + 1 + rand(9 - m1);',
      replace:'        var m2 = m1;' },
    { file:'review', expect:'smallest needs exactly two 7-digit',
      find:'          var v = (1 + rand(9)) * POW[7] + rand(POW[7]);',
      replace:'          var v = (1 + rand(9)) * POW[6] + rand(POW[6]);' },
    { file:'review', expect:'correct != start + 30000',
      find:'        var correct = start + 30000;',
      replace:'        var correct = start + 20000;' },
    { file:'review', expect:'the skip-wan stem is not start',
      find:"        stem: d.start + '、' + (d.start + 10000) + '、' + (d.start + 20000) + '、?',",
      replace:"        stem: d.start + '、' + (d.start + 10000) + '、' + (d.start + 30000) + '、?'," },
    { file:'review', expect:'crossWan: correct != k * 10000',
      find:'        var n = k * 10000 - 2;\n        var correct = k * 10000;',
      replace:'        var n = k * 10000 - 2;\n        var correct = k * 10000 + 1;' },
    { file:'review', expect:'crossWan: n must be two below',
      find:'        var n = k * 10000 - 2;\n        var correct',
      replace:'        var n = k * 10000 - 22;\n        var correct' },
    { file:'review', expect:'the counting stem is not n',
      find:"        stem: d.n + '、' + (d.n + 1) + '、?',",
      replace:"        stem: d.n + '、' + (d.n + 2) + '、?'," },
    /* 把頁面的 MAXV 調大**不會**讓任何選項越界（候選本來就被產生器自己的算式
       綁住），所以那樣的改壞什麼都證明不了。要證明 `optionOk` 的範圍表，
       就得直接讓產生器吐出一個超出宣告範圍的選項。 */
    /* 而且光放寬候選也不夠 —— `makeWrongs` 自己也吃 lo/hi，越界的候選先被它濾掉，
       而且 digitOf 的 `others`（n 自己的其他位數）幾乎每次就湊滿三個誘答，
       放寬後面的 pool 根本輪不到。要真的打到 `optionOk` 的範圍表，
       就得讓**會被選中的那幾個候選**越界，同時放寬 `mixOpts` 的範圍參數。 */
    { file:'review', expect:'outside 0~9',
      find:'        var m = mixOpts(correct, others.concat(shuffle(pool)), 0, 9);',
      replace:'        var m = mixOpts(correct, others.map(function(x){ return x + 10; }), 0, 99);' },
    { file:'review', expect:'outside 1~99999',
      find:'        var m = mixOpts(a, shuffle(cands), 1, 99999);',
      replace:'        var m = mixOpts(a, cands.map(function(v){ return v * 1000; }), 1, 9999999);' },

    /* ---------- index.html：中文讀法、範例資料、遊戲關卡 ---------- */
    { file:'index', expect:'toChineseBig',
      find:"      if (i === 2 && d === 1 && !started && lead) s += '十';",
      replace:"      if (i === 2 && d === 1 && !started && lead) s += '一十';" },
    { file:'index', expect:'toChineseBig',
      find:'      if (s.yi > 0 && s.wan < 1000) out += CN[0];',
      replace:'      if (s.yi > 0 && s.wan < 100) out += CN[0];' },
    { file:'index', expect:'toChineseBig',
      find:'      if ((s.yi > 0 && s.wan === 0) || ((s.yi > 0 || s.wan > 0) && s.ge < 1000)) out += CN[0];',
      replace:'      if ((s.yi > 0 || s.wan > 0) && s.ge < 1000) out += CN[0];' },
    { file:'index', expect:'toChineseBig',
      find:'      if (d === 0){ if (started) zero = true; continue; }',
      replace:'      if (d === 0){ continue; }' },
    { file:'index', expect:'does not rebuild n',
      find:'    return { yi: Math.floor(n / 100000000), wan: Math.floor(n / 10000) % 10000, ge: n % 10000 };',
      replace:'    return { yi: Math.floor(n / 100000000), wan: Math.floor(n / 10000) % 1000, ge: n % 10000 };' },
    { file:'index', expect:'digitsOf',
      find:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i)) % 10);',
      replace:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i + 1)) % 10);' },
    { file:'index', expect:'pad4',
      find:"    while (s.length < 4) s = '0' + s;",
      replace:"    while (s.length < 3) s = '0' + s;" },
    { file:'index', expect:'PLACE_NUMS has no number with a 0 in the middle',
      find:'  var PLACE_NUMS = [47530000, 305040000, 60000700, 123456789];',
      replace:'  var PLACE_NUMS = [47531234, 315141234, 61112345, 123456789];' },
    { file:'index', expect:'PLACE_NUMS has no number reaching the',
      find:'  var PLACE_NUMS = [47530000, 305040000, 60000700, 123456789];\n',
      replace:'  var PLACE_NUMS = [47530000, 30504000, 60000700, 12345678];\n' },
    { file:'index', expect:'REGROUP_NUMS never reaches a hundred-million',
      find:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 120000000];',
      replace:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 12000000];' },
    { file:'index', expect:'is not a whole number of ten-thousands',
      find:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 120000000];\n',
      replace:'  var REGROUP_NUMS = [350500, 35000000, 7000000, 120000000];\n' },
    /* 兩對位數不同的都要改掉 —— 只改一對的話，另一對（9999999 vs 10000000）
       會替它撐住那個性質，改壞測試就會靜靜地過。 */
    { file:'index', expect:'PAIRS has no pair with a different number of digits',
      find:'    { a:98765,     b:102345 },\n    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },\n    { a:9999999,   b:10000000 }',
      replace:'    { a:198765,    b:102345 },\n    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },\n    { a:19999999,  b:10000000 }' },
    { file:'index', expect:'PAIRS has no pair that ties on the leading digit',
      find:'    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },',
      replace:'    { a:35002000,  b:45020000 },\n    { a:400300000, b:500030000 },' },
    { file:'index', expect:'sits exactly halfway',
      find:'  var LINE_NUMS = [8000000, 34000000, 62000000, 93000000];',
      replace:'  var LINE_NUMS = [8000000, 35000000, 62000000, 93000000];' },
    { file:'index', expect:'outside the number line',
      find:'  var LINE_NUMS = [8000000, 34000000, 62000000, 93000000];\n',
      replace:'  var LINE_NUMS = [8000000, 34000000, 62000000, 130000000];\n' },
    { file:'index', expect:'place-name table says',
      find:"      places:['個位','十位','百位','千位','萬位','十萬位','百萬位','千萬位','億位'],",
      replace:"      places:['個位','十位','百位','千位','萬位','十萬位','千萬位','百萬位','億位']," },
    { file:'index', expect:'unit table says',
      find:"      units:['一','十','百','千','萬','十萬','百萬','千萬','億'],",
      replace:"      units:['一','十','百','千','萬','十萬','千萬','百萬','億']," },
    { file:'index', expect:'place-name table says',
      find:"      places:['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions'],\n      units:",
      replace:"      places:['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','ten-millions','millions','hundred-millions'],\n      units:" },

    /* ---------- codex 審查之後補上的斷言，每一條都要有自己的改壞版 ---------- */
    /* #1 三層題庫的第二套實作：改答案索引、改題幹數字、改解釋，三種都要響。 */
    { file:'index', expect:'marked answer is',
      find:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:2,",
      replace:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:0," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'350000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1,",
      replace:"        { stem:'351000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1," },
    { file:'index', expect:'the explanation never states the answer',
      find:"          why:'7 個千萬是 70000000，6 個百萬是 6000000，合起來是 76000000。' },",
      replace:"          why:'7 個千萬是 70000000，6 個百萬是 6000000，合起來很大。' }," },
    /* #2 速查卡與家長頁的規則措辭。 */
    /* 字典那一份是唯一的（markup 那一份寫在 <th> 裡），改掉它會讓出現次數
       從 2 掉到 1，count-aware 的斷言就會響。 */
    { file:'reference', expect:'reference.html no longer says',
      find:"pth3:'從右邊數第幾位'",
      replace:"pth3:'從左邊數第幾位'" },
    { file:'reference', expect:'reference.html says',
      find:"      sw1:'位名從右邊數，不是從左邊',",
      replace:"      sw1:'位名從右邊數，不是從左邊（位名從左邊數）'," },
    { file:'reference', expect:'place table has',
      find:'          <td data-i18n="pn7">千萬位</td>\n          <td data-i18n="pn6">百萬位</td>',
      replace:'          <td data-i18n="pn6">百萬位</td>\n          <td data-i18n="pn7">千萬位</td>' },
    /* 同理：`"s1p1": "` 這個前綴只出現在字典那一份，markup 那一份是
       `<p data-i18n="s1p1">`。改掉字典那一份，次數從 2 掉到 1。 */
    { file:'parents', expect:'parents.html no longer says',
      find:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的大數單元：萬、十萬、百萬、千萬到億的位值結構、化聚與比大小。孩子要學會四件事：說出每一位的位名（<strong>位名一律從右邊數起</strong>',
      replace:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的大數單元：萬、十萬、百萬、千萬到億的位值結構、化聚與比大小。孩子要學會四件事：說出每一位的位名（<strong>位名要看清楚</strong>' },
    { file:'parents', expect:'parents.html no longer says',
      find:'<strong>place names are always counted from the right</strong>',
      replace:'<strong>place names matter</strong>' },
    /* #3 產生器的解釋必須印出正解。 */
    { file:'review', expect:'why never prints the correct answer',
      find:"            ? d.a + ' 個萬就是 ' + d.a + ' × 10000 ＝ ' + d.correct + '。'",
      replace:"            ? d.a + ' 個萬就是 ' + d.a + ' × 10000 ＝ ' + (d.correct + 1) + '。'" },
    /* #4 digitsOf 要逐位驗。回傳 [n,0,0,…] 仍然「組得回 n」。 */
    { file:'index', expect:'is not a digit',
      find:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i)) % 10);\n    return a;',
      replace:'    a.push(n); for (var i = 1; i < 9; i++) a.push(0);\n    return a;' },
    /* #5 compareSteps 的 da/db 與 tie 步驟。 */
    { file:'index', expect:'deciding step says',
      find:"        steps.push({ kind:'digit', idx:i, place:sa.length - 1 - i, da:da, db:db, winner: da > db ? 'a' : 'b' });",
      replace:"        steps.push({ kind:'digit', idx:i, place:sa.length - 1 - i, da:0, db:9, winner: da > db ? 'a' : 'b' });" },
    { file:'index', expect:'tie at index',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:9 });" },
    /* #7 pad4 要比對補出來的字串，不是只比長度。 */
    { file:'index', expect:'pad4',
      find:"    var s = String(x);\n    while (s.length < 4) s = '0' + s;\n    return s;",
      replace:"    var s = String(x);\n    return '0000';" },

    /* ---------- 第二輪 codex 審查（審「修正本身」）之後補上的斷言 ---------- */
    /* R2#1 單位比較題的單位要從題幹解析：把「5 個百萬」改成「5 個億」，
       正解就該變成甲數，神諭必須跟著改口。 */
    { file:'index', expect:'recomputed',
      find:"        { stem:'文字題：甲數是 5 個百萬，乙數是 60 個十萬。哪一個比較大？',",
      replace:"        { stem:'文字題：甲數是 5 個億，乙數是 60 個十萬。哪一個比較大？'," },
    { file:'index', expect:'recomputed',
      find:"        { stem:'迷思檢查：「3 個十萬」和「30 個萬」，哪一個比較大？',",
      replace:"        { stem:'迷思檢查：「3 個百萬」和「30 個萬」，哪一個比較大？'," },
    /* R2#2 「最大／最小」的方向要從題幹讀。 */
    { file:'index', expect:'recomputed',
      find:"        { stem:'下面哪一個數最大？', opts:['10000000','9999999','9099999','9909999'], ans:0,",
      replace:"        { stem:'下面哪一個數最小？', opts:['10000000','9999999','9099999','9909999'], ans:0," },
    /* R2#3 「1 億等於幾個萬」要從題幹印出來的數算。改成「1 百萬」之後，
       先響的是「題幹沒有印出 100000000」那一條 —— 那正是把神諭綁回題幹的那一條，
       所以期望訊息就是它。（設定檔自己的 calc 改壞不了：breaktest 只改那四頁。） */
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'1 億（100000000）等於幾個萬？',",
      replace:"        { stem:'1 百萬（1000000）等於幾個萬？'," },
    /* R2#4 解釋比對要用數字 token：400 不可以被 4000000 收編。 */
    { file:'index', expect:'the explanation never states the answer',
      find:"          why:'先加起來：2450000 ＋ 1550000 ＝ 4000000；再換算：4000000 ÷ 10000 ＝ 400，所以是 400 個萬。' },",
      replace:"          why:'先加起來：2450000 ＋ 1550000 ＝ 4000000；再換算：4000000 ÷ 100000 ＝ 40。' }," },
    /* R2#5 比大小的步驟串要完整，不能整段 tie 消失。 */
    { file:'index', expect:'step shape is',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      if (i > 900) steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });" },
    /* R2#6 剛修好的兩條規則要有人盯。 */
    { file:'reference', expect:'the required number of times',
      find:"h1b:'整個數 ÷ 10000，商就是幾個萬（除不盡時，餘數就是剩下的零頭）'",
      replace:"h1b:'整個數 ÷ 10000'" },
    { file:'parents', expect:'which contradicts the rule this lesson teaches',
      find:'這一課<strong>不教四捨五入取概數的算則，也不教大數的直式乘除</strong>——那是同年級後面的單元；數線那一段只做「大概在哪裡、比較靠近哪一個整千萬」的數感判讀，不需要用到四捨五入的規則。頁面上的數字最多九位數（到 9 億多），刻意<strong>不加千分位逗號</strong>，理由見下。</p>',
      replace:'這一課<strong>不教四捨五入取概數，也不教大數的直式乘除</strong>——那是同年級後面的單元。頁面上的數字最多九位數（到 9 億多），刻意<strong>不加千分位逗號</strong>，理由見下。</p>' },

    /* ---------- 第三輪 codex 審查（只審檢查工具）之後補上的斷言 ---------- */
    /* R3#1 題幹的數字要「剛好就是這些」：把舊的數字當成例子補回去也要被抓到。 */
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:2,",
      replace:"        { stem:'47531000 的萬位數字是多少？（例：47530000）', opts:['4','7','3','5'], ans:2," },
    /* R3#1b 這一課刻意不印千分位逗號 —— 那條規則以前沒人在盯。 */
    { file:'index', expect:'thousands separator',
      find:"        { stem:'350000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1,",
      replace:"        { stem:'350,000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1," },
    /* R3#3 tie 步驟的 index 要成序列，不能每一步都指著同一位。 */
    { file:'index', expect:'tie indices are',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      steps.push({ kind:'tie', idx:0, place:sa.length - 1, d:Number(sa[0]) });" },
    /* R3#7 compareSteps 回傳空陣列時要響亮地失敗，不是丟例外。 */
    { file:'index', expect:'returned no steps',
      find:"    var sa = String(a), sb = String(b), steps = [];",
      replace:"    var sa = String(a), sb = String(b), steps = []; if (a) return steps;" },
    /* ---------- 小遊戲「大數城市闖關」（§六之五，2026-10-04） ---------- */
    { file:'index', expect:"it takes the first match",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"measure to the box",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"      var dd = dx * dx + dy * dy, dc = dd;" },
    { file:'index', expect:"skips it and lands in the next slot",
      find:"      if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return;\n      var ex",
      replace:"      if (b.done || Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return;\n      var ex" },
    { file:'index', expect:"shown although nothing was taken",
      find:"    var lost = gScore >= 5 ? 5 : 0;   /* 分數一律是 5 的倍數",
      replace:"    var lost = 5;   /* 分數一律是 5 的倍數" },
    { file:'index', expect:"a round should give +20",
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = 20;" },
    { file:'index', expect:"already sorted",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"    a.sort(function(x, y){ return x - y; });\n" },
    { file:'index', expect:"without shuffle",
      find:"  function renderTray(items, mk){ shuffle(items).forEach(mk); }",
      replace:"  function renderTray(items, mk){ items.forEach(mk); }" },
    { file:'index', expect:"gen / gGen guard",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板",
      replace:"      if (false) return;   /* 這一塊屬於已經拿掉的畫板" },
    { file:'index', expect:"no lostpointercapture safety",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    { file:'index', expect:"a second finger can end the drag",
      find:"      if (!start || e.pointerId !== pid) return;\n      start = null; pid = null;",
      replace:"      if (!start) return;\n      start = null; pid = null;" },
    { file:'index', expect:"GPICK 40",
      find:"  var GPICK = 48;",
      replace:"  var GPICK = 40;" },
    { file:'index', expect:"a digit card (44)",
      find:"  var PLACE_KEYS = { y:230, rowStep:56, step:56, size:48 };",
      replace:"  var PLACE_KEYS = { y:230, rowStep:56, step:56, size:44 };" },
    { file:'index', expect:"a digit is 1",
      find:"  var GAME_PLACE = [30500200,",
      replace:"  var GAME_PLACE = [30100200," },
    { file:'index', expect:"non-zero digits",
      find:"  var GAME_PLACE = [30500200,",
      replace:"  var GAME_PLACE = [30520200," },
    { file:'index', expect:"a wrong digit is accepted",
      find:"        if (v !== bx.c){ roundMiss(bx.c === 0 ? d.gPlaceZero",
      replace:"        if (v !== bx.c && bx.c !== 0){ roundMiss(bx.c === 0 ? d.gPlaceZero" },
    { file:'index', expect:"right above place",
      find:"    return p === 8 ? S.right - 4 * S.pitch - S.yiGap : S.right - (p % 4) * S.pitch;",
      replace:"    return p === 8 ? S.right - 4 * S.pitch - S.yiGap : S.right - (p % 4) * S.pitch - (p >= 4 ? 3 : 0);" },
    { file:'index', expect:"has no gap from the ten-millions box",
      find:"pitch:52, right:266, yiGap:14 };",
      replace:"pitch:52, right:266, yiGap:-6 };" },
    { file:'index', expect:"gPlaceZero",
      find:"要放 0（沒有的位也要寫 0 佔位子）。",
      replace:"要放 1（沒有的位也要寫 0 佔位子）。" },
    { file:'index', expect:"gPlaceDigit",
      find:"所以' + pl + '要放 ' + c + '。'; },",
      replace:"所以' + pl + '要放 ' + (c % 9 + 1) + '。'; }," },
    { file:'index', expect:"placeParts() is",
      find:"    for (var p = digitCount(n) - 1; p >= 0; p--) if (placeDigit(n, p) > 0) out.push([placeDigit(n, p), p]);",
      replace:"    for (var p = 0; p < digitCount(n); p++) if (placeDigit(n, p) > 0) out.push([placeDigit(n, p), p]);" },
    { file:'index', expect:"place: group boxes",
      find:"  var PLACE_ROW_Y = [60, 160],",
      replace:"  var PLACE_ROW_Y = [60, 120]," },
    { file:'index', expect:"a cut in the wrong gap is accepted",
      find:"        if (g.j !== need){ roundMiss(",
      replace:"        if (g.j !== need && g.j !== len - need){ roundMiss(" },
    { file:'index', expect:"the ten-thousands cut should leave 4",
      find:"  var CUT_NEED = { wan:4, yi:8 };",
      replace:"  var CUT_NEED = { wan:5, yi:8 };" },
    { file:'index', expect:"gapX(",
      find:"  function gapX(len, j, c){ return c + (len / 2 - j) * CUT_DIG.pitch; }",
      replace:"  function gapX(len, j, c){ return c + (len / 2 - j + 1) * CUT_DIG.pitch; }" },
    { file:'index', expect:"the \"from the left\" note",
      find:"(fromLeft ? '要從右邊數，不是從左邊數。' : '')",
      replace:"'要從右邊數，不是從左邊數。'" },
    { file:'index', expect:"should be a 9-digit number",
      find:"  var GAME_CUT = [305040000,",
      replace:"  var GAME_CUT = [30504000," },
    { file:'index', expect:"the groups are not coloured",
      find:"made.wan && p < 4 ? ' ge'",
      replace:"made.wan && p <= 4 ? ' ge'" },
    { file:'index', expect:"gCutDone zh",
      find:"        return '切好了：' + n + ' ＝ ' + bits.join(' ＋ ') + '，讀作' + toChineseBig(n) + '。';",
      replace:"        return '切好了：' + n + ' ＝ ' + bits.join(' ＋ ') + '，讀作' + toChineseBig(n - n % 10000) + '。';" },
    { file:'index', expect:"narrower than the documented 30",
      find:"CUT_DIG = { w:26, h:40, pitch:30,",
      replace:"CUT_DIG = { w:26, h:40, pitch:28," },
    { file:'index', expect:"a wrong cover is accepted",
      find:"        if (k !== need){ roundMiss(d.gCoverWrong(n, k, need)); return false; }",
      replace:"        if (k < need){ roundMiss(d.gCoverWrong(n, k, need)); return false; }" },
    { file:'index', expect:"should ask ten-thousands (cover 4)",
      find:"  var COVER_ASK = [4, 3];",
      replace:"  var COVER_ASK = [3, 4];" },
    { file:'index', expect:"does not snap to the nearest gap",
      find:"Math.min(len - 1, Math.round((coverRight(len) - x) / CUT_DIG.pitch))",
      replace:"Math.min(len - 1, Math.floor((coverRight(len) - x) / CUT_DIG.pitch))" },
    { file:'index', expect:"cover: the knob covering 0",
      find:"COVER_DIG = { y:58, cx:136 }",
      replace:"COVER_DIG = { y:58, cx:150 }" },
    { file:'index', expect:"not whole ten-thousands",
      find:"  var GAME_COVER = [350000,",
      replace:"  var GAME_COVER = [352000," },
    { file:'index', expect:"the first answer is not n ÷ 10000",
      find:"          roundInfo(d.gCoverOk(Math.floor(n / 10000), placeDigit(n, 4)));",
      replace:"          roundInfo(d.gCoverOk(Math.floor(n / 10000), placeDigit(n, 5)));" },
    { file:'index', expect:"gCoverWrong",
      find:"        return '蓋住 ' + k + ' 位，看得到的 ' + Math.floor(n / Math.pow(10, k)) + ' 是",
      replace:"        return '蓋住 ' + k + ' 位，看得到的 ' + Math.floor(n / Math.pow(10, need)) + ' 是" },
    { file:'index', expect:"stay on the cover that was right",
      find:"          P.homeX = coverX(len, need); P.home();",
      replace:"          P.home();" },
    { file:'index', expect:"the boxes do not want the numbers in numeric order",
      find:"sorted = set.slice().sort(function(a, b){ return a - b; }), SS = SORT_SLOT",
      replace:"sorted = set.slice().sort(), SS = SORT_SLOT" },
    { file:'index', expect:"sortCompare() disagrees",
      find:"      var place = sx.length - 1 - i;",
      replace:"      var place = i;" },
    { file:'index', expect:"points the wrong way",
      find:"        var tail = '，' + x + ' 要' + (small ? '往上' : '往下') + '放。';",
      replace:"        var tail = '，' + x + ' 要' + (small ? '往下' : '往上') + '放。';" },
    { file:'index', expect:"starting with 9",
      find:"    [9876543, 35002000, 35020000, 100010000],",
      replace:"    [8876543, 35002000, 35020000, 100010000]," },
    { file:'index', expect:"tied places",
      find:"(c.ties.length ? '; the ' + c.ties.map(function(p){ return pl[p]; }).join(', ') + ' digits are the same' : '') +\n          '; at the ' + pl[c.place] + ' place ' + c.a + ' is bigger",
      replace:"(c.ties.length ? '; the first ' + c.ties.length + ' digits are the same'.replace(/\\d+/, 'few') : '') +\n          '; at the ' + pl[c.place] + ' place ' + c.a + ' is bigger" },
    { file:'index', expect:"a card on the wrong ten-million is accepted",
      find:"        if (s.t !== want){ var b = bounds(v);",
      replace:"        if (Math.abs(s.t - want) > LINE_STEP){ var b = bounds(v);" },
    { file:'index', expect:"exactly halfway",
      find:"[34000000, 62000000, 93000000],\n    [11000000",
      replace:"[35000000, 62000000, 93000000],\n    [11000000" },
    { file:'index', expect:"less than 3 apart",
      find:"[34000000, 62000000, 93000000],\n    [11000000",
      replace:"[34000000, 52000000, 93000000],\n    [11000000" },
    { file:'index', expect:"its card would stick out of the board",
      find:"    [8000000, 42000000, 69000000],",
      replace:"    [3000000, 42000000, 69000000]," },
    { file:'index', expect:"wider than 3 steps",
      find:"LINE_CARD = { w:72, h:48 }",
      replace:"LINE_CARD = { w:80, h:48 }" },
    { file:'index', expect:"gLineWhy en",
      find:"', so it is closer to ' + t + '.'; },",
      replace:"', so it is closer to ' + lo + '.'; }," },
    { file:'index', expect:"lineNearest(",
      find:"  function lineNearest(v){ return Math.round(v / LINE_STEP) * LINE_STEP; }",
      replace:"  function lineNearest(v){ return Math.floor(v / LINE_STEP) * LINE_STEP; }" },
    { file:'index', expect:"gAsks.cover missing in en",
      find:"        cover:'Pull 🙈",
      replace:"        covr:'Pull 🙈" },
    { file:'index', expect:"a count of 1 with a plural unit",
      find:"(c === 1 ? one : many)",
      replace:"many" },
    { file:'index', expect:"gCoverWrong en: \"1 digits",
      find:"(k === 1 ? ' zero' : ' zeros')",
      replace:"' zeros'" },
    { file:'index', expect:"gCutWrong en: \"1 digits",
      find:"(j === 1 ? ' digit' : ' digits')",
      replace:"' digits'" },
    { file:'index', expect:"a mistake should read −5",
      find:"      gMinus:'−5 points',",
      replace:"      gMinus:'+5 points'," },
    { file:'index', expect:"the points for a round should read +20",
      find:"      gPts: function(p){ return '+' + p + ' 分！'; },",
      replace:"      gPts: function(p){ return '−' + p + ' 分！'; }," },
    { file:'index', expect:"the description has words besides the three parts",
      find:"        return parts.map(function(pr){ return pr[0] + ' 個' + u[pr[1]]; }).join('、');",
      replace:"        return parts.map(function(pr){ return pr[0] + ' 個' + u[pr[1]]; }).join('、') + '（十萬位是空的）';" },
    { file:'index', expect:"the description has words besides the three parts",
      find:"        return parts.map(function(pr){ return pr[0] + ' ' + u[pr[1]]; }).join(', ');",
      replace:"        return parts.map(function(pr){ return pr[0] + ' ' + u[pr[1]]; }).join(', ') + '#';" },
    { file:'index', expect:"should be an array of 4 whole numbers",
      find:"    [9800000, 70500000, 70050000, 70000500],",
      replace:"    9800000," },
    { file:'index', expect:"should be an array of 3 whole numbers",
      find:"[13000000, 38000000, 76000000]\n  ];",
      replace:"13000000\n  ];" },
    { file:'index', expect:"compare down to the ten-thousands",
      find:"    [9876543, 35002000, 35020000, 100010000],",
      replace:"    [9876543, 35002000, 45020000, 100010000]," },
    { file:'index', expect:"the drop zone does not cover the ticks",
      find:"LINE_SLOT = { y:83, hh:49, pad:3, cardY:70 }",
      replace:"LINE_SLOT = { y:70, hh:34, pad:3, cardY:70 }" },
    { file:'index', expect:"reaches the tick labels",
      find:"LINE_SLOT = { y:83, hh:49, pad:3, cardY:70 }",
      replace:"LINE_SLOT = { y:86, hh:50, pad:4, cardY:70 }" },
    { file:'index', expect:"a tap on a digit is not read with coverTapK()",
      find:"        var k = pt.tap ? coverTapK(len, pt.x) : coverK(len, pt.x), need",
      replace:"        var k = coverK(len, pt.x), need" },
    { file:'index', expect:"a tap on a digit does not cover through that digit",
      find:"    var i = Math.floor((x - (coverRight(len) - len * CUT_DIG.pitch)) / CUT_DIG.pitch);",
      replace:"    var i = Math.round((x - (coverRight(len) - len * CUT_DIG.pitch)) / CUT_DIG.pitch);" },
    { file:'index', expect:"a tap on the leftmost digit (everything), is not a silent bounce",
      find:"        if (k === 0 || k >= len) return false;",
      replace:"        if (k === 0) return false;" },
    { file:'index', expect:"a tap below the digit row (blank space) is read as a digit",
      find:"        if (pt.tap && (pt.y < CB.top || pt.y > CB.top + CB.h)) return false;",
      replace:"        if (pt.tap && (pt.y < CB.top - 10 || pt.y > KB.y + KB.size / 2 + 10)) return false;" },
    { file:'index', expect:"dropping the knob back on the answered",
      find:"        if (step === 1 && k === COVER_ASK[0]) return false;",
      replace:"" },
    { file:'index', expect:"GAME_ORDER should be",
      find:"  var GAME_ORDER = ['place', 'cut', 'cover', 'sort', 'line'];",
      replace:"  var GAME_ORDER = ['place', 'cover', 'cut', 'sort', 'line'];" }
  ],

  sim: {
    /* fmt() 要印位名與單位詞，兩張表都宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    /* 每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
       能從 n 重算的一律從 n 重算 —— 只比產生器留下的中間變數等於自己比自己。 */
    INVARIANTS: {
      digitOf: d => {
        if (String(d.n).length !== 8) return 'digitOf needs an 8-digit number, got ' + d.n;
        if (d.pos < 4 || d.pos > 7) return 'pos out of the big-number places (4~7)';
        if (digitAt(d.n, d.pos) !== d.correct) return 'correct is not the digit at that place';
        if (d.correct < 0 || d.correct > 9) return 'a place digit must be 0~9';
        /* digs 是產生器自己留的，要和 n 對得起來，否則題幹與資料是兩回事。 */
        let rebuilt = 0;
        for (let i = 0; i < 8; i++) rebuilt += d.digs[i] * P[i];
        if (rebuilt !== d.n) return 'digs does not rebuild n';
        if (d.digs[7] < 1) return 'the top digit must not be 0';
      },
      valueOfDigit: d => {
        if (String(d.n).length !== 8) return 'valueOfDigit needs an 8-digit number, got ' + d.n;
        if (d.pos < 3 || d.pos > 7) return 'pos out of range (3~7)';
        if (digitAt(d.n, d.pos) !== d.dg)
          return 'dg ' + d.dg + ' is not the digit at position ' + d.pos + ' of ' + d.n;
        if (d.dg * P[d.pos] !== d.correct) return 'correct != dg * placeValue';
        if (d.dg < 1) return 'the stem reads "the D stands for" — D must not be 0';
        if (String(d.n).split('').filter(c => c === String(d.dg)).length !== 1)
          return 'the digit ' + d.dg + ' appears more than once in ' + d.n + ', so "the D" is ambiguous';
      },
      expandBlank: d => {
        if (d.n !== d.a * P[7] + d.b * P[6] + d.c * P[4]) return 'the expansion does not add up to n';
        if (d.correct !== d.b * P[6]) return 'correct != b * 1000000';
        if (d.a < 1 || d.b < 1 || d.c < 1) return 'a 0 term would print an empty slot the stem does not intend';
        if (d.n > MAXN) return 'n above the lesson range';
      },
      howManyWan: d => {
        if (d.n !== d.a * 10000) return 'n != a * 10000';
        if (d.correct !== Math.floor(d.n / 10000)) return 'correct != n / 10000';
        if (d.n % 10000 !== 0) return 'why divides exactly, so n must be a whole number of ten-thousands';
        if (d.a < 2) return 'a single ten-thousand makes the question trivial';
        if (d.n > MAXN) return 'n above the lesson range';
      },
      wanToNumber: d => {
        if (d.correct !== d.a * 10000) return 'correct != a * 10000';
        if (d.a < 2) return 'a single ten-thousand makes the question trivial';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      buildFromParts: d => {
        if (d.correct !== d.a * 10000 + d.b) return 'correct != a * 10000 + b';
        if (d.a < 1) return 'why talks about ten-thousands, so a must be >= 1';
        if (d.b < 1 || d.b > 9999)
          return 'the loose ones must stay under one ten-thousand, or the split is not canonical';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      unitSwap: d => {
        if (d.p < 5 || d.p > 8) return 'p out of range (5~8)';
        if (d.correct !== d.a * 10) return 'correct != a * 10';
        if (d.a < 1 || d.a > 9) return 'a must be a single digit';
        /* 規則本身：往右一格的位值一定剛好是十分之一。 */
        if (P[d.p] !== P[d.p - 1] * 10) return 'the two units are not one place apart';
      },
      biggest: d => {
        const nums = d.opts.map(Number);
        if (Math.max.apply(null, nums) !== d.correct) return 'biggest: correct is not the largest option';
        if (nums.some(v => String(v).length !== 8)) return 'biggest: every option must be an 8-digit number';
        if (nums.some(v => Math.floor(v / P[7]) !== d.h))
          return 'why says every option shares the ten-millions digit, but they do not all share it';
      },
      smallest: d => {
        const nums = d.opts.map(Number);
        if (Math.min.apply(null, nums) !== d.correct) return 'smallest: correct is not the smallest option';
        const sevens = nums.filter(v => String(v).length === 7);
        const eights = nums.filter(v => String(v).length === 8);
        if (sevens.length !== 2 || eights.length !== 2)
          return 'smallest needs exactly two 7-digit and two 8-digit options (got ' + sevens.length + '/' + eights.length + ')';
        if (String(d.correct).length !== 7) return 'the smallest must be one of the 7-digit numbers';
        /* why 說「兩個 7 位數再從最左邊的百萬位比」—— 那兩個數的百萬位必須真的不同，
           而且正解的百萬位必須是比較小的那一個，否則決勝的其實是後面的位。 */
        const mils = sevens.map(v => Math.floor(v / P[6]));
        if (mils[0] === mils[1]) return 'why says the millions place decides it, but the two 7-digit numbers tie there';
        if (Math.min.apply(null, mils) !== Math.floor(d.correct / P[6]))
          return 'the smallest 7-digit number is not the one with the smaller millions digit';
        if (d.m1 >= d.m2) return 'm1 must be the smaller millions digit';
        if (Math.floor(d.correct / P[6]) !== d.m1) return 'correct does not sit in the m1 millions group';
      },
      skipWan: d => {
        if (d.correct !== d.start + 30000) return 'correct != start + 30000';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      crossWan: d => {
        if (d.correct !== d.k * 10000) return 'crossWan: correct != k * 10000';
        if (d.n !== d.correct - 2) return 'crossWan: n must be two below the round ten-thousand';
        if (d.n % 10000 !== 9998) return 'crossWan: the stem must end in 9998 so the carry story holds';
        if (d.correct > MAXN) return 'result above the lesson range';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數（或選項本身）重算，
       完全不讀 d.correct。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'digitOf':        return String(digitAt(d.n, d.pos));
        case 'valueOfDigit':   return String(digitAt(d.n, d.pos) * P[d.pos]);
        case 'expandBlank':    return String(d.b * P[6]);
        case 'howManyWan':     return String(Math.floor(d.n / 10000));
        case 'wanToNumber':    return String(d.a * 10000);
        case 'buildFromParts': return String(d.a * 10000 + d.b);
        case 'unitSwap':       return String(d.a * 10);
        /* 這兩題的選項就是那四個數，正解是其中的極值 —— 從選項重算。 */
        case 'biggest':        return String(Math.max.apply(null, d.opts.map(Number)));
        case 'smallest':       return String(Math.min.apply(null, d.opts.map(Number)));
        case 'skipWan':        return String(d.start + 30000);
        case 'crossWan':       return String(d.k * 10000);
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：位名、單位詞、數列的三個數都是現算的。
       資料全對、選項全對，位名印錯一樣會教錯 —— 所以在這裡把
       「畫面上真的印了什麼」拿真值表再驗一次。 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const why = String(q.why).replace(/<[^>]+>/g, ' ');
      const nums = (stem.match(/\d+/g) || []).map(Number);
      const places = PLACES[lang];
      const units = UNITS[lang];

      /* 位名互為子字串（「萬位」⊂「十萬位」、'ones' ⊂ 'ten-thousands'），
         所以只留「沒有被更長的命中包住」的那些，不然每一題都會命中一堆。 */
      function longestHits(text, table){
        const hits = table.filter(w => text.indexOf(w) >= 0);
        return hits.filter(w => !hits.some(other => other !== w && other.indexOf(w) >= 0));
      }
      /* digitOf 的位名印在題幹，valueOfDigit 印在解釋 —— 分開驗，
         合起來驗的話只改壞其中一邊，另一邊會替它掩護。 */
      if (genId === 'digitOf'){
        const said = longestHits(stem, places);
        if (said.indexOf(places[d.pos]) < 0)
          return 'digitOf does not name the ' + places[d.pos] + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.length !== 1) return 'digitOf names more than one place (' + said.join('/') + ')';
        if (nums.indexOf(d.n) < 0) return 'digitOf stem does not print the number ' + d.n;
      }
      if (genId === 'valueOfDigit'){
        const said = longestHits(why, places);
        if (said.indexOf(places[d.pos]) < 0)
          return 'valueOfDigit does not name the ' + places[d.pos] + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.length !== 1) return 'valueOfDigit names more than one place (' + said.join('/') + ')';
        if (nums.indexOf(d.n) < 0) return 'valueOfDigit stem does not print the number ' + d.n;
        if (nums.indexOf(d.dg) < 0) return 'valueOfDigit stem does not print the digit ' + d.dg;
      }
      if (genId === 'unitSwap'){
        /* 兩個單位詞都要出現，而且必須剛好是相鄰的那一對。
           這裡不能用 longestHits：「萬」本來就是「十萬」的子字串，可是這一題
           兩個都是**真的**印出來的，濾掉短的那個就會把正確的題目判成錯的
           （第一版就是這樣誤報的）。改成「把要找的兩個依序遮掉，再看還剩什麼」——
           先遮大的那一個，因為小的可能是它的子字串（十萬 ⊃ 萬、ten-millions ⊃ millions）。 */
        const want = [units[d.p], units[d.p - 1]];
        let rest = stem;
        for (const w of want){
          const at = rest.indexOf(w);
          if (at < 0)
            return 'unitSwap does not name the ' + w + ' unit (stem: ' + stem.trim() + ')';
          rest = rest.slice(0, at) + rest.slice(at + w.length);
        }
        const leftover = units.filter(w => rest.indexOf(w) >= 0);
        if (leftover.length)
          return 'unitSwap also names ' + leftover.join('/') + ', so the question is ambiguous';
      }
      if (genId === 'expandBlank'){
        if (nums.indexOf(d.n) < 0 || nums.indexOf(d.a * P[7]) < 0 || nums.indexOf(d.c * P[4]) < 0)
          return 'expandBlank stem does not print n, a*10^7 and c*10^4 (printed ' + nums.join(',') + ')';
      }
      if (genId === 'howManyWan' && nums.indexOf(d.n) < 0)
        return 'howManyWan stem does not print the number ' + d.n;
      if (genId === 'skipWan' &&
          (nums[0] !== d.start || nums[1] !== d.start + 10000 || nums[2] !== d.start + 20000))
        return 'the skip-wan stem is not start, +10000, +20000 (printed ' + nums.join(',') + ')';
      if (genId === 'crossWan' && (nums[0] !== d.n || nums[1] !== d.n + 1))
        return 'the counting stem is not n, n+1 (printed ' + nums.join(',') + ')';

      /* 解釋必須把正解自己印出來（codex 審查 #3）。在這之前 `expectedCorrect`
         只驗 `opts[ans]`，把 why 裡的 d.correct 改成 d.correct + 1 整條鏈都是綠的，
         孩子卻讀到一個和正解不一樣的算式。正解由這裡自己重算，不讀 d.correct。 */
      const want = module.exports.sim.expectedCorrect(d, genId, lang);
      if (want !== null){
        const whyNums = (why.match(/\d+/g) || []);
        if (whyNums.indexOf(String(want)) < 0)
          return genId + ' why never prints the correct answer ' + want + ' (printed ' + whyNums.join(',') + ')';
      }
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的迷思誘答 —— 各自只放行那一個值。 */
    stemEchoOk: {
      /* 「47530000 的 5 表示多少？」→ 直接答 5：只看數字，沒看它站在哪一位。 */
      valueOfDigit: function(d, opt){ return Number(opt) === d.dg; },
      /* 「48 個萬是多少？」→ 直接答 48：忘了乘 10000。 */
      wanToNumber: function(d, opt){ return Number(opt) === d.a; },
      /* 「7 個百萬是幾個十萬？」→ 直接答 7：忘了換單位。 */
      unitSwap: function(d, opt){ return Number(opt) === d.a; }
    },

    /* 選項一律是純數字，而且要落在這一課自己宣告的範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [1, MAXN];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{MAXN, PLACE_NUMS, READ_NUMS, REGROUP_NUMS, PAIRS, LINE_NUMS, LINE_MAX, ' +
                'GPICK, shuffle, pick, placeDigit, digitCount, PLACE_H, PLACE_SLOT, PLACE_ROW_Y, PLACE_GRP, PLACE_LBL, PLACE_KEYS, GAME_PLACE, placeSlotX, placeSlotY, placeKeyXY, placeParts, ' +
                'CUT_H, CUT_DIG, CUT_GAP, CUT_TAG, CUT_MARK, GAME_CUT, CUT_NEED, digitX, gapX, COVER_H, COVER_DIG, COVER_KNOB, COVER_BOX, COVER_KL, GAME_COVER, COVER_ASK, coverRight, coverK, coverX, coverTapK, ' +
                'SORT_H, SORT_SLOT, SORT_TRAY, SORT_LBL, GAME_SORT, sortCompare, LINE_H, LINE, LINE_SLOT, LINE_CARD, LINE_TRAY, LINE_LBL, LINE_STEP, LINE_TOP, GAME_LINE, lineX, lineNearest, ' +
                'digitsOf, sectionsOf, pad4, readSection, toChineseBig, compareSteps}',
    /* 三層題庫的選項不可以超出這一課宣告的九位數上限。 */
    optionValueMax: MAXN,

    check: function(data, I18N, fail, src){
      const LANGS = ['zh', 'en'];

      if (data.MAXN !== MAXN) fail(`the lesson's MAXN is ${data.MAXN}, this config assumes ${MAXN}`);

      /* --- 三層題庫：從題幹的數字重算一次正解（codex 審查 #1） ---
         `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，
         這一課一題都不符合 —— 在這之前把 ans:2 改成 ans:0 完全不會被抓到。 */
      Object.keys(BANK_EXPECTED).forEach(bank => {
        const spec = BANK_EXPECTED[bank];
        LANGS.forEach(L => {
          const items = I18N[L][bank];
          if (!Array.isArray(items) || items.length !== spec.length){
            fail(bank + ' ' + L + ': ' + (items ? items.length : 'no') +
                 ' questions, the oracle describes ' + spec.length);
            return;
          }
          items.forEach((q, i) => {
            const e = spec[i];
            const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
            const nums = (stem.match(/\d+/g) || []).map(Number);
            /* 位置式神諭擋不住「把題幹的 47530000 改成 47531000」——
               所以先把題幹的數字和神諭的清單**逐一對齊**，再從那些數算答案。
               只要求「有包含」不夠：把舊的數字當成「（例：47530000）」補回去，
               檢查就會靜靜放行（第三輪 codex #1）。 */
            const sortNum = a => a.slice().sort((x, y) => x - y).join(',');
            if (sortNum(nums) !== sortNum(e.nums))
              fail(bank + '[' + i + '] ' + L + ': stem prints [' + nums.join(',') +
                   '], the oracle expects exactly [' + e.nums.join(',') + ']');
            /* 這一課刻意不印千分位逗號（家長頁對大人講了這件事）——
               在這之前那條規則沒有任何檢查在盯。 */
            if (/\d,\d/.test(stem))
              fail(bank + '[' + i + '] ' + L + ': the stem uses a thousands separator, which this lesson deliberately avoids');
            let want;
            if (e.byDirection){
              const dir = directionFromStem(stem, L);
              if (!dir){
                fail(bank + '[' + i + '] ' + L + ': the stem says neither "biggest" nor "smallest" (or says both)');
                return;
              }
              const vals = q.opts.map(Number);
              want = String(dir === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals));
            } else if (e.compareUnits){
              const pairs = unitPairs(stem, L);
              if (pairs.length !== 2){
                fail(bank + '[' + i + '] ' + L + ': expected two "count + unit" phrases in the stem, parsed ' +
                     JSON.stringify(pairs));
                return;
              }
              const va = pairs[0][0] * P[pairs[0][1]], vb = pairs[1][0] * P[pairs[1][1]];
              const key = (va === vb) ? 'EQ' : (va > vb ? 'A' : 'B');
              want = e.labels[key][L];
            } else {
              want = e.calc(e.nums.length ? e.nums : nums, L);
            }
            /* 重算的結果還要和手寫的期望值對得上：兩份都錯才會漏，
               只有一份錯一定響。三條路徑都要比，不是只比 calc 那一條。 */
            if (want !== e[L])
              fail(bank + '[' + i + '] ' + L + ': recomputed "' + want +
                   '" but the oracle table says "' + e[L] + '"');
            if (String(q.opts[q.ans]).trim() !== String(want))
              fail(bank + '[' + i + '] ' + L + ': marked answer is "' + q.opts[q.ans] +
                   '", recomputed "' + want + '"');
            /* 解釋也要印出正解，不然算式和答案可以各說各話。 */
            /* 數字答案要比「整個數字 token」——子字串比對會把 400 認在 4000000 裡面
               （第二輪 codex #4）。文字答案（「一樣大」）才用子字串，並統一大小寫。
               ⚠️ 已知限制（第三輪 codex #4）：這只驗「解釋裡有沒有出現正解」，
               不驗它出現在什麼位置 —— 「常見錯誤答案是 35」這種句子也會過。
               要真的擋住得解析算式，代價比它擋到的東西高，所以留著並記在這裡。 */
            const whyPlain = String(q.why).replace(/<[^>]+>/g, ' ');
            const stated = /^\d+$/.test(String(want))
              ? (whyPlain.match(/\d+/g) || []).indexOf(String(want)) >= 0
              : whyPlain.toLowerCase().indexOf(String(want).toLowerCase()) >= 0;
            if (!stated)
              fail(bank + '[' + i + '] ' + L + ': the explanation never states the answer "' + want + '"');
          });
        });
      });

      /* --- 速查卡與家長頁：規則的措辭（codex 審查 #2） ---
         這兩頁在這之前一條斷言都沒有。三頁教的是同一條規則，只驗上課頁等於
         沒在盯另外兩頁。資料夾用 `process.argv[2]` 推出來，改壞測試才會讀到
         它自己複製出來的那一份 —— 用 __dirname 會讀到真的 repo，
         那條斷言就永遠是綠的。 */
      const target = process.argv[2];
      if (!target){
        fail('cannot locate the lesson folder (no target path in argv) — the sibling-page checks did not run');
      } else {
        const dir = path.dirname(target);
        Object.keys(SIBLING_RULES).forEach(page => {
          const rule = SIBLING_RULES[page];
          let html;
          try {
            html = fs.readFileSync(path.join(dir, page), 'utf8');
          } catch (err){
            fail('cannot read ' + page + ': ' + err.code);
            return;
          }
          /* HTML 註解裡的文字畫面上看不到，不可以拿來充數 —— 不然把規則從
             畫面上拿掉、再貼進一個註解，次數不變，檢查就靜靜放行
             （第三輪 codex #2；這正是本專案「用字串讀 HTML 會 fail open」的老毛病）。 */
          html = html.replace(/<!--[\s\S]*?-->/g, ' ');
          rule.must.forEach(entry => {
            const t = entry[0], need = entry[1];
            const got = html.split(t).length - 1;
            if (got < need)
              fail(page + ' no longer says "' + t + '" the required number of times (' +
                   got + ' of ' + need + ')');
          });
          rule.forbid.forEach(t => {
            if (html.indexOf(t) >= 0)
              fail(page + ' says "' + t + '", which contradicts the rule this lesson teaches');
          });
          if (rule.orderedZh){
            /* 位名表的順序：由高位到低位，每一格都要在、而且順序不能顛倒。 */
            const at = rule.orderedZh.map(w => html.indexOf('>' + w + '<'));
            at.forEach((v, i) => {
              if (v < 0) fail(page + ' place table is missing a cell for ' + rule.orderedZh[i]);
            });
            for (let i = 1; i < at.length; i++){
              if (at[i - 1] >= 0 && at[i] >= 0 && at[i] < at[i - 1])
                fail(page + ' place table has ' + rule.orderedZh[i] + ' before ' + rule.orderedZh[i - 1]);
            }
          }
        });
      }

      /* --- 字典的位名／單位詞表要和這份設定的真值表逐字相同 --- */
      LANGS.forEach(L => {
        [['places', PLACES, 'place-name'], ['units', UNITS, 'unit']].forEach(([key, table, label]) => {
          const got = I18N[L][key];
          if (!Array.isArray(got) || got.length !== 9)
            return fail(`${L}.${key} is not a 9-entry ${label} table`);
          got.forEach((w, i) => {
            if (w !== table[L][i]) fail(`${L}.${key}[${i}] is "${w}", the ${label} table says "${table[L][i]}"`);
          });
        });
      });

      /* --- 中文讀法：把 toChineseBig 真的跑起來，比對手寫的期望值 --- */
      Object.keys(READ_EXPECTED).forEach(k => {
        const n = Number(k);
        const got = data.toChineseBig(n);
        if (got !== READ_EXPECTED[k])
          fail(`toChineseBig(${n}) = "${got}", expected "${READ_EXPECTED[k]}"`);
      });
      /* 期望值表本身要真的蓋到補零的三條規則，否則上面那一圈可能什麼都沒證明。 */
      const keys = Object.keys(READ_EXPECTED).map(Number);
      if (!keys.some(n => n >= 100000000 && Math.floor(n / 10000) % 10000 > 0 && Math.floor(n / 10000) % 10000 < 1000))
        fail('READ_EXPECTED never exercises "a yi group plus a wan group under 1000" (zero rule 1)');
      if (!keys.some(n => n >= 100000000 && Math.floor(n / 10000) % 10000 === 0 && n % 10000 > 0))
        fail('READ_EXPECTED never exercises "a yi group plus an all-zero wan group" (zero rule 2)');
      if (!keys.some(n => n > 10000 && n % 10000 > 0 && n % 10000 < 1000))
        fail('READ_EXPECTED never exercises "a ones group under 1000" (zero rule 3)');

      /* --- 三個節的切法：sectionsOf 要能把數重新組回來 --- */
      [0, 1, 9999, 10000, 99999999, 100000000, MAXN]
        .concat(data.PLACE_NUMS, data.READ_NUMS)
        .forEach(n => {
          const s = data.sectionsOf(n);
          if (s.yi * 100000000 + s.wan * 10000 + s.ge !== n) fail(`sectionsOf(${n}) does not rebuild n`);
          if (s.wan < 0 || s.wan > 9999 || s.ge < 0 || s.ge > 9999)
            fail(`sectionsOf(${n}) has a section outside 0~9999`);
          /* 只驗長度會 fail-open（codex 審查 #7）：永遠回傳 '0000' 也是四個字。
             拿獨立補出來的字串逐字比。 */
          const want4 = ('0000' + s.ge).slice(-4);
          if (data.pad4(s.ge) !== want4) fail(`pad4(${s.ge}) = "${data.pad4(s.ge)}", expected "${want4}"`);
        });

      /* --- 範例 1：位值表 --- */
      data.PLACE_NUMS.forEach(n => {
        if (n > MAXN) fail(`PLACE_NUMS ${n} above the lesson range`);
        if (String(n).length < 8) fail(`PLACE_NUMS ${n} is smaller than 8 digits — too easy for this lesson`);
        const dg = data.digitsOf(n);
        if (dg.length !== 9) fail(`digitsOf(${n}) returned ${dg.length} digits`);
        /* 只驗加權和會 fail-open（codex 審查 #4）：回傳 [n,0,0,…] 也「組得回 n」，
           畫面上卻會說整個數都是「幾個一」。每一位要各自等於獨立算出來的那一位。 */
        dg.forEach((v, i) => {
          if (!Number.isInteger(v) || v < 0 || v > 9) fail(`digitsOf(${n})[${i}] = ${v} is not a digit`);
          if (v !== digitAt(n, i)) fail(`digitsOf(${n})[${i}] = ${v}, the place says ${digitAt(n, i)}`);
        });
        let rebuilt = 0;
        dg.forEach((v, i) => { rebuilt += v * P[i]; });
        if (rebuilt !== n) fail(`digitsOf(${n}) does not rebuild n`);
        LANGS.forEach(L => {
          const parts = [];
          for (let p = 8; p >= 0; p--) if (dg[p] > 0) parts.push(I18N[L].s1part(dg[p], I18N[L].units[p]));
          const line = I18N[L].s1read(n, parts);
          if (/undefined|NaN/.test(line)) fail(`s1read ${L} ${n}: ${line}`);
          if (line.indexOf(String(n)) < 0) fail(`s1read ${L} ${n} does not print the number`);
        });
      });
      /* 這一課的兩個重點：中間有 0 的位、以及真的用到億位的數。 */
      if (!data.PLACE_NUMS.some(n => /\d0\d/.test(String(n))))
        fail('PLACE_NUMS has no number with a 0 in the middle (the placeholder case)');
      if (!data.PLACE_NUMS.some(n => n >= 100000000))
        fail('PLACE_NUMS has no number reaching the hundred-millions place');

      /* --- 範例 2：四位一節與讀法 --- */
      data.READ_NUMS.forEach(n => {
        if (n > MAXN) fail(`READ_NUMS ${n} above the lesson range`);
        if (READ_EXPECTED[n] === undefined) fail(`READ_NUMS ${n} has no hand-written reading in this config`);
        LANGS.forEach(L => {
          const line = I18N[L].s2line(n, data.sectionsOf(n));
          if (/undefined|NaN/.test(line)) fail(`s2line ${L} ${n}: ${line}`);
          if (line.indexOf(String(n)) < 0) fail(`s2line ${L} ${n} does not print the number`);
        });
        if (READ_EXPECTED[n] !== undefined){
          const zh = I18N.zh.s2line(n, data.sectionsOf(n));
          if (zh.indexOf(READ_EXPECTED[n]) < 0)
            fail(`s2line zh ${n} does not contain the reading ${READ_EXPECTED[n]}`);
        }
      });
      if (!data.READ_NUMS.some(n => n >= 100000000))
        fail('READ_NUMS never shows a three-group number');
      if (!data.READ_NUMS.some(n => n % 10000 > 0 && n % 10000 < 1000))
        fail('READ_NUMS never shows the spoken-zero case');

      /* --- 範例 3：化聚 --- */
      data.REGROUP_NUMS.forEach(n => {
        if (n > MAXN) fail(`REGROUP_NUMS ${n} above the lesson range`);
        if (n % 10000 !== 0)
          fail(`REGROUP_NUMS ${n} is not a whole number of ten-thousands, so the divide-by-10000 line would round`);
        LANGS.forEach(L => {
          const w = I18N[L].s3wan(n, Math.floor(n / 10000));
          const q = I18N[L].s3qian(n, Math.floor(n / 1000));
          if (/undefined|NaN/.test(w + q)) fail(`s3 ${L} ${n}: ${w} / ${q}`);
          if (w.indexOf(String(Math.floor(n / 10000))) < 0) fail(`s3wan ${L} ${n} does not print ${Math.floor(n / 10000)}`);
          if (q.indexOf(String(Math.floor(n / 1000))) < 0) fail(`s3qian ${L} ${n} does not print ${Math.floor(n / 1000)}`);
          if (n >= 100000000){
            const yi = Math.floor(n / 100000000);
            const rest = Math.floor((n - yi * 100000000) / 10000);
            const line = I18N[L].s3yi(yi, rest);
            if (/undefined|NaN/.test(line)) fail(`s3yi ${L} ${n}: ${line}`);
            if (line.indexOf(String(yi)) < 0) fail(`s3yi ${L} ${n} does not print ${yi}`);
            if (rest > 0 && line.indexOf(String(rest)) < 0) fail(`s3yi ${L} ${n} does not print the leftover ${rest}`);
          }
        });
      });
      if (!data.REGROUP_NUMS.some(n => n >= 100000000))
        fail('REGROUP_NUMS never reaches a hundred-million, so the yi line is never shown');

      /* --- 範例 4：比大小 --- */
      data.PAIRS.forEach(p => {
        if (p.a === p.b) fail(`PAIRS ${p.a}/${p.b} are equal, so there is nothing to compare`);
        if (p.a > MAXN || p.b > MAXN) fail(`PAIRS ${p.a}/${p.b} above the lesson range`);
        const steps = data.compareSteps(p.a, p.b);
        if (!Array.isArray(steps) || !steps.length){
          /* 空陣列的話下一行 last.kind 會直接丟例外，整份報告變成 stack trace，
             真正的錯誤訊息反而看不到（第三輪 codex #7）。要響亮地失敗。 */
          fail(`compareSteps ${p.a}/${p.b} returned no steps`);
          return;
        }
        const last = steps[steps.length - 1];
        const sameLen = String(p.a).length === String(p.b).length;
        const big = Math.max(p.a, p.b);
        if (sameLen){
          if (last.kind !== 'digit'){
            fail(`compareSteps ${p.a}/${p.b} never reaches a deciding digit`);
            return;
          }
          /* 決勝位要獨立算一次：第一個不同的位。 */
          const sa = String(p.a), sb = String(p.b);
          let idx = -1;
          for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]){ idx = i; break; }
          if (last.idx !== idx) fail(`compareSteps ${p.a}/${p.b} decides at index ${last.idx}, first difference is at ${idx}`);
          if (last.place !== sa.length - 1 - idx) fail(`compareSteps ${p.a}/${p.b} reports the wrong place index`);
        } else if (last.kind !== 'digitcount'){
          fail(`compareSteps ${p.a}/${p.b} should decide on the digit count`);
          return;
        }
        if ((last.winner === 'a' ? p.a : p.b) !== big)
          fail(`compareSteps ${p.a}/${p.b} picked the smaller number as the winner`);
        /* 每一步都要對得上畫面會講的話（codex 審查 #5）：在這之前只驗了決勝的
           index/place/winner，`da`／`db` 和前面每一個 tie 步驟完全沒被看過 ——
           回傳 da:0, db:9 仍然全綠，孩子卻讀到一組假的數字。 */
        const sa = String(p.a), sb = String(p.b);
        /* 只驗「存在的步驟」會 fail-open（第二輪 codex #5）：整段 tie 拿掉之後
           剩下的步驟仍然全對，可是畫面上就少了一位一位比的過程。
           所以先驗整串的形狀，再驗每一步的內容。 */
        if (sameLen){
          let firstDiff = -1;
          for (let k = 0; k < sa.length; k++) if (sa[k] !== sb[k]){ firstDiff = k; break; }
          const wantKinds = ['samecount'].concat(new Array(firstDiff).fill('tie')).concat(['digit']);
          const gotKinds = steps.map(st => st.kind);
          if (gotKinds.join(',') !== wantKinds.join(','))
            fail(`compareSteps ${p.a}/${p.b} step shape is ${gotKinds.join(',')}, expected ${wantKinds.join(',')}`);
          /* 只數 tie 的「個數」不夠：三步都指著第 0 位也會過，中間兩位就沒人講解
             （第三輪 codex #3）。index 必須是 0,1,…,firstDiff-1 這個序列。 */
          const tieIdx = steps.filter(st => st.kind === 'tie').map(st => st.idx).join(',');
          const wantTie = Array.from({ length: firstDiff }, (_, k) => k).join(',');
          if (tieIdx !== wantTie)
            fail(`compareSteps ${p.a}/${p.b} tie indices are [${tieIdx}], expected [${wantTie}]`);
        } else if (steps.length !== 1 || steps[0].kind !== 'digitcount'){
          fail(`compareSteps ${p.a}/${p.b} should be a single digitcount step, got ${steps.map(st => st.kind).join(',')}`);
        }
        steps.forEach(st => {
          if (st.kind === 'tie'){
            if (Number(sa[st.idx]) !== st.d || Number(sb[st.idx]) !== st.d)
              fail(`compareSteps ${p.a}/${p.b} tie at index ${st.idx} says ${st.d}, digits are ${sa[st.idx]}/${sb[st.idx]}`);
            if (st.place !== sa.length - 1 - st.idx)
              fail(`compareSteps ${p.a}/${p.b} tie at index ${st.idx} reports place ${st.place}`);
          }
          if (st.kind === 'digit'){
            if (Number(sa[st.idx]) !== st.da || Number(sb[st.idx]) !== st.db)
              fail(`compareSteps ${p.a}/${p.b} deciding step says ${st.da}/${st.db}, digits are ${sa[st.idx]}/${sb[st.idx]}`);
          }
          if (st.kind === 'samecount' && st.len !== sa.length)
            fail(`compareSteps ${p.a}/${p.b} says ${st.len} digits, actually ${sa.length}`);
          if (st.kind === 'digitcount' && (st.la !== sa.length || st.lb !== sb.length))
            fail(`compareSteps ${p.a}/${p.b} reports digit counts ${st.la}/${st.lb}, actually ${sa.length}/${sb.length}`);
        });
        LANGS.forEach(L => {
          const t = sameLen
            ? I18N[L].s4digit(last.place, last.da, last.db, big, I18N[L].places[last.place])
            : I18N[L].s4digitcount(String(p.a).length, String(p.b).length, p.a, p.b, big);
          if (/undefined|NaN/.test(t)) fail(`compare text ${L} ${p.a}/${p.b}: ${t}`);
          if (t.indexOf(String(big)) < 0) fail(`compare text ${L} ${p.a}/${p.b} does not name the winner`);
          if (sameLen && t.indexOf(I18N[L].places[last.place]) < 0)
            fail(`compare text ${L} ${p.a}/${p.b} does not name the deciding place`);
        });
      });
      if (!data.PAIRS.some(p => String(p.a).length !== String(p.b).length))
        fail('PAIRS has no pair with a different number of digits (the more-digits-wins case)');
      if (!data.PAIRS.some(p => String(p.a).length === String(p.b).length && String(p.a)[0] === String(p.b)[0]))
        fail('PAIRS has no pair that ties on the leading digit (the look-at-the-next-place case)');

      /* --- 範例 5：數線 --- */
      if (data.LINE_MAX !== 100000000) fail(`LINE_MAX is ${data.LINE_MAX}, the lesson says the line runs to 100000000`);
      data.LINE_NUMS.forEach(n => {
        if (n <= 0 || n >= data.LINE_MAX) fail(`LINE_NUMS ${n} outside the number line 0~${data.LINE_MAX}`);
        /* 「最靠近的整千萬」要唯一 —— 剛好在兩個整千萬正中間時那句話是假的。 */
        if (n % 10000000 === 5000000)
          fail(`LINE_NUMS ${n} sits exactly halfway between two ten-millions, so "closest" is not unique`);
        const nearest = Math.round(n / 10000000) * 10000000;
        LANGS.forEach(L => {
          const t = I18N[L].s5explain(n, nearest);
          if (/undefined|NaN/.test(t)) fail(`s5explain ${L} ${n}: ${t}`);
          if (t.indexOf(String(nearest)) < 0) fail(`s5explain ${L} ${n} does not print the nearest ten-million`);
        });
      });

      /*@@GAME@@*/
      gameChecks(data, I18N, fail, src);
    }
  }
};
