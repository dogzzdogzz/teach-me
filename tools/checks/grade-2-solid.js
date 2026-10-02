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

/* ---------- 小遊戲「立體形體大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   點一點（找頂點，看不到的那一個也算）、分一分（平平的面有幾個）、滾一滾（彎彎的面碰到桌子才滾）、
   疊一疊（上面平平的才疊得上去）、貼一貼（每一個平平的面一張，幾個加起來）。
   做法照 grade-2-length.js／grade-3-divide.js，但更進一步：**頁面自己的遊戲引擎整段放進一個假的 DOM 裡跑**
   （makeBoard／addPiece／useTapSelect／nearestOpen／roundSolved／roundMiss 全部是頁面的原始碼，不是替身），
   然後照這個設定檔自己的規則（下面的 T 真值表、自己的幾何）對每一題做每一種動作，看頁面收不收、說哪一句、
   什麼時候過關、給幾顆星。
   - 第 1 關：每一個頂點、每一個 1px 格點都用自己的幾何分類（頂點／邊／面／空白），和頁面的 pointHit() 比；
     看不到的那一個頂點用「投影落在前面那一面裡面」自己判斷；畫出來的 SVG 逐元素比。
   - 第 2、5 關：每一個形體 × 每一格都放一次；吸附帶每 0.25px 比「最近的方框」。
   - 第 3 關：每一個形體 × 每一種擺法（轉 0～3 次）都推一次。
   - 第 4 關：所有放法走完（每一層試五個），證明只有「三個上面平平的在下面、圓錐在最上面」疊得完。
   - 每一句說明逐個比數字，而且那句話說的事要成立（圓柱真的是 2 個、球真的沒有平平的面）。
   已知極限：拖拉手勢本身（第一根手指、capture 遺失、document 上的放開保險、畫板不跳動、375px 的實際尺寸、
   舊畫板的積木不能動新畫板）是 teaching-workspace/game-harness/g2-solid 的端對端測試在驗；這裡只用原始碼形狀守住那幾行。 */
const { extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
  const plain = t => String(t).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read [' + want.join() + '], got [' + nums(text).join() + '] — ' + plain(text));
  };
  const has = (where, text, re) => { if (!re.test(plain(text))) fail(where + ': should say ' + re + ' — ' + plain(text)); };
  const W = D.GAME_W;
  const SID = ['cube', 'cuboid', 'cyl', 'ball', 'cone'];
  const own = id => T[IDX[id]];
  const nameRe = (L, id) => new RegExp(own(id)[L].name, 'i');

  /* --- 順序與說明 --- */
  const TYPES = ['point', 'sort', 'roll', 'stack', 'sticker'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  LANGS.forEach(L => TYPES.forEach(t => {
    ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 8)) fail(k + '.' + t + ' missing in ' + L); });
  }));
  /* 第 1 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外）；其他四關要寫出「先點、再點」 */
  if (!/用點的/.test(I18N.zh.gAsks.point) || !/taps only/.test(I18N.en.gAsks.point)) fail('point: the round has no drag — its instructions must say it is taps only');
  ['sort', 'roll', 'stack', 'sticker'].forEach(t => {
    if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way');
  });
  if (!/🔄/.test(I18N.zh.gAsks.roll) || !/🔄/.test(I18N.en.gAsks.roll)) fail('roll: the instructions must say what 🔄 does');

  /* --- 引擎的守門（原始碼形狀）：端對端測試另外真的去按 --- */
  const sStart = extractFunction(src, 'startRound') || '';
  if (!/gCtx = \{\}; gGen\+\+;/.test(sStart) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) ||
      !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round');
  if (!/gameStage\.textContent = '';/.test(sStart)) fail('startRound() does not clear the stage before rendering');
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(sStart)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/if \(!start \|\| e\.pointerId !== pid\) return;/.test(src)) fail('a piece follows a finger other than the first one');
  if (!/if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}/.test(src)) fail('a piece that was tapped and then dragged stays selected');
  if (!/if \(e\.target\.closest && e\.target\.closest\('\.gpiece, \.gturn'\)\) return;/.test(src)) fail('a tap on 🔄 (or on a piece) is taken as "tap the destination"');
  if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('placed pieces must be pointer-events:none');
  if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('pieces must set touch-action:none');

  /* --- shuffle()：切出來真的跑 —— 是排列、不改到輸入、會洗；照 key 一樣大也算「排好」，排好就一定被打亂 --- */
  const shufSrc = extractFunction(src, 'shuffle');
  let shuffleFn = null;
  if (!shufSrc) fail('cannot cut shuffle() out of index.html');
  else {
    try { shuffleFn = new Function('Math', shufSrc + '\nreturn shuffle;'); } catch (e){ fail('shuffle() does not evaluate on its own: ' + e.message); }
  }
  if (shuffleFn){
    const flatKey = i => T[i].flat;
    const sortedBy = (a, key) => a.every((v, i) => i === 0 || key(a[i - 1]) <= key(v));
    /* 假亂數「永遠抽到自己」→ Fisher–Yates 原樣奉還，最後那一步一定要把它打亂 */
    const keep = shuffleFn(Object.assign(Object.create(Math), { random:() => 0.999999 }));
    const asc = [3, 4, 2, 0, 1];   /* 球 0、圓錐 1、圓柱 2、正方體 6、長方體 6 —— 平平的面由少到多 */
    const k1 = keep(asc, flatKey);
    if (sortedBy(k1, flatKey)) fail('shuffle(): a tray that comes out in flat-face order (' + k1.map(flatKey).join(',') + ') is left in order');
    const k2 = keep([3, 4, 2, 1, 0], flatKey);
    if (sortedBy(k2, flatKey)) fail('shuffle(): "6, 6" in either order is still the answer order — ties must count as sorted');
    const realS = shuffleFn(Math);
    const seen = new Set(), pos0 = new Set();
    for (let n = 0; n < 3000; n++){
      const inp = [0, 1, 2, 3, 4], out = realS(inp, flatKey);
      if (inp.join() !== '0,1,2,3,4') { fail('shuffle() mutates its input'); break; }
      if (out.slice().sort().join() !== '0,1,2,3,4'){ fail('shuffle() is not a permutation: ' + out); break; }
      if (sortedBy(out, flatKey)){ fail('shuffle() returned the tray in flat-face order: ' + out.map(flatKey).join(',')); break; }
      seen.add(out.join()); pos0.add(out[0]);
    }
    if (seen.size < 40 || pos0.size < 5) fail('shuffle() hardly shuffles (' + seen.size + ' orders, ' + pos0.size + ' first cards in 3000 runs)');
  }

  /* --- nearestOpen()：切出來真的跑，和「最近的方框」比 --- */
  const noSrc = extractFunction(src, 'nearestOpen');
  let nearestOpen = null;
  if (!noSrc) fail('cannot cut nearestOpen() out of index.html');
  else { try { nearestOpen = new Function(noSrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() does not evaluate: ' + e.message); } }
  const ownNearest = (list, pt, pad) => {
    let best = null, bd = Infinity, bc = Infinity;
    list.forEach(b => {
      const dx = Math.abs(pt.x - b.cx), dy = Math.abs(pt.y - b.cy);
      if (dx > b.hw + pad || dy > b.hh + pad) return;
      const dd = Math.hypot(Math.max(0, dx - b.hw), Math.max(0, dy - b.hh)), dc = Math.hypot(dx, dy);
      if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
    });
    return best && !best.done ? best : null;
  };
  const sweep = (what, list, y, pad) => {
    if (!nearestOpen) return;
    let bad = 0, overlaps = 0, first = '';
    for (let x = -10; x <= W + 10; x += 0.25){
      const pt = { x, y }, a = nearestOpen(list, pt, pad), b = ownNearest(list, pt, pad);
      const inPad = list.filter(r => Math.abs(x - r.cx) <= r.hw + pad && Math.abs(y - r.cy) <= r.hh + pad).length;
      if (inPad > 1) overlaps++;
      if (a !== b){ bad++; if (!first) first = 'x=' + x + ' page→' + (a ? list.indexOf(a) : '-') + ' own→' + (b ? list.indexOf(b) : '-'); }
    }
    if (bad) fail(what + ': nearestOpen() disagrees with the nearest box at ' + bad + ' points (' + first + ')');
    if (!overlaps) fail(what + ': the snap zones never overlap — the nearest-box rule is not exercised (gap too wide)');
    /* 已經放好的最近那一格不收，也不可以改放進旁邊的 */
    const L0 = list.map((r, i) => Object.assign({}, r, { done:i === 0 }));
    const edge = { x:L0[0].cx + L0[0].hw + 0.5, y };
    if (nearestOpen(L0, edge, pad) !== null && ownNearest(L0, edge, pad) === null) fail(what + ': a drop nearest a filled box is moved into the neighbour');
  };

  /* --- 版面的小工具（畫板 px） --- */
  const rect = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const insideB = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  /* 375px 手機：.wrap 左右 20、.card padding 22 ＋ 邊框 1 → 畫板能用 375 − 40 − 46 = 289 → 縮 0.963 倍 */
  const PHONE = 289 / W;
  const touch = (w, h, what) => { if (Math.min(w, h) * PHONE < 44) fail(what + ' is ' + w + '×' + h + ' board px = ' + (Math.min(w, h) * PHONE).toFixed(1) + ' CSS px on a 375px phone (< 44)'); };
  touch(D.GPICK, D.GPICK, 'GPICK');

  /* ================= 頁面的遊戲引擎放進假的 DOM 裡跑 ================= */
  const dStart = src.indexOf('/* ---------- 語言無關的資料 ---------- */'), dEnd = src.indexOf('/* ---------- i18n ---------- */');
  const gStart = src.indexOf('/* ---------- 6. 小遊戲：'), gEnd = src.indexOf('/* ---------- 語言切換');
  if (dStart < 0 || dEnd < 0 || gStart < 0 || gEnd < 0) return fail('exec: cannot locate the data block / game engine in index.html');
  const ENGINE = src.slice(dStart, dEnd) + '\n' + src.slice(gStart, gEnd);
  function fakeDom(){
    const all = [];
    function el(tag){
      const o = { tag, style:{}, children:[], parent:null, _cls:new Set(), handlers:{}, attrs:{}, disabled:false, _t:'', _h:'', _q:{}, clientWidth:0 };
      Object.defineProperty(o, 'className', { get(){ return [...o._cls].join(' '); }, set(v){ o._cls = new Set(String(v).split(/\s+/).filter(Boolean)); } });
      o.classList = { add:c => o._cls.add(c), remove:c => o._cls.delete(c), contains:c => o._cls.has(c) };
      Object.defineProperty(o, 'textContent', { get(){ return o._t + o.children.map(c => c.textContent).join(''); },
        set(v){ o._t = String(v); o._h = ''; o._q = {}; o.children.forEach(c => { c.parent = null; c.removed = true; }); o.children = []; } });
      Object.defineProperty(o, 'innerHTML', { get(){ return o._h; },
        set(v){ o._h = String(v); o._t = o._h.replace(/<[^>]+>/g, ''); o._q = {}; o.children = []; } });
      o.appendChild = c => { c.parent = o; c.removed = false; o.children.push(c); return c; };
      o.remove = () => { if (o.parent) o.parent.children = o.parent.children.filter(x => x !== o); o.parent = null; o.removed = true; };
      o.addEventListener = (t, f) => { (o.handlers[t] = o.handlers[t] || []).push(f); };
      o.removeEventListener = (t, f) => { o.handlers[t] = (o.handlers[t] || []).filter(x => x !== f); };
      o.fire = (t, e) => { (o.handlers[t] || []).slice().forEach(f => f(Object.assign({ target:o, pointerId:7, preventDefault(){} }, e || {}))); };
      o.setAttribute = (k, v) => { o.attrs[k] = String(v); };
      o.getAttribute = k => o.attrs[k];
      o.setPointerCapture = () => {};
      o.getBoundingClientRect = () => ({ left:0, top:0 });
      const matches = (x, sel) => sel.split(',').map(s => s.trim()).some(s => s[0] === '.' && x._cls && x._cls.has(s.slice(1)));
      o.closest = sel => { let x = o; while (x){ if (matches(x, sel)) return x; x = x.parent; } return null; };
      o.querySelectorAll = sel => { const out = []; (function walk(x){ x.children.forEach(c => { if (matches(c, sel)) out.push(c); walk(c); }); })(o); return out; };
      o.querySelector = sel => {
        if (o._h && sel[0] === '.' && o._h.indexOf('class="' + sel.slice(1) + '"') >= 0){ if (!o._q[sel]){ o._q[sel] = el('span'); o._q[sel].parent = o; } return o._q[sel]; }
        return o.querySelectorAll(sel)[0] || null;
      };
      all.push(o);
      return o;
    }
    const ids = {};
    ['gRound', 'gScore', 'gameStage', 'gMsg', 'gNext', 'gRestart', 'gHintBtn', 'gHint'].forEach(k => { ids[k] = el('div'); });
    ids.gameStage.clientWidth = W;
    const document = { createElement:el, getElementById:k => ids[k], addEventListener(){}, removeEventListener(){} };
    /* window 的監聽要真的記下來：頁面靠 window 上的 pointerup 清掉 PIECE_PTR（按在積木上的那根手指），不清的話「點目的地」永遠被擋掉 */
    const win = { h:[], addEventListener(t, f, cap){ win.h.push({ t, f, cap:!!cap }); } };
    /* 照瀏覽器的順序送一個指標事件：pointerdown 先跑 window 的 capture，然後目標、一路往上冒泡，最後 window */
    const ev = (target, type, e) => {
      const E = Object.assign({ type, target, pointerId:7, clientX:0, clientY:0, preventDefault(){} }, e || {});
      if (type === 'pointerdown') win.h.filter(x => x.t === type && x.cap).forEach(x => x.f(E));
      for (let x = target; x; x = x.parent) (x.handlers[type] || []).slice().forEach(f => f(E));
      win.h.filter(x => x.t === type && !x.cap).forEach(x => x.f(E));
    };
    return { document, window:win, ids, all, ev };
  }
  /* 跑一關：pickIdx 是那一關從題庫抽第幾題（null ＝ 照頁面自己的亂數），rnd 是給 shuffle 用的亂數 */
  function EXEC(type, pickIdx, L, opts){
    opts = opts || {};
    const dom = fakeDom();
    const M = Object.assign(Object.create(Math), { random:opts.rnd || Math.random });
    const code = '"use strict";\nvar Math = __M;\n' + ENGINE + `
      var __LOG = { boards:[], pieces:[], miss:[], solved:[], buttons:[], lines:[] };
      var __mk = makeBoard; makeBoard = function(W, H){ var B = __mk(W, H); __LOG.boards.push(B); return B; };
      var __ap = addPiece; addPiece = function(B, o){ var P = __ap(B, o); __LOG.pieces.push(P); return P; };
      var __rm = roundMiss; roundMiss = function(t){ __LOG.miss.push(t); __rm(t); };
      var __rs = roundSolved; roundSolved = function(t){ __LOG.solved.push(t); __rs(t); };
      var __tl = trailLine; trailLine = function(t){ var p = __tl(t); __LOG.lines.push(p); return p; };
      var __ab = actionButton; actionButton = function(t, f){ var b = __ab(t, f); __LOG.buttons.push(b); return b; };
      var __pk = pick; pick = function(arr){ return __PICK === null ? __pk(arr) : arr[__PICK]; };
      gRound = GAME_ORDER.indexOf(__TYPE); startRound();
      return { LOG:__LOG, st:function(){ return { gScore:gScore, gMistakes:gMistakes, gSolved:gSolved, hintLevel:hintLevel }; },
               hint:function(){ gHintBtn.fire('click'); return elHint.textContent; }, msg:function(){ return gMsg.textContent + gMsg.innerHTML; },
               next:gNext };`;
    try {
      const r = new Function('__M', 'document', 'window', 'I18N', 'L', 'mode', '__PICK', '__TYPE', code)
        (M, dom.document, dom.window, I18N, () => I18N[L], opts.mode || 'school', pickIdx, type);
      r.dom = dom; r.B = r.LOG.boards[0]; r.line = r.LOG.lines[0];
      /* 放開／點目的地都走頁面自己的 tryDrop（useTapSelect 交給 B.onDrop 的那一個）；放開被退回時 end() 會把它放回原位 */
      /* 放開（拖拉）：走頁面自己的 tryDrop（useTapSelect 交給 B.onDrop 的那一個）；退回時 end() 會把它放回原位。
         點目的地：走真的事件 —— 先在積木上按下、放開（沒有移動 → 選起來），再在畫板上放開手指（→ B.onPointTap）。
         codex 第一輪：原本兩條路都直接呼叫 onDrop，onPointTap／onTap 壞掉也不會有人發現。 */
      r.select = P => { if (r.B.selected === P) return true; r.dom.ev(P.el, 'pointerdown', { clientX:P.cx, clientY:P.cy }); r.dom.ev(P.el, 'pointerup', { clientX:P.cx, clientY:P.cy }); return r.B.selected === P && P.el._cls.has('sel'); };
      r.drop = (P, x, y, tap) => {
        const m0 = r.LOG.miss.length;
        if (tap){
          if (!r.select(P)) fail('exec ' + type + ' ' + L + ': tapping a piece does not select it');
          const was = P.locked;
          r.dom.ev(r.B.el, 'pointerup', { clientX:x, clientY:y });
          if (r.B.selected === P && !P.el._cls.has('sel')) fail('exec ' + type + ' ' + L + ': selection and its outline disagree');
          return { got:!was && P.locked, said:r.LOG.miss.slice(m0) };
        }
        const got = r.B.onDrop(P, { x, y }); if (!got) P.home(); return { got:!!got, said:r.LOG.miss.slice(m0) };
      };
      return r;
    } catch (e){ fail('exec: the game engine could not run ' + type + ' in the stub DOM: ' + e.message + ' ' + (e.stack || '').split('\n')[1]); return null; }
  }
  const msgOf = r => { const m = r.dom.ids.gMsg; return plain(m.innerHTML || m.textContent); };

  /* 每一關一開始：畫板的大小、說明、提示、星星 */
  [['point', 'POINT_H'], ['sort', 'SORT_H'], ['roll', 'ROLL_H'], ['stack', 'STACK_H'], ['sticker', 'STICK_H']].forEach(([t, h]) => LANGS.forEach(L => {
    const r = EXEC(t, 0, L); if (!r) return;
    if (!(r.B && r.B.W === W && r.B.H === D[h])) fail('exec ' + t + ': the board is ' + (r.B && r.B.W) + ' × ' + (r.B && r.B.H) + ', should be ' + W + ' × ' + D[h]);
    const ask = r.dom.ids.gameStage.children[0];
    if (!ask || ask.textContent !== I18N[L].gAsks[t]) fail('exec ' + t + ' ' + L + ': the first line of the stage is not gAsks.' + t);
    if (r.dom.ids.gHint.textContent !== '') fail('exec ' + t + ' ' + L + ': a hint is shown before asking (school mode)');
    const h1 = r.hint(), h2 = r.hint();
    if (h1 !== I18N[L].gHints[t]) fail('exec ' + t + ' ' + L + ': hint level 1 is not gHints.' + t);
    if (!(h2.indexOf(h1) === 0 && h2.length > h1.length + 8) || /undefined|NaN/.test(h2)) fail('exec ' + t + ' ' + L + ': hint level 2 adds nothing: ' + h2);
    if (!r.dom.ids.gHintBtn.disabled) fail('exec ' + t + ' ' + L + ': the hint button stays enabled after level 2');
    const ra = EXEC(t, 0, L, { mode:'ahead' });
    if (ra && ra.dom.ids.gHint.textContent !== I18N[L].gHints[t]) fail('exec ' + t + ' ' + L + ': ahead mode does not show hint level 1 by itself');
  }));

  /* ---------- 第 1 關：點一點 ---------- */
  /* 自己的長方體：前面那一面是軸對齊的長方形，後面那一面是它平移 (dx, −dy)；看不到的頂點 ＝ 落在前面那一面「裡面」的那一個後面頂點 */
  const inPolyOwn = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){ if (((poly[i][1] > p.y) !== (poly[j][1] > p.y)) && (p.x < (poly[j][0] - poly[i][0]) * (p.y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c; } return c; };
  const segOwn = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1]; let t = ((p.x - a[0]) * vx + (p.y - a[1]) * vy) / (vx * vx + vy * vy); t = Math.max(0, Math.min(1, t)); return Math.hypot(a[0] + t * vx - p.x, a[1] + t * vy - p.y); };
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  const POOLS = new Set();
  D.GAME_POINT.forEach((e, pi) => {
    const w = 'point[' + pi + ']';
    if (['cube', 'cuboid'].indexOf(e.s) < 0) return fail(w + ': only a cube or a cuboid has corners to find, got ' + e.s);
    if (e.dir !== 1 && e.dir !== -1) return fail(w + ': dir must be 1 or −1');
    POOLS.add(e.s + e.dir);
    const g = D.pointGeom(e.s, e.dir), c = g.corners;
    if (c.length !== 8 || g.edges.length !== 12 || g.faces.length !== 3) return fail(w + ': ' + c.length + ' corners, ' + g.edges.length + ' edges, ' + g.faces.length + ' faces');
    const front = [c[0], c[1], c[2], c[3]], back = [c[4], c[5], c[6], c[7]];
    const fw = c[1][0] - c[0][0], fh = c[0][1] - c[3][1];
    if (!(c[0][1] === c[1][1] && c[2][1] === c[3][1] && c[0][0] === c[3][0] && c[1][0] === c[2][0] && fw > 0 && fh > 0)) fail(w + ': the front face is not an upright rectangle');
    if ((e.s === 'cube') !== (fw === fh)) fail(w + ': a ' + e.s + ' drawn with a ' + fw + '×' + fh + ' front face');
    const tdx = c[4][0] - c[0][0], tdy = c[4][1] - c[0][1];
    if (!back.every((p, i) => same(p, [front[i][0] + tdx, front[i][1] + tdy])) || !(tdy < 0) || Math.sign(tdx) !== e.dir) fail(w + ': the back face is not the front face pushed back (dx ' + tdx + ', dy ' + tdy + ', dir ' + e.dir + ')');
    /* 自己找看不到的那一個頂點 */
    const hidOwn = [4, 5, 6, 7].filter(i => inPolyOwn({ x:c[i][0], y:c[i][1] }, front));
    if (hidOwn.length !== 1) return fail(w + ': ' + hidOwn.length + ' back corners fall inside the front face');
    const hid = hidOwn[0];
    if (g.hiddenCorner.filter(Boolean).length !== 1 || !g.hiddenCorner[hid]) fail(w + ': the page hides corner ' + g.hiddenCorner.indexOf(true) + ', the hidden one is ' + hid);
    const BOX = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    const key = (a, b) => Math.min(a, b) + '-' + Math.max(a, b);
    if (g.edges.map(x => key(x[0], x[1])).sort().join() !== BOX.map(x => key(x[0], x[1])).sort().join()) fail(w + ': the 12 edges are not the edges of a box');
    g.edges.forEach(x => { if (!!x[2] !== (x[0] === hid || x[1] === hid)) fail(w + ': edge ' + key(x[0], x[1]) + ' is drawn ' + (x[2] ? 'dashed' : 'solid') + ' but it ' + (x[2] ? 'does not touch' : 'touches') + ' the hidden corner'); });
    /* 看得到的三個面 ＝ 長方體的六個面裡不碰到那個頂點的三個 */
    const SIX = [[0, 1, 2, 3], [4, 5, 6, 7], [3, 2, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [0, 3, 7, 4]];
    const visOwn = SIX.filter(f => f.indexOf(hid) < 0).map(f => f.map(i => c[i]));
    const fkey = f => f.map(p => p.join(',')).sort().join(';');
    if (g.faces.map(fkey).sort().join('|') !== visOwn.map(fkey).sort().join('|')) fail(w + ': the three drawn faces are not the three you can see');
    /* 每一個頂點都在畫板裡、標籤下面；兩兩至少隔 2 × POINT_CORNER（拿取範圍不重疊） */
    c.forEach((p, i) => insideB(rect(p[0], p[1], 2 * D.POINT_CORNER, 2 * D.POINT_CORNER), w + ' corner ' + i + ' reach', D.POINT_H));
    /* 題目那一行要放得下兩行 18px 的字，而且每一個頂點的拿取範圍（也就蓋過點到之後的標記）都在它下面 */
    if (D.POINT_TOP - 6 - 4 < Math.ceil(2 * 18 * 1.2)) fail(w + ': the task label (' + (D.POINT_TOP - 6) + 'px) cannot hold two lines');
    if (Math.min.apply(null, c.map(p => p[1])) - D.POINT_CORNER < D.POINT_TOP) fail(w + ': the top corners sit under the task label');
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if (Math.hypot(c[i][0] - c[j][0], c[i][1] - c[j][1]) < 2 * D.POINT_CORNER) fail(w + ': corners ' + i + ' and ' + j + ' are closer than two reaches');
    touch(2 * D.POINT_CORNER, 2 * D.POINT_CORNER, w + ' corner reach');
    /* 畫出來的就是這些：三個面（polygon）、三條虛線（看不到的邊），沒有別的線 */
    const svg = D.pointSVG(g, {});
    const polys = [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].split(' ').map(q => q.split(',').map(Number)));
    if (polys.map(fkey).sort().join('|') !== visOwn.map(fkey).sort().join('|')) fail(w + ': pointSVG draws other faces than the visible three');
    const lines = (svg.match(/<line [^>]*>/g) || []);
    const dashedOwn = BOX.filter(x => x[0] === hid || x[1] === hid);
    if (lines.length !== 3 || !lines.every(l => /stroke-dasharray/.test(l))) fail(w + ': pointSVG should draw exactly the 3 hidden edges as dashed lines (' + lines.length + ')');
    lines.forEach(l => {
      const v = ['x1', 'y1', 'x2', 'y2'].map(k => Number((l.match(new RegExp('\\s' + k + '="([-\\d.]+)"')) || [])[1]));
      if (!dashedOwn.some(x => (same(c[x[0]], [v[0], v[1]]) && same(c[x[1]], [v[2], v[3]])) || (same(c[x[1]], [v[0], v[1]]) && same(c[x[0]], [v[2], v[3]])))) fail(w + ': a dashed line ' + v.join(',') + ' is not a hidden edge');
    });
    if (/<circle/.test(svg)) fail(w + ': pointSVG marks a corner before anything is found');
    const svgAll = D.pointSVG(g, { 0:1, 1:2, 2:3, 3:4, 4:5, 5:6, 6:7, 7:8 });
    if ((svgAll.match(/<circle/g) || []).length !== 8 || !/>8<\/text>/.test(svgAll)) fail(w + ': found corners are not all marked and numbered');
    /* 每一個 1px 格點：自己分類 vs 頁面的 pointHit() */
    let bad = 0, firstBad = '', counts = { vert:0, edge:0, face:0, none:0 };
    for (let y = 0; y <= D.POINT_H; y++) for (let x = 0; x <= W; x++){
      const p = { x, y };
      let kc = -1, dc = Infinity;
      c.forEach((q, i) => { const dd = Math.hypot(q[0] - x, q[1] - y); if (dd < dc){ dc = dd; kc = i; } });
      let want;
      if (dc <= D.POINT_CORNER) want = 'vert' + kc;
      else if (Math.min.apply(null, BOX.map(b => segOwn(p, c[b[0]], c[b[1]]))) <= D.POINT_EDGE) want = 'edge';
      else if (visOwn.some(f => inPolyOwn(p, f))) want = 'face';
      else want = 'none';
      const h = D.pointHit(g, p), got = h ? h.kind + (h.kind === 'vert' ? h.k : '') : 'none';
      counts[want.replace(/\d/, '')]++;
      if (got !== want){ bad++; if (!firstBad) firstBad = x + ',' + y + ' page ' + got + ' own ' + want; }
    }
    if (bad) fail(w + ': pointHit() disagrees with the picture at ' + bad + ' points (' + firstBad + ')');
    if (!(counts.face > 200)) fail(w + ': almost no face area left to tap (' + counts.face + ' px) — a face tap can never be told apart');

    LANGS.forEach(L => {
      const d = I18N[L], si = IDX[e.s], wl = w + ' ' + L;
      if (d.gPointTask(si).indexOf(own(e.s)[L].name) < 0 || /\d/.test(d.gPointTask(si))) fail(wl + ': the task should name the ' + e.s + ' and give no number: ' + d.gPointTask(si));
      seq(wl + ' gPointDone', d.gPointDone(si, 8), [8]); has(wl + ' gPointDone', d.gPointDone(si, 8), nameRe(L, e.s));
      if (own(e.s).vert !== 8) fail(wl + ': the round says 8 corners, the truth table says ' + own(e.s).vert);
      [[8, 1], [3, 1], [1, 1], [1, 0], [5, 0]].forEach(([l, h]) => {
        seq(wl + ' gPoint2(' + l + ',' + h + ')', d.gPoint2(l, h), h ? [l, h] : [l]);
        if (L === 'en'){ const pb = enPluralProblem(wl + ' gPoint2', d.gPoint2(l, h)); if (pb) fail(pb); }
      });
      /* codex 第一輪：英文「— 1 of them where …」少了動詞 */
      if (L === 'en' && !/ 1 of them is where /.test(d.gPoint2(3, 1))) fail(wl + ': gPoint2 en with a hidden corner left is not a sentence: ' + d.gPoint2(3, 1));
      [0, 1, 2, 8].forEach(n => { seq(wl + ' gPointNow(' + n + ')', d.gPointNow(n), [n]); if (L === 'en'){ const pb = enPluralProblem(wl + ' gPointNow', d.gPointNow(n)); if (pb) fail(pb); } });
      has(wl + ' gPointEdge', d.gPointEdge, L === 'zh' ? /邊/ : /edge/); has(wl + ' gPointFace', d.gPointFace, L === 'zh' ? /面/ : /face/);
      /* 跑起來：錯的點、空白、點過的再點、最後點齊 */
      const order = [0, 1, 2, 3, 4, 5, 6, 7].sort((a, b) => (a === hid) - (b === hid) || ((a * 5 + pi) % 8) - ((b * 5 + pi) % 8));
      [0, 1].forEach(withMiss => {
        const r = EXEC('point', pi, L); if (!r) return;
        const click = (x, y) => { r.B.el.fire('pointerdown', { clientX:x, clientY:y }); r.B.el.fire('click', { clientX:x, clientY:y }); };
        if (r.line.textContent !== d.gPointNow(0) || r.LOG.boards.length !== 1) fail(wl + ': the line should start at 0 found');
        if (r.LOG.boards[0].el.children.filter(z => z._cls.has('gorder'))[0].textContent !== d.gPointTask(si)) fail(wl + ': the board does not show the task');
        click(2, D.POINT_H - 2);
        if (r.LOG.miss.length || r.st().gSolved) fail(wl + ': a tap on empty space is not silent');
        /* codex 第一輪：按在空白處、拖到頂點上才放開 —— 那不是「點」，不算找到 */
        r.B.el.fire('pointerdown', { clientX:2, clientY:D.POINT_H - 2 }); r.B.el.fire('click', { clientX:c[0][0], clientY:c[0][1] });
        if (r.line.textContent !== d.gPointNow(0)) fail(wl + ': a drag that ends on a corner counts as finding it');
        /* codex 第二輪：斜著滑 8、8（直線 11.3 > POINT_SLIP）也不是點；直著 9 以內才是 */
        r.B.el.fire('pointerdown', { clientX:c[0][0] - 8, clientY:c[0][1] - 8 }); r.B.el.fire('click', { clientX:c[0][0], clientY:c[0][1] });
        if (r.line.textContent !== d.gPointNow(0)) fail(wl + ': a diagonal slide of 8, 8 px onto a corner counts as a tap');
        if (Math.hypot(8, 8) <= D.POINT_SLIP || D.POINT_SLIP < 6 || D.POINT_SLIP > 12) fail(wl + ': POINT_SLIP ' + D.POINT_SLIP + ' is not a small-wobble threshold');
        if (withMiss){
          const e0 = BOX[0], mid = [(c[e0[0]][0] + c[e0[1]][0]) / 2, (c[e0[0]][1] + c[e0[1]][1]) / 2];
          click(mid[0], mid[1]);
          if (r.LOG.miss.join('|') !== d.gPointEdge) fail(wl + ': a tap in the middle of an edge should say gPointEdge, said ' + JSON.stringify(r.LOG.miss));
          const fc = [(c[0][0] + c[1][0]) / 2 + (e.dir > 0 ? 24 : -24), c[3][1] + 22];
          if (D.pointHit(g, { x:fc[0], y:fc[1] }) && D.pointHit(g, { x:fc[0], y:fc[1] }).kind === 'face'){
            click(fc[0], fc[1]);
            if (r.LOG.miss.slice(1).join('|') !== d.gPointFace) fail(wl + ': a tap on a face should say gPointFace');
          } else fail(wl + ': no face spot at ' + fc.join(','));
        }
        order.forEach((k, j) => {
          click(c[k][0] + (j % 2 ? 9 : -9), c[k][1] + (j % 3 ? 7 : -7));
          if (r.line.textContent !== d.gPointNow(j + 1)) fail(wl + ': after ' + (j + 1) + ' corners the line reads ' + r.line.textContent);
          if (j === 0){ click(c[k][0], c[k][1]); if (r.line.textContent !== d.gPointNow(1) || r.LOG.miss.length > (withMiss ? 2 : 0)) fail(wl + ': tapping a found corner again changes something'); }
          if (j < 7 && r.st().gSolved) fail(wl + ': solved after only ' + (j + 1) + ' corners');
        });
        const st = r.st();
        if (!st.gSolved || r.LOG.solved.join() !== d.gPointDone(si, 8)) fail(wl + ': all 8 corners found but the round is not solved with gPointDone');
        if (st.gScore !== (withMiss ? 1 : 2)) fail(wl + ': ' + (withMiss ? 'after mistakes' : 'clean') + ' the round gives ' + st.gScore + ' stars');
        if (r.next.disabled) fail(wl + ': Next stays disabled after solving');
      });
    });
  });
  if (POOLS.size !== 4) fail('GAME_POINT should hold the cube and the cuboid, each drawn both ways (' + [...POOLS].join() + ')');

  /* ---------- 第 2 關：分一分 ---------- */
  const flatsOwn = [...new Set(T.map(s => s.flat))].sort((a, b) => a - b);
  if (D.SORT_VALUES.join() !== flatsOwn.join()) fail('SORT_VALUES should be ' + flatsOwn.join() + ' (every flat-face count of the five solids), got ' + D.SORT_VALUES.join());
  {
    const S = D.SORT_BIN, C = D.SORT_CARD;
    const bins = D.SORT_VALUES.map((v, k) => ({ cx:D.sortBinX(k), cy:S.y + S.h / 2, hw:S.w / 2, hh:S.h / 2, done:false }));
    bins.forEach((b, k) => insideB(rect(b.cx, b.cy, S.w, S.h), 'sort box ' + k, D.SORT_H));
    noHits(bins.map(b => rect(b.cx, b.cy, S.w, S.h)), 'sort boxes');
    D.SORT_VALUES.forEach((v, k) => {
      const many = T.filter(s => s.flat === v).length;
      if (S.top + many * (S.placedH + 4) > S.h) fail('sort box "' + v + '" must hold ' + many + ' placed cards, it is only ' + S.h + ' tall');
    });
    const x0 = (W - 4 * C.step) / 2, cards = [0, 1, 2, 3, 4].map(j => rect(x0 + j * C.step, C.y, C.w, C.h));
    cards.forEach((r, j) => insideB(r, 'sort card ' + j, D.SORT_H)); noHits(cards, 'sort cards');
    if (cards[0].y < S.y + S.h + D.GPAD) fail('sort cards sit inside the boxes\' reach');
    touch(C.w, C.h, 'sort card');
    sweep('sort boxes', bins, S.y + S.h / 2, D.GPAD);
  }
  LANGS.forEach(L => {
    const d = I18N[L], wl = 'sort ' + L;
    T.forEach((s, i) => {
      const why = d.gFlatWhy[i];
      if (s.flat > 0 && nums(why).indexOf(s.flat) < 0) fail(wl + ': gFlatWhy[' + i + '] never says ' + s.flat);
      if (s.flat === 0 && !(L === 'zh' ? /沒有/ : /no flat face/).test(why)) fail(wl + ': gFlatWhy for the sphere must say it has no flat face');
      if (s.curved && !(L === 'zh' ? /彎彎/ : /curved/).test(why)) fail(wl + ': gFlatWhy[' + i + '] must say the curved face does not count');
      if (nums(why).some(n => n !== s.flat)) fail(wl + ': gFlatWhy[' + i + '] prints a number other than ' + s.flat + ': ' + why);
      D.SORT_VALUES.forEach(v => { if (v !== s.flat) seq(wl + ' gSortWrong(' + s.id + ',' + v + ')', d.gSortWrong(i, v), s.flat ? [v, s.flat] : [v]); });
      seq(wl + ' gSort2(' + s.id + ')', d.gSort2(i), s.flat ? [s.flat] : []);
    });
    D.SORT_VALUES.forEach(v => seq(wl + ' gSortBin', d.gSortBin(v), [v]));
    /* 結語：每一個名字後面的第一個數字就是它的平平的面 */
    const done = plain(d.gSortDone);
    T.forEach(s => { const m = done.match(new RegExp(s[L].name + '[^\\d]*?(\\d+)', 'i')); if (!m || +m[1] !== s.flat) fail(wl + ': gSortDone pairs the ' + s.id + ' with ' + (m && m[1])); });
    [0, 1, 5].forEach(n => seq(wl + ' gSortNow', d.gSortNow(n), [n, 5]));
    /* 跑起來：每一張卡 × 每一格 */
    T.forEach((s, i) => D.SORT_VALUES.forEach((v, k) => {
      const r = EXEC('sort', null, L); if (!r) return;
      const P = r.LOG.pieces.filter(p => p.data.si === i)[0];
      if (!P) return fail(wl + ': no card for the ' + s.id);
      const res = r.drop(P, D.sortBinX(k), D.SORT_BIN.y + D.SORT_BIN.h / 2, (i + k) % 2 === 1);
      if (res.got !== (s.flat === v)) fail(wl + ': the ' + s.id + ' dropped in "' + v + '" was ' + (res.got ? 'accepted' : 'refused') + ((i + k) % 2 ? ' (tap-then-tap)' : ''));
      if (!res.got && res.said.join() !== d.gSortWrong(i, v)) fail(wl + ': the ' + s.id + ' in "' + v + '" should say gSortWrong, said ' + JSON.stringify(res.said));
      if (res.got && !(P.locked && Math.abs(P.cx - D.sortBinX(k)) < 1e-9 && P.cy > D.SORT_BIN.y && P.cy < D.SORT_BIN.y + D.SORT_BIN.h)) fail(wl + ': the ' + s.id + ' is not locked inside box ' + v);
      if (r.st().gScore !== 0) fail(wl + ': a drop changes the stars');
    }));
    /* 照真值表放完 → 過關；放進 6 的兩張不疊在一起；空白處不算錯；托盤的卡就是那五個 */
    [0, 1].forEach(withMiss => {
      const r = EXEC('sort', null, L); if (!r) return;
      const ps = r.LOG.pieces;
      if (ps.map(p => p.data.si).sort().join() !== '0,1,2,3,4') fail(wl + ': the tray does not hold the five solids');
      ps.forEach(p => { const id = T[p.data.si].id; if (p.el.innerHTML !== D.pieceSVG(id, D.ROLL_START[id] || 'stand') + '<span class="gname">' + own(id)[L].name + '</span>') fail(wl + ': card ' + id + ' does not draw its own solid with its own name'); });
      const tray = ps.slice().sort((a, b) => a.homeX - b.homeX).map(p => T[p.data.si].flat);
      if (tray.every((v, j) => j === 0 || tray[j - 1] <= v)) fail(wl + ': the tray starts in flat-face order ' + tray.join(','));
      if (r.drop(ps[0], W / 2, D.SORT_BIN.y + D.SORT_BIN.h + 10).said.length) fail(wl + ': a drop under the boxes is not silent');
      if (withMiss){ const p = ps.filter(q => T[q.data.si].flat !== 6)[0]; r.drop(p, D.sortBinX(3), D.SORT_BIN.y + 60); }
      ps.forEach(p => r.drop(p, D.sortBinX(D.SORT_VALUES.indexOf(T[p.data.si].flat)), D.SORT_BIN.y + 60));
      const placed = ps.map(p => rect(p.cx, p.cy, p.w, p.h));
      noHits(placed, wl + ' placed cards');
      placed.forEach((q, j) => { const k = D.SORT_VALUES.indexOf(T[ps[j].data.si].flat), b = rect(D.sortBinX(k), D.SORT_BIN.y + D.SORT_BIN.h / 2, D.SORT_BIN.w, D.SORT_BIN.h); if (!(q.x >= b.x && q.y >= b.y && q.x + q.w <= b.x + b.w && q.y + q.h <= b.y + b.h)) fail(wl + ': a placed card sticks out of its box'); });
      if (!r.st().gSolved || r.LOG.solved.join() !== d.gSortDone || r.st().gScore !== (withMiss ? 1 : 2)) fail(wl + ': sorting all five does not solve the round with the right stars');
      if (r.line.textContent !== d.gSortNow(5)) fail(wl + ': the line reads ' + r.line.textContent);
    });
  });

  /* ---------- 第 3 關：滾一滾 ---------- */
  if (!D.GAME_ROLL.length || !D.GAME_ROLL.every(id => own(id) && !own(id).rolls)) fail('GAME_ROLL must list blocks that never roll (cube / cuboid), got ' + D.GAME_ROLL.join());
  /* codex 第一輪：兩種方塊都要真的當過這一關的方塊（重複或少一種，另一種就從來沒被跑過） */
  if (D.GAME_ROLL.slice().sort().join() !== 'cube,cuboid') fail('GAME_ROLL should be exactly the cube and the cuboid, got ' + D.GAME_ROLL.join());
  if (D.ROLL_START.cyl !== 'stand') fail('roll: the cylinder must start standing — otherwise the "lay it down" rule is never reached');
  /* 自己的「推了會不會滾」：碰到桌子的是彎彎的面才滾。圓柱躺下來是彎彎的面碰桌子；球怎麼放都是；方塊永遠是平平的面 */
  const rollsOwn = (id, turns) => id === 'ball' || (id === 'cyl' && turns % 2 === 1);
  ['cube', 'cuboid', 'cyl', 'ball'].forEach(id => {
    let o = D.ROLL_START[id];
    for (let t = 0; t < 4; t++){
      if (D.rollsOnTable(id, o) !== rollsOwn(id, t)) fail('roll: rollsOnTable(' + id + ', ' + o + ') after ' + t + ' turns is ' + D.rollsOnTable(id, o));
      if ((D.downFace(id, o) === 'curved') !== rollsOwn(id, t)) fail('roll: downFace(' + id + ', ' + o + ') is ' + D.downFace(id, o));
      /* 畫出來的擺法：圓柱站著時兩個圓是橫的（rx > ry），躺著時是直的；長方體立起來時比較高 */
      const sv = D.pieceSVG(id, o), el = (sv.match(/rx="([\d.]+)" ry="([\d.]+)"/) || []).slice(1).map(Number);
      if (id === 'cyl' && ((el[0] > el[1]) === (t % 2 === 1))) fail('roll: the cylinder after ' + t + ' turns is drawn ' + (el[0] > el[1] ? 'standing' : 'lying'));
      /* 驗證者抓到：躺著的圓柱畫成側面（軸沿著滾道），往 🚩 推是順著軸推，會滑不會滾。從畫出來的兩個端面讀：
         端面要是正圓（朝向我們）、兩個端面的圓心距離比半徑短（軸往畫面裡面），而且圓心水平方向的位移不到半徑的 0.6 倍、也比上下的位移小（codex：兩個正圓左右錯開 16、上下不動，軸還是沿著滾道）。 */
      if (id === 'cyl' && t % 2 === 1){
        const E = [...sv.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
        if (E.length !== 2 || E.some(q => q[2] !== q[3]) || Math.hypot(E[0][0] - E[1][0], E[0][1] - E[1][1]) >= E[0][2] || Math.abs(E[0][0] - E[1][0]) >= E[0][2] * 0.6 || Math.abs(E[0][0] - E[1][0]) >= Math.abs(E[0][1] - E[1][1]))
          fail('roll: the lying cylinder is not drawn end-on — its axis runs along the track, so a push would slide it, not roll it (' + JSON.stringify(E) + ')');
      }
      o = D.turnOf(id, o);
    }
    if (D.turnOf(id, D.turnOf(id, D.ROLL_START[id])) !== D.ROLL_START[id]) fail('roll: two turns do not bring the ' + id + ' back');
  });
  {
    const R = D.ROLL_PIECE, Tn = D.ROLL_TURN, Ln = D.ROLL_LANE;
    const pcs = R.xs.map(x => rect(x, R.y, R.w, R.h)), tbs = R.xs.map(x => rect(x, Tn.y, Tn.size, Tn.size));
    pcs.concat(tbs).forEach((q, j) => insideB(q, 'roll piece/turn ' + j, D.ROLL_H)); noHits(pcs.concat(tbs), 'roll pieces and turn buttons');
    const lane = { x:Ln.x, y:Ln.y, w:Ln.w, h:Ln.h }; insideB(lane, 'roll track', D.ROLL_H);
    if (pcs.concat(tbs).some(q => hit(q, { x:lane.x - D.GPAD, y:lane.y - D.GPAD, w:lane.w + 2 * D.GPAD, h:lane.h + 2 * D.GPAD }))) fail('roll: a tray piece or 🔄 sits inside the track\'s reach');
    touch(R.w, R.h, 'roll piece'); touch(Tn.size, Tn.size, 'roll 🔄');
    const spots = Ln.spots.map(x => rect(x, Ln.y + Ln.h / 2 + 4, R.placedW, R.placedH));
    spots.forEach(q => { if (!(q.x >= lane.x && q.x + q.w <= lane.x + lane.w && q.y >= lane.y && q.y + q.h <= lane.y + lane.h)) fail('roll: a rolled spot is outside the track'); });
    noHits(spots, 'roll rolled spots');
  }
  LANGS.forEach(L => {
    const d = I18N[L], wl = 'roll ' + L;
    has(wl + ' gRollStand', d.gRollStand, /🔄/); has(wl + ' gRollStand', d.gRollStand, L === 'zh' ? /平平的面/ : /flat face/);
    /* codex 第一輪：平平的面貼著桌子被推，可能滑、也可能倒 —— 說明只可以斷定「不會滾」，不可以只講其中一種結果 */
    [d.gRollStand].concat(D.GAME_ROLL.map(b => d.gRollBlock(IDX[b]))).forEach(x => {
      if (!(L === 'zh' ? /滑/.test(x) && /倒/.test(x) : /slide/.test(x) && /tip/.test(x))) fail(wl + ': a refused push must allow both sliding and tipping over — ' + plain(x));
      if (L === 'zh' ? /只會滑|一定會倒/.test(x) : /only slides|always tips/.test(x)) fail(wl + ': a refused push claims a single outcome — ' + plain(x));
    });
    D.GAME_ROLL.forEach(b => { has(wl + ' gRollBlock', d.gRollBlock(IDX[b]), L === 'zh' ? /只有平平的面/ : /only flat faces/); has(wl + ' gRollBlock', d.gRollBlock(IDX[b]), nameRe(L, b)); has(wl + ' gRollDone', d.gRollDone(IDX[b]), nameRe(L, b)); });
    ['cylStand', 'cylLie', 'ball'].forEach(k => { if (!(typeof d.gRoll2[k] === 'string' && d.gRoll2[k].length > 10)) fail(wl + ': gRoll2.' + k + ' missing'); });
    D.GAME_ROLL.forEach((blk, bi) => {
      /* 每一個形體 × 轉 0～3 次 × 拖或點 */
      ['cube', 'cuboid', 'cyl', 'ball'].filter(id => id === blk || id === 'cyl' || id === 'ball').forEach(id => [0, 1, 2, 3].forEach(turns => [false, true].forEach(tap => {
        const r = EXEC('roll', bi, L); if (!r) return;
        const P = r.LOG.pieces.filter(p => p.data.id === id)[0];
        if (!P) return fail(wl + ': no ' + id + ' on the board');
        if (r.LOG.pieces.length !== 3 || r.LOG.pieces.some(p => p.data.id === 'cone')) fail(wl + ': the round must hold the block, the cylinder and the sphere only');
        if (P.el.innerHTML !== D.pieceSVG(id, D.ROLL_START[id])) fail(wl + ': the ' + id + ' is not drawn in its starting pose');
        const tb = P.turnBtn;
        if (!tb || Math.abs(parseFloat(tb.style.left) + D.ROLL_TURN.size / 2 - P.cx) > 1e-9) return fail(wl + ': the ' + id + ' has no 🔄 under it');
        for (let t = 0; t < turns; t++){
          tb.fire('click');
          const face = rollsOwn(id, t + 1) ? 'curved' : 'flat';
          if (r.line.textContent !== d.gRollTurn(IDX[id], face)) fail(wl + ': after turning the ' + id + ' the line reads ' + r.line.textContent);
          if (P.el.innerHTML !== D.pieceSVG(id, P.data.o)) fail(wl + ': the ' + id + ' is not redrawn after 🔄');
        }
        const res = r.drop(P, D.ROLL_LANE.x + D.ROLL_LANE.w / 2, D.ROLL_LANE.y + D.ROLL_LANE.h / 2, tap);
        const want = rollsOwn(id, turns);
        if (res.got !== want) fail(wl + ': the ' + id + ' after ' + turns + ' turns was ' + (res.got ? 'accepted' : 'refused') + (tap ? ' (tap-then-tap)' : ''));
        if (!want){
          const say = id === 'cyl' ? d.gRollStand : d.gRollBlock(IDX[id]);
          if (res.said.join() !== say) fail(wl + ': the ' + id + ' after ' + turns + ' turns should say ' + say + ', said ' + JSON.stringify(res.said));
        } else {
          if (!tb.disabled) fail(wl + ': the rolled ' + id + ' can still be turned');
          tb.fire('click');
          if (P.data.o !== (id === 'cyl' ? (turns % 2 ? 'lie' : 'stand') : P.data.o)) fail(wl + ': a rolled piece changed pose');
        }
      })));
      /* 推到滾道外面 → 不算；兩個都滾到才過關；方塊留在原地 */
      [0, 1].forEach(withMiss => {
        const r = EXEC('roll', bi, L); if (!r) return;
        const P = id => r.LOG.pieces.filter(p => p.data.id === id)[0];
        if (r.drop(P('ball'), W / 2, D.ROLL_TURN.y).said.length || P('ball').locked) fail(wl + ': a drop on the 🔄 row is not silent');
        if (withMiss) r.drop(P(blk), 150, 260);
        const ly = D.ROLL_LANE.y + D.ROLL_LANE.h / 2;
        r.drop(P('ball'), 150, ly);
        if (r.st().gSolved) fail(wl + ': solved with only the sphere rolled');
        if (r.line.textContent !== d.gRolled(IDX.ball)) fail(wl + ': after the sphere rolled the line reads ' + r.line.textContent);
        P('cyl').turnBtn.fire('click'); r.drop(P('cyl'), 60, ly);
        if (!r.st().gSolved || r.LOG.solved.join() !== d.gRollDone(IDX[blk]) || r.st().gScore !== (withMiss ? 1 : 2)) fail(wl + ': rolling the cylinder and the sphere does not solve the round with the right stars');
        if (P(blk).locked) fail(wl + ': the block got onto the track');
        noHits(r.LOG.pieces.filter(p => p.locked).map(p => rect(p.cx, p.cy, p.w, p.h)), wl + ' rolled pieces');
      });
    });
    /* 第二層提示跟著畫面走：站著 → 先轉；躺著 → 推；圓柱滾了 → 推球 */
    const r = EXEC('roll', 0, L);
    if (r){
      r.hint(); if (r.hint().indexOf(d.gRoll2.cylStand) < 0) fail(wl + ': hint level 2 should tell to lay the standing cylinder down');
      const cyl = r.LOG.pieces.filter(p => p.data.id === 'cyl')[0]; cyl.turnBtn.fire('click');
      if (r.dom.ids.gHint.textContent.indexOf(d.gRoll2.cylLie) < 0) fail(wl + ': hint level 2 is not refreshed after 🔄');
      r.drop(cyl, 150, D.ROLL_LANE.y + 40);
      if (r.dom.ids.gHint.textContent.indexOf(d.gRoll2.ball) < 0) fail(wl + ': hint level 2 does not move on to the sphere');
    }
  });

  /* ---------- 第 4 關：疊一疊 ---------- */
  {
    const Cc = D.STACK_CELL, Pc = D.STACK_PIECE;
    for (let k = 0; k < D.STACK_LEVELS; k++){
      const y = D.stackLevelY(k);
      if (Math.abs(y - (D.STACK_TABLE - Cc.h / 2 - k * Cc.h)) > 1e-9) fail('stack: level ' + (k + 1) + ' does not sit right on top of the one below');
      insideB(rect(D.STACK_X, y, Cc.w, Cc.h), 'stack level ' + (k + 1), D.STACK_H);
    }
    if (D.STACK_LEVELS !== 4) fail('stack: the tower should be 4 levels (three flat-topped solids + the cone)');
    const tray = D.STACK_TRAY.map(p => rect(p[0], p[1], Pc.w, Pc.h));
    tray.forEach((q, j) => insideB(q, 'stack tray ' + j, D.STACK_H)); noHits(tray, 'stack tray pieces');
    const tower = { x:D.STACK_X - Cc.w / 2 - D.GPAD, y:D.stackLevelY(D.STACK_LEVELS - 1) - Cc.h / 2 - D.GPAD, w:Cc.w + 2 * D.GPAD, h:D.STACK_LEVELS * Cc.h + 2 * D.GPAD };
    if (tray.some(q => hit(q, tower))) fail('stack: a tray piece sits inside the tower\'s reach');
    touch(Pc.w, Pc.h, 'stack piece');
    /* 自己的規則：最上面那一層只要下面平（stable）；下面三層還要上面平（stackTop） */
    const okOwn = (id, level) => own(id).flat > 0 && (level === D.STACK_LEVELS - 1 || own(id).stackTop);
    SID.forEach(id => { for (let k = 0; k < D.STACK_LEVELS; k++) if ((D.stackWhy(id, k) === null) !== okOwn(id, k)) fail('stack: stackWhy(' + id + ', ' + k + ') is ' + D.stackWhy(id, k)); });
    LANGS.forEach(L => {
      const d = I18N[L], wl = 'stack ' + L;
      has(wl + ' gStackFloat', d.gStackFloat, L === 'zh' ? /一層一層/ : /one level at a time/);
      has(wl + ' gStackBall', d.gStackBall, L === 'zh' ? /沒有平平的面/ : /no flat face/); has(wl + ' gStackCone', d.gStackCone, L === 'zh' ? /尖尖/ : /pointy/);
      [0, 1, 2, 3].forEach(k => seq(wl + ' gStack2(' + k + ')', d.gStack2(k), k < 3 ? [k + 1] : []));
      [0, 2, 4].forEach(n => seq(wl + ' gStackNow', d.gStackNow(n), [n, 4]));
      ['cube', 'cuboid', 'cyl', 'cone', 'ball'].forEach(id => has(wl + ' gStackDone', d.gStackDone, nameRe(L, id)));
      /* 所有放法走完：每一層試五個，收的就往下走 */
      let finished = 0, branches = 0;
      const walk = (prefix) => {
        if (branches > 4000) return;
        const level = prefix.length;
        SID.forEach(id => {
          if (prefix.indexOf(id) >= 0) return;
          branches++;
          const r = EXEC('stack', null, L); if (!r) return;
          const P = x => r.LOG.pieces.filter(p => p.data.id === x)[0];
          const cy = k => D.stackLevelY(k);
          prefix.forEach((x, k) => { if (!r.drop(P(x), D.STACK_X, cy(k)).got) fail(wl + ': replay of ' + prefix.join(',') + ' broke'); });
          /* 半空中（上面那一層）、已經疊好的那一層 → 不動、不算錯 */
          if (level < D.STACK_LEVELS - 1){ const a = r.drop(P(id), D.STACK_X, cy(level + 1)); if (a.got || a.said.length || msgOf(r) !== plain(d.gStackFloat)) fail(wl + ': a drop in mid-air (level ' + (level + 2) + ') should only remind (gStackFloat), not place or count a mistake'); r.dom.ids.gMsg.textContent = ''; }
          if (level > 0){ const a = r.drop(P(id), D.STACK_X, cy(level - 1)); if (a.got || a.said.length || msgOf(r) !== '') fail(wl + ': a drop on the filled level ' + level + ' is not silent'); }
          const res = r.drop(P(id), D.STACK_X, cy(level), level === 1);
          if (res.got !== okOwn(id, level)) fail(wl + ': ' + prefix.concat(id).join(',') + ' — the ' + id + ' at level ' + (level + 1) + ' was ' + (res.got ? 'accepted' : 'refused'));
          if (!res.got){
            const say = own(id).flat === 0 ? d.gStackBall : d.gStackCone;
            if (res.said.join() !== say) fail(wl + ': the ' + id + ' at level ' + (level + 1) + ' should say ' + say + ', said ' + JSON.stringify(res.said));
            return;
          }
          if (r.line.textContent !== d.gStackNow(level + 1)) fail(wl + ': the line reads ' + r.line.textContent);
          if (level + 1 === D.STACK_LEVELS){
            finished++;
            if (!r.st().gSolved || r.LOG.solved.join() !== d.gStackDone || r.st().gScore !== 2) fail(wl + ': a full tower does not solve the round');
            if (id !== 'cone' || prefix.some(x => !own(x).stackTop)) fail(wl + ': a tower ' + prefix.concat(id).join(',') + ' was accepted');
            noHits(r.LOG.pieces.filter(p => p.locked).map(p => rect(p.cx, p.cy, p.w, p.h)), wl + ' tower');
          } else {
            if (r.st().gSolved) fail(wl + ': solved at level ' + (level + 1));
            walk(prefix.concat(id));
          }
        });
      };
      walk([]);
      if (finished !== 6) fail(wl + ': ' + finished + ' ways to finish the tower, expected 6 (3! orders of the flat-topped solids, the cone on top)');
      /* 托盤的五個位置也洗牌 */
      const homes = new Set();
      for (let n = 0; n < 60; n++){ const r = EXEC('stack', null, L); if (r) homes.add(r.LOG.pieces.map(p => p.homeX + ',' + p.homeY).join(';')); }
      if (homes.size < 10) fail(wl + ': the tray positions hardly change (' + homes.size + ' layouts in 60 runs)');
    });
  }

  /* ---------- 第 5 關：貼一貼 ---------- */
  {
    const S = D.STICK_BOX;
    if (!D.GAME_STICK.length) fail('GAME_STICK is empty');
    /* 題庫整體：一半以上有正方體／長方體（看不到的面也要算才會有意義），也要有「同一種兩個」（一樣的要各算一次） */
    if (D.GAME_STICK.filter(g => g.some(id => own(id).flat === 6)).length * 2 < D.GAME_STICK.length) fail('GAME_STICK: fewer than half of the groups have a cube or a cuboid');
    if (!D.GAME_STICK.some(g => new Set(g).size < g.length)) fail('GAME_STICK: no group has two of the same solid');
    /* codex 第一輪：球（0 個）和圓錐（1 個）都要出現過，不然「球不貼」「圓錐只有底下那一個」的那一條路從來沒被跑過 */
    ['ball', 'cone', 'cyl'].forEach(id => { if (!D.GAME_STICK.some(g => g.indexOf(id) >= 0)) fail('GAME_STICK: no group has the ' + id); });
    D.GAME_STICK.forEach((g, gi) => {
      const w = 'sticker[' + gi + ']';
      if (!g.every(id => own(id))) return fail(w + ': unknown solid in ' + g.join());
      if (g.length < 2 || g.length > 3) fail(w + ': 2 or 3 solids, got ' + g.length);
      if (!g.some(id => own(id).curved)) fail(w + ': no solid with a curved face — "stick on the curved face too" is never refused');
      const boxes = g.map((id, i) => ({ cx:D.stickBoxX(g.length, i), cy:S.y + S.h / 2, hw:S.w / 2, hh:S.h / 2, done:false }));
      boxes.forEach((b, i) => insideB(rect(b.cx, b.cy, S.w, S.h), w + ' box ' + i, D.STICK_H)); noHits(boxes.map(b => rect(b.cx, b.cy, S.w, S.h)), w + ' boxes');
      sweep(w + ' boxes', boxes, S.y + S.h / 2, D.GPAD);
      const total = g.reduce((a, id) => a + own(id).flat, 0);
      LANGS.forEach(L => {
        const d = I18N[L], wl = w + ' ' + L;
        seq(wl + ' gStickDone', d.gStickDone(g.map(id => own(id).flat), total), g.map(id => own(id).flat).concat([total]));
        /* 跑起來：每一個貼到滿再多一張；中途按「貼好了」；全部貼滿才過關 */
        [1].forEach(withMiss => {
          const r = EXEC('sticker', gi, L); if (!r) return;
          const src0 = r.LOG.pieces[0], done = r.LOG.buttons[0];
          if (!src0 || r.LOG.pieces.length !== 1 || !done || done.textContent !== d.gStickBtn) return fail(wl + ': one sticker source and a Done button');
          const dots = i => r.B.el.children.filter(z => z._cls.has('gbox'))[i].querySelector('.gdots').children.length;
          done.fire('click');
          if (r.LOG.miss.length || r.st().gSolved || msgOf(r) !== plain(d.gStickEmpty)) fail(wl + ': Done with nothing stuck should only remind (gStickEmpty)');
          if (r.drop(src0, W / 2, S.y + S.h + D.GPAD + 4).said.length) fail(wl + ': a drop under the boxes is not silent');
          let have = g.map(() => 0);
          const sum = () => have.reduce((a, b) => a + b, 0);
          /* 按「貼好了」：還有沒貼滿的 → 什麼都沒貼時只提醒（不算錯），有貼的時候說第一個沒貼滿的、算一次錯，都不可以過關。
             codex 第一輪：原本只在第一個形體還沒貼滿的時候按過一次，「只檢查第一個」的頁面照樣全綠 */
          const pressDone = () => {
            const m0 = r.LOG.miss.length, sk = g.findIndex((x, j) => have[j] < own(x).flat);
            if (sk < 0) return;   /* 全部貼滿了：那是最後的「貼好了」，在後面按 */
            done.fire('click');
            if (sum() === 0){ if (r.LOG.miss.length !== m0 || msgOf(r) !== plain(d.gStickEmpty)) fail(wl + ': Done with nothing stuck should only remind'); }
            else if (r.LOG.miss.length !== m0 + 1 || r.LOG.miss[m0] !== d.gStickShort(IDX[g[sk]], have[sk])) fail(wl + ': Done with the ' + g[sk] + ' at ' + have[sk] + '/' + own(g[sk]).flat + ' should say gStickShort for it, said ' + JSON.stringify(r.LOG.miss.slice(m0)));
            if (r.st().gSolved) fail(wl + ': Done solved the round with stickers missing (' + have.join(',') + ')');
          };
          const lastReal = g.reduce((a, x, j) => own(x).flat > 0 ? j : a, -1);
          g.forEach((id, i) => {
            for (let n = 0; n <= own(id).flat; n++){
              if (i === lastReal && n === own(id).flat - 1) pressDone();   /* 只差最後一張 */
              const d0 = dots(i), res = r.drop(src0, D.stickBoxX(g.length, i), S.y + 30, n % 2 === 1);
              const got = dots(i) > d0, want = n < own(id).flat;
              if (got !== want) fail(wl + ': sticker ' + (n + 1) + ' on the ' + id + ' was ' + (got ? 'accepted' : 'refused') + (n % 2 ? ' (tap-then-tap)' : ''));
              if (n % 2 === 1 && want && !(r.B.selected === src0 && src0.el._cls.has('sel'))) fail(wl + ': after a tap-then-tap sticker the sticker is not kept selected');
              if (want){ have[i]++; if (dots(i) !== have[i]) fail(wl + ': the ' + id + ' shows ' + dots(i) + ' dots, ' + have[i] + ' stuck'); }
              else {
                const say = own(id).flat === 0 ? d.gStickBall : d.gStickFull(IDX[id]);
                if (res.said.join() !== say) fail(wl + ': one more on the ' + id + ' should say ' + say + ', said ' + JSON.stringify(res.said));
                if (dots(i) !== have[i]) fail(wl + ': a refused sticker still shows on the ' + id);
              }
              if (r.line.textContent !== d.gStickNow(sum())) fail(wl + ': the line reads ' + r.line.textContent);
            }
            if (i < g.length - 1) pressDone();   /* 每貼完一個（前綴）就按一次 */
          });
          if (r.st().gSolved) fail(wl + ': solved before Done');
          done.fire('click');
          if (!r.st().gSolved || r.LOG.solved.join() !== d.gStickDone(g.map(id => own(id).flat), total) || !done.disabled) fail(wl + ': Done with every flat face stuck does not solve with gStickDone');
          if (r.st().gScore !== (r.LOG.miss.length ? 1 : 2)) fail(wl + ': stars ' + r.st().gScore + ' after ' + r.LOG.miss.length + ' mistakes');
        });
        /* 剛好貼滿（不多貼）→ 2 顆星 */
        const r2 = EXEC('sticker', gi, L);
        if (r2){
          g.forEach((id, i) => { for (let n = 0; n < own(id).flat; n++) r2.drop(r2.LOG.pieces[0], D.stickBoxX(g.length, i), S.y + 30); });
          r2.LOG.buttons[0].fire('click');
          if (!r2.st().gSolved || r2.st().gScore !== 2 || r2.LOG.miss.length) fail(wl + ': exactly one sticker per flat face, then Done, should give 2 stars');
        }
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      T.forEach((s, i) => {
        if (s.flat){
          seq('sticker ' + L + ' gStickFull(' + s.id + ')', d.gStickFull(i), [s.flat]);
          if (s.curved) has('sticker ' + L + ' gStickFull(' + s.id + ')', d.gStickFull(i), L === 'zh' ? /彎彎/ : /curved/);
          for (let h = 0; h < s.flat; h++){ seq('sticker ' + L + ' gStickShort(' + s.id + ',' + h + ')', d.gStickShort(i, h), [s.flat, h]); if (L === 'en'){ const pb = enPluralProblem('gStickShort', d.gStickShort(i, h)); if (pb) fail(pb); } }
          if (s.flat === 6) has('sticker ' + L + ' gStickShort(' + s.id + ')', d.gStickShort(i, 3), L === 'zh' ? /看不到/ : /cannot see/);
          /* codex 第一輪：每一句「還差」都要說出還要貼哪裡（圓錐那一句原本是半句話） */
          if (!(L === 'zh' ? /要貼|要算/ : /need|count too/).test(d.gStickShort(i, 0))) fail('sticker ' + L + ': gStickShort(' + s.id + ', 0) never says where the missing sticker goes — ' + plain(d.gStickShort(i, 0)));
        }
        [1, 2, 5].forEach(n => { seq('sticker ' + L + ' gStick2', d.gStick2(i, n), [n]); if (L === 'en' && /\b1 more stickers\b|\b[2-9] more sticker\b(?!s)/.test(d.gStick2(i, n))) fail('gStick2 en plural: ' + d.gStick2(i, n)); });
      });
      if (L === 'en'){ const pb = enPluralProblem('gStickFull cone', d.gStickFull(IDX.cone)); if (pb) fail(pb); }
      [0, 1, 7].forEach(n => seq('sticker ' + L + ' gStickNow', d.gStickNow(n), [n]));
      has('sticker ' + L + ' gStickBall', d.gStickBall, L === 'zh' ? /沒有平平的面/ : /no flat face/);
      /* codex 第一輪：貼紙其實貼得上彎彎的球 —— 理由要是「彎彎的面不貼」這一條規則，不是「貼不上去」 */
      if (L === 'zh' ? /貼不上/.test(d.gStickBall) || !/彎彎的面不貼/.test(d.gStickBall) : /nowhere/.test(d.gStickBall) || !/curved faces do not get/.test(d.gStickBall)) fail('sticker ' + L + ': gStickBall must give the rule (curved faces get no sticker), not a false physical reason');
    });
  }

}

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
    /* --- index.html：英文「1 flat face」（遊戲的 gStickFull 會把它印出來） --- */
    { file:'index', expect:'one of anything takes the singular',
      find:"      flatWord:function(n){ return n + ' flat face' + (n === 1 ? '' : 's'); },",
      replace:"      flatWord:function(n){ return n + ' flat faces'; }," },
    /* 屬性順序不一樣的 <rect> 也要量得到 —— 少了這一條，一個畫出去的矩形會被靜靜跳過。 */
    { file:'index', expect:'draws out to x=',
      find:"      s += '<rect x=\"40\" y=\"48\" width=\"60\" height=\"56\" fill=\"' + fill + '\" stroke=\"none\"/>';",
      replace:"      s += '<rect width=\"300\" y=\"48\" x=\"40\" height=\"56\" fill=\"' + fill + '\" stroke=\"none\"/>';" },
    /* 認不得的 id：長度、不重複、答案、線索四條檢查全都會過，畫面上卻印出 undefined。 */
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
      find:"    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- 小遊戲「立體形體大挑戰」",
      replace:"    s += '<text x=\"10\" y=\"20\">x</text>';\n    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- 小遊戲「立體形體大挑戰」" },
    /* 解釋不可以否定它自己被要求給出的理由。 */
    { file:'index', expect:'negates its own required reason',
      find:"          why:'球整個都是彎彎的面，一個平平的面都沒有，站不穩，順著任何方向一推就滾走了。' },",
      replace:"          why:'球沒有整個都是彎彎的面，一個平平的面都沒有，站不穩，順著任何方向一推就滾走了。' }," },
    /* 題庫的陣列破洞：長度沒變，forEach 會跳過。 */
    { file:'index', expect:'the slot is missing',
      find:"        { stem:'⚽ 皮球是球。<br>它有幾個<strong>平平的面</strong>？',\n          opts:['0 個','1 個','2 個','6 個'], ans:0,",
      replace:"        ,\n        { stem:'⚽ 皮球是球。<br>它有幾個<strong>平平的面</strong>？',\n          opts:['0 個','1 個','2 個','6 個'], ans:0," },
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
      replace:'再數面、數邊、數頂點，最後用「會不會滾、疊不疊得高」把它們分出來。<strong>展開圖、柱體錐體的分類、表面積和體積都是五年級的內容</strong>，這一課完全不碰。",' },
    /* --- index.html：小遊戲「立體形體大挑戰」（2026-10-02 改版）。舊的「猜猜我是誰」選擇題連同它的 11 筆 break 一起拿掉 --- */
    /* 第 1 關 點一點 */
    { file:'index', expect:'corner reach is',
      find:'  var POINT_H = 270, POINT_TOP = 54, POINT_CORNER = 24,', replace:'  var POINT_H = 270, POINT_TOP = 54, POINT_CORNER = 20,' },
    { file:'index', expect:'cannot hold two lines',
      find:'  var POINT_H = 270, POINT_TOP = 54, POINT_CORNER = 24,', replace:'  var POINT_H = 270, POINT_TOP = 30, POINT_CORNER = 24,' },
    { file:'index', expect:'pointHit() disagrees with the picture',
      find:"    if (bcd <= POINT_CORNER) return { kind:'vert', k:bc };", replace:"    if (bcd <= POINT_CORNER - 8) return { kind:'vert', k:bc };" },
    { file:'index', expect:'pointHit() disagrees with the picture',
      find:'    if (bed <= POINT_EDGE) return { kind:\'edge\' };', replace:'    if (bed <= POINT_EDGE + 6) return { kind:\'edge\' };' },
    { file:'index', expect:'the page hides corner',
      find:'    var hid = dir > 0 ? 4 : 5;', replace:'    var hid = dir > 0 ? 5 : 4;' },
    { file:'index', expect:'are not the three you can see',
      find:'    var faces = [[A, B, C, D], [D, C, C2, D2], dir > 0 ? [B, C, C2, B2] : [A, D, D2, A2]];', replace:'    var faces = [[A, B, C, D], [D, C, C2, D2], [B, C, C2, B2]];' },
    { file:'index', expect:'should draw exactly the 3 hidden edges as dashed lines',
      find:"      s += '<line x1=\"' + a[0] + '\" y1=\"' + a[1] + '\" x2=\"' + b[0] + '\" y2=\"' + b[1] + '\" stroke=\"' + edge + '\" stroke-width=\"2\" stroke-dasharray=\"6 4\"/>';",
      replace:"      s += '<line x1=\"' + a[0] + '\" y1=\"' + a[1] + '\" x2=\"' + b[0] + '\" y2=\"' + b[1] + '\" stroke=\"' + edge + '\" stroke-width=\"2\"/>';" },
    { file:'index', expect:'not all marked and numbered',
      find:"      s += '<text x=\"' + c[0] + '\" y=\"' + (c[1] + 5) + '\" font-size=\"14\" font-weight=\"800\" text-anchor=\"middle\" fill=\"#FFFFFF\">' + found[i] + '</text>';\n", replace:'' },
    { file:'index', expect:'should say gPointEdge',
      find:"        if (h.kind === 'vert'){\n          if (found[h.k]) return;", replace:"        if (h.kind !== 'face'){\n          if (h.k === undefined) h.k = 99;\n          if (found[h.k]) return;" },
    { file:'index', expect:'the top corners sit under the task label',
      find:'y0 = POINT_TOP + (POINT_H - POINT_TOP - H - dy) / 2 + dy;', replace:'y0 = (POINT_H - H - dy) / 2 + dy;' },
    { file:'index', expect:'gPointDone: numbers should read [8]',
      find:"      gPointDone:function(i, n){ return '找齊了！' + this.solids[i].name + '有 ' + n + ' 個頂點 —— 虛線那邊看不到的也算。'; },",
      replace:"      gPointDone:function(i, n){ return '找齊了！' + this.solids[i].name + '有 ' + (n - 1) + ' 個頂點 —— 虛線那邊看不到的也算。'; }," },
    { file:'index', expect:'takes the singular',
      find:"      gPointNow:function(got){ return 'Found ' + got + (got === 1 ? ' corner' : ' corners'); },", replace:"      gPointNow:function(got){ return 'Found ' + got + ' corners'; }," },
    { file:'index', expect:'taps only',
      find:"        point:'點一點：把要找的一個一個點出來（這一關用點的）。',", replace:"        point:'點一點：把要找的一個一個點出來。'," },
    /* 第 2 關 分一分 */
    { file:'index', expect:'dropped in',
      find:'        if (SOLIDS[i].flat !== b.v){ roundMiss(d.gSortWrong(i, b.v)); return false; }', replace:'        if (false){ roundMiss(d.gSortWrong(i, b.v)); return false; }' },
    { file:'index', expect:'SORT_VALUES should be',
      find:'  var SORT_VALUES = [0, 1, 2, 6];', replace:'  var SORT_VALUES = [0, 1, 2, 3, 6];' },
    { file:'index', expect:'the snap zones never overlap',
      find:'  var SORT_BIN = { y:34, w:70, h:150, gap:4, top:36, placedW:56, placedH:50 };', replace:'  var SORT_BIN = { y:34, w:64, h:150, gap:14, top:36, placedW:56, placedH:50 };' },
    { file:'index', expect:'must hold 2 placed cards',
      find:'  var SORT_BIN = { y:34, w:70, h:150, gap:4, top:36, placedW:56, placedH:50 };', replace:'  var SORT_BIN = { y:34, w:70, h:110, gap:4, top:36, placedW:56, placedH:50 };' },
    { file:'index', expect:'ties must count as sorted',
      find:'    for (var i = 1; i < a.length; i++) if (!(key(a[i - 1]) <= key(a[i]))) up = false;', replace:'    for (var i = 1; i < a.length; i++) if (!(key(a[i - 1]) < key(a[i]))) up = false;' },
    { file:'index', expect:'is left in order',
      find:'    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n', replace:'' },
    { file:'index', expect:'nearestOpen() disagrees with the nearest box',
      find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (!best){ bd = dd; bc = dc; best = b; }' },
    /* 「量到中心」不量到方框的改壞版本這裡不放：這一課並排的格子都一樣大、在同一排，量中心和量方框挑出來的永遠是同一格
       （0.25px 掃過去完全一樣），那筆 break 抓不到是因為它在這個版面上根本不是缺陷。 */
    { file:'index', expect:'gFlatWhy[2] never says 2',
      find:"'上面和下面一共 2 個，旁邊彎彎的面不算',", replace:"'上面、下面和旁邊一共 3 個，彎彎的也算',"  },
    { file:'index', expect:'gSortDone pairs the',
      find:"      gSortDone:'分好了！球 0 個、圓錐 1 個、圓柱 2 個，正方體和長方體都是 6 個平平的面。',", replace:"      gSortDone:'分好了！球 0 個、圓錐 2 個、圓柱 1 個，正方體和長方體都是 6 個平平的面。'," },
    { file:'index', expect:'does not draw its own solid with its own name',
      find:"  function soHTML(d, i, o){ return pieceSVG(SOLIDS[i].id, o) + '<span class=\"gname\">' + d.solids[i].name + '</span>'; }",
      replace:"  function soHTML(d, i, o){ return pieceSVG(SOLIDS[i].id, o) + '<span class=\"gname\">' + d.solids[(i + 1) % 5].name + '</span>'; }" },
    /* 第 3 關 滾一滾 */
    { file:'index', expect:'rollsOnTable(cuboid',
      find:"  function rollsOnTable(id, o){ return downFace(id, o) === 'curved'; }", replace:"  function rollsOnTable(id, o){ return downFace(id, o) === 'curved' || (id === 'cuboid' && o === 'up'); }" },
    { file:'index', expect:'the cylinder must start standing',
      find:"  var ROLL_START = { cube:'flat', cuboid:'flat', cyl:'stand', ball:'any' };", replace:"  var ROLL_START = { cube:'flat', cuboid:'flat', cyl:'lie', ball:'any' };" },
    { file:'index', expect:'is not redrawn after',
      find:'          P.el.innerHTML = pieceSVG(id, P.data.o);\n', replace:'' },
    { file:'index', expect:'GAME_ROLL must list blocks',
      find:"  var GAME_ROLL = ['cube', 'cuboid'];", replace:"  var GAME_ROLL = ['cube', 'cone'];" },
    { file:'index', expect:'solved with only the sphere rolled',
      find:'        if (rolled === 2) roundSolved(', replace:'        if (rolled === 1) roundSolved(' },
    { file:'index', expect:'is drawn standing',
      find:"      s += '<ellipse cx=\"72\" cy=\"72\" rx=\"30\" ry=\"30\" fill=\"#F6E4CC\"", replace:"      s += '<ellipse cx=\"72\" cy=\"72\" rx=\"31\" ry=\"10\" fill=\"#F6E4CC\"" },
    { file:'index', expect:'roll pieces and turn buttons',
      find:'  var ROLL_TURN = { y:150, size:48 };', replace:'  var ROLL_TURN = { y:112, size:48 };' },
    { file:'index', expect:'gRollStand: should say /🔄/',
      find:"      gRollStand:'圓柱站著的時候，下面是平平的面貼著桌子，推了可能會滑、也可能會倒，就是不會滾。先按 🔄 讓它躺下來。',", replace:"      gRollStand:'圓柱站著的時候，下面是平平的面貼著桌子，推了可能會滑、也可能會倒，就是不會滾。'," },
    { file:'index', expect:'a tap on 🔄',
      find:"      if (e.target.closest && e.target.closest('.gpiece, .gturn')) return;", replace:"      if (e.target.closest && e.target.closest('.gpiece')) return;" },
    { file:'index', expect:'the rolled cyl can still be turned',
      find:'        P.turnBtn.disabled = true;\n', replace:'' },
    /* 第 4 關 疊一疊 */
    { file:'index', expect:'ways to finish the tower',
      find:"    if (level < STACK_LEVELS - 1 && !s.stackTop) return 'top';", replace:"    if (level < STACK_LEVELS - 2 && !s.stackTop) return 'top';" },
    { file:'index', expect:'stackWhy(ball',
      find:"    if (!s.stable) return 'ball';", replace:"    if (!s.stable && level < STACK_LEVELS - 1) return 'ball';" },
    { file:'index', expect:'is not silent',
      find:'        slots[level].done = true;\n', replace:'' },
    { file:'index', expect:'tray positions hardly change',
      find:'      var spots = shuffle([0, 1, 2, 3, 4]);', replace:'      var spots = [0, 1, 2, 3, 4];' },
    { file:'index', expect:"inside the tower's reach",
      find:'  var STACK_TRAY = [[46, 82], [126, 82], [46, 160], [126, 160], [86, 238]];', replace:'  var STACK_TRAY = [[46, 82], [150, 82], [46, 160], [126, 160], [86, 238]];' },
    { file:'index', expect:'should say 圓錐上面尖尖的',
      find:"        if (why === 'top'){ roundMiss(d.gStackCone); return false; }", replace:"        if (why === 'top'){ roundMiss(d.gStackBall); return false; }" },
    /* 第 5 關 貼一貼 */
    { file:'index', expect:'on the cyl was accepted',
      find:'        if (have[t.i] >= s.flat){ roundMiss(d.gStickFull(t.si)); return false; }', replace:'        if (have[t.i] >= s.flat + s.curved){ roundMiss(d.gStickFull(t.si)); return false; }' },
    { file:'index', expect:'Done solved the round with stickers missing',
      find:'          if (have[i] < SOLIDS[boxes[i].si].flat){ roundMiss(d.gStickShort(boxes[i].si, have[i])); return; }', replace:'          if (have[i] < 0){ roundMiss(d.gStickShort(boxes[i].si, have[i])); return; }' },
    { file:'index', expect:'should only remind',
      find:'        if (total() === 0){ gMsg.textContent = d.gStickEmpty; return; }', replace:'        if (total() === 0){ roundMiss(d.gStickEmpty); return; }' },
    { file:'index', expect:'no solid with a curved face',
      find:"  var GAME_STICK = [ ['cube', 'cyl'],", replace:"  var GAME_STICK = [ ['cube', 'cuboid']," },
    { file:'index', expect:'gStickDone: numbers should read',
      find:"      gStickDone:function(parts, total){ return '貼好了！' + parts.join(' ＋ ') + ' ＝ ' + total + ' 個平平的面。'; }",
      replace:"      gStickDone:function(parts, total){ return '貼好了！' + parts.join(' ＋ ') + ' ＝ ' + (total + 1) + ' 個平平的面。'; }" },
    { file:'index', expect:'solved before Done',
      find:'        line.textContent = d.gStickNow(total());\n', replace:"        line.textContent = d.gStickNow(total());\n        if (boxes.every(function(b){ return have[b.i] === SOLIDS[b.si].flat; })) roundSolved(d.gStickDone(boxes.map(function(b){ return SOLIDS[b.si].flat; }), total()));\n" },
    { file:'index', expect:'the snap zones never overlap',
      find:'  var STICK_BOX = { y:34, w:92, h:150, gap:4 };', replace:'  var STICK_BOX = { y:34, w:88, h:150, gap:16 };' },
    /* 引擎：星星、不扣分、舊畫板、提示 */
    { file:'index', expect:'the round gives',
      find:'    var stars = gMistakes === 0 ? 2 : 1;', replace:'    var stars = 1;' },
    { file:'index', expect:'the round gives',
      find:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }",
      replace:"  function roundMiss(text){ gMistakes++; gScore -= 1; elScore.textContent = gScore; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:'index', expect:'a piece still held when the board is rebuilt',
      find:'      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n', replace:'' },
    { file:'index', expect:'ahead mode',
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:'' },
    { file:'index', expect:'the hint button',
      find:'    if (hintLevel >= 2) gHintBtn.disabled = true;', replace:'' },
    /* --- codex 第一輪的修補，各配一筆 --- */
    { file:'index', expect:'a refused push must allow both sliding and tipping over',
      find:"      gRollStand:'圓柱站著的時候，下面是平平的面貼著桌子，推了可能會滑、也可能會倒，就是不會滾。先按 🔄 讓它躺下來。',", replace:"      gRollStand:'圓柱站著的時候，下面是平平的面貼著桌子，推了只會滑、不會滾。先按 🔄 讓它躺下來。'," },
    { file:'index', expect:'a refused push must allow both sliding and tipping over',
      find:"so a push may slide it or tip it over an edge, but it will not roll smoothly.'; },", replace:"so a push tips it over an edge instead of rolling it.'; }," },
    { file:'index', expect:'gStickBall must give the rule',
      find:"      gStickBall:'球沒有平平的面；彎彎的面不貼貼紙。',", replace:"      gStickBall:'球沒有平平的面，貼紙貼不上去。'," },
    { file:'index', expect:'is not a sentence',
      find:"(hid === 1 ? 'is' : 'are') + ' where the three dashed lines meet'", replace:"' where the three dashed lines meet'" },
    { file:'index', expect:'never says where the missing sticker goes',
      find:"'：上面和下面都要貼', '', '：底下那一個圓圓的平面也要貼' ],", replace:"'：上面和下面都要貼', '', '：底下那一個圓圓的就是' ]," },
    { file:'index', expect:'tap-then-tap',
      find:'      if (!gSolved) tryDrop(P, { x:pt.x, y:pt.y, tap:true });', replace:'      if (!gSolved && false) tryDrop(P, { x:pt.x, y:pt.y, tap:true });' },
    { file:'index', expect:'tapping a piece does not select it',
      find:'      B.selected = P; P.el.classList.add(\'sel\');\n    };', replace:'      B.selected = null; P.el.classList.add(\'sel\');\n    };' },
    { file:'index', expect:'Done solved the round with stickers missing',
      find:'        for (var i = 0; i < n; i++){\n          if (have[i] < SOLIDS[boxes[i].si].flat){ roundMiss(d.gStickShort(boxes[i].si, have[i])); return; }',
      replace:'        for (var i = 0; i < 1; i++){\n          if (have[i] < SOLIDS[boxes[i].si].flat){ roundMiss(d.gStickShort(boxes[i].si, have[i])); return; }' },
    { file:'index', expect:'GAME_ROLL should be exactly the cube and the cuboid',
      find:"  var GAME_ROLL = ['cube', 'cuboid'];", replace:"  var GAME_ROLL = ['cube', 'cube'];" },
    { file:'index', expect:'GAME_STICK: no group has the ball',
      find:"['cyl', 'cyl', 'ball'], ['cuboid', 'cone'], ['cube', 'ball', 'cone'],", replace:"['cyl', 'cyl', 'cube'], ['cuboid', 'cone'], ['cube', 'cyl', 'cone']," },
    { file:'index', expect:'is not kept selected',
      find:'        if (pt.tap) keepSelected(B, P);\n', replace:'' },
    { file:'index', expect:'a drag that ends on a corner counts as finding it',
      find:'        if (from && (p.x - from.x) * (p.x - from.x) + (p.y - from.y) * (p.y - from.y) > POINT_SLIP * POINT_SLIP) return;', replace:'        if (false) return;' },
    { file:'index', expect:'a diagonal slide of 8, 8',
      find:'        if (from && (p.x - from.x) * (p.x - from.x) + (p.y - from.y) * (p.y - from.y) > POINT_SLIP * POINT_SLIP) return;', replace:'        if (from && (Math.abs(p.x - from.x) > POINT_SLIP || Math.abs(p.y - from.y) > POINT_SLIP)) return;' },
    { file:'index', expect:'should only remind (gStackFloat)',
      find:'        if (at.k !== level){ gMsg.textContent = d.gStackFloat; return false; }', replace:'        if (at.k !== level){ roundMiss(d.gStackFloat); return false; }' },
    { file:'index', expect:'the lying cylinder is not drawn end-on',
      find:"      s += '<ellipse cx=\"72\" cy=\"72\" rx=\"30\" ry=\"30\" fill=\"#F6E4CC\" stroke=\"' + edge + '\" stroke-width=\"3\"/>';", replace:"      s += '<ellipse cx=\"36\" cy=\"88\" rx=\"11\" ry=\"30\" fill=\"#F6E4CC\" stroke=\"' + edge + '\" stroke-width=\"3\"/>';" },
    { file:'index', expect:'the lying cylinder is not drawn end-on',
      find:"      s += '<ellipse cx=\"62\" cy=\"88\" rx=\"30\" ry=\"30\" fill=\"#FFF6E8\"", replace:"      s += '<ellipse cx=\"110\" cy=\"88\" rx=\"30\" ry=\"30\" fill=\"#FFF6E8\"" },
    { file:'index', expect:'the lying cylinder is not drawn end-on',
      find:"      s += '<ellipse cx=\"72\" cy=\"72\" rx=\"30\" ry=\"30\" fill=\"#F6E4CC\"", replace:"      s += '<ellipse cx=\"78\" cy=\"88\" rx=\"30\" ry=\"30\" fill=\"#F6E4CC\"" },
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
    dataReturn: '{SOLIDS, COUNT_SOLIDS, PARTS, solidById, solidSVG, partsSVG, partsGeom, GAME_W, GPICK, GPAD, GAME_ORDER, GAME_POINT, POINT_H, POINT_TOP, POINT_CORNER, POINT_EDGE, POINT_SLIP, pointGeom, pointHit, SORT_VALUES, SORT_H, SORT_BIN, SORT_CARD, sortBinX, GAME_ROLL, ROLL_H, ROLL_PIECE, ROLL_TURN, ROLL_LANE, ROLL_START, turnOf, downFace, rollsOnTable, STACK_H, STACK_LEVELS, STACK_CELL, STACK_X, STACK_TABLE, STACK_PIECE, STACK_TRAY, stackLevelY, stackWhy, GAME_STICK, STICK_H, STICK_BOX, STICK_SRC, stickBoxX, pieceSVG, pointSVG}',
    check: function(data, I18N, fail, src){
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

      /* --- 7. 遊戲：五關五種玩法（見檔案前面的 gameCheck） --- */
      gameCheck(data, I18N, fail, src);

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
            /* 牛奶盒用 🧃 不用 🥛：🥛 畫的是一杯牛奶（圓柱），躺下來真的會滾 —— 圖和「滾不順」那一句互相矛盾 */
            optsAll:{ zh:['🎲 骰子','🧃 牛奶盒','📚 書本','⚽ 皮球'],
                      en:['🎲 A die','🧃 A milk carton','📚 A book','⚽ A ball'] } },
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
