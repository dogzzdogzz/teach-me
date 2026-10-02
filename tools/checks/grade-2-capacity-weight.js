/* grade-2/math/capacity-weight（容量與重量：直接比較與間接比較）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課**不使用任何標準單位**（那是三年級的內容），量出來的東西
   一律是「幾杯」「幾個積木」。所以這份設定檔盯的是三件別處盯不到的事：

   1. **課程教的規則有沒有寫死條件**。「杯數多的容量比較大」只有在
      「同一個杯子」時才成立；「沉下去的那一邊比較重」只有在
      「兩邊各放一個」時才等於「那個東西比較重」。資料只要生出違反前提的組合，
      規則就變成假的 —— diffCup 的「大杯杯數必須比小杯少」就是這一條的化身。
   2. **圖和答案不可以打架**。容器的容量是從畫出來的寬高算出來的
      （cap ＝ w × h ÷ 600），所以「花瓶最高卻不是最多」在畫面上是真的，
      不是嘴巴說說。這裡逐一驗算。
   3. **名稱表要逐字比對**。渲染出來的每一句話都用同一本字典，
      只驗「有沒有填」等於拿字典比字典 —— 所以下面有一份獨立的真值表。 */

/* ---------- 設定檔自己的真值表（和課程檔對齊，但是獨立寫的一份） ---------- */
const AREA_PER_CUP = 600;
const CONTAINER_TRUTH = [
  { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壺',   en:'kettle' },
  { icon:'🏺', w:30,  h:100, cap:5, zh:'花瓶',   en:'vase'   },
  { icon:'🥛', w:40,  h:60,  cap:4, zh:'玻璃杯', en:'glass'  },
  { icon:'🥣', w:100, h:36,  cap:6, zh:'碗',     en:'bowl'   },
  { icon:'🪣', w:90,  h:60,  cap:9, zh:'水桶',   en:'bucket' },
  { icon:'🍶', w:50,  h:60,  cap:5, zh:'瓶子',   en:'bottle' }
];
const ITEM_TRUTH = [
  { icon:'🍓', wt:2,  size:1, zh:'草莓',   en:'strawberry' },
  { icon:'🎈', wt:1,  size:5, zh:'氣球',   en:'balloon'    },
  { icon:'🍎', wt:4,  size:2, zh:'蘋果',   en:'apple'      },
  { icon:'🍊', wt:4,  size:2, zh:'橘子',   en:'orange'     },
  { icon:'🥔', wt:5,  size:2, zh:'馬鈴薯', en:'potato'     },
  { icon:'🧸', wt:6,  size:4, zh:'玩具熊', en:'teddy bear' },
  { icon:'🪨', wt:9,  size:1, zh:'石頭',   en:'stone'      },
  { icon:'🍉', wt:14, size:5, zh:'西瓜',   en:'watermelon' }
];
const BOX_TRUTH = [
  { icon:'🟥', wt:8, zh:'紅箱', en:'red box'    },
  { icon:'🟦', wt:5, zh:'藍箱', en:'blue box'   },
  { icon:'🟨', wt:3, zh:'黃箱', en:'yellow box' },
  { icon:'🟩', wt:6, zh:'綠箱', en:'green box'  }
];
/* 沒有名字的兩個瓶子：只在「杯子不一樣大」那一題出現，別處不會提到它們的杯數。 */
const UNKNOWN_TRUTH = [
  { icon:'🫙', zh:'甲瓶', en:'jar A' },
  { icon:'🍯', zh:'乙瓶', en:'jar B' }
];
/* 速查卡「什麼時候不能只看數字」那兩格的完整句子。只驗有沒有出現「一樣重」
   這種關鍵詞是擋不住極性的 —— 「積木不需要一樣重」也含有那三個字。 */
const REF_RULE = {
  r1c:{ zh:'<strong>每個都一樣重</strong>的積木', en:'blocks that <strong>all weigh the same</strong>' },
  r5b:{ zh:'兩邊用的<strong>不是同一個</strong>杯子', en:'the two sides did not use <strong>the same</strong> cup' },
  r5c:{ zh:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',
        en:'the blocks were <strong>not all the same weight</strong> (same size can still mean different weight)' }
};
const METHOD_TRUTH = {
  zh:[
    '用同一個小杯子分別裝滿，數各是幾杯',
    '看哪一個比較高',
    '一個用大杯、一個用小杯，比杯數',
    '看哪一個比較重',
    '放上天平：沉下去的那一邊比較重，平平的就一樣重',
    '看哪一個比較大',
    '一邊放大積木、一邊放小積木，比個數'
  ],
  en:[
    'fill both with the same small cup and count the cups',
    'look at which one is taller',
    'use a big cup for one and a small cup for the other, then compare the counts',
    'look at which one is heavier',
    'put one on each side of a balance: the lower side is heavier, and a level balance means they weigh the same',
    'look at which one is bigger',
    'put big blocks on one side and small blocks on the other, then compare the counts'
  ]
};

const fCName = (i, lang) => CONTAINER_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + CONTAINER_TRUTH[i][lang];
const fIName = (i, lang) => ITEM_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + ITEM_TRUTH[i][lang];
const fBName = (i, lang) => BOX_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + BOX_TRUTH[i][lang];
const fUName = (i, lang) => UNKNOWN_TRUTH[i].icon + ' ' + UNKNOWN_TRUTH[i][lang];
const fName = (cat, i, lang) =>
  cat === 'C' ? fCName(i, lang) : cat === 'I' ? fIName(i, lang) : cat === 'U' ? fUName(i, lang) : fBName(i, lang);
const fCup = (n, lang) => lang === 'zh' ? (n + ' 杯') : (n + (n === 1 ? ' cup' : ' cups'));
const fBlk = (n, lang) => lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' block' : ' blocks'));
const fPick = (cat, id, lang) => cat === 'I'
  ? (fIName(id, lang) + (lang === 'zh' ? '比較重' : ' is heavier'))
  : (fName(cat, id, lang) + (lang === 'zh' ? '裝得比較多' : ' holds more'));
const fSame = (dom, lang) => lang === 'zh'
  ? (dom === 'cap' ? '兩個一樣多' : '兩個一樣重')
  : (dom === 'cap' ? 'they hold the same' : 'they weigh the same');
const fNo = (dom, lang) => lang === 'zh' ? (dom === 'cap' ? '沒辦法比' : '沒辦法知道') : 'there is no way to tell';
const fRel = (a, b, lang) => lang === 'zh'
  ? (fBName(a, 'zh') + '比 ' + fBName(b, 'zh') + '重')
  : (fBName(a, 'en') + ' is heavier than ' + fBName(b, 'en'));
const fOrd = (cat, ids, lang) => ids.map(id => fName(cat, id, lang)).join(' → ');
/* 線索句子的第二套實作。只驗「有沒有提到第二個東西的名字」的話，
   把「紅箱比藍箱重」寫反成「藍箱比紅箱重」照樣過 —— 孩子照著畫面上的線索
   推理反而會選到錯的選項。所以整句連方向一起逐字比對。 */
const fClueW = (a, b, lang) => lang === 'zh'
  ? (fBName(a, 'zh') + '比 ' + fBName(b, 'zh') + '重')
  : (fBName(a, 'en') + ' is heavier than ' + fBName(b, 'en'));
const fClueC = (a, b, lang) => lang === 'zh'
  ? (fCName(a, 'zh') + '裝滿倒進 ' + fCName(b, 'zh') + '，水滿出來了')
  : ('pouring the full ' + CONTAINER_TRUTH[a].en + ' into ' + fCName(b, 'en') + ' makes the water spill over');

/* 選項物件的去重鍵。這一課最容易搞混的是單位，所以鍵一定要含「種類」——
   只比數字的話，「5 杯」和「5 個積木」會被當成同一個答案。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'pick') return 'pick#' + v.cat + '#' + v.id;
  if (v.u === 'same') return 'same#' + v.dom;
  if (v.u === 'no')   return 'no#' + v.dom;
  if (v.u === 'num')  return 'num#' + v.unit + '#' + v.n;
  if (v.u === 'rel')  return 'rel#' + v.a + '#' + v.b;
  if (v.u === 'ord')  return 'ord#' + v.cat + '#' + (v.ids || []).join(',');
  if (v.u === 'mt')   return 'mt#' + v.id;
  return 'bad';
}
function distinctOpts(d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'option count is ' + (d.opts || []).length;
  const keys = d.opts.map(keyOf);
  for (let i = 0; i < keys.length; i++){
    if (keys[i] === 'bad') return 'option ' + i + ' is not a value object this lesson knows';
    for (let j = i + 1; j < keys.length; j++){
      if (keys[i] === keys[j]) return 'two options are the same answer: ' + keys[i];
    }
  }
  return null;
}
function answerIs(d, want){
  if (!Number.isInteger(d.ans) || d.ans < 0 || d.ans >= d.opts.length) return 'ans ' + d.ans + ' is not a valid option index';
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 選項的集合要「剛剛好」等於這一題該有的那四個。少了這一條，把一個誘答換成
   別題的選項（糖果題冒出「5 籃」的同類問題）形狀還是對的，卻不屬於這一題。 */
function optSetIs(d, wantKeys){
  const got = d.opts.map(keyOf).slice().sort();
  const want = wantKeys.slice().sort();
  if (got.join('|') !== want.join('|')){
    return 'the option set is ' + got.join(' , ') + ' but this question needs ' + want.join(' , ');
  }
  return null;
}
function idxOk(v, len, label){
  if (!Number.isInteger(v) || v < 0 || v >= len) return label + ' index ' + v + ' is outside 0~' + (len - 1);
  return null;
}
/* 容器的容量必須就是畫出來的面積換算的杯數 —— 圖和答案不可以是兩套數字。 */
function capOk(i){
  const c = CONTAINER_TRUTH[i];
  if (c.w * c.h / AREA_PER_CUP !== c.cap) return 'container ' + i + ' cap ' + c.cap + ' does not match its drawn size';
  return null;
}

/* 選項字串的合法集合。有限而且列得完，所以用「是不是集合裡的一員」來驗，
   比正規式嚴格得多 —— 打錯一個字就會被抓到。 */
function legalPicks(cat, lang){
  const len = cat === 'C' ? CONTAINER_TRUTH.length : cat === 'I' ? ITEM_TRUTH.length : UNKNOWN_TRUTH.length;
  const out = [];
  for (let i = 0; i < len; i++) out.push(fPick(cat, i, lang));
  return out;
}
function legalRels(lang){
  const out = [];
  for (let a = 0; a < BOX_TRUTH.length; a++){
    for (let b = 0; b < BOX_TRUTH.length; b++){ if (a !== b) out.push(fRel(a, b, lang)); }
  }
  return out;
}
/* 每個產生器的選項只能長成這幾種樣子。 */
const SHAPE = {
  pourCompare:  ['pickC','sameCap','noCap'],
  balanceTilt:  ['pickI','sameW','noW'],
  sameCup:      ['pickC','sameCap','noCap'],
  diffCup:      ['pickU','sameCap','noCap'],
  blockWeigh:   ['pickI','sameW','noW'],
  cupDiff:      ['numCup'],
  blockDiff:    ['numBlk'],
  transitive:   ['rel','sameW','noW'],
  orderThree:   ['ordC','ordI'],
  howToCompare: ['mt']
};
/* 數字選項的範圍就是「這一課真的看得到的量」：杯數最多 9（容器杯數 4~9），
   積木最多 14（東西的積木數 1~14）。以前放寬到 17／23 是為了容納「兩個相加」
   的誘答，但那個數在這一課根本不存在 —— 誘答要換成範圍內的，不是把範圍放大。 */
const MAX_CUP = 9, MAX_BLK = 14;
const NUM_RANGE = { numCup:[1, MAX_CUP], numBlk:[1, MAX_BLK] };

function shapeMatch(kind, s, lang){
  if (kind === 'pickC') return legalPicks('C', lang).indexOf(s) >= 0;
  if (kind === 'pickI') return legalPicks('I', lang).indexOf(s) >= 0;
  if (kind === 'pickU') return legalPicks('U', lang).indexOf(s) >= 0;
  if (kind === 'sameCap') return s === fSame('cap', lang);
  if (kind === 'sameW') return s === fSame('w', lang);
  if (kind === 'noCap') return s === fNo('cap', lang);
  if (kind === 'noW') return s === fNo('w', lang);
  if (kind === 'rel') return legalRels(lang).indexOf(s) >= 0;
  if (kind === 'mt') return METHOD_TRUTH[lang].indexOf(s) >= 0;
  if (kind === 'numCup') return s === fCup(Number((s.match(/^\d+/) || ['x'])[0]), lang);
  if (kind === 'numBlk') return s === fBlk(Number((s.match(/^\d+/) || ['x'])[0]), lang);
  if (kind === 'ordC' || kind === 'ordI'){
    const cat = kind === 'ordC' ? 'C' : 'I';
    const len = cat === 'C' ? CONTAINER_TRUTH.length : ITEM_TRUTH.length;
    const parts = s.split(' → ');
    if (parts.length !== 3) return false;
    const all = [];
    for (let i = 0; i < len; i++) all.push(fName(cat, i, lang));
    if (parts.some(p => all.indexOf(p) < 0)) return false;
    return new Set(parts).size === 3;
  }
  return false;
}

