/* grade-1/math/numbers 的檢查設定（100 以內數：數數、位值、比大小、排隊順序）。

   index.html 的語言無關資料不是集中在一段（PV_CHOICES／PILE_PAIRS／NUM_PAIRS／
   ANIMALS／buildRounds() 都散落在各節的 DOM 程式碼中間，中間夾著會在載入時就執行
   的 document.getElementById(...).addEventListener(...)），沒辦法用一段
   dataStart~dataEnd 一次切出來執行。dataStart~dataEnd 只切「語言無關的小工具」
   （zhNum／enNum／dotsSvg／blocksSvg，這幾個純函式在檔案最前面，不碰 DOM），
   其餘幾個表格改成在 check() 裡用 src（第四個參數）自己抓字串重新 eval —— 這正是
   tools/README.md 說的「不變式只有在原始碼層才驗得到」的那種情況。 */

const ANIMALS = ['🐰', '🐢', '🐱', '🐶', '🐥', '🦊', '🐻', '🐸'];

/* ---------- 數詞 → 數字：readNumberWord 的第二套實作 ----------
   課程的 zhNum()／enNum() 走的是「數字 → 數詞」，這裡走**相反方向**，而且對照表是
   這個檔案自己寫的，所以不是拿課本比課本。讀不懂的數詞一律回 null（fail closed），
   不會因為「解析失敗」就安靜放行。
   ⚠️ 認得的範圍是 **10~99**（「十」與 "ten" 也讀得出來），不是只有 11~99 ——
   readNumberWord 只會抽到 11~99（num = 11 + rand(89)），但這兩個函式本身不以此為前提。
   100 以上、個位數、以及任何不符合這兩種寫法的字串一律回 null。 */
const ZH_DIGITS = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
function zhWordToNum(w){
  /* 「十」「十三」＝ 10、13；「三十」「三十二」＝ 30、32。 */
  let m = /^十([一二三四五六七八九])?$/.exec(w);
  if (m) return 10 + (m[1] ? ZH_DIGITS[m[1]] : 0);
  m = /^([二三四五六七八九])十([一二三四五六七八九])?$/.exec(w);
  if (m) return ZH_DIGITS[m[1]] * 10 + (m[2] ? ZH_DIGITS[m[2]] : 0);
  return null;
}
const EN_ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
                  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function enWordToNum(w){
  const s = String(w).trim().toLowerCase();
  const teen = EN_TEENS.indexOf(s);
  if (teen >= 0) return 10 + teen;
  const parts = s.split('-');
  if (parts.length > 2) return null;
  const t = EN_TENS.indexOf(parts[0]);
  if (t < 2) return null;                       /* '' 與 index 1 都不是合法的十位詞 */
  if (parts.length === 1) return t * 10;
  const o = EN_ONES.indexOf(parts[1]);
  if (o < 1) return null;                       /* 'twenty-' 或 'twenty-zero' 一律不接受 */
  return t * 10 + o;
}

