/* 數「出現幾次」也要看邊界，不然「8 are taken out」會在「Another 28 are taken out」
   裡面被算到一次。規則和 hasPhrase 一樣：開頭／結尾是數字就補數字邊界，是字母就補 \b。 */
function escRe(t){ return String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function countPhrase(text, phrase){
  const p = String(phrase);
  const left  = /^[0-9]/.test(p) ? '(?<![0-9])' : (/^[A-Za-z]/.test(p) ? '\\b' : '');
  const right = /[0-9]$/.test(p) ? '(?![0-9])'  : (/[A-Za-z]$/.test(p) ? '\\b' : '');
  const hits = String(text).match(new RegExp(left + escRe(p) + right, 'g'));
  return hits ? hits.length : 0;
}
const MEASURABLE = ['rect', 'text'];
/* 幾何屬性可能寫在 presentation attribute 上，也可能寫在 style="" 裡。只讀前者的話，
   把 stroke-width 搬進 style 就會讓描邊寬度靜靜變成 0（fail-open）。 */
function attrOrStyle(attrs, name){
  const direct = attrs.match(new RegExp('(?:^|\\s)' + name + '=["\']([\\d.]+)["\']'));
  if (direct) return direct[1];
  const style = attrs.match(/(?:^|\s)style=["']([^"']*)["']/);
  if (style){
    const inStyle = style[1].match(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([\\d.]+)'));
    if (inStyle) return inStyle[1];
  }
  return null;
}
/* 解析不了的東西一律判錯，不要猜：class 指向外部樣式表，transform 會整個搬動座標。
   單引號和雙引號都要認 —— 只認雙引號的話，style='stroke-width:120' 會整條繞過去。 */
function styleOk(label, attrs){
  if (/(?:^|\s)class=["']/.test(attrs)) return label + ': an element carries a class, so its geometry cannot be resolved here';
  if (/(?:^|\s)transform=["']/.test(attrs)) return label + ': an element carries a transform, so its geometry cannot be resolved here';
  const style = attrs.match(/(?:^|\s)style=["']([^"']*)["']/);
  if (style && /transform|scale|translate|zoom/.test(style[1])){
    return label + ': an element has a transforming style, so its geometry cannot be resolved here';
  }
  return null;
}

/* grade-2/math/two-step（兩步驟問題：加減混合）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的關鍵是「中間數不是答案」：
   - 每一題都有兩個數會被算出來 —— 中間數 mid ＝ a o1 b，答案 ans ＝ mid o2 c；
   - 迷思誘答就是 mid 本身，所以 mid 一定要在選項裡（hasMid），
     而且 mid 絕對不可以等於 ans（不然迷思誘答會塌到正解上，孩子答對也被判錯）；
   - 中途的數不可以是 0 或負數（二年級還沒有負數）。

   兩個「守門員自己容易有的洞」在這裡特別小心：
   1. 正解字串由這個設定檔自己的情境表（SCENE_TRUTH）從原始參數重算，
      完全不呼叫 review.html 的 qtyItem／phrStr —— 那等於自己比自己。
   2. 用索引取值前先驗索引合法（d.ans_i 越界時 d.opts[d.ans_i] 是 undefined，
      而 undefined 的比較全是 false，整題沒被驗到卻是綠的）。 */

/* 這一課自己的數字上限。兩步驟的內容（含進階）一律 200 以內 ——
   這是課程頁 qsAdv 用到的最大值（193）所在的量級，也是 review.html 的 MAXV。
   交錯進來的「1000 以內的數」是另一課的範圍，只有 placeValue 放到 999。 */
const MAXV = 200;
/* 基礎層（範例、遊戲、qs 題庫）留在 100 以內 —— 課程頁自己講的年段範圍。 */
const BASE_MAX = 100;
const MAX_PLACE = 999;

/* ---------- 設定檔自己的情境表（和 review.html 的 SCENES 對齊，但是獨立的一份） ---------- */
const SCENE_TRUTH = [
  { icon:'🍪', zh:{ thing:'餅乾', unit:'片', place:'盤子上', add:'放上', sub:'吃掉' },
    en:{ item:'biscuit', itemN:'biscuits', place:'on the plate',  add:'put on the plate',  sub:'eaten' } },
  { icon:'📚', zh:{ thing:'書',   unit:'本', place:'書架上', add:'放上', sub:'借走' },
    en:{ item:'book',    itemN:'books',    place:'on the shelf',  add:'put on the shelf',  sub:'borrowed' } },
  { icon:'🍬', zh:{ thing:'糖果', unit:'顆', place:'袋子裡', add:'放進', sub:'送出' },
    en:{ item:'sweet',   itemN:'sweets',   place:'in the bag',    add:'put in the bag',    sub:'given away' } },
  { icon:'🍎', zh:{ thing:'蘋果', unit:'個', place:'籃子裡', add:'放進', sub:'拿走' },
    en:{ item:'apple',   itemN:'apples',   place:'in the basket', add:'put in the basket', sub:'taken out' } }
];
function fItem(si, n, lang){
  const s = SCENE_TRUTH[si];
  return lang === 'zh' ? (n + ' ' + s.zh.unit) : (n + ' ' + (n === 1 ? s.en.item : s.en.itemN));
}
/* 「第一件事做完之後」那個片語的第二套實作。midMeaning 的正解就是它。 */
function fAfter1(si, n, o1, lang){
  const s = SCENE_TRUTH[si];
  if (lang === 'zh'){
    return o1 === '-' ? (s.zh.sub + '之後還剩 ' + n + ' ' + s.zh.unit)
                      : (s.zh.add + '之後一共有 ' + n + ' ' + s.zh.unit);
  }
  return o1 === '-' ? (n + ' ' + s.en.itemN + ' were left after some were ' + s.en.sub)
                    : ('there were ' + n + ' ' + s.en.itemN + ' after more were ' + s.en.add);
}

/* ---------- 共用的不變條件 ---------- */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'item') return 'item#' + v.n;
  if (v.u === 'raw')  return 'raw#' + v.n;
  if (v.u === 'phr')  return 'phr#' + v.p + '#' + v.n;
  return 'bad';
}
function distinctOpts(d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'option count is not 4';
  const keys = d.opts.map(keyOf);
  for (let i = 0; i < keys.length; i++){
    if (keys[i] === 'bad') return 'option ' + i + ' is not a value object this lesson knows';
    for (let j = i + 1; j < keys.length; j++){
      if (keys[i] === keys[j]) return 'two options are the same answer: ' + keys[i];
    }
  }
  return null;
}
/* 索引先驗合法，否則 d.opts[d.ans_i] 是 undefined，後面每一條比對都變成
   undefined 對 undefined —— 整題沒被驗到卻是綠的。 */
function indexOk(d){
  if (!Number.isInteger(d.ans_i) || d.ans_i < 0 || d.ans_i >= (d.opts || []).length){
    return 'ans_i ' + d.ans_i + ' is not a valid option index';
  }
  if (d.opts[d.ans_i] !== d.correct) return 'opts[ans] is not the correct value object';
  return null;
}
/* 帶單位／片語的選項一定要用「這一題自己的情境」。少了這一條，一題餅乾題裡
   冒出「5 顆」也會通過：形狀對、去重也過，孩子卻看到不相干的單位。 */
function optScenesOk(d){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || (o.u !== 'item' && o.u !== 'phr')) continue;
    if (!Number.isInteger(o.si) || o.si !== d.si){
      return 'option ' + i + ' uses scene ' + o.si + ', but the question is scene ' + d.si;
    }
  }
  return null;
}
function sceneOk(d){
  if (!Number.isInteger(d.si) || d.si < 0 || d.si >= SCENE_TRUTH.length){
    return 'scene index ' + d.si + ' is outside the checker catalogue (0~' + (SCENE_TRUTH.length - 1) + ')';
  }
  return null;
}
function base(d){ return indexOk(d) || distinctOpts(d) || optScenesOk(d); }

/* 兩步驟的算術：mid 與 ans 都從原始參數重算一次，再跟產生器記下來的比。 */
function twoStepOk(d, want){
  if (![d.a, d.b, d.c].every(Number.isInteger)) return 'a / b / c must all be whole numbers';
  if (d.o1 !== '+' && d.o1 !== '-') return 'unknown first operation ' + d.o1;
  if (d.o2 !== '+' && d.o2 !== '-') return 'unknown second operation ' + d.o2;
  const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
  const ans = d.o2 === '+' ? (mid + d.c) : (mid - d.c);
  /* 中間數等於答案的話，迷思誘答就塌到正解上 —— 孩子答對也會被判錯。
     這只有在 c ＝ 0 時才發生，所以要排在「a／b／c ≥ 1」前面，
     不然那條先擋掉，這一條就永遠不會響（改壞測試證明了這件事）。 */
  if (mid === ans) return 'the middle number must not equal the answer (' + mid + ')';
  if (!(d.a >= 1 && d.b >= 1 && d.c >= 1)) return 'a / b / c must all be at least 1';
  /* 上限只管 mid／ans 是不夠的：題幹印出來的是 a／b／c，它們自己也要在範圍裡。 */
  if (d.a > MAXV || d.b > MAXV || d.c > MAXV) return 'a / b / c must all be at most ' + MAXV;
  if (mid < 1) return 'the middle number must be at least 1, got ' + mid;
  if (ans < 1) return 'the answer must be at least 1, got ' + ans;
  if (mid > MAXV) return 'the middle number ' + mid + ' is outside 1~' + MAXV;
  if (ans > MAXV) return 'the answer ' + ans + ' is outside 1~' + MAXV;
  if (d.mid !== mid) return 'd.mid is ' + d.mid + ', recomputed ' + mid;
  if (d.ans !== ans) return 'd.ans is ' + d.ans + ', recomputed ' + ans;
  const got = d.correct && d.correct.n;
  if (want === 'ans' && got !== ans) return 'the marked answer must be the final answer ' + ans + ', got ' + got;
  if (want === 'mid' && got !== mid) return 'the marked answer must be the middle number ' + mid + ', got ' + got;
  return null;
}
/* 中間數不可以剛好等於題幹印出來的某個數。這一課的片語選項（midMeaning）四個都帶
   同一個 mid —— 那是刻意的，題目問的就是「這個數代表什麼」，四個選項是四種說法，
   只有一種為真（和 grade-2/divide 的 meaningOf 同一個設計）。但正因為 noEcho 對片語
   選項無從比對，mid 撞上 a／b／c 的情況一定要在這裡擋掉。 */
function midIsFresh(d){
  const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
  if (mid === d.a || mid === d.b || mid === d.c){
    return 'the middle number ' + mid + ' must differ from every number printed in the stem';
  }
  return null;
}
/* 迷思誘答（中間數本身）一定要在選項裡，不然這一題就抓不到那個迷思。 */
function hasMid(d){
  const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
  const seen = d.opts.some(o => o && o.u === 'item' && o.n === mid);
  return seen ? null : 'this question needs the middle number ' + mid + ' as a distractor';
}
/* 誘答不可以把題幹印出來的數字原封不動抄回來。allow 是「刻意的那一個值」——
   只放行那一個數，不是整個產生器全開（stopTooEarly 的題幹自己印了中間數）。
   simgen 內建的那條「誘答抄題幹」在這一課永遠不會響（選項帶單位，字串比不到），
   所以真正在把關的是這一條。 */
function noEcho(d, nums, allow){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans_i) continue;
    const o = d.opts[i];
    if (!o || (o.u !== 'item' && o.u !== 'raw')) continue;
    if (nums.indexOf(o.n) >= 0 && o.n !== allow){
      return 'distractor ' + o.n + ' is copied straight out of the stem';
    }
  }
  return null;
}

/* 渲染出來的題幹要和 o1／o2 對得上。算術層全對、選項全對，但把「放上 5 片」
   印成「吃掉 5 片」時，資料層看不出任何異狀 —— 孩子讀到的卻是另一道題。
   所以這裡從 SCENE_TRUTH 自己組出「這一步應該長什麼樣」的片語，再去 d.stems
   （make() 時就存好、fmt() 直接拿去用的那一份）裡找，而且要照順序出現。 */
function evPhrase(si, op, n, second, lang){
  const t = SCENE_TRUTH[si];
  if (lang === 'zh'){
    return (second ? '又' : '') + (op === '+' ? t.zh.add : t.zh.sub) + ' ' + n + ' ' + t.zh.unit;
  }
  return op === '+'
    ? ((second ? 'Another ' + n : n + ' more') + ' are ' + t.en.add)
    : ((second ? 'Another ' + n : String(n)) + ' are ' + t.en.sub);
}
function evPhraseAt(si, op, n, when, lang){
  const t = SCENE_TRUTH[si];
  return lang === 'zh'
    ? (when + (op === '+' ? t.zh.add : t.zh.sub) + ' ' + n + ' ' + t.zh.unit)
    : (when + ' ' + n + ' are ' + (op === '+' ? t.en.add : t.en.sub));
}
const WHEN_TRUTH = { zh:{ w2:'中午', w3:'下午' }, en:{ w2:'At noon', w3:'In the afternoon' } };
/* 題幹裡「一開始有多少」的那一句。渲染成「There are 9 biscuits」時，兩個事件都還對，
   算術也還對 —— 只有把起始量也綁進來才抓得到。 */
function startPhrase(si, a, lang){
  const t = SCENE_TRUTH[si];
  return lang === 'zh' ? (t.zh.place + '有 ' + a + ' ' + t.zh.unit + t.zh.thing)
                       : (a + ' ' + t.en.itemN + ' ' + t.en.place);
}
/* 題目最後問的是什麼。問「第一件事之後有幾個」和問「現在有幾個」的正解不一樣，
   所以問句也要獨立記下來比對。 */
function askPhrase(si, kind, mid, lang){
  const t = SCENE_TRUTH[si];
  if (kind === 'now')     return lang === 'zh' ? ('現在有幾' + t.zh.unit + '？') : ('How many ' + t.en.itemN + ' are there now?');
  if (kind === 'correct') return lang === 'zh' ? ('正確答案是幾' + t.zh.unit + '？') : 'What is the correct answer?';
  if (kind === 'meaning') return lang === 'zh' ? ('這個 ' + mid + ' 是什麼意思？') : ('What does that ' + mid + ' mean?');
  return lang === 'zh' ? ('這時候有幾' + t.zh.unit + '？') : ('how many ' + t.en.itemN + ' are there?');
}
/* 渲染出來的題幹要和 o1／o2、起始量、問句全部對得上，而且每一句只能出現一次 ——
   多印一句「放上 5 片」時，數字集合、每個 mark、算術全都還成立，正解卻已經變了。 */
