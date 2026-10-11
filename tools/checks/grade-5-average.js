/* grade-5/math/average 的檢查設定（平均分配站：移多補少、總和 ÷ 個數、平均 × 個數 ＝ 總和、平均的三個祕密）。
   2026-10-11 新增 —— 和小遊戲「平均神算」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔，
   simgen／verify_lesson_data／breaktest 對這一課一直是「找不到設定」。

   算式驗算：共用的 lib/arith.js（整數課）。這一課的句子有三種它讀不懂的寫法，先在 avgArith() 裡處理掉、不是跳過：
     - 「總和 ＝ 12 × 4 = 48」：左邊是名詞的等號是標題，不是宣稱 —— 換成冒號（只換「左邊緊鄰的不是數字也不是括號」的那一種）；
     - 「15 塊 ÷ 3 人 = 每人 5 塊」的「每人」、「$225」的 $：拿掉；
     - 商餘「60 ÷ 8 = 7 餘 4」／「7 r 4」：自己驗 被除數 ＝ 除數 × 商 ＋ 餘數、餘數比除數小，驗過才換成記號；
     - 「10 ＜ 15 ＜ 21」：自己驗由小到大（lib 看不到 ＜）。
   avgArith() 自己先跑正反例（ARITH_PROBES），靜態字串驗過的條數與指紋釘住。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用 make() 留下的原始參數重算；
   plausibleAvg 從選項本身找「唯一落在最小～最大之外的那一個」）、選項的形狀與範圍（從產生器自己的題庫推出來）、
   刻意的迷思誘答逐個值放行（stemEchoOk），renderCheck 把題幹與解釋交給 avgArith()（decimalDivide 是小數，另外逐項驗）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）與範例的句子函式（移多補少、三組資料的算式）逐條驗算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     第 1 關把每一題「所有合法的搬法」走遍（狀態圖），證明不會卡住、一定走得到一樣高、總數不變、高度不出畫板；
     第 2 關每一格 × 每一張卡；第 3 關每一題 × 0～20 每一個高度；第 4 關每一組 × 每一列；第 5 關每一題 × 每一根。
     每一句說明兩種語言逐條驗算，而且它說的那件事要真的成立（說「只是換人多」就真的是對調、說「反而變高」就真的變高……）；
     shuffle()、unsorted()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是放下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-average 的端對端測試驗（合成 PointerEvent）。 */

const crypto = require('crypto');
const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const LANGS = ['zh', 'en'];
const sumOf = a => a.reduce((s, v) => s + v, 0);
const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []); }

/* ---------- 這一課的算式驗算 ---------- */
const UNITS_ZH = ['公分', '塊', '人', '分', '元', '顆', '個', '天', '根', '組'];
const UNITS_EN = ['blocks?', 'people', 'points?', 'cm', 'candies', 'numbers?', 'days?', 'dollars?', 'bars?', 'sets?', 'tenths'];
const ARITH = makeArith({ units:UNITS_ZH, unitsEn:UNITS_EN });
/* 左邊是名詞的等號（「總和 ＝ 12 × 4」「Total = 12 × 4」）是標題，換成冒號；左邊是數字、括號、或「數字＋單位」（「3 個 = 93」）的才是宣稱 */
const UNIT_TAIL = new RegExp('\\d\\s*(?:' + UNITS_ZH.join('|') + '|' + UNITS_EN.join('|') + ')$');
function nounEquals(s){
  let out = '', last = 0;
  for (const m of s.matchAll(/[=＝](?=\s*\d)/g)){
    const before = s.slice(0, m.index).replace(/\s+$/, ''), after = s.slice(m.index + 1);
    /* 標題只認「名詞 ＝ 一條完整的算式 ＝ 結果」（總和 ＝ 12 × 4 = 48）；「Total = 999」這種單獨的名詞 ＝ 數字照樣交給驗算器（讀不懂就報錯） */
    const label = /^\s*\d+(?:\s*[×÷+\-−*/]\s*\d+)+\s*[=＝]\s*\d/.test(after);
    const claim = /[\d)）]$/.test(before) || UNIT_TAIL.test(before) || !label;
    out += s.slice(last, m.index) + (claim ? m[0] : '：');
    last = m.index + 1;
  }
  return out + s.slice(last);
}
const ARITH_SEEN = [];
function avgArith(text){
  const problems = [], results = [];
  let verified = 0;
  /* &nbsp; 是兩條算式中間的空白（中文版用全形空白）：換成全形空白，兩條鏈才不會黏成「240 240」；「15 blocks in total ÷ 3」的 in total 拿掉 */
  let s = String(text).replace(/<[^>]+>/g, ' ').replace(/(&nbsp;)+/g, '　').replace(/(\d+ blocks?) in total(?= [÷×])/g, '$1');
  /* 商餘：自己驗 */
  s = s.replace(/(\d+)\s*÷\s*(\d+)\s*[=＝]\s*(\d+)\s*(?:餘|r)\s*(\d+)/g, (m, a, b, q, r) => {
    a = +a; b = +b; q = +q; r = +r;
    if (a !== b * q + r || r >= b) problems.push('quotient/remainder is wrong: "' + m + '"');
    else { verified++; ARITH_SEEN.push(a + '/' + b + '=' + q + 'r' + r); results.push(q); }
    return ' QR ';
  });
  /* ＜ 串：真的由小到大 */
  s = s.replace(/\d+(?:\s*[<＜]\s*\d+)+/g, m => {
    const v = m.split(/[<＜]/).map(x => +x.trim());
    if (!v.every((x, i) => i === 0 || v[i - 1] < x)) problems.push('not increasing: "' + m + '"');
    else { verified++; ARITH_SEEN.push(v.join('<')); }
    return ' LT ';
  });
  /* 破折號在這一課從來不是減號（減號一律寫 −）：換成分號，不然「= 10 — 10 of them」會被讀成 10 − 10 */
  s = nounEquals(s.replace(/(\d)\s*[—–]\s*(?=\d)/g, '$1 − ').replace(/\s*[—–]+\s*/g, '；').replace(/每人\s*/g, '').replace(/\$(?=\d)/g, ''));
  const r = ARITH(s);
  r.problems.forEach(p => problems.push(p));
  verified += r.verified;
  r.verifiedList.forEach(x => { ARITH_SEEN.push(x); results.push(termValue(x.split('=').pop())); });
  return { problems, verified, results };
}
/* avgArith() 自己先證明會響：[文字, 應該被擋?] */
const ARITH_PROBES = [
  ['70+85+90+75 = 320，320 ÷ 4 = 80，所以平均是 80 分。', false],
  ['70+85+90+75 = 321，320 ÷ 4 = 80。', true],
  ['總和 ＝ 12 × 4 = 48，48 − 10 − 13 − 11 = 14。', false],
  ['總和 ＝ 12 × 4 = 49。', true],
  ['Total = average × count: 12 × 4 = 48.', false],
  ['15 塊 ÷ 3 人 = 每人 5 塊', false],
  ['15 塊 ÷ 3 人 = 每人 6 塊', true],
  ['15 blocks ÷ 3 people = 5 blocks each', false],
  ['45 × 5 = $225 in total.', false],
  ['45 × 5 = $255 in total.', true],
  ['60 ÷ 8 = 7 餘 4，共 7 個。', false],
  ['60 ÷ 8 = 7 餘 5，共 7 個。', true],
  ['60 ÷ 8 = 6 r 12 — 6 of them.', true],
  ['平均：10 ＜ 15 ＜ 21', false],
  ['Averages: 21 < 15 < 10', true],
  ['80 + 90 + 70 = 240&nbsp;&nbsp;&nbsp;&nbsp;240 ÷ 3 = <b>80</b>', false],
  ['80 + 90 + 70 = 240　　240 ÷ 3 = <b>81</b>', true],
  ['平均 31 × 3 個 = 93：拿掉一個之後', false],
  ['平均 31 × 3 個 = 94：拿掉一個之後', true],
  ['大家都是 5 塊了：20 塊 ÷ 4 人 = 每人 6 塊', true],
  ['Average 31 × 3 numbers = 92: after removing one', true],
  ['(1+2+6)÷3=4', true],
  ['Total = 999. 1 = 1.', true],
  ['總和 ＝ 999。1 = 1。', true],
  ['60 — 18 — 22 = 22', true],
  ['60 — 18 — 22 = 20', false]
];

/* JS 的註解拿掉（認得 ' " ` 字串，字串裡的 // 不是註解）—— need()／needIn() 只看真的會執行的字（codex 第二、三輪） */
function stripComments(code){
  let out = '', i = 0, q = null;
  while (i < code.length){
    const c = code[i], d = code[i + 1];
    if (q){ out += c; if (c === '\\'){ out += d || ''; i += 2; continue; } if (c === q) q = null; i++; continue; }
    if (c === "'" || c === '"' || c === '`'){ q = c; out += c; i++; continue; }
    if (c === '/' && d === '*'){ const e = code.indexOf('*/', i + 2); i = e < 0 ? code.length : e + 2; out += ' '; continue; }
    if (c === '/' && d === '/'){ while (i < code.length && code[i] !== '\n') i++; continue; }
    out += c; i++;
  }
  return out;
}
/* 「= 80 + 4」這種結果也要算得出值（只收數字與 + − × ÷ 括號） */
function termValue(t){
  const e = String(t).replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').trim();
  if (!/^[\d\s+\-*/().]+$/.test(e)) return NaN;
  try { return Function('return (' + e + ');')(); } catch (err){ return NaN; }
}
/* review.html：decimalDivide 是小數 —— 用自己的十分位整數逐項驗 */
function tenthsOf(s){ const m = /^(\d+)(?:\.(\d))?$/.exec(String(s)); return m ? +m[1] * 10 + +(m[2] || 0) : NaN; }
function tenthsStr(t){ return Math.floor(t / 10) + (t % 10 ? '.' + (t % 10) : ''); }

/* review.html 的八個產生器一個都不能少（codex 第一輪：拿掉一整個產生器，其他七個照樣全綠）。
   simgen 只看得到存在的產生器，所以這裡記下 renderCheck 看過哪些，simgen 結束時比對；少了就印 [FAIL] 並讓 exit code 變 1。 */
const GEN_IDS = ['avgCalc', 'reverseSum', 'missingValue', 'dailyTotal', 'plausibleAvg', 'addOneNew', 'decimalDivide', 'multiplesInRange'];
const INVENTORY = new Set();
if (/simgen\.js$/.test(process.argv[1] || '')) process.on('exit', () => {
  const miss = GEN_IDS.filter(g => !INVENTORY.has(g)), extra = [...INVENTORY].filter(g => GEN_IDS.indexOf(g) < 0);
  if (miss.length || extra.length){
    console.log('  [FAIL] generator inventory: expected ' + GEN_IDS.join(', ') + (miss.length ? ' — missing ' + miss.join(', ') : '') + (extra.length ? ' — unexpected ' + extra.join(', ') : ''));
    process.exitCode = 1;
  }
});

