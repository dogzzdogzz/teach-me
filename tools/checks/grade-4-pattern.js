/* grade-4/math/pattern —— 規律偵探社（數量模式：找規律、算第幾個）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套獨立重寫的實作：
 *
 * 1) 第 n 個是多少。頁面用**封閉式**（first ＋ (n － 1) × gap 之類）。
 *    這裡的參考實作走另一條路：**從第 1 個開始，把「下一步」做 n － 1 次**（遞迴式）。
 *    兩條路對整個取樣範圍逐一比對（第 1 節）。
 *
 * 2) 這一串是哪一種規律。頁面用「差都一樣／相除都一樣／差的差都一樣」這三個**性質測試**。
 *    參考實作走另一條路：**把四種模型分別套上去、往前生成整串、再逐項比對**（fit-and-regenerate），
 *    而且回報「有幾種模型套得上」——「剛好一種」本身就是一條斷言（第 2 節）。
 *
 * 3) 某個數是第幾個。頁面用**除法 ＋ 餘數**。參考實作走另一條路：
 *    **一項一項往上走，走到追上或超過那個數為止**（第 3 節）。
 *
 * 4) 火柴棒的圖。stickPlan 是純資料函式，這裡把它**跑起來**，
 *    驗每一根棒子的長度都等於邊長、根數剛好 2n ＋ 1（＝ 課程教的規律）、
 *    每一個點都在畫布的**四個方向**之內，而且整條帶子是連通的。
 *
 * ⚠️ 這一課教的規則有兩個前提，設定檔必須分開驗：
 *    「第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數」**只對 up／down 成立**，
 *    「除不盡就不在」也**只對 up／down 成立** —— mul／grow 不可以套。
 * ⚠️ 這一課不用負數：每一個選項、每一個答案都必須是 0 ~ 10000 的整數。
 */

const fs = require('fs');
const path = require('path');

const VAL_MAX_REF = 10000;
function inRangeRef(v){
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= VAL_MAX_REF;
}

/* ---------- 1) 第 n 個：遞迴式的參考實作（和頁面的封閉式不同路） ---------- */
function termRef(p, n){
  if (!Number.isInteger(n) || n < 1) return null;
  let v = p.first;
  for (let i = 1; i < n; i++){
    if (p.kind === 'up')   v = v + p.gap;
    else if (p.kind === 'down') v = v - p.gap;
    else if (p.kind === 'mul')  v = v * p.ratio;
    else if (p.kind === 'grow') v = v + p.gap + p.bump * (i - 1);
    else return null;
  }
  return v;
}
function termsRef(p, n){
  const out = [];
  for (let i = 1; i <= n; i++) out.push(termRef(p, i));
  return out;
}

/* ---------- 2) 哪一種規律：把四種模型套上去再生成回來 ---------- */
/* 這一課對規律的定義（課程頁與速查卡都對讀者這樣講）：
     up   每一個差都一樣，而且越走越大 → gap > 0
     down 每一個差都一樣，而且越走越小 → gap > 0
     mul  相鄰兩個相除都一樣，而且倍率大於 1 → ratio > 1（整數）
     grow 差自己的差都一樣，而且大於 0 → bump > 0
   bump ＝ 0 就退化成 up、ratio ＝ 1 就原地不動，所以兩個都要嚴格大於。 */
function fitsRef(list){
  const out = [];
  if (list.length < 3) return out;
  const a = list[0], b = list[1];
  const same = (p) => {
    const gen = termsRef(p, list.length);
    for (let i = 0; i < list.length; i++) if (gen[i] !== list[i]) return false;
    return true;
  };
  if (b > a && same({ kind:'up', first:a, gap:b - a })) out.push('up');
  if (b < a && same({ kind:'down', first:a, gap:a - b })) out.push('down');
  if (a > 0 && b % a === 0 && b / a > 1 && same({ kind:'mul', first:a, ratio:b / a })) out.push('mul');
  /* ⚠️ grow 必須「一路往上、而且加的數越來越大」。少了 b > a 與 g1 > 0 這兩個條件，
     [10, 8, 7, 7, 8] 這種先減、再平、再加的串也會被算成 grow。 */
  const g1 = b - a, g2 = list[2] - list[1], bump = g2 - g1;
  let rising = true;
  for (let i = 0; i + 1 < list.length; i++) if (!(list[i + 1] > list[i])) rising = false;
  /* ⚠️ grow 要有兩個以上相等的「差的差」（至少四個數）。只有一個的話，
     1、2、4 會同時符合 mul 與 grow，四種規律就不再互斥（codex 第二輪抓到）。 */
  if (list.length >= 4 && rising && g1 > 0 && bump > 0 &&
      same({ kind:'grow', first:a, gap:g1, bump:bump })) out.push('grow');
  return out;
}
function kindRef(list){
  const f = fitsRef(list);
  return f.length === 1 ? f[0] : (f.length === 0 ? 'other' : 'ambiguous:' + f.join('+'));
}

/* ---------- 3) 某個數是第幾個：一項一項往上走 ---------- */
function findIndexRef(p, v){
  if (p.kind !== 'up' && p.kind !== 'down') return { ok:false, why:'kind' };
  if (p.kind === 'up' && v < p.first)  return { ok:false, why:'below' };
  if (p.kind === 'down' && v > p.first) return { ok:false, why:'above' };
  let cur = p.first;
  for (let n = 1; n <= 100000; n++){
    if (cur === v) return { ok:true, index:n };
    if (p.kind === 'up' ? cur > v : cur < v) return { ok:false, why:'notdiv' };
    cur = (p.kind === 'up') ? cur + p.gap : cur - p.gap;
  }
  return { ok:false, why:'toofar' };
}

/* ---------- 4) 火柴棒圖：獨立重寫的排版 ＋ 幾何斷言 ---------- */
/* 課程頁 520×200／PAD 24；複習頁 360×140／PAD 16。獨立寫死一份規格 ——
   只跟頁面自己的 viewBox 與 CSS 互相一致是不夠的（三個一起改還是綠的）。 */
const FIG_REF = { index:{ W:520, H:200, PAD:24, MIN_SIDE:40 },
                  review:{ W:360, H:140, PAD:16, MIN_SIDE:26 } };
const SQ3H_REF = Math.sqrt(3) / 2;
function stickRef(n, W, H, PAD){
  const side = Math.min((W - 2 * PAD) * 2 / (n + 1), (H - 2 * PAD) / SQ3H_REF);
  const w = (n + 1) * side / 2, h = side * SQ3H_REF;
  const ox = (W - w) / 2, oy = (H - h) / 2;
  const pts = [];
  for (let i = 0; i <= n + 1; i++) pts.push([ox + i * side / 2, oy + (i % 2 === 0 ? h : 0)]);
  const bars = [];
  for (let a = 0; a <= n; a++) bars.push([a, a + 1]);
  for (let b = 0; b + 2 <= n + 1; b++) bars.push([b, b + 2]);
  return { side, pts, bars };
}
/* 把「頁面算出來的那一份」拿來驗幾何。回傳問題字串陣列（空的表示過關）。 */
function checkStickPlan(plan, n, box, tag){
  const out = [];
  const ref = stickRef(n, box.W, box.H, box.PAD);
  if (!plan || !Array.isArray(plan.pts) || !Array.isArray(plan.bars)){
    out.push(tag + ': stickPlan(' + n + ') did not return pts/bars');
    return out;
  }
  /* 4a. 根數必須剛好等於課程教的規律 2n ＋ 1 —— 圖和規則是同一件事。 */
  if (plan.bars.length !== 2 * n + 1)
    out.push(tag + ': ' + n + ' triangles drew ' + plan.bars.length + ' sticks, the rule says ' + (2 * n + 1));
  if (plan.pts.length !== n + 2)
    out.push(tag + ': ' + n + ' triangles need ' + (n + 2) + ' corner points, got ' + plan.pts.length);
  /* 4b. 邊長要對得上獨立算出來的那一份，而且不可以小到看不出形狀。 */
  if (!(Math.abs(plan.side - ref.side) < 1e-6))
    out.push(tag + ': side ' + plan.side + ' but the reference layout gives ' + ref.side);
  if (!(plan.side >= box.MIN_SIDE))
    out.push(tag + ': a matchstick is only ' + plan.side.toFixed(1) + 'px long (minimum ' + box.MIN_SIDE + ')');
  /* 4c. 每一個點都要在畫布的四個方向之內。 */
  plan.pts.forEach((p, i) => {
    if (!(p[0] >= box.PAD - 1e-6) || !(p[0] <= box.W - box.PAD + 1e-6))
      out.push(tag + ': point ' + i + ' x=' + p[0].toFixed(1) + ' is outside the canvas padding');
    if (!(p[1] >= box.PAD - 1e-6) || !(p[1] <= box.H - box.PAD + 1e-6))
      out.push(tag + ': point ' + i + ' y=' + p[1].toFixed(1) + ' is outside the canvas padding');
  });
  /* 4d. 每一根棒子的長度都要等於邊長（正三角形），不可以有零長度的棒子。 */
  plan.bars.forEach((b, i) => {
    const a = plan.pts[b[0]], c = plan.pts[b[1]];
    if (!a || !c){ out.push(tag + ': bar ' + i + ' points at a corner that does not exist'); return; }
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (!(Math.abs(len - plan.side) < 1e-6))
      out.push(tag + ': bar ' + i + ' is ' + len.toFixed(2) + 'px long but the side is ' + plan.side.toFixed(2));
  });
  /* 4e. 整條帶子要連通（每一個點至少被一根棒子用到），而且沒有重複的棒子。 */
  const used = new Set(), seen = new Set();
  plan.bars.forEach(b => {
    used.add(b[0]); used.add(b[1]);
    const key = Math.min(b[0], b[1]) + '-' + Math.max(b[0], b[1]);
    if (seen.has(key)) out.push(tag + ': bar ' + key + ' is drawn twice');
    seen.add(key);
  });
  for (let i = 0; i <= n + 1; i++)
    if (!used.has(i)) out.push(tag + ': corner point ' + i + ' has no stick attached');
  /* 4f. 每一個三角形（點 k、k+1、k+2）的三條邊都必須真的在棒子清單裡。 */
  for (let k = 0; k < n; k++){
    [[k, k + 1], [k + 1, k + 2], [k, k + 2]].forEach(pair => {
      const key = Math.min(pair[0], pair[1]) + '-' + Math.max(pair[0], pair[1]);
      if (!seen.has(key)) out.push(tag + ': triangle ' + (k + 1) + ' is missing its ' + key + ' side');
    });
  }
  return out;
}

/* ---------- 解釋裡的算式逐條驗算 ----------
   「解釋裡有出現那一句正確的話」擋不住**多加一句錯的**，所以每一條算式都要真的算對。
   ⚠️ 這種驗算器最容易 fail open 的三個地方，這裡都堵住了：
     ① 算不出來就跳過 ＝ 替它背書 → 這裡改成**回報 cannot parse**，一律失敗；
     ② 只抓兩個運算元 → 這裡抓**整條鏈**（a ＋ b × c ＝ d ＝ e 全都要相等）；
     ③ 減號有三種寫法（－ U+FF0D、- 半形、− U+2212），乘除也有全形 —— 全部正規化。
   位置詞（第 N 個／position N／20th）先換成非數字記號 P，它們不是運算元。 */
function normArith(s){
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/[＋]/g, '+')
    .replace(/[－−–—]/g, '-')
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[＝]/g, '=')
    /* ⚠️ 全形括號**不要**折成半形：課程的散文括號是全形的，折過去之後
       每一條「括號裡的算式」都會變成不成對，整條鏈被丟掉 ＝ 靜靜不驗。
       全形括號不在字元集裡，本來就自然當分隔符。 */
    .replace(/第\s*\d+\s*個/g, ' P ')
    /* ⚠️ 只有「position N」後面**沒有接運算符號**時才是位置詞。
       `position 9 + 1 = 10` 的 9 是運算元，吃掉它會讓整條算式驗不到。 */
    .replace(/position\s+\d+\b(?!\s*[+\-*/=])/gi, ' P ')
    .replace(/\b\d+(st|nd|rd|th)\b/gi, ' P ')
    .replace(/餘\s*(\d+)/g, ' R$1 ')
    .replace(/\br\s+(\d+)\b/g, ' R$1 ')
    .replace(/remainder\s+(\d+)/gi, ' R$1 ')
    .replace(/(\d)\s*(根|人|步|張|個|階|次|題|分)/g, '$1 ')
    .replace(/(\d)\s*(sticks?|people|person|hops?|tables?|seats?|steps?|points?|arrows?|triangles?|squares?)\b/gi, '$1 ');
}
/* 只含數字與運算符號的最長片段。逗號、頓號、句號、冒號、箭頭都不在字元集裡，
   所以它們自然成為分隔符。 */
const CHAIN_RE = /[0-9+\-*/=() R]{3,}/g;
/* ⚠️ 這一課只有整數。帶小數點的宣稱（`8 / 4 = 2.5`）會被字元集切成 `8 / 4 = 2`
   而「驗過」—— 所以看到小數就直接判失敗，不要讓它被切一半。 */
/* 小數只有在**算式裡**才是問題（`＝ 2.5`）。掃整段文字的話，
   散文裡的「2.5 版」也會被擋掉（codex 第二輪抓到）。 */
const DECIMAL_RE = /[=+\-*/]\s*\d+\.\d|\d+\.\d\s*[=+\-*/]/;
/* 字元集會把緊貼算式的括號與破折號一起吃進來（`6 + 1 = 7(`、`= 3 --`）。
   兩端一律修到「數字或右括號」為止，括號不成對就整條丟掉 —— 不是靜靜跳過，
   而是讓它落到下面的 cannot parse 去。 */
function trimChain(s){
  let t = String(s);
  const count = (x, ch) => x.split(ch).length - 1;
  for (let guard = 0; guard < 40; guard++){
    const before = t;
    t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
    /* 散文緊貼算式時，字元集會把邊界上那一個括號一起吃進來
       （`exactly (41 - 5 = 36`）。落單的括號一律從兩端剝掉 —— 這是**修好邊界**，
       不是放棄整條鏈（放棄就等於靜靜不驗）。 */
    if (count(t, '(') > count(t, ')') && t[0] === '(') t = t.slice(1);
    else if (count(t, ')') > count(t, '(') && t[t.length - 1] === ')') t = t.slice(0, -1);
    if (t === before) break;
  }
  t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
  let depth = 0;
  for (const ch of t){
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) return '';
  }
  return depth === 0 ? t : '';
}
/* 遞迴下降：+ - 低優先，* / 高優先，支援括號。算不出來回 null。 */
function evalExpr(src){
  let i = 0;
  const s = String(src);
  function ws(){ while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++; }
  function num(){
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
    const v = Number(s.slice(i, j));
    i = j;
    return v;
  }
  function term(){
    let v = num();
    if (v === null) return null;
    for (;;){
      ws();
      if (s[i] === '*' || s[i] === '/'){
        const op = s[i]; i++;
        const r = num();
        if (r === null) return null;
        if (op === '*') v = v * r;
        else { if (r === 0) return null; v = v / r; }
      } else return v;
    }
  }
  function expr(){
    let v = term();
    if (v === null) return null;
    for (;;){
      ws();
      if (s[i] === '+' || s[i] === '-'){
        const op = s[i]; i++;
        const r = term();
        if (r === null) return null;
        v = (op === '+') ? v + r : v - r;
      } else return v;
    }
  }
  const v = expr();
  ws();
  return (i === s.length && v !== null) ? v : null;
}
/* 回傳 { problems, verified }。verified 是「真的驗過幾條算式」，供覆蓋率斷言用。 */
function arithProblems(text){
  const out = [];
  let verified = 0;
  const norm = normArith(text);
  if (DECIMAL_RE.test(norm))
    out.push('a decimal number appears in an arithmetic claim, but this lesson only uses whole numbers: ' +
             norm.slice(Math.max(0, norm.search(DECIMAL_RE) - 20), norm.search(DECIMAL_RE) + 20));
  /* ⚠️ 等號的數量是「宣稱了幾次相等」。下面每一條鏈都要對得上一個等號，
     對不上就表示有一條宣稱被字元集丟掉了 —— 那是靜靜不驗，不是通過。 */
  /* 只數「兩邊至少有一邊緊鄰數字」的等號 —— 「符號 = 的意思是」那種用法不是算式。 */
  const equalsTotal = (norm.match(/\d\s*=|=\s*\d/g) || []).length;
  let equalsSeen = 0;
  const chains = norm.match(CHAIN_RE) || [];
  for (const raw of chains){
    /* 每一條鏈裡也只數「緊鄰數字」的等號，判準要和 equalsTotal 完全一樣，
       否則像 ` = ` 這種孤立的等號會被算成一條讀不出來的算式。 */
    const eqs = (raw.match(/\d\s*=|=\s*\d/g) || []).length;
    if (eqs === 0) continue;
    equalsSeen += eqs;
    const chain = trimChain(raw.trim());
    /* 修邊界之後變成空的 ＝ 這條宣稱根本讀不出來，一律報錯，不可以 continue。 */
    if (!chain || chain.indexOf('=') < 0){
      out.push('cannot parse the equation in "' + raw.trim() + '"');
      continue;
    }         // 沒有等號 ＝ 沒有宣稱任何相等
    const remMatch = /^([0-9 ()+\-*/]+)=\s*(\d+)\s+R(\d+)$/.exec(chain);
    if (remMatch){
      const q = Number(remMatch[2]), r = Number(remMatch[3]);
      const div = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(remMatch[1]);
      if (!div){ out.push('remainder form without a plain division: "' + chain + '"'); continue; }
      const A = Number(div[1]), B = Number(div[2]);
      if (B === 0){ out.push('division by zero in "' + chain + '"'); continue; }
      if (Math.floor(A / B) !== q || A - q * B !== r)
        out.push('wrong remainder division: ' + A + ' / ' + B + ' is ' + Math.floor(A / B) +
                 ' r ' + (A - Math.floor(A / B) * B) + ', not ' + q + ' r ' + r);
      else verified++;
      continue;
    }
    if (/R\d/.test(chain)){ out.push('unrecognised remainder chain "' + chain + '"'); continue; }
    const parts = chain.split('=').map(x => x.trim()).filter(x => x.length);
    if (parts.length < 2){ out.push('dangling equals in "' + chain + '"'); continue; }
    const vals = parts.map(evalExpr);
    let unparsed = false;
    for (let k = 0; k < vals.length; k++){
      if (vals[k] === null){ out.push('cannot parse "' + parts[k] + '" in "' + chain + '"'); unparsed = true; break; }
    }
    if (unparsed) continue;
    let bad = false;
    for (let k = 1; k < vals.length; k++){
      if (Math.abs(vals[k] - vals[0]) > 1e-9){
        out.push('arithmetic is wrong: "' + chain + '" (' + parts[0] + ' is ' + vals[0] + ', not ' + vals[k] + ')');
        bad = true;
        break;
      }
    }
    if (!bad) verified++;
  }
  if (equalsSeen !== equalsTotal)
    out.push('the text claims ' + equalsTotal + ' equalities but only ' + equalsSeen +
             ' reached the checker — one of them was dropped instead of verified');
  return { problems:out, verified };
}

