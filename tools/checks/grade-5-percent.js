/* grade-5/math/percent 的檢查設定（比率與百分率 — 百分百大挑戰：百格圖、分數／小數／百分率三兄弟、打折、命中率、一個量的百分之幾）。
   2026-10-10 新增 —— 和小遊戲「百分率探險隊」改成五關五種玩法（§六之五）同一次寫成；在這之前這一課沒有設定檔，
   simgen.js／verify_lesson_data.js／breaktest.js 對這一課一律直接報「no check config」。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算）、選項的範圍與格式。
   第一次跑抓到的舊缺陷（已經在 review.html 修好，breaks 裡各有一筆把它改回去）：
   - discountSaved 的「把要付的錢當成省下的」誘答被 .slice(0, 3) 切掉，從來沒出現過；
   - percentOf 的鄰近數誘答會剛好是題幹的 p（9 的鄰居 8 撞上「8%」，還有 4、5、10）—— §六之三第 4 點；
   - simplifyFrac 一題出現 5～6 個選項（五個候選全部交給 mixOpts，它只去重、不截斷）。
   - discountPrice／discountSaved 的鄰近數誘答會剛好是題幹的原價（五折、原價 4 元：答案 2，誘答 1、3、4）—— codex 第一輪。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算 —— 掃描器讀得懂小數、分數（a/b）、百分率（65% ＝ 0.65）
     與連等（13 ÷ 20 ＝ 0.65 ＝ 65%），每一段都要相等；題庫每一題用自己的算法重算正解。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關「收不收、為什麼不收」都是資料區的純函式（gridAt／gridRefuse／trioPct／trioRefuse／cutAt／cutRefuse／shootWhy1／shootWhy2／groupWhy），
     這裡用自己的規則把每一題的每一個動作都跑一遍、再照遊戲的規則從頭玩到完，證明一定解得完、而且解完一定是對的；
     每一句說明兩種語言逐個比數字、比算式，並且用寫死的關鍵詞釘住「話」（必須說／不可以說）；
     版面（不出界、不重疊、375px 觸控 ≥ 44px）從資料區讀；shuffle()／trioOrder()（3000 次）、nearestAny()、roundMiss()、readInt()、dropTarget()
     從原始碼切出來真的跑；RENDER 裡呼叫判斷的那一行、拖拉引擎的第一根手指、三條放開的路、換畫板保護、放好的不擋點擊、
     同一個錯再交一次不再扣，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行 —— codex 第一輪舉的「if (false) 包住那一行」照樣是綠的）；拖拉、點選、兩根手指、capture 遺失、
   文字在框裡、375px 的實際尺寸由 teaching-workspace/game-harness/g5-percent 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { extractFunction } = require('./lib/gameshuffle.js');

const PHONE_K = Math.min(1.5, 289 / 300);
const GAME_TYPES_REF = ['grid', 'trio', 'cut', 'shoot', 'group'];
const ZH_NUM = '零一二三四五六七八九';
function gnums(text){ return (String(text).match(/\d+(?:\.\d+)?/g) || []).map(Number); }
function subseqRef(got, want){ let i = 0; got.forEach(v => { if (i < want.length && Math.abs(v - want[i]) < 1e-9) i++; }); return i === want.length; }
function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }
/* 卡片上的字 → 百分率（自己的算法：分數 a × 100 ÷ b；小數用字串移兩位，不靠浮點） */
function pctRef(t){
  let m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return +m[1] * 100 / +m[2];
  m = /^(\d+)\.(\d{1,2})$/.exec(t);
  if (m) return +m[1] * 100 + +(m[2] + '0').slice(0, 2);
  return NaN;
}
function rowsZhRef(n){ return n < 10 ? n + ' 格' : n % 10 === 0 ? (n / 10) + ' 整排' : Math.floor(n / 10) + ' 整排又 ' + (n % 10) + ' 格'; }

/* 算式掃描：把一段文字裡所有「式子 ＝ 式子（＝ 式子⋯⋯）」找出來，每一段都算出值、連等的每一段都要相等。
   數可以是整數、小數、分數 a/b（值 a ÷ b）、後面帶 %（值 ÷ 100）；運算 × ÷ ＋ −（先乘除後加減）。NT$ 先拿掉。 */
const NUM = '\\d+(?:\\.\\d+)?(?:\\/\\d+)?%?';
const EXPR = NUM + '(?: ?[×÷+\\-] ?' + NUM + ')*';
const CHAIN = new RegExp('(?<![\\d.\\/%])(?<![×÷+\\-] ?)(' + EXPR + '(?: ?= ?' + EXPR + ')+)(?![\\d\\/%]|\\.\\d)(?! ?[×÷+\\-=] ?\\d)', 'g');
function valNum(tok){
  let pct = false, s = tok;
  if (s.endsWith('%')){ pct = true; s = s.slice(0, -1); }
  let v;
  const f = /^(\d+(?:\.\d+)?)\/(\d+)$/.exec(s);
  v = f ? +f[1] / +f[2] : +s;
  return pct ? v / 100 : v;
}
function evalExpr(e){
  const toks = e.trim().split(/ ?([×÷+\-]) ?/);
  const terms = [];
  let cur = valNum(toks[0]), sign = 1;
  for (let i = 1; i < toks.length; i += 2){
    const op = toks[i], v = valNum(toks[i + 1]);
    if (op === '×') cur *= v;
    else if (op === '÷') cur /= v;
    else { terms.push(sign * cur); sign = op === '-' ? -1 : 1; cur = v; }
  }
  terms.push(sign * cur);
  return terms.reduce((a, b) => a + b, 0);
}
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/(?<!NT\$[\d.]*)(\d%?) ?→ ?(?=\d)/g, '$1 = ').replace(/NT\$/g, '').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const out = [];
  let m;
  /* 「≈」是估算，不是等號：這一課不該出現；出現了就當成讀不懂的算式報出來，不靜靜略過（codex 第一輪） */
  if (/\d ?≈ ?\d/.test(t)) out.push({ text:t.slice(0, 40), bad:'"≈" is not checkable here' });
  CHAIN.lastIndex = 0;
  while ((m = CHAIN.exec(t))){
    const parts = m[1].split(/ ?= ?/), vals = parts.map(evalExpr);
    let bad = null;
    for (let i = 1; i < vals.length; i++) if (!(Math.abs(vals[i] - vals[0]) < 1e-9 * Math.max(1, Math.abs(vals[0])))) bad = parts[i] + ' is ' + vals[i] + ', not ' + vals[0];
    out.push({ text:m[1], bad });
  }
  return out;
}