module.exports = {
  _avgArith: avgArith,
  breaks: [
    {"file": "index", "expect": "GAME_ORDER should be", "find": "var GAME_ORDER = ['level', 'formula', 'fill', 'sort', 'remove'];", "replace": "var GAME_ORDER = ['formula', 'level', 'fill', 'sort', 'remove'];"},
    {"file": "index", "expect": "on a 375px phone is under 44px", "find": "  var GPICK = 48;", "replace": "  var GPICK = 44;"},
    {"file": "index", "expect": "shuffle(): only", "find": "for (var j = a.length - 1; j > 0; j--){ var k = Math.floor(Math.random() * (j + 1));", "replace": "for (var j = a.length - 1; j > 0; j--){ var k = j;"},
    {"file": "index", "expect": "starts in the answer order", "find": "    if (t.every(function(x, i){ return i === 0 || keyOf(t[i - 1]) <= keyOf(x); })){ var s = t[0]; t[0] = t[1]; t[1] = s; }\n", "replace": ""},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = 20;"},
    {"file": "index", "expect": "a mistake at 20 points does not cost 5", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = 0;"},
    {"file": "index", "expect": "the same mistake again is charged again", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = gScore >= 5 ? 5 : 0;"},
    {"file": "index", "expect": "shown although nothing was taken", "find": "'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", "replace": "'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');"},
    {"file": "index", "expect": "the hint is cleared once a round is solved", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "nearestOpen() picks", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (!best){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "a drop on a filled row", "find": "    return best && !best.done ? best : null;", "replace": "    return best;"},
    {"file": "index", "expect": "a drop on a filled row", "find": "    list.forEach(function(b){\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;", "replace": "    list.forEach(function(b){\n      if (b.done) return;\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;"},
    {"file": "index", "expect": "board generation", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", "replace": ""},
    {"file": "index", "expect": "second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "losing pointer capture", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "release anywhere on the document", "find": "      document.addEventListener('pointerup', onDocEnd);\n", "replace": ""},
    {"file": "index", "expect": "tap vs drag threshold", "find": "if (!moved && dx * dx + dy * dy > 36){", "replace": "if (!moved && dx * dx + dy * dy > 0){"},
    {"file": "index", "expect": "board tap must stay within 10px", "find": "if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", "replace": "if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 40) return;"},
    {"file": "index", "expect": "placed pieces still catch taps", "find": "  .gpiece.locked{cursor:default;pointer-events:none}", "replace": "  .gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "the handle snaps while dragging", "find": "      if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));", "replace": "      if (o.axis === 'y') P.place(orig.x, orig.y + dy);"},
    {"file": "index", "expect": "ahead mode shows hint level 1", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", "replace": "    if (mode === 'school'){ hintLevel = 1; showHint(); }"},
    {"file": "index", "expect": "every round starts a new board generation", "find": "gSolved = false; gMistake = false; gCtx = {}; gGen++;", "replace": "gSolved = false; gMistake = false; gCtx = {};"},
    {"file": "index", "expect": "through poolPick()", "find": "      var sets = poolPick(GAME_SORT), done = 0;", "replace": "      var sets = pick(GAME_SORT), done = 0;"},
    {"file": "index", "expect": "should be refused", "find": "return a - b >= 2 ? null : b > a ? 'up' : b === a ? 'same' : 'swap';", "replace": "return a - b >= 1 ? null : b > a ? 'up' : b === a ? 'same' : 'swap';"},
    {"file": "index", "expect": "should be accepted", "find": "return a - b >= 2 ? null : b > a ? 'up' : b === a ? 'same' : 'swap';", "replace": "return a - b >= 3 ? null : b > a ? 'up' : b === a ? 'same' : 'swap';"},
    {"file": "index", "expect": "levelWhy: \"up\" for", "find": "return a - b >= 2 ? null : b > a ? 'up' : b === a ? 'same' : 'swap';", "replace": "return a - b >= 2 ? null : b > a ? 'same' : b === a ? 'up' : 'swap';"},
    {"file": "index", "expect": "do not share out evenly", "find": "var GAME_LEVEL = [[8,2,5],", "replace": "var GAME_LEVEL = [[8,2,6],"},
    {"file": "index", "expect": "outside 1~9", "find": "[9,4,5],[2,7,6]", "replace": "[10,3,5],[2,7,6]"},
    {"file": "index", "expect": "the same piles as example 1", "find": "var GAME_LEVEL = [[8,2,5],", "replace": "var GAME_LEVEL = [[7,3,5],"},
    {"file": "index", "expect": "gLevelBad.swap zh: numbers", "find": "搬一塊過去會變成 ' + (a - 1) + ' 塊和 ' + (b + 1) + ' 塊", "replace": "搬一塊過去會變成 ' + a + ' 塊和 ' + b + ' 塊"},
    {"file": "index", "expect": "gLevelDone zh", "find": "' 塊 ÷ ' + n + ' 人 = 每人 ' + A + ' 塊，這就是平均。'", "replace": "' 塊 ÷ ' + n + ' 人 = 每人 ' + (A + 1) + ' 塊，這就是平均。'"},
    {"file": "index", "expect": "gLevelNow en", "find": "gLevelNow: function(c){ return 'Now: ' + c.join(' + ') + ' = ' + I18N.en.blk(gSum(c)); },", "replace": "gLevelNow: function(c){ return 'Now: ' + c.join(' + ') + ' = ' + I18N.en.blk(gSum(c) + 1); },"},
    {"file": "index", "expect": "a move keeps the total", "find": "        c[i]--; c[j]++;", "replace": "        c[j]++;"},
    {"file": "index", "expect": "a drop on its own pile is silent", "find": "if (!col || col.i === P.data.i) return false;", "replace": "if (!col) return false;"},
    {"file": "index", "expect": "keyed by the kind of mistake and the pair of piles", "find": "c[j]), why + ':' + i + '>' + j);", "replace": "c[j]), c[i] + '>' + c[j]);"},
    {"file": "index", "expect": "only the top block can be picked up", "find": "for (var k = 0; k < (even ? v : v - 1); k++)", "replace": "for (var k = 0; k < v; k++)"},
    {"file": "index", "expect": "narrower than a pick target", "find": "colW:{ 3:92, 4:72 }", "replace": "colW:{ 3:92, 4:46 }"},
    {"file": "index", "expect": "covers the name label", "find": "colY:6, lblY:280, lblH:30, pad:6 };", "replace": "colY:6, lblY:268, lblH:30, pad:6 };"},
    {"file": "index", "expect": "is above the board", "find": "var LEVEL = { W:300, H:316, baseY:262,", "replace": "var LEVEL = { W:300, H:316, baseY:200,"},
    {"file": "index", "expect": "example 1 lvlLine zh", "find": "lvlLine: function(sum, n, avg){ return '全部 ' + sum + ' 塊 ÷ ' + n + ' 人 = 每人 ' + avg + ' 塊'; },", "replace": "lvlLine: function(sum, n, avg){ return '全部 ' + sum + ' 塊 ÷ ' + n + ' 人 = 每人 ' + (avg + 1) + ' 塊'; },"},
    {"file": "index", "expect": "the animation moves blocks", "find": "var LVL_START = [7, 3, 5];", "replace": "var LVL_START = [7, 2, 6];"},
    {"file": "index", "expect": "accepted a wrong card", "find": "    if (v === formWant(f, slot)) return null;", "replace": "    if (true) return null;"},
    {"file": "index", "expect": "formWant(", "find": "  function formWant(f, slot){ return [f.S, f.n, f.A][slot]; }", "replace": "  function formWant(f, slot){ return [f.S, f.A, f.n][slot]; }"},
    {"file": "index", "expect": "formInfo() disagrees", "find": "miscount:zero ? n - 1 : n + 1 };", "replace": "miscount:n - 1 };"},
    {"file": "index", "expect": "formCards() deals", "find": "  function formCards(f){ return shuffle([f.S, f.n, f.A, f.M, f.miscount]); }", "replace": "  function formCards(f){ return shuffle([f.S, f.n, f.A, f.M, f.n + 2]); }"},
    {"file": "index", "expect": "formWhy slot 2", "find": "gFormQuot: function(v, n){ return v + ' × ' + n + ' = ' + (v * n) + '，可是", "replace": "gFormQuot: function(v, n){ return v + ' × ' + n + ' = ' + (v * n + 1) + '，可是"},
    {"file": "index", "expect": "formWhy slot 1", "find": "gFormZero: function(n){ return '數一數：這組有 ' + n + ' 個數", "replace": "gFormZero: function(n){ return '數一數：這組有 ' + (n - 1) + ' 個數"},
    {"file": "index", "expect": "whole-number average", "find": ",[7,13,10,6]];", "replace": ",[7,13,10,7]];"},
    {"file": "index", "expect": "not all different", "find": ",[16,9,11,12],", "replace": ",[12,12,12,12],"},
    {"file": "index", "expect": "zones overlap", "find": "slotH:56, opW:30,", "replace": "slotH:56, opW:14,"},
    {"file": "index", "expect": "keyed by box and card", "find": "roundMiss(why, s.i + ':' + v)", "replace": "roundMiss(why, String(v))"},
    {"file": "index", "expect": "the box zone includes its label", "find": "var zH = FORM.lblY + FORM.lblH - FORM.slotY;", "replace": "var zH = FORM.slotH;"},
    {"file": "index", "expect": "gFormDone en", "find": "the average of these numbers is ' + A + '.' + (zero ? ' 0 counts as a number too.' : ''); },", "replace": "the average of these numbers is ' + A + '.' + ' 0 counts as a number too.'; },"},
    {"file": "index", "expect": "a wrong height is accepted", "find": "    if (T === S) return null;", "replace": "    if (true) return null;"},
    {"file": "index", "expect": "the wrong way round", "find": "    return T > S ? d.gFillHigh(list, T, it.A, n, S) : d.gFillLow(list, T, it.A, n, S);", "replace": "    return T < S ? d.gFillHigh(list, T, it.A, n, S) : d.gFillLow(list, T, it.A, n, S);"},
    {"file": "index", "expect": "fillVal(): the height of", "find": "Math.min(FILL.max, Math.round((FILL.base - y) / FILL.unit)));", "replace": "Math.min(FILL.max, Math.floor((FILL.base - y) / FILL.unit)));"},
    {"file": "index", "expect": "does not clamp", "find": "  function fillVal(y){ return Math.max(0, Math.min(FILL.max, Math.round((FILL.base - y) / FILL.unit))); }", "replace": "  function fillVal(y){ return Math.round((FILL.base - y) / FILL.unit); }"},
    {"file": "index", "expect": "fillWhy x=", "find": "' = ' + S + ' 多了 ' + (T - S) + ' —— 最後一根太高了。'", "replace": "' = ' + S + ' 多了 ' + (T - S + 1) + ' —— 最後一根太高了。'"},
    {"file": "index", "expect": "equals the average line", "find": "{ known:[15,9,14], A:12 }", "replace": "{ known:[15,9,12], A:12 }"},
    {"file": "index", "expect": "outside 1~20", "find": "{ known:[6,11,10], A:8 }", "replace": "{ known:[6,11,10], A:12 }"},
    {"file": "index", "expect": "0 is only a reminder", "find": "        if (why === 'zero'){ roundNote(d.gFillZero); return; }", "replace": "        if (why === 'zero'){ roundMiss(d.gFillZero, 'x0'); return; }"},
    {"file": "index", "expect": "keyed by the height", "find": "roundMiss(why, 'x' + x)", "replace": "roundMiss(why, 'x')"},
    {"file": "index", "expect": "the tap zone is the last column", "find": "if (Math.abs(pt.x - lx) > cw / 2 ||", "replace": "if (Math.abs(pt.x - lx) > cw ||"},
    {"file": "index", "expect": "the handle would cover the neighbouring value label", "find": "barW:30, valW:36, valH:26,", "replace": "barW:30, valW:44, valH:26,"},
    {"file": "index", "expect": "handle at 0 covers the name labels", "find": "plotR:250, base:232, unit:9,", "replace": "plotR:250, base:245, unit:9,"},
    {"file": "index", "expect": "must say the bar is still 0", "find": "gFillZero: '最後一根還是 0 —— 拖一拖", "replace": "gFillZero: '最後一根還沒有動 —— 拖一拖"},
    {"file": "index", "expect": "sortWhy zh", "find": "    return r === row ? null : d.gSortBad(", "replace": "    return true ? null : d.gSortBad("},
    {"file": "index", "expect": "sortAvg()/sortRank() disagree", "find": "return sets.filter(function(s){ return sortAvg(s) < a; }).length; }", "replace": "return sets.filter(function(s){ return sortAvg(s) <= a; }).length; }"},
    {"file": "index", "expect": "the tray starts in the answer order", "find": "  function sortTray(sets){ return unsorted(sets, sortAvg); }", "replace": "  function sortTray(sets){ return sets.slice().sort(function(a, b){ return sortAvg(a) - sortAvg(b); }); }"},
    {"file": "index", "expect": "sortWhy zh: numbers", "find": "；三組裡平均比它低的有 ' + r + ' 組", "replace": "；三組裡平均比它低的有 ' + (r + 1) + ' 組"},
    {"file": "index", "expect": "not increasing", "find": "gSortDone: function(avgs, longestLowest){ return '平均：' + avgs.join(' ＜ ')", "replace": "gSortDone: function(avgs, longestLowest){ return '平均：' + avgs.slice().reverse().join(' ＜ ')"},
    {"file": "index", "expect": "never overlap", "find": "cardW:204, cardH:48, trayX:150, trayY:[214,268,322], pad:8 };", "replace": "cardW:204, cardH:48, trayX:150, trayY:[214,268,322], pad:3 };"},
    {"file": "index", "expect": "keyed by set and row", "find": "roundMiss(why, sets.indexOf(set) + '@' + r.i)", "replace": "roundMiss(why, 'r' + r.i)"},
    {"file": "index", "expect": "the row zone includes its rank label", "find": "cx:(SORT.lblX + SORT.slotX + SORT.slotW) / 2, cy:y + SORT.rowH / 2, hw:(SORT.slotX + SORT.slotW - SORT.lblX) / 2", "replace": "cx:SORT.slotX + SORT.slotW / 2, cy:y + SORT.rowH / 2, hw:SORT.slotW / 2"},
    {"file": "index", "expect": "does not fit a", "find": "slotW:214, cardW:204,", "replace": "slotW:214, cardW:120,"},
    {"file": "index", "expect": "remWhy zh", "find": "    if (i === r.out) return null;", "replace": "    if (true) return null;"},
    {"file": "index", "expect": "\"further from the goal\" is", "find": "away = (a.avg - r.avg) * (r.T - r.avg) < 0;", "replace": "away = (a.avg - r.avg) * (r.T - r.avg) > 0;"},
    {"file": "index", "expect": "says the average went", "find": "' —— 平均' + (away ? '反而' : '') + '變' + (up ? '高' : '低') + '了，'", "replace": "' —— 平均' + (away ? '反而' : '') + '變' + (up ? '低' : '高') + '了，'"},
    {"file": "index", "expect": "gRemDone zh: the direction is wrong", "find": "，就把平均從 ' + T + ' 拉' + (avg > T ? '高' : '低') + '到 '", "replace": "，就把平均從 ' + T + ' 拉' + (avg > T ? '低' : '高') + '到 '"},
    {"file": "index", "expect": "the goal or the current average is one of the numbers", "find": "{ nums:[33,36,24,327], out:3 }", "replace": "{ nums:[30,36,24,330], out:3 }"},
    {"file": "index", "expect": "is not whole", "find": "{ nums:[42,48,39,255], out:3 }", "replace": "{ nums:[42,48,40,255], out:3 }"},
    {"file": "index", "expect": "keyed by the bar", "find": "roundMiss(why, 'r' + col.i)", "replace": "roundMiss(why, 'r')"},
    {"file": "index", "expect": "each column owns its own width", "find": "return pt.x >= c.x0 && pt.x < c.x1;", "replace": "return pt.x >= c.x0 - 10 && pt.x < c.x1;"},
    {"file": "index", "expect": "columns are under 44px", "find": "var REM = { W:300, H:278, plotL:8, plotR:248,", "replace": "var REM = { W:300, H:278, plotL:8, plotR:200,"},
    {"file": "index", "expect": "no set where one very small number", "find": "{ nums:[77,86,83,2], out:3 }", "replace": "{ nums:[33,27,36,312], out:3 }"},
    {"file": "index", "expect": "is not the one number farthest", "find": "{ nums:[15,24,18,183], out:3 }", "replace": "{ nums:[15,24,18,183], out:0 }"},
    {"file": "index", "expect": "arithmetic is wrong", "find": "why:'70+85+90+75 = 320，320 ÷ 4 = 80，所以平均是 80 分。' },", "replace": "why:'70+85+90+75 = 330，320 ÷ 4 = 80，所以平均是 80 分。' },"},
    {"file": "index", "expect": "the verified static equations changed", "find": "fact2p: '4 個人的平均身高是 130 公分，<br>總和就是 130 × 4 = 520 公分。',", "replace": "fact2p: '4 個人的平均身高是 130 公分，<br>總和就是 130 × 2 = 260 公分。',"},
    {"file": "index", "expect": "the old game description", "find": "s5lead: '移多補少、拼出算式、補上最後一根、比平均、拿掉把平均拉偏的數", "replace": "s5lead: '看清楚這組數字，選出正確的平均數。移多補少、拼出算式、補上最後一根、比平均、拿掉把平均拉偏的數"},
    {"file": "index", "expect": "missing space", "find": "gLevelOk: function(ni, nj, S){ return '從 ' + ni + ' 搬一塊給 ' + nj + ' —— 全部還是 ' + S + ' 塊。'; },", "replace": "gLevelOk: function(ni, nj, S){ return '從 ' + ni + ' 搬一塊給 ' + nj + ' —— 全部還是' + S + '塊。'; },"},
    {"file": "index", "expect": "Chinese characters", "find": "      gTag: 'Avg.',", "replace": "      gTag: '平均',"},
    {"file": "index", "expect": "\"1 blocks\"", "find": "blk: function(n){ return n + (n === 1 ? ' block' : ' blocks'); },", "replace": "blk: function(n){ return n + ' blocks'; },"},
    {"file": "review", "expect": "out of the stem", "find": "var m = mixOpts(avg, [avg - 1, avg + 1, s], nums.concat([n]));", "replace": "var m = mixOpts(avg, [avg - 1, avg + 1, s]);"},
    {"file": "review", "expect": "out of the stem", "find": "var m = mixOpts(q, [round1(q - 0.1), round1(q + 0.1), qt], [dividend, k]);", "replace": "var m = mixOpts(q, [round1(q - 0.1), round1(q + 0.1), round1(q * 2)]);"},
    {"file": "review", "expect": "out of the stem", "find": "var m = mixOpts(c, [c - 1, c + 1, c + 2], [k, range]);", "replace": "var m = mixOpts(c, [c - 1, c + 1, c + 2]);"},
    {"file": "review", "expect": "out of the stem", "find": "var m = mixOpts(newAvg, [avg, newAvg - 1, newAvg + 1], avoidExcept(nums.concat([n, newVal, avg]), [avg]));", "replace": "var m = mixOpts(newAvg, [avg, newAvg - 1, newAvg + 1]);"},
    {"file": "review", "expect": "out of the stem", "find": "var m = mixOpts(missing, [missing - 2, missing + 2, avg], avoidExcept(known.concat([n, n - 1, avg]), [avg]));", "replace": "var m = mixOpts(missing, [missing - 2, missing + 2, avg]);"},
    {"file": "review", "expect": "do not average to", "find": "      devs.push(-total);", "replace": "      devs.push(0);"},
    {"file": "review", "expect": "sum != avg × n", "find": "        var s = avg * n;\n        var m = mixOpts(s, [s - n, s + n, avg], [n]);", "replace": "        var s = avg * n + 1;\n        var m = mixOpts(s, [s - n, s + n, avg], [n]);"},
    {"file": "review", "expect": "outside the range", "find": "        var above = max + (1 + rand(5));", "replace": "        var above = max - 1;"},
    {"file": "review", "expect": "decimalDivide explanation does not add up", "find": "' 個 0.1，也就是 ' + d.q + '。'", "replace": "' 個 0.1，也就是 ' + d.qt + '。'"},
    {"file": "review", "expect": "c is not floor(range / k)", "find": "        var c = Math.floor(range / k);", "replace": "        var c = Math.ceil(range / k);"},
    {"file": "review", "expect": "arithmetic is wrong", "find": "' − ' + d.known.join(' − ') + ' = ' + d.missing + '。'", "replace": "' − ' + d.known.join(' − ') + ' = ' + (d.missing + 1) + '。'"},
    {"file": "review", "expect": "sum + newVal != newAvg", "find": "        var newVal = newAvg * (n + 1) - s;", "replace": "        var newVal = newAvg * (n + 1) - s + 1;"},
    {"file": "review", "expect": "total != perDay × days", "find": "        var total = perDay * days;", "replace": "        var total = perDay * days + 1;"},
    {"file": "review", "expect": "generator inventory", "find": "  ];\n\n  /* ---------- 出一批 12 題", "replace": "  ];\n  GENS = GENS.filter(function(g){ return g.id !== 'dailyTotal'; });\n\n  /* ---------- 出一批 12 題"},
    {"file": "review", "expect": "claims", "find": "            ? '總和 ＝ 平均 × 個數：' + d.avg + ' × ' + d.n + ' = ' + d.sum + '。'", "replace": "            ? '總和 ＝ ' + (d.sum + 1) + '。' + d.avg + ' × ' + d.n + ' = ' + d.sum + '。'"},
    {"file": "review", "expect": "claims", "find": "' − ' + d.known.join(' − ') + ' = ' + d.missing + '。'", "replace": "' — ' + d.known.join(' — ') + ' = ' + d.known[d.known.length - 1] + '。'"},
    {"file": "review", "expect": "never reaches the marked answer", "find": "            ? d.nums.join(' + ') + ' = ' + d.sum + '，' + d.sum + ' ÷ ' + d.n + ' = ' + d.avg + '。'", "replace": "            ? d.nums.join(' + ') + ' = ' + d.sum + '，再除以 ' + d.n + '。'"},
    {"file": "review", "expect": "forgot to multiply", "find": "var m = mixOpts(total, [total - days, total + days, perDay], avoidExcept([days], [perDay]));", "replace": "var m = mixOpts(total, [total - days, total + days, perDay], [days]);"},
    {"file": "review", "expect": "outside the pools", "find": "        var qt = 20 + rand(70);", "replace": "        var qt = 19 + rand(71);"},
    {"file": "review", "expect": "OUTSIDE the range", "find": "超出這個範圍，不可能是平均。'", "replace": "在這個範圍裡，不可能是平均。'"},
    {"file": "index", "expect": "a minus sign glued to a number", "find": "return '最多的是 ' + ni + '（' + a + ' 塊），最少的是 '", "replace": "return '最多的是 ' + ni + '（−' + a + ' 塊），最少的是 '"},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    /* var pts = gMistake ? 10 : 20; */ var pts = 20;"},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = 20; // var pts = gMistake ? 10 : 20;"},
    {"file": "review", "expect": "is not the result of any verified equation", "find": "            ? d.nums.join(' + ') + ' = ' + d.sum + '，' + d.sum + ' ÷ ' + d.n + ' = ' + d.avg + '。'", "replace": "            ? d.nums.join(' + ') + ' = ' + d.sum + '，所以答案是 ' + d.avg + '。'"},
    {"file": "index", "expect": "release anywhere on the document", "find": "      document.addEventListener('pointerup', onDocEnd);\n", "replace": "      var qq = \"\"// document.addEventListener('pointerup', onDocEnd);\n"},
    {"file": "review", "expect": "strays further", "find": "        var delta = pick([1, 2, 3]);", "replace": "        nums[0] += 17; nums[1] -= 17;\n        var delta = pick([1, 2, 3]);"},
    {"file": "index", "expect": "no visual give-away", "find": "cls:'gcard gnumcard', data:{ v:v }", "replace": "cls:'gcard gnumcard' + (v === f.S ? ' gok' : ''), data:{ v:v }"},
    {"file": "index", "expect": "a redraw clears the tap selection", "find": "        B.selected = null;   /* 積木全部重畫", "replace": "        /* 積木全部重畫"},
    {"file": "index", "expect": "restyles a card after creating it", "find": "cls:'gcard gnumcard', data:{ v:v } });", "replace": "cls:'gcard gnumcard', data:{ v:v } }).el.classList.toggle('gok', v === f.S);"},
    {"file": "index", "expect": "a position-only player beats chance", "find": "    var order = shuffle(it.nums.map(function(v, i){ return i; }));", "replace": "    var order = it.nums.map(function(v, i){ return i; });"},
    {"file": "index", "expect": "at most 1", "find": "[[6,10],[11,12,13],[3,5,7,4,6]], [[5,6,7],[8,10,9,7,11],[13,17]]", "replace": "[[6,10],[11,12,13],[23,25,27,24,26]], [[5,6,7],[8,10,9,7,11],[1,3]]"},
    {"file": "index", "expect": "the biggest-total set is never lowest", "find": ", [[9,10,11],[10,12,11,11],[8,9,10,9,9]]\n  ];", "replace": "\n  ];"},
    {"file": "index", "expect": "exactly when the most-numbers set is lowest", "find": "(longestLowest ? '：數字最多的那一組平均反而最低 —— 數字比較多，平均不一定比較大。' : '，不是有幾個數，也不是總和。')", "replace": "'，不是有幾個數，也不是總和。'"},
    {"file": "index", "expect": "the bars are dealt in a shuffled order", "find": "var r = remInfo(remDeal(poolPick(GAME_REMOVE)))", "replace": "var r = remInfo(poolPick(GAME_REMOVE))"},
    {"file": "index", "expect": "count predicts the order across boards", "find": "    [[7,8,9],[10,12],[13,15,14,12,16]], [[11,13],", "replace": "    [[11,13],"},
    {"file": "index", "expect": "a board press started before the round changed is forgotten", "find": "gGen++; BOARD_TAP = null; PIECE_PTR = {};", "replace": "gGen++; PIECE_PTR = {};"}
  ],

  sim: {
    INVARIANTS: {
      avgCalc: d => {
        if ([2, 3, 4, 5].indexOf(d.n) < 0 || [6,7,8,9,10,11,12,14,15,16,18,20,22,24,25].indexOf(d.avg) < 0) return 'n ' + d.n + ' / avg ' + d.avg + ' outside the generator’s pools';
        if (d.nums.some(v => Math.abs(v - d.avg) > 4 * (d.n - 1))) return 'a number strays further from the average than the deviations allow';
        if (d.nums.length !== d.n || sumOf(d.nums) !== d.sum || d.sum !== d.avg * d.n) return 'the numbers ' + d.nums.join(',') + ' do not average to ' + d.avg;
        if (d.nums.some(v => !(v > 0))) return 'a number is not positive';
      },
      reverseSum: d => {
        if ([3, 4, 5].indexOf(d.n) < 0 || [6,8,9,10,12,14,15,16,18,20].indexOf(d.avg) < 0) return 'n / avg outside the pools';
        if (d.sum !== d.avg * d.n) return 'sum != avg × n';
      },
      missingValue: d => {
        if ([3, 4, 5].indexOf(d.n) < 0 || [10,12,15,18,20,24,25,30].indexOf(d.avg) < 0 || d.known.some(v => Math.abs(v - d.avg) > 4)) return 'n / avg / known numbers outside the pools';
        if (d.known.length !== d.n - 1) return 'known has ' + d.known.length + ' numbers, not n − 1';
        if (sumOf(d.known) + d.missing !== d.avg * d.n || d.sum !== d.avg * d.n) return 'known + missing != avg × n';
        if (!(d.missing > 0) || d.known.some(v => !(v > 0))) return 'a number is not positive';
      },
      dailyTotal: d => {
        if ([5, 6, 7, 10].indexOf(d.days) < 0 || [8, 10, 12, 15, 18, 20, 25].indexOf(d.perDay) < 0) return 'days / perDay outside the pools';
        if (d.total !== d.perDay * d.days) return 'total != perDay × days';
        if (d.opts.indexOf(d.perDay) < 0) return 'the deliberate “forgot to multiply” distractor ' + d.perDay + ' is missing';
      },
      plausibleAvg: d => {
        if ([10, 15, 20, 25, 30, 35, 40].indexOf(d.min) < 0 || !(d.max - d.min >= 8 && d.max - d.min <= 12)) return 'min / gap outside the pools';
        if (!((d.impossible >= d.min - 5 && d.impossible < d.min) || (d.impossible > d.max && d.impossible <= d.max + 5))) return 'the impossible value is not 1~5 outside the range';
        if (d.opts[d.ans] !== d.impossible) return 'the marked option is not the impossible one';
        if (!(d.impossible < d.min || d.impossible > d.max)) return 'the "impossible" average ' + d.impossible + ' is inside ' + d.min + '~' + d.max;
        if (d.opts.some((v, i) => i !== d.ans && !(v > d.min && v < d.max))) return 'a "possible" option is not strictly between min and max';
      },
      addOneNew: d => {
        if ([3, 4].indexOf(d.n) < 0 || [8,10,12,14,15,16,18,20].indexOf(d.avg) < 0 || [1, 2, 3].indexOf(d.newAvg - d.avg) < 0) return 'n / avg / delta outside the pools';
        if (d.nums.some(v => Math.abs(v - d.avg) > 4 * (d.n - 1))) return 'an old number strays further from the average than the deviations allow';
        if (sumOf(d.nums) !== d.sum || d.sum !== d.avg * d.n || d.nums.length !== d.n) return 'the old numbers do not average to ' + d.avg;
        if (d.sum + d.newVal !== d.newAvg * (d.n + 1)) return 'sum + newVal != newAvg × (n + 1)';
        if (!(d.newVal > 0) || d.nums.some(v => !(v > 0))) return 'a number is not positive';
      },
      decimalDivide: d => {
        if ([2, 3, 4, 5, 6].indexOf(d.k) < 0 || !(isInt(d.qt) && d.qt >= 20 && d.qt <= 89)) return 'k / qt outside the pools (k 2~6, quotient 2.0~8.9)';
        if (d.opts.indexOf(d.qt) < 0 && d.opts.indexOf(d.q) >= 0 && String(d.qt) !== String(d.dividend)) return 'the “forgot the decimal point” distractor ' + d.qt + ' is missing';
        if (d.dividendTenths !== d.qt * d.k) return 'dividendTenths != qt × k';
        if (tenthsOf(String(d.dividend)) !== d.dividendTenths || tenthsOf(String(d.q)) !== d.qt) return 'dividend / q are not the tenths they claim';
      },
      multiplesInRange: d => {
        if ([3, 4, 6, 7, 8, 9].indexOf(d.k) < 0 || [30, 40, 50, 60].indexOf(d.range) < 0) return 'k / range outside the pools';
        if (d.c * d.k > d.range || (d.c + 1) * d.k <= d.range) return 'c is not floor(range / k)'; }
    },
    /* 正解的第二套實作：只用原始參數重算 */
    expectedCorrect: function(d, genId, L){
      switch (genId){
        case 'avgCalc': return String(sumOf(d.nums) / d.nums.length);
        case 'reverseSum': return String(d.avg * d.n);
        case 'missingValue': return String(d.avg * d.n - sumOf(d.known));
        case 'dailyTotal': return String(d.perDay * d.days);
        case 'plausibleAvg': {
          const out = d.opts.filter(v => v < d.min || v > d.max);
          return out.length === 1 ? String(out[0]) : 'NOT EXACTLY ONE IMPOSSIBLE OPTION (' + out.join(',') + ')';
        }
        case 'addOneNew': return String((sumOf(d.nums) + d.newVal) / (d.n + 1));
        case 'decimalDivide': return tenthsStr(d.dividendTenths / d.k);
        case 'multiplesInRange': {
          let c = 0; for (let v = 1; v <= d.range; v++) if (v % d.k === 0) c++;
          return L === 'zh' ? c + ' 個' : String(c);
        }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, L){
      const range = (v, lo, hi) => (v >= lo && v <= hi) ? null : 'option ' + s + ' outside ' + lo + '~' + hi;
      if (genId === 'decimalDivide'){
        if (!/^\d+(?:\.\d)?$/.test(s)) return 'option "' + s + '" is not a number with at most one decimal place';
        return range(+s, 1, 89);   /* 商 2.0～8.9，± 0.1（撞到題幹的數時往外補 ± 1）；「小數點忘了點」是 20～89 */
      }
      if (genId === 'multiplesInRange'){
        const m = s.match(L === 'zh' ? /^(\d+) 個$/ : /^(\d+)$/);
        if (!m) return 'option "' + s + '" is not "' + (L === 'zh' ? 'n 個' : 'n') + '"';
        return range(+m[1], 1, 22);   /* 30÷9 ＝ 3 … 60÷3 ＝ 20，誘答 −1、+1、+2 */
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      if (genId === 'avgCalc') return range(+s, 1, 145);          /* 平均 6～25、總和最多 (25+4)×5 */
      if (genId === 'reverseSum') return range(+s, 6, 105);       /* 平均 6～20 × 3～5，誘答 ± n、平均 */
      if (genId === 'missingValue') return range(+s, 1, 50);      /* 平均 10～30，最後一個 ＝ 平均 ± 最多 16 */
      if (genId === 'dailyTotal') return range(+s, 8, 260);       /* 每天 8～25 × 5～10 天，誘答 ± 天數、每天 */
      if (genId === 'plausibleAvg') return range(+s, 5, 57);      /* 最小 10～40、相差 8～12，外面最多差 5：5～57 */
      if (genId === 'addOneNew') return range(+s, 1, 30);         /* 平均 8～20、新平均多 1～3；候選撞到題幹時往外補 */
      return 'no range defined for ' + genId;
    },
    /* 刻意的迷思誘答（逐個值放行，不是整個產生器）：把題幹的平均當成答案（reverseSum：平均當總和；missingValue：
       以為最後一個就等於平均；addOneNew：以為加一個數平均不會變）、dailyTotal 只抄每天存多少（沒有乘）。 */
    stemEchoOk: {
      reverseSum: (d, opt) => Number(opt) === d.avg,
      missingValue: (d, opt) => Number(opt) === d.avg,
      addOneNew: (d, opt) => Number(opt) === d.avg,
      dailyTotal: (d, opt) => Number(opt) === d.perDay,
      /* 共用檢查把「23.4」拆成 23 和 4：選項 4 不是抄題幹。只有真的等於題幹印出來的被除數或除數才算抄（那兩個 avoid 已經擋掉） */
      decimalDivide: (d, opt) => Number(opt) !== Number(d.dividend) && Number(opt) !== d.k
    },
    renderCheck: function(d, q, L, genId){
      INVENTORY.add(genId);
      /* 共用的「誘答抄題幹」只比純數字的選項；中文 multiplesInRange 的選項是「8 個」，那條檢查一次都不會響 ——
         這裡把每個誘答的數（含小數）和題幹裡印出來的數（整個小數一起讀）比，放行的只有刻意的那一個迷思值。 */
      const stemVals = nums(q.stem).map(Number);
      const allow = { reverseSum:[d.avg], missingValue:[d.avg], addOneNew:[d.avg], dailyTotal:[d.perDay] }[genId] || [];
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const v = nums(q.opts[i]);
        if (v.length === 1 && stemVals.indexOf(+v[0]) >= 0 && allow.indexOf(+v[0]) < 0) return 'distractor "' + q.opts[i] + '" copies the number ' + v[0] + ' out of the stem';
      }
      if (genId === 'decimalDivide'){
        /* zh「4.6 裡面有 46 個 0.1，46 ÷ 2 = 23 個 0.1，也就是 2.3。」／en「4.6 is 46 tenths. 46 ÷ 2 = 23 tenths, which is 2.3.」 */
        const n = nums(q.why).filter(x => x !== '0.1');
        if (n.length !== 6 || tenthsOf(n[0]) !== +n[1] || n[1] !== n[2] || +n[2] !== +n[3] * +n[4] || tenthsOf(n[5]) !== +n[4] || +n[3] !== d.k)
          return 'decimalDivide explanation does not add up: ' + q.why;
        if (!new RegExp('^' + n[0].replace('.', '\\.') + ' ÷ ' + d.k + ' = \\?$').test(q.stem)) return 'decimalDivide stem is not "' + n[0] + ' ÷ ' + d.k + ' = ?": ' + q.stem;
        return;
      }
      /* 解釋一定要走到被標成正解的那個數 */
      const ansNum = nums(q.opts[q.ans])[0];
      if (nums(q.why).indexOf(ansNum) < 0) return 'the explanation never reaches the marked answer ' + q.opts[q.ans] + ': ' + q.why;
      const r = avgArith(q.stem + '\n' + q.why);
      if (r.problems.length) return 'claims: ' + r.problems[0];
      /* 而且正解要是某一條「驗過的算式」算出來的結果（不是隨便提到那個數）—— codex 第二輪 */
      /* 結果只從解釋本身算（題幹裡的算式不算「解釋走到了答案」） */
      if (genId !== 'plausibleAvg' && avgArith(q.why).results.indexOf(+ansNum) < 0) return 'the marked answer ' + ansNum + ' is not the result of any verified equation in: ' + q.why;
      if (genId !== 'plausibleAvg' && !r.verified) return 'the explanation has no verifiable equation: ' + q.why;
      if (genId === 'plausibleAvg'){
        const n = nums(q.why).map(Number);
        if (!(L === 'zh' ? /超出這個範圍，不可能是平均/ : /is outside that range, so it cannot be the average/).test(q.why)) return 'plausibleAvg explanation must say the value is OUTSIDE the range: ' + q.why;
        if (n[0] !== d.min || n[1] !== d.max || n[2] !== d.impossible) return 'plausibleAvg explanation does not name min, max and the impossible value: ' + q.why;
      }
    }
  },

  data: {
    dataStart: '  /* ---------- 語言無關的資料 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{SETS, GAME_ORDER, GPICK, pick, poolPick, shuffle, unsorted, gSum, GAME_LEVEL, LEVEL, levelX0, levelCx, levelTop, levelWhy, levelDone, GAME_FORMULA, FORM, formSlotX, formCellX, formCardCx, formInfo, formCards, formWant, formWhy, GAME_FILL, FILL, fillColW, fillCx, fillY, fillVal, fillMiss, fillWhy, GAME_SORT, SORT, sortAvg, sortTray, sortRank, sortLongestLowest, sortWhy, GAME_REMOVE, REM, remColW, remCx, remInfo, remDeal, remY, remAfter, remWhy}',
    /* 靜態字串（含三層題庫）驗過的算式：條數與指紋。改了字串就重新看過那幾條、再更新這裡 */
    STATIC_PIN: { n:32, fp:'acfae30e4626' },
    check: function(D, I18N, fail, src){
      /* 375px 手機：.wrap 左右各 20、.card 左右各 22 ＋ 1px 邊 → 畫板可用 289px */
      const K_PHONE = 289 / 300;
      const say = (where, L, text, want, minVerified) => {
        const s = String(text);
        if (/undefined|NaN|\[object|null/.test(s)) fail(where + ' ' + L + ': undefined/NaN/null in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: missing space between Chinese and a digit in "' + s + '"');
        if (/[-−－–](?=\d)/.test(s.replace(/<[^>]+>/g, '')) && !/\.gMinus$/.test(where)) fail(where + ' ' + L + ': a minus sign glued to a number (this lesson has no negative numbers) in "' + s + '"');
        if (L === 'en' && /(^|[^\d])1 (blocks|numbers|bars|sets)\b/.test(s)) fail(where + ' en: "1 ' + RegExp.$2 + '" in "' + s + '"');
        const r = avgArith(s);
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (want && nums(s).join() !== want.map(String).join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        if (minVerified !== undefined && r.verified < minVerified) fail(where + ' ' + L + ': only ' + r.verified + ' equation(s) verified, expected ' + minVerified + ' — "' + s + '"');
        return r;
      };
      /* need() 只看註解拿掉之後的原始碼：註解裡留一份「規則」不算數（codex 第一輪） */
      const live = src.split(/(<script>|<\/script>)/).map((part, i, all) => all[i - 1] === '<script>' ? stripComments(part) : part.replace(/\/\*[\s\S]*?\*\//g, ' ')).join('').replace(/<!--[\s\S]*?-->/g, ' ');
      const need = (what, text, count) => {
        const n = live.split(text).length - 1;
        if (n !== (count || 1)) fail('source: ' + what + ' — expected ' + (count || 1) + ' × "' + text.slice(0, 80) + '", found ' + n);
      };
      /* 在某一個函式（註解拿掉之後）裡面找 */
      const needIn = (fn, what, text) => {
        const body = extractFunction(src, fn);
        if (!body || stripComments(body).split(text).length !== 2) fail('source: ' + what + ' — ' + fn + '() must contain "' + text + '" exactly once');
      };
      const NAMES = { zh:I18N.zh.gNames, en:I18N.en.gNames };

      /* --- 0. 驗算器自己先證明會響 --- */
      ARITH_PROBES.forEach(([t, bad]) => {
        const r = avgArith(t);
        if (bad !== (r.problems.length > 0)) fail('avgArith() self-test: "' + t + '" should be ' + (bad ? 'rejected' : 'accepted') + ', got ' + JSON.stringify(r.problems));
        if (!bad && !r.verified) fail('avgArith() self-test: "' + t + '" verified nothing');
      });
      ARITH_SEEN.length = 0;

      /* --- 1. 每一條 I18N 靜態字串逐條驗算；驗過的條數與指紋釘住 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let staticN = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => { if (/\.(btn|htmlLang)$/.test(where)) return; staticN += say(where, L, s).verified; }));
      const fp = crypto.createHash('sha1').update(ARITH_SEEN.slice().sort().join('\n')).digest('hex').slice(0, 12);
      if (staticN < 20) fail('only ' + staticN + ' equations verified in the I18N strings — the claim scan is not reading them');
      const PIN = module.exports.data.STATIC_PIN;
      if (!PIN || staticN !== PIN.n || fp !== PIN.fp) fail('the verified static equations changed: ' + staticN + ' / ' + fp + ' (pinned ' + (PIN ? PIN.n + ' / ' + PIN.fp : 'nothing') + ') — re-check them and update STATIC_PIN');
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => LANGS.forEach(L => (I18N[L][bank] || []).forEach((q, i) => {
        const v = nums(q.opts[q.ans])[0];
        if (v !== undefined && nums(q.why).indexOf(v) < 0) fail(bank + '[' + i + '] ' + L + ': the explanation never reaches the marked answer ' + q.opts[q.ans]);
      })));
      /* 舊遊戲（五題選擇題、「答對愈快分數愈高」—— 從來沒有計時）的說法不可以留著 */
      if (/答對愈快|The faster you answer|選出正確的平均數|pick the correct average/.test(src)) fail('the old game description ("pick the average", "the faster you answer…") is still in index.html');

      /* --- 2. 範例：移多補少的 7、3、5 與三組資料的算式 --- */
      const lvl = (src.match(/var LVL_START = \[([\d, ]+)\];/) || [])[1];
      const LS = lvl ? lvl.split(',').map(Number) : [];
      const lsA = sumOf(LS) / LS.length;
      if (LS.length !== 3 || !isInt(lsA)) fail('example 1: LVL_START ' + LS.join(',') + ' does not share out evenly');
      if (!(LS[2] === lsA && LS[0] - lsA === lsA - LS[1])) fail('example 1: the animation moves blocks from pile 1 to pile 2 only — that levels ' + LS.join(',') + ' only if pile 3 already has the average');
      need('example 1 stops at the average', 'if (lvlCounts[0] > ' + lsA + '){');
      need('example 1 end state', 'var LVL_END = [' + [lsA, lsA, lsA].join(', ') + '];');
      LANGS.forEach(L => say('example 1 lvlLine', L, I18N[L].lvlLine(sumOf(LS), LS.length, lsA), [sumOf(LS), LS.length, lsA], 1));
      D.SETS.forEach((s, i) => {
        if (s.avg !== sumOf(s.nums) / s.nums.length) fail('example 2 set ' + i + ': avg ' + s.avg + ' is not ' + sumOf(s.nums) + ' ÷ ' + s.nums.length);
        LANGS.forEach(L => say('example 2 setLine ' + i, L, I18N[L].setLine(s.nums, sumOf(s.nums), s.nums.length, s.avg), s.nums.concat([sumOf(s.nums), sumOf(s.nums), s.nums.length, s.avg]), 2));
      });

      /* --- 3. 小遊戲：引擎與計分 --- */
      if (D.GAME_ORDER.join() !== 'level,formula,fill,sort,remove') fail('GAME_ORDER should be level, formula, fill, sort, remove (examples 1, 2, 3, 2 + quiz misconception, 3): ' + D.GAME_ORDER.join());
      if (D.GPICK * K_PHONE < 44) fail('GPICK ' + D.GPICK + ' × ' + K_PHONE.toFixed(3) + ' on a 375px phone is under 44px');
      /* shuffle()：每一個位置都抽得到每一個值 */
      const posSeen = {};
      for (let t = 0; t < 3000; t++){ const a = D.shuffle([0, 1, 2, 3, 4]); if (a.slice().sort().join() !== '0,1,2,3,4') fail('shuffle(): not a permutation'); a.forEach((v, i) => { posSeen[i + ':' + v] = 1; }); }
      if (Object.keys(posSeen).length !== 25) fail('shuffle(): only ' + Object.keys(posSeen).length + '/25 (position, value) pairs seen in 3000 shuffles');
      for (let t = 0; t < 3000; t++){ const a = D.unsorted([1, 2, 3], x => x); if (a.join() === '1,2,3') { fail('unsorted(): a tray starts in the answer order'); break; } }
      /* roundMiss() 從原始碼切出來真的跑：0、5、20 分；同一個鍵再一次不扣 */
      const rmSrc = extractFunction(src, 'roundMiss');
      if (!rmSrc) fail('cannot find roundMiss()');
      else {
        const mk = s0 => new Function('s0', 'var gMistake = false, gCtx = {}, gScore = s0, elScore = { textContent:"" }, gMsg = { innerHTML:"" };' +
          'function L(){ return { gMinus:"MINUS" }; }\n' + rmSrc + '\nreturn function(t, k){ roundMiss(t, k); return { score:gScore, minus:/MINUS/.test(gMsg.innerHTML), mistake:gMistake }; };')(s0);
        let f = mk(20), r = f('x', 'a');
        if (r.score !== 15 || !r.minus || !r.mistake) fail('roundMiss(): a mistake at 20 points does not cost 5 (score ' + r.score + ', minus ' + r.minus + ')');
        r = f('x', 'a');
        if (r.score !== 15 || r.minus) fail('roundMiss(): the same mistake again is charged again (score ' + r.score + ', minus ' + r.minus + ')');
        r = f('y', 'b');
        if (r.score !== 10) fail('roundMiss(): a different mistake is not charged (score ' + r.score + ')');
        f = mk(0); r = f('x', 'a');
        if (r.score !== 0 || r.minus || !r.mistake) fail('roundMiss(): at 0 points the −5 is shown although nothing was taken (score ' + r.score + ', minus ' + r.minus + ')');
        f = mk(5); r = f('x', 'a');
        if (r.score !== 0 || !r.minus) fail('roundMiss(): at 5 points a mistake does not cost 5 (score ' + r.score + ')');
      }
      needIn('roundSolved', 'scoring: a round should give +20 clean / +10 after mistakes', 'var pts = gMistake ? 10 : 20;');
      needIn('end', 'board generation: a piece from an old board does nothing when released', 'if (gen !== gGen) return;');
      need('second finger: only the primary pointer picks up', "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;");
      need('losing pointer capture puts the piece back', "el.addEventListener('lostpointercapture', function(e){ end(e, true); });");
      need('release anywhere on the document ends the drag', "document.addEventListener('pointerup', onDocEnd);");
      need('tap vs drag threshold (6px)', 'if (!moved && dx * dx + dy * dy > 36){');
      need('board tap must stay within 10px', 'if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;');
      need('placed pieces still catch taps', '.gpiece.locked{cursor:default;pointer-events:none}');
      need('touch-action only on pieces', 'touch-action:none;cursor:grab');
      need('the handle snaps while dragging', "if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));");
      needIn('roundSolved', 'the hint is cleared once a round is solved', "elHint.textContent = '';");
      need('ahead mode shows hint level 1', "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }");
      need('every round starts a new board generation', 'gSolved = false; gMistake = false; gCtx = {}; gGen++;');
      needIn('startRound', 'a board press started before the round changed is forgotten', 'gSolved = false; gMistake = false; gCtx = {}; gGen++; BOARD_TAP = null;');
      need('every round draws its pool entry through poolPick()', 'poolPick(GAME_', 5);
      need('five rounds, one roundMiss() call each', 'roundMiss(', 6);

      /* nearestOpen() 從原始碼切出來真的跑：每 0.5px 和自己的「最近的方框（一樣近比中心）」比 */
      const noSrc = extractFunction(src, 'nearestOpen');
      const nearestOpen = noSrc ? new Function(noSrc + '\nreturn nearestOpen;')() : null;
      if (!nearestOpen) fail('cannot find nearestOpen()');
      const ownNearest = (list, pt, pad) => {
        let best = null, bd = Infinity, bc = Infinity;
        for (const b of list){
          if (pt.x < b.cx - b.hw - pad || pt.x > b.cx + b.hw + pad || pt.y < b.cy - b.hh - pad || pt.y > b.cy + b.hh + pad) continue;
          const ex = Math.max(0, Math.abs(pt.x - b.cx) - b.hw), ey = Math.max(0, Math.abs(pt.y - b.cy) - b.hh), dd = Math.hypot(ex, ey), dc = Math.hypot(pt.x - b.cx, pt.y - b.cy);
          if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
        }
        return best && !best.done ? best : null;
      };
      const sweep = (name, list, pad, W, H) => {
        let bad = 0, overlap = 0;
        for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= H; y += 0.5){
          const pt = { x, y }, a = nearestOpen(list, pt, pad), b = ownNearest(list, pt, pad);
          if (a !== b && bad++ < 2) fail(name + ': nearestOpen() picks ' + (a ? a.i : 'nothing') + ' at (' + x + ', ' + y + '), the nearest box is ' + (b ? b.i : 'nothing'));
          if (list.filter(q => Math.abs(x - q.cx) <= q.hw + pad && Math.abs(y - q.cy) <= q.hh + pad).length > 1) overlap++;
        }
        return overlap;
      };

      /* --- 4. 第 1 關：移多補少 —— 每一題把所有合法的搬法走遍 --- */
      const sq = c => c.reduce((s, v) => s + v * v, 0);
      const levelText = {};
      D.GAME_LEVEL.forEach((c0, pi) => {
        const n = c0.length, S = sumOf(c0), A = S / n;
        if (!(n === 3 || n === 4)) fail('level ' + pi + ': ' + n + ' piles (the layout has 3 or 4)');
        if (!isInt(A)) fail('level ' + pi + ': ' + S + ' blocks do not share out evenly among ' + n);
        if (D.levelDone(c0)) fail('level ' + pi + ': already even');
        if (c0.join() === LS.join()) fail('level ' + pi + ': the same piles as example 1');
        if (c0.some(v => v < 1 || v > 9)) fail('level ' + pi + ': a pile outside 1~9 (the board holds 9)');
        const seenS = new Set([c0.join()]), stack = [c0.slice()];
        let states = 0;
        while (stack.length && states < 5000){
          const c = stack.pop(); states++;
          let legal = 0;
          for (let i = 0; i < n; i++) for (let j = 0; j < n; j++){
            if (i === j) continue;
            const why = D.levelWhy(c, i, j), ok = c[i] - c[j] >= 2;
            if ((why === null) !== ok){ fail('levelWhy(' + c.join() + ', ' + i + ', ' + j + ') = ' + why + ' — moving from ' + c[i] + ' to ' + c[j] + ' should be ' + (ok ? 'accepted' : 'refused')); continue; }
            if (why === 'up' && !(c[j] > c[i])) fail('levelWhy: "up" for ' + c[i] + ' → ' + c[j]);
            if (why === 'same' && c[i] !== c[j]) fail('levelWhy: "same" for ' + c[i] + ' → ' + c[j]);
            if (why === 'swap' && c[i] - c[j] !== 1) fail('levelWhy: "swap" for ' + c[i] + ' → ' + c[j]);
            if (why){
              const key = why + c[i] + ',' + c[j];
              if (!levelText[key]){ levelText[key] = 1;
                const a = c[i], b = c[j];
                const want = { up:[b, a], same:[a, a - 1, b + 1], swap:[a, b, a - 1, b + 1] }[why];
                if (why === 'swap' && !(a - 1 === b && b + 1 === a)) fail('level "swap": ' + a + ',' + b + ' would not just trade places');
                LANGS.forEach(L => say('gLevelBad.' + why, L, I18N[L].gLevelBad[why](NAMES[L][i], a, NAMES[L][j], b), want));
              }
              continue;
            }
            legal++;
            const nx = c.slice(); nx[i]--; nx[j]++;
            if (sq(nx) >= sq(c)) fail('level: a legal move ' + c.join() + ' → ' + nx.join() + ' does not make the piles more even');
            if (nx.some(v => v < 1 || v > 9)) fail('level: a legal move reaches ' + nx.join() + ' (outside 1~9)');
            if (!seenS.has(nx.join())){ seenS.add(nx.join()); stack.push(nx); }
          }
          if (D.levelDone(c)){ if (legal) fail('level: a move is accepted at the even state ' + c.join()); if (c[0] !== A) fail('level: even at ' + c[0] + ', not ' + A); }
          else if (!legal) fail('level ' + pi + ': stuck at ' + c.join() + ' — not even and no move is accepted');
        }
        if (!seenS.has(c0.map(() => A).join())) fail('level ' + pi + ': the even state is never reached');
        LANGS.forEach(L => {
          say('gLevelNow', L, I18N[L].gLevelNow(c0), c0.concat([S]), 1);
          say('gLevelOk', L, I18N[L].gLevelOk(NAMES[L][0], NAMES[L][1], S), [S]);
          say('gLevelDone', L, I18N[L].gLevelDone(S, n, A), [A, S, n, A], 1);
          const hi = c0.indexOf(Math.max(...c0)), lo = c0.indexOf(Math.min(...c0));
          say('gLevel2', L, I18N[L].gLevel2(NAMES[L][hi], c0[hi], NAMES[L][lo], c0[lo]), [c0[hi], c0[lo]]);
        });
      });
      ['up', 'same', 'swap'].forEach(w => { if (!Object.keys(levelText).some(k => k.indexOf(w) === 0)) fail('level: the "' + w + '" refusal is never reachable in the pool'); });
      /* 版面 */
      [3, 4].forEach(n => {
        const cw = D.LEVEL.colW[n], x0 = D.levelX0(n);
        if (x0 < 0 || x0 + n * cw > D.LEVEL.W) fail('level layout: ' + n + ' columns do not fit the board');
        if (cw < D.GPICK) fail('level layout: column ' + cw + ' narrower than a pick target — neighbouring top blocks would overlap');
        if (D.LEVEL.blkW > cw - 6) fail('level layout: a block is wider than its column');
        const cols = []; for (let i = 0; i < n; i++) cols.push({ i, cx:x0 + (i + 0.5) * cw, cy:D.LEVEL.colY + (D.LEVEL.lblY + D.LEVEL.lblH - D.LEVEL.colY) / 2, hw:cw / 2, hh:(D.LEVEL.lblY + D.LEVEL.lblH - D.LEVEL.colY) / 2 });
        if (nearestOpen) sweep('level ' + n + ' piles', cols, D.LEVEL.pad, D.LEVEL.W, D.LEVEL.H);
        if (Math.abs(D.levelCx(n, n - 1) - cols[n - 1].cx) > 1e-9) fail('level layout: levelCx() is not the column centre');
      });
      if (D.levelTop(8) - D.LEVEL.blkH / 2 + D.LEVEL.blkH / 2 - D.GPICK / 2 + D.LEVEL.blkH / 2 < D.LEVEL.colY) fail('level layout: the top block of a 9-pile sticks out of its column');
      if (D.levelTop(8) + D.LEVEL.blkH / 2 - D.GPICK / 2 < 0) fail('level layout: the pick target of a 9-pile is above the board');
      if (D.levelTop(0) + D.LEVEL.blkH / 2 + D.GPICK / 2 > D.LEVEL.lblY) fail('level layout: the pick target of a 1-pile covers the name label');
      if (D.LEVEL.lblY + D.LEVEL.lblH > D.LEVEL.H) fail('level layout: the name labels fall off the board');
      if (Math.abs(D.levelTop(1) - D.levelTop(0) + D.LEVEL.step) > 1e-9 || D.LEVEL.step <= D.LEVEL.blkH) fail('level layout: blocks are not evenly stacked with a gap');
      need('level: a drop on its own pile is silent', 'if (!col || col.i === P.data.i) return false;');
      need('level: the pile under the drop is judged', 'var col = nearestOpen(cols, pt, LEVEL.pad);');
      need('level: judge the dragged pile against the target', 'var i = P.data.i, j = col.i, why = levelWhy(c, i, j);');
      need('level: a refused move is keyed by the kind of mistake and the pair of piles', "roundMiss(d.gLevelBad[why](d.gNames[i], c[i], d.gNames[j], c[j]), why + ':' + i + '>' + j);");
      need('level: a move keeps the total', 'c[i]--; c[j]++;');
      need('level: only the top block can be picked up', 'for (var k = 0; k < (even ? v : v - 1); k++)');

      /* --- 5. 第 2 關：拼出算式 —— 每一格 × 每一張卡 --- */
      D.GAME_FORMULA.forEach((v0, pi) => {
        const n = v0.length, S = sumOf(v0), A = S / n, M = Math.max(...v0), zero = v0.indexOf(0) >= 0, mis = zero ? n - 1 : n + 1;
        const f = D.formInfo(v0);
        if (f.S !== S || f.n !== n || f.A !== A || f.M !== M || f.zero !== zero || f.miscount !== mis) fail('formula ' + pi + ': formInfo() disagrees with the test');
        if (!(n >= 3 && n <= 5) || !isInt(A)) fail('formula ' + pi + ': ' + v0.join(',') + ' — 3~5 numbers with a whole-number average');
        const cards = [S, n, A, M, mis];
        if (new Set(cards).size !== 5) fail('formula ' + pi + ': the five cards are not all different: ' + cards.join(','));
        if (cards.some(v => v > 999)) fail('formula ' + pi + ': a card has more than 3 digits');
        for (let t = 0; t < 20; t++){ const c = D.formCards(f); if (c.slice().sort((a, b) => a - b).join() !== cards.slice().sort((a, b) => a - b).join()) { fail('formula ' + pi + ': formCards() deals ' + c.join(',')); break; } }
        [S, n, A].forEach((w, slot) => { if (D.formWant(f, slot) !== w) fail('formula ' + pi + ': formWant(' + slot + ') is not ' + w); });
        LANGS.forEach(L => {
          const d = I18N[L];
          [0, 1, 2].forEach(slot => cards.forEach(v => {
            const why = D.formWhy(d, f, slot, v), right = v === [S, n, A][slot];
            if ((why === null) !== right){ fail('formWhy(' + slot + ', ' + v + ') ' + L + ' on ' + v0.join(',') + ': ' + (right ? 'refused the right card' : 'accepted a wrong card')); return; }
            if (!why) return;
            let want;
            if (slot === 0) want = v === M ? [M, n] : v === n ? [n] : [v].concat(v0);
            else if (slot === 1) want = v === mis ? (zero ? [n, 0] : [n]) : [n];
            else { want = [v, n, v * n, n, v * n]; if (v * n === S) fail('formula: "' + v + ' × ' + n + ' is not the total" but it is'); }
            say('formWhy slot ' + slot + ' card ' + v, L, why, want);
          }));
          d.gFormOk.forEach((fn, i) => say('gFormOk ' + i, L, fn([S, n, A][i]), [[S, n, A][i]]));
          say('gFormDone', L, d.gFormDone(S, n, A, zero), [S, n, A, A].concat(zero ? [0] : []), 1);
          say('gForm2[0]', L, d.gForm2[0](f), v0.concat([S]), 1);
          say('gForm2[1]', L, d.gForm2[1](f), [n].concat(zero ? [0] : []));
          say('gForm2[2]', L, d.gForm2[2](f), [S, n, n, S]);
        });
      });
      if (!D.GAME_FORMULA.some(v => v.indexOf(0) >= 0) || D.GAME_FORMULA.every(v => v.indexOf(0) >= 0)) fail('formula pool: needs sets with a 0 (it counts) and sets without');
      {
        const F = D.FORM;
        [3, 4, 5].forEach(n => { if (D.formCellX(n, 0) < 0 || D.formCellX(n, n - 1) + F.cellW > F.W) fail('formula layout: ' + n + ' data cells do not fit'); });
        if (D.formSlotX(0) < 0 || D.formSlotX(2) + F.slotW > F.W) fail('formula layout: the three boxes do not fit');
        if (F.opW < 2 * F.pad) fail('formula layout: neighbouring boxes’ zones overlap (op ' + F.opW + ' < 2 × pad ' + F.pad + ')');
        if (D.formCardCx(0) - F.card / 2 < 0 || D.formCardCx(4) + F.card / 2 > F.W || F.cardGap < 0) fail('formula layout: the five cards do not fit side by side');
        if (F.card > F.slotW || F.card > F.slotH) fail('formula layout: a card does not fit in a box');
        if (F.cardCy - F.card / 2 <= F.lblY + F.lblH + F.pad) fail('formula layout: the tray sits inside a box’s drop zone');
        if (F.cardCy + F.card / 2 > F.H || F.cellY + F.cellH > F.slotY) fail('formula layout: cards or cells overflow');
        if (F.card * K_PHONE < 44) fail('formula layout: a card is under 44px on a 375px phone');
      }
      need('formula: the box under the drop judges the dropped card', 'var v = P.data.v, why = formWhy(d, f, s.i, v);');
      need('formula: a wrong card is keyed by box and card', "roundMiss(why, s.i + ':' + v)");
      need('formula: the box zone includes its label', 'var zH = FORM.lblY + FORM.lblH - FORM.slotY;');

      /* --- 6. 第 3 關：補上最後一根 —— 每一題 × 0～20 每一個高度 --- */
      const Fl = D.FILL;
      D.GAME_FILL.forEach((it, pi) => {
        const m = it.known.length, n = m + 1, S = it.A * n, K = sumOf(it.known), miss = S - K;
        if (D.fillMiss(it) !== miss) fail('fill ' + pi + ': fillMiss() is not ' + miss);
        if (!(miss >= 1 && miss <= Fl.max) || miss === it.A) fail('fill ' + pi + ': the missing bar ' + miss + ' is outside 1~' + Fl.max + ' or equals the average line');
        if (it.known.some(v => v < 1 || v > Fl.max) || !(n === 4 || n === 5)) fail('fill ' + pi + ': known bars outside 1~' + Fl.max + ' or not 3~4 of them');
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let x = 0; x <= Fl.max; x++){
            const why = D.fillWhy(d, it, x), T = K + x, list = it.known.concat([x]);
            say('gFillNow x=' + x, L, d.gFillNow(list), list.concat([T]), 1);
            if (x === 0){ if (why !== 'zero') fail('fillWhy(0) should be only a reminder'); continue; }
            if ((why === null) !== (x === miss)){ fail('fill ' + pi + ' x=' + x + ': ' + (x === miss ? 'the right height is refused' : 'a wrong height is accepted')); continue; }
            if (!why) continue;
            const want = L === 'zh' ? list.concat([T, it.A, n, S, Math.abs(T - S)]) : list.concat([T, Math.abs(T - S), it.A, n, S]);
            say('fillWhy x=' + x, L, why, want, 2);
            if ((x > miss) !== /太高|too tall/.test(why) || (x < miss) !== /太矮|too short/.test(why)) fail('fillWhy x=' + x + ' ' + L + ': says too tall/short the wrong way round: ' + why);
          }
          say('gFillDone', L, d.gFillDone(it.known.concat([miss]), S, it.A, n), it.known.concat([miss, S, it.A, n]), 1);
          say('gFill2', L, d.gFill2(it.A, n, S, m, K), [it.A, n, S, m, K], 1);
        });
      });
      LANGS.forEach(L => { if (!/\b0\b/.test(I18N[L].gFillZero) || /沒有動|has not moved|still at the start/.test(I18N[L].gFillZero)) fail('gFillZero ' + L + ': must say the bar is still 0 (true whenever it is 0), not that it never moved'); });
      for (let v = 0; v <= Fl.max; v++){
        [0, 0.49, -0.49].forEach(f => { const g = D.fillVal(D.fillY(v + f)); if (g !== v) fail('fillVal(): the height of ' + v + (f ? (f > 0 ? '+' : '') + f : '') + ' reads ' + g); });
        if (v < Fl.max && D.fillVal(D.fillY(v + 0.51)) !== v + 1) fail('fillVal(): just above half a step from ' + v + ' does not read ' + (v + 1));
      }
      if (D.fillVal(D.fillY(Fl.max) - 60) !== Fl.max || D.fillVal(Fl.base + 60) !== 0) fail('fillVal(): does not clamp to 0~' + Fl.max);
      if (D.fillY(Fl.max) - Fl.valH - 2 < 0 || D.fillY(Fl.max) - D.GPICK / 2 < 0 || D.fillY(Fl.max) - 12 < 0) fail('fill layout: the top of the scale (label, handle, tick) is above the board');
      if (Fl.base + D.GPICK / 2 > Fl.nameY) fail('fill layout: the handle at 0 covers the name labels');
      if (Fl.nameY + Fl.nameH > Fl.H || Fl.tagX + Fl.tagW > Fl.W || Fl.plotR > Fl.tagX) fail('fill layout: names, plot or tag overflow');
      [4, 5].forEach(n => {
        const cw = D.fillColW(n);
        if (cw < D.GPICK / 2 + Fl.valW / 2) fail('fill layout (' + n + ' bars): the handle would cover the neighbouring value label');
        if (cw < Fl.barW || Fl.valW > cw) fail('fill layout (' + n + ' bars): bars or labels wider than a column');
        if (D.fillCx(n, n - 1) + D.GPICK / 2 > Fl.tagX) fail('fill layout (' + n + ' bars): the handle runs into the average tag');
      });
      D.GAME_FILL.forEach(it => { const y = D.fillY(it.A); if (y - Fl.tagH / 2 < 0 || y + Fl.tagH / 2 > Fl.base + 3) fail('fill layout: the average tag for ' + it.A + ' is off the plot'); });
      need('fill: Done judges x', 'var why = fillWhy(d, it, x);');
      need('fill: 0 is only a reminder', "if (why === 'zero'){ roundNote(d.gFillZero); return; }");
      need('fill: a wrong height is keyed by the height', "roundMiss(why, 'x' + x)");
      need('fill: the handle snaps to whole numbers while dragging', 'snapY:function(y){ return fillY(fillVal(y)); }');
      need('fill: tapping the column sets the tapped height', 'setX(fillVal(pt.y));');
      need('fill: the tap zone is the last column', 'if (Math.abs(pt.x - lx) > cw / 2 || pt.y < fillY(FILL.max) - FILL.pad || pt.y > FILL.base + FILL.pad) return;');

      /* --- 7. 第 4 關：比平均 —— 每一組 × 每一列 --- */
      const SHORTCUT = {}, RANKS = { count:[], total:[] };
      D.GAME_SORT.forEach((sets, pi) => {
        const av = sets.map(s => sumOf(s) / s.length), tot = sets.map(sumOf), cnt = sets.map(s => s.length);
        if (sets.length !== 3 || av.some(a => !isInt(a)) || new Set(av).size !== 3) fail('sort ' + pi + ': needs three sets with different whole-number averages (' + av.join(',') + ')');
        /* 個數、總和都不能平手（平手就說不出「數字最多的那一組」「總和最大的那一組」是誰） */
        if (new Set(cnt).size !== 3 || new Set(tot).size !== 3) fail('sort ' + pi + ': two sets have the same count or the same total');
        const ord = key => [0, 1, 2].sort((a, b) => key[a] - key[b]).join(), byAvg = ord(av);
        [['count', cnt], ['total', tot]].forEach(([nm, key]) => { if (ord(key) === byAvg || ord(key.map(x => -x)) === byAvg) (SHORTCUT[nm] = SHORTCUT[nm] || []).push(pi); });
        RANKS.count.push(av.filter(a => a < av[cnt.indexOf(Math.max(...cnt))]).length);
        RANKS.total.push(av.filter(a => a < av[tot.indexOf(Math.max(...tot))]).length);
        if (D.sortLongestLowest(sets) !== (RANKS.count[RANKS.count.length - 1] === 0)) fail('sort ' + pi + ': sortLongestLowest() disagrees with the test');
        if (sets.some(s => s.length < 2 || s.length > 5 || s.some(v => v < 1 || v > 99))) fail('sort ' + pi + ': a set is not 2~5 numbers of 1~99');
        sets.forEach((s, i) => { if (D.sortAvg(s) !== av[i] || D.sortRank(sets, s) !== av.filter(a => a < av[i]).length) fail('sort ' + pi + ': sortAvg()/sortRank() disagree for ' + s.join(',')); });
        for (let t = 0; t < 3000; t++){ const tr = D.sortTray(sets); if (tr.length !== 3 || new Set(tr).size !== 3 || tr.some(s => sets.indexOf(s) < 0)) { fail('sortTray(): not the three sets'); break; } if (tr.every((s, i) => i === 0 || D.sortAvg(tr[i - 1]) <= D.sortAvg(s))) { fail('sort ' + pi + ': the tray starts in the answer order'); break; } }
        LANGS.forEach(L => {
          const d = I18N[L];
          sets.forEach((s, i) => {
            const r = av.filter(a => a < av[i]).length;
            [0, 1, 2].forEach(row => {
              const why = D.sortWhy(d, sets, s, row);
              if ((why === null) !== (row === r)){ fail('sortWhy ' + L + ': ' + s.join(',') + ' into row ' + row + ' ' + (row === r ? 'refused' : 'accepted')); return; }
              if (!why) return;
              say('sortWhy', L, why, s.concat([sumOf(s), s.length, av[i], r]), 1);
              if (why.indexOf(d.gSortRows[r]) < 0) fail('sortWhy ' + L + ': does not name the right row "' + d.gSortRows[r] + '": ' + why);
            });
            say('gSortOk', L, d.gSortOk(s, sumOf(s), s.length, av[i]), s.concat([sumOf(s), s.length, av[i]]), 1);
            say('gSort2', L, d.gSort2(s, sumOf(s), s.length, av[i]), s.concat([sumOf(s), s.length, av[i]]), 1);
            /* 卡片寬度：數字 0.6em、中文頓號 1em、英文逗號＋空格 0.6em（16px、粗體再放寬 10%） */
            const txt = d.gSet(s), w = 16 * 1.1 * (txt.replace(/[^\d]/g, '').length * 0.6 + (txt.match(/、/g) || []).length + (txt.match(/, /g) || []).length * 0.6);
            if (w > D.SORT.cardW - 6 - 8) fail('sort layout: "' + txt + '" (~' + w.toFixed(0) + 'px) does not fit a ' + D.SORT.cardW + 'px card');
          });
          const ll = av[cnt.indexOf(Math.max(...cnt))] === Math.min(...av), done = d.gSortDone(av.slice().sort((a, b) => a - b), ll);
          say('gSortDone', L, done, av.slice().sort((a, b) => a - b), 1);
          if (ll !== (L === 'zh' ? /數字比較多，平均不一定比較大/ : /more numbers does not mean a bigger average/).test(done)) fail('gSortDone ' + L + ': says "more numbers does not mean a bigger average" exactly when the most-numbers set is lowest — not here: ' + done);
        });
      });
      /* 整個題庫「沒有捷徑」（Tony 2026-10-11）：(a) 數字最多的那一組、(b) 總和最大的那一組，都要分別當過平均最低、中間、最高；
         (c) 只照個數排、只照總和排（正著或倒著），每一種最多排對 1 題（3 張卡亂猜是 1/6）；(d) 至少一題數字最多的那一組平均最低。 */
      ['count', 'total'].forEach(nm => { [0, 1, 2].forEach(r => { if (RANKS[nm].indexOf(r) < 0) fail('sort pool: the biggest-' + nm + ' set is never ' + ['lowest', 'middle', 'highest'][r] + ' (' + RANKS[nm].join(',') + ') — ' + nm + ' predicts the order across boards'); }); });
      ['count', 'total'].forEach(nm => { if ((SHORTCUT[nm] || []).length > 1) fail('sort pool: ordering by ' + nm + ' alone solves ' + SHORTCUT[nm].length + ' entries (' + SHORTCUT[nm].join(',') + ') — at most 1'); });
      if (RANKS.count.indexOf(0) < 0) fail('sort pool: no entry where the most-numbers set has the lowest average — the lesson’s point never shows');
      {
        const So = D.SORT;
        if (So.rowY[2] + So.rowH > So.trayY[0] - So.cardH / 2 - So.pad) fail('sort layout: the tray sits inside a row’s drop zone');
        if (So.trayY.some((y, i) => i && y - So.trayY[i - 1] < So.cardH) || So.trayY[2] + So.cardH / 2 > So.H) fail('sort layout: tray cards overlap or fall off the board');
        if (So.cardW > So.slotW || So.cardH > So.rowH || So.lblX + So.lblW > So.slotX || So.slotX + So.slotW > So.W) fail('sort layout: cards, labels or rows do not fit');
        if (So.cardH * K_PHONE < 44) fail('sort layout: a card is under 44px tall on a 375px phone');
        const rows = So.rowY.map((y, i) => ({ i, cx:(So.lblX + So.slotX + So.slotW) / 2, cy:y + So.rowH / 2, hw:(So.slotX + So.slotW - So.lblX) / 2, hh:So.rowH / 2 }));
        if (nearestOpen){
          const ov = sweep('sort rows', rows, So.pad, So.W, So.H);
          if (!ov) fail('sort layout: neighbouring rows’ widened zones never overlap — the nearest-row rule is untested');
          const filled = rows.map(r => Object.assign({}, r, { done:r.i === 1 }));
          [So.rowY[1] + So.rowH / 2, So.rowY[1] - 2, So.rowY[1] + So.rowH + 2].forEach(y => {   /* 正中間、上下兩條縫裡比較靠近它的地方 */
            if (nearestOpen(filled, { x:150, y }, So.pad) !== null) fail('nearestOpen(): a drop on a filled row (y ' + y + ') goes to a neighbouring row instead of bouncing');
          });
        }
      }
      need('sort: the row under the drop judges the dropped set', 'var set = P.data.set, why = sortWhy(d, sets, set, r.i);');
      need('sort: a wrong row is keyed by set and row', "roundMiss(why, sets.indexOf(set) + '@' + r.i)");
      need('sort: the tray is dealt by sortTray()', 'var cards = sortTray(sets).map(');
      need('sort: the row zone includes its rank label', 'cx:(SORT.lblX + SORT.slotX + SORT.slotW) / 2, cy:y + SORT.rowH / 2, hw:(SORT.slotX + SORT.slotW - SORT.lblX) / 2');

      /* --- 8. 第 5 關：拿掉拉偏的數 —— 每一題 × 每一根 --- */
      D.GAME_REMOVE.forEach((it, pi) => {
        const v = it.nums, n = v.length, S = sumOf(v), avg = S / n, x = v[it.out], T = (S - x) / (n - 1);
        const r = D.remInfo(it);
        if (r.S !== S || r.avg !== avg || r.T !== T) fail('remove ' + pi + ': remInfo() disagrees with the test');
        if (!isInt(avg) || !isInt(T) || new Set(v).size !== n) fail('remove ' + pi + ': the average ' + avg + ' / goal ' + T + ' is not whole, or the numbers repeat');
        if (v.indexOf(T) >= 0 || v.indexOf(avg) >= 0) fail('remove ' + pi + ': the goal or the current average is one of the numbers');
        if (v.some(y => (S - y) % (n - 1) !== 0)) fail('remove ' + pi + ': removing some number leaves a non-whole average');
        if (v.filter(y => (S - y) / (n - 1) === T).length !== 1) fail('remove ' + pi + ': more than one number reaches the goal');
        const far = v.map(y => Math.abs(y - avg)), fi = far.indexOf(Math.max(...far));
        if (fi !== it.out || far.filter(f => f === far[fi]).length > 1) fail('remove ' + pi + ': ' + x + ' is not the one number farthest from the average');
        if (!(n === 4 || n === 5)) fail('remove ' + pi + ': 4 or 5 bars');
        LANGS.forEach(L => {
          const d = I18N[L];
          v.forEach((y, i) => {
            const why = D.remWhy(d, r, i);
            if ((why === null) !== (i === it.out)){ fail('remWhy ' + L + ': removing ' + y + ' ' + (i === it.out ? 'refused' : 'accepted')); return; }
            if (!why) return;
            const rest = v.filter((_, j) => j !== i), R = sumOf(rest), ra = R / (n - 1);
            say('remWhy', L, why, [y].concat(rest, [R, R, n - 1, ra, T]), 2);
            const up = ra > avg, away = (ra - avg) * (T - avg) < 0;
            if (up !== (L === 'zh' ? /變高/.test(why) : /went up/.test(why))) fail('remWhy ' + L + ': says the average went ' + (up ? 'down' : 'up') + ' but it went ' + (up ? 'up' : 'down') + ': ' + why);
            if (away !== (L === 'zh' ? /反而/.test(why) : /further/.test(why))) fail('remWhy ' + L + ': "further from the goal" is ' + (away ? 'missing' : 'false') + ': ' + why);
          });
          const rest = v.filter((_, j) => j !== it.out);
          const done = d.gRemDone(x, rest, sumOf(rest), n - 1, T, avg);
          say('gRemDone', L, done, [x].concat(rest, [sumOf(rest), sumOf(rest), n - 1, T, x, T, avg]), 2);
          if ((avg > T) !== (L === 'zh' ? /拉高/.test(done) : /pulled the average up/.test(done))) fail('gRemDone ' + L + ': the direction is wrong: ' + done);
          say('gRemNow', L, d.gRemNow(S, n, avg, T), [S, n, avg, T], 1);
          say('gRem2', L, d.gRem2(T, n - 1), [T, n - 1, T * (n - 1), n - 1, T * (n - 1)], 1);
        });
        const Rm = D.REM, ytop = D.remY(r, Math.max(...v));
        if (Math.abs(ytop - Rm.top) > 1e-9 || ytop - Rm.valH - 2 < 0) fail('remove layout ' + pi + ': the tallest bar or its label is off the board');
        [avg, T].forEach(a => { const y = D.remY(r, a); if (y - Rm.tagH / 2 < 0 || y + Rm.tagH / 2 > Rm.nameY) fail('remove layout ' + pi + ': the tag for ' + a + ' is off the plot'); });
        if (v.some(y => Math.abs((Rm.base - D.remY(r, y)) / (Rm.base - Rm.top) - y / Math.max(...v)) > 1e-9)) fail('remove layout ' + pi + ': a bar is not in proportion to its number');
      });
      if (!D.GAME_REMOVE.some(it => it.nums[it.out] < sumOf(it.nums) / it.nums.length)) fail('remove pool: no set where one very small number pulls the average down');
      /* 要拿掉的那一根的位置：remDeal() 每一局洗牌，每一個位置都要差不多一樣常出現（只會點某個位置的人，答對機率 ≈ 1/個數） */
      D.GAME_REMOVE.forEach((it, pi) => {
        const n = it.nums.length, cnt = new Array(n).fill(0), N = 4000;
        for (let t = 0; t < N; t++){
          const dl = D.remDeal(it);
          if (dl.nums.slice().sort((a, b) => a - b).join() !== it.nums.slice().sort((a, b) => a - b).join() || dl.nums[dl.out] !== it.nums[it.out]) { fail('remDeal(): the dealt board is not the same numbers with the same target'); return; }
          cnt[dl.out]++;
        }
        if (cnt.some(c => c < N / n * 0.7 || c > N / n * 1.3)) fail('remove ' + pi + ': the target bar’s position is not spread evenly (' + cnt.join(',') + ' over ' + N + ' boards) — a position-only player beats chance');
      });
      need('remove: the bars are dealt in a shuffled order', 'var r = remInfo(remDeal(poolPick(GAME_REMOVE)))');
      [4, 5].forEach(n => { if (D.remColW(n) * K_PHONE < 44 || D.REM.barW > D.remColW(n) - 6) fail('remove layout: ' + n + ' columns are under 44px on a 375px phone or narrower than a bar'); });
      if (D.REM.tagX + D.REM.tagW > D.REM.W || D.REM.plotR > D.REM.tagX || D.REM.nameY + D.REM.nameH > D.REM.H) fail('remove layout: tag, plot or names overflow');
      /* 沒有視覺洩題：可以選的卡片一律同一個樣式，class 不可以跟著答案變（g5-polygon 的教訓） */
      need('formula: every card has the same neutral style', "cls:'gcard gnumcard', data:{ v:v }");
      need('sort: every card has the same neutral style', "cls:'gcard gsetcard', data:{ set:set }");
      if ((live.match(/addPiece\(B, \{[^\n]*cls:[^\n]*\?/g) || []).length) fail('source: a piece’s class depends on a condition — choosable pieces must look the same (no visual give-away)');
      /* ……也不可以事後再替某一張卡改 class／樣式（codex 第五輪） */
      [['formula', '    formula: function(d){', '    fill: function(d){'], ['sort', '    sort: function(d){', '    remove: function(d){']].forEach(([nm, a, b]) => {
        const i = live.indexOf(a), j = live.indexOf(b, i);
        if (i < 0 || j < 0) fail('source: cannot find RENDER.' + nm);
        else if (/\.el\.(classList|style|setAttribute)|\.el\.className/.test(live.slice(i, j))) fail('source: RENDER.' + nm + ' restyles a card after creating it — choosable pieces must look the same (no visual give-away)');
      });
      need('level: a redraw clears the tap selection', 'function draw(){\n        B.selected = null;');
      need('remove: the tapped column is judged', 'var why = remWhy(d, r, col.i);');
      need('remove: a wrong bar is keyed by the bar', "roundMiss(why, 'r' + col.i)");
      need('remove: each column owns its own width (no overlap, no gap)', 'return pt.x >= c.x0 && pt.x < c.x1;');
    }
  }
};
