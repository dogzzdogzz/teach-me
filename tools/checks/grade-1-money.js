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
   副本）。這一條守得到的是「現在磁碟上那一份」，證明不了「改壞會響」。

   小遊戲（2026-10-01 從「結帳囉」五題選擇題改成五關五種玩法）：題庫與版面常數放在 i18n 前面的資料區，
   由 dataReturn 交給 check()；每個題庫的答案（總數、換錢的窮舉、往上數、硬幣個數）在這裡用自己的算法重算，
   幾條關鍵規則（放錯筒、超過、先數小的、牌子對不上）用 RENDER 函式本體的原始碼形狀守住。 */

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
    /* ---- 小遊戲（2026-10-01 改版）：每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
    { file:'index', expect:'is missing the 50 coin', find:'    [1, 5, 10, 50, 5, 10],', replace:'    [1, 5, 10, 10, 5, 10],' },
    { file:'index', expect:'more than a jar holds', find:'    [1, 1, 5, 10, 50, 50],', replace:'    [1, 1, 5, 10, 50, 1],' },
    { file:'index', expect:'jar must match', find:'if (jar.v !== v){ roundMiss', replace:'if (jar.v === 0){ roundMiss' },
    { file:'index', expect:'not smaller than 10', find:'    { big:10, bank:[5, 1] },', replace:'    { big:10, bank:[10, 1] },' },
    { file:'index', expect:'GAME_COUNT should be a pool', find:'  var GAME_COUNT = [\n', replace:'  var GAME_COUNT = [] || [\n' },
    { file:'index', expect:'two rows of purse coins overlap', find:'row1:28, row2:72 }', replace:'row1:28, row2:40 }' },
    { file:'index', expect:'top of the purse', find:'row1:28, row2:72 }', replace:'row1:12, row2:72 }' },
    { file:'index', expect:'paid coins overlap', find:'CH_PAID = { x:274, y:32, step:48,', replace:'CH_PAID = { x:274, y:32, step:20,' },
    { file:'index', expect:'only one kind of coin', find:'    { big:50, bank:[10, 5] }\n', replace:'    { big:50, bank:[10] }\n' },
    { file:'index', expect:'needs up to 10 coins', find:'EX_COLS = 5, EX_CAP = 10;', replace:'EX_COLS = 5, EX_CAP = 9;' },
    { file:'index', expect:'does not fit inside the tray', find:'EX_BOX = { x:24, y:72, w:252, h:108 }', replace:'EX_BOX = { x:24, y:72, w:252, h:70 }' },
    { file:'index', expect:'goes past the big coin', find:'if (have + v > e.big){', replace:'if (have + v > e.big + 10){' },
    { file:'index', expect:'fewer than 3 different values', find:'    [10, 10, 5, 1, 1],', replace:'    [10, 10, 5, 5, 5],' },
    { file:'index', expect:'over 100', find:'    [50, 10, 10, 5],', replace:'    [50, 50, 10, 5],' },
    { file:'index', expect:'counting row', find:'{x:60, y:94}, {x:150, y:94}, {x:240, y:94}', replace:'{x:60, y:94}, {x:150, y:94}, {x:240, y:114}' },
    { file:'index', expect:'counted coins 50 apart overlap', find:'pad:30, step:57 }', replace:'pad:30, step:50 }' },
    { file:'index', expect:'smaller coin can be counted', find:'if (v < big){ roundMiss', replace:'if (v < 0){ roundMiss' },
    { file:'index', expect:'equals a purse total', find:"    { purses:[ [5, 5, 1, 1], [10, 10, 10], [50] ], decoy:4 },", replace:"    { purses:[ [5, 5, 1, 1], [10, 10, 10], [50] ], decoy:12 }," },
    { file:'index', expect:'not the number of coins', find:"    { purses:[ [5, 5, 5], [10, 1], [50, 5] ], decoy:3 },", replace:"    { purses:[ [5, 5, 5], [10, 1], [50, 5] ], decoy:6 }," },
    { file:'index', expect:'misconception never shows up', find:"    { purses:[ [5, 5, 5], [10, 1], [50, 5] ], decoy:3 },", replace:"    { purses:[ [50, 5, 5], [10, 1], [5] ], decoy:3 }," },
    { file:'index', expect:'not all different', find:"[ [10, 1, 1, 1], [5, 5], [50, 10] ]", replace:"[ [10, 1, 1, 1], [5, 5, 1, 1, 1], [50, 10] ]" },
    { file:'index', expect:'more than 4 coins', find:"[ [10, 5, 1, 1], [50], [10, 10] ]", replace:"[ [10, 5, 1, 1, 1], [50], [10, 10] ]" },
    { file:'index', expect:'different amount', find:'if (P.data.v !== p.total){', replace:'if (P.data.v === 0){' },
    { file:'index', expect:'needs up to 20 coins', find:'    { price:35, paid:[50] },', replace:'    { price:30, paid:[50] },' },
    { file:'index', expect:'nothing to give back', find:'    { price:7, paid:[10] },', replace:'    { price:10, paid:[10] },' },
    { file:'index', expect:'paid has a non-denomination coin', find:'    { price:12, paid:[10, 10] },', replace:'    { price:12, paid:[20] },' },
    { file:'index', expect:'overlaps the price text', find:'CH_PAID = { x:274,', replace:'CH_PAID = { x:190,' },
    { file:'index', expect:'counts past what the customer paid', find:'if (have + v > paid){', replace:'if (have + v > paid + 5){' },
    { file:'index', expect:'does not start at the price', find:'have = c.price, runs = [c.price];', replace:'have = 0, runs = [c.price];' },
    { file:'index', expect:'under 44', find:'  var GPICK = 52;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'not drawn bigger than the 10 coin', find:'GCOIN = { 1:40, 5:44, 10:48, 50:50 }', replace:'GCOIN = { 1:40, 5:44, 10:48, 50:46 }' },
    { file:'index', expect:'sort tray: coins', find:'SORT_TRAY = { y:186, step:84, cols:3 }', replace:'SORT_TRAY = { y:186, step:50, cols:3 }' },
    { file:'index', expect:'tray reaches into the jars', find:'SORT_TRAY = { y:186, step:84, cols:3 }', replace:'SORT_TRAY = { y:150, step:84, cols:3 }' },
    { file:'index', expect:'gSortNot en', find:"return 'This coin says ' + v + ', so it", replace:"return 'This coin says ' + j + ', so it" },
    { file:'index', expect:'gExOver zh', find:"再放 ' + v + ' 元就是 ' + (have + v) + ' 元", replace:"再放 ' + v + ' 元就是 ' + (have) + ' 元" },
    { file:'index', expect:'sumExpr(', find:"list.join(' + ') + ' = ' + total : String(total); }", replace:"list.join(' + ') + ' = ' + (total + 1) : String(total); }" },
    { file:'index', expect:'gChDone zh', find:"元。' + price + ' + ' + ch + ' = ' + paid + '，剛好", replace:"元。' + price + ' + ' + ch + ' = ' + (paid + 1) + '，剛好" },
    { file:'index', expect:'gCountNow', find:"return runs.length ? '數：' + runs.join(' → ')", replace:"return runs.length ? '數：' + runs.slice(1).join(' → ')" },
    { file:'index', expect:'purse total is not the sum', find:'total:groupSum(coins)', replace:'total:coins.length' },
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
    dataReturn: '{coinSVG, coinGroupHTML, groupSum, QPIC, DENOMS, COIN_SIZE, sumExpr, GPICK, GCOIN, GSMALL, SORT_H, SORT_JAR, SORT_TRAY, GAME_SORT, EX_H, EX_BIG_Y, EX_BOX, EX_CELL, EX_COLS, EX_CAP, EX_BANK, GAME_EXCHANGE, CNT_H, CNT_SPOTS, CNT_ROW, GAME_COUNT, TAG_H, TAG_PURSE, TAG_SLOT, TAG_CARD, TAG_TRAY, GAME_TAGS, CH_H, CH_TOP, CH_PAID, CH_BOX, CH_CELL, CH_COLS, CH_CAP, CH_BANK, CH_BANKPOS, GAME_CHANGE}',
    optionValueMax: 100,
    check: function(data, I18N, fail, src){
      /* --- 小遊戲的卡片／硬幣要洗牌（正解不可以固定在同一個位置）—— 托盤統一由 renderTray() 畫，
             守的是**畫出來的順序**，實作在 lib/gameshuffle.js。 --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);

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

      /* --- 小遊戲：結帳囉（五關五種玩法，§六之五；2026-10-01 從選擇題改版）——
             每一題的答案在這裡用設定檔自己的算法重算（總數、換錢、往上數、硬幣個數），不呼叫頁面的答案邏輯；
             版面數字從 index.html 讀（資料區的常數 + RENDER 函式本體），不在這裡另抄一份。 --- */
      const isInt = v => Number.isInteger(v);
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      const TYPES = ['sort', 'exchange', 'count', 'tags', 'change'];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      ['zh','en'].forEach(L => {
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        if (typeof I18N[L].gWin !== 'function' || !/5/.test(I18N[L].gWin(5))) fail('gWin missing in ' + L);
      });
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      const box = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, s) => ({ x:cx - s / 2, y:cy - s / 2, w:s, h:s });
      const D = data, G = D.GPICK;
      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('a coin (GPICK ' + G + ')', G);
      tooSmall('a price tag (' + D.TAG_CARD.w + '×' + D.TAG_CARD.h + ')', Math.min(D.TAG_CARD.w, D.TAG_CARD.h));
      /* 畫出來的硬幣：面額越大、硬幣越大（真的硬幣也是），而且不小於 36（上面的數字要看得清楚）；畫在拿取範圍裡面 */
      DENOMS.forEach((v, i) => {
        const s = D.GCOIN[v];
        if (!(s >= 36 && s <= G)) fail('GCOIN[' + v + '] = ' + s + ' should be 36 ~ GPICK (' + G + ')');
        if (i && !(s > D.GCOIN[DENOMS[i - 1]])) fail('GCOIN: the ' + v + ' coin is not drawn bigger than the ' + DENOMS[i - 1] + ' coin');
      });
      [D.GSMALL, D.CH_PAID.size].forEach(s => { if (!(s >= 36)) fail('a drawn coin of size ' + s + ' is under 36 — the number on it is hard to read'); });
      [...new Set(DENOMS.map(v => D.GCOIN[v]).concat([D.GSMALL, D.CH_PAID.size]))].forEach(sz => DENOMS.forEach(v => {
        const svg = data.coinSVG(v, sz), label = 'game coinSVG(' + v + ',' + sz + ')';
        canvasProblems(svg, { pad: 1 }).forEach(p => fail(label + ': ' + p));
        coinTextProblems(svg, label).forEach(fail);
      }));
      /* 一般字句：sumExpr 自己驗一次 */
      [[[10, 5, 1], 16, '10 + 5 + 1 = 16'], [[50], 50, '50']].forEach(([l, t, w]) => { if (data.sumExpr(l, t) !== w) fail('sumExpr(' + l.join() + ') should read "' + w + '", got "' + data.sumExpr(l, t) + '"'); });
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = (text.match(/\d+/g) || []).map(Number).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
      };
      const has = (where, text, part) => { if (typeof text !== 'string' || text.indexOf(part) < 0) fail(where + ' does not say "' + part + '": ' + text); };
      ['GAME_SORT', 'GAME_EXCHANGE', 'GAME_COUNT', 'GAME_TAGS', 'GAME_CHANGE'].forEach(k => { if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)'); });
      const intList = (a, what) => { if (!Array.isArray(a) || !a.length || !a.every(isInt)) fail(what + ' is not a list of whole numbers'); };

      /* 第 1 關：存錢筒。六個硬幣、每種面額至少一個；一個存錢筒放得下的個數從版面算 */
      {
        const J = D.SORT_JAR, cap = Math.floor((J.h - J.lbl) / G);
        DENOMS.forEach((v, i) => {
          const r = { x:J.x0 + i * J.step, y:J.y, w:J.w, h:J.h };
          box(r, 'jar ' + v, 300, D.SORT_H);
          if (i && hit(r, { x:J.x0 + (i - 1) * J.step, y:J.y, w:J.w, h:J.h })) fail('jars ' + DENOMS[i - 1] + ' and ' + v + ' overlap');
          if (J.w < G) fail('a jar is narrower than a coin');
        });
        const T = D.SORT_TRAY;
        if (T.step < G + 4) fail('sort tray: coins ' + T.step + ' apart overlap (GPICK ' + G + ')');
        if (56 < G) fail('sort tray: rows 56 apart overlap');
        D.GAME_SORT.forEach((s, i) => {
          const w = 'GAME_SORT[' + i + ']';
          intList(s, w);
          if (s.length !== 6) fail(w + ' should have 6 coins');
          if (!allDenoms(s)) fail(w + ' has a non-denomination coin');
          DENOMS.forEach(v => {
            const n = s.filter(x => x === v).length;
            if (n < 1) fail(w + ' is missing the ' + v + ' coin (every jar gets at least one)');
            if (n > cap) fail(w + ' has ' + n + ' coins of ' + v + ' — more than a jar holds (' + cap + ')');
          });
          const cols = T.cols, x0 = (300 - (Math.min(cols, s.length) - 1) * T.step) / 2;
          s.forEach((v, k) => {
            const r = sq(x0 + (k % cols) * T.step, T.y + Math.floor(k / cols) * 56, G);
            box(r, w + ' tray coin ' + k, 300, D.SORT_H);
            if (hit(r, { x:0, y:J.y, w:300, h:J.h + 6 })) fail(w + ': the tray reaches into the jars');
          });
        });
        need('sort', /if \(jar\.v !== v\)\{ roundMiss\(d\.gSortNot\(v, jar\.v\)\); return false; \}/, 'a coin goes in any jar (the jar must match the value printed on the coin)');
        need('sort', /P\.lock\(jar\.cx, SORT_JAR\.y \+ SORT_JAR\.lbl \+ GPICK \/ 2 \+ jar\.n \* GPICK\)/, 'the placed coin is not stacked inside the jar');
        ['zh','en'].forEach(L => { seq('gSortNot ' + L, I18N[L].gSortNot(5, 10), [5, 5, 10]); seq('gSort2 ' + L, I18N[L].gSort2(50), [50, 50]); });
      }

      /* 第 2 關：換錢。硬幣盒只有比 big 小的面額；設定檔自己窮舉「放到剛好 big」的每一種放法，
         一定換得完（任何沒超過的狀態都還放得下一個不超過的硬幣），最多要放幾個 ≤ EX_CAP ≤ 盤子的格子數 */
      {
        const X = D.EX_BOX, rows = Math.floor((X.h - 8) / D.EX_CELL);
        const cm = B.exchange.match(/coinPic\(B, v, EX_BOX\.x \+ (\d+) \+ \(k % EX_COLS\) \* EX_CELL, EX_BOX\.y \+ (\d+) \+ Math\.floor\(k \/ EX_COLS\) \* EX_CELL, GSMALL\)/);
        if (!cm) fail('exchange: cannot read where the coins in the tray are drawn');
        else for (let k = 0; k < D.EX_CAP; k++){
          const r = sq(X.x + +cm[1] + (k % D.EX_COLS) * D.EX_CELL, X.y + +cm[2] + Math.floor(k / D.EX_COLS) * D.EX_CELL, D.GSMALL);
          if (!(r.x >= X.x && r.y >= X.y && r.x + r.w <= X.x + X.w && r.y + r.h <= X.y + X.h)) fail('exchange: coin #' + (k + 1) + ' of ' + D.EX_CAP + ' does not fit inside the tray');
        }
        if (D.EX_CAP > D.EX_COLS * rows) fail('exchange: EX_CAP ' + D.EX_CAP + ' is more than the tray has cells');
        box(X, 'the exchange tray', 300, D.EX_H);
        if (D.EX_BANK.y - G / 2 < D.EX_BANK.lblY + 20 || D.EX_BANK.lblY < X.y + X.h + 8) fail('exchange: coin box / its label / the tray overlap');
        if (D.EX_BANK.y + G / 2 > D.EX_H) fail('exchange: the coin box is below the board');
        if (D.EX_BANK.step < G + 4) fail('exchange: coin box coins overlap');
        D.GAME_EXCHANGE.forEach((e, i) => {
          const w = 'GAME_EXCHANGE[' + i + ']';
          if (DENOMS.indexOf(e.big) < 0) fail(w + ' big ' + e.big + ' is not a denomination');
          intList(e.bank, w + '.bank');
          if (!allDenoms(e.bank)) fail(w + '.bank has a non-denomination coin');
          if (e.bank.some(v => v >= e.big)) fail(w + '.bank has a coin that is not smaller than ' + e.big + ' (that is not an exchange)');
          if (new Set(e.bank).size !== e.bank.length) fail(w + '.bank repeats a coin');
          if (e.bank.length < 2) fail(w + '.bank has only one kind of coin — nothing can go past ' + e.big + ', so "stop at exactly" is never a decision');
          /* 窮舉：每一個沒超過的總數 s，可以走到的最多個數 */
          const most = new Map([[0, 0]]), todo = [0];
          while (todo.length){
            const s = todo.shift();
            const nexts = e.bank.filter(v => s + v <= e.big);
            if (s < e.big && !nexts.length) fail(w + ': stuck at ' + s + ' — no coin fits');
            nexts.forEach(v => { const t = s + v, c = most.get(s) + 1; if (!most.has(t) || most.get(t) < c){ most.set(t, c); todo.push(t); } });
          }
          if (!most.has(e.big)) fail(w + ': ' + e.big + ' cannot be made from ' + e.bank.join(','));
          else if (most.get(e.big) > D.EX_CAP) fail(w + ' needs up to ' + most.get(e.big) + ' coins, but the tray holds EX_CAP ' + D.EX_CAP);
          ['zh','en'].forEach(L => {
            seq(w + ' gExOver ' + L, I18N[L].gExOver(e.big - Math.min(...e.bank), e.big, e.big), [e.big - Math.min(...e.bank), e.big, 2 * e.big - Math.min(...e.bank), e.big]);
            const list = []; let s = 0; while (s < e.big){ const v = Math.max(...e.bank.filter(x => s + x <= e.big)); list.push(v); s += v; }
            has(w + ' gExDone ' + L, I18N[L].gExDone(e.big, list), list.join(' + '));
            seq(w + ' gExNow ' + L, I18N[L].gExNow(0, e.big), [0, e.big]);
          });
        });
        need('exchange', /if \(have \+ v > e\.big\)\{ roundMiss\(d\.gExOver\(have, v, e\.big\)\); return false; \}/, 'a coin that goes past the big coin is not bounced');
        need('exchange', /if \(have === e\.big\) roundSolved\(d\.gExDone\(e\.big, desc\(got\)\)\);/, 'the round is not solved exactly when the tray equals the big coin');
        need('exchange', /P\.home\(\);/, 'the coin box coin does not go back (the box must never run out)');
        ['zh','en'].forEach(L => { if (!/拿不完|never runs out/.test(I18N[L].gBank) || !/拿不完|never runs out/.test(I18N[L].gRegister)) fail('the coin box / register label does not say it never runs out (' + L + ')'); });
      }

      /* 第 3 關：從大的先數。4～5 個硬幣、至少三種面額、總數 ≤ 100；堆的位置不重疊、數過的那一排放得下 */
      {
        const S = D.CNT_SPOTS, Rw = D.CNT_ROW;
        S.forEach((p, i) => {
          const r = sq(p.x, p.y, G);
          box(r, 'count spot ' + i, 300, D.CNT_H);
          S.slice(0, i).forEach((q, j) => { if (hit(r, sq(q.x, q.y, G))) fail('count spots ' + j + ' and ' + i + ' overlap'); });
          if (r.y + r.h > Rw.y - 4) fail('count spot ' + i + ' reaches into the counting row');
        });
        box(Rw, 'the counting row', 300, D.CNT_H);
        if (Rw.step < G + 4) fail('count: counted coins ' + Rw.step + ' apart overlap');
        D.GAME_COUNT.forEach((c, i) => {
          const w = 'GAME_COUNT[' + i + ']';
          intList(c, w);
          if (!allDenoms(c)) fail(w + ' has a non-denomination coin');
          if (c.length < 4 || c.length > 5) fail(w + ' should have 4~5 coins');
          if (c.length > S.length) fail(w + ' has more coins than spots');
          if (new Set(c).size < 3) fail(w + ' has fewer than 3 different values — "biggest first" has nothing to sort');
          if (sum(c) > 100) fail(w + ' totals ' + sum(c) + ', over 100');
          if (Rw.x + Rw.pad + (c.length - 1) * Rw.step + G / 2 > Rw.x + Rw.w) fail(w + ': the last counted coin sticks out of the row');
          const runs = []; let t = 0; c.slice().sort((a, b) => b - a).forEach(v => { t += v; runs.push(t); });
          ['zh','en'].forEach(L => { seq(w + ' gCountNow ' + L, I18N[L].gCountNow(runs), runs); seq(w + ' gCountDone ' + L, I18N[L].gCountDone(t), [t]); });
        });
        need('count', /if \(v < big\)\{ roundMiss\(d\.gCountBig\(v, big\)\); return false; \}/, 'a smaller coin can be counted while a bigger one is left');
        need('count', /if \(!P\.locked && P\.data\.v > m\) m = P\.data\.v;/, 'biggestLeft() does not look at the uncounted coins');
        need('count', /total \+= v; runs\.push\(total\);/, 'the running total is not a running sum');
        ['zh','en'].forEach(L => seq('gCountBig ' + L, I18N[L].gCountBig(5, 50), [5, 50]));
      }

      /* 第 4 關：掛價錢牌。三個錢包總數兩兩不同；多的那張牌子是某個錢包的硬幣個數，不等於任何總數；
         一定有一個錢包硬幣比較多、錢卻比較少（迷思要真的出現） */
      {
        const P = D.TAG_PURSE, SL = D.TAG_SLOT, C = D.TAG_CARD, TT = D.TAG_TRAY;
        [0, 1, 2].forEach(i => {
          const r = { x:P.x0 + i * P.step, y:P.y, w:P.w, h:P.h };
          box(r, 'purse ' + i, 300, D.TAG_H);
          if (i && hit(r, { x:P.x0 + (i - 1) * P.step, y:P.y, w:P.w, h:P.h })) fail('purses ' + (i - 1) + ' and ' + i + ' overlap');
        });
        if (SL.w < C.w || SL.h < C.h) fail('a tag slot is smaller than a tag');
        if (P.row2 + D.GSMALL / 2 > SL.y) fail('purse coins reach into the tag slot');
        if (P.row1 - D.GSMALL / 2 < 2) fail('purse coins stick out of the top of the purse (row1 ' + P.row1 + ')');
        if (P.row2 - P.row1 < D.GSMALL) fail('the two rows of purse coins overlap (row1 ' + P.row1 + ', row2 ' + P.row2 + ')');
        if (P.dx * 2 < D.GSMALL) fail('two coins side by side in a purse overlap');
        if (P.w / 2 - P.dx - D.GSMALL / 2 < 0) fail('purse coins stick out of the purse');
        if (TT.step < C.w + 2) fail('tags ' + TT.step + ' apart overlap');
        const x0 = (300 - 3 * TT.step) / 2;
        if (x0 - C.w / 2 < 0 || x0 + 3 * TT.step + C.w / 2 > 300) fail('the tag tray sticks out of the board');
        if (TT.y - C.h / 2 < P.y + P.h + 4 || TT.y + C.h / 2 > D.TAG_H) fail('the tag tray overlaps the purses or leaves the board');
        D.GAME_TAGS.forEach((t, i) => {
          const w = 'GAME_TAGS[' + i + ']';
          if (!Array.isArray(t.purses) || t.purses.length !== 3) { fail(w + ' should have 3 purses'); return; }
          t.purses.forEach((p, k) => { intList(p, w + '.purses[' + k + ']'); if (!allDenoms(p)) fail(w + '.purses[' + k + '] has a non-denomination coin'); if (p.length > 4) fail(w + '.purses[' + k + '] has more than 4 coins (does not fit)'); });
          const tot = t.purses.map(sum), cnt = t.purses.map(p => p.length);
          if (new Set(tot).size !== 3) fail(w + ': purse totals are not all different (' + tot.join(',') + ')');
          if (tot.some(x => x > 100)) fail(w + ': a purse is over 100');
          if (!isInt(t.decoy) || t.decoy < 1) fail(w + '.decoy is not a positive whole number');
          if (tot.indexOf(t.decoy) >= 0) fail(w + ': decoy ' + t.decoy + ' equals a purse total — two tags would fit');
          if (cnt.indexOf(t.decoy) < 0) fail(w + ': decoy ' + t.decoy + ' is not the number of coins in any purse (' + cnt.join(',') + ')');
          if (!cnt.some((a, x) => cnt.some((b, y) => a > b && tot[x] < tot[y]))) fail(w + ': no purse with more coins but less money — the misconception never shows up');
          t.purses.forEach((p, k) => ['zh','en'].forEach(L => {
            const ds = p.slice().sort((a, b) => b - a);
            seq(w + ' gTagNot ' + L + ' purse ' + k, I18N[L].gTagNot(ds, tot[k], t.decoy), (p.length > 1 ? ds : []).concat([tot[k], t.decoy]));
            seq(w + ' gTag2 ' + L + ' purse ' + k, I18N[L].gTag2(ds, tot[k]), (p.length > 1 ? ds : []).concat([tot[k], tot[k]]));
          }));
        });
        need('tags', /renderTray\(B, purses\.map\(function\(p\)\{ return p\.total; \}\)\.concat\(\[t\.decoy\]\)/, 'the tags are not the three purse totals plus the decoy');
        need('tags', /total:groupSum\(coins\)/, 'a purse total is not the sum of the coins drawn in it');
        need('tags', /if \(P\.data\.v !== p\.total\)\{ roundMiss\(d\.gTagNot\(desc\(p\.coins\), p\.total, P\.data\.v\)\); return false; \}/, 'a tag can hang under a purse that holds a different amount');
      }

      /* 第 5 關：找錢。客人付的是畫出來的硬幣；找的錢 = 付的 − 價錢 > 0；最多要放 (找的錢 ÷ 收銀機最小面額) 個 ≤ CH_CAP ≤ 盤子格子 */
      {
        const X = D.CH_BOX, rows = Math.floor((X.h - 8) / D.CH_CELL);
        const cm = B.change.match(/coinPic\(B, v, CH_BOX\.x \+ (\d+) \+ \(k % CH_COLS\) \* CH_CELL, CH_BOX\.y \+ (\d+) \+ Math\.floor\(k \/ CH_COLS\) \* CH_CELL, GSMALL\)/);
        if (!cm) fail('change: cannot read where the coins in the tray are drawn');
        else for (let k = 0; k < D.CH_CAP; k++){
          const r = sq(X.x + +cm[1] + (k % D.CH_COLS) * D.CH_CELL, X.y + +cm[2] + Math.floor(k / D.CH_COLS) * D.CH_CELL, D.GSMALL);
          if (!(r.x >= X.x && r.y >= X.y && r.x + r.w <= X.x + X.w && r.y + r.h <= X.y + X.h)) fail('change: coin #' + (k + 1) + ' of ' + D.CH_CAP + ' does not fit inside the tray');
        }
        if (D.CH_CAP > D.CH_COLS * rows) fail('change: CH_CAP is more than the tray has cells');
        box(X, 'the change tray', 300, D.CH_H);
        if (!allDenoms(D.CH_BANK)) fail('CH_BANK has a non-denomination coin');
        if (D.CH_BANKPOS.lblY < X.y + X.h + 4 || D.CH_BANKPOS.y - G / 2 < D.CH_BANKPOS.lblY + 20 || D.CH_BANKPOS.y + G / 2 > D.CH_H) fail('change: register / its label / the tray overlap or leave the board');
        if (D.CH_BANKPOS.step < G + 4) fail('change: register coins overlap');
        const minB = Math.min(...D.CH_BANK);
        D.GAME_CHANGE.forEach((c, i) => {
          const w = 'GAME_CHANGE[' + i + ']';
          if (!isInt(c.price) || c.price < 1) fail(w + '.price is not a positive whole number');
          intList(c.paid, w + '.paid');
          if (!allDenoms(c.paid)) fail(w + '.paid has a non-denomination coin');
          if (c.paid.length > 2) fail(w + '.paid draws more than 2 coins');
          c.paid.forEach((v, k) => {
            const r = sq(D.CH_PAID.x - k * D.CH_PAID.step, D.CH_PAID.y, D.CH_PAID.size);
            box(r, w + ' paid coin ' + k, 300, D.CH_H);
            if (hit(r, D.CH_TOP) || r.y + r.h > X.y) fail(w + ': paid coin ' + k + ' overlaps the price text or the tray');
          });
          c.paid.forEach((v, k) => { if (k && hit(sq(D.CH_PAID.x - k * D.CH_PAID.step, D.CH_PAID.y, D.CH_PAID.size), sq(D.CH_PAID.x - (k - 1) * D.CH_PAID.step, D.CH_PAID.y, D.CH_PAID.size))) fail(w + ': the paid coins overlap — two coins could look like one'); });
          const paid = sum(c.paid), ch = paid - c.price;
          if (paid > 100) fail(w + ': paid over 100');
          if (!(ch >= 1)) fail(w + ': price ' + c.price + ' is not less than paid ' + paid + ' — nothing to give back');
          if (ch % minB) fail(w + ': change ' + ch + ' cannot be made from the register');
          if (ch / minB > D.CH_CAP) fail(w + ': change ' + ch + ' needs up to ' + (ch / minB) + ' coins, but the tray holds CH_CAP ' + D.CH_CAP);
          ['zh','en'].forEach(L => {
            seq(w + ' gChTop ' + L, I18N[L].gChTop(c.price), [c.price]);
            seq(w + ' gChOver ' + L, I18N[L].gChOver(10, paid - 1 + 10, paid), [10, paid + 9, paid]);
            const list = []; let s = 0; while (s < ch){ const v = Math.max(...D.CH_BANK.filter(x => s + x <= ch)); list.push(v); s += v; }
            const txt = I18N[L].gChDone(ch, list, c.price, paid);
            has(w + ' gChDone ' + L, txt, c.price + ' + ' + ch + ' = ' + paid);
            has(w + ' gChDone ' + L, txt, data.sumExpr(list, ch).replace(/ = (\d+)$/, L === 'en' ? ' = $$$1' : ' = $1'));
          });
        });
        need('change', /var c = pick\(GAME_CHANGE\), paid = groupSum\(c\.paid\), got = \[\], have = c\.price, runs = \[c\.price\];/, 'counting up does not start at the price');
        need('change', /if \(have \+ v > paid\)\{ roundMiss\(d\.gChOver\(v, have \+ v, paid\)\); return false; \}/, 'a coin that counts past what the customer paid is not bounced');
        need('change', /if \(have === paid\) roundSolved\(d\.gChDone\(paid - c\.price, desc\(got\), c\.price, paid\)\);/, 'the round is not solved exactly when counting reaches what was paid');
      }
    }
  }
};
