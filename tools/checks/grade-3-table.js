/* grade-3/math/table 的檢查設定（表格讀心術：一維表格、二維表格、列總計／行總計／總計、用表格回答問題、把資料整理成表格）。
   2026-10-01 新增 —— 和小遊戲「表格小管家」改成五關五種玩法（§六之五）同一次寫成；在那之前這一課沒有設定檔，
   simgen／verify_lesson_data 一跑就報「no check config」，等於從來沒驗過。

   sim（review.html 的十二個產生器）：每個產生器一組不變條件、正解的第二套實作（只用 make() 留下的原始參數重算，
   名字用這裡自己的一份名稱表，不呼叫 review.html 的格式化函式）、選項的形狀與範圍，以及 renderCheck：
   把**畫出來的表格**（picture 的 HTML）讀回來，和資料逐格比 —— 題目是看圖回答的，圖錯了答案就跟著錯。

   data（index.html）：
   - 靜態題庫的正解用這裡自己的算法、從課程的表格資料（FRUIT_VALUES／SPORTS_GRID）重算，並要求題幹真的提到那幾個名字。
     第一次跑就抓到 qs[0]（葡萄賣出幾箱？）標的正解是 14（蘋果），16 才對 —— 兩種語言都錯。
   - 所有 I18N 靜態字串裡的算式逐條重算；範例 4 的四個問題（q4）實際呼叫、和自己的答案比。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲的規則重玩（點一點：只有符合的列收；移手指：只有對的列／欄收；補總計：每一張卡只收進它等於的那一格，
     每一格剛好一張卡收；排算式：每一格數字卡 × 每一個空格的收／不收和自己的規則一致；整理票數：票只收進同名的那一列），
     證明每一題都解得完、而且解完一定是對的；每一句說明逐個比數字；版面數字一律從 index.html 讀；
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   只能沿一軸移動的手指、375px 的實際尺寸由 teaching-workspace/game-harness/g3-table 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
/* 一句話裡應該出現的數字（照順序）：每一個參數是數字或字串（英文的班級名 Class 3-2 本身就帶著數字） */
function N(){ const out = []; for (const p of arguments) (Array.isArray(p) ? p : [p]).forEach(x => out.push(...nums(x))); return out; }
const sum = a => a.reduce((x, y) => x + y, 0);
const colSum = (g, c) => sum(g.map(r => r[c]));
const argmax = a => a.indexOf(Math.max(...a));
const argmin = a => a.indexOf(Math.min(...a));

/* 這裡自己的一份名稱表（第二套實作用，不讀課程的） */
const NAMES = {
  fruit: { zh:['蘋果', '香蕉', '橘子', '葡萄', '西瓜'], en:['Apples', 'Bananas', 'Oranges', 'Grapes', 'Watermelons'] },
  sport: { zh:['籃球', '足球', '桌球', '跳繩'], en:['Basketball', 'Soccer', 'Ping-pong', 'Jump rope'] },
  cls: { zh:['三年一班', '三年二班', '三年三班'], en:['Class 3-1', 'Class 3-2', 'Class 3-3'] },
  pet: { zh:['狗', '貓', '魚', '鳥'], en:['Dogs', 'Cats', 'Fish', 'Birds'] },
  tally: { zh:['動物園', '海邊', '樂園'], en:['Zoo', 'Beach', 'Park'] }
};
/* review.html 的名稱（小寫英文，和課程頁不同一份） */
const RV = {
  fruit: { zh:{apple:'蘋果', banana:'香蕉', orange:'橘子', grape:'葡萄', watermelon:'西瓜', mango:'芒果', pineapple:'鳳梨'},
           en:{apple:'apples', banana:'bananas', orange:'oranges', grape:'grapes', watermelon:'watermelons', mango:'mangoes', pineapple:'pineapples'} },
  cls: { zh:{c1:'三年一班', c2:'三年二班', c3:'三年三班', c4:'三年四班'}, en:{c1:'Class 3-1', c2:'Class 3-2', c3:'Class 3-3', c4:'Class 3-4'} },
  sport: { zh:{basketball:'籃球', soccer:'足球', pingpong:'桌球', jumprope:'跳繩', badminton:'羽球'},
           en:{basketball:'basketball', soccer:'soccer', pingpong:'ping-pong', jumprope:'jump rope', badminton:'badminton'} },
  tally: { zh:{zoo:'動物園', beach:'海邊', park:'樂園', museum:'博物館'}, en:{zoo:'the zoo', beach:'the beach', park:'the amusement park', museum:'the museum'} }
};

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果」找出來重算（× 先算，再由左到右 ＋ −；÷ 要整除或寫出餘數） */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(\d+)(?![\d\/]|\.\d)(?:(?: 餘 | remainder )(\d+))?/g;
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
      }
    } else {
      const terms = [];
      let cur = +toks[0], sign = 1;
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], v = +toks[i + 1];
        if (op === '×') cur *= v;
        else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
      }
      terms.push(sign * cur);
      const want = sum(terms);
      if (rem !== null) bad = 'a remainder after a non-division';
      else if (want !== got) bad = 'should be ' + want;
    }
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}

/* review.html 的二維表格：3 × 4、每格 2～9 人，而且列總計、行總計都兩兩不同（「最多／最少」唯一、兩格「相差」找得到不一樣的） */
function grid2D(d){
  const g = d.grid;
  if (!Array.isArray(g) || g.length !== 3 || g.some(r => !Array.isArray(r) || r.length !== 4 || r.some(v => !isInt(v) || v < 2 || v > 9))) return 'grid is not 3×4 of 2..9';
  if (new Set(g.map(sum)).size !== 3 || new Set([0, 1, 2, 3].map(c => colSum(g, c))).size !== 4) return 'the grid’s row totals / column totals are not all different';
  if (d.rk.length !== 3 || new Set(d.rk).size !== 3 || d.ck.length !== 4 || new Set(d.ck).size !== 4) return 'class / sport keys are not 3 / 4 different';
}

/* 抽樣抽不到的那一種表格，直接造出來跑（不是靠 30000 批碰運氣 —— 抽樣不是證明）：
   每格 2～9 而且邊際都不同的 [[2,2,2,3],[2,2,3,3],[2,3,3,3]]，正解 2 的時候別的格子只剩一個不同的數（3），
   誘答要靠保底 —— 保底不可以走到 0 人（codex 第二輪抓到的）。讀的是 simgen 正在跑的那一份 review.html（breaktest 的暫存檔也一樣）。 */
let forcedZero = null;
function forcedZeroCheck(){
  if (forcedZero !== null) return forcedZero;
  forcedZero = '';
  const file = process.argv[2];
  if (!file || !/review\.html$/.test(file)) return forcedZero;
  const src = require('fs').readFileSync(file, 'utf8');
  const i = src.indexOf('  /* ---------- 翻譯用的資料表 ---------- */'), j = src.indexOf('/* ---------- 出一批');
  const head = 'function makeDistinctMarginGrid(rows, cols, lo, hi){';
  if (i < 0 || j < 0 || src.indexOf(head) < 0) return (forcedZero = 'lookup2D forced-grid check: cannot cut the generator block / makeDistinctMarginGrid out of review.html');
  const forced = [[2, 2, 2, 3], [2, 2, 3, 3], [2, 3, 3, 3]];
  let GENS;
  try { GENS = new Function('FORCE', src.slice(i, j).replace(head, head + ' return FORCE.map(function(r){ return r.slice(); });') + '\n;return GENS;')(forced); }
  catch (e){ return (forcedZero = 'lookup2D forced-grid check could not run: ' + e.message); }
  const g = GENS.find(x => x.id === 'lookup2D');
  let twos = 0;
  for (let k = 0; k < 3000; k++){
    const d = g.make();
    if (d.correct !== 2) continue;
    twos++;
    if (d.opts.some(o => !(o >= 1))) return (forcedZero = 'lookup2D: on the grid [[2,2,2,3],[2,2,3,3],[2,3,3,3]] an answer of 2 gets a 0 option (' + d.opts + ')');
  }
  if (!twos) forcedZero = 'lookup2D forced-grid check never drew the answer 2';
  return forcedZero;
}

/* review.html 畫出來的表格（picture 的 HTML）讀回來：每一列的儲存格文字 */
function readTable(html){
  const rows = [];
  const trs = String(html).match(/<tr>[\s\S]*?<\/tr>/g) || [];
  trs.forEach(tr => rows.push((tr.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g) || []).map(c => c.replace(/<[^>]+>/g, '').trim())));
  return rows;
}

