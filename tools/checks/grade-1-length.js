/* grade-1/math/length 的檢查設定（長度：直接比較、間接比較、個別單位、對齊）。

   ⚠️ 這一課的 11 個產生器裡有 5 個（compareByCount／barCompare／indirectCompareStory／
   gapMistakeSpot／mixedSizeMistakeSpot）用 mixTwo()，只出 2 個選項，不是全站慣例的
   4 個 —— 和 grade-1-two-digit.js／grade-1-pattern.js 同一種結構性衝突
   （tools/simgen.js 的選項數檢查寫死是 4）。另外 6 個產生器（countUnits／
   smallToBig／bigToSmall／numbersCount／addsubWithin20／shapesSides）是正常的
   4 選項，可以完整驗證。

   index.html 的範例資料（S1_PAIRS／S2_PAIRS）散落在各節的 DOM 程式碼中間（和 grade-1-numbers.js
   同一種情形），改用 check() 裡從 src 重新抓字串。小遊戲（2026-10-01 改成五關五種玩法）的題庫與版面常數
   放在 i18n 前面的「語言無關的資料」區，由 dataStart~dataEnd 直接執行取得（見 dataReturn）。 */

function extractArray(src, varName){
  const m = src.match(new RegExp('var ' + varName + ' = (\\[[\\s\\S]*?\\]);'));
  if (!m) throw new Error('cannot find var ' + varName + ' in source');
  return new Function('return ' + m[1] + ';')();
}

const ZH = {
  objNames: { wardrobe:'衣櫃', table:'桌子', bed:'床', tv:'電視', bookshelf:'書架', chair:'椅子' },
  names: ['小明','小華','小美','小杰','小安'],
  barNames: { red:'紅色', blue:'藍色' },
  accLabels: { accurate:'準', inaccurate:'不準' }
};
const EN = {
  objNames: { wardrobe:'wardrobe', table:'table', bed:'bed', tv:'TV', bookshelf:'bookshelf', chair:'chair' },
  names: ['Ming','Hua','Mia','Jay','Ann'],
  barNames: { red:'Red', blue:'Blue' },
  accLabels: { accurate:'Accurate', inaccurate:'Not accurate' }
};
function DICT(lang){ return lang === 'zh' ? ZH : EN; }
const SHAPES_REF = { triangle:3, square:4, rectangle:4, pentagon:5 };

