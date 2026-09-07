/* grade-4/math/chain-divide —— 分裝生產線（四則混合計算裡只有乘和除的那一半：
 * 連除、乘除混合、併式與括號，以及把大除數拆成兩個小的）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作：
 *
 * 1) 除法本身。課程頁與產生器用 JavaScript 的 `/`。這裡的參考實作走另一條路：
 *    **重複相減**（divRef）。這一課教的規則「連續除以兩個數 ＝ 除以那兩個數的積」
 *    因此是被**兩次獨立的減法迴圈**證明的，不是把同一條除法再寫一次。
 *
 * 2) 算式。課程頁印出一個字串、另外算一個值；這裡**把印出來的字串讀回來**
 *    （evalPrintedRef）再算一次，用有理數（分子／分母）不用浮點數。
 *    ⚠️ 這是「量畫出來的東西」而不是「把同一條代數再寫一次」——
 *    全形的 ÷ × ＋ ＝ 和半形的 / * + = 都要讀得懂，因為中英文用的符號不一樣。
 *    同層一律**從左往右**、乘除比加減先算 —— 那正是這一課教的規則，
 *    所以這支求值器同時是「規則的第二套實作」。
 *
 * 3) 圖。packPlan 是純資料函式，這裡把它**跑起來**再驗兩件不同的事：
 *    ① `packRef` 是一份**另外寫死的黃金實作**（FIG_REF 是這份設定檔自己的規格，
 *       不是頁面匯出的常數）。⚠️ 說清楚它的極限：它和 packPlan 的**分解方式相同**，
 *       所以它擋得住「常數被改掉」，擋不住「兩邊都照同一個錯誤的版面觀念寫」
 *       （codex 第一輪指出原本的註解把它說成「獨立重寫」，那太滿了）。
 *    ② 因此另外驗一組**宣告式的性質**，不重跑 packPlan 的控制流：
 *       每一個點都在畫布內、每一袋在唯一一個箱子裡、每一袋剛好幾個點、
 *       箱子互不重疊、相鄰箱子的間距都一樣、袋內點距都一樣、整組內容在畫布上居中。
 *
 * 4) 拆除數。splitDivisor 給的拆法，這裡**列舉所有因數對**再確認它在裡面，
 *    而且每一步都除得剛剛好。
 *
 * ⚠️ 這一課只出**整除**的題目，設定檔必須分開驗（每一個產生器、每一個範例、每一關遊戲）。
 *    ⚠️ 理由不是「規則在有餘數時不成立」—— 巢狀的整數除法其實恆等
 *    （floor(floor(n/a)/b) === floor(n/(a*b))，對 n ≤ 600、a、b ≤ 12 全部驗過）；
 *    真正的理由是**有餘數就要處理「剩下的怎麼算」**，那是這一課刻意讓出去的範圍。
 *    （2026-09-07 codex 第一輪抓到原本那句話是假的。）
 * ⚠️ 這一課不用負數、不用小數：每一個選項、每一個答案都是 0 ~ 10000 的整數。
 */

const fs = require('fs');
const path = require('path');
const { makeArith } = require('./lib/arith.js');
/* ⚠️ 沒有用 lib/canvas.js：那一支讀的是**原始碼裡的 SVG 標籤**，而這一課的圖是
   packPlan() 在執行時畫出來的，原始碼裡的 <svg> 只有一個空殼。畫布容不容得下
   由 data.check 直接驗每一個方框與每一個點的四個邊（見 packProblems），
   另外單獨驗一次 viewBox 和 CSS 的長寬比一不一樣（issue #5 那一類缺陷）。 */

/* ⚠️ HTML 實體要先還原再判：`第&#49;步` 畫面上是「第1步」（中文黏數字）、
   `5 &divide; 2` 畫面上是一條除法、`display&#58;none` 畫面上是隱藏 ——
   原始字串裡一個都看不到，不還原的話這幾條檢查全部看不到它們。
   （2026-09-07 codex 第一、二輪各抓到一次。） */
function decodeEntities(x){
  return String(x)
    /* ⚠️ 分號是可以省的（瀏覽器照樣認得 `&divide` 和 `&#247`），所以 `;` 要寫成選配。
       （2026-09-07 codex 第三輪） */
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (m, d) => String.fromCodePoint(Number(d)))
    .replace(/&divide;?/gi, '÷').replace(/&times;?/gi, '×')
    .replace(/&plus;?/gi, '+').replace(/&minus;?/gi, '−').replace(/&sol;?/gi, '/')
    .replace(/&nbsp;?/gi, ' ').replace(/&lt;?/gi, '<').replace(/&gt;?/gi, '>')
    .replace(/&quot;?/gi, '"').replace(/&#39;?/g, "'").replace(/&amp;?/gi, '&');
}

const VAL_MAX_REF = 10000;
const TOTAL_MAX_REF = 999;
function inRangeRef(v){
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= VAL_MAX_REF;
}

/* ---------- 1) 除法的參考實作：重複相減 ----------
   ⚠️ 一定不要在這裡用 `/` 或 `%`：那樣就變成把課程頁的除法再抄一次。 */
function divRef(a, b){
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b <= 0) return null;
  let q = 0, r = a;
  while (r >= b){
    r -= b;
    q++;
    if (q > 1000000) return null;          /* 迴圈失控時要響亮地失敗，不要靜靜跑不完 */
  }
  return { q:q, r:r };
}
/* 乘法也自己寫一份（重複相加），這樣「a × b」這個期望值不是抄頁面的。 */
function mulRef(a, b){
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return null;
  let s = 0;
  for (let i = 0; i < b; i++){
    s += a;
    if (s > 100000000) return null;
  }
  return s;
}
/* 連續除兩次 vs 除以積 —— 兩邊各用一次減法迴圈算出來，回報是否相等且都整除。 */
function chainVsOnceRef(t, a, b){
  const first = divRef(t, a);
  if (!first) return { ok:false, why:'divRef refused ' + t + ' / ' + a };
  const second = divRef(first.q, b);
  if (!second) return { ok:false, why:'divRef refused ' + first.q + ' / ' + b };
  const prod = mulRef(a, b);
  if (prod === null) return { ok:false, why:'mulRef refused ' + a + ' * ' + b };
  const once = divRef(t, prod);
  if (!once) return { ok:false, why:'divRef refused ' + t + ' / ' + prod };
  return {
    ok:true,
    chain:second.q, once:once.q, prod:prod,
    exact:(first.r === 0 && second.r === 0 && once.r === 0),
    agree:(second.q === once.q)
  };
}

/* ---------- 2) 把印出來的算式讀回來算 ----------
   有理數運算（分子／分母），所以除不盡也算得出來，可以拿來證明
   「這個誘答的值和正解不一樣」。 */
function gcdRef(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a; }
function frac(n, d){
  if (d === 0) return null;
  if (d < 0){ n = -n; d = -d; }
  const g = gcdRef(n, d) || 1;
  return { n:n / g, d:d / g };
}
const fAdd = (x, y) => frac(x.n * y.d + y.n * x.d, x.d * y.d);
const fSub = (x, y) => frac(x.n * y.d - y.n * x.d, x.d * y.d);
const fMul = (x, y) => frac(x.n * y.n, x.d * y.d);
const fDiv = (x, y) => (y.n === 0 ? null : frac(x.n * y.d, x.d * y.n));
const fEq = (x, y) => !!x && !!y && x.n === y.n && x.d === y.d;
const fIsInt = x => !!x && x.d === 1;
const fVal = x => (x ? x.n + (x.d === 1 ? '' : '/' + x.d) : 'null');

/* 全形與半形都要讀得懂：中文用 ＝ ÷ × ＋ －，英文用 = / * + -（HTML 裡是 ÷ ×）。
   ⚠️ HTML 實體要**先**還原：`5 &divide; 2` 畫面上是 `5 ÷ 2`，不還原的話它整條溜過去
   （2026-09-07 codex 第二輪）。
   ⚠️ 半形的 `/` **先換成空白**再把 ÷ 換成 `/`：這一課的算式一律用 ÷，
   而散文裡的 `/` 是日期或並列（`2026/9/7`、`and/or`），不是除法 —— 不先拿掉的話
   日期會被讀成一條除不盡的除法（codex 第二輪的假警報）。 */
function normPrinted(s){
  return decodeEntities(String(s))
    .replace(/<[^>]+>/g, '')
    .replace(/\//g, ' ')
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/[＝]/g, '=')
    .replace(/[＋]/g, '+')
    .replace(/[－−–—]/g, '-')
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}
/* 遞迴下降：+ - 低優先，* / 高優先，同層**從左往右** —— 這一課教的規則。
   讀不懂一律回 null（fail closed），不可以「跳過」。 */
function evalPrintedRef(src){
  const s = normPrinted(src);
  let i = 0;
  const ws = () => { while (i < s.length && s[i] === ' ') i++; };
  function factor(){
    ws();
    if (s[i] === '('){
      i++;
      const v = expr();
      ws();
      if (s[i] !== ')') return null;
      i++;
      return v;
    }
    let j = i;
    while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
    if (j === i) return null;
    const v = frac(Number(s.slice(i, j)), 1);
    i = j;
    return v;
  }
  function term(){
    let v = factor();
    if (!v) return null;
    for (;;){
      ws();
      if (s[i] === '*' || s[i] === '/'){
        const op = s[i]; i++;
        const r = factor();
        if (!r) return null;
        v = (op === '*') ? fMul(v, r) : fDiv(v, r);
        if (!v) return null;
      } else return v;
    }
  }
  function expr(){
    let v = term();
    if (!v) return null;
    for (;;){
      ws();
      if (s[i] === '+' || s[i] === '-'){
        const op = s[i]; i++;
        const r = term();
        if (!r) return null;
        v = (op === '+') ? fAdd(v, r) : fSub(v, r);
        if (!v) return null;
      } else return v;
    }
  }
  const v = expr();
  ws();
  return (i === s.length) ? v : null;
}
/* 「這個算式字串印出來的值是多少」—— 給斷言用的整數版本，除不盡就回 null。 */
function intOfPrinted(src){
  const v = evalPrintedRef(src);
  return fIsInt(v) ? v.n : null;
}

/* ---------- 3) 圖的參考實作 ----------
   ⚠️ 這一份規格是**設定檔自己寫死的**，不是從課程頁匯出的常數算出來的。
   改了課程頁的任何一個版面常數，這裡就會不同意 —— 那是刻意的。 */
const FIG_REF = {
  W:460, H:150, DOT_R:5, DOT_DX:14, DOT_DY:14, DOT_COLS:2,
  BAG_PAD:6, BAG_GAP:6, BOX_PAD:7, BOX_GAP:8,
  PILE_COLS:8, PILE_DX:20, PILE_DY:20
};
function packRef(t, a, b, step){
  const F = FIG_REF;
  const perBag = t / (a * b);
  const rects = [], dots = [];
  if (step <= 0){
    const cols = Math.min(F.PILE_COLS, t), rows = Math.ceil(t / F.PILE_COLS);
    const pw = (cols - 1) * F.PILE_DX + 2 * F.DOT_R, ph = (rows - 1) * F.PILE_DY + 2 * F.DOT_R;
    const px = (F.W - pw) / 2, py = (F.H - ph) / 2;
    for (let k = 0; k < t; k++){
      dots.push({ x:px + F.DOT_R + (k % F.PILE_COLS) * F.PILE_DX,
                  y:py + F.DOT_R + Math.floor(k / F.PILE_COLS) * F.PILE_DY });
    }
    return { rects, dots };
  }
  const rowsPerBag = Math.ceil(perBag / F.DOT_COLS);
  const bagW = 2 * F.BAG_PAD + (F.DOT_COLS - 1) * F.DOT_DX + 2 * F.DOT_R;
  const bagH = 2 * F.BAG_PAD + (rowsPerBag - 1) * F.DOT_DY + 2 * F.DOT_R;
  const boxW = 2 * F.BOX_PAD + b * bagW + (b - 1) * F.BAG_GAP;
  const boxH = 2 * F.BOX_PAD + bagH;
  const totalW = a * boxW + (a - 1) * F.BOX_GAP;
  const ox = (F.W - totalW) / 2, oy = (F.H - boxH) / 2;
  for (let i = 0; i < a; i++){
    const boxX = ox + i * (boxW + F.BOX_GAP);
    rects.push({ kind:'box', x:boxX, y:oy, w:boxW, h:boxH });
    for (let j = 0; j < b; j++){
      const bagX = boxX + F.BOX_PAD + j * (bagW + F.BAG_GAP), bagY = oy + F.BOX_PAD;
      if (step >= 2) rects.push({ kind:'bag', x:bagX, y:bagY, w:bagW, h:bagH });
      for (let k = 0; k < perBag; k++){
        dots.push({ x:bagX + F.BAG_PAD + F.DOT_R + (k % F.DOT_COLS) * F.DOT_DX,
                    y:bagY + F.BAG_PAD + F.DOT_R + Math.floor(k / F.DOT_COLS) * F.DOT_DY });
      }
    }
  }
  return { rects, dots };
}

/* ---------- 3b) 選項印出來的每一個除法都要除得剛剛好 ----------
   ⚠️ 這一課明講「沒有餘數、不用小數」。誘答的算式孩子**可能真的會去算**，
   所以連誘答印出來的每一個除法都必須除得開 —— 不是只有正解。
   （2026-09-07 codex 第一輪：三支產生器的誘答幾乎每一批都端出算不完的除法。）
   做法：把算式從左往右走一次，每碰到一個 ÷ 就用 divRef 檢查餘數是 0。 */
function inexactDivisions(src){
  /* 先把文字裡的**算式鏈**抽出來（散文裡的字不是運算元），再逐條走。
     只有含 ÷ 的鏈才需要檢查 —— 沒有除法就沒有「除不開」的問題。
     ⚠️ normPrinted 會把半形的 `/` 換成空白（那是日期或並列，不是除法），
     所以這裡要**先**擋掉「數字 / 數字」：這一課的除法一律寫成 ÷，
     出現 `8 / 3` 的話它不是被略過，是**被判失敗**。（2026-09-07 codex 第三輪） */
  const decoded = decodeEntities(String(src)).replace(/<[^>]+>/g, '');
  /* ⚠️ 全形數字也要算：`８ / ３` 用 `\d` 抓不到，而 normPrinted 之後 `/` 就被抹掉了
     （2026-09-07 codex 第四輪）。 */
  if (/[0-9０-９]\s*\/\s*[0-9０-９]/.test(decoded))
    return ['"' + src + '" writes a division with "/"; this lesson always writes ÷, and a bare slash would be read as a date'];
  const norm = normPrinted(src);
  const CH = /[0-9+\-*/=() ]{3,}/g;
  const out = [];
  for (let m; (m = CH.exec(norm)) !== null; ){
    /* ⚠️ 先看**修剪之前**有沒有懸空的等號：`8 ÷ 2 ＝` 和 `＝ 8 ÷ 2` 都是壞掉的宣稱，
       而 trimChainRef 會把那個等號修掉，修完就看不出來了（codex 第四輪）。 */
    const rawChain = m[0].trim();
    if (rawChain.indexOf('/') >= 0 && (/^=/.test(rawChain) || /=$/.test(rawChain)))
      return ['an equals sign with nothing on one side in "' + src + '"'];
    const chain = trimChainRef(m[0]);
    if (!chain || chain.indexOf('/') < 0) continue;
    out.push.apply(out, chainInexact(chain, src));
    if (m.index === CH.lastIndex) CH.lastIndex++;
  }
  return out;
}
/* 修掉鏈兩端的懸空括號與符號 —— 散文的「（例如 24 ÷ 8）」會讓鏈括號不成對，
   那不是缺陷。⚠️ 修不成對的一律回空字串（那條鏈就不檢查），可是**鏈裡面**
   讀不懂的東西一定要回報，不可以靜靜跳過。 */
function trimChainRef(raw){
  let t = String(raw);
  const cnt = (x, ch) => x.split(ch).length - 1;
  for (let guard = 0; guard < 40; guard++){
    const before = t;
    t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
    if (cnt(t, '(') > cnt(t, ')') && t[0] === '(') t = t.slice(1);
    else if (cnt(t, ')') > cnt(t, '(') && t[t.length - 1] === ')') t = t.slice(0, -1);
    if (t === before) break;
  }
  t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
  let dep = 0;
  for (const ch of t){
    if (ch === '(') dep++;
    else if (ch === ')') dep--;
    if (dep < 0) return '';
  }
  return dep === 0 ? t : '';
}
/* 一條鏈：括號裡先算（換成它的值），然後**照運算優先序**走 ——
   先把鏈按 ＋／－ 切成幾段（term），每一段裡的 × 與 ÷ 才從左往右算。
   ⚠️ 不可以整條從左往右：`2 ＋ 4 ÷ 3` 那樣會去驗 6 ÷ 3（除得開）而放過真正印出來的
   4 ÷ 3（除不開）—— 這一課教的就是運算優先序，檢查自己弄錯就等於沒檢查。
   （2026-09-07 codex 第二輪抓到。） */
function chainInexact(chain, src){
  let flat = chain;
  for (let guard = 0; guard < 8; guard++){
    const m = /\(([^()]*)\)/.exec(flat);
    if (!m) break;
    const inner = evalPrintedRef(m[1]);
    if (!inner) return ['cannot read the bracketed part of "' + src + '"'];
    if (!fIsInt(inner)) return ['the bracketed part of "' + src + '" is not a whole number (' + fVal(inner) + ')'];
    flat = flat.slice(0, m.index) + String(inner.n) + flat.slice(m.index + m[0].length);
  }
  if (flat.indexOf('(') >= 0 || flat.indexOf(')') >= 0) return ['unbalanced brackets in "' + src + '"'];
  const toks = flat.replace(/([+\-*/=])/g, ' $1 ').split(/\s+/).filter(x => x.length);
  /* 先按 ＝ 切成幾條宣稱，每一條再按 ＋／－ 切成 term。 */
  const out = [];
  let claim = [];
  const claims = [];
  toks.forEach(tk => {
    if (tk === '='){ claims.push(claim); claim = []; }
    else claim.push(tk);
  });
  claims.push(claim);
  if (claims.some(c => !c.length)) return ['an equals sign with nothing on one side in "' + src + '"'];
  for (const c of claims){
    let term = [];
    const terms = [];
    for (const tk of c){
      if (tk === '+' || tk === '-'){ terms.push(term); term = []; }
      else term.push(tk);
    }
    terms.push(term);
    for (const t of terms){
      /* ⚠️ 空的 term 是壞掉的算式（`8 ÷ 2 ＋ ＋ 3`），不是「沒事」——
         靜靜跳過就是替它背書。（2026-09-07 codex 第三輪） */
      if (!t.length) return ['an operator with nothing between it and the next one in "' + src + '"'];
      let acc = null;
      for (let i = 0; i < t.length; i++){
        const tk = t[i];
        if (/^\d+$/.test(tk)){
          if (acc === null) acc = Number(tk);
          else return ['two numbers in a row in "' + src + '"'];
          continue;
        }
        if (tk !== '*' && tk !== '/') return ['unreadable token "' + tk + '" in "' + src + '"'];
        const nxt = t[i + 1];
        if (!/^\d+$/.test(nxt || '')){
          /* 鏈尾的懸空運算子是題目式（`25 ＋ ?`），交給 lib/arith.js。 */
          if (i === t.length - 1) break;
          return ['operator with no number after it in "' + src + '"'];
        }
        if (acc === null) return ['operator with no number before it in "' + src + '"'];
        const v = Number(nxt);
        if (tk === '/'){
          const q = divRef(acc, v);
          if (!q) out.push('"' + src + '" divides ' + acc + ' by ' + v + ', which divRef refuses');
          else if (q.r !== 0) out.push('"' + src + '" prints ' + acc + ' ÷ ' + v + ', which leaves remainder ' + q.r);
          acc = q ? q.q : null;
        } else {
          acc = mulRef(acc, v);
        }
        i++;
      }
    }
  }
  return out;
}

/* ---------- 4) 因數對列舉：拆除數 ---------- */
function factorPairsRef(D){
  const out = [];
  for (let p = 2; p <= D; p++){
    for (let r = 2; r <= D; r++){
      if (mulRef(p, r) === D) out.push([p, r]);
    }
  }
  return out;
}

/* ---------- 解釋與題幹裡的算式逐條驗算 ----------
   量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，那一課的算式會**靜靜地**
   多出一個假的運算元。 */
const arithProblems = makeArith({
  units:['顆', '片', '支', '個', '箱', '盒', '袋', '包', '堆', '份', '班', '瓶', '元', '題', '分', '關'],
  unitsEn:['sweets?', 'biscuits?', 'marbles?', 'eggs?', 'pens?', 'apples?', 'items?',
           'boxes?', 'bags?', 'crates?', 'trays?', 'cartons?', 'sacks?', 'packets?',
           'classes?', 'bottles?', 'dollars?', 'points?', 'shares?', 'piles?', 'rolls?']
});

/* ---------- 渲染出來的字串掃描 ----------
   中文和數字之間要有空格；英文的 1 只有它會出錯；不可以有 undefined／NaN。 */
const EN_S_WORD_OK = ['is', 'has', 'was', 'its', 'less', 'plus', 'thus', 'this', 'does', 'yes',
                      'goes', 'as', 'us', 'gives', 'means', 'holds', 'divides', 'multiplies',
                      'works', 'comes', 'says', 'needs', 'stays', 'sits'];
const EN_S_ADVERB_RE = /(wards|ways)$/;
const EN_S_SINGULAR_OK = ['class', 'bus', 'glass', 'cross', 'pass', 'gas', 'lens', 'series'];
const EN_IRREGULAR_PLURAL_RE = /\b1 (people|children|men|women|feet|teeth|mice|geese)\b/;
const EN_ONE_RE = /\b1 ([a-z]+s)\b/;
/* ⚠️ 「1 takes the singular」只看數量是 1 的時候。字尾規則寫錯的話（boxs、classs）
   數量是 2 以上一樣是錯的，而那一條抓不到 —— 所以另外掃一次「該加 es 卻只加了 s」。
   ⚠️ 這一條在這一課**沒有獨立的改壞測試**，而且要說清楚為什麼：這一課裡「數字 ＋ 複數名詞」
   只有 plEn() 生得出來，而 plEn() 同時也拼題幹，所以任何字尾錯誤都會**先**被
   STEM_EXACT（設定檔自己的 plRef 副本）抓到。真正釘住複數的是那一條，它有自己的改壞測試；
   這一條是第二道網，留給以後手寫英文句子的人。 */