module.exports = {
  breaks: [
    /* ---- review.html：第一次跑抓到的舊缺陷，改回去一次 ---- */
    { file:'review', expect:'the "paid" distractor', find:"var m = mixOpts(saved, (paid !== saved ? [paid] : []).concat(nearWrongs(saved, 6).filter(function(v){ return v !== paid && v !== n; })).slice(0, 3));", replace:"var m = mixOpts(saved, nearWrongs(saved, 6).filter(function(v){ return v !== paid && v !== n; }).concat([paid]).slice(0, 3));" },
    { file:'review', expect:'copied straight out of the stem', find:"nearWrongs(c, 5).filter(function(v){ return v !== p && v !== n; }).slice(0, 3)", replace:"nearWrongs(c, 3)" },
    { file:'review', expect:'option count', find:"if (three.length < 3 && seenV.indexOf(v) < 0){ seenV.push(v); three.push(w); }", replace:"if (seenV.indexOf(v) < 0){ seenV.push(v); three.push(w); }" },
    /* review.html：不變條件與第二套實作 */
    { file:'review', expect:'do not match rate', find:"{ base:200, rate:90, lbl:'九折', elbl:'10% off' },", replace:"{ base:200, rate:90, lbl:'八折', elbl:'10% off' }," },
    { file:'review', expect:'are not the four expected ones', find:"          [winner, diff + 2],", replace:"          [winner, diff + 20]," },
    { file:'review', expect:'trioConvert option', find:"        var m = mixOpts(t.pct, nearWrongs(t.pct, 3));", replace:"        var m = mixOpts(t.pct, [t.pct * 10 > 100 ? t.pct + 1 : t.pct * 10].concat(nearWrongs(t.pct, 2)));" },
    { file:'review', expect:'is not one of the five named slips', find:"var wrongs = [(num - 1) + '/' + den, sn + '/' + (sd + 1),", replace:"var wrongs = [(num - 1) + '/' + (den + 1), sn + '/' + (sd + 1)," },
    { file:'review', expect:'opts[ans] != correct', find:"        var c = n * p / 100;\n        /* 鄰近數", replace:"        var c = n * p / 10;\n        /* 鄰近數" },
    { file:'review', expect:'opts[ans] != correct', find:"        var pct = made * (100 / attempts);", replace:"        var pct = (attempts - made) * (100 / attempts);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var correct = Math.round(numerator * mult) / 10;", replace:"        var correct = Math.round(numerator * mult) / 100;" },
    { file:'review', expect:'opts[ans] != correct', find:"        var sn = num / g, sd = den / g;", replace:"        var sn = num / 2, sd = den / 2;" },
    { file:'review', expect:'shooting percentage options', find:"var ATTEMPTS = [20, 25, 50, 10, 4, 5];", replace:"var ATTEMPTS = [20, 25, 50, 10, 4, 5, 3];" },
    { file:'review', expect:'Shop', find:"var winner = (priceA < priceB) ? 'A' : 'B';", replace:"var winner = (priceA > priceB) ? 'A' : 'B';" },
    { file:'review', expect:'trioConvert', find:"{ frac:'3/5', dec:0.6, pct:60 },", replace:"{ frac:'3/5', dec:0.6, pct:65 }," },

    /* ---- index.html：題庫 ---- */
    { file:'index', expect:'arithmetic', find:"why:'3 ÷ 4 = 0.75 = 75%。' },", replace:"why:'3 ÷ 4 = 0.75 = 70%。' }," },
    { file:'index', expect:'arithmetic', find:"why:'15% = 0.15, and 300 × 0.15 = 45 students.' },", replace:"why:'15% = 0.15, and 300 × 0.15 = 40 students.' }," },
    { file:'index', expect:'qs[5]', find:"opts:['300 元','375 元','280 元','100 元'], ans:0,", replace:"opts:['300 元','375 元','280 元','100 元'], ans:1," },
    { file:'index', expect:'qsAdv[2]', find:"opts:['15 人','30 人','60 人','45 人'], ans:3,", replace:"opts:['15 人','30 人','60 人','45 人'], ans:2," },

    /* ---- index.html：小遊戲的資料與規則 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['grid', 'trio', 'cut', 'shoot', 'group'];", replace:"var GAME_ORDER = ['grid', 'cut', 'trio', 'shoot', 'group'];" },
    { file:'index', expect:'under 44', find:"  var GPICK = 48;", replace:"  var GPICK = 44;" },
    { file:'index', expect:'GAME_GRID', find:"var GAME_GRID = [45, 8, 70, 36, 92, 15, 63, 7];", replace:"var GAME_GRID = [45, 36, 92, 15, 63];" },
    { file:'index', expect:'gridRefuse(', find:"    if (k === p) return null;\n    if (p < 10", replace:"    if (k === p || k === p * 10) return null;\n    if (p < 10" },
    { file:'index', expect:'gridRefuse(', find:"    if (p > 10 && p % 10 && k === (p % 10) * 10 + Math.floor(p / 10)) return 'flip';", replace:"" },
    { file:'index', expect:'gridAt(', find:"      if (dx < bc){ bc = dx; c = k; }", replace:"      if (dx < bc - 3){ bc = dx; c = k; }" },
    { file:'index', expect:'grid square', find:"return { x:G.x0 + c * G.step + (c >= 5 ? G.gap : 0), y:G.y0 + r * G.step + (r >= 5 ? G.gap : 0), w:G.cell, h:G.cell };", replace:"return { x:G.x0 + c * G.step + (c >= 5 ? G.gap : 0), y:G.y0 + r * (G.step - 3) + (r >= 5 ? G.gap : 0), w:G.cell, h:G.cell };" },
    { file:'index', expect:'還不到一整排', find:"+ ' 格，還不到一整排。';", replace:"+ ' 格。';" },
    { file:'index', expect:'GAME_TRIO', find:"[[25, '1/4', '0.25'], [40, '2/5', '0.4'], [4, '4/100', '0.04']],", replace:"[[25, '1/4', '0.25'], [40, '2/5', '0.4'], [4, '4/100', '0.4']]," },
    { file:'index', expect:'ten times', find:"[[50, '1/2', '0.5'], [5, '5/100', '0.05'], [75, '3/4', '0.75']],", replace:"[[50, '1/2', '0.5'], [20, '1/5', '0.2'], [75, '3/4', '0.75']]," },
    { file:'index', expect:'trioPct(', find:"return m ? +m[1] * 100 / +m[2] : Math.round(parseFloat(t) * 100); }", replace:"return m ? +m[1] * 100 / +m[2] : Math.round(parseFloat(t) * 10); }" },
    { file:'index', expect:'house is accepted', find:"  function trioRefuse(t, pct){ var v = trioPct(t); return v === pct ? null : { pct:v }; }", replace:"  function trioRefuse(t, pct){ var v = trioPct(t); return v === pct || v === pct * 10 ? null : { pct:v }; }" },
    { file:'index', expect:'trioOrder(', find:"    if (grouped){ var t = a[0]; a[0] = a[a.length - 1]; a[a.length - 1] = t; }", replace:"" },
    { file:'index', expect:'小數點往右移兩位', find:"+ '%（小數點往右移兩位），不是 '", replace:"+ '%，不是 '" },
    { file:'index', expect:'trio spot', find:"spotY:[190, 246], pad:10, H:314", replace:"spotY:[160, 246], pad:10, H:314" },
    { file:'index', expect:'label box', find:"binY:118, binW:96, binH:190, lblH:44,", replace:"binY:118, binW:96, binH:190, lblH:30," },
    { file:'index', expect:'GAME_CUT', find:"{ p:300, x:7 }, { p:200, x:8 },", replace:"{ p:300, x:5 }, { p:200, x:8 }," },
    { file:'index', expect:'cutRefuse(', find:"function cutRefuse(x, i){ if (i === x) return null;", replace:"function cutRefuse(x, i){ if (i === x || i === 10 - x) return null;" },
    { file:'index', expect:'cutAt(', find:"var i = Math.round((x - CUT_G.x0) / CUT_G.seg);", replace:"var i = Math.floor((x - CUT_G.x0) / CUT_G.seg);" },
    { file:'index', expect:'剪刀左邊是要付的錢', find:"return '剪刀左邊是要付的錢，現在左邊只留下 '", replace:"return '左邊是省下的錢，現在左邊只留下 '" },
    { file:'index', expect:'that is the money you save', find:"'%. But ' + (i * 10) + '% is how much '", replace:"'% — that is the money you save. ' + (i * 10) + '% is how much '" },
    { file:'index', expect:'must not say "不是付"', find:"+ '%。' + cutZh(e.x) + '是付 10 份裡的 '", replace:"+ '%。' + cutZh(e.x) + '不是付 10 份裡的 '" },
    { file:'index', expect:'snapped onto the line', find:"                              snapX:function(x){ var c = cutAt(x); return c > 0 && c < G.n ? cutX(c) : x; },\n", replace:"                              snapX:function(x){ return x; },\n" },
    { file:'index', expect:'right house', find:"return t + ' = ' + pct + '% — right house!'; },", replace:"return t + ' = ' + pct + '% — wrong house!'; }," },
    { file:'index', expect:'multiply top and bottom by', find:"+ '% (multiply top and bottom by ' + m + '), not '", replace:"+ '% (divide top and bottom by ' + m + '), not '" },
    { file:'index', expect:'全部 ', find:"+ ' 個人：全部 ' + e.n + ' 人才是 100%。';", replace:"+ ' 個人：全部 ' + e.n + ' 人不是 100%。';" },
    { file:'index', expect:'cannot be more than 100%', find:"if (why === 'over') return 'A shooting percentage cannot be more than 100%: you cannot make more shots than you take.';", replace:"if (why === 'over') return t === 101 ? '101% is possible here.' : 'A shooting percentage cannot be more than 100%: you cannot make more shots than you take.';" },
    { file:'index', expect:'readInt(): ', find:"function readInt(s){ s = String(s).trim();", replace:"function readInt(s){ s = String(s).replace(/^ +| +$/g, '');" },
    { file:'index', expect:'readInt(): ', find:"function readInt(s){ s = String(s).trim(); return /^(0|[1-9]\\d{0,3})$/.test(s) ? +s : null; }", replace:"function readInt(s){ s = String(s).trim(); if (s === '00') return 0; return /^(0|[1-9]\\d{0,3})$/.test(s) ? +s : null; }" },
    { file:'index', expect:'qs[3].why', find:"why:'小數換成百分率要把小數點往右移兩位：0.07 → 7%", replace:"why:'小數換成百分率要把小數點往右移兩位：0.07 → 70%" },
    { file:'index', expect:'你塗了 ', find:"        return '你塗了 ' + k + ' 格 = ' + k + '%，要的是 '", replace:"        return k === 2 ? '你塗了 3 格 = 3%，要的是 ' + p + '%。' : '你塗了 ' + k + ' 格 = ' + k + '%，要的是 '" },
    { file:'review', expect:'copies the original price', find:"nearWrongs(c, 6).filter(function(v){ return v !== n; }).slice(0, 3)", replace:"nearWrongs(c, 3)" },
    { file:'review', expect:'copies the original price', find:"(paid !== saved ? [paid] : []).concat(nearWrongs(saved, 6).filter(function(v){ return v !== paid && v !== n; }))", replace:"(paid !== saved ? [paid] : []).concat(nearWrongs(saved, 6).filter(function(v){ return v !== paid; }))" },
    { file:'review', expect:'one place LEFT', find:"so move the point one place left → '", replace:"so move the point one place right → '" },
    { file:'review', expect:'is not the GCD', find:"        return { num:num, den:den, g:g, sn:sn, sd:sd, opts:m.opts, ans:m.ans };", replace:"        return { num:num, den:den, g:1, sn:sn, sd:sd, opts:m.opts, ans:m.ans };" },
    { file:'review', expect:'labels', find:"        var LABELS = { 90:'九折', 85:'八五折', 80:'八折', 75:'七五折', 70:'七折', 60:'六折', 50:'五折' };\n        var ELABELS = { 90:'10% off', 85:'15% off', 80:'20% off', 75:'25% off', 70:'30% off', 60:'40% off', 50:'50% off' };\n        var rate = pickUnused(RATES, used);\n        var mult = 100 / gcd(rate, 100);\n        var n = mult * (2 + rand(10));\n        var paid", replace:"        var LABELS = { 90:'九折', 85:'八五折', 80:'八折', 75:'七五折', 70:'九折', 60:'六折', 50:'五折' };\n        var ELABELS = { 90:'10% off', 85:'15% off', 80:'20% off', 75:'25% off', 70:'30% off', 60:'40% off', 50:'50% off' };\n        var rate = pickUnused(RATES, used);\n        var mult = 100 / gcd(rate, 100);\n        var n = mult * (2 + rand(10));\n        var paid" },
    { file:'index', expect:'scissors do not start', find:"cx:G.sciW / 2, cy:G.railY, text:'✂️'", replace:"cx:G.sciW / 2 + 30, cy:G.railY, text:'✂️'" },
    { file:'index', expect:'GAME_SHOOT', find:"{ n:20, m:13 }, { n:20, m:17 },", replace:"{ n:20, m:13 }, { n:30, m:17 }," },
    { file:'index', expect:'shootWhy1(', find:"    if (t === e.m) return 'count';            /* 進球數當成百分率 */", replace:"" },
    { file:'index', expect:'shootWhy2(', find:"    if (t === a) return 'same';               /* 又打了一次命中率 */", replace:"" },
    { file:'index', expect:'readInt(', find:"function readInt(s){ s = String(s).trim(); return /^(0|[1-9]\\d{0,3})$/.test(s) ? +s : null; }", replace:"function readInt(s){ s = String(s).replace(/\\s+/g, ''); return /^\\d{1,4}$/.test(s) ? +s : null; }" },
    { file:'index', expect:'shot ball', find:"y:G.y0 + Math.floor(i / 10) * G.rowH, w:G.ball, h:G.ball }; }", replace:"y:G.y0 + Math.floor(i / 10) * 20, w:G.ball, h:G.ball }; }" },
    { file:'index', expect:'GAME_GROUP', find:"{ n:20, p:15 }, { n:20, p:10 },", replace:"{ n:20, p:15 }, { n:20, p:12 }," },
    { file:'index', expect:'groupWhy(', find:"return c === e.p ? 'pIsCount' : 'other'; }", replace:"return 'other'; }" },
    { file:'index', expect:'人才是 100%', find:"+ ' 個人：全部 ' + e.n + ' 人才是 100%。';", replace:"+ ' 個人。';" },
    { file:'index', expect:'under 44px on a phone', find:"var GROUP_G = { cols:5, cellW:54, cellH:GPICK,", replace:"var GROUP_G = { cols:5, cellW:54, cellH:42," },
    { file:'index', expect:'an equation is no longer checkable', find:"return '對！' + e.m + ' ÷ ' + e.n + ' = ' + decStr(e.m / e.n) + ' = ' + a + '%。';", replace:"return '對！' + e.m + ' ÷ ' + e.n + ' 得 ' + decStr(e.m / e.n) + '，就是 ' + a + '%。';" },
    { file:'index', expect:'singular after 1', find:"return 'Cutting here leaves ' + i + ' ' + plEn(i, 'part') + ' = '", replace:"return 'Cutting here leaves ' + i + ' parts = '" },
    { file:'index', expect:'singular after 1', find:"'You shaded ' + k + ' ' + plEn(k, 'square') + ' = ' + k + '%, but we want '", replace:"'You shaded ' + k + ' squares = ' + k + '%, but we want '" },

    /* ---- index.html：RENDER 裡呼叫判斷的那一行、拖拉引擎 ---- */
    { file:'index', expect:'grid: the judged count', find:"        var why = gridRefuse(p, k);", replace:"        var why = gridRefuse(p, p);" },
    { file:'index', expect:'grid: the same wrong count', find:"          if (k === lastBad) return;   /* 同一個錯的格數再按一次", replace:"          if (false) return;   /* 同一個錯的格數再按一次" },
    { file:'index', expect:'grid: Done with nothing', find:"        if (!k){ gMsg.textContent = d.gGridEmpty; return; }", replace:"" },
    { file:'index', expect:'paint layer does not follow the first pointer', find:"        if (gSolved || pid !== null) return;      /* 只跟著第一根手指 */", replace:"        if (gSolved) return;      /* 只跟著第一根手指 */" },
    { file:'index', expect:'grid: lost capture', find:"      pad.addEventListener('lostpointercapture', stop);\n", replace:"" },
    { file:'index', expect:'grid: pointermove', find:"        if (pid === null || e.pointerId !== pid || gen !== gGen || gSolved) return;", replace:"        if (pid === null || gen !== gGen || gSolved) return;" },
    { file:'index', expect:'trio: the house', find:"        var why = trioRefuse(P.data.t, t.pct);", replace:"        var why = trioRefuse(P.data.t, bins[0].pct);" },
    { file:'index', expect:'trioOrder(cards)', find:"      var pieces = trioOrder(cards).map(", replace:"      var pieces = cards.map(" },
    { file:'index', expect:'cut: the cut is not judged', find:"        var why = cutRefuse(e.x, c);", replace:"        var why = cutRefuse(e.x, e.x);" },
    { file:'index', expect:'cut: the ends', find:"        if (c <= 0 || c >= G.n) return false;", replace:"        if (c < 0 || c > G.n) return false;" },
    { file:'index', expect:'scissors can leave the rail', find:"      if (o.axis === 'x') P.place(o.snapX(Math.max(P.w / 2, Math.min(B.W - P.w / 2, p.x))), orig.y);", replace:"      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);" },
    { file:'index', expect:'do not snap and show the cut', find:"onPlace:function(P){ preview(cutAt(P.cx)); } });", replace:"onPlace:function(P){ } });" },
    { file:'index', expect:'shoot: the same wrong answer', find:"        if (t === lastBad) return;", replace:"        if (false) return;" },
    { file:'index', expect:'ev.repeat', find:"if (!ev.repeat) check();", replace:"check();" },
    { file:'index', expect:'shootWhy1(e, t)', find:"roundMiss(qi === 0 ? d.gShootWhy1(e, t, shootWhy1(e, t)) : d.gShootWhy2(e, t, shootWhy2(e, t)));", replace:"roundMiss(qi === 0 ? d.gShootWhy1(e, t, shootWhy1(e, t + 1)) : d.gShootWhy2(e, t, shootWhy2(e, t)));" },
    { file:'index', expect:'not reset for question 2', find:"qi++; lastBad = null;", replace:"qi++;" },
    { file:'index', expect:'group: claiming again', find:"          if (lastClaim === c) return;", replace:"          if (false) return;" },
    { file:'index', expect:'group: claiming with nobody', find:"        if (!c){ gMsg.textContent = d.gGroupEmpty; return; }", replace:"" },
    { file:'index', expect:'group: the claim is not judged', find:"        var why = groupWhy(e, c);", replace:"        var why = groupWhy(e, groupAns(e));" },
    { file:'index', expect:'group: a second tap does not un-circle', find:"          c += on ? 1 : -1;", replace:"          c += 1;" },
    { file:'index', expect:'first pointer', find:"      if (P.locked || gSolved || start) return;", replace:"      if (P.locked || gSolved) return;" },
    { file:'index', expect:'lostpointercapture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });", replace:"" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */", replace:"      if (false) return;   /* 這一塊屬於已經拿掉的畫板 */" },
    { file:'index', expect:'pointer-events:none', find:"  .gpiece.locked{cursor:default;pointer-events:none}", replace:"  .gpiece.locked{cursor:default}" },
    { file:'index', expect:'touch-action:none', find:"    touch-action:none;cursor:grab;", replace:"    cursor:grab;" },
    { file:'index', expect:'paint layer', find:"  .gpaint{touch-action:none;cursor:crosshair;z-index:3}", replace:"  .gpaint{cursor:crosshair;z-index:3}" },
    { file:'index', expect:'hint is not cleared', find:"    elHint.textContent = '';   /* 過關就把提示清掉", replace:"    void 0;   /* 過關就把提示清掉" },
    { file:'index', expect:'scoring', find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:'index', expect:'roundMiss() at score', find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;" },
    { file:'index', expect:'roundMiss() at score 0', find:"    var lost = gScore >= 5 ? 5 : 0;", replace:"    var lost = 5;" },
    { file:'index', expect:'nearestAny(): a point inside the big box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestAny() on the', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'dropTarget(', find:"    if (good(tf)) return tf;", replace:"" },
    { file:'index', expect:'shuffle()', find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }", replace:"" },
    { file:'index', expect:'the ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"" },
    { file:'index', expect:'step one level per press', find:"    hintLevel++;\n    showHint();", replace:"    hintLevel += 2;\n    showHint();" },
    { file:'index', expect:'onDocEnd must call end(e, true)', find:"function onDocEnd(e){ end(e, true); }", replace:"function onDocEnd(e){ end(e, false); }" },
    { file:'index', expect:'a release on the piece is not a drop', find:"el.addEventListener('pointerup', function(e){ end(e, false); });", replace:"el.addEventListener('pointerup', function(e){ end(e, true); });" },
    { file:'index', expect:'tap-then-tap: a piece being dragged', find:"      if (P.busy()) return;", replace:"      if (false) return;" }
  ],

  sim: {
    INVARIANTS: {
      percentOf: d => {
        if (!Number.isInteger(d.c) || d.c * 100 !== d.n * d.p) return 'c = ' + d.c + ' is not ' + d.p + '% of ' + d.n + ' (or not a whole number)';
        /* 誘答是 c 的鄰近數（nearWrongs(c, 5) 去掉 p、n 之後的前三個）：一定在 c ± 5 以內、≥ 1 */
        for (const o of d.opts) if (!(Number.isInteger(o) && o >= 1 && Math.abs(o - d.c) <= 5)) return 'percentOf option ' + o + ' is not a near neighbour of ' + d.c;
      },
      discountPrice: d => {
        if (!Number.isInteger(d.c) || d.c * 100 !== d.n * d.rate) return 'pay ' + d.c + ' is not ' + d.rate + '% of ' + d.n;
        const zhRate = { 90:'九折', 85:'八五折', 80:'八折', 75:'七五折', 70:'七折', 60:'六折', 50:'五折' }[d.rate];
        if (d.lbl !== zhRate) return 'label ' + d.lbl + ' does not match rate ' + d.rate;
        if (d.elbl !== (100 - d.rate) + '% off') return 'English label ' + d.elbl + ' does not match rate ' + d.rate;
        if (d.opts.indexOf(d.n) >= 0) return 'option ' + d.n + ' copies the original price out of the stem';
        for (const o of d.opts) if (!(Number.isInteger(o) && o >= 1 && Math.abs(o - d.c) <= 6)) return 'discountPrice option ' + o + ' is not a near neighbour of ' + d.c;
      },
      discountSaved: d => {
        if (d.paid * 100 !== d.n * d.rate || d.saved !== d.n - d.paid) return 'paid/saved wrong';
        const zhRate = { 90:'九折', 85:'八五折', 80:'八折', 75:'七五折', 70:'七折', 60:'六折', 50:'五折' }[d.rate];
        if (d.lbl !== zhRate || d.elbl !== (100 - d.rate) + '% off') return 'labels ' + d.lbl + ' / ' + d.elbl + ' do not match rate ' + d.rate;
        if (d.opts.indexOf(d.n) >= 0) return 'option ' + d.n + ' copies the original price out of the stem';
        for (const o of d.opts) if (!(Number.isInteger(o) && o >= 1 && (o === d.paid || Math.abs(o - d.saved) <= 6))) return 'discountSaved option ' + o + ' is neither the paid price nor a near neighbour of ' + d.saved;
        if (d.rate !== 50 && d.opts.indexOf(d.paid) < 0) return 'the "paid" distractor (the price you pay, mistaken for the saving) is missing from ' + d.opts;
      },
      shootingPercent: d => {
        if (!(d.made > 0 && d.made < d.attempts) || d.pct * d.attempts !== d.made * 100) return 'pct ' + d.pct + ' is not ' + d.made + '/' + d.attempts;
        for (const o of d.opts) if (!(Number.isInteger(o) && o >= 1 && o <= 100 && Math.abs(o - d.pct) <= 4)) return 'shooting percentage option ' + o + ' is not a percentage near ' + d.pct;
      },
      trioConvert: d => {
        if (pctRef(d.frac) !== d.pct) return d.frac + ' is ' + pctRef(d.frac) + '%, not ' + d.pct + '% (trioConvert)';
        if (Math.round(d.dec * 100) !== d.pct) return 'decimal ' + d.dec + ' does not match ' + d.pct + '% (trioConvert)';
        for (const o of d.opts) if (!(Number.isInteger(o) && o >= 1 && o <= 100 && Math.abs(o - d.pct) <= 3)) return 'trioConvert option ' + o + ' is not a percentage near ' + d.pct;
      },
      compareDeal: d => {
        if (d.priceA * 100 !== d.base * d.rate) return 'Shop A price ' + d.priceA + ' wrong';
        if (!(d.priceB > 0) || d.priceB === d.priceA) return 'Shop B price ' + d.priceB + ' invalid';
        const zhRate = { 90:'九折', 85:'八五折', 80:'八折', 75:'七五折', 70:'七折', 60:'六折', 50:'五折' }[d.rate];
        if (d.lbl !== zhRate || d.elbl !== (100 - d.rate) + '% off') return 'labels ' + d.lbl + ' / ' + d.elbl + ' do not match rate ' + d.rate;
        /* 選項恰好是：對的店＋差價、另一家＋同一個差價、對的店＋差價 2、一樣貴 */
        const w = d.priceA < d.priceB ? 'A' : 'B', o = w === 'A' ? 'B' : 'A', diff = Math.abs(d.priceA - d.priceB);
        const want = [[w, diff], [o, diff], [w, diff + 2], ['tie', 0]].map(x => x.join()).sort().join('|');
        if (d.opts.map(x => x.join()).sort().join('|') !== want) return 'compareDeal options ' + JSON.stringify(d.opts) + ' are not the four expected ones';
      },
      decimalMul: d => {
        if (Math.round(d.correct * 10) !== d.numerator * d.mult || Math.round(d.dec * 10) !== d.numerator) return 'decimal product wrong';
        /* 誘答是三種迷思：小數點沒移回去（× 10）、移太多（÷ 10）、差 0.1 */
        const ok = [d.correct, d.numerator * d.mult, Math.round(d.correct * 10) / 100, Math.round(d.correct * 10 - 1) / 10, Math.round(d.correct * 10 + 1) / 10];
        for (const o of d.opts) if (ok.indexOf(o) < 0) return 'decimalMul option ' + o + ' is not one of the three named slips of ' + d.correct;
      },
      simplifyFrac: d => {
        if (gcdRef(d.sn, d.sd) !== 1 || d.sn * d.den !== d.sd * d.num) return d.sn + '/' + d.sd + ' is not ' + d.num + '/' + d.den + ' in lowest terms';
        if (d.g !== gcdRef(d.num, d.den)) return 'g = ' + d.g + ' is not the GCD of ' + d.num + ' and ' + d.den;
        /* 誘答只能是那五種錯法：分子少 1、分母多 1、分子多 1、只約了分母、只約了分子 */
        const sl = [(d.num - 1) + '/' + d.den, d.sn + '/' + (d.sd + 1), (d.sn + 1) + '/' + d.sd, d.num + '/' + d.sd, d.sn + '/' + d.den, d.sn + '/' + d.sd];
        for (const o of d.opts) if (sl.indexOf(String(o)) < 0) return 'simplifyFrac option ' + o + ' is not one of the five named slips';
      }
    },
    expectedCorrect: function(d, genId, lang){
      const money = v => lang === 'zh' ? v + ' 元' : 'NT$' + v;
      switch (genId){
        case 'percentOf': return String(d.n * d.p / 100);
        case 'discountPrice': return money(d.n * d.rate / 100);
        case 'discountSaved': return money(d.n - d.n * d.rate / 100);
        case 'shootingPercent': return (d.made * 100 / d.attempts) + '%';
        case 'trioConvert': return pctRef(d.frac) + '%';
        case 'compareDeal': {
          const a = d.base * d.rate / 100, b = d.priceB, cheap = a < b ? 'A' : 'B', diff = Math.abs(a - b);
          return lang === 'zh' ? (cheap === 'A' ? '甲店' : '乙店') + '便宜 ' + diff + ' 元' : 'Shop ' + cheap + ' is NT$' + diff + ' cheaper';
        }
        case 'decimalMul': return String(d.numerator * d.mult / 10);
        case 'simplifyFrac': { const g = gcdRef(d.num, d.den); return (d.num / g) + '/' + (d.den / g); }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    /* 渲染出來的那一題：解釋裡的算式要真的掃得到、而且都對；題幹要寫出產生器的參數；小數乘法說的是往左移 */
    renderCheck: function(d, q, lang, genId){
      const EQ = { percentOf:2, discountPrice:1, discountSaved:2, shootingPercent:1, trioConvert:1, compareDeal:1, decimalMul:1, simplifyFrac:0 }[genId];
      const r = scanEquations(q.why);
      if (r.length !== EQ) return genId + ': ' + r.length + ' equation(s) in the explanation, expected ' + EQ + ': ' + q.why;
      const bad = r.filter(e => e.bad)[0];
      if (bad) return genId + ': "' + bad.text + '" ' + bad.bad;
      const st = gnums(q.stem.replace(/<[^>]+>/g, ' '));
      const want = { percentOf:lang === 'zh' ? [d.n, d.p] : [d.p, d.n], discountPrice:[d.n], discountSaved:[d.n], shootingPercent:[d.attempts, d.made], trioConvert:gnums(d.frac || ''), compareDeal:[d.base, d.priceB], decimalMul:[d.dec, d.mult], simplifyFrac:[d.num, d.den] }[genId];
      if (!subseqRef(st, want)) return genId + ': the stem should show ' + want + ': ' + q.stem;
      if (genId === 'decimalMul' && q.why.indexOf(lang === 'zh' ? '往左移 1 位' : 'one place left') < 0) return 'decimalMul: the explanation must say the point moves one place LEFT: ' + q.why;
      if (genId === 'simplifyFrac' && gnums(q.why).indexOf(d.g) < 0) return 'simplifyFrac: the explanation does not name the GCD ' + d.g;
      if ((genId === 'discountPrice' || genId === 'discountSaved' || genId === 'compareDeal') && (q.stem.indexOf(d.lbl) < 0 || (lang === 'en' && q.stem.indexOf(d.elbl) < 0))) return genId + ': the stem does not show ' + d.lbl + (lang === 'en' ? ' / ' + d.elbl : '');
    },
    optionOk: function(s, genId, lang){
      let m;
      switch (genId){
        case 'percentOf': m = /^(\d+)$/.exec(s); if (!m || !(+m[1] >= 1 && +m[1] <= 102)) return 'percentOf option "' + s + '" is not a whole number in 1~102'; return;
        case 'discountPrice': case 'discountSaved':
          m = lang === 'zh' ? /^(\d+) 元$/.exec(s) : /^NT\$(\d+)$/.exec(s);
          if (!m || !(+m[1] >= 1 && +m[1] <= 600)) return genId + ' option "' + s + '" is not a money amount in 1~600'; return;
        case 'shootingPercent': case 'trioConvert':
          m = /^(\d+)%$/.exec(s); if (!m || !(+m[1] >= 1 && +m[1] <= 100)) return genId + ' shooting percentage options / percentages must be 1%~100%: "' + s + '"'; return;
        case 'compareDeal':
          if (!(lang === 'zh' ? /^(甲店|乙店)便宜 \d+ 元$|^兩家一樣貴$/ : /^Shop [AB] is NT\$\d+ cheaper$|^Both cost the same$/).test(s)) return 'compareDeal option "' + s + '" is not a shop sentence'; return;
        case 'decimalMul': if (!/^\d+(\.\d{1,2})?$/.test(s)) return 'decimalMul option "' + s + '" is not a decimal'; return;
        case 'simplifyFrac': if (!/^\d+\/\d+$/.test(s)) return 'simplifyFrac option "' + s + '" is not a fraction'; return;
      }
      return 'unknown generator ' + genId;
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「百分率探險隊」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GAME_W, GPICK, plEn, decStr, rowsZh, rowsEn, GAME_GRID, GRID_G, gridCell, gridAt, gridRefuse, GAME_TRIO, TRIO_G, trioSpot, trioTray, trioPct, trioMul, trioCards, trioRefuse, GAME_CUT, CUT_G, cutX, cutAt, cutRefuse, cutZh, GAME_SHOOT, SHOOT_G, shootBall, shootPct, readInt, shootWhy1, shootWhy2, GAME_GROUP, GROUP_G, groupCell, groupAns, groupWhy, dropTarget}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'];

      /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
      [['13 ÷ 20 = 0.65 = 65%', true], ['13 ÷ 20 = 0.65 = 6.5%', false], ['3 ÷ 4 = 0.75 = 75%', true], ['3 ÷ 4 = 0.75 = 70%', false],
       ['45% = 45/100', true], ['45% = 45/10', false], ['100% − 65% = 35%', true], ['100% - 65% = 45%', false], ['150% = 100% + 50%', true],
       ['400 × 0.75 = 300 元', true], ['400 × 0.75 = 30 元', false], ['NT$200 × 0.9 = NT$180', true], ['100% ÷ 20 = 5%', true], ['100% ÷ 20 = 4%', false],
       ['0.4 = 40/100 = 40%（', true], ['2/5 = 40/100 = 4%', false], ['0.07 → 7%', true], ['3 ÷ 4 → 0.75 → 70%', false], ['7 × 30 = 210 元，也就是 300 × 0.7 = 210', null]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (good === null){ if (r.length !== 2 || r.some(e => e.bad)) fail('scanEquations() self-test: "' + t + '" should read two correct equations, got ' + JSON.stringify(r)); return; }
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
      const perField = {};
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; perField[where] = (perField[where] || 0) + 1; if (e.bad) fail(where + ': "' + e.text + '" arithmetic ' + e.bad); });
      }));
      /* 每一個欄位各有幾條，也釘住（只釘總數的話，一條算式換成讀不懂的寫法、別處多一條「1 = 1」就補回來了 —— codex 第一輪） */
      Object.keys(Object.assign({}, STATIC_EQ_FIELDS, perField)).forEach(k => {
        if ((perField[k] || 0) !== (STATIC_EQ_FIELDS[k] || 0)) fail(k + ': ' + (perField[k] || 0) + ' equation(s) parsed, expected ' + (STATIC_EQ_FIELDS[k] || 0));
      });
      /* 釘成精確值：少掃到一條（換了寫法、掃描器讀不懂）或多一條沒有人看過的，都要有人來看 */
      if (checkedEq !== STATIC_EQ) fail(checkedEq + ' equations found in the I18N strings, expected ' + STATIC_EQ + ' — the arithmetic scan is not reading them all (or a new one needs a look)');

      /* --- 2. 題庫：每一題用自己的算法重算正解（兩種語言） --- */
      const Q = (bank, i, L) => I18N[L][bank][i];
      const num = s => { const m = String(s).match(/\d+(?:\.\d+)?/); return m ? +m[0] : NaN; };
      LANGS.forEach(L => {
        const marked = (bank, i) => Q(bank, i, L).opts[Q(bank, i, L).ans];
        const only = (bank, i, pred, what) => {
          const q = Q(bank, i, L), hits = q.opts.map((o, oi) => pred(o) ? oi : -1).filter(x => x >= 0);
          if (hits.length !== 1 || hits[0] !== q.ans) fail(bank + '[' + i + '] ' + L + ': ' + what + ' — options ' + q.opts.join('/') + ' satisfy it at ' + hits + ', marked ' + q.ans);
        };
        if (!/80%/.test(marked('qs', 0))) fail('qs[0] ' + L + ': 八折 should be 80% of the price');
        only('qs', 1, o => !/^(1\/2|5\/10|半|Half)$/.test(o) && pctRef(String(o)) !== 50, 'exactly one option is not 50%');
        if (!/150%/.test(Q('qs', 2, L).stem) || !/50%/.test(marked('qs', 2)) || !/(貴|more expensive)/.test(marked('qs', 2))) fail('qs[2] ' + L + ': 150% means 50% more');
        only('qs', 3, o => o === '7%', '0.07 = 7%');
        only('qs', 4, o => o === pctRef('3/4') + '%', '3/4 = 75%');
        only('qs', 5, o => num(o) === 400 * 75 / 100, '400 at 七五折 is 300');
        only('qsAdv', 0, o => num(o) === 250 - 250 * 80 / 100, '250 at 八折 saves 50');
        only('qsAdv', 1, o => num(o) === 13 * 100 / 20 && /%$/.test(o), '13 of 20 is 65%');
        only('qsAdv', 2, o => num(o) === 300 * 15 / 100, '15% of 300 is 45');
        { const a = 200 * 90 / 100, b = 185; const q = Q('qsAdv', 3, L), want = L === 'zh' ? '甲店便宜 ' + (b - a) + ' 元' : 'Shop A is NT$' + (b - a) + ' cheaper';
          if (q.opts[q.ans] !== want) fail('qsAdv[3] ' + L + ': the marked answer should be "' + want + '", got ' + q.opts[q.ans]); }
        only('qsBoost', 0, o => o === '80%', '八折 = 80%');
        if (!/(全部|All of them)/.test(marked('qsBoost', 1))) fail('qsBoost[1] ' + L + ': 100% sold means all of them');
      });

      /* --- 2b. 範例教學的三個計算行（hgLine／discLine／shootLine 是函式，上面的字串掃描看不到）：用頁面自己的選項逐一重算 --- */
      {
        const arr = name => { const m = src.match(new RegExp('var ' + name + ' = \\[([^\\]]*)\\];')); return m ? m[1].split(',').map(Number) : null; };
        const HG = arr('HG_VALUES'), PR = arr('PRICES'), SH = arr('SHOOT_VALUES'), att = +(src.match(/var SHOOT_ATTEMPTS = (\d+);/) || [])[1];
        if (!HG || !PR || !SH || !att) fail('cannot read HG_VALUES / PRICES / SHOOT_VALUES / SHOOT_ATTEMPTS from index.html');
        else LANGS.forEach(L => {
          HG.forEach(p => { const t = I18N[L].hgLine(p), r = scanEquations(t); if (r.length !== 1 || r[0].bad) fail('hgLine(' + p + ') ' + L + ': ' + t + ' ' + JSON.stringify(r)); });
          PR.forEach(v => I18N[L].discounts.forEach(dc => {
            if (I18N.zh.discounts.map(x => x.rate).join() !== I18N.en.discounts.map(x => x.rate).join()) return;
            const res = Math.round(v * dc.rate * 100) / 100, t = I18N[L].discLine(v, dc.label, dc.rate, res), r = scanEquations(t);
            if (r.length !== 1 || r[0].bad || gnums(r[0].text).join() !== [v, dc.rate, v * dc.rate * 100 / 100].join()) fail('discLine(' + v + ', ' + dc.label + ') ' + L + ': ' + t + ' ' + JSON.stringify(r));
          }));
          SH.forEach(m => { const t = I18N[L].shootLine(m, att, m / att * 100), r = scanEquations(t); if (r.length !== 1 || r[0].bad) fail('shootLine(' + m + ') ' + L + ': ' + t + ' ' + JSON.stringify(r)); });
        });
        const zr = { '九折':0.9, '八折':0.8, '七五折':0.75, '六折':0.6, '五折':0.5 };
        LANGS.forEach(L => I18N[L].discounts.forEach(dc => { const k = Object.keys(zr).filter(k => dc.label.indexOf(k) === 0)[0]; if (!k || zr[k] !== dc.rate) fail('discounts ' + L + ': "' + dc.label + '" is not rate ' + dc.rate);
          if (L === 'en' && dc.label.indexOf(Math.round((1 - dc.rate) * 100) + '% off') < 0) fail('discounts en: "' + dc.label + '" should say ' + Math.round((1 - dc.rate) * 100) + '% off'); }));
      }

      gameChecks(D, I18N, fail, src);
    }
  }
};

