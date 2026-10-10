/* grade-5/math/multiple 的檢查設定（倍數 — 跳跳蛙數字樂園：倍數是從自己開始、每次加自己的跳格子；用除法判斷；
   因數與倍數是同一件事的兩種說法；第幾個倍數、範圍裡的倍數）。
   2026-10-10 新增 —— 和小遊戲「倍數跳跳蛙」改成五關五種玩法（§六之五）同一次寫成；在這之前這一課沒有設定檔，
   simgen.js／verify_lesson_data.js／breaktest.js 對這一課一律直接報「no check config」。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算）、選項的範圍與格式。
   第一次跑抓到的舊缺陷（已經在 review.html 修好，breaks 裡各有一筆把它改回去）：
   - nthMultiple 的英文寫成「the 3th multiple」「the 5th」以外的序數全錯（3rd、8th 之外的 1st／2nd／3rd）；
   - nthMultiple 在 n ＝ 3 時誘答 c − 2k 剛好就是題幹的 k；
   - multiplesCount 的誘答 c ± 1 會剛好等於題幹的 k（6 在 1～30、8 在 1～50）；
   - nextMultipleAfter 把題幹的 x 原封不動放進選項（§六之三第 4 點：抄題幹）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算（a × b ＝ c、a ÷ b ＝ q、a ÷ b ＝ q 餘 r／q remainder r）。
     題庫裡「哪一個是 k 的倍數／不是／介於 a 和 b 之間／最小的倍數／幾個」各題，用自己的算法重算正解。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關「收不收、為什麼不收」都是資料區的純函式（hopRefuse／checkRefuse／tagRefuse／busWhy1／busWhy2），
     這裡用自己的規則把每一題的每一個動作都跑一遍、再照遊戲的規則從頭玩到完，證明一定解得完、而且解完一定是對的；
     每一句說明兩種語言逐個比數字，並且用寫死的關鍵詞釘住「話」（必須說／不可以說）；
     版面（不出界、不重疊、375px 觸控 ≥ 44px）從資料區讀；shuffle()／checkOrder()（3000 次）、nearestOpen()／nearestAny()、
     roundMiss()、readInt()、dropTarget() 從原始碼切出來真的跑；RENDER 裡呼叫判斷的那一行、拖拉引擎的第一根手指、三條放開的路、
     換畫板保護、放好的不擋點擊、同一個錯再交一次不再扣，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   文字在框裡、375px 的實際尺寸由 teaching-workspace/game-harness/g5-multiple 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { extractFunction } = require('./lib/gameshuffle.js');

const PHONE_K = Math.min(1.5, 289 / 300);
const GAME_TYPES_REF = ['hop', 'check', 'tag', 'bus', 'range'];
function gnums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function subseqRef(got, want){ let i = 0; got.forEach(v => { if (i < want.length && v === want[i]) i++; }); return i === want.length; }
function lcmRef(a, b){ for (let m = Math.max(a, b); ; m++) if (m % a === 0 && m % b === 0) return m; }
function ordRef(n){ const t = n % 100, o = n % 10; return n + ((t >= 11 && t <= 13) ? 'th' : o === 1 ? 'st' : o === 2 ? 'nd' : o === 3 ? 'rd' : 'th'); }

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果」找出來重算（除法可以帶餘數：餘 r／remainder r） */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(\d+)(?![\d\/]|\.\d)(?:(?: ?餘 ?| remainder | r )(\d+))?/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1], got = +m[2], rem = m[3] === undefined ? null : +m[3];
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0){
      if (toks.length !== 3) bad = 'a division chained with other operations';
      else {
        const a = +toks[0], b = +toks[2], q = Math.floor(a / b), r = a % b;
        if (got !== q || (rem === null ? r !== 0 : rem !== r)) bad = 'should be ' + q + (r ? ' remainder ' + r : '');
        if (rem !== null && !(rem < b)) bad = 'remainder ' + rem + ' is not smaller than ' + b;
      }
    } else {
      if (rem !== null) bad = 'a remainder after a non-division';
      const terms = [];
      let cur = +toks[0], sign = 1;
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], v = +toks[i + 1];
        if (op === '×') cur *= v;
        else { terms.push(sign * cur); sign = op === '-' ? -1 : 1; cur = v; }
      }
      terms.push(sign * cur);
      const val = terms.reduce((a, b) => a + b, 0);
      if (val !== got) bad = bad || 'should be ' + val;
    }
    out.push({ text:m[0], bad });
  }
  /* 反過來寫的「v ＝ k × q」（第 2、5 關的說明是這樣寫的；codex 第一輪：只認「算式 ＝ 數」的話這些整句都沒驗） */
  const rev = /(?<![\d.\/])(?<![×+\-÷=] ?)(\d+) ?= ?(\d+(?: ?[×+\-] ?\d+)+)(?! ?[×+\-÷=\d])(?!\.\d)/g;
  while ((m = rev.exec(t))){
    const got = +m[1], toks = m[2].split(/ ?([×+\-]) ?/), terms = [];
    let cur = +toks[0], sign = 1;
    for (let i = 1; i < toks.length; i += 2){
      const op = toks[i], v = +toks[i + 1];
      if (op === '×') cur *= v; else { terms.push(sign * cur); sign = op === '-' ? -1 : 1; cur = v; }
    }
    terms.push(sign * cur);
    const val = terms.reduce((a, b) => a + b, 0);
    out.push({ text:m[0], bad:val === got ? null : 'should be ' + val });
  }
  return out;
}

