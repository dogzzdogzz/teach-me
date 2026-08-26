/* grade-2/math/solid（立體形體：面、邊、頂點的直觀觀察）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課最貴的風險不是算術，是「教的規則本身有沒有唯一答案」：
   課本對「圓柱有幾個面」有兩種算法（2 個平面，或再加上側面共 3 個），
   對圓錐尖端那一點算幾個頂點也各說各話。所以這一課選定一套說法並貫徹四頁：

     面  → 一律寫「平平的面」，彎彎的面分開算，永遠不併入平平的面。
     邊  → 一律寫「直直的邊」，罐頭上下那兩圈彎彎的邊不算。
     頂點 → 尖尖的「一個點」：正方體／長方體是邊碰邊的角（8 個），
            圓錐上面那一個尖端就是它唯一的頂點（1 個），圓柱上下是一整圈、不是點（0 個）。

   因此：**不可以有任何一題問「有幾個面」或「有幾條邊」**（那樣答案不唯一），
   而且圓錐永遠不出現在問頂點的題目裡。下面的 optionOk／INVARIANTS 只擋得住
   數值與形狀，問法的唯一性靠 data.check 的題庫神諭（BANK_EXPECTED）逐題比對。 */

/* ---------- 設定檔自己的真值表（和課程檔案獨立的第三份） ---------- */
const T = [
  { id:'cube',   icon:'🎲', flat:6, curved:0, edge:12, vert:8, sameFaces:true,  stable:true,  rolls:false, stackTop:true,  tip:false,
    faceShape:'square', zh:{ name:'正方體', real:'骰子' },       en:{ name:'cube',     real:'a die' } },
  { id:'cuboid', icon:'📦', flat:6, curved:0, edge:12, vert:8, sameFaces:false, stable:true,  rolls:false, stackTop:true,  tip:false,
    faceShape:'rect',   zh:{ name:'長方體', real:'牛奶盒' },     en:{ name:'cuboid',   real:'a milk carton' } },
  { id:'cyl',    icon:'🥫', flat:2, curved:1, edge:0,  vert:0, sameFaces:false, stable:true,  rolls:true,  stackTop:true,  tip:false,
    faceShape:'circle', zh:{ name:'圓柱',   real:'罐頭' },       en:{ name:'cylinder', real:'a tin can' } },
  { id:'ball',   icon:'⚽', flat:0, curved:1, edge:0,  vert:0, sameFaces:false, stable:false, rolls:true,  stackTop:false, tip:false,
    faceShape:null,     zh:{ name:'球',     real:'皮球' },       en:{ name:'sphere',   real:'a ball' } },
  /* 圓錐的 vert 是 1：頂點＝尖尖的「一個點」，上面那個尖端就是它唯一的頂點（標準說法）。
     tip 標記它的頂點是尖端型（沒有直直的邊在那裡交會），表格會多寫一句說明。
     生活實物用聖誕樹不用甜筒：甜筒開口是空的，沒有實心的圓底，
     照著實物觀察會數出 0 個平平的面（codex 第二輪抓到）。 */
  { id:'cone',   icon:'🎄', flat:1, curved:1, edge:0,  vert:1, sameFaces:false, stable:true,  rolls:true,  stackTop:false, tip:true,
    faceShape:'circle', zh:{ name:'圓錐',   real:'聖誕樹' }, en:{ name:'cone',     real:'a Christmas tree' } }
];
const IDX = {};
T.forEach((s, i) => { IDX[s.id] = i; });
const SHAPE_TRUTH = {
  square:{ zh:'正方形', en:'square' },
  rect:{ zh:'長方形', en:'rectangle' },
  circle:{ zh:'圓形', en:'circle' },
  triangle:{ zh:'三角形', en:'triangle' }
};

const ZH_UNIT = { flat:'個', edge:'條', vert:'個' };
const EN_UNIT = { flat:['face','faces'], edge:['edge','edges'], vert:['corner','corners'] };
function fmtN(n, kind, lang){
  return lang === 'zh' ? (n + ' ' + ZH_UNIT[kind])
                       : (n + ' ' + EN_UNIT[kind][n === 1 ? 0 : 1]);
}
function fmtSo(si, lang){ return T[si].icon + ' ' + T[si][lang].name; }
function pvRight(plane, si, lang){
  return lang === 'zh'
    ? (SHAPE_TRUTH[plane].zh + '是平面圖形，' + T[si][lang].name + '是立體形體')
    : ('a ' + SHAPE_TRUTH[plane].en + ' is a flat shape and a ' + T[si].en.name + ' is a solid shape');
}

/* 「我有 n 個平平的面 ＋ 這一句」到底符合哪些立體形體？
   每一組線索都必須剛好符合五個裡的一個，否則就有兩個正確答案。 */
const EXTRA_PRED = {
  same:      s => s.sameFaces === true,
  notsame:   s => s.sameFaces === false,
  rollstack: s => s.rolls === true && s.stackTop === true,
  point:     s => s.flat > 0 && s.stackTop === false,
  roll:      s => s.flat === 0
};
/* 每一種線索「決定答案的那一句」在解釋裡必須出現的字。設定檔自己記一份，
   不是拿頁面的字典去比頁面自己的字。 */
const CLUE_SAY = {
  zh:{ same:'一樣大的正方形', notsame:'不是都一樣大', rollstack:'躺下來會滾', point:'尖尖的', roll:'站不穩' },
  en:{ same:'squares of the same size', notsame:'not all the same size', rollstack:'rolls lying down',
       point:'sharp point', roll:'rolls easily when nudged' }
};
function clueTargets(flat, extra){
  const pred = EXTRA_PRED[extra];
  if (!pred) return null;
  return T.filter(s => s.flat === flat && pred(s));
}

/* ---------- 選項的值物件 ---------- */
/* 去重鍵含「種類」：同一題裡不會混用兩種數量，但把種類拿掉就等於只比數字。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'n')  return 'n#' + v.kind + '#' + v.n;
  if (v.u === 'so') return 'so#' + v.si;
  if (v.u === 'sh') return 'sh#' + v.id;
  if (v.u === 'pv') return 'pv#' + v.kind;
  return 'bad';
}
function distinctOpts(d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'this lesson always offers 4 options';
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
  if (!Number.isInteger(d.ans) || d.ans < 0 || d.ans >= (d.opts || []).length){
    return 'ans ' + d.ans + ' is not a valid option index';
  }
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 情境編號要落在真值表裡，否則 T[si] 是 undefined，後面每一條比對都變成
   undefined 對 undefined —— 整題沒被驗到卻是綠的。 */
function siOk(si, label){
  if (!Number.isInteger(si) || si < 0 || si >= T.length){
    return (label || 'solid') + ' index ' + si + ' is outside the checker catalogue (0~' + (T.length - 1) + ')';
  }
  return null;
}
/* 誘答不可以把題幹印出來的數字抄回來。simgen 的通用版本比的是整個選項字串
   （「6 個」比不到題幹的「6」），所以這一課要自己比數值。 */
function noStemEcho(d, stemNums){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans) continue;
    const o = d.opts[i];
    if (o && o.u === 'n' && stemNums.indexOf(o.n) >= 0){
      return 'distractor ' + o.n + ' copies a number out of the stem (' + stemNums.join('/') + ')';
    }
  }
  return null;
}
function base(d, want){ return distinctOpts(d) || answerIs(d, want); }

/* ---------- SVG 的畫布要蓋住它自己畫出去的每一個邊緣 ---------- */
/* 只驗右緣不夠：height="1" 的畫布照樣通過（codex 審查抓到）。四個方向都要驗。
   只讀元素的起點也不夠 —— 起點在畫布內不代表整個元素畫得下，所以一律算到
   描邊的外緣（stroke 會往兩邊各長出一半）。
   認不得的標籤、讀不出來的座標一律判失敗（fail-closed）：默默跳過一個元素，
   等於那個元素永遠不會被量到。 */
const MEASURABLE = ['rect','circle','ellipse','line','polygon','polyline','text'];
function edgesOf(svg){
  const xs = [], ys = [], xsL = [], ysT = [], missing = [];
  let seen = 0, m;
  /* 屬性名前面一定要是字串開頭或空白。用 \b 的話，`data-x="0"` 會被當成 x、
     `stroke-width="3"` 會被當成 width —— 抓到的是別的屬性的值（codex 審查抓到）。 */
  const num = (a, name) => Number((a.match(new RegExp('(?:^|\\s)' + name + '="(-?\\d+(?:\\.\\d+)?)"')) || [])[1]);
  const half = (a, tag) => {
    /* 幾何有可能被行內 style 或 CSS class 改掉，那時屬性量到的邊緣就不是畫面上的邊緣。
       這個量法只認屬性，所以遇到 style=、或除了 mk 以外的 class，一律判失敗
       （fail-closed），不要假裝量得到（codex 第二輪抓到）。 */
    if (/(?:^|\s)style="/.test(a)){ missing.push(tag + ' carries an inline style, which this reader cannot measure'); return null; }
    /* class 一律不放行：頁面 CSS 的 `.mk{stroke-width:100px}` 會蓋掉屬性值，
       這個量法只讀屬性，就會拿舊的幾何過關（codex 第三輪抓到）。
       標記改用 data-k 當選取器，所以沒有任何要量的元素需要 class。 */
    const cls = (a.match(/(?:^|\s)class="([^"]*)"/) || [])[1];
    if (cls !== undefined){ missing.push(tag + ' carries class="' + cls + '", which page CSS could restyle'); return null; }
    const st = (a.match(/(?:^|\s)stroke="([^"]*)"/) || [])[1];
    if (st === undefined || st === 'none') return 0;   /* 沒有描邊就沒有外擴 */
    const sw = num(a, 'stroke-width');
    if (!Number.isFinite(sw)){ missing.push(tag + ' paints a stroke but declares no stroke-width'); return null; }
    return sw / 2;
  };
  const put = (x, y, h) => { xs.push(x + h); ys.push(y + h); xsL.push(x - h); ysT.push(y - h); };
  const need = (tag, a, names) => {
    const vals = names.map(n => num(a, n));
    if (vals.some(v => !Number.isFinite(v))){
      missing.push(tag + ' is missing a readable ' + names.join('/'));
      return null;
    }
    return vals;
  };
  const scan = (tag, re, fn) => {
    while ((m = re.exec(svg)) !== null){
      seen++;
      const a = m[1];
      const h = half(a, tag);
      if (h === null) continue;
      fn(a, h, m);
    }
  };
  scan('rect', /<rect([^>]*?)\/?>/g, (a, h) => {
    const v = need('rect', a, ['x','y','width','height']);
    if (v) { put(v[0], v[1], h); put(v[0] + v[2], v[1] + v[3], h); }
  });
  scan('circle', /<circle([^>]*?)\/?>/g, (a, h) => {
    const v = need('circle', a, ['cx','cy','r']);
    if (v) { put(v[0] + v[2], v[1] + v[2], h); put(v[0] - v[2], v[1] - v[2], h); }
  });
  scan('ellipse', /<ellipse([^>]*?)\/?>/g, (a, h) => {
    const v = need('ellipse', a, ['cx','cy','rx','ry']);
    if (v) { put(v[0] + v[2], v[1] + v[3], h); put(v[0] - v[2], v[1] - v[3], h); }
  });
  scan('line', /<line([^>]*?)\/?>/g, (a, h) => {
    const v = need('line', a, ['x1','y1','x2','y2']);
    if (v) { put(v[0], v[1], h); put(v[2], v[3], h); }
  });
  const rePoly = /<(?:polygon|polyline)([^>]*?)\/?>/g;
  while ((m = rePoly.exec(svg)) !== null){
    seen++;
    const a = m[1];
    const h = half(a, 'polygon');
    if (h === null) continue;
    const pm = a.match(/(?:^|\s)points="([^"]+)"/);
    if (!pm){ missing.push('polygon is missing a readable points list'); continue; }
    let any = false;
    pm[1].trim().split(/\s+/).forEach(pair => {
      const xy = pair.split(',').map(Number);
      if (xy.length === 2 && xy.every(Number.isFinite)){ put(xy[0], xy[1], h); any = true; }
    });
    if (!any) missing.push('polygon points do not parse');
  }
  /* 文字的右緣不是 x —— 還要算字數與 text-anchor 把字擺在 x 的哪一邊。 */
  const reText = /<text([^>]*)>([^<]*)<\/text>/g;
  while ((m = reText.exec(svg)) !== null){
    seen++;
    const a = m[1], body = m[2];
    /* 文字這一條原本沒有走 half()，所以 style="font-size:200px" 會被當成 20px 量
       （codex 第三輪抓到）。現在和其他元素一樣先 fail-closed，字級也必須寫出來。 */
    const hT = half(a, 'text');
    if (hT === null) continue;
    const x = num(a, 'x'), y = num(a, 'y');
    if (!Number.isFinite(x) || !Number.isFinite(y)){ missing.push('text is missing a readable x/y'); continue; }
    const fsm = a.match(/(?:^|\s)font-size="(\d+)"/);
    if (!fsm){ missing.push('text declares no font-size, so its extent cannot be measured'); continue; }
    const fs = Number(fsm[1]);
    const anchor = (a.match(/(?:^|\s)text-anchor="([a-z]+)"/) || [])[1] || 'start';
    const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
    const right = anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide);
    const left = anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x);
    xs.push(right + hT); xsL.push(left - hT); ys.push(y + 2 + hT); ysT.push(y - fs - hT);
  }
  /* 解析器量到幾個元素，畫面上就有幾個 —— 對不上表示有一種元素整批沒被量到。 */
  const tags = (svg.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
  const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
  const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
  return { xs, ys, xsL, ysT, seen, rawCount, unsupported, missing };
}
function canvasProblem(label, svg){
  const w = Number((svg.match(/(?:^|\s)width="(\d+)"/) || [])[1]);
  const h = Number((svg.match(/(?:^|\s)height="(\d+)"/) || [])[1]);
  const vb = svg.match(/viewBox="0 0 (\d+) (\d+)"/) || [];
  const e = edgesOf(svg);
  if (e.unsupported.length) return label + ': draws <' + e.unsupported[0] + '>, which the geometry reader cannot measure';
  if (e.missing.length) return label + ': ' + e.missing[0];
  if (e.seen !== e.rawCount){
    return label + ': the geometry reader measured ' + e.seen + ' of ' + e.rawCount + ' drawn elements';
  }
  if (!Number.isFinite(w) || !Number.isFinite(h) || !e.xs.length) return label + ': cannot read the drawing geometry';
  if (Number(vb[1]) !== w || Number(vb[2]) !== h){
    return label + ': the viewBox (' + vb[1] + ' x ' + vb[2] + ') does not match the canvas (' + w + ' x ' + h + ')';
  }
  const right = Math.max.apply(null, e.xs), bottom = Math.max.apply(null, e.ys);
  const left = Math.min.apply(null, e.xsL), top = Math.min.apply(null, e.ysT);
  if (!(w >= right + 2)) return label + ' is ' + w + 'px wide but draws out to x=' + right;
  if (!(h >= bottom + 2)) return label + ' is ' + h + 'px tall but draws out to y=' + bottom;
  if (!(left >= 0)) return label + ' is clipped by the left edge (draws out to x=' + left + ')';
  if (!(top >= 0)) return label + ' is clipped by the top edge (draws out to y=' + top + ')';
  return null;
}