const RANGE = {
  countUnits:[0,15], smallToBig:[0,20], bigToSmall:[0,20],
  numbersCount:[0,25], addsubWithin20:[0,22], shapesSides:[0,10]
};

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
    /* 2026-09-14：review 端的 makeWrongs 現在會避開題幹數字（avoid）。把 avoid 掏空，
       ±1 保底又會撞回題幹上的數字（例：addsubWithin20 的 correct − 1 在 y = 1 時就是 x），
       simgen 那條「誘答抄題幹」要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'k outside 4~9',
      find:'        var k = pickUnused([4,5,6,7,8,9], used);\n        var unit = pick([20,24,30]);',
      replace:'        var k = pickUnused([4,5,6,7,8,9], used) + 1;\n        var unit = pick([20,24,30]);' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    /* 沒有「重複選項值」的獨立改壞測試：這一課用 mixOpts 的六個產生器
       （countUnits／smallToBig／bigToSmall／numbersCount／addsubWithin20／
       shapesSides）候選誘答的算式在各自的數字範圍裡永遠兩兩不等——要證明
       seen[] 去重真的有效，得同時「關掉去重」又「讓兩個候選剛好撞在一起」，
       這兩處在原始碼裡離得太遠，沒辦法用一筆 find/replace 同時做到。 */
    { file:'review', expect:'smallCount != g*2',
      find:'        var g = pickUnused([3,4,5,6,7,8], used);\n        var smallCount = g * 2;',
      replace:'        var g = pickUnused([3,4,5,6,7,8], used);\n        var smallCount = g * 2 + 1;' },
    { file:'index', expect:'S1_PAIRS[0] wa equals wb',
      find:'    { wa:170, wb:110, offsetB:55 },',
      replace:'    { wa:170, wb:170, offsetB:55 },' },
    { file:'index', expect:'S2_PAIRS[0] nameKeyA equals nameKeyB',
      find:"    { ha:170, hb:110, iconA:'🗄️', iconB:'🪑', nameKeyA:'wardrobe', nameKeyB:'table' },",
      replace:"    { ha:170, hb:110, iconA:'🗄️', iconB:'🪑', nameKeyA:'wardrobe', nameKeyB:'wardrobe' }," },
    /* --- 小遊戲（2026-10-01 改版）：每一條新的不變量一筆 --- */
    { file:'index', expect:'already on the Start line',
      find:"    { bars:[ { c:'red', w:200, off:36 },", replace:"    { bars:[ { c:'red', w:200, off:10 }," },
    { file:'index', expect:'also reaches furthest right before lining up',
      find:"{ c:'blue', w:150, off:120 }", replace:"{ c:'blue', w:150, off:40 }" },
    { file:'index', expect:'ribbon lengths differ by less than 20',
      find:"{ c:'orange', w:110, off:80 }", replace:"{ c:'orange', w:190, off:80 }" },
    { file:'index', expect:'sticks out of the board before lining up',
      find:"{ c:'orange', w:170, off:100 }", replace:"{ c:'orange', w:170, off:110 }" },
    { file:'index', expect:'under 44',
      find:'var LINE_X = 24, LINE_SNAP = 24, LANE_Y = [62, 132, 202], BAR_H = 48;',
      replace:'var LINE_X = 24, LINE_SNAP = 24, LANE_Y = [62, 132, 202], BAR_H = 40;' },
    { file:'index', expect:'lanes overlap',
      find:'LANE_Y = [62, 132, 202]', replace:'LANE_Y = [62, 110, 202]' },
    { file:'index', expect:'gLineDone zh does not say',
      find:"return '對！左端對齊之後，' + c + '緞帶", replace:"return '對！左端對齊之後，緞帶" },
    { file:'index', expect:'longest() does not pick',
      find:'return P.data.b.w > m.data.b.w ? P : m;', replace:'return P.data.b.w < m.data.b.w ? P : m;' },
    { file:'index', expect:'heights differ by less than 24',
      find:"{ a:'wardrobe', ha:180, b:'door', hb:150 }", replace:"{ a:'wardrobe', ha:180, b:'door', hb:170 }" },
    { file:'index', expect:'unknown object',
      find:"{ a:'bookshelf', ha:130, b:'plant', hb:160 }", replace:"{ a:'bookshelf', ha:130, b:'tree', hb:160 }" },
    { file:'index', expect:'taller() does not pick',
      find:'function taller(){ return objs[0].h > objs[1].h ? objs[0] : objs[1]; }',
      replace:'function taller(){ return objs[0].h < objs[1].h ? objs[0] : objs[1]; }' },
    { file:'index', expect:'gRopeWhy en does not say',
      find:"' and ' + (longer ? 'longer' : 'shorter') + ' than the ' + o + ', so the '",
      replace:"' and ' + (longer ? 'shorter' : 'longer') + ' than the ' + o + ', so the '" },
    { file:'index', expect:'is not visibly a different size',
      find:'{ n:4, decoys:[64, 24] }', replace:'{ n:4, decoys:[48, 24] }' },
    { file:'index', expect:'wider than the board',
      find:'{ n:6, decoys:[24, 62] }', replace:'{ n:8, decoys:[24, 62] }' },
    { file:'index', expect:'inside the drop area',
      find:'      renderTray(B, items, 160, function(w, cx, cy){', replace:'      renderTray(B, items, 130, function(w, cx, cy){' },
    { file:'index', expect:'odd-sized clips are not refused',
      find:'if (P.data.w !== CLIP_U){', replace:'if (P.data.w > CLIP_U){' },
    { file:'index', expect:'mix widths add up',
      find:'mix:[70, 30, 60, 20, 20]', replace:'mix:[70, 30, 60, 20, 25]' },
    { file:'index', expect:'gap row does not span',
      find:'var gap = (g.len - g.gapK * U) / (g.gapK - 1);', replace:'var gap = (g.len - g.gapK * U) / g.gapK;' },
    { file:'index', expect:'the gap row is drawn as',
      find:'{ len:200, n:5, gapK:4,', replace:'{ len:200, n:5, gapK:5,' },
    { file:'index', expect:'gJudgeWhy.gap zh does not say',
      find:"gap:'這一排中間留了縫隙，量出來不準。'", replace:"gap:'這一排量出來不準。'" },
    { file:'index', expect:'a sign does not fit its box',
      find:'addPiece(B, { w:74, h:54, cx:cx, cy:cy, text:d.gJudgeLbl[t]', replace:'addPiece(B, { w:80, h:54, cx:cx, cy:cy, text:d.gJudgeLbl[t]' },
    { file:'index', expect:'is not a whole number of small',
      find:'{ su:30, len:180 }', replace:'{ su:30, len:170 }' },
    { file:'index', expect:'number cards',
      find:'renderTray(B, [nS, nB, nS + 1, nB + 1], 214, card, 64);', replace:'renderTray(B, [nS, nB, nS + 1, nS + 1], 214, card, 64);' },
    { file:'index', expect:'the wrong-row reason is not',
      find:'r.big ? d.gUnitsFewer(v) : d.gUnitsMore(v)', replace:'r.big ? d.gUnitsMore(v) : d.gUnitsFewer(v)' },
    { file:'index', expect:'gClipDone: numbers should read',
      find:"return '量好了！緞帶長 ' + n + ' 個迴紋針。';", replace:"return '量好了！緞帶長 ' + (n + 1) + ' 個迴紋針。';" },
    /* codex 第一輪補的五筆 */
    { file:'index', expect:'CLIP_SNAP',
      find:'CLIP_PAD = 20, CLIP_SNAP = 10;', replace:'CLIP_PAD = 20, CLIP_SNAP = 20;' },
    { file:'index', expect:'a drag is not judged by where the clip itself lands',
      find:'put(P, P.cx - next())', replace:'put(P, (Math.min(g.n - 1, Math.floor((P.cx - x0) / CLIP_U)) - k) * CLIP_U)' },
    { file:'index', expect:'.gcell has a border',
      find:'  .gcell{ box-sizing:border-box; box-shadow:inset -2px 0 0 rgba(43,42,51,.35); pointer-events:none }',
      replace:'  .gcell{ box-sizing:border-box; border-right:2px solid #fff; box-shadow:inset -2px 0 0 rgba(43,42,51,.35); pointer-events:none }' },
    { file:'index', expect:'choose() lets a child pick before lining up',
      find:'        if (phase === 1){ roundMiss(d.gLineEarly); return; }\n', replace:'' },
    { file:'index', expect:'choose() lets a child pick before the rope',
      find:'        if (phase === 2){ roundMiss(d.gRopeCarry(name(other(meas)))); return; }\n', replace:'' },
    /* codex 第二輪補的兩筆 */
    { file:'index', expect:'the tap path does not place',
      find:'if (!onRibbon(pt) || pt.x < x0 || pt.x >= x0 + L) return false;\n        var j = Math.floor((pt.x - x0) / CLIP_U);',
      replace:'if (!onRibbon(pt)) return false;\n        var j = Math.min(g.n - 1, Math.floor((pt.x - x0) / CLIP_U));' },
    { file:'index', expect:'.gcell has a border',
      find:'  .gunitlbl{', replace:'  .gboard .gcell{ border-right:2px solid #fff }\n  .gunitlbl{' },
    /* codex 第三輪：看不見的分隔線 */
    { file:'index', expect:'inset divider',
      find:'box-shadow:inset -2px 0 0 rgba(43,42,51,.35);', replace:'box-shadow:inset -2px 0 0 transparent;' },
    { file:'index', expect:'gWin missing in en',
      find:"      gWin: function(score){ return 'All 5 rounds cleared!", replace:"      gWin0: function(score){ return 'All 5 rounds cleared!" }
  ],

  sim: {
    /* 這一課混用題型：五個「比比看」是 2 選項（是非／二選一），其餘 4 選項。
       ⚠️ 要逐一列出、不可以圖方便寫 [2,4] —— 那樣其他產生器哪天掉到 2 選項也不會有人發現。 */
    optCount: { compareByCount: 2, barCompare: 2, indirectCompareStory: 2,
                gapMistakeSpot: 2, mixedSizeMistakeSpot: 2, '*': 4 },
    /* 要往前擴到「靜態文字」那一段，因為 indirectCompareStory／gapMistakeSpot 的
       fmt() 會用到更前面宣告的 TXT 文字表。 */
    blockStart: '  /* ---------- 靜態文字 ---------- */',
    INVARIANTS: {
      countUnits: d => {
        if (d.k < 4 || d.k > 9) return 'k outside 4~9';
      },
      compareByCount: d => {
        if (d.a === d.b) return 'a equals b — no valid "longer" answer';
      },
      barCompare: d => {
        if (d.wa === d.wb) return 'wa equals wb — no valid "longer" answer';
      },
      smallToBig: d => {
        if (d.smallCount !== d.g * 2) return 'smallCount != g*2';
        if (d.g < 3 || d.g > 8) return 'g outside 3~8';
      },
      bigToSmall: d => {
        if (d.result !== d.b * 2) return 'result != b*2';
        if (d.b < 3 || d.b > 8) return 'b outside 3~8';
      },
      indirectCompareStory: d => {
        if (d.keyA === d.keyB) return 'keyA equals keyB';
      },
      gapMistakeSpot: d => {
        if (d.nameIdxA === d.nameIdxB) return 'nameIdxA equals nameIdxB';
        if (d.cnt < 5 || d.cnt > 8) return 'cnt outside 5~8';
      },
      mixedSizeMistakeSpot: d => {
        if (d.nounIdx < 0 || d.nounIdx > 3) return 'nounIdx out of range';
      },
      numbersCount: d => {
        if (d.n < 8 || d.n > 20) return 'n outside 8~20';
      },
      addsubWithin20: d => {
        const want = d.isAdd ? d.x + d.y : d.x - d.y;
        if (want !== d.correct) return 'x op y != correct';
        if (d.correct < 0) return 'negative correct value';
      },
      shapesSides: d => {
        if (SHAPES_REF[d.key] !== d.sides) return 'sides does not match the reference table for ' + d.key;
      }
    },
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀題幹上真的印出來的東西**，然後自己算一次。不可以讀回 make()
       算好的答案欄位（g／result／correct／sides）—— 那等於拿課本的答案比課本的答案，
       課本算錯時兩邊一起錯，檢查照樣綠燈。
       ⚠️ countUnits 與 numbersCount 是例外：它們的「答案」就是 make() 直接抽到的
       那個原始參數（k／n），中間沒有任何運算可以重算。真正該被驗的是「圖上真的
       畫了那麼多個」，而畫圖的 pic() 碰 DOM，simgen 跑不起來 —— 那一條由全站
       瀏覽器 sweep 守，這裡守不到，不要以為有人在守。 */
    expectedCorrect: function(d, genId, lang){
      const t = DICT(lang);
      switch (genId){
        /* 「這排小方塊……一共量出幾個長度單位？」—— k 是抽到的原始參數（見上面的例外說明）。 */
        case 'countUnits': return String(d.k);
        /* 「A 排和 B 排……哪一排比較長？」 */
        case 'compareByCount': return d.a > d.b ? 'A' : 'B';
        /* 「紅色和藍色的緞帶……哪一條比較長？」 */
        case 'barCompare': return t.barNames[d.wa > d.wb ? 'red' : 'blue'];
        /* 「小方塊量是 smallCount 個，換成大方塊（1 大 = 2 小）會是幾個？」 */
        case 'smallToBig': return String(d.smallCount / 2);
        /* 「大方塊量是 b 個，換成小方塊（1 大 = 2 小）會是幾個？」 */
        case 'bigToSmall': return String(d.b * 2);
        /* 「繩子比 B 長／短，誰比較高？」—— 繩子量的就是 A 的高度。 */
        case 'indirectCompareStory': return t.objNames[d.ropeLonger ? d.keyA : d.keyB];
        /* 「誰的量法才正確？」—— 留縫隙的那個人錯，另一個人對。 */
        case 'gapMistakeSpot': return t.names[d.gapFirst ? d.nameIdxB : d.nameIdxA];
        /* 「用大小不一樣的積木量，準不準？」—— 這一課的規則：一定不準。 */
        case 'mixedSizeMistakeSpot': return t.accLabels.inaccurate;
        /* 「這排圓點一共有幾個？」—— n 是抽到的原始參數（見上面的例外說明）。 */
        case 'numbersCount': return String(d.n);
        /* 「x + y = ?」或「x − y = ?」 */
        case 'addsubWithin20': return String(d.isAdd ? d.x + d.y : d.x - d.y);
        /* 「<形狀名>有幾條邊？」—— 邊數查這個設定檔自己的 SHAPES_REF，
           不是把課程算好的 sides 抄回來。 */
        case 'shapesSides': return String(SHAPES_REF[d.key]);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId, lang){
      const t = DICT(lang);
      switch (genId){
        case 'compareByCount': return ['A','B'].indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'barCompare': return Object.values(t.barNames).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'indirectCompareStory': return Object.values(t.objNames).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'gapMistakeSpot': return t.names.indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'mixedSizeMistakeSpot': return Object.values(t.accLabels).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        default: {
          if (/[·#]/.test(s)) return 'junk option ' + s;
          if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
          const v = Number(s);
          const [lo, hi] = RANGE[genId] || [0, 30];
          if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
          return null;
        }
      }
    },
    /* smallToBig／bigToSmall 的題幹本來就把 smallCount／b 印出來，候選誘答刻意
       用同一個數字（測「有沒有搞懂單位變大/變小」，不是抄錯）。 */
    stemEchoOk: {
      smallToBig: (d, opt) => Number(opt) === d.smallCount,
      bigToSmall: (d, opt) => Number(opt) === d.b
    }
  },

  data: {
    /* ⚠️ qs 同時有 2、3、4 選項的題（這一課本來就混用題型），所以這個題庫的
       選項數檢查在這一課幾乎擋不到東西 —— 這是課程設計如此，不是檢查寫壞。 */
    optCount: { qs: [2, 3, 4], qsAdv: [2, 3], qsBoost: 2 },
    /* 範例的資料表散落在各節 DOM 程式碼中間，在 check() 裡用 src（第四個參數）自己抓。
       dataStart~dataEnd 切的是腳本開頭到 I18N 之前：畫圖工具（只有定義、不執行，不碰 DOM）
       和小遊戲的「語言無關的資料」區（題庫＋版面常數），dataReturn 把後者交給 check()。 */
    dataStart: '  "use strict";',
    dataEnd: '  var I18N = {',
    dataReturn: '{LINE_X, LINE_SNAP, LANE_Y, BAR_H, GAME_LINE, ROPE_FLOOR, ROPE_TX, ROPE_TW, ROPE_SIDE, ROPE_W, ROPE_ICON, GAME_ROPE, CLIP_U, CLIP_RIB_Y, CLIP_TRACK_Y, CLIP_PAD, CLIP_SNAP, GAME_CLIP, JUDGE_X, JUDGE_ROW, GAME_JUDGE, UNIT_BIG, UNIT_X, GAME_UNITS}',
    optionValueMax: 25,
    check: function(data, I18N, fail, src){
      /* 小遊戲的卡片要洗牌（正解不可以固定在同一個位置）—— 卡片統一由 renderTray() 畫，
         守的是**畫出來的順序**，不是資料陣列裡的順序，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const S1_PAIRS = extractArray(src, 'S1_PAIRS');
      S1_PAIRS.forEach((p, i) => {
        if (p.wa === p.wb) fail('S1_PAIRS[' + i + '] wa equals wb — no valid "longer" answer');
        if (p.wa <= 0 || p.wb <= 0) fail('S1_PAIRS[' + i + '] has a non-positive width');
        if (p.offsetB <= 0) fail('S1_PAIRS[' + i + '] offsetB should be positive (it demonstrates a misaligned comparison)');
      });

      const S2_PAIRS = extractArray(src, 'S2_PAIRS');
      const KNOWN_KEYS = Object.keys(ZH.objNames);
      S2_PAIRS.forEach((p, i) => {
        if (p.ha === p.hb) fail('S2_PAIRS[' + i + '] ha equals hb — no valid "taller" answer');
        if (p.ha <= 0 || p.hb <= 0) fail('S2_PAIRS[' + i + '] has a non-positive height');
        if (p.nameKeyA === p.nameKeyB) fail('S2_PAIRS[' + i + '] nameKeyA equals nameKeyB');
        [p.nameKeyA, p.nameKeyB].forEach(k => {
          if (KNOWN_KEYS.indexOf(k) < 0) fail('S2_PAIRS[' + i + '] unknown name key ' + k);
        });
      });

      /* --- 小遊戲：量量看比一比（五關五種玩法，§六之五；2026-10-01 從選擇題改版）——
             答案一律在這裡從「畫出來的長度」重新算一次（緞帶的長、東西的高、方塊的格子），不呼叫頁面的答案邏輯；
             版面數字從 index.html 讀（資料區的常數 + RENDER 函式本體），不在這裡另抄一份。 --- */
      const isInt = v => Number.isInteger(v);
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'line,rope,clip,judge,units') fail('GAME_ORDER should be line,rope,clip,judge,units, got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      /* 最後一關與過關的字：兩邊字典一起少的話 check_i18n 看不到（numbers 改版時真的發生過） */
      ['zh','en'].forEach(L => {
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        if (typeof I18N[L].gWin !== 'function' || !/5/.test(I18N[L].gWin(5))) fail('gWin missing in ' + L);
      });
      /* 句子裡的數字照順序比 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = (text.match(/\d+/g) || []).map(Number).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
      };
      const has = (where, text, part) => { if (typeof text !== 'string' || text.indexOf(part) < 0) fail(where + ' does not say "' + part + '": ' + text); };

      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; ['line','rope','clip','judge','units'].forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const boardH = k => { const m = B[k].match(/makeBoard\(300, (\d+)\)/); if (!m) fail('RENDER.' + k + ' has no 300-wide makeBoard'); return m ? +m[1] : 0; };
      /* 手機上拿得起來、點得到的東西至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍。
         實際量測在端對端測試裡（375px 寬再跑一次）。 */
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const rx = (k, re, what) => { const m = B[k].match(re); if (!m) fail('cannot read ' + what + ' from RENDER.' + k); return m ? m.slice(1).map(Number) : null; };
      const COLORS = ['red', 'blue', 'orange'];

      /* 第 1 關：對齊再比。三條緞帶顏色各不同、長度兩兩差 ≥ 20（看得出來）；一開始沒有一條在起點線上；
         「右端最遠的」不是「最長的」（而且至少遠 10，看得出來）—— 不對齊就比一定會選錯；對齊前後都不出畫板。 */
      {
        const H = boardH('line'), lane = rx('line', /addZone\(B, 0, cy - (\d+), 300, (\d+), 'glane'\)/, 'the lane size');
        tooSmall('a ribbon (BAR_H ' + data.BAR_H + ')', data.BAR_H);
        if (lane){
          const [up, lh] = lane;
          tooSmall('a lane', lh);
          if (data.BAR_H > lh) fail('a ribbon is taller than its lane');
          data.LANE_Y.forEach((y, i) => {
            if (i && y - data.LANE_Y[i - 1] < lh) fail('lanes overlap (LANE_Y ' + data.LANE_Y.join() + ', lane ' + lh + ')');
            if (y - up < 26 || y - up + lh > H) fail('lane ' + i + ' runs into the Start label or out of the board');
          });
        }
        data.GAME_LINE.forEach((set, i) => {
          const bs = set.bars || [];
          if (bs.length !== 3 || bs.length !== data.LANE_Y.length) return fail('GAME_LINE[' + i + '] needs 3 ribbons (one per lane)');
          if (bs.map(b => b.c).sort().join() !== COLORS.slice().sort().join()) fail('GAME_LINE[' + i + '] colours must be red, blue, orange once each');
          bs.forEach(b => {
            if (!isInt(b.w) || !isInt(b.off)) fail('GAME_LINE[' + i + '] non-integer ribbon ' + JSON.stringify(b));
            if (b.off <= data.LINE_SNAP + 4) fail('GAME_LINE[' + i + '] ' + b.c + ' ribbon is already on the Start line (off ' + b.off + ')');
            if (data.LINE_X + b.off + b.w > 296) fail('GAME_LINE[' + i + '] ' + b.c + ' ribbon sticks out of the board before lining up');
            if (b.w < 46) fail('GAME_LINE[' + i + '] ' + b.c + ' ribbon too short to grab');
          });
          const ws = bs.map(b => b.w).sort((a, b) => a - b);
          if (ws[1] - ws[0] < 20 || ws[2] - ws[1] < 20) fail('GAME_LINE[' + i + '] ribbon lengths differ by less than 20: ' + ws.join());
          const longest = bs.reduce((m, b) => b.w > m.w ? b : m), ends = bs.map(b => b.off + b.w), far = bs[ends.indexOf(Math.max(...ends))];
          if (far === longest) fail('GAME_LINE[' + i + '] the longest ribbon also reaches furthest right before lining up — no trap');
          else if (far.off + far.w - (longest.off + longest.w) < 10) fail('GAME_LINE[' + i + '] trap too small to see');
        });
        ['zh','en'].forEach(L => COLORS.forEach(c => {
          const n = I18N[L].gColor && I18N[L].gColor[c];
          if (!n) return fail('gColor.' + c + ' missing in ' + L);
          has('gLineDone ' + L, I18N[L].gLineDone(n), n);
          has('gLineWrong ' + L, I18N[L].gLineWrong(n), n);
          has('gLine2b ' + L, I18N[L].gLine2b(n), n);
        }));
        if (!/function longest\(\)\{ return bars\.reduce\(function\(m, P\)\{ return P\.data\.b\.w > m\.data\.b\.w \? P : m; \}\); \}/.test(B.line)) fail('line: longest() does not pick the ribbon with the biggest w');
        if (!/Math\.abs\(leftX - LINE_X\) > LINE_SNAP\) return false;/.test(B.line)) fail('line: aligning is not tied to the left end being near LINE_X');
        /* 「先對齊、再比」的關卡門檻（codex 第一輪）：三條都對齊才進第二步；第一步點跑道只會說「還沒對齊」，不可以直接選答案 */
        if (!/if \(aligned === bars\.length\)\{ phase = 2; roundInfo\(d\.gLineNext\); \}/.test(B.line)) fail('line: choosing is not unlocked only after all ribbons are lined up');
        if (!/function choose\(P, lane\)\{\s*if \(phase === 1\)\{ roundMiss\(d\.gLineEarly\); return; \}/.test(B.line)) fail('line: choose() lets a child pick before lining up');
      }

      /* 第 2 關：借繩子。兩樣不同的東西、高度差 ≥ 24；繩子站在旁邊不碰到東西；量哪一樣先都推得出對的「比較高」。 */
      {
        const H = boardH('rope');
        tooSmall('the rope strip (ROPE_W ' + data.ROPE_W + ')', data.ROPE_W);
        const coil = rx('rope', /addPiece\(B, \{ w:(\d+), h:(\d+), cx:(\d+), cy:(\d+), text:'🪢', cls:'grope'/, 'the rope coil');
        if (coil) tooSmall('the rope coil', Math.min(coil[0], coil[1]));
        data.ROPE_TX.forEach((x, i) => {
          const rxp = x + (i ? -data.ROPE_SIDE : data.ROPE_SIDE);
          if (Math.abs(rxp - x) < data.ROPE_TW / 2 + 4) fail('the rope strip touches thing ' + i);
          if (rxp - data.ROPE_W / 2 < 0 || rxp + data.ROPE_W / 2 > 300 || x - data.ROPE_TW / 2 < 0 || x + data.ROPE_TW / 2 > 300) fail('thing ' + i + ' or its rope sticks out of the board');
          if (coil && Math.abs(coil[2] - x) < coil[0] / 2 + data.ROPE_TW / 2) fail('the rope coil covers thing ' + i);
        });
        if (data.ROPE_FLOOR + 62 > H) fail('the names under the floor stick out of the board');
        data.GAME_ROPE.forEach((g, i) => {
          if (g.a === g.b) fail('GAME_ROPE[' + i + '] compares a thing with itself');
          [g.a, g.b].forEach(k => {
            if (!data.ROPE_ICON[k] || !I18N.zh.gObj[k] || !I18N.en.gObj[k]) fail('GAME_ROPE[' + i + '] unknown object ' + k);
          });
          if (!isInt(g.ha) || !isInt(g.hb)) fail('GAME_ROPE[' + i + '] non-integer heights');
          if (Math.abs(g.ha - g.hb) < 24) fail('GAME_ROPE[' + i + '] heights differ by less than 24: ' + g.ha + ' vs ' + g.hb);
          [g.ha, g.hb].forEach(h => { if (h < 60 || data.ROPE_FLOOR - h < 30) fail('GAME_ROPE[' + i + '] height ' + h + ' is too short to see or too tall for the board'); });
          /* 量 a 先、量 b 先兩種都推一次：繩子 = 先量的高；繩子比另一樣長 ⇔ 先量的比較高 */
          [[g.a, g.ha, g.b, g.hb], [g.b, g.hb, g.a, g.ha]].forEach(([m, hm, o, ho]) => {
            const longer = hm > ho, taller = g.ha > g.hb ? g.a : g.b;
            if (taller !== (longer ? m : o)) fail('GAME_ROPE[' + i + '] rope reasoning breaks');
            ['zh','en'].forEach(L => {
              const N = I18N[L].gObj, t = I18N[L].gRopeWhy(N[m], N[o], longer, N[taller]);
              has('GAME_ROPE[' + i + '] gRopeWhy ' + L, t, N[taller]);
              has('GAME_ROPE[' + i + '] gRopeWhy ' + L, t, L === 'zh' ? '比' + N[o] + (longer ? '長' : '短') : (longer ? 'longer' : 'shorter') + ' than the ' + N[o]);
            });
          });
        });
        if (!/function taller\(\)\{ return objs\[0\]\.h > objs\[1\]\.h \? objs\[0\] : objs\[1\]; \}/.test(B.rope)) fail('rope: taller() does not pick the thing with the bigger h');
        if (!/var longer = meas\.h > o\.h;/.test(B.rope)) fail('rope: "longer" is not the measured height against the other');
        if (!/function choose\(o, z\)\{\s*if \(phase === 1\)\{ roundMiss\(d\.gRopeFirst\); return; \}\s*if \(phase === 2\)\{ roundMiss\(d\.gRopeCarry\(name\(other\(meas\)\)\)\); return; \}/.test(B.rope)) fail('rope: choose() lets a child pick before the rope is measured and carried over');
      }

      /* 第 3 關：排迴紋針。緞帶 n 個（4～6）剛好放得下；兩個不一樣大的迴紋針差 ≥ 14（看得出來）；
         托盤不重疊、不出界、不在放迴紋針的範圍裡。 */
      {
        const H = boardH('clip'), U = data.CLIP_U;
        const grab = rx('clip', /addPiece\(B, \{ w:Math\.max\((\d+), w \+ (\d+)\), h:(\d+),/, 'the paperclip grab size');
        const tray = rx('clip', /renderTray\(B, items, (\d+), [\s\S]*?\}, (\d+), (\d+)\);/, 'the paperclip tray');
        const placed = rx('clip', /shrink\(P, CLIP_U, (\d+)\);/, 'the placed paperclip size');
        if (grab) tooSmall('a paperclip', Math.min(grab[0], grab[2]));
        data.GAME_CLIP.forEach((g, i) => {
          const L = g.n * U;
          if (!isInt(g.n) || g.n < 4 || g.n > 6) fail('GAME_CLIP[' + i + '] n = ' + g.n + ' should be 4..6');
          if (L > 280) fail('GAME_CLIP[' + i + '] ribbon of ' + g.n + ' clips is wider than the board');
          if (!Array.isArray(g.decoys) || g.decoys.length !== 2) return fail('GAME_CLIP[' + i + '] needs 2 decoy clips');
          g.decoys.forEach(w => { if (!isInt(w) || w < 16 || Math.abs(w - U) < 14) fail('GAME_CLIP[' + i + '] decoy ' + w + ' is not visibly a different size from ' + U); });
          if (grab && tray){
            const items = g.n + 2, [ty, step, cols] = tray, wmax = Math.max(grab[0], ...g.decoys.map(w => w + grab[1]), U + grab[1]);
            if (items > 2 * cols) fail('GAME_CLIP[' + i + '] tray needs more than 2 rows');
            if (step < wmax + 2) fail('paperclip tray pieces overlap (step ' + step + ' < ' + wmax + ')');
            if ((300 - (cols - 1) * step) / 2 - wmax / 2 < 0) fail('the paperclip tray is wider than the board');
            if (ty + 56 * (Math.ceil(items / cols) - 1) + grab[2] / 2 > H) fail('the paperclip tray sticks out of the board');
            if (ty - grab[2] / 2 <= data.CLIP_TRACK_Y + 15 + data.CLIP_PAD) fail('the paperclip tray sits inside the drop area of the ribbon');
          }
          ['zh','en'].forEach(L => {
            seq('GAME_CLIP[' + i + '] ' + L + ' gClipDone', I18N[L].gClipDone(g.n), [g.n]);
            seq('GAME_CLIP[' + i + '] ' + L + ' gClip2', I18N[L].gClip2(g.n, true), [g.n]);
          });
        });
        const trk = rx('clip', /addZone\(B, x0, CLIP_TRACK_Y - (\d+), L, (\d+), 'gtrack'\)/, 'the paperclip track');
        if (placed && trk && placed[0] > trk[1]) fail('placed paperclips are taller than the track');
        has('gClipSize zh', I18N.zh.gClipSize(true), '大'); has('gClipSize zh', I18N.zh.gClipSize(false), '小');
        has('gClipSize en', I18N.en.gClipSize(true), 'bigger'); has('gClipSize en', I18N.en.gClipSize(false), 'smaller');
        if (!/if \(P\.data\.w !== CLIP_U\)\{ roundMiss\(d\.gClipSize\(P\.data\.w > CLIP_U\)\); return false; \}/.test(B.clip)) fail('clip: odd-sized clips are not refused with gClipSize');
        /* 拖的時候看迴紋針本身放在哪：中心離下一個位置 CLIP_SNAP 以內才收（codex 第一輪：整格吸附會把留了縫、疊在一起的放法替孩子排好）。
           CLIP_SNAP 不超過迴紋針長的 1/3；超過就是「放歪了也算」。 */
        if (!(data.CLIP_SNAP > 0 && data.CLIP_SNAP <= U / 3)) fail('CLIP_SNAP ' + data.CLIP_SNAP + ' must be 1..' + U / 3 + ' — a sloppy drop would be snapped into place');
        if (!/if \(Math\.abs\(dx\) > CLIP_SNAP\)\{ roundMiss\(d\.gClipGap\); return false; \}/.test(B.clip)) fail('clip: a drop off the next spot is not refused with gClipGap');
        if (!/B\.onDrop = function\(P\)\{ return onRibbon\(\{ x:P\.cx, y:P\.cy \}\) \? put\(P, P\.cx - next\(\)\) : false; \};/.test(B.clip)) fail('clip: a drag is not judged by where the clip itself lands');
        /* 點的路徑：只收點在緞帶本身上的那一下（左右端外面不收），而且點在哪一格就是放哪一格，不吸到別格 */
        if (!/if \(!onRibbon\(pt\) \|\| pt\.x < x0 \|\| pt\.x >= x0 \+ L\) return false;\s*var j = Math\.floor\(\(pt\.x - x0\) \/ CLIP_U\);\s*return put\(P, j < k \? -CLIP_U : \(j - k\) \* CLIP_U\);/.test(B.clip)) fail('clip: the tap path does not place the clip exactly in the tapped cell of the ribbon');
        has('gClipGap zh', I18N.zh.gClipGap, '不留縫'); has('gClipGap zh', I18N.zh.gClipGap, '不疊'); has('gClipGap en', I18N.en.gClipGap, 'no gaps'); has('gClipGap en', I18N.en.gClipGap, 'overlap');
      }

      /* 第 4 關：誰量得準。三排畫出來的格子從原始碼的 cells() 切出來執行，再在這裡**看幾何**分類：
         量對的那排 = 一樣大、頭尾相接、剛好從頭到尾；有縫那排 = 一樣大、每個縫 ≥ 8、頭尾都到；大小不一那排 = 沒縫、頭尾都到、最大 ÷ 最小 ≥ 1.5。 */
      {
        const H = boardH('judge');
        const cm = B.judge.match(/(function cells\(t\)\{[\s\S]*?\n {6}\})\n/);
        const slot = rx('judge', /addZone\(B, (\d+), y \+ (\d+), (\d+), (\d+), 'gslot'\)/, 'the sign box');
        const card = rx('judge', /addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:d\.gJudgeLbl\[t\]/, 'the sign size');
        const tray = rx('judge', /renderTray\(B, \['ok', 'gap', 'mix'\], (\d+), [\s\S]*?\}, (\d+)\);/, 'the sign tray');
        if (card){ tooSmall('a sign', Math.min(card[0], card[1])); }
        if (slot && card && (card[0] > slot[2] || card[1] > slot[3])) fail('a sign does not fit its box');
        if (tray && card){
          if (tray[1] < card[0] + 2) fail('signs in the tray overlap');
          if (tray[0] + card[1] / 2 > H || tray[0] - card[1] / 2 < 6 + 2 * data.JUDGE_ROW + 60) fail('the sign tray runs into the rows or out of the board');
        }
        if (!cm) fail('cannot cut cells() out of RENDER.judge');
        data.GAME_JUDGE.forEach((g, i) => {
          if (!isInt(g.len) || !isInt(g.n) || g.len % g.n) return fail('GAME_JUDGE[' + i + '] len ' + g.len + ' is not a whole number of ' + g.n + ' units');
          if (slot && data.JUDGE_X + g.len > slot[0] - 4) fail('GAME_JUDGE[' + i + '] ribbon runs into the sign box');
          if (!(g.gapK >= 3 && g.gapK < g.n)) fail('GAME_JUDGE[' + i + '] gap row needs 3..n-1 units');
          if (!cm) return;
          const U = g.len / g.n, cells = new Function('g', 'U', cm[1] + '\n; return cells;')(g, U);
          const seen = {};
          ['ok','gap','mix'].forEach(t => {
            const cs = cells(t).slice().sort((a, b) => a.x - b.x), ws = cs.map(c => c.w);
            const gaps = cs.slice(1).map((c, k) => c.x - (cs[k].x + cs[k].w));
            const spans = cs.length > 1 && Math.abs(cs[0].x) < 0.01 && Math.abs(cs[cs.length - 1].x + cs[cs.length - 1].w - g.len) < 0.01;
            const same = Math.max(...ws) - Math.min(...ws) < 0.01, tight = gaps.every(x => Math.abs(x) < 0.01);
            if (!spans) fail('GAME_JUDGE[' + i + '] ' + t + ' row does not span the ribbon from end to end');
            if (gaps.some(x => x < -0.01)) fail('GAME_JUDGE[' + i + '] ' + t + ' row has overlapping blocks');
            if (cs.some(c => c.w < 16)) fail('GAME_JUDGE[' + i + '] ' + t + ' row has a block too thin to see');
            seen[t] = same && tight ? 'ok' : (same && gaps.every(x => x >= 8) ? 'gap' : (tight && Math.max(...ws) / Math.min(...ws) >= 1.5 ? 'mix' : 'unclear'));
            if (seen[t] !== t) fail('GAME_JUDGE[' + i + '] the ' + t + ' row is drawn as ' + seen[t] + (t === 'gap' ? ' (gap row gaps ' + gaps.map(x => x.toFixed(1)).join() + ')' : ''));
          });
          if (g.mix.reduce((a, b) => a + b, 0) !== g.len) fail('GAME_JUDGE[' + i + '] mix widths add up to ' + g.mix.reduce((a, b) => a + b, 0) + ', not ' + g.len);
        });
        if (data.JUDGE_ROW < 66) fail('judge rows overlap');
        /* 上面是 cells() 的數字；畫出來看不看得到縫還要看 .gcell 的樣式（codex 第一輪：白色 border-right 在米色畫板上就是一道縫，
           「量對了」那排和換單位那兩排都會看起來有縫）。分隔線只准畫在方塊裡面（inset 陰影），不准有邊框、外距。 */
        const cellCss = (src.match(/\n  \.gcell\{([^}]*)\}/) || [])[1];
        if (cellCss === undefined) fail('cannot find the .gcell CSS rule');
        else {
          /* 只收「inset 橫向 1~3px、沒有 spread、看得見的顏色」：transparent 或 spread 很大（整塊塗滿）都不算分隔線（codex 第三輪） */
          const sh = cellCss.match(/box-shadow:inset (-?\d+)px 0 0 rgba\(\d+,\s*\d+,\s*\d+,\s*(0?\.\d+|1)\);/);
          if (!sh || Math.abs(+sh[1]) < 1 || Math.abs(+sh[1]) > 3 || +sh[2] < 0.2) fail('.gcell needs a 1~3px inset divider on one side so neighbouring blocks stay visible without a gap');
        }
        /* 任何選擇器只要碰到 .gcell（包括 `.gboard .gcell` 這種後代選擇器，codex 第二輪）都不准加邊框、外距、外框 */
        (src.match(/[^{}]*\.gcell[^{}]*\{[^}]*\}/g) || []).forEach(rule => {
          if (/[;{\s](border|margin|outline)(-[a-z]+)*\s*:/.test(rule)) fail('.gcell has a border/margin/outline — it shows as a gap between blocks: ' + rule.trim().slice(0, 120));
        });
        ['zh','en'].forEach(L => {
          const lb = I18N[L].gJudgeLbl || {}, why = I18N[L].gJudgeWhy || {};
          ['ok','gap','mix'].forEach(t => { if (!lb[t] || !why[t]) fail('gJudgeLbl/gJudgeWhy.' + t + ' missing in ' + L); });
          if (!/✓/.test(lb.ok) || !/✗/.test(lb.gap) || !/✗/.test(lb.mix)) fail('gJudgeLbl ' + L + ': fair sign needs ✓, the others ✗');
          has('gJudgeWhy.gap ' + L, why.gap, L === 'zh' ? '縫' : 'gap');
          has('gJudgeWhy.mix ' + L, why.mix, L === 'zh' ? '大小不一樣' : 'different sizes');
          has('gJudgeWhy.ok ' + L, why.ok, L === 'zh' ? '一樣大' : 'same size');
        });
      }

      /* 第 5 關：換單位。小方塊、大方塊（UNIT_BIG 倍）都剛好排滿；個數從長度算；數字卡從原始碼的式子代入，
         四張兩兩不同、有兩排的正解；「放錯排」的說明大方塊說「比較少」、小方塊說「比較多」。 */
      {
        const H = boardH('units');
        const tm = B.units.match(/renderTray\(B, \[([^\]]+)\], (\d+), card, (\d+)\);/);
        const card = rx('units', /addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:String\(v\), cls:'gcard'/, 'the number card size');
        const slot = rx('units', /addZone\(B, (\d+), r\.y - (\d+), (\d+), (\d+), 'gslot'\)/, 'the count box');
        if (card) tooSmall('a number card', Math.min(card[0], card[1]));
        if (!tm) fail('cannot read the number-card tray of RENDER.units');
        else if (card){
          if (+tm[3] < card[0] + 2) fail('number cards in the tray overlap');
          if ((300 - 3 * +tm[3]) / 2 - card[0] / 2 < 0 || +tm[2] + card[1] / 2 > H) fail('the number-card tray sticks out of the board');
        }
        data.GAME_UNITS.forEach((g, i) => {
          const bu = g.su * data.UNIT_BIG;
          if (!isInt(g.su) || !isInt(g.len) || g.len % g.su || g.len % bu) return fail('GAME_UNITS[' + i + '] len ' + g.len + ' is not a whole number of small (' + g.su + ') and big (' + bu + ') blocks');
          if (slot && data.UNIT_X + g.len > slot[0] - 4) fail('GAME_UNITS[' + i + '] ribbon runs into the count boxes');
          if (g.su < 20) fail('GAME_UNITS[' + i + '] small blocks too thin to count');
          const nS = g.len / g.su, nB = g.len / bu;
          if (nS > 10 || nB < 2) fail('GAME_UNITS[' + i + '] counts ' + nS + '/' + nB + ' out of 2..10');
          if (tm){
            const cards = new Function('nS', 'nB', 'return [' + tm[1] + '];')(nS, nB);
            if (cards.length !== 4 || new Set(cards).size !== 4 || cards.indexOf(nS) < 0 || cards.indexOf(nB) < 0 || cards.some(v => !isInt(v) || v < 1 || v > 20))
              fail('GAME_UNITS[' + i + '] number cards ' + cards.join() + ' must be 4 different whole numbers incl. ' + nS + ' and ' + nB);
          }
          ['zh','en'].forEach(L => {
            seq('GAME_UNITS[' + i + '] ' + L + ' gUnitsDone', I18N[L].gUnitsDone(nS, nB), [nS, nB]);
            seq('GAME_UNITS[' + i + '] ' + L + ' gUnits2', I18N[L].gUnits2(nS), [nS, nS]);
          });
        });
        has('gUnitsFewer zh', I18N.zh.gUnitsFewer(4), '比較少'); has('gUnitsMore zh', I18N.zh.gUnitsMore(4), '比較多');
        has('gUnitsFewer en', I18N.en.gUnitsFewer(4), 'fewer'); has('gUnitsMore en', I18N.en.gUnitsMore(4), 'more');
        if (!/if \(v === o\.n\) roundMiss\(r\.big \? d\.gUnitsFewer\(v\) : d\.gUnitsMore\(v\)\);/.test(B.units)) fail('units: the wrong-row reason is not gUnitsFewer on the big row / gUnitsMore on the small row');
      }
    }
  }
};