module.exports = {
  breaks: [
    /* ---- review.html：第一次跑抓到的四個舊缺陷，各改回去一次 ---- */
    { file:'review', expect:'English ordinal', find:"'What is the ' + ordEn(d.n) + ' multiple of '", replace:"'What is the ' + d.n + 'th multiple of '" },
    { file:'review', expect:'copied straight out of the stem', find:"var offs = shuffle(n > 3 ? [-2, -1, 1, 2] : [-1, 1, 2]).slice(0, 3);", replace:"var offs = shuffle([-2, -1, 1, 2]).slice(0, 3);" },
    { file:'review', expect:'copied straight out of the stem', find:".filter(function(v){ return v > 0 && v !== k && v !== range && v !== c; }).slice(0, 3);", replace:".filter(function(v){ return v > 0 && v !== c; }).slice(0, 3);" },
    { file:'review', expect:'copied straight out of the stem', find:"var wrongs = [k * mm, k * (mm + 2), x + k];", replace:"var wrongs = [k * mm, k * (mm + 2), x];" },
    /* review.html：不變條件與第二套實作 */
    { file:'review', expect:'is also a multiple of', find:"if (cand > 0 && cand % k !== 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand);", replace:"if (cand > 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var c = Math.floor(range / k);", replace:"        var c = Math.ceil(range / k);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var ans = k * (mm + 1);", replace:"        var ans = k * (mm + 2);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var a = p[0], b = p[1], l = lcm(a, b);", replace:"        var a = p[0], b = p[1], l = a * b / gcd(a, b) * (a % 2 ? 1 : 1) + (a === 4 && b === 6 ? 12 : 0);" },
    { file:'review', expect:'is NOT a factor of', find:"var three = shuffle(facs.filter(function(f){ return f > 1 && f < n; })).slice(0, 3);", replace:"var three = shuffle(facs.filter(function(f){ return f > 1 && f < n; })).slice(0, 2).concat([n + 1]);" },
    { file:'review', expect:'is also true', find:"var m = mixOpts(correct, [['mul', a, c], ['fac', c, a], ['fac', c, b]]);", replace:"var m = mixOpts(correct, [['mul', c, b], ['fac', c, a], ['fac', c, b]]);" },
    { file:'review', expect:'outside', find:"        var c = k * (4 + rand(6));", replace:"        var c = k * (40 + rand(6));" },
    { file:'review', expect:'the smallest multiple', find:"var m = mixOpts(k, [1, d2, 2 * k]);", replace:"var m = mixOpts(k, [1, d2, 3 * k]); m.opts[m.ans] = String(2 * k);" },

    /* ---- index.html：題庫 ---- */
    { file:'index', expect:'should be 11', find:"opts:['9 個','11 個','10 個','12 個'], ans:1,", replace:"opts:['9 個','11 個','10 個','12 個'], ans:2," },
    { file:'index', expect:'is the only multiple of 7 between', find:"opts:['56','55','49','63'], ans:0,\n          why:'7 的倍數", replace:"opts:['58','55','49','63'], ans:0,\n          why:'7 的倍數" },
    { file:'index', expect:'arithmetic', find:"why:'36 ÷ 6 = 6，整除。", replace:"why:'36 ÷ 6 = 7，整除。" },
    { file:'index', expect:'arithmetic', find:"why:'Bus #n leaves at minute n×8, so bus #4 leaves at 4×8 = 32", replace:"why:'Bus #n leaves at minute n×8, so bus #4 leaves at 4×8 = 36" },

    /* ---- index.html：小遊戲的資料與規則 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['hop', 'check', 'tag', 'bus', 'range'];", replace:"var GAME_ORDER = ['hop', 'tag', 'check', 'bus', 'range'];" },
    { file:'index', expect:'under 44', find:"  var GPICK = 48;", replace:"  var GPICK = 44;" },
    { file:'index', expect:'jumps do not fit', find:"var GAME_HOP = [3, 4, 5, 6];", replace:"var GAME_HOP = [3, 4, 5, 7];" },
    { file:'index', expect:'hopRefuse(', find:"    if (v === pos + n) return null;", replace:"    if (v > pos && (v - pos) % n === 0) return null;" },
    { file:'index', expect:'hopRefuse(', find:"    if (pos === 0 && v === 1) return 'one';", replace:"" },
    { file:'index', expect:'hopRefuse(', find:"    if (v <= pos) return 'stay';", replace:"    if (v < pos) return 'stay';" },
    { file:'index', expect:'hop square', find:"return { x:G.x0 + (i % G.cols) * G.step, y:G.y0 + Math.floor(i / G.cols) * G.step, w:G.cell, h:G.cell };", replace:"return { x:G.x0 + (i % G.cols) * G.step, y:G.y0 + Math.floor(i / G.cols) * (G.step - 6), w:G.cell, h:G.cell };" },
    { file:'index', expect:'跳過頭', find:"+ ' 格，跳過頭了：青蛙一次只跳 '", replace:"+ ' 格，還差一點：青蛙一次只跳 '" },
    { file:'index', expect:'basket is accepted', find:"    if ((r === 0) === yes) return null;", replace:"    if ((r === 0 || v % 10 === k % 10) === yes) return null;" },
    { file:'index', expect:'last-digit trap', find:"{ k:7, nums:[28, 56, 63, 27, 47, 57] },", replace:"{ k:7, nums:[28, 56, 63, 25, 45, 53] }," },
    { file:'index', expect:'multiples of', find:"{ k:4, nums:[28, 36, 52, 64, 14, 34] },", replace:"{ k:4, nums:[28, 36, 52, 64, 44, 34] }," },
    { file:'index', expect:'must not say "個位"', find:"+ (w.digit ? '（個位是 ' + k + ' 不算數）' : '') + '。';", replace:"+ '（個位是 ' + k + ' 不算數）。';" },
    { file:'index', expect:'checkOrder(', find:"    if (grouped){ var t = a[0]; a[0] = a[a.length - 1]; a[a.length - 1] = t; }", replace:"" },
    { file:'index', expect:'check spot', find:"spotX:[38, 106], spotY:[194, 246, 298]", replace:"spotX:[38, 96], spotY:[194, 246, 298]" },
    { file:'index', expect:'expected twice', find:"    if (tag === tagRole(j)) return null;", replace:"    if (tag === tagRole(j) || (r === 1 && j === 0)) return null;" },
    { file:'index', expect:'expected twice', find:"    return (r === 1 && j === 0) ? 'twice' : 'fac';", replace:"    return 'fac';" },
    { file:'index', expect:'GAME_TAG', find:"var GAME_TAG = [[3, 4, 2],", replace:"var GAME_TAG = [[3, 4, 9]," },
    { file:'index', expect:'must say "第一條是乘出來的（倍數）"', find:"+ ' 在第一條是乘出來的（倍數），在這一條 '", replace:"+ ' 在第一條也是拿來乘的，在這一條 '" },
    { file:'index', expect:'tag target r0 c0 is outside', find:"tagW:96, tagH:44, rowY:[14, 136]", replace:"tagW:104, tagH:44, rowY:[14, 136]" },
    { file:'index', expect:'busWhy1(', find:"    if (t === e.k * (e.m - 1)) return { why:'zero', j:e.m - 1 };", replace:"" },
    { file:'index', expect:'GAME_BUS', find:"{ k:8, m:7, j:5 },", replace:"{ k:8, m:7, j:7 }," },
    { file:'index', expect:'readInt(', find:"function readInt(s){ s = String(s).trim(); return /^(0|[1-9]\\d{0,3})$/.test(s) ? +s : null; }", replace:"function readInt(s){ s = String(s).replace(/\\s+/g, ''); return /^\\d{1,4}$/.test(s) ? +s : null; }" },
    { file:'index', expect:'bus 1 and bus 2', find:"function busX(k, t){ return BUS_G.x0 + (BUS_G.x1 - BUS_G.x0) * t / (BUS_G.span * k); }", replace:"function busX(k, t){ return BUS_G.x0 + (BUS_G.x1 - BUS_G.x0) * Math.sqrt(t / (BUS_G.span * k)); }" },
    { file:'index', expect:'GAME_RANGE', find:"{ k:9, a:60 },", replace:"{ k:9, a:63 }," },
    { file:'index', expect:'rangeAns gives', find:"for (var v = e.a; v < e.a + RANGE_N; v++) if (v % e.k === 0) out.push(v);", replace:"for (var v = e.a; v < e.a + RANGE_N - 1; v++) if (v % e.k === 0) out.push(v);" },
    { file:'index', expect:'under 44px on a phone', find:"var RANGE_G = { cols:5, cellW:54, cellH:46,", replace:"var RANGE_G = { cols:5, cellW:54, cellH:42," },
    { file:'index', expect:'singular after 1', find:"'Not yet — ' + miss + ' more ' + plEn(miss, 'multiple') + ' of '", replace:"'Not yet — ' + miss + ' more multiples of '" },

    /* ---- index.html：RENDER 裡呼叫判斷的那一行、拖拉引擎 ---- */
    { file:'index', expect:'hop: a refused jump', find:"        if (why){ roundMiss(d.gHopWhy(why, n, pos, t.v)); return false; }", replace:"        if (why){ return false; }" },
    { file:'index', expect:'hop: the landing', find:"        pos = t.v; landed.push(pos);", replace:"        pos = pos + n; landed.push(pos);" },
    { file:'index', expect:'check: the basket', find:"        var why = checkRefuse(k, P.data.v, t.yes);", replace:"        var why = checkRefuse(k, P.data.v, true);" },
    { file:'index', expect:'checkOrder(e.nums, k)', find:"      var pieces = checkOrder(e.nums, k).map(", replace:"      var pieces = e.nums.map(" },
    { file:'index', expect:'tag: the tag', find:"        var why = tagRefuse(e, s.r, s.j, P.data.tag);", replace:"        var why = tagRefuse(e, s.r, s.j, tagRole(s.j));" },
    { file:'index', expect:'is not kept selected', find:"        else { roundInfo(d.gTagOk(P.data.tag, rows[s.r], s.j)); refreshHint(); if (pt.tap) keepSelected(B, P); }", replace:"        else { roundInfo(d.gTagOk(P.data.tag, rows[s.r], s.j)); refreshHint(); }" },
    { file:'index', expect:'is not kept selected', find:"        else { P.home(); roundInfo(d.gHopOk(n, landed.length, pos)); refreshHint(); if (pt.tap) keepSelected(B, P); }", replace:"        else { P.home(); roundInfo(d.gHopOk(n, landed.length, pos)); refreshHint(); }" },
    { file:'index', expect:'the same wrong answer', find:"        if (t === lastBad) return;", replace:"        if (false) return;" },
    { file:'index', expect:'ev.repeat', find:"if (!ev.repeat) check();", replace:"check();" },
    { file:'index', expect:'busWhy1(e, t)', find:"roundMiss(qi === 0 ? d.gBusWhy1(e, t, busWhy1(e, t)) : d.gBusWhy2(e, t, busWhy2(e, t)));", replace:"roundMiss(qi === 0 ? d.gBusWhy1(e, t, busWhy1(e, t + 1)) : d.gBusWhy2(e, t, busWhy2(e, t)));" },
    { file:'index', expect:'a tapped square', find:"          if (v % e.k === 0){\n            b.disabled = true;", replace:"          if (v % 2 === 0){\n            b.disabled = true;" },
    { file:'index', expect:'again is not free', find:"          if (bad[v]) return;", replace:"          if (false) return;" },
    { file:'index', expect:'a premature claim is not checked', find:"        if (miss){\n          if (lastClaim", replace:"        if (false){\n          if (lastClaim" },
    { file:'index', expect:'claiming again with nothing new', find:"          if (lastClaim === found) return;", replace:"          if (false) return;" },
    { file:'index', expect:'first pointer', find:"      if (P.locked || gSolved || start) return;", replace:"      if (P.locked || gSolved) return;" },
    { file:'index', expect:'lostpointercapture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });", replace:"" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;", replace:"      if (false) return;" },
    { file:'index', expect:'pointer-events:none', find:"  .gpiece.locked{cursor:default;pointer-events:none}", replace:"  .gpiece.locked{cursor:default}" },
    { file:'index', expect:'touch-action:none', find:"    touch-action:none;cursor:grab;", replace:"    cursor:grab;" },
    { file:'index', expect:'hint is not cleared', find:"    elHint.textContent = '';   /* 過關就把提示清掉", replace:"    void 0;   /* 過關就把提示清掉" },
    { file:'index', expect:'scoring', find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:'index', expect:'roundMiss() at score', find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;" },
    { file:'index', expect:'roundMiss() at score 0', find:"    var lost = gScore >= 5 ? 5 : 0;", replace:"    var lost = 5;" },
    { file:'index', expect:'nearestAny(): a point inside the big box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop nearest to a finished box', find:"  function nearestOpen(list, pt, pad){ var b = nearestAny(list, pt, pad); return b && !b.done ? b : null; }", replace:"  function nearestOpen(list, pt, pad){ var b = nearestAny(list, pt, pad); return b; }" },
    { file:'index', expect:'nearestAny() on the', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'dropTarget(', find:"    if ((tc && tc.done) || (tf && tf.done)) return null;", replace:"" },
    { file:'index', expect:'dropTarget(', find:"    if (good(tf)) return tf;", replace:"" },
    { file:'index', expect:'shuffle()', find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }", replace:"" },
    { file:'index', expect:'the ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"" },
    { file:'index', expect:'gAsks.hop', find:"hop: '把青蛙拖到下一次落腳的格子（也可以先點青蛙、再點格子），連跳 5 次。',", replace:"hop: '把青蛙拖到下一次落腳的格子（也可以先點青蛙、再點格子），連跳 6 次。'," },
    /* ---- codex 第一輪補上的檢查，各一筆 ---- */
    { file:'index', expect:'HOP_TOP should be 30', find:"var HOP_JUMPS = 5, HOP_TOP = 30;", replace:"var HOP_JUMPS = 5, HOP_TOP = 31;" },
    { file:'index', expect:'numbers should be exactly', find:"gHopSay: function(n){ return '🐸 jumps ' + n + ' squares each time'; },", replace:"gHopSay: function(n){ return '🐸 jumps ' + n + ' squares each time (up to 99)'; }," },
    { file:'index', expect:'must not say "not"', find:"tag === 'fac' ? row[j] + ' is a factor of ' + row[2] + '.'", replace:"tag === 'fac' ? row[j] + ' is not a factor of ' + row[2] + '.'" },
    { file:'index', expect:'must not say "不是因數"', find:"'，在這一條算式裡 ' + row[2] + ' 是 ' + row[0] + ' 和 ' + row[1] + ' 的倍數，要貼「倍數」。'", replace:"'，在這一條算式裡 ' + row[2] + ' 是 ' + row[0] + ' 和 ' + row[1] + ' 的倍數，要貼「倍數」，不是因數。'" },
    { file:'index', expect:'an equation is no longer checkable', find:"+ '：' + n + ' × ' + j + ' ＝ ' + pos + '。'; },", replace:"+ '：' + n + ' × ' + j + ' 得 ' + pos + '。'; }," },
    { file:'index', expect:'busWhy1(201)', find:"    if (t === e.m + e.k) return { why:'add' };", replace:"    if (t > 200) return { why:'other', j:1 };\n    if (t === e.m + e.k) return { why:'add' };" },
    { file:'index', expect:'busWhy2(31)', find:"  function busWhy2(e, j2){ return { at:e.k * j2 }; }", replace:"  function busWhy2(e, j2){ return { at:j2 > 30 ? 0 : e.k * j2 }; }" },
    { file:'index', expect:'qs[4] zh: the stem should ask', find:"{ stem:'5 的倍數一共有幾個？',", replace:"{ stem:'5 的因數一共有幾個？'," },
    { file:'index', expect:'qs[2] zh', find:"opts:['7 是 56 的倍數','56 是 7 的倍數','8 是 7 的倍數','56 是 8 的因數'], ans:1,", replace:"opts:['7 是 56 的倍數','56 是 7 的因數','8 是 7 的倍數','56 是 8 的因數'], ans:1," },
    { file:'index', expect:'does not count exactly one', find:"found++; line.textContent = d.gRangeLine(e.k, e.a, last, found);", replace:"found += 2; line.textContent = d.gRangeLine(e.k, e.a, last, found);" },
    { file:'index', expect:'not reset for question 2', find:"qi++; lastBad = null;", replace:"qi++;" },
    { file:'index', expect:'step one level per press', find:"    hintLevel++;\n    showHint();", replace:"    hintLevel += 2;\n    showHint();" },
    { file:'index', expect:'onDocEnd must call end(e, true)', find:"function onDocEnd(e){ end(e, true); }", replace:"function onDocEnd(e){ end(e, false); }" },
    { file:'index', expect:'no document pointercancel', find:"      document.addEventListener('pointercancel', onDocEnd);\n", replace:"" },
    { file:'index', expect:'a release on the piece is not a drop', find:"el.addEventListener('pointerup', function(e){ end(e, false); });", replace:"el.addEventListener('pointerup', function(e){ end(e, true); });" },
    { file:'index', expect:'a basket holds only', find:"spotX:[38, 106], spotY:[194, 246, 298]", replace:"spotX:[38, 106], spotY:[194]" },
    { file:'index', expect:'"1 squares"', find:"+ ' is only ' + g + ' ' + plEn(g, 'square') + ' — the frog jumps '", replace:"+ ' is only ' + g + ' squares — the frog jumps '" }
  ],

  sim: {
    INVARIANTS: {
      isMultiple: d => {
        if (!(d.c === d.k * d.q && d.c % d.k === 0)) return 'c != k*q';
        const mults = d.opts.filter(o => o % d.k === 0);
        if (mults.length !== 1) return 'options ' + d.opts + ': ' + mults.length + ' of them are multiples of ' + d.k + ' — one is also a multiple of k (two answers)';
      },
      smallestMultiple: d => {
        if (d.opts.filter(o => o % d.k === 0 && o < d.k).length) return 'an option below k is a multiple of k';
        const ms = d.opts.filter(o => o % d.k === 0);
        if (Math.min.apply(null, ms) !== d.k || d.opts[d.ans] !== d.k) return 'the smallest multiple among the options is not k at ans';
      },
      multiplesCount: d => {
        let c = 0; for (let v = 1; v <= d.range; v++) if (v % d.k === 0) c++;
        if (d.c !== c) return 'c = ' + d.c + ', counting gives ' + c;
        if (d.opts.length !== 4) return 'only ' + d.opts.length + ' options';
      },
      nthMultiple: d => {
        if (d.c !== d.k * d.n) return 'c != k*n';
        for (const o of d.opts) if (!(o > 0 && o % d.k === 0)) return 'option ' + o + ' is not a multiple of ' + d.k + ' (the distractors are neighbouring multiples)';
      },
      nextMultipleAfter: d => {
        let want = d.x + 1; while (want % d.k) want++;
        if (d.ans2 !== want) return 'the smallest multiple of ' + d.k + ' above ' + d.x + ' is ' + want + ', not ' + d.ans2;
        if (d.x % d.k === 0) return 'x is itself a multiple';
        for (const o of d.opts) if (o !== d.ans2 && o > d.x && o < d.ans2 && o % d.k === 0) return 'option ' + o + ' is also a multiple between x and the answer';
      },
      lcmQ: d => {
        if (d.l !== lcmRef(d.a, d.b)) return 'l is not the lcm';
        for (const o of d.opts) if (o !== d.l && o % d.a === 0 && o % d.b === 0 && o < d.l) return 'option ' + o + ' is a smaller common multiple';
      },
      factorCount: d => {
        let c = 0; for (let i = 1; i <= d.n; i++) if (d.n % i === 0) c++;
        if (d.c !== c) return 'factor count ' + d.c + ' != ' + c;
      },
      notFactor: d => {
        if (d.n % d.w === 0) return d.w + ' is a factor of ' + d.n;
        for (const o of d.opts) if (o !== d.w && d.n % o !== 0) return 'option ' + o + ' is NOT a factor of ' + d.n + ' either (two answers)';
      },
      sentenceRel: d => {
        if (d.c !== d.a * d.b) return 'c != a*b';
        const truth = o => o[0] === 'mul' ? (o[1] % o[2] === 0) : (o[2] % o[1] === 0);
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans){ if (!truth(d.opts[i])) return 'the answer sentence is false'; }
          else if (truth(d.opts[i])) return 'distractor ' + JSON.stringify(d.opts[i]) + ' is also true';
        }
      },
      concept: d => { if (['smallest', 'wrongSent', 'infinite'].indexOf(d.v) < 0) return 'unknown concept ' + d.v; }
    },
    expectedCorrect: function(d, genId, lang){
      const unit = lang === 'zh' ? ' 個' : '';
      switch (genId){
        case 'isMultiple': return String(d.k * d.q);
        case 'smallestMultiple': return String(d.k);
        case 'multiplesCount': return Math.floor(d.range / d.k) + unit;
        case 'nthMultiple': return String(d.k * d.n);
        case 'nextMultipleAfter': return String(d.k * (Math.floor(d.x / d.k) + 1));
        case 'lcmQ': return String(lcmRef(d.a, d.b));
        case 'factorCount': { let c = 0; for (let i = 1; i <= d.n; i++) if (d.n % i === 0) c++; return c + unit; }
        case 'notFactor': return String(d.w);
        case 'sentenceRel': return lang === 'zh' ? d.a * d.b + ' 是 ' + d.a + ' 的倍數' : d.a * d.b + ' is a multiple of ' + d.a;
        case 'concept':
          if (d.v === 'smallest') return lang === 'zh' ? '每個數最小的倍數是它自己' : 'Every number’s smallest multiple is itself';
          if (d.v === 'wrongSent') return lang === 'zh' ? '24 是 8 的因數' : '24 is a factor of 8';
          return lang === 'zh' ? '無限，數不完' : 'Endless — they never run out';
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    /* 英文序數：the 3rd／8th／1st…（第一次跑抓到「the 3th multiple」）；中文的「第 n 個」 */
    renderCheck: function(d, q, lang, genId){
      if (genId !== 'nthMultiple') return;
      const want = lang === 'zh' ? '的第 ' + d.n + ' 個倍數' : 'the ' + ordRef(d.n) + ' multiple of ' + d.k;
      if (q.stem.indexOf(want) < 0) return 'English ordinal / stem should say "' + want + '": ' + q.stem;
      if (lang === 'en' && q.why.indexOf('the ' + ordRef(d.n) + ' one') < 0) return 'English ordinal in the explanation should be "' + ordRef(d.n) + '": ' + q.why;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'concept') return;
      if (genId === 'sentenceRel'){
        const re = lang === 'zh' ? /^\d+ 是 \d+ 的(因數|倍數)$/ : /^\d+ is a (factor|multiple) of \d+$/;
        if (!re.test(s)) return 'option "' + s + '" is not a factor/multiple sentence in ' + lang;
        return;
      }
      const m = (genId === 'multiplesCount' || genId === 'factorCount') ? (lang === 'zh' ? s.match(/^(\d+) 個$/) : s.match(/^(\d+)$/)) : s.match(/^(\d+)$/);
      if (!m) return 'option "' + s + '" is not a whole number' + ((genId === 'multiplesCount' || genId === 'factorCount') && lang === 'zh' ? ' with 個' : '');
      const n = +m[1];
      /* 範圍從每個產生器自己的參數推：k ≤ 12、倍數到 k × 10 ＋ 3、公倍數的誘答 a × b 最大 150、因數個數最多 12 */
      const MAX = { isMultiple:9 * 9 + 3, smallestMultiple:24, multiplesCount:50 / 3 + 3, nthMultiple:9 * 10, nextMultipleAfter:9 * 8 + 9, lcmQ:150, factorCount:12 + 2, notFactor:40 / 2 + 1 };
      if (!(n >= 1 && n <= MAX[genId])) return 'option ' + n + ' outside 1~' + Math.floor(MAX[genId]) + ' for ' + genId;
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「倍數跳跳蛙」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GAME_W, GPICK, plEn, ordEn, GAME_HOP, HOP_JUMPS, HOP_TOP, HOP_G, hopCell, hopRefuse, GAME_CHECK, CHECK_G, checkSpot, checkTray, checkRefuse, GAME_TAG, TAG_G, tagRows, tagRole, tagRefuse, GAME_BUS, BUS_G, busX, busWhy1, busWhy2, GAME_RANGE, RANGE_N, RANGE_G, rangeCell, rangeAns, dropTarget}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'];

      /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
      [['17 ÷ 5 ＝ 3 餘 2', true], ['17 ÷ 5 ＝ 2 餘 7', false], ['35 ÷ 4 = 8 remainder 3', true], ['35 ÷ 4 = 8 remainder 2', false], ['12 ÷ 3 = 4', true], ['12 ÷ 3 = 5', false],
       ['14 ÷ 4 = 3', false], ['6 × 7 ＝ 42', true], ['6 × 7 ＝ 43', false], ['3 ＋ 4 ＝ 7', true], ['3 + 4 = 8', false], ['8 × 7 ＝ 56 分', true], ['4×8 = 32.', true], ['4×8 = 36.', false], ['36 ＝ 6 × 6，是', true], ['36 = 6 × 7 — a', false], ['36 = 6 × 6 ÷ 2.', null]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (good === null){ if (r.length) fail('scanEquations() self-test: "' + t + '" is a longer expression — it must not be read as its correct prefix, got ' + JSON.stringify(r)); return; }
          if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" arithmetic ' + e.bad); });
      }));
      /* 釘成精確值：少掃到一條（換了寫法、掃描器讀不懂）或多一條沒有人看過的，都要有人來看 */
      if (checkedEq !== 22) fail(checkedEq + ' equations found in the I18N strings, expected 22 — the arithmetic scan is not reading them all (or a new one needs a look)');

      /* --- 2. 題庫：每一題用自己的算法重算正解（兩種語言） --- */
      const Q = (bank, i, L) => I18N[L][bank][i];
      const val = s => +String(s).replace(/[^\d]/g, '');
      LANGS.forEach(L => {
        const only = (bank, i, pred, what) => {
          const q = Q(bank, i, L), hits = q.opts.map((o, oi) => pred(val(o)) ? oi : -1).filter(x => x >= 0);
          if (hits.length !== 1 || hits[0] !== q.ans) fail(bank + '[' + i + '] ' + L + ': ' + what + ' — options ' + q.opts.join('/') + ' satisfy it at ' + hits + ', marked ' + q.ans);
        };
        only('qs', 0, v => v % 6 === 0, '36 should be the only multiple of 6');
        if (val(Q('qs', 1, L).opts[Q('qs', 1, L).ans]) !== 8) fail('qs[1] ' + L + ': the smallest multiple of 8 should be 8');
        only('qs', 3, v => v % 4 !== 0, 'exactly one option should NOT be a multiple of 4');
        if (val(Q('qsAdv', 0, L).opts[Q('qsAdv', 0, L).ans]) !== 4 * 8) fail('qsAdv[0] ' + L + ': bus 4 at every 8 minutes should be 32');
        only('qsAdv', 1, v => v > 50 && v < 60 && v % 7 === 0, '56 is the only multiple of 7 between 50 and 60');
        { let c = 0; for (let v = 1; v <= 100; v++) if (v % 9 === 0) c++; if (val(Q('qsAdv', 2, L).opts[Q('qsAdv', 2, L).ans]) !== c) fail('qsAdv[2] ' + L + ': multiples of 9 in 1..100 should be ' + c); }
        only('qsAdv', 3, v => v > 45 && v < 54 && v % 6 === 0, 'exactly one option is a multiple of 6 between 45 and 54');
        if (val(Q('qsBoost', 0, L).opts[Q('qsBoost', 0, L).ans]) !== 9) fail('qsBoost[0] ' + L + ': the smallest multiple of 9 should be 9');
        /* 句子題：「x 是 y 的倍數／因數」逐句判真假（codex 第一輪：這幾題只驗了格式） */
        const rel = o => { const m = L === 'zh' ? String(o).match(/^(\d+) 是 (\d+) 的(倍數|因數)$/) : String(o).match(/^(\d+) is a (multiple|factor) of (\d+)$/);
          if (!m) return null; const x = +m[1], y = +(L === 'zh' ? m[2] : m[3]), kind = L === 'zh' ? (m[3] === '倍數' ? 'mul' : 'fac') : (m[2] === 'multiple' ? 'mul' : 'fac');
          return kind === 'mul' ? x % y === 0 : y % x === 0; };
        { const q = Q('qs', 2, L), t = q.opts.map(rel);
          if (t.some(x => x === null) || t.filter(Boolean).length !== 1 || !t[q.ans]) fail('qs[2] ' + L + ': exactly one sentence should be true and marked — truth ' + JSON.stringify(t) + ', marked ' + q.ans); }
        { const q = Q('qs', 5, L), st = gnums(q.stem.replace(/<[^>]+>/g, ''));   /* 「4 是 20 的 ___，20 是 4 的 ___」 */
          const words = q.opts.map(o => String(o).split(/；|; /).map(w => /倍數|multiple/.test(w) ? 'mul' : /因數|factor/.test(w) ? 'fac' : null));
          const ok = words.map(w => w[0] && w[1] && (w[0] === 'mul' ? st[0] % st[1] === 0 : st[1] % st[0] === 0) && (w[1] === 'mul' ? st[2] % st[3] === 0 : st[3] % st[2] === 0));
          if (st.length !== 4 || ok.filter(Boolean).length !== 1 || !ok[q.ans]) fail('qs[5] ' + L + ': exactly one word pair should make both blanks true and be marked — ' + JSON.stringify(ok) + ', marked ' + q.ans); }
        { const q = Q('qs', 4, L), hit = q.opts.map(o => (L === 'zh' ? /數不完/ : /Endless/).test(o));
          /* 題幹問的必須是「倍數」有幾個（問因數的話「數不完」就是錯的） */
          if (!(L === 'zh' ? /^\d+ 的倍數一共有幾個？$/ : /^How many multiples does \d+ have\?$/).test(q.stem)) fail('qs[4] ' + L + ': the stem should ask how many MULTIPLES a number has — got ' + q.stem);
          if (hit.filter(Boolean).length !== 1 || !hit[q.ans]) fail('qs[4] ' + L + ': the marked answer should be the only "endless" option'); }
        { const q = Q('qsBoost', 1, L), a = q.opts[q.ans];
          if (!(L === 'zh' ? /^因數有限，倍數數不完$/ : /^Factors are limited, multiples endless$/).test(a)) fail('qsBoost[1] ' + L + ': the marked answer should say factors are limited and multiples endless — got ' + a); }
      });

      gameChecks(D, I18N, fail, src);
    }
  }
};

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== GAME_TYPES_REF.join())
    fail('GAME_ORDER should be ' + GAME_TYPES_REF.join() + ' (examples 1, 4, 3, then the two word problems), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES_REF.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const needSrc = (re, what) => { if (!re.test(src)) fail(what); };
  const touch = (what, sz) => { if (!(sz * PHONE_K >= 44)) fail(what + ' is ' + (sz * PHONE_K).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const all = [];   /* 每一句遊戲字串，最後一起掃：算式、中文黏數字、英文單複數、undefined */
  const nums = (where, text, want) => {
    all.push([where, text]);
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (!subseqRef(gnums(text), want)) fail(where + ': numbers should read ' + want.join(',') + ' (in this order), got ' + gnums(text).join(',') + ' — ' + text);
  };
  /* 數字要「剛好就是這些」（不是子序列）：用在整句的數字都已知的短字串（codex 第一輪：子序列放得過多出來的 99） */
  const exact = (where, text, want) => { all.push([where, text]); if (gnums(text).join() !== want.join()) fail(where + ': numbers should be exactly ' + want.join(',') + ', got ' + gnums(text).join(',') + ' — ' + text); };
  /* 這一句裡要真的掃到幾條算式（掃不到的算式等於沒驗；codex 第一輪：總數 ≥ 500 看不出一整類句子掉出掃描） */
  const eqn = (where, text, n) => { const r = scanEquations(String(text).replace(/<[^>]+>/g, ' ')); if (r.length !== n) fail(where + ': ' + r.length + ' equation(s) parsed, expected ' + n + ' — an equation is no longer checkable: ' + text); };
  const say = (where, text, must, never) => {
    (must || []).forEach(m => { if (String(text).indexOf(m) < 0) fail(where + ': the sentence must say "' + m + '" — got: ' + text); });
    (never || []).forEach(m => { if (String(text).indexOf(m) >= 0) fail(where + ': the sentence must not say "' + m + '" — got: ' + text); });
  };
  const z = I18N.zh, en = I18N.en;
  touch('GPICK (frog, number cards, tag piles)', D.GPICK);

  /* ---------- 第 1 關：跳格子 ---------- */
  {
    const G = D.HOP_G, H = G.H;
    if (D.HOP_TOP !== 30 || G.cols !== 6) fail('HOP_TOP should be 30 on a 6-column grid (squares 0..30), got ' + D.HOP_TOP + ' / ' + G.cols + ' columns');
    if (D.HOP_JUMPS !== 5) fail('HOP_JUMPS should be 5 (gAsks.hop says so), got ' + D.HOP_JUMPS);
    LANGS.forEach(L => { if (gnums(I18N[L].gAsks.hop).indexOf(D.HOP_JUMPS) < 0) fail('gAsks.hop (' + L + ') does not say ' + D.HOP_JUMPS + ' jumps: ' + I18N[L].gAsks.hop); });
    if (!(D.GAME_HOP.length >= 3)) fail('GAME_HOP should offer at least 3 jump sizes');
    D.GAME_HOP.forEach(n => { if (!(Number.isInteger(n) && n >= 3 && n * D.HOP_JUMPS <= D.HOP_TOP)) fail('GAME_HOP ' + n + ': ' + D.HOP_JUMPS + ' jumps do not fit in 1..' + D.HOP_TOP + ' (or n < 3: the first jump would be next to 1)'); });
    /* 格子：起點 0 在左上角；1..HOP_TOP 由左到右、由上到下，每列 cols 格；不出界、不重疊 */
    const cells = [];
    for (let v = 0; v <= D.HOP_TOP; v++){
      const c = D.hopCell(v); cells.push(c);
      inside(c, 'hop square ' + v, H);
      if (!(c.w * PHONE_K >= 44 && c.h * PHONE_K >= 44)) fail('hop square ' + v + ' is under 44px on a phone');
      if (v){
        const i = v - 1, want = { x:G.x0 + (i % G.cols) * G.step, y:G.y0 + Math.floor(i / G.cols) * G.step };
        if (c.x !== want.x || c.y !== want.y) fail('hop square ' + v + ' is drawn at ' + c.x + ',' + c.y + ' — reading order puts it at ' + want.x + ',' + want.y);
      }
    }
    noHits(cells, 'hop squares');
    inside({ x:G.sayX, y:G.padY, w:G.sayW, h:G.cell }, 'the "jumps n" line', H);
    if (hit({ x:G.sayX, y:G.padY, w:G.sayW, h:G.cell }, cells[0]) || cells.slice(1).some(c => hit({ x:G.sayX, y:G.padY, w:G.sayW, h:G.cell }, c))) fail('the "jumps n" line overlaps a square');
    /* 每一題：每一個位置 × 每一個格子，hopRefuse 和自己的規則一樣；只走收的那一步，一定走完、落腳的就是 n × 1..5 */
    const whyRef = (n, pos, v) => v === pos + n ? null : v <= pos ? 'stay' : (pos === 0 && v === 1) ? 'one' : v < pos + n ? 'short' : 'long';
    D.GAME_HOP.forEach(n => {
      let pos = 0; const landed = [];
      for (let step = 0; step < D.HOP_JUMPS; step++){
        let ok = null;
        for (let v = 0; v <= D.HOP_TOP; v++){
          const got = D.hopRefuse(n, pos, v), want = whyRef(n, pos, v);
          if (got !== want){ fail('hopRefuse(' + n + ', ' + pos + ', ' + v + ') is ' + got + ', expected ' + want); continue; }
          if (got === null) ok = v;
          if (got === 'one' || got === 'short' || got === 'long') LANGS.forEach(L => {
            const t = I18N[L].gHopWhy(got, n, pos, v), where = 'hop n=' + n + ' ' + pos + '→' + v + ' (' + L + ')';
            if (got === 'one'){ nums(where, t, [1, 0, n]); say(where, t, L === 'zh' ? ['不是從 1 開始'] : ['don’t start at 1']); }
            else {
              nums(where, t, [pos, v, v - pos, n]);
              if (got === 'short') say(where, t, L === 'zh' ? ['只有'] : ['is only'], L === 'zh' ? ['跳過頭'] : ['too far']);
              else say(where, t, L === 'zh' ? ['跳過頭', '中間要先落腳'] : ['too far', 'in between'], L === 'zh' ? ['只有'] : ['is only']);
            }
          });
        }
        if (ok === null) return fail('hop n=' + n + ': from ' + pos + ' no square is accepted — the round cannot be finished');
        pos = ok; landed.push(pos);
        LANGS.forEach(L => { const t = I18N[L].gHopOk(n, landed.length, pos); nums('gHopOk n=' + n + ' jump ' + landed.length + ' (' + L + ')', t, [landed.length, pos, n, landed.length, pos]); eqn('gHopOk n=' + n + ' (' + L + ') equation', t, 1); });
        LANGS.forEach(L => nums('gHop2 ' + pos, I18N[L].gHop2(landed.length > 1 ? landed[landed.length - 2] : 0, n), [landed.length > 1 ? landed[landed.length - 2] : 0, n]));
      }
      const want = [1, 2, 3, 4, 5].slice(0, D.HOP_JUMPS).map(j => n * j);
      if (landed.join() !== want.join()) fail('hop n=' + n + ': playing by the rules lands on ' + landed + ', the multiples are ' + want);
      if (!landed.every(v => v % n === 0)) fail('hop n=' + n + ': a landing is not a multiple');
      LANGS.forEach(L => { const t = I18N[L].gHopDone(n, landed); nums('gHopDone n=' + n + ' (' + L + ')', t, landed.concat([n, n, n])); say('gHopDone (' + L + ')', t, L === 'zh' ? ['自己開始'] : ['itself'], L === 'zh' ? ['不是'] : ['not', 'don’t']); });
      LANGS.forEach(L => { exact('gHopSay ' + n + ' (' + L + ')', I18N[L].gHopSay(n), [n]); exact('gHopLine (' + L + ')', I18N[L].gHopLine(landed), landed); exact('gHopLine start (' + L + ')', I18N[L].gHopLine([]), [0]); });
    });
    need('hop', /var why = hopRefuse\(n, pos, t\.v\);/, 'the square that is judged is not the square it was dropped on (hopRefuse(n, pos, t.v))');
    need('hop', /if \(why === 'stay'\) return false;/, 'a jump back / in place is not silent');
    need('hop', /if \(why\)\{ roundMiss\(d\.gHopWhy\(why, n, pos, t\.v\)\); return false; \}/, 'a refused jump is not a mistake with its reason (gHopWhy)');
    need('hop', /pos = t\.v; landed\.push\(pos\);/, 'the landing is not the square that was accepted');
    need('hop', /nearestAny\(cells, pt, G\.pad\), f \? nearestAny\(cells, f, G\.pad\) : null, function\(c\)\{ return !hopRefuse\(n, pos, c\.v\); \}/, 'the drop target is not chosen by centre and finger (dropTarget with hopRefuse)');
    need('hop', /if \(pt\.tap\) keepSelected\(B, P\);/, 'after a tap-jump the frog is not kept selected');
    need('hop', /addZone\(B, G\.sayX, G\.padY, G\.sayW, G\.cell, 'gsay', d\.gHopSay\(n\)\);/, 'the board does not show the jump size n (the picture must determine the answer)');
  }

  /* ---------- 第 2 關：除法檢查站 ---------- */
  {
    const G = D.CHECK_G, H = G.H;
    if (!(D.GAME_CHECK.length >= 4)) fail('GAME_CHECK should be a pool of at least 4');
    D.GAME_CHECK.forEach((e, ei) => {
      const tag = 'GAME_CHECK[' + ei + '] k=' + e.k, m = e.nums.filter(v => v % e.k === 0).length;
      if (e.nums.length !== 6 || new Set(e.nums).size !== 6 || !e.nums.every(v => Number.isInteger(v) && v >= 10 && v <= 99)) fail(tag + ': six different two-digit numbers needed: ' + e.nums);
      if (!(m >= 2 && m <= 4)) fail(tag + ': ' + m + ' multiples of ' + e.k + ' — should be 2~4 (both baskets get cards, the count gives nothing away)');
      if (!e.nums.some(v => v % e.k !== 0 && v % 10 === e.k % 10)) fail(tag + ': no last-digit trap (a number ending in ' + e.k + ' that is not a multiple)');
      if (G.spotX.length * G.spotY.length < Math.max(m, 6 - m)) fail(tag + ': a basket holds only ' + G.spotX.length * G.spotY.length + ' cards, this set needs ' + Math.max(m, 6 - m));
      e.nums.forEach(v => [true, false].forEach(yes => {
        const got = D.checkRefuse(e.k, v, yes), isM = v % e.k === 0;
        if ((got === null) !== (isM === yes)) return fail(tag + ': ' + v + ' in the "' + (yes ? 'is' : 'is not') + '" basket is ' + (got === null ? 'accepted' : 'refused') + ' — ' + v + ' ÷ ' + e.k + ' has remainder ' + (v % e.k));
        if (got){
          const q = Math.floor(v / e.k), r = v % e.k, trap = v % 10 === e.k % 10;
          if (got.q !== q || got.r !== r || got.digit !== trap) fail(tag + ': checkRefuse(' + v + ') = ' + JSON.stringify(got) + ', expected q ' + q + ' r ' + r + ' digit ' + trap);
          LANGS.forEach(L => {
            const t = I18N[L].gCheckWhy(yes, v, e.k, got), where = tag + ' ' + v + ' in "' + (yes ? 'is' : 'is not') + '" (' + L + ')';
            eqn(where + ' equation', t, yes ? 1 : 2);
            if (yes){
              nums(where, t, [v, e.k, q, r, v, e.k].concat(trap ? [e.k] : []));
              say(where, t, L === 'zh' ? ['除不盡', '不是'] : ['doesn’t divide evenly', 'not a multiple'], L === 'zh' ? ['整除'] : ['exactly']);
              if (trap) say(where, t, L === 'zh' ? ['個位'] : ['ending in']); else say(where, t, [], L === 'zh' ? ['個位'] : ['ending in']);
            } else {
              nums(where, t, [v, e.k, q, v, e.k, q, e.k]);
              say(where, t, L === 'zh' ? ['整除', '是 ' + e.k + ' 的倍數'] : ['exactly', 'it is a multiple of ' + e.k], L === 'zh' ? ['除不盡'] : ['remainder']);
            }
          });
        } else LANGS.forEach(L => {
          const t = I18N[L].gCheckOk(yes, v, e.k);
          if (yes) exact(tag + ' ok ' + v + ' (' + L + ')', t, [v, e.k, v / e.k]); else exact(tag + ' ok ' + v + ' (' + L + ')', t, [v, e.k, Math.floor(v / e.k), v % e.k]);
          eqn(tag + ' ok ' + v + ' (' + L + ') equation', t, 1);
          const h2 = I18N[L].gCheck2(v, e.k);
          exact(tag + ' hint2 ' + v + ' (' + L + ')', h2, [v, e.k, e.k, Math.floor(v / e.k), e.k * Math.floor(v / e.k)]); eqn(tag + ' hint2 ' + v + ' (' + L + ') equation', h2, 1);
        });
      }));
      LANGS.forEach(L => {
        nums(tag + ' done (' + L + ')', I18N[L].gCheckDone(e.k), [e.k, e.k, e.k]);
        [true, false].forEach(yes => { const t = I18N[L].gCheckBin(yes, e.k); nums(tag + ' bin', t, [e.k]); say(tag + ' bin (' + L + ')', t, [], yes ? [L === 'zh' ? '不是' : 'not'] : []); if (!yes) say(tag + ' bin (' + L + ')', t, [L === 'zh' ? '不是' : 'not']); });
        for (let x = 0; x <= 6; x++) exact('gCheckLine (' + L + ')', I18N[L].gCheckLine(x, 6), [x, 6]);
      });
    });
    /* 版面：兩個籃子並排、中間有縫；每個籃子放得下六張、在標籤下面；托盤六張在籃子上面 */
    const bins = [0, 1].map(bi => ({ x:G.binX[bi], y:G.binY, w:G.binW, h:G.binH }));
    bins.forEach((b, bi) => inside(b, 'check basket ' + bi, H));
    if (!(bins[1].x - (bins[0].x + bins[0].w) > 0)) fail('the two check baskets touch — there must be a gap (nearest-basket drops)');
    const tray = [0, 1, 2, 3, 4, 5].map(i => { const p = D.checkTray(i); return box(p.x, p.y, G.cardW, G.cardH); });
    tray.forEach((t, i) => { inside(t, 'check tray card ' + i, H); if (bins.some(b => hit(t, b))) fail('check tray card ' + i + ' overlaps a basket'); });
    noHits(tray, 'check tray cards');
    [0, 1].forEach(bi => {
      const spots = [0, 1, 2, 3, 4, 5].map(j => { const p = D.checkSpot(bi, j); return box(p.x, p.y, G.cardW, G.cardH); }), b = bins[bi];
      spots.forEach((s, j) => { if (!(s.x >= b.x + 3 && s.x + s.w <= b.x + b.w - 3 && s.y >= b.y + 2 + G.lblH + 2 && s.y + s.h <= b.y + b.h - 3)) fail('check spot ' + j + ' of basket ' + bi + ' is not inside the basket below its label: ' + JSON.stringify(s)); });
      noHits(spots, 'check spots in basket ' + bi);
    });
    if (!(G.lblH >= 38)) fail('the basket label box is ' + G.lblH + 'px — the English label takes two lines (≥ 38)');
    touch('a number card', Math.min(G.cardW, G.cardH));
    /* checkOrder()：3000 次，一定是那六張、一定不是「倍數全排在前面」、也不是由小到大 */
    const ssrc = extractFunction(src, 'shuffle'), osrc = extractFunction(src, 'checkOrder');
    let checkOrder = null;
    if (!ssrc || !osrc) fail('cannot find shuffle() / checkOrder() in index.html');
    else { try { checkOrder = new Function(ssrc + '\n' + osrc + '\nreturn checkOrder;')(); } catch (err){ fail('checkOrder() could not be evaluated: ' + err.message); } }
    if (checkOrder) D.GAME_CHECK.forEach(e => {
      const m = e.nums.filter(v => v % e.k === 0).length, seen = new Set();
      for (let i = 0; i < 3000; i++){
        const a = checkOrder(e.nums, e.k);
        if (a.slice().sort((x, y) => x - y).join() !== e.nums.slice().sort((x, y) => x - y).join()) return fail('checkOrder() changed the cards: ' + a);
        if (a.every((v, j) => (v % e.k === 0) === (j < m))) return fail('checkOrder() put every multiple of ' + e.k + ' first: ' + a + ' (the tray mirrors the baskets)');
        if (a.every((v, j) => !j || a[j - 1] < v)) return fail('checkOrder() returned ' + a + ' — already in increasing order');
        seen.add(a.join());
      }
      if (seen.size < 20) fail('checkOrder() of ' + e.nums + ' produced only ' + seen.size + ' orders in 3000 runs');
    });
    need('check', /var why = checkRefuse\(k, P\.data\.v, t\.yes\);/, 'the basket that is judged is not the basket it was dropped in (checkRefuse(k, P.data.v, t.yes))');
    need('check', /if \(why\)\{ roundMiss\(d\.gCheckWhy\(t\.yes, P\.data\.v, k, why\)\); return false; \}/, 'a card in the wrong basket is not refused with gCheckWhy');
    need('check', /var pieces = checkOrder\(e\.nums, k\)\.map\(/, 'the tray is not laid out by checkOrder(e.nums, k)');
    need('check', /function\(b\)\{ return !checkRefuse\(k, P\.data\.v, b\.yes\); \}/, 'the drop target is not chosen with checkRefuse (dropTarget)');
  }

  /* ---------- 第 3 關：貼標籤 ---------- */
  {
    const G = D.TAG_G, H = G.H;
    if (!(D.GAME_TAG.length >= 5)) fail('GAME_TAG should be a pool of at least 5');
    D.GAME_TAG.forEach((e, ei) => {
      const a = e[0], b = e[1], d2 = e[2], c = a * b, ee = c * d2, tag = 'GAME_TAG[' + ei + '] ' + a + '×' + b + '=' + c + ', ' + c + '×' + d2 + '=' + ee;
      if (!(a >= 2 && b >= 2 && d2 >= 2)) fail(tag + ': every number being multiplied must be ≥ 2 (× 1 makes the product equal to a factor)');
      if (!(ee <= 99)) fail(tag + ': the second product ' + ee + ' is over 99');
      if (a === b || d2 === c) fail(tag + ': repeated factor — the two tags of one sentence would be indistinguishable');
      const rows = D.tagRows(e);
      if (JSON.stringify(rows) !== JSON.stringify([[a, b, c], [c, d2, ee]])) fail(tag + ': tagRows gives ' + JSON.stringify(rows));
      rows.forEach((row, r) => row.forEach((v, j) => ['fac', 'mul'].forEach(t => {
        const role = j < 2 ? 'fac' : 'mul', got = D.tagRefuse(e, r, j, t);
        const want = t === role ? null : j === 2 ? 'prod' : (r === 1 && j === 0) ? 'twice' : 'fac';
        if (got !== want) return fail(tag + ': "' + t + '" on ' + v + ' (sentence ' + (r + 1) + ') is ' + got + ', expected ' + want);
        LANGS.forEach(L => {
          const where = tag + ' "' + t + '" on ' + v + ' r' + r + ' (' + L + ')';
          if (got === null){
            const placed = I18N[L].gTagPlaced(t, row, j);
            exact(where + ' placed', placed, t === 'fac' ? [row[2]] : [row[0], row[1]]);
            say(where + ' placed', placed, [t === 'fac' ? (L === 'zh' ? '因數' : 'factor') : (L === 'zh' ? '倍數' : 'multiple')], L === 'zh' ? ['不是'] : ['not']);
            const okt = I18N[L].gTagOk(t, row, j);
            exact(where + ' ok', okt, t === 'fac' ? [row[j], row[2]] : [row[2], row[0], row[1]]);
            say(where + ' ok', okt, [t === 'fac' ? (L === 'zh' ? ' 的因數' : 'is a factor of ' + row[2]) : (L === 'zh' ? ' 的倍數' : 'is a multiple of ' + row[0])], L === 'zh' ? ['不是'] : ['not']);
            nums(where + ' hint2', I18N[L].gTag2(row, j), j === 2 ? [row[2], row[0], row[1]] : [row[j], row[0], row[1], row[2]]);
            return;
          }
          const s = I18N[L].gTagWhy(got, row, j);
          eqn(where + ' equation', s, 1);
          if (got === 'prod'){ nums(where, s, [row[2], row[0], row[1], row[2], row[2], row[0], row[1]]); say(where, s, L === 'zh' ? ['乘出來', '在這一條算式裡', '要貼「倍數」'] : ['product', 'in this sentence', 'multiple tag'], L === 'zh' ? ['不是因數'] : ['not a factor']); }
          else if (got === 'twice'){ nums(where, s, [v, row[0], row[1], row[2], v, row[2]]); say(where, s, L === 'zh' ? ['第一條是乘出來的（倍數）', '是 ' + row[2] + ' 的因數'] : ['first sentence ' + v + ' was the product (a multiple)', 'factor of ' + row[2]]); if (rows[0][2] !== v) fail(where + ': the "twice" reason names ' + v + ', which is not the product of sentence 1'); }
          else { nums(where, s, [v, row[0], row[1], row[2], v, row[2], row[2], v]); say(where, s, L === 'zh' ? ['拿來乘', '在這一條算式裡', '因數'] : ['being multiplied', 'in this sentence', 'factor of ' + row[2]], L === 'zh' ? ['乘出來', '不是倍數'] : ['the product:', 'not a multiple']); }
        });
      })));
      LANGS.forEach(L => { const t = I18N[L].gTagDone(rows); nums(tag + ' done (' + L + ')', t, [c, a, b, c, c, d2, ee]); eqn(tag + ' done (' + L + ') equations', t, 2); });
    });
    LANGS.forEach(L => { for (let x = 0; x <= 6; x++) exact('gTagLine (' + L + ')', I18N[L].gTagLine(x, 6), [x, 6]); if (!I18N[L].gTagPile || !I18N[L].gTagPile.fac || !I18N[L].gTagPile.mul) fail('gTagPile missing in ' + L); });
    /* 版面：六個目標（數字＋下面的空格）互不重疊、相鄰的中間有縫；運算符號在兩個數字之間不碰數字；兩疊標籤在算式下面 */
    const zones = [], numbers = [];
    G.rowY.forEach((y, r) => G.colX.forEach((cx, j) => {
      const zb = { x:cx - G.tagW / 2, y:y, w:G.tagW, h:G.boxH + G.gap + G.tagH }; zones.push(zb); inside(zb, 'tag target r' + r + ' c' + j, H);
      numbers.push({ x:cx - G.boxW / 2, y:y, w:G.boxW, h:G.boxH });
    }));
    noHits(zones, 'tag targets');
    for (let j = 0; j + 1 < G.colX.length; j++) if (!((G.colX[j + 1] - G.tagW / 2) - (G.colX[j] + G.tagW / 2) > 0)) fail('tag targets ' + j + ' and ' + (j + 1) + ' touch — there must be a gap');
    G.rowY.forEach(y => [0, 1].forEach(j => {
      const sx = (G.colX[j] + G.colX[j + 1]) / 2, sym = { x:sx - G.symW / 2, y:y, w:G.symW, h:G.boxH };
      if (numbers.some(nb => hit(nb, sym))) fail('the symbol between numbers ' + j + ' and ' + (j + 1) + ' overlaps a number box');
      if (!(G.symW >= 26)) fail('the symbol box is ' + G.symW + 'px — a full-width ＝ needs ≥ 26');
    }));
    const piles = G.pileX.map(x => box(x, G.pileY, G.pileW, G.pileH));
    piles.forEach((p, i) => { inside(p, 'tag pile ' + i, H); if (zones.some(zb => hit(p, zb))) fail('tag pile ' + i + ' overlaps a target'); });
    noHits(piles, 'tag piles');
    touch('a tag pile', Math.min(G.pileW, G.pileH));
    need('tag', /var why = tagRefuse\(e, s\.r, s\.j, P\.data\.tag\);/, 'the tag that is judged is not the tag that was dropped (tagRefuse(e, s.r, s.j, P.data.tag))');
    need('tag', /if \(why\)\{ roundMiss\(d\.gTagWhy\(why, rows\[s\.r\], s\.j\)\); return false; \}/, 'a wrong tag is not refused with gTagWhy');
    need('tag', /if \(pt\.tap\) keepSelected\(B, P\);/, 'after a tap-placement the tag pile is not kept selected');
    need('tag', /return false;    \/\* 那一疊標籤回原位/, 'the tag pile does not go home after a placement (endless pile)');
  }

  /* ---------- 第 4 關：公車時刻表 ---------- */
  {
    const G = D.BUS_G, H = G.H;
    if (!(D.GAME_BUS.length >= 5)) fail('GAME_BUS should be a pool of at least 5');
    D.GAME_BUS.forEach((e, ei) => {
      const tag = 'GAME_BUS[' + ei + '] k=' + e.k + ' m=' + e.m + ' j=' + e.j, A1 = e.k * e.m, v = e.k * e.j;
      if (!(e.m >= 4 && e.j >= 3 && e.m !== e.j && e.k >= 5)) fail(tag + ': m ≥ 4, j ≥ 3, m ≠ j, k ≥ 5 (so listing the buses one by one is slow)');
      if (!(A1 <= 120 && v <= 120)) fail(tag + ': minutes over 120');
      if (e.k * (e.m - 1) === e.m + e.k || (e.m + e.k) % e.k === 0) fail(tag + ': the "counted from 0" and "added" answers collide');
      /* busWhy1：1..200 每一個數，和自己的分類一樣；句子的數字與意思 */
      for (let t = 1; t <= 9999; t++){
        if (t === A1) continue;
        const got = D.busWhy1(e, t);
        const want = t === e.k * (e.m - 1) ? { why:'zero', j:e.m - 1 } : t === e.m + e.k ? { why:'add' } : t % e.k === 0 ? { why:'other', j:t / e.k } : { why:'notMul', q:Math.floor(t / e.k), r:t % e.k };
        if (JSON.stringify(got) !== JSON.stringify(want)){ fail(tag + ': busWhy1(' + t + ') = ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want)); break; }
        if (t > 300 && [999, 1234, 9999].indexOf(t) < 0) continue;   /* 句子：1～300 每一個，再加三個大數（readInt 收到 9999） */
        LANGS.forEach(L => {
          const s = I18N[L].gBusWhy1(e, t, got), where = tag + ' Q1 typed ' + t + ' (' + L + ')';
          eqn(where + ' equation', s, got.why === 'other' || got.why === 'notMul' ? 1 : 0);
          if (got.why === 'zero'){ nums(where, s, [t, e.m - 1, e.k, e.k, e.m, e.m, e.k]); say(where, s, L === 'zh' ? ['不是第 0 分'] : ['not minute 0']); }
          else if (got.why === 'add'){ nums(where, s, [t, e.m, e.k, e.k, e.k, e.m]); say(where, s, L === 'zh' ? ['用乘的'] : ['multiply']); }
          else if (got.why === 'other'){ nums(where, s, [t, got.j, e.k, got.j, t, e.m]); say(where, s, L === 'zh' ? ['不是第 ' + e.m + ' 班'] : ['not bus ' + e.m]); }
          else { nums(where, s, [t, e.k, got.q, got.r, t, e.k]); say(where, s, L === 'zh' ? ['不是 ' + e.k + ' 的倍數'] : ['not a multiple of ' + e.k]); }
        });
      }
      for (let j2 = 1; j2 <= 9999; j2++){
        if (j2 === e.j) continue;
        const got = D.busWhy2(e, j2);
        if (got.at !== e.k * j2){ fail(tag + ': busWhy2(' + j2 + ').at = ' + got.at + ', expected ' + e.k * j2); break; }
        if (j2 > 300 && [999, 1234, 9999].indexOf(j2) < 0) continue;
        LANGS.forEach(L => { const s = I18N[L].gBusWhy2(e, j2, got); nums(tag + ' Q2 typed ' + j2 + ' (' + L + ')', s, [j2, e.k * j2, e.k, j2, e.k * j2, v]); eqn(tag + ' Q2 typed ' + j2 + ' (' + L + ') equation', s, 1); });
      }
      LANGS.forEach(L => {
        exact(tag + ' ask1 (' + L + ')', I18N[L].gBusAsk(0, e), [e.m]); exact(tag + ' ask2 (' + L + ')', I18N[L].gBusAsk(1, e), [v]);
        [['log1', I18N[L].gBusLog(0, e), [e.m, e.k, e.m, A1]], ['log2', I18N[L].gBusLog(1, e), [v, v, e.k, e.j, e.j]],
         ['ok1', I18N[L].gBusOk(0, e), [e.m, A1, e.k, e.m, A1]], ['ok2', I18N[L].gBusOk(1, e), [v, e.k, e.j, e.j]]].forEach(([w, t, want]) => { exact(tag + ' ' + w + ' (' + L + ')', t, want); eqn(tag + ' ' + w + ' (' + L + ') equation', t, 1); });
        nums(tag + ' done (' + L + ')', I18N[L].gBusDone(e), [e.k, 2 * e.k, 3 * e.k, e.k]);
        exact(tag + ' say (' + L + ')', I18N[L].gBusSay(e.k), [e.k, 0]);
        nums(tag + ' hint2 Q1 (' + L + ')', I18N[L].gBus2(0, e), [e.m, e.m, e.k, e.k, e.m]);
        nums(tag + ' hint2 Q2 (' + L + ')', I18N[L].gBus2(1, e), [v, e.k]);
        [1, 2].forEach(i => exact(tag + ' label ' + i + ' (' + L + ')', I18N[L].gBusLbl(i, i * e.k), [i, i * e.k]));
      });
      /* 時間軸：同一把尺 —— 第 1、2 班到 0 分的距離是 1 : 2，「⋯」之前畫不下第 3 班的標籤以外的東西 */
      const x0 = D.busX(e.k, 0), x1 = D.busX(e.k, e.k), x2 = D.busX(e.k, 2 * e.k);
      if (!(Math.abs((x2 - x0) - 2 * (x1 - x0)) < 1e-9 && x0 === G.x0)) fail(tag + ': bus 1 and bus 2 are not drawn on one scale from minute 0 (' + x0 + ', ' + x1 + ', ' + x2 + ')');
      const lbls = [{ x:0, y:G.lblY, w:2 * x0, h:G.lblH }, { x:x1 - G.lblW / 2, y:G.lblY, w:G.lblW, h:G.lblH }, { x:x2 - G.lblW / 2, y:G.lblY, w:G.lblW, h:G.lblH }, { x:D.busX(e.k, 2.6 * e.k), y:G.lblY, w:G.x1 - D.busX(e.k, 2.6 * e.k), h:G.lblH }];
      lbls.forEach((l, i) => inside(l, tag + ' timetable label ' + i, H));
      noHits(lbls, tag + ' timetable labels');
      [x1, x2].forEach((x, i) => inside(box(x, G.busY + G.busH / 2, G.busW, G.busH), tag + ' bus ' + (i + 1), H));
      if (hit(box(x1, G.busY + G.busH / 2, G.busW, G.busH), box(x2, G.busY + G.busH / 2, G.busW, G.busH))) fail(tag + ': the two buses overlap');
    });
    /* 版面：上到下不重疊（標題、公車、軸、標籤、問題、輸入框、按鈕、紀錄） */
    const strip = [[0, G.sayH, 'title'], [G.busY, G.busH, 'buses'], [G.lblY, G.lblH, 'labels'], [G.askY, G.askH, 'question'], [G.inY, G.inH, 'input'], [G.btnY, G.btnH, 'button'], [G.logY, G.logH, 'log']];
    for (let i = 0; i + 1 < strip.length; i++) if (strip[i][0] + strip[i][1] > strip[i + 1][0]) fail('bus board: ' + strip[i][2] + ' runs into ' + strip[i + 1][2]);
    if (!(G.busY + G.busH <= G.lineY - 4 && G.lineY + 4 <= G.lblY)) fail('bus board: the axis is not between the buses and the labels');
    if (!(G.logY + G.logH <= H)) fail('bus board: the log runs off the board');
    touch('the answer box', Math.min(G.inW, G.inH)); touch('the Check button', Math.min(G.okW, G.btnH));
    /* readInt()：從原始碼切出來跑 */
    const rsrc = extractFunction(src, 'readInt');
    let readInt = null;
    if (!rsrc) fail('cannot find readInt() in index.html');
    else { try { readInt = new Function(rsrc + '\nreturn readInt;')(); } catch (err){ fail('readInt() could not be evaluated: ' + err.message); } }
    if (readInt) [['42', 42], [' 42 ', 42], ['4 2', null], ['042', null], ['4.2', null], ['', null], ['0', 0], ['１２', null], ['12a', null], ['1234', 1234], ['12345', null]]
      .forEach(([s, want]) => { const got = readInt(s); if (got !== want) fail('readInt("' + s + '") is ' + got + ', expected ' + want); });
    need('bus', /roundMiss\(qi === 0 \? d\.gBusWhy1\(e, t, busWhy1\(e, t\)\) : d\.gBusWhy2\(e, t, busWhy2\(e, t\)\)\);/, 'a wrong answer is not explained with busWhy1(e, t) / busWhy2(e, t) of the number typed');
    need('bus', /var Q = \[\{ ans:e\.k \* e\.m \}, \{ ans:e\.j \}\];/, 'the two answers are not k × m and j');
    need('bus', /if \(t === lastBad\) return;/, 'the same wrong answer handed in again is penalised again');
    need('bus', /qi\+\+; lastBad = null;/, 'the remembered wrong answer is not reset for question 2 (the same number there would be free)');
    need('bus', /if \(t === null\)\{ gMsg\.textContent = d\.gBusInt; return; \}/, 'a malformed answer is not just a reminder');
    need('bus', /if \(t === 0\)\{ gMsg\.textContent = d\.gBusZero; return; \}/, '0 is not just a reminder');
    need('bus', /if \(!ev\.repeat\) check\(\);/, 'a held-down Enter key hands the answer in again and again (ev.repeat)');
    LANGS.forEach(L => ['gBusInt', 'gBusZero', 'gBusOkBtn', 'gBusLbl0', 'gBusLbl2'].forEach(k => { if (typeof I18N[L][k] !== 'string' || !I18N[L][k]) fail(k + ' missing in ' + L); }));
    say('gBusInt (zh)', z.gBusInt, ['數字中間不要有空格']); say('gBusInt (en)', en.gBusInt, ['no spaces between digits']);
  }

  /* ---------- 第 5 關：找出全部 ---------- */
  {
    const G = D.RANGE_G;
    if (!(D.GAME_RANGE.length >= 5)) fail('GAME_RANGE should be a pool of at least 5');
    if (D.RANGE_N !== 20) fail('RANGE_N should be 20 (5 × 4 squares)');
    D.GAME_RANGE.forEach((e, ei) => {
      const tag = 'GAME_RANGE[' + ei + '] k=' + e.k + ' a=' + e.a, last = e.a + D.RANGE_N - 1, ans = [];
      for (let v = e.a; v <= last; v++) if (v % e.k === 0) ans.push(v);
      if (JSON.stringify(D.rangeAns(e)) !== JSON.stringify(ans)) fail(tag + ': rangeAns gives ' + D.rangeAns(e) + ', the multiples of ' + e.k + ' in ' + e.a + '..' + last + ' are ' + ans);
      if (!(ans.length >= 2)) fail(tag + ': only ' + ans.length + ' multiple(s) — "find them all" needs at least 2');
      if (e.a % e.k === 0) fail(tag + ': the range starts on a multiple — finding the first one by division is the point');
      if (!(last <= 99)) fail(tag + ': numbers over 99');
      LANGS.forEach(L => {
        for (let x = 0; x <= ans.length; x++) exact(tag + ' line (' + L + ')', I18N[L].gRangeLine(e.k, e.a, last, x), L === 'zh' ? [e.a, last, e.k, x] : [e.k, e.a, last, x]);
        ans.forEach(v => { const s = I18N[L].gRangeOk(v, e.k); exact(tag + ' ok ' + v + ' (' + L + ')', s, [v, e.k, v / e.k, e.k]); eqn(tag + ' ok ' + v + ' (' + L + ') equation', s, 1); });
        for (let v = e.a; v <= last; v++) if (v % e.k){ const s = I18N[L].gRangeWhy(v, e.k); exact(tag + ' why ' + v + ' (' + L + ')', s, [v, e.k, Math.floor(v / e.k), v % e.k, e.k]); eqn(tag + ' why ' + v + ' (' + L + ') equation', s, 1); say(tag + ' why (' + L + ')', s, [L === 'zh' ? '不是' : 'not a multiple']); }
        for (let miss = 1; miss <= ans.length; miss++){ const s = I18N[L].gRangeMissing(miss, e.k); nums(tag + ' missing ' + miss + ' (' + L + ')', s, [miss, e.k, e.k]); }
        nums(tag + ' done (' + L + ')', I18N[L].gRangeDone(e.k, e.a, last, ans), (L === 'zh' ? [e.a, last, e.k] : [e.k, e.a, last]).concat(ans, [ans.length, e.k]));
        const q = Math.floor(e.a / e.k);
        const h2 = I18N[L].gRange2(e.k, e.a, ans);
        exact(tag + ' hint2 (' + L + ')', h2, [e.a, e.k, q, e.a % e.k, e.k, q + 1, ans[0], ans.length]); eqn(tag + ' hint2 (' + L + ') equations', h2, 2);
        if (e.k * (q + 1) !== ans[0]) fail(tag + ': the hint\'s "first one is k × (q + 1)" is not the first multiple');
      });
    });
    const cells = [];
    for (let i = 0; i < D.RANGE_N; i++){ const c = D.rangeCell(i); cells.push(c); inside(c, 'range square ' + i, G.H); if (!(Math.min(c.w, c.h) * PHONE_K >= 44)) fail('range square ' + i + ' is under 44px on a phone'); }
    noHits(cells, 'range squares');
    const rows = new Set(cells.map(c => c.y));
    if (rows.size !== D.RANGE_N / G.cols || !cells.every((c, i) => !i || (i % G.cols ? c.x > cells[i - 1].x && c.y === cells[i - 1].y : c.y > cells[i - 1].y))) fail('range squares are not in reading order');
    const btn = { x:(W - G.btnW) / 2, y:G.btnY, w:G.btnW, h:G.btnH };
    inside(btn, 'the "found them all" button', G.H);
    if (cells.some(c => hit(c, btn))) fail('the "found them all" button overlaps a square');
    touch('the "found them all" button', G.btnH);
    need('range', /if \(v % e\.k === 0\)\{\n\s*b\.disabled = true;/, 'a tapped square is not judged by v % e.k');
    need('range', /found\+\+; line\.textContent = d\.gRangeLine\(e\.k, e\.a, last, found\);/, 'a found square does not count exactly one');
    need('range', /if \(bad\[v\]\) return;/, 'tapping an explained wrong square again is not free');
    need('range', /var miss = ans\.length - found;\n\s*if \(miss\)\{/, 'a premature claim is not checked against the multiples still missing');
    need('range', /if \(lastClaim === found\) return;/, 'claiming again with nothing new found is penalised again');
    need('range', /roundMiss\(d\.gRangeMissing\(miss, e\.k\)\);/, 'a premature claim is not a mistake with gRangeMissing');
    need('range', /var miss = ans\.length - found;/, 'the premature claim is not measured against rangeAns');
    LANGS.forEach(L => { if (typeof I18N[L].gRangeClaim !== 'string' || !I18N[L].gRangeClaim) fail('gRangeClaim missing in ' + L); });
    LANGS.forEach(L => { const q = I18N[L].gRangeClaim.replace(/ ✓$/, ''); if (I18N[L].gAsks.range.indexOf(q) < 0) fail('gAsks.range (' + L + ') does not name the button "' + q + '"'); });
  }

  /* ---------- 共用：計分、提示、拖拉引擎 ---------- */
  needSrc(/var pts = gMistake \? 10 : 20;/, 'scoring: a round should give 20 without mistakes, 10 with');
  needSrc(/function roundSolved\(text\)\{[\s\S]{0,400}elHint\.textContent = '';/, 'roundSolved(): the hint is not cleared when a round is solved');
  needSrc(/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'the ahead mode does not show hint level 1 automatically');
  needSrc(/if \(P\.locked \|\| gSolved \|\| start\) return;/, 'drag engine: a second finger on a held piece is not ignored (first pointer only)');
  needSrc(/el\.addEventListener\('pointermove', function\(e\)\{\n\s*if \(!start \|\| e\.pointerId !== pid\) return;/, 'drag engine: pointermove does not follow only the first pointer');
  needSrc(/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'drag engine: lostpointercapture does not release the piece');
  needSrc(/document\.addEventListener\('pointerup', onDocEnd\);/, 'drag engine: no document release while dragging');
  needSrc(/function onDocEnd\(e\)\{ end\(e, true\); \}/, 'drag engine: a release outside the piece is not a cancel (onDocEnd must call end(e, true))');
  needSrc(/document\.addEventListener\('pointercancel', onDocEnd\);/, 'drag engine: no document pointercancel while dragging');
  needSrc(/document\.removeEventListener\('pointercancel', onDocEnd\);/, 'drag engine: the document pointercancel is never removed');
  needSrc(/el\.addEventListener\('pointerup', function\(e\)\{ end\(e, false\); \}\);/, 'drag engine: a release on the piece is not a drop (end(e, false))');
  needSrc(/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/, 'drag engine: pointercancel on the piece is not a cancel');
  needSrc(/if \(hintLevel >= 2\) return;\n\s*hintLevel\+\+;\n\s*showHint\(\);\n\s*if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'hints: the button does not step one level per press and stop at level 2');
  needSrc(/elHint\.textContent = d\.gHints\[type\] \+ \(hintLevel >= 2 && gCtx\.hint2 \? ' ' \+ gCtx\.hint2\(\) : ''\);/, 'hints: level 2 does not add the round\'s own hint2 to the strategy');
  needSrc(/document\.removeEventListener\('pointerup', onDocEnd\);/, 'drag engine: the document release is never removed');
  needSrc(/if \(gen !== gGen\) return;/, 'drag engine: no board generation guard (a piece held across Restart could act on the new board)');
  needSrc(/startRound\(\)\{[\s\S]{0,200}gGen\+\+;/, 'startRound() does not start a new board generation');
  needSrc(/\.gpiece\.locked\{cursor:default;pointer-events:none\}/, 'placed pieces must have pointer-events:none');
  needSrc(/\.gpiece\{[^}]*touch-action:none/, 'pieces must have touch-action:none');
  needSrc(/if \(P\.busy\(\)\) return;/, 'tap-then-tap: a piece being dragged by another finger can be placed by a tap');
  LANGS.forEach(L => {
    ['gNextBtn', 'gRestartBtn', 'gHintBtn', 'gMinus', 'gClear', 'gScoreLabel', 'gRoundLabel'].forEach(k => { if (typeof I18N[L][k] !== 'string') fail(k + ' missing in ' + L); });
    [10, 20].forEach(p => nums('gPts ' + p, I18N[L].gPts(p), [p]));
    nums('gWin', I18N[L].gWin(100), [100]);
  });
  if (!/扣 5 分/.test(z.gMinus) || !/5 points/.test(en.gMinus)) fail('gMinus should say 5 points off');
  {
    const fsrc = extractFunction(src, 'roundMiss');
    let run = null;
    if (!fsrc) fail('cannot find roundMiss() in index.html');
    else {
      try {
        run = new Function('score', 'L', fsrc + '\nvar gMistake = false, gScore = score, elScore = { textContent:"" }, gMsg = { innerHTML:"" };' +
          '\nroundMiss("why");\nreturn { score:gScore, shown:elScore.textContent, html:gMsg.innerHTML, mistake:gMistake };');
      } catch (err){ fail('roundMiss() could not be evaluated: ' + err.message); }
    }
    if (run){
      const Lz = () => I18N.zh;
      [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, s1, minus]) => {
        let r; try { r = run(s0, Lz); } catch (err){ return fail('roundMiss() threw at score ' + s0 + ': ' + err.message); }
        if (r.score !== s1 || String(r.shown) !== String(s1)) fail('roundMiss() at score ' + s0 + ' leaves ' + r.score + ' (shown ' + r.shown + '), expected ' + s1 + ' (−5, floored at 0)');
        if ((r.html.indexOf(I18N.zh.gMinus) >= 0) !== minus) fail('roundMiss() at score ' + s0 + ' ' + (minus ? 'does not say' : 'says') + ' "' + I18N.zh.gMinus + '"');
        if (!r.mistake || r.html.indexOf('why') < 0) fail('roundMiss() at score ' + s0 + ' does not record the mistake / show the reason');
      });
    }
  }
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (err){ fail('shuffle() could not be evaluated on its own: ' + err.message); } }
    if (shuffle){
      const input = [3, 5, 9, 12, 20], before = input.join(), orders = new Set();
      for (let i = 0; i < 3000; i++){
        const out = shuffle(input);
        if (input.join() !== before){ fail('shuffle() mutates its input'); break; }
        if (out.every((v, k) => !k || out[k - 1] < v)){ fail('shuffle() returned ' + out.join(',') + ' — already in increasing order'); break; }
        orders.add(out.join());
      }
      if (orders.size < 10) fail('shuffle() produced only ' + orders.size + ' orders in 3000 runs');
    }
  }
  {
    const fsrc = extractFunction(src, 'nearestOpen'), asrc = extractFunction(src, 'nearestAny');
    let nearestAny = null, nearestOpen = null;
    if (!fsrc || !asrc) fail('cannot find nearestOpen() / nearestAny() in index.html');
    else { try { nearestAny = new Function(asrc + '\nreturn nearestAny;')(); nearestOpen = new Function(asrc + '\n' + fsrc + '\nreturn nearestOpen;')(); } catch (err){ fail('nearestAny() could not be evaluated: ' + err.message); } }
    if (nearestAny){
      /* 自己的「最近」：到方框的距離（框裡是 0），一樣近比到中心 */
      const ref = (list, p, pad) => { let best = null, bd = Infinity, bc = Infinity; list.forEach(b => { const dx = p.x - b.cx, dy = p.y - b.cy; if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return; const ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh), dd = ex * ex + ey * ey, dc = dx * dx + dy * dy; if (dd < bd - 1e-12 || (Math.abs(dd - bd) <= 1e-12 && dc < bc)){ bd = dd; bc = dc; best = b; } }); return best; };
      const sweep = (list, pad, what, H, step) => {
        let bad = 0, overlap = 0;
        for (let x = 0.25; x < W; x += step) for (let y = 0.25; y < H; y += step){
          const p = { x, y }, g = nearestAny(list, p, pad), w = ref(list, p, pad);
          if (g !== w) bad++;
          if (list.filter(b => Math.abs(x - b.cx) <= b.hw + pad && Math.abs(y - b.cy) <= b.hh + pad).length > 1) overlap++;
        }
        if (bad) fail('nearestAny() on the ' + what + ': ' + bad + ' points go to a different target than the nearest box');
        if (!overlap) fail('nearestAny() on the ' + what + ': no point is in two snap zones — the overlap case is not exercised');
      };
      const HG = D.HOP_G, hop = [];
      for (let v = 0; v <= D.HOP_TOP; v++){ const c = D.hopCell(v); hop.push({ v, cx:c.x + c.w / 2, cy:c.y + c.h / 2, hw:c.w / 2, hh:c.h / 2, done:false }); }
      sweep(hop, HG.pad, 'hop squares', HG.H, 0.5);
      const CG = D.CHECK_G, bins = [0, 1].map(bi => ({ bi, cx:CG.binX[bi] + CG.binW / 2, cy:CG.binY + CG.binH / 2, hw:CG.binW / 2, hh:CG.binH / 2, done:false }));
      sweep(bins, CG.pad, 'check baskets', CG.H, 0.5);
      const TG = D.TAG_G, tz = [];
      TG.rowY.forEach((y, r) => TG.colX.forEach((cx, j) => tz.push({ r, j, cx, cy:y + (TG.boxH + TG.gap + TG.tagH) / 2, hw:TG.tagW / 2, hh:(TG.boxH + TG.gap + TG.tagH) / 2, done:false })));
      sweep(tz, TG.pad, 'tag targets', TG.H, 0.5);
      /* 一大一小：大格裡、靠近小格的點，要給大格（量到方框，不是到中心） */
      const two = [{ id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false }];
      const r0 = nearestAny(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestAny(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [{ id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false }];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every box is accepted');
      /* 組起來跑：第 3 關真的格子 → nearestAny() → dropTarget()。第一格已經貼好，手指在它右緣外 1px，「倍數」標籤的中心在第二格（拿來乘的，貼倍數是錯的）
         → 指著已經貼好的格子，靜靜回原位，不可以把第二格判錯 */
      const e0 = D.GAME_TAG[0];
      tz[0].done = true;
      const finger = { x:tz[0].cx + tz[0].hw + 1, y:tz[0].cy }, centre = { x:tz[1].cx, y:tz[1].cy };
      const tcA = nearestAny(tz, centre, TG.pad), tfA = nearestAny(tz, finger, TG.pad);
      if (!(tcA === tz[1] && tfA === tz[0])) fail('composed drop: the geometry no longer puts the centre on target 2 and the finger on the tagged target 1 — rework the case');
      else {
        if (D.dropTarget(tcA, tfA, t => !D.tagRefuse(e0, t.r, t.j, 'mul')) !== null) fail('composed drop: finger on a tagged number, a wrong tag\'s centre over the next one — must be silent');
        if (D.dropTarget(tcA, tfA, t => !D.tagRefuse(e0, t.r, t.j, 'fac')) !== tz[1]) fail('composed drop: a right tag whose centre is over the next open number is not placed there');
      }
      tz[0].done = false;
      /* 手指在對的（乘出來的）、中心在錯的（拿來乘的）→ 收在手指那一格 */
      const gotB = D.dropTarget(nearestAny(tz, { x:tz[1].cx, y:tz[1].cy }, TG.pad), nearestAny(tz, { x:tz[2].cx, y:tz[2].cy }, TG.pad), t => !D.tagRefuse(e0, t.r, t.j, 'mul'));
      if (gotB !== tz[2]) fail('composed drop: "multiple" with the finger on the product and the centre on a factor is not placed on the product');
    }
  }
  {
    const T = { a:{ n:'a', done:false }, b:{ n:'b', done:false }, F:{ n:'F', done:true }, Fa:{ n:'Fa', done:true } }, okA = t => t === T.a || t === T.Fa;
    const cases = [[T.a, T.b, 'a'], [T.b, T.a, 'a'], [T.b, null, 'b'], [null, T.b, 'b'], [null, T.a, 'a'], [T.b, T.b, 'b'], [null, null, null],
                   [T.b, T.F, null], [T.F, T.b, null], [T.F, null, null], [null, T.F, null], [T.F, T.a, 'a'], [T.a, T.F, 'a'], [T.Fa, null, null], [T.Fa, T.b, null]];
    cases.forEach(([tc, tf, want]) => { const g = D.dropTarget(tc, tf, okA); if ((g ? g.n : null) !== want) fail('dropTarget(' + (tc && tc.n) + ', ' + (tf && tf.n) + ') with "a" right and F filled gives ' + (g && g.n) + ', expected ' + want); });
  }

  /* ---------- 每一句遊戲字串：算式重算、中文黏數字、英文 1 後面的複數、undefined ---------- */
  LANGS.forEach(L => ['gAsks', 'gHints'].forEach(k => GAME_TYPES_REF.forEach(t => all.push([k + '.' + t + ' (' + L + ')', I18N[L][k][t]]))));
  let eqs = 0;
  all.forEach(([where, text]) => {
    const plain = String(text).replace(/<[^>]+>/g, ' ');
    scanEquations(plain).forEach(e => { eqs++; if (e.bad) fail(where + ': "' + e.text + '" arithmetic ' + e.bad); });
    const glued = plain.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) fail(where + ': missing space between Chinese and a digit: ' + glued.join(' ') + ' — ' + plain);
    const pl = plain.match(/(?<![\d.])1 (?:more )?(squares|multiples|points|minutes|buses|numbers)\b/);
    if (pl) fail(where + ': "' + pl[0] + '" — singular after 1');
    if (/(^|[^\d])-\d/.test(plain)) fail(where + ': a negative number is shown: ' + plain);
  });
  if (eqs < 500) fail('only ' + eqs + ' equations found in the game strings — the arithmetic scan is not reading them');
}

module.exports._test = { scanEquations };