/* 英文把數字插進句子時最常漏掉的一條：1 個要用單數。
   「1 flat faces」資料層完全正確，只有把句子印出來才看得到。
   反向也要驗：0 個、2 個以上一定要用複數（「2 flat face」一樣是錯的）。 */
const EN_NOUNS = ['flat face', 'curved face', 'straight edge', 'corner'];
function enPluralProblem(where, text){
  /* 標籤拿掉之後要把空白正規化：`<span>1</span> flat faces` 會變成
     「1␣␣flat faces」，只比一個空白的話這一條就靜靜放行了。 */
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  /* 冠詞也要驗：`a 8 corners` 通過了數字-名詞的單複數檢查，畫面上卻是錯的。
     插進句子的是數字時，前面不可以有 a／an（codex 第二輪抓到）。 */
  const art = t.match(/(?:^|\s)(an?) \d/);
  if (art) return `${where}: "${art[1]} " immediately before a number — drop the article`;
  for (const noun of EN_NOUNS){
    const one = new RegExp('(?<![0-9])1 ' + noun + 's\\b');
    if (one.test(t)) return `${where}: "1 ${noun}s" — one of anything takes the singular`;
    const many = new RegExp('(?<![0-9])(?:0|[2-9]|[0-9]{2,}) ' + noun + '(?!s)\\b');
    const m = t.match(many);
    if (m) return `${where}: "${m[0]}" — anything other than 1 takes the plural`;
  }
  return null;
}

/* ---------- 每個產生器的選項形狀與數字範圍 ---------- */
/* 範圍一律從這一課自己的規則推出來：
   平平的面最多 6（正方體／長方體），直直的邊最多 12，頂點最多 8，
   誘答池 FACE_POOL 的最大值是 12 —— 所以單一形體的三種數量都是 0~12。 */
const SHAPE_OF = {
  flatFaces:      ['nflat'],
  straightEdges:  ['nedge'],
  corners:        ['nvert'],
  countTotalFlat: ['nflat'],
  mixedTotalFlat: ['nflat'],
  whichNoRoll:    ['so'],
  whichNoStack:   ['so'],
  realToSolid:    ['so'],
  identifyByClue: ['so'],
  faceShape:      ['sh','so'],
  planeVsSolid:   ['pv']
};
const RANGE = {
  /* 上限就是這一課該數量真正的最大值，不是一個寬鬆的大數：
     平平的面最多 6（正方體／長方體）、直直的邊最多 12、頂點最多 8。 */
  flatFaces:      [0, 6],
  straightEdges:  [0, 12],
  corners:        [0, 8],
  /* n 最多 4、每個最多 6 個平平的面 → 正解最多 24；誘答最大的是「多算一份」
     total ＋ flat ＝ 30。 */
  countTotalFlat: [0, 30],
  /* 兩種各最多 3 個、每個最多 6 個面 → 正解最多 36；誘答最大的是 total ＋ nb ＝ 39。 */
  mixedTotalFlat: [0, 39]
};

