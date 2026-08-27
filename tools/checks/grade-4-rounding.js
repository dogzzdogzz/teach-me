/* grade-4/math/rounding（概數與四捨五入，只做整數）的檢查設定。

   範圍取自課程自己說的話：`index.html` 的資料區寫著「題幹裡的數最多六位數
   （到 999999）；四捨五入之後最大到 1000000」，速查卡與家長頁也對讀者講了
   同一件事，所以上限是這兩個數，不是隨手給一個寬鬆的大數。

   這一課有三個守門重點：

   ① **課程教的規則有兩個說法，它們必須永遠一致。**
      「看目標位右邊隔壁那一位，0~4 捨、5~9 入」與「停在數線上比較近的那一站，
      剛好正中間就往上」是課程明講「算出來的答案永遠一樣」的兩件事。
      所以這裡把**數線那一套**獨立實作一次（`roundByLine`，比距離，不看數字），
      再對整個定義域和課程的 `roundTo` 逐一比對。拿課程的函式比它自己等於沒驗。

   ② **「比較近」在正中間是假的。**（規則的量詞：什麼時候保證、什麼時候只是約定）
      所有「離哪一站近」的題目都必須真的離得比較近 —— `nearestStop` 的不變條件
      直接比兩段距離，而不是相信產生器排除過正中間。

   ③ **估算題不可以把精確答案端出來**（§六之二，`grade-3/multiply` 的量產版 bug）。
      `estimateSum`／`estimateDiff` 的每一個選項都要驗，不是只驗正解。 */

const STEM_MAX = 999999;    // 題幹裡的數最多六位數 —— 課程自己宣告的上限
const VALUE_MAX = 1000000;  // 四捨五入之後最大到 1000000（999999 到萬位）
const PV = [1, 10, 100, 1000, 10000, 100000];
const MIN_PLACE = 1, MAX_PLACE = 4;

/* 位名真值表（index 0 ＝ 個位）—— 和 index.html／review.html 的字典各自獨立。 */
const PLACES = {
  zh: ['個位','十位','百位','千位','萬位','十萬位'],
  en: ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands']
};
/* review.html 的「要看哪一位」那一題，選項長成什麼樣。 */
function placeOptText(p, L){ return L === 'zh' ? PLACES.zh[p] : 'the ' + PLACES.en[p] + ' digit'; }

function digitAt(n, place){ return Math.floor(n / PV[place]) % 10; }
function nextDigitAt(n, place){ return digitAt(n, place - 1); }

/* 四捨五入的**第二套實作**：走數線的定義（比距離），不看「下一位是幾」。
   課程宣稱兩套說法永遠一致，這裡就是那個宣稱的守門員。 */
function roundByLine(n, place){
  const pv = PV[place];
  const lo = Math.floor(n / pv) * pv;
  const rest = n - lo;                 // 0 ≤ rest < pv
  return (rest * 2 >= pv) ? lo + pv : lo;   // 剛好正中間（rest*2 === pv）也往上
}
/* n 是不是剛好停在兩站的正中間。 */
function isHalfway(n, place){ return (n % PV[place]) * 2 === PV[place]; }
/* 兩站與正中間的第二套實作 —— 不呼叫課程的 stopsOf（codex 第三輪 #7：
   拿待測程式當神諭，它錯的時候整條下游都會跟著錯，而且一起是綠的）。 */
function stopsOfRef(n, place){
  const lo = Math.floor(n / PV[place]) * PV[place];
  return { lo: lo, hi: lo + PV[place], mid: lo + PV[place] / 2, pv: PV[place] };
}
/* 數字要比「整個 token」：子字串比對會把 400 認在 4000 裡面、5 認在 15 裡面
   （codex 第三輪 #6）。 */
function printsNum(text, v){
  return (String(text).match(/\d+/g) || []).indexOf(String(v)) >= 0;
}

const fs = require('fs');
const path = require('path');

/* 每個產生器的選項範圍。沒列到的走預設 [10, VALUE_MAX]。 */
const RANGE = {
  rangeLow: [1, STEM_MAX],
  rangeCheck: [1, STEM_MAX],
  whichRoundsDown: [10, STEM_MAX],
  aboutWan: [1, 100]
};

/* ---------------------------------------------------------------------------
   三層題庫的第二套實作。`verify_lesson_data.js` 內建的算術重算只認得
   「a ＋ b ＝ ?」那種題幹，這一課一題都不符合 —— 在補上這張表之前，
   把 ans:1 改成 ans:0 是**完全不會被抓到**的。
   每一題記三件事：題幹裡一定要出現的數字（而且要「剛好是這些」，不是「有包含」）、
   題幹說的目標位（從題幹的文字讀出來，不是寫死在這裡），以及從那兩者重算的正解。
   --------------------------------------------------------------------------- */

/* 題幹說「四捨五入到哪一位」—— 從題幹的文字讀出來。位名互為子字串
   （萬位 ⊂ 十萬位、thousands ⊂ ten-thousands），所以只留沒有被更長的命中包住的。 */
function placeFromStem(stem, L){
  /* 只認「四捨五入到X」／「to the X place」這個片語 —— 題幹裡別的位名
     （迷思檢查那一題會提到個位、十位）不是目標位，不可以被誤認。
     片語出現兩次而且講的不是同一個位，就是題幹自己矛盾，一樣要響。 */
  const re = (L === 'zh') ? /四捨五入到([\u4e00-\u9fff]{1,3}位)/g
                          : /to the ([a-z][a-z-]*) place/g;
  const said = [];
  let m;
  while ((m = re.exec(stem)) !== null) if (said.indexOf(m[1]) < 0) said.push(m[1]);
  if (said.length !== 1) return null;        // 沒講或講了兩個不同的 → 題幹不明確
  const at = PLACES[L].indexOf(said[0]);
  return at < 0 ? null : at;                 // 講了一個不認得的位名也要響
}

const BANK_EXPECTED = {
  qs: [
    { nums:[3847],  zh:'3800',  en:'3800',  kind:'round' },
    { nums:[2650],  zh:'2700',  en:'2700',  kind:'round' },
    { nums:[8472],  zh:'8000',  en:'8000',  kind:'round' },
    { nums:[36500], zh:'40000', en:'40000', kind:'round' },
    /* 「要看哪一位」：正解是目標位右邊隔壁那一位的名字，從題幹說的目標位算出來。 */
    { nums:[58316], zh:'百位',  en:'the hundreds digit', kind:'lookPlace' },
    { nums:[4682],  zh:'4680',  en:'4680',  kind:'round' }
  ],
  qsAdv: [
    /* 反過來想：唯一一個四捨五入之後等於題幹那個數的選項。 */
    { nums:[500],          zh:'462',   en:'462',   kind:'inRange' },
    { nums:[1980, 3120],   zh:'5000',  en:'5000',  kind:'estimateSum' },
    { nums:[60000],        zh:'55000', en:'55000', kind:'rangeLow' },
    /* 先乘再取概數：兩步驟。nums 依題幹順序 ＝ [棟數, 每棟戶數]。 */
    { nums:[8, 495],       zh:'4000',  en:'4000',  kind:'productThenRound' }
  ],
  qsBoost: [
    /* 逐位四捨五入是錯的：正解由題幹的第一個數字重算。 */
    { nums:[4449, 9, 4450, 5, 4500], zh:'4400', en:'4400', kind:'round' },
    { nums:[5372], zh:'5400', en:'5400', kind:'round' }
  ]
};

/* ---------------------------------------------------------------------------
   速查卡與家長頁的規則措辭。三頁教的是同一條規則，只驗上課頁等於沒在盯另外兩頁。
   `need` 是**出現次數**，不是「有沒有出現」：中文字串在這些頁面上一定有兩份
   （markup 的 fallback ＋ 字典），只改掉其中一份必須要被抓到；英文只住在 en 字典裡，
   所以 need 是 1。
   --------------------------------------------------------------------------- */