/* 靜態題庫的正解（第二套實作）：從課程自己的表格資料重算；mention = 題幹必須提到的名字 */
const QUIZ_KEY = {
  'qs.0': { ans:D => D.FRUIT_VALUES[3], mention:L => [L === 'zh' ? '葡萄' : 'grapes'] },
  'qs.1': { ans:(D, L) => NAMES.fruit[L][argmax(D.FRUIT_VALUES)], mention:L => [L === 'zh' ? '最多' : 'the most'] },
  'qs.2': { ans:D => D.SPORTS_GRID[1][2], mention:L => [NAMES.cls[L][1], L === 'zh' ? '桌球' : 'ping-pong'] },
  'qs.3': { ans:D => Math.abs(D.SPORTS_GRID[0][3] - D.SPORTS_GRID[2][3]), mention:L => [NAMES.cls[L][0], NAMES.cls[L][2], L === 'zh' ? '跳繩' : 'jump rope', L === 'zh' ? '相差' : 'more'] },
  'qs.4': { ans:D => D.SPORTS_GRID[0][0] + D.SPORTS_GRID[1][0], mention:L => [NAMES.cls[L][0], NAMES.cls[L][1], L === 'zh' ? '籃球' : 'basketball', L === 'zh' ? '一共' : 'in total'] },
  'qs.5': { ans:(D, L) => NAMES.sport[L][argmax([0, 1, 2, 3].map(c => colSum(D.SPORTS_GRID, c)))], mention:L => [L === 'zh' ? '最多' : 'the most'] },
  'qsAdv.0': { ans:D => colSum(D.SPORTS_GRID, 3), mention:L => [L === 'zh' ? '跳繩' : 'jump rope'] },
  'qsAdv.1': { ans:D => sum(D.SPORTS_GRID[0]) + sum(D.SPORTS_GRID[1]), mention:L => [NAMES.cls[L][0], NAMES.cls[L][1]] },
  'qsAdv.2': { ans:D => D.SPORTS_GRID[1][2] + D.SPORTS_GRID[2][2], mention:L => [NAMES.cls[L][1], NAMES.cls[L][2], L === 'zh' ? '桌球' : 'ping-pong'] },
  'qsAdv.3': { ans:D => D.FRUIT_VALUES[0] + D.FRUIT_VALUES[4] - D.FRUIT_VALUES[2], mention:L => L === 'zh' ? ['蘋果', '西瓜', '橘子'] : ['apples', 'watermelons', 'oranges'] },
  'qsBoost.0': { ans:D => D.SPORTS_GRID[2][1], mention:L => [NAMES.cls[L][2], L === 'zh' ? '足球' : 'soccer'] },
  'qsBoost.1': { ans:D => D.SPORTS_GRID[0][0] - D.SPORTS_GRID[1][0], mention:L => [NAMES.cls[L][0], NAMES.cls[L][1], L === 'zh' ? '籃球' : 'basketball'] }
};

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['pick', 'ruler', 'total', 'sentence', 'tally'];", replace:"var GAME_ORDER = ['pick', 'total', 'ruler', 'sentence', 'tally'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'measure to the box, not the centre',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; tie = false; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; tie = false; }" },
    { file:'index', expect:'nearestOpen() ruler rows',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; tie = false; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; tie = false; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done && !tie ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return tie ? null : best;\n  }\n  /* 托盤" },

    /* 第 1 關：點一點 */
    { file:'index', expect:'exactly one fruit should sell exactly 10', find:"{ vals:[12, 8, 15, 10, 6], dir:'more', n:10 },", replace:"{ vals:[12, 8, 15, 11, 6], dir:'more', n:10 }," },
    { file:'index', expect:'fruits fit — should be 2~3', find:"{ vals:[11, 17, 9, 14, 6], dir:'more', n:9 },", replace:"{ vals:[11, 17, 9, 14, 16], dir:'more', n:9 }," },
    { file:'index', expect:'two fruits sold the same', find:"{ vals:[13, 6, 10, 5, 18], dir:'less', n:10 },", replace:"{ vals:[13, 6, 10, 6, 18], dir:'less', n:10 }," },
    { file:'index', expect:'the rule is not', find:'var fits = function(v){ return more ? v > e.n : v < e.n; };', replace:'var fits = function(v){ return more ? v >= e.n : v <= e.n; };' },
    { file:'index', expect:'a row that does not fit is accepted', find:"          if (!fits(v)){ roundMiss(v === e.n ? d.gPickEq(name, v, more) : d.gPickNot(name, v, e.n, more)); return; }\n", replace:'' },
    { file:'index', expect:'a found row can be counted twice', find:"          if (done[i]) return;\n", replace:'' },
    { file:'index', expect:'gPickEq zh', find:"return name + '剛好 ' + v + ' 箱，和 ' + v + ' 箱一樣多", replace:"return name + '剛好 ' + v + ' 箱，和 ' + (v + 1) + ' 箱一樣多" },
    { file:'index', expect:'gPickNot en', find:"name + ' sold only ' + v + ' boxes — not more than ' + n + '.'", replace:"name + ' sold only ' + v + ' boxes — not more than ' + v + '.'" },
    { file:'index', expect:'does not say "more"', find:"return (more ? 'More' : 'Fewer') + ' than ' + n + ' boxes: '", replace:"return (more ? 'Fewer' : 'More') + ' than ' + n + ' boxes: '" },
    { file:'index', expect:'gPick2 zh', find:"return '還有 ' + left + ' 種沒找到", replace:"return '還有 ' + (left - 1) + ' 種沒找到" },
    { file:'index', expect:'a fruit row (40)', find:'  var PICK = { th:28, hy:32, hh:40, ry:72, rh:48,', replace:'  var PICK = { th:28, hy:32, hh:40, ry:72, rh:40,' },
    { file:'index', expect:'pick: row 4 is outside', find:'  var PICK_H = 320;', replace:'  var PICK_H = 300;' },
    { file:'index', expect:'the table has no title', find:"      addZone(B, 0, 0, 300, P.th, 'gtitle', d.gPickTitle);\n", replace:'' },
    { file:'index', expect:'does not show the unit', find:"fruitColLabel:'Fruit', fruitValueLabel:'Boxes sold',", replace:"fruitColLabel:'Fruit', fruitValueLabel:'Sold'," },

    /* 第 2 關：移手指 */
    { file:'index', expect:'a finger (40)', find:'ry:116, rh:48, finger:GPICK, rowX:24, homeY:286 };', replace:'ry:116, rh:48, finger:40, rowX:24, homeY:286 };' },
    { file:'index', expect:'at home touches the table', find:'ry:116, rh:48, finger:GPICK, rowX:24, homeY:286 };', replace:'ry:116, rh:48, finger:GPICK, rowX:24, homeY:270 };' },
    { file:'index', expect:'covers the class names', find:'ry:116, rh:48, finger:GPICK, rowX:24, homeY:286 };', replace:'ry:116, rh:48, finger:GPICK, rowX:60, homeY:286 };' },
    { file:'index', expect:'ruler: the table is', find:'  var RULER = { cx0:34, cw:62, col:51,', replace:'  var RULER = { cx0:34, cw:62, col:60,' },
    { file:'index', expect:'does not move only up and down', find:"text:'👉', cls:'gfinger', axis:'y'", replace:"text:'👉', cls:'gfinger'" },
    { file:'index', expect:'does not move only left and right', find:"text:'👇', cls:'gfinger', axis:'x'", replace:"text:'👇', cls:'gfinger', axis:'y'" },
    { file:'index', expect:'a wrong row is accepted', find:"if (b.r !== e.r){ roundMiss(d.gRulerRow(d.classNames[CLASS_KEYS[b.r]], cls)); return false; }", replace:"if (b.r !== e.r && false){ roundMiss(d.gRulerRow(d.classNames[CLASS_KEYS[b.r]], cls)); return false; }" },
    { file:'index', expect:'a wrong column is accepted', find:"if (c.c !== e.c){ roundMiss(d.gRulerCol(d.petNames[PET_KEYS[c.c]], pet)); return false; }", replace:"if (c.c > 9){ roundMiss(d.gRulerCol(d.petNames[PET_KEYS[c.c]], pet)); return false; }" },
    { file:'index', expect:'gRulerRow en', find:"return 'That is the ' + got + ' row — we need ' + want + '.'; }", replace:"return 'That is the ' + want + ' row — we need ' + got + '.'; }" },
    { file:'index', expect:'gRuler2 zh', find:"return cls + '是第 ' + r + ' 列", replace:"return cls + '是第 ' + (r - 1) + ' 列" },
    { file:'index', expect:'gRulerDone zh', find:"'」那一欄交叉在這一格：' + v + ' 人。'", replace:"'」那一欄交叉在這一格：' + (v + 1) + ' 人。'" },
    { file:'index', expect:'row 0 × column 0', find:'var GAME_RULER = [ { g:0, r:0, c:1 },', replace:'var GAME_RULER = [ { g:0, r:0, c:0 },' },
    { file:'index', expect:'GAME_GRIDS[0] should be', find:'    [[6, 5, 3, 7], [4, 8, 2, 5], [9, 3, 6, 4]],', replace:'    [[6, 5, 3, 7], [4, 8, 2, 5], [9, 3, 6, 14]],' },
    { file:'index', expect:'the line shows the answer before', find:'      var line = trailLine(d.gRulerNow(cls, pet, null));', replace:'      var line = trailLine(d.gRulerNow(cls, pet, v));' },
    { file:'index', expect:'petNames en are missing or not all different', find:"petNames:{ dog:'Dogs', cat:'Cats', fish:'Fish', bird:'Birds' },", replace:"petNames:{ dog:'Dogs', cat:'Cats', fish:'Fish', bird:'Fish' }," },
    { file:'index', expect:'the crossing box does not light up', find:"          cells[e.r][e.c].classList.add('ghit');\n", replace:'' },

    /* 第 3 關：補總計 */
    { file:'index', expect:'dec[0] 12 is not', find:'br:1, bc:2, dec:[11, 33] },', replace:'br:1, bc:2, dec:[12, 33] },' },
    { file:'index', expect:'are not all different', find:'br:2, bc:2, dec:[9, 31] },', replace:'br:2, bc:2, dec:[17, 31] },' },
    { file:'index', expect:'dec[1] 30 is not', find:'br:2, bc:2, dec:[9, 31] },', replace:'br:2, bc:2, dec:[9, 30] },' },
    { file:'index', expect:'has no empty neighbour', find:'br:2, bc:0, dec:[11, 32] },', replace:'br:1, bc:0, dec:[11, 32] },' },
    { file:'index', expect:'a card that does not equal its box is accepted', find:'        if (P.data.v !== s.v){', replace:'        if (P.data.v < 0){' },
    { file:'index', expect:'the card tray reaches the table', find:'tw:64, th:24, hy:26, hh:44, ry:70, rh:48, trayY:300,', replace:'tw:64, th:24, hy:26, hh:44, ry:70, rh:48, trayY:280,' },
    { file:'index', expect:'cards 50 apart touch', find:'trayY:300, step:56, card:48 };', replace:'trayY:300, step:50, card:48 };' },
    { file:'index', expect:'gTotRow en', find:"'’s row total: add that row’s ' + cells.join(', ') + ' — ' + v + ' is not it.'", replace:"'’s row total: add that row’s ' + cells.join(', ') + ' — ' + (v + 1) + ' is not it.'" },
    { file:'index', expect:'gTotalDone zh', find:"' ＝ ' + G + '，行總計 '", replace:"' ＝ ' + (G + 1) + '，行總計 '" },
    { file:'index', expect:'gTot2Col zh', find:"return '「' + pet + '」這一欄：' + cells.join(' ＋ ') + '。'; }", replace:"return '「' + pet + '」這一欄：' + cells.slice(1).join(' ＋ ') + '。'; }" },
    { file:'index', expect:'the grand total is not a blank', find:"      blank('grand', 0, GS, 3, 3);", replace:"      addCell(B, x3, T.ry + 3 * T.rh, T.tw, T.rh, 'gtot', GS);" },
    { file:'index', expect:'the cards are not the three answers', find:'renderTray(B, [RS[e.br], CS[e.bc], GS].concat(e.dec), T.trayY,', replace:'renderTray(B, [RS[e.br], CS[e.bc], GS + 1].concat(e.dec), T.trayY,' },
    { file:'index', expect:'totalColX(0) is wrong', find:'c < 3 ? TOTAL.cx0 + TOTAL.cw + c * TOTAL.col + TOTAL.col / 2', replace:'c < 3 ? TOTAL.cx0 + TOTAL.cw + c * TOTAL.col + TOTAL.col / 3' },
    { file:'index', expect:'the blank boxes are not what this config sweeps', find:'cx:totalColX(c), cy:totalRowY(r), hw:w / 2 - 2, hh:T.rh / 2 - 2, done:false, el:z });', replace:'cx:totalColX(c), cy:totalRowY(r), hw:w / 2 + 6, hh:T.rh / 2 - 2, done:false, el:z });' },

    /* 第 4 關：排算式 */
    { file:'index', expect:'a wrong sign is accepted', find:"if ((P.data.op === '−') !== diff){ roundMiss(diff ? d.gEqOpDiff : d.gEqOpSum); return false; }", replace:"if (false){ roundMiss(diff ? d.gEqOpDiff : d.gEqOpSum); return false; }" },
    { file:'index', expect:'matched by its value', find:'var isA = P.data.r === e.a[0] && P.data.c === e.a[1], isB = P.data.r === e.b[0] && P.data.c === e.b[1];', replace:'var isA = P.data.v === va, isB = P.data.v === vb;' },
    { file:'index', expect:'a difference can be written smaller − bigger', find:"          if (diff && P.data.v !== (s.k === 'a' ? big : small)){ roundMiss(d.gEqOrder(big, small)); return false; }\n", replace:'' },
    { file:'index', expect:'a box the question does not ask about is accepted', find:"if (!isA && !isB){ roundMiss(d.gEqCell(", replace:"if (!isA && !isB && false){ roundMiss(d.gEqCell(" },
    { file:'index', expect:'the answer box opens before', find:'        if (ready()){ inp.disabled = false; btn.disabled = false; }', replace:'        inp.disabled = false; btn.disabled = false;' },
    { file:'index', expect:'an answer can be checked before the sentence is built', find:'        if (gSolved || !ready()) return;', replace:'        if (gSolved) return;' },
    { file:'index', expect:'a blank, spaced or leading-0 answer', find:"if (!/^(0|[1-9]\\d*)$/.test(t)){ gMsg.textContent = d.gEqEmpty; return; }", replace:"if (!/^\\d+$/.test(t)){ gMsg.textContent = d.gEqEmpty; return; }" },
    { file:'index', expect:'the answer is not trimmed', find:'        var t = inp.value.trim();', replace:"        var t = inp.value.replace(/\\s/g, '');" },
    { file:'index', expect:'a wrong answer is accepted', find:'if (got !== want){ roundMiss(d.gEqWrong(', replace:'if (got < 0){ roundMiss(d.gEqWrong(' },
    { file:'index', expect:'the answer is not computed from the sentence', find:"var want = opSlot.v === '+' ? slots[0].v + slots[1].v : slots[0].v - slots[1].v, got = +t;", replace:"var want = slots[0].v + slots[1].v, got = +t;" },
    { file:'index', expect:'the difference is 1', find:"{ g:0, kind:'diff', a:[0, 0], b:[2, 0] },", replace:"{ g:0, kind:'diff', a:[1, 3], b:[2, 3] }," },
    { file:'index', expect:'should share exactly one of row / column', find:"{ g:2, kind:'diff', a:[0, 3], b:[1, 3] },", replace:"{ g:2, kind:'diff', a:[0, 3], b:[2, 2] }," },
    { file:'index', expect:'gEqDone en', find:"(op === '−' ? 'the difference is ' : 'that is ') + r + ' students'", replace:"(op === '−' ? 'the difference is ' : 'that is ') + (r + 1) + ' students'" },
    { file:'index', expect:'must name the key words', find:"gEqOpDiff:'題目問「相差」，要用減法 −。',", replace:"gEqOpDiff:'要用減法 −。'," },
    { file:'index', expect:'number sentence parts', find:'xeq:214, xres:260,', replace:'xeq:214, xres:244,' },
    { file:'index', expect:'the sign cards reach the number sentence', find:'xres:260, opY:318, opStep:64 };', replace:'xres:260, opY:290, opStep:64 };' },
    { file:'index', expect:'gEqCell zh', find:"return '這個 ' + v + ' 是' + cls + '想養' + pet", replace:"return '這個 ' + (v + 1) + ' 是' + cls + '想養' + pet" },
    { file:'index', expect:'does not say "相差"', find:"return c1 + '和' + c2 + '想養' + pet + '的人數相差多少？'; }", replace:"return c1 + '和' + c2 + '想養' + pet + '的人數差多少？'; }" },
    { file:'index', expect:'gEqOrder en', find:"'A difference is bigger minus smaller: the bigger ' + big + ' goes before the −, the smaller ' + small + ' after it.'", replace:"'A difference is bigger minus smaller: the bigger ' + small + ' goes before the −, the smaller ' + big + ' after it.'" },

    /* 第 5 關：整理票數 */
    { file:'index', expect:'a vote is accepted in the wrong row', find:'        if (b.k !== P.data.k){', replace:'        if (b.k === null){' },
    { file:'index', expect:'a vote does not add 1', find:'        counts[b.k]++; b.num.textContent = counts[b.k]; placed++;', replace:'        b.num.textContent = counts[b.k]; placed++;' },
    { file:'index', expect:'should be 9 votes', find:"    ['zoo', 'beach', 'zoo', 'park', 'beach', 'zoo', 'beach', 'zoo', 'park'],", replace:"    ['zoo', 'beach', 'zoo', 'park', 'beach', 'zoo', 'beach', 'zoo'],"},
    { file:'index', expect:'fewer than 2 votes', find:"    ['beach', 'park', 'beach', 'zoo', 'beach', 'park', 'beach', 'zoo', 'beach'],", replace:"    ['beach', 'park', 'beach', 'zoo', 'beach', 'park', 'beach', 'beach', 'beach'],"},
    { file:'index', expect:'the votes reach the table', find:'cw:88, ch:GPICK, cy0:228,', replace:'cw:88, ch:GPICK, cy0:214,' },
    { file:'index', expect:'tally: votes', find:'cy0:228, cstep:96, crow:54 };', replace:'cy0:228, cstep:80, crow:54 };' },
    { file:'index', expect:'tallyChipXY(', find:'return { x:150 + ((i % 3) - 1) * TALLY.cstep,', replace:'return { x:150 + (i % 3) * TALLY.cstep,' },
    { file:'index', expect:'gTallyDone en', find:"' = ' + total + ' — the same as the '", replace:"' = ' + (total + 1) + ' — the same as the '" },
    { file:'index', expect:'a vote (40', find:'cw:88, ch:GPICK, cy0:228,', replace:'cw:88, ch:40, cy0:228,' },
    { file:'index', expect:'gTallyNames zh are missing or not all different', find:"gTallyNames:{ zoo:'動物園', beach:'海邊', park:'樂園' },", replace:"gTallyNames:{ zoo:'動物園', beach:'海邊', park:'海邊' }," },

    /* ---- index.html：題庫與範例 ---- */
    { file:'index', expect:'the table says "16", marked answer is "14"', find:"        { picture:'fruit', ans:0,\n          stem:'根據下表，葡萄賣出了幾箱？'", replace:"        { picture:'fruit', ans:3,\n          stem:'根據下表，葡萄賣出了幾箱？'" },
    { file:'index', expect:'qs[1] zh: the table says "西瓜"', find:'  var FRUIT_VALUES = [14, 20, 9, 16, 7];', replace:'  var FRUIT_VALUES = [14, 20, 9, 16, 27];' },
    { file:'index', expect:'should be 10', find:"why:'三年一班籃球是 7 人，三年二班是 3 人，7 + 3 = 10 人。' },", replace:"why:'三年一班籃球是 7 人，三年二班是 3 人，7 + 3 = 11 人。' }," },
    { file:'index', expect:'q4[0] en: the bold answer', find:"I18N.en.classNames[CLASS_KEYS[mi]] + '’s row total is <b>' + sums[mi] + '</b>", replace:"I18N.en.classNames[CLASS_KEYS[mi]] + '’s row total is <b>' + (sums[mi] + 1) + '</b>" },
    { file:'index', expect:'does not mention "三年二班"', find:"stem:'三年二班選桌球的有幾人？'", replace:"stem:'三年一班選桌球的有幾人？'" },
    { file:'index', expect:'RAW_VOTES has a place', find:"  var RAW_VOTES = ['zoo',", replace:"  var RAW_VOTES = ['museum'," },
    { file:'index', expect:'only 13 equations', find:"why:'跳繩那一欄：6 + 4 + 8 = 18，就是跳繩的行總計。' },", replace:"why:'跳繩那一欄的 6、4、8 加起來是 18，就是跳繩的行總計。' }," },

    /* ---- review.html ---- */
    { file:'review', expect:'an answer of 2 gets a 0 option', find:'        var m = mixOpts(correct, shuffle(wrongPool), [0]);', replace:'        var m = mixOpts(correct, shuffle(wrongPool));' },
    { file:'index', expect:'an exact tie', find:"      else if (dd === bd && dc === bc) tie = true;\n", replace:'' },
    { file:'index', expect:'the □ ○ □ drop boxes are not what this config sweeps', find:"{ k:'a', cx:Q.xa, cy:Q.y, hw:h, hh:h, done:false, v:null }", replace:"{ k:'a', cx:Q.xa, cy:Q.y, hw:h + 20, hh:h, done:false, v:null }" },
    { file:'review', expect:'row totals / column totals are not all different', find:'      if (hasDistinctMargins(grid)) return grid;', replace:'      return grid;' },
    { file:'review', expect:'a value outside 5~26 boxes', find:'var values = distinctValues(n, 5, 26);', replace:'var values = distinctValues(n, 1, 28);' },
    { file:'review', expect:'divisor / quotient outside 3~9 / 4~12', find:'var quotient = 4 + rand(9);', replace:'var quotient = 4 + rand(30);' },
    { file:'review', expect:'copied from the stem outside a class name', find:"'According to the table, how many students in ' + rowName", replace:"'According to table 3, how many students in ' + rowName" },
    { file:'review', expect:'is copied straight out of the stem', find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });', replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'is copied straight out of the stem', find:'askRemainder ? [dividend] : [dividend, divisor]);', replace:'askRemainder ? [dividend] : [dividend]);' },
    { file:'review', expect:'is not a whole number', find:'      if (c < 0) return;\n', replace:'' },
    { file:'review', expect:'option count 5', find:'        var n = 4;   /* 一種水果一個選項', replace:'        var n = pick([4,5]);   /* 一種水果一個選項' },
    { file:'review', expect:'option 0 makes no sense for sumTwoCells2D', find:'mixOpts(correct, diffWrong > 0 ? [diffWrong, v1, v2] : [v1, v2]);', replace:'mixOpts(correct, [diffWrong, v1, v2]);' },
    { file:'review', expect:'row 0 is drawn as', find:"grid[ri].forEach(function(v){ html += '<td>' + v + '</td>'; });", replace:"grid[ri].forEach(function(v){ html += '<td>' + (v + 1) + '</td>'; });" },
    { file:'review', expect:'does not say its unit', find:"var h2 = lang === 'zh' ? '賣出（箱）' : 'Boxes sold';", replace:"var h2 = lang === 'zh' ? '賣出' : 'Sold';" },
    { file:'review', expect:'record 0 is drawn as', find:"return '<span class=\"tallychip\">' + (i+1) + '. '", replace:"return '<span class=\"tallychip\">' + (i+2) + '. '" },
    { file:'review', expect:'idx is not the', find:'        var idx = rowSums.indexOf(target);', replace:'        var idx = 0;' },
    { file:'review', expect:'is not another row of the table', find:'        var wrongPool = values.filter(function(v,i){ return i !== idx; });', replace:'        var wrongPool = values.map(function(v){ return v + 30; });' },
    { file:'review', expect:'the two boxes are equal', find:'for (var i=1; i<cOrder.length && v1===v2; i++)', replace:'for (var i=1; i<1 && v1===v2; i++)' },
    { file:'review', expect:'opts[ans] != correct', find:'        var correct = sum(grid[r]);', replace:'        var correct = sum(grid[r]) + 1;' }
  ],

  sim: {
    blockStart: '  /* ---------- 翻譯用的資料表 ---------- */',
    /* 一題幾個選項：一般 4 個；「哪一種水果最多／最少」是表格裡的每一種水果（4 種），「哪一班最多／最少」是三個班 */
    optCount: { extremeRow2D: 3, '*': 4 },
    INVARIANTS: {
      lookup1D: d => {
        if (d.keys.length !== 4 && d.keys.length !== 5) return 'the table has ' + d.keys.length + ' fruits';
        if (d.values.some(v => !isInt(v) || v < 5 || v > 26)) return 'a value outside 5~26 boxes: ' + d.values;
        if (new Set(d.values).size !== d.values.length) return 'two fruits sold the same — not needed here, but the distractors come from the other rows';
        for (let i = 0; i < d.opts.length; i++) if (i !== d.ans && d.values.indexOf(d.opts[i]) < 0) return 'distractor ' + d.opts[i] + ' is not another row of the table';
      },
      extreme1D: d => {
        if (d.keys.length !== 4) return 'the table has ' + d.keys.length + ' fruits — the question has one option per fruit, so 4';
        if (d.values.some(v => !isInt(v) || v < 4 || v > 27)) return 'a value outside 4~27 boxes: ' + d.values;
        if (new Set(d.values).size !== d.values.length) return 'two fruits sold the same — "the most / the least" may not be unique';
        const want = d.wantMax ? argmax(d.values) : argmin(d.values);
        if (want !== d.idx) return 'idx ' + d.idx + ' is not the ' + (d.wantMax ? 'max' : 'min');
      },
      lookup2D: d => {
        const z = forcedZeroCheck(); if (z) return z;
        const bad = grid2D(d); if (bad) return bad;
        /* 誘答是表格裡別的格子（看錯列或欄）；別的格子不夠三個不同的數時，保底是正解 ± 1、± 2 */
        const flat = [].concat(...d.grid);
        for (let i = 0; i < d.opts.length; i++) if (i !== d.ans && flat.indexOf(d.opts[i]) < 0 && Math.abs(d.opts[i] - d.correct) > 2) return 'distractor ' + d.opts[i] + ' is neither another box of the table nor a near miss';
      },
      rowTotal2D: d => {
        const bad = grid2D(d); if (bad) return bad;
        const rs = d.grid.map(sum);
        if (new Set(rs).size !== 3) return 'row totals are not all different';
      },
      colTotal2D: d => {
        const bad = grid2D(d); if (bad) return bad;
        const cs = [0, 1, 2, 3].map(c => colSum(d.grid, c));
        if (new Set(cs).size !== 4) return 'column totals are not all different';
        if (d.colVals.join() !== d.grid.map(r => r[d.c]).join()) return 'colVals is not the column';
      },
      diff2D: d => {
        const bad = grid2D(d); if (bad) return bad;
        if (d.rIdx[0] === d.rIdx[1]) return 'the same class twice';
        if (d.v1 !== d.grid[d.rIdx[0]][d.c] || d.v2 !== d.grid[d.rIdx[1]][d.c]) return 'v1/v2 are not the boxes';
        if (d.v1 === d.v2) return 'the two boxes are equal — "the difference" is 0';
      },
      sumTwoCells2D: d => {
        const bad = grid2D(d); if (bad) return bad;
        if (d.rIdx[0] === d.rIdx[1]) return 'the same class twice';
        if (d.v1 !== d.grid[d.rIdx[0]][d.c] || d.v2 !== d.grid[d.rIdx[1]][d.c]) return 'v1/v2 are not the boxes';
      },
      extremeRow2D: d => {
        const bad = grid2D(d); if (bad) return bad;
        if (d.rowSums.join() !== d.grid.map(sum).join()) return 'rowSums are not the row totals';
        if (new Set(d.rowSums).size !== 3) return 'two classes tie — "the most / the fewest" is not unique';
        const want = d.wantMax ? argmax(d.rowSums) : argmin(d.rowSums);
        if (want !== d.idx) return 'idx is not the ' + (d.wantMax ? 'max' : 'min');
      },
      tallyCount: d => {
        if (d.records.length < 12 || d.records.length > 16) return 'records ' + d.records.length;
        if (d.records.some(k => d.keys.indexOf(k) < 0)) return 'a record outside the three places';
        const c = d.records.filter(k => k === d.targetKey).length;
        if (c !== d.correct) return 'correct is not the count';
        if (c < 1) return 'asks about a place with no votes';
      },
      addsub: d => {
        if (d.isAdd && !(d.x >= 100 && d.x <= 499 && d.y >= 100 && d.y <= 499)) return 'addends outside 100~499';
        if (!d.isAdd && !(d.x >= 300 && d.x <= 899 && d.y >= 10 && d.y < d.x)) return 'subtraction outside 300~899 − 10~(p−1)';
        if (d.isAdd && d.correct !== d.x + d.y) return 'x + y';
        if (!d.isAdd && (d.correct !== d.x - d.y || d.correct < 1)) return 'x − y';
      },
      multiply: d => {
        if (!(d.a >= 12 && d.a <= 98 && d.d >= 2 && d.d <= 9)) return 'factors outside 12~98 × 2~9';
        if (d.correct !== d.a * d.d) return 'a × d';
      },
      divide: d => {
        if (!(d.divisor >= 3 && d.divisor <= 9 && d.quotient >= 4 && d.quotient <= 12)) return 'divisor / quotient outside 3~9 / 4~12';
        if (d.dividend !== d.divisor * d.quotient + d.remainder) return 'dividend != divisor × quotient + remainder';
        if (!(d.remainder >= 0 && d.remainder < d.divisor)) return 'remainder is not 0..divisor−1';
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'lookup1D': return String(d.values[d.idx]);
        case 'extreme1D': return RV.fruit[lang][d.keys[d.wantMax ? argmax(d.values) : argmin(d.values)]];
        case 'lookup2D': return String(d.grid[d.r][d.c]);
        case 'rowTotal2D': return String(sum(d.grid[d.r]));
        case 'colTotal2D': return String(colSum(d.grid, d.c));
        case 'diff2D': return String(Math.abs(d.grid[d.rIdx[0]][d.c] - d.grid[d.rIdx[1]][d.c]));
        case 'sumTwoCells2D': return String(d.grid[d.rIdx[0]][d.c] + d.grid[d.rIdx[1]][d.c]);
        case 'extremeRow2D': { const rs = d.grid.map(sum); return RV.cls[lang][d.rk[d.wantMax ? argmax(rs) : argmin(rs)]]; }
        case 'tallyCount': return String(d.records.filter(k => k === d.targetKey).length);
        case 'addsub': return String(d.isAdd ? d.x + d.y : d.x - d.y);
        case 'multiply': return String(d.a * d.d);
        case 'divide': return String(d.askRemainder ? d.dividend % d.divisor : Math.floor(d.dividend / d.divisor));
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'extreme1D'){ if (Object.values(RV.fruit[lang]).indexOf(s) < 0) return 'option "' + s + '" is not a fruit name'; return; }
      if (genId === 'extremeRow2D'){ if (Object.values(RV.cls[lang]).indexOf(s) < 0) return 'option "' + s + '" is not a class name'; return; }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      /* 範圍從每個產生器自己的數字推出來：一維表格 5～26 箱、二維表格每格 2～9 人（列總計最多 36、行總計最多 27）、
         兩格的和最多 18、票數最多 16、加的和最多 499 + 499（減法的誘答 p + q 最多 1797）、乘法最多 98 × 9（＋9）、除法最多是被除數以下。
         查格子與兩格相加的誘答不夠三個不同的數時，保底是正解 ± 1、± 2（所以 9 的保底可以是 10、11，18 的可以是 19、20），那是明講的上限，不是隨手放寬。 */
      /* 一維表格的誘答一定是表格裡別的列（至少 3 列不同的數），所以沒有保底，5～26 就是上限；
         除法的選項是商 ± 1、+ 2（最多 14）或餘數 ± 1 與除數（最多 9）；乘法最小是 12 × 2 − 2 ＝ 22 或 12 ＋ 2 ＝ 14 */
      const DOM = { lookup1D:[5, 26], lookup2D:[1, 11], rowTotal2D:[6, 36], colTotal2D:[6, 36], diff2D:[1, 18], sumTwoCells2D:[1, 20],
        tallyCount:[0, 18], addsub:[1, 1797], multiply:[14, 891], divide:[0, 14] };
      if (n === 0 && genId !== 'divide' && genId !== 'tallyCount') return 'option 0 makes no sense for ' + genId;
      if (n < DOM[genId][0] || n > DOM[genId][1]) return 'option ' + n + ' outside ' + DOM[genId][0] + '~' + DOM[genId][1] + ' for ' + genId;
    },
    /* 英文的班級名 Class 3-2 本身帶著 3 和 2：選項剛好是 3 或 2 不是「抄題幹」。只放行那種情況 ——
       數字只出現在班級名裡、題幹別處沒有。
       除法的「餘數 ＝ 除數」是刻意的迷思誘答（餘數一定比除數小），只放行那一個值；review.html 那一側用 avoidExcept() 各自獨立地說出同一件事。 */
    stemEchoOk: (function(){
      const onlyInClassNames = (names) => (d, opt, lang) => lang === 'en' && N(...names(d).map(k => RV.cls.en[k])).indexOf(+opt) >= 0;
      return {
        lookup2D: onlyInClassNames(d => [d.rk[d.r]]),
        rowTotal2D: onlyInClassNames(d => [d.rk[d.r]]),
        diff2D: onlyInClassNames(d => d.rIdx.map(i => d.rk[i])),
        sumTwoCells2D: onlyInClassNames(d => d.rIdx.map(i => d.rk[i])),
        divide: (d, opt) => d.askRemainder && +opt === d.divisor
      };
    })(),
    /* 畫出來的那一題：表格的每一格要和資料一樣，題幹提到的名字要真的在表格裡 */
    renderCheck: function(d, q, lang, genId){
      /* stemEchoOk 放行「英文班級名裡的數字」：這裡把題幹裡的班級名拿掉，剩下的地方不可以再出現那個誘答 */
      if (lang === 'en' && ['lookup2D', 'rowTotal2D', 'diff2D', 'sumTwoCells2D'].indexOf(genId) >= 0){
        let rest = q.stem.replace(/<[^>]+>/g, ' ');
        Object.values(RV.cls.en).forEach(n => { rest = rest.split(n).join(' '); });
        const left = nums(rest);
        for (let i = 0; i < q.opts.length; i++) if (i !== q.ans && left.indexOf(+q.opts[i]) >= 0) return 'distractor ' + q.opts[i] + ' is copied from the stem outside a class name';
      }
      if (genId === 'lookup1D' || genId === 'extreme1D'){
        const t = readTable(q.picture);
        if (t.length !== d.keys.length + 1) return 'the fruit table has ' + (t.length - 1) + ' rows, data has ' + d.keys.length;
        for (let i = 0; i < d.keys.length; i++){
          if (t[i + 1][0] !== RV.fruit[lang][d.keys[i]] || +t[i + 1][1] !== d.values[i]) return 'row ' + i + ' is drawn as ' + t[i + 1].join('/');
        }
        if (genId === 'lookup1D' && q.stem.indexOf(RV.fruit[lang][d.keys[d.idx]]) < 0) return 'the stem does not name the fruit';
        if (!/箱|[Bb]oxes/.test(t[0][1])) return 'the value column does not say its unit';
        return;
      }
      if (['lookup2D', 'rowTotal2D', 'colTotal2D', 'diff2D', 'sumTwoCells2D', 'extremeRow2D'].indexOf(genId) >= 0){
        const t = readTable(q.picture);
        const head = t[0];
        if (head.slice(1, 5).join() !== d.ck.map(k => RV.sport[lang][k]).join()) return 'the column headers are drawn as ' + head.join('/');
        for (let r = 0; r < 3; r++){
          if (t[r + 1][0] !== RV.cls[lang][d.rk[r]]) return 'row ' + r + ' header is ' + t[r + 1][0];
          if (t[r + 1].slice(1, 5).map(Number).join() !== d.grid[r].join()) return 'row ' + r + ' is drawn as ' + t[r + 1].join('/');
          if (genId === 'extremeRow2D' && +t[r + 1][5] !== sum(d.grid[r])) return 'row ' + r + ' total is drawn as ' + t[r + 1][5];
        }
        if (genId !== 'extremeRow2D' && head.length !== 5) return 'the table shows totals it was not asked to';
        const stemNames = { lookup2D:[d.rk[d.r]], rowTotal2D:[d.rk[d.r]], diff2D:(d.rIdx || []).map(i => d.rk[i]), sumTwoCells2D:(d.rIdx || []).map(i => d.rk[i]) }[genId] || [];
        for (const k of stemNames) if (q.stem.indexOf(RV.cls[lang][k]) < 0) return 'the stem does not name ' + RV.cls[lang][k];
        if (d.c !== undefined && genId !== 'rowTotal2D' && q.stem.indexOf(RV.sport[lang][d.ck[d.c]]) < 0) return 'the stem does not name the sport';
        return;
      }
      if (genId === 'tallyCount'){
        const chips = (q.picture.match(/<span class="tallychip">([\s\S]*?)<\/span>/g) || []).map(c => c.replace(/<[^>]+>/g, ''));
        if (chips.length !== d.records.length) return 'drawn ' + chips.length + ' records, data has ' + d.records.length;
        for (let i = 0; i < chips.length; i++) if (chips[i] !== (i + 1) + '. ' + RV.tally[lang][d.records[i]]) return 'record ' + i + ' is drawn as ' + chips[i];
        if (q.stem.indexOf(RV.tally[lang][d.targetKey]) < 0) return 'the stem does not name the place';
      }
    }
  },

  data: {
    dataStart: '  /* ===================== 語言無關的資料 ===================== */',
    dataEnd: '  /* ===================== i18n ===================== */',
    dataReturn: '{FRUIT_KEYS, FRUIT_VALUES, CLASS_KEYS, SPORT_KEYS, SPORTS_GRID, TALLY_KEYS, RAW_VOTES, GAME_ORDER, GPICK, GAME_PICK, PICK, PICK_H, pickRowY, PET_KEYS, PET_ICONS, GAME_GRIDS, GAME_RULER, RULER, RULER_H, rulerColX, rulerRowY, GAME_TOTAL, TOTAL, TOTAL_H, totalColX, totalRowY, GAME_EQ, EQ, EQ_H, eqColX, eqRowY, TALLY_ICONS, GAME_TALLY, TALLY, TALLY_H, tallyRowY, tallyChipXY}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
      [['8 − 6 = 2', true], ['8 − 6 = 3', false], ['7 + 3 = 10', true], ['6 + 4 + 8 = 18', true], ['6 + 4 + 8 = 17', false],
       ['21 − 9 = 12', true], ['22 + 21 = 43', true], ['22 + 21 = 44', false], ['16 ＋ 17 ＋ 16 ＝ 49', true], ['16 ＋ 17 ＋ 16 ＝ 48', false],
       ['14 ÷ 3 = 4 餘 2', true], ['14 ÷ 3 = 4 餘 1', false], ['3 × 4 + 2 = 14', true],
       /* 英文句子的句點不是小數點：「… 8 − 6 = 2.」要讀得到，「8 − 6 = 2.5」不可以當成 2 */
       ['is 8. 8 − 6 = 2.', true], ['is 8. 8 − 6 = 3.', false], ['8 − 6 = 2.5', null]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (good === null){ if (r.length) fail('scanEquations() self-test: "' + t + '" should not be read as an equation, got ' + JSON.stringify(r)); return; }
          if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

      /* --- 1. I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 14) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* --- 2. 靜態題庫：正解從課程的表格資料重算，題幹要提到那幾個名字 --- */
      {
        const G0 = D.SPORTS_GRID;
        if (D.FRUIT_KEYS.length !== 5 || D.FRUIT_VALUES.length !== 5) fail('the fruit table should have 5 rows');
        if (G0.length !== 3 || G0.some(r => r.length !== 4)) fail('SPORTS_GRID should be 3 × 4');
        let n = 0;
        LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
          const key = QUIZ_KEY[bank + '.' + i];
          if (!key) return fail(bank + '[' + i + ']: no answer key in the config — add one');
          n++;
          const want = String(key.ans(D, L));
          if (q.opts[q.ans] !== want) fail(bank + '[' + i + '] ' + L + ': the table says "' + want + '", marked answer is "' + q.opts[q.ans] + '"');
          if (q.opts.filter(o => o === want).length !== 1) fail(bank + '[' + i + '] ' + L + ': the right answer "' + want + '" appears ' + q.opts.filter(o => o === want).length + ' times');
          key.mention(L).forEach(w => { if (q.stem.toLowerCase().indexOf(w.toLowerCase()) < 0) fail(bank + '[' + i + '] ' + L + ': the stem does not mention "' + w + '"'); });
          if (nums(q.why).indexOf(+want) < 0 && /^\d+$/.test(want)) fail(bank + '[' + i + '] ' + L + ': the explanation never says ' + want);
        })));
        if (n !== 24) fail('answer-keyed ' + n + ' quiz questions — expected 12 per language');
        /* 範例 4：四個問題實際呼叫，和自己的答案比 */
        const rs = G0.map(sum), cs = [0, 1, 2, 3].map(c => colSum(G0, c));
        const own = [ { b:Math.max(...rs), rows:[argmax(rs)], cols:[] }, { b:Math.min(...cs), rows:[], cols:[argmin(cs)] },
          { b:rs[2] - rs[0], rows:[0, 2], cols:[] }, { b:G0[0][0] + G0[1][0], rows:[0, 1], cols:[0] } ];
        LANGS.forEach(L => {
          if (!Array.isArray(I18N[L].q4) || I18N[L].q4.length !== 4) return fail('q4 ' + L + ' should have 4 questions');
          I18N[L].q4.forEach((q, i) => {
            let r;
            try { r = q.ans(G0); } catch (e){ return fail('q4[' + i + '] ' + L + ' threw: ' + e.message); }
            const b = (String(r.text).match(/<b>(\d+)<\/b>/) || [])[1];
            if (+b !== own[i].b) fail('q4[' + i + '] ' + L + ': the bold answer is ' + b + ', the table says ' + own[i].b);
            if (r.rows.join() !== own[i].rows.join() || r.cols.join() !== own[i].cols.join()) fail('q4[' + i + '] ' + L + ': highlights rows ' + r.rows + ' cols ' + r.cols);
            scanEquations(r.text).forEach(e => { if (e.bad) fail('q4[' + i + '] ' + L + ': "' + e.text + '" ' + e.bad); });
          });
          const line = I18N[L].s3CheckLine(rs.join(' + '), sum(rs), cs.join(' + '), sum(cs));
          const eq = scanEquations(line);
          if (eq.length !== 2 || eq.some(e => e.bad)) fail('s3CheckLine ' + L + ': ' + line);
          if (sum(rs) !== sum(cs)) fail('the row totals and column totals of SPORTS_GRID do not agree');
        });
        /* 範例 5：紀錄只有那三個地點 */
        if (D.RAW_VOTES.some(v => D.TALLY_KEYS.indexOf(v) < 0)) fail('RAW_VOTES has a place that is not a row of the table');
      }

      /* --- 3. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['pick', 'ruler', 'total', 'sentence', 'tally'];
      if ((D.GAME_ORDER || []).join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the five examples), got ' + D.GAME_ORDER);
      TYPES.forEach(t => {
        if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
        LANGS.forEach(L => {
          if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
          if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
        });
      });
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_PICK', 'GAME_RULER', 'GAME_TOTAL', 'GAME_EQ', 'GAME_TALLY', 'GAME_GRIDS'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      /* 名字要兩兩不同（不然「找三年二班那一列」對不上唯一的一列） */
      LANGS.forEach(L => {
        const d = I18N[L];
        [['classNames', D.CLASS_KEYS], ['petNames', D.PET_KEYS], ['fruitNames', D.FRUIT_KEYS], ['gTallyNames', D.TALLY_KEYS]].forEach(([k, keys]) => {
          const v = keys.map(x => d[k] && d[k][x]);
          if (v.some(x => typeof x !== 'string' || !x) || new Set(v).size !== v.length) fail(k + ' ' + L + ' are missing or not all different: ' + v.join('/'));
        });
        ['gPetTitle', 'gPetCorner', 'gPickTitle', 'gGrand', 'gEqBtn', 'gEqInput', 'gEqEmpty', 'gEqOpDiff', 'gEqOpSum', 'gRowFinger', 'gColFinger', 'gMinus', 'gClear'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail(k + ' missing in ' + L); });
      });
      if (I18N.zh.gEqOpDiff.indexOf('相差') < 0 || I18N.zh.gEqOpSum.indexOf('一共') < 0) fail('the operation reasons must name the key words 相差 / 一共');

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a fruit row (' + D.PICK.rh + ')', D.PICK.rh);
      tooSmall('a finger (' + D.RULER.finger + ')', D.RULER.finger);
      tooSmall('a total card (' + D.TOTAL.card + ')', D.TOTAL.card);
      tooSmall('a table box you drag in round 4 (' + (D.EQ.col - 4) + ' wide)', D.EQ.col - 4);
      tooSmall('a table box you drag in round 4 (' + D.EQ.rh + ' high)', D.EQ.rh);
      tooSmall('a vote (' + D.TALLY.ch + ' high)', D.TALLY.ch);
      [D.RULER.finger, D.TOTAL.card, D.TALLY.ch].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('sentence', /addPiece\(B, \{ w:Q\.col - 4, h:Q\.rh, cx:eqColX\(c\), cy:eqRowY\(r\),/, 'the table boxes you drag are not (col − 4) × rh at eqColX/eqRowY');
      need('sentence', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:cx, cy:cy, text:op === '\+' \? '＋' : '−'/, 'the + / − cards are not GPICK × GPICK');
      need('total', /addPiece\(B, \{ w:T\.card, h:T\.card, cx:cx, cy:cy, text:String\(v\), cls:'gcard'/, 'the total cards are not TOTAL.card × TOTAL.card');
      need('tally', /addPiece\(B, \{ w:T\.cw, h:T\.ch, cx:p\.x, cy:p\.y,/, 'the votes are not TALLY.cw × TALLY.ch at tallyChipXY()');
      need('pick', /addTap\(B, P\.x0, pickRowY\(i\), P\.x1 - P\.x0, P\.rh, 'gtrow',/, 'a fruit row is not tapped as a whole PICK.rh-high row at pickRowY()');

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
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
      }
      /* 每一個框裡面的點都判給那一框；兩框的放寬區重疊的地方判給比較近的那一框（不論它在陣列裡排第幾） */
      const sweepBoxes = (list, pad, what) => {
        if (!nearestOpen) return;
        let bad = 0, overlapPts = 0;
        list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 2){ const g = nearestOpen(list, { x, y }, pad); if (g !== b) bad++; } });
        if (bad) fail('nearestOpen() ' + what + ': ' + bad + ' points inside a box are given to another box (or none)');
        for (let x = 0; x <= W; x += 1) for (let y = 0; y <= 400; y += 1){
          const inZone = list.filter(b => Math.abs(x - b.cx) <= b.hw + pad && Math.abs(y - b.cy) <= b.hh + pad);
          if (inZone.length < 2) continue;
          overlapPts++;
          const dist = b => Math.hypot(Math.max(0, Math.abs(x - b.cx) - b.hw), Math.max(0, Math.abs(y - b.cy) - b.hh));
          const best = inZone.reduce((a, b) => dist(b) < dist(a) - 1e-9 ? b : a);
          /* 一樣近：比到中心的距離；連那個也一樣（剛好在兩格正中間）→ 不收，不可以照陣列順序挑一格 */
          const dc = b => Math.hypot(x - b.cx, y - b.cy);
          const ties = inZone.filter(b => Math.abs(dist(b) - dist(best)) < 1e-9);
          const tbest = ties.reduce((a, b) => dc(b) < dc(a) - 1e-9 ? b : a);
          const exact = ties.filter(b => Math.abs(dc(b) - dc(tbest)) < 1e-9).length > 1;
          const got = nearestOpen(list, { x, y }, pad);
          if (exact){ if (got !== null){ fail('nearestOpen() ' + what + ': (' + x + ', ' + y + ') is an exact tie between two boxes but is given to box ' + list.indexOf(got) + ' (array order) — it should bounce'); return overlapPts; } }
          else if (got !== tbest){ fail('nearestOpen() ' + what + ': (' + x + ', ' + y + ') is nearer to box ' + list.indexOf(tbest) + ' but goes elsewhere'); return overlapPts; }
        }
        return overlapPts;
      };
      if (nearestOpen){
        const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
        const r0 = nearestOpen(two, { x:140, y:100 }, 6);
        if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
        const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
        if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
        if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        const pair = [ { id:0, cx:100, cy:100, hw:20, hh:20, done:false }, { id:1, cx:144, cy:100, hw:20, hh:20, done:false } ];
        if (nearestOpen(pair, { x:122, y:100 }, 6) !== null) fail('nearestOpen(): a drop exactly between two boxes (an exact tie) is given to one of them by array order — it should bounce');
      }

      /* --- 第 1 關：點一點（範例 1：一維表格，先看標題與單位，再一列一列比數字） --- */
      {
        const P = D.PICK;
        D.GAME_PICK.forEach((e, i) => {
          const w = 'GAME_PICK[' + i + ']';
          if (!Array.isArray(e.vals) || e.vals.length !== 5 || e.vals.some(v => !isInt(v) || v < 1 || v > 30)) return fail(w + ': vals should be 5 whole numbers 1~30 (one per fruit)');
          if (e.dir !== 'more' && e.dir !== 'less') return fail(w + ': dir should be more / less');
          if (new Set(e.vals).size !== 5) fail(w + ': two fruits sold the same');
          const more = e.dir === 'more', fits = e.vals.map(v => more ? v > e.n : v < e.n), k = fits.filter(Boolean).length;
          if (e.vals.filter(v => v === e.n).length !== 1) fail(w + ': exactly one fruit should sell exactly ' + e.n + ' (the "the same is not more" case)');
          if (k < 2 || k > 3) fail(w + ': ' + k + ' fruits fit — should be 2~3');
          if (5 - k < 2) fail(w + ': fewer than 2 wrong rows');
          /* 照遊戲的規則從頭玩：只有符合的列收，收過的不再算；收滿 k 列就過關，而且收到的剛好是符合的那幾列 */
          const got = [];
          e.vals.forEach((v, j) => { if (more ? v > e.n : v < e.n) got.push(j); });
          if (got.length !== k) fail(w + ': the game rule finds ' + got.length + ' rows, not ' + k);
          LANGS.forEach(L => {
            const d = I18N[L], names = D.FRUIT_KEYS.map(f => d.fruitNames[f]);
            for (let f = 0; f <= k; f++) seq(w + ' gPickNow ' + L, d.gPickNow(more, e.n, f, k), [e.n, f, k]);
            e.vals.forEach((v, j) => {
              if (fits[j]) return;
              if (v === e.n) seq(w + ' gPickEq ' + L, d.gPickEq(names[j], v, more), [v, v]);
              else seq(w + ' gPickNot ' + L, d.gPickNot(names[j], v, e.n, more), [v, e.n]);
            });
            const list = got.map(j => [names[j], e.vals[j]]);
            seq(w + ' gPickDone ' + L, d.gPickDone(more, e.n, list), [e.n].concat(got.map(j => e.vals[j])));
            const word = L === 'zh' ? (more ? '多' : '少') : (more ? 'more' : 'fewer');
            [d.gPickNow(more, e.n, 0, k), d.gPickDone(more, e.n, list)].forEach(t => { if (t.toLowerCase().indexOf(word) < 0) fail(w + ' ' + L + ': "' + t + '" does not say "' + word + '"'); });
            got.forEach((j, f) => seq(w + ' gPick2 ' + L, d.gPick2(k - f, names[j]), [k - f]));
          });
        });
        LANGS.forEach(L => { if (!(L === 'zh' ? /箱/ : /[Bb]ox/).test(I18N[L].fruitValueLabel)) fail('round 1: the value header ' + L + ' does not show the unit'); });
        for (let r = 0; r < 5; r++) if (!near(D.pickRowY(r), P.ry + r * P.rh)) fail('pickRowY(' + r + ') should be ' + (P.ry + r * P.rh));
        const rows = [0, 1, 2, 3, 4].map(r => ({ x:P.x0, y:D.pickRowY(r), w:P.x1 - P.x0, h:P.rh }));
        rows.forEach((o, r) => inside(o, 'pick: row ' + r, W, D.PICK_H));
        noHits(rows, 'pick: rows');
        if (P.hy + P.hh > P.ry) fail('pick: the header overlaps the first row');
        if (P.th > P.hy) fail('pick: the title overlaps the header');
        need('pick', /if \(!fits\(v\)\)\{ roundMiss\(v === e\.n \? d\.gPickEq\(name, v, more\) : d\.gPickNot\(name, v, e\.n, more\)\); return; \}/, 'a row that does not fit is accepted (or has no reason)');
        need('pick', /var fits = function\(v\)\{ return more \? v > e\.n : v < e\.n; \};/, 'the rule is not "more than n" / "fewer than n" (strictly)');
        need('pick', /if \(done\[i\]\) return;/, 'a found row can be counted twice');
        need('pick', /if \(found === k\)\{/, 'the round is not solved exactly when every fitting row is found');
        need('pick', /addZone\(B, 0, 0, 300, P\.th, 'gtitle', d\.gPickTitle\);/, 'the table has no title (example 1: read the title first)');
        need('pick', /d\.fruitValueLabel\);/, 'the table has no value header with its unit');
      }

      /* 二維表格：三個班 × 四種寵物 */
      D.GAME_GRIDS.forEach((g, i) => {
        if (!Array.isArray(g) || g.length !== 3 || g.some(r => !Array.isArray(r) || r.length !== 4 || r.some(v => !isInt(v) || v < 2 || v > 9))) fail('GAME_GRIDS[' + i + '] should be 3 × 4 of 2~9');
      });

      /* --- 第 2 關：移手指（範例 2：同時找到列和欄） --- */
      {
        const R = D.RULER, bottom = R.ry + 3 * R.rh, x1 = R.cx0 + R.cw + 4 * R.col;
        if (x1 > W) fail('ruler: the table is ' + x1 + ' wide — over the board');
        for (let c = 0; c < 4; c++) if (!near(D.rulerColX(c), R.cx0 + R.cw + c * R.col + R.col / 2)) fail('rulerColX(' + c + ') is wrong');
        for (let r = 0; r < 3; r++) if (!near(D.rulerRowY(r), R.ry + r * R.rh + R.rh / 2)) fail('rulerRowY(' + r + ') is wrong');
        const rowsB = [0, 1, 2].map(r => ({ r, cx:150, cy:D.rulerRowY(r), hw:150, hh:R.rh / 2, done:false }));
        const colsB = [0, 1, 2, 3].map(c => ({ c, cx:D.rulerColX(c), cy:(R.gy + bottom) / 2, hw:R.col / 2, hh:(bottom - R.gy) / 2, done:false }));
        const ov1 = sweepBoxes(rowsB, 6, 'ruler rows'), ov2 = sweepBoxes(colsB, 6, 'ruler columns');
        if (nearestOpen && !(ov1 > 0 && ov2 > 0)) fail('ruler: neighbouring rows / columns no longer have overlapping snap zones — the nearest-slot rule is not exercised');
        const rowHome = sq(R.rowX, R.homeY, R.finger), colHome = sq(R.cx0 + R.cw / 2, R.gy + R.gh / 2, R.finger);
        inside(rowHome, 'ruler: 👉 at home', W, D.RULER_H); inside(colHome, 'ruler: 👇 at home', W, D.RULER_H);
        if (rowHome.y < bottom + 2) fail('ruler: 👉 at home touches the table');
        if (rowsB.some(b => Math.abs(R.homeY - b.cy) <= b.hh + 6)) fail('ruler: 👉 at home is inside a row’s snap zone');
        if (colsB.some(b => Math.abs(colHome.x + R.finger / 2 - b.cx) <= b.hw + 6)) fail('ruler: 👇 at home is inside a column’s snap zone');
        if (colHome.y + colHome.h > R.hy + 4 || colHome.y < R.th - 2) fail('ruler: 👇 at home is not in the lane above the table');
        if (R.rowX > R.cx0 + 18) fail('ruler: 👉 covers the class names');
        if (R.gy + R.gh > R.hy) fail('ruler: the 👇 lane overlaps the header');
        D.GAME_RULER.forEach((e, i) => {
          const w = 'GAME_RULER[' + i + ']';
          if (!D.GAME_GRIDS[e.g] || !(e.r >= 0 && e.r < 3) || !(e.c >= 0 && e.c < 4)) return fail(w + ' is out of range');
          if (e.r === 0 && e.c === 0) fail(w + ': row 0 × column 0 — the nearer snap zone is always first; the e2e cannot test nearest-slot here');
          const v = D.GAME_GRIDS[e.g][e.r][e.c];
          LANGS.forEach(L => {
            const d = I18N[L], cls = d.classNames[D.CLASS_KEYS[e.r]], pet = d.petNames[D.PET_KEYS[e.c]];
            seq(w + ' gRulerNow ' + L, d.gRulerNow(cls, pet, null), N(cls, pet));
            seq(w + ' gRulerNow ' + L, d.gRulerNow(cls, pet, v), N(cls, pet, v));
            for (let r = 0; r < 3; r++) if (r !== e.r){ const got = d.classNames[D.CLASS_KEYS[r]]; seq(w + ' gRulerRow ' + L, d.gRulerRow(got, cls), N(got, cls)); }
            for (let c = 0; c < 4; c++) if (c !== e.c){ const got = d.petNames[D.PET_KEYS[c]]; seq(w + ' gRulerCol ' + L, d.gRulerCol(got, pet), N(got, pet)); }
            seq(w + ' gRulerDone ' + L, d.gRulerDone(cls, pet, v), N(cls, pet, v));
            seq(w + ' gRuler2 ' + L, d.gRuler2(cls, e.r + 1, pet, e.c + 1), N(cls, e.r + 1, pet, e.c + 1));
          });
        });
        need('ruler', /var e = pick\(GAME_RULER\), G = GAME_GRIDS\[e\.g\], R = RULER, v = G\[e\.r\]\[e\.c\]/, 'the answer is not the box at row e.r, column e.c');
        need('ruler', /text:'👉', cls:'gfinger', axis:'y'/, '👉 does not move only up and down');
        need('ruler', /text:'👇', cls:'gfinger', axis:'x'/, '👇 does not move only left and right');
        need('ruler', /var b = nearestOpen\(rows, pt, 6\);\s*if \(!b\) return false;\s*if \(b\.r !== e\.r\)\{ roundMiss\(d\.gRulerRow\(d\.classNames\[CLASS_KEYS\[b\.r\]\], cls\)\); return false; \}/, 'a wrong row is accepted (or has no reason)');
        need('ruler', /var c = nearestOpen\(cols, pt, 6\);\s*if \(!c\) return false;\s*if \(c\.c !== e\.c\)\{ roundMiss\(d\.gRulerCol\(d\.petNames\[PET_KEYS\[c\.c\]\], pet\)\); return false; \}/, 'a wrong column is accepted (or has no reason)');
        need('ruler', /if \(P\.data\.kind === 'row'\)\{/, 'the fingers are not told apart');
        need('ruler', /if \(got\.row && got\.col\)\{\s*cells\[e\.r\]\[e\.c\]\.classList\.add\('ghit'\);/, 'the round is not solved exactly when both fingers are placed (or the crossing box does not light up)');
        need('ruler', /var rows = \[0, 1, 2\]\.map\(function\(r\)\{ return \{ r:r, cx:150, cy:rulerRowY\(r\), hw:150, hh:R\.rh \/ 2, done:false \}; \}\);/, 'the row snap boxes are not what this config sweeps');
        need('ruler', /var cols = \[0, 1, 2, 3\]\.map\(function\(c\)\{ return \{ c:c, cx:rulerColX\(c\), cy:\(R\.gy \+ bottom\) \/ 2, hw:R\.col \/ 2, hh:\(bottom - R\.gy\) \/ 2, done:false \}; \}\);/, 'the column snap boxes are not what this config sweeps');
        need('ruler', /cx:R\.rowX, cy:R\.homeY,/, '👉 is not drawn at RULER.rowX / RULER.homeY');
        need('ruler', /cx:R\.cx0 \+ R\.cw \/ 2, cy:R\.gy \+ R\.gh \/ 2,/, '👇 is not drawn above the corner box');
        need('ruler', /line\.textContent = d\.gRulerNow\(cls, pet, v\);\s*roundSolved\(d\.gRulerDone\(cls, pet, v\)\);/, 'the answer is not written on the line when solved');
        if (/d\.gRulerNow\(cls, pet, v\)/.test(B.ruler) && !/var line = trailLine\(d\.gRulerNow\(cls, pet, null\)\);/.test(B.ruler)) fail('ruler: the line shows the answer before the fingers are placed');
      }

      /* --- 第 3 關：補總計（範例 3：列總計、行總計、總計兩種加法一樣） --- */
      {
        const T = D.TOTAL, bottom = T.ry + 4 * T.rh, x1 = T.cx0 + T.cw + 3 * T.col + T.tw;
        if (x1 > W) fail('total: the table is ' + x1 + ' wide — over the board');
        for (let c = 0; c < 3; c++) if (!near(D.totalColX(c), T.cx0 + T.cw + c * T.col + T.col / 2)) fail('totalColX(' + c + ') is wrong');
        if (!near(D.totalColX(3), T.cx0 + T.cw + 3 * T.col + T.tw / 2)) fail('totalColX(3) is wrong');
        for (let r = 0; r <= 3; r++) if (!near(D.totalRowY(r), T.ry + r * T.rh + T.rh / 2)) fail('totalRowY(' + r + ') is wrong');
        if (T.trayY - T.card / 2 < bottom + 6) fail('total: the card tray reaches the table');
        if (T.trayY + T.card / 2 > D.TOTAL_H) fail('total: the card tray is below the board');
        if (T.step < T.card + 4) fail('total: cards ' + T.step + ' apart touch (card ' + T.card + ')');
        const x0 = (W - 4 * T.step) / 2;
        const cardsR = [0, 1, 2, 3, 4].map(k => sq(x0 + k * T.step, T.trayY, T.card));
        cardsR.forEach((o, k) => inside(o, 'total: card ' + k, W, D.TOTAL_H));
        let anyOverlap = 0;
        D.GAME_TOTAL.forEach((e, i) => {
          const w = 'GAME_TOTAL[' + i + ']', g = e.grid;
          if (!Array.isArray(g) || g.length !== 3 || g.some(r => !Array.isArray(r) || r.length !== 3 || r.some(v => !isInt(v) || v < 2 || v > 9))) return fail(w + ': grid should be 3 × 3 of 2~9');
          if (!(e.br >= 0 && e.br < 3 && e.bc >= 0 && e.bc < 3)) return fail(w + ': br / bc out of range');
          const RS = g.map(sum), CS = [0, 1, 2].map(c => colSum(g, c)), GS = sum(RS);
          if (sum(CS) !== GS) fail(w + ': the column totals do not add up to the grand total');
          const need3 = [RS[e.br], CS[e.bc], GS], cards = need3.concat(e.dec);
          if (!Array.isArray(e.dec) || e.dec.length !== 2) return fail(w + ': dec should be two decoys');
          if (new Set(cards).size !== 5) fail(w + ': the five cards ' + cards.join() + ' are not all different (a card could fit two boxes)');
          /* 誘答是「常見的錯」，不是隨手的數：dec[0] ＝ 這一列漏加一格，dec[1] ＝ 總計漏加一列 */
          if (!g[e.br].some(v => RS[e.br] - v === e.dec[0])) fail(w + ': dec[0] ' + e.dec[0] + ' is not the row total ' + RS[e.br] + ' with one box left out');
          if (!RS.some(v => GS - v === e.dec[1])) fail(w + ': dec[1] ' + e.dec[1] + ' is not the grand total ' + GS + ' with one row left out');
          /* 照遊戲的規則：卡片只收進它等於的那一格 → 每一格剛好一張卡收、每一張正解卡剛好一格收 → 一定解得完，而且解完是對的 */
          need3.forEach((v, k) => { const ok = cards.filter(c => c === v).length; if (ok !== 1) fail(w + ': blank ' + k + ' accepts ' + ok + ' cards'); });
          const blanks = [
            { cx:D.totalColX(3), cy:D.totalRowY(e.br), hw:T.tw / 2 - 2, hh:T.rh / 2 - 2, done:false },
            { cx:D.totalColX(e.bc), cy:D.totalRowY(3), hw:T.col / 2 - 2, hh:T.rh / 2 - 2, done:false },
            { cx:D.totalColX(3), cy:D.totalRowY(3), hw:T.tw / 2 - 2, hh:T.rh / 2 - 2, done:false }
          ];
          const ov = sweepBoxes(blanks, 4, w + ' blanks');
          if (ov) anyOverlap++;
          else if (nearestOpen) fail(w + ': the grand total box has no empty neighbour — the nearest-slot rule is never exercised in this table (put the blank row or column total next to it)');
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let f = 0; f <= 3; f++) seq(w + ' gTotalNow ' + L, d.gTotalNow(f, 3), [f, 3]);
            const cls = d.classNames[D.CLASS_KEYS[e.br]], pet = d.petNames[D.PET_KEYS[e.bc]], colCells = g.map(r => r[e.bc]);
            cards.forEach(v => {
              if (v !== RS[e.br]) seq(w + ' gTotRow ' + L, d.gTotRow(cls, g[e.br], v), N(cls, g[e.br], v));
              if (v !== CS[e.bc]) seq(w + ' gTotCol ' + L, d.gTotCol(pet, colCells, v), N(pet, colCells, v));
              if (v !== GS) seq(w + ' gTotGrand ' + L, d.gTotGrand(v), [v]);
            });
            seq(w + ' gTotalDone ' + L, d.gTotalDone(RS, CS, GS), RS.concat([GS], CS, [GS, GS]));
            seq(w + ' gTot2Row ' + L, d.gTot2Row(cls, g[e.br]), N(cls, g[e.br]));
            seq(w + ' gTot2Col ' + L, d.gTot2Col(pet, colCells), N(pet, colCells));
            seq(w + ' gTot2Grand ' + L, d.gTot2Grand(RS), RS);
          });
        });
        if (nearestOpen && !anyOverlap) fail('total: no table has neighbouring empty boxes');
        need('total', /var RS = g\.map\(function\(row\)\{ return sum\(row\); \}\), CS = \[0, 1, 2\]\.map\(function\(c\)\{ return colSum\(g, c\); \}\), GS = gridSum\(g\);/, 'the totals are not computed from the drawn grid');
        need('total', /renderTray\(B, \[RS\[e\.br\], CS\[e\.bc\], GS\]\.concat\(e\.dec\), T\.trayY,/, 'the cards are not the three answers plus the two decoys');
        need('total', /if \(P\.data\.v !== s\.v\)\{/, 'a card that does not equal its box is accepted');
        need('total', /if \(r === e\.br\) blank\('row', r, RS\[r\], 3, r\);\s*else addCell\(B, x3, T\.ry \+ r \* T\.rh, T\.tw, T\.rh, 'gtot', RS\[r\]\);/, 'the row totals are not drawn (or the blank is not the row total)');
        need('total', /if \(c === e\.bc\) blank\('col', c, CS\[c\], c, 3\);\s*else addCell\(B, T\.cx0 \+ T\.cw \+ c \* T\.col, T\.ry \+ 3 \* T\.rh, T\.col, T\.rh, 'gtot', CS\[c\]\);/, 'the column totals are not drawn (or the blank is not the column total)');
        need('total', /blank\('grand', 0, GS, 3, 3\);/, 'the grand total is not a blank');
        need('total', /blanks\.push\(\{ kind:kind, i:i, v:v, cx:totalColX\(c\), cy:totalRowY\(r\), hw:w \/ 2 - 2, hh:T\.rh \/ 2 - 2, done:false, el:z \}\);/, 'the blank boxes are not what this config sweeps');
        need('total', /var s = nearestOpen\(blanks, pt, 4\);/, 'a box is not picked as the nearest open box');
        need('total', /if \(filled === 3\) roundSolved\(d\.gTotalDone\(RS, CS, GS\)\);/, 'the round is not solved exactly when the three boxes are filled');
      }

      /* --- 第 4 關：排算式（範例 4：相差用減法、一共用加法） --- */
      {
        const Q = D.EQ, bottom = Q.ry + 3 * Q.rh, x1 = Q.cx0 + Q.cw + 4 * Q.col;
        if (x1 > W) fail('sentence: the table is ' + x1 + ' wide — over the board');
        for (let c = 0; c < 4; c++) if (!near(D.eqColX(c), Q.cx0 + Q.cw + c * Q.col + Q.col / 2)) fail('eqColX(' + c + ') is wrong');
        for (let r = 0; r < 3; r++) if (!near(D.eqRowY(r), Q.ry + r * Q.rh + Q.rh / 2)) fail('eqRowY(' + r + ') is wrong');
        const parts = [sq(Q.xa, Q.y, Q.slot), sq(Q.xop, Q.y, Q.slot), sq(Q.xb, Q.y, Q.slot), sq(Q.xeq, Q.y, 32, Q.slot), sq(Q.xres, Q.y, 56, Q.slot)];
        parts.forEach((o, k) => inside(o, 'sentence: part ' + k + ' of the number sentence', W, D.EQ_H)); noHits(parts, 'sentence: number sentence parts');
        if (Q.y - Q.slot / 2 < bottom + 6) fail('sentence: the number sentence reaches the table');
        const ops = [0, 1].map(k => sq((W - Q.opStep) / 2 + k * Q.opStep, Q.opY, D.GPICK));
        ops.forEach((o, k) => inside(o, 'sentence: sign card ' + k, W, D.EQ_H)); noHits(ops, 'sentence: sign cards');
        if (Q.opY - D.GPICK / 2 < Q.y + Q.slot / 2 + 6) fail('sentence: the sign cards reach the number sentence');
        /* 兩個數字空格不可以近到放寬區重疊（＋／− 放的是另一個空格，不算） */
        if (Q.xb - Q.xa < Q.slot + 12) fail('sentence: the two number boxes are closer than their drop pads');
        D.GAME_EQ.forEach((e, i) => {
          const w = 'GAME_EQ[' + i + ']', g = D.GAME_GRIDS[e.g];
          if (!g || (e.kind !== 'diff' && e.kind !== 'sum')) return fail(w + ' is malformed');
          const ok2 = p => Array.isArray(p) && p[0] >= 0 && p[0] < 3 && p[1] >= 0 && p[1] < 4;
          if (!ok2(e.a) || !ok2(e.b)) return fail(w + ': a / b out of range');
          const sameCol = e.a[1] === e.b[1], sameRow = e.a[0] === e.b[0];
          if (sameCol === sameRow) return fail(w + ': the two boxes should share exactly one of row / column');
          const va = g[e.a[0]][e.a[1]], vb = g[e.b[0]][e.b[1]], big = Math.max(va, vb), small = Math.min(va, vb);
          const ans = e.kind === 'diff' ? big - small : va + vb;
          if (va === vb) fail(w + ': the two boxes are equal');
          if (e.kind === 'diff' && ans < 2) fail(w + ': the difference is ' + ans + ' (English says "students"; and 1 is too easy to guess)');
          LANGS.forEach(L => {
            const d = I18N[L], ca = d.classNames[D.CLASS_KEYS[e.a[0]]], cb = d.classNames[D.CLASS_KEYS[e.b[0]]], pa = d.petNames[D.PET_KEYS[e.a[1]]], pb = d.petNames[D.PET_KEYS[e.b[1]]];
            const ask = e.kind === 'diff' ? (sameCol ? d.gEqDiffCol(ca, cb, pa) : d.gEqDiffRow(ca, pa, pb)) : (sameCol ? d.gEqSumCol(ca, cb, pa) : d.gEqSumRow(ca, pa, pb));
            seq(w + ' question ' + L, ask, sameCol ? N(ca, cb, pa) : N(ca, pa, pb));
            const key = L === 'zh' ? (e.kind === 'diff' ? '相差' : '一共') : (e.kind === 'diff' ? 'difference' : 'in total');
            if (ask.indexOf(key) < 0) fail(w + ' ' + L + ': the question does not say "' + key + '": ' + ask);
            [ca, cb].forEach(n => { if (ask.indexOf(n) < 0) fail(w + ' ' + L + ': the question does not name ' + n); });
            [pa, pb].forEach(n => { if (ask.toLowerCase().indexOf(n.toLowerCase()) < 0) fail(w + ' ' + L + ': the question does not name ' + n); });
            for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++){
              if ((r === e.a[0] && c === e.a[1]) || (r === e.b[0] && c === e.b[1])) continue;
              const cl = d.classNames[D.CLASS_KEYS[r]], pt = d.petNames[D.PET_KEYS[c]];
              seq(w + ' gEqCell ' + L, d.gEqCell(cl, pt, g[r][c]), N(g[r][c], cl, pt));
            }
            seq(w + ' gEqOrder ' + L, d.gEqOrder(big, small), [big, small]);
            const op = e.kind === 'diff' ? '−' : '+';
            for (let x = 0; x <= 40; x++) if (x !== ans) seq(w + ' gEqWrong ' + L, d.gEqWrong(big, op, small, x), [big, small, x]);
            seq(w + ' gEqDone ' + L, d.gEqDone(big, op, small, ans), [big, small, ans, ans]);
            if (e.kind === 'sum') seq(w + ' gEqDone (other order) ' + L, d.gEqDone(small, op, big, ans), [small, big, ans, ans]);
            if (d.gEqDone(big, op, small, ans).indexOf(L === 'zh' ? (e.kind === 'diff' ? '相差' : '一共') : (e.kind === 'diff' ? 'difference' : 'in total')) < 0) fail(w + ' ' + L + ': gEqDone does not say what was asked');
            seq(w + ' gEq2 ' + L, d.gEq2(ca, pa, va, cb, pb, vb), N(ca, pa, va, cb, pb, vb));
          });
        });
        need('sentence', /var va = g\[e\.a\[0\]\]\[e\.a\[1\]\], vb = g\[e\.b\[0\]\]\[e\.b\[1\]\], big = Math\.max\(va, vb\), small = Math\.min\(va, vb\);/, 'the two boxes are not read from the grid');
        need('sentence', /if \(\(P\.data\.op === '−'\) !== diff\)\{ roundMiss\(diff \? d\.gEqOpDiff : d\.gEqOpSum\); return false; \}/, 'a wrong sign is accepted');
        need('sentence', /if \(!isA && !isB\)\{ roundMiss\(d\.gEqCell\(/, 'a box the question does not ask about is accepted');
        need('sentence', /var isA = P\.data\.r === e\.a\[0\] && P\.data\.c === e\.a\[1\], isB = P\.data\.r === e\.b\[0\] && P\.data\.c === e\.b\[1\];/, 'a box is matched by its value, not by its row and column');
        need('sentence', /if \(diff && P\.data\.v !== \(s\.k === 'a' \? big : small\)\)\{ roundMiss\(d\.gEqOrder\(big, small\)\); return false; \}/, 'a difference can be written smaller − bigger');
        need('sentence', /var o = nearestOpen\(\[opSlot\], pt, 6\);/, 'the sign does not go into the ○ box');
        need('sentence', /var h = Q\.slot \/ 2;\s*var slots = \[ \{ k:'a', cx:Q\.xa, cy:Q\.y, hw:h, hh:h, done:false, v:null \}, \{ k:'b', cx:Q\.xb, cy:Q\.y, hw:h, hh:h, done:false, v:null \} \];\s*var opSlot = \{ k:'op', cx:Q\.xop, cy:Q\.y, hw:h, hh:h, done:false, v:null \};/, 'the □ ○ □ drop boxes are not what this config sweeps');
        sweepBoxes([ { cx:Q.xa, cy:Q.y, hw:Q.slot / 2, hh:Q.slot / 2, done:false }, { cx:Q.xb, cy:Q.y, hw:Q.slot / 2, hh:Q.slot / 2, done:false } ], 6, 'sentence number boxes');
        need('sentence', /var s = nearestOpen\(slots, pt, 6\);/, 'a number does not go into a □ box');
        need('sentence', /if \(ready\(\)\)\{ inp\.disabled = false; btn\.disabled = false; \}/, 'the answer box opens before the sentence is built');
        need('sentence', /inp\.disabled = true;/, 'the answer box is open from the start');
        need('sentence', /if \(gSolved \|\| !ready\(\)\) return;/, 'an answer can be checked before the sentence is built');
        need('sentence', /if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\)\)\{ gMsg\.textContent = d\.gEqEmpty; return; \}/, 'a blank, spaced or leading-0 answer is counted as a mistake or read as a number');
        need('sentence', /var t = inp\.value\.trim\(\);/, 'the answer is not trimmed (or spaces inside are removed)');
        need('sentence', /var want = opSlot\.v === '\+' \? slots\[0\]\.v \+ slots\[1\]\.v : slots\[0\]\.v - slots\[1\]\.v, got = \+t;/, 'the answer is not computed from the sentence that was built');
        need('sentence', /if \(got !== want\)\{ roundMiss\(d\.gEqWrong\(/, 'a wrong answer is accepted');
      }

      /* --- 第 5 關：整理票數（範例 5：把紀錄一筆一筆整理成表格） --- */
      {
        const T = D.TALLY, bottom = T.ry + 3 * T.rh;
        for (let r = 0; r < 3; r++) if (!near(D.tallyRowY(r), T.ry + r * T.rh + T.rh / 2)) fail('tallyRowY(' + r + ') is wrong');
        const chips = [];
        for (let k = 0; k < 9; k++){
          const p = D.tallyChipXY(k), m = { x:150 + ((k % 3) - 1) * T.cstep, y:T.cy0 + Math.floor(k / 3) * T.crow };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('tallyChipXY(' + k + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          chips.push(sq(m.x, m.y, T.cw, T.ch));
        }
        chips.forEach((o, k) => inside(o, 'tally: vote ' + k, W, D.TALLY_H)); noHits(chips, 'tally: votes');
        if (T.cy0 - T.ch / 2 < bottom + 6) fail('tally: the votes reach the table');
        const bins = [0, 1, 2].map(r => ({ cx:(T.x0 + T.x1) / 2, cy:D.tallyRowY(r), hw:(T.x1 - T.x0) / 2, hh:T.rh / 2, done:false }));
        if (nearestOpen && !sweepBoxes(bins, 4, 'tally rows')) fail('tally: neighbouring rows have no overlapping snap zones — nearest-slot is not exercised');
        if (bins.some(b => chips.some(c => Math.abs(c.y + c.h / 2 - b.cy) <= b.hh + 4 && Math.abs(c.x + c.w / 2 - b.cx) <= b.hw + 4))) fail('tally: a vote at home is inside a row’s snap zone');
        D.GAME_TALLY.forEach((votes, i) => {
          const w = 'GAME_TALLY[' + i + ']';
          if (!Array.isArray(votes) || votes.length !== 9) return fail(w + ' should be 9 votes (3 rows of 3)');
          if (votes.some(v => D.TALLY_KEYS.indexOf(v) < 0)) return fail(w + ': a vote for a place that is not a row');
          const counts = D.TALLY_KEYS.map(k => votes.filter(v => v === k).length);
          if (counts.some(c => c < 2)) fail(w + ': a place gets fewer than 2 votes (' + counts.join() + ')');
          if (new Set(counts).size === 1) fail(w + ': every place ties');
          /* 照遊戲的規則：票只收進同名的那一列 → 放完時每一列的數字就是那個地點的票數，加起來是 9 */
          if (sum(counts) !== votes.length) fail(w + ': the counts do not add up to the votes');
          if (D.TALLY_KEYS.indexOf(votes[0]) < 0) fail(w + ' is malformed');
          if (!votes.some(v => D.TALLY_KEYS.indexOf(v) >= 1)) fail(w + ': no vote for a lower row — the e2e cannot test nearest-slot');
          LANGS.forEach(L => {
            const d = I18N[L], names = D.TALLY_KEYS.map(k => d.gTallyNames[k]);
            for (let f = 0; f <= 9; f++) seq(w + ' gTallyNow ' + L, d.gTallyNow(f, 9), [f, 9]);
            names.forEach(a => names.forEach(b => { if (a !== b) seq(w + ' gTallyWrong ' + L, d.gTallyWrong(a, b), []); }));
            seq(w + ' gTallyDone ' + L, d.gTallyDone(names.map((n, k) => [n, counts[k]]), 9), counts.concat(counts, [9, 9]));
            for (let f = 1; f <= 9; f++) seq(w + ' gTally2 ' + L, d.gTally2(f), [f]);
          });
        });
        need('tally', /if \(b\.k !== P\.data\.k\)\{ roundMiss\(d\.gTallyWrong\(d\.gTallyNames\[P\.data\.k\], d\.gTallyNames\[b\.k\]\)\); return false; \}/, 'a vote is accepted in the wrong row (or has no reason)');
        need('tally', /counts\[b\.k\]\+\+; b\.num\.textContent = counts\[b\.k\]; placed\+\+;/, 'a vote does not add 1 to its row');
        need('tally', /if \(placed === votes\.length\)\{/, 'the round is not solved exactly when every vote is placed');
        need('tally', /var b = nearestOpen\(bins, pt, 4\);/, 'a row is not picked as the nearest row');
        need('tally', /return \{ k:k, cx:\(T\.x0 \+ T\.x1\) \/ 2, cy:tallyRowY\(i\), hw:\(T\.x1 - T\.x0\) \/ 2, hh:T\.rh \/ 2, done:false, num:num \};/, 'the row snap boxes are not what this config sweeps');
      }
    }
  }
};
module.exports._test = { scanEquations, readTable, N };