const ICONS = '🎲|📦|🥫|⚽|🎄';
const ZH_SOLID = '正方體|長方體|圓柱|球|圓錐';
const EN_SOLID = 'cube|cuboid|cylinder|sphere|cone';
const ZH_PLANE = '正方形|長方形|圓形|三角形';
const EN_PLANE = 'square|rectangle|circle|triangle';
const SHAPES = {
  zh: {
    nflat:  /^\d+ 個$/,
    nedge:  /^\d+ 條$/,
    nvert:  /^\d+ 個$/,
    so:     new RegExp('^(?:' + ICONS + ') (?:' + ZH_SOLID + ')$'),
    sh:     new RegExp('^(?:' + ZH_PLANE + ')$'),
    pv:     new RegExp('^(?:(?:' + ZH_PLANE + ')是平面圖形，(?:' + ZH_SOLID + ')是立體形體' +
                       '|兩個都是立體形體|兩個都是平面圖形' +
                       '|(?:' + ZH_PLANE + ')是立體形體，(?:' + ZH_SOLID + ')是平面圖形)$')
  },
  en: {
    nflat:  /^\d+ faces?$/,
    nedge:  /^\d+ edges?$/,
    nvert:  /^\d+ corners?$/,
    so:     new RegExp('^(?:' + ICONS + ') (?:' + EN_SOLID + ')$'),
    sh:     new RegExp('^(?:' + EN_PLANE + ')$'),
    pv:     new RegExp('^(?:a (?:' + EN_PLANE + ') is a flat shape and a (?:' + EN_SOLID + ') is a solid shape' +
                       '|both of them are solid shapes|both of them are flat shapes' +
                       '|a (?:' + EN_PLANE + ') is a solid shape and a (?:' + EN_SOLID + ') is a flat shape)$')
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/solid */
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
    /* 去重鍵少了數字的話，同一種數量的誘答會被當成重複而全部擋掉，選項就不夠 4 個。 */
    { file:'review', expect:'option count',
      find:"    if (v.u === 'n')  return 'n#' + v.kind + '#' + v.n;",
      replace:"    if (v.u === 'n')  return 'n#' + v.kind;" },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (lang === 'zh') return v.n + ' ' + UNIT.zh[v.kind];",
      replace:"    if (lang === 'zh') return v.n + ' 個';" },
    { file:'review', expect:'plural does not match',
      find:"    return v.n + ' ' + UNIT.en[v.kind][v.n === 1 ? 0 : 1];",
      replace:"    return v.n + ' ' + UNIT.en[v.kind][1];" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.u === 'so') return SOLIDS[v.si].icon + ' ' + nameOf(v.si, lang);",
      replace:"    if (v.u === 'so') return nameOf(v.si, lang);" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (v.kind === 'right') return p + '是平面圖形，' + s + '是立體形體';",
      replace:"      if (v.kind === 'right') return s + '是平面圖形，' + p + '是立體形體';" },

    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'correct is',
      find:"        var cands = [ N(s.flat + s.curved, 'flat'), N(s.flat + 2 <= 6 ? s.flat + 2 : s.flat - 2, 'flat') ];",
      replace:"        correct = N(s.flat + s.curved, 'flat');\n        var cands = [ N(s.flat, 'flat'), N(s.flat + 2 <= 6 ? s.flat + 2 : s.flat - 2, 'flat') ];" },
    { file:'review', expect:'correct is',
      find:"        var correct = N(s.edge, 'edge');",
      replace:"        var correct = N(s.vert, 'edge');" },
    { file:'review', expect:'correct is',
      find:"        var correct = N(s.vert, 'vert');",
      replace:"        var correct = N(s.edge, 'vert');" },
    { file:'review', expect:'total is not n × flat',
      find:'        var total = n * s.flat;',
      replace:'        var total = n + s.flat;' },
    /* 題幹印出來的數字不可以拿來當誘答 —— 拿掉 ban 並刻意放一個進去，證明那條斷言會響。 */
    { file:'review', expect:'copies a number out of the stem',
      find:"        var mix = mixOpts(correct, cands, function(i){\n          var alt = [total - s.flat, total + n, total + 1, total - 1, total + 2,\n                     total - 2, s.flat, total + 3, total + 4, total + 5];\n          return (i < alt.length && alt[i] >= 0 && alt[i] <= 30) ? N(alt[i], 'flat') : null;\n        }, [n]);",
      replace:"        cands = [ N(n, 'flat') ].concat(cands);\n        var mix = mixOpts(correct, cands, function(i){\n          var alt = [total - s.flat, total + n, total + 1, total - 1, total + 2,\n                     total - 2, s.flat, total + 3, total + 4, total + 5];\n          return (i < alt.length && alt[i] >= 0 && alt[i] <= 30) ? N(alt[i], 'flat') : null;\n        }, []);" },
    /* 範圍斷言：塞一個 400 進去，證明「0~30」真的擋得住。 */
    { file:'review', expect:'outside 0~30',
      find:'        return { si:si, n:n, total:total, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:"        mix.opts[(mix.ans + 1) % 4] = N(400, 'flat');\n        return { si:si, n:n, total:total, correct:correct, opts:mix.opts, ans:mix.ans };" },
    { file:'review', expect:'is not na ×',
      find:'        var pa = na * SOLIDS[a].flat, pb = nb * SOLIDS[b].flat;',
      replace:'        var pa = na + SOLIDS[a].flat, pb = nb * SOLIDS[b].flat;' },
    { file:'review', expect:'total is not the two parts added',
      find:'        var total = pa + pb;',
      replace:'        var total = pa + pb + 1;' },
    /* 「哪一個不會滾」的三個誘答一定要全部都會滾，不然就有兩個正確答案。 */
    { file:'review', expect:'exactly one option must not roll',
      find:'        var opts = shuffle([SO(si), SO(2), SO(3), SO(4)]);',
      replace:'        var opts = shuffle([SO(si), SO(1 - si), SO(3), SO(4)]);' },
    { file:'review', expect:'exactly one option must be the unstackable one',
      find:'        var opts = shuffle([SO(si), SO(0), SO(1), SO(2)]);',
      replace:'        var opts = shuffle([SO(si), SO(7 - si), SO(1), SO(2)]);' },
    { file:'review', expect:'two options are the same answer',
      find:"        var pool = shuffle([0,1,2,3,4].filter(function(x){ return x !== si; })).slice(0, 3);\n        var opts = shuffle([SO(si)].concat(pool.map(SO)));\n        return { si:si, correct:opts[opts.map(vkeyOf).indexOf('so#' + si)],\n                 opts:opts, ans:opts.map(vkeyOf).indexOf('so#' + si), svg:solidSVG(SOLIDS[si].id) };",
      replace:"        var pool = [si, (si + 1) % 5, (si + 2) % 5];\n        var opts = shuffle([SO(si)].concat(pool.map(SO)));\n        return { si:si, correct:opts[opts.map(vkeyOf).indexOf('so#' + si)],\n                 opts:opts, ans:opts.map(vkeyOf).indexOf('so#' + si), svg:solidSVG(SOLIDS[si].id) };" },
    { file:'review', expect:'the answer must be the flat shape',
      find:'        var correct = SH(s.faceShape);',
      replace:'        var correct = SO(si);' },
    /* 長方體的面不一定都是長方形（正方體也是長方體的一種），所以它不能出這一題。 */
    { file:'review', expect:'a cuboid face is not always a rectangle',
      find:'        var si = Number(pickUnused([0,2,4], used));     /* 長方體的面不一定都是長方形，不出這一題 */',
      replace:'        var si = Number(pickUnused([0,1,2,4], used));     /* 長方體的面不一定都是長方形，不出這一題 */' },
    { file:'review', expect:'opts[ans] != correct',
      find:"        var correct = PV('right', p.plane, p.si);",
      replace:"        var correct = PV('right', p.plane, (p.si + 1) % 5);" },
    { file:'review', expect:'the extra clue does not match',
      find:"        return { si:si, extra:CLUE_EXTRA[SOLIDS[si].id],",
      replace:"        return { si:si, extra:'roll'," },
    /* 猜謎的三個誘答不可以也符合線索。 */
    { file:'review', expect:'exactly one option matches the clue',
      find:"        var pool = shuffle([0,1,2,3,4].filter(function(x){ return x !== si; })).slice(0, 3);\n        var opts = shuffle([SO(si)].concat(pool.map(SO)));\n        return { si:si, extra:CLUE_EXTRA[SOLIDS[si].id],",
      replace:"        var pool = shuffle([0,1,2,3,4].filter(function(x){ return x !== si; })).slice(0, 3);\n        var opts = shuffle([SO(si)].concat(pool.map(SO)));\n        si = (si + 1) % 5;\n        return { si:si, extra:CLUE_EXTRA[SOLIDS[si].id]," },

    /* --- review.html：畫布寬度（每一種立體形體都要驗） --- */
    { file:'review', expect:'draws out to x=',
      find:'  function solidSVG(id){\n    var w = 140, h = 126, tableY = 114;',
      replace:'  function solidSVG(id){\n    var w = 90, h = 126, tableY = 114;' },
    { file:'review', expect:'draws out to x=',
      find:'      var x0 = (id === \'cube\') ? 26 : 14, y0 = tableY - H, dx = 24, dy = 20;',
      replace:'      var x0 = (id === \'cube\') ? 26 : 14, y0 = tableY - H, dx = 90, dy = 20;' },
    /* 認不得的標籤要 fail-closed，不能默默跳過。 */
    { file:'review', expect:'cannot measure',
      find:"      s += '<circle cx=\"70\" cy=\"80\" r=\"34\" fill=\"' + fill + '\" stroke=\"' + edge + '\" stroke-width=\"3\"/>';",
      replace:"      s += '<path d=\"M 36 80 L 104 80\" stroke=\"' + edge + '\"/>';" },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? ('一' + s.zh.cl + s.zh.real + '有 ' + s.flat + ' 個平平的面：'",
      replace:"            ? ('一' + s.zh.cl + s.zh.real + '有' + s.flat + ' 個平平的面：'" },
    { file:'review', expect:'doubled punctuation',
      find:"            : ('One ' + s.en.bare + ' has ' + faceWord(s.flat, 'en') + ': ' + s.flat + ' × ' + d.n + ' = ' + d.total + '.')",
      replace:"            : ('One ' + s.en.bare + ' has ' + faceWord(s.flat, 'en') + ': ' + s.flat + ' × ' + d.n + ' = ' + d.total + '..')" },

    /* --- index.html：真值表、範例、對照表、遊戲、題庫 --- */
    { file:'index', expect:'the checker expects',
      find:"    { id:'cube',   icon:'🎲', flat:6, curved:0, edge:12, vert:8, sameFaces:true,  stable:true,  rolls:false, stackTop:true,  tip:false },",
      replace:"    { id:'cube',   icon:'🎲', flat:5, curved:0, edge:12, vert:8, sameFaces:true,  stable:true,  rolls:false, stackTop:true,  tip:false }," },
    { file:'index', expect:'the checker expects',
      find:"        { name:'正方體', real:'骰子' },",
      replace:"        { name:'正方形', real:'骰子' }," },
    { file:'index', expect:'the checker expects',
      find:"        { name:'cylinder', real:'a tin can' },",
      replace:"        { name:'cylinder', real:'a can' }," },
    { file:'index', expect:'r2 zh[0] never states the flat-face count',
      find:"          : '它有 <span class=\"bigans\">' + s.flat + ' 個</span>平平的面 —— 可以整片放在桌上。';",
      replace:"          : '它有好幾個平平的面 —— 可以整片放在桌上。';" },
    { file:'index', expect:'r3 zh[2] never states the curved-face count',
      find:"          : '它還有 ' + s.curved + ' 個<strong>彎彎的面</strong>，彎彎的面不算平平的面。';",
      replace:"          : '它還有一些<strong>彎彎的面</strong>，彎彎的面不算平平的面。';" },
    { file:'index', expect:'k1 zh[0] must say it stays put',
      find:"          ? '<strong>下面平不平？</strong>有平平的面碰到桌子，所以<span class=\"yes\">放得穩</span>。'",
      replace:"          ? '<strong>下面平不平？</strong>有平平的面碰到桌子，所以一放就滾走。'" },
    { file:'index', expect:'k2 zh[3] must say it cannot be stacked on',
      find:"          : '<strong>上面平不平？</strong>放穩以後上面不是平平的，<span class=\"no\">沒有可以穩穩疊東西的平面</span>。';",
      replace:"          : '<strong>上面平不平？</strong>放穩以後上面也是平平的，還可以再疊一個。';" },
    { file:'index', expect:'k3 zh[0] must say it does not roll smoothly',
      find:"          : '它沒有彎彎的面 —— 用力推會翻過邊倒下去，但是滾不順。';",
      replace:"          : '它沒有彎彎的面 —— 讓彎彎的面碰到桌子，順著彎的方向一推，它就會滾。';" },
    { file:'index', expect:'vertCell zh[4] must name the apex',
      find:"      vertCell:function(i){ return SOLIDS[i].tip ? '1（尖尖的那一點）' : String(SOLIDS[i].vert); },",
      replace:"      vertCell:function(i){ return String(SOLIDS[i].vert); }," },
    { file:'index', expect:'rollCell zh[0] must say it does not roll',
      find:"        if (!s.rolls) return this.noW;\n        return s.stable ? '躺下來會' : this.yesW;",
      replace:"        if (!s.rolls) return this.yesW;\n        return s.stable ? '躺下來會' : this.yesW;" },
    /* 畫布寬度：五個立體形體、六格數數畫面，每一格都要驗。 */
    { file:'index', expect:'draws out to x=',
      find:'  function solidSVG(id, icon){\n    var w = 140, h = 126, tableY = 114;',
      replace:'  function solidSVG(id, icon){\n    var w = 90, h = 126, tableY = 114;' },
    { file:'index', expect:'draws out to x=',
      find:'    var w = far + 42, h = g.y0 + g.H + 42;',
      replace:'    var w = far + 2, h = g.y0 + g.H + 42;' },
    /* 只驗正方體的話，長方體被切掉不會有人發現：這一筆只讓長方體那一格畫出去。 */
    { file:'index', expect:'draws out to x=',
      find:"        { at:[far + 26, cBack[1]], to:cBack, hidden:true },",
      replace:"        { at:[far + (id === 'cube' ? 26 : 60), cBack[1]], to:cBack, hidden:true }," },
    /* 標記的數量要等於真值表，data-n 也要 —— 兩個都比，少一個就抓不到。 */
    { file:'index', expect:'data-n says',
      find:"    var n = (part === 'flat') ? 6 : (part === 'edge' ? 12 : 8);",
      replace:"    var n = (part === 'flat') ? 5 : (part === 'edge' ? 12 : 8);" },
    { file:'index', expect:'markers but the truth table says',
      find:'        [g.A, g.A2, 1], [g.B, g.B2, 0], [g.C, g.C2, 0], [g.D, g.D2, 0]',
      replace:'        [g.A, g.A2, 1], [g.B, g.B2, 0], [g.C, g.C2, 0]' },
    /* 看不見的那幾個標記要畫成虛線，孩子才知道「背面也要數」。 */
    { file:'index', expect:'hidden markers',
      find:'        { at:[far + 26, cBack[1]], to:cBack, hidden:true },',
      replace:'        { at:[far + 26, cBack[1]], to:cBack, hidden:false },' },
    /* --- index.html：遊戲關卡 --- */
    { file:'index', expect:"the page's own clueMatches picks",
      find:"    { flat:6, sameFaces:true,  extra:'same',      opts:['cube','cuboid','cyl'],  ans:0 },",
      replace:"    { flat:6, sameFaces:null,  extra:'same',      opts:['cube','cuboid','cyl'],  ans:0 }," },
    { file:'index', expect:'opts[ans] is not the solid the clue describes',
      find:"    { flat:0, sameFaces:null,  extra:'roll',      opts:['cyl','ball','cube'],    ans:1 },",
      replace:"    { flat:0, sameFaces:null,  extra:'roll',      opts:['cyl','ball','cube'],    ans:0 }," },
    { file:'index', expect:'exactly one solid must match the clue',
      find:"    { flat:2, sameFaces:null,  extra:'rollstack', opts:['ball','cone','cyl'],    ans:2 },",
      replace:"    { flat:2, sameFaces:null,  extra:'point',    opts:['ball','cone','cyl'],    ans:2 }," },
    { file:'index', expect:'the extra clue does not match the solid it points at',
      find:"    { flat:6, sameFaces:false, extra:'notsame',   opts:['cube','cuboid','cyl'],  ans:1 }",
      replace:"    { flat:6, sameFaces:true,  extra:'notsame',   opts:['cube','cuboid','cyl'],  ans:1 }" },
    { file:'index', expect:'duplicate options',
      find:"    { flat:1, sameFaces:null,  extra:'point',     opts:['cone','ball','cuboid'], ans:0 },",
      replace:"    { flat:1, sameFaces:null,  extra:'point',     opts:['cone','cone','cuboid'], ans:0 }," },
    { file:'index', expect:'every game round has the answer first',
      find:"    { flat:6, sameFaces:true,  extra:'same',      opts:['cube','cuboid','cyl'],  ans:0 },\n    { flat:0, sameFaces:null,  extra:'roll',      opts:['cyl','ball','cube'],    ans:1 },\n    { flat:2, sameFaces:null,  extra:'rollstack', opts:['ball','cone','cyl'],    ans:2 },\n    { flat:1, sameFaces:null,  extra:'point',     opts:['cone','ball','cuboid'], ans:0 },\n    { flat:6, sameFaces:false, extra:'notsame',   opts:['cube','cuboid','cyl'],  ans:1 }",
      replace:"    { flat:6, sameFaces:true,  extra:'same',      opts:['cube','cuboid','cyl'],  ans:0 },\n    { flat:0, sameFaces:null,  extra:'roll',      opts:['ball','cyl','cube'],    ans:0 },\n    { flat:2, sameFaces:null,  extra:'rollstack', opts:['cyl','ball','cone'],    ans:0 },\n    { flat:1, sameFaces:null,  extra:'point',     opts:['cone','ball','cuboid'], ans:0 },\n    { flat:6, sameFaces:false, extra:'notsame',   opts:['cuboid','cube','cyl'],  ans:0 }" },
    { file:'index', expect:'one of anything takes the singular',
      find:"      flatWord:function(n){ return n + ' flat face' + (n === 1 ? '' : 's'); },",
      replace:"      flatWord:function(n){ return n + ' flat faces'; }," },
    { file:'index', expect:'gAsk never prints the flat-face count',
      find:"        var head = (r.flat === 0) ? '我一個平平的面都沒有' : ('我有 ' + this.flatWord(r.flat));",
      replace:"        var head = (r.flat === 0) ? '我一個平平的面都沒有' : '我有好幾個平平的面';" },
    { file:'index', expect:'gHint2 never names the everyday object',
      find:"        return '再想一想：' + head + '的，生活裡就像' + this.solids[i].real + '。';",
      replace:"        return '再想一想：' + head + '的，生活裡到處都是。';" },
    /* 屬性順序不一樣的 <rect> 也要量得到 —— 少了這一條，一個畫出去的矩形會被靜靜跳過。 */
    { file:'index', expect:'draws out to x=',
      find:"      s += '<rect x=\"40\" y=\"48\" width=\"60\" height=\"56\" fill=\"' + fill + '\" stroke=\"none\"/>';",
      replace:"      s += '<rect width=\"300\" y=\"48\" x=\"40\" height=\"56\" fill=\"' + fill + '\" stroke=\"none\"/>';" },
    /* 認不得的 id：長度、不重複、答案、線索四條檢查全都會過，畫面上卻印出 undefined。 */
    { file:'index', expect:'is not a solid the checker knows',
      find:"    { flat:2, sameFaces:null,  extra:'rollstack', opts:['ball','cone','cyl'],    ans:2 },",
      replace:"    { flat:2, sameFaces:null,  extra:'rollstack', opts:['ball','cone','cyllinder'],    ans:2 }," },
    /* 「碰到桌子就會滾」把「滾得動」說成「一放就自己滾」。 */
    { file:'index', expect:'must say it takes a push',
      find:"          ? '它有彎彎的面 —— 讓彎彎的面碰到桌子，順著彎的方向一推，它就會滾。'",
      replace:"          ? '它有彎彎的面 —— 讓彎彎的面碰到桌子，它就會滾。'" },

    /* --- 第二輪 codex 審查（主控端集中跑）新增的斷言，各配一筆改壞版本 --- */
    /* COUNT_SOLIDS 只 forEach 不比清單：刪掉長方體會少驗三張圖，檢查卻是綠的。 */
    { file:'index', expect:'expected exactly cube,cuboid',
      find:"  var COUNT_SOLIDS = ['cube','cuboid'];",
      replace:"  var COUNT_SOLIDS = ['cube'];" },
    /* 只驗右緣的話，height=\"1\" 的畫布照樣過關。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var w = far + 42, h = g.y0 + g.H + 42;',
      replace:'    var w = far + 42, h = 40;' },
    /* 左緣被切掉一樣看不到東西。 */
    { file:'index', expect:'clipped by the left edge',
      find:'        { at:[g.x0 - 26, cLeft[1]], to:cLeft, hidden:true },',
      replace:'        { at:[g.x0 - 80, cLeft[1]], to:cLeft, hidden:true },' },
    /* viewBox 和畫布對不上，畫面會整個縮放位移。 */
    { file:'index', expect:'does not match the canvas',
      find:"            '" + '" width="' + "' + w + '" + '" height="' + "' + h + '" + '" viewBox="0 0 ' + "' + w + ' ' + h +\n            '\" style=\"max-width:100%;height:auto\" xmlns=\"http://www.w3.org/2000/svg\">';",
      replace:"            '" + '" width="' + "' + w + '" + '" height="' + "' + h + '" + '" viewBox="0 0 10 10' + "' +\n            '\" style=\"max-width:100%;height:auto\" xmlns=\"http://www.w3.org/2000/svg\">';" },
    /* 屬性邊界：data-cx 不可以被當成 cx。 */
    { file:'index', expect:'draws out to x=',
      find:"      s += '<circle data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +\n           '\" cx=\"' + m.at[0] + '\" cy=\"' + m.at[1] + '\" r=\"10\" fill=\"' +",
      replace:"      s += '<circle data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +\n           '\" data-cx=\"0\" cx=\"' + (m.at[0] + 400) + '\" cy=\"' + m.at[1] + '\" r=\"10\" fill=\"' +" },
    /* 讀不出來的幾何一律判失敗，不可以默默跳過。 */
    { file:'index', expect:'is missing a readable',
      find:"'\" cx=\"' + m.at[0] + '\" cy=\"' + m.at[1] + '\" r=\"10\" fill=\"' +",
      replace:"'\" cx=\"' + m.at[0] + '\" cy=\"' + m.at[1] + '\" fill=\"' +" },
    /* 標成看不到的標記，畫面上也要真的是虛線。 */
    { file:'index', expect:'drawn as a solid ring',
      find:"           (m.hidden ? ' stroke-dasharray=\"5 3\"' : '') + '/>';",
      replace:"           '' + '/>';" },
    /* gWhy 只講「有 6 個平平的面」分不出正方體和長方體。 */
    { file:'index', expect:'never states the decisive clue',
      find:"        return this.solids[i].name + head + this.gClueWhy[r.extra] + '，就像' + this.solids[i].real + '。';",
      replace:"        return this.solids[i].name + head + '，就像' + this.solids[i].real + '。';" },
    /* 題庫的解釋要給對理由。 */
    { file:'index', expect:'never gives the reason',
      find:"          why:'上面、下面、前面、後面、左邊、右邊，一共 6 個平平的面。' },",
      replace:"          why:'骰子就是這樣。' }," },
    { file:'index', expect:'does not decide this question',
      find:"          why:'上面四個角、下面四個角，一共 8 個頂點。' },",
      replace:"          why:'上面四個角、下面四個角，一共 8 個頂點，因為它會滾。' }," },

    /* --- index.html：三層題庫的神諭 --- */
    { file:'index', expect:'never appears in the stem',
      find:"        { stem:'🥫 3 個罐頭分開放。<br>一共有幾個<strong>平平的面</strong>？',",
      replace:"        { stem:'🥫 4 個罐頭分開放。<br>一共有幾個<strong>平平的面</strong>？'," },
    { file:'index', expect:'unexpected number',
      find:"        { stem:'🎲 骰子是正方體。<br>它有幾個<strong>平平的面</strong>？',",
      replace:"        { stem:'🎲 骰子是正方體（旁邊還有 7 顆彈珠）。<br>它有幾個<strong>平平的面</strong>？'," },
    { file:'index', expect:'the checker expects',
      find:"          opts:['1 個','2 個','3 個','6 個'], ans:1,",
      replace:"          opts:['1 個','2 個','3 個','6 個'], ans:2," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['0 個','2 個','1 個','3 個'], ans:2,",
      replace:"          opts:['0 個','2 個','1 個','3 個'], ans:9," },
    { file:'index', expect:'is not one of the options the checker recorded',
      find:"          opts:['4 個','6 個','8 個','12 個'], ans:1,",
      replace:"          opts:['4 個','6 個','banana','12 個'], ans:1," },
    { file:'index', expect:'questions but',
      find:"        { stem:'🎄 A cone-shaped Christmas tree is a cone.<br>How many <strong>flat faces</strong> does it have?',\n          opts:['0','2','1','3'], ans:2,\n          why:'The circle underneath is a flat face and sits right on the table; the curved part around it rises to the sharp point on top.' }\n      ],",
      replace:"      ]," },

    /* --- 第二輪 codex 審查（審第一輪的修正）新增的斷言 --- */
    /* 題幹在問什麼，沒有人驗：主詞從「平平的面」換成「直直的邊」，正解卻沒跟著換。
       via:'index' 表示改壞 review.html，但要跑 verify_lesson_data。 */
    { file:'review', via:'index', expect:'the stem never asks about "平平的面"',
      find:"                 ? (s.icon + ' ' + s.zh.real + '是' + s.zh.name + '。<br>它有幾個<strong>平平的面</strong>？')",
      replace:"                 ? (s.icon + ' ' + s.zh.real + '是' + s.zh.name + '。<br>它有幾條<strong>直直的邊</strong>？')" },
    { file:'review', via:'index', expect:'the stem never asks about "flat faces"',
      find:"                 : (s.icon + ' ' + cap(s.en.real) + ' is a ' + s.en.name +\n                    '.<br>How many <strong>flat faces</strong> does it have?')) + d.svg,",
      replace:"                 : (s.icon + ' ' + cap(s.en.real) + ' is a ' + s.en.name +\n                    '.<br>How many <strong>straight edges</strong> does it have?')) + d.svg," },
    /* 固定題庫的主詞同樣要記下來比對。 */
    { file:'index', expect:'the stem never asks about "平平的面"',
      find:"        { stem:'🎲 骰子是正方體。<br>它有幾個<strong>平平的面</strong>？',",
      replace:"        { stem:'🎲 骰子是正方體。<br>它有幾條<strong>直直的邊</strong>？'," },
    { file:'index', expect:'which is a different quantity',
      find:"        { stem:'🎲 正方體有幾個<strong>頂點</strong>（尖尖的角）？',",
      replace:"        { stem:'🎲 正方體有幾個<strong>頂點</strong>？它有幾個平平的面？'," },
    /* 中間那幾格畫面：只在點亮第一個標記時把它畫出畫布，頭尾兩格都還是綠的。 */
    { file:'index', expect:'1 lit) is',
      find:"      var on = !!lit[i];",
      replace:"      var on = !!lit[i];\n      if (on && i === 0 && Object.keys(lit).length === 1) m.at = [m.at[0] + 400, m.at[1]];" },
    /* 行內 style 可以改掉幾何，屬性量法看不到 —— 要 fail-closed。 */
    { file:'index', expect:'carries an inline style',
      find:"      s += '<circle data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +\n           '\" cx=\"' + m.at[0] + '\" cy=\"' + m.at[1] + '\" r=\"10\" fill=\"' +\n           (on ? '#2F9E69' : '#FFFFFF')",
      replace:"      s += '<circle style=\"stroke-width:40\" data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +\n           '\" cx=\"' + m.at[0] + '\" cy=\"' + m.at[1] + '\" r=\"10\" fill=\"' +\n           (on ? '#2F9E69' : '#FFFFFF')" },
    /* 不認得的 class 也可能改掉幾何。 */
    { file:'index', expect:'which page CSS could restyle',
      find:"    s += '<polygon points=\"' + pts([g.A, g.B, g.C, g.D]) + '\" fill=\"#FDF0E0\" stroke=\"' + edge + '\" stroke-width=\"3\"/>';",
      replace:"    s += '<polygon class=\"huge\" points=\"' + pts([g.A, g.B, g.C, g.D]) + '\" fill=\"#FDF0E0\" stroke=\"' + edge + '\" stroke-width=\"3\"/>';" },
    /* 冠詞接數字：a 8 corners 通得過單複數檢查。 */
    { file:'index', expect:'immediately before a number — drop the article',
      find:"          why:'Four corners on the top and four on the bottom — 8 corners in all.' },",
      replace:"          why:'Four corners on the top and four on the bottom — a 8 corners in all.' }," },
    /* 盒子被用力推是會翻過邊的，不可以說成「怎麼推都不會滾」。 */
    { file:'index', expect:'makes the absolute claim',
      find:"          : '它沒有彎彎的面 —— 用力推會翻過邊倒下去，但是滾不順。';",
      replace:"          : '它沒有彎彎的面 —— 怎麼放都不會滾，只會滑。';" },
    /* 圓錐的頂點必須是 1（尖端）。頁面改掉就會被真值表擋下來。
       （`s.tip && s.vert !== 1` 那一條是真值表自己的一致性檢查，住在設定檔裡，
       breaktest 只能改課程檔案，所以和 calc 那一條一樣沒有頁面側的改壞版本。） */
    { file:'index', expect:'SOLIDS[4].vert is 2, the checker expects 1',
      find:"    { id:'cone',   icon:'🎄', flat:1, curved:1, edge:0,  vert:1,",
      replace:"    { id:'cone',   icon:'🎄', flat:1, curved:1, edge:0,  vert:2," },

    /* --- 第三輪 codery 審查新增／改動的斷言 --- */
    /* 選項範圍要用這一課自己的最大值：平平的面最多 6。 */
    { file:'review', expect:'outside 0~6',
      find:"        var pool = shuffle(FLAT_POOL);",
      replace:"        var pool = shuffle(FLAT_POOL.concat([12]));" },
    /* 頂點最多 8。 */
    { file:'review', expect:'outside 0~8',
      find:"        var pool = shuffle(VERT_POOL);",
      replace:"        var pool = shuffle(VERT_POOL.concat([12]));" },
    /* class 不再放行：頁面 CSS 可以蓋掉屬性上的線寬。 */
    { file:'index', expect:'which page CSS could restyle',
      find:"      s += '<circle data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +",
      replace:"      s += '<circle class=\"mk\" data-k=\"' + i + '\" data-hidden=\"' + (m.hidden ? 'true' : 'false') +" },
    /* <text> 也要走 fail-closed，而且字級必須寫出來。 */
    /* 這一課的 SVG 完全沒有 <text>，所以改壞的方式是「加一個沒有寫字級的 <text>」——
       證明文字那條路徑真的會 fail-closed，不是永遠不會響的死碼。 */
    { file:'index', expect:'declares no font-size',
      find:"    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */",
      replace:"    s += '<text x=\"10\" y=\"20\">x</text>';\n    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */" },
    /* 解釋不可以否定它自己被要求給出的理由。 */
    { file:'index', expect:'negates its own required reason',
      find:"          why:'球整個都是彎彎的面，一個平平的面都沒有，站不穩，順著任何方向一推就滾走了。' },",
      replace:"          why:'球沒有整個都是彎彎的面，一個平平的面都沒有，站不穩，順著任何方向一推就滾走了。' }," },
    /* 題庫的陣列破洞：長度沒變，forEach 會跳過。 */
    { file:'index', expect:'the slot is missing',
      find:"        { stem:'⚽ 皮球是球。<br>它有幾個<strong>平平的面</strong>？',\n          opts:['0 個','1 個','2 個','6 個'], ans:0,",
      replace:"        ,\n        { stem:'⚽ 皮球是球。<br>它有幾個<strong>平平的面</strong>？',\n          opts:['0 個','1 個','2 個','6 個'], ans:0," },
    /* 遊戲關卡的陣列破洞。 */
    { file:'index', expect:'ROUND 2: the slot is missing',
      find:"    { flat:0, sameFaces:null,  extra:'roll',      opts:['cyl','ball','cube'],    ans:1 },",
      replace:"    ,{ flat:0, sameFaces:null,  extra:'roll',      opts:['cyl','ball','cube'],    ans:1 }," },
    /* 題幹主詞的抽樣要跑滿宣告的參數域 —— 少一個值就代表那個值沒被驗到。 */
    { file:'review', via:'index', expect:'the checker expects exactly',
      find:"        var si = Number(pickUnused([0,1,2,3,4], used));\n        var s = SOLIDS[si];\n        var correct = N(s.flat, 'flat');",
      replace:"        var si = Number(pickUnused([0,1,2], used));\n        var s = SOLIDS[si];\n        var correct = N(s.flat, 'flat');" },
    /* 量詞跟著東西走：聖誕樹是「棵」。 */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"    return lang === 'zh' ? (n + ' ' + s.zh.cl + s.zh.real)",
      replace:"    return lang === 'zh' ? (n + s.zh.cl + s.zh.real)" },

    /* --- 速查卡與家長頁：verify_lesson_data 從課程資料夾把這兩頁載進來驗，
       所以它們也改得壞、也證得出來（breaktest 現在會把四頁都複製到暫存資料夾）。
       find 字串要錨在 JSON 結尾的 `。",` 上：每一段內文在檔案裡有兩份 ——
       markup 的 fallback 一份、字典一份 —— 而畫面上看到的是字典那一份。 --- */
    { file:'reference', expect:'c3c (flat faces) is',
      find:"      c3a:'🥫 圓柱', c3b:'罐頭', c3c:'2',",
      replace:"      c3a:'🥫 圓柱', c3b:'罐頭', c3c:'3'," },
    { file:'reference', expect:'which is grade-5 material',
      find:"sw3:'彎彎的面碰桌子 → 順著彎的方向一推就滾得順', sw4:'看不到的那一面也要數進去',",
      replace:"sw3:'彎彎的面碰桌子 → 順著彎的方向一推就滾得順', sw4:'展開圖是五年級才學的'," },
    { file:'reference', expect:'draws out to x=',
      find:'    var w = x0 + W + dx + 18, h = y0 + H + 18;',
      replace:'    var w = 40, h = y0 + H + 18;' },
    { file:'parents', expect:'never mentions "頂點"',
      find:'「頂點」一律指尖尖的<strong>一個點</strong> —— 盒子是邊碰邊的角（8 個），圓錐上面尖尖的那一點就是它唯一的頂點（1 個），圓柱上下是一整圈、不是點，所以 0 個。<strong>陪讀時請跟著這套說法</strong>；如果學校老師的算法不一樣，那不是孩子錯了，是兩本課本的數法不同 —— 告訴孩子「要看題目問的是哪一種面」就好。",',
      replace:'尖尖的地方要不要算，看老師怎麼說。<strong>陪讀時請跟著這套說法</strong>；如果學校老師的算法不一樣，那不是孩子錯了，是兩本課本的數法不同 —— 告訴孩子「要看題目問的是哪一種面」就好。",' },
    { file:'parents', expect:'it must always be',
      find:'再數平平的面、直直的邊和頂點，最後用「會不會滾、疊不疊得高」把它們分出來。<strong>展開圖、柱體錐體的分類、表面積和體積都是五年級的內容</strong>，這一課完全不碰。",',
      replace:'再數面、數邊、數頂點，最後用「會不會滾、疊不疊得高」把它們分出來。<strong>展開圖、柱體錐體的分類、表面積和體積都是五年級的內容</strong>，這一課完全不碰。",' }
    /* 神諭自己算錯（calc 和 zh/en 對不上）這一條沒有對應的改壞版本：
       神諭住在這個設定檔裡，breaktest 只能改課程檔案，從頁面那一側碰不到它。
       它擋的是「作者把 6 個寫成 7 個、而頁面也跟著寫錯」這種兩邊一起錯的情況。 */
  ],

  sim: {
    /* 這一課的選項是「6 個」「🎲 正方體」這種帶單位／帶圖示的字串，
       simgen 的通用「誘答抄題幹」檢查（比整個選項字串和題幹的數字）永遠比不到，
       所以由每個產生器自己的不變條件用數值比一次（noStemEcho），這裡不需要白名單。 */
    stemEchoOk: {},

    INVARIANTS: {
      /* 有幾個平平的面：正解一定等於真值表的 flat。 */
      flatFaces: d => siOk(d.si) ||
        canvasProblem('flatFaces solidSVG(' + d.si + ')', d.svg || '') ||
        base(d, 'n#flat#' + T[d.si].flat),
      /* 有幾條直直的邊：彎彎的邊不算，所以圓柱／圓錐／球都是 0。 */
      straightEdges: d => siOk(d.si) ||
        canvasProblem('straightEdges solidSVG(' + d.si + ')', d.svg || '') ||
        base(d, 'n#edge#' + T[d.si].edge),
      /* 有幾個頂點：圓錐的頂點是 1（上面那個尖端）。表格會教，但不出成題目 ——
         各家課本對圓錐頂點的算法不一致，教得出來、不拿它評分。 */
      corners: d => siOk(d.si) ||
        (T[d.si].tip ? 'a cone must never be asked about corners — curricula count its apex differently' : null) ||
        canvasProblem('corners solidSVG(' + d.si + ')', d.svg || '') ||
        base(d, 'n#vert#' + T[d.si].vert),
      /* n 個一樣的東西：總數 ＝ n × 平平的面。 */
      countTotalFlat: d => siOk(d.si) ||
        (!(Number.isInteger(d.n) && d.n >= 2 && d.n <= 4) ? 'n must be 2~4, got ' + d.n : null) ||
        (d.total !== d.n * T[d.si].flat
          ? 'total is not n × flat (' + d.total + ' vs ' + d.n + ' × ' + T[d.si].flat + ')' : null) ||
        noStemEcho(d, [d.n]) ||
        base(d, 'n#flat#' + (d.n * T[d.si].flat)),
      /* 兩種東西混在一起：兩邊各自算對，再加起來。 */
      mixedTotalFlat: d => siOk(d.a, 'solid a') || siOk(d.b, 'solid b') ||
        (d.a === d.b ? 'the two kinds must differ, got the same one twice' : null) ||
        (!(Number.isInteger(d.na) && d.na >= 1 && d.na <= 3) ? 'na must be 1~3, got ' + d.na : null) ||
        (!(Number.isInteger(d.nb) && d.nb >= 1 && d.nb <= 3) ? 'nb must be 1~3, got ' + d.nb : null) ||
        (d.na === 1 && d.nb === 1 ? 'at least one side must need multiplying' : null) ||
        (d.pa !== d.na * T[d.a].flat
          ? 'pa is not na × flat (' + d.pa + ' vs ' + d.na + ' × ' + T[d.a].flat + ')' : null) ||
        (d.pb !== d.nb * T[d.b].flat
          ? 'pb is not nb × flat (' + d.pb + ' vs ' + d.nb + ' × ' + T[d.b].flat + ')' : null) ||
        (d.total !== d.pa + d.pb
          ? 'total is not the two parts added (' + d.total + ' vs ' + d.pa + ' + ' + d.pb + ')' : null) ||
        noStemEcho(d, [d.na, d.nb]) ||
        base(d, 'n#flat#' + (d.na * T[d.a].flat + d.nb * T[d.b].flat)),
      /* 哪一個不會滾：正解沒有彎彎的面，三個誘答都要會滾。 */
      whichNoRoll: d => siOk(d.si) || distinctOpts(d) ||
        (T[d.si].rolls ? 'the answer must be a solid that does not roll' : null) ||
        (function(){
          const still = d.opts.filter(o => o && o.u === 'so' && T[o.si] && !T[o.si].rolls);
          if (still.length !== 1) return 'exactly one option must not roll, found ' + still.length;
          return null;
        })() ||
        base(d, 'so#' + d.si),
      /* 哪一個疊不住：正解上面不是平的，三個誘答都要疊得住。 */
      whichNoStack: d => siOk(d.si) || distinctOpts(d) ||
        (T[d.si].stackTop ? 'the answer must be a solid nothing stays on' : null) ||
        (function(){
          const bad = d.opts.filter(o => o && o.u === 'so' && T[o.si] && !T[o.si].stackTop);
          if (bad.length !== 1) return 'exactly one option must be the unstackable one, found ' + bad.length;
          return null;
        })() ||
        base(d, 'so#' + d.si),
      /* 生活實物 → 立體形體 */
      realToSolid: d => siOk(d.si) ||
        canvasProblem('realToSolid solidSVG(' + d.si + ')', d.svg || '') ||
        base(d, 'so#' + d.si),
      /* 平平的面是什麼形狀：長方體不出這一題（它的面不一定都是長方形）。 */
      faceShape: d => siOk(d.si) || distinctOpts(d) ||
        (T[d.si].id === 'cuboid' ? 'a cuboid face is not always a rectangle, so it cannot be asked here' : null) ||
        (!T[d.si].faceShape ? 'this solid has no flat face to ask about' : null) ||
        (d.correct && d.correct.u !== 'sh' ? 'the answer must be the flat shape, not a solid' : null) ||
        canvasProblem('faceShape solidSVG(' + d.si + ')', d.svg || '') ||
        (function(){
          const right = d.opts.filter(o => o && o.u === 'sh' && o.id === T[d.si].faceShape);
          if (right.length !== 1) return 'exactly one option must be the right flat shape, found ' + right.length;
          return null;
        })() ||
        base(d, 'sh#' + T[d.si].faceShape),
      /* 平面圖形 vs 立體形體：四句話要是四種不同的說法，只有一種是對的。 */
      planeVsSolid: d => siOk(d.si) || distinctOpts(d) ||
        (!SHAPE_TRUTH[d.plane] ? 'unknown flat shape ' + d.plane : null) ||
        (function(){
          const kinds = d.opts.map(o => (o && o.u === 'pv') ? o.kind : 'bad');
          if (kinds.indexOf('bad') >= 0) return 'every option must be a sentence about flat vs solid';
          if (kinds.filter(k => k === 'right').length !== 1) return 'exactly one sentence may be true';
          const wrongSolid = d.opts.filter(o => o.si !== d.si || o.plane !== d.plane);
          if (wrongSolid.length) return 'every sentence must talk about the same pair';
          return null;
        })() ||
        base(d, 'pv#right'),
      /* 猜猜我是誰：線索（平平的面幾個 ＋ 多講的那一句）必須剛好符合五個裡的一個，
         而且四個選項裡也只有一個符合。 */
      identifyByClue: d => siOk(d.si) || distinctOpts(d) ||
        (!EXTRA_PRED[d.extra] ? 'unknown clue tag ' + d.extra : null) ||
        (!EXTRA_PRED[d.extra](T[d.si]) ? 'the extra clue does not match this solid (' + d.extra + ')' : null) ||
        (function(){
          const all = clueTargets(T[d.si].flat, d.extra);
          if (all.length !== 1) return 'exactly one solid must match the clue, found ' + all.length;
          if (all[0].id !== T[d.si].id) return 'the clue points at ' + all[0].id + ', not ' + T[d.si].id;
          const hit = d.opts.filter(o => o && o.u === 'so' && T[o.si] &&
            T[o.si].flat === T[d.si].flat && EXTRA_PRED[d.extra](T[o.si]));
          if (hit.length !== 1) return 'exactly one option matches the clue, found ' + hit.length;
          return null;
        })() ||
        base(d, 'so#' + d.si)
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的真值表重算，
       完全不呼叫 review.html 的 valStr／nStr —— 拿產生器自己的格式化函式來比
       等於自己比自己。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'flatFaces':      return fmtN(T[d.si].flat, 'flat', lang);
        case 'straightEdges':  return fmtN(T[d.si].edge, 'edge', lang);
        case 'corners':        return fmtN(T[d.si].vert, 'vert', lang);
        case 'countTotalFlat': return fmtN(d.n * T[d.si].flat, 'flat', lang);
        case 'mixedTotalFlat': return fmtN(d.na * T[d.a].flat + d.nb * T[d.b].flat, 'flat', lang);
        case 'whichNoRoll':
        case 'whichNoStack':
        case 'realToSolid':
        case 'identifyByClue': return fmtSo(d.si, lang);
        case 'faceShape':      return SHAPE_TRUTH[T[d.si].faceShape][lang];
        case 'planeVsSolid':   return pvRight(d.plane, d.si, lang);
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀（單位種類）要是這個產生器允許的，數字要落在範圍裡，
       英文還要單複數一致。正解與誘答用同一組規則 —— 這一課沒有刻意寫錯的選項。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE_OF[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      /* 數字型的選項才驗範圍；名稱型的選項（🎲 正方體、圓形、句子）本來就沒有數字。 */
      if (hit[0].charAt(0) !== 'n') return null;
      if (lang === 'en'){
        const m = t.match(/^(\d+) ([a-z]+)$/);
        if (!m) return 'bad option shape for ' + genId + ': ' + t;
        const n = Number(m[1]), w = m[2];
        const want = EN_UNIT[hit[0].slice(1)][n === 1 ? 0 : 1];
        if (w !== want) return 'plural does not match the number: ' + t + ' (expected ' + n + ' ' + want + ')';
      }
      const bounds = RANGE[genId];
      if (!bounds) return 'no number range recorded for ' + genId;
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
    dataReturn: '{SOLIDS, COUNT_SOLIDS, PARTS, ROUNDS, solidById, clueMatches, solidSVG, partsSVG, partsGeom}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];

      /* --- 1. 真值表：課程檔案的 SOLIDS 要和這個設定檔的 T 逐欄位一字不差 --- */
      if (data.SOLIDS.length !== T.length){
        fail(`SOLIDS has ${data.SOLIDS.length} solids; this lesson uses ${T.length}`);
        return;
      }
      const NUMK = ['flat','curved','edge','vert'];
      const BOOLK = ['sameFaces','stable','rolls','stackTop','tip'];
      data.SOLIDS.forEach((s, i) => {
        if (s.id !== T[i].id) fail(`SOLIDS[${i}].id is "${s.id}", the checker expects "${T[i].id}"`);
        if (s.icon !== T[i].icon) fail(`SOLIDS[${i}].icon is "${s.icon}", the checker expects "${T[i].icon}"`);
        NUMK.forEach(k => {
          if (!Number.isInteger(s[k])) fail(`SOLIDS[${i}].${k} must be a whole number, got ${s[k]}`);
          else if (s[k] !== T[i][k]) fail(`SOLIDS[${i}].${k} is ${s[k]}, the checker expects ${T[i][k]}`);
        });
        BOOLK.forEach(k => {
          if (typeof s[k] !== 'boolean') fail(`SOLIDS[${i}].${k} must be true/false, got ${s[k]}`);
          else if (s[k] !== T[i][k]) fail(`SOLIDS[${i}].${k} is ${s[k]}, the checker expects ${T[i][k]}`);
        });
      });
      /* 這一課教的規則本身要成立，不只是「和真值表一致」：
         有平平的面才站得穩、有彎彎的面才滾得動、上面平平的才疊得上去。 */
      T.forEach(s => {
        if (s.stable !== (s.flat > 0)) fail(`${s.id}: "stands still" must mean it has at least one flat face`);
        if (s.rolls !== (s.curved > 0)) fail(`${s.id}: "rolls" must mean it has at least one curved face`);
        if (s.stackTop && !s.stable) fail(`${s.id}: nothing can be stacked on something that cannot stand still`);
        if (s.vert > 0 && s.edge === 0 && !s.tip){
          fail(`${s.id}: a corner needs either straight edges meeting or an apex (tip)`);
        }
        if (s.tip && s.vert !== 1) fail(`${s.id}: an apex solid has exactly one vertex, got ${s.vert}`);
      });

      /* --- 2. 字典裡的名字與生活實物 --- */
      LANGS.forEach(L => {
        const sc = I18N[L].solids;
        if (!Array.isArray(sc) || sc.length !== T.length){
          fail(`${L} solids: ${(sc || []).length} entries but the checker expects ${T.length}`);
          return;
        }
        sc.forEach((s, i) => {
          ['name','real'].forEach(k => {
            if (!s[k]) fail(`${L} solids[${i}] is missing ${k}`);
            else if (s[k] !== T[i][L][k]) fail(`${L} solids[${i}].${k} is "${s[k]}", the checker expects "${T[i][L][k]}"`);
          });
        });
        /* 五個名字彼此不同，不然選項會出現兩個一樣的字串。 */
        const names = sc.map(s => s.name);
        if (new Set(names).size !== names.length) fail(`${L} solids: two solids share a name`);
      });

      /* --- 3. 範例 1：認識五個立體形體 --- */
      LANGS.forEach(L => {
        const d = I18N[L];
        T.forEach((s, i) => {
          const a = d.r1(i), b = d.r2(i), c = d.r3(i);
          [d.r0, a, b, c].forEach(x => { if (/undefined|NaN/.test(x)) fail(`r ${L}[${i}]: ${x}`); });
          if (a.indexOf(T[i][L].name) < 0) fail(`r1 ${L}[${i}] never names the solid`);
          if (a.indexOf(T[i][L].real) < 0) fail(`r1 ${L}[${i}] never names the everyday object`);
          if (L === 'en'){
            [['r1', a], ['r2', b], ['r3', c]].forEach(([k, x]) => {
              const bad = enPluralProblem(`${k} en[${i}]`, x);
              if (bad) fail(bad);
            });
          }
          if (s.flat > 0){
            if (b.indexOf(String(s.flat)) < 0) fail(`r2 ${L}[${i}] never states the flat-face count ${s.flat}`);
          } else if (/\d/.test(b)){
            fail(`r2 ${L}[${i}] should say "none at all", not print a number`);
          }
          if (s.curved > 0){
            if (c.indexOf(String(s.curved)) < 0) fail(`r3 ${L}[${i}] never states the curved-face count ${s.curved}`);
          } else if (/\d/.test(c)){
            fail(`r3 ${L}[${i}] should say it has no curved face, not print a number`);
          }
        });
      });

      /* --- 4. 範例 3：會滾／疊得高的規則。方向要驗兩邊 ——
         只驗「有沒有出現『會滾』」的話，「不會滾」也含有「會滾」，整條會靜靜失效。 --- */
      const SAY = {
        /* push 這一條擋的是「一放就自己滾」：會滾的句子一定要說出「往哪個方向推」，
           因為圓柱沿著軸推是用滑的，不是滾的 —— 方向講清楚，規則才成立。 */
        /* noroll 現在要說「翻得過邊、但滾不順」：盒子被用力推是會翻倒的，
           說成「怎麼推都不會動」是假的（codex 第二輪抓到）。 */
        zh:{ stable:'放得穩', unstable:'滾走', stack:'疊一個', nostack:'沒有可以穩穩疊東西的平面',
             roll:'就會滾', noroll:'滾不順', push:'順著彎的方向一推' },
        en:{ stable:'stays put', unstable:'rolls straight away', stack:'stack another one',
             nostack:'no flat top for stacking', roll:'away it rolls', noroll:'never rolls smoothly', push:'across the curve' }
      };
      LANGS.forEach(L => {
        const d = I18N[L], w = SAY[L];
        T.forEach((s, i) => {
          const k1 = d.k1(i), k2 = d.k2(i), k3 = d.k3(i);
          [d.k0, k1, k2, k3].forEach(x => { if (/undefined|NaN/.test(x)) fail(`k ${L}[${i}]: ${x}`); });
          if (s.stable){
            if (k1.indexOf(w.stable) < 0) fail(`k1 ${L}[${i}] must say it stays put`);
            if (k1.indexOf(w.unstable) >= 0) fail(`k1 ${L}[${i}] says it rolls away, but it has a flat face`);
          } else {
            if (k1.indexOf(w.unstable) < 0) fail(`k1 ${L}[${i}] must say it rolls away`);
            if (k1.indexOf(w.stable) >= 0) fail(`k1 ${L}[${i}] says it stays put, but it has no flat face`);
          }
          if (s.stackTop){
            if (k2.indexOf(w.stack) < 0) fail(`k2 ${L}[${i}] must say another one can be stacked`);
            if (k2.indexOf(w.nostack) >= 0) fail(`k2 ${L}[${i}] contradicts itself about stacking`);
          } else {
            if (k2.indexOf(w.nostack) < 0) fail(`k2 ${L}[${i}] must say it cannot be stacked on`);
            if (k2.indexOf(w.stack) >= 0) fail(`k2 ${L}[${i}] contradicts itself about stacking`);
          }
          if (s.rolls){
            if (k3.indexOf(w.roll) < 0) fail(`k3 ${L}[${i}] must say it rolls`);
            if (k3.indexOf(w.noroll) >= 0) fail(`k3 ${L}[${i}] contradicts itself about rolling`);
            /* 「碰到桌子就會滾」把「滾得動」說成「一放就自己滾」——
               放在水平桌面上的球不推是不會動的。所以會滾的那一句一定要帶推的動作。 */
            if (k3.indexOf(w.push) < 0) fail(`k3 ${L}[${i}] must say it takes a push to make it roll`);
          } else {
            if (k3.indexOf(w.noroll) < 0) fail(`k3 ${L}[${i}] must say it does not roll smoothly`);
            /* 不可以講成「怎麼推都不動」：盒子推得夠用力是會翻過邊的。 */
            const ABS = L === 'zh' ? ['怎麼放都不會滾', '只會滑'] : ['it will not roll', 'only slides'];
            ABS.forEach(x => { if (k3.indexOf(x) >= 0) fail(`k3 ${L}[${i}] makes the absolute claim "${x}"`); });
          }
        });
      });

      /* --- 5. 範例 4：對照表的每一格 --- */
      LANGS.forEach(L => {
        const d = I18N[L];
        ['nm','flat','edge','vert','roll','stack'].forEach(k => {
          if (!d.th || !d.th[k]) fail(`${L} table header ${k} is missing`);
        });
        T.forEach((s, i) => {
          const nm = d.nameOf(i), rc = d.rollCell(i), sc2 = d.stackCell(i), vc = d.vertCell(i);
          [nm, rc, sc2, vc].forEach(x => { if (/undefined|NaN/.test(x)) fail(`table ${L}[${i}]: ${x}`); });
          if (nm.indexOf(T[i][L].name) < 0) fail(`table ${L}[${i}] name cell is "${nm}"`);
          if (nm.indexOf(T[i].icon) < 0) fail(`table ${L}[${i}] name cell has no icon`);
          /* 會滾嗎：不會滾的一律是「不會」；會滾但站得穩的要講清楚是躺下來才滾。 */
          if (!s.rolls){
            if (rc !== d.noW) fail(`rollCell ${L}[${i}] must say it does not roll, got "${rc}"`);
          } else if (s.stable){
            if (rc === d.noW || rc === d.yesW) fail(`rollCell ${L}[${i}] must explain it rolls only when lying down`);
          } else if (rc !== d.yesW){
            fail(`rollCell ${L}[${i}] must say it rolls, got "${rc}"`);
          }
          if (sc2 !== (s.stackTop ? d.canW : d.cannotW)) fail(`stackCell ${L}[${i}] is "${sc2}"`);
          /* 圓錐那一格要把「那 1 個是上面的尖端」寫出來，不然只印 1 看不出是哪一個點。 */
          if (s.tip){
            if (vc === String(s.vert)) fail(`vertCell ${L}[${i}] must name the apex, not just print the number`);
            if (vc.indexOf(String(s.vert)) !== 0) fail(`vertCell ${L}[${i}] must start from the vertex count ${s.vert}`);
          } else if (vc !== String(s.vert)){
            fail(`vertCell ${L}[${i}] is "${vc}", the checker expects "${s.vert}"`);
          }
        });
        if (!d.tblNote || d.tblNote.length < 12) fail(`${L} tblNote must spell out the counting convention`);
      });

      /* --- 6. 畫布寬度：每一格孩子按得到的畫面都要驗，不只頭尾 --- */
      T.forEach((s, i) => {
        const bad = canvasProblem(`solidSVG(${s.id})`, data.solidSVG(s.id, s.icon));
        if (bad) fail(bad);
      });
      /* 只 forEach 不比對清單的話，把 cuboid 刪掉會剩下正方體三張圖 ——
         每一張都過關，整個檢查靜靜變綠（codex 審查抓到）。 */
      if (data.COUNT_SOLIDS.join(',') !== 'cube,cuboid'){
        fail(`COUNT_SOLIDS is ${data.COUNT_SOLIDS.join(',')}, expected exactly cube,cuboid`);
      }
      data.COUNT_SOLIDS.forEach(id => {
        const s = T[IDX[id]];
        if (!s){ fail(`COUNT_SOLIDS names ${id}, which is not in the truth table`); return; }
        data.PARTS.forEach(part => {
          const svg = data.partsSVG(id, part, {});
          const bad = canvasProblem(`partsSVG(${id}, ${part})`, svg);
          if (bad) fail(bad);
          /* 標記的數量要等於真值表；data-n 也要 —— 只比一個的話另一個寫錯不會有人發現。 */
          const want = part === 'flat' ? s.flat : (part === 'edge' ? s.edge : s.vert);
          const marks = (svg.match(/<circle[^>]*data-k="[^>]*>/g) || []).length;
          if (marks !== want) fail(`partsSVG(${id}, ${part}) draws ${marks} markers but the truth table says ${want}`);
          const dn = Number((svg.match(/data-n="(\d+)"/) || [])[1]);
          if (dn !== want) fail(`partsSVG(${id}, ${part}) data-n says ${dn}, the truth table says ${want}`);
          /* 看不見的那幾個一定要畫成虛線：面 3 個、邊 3 條、頂點 1 個。 */
          /* 「看不看得到」讀 data-hidden，不讀樣式：stroke-dasharray="none" 也符合
             「有這個屬性」，靠樣式判斷等於樣式一改檢查就靜靜失效（codex 審查抓到）。 */
          const marksAll = svg.match(/<circle[^>]*data-k="[^>]*>/g) || [];
          const hidden = marksAll.filter(t => /data-hidden="true"/.test(t)).length;
          const wantHidden = part === 'flat' ? 3 : (part === 'edge' ? 3 : 1);
          if (hidden !== wantHidden){
            fail(`partsSVG(${id}, ${part}) marks ${hidden} hidden markers, expected ${wantHidden}`);
          }
          if (marksAll.filter(t => /data-hidden="(true|false)"/.test(t)).length !== marksAll.length){
            fail(`partsSVG(${id}, ${part}) has a marker with no data-hidden flag`);
          }
          /* 標成看不到的，畫面上也真的要是虛線（而且不能是 dasharray="none"）。 */
          marksAll.filter(t => /data-hidden="true"/.test(t)).forEach(t => {
            const da = (t.match(/stroke-dasharray="([^"]*)"/) || [])[1];
            if (!da || da === 'none') fail(`partsSVG(${id}, ${part}) has a hidden marker drawn as a solid ring`);
          });
          /* 每一個孩子點得到的中間狀態都要驗，不是只驗頭尾：只在 lit={'0':true} 時
             把標記畫出畫布、或少畫一個，頭尾兩格都還是綠的（codex 第二輪抓到）。 */
          const lit = {};
          for (let k = 0; k < want; k++){
            lit[String(k)] = true;
            const label = `partsSVG(${id}, ${part}, ${k + 1} lit)`;
            const svgK = data.partsSVG(id, part, lit);
            const badK = canvasProblem(label, svgK);
            if (badK) fail(badK);
            const marksK = svgK.match(/<circle[^>]*data-k="[^>]*>/g) || [];
            if (marksK.length !== want) fail(`${label} draws ${marksK.length} markers, expected ${want}`);
            const dnK = Number((svgK.match(/data-n="(\d+)"/) || [])[1]);
            if (dnK !== want) fail(`${label} data-n says ${dnK}, the truth table says ${want}`);
            if (marksK.filter(t => /data-hidden="true"/.test(t)).length !== wantHidden){
              fail(`${label} marks the wrong number of hidden markers`);
            }
          }
        });
      });
      if (data.PARTS.join(',') !== 'flat,edge,vert') fail(`PARTS is ${data.PARTS.join(',')}, expected flat,edge,vert`);

      /* --- 7. 遊戲關卡 --- */
      const rounds = data.ROUNDS;
      if (rounds.length !== 5) fail(`the game has ${rounds.length} rounds; this lesson uses 5`);
      for (let idx = 0; idx < 5; idx++){
        /* 數字索引：`[r0, r1, , r3, r4]` 長度還是 5，forEach 會跳過那個洞。 */
        if (!Object.prototype.hasOwnProperty.call(rounds, idx) || rounds[idx] == null){
          fail(`ROUND ${idx + 1}: the slot is missing (an array hole or a nullish entry)`);
          continue;
        }
        const r = rounds[idx];
        const i = idx + 1;
        if (!EXTRA_PRED[r.extra]){ fail(`ROUND ${i}: unknown clue tag ${r.extra}`); return; }
        const all = clueTargets(r.flat, r.extra);
        if (all.length !== 1){
          fail(`ROUND ${i}: exactly one solid must match the clue, found ${all.length}`);
          return;
        }
        const target = all[0];
        if (r.sameFaces !== null && target.sameFaces !== r.sameFaces){
          fail(`ROUND ${i}: the extra clue does not match the solid it points at`);
        }
        if (r.opts.length !== 3) fail(`ROUND ${i} should offer 3 options, has ${r.opts.length}`);
        /* 先驗每個選項都是認得的 id：不驗的話，T[IDX[id]] 是 undefined，
           長度／不重複／答案／線索四條檢查全都會過，畫面上卻印出 undefined。 */
        const unknown = r.opts.filter(id => typeof id !== 'string' || IDX[id] === undefined);
        if (unknown.length){
          fail(`ROUND ${i}: ${unknown.join('/')} is not a solid the checker knows`);
          return;
        }
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i} has duplicate options`);
        if (!Number.isInteger(r.ans) || r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i}: ans ${r.ans} is not a valid option index`);
          return;
        }
        if (r.opts[r.ans] !== target.id){
          fail(`ROUND ${i}: opts[ans] is not the solid the clue describes (${r.opts[r.ans]} vs ${target.id})`);
        }
        /* 三個選項裡只有一個可以符合線索。 */
        const hits = r.opts.filter(id => {
          const s = T[IDX[id]];
          return s && s.flat === r.flat && EXTRA_PRED[r.extra](s);
        });
        if (hits.length !== 1) fail(`ROUND ${i}: exactly one option may match the clue, found ${hits.length}`);
        /* 資料區自己的比對函式要和設定檔算出同一個答案。 */
        const byData = T.filter(s => data.clueMatches(r, s));
        if (byData.length !== 1 || byData[0].id !== target.id){
          fail(`ROUND ${i}: the page's own clueMatches picks ${byData.map(s => s.id).join('/') || 'nobody'}`);
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          const ask = d.gAsk(r), h2 = d.gHint2(r), why = d.gWhy(r), opt = d.gOpt(target.id);
          [ask, h2, why, opt, d.gHint1].forEach(x => { if (/undefined|NaN/.test(x)) fail(`ROUND ${i} ${L}: ${x}`); });
          if (r.flat > 0){
            if (ask.indexOf(String(r.flat)) < 0) fail(`ROUND ${i} ${L}: gAsk never prints the flat-face count ${r.flat}`);
          } else if (/\d/.test(ask)){
            fail(`ROUND ${i} ${L}: gAsk should say "none at all" rather than print a number`);
          }
          if (L === 'en'){
            [['gAsk', ask], ['gHint2', h2], ['gWhy', why]].forEach(([k, x]) => {
              const bad = enPluralProblem(`ROUND ${i} ${k} en`, x);
              if (bad) fail(bad);
            });
          }
          if (why.indexOf(T[IDX[target.id]][L].name) < 0) fail(`ROUND ${i} ${L}: gWhy never names the answer`);
          /* 只要求「講出答案的名字」是不夠的：正方體和長方體都有 6 個平平的面，
             決定答案的是 extra 那一句，解釋一定要把它再講一次（codex 審查抓到）。 */
          if (why.indexOf(CLUE_SAY[L][r.extra]) < 0){
            fail(`ROUND ${i} ${L}: gWhy never states the decisive clue ("${CLUE_SAY[L][r.extra]}")`);
          }
          if (r.flat > 0 && why.indexOf(String(r.flat)) < 0){
            fail(`ROUND ${i} ${L}: gWhy never states the flat-face count ${r.flat}`);
          }
          /* 第二層提示照年段規範就是「接近答案」：它指向生活實物（皮球、罐頭），
             所以這裡驗的是「有沒有指出那個實物」，不是「有沒有洩漏答案」——
             實物的名字本來就含有形體的名字（皮球含球、ice-cream cone 含 cone）。 */
          if (h2.indexOf(T[IDX[target.id]][L].real) < 0) fail(`ROUND ${i} ${L}: gHint2 never names the everyday object`);
          if (opt !== T[IDX[target.id]].icon + ' ' + T[IDX[target.id]][L].name){
            fail(`ROUND ${i} ${L}: the option label is "${opt}"`);
          }
        });
      }
      if (rounds.every(r => r && r.ans === 0)) fail('every game round has the answer first');

      /* --- 8. 三層題庫的神諭 ---
         每一題記四件事，而且都跟題目本身分開維護：
         - nums：題幹裡「剛剛好」會出現的阿拉伯數字（中英各驗一次）。
         - calc：從真值表把答案「算出來」的方式，不是抄答案。
         - zh/en：標為正解的那一個選項應該長什麼樣。
         - optsAll：四個選項的完整清單（只驗正解的話，把某個誘答換成 banana 也沒人發現）。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[], calc:{ t:'flat', s:'cube' }, zh:'6 個', en:'6',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['6 個平平的面'], en:['6 flat faces'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['4 個','6 個','8 個','12 個'], en:['4','6','8','12'] } },
          { nums:[], calc:{ t:'flat', s:'ball' }, zh:'0 個', en:'0',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['整個都是彎彎的面'], en:['is curved all over'] },
            whyNot:{ zh:['沒有彎彎的面','不是彎彎的面'], en:['no curved','not curved'] },
            optsAll:{ zh:['0 個','1 個','2 個','6 個'], en:['0','1','2','6'] } },
          { nums:[], calc:{ t:'flat', s:'cyl' }, zh:'2 個', en:'2',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['旁邊那一片是彎彎的面'], en:['is not a flat face'] },
            whyNot:{ zh:['沒有彎彎的面','會滾'], en:['no curved','roll'] },
            optsAll:{ zh:['1 個','2 個','3 個','6 個'], en:['1','2','3','6'] } },
          { nums:[], calc:{ t:'vert', s:'cube' }, zh:'8 個', en:'8',
            stemMust:{ zh:['頂點'], en:['corners'] }, stemNot:{ zh:['平平的面','直直的邊'], en:['flat faces','straight edges'] },
            whyMust:{ zh:['8 個頂點'], en:['8 corners'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['4 個','6 個','12 個','8 個'], en:['4','6','12','8'] } },
          { nums:[], calc:null, zh:'⚽ 皮球', en:'⚽ A ball',
            stemMust:{ zh:['滾'], en:['roll'] }, stemNot:{ zh:['疊'], en:['stack'] },
            whyMust:{ zh:['整個都是彎彎的面','翻過邊'], en:['is curved all over','tips them over an edge'] },
            whyNot:{ zh:['沒有彎彎的面'], en:['no curved'] },
            optsAll:{ zh:['🎲 骰子','🥛 牛奶盒','📚 書本','⚽ 皮球'],
                      en:['🎲 A die','🥛 A milk carton','📚 A book','⚽ A ball'] } },
          { nums:[], calc:{ t:'flat', s:'cone' }, zh:'1 個', en:'1',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['尖點'], en:['sharp point'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['0 個','2 個','1 個','3 個'], en:['0','2','1','3'] } }
        ],
        qsAdv: [
          { nums:[12,2], calc:{ t:'edge', s:'cuboid', mul:2 }, zh:'24 條', en:'24',
            stemMust:{ zh:['直直的邊'], en:['straight edges'] }, stemNot:{ zh:['平平的面','頂點'], en:['flat faces','corners'] },
            whyMust:{ zh:['12 × 2 ＝ 24'], en:['12 × 2 = 24'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['12 條','22 條','24 條','26 條'], en:['12','22','24','26'] } },
          { nums:[3], calc:{ t:'flat', s:'cyl', mul:3 }, zh:'6 個', en:'6',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['2 × 3 ＝ 6'], en:['2 × 3 = 6'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['9 個','6 個','3 個','5 個'], en:['9','6','3','5'] } },
          { nums:[], calc:null, zh:'🥫 罐頭站著', en:'🥫 A can standing up',
            stemMust:{ zh:['疊'], en:['stacked'] }, stemNot:{ zh:['滾來滾去'], en:['roll'] },
            whyMust:{ zh:['平平的圓'], en:['flat circle'] },
            optsAll:{ zh:['⚽ 皮球','🎄 圓錐，尖尖的朝上','🥫 罐頭躺著','🥫 罐頭站著'],
                      en:['⚽ A ball','🎄 A cone, tip pointing up','🥫 A can lying down','🥫 A can standing up'] } },
          { nums:[2,1], calc:{ t:'sumFlat', parts:[['cuboid',2],['ball',1]] }, zh:'12 個', en:'12',
            stemMust:{ zh:['平平的面'], en:['flat faces'] }, stemNot:{ zh:['直直的邊','頂點'], en:['straight edges','corners'] },
            whyMust:{ zh:['6 × 2 ＝ 12'], en:['6 × 2 = 12'] }, whyNot:{ zh:['會滾'], en:['roll'] },
            optsAll:{ zh:['12 個','13 個','6 個','18 個'], en:['12','13','6','18'] } }
        ],
        qsBoost: [
          { nums:[], calc:null, whyMust:{ zh:['長和寬','厚度'], en:['length and width','thickness'] },
            stemMust:{ zh:['正方形','骰子'], en:['square','die'] }, stemNot:{ zh:['幾個'], en:['How many'] },
            zh:'畫的正方形是平面圖形，骰子是立體形體',
            en:'The drawn square is a flat shape and the die is a solid shape',
            optsAll:{ zh:['兩個都是正方體','兩個都是平面圖形','畫的正方形是平面圖形，骰子是立體形體','骰子是正方形'],
                      en:['Both of them are cubes','Both of them are flat shapes',
                          'The drawn square is a flat shape and the die is a solid shape','The die is a square'] } },
          { nums:[], calc:null, zh:'圓形', en:'A circle',
            stemMust:{ zh:['什麼形狀'], en:['What shape'] }, stemNot:{ zh:['幾個'], en:['How many'] },
            whyMust:{ zh:['平面圖形','立體形體'], en:['flat shape','solid shape'] },
            optsAll:{ zh:['圓柱','圓形','球','正方形'], en:['A cylinder','A circle','A sphere','A square'] } }
        ]
      };
      /* 答案是從真值表算出來的，不是抄的。 */
      /* 值和單位一起算出來。只比「數字有沒有出現」的話，設定檔和課程同時把
         「6 個」寫成「6 條」還是會通過 —— 獨立神諭就失去意義了（codex 審查抓到）。
         這一課的中文選項帶單位（6 個／24 條），英文選項是純數字。 */
      const calcValue = (c) => {
        if (!c) return null;
        const kind = c.t === 'sumFlat' ? 'flat' : c.t;
        let v;
        if (c.t === 'sumFlat'){
          v = c.parts.reduce((sum, p) => sum + T[IDX[p[0]]].flat * p[1], 0);
        } else {
          const s = T[IDX[c.s]];
          if (!s) return { v:NaN, kind:kind };
          v = (c.t === 'flat' ? s.flat : (c.t === 'edge' ? s.edge : s.vert)) * (c.mul || 1);
        }
        return { v:v, kind:kind };
      };
      const calcString = (c, lang) => {
        const r = calcValue(c);
        if (!r || !Number.isInteger(r.v)) return null;
        return lang === 'zh' ? (r.v + ' ' + ZH_UNIT[r.kind]) : String(r.v);
      };
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次長度。只比中文的話，刪掉最後一題英文題目時
           中文長度還是對的，而英文那一圈會少跑一題 —— 那一題整個沒被驗到。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          /* 數字索引跑，不用 forEach：`[q0, q1, , q3]` 長度沒變，forEach 會跳過那個洞，
             那一題和它的選項就整個沒被驗到（codex 第三輪抓到）。 */
          const arr = I18N[L][bank] || [];
          for (let i = 0; i < oracle.length; i++){
            if (!Object.prototype.hasOwnProperty.call(arr, i) || arr[i] == null){
              fail(`${bank}[${i}] ${L}: the slot is missing (an array hole or a nullish entry)`);
              continue;
            }
            const q = arr[i];
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            /* ans 先驗合法，否則 q.opts[q.ans] 是 undefined，後面每一條都在比 undefined。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。
               只驗「有沒有出現」擋不住「題幹多塞一個 7」。這一條只看阿拉伯數字：
               這一課每一個運算元都是阿拉伯數字，中文數字（兩個、一共）不算數量。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            /* 只記數字擋不住「把平平的面改成直直的邊」：數字沒變、BARE 也躲得過，
               答案 6 卻應該是 12（codex 第二輪抓到）。所以主詞也要記下來比對。 */
            ((o.stemMust && o.stemMust[L]) || []).forEach(x => {
              if (plain.indexOf(x) < 0) fail(`${bank}[${i}] ${L}: the stem never asks about "${x}"`);
            });
            ((o.stemNot && o.stemNot[L]) || []).forEach(x => {
              if (plain.indexOf(x) >= 0) fail(`${bank}[${i}] ${L}: the stem asks about "${x}", which is a different quantity`);
            });
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            [...new Set((plain.match(/\d+/g) || []).map(Number))].forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ') || 'none'})`);
              }
            });
            /* 2. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 3. 神諭寫下的字串本身要能從真值表重算出來。 */
            if (o.calc){
              const wantCalc = calcString(o.calc, L);
              if (wantCalc === null){
                fail(`${bank}[${i}]: the checker cannot recompute this answer`);
              } else if (want !== wantCalc){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not "${wantCalc}", recomputed from the truth table`);
              }
            }
            /* 4. 四個選項要和神諭記下的清單一字不差（順序也算 —— 正解的位置就是 ans）。 */
            const wantOpts = L === 'zh' ? o.optsAll.zh : o.optsAll.en;
            if (q.opts.length !== wantOpts.length){
              fail(`${bank}[${i}] ${L}: ${q.opts.length} options but the checker recorded ${wantOpts.length}`);
            } else {
              q.opts.forEach((opt, oi) => {
                if (opt !== wantOpts[oi]){
                  fail(`${bank}[${i}] ${L}: option ${oi} is "${opt}", which is not one of the options the checker recorded ("${wantOpts[oi]}")`);
                }
              });
            }
            /* 5. 選項字串兩兩不同（含空白正規化的版本）。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
              }
            }
            if (/undefined|NaN/.test(q.stem + q.why)) fail(`${bank}[${i}] ${L}: undefined/NaN in text`);
            if (L === 'en'){
              const bad = enPluralProblem(`${bank}[${i}] en`, q.stem + ' ' + q.why + ' ' + q.opts.join(' '));
              if (bad) fail(bad);
            }
            /* NOTE: 這個迴圈用數字索引，不是 forEach —— 見上面的洞的說明。 */
            /* 解釋本身也要驗事實：只擋 undefined/NaN 的話，
               「正方體有 6 個平平的面，因為它會滾」照樣通過（codex 審查抓到）。
               whyMust 是這一題非講不可的理由，whyNot 是這一題不可能成立的理由。 */
            const whyPlain = String(q.why).replace(/<[^>]+>/g, '');
            /* whyMust 的字串一律寫成「帶極性的完整命題」（「整個都是彎彎的面」，
               而不是「彎彎的面」）：只要一個名詞，「沒有彎彎的面」也會通過，
               而那句話是假的（codex 第三輪抓到）。whyNot 再把否定形式擋一次。 */
            ((o.whyMust && o.whyMust[L]) || []).forEach(need => {
              if (whyPlain.indexOf(need) < 0){
                fail(`${bank}[${i}] ${L}: the explanation never gives the reason "${need}"`);
              }
              const NEG = L === 'zh' ? ['沒有', '不是', '沒'] : ['no ', 'not ', 'never '];
              NEG.forEach(neg => {
                if (whyPlain.indexOf(neg + need) >= 0){
                  fail(`${bank}[${i}] ${L}: the explanation negates its own required reason ("${neg}${need}")`);
                }
              });
            });
            ((o.whyNot && o.whyNot[L]) || []).forEach(bad2 => {
              if (whyPlain.indexOf(bad2) >= 0){
                fail(`${bank}[${i}] ${L}: the explanation gives "${bad2}" as the reason, which does not decide this question`);
              }
            });
          }
        });
      });
      /* --- 8b. 產生器的題幹到底在問什麼 ---
         simgen 只驗選項與正解，不看題幹：把 flatFaces 的題幹從「平平的面」改成
         「直直的邊」，每一條不變條件與 expectedCorrect 都還是綠的，正解卻變成錯的
         （codex 第二輪抓到）。simgen 沒有給設定檔看題幹的鉤子，所以在這裡把
         review.html 的 GENS 切出來自己渲染一次，逐個產生器驗題幹的主詞。
         breaktest 支援 { file:'review', via:'index' }，所以這一段也改得壞、證得出來。 */
      const STEM_RULE = {
        flatFaces:      { zh:{ must:['平平的面'], not:['直直的邊','頂點'] },
                          en:{ must:['flat faces'], not:['straight edges','corners'] } },
        straightEdges:  { zh:{ must:['直直的邊'], not:['平平的面','頂點'] },
                          en:{ must:['straight edges'], not:['flat faces','corners'] } },
        corners:        { zh:{ must:['頂點'], not:['平平的面','直直的邊'] },
                          en:{ must:['corners'], not:['flat faces','straight edges'] } },
        countTotalFlat: { zh:{ must:['平平的面','分開放'], not:['直直的邊','頂點'] },
                          en:{ must:['flat faces','apart'], not:['straight edges','corners'] } },
        mixedTotalFlat: { zh:{ must:['平平的面','分開放'], not:['直直的邊','頂點'] },
                          en:{ must:['flat faces','apart'], not:['straight edges','corners'] } },
        whichNoRoll:    { zh:{ must:['彎彎的面'], not:['疊'] },
                          en:{ must:['curved face'], not:['stack'] } },
        whichNoStack:   { zh:{ must:['平平的頂面','疊'], not:[] },
                          en:{ must:['flat top'], not:[] } },
        realToSolid:    { zh:{ must:['什麼立體形體'], not:['幾個'] },
                          en:{ must:['which solid shape'], not:['how many'] } },
        faceShape:      { zh:{ must:['什麼形狀'], not:['幾個'] },
                          en:{ must:['What shape'], not:['How many'] } },
        planeVsSolid:   { zh:{ must:['哪一句話是對的'], not:['幾個'] },
                          en:{ must:['which sentence is true'], not:['how many'] } },
        identifyByClue: { zh:{ must:['我是誰'], not:['幾個'] },
                          en:{ must:['Who am I'], not:['how many'] } }
      };
      const fsMod0 = require('fs');
      const pathMod0 = require('path');
      const lessonDir0 = pathMod0.dirname(pathMod0.resolve(process.argv[2] || '.'));
      const reviewPath = pathMod0.join(lessonDir0, 'review.html');
      if (!fsMod0.existsSync(reviewPath)){
        fail('review.html is missing from ' + lessonDir0 + ' — this lesson is four pages');
      } else {
        const rsrc = fsMod0.readFileSync(reviewPath, 'utf8');
        const gs = rsrc.indexOf('/* ---------- 工具 ---------- */');
        const ge = rsrc.indexOf('/* ---------- 出一批');
        if (gs < 0 || ge < 0){
          fail('review.html: cannot locate the GENS block markers');
        } else {
          let GENS = null;
          try { GENS = new Function(rsrc.slice(gs, ge) + '\n; return GENS;')(); }
          catch (e){ fail('review.html: the GENS block does not evaluate (' + e.message + ')'); }
          if (GENS){
            const ids = GENS.map(g => g.id);
            const wanted = Object.keys(STEM_RULE);
            wanted.forEach(id => { if (ids.indexOf(id) < 0) fail(`review.html has no generator "${id}"`); });
            ids.forEach(id => { if (!STEM_RULE[id]) fail(`review.html generator "${id}" has no stem rule recorded`); });
            /* 抽 12 次是不可靠的：只在某一個參數值才錯的題幹，12 次不一定抽得到，
               檢查就變成靠運氣（codex 第三輪抓到）。改成「固定亂數種子 ＋ 抽到把
               宣告的參數域跑滿」，並且比對觀察到的參數集合是否剛好等於宣告的域 ——
               少一個值（沒抽到）或多一個值（產生器偷偷放寬）都會被抓到。 */
            const GEN_DOMAIN = {
              flatFaces:[0,1,2,3,4], straightEdges:[0,1,2,3,4], corners:[0,1,2,3],
              countTotalFlat:[0,1,2,4], mixedTotalFlat:[0,1,2,4],
              whichNoRoll:[0,1], whichNoStack:[3,4], realToSolid:[0,1,2,3,4],
              faceShape:[0,2,4], planeVsSolid:[0,1,2,3], identifyByClue:[0,1,2,3,4]
            };
            const keyOfDraw = (g2, d) => (g2.id === 'planeVsSolid' ? d.pi
                                        : (g2.id === 'mixedTotalFlat' ? d.a : d.si));
            const realRandom = Math.random;
            let seed = 20260826 >>> 0;
            Math.random = function(){
              seed = (seed + 0x6D2B79F5) | 0;
              let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
              x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
              return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
            };
            try {
              GENS.forEach(g => {
                const rule = STEM_RULE[g.id];
                const domain = GEN_DOMAIN[g.id];
                if (!rule || !domain){ fail(`review ${g.id}: no stem rule or parameter domain recorded`); return; }
                const seenKeys = {};
                for (let t = 0; t < 600; t++){
                  const d = g.make([]);
                  const k = keyOfDraw(g, d);
                  seenKeys[k] = true;
                  LANGS.forEach(L => {
                    const stem = String(g.fmt(d, L).stem).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, '');
                    rule[L].must.forEach(x => {
                      if (stem.indexOf(x) < 0) fail(`review ${g.id} ${L} (param ${k}): the stem never asks about "${x}"`);
                    });
                    rule[L].not.forEach(x => {
                      if (stem.indexOf(x) >= 0) fail(`review ${g.id} ${L} (param ${k}): the stem asks about "${x}", which is a different quantity`);
                    });
                  });
                }
                const got = Object.keys(seenKeys).map(Number).sort((a2, b2) => a2 - b2);
                if (got.join(',') !== domain.slice().sort((a2, b2) => a2 - b2).join(',')){
                  fail(`review ${g.id}: drew parameters ${got.join('/')}, the checker expects exactly ${domain.join('/')}`);
                }
              });
            } finally {
              Math.random = realRandom;
            }
          }
        }
      }

      /* --- 9. 速查卡與家長頁 ---
         verify_lesson_data 只吃 index.html，所以這兩頁本來完全沒有人驗 ——
         而它們正是「數面規則」寫錯了最不會被發現的地方（第一輪 codex 審查抓到）。
         這裡從 index.html 的路徑推出同一個資料夾，把兩頁的字典執行起來逐項比對。
         檔案不在就直接判失敗 —— 這一課是四頁，少一頁本身就是缺陷。 */
      const fsMod = require('fs');
      const pathMod = require('path');
      const lessonDir = pathMod.dirname(pathMod.resolve(process.argv[2] || '.'));
      const loadDict = (file) => {
        const abs = pathMod.join(lessonDir, file);
        if (!fsMod.existsSync(abs)){
          fail(`${file} is missing from ${lessonDir} — this lesson is four pages`);
          return null;
        }
        const src = fsMod.readFileSync(abs, 'utf8');
        const a = src.indexOf('var I18N = {');
        const b = src.indexOf("var lang = 'zh';", a);
        if (a < 0 || b < 0){ fail(`${file}: cannot locate the I18N literal`); return null; }
        try {
          return { src:src, I18N: new Function(src.slice(a, b) + '\n; return I18N;')() };
        } catch (e){
          fail(`${file}: the I18N literal does not evaluate (${e.message})`);
          return null;
        }
      };

      const refPage = loadDict('reference.html');
      if (refPage){
        const R = refPage.I18N;
        LANGS.forEach(L => {
          const d = R[L];
          if (!d){ fail(`reference.html has no ${L} dictionary`); return; }
          /* 對照表的每一格都要等於真值表算出來的字串。這張表是孩子印出來貼在
             書桌前的那一份 —— 它和上課頁對不上，等於教了兩套規則。 */
          T.forEach((s2, i) => {
            const k = 'c' + (i + 1);
            const nm = d[k + 'a'] || '';
            if (nm.indexOf(s2.icon) < 0 || nm.indexOf(s2[L].name) < 0){
              fail(`reference.html ${L} ${k}a is "${nm}", expected the icon plus "${s2[L].name}"`);
            }
            if (d[k + 'b'] !== s2[L].real){
              fail(`reference.html ${L} ${k}b is "${d[k + 'b']}", the checker expects "${s2[L].real}"`);
            }
            if (d[k + 'c'] !== String(s2.flat)) fail(`reference.html ${L} ${k}c (flat faces) is "${d[k + 'c']}", expected ${s2.flat}`);
            if (d[k + 'd'] !== String(s2.edge)) fail(`reference.html ${L} ${k}d (straight edges) is "${d[k + 'd']}", expected ${s2.edge}`);
            const wantVert = s2.tip ? (L === 'zh' ? '1（尖尖的那一點）' : '1 (the sharp apex)') : String(s2.vert);
            if (d[k + 'e'] !== wantVert) fail(`reference.html ${L} ${k}e (corners) is "${d[k + 'e']}", expected "${wantVert}"`);
            const wantRoll = !s2.rolls ? (L === 'zh' ? '不會' : 'no')
                           : (s2.stable ? (L === 'zh' ? '躺下來會' : 'yes, lying down') : (L === 'zh' ? '會' : 'yes'));
            if (d[k + 'f'] !== wantRoll) fail(`reference.html ${L} ${k}f (rolls) is "${d[k + 'f']}", expected "${wantRoll}"`);
            const wantStack = s2.stackTop ? (L === 'zh' ? '可以' : 'yes') : (L === 'zh' ? '不行' : 'no');
            if (d[k + 'g'] !== wantStack) fail(`reference.html ${L} ${k}g (stacks) is "${d[k + 'g']}", expected "${wantStack}"`);
          });
          /* 速查卡是給孩子看的，不可以出現五年級的名詞。 */
          const all = Object.keys(d).map(k => (typeof d[k] === 'string' ? d[k] : '')).join(' ');
          const G5 = L === 'zh' ? [/展開圖/, /表面積/, /體積/, /角柱/, /角錐/, /柱體/, /錐體/]
                                : [/\bnets?\b/i, /surface area/i, /\bvolume\b/i, /\bprisms?\b/i, /\bpyramids?\b/i];
          G5.forEach(re => {
            const m = all.match(re);
            if (m) fail(`reference.html ${L}: mentions "${m[0]}", which is grade-5 material and must not appear in this lesson`);
          });
          const BARE_RE = L === 'zh' ? [/有幾個面/, /有幾條邊/] : [/how many faces/i, /how many edges/i, /how many sides/i];
          BARE_RE.forEach(re => {
            if (re.test(all)) fail(`reference.html ${L}: uses a bare "how many faces/edges" phrasing`);
          });
          if (L === 'zh' && (!d.tblNote || d.tblNote.indexOf('平平的面') < 0 || d.tblNote.indexOf('直直的邊') < 0)){
            fail('reference.html zh tblNote must spell out that the table counts flat faces and straight edges');
          }
        });
        /* 速查卡自己的兩張圖也要驗畫布寬度 —— 它們不在 index.html 裡，
           原本整個在畫布檢查之外。 */
        const gs = refPage.src.indexOf('/* ---------- 速查卡的圖 ---------- */');
        const ge = refPage.src.indexOf('var I18N = {', gs);
        if (gs < 0 || ge < 0){
          fail('reference.html: cannot locate the drawing block markers');
        } else {
          try {
            const fns = new Function(refPage.src.slice(gs, ge) + '\n; return {cubeSVG:cubeSVG, cylSVG:cylSVG};')();
            [['cubeSVG', fns.cubeSVG()], ['cylSVG', fns.cylSVG()]].forEach(([n2, svg]) => {
              const bad = canvasProblem('reference.html ' + n2, svg);
              if (bad) fail(bad);
            });
          } catch (e){
            fail('reference.html: the drawing block does not evaluate (' + e.message + ')');
          }
        }
      }

      const parPage = loadDict('parents.html');
      if (parPage){
        const P = parPage.I18N;
        /* 家長頁的工作就是把數面的規則交代清楚，所以它自己一定要照著規則寫。
           （這一頁刻意會提到五年級的單元名稱 —— 那是寫給大人看的範圍說明，
           和速查卡不同，所以不套用五年級名詞的禁令。） */
        const need = {
          zh:{ s1p2:['平平的面','彎彎的面','直直的邊','頂點'], s1p1:['課綱','直觀觀察'] },
          en:{ s1p2:['flat faces','curved face','straight edge','apex'], s1p1:['curriculum'] }
        };
        LANGS.forEach(L => {
          const d = P[L];
          if (!d){ fail(`parents.html has no ${L} dictionary`); return; }
          Object.keys(need[L]).forEach(key => {
            need[L][key].forEach(word => {
              if (String(d[key] || '').indexOf(word) < 0){
                fail(`parents.html ${L} ${key} never mentions "${word}"`);
              }
            });
          });
          const all = Object.keys(d).map(k => (typeof d[k] === 'string' ? d[k] : '')).join(' ');
          if (L === 'zh'){
            ['數面', '數邊'].forEach(w => {
              if (all.indexOf(w) >= 0) fail(`parents.html zh says "${w}" — it must always be 數平平的面／數直直的邊`);
            });
          }
        });
      }

      /* 這一課絕對不可以出現「有幾個面」「有幾條邊」這種沒有唯一答案的問法 ——
         課本對圓柱的側面算不算面各說各話，所以一律要寫「平平的面」「直直的邊」。 */
      const BARE = {
        zh:[/有幾個面/, /有幾條邊/, /幾個面\？/],
        en:[/how many faces/i, /how many edges/i, /how many sides/i]
      };
      LANGS.forEach(L => {
        ['qs','qsAdv','qsBoost'].forEach(bank => {
          (I18N[L][bank] || []).forEach((q, i) => {
            BARE[L].forEach(re => {
              if (re.test(String(q.stem).replace(/<[^>]+>/g, ''))){
                fail(`${bank}[${i}] ${L}: asks a bare "how many faces/edges" question — it has no unique answer in this lesson`);
              }
            });
          });
        });
      });
    }
  }
};