function extractArray(src, varName){
  const m = src.match(new RegExp('var ' + varName + ' = (\\[[\\s\\S]*?\\]);'));
  if (!m) throw new Error('cannot find var ' + varName + ' in source');
  return new Function('return ' + m[1] + ';')();
}
function extractRounds(src){
  const m = src.match(/function buildRounds\(\)\{\s*return (\[[\s\S]*?\]);\s*\}/);
  if (!m) throw new Error('cannot find buildRounds() in source');
  return new Function('return ' + m[1] + ';')();
}

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(round.choices).forEach(function(v){',
      replace:'    round.choices.forEach(function(v){' },
    /* shuffle() 還在被呼叫，但它自己不洗了（交換那兩行變成原地打轉）。
       ⚠️ 只比對「有沒有寫 shuffle(...)」的話這個改壞會一路綠燈；連「定義裡有沒有
       Math.random」也擋不住（codex 第三輪給的反例：`Math.random(); return arr;`）。
       lib/gameshuffle.js 因此是**把 shuffle 切出來實際跑 200 次**，
       要求它至少產生兩種順序、是原陣列的排列、而且不可以改到輸入。 */
    { file:'index', expect:'returned the same order in all 200 runs',
      find:'      var k = Math.floor(Math.random() * (j + 1));\n      var t = a[j]; a[j] = a[k]; a[k] = t;',
      replace:'      var t = a[j]; a[j] = a[j]; a[j] = t;' },
    { file:'review', expect:'k*n != ans',
      find:'        var ans = k * n;\n        var m = mixOpts(ans, [ans - k, ans + k, (n - 1) * k, (n + 1) * k]);',
      replace:'        var ans = k * n + 1;\n        var m = mixOpts(ans, [ans - k, ans + k, (n - 1) * k, (n + 1) * k]);' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c > 0 && c <= 100 && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c > 0 && c <= 100){ out.push(c); }' },
    { file:'review', expect:'tens*10+ones != ans',
      find:'        var tens = 1 + rand(9), ones = rand(10);\n        var ans = tens * 10 + ones;',
      replace:'        var tens = 1 + rand(9), ones = rand(10);\n        var ans = tens * 10 + ones + 1;' },
    /* --- 三筆專門證明 renderCheck（數詞讀回數字）真的在做事的改壞 ---
       ⚠️ 這三筆都必須印出**合法但錯的**數詞，或**根本讀不出來的**數詞。
       印出含 undefined 的字串是不算數的：simgen.js 自己就有一條全站共用的
       `/undefined|NaN/` 檢查會先響，那樣證明的是那一條，不是 renderCheck。
       （codex 第一輪點出原本的英文那一筆有這個問題 —— 它給的理由是「data.check
       已經在守」，那個理由是錯的：file:'review' 的改壞只會跑 simgen.js，
       data.check 住在 verify_lesson_data.js／index.html，這裡根本不會執行。
       理由錯，結論對。） */
    /* ① 中文：十位和個位對調，23 印成「三十二」—— 完全合法的數詞，只是指到別的數。
       這一筆測的是「讀回來的數字和被標成正解的選項比對」那一段。 */
    { file:'review', expect:'but the option marked correct is',
      find:"    return zhDigit(t) + '十' + (o2 ? zhDigit(o2) : '');",
      replace:"    return zhDigit(o2 || t) + '十' + (o2 ? zhDigit(t) : '');" },
    /* ② 英文：個位的詞往前移一格，23 印成 "twenty-two" —— 同樣是合法但錯的數詞。
       （`ones[o - 1]` 對 o = 1 會得到空字串 "twenty-"，那一種由解析失敗那條路接住。） */
    { file:'review', expect:'but the option marked correct is',
      find:"    return tensW[t] + (o ? '-' + ones[o] : '');",
      replace:"    return tensW[t] + (o ? '-' + ones[o - 1] : '');" },
    /* ③ 中文十幾的寫法：13 印成「一十三」（這一課的寫法是「十三」）。
       這一筆測的是另一條路 —— 讀不出來時要響，不可以安靜放行。 */
    { file:'review', expect:'cannot read the number word',
      find:"    if (n < 20){ var o = n % 10; return '十' + (o ? zhDigit(o) : ''); }",
      replace:"    if (n < 20){ var o = n % 10; return (o ? '一' : '') + '十' + (o ? zhDigit(o) : ''); }" },
    { file:'index', expect:'PV_CHOICES has 105 outside 10~99',
      find:'  var PV_CHOICES = [23, 34, 47, 58, 62, 76, 89];',
      replace:'  var PV_CHOICES = [23, 34, 47, 58, 62, 76, 105];' },
    { file:'index', expect:'PILE_PAIRS[2] has equal counts',
      find:'  var PILE_PAIRS = [[6, 9], [8, 5], [7, 10], [4, 7], [9, 3]];',
      replace:'  var PILE_PAIRS = [[6, 9], [8, 5], [7, 7], [4, 7], [9, 3]];' },
    { file:'index', expect:'ROUNDS[1] blocks tens+ones != n',
      find:"      { kind:'blocks', n:26, tens:2, ones:6, choices:[26, 62, 20, 6, 36, 16] },",
      replace:"      { kind:'blocks', n:26, tens:2, ones:7, choices:[26, 62, 20, 6, 36, 16] }," },
    { file:'index', expect:'ROUNDS[0] n not among choices',
      find:'      { kind:\'dots\', n:14, choices:[14, 15, 13, 41, 17, 10] },',
      replace:'      { kind:\'dots\', n:99, choices:[14, 15, 13, 41, 17, 10] },' }
  ],

  sim: {
    blockStart: '  function zhDigit(n){',
    INVARIANTS: {
      countBy: d => {
        if (d.k * d.n !== d.ans) return 'k*n != ans';
        if ([2,5,10].indexOf(d.k) < 0) return 'k outside {2,5,10}';
        if (d.n < 4 || d.n > 9) return 'n outside 4~9';
      },
      buildNumber: d => {
        if (d.tens * 10 + d.ones !== d.ans) return 'tens*10+ones != ans';
        if (d.tens < 1 || d.tens > 9) return 'tens outside 1~9';
        if (d.ones < 0 || d.ones > 9) return 'ones outside 0~9';
      },
      decomposeTens: d => {
        if (Math.floor(d.num / 10) !== d.tens) return 'floor(num/10) != tens';
        if (d.num % 10 !== d.ones) return 'num%10 != ones';
        if (d.num < 10 || d.num > 99) return 'num outside 10~99';
      },
      decomposeOnes: d => {
        if (Math.floor(d.num / 10) !== d.tens) return 'floor(num/10) != tens';
        if (d.num % 10 !== d.ones) return 'num%10 != ones';
      },
      compareLarger: d => {
        if (Math.max(d.a, d.b) !== d.big) return 'max(a,b) != big';
        if (Math.min(d.a, d.b) !== d.small) return 'min(a,b) != small';
        if (d.a === d.b) return 'a equals b — not a valid compare pair';
        if (d.a < 10 || d.a > 99 || d.b < 10 || d.b > 99) return 'a/b outside 10~99';
      },
      nextPrevNumber: d => {
        const want = d.dir === 'next' ? d.base + 1 : d.base - 1;
        if (want !== d.ans) return 'why direction does not match ans';
        if (d.ans < 1 || d.ans > 99) return 'ans outside 1~99';
      },
      ordinalPosition: d => {
        if (ANIMALS[d.n - 1] !== d.correctIcon) return 'ANIMALS[n-1] != correctIcon';
        if (d.n < 1 || d.n > 8) return 'n outside 1~8 (ANIMALS has 8 icons)';
      },
      readNumberWord: d => {
        if (d.num < 11 || d.num > 99) return 'num outside 11~99';
      }
    },
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀題幹上真的印出來的那幾個數字**，然後自己算一次。
       不可以讀回 make() 算好的答案欄位（ans／tens／ones／big／correctIcon）——
       那等於拿課本的答案比課本的答案，課本算錯時兩邊一起錯，檢查照樣綠燈。
       每一行上面的註解是「孩子看到的題幹」，答案就是從那句話推出來的。
       ⚠️ readNumberWord 是唯一的例外，理由寫在它那一行；它真正的守門員是下面的
       renderCheck（把畫面上那個數詞讀回數字）。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「k、2k、3k……這樣數下去，第 n 個是多少？」 */
        case 'countBy':          return String(d.k * d.n);
        /* 「tens 個十和 ones 個一，合起來是多少？」 */
        case 'buildNumber':      return String(d.tens * 10 + d.ones);
        /* 「num 有幾個十？」 */
        case 'decomposeTens':    return String(Math.floor(d.num / 10));
        /* 「num 有幾個一？」 */
        case 'decomposeOnes':    return String(d.num % 10);
        /* 「a 和 b，哪個比較大？」 */
        case 'compareLarger':    return String(Math.max(d.a, d.b));
        /* 「base 的後一個／前一個數是多少？」 */
        case 'nextPrevNumber':   return String(d.dir === 'next' ? d.base + 1 : d.base - 1);
        /* 「排隊：…… 第 n 個是誰？」—— 正解是動物 emoji，不是數字。
           ANIMALS 是這個設定檔自己寫的一份清單（檔案最上面），不是從課程讀來的，
           所以這一行是真的重算，不是把課本的 correctIcon 抄回來。 */
        case 'ordinalPosition':  return ANIMALS[d.n - 1];
        /* 「『三十二』是多少？」—— 題幹上印的是**數詞**，數字本身沒有印出來，
           而 num 是 make() 直接抽到的原始參數（不是任何運算的結果），
           所以在這裡沒有第二套算法可寫，這一行**確實**只是把原始參數印出來。
           ⚠️ 這一題真正的守門員是下面的 renderCheck：它把畫面上那個數詞讀回數字，
           並且直接和**被標成正解的那個選項**比 —— 獨立性在那裡，不在這一行。 */
        case 'readNumberWord':   return String(d.num);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    /* readNumberWord 的守門員：把題幹上那個數詞**讀回數字**，再和被標成正解的
       那個選項比。方向和課程的 zhNum()／enNum() 相反（數字→數詞 vs 數詞→數字），
       對照表是這個檔案自己寫的，所以這是真的第二套實作。
       ⚠️ 要比的是 **q.opts[q.ans]**，不是 d.num —— 和 d.num 比只證明得了
       「數詞和那個抽到的數一致」，比不到「被標成正解的那個選項是對的」。
       兩件事都要：數詞印錯、或正解標到別的選項，都必須響。
       沒有這一條的話，zhNum() 把 23 印成「三十二」不會有任何人發現：
       選項、正解、解釋全部是數字，只有題幹是數詞。 */
    renderCheck: function(d, q, lang, genId){
      if (genId !== 'readNumberWord') return null;
      const m = lang === 'zh' ? /『(.+?)』/.exec(q.stem) : /[“"](.+?)[”"]/.exec(q.stem);
      if (!m) return 'readNumberWord stem has no quoted number word: ' + q.stem;
      const got = lang === 'zh' ? zhWordToNum(m[1]) : enWordToNum(m[1]);
      if (got === null) return 'cannot read the number word "' + m[1] + '" back to a number';
      const keyed = String(q.opts[q.ans]);
      if (String(got) !== keyed){
        return 'stem says "' + m[1] + '" (= ' + got + ') but the option marked correct is ' + keyed;
      }
      return null;
    },
    optionOk: function(s, genId){
      if (genId === 'ordinalPosition'){
        return ANIMALS.indexOf(s) < 0 ? ('option "' + s + '" is not one of this lesson\'s animal icons') : null;
      }
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      if (!(v >= 0 && v <= 100)) return 'option ' + s + ' outside 0~100';
      return null;
    },
    /* 題幹本來就印出來的數字，刻意拿來當誘答。 */
    stemEchoOk: {
      countBy: (d, opt) => [d.k, d.k * 2, d.k * 3].indexOf(Number(opt)) >= 0,
      buildNumber: (d, opt) => Number(opt) === d.tens || Number(opt) === d.ones,
      decomposeTens: (d, opt) => Number(opt) === d.num,
      decomposeOnes: (d, opt) => Number(opt) === d.num,
      compareLarger: (d, opt) => Number(opt) === d.a || Number(opt) === d.small,
      nextPrevNumber: (d, opt) => Number(opt) === d.base
    }
  },

  data: {
    /* 只切「語言無關的小工具」這一段（純函式，不碰 DOM）；PV_CHOICES 等表格
       在 check() 裡自己從 src 重新抓出來（見檔案開頭的說明）。 */
    dataStart: '  /* ---------- 語言無關的小工具 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{zhNum, enNum, dotsSvg, blocksSvg}',
    optionValueMax: 100,
    check: function(data, I18N, fail, src){
      /* --- zhNum／enNum 本身要對，別的檢查全靠它們 --- */
      const NUM_WORD_CASES = [1, 5, 9, 10, 11, 15, 19, 20, 23, 47, 58, 89, 99, 100];
      NUM_WORD_CASES.forEach(n => {
        const zw = data.zhNum(n), ew = data.enNum(n);
        if (typeof zw !== 'string' || !zw.length || /undefined|NaN/.test(zw)) fail('zhNum(' + n + ') broken: ' + zw);
        if (typeof ew !== 'string' || !ew.length || /undefined|NaN/.test(ew)) fail('enNum(' + n + ') broken: ' + ew);
      });
      /* 十位／個位要真的出現在中文數字讀法裡（例如 47 要唸「四十七」，
         不能只驗字串非空）。 */
      [[23,'二十三'],[47,'四十七'],[58,'五十八'],[10,'十'],[20,'二十'],[100,'一百']].forEach(([n,want]) => {
        if (data.zhNum(n) !== want) fail('zhNum(' + n + ') = "' + data.zhNum(n) + '", expected "' + want + '"');
      });

      /* --- 範例 1：數數（PV_CHOICES 沒有；這一節用 dotsSvg，SVG 幾何靠 canvas.js） --- */
      const { canvasProblems } = require('./lib/canvas.js');
      [7, 14, 26].forEach(n => {
        canvasProblems(data.dotsSvg(n)).forEach(p => fail('dotsSvg(' + n + '): ' + p));
      });
      [[2,6],[5,0],[9,9]].forEach(([tens,ones]) => {
        canvasProblems(data.blocksSvg(tens, ones)).forEach(p => fail('blocksSvg(' + tens + ',' + ones + '): ' + p));
      });

      /* --- 範例 2：位值 --- */
      const PV_CHOICES = extractArray(src, 'PV_CHOICES');
      PV_CHOICES.forEach((n, i) => {
        if (!(n >= 10 && n <= 99)) fail('PV_CHOICES has ' + n + ' outside 10~99');
      });
      if (new Set(PV_CHOICES).size !== PV_CHOICES.length) fail('PV_CHOICES has duplicates');
      ['zh','en'].forEach(L => {
        PV_CHOICES.forEach(n => {
          const t = I18N[L].pvEq(n, Math.floor(n / 10), n % 10);
          if (/undefined|NaN/.test(t)) fail('pvEq ' + L + '(' + n + '): ' + t);
        });
      });

      /* --- 範例 4：比大小（PILE_PAIRS 數量比較 + NUM_PAIRS 兩位數比較） --- */
      const PILE_PAIRS = extractArray(src, 'PILE_PAIRS');
      PILE_PAIRS.forEach((pair, i) => {
        const [a, b] = pair;
        if (a === b) fail('PILE_PAIRS[' + i + '] has equal counts ' + a + '/' + b + ' — no valid "bigger" answer');
        if (a < 1 || b < 1) fail('PILE_PAIRS[' + i + '] has a non-positive count');
      });
      const NUM_PAIRS = extractArray(src, 'NUM_PAIRS');
      NUM_PAIRS.forEach((pair, i) => {
        const [a, b] = pair;
        if (a === b) fail('NUM_PAIRS[' + i + '] has equal numbers ' + a + '/' + b);
        if (!(a >= 10 && a <= 99) || !(b >= 10 && b <= 99)) fail('NUM_PAIRS[' + i + '] outside 10~99: ' + a + '/' + b);
        ['zh','en'].forEach(L => {
          const big = Math.max(a, b), small = Math.min(a, b);
          const sameT = Math.floor(a / 10) === Math.floor(b / 10);
          const t1 = I18N[L].numFbRight(big, small, sameT);
          const t2 = I18N[L].numFbWrong(big);
          [t1, t2].forEach(t => { if (/undefined|NaN/.test(t)) fail('NUM_PAIRS[' + i + '] ' + L + ' text has undefined/NaN: ' + t); });
        });
      });

      /* --- 範例 5：順序序數 --- */
      const ANIMALS_SRC = extractArray(src, 'ANIMALS');
      if (ANIMALS_SRC.length !== 8) fail('ANIMALS should have 8 icons, has ' + ANIMALS_SRC.length);
      if (new Set(ANIMALS_SRC).size !== ANIMALS_SRC.length) fail('ANIMALS has duplicate icons');
      if (JSON.stringify(ANIMALS_SRC) !== JSON.stringify(ANIMALS))
        fail('index.html ANIMALS no longer matches review.html\'s copy — the ordinalPosition generator in review.html hardcodes its own list and will drift silently: ' + JSON.stringify(ANIMALS_SRC));

      /* --- 小遊戲：數字大搜查 --- */
      const ROUNDS = extractRounds(src);
      ROUNDS.forEach((r, i) => {
        if (r.choices.indexOf(r.n) < 0) fail('ROUNDS[' + i + '] n not among choices');
        if (new Set(r.choices).size !== r.choices.length) fail('ROUNDS[' + i + '] duplicate choices');
        if (r.kind === 'blocks' && r.tens * 10 + r.ones !== r.n) fail('ROUNDS[' + i + '] blocks tens+ones != n');
        if (['dots','blocks','word'].indexOf(r.kind) < 0) fail('ROUNDS[' + i + '] unknown kind ' + r.kind);
        if (r.kind === 'dots' || r.kind === 'word'){
          /* dots/word 這兩種沒有 tens/ones，n 只要在合理範圍。dots 用 dotsSvg(n) 畫，
             太大的 n 會畫不下（round0~round3 都在 30 以內，這裡守住上限）。 */
          if (r.kind === 'dots' && (r.n < 1 || r.n > 30)) fail('ROUNDS[' + i + '] dots n=' + r.n + ' is impractically large to count by eye');
        }
      });
      /* 小遊戲的選項要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的按鈕**，不是 choices 陣列裡的順序，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1).forEach(fail);
    }
  }
};
