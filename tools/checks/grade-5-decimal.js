/* grade-5/math/decimal 的檢查設定（小數商店：元角分、小數 × 整數、小數 ÷ 整數、分數與小數）。
   2026-10-10 新增 —— 和小遊戲「小數商店」改成五關五種玩法（§六之五）同一次寫成。在那之前這一課沒有設定檔，
   simgen／verify_lesson_data 對它一律直接報錯（沒有設定的課不算驗過）。

   錢的算式掃描：這一課的每一句旁白都是「錢的算式」（`2.6 元 = 26 個 0.1 元`、`$2.34 = 2 dollars + 3 dimes + 4 cents`），
   lib/decarith.js 只認得純數字。moneyNorm() 先把單位**換成算式**再交給 decArith：
     `N 個 X 元`／`N × $X` → (N × X)；`N 角`／`N dimes`／`N tenths` → (N × 0.1)；`N 分`／`N cents`／`N hundredths` → (N × 0.01)；
     `X 元`／`$X`／`X dollars` → X；分數 `a/b` → (a ÷ b)。
   所以「2.34 元 = 2 元 + 4 角 + 3 分」會被算出來是錯的（不是只比數字有沒有出現）。掃描器自己先跑 MONEY_PROBES（真的要零誤報、假的一定要抓到）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數，金額一律用整數個 0.1／0.01 重算、
   自己的格式化），選項格式（自然寫法的小數、分數、或比大小那一題的四句），renderCheck 把每一題渲染出來的題幹＋解釋丟進 moneyNorm＋decArith。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）與範例 1～3 的旁白函式（拿頁面自己的 MONEY_AMOUNTS／MULT_PROBLEMS／DIV_PROBLEMS 呼叫）逐條重算，驗了幾條釘死。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     五關各自**照遊戲的規則把每一題從頭玩一遍**：湊錢的每一種硬幣 × 每一欄 × 每一個數量、換錢的每一個放牌／換錢順序、
     點小數點的每一個縫、平分的每一條合法走法（窮舉所有狀態）、分數變小數的每一個 0～2.999 的打法 —— 證明每一題都解得完、
     只有對的會收、解完一定是對的答案、每一句說明的數字照順序對、句子裡的錢的算式算得對。
     頁面的純函式（fmtDec／fmtCents／coinDigits／coinBad／swapPlan／pointPlan／pointRead／shareStep／fracPart／fracJudge／dropTarget）
     一律拿整個題庫去呼叫再和自己的算法比；shuffle()、nearestAny()／nearestOpen()、roundMiss()、roundNote() 從原始碼切出來真的跑；
     只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。版面與 375px 觸控 ≥ 44px 從資料區讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、文字放不放得下、375px 的實際尺寸由 HDIR 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { decArith } = require('./lib/decarith.js')();

function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }
/* 自己的格式化：u 個 10^-p，寫成剛好 p 位小數 */
function fixRef(u, p){ let s = String(u); if (!p) return s; while (s.length <= p) s = '0' + s; return s.slice(0, s.length - p) + '.' + s.slice(s.length - p); }
/* 自然寫法：拿掉小數尾巴的 0（和小數點） */
function natRef(u, p){ const s = fixRef(u, p); return p ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
/* 小數字串 → 有理數 [分子, 分母]（自己的解析） */
function decRat(s){ const m = /^(\d+)(?:\.(\d+))?$/.exec(String(s)); if (!m) return null; const f = m[2] || ''; const d = Math.pow(10, f.length); return [+m[1] * d + (f ? +f : 0), d]; }
function ratEq(x, y){ return !!x && !!y && x[0] * y[1] === y[0] * x[1]; }
function toks(text){ return String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []; }

/* ---------- 錢的算式：把單位換成算式，交給 decArith ---------- */
function moneyNorm(text){
  return String(text).replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    /* 散文的括號（「= 36 (ignore the point for now)」）換成全形，不讓它被當成算式的一部分；下面插進去的算式括號後面一定是數字 */
    .replace(/\((?=\s*[A-Za-z\u4e00-\u9fff])/g, '（').replace(/(?<=[A-Za-z\u4e00-\u9fff.!?])\s*\)/g, '）')
    /* 「1.04」是 … ／“1.04” is …：引號裡的數就是這一句的左邊（遊戲說明用這個寫法讀出放錯的位置） —— 換成等號才驗得到（codex 第一輪） */
    .replace(/「(\d+(?:\.\d+)?)」\s*是/g, '$1 =').replace(/“(\d+(?:\.\d+)?)”\s*is\b(?!\s+not\b)/g, '$1 =')
    .replace(/(\d+)\s*\/\s*(\d+)/g, '($1 ÷ $2)')
    .replace(/(\d+)\s*個\s*(\d+(?:\.\d+)?)/g, '($1 × $2)')
    .replace(/(\d+)\s*×\s*\$\s*(\d+(?:\.\d+)?)/g, '($1 × $2)')
    .replace(/(\d+)\s*(?:角|dimes?\b|tenths?\b)/g, '($1 × 0.1)')
    .replace(/(\d+)\s*(?:分(?![成數之配給])|cents?\b|hundredths?\b)/g, '($1 × 0.01)')
    .replace(/(\d+(?:\.\d+)?\)?)\s*(?:元|dollars?\b)/g, '$1')
    .replace(/\$\s*(\d)/g, '$1');
}
function moneyClaims(text){ return decArith(moneyNorm(text)); }
/* 掃描器自己先證明會響：bad:false 必須零誤報而且驗到 n 條；bad:true 一定要抓到 */
const MONEY_PROBES = [
  { text:'2.34 元 = 2 元 + 3 角 + 4 分', bad:false, n:1 },
  { text:'2.34 元 = 2 元 + 4 角 + 3 分', bad:true },
  { text:'$2.34 = 2 dollars + 3 dimes + 4 cents', bad:false, n:1 },
  { text:'$2.34 = 2 dollars + 3 cents + 4 dimes', bad:true },
  { text:'10 個 0.1 元 = 1 元', bad:false, n:1 },
  { text:'1 元 = 100 個 0.1 元', bad:true },
  { text:'10 × $0.1 = $1', bad:false, n:1 },
  { text:'2.6 元 = 26 個 0.1 元，26 × 4 = 104', bad:false, n:2 },
  { text:'2.6 元 = 26 個 0.01 元', bad:true },
  { text:'2.6 × 4 = 10.4：8 元 + 24 個 0.1 元 = 10 元 + 4 個 0.1 元 = 10.4 元。', bad:false, n:3 },
  { text:'2.6 × 4 = 10.4：8 元 + 24 個 0.1 元 = 10 元 + 4 個 0.1 元 = 1.04 元。', bad:true },
  { text:'Split $1 into 4 parts: 100 cents ÷ 4 = 25 cents; 1 part is 25 cents = $0.25.', bad:false, n:2 },
  { text:'1 元平分成 4 份：100 個 0.01 元 ÷ 4 = 25 個 0.01 元；拿 3 份是 75 個 0.01 元 = 0.75 元。', bad:false, n:2 },
  { text:'拿 3 份是 75 個 0.01 元 = 7.5 元。', bad:true },
  { text:'0.50 = 5 個 0.1 ＋ 0 個 0.01', bad:false, n:1 },
  { text:'0.50 = 5 tenths + 0 hundredths', bad:false, n:1 },
  { text:'1/2 通分成 2/4，2/4 + 1/4 = 3/4。', bad:false, n:1 },
  { text:'2/4 + 1/4 = 3/8', bad:true },
  { text:'$7.2 = 72 dimes, 72 ÷ 3 = 24, so each person gets 24 dimes, which is $2.4.', bad:false, n:2 },
  { text:'「1.04」是 104 個 0.01 元。', bad:false, n:1 },
  { text:'「1.04」是 104 個 0.1 元。', bad:true },
  { text:'“104” is 104 × $1.', bad:false, n:1 },
  { text:'“0.104” is 104 × $0.01.', bad:true },
  /* 否定句不是宣稱：不可以被改寫成等號（codex 第二輪） */
  { text:'“1.4” is not 1/4 of a dollar: a fraction is not its top and bottom written on either side of a point.', bad:false, n:0 },
  { text:'“1.04” is not 104 × $0.1.', bad:false, n:0 },
  { text:'「1.4」不是 1/4 元：分數不是把分子和分母寫在小數點的兩邊。', bad:false, n:0 }
];

/* ---------- review.html：第二套實作 ---------- */
const FRAC_DEC = { '1/2':'0.5', '1/4':'0.25', '3/4':'0.75', '1/5':'0.2', '2/5':'0.4', '3/5':'0.6', '4/5':'0.8', '1/10':'0.1' };
function fracSumRef(a, b){
  const p = a.split('/').map(Number), q = b.split('/').map(Number);
  const n = p[0] * q[1] + q[0] * p[1], d = p[1] * q[1], g = gcdRef(n, d);
  return (n / g) + '/' + (d / g);
}
const CMP_TEXT = {
  zh:{ EQUAL:'一樣大', CANNOT:'位數不同，無法比較' },
  en:{ EQUAL:'They are equal', CANNOT:'Cannot compare — different number of decimal places' }
};