/* ---------- 渲染出來的字串掃描 ---------- */
/* 中文和數字之間要有空格；英文的 1 只有它會出錯；不可以有 undefined／NaN。 */
/* 「1」後面接複數名詞一律是錯的。用通則抓，不要列白名單的名詞
   —— 列名詞的話 "1 gaps"、"1 rules" 這種就漏掉了（codex 抓到）。
   下面那幾個字剛好以 s 結尾但不是複數名詞，要放行。 */
const EN_S_WORD_OK = ['is', 'has', 'was', 'its', 'less', 'plus', 'thus', 'this', 'does', 'yes',
  /* 動詞，不是複數名詞 */
  'gives', 'leaves', 'means', 'makes', 'needs', 'takes', 'lands', 'adds', 'comes', 'goes', 'says'];
/* -wards／-ways 結尾的是副詞（afterwards、towards、always），不是複數名詞。 */
const EN_S_ADVERB_RE = /(wards|ways)$/;
/* 以 s 結尾卻是單數的名詞，不可以誤報。 */
const EN_S_SINGULAR_OK = ['class', 'bus', 'glass', 'cross', 'pass', 'gas', 'lens', 'series'];
/* 不規則複數：s 結尾的通則抓不到它們，要另外列。 */
const EN_IRREGULAR_PLURAL_RE = /\b1 (people|children|men|women|feet|teeth|mice|geese)\b/;
const EN_ONE_RE = /\b1 ([a-z]+s)\b/;
const EN_ARE_ONE_RE = /\b1 [a-z]+ are\b/;
function textProblems(s, lang, tag){
  const out = [];
  const shown = String(s).replace(/<[^>]+>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(tag + ' leaks an internal value: ' + shown.slice(0, 90));
  if (!shown.trim()) out.push(tag + ' renders empty');
  /* ⚠️ 這一課不用負數。負號要**緊貼數字**才算負號，
     不然「20 － 6」這種減法算式會被誤判（別課踩過這個坑）。 */
  /* 負號只要**緊貼數字**就算（前面不可以是數字，否則 2026-09-01 這種日期會誤報）。
     「20 － 6」的減號和 6 之間有空白，所以不會中。 */
  const neg = /(?<!\d)[-−－]\d/.exec(shown);
  if (neg) out.push(tag + ' shows a negative number ("' + neg[0].trim() + '"), but this lesson never uses negatives');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(tag + ' has Chinese glued to a digit: ' + [...new Set(glued)].join(' '));
  } else {
    if (/[一-鿿]/.test(shown)) out.push(tag + ' (English) contains Chinese: ' + shown.slice(0, 60));
    const one = EN_ONE_RE.exec(shown);
    if (one && EN_S_WORD_OK.indexOf(one[1]) < 0 && !EN_S_ADVERB_RE.test(one[1]) &&
        EN_S_SINGULAR_OK.indexOf(one[1]) < 0)
      out.push(tag + ' has an English plural after 1: "' + one[0] + '"');
    const irr = EN_IRREGULAR_PLURAL_RE.exec(shown);
    if (irr) out.push(tag + ' has an irregular English plural after 1: "' + irr[0] + '"');
    const are = EN_ARE_ONE_RE.exec(shown);
    if (are) out.push(tag + ' has "are" after a singular 1: "' + are[0] + '"');
    if (/\bA (?=[aeiou])/.test(shown)) out.push(tag + ' has "A" before a vowel — capitalisation mangled the article');
  }
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
  if (dbl) out.push(tag + ' has doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* ---------- 跨頁用詞釘樁 ----------
   同一條規則在四頁必須用同一句話講。這一課最危險的兩句是
   「(n － 1)」那條算式與「除不盡就不在」—— 少一頁鬆口，整堂課的核心就散了。
   實際的比對在 data.check 裡（SIBLING_RULES 只是資料，沒有人跑它就等於沒釘）。
   ⚠️ `min` 一律寫成**當下真實的出現次數**，不是「至少 2」——
   實際有 3 份而只要求 2 份的話，拿掉其中一份還是綠的（改壞測試證明過）。 */
const SIBLING_RULES = [
  { file:'index', text:'第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數', min:2,
    why:'is the one formula this whole lesson turns on' },
  { file:'index', text:'用 ☐ 列式把未知數解出來', min:2,
    why:'is the grade-5 boundary the scope note has to state' },
  { file:'index', text:'交換律、結合律、分配律', min:3,
    why:'is the other grade-5 boundary (the operation laws are a different unit)' },
  { file:'index', text:'每一個差都算過', min:2,
    why:'is the rule that stops a child deciding from the first gap alone' },
  { file:'reference', text:'第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數', min:2,
    why:'must match the lesson page word for word' },
  { file:'reference', text:'第幾個 ＝ (那個數 － 第 1 個) ÷ 每次加的數 ＋ 1', min:2,
    why:'is the reverse formula, and the + 1 is exactly what children drop' },
  { file:'reference', text:'用 ☐ 列式把未知數解出來', min:2,
    why:'must state the same grade-5 boundary as the lesson page' },
  { file:'reference', text:'除不盡', min:3,
    why:'is how the cheat sheet answers "is this number in the pattern"' },
  { file:'parents', text:'用 ☐ 或英文字母列式解未知數', min:2,
    why:'is the grade-5 boundary spelled out for the adult' },
  { file:'parents', text:'交換律／結合律／分配律', min:2,
    why:'is the other grade-5 boundary spelled out for the adult' },
  { file:'parents', text:'第 1 個站在原地，一步都還沒走', min:4,
    why:'is the sentence the adult is meant to say out loud' },
  { file:'review', text:'每次加一樣多', min:3,
    why:'is the rule name the generators must use, matching the other three pages' }
];

const GEN_IDS = ['gapOfRun', 'whichKind', 'nextTerm', 'nthFromStart', 'nthFromList',
                 'whichIndex', 'inPattern', 'hopsBetween', 'stickCount', 'seatCount',
                 'downNth', 'gapFromTwo'];

/* ---------- 題庫神諭 ----------
   `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，
   這一課 12 題一題都不符合 —— 沒有這一張表的話，把 ans 改掉完全不會響。
   `stemExact` 逐字釘死題幹：白名單（集合比對）擋不掉「重複使用既有數字」的偷加。 */
const BANK_EXPECTED = {
  qs: [
    { stemExact:'一串數字是 <strong>5、9、13、17</strong>。每次加多少？', answer:'4' },
    { stemExact:'一串數字是 <strong>2、6、18、54</strong>。下一個是多少？', answer:'162' },
    { stemExact:'一個規律的<strong>第 1 個是 8</strong>，<strong>每次加 5</strong>。<strong>第 10 個</strong>是多少？', answer:'53' },
    { stemExact:'一個規律是 <strong>3、7、11、15…</strong>。<strong>39 是第幾個？</strong>', answer:'10' },
    { stemExact:'一個規律是 <strong>4、10、16、22…</strong>。<strong>50 在這個規律裡嗎？</strong>',
      answer:'不在，因為 50 － 4 ＝ 46，46 ÷ 6 除不盡',
      enAnswer:'No, because 50 − 4 = 46 and 46 ÷ 6 does not divide exactly' },
    { stemExact:'從<strong>第 1 個</strong>走到<strong>第 15 個</strong>，一共走了幾步？', answer:'14' }
  ],
  qsAdv: [{ answer:'37' }, { answer:'14' }, { answer:'51' }, { answer:'7' }],
  qsBoost: [
    { answer:'應該乘 9 不是 10 —— 從第 1 個走到第 10 個只走了 9 步，答案是 58',
      enAnswer:'It should be 9, not 10 — going from the 1st to the 10th is only 9 hops, so the answer is 58' },
    { answer:'因為桌子拼成一長排時，相接的那兩邊坐不了人，所以每多一張只多 2 人',
      enAnswer:'Because pushing the tables into one long row makes the two touching sides unusable, so each extra table only adds 2 seats' }
  ]
};
/* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
const BANK_ASK = {
  qs: [
    { must:['每次加多少'], never:['第幾個'] },
    { must:['下一個'], never:['第幾個'] },
    { must:['第 10 個'], never:['第幾個'] },
    { must:['是第幾個'], never:['下一個'] },
    { must:['在這個規律裡嗎'], never:['是第幾個'] },
    { must:['走了幾步'], never:['是多少'] }
  ]
};
/* 這幾題的答案要從**題幹裡的數字**重算，不是拿設定檔自己的常數算 ——
   後者在題幹被改掉時不會響。 */
const BANK_RECOMPUTE = [
  { bank:'qs', i:0, from:[5, 9, 13, 17], calc:l => String(l[1] - l[0]) },
  { bank:'qs', i:1, from:[2, 6, 18, 54], calc:l => String(l[3] * (l[1] / l[0])) },
  { bank:'qs', i:2, from:[1, 8, 5, 10],  calc:l => String(l[1] + (l[3] - 1) * l[2]) },
  { bank:'qs', i:3, from:[3, 7, 11, 15, 39], calc:l => String((l[4] - l[0]) / (l[1] - l[0]) + 1) },
  { bank:'qs', i:5, from:[1, 15], calc:l => String(l[1] - l[0]) },
  { bank:'qsAdv', i:0, from:[1, 4, 3, 12], calc:l => String(l[1] + (l[3] - 1) * l[2]) },
  { bank:'qsAdv', i:1, from:[1, 4, 2, 30], calc:l => String((l[3] - l[1]) / l[2] + 1) },
  { bank:'qsAdv', i:2, from:[100, 93, 86, 79, 7, 8], calc:l => String(l[0] - (l[5] - 1) * l[4]) },
  { bank:'qsAdv', i:3, from:[1, 6, 6, 41], calc:l => String((l[3] - l[1]) / (l[2] - 1)) }
];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    { file:"index", via:"index", expect:"but the recurrence gives",
      find:"    if (p.kind === 'up')   return p.first + k * p.gap;",
      replace:"    if (p.kind === 'up')   return p.first + n * p.gap;",
      why:"termAt would multiply by n instead of n - 1" },
    { file:"index", via:"index", expect:"but the recurrence gives",
      find:"    if (p.kind === 'down') return p.first - k * p.gap;",
      replace:"    if (p.kind === 'down') return p.first + k * p.gap;",
      why:"a falling pattern would climb" },
    { file:"index", via:"index", expect:"but the recurrence gives",
      find:"    if (p.kind === 'mul')  return p.first * Math.pow(p.ratio, k);",
      replace:"    if (p.kind === 'mul')  return p.first * Math.pow(p.ratio, n);",
      why:"the multiply rule would apply one factor too many" },
    { file:"index", via:"index", expect:"but the recurrence gives",
      find:"    if (p.kind === 'grow') return p.first + k * p.gap + p.bump * k * (k - 1) / 2;",
      replace:"    if (p.kind === 'grow') return p.first + k * p.gap + p.bump * k * (k + 1) / 2;",
      why:"the growing-gap rule would add one bump too many" },
    { file:"index", via:"index", expect:"accepted an illegal position",
      find:"    if (!(n >= 1) || n !== Math.round(n)) return null;\n    var k = n - 1;",
      replace:"    var k = n - 1;",
      why:"termAt would answer for position 0 and for fractions" },
    { file:"index", via:"index", expect:"the hops from the 1st one are always n",
      find:"  function stepsTo(n){ return n - 1; }",
      replace:"  function stepsTo(n){ return n; }",
      why:"the whole lesson turns on this subtraction" },
    { file:"index", via:"index", expect:"offByOneValue must be exactly one gap past the answer",
      find:"    if (p.kind === 'up')   return p.first + n * p.gap;\n    if (p.kind === 'down') return p.first - n * p.gap;\n    return null;",
      replace:"    if (p.kind === 'up')   return p.first + (n - 1) * p.gap;\n    if (p.kind === 'down') return p.first - (n - 1) * p.gap;\n    return null;",
      why:"the \"one hop too many\" answer the lesson prints would equal the right answer" },
    { file:"index", via:"index", expect:"offByOneValue must refuse a multiply rule",
      find:"  function offByOneValue(p, n){\n    if (p.kind === 'up')",
      replace:"  function offByOneValue(p, n){\n    if (p.kind === 'mul') return p.first * n;\n    if (p.kind === 'up')",
      why:"one hop too many is meaningless for a multiply rule" },
    { file:"index", via:"index", expect:"but the walking reference gives",
      find:"    if (diff < 0) return { ok:false, why:(p.kind === 'up') ? 'below' : 'above', diff:diff };",
      replace:"    if (diff < -100000) return { ok:false, why:(p.kind === 'up') ? 'below' : 'above', diff:diff };",
      why:"a number below the 1st one would be given a position" },
    { file:"index", via:"index", expect:"but the walking reference gives",
      find:"    return { ok:true, index:quo + 1, diff:diff, quo:quo, rem:0 };",
      replace:"    return { ok:true, index:quo, diff:diff, quo:quo, rem:0 };",
      why:"the + 1 the lesson keeps warning about would be dropped" },
    { file:"index", via:"index", expect:"but the walking reference gives",
      find:"    if (rem !== 0) return { ok:false, why:'notdiv', diff:diff, quo:quo, rem:rem };",
      replace:"    if (rem !== 0) return { ok:true, index:quo + 1, diff:diff, quo:quo, rem:rem };",
      why:"a number that does not divide exactly would still be given a position" },
    { file:"index", via:"index", expect:"but the lesson says the two formulas only apply to add/subtract rules",
      find:"    if (p.kind !== 'up' && p.kind !== 'down') return { ok:false, why:'kind' };\n    var diff = (p.kind === 'up') ? v - p.first : p.first - v;",
      replace:"    var diff = (p.kind === 'up' || p.kind === 'mul' || p.kind === 'grow') ? v - p.first : p.first - v;",
      why:"the position formula would be applied to a multiply rule" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"    if (allSame(g) && g[0] > 0 && d === 'up') return 'up';",
      replace:"    if (allSame(g) && g[0] > 0 && d !== 'mixed') return 'up';",
      why:"a falling run would be named \"adds the same amount\"" },
    { file:"index", via:"index", expect:"must not count as multiplying by the same amount",
      find:"      if (r && allSame(r) && r[0] > 1) return 'mul';",
      replace:"      if (r && r[0] > 1) return 'mul';",
      why:"one matching ratio would be enough to call it a multiply rule" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"    if (allSame(g) && g[0] > 0 && d === 'up') return 'up';\n    if (allSame(g) && g[0] > 0 && d === 'down') return 'down';",
      replace:"    var gg0 = gapList(g);\n    if (gg0.length && allSame(gg0)) return 'grow';\n    if (allSame(g) && g[0] > 0 && d === 'down') return 'down';",
      why:"checking the growing-gap rule first (and without the bump > 0 guard) swallows every constant-gap run" },
    { file:"index", via:"index", expect:"two numbers show only one gap",
      find:"    if (list.length < 3) return 'other';",
      replace:"    if (list.length < 2) return 'other';",
      why:"two numbers would be enough to name a rule" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"    for (var i = 0; i + 1 < list.length; i++) out.push(Math.abs(list[i + 1] - list[i]));",
      replace:"    for (var i = 0; i + 1 < list.length; i++) out.push(list[i + 1] - list[i]);",
      why:"gaps would come out negative, which this lesson never uses" },
    { file:"index", via:"index", expect:"must not count as multiplying",
      find:"      if (list[i] === 0 || list[i + 1] % list[i] !== 0) return null;",
      replace:"      if (list[i] === 0) return null;",
      why:"a run whose ratio is 1.5 would be called a whole-number multiply rule" },
    { file:"index", via:"index", expect:"must not be classified, even when every gap is equal",
      find:"    if (up && down) return 'mixed';",
      replace:"    if (up && down) return 'up';",
      why:"a run that alternates up and down would be classified as adding the same amount" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"    for (var i = 1; i < arr.length; i++) if (arr[i] !== arr[0]) return false;\n    return true;",
      replace:"    return true;",
      why:"every run would look like all gaps the same" },
    { file:"index", via:"index", expect:"sticks, the rule says",
      find:"    for (var b = 0; b + 2 <= n + 1; b++) bars.push([b, b + 2]);",
      replace:"    for (var b = 0; b + 2 <= n; b++) bars.push([b, b + 2]);",
      why:"the last triangle would lose its horizontal stick" },
    { file:"index", via:"index", expect:"px long but the side is",
      find:"    for (var i = 0; i <= n + 1; i++) pts.push([ox + i * side / 2, oy + (i % 2 === 0 ? h : 0)]);",
      replace:"    for (var i = 0; i <= n + 1; i++) pts.push([ox + i * side / 2, oy + (i % 2 === 0 ? h : h)]);",
      why:"every corner would sit on one line, so the triangles would be flat" },
    { file:"index", via:"index", expect:"but the reference layout gives",
      find:"    var side = Math.min((FIG_W - 2 * FIG_PAD) * 2 / (n + 1), (FIG_H - 2 * FIG_PAD) / SQ3H);",
      replace:"    var side = Math.min((FIG_W - 2 * FIG_PAD) / (n + 1), (FIG_H - 2 * FIG_PAD) / SQ3H);",
      why:"the strip would be drawn at half width" },
    { file:"index", via:"index", expect:"is outside the canvas padding",
      find:"    var ox = (FIG_W - w) / 2, oy = (FIG_H - h) / 2;",
      replace:"    var ox = 0, oy = 0;",
      why:"the figure would be jammed against the top-left corner" },
    { file:"index", via:"index", expect:"but the independent spec says",
      find:"  var FIG_W = 520, FIG_H = 200, FIG_PAD = 24;",
      replace:"  var FIG_W = 520, FIG_H = 200, FIG_PAD = 4;",
      why:"the padding would no longer match the independent layout spec" },
    { file:"index", via:"index", expect:"is below the readable minimum",
      find:"  var FIG_MIN_SIDE = 40;",
      replace:"  var FIG_MIN_SIDE = 4;",
      why:"the readability floor would be lowered until it guards nothing" },
    { file:"index", via:"index", expect:"Example 1 never shows a \"grow\" run",
      find:"    { list:[1, 3, 6, 10, 15] },",
      replace:"    { list:[2, 5, 8, 11, 14] },",
      why:"the growing-gap example would disappear" },
    { file:"index", via:"index", expect:"Example 1 never shows a \"mul\" run",
      find:"    { list:[1, 2, 4, 8, 16] }",
      replace:"    { list:[3, 6, 9, 12, 15] }",
      why:"the multiply example would disappear" },
    { file:"index", via:"index", expect:"has fewer than 4 numbers",
      find:"    { list:[5, 8, 11, 14, 17] },",
      replace:"    { list:[5, 8, 11] },",
      why:"a run too short to show every gap" },
    { file:"index", via:"index", expect:"Example 2 never shows the 1st one",
      find:"  var STEP_NS = [1, 2, 5, 10, 20];",
      replace:"  var STEP_NS = [2, 3, 5, 10, 20];",
      why:"the 0-hops boundary would never be demonstrated" },
    { file:"index", via:"index", expect:"Example 3 never demonstrates the \"below\" outcome",
      find:"  var FIND_TARGETS = [23, 44, 100, 3];",
      replace:"  var FIND_TARGETS = [23, 44, 100, 8];",
      why:"a number below the 1st one would lose its worked example" },
    { file:"index", via:"index", expect:"STICK must be first 3 / gap 2",
      find:"  var STICK = { kind:'up', first:3, gap:2 };",
      replace:"  var STICK = { kind:'up', first:4, gap:2 };",
      why:"the stick rule would stop matching the drawn triangles" },
    { file:"index", via:"index", expect:"SEAT must be first 4 / gap 2",
      find:"  var SEAT = { kind:'up', first:4, gap:2 };",
      replace:"  var SEAT = { kind:'up', first:4, gap:3 };",
      why:"joining square tables would be claimed to lose only one side" },
    { file:"index", via:"index", expect:"needs at least 4 columns",
      find:"  var SEAT_ROWS = 6;",
      replace:"  var SEAT_ROWS = 3;",
      why:"the table would be too short for the gap to read as a rule" },
    { file:"index", via:"index", expect:"misconception coincides with the right answer",
      find:"  var STICK_FAR = 20;",
      replace:"  var STICK_FAR = 1;",
      why:"the far position would be one where the wrong multiplication happens to be right" },
    { file:"index", via:"index", expect:"misconception coincides with the right answer",
      find:"  var SEAT_FAR = 10;",
      replace:"  var SEAT_FAR = 1;",
      why:"same for the seating table" },
    { file:"index", via:"index", expect:"computed answer is",
      find:"    { kind:'nth',   pat:{ kind:'up', first:7, gap:4 }, n:12, opts:[48, 55, 51, 43], ans:2 },",
      replace:"    { kind:'nth',   pat:{ kind:'up', first:7, gap:4 }, n:12, opts:[48, 55, 51, 43], ans:0 },",
      why:"a game round would mark the wrong option correct" },
    { file:"index", via:"index", expect:"the \"forgot the + 1\" distractor is not offered",
      find:"    { kind:'index', pat:{ kind:'up', first:6, gap:4 }, v:46, opts:[11, 10, 12, 40], ans:0 },",
      replace:"    { kind:'index', pat:{ kind:'up', first:6, gap:4 }, v:46, opts:[11, 13, 12, 40], ans:0 },",
      why:"the round would stop testing the mistake it exists for" },
    { file:"index", via:"index", expect:"misconception is not offered",
      find:"    { kind:'stick', n:8, figN:3, opts:[16, 17, 19, 24], ans:1 }",
      replace:"    { kind:'stick', n:8, figN:3, opts:[16, 17, 19, 20], ans:1 }",
      why:"the 3-times-how-many distractor would disappear from the game" },
    { file:"index", via:"index", expect:"of the options are in the pattern, exactly 1 is required",
      find:"    { kind:'inpat', pat:{ kind:'up', first:5, gap:4 }, opts:[100, 97, 98, 99], ans:1 },",
      replace:"    { kind:'inpat', pat:{ kind:'up', first:5, gap:4 }, opts:[101, 97, 98, 99], ans:1 },",
      why:"two options would be correct at once" },
    { file:"index", via:"index", expect:"computed answer is",
      find:"    if (r.kind === 'stick') return termAt(STICK, r.n);",
      replace:"    if (r.kind === 'stick') return termAt(STICK, r.n + 1);",
      why:"the game oracle itself would be off by one" },
    { file:"index", via:"index", expect:"computed answer is",
      find:"    if (r.kind === 'index'){ var f = findIndex(r.pat, r.v); return f.ok ? f.index : null; }",
      replace:"    if (r.kind === 'index'){ var f = findIndex(r.pat, r.v); return f.ok ? f.quo : null; }",
      why:"the game oracle would forget the + 1" },
    { file:"index", via:"index", expect:"computed answer is",
      find:"    { kind:'which', list:[1, 3, 6, 10, 15], opts:['up', 'down', 'mul', 'grow'], ans:3 },",
      replace:"    { kind:'which', list:[1, 3, 6, 10, 15], opts:['up', 'down', 'mul', 'grow'], ans:1 },",
      why:"the classification round would mark the wrong rule" },
    { file:"index", via:"index", expect:"plEn does not handle the singular/plural split",
      find:"  function plEn(n, w){ return n === 1 ? w : w + 's'; }",
      replace:"  function plEn(n, w){ return w + 's'; }",
      why:"one hops would ship" },
    { file:"index", via:"index", expect:"peopleEn does not handle person/people",
      find:"  function peopleEn(n){ return n === 1 ? 'person' : 'people'; }",
      replace:"  function peopleEn(n){ return 'people'; }",
      why:"one people would ship" },
    { file:"index", via:"index", expect:"isAreEn does not handle is/are",
      find:"  function isAreEn(n){ return n === 1 ? 'is' : 'are'; }",
      replace:"  function isAreEn(n){ return 'are'; }",
      why:"one table are enough would ship" },
    { file:"index", via:"index", expect:"ordEn(13) = 13rd, expected 13th",
      find:"    if (v >= 11 && v <= 13) return n + 'th';",
      replace:"    if (v >= 11 && v <= 12) return n + 'th';",
      why:"thirteenth would be spelled 13rd" },
    { file:"index", via:"index", expect:"the oracle says",
      find:"          opts:['4','5','9','3'], ans:0,\n          why:'把相鄰兩個相減",
      replace:"          opts:['4','5','9','3'], ans:1,\n          why:'把相鄰兩個相減",
      why:"the first question would mark 5 correct instead of 4" },
    { file:"index", via:"index", expect:"stem is not the pinned text",
      find:"一串數字是 <strong>5、9、13、17</strong>。每次加多少？",
      replace:"一串數字是 <strong>5、9、13、18</strong>。每次加多少？",
      why:"the run in the stem would stop having equal gaps" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"why:'39 比第 1 個 3 多了 36；每一步走 4，36 ÷ 4 ＝ 9 剛好除得盡，走了 9 步。",
      replace:"why:'39 比第 1 個 3 多了 36；每一步走 4，36 ÷ 4 ＝ 8 剛好除得盡，走了 9 步。",
      why:"an explanation would carry a wrong division" },
    { file:"index", via:"index", expect:"the oracle says",
      find:"          opts:['48','37','36','40'], ans:1,\n          why:'從第 1 個走到第 12 個",
      replace:"          opts:['48','37','36','40'], ans:3,\n          why:'從第 1 個走到第 12 個",
      why:"the matchstick word problem would mark 40 correct" },
    { file:"index", via:"index", expect:"stem is not the pinned text",
      find:"從<strong>第 1 個</strong>走到<strong>第 15 個</strong>，一共走了幾步？",
      replace:"從<strong>第 1 個</strong>走到<strong>第 15 個</strong>，第 15 個是多少？",
      why:"the hops question would silently become a value question" },
    { file:"index", via:"index", expect:"the oracle says",
      find:"          opts:['5','7','6','8'], ans:1,\n          why:'第 1 個到",
      replace:"          opts:['5','7','6','8'], ans:0,\n          why:'第 1 個到",
      why:"the find-the-gap-from-two-terms answer would be off" },
    { file:"index", via:"index", expect:"is the one formula this whole lesson turns on",
      find:"footer:'把整頁縮成一句：<strong>先把每一個差都算出來；<strong>差都一樣而且越走越大</strong>的時候，記住「從第 1 個走到第 n 個只走了 n － 1 步」—— 第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數；越走越小的時候整條換成 第 n 個 ＝ 第 1 個 － (n － 1) × <strong>每次減的數</strong>。</strong>'",
      replace:"footer:'把整頁縮成一句：<strong>先把每一個差都算出來，再照速查卡上那一條算式算下去。</strong>'",
      why:"the lesson page footer would stop stating the formula at all" },
    { file:"index", via:"index", expect:"is the other grade-5 boundary",
      find:"<strong>交換律、結合律、分配律</strong>是五年級的「運算律魔術師」。這一課<strong>不列含未知數的方程式、不教運算律</strong>，也<strong>不用負數</strong> —— 每一個答案都是 0 或比 0 大的整數。',",
      replace:"<strong>那些運算律</strong>是五年級的「運算律魔術師」。這一課<strong>不列含未知數的方程式、不教運算律</strong>，也<strong>不用負數</strong> —— 每一個答案都是 0 或比 0 大的整數。',",
      why:"the scope note would stop naming the grade-5 unit it hands off to" },
    { file:"reference", via:"index", expect:"is the reverse formula, and the + 1 is exactly what children drop",
      find:"f2:'第幾個 ＝ (那個數 － 第 1 個) ÷ 每次加的數 ＋ 1<span class=\"cond\">",
      replace:"f2:'第幾個 ＝ (那個數 － 第 1 個) ÷ 每次加的數<span class=\"cond\">",
      why:"the cheat sheet would drop the + 1 from the reverse formula" },
    { file:"reference", via:"index", expect:"must match the lesson page word for word",
      find:"f1:'第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數<span class=\"cond\">",
      replace:"f1:'第 n 個 ＝ 第 1 個 ＋ n × 每次加的數<span class=\"cond\">",
      why:"the cheat sheet formula would drift from the lesson page" },
    { file:"parents", via:"index", expect:"is the grade-5 boundary spelled out for the adult",
      find:"s5note:'⚠️ 這一課刻意<strong>不教</strong>：<strong>用 ☐ 或英文字母列式解未知數</strong>",
      replace:"s5note:'⚠️ 這一課刻意<strong>不教</strong>：<strong>那一類列式</strong>",
      why:"the parents page would stop naming what is deliberately left out" },
    { file:"review", via:"index", expect:"is the rule name the generators must use",
      find:"        up:'每次加一樣多',",
      replace:"        up:'每次都加同樣多',",
      why:"the generators would use a different name for the same rule" },
    { file:"review", via:"index", expect:"no longer declares the generator \"hopsBetween\"",
      find:"    { id:'hopsBetween', cat:'steps',",
      replace:"    { id:'hopsBetweenX', cat:'steps',",
      why:"a generator would vanish and its whole invariant set with it" },
    { file:"review", via:"index", expect:"canvas constants do not match the independent spec",
      find:"  var FIG_W = 360, FIG_H = 140, FIG_PAD = 16;",
      replace:"  var FIG_W = 360, FIG_H = 140, FIG_PAD = 8;",
      why:"the review canvas would drift from the independent spec" },
    { file:"review", via:"index", expect:"viewBox does not follow its own canvas constants",
      find:"        svg.setAttribute('viewBox', '0 0 360 140');",
      replace:"        svg.setAttribute('viewBox', '0 0 380 140');",
      why:"the drawn viewBox would stop matching the coordinates" },
    { file:"review", via:"review", expect:"is too small to read off the run",
      find:"          var gap = pick(rangeList(2, 25));\n          var len = pick([4, 5]);",
      replace:"          var gap = pick(rangeList(1, 25));\n          var len = pick([4, 5]);",
      why:"a gap of 1 would make the run unreadable as a rule" },
    { file:"review", via:"review", expect:"a rule needs 5 numbers shown to be decidable",
      find:"            var cand = firstTerms(pat, 5);\n            var ok = true;",
      replace:"            var cand = firstTerms(pat, 4);\n            var ok = true;",
      why:"four numbers would be offered where five are needed" },
    { file:"review", via:"review", expect:"opts[ans] is not the computed next term",
      find:"          return { key:kind, pat:pat, list:list, next:nxt, opts:opts, ans:opts.indexOf(nxt) };",
      replace:"          return { key:kind, pat:pat, list:list, next:nxt, opts:opts, ans:0 };",
      why:"the scored option would stop being the computed next term" },
    { file:"review", via:"review", expect:"is small enough to count out one by one",
      find:"          var n = pick(rangeList(10, 30));\n          var pat = { kind:'up', first:first, gap:gap };",
      replace:"          var n = pick(rangeList(2, 30));\n          var pat = { kind:'up', first:first, gap:gap };",
      why:"the position asked for would be countable without the formula" },
    { file:"review", via:"review", expect:"is not first + n × gap",
      find:"          var offByOne = first + n * gap;\n          /* ⚠️ 題幹裡有一個字面的 1",
      replace:"          var offByOne = first + (n - 1) * gap;\n          /* ⚠️ 題幹裡有一個字面的 1",
      why:"the distractor the question exists for would become the answer" },
    { file:"review", via:"review", expect:"the \"forgot the + 1\" distractor is missing from the options",
      find:"          if (list.indexOf(f.quo) >= 0 || f.quo === v) return null;",
      replace:"          if (false) return null;",
      why:"the key distractor would sometimes be filtered away silently" },
    { file:"review", via:"review", expect:"is ALSO in the pattern",
      find:"          var offs = shuffle(rangeList(1, gap - 1));\n          var miss = [hit + offs[0], hit - offs[offs.length > 1 ? 1 : 0]];\n          var below = first - pick(rangeList(1, first - 1));\n          var all = [hit, miss[0], miss[1], below];\n          var stemNums = list.concat([gap]);\n          for (var i = 0; i < all.length; i++){\n            if (!inRange(all[i])) return null;\n            if (i > 0 && findIndex(pat, all[i]).ok) return null;",
      replace:"          var offs = [gap, gap];\n          var miss = [hit + offs[0], hit - offs[offs.length > 1 ? 1 : 0]];\n          var below = first - pick(rangeList(1, first - 1));\n          var all = [hit, miss[0], miss[1], below];\n          var stemNums = list.concat([gap]);\n          for (var i = 0; i < all.length; i++){\n            if (!inRange(all[i])) return null;\n            if (i > 0 && false) return null;",
      why:"two options would be in the pattern at once, so two answers would be correct" },
    { file:"review", via:"review", expect:"distractor is required, got 0",
      find:"          var below = first - pick(rangeList(1, first - 1));",
      replace:"          var below = hit + gap - 1;",
      why:"the \"below the 1st one\" reason would lose its distractor, so that half of the rule goes untested" },
    { file:"review", via:"review", expect:"steps is not b",
      find:"          var steps = b - a;\n          var opts = numOpts(steps,",
      replace:"          var steps = b - a + 1;\n          var opts = numOpts(steps,",
      why:"the hop count would be off by one" },
    { file:"review", via:"review", expect:"the figure claims",
      find:"          var figBars = termAt(STICK, nFig);",
      replace:"          var figBars = termAt(STICK, nFig + 1);",
      why:"the stem would report more sticks than the figure draws" },
    { file:"review", via:"review", expect:"misconception distractor is missing",
      find:"          var opts = numOpts(val, [STICK.first * nAsk, val + STICK.gap, val - STICK.gap, val - 1],",
      replace:"          var opts = numOpts(val, [val + 2 * STICK.gap, val + STICK.gap, val - STICK.gap, val - 1],",
      why:"the 3-times-how-many misconception would stop being offered" },
    { file:"review", via:"review", expect:"joining loses two sides",
      find:"    { key:'triangle', first:3, gap:1 }",
      replace:"    { key:'triangle', first:3, gap:2 }",
      why:"a triangular table would be claimed to add 2 seats instead of 1" },
    { file:"review", via:"review", expect:"sides, so it seats",
      find:"    { key:'square',   first:4, gap:2 },",
      replace:"    { key:'square',   first:5, gap:2 },",
      why:"a square table would be claimed to seat 5" },
    { file:"review", via:"review", expect:"val disagrees with the recurrence",
      find:"          var first = val + (n - 1) * gap;\n          if (!inRange(first)) return null;\n          var pat = { kind:'down', first:first, gap:gap };\n          var list = firstTerms(pat, 4);\n          for (var i = 0; i < list.length; i++) if (!inRange(list[i])) return null;\n          if (kindOf(list) !== 'down') return null;\n          if (termAt(pat, n) !== val) return null;",
      replace:"          var first = val + (n - 2) * gap;\n          if (!inRange(first)) return null;\n          var pat = { kind:'down', first:first, gap:gap };\n          var list = firstTerms(pat, 4);\n          for (var i = 0; i < list.length; i++) if (!inRange(list[i])) return null;\n          if (kindOf(list) !== 'down') return null;\n          if (false) return null;",
      why:"the falling pattern would not actually reach the stated answer" },
    { file:"review", via:"review", expect:"is not floor(total / k)",
      find:"          var byK = Math.floor(total / k);       // 除以 k 的錯算法，永遠比 gap 小",
      replace:"          var byK = Math.ceil(total / k);       // 除以 k 的錯算法，永遠比 gap 小",
      why:"the divided-by-k distractor could equal the right answer" },
    { file:"review", via:"review", expect:"leaves too few hops for the off-by-one to bite",
      find:"          var k = pick(rangeList(4, 9));",
      replace:"          var k = pick(rangeList(2, 9));",
      why:"two terms next to each other would make the off-by-one invisible" },
    { file:"review", via:"review", expect:"contains no checkable equation at all",
      find:"            ? '先把每一個差算出來：' + t.listOf(g) + '。' + extra + '所以它是<strong>' + t.kindName[d.key] + '</strong>。'",
      replace:"            ? '先把每一個差算出來：' + t.listOf(g) + '。所以它是<strong>' + t.kindName[d.key] + '</strong>。'",
      why:"the explanation would state a conclusion with no working" },
    { file:"review", via:"review", expect:"arithmetic is wrong",
      find:"              ' ÷ ' + d.gap + ' ＝ ' + d.quo + '，剛好除得盡，走了 ' + d.quo + ' 步。走了 ' + d.quo +",
      replace:"              ' ÷ ' + d.gap + ' ＝ ' + (d.quo + 1) + '，剛好除得盡，走了 ' + d.quo + ' 步。走了 ' + d.quo +",
      why:"the explanation would print a wrong division" },
    { file:"review", via:"review", expect:"stem never says",
      find:"            ? '一串數字是 <strong>' + t.listOf(d.list) + '</strong>。每一個差都一樣 —— ' +",
      replace:"            ? '一串數字是 <strong>' + t.listOf(d.list) + '</strong>。看一下這一串 —— ' +",
      why:"the stem would stop telling the child the gaps are equal" },
    { file:"review", via:"review", expect:"stem never says",
      find:"            ? '一個規律是 <strong>' + t.listOf(d.list) + '…</strong>。<strong>' + d.v + '</strong> 是第幾個？'",
      replace:"            ? '一個規律是 <strong>' + t.listOf(d.list) + '…</strong>。<strong>' + d.v + '</strong> 的下一個是多少？'",
      why:"the stem would ask a different question from the one scored" },
    { file:"index", via:"index", expect:"missing the CSS rule",
      find:"  .stonebox{display:inline-block;text-align:center;min-width:56px}",
      replace:"  .stonebox{text-align:center;min-width:56px}",
      why:"the stone boxes would collapse to slivers again" },
    { file:"index", via:"index", expect:"missing the CSS rule",
      find:"    display:block;background:var(--green-soft);border:2px solid var(--green);color:var(--green);",
      replace:"    background:var(--green-soft);border:2px solid var(--green);color:var(--green);",
      why:"the number would sit inline beside its label again" },
    { file:"index", via:"index", expect:"missing the CSS rule",
      find:"  .stonebox .who{display:block;font-size:12px;color:var(--muted);margin-top:2px}",
      replace:"  .stonebox .who{font-size:12px;color:var(--muted);margin-top:2px}",
      why:"the position label would glue onto the number again" },
    { file:"index", via:"index", expect:"the drawn count must be smaller",
      find:"    { kind:'stick', n:8, figN:3, opts:[16, 17, 19, 24], ans:1 }",
      replace:"    { kind:'stick', n:8, figN:8, opts:[16, 17, 19, 24], ans:1 }",
      why:"the game would draw the very figure it asks about, so the answer could be counted off the picture" },
    { file:"index", via:"index", expect:"the narration must not count",
      find:"          ? '從第 1 個走到第 ' + n + ' 個要跳 <strong>' + steps + '</strong> 次",
      replace:"          ? '從第 1 個走到第 ' + n + ' 個，中間有 <strong>' + steps + '</strong> 個箭頭",
      why:"the abbreviated figure would again be described as showing every arrow" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"      var gg = [];\n      for (var k = 0; k + 1 < g.length; k++) gg.push(g[k + 1] - g[k]);",
      replace:"      var gg = gapList(g);",
      why:"the growing-gap test would go back to absolute second differences, so a run with SHRINKING gaps (1, 4, 6, 7) counts as growing" },
    { file:"index", via:"index", expect:"the narration for Example 1 must be chosen by kindOf",
      find:"      if (kind === 'up' || kind === 'down') s1narr.innerHTML = d.s1narrSame(gaps[0], kind === 'up' ? 'up' : 'down');",
      replace:"      if (allSame(gaps)) s1narr.innerHTML = d.s1narrSame(gaps[0], dir);",
      why:"the narration could again announce a rule the classifier itself rejects" },
    { file:"index", via:"index", expect:"the game must report the points it actually took off",
      find:"          var lost = Math.min(5, gScore);\n          gScore -= lost;",
      replace:"          var lost = 5;\n          gScore = Math.max(0, gScore - 5);",
      why:"the message would claim 5 points off while the score floor kept them" },
    { file:"index", via:"index", expect:"which is the formula with the (n",
      find:"footer:'把整頁縮成一句：<strong>先把每一個差都算出來；<strong>差都一樣而且越走越大</strong>的時候，記住「從第 1 個走到第 n 個只走了 n － 1 步」—— 第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數；越走越小的時候整條換成 第 n 個 ＝ 第 1 個 － (n － 1) × <strong>每次減的數</strong>。</strong>'",
      replace:"footer:'把整頁縮成一句：<strong>第 n 個 ＝ 第 1 個 ＋ n × 每次加的數。</strong>'",
      why:"the footer would state the formula with the minus one dropped" },
    { file:"review", via:"review", expect:"the stem and the scored answer are no longer about the same question",
      find:"            : 'A pattern has <strong>' + d.first + ' as its 1st one</strong> and <strong>adds ' + d.gap +\n              ' every time</strong>. What is <strong>' + t.nth(d.n) + '</strong>?',",
      replace:"            : 'A pattern has <strong>' + d.first + ' as its 1st one</strong> and <strong>adds ' + d.gap +\n              ' every time</strong>. What is <strong>' + t.nth(d.n + 1) + '</strong>?',",
      why:"the stem would ask for a different position from the one the answer was computed for" },
    { file:"index", via:"index", expect:"en marks",
      find:"          opts:['Yes, at position 8','Yes, at position 9','No, because 50 is below 4','No, because 50 − 4 = 46 and 46 ÷ 6 does not divide exactly'], ans:3,",
      replace:"          opts:['Yes, at position 8','Yes, at position 9','No, because 50 is below 4','No, because 50 − 4 = 46 and 46 ÷ 6 does not divide exactly'], ans:2,",
      why:"the English bank would mark a different option from the Chinese one at the same index" },
    { file:"index", via:"index", expect:"but the reference fit gives",
      find:"      if (gg.length >= 2 && allSame(gg) && gg[0] > 0) return 'grow';",
      replace:"      if (gg.length && allSame(gg) && gg[0] > 0) return 'grow';",
      why:"a three-number run would be named \"the amount added grows\", and then mul and grow would not be exclusive" },
    { file:"index", via:"index", expect:"must only be drawn when kindOf() says \"grow\"",
      find:"      } else if (kind === 'grow'){",
      replace:"      } else if (kind !== 'zzz'){",
      why:"a shrinking-gap run would print negative second gaps on a page that promises none" },
    { file:"index", via:"index", expect:"claims reasons that need not hold",
      find:"      s1narrOther:'每一個差都算過了，可是這一串<strong>不符合</strong>這一課教的三種規律。（規律的種類不只這三種，這一課只做那三種。）',",
      replace:"      s1narrOther:'每一個差都算過了，可是這一串<strong>不符合</strong>這一課的三種規律 —— 差不一樣、差的差也不一樣。（規律的種類不只這三種。）',",
      why:"the \"none of the rules\" narration would again assert reasons that need not hold" },
    { file:"index", via:"index", expect:"leaves the factor still called",
      find:"第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數；越走越小的時候整條換成 第 n 個 ＝ 第 1 個 － (n － 1) × <strong>每次減的數</strong>。</strong>'",
      replace:"第 n 個 ＝ 第 1 個 ＋ (n － 1) × 每次加的數（越走越小就把 ＋ 換成 －）。</strong>'",
      why:"the falling case would again be reduced to \"swap the sign\" while the factor kept the wrong name" },
    { file:"reference", via:"index", expect:"is true of the matchsticks but not of the tables",
      find:"s5note:'⚠️ <strong>圖形接在一起的時候，不可以用「第 1 個的數量 × 幾個」。</strong>火柴棒的相鄰三角形<strong>每一個接縫都共用一根</strong>，那個乘法會把每一根共用的火柴棒<strong>算兩次</strong>；桌子拼起來則是<strong>每一個接縫都有兩邊坐不了人</strong>，那個乘法會把<strong>坐不了的位子也算進去</strong>。兩種情形不一樣，可是結論一樣：算出來會太多。",
      replace:"s5note:'⚠️ <strong>圖形接在一起的時候，不可以用「第 1 個的數量 × 幾個」。</strong>火柴棒的相鄰三角形<strong>每一個接縫都共用一根</strong>、桌子拼起來<strong>每一個接縫都有兩邊坐不了人</strong>，那些共用的部分會被算兩次。",
      why:"the two situations would again be given one explanation that only fits one of them" },
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      gapOfRun: d => {
        if (!d) return 'gapOfRun: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.kind !== 'up' && d.kind !== 'down') return 'gapOfRun: kind must be up or down, got ' + d.kind;
        if (!(d.gap >= 2)) return 'gapOfRun: the gap ' + d.gap + ' is too small to read off the run';
        if (d.list.length !== d.len) return 'gapOfRun: the run has ' + d.list.length + ' numbers but len says ' + d.len;
        if (d.len < 4) return 'gapOfRun: fewer than 4 numbers means fewer than 3 gaps — "every gap is the same" is not shown';
        const want = termsRef({ kind:d.kind, first:d.first, gap:d.gap }, d.len);
        if (want.join(',') !== d.list.join(',')) return 'gapOfRun: the run is not the pattern it claims (' + d.list + ' vs ' + want + ')';
        if (kindRef(d.list) !== d.kind) return 'gapOfRun: the reference classifier says ' + kindRef(d.list) + ', not ' + d.kind;
        for (const v of d.list) if (!inRangeRef(v)) return 'gapOfRun: ' + v + ' is outside 0..' + VAL_MAX_REF;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'gapOfRun: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.gap) return 'gapOfRun: opts[ans] is not the computed gap';
        for (const o of d.opts) if (o !== d.gap && d.list.indexOf(o) >= 0)
          return 'gapOfRun: distractor ' + o + ' is one of the numbers printed in the stem';
      },
      whichKind: d => {
        if (!d) return 'whichKind: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const ref = kindRef(d.list);
        if (ref !== d.key) return 'whichKind: the reference classifier says ' + ref + ', not ' + d.key;
        if (d.list.length !== 5) return 'whichKind: a rule needs 5 numbers shown to be decidable, got ' + d.list.length;
        const want = termsRef(d.pat, 5);
        if (want.join(',') !== d.list.join(',')) return 'whichKind: the run is not generated by its own pattern object';
        for (const v of d.list) if (!inRangeRef(v)) return 'whichKind: ' + v + ' is outside 0..' + VAL_MAX_REF;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'whichKind: options are not the four rule names';
        if (['up', 'down', 'mul', 'grow'].some(k => d.opts.indexOf(k) < 0)) return 'whichKind: one of the four rule names is missing from the options';
        if (d.opts[d.ans] !== d.key) return 'whichKind: opts[ans] is not the computed rule';
      },
      nextTerm: d => {
        if (!d) return 'nextTerm: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const ref = kindRef(d.list);
        if (ref !== d.key) return 'nextTerm: the reference classifier says ' + ref + ', not ' + d.key;
        if (termRef(d.pat, 5) !== d.next) return 'nextTerm: next is ' + d.next + ' but the recurrence gives ' + termRef(d.pat, 5);
        if (kindRef(d.list.concat([d.next])) !== d.key)
          return 'nextTerm: adding the answer changes the rule to ' + kindRef(d.list.concat([d.next]));
        if (!inRangeRef(d.next)) return 'nextTerm: the answer ' + d.next + ' is outside 0..' + VAL_MAX_REF;
        for (const v of d.list) if (!inRangeRef(v)) return 'nextTerm: ' + v + ' is outside 0..' + VAL_MAX_REF;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nextTerm: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.next) return 'nextTerm: opts[ans] is not the computed next term';
        /* mul／grow 的重點正是「差不一樣」 —— 第一個差和最後一個差必須真的不同。 */
        const g = d.list.slice(1).map((v, i) => Math.abs(v - d.list[i]));
        if ((d.key === 'mul' || d.key === 'grow') && g[0] === g[g.length - 1])
          return 'nextTerm: a ' + d.key + ' run whose first and last gap agree cannot teach "work out every gap"';
      },
      nthFromStart: d => {
        if (!d) return 'nthFromStart: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 10)) return 'nthFromStart: n=' + d.n + ' is small enough to count out one by one, so nothing is being taught';
        const want = termRef({ kind:'up', first:d.first, gap:d.gap }, d.n);
        if (want !== d.val) return 'nthFromStart: val ' + d.val + ' but the recurrence gives ' + want;
        if (d.offByOne !== d.first + d.n * d.gap) return 'nthFromStart: the off-by-one distractor is not first + n × gap';
        if (d.offByOne === d.val) return 'nthFromStart: the off-by-one distractor equals the answer, so it teaches nothing';
        if (!inRangeRef(d.val)) return 'nthFromStart: the answer ' + d.val + ' is outside 0..' + VAL_MAX_REF;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nthFromStart: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.val) return 'nthFromStart: opts[ans] is not the computed term';
        for (const o of d.opts) if (o !== d.val && [d.first, d.gap, d.n].indexOf(o) >= 0)
          return 'nthFromStart: distractor ' + o + ' is copied straight out of the stem';
      },
      nthFromList: d => {
        if (!d) return 'nthFromList: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (kindRef(d.list) !== 'up') return 'nthFromList: the run shown is not an "add the same amount" pattern';
        if (d.list.length !== 4) return 'nthFromList: four numbers are needed before the rule is readable';
        if (termRef({ kind:'up', first:d.first, gap:d.gap }, d.n) !== d.val)
          return 'nthFromList: val disagrees with the recurrence';
        if (d.list.indexOf(d.val) >= 0) return 'nthFromList: the answer is already printed in the stem';
        if (!(d.n > d.list.length + 3)) return 'nthFromList: n=' + d.n + ' is close enough to the shown run to just count on';
        if (d.opts[d.ans] !== d.val) return 'nthFromList: opts[ans] is not the computed term';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nthFromList: options are not four distinct numbers';
      },
      whichIndex: d => {
        if (!d) return 'whichIndex: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const ref = findIndexRef({ kind:'up', first:d.first, gap:d.gap }, d.v);
        if (!ref.ok) return 'whichIndex: the reference walk says ' + d.v + ' is not in the pattern';
        if (ref.index !== d.idx) return 'whichIndex: idx ' + d.idx + ' but the reference walk gives ' + ref.index;
        if (d.quo !== d.idx - 1) return 'whichIndex: the "forgot the + 1" distractor must be idx − 1';
        if (d.diff !== d.v - d.first) return 'whichIndex: the quoted difference is wrong';
        if (!(d.idx >= 8)) return 'whichIndex: idx=' + d.idx + ' is countable on fingers from the run shown';
        if (d.opts.indexOf(d.quo) < 0) return 'whichIndex: the "forgot the + 1" distractor is missing from the options';
        if (d.opts[d.ans] !== d.idx) return 'whichIndex: opts[ans] is not the computed position';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'whichIndex: options are not four distinct numbers';
      },
      inPattern: d => {
        if (!d) return 'inPattern: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const pat = { kind:'up', first:d.first, gap:d.gap };
        const hitRef = findIndexRef(pat, d.hit);
        if (!hitRef.ok || hitRef.index !== d.idx) return 'inPattern: the answer is not at the position claimed';
        if (d.list.indexOf(d.hit) >= 0) return 'inPattern: the answer is one of the numbers printed in the stem';
        let below = 0, notdiv = 0;
        for (const o of d.opts){
          if (o === d.hit) continue;
          const r = findIndexRef(pat, o);
          if (r.ok) return 'inPattern: distractor ' + o + ' is ALSO in the pattern — two options are correct';
          if (r.why === 'below') below++;
          else if (r.why === 'notdiv') notdiv++;
          else return 'inPattern: distractor ' + o + ' fails for an unexpected reason (' + r.why + ')';
        }
        /* 課程明講兩種「不在」的理由，兩種都要真的出現在選項裡，
           不然那兩句話只是文案。 */
        if (below !== 1) return 'inPattern: exactly one "below the 1st one" distractor is required, got ' + below;
        if (notdiv !== 2) return 'inPattern: exactly two "does not divide exactly" distractors are required, got ' + notdiv;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'inPattern: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.hit) return 'inPattern: opts[ans] is not the number that is in the pattern';
        for (const o of d.opts) if (!inRangeRef(o)) return 'inPattern: option ' + o + ' is outside 0..' + VAL_MAX_REF;
      },
      hopsBetween: d => {
        if (!d) return 'hopsBetween: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.steps !== d.b - d.a) return 'hopsBetween: steps is not b − a';
        if (!(d.b > d.a)) return 'hopsBetween: b must be after a';
        if (!(d.steps >= 3)) return 'hopsBetween: a gap of ' + d.steps + ' is too small for the off-by-one to matter';
        if (d.opts.indexOf(d.steps + 1) < 0 && d.opts.indexOf(d.steps - 1) < 0)
          return 'hopsBetween: neither off-by-one distractor is offered, so the point of the question is untested';
        if (d.opts[d.ans] !== d.steps) return 'hopsBetween: opts[ans] is not b − a';
        for (const o of d.opts) if (o !== d.steps && [d.a, d.b].indexOf(o) >= 0)
          return 'hopsBetween: distractor ' + o + ' is copied straight out of the stem';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'hopsBetween: options are not four distinct numbers';
      },
      stickCount: d => {
        if (!d) return 'stickCount: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        /* 圖上的棒子數必須剛好等於課程教的規律，否則孩子數出來的和題幹說的不同。 */
        if (d.figBars !== 2 * d.nFig + 1) return 'stickCount: the figure claims ' + d.figBars + ' sticks, the rule gives ' + (2 * d.nFig + 1);
        if (d.val !== 2 * d.nAsk + 1) return 'stickCount: the answer ' + d.val + ' is not 2 × ' + d.nAsk + ' + 1';
        if (termRef({ kind:'up', first:3, gap:2 }, d.nAsk) !== d.val) return 'stickCount: the answer disagrees with the recurrence';
        if (!(d.nFig >= 1 && d.nFig <= 5)) return 'stickCount: the drawn figure must have 1..5 triangles to stay readable, got ' + d.nFig;
        if (!(d.nAsk >= 8)) return 'stickCount: nAsk=' + d.nAsk + ' is small enough to draw and count';
        if (d.opts.indexOf(3 * d.nAsk) < 0) return 'stickCount: the "3 × how many" misconception distractor is missing';
        if (3 * d.nAsk === d.val) return 'stickCount: the misconception distractor coincides with the answer';
        if (d.opts[d.ans] !== d.val) return 'stickCount: opts[ans] is not the computed stick count';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'stickCount: options are not four distinct numbers';
        const bad = checkStickPlan(d.fig, d.nFig, FIG_REF.review, 'stickCount fig');
        if (bad.length) return bad[0];
      },
      seatCount: d => {
        if (!d) return 'seatCount: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (['square', 'triangle'].indexOf(d.deskKey) < 0) return 'seatCount: unknown table shape ' + d.deskKey;
        /* 兩種桌形的數字都要算得出來：每邊坐 1 人，接縫少掉兩個位子。
           正方形 4 邊 → 1 張 4 人、每多一張 4 － 2 ＝ 2 人；
           正三角形 3 邊 → 1 張 3 人、每多一張 3 － 2 ＝ 1 人。 */
        const sides = (d.deskKey === 'square') ? 4 : 3;
        if (d.first !== sides) return 'seatCount: a ' + d.deskKey + ' table has ' + sides + ' sides, so it seats ' + sides + ', not ' + d.first;
        if (d.gap !== sides - 2) return 'seatCount: joining loses two sides, so each extra table adds ' + (sides - 2) + ', not ' + d.gap;
        if (termRef({ kind:'up', first:d.first, gap:d.gap }, d.n) !== d.val) return 'seatCount: val disagrees with the recurrence';
        if (d.opts.indexOf(d.first * d.n) < 0) return 'seatCount: the "seats per table × how many" misconception distractor is missing';
        if (d.first * d.n === d.val) return 'seatCount: the misconception distractor coincides with the answer';
        if (d.opts[d.ans] !== d.val) return 'seatCount: opts[ans] is not the computed seat count';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'seatCount: options are not four distinct numbers';
      },
      downNth: d => {
        if (!d) return 'downNth: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (kindRef(d.list) !== 'down') return 'downNth: the run shown is not a "subtract the same amount" pattern';
        if (termRef({ kind:'down', first:d.first, gap:d.gap }, d.n) !== d.val) return 'downNth: val disagrees with the recurrence';
        /* 四年級不用負數：問到的那一項必須還是正的。 */
        if (!(d.val >= 1)) return 'downNth: the answer ' + d.val + ' is not a positive whole number — this lesson has no negatives';
        for (const v of d.list) if (!inRangeRef(v)) return 'downNth: ' + v + ' is outside 0..' + VAL_MAX_REF;
        for (const o of d.opts) if (!inRangeRef(o)) return 'downNth: option ' + o + ' is outside 0..' + VAL_MAX_REF;
        if (d.list.indexOf(d.val) >= 0) return 'downNth: the answer is already printed in the stem';
        if (d.opts[d.ans] !== d.val) return 'downNth: opts[ans] is not the computed term';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'downNth: options are not four distinct numbers';
      },
      gapFromTwo: d => {
        if (!d) return 'gapFromTwo: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.last !== d.first + (d.k - 1) * d.gap) return 'gapFromTwo: the kth term does not match first/gap/k';
        if (d.total !== d.last - d.first) return 'gapFromTwo: the quoted total is wrong';
        if (d.byK !== Math.floor(d.total / d.k)) return 'gapFromTwo: the "divide by k" distractor is not floor(total / k)';
        if (d.remK !== d.total - d.byK * d.k) return 'gapFromTwo: the quoted remainder of the wrong division is wrong';
        /* 「除以 k」永遠比「除以 k － 1」小，所以它一定是個真的錯答案。 */
        if (!(d.byK < d.gap)) return 'gapFromTwo: dividing by k gave ' + d.byK + ', which is not below the real gap ' + d.gap;
        if (!(d.k >= 4)) return 'gapFromTwo: k=' + d.k + ' leaves too few hops for the off-by-one to bite';
        if (d.opts[d.ans] !== d.gap) return 'gapFromTwo: opts[ans] is not the computed gap';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'gapFromTwo: options are not four distinct numbers';
        for (const o of d.opts) if (o !== d.gap && [d.first, d.last, d.k, d.total].indexOf(o) >= 0)
          return 'gapFromTwo: distractor ' + o + ' is copied straight out of the stem';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數，
       完全不呼叫 review.html 的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      const KIND_TXT = {
        zh:{ up:'每次加一樣多', down:'每次減一樣多', mul:'每次乘一樣多', grow:'加的數自己每次加一樣多' },
        en:{ up:'It adds the same amount every time', down:'It subtracts the same amount every time',
             mul:'It multiplies by the same amount every time',
             grow:'The amount it adds grows by the same amount every time' }
      };
      switch (genId){
        case 'gapOfRun':     return String(Math.abs(d.list[1] - d.list[0]));
        case 'whichKind':    return KIND_TXT[lang][kindRef(d.list)];
        case 'nextTerm':     return String(termRef(d.pat, 5));
        case 'nthFromStart': return String(termRef({ kind:'up', first:d.first, gap:d.gap }, d.n));
        case 'nthFromList':  return String(termRef({ kind:'up', first:d.list[0], gap:d.list[1] - d.list[0] }, d.n));
        case 'whichIndex':   return String(findIndexRef({ kind:'up', first:d.first, gap:d.gap }, d.v).index);
        case 'inPattern':    return String(d.opts.filter(o => findIndexRef({ kind:'up', first:d.first, gap:d.gap }, o).ok)[0]);
        case 'hopsBetween':  return String(d.b - d.a);
        case 'stickCount':   return String(2 * d.nAsk + 1);
        case 'seatCount':    return String(termRef({ kind:'up', first:(d.deskKey === 'square' ? 4 : 3),
                                                     gap:(d.deskKey === 'square' ? 2 : 1) }, d.n));
        case 'downNth':      return String(termRef({ kind:'down', first:d.list[0], gap:d.list[0] - d.list[1] }, d.n));
        case 'gapFromTwo':   return String((d.last - d.first) / (d.k - 1));
        default: return null;
      }
    },

    /* 選項長什麼樣、範圍多少。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (!s || !String(s).trim()) return 'empty option';
      if (/undefined|NaN|\[object|null|·|#/.test(String(s))) return 'option leaks an internal value: ' + s;
      if (/<[a-z]/i.test(String(s))) return 'option contains markup: ' + s;
      if (lang === 'en' && /[一-鿿]/.test(String(s))) return 'English option contains Chinese: ' + s;
      if (genId === 'whichKind'){
        if (/^\d/.test(String(s))) return 'whichKind options must be rule names, not numbers: ' + s;
        return null;
      }
      if (!/^\d+$/.test(String(s))) return genId + ' option is not a plain whole number: ' + s;
      const n = Number(s);
      if (!inRangeRef(n)) return genId + ' option ' + n + " is outside this lesson's 0.." + VAL_MAX_REF;
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：題幹「問的是什麼」、解釋裡的每一條算式、
       以及畫面上真正看得到的字。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('not four options');
      if (new Set(q.opts.map(String)).size !== q.opts.length) out.push('two options render to the same text');
      /* ⚠️ 相同的**值**也算重複："4" 和 "04" 是兩個字串、一個答案。 */
      const numeric = q.opts.map(String).filter(x => /^\d+$/.test(x)).map(Number);
      if (new Set(numeric).size !== numeric.length)
        out.push('two options have the same numeric value: ' + q.opts.join(' | '));
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');

      /* 題幹問的是什麼 —— 只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
      const ASK = {
        zh:{
          gapOfRun:     { must:['每一個差都一樣'], never:['第幾個'] },
          whichKind:    { must:['哪一種規律'], never:['是多少'] },
          nextTerm:     { must:['下一個'], never:['第幾個'] },
          nthFromStart: { must:['第 1 個是', '每次加'], never:['是第幾個'] },
          nthFromList:  { must:['是多少'], never:['是第幾個'] },
          whichIndex:   { must:['是第幾個'], never:['下一個'] },
          inPattern:    { must:['在</strong>這個規律裡'], never:['是第幾個'] },
          hopsBetween:  { must:['走了幾步'], never:['是多少'] },
          stickCount:   { must:['要幾根'], never:['幾個三角形？'] },
          seatCount:    { must:['可以坐幾人'], never:['要幾張'] },
          downNth:      { must:['每次減'], never:['每次加'] },
          gapFromTwo:   { must:['每次加多少'], never:['是第幾個'] }
        },
        en:{
          gapOfRun:     { must:['Every gap is the same'], never:['which position'] },
          whichKind:    { must:['Which kind of rule'], never:['what is the'] },
          nextTerm:     { must:['What comes'], never:['which position'] },
          nthFromStart: { must:['as its 1st one', 'adds'], never:['Which position'] },
          nthFromList:  { must:['What is'], never:['Which position'] },
          whichIndex:   { must:['Which position'], never:['What comes'] },
          inPattern:    { must:['is in</strong> it'], never:['Which position'] },
          hopsBetween:  { must:['How many hops'], never:['What is the'] },
          stickCount:   { must:['How many sticks'], never:['How many triangles'] },
          seatCount:    { must:['How many people'], never:['How many tables'] },
          downNth:      { must:['subtracts'], never:['adds '] },
          gapFromTwo:   { must:['How much does it add'], never:['which position'] }
        }
      };
      const ask = ASK[lang][genId];
      if (!ask) out.push('no ASK entry for ' + genId + ' in ' + lang);
      else {
        for (const m of ask.must) if (q.stem.indexOf(m) < 0) out.push('stem never says "' + m + '"');
        for (const nv of ask.never) if (q.stem.indexOf(nv) >= 0) out.push('stem says "' + nv + '", which is a different question');
      }

      /* ⚠️ 題幹裡的**每一個數字**都要對得上 make() 留下的參數。
         只驗關鍵字的話，格式化函式可以印「第 21 個」而正解仍然是第 20 個的答案，
         所有不變條件都還是綠的（codex 判 critical）。 */
      const STEM_NUMS = {
        gapOfRun:     () => d.list.slice(),
        whichKind:    () => d.list.slice(),
        nextTerm:     () => d.list.slice(),
        nthFromStart: () => [1, d.first, d.gap, d.n],
        nthFromList:  () => d.list.concat([d.n]),
        whichIndex:   () => d.list.concat([d.v]),
        inPattern:    () => d.list.concat([d.gap]),
        hopsBetween:  () => [d.a, d.b],
        stickCount:   () => [d.nFig, d.figBars, 1, 3, 2, d.nAsk],
        seatCount:    () => (lang === 'zh' ? [1, 1, d.first, d.gap, d.n] : [1, d.first, d.gap, d.n]),
        downNth:      () => d.list.concat([d.gap, d.n]),
        gapFromTwo:   () => [1, d.first, d.k, d.last]
      };
      if (!STEM_NUMS[genId]) out.push('no STEM_NUMS entry for ' + genId);
      else {
        const want = STEM_NUMS[genId]().map(Number).sort((x, y) => x - y).join(',');
        const got = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || [])
                      .map(Number).sort((x, y) => x - y).join(',');
        if (want !== got)
          out.push('the rendered stem prints the numbers [' + got + '] but make() implies [' + want +
                   '] — the stem and the scored answer are no longer about the same question');
      }

      /* 解釋裡的每一條算式都要真的算對，而且至少要有一條 ——
         沒有算式的解釋等於只講結論。 */
      const ar = arithProblems(q.why);
      for (const p of ar.problems) out.push('why: ' + p);
      if (ar.verified < 1) out.push('the explanation contains no checkable equation at all');

      /* 畫面上看得到的字：中文黏數字、英文的 1、重複標點。 */
      for (const t of textProblems(q.stem, lang, 'stem')) out.push(t);
      for (const t of textProblems(q.why, lang, 'why')) out.push(t);
      for (let i = 0; i < q.opts.length; i++)
        for (const t of textProblems(q.opts[i], lang, 'option ' + i)) out.push(t);

      /* 有圖的那一題：圖必須真的存在，而且幾何要對。 */
      if (genId === 'stickCount'){
        if (!q.fig) out.push('stickCount rendered without a figure');
        else {
          for (const b of checkStickPlan(q.fig, q.fig.n, FIG_REF.review, 'rendered fig')) out.push(b);
          if (q.fig.n !== d.nFig) out.push('the figure draws ' + q.fig.n + ' triangles but the stem says ' + d.nFig);
          if (String(d.figBars) !== String(q.fig.bars.length))
            out.push('the stem says ' + d.figBars + ' sticks but the figure draws ' + q.fig.bars.length);
        }
      } else if (q.fig){
        out.push(genId + ' rendered a figure it should not have');
      }

      /* ⚠️ 一定要回字串或 null：空陣列在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{gapList, dirOf, allSame, ratioList, kindOf, termAt, firstTerms, stepsTo, ' +
                'offByOneValue, findIndex, plEn, peopleEn, isAreEn, ordEn, ' +
                'DIFF_CASES, STEP_PAT, STEP_NS, STONE_SHOW, FIND_PAT, FIND_TARGETS, ' +
                'STICK, STICK_NS, STICK_FAR, SEAT, SEAT_ROWS, SEAT_FAR, ' +
                'FIG_W, FIG_H, FIG_PAD, FIG_MIN_SIDE, SQ3H, stickPlan, ROUNDS, roundAnswer}',
    optionValueMax: VAL_MAX_REF,

    check: function(data, I18N, fail, src){
      const { DIFF_CASES, STEP_PAT, STEP_NS, FIND_PAT, FIND_TARGETS,
              STICK, STICK_NS, STICK_FAR, SEAT, SEAT_ROWS, SEAT_FAR, ROUNDS } = data;

      /* ---- 1. 兩套「第 n 個」的實作要在整個取樣範圍上一致 ---- */
      const PATS = [];
      for (let first = 1; first <= 40; first += 3){
        for (let gap = 2; gap <= 25; gap += 3){
          PATS.push({ kind:'up', first, gap });
          PATS.push({ kind:'down', first:first + 30 * gap, gap });
        }
      }
      /* ⚠️ 邊界一定要進去掃：first ＝ 0 與 gap ＝ 1 都是這一課合法的值
         （正三角形小桌每多一張就只多 1 人）。原本的步長從 1／2 起跳，兩個都掃不到。 */
      for (let gap = 1; gap <= 3; gap++){
        PATS.push({ kind:'up', first:0, gap });
        PATS.push({ kind:'up', first:1, gap });
        PATS.push({ kind:'down', first:30 * gap, gap });
      }
      for (let first = 1; first <= 5; first++) for (const ratio of [2, 3]) PATS.push({ kind:'mul', first, ratio });
      for (let first = 1; first <= 12; first += 2)
        for (let gap = 2; gap <= 8; gap += 2)
          for (let bump = 1; bump <= 4; bump++) PATS.push({ kind:'grow', first, gap, bump });
      let termChecks = 0;
      for (const p of PATS){
        for (let n = 1; n <= 30; n++){
          const a = data.termAt(p, n), b = termRef(p, n);
          if (a !== b){ fail('termAt(' + JSON.stringify(p) + ', ' + n + ') = ' + a + ' but the recurrence gives ' + b); return; }
          termChecks++;
        }
      }
      if (termChecks < 5000) fail('the termAt sweep only compared ' + termChecks + ' values — too few to prove the two implementations agree');
      /* n 不合法的時候必須回 null，不可以偷偷算出一個數。 */
      for (const bad of [0, -1, 1.5, NaN]) if (data.termAt({ kind:'up', first:5, gap:3 }, bad) !== null)
        fail('termAt accepted an illegal position ' + bad);

      /* ---- 2. 四種規律在這一課的取樣範圍裡必須互不重疊 ---- */
      const seenKinds = {};
      let kindChecks = 0;
      for (const p of PATS){
        const list = [1, 2, 3, 4, 5].map(n => termRef(p, n));
        if (list.some(v => !inRangeRef(v))) continue;
        const fits = fitsRef(list);
        if (fits.length !== 1){
          fail('the run ' + list.join(',') + ' fits ' + fits.length + ' of the four rules (' + fits.join('+') +
               ") — this lesson's rules must not overlap");
          return;
        }
        if (data.kindOf(list) !== fits[0]){
          fail('kindOf(' + list.join(',') + ') = ' + data.kindOf(list) + ' but the reference fit gives ' + fits[0]);
          return;
        }
        seenKinds[fits[0]] = (seenKinds[fits[0]] || 0) + 1;
        kindChecks++;
      }
      for (const k of ['up', 'down', 'mul', 'grow'])
        if (!seenKinds[k]) fail('the classifier sweep never produced a "' + k + '" run, so that branch was never proved');
      if (kindChecks < 300) fail('the classifier sweep only covered ' + kindChecks + ' runs');
      /* 太短的一串不可以被分類 —— 兩個數字只看得到一個差。 */
      if (data.kindOf([5, 8]) !== 'other') fail('kindOf classified a two-number run, but two numbers show only one gap');
      /* 一路平的、忽上忽下的都必須是 other。 */
      if (data.kindOf([4, 4, 4, 4]) !== 'other') fail('a flat run must not count as "adds the same amount"');
      if (data.kindOf([4, 9, 6, 11]) !== 'other') fail('a run that goes up and down must not be classified');
      /* bump ＝ 0 就是 up，不可以同時算成 grow。 */
      if (data.kindOf([3, 7, 11, 15, 19]) !== 'up') fail('a constant-gap run must classify as up, not grow');
      /* ⚠️ 上面那一輪掃描只掃「由四種模型生成的串」，所以任何**不屬於這四種**的串
         從來沒被走過（codex 抓到的覆蓋率破洞）。這一組是手挑的對抗樣本：
         每一個都必須讓頁面與參考實作得到同一個結論。 */
      const ADVERSARIAL = [
        [1, 4, 6, 7],        // 差 3、2、1：越來越小，不可以算成「加的數在長大」
        [1, 3, 1, 3],        // 差都是 2，可是忽上忽下
        [4, 9, 4, 9],        // 同上，而且差完全相等 —— 方向的守衛就是為它存在的
        [5, 5, 5, 5],        // 一路平的，沒有在變
        [10, 8, 7, 7, 8],    // 先減、再平、再加
        [8, 12, 18, 27],     // 倍率 1.5，整數串但不是整數倍
        [1, 2, 6, 24, 120],  // 每一個相除都是整數，可是彼此不同
        [2, 5, 9, 14, 20],   // 真正的 grow（差 3、4、5、6）
        [40, 36, 32, 28, 24],
        [1, 2, 4, 8, 16],
        [1, 2, 4],           // 三個數：mul 與 grow 都套得上，所以 grow 要求至少四個數
        [1, 3, 6]            // 三個數、只有 grow 套得上 —— 一樣要判 other
      ];
      ADVERSARIAL.forEach(list => {
        /* 「四種規律互斥」是課程明講的事，所以要對每一個對抗樣本各驗一次。 */
        const fits = fitsRef(list);
        if (fits.length > 1)
          fail('the run ' + list.join(',') + ' fits ' + fits.length + ' rules at once (' + fits.join('+') +
               ') — the four rule names must stay mutually exclusive');
        const mine = data.kindOf(list), ref = kindRef(list);
        if (mine !== ref)
          fail('kindOf(' + list.join(',') + ') = ' + mine + ' but the reference fit gives ' + ref);
      });
      if (data.kindOf([4, 9, 4, 9]) !== 'other')
        fail('a run that alternates up and down must not be classified, even when every gap is equal');
      /* 倍率是 1.5 的整數串（8、12、18、27）—— 這一課只做整數倍，不可以算成「每次乘一樣多」。 */
      if (data.kindOf([8, 12, 18, 27]) !== 'other')
        fail('a run whose ratio is 1.5 must not count as multiplying — this lesson only does whole-number multipliers');
      /* 每一個相除都是整數、但**彼此不同**（1、2、6、24、120 的比是 2、3、4、5）——
         「相鄰兩個相除都一樣」少了「都一樣」三個字就會把它算成每次乘一樣多。 */
      if (data.kindOf([1, 2, 6, 24, 120]) !== 'other')
        fail('a run whose ratios are 2, 3, 4, 5 must not count as multiplying by the same amount');

      /* ---- 3. 兩套「某個數是第幾個」的實作要一致（含三種失敗理由） ---- */
      const whyHits = {};
      let idxChecks = 0;
      for (let gap = 1; gap <= 9; gap++){
        for (let first = 0; first <= 12; first++){
          const p = { kind:'up', first, gap };
          for (let v = 0; v <= first + 30 * gap; v++){
            const a = data.findIndex(p, v), b = findIndexRef(p, v);
            if (a.ok !== b.ok || (a.ok && a.index !== b.index) || (!a.ok && a.why !== b.why)){
              fail('findIndex(first=' + first + ', gap=' + gap + ', v=' + v + ') = ' + JSON.stringify(a) +
                   ' but the walking reference gives ' + JSON.stringify(b));
              return;
            }
            whyHits[a.ok ? 'ok' : a.why] = (whyHits[a.ok ? 'ok' : a.why] || 0) + 1;
            idxChecks++;
          }
        }
      }
      for (const w of ['ok', 'below', 'notdiv'])
        if (!whyHits[w]) fail('the findIndex sweep never hit the "' + w + "\" case, so the lesson's claim about it is unproved");
      if (idxChecks < 5000) fail('the findIndex sweep only covered ' + idxChecks + ' values');
      /* 遞減的方向也要驗，而且 mul／grow 一律問不出來（課程明講不可以套）。 */
      const dp = { kind:'down', first:100, gap:7 };
      for (let v = 0; v <= 120; v++){
        const a = data.findIndex(dp, v), b = findIndexRef(dp, v);
        if (a.ok !== b.ok || (a.ok && a.index !== b.index) || (!a.ok && a.why !== b.why))
          fail('findIndex on a falling pattern disagrees at v=' + v);
      }
      for (const p of [{ kind:'mul', first:1, ratio:2 }, { kind:'grow', first:1, gap:2, bump:1 }]){
        const r = data.findIndex(p, 8);
        if (r.ok || r.why !== 'kind')
          fail('findIndex answered a ' + p.kind + ' pattern, but the lesson says the two formulas only apply to add/subtract rules');
      }

      /* ---- 4. 「幾個和幾步差 1」—— 這一課的核心，單獨釘一次 ---- */
      for (let n = 1; n <= 40; n++)
        if (data.stepsTo(n) !== n - 1) fail('stepsTo(' + n + ') = ' + data.stepsTo(n) + ', but the hops from the 1st one are always n − 1');
      if (data.stepsTo(1) !== 0) fail('the 1st one must be 0 hops from itself');
      /* 「多走一步」的錯答案必須真的比正解多剛好一個 gap（課程要印出它給孩子看）。 */
      for (const p of [{ kind:'up', first:5, gap:3 }, { kind:'up', first:40, gap:12 }, { kind:'down', first:200, gap:9 }]){
        for (let n = 1; n <= 20; n++){
          const w = data.offByOneValue(p, n), v = data.termAt(p, n);
          const want = (p.kind === 'up') ? v + p.gap : v - p.gap;
          if (w !== want) fail('offByOneValue must be exactly one gap past the answer (n=' + n + ': got ' + w + ', expected ' + want + ')');
        }
      }
      if (data.offByOneValue({ kind:'mul', first:1, ratio:2 }, 3) !== null)
        fail('offByOneValue must refuse a multiply rule — "one hop too many" is only meaningful for add/subtract');

      /* ---- 5. 火柴棒的圖：把 stickPlan 跑起來驗幾何 ---- */
      if (data.FIG_W !== FIG_REF.index.W || data.FIG_H !== FIG_REF.index.H || data.FIG_PAD !== FIG_REF.index.PAD)
        fail('the lesson canvas is ' + data.FIG_W + '×' + data.FIG_H + ' pad ' + data.FIG_PAD +
             ' but the independent spec says ' + FIG_REF.index.W + '×' + FIG_REF.index.H + ' pad ' + FIG_REF.index.PAD);
      if (data.FIG_MIN_SIDE < FIG_REF.index.MIN_SIDE)
        fail('FIG_MIN_SIDE ' + data.FIG_MIN_SIDE + ' is below the readable minimum ' + FIG_REF.index.MIN_SIDE);
      for (let n = 1; n <= 8; n++){
        const plan = data.stickPlan(n);
        for (const b of checkStickPlan(plan, n, FIG_REF.index, 'index stickPlan')) fail(b);
      }
      /* 課程頁只畫 STICK_NS 那幾個，每一個都要達到可讀的最小邊長。 */
      for (const n of STICK_NS){
        const plan = data.stickPlan(n);
        if (plan.side < data.FIG_MIN_SIDE)
          fail('the figure for ' + n + ' triangles has ' + plan.side.toFixed(1) + 'px sticks, below FIG_MIN_SIDE');
      }
      /* ⚠️ 「差的差」那一排只有 grow 才可以畫。別的情形算出來是負數
         （1、4、6、7 的差是 3、2、1，差的差是 －1），而這一課不用負數。 */
      if (src && !/\} else if \(kind === 'grow'\)\{/.test(src))
        fail('the second-gap row must only be drawn when kindOf() says "grow", or a shrinking-gap run would display negative numbers');
      /* ⚠️ 範例 1 的旁白必須由 kindOf() 的結論挑，不可以在渲染函式裡自己再判一次
         「差都一樣嗎」—— 1、3、1、3 的差都是 2 而 kindOf() 判 other，
         自己判的話畫面會說「每次減 2」而結論說「不是這三種規律」。 */
      if (src && !/if \(kind === 'up' \|\| kind === 'down'\) s1narr/.test(src))
        fail('the narration for Example 1 must be chosen by kindOf(), not by re-testing whether the gaps are equal');
      /* ⚠️ 分數有 0 的下限，所以訊息要說**真的扣了幾分**。 */
      if (src && (src.indexOf('var lost = Math.min(5, gScore);') < 0 || src.indexOf('d.gWrong(lost)') < 0))
        fail('the game must report the points it actually took off — with a floor at 0 a fixed "5 off" message and the score disagree');
      /* 石頭那一排是三層 <span>。少了 display 宣告，數字會和「第幾個」黏成一行、
         min-width 也失效 —— 整排擠成一條細線，而所有數值檢查都是綠的。 */
      if (src){
        const STONE_CSS = ['.stonebox{display:inline-block;', '.stone{\n    display:block;', '.stonebox .who{display:block;'];
        for (const rule of STONE_CSS)
          if (src.indexOf(rule) < 0)
            fail('the stone row is missing the CSS rule "' + rule.replace(/\n\s+/g, ' ') +
                 '" — without it the number and its position label render glued together on one line');
      }
      /* viewBox 與 CSS 高度要跟著版面常數走。 */
      if (src){
        const vb = new RegExp('viewBox="0 0 ' + data.FIG_W + ' ' + data.FIG_H + '"', 'g');
        const hits = (src.match(vb) || []).length;
        if (hits < 2) fail('only ' + hits + ' svg(s) declare viewBox "0 0 ' + data.FIG_W + ' ' + data.FIG_H + '" — the lesson has two');
        if (src.indexOf('.stickfig{width:100%;max-width:520px;height:' + data.FIG_H + 'px') < 0)
          fail('the .stickfig CSS height does not follow FIG_H (' + data.FIG_H + ')');
      }

      /* ---- 6. 範例資料 ---- */
      /* 6a. 範例 1 的四組必須涵蓋四種規律，而且**至少一組**要讓「只看第一個差」失效
             —— 那是這一節存在的理由。 */
      const caseKinds = DIFF_CASES.map(c => data.kindOf(c.list));
      for (const k of ['up', 'down', 'mul', 'grow'])
        if (caseKinds.indexOf(k) < 0) fail('Example 1 never shows a "' + k + '" run');
      DIFF_CASES.forEach((c, i) => {
        if (c.list.length < 4) fail('DIFF_CASES[' + i + '] has fewer than 4 numbers, so not every gap can be shown');
        if (kindRef(c.list) !== data.kindOf(c.list))
          fail('DIFF_CASES[' + i + ']: the page and the reference classifier disagree');
        for (const v of c.list) if (!inRangeRef(v)) fail('DIFF_CASES[' + i + '] has ' + v + ' outside 0..' + VAL_MAX_REF);
      });
      const misleading = DIFF_CASES.filter(c => {
        const g = data.gapList(c.list);
        if (g[0] === g[1]) return false;
        /* 照第一個差接下去，第 3 個就會不一樣 —— 那才是「只看第一個差會出事」的實例。 */
        return c.list[0] + 2 * g[0] !== c.list[2];
      });
      if (!misleading.length)
        fail('no Example 1 run actually punishes "decide from the first gap alone", so the headline warning has no example behind it');

      /* 6b. 範例 2：STEP_NS 要包含 1（0 步的邊界）和一個大到不能一個一個數的值。 */
      if (STEP_NS.indexOf(1) < 0) fail('Example 2 never shows the 1st one, so "0 hops" is never demonstrated');
      if (!STEP_NS.some(n => n >= 15)) fail('Example 2 never shows a position big enough to need the formula');
      STEP_NS.forEach(n => {
        if (!inRangeRef(data.termAt(STEP_PAT, n))) fail('Example 2 term at ' + n + ' is out of range');
      });
      if (data.kindOf(data.firstTerms(STEP_PAT, 5)) !== 'up') fail('Example 2 pattern is not an "add the same amount" rule');

      /* 6c. 範例 3：四個目標必須把三種結果都示範到（在／除不盡／比第 1 個小）。 */
      const seenWhy = {};
      FIND_TARGETS.forEach(v => {
        const a = data.findIndex(FIND_PAT, v), b = findIndexRef(FIND_PAT, v);
        if (a.ok !== b.ok || (a.ok && a.index !== b.index) || (!a.ok && a.why !== b.why))
          fail('Example 3 target ' + v + ': the two implementations disagree');
        seenWhy[a.ok ? 'ok' : a.why] = (seenWhy[a.ok ? 'ok' : a.why] || 0) + 1;
      });
      for (const w of ['ok', 'notdiv', 'below'])
        if (!seenWhy[w]) fail('Example 3 never demonstrates the "' + w + '" outcome');
      if (!(seenWhy.ok >= 2)) fail('Example 3 should show more than one number that IS in the pattern');

      /* 6d. 範例 4／5：圖形與對應表的規律必須和 termAt 一致，而且「錯的乘法」
             要真的和正解不同（不然那句警告是空的）。 */
      for (const n of STICK_NS){
        const plan = data.stickPlan(n);
        if (plan.bars.length !== data.termAt(STICK, n))
          fail('the figure for ' + n + ' triangles draws ' + plan.bars.length + ' sticks but the rule says ' + data.termAt(STICK, n));
      }
      if (data.termAt(STICK, STICK_FAR) === STICK.first * STICK_FAR)
        fail('the "3 × how many" misconception coincides with the right answer at ' + STICK_FAR + ', so Example 4 proves nothing');
      if (data.termAt(SEAT, SEAT_FAR) === SEAT.first * SEAT_FAR)
        fail('the "seats × tables" misconception coincides with the right answer at ' + SEAT_FAR);
      if (SEAT.first !== 4 || SEAT.gap !== 2)
        fail('a square table seats 4 and joining loses two sides, so SEAT must be first 4 / gap 2, got ' + SEAT.first + '/' + SEAT.gap);
      if (STICK.first !== 3 || STICK.gap !== 2)
        fail('a triangle needs 3 sticks and each joined one adds 2, so STICK must be first 3 / gap 2, got ' + STICK.first + '/' + STICK.gap);
      if (SEAT_ROWS < 4) fail('the correspondence table needs at least 4 columns for the gap to look like a rule');
      for (let t = 1; t <= SEAT_ROWS; t++)
        if (!inRangeRef(data.termAt(SEAT, t))) fail('the seat table value at ' + t + ' is out of range');

      /* ---- 7. 遊戲：每一關的答案位置都要指到重算出來的答案 ---- */
      if (ROUNDS.length !== 5) fail('the game must have 5 rounds, got ' + ROUNDS.length);
      const roundKinds = {};
      ROUNDS.forEach((r, i) => {
        const want = data.roundAnswer(r);
        if (want === null || want === undefined) fail('round ' + (i + 1) + ': roundAnswer() could not compute an answer');
        else if (String(r.opts[r.ans]) !== String(want))
          fail('round ' + (i + 1) + ': ans points at ' + r.opts[r.ans] + ', computed answer is ' + want);
        if (new Set(r.opts.map(String)).size !== r.opts.length) fail('round ' + (i + 1) + ': duplicate options');
        if (r.opts.length !== 4) fail('round ' + (i + 1) + ': needs four options');
        roundKinds[r.kind] = (roundKinds[r.kind] || 0) + 1;
        if (r.kind === 'nth'){
          if (termRef(r.pat, r.n) !== want) fail('round ' + (i + 1) + ': roundAnswer disagrees with the recurrence');
          r.opts.forEach(o => { if (o !== want && o === termRef(r.pat, r.n)) fail('round ' + (i + 1) + ': a distractor equals the real term'); });
          if (r.opts.indexOf(r.pat.first + r.n * r.pat.gap) < 0)
            fail('round ' + (i + 1) + ': the off-by-one distractor (multiplying by n) is not offered');
        }
        if (r.kind === 'index'){
          const ref = findIndexRef(r.pat, r.v);
          if (!ref.ok) fail('round ' + (i + 1) + ': the number asked about is not in the pattern');
          else if (ref.index !== want) fail('round ' + (i + 1) + ': roundAnswer disagrees with the walking reference');
          if (ref.ok && r.opts.indexOf(ref.index - 1) < 0)
            fail('round ' + (i + 1) + ': the "forgot the + 1" distractor is not offered');
        }
        if (r.kind === 'inpat'){
          const hits = r.opts.filter(o => findIndexRef(r.pat, o).ok);
          if (hits.length !== 1) fail('round ' + (i + 1) + ': ' + hits.length + ' of the options are in the pattern, exactly 1 is required');
        }
        if (r.kind === 'which'){
          if (kindRef(r.list) !== want) fail('round ' + (i + 1) + ': roundAnswer disagrees with the reference classifier');
          if (r.opts.length !== 4 || ['up', 'down', 'mul', 'grow'].some(k => r.opts.indexOf(k) < 0))
            fail('round ' + (i + 1) + ': the four rule names must all be offered');
        }
        if (r.kind === 'stick'){
          if (want !== 2 * r.n + 1) fail('round ' + (i + 1) + ': the stick count is not 2n + 1');
          if (r.opts.indexOf(3 * r.n) < 0) fail('round ' + (i + 1) + ': the "3 × how many" misconception is not offered');
          /* ⚠️ 圖上畫的必須比問的少：畫著 n 個三角形的話，孩子數圖就有答案了。 */
          if (!(r.figN >= 1 && r.figN < r.n))
            fail('round ' + (i + 1) + ': the figure draws ' + r.figN + ' triangles but the question asks about ' +
                 r.n + ' — the drawn count must be smaller, or the answer can just be counted off the picture');
          const fplan = data.stickPlan(r.figN);
          for (const b of checkStickPlan(fplan, r.figN, FIG_REF.index, 'round ' + (i + 1) + ' fig')) fail(b);
        }
      });
      for (const k of ['which', 'nth', 'index', 'inpat', 'stick'])
        if (!roundKinds[k]) fail('the game never asks a "' + k + '" question');
      if (new Set(ROUNDS.map(r => r.ans)).size < 3) fail('the game answers are not spread across the option positions');

      /* ---- 8. 每一句旁白都真的渲染出來再掃 ----
             拼接出來的句子在原始碼裡看不出中文會不會黏住數字。 */
      let narrated = 0;
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        const push = (s, tag) => {
          narrated++;
          for (const t of textProblems(s, lang, lang + ' ' + tag)) fail(t);
          const ar = arithProblems(s);
          for (const p of ar.problems) fail(lang + ' ' + tag + ': ' + p);
        };
        DIFF_CASES.forEach((c, ci) => {
          push(d.s1chip(c.list), 's1chip[' + ci + ']');
          const g = data.gapList(c.list);
          g.forEach((v, k) => {
            const big = Math.max(c.list[k], c.list[k + 1]), small = Math.min(c.list[k], c.list[k + 1]);
            push(d.s1step(big, small, v), 's1step[' + ci + '][' + k + ']');
          });
          const kind = data.kindOf(c.list);
          if (data.allSame(g)) push(d.s1narrSame(g[0], data.dirOf(c.list)), 's1narrSame[' + ci + ']');
          else {
            push(d.s1narrNotSame(g), 's1narrNotSame[' + ci + ']');
            if (kind === 'mul') push(d.s1narrMul(data.ratioList(c.list)[0]), 's1narrMul[' + ci + ']');
            else push(d.s1narrGrow(data.gapList(g)[0]), 's1narrGrow[' + ci + ']');
          }
          push(d.s1result(d.kindName[kind]), 's1result[' + ci + ']');
        });
        STEP_NS.forEach(n => {
          const steps = data.stepsTo(n), val = data.termAt(STEP_PAT, n), wrong = data.offByOneValue(STEP_PAT, n);
          /* ⚠️ 圖上省略中間的時候，旁白**不可以**說「中間有 N 個箭頭」——
             畫面只畫得出五格，孩子數到的和旁白說的會不一樣。 */
          if (n > data.STONE_SHOW + 1){
            const ab = String(d.s2narr(n, steps, true));
            const word = (lang === 'zh') ? '箭頭' : 'arrow';
            if (ab.indexOf(word) >= 0)
              fail(lang + ' s2narr[' + n + ']: the figure leaves the middle out, so the narration must not count "' +
                   word + '" — it claims ' + steps + ' of them while the figure draws five');
          }
          push(d.s2chip(n), 's2chip[' + n + ']');
          push(d.s2whoN(n), 's2whoN[' + n + ']');
          push(d.s2narr(n, steps, false), 's2narr[' + n + '] full');
          push(d.s2narr(n, steps, true), 's2narr[' + n + '] abbreviated');
          push(d.s2calc(STEP_PAT.first, steps, STEP_PAT.gap, val), 's2calc[' + n + ']');
          push(d.s2result(n, val), 's2result[' + n + ']');
          if (wrong !== val) push(d.s2wrong(STEP_PAT.first, n, STEP_PAT.gap, wrong, val, wrong - val), 's2wrong[' + n + ']');
        });
        FIND_TARGETS.forEach(v => {
          const f = data.findIndex(FIND_PAT, v);
          push(d.s3chip(v), 's3chip[' + v + ']');
          if (f.ok){
            push(d.s3narrOk(v, FIND_PAT.first, f.diff, FIND_PAT.gap, f.quo), 's3narrOk[' + v + ']');
            push(d.s3calcOk(f.diff, FIND_PAT.gap, f.quo), 's3calcOk[' + v + ']');
            push(d.s3resultOk(v, f.index), 's3resultOk[' + v + ']');
          } else if (f.why === 'notdiv'){
            push(d.s3narrNotDiv(v, FIND_PAT.first, f.diff, FIND_PAT.gap, f.quo, f.rem), 's3narrNotDiv[' + v + ']');
            push(d.s3calcRem(f.diff, FIND_PAT.gap, f.quo, f.rem), 's3calcRem[' + v + ']');
            push(d.s3resultNo(v), 's3resultNo[' + v + ']');
          } else {
            push(d.s3narrBelow(v, FIND_PAT.first), 's3narrBelow[' + v + ']');
            push(d.s3calcBelow(v, FIND_PAT.first), 's3calcBelow[' + v + ']');
            push(d.s3resultNo(v), 's3resultNo[' + v + ']');
          }
        });
        STICK_NS.forEach(n => {
          push(d.s4chip(n), 's4chip[' + n + ']');
          push(d.s4narr(n, data.stickPlan(n).bars.length, STICK.first, STICK.gap), 's4narr[' + n + ']');
        });
        push(d.s4calc(STICK.first, data.stepsTo(STICK_FAR), STICK.gap, data.termAt(STICK, STICK_FAR), STICK_FAR), 's4calc');
        push(d.s4note(STICK_FAR, data.termAt(STICK, STICK_FAR), STICK.first * STICK_FAR), 's4note');
        for (let t = 1; t <= SEAT_ROWS; t++) push(d.s5narr(t, data.termAt(SEAT, t), SEAT.first, SEAT.gap), 's5narr[' + t + ']');
        push(d.s5calc(SEAT.first, data.stepsTo(SEAT_FAR), SEAT.gap, data.termAt(SEAT, SEAT_FAR), SEAT_FAR), 's5calc');
        push(d.s5note(SEAT_FAR, data.termAt(SEAT, SEAT_FAR), SEAT.first * SEAT_FAR), 's5note');
        ROUNDS.forEach((r, i) => {
          const list = r.list ? r.list.slice() : (r.pat ? data.firstTerms(r.pat, 4) : null);
          if (r.kind === 'which') push(d.gPrompt.which(list), 'gPrompt.which');
          else if (r.kind === 'nth') push(d.gPrompt.nth(list, r.n), 'gPrompt.nth');
          else if (r.kind === 'index') push(d.gPrompt.index(list, r.v), 'gPrompt.index');
          else if (r.kind === 'inpat') push(d.gPrompt.inpat(list), 'gPrompt.inpat');
          else push(d.gPrompt.stick(r.n, r.figN), 'gPrompt.stick');
          push(d.gHint1[r.kind], 'gHint1[' + r.kind + ']');
          if (r.kind === 'which') push(d.gHint2.which(data.gapList(r.list)), 'gHint2.which');
          else if (r.kind === 'nth') push(d.gHint2.nth(data.stepsTo(r.n)), 'gHint2.nth');
          else if (r.kind === 'index') push(d.gHint2.index(r.v - r.pat.first, r.pat.gap), 'gHint2.index');
          else if (r.kind === 'inpat') push(d.gHint2.inpat(r.pat.first, r.pat.gap), 'gHint2.inpat');
          else push(d.gHint2.stick(data.stepsTo(r.n)), 'gHint2.stick');
          push(d.gWin(100 + i), 'gWin');
        });
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          (d[bank] || []).forEach((q, i) => {
            push(q.stem, bank + '[' + i + '].stem');
            push(q.why, bank + '[' + i + '].why');
            q.opts.forEach((o, oi) => push(o, bank + '[' + i + '].opts[' + oi + ']'));
          });
        });
      });
      if (narrated < 300) fail('only ' + narrated + ' narration strings were rendered and scanned — too few to cover the page');

      /* ---- 9. 英文的單複數與序數助手要真的處理 1 ---- */
      if (data.plEn(1, 'hop') !== 'hop' || data.plEn(2, 'hop') !== 'hops') fail('plEn does not handle the singular/plural split');
      if (data.peopleEn(1) !== 'person' || data.peopleEn(2) !== 'people') fail('peopleEn does not handle person/people');
      if (data.isAreEn(1) !== 'is' || data.isAreEn(2) !== 'are') fail('isAreEn does not handle is/are');
      const ORD = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th', 11:'11th', 12:'12th', 13:'13th',
                    20:'20th', 21:'21st', 22:'22nd', 23:'23rd', 101:'101st', 111:'111th', 112:'112th' };
      for (const k of Object.keys(ORD))
        if (data.ordEn(Number(k)) !== ORD[k]) fail('ordEn(' + k + ') = ' + data.ordEn(Number(k)) + ', expected ' + ORD[k]);

      /* ---- 10. 靜態題庫：神諭 ＋ 從題幹重算 ---- */
      for (const bank of ['qs', 'qsAdv', 'qsBoost']){
        const zh = I18N.zh[bank], en = I18N.en[bank];
        const exp = BANK_EXPECTED[bank];
        if (!zh || !en){ fail(bank + ' missing in one language'); continue; }
        if (zh.length !== exp.length) fail(bank + ' has ' + zh.length + ' questions but the oracle describes ' + exp.length);
        if (zh.length !== en.length){ fail(bank + ' length differs between zh and en'); continue; }
        zh.forEach((q, i) => {
          const e = en[i], want = exp[i];
          if (q.ans !== e.ans) fail(bank + '[' + i + '] answer index differs: zh=' + q.ans + ' en=' + e.ans);
          if (q.opts.length !== e.opts.length) fail(bank + '[' + i + '] option count differs');
          for (const pair of [['zh', q], ['en', e]]){
            const tag = pair[0], x = pair[1];
            if (x.opts.length !== 4) fail(bank + '[' + i + '] ' + tag + ' does not have four options');
            if (new Set(x.opts).size !== x.opts.length) fail(bank + '[' + i + '] ' + tag + ': duplicate options');
            if (!(x.ans >= 0 && x.ans < x.opts.length)) fail(bank + '[' + i + '] ' + tag + ': answer index out of range');
            if (!x.why || !x.why.trim()) fail(bank + '[' + i + '] ' + tag + ': no explanation');
          }
          if (/[一-鿿]/.test(e.stem + e.opts.join('') + e.why)) fail(bank + '[' + i + '] en contains Chinese');
          if (want && want.answer !== undefined && q.opts[q.ans] !== want.answer)
            fail(bank + '[' + i + '] zh marks "' + q.opts[q.ans] + '" correct, the oracle says "' + want.answer + '"');
          if (want && want.stemExact !== undefined && q.stem !== want.stemExact)
            fail(bank + '[' + i + '] zh stem is not the pinned text — it now reads: ' + q.stem);
          /* ⚠️ 英文那一邊本來完全沒有神諭：中文標對、英文在同一個索引上標另一個選項，
             整份檢查照樣綠燈（codex 判 critical）。三條獨立的釘樁：
             ① 兩種語言的題幹必須印出**同一組數字**（翻譯漂走就會不一樣）；
             ② 數字型的正解字串兩種語言必須逐字相同；
             ③ 句子型的正解逐字釘死。 */
          const zNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(',');
          const eNums = (e.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number).sort((x, y) => x - y).join(',');
          if (zNums !== eNums)
            fail(bank + '[' + i + '] the two languages print different numbers in the stem: zh [' +
                 zNums + '] vs en [' + eNums + ']');
          const zAns = q.opts[q.ans], eAns = e.opts[e.ans];
          if (/^\d+$/.test(zAns) && zAns !== eAns)
            fail(bank + '[' + i + '] zh marks ' + zAns + ' correct but en marks ' + eAns +
                 ' at the same index — a numeric answer must be identical in both languages');
          if (want && want.enAnswer !== undefined && eAns !== want.enAnswer)
            fail(bank + '[' + i + '] en marks "' + eAns + '" correct, the oracle says "' + want.enAnswer + '"');
          const ask = (BANK_ASK[bank] || [])[i];
          if (ask){
            for (const m of ask.must) if (q.stem.indexOf(m) < 0) fail(bank + '[' + i + '] stem no longer asks "' + m + '"');
            for (const nv of ask.never) if (q.stem.indexOf(nv) >= 0) fail(bank + '[' + i + '] stem now asks "' + nv + '" instead');
          }
        });
      }
      /* 從題幹裡的數字重算一次 —— 拿設定檔自己的常數算，題幹被改時不會響。 */
      BANK_RECOMPUTE.forEach(rec => {
        const q = (I18N.zh[rec.bank] || [])[rec.i];
        if (!q){ fail('BANK_RECOMPUTE points at a question that does not exist: ' + rec.bank + '[' + rec.i + ']'); return; }
        const nums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        if (nums.join(',') !== rec.from.join(','))
          fail(rec.bank + '[' + rec.i + '] stem numbers are now [' + nums + '] but the recompute expects [' + rec.from + ']');
        else if (q.opts[q.ans] !== rec.calc(nums))
          fail(rec.bank + '[' + rec.i + '] recomputed from the stem gives ' + rec.calc(nums) + ', but the marked answer is ' + q.opts[q.ans]);
      });
      /* 正解位置要分散。 */
      const spread = {};
      ['qs', 'qsAdv', 'qsBoost'].forEach(b => (I18N.zh[b] || []).forEach(q => { spread[q.ans] = (spread[q.ans] || 0) + 1; }));
      if (Object.keys(spread).length < 4) fail('the static answers only use ' + Object.keys(spread).length + ' of the 4 option positions');

      /* ---- 11. zh／en 頂層鍵要一一對應 ---- */
      /* ⚠️ 只比最上層的 key 不夠：I18N.en.kindName.grow 少一個也查不出來。
         遞迴把每一條 key 路徑列出來比。 */
      function keyPaths(o, prefix, out){
        Object.keys(o).forEach(k => {
          const v = o[k], path = prefix ? prefix + '.' + k : k;
          if (v && typeof v === 'object' && !Array.isArray(v) && typeof v !== 'function'){
            /* 先記下這個物件本身，再往下走 —— 只記葉子的話，空物件完全沒有路徑，
               `I18N.zh.extra = {}` 少了英文版也查不出來（codex 第二輪抓到）。 */
            out.push(path + ':object');
            keyPaths(v, path, out);
          }
          else out.push(path + ':' + (Array.isArray(v) ? 'array[' + v.length + ']' : typeof v));
        });
        return out;
      }
      const zp = keyPaths(I18N.zh, '', []).sort(), ep = keyPaths(I18N.en, '', []).sort();
      const onlyZh = zp.filter(x => ep.indexOf(x) < 0), onlyEn = ep.filter(x => zp.indexOf(x) < 0);
      if (onlyZh.length) fail('these dictionary keys exist only in zh: ' + onlyZh.slice(0, 6).join(' '));
      if (onlyEn.length) fail('these dictionary keys exist only in en: ' + onlyEn.slice(0, 6).join(' '));

      /* ---- 12. 四頁的措辭 ----
             ⚠️ 路徑要從 process.argv[2] 推：用 __dirname 會讀到**真的 repo**，
             改壞測試複製出去的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
      const dir = path.dirname(process.argv[2]);
      const SRC = {};
      for (const f of ['index', 'reference', 'parents', 'review']){
        const fp = path.join(dir, f + '.html');
        if (!fs.existsSync(fp)){ fail(f + '.html is missing, so its wording was never checked'); continue; }
        SRC[f] = fs.readFileSync(fp, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
      }
      /* ⚠️ 「必須出現」擋不住「又多加了一句錯的」。這幾句是這一課的規則被寫錯時
         最可能出現的形狀，一頁都不可以有（中英各一份）。 */
      const FORBIDDEN = [
        { text:'第 1 個 ＋ n × 每次加的數', why:'is the formula with the (n − 1) dropped' },
        { text:'第 1 個 ＋ n × 每次減的數', why:'is the falling formula with the (n − 1) dropped' },
        { text:'the 1st one + n × the amount added', why:'is the English formula with the (n − 1) dropped' },
        { text:'the 1st one + n x the amount added', why:'is the same, written with a plain x' },
        /* 第二輪證明是假的那三句話，一個字都不可以回來。 */
        { text:'差不一樣、差的差也不一樣', why:'claims reasons that need not hold for a run that simply fits none of the rules' },
        { text:'越走越小就把 ＋ 換成 －', why:'leaves the factor still called "the amount added", which is wrong for a falling run' },
        { text:'那些共用的部分會被算兩次', why:'is true of the matchsticks but not of the tables, which lose unusable sides instead' }
      ];
      ['index', 'reference', 'parents', 'review'].forEach(f => {
        const text = SRC[f];
        if (text === undefined) return;
        FORBIDDEN.forEach(bad => {
          if (text.indexOf(bad.text) >= 0)
            fail(f + '.html contains "' + bad.text + '", which ' + bad.why +
                 ' — the lesson turns on that subtraction, so this form must never appear');
        });
      });
      /* 英文那一邊也要釘：只釘中文的話，英文可以自己漂走。 */
      const EN_RULES = [
        { file:'index', text:'the nth one = the 1st one + (n − 1) × the amount added each time', min:1 },
        { file:'reference', text:'the nth one = the 1st one + (n − 1) × the amount added each time', min:1 },
        { file:'reference', text:'position = (the number − the 1st one) ÷ the amount added each time + 1', min:1 }
      ];
      EN_RULES.forEach(rule => {
        const text = SRC[rule.file];
        if (text === undefined) return;
        let c = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) c++;
        if (c < rule.min)
          fail(rule.file + '.html states the English formula "' + rule.text + '" ' + c +
               ' time(s) — the English wording must be pinned too, or it drifts from the Chinese');
      });
      SIBLING_RULES.forEach(rule => {
        const text = SRC[rule.file];
        if (text === undefined) return;
        let count = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) count++;
        if (count < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + count + ' time(s), expected at least ' +
               rule.min + ' — it ' + rule.why);
      });

      /* ---- 13. 產生器一支都不能少，也不能多出設定檔沒描述的 ---- */
      const rv = SRC['review'];
      if (rv !== undefined){
        const found = [];
        rv.split('\n').forEach(line => {
          const m = /^\s*\{ id:'([A-Za-z0-9_]+)',/.exec(line);
          if (m) found.push(m[1]);
        });
        GEN_IDS.forEach(id => {
          if (found.indexOf(id) < 0) fail('review.html no longer declares the generator "' + id + '"');
        });
        found.forEach(id => {
          if (GEN_IDS.indexOf(id) < 0) fail('review.html declares an extra generator "' + id + '" that this config does not describe');
        });
        const makes = (rv.match(/\n\s*make:function\(/g) || []).length;
        const fmts = (rv.match(/\n\s*fmt:function\(/g) || []).length;
        if (makes !== GEN_IDS.length) fail('review.html has ' + makes + ' make() functions, expected ' + GEN_IDS.length);
        if (fmts !== GEN_IDS.length) fail('review.html has ' + fmts + ' fmt() functions, expected ' + GEN_IDS.length);
        /* 每一支 make() 都必須真的抽樣（呼叫 pick／pickUnused）——
           寫死成一組合法參數的話，所有斷言都還是綠的，定義域卻整片消失。 */
        const picks = (rv.match(/\bpick\(|\bpickUnused\(/g) || []).length;
        if (picks < GEN_IDS.length * 2)
          fail('review.html only calls pick()/pickUnused() ' + picks + ' times — some generator is not sampling its domain');
        /* 圖的排版函式必須在 GENS **之前**（simgen 只切得到那一段）。 */
        const iPlan = rv.indexOf('function stickPlan('), iGens = rv.indexOf('var GENS = [');
        if (iPlan < 0 || iGens < 0 || iPlan > iGens)
          fail('stickPlan must be declared before GENS, or the checks verify what the config would draw rather than what the page draws');
        /* review.html 的畫布常數要跟獨立寫死的規格一致。 */
        if (rv.indexOf('var FIG_W = ' + FIG_REF.review.W + ', FIG_H = ' + FIG_REF.review.H + ', FIG_PAD = ' + FIG_REF.review.PAD + ';') < 0)
          fail('review.html canvas constants do not match the independent spec ' +
               FIG_REF.review.W + '×' + FIG_REF.review.H + ' pad ' + FIG_REF.review.PAD);
        if (rv.indexOf("svg.setAttribute('viewBox', '0 0 " + FIG_REF.review.W + ' ' + FIG_REF.review.H + "')") < 0)
          fail('review.html viewBox does not follow its own canvas constants');
      }

      /* ---- 14. 驗算器本身要先證明它對真實資料零誤報，也真的抓得到錯的 ----
             （不然它當守門員時，每一筆「算不出來」都會變成誤報或背書。） */
      const PROBE_OK = ['5 ＋ 19 × 3 ＝ 62', '40 － 36 ＝ 4', '95 ÷ 3 ＝ 31 餘 2',
                        '8 ＋ 9 × 5 ＝ 8 ＋ 45 ＝ 53', '36 ÷ 4 = 9', '95 / 3 = 31 r 2',
                        /* 散文緊貼算式的四種邊界，trimChain 都要修得回來 */
                        'exactly (41 − 5 = 36, and 36 ÷ 4 = 9), so it works',
                        'lands on position 11 + 1 = 12 —— done',
                        'so 6 + 1 = 7（第 7 個）',
                        'it took 24 hops. 24 hops lands on position 24 + 1 = 25'];
      const PROBE_BAD = ['5 ＋ 19 × 3 ＝ 63', '40 － 36 ＝ 5', '95 ÷ 3 ＝ 31 餘 3',
                         '8 ＋ 9 × 5 ＝ 8 ＋ 45 ＝ 54',
                         /* 邊界修好之後，錯的算式還是要被抓到 —— 不可以連錯的一起放過 */
                         'exactly (41 − 5 = 37, and 36 ÷ 4 = 9), so it works',
                         'lands on position 11 + 1 = 13 —— done',
                         'it took 24 hops. 24 hops lands on position 24 + 1 = 26'];
      PROBE_OK.forEach(s => {
        const r = arithProblems(s);
        if (r.problems.length) fail('the arithmetic verifier false-alarms on "' + s + '": ' + r.problems[0]);
        if (r.verified < 1) fail('the arithmetic verifier silently skipped the correct equation "' + s + '"');
      });
      PROBE_BAD.forEach(s => {
        if (!arithProblems(s).problems.length) fail('the arithmetic verifier misses the wrong equation "' + s + '"');
      });
      /* 新加的三條守門條件也要各自證明「抓得到」與「不誤報」。 */
      if (!arithProblems('8 ÷ 4 ＝ 2.5').problems.length)
        fail('the arithmetic verifier accepts a decimal result, but this lesson has only whole numbers');
      if (!arithProblems('1 = 2, and 3 + 4 = 7').problems.length)
        fail('the arithmetic verifier misses a short false equation hiding beside a true one');
      if (arithProblems('it took 6 hops. 6 hops lands on position 7').problems.length)
        fail('the arithmetic verifier mistakes a sentence break for a decimal point');
      if (!textProblems('Start at -1 and count on', 'en', 'probe').length)
        fail('the text checker accepts a negative number, which this lesson never uses');
      if (textProblems('20 － 6 ＝ 14', 'zh', 'probe').length)
        fail('the text checker mistakes a subtraction sign for a negative number');
      if (!textProblems('there are 1 gaps here', 'en', 'probe').length)
        fail('the English singular checker misses "1 gaps"');
      if (textProblems('add 1 afterwards and you are done', 'en', 'probe').length)
        fail('the English singular checker mistakes the adverb "afterwards" for a plural noun');
      if (textProblems('there is 1 class today', 'en', 'probe').length)
        fail('the English singular checker mistakes the singular noun "class" for a plural');
      if (!textProblems('it seats 1 people', 'en', 'probe').length)
        fail('the English singular checker misses the irregular plural "1 people"');
      if (textProblems('連結最後檢查：2026-09-01', 'zh', 'probe').length)
        fail('the negative-number checker mistakes a date for a negative number');
      if (!textProblems('the answer is “−1” here', 'en', 'probe').length)
        fail('the negative-number checker misses a negative inside quotation marks');
      if (arithProblems('see version 2.5; 3 ＋ 4 ＝ 7').problems.length)
        fail('the decimal checker rejects a version number in ordinary prose');
      if (arithProblems('the symbol ＝ means “is equal to”; 3 ＋ 4 ＝ 7').problems.length)
        fail('the equals-sign counter treats a metalinguistic "=" as an arithmetic claim');
    }
  },

  SIBLING_RULES: SIBLING_RULES,
  GEN_IDS: GEN_IDS
};
