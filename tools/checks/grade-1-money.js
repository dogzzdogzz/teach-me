/* grade-1/math/money 的檢查設定（錢幣：認識 1／5／10／50 元、合起來多少、換錢、付錢、找錢）。

   這一課的特色是**題目畫在圖上**：sumTwoCoins／sumThreeCoins／countTotalHandful 的題幹沒有數字，
   數字全在 stemPic 的硬幣圖裡（exchangeCount 題幹印了 1、big、small，圖畫的是 big）；identifyCoin／comparePiles／payExact 的
   **選項本身就是一組硬幣圖**（optPics），按鈕上沒有字，只有 aria-label 是數字。
   所以這裡最重要的一條不是算術，是 renderCheck：**圖上畫的硬幣加起來，必須等於那個選項宣稱的數**。
   資料層全對、選項全對，但 optPics 和 opts 對錯位的話，孩子按「正確」的圖會被判錯 —— 只有
   把「圖」和「字」一起看才看得到。

   選項數：identifyCoin／payExact 是 4 張圖，comparePiles／numbersCompare 是 2 選項，
   其餘 4 選項（要逐一列出，不可以寫成 [2,4]）。

   ⚠️ 兩份 coinSVG 不一樣：index.html（52／60／68／78，內圈 r−6）與 review.html（44／50／56／64，
   內圈 r−5），要各自驗。review 那一份從**磁碟上的** review.html 切出來驗 —— verify_lesson_data
   只拿得到 index 的原始碼，所以 breaktest 對 review 的改壞**看不到**這一條（它改的是暫存目錄裡的
   副本）。這一條守得到的是「現在磁碟上那一份」，證明不了「改壞會響」。 */

const fs = require('fs');
const path = require('path');
const { gameShuffleProblems } = require('./lib/gameshuffle.js');
const { canvasProblems } = require('./lib/canvas.js');

const DENOMS = [1, 5, 10, 50];
const EXPAIRS = [[5,1],[10,1],[10,5],[50,10],[50,5],[50,1]];
const PAID_CHOICES = [10, 20, 50, 60, 100];

function sum(arr){ return arr.reduce((a, b) => a + b, 0); }
function allDenoms(arr){ return Array.isArray(arr) && arr.length > 0 && arr.every(v => DENOMS.indexOf(v) >= 0); }

/* 從 index.html 原始碼把一個 `var NAME = [...];` 或 `{...};` 切出來求值。
   非貪婪配到第一個 `];`／`};` —— 這一課的表格裡面的陣列都是 `],` 結尾，不會提早截斷；
   切出來之後一定要再驗長度／鍵，切錯了要在這裡就響，不要靜靜給一個空表。 */
function extractVar(src, name){
  const m = src.match(new RegExp('var ' + name + ' = ([\\[{][\\s\\S]*?[\\]}]);'));
  if (!m) throw new Error('cannot find var ' + name + ' in source');
  return new Function('return ' + m[1] + ';')();
}

/* 硬幣圖自己的幾何：canvas.js 只驗「畫在畫布裡」，驗不到「數字在內圈裡」。
   這裡用粗略的字寬（粗體數字約 0.65 em）與字高（0.8 em 上、0.25 em 下）估一次，
   要求數字的**寬不超過內圈直徑、上下不超出內圈**（兩個方向各驗，不是嚴格的「整個字框在圓內」——
   字框的角落在 36px 的小硬幣上會微微越過圓，但數字的筆畫不在角落）。
   ⚠️ 這是估算不是量測：真的字寬看字型；它抓得到「字級寫成 0.9 倍」那種明顯的錯，抓不到差 1~2 px 的貼邊。 */
function coinTextProblems(svg, label){
  const out = [];
  const size = Number((svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /) || [])[1]);
  const circles = [...svg.matchAll(/<circle[^>]*\br="([\d.]+)"/g)].map(m => Number(m[1]));
  const t = svg.match(/<text x="([\d.]+)" y="([\d.]+)" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/);
  if (!size || circles.length < 2 || !t){ out.push(label + ': cannot read coin geometry (size/inner ring/text)'); return out; }
  const inner = Math.min.apply(null, circles);           /* 內圈半徑 */
  const cx = size / 2, cy = size / 2;
  const x = Number(t[1]), y = Number(t[2]), fs = Number(t[3]), body = t[4];
  const halfW = body.length * fs * 0.65 / 2;
  const top = y - fs * 0.8, bottom = y + fs * 0.25;
  if (Math.abs(x - cx) > 0.5) out.push(label + ': the number is not centred (x=' + x + ', cx=' + cx + ')');
  if (halfW > inner - 1) out.push(label + ': the number "' + body + '" (~' + Math.round(halfW * 2) + 'px wide) does not fit inside the inner ring (diameter ' + Math.round(inner * 2) + ')');
  if (top < cy - inner || bottom > cy + inner) out.push(label + ': the number spills above/below the inner ring');
  if (!/^(1|5|10|50)$/.test(body)) out.push(label + ': the coin shows "' + body + '", which is not a denomination');
  return out;
}

