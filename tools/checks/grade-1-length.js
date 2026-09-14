/* grade-1/math/length 的檢查設定（長度：直接比較、間接比較、個別單位、對齊）。

   ⚠️ 這一課的 11 個產生器裡有 5 個（compareByCount／barCompare／indirectCompareStory／
   gapMistakeSpot／mixedSizeMistakeSpot）用 mixTwo()，只出 2 個選項，不是全站慣例的
   4 個 —— 和 grade-1-two-digit.js／grade-1-pattern.js 同一種結構性衝突
   （tools/simgen.js 的選項數檢查寫死是 4）。另外 6 個產生器（countUnits／
   smallToBig／bigToSmall／numbersCount／addsubWithin20／shapesSides）是正常的
   4 選項，可以完整驗證。

   index.html 的語言無關資料（S1_PAIRS／S2_PAIRS／ROUNDS）散落在各節的 DOM 程式碼
   中間（和 grade-1-numbers.js 同一種情形），改用 check() 裡從 src 重新抓字串。 */

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

module.exports = {
  breaks: [
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
    { file:'index', expect:'ROUNDS[1] count outline not a whole number of units',
      find:"    { type:'count', outline:160, unit:40 },",
      replace:"    { type:'count', outline:161, unit:40 }," }
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
    /* 這一課的資料表散落在各節 DOM 程式碼中間，沒有一段可以整段安全 eval——
       改成一個幾乎不切東西的最小 dataStart~dataEnd，其餘全部在 check() 裡用
       src（第四個參數）自己抓出來。 */
    dataStart: '  "use strict";',
    dataEnd: '  var I18N = {',
    dataReturn: '{}',
    optionValueMax: 25,
    check: function(data, I18N, fail, src){
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

      const ROUNDS = extractArray(src, 'ROUNDS');
      ROUNDS.forEach((r, i) => {
        if (r.type === 'compare'){
          if (r.barA === r.barB) fail('ROUNDS[' + i + '] compare round: barA equals barB');
          if (r.barA <= 0 || r.barB <= 0) fail('ROUNDS[' + i + '] compare round has a non-positive bar width');
        } else if (r.type === 'count'){
          if (r.outline % r.unit !== 0) fail('ROUNDS[' + i + '] count outline not a whole number of units');
          if (r.outline / r.unit < 1) fail('ROUNDS[' + i + '] count round has fewer than one unit');
        } else {
          fail('ROUNDS[' + i + '] unknown type ' + r.type);
        }
      });
    }
  }
};
