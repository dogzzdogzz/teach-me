/* grade-5/math/fraction-add 的檢查設定（通分披薩屋：擴分、約分、通分、異分母分數加減）。
   2026-10-10 新增 —— 和小遊戲「披薩配對」改成五關五種玩法（§六之五）同一次寫成。在那之前這一課沒有設定檔，
   simgen／verify_lesson_data 對它一律直接報錯（沒有設定的課不算驗過）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，分數用自己的約分），
   選項一律是「分子、分母都 ≥ 1 的分數」或範圍內的整數。第一次跑抓到三類舊缺陷，都在 review.html 修掉：
   ① subUnlike 的「分子減分子、分母減分母」在 a ＝ c 時變成 0/2、0/3；② 保底「分子 ＋ 1」剛好等於分母，端出 6/6、2/2（就是 1）；
   ③ commonDenom／lcmSimple 把題幹的數字（比較小的分母、分子 1）當誘答。刻意的迷思誘答只留「直接用比較大的那個數」，
   兩邊各自獨立地說出來：review.html 的 avoidExcept() 與這裡的 stemEchoOk（只放行那一個值）。
   renderCheck 把每一題渲染出來的解釋裡的分數算式逐條重算（fracClaims）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的分數算式逐條重算（fracClaims；掃描器自己先跑 CLAIM_PROBES）。
   - 範例 3 的 STEPS 用自己的算法重算。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     五關各自**照遊戲的規則把每一題從頭玩一遍**：一樣大嗎的每一張卡 × 每一個籃子、約分的每一種 ÷ 順序、
     重新切的每一個 n、加法的每一格 × 每一張卡、減法的每一組 x/y（1～40）—— 證明每一題都解得完、只有對的會收、
     每一句說明的數字照順序對、句子裡的算式算得對。頁面的純函式（sameKind／sameK／simpBad／smallestCommon／cutX／cutValue／
     cutAligned／addPlan／addCards／addWhy／subPlan／subJudge／dropTarget）一律拿整個題庫去呼叫再和自己的算法比；
     shuffle()、nearestAny()／nearestOpen()、roundMiss() 從原始碼切出來真的跑；只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。
     版面與 375px 觸控 ≥ 44px 從資料區讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、文字放不放得下、375px 的實際尺寸由 HDIR 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { extractFunction } = require('./lib/gameshuffle.js');

function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }
function lcmRef(a, b){ return a * b / gcdRef(a, b); }
function fracRef(n, d){ const g = gcdRef(n, d); return (n / g) + '/' + (d / g); }
function valOf(s){ const m = /^(\d+)\/(\d+)$/.exec(String(s)); return m ? +m[1] / +m[2] : NaN; }
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }

/* ---------- 分數算式掃描器：把一段文字裡所有「項 (運算 項)* ＝ 項 (運算 項)* …」找出來，兩邊用有理數重算 ----------
   項是整數或 a/b；運算 ＋ − × ÷（× ÷ 先算）。題目式（等號旁邊是 ? ？ □）不是宣稱，算成 question。
   ⚠️ fail closed：一個左邊收在數字的等號沒有被任何一條算式吃掉（例如寫成「＝ 5 分之 6」），就回報，不靜靜跳過。 */
const TERM = '\\d+(?:\\s*/\\s*\\d+)?';
const OP = '\\s*[+＋−\\-×÷]\\s*';
const SIDE = TERM + '(?:' + OP + TERM + ')*';
/* 前後不可以緊接著數字或斜線；小數點只有在後面接數字時才算（句尾的句點不算） */
const CHAIN_RE = new RegExp('(?<![\\d/]|\\d\\.)' + SIDE + '(?:\\s*[=＝]\\s*' + SIDE + ')+(?![\\d/]|\\.\\d)', 'g');
function rat(n, d){ if (d === 0) return null; const g = gcdRef(Math.abs(n), Math.abs(d)) || 1; return [n / g * Math.sign(d), Math.abs(d) / g]; }
function evalSide(s){
  const toks = s.replace(/\s+/g, '').replace(/＋/g, '+').replace(/−/g, '-').match(/\d+\/\d+|\d+|[+\-×÷]/g) || [];
  if (toks.join('') !== s.replace(/\s+/g, '').replace(/＋/g, '+').replace(/−/g, '-')) return null;
  const val = t => { const m = /^(\d+)\/(\d+)$/.exec(t); return m ? rat(+m[1], +m[2]) : (/^\d+$/.test(t) ? [+t, 1] : null); };
  const terms = []; let cur = val(toks[0]), sign = 1;
  if (!cur) return null;
  for (let i = 1; i < toks.length; i += 2){
    const op = toks[i], v = val(toks[i + 1]);
    if (!v) return null;
    if (op === '×') cur = rat(cur[0] * v[0], cur[1] * v[1]);
    else if (op === '÷') cur = v[0] === 0 ? null : rat(cur[0] * v[1], cur[1] * v[0]);
    else { terms.push([sign * cur[0], cur[1]]); sign = op === '+' ? 1 : -1; cur = v; }
    if (!cur) return null;
  }
  terms.push([sign * cur[0], cur[1]]);
  return terms.reduce((x, y) => rat(x[0] * y[1] + y[0] * x[1], x[1] * y[1]), [0, 1]);
}
function fracClaims(text){
  const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const problems = [];
  let verified = 0, questions = 0;
  const rest = plain.replace(CHAIN_RE, whole => {
    const sides = whole.split(/[=＝]/);
    const vals = sides.map(evalSide);
    if (vals.some(v => v === null)){ problems.push('cannot evaluate "' + whole.trim() + '"'); return ' Q '; }
    for (let k = 1; k < vals.length; k++){
      verified++;
      if (vals[k][0] !== vals[k - 1][0] || vals[k][1] !== vals[k - 1][1]) problems.push('this claim is wrong: "' + whole.trim() + '"');
    }
    return ' Q ';
  });
  /* 題目式：「a/b + c/d = ?」—— 左邊有數、右邊是問號 */
  const q = rest.match(/[\d)]\s*[=＝]\s*[?？□]/g);
  if (q) questions += q.length;
  const left = rest.replace(/[\d)]\s*[=＝]\s*[?？□]/g, ' ').match(/\d\s*[=＝]/);
  if (left) problems.push('an equals sign with a number on its left was not verified: "' + left[0] + '"');
  return { problems, verified, questions };
}
const CLAIM_PROBES = [
  { text:'1/2 = 3/6，1/3 = 2/6，3/6 + 2/6 = 5/6。', bad:false, n:3 },
  { text:'5/6 − 1/3 = 5/6 − 2/6 = 3/6', bad:false, n:2 },
  { text:'通分成 12：3/4 = 9/12，1/6 = 2/12，所以是 9/12 − 2/12 = 7/12。', bad:false, n:3 },
  { text:'分母 6 × 2 = 12，分子 1 也要乘 2', bad:false, n:1 },
  { text:'18 ÷ 6 = 3', bad:false, n:1 },
  { text:'1/2 + 1/5 = 5/10 + 2/10 = 7/10 公升', bad:false, n:2 },
  { text:'10/15 &gt; 9/15，所以 2/3 比較大', bad:false, n:0 },
  { text:'1/2 + 1/3 = ?', bad:false, n:0 },
  { text:'1/2 = 3/6 and 1/3 = 2/6, so 3/6 + 2/6 = 5/6.', bad:false, n:3 },
  { text:'1/2 + 1/3 = 2/5', bad:true },
  { text:'So 3/6 + 2/6 = 5/12.', bad:true },
  { text:'3/6 + 2/6 = 5/12', bad:true },
  { text:'3/4 = 8/12', bad:true },
  { text:'5/6 − 1/3 = 5/6 − 2/6 = 1/6', bad:true },
  { text:'分母 6 × 2 = 13', bad:true },
  { text:'1/2 = 2/4 = 3/5', bad:true },
  { text:'3/6 + 2/6 = 5 分之 6', bad:true }
];

