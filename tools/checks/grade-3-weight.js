/* grade-3/math/weight 的檢查設定（秤秤看有多重：重量不是大小、公克與公斤、1 公斤 ＝ 1000 公克與化聚、讀秤面）。
   2026-10-01 新增 —— 和小遊戲「過磅囉」改成五關五種玩法（§六之五）同一次寫成；在那之前這一課沒有設定檔，
   simgen／verify_lesson_data／breaktest 對這一課一直是「找不到設定」。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數，自己格式化「幾公斤幾公克」與商餘）。
   跑起來抓到的舊缺陷見各條註解（估重量的誘答只差 500 公克、書包 4 公斤和速查卡的 3 公斤不一致、把題幹的數字抄回來、
   「3 公斤 0 公克」、乘法的第三個誘答永遠和第二個一樣、英文選項「2  kg 300  g」的雙空白、秤面數字不是公克）。
   ⚠️ simgen 共用的「誘答抄題幹」只比對**純數字**選項；這一課的選項都帶單位（「50 公克」），那條檢查一次都不會響。
   所以 renderCheck 另外比對「選項的字樣原封不動出現在題幹裡」（數字＋單位一起比）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式由 lib/arith.js 逐條重算，單位真的換算（公斤 × 1000），
     「幾公斤幾公克」先合成公克、「商 q 餘 r」先改寫成「被除數 ＝ 除數 × 商 ＋ 餘數」再驗（餘數也要比除數小）。驗過的條數與指紋都釘住。
   - 範例：比重量的三組、單位的六樣、秤面（數字是 i × 一小格、指針讀出來是 23 格）。
   - 小遊戲：題庫與版面常數在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲的規則把每一題玩一遍（天平把所有放法走完），證明解得完、解完一定是對的；
     頁面的純函式（weighRanked／weighInversion／unitCardXY／balKgXY／bal100XY／writeDigits／dialXY／dialRawAt／dialFaceSVG）
     一律拿整個題庫或整個範圍去呼叫，再和自己的算法比；nearestOpen()、roundMiss()、dealOut()→shuffle() 從原始碼切出來實際執行；
     只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字（每一題、每一種放錯）。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-weight 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const crypto = require('crypto');
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');
const { canvasProblems } = require('./lib/canvas.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function qr(q, r, lang){ return lang === 'zh' ? '商 ' + q + '、餘 ' + r : q + ' r ' + r; }
/* 自己的「幾公斤幾公克」（不呼叫 review.html 的 fmtKgG） */
function kgg(total, lang){
  const kg = Math.floor(total / 1000), g = total % 1000, U = lang === 'zh' ? ['公斤', '公克'] : ['kg', 'g'];
  if (kg === 0) return g + ' ' + U[1];
  if (g === 0) return kg + ' ' + U[0];
  return kg + ' ' + U[0] + ' ' + g + ' ' + U[1];
}
/* 選項 → 公克（「3 公斤 50 公克」「3050 公克」「2 kg」…）；讀不懂回 null */
function grams(s){
  const t = String(s).trim(), m = t.match(/^(?:(\d+) (?:公斤|kg))?(?: ?(\d+) (?:公克|g))?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  return (m[1] ? +m[1] * 1000 : 0) + (m[2] ? +m[2] : 0);
}

/* ---------- 算式驗算：lib/arith.js ＋ 這一課的兩個正規化 ----------
   ① 「3 公斤 50 公克」是一個量：先合成「3050 公克」，不然換算完會變成兩個並排的數。
   ② 「4600 ÷ 1000 ＝ 商 4 餘 600」改寫成「4600 ＝ 1000 × 4 ＋ 600」，餘數 ≥ 除數另外報錯。
   CONV：單位真的換算（1 公斤 ＝ 1000 公克 → 1000 ＝ 1000）。
   BARE：單位當量詞拿掉 —— 只給「3 公斤 × 1000 ＝ 3000 公克」那種「公斤數 × 1000」的句子用（換算的階梯）。 */
function makeWeightArith(bare){
  const A = bare ? makeArith({ units:['公斤', '公克'], unitsEn:['kg', 'g'] })
                 : makeArith({ conversions:{ '公斤':1000, '公克':1, 'kg':1000, 'g':1 } });
  const f = function(text){
    const extra = [];
    let t = String(text).replace(/<[^>]+>/g, '');
    if (!bare){
      t = t.replace(/(\d+) ?公斤 ?(\d+) ?公克/g, (m, a, b) => (+a * 1000 + +b) + ' 公克')
           .replace(/(\d+) ?kg (\d+) ?g\b/g, (m, a, b) => (+a * 1000 + +b) + ' g');
    }
    /* 題目式「3 公斤 ＝ 多少公克？」「= how many grams?」：未知數是一個詞，換成 ？ 交給 arith 算成題目 */
    t = t.replace(/([＝=]) ?(?:多少|幾)[^，。？?]{0,8}[？?]/g, '$1 ？').replace(/([＝=]) ?how many [a-z]+(?: and [a-z]+)?\?/gi, '$1 ?');
    t = t.replace(/(\d+) ?(?:公克|g)? ?÷ ?(\d+) ?[＝=] ?(?:商 ?)?(\d+)(?: ?、? ?餘 ?| r )(\d+)/g, (m, a, b, q, r) => {
      if (+r >= +b) extra.push('"' + m + '": the remainder ' + r + ' is not smaller than ' + b);
      return a + ' ＝ ' + b + ' × ' + q + ' ＋ ' + r;
    });
    const r = A(t);
    return { problems:r.problems.concat(extra), verified:r.verified, questions:r.questions, list:r.verifiedList };
  };
  f.fingerprint = A.fingerprint;
  return f;
}
const CONV = makeWeightArith(false), BARE = makeWeightArith(true);
/* PROBES：該過的要過、該抓的要抓（不然一個壞掉的正規化會讓每一條都「靜靜讀不到」） */
const PROBES = [
  ['1 公斤 ＝ 1000 公克', true, 1], ['1 公斤 ＝ 100 公克', false], ['2 公斤 300 公克 ＝ 2300 公克', true, 1], ['2 公斤 300 公克 ＝ 2030 公克', false],
  ['3 公斤 50 公克 ＝ 3000 ＋ 50 ＝ 3050 公克', true, 1], ['3 公斤 50 公克 ＝ 3000 ＋ 50 ＝ 350 公克', false],
  ['4600 ÷ 1000 ＝ 商 4 餘 600', true, 1], ['4600 ÷ 1000 ＝ 商 4 餘 60', false], ['4600 ÷ 1000 ＝ 商 3 餘 1600', false],
  ['4600 g ÷ 1000 = 4 r 600', true, 1], ['2 kg 300 g = 2300 g', true, 1], ['2 kg 300 g = 230 g', false],
  ['右邊：1 公斤 × 2 ＋ 100 公克 × 3 ＝ 2300 公克', true, 1], ['右邊：1 公斤 × 2 ＋ 100 公克 × 3 ＝ 2030 公克', false],
  ['4 × 100 ＋ 3 × 20 ＝ 23 × 20', true, 1], ['5000 − 3200 ＝ 1800', true, 1], ['5000 − 3200 ＝ 2800', false]
];

/* review.html：估重量的東西真的有多重（和速查卡 reference.html 的對照表、上課頁的範例一致） */
const TRUE_G = { '📎':1, '🍬':3, '🔑':50, '🍎':150, '🧂':1000, '🍉':3000, '🎒':3000, '🧒':35000 };
/* review.html 的原始碼（simgen 的 argv[2]，breaktest 給的是改壞的暫存副本）：「兩種情況都抽得到」要從程式本身證明，
   不是靠 400 批碰運氣（LESSONS 2026-09-18：抽樣證明不了可達性）。讀不到就 fail closed。 */
let PINS = null;
function sourcePins(){
  if (PINS !== null) return PINS;
  const f = process.argv[2];
  let s = null;
  try { if (f && /review\.html$/.test(f)) s = require('fs').readFileSync(f, 'utf8'); } catch (e){ s = null; }
  if (s === null) return (PINS = 'cannot read review.html to pin the sampling lines — unchecked, not passing');
  const out = [];
  if (!/var gRem = rand\(2\) \? 1 \+ rand\(99\) : 100 \+ rand\(900\);/.test(s)) out.push('compoundToGrams: the grams are not drawn from both 1~99 and 100~999 — one case is never practised');
  if (!/function rand\(n\)\{ return Math\.floor\(Math\.random\(\) \* n\); \}/.test(s)) out.push('rand() is not Math.floor(Math.random() * n) — the pinned sampling lines prove nothing about which branches are drawn');
  if (!/var curRem = 1 \+ rand\(998\);/.test(s)) out.push('remainingCapacity: the basket\'s grams can be 0 ("3 公斤 0 公克" — 0 g in the stem) or the range changed');
  return (PINS = out.join('; '));
}
const NAMES = { zh:[['小明','小華'],['小美','小傑'],['阿光','小英']], en:[['Ming','Hua'],['Mia','Jay'],['Kai','Ying']] };
const UNIT = { zh:{ g:'公克', kg:'公斤' }, en:{ g:'g', kg:'kg' } };

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:'  function dealOut(items, mk){ shuffle(items).forEach(', replace:'  function dealOut(items, mk){ items.forEach(' },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['weigh', 'unit', 'balance', 'write', 'dial'];", replace:"var GAME_ORDER = ['weigh', 'unit', 'write', 'balance', 'dial'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;\n  }\n\n  /* 計分", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  /* 計分" },

    /* 第 1 關：秤一秤、排順序 */
    { file:'index', expect:'size order is the weight order', find:"['melon', 'sponge', 'keys'] ];", replace:"['melon', 'book', 'keys'] ];" },
    { file:'index', expect:'two things weigh the same', find:"['teddy', 'stone', 'egg'], ['balloon', 'sponge', 'iron']", replace:"['keys', 'stone', 'egg'], ['balloon', 'sponge', 'iron']" },
    { file:'index', expect:'the biggest is the heaviest in no set', find:"melon:{ icon:'🍉', size:3, g:3000 }", replace:"melon:{ icon:'🍉', size:3, g:10 }" },
    { file:'index', expect:'weighRanked(', find:"return set.slice().sort(function(a, b){ return WEIGH_ITEMS[a].g - WEIGH_ITEMS[b].g; }); }", replace:"return set.slice().sort(function(a, b){ return WEIGH_ITEMS[a].size - WEIGH_ITEMS[b].size; }); }" },
    { file:'index', expect:'weighInversion(', find:'      if (dz > gap){ gap = dz; best = [r[i], r[j]]; }', replace:'      if (dz < gap || !best){ gap = dz; best = [r[i], r[j]]; }' },
    { file:'index', expect:'drawn is', find:'WEIGH_BOX = [0, 60, 68, 76]', replace:'WEIGH_BOX = [0, 40, 68, 76]' },
    { file:'index', expect:'does not fit in a box of', find:'WEIGH_BOX = [0, 60, 68, 76]', replace:'WEIGH_BOX = [0, 48, 68, 76]' },
    { file:'index', expect:'the scale (with its drop pad) reaches', find:'WEIGH_SCALE = { cx:150, y:10, w:136, h:150, top:62 }', replace:'WEIGH_SCALE = { cx:150, y:10, w:136, h:156, top:62 }' },
    { file:'index', expect:'things 70 apart', find:'var WEIGH_OBJ = { y:206, step:96 }', replace:'var WEIGH_OBJ = { y:206, step:70 }' },
    { file:'index', expect:'reaches its display', find:'WEIGH_SCALE = { cx:150, y:10, w:136, h:150, top:62 }', replace:'WEIGH_SCALE = { cx:150, y:10, w:136, h:150, top:92 }' },
    { file:'index', expect:'sorting before weighing', find:"        if (weighed < 3){ gMsg.textContent = d.gWeighFirst(3 - weighed); return false; }   /* 只提醒，不算錯 */\n", replace:'' },
    { file:'index', expect:'is a mistake', find:"        if (weighed < 3){ gMsg.textContent = d.gWeighFirst(3 - weighed); return false; }", replace:"        if (weighed < 3){ roundMiss(d.gWeighFirst(3 - weighed)); return false; }" },
    { file:'index', expect:'a wrong rank is accepted', find:'        if (P.data.rank !== s.k){\n', replace:'        if (P.data.rank === -1){\n' },
    { file:'index', expect:'gWeighWrong zh', find:"' 公克' + (xg < yg ? '輕 —— 這一格要放更重的。' : '重 —— 這一格要放更輕的。')", replace:"' 公克' + (xg > yg ? '輕 —— 這一格要放更重的。' : '重 —— 這一格要放更輕的。')" },
    { file:'index', expect:'note is missing', find:"(big > 0 && xg < yg ? x + '看起來比較大，其實比較輕。' : '')", replace:"('')" },
    { file:'index', expect:'gWeighDone en', find:"return g[0] + ' g < ' + g[1] + ' g < ' + g[2] + ' g: the '", replace:"return g[0] + ' g < ' + g[2] + ' g < ' + g[1] + ' g: the '" },
    { file:'index', expect:'the empty scale', find:"var disp = addSub(sz, 'gdisp', d.gWt(0));", replace:"var disp = addSub(sz, 'gdisp', d.gWt(1));" },

    /* 第 2 關：補上單位 */
    { file:'index', expect:'is not lighter than 1 kg', find:"{ id:'apple', icon:'🍎', v:150 } ];", replace:"{ id:'apple', icon:'🍎', v:1500 } ];" },
    { file:'index', expect:'is not heavier than 1 kg', find:"{ id:'bag', icon:'🎒', v:3 },", replace:"{ id:'bag', icon:'🎒', v:1 }," },
    { file:'index', expect:'the paperclip benchmark', find:"{ id:'clip', icon:'📎', v:1 },", replace:"{ id:'clip', icon:'📎', v:2 }," },
    { file:'index', expect:'GAME_UNIT_KG', find:"{ id:'bike', icon:'🚲', v:12 }, { id:'kid', icon:'🧒', v:25 } ];", replace:"{ id:'bike', icon:'🚲', v:12 } ];\n  GAME_UNIT_KG.length = 1;" },
    { file:'index', expect:'cards 0 and 1 overlap', find:'UNIT_CARD = { w:138, h:96, x:[77, 223],', replace:'UNIT_CARD = { w:138, h:96, x:[77, 200],' },
    { file:'index', expect:'the blank sticks out of card', find:'UNIT_BLANK = { dx:32, dy:22, w:66, h:40 }', replace:'UNIT_BLANK = { dx:42, dy:22, w:66, h:40 }' },
    { file:'index', expect:'the number runs into the blank', find:'UNIT_NUM = { dx:-66, w:58 }', replace:'UNIT_NUM = { dx:-60, w:58 }' },
    { file:'index', expect:'the unit tiles reach the cards', find:'var UNIT_TILE = { y:262,', replace:'var UNIT_TILE = { y:230,' },
    { file:'index', expect:'a wrong unit is accepted', find:"        if (P.data.u !== s.pk.u){ roundMiss(", replace:"        if (P.data.u === 'x'){ roundMiss(" },
    { file:'index', expect:'gUnitHeavy zh', find:"'，' + v + ' 公斤 ＝ ' + (v * 1000) + ' 公克' : '')", replace:"'，' + v + ' 公斤 ＝ ' + (v * 100) + ' 公克' : '')" },
    { file:'index', expect:'gUnitLight en', find:"' g? That is only as heavy as ' + v + ' paperclip'", replace:"' g? That is only as heavy as ' + (v * 10) + ' paperclip'" },
    { file:'index', expect:'two grams and two kilograms', find:"      var picks = shuffle(GAME_UNIT_G).slice(0, 2)", replace:"      var picks = shuffle(GAME_UNIT_G).slice(0, 3)" },

    /* 第 3 關：配砝碼 */
    { file:'index', expect:'the hundreds digit is 0', find:'var GAME_BAL = [ 2300,', replace:'var GAME_BAL = [ 2000,' },
    { file:'index', expect:'does not fit 4 of', find:'1800, 4200, 2700 ];', replace:'1800, 5200, 2700 ];' },
    { file:'index', expect:'no entry needs only one 1 kg', find:'var GAME_BAL = [ 2300, 1500, 3400, 1800,', replace:'var GAME_BAL = [ 2300, 2500, 3400, 2800,' },
    { file:'index', expect:'is not whole hundreds', find:'3400, 1800,', replace:'3450, 1800,' },
    { file:'index', expect:'balKgXY(', find:'function balKgXY(i){ return { x:BAL.panW / 2 + (i - 1.5) * BAL_KG.step,', replace:'function balKgXY(i){ return { x:BAL.panW / 2 + (i - 1) * BAL_KG.step,' },
    { file:'index', expect:'100 g weights', find:'BAL_100 = { w:20, h:20, step:24, y:42, rowStep:22, perRow:5 }', replace:'BAL_100 = { w:20, h:20, step:24, y:42, rowStep:18, perRow:5 }' },
    { file:'index', expect:'sticks out of the pan', find:'BAL_100 = { w:20, h:20, step:24, y:42,', replace:'BAL_100 = { w:20, h:20, step:24, y:52,' },
    { file:'index', expect:'the weights reach the pans', find:'var BAL_SRC = { y:262,', replace:'var BAL_SRC = { y:236,' },
    { file:'index', expect:'the pans touch the post', find:'panX:[72, 228]', replace:'panX:[88, 228]' },
    { file:'index', expect:'too many 1 kg weights are accepted', find:"          if (x >= a){ roundMiss(d.gBalKgOver(T, x * 1000 + y * 100)); return false; }", replace:"          if (x > a){ roundMiss(d.gBalKgOver(T, x * 1000 + y * 100)); return false; }" },
    { file:'index', expect:'more 100 g weights than the hundreds digit', find:"          if (y >= b){ roundMiss(d.gBalHundMore(T, a, b)); return false; }", replace:"          if (y >= 9){ roundMiss(d.gBalHundMore(T, a, b)); return false; }" },
    { file:'index', expect:'the balance tips the wrong way', find:"var s = x * 1000 + y * 100, t = s < T ? 1 : (s > T ? -1 : 0);", replace:"var s = x * 1000 + y * 100, t = s < T ? -1 : (s > T ? 1 : 0);" },
    { file:'index', expect:'gBalKgOver zh', find:"' 公克，再放一個 1 公斤就是 ' + (S + 1000) + ' 公克，比 '", replace:"' 公克，再放一個 1 公斤就是 ' + (S + 100) + ' 公克，比 '" },
    { file:'index', expect:'gBalHundMore en', find:"' g: ' + b + ' × 100 g ' + (b === 1 ? 'is' : 'are') + ' enough; the other ' + (a * 1000)", replace:"' g: ' + b + ' × 100 g ' + (b === 1 ? 'is' : 'are') + ' enough; the other ' + (a * 100)" },
    { file:'index', expect:'gBalNow zh', find:"' ＝ ' + (x * 1000 + y * 100) + ' 公克'; },", replace:"' ＝ ' + (x * 100 + y * 100) + ' 公克'; }," },

    /* 第 4 關：寫成公克 */
    { file:'index', expect:'no entry has fewer than 100 g', find:'GAME_WRITE = [ { kg:3, g:50 }, { kg:2, g:5 },', replace:'GAME_WRITE = [ { kg:3, g:150 }, { kg:2, g:105 },' },
    { file:'index', expect:'a 0 in the tens', find:'{ kg:4, g:205 }, { kg:1, g:80 }, { kg:5, g:300 }', replace:'{ kg:4, g:215 }, { kg:1, g:80 }, { kg:5, g:310 }' },
    { file:'index', expect:'every entry has a 0', find:'{ kg:2, g:345 } ];', replace:'{ kg:2, g:340 } ];' },
    { file:'index', expect:'writeDigits(', find:'return [kg, Math.floor(g / 100), Math.floor(g / 10) % 10, g % 10]; }', replace:'return [kg, Math.floor(g / 100), g % 10, Math.floor(g / 10) % 10]; }' },
    { file:'index', expect:'write: boxes', find:'WRITE_BOX = { y:104, slot:48, x:[54, 110, 166, 222],', replace:'WRITE_BOX = { y:104, slot:48, x:[54, 100, 166, 222],' },
    { file:'index', expect:'the digit cards reach the boxes', find:'var WRITE_KEYS = { y:184,', replace:'var WRITE_KEYS = { y:150,' },
    { file:'index', expect:'a wrong digit is accepted', find:'        if (v !== s.v){ roundMiss(s.i === 0', replace:'        if (v === -1){ roundMiss(s.i === 0' },
    { file:'index', expect:'gWriteG zh', find:"' 個一，所以' + ['', '百位', '十位', '個位'][i] + '寫 ' + dgt + '，不是 '", replace:"' 個一，所以' + ['', '十位', '百位', '個位'][i] + '寫 ' + dgt + '，不是 '" },
    { file:'index', expect:'gWriteDone zh', find:"'中間的 0 不能省 —— 寫成 ' + kg + g + ' 就只剩 ' + kg + g + ' 公克了。'", replace:"'中間的 0 不能省 —— 寫成 ' + kg + g + ' 就只剩 ' + g + ' 公克了。'" },
    { file:'index', expect:'gWriteKg en', find:"' kg = ' + (kg * 1000) + ' g, so it is ' + kg + ', not '", replace:"' kg = ' + (kg * 100) + ' g, so it is ' + kg + ', not '" },

    /* 第 5 關：轉指針 */
    { file:'index', expect:'is on a large tick', find:'{ tick:10, raw:38 },', replace:'{ tick:10, raw:40 },' },
    { file:'index', expect:'never practised', find:'{ tick:50, raw:13 }, { tick:20, raw:22 }, { tick:50, raw:26 }', replace:'{ tick:20, raw:13 }, { tick:20, raw:22 }, { tick:20, raw:26 }' },
    { file:'index', expect:'"counted a small tick as 10 g" is never reachable', find:'{ tick:20, raw:17 }, { tick:10, raw:38 }, { tick:50, raw:13 }, { tick:20, raw:22 }', replace:'{ tick:20, raw:31 }, { tick:10, raw:38 }, { tick:50, raw:13 }, { tick:20, raw:33 }' },
    { file:'index', expect:'dialRawAt(', find:'    var raw = Math.round(50 * (1 - th / Math.PI));', replace:'    var raw = Math.floor(50 * (1 - th / Math.PI));' },
    { file:'index', expect:'dialRawAt(', find:'    if (dy < 0) th = dx < 0 ? Math.PI : 0;', replace:'    if (dy < 0) th = dx < 0 ? 0 : Math.PI;' },
    { file:'index', expect:'dialFaceSVG(', find:"fill=\"#6B6875\">' + (i * tick) + '</text>';\n      }\n    }\n    var n = dialXY(DIAL.rN, 0);", replace:"fill=\"#6B6875\">' + (i / 5) + '</text>';\n      }\n    }\n    var n = dialXY(DIAL.rN, 0);" },
    { file:'index', expect:'the handle covers the tick marks', find:'rN:90, rK:56,', replace:'rN:90, rK:70,' },
    { file:'index', expect:'the parcel label reaches the dial numbers', find:'DIAL_H = 206, DIAL = { cx:150, cy:176,', replace:'DIAL_H = 206, DIAL = { cx:150, cy:156,' },
    { file:'index', expect:'a wrong needle is accepted', find:'        if (raw === e.raw){\n          knob.lock(', replace:'        if (Math.abs(raw - e.raw) <= 1){\n          knob.lock(' },
    { file:'index', expect:'case is not recognised', find:'        var misread = e.tick !== 10 && raw * 10 === T;', replace:'        var misread = false;' },
    { file:'index', expect:'gDialWrong zh', find:"'多了 ' + (R - T) + ' 公克，往回轉 ' + ((R - T) / tick) + ' 小格。'", replace:"'多了 ' + (R - T) + ' 公克，往回轉 ' + ((R - T) / 10) + ' 小格。'" },
    { file:'index', expect:'gDialDone en', find:"': ' + big + ' × ' + step + ' + ' + small + ' × ' + tick + ' = ' + T + ' g.'; },", replace:"': ' + big + ' × ' + step + ' + ' + small + ' × ' + tick + ' = ' + (T + tick) + ' g.'; }," },
    { file:'index', expect:'gDial2 zh', find:"return '一小格是 ' + step + ' ÷ 5 ＝ ' + tick + ' 公克；'", replace:"return '一小格是 ' + step + ' ÷ 10 ＝ ' + tick + ' 公克；'" },

    /* ---- index.html：範例與題庫 ---- */
    { file:'index', expect:'are not grams', find:"fill=\"#6B6875\">' + (i * tickG) + '</text>';", replace:"fill=\"#6B6875\">' + (i / MAJOR_EVERY) + '</text>';" },
    { file:'reference', expect:'reference.html dial: labels', find:"fill=\"#6B6875\">' + (i * TICK_G) + '</text>';", replace:"fill=\"#6B6875\">' + (i / MAJOR) + '</text>';" },
    { file:'reference', expect:'reference.html dial: the canvas', find:"    var W = 294, H = 150,", replace:"    var W = 270, H = 150," },
    { file:'index', expect:'the small card is under 120 tall', find:'small:{w:100,h:124} };', replace:'small:{w:84,h:96} };' },
    { file:'index', expect:'is not bigger than the', find:'big:{w:160,h:140}', replace:'big:{w:160,h:110}' },
    { file:'index', expect:'is a bed, not a pillow', find:"{ a:{icon:'🧸', size:'big',   w:500},", replace:"{ a:{icon:'🛏️', size:'big',   w:500}," },
    { file:'index', expect:'OBJECTS[', find:"{ icon:'🍎', wG:150,   unit:'g' },", replace:"{ icon:'🍎', wG:150,   unit:'kg' }," },
    { file:'index', expect:'arithmetic is wrong', find:"why:'5 公斤 ＝ 5000 公克，3 公斤 200 公克 ＝ 3200 公克，5000 − 3200 ＝ 1800，", replace:"why:'5 公斤 ＝ 5000 公克，3 公斤 200 公克 ＝ 3020 公克，5000 − 3200 ＝ 1800，" },
    { file:'index', expect:'arithmetic is wrong', find:"why:'Unify to grams: 70000 − 25300 = 44700 g = 44 kg 700 g.' }", replace:"why:'Unify to grams: 70000 − 25300 = 44700 g = 45 kg 700 g.' }" },
    { file:'index', expect:'static arithmetic fingerprint', find:"why:'5000 ÷ 1000 ＝ 5，所以是 5 公斤。' }", replace:"why:'4000 ÷ 1000 ＝ 4，所以是 5 公斤。' }" },
    { file:'index', expect:'dSmallVal', find:"return '一大格分成 5 小格：' + (tick * 5) + ' ÷ 5 ＝ ' + tick + ' 公克'; },", replace:"return '一大格分成 5 小格：' + (tick * 5) + ' ÷ 5 ＝ ' + (tick * 2) + ' 公克'; }," },
    { file:'index', expect:'the remainder', find:"compBLine1: function(total){ return total + ' ÷ 1000 ＝ 商 ' + Math.floor(total / 1000) + ' 餘 ' + (total % 1000); },", replace:"compBLine1: function(total){ return total + ' ÷ 1000 ＝ 商 ' + (Math.floor(total / 1000) - 1) + ' 餘 ' + (total % 1000 + 1000); }," },

    /* ---- review.html ---- */
    { file:'review', expect:'is less than 10 times away', find:"{ icon:'🍉', g:3000,  wrongs:[300,30000,30],", replace:"{ icon:'🍉', g:3000,  wrongs:[300,30000,3500]," },
    { file:'review', expect:'the cheat sheet says', find:"{ icon:'🎒', g:3000,  wrongs:[300,30000,30],", replace:"{ icon:'🎒', g:4000,  wrongs:[400,40000,40]," },
    { file:'review', expect:'is written out verbatim in the stem', find:"        var m = mixOptsInt(correct, cands, [gRem]);", replace:"        var m = mixOptsInt(correct, [gRem].concat(cands));" },
    { file:'review', expect:'is written out verbatim in the stem', find:"        var m = mixOptsInt(correct, [correct - 1000, gRem1 + g2, correct + 100], [kg1 * 1000, gRem1, g2, kg1 * 1000 + gRem1]);", replace:"        var m = mixOptsInt(correct, [kg1 * 1000 + gRem1, gRem1 + g2, correct + 100]);" },
    { file:'review', expect:'never practised', find:"        var gRem = rand(2) ? 1 + rand(99) : 100 + rand(900);", replace:"        var gRem = 100 + rand(900);" },
    { file:'review', expect:'0 g in the stem', find:"        var curRem = 1 + rand(998);   /* 不出「3 公斤 0 公克」 */", replace:"        var curRem = rand(999);" },
    { file:'review', expect:"is the basket's own weight", find:"correct + 1000], [curRem, curTotal]);", replace:"correct + 1000], [curRem]);" },
    { file:'review', expect:'rand() is not', find:"  function rand(n){ return Math.floor(Math.random() * n); }", replace:"  function rand(n){ return 0 * n; }" },
    { file:'review', expect:'the needle points at', find:"    var nt = dialTheta(raw);", replace:"    var nt = dialTheta(raw + 1);" },
    { file:'review', expect:'draws out to', find:"    var W = 232, H = 118,", replace:"    var W = 222, H = 118," },
    { file:'review', expect:'dial labels', find:"fill=\"#6B6875\">' + (i * tickG) + '</text>';", replace:"fill=\"#6B6875\">' + (i / MAJOR_EVERY) + '</text>';" },
    { file:'review', expect:'the third distractor', find:"        var m = mixOptsInt(correct, [correct + f1, f1 === 2 ? correct + f2 : (f1 - 1) * f2, correct - f1]);", replace:"        var m = mixOptsInt(correct, [correct + f1, f1 === 2 ? correct + f2 : (f1 - 1) * f2, correct - f2]);" },
    { file:'review', expect:'is copied straight out of the stem', find:"f1 === 2 ? correct + f2 : (f1 - 1) * f2", replace:"(f1 - 1) * f2" },
    { file:'review', expect:'is above 9999', find:"        var m = mixOptsInt(correct, [kg * 100, correct + 100, kg * 10]);", replace:"        var m = mixOptsInt(correct, [kg * 100, correct + 100, kg * 10000]);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var unitKg = lang === 'zh' ? '公斤' : 'kg', unitG = lang === 'zh' ? '公克' : 'g';\n        return {\n          stem: d.total", replace:"        var unitKg = lang === 'zh' ? '公斤' : ' kg', unitG = lang === 'zh' ? '公克' : ' g';\n        return {\n          stem: d.total" },
    { file:'review', expect:'why: arithmetic is wrong', find:"d.divisor + ' × ' + d.q + ' ＝ ' + (d.divisor * d.q) + '，'", replace:"d.divisor + ' × ' + d.q + ' ＝ ' + (d.divisor * d.q + 1) + '，'" },
    { file:'review', expect:'why: arithmetic is wrong', find:"? '1 公斤 ＝ 1000 公克，' + d.kg + ' × 1000 ＝ ' + d.correct", replace:"? '1 公斤 ＝ 100 公克，' + d.kg + ' × 1000 ＝ ' + d.correct" },
    { file:'review', expect:'the remainder', find:"? d.total + ' ÷ 1000 ＝ 商 ' + d.kg + ' 餘 ' + d.rem", replace:"? d.total + ' ÷ 1000 ＝ 商 ' + (d.kg - 1) + ' 餘 ' + (d.rem + 1000)" }
  ],

  sim: {
    /* buildDialSVG（秤面題的圖）在「工具」之前宣告，所以從秤面那一段開始切（那一段到 GENS 之間都不碰 DOM） */
    blockStart: '  /* ---------- 秤面 SVG（跟上課頁同一套畫法） ---------- */',
    INVARIANTS: {
      /* 估重量：每一個誘答都和正解差 10 倍以上 —— 3000 公克的西瓜旁邊放 3500 公克，兩個都講得通（§六之二，舊缺陷） */
      estimateWeight: d => {
        if (TRUE_G[d.icon] !== d.g) return d.icon + ' weighs ' + d.g + ' g here, but the cheat sheet says ' + TRUE_G[d.icon] + ' g';
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          const r = d.opts[i] / d.g;
          if (!(r >= 10 || r <= 0.1)) return 'option ' + d.opts[i] + ' g is less than 10 times away from ' + d.g + ' g — a second plausible estimate';
        }
        if (!d.zh || !d.en) return 'the object has no name — the stem would be just an emoji';
      },
      ladderKgToG: d => { if (d.correct !== d.kg * 1000) return 'correct != kg*1000'; if (d.opts.indexOf(d.kg * 100) < 0) return 'the ×100 misconception (kg and g mixed up with m and cm) is not among the options'; },
      /* 誘答 g ÷ 100（20～90 公斤）超過「9 公斤以內」—— 刻意的：那是和公分／公尺搞混的 ×100 迷思，靜態題 qs[3] 也有 50 公斤。
         這一課的量本來就到 70 公斤（qsAdv 爸爸的體重），所以這一題的範圍放到 99 公斤（codex 第一輪，判定不是缺陷） */
      ladderGToKg: d => { if (d.correct * 1000 !== d.g || !isInt(d.correct)) return 'correct != g/1000'; },
      /* 公克不到 100 時，「接在一起」（3 公斤 50 公克 → 350）一定要是誘答：這一課最重要的那個錯 */
      compoundToGrams: d => {
        if (sourcePins()) return sourcePins();
        if (d.correct !== d.kg * 1000 + d.gRem) return 'correct != kg*1000 + g';
        if (!(d.gRem >= 1 && d.gRem <= 999)) return 'g out of 1..999';
        if (d.gRem < 100 && d.opts.indexOf(Number(String(d.kg) + String(d.gRem))) < 0) return 'g < 100 but the "leave out the 0" answer ' + String(d.kg) + d.gRem + ' is not a distractor';
      },
      compoundFromGrams: d => { if (d.total % 1000 === 0 || d.kg !== Math.floor(d.total / 1000) || d.rem !== d.total % 1000) return 'kg/rem do not split total'; },
      addMixedUnits: d => { if (d.correct !== d.kg1 * 1000 + d.gRem1 + d.g2) return 'correct != chicken + fish'; },
      compareMixedUnits: d => {
        if (d.aG === d.bG) return 'the two bottles weigh the same';
        if (d.aG !== d.aKg * 1000 + d.aRem) return 'aG != aKg*1000 + aRem';
        if (d.winner !== (d.aG > d.bG ? 0 : 1)) return 'winner is wrong';
      },
      remainingCapacity: d => {
        if (sourcePins()) return sourcePins();
        if (d.curTotal !== d.curKg * 1000 + d.curRem) return 'curTotal != curKg*1000 + curRem';
        if (d.correct !== d.limitKg * 1000 - d.curTotal) return 'correct != limit - current';
        if (d.opts.some((o, i) => i !== d.ans && o === d.curTotal)) return 'a distractor ' + d.curTotal + ' g is the basket\'s own weight from the stem';
        if (!(d.curRem >= 1)) return 'the basket holds "' + d.curKg + ' kg 0 g" — 0 g in the stem';
        if (!(d.correct >= 1)) return 'nothing more fits';
      },
      dialReading: d => {
        if (d.raw % 5 === 0 || d.raw < 1 || d.raw > 49) return 'raw ' + d.raw + ' is on a large tick or off the dial';
        if (d.correct !== d.raw * d.tickG) return 'correct != raw*tick';
      },
      divideFact: d => {
        if (d.dividend !== d.divisor * d.q + d.r || !(d.r < d.divisor)) return 'q/r do not divide';
        const key = 'QR:' + d.q + ':' + d.r;
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          const p = d.opts[i].split(':').map(Number);
          if (d.divisor * p[1] + p[2] === d.dividend && p[2] < d.divisor) return 'distractor ' + d.opts[i] + ' is also correct';
          if (d.opts[i] === key) return 'the right answer appears twice';
        }
      },
      /* 第三個誘答 correct − f2 就是 (f1 − 1) × f2 —— 永遠重複，去重之後每一題都靠保底補（舊缺陷） */
      multiplyFact: d => {
        if (d.correct !== d.f1 * d.f2) return 'correct != f1*f2';
        const planned = [d.correct + d.f1, d.f1 === 2 ? d.correct + d.f2 : (d.f1 - 1) * d.f2, d.correct - d.f1];
        const wrong = d.opts.filter((o, i) => i !== d.ans);
        if (!planned.every(p => wrong.indexOf(p) >= 0)) return 'the third distractor is not one of the planned ones (' + wrong.join() + ') — the generator fell back to a filler';
      }
    },
    expectedCorrect: function(d, genId, lang){
      const U = UNIT[lang];
      switch (genId){
        case 'estimateWeight': return TRUE_G[d.icon] + ' ' + U.g;
        case 'ladderKgToG': return (d.kg * 1000) + ' ' + U.g;
        case 'ladderGToKg': return (d.g / 1000) + ' ' + U.kg;
        case 'compoundToGrams': return (d.kg * 1000 + d.gRem) + ' ' + U.g;
        case 'compoundFromGrams': return kgg(d.total, lang);
        case 'addMixedUnits': return kgg(d.kg1 * 1000 + d.gRem1 + d.g2, lang);
        case 'compareMixedUnits': return NAMES[lang][d.pairIdx][d.aKg * 1000 + d.aRem > d.bG ? 0 : 1];
        case 'remainingCapacity': return (d.limitKg * 1000 - d.curKg * 1000 - d.curRem) + ' ' + U.g;
        case 'dialReading': return (d.raw * d.tickG) + ' ' + U.g;
        case 'divideFact': return qr(Math.floor(d.dividend / d.divisor), d.dividend % d.divisor, lang);
        case 'multiplyFact': return String(d.f1 * d.f2);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'divideFact'){
        const m = lang === 'zh' ? s.match(/^商 (\d+)、餘 (\d+)$/) : s.match(/^(\d+) r (\d+)$/);
        return m ? undefined : 'option "' + s + '" is not a quotient-and-remainder in ' + lang;
      }
      if (genId === 'multiplyFact'){ if (!/^[1-9]\d*$/.test(s) || +s > 999) return 'option "' + s + '" is not a whole number 1~999'; return; }
      if (genId === 'compareMixedUnits'){
        const ok = NAMES[lang].some(p => p.indexOf(s) >= 0) || (lang === 'zh' ? ['一樣重', '沒辦法比較'] : ['The same', 'Can’t tell']).indexOf(s) >= 0;
        return ok ? undefined : 'option "' + s + '" is not a name or a filler';
      }
      if (/ {2}|^ | $/.test(s)) return 'option "' + s + '" has a doubled or stray space';
      const U = UNIT[lang];
      if (genId === 'ladderGToKg'){ const m = s.match(new RegExp('^([1-9]\\d*) ' + U.kg + '$')); if (!m || +m[1] > 99) return 'option "' + s + '" is not 1~99 ' + U.kg; return; }
      const kgForm = genId === 'compoundFromGrams' || genId === 'addMixedUnits';
      const re = kgForm ? new RegExp('^(?:[1-9]\\d* ' + U.kg + ')?(?:(?:^| )[1-9]\\d* ' + U.g + ')?$') : new RegExp('^[1-9]\\d* ' + U.g + '$');
      if (!re.test(s) || grams(s) === null) return 'option "' + s + '" is not written as ' + (kgForm ? 'kg and g' : 'whole grams') + ' in ' + lang;
      const v = grams(s);
      /* 範圍：這一課的公克數最大到 9 公斤 999 公克；估重量的誘答本來就要差 10 倍（最大 350000 公克） */
      const max = genId === 'estimateWeight' ? 350000 : 9999;
      if (v > max) return 'option ' + s + ' is above ' + max + ' g';
    },
    /* 渲染出來的那一題再驗一次：
       ① 誘答的字樣（數字＋單位）原封不動出現在題幹裡 —— simgen 的共用檢查只比純數字，帶單位的選項它一次都比不到。
       ② 秤面題：從圖上讀出刻度的數字（必須是 i × 一小格）和指針的角度，再算一次答案。 */
    renderCheck: function(d, q, lang, genId){
      for (const part of ['stem', 'why']){
        const r = CONV(String(q[part]).replace(/<svg[\s\S]*?<\/svg>/g, ' '));
        if (r.problems.length) return part + ': ' + r.problems[0] + ' — ' + String(q[part]).slice(0, 90);
      }
      if (!CONV(q.why).verified && ['estimateWeight', 'compareMixedUnits'].indexOf(genId) < 0) return 'why has no checkable equation: ' + q.why.slice(0, 80);
      const stem = String(q.stem).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const o = String(q.opts[i]).trim();
        if (!/\d/.test(o) || !/[^\d]/.test(o)) continue;   /* 純數字的交給 simgen */
        if (new RegExp('(?<!\\d)' + o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\d\\u4e00-\\u9fffA-Za-z])').test(stem)) return 'distractor "' + o + '" is written out verbatim in the stem';
      }
      if (genId === 'dialReading'){
        const svg = q.pic || '';
        const labels = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map(m => +m[1]);
        if (labels.length !== 11 || !labels.every((v, k) => v === k * 5 * d.tickG)) return 'dial labels ' + labels.join(',') + ' are not 0, ' + (5 * d.tickG) + ', … grams for a small tick of ' + d.tickG + ' g';
        const lines = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#D64545"/g)];
        if (lines.length !== 1) return 'cannot find the needle';
        const [, x1, y1, x2, y2] = lines[0].map(Number), raw = Math.round(50 * (1 - Math.atan2(y1 - y2, x2 - x1) / Math.PI));
        if (raw * d.tickG !== d.correct) return 'the needle points at ' + raw + ' small ticks = ' + raw * d.tickG + ' g, the answer says ' + d.correct;
        const cp = canvasProblems(svg); if (cp.length) return 'dial canvas: ' + cp[0];
      }
    },
    stemEchoOk: {}
  },

  data: {
    dataStart: '  /* ================= 共用：秤面 SVG ================= */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{buildDialSVG, TICKS, DIAL_RAW, CMP_PAIRS, CMP_SIZE, OBJECTS, COMPOUND_EX, LADDER_KG, LADDER_G, GPICK, pl, an, capF, WEIGH_H, WEIGH_SCALE, WEIGH_OBJ, WEIGH_BOX, WEIGH_EMOJI, WEIGH_LBL, WEIGH_SLOT, WEIGH_ITEMS, GAME_WEIGH, weighX, weighRanked, weighInversion, UNIT_H, UNIT_CARD, UNIT_BLANK, UNIT_NUM, UNIT_TILE, GAME_UNIT_G, GAME_UNIT_KG, unitCardXY, BAL_H, BAL, BAL_SRC, BAL_KG, BAL_100, GAME_BAL, balKgXY, bal100XY, WRITE_H, WRITE_LBL, WRITE_PLACE, WRITE_BOX, WRITE_PAD, WRITE_KEYS, GAME_WRITE, writeDigits, DIAL_H, DIAL, DIAL_KNOB, DIAL_LBL, GAME_DIAL, dialXY, dialRawAt, dialFaceSVG}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 算式驗算器自己先證明會響 --- */
      PROBES.forEach(([t, good, n]) => {
        const r = CONV(t);
        if (good && (r.problems.length || r.verified !== n)) fail('arith probe "' + t + '" should pass with ' + n + ' claim(s): ' + JSON.stringify(r.problems) + ' verified ' + r.verified);
        if (!good && !r.problems.length) fail('arith probe "' + t + '" should be caught');
      });
      { const r = BARE('3 公斤 × 1000 ＝ 3000 公克'); if (r.problems.length || r.verified !== 1) fail('arith probe (bare) "3 公斤 × 1000 ＝ 3000 公克" should pass'); }
      { const r = BARE('3 公斤 × 1000 ＝ 300 公克'); if (!r.problems.length) fail('arith probe (bare) "3 公斤 × 1000 ＝ 300 公克" should be caught'); }

      /* --- 1. 每一條 I18N 靜態字串（含三層題庫）的算式逐條重算；條數與指紋釘住 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      const STATIC = makeWeightArith(false);
      let verified = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const r = STATIC(s); verified += r.verified;
        r.problems.forEach(p => fail(where + ': ' + p));
      }));
      const fp = crypto.createHash('sha1').update(STATIC.fingerprint()).digest('hex').slice(0, 12);
      const WANT_STATIC = { verified:46, fp:'e30699cf53c2' };
      if (verified !== WANT_STATIC.verified || fp !== WANT_STATIC.fp) fail('static arithmetic fingerprint: ' + verified + ' claims, ' + fp + ' — pinned ' + WANT_STATIC.verified + ', ' + WANT_STATIC.fp + ' (a claim was dropped, added or swapped)');

      /* 每一句說明：數字照順序逐個比，句子裡的算式也要算得對 */
      const seq = (where, text, want, arith) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        if (arith !== false) (arith || CONV)(text).problems.forEach(p => fail(where + ': ' + p + ' — ' + text));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      /* 字寬估計（px）：中文一個字 ＝ 字級，數字／英文約 0.6 倍，emoji 1.2 倍 */
      const textW = (t, px) => [...String(t)].reduce((w, ch) => w + (/[　-鿿＀-￯]/.test(ch) ? px : /[\u{1F000}-\u{1FFFF}☀-⟿]/u.test(ch) ? px * 1.2 : /️/.test(ch) ? 0 : ch === ' ' ? px * 0.3 : px * 0.62), 0);

      /* --- 2. 範例 --- */
      {
        if (!D.CMP_PAIRS.some(p => p.a.size === 'big' && p.a.w < p.b.w)) fail('CMP_PAIRS: no pair where the big one is lighter — example 1 never surprises');
        D.CMP_PAIRS.forEach((p, i) => {
          if (p.a.w === p.b.w) fail('CMP_PAIRS[' + i + '] weigh the same');
          if (p.a.icon === '🛏️' || p.b.icon === '🛏️') fail('CMP_PAIRS[' + i + ']: 🛏️ is a bed, not a pillow — the picture and the words disagree');
          LANGS.forEach(L => {
            const n = I18N[L].cmpNames[i];
            seq('cmpWrong ' + L + ' ' + i, I18N[L].cmpWrong(n.a, p.a.w, n.b, p.b.w), [p.a.w, p.b.w]);
          });
        });
        /* 範例 1 的卡片：「大」的那一張要真的比較大（兩邊都大），小卡要放得下兩行英文名字＋重量（codex：84×96 折行後貼著下框） */
        { const C = data.CMP_SIZE; if (!(C && C.big.w > C.small.w && C.big.h > C.small.h)) fail('CMP_SIZE: the "big" card is not bigger than the "small" one in both directions'); if (!(C && C.small.h >= 120)) fail('CMP_SIZE: the small card is under 120 tall — a two-line English name plus the weight does not fit'); }
        D.OBJECTS.forEach((o, i) => { if ((o.wG < 1000) !== (o.unit === 'g')) fail('OBJECTS[' + i + '] ' + o.icon + ': ' + o.wG + ' g is shown with unit ' + o.unit); });
        D.COMPOUND_EX.forEach(ex => LANGS.forEach(L => {
          const d = I18N[L], t = ex.kg * 1000 + ex.g;
          seq('compALine1 ' + L, d.compALine1(ex.kg), [ex.kg, ex.kg * 1000]);
          seq('compALine2 ' + L, d.compALine2(ex.kg, ex.g, t), [ex.kg * 1000, ex.g, t]);
          seq('compBLine1 ' + L, d.compBLine1(t), [t, 1000, ex.kg, ex.g]);
        }));
        D.LADDER_KG.forEach(kg => LANGS.forEach(L => seq('ladderEqKgToG ' + L, I18N[L].ladderEqKgToG(kg, kg * 1000), [kg, 1000, kg * 1000], BARE)));
        D.LADDER_G.forEach(g => LANGS.forEach(L => seq('ladderEqGToKg ' + L, I18N[L].ladderEqGToKg(g, g / 1000), [g, 1000, g / 1000], BARE)));
        /* 範例 4 的秤面：數字是公克（i × 一小格），指針指著 DIAL_RAW 格；三種刻度的旁白逐個比 */
        D.TICKS.forEach(t => {
          const svg = D.buildDialSVG(D.DIAL_RAW, t);
          const labels = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map(m => +m[1]);
          if (labels.length !== 11 || !labels.every((v, k) => v === k * 5 * t)) fail('example 4 dial (' + t + ' g): labels ' + labels.join(',') + ' are not grams (0, ' + 5 * t + ', …) — "the numbers on this scale are grams" would be false');
          const nd = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#D64545"/g)];
          if (nd.length !== 1) fail('example 4 dial: cannot find the needle');
          else { const [, x1, y1, x2, y2] = nd[0].map(Number); const r = Math.round(50 * (1 - Math.atan2(y1 - y2, x2 - x1) / Math.PI)); if (r !== D.DIAL_RAW) fail('example 4 dial: the needle points at ' + r + ' ticks, not ' + D.DIAL_RAW); }
          canvasProblems(svg).forEach(p => fail('example 4 dial (' + t + ' g): ' + p));
          LANGS.forEach(L => {
            const d = I18N[L];
            seq('dBigVal ' + L, d.dBigVal(t), [5 * t, 5 * t]);
            seq('dSmallVal ' + L, d.dSmallVal(t), [5, 5 * t, 5, t]);
            seq('dReadVal ' + L, d.dReadVal(t), [Math.floor(D.DIAL_RAW / 5), 5 * t, D.DIAL_RAW % 5, t, D.DIAL_RAW, t]);
            seq('dResult ' + L, d.dResult(D.DIAL_RAW * t), D.DIAL_RAW * t >= 1000 ? [D.DIAL_RAW * t, Math.floor(D.DIAL_RAW * t / 1000), D.DIAL_RAW * t % 1000] : [D.DIAL_RAW * t]);
          });
        });
        /* 速查卡（同一個資料夾的 reference.html）的秤面：數字也必須是公克，而且要和旁邊的例子一致（一小格 20 公克、23 小格 → 460 公克） */
        {
          let ref = null;
          try { ref = require('fs').readFileSync(require('path').join(require('path').dirname(process.argv[2]), 'reference.html'), 'utf8'); } catch (e){ ref = null; }
          if (ref === null) fail('cannot read reference.html next to index.html — its dial is unchecked, not passing');
          else {
            const m = ref.match(/function buildDialSVG\(\)\{[\s\S]*?\n  \}\n/);
            let svg = null;
            try { svg = m && new Function(m[0] + '\nreturn buildDialSVG();')(); } catch (e){ fail('reference.html buildDialSVG() could not run: ' + e.message); }
            if (!svg) fail('cannot cut buildDialSVG() out of reference.html');
            else {
              const labels = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map(x => +x[1]);
              if (labels.length !== 11 || !labels.every((v, k) => v === k * 100)) fail('reference.html dial: labels ' + labels.join(',') + ' are not grams 0, 100, … (the example says one small tick is 20 g)');
              const nd = [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#D64545"/g)];
              if (nd.length === 1){ const [, x1, y1, x2, y2] = nd[0].map(Number); const r = Math.round(50 * (1 - Math.atan2(y1 - y2, x2 - x1) / Math.PI)); if (r * 20 !== 460) fail('reference.html dial: the needle reads ' + r * 20 + ' g, the example says 460 g'); }
              else fail('reference.html dial: cannot find the needle');
              canvasProblems(svg).forEach(p => fail('reference.html dial: ' + p));
            }
          }
        }
        if (!/<span data-i18n="dstep2">[^<]*<\/span><span id="dBigVal"><\/span>/.test(src)) fail('example 4: the dBigVal span sits inside a data-i18n element — applyStatic() wipes it and the value is never shown');
      }

      /* --- 3. 小遊戲：五關的順序、題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'dealOut' }).forEach(fail);
      const TYPES = ['weigh', 'unit', 'balance', 'write', 'dial'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else { const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, '')); if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + types.join()); }
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      TYPES.forEach(t => LANGS.forEach(L => {
        if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
        if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
        else CONV(I18N[L].gHints[t]).problems.forEach(p => fail('gHints.' + t + ' ' + L + ': ' + p));
      }));
      need('weigh', /dealOut\(set, function\(id, i\)\{/, 'the three things are not dealt out with dealOut() (their places would be fixed)');
      need('unit', /dealOut\(picks, function\(pk, i\)\{/, 'the four cards are not dealt out with dealOut()');
      ['GAME_WEIGH', 'GAME_UNIT_G', 'GAME_UNIT_KG', 'GAME_BAL', 'GAME_WRITE', 'GAME_DIAL'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍。點目的地的格子連 pad 也要夠大。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      [1, 2, 3].forEach(z => tooSmall('a size-' + z + ' thing (' + D.WEIGH_BOX[z] + ') drawn', D.WEIGH_BOX[z]));
      tooSmall('a unit tile', Math.min(D.UNIT_TILE.w, D.UNIT_TILE.h));
      tooSmall('a unit blank with its pad', D.UNIT_BLANK.h + 2 * 6);
      tooSmall('a weight', Math.min(D.BAL_SRC.w, D.BAL_SRC.h));
      tooSmall('a digit card', D.WRITE_KEYS.size);
      tooSmall('a box with its pad', D.WRITE_BOX.slot + 2 * D.WRITE_PAD);
      tooSmall('the needle handle', D.DIAL_KNOB);
      [D.WEIGH_BOX[1], D.UNIT_TILE.h, D.BAL_SRC.h, D.WRITE_KEYS.size, D.DIAL_KNOB].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 —— 中年級「輕度計分，答錯小扣分但不會結束」（§三） */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(src, 'roundMiss');
        if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      LANGS.forEach(L => {
        seq('gPts ' + L, I18N[L].gPts(20), [20]);
        seq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score');
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const h = D.WRITE_BOX.slot / 2, list = D.WRITE_BOX.x.map((cx, i) => ({ id:i, cx:cx, cy:D.WRITE_BOX.y, hw:h, hh:h, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, D.WRITE_PAD); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a box are given to another box (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：秤一秤、排順序（範例 1：重量不是大小） --- */
      {
        const S = D.WEIGH_SCALE, O = D.WEIGH_OBJ, SL = D.WEIGH_SLOT, LB = D.WEIGH_LBL, IT = D.WEIGH_ITEMS, BX = D.WEIGH_BOX;
        let bigHeavy = 0, bigLight = 0, bigMid = 0;
        D.GAME_WEIGH.forEach((set, i) => {
          const w = 'GAME_WEIGH[' + i + ']';
          if (set.length !== 3 || new Set(set).size !== 3 || !set.every(id => IT[id])) return fail(w + ' is not three different known things');
          const gs = set.map(id => IT[id].g), zs = set.map(id => IT[id].size);
          if (new Set(gs).size !== 3) fail(w + ': two things weigh the same — the order is not unique');
          if (new Set(zs).size !== 3) fail(w + ': two things are drawn the same size');
          const byG = set.slice().sort((a, b) => IT[a].g - IT[b].g), byZ = set.slice().sort((a, b) => IT[a].size - IT[b].size);
          if (byG.join() === byZ.join()) fail(w + ': the size order is the weight order — sorting by size would pass');
          if (D.weighRanked(set).join() !== byG.join()) fail(w + ': weighRanked() is ' + D.weighRanked(set).join() + ', should be ' + byG.join());
          const pos = byG.indexOf(byZ[2]);
          if (pos === 2) bigHeavy++; else if (pos === 0) bigLight++; else bigMid++;
          /* weighInversion()：真的是「比較大卻比較輕」，而且是大小差最多的那一對 */
          let best = null;
          for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++){ const dz = IT[byG[a]].size - IT[byG[b]].size; if (dz > 0 && (!best || dz > best[2])) best = [byG[a], byG[b], dz]; }
          const inv = D.weighInversion(set);
          if (!best || !inv || inv[0] !== best[0] || inv[1] !== best[1]) fail(w + ': weighInversion() is ' + JSON.stringify(inv) + ', should be ' + JSON.stringify(best && best.slice(0, 2)));
          else if (!(IT[inv[0]].size > IT[inv[1]].size && IT[inv[0]].g < IT[inv[1]].g)) fail(w + ': the pair it names is not bigger-but-lighter');
          /* 每一種放錯的說明：東西 x 放進名次 k（k 不是它的名次），對照的是名次 k 的那一個 */
          LANGS.forEach(L => {
            const d = I18N[L];
            byG.forEach((x, rx) => [0, 1, 2].forEach(k => {
              if (k === rx) return;
              const y = byG[k], t = d.gWeighWrong(d.gObj[x], IT[x].g, d.gObj[y], IT[y].g, IT[x].size - IT[y].size);
              seq(w + ' gWeighWrong ' + L + ' ' + x + '→' + k, t, [IT[x].g, IT[y].g]);
              const lighterMsg = L === 'zh' ? /輕 —— 這一格要放更重的/ : /lighter than .* needs a heavier one/;
              if ((IT[x].g < IT[y].g) !== lighterMsg.test(t)) fail(w + ' gWeighWrong ' + L + ': says lighter/heavier the wrong way round: ' + t);
              const note = L === 'zh' ? /看起來比較大，其實比較輕|看起來比較小，其實比較重/ : /looks bigger but is lighter|looks smaller but is heavier/;
              const wantNote = (IT[x].size > IT[y].size && IT[x].g < IT[y].g) || (IT[x].size < IT[y].size && IT[x].g > IT[y].g);
              if (note.test(t) !== wantNote) fail(w + ' gWeighWrong ' + L + ' ' + x + '/' + y + ': the "looks bigger/smaller" note is ' + (wantNote ? 'missing' : 'there although size agrees with weight') + ': ' + t);
            }));
            if (best) seq(w + ' gWeighDone ' + L, d.gWeighDone(byG.map(id => d.gObj[id]), byG.map(id => IT[id].g), d.gObj[best[0]], d.gObj[best[1]]), byG.map(id => IT[id].g));
            seq(w + ' gWeigh2 ' + L, d.gWeigh2([], byG.map(id => IT[id].g)), byG.map(id => IT[id].g));
            for (let n = 1; n <= 3; n++) seq(w + ' gWeigh2(left) ' + L, d.gWeigh2(set.slice(0, n).map(id => d.gObj[id]), []), [n]);
          });
          /* 重量標籤放得進那一塊 */
          set.forEach(id => LANGS.forEach(L => { const tw = textW(I18N[L].gWt(IT[id].g), 12); if (tw > BX[IT[id].size] - 8) fail(w + ': "' + I18N[L].gWt(IT[id].g) + '" (' + tw.toFixed(0) + 'px) does not fit in a box of ' + BX[IT[id].size]); }));
        });
        if (!bigHeavy) fail('GAME_WEIGH: the biggest is the heaviest in no set — "the biggest is never the heaviest" would be a rule that works');
        if (!bigLight) fail('GAME_WEIGH: the biggest is the lightest in no set');
        if (!bigMid) fail('GAME_WEIGH: the biggest is in the middle in no set');
        Object.keys(IT).forEach(id => LANGS.forEach(L => { if (!I18N[L].gObj[id]) fail('gObj.' + id + ' missing in ' + L); }));
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let n = 1; n <= 3; n++) seq('gWeighFirst ' + L, d.gWeighFirst(n), [n]);
          for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) if (a === 3 || b === 0) seq('gWeighNow ' + L, d.gWeighNow(a, b), a < 3 ? [a, 3] : [b, 3]);
          seq('gWt(0) ' + L, d.gWt(0), [0]);
          if (d.gWeighRank.length !== 3) fail('gWeighRank ' + L + ' is not three labels');
        });
        /* 版面：秤、三個位置、名次標籤、名次格子 */
        const scaleR = { x:S.cx - S.w / 2, y:S.y, w:S.w, h:S.h };
        inside(scaleR, 'weigh: the scale', W, D.WEIGH_H);
        const maxBox = Math.max(BX[1], BX[2], BX[3]);
        const homes = [0, 1, 2].map(i => sq(D.weighX(i), O.y, maxBox)), slots = [0, 1, 2].map(i => sq(D.weighX(i), SL.y, SL.w, SL.h)), lbls = [0, 1, 2].map(i => ({ x:D.weighX(i) - LB.w / 2, y:LB.y, w:LB.w, h:LB.h }));
        [0, 1, 2].forEach(i => { if (!near(D.weighX(i), 150 + (i - 1) * O.step)) fail('weighX(' + i + ') should be ' + (150 + (i - 1) * O.step)); });
        homes.forEach((r, i) => inside(r, 'weigh: thing ' + i, W, D.WEIGH_H)); noHits(homes, 'weigh: things ' + O.step + ' apart');
        slots.forEach((r, i) => inside(r, 'weigh: rank box ' + i, W, D.WEIGH_H)); noHits(slots, 'weigh: rank boxes');
        noHits(lbls, 'weigh: rank labels');
        if (S.y + S.h + 6 > O.y - maxBox / 2) fail('weigh: the scale (with its drop pad) reaches the things');
        if (O.y + maxBox / 2 > LB.y) fail('weigh: the things reach the rank labels');
        if (LB.y + LB.h > SL.y - SL.h / 2) fail('weigh: the rank labels reach the rank boxes');
        if (SL.w < maxBox + 6 || SL.h < maxBox + 6) fail('weigh: a rank box does not hold the biggest thing');
        if (S.top - maxBox / 2 < S.y + 8 || S.top + maxBox / 2 > S.y + S.h - 8 - 30) fail('weigh: a thing on the scale reaches its display or the scale edge');
        if (S.w < maxBox + 20) fail('weigh: the scale is narrower than the biggest thing');
        need('weigh', /if \(nearestOpen\(\[scale\], pt, 6\)\)\{/, 'a drop on the scale is not taken by nearestOpen');
        need('weigh', /if \(onScale && onScale !== P\)\{ var Q = onScale; onScale = null; if \(Q\.busy\(\)\) Q\.cancel\(\); else Q\.home\(\); \}/, 'putting a second thing on the scale does not take the first one off (or leaves it mid-drag under the other finger)');
        need('weigh', /if \(!P\.data\.weighed\)\{ P\.data\.weighed = true; weighed\+\+; drawObj\(P\); \}\s*disp\.textContent = d\.gWt\(P\.data\.g\);/, 'weighing does not show the weight on the display and on the thing');
        need('weigh', /if \(weighed < 3\)\{ gMsg\.textContent = d\.gWeighFirst\(3 - weighed\); return false; \}/, 'sorting before weighing everything is accepted, or is a mistake instead of a reminder');
        need('weigh', /if \(P\.data\.rank !== s\.k\)\{\s*var Y = byRank\(s\.k\);\s*roundMiss\(d\.gWeighWrong\(d\.gObj\[P\.data\.id\], P\.data\.g, d\.gObj\[Y\.data\.id\], Y\.data\.g, P\.data\.size - Y\.data\.size\)\);\s*return false;/, 'a wrong rank is accepted, or its reason is not about the thing that belongs there');
        need('weigh', /rank:ranked\.indexOf\(id\)/, 'the rank is not read from weighRanked()');
        need('weigh', /var ranked = weighRanked\(set\);/, 'the order is not weighRanked()');
        need('weigh', /if \(placed === 3\)\{\s*var inv = weighInversion\(set\);/, 'the round is not solved exactly when the three are placed, or the pair is not weighInversion()');
        need('weigh', /var disp = addSub\(sz, 'gdisp', d\.gWt\(0\)\);/, 'the empty scale does not read 0');
        need('weigh', /function scaleEmpty\(\)\{ onScale = null; disp\.textContent = d\.gWt\(0\); \}/, 'taking a thing off the scale does not bring the display back to 0');
        need('weigh', /var P = addPiece\(B, \{ w:box, h:box, cx:weighX\(i\), cy:WEIGH_OBJ\.y,/, 'the things are not drawn at weighX() in their own size');
      }

      /* --- 第 2 關：補上單位（範例 2） --- */
      {
        const C = D.UNIT_CARD, UB = D.UNIT_BLANK, UN = D.UNIT_NUM, TL = D.UNIT_TILE;
        const all = D.GAME_UNIT_G.map(it => [it, 'g']).concat(D.GAME_UNIT_KG.map(it => [it, 'kg']));
        if (new Set(all.map(x => x[0].id)).size !== all.length) fail('unit: two items share an id');
        const clip = D.GAME_UNIT_G.filter(it => it.id === 'clip')[0];
        if (!clip || clip.v !== 1) fail('unit: the paperclip benchmark ("1 根大約 1 公克") is not 1 g in the pool');
        all.forEach(([it, u]) => {
          const w = 'unit ' + it.id;
          if (!isInt(it.v) || it.v < 1) return fail(w + ': not a whole number');
          /* 答案唯一：用公克的都比 1 公斤（一大包鹽）輕很多，用公斤的都比 1 公斤重 —— 提示句說的就是這個 */
          if (u === 'g' && !(it.v <= 200)) fail(w + ': ' + it.v + ' g is not lighter than 1 kg by far (the hint says "much lighter than a big bag of salt")');
          if (u === 'kg' && !(it.v >= 2)) fail(w + ': ' + it.v + ' kg is not heavier than 1 kg (the hint says "heavier than a big bag of salt")');
          LANGS.forEach(L => {
            const d = I18N[L], name = d.gUnitName[it.id];
            if (!name) return fail(w + ': gUnitName missing in ' + L);
            const strip = t => String(t).split(name).join('@').split(capF(name)).join('@');
            if (u === 'g'){
              const t = d.gUnitHeavy(name, it.v);
              seq(w + ' gUnitHeavy ' + L, strip(t), it.v > 1 ? [it.v, 1, 1000, it.v, it.v * 1000, it.v] : [it.v, 1, 1000, it.v]);
              if (it.v > 1 && t.indexOf(String(it.v * 1000)) < 0) fail(w + ': gUnitHeavy does not work out ' + it.v + ' kg in grams');
            } else {
              seq(w + ' gUnitLight ' + L, strip(d.gUnitLight(name, it.v)), L === 'zh' ? [it.v, it.v, 1, 1, it.v] : [it.v, it.v, 1, it.v]);
            }
            seq(w + ' gUnit2 ' + L, strip(d.gUnit2(name, u === 'g')), [1]);
            /* 卡片上的名字放得下 */
            const tw = textW(name, 14) + 26 * 1.2 + 3;
            if (tw > C.w - 12) fail(w + ': the name "' + name + '" (' + tw.toFixed(0) + 'px) does not fit a card of ' + C.w);
          });
          function capF(t){ return t.charAt(0).toUpperCase() + t.slice(1); }
        });
        if (D.GAME_UNIT_G.length < 2 || D.GAME_UNIT_KG.length < 2) fail('GAME_UNIT_KG / GAME_UNIT_G: need at least 2 each (a round draws two of each)');
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let n = 0; n <= 4; n++) seq('gUnitNow ' + L, d.gUnitNow(n), [n, 4]);
          seq('gUnitDone ' + L, d.gUnitDone(['📎 1 ' + d.gUnitTile.g, '🎒 3 ' + d.gUnitTile.kg]), [1, 3]);
          if (!d.gUnitTile.g || !d.gUnitTile.kg || d.gUnitTile.g === d.gUnitTile.kg) fail('gUnitTile ' + L + ' does not name two different units');
        });
        /* 版面：四張卡、卡上的數字與空格、兩張單位卡 */
        const cards = [0, 1, 2, 3].map(i => { const c = D.unitCardXY(i); if (!near(c.x, C.x[i % 2]) || !near(c.y, C.y[Math.floor(i / 2)])) fail('unitCardXY(' + i + ') is ' + JSON.stringify(c)); return sq(c.x, c.y, C.w, C.h); });
        cards.forEach((r, i) => inside(r, 'unit: card ' + i, W, D.UNIT_H)); noHits(cards, 'unit: cards');
        const blank = { x:C.w / 2 + UB.dx - UB.w / 2, y:C.h / 2 + UB.dy - UB.h / 2, w:UB.w, h:UB.h };
        if (blank.x < 4 || blank.y < 30 || blank.x + blank.w > C.w - 3 || blank.y + blank.h > C.h - 3) fail('unit: the blank sticks out of card (or covers the name)');
        const numBox = { x:C.w / 2 + UN.dx, y:blank.y, w:UN.w, h:UB.h };
        if (numBox.x < 3) fail('unit: the number sticks out of the card');
        if (numBox.x + numBox.w > blank.x - 4) fail('unit: the number runs into the blank');
        if (textW('150', 24) > UN.w) fail('unit: a three-digit number does not fit its box');
        const tiles = TL.x.map(x => sq(x, TL.y, TL.w, TL.h));
        tiles.forEach((r, i) => inside(r, 'unit: tile ' + i, W, D.UNIT_H)); noHits(tiles, 'unit: tiles');
        if (TL.y - TL.h / 2 < Math.max(...cards.map(c => c.y + c.h)) + 8) fail('unit: the unit tiles reach the cards');
        need('unit', /var picks = shuffle\(GAME_UNIT_G\)\.slice\(0, 2\)\.map\(function\(it\)\{ return \{ it:it, u:'g' \}; \}\)\s*\.concat\(shuffle\(GAME_UNIT_KG\)\.slice\(0, 2\)\.map\(function\(it\)\{ return \{ it:it, u:'kg' \}; \}\)\);/, 'a round is not two grams and two kilograms');
        need('unit', /if \(P\.data\.u !== s\.pk\.u\)\{ roundMiss\(P\.data\.u === 'kg' \? d\.gUnitHeavy\(name, v\) : d\.gUnitLight\(name, v\)\); return false; \}/, 'a wrong unit is accepted, or the reason is the wrong one');
        need('unit', /if \(filled === 4\)\{/, 'the round is not solved exactly when the four blanks are filled');
        need('unit', /var s = nearestOpen\(slots, pt, 6\);/, 'the blanks are not picked by nearestOpen with a pad of 6');
        need('unit', /var c = unitCardXY\(i\);/, 'the cards are not drawn at unitCardXY()');
      }

      /* --- 第 3 關：配砝碼（範例 3 的「合起來」） --- */
      {
        const BL = D.BAL, KG = D.BAL_KG, H1 = D.BAL_100, SR = D.BAL_SRC;
        let anyA1 = false, anyBig = false, anyB5 = false, anyB3 = false;
        D.GAME_BAL.forEach((T, i) => {
          const w = 'GAME_BAL[' + i + ']';
          if (!isInt(T) || T % 100 !== 0) return fail(w + ': ' + T + ' g is not whole hundreds');
          const a = Math.floor(T / 1000), b = (T % 1000) / 100;
          if (b === 0) fail(w + ': ' + T + ' g — the hundreds digit is 0 (no 100 g weight needed)');
          if (a < 1 || a > 4) fail(w + ': ' + a + ' × 1 kg — the pan does not fit 4 of them or the parcel is under 1 kg');
          if (a === 1) anyA1 = true; if (a >= 3) anyBig = true; if (b >= 5) anyB5 = true; if (b <= 3) anyB3 = true;
          /* 照遊戲的規則把每一種放法都走一遍：1 公斤只在 x < a 時收、100 公克只在 y < b 時收；
             每一個走得到的狀態都還放得下去，走到底一定是 a 個 1 公斤、b 個 100 公克，而且剛好 T 公克 */
          const seen = new Set(), stack = [[0, 0]]; let ends = 0;
          while (stack.length){
            const [x, y] = stack.pop(), key = x + ',' + y; if (seen.has(key)) continue; seen.add(key);
            const moves = []; if (x < a) moves.push([x + 1, y]); if (y < b) moves.push([x, y + 1]);
            if (x * 1000 + y * 100 > T) fail(w + ': the rules let the right pan reach ' + (x * 1000 + y * 100) + ' g');
            if (x === a && y === b){ ends++; if (x * 1000 + y * 100 !== T) fail(w + ': finishes off balance'); continue; }
            if (!moves.length){ fail(w + ': stuck at ' + key); continue; }
            moves.forEach(m => stack.push(m));
          }
          if (ends !== 1) fail(w + ': ' + ends + ' finishing states');
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let x = 0; x <= a; x++) for (let y = 0; y <= b; y++) seq(w + ' gBalNow ' + L, d.gBalNow(x, y), [1, x, 100, y, x * 1000 + y * 100]);
            for (let y = 0; y < b; y++){
              const S = a * 1000 + y * 100;
              if (!(S + 1000 > T)) fail(w + ': gBalKgOver at ' + S + ' — one more 1 kg would not be heavier');
              seq(w + ' gBalKgOver ' + L, d.gBalKgOver(T, S), [S, 1, S + 1000, T]);
            }
            seq(w + ' gBalHundMore ' + L, d.gBalHundMore(T, a, b), L === 'zh' ? [T, a, b * 100, 100, b, a * 1000, a, 1] : [T, a, b * 100, b, 100, a * 1000, a, 1]);
            seq(w + ' gBalDone ' + L, d.gBalDone(T, a, b), [T, a, b * 100, a, 1, b, 100]);
            seq(w + ' gBal2 ' + L, d.gBal2(T, a, b, 0, 0), [T, a * 1000, b * 100, a, 1, b, 100, 0, 0]);
            seq(w + ' gBalParcel ' + L, d.gBalParcel(T), [T]);
          });
        });
        if (!anyA1) fail('GAME_BAL: no entry needs only one 1 kg');
        if (!anyBig) fail('GAME_BAL: no entry needs 3 or more 1 kg');
        if (!anyB5) fail('GAME_BAL: no entry needs 5 or more 100 g');
        if (!anyB3) fail('GAME_BAL: no entry needs 3 or fewer 100 g');
        /* 版面：盤子（含上下傾斜）、柱子、砝碼在盤子裡、砝碼托盤 */
        const pans = BL.panX.map(cx => ({ x:cx - BL.panW / 2, y:BL.panTop - BL.tilt, w:BL.panW, h:BL.panH + 2 * BL.tilt }));
        pans.forEach((p, i) => inside(p, 'balance: pan ' + i + ' (tilted)', W, D.BAL_H)); noHits(pans, 'balance: pans');
        const post = { x:BL.px - 3, y:BL.py, w:6, h:BL.baseY - BL.py };
        pans.forEach((p, i) => { if (hit(p, post)) fail('balance: the pans touch the post'); });
        inside({ x:BL.px - BL.beamW / 2, y:BL.py - BL.beamH / 2, w:BL.beamW, h:BL.beamH }, 'balance: the beam', W, D.BAL_H);
        if (Math.abs(BL.beamW / 2 - (BL.panX[1] - BL.px)) > 50) fail('balance: the beam ends are far from the pans');
        const blocks = [];
        for (let i = 0; i < 4; i++){ const p = D.balKgXY(i), m = { x:BL.panW / 2 + (i - 1.5) * KG.step, y:KG.y + KG.h / 2 }; if (!near(p.x, m.x) || !near(p.y, m.y)) fail('balKgXY(' + i + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m)); blocks.push(sq(m.x, m.y, KG.w, KG.h)); }
        for (let j = 0; j < 9; j++){ const p = D.bal100XY(j), m = { x:BL.panW / 2 + ((j % H1.perRow) - 2) * H1.step, y:H1.y + Math.floor(j / H1.perRow) * H1.rowStep + H1.h / 2 }; if (!near(p.x, m.x) || !near(p.y, m.y)) fail('bal100XY(' + j + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m)); blocks.push(sq(m.x, m.y, H1.w, H1.h)); }
        blocks.forEach((r, k) => { if (r.x < 4 || r.y < 3 || r.x + r.w > BL.panW - 4 || r.y + r.h > BL.panH - 6) fail('balance: weight ' + k + ' sticks out of the pan'); });
        noHits(blocks, 'balance: 1 kg and 100 g weights in the pan');
        const srcs = SR.x.map(x => sq(x, SR.y, SR.w, SR.h));
        srcs.forEach((r, i) => inside(r, 'balance: weight tray ' + i, W, D.BAL_H)); noHits(srcs, 'balance: weights');
        if (SR.y - SR.h / 2 < Math.max(BL.panTop + BL.panH + BL.tilt + 6, BL.baseY + 6)) fail('balance: the weights reach the pans (tilted, with the drop pad) or the base');
        need('balance', /var T = pick\(GAME_BAL\), a = Math\.floor\(T \/ 1000\), b = \(T % 1000\) \/ 100, x = 0, y = 0;/, 'the parcel is not split into a × 1 kg and b × 100 g');
        need('balance', /if \(x >= a\)\{ roundMiss\(d\.gBalKgOver\(T, x \* 1000 \+ y \* 100\)\); return false; \}/, 'too many 1 kg weights are accepted');
        need('balance', /if \(y >= b\)\{ roundMiss\(d\.gBalHundMore\(T, a, b\)\); return false; \}/, 'more 100 g weights than the hundreds digit are accepted');
        need('balance', /if \(x === a && y === b\)\{/, 'the round is not solved exactly at a × 1 kg and b × 100 g');
        need('balance', /var s = x \* 1000 \+ y \* 100, t = s < T \? 1 : \(s > T \? -1 : 0\);\s*beam\.style\.transform = 'rotate\(' \+ \(-t \* BAL\.deg\) \+ 'deg\)';\s*pans\[0\]\.style\.transform = 'translateY\(' \+ \(t \* BAL\.tilt\) \+ 'px\)';/, 'the balance tips the wrong way (the lighter side must go up)');
        need('balance', /if \(!nearestOpen\(\[right\], pt, 6\)\) return false;/, 'a drop away from the right pan is not silent');
        need('balance', /var pk = balKgXY\(x\);/, 'the 1 kg weights are not drawn at balKgXY()');
        need('balance', /var ph = bal100XY\(y\);/, 'the 100 g weights are not drawn at bal100XY()');
      }

      /* --- 第 4 關：寫成公克（範例 3 的「拆開來」） --- */
      {
        const WB = D.WRITE_BOX, KY = D.WRITE_KEYS, h = WB.slot / 2;
        let small = 0, tens0 = 0, noZero = 0;
        D.GAME_WRITE.forEach((e, i) => {
          const w = 'GAME_WRITE[' + i + ']';
          if (!isInt(e.kg) || !isInt(e.g) || e.kg < 1 || e.kg > 9 || e.g < 1 || e.g > 999) return fail(w + ': should be 1~9 kg and 1~999 g');
          const total = e.kg * 1000 + e.g, mine = String(total).split('').map(Number);
          if (D.writeDigits(e.kg, e.g).join() !== mine.join()) fail(w + ': writeDigits() is ' + D.writeDigits(e.kg, e.g).join() + ', should be ' + mine.join());
          if (e.g < 100) small++;
          if (e.g >= 100 && mine[2] === 0) tens0++;
          if (mine.indexOf(0) < 0) noZero++;
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gWriteLbl ' + L, d.gWriteLbl(e.kg, e.g), [e.kg, e.g], false);   /* 「3 公斤 50 公克 ＝」後面是要填的格子 */
            const concat = Number(String(e.kg) + String(e.g));
            seq(w + ' gWriteDone ' + L, d.gWriteDone(e.kg, e.g, total), [e.kg, e.g, e.kg * 1000, e.g, total].concat(e.g < 100 ? [0, concat, concat] : []));
            if (e.g < 100 && !(concat < total)) fail(w + ': "writing ' + concat + ' would be less" is not true');
            mine.forEach((dg, b) => {
              for (let x = 0; x <= 9; x++){
                if (x === dg) continue;
                if (b === 0) seq(w + ' gWriteKg ' + L + ' ' + x, d.gWriteKg(e.kg, x), [e.kg, e.kg * 1000, e.kg, x]);
                else {
                  const t = d.gWriteG(e.g, b, dg, x);
                  seq(w + ' gWriteG ' + L + ' box ' + b + ' card ' + x, t, [e.g, mine[1], mine[2], mine[3], dg, x]);
                  const word = L === 'zh' ? ['', '百位', '十位', '個位'][b] : ['', 'hundreds', 'tens', 'ones'][b];
                  if (t.indexOf(word) < 0) fail(w + ' gWriteG ' + L + ': box ' + b + ' does not say "' + word + '"');
                }
              }
              seq(w + ' gWrite2 ' + L + ' ' + b, d.gWrite2(b, e.kg, e.g, dg), b === 0 ? [e.kg, e.kg * 1000, e.kg] : [e.g, mine[1], mine[2], mine[3], dg]);
            });
          });
        });
        if (small < 2) fail('GAME_WRITE: no entry has fewer than 100 g (or only one) — the 0 in the hundreds is never practised');
        if (!tens0) fail('GAME_WRITE: no entry has a 0 in the tens with 100 g or more');
        if (!noZero) fail('GAME_WRITE: every entry has a 0 — "always put a 0 somewhere" would be a rule that works');
        LANGS.forEach(L => { for (let n = 0; n <= 4; n++) seq('gWriteNow ' + L, I18N[L].gWriteNow(n), [n, 4]); if (I18N[L].gWritePlace.length !== 4) fail('gWritePlace ' + L); });
        const boxes = WB.x.map(x => sq(x, WB.y, WB.slot)), padded = WB.x.map(x => sq(x, WB.y, WB.slot + 2 * D.WRITE_PAD));
        boxes.forEach((r, i) => inside(r, 'write: box ' + i, W, D.WRITE_H)); noHits(padded, 'write: boxes (with their pads)');
        const unit = { x:WB.unitX - WB.unitW / 2, y:WB.y - h, w:WB.unitW, h:WB.slot };
        inside(unit, 'write: the unit label', W, D.WRITE_H); if (hit(unit, boxes[3])) fail('write: the unit label overlaps the last box');
        if (D.WRITE_PLACE.y + D.WRITE_PLACE.h > WB.y - h) fail('write: the place labels reach the boxes');
        if (D.WRITE_LBL.y + D.WRITE_LBL.h > D.WRITE_PLACE.y) fail('write: the weight label reaches the place labels');
        const keys = []; for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * KY.step, KY.y + Math.floor(v / 5) * KY.rowStep, KY.size));
        keys.forEach((r, k) => inside(r, 'write: digit card ' + k, W, D.WRITE_H)); noHits(keys, 'write: digit cards');
        if (KY.y - KY.size / 2 < WB.y + h + D.WRITE_PAD + 6) fail('write: the digit cards reach the boxes');
        need('write', /var e = pick\(GAME_WRITE\), total = e\.kg \* 1000 \+ e\.g, digs = writeDigits\(e\.kg, e\.g\)/, 'the boxes are not writeDigits() of kg × 1000 + g');
        need('write', /if \(v !== s\.v\)\{ roundMiss\(s\.i === 0 \? d\.gWriteKg\(e\.kg, v\) : d\.gWriteG\(e\.g, s\.i, s\.v, v\)\); return false; \}/, 'a wrong digit is accepted, or its reason is not about that box');
        need('write', /if \(filled === 4\) roundSolved\(d\.gWriteDone\(e\.kg, e\.g, total\)\);/, 'the round is not solved exactly when the four boxes are filled');
        need('write', /var s = nearestOpen\(slots, pt, WRITE_PAD\);/, 'the boxes are not picked by nearestOpen with WRITE_PAD');
        need('write', /cx:150 \+ \(\(v % 5\) - 2\) \* WRITE_KEYS\.step, cy:WRITE_KEYS\.y \+ Math\.floor\(v \/ 5\) \* WRITE_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
        need('write', /P\.home\(\); P\.el\.classList\.remove\('sel'\);/, 'the digit card does not go back (cards must never run out)');
      }

      /* --- 第 5 關：轉指針（範例 4） --- */
      {
        const DL = D.DIAL;
        const ticks = new Set(); let misreadable = 0;
        D.GAME_DIAL.forEach((e, i) => {
          const w = 'GAME_DIAL[' + i + ']';
          if ([10, 20, 50].indexOf(e.tick) < 0) return fail(w + ': a small tick of ' + e.tick + ' g');
          ticks.add(e.tick);
          if (!isInt(e.raw) || e.raw < 1 || e.raw > 49 || e.raw % 5 === 0) fail(w + ': ' + e.raw + ' small ticks is on a large tick or off the dial — the small ticks would not matter');
          const T = e.raw * e.tick, step = 5 * e.tick, big = Math.floor(e.raw / 5), small = e.raw % 5;
          if (e.tick !== 10 && T % 10 === 0 && T / 10 <= 50 && T / 10 !== e.raw) misreadable++;
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gDialParcel ' + L, d.gDialParcel(T), [T]);
            seq(w + ' gDialNow ' + L, d.gDialNow(T), [T]);
            seq(w + ' gDialDone ' + L, d.gDialDone(T, big, small, step, e.tick), [big, small, big, step, small, e.tick, T]);
            seq(w + ' gDial2 ' + L, d.gDial2(T, e.tick, step, big, small), [step, 5, e.tick, T, big, step, small, e.tick, big, small]);
            for (let r = 0; r <= 50; r++){
              if (r === e.raw) continue;
              const R = r * e.tick, misread = e.tick !== 10 && r * 10 === T;
              const t = d.gDialWrong(T, R, e.tick, step, misread);
              seq(w + ' gDialWrong ' + L + ' at ' + r, t, misread ? [R, T, 10, step, 5, e.tick] : [R, T, Math.abs(R - T), Math.abs(r - e.raw)]);
              if (!misread && (R > T) !== (L === 'zh' ? /多了/.test(t) : /too much/.test(t))) fail(w + ' gDialWrong ' + L + ' at ' + r + ': says too much / too little the wrong way round');
            }
          });
          /* 遊戲的秤面：數字是 i × tick、畫得下 */
          const svg = D.dialFaceSVG(e.tick), labels = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map(m => +m[1]);
          if (labels.length !== 11 || !labels.every((v, k) => v === k * step)) fail(w + ': dialFaceSVG(' + e.tick + ') labels are ' + labels.join(',') + ', should be 0, ' + step + ', …');
          if ((svg.match(/<line /g) || []).length !== 52) fail(w + ': dialFaceSVG() should draw 51 ticks and one needle');
          canvasProblems(svg).forEach(p => fail(w + ' dialFaceSVG: ' + p));
        });
        if (ticks.size !== 3) fail('GAME_DIAL: a small tick of 10, 20 and 50 g should each appear — ' + [...ticks].join() + ' never practised otherwise');
        if (!misreadable) fail('GAME_DIAL: "counted a small tick as 10 g" is never reachable on the dial');
        /* dialXY() 和 dialRawAt()：轉到第 k 格，讀回來就是 k（三個半徑）；圓心以下一律算到兩端 */
        for (let k = 0; k <= 50; k++){
          const t = Math.PI * (1 - k / 50), mine = { x:DL.cx + DL.rK * Math.cos(t), y:DL.cy - DL.rK * Math.sin(t) }, p = D.dialXY(DL.rK, k);
          if (!near(p.x, mine.x) || !near(p.y, mine.y)) fail('dialXY(' + k + ') is ' + JSON.stringify(p));
          [30, DL.rK, DL.rL].forEach(r => { const q = { x:DL.cx + r * Math.cos(t), y:DL.cy - r * Math.sin(t) }; if (D.dialRawAt(q) !== k) fail('dialRawAt(): a point at tick ' + k + ' (radius ' + r + ') reads ' + D.dialRawAt(q)); });
          /* 半格以內都算同一格 */
          [-0.45, 0.45].forEach(dk => { const tt = Math.PI * (1 - (k + dk) / 50); if (k + dk >= 0 && k + dk <= 50){ const q = { x:DL.cx + 80 * Math.cos(tt), y:DL.cy - 80 * Math.sin(tt) }; if (D.dialRawAt(q) !== k) fail('dialRawAt(): a point ' + dk + ' tick off ' + k + ' reads ' + D.dialRawAt(q)); } });
        }
        if (D.dialRawAt({ x:DL.cx - 50, y:DL.cy + 20 }) !== 0 || D.dialRawAt({ x:DL.cx + 50, y:DL.cy + 20 }) !== 50) fail('dialRawAt(): a point below the centre is not clamped to the nearest end');
        /* 把手：在畫板裡、不蓋住刻度、不碰到數字 */
        const labelBox = k => { const t = Math.PI * (1 - k / 50); return sq(DL.cx + DL.rL * Math.cos(t), DL.cy - DL.rL * Math.sin(t), textW('2500', DL.fs), DL.fs + 2); };
        for (let k = 0; k <= 50; k++){
          const kb = sq(D.dialXY(DL.rK, k).x, D.dialXY(DL.rK, k).y, D.DIAL_KNOB);
          inside(kb, 'dial: the handle at tick ' + k, W, D.DIAL_H);
          if (DL.rK + D.DIAL_KNOB / 2 > DL.rO - 14 - 2) fail('dial: the handle covers the tick marks');   /* 把手是圓的 */
          for (let j = 0; j <= 50; j += 5) if (hit(kb, labelBox(j))) { fail('dial: the handle at ' + k + ' covers the number at ' + j); break; }
        }
        if (DL.rN < DL.rO - 14 || DL.rN > DL.rO) fail('dial: the needle does not reach into the tick ring');
        if (DL.rL - textW('2500', DL.fs) / 2 < DL.rO + 2) fail('dial: the numbers touch the tick ring');
        if (DL.cy - DL.rL - DL.fs < D.DIAL_LBL.y + D.DIAL_LBL.h + 2) fail('dial: the parcel label reaches the dial numbers');
        if (DL.top > DL.cy - DL.rL - DL.fs) fail('dial: the dial face starts below its top number');
        need('dial', /var e = pick\(GAME_DIAL\), T = e\.raw \* e\.tick, step = 5 \* e\.tick, raw = 0;/, 'the parcel is not raw × tick, or the needle does not start at 0');
        need('dial', /face\.innerHTML = dialFaceSVG\(e\.tick\);/, 'the dial is not dialFaceSVG(tick)');
        need('dial', /constrain:function\(p\)\{ var r = dialRawAt\(p\); drawNeedle\(r\); return dialXY\(DIAL\.rK, r\); \}/, 'dragging does not snap the handle to a tick');
        need('dial', /if \(raw === e\.raw\)\{\s*knob\.lock\(/, 'a wrong needle is accepted');
        need('dial', /var misread = e\.tick !== 10 && raw \* 10 === T;\s*roundMiss\(d\.gDialWrong\(T, raw \* e\.tick, e\.tick, step, misread\)\);/, 'a wrong needle has no reason, or the "small tick as 10 g" case is not recognised');
        need('dial', /knob\.cancel\(\);/, '"Check" during a drag does not cancel the drag first');
        need('dial', /setRaw\(dialRawAt\(pt\.tap \? pt : \{ x:P\.cx, y:P\.cy \}\)\);/, 'a drop or a tap does not set the needle to the nearest tick');
        need('dial', /knob\.onHome = function\(\)\{ drawNeedle\(raw\); \};/, 'a cancelled drag leaves the needle where the finger was');
      }
    }
  }
};
module.exports._test = { CONV, BARE, kgg, grams };