function stemEventsOk(d, sameOpWording, timeMarked, askKind){
  for (const lang of ['zh', 'en']){
    const st = d.stems && d.stems[lang];
    if (!st) return 'this question did not record its rendered stem for ' + lang;
    if (st.indexOf(SCENE_TRUTH[d.si].icon) < 0){
      return lang + ' stem does not show the scene icon for scene ' + d.si;
    }
    const start = startPhrase(d.si, d.a, lang);
    if (countPhrase(st, start) !== 1){
      return lang + ' stem must say "' + start + '" exactly once (the starting amount)';
    }
    const ask = askPhrase(d.si, askKind, d.mid, lang);
    if (countPhrase(st, ask) !== 1){
      return lang + ' stem must ask "' + ask + '" exactly once';
    }
    let want;
    if (timeMarked){
      /* 句序被刻意打亂的那一題：兩句都要在，但先後不比對。 */
      want = [evPhraseAt(d.si, d.o2, d.c, WHEN_TRUTH[lang].w3, lang),
              evPhraseAt(d.si, d.o1, d.b, WHEN_TRUTH[lang].w2, lang)];
    } else {
      want = [evPhrase(d.si, d.o1, d.b, false, lang),
              evPhrase(d.si, d.o2, d.c, sameOpWording && d.o1 === d.o2, lang)];
    }
    let prev = -1;
    for (const mk of want){
      const hits = countPhrase(st, mk);
      if (hits === 0){
        return lang + ' stem never says "' + mk + '" — the rendered verb no longer matches the operation';
      }
      if (hits > 1){
        return lang + ' stem says "' + mk + '" ' + hits + ' times; each event must be rendered exactly once';
      }
      const at = st.indexOf(mk);
      if (!timeMarked && at < prev){
        return lang + ' stem renders the two events in the wrong order';
      }
      prev = at;
    }
  }
  return null;
}