const RANGE = {
  /* 錢數：一年級的數在 100 以內，這一課的硬幣最多也就 50 元 —— 選項超過 100 就是這一課不該出的數。
     下限是 1（錢數是正的；「只數了一個硬幣」的誘答 1 是合法的），不要把下限寫成硬幣數。 */
  sumTwoCoins:[1,100], sumThreeCoins:[1,100], comparePiles:[1,100], payExact:[1,100],
  missingChange:[1,100], countTotalHandful:[1,100],
  exchangeCount:[1,50], numbersCompare:[10,99], bondsMakeTen:[0,10], addsubStory:[0,20]
};

module.exports = {
  breaks: [
    /* ---- index.html ---- */
    /* 小遊戲 startRound() 兩個分支（total／pay）各洗一次牌；拿掉 total 那一次，
       數量對不上就要響（正解會固定在 opts 的第一顆）。 */
    { file:'index', expect:'shuffled option render',
      find:'      (gOrder = shuffle(totalItems)).forEach(function(o){',
      replace:'      (gOrder = totalItems).forEach(function(o){' },
    { file:'index', expect:'ROUNDS[0]',
      find:"    { kind:'total', pile:[10,5,1,1], opts:[17,16,15,20], ans:0 },",
      replace:"    { kind:'total', pile:[10,5,1,1], opts:[17,16,15,20], ans:1 }," },
    { file:'index', expect:'ROUNDS[1]',
      find:"    { kind:'pay', price:12, groups:[[10,1,1],[10,5],[5,5,1],[10,1,1,1]], ans:0 },",
      replace:"    { kind:'pay', price:12, groups:[[10,1,1],[10,1,1],[5,5,1],[10,1,1,1]], ans:0 }," },
    { file:'index', expect:'BREAK[10]',
      find:'  var BREAK = { 50:[10,10,10,10,10], 10:[5,5], 5:[1,1,1,1,1] };',
      replace:'  var BREAK = { 50:[10,10,10,10,10], 10:[5,4], 5:[1,1,1,1,1] };' },
    { file:'index', expect:'PRICES[2]',
      find:'  var PRICES = [8, 15, 23];',
      replace:'  var PRICES = [8, 15, 200];' },
    /* 靜態題：圖上 10+10+5 = 25，把正解標到「20」—— 只看資料看不出來，要把圖加起來和選項比。 */
    { file:'index', expect:'picture',
      find:"        { stemPic: QPIC.q3, opts:['25','20','30','15'], ans:0,\n          stem:'這些錢合起來是多少元？',",
      replace:"        { stemPic: QPIC.q3, opts:['25','20','30','15'], ans:1,\n          stem:'這些錢合起來是多少元？'," },
    /* 硬幣畫出畫布：半徑寫成 size/2 + 2，四邊都會超出 viewBox。 */
    { file:'index', expect:'coinSVG',
      find:'    var r = size / 2 - 2;\n    var fs = value === 50 ? size * 0.34 : size * 0.38;\n    return \'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \' + size + \' \' + size + \'" width="\' + size + \'" height="\' + size + \'" aria-hidden="true">\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + r + \'" fill="\' + color + \'" stroke="#2B2A33" stroke-width="2"></circle>\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + (r - 6) + \'"',
      replace:'    var r = size / 2 + 2;\n    var fs = value === 50 ? size * 0.34 : size * 0.38;\n    return \'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \' + size + \' \' + size + \'" width="\' + size + \'" height="\' + size + \'" aria-hidden="true">\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + r + \'" fill="\' + color + \'" stroke="#2B2A33" stroke-width="2"></circle>\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + (r - 6) + \'"' },
    /* 數字寫成 0.9 倍字級：塞不進內圈。 */
    { file:'index', expect:'does not fit inside the inner ring',
      find:'    var fs = value === 50 ? size * 0.34 : size * 0.38;\n    return \'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \' + size + \' \' + size + \'" width="\' + size + \'" height="\' + size + \'" aria-hidden="true">\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + r + \'" fill="\' + color + \'" stroke="#2B2A33" stroke-width="2"></circle>\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + (r - 6) + \'"',
      replace:'    var fs = value === 50 ? size * 0.9 : size * 0.9;\n    return \'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 \' + size + \' \' + size + \'" width="\' + size + \'" height="\' + size + \'" aria-hidden="true">\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + r + \'" fill="\' + color + \'" stroke="#2B2A33" stroke-width="2"></circle>\' +\n      \'<circle cx="\' + size / 2 + \'" cy="\' + size / 2 + \'" r="\' + (r - 6) + \'"' },

    /* ---- review.html ---- */
    /* makeWrongs 會避開題幹數字（avoid）；掏空之後 ±1 保底又會撞回去（addsubStory 的 s − 1 在 b = 1 時就是 a）。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    /* pickCoins 會重抽到總額 ≤ 100；把門檻拿掉，3 個 50 元（150）就會端出來，RANGE 與不變條件都要響。 */
    { file:'review', expect:'exceeds 100',
      find:'      if (sum(coins) <= MAX_OPT) return coins;',
      replace:'      return n === 3 ? [50, 50, 50] : coins;' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'s != a + b',
      find:'        var s = a + b;\n        var m = mixOpts(s, [a, b, s - 5, s + 5]);',
      replace:'        var s = a + b + 1;\n        var m = mixOpts(s, [a, b, s - 5, s + 5]);' },
    /* 兩堆一樣多：原本抽到相同就補一個 1 元；改成強迫兩堆一樣，「哪一堆多」就沒有答案。 */
    { file:'review', expect:'sa equals sb',
      find:'        if (sa === sb){ pileB = sa === 1 ? [5] : [1]; sb = sum(pileB); }',
      replace:'        if (sa !== sb){ pileB = pileA.slice(); sb = sa; }' },
    /* payExact 四組的總額必須兩兩不同；拿掉去重，兩組一樣多就會出現「兩個正好」。 */
    { file:'review', expect:'duplicate option value',
      find:'          if (!sums[String(s)]){ sums[String(s)] = true; groups.push(g); }',
      replace:'          groups.push(g);' },
    { file:'review', expect:'count * small != big',
      find:'        var count = big / small;',
      replace:'        var count = big / small + 1;' },
    { file:'review', expect:'change != paid - price',
      find:'        var change = paid - price;',
      replace:'        var change = paid - price - 1;' },
    /* 圖與字對不上：題幹畫 a、a 兩個硬幣，選項卻是 a + b —— 資料全對、算術全對，只有 renderCheck 看得到。 */
    { file:'review', expect:'stemPic',
      find:"          stemPic: [d.a, d.b],\n          stem: lang === 'zh' ? '這些錢合起來是多少元？' : 'How much is this altogether?',",
      replace:"          stemPic: [d.a, d.a],\n          stem: lang === 'zh' ? '這些錢合起來是多少元？' : 'How much is this altogether?'," },
    /* 選項圖與 aria-label 對錯位：畫 5 元的圖卻標成 1。 */
    { file:'review', expect:'optPics',
      find:'          optPics: d.order.map(function(v){ return { values:[v] }; }),',
      replace:'          optPics: d.order.map(function(v){ return { values:[v === 1 ? 5 : v] }; }),' }
  ],

  sim: {
    optCount: { identifyCoin: 4, comparePiles: 2, payExact: 4, numbersCompare: 2, '*': 4 },
    /* GENS 用到更前面宣告的 DENOMS 與 sum()（硬幣圖那一段，純字串、不碰 DOM）。 */
    blockStart: '  /* ---------- 硬幣圖（語言無關） ---------- */',
    INVARIANTS: {
      identifyCoin: d => {
        if (DENOMS.indexOf(d.target) < 0) return 'target ' + d.target + ' is not a denomination';
        if (d.order.slice().sort((a, b) => a - b).join(',') !== DENOMS.join(',')) return 'order is not a permutation of the four denominations';
        if (d.order[d.ans] !== d.target) return 'ans does not point at target';
      },
      sumTwoCoins: d => {
        if (!allDenoms([d.a, d.b])) return 'coin not a denomination';
        if (d.s !== d.a + d.b) return 's != a + b';
      },
      sumThreeCoins: d => {
        if (!allDenoms([d.a, d.b, d.c])) return 'coin not a denomination';
        if (d.s !== d.a + d.b + d.c) return 's != a + b + c';
        if (d.s > 100) return 'total ' + d.s + ' exceeds 100 (grade-1 numbers stay within 100)';
      },
      comparePiles: d => {
        if (!allDenoms(d.pileA) || !allDenoms(d.pileB)) return 'pile has a non-denomination coin';
        if (d.pileA.length > 4 || d.pileB.length > 4) return 'pile has more than 4 coins';
        if (sum(d.pileA) !== d.sa || sum(d.pileB) !== d.sb) return 'sa/sb != sum of pile';
        if (d.sa > 100 || d.sb > 100) return 'a pile exceeds 100';
        if (d.sa === d.sb) return 'sa equals sb — no valid "worth more" answer';
        if (d.ans !== (d.sa > d.sb ? 0 : 1)) return 'ans does not point at the bigger pile';
      },
      exchangeCount: d => {
        if (!EXPAIRS.some(p => p[0] === d.big && p[1] === d.small)) return 'big/small is not one of the taught exchange pairs';
        if (d.count * d.small !== d.big) return 'count * small != big';
      },
      payExact: d => {
        if (d.groups.length !== 4) return 'payExact needs 4 groups, got ' + d.groups.length;
        if (!d.groups.every(g => allDenoms(g) && g.length >= 2 && g.length <= 3)) return 'a group is not 2~3 denomination coins';
        const sums = d.groups.map(sum);
        if (sums.some(s => s > 100)) return 'a payExact group exceeds 100';
        if (new Set(sums).size !== 4) return 'payExact groups sums not distinct: ' + sums.join(',');
        const hits = sums.filter(s => s === d.price).length;
        if (hits !== 1) return hits + ' groups sum to price ' + d.price + ' (need exactly 1)';
        if (sums[d.ans] !== d.price) return 'ans does not point at the group that sums to price';
      },
      missingChange: d => {
        if (PAID_CHOICES.indexOf(d.paid) < 0) return 'paid ' + d.paid + ' is not one of the taught amounts';
        if (!(d.price >= 1 && d.price <= d.paid - 1)) return 'price outside 1 ~ paid-1';
        if (d.change !== d.paid - d.price) return 'change != paid - price';
      },
      countTotalHandful: d => {
        if (!allDenoms(d.coins)) return 'coin not a denomination';
        if (d.coins.length < 2 || d.coins.length > 4) return 'handful is not 2~4 coins';
        if (sum(d.coins) !== d.s) return 's != sum of coins';
        if (d.s > 100) return 'handful total ' + d.s + ' exceeds 100';
      },
      numbersCompare: d => {
        if (!(d.a >= 10 && d.a <= 99 && d.b >= 10 && d.b <= 99)) return 'a/b outside 10~99';
        if (d.a === d.b) return 'a equals b';
        if (d.ans !== (d.a > d.b ? 0 : 1)) return 'ans does not point at the bigger number';
      },
      bondsMakeTen: d => {
        if (!(d.n >= 1 && d.n <= 9)) return 'n outside 1~9';
        if (d.partner !== 10 - d.n) return 'partner != 10 - n';
      },
      addsubStory: d => {
        if (!(d.a >= 1 && d.a <= 10 && d.b >= 1)) return 'a outside 1~10 or b < 1';
        if (d.a + d.b > 20) return 'a + b exceeds 20';
        if (d.s !== d.a + d.b) return 's != a + b';
      }
    },
    /* 正解的第二套實作：只用題幹（或題幹的圖）上真的印出來的參數重算。
       每一行上面的註解是「孩子看到的題目」。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「哪一個是 target 元？」—— 四張硬幣圖，aria-label 是面額 */
        case 'identifyCoin':      return String(d.target);
        /* 圖上兩個硬幣 a、b，「合起來是多少元？」 */
        case 'sumTwoCoins':       return String(d.a + d.b);
        /* 圖上三個硬幣 */
        case 'sumThreeCoins':     return String(d.a + d.b + d.c);
        /* 兩堆硬幣圖，「哪一堆比較多？」—— 選項的 aria-label 是各堆總額，正解是大的那個 */
        case 'comparePiles':      return String(Math.max(sum(d.pileA), sum(d.pileB)));
        /* 「1 個 big 元換成 small 元，可以換幾個？」 */
        case 'exchangeCount':     return String(d.big / d.small);
        /* 「要付 price 元，哪一組正好？」—— 選項的 aria-label 是各組總額，正解就是 price */
        case 'payExact':          return String(d.price);
        /* 「付 paid 元買 price 元的東西，要找多少錢？」 */
        case 'missingChange':     return String(d.paid - d.price);
        /* 圖上一把硬幣，「合起來是多少元？」 */
        case 'countTotalHandful': return String(sum(d.coins));
        /* 「哪個數字比較大？」 */
        case 'numbersCompare':    return String(Math.max(d.a, d.b));
        /* 「n 和幾湊成 10？」 */
        case 'bondsMakeTen':      return String(10 - d.n);
        /* 「小明有 a 顆糖，又得到 b 顆，一共幾顆？」 */
        case 'addsubStory':       return String(d.a + d.b);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      if (genId === 'identifyCoin') return DENOMS.indexOf(v) < 0 ? ('option ' + s + ' is not a denomination') : null;
      const [lo, hi] = RANGE[genId] || [0, 100];
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi + ' for this generator';
      return null;
    },
    /* 題幹本來就印出來、刻意拿來當誘答的那一個數字：
       exchangeCount 的 big（把面額當成個數）、missingChange 的 price（把價錢當成找的錢）、
       bondsMakeTen 的 n（把已知的數抄回來）。其餘題幹數字 review.html 的 makeWrongs 用 avoid 擋掉，
       這裡沒有放行 → 再出現就是缺陷。 */
    stemEchoOk: {
      /* exchangeCount 另放行 1：「1 個 big 換成 small」→ 以為一個換一個（上課頁 qsAdv[0] 就放了 1 當誘答）。 */
      exchangeCount: (d, opt) => Number(opt) === d.big || Number(opt) === 1,
      missingChange: (d, opt) => Number(opt) === d.price,
      bondsMakeTen: (d, opt) => Number(opt) === d.n,
      /* |a − b|（該加卻減）本身不是題幹數字，a = 2b 時剛好等於 b —— 仍是同一個迷思的結果，只放行這一個值。 */
      addsubStory: (d, opt) => Number(opt) === Math.abs(d.a - d.b)
    },
    /* 圖和字要對得上 —— 這一課的題目就是圖。 */
    renderCheck: function(d, q, lang, genId){
      const pics = q.optPics, stemPic = q.stemPic;
      if (pics){
        if (pics.length !== q.opts.length) return 'optPics has ' + pics.length + ' pictures for ' + q.opts.length + ' options';
        for (let i = 0; i < pics.length; i++){
          const vals = pics[i] && pics[i].values;
          if (!allDenoms(vals)) return 'optPics[' + i + '] is not a list of denomination coins';
          if (genId === 'identifyCoin'){
            if (vals.length !== 1 || vals[0] !== Number(q.opts[i])) return 'optPics[' + i + '] shows ' + vals.join('+') + ' but the option is labelled ' + q.opts[i];
          } else if (sum(vals) !== Number(q.opts[i])){
            return 'optPics[' + i + '] shows ' + vals.join('+') + ' = ' + sum(vals) + ' but the option is labelled ' + q.opts[i];
          }
        }
      } else if (genId === 'identifyCoin' || genId === 'comparePiles' || genId === 'payExact'){
        return genId + ' has no optPics — the options are supposed to be coin pictures';
      }
      if (stemPic){
        if (!allDenoms(stemPic)) return 'stemPic is not a list of denomination coins';
        if (genId === 'sumTwoCoins' || genId === 'sumThreeCoins' || genId === 'countTotalHandful'){
          if (String(sum(stemPic)) !== q.opts[q.ans]) return 'stemPic shows ' + stemPic.join('+') + ' = ' + sum(stemPic) + ' but the marked answer is ' + q.opts[q.ans];
          if (/\d/.test(q.stem.replace(/<[^>]+>/g, ''))) return 'a picture question prints digits in its stem: ' + q.stem;
        } else if (genId === 'exchangeCount'){
          /* 讀題幹印出來的兩個面額，不讀 d.big／d.small：圖要畫大的那個，正解要是 big ÷ small */
          const text = q.stem.replace(/<[^>]+>/g, '');
          const mm = text.match(/1 個 (\d+) 元換成 (\d+) 元|one \$(\d+) coin for \$(\d+) coins/);
          if (!mm) return 'exchangeCount stem does not read as "exchange one BIG for SMALL": ' + text;
          const big = Number(mm[1] || mm[3]), small = Number(mm[2] || mm[4]);
          if (stemPic.length !== 1 || stemPic[0] !== big) return 'exchangeCount stemPic ' + stemPic.join('+') + ' is not the big coin ' + big + ' printed in the stem';
          if (String(big / small) !== q.opts[q.ans]) return 'exchangeCount marked answer ' + q.opts[q.ans] + ' is not ' + big + ' ÷ ' + small;
        }
      } else if (genId === 'sumTwoCoins' || genId === 'sumThreeCoins' || genId === 'countTotalHandful' || genId === 'exchangeCount'){
        return genId + ' has no stemPic — the coins are the question';
      }
      /* 文字題：從**印出來的題幹**讀數字再算一次，不讀 d.*（expectedCorrect 讀的是 d，這裡補上畫面那一側）。 */
      const text = q.stem.replace(/<[^>]+>/g, '');
      const ans = q.opts[q.ans];
      let mm;
      if (genId === 'missingChange'){
        mm = text.match(/付 (\d+) 元買 (\d+) 元|You pay \$(\d+) for something that costs \$(\d+)/);
        if (!mm) return 'missingChange stem does not read as "pay PAID for PRICE": ' + text;
        const paid = Number(mm[1] || mm[3]), price = Number(mm[2] || mm[4]);
        if (String(paid - price) !== ans) return 'stem says pay ' + paid + ' for ' + price + ' but the marked answer is ' + ans;
      } else if (genId === 'bondsMakeTen'){
        mm = text.match(/^(\d+) 和幾湊成 10|pairs with (\d+) to make 10/);
        if (!mm) return 'bondsMakeTen stem does not read as "N makes 10": ' + text;
        if (String(10 - Number(mm[1] || mm[2])) !== ans) return 'stem asks the partner of ' + (mm[1] || mm[2]) + ' but the marked answer is ' + ans;
      } else if (genId === 'addsubStory'){
        mm = text.match(/有 (\d+) 顆糖，又得到 (\d+) 顆|has (\d+) candies and gets (\d+) more/);
        if (!mm) return 'addsubStory stem does not read as "A candies and B more": ' + text;
        if (String(Number(mm[1] || mm[3]) + Number(mm[2] || mm[4])) !== ans) return 'stem says ' + (mm[1] || mm[3]) + ' + ' + (mm[2] || mm[4]) + ' but the marked answer is ' + ans;
      } else if (genId === 'payExact'){
        mm = text.match(/要付 (\d+) 元|To pay \$(\d+)/);
        if (!mm) return 'payExact stem does not read as "pay N": ' + text;
        if (String(Number(mm[1] || mm[2])) !== ans) return 'stem asks to pay ' + (mm[1] || mm[2]) + ' but the marked group is labelled ' + ans;
      } else if (genId === 'numbersCompare'){
        const nums = q.opts.map(Number);
        if (Number(ans) !== Math.max.apply(null, nums)) return 'the marked option ' + ans + ' is not the bigger of ' + q.opts.join('/');
      } else if (genId === 'identifyCoin'){
        mm = text.match(/哪一個是 (\d+) 元|Which one is \$(\d+)/);
        if (!mm) return 'identifyCoin stem does not name a denomination: ' + text;
        if (String(Number(mm[1] || mm[2])) !== ans) return 'stem asks for the ' + (mm[1] || mm[2]) + ' coin but the marked option is ' + ans;
      }
      return null;
    }
  },

  data: {
    /* qs 混 2 選項（哪一堆多）與 4 選項；qsAdv 4；qsBoost 2（哪一堆多／對不對）。 */
    optCount: { qs: [2, 4], qsAdv: 4, qsBoost: 2 },
    dataStart: '  /* ---------- 語言無關：硬幣圖 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{coinSVG, coinGroupHTML, groupSum, QPIC, DENOMS, COIN_SIZE}',
    optionValueMax: 100,
    check: function(data, I18N, fail, src){
      /* --- 小遊戲：startRound() 的 total／pay 兩個分支各洗一次牌，畫出來的按鈕不可以固定 --- */
      gameShuffleProblems(src, 2).forEach(fail);

      /* --- 硬幣圖（index 那一份）：畫在畫布裡、數字在內圈裡；上課頁與小遊戲用的尺寸各驗一次 --- */
      if (data.DENOMS.join(',') !== DENOMS.join(',')) fail('DENOMS is not [1,5,10,50]');
      DENOMS.forEach(v => {
        if (!(data.COIN_SIZE[v] > 0)) fail('COIN_SIZE[' + v + '] missing');
        [undefined, 36].forEach(sz => {
          const svg = data.coinSVG(v, sz);
          const label = 'coinSVG(' + v + (sz ? ',' + sz : '') + ')';
          /* 硬幣是刻意畫滿整個畫布的：外圈 r = size/2 − 2、描邊 2，邊緣剛好落在 size − 1，
             留 1px；canvas.js 預設要 2px 的餘裕，對這種「填滿」的圖要放成 1。 */
          canvasProblems(svg, { pad: 1 }).forEach(p => fail(label + ': ' + p));
          coinTextProblems(svg, label).forEach(fail);
        });
      });
      /* review.html 那一份 coinSVG（尺寸表不同）：從磁碟切出來驗。見檔案開頭的限制說明。 */
      try {
        const rsrc = fs.readFileSync(path.join(__dirname, '..', '..', 'grade-1', 'math', 'money', 'review.html'), 'utf8');
        const a = rsrc.indexOf('/* ---------- 硬幣圖（語言無關） ---------- */');
        const b = rsrc.indexOf('/* ---------- 靜態文字 ---------- */');
        if (a < 0 || b < 0 || a > b) fail('cannot slice the coinSVG block out of review.html');
        else {
          const R = new Function(rsrc.slice(a, b) + '\n; return {coinSVG, COIN_SIZE, DENOMS};')();
          if (R.DENOMS.join(',') !== DENOMS.join(',')) fail('review.html DENOMS is not [1,5,10,50]');
          DENOMS.forEach(v => [undefined, 34].forEach(sz => {
            const svg = R.coinSVG(v, sz);
            const label = 'review coinSVG(' + v + (sz ? ',' + sz : '') + ')';
            canvasProblems(svg, { pad: 1 }).forEach(p => fail(label + ': ' + p));
            coinTextProblems(svg, label).forEach(fail);
          }));
        }
      } catch (e){ fail('review.html coinSVG could not be checked: ' + e.message); }

      /* --- 圖組定義：每一組都是面額 --- */
      Object.keys(data.QPIC).forEach(k => {
        const v = data.QPIC[k];
        if (Array.isArray(v)){ if (!allDenoms(v)) fail('QPIC.' + k + ' has a non-denomination coin'); }
        else if (DENOMS.indexOf(v) < 0) fail('QPIC.' + k + ' = ' + v + ' is not a denomination');
      });

      /* --- 靜態題：圖和字要對得上 ---
         每一種帶圖的題型各有一條「圖 → 答案」的規則（合起來＝總和；找錢＝付的減價錢；
         換錢＝big ÷ small；原本有＝剩下的＋花掉的；付了找錢＝付的減價錢），對不上任何一條就是沒驗到；
         選項是圖的題：每張圖的總額要等於它的 aria-label，哪一個是 N 元／哪一堆多／要付 N 元各自再對一次。 */
      ['zh', 'en'].forEach(L => {
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const tag = bank + '[' + i + '] ' + L;
            const stem = String(q.stem).replace(/<[^>]+>/g, '');
            if (q.stemPic){
              if (!allDenoms(q.stemPic)) fail(tag + ': stemPic has a non-denomination coin');
              const pic = sum(q.stemPic), ansN = Number(q.opts[q.ans]);
              let rule = null, m;
              /* 每一種帶圖的題型都要有一條「圖 → 答案」的規則；對不上任何一條就是沒驗到，要響 */
              if (/合起來|altogether/.test(stem)){ rule = '合起來'; if (pic !== ansN) fail(tag + ': picture sums to ' + pic + ' but the marked answer is ' + ansN); }
              else if ((m = stem.match(/付 (\d+) 元買 (\d+) 元|You pay \$(\d+) for something that costs \$(\d+)/))){
                rule = '找錢'; const paid = Number(m[1] || m[3]), price = Number(m[2] || m[4]);
                if (pic !== paid) fail(tag + ': the picture shows ' + pic + ' but the stem says you paid ' + paid);
                if (ansN !== paid - price) fail(tag + ': change should be ' + (paid - price) + ', marked answer is ' + ansN);
              }
              else if ((m = stem.match(/1 個 (\d+) 元換成 (\d+) 元|one \$(\d+) coin for \$(\d+) coins/))){
                rule = '換錢'; const big = Number(m[1] || m[3]), small = Number(m[2] || m[4]);
                if (q.stemPic.length !== 1 || pic !== big) fail(tag + ': the picture should be one ' + big + ' coin, got ' + q.stemPic.join('+'));
                if (ansN !== big / small) fail(tag + ': ' + big + ' ÷ ' + small + ' = ' + (big / small) + ', marked answer is ' + ansN);
              }
              else if ((m = stem.match(/用 (\d+) 元買.*原本有多少錢|spent \$(\d+) on .*start with/))){
                rule = '原本有'; const spent = Number(m[1] || m[2]);
                if (ansN !== pic + spent) fail(tag + ': leftover ' + pic + ' + spent ' + spent + ' = ' + (pic + spent) + ', marked answer is ' + ansN);
              }
              else if ((m = stem.match(/(\d+) 元，.*付了.*要找多少錢|costs \$(\d+)\. .*paid with .*change/))){
                rule = '付了找錢'; const price = Number(m[1] || m[2]);
                if (ansN !== pic - price) fail(tag + ': paid ' + pic + ' − ' + price + ' = ' + (pic - price) + ', marked answer is ' + ansN);
              }
              if (!rule) fail(tag + ': picture question matches no picture→answer rule (unchecked, not passing): ' + stem);
            }
            if (q.optPics){
              if (q.optPics.length !== q.opts.length) fail(tag + ': optPics/opts length mismatch');
              q.optPics.forEach((p, k) => {
                if (!allDenoms(p.values)) fail(tag + ': optPics[' + k + '] has a non-denomination coin');
                if (String(sum(p.values)) !== q.opts[k]) fail(tag + ': optPics[' + k + '] picture sums to ' + sum(p.values) + ' but the option says ' + q.opts[k]);
              });
              const m = stem.match(/哪一個是 (\d+) 元|Which one is (?:the )?\$(\d+)/);
              if (m){
                const want = Number(m[1] || m[2]);
                const pic = q.optPics[q.ans].values;
                if (pic.length !== 1 || pic[0] !== want) fail(tag + ': "which coin is ' + want + '" marks a picture of ' + pic.join('+'));
                /* 四個選項都要是「一個硬幣」，不是湊成同樣金額的一堆 */
                q.optPics.forEach((p, k) => { if (p.values.length !== 1) fail(tag + ': optPics[' + k + '] is ' + p.values.length + ' coins, but this question shows single coins'); });
              }
              if (/哪一堆錢比較多|Which pile is worth more/.test(stem)){
                const sums = q.optPics.map(p => sum(p.values));
                if (new Set(sums).size !== sums.length) fail(tag + ': two piles are worth the same');
                if (sums[q.ans] !== Math.max.apply(null, sums)) fail(tag + ': the marked pile is not the biggest');
              }
              const pm = stem.match(/要付 (\d+) 元|To pay \$(\d+)/);
              if (pm){
                const price = Number(pm[1] || pm[2]);
                const sums = q.optPics.map(p => sum(p.values));
                if (sums.filter(s => s === price).length !== 1) fail(tag + ': not exactly one group pays ' + price);
                if (sums[q.ans] !== price) fail(tag + ': the marked group does not pay ' + price);
              }
            }
          });
        });
      });

      /* --- 換錢表：拆開的每一組要真的等於那個面額；合併的步數 × 面額要等於目標 --- */
      const BREAK = extractVar(src, 'BREAK');
      const MERGE_STEP = extractVar(src, 'MERGE_STEP');
      const MERGE_TARGET = extractVar(src, 'MERGE_TARGET');
      if (Object.keys(BREAK).sort().join() !== '10,5,50') fail('BREAK should list exactly 5, 10, 50 (the coins that can be broken), got ' + Object.keys(BREAK).join(','));
      Object.keys(BREAK).forEach(k => {
        if (!allDenoms(BREAK[k])) fail('BREAK[' + k + '] has a non-denomination coin');
        if (sum(BREAK[k]) !== Number(k)) fail('BREAK[' + k + '] sums to ' + sum(BREAK[k]) + ', not ' + k);
        if (new Set(BREAK[k]).size !== 1) fail('BREAK[' + k + '] mixes denominations');
      });
      if (Object.keys(MERGE_STEP).sort().join() !== '1,10,5' || Object.keys(MERGE_TARGET).sort().join() !== '1,10,5')
        fail('MERGE tables should list exactly 1, 5, 10 (the coins that can be merged up)');
      Object.keys(MERGE_STEP).forEach(k => {
        if (Number(k) * MERGE_STEP[k] !== MERGE_TARGET[k]) fail('MERGE: ' + MERGE_STEP[k] + ' × ' + k + ' != ' + MERGE_TARGET[k]);
        if (DENOMS.indexOf(MERGE_TARGET[k]) < 0) fail('MERGE_TARGET[' + k + '] is not a denomination');
      });

      /* --- 付錢：每個價錢都要能用托盤上的硬幣正好付出來（有限個硬幣的子集和） --- */
      const PRICES = extractVar(src, 'PRICES');
      const TRAY = extractVar(src, 'TRAY_SUPPLY');
      if (PRICES.length !== 3) fail('PRICES should have 3 prices, got ' + PRICES.length);
      const payable = new Set([0]);
      DENOMS.forEach(v => {
        const n = TRAY[v] || 0;
        if (!(Number.isInteger(n) && n >= 1)) fail('TRAY_SUPPLY[' + v + '] should be a whole number of coins, at least 1');
        const cur = [...payable];
        cur.forEach(s => { for (let c = 1; c <= n; c++) payable.add(s + c * v); });
      });
      PRICES.forEach((p, i) => {
        if (!payable.has(p)) fail('PRICES[' + i + '] ' + p + ' not payable exactly with the tray supply');
        if (!(p >= 1 && p <= 100)) fail('PRICES[' + i + '] ' + p + ' outside 1~100');
      });

      /* --- 小遊戲關卡 --- */
      const ROUNDS = extractVar(src, 'ROUNDS');
      if (ROUNDS.length !== 5) fail('ROUNDS should have 5 rounds, got ' + ROUNDS.length);
      ROUNDS.forEach((r, i) => {
        if (r.kind === 'total'){
          if (!allDenoms(r.pile)) fail('ROUNDS[' + i + '] pile has a non-denomination coin');
          if (r.opts.length !== 4) fail('ROUNDS[' + i + '] total should offer 4 options, got ' + r.opts.length);
          if (r.opts[r.ans] !== sum(r.pile)) fail('ROUNDS[' + i + '] total: pile sums to ' + sum(r.pile) + ' but opts[ans] is ' + r.opts[r.ans]);
          if (new Set(r.opts).size !== r.opts.length) fail('ROUNDS[' + i + '] total has duplicate options');
          if (r.opts.some(o => o > 100)) fail('ROUNDS[' + i + '] total has an option above 100');
        } else if (r.kind === 'pay'){
          const sums = r.groups.map(sum);
          if (r.groups.length !== 4) fail('ROUNDS[' + i + '] pay should offer 4 groups, got ' + r.groups.length);
          if (!(r.price >= 1 && r.price <= 100)) fail('ROUNDS[' + i + '] pay price ' + r.price + ' outside 1~100');
          if (sums.some(s => s > 100)) fail('ROUNDS[' + i + '] pay has a group worth more than 100');
          if (!r.groups.every(allDenoms)) fail('ROUNDS[' + i + '] a group has a non-denomination coin');
          if (sums.filter(s => s === r.price).length !== 1) fail('ROUNDS[' + i + '] pay: ' + sums.filter(s => s === r.price).length + ' groups pay ' + r.price);
          if (sums[r.ans] !== r.price) fail('ROUNDS[' + i + '] pay: the marked group does not pay ' + r.price);
          if (new Set(sums).size !== sums.length) fail('ROUNDS[' + i + '] pay: two groups are worth the same');
        } else fail('ROUNDS[' + i + '] unknown kind ' + r.kind);
      });
    }
  }
};
