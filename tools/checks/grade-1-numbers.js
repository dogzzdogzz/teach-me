/* grade-1/math/numbers 的檢查設定（100 以內數：數數、位值、比大小、排隊順序）。

   index.html 的語言無關資料不是集中在一段（PV_CHOICES／PILE_PAIRS／NUM_PAIRS／
   ANIMALS／GAME_* 題庫都散落在各節的 DOM 程式碼中間，中間夾著會在載入時就執行
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

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });',
      replace:'    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });' },
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
    /* --- 小遊戲（2026-10-01 改成五關五種玩法）：每一條不變量各有一筆，證明它真的會響 --- */
    /* 百數板：誘答卡就是某一個空格要的數 —— 兩張一樣的卡，其中一張「錯」。 */
    { file:'index', expect:'decoy 34 equals a blank',
      find:"    { row:2, col:3, blanks:[[0,4],[1,1],[2,3]], decoys:[72, 64] },",
      replace:"    { row:2, col:3, blanks:[[0,4],[1,1],[2,3]], decoys:[72, 34] }," },
    /* 百數板：同一排空兩格 —— 右邊那一格旁邊就沒有看得到的數，「為什麼」那句話會指向空格。 */
    { file:'index', expect:'needs exactly one blank in each row',
      find:"    { row:5, col:4, blanks:[[0,2],[1,4],[2,1]], decoys:[86, 46] },",
      replace:"    { row:5, col:4, blanks:[[0,2],[0,3],[2,1]], decoys:[86, 46] }," },
    /* 百數板：視窗跑出百數板右邊（個位 7 起算，第 5 格是 11 —— 它其實在下一排的最左邊）。 */
    { file:'index', expect:'runs off the right edge of the hundred chart',
      find:"    { row:6, col:6, blanks:[[0,4],[1,2],[2,0]], decoys:[60, 96] }",
      replace:"    { row:6, col:7, blanks:[[0,4],[1,2],[2,0]], decoys:[60, 96] }" },
    /* 拼數字：十位和個位一樣，拼反了看不出來。 */
    { file:'index', expect:'GAME_BUILD 44 has the same tens and ones digit',
      find:'  var GAME_BUILD = [23, 34, 41, 52, 36, 45, 27, 63];',
      replace:'  var GAME_BUILD = [23, 34, 41, 52, 36, 45, 27, 44];' },
    /* 綁一捆：不到 11 個就沒有「剩下的一」。 */
    { file:'index', expect:'GAME_BUNDLE 10 outside 11~18',
      find:'  var GAME_BUNDLE = [13, 14, 15, 16, 17, 18];',
      replace:'  var GAME_BUNDLE = [10, 14, 15, 16, 17, 18];' },
    /* 排排站：沒有「十位個位對調」的一對。 */
    { file:'index', expect:'has no digit-swapped pair',
      find:'  var GAME_SORT = [[38, 83, 35, 53],',
      replace:'  var GAME_SORT = [[38, 73, 35, 56],' },
    /* 排隊：第幾個和前面幾隻一樣，點出來的東西分不出位置和數量。 */
    { file:'index', expect:'nth must differ from first',
      find:'{ nth:3, first:4 }, { nth:4, first:2 },',
      replace:'{ nth:3, first:3 }, { nth:4, first:2 },' },
    /* 百數板：空格的排寫成字串 —— 頁面用 === 比對，找不到空格，那一關解不完。 */
    { file:'index', expect:'every blank must be [integer row',
      find:"    { row:2, col:3, blanks:[[0,4],[1,1],[2,3]], decoys:[72, 64] },",
      replace:"    { row:2, col:3, blanks:[['0',4],['1',1],['2',3]], decoys:[72, 64] }," },
    /* 托盤卡片間距縮小，卡片疊在一起。 */
    { file:'index', expect:'tray cards overlap',
      find:'    var step = 60, x0 = (B.W - (items.length - 1) * step) / 2;',
      replace:'    var step = 40, x0 = (B.W - (items.length - 1) * step) / 2;' },
    /* 拼數字托盤裡的「一」縮到手機上不到 44px。 */
    { file:'index', expect:'under 44',
      find:"      addPiece(B, { w:46, h:46, cx:236, cy:248,",
      replace:"      addPiece(B, { w:40, h:40, cx:236, cy:248," }
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

      /* --- 小遊戲：數字大挑戰（五關五種玩法，§六之五）—— 每一條都從「畫面上看得到的東西」重新推 --- */
      const isInt = v => Number.isInteger(v);
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'bundle,build,chart,sort,line') fail('GAME_ORDER should be bundle,build,chart,sort,line, got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      /* 綁一捆：放滿 10 個之後一定還剩下「幾個一」；最多 18 個（3 排 × 6 個排得下）。 */
      extractArray(src, 'GAME_BUNDLE').forEach(n => {
        if (!isInt(n) || n < 11 || n > 18) fail('GAME_BUNDLE ' + n + ' outside 11~18');
      });
      /* 拼數字：每一邊最多放 9 個；十位和個位不一樣（拼反了才看得出來）；個位不是 0（一定要用到兩邊）。 */
      const BUILD = extractArray(src, 'GAME_BUILD');
      if (new Set(BUILD).size !== BUILD.length) fail('GAME_BUILD has duplicates');
      BUILD.forEach(n => {
        if (!isInt(n) || n < 11 || n > 99) return fail('GAME_BUILD ' + n + ' outside 11~99');
        const t = Math.floor(n / 10), o = n % 10;
        if (o === 0) fail('GAME_BUILD ' + n + ' has no ones');
        if (t === o) fail('GAME_BUILD ' + n + ' has the same tens and ones digit');
      });
      const trayCounts = [];   /* 每一個托盤要放幾張卡片，下面和托盤排法一起驗 */
      /* 百數板：自己排一張 1～100 的百數板（10 格一排），從那張板子上讀出視窗，不用頁面的公式。 */
      const HUNDRED = [];
      for (let r = 0; r < 10; r++){ HUNDRED.push([]); for (let c = 0; c < 10; c++) HUNDRED[r].push(r * 10 + c + 1); }
      extractArray(src, 'GAME_CHART').forEach((g, gi) => {
        const tag = 'GAME_CHART[' + gi + ']';
        if (!isInt(g.row) || !isInt(g.col) || g.col < 1) return fail(tag + ' row/col must be integers, col >= 1');
        /* 頁面上第 i 排第 j 格是「個位 col + j」那一欄；它要真的在百數板上同一排 */
        if (g.col - 1 + 4 > 9) return fail(tag + ' col ' + g.col + ' runs off the right edge of the hundred chart');
        if (g.row < 0 || g.row + 2 > 9) return fail(tag + ' row ' + g.row + ' runs off the hundred chart');
        const win = [0, 1, 2].map(i => [0, 1, 2, 3, 4].map(j => HUNDRED[g.row + i][g.col - 1 + j]));
        const pageVal = (i, j) => (g.row + i) * 10 + g.col + j;
        win.forEach((row, i) => row.forEach((v, j) => { if (pageVal(i, j) !== v) fail(tag + ' page puts ' + pageVal(i, j) + ' where the hundred chart has ' + v); }));
        /* 先驗每個空格都是 [整數排, 整數格] —— 頁面用 === 比對，'0' 和 0 對不上，那一關就找不到空格 */
        if (!Array.isArray(g.blanks) || g.blanks.some(b => !Array.isArray(b) || b.length !== 2 || !isInt(b[0]) || !isInt(b[1]) || b[0] < 0 || b[0] > 2 || b[1] < 0 || b[1] > 4))
          return fail(tag + ' every blank must be [integer row 0~2, integer column 0~4]: ' + JSON.stringify(g.blanks));
        const rows = g.blanks.map(b => b[0]).sort().join();
        if (rows !== '0,1,2') fail(tag + ' needs exactly one blank in each row, got rows ' + rows);
        const answers = g.blanks.map(b => (win[b[0]] || [])[b[1]]);
        const visible = [].concat.apply([], win).filter(v => answers.indexOf(v) < 0);
        if (!g.decoys.length) fail(tag + ' has no decoy');
        g.decoys.forEach(v => {
          if (answers.indexOf(v) >= 0) fail(tag + ' decoy ' + v + ' equals a blank');
          if (visible.indexOf(v) >= 0) fail(tag + ' decoy ' + v + ' is already on the board');
          if (!isInt(v) || v < 1 || v > 100) fail(tag + ' decoy ' + v + ' outside 1~100');
        });
        if (new Set(g.decoys).size !== g.decoys.length) fail(tag + ' duplicate decoys');
        trayCounts.push(answers.length + g.decoys.length);
      });
      /* 排排站：四個不一樣的兩位數；要有一對十位個位對調（23／32）、一對十位一樣（35／38）。 */
      extractArray(src, 'GAME_SORT').forEach((g, gi) => {
        const tag = 'GAME_SORT[' + gi + ']';
        trayCounts.push(g.length);
        if (g.length !== 4 || new Set(g).size !== 4) return fail(tag + ' needs 4 different numbers');
        if (g.some(v => !isInt(v) || v < 10 || v > 99)) fail(tag + ' has a number outside 10~99');
        const swap = v => (v % 10) * 10 + Math.floor(v / 10);
        if (!g.some(v => v % 10 !== 0 && swap(v) !== v && g.indexOf(swap(v)) >= 0)) fail(tag + ' has no digit-swapped pair');
        if (!g.some((v, i) => g.some((w, k) => k !== i && Math.floor(v / 10) === Math.floor(w / 10)))) fail(tag + ' has no same-tens pair');
      });
      /* 排隊：六隻小動物；第幾個 ≠ 前面幾隻（不然點出來的東西一樣，分不出位置和數量）。 */
      extractArray(src, 'GAME_LINE').forEach((g, gi) => {
        const tag = 'GAME_LINE[' + gi + ']';
        if (!isInt(g.nth) || !isInt(g.first) || g.nth < 1 || g.nth > 6 || g.first < 2 || g.first > 6) fail(tag + ' nth must be 1~6 and first 2~6');
        if (g.nth === g.first) fail(tag + ' nth must differ from first');
      });
      if (!/var animals = shuffle\(ANIMALS\)\.slice\(0, 6\);/.test(src)) fail('line round no longer draws 6 animals from ANIMALS');
      /* 手機上拿得起來的東西至少 44px：每個 addPiece 的 w/h，以 375px 手機（卡片內寬約 290px）
         換算 300 寬的畫板。數字從原始碼讀，不在這裡另抄一份。 */
      const PHONE_INNER = 290;
      const boards = (src.match(/makeBoard\((\d+), \d+\)/g) || []).map(m => +m.match(/\d+/)[0]);
      if (boards.length !== 5 || boards.some(W => W !== 300)) fail('expected five 300-wide game boards, got ' + boards.join());
      const scale = Math.min(1.5, PHONE_INNER / 300);
      const fc = (src.match(/var FC = (\d+), FP = (\d+)/) || []);
      const consts = { FC: +fc[1] };
      if (!fc[1]) fail('cannot read the bundle round dot size (var FC = .., FP = ..)');
      const pieces = src.match(/addPiece\(B, \{ w:(\w+), h:(\w+),/g) || [];
      if (pieces.length < 5) fail('expected at least 5 addPiece calls in the game, found ' + pieces.length);
      pieces.forEach(m => {
        const [, w, h] = m.match(/w:(\w+), h:(\w+)/);
        const px = v => /^\d+$/.test(v) ? +v : consts[v];
        const sz = Math.min(px(w), px(h));
        if (!(sz * scale >= 44)) fail('a game piece (' + m + ') is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44');
      });
      /* 托盤（renderTray）：卡片之間不可以碰到、最多張的那一盤也不可以出界。step 和卡片寬度都從原始碼讀。 */
      const trayStep = +((src.match(/function renderTray\(B, items, y, mk\)\{\s*var step = (\d+),/) || [])[1]);
      const cardWs = (src.match(/addPiece\(B, \{ w:(\d+), h:\d+, cx:cx, cy:cy,/g) || []).map(m => +m.match(/w:(\d+)/)[1]);
      if (!trayStep) fail('cannot read renderTray step');
      else if (cardWs.length !== 2) fail('expected 2 tray card renderers (chart, sort), found ' + cardWs.length);
      else {
        const cw = Math.max.apply(null, cardWs), most = Math.max.apply(null, trayCounts);
        if (trayStep < cw + 4) fail('tray cards overlap: step ' + trayStep + ' < card width ' + cw + ' + 4');
        const x0 = (300 - (most - 1) * trayStep) / 2;
        if (x0 - cw / 2 < 0 || x0 + (most - 1) * trayStep + cw / 2 > 300) fail('a tray of ' + most + ' cards runs off the 300-wide board');
      }
      const ac = src.match(/var AC = (\d+), AP = (\d+)/);
      if (!ac) fail('cannot read the line round animal size');
      else {
        if (+ac[1] * scale < 44) fail('line-round animals are ' + (+ac[1] * scale).toFixed(1) + 'px on a 375px phone — under 44');
        if (+ac[1] > +ac[2]) fail('line-round animals overlap (AC > AP)');
        if (1 + 5 * +ac[2] + +ac[1] > 300) fail('six line-round animals do not fit the 300 board');
      }
      /* 小遊戲的卡片要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的卡片**，實作在 lib/gameshuffle.js。卡片統一由 renderTray() 畫
         （百數板、排排站兩關共用），所以守的函式是 renderTray。 */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
    }
  }
};