const STATIC_EQ_FIELDS = (() => { const o = {}; ['zh', 'en'].forEach(L => {
  Object.assign(o, { [L + '.qs[0].why']:1, [L + '.qs[1].why']:1, [L + '.qs[2].why']:1, [L + '.qs[3].why']:1, [L + '.qs[4].why']:1, [L + '.qs[5].why']:2,
                     [L + '.qsAdv[0].why']:2, [L + '.qsAdv[1].why']:1, [L + '.qsAdv[2].why']:2, [L + '.qsAdv[3].why']:2, [L + '.qsBoost[0].why']:0 }); }); return o; })();
const STATIC_EQ = 28;   /* 第一次跑時逐條列出、人工看過的 26 條（兩種語言各 13 條：題庫的解釋） */

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== GAME_TYPES_REF.join())
    fail('GAME_ORDER should be ' + GAME_TYPES_REF.join() + ' (examples 1, 2, 3 discount, 3 shooting, then the word problem), got ' + D.GAME_ORDER);
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
    if (typeof text !== 'string' || /undefined|NaN|null|Infinity/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (!subseqRef(gnums(text), want)) fail(where + ': numbers should read ' + want.join(',') + ' (in this order), got ' + gnums(text).join(',') + ' — ' + text);
  };
  const exact = (where, text, want) => { all.push([where, text]); if (gnums(text).join() !== want.join()) fail(where + ': numbers should be exactly ' + want.join(',') + ', got ' + gnums(text).join(',') + ' — ' + text); };
  /* 這一句裡要真的掃到幾條算式（掃不到的算式等於沒驗） */
  const eqn = (where, text, n) => { const r = scanEquations(text); if (r.length !== n) fail(where + ': ' + r.length + ' equation(s) parsed, expected ' + n + ' — an equation is no longer checkable: ' + text); };
  const say = (where, text, must, never) => {
    (must || []).forEach(m => { if (String(text).indexOf(m) < 0) fail(where + ': the sentence must say "' + m + '" — got: ' + text); });
    (never || []).forEach(m => { if (String(text).indexOf(m) >= 0) fail(where + ': the sentence must not say "' + m + '" — got: ' + text); });
  };
  const z = I18N.zh, en = I18N.en;
  touch('GPICK (cards, scissors, children)', D.GPICK);

  /* ---------- 第 1 關：塗百格 ---------- */
  {
    const G = D.GRID_G, H = G.H, P = D.GAME_GRID;
    if (!(P.length >= 6 && new Set(P).size === P.length && P.every(p => Number.isInteger(p) && p >= 1 && p <= 99))) fail('GAME_GRID should be at least 6 different whole percentages 1~99: ' + P);
    if (!P.some(p => p < 10)) fail('GAME_GRID has no percentage under 10% (the "8% is 80 squares" trap is never met)');
    if (!P.some(p => p % 10 === 0)) fail('GAME_GRID has no whole-row percentage (70%)');
    if (!P.some(p => p > 10 && p % 10 && Math.floor(p / 10) !== p % 10)) fail('GAME_GRID has no percentage whose digits can be swapped (36% / 63%)');
    /* 格子：閱讀順序、每 5 欄／5 列多一條縫、不出界、不重疊、拿取範圍是整片塗色層 */
    const cells = [];
    for (let i = 1; i <= 100; i++){
      const c = D.gridCell(i), r = Math.floor((i - 1) / 10), k = (i - 1) % 10;
      cells.push(c); inside(c, 'grid square ' + i, H);
      const want = { x:G.x0 + k * G.step + (k >= 5 ? G.gap : 0), y:G.y0 + r * G.step + (r >= 5 ? G.gap : 0) };
      if (c.x !== want.x || c.y !== want.y) fail('grid square ' + i + ' is drawn at ' + c.x + ',' + c.y + ' — reading order puts it at ' + want.x + ',' + want.y);
    }
    noHits(cells, 'grid squares');
    if (!(G.gap > 0 && G.step > G.cell)) fail('the grid needs a gap between squares and an extra gap after 5 (counting by fives)');
    const btn = { x:(W - G.btnW) / 2, y:G.btnY, w:G.btnW, h:G.btnH };
    inside(btn, 'the Done button', H); touch('the Done button', Math.min(G.btnW, G.btnH));
    if (cells.some(c => hit(c, btn)) || !(G.btnY - 6 >= cells[99].y + cells[99].h + G.pad)) fail('the Done button overlaps the grid or its paint layer');
    /* gridAt()：每 0.5px 和自己的「最近的欄 × 最近的列」一樣；每一格的中心與上下左右 ±35% 都是它自己；格子外面（含 pad）是 null */
    const colC = [...Array(10).keys()].map(k => cells[k].x + cells[k].w / 2), rowC = [...Array(10).keys()].map(r => cells[r * 10].y + cells[r * 10].h / 2);
    const nearestIdx = (v, cs) => { let b = 0, bd = Infinity; cs.forEach((c, i) => { const d = Math.abs(v - c); if (d < bd){ bd = d; b = i; } }); return b; };
    const x0 = cells[0].x - G.pad, x1 = cells[99].x + cells[99].w + G.pad, y0 = cells[0].y - G.pad, y1 = cells[99].y + cells[99].h + G.pad;
    let bad = 0, seen = new Set();
    for (let x = -2.25; x < W + 2; x += 0.5) for (let y = -2.25; y < G.btnY; y += 0.5){
      const want = (x < x0 || x > x1 || y < y0 || y > y1) ? null : nearestIdx(y, rowC) * 10 + nearestIdx(x, colC) + 1;
      const got = D.gridAt(x, y);
      if (got !== want) bad++; else if (got) seen.add(got);
    }
    if (bad) fail('gridAt(): ' + bad + ' points map to a different square than the nearest column × nearest row');
    if (seen.size !== 100) fail('gridAt(): only ' + seen.size + ' of the 100 squares can be reached');
    cells.forEach((c, i) => [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].forEach(([fx, fy]) => {
      const g = D.gridAt(c.x + c.w / 2 + fx * c.w, c.y + c.h / 2 + fy * c.h);
      if (g !== i + 1) fail('gridAt(): a tap on square ' + (i + 1) + ' (' + fx + ',' + fy + ') shades ' + g);
    }));
    /* gridRefuse()：每一題 × 塗了 1..100 格 */
    const whyRef = (p, k) => k === p ? null : (p < 10 && k === p * 10) ? 'ten' : (p % 10 === 0 && k * 10 === p) ? 'tenth' : (p > 10 && p % 10 && k === (p % 10) * 10 + Math.floor(p / 10)) ? 'flip' : 'other';
    P.forEach(p => {
      for (let k = 1; k <= 100; k++){
        const got = D.gridRefuse(p, k), want = whyRef(p, k);
        if (got !== want){ fail('gridRefuse(' + p + ', ' + k + ') is ' + got + ', expected ' + want); continue; }
        if (!got) continue;
        LANGS.forEach(L => {
          const t = I18N[L].gGridWhy(got, p, k), where = 'grid ' + p + '% shaded ' + k + ' (' + got + ', ' + L + ')';
          nums(where, t, got === 'flip' ? [k, k, p] : [k, k, p, p]);
          if (got === 'ten') say(where, t, L === 'zh' ? ['還不到一整排'] : ['not even one full row']);
          if (got === 'tenth') say(where, t, L === 'zh' ? [(p / 10) + ' 整排'] : [(p / 10) + ' full rows']);
          if (got === 'flip') say(where, t, L === 'zh' ? [rowsZhRef(k), rowsZhRef(p), '對調'] : [D.rowsEn(k), D.rowsEn(p), 'swapped']);
          say(where, t, [L === 'zh' ? '你塗了 ' + k + ' 格' : 'You shaded ' + k + ' '], L === 'zh' ? ['對！', '不是 ' + p] : ['Yes', 'not ' + p]);
        });
      }
      LANGS.forEach(L => {
        const t = I18N[L].gGridDone(p);
        nums('gGridDone ' + p + ' (' + L + ')', t, [p, p, 100, p]); eqn('gGridDone ' + p + ' (' + L + ')', t, 1);
        if (p >= 10) say('gGridDone ' + p + ' (' + L + ')', t, [L === 'zh' ? rowsZhRef(p) : D.rowsEn(p)]);
        exact('gGridLine ' + p + ' (' + L + ')', I18N[L].gGridLine(p), [p]);
        nums('gGrid2 ' + p + ' (' + L + ')', I18N[L].gGrid2(p), [p, p]);
      });
    });
    [1, 2, 9, 10, 11, 20, 21, 99, 100].forEach(n => {
      if (rowsZhRef(n) !== D.rowsZh(n)) fail('rowsZh(' + n + ') is "' + D.rowsZh(n) + '", expected "' + rowsZhRef(n) + '"');
      const e = D.rowsEn(n), r = Math.floor(n / 10), s = n % 10;
      if (gnums(e).join() !== (r ? (s ? [r, s] : [r]) : [s]).join() || /\b1 (rows|squares)\b/.test(e) || /\b([2-9]|10) (row|square)\b/.test(e)) fail('rowsEn(' + n + ') is "' + e + '"');
    });
    need('grid', /var why = gridRefuse\(p, k\);/, 'the judged count is not the count shown (gridRefuse(p, k))');
    need('grid', /if \(k === lastBad\) return;/, 'the same wrong count pressed again is charged again');
    need('grid', /if \(!k\)\{ gMsg\.textContent = d\.gGridEmpty; return; \}/, 'Done with nothing shaded is not a reminder');
    need('grid', /if \(gSolved \|\| pid !== null\) return;/, 'the paint layer does not follow the first pointer only');
    need('grid', /if \(pid === null \|\| e\.pointerId !== pid \|\| gen !== gGen \|\| gSolved\) return;/, 'pointermove on the paint layer does not follow only the first pointer');
    need('grid', /pad\.addEventListener\('lostpointercapture', stop\);/, 'lost capture does not stop the painting');
    need('grid', /document\.addEventListener\('pointerup', stop\);/, 'no document release while painting');
    need('grid', /show\(v\);/, 'a press does not shade up to the pressed square');
    needSrc(/\.gpaint\{touch-action:none;/, 'the paint layer must have touch-action:none');
  }

  /* ---------- 第 2 關：三兄弟分家 ---------- */
  {
    const G = D.TRIO_G, H = G.H;
    if (!(D.GAME_TRIO.length >= 4)) fail('GAME_TRIO should be a pool of at least 4');
    D.GAME_TRIO.forEach((set, si) => {
      const tag = 'GAME_TRIO[' + si + ']', pcts = set.map(h => h[0]);
      if (set.length !== 3 || new Set(pcts).size !== 3) fail(tag + ': three houses with three different percentages needed');
      if (!pcts.some(a => pcts.some(b => a === 10 * b))) fail(tag + ': no two houses ten times apart (' + pcts + ') — the decimal-point trap is missing');
      set.forEach(h => {
        const [p, f, dec] = h;
        const fm = /^(\d+)\/(\d+)$/.exec(f);
        if (!fm || [2, 4, 5, 10, 100].indexOf(+fm[2]) < 0) fail(tag + ': "' + f + '" should be a fraction with denominator 2, 4, 5, 10 or 100');
        if (!/^0\.\d{1,2}$/.test(dec)) fail(tag + ': "' + dec + '" should be a decimal under 1 with one or two places');
        if (pctRef(f) !== p || pctRef(dec) !== p) fail(tag + ': ' + f + ' / ' + dec + ' are ' + pctRef(f) + '% / ' + pctRef(dec) + '%, not ' + p + '%');
      });
      const cards = D.trioCards(set);
      if (cards.length !== 6 || new Set(cards.map(c => c.t)).size !== 6) fail(tag + ': six different cards needed');
      cards.forEach(c => {
        if (D.trioPct(c.t) !== pctRef(c.t)) fail('trioPct("' + c.t + '") is ' + D.trioPct(c.t) + ', expected ' + pctRef(c.t));
        const fm = /^(\d+)\/(\d+)$/.exec(c.t), mul = fm && +fm[2] !== 100 ? 100 / +fm[2] : 0;
        if (D.trioMul(c.t) !== mul) fail('trioMul("' + c.t + '") is ' + D.trioMul(c.t) + ', expected ' + mul);
        set.forEach((h, bi) => {
          const got = D.trioRefuse(c.t, h[0]), v = pctRef(c.t);
          if ((got === null) !== (v === h[0])) return fail(tag + ': "' + c.t + '" in the ' + h[0] + '% house is ' + (got ? 'refused' : 'accepted') + ' — it is ' + v + '%');
          if (got){
            if (got.pct !== v) fail(tag + ': trioRefuse("' + c.t + '") reports ' + got.pct + '%, it is ' + v + '%');
            LANGS.forEach(L => {
              const t = I18N[L].gTrioWhy(c.t, h[0], got.pct), where = tag + ' "' + c.t + '" in ' + h[0] + '% (' + L + ')';
              nums(where, t, gnums(c.t).concat(fm && mul ? [v, 100, v, mul, h[0]] : fm ? [v, h[0]] : [v, 100, v, h[0]]));
              eqn(where, t, fm && !mul ? 0 : 1);
              say(where, t, [(L === 'zh' ? '不是 ' : 'not ') + h[0] + '%']);
              if (!fm) say(where, t, L === 'zh' ? ['小數點往右移兩位'] : ['two places right']);
              if (mul) say(where, t, L === 'zh' ? ['分子分母同乘 ' + mul] : ['multiply top and bottom by ' + mul], L === 'zh' ? ['除'] : ['divide']);
            });
          } else LANGS.forEach(L => {
            const t = I18N[L].gTrioOk(c.t, h[0]);
            exact(tag + ' ok "' + c.t + '" (' + L + ')', t, gnums(c.t).concat([h[0]])); eqn(tag + ' ok "' + c.t + '" (' + L + ')', t, 1);
            say(tag + ' ok "' + c.t + '" (' + L + ')', t, [L === 'zh' ? '放對了' : 'right house'], [L === 'zh' ? '不' : 'wrong']);
            const h2 = I18N[L].gTrio2(c.t);
            nums(tag + ' hint2 "' + c.t + '" (' + L + ')', h2, gnums(c.t).concat(mul ? [mul, v, 100] : [v]));
          });
        });
      });
      LANGS.forEach(L => {
        const t = I18N[L].gTrioDone(set);
        nums(tag + ' done (' + L + ')', t, [].concat(...set.map(h => [h[0]].concat(gnums(h[1]), gnums(h[2])))));
        eqn(tag + ' done (' + L + ')', t, 3);
        pcts.forEach(p => exact(tag + ' house ' + p + ' (' + L + ')', I18N[L].gTrioHouse(p), [p]));
      });
    });
    LANGS.forEach(L => { for (let x = 0; x <= 6; x++) exact('gTrioLine (' + L + ')', I18N[L].gTrioLine(x, 6), [x, 6]); });
    /* 版面：三個家並排、中間有縫；每個家放得下兩張、在標籤下面；托盤六張在家的上面 */
    const bins = [0, 1, 2].map(bi => ({ x:G.binX[bi], y:G.binY, w:G.binW, h:G.binH }));
    bins.forEach((b, bi) => inside(b, 'trio house ' + bi, H));
    for (let bi = 0; bi < 2; bi++) if (!(bins[bi + 1].x - (bins[bi].x + bins[bi].w) > 0)) fail('trio houses ' + bi + ' and ' + (bi + 1) + ' touch — there must be a gap (nearest-house drops)');
    const tray = [0, 1, 2, 3, 4, 5].map(i => { const p = D.trioTray(i); return box(p.x, p.y, G.cardW, G.cardH); });
    tray.forEach((t, i) => { inside(t, 'trio tray card ' + i, H); if (bins.some(b => hit(t, b))) fail('trio tray card ' + i + ' overlaps a house'); });
    noHits(tray, 'trio tray cards');
    [0, 1, 2].forEach(bi => {
      const spots = [0, 1].map(j => { const p = D.trioSpot(bi, j); return box(p.x, p.y, G.cardW, G.cardH); }), b = bins[bi];
      spots.forEach((s, j) => { if (!(s.x >= b.x + 3 && s.x + s.w <= b.x + b.w - 3 && s.y >= b.y + 3 + G.lblH + 1 && s.y + s.h <= b.y + b.h - 3)) fail('trio spot ' + j + ' of house ' + bi + ' is not inside the house below its label box: ' + JSON.stringify(s)); });
      noHits(spots, 'trio spots in house ' + bi);
    });
    if (!(G.lblH >= 40)) fail('the house label box is ' + G.lblH + 'px — keep ≥ 40 (two lines of 16px on a phone)');
    touch('a trio card', Math.min(G.cardW, G.cardH));
    /* trioOrder()：3000 次，一定是那六張、一定不是「一家一家排好」 */
    const ssrc = extractFunction(src, 'shuffle'), osrc = extractFunction(src, 'trioOrder');
    let trioOrder = null;
    if (!ssrc || !osrc) fail('cannot find shuffle() / trioOrder() in index.html');
    else { try { trioOrder = new Function(ssrc + '\n' + osrc + '\nreturn trioOrder;')(); } catch (err){ fail('trioOrder() could not be evaluated: ' + err.message); } }
    if (trioOrder) D.GAME_TRIO.forEach(set => {
      const cards = D.trioCards(set), seen = new Set();
      for (let i = 0; i < 3000; i++){
        const a = trioOrder(cards);
        if (a.map(c => c.t).sort().join() !== cards.map(c => c.t).sort().join()) return fail('trioOrder() changed the cards: ' + a.map(c => c.t));
        if (a.every((c, j) => c.bi === Math.floor(j / 2))) return fail('trioOrder() returned the cards sorted house by house: ' + a.map(c => c.t) + ' (the tray mirrors the houses)');
        seen.add(a.map(c => c.t).join());
      }
      if (seen.size < 50) fail('trioOrder() produced only ' + seen.size + ' orders in 3000 runs');
    });
    need('trio', /var why = trioRefuse\(P\.data\.t, t\.pct\);/, 'the house that is judged is not the house it was dropped in (trioRefuse(P.data.t, t.pct))');
    need('trio', /if \(why\)\{ roundMiss\(d\.gTrioWhy\(P\.data\.t, t\.pct, why\.pct\)\); return false; \}/, 'a refused card is not a mistake with its reason');
    need('trio', /var pieces = trioOrder\(cards\)\.map\(/, 'the tray is not drawn in trioOrder(cards) order');
    need('trio', /dropTarget\(nearestAny\(bins, pt, G\.pad\), f \? nearestAny\(bins, f, G\.pad\) : null, function\(b\)\{ return !trioRefuse\(P\.data\.t, b\.pct\); \}\)/, 'the drop target is not chosen by centre and finger (dropTarget with trioRefuse)');
    need('trio', /addZone\(B, G\.binX\[bi\] \+ 4, G\.binY \+ 3, G\.binW - 8, G\.lblH, 'gbinlbl', d\.gTrioHouse\(h\[0\]\)\);/, 'the house labels are not drawn from the set (the picture must determine the answer)');
  }

  /* ---------- 第 3 關：剪價格條 ---------- */
  {
    const G = D.CUT_G, H = G.H;
    if (!(D.GAME_CUT.length >= 5)) fail('GAME_CUT should be a pool of at least 5');
    if (G.n !== 10) fail('the price bar must have 10 parts (折 counts tenths), got ' + G.n);
    D.GAME_CUT.forEach((e, ei) => {
      const tag = 'GAME_CUT[' + ei + '] ' + e.p + ' at ' + e.x + '折';
      if (!(Number.isInteger(e.x) && e.x >= 1 && e.x <= 9 && e.x !== 5)) fail(tag + ': x must be 1~9 and not 5 (at 五折 "paid" and "saved" are the same — the trap disappears)');
      if (!(e.p % 10 === 0 && e.p >= 100 && e.p <= 1000)) fail(tag + ': the price should be a multiple of 10 (one part = a whole number)');
      if (D.cutZh(e.x) !== ZH_NUM.charAt(e.x) + '折') fail('cutZh(' + e.x + ') is ' + D.cutZh(e.x));
      const u = e.p / 10;
      for (let i = 0; i <= 10; i++){
        const got = D.cutRefuse(e.x, i), want = i === e.x ? null : i === 10 - e.x ? 'saved' : 'other';
        if (got !== want){ fail(tag + ': cutRefuse(' + e.x + ', ' + i + ') is ' + got + ', expected ' + want); continue; }
        if (!got || i === 0 || i === 10) continue;
        LANGS.forEach(L => {
          const t = I18N[L].gCutWhy(got, e, i), where = tag + ' cut at ' + i + ' (' + L + ')';
          nums(where, t, [i, i * 10, e.x, e.x * 10]);
          say(where, t, [D.cutZh(e.x)]);
          /* 左邊永遠是「要付的」：兩種錯都要說七折要付幾份；只有剪成省下那幾份的才說「省」 */
          say(where, t, L === 'zh' ? [D.cutZh(e.x) + (got === 'saved' ? '要付 10 份裡的 ' : '是付 10 份裡的 ') + e.x + ' 份'] : ['means you pay ' + e.x + ' of the 10 parts'], L === 'zh' ? ['不是付'] : ['not pay', 'don’t pay']);
          /* 左邊（畫成要付的那一塊）不可以被說成「省下的那一塊」：要說的是「那個百分率剛好是省下的錢，不是要付的錢」（codex 第二輪） */
          if (got === 'saved') say(where, t, L === 'zh' ? ['剪刀左邊是要付的錢', '左邊只留下 ' + i + ' 份', (i * 10) + '% 是' + D.cutZh(e.x) + '省下的錢，不是要付的錢'] : ['left of the scissors is what you pay', 'left only ' + i + ' of the 10 parts', (i * 10) + '% is how much ' + D.cutZh(e.x) + ' saves', 'not how much you pay'], L === 'zh' ? ['那是省下的錢', '是省下的那一部分', '左邊是省', '剪成了'] : ['that is the money you save', 'is the part you save', 'left part is the money', 'made it']);
          else say(where, t, L === 'zh' ? ['左邊是 ' + i + ' 份'] : ['leaves ' + i], L === 'zh' ? ['省'] : ['save']);
        });
      }
      LANGS.forEach(L => {
        const t = I18N[L].gCutDone(e);
        nums(tag + ' done (' + L + ')', t, [e.x, e.x, u, e.x * u, e.p, e.x / 10, e.x * u, 10 - e.x, 10 - e.x, u, (10 - e.x) * u]);
        eqn(tag + ' done (' + L + ')', t, 3);
        say(tag + ' done (' + L + ')', t, L === 'zh' ? ['付 ' + e.x + ' 份', '省 ' + (10 - e.x) + ' 份'] : ['You pay ' + e.x + ' parts', 'You save ' + (10 - e.x) + ' ']);
        nums(tag + ' paid (' + L + ')', I18N[L].gCutPaid(e), [e.p, e.p * e.x / 10, e.p * (10 - e.x) / 10]); say(tag + ' paid (' + L + ')', I18N[L].gCutPaid(e), [D.cutZh(e.x)]);
        const line = I18N[L].gCutLine(e);
        if (L === 'zh') { exact(tag + ' line (zh)', line, [e.p]); say(tag + ' line (zh)', line, ['打' + D.cutZh(e.x)]); }
        else { exact(tag + ' line (en)', line, [e.p, (10 - e.x) * 10]); say(tag + ' line (en)', line, [(10 - e.x) * 10 + '% off', D.cutZh(e.x)]); }
        nums(tag + ' price (' + L + ')', I18N[L].gCutPrice(e), [e.p, 100, u, 10]);
        nums(tag + ' hint2 (' + L + ')', I18N[L].gCut2(e), [e.x, e.x]);
      });
    });
    /* cutAt()：每 0.25px 和自己的「最近的那條線」一樣；線的 ±35% 段都是它自己；剪刀的家（最左邊）不是任何一條線 */
    const ref = x => Math.max(0, Math.min(10, Math.round((x - G.x0) / G.seg)));
    let bad = 0;
    for (let x = -10; x <= W + 10; x += 0.25) if (D.cutAt(x) !== ref(x)) bad++;
    if (bad) fail('cutAt(): ' + bad + ' points map to a different line than the nearest one');
    for (let i = 1; i <= 9; i++) [0, 0.35, -0.35].forEach(f => { if (D.cutAt(D.cutX(i) + f * G.seg / 2) !== i) fail('cutAt(): a point at ' + f + ' of line ' + i + ' is not line ' + i); });
    for (let i = 0; i <= 10; i++) if (D.cutX(i) !== G.x0 + i * G.seg) fail('cutX(' + i + ') is ' + D.cutX(i));
    const homeX = G.sciW / 2;
    if (D.cutAt(homeX) !== 0) fail('the scissors start on line ' + D.cutAt(homeX) + ' — they must start off the bar (no cut)');
    /* 剪刀在軌道上能走的範圍（不出畫板）：每一條線都到得了，兩端（沒有剪）也到得了 */
    const lo = G.sciW / 2, hi = W - G.sciW / 2;
    for (let i = 0; i <= 10; i++) if (!(D.cutX(i) >= lo - G.seg / 2 && D.cutX(i) <= hi + G.seg / 2)) fail('the scissors cannot reach line ' + i + ' on the rail');
    if (D.cutAt(hi) !== 10 && D.cutAt(lo) !== 0) fail('the scissors cannot be dragged back off the bar');
    inside({ x:D.cutX(0), y:G.barY, w:D.cutX(10) - D.cutX(0), h:G.barH }, 'the price bar', H);
    inside({ x:D.cutX(0), y:G.priceY, w:D.cutX(10) - D.cutX(0), h:G.priceH }, 'the price label', H);
    inside(box(lo, G.railY, G.sciW, G.sciH), 'the scissors at the left end', H); inside(box(hi, G.railY, G.sciW, G.sciH), 'the scissors at the right end', H);
    if (!(G.railY - G.sciH / 2 >= G.barY + G.barH + G.tickH)) fail('the scissors cover the bar or its cut lines');
    if (!(G.priceY + G.priceH <= G.barY - 8)) fail('the price label overlaps the cut line marker');
    if (!(G.tapTop <= G.barY && G.tapBot >= G.railY + G.sciH / 2 && G.tapBot <= H)) fail('the tap band (' + G.tapTop + '~' + G.tapBot + ') does not cover the bar, the cut lines and the rail');
    if (!(G.priceH >= 36)) fail('the price label is ' + G.priceH + 'px — two lines of 13px need ≥ 36');
    touch('the scissors', Math.min(G.sciW, G.sciH));
    need('cut', /var c = cutAt\(pt\.x\);/, 'the line that is judged is not the line under the scissors (cutAt(pt.x))');
    need('cut', /if \(c <= 0 \|\| c >= G\.n\) return false;/, 'the ends of the bar (no cut) are not silent');
    need('cut', /var why = cutRefuse\(e\.x, c\);/, 'the cut is not judged by cutRefuse(e.x, c)');
    need('cut', /if \(why\)\{ roundMiss\(d\.gCutWhy\(why, e, c\)\); return false; \}/, 'a wrong cut is not a mistake with its reason');
    need('cut', /if \(pt\.tap && \(pt\.y < G\.tapTop \|\| pt\.y > G\.tapBot\)\) return false;/, 'a tap far above / below the bar is not silent');
    need('cut', /axis:'x',[\s\S]{0,200}onPlace:function\(P\)\{ preview\(cutAt\(P\.cx\)\); \} \}\);/, 'the scissors do not snap and show the cut while dragging (axis x + preview(cutAt))');
    need('cut', /cx:G\.sciW \/ 2, cy:G\.railY/, 'the scissors do not start at the left end of the rail');
    need('cut', /snapX:function\(x\)\{ var c = cutAt\(x\); return c > 0 && c < G\.n \? cutX\(c\) : x; \},/, 'the scissors are not snapped onto the line they will cut while dragging (snapX)');
    needSrc(/if \(o\.axis === 'x'\) P\.place\(o\.snapX\(Math\.max\(P\.w \/ 2, Math\.min\(B\.W - P\.w \/ 2, p\.x\)\)\), orig\.y\);/, 'the scissors can leave the rail / the board, or do not follow the finger (codex r1: a grab offset put the judged centre on the neighbouring line)');
  }

  /* ---------- 第 4 關：命中率 ---------- */
  {
    const G = D.SHOOT_G, H = G.H;
    if (!(D.GAME_SHOOT.length >= 5)) fail('GAME_SHOOT should be a pool of at least 5');
    D.GAME_SHOOT.forEach((e, ei) => {
      const tag = 'GAME_SHOOT[' + ei + '] ' + e.m + '/' + e.n, a = e.m * 100 / e.n, b = 100 - a;
      if (!((e.n === 20 || e.n === 25) && e.m > 0 && e.m < e.n && Number.isInteger(a))) return fail(tag + ': n must be 20 or 25 (each shot a whole percent), 0 < m < n');
      if (D.shootPct(e) !== a) fail('shootPct(' + tag + ') is ' + D.shootPct(e));
      if (new Set([a, e.m, b, e.n - e.m]).size !== 4) fail(tag + ': the answer and the three typical slips (m, 100 − a, n − m) must all differ: ' + [a, e.m, b, e.n - e.m]);
      if (new Set([b, e.n - e.m, a]).size !== 3) fail(tag + ': question 2 answer and its slips must differ');
      for (let t = 0; t <= 9999; t++){
        const w1 = t === e.m ? 'count' : t === b ? 'missPct' : t === e.n - e.m ? 'missCount' : t > 100 ? 'over' : 'other';
        const w2 = t === e.n - e.m ? 'count' : t === a ? 'same' : t > 100 ? 'over' : 'other';
        if (t !== a && D.shootWhy1(e, t) !== w1) fail(tag + ': shootWhy1(' + t + ') is ' + D.shootWhy1(e, t) + ', expected ' + w1);
        if (t !== b && D.shootWhy2(e, t) !== w2) fail(tag + ': shootWhy2(' + t + ') is ' + D.shootWhy2(e, t) + ', expected ' + w2);
      }
      LANGS.forEach(L => {
        const w = (q, t) => q === 1 ? I18N[L].gShootWhy1(e, t, D.shootWhy1(e, t)) : I18N[L].gShootWhy2(e, t, D.shootWhy2(e, t)), where = tag + ' (' + L + ')';
        nums(where + ' Q1 count', w(1, e.m), [e.m, e.m, e.n]); eqn(where + ' Q1 count', w(1, e.m), 0); say(where + ' Q1 count', w(1, e.m), L === 'zh' ? ['不是百分率'] : ['not a percentage']);
        nums(where + ' Q1 missPct', w(1, b), [b, e.n - e.m, e.m, e.n]); say(where + ' Q1 missPct', w(1, b), L === 'zh' ? ['沒進'] : ['missed']);
        nums(where + ' Q1 missCount', w(1, e.n - e.m), [e.n - e.m, e.m, e.n]); say(where + ' Q1 missCount', w(1, e.n - e.m), L === 'zh' ? ['沒進'] : ['missed']);
        nums(where + ' Q1 over', w(1, 150), [100]); say(where + ' Q1 over', w(1, 150), L === 'zh' ? ['不會超過 100%'] : ['cannot be more than 100%']);
        for (let t = 0; t <= 301; t++) [1, 2].forEach(q => {
          const tt = t === 301 ? 9999 : t, why = q === 1 ? D.shootWhy1(e, tt) : D.shootWhy2(e, tt);
          if (tt === (q === 1 ? a : b)) return;
          const txt = w(q, tt), wh = where + ' Q' + q + ' ' + tt + ' (' + why + ')';
          if (why === 'over') { nums(wh, txt, [100]); say(wh, txt, L === 'zh' ? ['不會超過 100%'] : ['cannot be more than 100%'], L === 'zh' ? ['可以'] : ['is possible', 'can be more']); }
          else if (why === 'other') { nums(wh, txt, q === 1 ? [tt, 100, e.n, 100 / e.n, e.m] : [tt, e.n, 100, a]); eqn(wh, txt, q === 1 ? 1 : 0); say(wh, txt, [L === 'zh' ? '不是 ' + tt + '%' : 'Not ' + tt + '%']); }
        });
        nums(where + ' Q2 count', w(2, e.n - e.m), [e.n - e.m, e.n]); say(where + ' Q2 count', w(2, e.n - e.m), L === 'zh' ? ['不是百分率'] : ['not a percentage']);
        nums(where + ' Q2 same', w(2, a), [a, e.n, 100]);
        nums(where + ' Q2 over', w(2, 120), [100]);
        [b + 1, b - 1].filter(t => t !== e.n - e.m && t !== a).forEach(t => nums(where + ' Q2 ' + t, w(2, t), [t, e.n, 100, a]));
        const ok0 = I18N[L].gShootOk(0, e), ok1 = I18N[L].gShootOk(1, e);
        exact(where + ' ok1', ok0, [e.m, e.n, e.m / e.n, a]); eqn(where + ' ok1', ok0, 1);
        exact(where + ' ok2', ok1, [100, a, b, e.n - e.m, e.n, (e.n - e.m) / e.n]); eqn(where + ' ok2', ok1, 2);
        exact(where + ' done', I18N[L].gShootDone(e), [a, b, 100, e.n]); eqn(where + ' done', I18N[L].gShootDone(e), 1);
        exact(where + ' say', I18N[L].gShootSay(e), [e.n]);
        exact(where + ' log', I18N[L].gShootLog(0, e) + ' ' + I18N[L].gShootLog(1, e), [a, b]);
        nums(where + ' hint2 Q1', I18N[L].gShoot2(0, e), [100, e.n, 100 / e.n, e.m]); eqn(where + ' hint2 Q1', I18N[L].gShoot2(0, e), 1);
        nums(where + ' hint2 Q2', I18N[L].gShoot2(1, e), [100, a]);
      });
    });
    LANGS.forEach(L => { if (!/幾 %|percent/.test(I18N[L].gShootAsk(0)) || !/沒進|missed/.test(I18N[L].gShootAsk(1))) fail('gShootAsk (' + L + ') should ask the shooting percentage, then the missed percentage'); });
    /* readInt()：只收寫法正常的整數 */
    {
      /* 自己的文法：前後空白（String.prototype.trim 認得的，含換行、全形空白）可以；中間只有數字、1～4 位、沒有開頭的 0（「0」本身可以）。
         字母表 9 個字元（三個數字、三種空白、小數點、負號、字母），長度到 5 的字串全部列出來比 —— 是代表性字母表，不是所有字元（codex 第二輪） */
      const ref = s => { const t = s.trim(); if (!t.length || t.length > 4) return null; for (const ch of t) if (ch < '0' || ch > '9') return null; if (t.length > 1 && t[0] === '0') return null; return +t; };
      const AL = ['0', '5', '9', ' ', '\n', '\u3000', '.', '-', 'a'];
      let n = 0, bad = 0;
      const gen = (p, d) => { if (d > 5) return; n++; if (D.readInt(p) !== ref(p)){ if (bad++ < 3) fail('readInt("' + p + '") is ' + D.readInt(p) + ', expected ' + ref(p)); } if (d < 5) AL.forEach(c => gen(p + c, d + 1)); };
      gen('', 0);
      if (n < 60000) fail('readInt(): only ' + n + ' strings were generated');
      if (bad) fail('readInt(): ' + bad + ' of ' + n + ' short strings read differently from the grammar (whole number, no leading 0, no inner space or point)');
    }
    /* 版面：一排 10 球、最多 3 排，不出界、不重疊，在題目上面 */
    const balls = [];
    for (let i = 0; i < 25; i++){ const c = D.shootBall(i); balls.push(c); inside(c, 'shot ' + i, H); }
    noHits(balls, 'shot balls');
    for (let i = 0; i < 25; i++){ const c = balls[i], r = Math.floor(i / 10), k = i % 10; if (Math.abs(c.x - (G.x0 + k * G.step + (G.step - G.ball) / 2)) > 1e-9 || c.y !== G.y0 + r * G.rowH) fail('shot ' + i + ' is not in row ' + r + ', column ' + k); }
    if (!(balls[24].y + balls[24].h <= G.askY && G.sayH <= G.y0)) fail('the shots overlap the sentence above or the question below');
    const rows = [{ y:0, h:G.sayH }, { y:G.askY, h:G.askH }, { y:G.inY, h:G.inH }, { y:G.btnY, h:G.btnH }, { y:G.logY, h:G.logH }];
    for (let i = 1; i < rows.length; i++) if (rows[i].y < rows[i - 1].y + rows[i - 1].h) fail('shoot rows ' + (i - 1) + ' and ' + i + ' overlap');
    if (rows[4].y + rows[4].h > H) fail('the shoot log runs off the board');
    if (!(G.askH >= 46)) fail('the shoot question box is ' + G.askH + 'px — the English question takes two lines (≥ 46)');
    touch('the shoot input', Math.min(G.inW, G.inH)); touch('the shoot button', Math.min(G.okW, G.btnH));
    need('shoot', /if \(t === lastBad\) return;/, 'the same wrong answer typed again is charged again');
    need('shoot', /qi\+\+; lastBad = null;/, 'the "same wrong answer" memory is not reset for question 2');
    need('shoot', /if \(t === null\)\{ gMsg\.textContent = d\.gShootInt; return; \}/, 'a malformed answer is not a reminder');
    need('shoot', /roundMiss\(qi === 0 \? d\.gShootWhy1\(e, t, shootWhy1\(e, t\)\) : d\.gShootWhy2\(e, t, shootWhy2\(e, t\)\)\);/, 'a wrong answer is not explained by shootWhy1(e, t) / shootWhy2(e, t)');
    need('shoot', /var Q = \[\{ ans:a \}, \{ ans:100 - a \}\];/, 'the two answers are not the shooting percentage and 100 − it');
    need('shoot', /if \(!ev\.repeat\) check\(\);/, 'a held Enter (ev.repeat) submits again');
    need('shoot', /addZone\(B, c\.x, c\.y, c\.w, c\.h, 'gball ' \+ \(i < e\.m \? 'in' : 'out'\)\);/, 'the shots drawn are not n balls with m filled (the picture must determine the answer)');
  }

  /* ---------- 第 5 關：圈出幾 % 的人 ---------- */
  {
    const G = D.GROUP_G, H = G.H;
    if (!(D.GAME_GROUP.length >= 5)) fail('GAME_GROUP should be a pool of at least 5');
    D.GAME_GROUP.forEach((e, ei) => {
      const tag = 'GAME_GROUP[' + ei + '] ' + e.p + '% of ' + e.n, ans = e.n * e.p / 100;
      if (!((e.n === 20 || e.n === 25) && Number.isInteger(ans) && ans >= 1 && e.p <= e.n && e.p !== ans)) return fail(tag + ': n must be 20 or 25, the answer a whole number ≥ 1, and p ≤ n with p ≠ the answer (so circling p children — the "p% is p" slip — can be done)');
      if (D.groupAns(e) !== ans) fail('groupAns(' + tag + ') is ' + D.groupAns(e));
      for (let c = 0; c <= e.n; c++){
        const want = c === ans ? null : c === e.p ? 'pIsCount' : 'other';
        if (D.groupWhy(e, c) !== want){ fail(tag + ': groupWhy(' + c + ') is ' + D.groupWhy(e, c) + ', expected ' + want); continue; }
        if (!want || !c) continue;
        LANGS.forEach(L => {
          const t = I18N[L].gGroupWhy(e, c, want), where = tag + ' circled ' + c + ' (' + L + ')';
          if (want === 'pIsCount'){ nums(where, t, [e.p, e.p, e.n, 100]); say(where, t, L === 'zh' ? ['不是 ' + e.p + ' 個人', '全部 ' + e.n + ' 人才是 100%'] : ['is not ' + e.p + ' children', 'all ' + e.n + ' children are 100%'], L === 'zh' ? ['不是 100%'] : ['not 100%']); }
          else { exact(where, t, [c, c, e.n, c * 100 / e.n, e.p]); eqn(where, t, 1); }
        });
      }
      LANGS.forEach(L => {
        const where = tag + ' (' + L + ')';
        const dn = I18N[L].gGroupDone(e);
        nums(where + ' done', dn, [e.n, e.p / 100, ans, e.p, ans, 100, e.n, 100 / e.n]); eqn(where + ' done', dn, 2);
        nums(where + ' hint2', I18N[L].gGroup2(e), L === 'zh' ? [100, e.n, 100 / e.n, e.p, 100 / e.n] : [100, e.n, 100 / e.n, 100 / e.n, e.p]); eqn(where + ' hint2', I18N[L].gGroup2(e), 1);
        for (let c = 0; c <= e.n; c++){ const ln = I18N[L].gGroupLine(e, c); exact(where + ' line ' + c, ln, L === 'zh' ? [e.n, e.p, c] : [e.p, e.n, c]); }
      });
    });
    const cells = [];
    for (let i = 0; i < 25; i++){ const c = D.groupCell(i); cells.push(c); inside(c, 'child ' + i, H); if (!(c.w * PHONE_K >= 44 && c.h * PHONE_K >= 44)) fail('child ' + i + ' is under 44px on a phone'); }
    noHits(cells, 'children');
    const claim = { x:(W - G.btnW) / 2, y:G.btnY, w:G.btnW, h:G.btnH };
    inside(claim, 'the claim button', H); touch('the claim button', Math.min(G.btnW, G.btnH));
    if (cells.some(c => hit(c, claim))) fail('the claim button overlaps a child');
    need('group', /var why = groupWhy\(e, c\);/, 'the claim is not judged on the number circled (groupWhy(e, c))');
    need('group', /if \(lastClaim === c\) return;/, 'claiming again with the same number is charged again');
    need('group', /if \(!c\)\{ gMsg\.textContent = d\.gGroupEmpty; return; \}/, 'claiming with nobody circled is not a reminder');
    need('group', /c \+= on \? 1 : -1;/, 'a second tap does not un-circle a child');
    need('group', /roundMiss\(d\.gGroupWhy\(e, c, why\)\);/, 'a wrong claim is not a mistake with its reason');
    need('group', /for \(var i = 0; i < e\.n; i\+\+\)/, 'the board does not draw all n children');
    LANGS.forEach(L => { const q = I18N[L].gGroupClaim.replace(/ ✓$/, ''); if (I18N[L].gAsks.group.indexOf(q) < 0) fail('gAsks.group (' + L + ') does not name the button "' + q + '"'); });
  }
  LANGS.forEach(L => {
    const q = I18N[L].gGridBtn.replace(/ ✓$/, ''); if (I18N[L].gAsks.grid.indexOf(q) < 0) fail('gAsks.grid (' + L + ') does not name the button "' + q + '"');
    if (I18N[L].gAsks.shoot.indexOf(I18N[L].gShootOkBtn) < 0) fail('gAsks.shoot (' + L + ') does not name the button "' + I18N[L].gShootOkBtn + '"');
  });

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
  needSrc(/document\.removeEventListener\('pointerup', onDocEnd\);/, 'drag engine: the document release is never removed');
  needSrc(/el\.addEventListener\('pointerup', function\(e\)\{ end\(e, false\); \}\);/, 'drag engine: a release on the piece is not a drop (end(e, false))');
  needSrc(/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/, 'drag engine: pointercancel on the piece is not a cancel');
  needSrc(/if \(hintLevel >= 2\) return;\n\s*hintLevel\+\+;\n\s*showHint\(\);\n\s*if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'hints: the button does not step one level per press and stop at level 2');
  needSrc(/elHint\.textContent = d\.gHints\[type\] \+ \(hintLevel >= 2 && gCtx\.hint2 \? ' ' \+ gCtx\.hint2\(\) : ''\);/, 'hints: level 2 does not add the round\'s own hint2 to the strategy');
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
    const asrc = extractFunction(src, 'nearestAny');
    let nearestAny = null;
    if (!asrc) fail('cannot find nearestAny() in index.html');
    else { try { nearestAny = new Function(asrc + '\nreturn nearestAny;')(); } catch (err){ fail('nearestAny() could not be evaluated: ' + err.message); } }
    if (nearestAny){
      /* 自己的「最近」：到方框的距離（框裡是 0），一樣近比到中心 */
      const ref = (list, p, pad) => { let best = null, bd = Infinity, bc = Infinity; list.forEach(b => { const dx = p.x - b.cx, dy = p.y - b.cy; if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return; const ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh), dd = ex * ex + ey * ey, dc = dx * dx + dy * dy; if (dd < bd - 1e-12 || (Math.abs(dd - bd) <= 1e-12 && dc < bc)){ bd = dd; bc = dc; best = b; } }); return best; };
      const TG = D.TRIO_G, bins = [0, 1, 2].map(bi => ({ bi, cx:TG.binX[bi] + TG.binW / 2, cy:TG.binY + TG.binH / 2, hw:TG.binW / 2, hh:TG.binH / 2, done:false }));
      let bad = 0, overlap = 0;
      for (let x = 0.25; x < W; x += 0.5) for (let y = 0.25; y < TG.H; y += 0.5){
        const p = { x, y };
        if (nearestAny(bins, p, TG.pad) !== ref(bins, p, TG.pad)) bad++;
        if (bins.filter(b => Math.abs(x - b.cx) <= b.hw + TG.pad && Math.abs(y - b.cy) <= b.hh + TG.pad).length > 1) overlap++;
      }
      if (bad) fail('nearestAny() on the trio houses: ' + bad + ' points go to a different house than the nearest box');
      if (!overlap) fail('nearestAny() on the trio houses: no point is in two snap zones — the overlap case is not exercised');
      /* 一大一小：大格裡、靠近小格的點，要給大格（量到方框，不是到中心） */
      const two = [{ id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false }];
      const r0 = nearestAny(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestAny(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      if (nearestAny(two, { x:300, y:300 }, 6) !== null) fail('nearestAny(): a drop far from every box is accepted');
    }
  }
  {
    const T = { a:{ n:'a', done:false }, b:{ n:'b', done:false }, F:{ n:'F', done:true } }, okA = t => t === T.a;
    [[T.a, T.b, 'a'], [T.b, T.a, 'a'], [T.b, null, 'b'], [null, T.b, 'b'], [null, T.a, 'a'], [T.b, T.b, 'b'], [null, null, null], [T.F, T.b, null], [T.b, T.F, null], [T.F, T.a, 'a']]
      .forEach(([tc, tf, want]) => { const g = D.dropTarget(tc, tf, okA); if ((g ? g.n : null) !== want) fail('dropTarget(' + (tc && tc.n) + ', ' + (tf && tf.n) + ') with "a" right gives ' + (g && g.n) + ', expected ' + want); });
  }

  /* ---------- 每一句遊戲字串：算式重算、中文黏數字、英文 1 後面的複數、undefined ---------- */
  LANGS.forEach(L => ['gAsks', 'gHints'].forEach(k => GAME_TYPES_REF.forEach(t => all.push([k + '.' + t + ' (' + L + ')', I18N[L][k][t]]))));
  let eqs = 0;
  all.forEach(([where, text]) => {
    const plain = String(text).replace(/<[^>]+>/g, ' ');
    scanEquations(plain).forEach(e => { eqs++; if (e.bad) fail(where + ': "' + e.text + '" arithmetic ' + e.bad); });
    const glued = plain.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) fail(where + ': missing space between Chinese and a digit: ' + glued.join(' ') + ' — ' + plain);
    const pl = plain.match(/(?<![\d.])1 (squares|parts|shots|children|rows|points|cards)\b/);
    if (pl) fail(where + ': "' + pl[0] + '" — singular after 1');
    if (/(^|[^\d\w])-\d/.test(plain)) fail(where + ': a negative number is shown: ' + plain);
  });
  /* 釘成精確值（codex 第一輪之後每一句都產生出來掃，2068 條）：一整類句子掉出掃描（換了寫法、掃描器讀不懂）時總數會變，要有人來看 */
  if (eqs !== 2068) fail(eqs + ' equations found in the game strings, expected 2068 — the arithmetic scan is not reading them all (or the pools changed and the new total needs a look)');
}

module.exports._test = { scanEquations };