module.exports = {
  breaks: [
    /* ---- index.html：靜態字串、試題、範例 ---- */
    { file:'index', expect:'this claim is wrong', find:"why:'12 × 3 = 36，1.2 有 1 位小數，把小數點往左移 1 位 → 3.6。' }", replace:"why:'12 × 3 = 38，1.2 有 1 位小數，把小數點往左移 1 位 → 3.6。' }" },
    { file:'index', expect:'this claim is wrong', find:"svgCaption: '2.34 元 = 2 元 + 3 角 + 4 分',", replace:"svgCaption: '2.34 元 = 2 元 + 4 角 + 3 分'," },
    { file:'index', expect:'the marked answer', find:"opts:['3.2','24','0.24','2.4'], ans:3,\n          why:'72 ÷ 3 = 24，", replace:"opts:['3.2','24','0.24','2.4'], ans:2,\n          why:'72 ÷ 3 = 24，" },
    { file:'index', expect:'this claim is wrong', find:"找回 50 − 37.5 = 12.5 元。", replace:"找回 50 − 37.5 = 13.5 元。" },
    { file:'index', expect:'never says the answer', find:"why:'6 × 4 = 24. 0.6 has 1 decimal place, so move the point one place left → 2.4.' }", replace:"why:'6 × 4 = 24. 0.6 has 1 decimal place, so move the point one place left.' }" },
    { file:'index', expect:'does not come out in whole tenths', find:'{ a:6.3, n:7 }', replace:'{ a:6.4, n:7 }' },
    { file:'index', expect:'this claim is wrong', find:"return '<b>' + v.toFixed(2) + ' 元</b> = ' + d + ' 元 + ' + t + ' 角 + ' + c + ' 分';", replace:"return '<b>' + v.toFixed(2) + ' 元</b> = ' + d + ' 元 + ' + c + ' 角 + ' + t + ' 分';" },
    { file:'index', expect:'the money scan verified', find:"        swap: '提示：10 個 0.1 元 = 1 元。每滿", replace:"        swap: '提示：10 個 0.1 元換成 1 元。每滿" },

    /* ---- index.html：小遊戲的共用部分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['coin', 'swap', 'point', 'share', 'frac'];", replace:"var GAME_ORDER = ['swap', 'coin', 'point', 'share', 'frac'];" },
    { file:'index', expect:"in the columns' order", find:'    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }', replace:'' },
    { file:'index', expect:'the coin tray is not laid out through shuffle()', find:'      shuffle([0, 1, 2]).forEach(function(t, i){', replace:'      [0, 1, 2].forEach(function(t, i){' },
    { file:'index', expect:'nearestAny(): ', find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (!best){ bd = dd; bc = dc; best = b; }' },
    { file:'index', expect:'measure to the box, not the centre', find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (dc < bc){ bd = dd; bc = dc; best = b; }' },
    { file:'index', expect:'skips it and lands in the next box', find:'  function nearestOpen(list, pt, pad){ var b = nearestAny(list, pt, pad); return b && !b.done ? b : null; }', replace:'  function nearestOpen(list, pt, pad){ var b = nearestAny(list, pt, pad); return b; }' },
    { file:'index', expect:'dropTarget(', find:'    if ((tc && tc.done) || (tf && tf.done)) return null;\n', replace:'' },
    { file:'index', expect:'a second finger (or a stale board) can pick a piece up', find:'      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;', replace:'      if (P.locked || gSolved || start || gen !== gGen) return;' },
    { file:'index', expect:'no lostpointercapture safety on pieces', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });", replace:'' },
    { file:'index', expect:'from a removed board can still act', find:'      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */', replace:'' },
    { file:'index', expect:'placed pieces still catch pointer events', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'roundNote() (reminders) must not touch the score', find:"  function roundNote(text){ gMsg.innerHTML", replace:"  function roundNote(text){ gMistake = true; gMsg.innerHTML" },
    { file:'index', expect:'gMinus zh', find:"      gMinus: '扣 5 分',", replace:"      gMinus: '扣 6 分'," },

    /* 第 1 關：湊錢 */
    { file:'index', expect:'coins to drag — keep it to 9', find:'var GAME_COIN = [234, 305,', replace:'var GAME_COIN = [789, 305,' },
    { file:'index', expect:'coinBad(', find:"  function coinBad(t, col, have, need){ return t !== col ? 'col' : (have >= need ? 'many' : null); }", replace:"  function coinBad(t, col, have, need){ return t !== col ? 'col' : (have > need ? 'many' : null); }" },
    { file:'index', expect:'coinDigits() is', find:'  function coinDigits(c){ return [Math.floor(c / 100), Math.floor(c / 10) % 10, c % 10]; }', replace:'  function coinDigits(c){ return [Math.floor(c / 100), Math.floor(c / 10), c % 10]; }' },
    { file:'index', expect:'covers the column name or its digit', find:'coin:24, coinGap:28, coinY:62,', replace:'coin:24, coinGap:28, coinY:52,' },
    { file:'index', expect:'should say "十分位"', find:"        return goal + ' 的' + ['個位', '十分位', '百分位'][t] + '是 ' + dig + '：' +", replace:"        return goal + ' 的' + ['個位', '百分位', '十分位'][t] + '是 ' + dig + '：' +" },
    { file:'index', expect:'gCoinDone en', find:"dg[1] + ' × $0.1 + ' + dg[2] + ' × $0.01.'; },", replace:"dg[1] + ' × $0.01 + ' + dg[2] + ' × $0.1.'; }," },
    { file:'index', expect:'one coin too many is not refused', find:"        if (bad === 'many'){ roundMiss(d.gCoinMany(t, goal, need[t])); return false; }\n", replace:'' },
    { file:'index', expect:'should have amounts with a 0 tenths digit', find:'var GAME_COIN = [234, 305, 120, 60, 250, 106, 45, 203, 132, 27];', replace:'var GAME_COIN = [234, 315, 120, 60, 250, 116, 45, 213, 132, 27];' },

    /* 第 2 關：換錢 */
    { file:'index', expect:'there is nothing to trade', find:'[6, 5], [19, 3]', replace:'[1, 5], [19, 3]' },
    { file:'index', expect:'swapPlan() is', find:'D2:D + Math.floor(T / 10), T2:T % 10,', replace:'D2:D + Math.floor(T / 10), T2:T,' },
    { file:'index', expect:'a row that is not full can be traded', find:'        if (P.data.cnt < 10){ roundMiss(', replace:'        if (P.data.cnt < 1){ roundMiss(' },
    { file:'index', expect:'"All traded" with 10 or more dimes is not refused', find:'        if (T >= 10){ roundMiss(d.gSwapMore(T)); return; }\n', replace:'' },
    { file:'index', expect:'gSwapDone en', find:"D2 + ' + ' + T2 + ' dimes", replace:"D2 + ' + ' + T + ' dimes" },
    { file:'index', expect:'this claim is wrong', find:"      gSwapOk: '10 個 0.1 元 = 1 元：換好一個 1 元。',", replace:"      gSwapOk: '10 個 0.01 元 = 1 元：換好一個 1 元。'," },
    { file:'index', expect:'stale row', find:'        if (B.selected && frames.indexOf(B.selected) >= 0) B.selected = null;\n', replace:'' },
    { file:'index', expect:'should verify "reading = P × unit"', find:"return '「' + rd + '」是 ' + P + ' 個 ' + U[kp] + '。可是 '", replace:"return '「' + rd + '」有 ' + P + ' 個 ' + U[kp] + '。可是 '" },
    { file:'index', expect:'gShare2T zh', find:"      gShare2T: function(T, n){ return '還有 ' + T + ' 個 0.1 元：' + n + ' 個人每人再發一個。'; },", replace:"      gShare2T: function(T, n){ return '還有 ' + T + ' 個 1 元：' + n + ' 個人每人再發一個。'; }," },
    { file:'index', expect:'covers the count at the bottom of the $1 box', find:'dollar:22, dollarGap:24, dollarY:106,', replace:'dollar:22, dollarGap:24, dollarY:116,' },
    { file:'index', expect:'price tags overlap', find:'tagW:56, tagH:48, tagPitch:58,', replace:'tagW:56, tagH:48, tagPitch:50,' },

    /* 第 3 關：點小數點 */
    { file:'index', expect:'pointRead(', find:"return { k:k, text:k ? (g ? digits.slice(0, g) : '0') + '.' + digits.slice(g) : digits };", replace:"return { k:k, text:k ? (g ? digits.slice(0, g) : '') + '.' + digits.slice(g) : digits };" },
    { file:'index', expect:'pointPlan() is', find:'ans:s.length - k,', replace:'ans:s.length - k - 1,' },
    { file:'index', expect:'should have 1 or 2 real decimal places', find:'[12, 2, 3], [48, 1, 5]', replace:'[12, 3, 3], [48, 1, 5]' },
    { file:'index', expect:'a point in the wrong gap is not refused', find:'        if (s.g !== P0.ans){', replace:'        if (false){' },
    { file:'index', expect:"a gap's snap zone does not reach halfway", find:'hw:G.gapW / 2 + G.digW / 2,', replace:'hw:G.gapW / 2 + G.digW,' },
    { file:'index', expect:'gPointNo gap', find:"return '「' + rd + '」是 ' + P + ' 個 ' + U[kp] + '。可是 '", replace:"return '「' + rd + '」是 ' + P + ' 個 ' + U[k] + '。可是 '" },
    { file:'index', expect:'is outside the', find:'digY:86, digW:44, digH:56,', replace:'digY:86, digW:60, digH:56,' },

    /* 第 4 關：平分 */
    { file:'index', expect:'shareStep(', find:"    return (what === 'D' ? D : T) >= n ? 'give' : 'few';", replace:"    return (what === 'D' ? D : T) > n ? 'give' : 'few';" },
    { file:'index', expect:'shareStep(', find:"(D >= n ? 'early' : 'swap')", replace:"'swap'" },
    { file:'index', expect:'does not come out in whole dimes', find:'[52, 4], [15, 3]', replace:'[53, 4], [15, 3]' },
    { file:'index', expect:'nothing to trade', find:'[[72, 3], [96, 4],', replace:'[[72, 3], [84, 4],' },
    { file:'index', expect:'handing out when there is not one for everyone', find:"        if (step === 'few'){ roundMiss(", replace:"        if (step === 'few'){ roundNote(" },
    { file:'index', expect:'gShareDone zh', find:"' 個 0.1 元，' + A + ' ÷ ' + n + ' = ' + Q + '；每人拿到 '", replace:"' 個 0.1 元，' + A + ' ÷ ' + n + ' = ' + q + '；每人拿到 '" },
    { file:'index', expect:'gShareDone zh', find:"'；每人拿到 ' + g0 + ' 個 1 元 + ' + g1 + ' 個 0.1 元 = ' + q + ' 元，和 ' + Q + ' 個 0.1 元一樣多。';", replace:"'，每人 ' + Q + ' 個 0.1 元，就是 ' + q + ' 元。';" },
    /* ⚠️ replace 裡不可以有 $' —— breaktest 用 String.replace，$' 會被換成「後面那一段」 */
    { file:'index', expect:'gShareDone en', find:"', as much as ' + Q + ' dimes.'", replace:"', as much as ' + q + ' dimes.'" },
    { file:'index', expect:'Drag one', find:"'. Drag ' + (have > 1 ? 'one' : 'it') + ' to the change machine", replace:"'. Drag it to the change machine" },
    { file:'index', expect:'pointPlan() is', find:"nat = k ? prod.replace(/0+$/, '').replace(/\\.$/, '') : prod;", replace:"nat = prod;" },
    { file:'index', expect:'gPointDone zh', find:"(p.charAt(0) === '0' ? '個位沒有數字，要補一個 0，寫成 ' + p + '。' : '') + ", replace:"" },
    { file:'index', expect:'the people box and the change machine overlap', find:'bankX:184, bankY:186,', replace:'bankX:184, bankY:176,' },

    /* 第 5 關：分數變小數 */
    { file:'index', expect:'fracJudge(', find:"    if (s === a + '.' + b || s === '0.' + a + '' + b) return { kind:'digits', milli:milli };\n", replace:'' },
    { file:'index', expect:'should only be a reminder', find:'    var m = /^(0|[1-9]\\d{0,5})(?:\\.(\\d{1,3}))?$/.exec(s);', replace:'    var m = /^(0|[0-9]\\d{0,5})(?:\\.(\\d{1,3}))?$/.exec(s);' },
    { file:'index', expect:'too long to count exactly', find:"    if (/^[1-9]\\d{6,}(?:\\.\\d{1,3})?$/.test(s)) return { kind:'huge' };\n", replace:'' },
    { file:'index', expect:'"at most three decimal places" reminder', find:"    if (/^(0|[1-9]\\d*)\\.\\d{4,}$/.test(s)) return { kind:'long' };\n", replace:'' },
    { file:'review', expect:'the change equals the price of one pen', find:'        if (P * 10 - total === t) P = P * 2;\n', replace:'' },
    { file:'index', expect:'squares, not', find:'    if (b === 4) return (r < 5 ? 0 : 2) + (c < 5 ? 0 : 1);', replace:'    if (b === 4) return (r < 4 ? 0 : 2) + (c < 5 ? 0 : 1);' },
    { file:'index', expect:'b should be 2, 4, 5, 10 or 20', find:'[3, 20], [7, 20]', replace:'[3, 8], [7, 20]' },
    { file:'index', expect:'gFracDone zh', find:"' = ' + per + ' 個 0.01 元；拿 '", replace:"' = ' + (per + 1) + ' 個 0.01 元；拿 '" },
    { file:'index', expect:'writing the top and bottom as digits is not refused', find:"        if (j.kind === 'digits'){ roundMiss(d.gFracDigits(a, b, s)); return; }", replace:"        if (j.kind === 'digits'){ roundNote(d.gFracDigits(a, b, s)); return; }" },
    { file:'index', expect:'must not say', find:"(big ? 'more' : 'less') + ' than the shaded part.'", replace:"(big ? 'less' : 'more') + ' than the shaded part.'" },

    /* ---- review.html 的產生器 ---- */
    { file:'review', expect:'copied straight out of the stem', find:'      if (v === Number(correct) || avoid.indexOf(String(c)) >= 0) return;', replace:'      if (v === Number(correct)) return;' },
    { file:'review', expect:'the money arithmetic is wrong', find:"' ÷ ' + d.n + ' = ' + d.q + '；商的小數點", replace:"' ÷ ' + d.n + ' = ' + (d.q + 1) + '；商的小數點" },
    { file:'review', expect:'3/4 is not 0.7', find:"{ frac:'3/4', dec:'0.75',", replace:"{ frac:'3/4', dec:'0.7'," },
    { file:'review', expect:'biggerToken is wrong', find:"var biggerToken = (t1 * 10 > h2) ? 'A' : 'B';", replace:"var biggerToken = (t1 * 10 < h2) ? 'A' : 'B';" },
    { file:'review', expect:'does not cover the total', find:'if (b * 10 > totalTenths && b * 10 !== 2 * totalTenths) return b;', replace:'if (b * 10 !== 2 * totalTenths) return b;' },
    { file:'review', expect:'opts[ans] != correct', find:'        var correct = fmtHundredths(p);', replace:'        var correct = fmtTenths(p);' },
    { file:'review', expect:'opts[ans] != correct', find:'        var correct = fmtTenths(change);', replace:'        var correct = fmtHundredths(change);' },
    { file:'review', expect:'is not 1/4 + 1/8', find:"{ a:'1/4', b:'1/8', correct:'3/8'", replace:"{ a:'1/4', b:'1/8', correct:'3/16'" },
    { file:'review', expect:'natural way', find:"    return sign + whole + (frac ? ('.' + frac) : '');", replace:"    return sign + whole + '.' + frac;" },
    { file:'review', via:'index', expect:'review.html generators should be exactly', find:"    { id:'percentToDecimal', cat:'percent',", replace:"    { id:'percentToDec', cat:'percent'," },
  ],

  sim: {
    INVARIANTS: {
      multDecimal: d => {
        if (!(d.t >= 11 && d.t <= 49 && d.t % 10 !== 0)) return 'the decimal factor ' + d.t + ' tenths is outside 1.1～4.9 or a whole number';
        if (!(d.n >= 2 && d.n <= 6)) return 'n out of range: ' + d.n;
        if (d.prod !== d.t * d.n) return 'prod is not t × n';
      },
      divDecimal: d => {
        if (!(d.n >= 2 && d.n <= 6 && d.q >= 11 && d.q <= 18)) return 'n or q out of range';
        if (d.t !== d.q * d.n) return 'the dividend is not q × n (the quotient would not come out in whole tenths)';
      },
      wordMoneyTotal: d => {
        if (!(d.t >= 12 && d.t <= 85 && d.t % 10 !== 0)) return 'the price ' + d.t + ' tenths is out of range or whole';
        if (!(d.n >= 2 && d.n <= 6) || d.prod !== d.t * d.n) return 'n or prod wrong';
      },
      wordChange: d => {
        if (!(d.n >= 2 && d.n <= 4) || d.total !== d.t * d.n) return 'n or total wrong';
        if ([20, 50, 100, 200].indexOf(d.P) < 0) return 'paid with ' + d.P + ', not a banknote';
        if (!(d.P * 10 > d.total)) return 'the money paid (' + d.P + ') does not cover the total ' + fixRef(d.total, 1);
        if (d.change !== d.P * 10 - d.total) return 'change is not paid − total';
        if (d.change === d.t) return 'the change equals the price of one pen — the answer is copied from the stem';
        if (d.change === d.total) return 'the change equals the total — two options would be equal';
      },
      fracToDecimal: d => {
        if (!FRAC_DEC[d.frac] || FRAC_DEC[d.frac] !== d.dec) return d.frac + ' is not ' + d.dec;
        const [a, b] = d.frac.split('/').map(Number);
        if (!ratEq(decRat(d.dec), [a, b])) return d.frac + ' does not equal ' + d.dec + ' by the rational check';
      },
      compareDecimals: d => {
        if (!(d.t1 >= 1 && d.t1 <= 9 && d.h2 >= 1 && d.h2 <= 99 && d.h2 !== d.t1 * 10)) return 'numbers out of range or equal';
        if (d.biggerToken !== (d.t1 * 10 > d.h2 ? 'A' : 'B')) return 'biggerToken is wrong';
        if (d.order.slice().sort().join() !== 'A,B,CANNOT,EQUAL') return 'the four options are not A, B, EQUAL, CANNOT';
      },
      percentToDecimal: d => {
        if (!(d.p >= 15 && d.p <= 90 && d.p % 5 === 0 && d.p !== 50)) return 'p out of range: ' + d.p;
      },
      fracAddSimple: d => {
        if (!/^\d+\/\d+$/.test(d.a) || !/^\d+\/\d+$/.test(d.b)) return 'the addends are not fractions';
        const s = fracSumRef(d.a, d.b);
        if (d.opts[d.ans] !== s) return 'the marked answer ' + d.opts[d.ans] + ' is not ' + d.a + ' + ' + d.b + ' = ' + s;
      }
    },
    /* 正解的第二套實作：只用原始參數重算，自己格式化 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'multDecimal': case 'wordMoneyTotal': return natRef(d.t * d.n, 1);
        case 'divDecimal': return natRef(d.t / d.n, 1);
        case 'wordChange': return natRef(d.P * 10 - d.t * d.n, 1);
        case 'fracToDecimal': { const [a, b] = d.frac.split('/').map(Number); return natRef(a * 100 / b, 2); }
        case 'compareDecimals': return d.t1 * 10 > d.h2 ? natRef(d.t1, 1) : natRef(d.h2, 2);
        case 'percentToDecimal': return natRef(d.p, 2);
        case 'fracAddSimple': return fracSumRef(d.a, d.b);
      }
      return '?';
    },
    /* 選項只可以是自然寫法的小數（沒有多餘的 0）、分數，或比大小那一題的兩句 */
    optionOk: function(s, genId, lang){
      if (genId === 'compareDecimals' && (s === CMP_TEXT[lang].EQUAL || s === CMP_TEXT[lang].CANNOT)) return null;
      if (genId === 'fracAddSimple') return /^[1-9]\d*\/[1-9]\d*$/.test(s) ? null : 'option "' + s + '" is not a fraction';
      if (!/^(0|[1-9]\d*)(\.\d*[1-9])?$/.test(s)) return 'option "' + s + '" is not a decimal written the natural way (no extra zeros)';
      if (s === '0') return 'option 0';
      return null;
    },
    /* 誘答抄題幹：percentToDecimal 的「把 % 拿掉就好」（p 本身）是刻意的迷思誘答，只放行那一個值 */
    stemEchoOk: {
      percentToDecimal: (d, o) => o === String(d.p)
    },
    renderCheck: function(d, q, lang, genId){
      const r = moneyClaims(q.stem + ' ' + q.why);
      if (r.problems.length) return 'the money arithmetic is wrong: ' + r.problems.join('; ');
      if (/multDecimal|divDecimal|wordMoneyTotal|wordChange/.test(genId) && !r.verified) return 'the explanation has no equation to check: ' + q.why;
      /* 解釋最後說的答案就是正解 */
      const want = module.exports.sim.expectedCorrect(d, genId, lang);
      if (genId !== 'compareDecimals' && genId !== 'fracAddSimple' && toks(q.why).slice(-1)[0] !== want) return 'the explanation ends with ' + toks(q.why).slice(-1)[0] + ', the answer is ' + want;
      return null;
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「小數商店」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GAME_W, fmtDec, fmtCents, shuffle, GAME_COIN, COIN_VAL, coinDigits, coinBad, COIN_G, coinSpot, GAME_SWAP, swapPlan, SWAP_G, swapTagX, swapFrame, swapDollar, GAME_POINT, pointPlan, pointRead, POINT_G, pointDigitX, pointGapX, GAME_SHARE, shareStep, SHARE_G, sharePlateX, GAME_FRAC, fracPart, fracJudge, FRAC_G, dropTarget}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = D.GAME_W;

      /* --- 0. 掃描器自己先證明會響 --- */
      MONEY_PROBES.forEach((p, i) => {
        const r = moneyClaims(p.text);
        if (p.bad && !r.problems.length) fail('moneyClaims() self-test ' + i + ': "' + p.text + '" should be caught');
        if (!p.bad && r.problems.length) fail('moneyClaims() self-test ' + i + ': "' + p.text + '" is true but was flagged: ' + r.problems.join('; '));
        if (!p.bad && r.verified !== p.n) fail('moneyClaims() self-test ' + i + ': "' + p.text + '" should verify ' + p.n + ' equalities, verified ' + r.verified);
      });

      /* --- 1. 每一條 I18N 靜態字串＋範例 1～3 的旁白，錢的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      const scan = (where, s) => { const r = moneyClaims(s); checkedEq += r.verified; r.problems.forEach(p => fail(where + ': ' + p)); return r; };
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => scan(where, s)));
      {
        const arr = name => { const m = src.match(new RegExp('var ' + name + ' = (\\[[\\s\\S]*?\\]);')); try { return m ? new Function('return ' + m[1])() : null; } catch (e){ return null; } };
        const MA = arr('MONEY_AMOUNTS'), MP = arr('MULT_PROBLEMS'), DP = arr('DIV_PROBLEMS');
        if (!MA || !MP || !DP) fail('cannot read MONEY_AMOUNTS / MULT_PROBLEMS / DIV_PROBLEMS from index.html');
        else LANGS.forEach(L => {
          const d = I18N[L];
          MA.forEach(v => { const c = Math.round(v * 100); scan(L + ' moneyEq(' + v + ')', d.moneyEq(v, Math.floor(c / 100), Math.floor(c / 10) % 10, c % 10)); });
          MP.forEach(p => { const w = Math.round(p.a * 10), pr = w * p.n;
            scan(L + ' multAdd(' + p.a + ')', d.multAdd(p.a, p.n, pr / 10)); scan(L + ' multRuleStep', d.multRuleStep(p.a, p.n, w, pr));
            const t = d.multRuleText(p.a, p.n, pr, pr / 10); if (toks(t).slice(-1)[0] !== natRef(pr, 1) && toks(t).slice(-1)[0] !== fixRef(pr, 1)) fail(L + ' multRuleText(' + p.a + ' × ' + p.n + ') ends with ' + toks(t).slice(-1)[0] + ': ' + t); });
          DP.forEach(p => { const t = Math.round(p.a * 10); if (t % p.n) return fail('DIV_PROBLEMS ' + p.a + ' ÷ ' + p.n + ' does not come out in whole tenths');
            scan(L + ' divStep(' + p.a + ')', d.divStep(p.a, p.n, t, t / p.n)); scan(L + ' divRuleText(' + p.a + ')', d.divRuleText(p.a, p.n, t / p.n / 10)); });
        });
      }
      /* 試題：「a × b = ?」「a ÷ b = ?」的正解用自己的有理數重算；每一題的解釋都要說出正解那個數 */
      LANGS.forEach(L => ['qs', 'qsAdv'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const w = L + '.' + bank + '[' + i + ']', ans = toks(q.opts[q.ans])[0];
        const m = /^\s*(\d+(?:\.\d+)?)\s*([×÷])\s*(\d+(?:\.\d+)?)\s*=\s*\?\s*$/.exec(q.stem);
        if (m){
          const x = decRat(m[1]), y = decRat(m[3]), v = m[2] === '×' ? [x[0] * y[0], x[1] * y[1]] : [x[0] * y[1], x[1] * y[0]];
          if (!ratEq(v, decRat(ans))) fail(w + ': ' + q.stem + ' — the marked answer ' + ans + ' is wrong');
        } else if (bank === 'qs') fail(w + ': a basic question should be "a × b = ?" or "a ÷ b = ?": ' + q.stem);
        if (toks(q.why).indexOf(ans) < 0) fail(w + ': the explanation never says the answer ' + ans + ': ' + q.why);
      })));
      /* 釘住驗了幾條：一個壞掉的正規化會讓每條算式都靜靜讀不到，那樣也是零錯誤。改了課文就把這個數一起改。 */
      if (checkedEq !== EXPECTED_STATIC_EQ) fail('the money scan verified ' + checkedEq + ' equalities in the I18N strings and examples, expected ' + EXPECTED_STATIC_EQ + ' — it is not reading them (or the text changed: update the count)');

      /* --- 1b. review.html 的產生器清單釘死：simgen 只驗「還在的」產生器 —— 整個刪掉或改名，它的不變條件與正解檢查就靜靜不見了。
             和 simgen 一樣把「工具 ＋ GENS」那一段切出來真的執行，拿 GENS 本身的 id（不靠字面掃描）。 --- */
      {
        const fs = require('fs'), path = require('path');
        const rp = path.join(path.dirname(process.argv[2] || '.'), 'review.html');
        let rv = '';
        try { rv = fs.readFileSync(rp, 'utf8'); } catch (e){ fail('cannot read ' + rp + ' to pin the generator list'); }
        const gs = rv.indexOf('/* ---------- 工具 ---------- */'), ge = rv.indexOf('/* ---------- 出一批', gs);
        let ids = [];
        if (gs < 0 || ge < 0) fail('cannot find the generator block in review.html');
        else { try { ids = new Function(rv.slice(gs, ge) + '\nreturn GENS.map(function(g){ return g.id; });')(); } catch (e){ fail('review.html GENS could not be evaluated: ' + e.message); } }
        const WANT = ['multDecimal', 'divDecimal', 'wordMoneyTotal', 'wordChange', 'fracToDecimal', 'compareDecimals', 'percentToDecimal', 'fracAddSimple'];
        if (ids.join() !== WANT.join()) fail('review.html generators should be exactly ' + WANT.join() + ' — got ' + ids.join());
        WANT.forEach(id => { if (!module.exports.sim.INVARIANTS[id]) fail('no invariant for review.html generator ' + id); });
      }

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言）、RENDER 切得出來 --- */
      const TYPES = ['coin', 'swap', 'point', 'share', 'frac'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 2, 3, 4), got ' + D.GAME_ORDER);
      TYPES.forEach(t => LANGS.forEach(L => {
        if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
        if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
      }));
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      /* 每一句說明：數字（含小數）照順序逐個比，而且句子裡的錢的算式都要算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = toks(text).join();
        if (got !== want.map(String).join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        moneyClaims(text).problems.forEach(p => fail(where + ': ' + p));
      };
      /* 說明的意思用寫死的關鍵詞釘住（必須說／不可以說） */
      const says = (where, text, must, mustNot) => {
        (must || []).forEach(w => { if (String(text).indexOf(w) < 0) fail(where + ': should say "' + w + '": ' + text); });
        (mustNot || []).forEach(w => { if (String(text).indexOf(w) >= 0) fail(where + ': must not say "' + w + '": ' + text); });
      };
      const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      ['GAME_COIN', 'GAME_SWAP', 'GAME_POINT', 'GAME_SHARE', 'GAME_FRAC'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 6) fail(k + ' should be a pool of at least 6 entries');
      });
      /* 頁面的格式化要和自己的一致 */
      for (let u = 0; u <= 1200; u++) for (let p = 0; p <= 3; p++) if (D.fmtDec(u, p) !== fixRef(u, p)){ fail('fmtDec(' + u + ', ' + p + ') is ' + D.fmtDec(u, p) + ', should be ' + fixRef(u, p)); u = 9999; break; }
      for (let c = 1; c <= 1200; c++) if (D.fmtCents(c) !== natRef(c, 2)){ fail('fmtCents(' + c + ') is ' + D.fmtCents(c) + ', should be ' + natRef(c, 2)); break; }

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0（§三 高年級：有扣分機制） */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(src, 'roundMiss');
        if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "minus 5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
        });
        const nsrc = extractFunction(src, 'roundNote');
        if (!nsrc || /gMistake|gScore/.test(nsrc)) fail('scoring: roundNote() (reminders) must not touch the score or record a mistake');
      }
      LANGS.forEach(L => {
        seq('gPts ' + L, I18N[L].gPts(20), [20]);
        seq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (toks(I18N[L].gWin(85)).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- shuffle()：從原始碼切出來真的跑。托盤一定不是原本的順序（3000 次） --- */
      {
        const fsrc = extractFunction(src, 'shuffle');
        let sh = null;
        if (!fsrc) fail('cannot find shuffle() in index.html');
        else { try { sh = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); } }
        if (sh){
          let sorted = 0, moved = 0;
          for (let i = 0; i < 3000; i++){
            const a = sh([0, 1, 2]);
            if (a.slice().sort().join() !== '0,1,2') { fail('shuffle() lost or duplicated items: ' + a); break; }
            if (a.join() === '0,1,2') sorted++;
            if (a[0] !== 0) moved++;
          }
          if (sorted) fail('shuffle() returned the coin tray in the columns\' order ' + sorted + ' times in 3000');
          if (moved < 1500) fail('shuffle() hardly moves anything (' + moved + '/3000 moved the first coin)');
        }
        need('coin', /shuffle\(\[0, 1, 2\]\)\.forEach\(/, 'the coin tray is not laid out through shuffle()');
      }

      /* --- nearestAny()／nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const asrc = extractFunction(src, 'nearestAny'), osrc = extractFunction(src, 'nearestOpen');
        let na = null, no = null;
        if (!asrc || !osrc) fail('cannot find nearestAny()/nearestOpen() in index.html');
        else { try { const f = new Function(asrc + '\n' + osrc + '\nreturn [nearestAny, nearestOpen];')(); na = f[0]; no = f[1]; } catch (e){ fail('nearestAny()/nearestOpen() could not be evaluated: ' + e.message); } }
        if (na){
          /* 三欄：每一點都判給自己那一欄；兩欄中間的縫，靠右的判給右邊那一欄（陣列裡排第二） */
          const C = D.COIN_G, cols = [0, 1, 2].map(i => ({ id:i, cx:C.colX[i] + C.colW / 2, cy:C.colY + C.colH / 2, hw:C.colW / 2, hh:C.colH / 2, done:false }));
          let bad = 0;
          cols.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 4){ const g = na(cols, { x, y }, C.pad); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestAny(): ' + bad + ' points inside a coin column are given to another column (or none)');
          [1, 2].forEach(i => {
            const gl = C.colX[i - 1] + C.colW, gr = C.colX[i];
            if (!(gr - gl > 0 && gr - gl < 2 * C.pad)) return fail('COIN_G: columns ' + (i - 1) + ' and ' + i + ' should be apart but closer than two pads (gap ' + (gr - gl) + ') so the overlap is real');
            const rr = na(cols, { x:gr - (gr - gl) * 0.25, y:cols[0].cy }, C.pad), rl = na(cols, { x:gl + (gr - gl) * 0.25, y:cols[0].cy }, C.pad);
            if (!rr || rr.id !== i) fail('nearestAny(): a drop in the gap nearer column ' + i + ' is not given to column ' + i);
            if (!rl || rl.id !== i - 1) fail('nearestAny(): a drop in the gap nearer column ' + (i - 1) + ' is not given to column ' + (i - 1));
          });
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = na(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestAny(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (no(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
          if (na(done, { x:300, y:300 }, 6) !== null) fail('nearestAny(): a drop far from every box is accepted');
          /* 平分：人那一排和換錢機放寬之後重疊；靠近換錢機的判給換錢機（陣列裡排第二） */
          const S = D.SHARE_G, people = { id:'people', cx:W / 2, cy:S.plateY - 4 + S.peopleH / 2, hw:(W - 4) / 2, hh:S.peopleH / 2 },
                bank = { id:'bank', cx:S.bankX + S.bankW / 2, cy:S.bankY + S.bankH / 2, hw:S.bankW / 2, hh:S.bankH / 2 };
          const pb = S.plateY - 4 + S.peopleH, bt = S.bankY;
          if (!(bt - pb > 0 && bt - pb < 2 * S.pad)) fail('SHARE_G: the people box and the change machine should be apart but closer than two pads (gap ' + (bt - pb) + ')');
          else {
            const r1 = na([people, bank], { x:bank.cx, y:bt - (bt - pb) * 0.25 }, S.pad);
            if (!r1 || r1.id !== 'bank') fail('nearestAny(): a drop between the people and the change machine, nearer the machine, is not given to the machine');
          }
          /* 點小數點：每一個縫的吸附範圍到兩邊數字的中間為止 —— 每一點都判給最近的縫，沒有一點兩個縫搶 */
          const P = D.POINT_G;
          for (let m = 1; m <= 4; m++){
            const gaps = []; for (let g = 0; g <= m; g++) gaps.push({ id:g, cx:D.pointGapX(g, m), cy:P.digY + P.digH / 2, hw:P.gapW / 2 + P.digW / 2, hh:P.digH / 2 });
            let wrong = 0;
            for (let x = gaps[0].cx - P.gapW / 2 + 0.25; x < gaps[m].cx + P.gapW / 2; x += 0.5){
              const want = gaps.reduce((b, g) => Math.abs(g.cx - x) < Math.abs(b.cx - x) ? g : b, gaps[0]).id;
              const got = na(gaps, { x, y:P.digY + P.digH / 2 }, 0);
              if (!got || got.id !== want) wrong++;
            }
            if (wrong) fail('point: with ' + m + ' digits, ' + wrong + ' points along the digits go to a gap that is not the nearest');
          }
        }
      }
      /* dropTarget()：中心點與手指各自找最近的格子 */
      {
        const ok = t => t.ok;
        const A = { id:'A', ok:true, done:false }, Bx = { id:'B', ok:false, done:false }, Dn = { id:'D', ok:true, done:true };
        [[A, Bx, 'A'], [Bx, A, 'A'], [Bx, null, 'B'], [null, Bx, 'B'], [Dn, Bx, null], [Bx, Dn, null], [null, null, null], [A, Dn, 'A']].forEach(([tc, tf, want]) => {
          const r = D.dropTarget(tc, tf, ok);
          if ((r ? r.id : null) !== want) fail('dropTarget(' + (tc && tc.id) + ', ' + (tf && tf.id) + ') is ' + (r && r.id) + ', should be ' + want);
        });
      }
      /* 拖拉引擎：只用 pointer events、只跟第一根手指、放開的保險、換畫板保護、放好的不擋點擊 */
      [[/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a second finger (or a stale board) can pick a piece up'],
       [/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'no lostpointercapture safety on pieces'],
       [/if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板/, 'a piece from a removed board can still act when released'],
       [/document\.removeEventListener\('pointerup', onDocEnd\);/, 'the document release listener is never removed'],
       [/\.gpiece\.locked\{cursor:default;pointer-events:none\}/, 'placed pieces still catch pointer events'],
       [/\.gpiece\{left:0;top:0;display:flex;align-items:center;justify-content:center;\s*touch-action:none;/, 'pieces are missing touch-action:none']
      ].forEach(([re, what]) => { if (!re.test(src)) fail('engine: ' + what); });

      /* ================= 第 1 關：湊錢 ================= */
      {
        const G = D.COIN_G, PLACE = { zh:['個位', '十分位', '百分位'], en:['ones', 'tenths', 'hundredths'] }, CV = ['1', '0.1', '0.01'];
        if (D.COIN_VAL.join() !== '100,10,1') fail('COIN_VAL should be 100,10,1 (dollar, dime, cent, left to right)');
        let zeroMid = 0, noDollar = 0, noCent = 0;
        D.GAME_COIN.forEach((c, i) => {
          const w = 'GAME_COIN[' + i + '] ' + c;
          const dg = [Math.floor(c / 100), Math.floor(c / 10) % 10, c % 10];
          if (!(c > 0 && c < 1000)) return fail(w + ': the amount should be between 0.01 and 9.99');
          if (D.coinDigits(c).join() !== dg.join()) fail(w + ': coinDigits() is ' + D.coinDigits(c) + ', should be ' + dg);
          if (dg[0] + dg[1] + dg[2] > 9) fail(w + ': ' + (dg[0] + dg[1] + dg[2]) + ' coins to drag — keep it to 9');
          if (dg[0] && !dg[1] && dg[2]) zeroMid++;
          if (!dg[0]) noDollar++;
          if (!dg[2]) noCent++;
          /* 照規則玩：每一種硬幣 × 每一欄 × 每一個已放數量 —— 只有「自己那一欄、還不夠」會收；收到夠就停；最後的錢就是題目的錢 */
          const have = [0, 0, 0];
          for (let guard = 0; guard < 40; guard++){
            let moved = false;
            for (let t = 0; t < 3; t++) for (let col = 0; col < 3; col++){
              const r = D.coinBad(t, col, have[col], dg[col]);
              const ref = t !== col ? 'col' : (have[col] >= dg[col] ? 'many' : null);
              if (r !== ref) fail(w + ': coinBad(' + t + ', ' + col + ', ' + have[col] + ', ' + dg[col] + ') is ' + r + ', should be ' + ref);
              if (r === null && !moved){ have[col]++; moved = true; }
            }
            if (!moved) break;
          }
          if (have.join() !== dg.join() || have[0] * 100 + have[1] * 10 + have[2] !== c) fail(w + ': playing by the rules ends at ' + have + ', not ' + dg);
          LANGS.forEach(L => {
            const d = I18N[L], goal = D.fmtCents(c);
            if (!ratEq(decRat(goal), [c, 100])) fail(w + ' ' + L + ': the goal is written ' + goal);
            seq(w + ' gCoinDone ' + L, d.gCoinDone(goal, dg), [goal, dg[0], '1', dg[1], '0.1', dg[2], '0.01']);
            if (!moneyClaims(d.gCoinDone(goal, dg)).verified) fail(w + ' gCoinDone ' + L + ': no equation was verified');
            seq(w + ' gCoin2 ' + L, d.gCoin2(dg[0], dg[1], dg[2]), [dg[0], '1', dg[1], '0.1', dg[2], '0.01']);
            for (let t = 0; t < 3; t++){
              seq(w + ' gCoinMany ' + L + ' ' + t, d.gCoinMany(t, goal, dg[t]), dg[t] ? [goal, dg[t], dg[t], CV[t]] : [goal, 0, CV[t]]);
              says(w + ' gCoinMany ' + L + ' ' + t, d.gCoinMany(t, goal, dg[t]), [PLACE[L][t]], PLACE[L].filter((x, j) => j !== t && x.indexOf(PLACE[L][t]) < 0 && PLACE[L][t].indexOf(x) < 0));
            }
            seq(w + ' gCoinNow ' + L, d.gCoinNow(goal, D.fmtDec(0, 2)), [goal, '0.00']);
          });
        });
        if (!(zeroMid >= 2 && noDollar >= 2 && noCent >= 2)) fail('GAME_COIN should have amounts with a 0 tenths digit between (3.05), with no dollars (0.6) and with no cents (1.2) — at least two each');
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let t = 0; t < 3; t++) for (let col = 0; col < 3; col++) if (t !== col) seq('gCoinCol ' + L + ' ' + t + '→' + col, d.gCoinCol(t, col), [CV[t], CV[t], CV[col]]);
          for (let t = 0; t < 3; t++) seq('gCoinOk ' + L + ' ' + t, d.gCoinOk(t, 3), [3, CV[t]]);
          if (!Array.isArray(d.gColNames) || d.gColNames.map(n => toks(n).join()).join('|') !== '1|0.1|0.01') fail('gColNames ' + L + ' should name 1, 0.1, 0.01 left to right: ' + d.gColNames);
        });
        /* 版面：三欄並排不重疊、在畫板裡；欄名、硬幣（最多 9 枚）、欄底的數字互不重疊；托盤三枚硬幣不重疊、夠大 */
        const cols = [0, 1, 2].map(i => ({ x:G.colX[i], y:G.colY, w:G.colW, h:G.colH }));
        cols.forEach((c, i) => inside(c, 'coin column ' + i, G.H));
        noHits(cols, 'coin columns');
        cols.forEach((c, i) => {
          const lbl = { x:c.x + 4, y:G.colY + 2, w:G.colW - 8, h:G.lblH }, dig = { x:c.x + 4, y:G.digY, w:G.colW - 8, h:G.digH };
          const coins = []; for (let j = 0; j < 9; j++){ const s = D.coinSpot(i, j); coins.push(box(s.x, s.y, G.coin, G.coin)); }
          coins.forEach((b, j) => { if (!(b.x >= c.x + 3 && b.x + b.w <= c.x + c.w - 3 && b.y >= c.y + 3 && b.y + b.h <= c.y + c.h - 3)) fail('coin ' + j + ' of column ' + i + ' is drawn outside its column'); if (hit(b, lbl) || hit(b, dig)) fail('coin ' + j + ' of column ' + i + ' covers the column name or its digit'); });
          noHits(coins, 'coins in column ' + i);
          if (!(dig.y + dig.h <= c.y + c.h)) fail('the digit of column ' + i + ' is below the column');
        });
        const tray = [0, 1, 2].map(i => box(G.trayX[i], G.trayY, G.piece, G.piece));
        tray.forEach((t, i) => { inside(t, 'coin ' + i + ' in the tray', G.H); cols.forEach(c => { if (hit(t, c)) fail('coin ' + i + ' in the tray covers a column'); }); });
        noHits(tray, 'tray coins');
        tooSmall('a coin in the tray', G.piece);
        need('coin', /var bad = coinBad\(t, col\.col, have\[col\.col\], need\[col\.col\]\);/, 'the drop is not judged by coinBad()');
        need('coin', /if \(bad === 'col'\)\{ roundMiss\(d\.gCoinCol\(t, col\.col\)\); return false; \}/, 'a coin in the wrong column is not refused as a mistake');
        need('coin', /if \(bad === 'many'\)\{ roundMiss\(d\.gCoinMany\(t, goal, need\[t\]\)\); return false; \}/, 'one coin too many is not refused as a mistake');
        need('coin', /if \(have\[0\] === need\[0\] && have\[1\] === need\[1\] && have\[2\] === need\[2\]\) roundSolved\(/, 'the round is not solved exactly when every column has its digit');
      }

      /* ================= 第 2 關：換錢（連加） ================= */
      {
        const G = D.SWAP_G;
        D.GAME_SWAP.forEach((e, i) => {
          const [a, n] = e, w = 'GAME_SWAP[' + i + '] ' + D.fmtDec(a, 1) + ' × ' + n;
          if (!(a % 10 !== 0 && a < 100 && n >= 3 && n <= 5)) return fail(w + ': a should be a one-place decimal under 10 and n 3～5');
          const T0 = (a % 10) * n, D0 = Math.floor(a / 10) * n;
          if (!(T0 >= 10)) fail(w + ': only ' + T0 + ' dimes — there is nothing to trade');
          if (!(T0 <= 40)) fail(w + ': ' + T0 + ' dimes need more than four rows');
          const P = D.swapPlan(e);
          if (P.D !== D0 || P.T !== T0 || P.D2 !== D0 + Math.floor(T0 / 10) || P.T2 !== T0 % 10 || P.P !== a * n) fail(w + ': swapPlan() is ' + JSON.stringify(P));
          if (P.D2 * 10 + P.T2 !== a * n) fail(w + ': the regrouped money ' + P.D2 + ' dollars ' + P.T2 + ' dimes is not ' + D.fmtDec(a * n, 1));
          if (P.D2 > 12) fail(w + ': ' + P.D2 + ' dollars do not fit in the $1 box (12 spots)');
          /* 照規則玩：牌與換錢的每一種先後順序（換錢只收滿 10 個的那一排）都走得完，而且「換好了」只在沒有滿 10 個時收 */
          const seen = new Set(), stack = [[0, 0, 0]];
          let ends = 0;
          while (stack.length){
            const [k, Dd, Tt] = stack.pop(), key = k + ',' + Dd + ',' + Tt;
            if (seen.has(key)) continue; seen.add(key);
            const moves = [];
            if (k < n) moves.push([k + 1, Dd + Math.floor(a / 10), Tt + a % 10]);
            if (Tt >= 10) moves.push([k, Dd + 1, Tt - 10]);
            if (k === n && Tt < 10){ ends++; if (Dd !== P.D2 || Tt !== P.T2) fail(w + ': a way of playing ends at ' + Dd + ' dollars ' + Tt + ' dimes'); }
            if (!moves.length && !(k === n && Tt < 10)) fail(w + ': stuck at ' + key);
            moves.forEach(m => stack.push(m));
          }
          if (!ends) fail(w + ': no way of playing finishes');
          LANGS.forEach(L => {
            const d = I18N[L], aS = D.fmtDec(a, 1), pS = D.fmtDec(a * n, 1);
            seq(w + ' gSwapDone ' + L, d.gSwapDone(aS, n, D0, T0, P.D2, P.T2, pS), L === 'zh' ? [aS, n, pS, D0, T0, '0.1', P.D2, P.T2, '0.1', pS] : [aS, n, pS, D0, T0, P.D2, P.T2, pS]);
            if (moneyClaims(d.gSwapDone(aS, n, D0, T0, P.D2, P.T2, pS)).verified !== 3) fail(w + ' gSwapDone ' + L + ': should verify 3 equalities');
            for (let k = 2; k <= n; k++){ const t = d.gSwapAdd(aS, k, D.fmtDec(a * k, 1)); seq(w + ' gSwapAdd ' + L + ' ' + k, t, Array(k).fill(aS).concat([D.fmtDec(a * k, 1), k])); if (moneyClaims(t).verified !== 1) fail(w + ' gSwapAdd ' + L + ': the sum is not checked'); }
            seq(w + ' gSwapAdd ' + L + ' 1', d.gSwapAdd(aS, 1, aS), [1, aS]);
            seq(w + ' gSwapTill ' + L, d.gSwapTill(D0, T0, n, n), [D0, '1', T0, '0.1', n, n]);
            seq(w + ' gSwapTag ' + L, d.gSwapTag(aS), [aS]);
          });
          if (swapTagCheck(n)) fail(w + ': ' + swapTagCheck(n));
        });
        function swapTagCheck(n){
          const tags = []; for (let i = 0; i < n; i++) tags.push(box(D.swapTagX(i, n), G.tagY, G.tagW, G.tagH));
          for (const t of tags) if (!(t.x >= 0 && t.x + t.w <= W && t.y >= 0 && t.y + t.h <= G.tillY)) return 'a price tag is outside the board or over the till';
          for (let i = 1; i < n; i++) if (hit(tags[i - 1], tags[i])) return 'price tags overlap';
          return '';
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let k = 1; k <= 9; k++) seq('gSwapPart ' + L + ' ' + k, d.gSwapPart(k), L === 'zh' ? [k, '0.1', 10, 1] : [k, 10, 1]);
          for (let T = 10; T <= 40; T += 7) seq('gSwapMore ' + L + ' ' + T, d.gSwapMore(T), L === 'zh' ? [T, '0.1', 10, 1] : [T, 10, 1]);
          seq('gSwapOk ' + L, d.gSwapOk, [10, '0.1', 1].concat(L === 'zh' ? [1] : []));
          if (moneyClaims(d.gSwapOk).verified !== 1) fail('gSwapOk ' + L + ' should verify 10 × 0.1 = 1');
          seq('gSwapLeft ' + L, d.gSwapLeft(2), [2]);
          /* 第二層提示（跟著畫面走）：每一種狀態的那一句 */
          seq('gSwap2Tags ' + L, d.gSwap2Tags(3), [3]);
          seq('gSwap2Full ' + L, d.gSwap2Full(24), L === 'zh' ? [24, '0.1', 10, 1] : [24, 10, 1]);
          seq('gSwap2Done ' + L, d.gSwap2Done, L === 'zh' ? [10, '0.1'] : [10]);
        });
        /* 版面：收銀台、1 元那一格、四排 0.1 元互不重疊；1 元最多 12 個畫在格子裡、不蓋住格子底的數字 */
        const till = { x:2, y:G.tillY, w:W - 4, h:G.tillH }, bx = { x:G.boxX, y:G.tillY + 4, w:G.boxW, h:G.tillH - 8 };
        inside(till, 'the till', G.H);
        const frames = [0, 1, 2, 3].map(i => { const f = D.swapFrame(i); return box(f.x, f.y, G.frameW, G.frameH); });
        frames.forEach((f, i) => { if (!(f.x >= bx.x + bx.w + 4 && f.x + f.w <= till.x + till.w - 2 && f.y >= G.tillY + 6 + G.lblH && f.y + f.h <= till.y + till.h - 2)) fail('dime row ' + i + ' is outside the dime side of the till (or under its label)'); });
        noHits(frames, 'dime rows');
        const cnt = { x:G.boxX + 4, y:G.tillY + G.tillH - 4 - 46, w:G.boxW - 8, h:44 };
        for (let j = 0; j < 12; j++){ const s = D.swapDollar(j), b = box(s.x, s.y, G.dollar, G.dollar);
          if (!(b.x >= bx.x + 3 && b.x + b.w <= bx.x + bx.w - 3 && b.y >= G.tillY + 6 + G.lblH)) fail('dollar ' + j + ' is drawn outside the $1 box'); if (hit(b, cnt)) fail('dollar ' + j + ' covers the count at the bottom of the $1 box'); }
        if (!(G.btnY >= till.y + till.h && G.btnY + G.btnH <= G.H)) fail('the "All traded" button overlaps the till or leaves the board');
        tooSmall('a price tag', Math.min(G.tagW, G.tagH)); tooSmall('a row of dimes', Math.min(G.frameW, G.frameH)); tooSmall('the "All traded" button', G.btnH);
        need('swap', /if \(P\.data\.cnt < 10\)\{ roundMiss\(d\.gSwapPart\(P\.data\.cnt\)\); return false; \}/, 'a row that is not full can be traded');
        need('swap', /T -= 10; D \+= 1;/, 'trading a row does not take 10 dimes and give 1 dollar');
        need('swap', /inTill\+\+; D \+= Math\.floor\(P0\.a \/ 10\); T \+= P0\.a % 10;/, 'a price tag does not add its dollars and dimes');
        need('swap', /if \(inTill < P0\.n\)\{ roundNote\(d\.gSwapLeft\(P0\.n - inTill\)\); return; \}/, '"All traded" with tags left is not a reminder');
        need('swap', /if \(T >= 10\)\{ roundMiss\(d\.gSwapMore\(T\)\); return; \}/, '"All traded" with 10 or more dimes is not refused');
      }

      /* ================= 第 3 關：點小數點 ================= */
      {
        const G = D.POINT_G, U = ['1', '0.1', '0.01', '0.001'];
        let twoPlaces = 0, lead0 = 0, trail0 = 0;
        D.GAME_POINT.forEach((e, i) => {
          const [A, k, n] = e, P = A * n, s = String(P), m = s.length, w = 'GAME_POINT[' + i + '] ' + fixRef(A, k) + ' × ' + n;
          if (!(k >= 1 && k <= 2 && A % 10 !== 0 && n >= 2 && n <= 6)) return fail(w + ': the factor should have 1 or 2 real decimal places and n 2～6');
          if (!(m >= k && m <= 4)) return fail(w + ': the product ' + P + ' has ' + m + ' digits (needs ≥ ' + k + ', ≤ 4 to fit)');
          if (k === 2) twoPlaces++;
          if (m === k) lead0++;
          if (P % 10 === 0) trail0++;
          const pl = D.pointPlan(e);
          if (pl.P !== P || pl.digits !== s || pl.ans !== m - k || pl.a !== fixRef(A, k) || pl.prod !== fixRef(P, k) || pl.nat !== natRef(P, k)) fail(w + ': pointPlan() is ' + JSON.stringify(pl));
          /* 每一個縫：讀起來是什麼；只有答案那一個縫的值是 a × n；每一個錯的縫讀起來的值都不一樣（畫面決定得了答案） */
          const vals = new Set();
          for (let g = 0; g <= m; g++){
            const kp = m - g, ref = kp ? (g ? s.slice(0, g) : '0') + '.' + s.slice(g) : s, r = D.pointRead(s, g);
            if (r.text !== ref || r.k !== kp) fail(w + ': pointRead(' + s + ', ' + g + ') is ' + JSON.stringify(r) + ', should be ' + ref);
            if (!ratEq(decRat(ref), [P, Math.pow(10, kp)])) fail(w + ': the reading ' + ref + ' is not ' + P + ' × ' + U[kp]);
            const right = ratEq(decRat(ref), [A * n, Math.pow(10, k)]);
            if (right !== (g === m - k)) fail(w + ': gap ' + g + ' gives ' + ref + (right ? ', which is right — but it is not the answer gap' : ''));
            vals.add(decRat(ref)[0] / decRat(ref)[1]);
            LANGS.forEach(L => {
              if (g === m - k) return;
              const t = I18N[L].gPointNo(pl.a, A, k, n, P, ref, kp);
              seq(w + ' gPointNo gap ' + g + ' ' + L, t, [ref, P, U[kp], pl.a, A, U[k], A, n, P, P, U[k], k]);
              if (moneyClaims(t).verified !== 3) fail(w + ' gPointNo ' + L + ': should verify "reading = P × unit", "a = A × unit" and "A × n = P"');
            });
          }
          if (vals.size !== m + 1) fail(w + ': two gaps read as the same value');
          LANGS.forEach(L => {
            /* 0.36：要說個位補 0；3.00、14.0：要說 3.00 = 3（最後面的 0 可以不寫）—— 驗證者抓到畫面上沒有交代 */
            const extra = (pl.prod.charAt(0) === '0' ? [0, pl.prod] : []).concat(pl.nat !== pl.prod ? [pl.prod, pl.nat] : []).concat(pl.nat !== pl.prod && L === 'zh' ? [0] : []);
            const tPD = I18N[L].gPointDone(pl.a, n, pl.prod, k, P, pl.nat);
            seq(w + ' gPointDone ' + L, tPD, [pl.a, n, pl.prod, pl.a, k, P, k].concat(extra));
            if (moneyClaims(tPD).verified !== (pl.nat !== pl.prod ? 2 : 1)) fail(w + ' gPointDone ' + L + ': should verify a × n = product' + (pl.nat !== pl.prod ? ' and ' + pl.prod + ' = ' + pl.nat : ''));
            seq(w + ' gPointMul ' + L, I18N[L].gPointMul(A, n, P), [A, n, P]);
            seq(w + ' gPoint2 ' + L, I18N[L].gPoint2(pl.a, k, P), [pl.a, k, P, k]);
          });
        });
        /* 版面（題庫允許的 1～4 位數全部）：數字與縫交錯、都在畫板裡；每個數字剛好在兩個縫的正中間 */
        for (let m = 1; m <= 4; m++){
          const items = [], w = 'POINT_G with ' + m + ' digits';
          for (let j = 0; j < m; j++) items.push(box(D.pointDigitX(j, m), G.digY + G.digH / 2, G.digW, G.digH));
          for (let g = 0; g <= m; g++) items.push(box(D.pointGapX(g, m), G.digY + G.digH / 2, G.gapW, G.digH));
          items.forEach((b, j) => inside(b, w + ': digit/gap ' + j, G.H));
          noHits(items, w + ': digits and gaps');
          for (let g = 0; g < m; g++) if (Math.abs((D.pointGapX(g, m) + D.pointGapX(g + 1, m)) / 2 - D.pointDigitX(g, m)) > 1e-9) fail(w + ': digit ' + g + ' is not halfway between its two gaps');
        }
        if (!(twoPlaces >= 3 && lead0 >= 1 && trail0 >= 2)) fail('GAME_POINT should mix 1 and 2 decimal places (≥ 3 with two), have a product that needs a leading 0 (0.36) and products ending in 0 (14.0)');
        tooSmall('the point card', G.piece);
        if (!(G.trayY - G.piece / 2 >= G.resY + G.resH && G.trayY + G.piece / 2 <= G.H)) fail('the point card overlaps the result line or leaves the board');
        need('point', /var s = dropTarget\(nearestAny\(gaps, pt, 0\), f \? nearestAny\(gaps, f, 0\) : null, function\(t\)\{ return t\.g === P0\.ans; \}\);/, 'the gap is not picked by the nearest-gap rule');
        need('point', /if \(s\.g !== P0\.ans\)\{\s*var r = pointRead\(P0\.digits, s\.g\);\s*roundMiss\(d\.gPointNo\(/, 'a point in the wrong gap is not refused with its reading');
        need('point', /hw:G\.gapW \/ 2 \+ G\.digW \/ 2/, 'a gap\'s snap zone does not reach halfway into the digits beside it');
      }

      /* ================= 第 4 關：平分 ================= */
      {
        const G = D.SHARE_G;
        D.GAME_SHARE.forEach((e, i) => {
          const [A, n] = e, w = 'GAME_SHARE[' + i + '] ' + fixRef(A, 1) + ' ÷ ' + n;
          if (!(A > 0 && A < 100 && n >= 2 && n <= 5)) return fail(w + ': out of range');
          if (A % n) return fail(w + ': the share does not come out in whole dimes');
          const Q = A / n, D0 = Math.floor(A / 10), T0 = A % 10;
          if (D0 % n === 0) fail(w + ': the dollars share out evenly — nothing to trade');
          if (Q % 10 > 6) fail(w + ': ' + (Q % 10) + ' dimes each is a long deal');
          /* 照規則玩：窮舉每一個狀態（剩幾個 1 元、幾個 0.1 元、每人拿到幾個）與每一步 —— 一定走得完，走完每人都是 Q 個 0.1 元；
             頁面的 shareStep() 每一步都和自己的規則一樣 */
          const seen = new Set(), stack = [[D0, T0, 0, 0]], endPlates = new Set();
          let ends = 0;
          while (stack.length){
            const [Dd, Tt, g0, g1] = stack.pop(), key = [Dd, Tt, g0, g1].join();
            if (seen.has(key)) continue; seen.add(key);
            if (Dd === 0 && Tt === 0){ ends++; endPlates.add(g0 + ',' + g1); if (g0 * 10 + g1 !== Q) fail(w + ': a way of playing gives each person ' + g0 + ' dollars ' + g1 + ' dimes, not ' + fixRef(Q, 1)); continue; }
            const ref = { D_people:Dd >= n ? 'give' : 'few', T_people:Tt >= n ? 'give' : 'few', D_bank:Dd >= n ? 'early' : 'swap', T_bank:'dime' };
            const moves = [];
            [['D', 'people'], ['T', 'people'], ['D', 'bank'], ['T', 'bank']].forEach(([wh, to]) => {
              if ((wh === 'D' ? Dd : Tt) === 0) return;   /* 空的那一疊拿不起來 */
              const r = D.shareStep(Dd, Tt, n, wh, to);
              if (r !== ref[wh + '_' + to]) fail(w + ': shareStep(' + Dd + ', ' + Tt + ', ' + n + ', ' + wh + ', ' + to + ') is ' + r + ', should be ' + ref[wh + '_' + to]);
              if (r === 'give') moves.push(wh === 'D' ? [Dd - n, Tt, g0 + 1, g1] : [Dd, Tt - n, g0, g1 + 1]);
              if (r === 'swap') moves.push([Dd - 1, Tt + 10, g0, g1]);
            });
            if (!moves.length) fail(w + ': stuck with ' + Dd + ' dollars and ' + Tt + ' dimes left');
            moves.forEach(m => stack.push(m));
          }
          if (!ends) fail(w + ': no way of playing finishes');
          LANGS.forEach(L => {
            const d = I18N[L], aS = fixRef(A, 1), q = fixRef(Q, 1);
            /* 過關那一句說的是每個盤子上真的有的錢：每一種走完的盤子（窮舉出來的）都拿去呼叫，句子裡的 1 元、0.1 元要和盤子一樣，
               而且「g0 個 1 元 + g1 個 0.1 元 = q 元」要算得對（驗證者抓到：舊句說「每人 13 個 0.1 元」，盤子上卻是 1 個 1 元＋3 個 0.1 元） */
            endPlates.forEach(pk => {
              const [g0, g1] = pk.split(',').map(Number), t = d.gShareDone(aS, n, q, A, Q, g0, g1);
              seq(w + ' gShareDone ' + L + ' (plates ' + pk + ')', t, L === 'zh' ? [aS, n, q, aS, A, '0.1', A, n, Q, g0, 1, g1, '0.1', q, Q, '0.1'] : [aS, n, q, aS, A, A, n, Q, g0, 1, g1, '0.1', q, Q]);
              if (moneyClaims(t).verified !== 4) fail(w + ' gShareDone ' + L + ': should verify 4 equalities (incl. the plate = q)');
            });
            if (endPlates.size !== 1) fail(w + ': the plates can end in ' + endPlates.size + ' different ways (' + [...endPlates].join(' | ') + ')');
            seq(w + ' gShareTop ' + L, d.gShareTop(aS, n), [aS, n]);
            seq(w + ' gShareLeft ' + L, d.gShareLeft(D0, T0), [D0, '1', T0, '0.1']);
          });
          /* 人排得下：n 個盤子在畫板裡、不重疊 */
          const plates = []; for (let j = 0; j < n; j++) plates.push(box(D.sharePlateX(j, n), G.plateY + G.plateH / 2, G.plateW, G.plateH));
          plates.forEach((p, j) => { if (!(p.x >= 4 && p.x + p.w <= W - 4)) fail(w + ': plate ' + j + ' is outside the people box'); });
          noHits(plates, w + ' plates');
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          seq('gShareFew D ' + L, d.gShareFew(1, 3, 'D', 1), L === 'zh' ? [1, 1, 3, 10, '0.1'] : [1, 1, 3, 10]);
          if (L === 'en'){ says('gShareFew D en, one left', d.gShareFew(1, 3, 'D', 1), ['Drag it '], ['Drag one ']); says('gShareFew D en, two left', d.gShareFew(2, 4, 'D', 2), ['Drag one '], ['Drag it ']); }
          seq('gShareFew T ' + L, d.gShareFew(2, 3, 'T', 1), L === 'zh' ? [2, '0.1', 3, 1, 10, '0.1'] : [2, 3]);
          /* 還夠每人一個 1 元時，0.1 元不夠發 —— 下一步是先發 1 元，不是去換錢（換錢在那時只是提醒） */
          seq('gShareFew T, dollars still enough ' + L, d.gShareFew(2, 3, 'T', 7), L === 'zh' ? [2, '0.1', 3, 1] : [2, 3]);
          says('gShareFew T, dollars still enough ' + L, d.gShareFew(2, 3, 'T', 7), [L === 'zh' ? '先發 1 元' : 'Hand out the dollars first'], [L === 'zh' ? '換成' : 'Trade']);
          seq('gShareEarly ' + L, d.gShareEarly(4, 3), L === 'zh' ? [4, 1, 3, 1] : [4, 3]);
          seq('gShareSwap ' + L, d.gShareSwap, [1, 10, '0.1']);
          seq('gShareGive D ' + L, d.gShareGive(3, 'D'), L === 'zh' ? [3, 1, 1] : [3, 1]);
          seq('gShareGive T ' + L, d.gShareGive(3, 'T'), L === 'zh' ? [3, 1, '0.1'] : [3]);
          says('gShareGive T ' + L, d.gShareGive(3, 'T'), [L === 'zh' ? '0.1 元' : 'dime'], [L === 'zh' ? '個 1 元' : '$1']);
          seq('gShare2D ' + L, d.gShare2D(7, 3), L === 'zh' ? [7, 1, 3] : [7, 3]);
          seq('gShare2Swap ' + L, d.gShare2Swap(1, 3), L === 'zh' ? [1, 1, 3] : [1, 3]);
          says('gShare2Swap ' + L, d.gShare2Swap(1, 3), [L === 'zh' ? '換錢機' : 'change machine']);
          seq('gShare2T ' + L, d.gShare2T(6, 3), L === 'zh' ? [6, '0.1', 3] : [6, 3]);
          if (moneyClaims(d.gShareSwap).verified !== 1) fail('gShareSwap ' + L + ' should verify 1 = 10 × 0.1');
        });
        const people = { x:2, y:G.plateY - 4, w:W - 4, h:G.peopleH }, bank = { x:G.bankX, y:G.bankY, w:G.bankW, h:G.bankH };
        inside(people, 'the people box', G.H); inside(bank, 'the change machine', G.H);
        if (hit(people, bank)) fail('the people box and the change machine overlap');
        if (!(G.plateY - 4 >= G.topH)) fail('the people box covers the line above it');
        const piles = [0, 1].map(i => box(G.pileX[i], G.pileY, G.pileW, G.pileH));
        piles.forEach((p, i) => { inside(p, 'pile ' + i, G.H); if (hit(p, people) || hit(p, bank)) fail('pile ' + i + ' sits on a drop target'); });
        noHits(piles, 'piles');
        tooSmall('a pile', Math.min(G.pileW, G.pileH));
        need('share', /var step = shareStep\(D, T, n, w, tgt\.bank \? 'bank' : 'people'\);/, 'the move is not judged by shareStep()');
        need('share', /if \(step === 'few'\)\{ roundMiss\(/, 'handing out when there is not one for everyone is not refused as a mistake');
        need('share', /if \(step === 'early'\)\{ roundNote\(/, 'trading while there is enough to hand out is not a reminder');
        need('share', /if \(step === 'swap'\)\{ D -= 1; T \+= 10;/, 'a trade does not take 1 dollar and give 10 dimes');
        need('share', /if \(w === 'D'\)\{ D -= n; got\[0\]\+\+; \} else \{ T -= n; got\[1\]\+\+; \}/, 'handing out does not give one to each of the n people');
        need('share', /if \(D === 0 && T === 0\)\{/, 'the round does not end exactly when everything is handed out');
        /* 第二層提示照下一步該做的事選：還夠發就發 1 元、不夠就換、沒有 1 元了才發 0.1 元（和上面窮舉的規則同一個順序） */
        need('share', /if \(D >= n\) return d\.gShare2D\(D, n\);\s*if \(D > 0\) return d\.gShare2Swap\(D, n\);\s*return d\.gShare2T\(T, n\);/, 'the second-level hint does not follow give dollars → trade → give dimes');
        need('swap', /if \(inTill < P0\.n\) return d\.gSwap2Tags\(P0\.n - inTill\);\s*return T >= 10 \? d\.gSwap2Full\(T\) : d\.gSwap2Done;/, 'the second-level hint does not follow tags → full rows → done');
        need('swap', /if \(B\.selected && frames\.indexOf\(B\.selected\) >= 0\) B\.selected = null;\s*frames\.forEach\(function\(f\)\{ f\.el\.remove\(\); \}\);/, 'a selected dime row that is redrawn stays selected (stale row, codex round 1)');
      }

      /* ================= 第 5 關：分數變小數 ================= */
      {
        const G = D.FRAC_G;
        D.GAME_FRAC.forEach((e, i) => {
          const [a, b] = e, w = 'GAME_FRAC[' + i + '] ' + a + '/' + b;
          if ([2, 4, 5, 10, 20].indexOf(b) < 0 || !(a >= 1 && a < b)) return fail(w + ': b should be 2, 4, 5, 10 or 20 and a proper fraction');
          /* 每一份都是 100 / b 格的長方形，剛好鋪滿 */
          const cells = {};
          for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++){ const p = D.fracPart(b, r, c); if (!(p >= 0 && p < b)) return fail(w + ': fracPart(' + r + ', ' + c + ') is ' + p); (cells[p] = cells[p] || []).push([r, c]); }
          for (let p = 0; p < b; p++){
            const cs = cells[p] || [];
            if (cs.length !== 100 / b) { fail(w + ': part ' + p + ' has ' + cs.length + ' squares, not ' + 100 / b); continue; }
            const rs = cs.map(x => x[0]), ccs = cs.map(x => x[1]), h = Math.max(...rs) - Math.min(...rs) + 1, wd = Math.max(...ccs) - Math.min(...ccs) + 1;
            if (h * wd !== cs.length) fail(w + ': part ' + p + ' is not a rectangle');
          }
          const cents = a * 100 / b, dec = natRef(cents, 2);
          /* 照規則判：0～2.999 的每一個打法（整數部分 0～2，小數 0～3 位）—— 只有值等於 a/b 的收；分子分母直接寫成小數的那兩種有自己的一句 */
          let okCount = 0;
          for (let x = 0; x <= 2; x++) for (let pl = 0; pl <= 3; pl++) for (let f = 0; f < Math.pow(10, pl); f++){
            const s = pl ? x + '.' + String(f).padStart(pl, '0') : String(x), j = D.fracJudge(a, b, s), v = decRat(s);
            const right = ratEq(v, [a, b]);
            const kind = right ? 'ok' : ((s === a + '.' + b || s === '0.' + a + '' + b) ? 'digits' : (v[0] * b > a * v[1] ? 'big' : 'small'));
            if (j.kind !== kind){ fail(w + ': fracJudge("' + s + '") is ' + j.kind + ', should be ' + kind); x = 9; break; }
            if (j.milli !== Math.round(v[0] * 1000 / v[1])){ fail(w + ': fracJudge("' + s + '") reads ' + j.milli + ' thousandths'); x = 9; break; }
            if (right) okCount++;
          }
          if (!okCount) fail(w + ': no way to type ' + dec + ' is accepted');
          ['', '.5', '1/2', '0.5.', ' 0. 5', '00.5', '0,5', '1e-1', '-0.5', '５', '0.5 元'].forEach(s => { if (D.fracJudge(a, b, s).kind !== 'int') fail(w + ': fracJudge("' + s + '") should only be a reminder'); });
          /* 超過三位小數：自己的一句提醒（「請打一個小數」對 0.1234 是假話 —— codex 第一輪） */
          ['0.0005', '0.2500', '1.23456'].forEach(s => { if (D.fracJudge(a, b, s).kind !== 'long') fail(w + ': fracJudge("' + s + '") should be the "at most three decimal places" reminder'); });
          ['12345678', '1000000', '9999999.5'].forEach(s => { if (D.fracJudge(a, b, s).kind !== 'huge') fail(w + ': fracJudge("' + s + '") should be "far more than $1" (too long to count exactly)'); });
          ['999999.999', '1000', '25', '1234.5'].forEach(s => { const k = D.fracJudge(a, b, s).kind; if (k !== 'big') fail(w + ': fracJudge("' + s + '") is ' + k + ' — a plain number that is too big should be "too much", not a reminder'); });
          if (D.fracJudge(a, b, ' ' + dec + ' ').kind !== 'ok') fail(w + ': spaces around ' + dec + ' are not accepted');
          LANGS.forEach(L => {
            const d = I18N[L], t = d.gFracDone(a, b, 100 / b, cents, dec);
            seq(w + ' gFracDone ' + L, t, L === 'zh' ? [1, b, 100, '0.01', b, 100 / b, '0.01', a, cents, '0.01', dec] : [1, b, 100, b, 100 / b, a, cents, dec]);
            if (moneyClaims(t).verified !== 2) fail(w + ' gFracDone ' + L + ': should verify 2 equalities');
            seq(w + ' gFracNow ' + L, d.gFracNow(a, b), [1, b, a, a, b]);
            seq(w + ' gFrac2 ' + L, d.gFrac2(b, 100 / b), L === 'zh' ? [b, 100 / b, 100 / b, '0.01'] : [b, 100 / b, 100 / b]);
            const dg = a + '.' + b;
            if (!ratEq(decRat(dg), [a, b])) seq(w + ' gFracDigits ' + L, d.gFracDigits(a, b, dg), L === 'zh' ? [dg, a, b, '0.01'] : [dg, a, b]);
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          [['0.3', 300, true], ['0.07', 70, false], ['0.255', 255, true], ['1', 1000, true]].forEach(([s, mi, big]) => {
            const t = d.gFracOff(s, mi, big);
            seq('gFracOff ' + L + ' ' + s, t, mi % 10 ? [s, mi, '0.001'] : [s, mi / 10, '0.01']);
            if (moneyClaims(t).verified !== 1) fail('gFracOff ' + L + ' ' + s + ': should verify the amount');
            says('gFracOff ' + L + ' ' + s, t, [L === 'zh' ? (big ? '多' : '少') : (big ? 'more' : 'less')], [L === 'zh' ? (big ? '少' : '多') : (big ? 'less' : 'more')]);
          });
        });
        const grid = { x:G.gridX, y:G.gridY, w:G.cell * 10, h:G.cell * 10 };
        inside(grid, 'the 100-square grid', G.H);
        const row = [{ x:G.inX, y:G.inY, w:G.inW, h:G.inH }, { x:G.unitX, y:G.inY, w:G.unitW, h:G.inH }, { x:G.okX, y:G.inY, w:G.okW, h:G.inH }];
        row.forEach((r, j) => { inside(r, 'input row item ' + j, G.H); if (hit(r, grid)) fail('input row item ' + j + ' covers the grid'); });
        noHits(row, 'input row');
        tooSmall('the answer box / button', G.inH);
        need('frac', /if \(j\.kind === 'int'\)\{ roundNote\(d\.gFracInt\); return; \}/, 'a badly written number is not just a reminder');
        need('frac', /if \(j\.kind === 'huge'\)\{ roundMiss\(d\.gFracHuge\); return; \}/, 'a huge number is not refused');
        LANGS.forEach(L => says('gFracHuge ' + L, I18N[L].gFracHuge, [L === 'zh' ? '多' : 'more']));
        need('frac', /if \(j\.kind === 'long'\)\{ roundNote\(d\.gFracLong\); return; \}/, 'more than three decimal places is not just a reminder');
        LANGS.forEach(L => seq('gFracLong ' + L, I18N[L].gFracLong, ['0.01']));
        need('frac', /if \(j\.kind === 'digits'\)\{ roundMiss\(d\.gFracDigits\(a, b, s\)\); return; \}/, 'writing the top and bottom as digits is not refused with its own reason');
        need('frac', /roundMiss\(d\.gFracOff\(s, j\.milli, j\.kind === 'big'\)\);/, 'a wrong amount is not refused');
        need('frac', /cell\.className = 'gcell' \+ \(fracPart\(b, r, c\) < a \? ' gon' : ''\);/, 'the shaded squares are not the first a parts');
      }
    }
  }
};
const EXPECTED_STATIC_EQ = 82;
module.exports._moneyNorm = moneyNorm;