module.exports = {
  breaks: [
    /* ---- index.html：靜態字串與範例 3 ---- */
    { file:'index', expect:'this claim is wrong', find:"why:'1/2 = 3/6，1/3 = 2/6，3/6 + 2/6 = 5/6。分母不同時", replace:"why:'1/2 = 3/6，1/3 = 2/6，3/6 + 2/6 = 5/12。分母不同時" },
    { file:'index', expect:'expected 32', find:"why:'1/2 + 1/5 通分成 10：5/10 + 2/10 = 7/10 公升", replace:"why:'1/2 + 1/5 通分成 10：5/10 加 2/10 得 7/10 公升" },
    { file:'index', expect:'STEPS.sub does not add up', find:'kaNum:9, kbNum:2, resNum:7, resDen:12', replace:'kaNum:9, kbNum:2, resNum:8, resDen:12' },

    /* ---- index.html：小遊戲的共用部分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['same', 'simp', 'cut', 'add', 'sub'];", replace:"var GAME_ORDER = ['simp', 'same', 'cut', 'add', 'sub'];" },
    { file:'index', expect:'in its original order', find:'    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }', replace:'' },
    { file:'index', expect:'the cards are not laid out through shuffle()', find:'      shuffle(e.cards.map(function(c, i){ return i; })).forEach(function(ci, i){', replace:'      e.cards.map(function(c, i){ return i; }).forEach(function(ci, i){' },
    { file:'index', expect:'the number cards are not laid out through shuffle()', find:'      shuffle(addCards(P0)).forEach(function(v, i){', replace:'      addCards(P0).forEach(function(v, i){' },
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

    /* 第 1 關：一樣大嗎 */
    { file:'index', expect:'should be three equal ones then add, den, mix', find:'{ a:2, b:3, cards:[[4, 6], [6, 9],', replace:'{ a:2, b:3, cards:[[4, 7], [6, 9],' },
    { file:'index', expect:'two cards are the same', find:'{ a:1, b:2, cards:[[2, 4], [3, 6], [5, 10],', replace:'{ a:1, b:2, cards:[[2, 4], [3, 6], [2, 4],' },
    { file:'index', expect:'are the same value', find:'[2, 4], [1, 6], [2, 9]] }', replace:'[2, 4], [1, 6], [3, 6]] }' },
    { file:'index', expect:'sameKind() says', find:"    if (n > a && n - a === d - b) return 'add';", replace:"    if (n > a && n - a === d - b) return 'mix';" },
    { file:'index', expect:'sameK() for', find:"    if (kind === 'add') return [n - a];", replace:"    if (kind === 'add') return [n];" },
    { file:'index', expect:'gSameWhyNe zh', find:"'分子、分母同「加」' + k1 + ' 不是擴分，大小變了'", replace:"'分子、分母同「加」' + (k1 + 1) + ' 不是擴分，大小變了'" },
    { file:'index', expect:'should say "same number"', find:"the bottom by ' + k2 + ' — they must use the same number';", replace:"the bottom by ' + k2 + ' — they can use any numbers';" },
    { file:'index', expect:'should say "同除"', find:"return n + '/' + d + ' 的分子、分母同除 ' + k + ' 就是 '", replace:"return n + '/' + d + ' 的分子、分母同乘 ' + k + ' 就是 '" },
    { file:'index', expect:'gSameBins.ne en', find:"ne:'not the same size as ' + a + '/' + b };", replace:"ne:'the same size as ' + a + '/' + b };" },
    { file:'index', expect:'gSameOkNe en', find:"return 'With a denominator of ' + L + ': ' + a + '/' + b + ' = ' + x + '/' + L + ' and ' + n + '/' + d + ' = ' + y + '/' + L + ' — not the same size.'; },", replace:"return 'With a denominator of ' + L + ': ' + a + '/' + b + ' = ' + (x + 1) + '/' + L + ' and ' + n + '/' + d + ' = ' + y + '/' + L + ' — not the same size.'; }," },
    { file:'index', expect:'gSame2 zh', find:"' ÷ ' + b + ' = ' + k1 + ' —— 分子、分母乘的數一樣。'", replace:"' ÷ ' + b + ' = ' + (k1 + 1) + ' —— 分子、分母乘的數一樣。'" },
    { file:'index', expect:'a card in the wrong basket is not refused', find:"          roundMiss(c.bin === 'eq' ? d.gSameWhyEq(", replace:"          roundInfo(c.bin === 'eq' ? d.gSameWhyEq(" },
    { file:'index', expect:'convert both to the LCM', find:'        var L = lcm(b, c.d), x = a * L / b, y = c.n * L / c.d;', replace:'        var L = b * c.d, x = a * L / b, y = c.n * L / c.d;' },
    { file:'index', expect:'two lines of English need at least 40', find:'binH:208, lblH:44, cardW:84, cardH:48,', replace:'binH:208, lblH:30, cardW:84, cardH:48,' },
    { file:'index', expect:'baskets 0 and 1 overlap', find:'var SAME_G = { binX:[4, 152],', replace:'var SAME_G = { binX:[4, 140],' },
    { file:'index', expect:'sits inside a basket\'s drop zone', find:'trayX:[52, 150, 248], trayY:[248, 304],', replace:'trayX:[52, 150, 248], trayY:[236, 292],' },
    { file:'index', expect:'a fraction card (84×44) is', find:'binH:208, lblH:44, cardW:84, cardH:48,', replace:'binH:208, lblH:44, cardW:84, cardH:44,' },

    /* 第 2 關：約分 */
    { file:'index', expect:'simpBad(', find:"  function simpBad(n, d, k){ return n % k !== 0 ? 'n' : (d % k !== 0 ? 'd' : null); }", replace:"  function simpBad(n, d, k){ return n % k !== 0 ? 'n' : null; }" },
    { file:'index', expect:'get stuck with a common factor', find:'var GAME_SIMP = [[12, 18],', replace:'var GAME_SIMP = [[14, 21],' },
    { file:'index', expect:'already in simplest form — nothing to simplify', find:'[6, 24], [9, 12]];', replace:'[6, 24], [9, 10]];' },
    { file:'index', expect:'a ÷ card that does not divide both is not refused', find:'        if (bad){ roundMiss(d.gSimpNo(n, dd, k, bad)); return false; }', replace:'        if (false){ roundMiss(d.gSimpNo(n, dd, k, bad)); return false; }' },
    { file:'index', expect:'smallestCommon(', find:'for (var p = 2; p <= Math.min(n, d); p++) if (n % p === 0 && d % p === 0) return p; return 0; }', replace:'for (var p = 2; p <= Math.min(n, d); p++) if (n % p === 0) return p; return 0; }' },
    { file:'index', expect:'"fully simplified" is accepted while a common factor is left', find:'        if (p){ roundMiss(d.gSimpMore(n, dd, p)); return; }', replace:'        if (false){ roundMiss(d.gSimpMore(n, dd, p)); return; }' },
    { file:'index', expect:'gSimpNo en', find:"(which === 'n' ? 'The top, ' + n + ',' : 'The bottom, ' + d + ',')", replace:"(which === 'n' ? 'The top, ' + d + ',' : 'The bottom, ' + d + ',')" },
    { file:'index', expect:'gSimpDone zh', find:"return n0 + '/' + d0 + ' 約分到最簡是 ' + n + '/' + d", replace:"return n0 + '/' + d0 + ' 約分到最簡是 ' + n0 + '/' + d" },
    { file:'index', expect:'should both sit inside the drop zone', find:'barX:10, barY:54, barW:280, barH:44, zoneH:104,', replace:'barX:10, barY:54, barW:280, barH:44, zoneH:90,' },
    { file:'index', expect:'sits inside the drop zone', find:'keyX:[34, 92, 150, 208, 266], keyY:184,', replace:'keyX:[34, 92, 150, 208, 266], keyY:130,' },
    { file:'index', expect:'a used ÷ card does not go back', find:'        draw(); refreshHint();\n        backHome(B, P);', replace:'        draw(); refreshHint();' },
    { file:'index', expect:'the bar is not redrawn', find:"        drawBar(bar, G.barW, G.barH, dd, n, 'gon');", replace:"        drawBar(bar, G.barW, G.barH, d0, n0, 'gon');" },

    /* 第 3 關：重新切 */
    { file:'index', expect:'is beyond the slider', find:'[1, 6, 4, 9], [3, 8, 5, 12], [1, 4, 1, 2]];', replace:'[1, 6, 4, 9], [3, 8, 5, 14], [1, 4, 1, 2]];' },
    { file:'index', expect:'cutAligned(', find:'  function cutAligned(b, i, n){ return (i * n) % b === 0; }', replace:'  function cutAligned(b, i, n){ return (i * n) % b <= 1; }' },
    { file:'index', expect:'pick a mark other than the nearest one', find:'    var n = CUT_MIN + Math.round((x - CUT_G.trackX0) / step);', replace:'    var n = CUT_MIN + Math.floor((x - CUT_G.trackX0) / step);' },
    { file:'index', expect:'the cut is not judged', find:'        if (n !== L){ roundMiss(d.gCutBig(n, b, dd)); return; }', replace:'' },
    { file:'index', expect:'the cut is not judged', find:'        if (nb && nd){ roundMiss(d.gCutNot2(n, b, dd)); return; }', replace:'' },
    { file:'index', expect:'CUT_MIN should be 1', find:'  var CUT_MIN = 1, CUT_MAX = 24;', replace:'  var CUT_MIN = 2, CUT_MAX = 24;' },
    { file:'index', expect:'gCutBig zh', find:"return n + ' 是 ' + b + ' 和 ' + d + ' 的公倍數，切痕都對得上", replace:"return (n + 1) + ' 是 ' + b + ' 和 ' + d + ' 的公倍數，切痕都對得上" },
    { file:'index', expect:'gCutNot2 en', find:"n + ' is not a multiple of ' + b + ' or of ' + d + '.'; },", replace:"(n + 1) + ' is not a multiple of ' + b + ' or of ' + d + '.'; }," },
    { file:'index', expect:'gMults zh', find:"return b + ' 的倍數：' + mb.join('、')", replace:"return b + ' 的倍數：' + mb.slice(1).join('、')" },
    { file:'index', expect:'the slider knob is', find:'trackY:166, trackH:48, knob:48,', replace:'trackY:166, trackH:48, knob:40,' },
    { file:'index', expect:'cut pieces', find:'trackY:166, trackH:48, knob:48,', replace:'trackY:150, trackH:48, knob:48,' },
    { file:'index', expect:'can move the slider', find:'        if (!e.isPrimary || pid !== null || gSolved || gen !== gGen) return;', replace:'        if (pid !== null || gSolved || gen !== gGen) return;' },
    { file:'index', expect:'no lostpointercapture safety on the slider', find:"      track.addEventListener('lostpointercapture', stop);", replace:'' },
    { file:'index', expect:'the slider does not start uncut', find:'      set(CUT_MIN);', replace:'      set(L);' },
    { file:'index', expect:'the picture does not decide the answer', find:'  function cutAligned(b, i, n){ return (i * n) % b === 0; }', replace:'  function cutAligned(b, i, n){ return n >= b || (i * n) % b === 0; }' },

    /* 第 4 關：加法 */
    { file:'index', expect:'addPlan() is', find:'var a = e[0], b = e[1], c = e[2], d = e[3], L = lcm(b, d), ka = a * L / b, kc = c * L / d, s = ka + kc, g = gcd(s, L);', replace:'var a = e[0], b = e[1], c = e[2], d = e[3], L = b * d, ka = a * L / b, kc = c * L / d, s = ka + kc, g = gcd(s, L);' },
    { file:'index', expect:'the mistake card', find:'    [P.b + P.d, P.a + P.c, P.b * P.d].forEach(', replace:'    [P.b + P.d, P.b * P.d].forEach(' },
    { file:'index', expect:'should be gAddDenSum(', find:'      if (v === P.b + P.d) return D.gAddDenSum(P.b, P.d, v);\n', replace:'' },
    { file:'index', expect:'should be gAddNumKeep(', find:'      return v === top ? D.gAddNumKeep(', replace:'      return v === bot ? D.gAddNumKeep(' },
    { file:'index', expect:'should be gAddSumRaw(', find:"    if (slot === 'sn') return v === P.a + P.c ? D.gAddSumRaw(", replace:"    if (slot === 'sn') return false ? D.gAddSumRaw(" },
    { file:'index', expect:'should be gAddSumDen2(', find:"    if (slot === 'sd') return v === 2 * P.L ? D.gAddSumDen2(P.L)", replace:"    if (slot === 'sd') return v === 3 * P.L ? D.gAddSumDen2(P.L)" },
    { file:'index', expect:'should be gAddSimpNot(', find:"    if ((slot === 'pn' && v === P.s) || (slot === 'pd' && v === P.L))", replace:"    if ((slot === 'pn' && v === P.L) || (slot === 'pd' && v === P.L))" },
    { file:'index', expect:'should be gAddDenBig(', find:'      if (v % P.b === 0 && v % P.d === 0) return D.gAddDenBig(v, P.b, P.d);', replace:'' },
    { file:'index', expect:'a wrong card is not refused with addWhy()', find:'        if (v !== P0.want[s.slot]){ roundMiss(addWhy(d, P0, s.slot, v)); return false; }', replace:'        if (v !== P0.want[s.slot]){ roundNote(addWhy(d, P0, s.slot, v)); return false; }' },
    { file:'index', expect:'the simplify row is not drawn exactly when', find:'      var row2 = P0.want.pn !== undefined;', replace:'      var row2 = true;' },
    { file:'index', expect:'the sum is not less than 1', find:'[1, 4, 2, 3], [2, 5, 1, 3],', replace:'[3, 4, 2, 3], [2, 5, 1, 3],' },
    { file:'index', expect:'the top and bottom boxes of a fraction should be apart', find:'slotY:{ n1:52, d1:108, n2:52, d2:108,', replace:'slotY:{ n1:52, d1:96, n2:52, d2:108,' },
    { file:'index', expect:'sits in the drop zone of box', find:'trayX:[34, 92, 150, 208, 266], trayY:[304, 358], H:388 };', replace:'trayX:[34, 92, 150, 208, 266], trayY:[290, 344], H:388 };' },
    { file:'index', expect:'gAddNum zh', find:"return a + '/' + b + ' 要換成 ' + L + ' 分之幾：分母 ' + b + ' × ' + m + ' = ' + L", replace:"return a + '/' + b + ' 要換成 ' + L + ' 分之幾：分母 ' + b + ' × ' + m + ' = ' + (L + 1)" },
    { file:'index', expect:'gAddDenSum en', find:"return 'Denominators are not added (' + b + ' + ' + d + ' = ' + v + ')", replace:"return 'Denominators are not added (' + b + ' + ' + d + ' = ' + (v + 1) + ')" },
    { file:'index', expect:'should say "最簡"', find:"'，' + s + '/' + L + ' 已經是最簡分數。');", replace:"'，' + s + '/' + L + ' 已經約好了。');" },
    { file:'index', expect:'a number card is', find:'cardW:52, cardH:48, trayX:[34, 92, 150, 208, 266], trayY:[304, 358]', replace:'cardW:52, cardH:44, trayX:[34, 92, 150, 208, 266], trayY:[304, 358]' },
    { file:'index', expect:'must not give away', find:"return v + ' 也是 ' + b + ' 和 ' + d + ' 的公倍數，可是還有更小的 —— 這一關用最小公倍數當分母。'; },", replace:"return v + ' 也是 ' + b + ' 和 ' + d + ' 的公倍數，可是還有更小的 ' + (v / gcd(v / b, v / d)) + ' —— 這一關用最小公倍數當分母。'; }," },

    /* 第 5 關：減法 */
    { file:'index', expect:'subJudge(', find:"    if (P.b !== P.d && x === P.a - P.c && y === Math.abs(P.b - P.d)) return 'both';\n", replace:'' },
    { file:'index', expect:'subJudge(', find:"    if (x * P.q === y * P.p) return gcd(x, y) === 1 ? 'ok' : 'simp';", replace:"    if (x * P.q === y * P.p) return 'ok';" },
    { file:'index', expect:'is not a reminder', find:"        else if (j === 'simp') roundNote(d.gSubSimp(", replace:"        else if (j === 'simp') roundMiss(d.gSubSimp(" },
    { file:'index', expect:'readInt() does not accept only plain whole numbers', find:"      function readInt(s){ s = String(s).trim(); return /^(0|[1-9]\\d{0,2})$/.test(s) ? +s : null; }", replace:"      function readInt(s){ s = String(s).replace(/\\s+/g, ''); return /^\\d{1,3}$/.test(s) ? +s : null; }" },
    { file:'index', expect:'the difference is not positive', find:'var GAME_SUB = [[3, 4, 1, 6], [5, 6, 1, 2], [2, 3, 1, 4],', replace:'var GAME_SUB = [[3, 4, 1, 6], [5, 6, 1, 2], [1, 3, 1, 2],' },
    { file:'index', expect:'gSub2 en', find:"return 'With a denominator of ' + L + ': ' + a + '/' + b + ' = ' + ka + '/' + L + ' and ' + c + '/' + d + ' = ' + kc + '/' + L + '.'; },", replace:"return 'With a denominator of ' + L + ': ' + a + '/' + b + ' = ' + kc + '/' + L + ' and ' + c + '/' + d + ' = ' + kc + '/' + L + '.'; }," },
    { file:'index', expect:'should say "太大"', find:"return x + '/' + y + ' 太大了。", replace:"return x + '/' + y + ' 不對。" },
    { file:'index', expect:'subtraction pieces', find:'okX:196, okY:172, okW:94, okH:46,', replace:'okX:160, okY:172, okW:94, okH:46,' },
    { file:'index', expect:'an answer box is', find:'inX:100, inW:72, inH:46, numY:144, denY:202,', replace:'inX:100, inW:72, inH:40, numY:144, denY:202,' },

    /* ---- review.html：產生器 ---- */
    { file:'review', expect:'is just 1 written as a fraction', find:'    return !m || (Number(m[1]) > 0 && Number(m[1]) !== Number(m[2]));', replace:'    return true;' },
    { file:'review', expect:'copied straight out of the stem', find:'        var cand = [b*d, b+d, gcd(b,d) > 1 ? gcd(b,d) : 0, Math.max(b,d), l+1, l-1]\n          .filter(function(v){ return v > 0; }).map(String);\n        var wrongs = uniqueWrongs(String(l), cand, 3, avoidExcept([a, b, c, d], [Math.max(b, d)]));', replace:'        var cand = [Math.min(b,d), b*d, b+d, gcd(b,d) > 1 ? gcd(b,d) : 0, Math.max(b,d), l+1, l-1]\n          .filter(function(v){ return v > 0; }).map(String);\n        var wrongs = uniqueWrongs(String(l), cand, 3);' },
    { file:'review', expect:'opts[ans] != correct', find:"        var correctStr = simp[0] + '/' + simp[1];\n        var cand = [ s+'/'+l,", replace:"        var correctStr = s + '/' + l;\n        var cand = [ simp[0] + '/' + simp[1]," },
    { file:'review', expect:'this claim is wrong', find:"? '通分成 '+dd.l+'：'+dd.a+'/'+dd.b+' = '+dd.ka+'/'+dd.l+'，'+dd.c+'/'+dd.d+' = '+dd.kc+'/'+dd.l+'，相加得 '", replace:"? '通分成 '+dd.l+'：'+dd.a+'/'+dd.b+' = '+(dd.ka+1)+'/'+dd.l+'，'+dd.c+'/'+dd.d+' = '+dd.kc+'/'+dd.l+'，相加得 '" },
    { file:'review', expect:'add-tops-and-bottoms distractor', find:"        var cand = [ s+'/'+l, (a+c)+'/'+(b+d), (simp[0]+1)+'/'+simp[1], simp[0]+'/'+(simp[1]+1) ];", replace:"        var cand = [ s+'/'+l, (simp[0]+1)+'/'+simp[1], simp[0]+'/'+(simp[1]+1) ];" },
    { file:'review', via:'index', expect:'review.html generators should be exactly', find:"    { id:'lcmSimple', cat:'common',", replace:"    { id:'lcmSimplest', cat:'common'," },
    { file:'review', expect:'ans does not point at the bigger one', find:'        var ans = ka > kc ? 0 : 1;', replace:'        var ans = ka > kc ? 1 : 0;' },
    { file:'review', expect:'is not the LCM', find:'  function lcm(a, b){ return a * b / gcd(a, b); }', replace:'  function lcm(a, b){ return a * b; }' }
  ],
  sim: {
    INVARIANTS: {
      addUnlike: d => {
        if (!(d.a >= 1 && d.a < d.b && d.c >= 1 && d.c < d.d)) return 'an addend is not a proper fraction';
        if (d.b === d.d) return 'the denominators are the same — not an unlike-fraction question';
        if (d.l !== lcmRef(d.b, d.d)) return 'l is not the LCM of ' + d.b + ' and ' + d.d;
        if (d.ka !== d.a * d.l / d.b || d.kc !== d.c * d.l / d.d) return 'the converted numerators are wrong';
        if (!(d.ka + d.kc < d.l)) return 'the sum is not a proper fraction';
        if (!d.opts.some((o, i) => i !== d.ans && o === (d.a + d.c) + '/' + (d.b + d.d))) return 'the add-tops-and-bottoms distractor ' + (d.a + d.c) + '/' + (d.b + d.d) + ' is missing';
      },
      subUnlike: d => {
        if (!(d.a >= 1 && d.a < d.b && d.c >= 1 && d.c < d.d)) return 'a fraction is not proper: ' + d.a + '/' + d.b + ' − ' + d.c + '/' + d.d;
        if (d.b === d.d) return 'the denominators are the same';
        if (d.l !== lcmRef(d.b, d.d)) return 'l is not the LCM';
        if (d.ka !== d.a * d.l / d.b || d.kc !== d.c * d.l / d.d) return 'the converted numerators are wrong';
        if (!(d.diff > 0 && d.diff === d.ka - d.kc)) return 'the difference is not positive';
      },
      equivFraction: d => {
        if (!(d.a >= 1 && d.a < d.b)) return 'not a proper fraction';
        if (gcdRef(d.a, d.b) !== 1) return d.a + '/' + d.b + ' is not in simplest form';
        if (!(d.m >= 2 && d.b * d.m <= 24)) return 'multiplier/denominator out of range';
        for (let i = 0; i < d.opts.length; i++) if (i !== d.ans && valOf(d.opts[i]) * d.b === d.a) return 'distractor ' + d.opts[i] + ' is also equal to ' + d.a + '/' + d.b;
      },
      simplifyFrac: d => {
        if (gcdRef(d.pn, d.q) !== 1) return d.pn + '/' + d.q + ' is not in simplest form';
        if (d.num !== d.pn * d.g || d.den !== d.q * d.g || d.g < 2) return 'num/den is not pn/q times g';
        if (gcdRef(d.num, d.den) !== d.g) return 'the explanation calls ' + d.g + ' the greatest common factor of ' + d.num + ' and ' + d.den + ', but it is ' + gcdRef(d.num, d.den);
        if (d.den > 24) return 'denominator over 24';
      },
      compareFrac: d => {
        if (d.a * d.d === d.c * d.b) return 'the two fractions are equal';
        if (d.l !== lcmRef(d.b, d.d)) return 'l is not the LCM';
        if ((d.ka > d.kc ? 0 : 1) !== d.ans) return 'ans does not point at the bigger one';
      },
      commonDenom: d => {
        if (d.l !== lcmRef(d.b, d.d)) return 'l is not the LCM';
        if (!(d.a >= 1 && d.a < d.b && d.c >= 1 && d.c < d.d)) return 'a fraction is not proper';
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          const v = +d.opts[i];
          if (v % d.b === 0 && v % d.d === 0 && v < d.l) return 'distractor ' + v + ' is a smaller common multiple';
        }
      },
      lcmSimple: d => {
        if (d.l !== lcmRef(d.a, d.b)) return 'l is not the LCM';
      },
      fracMulSimple: d => {
        if (d.num !== d.a * d.c || d.den !== d.b * d.d) return 'num/den is not the product';
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'addUnlike': return fracRef(d.a * d.d + d.c * d.b, d.b * d.d);
        case 'subUnlike': return fracRef(d.a * d.d - d.c * d.b, d.b * d.d);
        case 'equivFraction': return (d.a * d.m) + '/' + (d.b * d.m);
        case 'simplifyFrac': return fracRef(d.num, d.den);
        case 'compareFrac': {
          const big = d.a * d.d > d.c * d.b ? d.a + '/' + d.b : d.c + '/' + d.d;
          return lang === 'zh' ? big + ' 比較大' : big + ' is bigger';
        }
        case 'commonDenom': return String(lcmRef(d.b, d.d));
        case 'lcmSimple': return String(lcmRef(d.a, d.b));
        case 'fracMulSimple': return fracRef(d.a * d.c, d.b * d.d);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    /* 渲染出來的那一題：解釋裡的分數算式逐條重算；通分加減與比大小的解釋至少要驗到兩條 */
    renderCheck: function(d, q, lang, genId){
      const r = fracClaims(q.stem + ' ' + q.why);
      if (r.problems.length) return r.problems.join('; ');
      if (['addUnlike', 'subUnlike', 'compareFrac'].indexOf(genId) >= 0 && r.verified < 2) return 'the explanation verified only ' + r.verified + ' equalities: ' + q.why;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'compareFrac'){
        if (!/^\d+\/\d+ (比較大|is bigger)$|^(兩個一樣大|沒辦法比較|They are equal|Cannot be compared)$/.test(s)) return 'option "' + s + '" is not one of the four comparison answers';
        return;
      }
      if (genId === 'commonDenom' || genId === 'lcmSimple'){
        if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a whole number';
        if (+s > 96) return 'option ' + s + ' is over 96';
        return;
      }
      const m = /^([1-9]\d*)\/([1-9]\d*)$/.exec(s);
      if (!m) return 'option "' + s + '" is not a fraction n/d with n, d ≥ 1';
      const n = +m[1], den = +m[2];
      if (den > 48) return 'option ' + s + ' has a denominator over 48';
      if (n === den) return 'option ' + s + ' is just 1 written as a fraction — not a believable answer';
      if (isCorrect && n > den) return 'the answer ' + s + ' is improper';
    },
    /* 刻意的迷思誘答（把題幹的數字當答案）：「直接用比較大的那個分母／那個數」。只放行那一個值；
       review.html 那一側用 avoidExcept() 各自獨立地說出同一件事。 */
    stemEchoOk: {
      commonDenom: (d, opt) => String(opt) === String(Math.max(d.b, d.d)),
      lcmSimple: (d, opt) => String(opt) === String(Math.max(d.a, d.b))
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「披薩配對」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GAME_W, gcd, lcm, smallestCommon, shuffle, GAME_SAME, sameKind, sameK, SAME_G, sameSpot, sameTray, GAME_SIMP, SIMP_KEYS, simpBad, SIMP_G, GAME_CUT, CUT_MIN, CUT_MAX, CUT_G, cutX, cutValue, cutAligned, GAME_ADD, addPlan, addCards, addWhy, ADD_G, GAME_SUB, subPlan, subJudge, SUB_G, dropTarget}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = D.GAME_W;

      /* --- 0. 掃描器自己先證明會響（positive / negative control） --- */
      CLAIM_PROBES.forEach(p => {
        const r = fracClaims(p.text);
        if (p.bad && !r.problems.length) fail('fracClaims() self-test: "' + p.text + '" should be caught');
        if (!p.bad && r.problems.length) fail('fracClaims() self-test: "' + p.text + '" is a true claim but was flagged: ' + r.problems.join('; '));
        if (!p.bad && r.verified !== p.n) fail('fracClaims() self-test: "' + p.text + '" should verify ' + p.n + ' equalities, verified ' + r.verified);
      });

      /* --- 1. 每一條 I18N 靜態字串（含三層題庫的題幹、選項與解釋）裡的分數算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const r = fracClaims(s);
        checkedEq += r.verified;
        r.problems.forEach(p => fail(where + ': ' + p));
      }));
      /* 釘住驗了幾條：一個壞掉的正規化會讓每條算式都靜靜讀不到，那樣也是零錯誤。改了課文就把這個數一起改。 */
      if (checkedEq !== 32) fail('the fraction scan verified ' + checkedEq + ' equalities in the I18N strings, expected 32 — it is not reading them (or the text changed: update the count)');

      /* --- 1b. review.html 的產生器清單釘死：simgen 只驗「還在的」產生器 —— 整個刪掉或改名，它的不變條件與正解檢查就靜靜不見了（codex 第一輪） --- */
      {
        const fs = require('fs'), path = require('path');
        const rp = path.join(path.dirname(process.argv[2] || '.'), 'review.html');
        let rv = '';
        try { rv = fs.readFileSync(rp, 'utf8'); } catch (e){ fail('cannot read ' + rp + ' to pin the generator list'); }
        /* 和 simgen 一樣把「工具 ＋ GENS」那一段切出來真的執行，拿 GENS 本身的 id —— 不靠字面掃描（codex 第二輪：換個寫法的產生器會被字面掃描漏掉） */
        const gs = rv.indexOf('/* ---------- 工具 ---------- */'), ge = rv.indexOf('/* ---------- 出一批', gs);
        let ids = [];
        if (gs < 0 || ge < 0) fail('cannot find the generator block in review.html');
        else { try { ids = new Function(rv.slice(gs, ge) + '\nreturn GENS.map(function(g){ return g.id; });')(); } catch (e){ fail('review.html GENS could not be evaluated: ' + e.message); } }
        const WANT = ['addUnlike', 'subUnlike', 'equivFraction', 'simplifyFrac', 'compareFrac', 'commonDenom', 'lcmSimple', 'fracMulSimple'];
        if (ids.join() !== WANT.join()) fail('review.html generators should be exactly ' + WANT.join() + ' — got ' + ids.join());
        WANT.forEach(id => { if (!module.exports.sim.INVARIANTS[id]) fail('no invariant for review.html generator ' + id); });
      }

      /* --- 2. 範例 3 的兩題（STEPS）：最小公倍數、通分後的分子、結果，用自己的算法重算 --- */
      {
        const m = src.match(/var STEPS = (\{[\s\S]*?\n  \});/);
        let S = null;
        if (!m) fail('cannot find STEPS in index.html');
        else { try { S = new Function('return ' + m[1])(); } catch (e){ fail('STEPS could not be evaluated: ' + e.message); } }
        if (S) Object.keys(S).forEach(k => {
          const e = S[k], L = lcmRef(e.aDen, e.bDen), ka = e.aNum * L / e.aDen, kb = e.bNum * L / e.bDen, r = e.op === '+' ? ka + kb : ka - kb;
          if (e.lcm !== L || e.kaNum !== ka || e.kbNum !== kb || e.resNum !== r || e.resDen !== L) fail('STEPS.' + k + ' does not add up: ' + JSON.stringify(e));
        });
      }

      /* --- 3. 小遊戲：五關的順序、每一關的題目與提示（兩種語言）、RENDER 切得出來 --- */
      const TYPES = ['same', 'simp', 'cut', 'add', 'sub'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 1, 2, 3 add, 3 subtract), got ' + D.GAME_ORDER);
      TYPES.forEach(t => LANGS.forEach(L => {
        if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
        if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
      }));
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      /* 每一句說明：數字照順序逐個比，而且句子裡的每一條分數算式都要算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        fracClaims(text).problems.forEach(p => fail(where + ': ' + p));
      };
      /* 說明的意思用寫死的關鍵詞釘住（必須說／不可以說）—— 逐字和頁面自己的 I18N 比，句子被改成假話也照樣相等 */
      const says = (where, text, must, mustNot) => {
        (must || []).forEach(w => { if (String(text).indexOf(w) < 0) fail(where + ': should say "' + w + '": ' + text); });
        (mustNot || []).forEach(w => { if (String(text).indexOf(w) >= 0) fail(where + ': must not say "' + w + '": ' + text); });
      };
      /* 這一句不可以說出某個數（例如「還有更少的片數」不可以把最小公倍數直接說出來）；那個數剛好也是題目上的數時不算 */
      const noNum = (where, text, v, except) => { if ((except || []).indexOf(v) < 0 && nums(text).indexOf(v) >= 0) fail(where + ': must not give away ' + v + ': ' + text); };
      const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      ['GAME_SAME', 'GAME_SIMP', 'GAME_CUT', 'GAME_ADD', 'GAME_SUB'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 4) fail(k + ' should be a pool of at least 4 entries');
      });
      /* 頁面的 gcd／lcm 要和自己的一致（遊戲每一關都靠它們） */
      for (let x = 1; x <= 30; x++) for (let y = 1; y <= 30; y++){
        if (D.gcd(x, y) !== gcdRef(x, y) || D.lcm(x, y) !== lcmRef(x, y)) { fail('gcd()/lcm() disagree at ' + x + ', ' + y); x = 99; break; }
        const p = (() => { for (let q = 2; q <= Math.min(x, y); q++) if (x % q === 0 && y % q === 0) return q; return 0; })();
        if (D.smallestCommon(x, y) !== p){ fail('smallestCommon(' + x + ', ' + y + ') is ' + D.smallestCommon(x, y) + ', should be ' + p); x = 99; break; }
      }

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
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- shuffle()：從原始碼切出來真的跑。托盤一定不是題庫原本的順序（3000 次） --- */
      {
        const fsrc = extractFunction(src, 'shuffle');
        let sh = null;
        if (!fsrc) fail('cannot find shuffle() in index.html');
        else { try { sh = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); } }
        if (sh){
          let sorted = 0, moved = 0;
          for (let i = 0; i < 3000; i++){
            const a = sh([0, 1, 2, 3, 4, 5]);
            if (a.slice().sort().join() !== '0,1,2,3,4,5') { fail('shuffle() lost or duplicated items: ' + a); break; }
            if (a.join() === '0,1,2,3,4,5') sorted++;
            if (a[0] !== 0) moved++;
          }
          if (sorted) fail('shuffle() returned the tray in its original order ' + sorted + ' times in 3000');
          if (moved < 2000) fail('shuffle() hardly moves anything (' + moved + '/3000 moved the first card)');
        }
        need('same', /shuffle\(e\.cards\.map\(/, 'the cards are not laid out through shuffle()');
        need('add', /shuffle\(addCards\(P0\)\)\.forEach\(/, 'the number cards are not laid out through shuffle()');
      }

      /* --- nearestAny()／nearestOpen()：從原始碼切出來真的跑 ---
         ① 點在格子裡的，一定判給那一格 ② 兩格放寬之後重疊的地方判給近的那一格（不是陣列裡第一個）
         ③ 大塊裡、靠近小塊邊上的點判給大塊（量方框，不是量中心）④ 最近的那格已經放好了 → nearestOpen 不收 ⑤ 離每一格都遠 → 不收 */
      {
        const asrc = extractFunction(src, 'nearestAny'), osrc = extractFunction(src, 'nearestOpen');
        let na = null, no = null;
        if (!asrc || !osrc) fail('cannot find nearestAny()/nearestOpen() in index.html');
        else { try { const f = new Function(asrc + '\n' + osrc + '\nreturn [nearestAny, nearestOpen];')(); na = f[0]; no = f[1]; } catch (e){ fail('nearestAny()/nearestOpen() could not be evaluated: ' + e.message); } }
        if (na){
          const G = D.ADD_G, h = G.slot / 2;
          const slots = Object.keys(G.slotX).map(k => ({ id:k, cx:G.slotX[k], cy:G.slotY[k] + h, hw:h, hh:h, done:false }));
          let bad = 0;
          slots.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = na(slots, { x, y }, G.pad); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestAny(): ' + bad + ' points inside an addition box are given to another box (or none)');
          /* 分子格與分母格放寬之後重疊：靠近分母格的那一點要判給分母格（分母格在陣列裡排第二） */
          const n1 = slots.find(s => s.id === 'n1'), d1 = slots.find(s => s.id === 'd1');
          const gap = (d1.cy - h) - (n1.cy + h);
          if (!(gap > 0 && gap < 2 * G.pad)) fail('ADD_G: the top and bottom boxes of a fraction should be apart but closer than two pads (gap ' + gap + ') so the overlap is real');
          else {
            const yNear = n1.cy + h + gap * 0.75, r = na([n1, d1], { x:n1.cx, y:yNear }, G.pad);
            if (!r || r.id !== 'd1') fail('nearestAny(): a drop between a top and a bottom box, nearer the bottom box, is not given to the bottom box');
          }
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = na(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestAny(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (no(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
          if (na(done, { x:300, y:300 }, 6) !== null) fail('nearestAny(): a drop far from every box is accepted');
          /* 兩個籃子：中間的縫靠右 → 右邊的籃子 */
          const S = D.SAME_G, bins = [0, 1].map(i => ({ id:i, cx:S.binX[i] + S.binW / 2, cy:S.binY + S.binH / 2, hw:S.binW / 2, hh:S.binH / 2, done:false }));
          const gl = S.binX[0] + S.binW, gr = S.binX[1];
          if (!(gr - gl > 0 && gr - gl < 2 * S.pad)) fail('SAME_G: the two baskets should be apart but closer than two pads');
          const rb = na(bins, { x:gr - (gr - gl) * 0.25, y:bins[0].cy }, S.pad);
          if (!rb || rb.id !== 1) fail('nearestAny(): a drop in the gap nearer the right basket is not given to the right basket');
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

      /* ================= 第 1 關：一樣大嗎 ================= */
      {
        const S = D.SAME_G, kindRef = (a, b, n, d) => n * b === a * d ? 'eq' : (n > a && n - a === d - b ? 'add' : (n === a && d % b === 0 ? 'den' : (n % a === 0 && d % b === 0 ? 'mix' : 'other')));
        D.GAME_SAME.forEach((e, i) => {
          const w = 'GAME_SAME[' + i + '] ' + e.a + '/' + e.b;
          if (!(e.a >= 1 && e.a < e.b && gcdRef(e.a, e.b) === 1)) fail(w + ': the base should be a proper fraction in simplest form');
          if (!Array.isArray(e.cards) || e.cards.length !== 6) return fail(w + ': six cards');
          const kinds = e.cards.map(c => kindRef(e.a, e.b, c[0], c[1]));
          if (kinds.join() !== 'eq,eq,eq,add,den,mix') fail(w + ': the cards should be three equal ones then add, den, mix (got ' + kinds + ')');
          const ks = e.cards.slice(0, 3).map(c => c[1] / e.b);
          if (new Set(ks).size !== 3 || ks.some(k => !(k >= 2))) fail(w + ': the three equal cards should use three different multipliers ≥ 2 (' + ks + ')');
          if (new Set(e.cards.map(c => c.join('/'))).size !== 6) fail(w + ': two cards are the same');
          const vals = e.cards.map(c => c[0] / c[1]);
          for (let x = 3; x < 6; x++) for (let y = x + 1; y < 6; y++) if (Math.abs(vals[x] - vals[y]) < 1e-12) fail(w + ': unequal cards ' + e.cards[x].join('/') + ' and ' + e.cards[y].join('/') + ' are the same value (one of them adds nothing)');
          e.cards.forEach(c => {
            if (!(c[0] >= 1 && c[1] <= 24)) fail(w + ': card ' + c.join('/') + ' out of range');
            if (c[0] >= c[1]) fail(w + ': card ' + c.join('/') + ' is not a proper fraction');
            const kd = kindRef(e.a, e.b, c[0], c[1]);
            if (kd === 'other') return fail(w + ': card ' + c.join('/') + ' is neither equal nor one of the three named mistakes');
            if (D.sameKind(e.a, e.b, c[0], c[1]) !== kd) fail(w + ': sameKind() says ' + D.sameKind(e.a, e.b, c[0], c[1]) + ' for ' + c.join('/') + ', should be ' + kd);
            const kRef = kd === 'add' ? [c[0] - e.a] : (kd === 'mix' ? [c[0] / e.a, c[1] / e.b] : [c[1] / e.b]);
            if (D.sameK(e.a, e.b, c[0], c[1]).join() !== kRef.join()) fail(w + ': sameK() for ' + c.join('/') + ' is ' + D.sameK(e.a, e.b, c[0], c[1]) + ', should be ' + kRef);
            /* 每一張 × 放錯的那一個籃子：理由的數字照順序、算式算得對、意思用關鍵詞釘住 */
            const L = lcmRef(e.b, c[1]), x = e.a * L / e.b, y = c[0] * L / c[1];
            LANGS.forEach(lg => {
              const d = I18N[lg];
              if (kd === 'eq'){
                seq(w + ' gSameWhyEq ' + lg + ' ' + c.join('/'), d.gSameWhyEq(c[0], c[1], e.a, e.b, kRef[0]), [c[0], c[1], kRef[0], e.a, e.b]);
                says(w + ' gSameWhyEq ' + lg, d.gSameWhyEq(c[0], c[1], e.a, e.b, kRef[0]), lg === 'zh' ? ['同除', '一樣大'] : ['Divide', 'same size'], lg === 'zh' ? ['不一樣'] : ['not the same']);
                seq(w + ' gSameOkEq ' + lg, d.gSameOkEq(c[0], c[1], e.a, e.b, kRef[0]), [c[0], c[1], e.a, e.b, kRef[0]]);
                seq(w + ' gSame2 ' + lg, d.gSame2('eq', c[0], c[1], e.a, e.b, kRef[0]), [c[0], c[1], c[0], e.a, kRef[0], c[1], e.b, kRef[0]]);
              } else {
                const t = d.gSameWhyNe(kd, c[0], c[1], e.a, e.b, L, x, y, kRef[0], kRef[1]);
                seq(w + ' gSameWhyNe ' + lg + ' ' + c.join('/'), t, [L, e.a, e.b, x, L, c[0], c[1], y, L].concat(kRef));
                if (x === y) fail(w + ': ' + c.join('/') + ' converts to the same ' + x + '/' + L + ' — it is equal after all');
                const KW = { zh:{ add:['同「加」'], den:['只有分母'], mix:['分子乘', '分母乘', '同一個數'] }, en:{ add:['adding'], den:['only the bottom'], mix:['the top was multiplied', 'the bottom by', 'same number'] } };
                says(w + ' gSameWhyNe ' + lg + ' ' + kd, t, KW[lg][kd].concat(lg === 'zh' ? ['不一樣大'] : ['not the same size']));
                seq(w + ' gSameOkNe ' + lg, d.gSameOkNe(c[0], c[1], e.a, e.b, L, x, y), [L, e.a, e.b, x, L, c[0], c[1], y, L]);
                seq(w + ' gSame2 ' + lg + ' ' + kd, d.gSame2(kd, c[0], c[1], e.a, e.b, kRef[0], kRef[1]), kd === 'add' ? [c[0], c[1], e.a, e.b, kRef[0]] : (kd === 'den' ? [c[0], c[1], kRef[0]] : [c[0], c[1], kRef[0], kRef[1]]));
              }
            });
          });
          LANGS.forEach(lg => {
            const bn = I18N[lg].gSameBins(e.a, e.b);
            seq(w + ' gSameBins.eq ' + lg, bn.eq, [e.a, e.b]); seq(w + ' gSameBins.ne ' + lg, bn.ne, [e.a, e.b]);
            says(w + ' gSameBins.ne ' + lg, bn.ne, [lg === 'zh' ? '不一樣' : 'not']);
            says(w + ' gSameBins.eq ' + lg, bn.eq, [], [lg === 'zh' ? '不一樣' : 'not']);
            seq(w + ' gSameNow ' + lg, I18N[lg].gSameNow(e.a, e.b, 2, 6), [e.a, e.b, 2, 6]);
            seq(w + ' gSameDone ' + lg, I18N[lg].gSameDone(e.a, e.b), [e.a, e.b]);
          });
        });
        /* 規則：籃子的種類由 sameKind() 判；放錯 → 理由；理由選哪一句 */
        need('same', /bin:kind === 'eq' \? 'eq' : 'ne'/, 'the right basket is not derived from sameKind()');
        need('same', /if \(t\.kind !== c\.bin\)\{\s*roundMiss\(c\.bin === 'eq' \? d\.gSameWhyEq\(c\.n, c\.d, a, b, c\.k\[0\]\) : d\.gSameWhyNe\(c\.kind, c\.n, c\.d, a, b, L, x, y, c\.k\[0\], c\.k\[1\]\)\);\s*return false;/, 'a card in the wrong basket is not refused with its reason');
        need('same', /var L = lcm\(b, c\.d\), x = a \* L \/ b, y = c\.n \* L \/ c\.d;/, 'the reason does not convert both to the LCM of the two denominators');
        /* 版面：兩個籃子、名字在籃子裡面最上面、三張卡放得下而且不蓋到名字；托盤六格不碰籃子、不互相碰 */
        const binsR = [0, 1].map(i => ({ x:S.binX[i], y:S.binY, w:S.binW, h:S.binH }));
        binsR.forEach((r, i) => inside(r, 'basket ' + i, S.H));
        noHits(binsR, 'baskets');
        [0, 1].forEach(bi => {
          const lbl = { x:S.binX[bi] + 4, y:S.binY + 2, w:S.binW - 8, h:S.lblH };
          if (!(lbl.y >= S.binY && lbl.y + lbl.h <= S.binY + S.binH)) fail('SAME_G: the basket label is not inside its basket');
          if (S.lblH < 40) fail('SAME_G: the basket label is ' + S.lblH + ' high — two lines of English need at least 40');
          for (let j = 0; j < 3; j++){
            const p = D.sameSpot(bi, j), r = box(p.x, p.y, S.cardW, S.cardH);
            if (!(r.x >= S.binX[bi] && r.x + r.w <= S.binX[bi] + S.binW && r.y >= S.binY && r.y + r.h <= S.binY + S.binH)) fail('sameSpot(' + bi + ', ' + j + ') is outside its basket');
            if (hit(r, lbl)) fail('sameSpot(' + bi + ', ' + j + ') covers the basket label');
            if (j && hit(r, box(D.sameSpot(bi, j - 1).x, D.sameSpot(bi, j - 1).y, S.cardW, S.cardH))) fail('sameSpot(' + bi + ', ' + j + ') overlaps the card above');
          }
        });
        const tray = [0, 1, 2, 3, 4, 5].map(i => { const p = D.sameTray(i); return box(p.x, p.y, S.cardW, S.cardH); });
        tray.forEach((r, i) => { inside(r, 'tray card ' + i, S.H); binsR.forEach(bb => { if (hit(r, { x:bb.x - S.pad, y:bb.y - S.pad, w:bb.w + 2 * S.pad, h:bb.h + 2 * S.pad })) fail('tray card ' + i + ' sits inside a basket\'s drop zone'); }); });
        noHits(tray, 'tray cards');
        tooSmall('a fraction card (' + S.cardW + '×' + S.cardH + ')', Math.min(S.cardW, S.cardH));
      }

      /* ================= 第 2 關：約分 ================= */
      {
        const S = D.SIMP_G, KEYS = D.SIMP_KEYS;
        if (KEYS.join() !== '2,3,4,5,6') fail('SIMP_KEYS should be 2, 3, 4, 5, 6');
        D.GAME_SIMP.forEach((e, i) => {
          const n0 = e[0], d0 = e[1], w = 'GAME_SIMP[' + i + '] ' + n0 + '/' + d0, g = gcdRef(n0, d0);
          if (!(n0 >= 1 && n0 < d0 && d0 <= 24)) fail(w + ': should be a proper fraction with a denominator up to 24');
          if (g < 2) fail(w + ': already in simplest form — nothing to simplify');
          if (!KEYS.some(k => n0 % k || d0 % k)) fail(w + ': every ÷ card works — no wrong card to learn from');
          /* 照遊戲的規則走完每一種 ÷ 順序：每一條路都走得到最簡、走到的都是同一個值、每一步的說明都對 */
          let ends = 0, stuck = 0;
          const walk = (n, d, depth) => {
            if (depth > 8) return;
            const p = (() => { for (let q = 2; q <= Math.min(n, d); q++) if (n % q === 0 && d % q === 0) return q; return 0; })();
            let moves = 0;
            KEYS.forEach(k => {
              const bad = (n % k) ? 'n' : ((d % k) ? 'd' : null);
              if (D.simpBad(n, d, k) !== bad) fail(w + ': simpBad(' + n + ', ' + d + ', ' + k + ') is ' + D.simpBad(n, d, k) + ', should be ' + bad);
              if (bad){
                LANGS.forEach(lg => { const t = I18N[lg].gSimpNo(n, d, k, bad); seq(w + ' gSimpNo ' + lg, t, [bad === 'n' ? n : d, k]); says(w + ' gSimpNo ' + lg, t, [lg === 'zh' ? (bad === 'n' ? '分子' : '分母') : (bad === 'n' ? 'top' : 'bottom')]); });
                return;
              }
              moves++;
              LANGS.forEach(lg => seq(w + ' gSimpOk ' + lg, I18N[lg].gSimpOk(n, d, k, n / k, d / k), [n, d, k, n / k, d / k]));
              walk(n / k, d / k, depth + 1);
            });
            if (p){
              if (!moves) stuck++;
              LANGS.forEach(lg => { seq(w + ' gSimpMore ' + lg, I18N[lg].gSimpMore(n, d, p), [n, d, p]); seq(w + ' gSimp2 ' + lg, I18N[lg].gSimp2(n, d, p), [n, d, p]); });
            } else {
              ends++;
              if (n * d0 !== d * n0) fail(w + ': a path ends at ' + n + '/' + d + ', a different value');
              LANGS.forEach(lg => { seq(w + ' gSimpDone ' + lg, I18N[lg].gSimpDone(n0, d0, n, d), [n0, d0, n, d, n, d, 1]); seq(w + ' gSimp2 done ' + lg, I18N[lg].gSimp2(n, d, 0), [n, d, 1]); });
            }
          };
          walk(n0, d0, 0);
          if (stuck) fail(w + ': ' + stuck + ' path(s) get stuck with a common factor no ÷ card can take');
          if (!ends) fail(w + ': no path reaches simplest form');
          LANGS.forEach(lg => seq(w + ' gSimpNow ' + lg, I18N[lg].gSimpNow(n0, d0), [n0, d0]));
        });
        need('simp', /var k = P\.data\.k, bad = simpBad\(n, dd, k\);\s*if \(bad\)\{ roundMiss\(d\.gSimpNo\(n, dd, k, bad\)\); return false; \}/, 'a ÷ card that does not divide both is not refused with its reason');
        need('simp', /var p = smallestCommon\(n, dd\);\s*if \(p\)\{ roundMiss\(d\.gSimpMore\(n, dd, p\)\); return; \}/, '"fully simplified" is accepted while a common factor is left');
        need('simp', /drawBar\(bar, G\.barW, G\.barH, dd, n, 'gon'\);/, 'the bar is not redrawn as the current fraction');
        need('simp', /backHome\(B, P\);/, 'a used ÷ card does not go back to the tray');
        /* 版面 */
        const zone = { x:0, y:0, w:W, h:S.zoneH };
        inside(zone, 'the simplify drop zone', S.H);
        if (!(S.fracY >= 0 && S.fracY + S.fracH <= S.zoneH && S.barY >= S.fracY + S.fracH && S.barY + S.barH <= S.zoneH)) fail('SIMP_G: the fraction and its bar should both sit inside the drop zone (what the child sees is the target)');
        if (S.barW / 24 < 10) fail('SIMP_G: a 24-slice bar has slices under 10px');
        const keys = S.keyX.map(x => box(x, S.keyY, S.key, S.key));
        keys.forEach((r, i) => { inside(r, '÷ card ' + i, S.H); if (hit(r, { x:0, y:0, w:W, h:S.zoneH + S.pad })) fail('÷ card ' + i + ' sits inside the drop zone'); });
        noHits(keys, '÷ cards');
        const btn = { x:S.btnX, y:S.btnY, w:S.btnW, h:S.btnH };
        inside(btn, 'the "fully simplified" button', S.H);
        keys.forEach((r, i) => { if (hit(r, btn)) fail('÷ card ' + i + ' overlaps the button'); });
        if (hit({ x:0, y:S.logY, w:W, h:S.logH }, keys[0]) || S.logY < S.zoneH) fail('SIMP_G: the step log overlaps the drop zone or the cards');
        tooSmall('a ÷ card', S.key); tooSmall('the "fully simplified" button', S.btnH);
      }

      /* ================= 第 3 關：重新切 ================= */
      {
        const S = D.CUT_G;
        if (D.CUT_MIN !== 1) fail('CUT_MIN should be 1 (the slider starts uncut, never at an answer)');
        let lessThanProduct = 0;
        D.GAME_CUT.forEach((e, i) => {
          const [a, b, c, dd] = e, w = 'GAME_CUT[' + i + '] ' + a + '/' + b + ', ' + c + '/' + dd, L = lcmRef(b, dd);
          if (!(a >= 1 && a < b && c >= 1 && c < dd)) fail(w + ': both should be proper fractions');
          if (b === dd) fail(w + ': the denominators are the same — nothing to re-cut');
          if (L > D.CUT_MAX) fail(w + ': the LCM ' + L + ' is beyond the slider (' + D.CUT_MAX + ')');
          if (L < b * dd) lessThanProduct++;
          /* 照規則判每一個 n：只有 L 收；其他的那一句說得對 */
          for (let n = D.CUT_MIN; n <= D.CUT_MAX; n++){
            const nb = n % b !== 0, nd = n % dd !== 0;
            LANGS.forEach(lg => {
              const d = I18N[lg];
              if (n === 1) return;
              if (nb && nd) seq(w + ' gCutNot2 ' + lg + ' n=' + n, d.gCutNot2(n, b, dd), [n, n, b, dd]);
              else if (nb || nd){ const x = nb ? b : dd; seq(w + ' gCutNot ' + lg + ' n=' + n, d.gCutNot(n, x), [n, x, n, x]); }
              else if (n !== L){
                if (n % L) fail(w + ': ' + n + ' is a multiple of both but not of the LCM?');
                seq(w + ' gCutBig ' + lg + ' n=' + n, d.gCutBig(n, b, dd), [n, b, dd]);
                noNum(w + ' gCutBig ' + lg, d.gCutBig(n, b, dd), L, [n, b, dd]);
              }
            });
            /* 切痕對得上的判斷：原來第 i 條在 i/b，新的切痕在 j/n */
            for (let k = 1; k < b; k++) if (D.cutAligned(b, k, n) !== Number.isInteger(k * n / b)) fail(w + ': cutAligned(' + b + ', ' + k + ', ' + n + ') is wrong');
            for (let k = 1; k < dd; k++) if (D.cutAligned(dd, k, n) !== Number.isInteger(k * n / dd)) fail(w + ': cutAligned(' + dd + ', ' + k + ', ' + n + ') is wrong');
          }
          /* 畫面決定得了答案：在 L 每一條原來的切痕都對得上，比 L 少的每一個 n 都至少有一條紅的 */
          for (let n = 1; n < L; n++){
            let red = 0;
            for (let k = 1; k < b; k++) if (!D.cutAligned(b, k, n)) red++;
            for (let k = 1; k < dd; k++) if (!D.cutAligned(dd, k, n)) red++;
            if (!red) fail(w + ': at ' + n + ' slices no old cut is red, yet ' + n + ' is not the LCM — the picture does not decide the answer');
          }
          LANGS.forEach(lg => {
            const d = I18N[lg], ka = a * L / b, kc = c * L / dd;
            seq(w + ' gCutDone ' + lg, d.gCutDone(a, b, c, dd, L, ka, kc), [L, a, b, ka, L, c, dd, kc, L, L, b, dd]);
            const mb = [], md = []; for (let k = 1; k * b <= L; k++) mb.push(k * b); for (let k = 1; k * dd <= L; k++) md.push(k * dd);
            seq(w + ' gMults ' + lg, d.gMults(b, dd, mb, md), [b].concat(mb, [dd], md));
            seq(w + ' gCutNow ' + lg, d.gCutNow(a, b, c, dd), [a, b, c, dd]);
          });
        });
        if (lessThanProduct < 3) fail('GAME_CUT: only ' + lessThanProduct + ' entries have an LCM smaller than b × d — the "just multiply" mistake is barely tested');
        need('cut', /if \(n === 1\)\{ roundNote\(d\.gCutOne\); return; \}/, 'pressing "cut" before cutting is not just a reminder');
        need('cut', /if \(nb && nd\)\{ roundMiss\(d\.gCutNot2\(n, b, dd\)\); return; \}\s*if \(nb \|\| nd\)\{ roundMiss\(d\.gCutNot\(n, nb \? b : dd\)\); return; \}\s*if \(n !== L\)\{ roundMiss\(d\.gCutBig\(n, b, dd\)\); return; \}/, 'the cut is not judged: not a multiple → which one; common but not least → "fewer"');
        need('cut', /var nb = n % b !== 0, nd = n % dd !== 0;/, 'the multiple test is not n % b / n % d');
        need('cut', /set\(CUT_MIN\);/, 'the slider does not start uncut');
        need('cut', /if \(!e\.isPrimary \|\| pid !== null \|\| gSolved \|\| gen !== gGen\) return;/, 'a second finger (or a stale board) can move the slider');
        need('cut', /track\.addEventListener\('lostpointercapture', stop\);/, 'no lostpointercapture safety on the slider');
        need('cut', /function moveTo\(e\)\{ set\(cutValue\(B\.toBoard\(e\)\.x\)\); \}/, 'the slider does not snap through cutValue() while dragging');
        /* 滑桿：每一格自己的範圍（到相鄰兩格的正中間），x → n 和自己算的一致；cutValue(cutX(n)) = n */
        const step = (S.trackX1 - S.trackX0) / (D.CUT_MAX - D.CUT_MIN);
        if (step < 10) fail('CUT_G: the slider marks are ' + step.toFixed(1) + 'px apart — under 10');
        for (let n = D.CUT_MIN; n <= D.CUT_MAX; n++){
          if (Math.abs(D.cutX(n) - (S.trackX0 + (n - D.CUT_MIN) * step)) > 1e-9) fail('cutX(' + n + ') is not on its mark');
          if (D.cutValue(D.cutX(n)) !== n) fail('cutValue(cutX(' + n + ')) is ' + D.cutValue(D.cutX(n)));
        }
        let badX = 0;
        for (let x = S.trackX0 - S.knob / 2; x <= S.trackX1 + S.knob / 2; x += 0.5){
          let best = D.CUT_MIN, bd = Infinity;
          for (let n = D.CUT_MIN; n <= D.CUT_MAX; n++){ const dd = Math.abs(x - D.cutX(n)); if (dd <= bd + 1e-9){ bd = dd; best = n; } }   /* 正中間一樣近：取後面那一格（四捨五入） */
          if (D.cutValue(x) !== best) badX++;
        }
        if (badX) fail('cutValue(): ' + badX + ' points on the slider pick a mark other than the nearest one');
        /* 版面 */
        const lblR = S.barY.map(y => ({ x:S.lblX, y:y, w:S.lblW, h:S.barH })), barR = S.barY.map(y => ({ x:S.barX, y:y, w:S.barW, h:S.barH })), resR = S.barY.map(y => ({ x:S.barX, y:y + S.barH + 2, w:S.barW, h:S.resH }));
        const track = { x:S.trackX0 - S.knob / 2, y:S.trackY, w:S.trackX1 - S.trackX0 + S.knob, h:S.trackH };
        const minus = { x:S.minusX, y:S.valY, w:S.stepW, h:S.valH }, plus = { x:S.plusX, y:S.valY, w:S.stepW, h:S.valH }, val = { x:S.valX, y:S.valY, w:S.valW, h:S.valH }, okb = { x:S.btnX, y:S.btnY, w:S.btnW, h:S.btnH };
        const all = lblR.concat(barR, resR, [track, minus, plus, val, okb]);
        all.forEach((r, i) => inside(r, 'cut piece ' + i, S.H));
        noHits(all, 'cut pieces');
        if (S.knob > S.trackH) fail('CUT_G: the knob is taller than the slider');
        if (S.barW / D.CUT_MAX < 8) fail('CUT_G: ' + D.CUT_MAX + ' slices are under 8px each');
        tooSmall('the slider knob', S.knob); tooSmall('the − / + buttons', Math.min(S.stepW, S.valH)); tooSmall('the "cut" button', S.btnH);
      }

      /* ================= 第 4 關：加法 ================= */
      {
        const S = D.ADD_G, ORDER = ['n1', 'd1', 'n2', 'd2', 'sn', 'sd', 'pn', 'pd'];
        let red = 0, plain = 0, prod = 0;
        /* 字典的每一句換成記號，看 addWhy 選了哪一句、用了哪些數 */
        const TAG = new Proxy({}, { get: (_, k) => (...args) => k + '(' + args.join(',') + ')' });
        D.GAME_ADD.forEach((e, i) => {
          const [a, b, c, dd] = e, w = 'GAME_ADD[' + i + '] ' + a + '/' + b + ' + ' + c + '/' + dd;
          const L = lcmRef(b, dd), ka = a * L / b, kc = c * L / dd, s = ka + kc, g = gcdRef(s, L);
          if (!(a >= 1 && a < b && c >= 1 && c < dd && b !== dd)) fail(w + ': two proper fractions with different denominators');
          if (!(s < L)) fail(w + ': the sum is not less than 1');
          if (g > 1) red++; else plain++;
          if (b * dd !== L) prod++;
          const P = D.addPlan(e), want = { n1:ka, d1:L, n2:kc, d2:L, sn:s, sd:L };
          if (g > 1){ want.pn = s / g; want.pd = L / g; }
          if (JSON.stringify(P.want) !== JSON.stringify(want) || P.L !== L || P.ka !== ka || P.kc !== kc || P.s !== s || P.g !== g || P.p !== s / g || P.q !== L / g) fail(w + ': addPlan() is ' + JSON.stringify(P) + ', should want ' + JSON.stringify(want));
          if (Object.keys(P.want).join() !== ORDER.slice(0, g > 1 ? 8 : 6).join()) fail(w + ': the boxes should be ' + ORDER.slice(0, g > 1 ? 8 : 6) + ' in that order (got ' + Object.keys(P.want) + ')');
          const cards = D.addCards(P), needV = [...new Set(Object.values(want))];
          if (new Set(cards).size !== cards.length) fail(w + ': two number cards show the same number');
          needV.forEach(v => { if (cards.indexOf(v) < 0) fail(w + ': no card for ' + v + ' — the round cannot be finished'); });
          [b + dd, a + c, b * dd].forEach(v => { if (cards.indexOf(v) < 0) fail(w + ': the mistake card ' + v + ' is missing'); });
          if (cards.length > S.trayX.length * S.trayY.length) fail(w + ': ' + cards.length + ' cards do not fit the tray');
          /* 每一格 × 每一張卡：只有對的收；錯的那一句是對的那一句（自己挑），而且數字與算式都對 */
          Object.keys(want).forEach(slot => cards.forEach(v => {
            if (v === want[slot]) return;
            const top = slot === 'n1' ? a : c, bot = slot === 'n1' ? b : dd;
            let ref;
            if (slot === 'd1' || slot === 'd2') ref = v === b + dd ? 'gAddDenSum(' + [b, dd, v] + ')' : (v % b === 0 && v % dd === 0 ? 'gAddDenBig(' + [v, b, dd] + ')' : 'gAddDenNot(' + [v, v % b ? b : dd] + ')');
            else if (slot === 'n1' || slot === 'n2') ref = (v === top ? 'gAddNumKeep(' : 'gAddNum(') + [top, bot, L, L / bot] + ')';
            else if (slot === 'sn') ref = v === a + c ? 'gAddSumRaw(' + [a, c, ka, kc] + ')' : 'gAddSum(' + [ka, kc] + ')';
            else if (slot === 'sd') ref = (v === 2 * L ? 'gAddSumDen2(' : 'gAddSumDen(') + L + ')';
            else ref = ((slot === 'pn' && v === s) || (slot === 'pd' && v === L) ? 'gAddSimpNot(' : 'gAddSimp(') + [s, L, g] + ')';
            const got = D.addWhy(TAG, P, slot, v);
            if (got !== ref) fail(w + ': card ' + v + ' in ' + slot + ' gives ' + got + ', should be ' + ref);
            if (/^gAddDenBig/.test(ref) && v === L) fail(w + ': gAddDenBig for the LCM itself');
          }));
          LANGS.forEach(lg => {
            const d = I18N[lg], m1 = L / b, m2 = L / dd;
            seq(w + ' gAddDenSum ' + lg, d.gAddDenSum(b, dd, b + dd), [b, dd, b + dd, b, dd]);
            if (b * dd !== L){ seq(w + ' gAddDenBig ' + lg, d.gAddDenBig(b * dd, b, dd), [b * dd, b, dd]); noNum(w + ' gAddDenBig ' + lg, d.gAddDenBig(b * dd, b, dd), L, [b * dd, b, dd]); }
            seq(w + ' gAddNum ' + lg, d.gAddNum(a, b, L, m1), [a, b, L, b, m1, L, a, m1]);
            seq(w + ' gAddNumKeep ' + lg, d.gAddNumKeep(c, dd, L, m2), [dd, m2, L, c, m2]);
            seq(w + ' gAddSumRaw ' + lg, d.gAddSumRaw(a, c, ka, kc), [ka, kc, a, c]);
            seq(w + ' gAddSum ' + lg, d.gAddSum(ka, kc), [ka, kc]);
            seq(w + ' gAddSumDen2 ' + lg, d.gAddSumDen2(L), [L, L, L]);
            seq(w + ' gAddSumDen ' + lg, d.gAddSumDen(L), [L, L]);
            if (g > 1){ seq(w + ' gAddSimpNot ' + lg, d.gAddSimpNot(s, L, g), [s, L, s, L, g]); seq(w + ' gAddSimp ' + lg, d.gAddSimp(s, L, g), [s, L, s, L, g, g]); seq(w + ' gAdd2Simp ' + lg, d.gAdd2Simp(s, L, g), [s, L, g]); }
            seq(w + ' gAddDone ' + lg, d.gAddDone(a, b, c, dd, L, ka, kc, s, s / g, L / g), [a, b, c, dd, ka, L, kc, L, s, L].concat(g > 1 ? [s / g, L / g] : [s, L]));
            says(w + ' gAddDone ' + lg, d.gAddDone(a, b, c, dd, L, ka, kc, s, s / g, L / g), g > 1 ? [] : [lg === 'zh' ? '最簡' : 'simplest']);
            seq(w + ' gAdd2Num ' + lg, d.gAdd2Num(a, b, L, m1), [L, b, m1, a, m1]);
            seq(w + ' gAdd2Sum ' + lg, d.gAdd2Sum(ka, kc, L), [L, ka, kc]);
          });
        });
        if (red < 3 || plain < 3) fail('GAME_ADD: ' + red + ' sums simplify and ' + plain + ' do not — both should be at least 3');
        if (prod < 3) fail('GAME_ADD: only ' + prod + ' entries have b × d ≠ LCM');
        need('add', /if \(v !== P0\.want\[s\.slot\]\)\{ roundMiss\(addWhy\(d, P0, s\.slot, v\)\); return false; \}/, 'a wrong card is not refused with addWhy()');
        need('add', /var s = dropTarget\(nearestAny\(slots, pt, G\.pad\), f \? nearestAny\(slots, f, G\.pad\) : null, function\(t\)\{ return P0\.want\[t\.slot\] === v; \}\);/, 'the box is not picked by dropTarget(nearestAny(centre), nearestAny(finger))');
        need('add', /var row2 = P0\.want\.pn !== undefined;/, 'the simplify row is not drawn exactly when the sum simplifies');
        /* 版面：每一格在畫板裡、不互相碰、不碰托盤；托盤十格不互相碰 */
        const slotR = ORDER.map(k => ({ x:S.slotX[k] - S.slot / 2, y:S.slotY[k], w:S.slot, h:S.slot }));
        slotR.forEach((r, i) => inside(r, 'addition box ' + ORDER[i], S.H));
        noHits(slotR, 'addition boxes');
        const tray = []; S.trayY.forEach(y => S.trayX.forEach(x => tray.push(box(x, y, S.cardW, S.cardH))));
        tray.forEach((r, i) => { inside(r, 'number card ' + i, S.H); slotR.forEach((sr, j) => { if (hit(r, { x:sr.x - S.pad, y:sr.y - S.pad, w:sr.w + 2 * S.pad, h:sr.h + 2 * S.pad })) fail('number card ' + i + ' sits in the drop zone of box ' + ORDER[j]); }); });
        noHits(tray, 'number cards');
        if (!(S.topY + S.topH <= S.slotY.n1)) fail('ADD_G: the expression overlaps the first boxes');
        tooSmall('a number card', Math.min(S.cardW, S.cardH)); tooSmall('an addition box', S.slot);
      }

      /* ================= 第 5 關：減法 ================= */
      {
        const S = D.SUB_G;
        let red = 0, plain = 0, both = 0;
        D.GAME_SUB.forEach((e, i) => {
          const [a, b, c, dd] = e, w = 'GAME_SUB[' + i + '] ' + a + '/' + b + ' − ' + c + '/' + dd;
          const L = lcmRef(b, dd), ka = a * L / b, kc = c * L / dd, r = ka - kc, g = gcdRef(r, L), p = r / g, q = L / g;
          if (!(a >= 1 && a < b && c >= 1 && c < dd && b !== dd)) fail(w + ': two proper fractions with different denominators');
          if (!(r > 0)) fail(w + ': the difference is not positive');
          if (b > 12 || dd > 12) fail(w + ': a bar with more than 12 slices is hard to read here');
          if (g > 1) red++; else plain++;
          const P = D.subPlan(e);
          if (P.L !== L || P.ka !== ka || P.kc !== kc || P.r !== r || P.g !== g || P.p !== p || P.q !== q) fail(w + ': subPlan() is ' + JSON.stringify(P));
          const bothX = a - c, bothY = Math.abs(b - dd);
          if (bothX > 0 && bothX * q !== bothY * p) both++;
          /* 每一組 x/y（1～40）：subJudge 和自己的判法一致 */
          let bad = 0;
          for (let x = 0; x <= 40; x++) for (let y = 1; y <= 40; y++){
            const ref = x * q === y * p ? (gcdRef(x, y) === 1 ? 'ok' : 'simp') : (x === bothX && y === bothY ? 'both' : (x * q > y * p ? 'big' : 'small'));
            if (D.subJudge(P, x, y) !== ref){ if (!bad) fail(w + ': subJudge(' + x + '/' + y + ') is ' + D.subJudge(P, x, y) + ', should be ' + ref); bad++; }
          }
          LANGS.forEach(lg => {
            const d = I18N[lg];
            seq(w + ' gSubDone ' + lg, d.gSubDone(a, b, c, dd, L, ka, kc, r, p, q), [a, b, c, dd, ka, L, kc, L, r, L].concat(g > 1 ? [p, q] : []));
            seq(w + ' gSub2 ' + lg, d.gSub2(a, b, c, dd, L, ka, kc), [L, a, b, ka, L, c, dd, kc, L]);
            seq(w + ' gSubBoth ' + lg, d.gSubBoth(a, c, Math.max(b, dd), Math.min(b, dd)), [a, c, Math.max(b, dd), Math.min(b, dd)]);
            seq(w + ' gSubSimp ' + lg, d.gSubSimp(2 * p, 2 * q, 2), [2 * p, 2 * q, 2 * p, 2 * q, 2]);
            says(w + ' gSubBig ' + lg, d.gSubBig(1, 1), [lg === 'zh' ? '太大' : 'too big']);
            says(w + ' gSubSmall ' + lg, d.gSubSmall(0, 7), [lg === 'zh' ? '太小' : 'too small']);
          });
        });
        if (red < 3 || plain < 3) fail('GAME_SUB: ' + red + ' differences simplify and ' + plain + ' do not — both should be at least 3');
        if (both < 3) fail('GAME_SUB: only ' + both + ' entries can show the "top − top, bottom − bottom" mistake');
        need('sub', /else if \(j === 'simp'\) roundNote\(d\.gSubSimp\(x, y, gcd\(x, y\)\)\);/, 'a right-sized but unsimplified answer is not a reminder');
        need('sub', /else if \(j === 'both'\) roundMiss\(d\.gSubBoth\(P0\.a, P0\.c, Math\.max\(P0\.b, P0\.d\), Math\.min\(P0\.b, P0\.d\)\)\);\s*else roundMiss\(j === 'big' \? d\.gSubBig\(x, y\) : d\.gSubSmall\(x, y\)\);/, 'a wrong answer is not refused with its reason');
        need('sub', /if \(x === null \|\| y === null\)\{ roundNote\(d\.gSubInt\); return; \}\s*if \(y === 0\)\{ roundNote\(d\.gSubZero\); return; \}/, 'an empty / odd / zero entry is not just a reminder');
        need('sub', /function readInt\(s\)\{ s = String\(s\)\.trim\(\); return \/\^\(0\|\[1-9\]\\d\{0,2\}\)\$\/\.test\(s\) \? \+s : null; \}/, 'readInt() does not accept only plain whole numbers');
        const R = [{ x:0, y:S.topY, w:W, h:S.topH }].concat(S.barY.map(y => ({ x:S.lblX, y:y, w:S.lblW, h:S.barH })), S.barY.map(y => ({ x:S.barX, y:y, w:S.barW, h:S.barH })),
                   [{ x:S.inX, y:S.numY, w:S.inW, h:S.inH }, { x:S.inX, y:S.denY, w:S.inW, h:S.inH }, { x:S.okX, y:S.okY, w:S.okW, h:S.okH }, { x:S.eqX, y:S.lineY - S.inH / 2, w:S.eqW, h:S.inH }]);
        R.forEach((r, i) => inside(r, 'subtraction piece ' + i, S.H));
        noHits(R.filter((r, i) => i !== R.length - 1), 'subtraction pieces');
        if (!(S.numY + S.inH <= S.lineY && S.lineY + S.lineH <= S.denY)) fail('SUB_G: the fraction line is not between the two boxes');
        tooSmall('an answer box', S.inH); tooSmall('the "check" button', S.okH);
      }
    }
  },
};