const SIBLING_RULES = {
  'reference.html': {
    must: [
      ['只看它右邊隔壁那一位', 2],
      ['剛好在正中間的時候，約定往上', 2],
      ['把目標位右邊全部變成 0', 4],
      ['一位一位往上進位是錯的做法', 2],
      ['這一課只處理', 2],
      ['only at the digit immediately to its right', 2],
      ['always ends in a run of zeros', 2],
      ['whole numbers', 1],
      /* codex 第一輪：估算的誤差界線，與「目標位不同、答案可能不同」的量詞。 */
      ['最多只差一個位值', 2],
      ['at most one place value apart', 1],
      ['答案可能就不同', 2],
      /* codex 第二輪 #3：進位會不會一路傳下去，規則必須講清楚。 */
      ['左邊如果也是 9，就一路進上去', 2],
      ['the carry keeps going', 1]
    ],
    forbid: ['只看它左邊隔壁那一位', '一位一位往上進位是對的',
             '從最右邊那一位開始四捨五入', '看目標位自己的數字來決定',
             '差很多，就是算式哪裡出錯了', '目標位不同，答案就不同',
             'far apart, something went wrong'],
    /* 四個目標位的表，由高位到低位。 */
    orderedZh: ['萬位', '千位', '百位', '十位']
  },
  'parents.html': {
    must: [
      ['只看它右邊隔壁那一位', 4],
      ['剛好在正中間', 2],
      ['只處理整數的四捨五入', 2],
      ['only at the digit immediately to its right', 1],
      ['the agreed rule is to go up', 1],
      ['whole numbers', 1],
      /* 精熟標準要寫出遊戲的名字（中英各一份）。 */
      ['四捨五入快車', 2],
      ['The Rounding Express', 1]
    ],
    forbid: ['只看它左邊隔壁那一位', '這一課也教小數',
             'this lesson also covers decimals', '因為比較近，所以往上'],
    orderedZh: null
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-4/math/rounding */
  breaks: [
    /* ---------- review.html：共用工具 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'does not match the second implementation',
      find:'    return nextDigit(n, place) >= 5 ? lower + pv : lower;',
      replace:'    return nextDigit(n, place) > 5 ? lower + pv : lower;' },
    { file:'review', expect:'does not match the second implementation',
      find:'  function nextDigit(n, place){ return digitAt(n, place - 1); }',
      replace:'  function nextDigit(n, place){ return digitAt(n, place); }' },
    { file:'review', expect:'above the lesson range',
      find:'  function headMax(place){ return Math.floor(STEM_MAX / PV[place]); }',
      replace:'  function headMax(place){ return Math.floor(STEM_MAX / PV[place]) + 40; }' },
    { file:'review', expect:'smaller than the target place',
      find:'    if (!endsIn9) return 1 + rand(hi);',
      replace:'    if (!endsIn9) return rand(hi);' },

    /* ---------- review.html：roundNum ---------- */
    { file:'review', expect:'roundNum: correct',
      find:'        var lower = head * pv;\n        var correct = roundTo(n, place);\n        /* 誘答：捨入弄反',
      replace:'        var lower = head * pv;\n        var correct = roundTo(n, place) + pv;\n        /* 誘答：捨入弄反' },
    { file:'review', expect:'roundNum: look is not the digit right of the target place',
      find:'        var head = pickHead(place, false);\n        var n = buildN(place, look, tail, head);\n        var lower = head * pv;\n        var correct = roundTo(n, place);',
      replace:'        var head = pickHead(place, false);\n        var n = buildN(place, look, tail, head);\n        look = (look + 1) % 10;\n        var lower = head * pv;\n        var correct = roundTo(n, place);' },
    { file:'review', expect:'roundNum: this is the exactly-halfway case',
      find:'        if (look === 5 && tail === 0){ if (sub > 1) tail = 1 + rand(sub - 1); else look = 6 + rand(4); }\n        /* look ＝ 0 且 tail ＝ 0',
      replace:'        if (look === 5 && tail === 0){ tail = 0; }\n        /* look ＝ 0 且 tail ＝ 0' },
    { file:'review', expect:'roundNum: the answer must not equal the number in the stem',
      find:'        if (look === 0 && tail === 0) look = 1 + rand(4);',
      replace:'        if (look === 0 && tail === 0) look = 0;' },
    { file:'review', expect:'roundNum stem does not print',
      find:"            ? d.n + ' 四捨五入到' + pn + '是多少？'\n            : 'What is ' + d.n + ' rounded to the ' + pn + ' place?',\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh'\n            ? '只看'",
      replace:"            ? (d.n + 1) + ' 四捨五入到' + pn + '是多少？'\n            : 'What is ' + (d.n + 1) + ' rounded to the ' + pn + ' place?',\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh'\n            ? '只看'" },
    { file:'review', expect:'roundNum names the',
      find:"        var pn = t.places[d.place], ln = t.places[d.place - 1];\n        return {\n          stem: lang === 'zh'\n            ? d.n + ' 四捨五入到' + pn + '是多少？'\n            : 'What is ' + d.n + ' rounded to the ' + pn + ' place?',\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh'\n            ? '只看'",
      replace:"        var pn = t.places[(d.place + 1) % 6], ln = t.places[d.place - 1];\n        return {\n          stem: lang === 'zh'\n            ? d.n + ' 四捨五入到' + pn + '是多少？'\n            : 'What is ' + d.n + ' rounded to the ' + pn + ' place?',\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh'\n            ? '只看'" },
    { file:'review', expect:'roundNum why never prints the correct answer',
      find:"              + '，再把右邊全部變成 0 —— 答案是 ' + d.correct + '。'",
      replace:"              + '，再把右邊全部變成 0 —— 答案就出來了。'" },

    /* ---------- review.html：whichDigit ---------- */
    { file:'review', expect:'whichDigit: correct is not the place immediately right',
      find:'        var correct = place - 1;\n        /* 誘答：目標位自己',
      replace:'        var correct = place;\n        /* 誘答：目標位自己' },
    { file:'review', expect:'whichDigit stem does not print',
      find:"            ? '要把 ' + d.n + ' 四捨五入到' + pn + '，應該看哪一位的數字來決定捨或入？'",
      replace:"            ? '要把 ' + (d.n + 1) + ' 四捨五入到' + pn + '，應該看哪一位的數字來決定捨或入？'" },
    { file:'review', expect:'whichDigit why does not name',
      find:"            ? '要四捨五入到哪一位，就看那一位右邊隔壁的那一位。' + pn + '右邊隔壁是' + t.places[d.correct] + '，所以看' + t.places[d.correct] + '。'",
      replace:"            ? '要四捨五入到哪一位，就看那一位右邊隔壁的那一位。' + pn + '右邊隔壁在旁邊，所以看旁邊那一位。'" },

    /* ---------- review.html：roundHalf ---------- */
    { file:'review', expect:'roundHalf: n is not exactly halfway',
      find:'        var n = buildN(place, 5, 0, head);\n        var lower = head * pv;',
      replace:'        var n = buildN(place, 4, 0, head);\n        var lower = head * pv;' },
    { file:'review', expect:'roundHalf: correct must be the upper stop',
      find:'        var lower = head * pv;\n        var correct = lower + pv;\n        var cands = [lower, correct + pv, lower - pv];',
      replace:'        var lower = head * pv;\n        var correct = lower;\n        var cands = [lower + pv, correct + pv, lower - pv];' },
    { file:'review', expect:'roundHalf: the carry case belongs to roundCarry',
      find:'        if (head % 10 === 9) head = (head > 1) ? head - 1 : 1;',
      replace:'        if (head % 10 === 99) head = (head > 1) ? head - 1 : 1;' },
    /* roundHalf 的解釋把正解印了**兩次**（「停在 lower 和 correct 的正中間」
       以及結尾的「答案是 correct」）—— 只拿掉結尾那一次，斷言仍然成立而且
       仍然是對的。要證明它會響，兩處都得拿掉。 */
    { file:'review', expect:'roundHalf why never prints the correct answer',
      find:"' 剛好停在 ' + d.lower + ' 和 ' + d.correct + ' 的正中間，兩邊一樣遠 —— 剛好在正中間的時候，約定往上，所以答案是 ' + d.correct + '。'",
      replace:"' 剛好停在兩站的正中間，兩邊一樣遠 —— 剛好在正中間的時候，約定往上，答案就出來了。'" },
    { file:'review', expect:'roundHalf: lower is not the stop below n',
      find:"        var m = mixOpts(correct, shuffle(cands), 10, MAXV, pv);\n        return { n:n, place:place, lower:lower, correct:correct, opts:m.opts, ans:m.ans };",
      replace:"        var m = mixOpts(correct, shuffle(cands), 10, MAXV, pv);\n        return { n:n, place:place, lower:lower - pv, correct:correct, opts:m.opts, ans:m.ans };" },

    /* ---------- review.html：roundCarry ---------- */
    { file:'review', expect:'roundCarry: the target digit must be 9',
      find:'        var head = pickHead(place, true);\n        var look = 5 + rand(5);',
      replace:'        var head = pickHead(place, false);\n        var look = 5 + rand(5);' },
    { file:'review', expect:'roundCarry: the look digit must be 5 or more',
      find:'        var head = pickHead(place, true);\n        var look = 5 + rand(5);\n        var tail = rand(sub);',
      replace:'        var head = pickHead(place, true);\n        var look = rand(5);\n        var tail = rand(sub);' },
    { file:'review', expect:'roundCarry: correct',
      find:'        var lower = head * pv;\n        var correct = lower + pv;\n        var cands = [lower, n + pv, correct + pv];',
      replace:'        var lower = head * pv;\n        var correct = lower + 2 * pv;\n        var cands = [lower, n + pv, correct + pv];' },
    { file:'review', expect:'roundCarry why never prints the correct answer',
      find:"，要再往左邊進一位 —— 答案是 ' + d.correct + '，不是 ' + d.lower + '。'",
      replace:"，要再往左邊進一位 —— 答案不是 ' + d.lower + '。'" },

    /* ---------- review.html：nearestStop ---------- */
    { file:'review', expect:'nearestStop: correct is not the nearer stop',
      find:'        var lo = head * pv, hi = lo + pv;\n        var correct = roundTo(n, place);',
      replace:'        var lo = head * pv, hi = lo + pv;\n        var correct = (roundTo(n, place) === lo) ? hi : lo;' },
    { file:'review', expect:'nearestStop: n sits exactly halfway',
      find:'        if (look === 5 && tail === 0) tail = 1 + rand(sub - 1);\n        /* 剛好停在站上',
      replace:'        look = 5; tail = 0;\n        /* 剛好停在站上' },
    { file:'review', expect:'nearestStop: lo is not the stop below n',
      find:'        var lo = head * pv, hi = lo + pv;\n        var correct = roundTo(n, place);\n        var cands',
      replace:'        var lo = head * pv - pv, hi = lo + pv;\n        var correct = roundTo(n, place);\n        var cands' },
    { file:'review', expect:'nearestStop stem does not print',
      find:"            ? d.n + ' 夾在 ' + d.lo + ' 和 ' + d.hi + ' 中間。它比較靠近哪一個？'",
      replace:"            ? d.n + ' 夾在兩個整數中間。它比較靠近哪一個？'" },

    /* ---------- review.html：rangeLow ---------- */
    { file:'review', expect:'rangeLow: correct is not the smallest number',
      find:'        var target = head * pv;\n        var correct = target - half;',
      replace:'        var target = head * pv;\n        var correct = target - half + 1;' },
    { file:'review', expect:'rangeLow: target is not a whole',
      find:'        var head = 1 + rand(headMax(place) - 1);\n        var target = head * pv;',
      replace:'        var head = 1 + rand(headMax(place) - 1);\n        var target = head * pv + 1;' },
    { file:'review', expect:'rangeLow stem does not print',
      find:"            ? '有一個數，四捨五入到' + pn + '以後是 ' + d.target + '。這個數最小可能是多少？'",
      replace:"            ? '有一個數，四捨五入到' + pn + '以後是 ' + (d.target + 1) + '。這個數最小可能是多少？'" },

    /* ---------- review.html：rangeCheck ---------- */
    { file:'review', expect:'rangeCheck: the marked answer does not round to',
      find:'        var correct = target - half + rand(pv);\n        if (correct === target) correct = target + 1;',
      replace:'        var correct = target - half + rand(pv) - pv;\n        if (correct === target) correct = target + 1;' },
    { file:'review', expect:'rangeCheck: more than one option rounds to',
      find:'        var w2 = target + half + rand(half);',
      replace:'        var w2 = target + rand(half);' },
    { file:'review', expect:'rangeCheck: duplicate option',
      find:'        var w3 = target - pv - rand(half);\n        if (w3 === w1) w3 = w1 - 1;',
      replace:'        var w3 = w1;' },
    { file:'review', expect:'rangeCheck why states the wrong range',
      find:"            ? '四捨五入到' + pn + '以後是 ' + d.target + ' 的數，從 ' + (d.target - half) + ' 到 ' + (d.target + half - 1) + '。只有 ' + d.correct + ' 在這個範圍裡。'",
      replace:"            ? '四捨五入到' + pn + '以後是 ' + d.target + ' 的數，從 ' + (d.target - half) + ' 到 ' + (d.target + half) + '。只有 ' + d.correct + ' 在這個範圍裡。'" },

    /* ---------- review.html：estimateSum / estimateDiff ---------- */
    /* 迴圈與保底都算了一次 correct/exact，所以這幾筆 find 要帶上後面那一行才唯一。 */
    { file:'review', expect:'estimateSum: correct is not the sum of the two rounded numbers',
      find:'          correct = ra + rb; exact = a + b;\n          /* 估算題絕對不可以',
      replace:'          correct = ra + rb + pv; exact = a + b;\n          /* 估算題絕對不可以' },
    /* 把重抽條件釘死成 false 逼保底上場，同時讓保底也生出「估計值 ＝ 精確答案」的一組
       —— 這樣才證明得到那條斷言會響（原本的 find 已經隨著修正消失了）。 */
    { file:'review', expect:'estimateSum: the exact answer equals the estimate',
      find:'          ok = exact !== correct && exact <= STEM_MAX && correct <= MAXV &&\n               correct !== a && correct !== b;\n        }\n        /* 60 次都抽不到就用造的：a 的尾巴放一個 1、b 剛好停在站上，\n           估計值 ＝ 精確答案 − 1，保證不相等（codex 第二輪 #1：\n           原本的迴圈跑完不檢查成敗，會把不合格的那一組直接端出去）。 */\n        if (!ok){\n          a = (1 + rand(hm)) * pv + 1;\n          b = (1 + rand(hm)) * pv;',
      replace:'          ok = false;\n        }\n        if (!ok){\n          a = (1 + rand(hm)) * pv;\n          b = (1 + rand(hm)) * pv;' },
    { file:'review', expect:'estimateSum: the exact answer must not be an option',
      find:'        var m = mixOpts(correct, shuffle(cands), 10, MAXV, pv, [exact, a, b]);\n        return { place:place, a:a, b:b, ra:ra, rb:rb, exact:exact, correct:correct, opts:m.opts, ans:m.ans };\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        var pn = t.places[d.place];\n        return {\n          stem: lang === \'zh\'\n            ? \'先把 \' + d.a + \' 和 \' + d.b + \' 各自四捨五入到\' + pn + \'，再相加。',
      replace:'        var m = mixOpts(correct, [exact], 10, MAXV, pv);\n        return { place:place, a:a, b:b, ra:ra, rb:rb, exact:exact, correct:correct, opts:m.opts, ans:m.ans };\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        var pn = t.places[d.place];\n        return {\n          stem: lang === \'zh\'\n            ? \'先把 \' + d.a + \' 和 \' + d.b + \' 各自四捨五入到\' + pn + \'，再相加。' },
    { file:'review', expect:'estimateSum: ra is not a rounded to',
      find:'          ra = roundTo(a, place); rb = roundTo(b, place);\n          correct = ra + rb; exact = a + b;\n          /* 估算題絕對不可以',
      replace:'          ra = roundTo(a, place) + 1; rb = roundTo(b, place);\n          correct = ra + rb; exact = a + b;\n          /* 估算題絕對不可以' },
    { file:'review', expect:'estimateSum stem does not print',
      find:"            ? '先把 ' + d.a + ' 和 ' + d.b + ' 各自四捨五入到' + pn + '，再相加。估計大約是多少？'",
      replace:"            ? '先把 ' + (d.a + 1) + ' 和 ' + d.b + ' 各自四捨五入到' + pn + '，再相加。估計大約是多少？'" },
    { file:'review', expect:'estimateDiff: correct is not the difference of the two rounded numbers',
      find:'          correct = ra - rb; exact = a - b;\n          /* 正解不可以剛好等於',
      replace:'          correct = ra - rb + pv; exact = a - b;\n          /* 正解不可以剛好等於' },
    { file:'review', expect:'estimateDiff: the exact answer must not be an option',
      find:'        var m = mixOpts(correct, shuffle(cands), 10, MAXV, pv, [exact, a, b]);\n        return { place:place, a:a, b:b, ra:ra, rb:rb, exact:exact, correct:correct, opts:m.opts, ans:m.ans };\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        var pn = t.places[d.place];\n        return {\n          stem: lang === \'zh\'\n            ? \'先把 \' + d.a + \' 和 \' + d.b + \' 各自四捨五入到\' + pn + \'，再相減。',
      replace:'        var m = mixOpts(correct, [exact], 10, MAXV, pv);\n        return { place:place, a:a, b:b, ra:ra, rb:rb, exact:exact, correct:correct, opts:m.opts, ans:m.ans };\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        var pn = t.places[d.place];\n        return {\n          stem: lang === \'zh\'\n            ? \'先把 \' + d.a + \' 和 \' + d.b + \' 各自四捨五入到\' + pn + \'，再相減。' },
    /* 只把 ha／hb 對調的話，保底會把它救回來（保底本來就保證 a > b）——
       所以要同時逼保底上場、又讓保底自己生出 a ＝ b。 */
    { file:'review', expect:'estimateDiff: a must be bigger than b',
      find:'          ok = exact !== correct && correct > 0 && exact > 0 && a <= STEM_MAX &&\n               correct !== a && correct !== b;\n        }\n        /* 抽不到就用造的（codex 第二輪 #1）。差距寫成 hb2 ＋ 3 個位值，\n           正解 (hb2 ＋ 3) × pv 就不可能剛好等於 b（hb2 × pv）——\n           固定差 2 個位值的版本在 hb2 ＝ 2 時真的會撞上，改壞測試抓到了。 */\n        if (!ok){\n          var hb2 = 1 + rand(Math.floor(hm / 3));\n          a = (2 * hb2 + 3) * pv + 1;\n          b = hb2 * pv;',
      replace:'          ok = false;\n        }\n        if (!ok){\n          var hb2 = 1 + rand(Math.floor(hm / 3));\n          a = hb2 * pv;\n          b = hb2 * pv;' },

    /* ---------- review.html：whichRoundsDown / aboutWan ---------- */
    { file:'review', expect:'whichRoundsDown: the marked answer does not go down',
      find:'        return { place:place, correct:correct, opts:m.opts, ans:m.ans };',
      replace:'        return { place:place, correct:wrongs[0], opts:m.opts, ans:m.ans };' },
    { file:'review', expect:'options go down, expected exactly 1',
      find:'          var v = buildN(place, 5 + rand(5), rand(sub), pickHead(place, false));',
      replace:'          var v = buildN(place, rand(10), rand(sub), pickHead(place, false));' },
    { file:'review', expect:'whichRoundsDown why does not name',
      find:"            ? '看每一個數的' + ln + '：只有 ' + d.correct + ' 的' + ln + '比 5 小，所以只有它會被捨，其他三個都要入。'",
      replace:"            ? '看每一個數的那一位：只有 ' + d.correct + ' 比 5 小，所以只有它會被捨，其他三個都要入。'" },
    { file:'review', expect:'aboutWan: correct is not n rounded to the ten-thousands',
      find:'        var correct = roundTo(n, 4) / 10000;',
      replace:'        var correct = roundTo(n, 3) / 10000;' },
    { file:'review', expect:'aboutWan: head is not n divided by 10000',
      find:'        var n = buildN(4, look, rand(1000), head);\n        var correct = roundTo(n, 4) / 10000;',
      replace:'        var n = buildN(4, look, rand(1000), head + 1);\n        var correct = roundTo(n, 4) / 10000;' },
    { file:'review', expect:'aboutWan stem does not print',
      find:"            ? d.n + ' 四捨五入到萬位以後，大約是幾萬？'",
      replace:"            ? (d.n + 1) + ' 四捨五入到萬位以後，大約是幾萬？'" },

    /* ---------- index.html：規則本身 ---------- */
    { file:'index', expect:'disagrees with the number-line rule',
      find:'    return nextDigit(n, place) >= 5 ? lower + pv : lower;',
      replace:'    return nextDigit(n, place) > 5 ? lower + pv : lower;' },
    { file:'index', expect:'disagrees with the number-line rule',
      find:'  function nextDigit(n, place){ return digitAt(n, place - 1); }',
      replace:'  function nextDigit(n, place){ return digitAt(n, place); }' },
    { file:'index', expect:'digitAt',
      find:'  function digitAt(n, place){ return Math.floor(n / PV[place]) % 10; }',
      replace:'  function digitAt(n, place){ return Math.floor(n / PV[place]) % 100; }' },
    { file:'index', expect:'is not the midpoint',
      find:'    return { lo: lo, hi: lo + pv, mid: lo + pv / 2, pv: pv };',
      replace:'    return { lo: lo, hi: lo + pv, mid: lo + pv / 4, pv: pv };' },
    { file:'index', expect:'is not one place value above lo',
      find:'    var lo = Math.floor(n / pv) * pv;\n    return { lo: lo, hi: lo + pv, mid: lo + pv / 2, pv: pv };',
      replace:'    var lo = Math.floor(n / pv) * pv;\n    return { lo: lo, hi: lo + 2 * pv, mid: lo + pv / 2, pv: pv };' },

    /* ---------- index.html：roundSteps ---------- */
    { file:'index', expect:'step 1 names place',
      find:"      { kind:'target', place:place, digit:digitAt(n, place) },",
      replace:"      { kind:'target', place:place, digit:digitAt(n, place - 1) }," },
    { file:'index', expect:'step 2 names place',
      find:"      { kind:'look',   place:place - 1, digit:look },",
      replace:"      { kind:'look',   place:place, digit:look }," },
    { file:'index', expect:'says carried=',
      find:"      { kind:'decide', up:up, digit:look, carried: up && digitAt(n, place) === 9 },",
      replace:"      { kind:'decide', up:up, digit:look, carried: digitAt(n, place) === 9 }," },
    { file:'index', expect:'step 4 result',
      find:"      { kind:'result', result: up ? lower + pv : lower, lower:lower, pv:pv }",
      replace:"      { kind:'result', result: lower, lower:lower, pv:pv }" },
    { file:'index', expect:'step 3 says up=',
      find:"    var up = look >= 5;\n    return [\n      { kind:'target'",
      replace:"    var up = look >= 4;\n    return [\n      { kind:'target'" },

    /* ---------- index.html：數線畫布 ---------- */
    { file:'index', expect:'falls outside the line',
      find:'    return LINE_X0 + (LINE_X1 - LINE_X0) * t;',
      replace:'    return LINE_X0 + (LINE_X1 - LINE_X0) * t * 1.4;' },
    { file:'index', expect:'does not clamp a value above the upper stop',
      find:'    if (t > 1) t = 1;\n    return LINE_X0',
      replace:'    if (t > 1) t = 2;\n    return LINE_X0' },
    { file:'index', expect:'would be drawn outside the canvas',
      find:'  var LINE_W = 640, LINE_H = 128, LINE_X0 = 60, LINE_X1 = 580, LINE_Y = 66;',
      replace:'  var LINE_W = 640, LINE_H = 128, LINE_X0 = 2, LINE_X1 = 638, LINE_Y = 66;' },

    /* ---------- index.html：範例資料 ---------- */
    { file:'index', expect:'WHY_CASES',
      find:"    { icon:'🏟️', n:18432,  place:4 },",
      replace:"    { icon:'🏟️', n:18432,  place:5 }," },
    { file:'index', expect:'the approx line does not print',
      find:"          approx:'新聞只會說：昨天的球賽大約 20000 人進場。', tail:'（四捨五入到萬位）' },",
      replace:"          approx:'新聞只會說：昨天的球賽大約 18000 人進場。', tail:'（四捨五入到萬位）' }," },
    { file:'index', expect:'the exact line does not print',
      find:"        { label:'球場的觀眾', exact:'昨天的球賽，票口一個一個數出來，一共進場 18432 人。',",
      replace:"        { label:'球場的觀眾', exact:'昨天的球賽，票口一個一個數出來，一共進場很多人。'," },
    { file:'index', expect:'does not name the target place',
      find:"          approx:'跟同學介紹時會說：我們圖書室大約有 4000 本書。', tail:'（四捨五入到千位）' },",
      replace:"          approx:'跟同學介紹時會說：我們圖書室大約有 4000 本書。', tail:'（四捨五入到百位）' }," },
    { file:'index', expect:'cases sitting exactly halfway',
      find:'    { n:3500,  place:3 },',
      replace:'    { n:3600,  place:3 },' },
    { file:'index', expect:'LINE_CASES has no case below the halfway point',
      find:'    { n:3400,  place:3 },\n    { n:3720,  place:3 },',
      replace:'    { n:3600,  place:3 },\n    { n:3720,  place:3 },' },
    { file:'index', expect:'STEP_CASES has no carrying case',
      find:'    { n:9648,  place:3 },',
      replace:'    { n:8648,  place:3 },' },
    { file:'index', expect:'STEP_CASES has no exactly-halfway case',
      find:'    { n:45000, place:4 }',
      replace:'    { n:45600, place:4 }' },
    { file:'index', expect:'STEP_CASES has no rounding-down case',
      find:'    { n:3847,  place:2 },\n    { n:5372,  place:2 },\n    { n:9648,  place:3 },\n    { n:27364, place:3 },',
      replace:'    { n:3857,  place:2 },\n    { n:5372,  place:2 },\n    { n:9648,  place:3 },\n    { n:27564, place:3 },' },
    { file:'index', expect:'would round to 0',
      find:'  var MULTI_NUMS = [48562, 27364, 95500, 349999];',
      replace:'  var MULTI_NUMS = [4856, 27364, 95500, 349999];' },
    { file:'index', expect:'MULTI_NUMS has no number whose four answers are all the same',
      find:'  var MULTI_NUMS = [48562, 27364, 95500, 349999];\n',
      replace:'  var MULTI_NUMS = [48562, 27364, 95500, 348621];\n' },
    { file:'index', expect:'the estimate equals the exact answer',
      find:"    { a:1980,  b:3120,  place:3, op:'+' },",
      replace:"    { a:2000,  b:3000,  place:3, op:'+' }," },
    { file:'index', expect:'EST_CASES has no subtraction case',
      find:"    { a:5240,  b:1880,  place:3, op:'-' }",
      replace:"    { a:5240,  b:1880,  place:3, op:'+' }" },
    { file:'index', expect:'EST_CASES never rounds to the ten-thousands',
      find:"    { a:28600, b:11700, place:4, op:'+' },",
      replace:"    { a:28600, b:11700, place:3, op:'+' }," },

    /* ---------- index.html：遊戲 ---------- */
    { file:'index', expect:'the marked option is',
      find:'    { n:3847,  place:2, opts:[3900, 3800, 3850, 4000],      ans:1 },',
      replace:'    { n:3847,  place:2, opts:[3900, 3800, 3850, 4000],      ans:0 },' },
    { file:'index', expect:'duplicate option values',
      find:'    { n:2650,  place:2, opts:[2600, 3000, 2700, 2650],      ans:2 },',
      replace:'    { n:2650,  place:2, opts:[2600, 2700, 2700, 2650],      ans:1 },' },
    { file:'index', expect:'non-integer option',
      find:'    { n:9648,  place:3, opts:[9000, 9600, 9700, 10000],     ans:3 },',
      replace:"    { n:9648,  place:3, opts:[9000, 9600, 9700, 'banana'],  ans:3 }," },
    { file:'index', expect:'ROUNDS has no exactly-halfway round',
      find:'    { n:2650,  place:2, opts:[2600, 3000, 2700, 2650],      ans:2 },\n',
      replace:'    { n:2670,  place:2, opts:[2600, 3000, 2700, 2650],      ans:2 },\n' },
    { file:'index', expect:'ROUNDS has no carrying round',
      find:'    { n:9648,  place:3, opts:[9000, 9600, 9700, 10000],     ans:3 },\n',
      replace:'    { n:9448,  place:3, opts:[9000, 9600, 9700, 10000],     ans:3 },\n' },
    { file:'index', expect:'ROUNDS never rounds to the ten-thousands',
      find:'    { n:48500, place:4, opts:[50000, 40000, 48000, 49000],  ans:0 },',
      replace:'    { n:48500, place:3, opts:[50000, 40000, 48000, 49000],  ans:0 },' },
    { file:'index', expect:'every game round has the answer first',
      find:'    { n:3847,  place:2, opts:[3900, 3800, 3850, 4000],      ans:1 },\n    { n:2650,  place:2, opts:[2600, 3000, 2700, 2650],      ans:2 },\n    { n:9648,  place:3, opts:[9000, 9600, 9700, 10000],     ans:3 },\n    { n:48500, place:4, opts:[50000, 40000, 48000, 49000],  ans:0 },\n    { n:27364, place:3, opts:[28000, 27400, 27000, 27300],  ans:2 }',
      replace:'    { n:3847,  place:2, opts:[3800, 3900, 3850, 4000],      ans:0 },\n    { n:2650,  place:2, opts:[2700, 3000, 2600, 2650],      ans:0 },\n    { n:9648,  place:3, opts:[10000, 9600, 9700, 9000],     ans:0 },\n    { n:48500, place:4, opts:[50000, 40000, 48000, 49000],  ans:0 },\n    { n:27364, place:3, opts:[27000, 27400, 28000, 27300],  ans:0 }' },

    /* ---------- index.html：位名表與三層題庫 ---------- */
    { file:'index', expect:'place-name table says',
      find:"      places:['個位','十位','百位','千位','萬位','十萬位'],",
      replace:"      places:['個位','十位','千位','百位','萬位','十萬位']," },
    { file:'index', expect:'place-name table says',
      find:"      places:['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands'],\n      s1h2:'Why Do We Use Rounded Numbers?',",
      replace:"      places:['ones','tens','thousands','hundreds','ten-thousands','hundred-thousands'],\n      s1h2:'Why Do We Use Rounded Numbers?'," },
    { file:'index', expect:'marked answer is',
      find:"        { stem:'3847 四捨五入到百位是多少？', opts:['3800','3900','3850','4000'], ans:0,",
      replace:"        { stem:'3847 四捨五入到百位是多少？', opts:['3800','3900','3850','4000'], ans:1," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'8472 四捨五入到千位是多少？', opts:['9000','8500','8000','8400'], ans:2,",
      replace:"        { stem:'8473 四捨五入到千位是多少？（例：8472）', opts:['9000','8500','8000','8400'], ans:2," },
    { file:'index', expect:'recomputed',
      find:"        { stem:'36500 四捨五入到萬位是多少？', opts:['30000','36000','37000','40000'], ans:3,",
      replace:"        { stem:'36500 四捨五入到千位是多少？', opts:['30000','36000','37000','40000'], ans:3," },
    { file:'index', expect:'the explanation never states the answer',
      find:"          why:'四捨五入到十位，就只看十位右邊隔壁的個位。個位是 2，比 5 小，所以捨：十位的 8 不變，個位變成 0，答案是 4680。' }",
      replace:"          why:'四捨五入到十位，就只看十位右邊隔壁的個位。個位是 2，比 5 小，所以捨：十位的 8 不變，個位變成 0。' }" },
    { file:'index', expect:'recomputed',
      find:"        { stem:'要把 58316 四捨五入到千位，應該看哪一位的數字來決定捨或入？', opts:['千位','百位','萬位','十位'], ans:1,",
      replace:"        { stem:'要把 58316 四捨五入到萬位，應該看哪一位的數字來決定捨或入？', opts:['千位','百位','萬位','十位'], ans:1," },
    { file:'index', expect:'does not say which place to round to',
      find:"        { stem:'2650 四捨五入到百位是多少？', opts:['2600','2650','2700','3000'], ans:2,",
      replace:"        { stem:'2650 四捨五入是多少？', opts:['2600','2650','2700','3000'], ans:2," },
    { file:'index', expect:'recomputed',
      find:"        { stem:'文字題：一件外套 1980 元、一雙鞋 3120 元。先把兩個價錢各自四捨五入到千位，再相加，估計一共大約多少元？',",
      replace:"        { stem:'文字題：一件外套 1980 元、一雙鞋 3120 元。先把兩個價錢各自四捨五入到百位，再相加，估計一共大約多少元？'," },
    { file:'index', expect:'recomputed',
      find:"        { stem:'文字題：有一個數，四捨五入到萬位以後是 60000。這個數最小可能是多少？',",
      replace:"        { stem:'文字題：有一個數，四捨五入到千位以後是 60000。這個數最小可能是多少？'," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'文字題：一個社區有 8 棟大樓，每一棟都是 495 戶。全部的戶數四捨五入到千位，大約是多少戶？',",
      replace:"        { stem:'文字題：一個社區有 9 棟大樓，每一棟都是 495 戶。全部的戶數四捨五入到千位，大約是多少戶？'," },
    { file:'index', expect:'no option rounds to',
      find:"下面哪一個數有可能是真正的距離？',\n          opts:['462','449','551','620'], ans:0,",
      replace:"下面哪一個數有可能是真正的距離？',\n          opts:['430','449','551','620'], ans:0," },
    { file:'index', expect:'more than one option rounds to',
      find:"        { stem:'文字題：小明家到學校的距離，四捨五入到百位以後大約是 500 公尺。下面哪一個數有可能是真正的距離？',\n          opts:['462','449','551','620'], ans:0,",
      replace:"        { stem:'文字題：小明家到學校的距離，四捨五入到百位以後大約是 500 公尺。下面哪一個數有可能是真正的距離？',\n          opts:['462','475','551','620'], ans:0," },
    { file:'index', expect:'decimal point',
      find:"        { stem:'迷思檢查：5372 四捨五入到百位是多少？', opts:['5000','5300','5400','5472'], ans:2,",
      replace:"        { stem:'迷思檢查：5372 四捨五入到百位是多少？', opts:['5000','5300','5400.0','5472'], ans:2," },

    /* ---------- codex 第一輪的三筆修正，各配一筆改壞測試 ---------- */
    /* 「差距 ≤ 一個位值」那兩條斷言沒有配改壞測試，而且是刻意的：對於正確四捨五入
       的值它是**定理**（每個數各自最多移動半個位值），所以只要 ra／rb 的斷言還在，
       任何資料都違反不了它。它留在那裡是把定理寫下來，不是一個守得住的門 ——
       真正在盯這條規則措辭的是下面 s5lead 與 reference 的那幾筆。 */
    { file:'index', expect:'no longer says',
      find:"      s4lead:'「大約是多少」沒有唯一答案 —— 要先講好<strong>四捨五入到哪一位</strong>。同一個數換一個目標位，答案<strong>可能</strong>就不一樣。',",
      replace:"      s4lead:'「大約是多少」沒有唯一答案 —— 要先講好<strong>四捨五入到哪一位</strong>。同一個數換一個目標位，答案就換一個。'," },
    { file:'index', expect:'which is not true across',
      find:"      s5lead:'兩個數各自取概數再算一次，答案會很接近真正的答案：<strong>兩邊最多只差一個位值</strong>（四捨五入到千位，就最多差 1000）。<strong>差得比一個位值還多，就一定是哪裡算錯了。</strong>',",
      replace:"      s5lead:'兩個數各自取概數再算一次，答案會很接近真正的答案。<strong>估出來的數和算出來的數差太多，就是哪裡算錯了。</strong>'," },
    { file:'index', expect:'no longer says',
      find:"      s5lead:'Round both numbers, then do the calculation again — the answer comes out very close to the real one: <strong>the two are at most one place value apart</strong>",
      replace:"      s5lead:'Round both numbers, then do the calculation again — the answer comes out very close to the real one: <strong>the two are near each other</strong>" },
    { file:'index', expect:'does not print the one-place-value bound',
      find:"      s5gap: function(g, pv){ return '估出來的和算出來的差 ' + g + '，沒有超過一個位值（' + pv + '），這是正常的 —— 差得比 ' + pv + ' 還多，就一定是哪裡算錯了。'; },",
      replace:"      s5gap: function(g, pv){ return '估出來的和算出來的差 ' + g + '，這是正常的。'; }," },
    { file:'reference', expect:'the required number of times',
      find:"      e3:'兩邊<strong>最多只差一個位值</strong>（四捨五入到千位就最多差 1000）。差得比一個位值還多，就一定是算式哪裡出錯了 —— 回去檢查。',",
      replace:"      e3:'如果估出來的和算出來的差很多，就是算式哪裡出錯了 —— 回去檢查。'," },
    { file:'reference', expect:'which contradicts the rule this lesson teaches',
      find:"      sw1:'同一個數，目標位不同，答案可能就不同',",
      replace:"      sw1:'同一個數，目標位不同，答案就不同'," },

    /* ---------- codex 第二輪（審產生器）的五筆修正，各配一筆改壞測試 ---------- */
    /* #1 的證明在上面那筆 estimateSum 的改壞測試裡（逼保底上場並讓保底自己違規）。 */
    /* #2 已經停在站上的數不會「往下走」。 */
    { file:'review', expect:'already sitting on a stop',
      find:'        if (cl === 0 && ct === 0) cl = 1 + rand(4);',
      replace:'        cl = 0; ct = 0;' },
    /* #3 左邊那一位也是 9 的話，進位會一路傳下去，解釋只講「進一位」就不完整。 */
    { file:'review', expect:'the carry cascades further than the explanation says',
      find:'    if (Math.floor(head / 10) % 10 === 9) head -= 10;\n    return head;',
      replace:'    if (Math.floor(head / 10) % 10 === 9) head = head;\n    return Math.floor(head / 100) * 100 + 99;' },
    /* #4 正解剛好等於題幹印出來的 b。 */
    { file:'review', expect:'equals one of the numbers printed in the stem',
      find:'          ok = exact !== correct && correct > 0 && exact > 0 && a <= STEM_MAX &&\n               correct !== a && correct !== b;',
      replace:'          ok = exact !== correct && correct > 0 && exact > 0 && a <= STEM_MAX;\n          if (ok){ b = correct; ra = roundTo(a, place); rb = roundTo(b, place); correct = ra - rb; exact = a - b; ok = correct === b; }' },
    /* #5 湊不滿三個誘答時，選項會少於四個。把兩個迴圈都關掉才看得到 ——
       只關隨機那一個的話，保底會把它補滿（那正是保底存在的理由）。 */
    { file:'review', expect:'option count',
      find:'        var cbase = Math.floor(correct / PV[place]);\n        for (var k = 1; wrongs.length < 3 && k <= 60; k++){',
      replace:'        var cbase = Math.floor(correct / PV[place]);\n        wrongs.length = 0;\n        for (var k = 1; wrongs.length < 3 && k <= 0; k++){' },
    /* ---------- codex 第三輪（只審檢查工具）之後補上的守門條件 ---------- */
    /* #2 選項的形狀：在這之前只擋小數點，字串垃圾照樣過。 */
    { file:'index', expect:'is not a whole number',
      find:"        { stem:'8472 四捨五入到千位是多少？', opts:['9000','8500','8000','8400'], ans:2,",
      replace:"        { stem:'8472 四捨五入到千位是多少？', opts:['9000','banana','8000','8400'], ans:2," },
    { file:'index', expect:'is outside 1~',
      find:"        { stem:'36500 四捨五入到萬位是多少？', opts:['30000','36000','37000','40000'], ans:3,",
      replace:"        { stem:'36500 四捨五入到萬位是多少？', opts:['30000','36000','3700000','40000'], ans:3," },
    /* #3 刪掉一筆範例，涵蓋性檢查還是綠的 —— 現在筆數自己也被釘住。 */
    { file:'index', expect:'entries, this config expects',
      find:'    { n:3720,  place:3 },\n',
      replace:'' },
    /* #4 陣列裡挖一個洞：長度不變，forEach 卻會跳過那一格。 */
    { file:'index', expect:'is a hole in the array',
      find:'  var MULTI_NUMS = [48562, 27364, 95500, 349999];',
      replace:'  var MULTI_NUMS = [48562, 27364, , 349999];' },
    /* 洞要挖在中間：結尾多一個逗號不算洞，長度會少一，先被長度那一條攔下來。 */
    { file:'index', expect:'is missing (a hole in the array)',
      find:"      places:['個位','十位','百位','千位','萬位','十萬位'],",
      replace:"      places:['個位','十位','百位','千位', ,'十萬位']," },
    /* #6 子字串比對會把 48562 認在 485620 裡面；換成整個 token 才抓得到。 */
    { file:'index', expect:'s4note',
      find:"          ? n + ' 很特別：四個目標位算出來的答案都一樣",
      replace:"          ? (n * 10) + ' 很特別：四個目標位算出來的答案都一樣" },
    /* #7 stopsOf 只對某一個 case 出錯，以前會被整條下游一起吃掉。 */
    { file:'index', expect:'independently',
      find:'    return { lo: lo, hi: lo + pv, mid: lo + pv / 2, pv: pv };\n  }',
      replace:'    return { lo: lo, hi: lo + pv, mid: (n === 3720 ? lo : lo + pv / 2), pv: pv };\n  }' },

    /* #10 標籤字級改成從 renderS2 自己那一行解析；解析不到就要響亮地失敗，
       不可以靜靜地跳過寬度檢查。 */
    /* #10 版面常數改成由課程匯出；下面三筆分別盯住下緣、上緣，與「畫布沒跟著改」。 */
    { file:'index', expect:'below the 128px canvas',
      find:'  var LBL_MID_DY  = 50, LBL_MID_FONT  = 11;',
      replace:'  var LBL_MID_DY  = 70, LBL_MID_FONT  = 11;' },
    { file:'index', expect:'above the top of the canvas',
      find:'  var LBL_MARK_DY = 36, LBL_MARK_FONT = 15;',
      replace:'  var LBL_MARK_DY = 60, LBL_MARK_FONT = 15;' },
    { file:'index', expect:'but the layout constants say',
      find:'<svg class="numline" id="s2line" viewBox="0 0 640 128"',
      replace:'<svg class="numline" id="s2line" viewBox="0 0 640 112"' },
    { file:'index', expect:'CSS height',
      find:'  .numline{width:100%;height:128px;display:block}',
      replace:'  .numline{width:100%;height:150px;display:block}' },
    /* #9 位名順序只在那張表裡面找；表不見了要報錯，不可以退回整頁去找。 */
    { file:'reference', expect:'has no <table class="places">',
      find:'      <table class="places">',
      replace:'      <table class="placesX">' },

    /* 進位規則的新措辭要有人盯。 */
    { file:'reference', expect:'the required number of times',
      find:"      x2b:'9 加 1 滿十，要<strong>往左邊進位</strong>；左邊如果也是 9，就一路進上去，位數可能因此多一位',",
      replace:"      x2b:'9 加 1 滿十，要<strong>再往左邊進一位</strong>，位數可能因此多一位'," },

    /* ---------- reference.html / parents.html：規則的措辭 ---------- */
    { file:'reference', expect:'reference.html no longer says',
      find:"      rule1:'要四捨五入到某一位，就<b>只看它右邊隔壁那一位</b>",
      replace:"      rule1:'要四捨五入到某一位，就<b>看清楚每一位</b>" },
    { file:'reference', expect:'reference.html no longer says',
      find:"      n3b:'兩邊一樣遠，數線<strong>決定不了</strong> —— 所以<strong>剛好在正中間的時候，約定往上</strong>。",
      replace:"      n3b:'兩邊一樣遠，數線<strong>決定不了</strong> —— 所以<strong>比較近的那一站就是答案</strong>。" },
    { file:'reference', expect:'reference.html no longer says',
      find:"      st3:'<strong>決定捨或入，再把目標位右邊全部變成 0</strong>。',",
      replace:"      st3:'<strong>決定捨或入</strong>。'," },
    { file:'reference', expect:'reference.html no longer says',
      find:"      m2c:'只看十位的 4，比 5 小，直接捨 → 4400。<strong>一位一位往上進位是錯的做法</strong>，會愈滾愈大。',",
      replace:"      m2c:'只看十位的 4，比 5 小，直接捨 → 4400。這樣做會愈滾愈大。'," },
    { file:'reference', expect:'reference.html no longer says',
      find:"      rule1:'To round to a place, <b>look only at the digit immediately to its right</b>",
      replace:"      rule1:'To round to a place, <b>read the digits</b>" },
    { file:'reference', expect:'reference.html no longer says',
      find:"      scope:'這一課只處理<strong>整數</strong>的四捨五入",
      replace:"      scope:'這一課處理<strong>整數</strong>的四捨五入" },
    { file:'reference', expect:'reference.html says',
      find:"      sw2:'看的永遠是目標位右邊隔壁那一位',",
      replace:"      sw2:'看目標位自己的數字來決定'," },
    { file:'reference', expect:'place table has',
      find:'          <td data-i18n="pn3">千位</td>\n          <td data-i18n="pn2">百位</td>',
      replace:'          <td data-i18n="pn2">百位</td>\n          <td data-i18n="pn3">千位</td>' },
    { file:'parents', expect:'parents.html no longer says',
      find:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的概數單元：用四捨五入法取概數，以及用概數估算。孩子要學會三件事：說出「要四捨五入到哪一位」並找到那一位、<strong>只看它右邊隔壁那一位</strong>',
      replace:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的概數單元：用四捨五入法取概數，以及用概數估算。孩子要學會三件事：說出「要四捨五入到哪一位」並找到那一位、<strong>看清楚每一位</strong>' },
    { file:'parents', expect:'parents.html no longer says',
      find:'<strong>looking only at the digit immediately to its right</strong>',
      replace:'<strong>reading the digits carefully</strong>' },
    { file:'parents', expect:'parents.html no longer says',
      find:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「四捨五入快車」有通關</strong>',
      replace:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲有通關</strong>' },
    { file:'parents', expect:'parents.html says',
      find:'"s1p2": "<strong>大人最容易誤解的那一點：</strong>大人記得的規則',
      replace:'"s1p2": "因為比較近，所以往上。<strong>大人最容易誤解的那一點：</strong>大人記得的規則' },
    { file:'parents', expect:'parents.html no longer says',
      find:'這一課<strong>只處理整數的四捨五入</strong>，目標位只有十位、百位、千位、萬位；<strong>小數</strong>的四捨五入，以及<strong>無條件進入</strong>、<strong>無條件捨去</strong>，都是五年級的單元，這裡刻意不碰。題目裡的數最多六位數。</p>',
      replace:'這一課的目標位只有十位、百位、千位、萬位。題目裡的數最多六位數。</p>' }
  ],

  sim: {
    /* fmt() 要印位名，位名表宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    /* 每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
       能從 n 重算的一律從 n 重算，而且用的是**數線那一套**（roundByLine）——
       拿課程自己的 roundTo 來比等於自己比自己。 */
    INVARIANTS: {
      roundNum: d => {
        if (d.place < MIN_PLACE || d.place > MAX_PLACE) return 'roundNum: place out of 1~4';
        if (d.n > STEM_MAX) return 'roundNum: n ' + d.n + ' above the lesson range';
        if (d.n < PV[d.place]) return 'roundNum: n is smaller than the target place, so the answer would be 0';
        if (d.look !== nextDigitAt(d.n, d.place)) return 'roundNum: look is not the digit right of the target place';
        if (d.correct !== roundByLine(d.n, d.place))
          return 'roundNum: correct ' + d.correct + ' does not match the second implementation ' + roundByLine(d.n, d.place);
        if (isHalfway(d.n, d.place)) return 'roundNum: this is the exactly-halfway case, which roundHalf owns';
        if (d.correct === d.n) return 'roundNum: the answer must not equal the number in the stem';
        if (d.correct > VALUE_MAX) return 'roundNum: result above the lesson range';
      },
      whichDigit: d => {
        if (d.place < MIN_PLACE || d.place > MAX_PLACE) return 'whichDigit: place out of 1~4';
        if (d.correct !== d.place - 1) return 'whichDigit: correct is not the place immediately right of the target';
        if (d.n > STEM_MAX) return 'whichDigit: n above the lesson range';
        if (d.n < PV[d.place]) return 'whichDigit: n is smaller than the target place';
      },
      roundHalf: d => {
        if (d.place < MIN_PLACE || d.place > MAX_PLACE) return 'roundHalf: place out of 1~4';
        if (!isHalfway(d.n, d.place)) return 'roundHalf: n is not exactly halfway between the two stops';
        if (d.lower !== Math.floor(d.n / PV[d.place]) * PV[d.place])
          return 'roundHalf: lower is not the stop below n';
        if (d.correct !== d.lower + PV[d.place]) return 'roundHalf: correct must be the upper stop';
        if (d.correct !== roundByLine(d.n, d.place))
          return 'roundHalf: correct does not match the second implementation';
        if (digitAt(d.n, d.place) === 9) return 'roundHalf: the carry case belongs to roundCarry';
        if (d.correct > VALUE_MAX) return 'roundHalf: result above the lesson range';
      },
      roundCarry: d => {
        if (d.place < MIN_PLACE || d.place > MAX_PLACE) return 'roundCarry: place out of 1~4';
        if (digitAt(d.n, d.place) !== 9) return 'roundCarry: the target digit must be 9 for the carry story to hold';
        if (d.look !== nextDigitAt(d.n, d.place)) return 'roundCarry: look is not the digit right of the target place';
        if (d.look < 5) return 'roundCarry: the look digit must be 5 or more, otherwise it does not go up';
        if (isHalfway(d.n, d.place)) return 'roundCarry: this is the exactly-halfway case, which roundHalf owns';
        if (d.lower !== Math.floor(d.n / PV[d.place]) * PV[d.place]) return 'roundCarry: lower is not the stop below n';
        /* 解釋只講「再往左邊進一位」。左邊那一位也是 9 的話，進位會一路傳下去
           （999996 到十位 → 1000000），那句話就不完整了（codex 第二輪 #3）。 */
        if (digitAt(d.n, d.place + 1) === 9)
          return 'roundCarry: the digit left of the target is also 9, so the carry cascades further than the explanation says';
        if (d.correct !== roundByLine(d.n, d.place))
          return 'roundCarry: correct ' + d.correct + ' does not match the second implementation ' + roundByLine(d.n, d.place);
        /* 連鎖進位的意思：目標位加 1 之後滿十，所以目標位變成 0。 */
        if (digitAt(d.correct, d.place) !== 0) return 'roundCarry: the carry did not clear the target digit';
        if (d.correct > VALUE_MAX) return 'roundCarry: result above the lesson range';
      },
      nearestStop: d => {
        if (d.place < 2 || d.place > MAX_PLACE) return 'nearestStop: place out of 2~4';
        if (d.lo !== Math.floor(d.n / PV[d.place]) * PV[d.place]) return 'nearestStop: lo is not the stop below n';
        if (d.hi !== d.lo + PV[d.place]) return 'nearestStop: hi is not one place value above lo';
        if (isHalfway(d.n, d.place))
          return 'nearestStop: n sits exactly halfway, so "closer to" is not true of either stop';
        if (d.n === d.lo) return 'nearestStop: n is already sitting on a stop';
        if (d.correct !== d.lo && d.correct !== d.hi) return 'nearestStop: correct is not one of the two stops';
        /* 「比較靠近」這句話必須真的成立 —— 直接比兩段距離，不是相信產生器。 */
        const far = (d.correct === d.lo) ? d.hi : d.lo;
        if (Math.abs(d.n - d.correct) >= Math.abs(d.n - far))
          return 'nearestStop: correct is not the nearer stop (' + Math.abs(d.n - d.correct) + ' vs ' + Math.abs(d.n - far) + ')';
        if (d.correct !== roundByLine(d.n, d.place))
          return 'nearestStop: correct does not match the second implementation';
      },
      rangeLow: d => {
        if (d.place < 2 || d.place > MAX_PLACE) return 'rangeLow: place out of 2~4';
        if (d.target % PV[d.place] !== 0) return 'rangeLow: target is not a whole multiple of the place value';
        if (roundByLine(d.correct, d.place) !== d.target)
          return 'rangeLow: correct is not the smallest number that rounds to the target (it does not round there at all)';
        if (roundByLine(d.correct - 1, d.place) === d.target)
          return 'rangeLow: correct is not the smallest number that rounds to the target (one less also rounds there)';
        if (d.correct !== d.target - PV[d.place] / 2)
          return 'rangeLow: correct is not the smallest number that rounds to the target';
        if (d.correct <= 0 || d.target > STEM_MAX) return 'rangeLow: out of the lesson range';
      },
      rangeCheck: d => {
        if (d.place < 2 || d.place > MAX_PLACE) return 'rangeCheck: place out of 2~4';
        if (d.target % PV[d.place] !== 0) return 'rangeCheck: target is not a whole multiple of the place value';
        if (roundByLine(d.correct, d.place) !== d.target)
          return 'rangeCheck: the marked answer does not round to ' + d.target;
        if (d.correct === d.target) return 'rangeCheck: the answer must not be the target itself';
        const inside = d.opts.filter(v => roundByLine(Number(v), d.place) === d.target);
        if (inside.length !== 1)
          return 'rangeCheck: more than one option rounds to ' + d.target + ' (' + inside.join(',') + ')';
        if (new Set(d.opts.map(Number)).size !== d.opts.length) return 'rangeCheck: duplicate option values';
        if (d.opts.some(v => Number(v) <= 0 || Number(v) > STEM_MAX)) return 'rangeCheck: an option is out of the lesson range';
      },
      estimateSum: d => {
        if (d.place < 2 || d.place > MAX_PLACE) return 'estimateSum: place out of 2~4';
        if (d.ra !== roundByLine(d.a, d.place)) return 'estimateSum: ra is not a rounded to the target place';
        if (d.rb !== roundByLine(d.b, d.place)) return 'estimateSum: rb is not b rounded to the target place';
        if (d.correct !== d.ra + d.rb) return 'estimateSum: correct is not the sum of the two rounded numbers';
        if (d.exact !== d.a + d.b) return 'estimateSum: exact is not a + b';
        if (d.exact === d.correct)
          return 'estimateSum: the exact answer equals the estimate, so the lesson point disappears';
        if (Math.abs(d.exact - d.correct) > PV[d.place])
          return 'estimateSum: the gap between the estimate and the exact answer exceeds one place value, which contradicts the rule this lesson teaches';
        if (d.opts.map(Number).indexOf(d.exact) >= 0)
          return 'estimateSum: the exact answer must not be an option (an estimate question must not offer the precise total)';
        /* 正解不可以等於題幹印出來的數 —— 那等於把答案印在題目上（codex 第二輪 #4）。 */
        if (d.correct === d.a || d.correct === d.b)
          return 'estimateSum: the answer equals one of the numbers printed in the stem';
        if (d.a > STEM_MAX || d.b > STEM_MAX || d.exact > STEM_MAX) return 'estimateSum: above the lesson range';
        if (d.correct > VALUE_MAX) return 'estimateSum: result above the lesson range';
      },
      estimateDiff: d => {
        if (d.place < 2 || d.place > MAX_PLACE) return 'estimateDiff: place out of 2~4';
        if (d.ra !== roundByLine(d.a, d.place)) return 'estimateDiff: ra is not a rounded to the target place';
        if (d.rb !== roundByLine(d.b, d.place)) return 'estimateDiff: rb is not b rounded to the target place';
        if (d.correct !== d.ra - d.rb) return 'estimateDiff: correct is not the difference of the two rounded numbers';
        if (d.exact !== d.a - d.b) return 'estimateDiff: exact is not a - b';
        if (d.a <= d.b) return 'estimateDiff: a must be bigger than b, or the difference goes negative';
        if (d.correct <= 0 || d.exact <= 0) return 'estimateDiff: the difference must stay positive';
        if (d.exact === d.correct)
          return 'estimateDiff: the exact answer equals the estimate, so the lesson point disappears';
        if (Math.abs(d.exact - d.correct) > PV[d.place])
          return 'estimateDiff: the gap between the estimate and the exact answer exceeds one place value, which contradicts the rule this lesson teaches';
        if (d.opts.map(Number).indexOf(d.exact) >= 0)
          return 'estimateDiff: the exact answer must not be an option';
        /* 400 － 200 ＝ 200 會讓正解剛好等於題幹的 b（codex 第二輪 #4）。 */
        if (d.correct === d.a || d.correct === d.b)
          return 'estimateDiff: the answer equals one of the numbers printed in the stem';
        if (d.a > STEM_MAX) return 'estimateDiff: above the lesson range';
      },
      whichRoundsDown: d => {
        if (d.place < MIN_PLACE || d.place > MAX_PLACE) return 'whichRoundsDown: place out of 1~4';
        const downs = d.opts.map(Number).filter(v => nextDigitAt(v, d.place) < 5);
        if (downs.length !== 1)
          return 'whichRoundsDown: ' + downs.length + ' options go down, expected exactly 1 (' + downs.join(',') + ')';
        if (downs[0] !== d.correct) return 'whichRoundsDown: the marked answer does not go down';
        /* 已經停在站上的數根本沒有「往下走」，題幹那句話就落空了（codex 第二輪 #2）。 */
        if (d.correct % PV[d.place] === 0)
          return 'whichRoundsDown: the answer is already sitting on a stop, so it never goes down';
        if (new Set(d.opts.map(Number)).size !== d.opts.length) return 'whichRoundsDown: duplicate option values';
        if (d.opts.some(v => Number(v) > STEM_MAX || Number(v) < PV[d.place]))
          return 'whichRoundsDown: an option is smaller than the target place or above the lesson range';
      },
      aboutWan: d => {
        if (d.place !== MAX_PLACE) return 'aboutWan: this generator always rounds to the ten-thousands place';
        if (d.n > STEM_MAX) return 'aboutWan: n above the lesson range';
        if (d.n < 10000) return 'aboutWan: n must reach the ten-thousands place';
        if (d.head !== Math.floor(d.n / 10000)) return 'aboutWan: head is not n divided by 10000';
        if (d.look !== nextDigitAt(d.n, 4)) return 'aboutWan: look is not the thousands digit';
        if (d.correct !== roundByLine(d.n, 4) / 10000)
          return 'aboutWan: correct is not n rounded to the ten-thousands place, counted in ten-thousands';
        if (!Number.isInteger(d.correct) || d.correct < 1 || d.correct > 100)
          return 'aboutWan: the count of ten-thousands is out of 1~100';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數（或選項本身）重算，
       完全不讀 d.correct，而且走的是數線那一套。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'roundNum':
        case 'roundHalf':
        case 'roundCarry':
        case 'nearestStop':   return String(roundByLine(d.n, d.place));
        case 'whichDigit':    return placeOptText(d.place - 1, lang);
        case 'rangeLow':      return String(d.target - PV[d.place] / 2);
        /* 這一題的正解是「唯一一個四捨五入之後等於 target 的選項」—— 從選項重算。 */
        case 'rangeCheck': {
          const hit = d.opts.map(Number).filter(v => roundByLine(v, d.place) === d.target);
          return hit.length === 1 ? String(hit[0]) : null;
        }
        case 'estimateSum':   return String(roundByLine(d.a, d.place) + roundByLine(d.b, d.place));
        case 'estimateDiff':  return String(roundByLine(d.a, d.place) - roundByLine(d.b, d.place));
        case 'whichRoundsDown': {
          const hit = d.opts.map(Number).filter(v => nextDigitAt(v, d.place) < 5);
          return hit.length === 1 ? String(hit[0]) : null;
        }
        case 'aboutWan':      return String(roundByLine(d.n, 4) / 10000);
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：位名、兩站的數、每一個參數都是現算的。
       資料全對、選項全對，位名印錯一樣會教錯 —— 所以在這裡把
       「畫面上真的印了什麼」拿真值表再驗一次。 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const why = String(q.why).replace(/<[^>]+>/g, ' ');
      const nums = (stem.match(/\d+/g) || []).map(Number);
      const places = PLACES[lang];

      /* 位名互為子字串（萬位 ⊂ 十萬位、thousands ⊂ ten-thousands），
         所以只留沒有被更長的命中包住的那些。 */
      function longestHits(text){
        const hits = places.filter(w => text.indexOf(w) >= 0);
        return hits.filter(w => !hits.some(o => o !== w && o.indexOf(w) >= 0));
      }
      /* 題幹說的目標位必須剛好是 d.place —— 說錯或說了兩個都要響。 */
      /* nearestStop 的題幹刻意不講位名（它印的是兩站的數），所以不在這一列；
         它的位名由下面「why 要指名目標位」那一條盯。 */
      const NAMES_PLACE = ['roundNum','whichDigit','roundHalf','roundCarry',
                           'rangeLow','rangeCheck','estimateSum',
                           'estimateDiff','whichRoundsDown','aboutWan'];
      if (NAMES_PLACE.indexOf(genId) >= 0){
        const said = longestHits(stem);
        if (said.length !== 1)
          return genId + ' stem names ' + (said.length ? said.join('/') : 'no') + ' place, expected exactly one';
        if (said[0] !== places[d.place])
          return genId + ' names the ' + said[0] + ' place, the data says ' + places[d.place];
      }
      /* 題幹一定要印出它自己在講的那個數。 */
      if (['roundNum','whichDigit','roundHalf','roundCarry','nearestStop','aboutWan'].indexOf(genId) >= 0
          && nums.indexOf(d.n) < 0)
        return genId + ' stem does not print the number ' + d.n + ' (printed ' + nums.join(',') + ')';
      if (genId === 'nearestStop' && (nums.indexOf(d.lo) < 0 || nums.indexOf(d.hi) < 0))
        return 'nearestStop stem does not print both stops ' + d.lo + ' and ' + d.hi;
      if ((genId === 'rangeLow' || genId === 'rangeCheck') && nums.indexOf(d.target) < 0)
        return genId + ' stem does not print the target ' + d.target;
      if ((genId === 'estimateSum' || genId === 'estimateDiff') &&
          (nums.indexOf(d.a) < 0 || nums.indexOf(d.b) < 0))
        return genId + ' stem does not print both numbers ' + d.a + ' and ' + d.b;
      /* 估算題的題幹不可以把**答案**（估計值）印出來 —— 那就不用估了。
         注意盯的是 correct 而不是 exact：a ＝ 2b 的時候 a − b 剛好等於題幹印出來的 b，
         可是這一題問的是 ra − rb，精確差本來就不是答案，那不是缺陷。
         「精確答案不可以當選項」則是另一條，寫在 INVARIANTS 裡。 */
      if ((genId === 'estimateSum' || genId === 'estimateDiff') && nums.indexOf(d.correct) >= 0)
        return genId + ' stem prints the answer ' + d.correct;
      /* rangeCheck 的解釋寫出範圍，那個範圍必須真的正確。 */
      if (genId === 'rangeCheck'){
        const half = PV[d.place] / 2;
        const wNums = (why.match(/\d+/g) || []).map(Number);
        if (wNums.indexOf(d.target - half) < 0 || wNums.indexOf(d.target + half - 1) < 0)
          return 'rangeCheck why states the wrong range (should be ' + (d.target - half) + '~' + (d.target + half - 1) + ')';
      }
      /* whichDigit 與 whichRoundsDown 的解釋要指名「右邊隔壁那一位」。 */
      if (genId === 'nearestStop' && why.indexOf(places[d.place]) < 0)
        return 'nearestStop why does not name the ' + places[d.place] + ' place';
      if (genId === 'whichDigit' && why.indexOf(places[d.place - 1]) < 0)
        return 'whichDigit why does not name the ' + places[d.place - 1] + ' place';
      if (genId === 'whichRoundsDown' && why.indexOf(places[d.place - 1]) < 0)
        return 'whichRoundsDown why does not name the ' + places[d.place - 1] + ' place';

      /* 解釋必須把正解自己印出來，不然算式和答案可以各說各話。 */
      const want = module.exports.sim.expectedCorrect(d, genId, lang);
      if (want !== null){
        const stated = /^-?\d+$/.test(want)
          ? (why.match(/\d+/g) || []).indexOf(want) >= 0
          : why.toLowerCase().indexOf(want.toLowerCase()) >= 0;
        if (!stated)
          return genId + ' why never prints the correct answer ' + want;
      }
      /* 這一課只做整數 —— 任何地方冒出小數點都是缺陷。 */
      if (/\d\.\d/.test(stem) || /\d\.\d/.test(String(q.opts.join(' '))))
        return genId + ' prints a decimal point, but this lesson is whole numbers only';
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的 —— 各自只放行那一個值。 */
    stemEchoOk: {
      /* 數線題問的就是題幹印出來的那兩站，選項本來就是它們。 */
      nearestStop: function(d, opt){ return Number(opt) === d.lo || Number(opt) === d.hi; },
      /* 「四捨五入之後是 X，最小是多少？」→ 直接答 X：以為概數就是原來的數。 */
      rangeLow: function(d, opt){ return Number(opt) === d.target; }
    },

    /* 選項的形狀與範圍。「要看哪一位」那一題的選項是位名，不是數字。 */
    optionOk: function(s, genId, lang){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (genId === 'whichDigit'){
        const allowed = PLACES[lang].map((_, i) => placeOptText(i, lang));
        if (allowed.indexOf(String(s)) < 0) return 'whichDigit option ' + s + ' is not a place name';
        return null;
      }
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [10, VALUE_MAX];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{STEM_MAX, VALUE_MAX, PV, MIN_PLACE, MAX_PLACE, digitAt, nextDigit, roundTo, ' +
                'stopsOf, roundSteps, LINE_W, LINE_H, LINE_X0, LINE_X1, LINE_Y, markerX, ' +
                'LBL_STOP_DY, LBL_STOP_FONT, LBL_MID_DY, LBL_MID_FONT, ' +
                'LBL_MARK_DY, LBL_MARK_FONT, MARK_TOP_DY, ' +
                'WHY_CASES, LINE_CASES, STEP_CASES, MULTI_NUMS, EST_CASES, ROUNDS}',
    optionValueMax: VALUE_MAX,

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      if (data.STEM_MAX !== STEM_MAX) fail(`the lesson's STEM_MAX is ${data.STEM_MAX}, this config assumes ${STEM_MAX}`);
      if (data.VALUE_MAX !== VALUE_MAX) fail(`the lesson's VALUE_MAX is ${data.VALUE_MAX}, this config assumes ${VALUE_MAX}`);
      if (data.MIN_PLACE !== MIN_PLACE || data.MAX_PLACE !== MAX_PLACE)
        fail(`the lesson's target places are ${data.MIN_PLACE}~${data.MAX_PLACE}, this config assumes ${MIN_PLACE}~${MAX_PLACE}`);
      if (data.PV.length < 6 || data.PV.some((v, i) => v !== PV[i]))
        fail('the lesson PV table does not match this config');

      /* --- 每一組範例資料的**筆數**也要釘住（codex 第三輪 #3） ---
         只驗「有沒有涵蓋每一種情形」的話，刪掉一筆多餘的例子不會有人發現：
         畫面上少了一個 chip，所有斷言卻還是綠的。 */
      const SIZES = { WHY_CASES:3, LINE_CASES:5, STEP_CASES:5, MULTI_NUMS:4, EST_CASES:4, ROUNDS:5 };
      Object.keys(SIZES).forEach(key => {
        const arr = data[key];
        if (!Array.isArray(arr) || arr.length !== SIZES[key])
          fail(`${key} has ${arr ? arr.length : 'no'} entries, this config expects ${SIZES[key]}`);
        /* 陣列裡挖一個洞（`[a, , c]`）長度不變，而 forEach 會直接跳過那一格
           —— 下面每一圈都看不到它（codex 第三輪 #4）。 */
        if (Array.isArray(arr)){
          for (let i = 0; i < arr.length; i++){
            if (!Object.prototype.hasOwnProperty.call(arr, i))
              fail(`${key}[${i}] is a hole in the array, so every check below would skip it`);
          }
        }
      });

      /* --- 這一課教的規則本身：兩個說法必須對整個定義域一致 ---
         「看下一位」（課程的 roundTo）與「停在比較近的那一站，剛好正中間往上」
         （這裡的 roundByLine）是課程明講「答案永遠一樣」的兩件事。
         只驗幾個好記的例子等於沒驗 —— 這裡掃過整個小數段再加上每一站的
         「正中間 ±1」邊界，規則最容易在那裡出錯。 */
      let sweepFail = 0;
      function sameRule(n, place){
        if (sweepFail > 4) return;
        const a = data.roundTo(n, place), b = roundByLine(n, place);
        if (a !== b){
          sweepFail++;
          fail(`roundTo(${n}, ${place}) = ${a} disagrees with the number-line rule (${b})`);
        }
      }
      for (let place = MIN_PLACE; place <= MAX_PLACE; place++){
        for (let n = 0; n <= 20000; n++) sameRule(n, place);
        const pv = PV[place];
        for (let head = 1; head <= Math.floor(STEM_MAX / pv); head++){
          const lo = head * pv;
          [lo - 1, lo, lo + pv / 2 - 1, lo + pv / 2, lo + pv / 2 + 1, lo + pv - 1].forEach(v => {
            if (v >= 0 && v <= STEM_MAX) sameRule(v, place);
          });
        }
      }
      /* 位值與「下一位」也各自驗一次，不是只驗合成的結果。 */
      [0, 7, 48562, 349999, 95500, STEM_MAX].forEach(n => {
        for (let p = 0; p <= 5; p++){
          const want = Math.floor(n / PV[p]) % 10;
          if (data.digitAt(n, p) !== want) fail(`digitAt(${n}, ${p}) = ${data.digitAt(n, p)}, expected ${want}`);
          if (p >= 1 && data.nextDigit(n, p) !== Math.floor(n / PV[p - 1]) % 10)
            fail(`nextDigit(${n}, ${p}) is not the digit one place to the right`);
        }
      });

      /* --- stopsOf：兩站與正中間 --- */
      [[3400,3],[3500,3],[472,2],[46800,4],[10,1],[STEM_MAX,4]].forEach(([n, place]) => {
        const s = data.stopsOf(n, place);
        const lo = Math.floor(n / PV[place]) * PV[place];
        if (s.lo !== lo) fail(`stopsOf(${n}, ${place}).lo = ${s.lo}, expected ${lo}`);
        if (s.hi !== lo + PV[place]) fail(`stopsOf(${n}, ${place}).hi is not one place value above lo`);
        if (s.mid !== lo + PV[place] / 2) fail(`stopsOf(${n}, ${place}).mid is not the midpoint`);
        if (!Number.isInteger(s.mid)) fail(`stopsOf(${n}, ${place}).mid is not a whole number`);
        if (!(s.lo <= n && n < s.hi)) fail(`stopsOf(${n}, ${place}) does not bracket n`);
      });

      /* --- roundSteps：範例 3 的四個步驟 ---
         形狀、每一步的內容、以及 carried 這個旗標，都要各自驗
         （只驗最後的 result 會 fail-open：中間三步全錯，畫面上照樣講錯話）。 */
      /* 3912 是專門為 `carried` 準備的：目標位是 9，可是看的那一位是 1（要捨），
         所以 carried 必須是 false。少了這一格，`carried: digitAt(n, place) === 9`
         這種漏掉 `up &&` 的寫法就沒有人抓得到。 */
      const stepProbe = data.STEP_CASES.concat([{n:3999, place:2}, {n:4000, place:3},
                                                {n:15, place:1}, {n:3912, place:2}]);
      stepProbe.forEach(c => {
        const st = data.roundSteps(c.n, c.place);
        if (!Array.isArray(st) || st.length !== 4){
          fail(`roundSteps(${c.n}, ${c.place}) returned ${st ? st.length : 'no'} steps, expected 4`);
          return;
        }
        const kinds = st.map(s => s.kind).join(',');
        if (kinds !== 'target,look,decide,result')
          fail(`roundSteps(${c.n}, ${c.place}) step shape is ${kinds}, expected target,look,decide,result`);
        const look = nextDigitAt(c.n, c.place);
        if (st[0].place !== c.place || st[0].digit !== digitAt(c.n, c.place))
          fail(`roundSteps(${c.n}, ${c.place}) step 1 names place ${st[0].place} digit ${st[0].digit}, expected ${c.place}/${digitAt(c.n, c.place)}`);
        if (st[1].place !== c.place - 1 || st[1].digit !== look)
          fail(`roundSteps(${c.n}, ${c.place}) step 2 names place ${st[1].place} digit ${st[1].digit}, expected ${c.place - 1}/${look}`);
        if (st[2].up !== (look >= 5) || st[2].digit !== look)
          fail(`roundSteps(${c.n}, ${c.place}) step 3 says up=${st[2].up} for a look digit of ${look}`);
        const wantCarried = (look >= 5) && digitAt(c.n, c.place) === 9;
        if (st[2].carried !== wantCarried)
          fail(`roundSteps(${c.n}, ${c.place}) says carried=${st[2].carried}, expected ${wantCarried}`);
        const lo = Math.floor(c.n / PV[c.place]) * PV[c.place];
        if (st[3].lower !== lo || st[3].pv !== PV[c.place])
          fail(`roundSteps(${c.n}, ${c.place}) step 4 reports lower ${st[3].lower} / pv ${st[3].pv}`);
        if (st[3].result !== roundByLine(c.n, c.place))
          fail(`roundSteps(${c.n}, ${c.place}) step 4 result ${st[3].result} disagrees with the number-line rule ${roundByLine(c.n, c.place)}`);
      });

      /* --- 數線畫布：座標與標籤都要留在畫面裡 ---
         「筆數對」不等於「圖畫對了」：這裡驗的是位置，不是元素的數量。 */
      if (data.LINE_X0 <= 0 || data.LINE_X1 >= data.LINE_W || data.LINE_X0 >= data.LINE_X1)
        fail(`the number line runs ${data.LINE_X0}~${data.LINE_X1} inside a ${data.LINE_W}px canvas`);
      /* 版面常數現在由課程自己匯出，renderS2 直接用它們畫 —— 所以這裡驗的是
         畫面真正會用到的值，不是抄在註解裡的數字（codex 第三輪 #10）。 */
      const MARK_FONT = data.LBL_MARK_FONT;
      [['LINE_H', data.LINE_H], ['LINE_Y', data.LINE_Y],
       ['LBL_STOP_DY', data.LBL_STOP_DY], ['LBL_STOP_FONT', data.LBL_STOP_FONT],
       ['LBL_MID_DY', data.LBL_MID_DY], ['LBL_MID_FONT', data.LBL_MID_FONT],
       ['LBL_MARK_DY', data.LBL_MARK_DY], ['LBL_MARK_FONT', data.LBL_MARK_FONT],
       ['MARK_TOP_DY', data.MARK_TOP_DY]].forEach(([n, v]) => {
        if (!(typeof v === 'number' && v > 0)) fail(`the number line's ${n} is not a positive number (${v})`);
      });
      /* --- 上下緣：以前**完全沒有人在驗** ---
         「正中間」那一行的基線本來落在 y ＝ 116，畫布只有 112 高，下緣被切掉了，
         而所有檢查都是綠的 —— 因為它們只驗左右，沒驗上下。字級當作下伸部的
         寬鬆估計（實測 11px 的字下緣約多 3.5px）。 */
      if (data.LINE_Y + data.LBL_MID_DY + data.LBL_MID_FONT > data.LINE_H)
        fail(`the "halfway" caption reaches y=${data.LINE_Y + data.LBL_MID_DY + data.LBL_MID_FONT}, below the ${data.LINE_H}px canvas`);
      if (data.LINE_Y + data.LBL_STOP_DY + data.LBL_STOP_FONT > data.LINE_H)
        fail(`the stop labels reach y=${data.LINE_Y + data.LBL_STOP_DY + data.LBL_STOP_FONT}, below the ${data.LINE_H}px canvas`);
      if (data.LINE_Y - data.LBL_MARK_DY - data.LBL_MARK_FONT < 0)
        fail(`the marker label reaches y=${data.LINE_Y - data.LBL_MARK_DY - data.LBL_MARK_FONT}, above the top of the canvas`);
      if (data.LINE_Y - data.MARK_TOP_DY < 0)
        fail('the marker arrow is drawn above the top of the canvas');
      if (data.LINE_Y >= data.LINE_H) fail('the number line itself is drawn below the canvas');
      /* 畫布的 viewBox 與 CSS 高度必須跟著 LINE_H 走，不然常數改了畫面沒改。 */
      if (process.argv[2]){
        let src = '';
        try { src = fs.readFileSync(process.argv[2], 'utf8'); } catch (err){ src = ''; }
        src = src.replace(/<!--[\s\S]*?-->/g, ' ');
        const vb = src.match(/id="s2line"[^>]*viewBox="0 0 (\d+) (\d+)"/);
        if (!vb) fail('cannot find the s2line viewBox, so the canvas-size check did not run');
        else if (Number(vb[1]) !== data.LINE_W || Number(vb[2]) !== data.LINE_H)
          fail(`the s2line viewBox is ${vb[1]}x${vb[2]}, but the layout constants say ${data.LINE_W}x${data.LINE_H}`);
        const css = src.match(/\.numline\{[^}]*height:(\d+)px/);
        if (!css) fail('cannot find the .numline CSS height, so the canvas-size check did not run');
        else if (Number(css[1]) !== data.LINE_H)
          fail(`the .numline CSS height is ${css[1]}px, but the layout constants say ${data.LINE_H}`);
      }
      data.LINE_CASES.concat([{n:0, place:3}, {n:STEM_MAX, place:4}]).forEach(c => {
        const s = stopsOfRef(c.n, c.place);
        [s.lo, s.mid, c.n, s.hi].forEach(v => {
          const x = data.markerX(v, s.lo, s.hi);
          if (!(x >= data.LINE_X0 && x <= data.LINE_X1))
            fail(`markerX(${v}) = ${x} falls outside the line ${data.LINE_X0}~${data.LINE_X1}`);
          /* 標籤置中，所以左右各要放得下半個字串。 */
          const halfW = String(v).length * MARK_FONT * 0.6 / 2;
          if (x - halfW < 0 || x + halfW > data.LINE_W)
            fail(`the label "${v}" at x=${x} would be drawn outside the canvas (0~${data.LINE_W})`);
        });
        if (data.markerX(s.lo, s.lo, s.hi) !== data.LINE_X0) fail(`markerX does not put the lower stop at ${data.LINE_X0}`);
        if (data.markerX(s.hi, s.lo, s.hi) !== data.LINE_X1) fail(`markerX does not put the upper stop at ${data.LINE_X1}`);
        if (data.markerX(s.mid, s.lo, s.hi) !== (data.LINE_X0 + data.LINE_X1) / 2)
          fail('markerX does not put the midpoint in the middle');
        /* 界外要被夾回線上 —— 沒有這兩行的話，markerX 的 clamp 分支
           在任何探測值下都跑不到，等於沒有被證明過。 */
        if (data.markerX(s.hi + s.pv, s.lo, s.hi) !== data.LINE_X1)
          fail('markerX does not clamp a value above the upper stop back onto the line');
        if (data.markerX(s.lo - s.pv, s.lo, s.hi) !== data.LINE_X0)
          fail('markerX does not clamp a value below the lower stop back onto the line');
      });

      /* --- 課程頁自己的措辭（codex 第一輪抓到兩條寫得太滿的規則） ---
         ① 「同一個數換一個目標位，答案就換一個」在 349999 上是假的（四個答案都一樣），
            而那個數就在這一課自己的 MULTI_NUMS 裡。
         ② 「估出來的和算出來的差太多就是算錯了」是假的：正確地四捨五入本來就可能
            差到一整個位值（14999 ＋ 14999 各自到萬位 → 20000，精確是 29998）。
            真正成立的是「最多差一個位值」。
         這兩條修好之後沒有任何檢查在守，所以釘在這裡。 */
      const LEAD_MUST = {
        zh: { s4lead: '答案<strong>可能</strong>就不一樣', s5lead: '兩邊最多只差一個位值' },
        en: { s4lead: 'the answer can change with it', s5lead: 'at most one place value apart' }
      };
      const LEAD_FORBID = {
        zh: { s4lead: '答案就換一個', s5lead: '差太多，就是哪裡算錯了' },
        en: { s4lead: 'the answer changes with it', s5lead: 'something went wrong somewhere' }
      };
      LANGS.forEach(L => {
        Object.keys(LEAD_MUST[L]).forEach(key => {
          const txt = String(I18N[L][key]);
          if (txt.indexOf(LEAD_MUST[L][key]) < 0)
            fail(L + '.' + key + ' no longer says "' + LEAD_MUST[L][key] + '"');
          if (txt.indexOf(LEAD_FORBID[L][key]) >= 0)
            fail(L + '.' + key + ' says "' + LEAD_FORBID[L][key] +
                 '", which is not true across this lesson\'s whole range');
        });
      });

      /* --- 字典的位名表要和這份設定的真值表逐字相同 --- */
      LANGS.forEach(L => {
        const got = I18N[L].places;
        if (!Array.isArray(got) || got.length !== 6) return fail(`${L}.places is not a 6-entry place-name table`);
        /* 用索引迴圈，不用 forEach：`['a', , 'c']` 的洞長度算得進去，
           forEach 卻會跳過那一格，位名少一個也是綠的（codex 第三輪 #4）。 */
        for (let i = 0; i < 6; i++){
          if (!Object.prototype.hasOwnProperty.call(got, i))
            fail(`${L}.places[${i}] is missing (a hole in the array)`);
          else if (got[i] !== PLACES[L][i])
            fail(`${L}.places[${i}] is "${got[i]}", the place-name table says "${PLACES[L][i]}"`);
        }
      });

      /* --- 範例 1：情境卡（文案與資料是索引對齊的兩個陣列） --- */
      data.WHY_CASES.forEach((c, i) => {
        if (c.n > STEM_MAX) fail(`WHY_CASES ${c.n} above the lesson range`);
        if (c.place < MIN_PLACE || c.place > MAX_PLACE) fail(`WHY_CASES ${c.n} target place ${c.place} out of ${MIN_PLACE}~${MAX_PLACE}`);
        if (c.place >= MIN_PLACE && c.place <= MAX_PLACE && c.n < PV[c.place])
          fail(`WHY_CASES ${c.n} is smaller than its target place, so the rounded value would be 0`);
        const r = (c.place >= MIN_PLACE && c.place <= MAX_PLACE) ? roundByLine(c.n, c.place) : null;
        LANGS.forEach(L => {
          const w = I18N[L].whyCases[i];
          if (!w) return fail(`whyCases ${L}[${i}] is missing`);
          const exactNums = (w.exact.match(/\d+/g) || []).map(Number);
          const approxNums = (w.approx.match(/\d+/g) || []).map(Number);
          if (exactNums.indexOf(c.n) < 0) fail(`whyCases ${L}[${i}] the exact line does not print ${c.n}`);
          if (r !== null && approxNums.indexOf(r) < 0) fail(`whyCases ${L}[${i}] the approx line does not print the rounded value ${r}`);
          if (approxNums.indexOf(c.n) >= 0) fail(`whyCases ${L}[${i}] the approx line still prints the exact number ${c.n}`);
          if (c.place >= 0 && c.place <= 5 && w.tail.indexOf(PLACES[L][c.place]) < 0)
            fail(`whyCases ${L}[${i}] does not name the target place ${PLACES[L][c.place]}`);
          if (/undefined|NaN/.test(w.label + w.exact + w.approx + w.tail)) fail(`whyCases ${L}[${i}] renders undefined/NaN`);
        });
      });
      if (data.WHY_CASES.length < 3) fail('WHY_CASES needs at least three situations');

      /* --- 範例 2：數線 --- */
      let midCases = 0, belowCases = 0, aboveCases = 0;
      data.LINE_CASES.forEach(c => {
        if (c.n > STEM_MAX) fail(`LINE_CASES ${c.n} above the lesson range`);
        if (c.place < 2 || c.place > MAX_PLACE) fail(`LINE_CASES ${c.n} target place ${c.place} out of 2~4`);
        if (c.n < PV[c.place]) fail(`LINE_CASES ${c.n} is smaller than its target place`);
        /* 兩站自己算一次，順便把課程的 stopsOf 也拿來對一次 ——
           以前這裡直接用 data.stopsOf 當標準答案（codex 第三輪 #7）。 */
        const s = stopsOfRef(c.n, c.place);
        const got = data.stopsOf(c.n, c.place);
        if (got.lo !== s.lo || got.hi !== s.hi || got.mid !== s.mid)
          fail(`stopsOf(${c.n}, ${c.place}) gives ${got.lo}/${got.mid}/${got.hi}, independently ${s.lo}/${s.mid}/${s.hi}`);
        if (c.n === s.mid) midCases++;
        else if (c.n < s.mid) belowCases++;
        else aboveCases++;
        const ans = roundByLine(c.n, c.place);
        LANGS.forEach(L => {
          const pn = PLACES[L][c.place];
          const near = I18N[L].s2near(c.n, s.lo, s.hi, pn, ans);
          const half = I18N[L].s2half(c.n, s.lo, s.hi, pn, ans);
          [near, half].forEach(txt => {
            if (/undefined|NaN/.test(txt)) fail(`s2 text ${L} ${c.n}: ${txt}`);
            [c.n, s.lo, s.hi, ans].forEach(v => {
              if (!printsNum(txt, v)) fail(`s2 text ${L} ${c.n} does not print ${v}`);
            });
            if (txt.indexOf(pn) < 0) fail(`s2 text ${L} ${c.n} does not name the ${pn} place`);
          });
        });
      });
      if (midCases !== 1) fail(`LINE_CASES has ${midCases} cases sitting exactly halfway, expected exactly 1`);
      if (!belowCases) fail('LINE_CASES has no case below the halfway point');
      if (!aboveCases) fail('LINE_CASES has no case above the halfway point');

      /* --- 範例 3：逐步 --- */
      let stepDown = 0, stepUp = 0, stepMid = 0, stepCarry = 0;
      data.STEP_CASES.forEach(c => {
        if (c.n > STEM_MAX) fail(`STEP_CASES ${c.n} above the lesson range`);
        if (c.place < MIN_PLACE || c.place > MAX_PLACE) fail(`STEP_CASES ${c.n} target place out of range`);
        if (c.n < PV[c.place]) fail(`STEP_CASES ${c.n} is smaller than its target place`);
        const look = nextDigitAt(c.n, c.place);
        if (look < 5) stepDown++; else stepUp++;
        if (isHalfway(c.n, c.place)) stepMid++;
        if (look >= 5 && digitAt(c.n, c.place) === 9) stepCarry++;
        LANGS.forEach(L => {
          const st = data.roundSteps(c.n, c.place);
          const d = I18N[L];
          const texts = [
            d.s3start(c.n, PLACES[L][c.place]),
            d.s3target(PLACES[L][c.place], st[0].digit),
            d.s3lookAt(PLACES[L][c.place], PLACES[L][c.place - 1], st[1].digit),
            st[2].up ? (st[2].carried ? d.s3upCarry(st[2].digit) : d.s3up(st[2].digit)) : d.s3down(st[2].digit),
            d.s3resultLine(c.n, PLACES[L][c.place], st[3].result)
          ];
          texts.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s3 text ${L} ${c.n}: ${t}`); });
          if (!printsNum(texts[1], st[0].digit)) fail(`s3target ${L} ${c.n} does not print the target digit`);
          if (!printsNum(texts[2], st[1].digit)) fail(`s3lookAt ${L} ${c.n} does not print the look digit`);
          if (texts[2].indexOf(PLACES[L][c.place - 1]) < 0) fail(`s3lookAt ${L} ${c.n} does not name the ${PLACES[L][c.place - 1]} place`);
          if (!printsNum(texts[4], st[3].result)) fail(`s3resultLine ${L} ${c.n} does not print the result`);
          if (!printsNum(texts[4], c.n)) fail(`s3resultLine ${L} ${c.n} does not print the number`);
        });
      });
      if (!stepDown) fail('STEP_CASES has no rounding-down case');
      if (!stepUp) fail('STEP_CASES has no rounding-up case');
      if (!stepMid) fail('STEP_CASES has no exactly-halfway case');
      if (!stepCarry) fail('STEP_CASES has no carrying case (target digit 9)');

      /* --- 範例 4：同一個數四種概數 --- */
      let allSameSeen = 0, differSeen = 0;
      data.MULTI_NUMS.forEach(n => {
        if (n > STEM_MAX) fail(`MULTI_NUMS ${n} above the lesson range`);
        if (n < PV[MAX_PLACE]) fail(`MULTI_NUMS ${n} would round to 0 at the ten-thousands place`);
        const res = [];
        for (let p = MIN_PLACE; p <= MAX_PLACE; p++) res.push(roundByLine(n, p));
        res.forEach(v => { if (v > VALUE_MAX) fail(`MULTI_NUMS ${n} rounds to ${v}, above the lesson range`); });
        const same = res.every(v => v === res[0]);
        if (same) allSameSeen++; else differSeen++;
        LANGS.forEach(L => {
          const note = I18N[L].s4note(n, same);
          if (/undefined|NaN/.test(note)) fail(`s4note ${L} ${n}: ${note}`);
          if (!printsNum(note, n)) fail(`s4note ${L} ${n} does not print the number`);
        });
      });
      if (!allSameSeen) fail('MULTI_NUMS has no number whose four answers are all the same (the run-of-9s case)');
      if (!differSeen) fail('MULTI_NUMS has no number whose four answers differ');

      /* --- 範例 5：先估再算 --- */
      let hasMinus = 0, hasWan = 0;
      data.EST_CASES.forEach(c => {
        if (c.op !== '+' && c.op !== '-') fail(`EST_CASES op "${c.op}" is neither + nor -`);
        if (c.place < 2 || c.place > MAX_PLACE) fail(`EST_CASES place ${c.place} out of 2~4`);
        if (c.a > STEM_MAX || c.b > STEM_MAX) fail(`EST_CASES ${c.a}/${c.b} above the lesson range`);
        const ra = roundByLine(c.a, c.place), rb = roundByLine(c.b, c.place);
        const est = (c.op === '+') ? ra + rb : ra - rb;
        const exact = (c.op === '+') ? c.a + c.b : c.a - c.b;
        if (est === exact) fail(`EST_CASES ${c.a} ${c.op} ${c.b}: the estimate equals the exact answer, so the contrast disappears`);
        /* 課程現在說「兩邊最多只差一個位值」。那句話是真的，因為每個數各自最多
           移動半個位值 —— 可是要有人盯著它，資料才不會偷偷違反它。 */
        if (Math.abs(exact - est) > PV[c.place])
          fail(`EST_CASES ${c.a} ${c.op} ${c.b}: the gap ${Math.abs(exact - est)} exceeds one place value ${PV[c.place]}, which contradicts the rule this lesson teaches`);
        if (est <= 0 || exact <= 0) fail(`EST_CASES ${c.a} ${c.op} ${c.b} is not positive`);
        if (est > VALUE_MAX || exact > STEM_MAX) fail(`EST_CASES ${c.a} ${c.op} ${c.b} above the lesson range`);
        if (c.op === '-') hasMinus++;
        if (c.place === MAX_PLACE) hasWan++;
        LANGS.forEach(L => {
          const d = I18N[L], pn = PLACES[L][c.place];
          const lines = [d.s5round(c.a, ra, c.b, rb, pn), d.s5est(ra, c.op, rb, est),
                         d.s5exact(c.a, c.op, c.b, exact), d.s5gap(Math.abs(exact - est), PV[c.place])];
          lines.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s5 text ${L} ${c.a}/${c.b}: ${t}`); });
          [c.a, ra, c.b, rb].forEach(v => {
            if (!printsNum(lines[0], v)) fail(`s5round ${L} ${c.a}/${c.b} does not print ${v}`);
          });
          if (lines[0].indexOf(pn) < 0) fail(`s5round ${L} ${c.a}/${c.b} does not name the ${pn} place`);
          if (!printsNum(lines[1], est)) fail(`s5est ${L} ${c.a}/${c.b} does not print the estimate ${est}`);
          if (!printsNum(lines[2], exact)) fail(`s5exact ${L} ${c.a}/${c.b} does not print the exact answer ${exact}`);
          if (!printsNum(lines[3], Math.abs(exact - est))) fail(`s5gap ${L} ${c.a}/${c.b} does not print the gap`);
          if (!printsNum(lines[3], PV[c.place]))
            fail(`s5gap ${L} ${c.a}/${c.b} does not print the one-place-value bound ${PV[c.place]}`);
        });
      });
      if (!hasMinus) fail('EST_CASES has no subtraction case');
      if (!hasWan) fail('EST_CASES never rounds to the ten-thousands place');

      /* --- 遊戲：四捨五入快車 --- */
      let gMid = 0, gCarry = 0, gWan = 0;
      data.ROUNDS.forEach((r, i) => {
        if (r.n > STEM_MAX) fail(`ROUND ${i+1}: n ${r.n} above the lesson range`);
        if (r.place < MIN_PLACE || r.place > MAX_PLACE) fail(`ROUND ${i+1}: place ${r.place} out of range`);
        if (r.n < PV[r.place]) fail(`ROUND ${i+1}: n is smaller than its target place`);
        if (r.ans < 0 || r.ans >= r.opts.length){ fail(`ROUND ${i+1}: ans index out of range`); return; }
        /* 先確認每個值是整數，否則 `'banana' > VALUE_MAX` 是 false，範圍檢查會靜靜放行。 */
        r.opts.forEach((v, k) => {
          if (!Number.isInteger(v)) fail(`ROUND ${i+1}: option ${k} is a non-integer option ${JSON.stringify(v)}`);
        });
        const want = roundByLine(r.n, r.place);
        if (r.opts[r.ans] !== want)
          fail(`ROUND ${i+1}: the marked option is ${r.opts[r.ans]}, recomputed ${want}`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate option values`);
        r.opts.forEach(v => {
          if (!Number.isInteger(v) || v < 10 || v > VALUE_MAX) fail(`ROUND ${i+1}: option ${v} outside 10~${VALUE_MAX}`);
        });
        if (isHalfway(r.n, r.place)) gMid++;
        if (nextDigitAt(r.n, r.place) >= 5 && digitAt(r.n, r.place) === 9) gCarry++;
        if (r.place === MAX_PLACE) gWan++;
        LANGS.forEach(L => {
          const d = I18N[L];
          const prompt = d.gPrompt(r.n, PLACES[L][r.place]);
          const hint2 = d.gHint2(PLACES[L][r.place - 1], nextDigitAt(r.n, r.place));
          [prompt, hint2].forEach(t => { if (/undefined|NaN/.test(t)) fail(`ROUND ${i+1} ${L}: ${t}`); });
          if (!printsNum(prompt, r.n)) fail(`ROUND ${i+1} ${L} prompt does not print ${r.n}`);
          if (prompt.indexOf(PLACES[L][r.place]) < 0) fail(`ROUND ${i+1} ${L} prompt does not name the ${PLACES[L][r.place]} place`);
          if (!printsNum(hint2, nextDigitAt(r.n, r.place))) fail(`ROUND ${i+1} ${L} hint 2 does not print the look digit`);
          if (hint2.indexOf(PLACES[L][r.place - 1]) < 0) fail(`ROUND ${i+1} ${L} hint 2 does not name the ${PLACES[L][r.place - 1]} place`);
        });
      });
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');
      if (!gMid) fail('ROUNDS has no exactly-halfway round');
      if (!gCarry) fail('ROUNDS has no carrying round (target digit 9)');
      if (!gWan) fail('ROUNDS never rounds to the ten-thousands place');

      /* --- 三層題庫：從題幹的數字與題幹說的目標位重算一次正解 --- */
      Object.keys(BANK_EXPECTED).forEach(bank => {
        const spec = BANK_EXPECTED[bank];
        LANGS.forEach(L => {
          const items = I18N[L][bank];
          if (!Array.isArray(items) || items.length !== spec.length){
            fail(bank + ' ' + L + ': ' + (items ? items.length : 'no') +
                 ' questions, the oracle describes ' + spec.length);
            return;
          }
          /* 索引迴圈：陣列裡挖一個洞的話 forEach 會跳過那一題，長度卻沒變
             —— 整題不見了還是綠的（codex 第三輪 #4）。 */
          for (let i = 0; i < spec.length; i++){
            if (!Object.prototype.hasOwnProperty.call(items, i)){
              fail(bank + '[' + i + '] ' + L + ': the question is missing (a hole in the array)');
              continue;
            }
            const q = items[i];
            const e = spec[i];
            const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
            /* 選項的形狀也要驗。在這之前只擋了小數點，所以 'banana'、''、'-1'
               這種東西可以大搖大擺留在選項裡（codex 第三輪 #2）。 */
            if (!Array.isArray(q.opts) || q.opts.length !== 4)
              fail(bank + '[' + i + '] ' + L + ': ' + (q.opts ? q.opts.length : 'no') + ' options, expected 4');
            else if (e.kind === 'lookPlace'){
              const allowed = PLACES[L].map((_, k) => placeOptText(k, L));
              q.opts.forEach(o => {
                if (allowed.indexOf(String(o)) < 0)
                  fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is not a place name');
              });
            } else {
              q.opts.forEach(o => {
                if (!/^\d+$/.test(String(o).trim()))
                  fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is not a whole number');
                else if (Number(o) < 1 || Number(o) > VALUE_MAX)
                  fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is outside 1~' + VALUE_MAX);
              });
            }
            const nums = (stem.match(/\d+/g) || []).map(Number);
            /* 位置式神諭擋不住「把題幹的 3847 改成 3848」—— 所以題幹的數字集合
               必須**剛好是**神諭列的那些，不是「有包含」（把舊數字當成
               「（例：3847）」補回去就會繞過去）。 */
            const sortNum = a => a.slice().sort((x, y) => x - y).join(',');
            if (sortNum(nums) !== sortNum(e.nums))
              fail(bank + '[' + i + '] ' + L + ': stem prints [' + nums.join(',') +
                   '], the oracle expects exactly [' + e.nums.join(',') + ']');
            /* 這一課只做整數 —— 題幹或選項出現小數點就是超出範圍。 */
            if (/\d\.\d/.test(stem) || q.opts.some(o => /\d\.\d/.test(String(o))))
              fail(bank + '[' + i + '] ' + L + ': there is a decimal point, but this lesson is whole numbers only');
            /* 目標位從題幹讀出來，不是寫死在這裡 ——
               把「四捨五入到百位」改成「到千位」，正解就必須跟著變。 */
            const place = placeFromStem(stem, L);
            if (place === null){
              fail(bank + '[' + i + '] ' + L + ': the stem does not say which place to round to (or says two)');
              return;
            }
            let want;
            if (e.kind === 'round'){
              want = String(roundByLine(nums[0], place));
            } else if (e.kind === 'lookPlace'){
              want = placeOptText(place - 1, L);
            } else if (e.kind === 'inRange'){
              const hit = q.opts.map(Number).filter(v => roundByLine(v, place) === nums[0]);
              if (hit.length !== 1){
                fail(bank + '[' + i + '] ' + L + ': ' + (hit.length ? 'more than one' : 'no') +
                     ' option rounds to ' + nums[0] + ' (' + hit.join(',') + ')');
                return;
              }
              want = String(hit[0]);
            } else if (e.kind === 'estimateSum'){
              want = String(roundByLine(nums[0], place) + roundByLine(nums[1], place));
            } else if (e.kind === 'rangeLow'){
              want = String(nums[0] - PV[place] / 2);
            } else if (e.kind === 'productThenRound'){
              want = String(roundByLine(nums[0] * nums[1], place));
            } else {
              fail(bank + '[' + i + '] ' + L + ': unknown oracle kind ' + e.kind);
              return;
            }
            /* 重算的結果還要和手寫的期望值對得上：兩份都錯才會漏，只有一份錯一定響。 */
            if (want !== e[L])
              fail(bank + '[' + i + '] ' + L + ': recomputed "' + want +
                   '" but the oracle table says "' + e[L] + '"');
            if (String(q.opts[q.ans]).trim() !== String(want))
              fail(bank + '[' + i + '] ' + L + ': marked answer is "' + q.opts[q.ans] +
                   '", recomputed "' + want + '"');
            /* 解釋也要印出正解，不然算式和答案可以各說各話。
               數字答案要比整個數字 token —— 子字串比對會把 400 認在 4000 裡面。
               ⚠️ 已知限制：這只驗「解釋裡有沒有出現正解」，不驗它出現在什麼位置。 */
            const whyPlain = String(q.why).replace(/<[^>]+>/g, ' ');
            const stated = /^-?\d+$/.test(want)
              ? (whyPlain.match(/\d+/g) || []).indexOf(want) >= 0
              : whyPlain.toLowerCase().indexOf(want.toLowerCase()) >= 0;
            if (!stated)
              fail(bank + '[' + i + '] ' + L + ': the explanation never states the answer "' + want + '"');
          }
        });
      });

      /* --- 速查卡與家長頁：規則的措辭 ---
         三頁教的是同一條規則，只驗上課頁等於沒在盯另外兩頁。
         資料夾用 `process.argv[2]` 推出來，改壞測試才會讀到它自己複製出來的那一份
         —— 用 __dirname 會讀到真的 repo，那條斷言就永遠是綠的。 */
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
          /* HTML 註解裡的文字畫面上看不到，不可以拿來充數。 */
          html = html.replace(/<!--[\s\S]*?-->/g, ' ');
          rule.must.forEach(entry => {
            const t = entry[0], need = entry[1];
            const got = html.split(t).length - 1;
            if (got < need)
              fail(page + ' no longer says "' + t + '" the required number of times (' + got + ' of ' + need + ')');
          });
          rule.forbid.forEach(t => {
            if (html.indexOf(t) >= 0)
              fail(page + ' says "' + t + '", which contradicts the rule this lesson teaches');
          });
          if (rule.orderedZh){
            /* 只在**那張表自己**裡面找順序。整頁去找的話，表格外面任何一個
               `>萬位<` 都可以充數，順序檢查就名存實亡（codex 第三輪 #9）。 */
            const tbl = html.match(/<table class="places">[\s\S]*?<\/table>/);
            if (!tbl){
              fail(page + ' has no <table class="places"> to check the place order in');
              return;
            }
            const scope = tbl[0];
            const at = rule.orderedZh.map(w => scope.indexOf('>' + w + '<'));
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
    }
  }
};