const EN_BAD_PLURAL_RE = /\b\d+ [a-z]*(?:x|s|z|ch|sh)s\b/;
const EN_ARE_ONE_RE = /\b1 [a-z]+ are\b/;
/* ⚠️ 藏起來的字不算「畫面上看得到的字」，可是把標籤拿掉之後它看起來就像看得到 ——
   一段 `<span hidden>480 ÷ 6 ＝ 80</span>` 可以讓算式的覆蓋率與指紋維持不變，
   而孩子什麼都看不到。這一課的每一段文字都不該有隱藏的東西，所以直接擋掉。
   （2026-09-07 codex 第一輪抓到。） */
const HIDDEN_RE = /\shidden(?=[\s=>])|aria-hidden\s*=\s*["']?true|display\s*:\s*none|visibility\s*:\s*hidden/i;
function textProblems(s, lang, tag){
  const out = [];
  /* ⚠️ CSS 註解要先拿掉：值中間插一段 CSS 註解（display 冒號 註解 none）瀏覽器
     會當成 display:none，而 HIDDEN_RE 看不到。（2026-09-07 codex 第三輪） */
  if (HIDDEN_RE.test(decodeEntities(String(s)).replace(/\/\*[\s\S]*?\*\//g, ''))) out.push(tag + ': the string hides part of itself, so the checker would count text the child never sees');
  const plain = decodeEntities(String(s).replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
                         .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section)\b[^>]*>/gi, ' ')
                         .replace(/<[^>]+>/g, ''));
  if (/undefined|NaN|\[object/.test(plain)) out.push(tag + ': leaks an internal value');
  if (lang === 'zh'){
    const glued = plain.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(tag + ': missing space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
  } else {
    if (/[一-鿿]/.test(plain)) out.push(tag + ': English text contains Chinese');
    let m;
    if ((m = EN_IRREGULAR_PLURAL_RE.exec(plain))) out.push(tag + ': "' + m[0] + '" — 1 takes the singular');
    if ((m = EN_ARE_ONE_RE.exec(plain))) out.push(tag + ': "' + m[0] + '" — 1 takes "is"');
    if ((m = EN_BAD_PLURAL_RE.exec(plain))) out.push(tag + ': "' + m[0] + '" — that plural needs es, not s');
    EN_ONE_RE.lastIndex = 0;
    const re = new RegExp(EN_ONE_RE.source, 'g');
    while ((m = re.exec(plain)) !== null){
      const w = m[1];
      if (EN_S_WORD_OK.indexOf(w) >= 0) continue;
      if (EN_S_ADVERB_RE.test(w)) continue;
      if (EN_S_SINGULAR_OK.indexOf(w) >= 0) continue;
      out.push(tag + ': "' + m[0] + '" — 1 takes the singular');
    }
  }
  const dbl = plain.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
  if (dbl) out.push(tag + ': doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* ---------- 產生器清單 ----------
   沒有這一張表的話，**刪掉一整支產生器**只會讓它那一組斷言靜靜消失
   （simgen 只跑還在的那幾支）。 */
const GEN_IDS = ['totalParts', 'chainValue', 'sameExpr', 'bracketFirst', 'leftToRight',
                 'splitDivisor', 'mixedMulDiv', 'wordChain', 'wordOnce', 'pickExpr',
                 'interDigits', 'interOrder'];

/* ---------- 情境表：設定檔自己的一份 ----------
   ⚠️ 這是 review.html 裡 SCENES 的**獨立副本**。改了頁面上的名字，
   STEM_EXACT 就會對不上 —— 那是刻意的。 */
const SCENES_REF = {
  egg:   { zh:{ unit:'顆', name:'蛋',   big:'箱', small:'盒' },   en:{ name:'egg',    big:'crate',  small:'tray'   } },
  pen:   { zh:{ unit:'支', name:'筆',   big:'箱', small:'盒' },   en:{ name:'pen',    big:'carton', small:'box'    } },
  candy: { zh:{ unit:'顆', name:'糖',   big:'袋', small:'包' },   en:{ name:'sweet',  big:'sack',   small:'packet' } },
  apple: { zh:{ unit:'顆', name:'蘋果', big:'箱', small:'袋' },   en:{ name:'apple',  big:'crate',  small:'bag'    } }
};
function plRef(n, w){
  if (n === 1) return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const eqRef = lang => (lang === 'zh' ? ' ＝ ' : ' = ');
const plusRef = lang => (lang === 'zh' ? ' ＋ ' : ' + ');

/* ---------- 題幹的第二套實作（STEM_EXACT） ----------
   子字串釘樁擋不死題幹：在後面接一句問別的、或在前面加一句「不是在問…」都過得去。
   唯一釘得死的是**把整句題幹重建一次**，多一個字少一個字都對不上。 */
function stemRef(d, genId, lang){
  /* ⚠️ 讀不懂的情境要**響亮地失敗**，不可以安靜地爆炸：直接 sc.zh 會丟 TypeError，
     整份報告變成 stack trace，而 INVARIANTS 早就記下的「unknown scene」反而看不到。 */
  if (d && typeof d.scene === 'string' && !SCENES_REF[d.scene]) return null;
  const sc = SCENES_REF[d.scene];
  switch (genId){
    case 'totalParts':
      return lang === 'zh'
        ? '一批貨裝成 <strong>' + d.a + ' 個大箱</strong>，每個大箱再分成 <strong>' + d.b + ' 個小袋</strong>。一共有幾個小袋？'
        : 'A load goes into <strong>' + plRef(d.a, 'big box') + '</strong>, and each big box is split into <strong>' + plRef(d.b, 'small bag') + '</strong>. How many small bags are there altogether?';
    case 'chainValue':
      return '<strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong>' + eqRef(lang) + '?';
    case 'sameExpr':
      return lang === 'zh'
        ? '哪一個算式和 <strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong> 一樣？'
        : 'Which expression is the same as <strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong>?';
    case 'bracketFirst':
      return lang === 'zh'
        ? '<strong>' + d.t + ' ÷ (' + d.a + ' × ' + d.b + ')</strong> 這個算式，要<strong>先算</strong>哪一步？'
        : 'In <strong>' + d.t + ' ÷ (' + d.a + ' × ' + d.b + ')</strong>, which step comes <strong>first</strong>?';
    case 'leftToRight':
      return '<strong>' + d.t + ' ÷ ' + d.a + ' × ' + d.b + '</strong>' + eqRef(lang) + '?';
    case 'splitDivisor':
      return lang === 'zh'
        ? '<strong>' + d.t + ' ÷ ' + d.D + '</strong> 想拆成連續除兩次。哪一個是對的？'
        : '<strong>' + d.t + ' ÷ ' + d.D + '</strong> is to be split into two divisions in a row. Which one is right?';
    case 'mixedMulDiv':
      return '<strong>' + d.n + ' × ' + d.m + ' ÷ ' + d.k + '</strong>' + eqRef(lang) + '?';
    case 'wordChain':
      return lang === 'zh'
        ? '有 <strong>' + d.t + ' ' + sc.zh.unit + sc.zh.name + '</strong>，先<strong>平均</strong>裝成 <strong>' + d.a + ' ' + sc.zh.big + '</strong>，每' + sc.zh.big + '再<strong>平均</strong>分成 <strong>' + d.b + ' ' + sc.zh.small + '</strong>。一' + sc.zh.small + '有幾' + sc.zh.unit + '？'
        : 'There are <strong>' + plRef(d.t, sc.en.name) + '</strong>. They are shared <strong>equally</strong> into <strong>' + plRef(d.a, sc.en.big) + '</strong> first, and each ' + sc.en.big + ' is then split <strong>equally</strong> into <strong>' + plRef(d.b, sc.en.small) + '</strong>. How many are in one ' + sc.en.small + '?';
    case 'wordOnce':
      return lang === 'zh'
        ? '有 <strong>' + d.t + ' ' + sc.zh.unit + sc.zh.name + '</strong>，每' + sc.zh.small + '裝 <strong>' + d.p + ' ' + sc.zh.unit + '</strong>，每' + sc.zh.big + '裝 <strong>' + d.b + ' ' + sc.zh.small + '</strong>。可以裝滿幾' + sc.zh.big + '？'
        : 'There are <strong>' + plRef(d.t, sc.en.name) + '</strong>. ' + d.p + ' go in each ' + sc.en.small + ', and ' + plRef(d.b, sc.en.small) + ' go in each ' + sc.en.big + '. How many ' + sc.en.big + 's can be filled?';
    case 'pickExpr':
      return lang === 'zh'
        ? '一' + sc.zh.big + '裝 <strong>' + d.n + ' ' + sc.zh.unit + sc.zh.name + '</strong>，買了 <strong>' + d.m + ' ' + sc.zh.big + '</strong>，要平分給 <strong>' + d.k + ' 個班</strong>。哪一個併式算得出「一個班分到幾' + sc.zh.unit + '」？'
        : 'One ' + sc.en.big + ' holds <strong>' + plRef(d.n, sc.en.name) + '</strong>, <strong>' + plRef(d.m, sc.en.big) + '</strong> are bought, and they are shared equally between <strong>' + plRef(d.k, 'class') + '</strong>. Which single expression works out how many one class gets?';
    case 'interDigits':
      return lang === 'zh'
        ? '<strong>' + d.t + ' ÷ ' + d.D + '</strong> 的商是<strong>幾位數</strong>？（「乘除升級站」的題型）'
        : 'How many <strong>digits</strong> does the quotient of <strong>' + d.t + ' ÷ ' + d.D + '</strong> have? (from the multiplication and division lesson)';
    case 'interOrder':
      return '<strong>' + d.z + plusRef(lang) + d.x + ' × ' + d.y + '</strong>' + eqRef(lang) + '?';
    default:
      return null;
  }
}

/* ---------- 取樣空間的逐字釘樁（REVIEW_PINS） ----------
   ⚠️ 產生器自己的拒絕取樣會把改壞測試**吸收掉**：把某一支的定義域改壞，
   產生器只會多抽幾次然後若無其事地繼續，所有數值斷言照樣全綠 ——
   定義域整片消失而沒有人響。所以把取樣空間的那幾行逐字釘住。
   ⚠️ 這是**字面掃描**，不是資料流分析：它證明的只有「這幾行還在原處」，
   證明不了「沒有別的地方又改了一次」。 */
/* ⚠️ 版面的斷言全部驗的是 `packPlan()` **回傳的資料**，看不到 `drawPack()`
   有沒有照著畫：把 `cx:p.x` 改成 `cx:p.x + 20`，每一條居中與間距的斷言都還是綠的
   （2026-09-07 codex 第二輪）。這裡沒有 DOM 可以量，所以把「plan → SVG 屬性」
   那幾行**逐字釘住**，並說清楚它是字面掃描：它證明得了「接線沒被改」，
   證明不了「畫出來是對的」。真正看畫面的是瀏覽器 sweep 與收工前的接觸表截圖。 */
const INDEX_PINS = [
  { text:"x:r.x, y:r.y, width:r.w, height:r.h, rx:8,", why:'the rects are drawn where the plan puts them' },
  { text:"svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:DOT_R, fill:DOT_FILL }));", why:'the dots are drawn where the plan puts them' },
  { text:"drawPack(s1fig, packPlan(cs, s1step));", why:'example 1 draws the step the chips select' },
  { text:"drawPack(s2fig, packPlan(cs, 2));", why:'example 2 always draws the fully packed figure' }
];

const REVIEW_PINS = [
  { text:"var VAL_MAX = 10000, TOTAL_MAX = 999;", why:'the whole lesson range' },
  { text:"function exact(x, y){ return y !== 0 && x % y === 0; }", why:'every step of this lesson must divide exactly' },
  { text:"if (a + b === a * b) return null;", min:4, why:'the "add instead of multiply" distractor would otherwise equal the answer' },
  { text:"if (a === b) return null;", why:'bracketFirst would print the same option twice' },
  { text:"if (c === a || c === b) return null;", why:'bracketFirst options would share a value' },
  { text:"if (m === k) return null;", why:'pickExpr distractor n ÷ m × k would equal the answer' },
  { text:"if (D < 10 || D > 81) return null;", why:'splitDivisor needs a two-digit divisor worth splitting' },
  { text:"if (total > TOTAL_MAX || !exact(total, k)) return null;", min:2, why:'mixedMulDiv and pickExpr must divide exactly' },
  /* ⚠️ 這四行是「正解長什麼樣」。把它們改壞的話，去重之後只剩三個選項，
     make() 會回 null、retry 幾次之後落到保底 —— 保底是對的，所以所有數值斷言
     照樣全綠。改壞測試被吸收掉了，只有逐字釘樁擋得住。 */
  { text:"var right = t + ' ÷ (' + a + ' × ' + b + ')';", why:'sameExpr answers with the bracketed product' },
  { text:"var right = a + ' × ' + b;", why:'bracketFirst answers with the step inside the brackets' },
  { text:"var right = t + ' ÷ ' + p + ' ÷ ' + r;", why:'splitDivisor answers with the factor pair' },
  { text:"var right = n + ' × ' + m + ' ÷ ' + k;", why:'pickExpr answers by multiplying up to the total first' },
  { text:"var digits = String(Q).length;", why:'the digit count must be read off the quotient, not the divisor' },
  { text:"if (p === r || k === p || k === r) return null;", why:'splitDivisor needs three different numbers or two options collide' }
];

/* ---------- 跨頁用詞釘樁 ----------
   同一條規則在四頁必須用同一句話講。⚠️ min 一律寫成**當下真實的出現次數**
   （2026-09-07 用 node 逐頁數過），不是「至少 2」—— 實際有 4 份而只要求 2 份的話，
   拿掉其中兩份還是綠的。中文字串在有字典的頁面上一定有兩份
   （markup 的 fallback ＋ 字典），所以比的是**出現次數**。 */
/* ⚠️ 比的是**剛好幾次**（`!==`），不是「至少幾次」：只有下界的話，
   從畫面上拿掉一份、在別的地方（另一個字典值、樣式區塊、字串常數）多加一份，
   次數不變就過關了。改了措辭就要重新數 —— 那正是這一條要逼出來的動作。
   （2026-09-07 codex 第一輪指出下界和註解對不上。） */
const SIBLING_RULES = [
  { file:'index',     text:'連續除以兩個數，就是除以那兩個數的積', min:4, why:'is the one rule this whole lesson turns on' },
  { file:'reference', text:'連續除以兩個數，就是除以那兩個數的積', min:2, why:'must match the lesson page word for word' },
  { file:'parents',   text:'連續除以兩個數，就是除以那兩個數的積', min:2, why:'the adult has to hear the same sentence' },
  { file:'index',     text:'從左往右', min:10, why:'is the rule for two operations on the same level' },
  { file:'reference', text:'從左往右', min:12, why:'must match the lesson page' },
  { file:'review',    text:'從左往右', min:3,  why:'the generators must explain it the same way' },
  { file:'parents',   text:'從左往右', min:10, why:'is what the adult is meant to say out loud' },
  { file:'index',     text:'除得剛剛好', min:2, why:'is the precondition the whole rule depends on' },
  { file:'reference', text:'除得剛剛好', min:4, why:'must state the same precondition' },
  { file:'parents',   text:'除得剛剛好', min:2, why:'must state the same precondition' },
  { file:'index',     text:'第二次除的是', min:3, why:'is the second-division misconception' },
  { file:'reference', text:'第二次除的是', min:4, why:'must match the lesson page' },
  { file:'parents',   text:'第二次除的是', min:4, why:'must match the lesson page' },
  { file:'reference', text:'乘起來要剛好是原來的除數', min:3, why:'is the condition on splitting a divisor' },
  { file:'index',     text:'乘起來要剛好是原來的除數', min:2, why:'must match the cheat sheet' },
  /* 英文那一邊也要釘 —— 只釘中文的話英文會自己漂走。 */
  { file:'index',     text:'dividing by two numbers in a row is dividing by their product', min:1, why:'the English rule must not drift' },
  { file:'parents',   text:'dividing by two numbers in a row is dividing by their product', min:1, why:'the English rule must not drift' },
  { file:'index',     text:'left to right', min:6, why:'the English rule must not drift' },
  { file:'reference', text:'left to right', min:7, why:'the English rule must not drift' },
  { file:'review',    text:'left to right', min:2, why:'the English rule must not drift' },
  { file:'parents',   text:'left to right', min:5, why:'the English rule must not drift' }
];

/* ⚠️ 「必須出現」擋不住「又多加了一句錯的」，所以規則類的釘樁要**成對**。
   ⚠️ 但要說清楚這一張表證明得了什麼：它是**這幾句已知的錯話**的迴歸釘樁
   （逐字 indexOf），**不是**「不可能出現任何等價的錯話」的證明 ——
   換一種說法（「除以那兩個數相加的結果」）、或在字中間插一個標籤就繞過去了。
   真正在守規則的是 SIBLING_RULES 的逐字計數與 codex 審查。（codex 第一輪） */
const FORBIDDEN = [
  { text:'除以那兩個數的和', why:'the divisor is the product, never the sum' },
  { text:'除以它們的和', why:'the divisor is the product, never the sum' },
  { text:'括號可以省略', why:'the brackets are never optional after a division sign' },
  { text:'divide by their sum', why:'the divisor is the product, never the sum' },
  { text:'brackets can be left out', why:'the brackets are never optional after a division sign' },
  { text:'multiply before divide is the rule', why:'there is no such rule; × and ÷ share a level' }
];

/* ---------- 題庫神諭 ----------
   `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，這一課
   12 題一題都不符合 —— 沒有這一張表，把 ans 改掉完全不會響。
   `stemExact` 逐字釘死題幹；`answer` 是**畫面上那個選項的字串**。 */
/* ⚠️ **中英文的題幹都要逐字釘住。** 第一版只釘中文，於是把英文的
   "Which expression is the same as…" 改成 "…is different from…"、選項與 ans 不動，
   所有檢查照樣全綠 —— 英文那一邊等於沒有人在守（2026-09-07 codex 第一輪）。 */
const BANK_EXPECTED = {
  qs: [
    { stemExact:'一批貨分成 <strong>6 個大箱</strong>，每個大箱再分成 <strong>4 個小袋</strong>。一共有幾個小袋？',
      enStemExact:'A load goes into <strong>6 big boxes</strong>, and each big box is then split into <strong>4 small bags</strong>. How many small bags are there altogether?',
      answer:'24' },
    { stemExact:'<strong>480 ÷ 6 ÷ 4</strong> ＝ ?',
      enStemExact:'<strong>480 ÷ 6 ÷ 4</strong> = ?', answer:'20' },
    { stemExact:'哪一個算式和 <strong>480 ÷ 6 ÷ 4</strong> 一樣？',
      enStemExact:'Which expression is the same as <strong>480 ÷ 6 ÷ 4</strong>?',
      answer:'480 ÷ (6 × 4)' },
    { stemExact:'<strong>720 ÷ (8 × 3)</strong> 這個算式，要<strong>先算</strong>哪一步？',
      enStemExact:'In <strong>720 ÷ (8 × 3)</strong>, which step comes <strong>first</strong>?',
      answer:'8 × 3' },
    { stemExact:'<strong>600 ÷ 5 × 2</strong> ＝ ?',
      enStemExact:'<strong>600 ÷ 5 × 2</strong> = ?', answer:'240' },
    { stemExact:'<strong>960 ÷ 32</strong> 想拆成連續除兩次。哪一個是對的？',
      enStemExact:'<strong>960 ÷ 32</strong> is to be split into two divisions in a row. Which one is right?',
      answer:'960 ÷ 4 ÷ 8' }
  ],
  qsAdv: [
    { stemExact:'864 顆蛋要裝箱：先<strong>平均</strong>裝成 <strong>12 箱</strong>，每箱再<strong>平均</strong>分成 <strong>6 盒</strong>。一盒幾顆蛋？',
      enStemExact:'864 eggs are packed: shared <strong>equally</strong> into <strong>12 crates</strong> first, then each crate split <strong>equally</strong> into <strong>6 trays</strong>. How many eggs are in one tray?',
      answer:'12' },
    { stemExact:'720 個麵包，<strong>每盒裝 6 個</strong>，<strong>每箱裝 5 盒</strong>。可以裝滿幾箱？',
      enStemExact:'720 bread rolls. <strong>6 go in a box</strong> and <strong>5 boxes go in a crate</strong>. How many crates can be filled?',
      answer:'24' },
    { stemExact:'一箱有 <strong>24 瓶</strong>果汁，買了 <strong>4 箱</strong>，要平分給 <strong>6 個班</strong>。一個班分到幾瓶？',
      enStemExact:'A crate holds <strong>24 bottles</strong> of juice. <strong>4 crates</strong> are bought and shared equally between <strong>6 classes</strong>. How many bottles does one class get?',
      answer:'16' },
    { stemExact:'一箱 <strong>24 瓶</strong>，買 <strong>4 箱</strong>，平分給 <strong>6 個班</strong>。下面哪一個併式算得出「一個班幾瓶」？',
      enStemExact:'A crate holds <strong>24 bottles</strong>, <strong>4 crates</strong> are bought, and they are shared equally between <strong>6 classes</strong>. Which single expression works out the bottles per class?',
      answer:'24 × 4 ÷ 6' }
  ],
  qsBoost: [
    { stemExact:'小明說：「<strong>480 ÷ 6 ÷ 4</strong> 就是 <strong>480 ÷ 10</strong>。」他哪裡想錯了？',
      enStemExact:'Ming says: "<strong>480 ÷ 6 ÷ 4</strong> is just <strong>480 ÷ 10</strong>." What has he got wrong?',
      answer:'連續除以 6 再除以 4，是除以 6 × 4 ＝ 24，不是除以 10',
      enAnswer:'Dividing by 6 and then by 4 is dividing by 6 × 4 = 24, not by 10' },
    { stemExact:'<strong>720 ÷ 6 × 4</strong> ＝ ?',
      enStemExact:'<strong>720 ÷ 6 × 4</strong> = ?', answer:'480' }
  ]
};
/* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
const BANK_ASK = {
  qs: [
    { must:['一共有幾個小袋'], never:['一個小袋幾'] },
    { must:['480 ÷ 6 ÷ 4'],    never:['哪一個算式'] },
    { must:['哪一個算式'],      never:['先算'] },
    { must:['先算'],           never:['哪一個算式和'] },
    { must:['600 ÷ 5 × 2'],    never:['拆成'] },
    { must:['拆成連續除兩次'],   never:['先算'] }
  ]
};
/* 英文那一邊的「問的是什麼」也要單獨釘一次。 */
const BANK_ASK_EN = {
  qs: [
    { must:['How many small bags'], never:['in one small bag'] },
    { must:['480 ÷ 6 ÷ 4'],         never:['Which expression'] },
    { must:['the same as'],         never:['different from'] },
    { must:['comes <strong>first</strong>'], never:['last'] },
    { must:['600 ÷ 5 × 2'],         never:['split'] },
    { must:['split into two divisions in a row'], never:['comes <strong>first</strong>'] }
  ],
  qsAdv: [
    { must:['in one tray'],            never:['in one crate'] },
    { must:['How many crates'],        never:['How many boxes'] },
    { must:['does one class get'],     never:['Which single expression'] },
    { must:['Which single expression'], never:['How many bottles does'] }
  ],
  qsBoost: [
    { must:['What has he got wrong'], never:['Which expression'] },
    { must:['720 ÷ 6 × 4'],           never:['(6 × 4)'] }
  ]
};
/* 這幾題的答案要從**題幹裡的數字**重算，不是拿設定檔自己的常數算 ——
   後者在題幹被改掉時不會響。算的時候一律走 divRef／mulRef（重複減／重複加）。
   ⚠️ 第一版是「檢查這幾個數字有出現，然後拿設定檔自己的常數去算」—— 那**不是重算**：
   把題幹的 864 改成 865、再在別處寫一句「(864、12、6)」就繞過去了（codex 第一輪）。
   現在每一筆都帶一個**兩端都錨定**的正規式，從題幹裡把那幾個數**按順序**抓出來再算 ——
   codex 第二輪指出「錨定」這個詞原本只做到一半（只有幾筆有 `^`）。
   ⚠️ 結尾用 `(?![\s\S])` 而不是 `$`：JavaScript 的 `$` 也會match最後一個換行**之前**，
   所以題幹後面多一個 `\n` 照樣過關（codex 第三輪）。 */
const BANK_RECOMPUTE = [
  { bank:'qs', i:0, re:/^一批貨分成 <strong>(\d+) 個大箱<\/strong>，每個大箱再分成 <strong>(\d+) 個小袋<\/strong>。一共有幾個小袋？(?![\s\S])/,
    calc:l => String(mulRef(l[0], l[1])) },
  { bank:'qs', i:1, re:/^<strong>(\d+) ÷ (\d+) ÷ (\d+)<\/strong> ＝ \?(?![\s\S])/,
    calc:l => String(divRef(divRef(l[0], l[1]).q, l[2]).q) },
  { bank:'qs', i:4, re:/^<strong>(\d+) ÷ (\d+) × (\d+)<\/strong> ＝ \?(?![\s\S])/,
    calc:l => String(mulRef(divRef(l[0], l[1]).q, l[2])) },
  { bank:'qsAdv', i:0, re:/^(\d+) 顆蛋[\s\S]*<strong>(\d+) 箱<\/strong>[\s\S]*<strong>(\d+) 盒<\/strong>。一盒幾顆蛋？(?![\s\S])/,
    calc:l => String(divRef(divRef(l[0], l[1]).q, l[2]).q) },
  { bank:'qsAdv', i:1, re:/^(\d+) 個麵包[\s\S]*每盒裝 (\d+) 個[\s\S]*每箱裝 (\d+) 盒<\/strong>。可以裝滿幾箱？(?![\s\S])/,
    calc:l => String(divRef(l[0], mulRef(l[1], l[2])).q) },
  { bank:'qsAdv', i:2, re:/^一箱有 <strong>(\d+) 瓶<\/strong>果汁[\s\S]*<strong>(\d+) 箱<\/strong>[\s\S]*<strong>(\d+) 個班<\/strong>。一個班分到幾瓶？(?![\s\S])/,
    calc:l => String(divRef(mulRef(l[0], l[1]), l[2]).q) },
  { bank:'qsBoost', i:1, re:/^<strong>(\d+) ÷ (\d+) × (\d+)<\/strong> ＝ \?(?![\s\S])/,
    calc:l => String(mulRef(divRef(l[0], l[1]).q, l[2])) }
];

/* ---------- 每一支產生器的解釋裡「至少要驗過幾條算式」 ----------
   ⚠️ 只釘「有沒有錯」擋不住「整條靜靜讀不到」：一個壞掉的正規化會讓每條算式
   都讀不到，那樣也是零錯誤。所以連**驗過幾條**都要釘住。
   數字是 2026-09-07 用 30000 批實測出來的下界。 */
const ARITH_MIN = {
  totalParts:2, chainValue:4, sameExpr:2, bracketFirst:2, leftToRight:3,
  splitDivisor:5, mixedMulDiv:2, wordChain:4, wordOnce:4, pickExpr:2,
  interDigits:1, interOrder:3
};

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    { file:"index", via:"index", expect:"does not match the reference layout",
      find:"var DOT_R = 5, DOT_DX = 14, DOT_DY = 14, DOT_COLS = 2;",
      replace:"var DOT_R = 5, DOT_DX = 18, DOT_DY = 14, DOT_COLS = 2;",
      why:"the dots inside a bag would be spaced differently from the spec" },
    { file:"index", via:"index", expect:"falls outside the canvas",
      find:"var PILE_COLS = 8, PILE_DX = 20, PILE_DY = 20;",
      replace:"var PILE_COLS = 8, PILE_DX = 70, PILE_DY = 20;",
      why:"the unshared pile would run off the canvas" },
    { file:"index", via:"index", expect:"small bags drawn, expected",
      find:"        if (step >= 2) rects.push({ kind:'bag', x:bagX, y:bagY, w:bg.w, h:bg.h });",
      replace:"        if (step >= 1) rects.push({ kind:'bag', x:bagX, y:bagY, w:bg.w, h:bg.h });",
      why:"step 1 would already show the bags, so nothing is left for step 2 to teach" },
    { file:"index", via:"index", expect:"big boxes drawn, expected 0",
      find:"      return { w:FIG_W, h:FIG_H, step:0, rects:rects, dots:dots };",
      replace:"      rects.push({ kind:'box', x:10, y:10, w:40, h:40 });\n      return { w:FIG_W, h:FIG_H, step:0, rects:rects, dots:dots };",
      why:"the unshared pile would already be inside a box" },
    { file:"index", via:"index", expect:"dots but the load is",
      find:"        for (k = 0; k < c; k++) dots.push(dotAt(bagX, bagY, k));",
      replace:"        for (k = 1; k < c; k++) dots.push(dotAt(bagX, bagY, k));",
      why:"each bag would be drawn one item short" },
    { file:"index", via:"index", expect:"two big boxes overlap",
      find:"  var BAG_PAD = 6, BAG_GAP = 6, BOX_PAD = 7, BOX_GAP = 8;",
      replace:"  var BAG_PAD = 6, BAG_GAP = 6, BOX_PAD = 7, BOX_GAP = -30;",
      why:"neighbouring big boxes would be drawn on top of each other" },
    { file:"index", via:"index", expect:"is not inside exactly one big box",
      find:"        var bagX = boxX + BOX_PAD + j * (bg.w + BAG_GAP), bagY = oy + BOX_PAD;",
      replace:"        var bagX = boxX + BOX_PAD + j * (bg.w + BAG_GAP) + 40, bagY = oy + BOX_PAD;",
      why:"the small bags would be drawn outside the big box they belong to" },
    { file:"index", via:"index", expect:"dots, expected",
      find:"            y:bagY + BAG_PAD + DOT_R + Math.floor(k / DOT_COLS) * DOT_DY };",
      replace:"            y:bagY + BAG_PAD + DOT_R + Math.floor(k / DOT_COLS) * DOT_DY + 30 };",
      why:"dots drawn below their own bag would still be counted as inside it" },
    { file:"index", via:"index", expect:"the page draws in",
      find:"  var FIG_W = 460, FIG_H = 150;",
      replace:"  var FIG_W = 500, FIG_H = 150;",
      why:"the drawing area would no longer match the canvas the checker knows about" },
    { file:"index", via:"index", expect:"does not match the CSS box",
      find:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto}",
      replace:"  .packfig{width:100%;max-width:460px;height:250px;display:block;margin:0 auto}",
      why:"the browser would shrink the whole figure to fit a differently shaped box" },
    { file:"index", via:"index", expect:"this lesson draws in",
      find:"<svg class=\"packfig\" id=\"s1fig\" viewBox=\"0 0 460 150\" xmlns=\"http://www.w3.org/2000/svg\">",
      replace:"<svg class=\"packfig\" id=\"s1fig\" viewBox=\"0 0 460 130\" xmlns=\"http://www.w3.org/2000/svg\">",
      why:"one figure would be drawn in a different coordinate system from the other" },
    { file:"index", via:"index", expect:"leaves a remainder",
      find:"    { id:'candy',  t:24, a:3, b:2 },   /* c ＝ 4 */",
      replace:"    { id:'candy',  t:25, a:3, b:2 },   /* c ＝ 4 */",
      why:"the first load would not share out exactly, so the lesson rule would not hold for it" },
    { file:"index", via:"index", expect:"one small bag per box teaches nothing",
      find:"    { id:'cookie', t:36, a:3, b:3 },   /* c ＝ 4 */",
      replace:"    { id:'cookie', t:36, a:3, b:1 },   /* c ＝ 4 */",
      why:"a single bag per box makes the second division invisible" },
    { file:"index", via:"index", expect:"one big box teaches nothing",
      find:"    { id:'ball',   t:48, a:4, b:2 }    /* c ＝ 6 */",
      replace:"    { id:'ball',   t:48, a:1, b:2 }    /* c ＝ 6 */",
      why:"a single big box makes the first division invisible" },
    { file:"index", via:"index", expect:"a + b equals a × b",
      find:"  var S1_CASES = [",
      replace:"  var S1_CASES = [\n    { id:'bad', t:16, a:2, b:2 },",
      why:"a case where adding and multiplying agree cannot teach \"multiplied, not added\"" },
    { file:"index", via:"index", expect:"perBag() says",
      find:"  function perBag(cs){ return cs.t / (cs.a * cs.b); }        /* 一個小袋幾個 */",
      replace:"  function perBag(cs){ return cs.t / cs.a; }        /* 一個小袋幾個 */",
      why:"the per-bag amount would be the per-box amount" },
    { file:"index", via:"index", expect:"perBox() disagrees",
      find:"  function perBox(cs){ return cs.t / cs.a; }                 /* 一個大箱幾個 */",
      replace:"  function perBox(cs){ return cs.t / cs.b; }                 /* 一個大箱幾個 */",
      why:"the first division would use the number of bags instead of the number of boxes" },
    { file:"index", via:"index", expect:"bagTotal() says",
      find:"  function bagTotal(cs){ return cs.a * cs.b; }               /* 一共幾個小袋 */",
      replace:"  function bagTotal(cs){ return cs.a + cs.b; }               /* 一共幾個小袋 */",
      why:"this is the headline misconception: the number of bags added instead of multiplied" },
    { file:"index", via:"index", expect:"the page prints",
      find:"    if (key === 'chain') return t / a / b;",
      replace:"    if (key === 'chain') return t / a * b;",
      why:"the chained form would print a value its own expression does not have" },
    { file:"index", via:"index", expect:"reads as",
      find:"    if (key === 'once')  return t + ' ÷ (' + a + ' × ' + b + ')';",
      replace:"    if (key === 'once')  return t + ' ÷ ' + a + ' × ' + b;",
      why:"the bracketed form would lose its brackets while keeping its value" },
    { file:"index", via:"index", expect:"the no-bracket form should answer",
      find:"    return t / a * b;",
      replace:"    return t / (a * b);",
      why:"the no-bracket form would answer the bracketed question" },
    { file:"index", via:"index", expect:"highlights",
      find:"  var S3_ANSWERS = { bag:['chain', 'once'], box:['left'] };",
      replace:"  var S3_ANSWERS = { bag:['chain'], box:['left'] };",
      why:"the bracketed form answers the same question and must be highlighted with it" },
    { file:"index", via:"index", expect:"S3_ANSWERS.box highlights",
      find:"box:['left'] };",
      replace:"box:['chain'] };",
      why:"the wrong expression would be marked as answering the second question" },
    { file:"index", via:"index", expect:"EXPR_KEYS changed shape",
      find:"  var EXPR_KEYS = ['chain', 'once', 'left'];",
      replace:"  var EXPR_KEYS = ['chain', 'left', 'once'];",
      why:"the three forms are compared by name, so their order is part of the contract" },
    { file:"index", via:"index", expect:"S3_QKEYS changed shape",
      find:"  var S3_QKEYS = ['bag', 'box'];",
      replace:"  var S3_QKEYS = ['box', 'bag'];",
      why:"the two questions are keyed by name, so their order is part of the contract" },
    { file:"index", via:"index", expect:"needs the two questions to have different answers",
      find:"  var S3_T = 24, S3_A = 3, S3_B = 2;",
      replace:"  var S3_T = 24, S3_A = 3, S3_B = 1;",
      why:"with one bag per box both questions would have the same answer" },
    { file:"index", via:"index", expect:"disagrees with repeated addition",
      find:"      v = (cs.ops[i][0] === '*') ? v * cs.ops[i][1] : v / cs.ops[i][1];",
      replace:"      v = (cs.ops[i][0] === '*') ? v + cs.ops[i][1] : v / cs.ops[i][1];",
      why:"the multiply step would add instead" },
    { file:"index", via:"index", expect:"step(s) the printed expression",
      find:"  function partialExpr(cs, k){\n    var vals = stepValues(cs), s = String(vals[k]), i;\n    for (i = k; i < cs.ops.length; i++) s += opText(cs.ops[i][0]) + cs.ops[i][1];\n    return s;\n  }",
      replace:"  function partialExpr(cs, k){\n    var vals = stepValues(cs), s = String(vals[k]), i;\n    for (i = k + 1; i < cs.ops.length; i++) s += opText(cs.ops[i][0]) + cs.ops[i][1];\n    return s;\n  }",
      why:"folding one step would silently drop the next operation from the printed expression" },
    { file:"index", via:"index", expect:"fullExpr and partialExpr(0) disagree",
      find:"  function fullExpr(cs){ return partialExpr(cs, 0); }",
      replace:"  function fullExpr(cs){ return partialExpr(cs, 1); }",
      why:"the headline expression would not be the one the steps start from" },
    { file:"index", via:"index", expect:"exprAnswer disagrees with stepValues",
      find:"  function exprAnswer(cs){ var v = stepValues(cs); return v[v.length - 1]; }",
      replace:"  function exprAnswer(cs){ var v = stepValues(cs); return v[v.length - 2]; }",
      why:"the answer would be the value after only one step" },
    { file:"index", via:"index", expect:"only shows × and ÷",
      find:"    { id:'divmul', head:720, ops:[['/', 6], ['*', 4]] },",
      replace:"    { id:'divmul', head:720, ops:[['/', 6], ['+', 4]] },",
      why:"an addition would sneak into a lesson whose whole point is × and ÷ only" },
    { file:"index", via:"index", expect:"exactly two steps",
      find:"    { id:'muldiv', head:24,  ops:[['*', 5], ['/', 8]] }",
      replace:"    { id:'muldiv', head:24,  ops:[['*', 5], ['/', 8], ['*', 2]] }",
      why:"a three-step expression is beyond what this lesson walks through" },
    { file:"index", via:"index", expect:"the same pair of operations is shown twice",
      find:"    { id:'muldiv', head:24,  ops:[['*', 5], ['/', 8]] }\n  ];",
      replace:"    { id:'muldiv', head:24,  ops:[['/', 8], ['*', 5]] }\n  ];",
      why:"both examples would show ÷ then ×, so \"× then ÷\" would never be shown" },
    { file:"index", via:"index", expect:"is not a whole number in range",
      find:"    { id:'divmul', head:720, ops:[['/', 6], ['*', 4]] },\n",
      replace:"    { id:'divmul', head:700, ops:[['/', 6], ['*', 4]] },\n",
      why:"the first step would leave a remainder" },
    { file:"index", via:"index", expect:"does not multiply back to the divisor",
      find:"  var S5_SPLITS = [[4, 6], [3, 8], [2, 12]];",
      replace:"  var S5_SPLITS = [[4, 7], [3, 8], [2, 12]];",
      why:"a split whose numbers do not multiply back to the divisor gives a different answer" },
    { file:"index", via:"index", expect:"dividing by 1 is not a split",
      find:"  var S5_SPLITS = [[4, 6], [3, 8], [2, 12]];",
      replace:"  var S5_SPLITS = [[1, 24], [3, 8], [2, 12]];",
      why:"dividing by 1 does nothing, so it is not a split of the divisor" },
    { file:"index", via:"index", expect:": mid ",
      find:"    return { t:S5_T, d:S5_D, mid:S5_T / pair[0], end:S5_T / pair[0] / pair[1] };",
      replace:"    return { t:S5_T, d:S5_D, mid:S5_T / pair[1], end:S5_T / pair[0] / pair[1] };",
      why:"the first division would use the second factor" },
    { file:"index", via:"index", expect:"must carry the lesson's own total and divisor",
      find:"    return { t:S5_T, d:S5_D, mid:S5_T / pair[0], end:S5_T / pair[0] / pair[1] };\n  }",
      replace:"    return { t:S5_T, d:0, mid:S5_T / pair[0], end:S5_T / pair[0] / pair[1] };\n  }",
      why:"the narration would print a divisor the arithmetic never used" },
    { file:"index", via:"index", expect:"but the computed answer is at",
      find:"    { kind:'total', a:5, b:6,           opts:[11, 30, 36, 25],  ans:1 },",
      replace:"    { kind:'total', a:5, b:6,           opts:[11, 30, 36, 25],  ans:0 },",
      why:"the game would mark the \"added\" distractor correct" },
    { file:"index", via:"index", expect:"exactly one split must multiply back to",
      find:"pairs:[[4, 4], [4, 6], [8, 4], [12, 12]], ans:1 }",
      replace:"pairs:[[4, 4], [4, 6], [6, 4], [12, 12]], ans:1 }",
      why:"two options would be valid splits, so the round has no single answer" },
    { file:"index", via:"index", expect:"two options have the same value",
      find:"    { kind:'left',  t:600, a:5, b:2,    opts:[60, 120, 300, 240], ans:3 },",
      replace:"    { kind:'left',  t:600, a:5, b:2,    opts:[60, 120, 240, 240], ans:3 },",
      why:"the child would see three options, not four" },
    { file:"index", via:"index", expect:"exactly five rounds",
      find:"    { kind:'chain', t:180, a:5, b:6,    opts:[36, 216, 6, 30],  ans:2 },\n",
      replace:"",
      why:"a missing round would shorten the game without anyone noticing" },
    { file:"index", via:"index", expect:"roundValue gives",
      find:"    if (r.kind === 'left')  return r.t / r.a * r.b;",
      replace:"    if (r.kind === 'left')  return r.t / (r.a * r.b);",
      why:"the no-bracket round would be scored as if it had brackets" },
    { file:"index", via:"index", expect:"options, expected 4",
      find:"  function roundOptCount(r){ return (r.kind === 'split') ? r.pairs.length : r.opts.length; }",
      replace:"  function roundOptCount(r){ return (r.kind === 'split') ? r.pairs.length : r.opts.length - 1; }",
      why:"the last option would never be rendered" },
    { file:"index", via:"index", expect:"the option marked correct is not the computed answer",
      find:"    { kind:'once',  t:720, a:6, b:4,    opts:[480, 30, 72, 120], ans:1 },",
      replace:"    { kind:'once',  t:720, a:6, b:4,    opts:[480, 72, 30, 120], ans:1 },",
      why:"the bracketed round would mark the \"added divisor\" answer correct" },
    { file:"index", via:"index", expect:"the correct option sits in the same slot",
      find:"    { kind:'total', a:5, b:6,           opts:[11, 30, 36, 25],  ans:1 },\n    { kind:'chain', t:180, a:5, b:6,    opts:[36, 216, 6, 30],  ans:2 },\n    { kind:'once',  t:720, a:6, b:4,    opts:[480, 30, 72, 120], ans:1 },\n    { kind:'left',  t:600, a:5, b:2,    opts:[60, 120, 300, 240], ans:3 },\n    { kind:'split', t:864, d:24, pairs:[[4, 4], [4, 6], [8, 4], [12, 12]], ans:1 }",
      replace:"    { kind:'total', a:5, b:6,           opts:[30, 11, 36, 25],  ans:0 },\n    { kind:'chain', t:180, a:5, b:6,    opts:[6, 36, 216, 30],  ans:0 },\n    { kind:'once',  t:720, a:6, b:4,    opts:[30, 480, 72, 120], ans:0 },\n    { kind:'left',  t:600, a:5, b:2,    opts:[240, 60, 120, 300], ans:0 },\n    { kind:'split', t:864, d:24, pairs:[[4, 6], [4, 4], [20, 4], [12, 12]], ans:0 }",
      why:"the correct option must not sit in the same slot in every round" },
    { file:"index", via:"index", expect:"the round does not divide exactly both ways",
      find:"    { kind:'chain', t:180, a:5, b:6,    opts:[36, 216, 6, 30],  ans:2 },",
      replace:"    { kind:'chain', t:181, a:5, b:6,    opts:[36, 216, 6, 30],  ans:2 },",
      why:"the round would ask a question with no whole-number answer" },
    { file:"review", via:"review", expect:"but repeated addition gives",
      find:"          return { a:a, b:b, total:a * b, opts:opts, ans:opts.indexOf(a * b) };",
      replace:"          return { a:a, b:b, total:a + b, opts:opts, ans:opts.indexOf(a * b) };",
      why:"the total number of bags would be added instead of multiplied" },
    { file:"review", via:"review", expect:"totalParts: a + b equals a × b",
      find:"          if (a + b === a * b) return null;      /* 加起來剛好等於乘起來 → 誘答會等於正解 */",
      replace:"          if (false) return null;                /* 加起來剛好等於乘起來 → 誘答會等於正解 */",
      why:"a = b = 2 would let the \"added\" distractor be the answer" },
    { file:"review", via:"review", expect:"totalParts: a=",
      find:"          var a = pickUnused(rangeList(2, 9), used);\n          var b = pick(rangeList(2, 8));",
      replace:"          var a = pickUnused(rangeList(2, 12), used);\n          var b = pick(rangeList(2, 8));",
      why:"the number of big boxes would run past the range this lesson draws" },
    { file:"review", via:"review", expect:"but a × b × c gives",
      find:"          return { t:t, a:a, b:b, c:c, opts:opts, ans:opts.indexOf(c) };",
      replace:"          return { t:t + a, a:a, b:b, c:c, opts:opts, ans:opts.indexOf(c) };",
      why:"the total would not be the product of the three numbers the story uses" },
    { file:"review", via:"review", expect:"chainValue: a + b equals a × b",
      find:"          var c = pick(rangeList(2, 9));\n          var t = a * b * c;\n          if (t > TOTAL_MAX) return null;\n          if (a + b === a * b) return null;\n          var opts = numOpts(c, [b * c, c * b * b, a * c, c * a * a], [t, a, b]);",
      replace:"          var c = pick(rangeList(2, 9));\n          var t = a * b * c;\n          if (t > TOTAL_MAX) return null;\n          if (false) return null;\n          var opts = numOpts(c, [b * c, c * b * b, a * c, c * a * a], [t, a, b]);",
      why:"dividing by 2 and then by 2 is dividing by 4, which is also 2 + 2 — the distractor would be the answer" },
    { file:"review", via:"index", expect:"PIN \"var right = t + ' ÷ (' + a + ' × ' + b + ')';\"",
      find:"          var right = t + ' ÷ (' + a + ' × ' + b + ')';",
      replace:"          var right = t + ' ÷ ' + a + ' × ' + b;",
      why:"the answer would be the form without brackets" },
    { file:"review", via:"review", expect:"has the same value as the question",
      find:"            t + ' ÷ (' + a + ' ＋ ' + b + ')',",
      replace:"            t + ' ÷ (' + b + ' × ' + a + ')',",
      why:"a distractor that multiplies the same two numbers is the same expression written backwards" },
    { file:"review", via:"review", expect:"two options work out to the same number",
      find:"          if (c === a || c === b) return null;   /* t ÷ a 或 t ÷ b 會和 a × b 同值 */",
      replace:"          if (false) return null;                /* t ÷ a 或 t ÷ b 會和 a × b 同值 */",
      why:"c = a makes \"t ÷ a\" and \"a × b\" the same number, so two options are indistinguishable" },
    { file:"review", via:"index", expect:"PIN \"if (a === b) return null;\"",
      find:"          if (a === b) return null;              /* t ÷ a 和 t ÷ b 會變成同一個選項 */",
      replace:"          if (a === b) { } else if (false) return null;",
      why:"a = b would print \"t ÷ a\" twice" },
    { file:"review", via:"review", expect:"is not m × b",
      find:"          var q = m * b;                          /* q 一定被 b 整除，「先乘」那個誘答才是整數 */",
      replace:"          var q = m * b + 1;                      /* q 一定被 b 整除，「先乘」那個誘答才是整數 */",
      why:"the first-step value would not be divisible by b, so the bracketed distractor is not a whole number" },
    { file:"review", via:"review", expect:"val ",
      find:"          var right = q * b;\n          if (right > TOTAL_MAX) return null;",
      replace:"          var right = q * a;\n          if (right > TOTAL_MAX) return null;",
      why:"the left-to-right answer would multiply by the divisor instead of the multiplier" },
    { file:"review", via:"review", expect:"p × r is not the divisor D",
      find:"          var D = p * r;",
      replace:"          var D = p * r + 1;",
      why:"the divisor would not be the product of the two numbers the answer splits it into" },
    { file:"review", via:"review", expect:"is also a valid split of",
      find:"            t + ' ÷ ' + r + ' ÷ ' + k,",
      replace:"            t + ' ÷ ' + r + ' ÷ ' + p,",
      why:"the same split written the other way round is also correct, so there would be two answers" },
    { file:"review", via:"review", expect:"D=",
      find:"          if (D < 10 || D > 81) return null;",
      replace:"          if (D < 4 || D > 81) return null;",
      why:"a one-digit divisor is not worth splitting and is outside what this lesson claims" },
    { file:"review", via:"review", expect:"mixedMulDiv: val ",
      find:"          var val = total / k;",
      replace:"          var val = total / k + 1;",
      why:"the mixed expression would print an answer one too big" },
    { file:"review", via:"index", expect:"PIN \"if (total > TOTAL_MAX || !exact(total, k)) return null;\"",
      find:"          if (total > TOTAL_MAX || !exact(total, k)) return null;\n          var val = total / k;",
      replace:"          if (total > TOTAL_MAX) return null;\n          var val = total / k;",
      why:"the shared-out total would not come out whole, and this lesson never asks that" },
    { file:"review", via:"review", expect:"unknown scene",
      find:"    { id:'apple', zh:{ unit:'顆', name:'蘋果', big:'箱', small:'袋' }, en:{ name:'apple', big:'crate',  small:'bag'    } }",
      replace:"    { id:'apple', zh:{ unit:'顆', name:'蘋果', big:'箱', small:'袋' }, en:{ name:'apple', big:'crate',  small:'bag'    } },\n    { id:'kiwi', zh:{ unit:'顆', name:'奇異果', big:'箱', small:'袋' }, en:{ name:'kiwi', big:'crate', small:'bag' } }",
      why:"a story whose scene the stem oracle does not know would go unverified" },
    { file:"review", via:"review", expect:"wordChain: total ",
      find:"          var t = a * b * c;\n          if (t > TOTAL_MAX) return null;\n          if (a + b === a * b) return null;\n          var sc = pick(SCENES);",
      replace:"          var t = a * b * c;\n          if (t > 99999) return null;\n          if (a + b === a * b) return null;\n          var sc = pick(SCENES);",
      why:"the word problem would use totals far past the range this lesson states" },
    { file:"review", via:"review", expect:"opts[ans] is not the computed number of big containers",
      find:"          return { t:t, p:p, b:b, k:k, scene:sc.id, opts:opts, ans:opts.indexOf(k) };",
      replace:"          return { t:t, p:p, b:b, k:k, scene:sc.id, opts:opts, ans:opts.indexOf(b * k) };",
      why:"the option marked correct would be the number of small containers" },
    { file:"review", via:"review", expect:"pickExpr: distractor",
      find:"          if (m === k) return null;              /* n ÷ m × k 會和正解同值 */",
      replace:"          if (false) return null;                /* n ÷ m × k 會和正解同值 */",
      why:"when m = k the \"divide then multiply\" distractor has exactly the answer value" },
    { file:"review", via:"index", expect:"PIN \"var right = n + ' × ' + m + ' ÷ ' + k;\"",
      find:"          var right = n + ' × ' + m + ' ÷ ' + k;",
      replace:"          var right = n + ' ÷ ' + m + ' × ' + k;",
      why:"the marked expression would divide a single crate instead of the total" },
    { file:"review", via:"index", expect:"PIN \"var digits = String(Q).length;\"",
      find:"          var digits = String(Q).length;",
      replace:"          var digits = String(D).length;",
      why:"the digit count would be read off the divisor instead of the quotient" },
    { file:"review", via:"review", expect:"must have three digits",
      find:"          if (t > TOTAL_MAX || t < 100) return null;",
      replace:"          if (t > TOTAL_MAX) return null;",
      why:"a two-digit dividend makes the \"bring the digits in from the left\" explanation false" },
    { file:"review", via:"review", expect:"options must be exactly 1, 2, 3 and 4",
      find:"          var opts = shuffle([1, 2, 3, 4]);\n          return { D:D, Q:Q, t:t, digits:digits, opts:opts, ans:opts.indexOf(digits) };",
      replace:"          var opts = shuffle([0, 1, 2, 3]);\n          return { D:D, Q:Q, t:t, digits:digits, opts:opts, ans:opts.indexOf(digits) };",
      why:"a quotient with 0 digits does not exist, so it must never be offered" },
    { file:"review", via:"review", expect:"val is not z + x × y",
      find:"          var right = z + x * y;",
      replace:"          var right = z * x + y;",
      why:"the interleaved order-of-operations question would be scored the wrong way round" },
    { file:"review", via:"review", expect:"sumFirst is not",
      find:"          var sumFirst = (z + x) * y;",
      replace:"          var sumFirst = (z + x) + y;",
      why:"the \"added first\" distractor would not be what adding first actually gives" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"            ? '一批貨裝成 <strong>' + d.a + ' 個大箱</strong>，每個大箱再分成 <strong>' + d.b + ' 個小袋</strong>。一共有幾個小袋？'",
      replace:"            ? '一批貨裝成 <strong>' + d.a + ' 個大箱</strong>，每個大箱再分成 <strong>' + d.b + ' 個小袋</strong>。一共有幾個大箱？'",
      why:"the stem would ask about boxes while the answer counts bags" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"          stem: '<strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong>' + eq(lang) + '?',",
      replace:"          stem: '<strong>' + d.t + ' ÷ ' + d.a + ' × ' + d.b + '</strong>' + eq(lang) + '?',",
      why:"the printed expression would not be the one the answer was computed from" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"            ? '哪一個算式和 <strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong> 一樣？'",
      replace:"            ? '哪一個算式和 <strong>' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + '</strong> 不一樣？'",
      why:"flipping the question to \"which is different\" would make every option wrong" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"            ? '<strong>' + d.t + ' ÷ (' + d.a + ' × ' + d.b + ')</strong> 這個算式，要<strong>先算</strong>哪一步？'",
      replace:"            ? '<strong>' + d.t + ' ÷ (' + d.a + ' × ' + d.b + ')</strong> 這個算式，要<strong>最後算</strong>哪一步？'",
      why:"asking for the last step instead of the first would make the marked option wrong" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"            ? '<strong>' + d.t + ' ÷ ' + d.D + '</strong> 想拆成連續除兩次。哪一個是對的？'",
      replace:"            ? '<strong>' + d.t + ' ÷ ' + d.D + '</strong> 想拆成連續乘兩次。哪一個是對的？'",
      why:"the stem would say multiply where the options divide" },
    { file:"review", via:"review", expect:"arithmetic is wrong",
      find:"            ? '每一個大箱都有 ' + d.b + ' 個小袋，' + d.a + ' 個大箱就是 ' + d.a + ' × ' + d.b + ' ＝ ' + d.total + ' 個小袋。",
      replace:"            ? '每一個大箱都有 ' + d.b + ' 個小袋，' + d.a + ' 個大箱就是 ' + d.a + ' × ' + d.b + ' ＝ ' + (d.total + 1) + ' 個小袋。",
      why:"a wrong equation in the explanation must not pass" },
    { file:"review", via:"review", expect:"why verified only",
      find:"            ? '從左往右：' + d.t + ' ÷ ' + d.a + ' ＝ ' + (d.t / d.a) + '，' + (d.t / d.a) + ' ÷ ' + d.b + ' ＝ ' + d.c + '。也可以一次算完：除以 ' + d.a + ' × ' + d.b + ' ＝ ' + (d.a * d.b) + '，' + d.t + ' ÷ ' + (d.a * d.b) + ' ＝ ' + d.c + '。'",
      replace:"            ? '從左往右先除 ' + d.a + '，再除 ' + d.b + '，答案就是 ' + d.c + '。'",
      why:"an explanation with no equations left would silently stop being checked" },
    { file:"review", via:"review", expect:"missing space between Chinese and a digit",
      find:"            ? '只有乘和除，就從左往右：' + d.t + ' ÷ ' + d.a + ' ＝ ' + d.q + '，' + d.q + ' × ' + d.b + ' ＝ ' + d.val + '。想先算 ",
      replace:"            ? '只有乘和除，就從左往右：第' + d.a + ' 步先除。' + d.t + ' ÷ ' + d.a + ' ＝ ' + d.q + '，' + d.q + ' × ' + d.b + ' ＝ ' + d.val + '。想先算 ",
      why:"Chinese glued to a digit is unreadable and is a site-wide convention" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      replace:"    return n + ' ' + w + 's';",
      why:"English would print \"3 boxs\" and \"5 classs\"" },
    { file:"review", via:"review", expect:"option leaks an internal value",
      find:"    for (var k = 1; out.length < 4 && k <= 400; k++){",
      replace:"    if (out.length < 4) out.push(correct + '·' + out.length);\n    for (var k = 1; out.length < 4 && k <= 400; k++){",
      why:"the fallback must never be a string that only looks like an answer" },
    { file:"review", via:"review", expect:"expression option has an unexpected character",
      find:"  function exprOpts(correct, cands){",
      replace:"  function exprOpts(correct, cands){\n    cands = cands.map(function(s){ return s ? s + '?' : s; });",
      why:"a stray character in an expression option would leave the child guessing what it means" },
    { file:"index", via:"index", expect:"SIBLING index: \"從左往右\"",
      find:"  <p class=\"notebox\" data-i18n=\"s4note\">💬 <strong>×</strong> 和 <strong>÷</strong> 是<strong>同一層</strong>，沒有「先乘後除」這回事 —— <strong>從左往右</strong>一個一個算。想改變算的順序，只能<strong>加括號</strong>。</p>",
      replace:"  <p class=\"notebox\" data-i18n=\"s4note\">💬 <strong>×</strong> 和 <strong>÷</strong> 是<strong>同一層</strong>，沒有「先乘後除」這回事 —— 一個一個算。想改變算的順序，只能<strong>加括號</strong>。</p>",
      why:"dropping the rule from one place on the lesson page must be noticed" },
    { file:"reference", via:"index", expect:"SIBLING reference: \"連續除以兩個數，就是除以那兩個數的積\"",
      find:"      f1:'連續除以兩個數，就是除以那兩個數的積<span class=\"cond\">前提是每一步都除得剛剛好；那個積就是「一共分成幾份」</span>',",
      replace:"      f1:'連續除兩次就是除以它們相乘的結果<span class=\"cond\">前提是每一步都除得剛剛好；那個積就是「一共分成幾份」</span>',",
      why:"the cheat sheet must state the rule in exactly the same words as the lesson" },
    { file:"parents", via:"index", expect:"SIBLING parents: \"第二次除的是\"",
      find:"      b2:'算 480 ÷ 6 ÷ 4 時<strong>從左往右</strong>算（480 ÷ 6 ＝ 80，80 ÷ 4 ＝ 20），並且說得出第二次除的是<strong>80</strong>，不是 480。',",
      replace:"      b2:'算 480 ÷ 6 ÷ 4 時<strong>從左往右</strong>算（480 ÷ 6 ＝ 80，80 ÷ 4 ＝ 20），並且說得出那一步用的是<strong>80</strong>，不是 480。',",
      why:"the observable behaviour on the parent page must use the same wording as the lesson" },
    { file:"review", via:"index", expect:"SIBLING review: \"left to right\"",
      find:"            : 'Nothing but × and ÷ means left to right: ' + d.n + ' × ' + d.m + ' = ' + d.total + ', then ' + d.total + ' ÷ ' + d.k + ' = ' + d.val + '. ' + d.total + ' is only the first step.'",
      replace:"            : 'Work it out in order: ' + d.n + ' × ' + d.m + ' = ' + d.total + ', then ' + d.total + ' ÷ ' + d.k + ' = ' + d.val + '. ' + d.total + ' is only the first step.'",
      why:"the English rule must not drift away from the other three pages" },
    { file:"index", via:"index", expect:"FORBIDDEN index",
      find:"  <p class=\"notebox\" data-i18n=\"s2note\">💬 <strong>連續除以兩個數，就是除以那兩個數的積</strong>。",
      replace:"  <p class=\"notebox\" data-i18n=\"s2note\">💬 <strong>連續除以兩個數，就是除以它們的和</strong>。",
      why:"the sum is never the divisor, and no page may ever say it is" },
    { file:"review", via:"index", expect:"really defines",
      find:"    { id:'mixedMulDiv', cat:'order',",
      replace:"    { id:'mixedMulDivX', cat:'order',",
      why:"deleting or renaming a generator would silently remove its whole set of invariants" },
    { file:"review", via:"index", expect:"PIN \"var VAL_MAX = 10000, TOTAL_MAX = 999;\"",
      find:"  var VAL_MAX = 10000, TOTAL_MAX = 999;",
      replace:"  var VAL_MAX = 10000, TOTAL_MAX = 9999;",
      why:"widening the lesson range without saying so would let the generators leave the stated domain" },
    { file:"review", via:"index", expect:"PIN \"function exact(x, y)",
      find:"  function exact(x, y){ return y !== 0 && x % y === 0; }",
      replace:"  function exact(x, y){ return y !== 0; }",
      why:"this lesson only asks exact divisions, so every generator has to be able to test for one" },
    { file:"review", via:"review", expect:"which leaves remainder",
      find:"            t + ' ÷ ' + p + ' ÷ ' + k,",
      replace:"            t + ' ÷ ' + p + ' ÷ ' + (r + 1),",
      why:"a distractor built by bumping a factor almost always prints a division with a remainder" },
    { file:"index", via:"index", expect:"which leaves remainder",
      find:"opts:['960 ÷ 4 ÷ 8', '960 ÷ 4 ÷ 4', '960 ÷ 30 ÷ 2', '960 ÷ 8 ÷ 8'], ans:0,\n          why:'拆出來的兩個數乘起來要",
      replace:"opts:['960 ÷ 4 ÷ 8', '960 ÷ 4 ÷ 4', '960 ÷ 30 ÷ 2', '960 ÷ 16 ÷ 16'], ans:0,\n          why:'拆出來的兩個數乘起來要",
      why:"a static distractor a child may try to evaluate must divide exactly too" },
    { file:"index", via:"index", expect:"which leaves remainder",
      find:"    { id:'muldiv', head:24,  ops:[['*', 5], ['/', 8]] }\n  ];",
      replace:"    { id:'muldiv', head:24,  ops:[['*', 5], ['/', 7]] }\n  ];",
      why:"an example whose second step leaves a remainder breaks the lesson's own promise" },
    { file:"index", via:"index", expect:"hides part of itself",
      find:"      s3on:'✅ 在回答這個問題',",
      replace:"      s3on:'✅ 在回答這個問題<span hidden>480 ÷ 6 ＝ 80</span>',",
      why:"a hidden equation would prop up the arithmetic coverage while the child sees nothing" },
    { file:"index", via:"index", expect:"missing space between Chinese and a digit",
      find:"      s2step:function(i){ return ['① 一共幾袋', '② 一次除完', '③ 兩條路比一比'][i]; },",
      replace:"      s2step:function(i){ return ['① 一共幾袋', '② 第&#50;步', '③ 兩條路比一比'][i]; },",
      why:"an HTML entity renders as a digit glued to Chinese, and the raw string hides it" },
    { file:"index", via:"index", expect:"reports a",
      find:"    return { w:FIG_W, h:FIG_H, step:step, rects:rects, dots:dots };",
      replace:"    return { w:FIG_W + 40, h:FIG_H, step:step, rects:rects, dots:dots };",
      why:"the plan could report any canvas it liked while the coordinates stayed put" },
    { file:"index", via:"index", expect:"is not centred horizontally",
      find:"    var ox = (FIG_W - totalW) / 2, oy = (FIG_H - bx.h) / 2;",
      replace:"    var ox = 12, oy = (FIG_H - bx.h) / 2;",
      why:"boxes pushed to the left edge leave half the canvas empty" },
    { file:"index", via:"index", expect:"is not centred vertically",
      find:"    var px = (FIG_W - pw) / 2, py = (FIG_H - ph) / 2;",
      replace:"    var px = (FIG_W - pw) / 2, py = 6;",
      why:"the unshared pile would sit against the top edge" },
    { file:"index", via:"index", expect:"the gaps between big boxes are not all equal",
      find:"      var boxX = ox + i * (bx.w + BOX_GAP);",
      replace:"      var boxX = ox + i * (bx.w + BOX_GAP) + i * i;",
      why:"unequal gaps make the boxes look like an accident" },
    { file:"index", via:"index", expect:"the gap between small bags is",
      find:"        var bagX = boxX + BOX_PAD + j * (bg.w + BAG_GAP), bagY = oy + BOX_PAD;",
      replace:"        var bagX = boxX + BOX_PAD + j * (bg.w + BAG_GAP + 2), bagY = oy + BOX_PAD;",
      why:"the bag spacing must match the spec, not just fit inside the box" },
    { file:"index", via:"index", expect:"no longer matches the pattern the numbers are read from",
      find:"{ stem:'720 個麵包，<strong>每盒裝 6 個</strong>，<strong>每箱裝 5 盒</strong>。可以裝滿幾箱？',",
      replace:"{ stem:'720 個麵包，<strong>一盒裝 6 個</strong>，<strong>每箱裝 5 盒</strong>。可以裝滿幾箱？',",
      why:"if the stem stops matching, the numbers are no longer being read out of it" },
    { file:"index", via:"index", expect:"recomputing from the stem numbers",
      find:"{ stem:'864 顆蛋要裝箱：先<strong>平均</strong>裝成 <strong>12 箱</strong>，每箱再<strong>平均</strong>分成 <strong>6 盒</strong>。一盒幾顆蛋？',",
      replace:"{ stem:'864 顆蛋要裝箱：先<strong>平均</strong>裝成 <strong>24 箱</strong>，每箱再<strong>平均</strong>分成 <strong>6 盒</strong>。一盒幾顆蛋？',",
      why:"changing a number in the stem must change the answer the oracle recomputes" },
    { file:"index", via:"index", expect:"en stem does not match the oracle",
      find:"{ stem:'Which expression is the same as <strong>480 ÷ 6 ÷ 4</strong>?',",
      replace:"{ stem:'Which expression is different from <strong>480 ÷ 6 ÷ 4</strong>?',",
      why:"the English question could be flipped while the options and ans stayed put" },
    { file:"index", via:"index", expect:"en: the stem no longer asks about",
      find:"{ stem:'In <strong>720 ÷ (8 × 3)</strong>, which step comes <strong>first</strong>?',",
      replace:"{ stem:'In <strong>720 ÷ (8 × 3)</strong>, which step comes at the end?',",
      why:"the English stem must keep asking for the FIRST step" },
    { file:"reference", via:"index", expect:"appears 3 time(s), expected exactly 2",
      find:"      f1:'連續除以兩個數，就是除以那兩個數的積<span class=\"cond\">",
      replace:"      f1:'連續除以兩個數，就是除以那兩個數的積（連續除以兩個數，就是除以那兩個數的積）<span class=\"cond\">",
      why:"an extra copy elsewhere must not be able to offset a removal, so the count is pinned exactly" },
    { file:"index", via:"index", expect:"style rules whose selector mentions packfig",
      find:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto}",
      replace:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto}\n  .packfig{height:250px}",
      why:"a later rule would win in the browser while the checker read the first one" },
    { file:"index", via:"index", expect:"expected exactly two .packfig canvases",
      find:"        <svg class=\"packfig\" id=\"s2fig\" viewBox=\"0 0 460 150\" xmlns=\"http://www.w3.org/2000/svg\"></svg>\n",
      replace:"",
      why:"a missing canvas would leave one example with nothing to look at" },
    { file:"review", via:"index", expect:"really defines",
      find:"    { id:'interDigits', cat:'inter',",
      replace:"    { id:'interDigitsX', cat:'inter',",
      why:"renaming a generator must be caught by running the registry, not by finding its literal" },
    { file:"index", via:"index", expect:"is not an index into the four options",
      find:"opts:['20', '320', '48', '80'], ans:0,\n          why:'從左往右",
      replace:"opts:['20', '320', '48', '80'], ans:9,\n          why:'從左往右",
      why:"an out-of-range answer index would render no correct option at all" },
    { file:"review", via:"review", expect:"stem does not match the oracle",
      find:"先<strong>平均</strong>裝成 <strong>' + t.bigs(d.a, sc) + '</strong>",
      replace:"先裝成 <strong>' + t.bigs(d.a, sc) + '</strong>",
      why:"without \"equally\" the amount in one small container is not determined" },
    { file:"index", via:"index", expect:"prints 4 ÷ 5",
      find:"        if (step <= 0) return '';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' ＝ ' + (cs.t / cs.a);",
      replace:"        if (step <= 0) return '6 ＋ 4 ÷ 5';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' ＝ ' + (cs.t / cs.a);",
      why:"walking a chain left to right instead of by precedence would check 10 ÷ 5 and miss the printed 4 ÷ 5" },
    { file:"index", via:"index", expect:"prints 5 ÷ 2",
      find:"        if (step <= 0) return '';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' = ' + (cs.t / cs.a);",
      replace:"        if (step <= 0) return '5 &divide; 2';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' = ' + (cs.t / cs.a);",
      why:"an entity-written division sign renders normally but is invisible to an undecoded scan" },
    { file:"index", via:"index", expect:"hides part of itself",
      find:"      s3on:'✅ answers this question',",
      replace:"      s3on:'✅ answers this question<span style=\"display&#58;none\">480 ÷ 6 = 80</span>',",
      why:"a hiding style written with an entity would prop up the arithmetic coverage" },
    { file:"review", via:"index", expect:"mentions GENS after the generator block in a way other than shuffle(GENS)",
      find:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;",
      replace:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;\n  GENS[0].id = 'renamed';",
      why:"renaming a generator after the executed block would change the page but not the checker" },
    { file:"index", via:"index", expect:"appears 9 time(s), expected exactly 10",
      find:"  <p class=\"notebox\" data-i18n=\"s4note\">💬 <strong>×</strong> 和 <strong>÷</strong> 是<strong>同一層</strong>，沒有「先乘後除」這回事 —— <strong>從左往右</strong>一個一個算。想改變算的順序，只能<strong>加括號</strong>。</p>",
      replace:"  <p class=\"notebox\" data-i18n=\"s4note\">💬 <strong>×</strong> 和 <strong>÷</strong> 是<strong>同一層</strong>，沒有「先乘後除」這回事 —— 一個一個算。想改變算的順序，只能<strong>加括號</strong>。</p>\n  // 從左往右",
      why:"a comment must not be able to replace a sentence the child actually reads" },
    { file:"index", via:"index", expect:"style rules whose selector mentions packfig",
      find:"  .figwrap{margin-top:16px;text-align:center;overflow-x:auto}",
      replace:"  .figwrap{margin-top:16px;text-align:center;overflow-x:auto}\n  svg.packfig{height:250px}",
      why:"a more specific rule wins in the browser while a .packfig-only scan never sees it" },
    { file:"index", via:"index", expect:"carries an inline style",
      find:"<svg class=\"packfig\" id=\"s1fig\" viewBox=\"0 0 460 150\" xmlns=\"http://www.w3.org/2000/svg\">",
      replace:"<svg class=\"packfig\" id=\"s1fig\" style=\"height:250px\" viewBox=\"0 0 460 150\" xmlns=\"http://www.w3.org/2000/svg\">",
      why:"an inline height would shrink the figure past every stylesheet check" },
    { file:"index", via:"index", expect:"no longer matches the pattern the numbers are read from",
      find:"{ stem:'<strong>480 ÷ 6 ÷ 4</strong> ＝ ?',\n          opts:['20', '320', '48', '80'], ans:0,",
      replace:"{ stem:'<strong>480 ÷ 6 ÷ 4</strong> ＝ ?（提示：480 ÷ 24）',\n          opts:['20', '320', '48', '80'], ans:0,",
      why:"text appended after the expression is only caught by the end anchor" },
    { file:"index", via:"index", expect:"INDEX PIN",
      find:"      svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:DOT_R, fill:DOT_FILL }));",
      replace:"      svg.appendChild(svgEl('circle', { cx:p.x + 20, cy:p.y, r:DOT_R, fill:DOT_FILL }));",
      why:"every plan-level assertion stays green while the drawing moves" },
    { file:"review", via:"review", expect:"two options work out to the same number",
      find:"            t + ' ÷ ' + p + ' ÷ ' + (r * k)",
      replace:"            t + ' ÷ ' + k + ' ÷ ' + p",
      why:"a pair written the other way round gives the child two identical answers" },
    { file:"index", via:"index", expect:"an operator with nothing between it and the next one",
      find:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '24 ÷ 3 ÷ 2 ＝ 24 ÷ (3 × 2) ＝ 4';",
      replace:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '8 ÷ 2 ＋ ＋ 3';",
      why:"a malformed chain must be reported, not skipped" },
    { file:"index", via:"index", expect:"writes a division with \"/\"",
      find:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '24 ÷ 3 ÷ 2 = 24 ÷ (3 × 2) = 4';",
      replace:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '8 / 3';",
      why:"this lesson always writes division as the division sign, so a bare slash must fail closed" },
    { file:"index", via:"index", expect:"prints 5 ÷ 2",
      find:"        if (step <= 0) return '';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' ＝ ' + (cs.t / cs.a);",
      replace:"        if (step <= 0) return '5 &divide 2';\n        if (step === 1) return cs.t + ' ÷ ' + cs.a + ' ＝ ' + (cs.t / cs.a);",
      why:"an entity without its semicolon still renders as a division sign" },
    { file:"index", via:"index", expect:"declares height 2 time(s)",
      find:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto}",
      replace:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto;height:250px}",
      why:"the browser uses the last declaration while a single regex reads the first" },
    { file:"review", via:"index", expect:"mentions GENS after the generator block in a way other than shuffle(GENS)",
      find:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;",
      replace:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;\n  GENS = [];",
      why:"replacing the registry wholesale is not caught by looking for GENS[ or GENS." },
    { file:"index", via:"index", expect:"no longer matches the pattern the numbers are read from",
      find:"{ stem:'一批貨分成 <strong>6 個大箱</strong>，每個大箱再分成 <strong>4 個小袋</strong>。一共有幾個小袋？',",
      replace:"{ stem:'一批貨分成 <strong>6 個大箱</strong>，每個大箱再分成 <strong>4 個小袋</strong>。一共有幾個小袋？\\n',",
      why:"a trailing newline still matches a $ anchor, so the end anchor has to be (?![\\\\s\\\\S])" },
    { file:"index", via:"index", expect:"en.s4calc",
      find:"      s4calc:function(st, k){ return st.part; },\n      s4result:function(st, k){\n        if (k < st.n) return '?';",
      replace:"      s4calc:function(st, k){ return '5 ÷ 2'; },\n      s4result:function(st, k){\n        if (k < st.n) return '?';",
      why:"the English example-4 expression was outside the exactness loop" },
    { file:"index", via:"index", expect:"appears 0 time(s) in live code",
      find:"      svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:DOT_R, fill:DOT_FILL }));",
      replace:"      svg.appendChild(svgEl('circle', { cx:p.x + 20, cy:p.y, r:DOT_R, fill:DOT_FILL }));\n      /* svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:DOT_R, fill:DOT_FILL })); */",
      why:"a literal pin must not be satisfiable by a copy of the line sitting in a comment" },
    { file:"index", via:"index", expect:"writes a division with \"/\"",
      find:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '24 ÷ 3 ÷ 2 ＝ 24 ÷ (3 × 2) ＝ 4';",
      replace:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '８ / ３';",
      why:"a full-width digit either side of a slash is still an ASCII division this lesson never writes" },
    { file:"index", via:"index", expect:"an equals sign with nothing on one side",
      find:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '24 ÷ 3 ÷ 2 = 24 ÷ (3 × 2) = 4';",
      replace:"      s3calc:function(qkey){\n        if (qkey === 'bag') return '8 ÷ 2 ＝';",
      why:"a dangling equals sign is a broken claim, and trimming it away would hide that" },
    { file:"review", via:"index", expect:"mentions GENS after the generator block in a way other than shuffle(GENS)",
      find:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;",
      replace:"  /* ---------- 出一批 12 題：12 種題型各一題 ---------- */\n  var QCOUNT = 12;\n  var g = (GENS);",
      why:"aliasing through brackets is not caught by listing mutation shapes, so only a whitelist works" },
    { file:"index", via:"index", expect:"contains a backslash escape",
      find:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto}",
      replace:"  .packfig{width:100%;max-width:460px;height:150px;display:block;margin:0 auto;he\\\\69 ght:250px}",
      why:"CSS resolves an escaped property name, so counting literal spellings misses it" },
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      totalParts: d => {
        if (!d) return 'totalParts: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!(d.a >= 2 && d.a <= 9)) return 'totalParts: a=' + d.a + ' is outside 2..9';
        /* 下界 2 就是「一箱至少兩袋，第二次除法才看得見」；分開寫一條 d.b < 2
           永遠不會響（上面那條已經接走了），所以理由寫在同一條訊息裡。（codex 第一輪） */
        if (!(d.b >= 2 && d.b <= 8)) return 'totalParts: b=' + d.b + ' is outside 2..8 (one bag per box would teach nothing)';
        if (d.a + d.b === d.a * d.b) return 'totalParts: a + b equals a × b, so the "added" distractor is the answer';
        const prod = mulRef(d.a, d.b);
        if (prod !== d.total) return 'totalParts: total ' + d.total + ' but repeated addition gives ' + prod;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'totalParts: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.total) return 'totalParts: opts[ans] is not the computed total';
        for (const o of d.opts) if (!inRangeRef(o)) return 'totalParts: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.total && (o === d.a || o === d.b))
          return 'totalParts: distractor ' + o + ' is copied straight out of the stem';
      },
      chainValue: d => {
        if (!d) return 'chainValue: make() returned nothing — every draw failed, so this generator has no domain left';
        for (const [k, v] of [['a', d.a], ['b', d.b], ['c', d.c]])
          if (!(v >= 2 && v <= 9)) return 'chainValue: ' + k + '=' + v + ' is outside 2..9';
        const t = mulRef(mulRef(d.a, d.b), d.c);
        if (t !== d.t) return 'chainValue: t ' + d.t + ' but a × b × c gives ' + t;
        if (!(d.t <= TOTAL_MAX_REF)) return 'chainValue: total ' + d.t + ' is above this lesson range';
        if (d.a + d.b === d.a * d.b) return 'chainValue: a + b equals a × b, so the "added divisor" distractor is the answer';
        const r = chainVsOnceRef(d.t, d.a, d.b);
        if (!r.ok) return 'chainValue: ' + r.why;
        if (!r.exact) return 'chainValue: ' + d.t + ' ÷ ' + d.a + ' ÷ ' + d.b + ' does not divide exactly; this lesson only asks exact divisions, because a remainder means deciding what to do with what is left';
        if (!r.agree) return 'chainValue: dividing twice gives ' + r.chain + ' but dividing by the product gives ' + r.once;
        if (r.chain !== d.c) return 'chainValue: c ' + d.c + ' but repeated subtraction gives ' + r.chain;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'chainValue: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.c) return 'chainValue: opts[ans] is not the computed quotient';
        for (const o of d.opts) if (!inRangeRef(o)) return 'chainValue: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.c && (o === d.t || o === d.a || o === d.b))
          return 'chainValue: distractor ' + o + ' is copied straight out of the stem';
      },
      sameExpr: d => {
        if (!d) return 'sameExpr: make() returned nothing — every draw failed, so this generator has no domain left';
        const t = mulRef(mulRef(d.a, d.b), d.c);
        if (t !== d.t) return 'sameExpr: t ' + d.t + ' but a × b × c gives ' + t;
        if (d.a + d.b === d.a * d.b) return 'sameExpr: a + b equals a × b, so the "sum" option would also be right';
        if (divRef(d.t, d.a + d.b).r !== 0)
          return 'sameExpr: the "added divisors" distractor prints ' + d.t + ' ÷ ' + (d.a + d.b) + ', which leaves a remainder';
        if (!(d.b >= 2)) return 'sameExpr: b=1 makes "÷ a × b" equal to the answer';
        if (!(d.a >= 2)) return 'sameExpr: a=1 makes "× a ÷ b" equal to the answer';
        const r = chainVsOnceRef(d.t, d.a, d.b);
        if (!r.ok || !r.exact || !r.agree || r.chain !== d.c)
          return 'sameExpr: the chained division does not check out (' + (r.why || (r.chain + ' vs ' + r.once)) + ')';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'sameExpr: options are not four distinct expressions';
        const right = d.opts[d.ans];
        if (right !== d.t + ' ÷ (' + d.a + ' × ' + d.b + ')') return 'sameExpr: opts[ans] is not the bracketed product form: ' + right;
        /* 每一個選項都必須讀得懂（讀不懂就是沒檢查），而且只有正解和題目同值。 */
        const want = evalPrintedRef(d.t + ' ÷ ' + d.a + ' ÷ ' + d.b);
        if (!fIsInt(want) || want.n !== d.c) return 'sameExpr: the printed stem expression evaluates to ' + fVal(want) + ', not ' + d.c;
        for (let i = 0; i < d.opts.length; i++){
          const v = evalPrintedRef(d.opts[i]);
          if (!v) return 'sameExpr: option cannot be parsed: ' + d.opts[i];
          if (i === d.ans){
            if (!fEq(v, want)) return 'sameExpr: the marked option evaluates to ' + fVal(v) + ', not ' + fVal(want);
          } else if (fEq(v, want)){
            return 'sameExpr: distractor ' + d.opts[i] + ' has the same value as the question';
          }
        }
      },
      bracketFirst: d => {
        if (!d) return 'bracketFirst: make() returned nothing — every draw failed, so this generator has no domain left';
        const t = mulRef(mulRef(d.a, d.b), d.c);
        if (t !== d.t) return 'bracketFirst: t ' + d.t + ' but a × b × c gives ' + t;
        if (d.a === d.b) return 'bracketFirst: a equals b, so two options would read the same';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'bracketFirst: options are not four distinct steps';
        if (d.opts[d.ans] !== d.a + ' × ' + d.b) return 'bracketFirst: opts[ans] is not the step inside the brackets: ' + d.opts[d.ans];
        const vals = [];
        for (const o of d.opts){
          const v = evalPrintedRef(o);
          if (!v) return 'bracketFirst: option cannot be parsed: ' + o;
          vals.push(fVal(v));
        }
        if (new Set(vals).size !== 4) return 'bracketFirst: two options work out to the same number (' + vals.join(', ') + ')';
        const inner = evalPrintedRef(d.a + ' × ' + d.b);
        if (!fIsInt(inner) || inner.n !== mulRef(d.a, d.b)) return 'bracketFirst: the bracketed step does not evaluate to a × b';
        const whole = evalPrintedRef(d.t + ' ÷ (' + d.a + ' × ' + d.b + ')');
        if (!fIsInt(whole) || whole.n !== d.c) return 'bracketFirst: the printed expression evaluates to ' + fVal(whole) + ', not ' + d.c;
      },
      leftToRight: d => {
        if (!d) return 'leftToRight: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!(d.a >= 3 && d.a <= 9)) return 'leftToRight: a=' + d.a + ' is outside 3..9';
        if (!(d.b >= 2 && d.b <= 6)) return 'leftToRight: b=' + d.b + ' is outside 2..6';
        if (mulRef(d.m, d.b) !== d.q) return 'leftToRight: q ' + d.q + ' is not m × b';
        if (mulRef(d.q, d.a) !== d.t) return 'leftToRight: t ' + d.t + ' is not q × a';
        if (!(d.t <= TOTAL_MAX_REF)) return 'leftToRight: total ' + d.t + ' is above this lesson range';
        if (mulRef(d.q, d.b) !== d.val) return 'leftToRight: val ' + d.val + ' is not q × b';
        if (!(d.val <= TOTAL_MAX_REF)) return 'leftToRight: answer ' + d.val + ' is above this lesson range';
        /* ⚠️ 這兩條是規格，不是可以改壞測試的斷言：val ＝ m × b × b 而 m ≥ 2、b ≥ 2，
           所以在上面那幾條範圍斷言（它們各有自己的改壞測試）成立時，它們不可能發生。
           `make()` 裡原本那兩行拒絕條件因此是死的，已經拿掉（codex 第一輪）。 */
        if (d.val === d.m) return 'leftToRight: the "brackets" answer equals the left-to-right answer, so the question teaches nothing';
        if (d.val === d.q) return 'leftToRight: the first-step answer equals the final answer';
        /* 這一課的核心：**印出來的**算式從左往右算出來就是正解。 */
        const asPrinted = evalPrintedRef(d.t + ' ÷ ' + d.a + ' × ' + d.b);
        if (!fIsInt(asPrinted) || asPrinted.n !== d.val)
          return 'leftToRight: the printed expression evaluates to ' + fVal(asPrinted) + ', not ' + d.val;
        const bracketed = evalPrintedRef(d.t + ' ÷ (' + d.a + ' × ' + d.b + ')');
        if (!fIsInt(bracketed) || bracketed.n !== d.m)
          return 'leftToRight: the bracketed form the explanation quotes evaluates to ' + fVal(bracketed) + ', not ' + d.m;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'leftToRight: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.val) return 'leftToRight: opts[ans] is not the computed value';
        for (const o of d.opts) if (!inRangeRef(o)) return 'leftToRight: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.val && (o === d.t || o === d.a || o === d.b))
          return 'leftToRight: distractor ' + o + ' is copied straight out of the stem';
      },
      splitDivisor: d => {
        if (!d) return 'splitDivisor: make() returned nothing — every draw failed, so this generator has no domain left';
        if (mulRef(d.p, d.r) !== d.D) return 'splitDivisor: p × r is not the divisor D';
        if (!(d.D >= 10 && d.D <= 81)) return 'splitDivisor: D=' + d.D + ' is outside 10..81';
        if (mulRef(d.D, d.k) !== d.t) return 'splitDivisor: t is not D × k';
        if (d.p === d.r || d.k === d.p || d.k === d.r)
          return 'splitDivisor: p, r and k must be three different numbers, or two options collide (' + d.p + ', ' + d.r + ', ' + d.k + ')';
        if (!(d.t <= TOTAL_MAX_REF)) return 'splitDivisor: total ' + d.t + ' is above this lesson range';
        const pairs = factorPairsRef(d.D).map(x => x.join('x'));
        if (pairs.indexOf(d.p + 'x' + d.r) < 0) return 'splitDivisor: [' + d.p + ', ' + d.r + '] is not a factor pair of ' + d.D;
        const chain = chainVsOnceRef(d.t, d.p, d.r);
        if (!chain.ok || !chain.exact) return 'splitDivisor: ' + d.t + ' ÷ ' + d.p + ' ÷ ' + d.r + ' does not divide exactly';
        if (chain.chain !== d.k) return 'splitDivisor: the split gives ' + chain.chain + ' but k is ' + d.k;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'splitDivisor: options are not four distinct expressions';
        const right = d.t + ' ÷ ' + d.p + ' ÷ ' + d.r;
        if (d.opts[d.ans] !== right) return 'splitDivisor: opts[ans] is not the correct split: ' + d.opts[d.ans];
        for (let i = 0; i < d.opts.length; i++){
          const m = /^(\d+) ÷ (\d+) ÷ (\d+)$/.exec(d.opts[i]);
          if (!m) return 'splitDivisor: option is not "total ÷ x ÷ y": ' + d.opts[i];
          if (Number(m[1]) !== d.t) return 'splitDivisor: option ' + d.opts[i] + ' does not start from the total';
          const prod = mulRef(Number(m[2]), Number(m[3]));
          if (i === d.ans){
            if (prod !== d.D) return 'splitDivisor: the marked split multiplies to ' + prod + ', not ' + d.D;
          } else if (prod === d.D){
            return 'splitDivisor: distractor ' + d.opts[i] + ' is also a valid split of ' + d.D;
          }
          /* ⚠️ 誘答的兩次除法也要除得剛剛好 —— 孩子可能真的去算它。 */
          const bad = inexactDivisions(d.opts[i]);
          if (bad.length) return 'splitDivisor: ' + bad[0];
          const v = evalPrintedRef(d.opts[i]);
          if (!v) return 'splitDivisor: option cannot be parsed: ' + d.opts[i];
          if (i !== d.ans && fIsInt(v) && v.n === d.k)
            return 'splitDivisor: distractor ' + d.opts[i] + ' works out to the same answer';
        }
        /* ⚠️ 四個選項算出來的**值**也要互不相同：`t ÷ p ÷ k` 和 `t ÷ k ÷ p`
           字串不一樣、值一樣，孩子會看到兩個相同的答案（codex 第二輪）。
           ⚠️ 排在「有沒有第二個正確的拆法」後面：那一條比較嚴重，要先響。 */
        const seenVals = {};
        for (let i = 0; i < d.opts.length; i++){
          const key = fVal(evalPrintedRef(d.opts[i]));
          if (seenVals[key]) return 'splitDivisor: two options work out to the same number (' + key + ')';
          seenVals[key] = 1;
        }
      },
      mixedMulDiv: d => {
        if (!d) return 'mixedMulDiv: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!(d.n >= 6 && d.n <= 40)) return 'mixedMulDiv: n=' + d.n + ' is outside 6..40';
        if (!(d.m >= 2 && d.m <= 9)) return 'mixedMulDiv: m=' + d.m + ' is outside 2..9';
        if (!(d.k >= 2 && d.k <= 9)) return 'mixedMulDiv: k=' + d.k + ' is outside 2..9';
        if (mulRef(d.n, d.m) !== d.total) return 'mixedMulDiv: total is not n × m';
        if (!(d.total <= TOTAL_MAX_REF)) return 'mixedMulDiv: total ' + d.total + ' is above this lesson range';
        const q = divRef(d.total, d.k);
        if (!q || q.r !== 0) return 'mixedMulDiv: ' + d.total + ' ÷ ' + d.k + ' does not divide exactly';
        if (q.q !== d.val) return 'mixedMulDiv: val ' + d.val + ' but repeated subtraction gives ' + q.q;
        /* 規格，不可改壞測試：val ＝ total ÷ k 而 k ≥ 2，所以不可能相等。 */
        if (d.val === d.total) return 'mixedMulDiv: the first-step answer equals the final answer';
        const asPrinted = evalPrintedRef(d.n + ' × ' + d.m + ' ÷ ' + d.k);
        if (!fIsInt(asPrinted) || asPrinted.n !== d.val)
          return 'mixedMulDiv: the printed expression evaluates to ' + fVal(asPrinted) + ', not ' + d.val;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'mixedMulDiv: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.val) return 'mixedMulDiv: opts[ans] is not the computed value';
        for (const o of d.opts) if (!inRangeRef(o)) return 'mixedMulDiv: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.val && (o === d.n || o === d.m || o === d.k))
          return 'mixedMulDiv: distractor ' + o + ' is copied straight out of the stem';
      },
      wordChain: d => {
        if (!d) return 'wordChain: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!SCENES_REF[d.scene]) return 'wordChain: unknown scene ' + d.scene;
        if (!(d.a >= 2 && d.a <= 9)) return 'wordChain: a=' + d.a + ' is outside 2..9';
        if (!(d.b >= 2 && d.b <= 9)) return 'wordChain: b=' + d.b + ' is outside 2..9';
        if (!(d.c >= 2 && d.c <= 14)) return 'wordChain: c=' + d.c + ' is outside 2..14';
        if (mulRef(mulRef(d.a, d.b), d.c) !== d.t) return 'wordChain: t is not a × b × c';
        if (!(d.t <= TOTAL_MAX_REF)) return 'wordChain: total ' + d.t + ' is above this lesson range';
        if (d.a + d.b === d.a * d.b) return 'wordChain: a + b equals a × b, so the "added divisor" distractor is the answer';
        const r = chainVsOnceRef(d.t, d.a, d.b);
        if (!r.ok) return 'wordChain: ' + r.why;
        if (!r.exact) return 'wordChain: the story does not share out exactly';
        if (!r.agree) return 'wordChain: dividing twice gives ' + r.chain + ' but dividing by the product gives ' + r.once;
        if (r.chain !== d.c) return 'wordChain: c ' + d.c + ' but repeated subtraction gives ' + r.chain;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'wordChain: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.c) return 'wordChain: opts[ans] is not the computed quotient';
        for (const o of d.opts) if (!inRangeRef(o)) return 'wordChain: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.c && (o === d.t || o === d.a || o === d.b))
          return 'wordChain: distractor ' + o + ' is copied straight out of the stem';
      },
      wordOnce: d => {
        if (!d) return 'wordOnce: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!SCENES_REF[d.scene]) return 'wordOnce: unknown scene ' + d.scene;
        if (!(d.p >= 2 && d.p <= 9)) return 'wordOnce: p=' + d.p + ' is outside 2..9';
        if (!(d.b >= 2 && d.b <= 9)) return 'wordOnce: b=' + d.b + ' is outside 2..9';
        if (!(d.k >= 5 && d.k <= 30)) return 'wordOnce: k=' + d.k + ' is outside 5..30';
        if (mulRef(mulRef(d.p, d.b), d.k) !== d.t) return 'wordOnce: t is not p × b × k';
        if (!(d.t <= TOTAL_MAX_REF)) return 'wordOnce: total ' + d.t + ' is above this lesson range';
        if (d.p + d.b === d.p * d.b) return 'wordOnce: p + b equals p × b, so the "added divisor" distractor is the answer';
        const r = chainVsOnceRef(d.t, d.p, d.b);
        if (!r.ok) return 'wordOnce: ' + r.why;
        if (!r.exact) return 'wordOnce: the story does not pack exactly';
        if (!r.agree) return 'wordOnce: dividing twice gives ' + r.chain + ' but dividing by the product gives ' + r.once;
        if (r.chain !== d.k) return 'wordOnce: k ' + d.k + ' but repeated subtraction gives ' + r.chain;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'wordOnce: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.k) return 'wordOnce: opts[ans] is not the computed number of big containers';
        for (const o of d.opts) if (!inRangeRef(o)) return 'wordOnce: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.k && (o === d.t || o === d.p || o === d.b))
          return 'wordOnce: distractor ' + o + ' is copied straight out of the stem';
      },
      pickExpr: d => {
        if (!d) return 'pickExpr: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!SCENES_REF[d.scene]) return 'pickExpr: unknown scene ' + d.scene;
        if (mulRef(d.n, d.m) !== d.total) return 'pickExpr: total is not n × m';
        if (divRef(d.n, mulRef(d.m, d.k)).r !== 0)
          return 'pickExpr: n must be a multiple of m × k, or the two dividing distractors print a division with a remainder';
        if (!(d.total <= TOTAL_MAX_REF)) return 'pickExpr: total ' + d.total + ' is above this lesson range';
        const q = divRef(d.total, d.k);
        if (!q || q.r !== 0) return 'pickExpr: ' + d.total + ' ÷ ' + d.k + ' does not divide exactly';
        if (q.q !== d.val) return 'pickExpr: val ' + d.val + ' but repeated subtraction gives ' + q.q;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'pickExpr: options are not four distinct expressions';
        const right = d.n + ' × ' + d.m + ' ÷ ' + d.k;
        if (d.opts[d.ans] !== right) return 'pickExpr: opts[ans] is not the multiply-then-divide form: ' + d.opts[d.ans];
        const want = evalPrintedRef(right);
        if (!fIsInt(want) || want.n !== d.val) return 'pickExpr: the marked expression evaluates to ' + fVal(want) + ', not ' + d.val;
        for (let i = 0; i < d.opts.length; i++){
          const v = evalPrintedRef(d.opts[i]);
          if (!v) return 'pickExpr: option cannot be parsed: ' + d.opts[i];
          if (i !== d.ans && fEq(v, want)) return 'pickExpr: distractor ' + d.opts[i] + ' has the same value as the answer';
        }
      },
      interDigits: d => {
        if (!d) return 'interDigits: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!(d.D >= 12 && d.D <= 49)) return 'interDigits: D=' + d.D + ' is outside 12..49';
        if (mulRef(d.D, d.Q) !== d.t) return 'interDigits: t is not D × Q';
        if (!(d.t >= 100 && d.t <= TOTAL_MAX_REF)) return 'interDigits: the dividend ' + d.t + ' must have three digits';
        const q = divRef(d.t, d.D);
        if (!q || q.r !== 0) return 'interDigits: ' + d.t + ' ÷ ' + d.D + ' does not divide exactly';
        if (q.q !== d.Q) return 'interDigits: Q ' + d.Q + ' but repeated subtraction gives ' + q.q;
        if (String(q.q).length !== d.digits) return 'interDigits: digits ' + d.digits + ' but the quotient ' + q.q + ' has ' + String(q.q).length;
        if (!(d.digits === 1 || d.digits === 2)) return 'interDigits: this lesson only draws one- and two-digit quotients';
        /* 這一題教的規則：兩位數的商 ⟺ 前兩位就夠除。兩邊都要成立。 */
        const headTwo = divRef(d.t, 10).q;
        const twoDigit = (headTwo >= d.D);
        if (twoDigit !== (d.digits === 2))
          return 'interDigits: the taught rule fails — the first two digits are ' + headTwo + ' against divisor ' + d.D + ', but the quotient has ' + d.digits + ' digit(s)';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'interDigits: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.digits) return 'interDigits: opts[ans] is not the computed digit count';
        /* 位數的選項固定是 1~4：0 位數不存在，往外找的保底會生出它。 */
        if (d.opts.slice().sort().join(',') !== '1,2,3,4') return 'interDigits: options must be exactly 1, 2, 3 and 4, got ' + d.opts.join(',');
      },
      interOrder: d => {
        if (!d) return 'interOrder: make() returned nothing — every draw failed, so this generator has no domain left';
        if (!(d.x >= 2 && d.x <= 9)) return 'interOrder: x=' + d.x + ' is outside 2..9';
        if (!(d.y >= 3 && d.y <= 9)) return 'interOrder: y=' + d.y + ' is outside 3..9';
        if (!(d.z >= 5 && d.z <= 40)) return 'interOrder: z=' + d.z + ' is outside 5..40';
        if (mulRef(d.x, d.y) !== d.prod) return 'interOrder: prod is not x × y';
        if (d.z + d.prod !== d.val) return 'interOrder: val is not z + x × y';
        if (mulRef(d.z + d.x, d.y) !== d.sumFirst) return 'interOrder: sumFirst is not (z + x) × y';
        /* 規格，不可改壞測試：相等要 z ＝ z × y，而 y ≥ 3、z ≥ 5。 */
        if (d.val === d.sumFirst) return 'interOrder: adding first gives the same answer, so the question teaches nothing';
        /* 「先乘除後加減」也用讀回來的算式證明一次。 */
        const asPrinted = evalPrintedRef(d.z + ' ＋ ' + d.x + ' × ' + d.y);
        if (!fIsInt(asPrinted) || asPrinted.n !== d.val)
          return 'interOrder: the printed expression evaluates to ' + fVal(asPrinted) + ', not ' + d.val;
        const bracketed = evalPrintedRef('(' + d.z + ' ＋ ' + d.x + ') × ' + d.y);
        if (!fIsInt(bracketed) || bracketed.n !== d.sumFirst)
          return 'interOrder: the bracketed form the explanation quotes evaluates to ' + fVal(bracketed) + ', not ' + d.sumFirst;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'interOrder: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.val) return 'interOrder: opts[ans] is not the computed value';
        for (const o of d.opts) if (!inRangeRef(o)) return 'interOrder: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (o !== d.val && (o === d.x || o === d.y || o === d.z))
          return 'interOrder: distractor ' + o + ' is copied straight out of the stem';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數，
       完全不呼叫 review.html 的格式化函式。除法一律走 divRef（重複相減）。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'totalParts':   return String(mulRef(d.a, d.b));
        case 'chainValue':   return String(divRef(divRef(d.t, d.a).q, d.b).q);
        case 'sameExpr':     return d.t + ' ÷ (' + d.a + ' × ' + d.b + ')';
        case 'bracketFirst': return d.a + ' × ' + d.b;
        case 'leftToRight':  return String(mulRef(divRef(d.t, d.a).q, d.b));
        case 'splitDivisor': return d.t + ' ÷ ' + d.p + ' ÷ ' + d.r;
        case 'mixedMulDiv':  return String(divRef(mulRef(d.n, d.m), d.k).q);
        case 'wordChain':    return String(divRef(divRef(d.t, d.a).q, d.b).q);
        case 'wordOnce':     return String(divRef(divRef(d.t, d.p).q, d.b).q);
        case 'pickExpr':     return d.n + ' × ' + d.m + ' ÷ ' + d.k;
        case 'interDigits':  return String(String(divRef(d.t, d.D).q).length);
        case 'interOrder':   return String(d.z + mulRef(d.x, d.y));
        default: return null;
      }
    },

    /* 選項長什麼樣、範圍多少。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      const str = String(s);
      if (!str || !str.trim()) return 'empty option';
      if (/undefined|NaN|\[object|null|·|#/.test(str)) return 'option leaks an internal value: ' + str;
      if (/<[a-z]/i.test(str)) return 'option contains markup: ' + str;
      if (/[一-鿿]/.test(str)) return genId + ' option contains Chinese: ' + str;
      const EXPR_GENS = ['sameExpr', 'bracketFirst', 'splitDivisor', 'pickExpr'];
      if (EXPR_GENS.indexOf(genId) >= 0){
        /* 算式選項只准由數字、空白、÷ × ＋ + 和括號組成 —— 別的字元一律拒絕。 */
        if (!/^[0-9 ()×÷＋+]+$/.test(str)) return genId + ' expression option has an unexpected character: ' + str;
        const v = evalPrintedRef(str);
        if (!v) return genId + ' expression option cannot be evaluated: ' + str;
        /* ⚠️ 不可以只在「剛好是整數」時才驗範圍：`1 ÷ 3` 會整條溜過去，
           而這一課明講每一個孩子看到的數都是整數。（codex 第一輪） */
        if (!fIsInt(v)) return genId + ' expression option ' + str + ' does not work out to a whole number (' + fVal(v) + ')';
        if (!inRangeRef(v.n)) return genId + ' expression option ' + str + ' works out to ' + v.n + ', outside 0..' + VAL_MAX_REF;
        return null;
      }
      if (!/^\d+$/.test(str)) return genId + ' option is not a plain whole number: ' + str;
      const n = Number(str);
      if (!inRangeRef(n)) return genId + ' option ' + n + " is outside this lesson's 0.." + VAL_MAX_REF;
      if (genId === 'interDigits' && !(n >= 1 && n <= 6)) return 'interDigits option ' + n + ' is not a plausible digit count';
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：題幹逐字重建、解釋裡的每一條算式、
       以及畫面上真正看得到的字。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('not four options');
      if (new Set(q.opts.map(String)).size !== q.opts.length) out.push('two options render to the same text');

      /* 題幹逐字重建：多一個字少一個字都對不上。 */
      const want = stemRef(d, genId, lang);
      if (want === null) out.push('no stem oracle for ' + genId);
      else if (want !== q.stem) out.push('stem does not match the oracle\n    page: ' + q.stem + '\n    want: ' + want);

      /* 純數字選項的**值**也要兩兩不同（"4" 和 "04" 是兩個字串、一個答案）。 */
      const nums = q.opts.map(String).filter(x => /^\d+$/.test(x)).map(Number);
      if (new Set(nums).size !== nums.length) out.push('two options have the same numeric value');

      /* 解釋與題幹裡的每一條算式逐條驗算，並釘住「驗過幾條」。 */
      const rs = arithProblems(q.stem);
      const rw = arithProblems(q.why);
      rs.problems.forEach(p => out.push('stem arithmetic: ' + p));
      rw.problems.forEach(p => out.push('why arithmetic: ' + p));
      const need = ARITH_MIN[genId];
      if (typeof need !== 'number') out.push('no arithmetic coverage floor defined for ' + genId);
      else if (rw.verified < need) out.push('why verified only ' + rw.verified + ' equations, expected at least ' + need);

      /* 每一個選項印出來的除法都要除得剛剛好（誘答也算）。 */
      q.opts.forEach((o, i) => inexactDivisions(String(o)).forEach(p => out.push('option ' + i + ': ' + p)));

      textProblems(q.stem, lang, 'stem').forEach(p => out.push(p));
      textProblems(q.why, lang, 'why').forEach(p => out.push(p));
      q.opts.forEach((o, i) => textProblems(String(o), lang, 'option ' + i).forEach(p => out.push(p)));

      return out.length ? out.join('; ') : null;
    },

    /* 這一課沒有任何刻意把題幹數字放進選項的迷思誘答 —— 一律不放行。 */
    stemEchoOk: false
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{S1_CASES, S1_STEPS, S2_STEPS, perBox, bagTotal, perBag, ' +
                'FIG_W, FIG_H, DOT_R, DOT_DX, DOT_DY, DOT_COLS, BAG_PAD, BAG_GAP, BOX_PAD, BOX_GAP, ' +
                'PILE_COLS, PILE_DX, PILE_DY, dotRows, bagSize, boxSize, dotAt, packPlan, ' +
                'EXPR_KEYS, exprText, exprValue, S3_T, S3_A, S3_B, S3_QKEYS, S3_ANSWERS, ' +
                'S4_CASES, S4_STEPS, opText, stepValues, partialExpr, fullExpr, exprAnswer, ' +
                'S5_T, S5_D, S5_SPLITS, splitSteps, ROUNDS, roundValue, roundAnswerIndex, roundOptCount, plEn}',
    optionValueMax: VAL_MAX_REF,

    check: function(data, I18N, fail, src){
      const dir = path.dirname(process.argv[2] || '.');
      /* ⚠️ 一定要用 process.argv[2] 推出資料夾，不可以用 __dirname：
         breaktest.js 是把四頁複製到暫存目錄再跑檢查的，用 __dirname 會讀到真的 repo，
         針對 reference／review／parents 的斷言就永遠是綠的。 */
      const page = {};
      ['index', 'reference', 'review', 'parents'].forEach(name => {
        const f = path.join(dir, name + '.html');
        /* ⚠️ 先把 HTML 註解**和 JS 的區塊註解**都拿掉（換成換行，不是空字串 ——
           換成空字串的話註解前後的字會接起來，生出原始碼裡不存在的匹配）。
           不拿掉的話「把規則從畫面上拿掉、貼進一個註解」出現次數不變就過關了 ——
           而 review.html 的那一條原本就是這樣：五次「除得剛剛好」全部在 JS 註解裡，
           那條規則釘住的是我自己的註解，不是孩子看得到的字。（2026-09-07 codex 第一輪）
           ⚠️ 行註解也要拿掉，可是不能一律砍掉 `//`（網址裡就有）：只砍
           「行首」或「空白後面」的 `//`，這樣 `http://` 和 `href="//host"` 都留得住。
           （2026-09-07 codex 第二輪：`// 從左往右` 一行就能補上被拿掉的那一次計數。）
           ⚠️ 說清楚極限：這是**字面處理**，不是 JS 詞法分析 —— 字串常數裡剛好有
           ` //` 的話會被誤砍，這一課沒有那種字串。 */
        page[name] = fs.existsSync(f)
          ? fs.readFileSync(f, 'utf8')
              .replace(/<!--[\s\S]*?-->/g, '\n')
              .replace(/\/\*[\s\S]*?\*\//g, '\n')
              .replace(/(^|[ \t;{}()])\/\/[^\n]*/g, '$1\n')
          : null;
        if (page[name] === null) fail('cannot read ' + name + '.html next to the lesson page');
      });

      /* ---------- 跨頁用詞 ---------- */
      SIBLING_RULES.forEach(r => {
        const s = page[r.file];
        if (s === null) return;
        const n = s.split(r.text).length - 1;
        if (n !== r.min) fail('SIBLING ' + r.file + ': "' + r.text + '" appears ' + n + ' time(s), expected exactly ' + r.min + ' — it ' + r.why);
      });
      FORBIDDEN.forEach(r => {
        ['index', 'reference', 'review', 'parents'].forEach(name => {
          const s = page[name];
          if (s === null) return;
          if (s.indexOf(r.text) >= 0) fail('FORBIDDEN ' + name + ': "' + r.text + '" must never appear — ' + r.why);
        });
      });

      /* ---------- 產生器清單與取樣空間 ---------- */
      if (page.review !== null){
        /* ⚠️ 產生器清單要**跑起來**再比，不是掃字串：一段死掉的
           `var decoy = "id:'mixedMulDiv', cat:'order'";` 就能滿足字串掃描，
           而真正的產生器已經被刪掉或改名了。（codex 第一輪）
           做法和 tools/simgen.js 一樣：把「工具」到「出一批」之間那一段切出來執行。 */
        const rawReview = fs.readFileSync(path.join(dir, 'review.html'), 'utf8');
        const bStart = rawReview.indexOf('/* ---------- 工具 ---------- */');
        const bEnd = rawReview.indexOf('/* ---------- 出一批');
        if (bStart < 0 || bEnd < 0 || bStart > bEnd) fail('cannot locate the generator block markers in review.html');
        else {
          let ids = null;
          try {
            ids = new Function(rawReview.slice(bStart, bEnd) + '\n; return GENS.map(function(g){ return g.id; });')();
          } catch (e){
            fail('review.html\'s generator block does not execute: ' + e.message);
          }
          /* ⚠️ 這裡只執行到「出一批」那個標記為止，所以標記**後面**改 GENS
             （`GENS[0].id = 'x';`）它看不到 —— 用一條字面掃描把那種寫法擋掉，
             並說清楚它是字面掃描。（2026-09-07 codex 第二輪） */
          const after = rawReview.slice(bEnd);
          /* ⚠️ 列舉「怎麼改」擋不完（`var g = (GENS); g[0].id = …`、`mutate(GENS)`），
             而且會誤擋正當的讀取（`GENS.length`）。改成**保守白名單**：
             標記後面只准出現 `shuffle(GENS)` 這一種用法，其餘任何一個 GENS 都判失敗。
             （2026-09-07 codex 第四輪自己建議的做法。） */
          const genUses = (after.match(/\bGENS\b/g) || []).length;
          const allowed = (after.match(/shuffle\(GENS\)/g) || []).length;
          if (genUses !== allowed)
            fail('review.html mentions GENS after the generator block in a way other than shuffle(GENS) (' +
                 genUses + ' mentions, ' + allowed + ' allowed); the checker only executes the block itself');
          if (ids){
            if (ids.join(',') !== GEN_IDS.join(','))
              fail('review.html really defines [' + ids.join(', ') + '] but GEN_IDS lists [' + GEN_IDS.join(', ') + ']');
            if (new Set(ids).size !== ids.length) fail('review.html defines two generators with the same id');
          }
        }
        REVIEW_PINS.forEach(p => {
          const n = page.review.split(p.text).length - 1;
          const min = p.min || 1;
          if (n < min) fail('PIN "' + p.text + '" appears ' + n + ' time(s), expected at least ' + min + ' — ' + p.why);
        });
      }

      /* ---------- 畫圖的接線（字面掃描，見 INDEX_PINS 的註解） ---------- */
      /* ⚠️ 掃的是**拿掉註解之後**的原始碼，而且要求**剛好一次**：不然把活的那一行改壞、
         再把原文貼進一段註解裡，字面掃描照樣找得到（2026-09-07 codex 第三輪）。
         ⚠️⚠️ 這個註解剝除器的**邊界要說清楚**：它是字面處理，不是 JavaScript 詞法分析。
         `//` 只在行首或 `space tab ; { } ( )` 後面才算註解開頭，所以
         `var x = 0,// …pinned line…` 這種「逗號後面的行註解」它看不到，
         被註解掉的那一行仍然算一次（codex 第四輪指出）。要真正堵住得換成 JS 詞法分析器，
         那超出這一條守衛值得的成本 —— **真正在看畫面的是瀏覽器 sweep 與收工前的接觸表截圖**，
         這幾條字面釘樁只證明「接線沒有被順手改掉」。 */
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n')
                         .replace(/\/\*[\s\S]*?\*\//g, '\n')
                         .replace(/(^|[ \t;{}()])\/\/[^\n]*/g, '$1\n');
      INDEX_PINS.forEach(p => {
        const n = liveSrc.split(p.text).length - 1;
        if (n !== 1) fail('INDEX PIN "' + p.text + '" appears ' + n + ' time(s) in live code, expected exactly 1 — ' + p.why);
      });

      /* ---------- 畫布：viewBox 和 CSS 的長寬比要一樣 ----------
         ⚠️ 不一樣的話瀏覽器會把整張圖等比縮小再置中，圖就無聲地變小了（issue #5）。 */
      /* ⚠️ 掃的是**拿掉 HTML 註解之後**的原始碼，而且要求 `.packfig` 規則
         **剛好只有一條** —— 不然一條註解裡的假規則、或後面一條覆蓋掉前面的規則，
         就能讓這個檢查看到對的數字而畫面上是錯的。（codex 第一輪）
         ⚠️ 同理，viewBox 的數量必須等於 `class="packfig"` 的 <svg> 數量，
         否則多塞兩個假的 viewBox 字串就能滿足「至少兩個」。 */
      /* ⚠️ 掃的是拿掉 HTML 註解之後的原始碼，而且要求**任何提到 packfig 的 CSS 規則**
         剛好只有一條 —— 只數 `.packfig{` 的話，一條 `svg.packfig{height:250px}`
         會在瀏覽器裡勝出而檢查看不到它；`.packfig {` 多一個空白也要讀得到。
         viewBox 只從**每一個 packfig 的 <svg> 標籤自己**讀，不數整頁的
         （不然一個 24×24 的 icon 就會讓數量對不上）。（2026-09-07 codex 第二輪） */
      const cleanSrc = src.replace(/<!--[\s\S]*?-->/g, '\n');
      const cssRules = (cleanSrc.match(/[^{}]*\{[^{}]*\}/g) || []).filter(r => /packfig/.test(r.split('{')[0]));
      if (cssRules.length !== 1) fail('index.html has ' + cssRules.length + ' style rules whose selector mentions packfig, expected exactly 1');
      const cssBox = cssRules.length === 1
        ? /max-width:\s*(\d+)px[^}]*height:\s*(\d+)px/.exec(cssRules[0])
        : null;
      if (!cssBox) fail('cannot read the .packfig width/height out of the stylesheet');
      /* ⚠️ 同一條規則裡宣告兩次 height 的話，瀏覽器用**最後**那一個而正規式讀到第一個
         （`height:150px;height:250px`）。所以每一個屬性只准出現一次。（codex 第三輪） */
      /* ⚠️ CSS 的屬性名可以用逃逸寫（`he\\69 ght:250px` 就是 height），逐字數就數不到。
         這裡直接**擋掉規則裡的反斜線** —— 這一課的樣式從來不需要它。（codex 第四輪） */
      if (cssRules.length === 1 && cssRules[0].indexOf('\\') >= 0)
        fail('the .packfig rule contains a backslash escape; CSS would resolve it to another property name');
      if (cssRules.length === 1){
        ['max-width', 'height', 'width'].forEach(prop => {
          const n = (cssRules[0].match(new RegExp('(^|[;{\\s])' + prop + '\\s*:', 'g')) || []).length;
          if (n !== 1) fail('the .packfig rule declares ' + prop + ' ' + n + ' time(s); the browser would use the last one');
        });
      }
      const figTags = cleanSrc.match(/<svg[^>]*class="packfig"[^>]*>/g) || [];
      if (figTags.length !== 2) fail('expected exactly two .packfig canvases in index.html, found ' + figTags.length);
      figTags.forEach((tag, i) => {
        if (/\sstyle\s*=/.test(tag)) fail('.packfig canvas ' + i + ' carries an inline style, which could override the stylesheet');
        const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(tag);
        if (!vb){ fail('.packfig canvas ' + i + ' has no readable viewBox'); return; }
        const vw = Number(vb[1]), vh = Number(vb[2]);
        if (vw !== FIG_REF.W || vh !== FIG_REF.H)
          fail('.packfig canvas ' + i + ' has viewBox ' + vw + '×' + vh + ' but this lesson draws in ' + FIG_REF.W + '×' + FIG_REF.H);
        if (cssBox && vw * Number(cssBox[2]) !== vh * Number(cssBox[1]))
          fail('viewBox ' + vw + '×' + vh + ' does not match the CSS box ' + cssBox[1] + '×' + cssBox[2] + ' — the browser would shrink the whole figure');
      });
      if (data.FIG_W !== FIG_REF.W || data.FIG_H !== FIG_REF.H)
        fail('the page draws in ' + data.FIG_W + '×' + data.FIG_H + ' but this checker\'s spec is ' + FIG_REF.W + '×' + FIG_REF.H);

      /* ---------- 每一個案例：整除、圖、旁白 ---------- */
      if (!Array.isArray(data.S1_CASES) || data.S1_CASES.length < 3) fail('S1_CASES must offer at least three loads');
      const seenIds = {};
      data.S1_CASES.forEach((cs, ci) => {
        const tag = 'case ' + (cs && cs.id ? cs.id : ci);
        if (!cs || typeof cs.t !== 'number' || typeof cs.a !== 'number' || typeof cs.b !== 'number'){
          fail(tag + ': shape is broken (t/a/b must all be numbers)');
          return;
        }
        if (seenIds[cs.id]) fail(tag + ': duplicate case id');
        seenIds[cs.id] = 1;
        if (!(cs.a >= 2)) fail(tag + ': one big box teaches nothing about dividing twice');
        if (!(cs.b >= 2)) fail(tag + ': one small bag per box teaches nothing about dividing twice');
        if (cs.a + cs.b === cs.a * cs.b) fail(tag + ': a + b equals a × b, so "multiplied, not added" cannot be shown');

        /* 規則本身：兩邊各用一次減法迴圈算，必須整除而且相等。 */
        const r = chainVsOnceRef(cs.t, cs.a, cs.b);
        if (!r.ok){ fail(tag + ': ' + r.why); return; }
        if (!r.exact) fail(tag + ': ' + cs.t + ' ÷ ' + cs.a + ' ÷ ' + cs.b + ' leaves a remainder, so this lesson\'s rule does not hold for it');
        if (!r.agree) fail(tag + ': dividing twice gives ' + r.chain + ' but dividing by the product gives ' + r.once);
        if (data.perBag(cs) !== r.chain) fail(tag + ': perBag() says ' + data.perBag(cs) + ' but repeated subtraction gives ' + r.chain);
        if (data.perBox(cs) !== divRef(cs.t, cs.a).q) fail(tag + ': perBox() disagrees with repeated subtraction');
        if (data.bagTotal(cs) !== r.prod) fail(tag + ': bagTotal() says ' + data.bagTotal(cs) + ' but repeated addition gives ' + r.prod);
        if (!(data.perBag(cs) >= 2)) fail(tag + ': one item per bag makes the last division invisible');

        for (let step = 0; step <= 2; step++){
          const plan = data.packPlan(cs, step);
          const stag = tag + ' step ' + step;
          if (!plan || !Array.isArray(plan.rects) || !Array.isArray(plan.dots)){
            fail(stag + ': packPlan returned a broken shape');
            continue;
          }
          /* 回傳值自己報的畫布與步數也要對 —— 沒驗的話它可以報任何數字。（codex 第一輪） */
          if (plan.w !== FIG_REF.W || plan.h !== FIG_REF.H)
            fail(stag + ': packPlan reports a ' + plan.w + '×' + plan.h + ' canvas, expected ' + FIG_REF.W + '×' + FIG_REF.H);
          if (plan.step !== (step === 0 ? 0 : step))
            fail(stag + ': packPlan reports step ' + plan.step);
          /* --- 安全性質先驗（它們必須是第一個響的）：畫布的四個邊、袋子在箱子裡、
                 箱子互不重疊、每一袋剛好幾個點。 --- */
          let bad = false;
          for (let i = 0; i < plan.dots.length; i++){
            const p = plan.dots[i];
            if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)){ fail(stag + ': dot ' + i + ' has no readable position'); bad = true; break; }
            if (p.x - FIG_REF.DOT_R < 0 || p.y - FIG_REF.DOT_R < 0 ||
                p.x + FIG_REF.DOT_R > FIG_REF.W || p.y + FIG_REF.DOT_R > FIG_REF.H){
              fail(stag + ': dot ' + i + ' at (' + p.x + ', ' + p.y + ') falls outside the canvas'); bad = true; break;
            }
          }
          for (let i = 0; i < plan.rects.length && !bad; i++){
            const rc = plan.rects[i];
            if (!rc || !Number.isFinite(rc.x) || !Number.isFinite(rc.y) || !(rc.w > 0) || !(rc.h > 0)){
              fail(stag + ': rect ' + i + ' has no readable box'); bad = true; break;
            }
            if (rc.x < 0 || rc.y < 0 || rc.x + rc.w > FIG_REF.W || rc.y + rc.h > FIG_REF.H){
              fail(stag + ': rect ' + i + ' (' + rc.kind + ') runs off the canvas'); bad = true; break;
            }
          }
          if (bad) continue;
          if (plan.dots.length !== cs.t) fail(stag + ': the figure draws ' + plan.dots.length + ' dots but the load is ' + cs.t);
          const boxes = plan.rects.filter(rc => rc.kind === 'box');
          const bags = plan.rects.filter(rc => rc.kind === 'bag');
          const wantBoxes = step === 0 ? 0 : cs.a;
          const wantBags = step >= 2 ? cs.a * cs.b : 0;
          if (boxes.length !== wantBoxes) fail(stag + ': ' + boxes.length + ' big boxes drawn, expected ' + wantBoxes);
          if (bags.length !== wantBags) fail(stag + ': ' + bags.length + ' small bags drawn, expected ' + wantBags);
          /* 箱子互不重疊（相鄰的箱子中間要真的有縫）。 */
          const xs = boxes.slice().sort((p, q2) => p.x - q2.x);
          for (let i = 1; i < xs.length; i++){
            if (xs[i].x < xs[i - 1].x + xs[i - 1].w)
              fail(stag + ': two big boxes overlap');
          }
          /* 每一個袋子都在某一個箱子裡面，而且剛好裝著 perBag 個點。 */
          bags.forEach((bg, bi) => {
            const host = boxes.filter(bx => bg.x >= bx.x && bg.y >= bx.y &&
                                            bg.x + bg.w <= bx.x + bx.w && bg.y + bg.h <= bx.y + bx.h);
            if (host.length !== 1) fail(stag + ': bag ' + bi + ' is not inside exactly one big box');
            const inside = plan.dots.filter(p => p.x >= bg.x && p.x <= bg.x + bg.w && p.y >= bg.y && p.y <= bg.y + bg.h);
            if (inside.length !== data.perBag(cs))
              fail(stag + ': bag ' + bi + ' holds ' + inside.length + ' dots, expected ' + data.perBag(cs));
          });
          /* --- 宣告式的性質：間距一致與居中。這幾條不重跑 packPlan 的控制流，
                 所以「兩邊照同一個錯誤觀念寫」的情形它們還抓得到。 --- */
          if (step >= 1 && boxes.length >= 2){
            const gaps = [];
            for (let i = 1; i < xs.length; i++) gaps.push(xs[i].x - (xs[i - 1].x + xs[i - 1].w));
            if (new Set(gaps.map(g => Math.round(g * 1000))).size !== 1)
              fail(stag + ': the gaps between big boxes are not all equal (' + gaps.join(', ') + ')');
            if (Math.abs(gaps[0] - FIG_REF.BOX_GAP) > 1e-9)
              fail(stag + ': the gap between big boxes is ' + gaps[0] + ', expected ' + FIG_REF.BOX_GAP);
          }
          if (step >= 2 && bags.length >= 2){
            const inBox = bags.filter(bg => bg.x >= xs[0].x && bg.x + bg.w <= xs[0].x + xs[0].w)
                              .sort((p, q2) => p.x - q2.x);
            for (let i = 1; i < inBox.length; i++){
              const g = inBox[i].x - (inBox[i - 1].x + inBox[i - 1].w);
              if (Math.abs(g - FIG_REF.BAG_GAP) > 1e-9)
                fail(stag + ': the gap between small bags is ' + g + ', expected ' + FIG_REF.BAG_GAP);
            }
          }
          /* 整組內容要在畫布上**居中**（左右留白一樣、上下留白一樣）。 */
          const allX = plan.dots.map(p => p.x).concat(plan.rects.map(r => r.x), plan.rects.map(r => r.x + r.w));
          const allY = plan.dots.map(p => p.y).concat(plan.rects.map(r => r.y), plan.rects.map(r => r.y + r.h));
          const pad = plan.rects.length ? 0 : FIG_REF.DOT_R;
          const left = Math.min.apply(null, allX) - pad, right = FIG_REF.W - (Math.max.apply(null, allX) + pad);
          const top = Math.min.apply(null, allY) - pad, bot = FIG_REF.H - (Math.max.apply(null, allY) + pad);
          if (Math.abs(left - right) > 1e-6) fail(stag + ': the figure is not centred horizontally (' + left + ' vs ' + right + ')');
          if (Math.abs(top - bot) > 1e-6) fail(stag + ': the figure is not centred vertically (' + top + ' vs ' + bot + ')');

          /* --- 然後才比「等於黃金實作」：設定檔自己重算一份座標，逐一比對。 --- */
          const ref = packRef(cs.t, cs.a, cs.b, step);
          if (ref.dots.length !== plan.dots.length) fail(stag + ': the reference layout draws ' + ref.dots.length + ' dots, the page ' + plan.dots.length);
          else for (let i = 0; i < ref.dots.length; i++){
            if (Math.abs(ref.dots[i].x - plan.dots[i].x) > 1e-9 || Math.abs(ref.dots[i].y - plan.dots[i].y) > 1e-9){
              fail(stag + ': dot ' + i + ' is at (' + plan.dots[i].x + ', ' + plan.dots[i].y + ') but the reference layout puts it at (' + ref.dots[i].x + ', ' + ref.dots[i].y + ')');
              break;
            }
          }
          if (ref.rects.length !== plan.rects.length) fail(stag + ': the reference layout draws ' + ref.rects.length + ' rects, the page ' + plan.rects.length);
          else for (let i = 0; i < ref.rects.length; i++){
            const A = ref.rects[i], B = plan.rects[i];
            if (A.kind !== B.kind || Math.abs(A.x - B.x) > 1e-9 || Math.abs(A.y - B.y) > 1e-9 ||
                Math.abs(A.w - B.w) > 1e-9 || Math.abs(A.h - B.h) > 1e-9){
              fail(stag + ': rect ' + i + ' does not match the reference layout (' + B.kind + ' at ' + B.x + ',' + B.y + ' ' + B.w + '×' + B.h +
                   ' vs ' + A.kind + ' at ' + A.x + ',' + A.y + ' ' + A.w + '×' + A.h + ')');
              break;
            }
          }
        }
      });

      /* ---------- 三個算式：印出來的字串、它的值、以及「它在回答哪一個問題」 ---------- */
      const S3 = { t:data.S3_T, a:data.S3_A, b:data.S3_B };
      if (data.EXPR_KEYS.join(',') !== 'chain,once,left') fail('EXPR_KEYS changed shape: ' + data.EXPR_KEYS.join(','));
      const s3chain = chainVsOnceRef(S3.t, S3.a, S3.b);
      if (!s3chain.ok || !s3chain.exact || !s3chain.agree) fail('the example-3 numbers do not divide exactly both ways');
      const bagAns = s3chain.chain;                                   /* 一個小袋幾個 */
      const boxAns = mulRef(divRef(S3.t, S3.a).q, S3.b);              /* 拿 b 個大箱走一共幾個 */
      if (bagAns === boxAns) fail('example 3 needs the two questions to have different answers, both are ' + bagAns);
      const s3vals = {};
      data.EXPR_KEYS.forEach(key => {
        const text = data.exprText(key, S3.t, S3.a, S3.b);
        const shown = data.exprValue(key, S3.t, S3.a, S3.b);
        const read = evalPrintedRef(text);
        if (!read){ fail('example 3: cannot read the printed expression "' + text + '"'); return; }
        if (!fIsInt(read)) fail('example 3: "' + text + '" does not come out whole (' + fVal(read) + ')');
        if (read.n !== shown) fail('example 3: "' + text + '" reads as ' + fVal(read) + ' but the page prints ' + shown);
        s3vals[key] = shown;
      });
      if (s3vals.chain !== bagAns) fail('example 3: the chained form should answer ' + bagAns + ', got ' + s3vals.chain);
      if (s3vals.once !== bagAns) fail('example 3: the bracketed form should answer ' + bagAns + ', got ' + s3vals.once);
      if (s3vals.left !== boxAns) fail('example 3: the no-bracket form should answer ' + boxAns + ', got ' + s3vals.left);
      /* 「哪一個算式在回答這個問題」必須由**值**推出來，不可以是一張寫死的表。
         期望值用設定檔自己算的 bagAns／boxAns，不是頁面的。 */
      const wantAnswers = {
        bag:data.EXPR_KEYS.filter(k => s3vals[k] === bagAns),
        box:data.EXPR_KEYS.filter(k => s3vals[k] === boxAns)
      };
      if (data.S3_QKEYS.join(',') !== 'bag,box') fail('S3_QKEYS changed shape: ' + data.S3_QKEYS.join(','));
      data.S3_QKEYS.forEach(qk => {
        const got = (data.S3_ANSWERS[qk] || []).slice().sort().join(',');
        const wnt = wantAnswers[qk].slice().sort().join(',');
        if (got !== wnt) fail('S3_ANSWERS.' + qk + ' highlights [' + got + '] but the values say [' + wnt + ']');
      });

      /* ---------- 範例 4：從左往右一步一步收合，值不可以改變 ---------- */
      if (!Array.isArray(data.S4_CASES) || data.S4_CASES.length < 2) fail('S4_CASES must show at least two expressions');
      const seenOps = {};
      data.S4_CASES.forEach(cs => {
        const tag = 'example 4 ' + (cs && cs.id ? cs.id : '?');
        if (!cs || !Array.isArray(cs.ops) || cs.ops.length !== 2){ fail(tag + ': every expression must have exactly two steps'); return; }
        const kinds = cs.ops.map(o => o[0]).join('');
        if (!/^[*/]{2}$/.test(kinds)) fail(tag + ': this lesson only shows × and ÷ (' + kinds + ')');
        if (seenOps[kinds]) fail(tag + ': the same pair of operations is shown twice (' + kinds + ')');
        seenOps[kinds] = 1;
        const vals = data.stepValues(cs);
        if (vals.length !== 3) fail(tag + ': stepValues must give the head plus one value per step');
        const answer = data.exprAnswer(cs);
        if (answer !== vals[vals.length - 1]) fail(tag + ': exprAnswer disagrees with stepValues');
        if (!Number.isInteger(answer) || !(answer >= 0 && answer <= VAL_MAX_REF)) fail(tag + ': the answer ' + answer + ' is not a whole number in range');
        /* 每一步收合之後印出來的算式，**值必須還是同一個** —— 收合不會改變意思。 */
        for (let k = 0; k <= 2; k++){
          const text = data.partialExpr(cs, k);
          const read = evalPrintedRef(text);
          if (!read){ fail(tag + ': cannot read the printed expression "' + text + '"'); continue; }
          if (!fIsInt(read) || read.n !== answer)
            fail(tag + ': after ' + k + ' step(s) the printed expression "' + text + '" reads as ' + fVal(read) + ', not ' + answer);
        }
        if (data.fullExpr(cs) !== data.partialExpr(cs, 0)) fail(tag + ': fullExpr and partialExpr(0) disagree');
        /* 每一步都要整除（除法那幾步），不然這一課的前提就破了。 */
        for (let i = 0; i < cs.ops.length; i++){
          if (cs.ops[i][0] === '/'){
            const q = divRef(vals[i], cs.ops[i][1]);
            if (!q || q.r !== 0) fail(tag + ': step ' + (i + 1) + ' (' + vals[i] + ' ÷ ' + cs.ops[i][1] + ') does not divide exactly');
            else if (q.q !== vals[i + 1]) fail(tag + ': step ' + (i + 1) + ' gives ' + vals[i + 1] + ' but repeated subtraction gives ' + q.q);
          } else {
            if (mulRef(vals[i], cs.ops[i][1]) !== vals[i + 1]) fail(tag + ': step ' + (i + 1) + ' disagrees with repeated addition');
          }
        }
      });

      /* ---------- 範例 5：拆除數 ---------- */
      if (!Array.isArray(data.S5_SPLITS) || data.S5_SPLITS.length < 3) fail('S5_SPLITS must offer at least three splits');
      const refPairs = factorPairsRef(data.S5_D).map(p => p.join('x'));
      const endVals = [];
      data.S5_SPLITS.forEach(pair => {
        const tag = 'example 5 split ' + pair.join('×');
        if (!Array.isArray(pair) || pair.length !== 2){ fail(tag + ': a split must be exactly two numbers'); return; }
        if (!(pair[0] >= 2 && pair[1] >= 2)) fail(tag + ': dividing by 1 is not a split');
        if (mulRef(pair[0], pair[1]) !== data.S5_D) fail(tag + ': does not multiply back to the divisor ' + data.S5_D);
        if (refPairs.indexOf(pair.join('x')) < 0) fail(tag + ': is not in the enumerated factor pairs of ' + data.S5_D);
        const st = data.splitSteps(pair);
        if (st.t !== data.S5_T || st.d !== data.S5_D) fail(tag + ': splitSteps must carry the lesson\'s own total and divisor');
        const q1 = divRef(data.S5_T, pair[0]);
        if (!q1 || q1.r !== 0) fail(tag + ': the first division leaves a remainder');
        else {
          if (q1.q !== st.mid) fail(tag + ': mid ' + st.mid + ' but repeated subtraction gives ' + q1.q);
          const q2 = divRef(q1.q, pair[1]);
          if (!q2 || q2.r !== 0) fail(tag + ': the second division leaves a remainder');
          else if (q2.q !== st.end) fail(tag + ': end ' + st.end + ' but repeated subtraction gives ' + q2.q);
        }
        endVals.push(st.end);
        const read = evalPrintedRef(data.S5_T + ' ÷ ' + pair[0] + ' ÷ ' + pair[1]);
        if (!read || !fIsInt(read) || read.n !== st.end) fail(tag + ': the printed split does not read back as ' + st.end);
      });
      const direct = divRef(data.S5_T, data.S5_D);
      if (!direct || direct.r !== 0) fail('example 5: ' + data.S5_T + ' ÷ ' + data.S5_D + ' must divide exactly');
      else if (new Set(endVals.concat([direct.q])).size !== 1)
        fail('example 5: the splits give ' + endVals.join('/') + ' but dividing directly gives ' + direct.q);

      /* ---------- 小遊戲的五關 ---------- */
      if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== 5) fail('the game must have exactly five rounds');
      const kinds = {};
      data.ROUNDS.forEach((r, ri) => {
        const tag = 'round ' + (ri + 1) + ' (' + (r && r.kind) + ')';
        if (!r || !r.kind){ fail(tag + ': broken round'); return; }
        if (kinds[r.kind]) fail(tag + ': the same kind of round appears twice');
        kinds[r.kind] = 1;
        const n = data.roundOptCount(r);
        if (n !== 4) fail(tag + ': ' + n + ' options, expected 4');
        const at = data.roundAnswerIndex(r);
        if (at !== r.ans) fail(tag + ': ans says ' + r.ans + ' but the computed answer is at ' + at);
        if (!(at >= 0 && at < n)) fail(tag + ': the computed answer is not one of the options');
        if (r.kind === 'split'){
          const wanted = r.pairs.filter(p => mulRef(p[0], p[1]) === r.d);
          if (wanted.length !== 1) fail(tag + ': exactly one split must multiply back to ' + r.d + ', found ' + wanted.length);
          const chain = chainVsOnceRef(r.t, r.pairs[at][0], r.pairs[at][1]);
          if (!chain.ok || !chain.exact) fail(tag + ': the correct split does not divide exactly');
          const texts = [];
          for (let i = 0; i < n; i++){
            const txt = r.t + ' ÷ ' + r.pairs[i][0] + ' ÷ ' + r.pairs[i][1];
            texts.push(txt);
            if (!evalPrintedRef(txt)) fail(tag + ': option ' + i + ' cannot be read back');
          }
          if (new Set(texts).size !== n) fail(tag + ': two options print the same expression');
        } else {
          const want = data.roundValue(r);
          let ref = null;
          if (r.kind === 'total') ref = mulRef(r.a, r.b);
          if (r.kind === 'chain') ref = divRef(divRef(r.t, r.a).q, r.b).q;
          if (r.kind === 'once')  ref = divRef(r.t, mulRef(r.a, r.b)).q;
          if (r.kind === 'left')  ref = mulRef(divRef(r.t, r.a).q, r.b);
          if (ref === null) fail(tag + ': no reference implementation for this kind of round');
          else if (ref !== want) fail(tag + ': roundValue gives ' + want + ' but the reference gives ' + ref);
          if (r.opts[r.ans] !== ref) fail(tag + ': the option marked correct is not the computed answer');
          if (new Set(r.opts).size !== r.opts.length) fail(tag + ': two options have the same value');
          r.opts.forEach(o => { if (!inRangeRef(o)) fail(tag + ': option ' + o + ' is outside 0..' + VAL_MAX_REF); });
          if (r.kind === 'chain' || r.kind === 'once'){
            const c2 = chainVsOnceRef(r.t, r.a, r.b);
            if (!c2.ok || !c2.exact || !c2.agree) fail(tag + ': the round does not divide exactly both ways');
          }
          if (r.kind === 'left'){
            const asPrinted = evalPrintedRef(r.t + ' ÷ ' + r.a + ' × ' + r.b);
            if (!asPrinted || !fIsInt(asPrinted) || asPrinted.n !== ref) fail(tag + ': the printed expression does not read back as ' + ref);
          }
          if (r.kind === 'once'){
            const asPrinted = evalPrintedRef(r.t + ' ÷ (' + r.a + ' × ' + r.b + ')');
            if (!asPrinted || !fIsInt(asPrinted) || asPrinted.n !== ref) fail(tag + ': the printed expression does not read back as ' + ref);
          }
        }
      });
      /* 正解不可以每一關都在同一格。 */
      if (new Set(data.ROUNDS.map(r => r.ans)).size < 2) fail('the correct option sits in the same slot in every round');

      /* ---------- 三層題庫的神諭 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const want = BANK_EXPECTED[bank];
        const zh = I18N.zh[bank], en = I18N.en[bank];
        if (!zh || !en){ fail(bank + ': missing in one language'); return; }
        if (zh.length !== want.length) fail(bank + ': ' + zh.length + ' questions, expected ' + want.length);
        /* 選項數（4）、選項字串／數值不重複、zh 與 en 的 ans 一致，
           都由 tools/verify_lesson_data.js 的通用檢查負責（所有課共用），這裡不重複做。
           它沒有做的是「ans 是不是一個真的索引」—— 加在這裡。（codex 第一輪） */
        want.forEach((w, i) => {
          const qz = zh[i], qe = en[i];
          if (!qz || !qe){ fail(bank + '[' + i + ']: missing'); return; }
          [['zh', qz], ['en', qe]].forEach(([tag, q]) => {
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length)
              fail(bank + '[' + i + '] ' + tag + ': ans ' + q.ans + ' is not an index into the four options');
          });
          if (!w.stemExact) fail(bank + '[' + i + ']: no Chinese stem oracle defined');
          else if (qz.stem !== w.stemExact)
            fail(bank + '[' + i + ']: zh stem does not match the oracle\n    page: ' + qz.stem + '\n    want: ' + w.stemExact);
          if (!w.enStemExact) fail(bank + '[' + i + ']: no English stem oracle defined');
          else if (qe.stem !== w.enStemExact)
            fail(bank + '[' + i + ']: en stem does not match the oracle\n    page: ' + qe.stem + '\n    want: ' + w.enStemExact);
          if (qz.opts[qz.ans] !== w.answer)
            fail(bank + '[' + i + ']: zh answer is "' + qz.opts[qz.ans] + '", expected "' + w.answer + '"');
          const wantEn = w.enAnswer || w.answer;
          if (qe.opts[qe.ans] !== wantEn)
            fail(bank + '[' + i + ']: en answer is "' + qe.opts[qe.ans] + '", expected "' + wantEn + '"');
        });
        [['zh', BANK_ASK, zh], ['en', BANK_ASK_EN, en]].forEach(([tag, table, bankArr]) => {
          (table[bank] || []).forEach((ask, i) => {
            const stem = (bankArr[i] || {}).stem || '';
            (ask.must || []).forEach(m => { if (stem.indexOf(m) < 0) fail(bank + '[' + i + '] ' + tag + ': the stem no longer asks about "' + m + '"'); });
            (ask.never || []).forEach(m => { if (stem.indexOf(m) >= 0) fail(bank + '[' + i + '] ' + tag + ': the stem now also asks about "' + m + '"'); });
          });
        });
      });
      BANK_RECOMPUTE.forEach(rc => {
        const q = (I18N.zh[rc.bank] || [])[rc.i];
        if (!q){ fail('BANK_RECOMPUTE: ' + rc.bank + '[' + rc.i + '] is missing'); return; }
        const m = rc.re.exec(q.stem);
        if (!m){
          fail('BANK_RECOMPUTE ' + rc.bank + '[' + rc.i + ']: the stem no longer matches the pattern the numbers are read from');
          return;
        }
        const nums = m.slice(1).map(Number);
        if (nums.some(v => !Number.isInteger(v))){
          fail('BANK_RECOMPUTE ' + rc.bank + '[' + rc.i + ']: a captured number is not a whole number');
          return;
        }
        const got = rc.calc(nums);
        if (q.opts[q.ans] !== got)
          fail('BANK_RECOMPUTE ' + rc.bank + '[' + rc.i + ']: recomputing from the stem numbers (' + nums.join(', ') + ') gives "' + got + '" but the marked answer is "' + q.opts[q.ans] + '"');
      });

      /* ---------- 每一段文字：算式逐條驗算 ＋ 畫面上看得到的字 ---------- */
      let verified = 0, questions = 0;
      function scan(text, lang, tag){
        if (typeof text !== 'string' || !text.length) return;
        const r = arithProblems(text);
        r.problems.forEach(p => fail(tag + ': ' + p));
        verified += r.verified;
        questions += r.questions;
        textProblems(text, lang, tag).forEach(p => fail(p));
      }
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        ['intro', 'scopeNote', 's1note', 's2note', 's3note', 's4note', 's5note', 'footer',
         's1lead', 's2lead', 's3lead', 's4lead', 's5lead', 's2cap',
         'cAll', 'cGood', 'cTry', 'gClear'].forEach(k => scan(d[k], lang, lang + '.' + k));
        Object.keys(d.gHint1).forEach(k => scan(d.gHint1[k], lang, lang + '.gHint1.' + k));
        data.ROUNDS.forEach((r, ri) => {
          scan(d.gPrompt[r.kind](r), lang, lang + '.gPrompt[' + ri + ']');
          scan(d.gHint2[r.kind](r), lang, lang + '.gHint2[' + ri + ']');
          for (let i = 0; i < data.roundOptCount(r); i++){
            const tag = lang + '.gOptText[' + ri + '][' + i + ']';
            scan(d.gOptText(r, i), lang, tag);
            inexactDivisions(d.gOptText(r, i)).forEach(p => fail(tag + ': ' + p));
          }
        });
        data.S1_CASES.forEach(cs => {
          scan(d.s1chip(cs, d), lang, lang + '.s1chip.' + cs.id);
          for (let st = 0; st <= 2; st++){
            scan(d.s1cap(st), lang, lang + '.s1cap.' + st);
            scan(d.s1narr(cs, st, d), lang, lang + '.s1narr.' + cs.id + '.' + st);
            scan(d.s1calc(cs, st), lang, lang + '.s1calc.' + cs.id + '.' + st);
            scan(d.s1result(cs, st, d), lang, lang + '.s1result.' + cs.id + '.' + st);
            scan(d.s2step(st), lang, lang + '.s2step.' + st);
            scan(d.s2narr(cs, st, d), lang, lang + '.s2narr.' + cs.id + '.' + st);
            scan(d.s2calc(cs, st), lang, lang + '.s2calc.' + cs.id + '.' + st);
            scan(d.s2result(cs, st, d), lang, lang + '.s2result.' + cs.id + '.' + st);
          }
          /* 圖說不可以出現數字 —— 這一課的圖說只描述圖，不替孩子把題目算完。 */
          for (let st = 0; st <= 2; st++){
            if (/\d/.test(d.s1cap(st))) fail(lang + '.s1cap.' + st + ': the caption prints a number; captions must only describe the picture');
          }
          if (/\d/.test(d.s2cap)) fail(lang + '.s2cap: the caption prints a number; captions must only describe the picture');
        });
        data.S3_QKEYS.forEach(qk => {
          scan(d.s3q[qk], lang, lang + '.s3q.' + qk);
          scan(d.s3narr(qk), lang, lang + '.s3narr.' + qk);
          scan(d.s3calc(qk), lang, lang + '.s3calc.' + qk);
          scan(d.s3result(qk), lang, lang + '.s3result.' + qk);
        });
        data.EXPR_KEYS.forEach(k => scan(d.s3desc[k], lang, lang + '.s3desc.' + k));
        scan(d.s3on, lang, lang + '.s3on');
        scan(d.s3off, lang, lang + '.s3off');
        /* ⚠️ 這一課教的是 × 和 ÷，所以標記不可以用會被讀成運算符號的字。 */
        if (/[×✗✕*]/.test(d.s3off) || /[×✗✕*]/.test(d.s3on))
          fail(lang + '.s3on/s3off: the marker must not use a character that reads as a multiplication sign');
        data.S4_CASES.forEach(cs => {
          scan(d.s4chip[cs.id], lang, lang + '.s4chip.' + cs.id);
          const vals = data.stepValues(cs), n = cs.ops.length;
          for (let k = 0; k <= 2; k++){
            const op = k >= 1 ? cs.ops[k - 1] : null;
            const line = op ? (vals[k - 1] + (op[0] === '*' ? ' × ' : ' ÷ ') + op[1] + (lang === 'zh' ? ' ＝ ' : ' = ') + vals[k]) : '';
            const st = { full:data.fullExpr(cs), part:data.partialExpr(cs, k), line:line, n:n, answer:vals[n] };
            scan(d.s4step(k), lang, lang + '.s4step.' + k);
            scan(d.s4narr(st, k), lang, lang + '.s4narr.' + cs.id + '.' + k);
            scan(d.s4calc(st, k), lang, lang + '.s4calc.' + cs.id + '.' + k);
            scan(d.s4result(st, k), lang, lang + '.s4result.' + cs.id + '.' + k);
          }
        });
        data.S5_SPLITS.forEach(pair => {
          const st = data.splitSteps(pair);
          scan(d.s5chip(pair), lang, lang + '.s5chip.' + pair.join('x'));
          scan(d.s5narr(pair, st), lang, lang + '.s5narr.' + pair.join('x'));
          scan(d.s5calc(pair, st), lang, lang + '.s5calc.' + pair.join('x'));
          scan(d.s5result(pair, st), lang, lang + '.s5result.' + pair.join('x'));
        });
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          (d[bank] || []).forEach((q, i) => {
            scan(q.stem, lang, lang + '.' + bank + '[' + i + '].stem');
            scan(q.why, lang, lang + '.' + bank + '[' + i + '].why');
            q.opts.forEach((o, oi) => {
              const tag = lang + '.' + bank + '[' + i + '].opt' + oi;
              scan(o, lang, tag);
              /* ⚠️ 誘答也要除得剛剛好 —— 孩子可能真的把每一個選項算一遍，
                 而這一課明講沒有餘數、不用小數。（2026-09-07 codex 第一輪，
                 這一條裝上去立刻抓到 960 ÷ 16 ÷ 16 和 24 ÷ (5 × 8) 兩個靜態誘答。） */
              inexactDivisions(o).forEach(p => fail(tag + ': ' + p));
            });
          });
        });
      });

      /* ---------- 範例與遊戲印出來的每一個算式都要除得剛剛好 ---------- */
      /* ⚠️ 中英文都要掃：只掃中文的話，英文那一份 s1calc 印出一條除不開的除法
         完全不會響（codex 第二輪的改壞測試抓到）。 */
      ['zh', 'en'].forEach(lang => {
        data.S1_CASES.forEach(cs => {
          for (let st = 0; st <= 2; st++){
            inexactDivisions(I18N[lang].s1calc(cs, st)).forEach(p => fail(lang + '.s1calc.' + cs.id + '.' + st + ': ' + p));
            inexactDivisions(I18N[lang].s2calc(cs, st)).forEach(p => fail(lang + '.s2calc.' + cs.id + '.' + st + ': ' + p));
          }
        });
        data.S3_QKEYS.forEach(qk => inexactDivisions(I18N[lang].s3calc(qk)).forEach(p => fail(lang + '.s3calc.' + qk + ': ' + p)));
        /* ⚠️ s4calc 原本漏掉了 —— 英文那一份印出一條除不開的除法完全不會響。（codex 第三輪） */
        data.S4_CASES.forEach(cs => {
          const vals = data.stepValues(cs), n = cs.ops.length;
          for (let k = 0; k <= 2; k++){
            const op = k >= 1 ? cs.ops[k - 1] : null;
            const line = op ? (vals[k - 1] + (op[0] === '*' ? ' × ' : ' ÷ ') + op[1] + (lang === 'zh' ? ' ＝ ' : ' = ') + vals[k]) : '';
            const st = { full:data.fullExpr(cs), part:data.partialExpr(cs, k), line:line, n:n, answer:vals[n] };
            inexactDivisions(I18N[lang].s4calc(st, k)).forEach(p => fail(lang + '.s4calc.' + cs.id + '.' + k + ': ' + p));
            inexactDivisions(I18N[lang].s4result(st, k)).forEach(p => fail(lang + '.s4result.' + cs.id + '.' + k + ': ' + p));
          }
        });
        data.S5_SPLITS.forEach(pair => {
          const st = data.splitSteps(pair);
          inexactDivisions(I18N[lang].s5calc(pair, st)).forEach(p => fail(lang + '.s5calc.' + pair.join('x') + ': ' + p));
        });
      });
      data.EXPR_KEYS.forEach(k => {
        inexactDivisions(data.exprText(k, S3.t, S3.a, S3.b)).forEach(p => fail('example 3 ' + k + ': ' + p));
      });
      data.S4_CASES.forEach(cs => {
        for (let k = 0; k <= 2; k++) inexactDivisions(data.partialExpr(cs, k)).forEach(p => fail('example 4 ' + cs.id + '.' + k + ': ' + p));
      });
      data.S5_SPLITS.forEach(pair => {
        inexactDivisions(data.S5_T + ' ÷ ' + pair[0] + ' ÷ ' + pair[1]).forEach(p => fail('example 5 ' + pair.join('x') + ': ' + p));
      });

      /* ---------- 覆蓋率：驗過幾條、幾條是題目式、以及驗過的算式本身的指紋 ----------
         ⚠️ 只釘數量擋不住「拿掉一條、再補一條」—— 數字一樣，驗的卻是別的宣稱。 */
      const ARITH_VERIFIED = 194, ARITH_QUESTIONS = 6;
      const ARITH_SHA1 = '76aab03957bf52d352ef81989e2008a8a8df3e5f';
      if (verified !== ARITH_VERIFIED) fail('the lesson text verified ' + verified + ' equations, expected exactly ' + ARITH_VERIFIED);
      if (questions !== ARITH_QUESTIONS) fail('the lesson text has ' + questions + ' question-shaped equations, expected exactly ' + ARITH_QUESTIONS);
      const fp = require('crypto').createHash('sha1').update(arithProblems.verifiedAll().join(' | ')).digest('hex');
      if (ARITH_SHA1 && fp !== ARITH_SHA1) fail('the set of verified equations changed (sha1 ' + fp + ', expected ' + ARITH_SHA1 + ')');
      if (!ARITH_SHA1) console.log('arith fingerprint:', fp, '| verified:', verified, '| questions:', questions);
      /* 這一課沒有任何「刻意寫錯」的算式，所以放行清單必須是空的。 */
      if (arithProblems.unmatched().length) fail('wrongOnPurpose declares equations that never matched: ' + arithProblems.unmatched().join(', '));
      const excuses = arithProblems.excuseCounts();
      if (Object.keys(excuses).length) fail('this lesson must not excuse any wrong arithmetic, but it declares ' + JSON.stringify(excuses));
    }
  }
};