function svgBoxOk(label, svg){
  const root = String(svg).match(/^<svg\b([^>]*)>/);
  if (!root) return label + ': cannot find the root <svg> tag';
  const at = root[1];
  const w = Number((at.match(/(?:^|\s)width="(\d+)"/) || [])[1]);
  const h = Number((at.match(/(?:^|\s)height="(\d+)"/) || [])[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h)){
    return label + ': the root <svg> has no readable width/height';
  }
  const vb = at.match(/(?:^|\s)viewBox="0 0 (\d+) (\d+)"/);
  if (!vb || Number(vb[1]) !== w || Number(vb[2]) !== h){
    return label + ': the viewBox does not match the canvas (' + w + ' x ' + h + ')';
  }
  const xs = [], ys = [], xsL = [], ysT = [];
  let seen = 0, m;
  const reRect = /<rect\b([^>]*)>/g;
  while ((m = reRect.exec(svg)) !== null){
    const a = m[1];
    const xm = a.match(/(?:^|\s)x="(-?\d+(?:\.\d+)?)"/);
    const ym = a.match(/(?:^|\s)y="(-?\d+(?:\.\d+)?)"/);
    const wm = a.match(/(?:^|\s)width="(\d+(?:\.\d+)?)"/);
    const hm = a.match(/(?:^|\s)height="(\d+(?:\.\d+)?)"/);
    if (!xm || !ym || !wm || !hm){
      return label + ': a <rect> is missing x/y/width/height, so its box cannot be measured';
    }
    /* 描邊是往矩形外面畫一半的，所以真正的邊緣要再往外推 stroke-width / 2。 */
    const styleBad = styleOk(label, a);
    if (styleBad) return styleBad;
    const sw = Number(attrOrStyle(a, 'stroke-width') || 0) / 2;
    const x = Number(xm[1]), y = Number(ym[1]);
    xsL.push(x - sw); ysT.push(y - sw);
    xs.push(x + Number(wm[1]) + sw); ys.push(y + Number(hm[1]) + sw);
    seen++;
  }
  const reText = /<text\b([^>]*)>([^<]*)<\/text>/g;
  while ((m = reText.exec(svg)) !== null){
    const a = m[1], body = m[2];
    const xm = a.match(/(?:^|\s)x="(-?\d+(?:\.\d+)?)"/);
    const ym = a.match(/(?:^|\s)y="(-?\d+(?:\.\d+)?)"/);
    const styleBad = styleOk(label, a);
    if (styleBad) return styleBad;
    const fmv = attrOrStyle(a, 'font-size');
    if (!xm || !ym || fmv === null){
      return label + ': a <text> is missing x/y/font-size, so its box cannot be measured';
    }
    const x = Number(xm[1]), y = Number(ym[1]), fs = Number(fmv);
    const anchor = (a.match(/(?:^|\s)text-anchor=["']([a-z]+)["']/) || [])[1] || 'start';
    const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
    /* 文字也可能有描邊，而描邊一樣是往外畫一半 —— 矩形算了、文字不算的話，
       一個 stroke-width:120 的標籤可以把四個邊都畫出畫布而檢查照樣是綠的。 */
    const tsw = Number(attrOrStyle(a, 'stroke-width') || 0) / 2;
    xs.push((anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide)) + tsw);
    xsL.push((anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x)) - tsw);
    /* y 是基線：上緣約在基線往上一個字級，下緣是往下的降部。 */
    ys.push(y + Math.ceil(fs * 0.25) + tsw);
    ysT.push(y - fs - tsw);
    seen++;
  }
  const tags = (String(svg).match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
  const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
  if (unsupported.length){
    return label + ': draws <' + unsupported[0] + '>, which the geometry reader cannot measure';
  }
  const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
  if (seen !== rawCount){
    return label + ': the geometry reader measured ' + seen + ' of ' + rawCount + ' drawn elements';
  }
  if (!xs.length) return label + ': nothing measurable is drawn';
  const right = Math.max.apply(null, xs), bottom = Math.max.apply(null, ys);
  const left = Math.min.apply(null, xsL), top = Math.min.apply(null, ysT);
  if (!(w >= right + 2)) return label + ' is ' + w + 'px wide but draws out to x=' + right;
  if (!(h >= bottom + 2)) return label + ' is ' + h + 'px tall but draws out to y=' + bottom;
  if (left < 0) return label + ' is clipped by the left edge (draws out to x=' + left + ')';
  if (top < 0) return label + ' is clipped by the top edge (draws out to y=' + top + ')';
  return null;
}
/* 兩種語言的標籤字數不一樣（開始／start、中間數／middle），所以兩張圖都要量。 */
function flowOk(d){
  if (!d.flow || !d.flow.zh || !d.flow.en) return 'this question should carry a flow diagram';
  return svgBoxOk('flowSVG(zh)', d.flow.zh) || svgBoxOk('flowSVG(en)', d.flow.en);
}

/* 每個產生器的選項可以長什麼樣，以及數字的範圍。
   每一條都要寫得出「這個上限是怎麼算出來的」—— 隨手給一個大數等於沒有範圍檢查。 */
const SHAPE = {
  twoAddSub:    ['item'],
  twoSubAdd:    ['item'],
  twoAddAdd:    ['item'],
  twoSubSub:    ['item'],
  stopTooEarly: ['item'],
  midMeaning:   ['phr'],
  midValue:     ['item'],
  outOfOrder:   ['item'],
  oneStep:      ['raw'],
  placeValue:   ['raw']
};
const RANGE = {
  /* 兩步驟的內容一律 1~200（review.html 的 MAXV；itIn／rawIn 也是用它擋保底）。 */
  twoAddSub:    [1, MAXV],
  twoSubAdd:    [1, MAXV],
  twoAddAdd:    [1, MAXV],
  twoSubSub:    [1, MAXV],
  stopTooEarly: [1, MAXV],
  midMeaning:   [1, MAXV],
  midValue:     [1, MAXV],
  outOfOrder:   [1, MAXV],
  oneStep:      [1, MAXV],
  /* 交錯進來的「1000 以內的數」是另一課的範圍，這一個產生器才放到 999。 */
  placeValue:   [1, MAX_PLACE]
};

/* 選項字串的形狀。單位詞與動詞的清單就是 SCENE_TRUTH 裡的那些，不多不少。 */
const ZH_UNIT = '片|本|顆|個';
const ZH_ADD = '放上|放進';
const ZH_SUB = '吃掉|借走|送出|拿走';
const EN_ITEM = 'biscuits?|books?|sweets?|apples?';
const EN_ITEMN = 'biscuits|books|sweets|apples';
const EN_ADD = 'put on the plate|put on the shelf|put in the bag|put in the basket';
const EN_SUB = 'eaten|borrowed|given away|taken out';
const EN_SING = ['biscuit','book','sweet','apple'];
const EN_PLUR = ['biscuits','books','sweets','apples'];
const SHAPES = {
  zh: {
    item: new RegExp('^\\d+ (?:' + ZH_UNIT + ')$'),
    raw:  /^\d+$/,
    phr:  new RegExp('^(?:(?:' + ZH_SUB + ')之後還剩 \\d+ (?:' + ZH_UNIT + ')' +
                     '|(?:' + ZH_ADD + ')之後一共有 \\d+ (?:' + ZH_UNIT + ')' +
                     '|現在一共有 \\d+ (?:' + ZH_UNIT + ')' +
                     '|(?:' + ZH_ADD + '|' + ZH_SUB + ')了 \\d+ (?:' + ZH_UNIT + ')' +
                     '|一開始有 \\d+ (?:' + ZH_UNIT + '))$')
  },
  en: {
    item: new RegExp('^\\d+ (?:' + EN_ITEM + ')$'),
    raw:  /^\d+$/,
    phr:  new RegExp('^(?:\\d+ (?:' + EN_ITEMN + ') were left after some were (?:' + EN_SUB + ')' +
                     '|there were \\d+ (?:' + EN_ITEMN + ') after more were (?:' + EN_ADD + ')' +
                     '|there are \\d+ (?:' + EN_ITEMN + ') now' +
                     '|\\d+ (?:' + EN_ITEMN + ') were (?:' + EN_ADD + '|' + EN_SUB + ')' +
                     '|there were \\d+ (?:' + EN_ITEMN + ') at the start)$')
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/two-step */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'two options are the same answer',
      find:'      if (ok(c)){ seen[vkeyOf(c)] = true; out.push(c); }',
      replace:'      if (c){ out.push(c); }' },
    { file:'review', expect:'option count',
      find:'    while (out.length < 3 && i < 80){',
      replace:'    while (out.length < 3 && i < 0){' },
    /* taboo 拿掉之後，誘答就可能是題幹裡看得到的數字。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'      if (n !== null && tb.indexOf(n) >= 0) return false;',
      replace:'      if (false) return false;' },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    return lang === 'zh' ? (n + ' ' + s.zh.unit)\n                         : (n + ' ' + (n === 1 ? s.en.item : s.en.itemN));",
      replace:"    return lang === 'zh' ? (n + ' ' + s.zh.thing)\n                         : (n + ' ' + (n === 1 ? s.en.item : s.en.itemN));" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        return v.op === '-' ? (verbWord(si, '-', 'zh') + '之後還剩 ' + n + ' ' + unitWord(si, 'zh'))",
      replace:"        return v.op === '-' ? (verbWord(si, '+', 'zh') + '之後還剩 ' + n + ' ' + unitWord(si, 'zh'))" },
    { file:'review', expect:'bad option shape',
      find:"    { icon:'🍬', zh:{ thing:'糖果', unit:'顆', place:'袋子裡', add:'放進', sub:'送出' },",
      replace:"    { icon:'🍬', zh:{ thing:'糖果', unit:'棵', place:'袋子裡', add:'放進', sub:'送出' }," },

    /* --- review.html：每一個產生器的正解算錯 --- */
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'-', mid:mid, ans:ans, correct:IT(si, ans) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'-', mid:mid, ans:ans, correct:IT(si, mid) };" },
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'+', mid:mid, ans:ans, correct:IT(si, ans) };\n        /* 誘答：停在中間數、兩次都減、全部加起來。 */",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'+', mid:mid, ans:ans, correct:IT(si, mid) };\n        /* 誘答：停在中間數、兩次都減、全部加起來。 */" },
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'+', mid:mid, ans:ans, correct:IT(si, ans) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'+', mid:mid, ans:ans, correct:IT(si, mid) };" },
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'-', mid:mid, ans:ans, correct:IT(si, ans) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'-', mid:mid, ans:ans, correct:IT(si, mid) };" },
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'+', mid:mid, ans:ans, correct:IT(si, ans) };\n        /* 誘答：中間數本身（刻意）、第二步用減的、只把兩次的量加起來。 */",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'-', o2:'+', mid:mid, ans:ans, correct:IT(si, mid) };\n        /* 誘答：中間數本身（刻意）、第二步用減的、只把兩次的量加起來。 */" },
    { file:'review', expect:'the marked answer must be the middle number',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, mid) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, ans) };" },
    { file:'review', expect:'the marked answer must be the final answer',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, ans) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, mid) };" },

    /* --- review.html：迷思誘答不見了 --- */
    { file:'review', expect:'needs the middle number',
      find:'        var cands = [ IT(si, mid), itIn(si, a + b + c), itIn(si, a - c) ];',
      replace:'        var cands = [ itIn(si, a + b + c), itIn(si, a - c) ];' },
    { file:'review', expect:'needs the middle number',
      find:'        var cands = [ IT(si, mid), itIn(si, b + c), itIn(si, mid + c) ];',
      replace:'        var cands = [ itIn(si, b + c), itIn(si, mid + c) ];' },

    /* --- review.html：中間數不可以等於答案、不可以是 0 或負數 --- */
    { file:'review', expect:'the answer must be at least 1',
      find:'          c = between(5, Math.min(60, mid - 5));\n          ans = mid - c;\n        } while (b === c || ans < 5 || mid > MAXV || ans > MAXV);',
      replace:'          c = between(5, mid + 30);\n          ans = mid - c;\n        } while (b === c || mid > MAXV || ans > MAXV);' },
    { file:'review', expect:'the answer must be at least 1',
      find:'        } while (b === c || mid === b || mid === c || ans < 5);',
      replace:'        } while (b === c || mid === b || mid === c);' },
    { file:'review', expect:'the middle number must be at least 1',
      find:'        var a = pickUnused([40,45,50,55,60,65,70,75,80,85,90], used);\n        var b, c, mid;\n        do {\n          b = between(10, 35);\n          c = between(5, 30);\n          mid = a - b;\n        } while (b === c || mid === b || mid === c || mid <= c);',
      replace:'        var a = pickUnused([1,2,3,4,5,6,7,8,9,10,11], used);\n        var b, c, mid;\n        do {\n          b = between(10, 35);\n          c = between(5, 30);\n          mid = a - b;\n        } while (b === c);' },
    /* 中間數撞上題幹裡的數字：迷思誘答會被 taboo 濾掉，hasMid 才抓得到。 */
    { file:'review', expect:'needs the middle number',
      find:'          mid = a - b;\n          c = between(5, 40);\n        } while (b === c || mid === b || mid === c);',
      replace:'          mid = a - b;\n          c = between(5, 40);\n        } while (b === c);' },

    /* --- review.html：兩步同向時「中間數的說法」不只一種，所以這兩個產生器一定要一加一減 --- */
    { file:'review', expect:'the two steps must go in opposite directions',
      find:"        var o1 = addFirst ? '+' : '-', o2 = addFirst ? '-' : '+';\n        var correct = PH('after1', mid, si, o1);",
      replace:"        var o1 = addFirst ? '+' : '+', o2 = addFirst ? '+' : '+';\n        var correct = PH('after1', mid, si, o1);" },
    { file:'review', expect:'the two steps must go in opposite directions',
      find:"        var o1 = addFirst ? '+' : '-', o2 = addFirst ? '-' : '+';\n        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, mid) };",
      replace:"        var o1 = addFirst ? '+' : '+', o2 = addFirst ? '+' : '+';\n        var d = { si:si, a:a, b:b, c:c, o1:o1, o2:o2, mid:mid, ans:ans, correct:IT(si, mid) };" },

    /* --- review.html：流程圖的畫布 --- */
    { file:'review', expect:'draws out to x=',
      find:'    var w = padX * 2 + boxW * 3 + gap * 2;\n    var h = topPad + boxH + 20;',
      replace:'    var w = padX * 2 + boxW * 2 + gap * 2;\n    var h = topPad + boxH + 20;' },
    /* 只量矩形的話，一段太長的置中文字畫出去也不會有人發現。 */
    { file:'review', expect:'draws out to x=',
      find:"           '\" font-size=\"12\" text-anchor=\"middle\" fill=\"' + cells[i].line + '\" font-weight=\"800\">' + cells[i].lb + '</text>';",
      replace:"           '\" font-size=\"12\" text-anchor=\"middle\" fill=\"' + cells[i].line + '\" font-weight=\"800\">' + cells[i].lb.repeat(20) + '</text>';" },

    /* --- review.html：交錯進來的兩個產生器 --- */
    /* 範圍是靠 itIn／rawIn 把關的，所以要改壞的是它，不是 MAXV ——
       MAXV 放寬時候選值本來就都還在 200 以內，那條斷言不會有機會響。 */
    { file:'review', expect:'outside 1~200',
      find:'  function itIn(si, v){ return (v >= 1 && v <= MAXV) ? IT(si, v) : null; }',
      replace:'  function itIn(si, v){ return (v >= 1) ? IT(si, v + 300) : null; }' },
    { file:'review', expect:'the tens and ones digits must differ',
      find:'        do { t = between(1, 9); o = between(1, 9); } while (t === o);',
      replace:'        do { t = between(1, 9); o = between(1, 9); } while (false);' },
    { file:'review', expect:'d.n is',
      find:'        var n = h * 100 + t * 10 + o;',
      replace:'        var n = h * 100 + o * 10 + t;' },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"         eqStr(mid, d.o2, d.c, ans, 'zh') + '。答案是 ' + qtyItem(d.si, ans, 'zh') + '。')",
      replace:"         eqStr(mid, d.o2, d.c, ans, 'zh') + '。答案是' + qtyItem(d.si, ans, 'zh') + '。')" },
    { file:'review', expect:'doubled punctuation',
      find:"         eqStr(mid, d.o2, d.c, ans, 'en') + '. The answer is ' + qtyItem(d.si, ans, 'en') + '.');",
      replace:"         eqStr(mid, d.o2, d.c, ans, 'en') + '. The answer is ' + qtyItem(d.si, ans, 'en') + '..');" },

    /* --- index.html：範例資料 --- */
    { file:'index', expect:'the middle number must not equal the answer',
      find:"  var STORY_EX = { si:0, a:8, o1:'+', b:5, o2:'-', c:6 };",
      replace:"  var STORY_EX = { si:0, a:8, o1:'+', b:5, o2:'-', c:0 };" },
    { file:'index', expect:'the answer must be at least 1',
      find:"  var MID_EX = { si:1, a:60, o1:'-', b:25, o2:'+', c:18 };",
      replace:"  var MID_EX = { si:1, a:60, o1:'-', b:25, o2:'-', c:60 };" },
    { file:'index', expect:'FLOW_CASES must cover all four shapes',
      find:"    { si:1, a:30, o1:'+', b:12, o2:'+', c:8 },",
      replace:"    { si:1, a:30, o1:'+', b:12, o2:'-', c:8 }," },
    { file:'index', expect:'EQ_CASES needs one story whose sentences are out of order',
      find:"    { si:2, a:36, o1:'+', b:28, o2:'-', c:14, order:'reverse' }",
      replace:"    { si:2, a:36, o1:'+', b:28, o2:'-', c:14, order:'forward' }" },
    /* 圖的寬度：只算格子不算標籤的話，最後一格的文字會被切掉。 */
    { file:'index', expect:'draws out to x=',
      find:'    var w = padX * 2 + boxW * 3 + gap * 2;\n    var h = topPad + boxH + 26;',
      replace:'    var w = padX * 2 + boxW * 2 + gap * 2;\n    var h = topPad + boxH + 26;' },
    { file:'index', expect:'draws out to x=',
      find:'    var w = cols * size + 12, h = rows * size + 10;',
      replace:'    var w = cols * size - 20, h = rows * size + 10;' },

    /* --- index.html：遊戲關卡 --- */
    { file:'index', expect:'opts[ans] does not equal the answer',
      find:"    { si:2, a:30, o1:'+', b:12, o2:'+', c:8, opts:[42, 50, 38], ans:1 },",
      replace:"    { si:2, a:30, o1:'+', b:12, o2:'+', c:8, opts:[42, 50, 38], ans:0 }," },
    { file:'index', expect:'should offer the middle number',
      find:"    { si:1, a:24, o1:'-', b:9,  o2:'+', c:5, opts:[20, 15, 10], ans:0 },",
      replace:"    { si:1, a:24, o1:'-', b:9,  o2:'+', c:5, opts:[20, 16, 10], ans:0 }," },
    { file:'index', expect:'duplicate options',
      find:"    { si:3, a:40, o1:'-', b:12, o2:'-', c:7, opts:[19, 28, 21], ans:2 },",
      replace:"    { si:3, a:40, o1:'-', b:12, o2:'-', c:7, opts:[28, 28, 21], ans:2 }," },
    { file:'index', expect:'is outside 1~100',
      find:"    { si:0, a:8,  o1:'+', b:5,  o2:'-', c:6, opts:[13, 7, 19], ans:1 },",
      replace:"    { si:0, a:8,  o1:'+', b:5,  o2:'-', c:6, opts:[13, 7, 190], ans:1 }," },
    { file:'index', expect:'ROUNDS must cover all four shapes',
      find:"    { si:2, a:30, o1:'+', b:12, o2:'+', c:8, opts:[42, 50, 38], ans:1 },\n    { si:3,",
      replace:"    { si:2, a:30, o1:'+', b:12, o2:'-', c:8, opts:[42, 34, 38], ans:1 },\n    { si:3," },

    /* --- index.html：字典與題庫 --- */
    { file:'index', expect:'the checker expects',
      find:"        { thing:'糖果', unit:'顆', place:'袋子裡', add:'放進', sub:'送出' },",
      replace:"        { thing:'糖果', unit:'棵', place:'袋子裡', add:'放進', sub:'送出' }," },
    { file:'index', expect:'singular and plural must differ',
      find:"        { thing:'apple',   unit:'apples',   place:'in the basket',  add:'put in the basket',  sub:'taken out' }",
      replace:"        { thing:'apple',   unit:'apple',   place:'in the basket',  add:'put in the basket',  sub:'taken out' }" },
    { file:'index', expect:'t1 zh never shows the first number sentence',
      find:"        return this.sStep(c.si, c.o1, c.b, false) + '<br><span class=\"bigeq\">' +\n               this.eqLine(c.a, c.o1, c.b, mid) + '</span><br>中間數是 <span class=\"midnum\">' +",
      replace:"        return this.sStep(c.si, c.o1, c.b, false) + '<br><span class=\"bigeq\">' +\n               '' + '</span><br>中間數是 <span class=\"midnum\">' +" },
    { file:'index', expect:'m3 zh never says which way the answer moves',
      find:"        return '檢查一下：第二件事讓東西' + (c.o2 === '+' ? '變多' : '變少') + '了，<br>所以答案要比中間數 ' + mid +",
      replace:"        return '檢查一下：第二件事讓東西' + (c.o2 === '+' ? '變少' : '變多') + '了，<br>所以答案要比中間數 ' + mid +" },
    { file:'index', expect:'marked answer is',
      find:"          opts:['13 片','19 片','7 片','2 片'], ans:2,",
      replace:"          opts:['13 片','19 片','7 片','2 片'], ans:0," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['20 個','15 個','10 個','38 個'], ans:0,",
      replace:"          opts:['20 個','15 個','10 個','38 個'], ans:9," },
    { file:'index', expect:'the stem shows 8 0 time(s)',
      find:"        { stem:'🍪 盤子上有 8 片餅乾。<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？',",
      replace:"        { stem:'🍪 盤子上有 9 片餅乾。<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？'," },
    { file:'index', expect:'unexpected number',
      find:"        { stem:'📚 書架上有 30 本書。<br>放上 12 本。<br>又放上 8 本。<br>現在有幾本？',",
      replace:"        { stem:'📚 書架上有 30 本書（另外還有 7 本雜誌）。<br>放上 12 本。<br>又放上 8 本。<br>現在有幾本？'," },
    { file:'index', expect:'does not look like an answer',
      find:"          opts:['28 顆','21 顆','19 顆','35 顆'], ans:1,",
      replace:"          opts:['28 顆','21 顆','banana','35 顆'], ans:1," },
    { file:'index', expect:'contains 630, outside 1~200',
      find:"          opts:['63 瓶','125 瓶','23 瓶','187 瓶'], ans:0,",
      replace:"          opts:['630 瓶','125 瓶','23 瓶','187 瓶'], ans:0," },
    /* 刪掉最後一題英文題目：中文長度還是對的，英文那一圈就少驗一題。 */
    { file:'index', expect:'en qsBoost: 1 questions but 2 expected answers recorded',
      find:"        { stem:'Misconception check: 🥤 there are 60 cups of juice in the morning.<br>25 are sold.<br>18 more are made in the afternoon.<br>Ann gets 35 and writes that down as her answer.<br>What did Ann get wrong?',\n          opts:['35 was worked out wrongly','she should work out 25 + 18 first','35 is the middle number and one more step is needed','the 18 made in the afternoon do not count'], ans:2,\n          why:'60 − 25 = 35 is worked out correctly, but 35 is only the middle number. One more step, 35 + 18 = 53 cups, gives the answer.' }\n      ],",
      replace:"      ]," },
    /* --- 第二輪（codex 審查）補上的守門條件，每一條都要有自己的改壞版本 --- */
    /* 純數字選項的格式化寫錯：d.n 還是對的，只有印出來的字串偏了 ——
       證明正解字串真的是由設定檔重算的，不是拿產生器自己的格式化函式比自己。 */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.u === 'raw')  return String(v.n);",
      replace:"    if (v.u === 'raw')  return String(v.n + 1);" },
    /* 選項用了別的情境：形狀對、去重也過，孩子卻看到不相干的單位。 */
    { file:'review', expect:'but the question is scene',
      find:'        var cands = [ IT(si, mid), itIn(si, b + c), itIn(si, mid + c) ];',
      replace:'        var cands = [ IT((si + 1) % 4, mid), itIn(si, b + c), itIn(si, mid + c) ];' },
    /* 產生器記下來的 mid 和原始參數對不上（原始參數本身沒動）。 */
    { file:'review', expect:'d.mid is',
      find:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'-', mid:mid, ans:ans, correct:IT(si, ans) };",
      replace:"        var d = { si:si, a:a, b:b, c:c, o1:'+', o2:'-', mid:mid + 1, ans:ans, correct:IT(si, ans) };" },
    /* 少畫一種語言的流程圖：畫面上那一格會空掉，靜態檢查看不到。 */
    { file:'review', expect:'should carry a flow diagram',
      find:"    return { zh:flowSVG(d.a, d.o1, d.b, d.o2, d.c, 'zh'), en:flowSVG(d.a, d.o1, d.b, d.o2, d.c, 'en') };",
      replace:"    return { zh:flowSVG(d.a, d.o1, d.b, d.o2, d.c, 'zh'), en:'' };" },
    /* 問中間數的那一題，少了「兩步都算完」這個反向迷思誘答。 */
    { file:'review', expect:'needs the fully-solved answer',
      find:"        var cands = [ IT(si, ans), itIn(si, o1 === '+' ? a - b : a + b), itIn(si, o2 === '+' ? a + c : a - c) ];",
      replace:"        var cands = [ itIn(si, o1 === '+' ? a - b : a + b), itIn(si, o2 === '+' ? a + c : a - c) ];" },
    /* 片語選項帶的數字不一樣了：孩子光看數字就能挑掉三個，題目就不再考「這個數代表什麼」。 */
    { file:'review', expect:'every phrase option must carry the same number',
      find:"        var opts = shuffle([correct, PH('nowTotal', mid, si, o1), PH('second', mid, si, o2), PH('start', mid, si, o1)]);",
      replace:"        var opts = shuffle([correct, PH('nowTotal', mid + 1, si, o1), PH('second', mid, si, o2), PH('start', mid, si, o1)]);" },
    /* 中間數撞上題幹印出來的數字：片語選項無從比對 noEcho，只有 midIsFresh 擋得住。 */
    { file:'review', expect:'must differ from every number printed in the stem',
      find:"        } while (b === c || mid < 8 || mid === b || mid === c || mid === a || ans < 5 || mid > MAXV || ans > MAXV);\n        var o1 = addFirst ? '+' : '-', o2 = addFirst ? '-' : '+';\n        var correct = PH('after1', mid, si, o1);",
      replace:"        } while (b === c || mid < 8 || ans < 5 || mid > MAXV || ans > MAXV);\n        var o1 = addFirst ? '+' : '-', o2 = addFirst ? '-' : '+';\n        var correct = PH('after1', mid, si, o1);" },
    /* c ＝ 0：中間數就等於答案，迷思誘答會塌到正解上。 */
    { file:'review', expect:'must not equal the answer',
      find:'          c = between(5, Math.min(60, mid - 5));',
      replace:'          c = between(0, 0);' },
    /* b ＝ 0：不是一個真的數量（整數檢查放行，範圍檢查才擋得住）。 */
    { file:'review', expect:'must all be at least 1',
      find:'          b = between(5, 30);\n          c = between(5, 30);\n          mid = a + b;',
      replace:'          b = between(0, 0);\n          c = between(5, 30);\n          mid = a + b;' },
    /* index：數量是 0（整數，但不是一個真的數量）。 */
    { file:'index', expect:'must be at least 1',
      find:"  var STORY_EX = { si:0, a:8, o1:'+', b:5, o2:'-', c:6 };",
      replace:"  var STORY_EX = { si:0, a:8, o1:'+', b:0, o2:'-', c:6 };" },
    /* index：矩形少了 width —— 舊的量法靠「x 一定寫在 width 前面」，屬性一改就整條靜靜消失。 */
    { file:'index', expect:'missing x/y/width/height',
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +",
      replace:"      s += '<rect x=\"' + bx + '\" y=\"' + topPad + '\" height=\"' + boxH +" },
    /* b ＝ 1 時英文提示句會變成 “those 1 book”。 */
    { file:'review', expect:'midValue needs b >= 2',
      find:"          b = between(8, 30);\n          c = between(5, 30);\n          mid = addFirst ? (a + b) : (a - b);\n          ans = addFirst ? (mid - c) : (mid + c);\n        } while (b === c || mid < 8 || mid === b || mid === c || mid === a || ans < 5 || mid > MAXV || ans > MAXV ||\n                 ans === a || ans === b || ans === c);",
      replace:"          b = between(1, 1);\n          c = between(5, 30);\n          mid = addFirst ? (a + b) : (a - b);\n          ans = addFirst ? (mid - c) : (mid + c);\n        } while (b === c || mid < 8 || mid === b || mid === c || mid === a || ans < 5 || mid > MAXV || ans > MAXV ||\n                 ans === a || ans === b || ans === c);" },
    /* 「17 片」不可以算成「7 片」—— 子字串比對會放行，補了邊界才擋得住。 */
    { file:'index', expect:'t3 zh never states the answer with its unit',
      find:"               this.qty(c.si, ans) + '</span>才是答案。';",
      replace:"               '1' + this.qty(c.si, ans) + '</span>才是答案。';" },
    /* index：遊戲的第二層提示不再說「接下來要算什麼」。 */
    { file:'index', expect:'gHint2 never shows what to work out next',
      find:"        return '中間數是 ' + mid + '。再算 ' + mid + ' ' + this.opWord(r.o2) + ' ' + r.c + '。';",
      replace:"        return '中間數是 ' + mid + '。再算 ' + mid + ' ' + this.opWord(r.o2) + '。';" },
    /* --- 第三輪（codex 審查）補上的守門條件 --- */
    /* C1：把兩個事件的動詞對調。{8,5,6} 完全沒變，重算出來的答案照樣是 7，
       只有「運算元綁動詞」的 marks 抓得到。 */
    { file:'index', expect:'an operand, its operation, or its wording has changed',
      find:"        { stem:'🍪 盤子上有 8 片餅乾。<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？',",
      replace:"        { stem:'🍪 盤子上有 8 片餅乾。<br>吃掉 5 片。<br>放上 6 片。<br>現在有幾片？'," },
    /* C1：兩句都還在，只是先後對調 —— 只驗「有沒有出現」放行，順序檢查才擋得住。 */
    { file:'index', expect:'not written in the order the checker records',
      find:"<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？',",
      replace:"<br>吃掉 6 片。<br>放上 5 片。<br>現在有幾片？'," },
    /* C2：加一個「其實也是對的」選項。形狀、範圍、字串唯一性全過。 */
    { file:'index', expect:'states the correct answer 50',
      find:"          opts:['20 台就是答案','要先算 20 ＋ 14','36 是中間數，答案是 50 台','56 台就是答案'], ans:2,",
      replace:"          opts:['50 台就是答案','要先算 20 ＋ 14','36 是中間數，答案是 50 台','56 台就是答案'], ans:2," },
    /* C2：改寫一個誘答（不改真假）—— 凍結的選項表才抓得到。 */
    { file:'index', expect:'the checker expects',
      find:"          opts:['28 顆','21 顆','19 顆','35 顆'], ans:1,",
      replace:"          opts:['28 顆','21 顆','20 顆','35 顆'], ans:1," },
    /* C5：英文選項砍成 3 個。`ans` 仍然落在範圍內，舊的檢查全綠。 */
    { file:'index', expect:'options, this lesson always uses 4',
      find:"          opts:['13 biscuits','19 biscuits','7 biscuits','2 biscuits'], ans:2,",
      replace:"          opts:['13 biscuits','7 biscuits','2 biscuits'], ans:1," },
    /* C3：解釋說第一步的結果就是答案。以前 why 根本沒有被讀過。 */
    { file:'index', expect:'the explanation never shows the second step',
      find:"          why:'先算中間數：24 － 9 ＝ 15 個。再算一步：15 ＋ 5 ＝ 20 個。' },",
      replace:"          why:'先算中間數：24 － 9 ＝ 15 個。所以答案是 15 個。' }," },
    { file:'index', expect:'the explanation never shows the first step',
      find:"          why:'Middle number first: 30 + 12 = 42 books. Then one more step: 42 + 8 = 50 books.' },",
      replace:"          why:'Then one more step: 42 + 8 = 50 books.' }," },
    /* C4：a／b／c 自己沒有上限。mid ＝ 1、ans ＝ 19 都在 100 以內，舊檢查全綠。 */
    { file:'index', expect:'must be at most 100',
      find:"  var MID_EX = { si:1, a:60, o1:'-', b:25, o2:'+', c:18 };",
      replace:"  var MID_EX = { si:1, a:1000, o1:'-', b:999, o2:'+', c:18 };" },
    { file:'review', expect:'must all be at most 200',
      find:'        var a = pickUnused([30,36,42,48,54,60,66,72,78,84,90], used);\n        var b, mid, c;',
      replace:'        var a = pickUnused([205,206,207,208,209,210,211,212,213,214,215], used);\n        var b, mid, c;' },
    /* 只放大 a 的話，加法那一半永遠湊不出 ≤ 200 的答案，`ans > MAXV` 會讓
       rejection loop 空轉 —— 改壞版本也必須是「跑得完」的。所以同時固定成減法。 */
    { file:'review', expect:'a / b must both be at most 200',
      find:'        var a = pickUnused([28,35,46,57,64,73,82,95,106,118,124], used);\n        var plus = rand(2) === 0;',
      replace:'        var a = pickUnused([205,206,207,208,209,210,211,212,213,214,215], used);\n        var plus = false;' },
    /* C6：畫布高度與下緣以前完全沒有被讀過 —— height="1" 也會全綠。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var h = topPad + boxH + 26;',
      replace:'    var h = 4;' },
    /* C6：viewBox 和畫布不一樣大時，畫面上的位置和量到的不是同一回事。 */
    { file:'index', expect:'the viewBox does not match the canvas',
      find:"data-reveal=\"' + reveal +\n            '\" width=\"' + w + '\" height=\"' + h + '\" viewBox=\"0 0 ' + w + ' ' + h +",
      replace:"data-reveal=\"' + reveal +\n            '\" width=\"' + w + '\" height=\"' + h + '\" viewBox=\"0 0 ' + (w + 1) + ' ' + h +" },
    /* C6：字級搬走之後，舊的量法會「讀不到就當 20」照樣通過。 */
    { file:'index', expect:'missing x/y/font-size',
      find:"           '\" font-size=\"30\" text-anchor=\"middle\" fill=\"' + cells[i].line + '\" font-weight=\"800\">' + cells[i].v + '</text>';",
      replace:"           '\" text-anchor=\"middle\" fill=\"' + cells[i].line + '\" font-weight=\"800\">' + cells[i].v + '</text>';" },
    /* C6：畫了一個量不到的元素，整批就從計算裡消失了。 */
    { file:'index', expect:'which the geometry reader cannot measure',
      find:"    s += '</svg>';\n    return s;\n  }\n\n  /* 兩步驟流程圖",
      replace:"    s += '<line x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"/></svg>';\n    return s;\n  }\n\n  /* 兩步驟流程圖" },
    /* C6：往上畫出畫布外（頂邊被切掉）。 */
    { file:'index', expect:'clipped by the top edge',
      find:'    var boxW = 104, boxH = 62, gap = 56, padX = 8, topPad = 26;',
      replace:'    var boxW = 104, boxH = 62, gap = 56, padX = 8, topPad = -20;' },
    /* --- 第四輪（codex round 2）補上的守門條件 --- */
    /* R2-1：把渲染出來的動詞對調。算術、選項、正解全都沒變，只有孩子讀到的故事變了。 */
    { file:'review', expect:'the rendered verb no longer matches the operation',
      find:"    if (lang === 'zh') return (second ? '又' : '') + verbWord(si, op, 'zh') + ' ' + n + ' ' + s.zh.unit + '。';",
      replace:"    if (lang === 'zh') return (second ? '又' : '') + verbWord(si, op === '+' ? '-' : '+', 'zh') + ' ' + n + ' ' + s.zh.unit + '。';" },
    { file:'review', expect:'the rendered verb no longer matches the operation',
      find:"      ? ((second ? 'Another ' + n : n + ' more') + ' are ' + s.en.add + '.')\n      : ((second ? 'Another ' + n : String(n)) + ' are ' + s.en.sub + '.');",
      replace:"      ? ((second ? 'Another ' + n : n + ' more') + ' are ' + s.en.sub + '.')\n      : ((second ? 'Another ' + n : String(n)) + ' are ' + s.en.add + '.');" },
    /* R2-1：兩句都在，只是渲染的先後對調了。 */
    { file:'review', expect:'renders the two events in the wrong order',
      find:"    return startLine(d.si, d.a, lang) + '<br>' + stepLine(d.si, d.o1, d.b, false, lang) +\n           '<br>' + stepLine(d.si, d.o2, d.c, d.o1 === d.o2, lang) + '<br>' + askLine(d.si, lang);",
      replace:"    return startLine(d.si, d.a, lang) + '<br>' + stepLine(d.si, d.o2, d.c, d.o1 === d.o2, lang) +\n           '<br>' + stepLine(d.si, d.o1, d.b, false, lang) + '<br>' + askLine(d.si, lang);" },
    /* R2-2：算式的運算元被換掉，但結果還是 mid —— 只驗「＝ mid」的舊寫法會放行。 */
    { file:'index', expect:'t1 zh never shows the first number sentence',
      find:"               this.eqLine(c.a, c.o1, c.b, mid) + '</span><br>中間數是 <span class=\"midnum\">' +",
      replace:"               this.eqLine(c.a + 1, c.o1, c.b - 1, mid) + '</span><br>中間數是 <span class=\"midnum\">' +" },
    { file:'index', expect:'f2 never shows the second number sentence',
      find:"        return '第二件事：' + this.eqLine(mid, c.o2, c.c, ans) + '。<br>答案是 <span class=\"bigans\">' +",
      replace:"        return '第二件事：' + this.eqLine(mid, c.o2 === '+' ? '-' : '+', c.c, ans) + '。<br>答案是 <span class=\"bigans\">' +" },
    { file:'index', expect:'e2 never shows sentence 1',
      find:"        return '算式一：<span class=\"bigeq\">' + this.eqLine(c.a, c.o1, c.b, mid) +",
      replace:"        return '算式一：<span class=\"bigeq\">' + this.eqLine(c.a - 2, c.o1, c.b + 2, mid) +" },
    { file:'index', expect:'m0 zh never shows the first number sentence',
      find:"        return '小安算 ' + this.eqLine(c.a, c.o1, c.b, mid) + '，就說答案是 ' + this.qty(c.si, mid) + '。';",
      replace:"        return '小安算 ' + this.eqLine(c.a, c.o1 === '+' ? '-' : '+', c.b, mid) + '，就說答案是 ' + this.qty(c.si, mid) + '。';" },
    /* R2-3：遊戲的說明把第二步教成反方向；舊寫法只要求提到 mid 和答案。 */
    { file:'index', expect:'gWhy never shows the second number sentence',
      find:"        return this.eqLine(r.a, r.o1, r.b, mid) + '，' + this.eqLine(mid, r.o2, r.c, ans) +",
      replace:"        return this.eqLine(r.a, r.o1, r.b, mid) + '，' + this.eqLine(mid, r.o2 === '+' ? '-' : '+', r.c, ans) +" },
    { file:'index', expect:'gHint2 never shows what to work out next',
      find:"        return '中間數是 ' + mid + '。再算 ' + mid + ' ' + this.opWord(r.o2) + ' ' + r.c + '。';",
      replace:"        return '中間數是 ' + mid + '。再算 ' + mid + ' ' + this.opWord(r.o2 === '+' ? '-' : '+') + ' ' + r.c + '。';" },
    /* R2-5：陣列長度與每一格的形狀。刪掉第五關仍然涵蓋四種形狀，舊檢查全綠。 */
    { file:'index', expect:'the game advertises 5',
      find:"    { si:0, a:26, o1:'-', b:8,  o2:'+', c:5, opts:[18, 31, 23], ans:2 }\n  ];",
      replace:"  ];" },
    { file:'index', expect:'FLOW_CASES has 5 entries',
      find:"    { si:3, a:50, o1:'-', b:12, o2:'-', c:9 }\n  ];",
      replace:"    { si:3, a:50, o1:'-', b:12, o2:'-', c:9 },\n    { si:3, a:50, o1:'-', b:12, o2:'-', c:9 }\n  ];" },
    { file:'index', expect:'EQ_CASES has 2 entries',
      find:"    { si:1, a:45, o1:'-', b:18, o2:'+', c:20, order:'forward' },\n",
      replace:"" },
    /* R2-6：把 stroke-width 搬進 style，舊的量法會把描邊寬度靜靜當成 0。 */
    { file:'index', expect:'draws out to x=',
      find:"           '\" rx=\"14\" fill=\"' + cells[i].fill + '\" stroke=\"' + cells[i].line + '\" stroke-width=\"3\"/>';",
      replace:"           '\" rx=\"14\" fill=\"' + cells[i].fill + '\" stroke=\"' + cells[i].line + '\" style=\"stroke-width:120\"/>';" },
    { file:'index', expect:'geometry cannot be resolved here',
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +",
      replace:"      s += '<rect transform=\"translate(5,5)\" x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +" },
    /* 速查卡的算式和課程資料對不上（以前完全沒有人讀過這一頁）。 */
    { file:'reference', via:'index', expect:'reference.html (zh) never shows FLOW_CASES[1] sentence 2',
      find:"k2c:'12 ＋ 9 ＝ 21',  k2d:'21 － 5 ＝ 16',",
      replace:"k2c:'12 ＋ 9 ＝ 21',  k2d:'21 － 5 ＝ 17'," },
    { file:'reference', via:'index', expect:'never shows the decrease example',
      find:"c2c:'13 － 6 ＝ 7，7 比 13 小'",
      replace:"c2c:'13 － 6 ＝ 8，8 比 13 小'" },
    /* 家長頁示範的兩個算式也一樣。 */
    { file:'parents', via:'index', expect:'parents.html (zh) never shows the worked second step',
      find:'"b1": "聽完「盤子上有 8 片，放上 5 片，吃掉 6 片」，能自己說出「先算 8 ＋ 5 ＝ 13，再算 13 － 6 ＝ 7」兩個算式。",',
      replace:'"b1": "聽完「盤子上有 8 片，放上 5 片，吃掉 6 片」，能自己說出「先算 8 ＋ 5 ＝ 13，再算 13 － 6 ＝ 9」兩個算式。",' },
    /* --- 第五輪（codex round 3）：六個 fail-open 各自的證明 --- */
    /* R3-1：起始量印錯。兩個事件、算術、選項全都沒變。 */
    { file:'review',
      expect:"the starting amount",
      find:"      ? (s.zh.place + '有 ' + n + ' ' + s.zh.unit + s.zh.thing + '。')",
      replace:"      ? (s.zh.place + '有 ' + (n + 1) + ' ' + s.zh.unit + s.zh.thing + '。')" },
    /* R3-1：問句改成問第一件事之後 —— 正解就不是 ans 了。 */
    { file:'review',
      expect:"stem must ask",
      find:"    return lang === 'zh' ? ('現在有幾' + SCENES[si].zh.unit + '？')\n                         : ('How many ' + SCENES[si].en.itemN + ' are there now?');",
      replace:"    return lang === 'zh' ? ('第一件事之後有幾' + SCENES[si].zh.unit + '？')\n                         : ('How many ' + SCENES[si].en.itemN + ' are there after the first change?');" },
    /* R3-1：情境圖示和 si 對不上。 */
    { file:'review',
      expect:"does not show the scene icon",
      find:"    return SCENES[d.si].icon + ' ' + storyLines(d, lang) + d.flow[lang];",
      replace:"    return SCENES[(d.si + 1) % 4].icon + ' ' + storyLines(d, lang) + d.flow[lang];" },
    /* R3-2：同一個事件多印一次。數字集合、每個 mark、算術全都還成立。 */
    { file:'review',
      expect:"times; each event must be rendered exactly once",
      find:"    return startLine(d.si, d.a, lang) + '<br>' + stepLine(d.si, d.o1, d.b, false, lang) +\n           '<br>' + stepLine(d.si, d.o2, d.c, d.o1 === d.o2, lang) + '<br>' + askLine(d.si, lang);",
      replace:"    return startLine(d.si, d.a, lang) + '<br>' + stepLine(d.si, d.o1, d.b, false, lang) +\n           '<br>' + stepLine(d.si, d.o1, d.b, false, lang) +\n           '<br>' + stepLine(d.si, d.o2, d.c, d.o1 === d.o2, lang) + '<br>' + askLine(d.si, lang);" },
    /* R3-2：codex 指名的那個改壞 —— qs[0] 多一句「放上 5 片」，正解從 7 變成 12。 */
    { file:'index',
      expect:"times; each event must appear exactly once",
      find:"{ stem:'🍪 盤子上有 8 片餅乾。<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？',",
      replace:"{ stem:'🍪 盤子上有 8 片餅乾。<br>放上 5 片。<br>放上 5 片。<br>吃掉 6 片。<br>現在有幾片？'," },
    /* R3-2：英文那一邊同一個改壞（次數比對要分語言各做一次）。 */
    { file:'index',
      expect:"the stem shows 5 2 time(s)",
      find:"{ stem:'🍪 There are 8 biscuits on the plate.<br>5 more are put on the plate.<br>6 are eaten.<br>How many biscuits are there now?',",
      replace:"{ stem:'🍪 There are 8 biscuits on the plate.<br>5 more are put on the plate.<br>5 more are put on the plate.<br>6 are eaten.<br>How many biscuits are there now?'," },
    /* R3-3：兩個算式都對，結論卻說答案是中間數。 */
    { file:'index',
      expect:"the explanation is",
      find:"why:'先算中間數：8 ＋ 5 ＝ 13 片。再算一步：13 － 6 ＝ 7 片。13 是中間數，不是答案。' },",
      replace:"why:'先算中間數：8 ＋ 5 ＝ 13 片。再算一步：13 － 6 ＝ 7 片。所以答案是 13 片。' }," },
    /* R3-4：速查卡印成 112 ＋ 9 ＝ 21 —— 舊的 indexOf 會在裡面找到 12 ＋ 9 ＝ 21。 */
    { file:'reference',
      via:'index',
      expect:"never shows FLOW_CASES[1] sentence 1",
      find:"k2c:'12 ＋ 9 ＝ 21',",
      replace:"k2c:'112 ＋ 9 ＝ 21'," },
    /* R3-5：單引號的 style 以前整條繞過去，描邊寬度被當成 0。 */
    { file:'index',
      expect:"draws out to x=",
      find:"'\" rx=\"14\" fill=\"' + cells[i].fill + '\" stroke=\"' + cells[i].line + '\" stroke-width=\"3\"/>';",
      replace:"'\" rx=\"14\" fill=\"' + cells[i].fill + '\" stroke=\"' + cells[i].line + \"' style='stroke-width:120'/>\";" },
    /* R3-5：單引號的 class 一樣要 fail closed。 */
    { file:'index',
      expect:"carries a class",
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +",
      replace:"      s += \"<rect class='wide-stroke' \" + 'x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +" },
    /* R3-5：單引號的 transform 會整個搬動座標。 */
    { file:'index',
      expect:"carries a transform",
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +\n           '\" rx=\"14\"",
      replace:"      s += \"<rect transform='translate(500,0)' \" + 'x=\"' + bx + '\" y=\"' + topPad + '\" width=\"' + boxW + '\" height=\"' + boxH +\n           '\" rx=\"14\"" },
    /* R3-6：加了描邊的文字可以把四個邊都畫出去，以前文字完全不算描邊。 */
    { file:'index',
      expect:"draws out to y=",
      find:"'\" font-size=\"15\" text-anchor=\"middle\" fill=\"#6B6875\" font-weight=\"800\">' + label + '</text>';",
      replace:"'\" font-size=\"15\" text-anchor=\"middle\" fill=\"#6B6875\" style=\"stroke-width:120\" font-weight=\"800\">' + label + '</text>';" }
  ],

  sim: {
    /* simgen 內建的「誘答抄題幹」檢查在這一課永遠不會響：選項是「13 片」，
       題幹的數字是「13」，字串比不到。所以那條規則由設定檔自己的 noEcho()
       用「值」把關（見上），白名單也寫在那裡 —— stopTooEarly 的題幹刻意
       印出中間數，只放行那一個值。 */
    stemEchoOk: {},

    INVARIANTS: {
      twoAddSub: d => sceneOk(d) || twoStepOk(d, 'ans') || stemEventsOk(d, true, false, 'now') || base(d) ||
        (d.o1 !== '+' || d.o2 !== '-' ? 'twoAddSub must be add-then-subtract' : null) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c]) || flowOk(d),
      twoSubAdd: d => sceneOk(d) || twoStepOk(d, 'ans') || stemEventsOk(d, true, false, 'now') || base(d) ||
        (d.o1 !== '-' || d.o2 !== '+' ? 'twoSubAdd must be subtract-then-add' : null) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c]) || flowOk(d),
      twoAddAdd: d => sceneOk(d) || twoStepOk(d, 'ans') || stemEventsOk(d, true, false, 'now') || base(d) ||
        (d.o1 !== '+' || d.o2 !== '+' ? 'twoAddAdd must be add-then-add' : null) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c]) || flowOk(d),
      twoSubSub: d => sceneOk(d) || twoStepOk(d, 'ans') || stemEventsOk(d, true, false, 'now') || base(d) ||
        (d.o1 !== '-' || d.o2 !== '-' ? 'twoSubSub must be subtract-then-subtract' : null) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c]) || flowOk(d),
      /* 題幹自己印出中間數，所以那一個值可以當誘答 —— 只放行它。 */
      stopTooEarly: d => sceneOk(d) || twoStepOk(d, 'ans') || stemEventsOk(d, false, false, 'correct') || base(d) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c], d.mid),
      /* 一加一減：兩步同向時，「第一件事做完之後有多少」的說法不只一種。 */
      midMeaning: d => sceneOk(d) ||
        (d.o1 === d.o2 ? 'the two steps must go in opposite directions' : null) ||
        twoStepOk(d, 'mid') || midIsFresh(d) || stemEventsOk(d, false, false, 'meaning') || base(d) ||
        (d.correct.u !== 'phr' || d.correct.p !== 'after1'
          ? 'the answer must be the after-the-first-change phrase' : null) ||
        (!d.opts.every(o => o && o.u === 'phr' && o.n === d.mid)
          ? 'every phrase option must carry the same number, the middle number' : null) ||
        noEcho(d, [d.a, d.b, d.c]),
      midValue: d => sceneOk(d) ||
        (d.o1 === d.o2 ? 'the two steps must go in opposite directions' : null) ||
        twoStepOk(d, 'mid') || midIsFresh(d) || stemEventsOk(d, false, false, 'thenCount') || base(d) ||
        /* 英文的提示句是「After those {b} {複數}…」，b ＝ 1 會變成 “those 1 book”。 */
        (d.b < 2 ? 'midValue needs b >= 2, otherwise the English clue line reads "those 1 book"' : null) ||
        /* 反過來的迷思：兩步都算完。那個值一定要在選項裡。 */
        (!d.opts.some(o => o && o.u === 'item' && o.n === d.ans)
          ? 'midValue needs the fully-solved answer ' + d.ans + ' as a distractor' : null) ||
        noEcho(d, [d.a, d.b, d.c]),
      outOfOrder: d => sceneOk(d) || twoStepOk(d, 'ans') || midIsFresh(d) || stemEventsOk(d, false, true, 'now') || base(d) ||
        hasMid(d) || noEcho(d, [d.a, d.b, d.c]),
      /* 交錯：一步加減。這一題刻意只有一步，不可以有第三個數。 */
      oneStep: d => {
        if (d.op !== '+' && d.op !== '-') return 'unknown operation ' + d.op;
        /* 先驗型別：'28' >= 1 是 true，字串參數會一路被 JS 強制轉型混過去。 */
        if (![d.a, d.b, d.ans].every(Number.isInteger)) return 'a / b / ans must all be whole numbers';
        if (!(d.a >= 1 && d.b >= 1)) return 'a / b must both be at least 1';
        if (d.a > MAXV || d.b > MAXV) return 'a / b must both be at most ' + MAXV;
        const bad = distinctOpts(d) || indexOk(d);
        if (bad) return bad;
        const ans = d.op === '+' ? (d.a + d.b) : (d.a - d.b);
        if (ans < 1) return 'the answer must be at least 1, got ' + ans;
        if (ans > MAXV) return 'the answer ' + ans + ' is outside 1~' + MAXV;
        if (d.ans !== ans) return 'd.ans is ' + d.ans + ', recomputed ' + ans;
        if (d.correct.n !== ans) return 'the marked answer must be ' + ans;
        return noEcho(d, [d.a, d.b]);
      },
      /* 交錯：位值合成。十位和個位一樣的話，「對調」的誘答就等於正解。 */
      placeValue: d => {
        const bad = distinctOpts(d) || indexOk(d);
        if (bad) return bad;
        if (![d.h, d.t, d.o, d.n].every(Number.isInteger)) return 'h / t / o / n must all be whole numbers';
        if (!(d.h >= 1 && d.h <= 8)) return 'the hundreds digit must be 1~8, got ' + d.h;
        if (!(d.t >= 0 && d.t <= 9)) return 'the tens digit must be 0~9, got ' + d.t;
        if (!(d.o >= 1 && d.o <= 9)) return 'the ones digit must be 1~9, got ' + d.o;
        if (d.t === d.o) return 'the tens and ones digits must differ, otherwise the swap distractor equals the answer';
        const n = d.h * 100 + d.t * 10 + d.o;
        if (d.n !== n) return 'd.n is ' + d.n + ', recomputed ' + n;
        if (d.correct.n !== n) return 'the marked answer must be ' + n;
        return noEcho(d, [d.h, d.t, d.o]);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的情境表重算，
       完全不呼叫 review.html 的 qtyItem／phrStr。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'twoAddSub': case 'twoSubAdd': case 'twoAddAdd':
        case 'twoSubSub': case 'stopTooEarly': case 'outOfOrder': {
          const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
          return fItem(d.si, d.o2 === '+' ? (mid + d.c) : (mid - d.c), lang);
        }
        case 'midValue': {
          const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
          return fItem(d.si, mid, lang);
        }
        case 'midMeaning': {
          const mid = d.o1 === '+' ? (d.a + d.b) : (d.a - d.b);
          return fAfter1(d.si, mid, d.o1, lang);
        }
        case 'oneStep':    return String(d.op === '+' ? (d.a + d.b) : (d.a - d.b));
        case 'placeValue': return String(d.h * 100 + d.t * 10 + d.o);
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀要是這個產生器允許的，數字要落在範圍裡，
       英文還要單複數一致。正解與誘答用同一組規則 —— 這一課沒有刻意寫錯的選項。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      if (lang === 'en'){
        const m = t.match(/(\d+) ([a-z]+)/);
        if (m){
          const n = Number(m[1]), w = m[2];
          if (EN_SING.indexOf(w) >= 0 && n !== 1) return 'plural does not match the number: ' + t;
          if (EN_PLUR.indexOf(w) >= 0 && n === 1) return 'plural does not match the number: ' + t;
        }
      }
      const bounds = RANGE[genId];
      if (!bounds) return 'no range recorded for ' + genId;
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
    dataReturn: '{SCENES, STORY_EX, FLOW_CASES, EQ_CASES, MID_EX, ROUNDS, traySVG, flowSVG, midOf, ansOf}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];
      /* 「題幹有沒有印出 5」不可以用 indexOf：「15」和「50」裡面都有 5，
         整條檢查就會因為別的數字而永遠通過。一律比對數字邊界。 */
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(String(text));
      /* 只驗「結尾是 ＝ mid」不夠：`9 ＋ 4 ＝ 13` 也結尾在 ＝ 13。
         兩個運算元、運算符號、結果都要比對，而且是這裡從原始參數重算出來的。 */
      const eqText = (x, op, y, z, L) =>
        x + (L === 'zh' ? (op === '+' ? ' ＋ ' : ' － ') : (op === '+' ? ' + ' : ' − ')) +
        y + (L === 'zh' ? ' ＝ ' : ' = ') + z;
      /* 找一整個片語時也一樣：indexOf('7 片') 在「17 片」裡找得到，
         indexOf('up') 在「cups」裡找得到。片語兩端各補一個合適的邊界。 */
      const esc = t => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hasPhrase = (text, phrase) => {
        const p = String(phrase);
        const left  = /^[0-9]/.test(p) ? '(?<![0-9])' : (/^[A-Za-z]/.test(p) ? '\\b' : '');
        const right = /[0-9]$/.test(p) ? '(?![0-9])'  : (/[A-Za-z]$/.test(p) ? '\\b' : '');
        return new RegExp(left + esc(p) + right).test(String(text));
      };
      const midOf = x => x.o1 === '+' ? (x.a + x.b) : (x.a - x.b);
      const ansOf = x => { const m = midOf(x); return x.o2 === '+' ? (m + x.c) : (m - x.c); };

      /* --- 情境表：圖案（資料區）與名字／動詞（字典）用 si 對齊，兩邊長度一定要一樣 --- */
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
          const want = (L === 'zh') ? t.zh : { thing:t.en.item, unit:t.en.itemN, place:t.en.place, add:t.en.add, sub:t.en.sub };
          ['thing','unit','place','add','sub'].forEach(k => {
            if (!s[k]) fail(`${L} scenes[${i}] is missing ${k}`);
            else if (s[k] !== want[k]) fail(`${L} scenes[${i}].${k} is "${s[k]}", the checker expects "${want[k]}"`);
          });
          /* 放上和吃掉是同一個字的話，故事的兩句話會長得一模一樣。 */
          if (s.add === s.sub) fail(`${L} scenes[${i}]: the add verb and the take-away verb must differ (${s.add})`);
          if (L === 'en' && s.thing === s.unit) fail(`en scenes[${i}]: singular and plural must differ (${s.thing})`);
        });
      });
      const sceneCount = data.SCENES.length;
      const siOk = (si, where) => {
        if (!Number.isInteger(si) || si < 0 || si >= sceneCount){
          fail(`${where}: scene index ${si} is outside 0~${sceneCount - 1}`);
          return false;
        }
        return true;
      };

      /* --- 每一個兩步驟情境的共同約束 --- */
      const stepOk = (where, x, maxV) => {
        /* si 不合法時直接回 null：呼叫端接下來都要拿 si 去查字典的情境表，
           只 fail() 不停下來的話，那個 undefined 會先丟例外，把真正的錯誤蓋掉。 */
        if (!siOk(x.si, where)) return null;
        let usable = true;
        ['a','b','c'].forEach(k => {
          /* 「是不是整數」擋不住 0 或負數；a／b／c 是實際的數量，一定 ≥ 1。
             0 只記一筆錯就繼續往下 —— c ＝ 0 同時也讓中間數等於答案，
             那一條也要有機會響。非整數才是真的沒辦法往下算。 */
          if (!Number.isInteger(x[k])){ fail(`${where}.${k} must be a whole number, got ${x[k]}`); usable = false; }
          else if (x[k] < 1) fail(`${where}.${k} must be at least 1, got ${x[k]}`);
          else if (x[k] > maxV) fail(`${where}.${k} must be at most ${maxV}, got ${x[k]}`);
        });
        if (!usable) return null;
        if (x.o1 !== '+' && x.o1 !== '-') fail(`${where}: unknown first operation ${x.o1}`);
        if (x.o2 !== '+' && x.o2 !== '-') fail(`${where}: unknown second operation ${x.o2}`);
        const mid = midOf(x), ans = ansOf(x);
        if (mid < 1) fail(`${where}: the middle number must be at least 1, got ${mid}`);
        if (ans < 1) fail(`${where}: the answer must be at least 1, got ${ans}`);
        /* c ＝ 0 時中間數就等於答案，這一課的迷思誘答會塌到正解上。 */
        if (mid === ans) fail(`${where}: the middle number must not equal the answer (${mid})`);
        if (mid > maxV) fail(`${where}: the middle number ${mid} is outside 1~${maxV}`);
        if (ans > maxV) fail(`${where}: the answer ${ans} is outside 1~${maxV}`);
        /* 資料區自己的 midOf／ansOf 也要跟這裡算的一樣。 */
        if (data.midOf(x) !== mid) fail(`${where}: the page's midOf gives ${data.midOf(x)}, the checker gets ${mid}`);
        if (data.ansOf(x) !== ans) fail(`${where}: the page's ansOf gives ${data.ansOf(x)}, the checker gets ${ans}`);
        return { mid, ans };
      };
      const shapeOf = x => x.o1 + x.o2;

      /* --- 圖的寬度：每一格畫面都要驗，不只頭尾 --- */
      const widthOk = (label, svg) => {
        const bad = svgBoxOk(label, svg);
        if (bad) fail(bad);
      };

      /* --- 範例 1：故事變了兩次 --- */
      const S = data.STORY_EX;
      /* 基礎層（範例、遊戲、qs）一律 100 以內，進階與迷思題才到 200 ——
         就是課程頁自己講的範圍，BANK_MAX 用的也是同一組數。 */
      const sv = stepOk('STORY_EX', S, 100);
      if (!sv) return;
      LANGS.forEach(L => {
        const d = I18N[L];
        const t0 = d.t0(S), t1 = d.t1(S, sv.mid), t2 = d.t2(S, sv.mid, sv.ans), t3 = d.t3(S, sv.mid, sv.ans);
        [t0, t1, t2, t3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`t ${L}: ${s}`); });
        if (!hasNum(t0, S.a)) fail(`t0 ${L} never says how many there were to start with`);
        /* 「有沒有印出中間數」擋不住「算式整段被刪掉」—— 要驗算式的結果那一段。 */
        const eq1 = eqText(S.a, S.o1, S.b, sv.mid, L);
        if (!hasPhrase(t1, eq1)) fail(`t1 ${L} never shows the first number sentence "${eq1}"`);
        const eq2 = eqText(sv.mid, S.o2, S.c, sv.ans, L);
        if (!hasPhrase(t2, eq2)) fail(`t2 ${L} never shows the second number sentence "${eq2}"`);
        const unit = L === 'zh' ? I18N.zh.scenes[S.si].unit : I18N.en.scenes[S.si].unit;
        if (!hasPhrase(t3, sv.ans + ' ' + unit)) fail(`t3 ${L} never states the answer with its unit (${sv.ans} ${unit})`);
        if (!hasNum(t3, sv.mid)) fail(`t3 ${L} never contrasts the middle number ${sv.mid}`);
      });
      /* 孩子按得到的每一格畫面 */
      const icon = data.SCENES[S.si].icon;
      widthOk('traySVG(step 0)', data.traySVG(icon, S.a, 0, 0));
      widthOk('traySVG(step 1)', S.o1 === '+' ? data.traySVG(icon, S.a, S.b, 0) : data.traySVG(icon, sv.mid, 0, S.b));
      widthOk('traySVG(step 2)', S.o2 === '+' ? data.traySVG(icon, sv.mid, S.c, 0) : data.traySVG(icon, sv.ans, 0, S.c));

      /* --- 範例 2：流程圖。四種題型各一個，順序也釘死 ---
         只驗「四種都出現過」的話，追加一個重複的第五格不會有人發現；
         只驗集合的話，刪掉一個再補一個同型的也一樣過。所以長度和每一格的
         形狀都由這張獨立的表決定（順序和速查卡的表格一致）。 */
      const FLOW_SHAPES = ['++', '+-', '-+', '--'];
      if (data.FLOW_CASES.length !== FLOW_SHAPES.length){
        fail(`FLOW_CASES has ${data.FLOW_CASES.length} entries; this lesson uses ${FLOW_SHAPES.length}`);
      }
      const shapes = {};
      data.FLOW_CASES.forEach((c, i) => {
        const v = stepOk(`FLOW_CASES[${i}]`, c, 100);
        if (!v) return;
        if (FLOW_SHAPES[i] && shapeOf(c) !== FLOW_SHAPES[i]){
          fail(`FLOW_CASES[${i}] is shape ${shapeOf(c)}, the checker expects ${FLOW_SHAPES[i]}`);
        }
        shapes[shapeOf(c)] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const chip = d.flowChip(c), story = d.storyOf(c);
          const f1 = d.f1(c, v.mid), f2 = d.f2(c, v.mid, v.ans), f3 = d.f3(c, v.mid, v.ans);
          [chip, story, f1, f2, f3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`FLOW_CASES[${i}] ${L}: ${s}`); });
          [c.a, c.b, c.c].forEach(n => {
            if (!hasNum(story, n)) fail(`FLOW_CASES[${i}] ${L}: the story never prints ${n}`);
          });
          const fq1 = eqText(c.a, c.o1, c.b, v.mid, L), fq2 = eqText(v.mid, c.o2, c.c, v.ans, L);
          if (!hasPhrase(f1, fq1)) fail(`FLOW_CASES[${i}] ${L}: f1 never shows the first number sentence "${fq1}"`);
          if (!hasPhrase(f2, fq2)) fail(`FLOW_CASES[${i}] ${L}: f2 never shows the second number sentence "${fq2}"`);
          if (!hasNum(f3, v.mid) || !hasNum(f3, v.ans)){
            fail(`FLOW_CASES[${i}] ${L}: f3 must contrast the middle number with the answer`);
          }
          /* 三格畫面（只有開始／露出中間數／露出答案）都要量一次。 */
          for (let r = 0; r <= 2; r++){
            widthOk(`flowSVG(${L}, case ${i}, reveal ${r})`,
              data.flowSVG(c.a, v.mid, v.ans, c.o1, c.o2, r, d.flowLab, d.opWord, [c.b, c.c]));
          }
        });
      });
      ['++','+-','-+','--'].forEach(k => {
        if (!shapes[k]) fail(`FLOW_CASES must cover all four shapes; ${k} is missing`);
      });

      /* --- 範例 3：兩個算式。至少要有一題的句子順序不是事情發生的順序 --- */
      /* 三題，前兩題照順序寫、第三題刻意打亂 —— 少一題也要抓得到。 */
      const EQ_ORDERS = ['forward', 'forward', 'reverse'];
      if (data.EQ_CASES.length !== EQ_ORDERS.length){
        fail(`EQ_CASES has ${data.EQ_CASES.length} entries; this lesson uses ${EQ_ORDERS.length}`);
      }
      let sawReverse = false;
      data.EQ_CASES.forEach((c, i) => {
        const v = stepOk(`EQ_CASES[${i}]`, c, 100);
        if (!v) return;
        if (c.order !== 'forward' && c.order !== 'reverse') fail(`EQ_CASES[${i}] has an unknown order ${c.order}`);
        if (EQ_ORDERS[i] && c.order !== EQ_ORDERS[i]){
          fail(`EQ_CASES[${i}] is ${c.order}, the checker expects ${EQ_ORDERS[i]}`);
        }
        if (c.order === 'reverse') sawReverse = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const story = (c.order === 'reverse') ? d.storyRev(c) : d.storyOf(c);
          const e0 = d.e0(c), e1 = d.e1(c), e2 = d.e2(c, v.mid), e3 = d.e3(c, v.mid, v.ans), e4 = d.e4(c, v.mid, v.ans);
          [story, e0, e1, e2, e3, e4].forEach(s => { if (/undefined|NaN/.test(s)) fail(`EQ_CASES[${i}] ${L}: ${s}`); });
          [c.a, c.b, c.c].forEach(n => {
            if (!hasNum(story, n)) fail(`EQ_CASES[${i}] ${L}: the story never prints ${n}`);
          });
          if (!hasNum(e1, c.b)) fail(`EQ_CASES[${i}] ${L}: e1 never names the first change (${c.b})`);
          const cq1 = eqText(c.a, c.o1, c.b, v.mid, L), cq2 = eqText(v.mid, c.o2, c.c, v.ans, L);
          if (!hasPhrase(e2, cq1)) fail(`EQ_CASES[${i}] ${L}: e2 never shows sentence 1 "${cq1}"`);
          if (!hasPhrase(e3, cq2)) fail(`EQ_CASES[${i}] ${L}: e3 never shows sentence 2 "${cq2}"`);
          const unit = L === 'zh' ? I18N.zh.scenes[c.si].unit : I18N.en.scenes[c.si].unit;
          if (!hasPhrase(e4, v.ans + ' ' + unit)) fail(`EQ_CASES[${i}] ${L}: e4 never states the answer with its unit`);
          if (!hasNum(e4, v.mid)) fail(`EQ_CASES[${i}] ${L}: e4 must say the answer is not the middle number`);
        });
      });
      if (!sawReverse) fail('EQ_CASES needs one story whose sentences are out of order');

      /* --- 範例 4：中間數不是答案。合理性那一句要跟著第二步的方向走 --- */
      const M = data.MID_EX;
      const mv = stepOk('MID_EX', M, 100);
      if (!mv) return;
      LANGS.forEach(L => {
        const d = I18N[L];
        const m0 = d.m0(M, mv.mid), m1 = d.m1(M, mv.mid), m2 = d.m2(M, mv.mid, mv.ans), m3 = d.m3(M, mv.mid, mv.ans);
        [m0, m1, m2, m3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`MID_EX ${L}: ${s}`); });
        const mq1 = eqText(M.a, M.o1, M.b, mv.mid, L);
        if (!hasPhrase(m0, mq1)) fail(`m0 ${L} never shows the first number sentence "${mq1}"`);
        if (!hasNum(m1, M.c)) fail(`m1 ${L} never names the change that was missed (${M.c})`);
        const mq2 = eqText(mv.mid, M.o2, M.c, mv.ans, L);
        if (!hasPhrase(m2, mq2)) fail(`m2 ${L} never shows the second number sentence "${mq2}"`);
        /* 東西變多 → 答案比中間數大；變少 → 比中間數小。方向寫反了要抓得到。
           （這裡不再拿 mv.ans 和 mv.mid 互比 —— 兩個都是從同一個 M.o2 算出來的，
           而 stepOk 已經保證 c ≥ 1，那個比較是恆真的，永遠不會響。真正在把關的是
           下面這條：畫面上印出來的方向詞要跟 M.o2 一致。） */
        const up = M.o2 === '+';
        const word = L === 'zh' ? (up ? '變多' : '變少') : (up ? 'up' : 'down');
        if (!hasPhrase(m3, word)) fail(`m3 ${L} never says which way the answer moves (expected "${word}")`);
      });

      /* --- 遊戲關卡：五關，形狀順序也釘死（頁面上寫著「第 N / 5 關」） --- */
      const ROUND_SHAPES = ['+-', '-+', '++', '--', '-+'];
      if (data.ROUNDS.length !== ROUND_SHAPES.length){
        fail(`ROUNDS has ${data.ROUNDS.length} rounds; the game advertises ${ROUND_SHAPES.length}`);
      }
      const gShapes = {};
      data.ROUNDS.forEach((r, idx) => {
        const i = idx + 1;
        const v = stepOk(`ROUND ${i}`, r, 100);
        if (!v) return;
        if (ROUND_SHAPES[idx] && shapeOf(r) !== ROUND_SHAPES[idx]){
          fail(`ROUND ${i} is shape ${shapeOf(r)}, the checker expects ${ROUND_SHAPES[idx]}`);
        }
        gShapes[shapeOf(r)] = true;
        if (r.opts.length !== 3) fail(`ROUND ${i} should offer 3 options, has ${r.opts.length}`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i} has duplicate options`);
        if (!Number.isInteger(r.ans) || r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i}: ans ${r.ans} is not a valid option index`);
          return;
        }
        if (r.opts[r.ans] !== v.ans) fail(`ROUND ${i}: opts[ans] does not equal the answer (${r.opts[r.ans]} vs ${v.ans})`);
        /* 誘答一定要包含中間數 —— 這一課唯一要抓的迷思。 */
        if (r.opts.indexOf(v.mid) < 0) fail(`ROUND ${i} should offer the middle number ${v.mid} as a distractor`);
        /* 遊戲屬於基礎層，所以上限就是基礎題庫的上限（BANK_MAX.qs），不是進階的 200。 */
        r.opts.forEach(o => {
          if (!Number.isInteger(o) || !(o >= 1 && o <= BASE_MAX)) fail(`ROUND ${i}: option ${o} is outside 1~${BASE_MAX}`);
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          const ask = d.gAsk(r), opt = d.gOpt(r, v.ans), h1 = d.gHint1(r), h2 = d.gHint2(r, v.mid), why = d.gWhy(r, v.mid, v.ans);
          [ask, opt, h1, h2, why].forEach(s => { if (/undefined|NaN/.test(s)) fail(`ROUND ${i} ${L}: ${s}`); });
          [r.a, r.b, r.c].forEach(n => {
            if (!hasNum(ask, n)) fail(`ROUND ${i} ${L}: gAsk never prints ${n}`);
          });
          /* 提示只給算式、不給結果，所以比對的是「mid ⊕ c」這個式子本身；
             說明則兩個完整算式都要有 —— 只檢查「有沒有提到 15 和 20」的話，
             把第二步教成減法（15 － 5）也會是綠的。 */
          const step2 = v.mid + (L === 'zh' ? (r.o2 === '+' ? ' ＋ ' : ' － ') : (r.o2 === '+' ? ' + ' : ' − ')) + r.c;
          if (!hasPhrase(h2, step2)) fail(`ROUND ${i} ${L}: gHint2 never shows what to work out next ("${step2}")`);
          const wq1 = eqText(r.a, r.o1, r.b, v.mid, L), wq2 = eqText(v.mid, r.o2, r.c, v.ans, L);
          if (!hasPhrase(why, wq1)) fail(`ROUND ${i} ${L}: gWhy never shows the first number sentence "${wq1}"`);
          if (!hasPhrase(why, wq2)) fail(`ROUND ${i} ${L}: gWhy never shows the second number sentence "${wq2}"`);
          if (!hasPhrase(why, opt)) fail(`ROUND ${i} ${L}: gWhy never states the answer "${opt}"`);
          const unit = L === 'zh' ? I18N.zh.scenes[r.si].unit : I18N.en.scenes[r.si].unit;
          if (opt !== v.ans + ' ' + unit) fail(`ROUND ${i} ${L}: the option label is "${opt}", the checker expects "${v.ans} ${unit}"`);
        });
      });
      ['++','+-','-+','--'].forEach(k => {
        if (!gShapes[k]) fail(`ROUNDS must cover all four shapes; ${k} is missing`);
      });
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');

      /* --- 速查卡與家長頁：手寫的算式必須和課程資料一致 ---
         這兩頁的算式是從 FLOW_CASES／STORY_EX／MID_EX 抄過來的，以前沒有任何檢查
         讀過它們 —— 課程頁改了數字、速查卡還留著舊的，兩邊就會互相矛盾而沒人發現。
         四頁在同一個資料夾（breaktest 也會把四頁一起複製過去），所以從
         verify_lesson_data 的參數推出資料夾再讀。讀不到就判錯，不要默默跳過。 */
      const fsMod = require('fs'), pathMod = require('path');
      const lessonDir = pathMod.dirname(process.argv[2] || '');
      const readSibling = (name) => {
        try { return fsMod.readFileSync(pathMod.join(lessonDir, name), 'utf8'); }
        catch (e){ fail(`cannot read ${name} next to index.html (${e.code})`); return null; }
      };
      /* 要比對的是**字典**，不是整份檔案的文字。頁面載入時 applyStatic() 會用字典的值
         覆寫每一個 data-i18n 元素的 innerHTML，所以 markup 裡那份中文只是預設值、
         執行時看不到。掃整份檔案的話，只改字典（真正會顯示的那一份）而 markup 沒動時，
         indexOf 仍然在 markup 裡找得到舊字串 —— 檢查就靜靜通過了（改壞測試證明了這件事）。
         分語言比對也是順帶修好的：zh 的算式只在 zh 字典裡找。 */
      const dictOf = (name, src) => {
        const iS = src.indexOf('var I18N = {');
        const iE = src.indexOf("var lang = 'zh';", iS);
        if (iS < 0 || iE < 0){ fail(`cannot locate the I18N literal in ${name}`); return null; }
        try { return new Function(src.slice(iS, iE) + '\n; return I18N;')(); }
        catch (e){ fail(`cannot evaluate the I18N literal in ${name} (${e.message})`); return null; }
      };
      const blobOf = (name, dict, L) => {
        const d = dict[L];
        if (!d){ fail(`${name} has no ${L} dictionary`); return ''; }
        return Object.keys(d).map(k => typeof d[k] === 'string' ? d[k] : '').join(' ');
      };
      const refSrc = readSibling('reference.html');
      const refDict = refSrc && dictOf('reference.html', refSrc);
      if (refDict){
        LANGS.forEach(L => {
          const blob = blobOf('reference.html', refDict, L);
          data.FLOW_CASES.forEach((c, i) => {
            const m = midOf(c), an = ansOf(c);
            const q1 = eqText(c.a, c.o1, c.b, m, L), q2 = eqText(m, c.o2, c.c, an, L);
            if (!hasPhrase(blob, q1)) fail(`reference.html (${L}) never shows FLOW_CASES[${i}] sentence 1 "${q1}"`);
            if (!hasPhrase(blob, q2)) fail(`reference.html (${L}) never shows FLOW_CASES[${i}] sentence 2 "${q2}"`);
          });
          /* 「算完先檢查一下」那張表：變多用 MID_EX 的第二步，變少用 STORY_EX 的第二步。 */
          const up = eqText(midOf(M), M.o2, M.c, ansOf(M), L);
          const down = eqText(midOf(S), S.o2, S.c, ansOf(S), L);
          if (!hasPhrase(blob, up)) fail(`reference.html (${L}) never shows the increase example "${up}"`);
          if (!hasPhrase(blob, down)) fail(`reference.html (${L}) never shows the decrease example "${down}"`);
        });
      }
      const parSrc = readSibling('parents.html');
      const parDict = parSrc && dictOf('parents.html', parSrc);
      if (parDict){
        LANGS.forEach(L => {
          const blob = blobOf('parents.html', parDict, L);
          const q1 = eqText(S.a, S.o1, S.b, midOf(S), L), q2 = eqText(midOf(S), S.o2, S.c, ansOf(S), L);
          if (!hasPhrase(blob, q1)) fail(`parents.html (${L}) never shows the worked first step "${q1}"`);
          if (!hasPhrase(blob, q2)) fail(`parents.html (${L}) never shows the worked second step "${q2}"`);
        });
      }

      /* --- 三層題庫的神諭表 ---
         每一題記四件事，都跟題目本身分開維護：
         - nums：題幹裡「一定要出現、而且只能出現」的數字（中英都驗）。
         - ev：事情發生的順序（不是句子的順序）—— 答案由它算出來，不是抄的。
         - want：正解要的是最後的答案（ans）、中間數（mid）、一句同時說出兩個數的話
           （textBoth），還是一句只點名中間數的話（textMid）。
         - optRe：這一題四個選項各自該長什麼樣。只驗正解的話，把某個誘答換成
           「banana」也不會有人發現。 */
      const BANK_EXPECTED = {
        qs: [
          { numCounts:{ zh:{'5':1, '6':1, '8':1}, en:{'5':1, '6':1, '8':1} }, ev:{a:8,o1:'+',b:5,o2:'-',c:6}, want:'ans', zh:'7 片', en:'7 biscuits',
            marks:{ zh:['有 8 片','放上 5 片','吃掉 6 片'],
                    en:['8 biscuits on the plate','5 more are put on the plate','6 are eaten'] },
            opts:{ zh:['13 片','19 片','7 片','2 片'],
                   en:['13 biscuits','19 biscuits','7 biscuits','2 biscuits'] },
            why:{ zh:"先算中間數：8 ＋ 5 ＝ 13 片。再算一步：13 － 6 ＝ 7 片。13 是中間數，不是答案。",
                  en:"Middle number first: 8 + 5 = 13 biscuits. Then one more step: 13 − 6 = 7 biscuits. 13 is the middle number, not the answer." },
            optRe:{ zh:/^\d+ 片$/, en:/^\d+ biscuits?$/ } },
          { numCounts:{ zh:{'5':1, '9':1, '24':1}, en:{'5':1, '9':1, '24':1} }, ev:{a:24,o1:'-',b:9,o2:'+',c:5}, want:'ans', zh:'20 個', en:'20 people',
            marks:{ zh:['有 24 個人','下車 9 個人','再上車 5 個人'],
                    en:['24 people on the bus','9 people get off','Then 5 people get on'] },
            opts:{ zh:['20 個','15 個','10 個','38 個'],
                   en:['20 people','15 people','10 people','38 people'] },
            why:{ zh:"先算中間數：24 － 9 ＝ 15 個。再算一步：15 ＋ 5 ＝ 20 個。",
                  en:"Middle number first: 24 − 9 = 15 people. Then one more step: 15 + 5 = 20 people." },
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ people$/ } },
          { numCounts:{ zh:{'8':1, '12':1, '30':1}, en:{'8':1, '12':1, '30':1} }, ev:{a:30,o1:'+',b:12,o2:'+',c:8}, want:'ans', zh:'50 本', en:'50 books',
            marks:{ zh:['有 30 本書','放上 12 本','又放上 8 本'],
                    en:['30 books on the shelf','12 more are put on the shelf','Another 8 are put on the shelf'] },
            opts:{ zh:['42 本','20 本','38 本','50 本'],
                   en:['42 books','20 books','38 books','50 books'] },
            why:{ zh:"先算中間數：30 ＋ 12 ＝ 42 本。再算一步：42 ＋ 8 ＝ 50 本。",
                  en:"Middle number first: 30 + 12 = 42 books. Then one more step: 42 + 8 = 50 books." },
            optRe:{ zh:/^\d+ 本$/, en:/^\d+ books?$/ } },
          { numCounts:{ zh:{'7':1, '12':1, '40':1}, en:{'7':1, '12':1, '40':1} }, ev:{a:40,o1:'-',b:12,o2:'-',c:7}, want:'ans', zh:'21 顆', en:'21 sweets',
            marks:{ zh:['有 40 顆糖果','送出 12 顆','又送出 7 顆'],
                    en:['40 sweets in the bag','12 are given away','Another 7 are given away'] },
            opts:{ zh:['28 顆','21 顆','19 顆','35 顆'],
                   en:['28 sweets','21 sweets','19 sweets','35 sweets'] },
            why:{ zh:"先算中間數：40 － 12 ＝ 28 顆。再算一步：28 － 7 ＝ 21 顆。",
                  en:"Middle number first: 40 − 12 = 28 sweets. Then one more step: 28 − 7 = 21 sweets." },
            optRe:{ zh:/^\d+ 顆$/, en:/^\d+ sweets?$/ } },
          /* 題幹自己印出中間數 27，所以 nums 要記著它。 */
          { numCounts:{ zh:{'18':2, '20':1, '27':2, '45':2}, en:{'18':2, '20':1, '27':2, '45':2} }, ev:{a:45,o1:'-',b:18,o2:'+',c:20}, want:'mid',
            zh:'中午賣掉之後還剩 27 杯', en:'27 cups were left after the noon sales',
            marks:{ zh:['早上做了 45 杯','中午賣掉 18 杯','下午又做 20 杯'],
                    en:['45 cups of juice were made in the morning','18 cups were sold at noon','20 more cups were made in the afternoon'] },
            opts:{ zh:['現在一共有 27 杯','下午做了 27 杯','中午賣掉之後還剩 27 杯','一共賣掉 27 杯'],
                   en:['there are 27 cups now','27 cups were made in the afternoon','27 cups were left after the noon sales','27 cups were sold in total'] },
            why:{ zh:"45 － 18 ＝ 27 算的是「賣掉之後還剩多少」，所以 27 是中午賣掉之後剩下的杯數。它是中間數，還要再加 20 杯才是答案。",
                  en:"45 − 18 = 27 works out how many were left after the selling, so 27 is the number of cups left after noon. It is the middle number — 20 more cups still have to be added." },
            optRe:{ zh:/^(?:現在一共有 \d+ 杯|下午做了 \d+ 杯|中午賣掉之後還剩 \d+ 杯|一共賣掉 \d+ 杯)$/,
                    en:/^(?:there are \d+ cups now|\d+ cups were made in the afternoon|\d+ cups were left after the noon sales|\d+ cups were sold in total)$/ } },
          { numCounts:{ zh:{'5':1, '8':1, '26':1}, en:{'5':1, '8':2, '26':1} }, ev:{a:26,o1:'-',b:8,o2:'+',c:5}, want:'mid', zh:'18 條', en:'18 fish',
            marks:{ zh:['有 26 條魚','先撈走 8 條','再放進 5 條'],
                    en:['26 fish in the tank','First 8 are scooped out','Then 5 are put in'] },
            opts:{ zh:['23 條','18 條','31 條','34 條'],
                   en:['23 fish','18 fish','31 fish','34 fish'] },
            why:{ zh:"這一步只做「撈走 8 條」：26 － 8 ＝ 18 條，這就是中間數。這一題只問到第一步，所以 18 條就是它要的；問現在有幾條的話，還要再算一步，才是 23 條。",
                  en:"This step only does the scooping out: 26 − 8 = 18 fish, and that is the middle number. This question stops at the first step, so 18 is what it asks for; if it asked how many are in the tank now, one more step would give 23 fish." },
            optRe:{ zh:/^\d+ 條$/, en:/^\d+ fish$/ } }
        ],
        qsAdv: [
          /* 句子的順序是 15 → 120 → 30，事情發生的順序是 120 → －30 → －15。
             marks 記的是**事情發生的順序**，所以這一題不比對句子的先後（ordered:false）。 */
          { numCounts:{ zh:{'15':1, '30':1, '120':1}, en:{'15':1, '30':1, '120':1} }, ev:{a:120,o1:'-',b:30,o2:'-',c:15}, want:'ans', zh:'75 本', en:'75 books',
            ordered:false,
            marks:{ zh:['早上圖書館有 120 本','中午借出 30 本','下午借出 15 本'],
                    en:['In the morning the library had 120 books','At noon 30 books were borrowed','In the afternoon 15 books were borrowed'] },
            opts:{ zh:['90 本','105 本','45 本','75 本'],
                   en:['90 books','105 books','45 books','75 books'] },
            why:{ zh:"照事情發生的先後：先算 120 － 30 ＝ 90 本，再算 90 － 15 ＝ 75 本。題目先寫下午，可是下午是後來才發生的。",
                  en:"Follow the order things happened: first 120 − 30 = 90 books, then 90 − 15 = 75 books. The afternoon is written first, but it happened last." },
            optRe:{ zh:/^\d+ 本$/, en:/^\d+ books?$/ } },
          { numCounts:{ zh:{'40':1, '62':1, '85':1}, en:{'40':1, '62':1, '85':1} }, ev:{a:85,o1:'+',b:40,o2:'-',c:62}, want:'ans', zh:'63 瓶', en:'63 bottles',
            marks:{ zh:['商店有 85 瓶牛奶','進貨 40 瓶','賣掉 62 瓶'],
                    en:['85 bottles of milk','40 bottles are delivered','62 bottles are sold'] },
            opts:{ zh:['63 瓶','125 瓶','23 瓶','187 瓶'],
                   en:['63 bottles','125 bottles','23 bottles','187 bottles'] },
            why:{ zh:"先算中間數：85 ＋ 40 ＝ 125 瓶。再算一步：125 － 62 ＝ 63 瓶。",
                  en:"Middle number first: 85 + 40 = 125 bottles. Then one more step: 125 − 62 = 63 bottles." },
            optRe:{ zh:/^\d+ 瓶$/, en:/^\d+ bottles?$/ } },
          { numCounts:{ zh:{'14':1, '20':1, '56':1}, en:{'14':1, '20':1, '56':1} }, ev:{a:56,o1:'-',b:20,o2:'+',c:14}, want:'textBoth',
            zh:'36 是中間數，答案是 50 台', en:'36 is the middle number and the answer is 50 cars',
            marks:{ zh:['停車場有 56 台車','開走 20 台','再開進 14 台'],
                    en:['56 cars in the car park','20 drive out','Then 14 drive in'] },
            opts:{ zh:['20 台就是答案','要先算 20 ＋ 14','36 是中間數，答案是 50 台','56 台就是答案'],
                   en:['20 cars is the answer','you should work out 20 + 14 first','36 is the middle number and the answer is 50 cars','56 cars is the answer'] },
            why:{ zh:"先算中間數：56 － 20 ＝ 36 台。36 還不是答案，再算 36 ＋ 14 ＝ 50 台才是。",
                  en:"Middle number first: 56 − 20 = 36 cars. 36 is not the answer yet — one more step, 36 + 14 = 50 cars, is." },
            optRe:{ zh:/^(?:\d+ 台就是答案|要先算 \d+ ＋ \d+|\d+ 是中間數，答案是 \d+ 台)$/,
                    en:/^(?:\d+ cars is the answer|you should work out \d+ \+ \d+ first|\d+ is the middle number and the answer is \d+ cars)$/ } },
          { numCounts:{ zh:{'25':1, '68':1, '150':1}, en:{'25':1, '68':1, '150':1} }, ev:{a:150,o1:'-',b:68,o2:'+',c:25}, want:'ans', zh:'107 顆', en:'107 apples',
            marks:{ zh:['果園有 150 顆蘋果','摘下 68 顆','再長出 25 顆'],
                    en:['150 apples','68 are picked','Then 25 new apples grow on the trees'] },
            opts:{ zh:['82 顆','107 顆','57 顆','193 顆'],
                   en:['82 apples','107 apples','57 apples','193 apples'] },
            why:{ zh:"先算中間數：150 － 68 ＝ 82 顆。再算一步：82 ＋ 25 ＝ 107 顆。",
                  en:"Middle number first: 150 − 68 = 82 apples. Then one more step: 82 + 25 = 107 apples." },
            optRe:{ zh:/^\d+ 顆$/, en:/^\d+ apples?$/ } }
        ],
        qsBoost: [
          { numCounts:{ zh:{'9':1, '13':1, '32':1}, en:{'9':1, '13':1, '32':1} }, ev:{a:32,o1:'-',b:13,o2:'+',c:9}, want:'ans', zh:'28 個', en:'28 cupcakes',
            marks:{ zh:['有 32 個杯子蛋糕','賣掉 13 個','下午又做 9 個'],
                    en:['32 cupcakes in the box','13 are sold','9 more are baked in the afternoon'] },
            opts:{ zh:['19 個','13 個','9 個','28 個'],
                   en:['19 cupcakes','13 cupcakes','9 cupcakes','28 cupcakes'] },
            why:{ zh:"32 － 13 ＝ 19，19 是中間數，不是答案 —— 那是賣掉之後的個數。還要再算 19 ＋ 9 ＝ 28 個才是現在的個數。",
                  en:"32 − 13 = 19, and 19 is the middle number, not the answer — it is how many were left after the selling. One more step, 19 + 9 = 28 cupcakes, gives what there is now." },
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ cupcakes?$/ } },
          /* 題幹自己印出中間數 35。 */
          { numCounts:{ zh:{'18':1, '25':1, '35':1, '60':1}, en:{'18':1, '25':1, '35':1, '60':1} }, ev:{a:60,o1:'-',b:25,o2:'+',c:18}, want:'textMid',
            zh:'35 是中間數，還要再算一步', en:'35 is the middle number and one more step is needed',
            marks:{ zh:['早上有 60 杯果汁','賣掉 25 杯','下午又做 18 杯'],
                    en:['60 cups of juice in the morning','25 are sold','18 more are made in the afternoon'] },
            opts:{ zh:['35 算錯了','應該先算 25 ＋ 18','35 是中間數，還要再算一步','下午做的 18 杯不用算'],
                   en:['35 was worked out wrongly','she should work out 25 + 18 first','35 is the middle number and one more step is needed','the 18 made in the afternoon do not count'] },
            why:{ zh:"60 － 25 ＝ 35 沒有算錯，可是 35 只是中間數。再算 35 ＋ 18 ＝ 53 杯才是答案。",
                  en:"60 − 25 = 35 is worked out correctly, but 35 is only the middle number. One more step, 35 + 18 = 53 cups, gives the answer." },
            optRe:{ zh:/^(?:\d+ 算錯了|應該先算 \d+ ＋ \d+|\d+ 是中間數，還要再算一步|下午做的 \d+ 杯不用算)$/,
                    en:/^(?:\d+ was worked out wrongly|she should work out \d+ \+ \d+ first|\d+ is the middle number and one more step is needed|the \d+ made in the afternoon do not count)$/ } }
        ]
      };
      /* 基礎題留在 100 以內，進階與迷思題到 200 —— 課程頁自己講的範圍。 */
      const BANK_MAX = { qs:BASE_MAX, qsAdv:MAXV, qsBoost:MAXV };

      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次長度。只比中文的話，刪掉最後一題英文題目時
           中文長度還是對的，而英文那一圈 forEach 會少跑一題。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          const items = I18N[L][bank];
          /* 先確認真的是陣列。一個「有值但不是陣列」的題庫會通過上面的長度比對，
             然後在這裡丟例外，把真正的診斷訊息整份蓋掉。 */
          if (!Array.isArray(items)){ fail(`${L} ${bank} is not an array`); return; }
          items.forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            if (!Array.isArray(q.opts)){ fail(`${bank}[${i}] ${L}: opts is not an array`); return; }
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。
               只驗「有沒有出現」擋不住「題幹多塞一個 7」—— 原本的數字還在，
               答案照樣重算得出來，整題就這樣蒙過去。
               範圍說清楚：這一條只看阿拉伯數字。 */
            /* 用 Set 收題幹的數字會把「出現幾次」丟掉：再加一句「放上 5 片」之後，
               集合還是 {8,5,6}、每個 mark 也都還在，正解卻從 7 變成 12。
               所以比對的是**出現次數**，多一次少一次都要抓到。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            const wantCounts = (o.numCounts || {})[L] || {};
            const gotCounts = {};
            (plain.match(/\d+/g) || []).forEach(n => { gotCounts[Number(n)] = (gotCounts[Number(n)] || 0) + 1; });
            Object.keys(wantCounts).forEach(k => {
              const want = wantCounts[k], got = gotCounts[k] || 0;
              if (got !== want){
                fail(`${bank}[${i}] ${L}: the stem shows ${k} ${got} time(s), the checker expects ${want}`);
              }
            });
            Object.keys(gotCounts).forEach(k => {
              if (!(k in wantCounts)){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${k}`);
              }
            });
            const o_nums = Object.keys(wantCounts).map(Number);
            /* 1b. 只比對「數字的集合」不夠：把「放上 5 片、吃掉 6 片」對調成
               「吃掉 5 片、放上 6 片」，{8,5,6} 完全沒變，重算出來的答案照樣是 7，
               整題卻已經是另一道題了。所以每個運算元都要跟它的**動詞**綁在一起記，
               而且（除了刻意打亂句序的那一題）要照事情發生的順序出現。 */
            const marks = (L === 'zh' ? o.marks.zh : o.marks.en) || [];
            if (marks.length !== 3) fail(`${bank}[${i}] ${L}: the checker records ${marks.length} event marks, expected 3`);
            let prev = -1, inOrder = true;
            marks.forEach(mk => {
              /* 只用第一個 indexOf 的話，同一句話出現兩次也看不出來。 */
              const hits = countPhrase(plain, mk);
              if (hits === 0){
                fail(`${bank}[${i}] ${L}: the stem never says "${mk}" — an operand, its operation, or its wording has changed`);
              } else if (hits > 1){
                fail(`${bank}[${i}] ${L}: the stem says "${mk}" ${hits} times; each event must appear exactly once`);
              } else {
                const at = plain.indexOf(mk);
                if (at < prev) inOrder = false;
                prev = at;
              }
            });
            if (o.ordered !== false && !inOrder){
              fail(`${bank}[${i}] ${L}: the three events are not written in the order the checker records`);
            }
            /* 2. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 3. 神諭寫下的字串本身要能從 ev 重算出來（不是抄答案）。 */
            const mid = o.ev.o1 === '+' ? (o.ev.a + o.ev.b) : (o.ev.a - o.ev.b);
            const ans = o.ev.o2 === '+' ? (mid + o.ev.c) : (mid - o.ev.c);
            if (mid < 1 || ans < 1) fail(`${bank}[${i}]: ${o_nums.join(' / ')} goes below 1 part-way through`);
            if (mid === ans) fail(`${bank}[${i}]: the middle number equals the answer (${mid})`);
            if (o.want === 'ans' && !hasNum(want, ans)){
              fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain ${ans}, recomputed from ${o_nums.join(' / ')}`);
            }
            if (o.want === 'mid' && !hasNum(want, mid)){
              fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain the middle number ${mid}`);
            }
            if (o.want === 'textBoth' && !(hasNum(want, mid) && hasNum(want, ans))){
              fail(`${bank}[${i}] ${L}: the recorded answer "${want}" must name both ${mid} and ${ans}`);
            }
            if (o.want === 'textMid' && !hasNum(want, mid)){
              fail(`${bank}[${i}] ${L}: the recorded answer "${want}" must name the middle number ${mid}`);
            }
            /* 4. 選項整組凍結。神諭只記正解的話，多加一個「其實也是對的」選項不會有人
               發現 —— qsAdv[2] 只要加一句「50 台就是答案」就有兩個正確選項，形狀、
               範圍、字串唯一性全都照樣通過。凍結的是已經被審過的那一組，任何新增、
               刪除或改寫都必須先更新這張表。順帶把「一定是 4 個」釘死：只驗
               `ans` 落在 `opts.length` 裡的話，把英文選項砍成 2 個也會是綠的。 */
            const wantOpts = (L === 'zh' ? o.opts.zh : o.opts.en) || [];
            if (q.opts.length !== 4){
              fail(`${bank}[${i}] ${L}: ${q.opts.length} options, this lesson always uses 4`);
            }
            if (JSON.stringify(q.opts) !== JSON.stringify(wantOpts)){
              fail(`${bank}[${i}] ${L}: the option set is ${JSON.stringify(q.opts)}, the checker expects ${JSON.stringify(wantOpts)}`);
            }
            /* 4a. 「N 就是答案」這一類宣稱的真假算得出來：非正解的選項不可以剛好
               宣稱正確答案。這是凍結表以外、真的在判斷「這個選項是不是對的」的一條。 */
            const claimRe = L === 'zh' ? /^(\d+) [^\d]+就是答案$/ : /^(\d+) [a-z]+ is the answer$/;
            q.opts.forEach((opt, oi) => {
              if (oi === q.ans) return;
              const cm = String(opt).match(claimRe);
              if (cm && Number(cm[1]) === ans){
                fail(`${bank}[${i}] ${L}: distractor "${opt}" states the correct answer ${ans}`);
              }
            });
            /* 4b. 每一個選項的形狀與數字範圍 —— 誘答也要驗，不只是正解。 */
            const re = L === 'zh' ? o.optRe.zh : o.optRe.en;
            q.opts.forEach(opt => {
              if (!re.test(opt)){
                fail(`${bank}[${i}] ${L}: option "${opt}" does not look like an answer to this question`);
              }
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= BANK_MAX[bank])){
                  fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~${BANK_MAX[bank]}`);
                }
              });
            });
            /* 4c. 解釋（why）以前完全沒有被讀過 —— 「8 ＋ 5 ＝ 13，所以答案是 13」
               寫在 why 裡，整份檢查照樣是綠的。兩個步驟的算式都要出現，而且是由
               ev 獨立重算出來的字串，不是拿頁面自己的格式化函式比自己。
               問中間數的題目（want:'mid'）只做第一步，所以不要求第二個算式。 */
            /* 兩個算式都對，結論卻寫「所以答案是 13」—— 光靠算式檢查放行得了。
               解釋整段凍結（和選項同一個作法），改寫就必須先更新這張表。 */
            const wantWhy = (o.why || {})[L];
            if (String(q.why) !== wantWhy){
              fail(`${bank}[${i}] ${L}: the explanation is "${q.why}", the checker expects "${wantWhy}"`);
            }
            const sym = (op) => L === 'zh' ? (op === '+' ? ' ＋ ' : ' － ') : (op === '+' ? ' + ' : ' − ');
            const eqOf = (x, op, y, z) => x + sym(op) + y + (L === 'zh' ? ' ＝ ' : ' = ') + z;
            const why = String(q.why || '');
            const eq1 = eqOf(o.ev.a, o.ev.o1, o.ev.b, mid);
            if (!hasPhrase(why, eq1)){
              fail(`${bank}[${i}] ${L}: the explanation never shows the first step "${eq1}"`);
            }
            if (o.want !== 'mid'){
              const eq2 = eqOf(mid, o.ev.o2, o.ev.c, ans);
              if (!hasPhrase(why, eq2)){
                fail(`${bank}[${i}] ${L}: the explanation never shows the second step "${eq2}"`);
              }
            }
            /* 5. 選項字串兩兩不同（含空白正規化的版本）。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a2 = 0; a2 < trimmed.length; a2++){
              for (let b2 = a2 + 1; b2 < trimmed.length; b2++){
                if (trimmed[a2] === trimmed[b2]) fail(`${bank}[${i}] ${L}: "${q.opts[a2]}" appears twice`);
              }
            }
            /* 6. 迷思誘答：問最後答案的題目，中間數一定要在選項裡。 */
            if (o.want === 'ans'){
              const seen = q.opts.some(opt => hasNum(String(opt), mid));
              if (!seen) fail(`${bank}[${i}] ${L}: the middle number ${mid} must appear as a distractor`);
            }
          });
        });
      });
    }
  }
};