/* ---------- 小遊戲「比比看大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   倒倒看（範例 1：倒過去看水）、天平（範例 2：沉下去的比較重、大不一定重）、用同一個杯子量（範例 3：杯子要一樣）、
   用一樣的積木秤（範例 4：放到平、積木要一樣）、排排看（範例 3＋4：同一個單位的數字比大小，高／大不一定多）。
   做法照 grade-2-length.js：
   - 每一關的題庫用**設定檔自己的真值表**（CONTAINER_TRUTH／ITEM_TRUTH）重算答案，並要求「只看高矮／大小」一定答錯；
   - 版面與觸控 ≥ 44px 從 index.html 的常數讀（不在這裡另抄一份數字），畫出來的天平盤子位置從 balanceSVG() 的輸出讀；
   - nearestOpen()、roundSolved()、roundMiss()、shuffle() 從原始碼切出來**真的跑**；
   - 每一關的 RENDER 函式本體切出來放進假的 DOM 裡**真的跑**，照遊戲的規則對每一題做每一種動作（每一個放開的位置、
     每一個按鈕、每一張卡進每一格），看頁面自己的程式收不收、說哪一句、畫出什麼（jarSVG／balanceSVG／rowSVG 的輸出逐字比）；
   - 每一句說明逐個比數字也比字（兩種語言、每一題、每一種放錯；誰比較多、「高不代表多」那一句只在該出現的時候出現）。
   已知極限：拖拉、點選、兩根手指、capture 遺失、畫板不跳動、375px 的實際尺寸由
   teaching-workspace/game-harness/g2-capacity-weight 的端對端測試驗。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src, truth){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const bad = t => typeof t !== 'string' || /undefined|NaN|null|\[object/.test(t);
  const seq = (where, text, want) => {
    if (bad(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read [' + want.join() + '], got [' + nums(text).join() + '] — ' + text);
  };
  const has = (where, text, needle) => { if (String(text).indexOf(needle) < 0) fail(where + ': should say "' + needle + '" — ' + text); };
  const hasNot = (where, text, needle) => { if (String(text).indexOf(needle) >= 0) fail(where + ': must not say "' + needle + '" — ' + text); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, Wd, Hd) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd + 1e-9 && o.y + o.h <= Hd + 1e-9)) fail(what + ' is outside the ' + Wd + '×' + Hd + ' board (' + JSON.stringify(o) + ')'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ': ' + i + ' and ' + j + ' overlap'); };
  const pad = (R, p) => ({ x:R.x - p, y:R.y - p, w:R.w + 2 * p, h:R.h + 2 * p });
  const inBox = (pt, R, p) => pt.x >= R.x - p && pt.x <= R.x + R.w + p && pt.y >= R.y - p && pt.y <= R.y + R.h + p;
  const W = D.GAME_W, CT = CONTAINER_TRUTH, IT = ITEM_TRUTH;
  const cap = i => CT[i].cap, wt = i => IT[i].wt, ht = i => CT[i].h, sz = i => IT[i].size;
  /* 字寬的粗估（px）：中文一字一個字級、emoji 1.15 個、英文大寫與數字 0.62、小寫 0.55、空白 0.3 */
  const textW = (t, fs) => Array.from(String(t)).reduce((s, ch) => {
    const c = ch.codePointAt(0);
    if (c > 0xFFFF || (c >= 0x2600 && c <= 0x27BF)) return s + fs * 1.15;
    if ((c >= 0x3000 && c <= 0x9FFF) || (c >= 0xFF00 && c <= 0xFFEF)) return s + fs;
    if (/[A-Z0-9]/.test(ch)) return s + fs * 0.62;
    if (ch === ' ') return s + fs * 0.3;
    if (/[a-z]/.test(ch)) return s + fs * 0.55;
    return s + fs * 0.35;
  }, 0);
  /* 換行後幾行：英文照字換、中文照字元換 */
  const lines = (t, fs, w, L) => {
    const parts = L === 'en' ? String(t).split(' ') : Array.from(String(t));
    let n = 1, cur = 0;
    parts.forEach(p => {
      const pw = textW(p, fs) + (L === 'en' && cur > 0 ? fs * 0.3 : 0);
      if (cur > 0 && cur + pw > w){ n++; cur = textW(p, fs); } else cur += pw;
    });
    return n;
  };
  const svgWH = s => { const m = String(s).match(/^<svg[^>]*?\swidth="(\d+(?:\.\d+)?)" height="(\d+(?:\.\d+)?)"/); return m ? { w:+m[1], h:+m[2] } : null; };
  const MORE = { zh:'裝得比較多', en:' holds more' }, HEAVY = { zh:'比較重', en:' is heavier' };

  /* 畫出來的東西自己讀（codex 第一輪：拿頁面自己的 jarSVG／rowSVG／balanceSVG 輸出當標準答案，畫錯了也比得一模一樣）。
     容器：外框 = 真實寬高、水 = round(h × 杯數 ÷ 容量)、水花 = min(滿出來, 4) 滴；一排：恰好 n 個 icon、字級 px；
     天平：data-tilt、兩個盤子的位置照自己的幾何、左盤上那一樣東西、右盤上恰好 n 個積木（都在右半邊）。 */
  const jarIs = (svg, id, fill, spill) => {
    const c = CT[id], t = String(svg), wet = Math.max(0, Math.min(c.cap, fill)), wh = Math.round(c.h * wet / c.cap);
    const water = t.match(/<rect x="17" y="(-?[\d.]+)" width="(\d+)" height="(\d+)" rx="4" fill="#9AD1F0"\/>/);
    const outline = t.match(/<rect x="14" y="(-?[\d.]+)" width="(\d+)" height="(\d+)" rx="8" fill="none" stroke="#3B7DD8"/);
    if (!outline || +outline[2] !== c.w || +outline[3] !== c.h || +outline[1] !== 118 - c.h) return false;
    if (wh > 0 ? !(water && +water[3] === wh && +water[1] === 118 - wh && +water[2] === c.w - 6) : /#9AD1F0/.test(t)) return false;
    return (t.match(/💧/g) || []).length === Math.min(Math.max(0, spill), 4);
  };
  const rowIs = (svg, n, icon, size) => {
    const t = String(svg);
    if (!t) return n === 0;
    const all = (t.match(/<text /g) || []).length, mine = (t.match(new RegExp('<text [^>]*font-size="' + size + '">' + icon + '</text>', 'g')) || []).length;
    return all === n && mine === n && t.indexOf('data-count="' + n + '"') >= 0;
  };
  const balIs = (svg, itemId, n, tilt) => {
    const t = String(svg);
    if (t.indexOf('data-tilt="' + tilt + '"') < 0) return false;
    const p = pansOf(t), want = [G.pivot + tilt * G.drop + G.hang, G.pivot - tilt * G.drop + G.hang];
    if (p.length !== 2 || p[0].top !== want[0] || p[1].top !== want[1]) return false;
    const blocks = []; const re = /<text x="(-?[\d.]+)" y="-?[\d.]+" font-size="(\d+)">🟧<\/text>/g; let m;
    while ((m = re.exec(t))) blocks.push(+m[1]);
    if (blocks.length !== n || blocks.some(x => x < G.cx)) return false;
    const items = itemId === null ? 0 : (t.match(new RegExp('<text x="' + (G.cx - G.arm) + '" [^>]*>' + IT[itemId].icon + '</text>', 'g')) || []).length;
    return items === (itemId === null ? 0 : 1) && (t.match(/<text /g) || []).length === n + (itemId === null ? 0 : 1);
  };
  /* --- 這一課的常數：釘死，不然改了也沒人會發現 --- */
  if (D.BASE !== 118 || D.PAD !== 14) fail('BASE/PAD changed (' + D.BASE + '/' + D.PAD + ') — the game lines the jars up on them');
  const G = D.BAL_GEO;
  if (JSON.stringify(G) !== JSON.stringify({ W:260, H:176, cx:130, pivot:56, arm:92, drop:16, hang:30 })) fail('BAL_GEO is ' + JSON.stringify(G) + ', the balance the examples draw is 260×176 (cx 130, pivot 56, arm 92, drop 16, hang 30)');
  if (D.GAME_W !== 300 || D.GPICK !== 48 || D.GPAD !== 6) fail('GAME_W / GPICK / GPAD should be 300 / 48 / 6');
  if (D.CUP_BIG !== 2) fail('CUP_BIG is ' + D.CUP_BIG + ' — the big cup is two small cups');
  /* 自己的 jarDims（畫布寬高）：寬 ＝ 2 × PAD ＋ 容器寬（有水花再 ＋40），高 ＝ max(BASE ＋ 14, 最後一滴水花的下緣) */
  const ownDims = (c, spill) => {
    const drops = Math.min(Math.max(0, spill || 0), 4), top = 118 - c.h;
    return { w:14 + c.w + 14 + (drops > 0 ? 40 : 0), h:Math.max(132, drops > 0 ? top + 18 + (drops - 1) * 11 + 6 : 0) };
  };
  D.CONTAINERS.forEach((c, i) => {
    for (let sp = 0; sp <= 5; sp++){
      const o = ownDims(c, sp), p = D.jarDims(c, sp), s = svgWH(D.jarSVG(c, c.cap, sp));
      if (p.w !== o.w || p.h !== o.h) fail('jarDims(container ' + i + ', spill ' + sp + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(o));
      if (!s || s.w !== p.w || s.h !== p.h) fail('jarSVG(container ' + i + ', spill ' + sp + ') is ' + JSON.stringify(s) + ' but jarDims says ' + JSON.stringify(p) + ' — the board would cut it or squash it');
    }
  });
  /* 天平的盤子，從畫出來的 balanceSVG 讀（不從 BAL_GEO 讀）：[左, 右]，各自的中心 x 與上緣 y */
  const pansOf = svg => {
    const out = []; const re = /<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="52" height="7" rx="3" fill="#E8871E"\/>/g; let m;
    while ((m = re.exec(svg))) out.push({ cx:+m[1] + 26, top:+m[2] });
    return out.sort((a, b) => a.cx - b.cx);
  };
  const panAt = {};
  [-1, 0, 1].forEach(t => {
    const p = pansOf(D.balanceSVG(null, null, t));
    if (p.length !== 2) return fail('balanceSVG(tilt ' + t + ') does not draw two pans');
    panAt[t] = p;
    const want = [G.pivot + t * G.drop + G.hang, G.pivot - t * G.drop + G.hang];
    if (p[0].top !== want[0] || p[1].top !== want[1] || p[0].cx !== G.cx - G.arm || p[1].cx !== G.cx + G.arm) fail('balanceSVG(tilt ' + t + ') draws its pans at ' + JSON.stringify(p) + ', BAL_GEO says ' + JSON.stringify(want));
  });
  if (panAt[1] && !(panAt[1][0].top > panAt[1][1].top)) fail('tilt 1 must put the LEFT pan lower (the left side is heavier)');

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['pour', 'tilt', 'cups', 'blocks', 'rank'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
    if (!/\broundSolved\(/.test(B[t].replace(/\/\*[\s\S]*?\*\//g, ''))) fail(t + ': the round never calls roundSolved()');
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 第一層提示要講這一關的那個方法（codex 第一輪：只驗長度的話，換成任何五個字都是綠的） */
  const HINT1 = { pour:['倒', '高的不一定', 'pour', 'taller does not mean more'], tilt:['沉下去的那一邊比較重', '大的不一定重', 'goes down is heavier', 'Bigger is not always heavier'],
    cups:['杯子要一樣', '左邊', 'cups must be the same', 'left one'], blocks:['積木還不夠', '翹', 'not enough blocks', 'up in the air'], rank:['同一個杯子', '數字大的排前面', 'same cup', 'bigger number goes first'] };
  TYPES.forEach(t => { [['zh', 0], ['zh', 1], ['en', 2], ['en', 3]].forEach(([L, k]) => { const h = (I18N[L].gHints || {})[t] || ''; if (h.toLowerCase().indexOf(HINT1[t][k].toLowerCase()) < 0) fail(t + ': hint level 1 (' + L + ') should say "' + HINT1[t][k] + '": ' + h); }); });
  /* showHint() 真的跑：第一層 = gHints[關]，第二層 = 第一層 ＋ 空白 ＋ gCtx.hint2() */
  {
    const fh = extractFunction(src, 'showHint');
    if (!fh) fail('cannot find showHint() in index.html');
    else TYPES.forEach((t, gi) => {
      try {
        const run = lv => new Function('I', fh + '\nvar gRound = ' + gi + ', GAME_ORDER = ' + JSON.stringify(TYPES) + ', hintLevel = ' + lv + ', gCtx = { hint2:function(){ return "H2"; } }, elHint = {};' +
          '\nfunction L(){ return I; }\nshowHint(); return elHint.textContent;')(I18N.zh);
        if (run(1) !== I18N.zh.gHints[t] || run(2) !== I18N.zh.gHints[t] + ' H2') fail(t + ': showHint() gives "' + run(1) + '" / "' + run(2) + '"');
      } catch (e){ fail('showHint() could not run: ' + e.message); }
    });
  }
  /* 第 2、3 關沒有拖拉（點一下本身就是動作），說明要寫出「這一關用點的」；其他三關要寫出「先點、再點」（§六之五第 4 點） */
  ['tilt', 'cups'].forEach(t => { if (!/用點的/.test(I18N.zh.gAsks[t]) || !/all taps/.test(I18N.en.gAsks[t])) fail(t + ': the round has no drag — its instructions must say it is all taps'); });
  ['pour', 'blocks', 'rank'].forEach(t => { if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way'); });
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;(?:\s*\/\*[\s\S]*?\*\/)*\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); return; \}/.test(src))
    fail('a piece that was tapped and then dragged stays selected — a later tap would drop it again');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src) || !/gCtx = \{\}; gGen\+\+;/.test(extractFunction(src, 'startRound') || ''))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round — grade-2 length codex round 1');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');
  if (!/if \(P\.busy\(\)\) return;/.test(src)) fail('a tap on a target while another finger drags the selected piece is not ignored');

  /* --- 觸控：375px 手機上畫板能用的寬度從頁面的 CSS 算（.wrap 左右 padding、.card 的 padding 與邊框、.gstage 左右 padding） --- */
  const cssPx = (sel, re) => { const m = src.match(new RegExp('\\n\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); const v = m && m[1].match(re); return v ? v.slice(1).map(Number) : null; };
  const wrapPad = cssPx('.wrap', /padding:(\d+)px (\d+)px/), cardPad = cssPx('.card', /padding:(\d+)px/), cardBorder = cssPx('.card', /border:(\d+)px/), stagePad = cssPx('.gstage', /padding:\s*(\d+)px (\d+)/);
  if (!wrapPad || !cardPad || !cardBorder || !stagePad) fail('touch: cannot read .wrap / .card / .gstage padding from the CSS');
  const avail = 375 - 2 * ((wrapPad || [0, 0])[1] + (cardPad || [0])[0] + (cardBorder || [0])[0] + (stagePad || [0, 0])[1]);
  const scale = Math.min(1.5, avail / W);
  const small = (what, s) => { if (!(s * scale >= 44)) fail(what + ' is ' + (s * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK', D.GPICK);
  small('the crown', D.POUR_CROWN.size);
  D.GAME_POUR.forEach((e, i) => { const d = ownDims(CT[e.a], 0); small('GAME_POUR[' + i + '] the full jar (' + d.w + '×' + d.h + ')', Math.min(d.w, d.h)); });
  small('a thing on a balance (' + D.TILT_ITEM.w + '×' + D.TILT_ITEM.h + ')', Math.min(D.TILT_ITEM.w, D.TILT_ITEM.h));
  small('the "Same" button', Math.min(D.TILT_SAME_BTN.w, D.TILT_SAME_BTN.h));
  small('the small cup button', D.CUP_BTN.small); small('the big cup button', D.CUP_BTN.big);
  small('a block source (' + D.BLK_TOK.w + '×' + D.BLK_TOK.h + ')', Math.min(D.BLK_TOK.w, D.BLK_TOK.h));
  small('a rank card', Math.min(D.RANK_CARD.w, D.RANK_CARD.h));
  small('a rank box', Math.min(D.RANK_SLOT.w, D.RANK_SLOT.h));
  [D.POUR_CROWN.size, D.BLK_TOK.w, D.BLK_TOK.h, D.RANK_CARD.w, D.RANK_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('blocks: the Level button (.btn) is not at least 46px tall'); }
  need('pour', /var jar = addPiece\(B, \{ w:dA\.w, h:dA\.h, cx:J\.ax, cy:J\.top \+ dA\.h \/ 2,/, 'the full jar is not a jarDims-sized piece at (POUR_JAR.ax, top + h / 2)');
  need('pour', /addPiece\(B, \{ w:Cr\.size, h:Cr\.size, cx:GAME_W \/ 2, cy:Cr\.y,/, 'the crown is not POUR_CROWN.size at (GAME_W / 2, POUR_CROWN.y)');
  need('blocks', /addPiece\(B, \{ w:Tk\.w, h:Tk\.h, cx:Tk\.x\[i\], cy:Tk\.y,/, 'the block sources are not BLK_TOK.w × BLK_TOK.h at BLK_TOK.x');
  need('rank', /addPiece\(B, \{ w:Cd\.w, h:Cd\.h, cx:cx, cy:cy,/, 'the rank cards are not RANK_CARD.w × RANK_CARD.h');

  /* --- 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = 0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = {}, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves) => new Function(env.replace('S0', s0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
        /* 真的訊息（codex 第一輪）：放錯那一句要真的顯示出來；過關那一句要帶著傳進來的話；
           roundInfo()（倒之前的提醒、積木太多了）不可以記錯、不可以動分數 */
        const fi = extractFunction(src, 'roundInfo');
        if (!fi) fail('stars: cannot find roundInfo() in index.html');
        else {
          const q = new Function(env.replace('S0', 3) + fm + '\n' + fs + '\n' + fi +
            '\nroundMiss("WHY1"); var h1 = gMsg.innerHTML, m1 = gMistakes; gMistakes = 0; roundInfo("INFO1"); var h2 = gMsg.innerHTML, m2 = gMistakes, s2 = gScore;' +
            '\nroundSolved("DONE1"); return { h1:h1, m1:m1, h2:h2, m2:m2, s2:s2, h3:gMsg.innerHTML, s3:gScore };')();
          if (q.h1 !== '<span class="no">WHY1</span>' || q.m1 !== 1) fail('stars: roundMiss() does not show its reason as a mistake (' + q.h1 + ')');
          if (q.h2.indexOf('INFO1') < 0 || /class="no"/.test(q.h2) || q.m2 !== 0 || q.s2 !== 3) fail('stars: roundInfo() counts as a mistake or changes the score (' + q.h2 + ', mistakes ' + q.m2 + ')');
          if (q.h3.indexOf('DONE1') < 0 || q.s3 !== 5) fail('stars: after a roundInfo() reminder the round must still give 2 stars and say its text (' + q.h3 + ')');
        }
      } catch (e){ fail('stars: roundSolved()/roundMiss() could not run: ' + e.message); }
    }
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    seq('gStars ' + L, d.gStars(2), [2]);
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' missing or has a number in it');
  });

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }
  if (nearestOpen){
    /* 兩格的吸附範圍重疊時，挑「到方框」最近的那一格，不是清單裡第一個、也不是中心最近的 */
    const A = { cx:50, cy:50, hw:40, hh:40, done:false, n:'A' }, Bx = { cx:140, cy:50, hw:40, hh:40, done:false, n:'B' }, Cbig = { cx:100, cy:200, hw:80, hh:20, done:false, n:'C' }, Dsm = { cx:100, cy:232, hw:10, hh:8, done:false, n:'D' };
    for (let x = 85; x <= 105; x += 0.5){ const g = nearestOpen([A, Bx], { x, y:50 }, 6); const want = x < 95 ? 'A' : x > 95 ? 'B' : null; if (want && (!g || g.n !== want)) { fail('nearestOpen(): at x = ' + x + ' between two boxes it picks ' + (g && g.n) + ', should pick ' + want); break; } }
    const g2 = nearestOpen([Cbig, Dsm], { x:100, y:219 }, 6);   /* 在大框裡面（距離 0），雖然離小框的中心比較近 */
    if (!g2 || g2.n !== 'C') fail('nearestOpen(): a point inside a big box but near a small box\'s centre goes to ' + (g2 && g2.n) + ' — it must measure to the box, not to the centre');
    Bx.done = true;   /* x = 96, pad 8：離 A 的框 6、離 B 的框 4 —— 兩個都碰得到，最近的是已經放好的 B */
    if (nearestOpen([A, Bx], { x:96, y:50 }, 8) !== null) fail('nearestOpen(): when the nearest box is filled it must refuse, not skip to the other box');
    if (nearestOpen([A], { x:100, y:50 }, 6) !== null) fail('nearestOpen(): a point 10px outside a box with pad 6 is accepted');
  }

  /* ================= 假的 DOM：每一關的 RENDER 函式本體真的跑 =================
     makeBoard／addZone／addPiece／useTapSelect／actionButton／trailLine 換成記錄用的替身；target()／addButton()／jarZone()／
     nearestOpen()／renderTray()／shuffle()／rankCardHTML() 用頁面自己的原始碼。pick() 依序取 picks、coin() 依序取 coins、
     Math.random 換成給定的序列（shuffle 用）。 */
  const EXEC = (() => {
    const fns = ['target', 'addButton', 'jarZone', 'nearestOpen', 'renderTray', 'shuffle', 'rankCardHTML'].map(n => {
      const f = extractFunction(src, n); if (!f) fail('exec: cannot cut ' + n + '() out of index.html'); return f || '';
    }).join('\n');
    const decl = Object.keys(D).map(k => 'var ' + k + ' = D.' + k + ';').join('\n');
    const stub = `
      var LOG = { miss:[], solved:[], info:[], zones:[], pieces:[], created:[], board:null, line:null, drop:null, action:null, kept:0 };
      function el(){ var o = { style:{}, textContent:'', innerHTML:'', children:[], disabled:false, cls:{}, attrs:{},
        classList:{ add:function(c){ o.cls[c] = true; }, remove:function(c){ delete o.cls[c]; }, contains:function(c){ return !!o.cls[c]; } },
        appendChild:function(x){ o.children.push(x); return x; }, setAttribute:function(k, v){ o.attrs[k] = String(v); }, remove:function(){ o.removed = true; },
        addEventListener:function(t, f){ o['on' + t] = f; } }; return o; }
      var document = { createElement:function(tag){ var e = el(); e.tag = tag; LOG.created.push(e); return e; } };
      var gameStage = el(), gMsg = el(), gSolved = false, gCtx = {}, gMistakes = 0;
      function pick(arr){ return arr[PICKS.length ? PICKS.shift() : 0]; }
      function coin(){ return COINS.length ? COINS.shift() : true; }
      function makeBoard(W, H){ LOG.board = { W:W, H:H }; return { el:el(), W:W, k:1, selected:null }; }
      function addZone(B, x, y, w, h, cls, text){ var z = el(); z.x = x; z.y = y; z.w = w; z.h = h; z.className = cls; if (text !== undefined) z.textContent = text; LOG.zones.push(z); return z; }
      function trailLine(text){ LOG.line = el(); LOG.line.textContent = text; return LOG.line; }
      function addPiece(B, o){ var P = { el:el(), w:o.w, h:o.h, homeX:o.cx, homeY:o.cy, cx:o.cx, cy:o.cy, locked:false, data:o.data || {}, text:o.text, html:o.html, cls:o.cls, label:o.label };
        P.el.innerHTML = o.html || '';
        P.place = function(x, y){ P.cx = x; P.cy = y; }; P.home = function(){ P.place(P.homeX, P.homeY); }; P.lock = function(x, y){ P.locked = true; P.place(x, y); };
        P.busy = function(){ return false; }; LOG.pieces.push(P); return P; }
      function useTapSelect(B, fn){ LOG.drop = fn; }
      function keepSelected(B, P){ LOG.kept++; }
      function roundMiss(t){ gMistakes++; LOG.miss.push(t); }
      function roundSolved(t){ if (gSolved) return; gSolved = true; LOG.solved.push(t); }
      function roundInfo(t){ LOG.info.push(t); }
      function refreshHint(){}
      function actionButton(text, f){ var b = el(); b.textContent = text; LOG.action = { b:b, f:f }; return b; }
    `;
    return (type, o, d) => {
      const seqR = (o.rnd || []).slice();
      const fakeMath = Object.create(Math); fakeMath.random = () => seqR.length ? seqR.shift() : 0.5;
      const code = decl + '\nvar PICKS = ' + JSON.stringify(o.picks || []) + ', COINS = ' + JSON.stringify(o.coins || []) + ';\n' + stub + fns +
        '\n(function(d){' + B[type] + '\n})(d);\nreturn { LOG:LOG, solved:function(){ return gSolved; }, misses:function(){ return gMistakes; }, msg:function(){ return gMsg.textContent; }, hint2:function(){ return gCtx.hint2 ? gCtx.hint2() : null; } };';
      try { return new Function('D', 'd', 'Math', code)(D, d, fakeMath); }
      catch (e){ fail('exec: RENDER.' + type + ' could not run in the stub DOM: ' + e.message); return null; }
    };
  })();
  const zonesOf = (r, cls) => r.LOG.zones.filter(z => z.className === cls && !z.removed);
  const btnsOf = r => r.LOG.created.filter(c => c.tag === 'button' && typeof c.onclick === 'function');
  const px = s => parseFloat(s);
  [['pour', 'POUR_H'], ['tilt', 'TILT_H'], ['cups', 'CUPS_H'], ['blocks', 'BLOCKS_H'], ['rank', 'RANK_H']].forEach(([t, h]) => {
    const r = EXEC(t, {}, I18N.zh);
    if (r && !(r.LOG.board && r.LOG.board.W === W && r.LOG.board.H === D[h])) fail('exec: RENDER.' + t + ' opens a board of ' + JSON.stringify(r.LOG.board) + ', should be ' + W + ' × ' + h + ' (' + D[h] + ')');
  });

  /* ================= 第 1 關：倒倒看（範例 1） ================= */
  {
    const J = D.POUR_JAR, S = D.POUR_SAME, Cr = D.POUR_CROWN, H = D.POUR_H;
    const outOf = (a, b) => cap(a) > cap(b) ? 'spill' : cap(a) < cap(b) ? 'room' : 'exact';
    const moreOf = out => out === 'spill' ? 'a' : out === 'room' ? 'b' : 'same';
    const seen = {};
    if (!(D.GAME_POUR.length >= 6)) fail('GAME_POUR should have at least 6 entries');
    if (new Set(D.GAME_POUR.map(e => e.a + ',' + e.b)).size !== D.GAME_POUR.length) fail('GAME_POUR has the same pair twice');
    const Sb = { x:S.x, y:S.y, w:S.w, h:S.h }, crownHome = box(W / 2, Cr.y, Cr.size, Cr.size);
    inside(Sb, 'pour: the "same" box', W, H); inside(crownHome, 'pour: the crown', W, H);
    if (hit(pad(Sb, D.GPAD), crownHome)) fail('pour: the crown starts inside the "same" box\'s drop pad');
    D.GAME_POUR.forEach((e, i) => {
      const w = 'GAME_POUR[' + i + ']';
      if (!(CT[e.a] && CT[e.b]) || e.a === e.b) return fail(w + ': not two different containers');
      const out = outOf(e.a, e.b); seen[out] = (seen[out] || 0) + 1;
      if (ht(e.a) === ht(e.b)) return fail(w + ': the two are the same height — the height trap is missing');
      const tall = ht(e.a) > ht(e.b) ? 'a' : 'b', more = moreOf(out);
      if (tall === more) fail(w + ': the taller one also holds more — judging by height already gives the right crown');
      const dA = ownDims(CT[e.a], 0), dB = ownDims(CT[e.b], 0), dBs = ownDims(CT[e.b], Math.max(0, cap(e.a) - cap(e.b)));
      const Ab = { x:J.ax - CT[e.a].w / 2 - 14, y:J.top, w:dA.w, h:dA.h }, Bb = { x:J.bx - CT[e.b].w / 2 - 14, y:J.top, w:dB.w, h:dB.h }, Bs = { x:Bb.x, y:J.top, w:dBs.w, h:dBs.h };
      inside(Ab, w + ' the full jar', W, H); inside(Bs, w + ' the empty jar after pouring (with the spill)', W, H);
      if (hit(Ab, Bs)) fail(w + ': the two jars overlap');
      if (hit(pad(Ab, D.GPAD), pad(Bb, D.GPAD))) fail(w + ': the two jars\' drop pads overlap');
      const lA = { x:J.ax - J.lblW / 2, y:J.lblY, w:J.lblW, h:22 }, lB = { x:J.bx - J.lblW / 2, y:J.lblY, w:J.lblW, h:22 };
      inside(lA, w + ' name A', W, H); inside(lB, w + ' name B', W, H);
      if (hit(lA, lB)) fail(w + ': the two names overlap');
      if (J.lblY < J.top + Math.max(dA.h, dBs.h)) fail(w + ': the names sit on top of the jars');
      [lA, lB, Ab, Bs].forEach((R, k) => { if (hit(R, pad(Sb, D.GPAD)) || hit(R, crownHome)) fail(w + ': part ' + k + ' (names/jars) runs into the "same" box or the crown'); });
      /* 王冠放好：縮成 placed、停在容器口上面（下緣在口的上面、不出畫板） */
      [['a', e.a, J.ax], ['b', e.b, J.bx]].forEach(([who, id, cx]) => {
        const rim = J.top + 118 - ht(id), cb = box(cx, rim - 20, Cr.placed, Cr.placed);
        inside(cb, w + ' the crown on ' + who, W, H);
        if (cb.y + cb.h > rim) fail(w + ': the crown on ' + who + ' covers the jar\'s rim');
      });
      LANGS.forEach(L => {
        const d = I18N[L], A = fCName(e.a, L), Bn = fCName(e.b, L), MR = MORE[L];
        [A, Bn].forEach(n => { if (lines(n, 14, J.lblW - 4, L) > 1) fail(w + ' ' + L + ': the name "' + n + '" needs two lines in a ' + J.lblW + 'px label'); });
        const moreName = more === 'a' ? A : more === 'b' ? Bn : null, lessName = more === 'a' ? Bn : more === 'b' ? A : null;
        const seenT = d.gPourSeen[out];
        if (bad(seenT) || !seenT || /\d/.test(seenT)) fail(w + ' ' + L + ': gPourSeen.' + out + ' missing or has a number');
        has(w + ' ' + L + ' gPourSeen', seenT, L === 'zh' ? { spill:'滿出來', room:'空位', exact:'剛好滿' }[out] : { spill:'spills', room:'room', exact:'exactly full' }[out]);
        const done = d.gPourDone(out, e.a, e.b);
        if (moreName){ has(w + ' ' + L + ' gPourDone', done, moreName + MR); hasNot(w + ' ' + L + ' gPourDone', done, lessName + MR); }
        else { has(w + ' ' + L + ' gPourDone', done, L === 'zh' ? '一樣多' : 'the same'); hasNot(w + ' ' + L + ' gPourDone', done, MR); }
        ['a', 'b', 'same'].filter(x => x !== more).forEach(who => {
          const t = d.gPourWrong(out, who, e.a, e.b), wh = w + ' ' + L + ' crown on ' + who;
          if (bad(t)) return fail(wh + ': ' + t);
          if (/\d/.test(t)) fail(wh + ': has a number in it: ' + t);
          if (moreName){ has(wh, t, moreName + MR); hasNot(wh, t, lessName + MR); }
          else { has(wh, t, L === 'zh' ? '兩個一樣多' : 'they hold the same'); hasNot(wh, t, MR); }
          if (who === 'same') has(wh, t, L === 'zh' ? '不一樣多' : 'do not hold the same');
          has(wh, t, L === 'zh' ? { spill:'水滿出來了', room:'還有空位', exact:'剛好滿' }[out] : { spill:'spilled over', room:'still room', exact:'Exactly full' }[out]);
          const noteN = L === 'zh' ? '高不代表多' : 'taller does not mean more';
          if (who === tall) has(wh, t, noteN); else hasNot(wh, t, noteN);
          if (who === tall) has(wh, t, (who === 'a' ? A : Bn) + (L === 'zh' ? '比較高' : ' is taller'));
        });
        const h0 = d.gPour2(false, out, e.a, e.b), h1 = d.gPour2(true, out, e.a, e.b);
        has(w + ' ' + L + ' gPour2 (before)', h0, A); has(w + ' ' + L + ' gPour2 (before)', h0, Bn);
        if (moreName) has(w + ' ' + L + ' gPour2 (after)', h1, moreName); else has(w + ' ' + L + ' gPour2 (after)', h1, L === 'zh' ? '一樣多' : 'Same');
      });
    });
    ['spill', 'room', 'exact'].forEach(k => { if (!seen[k]) fail('GAME_POUR needs at least one "' + k + '" pour'); });
    LANGS.forEach(L => { const d = I18N[L]; [d.gPourAsk, d.gPourFirst, d.gSameLbl].forEach(t => { if (bad(t) || !t || /\d/.test(t)) fail('pour ' + L + ': a fixed string is missing or has a number: ' + t); }); });
    need('pour', /if \(!poured\)\{ roundInfo\(d\.gPourFirst\); return false; \}/, 'the crown before pouring is not a reminder (it must bounce without being a mistake)');
    need('pour', /if \(t\.who !== more\)\{ roundMiss\(d\.gPourWrong\(out, t\.who, e\.a, e\.b\)\); return false; \}/, 'a crown on the wrong one is accepted');

    /* --- 跑起來：每一題、兩種語言 --- */
    D.GAME_POUR.forEach((e, i) => LANGS.forEach(L => {
      const d = I18N[L], w = 'exec pour[' + i + '] ' + L, A = D.CONTAINERS[e.a], Bc = D.CONTAINERS[e.b];
      const out = outOf(e.a, e.b), more = moreOf(out), spill = Math.max(0, cap(e.a) - cap(e.b));
      const dA = ownDims(CT[e.a], 0), dB = ownDims(CT[e.b], 0), dBs = ownDims(CT[e.b], spill);
      const Bbox = { x:J.bx - CT[e.b].w / 2 - 14, y:J.top, w:dB.w, h:dB.h }, Abox = { x:J.ax - CT[e.a].w / 2 - 14, y:J.top, w:dA.w, h:dA.h };
      let r = EXEC('pour', { picks:[i] }, d); if (!r) return;
      const jar = r.LOG.pieces.filter(P => P.data.jar)[0], crown = r.LOG.pieces.filter(P => P.data.crown)[0], bz = zonesOf(r, 'gjar')[0];
      if (!jar || !crown || !bz || r.LOG.pieces.length !== 2) return fail(w + ': not exactly one jar piece, one crown and one empty jar');
      if (jar.w !== dA.w || jar.h !== dA.h || jar.homeX !== J.ax || jar.homeY !== J.top + dA.h / 2 || !jarIs(jar.html, e.a, cap(e.a), 0)) fail(w + ': the full jar is not drawn full at its place');
      if (bz.x !== Bbox.x || bz.y !== Bbox.y || bz.w !== Bbox.w || bz.h !== Bbox.h || !jarIs(bz.innerHTML, e.b, 0, 0)) fail(w + ': the empty jar is not drawn empty at its place');
      const names = zonesOf(r, 'gname').map(z => z.textContent);
      if (names.join('|') !== [fCName(e.a, L), fCName(e.b, L)].join('|')) fail(w + ': the names read ' + names.join(' / '));
      const sameZ = r.LOG.zones.filter(z => z.className === 'gslot gsame')[0];
      if (!sameZ || sameZ.textContent !== d.gSameLbl) fail(w + ': no "same" box');
      if (r.LOG.line.textContent !== d.gPourAsk) fail(w + ': the line should ask, not answer: ' + r.LOG.line.textContent);
      const crownT = { a:Abox, b:Bbox, same:{ x:S.x, y:S.y, w:S.w, h:S.h } };
      /* 倒之前：王冠放在哪一個目標上都只提醒、不算錯 */
      ['a', 'b', 'same'].forEach(who => {
        const R = crownT[who], n0 = r.LOG.info.length;
        if (r.LOG.drop(crown, { x:R.x + R.w / 2, y:R.y + R.h / 2 }) !== false || r.LOG.info.length !== n0 + 1 || r.LOG.info[n0] !== d.gPourFirst || r.LOG.miss.length || crown.locked) fail(w + ': the crown on ' + who + ' before pouring is not just a reminder');
      });
      /* 容器放開的位置：每 3px 一點。不在空的那一個（＋GPAD）上 → 什麼都不做；在上面 → 倒過去（先跑不收的，再跑收的） */
      const pts = [];
      for (let x = 0; x <= W; x += 3) for (let y = 0; y <= D.POUR_H; y += 3) pts.push({ x, y, want:inBox({ x, y }, Bbox, D.GPAD) });
      let badP = 0;
      pts.filter(p => !p.want).forEach(p => { const got = r.LOG.drop(jar, { x:p.x, y:p.y }); if (got !== false || jar.locked || r.LOG.miss.length || r.LOG.info.length !== 3) badP++; });
      if (badP) fail(w + ': ' + badP + ' drops of the jar away from the empty one pour or say something');
      const yes = pts.filter(p => p.want);
      if (!yes.length) fail(w + ': no drop position pours');
      if (r.LOG.drop(jar, { x:yes[0].x, y:yes[0].y }) !== true) fail(w + ': a drop on the empty jar does not pour');
      if (!jar.locked || jar.cx !== J.ax || !jarIs(jar.el.innerHTML, e.a, 0, 0)) fail(w + ': after pouring the left jar is not empty and back in place');
      if (!jarIs(bz.innerHTML, e.b, Math.min(cap(e.a), cap(e.b)), spill) || bz.style.width !== dBs.w + 'px' || bz.style.height !== dBs.h + 'px') fail(w + ': after pouring the right jar does not hold min(a, b) with the spill drawn');
      if (r.LOG.line.textContent !== d.gPourSeen[out] || r.LOG.miss.length) fail(w + ': after pouring the line says ' + r.LOG.line.textContent);
      if (r.hint2() !== d.gPour2(true, out, e.a, e.b)) fail(w + ': hint 2 after pouring is not gPour2(poured)');
      /* 王冠：每 3px 一點。不在目標上 → 靜靜的；在錯的目標上 → 說為什麼；在對的上 → 過關 */
      let badC = 0; const wrongSaid = {};
      pts.forEach(p => {
        const at = ['a', 'b', 'same'].filter(k => inBox(p, crownT[k], D.GPAD));
        if (at.length > 1) badC++;
        if (at[0] === more) return;
        const m0 = r.LOG.miss.length, got = r.LOG.drop(crown, { x:p.x, y:p.y });
        const said = r.LOG.miss.slice(m0);
        if (got !== false || crown.locked) badC++;
        if (!at.length && said.length) badC++;
        if (at.length){ if (said.join() !== d.gPourWrong(out, at[0], e.a, e.b)) badC++; wrongSaid[at[0]] = true; }
      });
      if (badC) fail(w + ': ' + badC + ' crown drops behave wrongly (silent off target, the reason on a wrong one, never accepted)');
      ['a', 'b', 'same'].filter(k => k !== more).forEach(k => { if (!wrongSaid[k]) fail(w + ': the crown was never refused on ' + k); });
      const R = crownT[more], m1 = r.LOG.miss.length;
      if (r.LOG.drop(crown, { x:R.x + R.w / 2, y:R.y + R.h / 2, tap:true }) !== true || r.LOG.miss.length !== m1) fail(w + ': tap-then-tap with the crown on ' + more + ' is not accepted');
      const lx = more === 'same' ? S.x + S.w / 2 : more === 'a' ? J.ax : J.bx, ly = more === 'same' ? S.y + S.h / 2 : J.top + 118 - ht(more === 'a' ? e.a : e.b) - 20;
      if (!crown.locked || crown.cx !== lx || crown.cy !== ly || crown.w !== Cr.placed) fail(w + ': the crown is not locked (' + Cr.placed + 'px) at ' + lx + ',' + ly + ' — got ' + crown.cx + ',' + crown.cy);
      if (!r.solved() || r.LOG.solved.join() !== d.gPourDone(out, e.a, e.b)) fail(w + ': not solved with gPourDone');
      /* 點目的地倒水 */
      r = EXEC('pour', { picks:[i] }, d);
      if (r && r.LOG.drop(r.LOG.pieces[0], { x:J.bx, y:J.top + dB.h / 2, tap:true }) !== true) fail(w + ': tap-then-tap on the empty jar does not pour');
      if (r && r.hint2() !== d.gPour2(true, out, e.a, e.b)) fail(w + ': hint 2 does not follow the pour');
    }));
  }

  /* ================= 第 2 關：天平（範例 2） ================= */
  {
    const T = D.TILT, I = D.TILT_ITEM, Sb = D.TILT_SAME_BTN, H = D.TILT_H, s = T.s;
    const tiltOf = e => wt(e.a) > wt(e.b) ? 1 : wt(e.a) < wt(e.b) ? -1 : 0;
    const okPair = (e, w) => { if (!(IT[e.a] && IT[e.b]) || e.a === e.b){ fail(w + ': not two different things'); return false; } return true; };
    D.TILT_TRAP.forEach((e, i) => { const w = 'TILT_TRAP[' + i + ']'; if (!okPair(e, w)) return; const hv = wt(e.a) > wt(e.b) ? e.a : e.b, lt = hv === e.a ? e.b : e.a; if (!(wt(e.a) !== wt(e.b) && sz(lt) > sz(hv))) fail(w + ': the bigger one is not the lighter one'); });
    D.TILT_SAME.forEach((e, i) => { const w = 'TILT_SAME[' + i + ']'; if (!okPair(e, w)) return; if (wt(e.a) !== wt(e.b)) fail(w + ': the two do not weigh the same'); });
    D.TILT_BIG.forEach((e, i) => { const w = 'TILT_BIG[' + i + ']'; if (!okPair(e, w)) return; const hv = wt(e.a) > wt(e.b) ? e.a : e.b, lt = hv === e.a ? e.b : e.a; if (!(wt(e.a) !== wt(e.b) && sz(hv) > sz(lt))) fail(w + ': the bigger one is not the heavier one'); });
    if (!D.TILT_TRAP.length || !D.TILT_SAME.length || !D.TILT_BIG.length) fail('every TILT pool needs an entry');
    /* 版面：每一排、每一種傾斜 */
    const rowZ = r => ({ x:T.x, y:T.top + r * T.rowH + T.dy, w:G.W * s, h:G.H * s });
    const itemBox = (r, side, t) => { const p = panAt[t][side], zy = T.top + r * T.rowH + T.dy; return box(T.x + p.cx * s, zy + p.top * s - I.h / 2, I.w, I.h); };
    const sameBox = r => box(Sb.cx, T.top + r * T.rowH + Sb.dy, Sb.w, Sb.h);
    if (panAt[1]) {
      for (let r = 0; r < 3; r++){
        inside(rowZ(r), 'tilt: balance ' + (r + 1), W, H); inside(sameBox(r), 'tilt: "Same" ' + (r + 1), W, H);
        [-1, 0, 1].forEach(t => [0, 1].forEach(side => inside(itemBox(r, side, t), 'tilt: row ' + (r + 1) + ' tilt ' + t + ' thing ' + side, W, H)));
      }
      noHits([0, 1, 2].map(rowZ), 'tilt: two balances');
      /* 所有排、所有傾斜的組合：按鈕兩兩不碰 */
      const combos = [];
      [-1, 0, 1].forEach(a => [-1, 0, 1].forEach(b => [-1, 0, 1].forEach(c => combos.push([a, b, c]))));
      let clash = 0;
      combos.forEach(tt => { const all = []; tt.forEach((t, r) => { all.push(itemBox(r, 0, t), itemBox(r, 1, t), sameBox(r)); }); for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (hit(all[i], all[j])) clash++; });
      if (clash) fail('tilt: buttons overlap in ' + clash + ' tilt combinations');
      if (!((panAt[1][0].top - panAt[1][1].top) * s >= 15)) fail('tilt: the two pans of a tilted balance differ by only ' + ((panAt[1][0].top - panAt[1][1].top) * s).toFixed(1) + 'px — too small to see');
    }
    D.ITEMS.forEach((it, i) => { const fs = 14 + it.size * 4; if (fs > I.h - 6 || fs > I.w - 6) fail('tilt: item ' + i + ' (' + fs + 'px) does not fit its ' + I.w + '×' + I.h + ' button'); });
    LANGS.forEach(L => {
      const d = I18N[L];
      [].concat(D.TILT_TRAP, D.TILT_BIG).forEach(e => {
        const hv = wt(e.a) > wt(e.b) ? e.a : e.b, lt = hv === e.a ? e.b : e.a, t = d.gTiltLight(lt, hv), w = 'tilt ' + L + ' tapped ' + lt + ' (heavy ' + hv + ')';
        if (bad(t) || /\d/.test(t)) fail(w + ': ' + t);
        has(w, t, fIName(hv, L) + HEAVY[L]); hasNot(w, t, fIName(lt, L) + HEAVY[L]);
        const note = L === 'zh' ? '大不代表重' : 'bigger does not mean heavier';
        if (sz(lt) > sz(hv)) has(w, t, note); else hasNot(w, t, note);
        has(w + ' gTiltNotLevel', d.gTiltNotLevel(hv), fIName(hv, L));
        for (let k = 1; k <= 3; k++){ seq(w + ' gTilt2', d.gTilt2(k, hv), [k]); has(w + ' gTilt2', d.gTilt2(k, hv), fIName(hv, L)); }
      });
      for (let k = 1; k <= 3; k++) seq('tilt ' + L + ' gTilt2 level', d.gTilt2(k, -1), [k]);
      for (let n = 0; n <= 3; n++) seq('tilt ' + L + ' gTiltNow', d.gTiltNow(n), [n, 3]);
      [d.gTiltLevel, d.gTiltDone, d.gSameW].forEach(t => { if (bad(t) || !t || /\d/.test(t)) fail('tilt ' + L + ': a fixed string is missing or has a number: ' + t); });
      if (d.gTiltLevel.indexOf(d.gSameW) < 0) fail('tilt ' + L + ': gTiltLevel does not name the "' + d.gSameW + '" button');
    });
    need('tilt', /var rows = shuffle\(\[pick\(TILT_TRAP\), pick\(TILT_SAME\), pick\(TILT_BIG\)\]\)/, 'the three rows are not one from each pool, shuffled');
    /* --- 跑起來：每一個 TRAP × 每一個 BIG（SAME 只有一個）× 左右八種 × 三種排列 --- */
    const nameToId = L => { const m = {}; IT.forEach((x, id) => { m[fIName(id, L)] = id; }); return m; };
    const perms = [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]];
    let runs = 0;
    D.TILT_TRAP.forEach((_, ti) => D.TILT_BIG.forEach((__, bi) => [0, 1, 2, 3, 4, 5, 6, 7].forEach(cm => perms.forEach((rnd, pi) => LANGS.forEach(L => {
      if ((ti + bi + cm + pi) % 2 && L === 'en') return;   /* 英文跑一半的組合就夠（字串各自另外全驗過） */
      const d = I18N[L], w = 'exec tilt[' + [ti, bi, cm, pi].join(',') + '] ' + L, ids = nameToId(L);
      const coins = [!!(cm & 1), !!(cm & 2), !!(cm & 4)];
      const r = EXEC('tilt', { picks:[ti, 0, bi], coins:coins, rnd:rnd }, d); if (!r) return;
      runs++;
      const btns = btnsOf(r), items = btns.filter(b => b.className === 'gitem'), sames = btns.filter(b => b.className === 'gsamebtn');
      if (items.length !== 6 || sames.length !== 3 || zonesOf(r, 'gbal').length !== 3) return fail(w + ': not three balances with two things and a "Same" each');
      const rowOf = b => Math.floor((px(b.style.top) - T.top + 20) / T.rowH);
      const rows = [0, 1, 2].map(k => ({ it:items.filter(b => rowOf(b) === k).sort((a, b) => px(a.style.left) - px(b.style.left)), same:sames.filter(b => rowOf(b) === k)[0], z:zonesOf(r, 'gbal')[k] }));
      if (!rows.every(x => x.it.length === 2 && x.same)) return fail(w + ': the buttons do not group into three rows');
      const pairs = rows.map(x => x.it.map(b => ids[b.attrs['aria-label']]));
      if (pairs.some(p => p.some(id => id === undefined))) return fail(w + ': a thing\'s label is not its name');
      /* 三排就是一個 TRAP、一個 SAME、一個 BIG（不分左右） */
      const key = p => p.slice().sort((a, b) => a - b).join(',');
      const wantKeys = [D.TILT_TRAP[ti], D.TILT_SAME[0], D.TILT_BIG[bi]].map(e => key([e.a, e.b])).sort();
      if (pairs.map(key).sort().join('|') !== wantKeys.join('|')) fail(w + ': the rows are ' + pairs.map(key).join(' / ') + ', should be one from each pool');
      rows.forEach((x, k) => {
        const [a, b] = pairs[k], t = wt(a) > wt(b) ? 1 : wt(a) < wt(b) ? -1 : 0;
        if (!balIs(x.z.innerHTML, null, 0, t)) fail(w + ': balance ' + (k + 1) + ' is not drawn with tilt ' + t);
        [0, 1].forEach(side => {
          const want = itemBox(k, side, t), bt = x.it[side];
          if (Math.abs(px(bt.style.left) - want.x) > 1e-6 || Math.abs(px(bt.style.top) - want.y) > 1e-6) fail(w + ': thing ' + side + ' of balance ' + (k + 1) + ' is not standing on its pan');
          const id = pairs[k][side];
          if (bt.innerHTML !== IT[id].icon || bt.style.fontSize !== (14 + sz(id) * 4) + 'px') fail(w + ': thing ' + id + ' is not drawn at its size');
        });
      });
      /* 錯的動作：每一排各試一次 */
      let found = 0;
      rows.forEach((x, k) => {
        const [a, b] = pairs[k], hv = wt(a) > wt(b) ? a : wt(a) < wt(b) ? b : -1;
        if (hv < 0){
          x.it.forEach(bt => { const m0 = r.LOG.miss.length; bt.onclick(); if (r.LOG.miss.length !== m0 + 1 || r.LOG.miss[m0] !== d.gTiltLevel || bt.cls.found) fail(w + ': a thing on the level balance is not refused with gTiltLevel'); });
        } else {
          const lt = hv === a ? b : a, lb = x.it[hv === a ? 1 : 0];
          let m0 = r.LOG.miss.length; lb.onclick(); if (r.LOG.miss[m0] !== d.gTiltLight(lt, hv) || lb.cls.found) fail(w + ': the lighter thing on balance ' + (k + 1) + ' is not refused with gTiltLight');
          m0 = r.LOG.miss.length; x.same.onclick(); if (r.LOG.miss[m0] !== d.gTiltNotLevel(hv) || x.same.cls.found) fail(w + ': "Same" on tilted balance ' + (k + 1) + ' is not refused with gTiltNotLevel');
        }
        if (r.hint2() !== d.gTilt2(k + 1, hv)) fail(w + ': hint 2 does not point at balance ' + (k + 1) + ': ' + r.hint2());
        const right = hv < 0 ? x.same : x.it[hv === a ? 0 : 1], m1 = r.LOG.miss.length;
        right.onclick(); found++;
        if (!right.cls.found || r.LOG.miss.length !== m1 || r.LOG.line.textContent !== d.gTiltNow(found)) fail(w + ': the right answer on balance ' + (k + 1) + ' is not marked found');
        x.it.concat([x.same]).forEach(bt => { if (bt !== right && !bt.cls.off) fail(w + ': the other buttons of a finished balance are not dimmed'); });
        x.it.concat([x.same]).forEach(bt => { const m2 = r.LOG.miss.length; bt.onclick(); if (r.LOG.miss.length !== m2) fail(w + ': a tap on a finished balance is a mistake'); });
        if (r.LOG.line.textContent !== d.gTiltNow(found)) fail(w + ': a tap on a finished balance counts again');
        if (found < 3 && r.solved()) fail(w + ': solved after ' + found + ' balances');
      });
      if (!r.solved() || r.LOG.solved.join() !== d.gTiltDone) fail(w + ': not solved with gTiltDone after three balances');
    })))));
    if (runs < 50) fail('exec tilt: only ' + runs + ' runs — the combinations were not played');
  }

  /* ================= 第 3 關：用同一個杯子量（範例 3） ================= */
  {
    const J = D.CUPS_JAR, R = D.CUP_ROW, Cb = D.CUP_BTN, H = D.CUPS_H;
    let sawBig = false, sawSmall = false, sawSame = false, sawTrap = false;
    const rowBox = cx => ({ x:cx - R.w / 2, y:R.y, w:R.w, h:R.h });
    const btnBox = (i, big) => box(Cb.x[i], Cb.y, big ? Cb.big : Cb.small, big ? Cb.big : Cb.small);
    [[0, false], [1, true]].forEach(() => {});
    [[false, true], [true, false]].forEach(sides => { const bb = sides.map((big, i) => btnBox(i, big)); bb.forEach((x, i) => inside(x, 'cups: cup button ' + i, W, H)); noHits(bb, 'cups: the two cup buttons'); bb.forEach(x => { if (hit(x, rowBox(J.ax)) || hit(x, rowBox(J.bx))) fail('cups: a cup button covers a cup row'); }); });
    inside(rowBox(J.ax), 'cups: row A', W, H); inside(rowBox(J.bx), 'cups: row B', W, H);
    if (hit(rowBox(J.ax), rowBox(J.bx))) fail('cups: the two cup rows overlap');
    const lab = cx => ({ x:cx - J.lblW / 2, y:J.lblY, w:J.lblW, h:J.lblH });
    if (hit(lab(J.ax), lab(J.bx))) fail('cups: the two labels overlap');
    if (lab(J.ax).y + J.lblH > R.y) fail('cups: the labels run into the cup rows');
    D.GAME_CUPS.forEach((e, i) => {
      const w = 'GAME_CUPS[' + i + ']';
      if (!(CT[e.a] && CT[e.b]) || e.a === e.b) return fail(w + ': not two different containers');
      const unit = e.big ? 2 : 1;
      if (cap(e.a) % unit || cap(e.b) % unit) return fail(w + ': measured with the big cup, but a container does not take a whole number of big cups');
      const na = cap(e.a) / unit, nb = cap(e.b) / unit;
      if (e.big) sawBig = true; else sawSmall = true;
      if (na === nb) sawSame = true;
      if (na !== nb && ht(na > nb ? e.b : e.a) > ht(na > nb ? e.a : e.b)) sawTrap = true;
      const dA = ownDims(CT[e.a], 0), dB = ownDims(CT[e.b], 0);
      const Ab = { x:J.ax - CT[e.a].w / 2 - 14, y:J.top, w:dA.w, h:dA.h }, Bb = { x:J.bx - CT[e.b].w / 2 - 14, y:J.top, w:dB.w, h:dB.h };
      inside(Ab, w + ' jar A', W, H); inside(Bb, w + ' jar B', W, H);
      if (hit(Ab, Bb)) fail(w + ': the two jars overlap');
      if (J.lblY < J.top + Math.max(dA.h, dB.h)) fail(w + ': the labels sit on the jars');
      const pxv = e.big ? D.CUP_PX_BIG : D.CUP_PX_SMALL, per = e.big ? R.bigPer : R.smallPer;
      [na, nb].forEach(n => { const s2 = svgWH(D.rowSVG(n, D.CUP_ICON, pxv, per)); if (!s2 || s2.w > R.w || s2.h > R.h) fail(w + ': ' + n + ' cups at ' + pxv + 'px, ' + per + ' a row, are ' + JSON.stringify(s2) + ' — bigger than the ' + R.w + '×' + R.h + ' row'); });
      LANGS.forEach(L => {
        const d = I18N[L], A = fCName(e.a, L), Bn = fCName(e.b, L), wl = w + ' ' + L;
        for (let n = 0; n <= Math.max(na, nb); n++) [e.a, e.b].forEach(id => {
          const t = d.cupLabel(id, n);
          if (lines(t, 14, J.lblW - 4, L) * 14 * 1.15 > J.lblH) fail(wl + ': the label "' + t + '" needs ' + lines(t, 14, J.lblW - 4, L) + ' lines — taller than ' + J.lblH + 'px');
        });
        const own = big => L === 'zh' ? (big ? '大杯子' : '小杯子') : (big ? 'the big cup' : 'the small cup');
        const t = d.gCupWrong(e.a, e.big);
        has(wl + ' gCupWrong', t, A); has(wl + ' gCupWrong', t, own(e.big)); hasNot(wl + ' gCupWrong', t, own(!e.big));
        const done = d.gCupsDone(e.a, na, e.b, nb, e.big);
        seq(wl + ' gCupsDone', done, [na, nb].concat(na === nb ? [] : [Math.max(na, nb), Math.min(na, nb)]));
        has(wl + ' gCupsDone', done, own(e.big)); hasNot(wl + ' gCupsDone', done, own(!e.big));
        if (na === nb){ hasNot(wl + ' gCupsDone', done, MORE[L]); has(wl + ' gCupsDone', done, L === 'zh' ? '一樣多' : 'the same'); }
        else {
          const mo = na > nb ? A : Bn, le = na > nb ? Bn : A, leId = na > nb ? e.b : e.a, moId = na > nb ? e.a : e.b;
          has(wl + ' gCupsDone', done, mo + MORE[L]); hasNot(wl + ' gCupsDone', done, le + MORE[L]);
          const note = L === 'zh' ? le + '比較高，卻比較少' : le + ' is taller, yet holds less';
          if (ht(leId) > ht(moId)) has(wl + ' gCupsDone', done, note); else hasNot(wl + ' gCupsDone', done, L === 'zh' ? '卻比較少' : 'yet holds less');
        }
        for (let left = 1; left <= nb; left++){ seq(wl + ' gCups2', d.gCups2(e.big, left), [left]); has(wl + ' gCups2', d.gCups2(e.big, left), own(e.big)); }
      });
    });
    if (!sawBig || !sawSmall) fail('GAME_CUPS needs both a small-cup and a big-cup entry (otherwise "always the small cup" is never wrong)');
    if (!sawSame) fail('GAME_CUPS needs an entry where both take the same number of cups');
    if (!sawTrap) fail('GAME_CUPS needs an entry where the taller one takes fewer cups');
    LANGS.forEach(L => { const d = I18N[L]; for (let n = 0; n <= 9; n++){ seq('cups ' + L + ' gCupsNow', d.gCupsNow(n), [n]); seq('cups ' + L + ' cupLabel', d.cupLabel(0, n), [n]); }
      if (L === 'en'){ if (!/ 1 cup\b/.test(d.gCupsNow(1)) || !/ 2 cups\b/.test(d.gCupsNow(2))) fail('cups en: "1 cup / 2 cups" plural is wrong: ' + d.gCupsNow(1) + ' / ' + d.gCupsNow(2)); } });
    need('cups', /if \(big !== e\.big\)\{ roundMiss\(d\.gCupWrong\(e\.a, e\.big\)\); return; \}/, 'the other cup is accepted');
    need('cups', /if \(n === nb\) roundSolved\(d\.gCupsDone\(e\.a, na, e\.b, nb, e\.big\)\);/, 'the round is not solved exactly when the right jar is full');
    /* --- 跑起來 --- */
    D.GAME_CUPS.forEach((e, i) => [true, false].forEach(cn => LANGS.forEach(L => {
      const d = I18N[L], w = 'exec cups[' + i + '] ' + (cn ? 'small-left' : 'big-left') + ' ' + L, A = D.CONTAINERS[e.a], Bc = D.CONTAINERS[e.b];
      const unit = e.big ? 2 : 1, na = cap(e.a) / unit, nb = cap(e.b) / unit, pxv = e.big ? D.CUP_PX_BIG : D.CUP_PX_SMALL, per = e.big ? R.bigPer : R.smallPer;
      const r = EXEC('cups', { picks:[i], coins:[cn] }, d); if (!r) return;
      const jars = zonesOf(r, 'gjar'), rows = zonesOf(r, 'gcups'), names = zonesOf(r, 'gname'), btns = btnsOf(r);
      if (jars.length !== 2 || rows.length !== 2 || names.length !== 2 || btns.length !== 2) return fail(w + ': not two jars, two rows, two labels, two cups');
      if (!jarIs(jars[0].innerHTML, e.a, cap(e.a), 0) || !jarIs(jars[1].innerHTML, e.b, 0, 0)) fail(w + ': the left jar is not full / the right one not empty');
      if (!rowIs(rows[0].innerHTML, na, D.CUP_ICON, pxv) || rows[1].innerHTML !== '') fail(w + ': the left row does not show ' + na + ' cups at ' + pxv + 'px');
      if (names[0].textContent !== d.cupLabel(e.a, na) || names[1].textContent !== d.cupLabel(e.b, 0)) fail(w + ': labels ' + names.map(z => z.textContent).join(' / '));
      const bigBtn = btns.filter(b => b.attrs['data-big'] === '1')[0], smallBtn = btns.filter(b => b.attrs['data-big'] === '0')[0];
      if (!bigBtn || !smallBtn) return fail(w + ': no big and small cup');
      if (px(bigBtn.style.width) !== Cb.big || px(smallBtn.style.width) !== Cb.small) fail(w + ': the cup buttons are not ' + Cb.big + ' / ' + Cb.small + ' wide');
      if ((px(smallBtn.style.left) < px(bigBtn.style.left)) !== cn) fail(w + ': coin() does not decide which cup is on the left');
      if (bigBtn.innerHTML.indexOf('font-size:' + D.CUP_PX_BIG + 'px') < 0 || smallBtn.innerHTML.indexOf('font-size:' + D.CUP_PX_SMALL + 'px') < 0) fail(w + ': the cup buttons are not drawn at the two cup sizes');
      const right = e.big ? bigBtn : smallBtn, wrong = e.big ? smallBtn : bigBtn;
      let m0 = r.LOG.miss.length; wrong.onclick();
      if (r.LOG.miss.length !== m0 + 1 || r.LOG.miss[m0] !== d.gCupWrong(e.a, e.big) || !jarIs(jars[1].innerHTML, e.b, 0, 0)) fail(w + ': the other cup is not refused with gCupWrong (or it pours)');
      for (let n = 1; n <= nb; n++){
        if (r.hint2() !== d.gCups2(e.big, nb - n + 1)) fail(w + ': hint 2 at ' + (n - 1) + ' cups is ' + r.hint2());
        m0 = r.LOG.miss.length; right.onclick();
        if (r.LOG.miss.length !== m0) fail(w + ': the right cup is a mistake');
        if (!jarIs(jars[1].innerHTML, e.b, n * unit, 0)) fail(w + ': after ' + n + ' cups the right jar does not hold ' + (n * unit) + ' small cups of water');
        if (!rowIs(rows[1].innerHTML, n, D.CUP_ICON, pxv) || names[1].textContent !== d.cupLabel(e.b, n) || r.LOG.line.textContent !== d.gCupsNow(n)) fail(w + ': after ' + n + ' cups the row / label / line do not say ' + n);
        if (n < nb && r.solved()) fail(w + ': solved after ' + n + ' of ' + nb + ' cups');
        if (n === 1){ m0 = r.LOG.miss.length; wrong.onclick(); if (r.LOG.miss[m0] !== d.gCupWrong(e.a, e.big) || !rowIs(rows[1].innerHTML, 1, D.CUP_ICON, pxv)) fail(w + ': the other cup halfway is not refused'); }
      }
      if (!r.solved() || r.LOG.solved.join() !== d.gCupsDone(e.a, na, e.b, nb, e.big)) fail(w + ': not solved with gCupsDone when the right jar is full');
      const mm = r.LOG.miss.length, html = jars[1].innerHTML; right.onclick(); wrong.onclick();
      if (r.LOG.miss.length !== mm || jars[1].innerHTML !== html) fail(w + ': taps after the round is solved still do something');
    })));
  }

  /* ================= 第 4 關：用一樣的積木秤（範例 4） ================= */
  {
    const K = D.BLK_BAL, Pn = D.BLK_PAN, Tk = D.BLK_TOK, Rw = D.BLK_ROW, H = D.BLOCKS_H;
    const panBox = { x:K.x + G.cx + G.arm - Pn.w / 2, y:K.y + G.pivot + G.hang + 12 - Pn.h, w:Pn.w, h:Pn.h };
    inside(panBox, 'blocks: the right pan\'s drop area', W, H); inside({ x:K.x, y:K.y, w:G.W, h:G.H }, 'blocks: the balance', W, H);
    if (panAt[1] && panAt[0]){
      [0, 1].forEach(t => {
        const rp = panAt[t][1], lp = panAt[t][0];
        const rpb = { x:K.x + rp.cx - 26, y:K.y + rp.top, w:52, h:7 }, lpb = { x:K.x + lp.cx - 26, y:K.y + lp.top, w:52, h:7 };
        if (!(rpb.x >= panBox.x && rpb.x + rpb.w <= panBox.x + panBox.w && rpb.y >= panBox.y && rpb.y <= panBox.y + panBox.h)) fail('blocks: the right pan (tilt ' + t + ') is not under the drop area');
        if (hit(pad(panBox, D.GPAD), lpb)) fail('blocks: the left pan is inside the drop area');
        /* 盤子上方要放得下積木：兩排 BLK_PAN_PX 的積木都在 drop area 裡面 */
        if (rpb.y - 2 * D.BLK_PAN_PX < panBox.y) fail('blocks: two rows of blocks on the raised pan stick out above the drop area');
      });
    }
    const toks = Tk.x.map(x => box(x, Tk.y, Tk.w, Tk.h));
    toks.forEach((t, i) => { inside(t, 'blocks: source ' + i, W, H); if (hit(t, pad(panBox, D.GPAD))) fail('blocks: source ' + i + ' starts inside the pan\'s drop area'); });
    noHits(toks, 'blocks: the two sources');
    const rowB = { x:Rw.x, y:Rw.y, w:Rw.w, h:Rw.h };
    inside(rowB, 'blocks: the row of blocks', W, H); toks.forEach((t, i) => { if (hit(t, rowB)) fail('blocks: source ' + i + ' covers the row of blocks'); });
    if (!(D.GAME_BLOCKS.length >= 4)) fail('GAME_BLOCKS should have at least 4 entries');
    D.GAME_BLOCKS.forEach((id, i) => {
      const w = 'GAME_BLOCKS[' + i + ']';
      if (!IT[id]) return fail(w + ': not a thing');
      if (!(wt(id) >= 2 && wt(id) <= 2 * D.BLK_PAN_PER_ROW)) fail(w + ': ' + wt(id) + ' blocks do not fit in two rows on the pan');
      const s2 = svgWH(D.rowSVG(wt(id), D.BLK_ICON, Rw.px, Rw.per)); if (!s2 || s2.w > Rw.w || s2.h > Rw.h) fail(w + ': the row of ' + wt(id) + ' blocks is ' + JSON.stringify(s2) + ', bigger than ' + Rw.w + '×' + Rw.h);
      LANGS.forEach(L => {
        const d = I18N[L], wl = w + ' ' + L, nm = fIName(id, L), n = wt(id);
        has(wl + ' gBlkShort', d.gBlkShort(id), nm); if (/\d/.test(d.gBlkShort(id))) fail(wl + ': gBlkShort has a number in it');
        seq(wl + ' gBlkDone', d.gBlkDone(id, n), [n, n]); has(wl + ' gBlkDone', d.gBlkDone(id, n), nm);
        for (let k = 0; k <= n; k++) seq(wl + ' gBlk2 at ' + k, d.gBlk2(id, k, n), k < n ? [n - k] : []);
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      for (let n = 0; n <= 10; n++) seq('blocks ' + L + ' gBlkNow', d.gBlkNow(n), [n]);
      if (L === 'en' && (!/ 1 block\b/.test(d.gBlkNow(1)) || !/ 2 blocks\b/.test(d.gBlkNow(2)) || !/^1 block more/.test(d.gBlk2(0, 1, 2)))) fail('blocks en: "1 block / 2 blocks" plural is wrong');
      [d.gBlkOdd, d.gBlkOver, d.gBlkEmpty, d.gBlkBtn].forEach(t => { if (bad(t) || !t || /\d/.test(t)) fail('blocks ' + L + ': a fixed string is missing or has a number: ' + t); });
      has('blocks ' + L + ' gBlkOdd', d.gBlkOdd, D.BLK_ICON);
      has('blocks ' + L + ' gAsks', d.gAsks.blocks, d.gBlkBtn);
    });
    if (D.BLK_ODD_ICON === D.BLK_ICON) fail('blocks: the different block looks the same as the blocks');
    need('blocks', /if \(P\.data\.k !== 'same'\)\{ roundMiss\(d\.gBlkOdd\); return false; \}/, 'the different block is accepted');
    need('blocks', /if \(n >= wt\)\{ roundInfo\(d\.gBlkOver\); return false; \}/, 'a block after level is accepted (or counted as a mistake)');
    need('blocks', /if \(n < wt\)\{ roundMiss\(d\.gBlkShort\(id\)\); return; \}\s*doneBtn\.disabled = true;\s*roundSolved\(d\.gBlkDone\(id, wt\)\);/, 'Level is accepted before the balance is level');
    /* --- 跑起來 --- */
    D.GAME_BLOCKS.forEach((id, i) => [true, false].forEach(cn => LANGS.forEach(L => {
      const d = I18N[L], w = 'exec blocks[' + i + '] ' + (cn ? 'same-left' : 'odd-left') + ' ' + L, n0 = wt(id), it = D.ITEMS[id];
      const r = EXEC('blocks', { picks:[i], coins:[cn] }, d); if (!r) return;
      const bal = zonesOf(r, 'gbal')[0], row = zonesOf(r, 'gcups')[0];
      const same = r.LOG.pieces.filter(P => P.data.k === 'same')[0], odd = r.LOG.pieces.filter(P => P.data.k === 'odd')[0];
      if (!bal || !row || !same || !odd || !r.LOG.action) return fail(w + ': no balance / row / two sources / Level button');
      if (same.text !== D.BLK_ICON || odd.text !== D.BLK_ODD_ICON) fail(w + ': the sources are not ' + D.BLK_ICON + ' and ' + D.BLK_ODD_ICON);
      if ((same.homeX < odd.homeX) !== cn) fail(w + ': coin() does not decide which source is on the left');
      if (!balIs(bal.innerHTML, id, 0, 1) || !rowIs(row.innerHTML, 0, D.BLK_ICON, Rw.px)) fail(w + ': the start is not the thing alone, its side down');
      const mid = { x:panBox.x + panBox.w / 2, y:panBox.y + panBox.h / 2 };
      r.LOG.action.f();
      if (r.LOG.miss.length || r.solved() || r.msg() !== d.gBlkEmpty) fail(w + ': Level with no blocks should only remind');
      /* 盤子的範圍：每 3px 一點，範圍外放開什麼都不做 */
      let badP = 0;
      for (let x = 0; x <= W; x += 3) for (let y = 0; y <= H; y += 3){ if (inBox({ x, y }, panBox, D.GPAD)) continue; const g = r.LOG.drop(same, { x, y }); if (g !== false || r.LOG.miss.length || r.LOG.info.length) badP++; }
      if (badP) fail(w + ': ' + badP + ' drops away from the pan do something');
      /* 盤子範圍裡面的每一點（每 6px，各開一局）都要收（codex 第一輪：只放中心的話，只收中間一條也是綠的） */
      if (cn && L === 'zh'){
        let miss = 0;
        for (let x = panBox.x - D.GPAD; x <= panBox.x + panBox.w + D.GPAD; x += 6) for (let y = panBox.y - D.GPAD; y <= panBox.y + panBox.h + D.GPAD; y += 6){
          if (x > W) continue;
          const q = EXEC('blocks', { picks:[i], coins:[cn] }, d); if (!q) continue;
          if (q.LOG.drop(q.LOG.pieces.filter(P => P.data.k === 'same')[0], { x, y }) !== true) miss++;
        }
        if (miss) fail(w + ': ' + miss + ' points inside the pan\'s drop area do not take a block');
      }
      let m0 = r.LOG.miss.length;
      if (r.LOG.drop(odd, Object.assign({}, mid)) !== false || r.LOG.miss[m0] !== d.gBlkOdd) fail(w + ': the different block is not refused with gBlkOdd');
      for (let n = 1; n <= n0; n++){
        if (r.hint2() !== d.gBlk2(id, n - 1, n0)) fail(w + ': hint 2 at ' + (n - 1) + ' blocks is ' + r.hint2());
        const tap = n % 2 === 0, k0 = r.LOG.kept;
        m0 = r.LOG.miss.length;
        if (r.LOG.drop(same, Object.assign({ tap:tap }, mid)) !== true || r.LOG.miss.length !== m0) { fail(w + ': block ' + n + ' is refused'); break; }
        if (!balIs(bal.innerHTML, id, n, n < n0 ? 1 : 0)) fail(w + ': after ' + n + ' blocks the balance is not drawn with ' + n + ' blocks, tilt ' + (n < n0 ? 1 : 0));
        if (!rowIs(row.innerHTML, n, D.BLK_ICON, Rw.px) || r.LOG.line.textContent !== d.gBlkNow(n)) fail(w + ': after ' + n + ' blocks the row / line do not say ' + n);
        if ((r.LOG.kept === k0 + 1) !== tap) fail(w + ': keepSelected after a ' + (tap ? 'tap' : 'drag') + ' is wrong');
        if (r.solved()) fail(w + ': a block solved the round (Level must be pressed)');
        if (n < n0){ m0 = r.LOG.miss.length; r.LOG.action.f(); if (r.LOG.miss[m0] !== d.gBlkShort(id) || r.solved()) fail(w + ': Level at ' + n + ' of ' + n0 + ' is not refused with gBlkShort'); }
      }
      if (r.hint2() !== d.gBlk2(id, n0, n0)) fail(w + ': hint 2 at level is ' + r.hint2());
      m0 = r.LOG.miss.length; const i0 = r.LOG.info.length;
      if (r.LOG.drop(same, Object.assign({}, mid)) !== false || r.LOG.miss.length !== m0 || r.LOG.info[i0] !== d.gBlkOver || !balIs(bal.innerHTML, id, n0, 0)) fail(w + ': a block after level is not refused with gBlkOver (no mistake, nothing added)');
      r.LOG.action.f();
      if (!r.solved() || r.LOG.solved.join() !== d.gBlkDone(id, n0) || !r.LOG.action.b.disabled) fail(w + ': Level at ' + n0 + ' does not solve with gBlkDone');
    })));
  }

  /* ================= 第 5 關：排排看（範例 3＋4） ================= */
  {
    const S = D.RANK_SLOT, Cd = D.RANK_CARD, H = D.RANK_H;
    const slotB = S.x.map(x => box(x, S.y, S.w, S.h));
    slotB.forEach((b, k) => inside(b, 'rank: box ' + (k + 1), W, H)); noHits(slotB, 'rank: two boxes');
    for (let k = 1; k < slotB.length; k++){ const gap = slotB[k].x - (slotB[k - 1].x + slotB[k - 1].w); if (!(gap > 0 && gap < 2 * D.GPAD)) fail('rank: the gap between box ' + k + ' and ' + (k + 1) + ' is ' + gap + ' — it must be > 0 and < 2 × GPAD so the drop pads overlap (nearest-box rule exercised)'); }
    const x0 = (W - 2 * Cd.step) / 2, cards = [0, 1, 2].map(k => box(x0 + k * Cd.step, Cd.y, Cd.w, Cd.h));
    cards.forEach((c, k) => { inside(c, 'rank: card ' + k, W, H); slotB.forEach(sb => { if (hit(c, pad(sb, D.GPAD))) fail('rank: card ' + k + ' starts inside a box\'s drop pad'); }); });
    noHits(cards, 'rank: two cards');
    if (Cd.w > S.w || Cd.h > S.h) fail('rank: a card is bigger than a box');
    const lbl = { x:8, y:6, w:W - 16, h:26 }; slotB.forEach(sb => { if (hit(lbl, sb)) fail('rank: the label covers a box'); });
    if (!(D.GAME_RANK.length >= 5)) fail('GAME_RANK should have at least 5 sets');
    const cats = {};
    D.GAME_RANK.forEach((set, i) => {
      const w = 'GAME_RANK[' + i + ']', cat = set.cat;
      if (cat !== 'C' && cat !== 'I') return fail(w + ': unknown catalogue ' + cat);
      cats[cat] = true;
      const T = cat === 'C' ? CT : IT;
      if (set.ids.length !== 3 || new Set(set.ids).size !== 3 || !set.ids.every(id => T[id])) return fail(w + ': not three different things');
      const val = id => truth(cat, id), look = id => cat === 'C' ? ht(id) : sz(id);
      const vals = set.ids.map(val);
      if (new Set(vals).size !== 3) return fail(w + ': two of them measure the same');
      const order = set.ids.slice().sort((a, b) => val(b) - val(a));
      const biggest = set.ids.slice().sort((a, b) => look(b) - look(a));
      if (look(biggest[0]) === look(biggest[1]) && val(biggest[1]) === val(order[0])) fail(w + ': tied for tallest/biggest with the one that has the most');
      if (biggest[0] === order[0]) fail(w + ': the ' + (cat === 'C' ? 'tallest' : 'biggest') + ' one also has the most — sorting by looks gives the right first card');
      const byLook = set.ids.slice().sort((a, b) => look(b) - look(a) || 0).map(val);
      if (byLook.join() === order.map(val).join()) fail(w + ': sorting by looks gives the right order');
      LANGS.forEach(L => {
        const d = I18N[L], wl = w + ' ' + L;
        set.ids.forEach(id => {
          const q = d.gRankQty(cat, id);
          seq(wl + ' gRankQty', q, [val(id)]);
          if (textW(q, 15) > Cd.w - 10) fail(wl + ': the card text "' + q + '" is about ' + textW(q, 15).toFixed(0) + 'px, the card is ' + Cd.w);
          if (cat === 'C'){ const c = CT[id]; if (c.w * D.RANK_JAR > D.RANK_PIC.w || c.h * D.RANK_JAR > D.RANK_PIC.h - 2) fail(wl + ': the small jar ' + id + ' does not fit the card picture'); if (q.indexOf(c.icon) < 0) fail(wl + ': the card does not show which container it is'); }
          else if (14 + sz(id) * 4 > 54) fail(wl + ': thing ' + id + ' is too big for the card picture');
          const v = d.gRankVal(cat, id); has(wl + ' gRankVal', v, (cat === 'C' ? fCName : fIName)(id, L)); seq(wl + ' gRankVal', v, [val(id)]);
        });
        order.forEach((want, k) => set.ids.forEach(id => {
          if (id === want) return;
          const t = d.gRankWhy(cat, id, want), more = val(id) > val(want), wh = wl + ' put ' + id + ' in box ' + (k + 1);
          seq(wh, t, [val(id), val(want)]);
          const vI = d.gRankVal(cat, id), vW = d.gRankVal(cat, want);
          if (L === 'zh'){ has(wh, t, vI + '比 ' + vW + (more ? '多' : '少') + '：'); has(wh, t, cat === 'C' ? (more ? '裝得少一點的' : '裝得多一點的') : (more ? '輕一點的' : '重一點的')); }
          else {
            const nm = x => (cat === 'C' ? fCName : fIName)(x, 'en'), q = x => cat === 'C' ? fCup(val(x), 'en') : fBlk(val(x), 'en');
            has(wh, t, nm(id) + (cat === 'C' ? ' holds ' : ' weighs ') + q(id) + ', ' + (more ? 'more' : (cat === 'C' ? 'fewer' : 'less')) + ' than ' + nm(want) + '’s ' + q(want) + ' — '); has(wh, t, cat === 'C' ? (more ? 'one that holds less' : 'one that holds more') : (more ? 'lighter one' : 'heavier one')); }
          const note = cat === 'C' ? (L === 'zh' ? '高不代表多' : 'Taller does not mean more') : (L === 'zh' ? '大不代表重' : 'Bigger does not mean heavier');
          if (!more && look(id) > look(want)) has(wh, t, note); else hasNot(wh, t, note);
        }));
        seq(wl + ' gRankDone', d.gRankDone(cat, order), order.map(val));
        order.forEach((id, k) => seq(wl + ' gRank2', d.gRank2(k, cat, id), [k + 1, val(id)]));
        const ttl = cat === 'C' ? d.gRankCap : d.gRankW;
        if (bad(ttl) || textW(ttl, 15) > W - 20) fail(wl + ': the box label is missing or too long: ' + ttl);
      });
    });
    if (!cats.C || !cats.I) fail('GAME_RANK needs both capacity (C) and weight (I) sets');
    need('rank', /var order = set\.ids\.slice\(\)\.sort\(function\(x, y\)\{ return truthOf\(cat, y\) - truthOf\(cat, x\); \}\);/, 'the target order is not most first');
    need('rank', /renderTray\(B, set\.ids\.map\(function\(x\)\{ return -truthOf\(cat, x\); \}\), Cd\.y,/, 'the tray is not shuffled by the NEGATED amounts (shuffle() only refuses ascending, and the answer here is descending)');
    /* shuffle()：托盤一開始不可以已經是正解的順序。用「一定洗回原樣」的假亂數跑每一組，再用真亂數跑 2000 次 */
    {
      const fsrc = extractFunction(src, 'shuffle');
      if (!fsrc) fail('cannot find shuffle() in index.html');
      else {
        try {
          const fake = Object.create(Math); fake.random = () => 0.999999;
          const forced = new Function('Math', fsrc + '\nreturn shuffle;')(fake), real = new Function(fsrc + '\nreturn shuffle;')();
          const up = a => a.every((v, j) => j === 0 || a[j - 1] < v);
          D.GAME_RANK.forEach((set, i) => {
            const keys = set.ids.map(id => -truth(set.cat, id)).sort((a, b) => a - b);
            const out = forced(keys);
            if (up(out) || out.slice().sort((a, b) => a - b).join() !== keys.join()) fail('GAME_RANK[' + i + ']: shuffle() of a tray already in answer order leaves it so (' + out.join(',') + ')');
            for (let r = 0; r < 2000; r++){ const o = real(keys); if (up(o)){ fail('GAME_RANK[' + i + ']: shuffle() produced a tray already in answer order'); break; } }
          });
        } catch (e){ fail('shuffle() could not run: ' + e.message); }
      }
    }
    /* --- 跑起來：每一張卡進每一個空格，再整組照順序放 --- */
    D.GAME_RANK.forEach((set, i) => LANGS.forEach(L => [[0.1, 0.1], [0.9, 0.5], [0.4, 0.9]].forEach((rnd, ri) => {
      const d = I18N[L], w = 'exec rank[' + i + '.' + ri + '] ' + L, cat = set.cat, val = id => truth(cat, id);
      const order = set.ids.slice().sort((a, b) => val(b) - val(a));
      const r = EXEC('rank', { picks:[i], rnd:rnd }, d); if (!r) return;
      const cards = r.LOG.pieces;
      if (cards.length !== 3 || cards.map(P => P.data.id).sort().join() !== set.ids.slice().sort().join()) return fail(w + ': the tray does not hold the three cards');
      /* 卡片的畫：容器是真實寬高 × RANK_JAR 的長方形（看得出高矮），東西照它的大小；下面寫量出來的數 */
      cards.forEach(P => {
        const id = P.data.id, h = String(P.html);
        const picOk = cat === 'C'
          ? new RegExp('<rect x="[\\d.]+" y="[\\d.]+" width="' + (CT[id].w * D.RANK_JAR) + '" height="' + (CT[id].h * D.RANK_JAR) + '"').test(h)
          : h.indexOf('font-size:' + (14 + sz(id) * 4) + 'px">' + IT[id].icon + '</span>') >= 0;
        if (!picOk || h.indexOf('<div class="gqty">' + d.gRankQty(cat, id) + '</div>') < 0) fail(w + ': card ' + id + ' does not show its picture at its true size and its amount');
      });
      const tray = cards.slice().sort((a, b) => a.homeX - b.homeX).map(P => val(P.data.id));
      if (tray.every((v, j) => j === 0 || tray[j - 1] > v)) fail(w + ': the tray starts already in order (' + tray.join(',') + ')');
      const lab = r.LOG.zones.filter(z => z.className === 'glbl')[0];
      if (!lab || lab.textContent !== (cat === 'C' ? d.gRankCap : d.gRankW)) fail(w + ': the box label does not say what is ranked');
      if (ri === 0) order.forEach((want, k) => set.ids.forEach(id => {
        const q = EXEC('rank', { picks:[i], rnd:rnd }, d); if (!q) return;
        const P = q.LOG.pieces.filter(x => x.data.id === id)[0], got = q.LOG.drop(P, { x:S.x[k], y:S.y });
        if (id === want){ if (got !== true || !P.locked || q.LOG.miss.length) fail(w + ': ' + id + ' is refused in the empty box ' + (k + 1)); }
        else if (got !== false || P.locked || q.LOG.miss.join() !== d.gRankWhy(cat, id, want)) fail(w + ': ' + id + ' in the empty box ' + (k + 1) + ' is not refused with gRankWhy');
      }));
      S.x.forEach((x, k) => {
        if (r.hint2() !== d.gRank2(k, cat, order[k])) fail(w + ': hint 2 before box ' + (k + 1) + ' is ' + r.hint2());
        const right = cards.filter(P => P.data.id === order[k])[0];
        if (r.LOG.drop(right, { x, y:S.y, tap:k === 1 }) !== true || !right.locked || right.cx !== x || right.cy !== S.y) fail(w + ': ' + order[k] + ' is not locked in box ' + (k + 1));
        const other = cards.filter(P => !P.locked)[0];
        if (other){ const m1 = r.LOG.miss.length; if (r.LOG.drop(other, { x, y:S.y }) !== false || r.LOG.miss.length !== m1) fail(w + ': a drop on the filled box ' + (k + 1) + ' is not silent'); }
        if (k < 2 && r.solved()) fail(w + ': solved after ' + (k + 1) + ' boxes');
        if (r.LOG.line.textContent !== order.map((id, j) => j <= k ? d.gRankQty(cat, id) : '□').join(' > ')) fail(w + ': the line says ' + r.LOG.line.textContent);
      });
      if (!r.solved() || r.LOG.solved.join() !== d.gRankDone(cat, order)) fail(w + ': not solved with gRankDone');
    })));
  }

  /* --- 家長頁的精熟標準要說出遊戲現在的名字（改名之後那一句不可以留著舊的） --- */
  {
    const fs2 = require('fs'), path = require('path');
    let par = '';
    try { par = fs2.readFileSync(path.join(path.dirname(process.argv[2]), 'parents.html'), 'utf8'); } catch (e){ fail('cannot read parents.html: ' + e.code); }
    LANGS.forEach(L => {
      const name = I18N[L].s6h2, block = (par.match(L === 'zh' ? /"zh":\s*\{[\s\S]*?"readyBox":\s*"((?:[^"\\]|\\.)*)"/ : /"en":\s*\{[\s\S]*?"readyBox":\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || '';
      if (!name || block.indexOf(name) < 0) fail('parents.html ' + L + ' readyBox does not name the game "' + name + '"');
    });
    if (/排排看大挑戰|Line-Them-Up/.test(par)) fail('parents.html still names the old game');
  }
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/capacity-weight */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    /* mix4 這條路（cupDiff／blockDiff）的誘答本來就兩兩不同，所以「拿掉去重」
       什麼事都不會發生 —— 要證明守門的是 distinctOpts，就直接塞一個重複進去。 */
    { file:'review', expect:'two options are the same answer',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out.slice(0, 2)).concat([out[0]]));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    { file:'review', expect:'option count',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out.slice(0, 2)));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    /* fixed4 那條路（另外八個產生器）也要有自己的證明。 */
    { file:'review', expect:'two options are the same answer',
      find:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct, correct].concat(others.slice(0, 2)));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    /* 候選被清空時，保底補上來的都是「正解附近的數」——
       cupDiff／blockDiff 一定要留著「答成題目給的那個數」那個誘答，不然迷思沒了。 */
    { file:'review', expect:'needs the',
      find:'    (cands || []).forEach(function(v){',
      replace:'    [].forEach(function(v){' },
    /* 去重鍵如果認不出「是哪一個容器／東西」，判斷題的誘答清單會被整組濾掉，
       選項只剩三個。（ord／rel／mt 那幾個分支走的是 fixed4，選項清單是逐一列出來的，
       由設定檔自己的 keyOf ＋ optSetIs 把關，不經過 vkeyOf。） */
    { file:'review', expect:'option count',
      find:"    if (v.u === 'pick') return 'pick#' + v.cat + '#' + v.id;",
      replace:"    if (v.u === 'pick') return 'pick';" },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"  function nCup(n, lang){ return lang === 'zh' ? (n + ' 杯') : (n + (n === 1 ? ' cup' : ' cups')); }",
      replace:"  function nCup(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' cup' : ' cups')); }" },
    { file:'review', expect:'bad option shape',
      find:"  function nBlk(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' block' : ' blocks')); }",
      replace:"  function nBlk(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + ' blocks'); }" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        ? (iName(v.id, lang) + (lang === 'zh' ? '比較重' : ' is heavier'))",
      replace:"        ? (iName(v.id, lang) + (lang === 'zh' ? '比較輕' : ' is heavier'))" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (lang === 'zh') return v.dom === 'cap' ? '兩個一樣多' : '兩個一樣重';",
      replace:"      if (lang === 'zh') return v.dom === 'cap' ? '兩個一樣重' : '兩個一樣重';" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        ? (bName(v.a, 'zh') + '比 ' + bName(v.b, 'zh') + '重')",
      replace:"        ? (bName(v.b, 'zh') + '比 ' + bName(v.a, 'zh') + '重')" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      return v.ids.map(function(id){ return nameOf(v.cat, id, lang); }).join(' → ');",
      replace:"      return v.ids.slice().reverse().map(function(id){ return nameOf(v.cat, id, lang); }).join(' → ');" },
    /* 名稱表打錯字（水壺 → 水壼）：後面每一句話用的都是同一本字典，
       只有逐字比對真值表才抓得到。 */
    { file:'review', expect:'bad option shape',
      find:"    { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壺',   en:'kettle' },",
      replace:"    { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壼',   en:'kettle' }," },
    { file:'review', expect:'bad option shape',
      find:"    { icon:'🪨', wt:9,  size:1, zh:'石頭',     en:'stone'      },",
      replace:"    { icon:'🪨', wt:9,  size:1, zh:'石頭',     en:'rock'       }," },

    /* --- review.html：課程規則本身被改壞 --- */
    /* 選項必須屬於「這一題自己的兩個容器」。少了這一條，倒水題會冒出一個
       題幹根本沒提到的容器 —— 形狀對、去重也過，孩子卻看到不相干的答案。 */
    { file:'review', expect:'but this question needs',
      find:"        var pool = [VP('C', a), VP('C', b), VS('cap'), VN('cap')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };",
      replace:"        var pool = [VP('C', a), VP('C', (b + 1) % CONTAINERS.length), VS('cap'), VN('cap')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };" },
    /* 「沉下去的比較重」講反了。 */
    { file:'review', expect:'correct is',
      find:'        var correct = wa > wb ? VP(\'I\', a) : (wa < wb ? VP(\'I\', b) : VS(\'w\'));\n        var pool = [VP(\'I\', a), VP(\'I\', b), VS(\'w\'), VN(\'w\')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'        var correct = wa > wb ? VP(\'I\', b) : (wa < wb ? VP(\'I\', a) : VS(\'w\'));\n        var pool = [VP(\'I\', a), VP(\'I\', b), VS(\'w\'), VN(\'w\')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };' },
    /* 「倒出來滿出來的比較多」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = ca > cb ? VP('C', a) : (ca < cb ? VP('C', b) : VS('cap'));",
      replace:"        var correct = ca > cb ? VP('C', b) : (ca < cb ? VP('C', a) : VS('cap'));" },
    /* 「同一個杯子，杯數多的比較多」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = na > nb ? VP('C', a) : (na < nb ? VP('C', b) : VS('cap'));",
      replace:"        var correct = na > nb ? VP('C', b) : (na < nb ? VP('C', a) : VS('cap'));" },
    /* 「一樣的積木，個數多的比較重」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = na > nb ? VP('I', a) : (na < nb ? VP('I', b) : VS('w'));",
      replace:"        var correct = na > nb ? VP('I', b) : (na < nb ? VP('I', a) : VS('w'));" },
    /* sameCup 的杯數必須就是容器自己的杯數，不可以另外編一組。 */
    { file:'review', expect:'is not the container’s own cup count',
      find:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var correct = na > nb ? VP(\'C\', a) : (na < nb ? VP(\'C\', b) : VS(\'cap\'));',
      replace:'        var na = CONTAINERS[a].cap + 1, nb = CONTAINERS[b].cap;\n        var correct = na > nb ? VP(\'C\', a) : (na < nb ? VP(\'C\', b) : VS(\'cap\'));' },
    /* blockWeigh 的積木數必須就是東西自己的積木數。 */
    { file:'review', expect:'is not the item’s own block count',
      find:'        var na = ITEMS[a].wt, nb = ITEMS[b].wt;\n        var correct = na > nb ? VP(\'I\', a) : (na < nb ? VP(\'I\', b) : VS(\'w\'));',
      replace:'        var na = ITEMS[a].wt + 1, nb = ITEMS[b].wt;\n        var correct = na > nb ? VP(\'I\', a) : (na < nb ? VP(\'I\', b) : VS(\'w\'));' },
    /* **這一課最貴的一條**：大杯的杯數如果不比小杯少，「沒辦法比」就是錯的 ——
       3 大杯一定多過 2 小杯，孩子照著正確推理反而會被判錯。 */
    { file:'review', expect:'the big-cup count must be smaller',
      find:'        var nb = 3 + rand(6);          /* 小杯 3~8 杯 */\n        var na = 2 + rand(nb - 2);     /* 大杯 2~(小杯 − 1) 杯 */',
      replace:'        var nb = 3 + rand(6);          /* 小杯 3~8 杯 */\n        var na = nb + 1 + rand(3);     /* 大杯 2~(小杯 − 1) 杯 */' },
    /* diffCup 一定要用沒有名字的兩個瓶子。 */
    { file:'review', expect:'must use the unlabelled jars',
      find:'        var a = 0, b = 1;              /* 沒有名字的兩個瓶子，別題不會提到它們的杯數 */',
      replace:'        var a = 0, b = 0;              /* 沒有名字的兩個瓶子，別題不會提到它們的杯數 */' },
    /* 選項換回有固定杯數的容器 → 讀過整課的孩子可以從別題把答案推出來。 */
    { file:'review', expect:'but this question needs',
      find:"        var mix = fixed4(correct, [VP('U', a), VP('U', b), VS('cap')]);",
      replace:"        var mix = fixed4(correct, [VP('C', a), VP('C', b), VS('cap')]);" },
    /* 傳遞題的正解方向反了（丙比甲重）。 */
    { file:'review', expect:'correct is',
      find:'        var correct = RL(a, c);\n        var mix = fixed4(correct, [RL(c, a), VS(\'w\'), VN(\'w\')]);',
      replace:'        var correct = RL(c, a);\n        var mix = fixed4(correct, [RL(a, c), VS(\'w\'), VN(\'w\')]);' },
    /* 傳遞題三個箱子必須不一樣，不然線索接不起來。 */
    { file:'review', expect:'the three boxes must all differ',
      find:"        var rest = shuffle([0,1,2,3].filter(function(x){ return x !== first; })).slice(0, 2);",
      replace:"        var rest = [first, first];" },
    /* 排順序：三個值必須兩兩不同，不然「唯一的正確順序」不成立。 */
    { file:'review', expect:'the three measurements must all differ',
      find:'          (byVal[v] = byVal[v] || []).push(k);',
      replace:'          (byVal[k] = byVal[k] || []).push(k);' },
    /* 排順序的正解如果不是照真值排的，就是把答案寫死了。 */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var order = ids.slice().sort(function(x, y){ return valOf(y) - valOf(x); });',
      replace:'        var order = ids.slice();' },
    /* 差幾杯／差幾個：na ＝ 2 × nb 時，「答成小的那個數」剛好等於正確答案 ——
       誘答變成第二個正解。組合表把它濾掉，這一筆證明那個濾網真的在擋。 */
    { file:'review', expect:'must not be twice',
      find:'        if (a > b && a !== 2 * b) out.push([i, j]);',
      replace:'        if (a > b) out.push([i, j]);' },
    /* 第一個一定要比第二個多，不然差會變成負的或 0。 */
    { file:'review', expect:'must take more',
      find:'        var a = valOf(i), b = valOf(j);\n        if (a > b && a !== 2 * b) out.push([i, j]);',
      replace:'        var a = valOf(i), b = valOf(j);\n        if (a !== b && a !== 2 * b) out.push([i, j]);' },
    /* 差幾杯的正解算成加的。 */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var diff = na - nb;',
      replace:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var diff = na + nb;' },
    /* 「該怎麼比」的正解換成一個已經在誘答清單裡的方法 → 選項塌成三個。 */
    { file:'review', expect:'two options are the same answer',
      find:"        var correct = dom === 'cap' ? MT(0) : MT(4);",
      replace:"        var correct = dom === 'cap' ? MT(1) : MT(4);" },
    /* 「把甲裝滿倒進乙」也是對的做法，放進誘答就有兩個正解 ——
       這裡改成把「用同一個杯子量」也放進容量題的誘答清單。 */
    { file:'review', expect:'the option set is',
      find:"        var others = dom === 'cap' ? [MT(1), MT(2), MT(3)] : [MT(5), MT(6), MT(1)];",
      replace:"        var others = dom === 'cap' ? [MT(1), MT(2), MT(5)] : [MT(5), MT(6), MT(1)];" },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? (d.na + ' － ' + d.nb + ' ＝ ' + d.diff + '，' + na + '多裝 ' + nCup(d.diff, 'zh') + '。')",
      replace:"            ? (d.na + ' － ' + d.nb + ' ＝ ' + d.diff + '，' + na + '多裝' + nCup(d.diff, 'zh') + '。')" },
    { file:'review', expect:'doubled punctuation',
      find:"            : (d.na + ' − ' + d.nb + ' = ' + d.diff + ', so ' + na + ' took ' + nCup(d.diff, 'en') + ' more.')",
      replace:"            : (d.na + ' − ' + d.nb + ' = ' + d.diff + ', so ' + na + ' took ' + nCup(d.diff, 'en') + ' more..')" },

    /* --- index.html：名稱表與資料 --- */
    { file:'index', expect:'does not match the drawn size',
      find:"    { icon:'🏺', w:30,  h:100, cap:5 },",
      replace:"    { icon:'🏺', w:30,  h:100, cap:6 }," },
    { file:'index', expect:'the checker expects',
      find:"      cn:['水壺','花瓶','玻璃杯','碗','水桶','瓶子'],",
      replace:"      cn:['水壺','花瓶','杯子','碗','水桶','瓶子']," },
    { file:'index', expect:'the checker expects',
      find:"      it:['strawberry','balloon','apple','orange','potato','teddy bear','stone','watermelon'],",
      replace:"      it:['strawberry','balloon','apple','orange','potato','teddy','stone','watermelon']," },
    { file:'index', expect:'must be a whole number',
      find:"    { icon:'🍶', w:50,  h:60,  cap:5 }",
      replace:"    { icon:'🍶', w:50,  h:30.5,  cap:5 }" },
    /* 箱子的重量必須兩兩不同，不然線索接龍會有兩個正確順序。 */
    { file:'index', expect:'must all weigh differently',
      find:"    { icon:'🟩', wt:6 }",
      replace:"    { icon:'🟩', wt:8 }" },

    /* --- index.html：範例資料 --- */
    { file:'index', expect:'POUR_CASES must cover',
      find:'    { a:1, b:5 }   /* 🏺 花瓶(5，高) → 🍶 瓶子(5，矮)：剛好裝滿 → 一樣多 */',
      replace:'    { a:0, b:2 }   /* 🏺 花瓶(5，高) → 🍶 瓶子(5，矮)：剛好裝滿 → 一樣多 */' },
    { file:'index', expect:'BAL_CASES must cover',
      find:'    { a:2, b:3 }   /* 🍎 蘋果(4) vs 🍊 橘子(4) → 平的 → 一樣重 */',
      replace:'    { a:2, b:5 }   /* 🍎 蘋果(4) vs 🍊 橘子(4) → 平的 → 一樣重 */' },
    { file:'index', expect:'the taller one must hold less',
      find:'  var CUP_EX = { a:1, b:3 };            /* 🏺 花瓶 5 杯 vs 🥣 碗 6 杯：高的反而少 */',
      replace:'  var CUP_EX = { a:0, b:2 };            /* 🏺 花瓶 5 杯 vs 🥣 碗 6 杯：高的反而少 */' },
    { file:'index', expect:'the big-cup count must be smaller',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:6, b:1, nb:5 };' },
    /* 杯數跑出這一課看得到的範圍。 */
    { file:'index', expect:'outside the 1~9 this lesson ever shows',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:3, b:1, nb:12 };' },
    /* 警告圖換回「別處已經量過」的容器（水桶＝索引 4）—— 那時「還不知道」
       就不再是唯一正解，因為別題已經給過那個容器的杯數。 */
    { file:'index', expect:'CUP_WARN.b index 4 is outside',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:3, b:4, nb:5 };' },
    /* 沒有名字的瓶子被改名成有名字的容器。 */
    { file:'index', expect:'the checker expects',
      find:"      un:['甲瓶','乙瓶'],",
      replace:"      un:['水壺','水桶'],", },
    { file:'index', expect:'BLK_CASES needs one pair where the bigger thing is lighter',
      find:'    { a:1, b:6 }   /* 🎈 氣球 1 個 vs 🪨 石頭 9 個（再看一次大 ≠ 重） */',
      replace:'    { a:0, b:6 }   /* 🎈 氣球 1 個 vs 🪨 石頭 9 個（再看一次大 ≠ 重） */' },
    /* 結論句沒有講出答案。 */
    { file:'index', expect:'p1s2 zh states',
      find:"        if (ca > cb) return '水滿出來 → <span class=\"bigans\">' + this.cName(c.a) + '裝得比較多</span>' + note;",
      replace:"        if (ca > cb) return '水滿出來 → <span class=\"bigans\">' + this.cName(c.b) + '裝得比較多</span>' + note;" },
    { file:'index', expect:'p2s2 zh states',
      find:"        if (wa > wb) return '沉下去的是左邊 → <span class=\"bigans\">' + this.iName(c.a) + '比較重</span>' + note;",
      replace:"        if (wa > wb) return '沉下去的是左邊 → <span class=\"bigans\">' + this.iName(c.b) + '比較重</span>' + note;" },
    /* 「高不代表多」那句註解如果永遠只寫同一種，一半的情況在說謊。 */
    { file:'index', expect:'the wrong height note',
      find:"        return tallCap > otherCap\n          ? '（這次比較高的 ' + tallName + '真的裝比較多，可是不能只看高矮。）'\n          : '（比較高的是 ' + tallName + '，卻沒有裝比較多 —— 高不代表多。）';",
      replace:"        return '（比較高的是 ' + tallName + '，卻沒有裝比較多 —— 高不代表多。）';" },
    { file:'index', expect:'the wrong size note',
      find:"        return bigWt > otherWt\n          ? '（這次比較大的 ' + bigName + '真的比較重，可是不能只看大小。）'\n          : '（比較大的是 ' + bigName + '，卻沒有比較重 —— 大不代表重。）';",
      replace:"        return '（比較大的是 ' + bigName + '，卻沒有比較重 —— 大不代表重。）';" },
    { file:'index', expect:'p3End zh states',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '裝得比較多</span>';",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + this.cName(e.a) + '裝得比較多</span>';" },
    { file:'index', expect:'p4s3 zh states',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>（積木要一樣的才能比）';",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + this.iName(c.a) + '比較重</span>（積木要一樣的才能比）';" },
    /* 間接比較的說明一定要提到「同一個杯子／一樣的積木」，否則規則就沒有前提了。 */
    { file:'index', expect:'never says the cup must be the same one',
      find:"      p3s0:function(e){ return '用同一個 🥤 小杯子。先把 ' + this.cName(e.a) + '裝滿，按「再倒一杯」。'; },",
      replace:"      p3s0:function(e){ return '用 🥤 小杯子。先把 ' + this.cName(e.a) + '裝滿，按「再倒一杯」。'; }," },
    { file:'index', expect:'never says the blocks must be identical',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>（積木要一樣的才能比）';\n      },\n      blkLabel",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>';\n      },\n      blkLabel" },

    /* --- index.html：SVG 的寬度 --- */
    /* 水滿出來的水花畫在容器右邊，只算容器寬度的話那幾滴會被整段切掉（寬度在 jarDims() 算）。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:"    return { w:PAD + c.w + PAD + (drops > 0 ? 40 : 0),",
      replace:"    return { w:PAD + c.w + PAD," },
    /* 天平右盤上的積木排開來比盤子寬，只量盤子的話量不到。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:"  var BAL_GEO = { W:260, H:176, cx:130, pivot:56, arm:92, drop:16, hang:30 };",
      replace:"  var BAL_GEO = { W:200, H:176, cx:130, pivot:56, arm:92, drop:16, hang:30 };" },
    /* 一排杯子只算到第九個的起點，最後一個會被切掉。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:'    var w = cols * step + 14;',
      replace:'    var w = cols * step;' },

    /* --- index.html：三層題庫 --- */
    { file:'index', expect:'the checker expects',
      find:"          opts:['🥛 玻璃杯','🫖 水壺','兩個一樣多','沒辦法比'], ans:1,",
      replace:"          opts:['🥛 玻璃杯','🫖 水壺','兩個一樣多','沒辦法比'], ans:0," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['🎈 氣球','兩個一樣重','🪨 石頭','沒辦法知道'], ans:2,",
      replace:"          opts:['🎈 氣球','兩個一樣重','🪨 石頭','沒辦法知道'], ans:9," },
    { file:'index', expect:'the stem contains an unexpected number',
      find:"        { stem:'🥤 用同一個小杯子量：🫖 水壺 8 杯、🥣 碗 6 杯。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🥤 用同一個小杯子量：🫖 水壺 8 杯、🥣 碗 6 杯（另外還有 3 個杯子）。<br>哪一個裝得比較多？'," },
    { file:'index', expect:'never appears in the stem',
      find:"        { stem:'⚖️ 用一樣的積木秤：🍎 蘋果 4 個、🧸 玩具熊 6 個。<br>哪一個比較重？',",
      replace:"        { stem:'⚖️ 用一樣的積木秤：🍎 蘋果 5 個、🧸 玩具熊 6 個。<br>哪一個比較重？'," },
    { file:'index', expect:'the option set for',
      find:"          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1,\n          why:'同一個杯子量出來，6 杯比 5 杯多，所以碗裝得比較多。比較高的不一定裝得多。' }",
      replace:"          opts:['🏺 花瓶','🥣 碗','兩個一樣多','banana'], ans:1,\n          why:'同一個杯子量出來，6 杯比 5 杯多，所以碗裝得比較多。比較高的不一定裝得多。' }" },
    { file:'index', expect:'the big cup measured MORE cups',
      find:"        { stem:'🥤 用大杯量 🫙 甲瓶，量出 3 杯；用小杯量 🍯 乙瓶，量出 5 杯。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🥤 用大杯量 🫙 甲瓶，量出 7 杯；用小杯量 🍯 乙瓶，量出 5 杯。<br>哪一個裝得比較多？'," },
    { file:'index', expect:'marked answer is',
      find:"          opts:['3 杯','6 杯','9 杯','15 杯'], ans:0,",
      replace:"          opts:['4 杯','6 杯','9 杯','15 杯'], ans:0," },
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'迷思檢查：🏺 花瓶比 🥣 碗高。用同一個小杯子量，花瓶 5 杯、碗 6 杯。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1,",
      replace:"        { stem:'🥤 一樣的題目再一次。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1, why:'重複的一題。' },\n        { stem:'迷思檢查：🏺 花瓶比 🥣 碗高。用同一個小杯子量，花瓶 5 杯、碗 6 杯。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1," },
    { file:'index', expect:'en qs: 5 questions but 6 expected',
      find:"        { stem:'⚖️ One thing on each side, and the balance stays level.<br>What does that tell you?',\n          opts:['the left side is heavier','the right side is heavier','they weigh the same','both of them are light'], ans:2,\n          why:'A level balance means the two sides weigh the same. It does not tell you whether they are light or heavy.' }\n      ],",
      replace:"      ]," },
    /* ===== 第三輪審查新增／改寫的斷言 ===== */
    /* 「同一個杯子」是充分條件，不是必要條件。必要性版本（「只有…才成立」）
       在「3 大杯 vs 2 小杯」那裡會說謊。 */
    { file:'parents', expect:'must keep the two directions apart',
      find:'      "s1p2": "<strong>大人最容易誤解的那一點：</strong>',
      replace:'      "s1p2": "「杯數多就是裝得多」只有在兩邊用同一個杯子時才成立。<strong>大人最容易誤解的那一點：</strong>' },
    { file:'parents', expect:'must keep the two directions apart',
      find:'      "s1p2": "<strong>The point adults most often miss:</strong>',
      replace:'      "s1p2": "Note that “more cups means it holds more” is only true when both were measured with the same cup. <strong>The point adults most often miss:</strong>' },
    /* 「滿出來了，所以這個裝得比較多」——「這個」可以指到接水的那一個。 */
    { file:'parents', expect:'must name which container it poured from',
      find:'並說出「滿出來了，所以<strong>倒出去的</strong>那個裝得比較多」或「還有空位，所以<strong>接水的</strong>那個裝得比較多」。</li>',
      replace:'並說出「滿出來了，所以這個裝得比較多」或「還有空位，所以那個裝得比較多」。</li>' },
    /* 速查卡的極性被反過來寫（「積木不需要一樣重」）—— 只找關鍵詞擋不住。 */
    { file:'reference', expect:'must not flip the polarity',
      find:"r5c:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',",
      replace:"r5c:'兩邊的積木<strong>不需要一樣重</strong>（一樣大就可以比）',", },
    { file:'reference', expect:'must not flip the polarity',
      find:"r1c:'blocks that <strong>all weigh the same</strong>',",
      replace:"r1c:'blocks that <strong>need not weigh the same</strong>',", },
    /* 家長頁把段落綁到別的 key 上：畫面上的文字整段被換掉，
       只在原始碼裡數字串的話這一筆是綠的。 */
    { file:'parents', expect:'is not bound to data-i18n="h1p"',
      find:'<p data-i18n="h1p">拿同一個碗',
      replace:'<p data-i18n="h1pX">拿同一個碗' },
    /* ===== 第二輪審查新增／改寫的斷言，每一條各配一筆改壞版本 ===== */
    /* 傳遞題的線索方向跟上課頁 BOXES 的輕重真值相反 —— 同一個箱子兩頁講不同的話。 */
    { file:'review', expect:'contradicts the box weights',
      find:'        var tri = [first].concat(rest).sort(function(x, y){ return BOXES[y].wt - BOXES[x].wt; });',
      replace:'        var tri = [first].concat(rest).sort(function(x, y){ return BOXES[x].wt - BOXES[y].wt; });' },
    /* 課程自己的 truthOf 講錯話時，遊戲的真值不可以跟著它一起錯。 */
    { file:'index', expect:"the checker's own table says",
      find:"  function truthOf(cat, id){ return cat === 'C' ? CONTAINERS[id].cap : catalog(cat)[id].wt; }",
      replace:"  function truthOf(cat, id){ return cat === 'C' ? CONTAINERS[id].cap + 1 : catalog(cat)[id].wt; }" },
    /* 尺寸寫在 style 裡的元素：清點得到、卻一條邊都量不到。 */
    { file:'index', expect:'cannot be measured',
      find:"    s += '<rect x=\"' + (PAD - 6) + '\" y=\"' + BASE + '\" width=\"' + (c.w + 12) +\n         '\" height=\"4\" rx=\"2\" fill=\"#E8E2D6\"/>';",
      replace:"    s += '<rect y=\"' + BASE + '\" style=\"width:' + (c.w + 12) + 'px;height:4px\" rx=\"2\" fill=\"#E8E2D6\"/>';" },
    /* --- 速查卡與家長頁：這一輪第一次有針對這兩頁的斷言 --- */
    /* 積木的關鍵是「一樣重」，不是「一樣大」：同樣大的木塊和金屬塊差很多。 */
    { file:'reference', expect:'must not make block comparison depend on size',
      find:"r5c:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',",
      replace:"r5c:'兩邊用了<strong>不一樣大</strong>的積木'," },
    { file:'reference', expect:'must not make block comparison depend on size',
      find:"r5c:'the blocks were <strong>not all the same weight</strong> (same size can still mean different weight)',",
      replace:"r5c:'the two sides used <strong>different-sized</strong> blocks'," },
    /* 盛飯活動量到的是鍋裡現在的飯，不是鍋子的容量 —— 一定要講清楚是哪一個。 */
    { file:'parents', expect:'must say what the bowl count measures',
      find:'      "h1p": "拿同一個碗，問「這鍋的飯可以盛幾碗？」一碗一碗盛、一起數（最後不滿一碗就說「還有半碗」）。換另一鍋再數一次，然後問「哪一鍋的<strong>飯</strong>比較多？你怎麼知道？」重點提醒兩件事：兩次都要用同一個碗，而且數的是<strong>飯</strong>有多少，不是鍋子能裝多少',
      replace:'      "h1p": "拿同一個碗，問「這鍋的飯可以盛幾碗？」一碗一碗盛、一起數（最後不滿一碗就說「還有半碗」）。換另一鍋再數一次，然後問「哪一鍋的<strong>飯</strong>比較多？你怎麼知道？」重點提醒兩件事：兩次都要用同一個碗，而且要數清楚' },
    /* ===== 這一輪新增／改寫的斷言，每一條各配一筆改壞版本 ===== */
    /* 畫布只算寬度的話，height 少算就沒人發現 —— 矮容器的第四滴水花會被切掉。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'             h:Math.max(BASE + 14, drops > 0 ? (top + 18 + (drops - 1) * 11 + 6) : 0) };',
      replace:'             h:BASE + 14 };' },
    /* 一排杯子的高度只算 size + 8 的話，大杯那一排的下緣會被切掉 ——
       文字的 y 是基線，emoji 還會往下掉大約三成字級。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var h = 4 + (rows - 1) * (size + 8) + size + Math.ceil(size * 0.3) + 3;',
      replace:'    var h = rows * (size + 8) + 6;' },
    /* 只量右下兩個邊的話，畫到畫布左邊外面去也是綠的。 */
    { file:'index', expect:'clipped by the left edge',
      find:"      s += '<text x=\"' + (5 + (i % perRow) * step) + '\" y=\"' +",
      replace:"      s += '<text x=\"' + (-20 + (i % perRow) * step) + '\" y=\"' +" },
    /* 上緣同理：容器比 BASE 還高的時候會頂出畫布。 */
    { file:'index', expect:'clipped by the top edge',
      find:'  var BASE = 118, PAD = 14;',
      replace:'  var BASE = 60, PAD = 14;' },
    /* viewBox 與畫布對不上時，整張圖會被瀏覽器縮放，量到的座標就不是畫面上的座標。 */
    { file:'index', expect:'the viewBox does not match the canvas',
      find:"    var s = '<svg data-count=\"' + n + '\" data-px=\"' + size + '\" width=\"' + w + '\" height=\"' + h +\n            '\" viewBox=\"0 0 ' + w + ' ' + h + '\" style=\"max-width:100%;height:auto\" ' +",
      replace:"    var s = '<svg data-count=\"' + n + '\" data-px=\"' + size + '\" width=\"' + w + '\" height=\"' + h +\n            '\" viewBox=\"0 0 ' + (w + 3) + ' ' + h + '\" style=\"max-width:100%;height:auto\" ' +" },
    /* 冒出一種量不到的元素時要報錯，不可以默默略過（fail-open）。 */
    { file:'index', expect:'which the geometry reader cannot measure',
      find:"    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */",
      replace:"    s += '<circle cx=\"1\" cy=\"1\" r=\"1\"/></svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */" },
    /* 畫了 N 個元素卻只量到 M 個 —— 剩下那些是沒被量到的。 */
    { file:'index', expect:'the rest are unmeasured',
      find:"           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">' + icon + '</text>';",
      replace:"           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">' + icon + (i === 0 ? '' : '</text>');" },
    /* 中間那一句話（倒下去發生了什麼）說反了。 */
    { file:'index', expect:'but what happens is',
      find:"        if (ca > cb) return '倒下去 —— 水滿出來了！' + this.cName(c.b) + '裝不下。';",
      replace:"        if (ca > cb) return '倒完了 —— ' + this.cName(c.b) + '還有空位沒裝滿。';" },
    /* 天平往哪邊倒說反了。 */
    { file:'index', expect:'but what happens is',
      find:"        if (wa > wb) return '左邊沉下去了。';",
      replace:"        if (wa > wb) return '右邊沉下去了。';" },
    /* 索引越界時，覆蓋率的 .some() 以前會直接讀 undefined.size 把腳本弄爆。 */
    { file:'index', expect:'index 99 is outside',
      find:'    { a:1, b:6 },  /* 🎈 氣球(1，大) vs 🪨 石頭(9，小) → 石頭沉（大 ≠ 重） */',
      replace:'    { a:99, b:6 },  /* 🎈 氣球(1，大) vs 🪨 石頭(9，小) → 石頭沉（大 ≠ 重） */' },
    /* 題幹被改成另一種情況，正解卻沒動 —— 只驗數字與答案的話這是綠的。 */
    { file:'index', expect:'the stem never says',
      find:"        { stem:'🫖 把水壺裝滿的水倒進 🥛 玻璃杯，水滿出來了。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🫖 把水壺裝滿的水倒進 🥛 玻璃杯，玻璃杯還有空位。<br>哪一個裝得比較多？'," },
    /* 題幹多說了一句「不該說」的話（天平是平的，卻又說沉下去）。 */
    { file:'index', expect:'turns it into a different question',
      find:"        { stem:'⚖️ 兩邊各放一個東西，天平是平的。<br>這表示什麼？',",
      replace:"        { stem:'⚖️ 兩邊各放一個東西，天平是平的，右邊沉下去。<br>這表示什麼？'," },
    /* 解釋把決定性的比較講反了 —— 以前 why 根本沒被讀過。 */
    { file:'index', expect:'the explanation never says',
      find:"          why:'同一個杯子量出來，8 杯比 6 杯多，所以水壺裝得比較多。' },",
      replace:"          why:'同一個杯子量出來，8 杯比 6 杯少，所以水壺裝得比較多。' }," },
    /* 解釋整個被清空。 */
    { file:'index', expect:'too short to explain anything',
      find:"          why:'天平平平的，就是兩邊一樣重。平的時候看不出輕或重，只知道一樣。' }",
      replace:"          why:'' }" },
    /* 解釋沒有引用題幹給的數字。 */
    { file:'index', expect:'never mentions',
      find:"          why:'每個積木都一樣重，6 個比 4 個多，所以玩具熊比較重。' },",
      replace:"          why:'每個積木都一樣重，多的那個比較重，所以玩具熊比較重。' }," },
    /* 方法句子（含「平平的就一樣重」）與設定檔的真值表對不上。 */
    { file:'review', expect:'bad option shape',
      find:"      '放上天平：沉下去的那一邊比較重，平平的就一樣重',",
      replace:"      '放上天平，看哪一邊沉下去'," },
    /* ===== 小遊戲「比比看大挑戰」（§六之五，2026-10-02 改版）：每一筆各守 gameCheck() 的一條規則 ===== */
    /* Bfirst：nearestOpen 挑清單裡第一個碰得到的 */
    { file:'index', expect:"nearestOpen(): at x",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    /* Bcentre：nearestOpen 量到中心、不是量到方框 */
    { file:'index', expect:"it must measure to the box",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    /* Bskip：最近的格子已經放好時，改放進旁邊的空格 */
    { file:'index', expect:"when the nearest box is filled",
      find:"    return best && !best.done ? best : null;",
      replace:"    return best && !best.done ? best : (list.filter(function(b){ return !b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad; })[0] || null);" },
    /* Bdeduct：放錯扣分（低年級從不倒扣） */
    { file:'index', expect:"a mistake changed the score",
      find:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"  function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    /* Bstars：犯過錯也給 2 顆 */
    { file:'index', expect:"mistake(s) gives",
      find:"    var stars = gMistakes === 0 ? 2 : 1;",
      replace:"    var stars = 2;" },
    /* Bstale：舊畫板的積木放開時還會動新的那一關 */
    { file:'index', expect:"a piece still held when the board is rebuilt",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    /* Bsel：先點選、再拖走的那一塊還選著 */
    { file:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"" },
    /* Blost：capture 遺失時不放回去 */
    { file:'index', expect:"lost pointer capture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    /* Bahead：超前模式不自動給第一層提示 */
    { file:'index', expect:"ahead mode does not show",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'ahead'){ hintLevel = 1; }" },
    /* Bpresort：托盤可以一開始就是正解順序 */
    { file:'index', expect:"already in answer order",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"" },
    /* Bpick：拿得起來的東西不到 44px */
    { file:'index', expect:"GPICK",
      find:"  var GAME_W = 300, GPICK = 48, GPAD = 6;",
      replace:"  var GAME_W = 300, GPICK = 40, GPAD = 6;" },
    /* Bfirstinfo：倒之前放王冠算一次錯 */
    { file:'index', expect:"before pouring is not just a reminder",
      find:"        if (!poured){ roundInfo(d.gPourFirst); return false; }",
      replace:"        if (!poured){ roundMiss(d.gPourFirst); return false; }" },
    /* Bcrownany：王冠放在哪裡都收 */
    { file:'index', expect:"a crown on the wrong one is accepted",
      find:"        if (t.who !== more){ roundMiss(d.gPourWrong(out, t.who, e.a, e.b)); return false; }",
      replace:"        if (t.who !== more && false){ roundMiss(d.gPourWrong(out, t.who, e.a, e.b)); return false; }" },
    /* Bpouranywhere：容器放在哪裡都會倒 */
    { file:'index', expect:"drops of the jar away from the empty one",
      find:"          if (!nearestOpen([tB], pt, GPAD)) return false;\n          /* 倒過去",
      replace:"          /* 倒過去" },
    /* Bpourmax：倒過去的水量不對 */
    { file:'index', expect:"does not hold min(a, b)",
      find:"          bz.innerHTML = jarSVG(Bc, Math.min(A.cap, Bc.cap), spill);",
      replace:"          bz.innerHTML = jarSVG(Bc, Math.min(A.cap, Bc.cap) - 1, spill);" },
    /* Bpourtrap：比較高的那個剛好也裝得多（只看高矮就答對） */
    { file:'index', expect:"the taller one also holds more",
      find:"  var GAME_POUR = [ { a:1, b:3 },",
      replace:"  var GAME_POUR = [ { a:0, b:2 }," },
    /* Bnote：「高不代表多」每一次都說 */
    { file:'index', expect:"must not say \"高不代表多\"",
      find:"        var note = who === tall ? '（' + (who === 'a' ? A : B) + '比較高，可是高不代表多。）' : '';",
      replace:"        var note = '（' + (who === 'a' ? A : B) + '比較高，可是高不代表多。）';" },
    /* Bpourmsg：放錯時說成另一個比較多 */
    { file:'index', expect:"crown on a: should say",
      find:"        if (out === 'room') return (who === 'same' ? '還有空位，不是剛好滿 → 不一樣多：' : '還有空位：' + A + '的水倒完了，' + B + '還裝不滿 → ') + B + '裝得比較多。' + note;",
      replace:"        if (out === 'room') return (who === 'same' ? '還有空位，不是剛好滿 → 不一樣多：' : '還有空位：' + A + '的水倒完了，' + B + '還裝不滿 → ') + A + '裝得比較多。' + note;" },
    /* Bcrownpos：王冠放好之後跑出畫板 */
    { file:'index', expect:"the crown on a is outside",
      find:"  var POUR_JAR = { top:34,",
      replace:"  var POUR_JAR = { top:12," },
    /* Bcrownhome：王冠一開始就在「一樣多」的吸附範圍裡 */
    { file:'index', expect:"starts inside the \"same\" box",
      find:"  var POUR_CROWN = { y:274,",
      replace:"  var POUR_CROWN = { y:262," },
    /* Blight：點比較輕的也算 */
    { file:'index', expect:"the lighter thing on balance",
      find:"        if (id === row.heavy){",
      replace:"        if (id === row.heavy || (id >= 0 && row.heavy >= 0)){" },
    /* Btiltsame：斜的天平點「一樣重」也算 */
    { file:'index', expect:"on tilted balance",
      find:"        if (id < 0){ roundMiss(d.gTiltNotLevel(row.heavy)); return; }",
      replace:"        if (id < 0){ row.heavy = -1; return tapRow(row, id, b); }" },
    /* Btrap：「大的反而輕」那一排不是陷阱 */
    { file:'index', expect:"the bigger one is not the lighter one",
      find:"  var TILT_TRAP = [ { a:1, b:6 },",
      replace:"  var TILT_TRAP = [ { a:7, b:0 }," },
    /* Bonpan：東西沒有站在盤子上（盤子斜了，東西還在原地） */
    { file:'index', expect:"is not standing on its pan",
      find:"        var pans = [[e.a, G.cx - G.arm, G.pivot + tilt * G.drop + G.hang], [e.b, G.cx + G.arm, G.pivot - tilt * G.drop + G.hang]];",
      replace:"        var pans = [[e.a, G.cx - G.arm, G.pivot + G.hang], [e.b, G.cx + G.arm, G.pivot + G.hang]];" },
    /* Btiltnote：「大不代表重」每一次都說 */
    { file:'index', expect:"must not say \"大不代表重\"",
      find:"               (ITEMS[lt].size > ITEMS[hv].size ? '（' + this.iName(lt) + '比較大，可是大不代表重。）' : '');",
      replace:"               '（' + this.iName(lt) + '比較大，可是大不代表重。）';" },
    /* Btiltrows：三排不是三個池子各一個 */
    { file:'index', expect:"one from each pool",
      find:"      var rows = shuffle([pick(TILT_TRAP), pick(TILT_SAME), pick(TILT_BIG)])",
      replace:"      var rows = shuffle([pick(TILT_TRAP), pick(TILT_TRAP), pick(TILT_BIG)])" },
    /* Btilth：畫板比三個天平矮 */
    { file:'index', expect:"outside the 300×",
      find:"  var TILT_H = 346;",
      replace:"  var TILT_H = 336;" },
    /* Bcupany：用不一樣的杯子也倒 */
    { file:'index', expect:"the other cup is accepted",
      find:"          if (big !== e.big){ roundMiss(d.gCupWrong(e.a, e.big)); return; }",
      replace:"          if (big !== e.big && false){ roundMiss(d.gCupWrong(e.a, e.big)); return; }" },
    /* Bcupearly：差一杯就過關 */
    { file:'index', expect:"solved after",
      find:"          if (n === nb) roundSolved(d.gCupsDone(e.a, na, e.b, nb, e.big));",
      replace:"          if (n === nb - 1) roundSolved(d.gCupsDone(e.a, na, e.b, nb, e.big));" },
    /* Bcupodd：用大杯量、裝不下整數杯 */
    { file:'index', expect:"whole number of big cups",
      find:"{ a:3, b:0, big:true }",
      replace:"{ a:1, b:0, big:true }" },
    /* Bcupmore：說成杯數少的那一個比較多 */
    { file:'index', expect:"gCupsDone: should say",
      find:"        var more = na > nb ? a : b, less = na > nb ? b : a;\n        return head + Math.max(na, nb) + ' 比 '",
      replace:"        var more = na > nb ? b : a, less = na > nb ? a : b;\n        return head + Math.max(na, nb) + ' 比 '" },
    /* Bcuplbl：英文標籤兩行，框只有一行高 */
    { file:'index', expect:"lines — taller than",
      find:"  var CUPS_JAR = { top:10, ax:74, bx:206, lblY:144, lblW:124, lblH:34 };",
      replace:"  var CUPS_JAR = { top:10, ax:74, bx:206, lblY:144, lblW:124, lblH:22 };" },
    /* Bcupbig：沒有用大杯量的題目（「永遠點小杯」不會錯） */
    { file:'index', expect:"needs both a small-cup and a big-cup entry",
      find:"{ a:0, b:2, big:true }, { a:3, b:0, big:true }, { a:2, b:3, big:true }",
      replace:"{ a:0, b:2, big:false }, { a:3, b:0, big:false }, { a:2, b:3, big:false }" },
    /* Bblkodd：不一樣的積木也收 */
    { file:'index', expect:"the different block is accepted",
      find:"        if (P.data.k !== 'same'){ roundMiss(d.gBlkOdd); return false; }",
      replace:"        if (P.data.k !== 'same' && false){ roundMiss(d.gBlkOdd); return false; }" },
    /* Bblkover：平了之後還收積木 */
    { file:'index', expect:"a block after level is accepted",
      find:"        if (n >= wt){ roundInfo(d.gBlkOver); return false; }",
      replace:"        if (n >= wt + 1){ roundInfo(d.gBlkOver); return false; }" },
    /* Bblkovermiss：平了之後再放算一次錯 */
    { file:'index', expect:"a block after level is accepted (or counted as a mistake)",
      find:"        if (n >= wt){ roundInfo(d.gBlkOver); return false; }",
      replace:"        if (n >= wt){ roundMiss(d.gBlkOver); return false; }" },
    /* Bblkearly：還沒平就能按「平了！」 */
    { file:'index', expect:"Level is accepted before the balance is level",
      find:"        if (n < wt){ roundMiss(d.gBlkShort(id)); return; }",
      replace:"        if (n < 1){ roundMiss(d.gBlkShort(id)); return; }" },
    /* Bblkauto：放到平就自己過關（不用看天平） */
    { file:'index', expect:"a block solved the round",
      find:"        line.textContent = d.gBlkNow(n);\n",
      replace:"        line.textContent = d.gBlkNow(n);\n        if (n === wt) roundSolved(d.gBlkDone(id, wt));\n" },
    /* Bblktilt：天平的傾斜和積木數對不起來 */
    { file:'index', expect:"the balance is not drawn with",
      find:"        bal.innerHTML = balanceSVG(it, n ? { icon:BLK_ICON, count:n } : null, n < wt ? 1 : 0);",
      replace:"        bal.innerHTML = balanceSVG(it, n ? { icon:BLK_ICON, count:n } : null, n < wt - 1 ? 1 : 0);" },
    /* Bblkhint：第二層提示的「還要再放」數字錯 */
    { file:'index', expect:"gBlk2 at",
      find:"      gBlk2:function(i, n, wt){ return n < wt ? '還要再放 ' + this.qtyBlk(wt - n) + '。' : '天平已經平了，按「平了！」。'; },",
      replace:"      gBlk2:function(i, n, wt){ return n < wt ? '還要再放 ' + this.qtyBlk(wt) + '。' : '天平已經平了，按「平了！」。'; }," },
    /* Bblkempty：沒放就按「平了！」算一次錯 */
    { file:'index', expect:"Level with no blocks should only remind",
      find:"        if (n === 0){ gMsg.textContent = d.gBlkEmpty; return; }",
      replace:"        if (n === 0){ roundMiss(d.gBlkEmpty); return; }" },
    /* Brankany：排排看什麼都收 */
    { file:'index', expect:"is not refused with gRankWhy",
      find:"        if (id !== want){ roundMiss(d.gRankWhy(cat, id, want)); return false; }",
      replace:"        if (id !== want && false){ roundMiss(d.gRankWhy(cat, id, want)); return false; }" },
    /* Brankasc：排成由少到多 */
    { file:'index', expect:"the target order is not most first",
      find:"    var order = set.ids.slice().sort(function(x, y){ return truthOf(cat, y) - truthOf(cat, x); });",
      replace:"    var order = set.ids.slice().sort(function(x, y){ return truthOf(cat, x) - truthOf(cat, y); });" },
    /* Branktray：托盤用正的量洗牌（擋不到由多到少的正解順序） */
    { file:'index', expect:"shuffled by the NEGATED",
      find:"      renderTray(B, set.ids.map(function(x){ return -truthOf(cat, x); }), Cd.y, function(v, cx, cy){\n        var id = set.ids.filter(function(x){ return -truthOf(cat, x) === v; })[0];",
      replace:"      renderTray(B, set.ids.map(function(x){ return truthOf(cat, x); }), Cd.y, function(v, cx, cy){\n        var id = set.ids.filter(function(x){ return truthOf(cat, x) === v; })[0];" },
    /* Branktrap：最高的那個剛好最多（照高矮排就對） */
    { file:'index', expect:"also has the most",
      find:"    { cat:'C', ids:[1, 3, 2] },",
      replace:"    { cat:'C', ids:[0, 3, 2] }," },
    /* Brankwhy：放錯的理由多／少說反 */
    { file:'index', expect:"put",
      find:"        return this.gRankVal(cat, id) + '比 ' + this.gRankVal(cat, want) + (more ? '多' : '少') + '：這一格要放' + noun + '。' +",
      replace:"        return this.gRankVal(cat, id) + '比 ' + this.gRankVal(cat, want) + (more ? '少' : '多') + '：這一格要放' + noun + '。' +" },
    /* Brankgap：格子之間的縫太寬（吸附範圍不重疊，最近的規則驗不到） */
    { file:'index', expect:"the drop pads overlap",
      find:"  var RANK_SLOT = { y:92, w:92, h:100, x:[50, 150, 250] }",
      replace:"  var RANK_SLOT = { y:92, w:86, h:100, x:[50, 150, 250] }" },
    /* Brankpic：卡片上的容器畫成一樣高 */
    { file:'index', expect:"true size",
      find:"      var c = CONTAINERS[id], w = c.w * RANK_JAR, h = c.h * RANK_JAR;",
      replace:"      var c = CONTAINERS[id], w = c.w * RANK_JAR, h = 40;" },
    /* Bparents：家長頁的精熟標準還寫著舊遊戲的名字 */
    { file:'parents', expect:'readyBox does not name the game',
      find:"小遊戲「比比看大挑戰」有通關</strong>，就表示這一課學得差不多了，可以放心往下一課前進。如果還沒達到，建議回到「上課」頁面的<strong>範例教學 3</strong>，陪他把「再倒一杯」從頭按到底一次 —— 一杯一杯數出來的那個過程，就是這一課最重要的東西。真的還是卡住的話，改用家裡的兩個杯子做一次，實物永遠比螢幕有效。\",",
      replace:"小遊戲「排排看大挑戰」有通關</strong>，就表示這一課學得差不多了，可以放心往下一課前進。如果還沒達到，建議回到「上課」頁面的<strong>範例教學 3</strong>，陪他把「再倒一杯」從頭按到底一次 —— 一杯一杯數出來的那個過程，就是這一課最重要的東西。真的還是卡住的話，改用家裡的兩個杯子做一次，實物永遠比螢幕有效。\"," },
    /* Bwet：容器不畫水（以前拿 jarSVG 自己的輸出比，比得一模一樣）（codex 第一輪） */
    { file:'index', expect:"is not drawn full",
      find:"    var wet = Math.max(0, Math.min(c.cap, fill));",
      replace:"    var wet = 0;" },
    /* Browicon：一排杯子畫成別的東西（codex 第一輪） */
    { file:'index', expect:"row does not show",
      find:"      s += '<text x=\"' + (5 + (i % perRow) * step) + '\" y=\"' +\n           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">' + icon + '</text>';",
      replace:"      s += '<text x=\"' + (5 + (i % perRow) * step) + '\" y=\"' +\n           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">❌</text>';" },
    /* Bpanicon：天平右盤的積木畫成別的東西（codex 第一輪） */
    { file:'index', expect:"blocks the balance is not drawn",
      find:"'\" font-size=\"' + BLK_PAN_PX + '\">' + obj.icon + '</text>';",
      replace:"'\" font-size=\"' + BLK_PAN_PX + '\">❌</text>';" },
    /* Binfo：提醒（倒之前、積木太多）也記一次錯（codex 第一輪） */
    { file:'index', expect:"roundInfo() counts as a mistake",
      find:"  function roundInfo(text){ gMsg.innerHTML",
      replace:"  function roundInfo(text){ gMistakes++; gMsg.innerHTML" },
    /* Bmissmsg：放錯不說為什麼（codex 第一輪） */
    { file:'index', expect:"does not show its reason",
      find:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }",
      replace:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML = '<span class=\"no\">再試一次</span>'; }" },
    /* Bpanstrip：右盤只收正中間一條（codex 第一輪） */
    { file:'index', expect:"inside the pan's drop area do not take",
      find:"        if (!nearestOpen([pan], pt, GPAD)) return false;",
      replace:"        if (!nearestOpen([pan], pt, GPAD) || Math.abs(pt.x - pan.cx) > 1) return false;" },
    /* Bhint1：第一層提示沒有講方法（codex 第一輪） */
    { file:'index', expect:"hint level 1 (zh)",
      find:"        pour:'倒之前看不出來：高的不一定裝得多。倒過去，看水怎麼樣。',",
      replace:"        pour:'加油，你可以的！'," },
    /* Bshowhint：第二層提示沒有接上（codex 第一輪） */
    { file:'index', expect:"showHint() gives",
      find:"    elHint.textContent = d.gHints[type] + (hintLevel >= 2 && gCtx.hint2 ? ' ' + gCtx.hint2() : '');",
      replace:"    elHint.textContent = d.gHints[type];" },
  ],

  sim: {
    /* 這一課的選項幾乎都是句子（「🫖 水壺裝得比較多」），題幹的數字是「8」，
       字串比不到 —— 通用的「誘答抄題幹」檢查在這一課不會響。真正該擋的
       「把題目給的數字當答案」由 cupDiff／blockDiff 自己的不變條件把關
       （na ≠ 2 × nb，否則「答成小的那個數」剛好變成正解）。 */
    stemEchoOk: {},

    INVARIANTS: {
      /* 1. 倒倒看：滿出來 → 倒出去的那個比較多；還有空位 → 接的那個比較多；剛好 → 一樣多。 */
      pourCompare: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.a === d.b) return 'the two containers must differ';
        const ca = CONTAINER_TRUTH[d.a].cap, cb = CONTAINER_TRUTH[d.b].cap;
        const want = ca > cb ? 'pick#C#' + d.a : ca < cb ? 'pick#C#' + d.b : 'same#cap';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#C#' + d.a, 'pick#C#' + d.b, 'same#cap', 'no#cap']) ||
          answerIs(d, want);
      },
      /* 2. 天平：沉下去的那一邊比較重（兩邊各放一個東西時）。 */
      balanceTilt: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        const wa = ITEM_TRUTH[d.a].wt, wb = ITEM_TRUTH[d.b].wt;
        const want = wa > wb ? 'pick#I#' + d.a : wa < wb ? 'pick#I#' + d.b : 'same#w';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#I#' + d.a, 'pick#I#' + d.b, 'same#w', 'no#w']) ||
          answerIs(d, want);
      },
      /* 3. 同一個杯子：杯數多的容量比較大。杯數必須就是容器自己的杯數。 */
      sameCup: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.a === d.b) return 'the two containers must differ';
        if (d.na !== CONTAINER_TRUTH[d.a].cap) return 'na ' + d.na + ' is not the container’s own cup count ' + CONTAINER_TRUTH[d.a].cap;
        if (d.nb !== CONTAINER_TRUTH[d.b].cap) return 'nb ' + d.nb + ' is not the container’s own cup count ' + CONTAINER_TRUTH[d.b].cap;
        const want = d.na > d.nb ? 'pick#C#' + d.a : d.na < d.nb ? 'pick#C#' + d.b : 'same#cap';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#C#' + d.a, 'pick#C#' + d.b, 'same#cap', 'no#cap']) ||
          answerIs(d, want);
      },
      /* 4. 杯子不一樣大：**大杯的杯數一定要比小杯少**，否則比得出來 ——
         大杯比小杯大，3 大杯一定多過 2 小杯，那時「沒辦法比」就是錯的。 */
      diffCup: d => {
        if (d.a !== 0 || d.b !== 1) return 'diffCup must use the unlabelled jars (0 and 1), got ' + d.a + ' / ' + d.b;
        if (!Number.isInteger(d.na) || !Number.isInteger(d.nb)) return 'the cup counts must be whole numbers';
        if (!(d.na >= 2 && d.nb <= 8)) return 'cup counts stay in 2~8, got ' + d.na + ' / ' + d.nb;
        if (!(d.na < d.nb)) return 'the big-cup count must be smaller than the small-cup count (' + d.na + ' vs ' + d.nb + '), otherwise the comparison IS decidable';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#U#0', 'pick#U#1', 'same#cap', 'no#cap']) ||
          answerIs(d, 'no#cap');
      },
      /* 5. 一樣的積木：個數多的比較重。個數必須就是東西自己的積木數。 */
      blockWeigh: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        if (d.na !== ITEM_TRUTH[d.a].wt) return 'na ' + d.na + ' is not the item’s own block count ' + ITEM_TRUTH[d.a].wt;
        if (d.nb !== ITEM_TRUTH[d.b].wt) return 'nb ' + d.nb + ' is not the item’s own block count ' + ITEM_TRUTH[d.b].wt;
        const want = d.na > d.nb ? 'pick#I#' + d.a : d.na < d.nb ? 'pick#I#' + d.b : 'same#w';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#I#' + d.a, 'pick#I#' + d.b, 'same#w', 'no#w']) ||
          answerIs(d, want);
      },
      /* 6. 多幾杯：差是算出來的。na ＝ 2 × nb 時「答成小的那個數」會等於正解。 */
      cupDiff: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.na !== CONTAINER_TRUTH[d.a].cap || d.nb !== CONTAINER_TRUTH[d.b].cap){
          return 'the cup counts are not the containers’ own cup counts';
        }
        if (!(d.na > d.nb)) return 'the first container must take more cups (' + d.na + ' vs ' + d.nb + ')';
        if (d.na === 2 * d.nb) return 'na must not be twice nb, or the “answer with the given number” distractor equals the correct difference';
        if (d.diff !== d.na - d.nb) return 'diff ' + d.diff + ' is not ' + d.na + ' − ' + d.nb;
        const keys = d.opts.map(keyOf);
        if (keys.indexOf('num#cup#' + d.nb) < 0) return 'cupDiff needs the “answered with the given number” distractor ' + d.nb;
        /* 「用加的」這個誘答只有在範圍內時才放得進去（MAX_CUP 以上的杯數／個數
           在這一課根本看不到）；超出範圍時由 numOpts 換成範圍內的數。 */
        if (d.na + d.nb <= MAX_CUP && keys.indexOf('num#cup#' + (d.na + d.nb)) < 0){
          return 'cupDiff needs the “added instead of subtracted” distractor ' + (d.na + d.nb);
        }
        return distinctOpts(d) || answerIs(d, 'num#cup#' + (d.na - d.nb));
      },
      /* 7. 多幾個積木：同上。 */
      blockDiff: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.na !== ITEM_TRUTH[d.a].wt || d.nb !== ITEM_TRUTH[d.b].wt){
          return 'the block counts are not the items’ own block counts';
        }
        if (!(d.na > d.nb)) return 'the first item must take more blocks (' + d.na + ' vs ' + d.nb + ')';
        if (d.na === 2 * d.nb) return 'na must not be twice nb, or the “answer with the given number” distractor equals the correct difference';
        if (d.diff !== d.na - d.nb) return 'diff ' + d.diff + ' is not ' + d.na + ' − ' + d.nb;
        const keys = d.opts.map(keyOf);
        if (keys.indexOf('num#blk#' + d.nb) < 0) return 'blockDiff needs the “answered with the given number” distractor ' + d.nb;
        /* 「用加的」這個誘答只有在範圍內時才放得進去（MAX_BLK 以上的杯數／個數
           在這一課根本看不到）；超出範圍時由 numOpts 換成範圍內的數。 */
        if (d.na + d.nb <= MAX_BLK && keys.indexOf('num#blk#' + (d.na + d.nb)) < 0){
          return 'blockDiff needs the “added instead of subtracted” distractor ' + (d.na + d.nb);
        }
        return distinctOpts(d) || answerIs(d, 'num#blk#' + (d.na - d.nb));
      },
      /* 8. 接龍：甲比乙重、乙比丙重 → 甲一定比丙重。三個箱子必須都不一樣，
         不然「中間那一個」不存在，線索接不起來。 */
      transitive: d => {
        const bad = idxOk(d.a, BOX_TRUTH.length, 'box a') || idxOk(d.b, BOX_TRUTH.length, 'box b') ||
                    idxOk(d.c, BOX_TRUTH.length, 'box c');
        if (bad) return bad;
        if (new Set([d.a, d.b, d.c]).size !== 3) return 'the three boxes must all differ';
        /* 線索是「a 比 b 重、b 比 c 重」。這三個箱子在上課頁的遊戲裡是有輕重真值的，
           所以複習題宣稱的鏈條必須跟那份真值同方向 —— 不然同一個 🟥 紅箱會在遊戲裡
           最重、在複習題裡最輕，兩頁互相打臉。 */
        if (!(BOX_TRUTH[d.a].wt > BOX_TRUTH[d.b].wt && BOX_TRUTH[d.b].wt > BOX_TRUTH[d.c].wt)){
          return 'the clue chain (' + [d.a, d.b, d.c].join(' > ') + ') contradicts the box weights (' +
                 [BOX_TRUTH[d.a].wt, BOX_TRUTH[d.b].wt, BOX_TRUTH[d.c].wt].join(' / ') + ')';
        }
        return distinctOpts(d) ||
          optSetIs(d, ['rel#' + d.a + '#' + d.c, 'rel#' + d.c + '#' + d.a, 'same#w', 'no#w']) ||
          answerIs(d, 'rel#' + d.a + '#' + d.c);
      },
      /* 9. 排順序：三個量出來的數必須兩兩不同，正解由真值排出來。 */
      orderThree: d => {
        if (d.dom !== 'cap' && d.dom !== 'w') return 'unknown domain ' + d.dom;
        const cat = d.dom === 'cap' ? 'C' : 'I';
        if (d.cat !== cat) return 'catalogue ' + d.cat + ' does not match domain ' + d.dom;
        const table = d.dom === 'cap' ? CONTAINER_TRUTH : ITEM_TRUTH;
        if (!Array.isArray(d.ids) || d.ids.length !== 3) return 'orderThree needs exactly 3 things';
        for (const id of d.ids){
          const e = idxOk(id, table.length, 'thing');
          if (e) return e;
          if (cat === 'C' && capOk(id)) return capOk(id);
        }
        if (new Set(d.ids).size !== 3) return 'the three things must all differ';
        const valOf = id => d.dom === 'cap' ? CONTAINER_TRUTH[id].cap : ITEM_TRUTH[id].wt;
        const vals = d.ids.map(valOf);
        if (new Set(vals).size !== 3) return 'the three measurements must all differ, got ' + vals.join(' / ');
        const want = d.ids.slice().sort((x, y) => valOf(y) - valOf(x));
        /* 只有一個選項可以是真正的順序，否則有兩個正確答案。 */
        const trueOnes = d.opts.filter(o => o && o.u === 'ord' && o.ids.join(',') === want.join(','));
        if (trueOnes.length !== 1) return 'exactly one option must be the true order, found ' + trueOnes.length;
        for (const o of d.opts){
          if (!o || o.u !== 'ord') return 'every option must be an ordering';
          if (o.cat !== cat) return 'an option uses catalogue ' + o.cat + ' but the question is ' + cat;
          if (o.ids.slice().sort().join(',') !== d.ids.slice().sort().join(',')){
            return 'an option orders a different set of things';
          }
        }
        return distinctOpts(d) || answerIs(d, 'ord#' + cat + '#' + want.join(','));
      },
      /* 10. 該怎麼比：正解唯一。「把甲裝滿倒進乙」也是對的做法，
         所以它不在誘答清單裡 —— 誘答清單也要逐一比對。 */
      howToCompare: d => {
        if (d.dom !== 'cap' && d.dom !== 'w') return 'unknown domain ' + d.dom;
        const table = d.dom === 'cap' ? CONTAINER_TRUTH : ITEM_TRUTH;
        const bad = idxOk(d.a, table.length, 'thing a') || idxOk(d.b, table.length, 'thing b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        const want = d.dom === 'cap' ? 'mt#0' : 'mt#4';
        const set = d.dom === 'cap' ? ['mt#0','mt#1','mt#2','mt#3'] : ['mt#4','mt#5','mt#6','mt#1'];
        return distinctOpts(d) || optSetIs(d, set) || answerIs(d, want);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的真值表重算，
       完全不呼叫 review.html 的 valStr —— 拿產生器自己的格式化函式來比等於自己比自己。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'pourCompare':
        case 'sameCup': {
          const ca = CONTAINER_TRUTH[d.a].cap, cb = CONTAINER_TRUTH[d.b].cap;
          return ca > cb ? fPick('C', d.a, lang) : ca < cb ? fPick('C', d.b, lang) : fSame('cap', lang);
        }
        case 'balanceTilt':
        case 'blockWeigh': {
          const wa = ITEM_TRUTH[d.a].wt, wb = ITEM_TRUTH[d.b].wt;
          return wa > wb ? fPick('I', d.a, lang) : wa < wb ? fPick('I', d.b, lang) : fSame('w', lang);
        }
        case 'diffCup':   return fNo('cap', lang);
        case 'cupDiff':   return fCup(CONTAINER_TRUTH[d.a].cap - CONTAINER_TRUTH[d.b].cap, lang);
        case 'blockDiff': return fBlk(ITEM_TRUTH[d.a].wt - ITEM_TRUTH[d.b].wt, lang);
        case 'transitive': {
          /* 正解由原始的輕重排出來，不是照抄 make() 給的 a／c 順序。 */
          const tri = [d.a, d.b, d.c].slice().sort((x, y) => BOX_TRUTH[y].wt - BOX_TRUTH[x].wt);
          return fRel(tri[0], tri[2], lang);
        }
        case 'orderThree': {
          const cat = d.dom === 'cap' ? 'C' : 'I';
          const valOf = id => d.dom === 'cap' ? CONTAINER_TRUTH[id].cap : ITEM_TRUTH[id].wt;
          return fOrd(cat, d.ids.slice().sort((x, y) => valOf(y) - valOf(x)), lang);
        }
        case 'howToCompare': return METHOD_TRUTH[lang][d.dom === 'cap' ? 0 : 4];
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀要是這個產生器允許的，數字要落在課程自己算得出來的範圍裡。
       形狀比對用的是「合法字串的集合」，不是寬鬆的正規式 —— 打錯一個字就會被抓到。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]|undefined|NaN/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => shapeMatch(k, t, lang));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      const bounds = NUM_RANGE[hit[0]];
      if (bounds){
        const nums = (t.match(/\d+/g) || []).map(Number);
        if (!nums.length) return 'no number in option ' + t;
        for (const v of nums){
          if (!(v >= bounds[0] && v <= bounds[1])){
            return 'option ' + t + ' contains ' + v + ', outside ' + bounds[0] + '~' + bounds[1];
          }
        }
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{AREA_PER_CUP, CONTAINERS, ITEMS, BOXES, UNKNOWNS, CUP_ICON, BLK_ICON, CUP_PX_SMALL, CUP_PX_BIG,' +
                ' POUR_CASES, BAL_CASES, CUP_EX, CUP_WARN, BLK_CASES, truthOf, jarSVG, balanceSVG, rowSVG, BASE, PAD, jarDims, BAL_GEO,' +
                ' BLK_PAN_PX, BLK_PAN_PER_ROW, GAME_W, GPICK, GPAD, GAME_ORDER, GAME_POUR, POUR_H, POUR_JAR, POUR_SAME, POUR_CROWN,' +
                ' TILT_TRAP, TILT_SAME, TILT_BIG, TILT_H, TILT, TILT_ITEM, TILT_SAME_BTN, CUP_BIG, GAME_CUPS, CUPS_H, CUPS_JAR, CUP_ROW, CUP_BTN,' +
                ' GAME_BLOCKS, BLK_ODD_ICON, BLOCKS_H, BLK_BAL, BLK_PAN, BLK_ROW, BLK_TOK, GAME_RANK, RANK_H, RANK_SLOT, RANK_CARD, RANK_JAR, RANK_PIC}',
    check: function(data, I18N, fail, src){
      const LANGS = ['zh','en'];

      /* --- 1. 三本目錄：資料區（大小、輕重）與字典（名字）用索引對齊 --- */
      if (data.AREA_PER_CUP !== AREA_PER_CUP) fail(`AREA_PER_CUP is ${data.AREA_PER_CUP}; the checker expects ${AREA_PER_CUP}`);
      if (data.CONTAINERS.length !== CONTAINER_TRUTH.length){
        fail(`CONTAINERS has ${data.CONTAINERS.length} entries; the checker knows ${CONTAINER_TRUTH.length}`);
      }
      data.CONTAINERS.forEach((c, i) => {
        const t = CONTAINER_TRUTH[i];
        if (!t){ fail(`CONTAINERS[${i}] is not in the checker catalogue`); return; }
        ['w','h','cap'].forEach(k => {
          if (!Number.isInteger(c[k])) fail(`CONTAINERS[${i}].${k} must be a whole number, got ${c[k]}`);
          else if (c[k] !== t[k]) fail(`CONTAINERS[${i}].${k} is ${c[k]}, the checker expects ${t[k]}`);
        });
        if (c.icon !== t.icon) fail(`CONTAINERS[${i}].icon is ${c.icon}, the checker expects ${t.icon}`);
        /* 容量必須就是畫出來的面積換算的杯數 —— 圖和答案不可以是兩套數字。 */
        if (c.w * c.h / data.AREA_PER_CUP !== c.cap){
          fail(`CONTAINERS[${i}] cap ${c.cap} does not match the drawn size (${c.w} × ${c.h} ÷ ${data.AREA_PER_CUP})`);
        }
      });
      if (data.ITEMS.length !== ITEM_TRUTH.length){
        fail(`ITEMS has ${data.ITEMS.length} entries; the checker knows ${ITEM_TRUTH.length}`);
      }
      data.ITEMS.forEach((t2, i) => {
        const t = ITEM_TRUTH[i];
        if (!t){ fail(`ITEMS[${i}] is not in the checker catalogue`); return; }
        ['wt','size'].forEach(k => {
          if (!Number.isInteger(t2[k])) fail(`ITEMS[${i}].${k} must be a whole number, got ${t2[k]}`);
          else if (t2[k] !== t[k]) fail(`ITEMS[${i}].${k} is ${t2[k]}, the checker expects ${t[k]}`);
        });
        if (t2.icon !== t.icon) fail(`ITEMS[${i}].icon is ${t2.icon}, the checker expects ${t.icon}`);
        if (!(t2.size >= 1 && t2.size <= 5)) fail(`ITEMS[${i}].size ${t2.size} is outside 1~5`);
      });
      if (data.BOXES.length !== BOX_TRUTH.length) fail(`BOXES has ${data.BOXES.length} entries; the checker knows ${BOX_TRUTH.length}`);
      data.BOXES.forEach((b, i) => {
        const t = BOX_TRUTH[i];
        if (!t){ fail(`BOXES[${i}] is not in the checker catalogue`); return; }
        if (b.icon !== t.icon || b.wt !== t.wt) fail(`BOXES[${i}] is ${b.icon}/${b.wt}, the checker expects ${t.icon}/${t.wt}`);
      });
      if (new Set(data.BOXES.map(b => b.wt)).size !== data.BOXES.length){
        fail('the boxes must all weigh differently, otherwise a clue chain can have two right answers');
      }

      /* 名字：每一個欄位都跟真值表逐字比對。只驗「有沒有填」擋不住錯字，
         而後面每一句話用的又是同一本字典 —— 那等於自己比自己。 */
      LANGS.forEach(L => {
        const d = I18N[L];
        [['cn', CONTAINER_TRUTH], ['it', ITEM_TRUTH], ['bx', BOX_TRUTH]].forEach(([key, truth]) => {
          const arr = d[key];
          if (!Array.isArray(arr) || arr.length !== truth.length){
            fail(`${L} ${key}: ${(arr || []).length} names but the checker knows ${truth.length}`);
            return;
          }
          arr.forEach((nm, i) => {
            if (nm !== truth[i][L]) fail(`${L} ${key}[${i}] is "${nm}", the checker expects "${truth[i][L]}"`);
          });
        });
        if (new Set(d.cn).size !== d.cn.length) fail(`${L} cn has two containers with the same name`);
        if (new Set(d.it).size !== d.it.length) fail(`${L} it has two things with the same name`);
      });

      /* 兩個迷思在「範例／關卡」層級各有一條檢查（見下面的 POUR_CASES／CUP_EX／
         BAL_CASES／BLK_CASES／ROUNDS）—— 那才是孩子真的會看到的地方，
         而且每一條都有自己的改壞測試。目錄層級不另外斷言：任何一個欄位動了，
         上面的逐字比對就會先響。 */

      /* --- 3. 畫布要蓋住它自己畫出去的四個邊 ---
         只量右緣的話，height="1" 會整批過關（垂直切掉沒人看得到）；
         靠「x 一定寫在 width 前面」認元素的話，把屬性換個順序整個元素就消失了。
         所以：屬性順序無關地各自抓、四個邊都量、而且清點
         「畫了幾個元素」vs「量到幾個元素」—— 對不上就表示有一種元素沒被量到。
         （做法沿用 tools/checks/grade-2-shapes.js 的 canvasOk。） */
      const num = (attrs, name, dflt) => {
        const m = attrs.match(new RegExp('\\b' + name + '="(-?\\d+(?:\\.\\d+)?)"'));
        return m ? Number(m[1]) : dflt;
      };
      const MEASURABLE = ['rect','polygon','line','text'];
      const edgesOf = (svg) => {
        const xs = [], ys = [], xsL = [], ysT = [], partial = [];
        let seen = 0, m;
        /* 「算不算量到了」要等幾何真的抓齊才算數。先 seen++ 再抓的話，
           一個把尺寸寫在 style 裡（或缺 x/width）的 <rect> 會通過清點，
           卻一條邊都沒有貢獻 —— 它畫到畫布外面也沒人看得見。 */
        const reRect = /<rect([^>]*?)\/?>/g;
        while ((m = reRect.exec(svg)) !== null){
          const a = m[1];
          const x = num(a, 'x', NaN), y = num(a, 'y', NaN);
          const w = num(a, 'width', NaN), h = num(a, 'height', NaN);
          const sw = num(a, 'stroke-width', 0) / 2;
          if (![x, y, w, h].every(Number.isFinite)){ partial.push('rect'); continue; }
          seen++;
          xs.push(x + w + sw); ys.push(y + h + sw);
          xsL.push(x - sw); ysT.push(y - sw);
        }
        const rePoly = /<polygon([^>]*?)\/?>/g;
        while ((m = rePoly.exec(svg)) !== null){
          const a = m[1];
          const sw = num(a, 'stroke-width', 0) / 2;
          const ptm = a.match(/\bpoints="([^"]+)"/);
          const pts = ptm ? ptm[1].trim().split(/\s+/).map(p => p.split(',').map(Number)) : [];
          if (!pts.length || !pts.every(xy => xy.length === 2 && xy.every(Number.isFinite))){
            partial.push('polygon'); continue;
          }
          seen++;
          pts.forEach(xy => {
            xs.push(xy[0] + sw); ys.push(xy[1] + sw);
            xsL.push(xy[0] - sw); ysT.push(xy[1] - sw);
          });
        }
        const reLine = /<line([^>]*?)\/?>/g;
        while ((m = reLine.exec(svg)) !== null){
          const a = m[1];
          const sw = num(a, 'stroke-width', 0) / 2;
          const co = ['x1','x2','y1','y2'].map(k => num(a, k, NaN));
          if (!co.every(Number.isFinite)){ partial.push('line'); continue; }
          seen++;
          [co[0], co[1]].forEach(v => { xs.push(v + sw); xsL.push(v - sw); });
          [co[2], co[3]].forEach(v => { ys.push(v + sw); ysT.push(v - sw); });
        }
        /* 文字的右緣不是 x ＋ 字級：還要算字數，以及 text-anchor 把字擺在 x 的哪一邊。
           一個字最寬算 1.2 個字級（emoji 比一個全形字略寬）。上緣抓基線往上一個字級。 */
        const reText = /<text([^>]*)>([^<]*)<\/text>/g;
        while ((m = reText.exec(svg)) !== null){
          const a = m[1], body = m[2];
          const x = num(a, 'x', NaN), y = num(a, 'y', NaN);
          if (!Number.isFinite(x) || !Number.isFinite(y)){ partial.push('text'); continue; }
          seen++;
          const fs = num(a, 'font-size', 20);
          const anchor = (a.match(/\btext-anchor="([a-z]+)"/) || [])[1] || 'start';
          const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
          xs.push(anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide));
          xsL.push(anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x));
          /* y 是基線，不是下緣。emoji 與有 descender 的字會掉到基線下面
             大約三成字級，用 y + 2 量的話一個 20px 的字可以整個掉出畫布還過關。 */
          ys.push(y + Math.ceil(fs * 0.3)); ysT.push(y - fs);
        }
        const tags = (svg.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
        const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
        const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
        return { xs, ys, xsL, ysT, seen, rawCount, unsupported, partial };
      };
      const widthOk = (label, svg) => {
        const w = num(svg, 'width', NaN), h = num(svg, 'height', NaN);
        const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
        const e = edgesOf(svg);
        if (!Number.isFinite(w) || !Number.isFinite(h) || !e.xs.length){
          fail(`${label}: cannot read the drawing geometry`); return;
        }
        if (e.unsupported.length){
          fail(`${label}: draws <${e.unsupported[0]}>, which the geometry reader cannot measure`); return;
        }
        if (e.partial.length){
          fail(`${label}: a <${e.partial[0]}> does not declare the coordinates its bounding box needs, so it cannot be measured`);
          return;
        }
        if (e.seen !== e.rawCount){
          fail(`${label}: the geometry reader measured ${e.seen} of ${e.rawCount} drawn elements — the rest are unmeasured`);
          return;
        }
        if (!vb || Number(vb[1]) !== w || Number(vb[2]) !== h){
          fail(`${label}: the viewBox does not match the canvas (${w} x ${h})`);
        }
        const right = Math.max.apply(null, e.xs), bottom = Math.max.apply(null, e.ys);
        const left = Math.min.apply(null, e.xsL), top = Math.min.apply(null, e.ysT);
        if (!(w >= right + 2)) fail(`${label} is ${w}px wide but draws out to x=${right}`);
        if (!(h >= bottom + 2)) fail(`${label} is ${h}px tall but draws out to y=${bottom}`);
        if (!(left >= 0)) fail(`${label} is clipped by the left edge (draws out to x=${left})`);
        if (!(top >= 0)) fail(`${label} is clipped by the top edge (draws out to y=${top})`);
      };
      /* 每一格孩子按得到的畫面都要驗，不只頭尾。 */
      data.CONTAINERS.forEach((c, ci) => {
        for (let f = 0; f <= c.cap; f++) widthOk(`jarSVG(container ${ci}, ${f} cups)`, data.jarSVG(c, f, 0));
        for (let sp = 1; sp <= 5; sp++) widthOk(`jarSVG(container ${ci}, spill ${sp})`, data.jarSVG(c, c.cap, sp));
      });
      [-1, 0, 1].forEach(tilt => {
        widthOk(`balanceSVG(empty, tilt ${tilt})`, data.balanceSVG(null, null, tilt));
        data.ITEMS.forEach((a, i) => {
          widthOk(`balanceSVG(items ${i}, tilt ${tilt})`, data.balanceSVG(a, data.ITEMS[(i + 1) % data.ITEMS.length], tilt));
        });
      });
      data.ITEMS.forEach((t2, i) => {
        widthOk(`balanceSVG(blocks ${t2.wt})`, data.balanceSVG(t2, { icon:data.BLK_ICON, count:t2.wt }, 0));
      });
      const maxCount = Math.max.apply(null, data.ITEMS.map(x => x.wt).concat(data.CONTAINERS.map(x => x.cap)));
      for (let n = 1; n <= maxCount; n++){
        [data.CUP_PX_SMALL, data.CUP_PX_BIG, 16, 18, 20].forEach(px => {
          widthOk(`rowSVG(${n} @ ${px}px)`, data.rowSVG(n, data.CUP_ICON, px));
        });
      }
      /* 一杯都還沒倒的時候是一張空圖 —— 空的沒有右緣可以量，但它必須真的是空的，
         而且還是要帶得出 data-count，不然檢查腳本連「畫了幾個」都讀不到。 */
      const empty = data.rowSVG(0, data.CUP_ICON, data.CUP_PX_SMALL);
      if (empty.indexOf('data-count="0"') < 0) fail('rowSVG(0) does not carry data-count="0"');
      if (/<text/.test(empty)) fail('rowSVG(0) still draws something');

      /* --- 4. 範例 1：倒倒看。三格必須涵蓋滿出來／還有空位／剛好三種結果 --- */
      const bigans = s => { const m = String(s).match(/<span class="bigans">([^<]*)<\/span>/); return m ? m[1] : null; };
      /* 「高不代表多」那句註解有兩個分支：比較高的真的裝比較多，和比較高的反而沒有。
         寫死一種，就有一半的情況在說謊 —— 兩個分支各自要出現在該出現的時候。 */
      /* 中間那一句話（倒下去發生了什麼／天平往哪邊倒）也要跟真值對得起來。
         只驗 undefined/NaN 的話，滿出來的那一格說成「還有空位」是綠的。
         三個狀態的關鍵詞互斥：該出現的要在，不該出現的兩個都不能在。 */
      const POUR_STATE = {
        zh:{ more:'滿出來', less:'還有空位', same:'剛好裝滿' },
        en:{ more:'spills over', less:'room left', same:'exactly full' }
      };
      const BAL_STATE = {
        zh:{ left:'左邊沉下去', right:'右邊沉下去', level:'天平是平的' },
        en:{ left:'The left side went down', right:'The right side went down', level:'level' }
      };
      const stateOk = (label, text, table, want) => {
        Object.keys(table).forEach(k => {
          const has = text.indexOf(table[k]) >= 0;
          if (k === want && !has) fail(`${label}: the sentence never says "${table[k]}", which is what actually happens`);
          if (k !== want && has) fail(`${label}: the sentence says "${table[k]}", but what happens is "${table[want]}"`);
        });
      };
      const HEIGHT_NOTE = {
        zh:{ more:'真的裝比較多', less:'卻沒有裝比較多' },
        en:{ more:'really does hold more', less:'does not hold more' }
      };
      const SIZE_NOTE = {
        zh:{ more:'真的比較重', less:'卻沒有比較重' },
        en:{ more:'really is heavier', less:'is not heavier' }
      };
      const seenPour = {};
      data.POUR_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.CONTAINERS.length, `POUR_CASES[${i}].a`) || idxOk(c.b, data.CONTAINERS.length, `POUR_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`POUR_CASES[${i}] pours a container into itself`); return; }
        const ca = data.CONTAINERS[c.a].cap, cb = data.CONTAINERS[c.b].cap;
        seenPour[ca > cb ? 'more' : ca < cb ? 'less' : 'same'] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p1s0(c), s1 = d.p1s1(c), s2 = d.p1s2(c), chip = d.s1Chip(c);
          [s0, s1, s2, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`POUR_CASES[${i}] ${L}: ${s}`); });
          stateOk(`POUR_CASES[${i}] ${L} p1s1`, s1, POUR_STATE[L], ca > cb ? 'more' : ca < cb ? 'less' : 'same');
          const want = ca > cb ? fPick('C', c.a, L) : ca < cb ? fPick('C', c.b, L) : fSame('cap', L);
          if (bigans(s2) !== want) fail(`POUR_CASES[${i}] ${L}: p1s2 zh states "${bigans(s2)}", the checker expects "${want}"`);
          const A = data.CONTAINERS[c.a], B = data.CONTAINERS[c.b];
          if (A.h !== B.h){
            const tallCap = A.h > B.h ? A.cap : B.cap, otherCap = A.h > B.h ? B.cap : A.cap;
            const wantNote = tallCap > otherCap ? HEIGHT_NOTE[L].more : HEIGHT_NOTE[L].less;
            const wrongNote = tallCap > otherCap ? HEIGHT_NOTE[L].less : HEIGHT_NOTE[L].more;
            if (s2.indexOf(wantNote) < 0) fail(`POUR_CASES[${i}] ${L}: the height note is missing "${wantNote}"`);
            if (s2.indexOf(wrongNote) >= 0) fail(`POUR_CASES[${i}] ${L}: the wrong height note "${wrongNote}" is shown`);
          }
        });
      });
      ['more','less','same'].forEach(k => {
        if (!seenPour[k]) fail(`POUR_CASES must cover all three outcomes; "${k}" is missing`);
      });

      /* --- 5. 範例 2：天平。三格必須涵蓋左沉／右沉／平的 --- */
      const seenBal = {};
      data.BAL_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.ITEMS.length, `BAL_CASES[${i}].a`) || idxOk(c.b, data.ITEMS.length, `BAL_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`BAL_CASES[${i}] weighs a thing against itself`); return; }
        const wa = data.ITEMS[c.a].wt, wb = data.ITEMS[c.b].wt;
        seenBal[wa > wb ? 'left' : wa < wb ? 'right' : 'level'] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p2s0(c), s1 = d.p2s1(c), s2 = d.p2s2(c), chip = d.s2Chip(c);
          [s0, s1, s2, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`BAL_CASES[${i}] ${L}: ${s}`); });
          stateOk(`BAL_CASES[${i}] ${L} p2s1`, s1, BAL_STATE[L], wa > wb ? 'left' : wa < wb ? 'right' : 'level');
          const want = wa > wb ? fPick('I', c.a, L) : wa < wb ? fPick('I', c.b, L) : fSame('w', L);
          if (bigans(s2) !== want) fail(`BAL_CASES[${i}] ${L}: p2s2 zh states "${bigans(s2)}", the checker expects "${want}"`);
          const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
          if (A.size !== B.size){
            const bigWt = A.size > B.size ? A.wt : B.wt, otherWt = A.size > B.size ? B.wt : A.wt;
            const wantNote = bigWt > otherWt ? SIZE_NOTE[L].more : SIZE_NOTE[L].less;
            const wrongNote = bigWt > otherWt ? SIZE_NOTE[L].less : SIZE_NOTE[L].more;
            if (s2.indexOf(wantNote) < 0) fail(`BAL_CASES[${i}] ${L}: the size note is missing "${wantNote}"`);
            if (s2.indexOf(wrongNote) >= 0) fail(`BAL_CASES[${i}] ${L}: the wrong size note "${wrongNote}" is shown`);
          }
        });
      });
      ['left','right','level'].forEach(k => {
        if (!seenBal[k]) fail(`BAL_CASES must cover all three balance states; "${k}" is missing`);
      });
      /* 索引先過濾再算覆蓋率 —— 直接 .some() 會在越界時讀到 undefined.size，
         檢查腳本自己丟例外，原本想印的那筆錯誤反而不見了。 */
      const itemPairOk = c => Number.isInteger(c.a) && Number.isInteger(c.b) &&
        c.a >= 0 && c.a < data.ITEMS.length && c.b >= 0 && c.b < data.ITEMS.length;
      const biggerLighter = c => {
        const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
        return (A.size > B.size && A.wt < B.wt) || (B.size > A.size && B.wt < A.wt);
      };
      if (!data.BAL_CASES.filter(itemPairOk).some(biggerLighter)){
        fail('BAL_CASES needs one pair where the bigger thing is lighter, or “bigger ≠ heavier” is never shown');
      }

      /* --- 6. 範例 3：用同一個杯子量。這一格必須示範「高的反而裝得少」 --- */
      const E = data.CUP_EX;
      {
        const e = idxOk(E.a, data.CONTAINERS.length, 'CUP_EX.a') || idxOk(E.b, data.CONTAINERS.length, 'CUP_EX.b');
        if (e) fail(e);
        else {
          const A = data.CONTAINERS[E.a], B = data.CONTAINERS[E.b];
          if (!(A.h > B.h && A.cap < B.cap)){
            fail(`CUP_EX: the taller one must hold less (a is ${A.h}px tall / ${A.cap} cups, b is ${B.h}px / ${B.cap} cups)`);
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            const s0 = d.p3s0(E), sa = d.p3sA(E, 1), mid = d.p3sMid(E), sb = d.p3sB(E, 1), end = d.p3End(E);
            [s0, sa, mid, sb, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CUP_EX ${L}: ${s}`); });
            const want = A.cap > B.cap ? fPick('C', E.a, L) : fPick('C', E.b, L);
            if (bigans(end) !== want) fail(`CUP_EX ${L}: p3End zh states "${bigans(end)}", the checker expects "${want}"`);
            /* 「同一個杯子」是這條規則的前提，開場白一定要講出來。 */
            const sameCue = L === 'zh' ? '同一個' : 'same';
            if (s0.indexOf(sameCue) < 0) fail(`CUP_EX ${L}: p3s0 never says the cup must be the same one ("${sameCue}")`);
            if (mid.indexOf(sameCue) < 0) fail(`CUP_EX ${L}: p3sMid never says the cup must be the same one ("${sameCue}")`);
            if (end.indexOf(String(A.cap)) < 0 || end.indexOf(String(B.cap)) < 0){
              fail(`CUP_EX ${L}: p3End never prints both counts (${A.cap} / ${B.cap})`);
            }
          });
        }
      }
      /* 警告圖：大杯的杯數一定要比小杯少，不然那兩個是比得出來的。 */
      {
        const W = data.CUP_WARN;
        /* 一定要用沒有名字的瓶子。換成水壺、水桶那種在別題有固定杯數的容器，
           讀過整課的孩子可以從別處把答案推出來，「還不知道」就不再成立。 */
        if (!Array.isArray(data.UNKNOWNS) || data.UNKNOWNS.length !== UNKNOWN_TRUTH.length){
          fail(`UNKNOWNS has ${(data.UNKNOWNS || []).length} entries; the checker knows ${UNKNOWN_TRUTH.length}`);
        } else {
          data.UNKNOWNS.forEach((u, i) => {
            if (u.icon !== UNKNOWN_TRUTH[i].icon) fail(`UNKNOWNS[${i}].icon is ${u.icon}, the checker expects ${UNKNOWN_TRUTH[i].icon}`);
          });
          LANGS.forEach(L => {
            const arr = I18N[L].un;
            if (!Array.isArray(arr) || arr.length !== UNKNOWN_TRUTH.length){
              fail(`${L} un: ${(arr || []).length} names but the checker knows ${UNKNOWN_TRUTH.length}`);
              return;
            }
            arr.forEach((nm, i) => {
              if (nm !== UNKNOWN_TRUTH[i][L]) fail(`${L} un[${i}] is "${nm}", the checker expects "${UNKNOWN_TRUTH[i][L]}"`);
            });
          });
        }
        const e = idxOk(W.a, UNKNOWN_TRUTH.length, 'CUP_WARN.a') || idxOk(W.b, UNKNOWN_TRUTH.length, 'CUP_WARN.b');
        /* 索引不合法時一定要停：再往下走就是拿 undefined 去讀 .cap，
           檢查腳本自己爆掉，真正的錯誤訊息反而印不出來。 */
        if (e){ fail(e); }
        else {
        if (W.a === W.b) fail('CUP_WARN uses the same jar twice');
        if (!Number.isInteger(W.na) || !Number.isInteger(W.nb)) fail('CUP_WARN counts must be whole numbers');
        else if (!(W.na >= 1 && W.nb <= MAX_CUP)){
          fail(`CUP_WARN counts ${W.na} / ${W.nb} are outside the 1~${MAX_CUP} this lesson ever shows`);
        }
        else if (!(W.na < W.nb)){
          fail(`CUP_WARN: the big-cup count must be smaller than the small-cup count (${W.na} vs ${W.nb}), otherwise the two ARE comparable and “cannot compare” is wrong`);
        }
        if (data.CUP_PX_BIG <= data.CUP_PX_SMALL) fail('the big cup must be drawn bigger than the small cup');
        LANGS.forEach(L => {
          const lb = I18N[L].warnLabel(W.a, W.na, true), ls = I18N[L].warnLabel(W.b, W.nb, false);
          [lb, ls].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CUP_WARN ${L}: ${s}`); });
          if (lb === ls) fail(`CUP_WARN ${L}: the two labels are identical, so the different cups are invisible`);
        });
        }
      }

      /* --- 7. 範例 4：用一樣的積木秤 --- */
      data.BLK_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.ITEMS.length, `BLK_CASES[${i}].a`) || idxOk(c.b, data.ITEMS.length, `BLK_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`BLK_CASES[${i}] weighs a thing against itself`); return; }
        const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
        if (A.wt === B.wt) fail(`BLK_CASES[${i}]: the two things must differ in weight, otherwise there is nothing to compare`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p4s0(c), s1 = d.p4s1(c), s2 = d.p4s2(c), s3 = d.p4s3(c), chip = d.s4Chip(c);
          [s0, s1, s2, s3, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`BLK_CASES[${i}] ${L}: ${s}`); });
          const want = A.wt > B.wt ? fPick('I', c.a, L) : fPick('I', c.b, L);
          if (bigans(s3) !== want) fail(`BLK_CASES[${i}] ${L}: p4s3 zh states "${bigans(s3)}", the checker expects "${want}"`);
          if (s1.indexOf(String(A.wt)) < 0) fail(`BLK_CASES[${i}] ${L}: p4s1 never prints ${A.wt}`);
          if (s2.indexOf(String(B.wt)) < 0) fail(`BLK_CASES[${i}] ${L}: p4s2 never prints ${B.wt}`);
          /* 「一樣的積木」是這條規則的前提。 */
          const sameCue = L === 'zh' ? '積木要一樣' : 'identical';
          if (s3.indexOf(sameCue) < 0) fail(`BLK_CASES[${i}] ${L}: p4s3 never says the blocks must be identical ("${sameCue}")`);
        });
      });
      if (!data.BLK_CASES.filter(itemPairOk).some(biggerLighter)){
        fail('BLK_CASES needs one pair where the bigger thing is lighter');
      }

      /* --- 8. 遊戲：真值表 --- */
      /* 課程的 truthOf 先跟設定檔自己的表對過一次，之後遊戲的真值一律從
         設定檔的表算 —— 直接用 data.truthOf 等於拿課程自己的函式當標準答案，
         truthOf 寫錯時整個遊戲照樣是綠的。 */
      const TRUTH_TABLES = { C:CONTAINER_TRUTH, I:ITEM_TRUTH, B:BOX_TRUTH };
      Object.keys(TRUTH_TABLES).forEach(cat => {
        TRUTH_TABLES[cat].forEach((row, id) => {
          const want = cat === 'C' ? row.cap : row.wt;
          const got = data.truthOf(cat, id);
          if (got !== want) fail(`truthOf('${cat}', ${id}) returns ${got}, the checker's own table says ${want}`);
        });
      });
      const truth = (cat, id) => (cat === 'C' ? CONTAINER_TRUTH[id].cap : TRUTH_TABLES[cat][id].wt);
      /* 遊戲用到的一排杯子／積木：每一種一排幾個（per）都要量 */
      for (let n = 1; n <= maxCount; n++){
        [[data.CUP_PX_SMALL, data.CUP_ROW.smallPer], [data.CUP_PX_BIG, data.CUP_ROW.bigPer], [data.BLK_ROW.px, data.BLK_ROW.per]].forEach(([px, per]) => {
          widthOk(`rowSVG(${n} @ ${px}px, ${per} a row)`, data.rowSVG(n, data.CUP_ICON, px, per));
        });
      }

      /* 遊戲（§六之五，2026-10-02 改版）：見檔案上方的 gameCheck() */
      gameCheck(data, I18N, fail, src, truth);

      /* --- 8b. 速查卡與家長頁：這兩頁也會教規則，也要被驗 ---
         breaktest 會把四頁都複製進暫存目錄，所以這裡的斷言真的跑得到。 */
      const fs2 = require('fs');
      const pageDir = require('path').dirname(process.argv[2]);
      const readPage = name => {
        try { return fs2.readFileSync(require('path').join(pageDir, name), 'utf8'); }
        catch (e){ fail(`cannot read ${name}: ${e.code}`); return ''; }
      };
      const refSrc = readPage('reference.html');
      const parSrc = readPage('parents.html');
      /* 積木能不能拿來比，看的是「每個一樣重」，不是「一樣大」。
         只找關鍵詞擋不住極性 —— 「積木不需要一樣重」也含有「一樣重」三個字。
         所以整句逐字比對設定檔自己寫的那一句。 */
      const refDict = { zh:'', en:'' };
      LANGS.forEach(L => {
        const m = refSrc.match(new RegExp("htmlLang:'" + (L === 'zh' ? 'zh-Hant' : 'en') + "'[\\s\\S]*?(?=\\n    \\}|$)"));
        refDict[L] = m ? m[0] : '';
        if (!refDict[L]) fail(`reference.html: cannot locate the ${L} dictionary`);
      });
      Object.keys(REF_RULE).forEach(key => {
        LANGS.forEach(L => {
          const want = REF_RULE[key][L];
          const got = (refDict[L].match(new RegExp(key + ":'((?:\\\\.|[^'\\\\])*)'")) || [])[1];
          if (got === undefined){
            fail(`reference.html ${L}: ${key} is missing`);
          } else if (got !== want){
            fail(`reference.html ${L}: ${key} reads "${got}", the checker expects "${want}" — must not make block comparison depend on size, and must not flip the polarity`);
          }
        });
      });
      /* 盛飯活動數出來的是鍋裡現在的飯，不是鍋子裝得下多少 ——
         不講清楚的話，12 碗的鍋裡放 4 碗飯會被判成「比 6 碗的鍋小」。 */
      /* 要驗的是「真的會顯示出來的那一段」：字典裡 h1p 的兩個語言值，
         加上 markup 真的把它綁在 data-i18n="h1p" 上。只在整份原始碼裡數字串的話，
         把 data-i18n 換成別的 key（畫面上的段落就被換掉了）仍然是綠的。 */
      /* 「同一個杯子」是充分條件、不是必要條件：必要性的說法
         （「只有…才成立」／“only true when”）在 3 大杯 vs 2 小杯 那裡是假的。 */
      [['只有在兩邊用同一個杯子時才成立', 'zh'], ['only true when both were measured with the same cup', 'en']].forEach(([bad, L]) => {
        if (parSrc.indexOf(bad) >= 0){
          fail(`parents.html ${L}: must keep the two directions apart — "${bad}" claims the same cup is NECESSARY, but 3 big cups already beat 2 small ones`);
        }
      });
      [['一定裝得多', 'zh'], ['does guarantee more', 'en']].forEach(([cue, L]) => {
        if (parSrc.indexOf(cue) < 0){
          fail(`parents.html ${L}: must keep the two directions apart — the guarantee direction ("${cue}") is missing`);
        }
      });
      /* 「滿出來了，所以這個裝得比較多」——「這個」可以指到接水的那一個，
         剛好是相反的結論。角色一定要指名。 */
      /* 中文在 markup 與字典各一份、英文只在字典裡。只驗「有沒有出現過」的話，
         改掉 markup 那一份（畫面第一眼看到的就是它）還是綠的。 */
      [['倒出去的', 'zh', 2], ['poured <strong>from</strong>', 'en', 1]].forEach(([cue, L, want]) => {
        const got = parSrc.split(cue).length - 1;
        if (got < want){
          fail(`parents.html ${L}: the spill criterion must name which container it poured from ("${cue}") ${want}x, found ${got}x — "this one" can point at the receiver`);
        }
      });
      if (!/<p data-i18n="h1p">/.test(parSrc)){
        fail('parents.html: the rice activity paragraph is not bound to data-i18n="h1p", so the visible text is not the one being checked');
      }
      [['不是鍋子能裝多少', 'zh'], ['not what the pot could hold', 'en']].forEach(([cue, L]) => {
        const m = parSrc.match(new RegExp('"h1p":\\s*"((?:\\\\.|[^"\\\\])*)"', 'g')) || [];
        const vals = m.map(x => x.replace(/^"h1p":\s*"/, '').replace(/"$/, ''));
        const hit = vals.filter(v => v.indexOf(cue) >= 0).length;
        if (!hit){
          fail(`parents.html ${L}: the h1p entry must say what the bowl count measures ("${cue}") — counting served bowls measures the rice, not the pot`);
        }
      });

      /* --- 9. 三層題庫的神諭表 ---
         每一題記三件事，都跟題目本身分開維護：
         - nums：題幹裡「剛剛好」該出現的數字（中英都驗）
         - derive：從真值表把正解「算出來」，不是抄答案
         - optSet：這一題四個選項的完整集合（只驗正解的話，把某個誘答換成
           「banana」也不會有人發現） */
      const CAP_SET = L => [fSame('cap', L), fNo('cap', L)];
      const W_SET = L => [fSame('w', L), fNo('w', L)];
      /* 題幹與解釋的語意神諭：must 是「這一題非說不可」的關鍵句，
         mustNot 是「說了就代表題目被改成另一題」的相反關鍵句。
         沒有這一層，把「水滿出來了」換成「還有空位」而正解不動，所有檢查都是綠的。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[], derive:{ k:'cname', id:0 },
            stem:{ zh:{ must:['把水壺裝滿的水倒進','水滿出來了'], mustNot:['還有空位','剛好裝滿'] },
                 en:{ must:['full kettle is poured into','spills over'], mustNot:['room left','exactly full'] } },
            why:{ zh:['水滿出來','水壺裝得比較多'], en:['Spilling over','the kettle holds more'] },
            optSet:{ zh:['🥛 玻璃杯','🫖 水壺'].concat(CAP_SET('zh')),
                     en:['🥛 the glass','🫖 the kettle'].concat(CAP_SET('en')) } },
          { nums:[], derive:{ k:'iname', id:6 },
            stem:{ zh:{ must:['天平兩邊各放一個','石頭那一邊沉下去'], mustNot:['氣球那一邊沉下去','天平是平的'] },
                 en:{ must:['One thing on each side','stone’s side went down'], mustNot:['balloon’s side went down','stays level'] } },
            why:{ zh:['沉下去的那一邊比較重','石頭比較重'], en:['side that goes down is the heavier one','the stone is heavier'] },
            optSet:{ zh:['🎈 氣球','🪨 石頭'].concat(W_SET('zh')),
                     en:['🎈 the balloon','🪨 the stone'].concat(W_SET('en')) } },
          { nums:[8,6], derive:{ k:'moreCups', ids:[0,3], counts:[8,6] },
            stem:{ zh:{ must:['用同一個小杯子量','水壺 8 杯','碗 6 杯'], mustNot:['大杯','不一樣'] },
                 en:{ must:['same small cup','kettle took 8 cups','bowl took 6 cups'], mustNot:['big cup','different'] } },
            why:{ zh:['8 杯比 6 杯多','水壺裝得比較多'], en:['8 cups is more than 6 cups','the kettle holds more'] },
            optSet:{ zh:['🫖 水壺','🥣 碗'].concat(CAP_SET('zh')),
                     en:['🫖 the kettle','🥣 the bowl'].concat(CAP_SET('en')) } },
          { nums:[4,6], derive:{ k:'moreBlocks', ids:[2,5], counts:[4,6] },
            stem:{ zh:{ must:['用一樣的積木秤','蘋果 4 個','玩具熊 6 個'], mustNot:['不一樣的積木'] },
                 en:{ must:['identical blocks','apple took 4 blocks','teddy bear took 6 blocks'], mustNot:['different blocks'] } },
            why:{ zh:['6 個比 4 個多','玩具熊比較重'], en:['6 blocks is more than 4 blocks','the teddy bear is heavier'] },
            optSet:{ zh:['🍎 蘋果','🧸 玩具熊'].concat(W_SET('zh')),
                     en:['🍎 the apple','🧸 the teddy bear'].concat(W_SET('en')) } },
          /* 這一題刻意用「別處從來沒量過」的兩個瓶子：換成花瓶／碗的話，
             孩子從別題記得碗是 6 杯、花瓶是 5 杯，「碗裝得比較多」就變成
             可以由正確回想到達的錯誤選項。 */
          { nums:[], derive:{ k:'lit', zh:'還不知道，要量量看', en:'nobody knows yet — measure them' },
            stem:{ zh:{ must:['甲瓶又高又細','乙瓶又矮又寬','只知道這件事'], mustNot:['杯','花瓶','碗'] },
                 en:{ must:['Jar A is tall and thin','jar B is short and wide','Knowing only that'], mustNot:['cup','vase','bowl'] } },
            why:{ zh:['決定不了裝得多不多'], en:['decides nothing on its own'] },
            optSet:{ zh:['甲瓶裝得比較多','乙瓶裝得比較多','兩個一樣多','還不知道，要量量看'],
                     en:['jar A holds more','jar B holds more','they hold the same','nobody knows yet — measure them'] } },
          { nums:[], derive:{ k:'lit', zh:'兩個一樣重', en:'they weigh the same' },
            stem:{ zh:{ must:['兩邊各放一個東西','天平是平的'], mustNot:['沉下去'] },
                 en:{ must:['One thing on each side','stays level'], mustNot:['went down'] } },
            why:{ zh:['兩邊一樣重'], en:['weigh the same'] },
            optSet:{ zh:['左邊比較重','右邊比較重','兩個一樣重','兩個都很輕'],
                     en:['the left side is heavier','the right side is heavier','they weigh the same','both of them are light'] } }
        ],
        qsAdv: [
          /* 大杯的杯數必須比小杯少，否則「沒辦法比」是錯的。 */
          { nums:[3,5], bigCupSmaller:true, derive:{ k:'lit', zh:'沒辦法比', en:'there is no way to tell' },
            stem:{ zh:{ must:['用大杯量','用小杯量','甲瓶','乙瓶'], mustNot:['同一個'] },
                 en:{ must:['with a big cup','with a small cup','jar A','jar B'], mustNot:['same small cup'] } },
            why:{ zh:['不一樣大','不一定裝得多','再量一次'], en:['different sizes','need not mean more','one single cup'] },
            optSet:{ zh:['🫙 甲瓶','🍯 乙瓶'].concat(CAP_SET('zh')),
                     en:['🫙 jar A','🍯 jar B'].concat(CAP_SET('en')) } },
          { nums:[], derive:{ k:'rel', a:0, b:2 },
            stem:{ zh:{ must:['三個一樣大的箱子','紅箱比 🟦 藍箱重','藍箱比 🟨 黃箱重'], mustNot:['黃箱比 🟦 藍箱重'] },
                 en:{ must:['boxes of the same size','red box is heavier than 🟦 the blue box','blue box is heavier than 🟨 the yellow box'], mustNot:['beats'] } },
            why:{ zh:['接起來就是紅比黃重','中間都是藍箱'], en:['red box is heavier than the yellow box','middle of both clues'] },
            optSet:{ zh:[fRel(2, 0, 'zh'), fRel(0, 2, 'zh')].concat(W_SET('zh')),
                     en:[fRel(2, 0, 'en'), fRel(0, 2, 'en')].concat(W_SET('en')) } },
          { nums:[9,6], derive:{ k:'cupsDiff', nums:[9,6] },
            stem:{ zh:{ must:['用同一個小杯子量','水桶 9 杯','碗 6 杯','多裝幾杯'], mustNot:['大杯'] },
                 en:{ must:['same small cup','bucket took 9 cups','bowl took 6 cups','How many more cups'], mustNot:['big cup'] } },
            why:{ zh:['9 － 6 ＝ 3','多 3 杯'], en:['9 − 6 = 3','3 more cups'] },
            optSet:{ zh:['3 杯','6 杯','9 杯','15 杯'], en:['3 cups','6 cups','9 cups','15 cups'] } },
          { nums:[14,4,6], derive:{ k:'ordIcons', ids:[7,2,5] },
            stem:{ zh:{ must:['用一樣的積木秤','從重到輕排排看'], mustNot:['從輕到重'] },
                 en:{ must:['identical blocks','heaviest first'], mustNot:['lightest first'] } },
            why:{ zh:['積木多的比較重'], en:['More blocks means heavier'] },
            optSet:{ zh:['🍉 → 🧸 → 🍎','🍉 → 🍎 → 🧸','🍎 → 🧸 → 🍉','🧸 → 🍉 → 🍎'],
                     en:['🍉 → 🧸 → 🍎','🍉 → 🍎 → 🧸','🍎 → 🧸 → 🍉','🧸 → 🍉 → 🍎'] } }
        ],
        qsBoost: [
          /* 大氣球比小石頭輕：真值表要真的是這樣，這一題才成立。 */
          { nums:[], bigLighter:[1,6], derive:{ k:'lit', zh:'石頭比較重，雖然比較小', en:'the stone is heavier, even though it is smaller' },
            stem:{ zh:{ must:['大氣球','小石頭','石頭那一邊沉下去'], mustNot:['氣球那一邊沉下去'] },
                 en:{ must:['big balloon','small stone','stone’s side goes down'], mustNot:['balloon’s side goes down'] } },
            why:{ zh:['石頭比較重','大小和輕重是兩件事'], en:['the stone is heavier','two different things'] },
            optSet:{ zh:['比較大的一定比較重','氣球比較重，因為比較大','石頭比較重，雖然比較小','兩個一樣重'],
                     en:['the bigger one is always the heavier one','the balloon is heavier, because it is bigger',
                         'the stone is heavier, even though it is smaller','they weigh the same'] } },
          /* 花瓶比碗高，卻裝得比較少：真值表要真的是這樣。 */
          { nums:[5,6], tallerSmaller:[1,3], derive:{ k:'moreCups', ids:[1,3], counts:[5,6] },
            stem:{ zh:{ must:['花瓶比 🥣 碗高','用同一個小杯子量','花瓶 5 杯','碗 6 杯'], mustNot:['大杯'] },
                 en:{ must:['vase is taller than','same small cup','vase took 5 cups','bowl took 6 cups'], mustNot:['big cup'] } },
            why:{ zh:['6 杯比 5 杯多','碗裝得比較多','比較高的不一定裝得多'], en:['6 cups is more than 5 cups','the bowl holds more','does not have to hold more'] },
            optSet:{ zh:['🏺 花瓶','🥣 碗'].concat(CAP_SET('zh')),
                     en:['🏺 the vase','🥣 the bowl'].concat(CAP_SET('en')) } }
        ]
      };
      const deriveStr = (dv, L) => {
        if (dv.k === 'cname') return fCName(dv.id, L);
        if (dv.k === 'iname') return fIName(dv.id, L);
        if (dv.k === 'lit') return dv[L];
        if (dv.k === 'rel') return fRel(dv.a, dv.b, L);
        if (dv.k === 'cupsDiff') return fCup(dv.nums[0] - dv.nums[1], L);
        if (dv.k === 'moreCups'){
          const win = dv.counts[0] > dv.counts[1] ? dv.ids[0] : dv.ids[1];
          return fCName(win, L);
        }
        if (dv.k === 'moreBlocks'){
          const win = dv.counts[0] > dv.counts[1] ? dv.ids[0] : dv.ids[1];
          return fIName(win, L);
        }
        if (dv.k === 'ordIcons'){
          return dv.ids.slice().sort((x, y) => ITEM_TRUTH[y].wt - ITEM_TRUTH[x].wt)
            .map(id => ITEM_TRUTH[id].icon).join(' → ');
        }
        return 'NO DERIVATION';
      };
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            [...new Set((plain.match(/\d+/g) || []).map(Number))].forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ') || 'none'})`);
              }
            });
            /* 2. 正解是從真值表算出來的，不是抄的。 */
            const want = deriveStr(o.derive, L);
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 2b. 題幹到底說了什麼。只驗數字和答案的話，把「水滿出來了」換成
               「還有空位」而正解不動，整題還是綠的 —— 而那時正確推理會選另一個。 */
            if (!o.stem || !o.stem[L]){
              fail(`${bank}[${i}] ${L}: no stem oracle recorded in the checker`);
            } else {
              (o.stem[L].must || []).forEach(phrase => {
                if (plain.indexOf(phrase) < 0) fail(`${bank}[${i}] ${L}: the stem never says "${phrase}"`);
              });
              (o.stem[L].mustNot || []).forEach(phrase => {
                if (plain.indexOf(phrase) >= 0) fail(`${bank}[${i}] ${L}: the stem says "${phrase}", which turns it into a different question`);
              });
            }
            /* 2c. 解釋要真的解釋。整個 why 從來沒被讀過，所以
               「8 比 6 少，所以水壺裝得比較多」也是綠的。 */
            const whyPlain = String(q.why || '').replace(/<[^>]+>/g, ' ');
            if (whyPlain.trim().length < 8){
              fail(`${bank}[${i}] ${L}: the explanation is empty or too short to explain anything`);
            }
            o.nums.forEach(n => {
              if (!hasNum(whyPlain, n)) fail(`${bank}[${i}] ${L}: the explanation never mentions ${n}, which the stem gives`);
            });
            if (!o.why || !o.why[L]){
              fail(`${bank}[${i}] ${L}: no explanation oracle recorded in the checker`);
            } else {
              o.why[L].forEach(phrase => {
                if (whyPlain.indexOf(phrase) < 0){
                  fail(`${bank}[${i}] ${L}: the explanation never says "${phrase}", so it does not state why the answer is right`);
                }
              });
            }
            /* 3. 四個選項的集合要剛剛好。 */
            const got = q.opts.slice().sort().join(' | ');
            const wantSet = o.optSet[L].slice().sort().join(' | ');
            if (got !== wantSet) fail(`${bank}[${i}] ${L}: the option set for this question is\n      ${got}\n    but the checker expects\n      ${wantSet}`);
            /* 4. 選項字串兩兩不同、數字在範圍裡。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
              }
            }
            q.opts.forEach(opt => {
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= 20)) fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~20`);
              });
            });
            /* 5. 這一題賴以成立的前提，在真值表裡要是真的。 */
            if (o.bigCupSmaller){
              /* 從**題幹本身**讀出來，不是拿神諭自己的數字比自己：大杯的杯數
                 一定要比小杯少，否則 3 大杯 vs 2 小杯 是比得出來的，
                 「沒辦法比」就變成錯的答案。 */
              const inStem = (plain.match(/\d+/g) || []).map(Number);
              if (inStem.length !== 2){
                fail(`${bank}[${i}] ${L}: the two-cup question must print exactly two numbers, got ${inStem.join(' / ') || 'none'}`);
              } else if (!(inStem[0] < inStem[1])){
                fail(`${bank}[${i}] ${L}: the big cup measured MORE cups than the small cup (${inStem[0]} vs ${inStem[1]}), so the two ARE comparable and “cannot compare” is wrong`);
              }
            }
            if (o.bigLighter){
              const [big, small] = o.bigLighter;
              if (!(ITEM_TRUTH[big].size > ITEM_TRUTH[small].size && ITEM_TRUTH[big].wt < ITEM_TRUTH[small].wt)){
                fail(`${bank}[${i}]: this question needs item ${big} to be bigger AND lighter than item ${small}`);
              }
            }
            if (o.tallerSmaller){
              const [tall, wide] = o.tallerSmaller;
              if (!(CONTAINER_TRUTH[tall].h > CONTAINER_TRUTH[wide].h && CONTAINER_TRUTH[tall].cap < CONTAINER_TRUTH[wide].cap)){
                fail(`${bank}[${i}]: this question needs container ${tall} to be taller AND smaller than container ${wide}`);
              }
            }
            if (o.derive.k === 'moreCups'){
              o.derive.ids.forEach((id, k) => {
                if (CONTAINER_TRUTH[id].cap !== o.derive.counts[k]){
                  fail(`${bank}[${i}]: the stem says container ${id} takes ${o.derive.counts[k]} cups, but the lesson's own catalogue says ${CONTAINER_TRUTH[id].cap}`);
                }
              });
            }
            if (o.derive.k === 'moreBlocks'){
              o.derive.ids.forEach((id, k) => {
                if (ITEM_TRUTH[id].wt !== o.derive.counts[k]){
                  fail(`${bank}[${i}]: the stem says item ${id} takes ${o.derive.counts[k]} blocks, but the lesson's own catalogue says ${ITEM_TRUTH[id].wt}`);
                }
              });
            }
          });
        });
      });
    }
  }
};
