/* grade-5/math/fraction-multiply（分數乘法：整數 × 分數、分數 × 分數、帶分數、乘完會變大還是變小、先約分）的檢查設定。

   這一課在 2026-10-10 小遊戲照 §六之五 改版之前**沒有設定檔**（simgen／verify_lesson_data 一跑就是「no check config」），
   所以這一份同時補上三塊：課程頁的旁白與範例、小遊戲「分數切切樂」、review.html 的八個產生器。

   守門重點：

   ① **每一句寫出來的算式都要重算一次** —— 四頁的 markup、每一頁的 I18N 字典（含字典裡的函式代入真的題目），
      用精確有理數的 fracArith（從 grade-6-divide-fraction 抄來，加上**帶分數**「1 又 1/2」／「1 1/2」、**小數**、
      以及 `(3×2)/5` 的 `/`）。驗算器自己的 CLAIM_PROBES 每一次都重跑；每一頁驗過幾條要釘住（數量變了就是有人改了句子，要重看一次）。

   ② **小遊戲照遊戲的規則把每一題玩一遍**：連加要剛好 n 條（軌道永遠比答案長，放滿不是答案）、兩把刀的每一個停點、
      三個籃子、四把刀與數格子、先約分的**每一種配對順序**（DFS 走完）都要停在同一個最簡分數。
      `cutSnap`、`nearestOpen`、`roundMiss`、`roundSolved`、`shuffle` 從原始碼切出來真的跑。

   ③ **畫面要決定得了答案**：分數條和軌道上的一格一樣寬（真的比例）、刀的每一個停點就是一條畫出來的線、
      帶分數那一條的格子數就是分母；版面與觸控 ≥ 44px 從原始碼的常數讀。

   ④ **review.html 的八個產生器**：正解的第二套實作（只用 make() 留下的原始參數）、選項的值兩兩不同
      （未約分的正解只在題幹寫了「記得約分／最簡」的時候放行，而且只放行那一個）、解釋逐條驗算、
      誘答不抄題幹（唯一的例外是 mixedXint「只乘分數部分」剛好等於乘數的那一個值）。

   已知極限：fracArith 把「左邊不是數字的等號」當散文放行（規則表的 a/b × c/d ＝ (a×c)/(b×d) 那種字母算式也一樣）；
   畫面的檢查在 e2e（teaching-workspace/game-harness/g5-fraction-multiply），這裡只驗資料與原始碼。 */

const fs = require('fs');
const path = require('path');
const { extractFunction } = require('./lib/gameshuffle.js');

/* ---------- 第二套實作：最大公因數走質因數（頁面是輾轉相除） ---------- */
function factorsRef(n){ const f = {}; let x = n; for (let p = 2; p * p <= x; p++) while (x % p === 0){ f[p] = (f[p] || 0) + 1; x /= p; } if (x > 1) f[x] = (f[x] || 0) + 1; return f; }
function gcdRef(a, b){
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return null;
  const fa = factorsRef(a), fb = factorsRef(b); let g = 1;
  Object.keys(fa).forEach(p => { if (fb[p]) g *= Math.pow(+p, Math.min(fa[p], fb[p])); });
  return g;
}
function simpRef(n, d){ const g = gcdRef(n, d); return { n:n / g, d:d / g }; }
/* 約到最簡之後的寫法：整數、真分數、或帶分數（中文「w 又 r/D」、英文「w r/D」） */
function simpTextRef(n, d, lang){
  const s = simpRef(n, d), w = Math.floor(s.n / s.d), r = s.n - w * s.d;
  if (r === 0) return String(w);
  if (w === 0) return r + '/' + s.d;
  return w + (lang === 'zh' ? ' 又 ' : ' ') + r + '/' + s.d;
}
function valTextRef(n, d, lang){ const s = simpTextRef(n, d, lang); return s === n + '/' + d ? s : n + '/' + d + ' = ' + s; }
const nums = t => (String(t).match(/\d+/g) || []).map(Number);
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }

/* ===================== 有理數驗算器（grade-6-divide-fraction 的 fracArith，加上帶分數、小數與 `/`） ===================== */
function rNorm(x){
  if (!x || !Number.isFinite(x.n) || !Number.isFinite(x.d) || x.d === 0) return null;
  const s = x.d < 0 ? -1 : 1, n = x.n * s, d = x.d * s;
  const g = (function e(a, b){ a = Math.abs(a); while (b){ const t = a % b; a = b; b = t; } return a || 1; })(n, d);
  return { n:n / g, d:d / g };
}
function rAdd(a, b){ return (a && b) ? rNorm({ n:a.n * b.d + b.n * a.d, d:a.d * b.d }) : null; }
function rSub(a, b){ return (a && b) ? rNorm({ n:a.n * b.d - b.n * a.d, d:a.d * b.d }) : null; }
function rMul(a, b){ return (a && b) ? rNorm({ n:a.n * b.n, d:a.d * b.d }) : null; }
function rDivR(a, b){ return (a && b && b.n !== 0) ? rNorm({ n:a.n * b.d, d:a.d * b.n }) : null; }
function rEq(a, b){ return !!(a && b) && a.n * b.d === b.n * a.d; }
/* 一個數：帶分數（中文「1 又 1/2」、英文「1 1/2」）、小數、分數、整數 */
const TERM_SRC = '(?:\\d+(?: 又 | )\\d+\\/\\d+|\\d+\\.\\d+|\\d+\\/\\d+|\\d+|[?？□])';
const OP_SRC = '[×*÷+＋\\-－−–/]';
/* 開括號只會在數的前面、關括號只會在後面 —— 不然「= 1/6 (already simplest form)」會把散文的「(」吃進算式 */
const ATOM_SRC = '(?:\\(\\s*)*' + TERM_SRC + '(?:\\s*\\))*';
const CHAIN_RE = new RegExp('(?<![\\d/.])' + ATOM_SRC + '(?:\\s*(?:' + OP_SRC + '|[＝=])\\s*' + ATOM_SRC + ')*(?![\\d/]|\\.\\d)', 'g');
function tokensOf(span){
  const toks = [];
  const re = /(\d+(?: 又 | )\d+\/\d+|\d+\.\d+|\d+\/\d+|\d+|[?？□]|[×*]|÷|\/|[+＋]|[\-－−–]|[＝=]|[()])/g;
  let m, last = 0;
  while ((m = re.exec(span)) !== null){
    if (span.slice(last, m.index).trim() !== '') return null;
    toks.push(m[0]); last = m.index + m[0].length;
  }
  return span.slice(last).trim() === '' ? toks : null;
}
function valueOfTok(t){
  let m = /^(\d+)(?: 又 | )(\d+)\/(\d+)$/.exec(t); if (m) return rNorm({ n:+m[1] * +m[3] + +m[2], d:+m[3] });
  m = /^(\d+)\.(\d+)$/.exec(t); if (m) return rNorm({ n:Number(m[1] + m[2]), d:Math.pow(10, m[2].length) });
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return rNorm({ n:+m[1], d:+m[2] });
  m = /^(\d+)$/.exec(t); if (m) return { n:+m[1], d:1 };
  return null;
}
function parseSide(toks){
  let i = 0, err = null;
  function factor(){
    const t = toks[i];
    if (t === undefined){ err = err || 'an operand is missing'; return null; }
    if (t === '('){ i++; const v = expr(); if (toks[i] !== ')'){ err = err || 'an unclosed bracket'; return null; } i++; return v; }
    i++;
    const v = valueOfTok(t);
    if (v === null) err = err || ('cannot read the operand "' + t + '"');
    return v;
  }
  function term(){
    let v = factor();
    while (i < toks.length && /^[×*÷/]$/.test(toks[i])){
      const op = toks[i++]; const r = factor();
      v = (op === '÷' || op === '/') ? rDivR(v, r) : rMul(v, r);
    }
    return v;
  }
  function expr(){
    let v = term();
    while (i < toks.length && /^[+＋\-－−–]$/.test(toks[i])){ const op = toks[i++]; const r = term(); v = /^[+＋]$/.test(op) ? rAdd(v, r) : rSub(v, r); }
    return v;
  }
  const v = expr();
  if (i !== toks.length) err = err || 'the expression did not parse to the end';
  return { v:v, err:err };
}
function fracArith(text){
  const problems = [];
  let verified = 0, questions = 0;
  const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
  const rest = plain.replace(CHAIN_RE, (whole, ...rx) => {
    const at = rx[rx.length - 2], full = rx[rx.length - 1];
    if (!/[＝=]/.test(whole)) return whole;
    let span = whole;
    for (let guard = 0; guard < 8; guard++){
      const opens = (span.match(/\(/g) || []).length, closes = (span.match(/\)/g) || []).length;
      if (opens === closes) break;
      const before = String(full).slice(0, at);
      const proseOpen = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
      if (closes > opens && proseOpen && /\)\s*$/.test(span)) span = span.replace(/\s*\)\s*$/, '');
      /* 反過來：散文開了一個括號、算式在裡面、散文自己再關（「(1×3=3, then adding back 2/3)」）—— 開頭那個 `(` 是散文的 */
      else if (opens > closes && /^\s*\(/.test(span) && /^[^(]*\)/.test(String(full).slice(at + whole.length))) span = span.replace(/^\s*\(\s*/, '');
      else break;
    }
    for (let guard = 0; guard < 8; guard++){
      const t = span.trim();
      if (!(t.startsWith('(') && t.endsWith(')'))) break;
      let depth = 0, matches = true;
      for (let k = 0; k < t.length; k++){
        if (t[k] === '(') depth++;
        else if (t[k] === ')'){ depth--; if (depth === 0 && k !== t.length - 1){ matches = false; break; } }
      }
      if (!matches || depth !== 0) break;
      span = t.slice(1, -1);
    }
    if (!/[＝=]/.test(span)) return whole;
    const sides = span.split(/[＝=]/).map(s => s.trim());
    if (sides.some(s => /[?？□]/.test(s))){ questions++; return ' Q '; }
    const vals = sides.map(s => { const tk = tokensOf(s); return tk === null ? { v:null, err:'cannot tokenise "' + s + '"' } : parseSide(tk); });
    vals.forEach(r => { if (r.err) problems.push(r.err + ' in "' + span + '"'); });
    for (let k = 1; k < vals.length; k++){
      verified++;
      if (!rEq(vals[k - 1].v, vals[k].v)) problems.push('this claim is wrong: "' + span + '"');
    }
    return ' Q ';
  });
  const leftover = rest.match(/[\d)）]\s*[＝=]\s*[\d(（]?/g);
  if (leftover) problems.push('an equals sign with a number on its left was not verified: "' + leftover[0].trim() + '"');
  return { problems, verified, questions };
}
const CLAIM_PROBES = [
  { text:'3 × 2/5 = (3×2)/5 = 6/5', bad:false },
  { text:'2/3 × 1/4 = (2×1)/(3×4) = 2/12', bad:false },
  { text:'1 又 1/2 × 4 = 3/2 × 4 = 12/2 = 6', bad:false },
  { text:'1 1/2 × 4 = 3/2 × 4 = 12/2 = 6', bad:false },
  { text:'3/4 × 2/5 = 6/20 = 3/10', bad:false },
  { text:'1/2 = 0.5', bad:false },
  { text:'3 × 3/4 = 3/4 + 3/4 + 3/4 = 9/4 = 2 又 1/4。', bad:false },
  { text:'12 × 1 1/2 = 18, bigger than 12.', bad:false },
  { text:'藍色有 2 × 3 = 6 格，整張紙有 3 × 4 = 12 格', bad:false },
  { text:'（1×2=2）', bad:false },
  { text:'(1×3=3, then adding back 2/3)', bad:false },
  { text:'6/36=1/6', bad:false },
  { text:'a/b × c/d = (a×c)/(b×d)', bad:false },
  { text:'2/4 × 1/3 = 1/2 × 1/3 = 1/6', bad:false },
  { text:'3 × 2/5 = (3×2)/5 = 6/10', bad:true },
  { text:'2/3 × 1/4 = (2×1)/(3×4) = 2/7', bad:true },
  { text:'1 又 1/2 × 4 = 3/2 × 4 = 12/2 = 5', bad:true },
  { text:'1 1/2 × 4 = 4/2 × 4', bad:true },
  { text:'1 又 2/3 × 3 = 3 又 2/3', bad:true },
  { text:'1/5 = 0.5', bad:true },
  { text:'12 × 1 1/2 = 15, bigger than 12.', bad:true },
  { text:'藍色有 2 × 3 = 5 格', bad:true },
  { text:'（1×2=3）', bad:true },
  { text:'3/5 × 5/9 = 1/1 × 1/3 = 1/9', bad:true },
  { text:'6 × 3/2 = 9.', bad:false },
  { text:'6 × 3/2 = 8.', bad:true }
];

/* ===================== 4 頁的文字從哪裡讀 ===================== */
function stripScripts(html){ return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '); }
/* 取字典：從 `var NAME = {` 開始數大括號（跳過字串與註解），不靠「下一行是什麼」 */
function literalAfter(src, head){
  const i = src.indexOf(head);
  if (i < 0) return null;
  let j = src.indexOf('{', i), depth = 0, k = j;
  for (; k < src.length; k++){
    const c = src[k];
    if (c === "'" || c === '"' || c === '`'){ const q = c; k++; while (k < src.length && src[k] !== q){ if (src[k] === '\\') k++; k++; } continue; }
    if (c === '/' && src[k + 1] === '*'){ k = src.indexOf('*/', k + 2) + 1; continue; }
    if (c === '/' && src[k + 1] === '/'){ while (k < src.length && src[k] !== '\n') k++; continue; }
    if (c === '{') depth++;
    else if (c === '}'){ depth--; if (depth === 0) break; }
  }
  return src.slice(j, k + 1);
}
function walkStrings(obj, out, where){
  if (typeof obj === 'string') out.push({ where, text:obj });
  else if (Array.isArray(obj)) obj.forEach((v, i) => walkStrings(v, out, where + '[' + i + ']'));
  else if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => walkStrings(obj[k], out, where + '.' + k));
}
/* 每一頁驗過幾條算式（markup ＋ 字典的字串）。數量變了就是有人改了句子 —— 重看一次再改這裡。 */
const CLAIM_COUNTS = { index:83, review:0, reference:33, parents:7 };

/* ===================== review.html：八個產生器 ===================== */
const GEN_IDS = ['fracXfrac', 'intXfrac', 'mixedXint', 'findFractionOfN', 'areaModel', 'compareSize', 'fracAdd', 'decimalConv'];
/* 參數池逐筆釘住（第二份來源；改池子就要改這裡，而改這裡就要重看一次誘答） */
const POOL_REF = {
  fracXfrac:       ['1/2x1/3', '3/4x2/5', '2/5x5/6', '3/8x2/3', '5/9x3/4', '4/5x5/8'],
  intXfrac:        ['3*2/5', '4*3/8', '8*3/4', '6*5/9', '9*5/6', '7*2/7'],
  mixedXint:       ['1+1/2*4', '2+1/3*3', '1+2/5*5', '3+1/4*2', '2+3/8*4', '1+1/6*3'],
  findFractionOfN: ['32*3/4', '50*2/5', '42*5/6', '56*3/8', '72*2/9', '27*2/3'],
  areaModel:       ['3/4x1/2', '2/3x3/4', '5/6x2/3', '3/5x5/6', '7/8x2/3', '4/9x3/4'],
  compareSize:     ['8*3/4', '5*5/4', '9*5/5', '12*5/8', '7*9/8', '10*9/9'],
  fracAdd:         ['1/2+1/3', '1/4+1/6', '2/3+1/4', '3/4+1/8', '1/2+1/6', '5/6+1/4'],
  decimalConv:     ['1/2', '1/4', '3/4', '1/5', '3/5']
};
function keyOf(id, d){
  switch (id){
    case 'fracXfrac': case 'areaModel': return d.a + '/' + d.b + 'x' + d.c + '/' + d.dd;
    case 'intXfrac': return d.k + '*' + d.a + '/' + d.b;
    case 'mixedXint': return d.whole + '+' + d.a + '/' + d.b + '*' + d.k;
    case 'findFractionOfN': return d.n + '*' + d.a + '/' + d.b;
    case 'compareSize': return d.base + '*' + d.a + '/' + d.b;
    case 'fracAdd': return d.a + '/' + d.b + '+' + d.c + '/' + d.dd;
    case 'decimalConv': return d.a + '/' + d.b;
  }
  return null;
}
/* 正解的值（有理數），只用原始參數算 */
function correctValRef(id, d){
  switch (id){
    case 'fracXfrac': case 'areaModel': return { n:d.a * d.c, d:d.b * d.dd };
    case 'intXfrac': return { n:d.k * d.a, d:d.b };
    case 'mixedXint': return { n:(d.whole * d.b + d.a) * d.k, d:d.b };
    case 'findFractionOfN': return { n:d.n * d.a, d:d.b };
    case 'fracAdd': return { n:d.a * d.dd + d.c * d.b, d:d.b * d.dd };
    case 'decimalConv': return { n:d.a, d:d.b };
  }
  return null;
}
/* 小數的寫法（第二套：長除法，不用 String(a / b)） */
function decTextRef(n, d){
  let q = Math.floor(n / d), r = n % d, s = String(q);
  if (r === 0) return s;
  s += '.';
  for (let i = 0; i < 6 && r; i++){ r *= 10; s += Math.floor(r / d); r %= d; }
  return r ? null : s;
}
const SIZE_WORDS = { zh:['比較小', '比較大', '一樣大', '要先算出來才能比較'], en:['Smaller', 'Bigger', 'The same', 'Need to calculate first'] };
function expectedCorrectRef(d, id, lang){
  if (id === 'compareSize'){ const cls = d.a < d.b ? 0 : (d.a > d.b ? 1 : 2); return SIZE_WORDS[lang][cls]; }
  if (id === 'decimalConv'){ const s = simpRef(d.a, d.b); return d.dir === 0 ? decTextRef(d.a, d.b) : (s.d === 1 ? String(s.n) : s.n + '/' + s.d); }
  const v = correctValRef(id, d);
  return simpTextRef(v.n, v.d, lang);
}
/* 選項讀回有理數：整數、分數、帶分數（兩種語言）、小數；讀不懂回 null */
function parseOptVal(s){
  const t = String(s).trim();
  let m = /^(\d+)(?: 又 | )(\d+)\/(\d+)$/.exec(t); if (m) return { n:+m[1] * +m[3] + +m[2], d:+m[3], shape:'mixed', raw:t };
  m = /^(\d+)\.(\d+)$/.exec(t); if (m) return { n:Number(m[1] + m[2]), d:Math.pow(10, m[2].length), shape:'dec', raw:t };
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return { n:+m[1], d:+m[2], shape:'frac', raw:t };
  m = /^(\d+)$/.exec(t); if (m) return { n:+m[1], d:1, shape:'int', raw:t };
  return null;
}
function sameVal(p, q){ return p.n * q.d === q.n * p.d; }
/* 寫成的就是最簡（整數、真分數、或帶分數的分數部分已約分、分子 < 分母） */
function isSimplestShape(p){
  if (p.shape === 'int') return true;
  const raw = p.raw, m = /^(\d+)(?: 又 | )(\d+)\/(\d+)$/.exec(raw);
  if (m) return +m[2] < +m[3] && gcdRef(+m[2], +m[3]) === 1 && +m[1] >= 1;
  const f = /^(\d+)\/(\d+)$/.exec(raw);
  return !!f && +f[1] < +f[2] && gcdRef(+f[1], +f[2]) === 1;
}
const SIMPLIFY_CUE = { zh:/記得約分|最簡/, en:/simplify|simplest form/ };
/* 「只乘分數部分」的迷思值：whole 又 (a×k)/b —— 唯一可以剛好等於題幹乘數 k 的誘答 */
function fracOnlyRef(d, lang){ return simpTextRef(d.whole * d.b + d.a * d.k, d.b, lang); }

const INVARIANTS = {};
GEN_IDS.forEach(id => {
  INVARIANTS[id] = function(d){
    const k = keyOf(id, d);
    if (POOL_REF[id].indexOf(k) < 0) return 'parameters ' + k + ' are not in the pinned pool';
    if (id === 'compareSize'){
      const cls = d.a < d.b ? 0 : (d.a > d.b ? 1 : 2);
      if (d.cls !== cls) return 'class ' + d.cls + ' but ' + d.a + '/' + d.b + ' compared with 1 is ' + cls;
      if (d.pn !== d.base * d.a || d.pd !== d.b) return 'product kept as ' + d.pn + '/' + d.pd;
      return null;
    }
    if (id === 'decimalConv'){
      if (!(d.dir === 0 || d.dir === 1)) return 'direction ' + d.dir;
      if (decTextRef(d.a, d.b) !== d.dec) return 'decimal ' + d.dec + ' for ' + d.a + '/' + d.b + ' (long division gives ' + decTextRef(d.a, d.b) + ')';
      return null;
    }
    if (id === 'findFractionOfN'){ if (d.n % d.b !== 0 || d.ans !== d.n / d.b * d.a) return d.n + ' × ' + d.a + '/' + d.b + ' kept as ' + d.ans; return null; }
    const v = correctValRef(id, d);
    if (id === 'fracAdd'){ if (d.L * gcdRef(d.b, d.dd) !== d.b * d.dd) return 'common denominator ' + d.L + ' is not the lcm'; if (!sameVal({ n:d.pn, d:d.pd }, v)) return 'sum kept as ' + d.pn + '/' + d.pd; return null; }
    if (d.pn !== v.n || d.pd !== v.d) return 'product kept as ' + d.pn + '/' + d.pd + ', independently ' + v.n + '/' + v.d;
    return null;
  };
});
/* 選項的上限：從釘住的參數池推出來，不是隨手給一個大數（LESSONS 2026-08-25）——
   每個產生器「最大的那一個迷思」能走到哪裡：n 的 a/b 忘了除是 n × a；k × a/b 把分數倒過來是 k × b/a ≤ k × b；
   帶分數乘整數不約分是 (w × b ＋ a) × k ／ b ≤ (w × b ＋ a) × k；分數相乘、相加的選項不超過 2；小數點點錯一位也小於 10。 */
const POOL_NUMS = id => POOL_REF[id].map(k => k.split(/[^\d]+/).map(Number));
const OPT_MAX = {
  findFractionOfN: Math.max(...POOL_NUMS('findFractionOfN').map(([n, a]) => n * a)),
  intXfrac: Math.max(...POOL_NUMS('intXfrac').map(([k, a, b]) => k * b)),
  mixedXint: Math.max(...POOL_NUMS('mixedXint').map(([w, a, b, k]) => (w * b + a) * k)),
  fracXfrac: 2, areaModel: 2, fracAdd: 2,
  decimalConv: 10   /* 真分數換成小數，小數點點錯一位（3/4 → 7.5）也不會到 10 */
};
function optionOk(s, id, lang, isCorrect){
  if (/undefined|NaN|null/.test(s)) return 'option "' + s + '" has undefined/NaN';
  if (id === 'compareSize') return SIZE_WORDS[lang].indexOf(s) >= 0 ? null : 'option "' + s + '" is not one of the four sentences';
  if (lang === 'zh' && /\d又|又\d/.test(s)) return 'option "' + s + '" glues 又 to a digit (write 1 又 1/2)';
  const p = parseOptVal(s);
  if (!p) return 'option "' + s + '" is not a number, fraction, mixed number or decimal';
  if (p.d === 0 || p.n < 0) return 'option "' + s + '" is not a positive value';
  if (p.n / p.d > OPT_MAX[id]) return 'option "' + s + '" is above ' + OPT_MAX[id] + ', the largest value this generator\'s own misconceptions can reach';
  if (id === 'decimalConv'){ if (p.shape !== 'dec' && p.shape !== 'frac' && p.shape !== 'int') return 'decimalConv option "' + s + '"'; return null; }
  if (isCorrect && !isSimplestShape(p)) return 'the correct option "' + s + '" is not written in simplest form';
  return null;
}
/* 每一個誘答都要是一個說得出名字的迷思（codex 第一輪：只驗形狀和不重複的話，換成任意的 13/17 也會過）。
   顯示的字串要逐字對上下面其中一條算出來的字串；正解不在這裡面比。 */
const raw = (n, d) => n + '/' + d;
const MISCON = {
  fracXfrac: (d, L) => ({ unsimplified:raw(d.a * d.c, d.b * d.dd), addTopsAndBottoms:raw(d.a + d.c, d.b + d.dd), firstOnly:raw(d.a, d.b),
                          multiplyTopsAddBottoms:raw(d.a * d.c, d.b + d.dd), addedInstead:raw(d.a * d.dd + d.c * d.b, d.b * d.dd) }),
  areaModel: (d, L) => ({ unsimplified:raw(d.a * d.c, d.b * d.dd), addTopsAndBottoms:raw(d.a + d.c, d.b + d.dd), lengthOnly:raw(d.a, d.b), widthOnly:raw(d.c, d.dd) }),
  intXfrac: (d, L) => ({ unsimplified:raw(d.k * d.a, d.b), multipliedDenominator:raw(d.a, d.k * d.b), addedWhole:simpTextRef(d.k * d.b + d.a, d.b, L),
                         flipped:simpTextRef(d.k * d.b, d.a, L), multipliedBoth:raw(d.k * d.a, d.k * d.b) }),
  mixedXint: (d, L) => ({ wholePartOnly:simpTextRef(d.whole * d.k * d.b + d.a, d.b, L), unsimplified:raw(d.pn, d.pd), fractionPartOnly:fracOnlyRef(d, L) }),
  findFractionOfN: (d, L) => ({ forgotToMultiply:String(d.n / d.b), forgotToDivide:String(d.n * d.a), addedNumerator:String(d.n / d.b + d.a) }),
  fracAdd: (d, L) => { const l = d.b * d.dd / gcdRef(d.b, d.dd);
    return { addTopsAndBottoms:raw(d.a + d.c, d.b + d.dd), addTopsMultiplyBottoms:raw(d.a + d.c, d.b * d.dd),
             forgotToScaleFirst:raw(d.a + d.c * l / d.dd, l), forgotToScaleSecond:raw(d.a * l / d.b + d.c, l), unsimplified:raw(d.pn, d.pd) }; },
  decimalConv: (d, L) => {
    if (d.dir === 0) return { slashAsPoint:d.a + '.' + d.b, denominatorAsTenths:d.b < 10 ? '0.' + d.b : null, digitsAfterPoint:'0.' + d.a + d.b,
                              pointOneTooFarRight:decTextRef(10 * d.a, d.b), reversed:d.b + '.' + d.a };
    const digits = d.dec.split('.')[1] || '';
    return { flipped:raw(d.b, d.a), oneOverDigits:raw(1, +digits), wrongPlaceValue:raw(+digits, digits.length === 1 ? 100 : 10) };
  }
};
/* 渲染出來的那一題：值兩兩不同（只放行「題幹要求約分時、未約分的正解」那一個）、題幹印的數就是參數、解釋逐條驗算 */
function renderCheck(d, q, lang, id){
  const plainStem = String(q.stem).replace(/<[^>]+>/g, ' ');
  if (id !== 'compareSize' && id !== 'decimalConv'){
    const vals = q.opts.map(parseOptVal);
    if (vals.some(v => !v)) return 'an option cannot be read back';
    const cue = SIMPLIFY_CUE[lang].test(plainStem);
    for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++){
      if (!sameVal(vals[i], vals[j])) continue;
      const pair = [i, j];
      const okPair = cue && pair.indexOf(q.ans) >= 0 && !isSimplestShape(vals[pair[0] === q.ans ? pair[1] : pair[0]]);
      if (!okPair) return 'options "' + q.opts[i] + '" and "' + q.opts[j] + '" have the same value' + (cue ? '' : ' (and the stem never asks to simplify)');
    }
  }
  if (id === 'decimalConv'){
    const vals = q.opts.map(parseOptVal);
    if (vals.some(v => !v)) return 'an option cannot be read back';
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (sameVal(vals[i], vals[j])) return 'options "' + q.opts[i] + '" and "' + q.opts[j] + '" have the same value';
  }
  if (MISCON[id]){
    const named = MISCON[id](d, lang), names = Object.keys(named).filter(k => named[k] !== null), shown = names.map(k => named[k]);
    for (let i = 0; i < q.opts.length; i++){
      if (i === q.ans) continue;
      if (shown.indexOf(String(q.opts[i])) < 0) return 'distractor "' + q.opts[i] + '" matches no named misconception (' + names.map(k => k + '=' + named[k]).join(', ') + ')';
    }
  }
  /* 題幹印的數：照參數的順序 */
  const want = {
    fracXfrac:[d.a, d.b, d.c, d.dd], areaModel:[d.a, d.b, d.c, d.dd], fracAdd:[d.a, d.b, d.c, d.dd],
    intXfrac:[d.k, d.a, d.b], mixedXint:[d.whole, d.a, d.b, d.k], compareSize: lang === 'zh' ? [d.base, d.a, d.b, d.base] : [d.base, d.a, d.b],
    findFractionOfN: lang === 'zh' ? [d.n, d.a, d.b] : [d.a, d.b, d.n],
    decimalConv: d.dir === 0 ? [d.a, d.b] : nums(d.dec)
  }[id];
  if (!sameList(nums(plainStem), want)) return 'the stem prints ' + nums(plainStem).join(',') + ', the parameters say ' + want.join(',');
  const r = fracArith(q.why);
  if (r.problems.length) return 'why: ' + r.problems[0];
  if (r.verified < 1) return 'why verifies no equation: ' + q.why.slice(0, 80);
  /* 解釋的最後一個數就是正解（compareSize 說的是積） */
  if (id !== 'compareSize'){
    const tail = String(q.why).replace(/<[^>]+>/g, ' ');
    const want2 = expectedCorrectRef(d, id, lang);
    if (tail.indexOf(want2) < 0) return 'why never states the answer ' + want2;
  }
  return null;
}

/* review.html 的每一個產生器、每一筆參數都確定地走一遍（simgen 是抽樣；抽樣證明不了「池子裡的每一筆都還在、都被驗過」）：
   GENS 的 id 必須剛好是 GEN_IDS，每個池子（順序、重複都算）必須逐筆等於 POOL_REF（少一筆、多一筆、重複一筆都要響），
   每一筆兩種語言都過 INVARIANTS、expectedCorrect、optionOk、renderCheck。decimalConv 兩個方向都要走到。 */
function checkReviewPools(fail, reviewSrc){
  const i = reviewSrc.indexOf('/* ---------- 工具 ---------- */'), j = reviewSrc.indexOf('/* ---------- 出一批');
  if (i < 0 || j < 0) return fail('review.html: cannot cut the GENS block');
  /* 換掉 pickUnused 與 rand（同一個作用域裡的函式宣告可以重新指定）：先錄下每個產生器的整個池子（順序與重複都算），
     再逐一指定要哪一筆、decimalConv 指定方向 —— 完全確定，不靠亂數抽到。 */
  let H;
  try { H = new Function(reviewSrc.slice(i, j) + '\n; return { GENS:GENS, setPick:function(f){ pickUnused = f; }, setRand:function(f){ rand = f; } };')(); }
  catch (e){ return fail('review.html GENS could not run: ' + e.message); }
  const GENS = H.GENS, ids = GENS.map(g => g.id);
  if (!sameList(ids, GEN_IDS)) fail('review.html generators are ' + ids.join() + ', expected ' + GEN_IDS.join());
  const realRand = n => Math.floor(Math.random() * n);
  GENS.forEach(g => {
    if (!POOL_REF[g.id]) return;
    let pool = null;
    H.setPick(function(p){ pool = p.slice(); return p[0]; });
    H.setRand(realRand);
    try { g.make([]); } catch (e){ return fail('review ' + g.id + ': make() threw ' + e.message); }
    if (!pool) return fail('review ' + g.id + ': make() never picks from a pool');
    const norm = k => String(k).replace(' 又 ', '+');   /* mixedXint 的內部鍵是「1 又 1/2*4」 */
    const keysOf = pool.map(norm);
    if (!sameList(keysOf, POOL_REF[g.id])) fail('review ' + g.id + ': the pool is ' + keysOf.join(' ') + ', pinned ' + POOL_REF[g.id].join(' ') + ' (order and duplicates count)');
    pool.forEach((pk, idx) => {
      (g.id === 'decimalConv' ? [0, 1] : [null]).forEach(dir => {
        H.setPick(function(p){ return p[idx]; });
        H.setRand(dir === null ? realRand : (n => n === 2 ? dir : realRand(n)));
        let d;
        try { d = g.make([]); } catch (e){ fail('review ' + g.id + ' #' + idx + ': make() threw ' + e.message); return; }
        H.setRand(realRand);
        const key = keyOf(g.id, d) + (dir === null ? '' : '|' + d.dir);
        if (keyOf(g.id, d) !== norm(pk)) fail('review ' + g.id + ' #' + idx + ': picked ' + pk + ' but made ' + keyOf(g.id, d));
        if (dir !== null && d.dir !== dir) fail('review decimalConv ' + key + ': direction ' + dir + ' was asked for, got ' + d.dir);
        const inv = INVARIANTS[g.id](d);
        if (inv) fail('review ' + g.id + ' ' + key + ': ' + inv);
        ['zh', 'en'].forEach(L => {
          const q = g.fmt(d, L), want = expectedCorrectRef(d, g.id, L);
          if (String(q.opts[q.ans]) !== want) fail('review ' + g.id + ' ' + key + ' ' + L + ': marked answer "' + q.opts[q.ans] + '", independently "' + want + '"');
          q.opts.forEach((o, oi) => { const bad = optionOk(String(o), g.id, L, oi === q.ans); if (bad) fail('review ' + g.id + ' ' + key + ' ' + L + ': ' + bad); });
          const r = renderCheck(d, q, L, g.id);
          if (r) fail('review ' + g.id + ' ' + key + ' ' + L + ': ' + r);
        });
      });
    });
  });
}

/* ===================== 小遊戲「分數切切樂」 ===================== */
const GAME_TYPES = ['add', 'cut', 'size', 'mix', 'can'];
const BOARD_W = 300, PICK_REF = 44;
const EN_COUNT_NOUNS = ['strip', 'cell', 'part', 'bar', 'whole bar', 'time'];
function enPlural(txt){
  for (const w of EN_COUNT_NOUNS){
    if (new RegExp('\\b1 ' + w + 's\\b').test(txt)) return 'prints "1 ' + w + 's"';
    const m = new RegExp('(^|[^/\\d])(\\d+) ' + w + '\\b(?!s)').exec(txt);
    if (m && +m[2] !== 1) return 'prints "' + m[2] + ' ' + w + '" without the plural s';
  }
  return null;
}
/* 一句旁白：數字照順序、算式全對、英文單複數 */
function sayCheck(fail, where, text, want, minVerified){
  if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
  if (want && !sameList(nums(text), want)) fail(where + ': numbers should read ' + want.join(',') + ', got ' + nums(text).join(',') + ' — ' + text);
  const r = fracArith(text);
  r.problems.forEach(p => fail(where + ': ' + p + ' — ' + text));
  if (minVerified && r.verified < minVerified) fail(where + ': verifies only ' + r.verified + ' equation(s), expected ' + minVerified + ' — ' + text);
  if (/[a-z]/.test(text)){ const pp = enPlural(text); if (pp) fail(where + ': ' + pp + ' — ' + text); }
  if (/[一-鿿]/.test(text)){ const g = text.match(/\d又|又\d/); if (g) fail(where + ': "' + g[0] + '" — a mixed number glued to 又 (write 1 又 1/2)'); }
}
function simpNums(n, d){ const s = simpRef(n, d), w = Math.floor(s.n / s.d), r = s.n - w * s.d; return r === 0 ? [w] : (w > 0 ? [w, r, s.d] : [r, s.d]); }
function valNums(n, d){ const s = simpNums(n, d); return (s.length === 2 && s[0] === n && s[1] === d) ? [n, d] : [n, d].concat(s); }

function checkGame(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  if (!sameList(D.GAME_ORDER, GAME_TYPES)) fail('GAME_ORDER should be ' + GAME_TYPES.join() + ', got ' + (D.GAME_ORDER || []).join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const needSrc = (re, what) => { if (!re.test(src)) fail(what); };
  ['GAME_ADD', 'GAME_CUT', 'GAME_SIZE', 'GAME_MIX', 'GAME_CAN'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 4) fail(k + ' should be a pool of at least 4 entries');
  });

  /* ---------- 1. 引擎的保險（原始碼形狀） ---------- */
  needSrc(/if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板：放開什麼都不做 \*\//, 'a piece released after the board was rebuilt still acts (no board-generation guard in addPiece end())');
  needSrc(/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a second finger / an old board\'s piece can still be picked up');
  needSrc(/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation');
  needSrc(/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode does not show hint level 1 automatically');
  needSrc(/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'a lost pointer capture does not put the piece back');
  needSrc(/document\.addEventListener\('pointerup', onDocEnd\);/, 'no document-level release while dragging');
  needSrc(/if \(!start \|\| e\.pointerId !== pid\) return;/, 'a second finger is not ignored while dragging');
  needSrc(/\.gpiece\.locked\{cursor:default;pointer-events:none\}/, 'placed pieces still take pointer events');
  needSrc(/\.gpiece\{left:0;top:0;display:flex;align-items:center;justify-content:center;\s*touch-action:none;/, 'pieces do not set touch-action:none');
  needSrc(/board\.style\.transform = 'scale\(' \+ k \+ '\)';/, 'the board is not scaled as one piece');
  needSrc(/var k = Math\.min\(1\.5, avail \/ W\);/, 'the board scale is not capped at 1.5');
  needSrc(/gameStage\.textContent = '';/, 'startRound() does not clear the stage before rendering');
  ['add', 'cut', 'size', 'mix', 'can'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'no tap-then-tap alternative for the drag'));
  need('size', /sizeTray\(set\)\.forEach/, 'the cards are not laid out through sizeTray() (shuffled, never in basket order)');
  need('mix', /mixKnives\(e\)\.forEach/, 'the knives are not laid out through mixKnives() (shuffled)');
  need('add', /if \(k >= cap\)\{ roundNote\(d\.gAddFull\);/, 'a full track is not a quiet note');
  need('add', /var j = addJudge\(e, k\);/, 'Done is not judged by addJudge()');
  need('cut', /var r = cutJudge\(e, i, j\);/, 'Cut! is not judged by cutJudge()');
  need('cut', /if \(vk\.busy\(\) \|\| hk\.busy\(\)\) return;/, 'Cut! is judged while a knife is still being dragged');
  need('cut', /snap:isV \? function\(x\)\{ return S\.x \+ cutSnap\(x - S\.x, S\.s, e\.b\) \* cv; \} : function\(y\)\{ return S\.y \+ cutSnap\(y - S\.y, S\.s, e\.d\) \* chh; \}/, 'the knives do not snap to the drawn lines while dragging');
  need('size', /if \(b\.kind !== k\)\{/, 'a card is not refused by the wrong basket');
  need('mix', /if \(k !== e\.d\)\{ roundMiss\(d\.gMixKnife\(k, e\.n, e\.d\)\);/, 'a wrong knife is not refused with a reason');
  need('mix', /if \(told\[v\]\)\{ roundNote\(why\); return; \}\s*told\[v\] = true;\s*roundMiss\(why\);/, 'the same wrong count costs again on every press');
  need('add', /if \(gSolved \|\| stamp\.busy\(\)\) return;/, 'Done is judged while a strip is still held');
  need('add', /if \(gSolved \|\| k === 0 \|\| stamp\.busy\(\)\) return;/, '"Remove one" acts while a strip is still held');
  /* 刀的位置、畫面上的分數、判斷用的 i／j 是同一個數：onPlace 從「吸好的位置」算出 i（或 j）再重畫 */
  need('cut', /if \(isV\)\{ var ni = cutSnap\(K\.cx - S\.x, S\.s, e\.b\); if \(ni !== i\)\{ i = ni; draw\(\); refreshHint\(\); \} \}\s*else \{ var nj = cutSnap\(K\.cy - S\.y, S\.s, e\.d\); if \(nj !== j\)\{ j = nj; draw\(\); refreshHint\(\); \} \}/,
       'the knife onPlace does not update the judged i / j (and redraw) from the snapped position');
  need('cut', /if \(vk\) vk\.el\.querySelector\('\.gkval'\)\.textContent = d\.frac\(i, e\.b\);\s*if \(hk\) hk\.el\.querySelector\('\.gkval'\)\.textContent = d\.frac\(j, e\.d\);/, 'the knife labels do not show the judged i / j');
  /* 點一下的範圍 ＝ 紙（每一條線左右各半格）＋ 上面的刻度與把手那一條（沒有上界），往下多 tapPad；橫刀對稱 */
  need('cut', /function inV\(pt\)\{ return pt\.y <= S\.y \+ S\.s \+ CUT_KNIFE\.tapPad && pt\.x >= S\.x - cv \/ 2 && pt\.x <= S\.x \+ S\.s \+ cv \/ 2; \}/, 'the up-down knife tap zone does not cover the whole paper and its ticks');
  need('cut', /function inH\(pt\)\{ return pt\.x <= S\.x \+ S\.s \+ CUT_KNIFE\.tapPad && pt\.y >= S\.y - chh \/ 2 && pt\.y <= S\.y \+ S\.s \+ chh \/ 2; \}/, 'the side knife tap zone does not cover the whole paper and its ticks');
  need('cut', /if \(pt\.tap && !inV\(pt\)\) return false;\s*P\.rehome\(S\.x \+ cutSnap\(pt\.x - S\.x, S\.s, e\.b\) \* cv, CUT_KNIFE\.vy\);/, 'a tap does not move the up-down knife to the nearest line');
  need('cut', /if \(pt\.tap && !inH\(pt\)\) return false;\s*P\.rehome\(CUT_KNIFE\.hx, S\.y \+ cutSnap\(pt\.y - S\.y, S\.s, e\.d\) \* chh\);/, 'a tap does not move the side knife to the nearest line');
  need('can', /if \(v\[i\] === 1 && !P\.locked\)\{ P\.lock\(P\.homeX, P\.homeY\); slots\[i\]\.done = true; \}/, 'tiles at 1 are not locked (and their slot closed)');
  need('can', /var r = canPair\(v, i, j\);/, 'pairs are not judged by canPair()');
  need('can', /var left = canLeft\(v\);\s*if \(left\)\{ roundMiss/, '"Done — multiply" is not refused while something still simplifies');
  needSrc(/function canon\(s\)\{ s = String\(s\)\.trim\(\); return \/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(s\) \? \+s : null; \}/, 'the count box does not accept only plain whole numbers');

  /* ---------- 2. 計分（§三 高年級：有扣分；+20 ／ +10，放錯 −5 最低 0；五關沒犯錯再 +20） ---------- */
  {
    const fsrc = extractFunction(src, 'roundMiss');
    if (!fsrc) fail('scoring: cannot find roundMiss()');
    else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
      let r;
      try { r = new Function('var gMistake = false, gAnyMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake, any:gAnyMistake };')(); }
      catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
      if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
      if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
      if (r.html.indexOf('why') < 0 || !r.m || !r.any) fail('scoring: roundMiss() does not show the reason or record the mistake (for this round and the whole run)');
    });
    const ssrc = extractFunction(src, 'roundSolved');
    if (!ssrc) fail('scoring: cannot find roundSolved()');
    else [[0, false, false, 20], [0, true, true, 10], [4, false, false, 40], [4, true, true, 10], [4, false, true, 20]].forEach(([round, mis, any, want]) => {
      let r;
      try {
        r = new Function('var gSolved = false, gScore = 0, gMistake = ' + mis + ', gAnyMistake = ' + any + ', gRound = ' + round + ', GAME_ORDER = [1,2,3,4,5];' +
          'var gameStage = { querySelectorAll:function(){ return []; } }, elScore = {}, gHintBtn = {}, elHint = { textContent:"old hint" }, gMsg = {}, gNext = { disabled:true };' +
          'function L(){ return { gPts:function(p){ return "+" + p; }, gWin:function(s, b){ return "WIN" + s + (b ? "B" : ""); }, gClear:"CLEAR" }; }\n' + ssrc +
          '\nroundSolved("ok"); return { s:gScore, hint:elHint.textContent, dis:gHintBtn.disabled, next:gNext.disabled, html:gMsg.innerHTML };')();
      } catch (e){ return fail('scoring: roundSolved() could not run: ' + e.message); }
      if (r.s !== want) fail('scoring: round ' + (round + 1) + (mis ? ' with' : ' without') + ' mistakes' + (any ? ' (earlier mistakes in the run)' : '') + ' gives ' + r.s + ', expected ' + want);
      if (r.hint !== '' || r.dis !== true) fail('scoring: a solved round leaves the hint showing or the hint button enabled');
      if ((round < 4) === r.next) fail('scoring: Next is ' + (r.next ? 'disabled after a cleared round' : 'enabled after the last round'));
      if (round === 4 && /B/.test(r.html) !== (!any)) fail('scoring: the clean-run bonus line is ' + (any ? 'shown after mistakes' : 'missing'));
    });
  }
  LANGS.forEach(L => {
    sayCheck(fail, 'gPts ' + L, I18N[L].gPts(20), [20]);
    sayCheck(fail, 'gMinus ' + L, I18N[L].gMinus, [5]);
    if (nums(I18N[L].gWin(115, false)).indexOf(115) < 0 || nums(I18N[L].gWin(120, true)).indexOf(120) < 0) fail('gWin ' + L + ' does not show the score');
    if (nums(I18N[L].gWin(120, true)).indexOf(20) < 0) fail('gWin ' + L + ' does not name the 20-point bonus');
    if (nums(I18N[L].s5lead).join() !== '5,20') fail('s5lead ' + L + ' should state −5 and the 20-point bonus: ' + I18N[L].s5lead);
  });

  /* ---------- 3. nearestOpen()／shuffle()：從原始碼切出來真的跑 ---------- */
  let nearestOpen = null, shuffle = null;
  try { nearestOpen = new Function(extractFunction(src, 'nearestOpen') + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); }
  try { shuffle = new Function(extractFunction(src, 'shuffle') + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); }
  const box = (id, cx, cy, w, h) => ({ id, cx, cy, hw:w / 2, hh:h / 2, done:false });
  if (nearestOpen){
    const K = D.SIZE_BIN;
    const bins = K.xs.map((x, i) => box(i, x, K.y + K.h / 2, K.w, K.h));
    let bad = 0;
    bins.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 4){ const g = nearestOpen(bins, { x, y }, K.pad); if (!g || g.id !== b.id) bad++; } });
    if (bad) fail('nearestOpen(): ' + bad + ' points inside a basket are given to another one (or none)');
    for (let i = 0; i + 1 < bins.length; i++){
      const a = bins[i], b = bins[i + 1], gl = a.cx + a.hw, gr = b.cx - b.hw;
      if (!(gr - gl < 2 * K.pad)) { fail('the baskets ' + i + ' and ' + (i + 1) + ' snap zones do not overlap — the nearest-basket rule is never exercised'); continue; }
      let wrong = 0, seen = 0;
      for (let x = gl - K.pad + 0.25; x < gr + K.pad; x += 0.5){
        const g = nearestOpen(bins, { x, y:b.cy }, K.pad), want = (x - gl) < (gr - x) ? a : (x - gl) > (gr - x) ? b : null;
        if (!want) continue;
        seen++; if (!g || g.id !== want.id) wrong++;
      }
      if (!seen || wrong) fail('nearestOpen(): ' + wrong + ' points between baskets ' + i + ' and ' + (i + 1) + ' go to the farther one');
    }
    const two = [ box(0, 100, 100, 84, 84), box(1, 155, 100, 24, 24) ];
    const r0 = nearestOpen(two, { x:140, y:100 }, 6);
    if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
    const done = [ Object.assign(box(0, 100, 100, 44, 44), { done:true }), box(1, 148, 100, 44, 44) ];
    if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
    if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
  }
  if (shuffle){
    let up = 0;
    for (let t = 0; t < 3000; t++){ const a = shuffle([2, 3, 4, 5]); if (a.join() === '2,3,4,5') up++; if (a.slice().sort().join() !== '2,3,4,5') { fail('shuffle() loses or duplicates items: ' + a.join()); break; } }
    if (up) fail('shuffle() returned the ascending order ' + up + ' times in 3000');
  }

  /* ---------- 4. 第 1 關：連加 ---------- */
  {
    const T0 = D.ADD_TRACK;
    D.GAME_ADD.forEach(e => {
      const tag = 'add ' + e.n + ' × ' + e.a + '/' + e.b;
      if (!(Number.isInteger(e.n) && e.n >= 2 && e.n <= 5 && Number.isInteger(e.a) && Number.isInteger(e.b) && e.a >= 1 && e.a < e.b && e.b >= 2 && e.b <= 6)) fail(tag + ': outside the lesson range (n 2..5, a/b a proper fraction, b 2..6)');
      const T = D.addWholes(e), cap = D.addCap(e);
      /* 第二套：至少放得下第 n + 1 條的最少整數個 1 */
      let Tref = 1; while (Tref * e.b < (e.n + 1) * e.a) Tref++;
      if (T !== Tref) fail(tag + ': the track has ' + T + ' wholes, independently ' + Tref);
      if (T > 3) fail(tag + ': ' + T + ' wholes is too long for the track');
      const capRef = Math.floor(T * e.b / e.a);
      if (cap !== capRef) fail(tag + ': the track holds ' + cap + ' strips, independently ' + capRef);
      if (!(cap > e.n)) fail(tag + ': the track is not longer than the answer — "fill it up" would be the answer');
      if (T0.w / (T * e.b) < 14) fail(tag + ': one cell is only ' + (T0.w / (T * e.b)).toFixed(1) + 'px wide');
      const cw = T0.w / (T * e.b), cardW = Math.max(D.ADD_STAMP.minW, Math.ceil(e.a * cw) + 16);
      if (cardW > BOARD_W - 8 || D.ADD_STAMP.cx - cardW / 2 < 0 || D.ADD_STAMP.cx + cardW / 2 > BOARD_W) fail(tag + ': the strip card (' + cardW + ' wide) does not fit the board');
      /* 照遊戲的規則：一條一條接（不可以超過 cap），只有剛好 n 條時「放好了」才收 */
      for (let k = 0; k <= cap; k++){
        const want = k === e.n ? 'ok' : (k < e.n ? 'few' : 'many');
        if (D.addJudge(e, k) !== want) fail(tag + ': Done with ' + k + ' strips is judged ' + D.addJudge(e, k) + ', expected ' + want);
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        const addends = []; for (let i = 0; i < e.n; i++) addends.push(e.a, e.b);
        sayCheck(fail, tag + ' gAddDone ' + L, d.gAddDone(e.n, e.a, e.b), [e.n, e.a, e.b].concat(addends).concat(valNums(e.n * e.a, e.b)), e.n === 1 ? 1 : 2);
        const done = d.gAddDone(e.n, e.a, e.b);
        if (done.indexOf(valTextRef(e.n * e.a, e.b, L)) < 0) fail(tag + ' gAddDone ' + L + ': does not end with ' + valTextRef(e.n * e.a, e.b, L));
        for (let k = 0; k <= cap; k++){
          if (k !== e.n) sayCheck(fail, tag + ' gAddCount(' + k + ') ' + L, d.gAddCount(k, e.n, e.a, e.b), [k, e.a, e.b, e.n, e.a, e.b, e.a, e.b, e.n, e.n]);
          sayCheck(fail, tag + ' gAddNow(' + k + ') ' + L, d.gAddNow(e.n, e.a, e.b, k), k === 0 ? [e.n, e.a, e.b] : [e.n, e.a, e.b, k, k * e.a, e.b]);
          sayCheck(fail, tag + ' gAdd2(' + k + ') ' + L, d.gAdd2(e.n, e.a, e.b, k), [e.n, e.a, e.b, k]);
        }
      });
    });
    if (!(D.ADD_ZONE.x <= T0.x && D.ADD_ZONE.x + D.ADD_ZONE.w >= T0.x + T0.w && D.ADD_ZONE.y <= T0.y && D.ADD_ZONE.y + D.ADD_ZONE.h >= T0.y + T0.h + T0.lblH - 4))
      fail('add: the drop zone does not cover the drawn track and its 0/1/2 numbers');
    if (D.ADD_ZONE.y + D.ADD_ZONE.h + D.ADD_ZONE.pad >= D.ADD_STAMP.cy - D.ADD_STAMP.h / 2) fail('add: the strip card at home already sits in the drop zone');
    if (D.ADD_STAMP.h < PICK_REF || D.ADD_STAMP.minW < PICK_REF) fail('add: the strip card is smaller than 44px');
    if (D.ADD_STAMP.cy + D.ADD_STAMP.h / 2 > D.ADD_H) fail('add: the strip card hangs below the board');
  }

  /* ---------- 5. 第 2 關：切了再切 ---------- */
  {
    const S = D.CUT_SQ, KN = D.CUT_KNIFE, G = D.GPICK;
    if (S.x + S.s > BOARD_W - 4 || S.y + S.s > D.CUT_H - 4) fail('cut: the paper does not fit the board');
    if (KN.vy - G / 2 < 0 || KN.hx - G / 2 < 0) fail('cut: a knife handle sticks out of the board');
    if (KN.vy + G / 2 > S.y - 10 || KN.hx + G / 2 > S.x - 10) fail('cut: a knife handle covers the paper or its ticks');
    /* 兩把刀都在 0 的時候（一開始）把手不可以重疊；直刀在最右邊也不可以出界 */
    if (!(KN.hx + G / 2 <= S.x - G / 2 || KN.vy + G / 2 <= S.y - G / 2)) fail('cut: the two knife handles overlap at the start');
    if (S.x + S.s + G / 2 > BOARD_W || S.y + S.s + G / 2 > D.CUT_H) fail('cut: a knife at the far end sticks out of the board');
    if (G < PICK_REF) fail('cut: knife handles smaller than 44px');
    D.GAME_CUT.forEach(e => {
      const tag = 'cut ' + e.a + '/' + e.b + ' × ' + e.c + '/' + e.d;
      if (!(e.a >= 1 && e.a < e.b && e.c >= 1 && e.c < e.d && e.b >= 2 && e.b <= 6 && e.d >= 2 && e.d <= 6)) fail(tag + ': outside the lesson range');
      if (e.a === e.c && e.b === e.d) fail(tag + ': both knives would stop on the same fraction');
      [[e.b, 'up-down'], [e.d, 'side']].forEach(([parts, which]) => {
        const step = S.s / parts;
        if (step < 32) fail(tag + ': the ' + which + ' lines are only ' + step.toFixed(1) + 'px apart');
        /* 每一個位置：最近的那一條刻度（第二套：逐條比距離），兩端夾住 */
        let bad = 0;
        for (let p = -S.s / 2; p <= S.s * 1.5; p += 0.25){
          let best = 0, bd = Infinity;
          for (let k = 0; k <= parts; k++){ const dd = Math.abs(p - k * step); if (dd < bd - 1e-9){ bd = dd; best = k; } }
          const got = D.cutSnap(p, S.s, parts);
          if (got !== best && Math.abs(Math.abs(p - got * step) - bd) > 1e-9) bad++;
        }
        if (bad) fail(tag + ': cutSnap() puts ' + bad + ' positions on a line that is not the nearest (' + which + ')');
      });
      for (let i = 0; i <= e.b; i++) for (let j = 0; j <= e.d; j++){
        const want = i !== e.a ? 'col' : (j !== e.c ? 'row' : null);
        if (D.cutJudge(e, i, j) !== want) fail(tag + ': knives at ' + i + '/' + e.b + ', ' + j + '/' + e.d + ' judged ' + D.cutJudge(e, i, j));
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gCutDone ' + L, d.gCutDone(e.a, e.b, e.c, e.d), [e.a, e.c, e.a * e.c, e.b, e.d, e.b * e.d, e.a, e.b, e.c, e.d].concat(valNums(e.a * e.c, e.b * e.d)), 3);
        sayCheck(fail, tag + ' gCutLine ' + L, d.gCutLine(e.a, e.b, e.c, e.d), [e.a, e.b, e.c, e.d, e.a * e.c, e.b * e.d], 1);
        for (let i = 0; i <= e.b; i++) if (i !== e.a)
          sayCheck(fail, tag + ' gCutCol(' + i + ') ' + L, d.gCutCol(i, e.b, e.a), L === 'zh' ? [i, e.b, e.a, e.b, e.b, e.a] : [i, e.b, e.a, e.b, e.a, e.b]);
        for (let j = 0; j <= e.d; j++) if (j !== e.c)
          sayCheck(fail, tag + ' gCutRow(' + j + ') ' + L, d.gCutRow(j, e.d, e.c), L === 'zh' ? [j, e.d, e.c, e.d, e.d, e.c] : [j, e.d, e.c, e.d, e.c, e.d]);
        sayCheck(fail, tag + ' gCutNow ' + L, d.gCutNow(e.a, e.b, e.c, e.d, 0, 0), [e.a, e.b, e.c, e.d, 0, e.b, 0, e.d]);
        sayCheck(fail, tag + ' gCut2 ' + L, d.gCut2(e.a, e.b, e.c, e.d, 0, 1), [e.a, e.b, 0, e.b, e.c, e.d, 1, e.d]);
      });
    });
  }

  /* ---------- 6. 第 3 關：變大還是變小 ---------- */
  {
    const K = D.SIZE_BIN, ORDER = ['small', 'same', 'big'];
    if (!sameList(D.SIZE_BINS, ORDER)) fail('size: the baskets should be ' + ORDER.join());
    K.xs.forEach(x => { if (x - K.w / 2 < 0 || x + K.w / 2 > BOARD_W) fail('size: a basket sticks out of the board'); });
    if (K.y + K.h > D.SIZE_H) fail('size: the baskets hang below the board');
    const lblBot = D.SIZE_LBL.y + D.SIZE_LBL.h;
    if (D.SIZE_SPOT[0] - D.SIZE_PLACED.h / 2 < lblBot + 2) fail('size: the first placed card covers the basket name');
    if (D.SIZE_SPOT[D.SIZE_CAP - 1] + D.SIZE_PLACED.h / 2 > K.y + K.h - 2) fail('size: the last placed card hangs out of its basket');
    for (let i = 1; i < D.SIZE_CAP; i++) if (D.SIZE_SPOT[i] - D.SIZE_SPOT[i - 1] < D.SIZE_PLACED.h + 2) fail('size: placed cards overlap in a basket');
    if (D.SIZE_PLACED.w > K.w - 4) fail('size: a placed card is wider than its basket');
    if (D.SIZE_CARD.w < PICK_REF || D.SIZE_CARD.h < PICK_REF) fail('size: the cards are smaller than 44px');
    const T = D.SIZE_TRAY;
    for (let i = 0; i < T.length; i++){
      if (T[i].x - D.SIZE_CARD.w / 2 < 0 || T[i].x + D.SIZE_CARD.w / 2 > BOARD_W || T[i].y + D.SIZE_CARD.h / 2 > D.SIZE_H) fail('size: tray card ' + i + ' sticks out of the board');
      if (T[i].y - D.SIZE_CARD.h / 2 < K.y + K.h + K.pad) fail('size: tray card ' + i + ' already sits in a basket\'s snap zone');
      for (let j = i + 1; j < T.length; j++) if (Math.abs(T[i].x - T[j].x) < D.SIZE_CARD.w + 2 && Math.abs(T[i].y - T[j].y) < D.SIZE_CARD.h + 2) fail('size: tray cards ' + i + ' and ' + j + ' touch');
    }
    D.GAME_SIZE.forEach(set => {
      const tag = 'size base ' + set.base;
      if (set.cards.length !== T.length) fail(tag + ': ' + set.cards.length + ' cards for ' + T.length + ' tray places');
      const cnt = { small:0, same:0, big:0 }, seen = {};
      set.cards.forEach(c => {
        const top = c[0] * c[2] + c[1], kind = top < c[2] ? 'small' : top === c[2] ? 'same' : 'big';
        if (D.sizeKind(c) !== kind) fail(tag + ': ' + c.join() + ' is ' + D.sizeKind(c) + ', independently ' + kind);
        cnt[kind]++;
        const v = simpRef(top, c[2]), key = v.n + '/' + v.d;
        if (seen[key]) fail(tag + ': two cards multiply by the same value ' + key);
        seen[key] = 1;
        if (!(c[1] >= 1 && c[2] >= 2 && c[2] <= 10 && c[1] <= c[2] * 2 && (c[0] === 0 || c[1] < c[2]))) fail(tag + ': card ' + c.join() + ' is not a fraction this lesson writes');
        const prod = set.base * top / c[2];
        if (!Number.isInteger(prod) || D.sizeProduct(set.base, c) !== prod) fail(tag + ': ' + set.base + ' × ' + c.join() + ' = ' + D.sizeProduct(set.base, c) + ', independently ' + prod);
        LANGS.forEach(L => {
          const d = I18N[L], f = d.fr(c), fd = nums(f);
          if (f !== (c[0] > 0 ? c[0] + (L === 'zh' ? ' 又 ' : ' ') + c[1] + '/' + c[2] : c[1] + '/' + c[2])) fail(tag + ' ' + L + ': the card fraction prints as "' + f + '"');
          sayCheck(fail, tag + ' card ' + L, d.gSizeCard(set.base, c), [set.base].concat(fd));
          if (kind === 'small') sayCheck(fail, tag + ' gSizeSmall ' + L, d.gSizeSmall(set.base, f, prod), fd.concat([1, set.base]).concat(fd).concat([prod, set.base]), 1);
          else if (kind === 'big') sayCheck(fail, tag + ' gSizeBig ' + L, d.gSizeBig(set.base, f, prod), fd.concat([1, set.base]).concat(fd).concat([prod, set.base]), 1);
          else sayCheck(fail, tag + ' gSizeSame ' + L, d.gSizeSame(set.base, f), fd.concat([1, 1, set.base]).concat(fd).concat([set.base]), 1);
          if ((kind === 'small') !== (prod < set.base) || (kind === 'big') !== (prod > set.base)) fail(tag + ': the reason "' + kind + '" does not hold for the product ' + prod);
        });
      });
      ORDER.forEach(k => { if (cnt[k] < 1 || cnt[k] > D.SIZE_CAP) fail(tag + ': ' + cnt[k] + ' cards go in the ' + k + ' basket (1..' + D.SIZE_CAP + ')'); });
      /* 托盤：每一次都是一個排列，而且從來不照籃子的順序 */
      const rank = { small:0, same:1, big:2 };
      let sorted = 0;
      for (let t = 0; t < 2000; t++){
        const tr = D.sizeTray(set);
        if (tr.slice().sort((p, q) => p - q).join() !== set.cards.map((c, i) => i).join()){ fail(tag + ': sizeTray() is not a permutation: ' + tr.join()); break; }
        if (tr.every((ci, i) => i === 0 || rank[D.sizeKind(set.cards[tr[i - 1]])] <= rank[D.sizeKind(set.cards[ci])])) sorted++;
      }
      if (sorted) fail(tag + ': the tray started in basket order ' + sorted + ' times in 2000');
    });
    LANGS.forEach(L => {
      const b = I18N[L].gSizeBin;
      if (!b || !/⬇/.test(b.small) || !/[=＝]/.test(b.same) || !/⬆/.test(b.big)) fail('gSizeBin ' + L + ' should be ⬇ / = / ⬆');
    });
  }

  /* ---------- 7. 第 4 關：帶分數先變身 ---------- */
  {
    const M = D.MIX_BAR, KN = D.MIX_KNIFE;
    if (M.x + M.w > BOARD_W || M.lblX < 0 || M.lblX + M.lblW > M.x) fail('mix: the bars or their labels do not fit');
    for (let i = 1; i < M.ys.length; i++) if (M.ys[i] - M.ys[i - 1] < M.h + 2 * M.pad + 1) fail('mix: neighbouring bars\' snap zones overlap');
    if (KN.w < PICK_REF || KN.h < PICK_REF) fail('mix: knife cards smaller than 44px');
    for (let i = 1; i < KN.xs.length; i++) if (KN.xs[i] - KN.xs[i - 1] < KN.w + 2) fail('mix: knife cards touch');
    if (KN.xs[0] - KN.w / 2 < 0 || KN.xs[KN.xs.length - 1] + KN.w / 2 > BOARD_W || KN.y + KN.h / 2 > D.MIX_H) fail('mix: a knife card sticks out of the board');
    D.GAME_MIX.forEach(e => {
      const tag = 'mix ' + e.w + ' ' + e.n + '/' + e.d + ' × ' + e.c + '/' + e.e;
      if (!(e.w >= 1 && e.w + 1 <= M.ys.length && e.n >= 1 && e.n < e.d && e.d >= 2 && e.d <= 6 && e.c >= 1 && e.c < e.e)) fail(tag + ': outside the lesson range or too many bars');
      if (KN.y - KN.h / 2 < M.ys[e.w] + M.h + M.pad) fail(tag + ': the knives sit in the last bar\'s snap zone');
      if (D.mixAnswer(e) !== e.w * e.d + e.n) fail(tag + ': mixAnswer ' + D.mixAnswer(e));
      if (e.n === e.w * e.d) fail(tag + ': "only the fraction part" and "only the whole bars" are the same count');
      for (let t = 0; t < 1500; t++){
        const ks = D.mixKnives(e);
        if (ks.length !== 4 || new Set(ks).size !== 4 || ks.indexOf(e.d) < 0 || ks.some(k => !(k >= 2 && k <= 6))){ fail(tag + ': mixKnives() gave ' + ks.join()); break; }
      }
      const t = e.w * e.d + e.n;
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gMixDone ' + L, d.gMixDone(e.w, e.n, e.d, t, e.c, e.e), [e.w, e.n, e.d, t, e.d, e.w, e.n, e.d, e.c, e.e, t, e.d, e.c, e.e].concat(valNums(t * e.c, e.d * e.e)), 3);
        sayCheck(fail, tag + ' gMixLine ' + L, d.gMixLine(e.w, e.n, e.d, t), [e.w, e.n, e.d, t, e.d], 1);
        sayCheck(fail, tag + ' gMixForgot ' + L, d.gMixForgot(e.w, e.d, e.n), [e.n, e.w, e.w, e.d, e.w * e.d], 1);
        sayCheck(fail, tag + ' gMixWhole ' + L, d.gMixWhole(e.w * e.d, e.n, e.d), [e.w * e.d, e.n]);
        sayCheck(fail, tag + ' gMixWrong ' + L, d.gMixWrong(e.d), [e.d]);
        [2, 3, 4, 5, 6].filter(k => k !== e.d).forEach(k => sayCheck(fail, tag + ' gMixKnife(' + k + ') ' + L, d.gMixKnife(k, e.n, e.d), [e.n, e.d, 1, e.d, e.d, k]));
        for (let cut = 0; cut <= e.w; cut++) sayCheck(fail, tag + ' gMixNow ' + L, d.gMixNow(e.w, e.n, e.d, e.c, e.e, cut, cut === e.w), cut === e.w ? [e.w, e.n, e.d, e.c, e.e, 1, e.d] : [e.w, e.n, e.d, e.c, e.e, cut, e.w]);
        sayCheck(fail, tag + ' gMix2a ' + L, d.gMix2a(e.d, e.w), [e.d, e.w]);
        sayCheck(fail, tag + ' gMix2b ' + L, d.gMix2b(e.w, e.d, e.n), [e.w, e.d, e.n]);
        sayCheck(fail, tag + ' gMixReady ' + L, d.gMixReady(e.d), [1, e.d]);
      });
    });
  }

  /* ---------- 8. 第 5 關：先約分再乘 —— 每一種配對順序都要走得完、而且停在同一個最簡分數 ---------- */
  {
    const P = D.CAN_POS, T = D.CAN_TILE;
    if (T.w < PICK_REF || T.h < PICK_REF) fail('can: tiles smaller than 44px');
    P.forEach((p, i) => { if (p.x - T.w / 2 < 0 || p.x + T.w / 2 > BOARD_W || p.y - T.h / 2 < 0 || p.y + T.h / 2 > D.CAN_H) fail('can: tile ' + i + ' sticks out of the board'); });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (Math.abs(P[i].x - P[j].x) < T.w + 2 * T.pad && Math.abs(P[i].y - P[j].y) < T.h + 2 * T.pad) fail('can: tiles ' + i + ' and ' + j + ' snap zones overlap');
    if (!(P[0].y < P[1].y && P[2].y < P[3].y && P[0].x < P[2].x)) fail('can: tiles 0 and 2 must be the numerators (top), 1 and 3 the denominators');
    [0, 1, 2, 3].forEach(i => { if (D.canTop(i) !== (i === 0 || i === 2)) fail('can: canTop(' + i + ') is wrong'); });
    /* canLeft／canPair 也用池子以外的四組數驗一次：每一對（分子, 分母）單獨可約的情況都要找得到 */
    [[[2, 4, 1, 1], [0, 1]], [[2, 1, 1, 4], [0, 3]], [[1, 4, 2, 1], [2, 1]], [[1, 1, 2, 4], [2, 3]], [[3, 5, 7, 11], null]].forEach(([v, want]) => {
      const got = D.canLeft(v);
      if (want === null ? got !== null : !(got && got.i === want[0] && got.j === want[1] && got.g === gcdRef(v[want[0]], v[want[1]])))
        fail('can: canLeft(' + v.join() + ') = ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want));
    });
    D.GAME_CAN.forEach(e => {
      const tag = 'can ' + e.a + '/' + e.b + ' × ' + e.c + '/' + e.e, v0 = [e.a, e.b, e.c, e.e];
      if (!(e.a < e.b && e.c < e.e && e.b <= 15 && e.e <= 15)) fail(tag + ': not two proper fractions in range');
      const fin = simpRef(e.a * e.c, e.b * e.e), finals = {};
      let states = 0;
      (function dfs(v, depth){
        states++;
        if (depth > 8 || states > 5000){ fail(tag + ': the pairing never ends'); return; }
        const pairs = [];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j){
          const r = D.canPair(v, i, j), sameRow = (i % 2) === (j % 2), g = gcdRef(v[i], v[j]);
          const want = sameRow ? 'same' : (g > 1 ? g : 'coprime');
          if (r !== want) fail(tag + ': canPair(' + v.join() + ', ' + i + ', ' + j + ') = ' + r + ', independently ' + want);
          if (!sameRow && g > 1 && i < j) pairs.push([i, j, g]);
        }
        const left = D.canLeft(v), any = pairs.length > 0;
        if (!!left !== any) fail(tag + ': canLeft(' + v.join() + ') says ' + JSON.stringify(left) + ' but ' + pairs.length + ' pairs simplify');
        if (left && gcdRef(v[left.i], v[left.j]) !== left.g) fail(tag + ': canLeft() names the wrong factor');
        if (!any){ finals[v.join()] = 1; return; }
        pairs.forEach(([i, j, g]) => { const w = v.slice(); w[i] /= g; w[j] /= g; dfs(w, depth + 1); });
      })(v0, 0);
      if (!D.canLeft(v0)) fail(tag + ': nothing to simplify at the start');
      Object.keys(finals).forEach(k => {
        const v = k.split(',').map(Number), p = simpRef(v[0] * v[2], v[1] * v[3]);
        if (p.n !== fin.n || p.d !== fin.d || v[0] * v[2] !== fin.n || v[1] * v[3] !== fin.d) fail(tag + ': the pairing order ' + k + ' ends at ' + (v[0] * v[2]) + '/' + (v[1] * v[3]) + ', not the simplest ' + fin.n + '/' + fin.d);
        LANGS.forEach(L => sayCheck(fail, tag + ' gCanDone(' + k + ') ' + L, I18N[L].gCanDone(v0, v), v0.concat(v).concat(simpNums(v[0] * v[2], v[1] * v[3])), 2));
      });
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gCanNow ' + L, d.gCanNow(v0), v0);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j){
          const g = gcdRef(v0[i], v0[j]), same = (i % 2) === (j % 2);
          if (same) sayCheck(fail, tag + ' gCanSame ' + L, d.gCanSame(v0[i], v0[j], D.canTop(i)), [v0[i], v0[j]]);
          else if (g === 1) sayCheck(fail, tag + ' gCanCoprime ' + L, d.gCanCoprime(v0[i], v0[j]), [v0[i], v0[j], 1]);
          else {
            sayCheck(fail, tag + ' gCanDid ' + L, d.gCanDid(v0[i], v0[j], g, v0[i] / g, v0[j] / g), [v0[i], v0[j], g, v0[i], v0[i] / g, v0[j], v0[j] / g]);
            sayCheck(fail, tag + ' gCanMore ' + L, d.gCanMore(v0[i], v0[j], g), [v0[i], v0[j], g]);
            sayCheck(fail, tag + ' gCan2 ' + L, d.gCan2(v0[i], v0[j], g), [v0[i], v0[j], g]);
          }
        }
      });
    });
  }

  /* ---------- 9. 每一句固定的字串 ---------- */
  LANGS.forEach(L => {
    const d = I18N[L];
    ['gAddUndo', 'gAddBtn', 'gAddFull', 'gCutV', 'gCutH', 'gCutBtn', 'gSizeDone', 'gMixBtn', 'gMixEmpty', 'gCanBtn', 'gCan2done', 'gClear'].forEach(k => {
      if (typeof d[k] !== 'string' || !d[k]) fail(k + ' missing in ' + L);
      else sayCheck(fail, k + ' ' + L, d[k], null);
    });
    if (nums(d.gSizeDone).join() !== '1,1,1') fail('gSizeDone ' + L + ' should compare with 1 three times: ' + d.gSizeDone);
    sayCheck(fail, 'gKnife ' + L, d.gKnife(4), [4]);
    sayCheck(fail, 'gSizeNow ' + L, d.gSizeNow(12, 2, 6), [12, 2, 6]);
    sayCheck(fail, 'gSize2 ' + L, d.gSize2(d.fr([1, 1, 2]), d.gSizeBin.big), [1, 1, 2]);
    sayCheck(fail, 'gMixAria ' + L, d.gMixAria(5), [1, 5]);
    sayCheck(fail, 'gAddStamp ' + L, d.gAddStamp(2, 5), [2, 5]);
    Object.keys(d.gHints).forEach(k => sayCheck(fail, 'gHints.' + k + ' ' + L, d.gHints[k], null));
    Object.keys(d.gAsks).forEach(k => sayCheck(fail, 'gAsks.' + k + ' ' + L, d.gAsks[k], null));
    if (!/1/.test(d.gHints.size)) fail('gHints.size ' + L + ' does not compare the fraction with 1');
  });
}

/* ===================== 範例 1、2：旁白是算出來的，代進每一個選項驗一次 ===================== */
function checkExamples(I18N, fail, src){
  const fns = ['gcdFn', 'fracLabel', 'simplifyFrac', 'resultDisplay'].map(n => extractFunction(src, n));
  if (fns.some(f => !f)) return fail('cannot cut the example helpers (gcdFn, fracLabel, simplifyFrac, resultDisplay) out of index.html');
  let H;
  try { H = new Function(fns.join('\n') + '\nreturn { resultDisplay:resultDisplay, simplifyFrac:simplifyFrac };')(); }
  catch (e){ return fail('example helpers could not run: ' + e.message); }
  const den = +((src.match(/var BAR_DEN = (\d+);/) || [])[1]);
  const chips = ((src.match(/\[([\d,\s]+)\]\.forEach\(function\(n\)\{\s*var b = makeChip\(L\(\)\.barChipLabel/) || [])[1] || '').split(',').map(Number).filter(Boolean);
  if (den !== 4 || !sameList(chips, [2, 3, 4])) fail('example 1: expected n × 1/4 for n = 2, 3, 4 (got den ' + den + ', chips ' + chips.join() + ')');
  chips.forEach(n => {
    const res = H.resultDisplay(n, den), want = valTextRef(n, den, 'zh');   /* 範例 1 最多 4/4，沒有帶分數 */
    if (res !== want) fail('example 1: resultDisplay(' + n + ', ' + den + ') = "' + res + '", independently "' + want + '"');
    const add = Array(n).fill('1/' + den).join(' + ');
    ['zh', 'en'].forEach(L => sayCheck(fail, 'example 1 barLine(' + n + ') ' + L, I18N[L].barLine(n, add, res), null, 1));
  });
  const combosSrc = (src.match(/var AREA_COMBOS = (\[[\s\S]*?\]);/) || [])[1];
  let combos = null;
  try { combos = new Function('return ' + combosSrc + ';')(); } catch (e){ return fail('example 2: cannot read AREA_COMBOS'); }
  if (!Array.isArray(combos) || combos.length !== 3) return fail('example 2: expected three combos');
  combos.forEach(c => {
    const pn = c.a * c.c, pd = c.b * c.d, s = simpRef(pn, pd), hs = H.simplifyFrac(pn, pd);
    if (hs.n !== s.n || hs.d !== s.d) fail('example 2: simplifyFrac(' + pn + ', ' + pd + ') = ' + hs.n + '/' + hs.d);
    if (!(c.a < c.b && c.c < c.d)) fail('example 2: ' + JSON.stringify(c) + ' is not two proper fractions');
    ['zh', 'en'].forEach(L => sayCheck(fail, 'example 2 areaExprLine ' + L, I18N[L].areaExprLine(c.a, c.b, c.c, c.d, pn, pd, s.n, s.d), null, 2));
  });
}

/* ===================== 四頁的每一句算式（markup ＋ 字典） ===================== */
function checkClaims(I18N, fail, src){
  CLAIM_PROBES.forEach(p => {
    const r = fracArith(p.text), caught = r.problems.length > 0;
    if (caught !== p.bad) fail('fracArith probe ' + (p.bad ? 'missed a wrong claim' : 'raised a false alarm') + ': "' + p.text + '"' + (r.problems[0] ? ' — ' + r.problems[0] : ''));
  });
  const dir = path.dirname(CURRENT.file || '');
  const pages = { index:src };
  ['review', 'reference', 'parents'].forEach(p => { try { pages[p] = fs.readFileSync(path.join(dir, p + '.html'), 'utf8'); } catch (e){ fail('cannot read ' + p + '.html'); } });
  Object.keys(pages).forEach(page => {
    const html = pages[page];
    if (!html) return;
    const texts = [{ where:page + ' markup', text:stripScripts(html) }];
    if (page === 'index'){ walkStrings(I18N, texts, 'index I18N'); }
    else {
      ['var I18N = ', 'var TXT = '].forEach(head => {
        const lit = literalAfter(html, head);
        if (!lit) return;
        try { walkStrings(new Function('return ' + lit + ';')(), texts, page + ' ' + head.trim()); }
        catch (e){ fail(page + ': cannot evaluate ' + head + e.message); }
      });
    }
    let verified = 0;
    texts.forEach(t => {
      const r = fracArith(t.text);
      verified += r.verified;
      r.problems.forEach(p => fail(t.where + ': ' + p));
      if (/[一-鿿]/.test(t.text)){ const g = t.text.replace(/<[^>]+>/g, '').match(/\d又|又\d/); if (g) fail(t.where + ': "' + g[0] + '" — write mixed numbers as 1 又 1/2'); }
    });
    if (verified !== CLAIM_COUNTS[page]) fail(page + ': ' + verified + ' equations verified, pinned ' + CLAIM_COUNTS[page] + ' — a sentence was added or removed; re-read it and update CLAIM_COUNTS');
  });
}

const CURRENT = { file:null };
const CONFIG = {
  breaks: [
    {"file": "index", "expect": "wholes, independently", "find": "function addWholes(e){ return Math.ceil((e.n + 1) * e.a / e.b); }", "replace": "function addWholes(e){ return Math.ceil(e.n * e.a / e.b); }"},
    {"file": "index", "expect": "strips, independently", "find": "function addCap(e){ return Math.floor(addWholes(e) * e.b / e.a); }", "replace": "function addCap(e){ return Math.ceil(addWholes(e) * e.b / e.a); }"},
    {"file": "index", "expect": "Done with", "find": "function addJudge(e, k){ return k === e.n ? 'ok'", "replace": "function addJudge(e, k){ return k >= e.n ? 'ok'"},
    {"file": "index", "expect": "cutSnap() puts", "find": "function cutSnap(pos, s, parts){ var k = Math.round(pos / (s / parts));", "replace": "function cutSnap(pos, s, parts){ var k = Math.floor(pos / (s / parts));"},
    {"file": "index", "expect": "cutSnap() puts", "find": "return k < 0 ? 0 : (k > parts ? parts : k); }", "replace": "return k < 0 ? 0 : k; }"},
    {"file": "index", "expect": "judged", "find": "function cutJudge(e, i, j){ return i !== e.a ? 'col' : (j !== e.c ? 'row' : null); }", "replace": "function cutJudge(e, i, j){ return i !== e.a ? 'col' : (j < e.c ? 'row' : null); }"},
    {"file": "index", "expect": "independently", "find": "return top < c[2] ? 'small' : (top === c[2] ? 'same' : 'big'); }", "replace": "return top <= c[2] ? 'small' : 'big'; }"},
    {"file": "index", "expect": "independently", "find": "function sizeProduct(base, c){ return base * (c[0] * c[2] + c[1]) / c[2]; }", "replace": "function sizeProduct(base, c){ return base * c[1] / c[2]; }"},
    {"file": "index", "expect": "basket order", "find": "    if (up) for (var j = 1; j < t.length; j++)", "replace": "    if (false) for (var j = 1; j < t.length; j++)"},
    {"file": "index", "expect": "basket order", "find": "    if (up) for (var j = 1; j < t.length; j++) if (sizeKind(set.cards[t[j]]) !== sizeKind(set.cards[t[0]])){ var x = t[0]; t[0] = t[j]; t[j] = x; break; }", "replace": "    if (up){ var x = t[0]; t[0] = t[1]; t[1] = x; }"},
    {"file": "index", "expect": "mixKnives() gave", "find": "    return shuffle(three.concat([e.d]));", "replace": "    return shuffle(others).slice(0, 4);"},
    {"file": "index", "expect": "mixAnswer", "find": "function mixAnswer(e){ return e.w * e.d + e.n; }", "replace": "function mixAnswer(e){ return e.w + e.n; }"},
    {"file": "index", "expect": "canPair(", "find": "function canPair(v, i, j){ if (canTop(i) === canTop(j)) return 'same';", "replace": "function canPair(v, i, j){ if (i === j) return 'same';"},
    {"file": "index", "expect": "canLeft(", "find": "var pairs = [[0, 1], [0, 3], [2, 1], [2, 3]];", "replace": "var pairs = [[0, 1], [0, 3], [2, 1]];"},
    {"file": "index", "expect": "outside the lesson range", "find": "{ n:2, a:5, b:6 }", "replace": "{ n:2, a:5, b:7 }"},
    {"file": "index", "expect": "outside the lesson range", "find": "{ a:1, b:2, c:2, d:3 }, { a:3, b:4, c:1, d:2 }", "replace": "{ a:2, b:2, c:2, d:3 }, { a:3, b:4, c:1, d:2 }"},
    {"file": "index", "expect": "two cards multiply by the same value", "find": "[0, 5, 4], [1, 1, 2], [0, 7, 6]] },", "replace": "[0, 5, 4], [1, 1, 2], [0, 6, 6]] },"},
    {"file": "index", "expect": "cards go in the same basket", "find": "[[0, 1, 2], [0, 2, 3], [0, 3, 3], [0, 7, 6], [1, 1, 3], [0, 5, 6]]", "replace": "[[0, 1, 2], [0, 2, 3], [0, 4, 3], [0, 7, 6], [1, 1, 3], [0, 5, 6]]"},
    {"file": "index", "expect": "too many bars", "find": "{ w:2, n:1, d:3, c:3, e:5 }", "replace": "{ w:3, n:1, d:3, c:3, e:5 }"},
    {"file": "index", "expect": "nothing to simplify", "find": "{ a:3, b:5, c:5, e:9 }", "replace": "{ a:3, b:5, c:2, e:7 }"},
    {"file": "index", "expect": "sticks out of the board", "find": "CUT_SQ = { x:78, y:70, s:198 }", "replace": "CUT_SQ = { x:78, y:70, s:220 }"},
    {"file": "index", "expect": "overlap at the start", "find": "CUT_KNIFE = { vy:28, hx:28, tapPad:12 }", "replace": "CUT_KNIFE = { vy:28, hx:40, tapPad:12 }"},
    {"file": "index", "expect": "covers the basket name", "find": "SIZE_SPOT = [66, 114, 162]", "replace": "SIZE_SPOT = [50, 98, 146]"},
    {"file": "index", "expect": "snap zone", "find": "{ x:52, y:236 }, { x:150, y:236 }, { x:248, y:236 }, { x:52, y:296 }", "replace": "{ x:52, y:214 }, { x:150, y:236 }, { x:248, y:236 }, { x:52, y:296 }"},
    {"file": "index", "expect": "smaller than 44px", "find": "var SIZE_CARD = { w:92, h:50 }", "replace": "var SIZE_CARD = { w:92, h:40 }"},
    {"file": "index", "expect": "knife cards touch", "find": "var MIX_KNIFE = { y:174, w:66, h:58, xs:[42, 114, 186, 258] };", "replace": "var MIX_KNIFE = { y:174, w:66, h:58, xs:[42, 100, 186, 258] };"},
    {"file": "index", "expect": "tiles smaller than 44px", "find": "var CAN_H = 190, CAN_TILE = { w:66, h:58, pad:8 }", "replace": "var CAN_H = 190, CAN_TILE = { w:66, h:40, pad:8 }"},
    {"file": "index", "expect": "already sits in the drop zone", "find": "var ADD_STAMP = { cx:150, cy:156, h:64, minW:72, stripH:24 };", "replace": "var ADD_STAMP = { cx:150, cy:126, h:64, minW:72, stripH:24 };"},
    {"file": "index", "expect": "does not cover the drawn track", "find": "ADD_ZONE = { x:6, y:30, w:288, h:80, pad:10 }", "replace": "ADD_ZONE = { x:6, y:30, w:288, h:52, pad:10 }"},
    {"file": "index", "expect": "snap zones do not overlap", "find": "var SIZE_BIN = { xs:[52, 150, 248], y:4, w:94, h:196, pad:6 }", "replace": "var SIZE_BIN = { xs:[52, 150, 248], y:4, w:94, h:196, pad:1 }"},
    {"file": "index", "expect": "snap zones overlap", "find": "var MIX_H = 214, MIX_BAR = { x:62, w:228, h:34, ys:[8, 52, 96], lblX:4, lblW:54, pad:4 };", "replace": "var MIX_H = 214, MIX_BAR = { x:62, w:228, h:34, ys:[8, 46, 96], lblX:4, lblW:54, pad:4 };"},
    {"file": "index", "expect": "simpStr(", "find": "return w > 0 ? (w + (lang === 'zh' ? ' 又 ' : ' ') + r + '/' + D) : (r + '/' + D);", "replace": "return w > 0 ? (w + (lang === 'zh' ? '又' : ' ') + r + '/' + D) : (r + '/' + D);"},
    {"file": "index", "expect": "gAddDone zh", "find": "return n + ' × ' + a + '/' + b + ' = ' + p.join(' + ') + ' = ' + valStr(n * a, b, 'zh') + '。';", "replace": "return n + ' × ' + a + '/' + b + ' = ' + p.join(' + ') + ' = ' + valStr(n * a + 1, b, 'zh') + '。';"},
    {"file": "index", "expect": "gCutDone en", "find": "return 'Blue: ' + a + ' × ' + c + ' = ' + (a * c) + ' cells; the whole sheet: ' + b + ' × ' + d + ' = ' + (b * d) + ' cells. So ' +", "replace": "return 'Blue: ' + a + ' × ' + c + ' = ' + (a * c) + ' cells; the whole sheet: ' + b + ' × ' + d + ' = ' + (b + d) + ' cells. So ' +"},
    {"file": "index", "expect": "gSizeSmall zh", "find": "gSizeSmall: function(base, f, prod){ return f + ' 比 1 小，所以 ' + base + ' × ' + f + ' = ' + prod + '，比 ' + base + ' 小。'; },", "replace": "gSizeSmall: function(base, f, prod){ return f + ' 比 1 小，所以 ' + base + ' × ' + f + ' = ' + base + '，比 ' + base + ' 小。'; },"},
    {"file": "index", "expect": "gMixDone en", "find": "t + '/' + d + ' × ' + c + '/' + e + ' = ' + valStr(t * c, d * e, 'en') + '.';", "replace": "t + '/' + d + ' × ' + c + '/' + e + ' = ' + valStr(t * c, d, 'en') + '.';"},
    {"file": "index", "expect": "gCanDone", "find": "simpStr(v[0] * v[2], v[1] * v[3], 'zh') + '。先約分", "replace": "simpStr(v[0] * v[2], v[1], 'zh') + '。先約分"},
    {"file": "index", "expect": "gMixForgot zh", "find": "' 條整條切開後有 ' + w + ' × ' + d + ' = ' + (w * d) + ' 格，也要算進去。'", "replace": "' 條整條切開後有 ' + w + ' × ' + d + ' = ' + (w + d) + ' 格，也要算進去。'"},
    {"file": "index", "expect": "gCutCol", "find": "', but the first fraction is ' + a + '/' + b + ': take ' + a + ' of the ' + b + ' parts.'", "replace": "', but the first fraction is ' + a + '/' + b + ': take ' + b + ' of the ' + a + ' parts.'"},
    {"file": "index", "expect": "prints \"1 strips\"", "find": "return 'There ' + (k === 1 ? 'is ' : 'are ') + k + ' strip' + (k === 1 ? '' : 's') + ' of '", "replace": "return 'There ' + (k === 1 ? 'is ' : 'are ') + k + ' strips of '"},
    {"file": "index", "expect": "card fraction prints", "find": "fr: function(c){ return c[0] > 0 ? (c[0] + ' 又 ' + c[1] + '/' + c[2]) : (c[1] + '/' + c[2]); },", "replace": "fr: function(c){ return c[0] > 0 ? (c[0] + '又' + c[1] + '/' + c[2]) : (c[1] + '/' + c[2]); },"},
    {"file": "index", "expect": "gSizeBin en", "find": "gSizeBin: { small: '⬇️ smaller', same: '= same', big: '⬆️ bigger' },", "replace": "gSizeBin: { small: '⬇️ smaller', same: '= same', big: 'bigger' },"},
    {"file": "index", "expect": "gWin zh", "find": "return bonus ? ('五關全破，而且一次都沒放錯，再加 20 分！總分 ' + s + ' 分 🏆')", "replace": "return bonus ? ('五關全破，而且一次都沒放錯！總分 ' + s + ' 分 🏆')"},
    {"file": "index", "expect": "gMinus en", "find": "gMinus: '−5 points',", "replace": "gMinus: '−10 points',"},
    {"file": "index", "expect": "no board-generation guard", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", "replace": ""},
    {"file": "index", "expect": "second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "lost pointer capture", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "no document-level release", "find": "      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });", "replace": "      document.addEventListener('pointercancel', onDocEnd);\n    });"},
    {"file": "index", "expect": "ahead mode", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", "replace": "    if (false){ hintLevel = 1; showHint(); }"},
    {"file": "index", "expect": "shown although nothing was taken", "find": "    var lost = gScore >= 5 ? 5 : 0;", "replace": "    var lost = 5;"},
    {"file": "index", "expect": "does not cost 5", "find": "    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", "replace": "    gScore = Math.max(0, gScore - 10); elScore.textContent = gScore;"},
    {"file": "index", "expect": "gives", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = gMistake ? 15 : 20;"},
    {"file": "index", "expect": "gives", "find": "bonus = last && !gAnyMistake;", "replace": "bonus = last;"},
    {"file": "index", "expect": "leaves the hint showing", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "record the mistake", "find": "    gMistake = true; gAnyMistake = true;", "replace": "    gMistake = true;"},
    {"file": "index", "expect": "nearestOpen()", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (!best){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "nearestOpen()", "find": "      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;", "replace": "      var dd = dx * dx + dy * dy, dc = dd;"},
    {"file": "index", "expect": "skips it", "find": "    return best && !best.done ? best : null;", "replace": "    return best;"},
    {"file": "index", "expect": "ascending order", "find": "    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }", "replace": ""},
    {"file": "index", "expect": "same wrong count", "find": "        if (told[v]){ roundNote(why); return; }", "replace": "        if (false){ roundNote(why); return; }"},
    {"file": "index", "expect": "Done is judged while a strip", "find": "        if (gSolved || stamp.busy()) return;", "replace": "        if (gSolved) return;"},
    {"file": "index", "expect": "onPlace", "find": "            if (isV){ var ni = cutSnap(K.cx - S.x, S.s, e.b); if (ni !== i){ i = ni; draw(); refreshHint(); } }", "replace": "            if (isV){ var ni = cutSnap(K.cx - S.x, S.s, e.b); if (ni !== i){ draw(); refreshHint(); } }"},
    {"file": "index", "expect": "tap zone", "find": "      function inV(pt){ return pt.y <= S.y + S.s + CUT_KNIFE.tapPad && pt.x >= S.x - cv / 2 && pt.x <= S.x + S.s + cv / 2; }", "replace": "      function inV(pt){ return pt.y >= S.y && pt.y <= S.y + S.s + CUT_KNIFE.tapPad && pt.x >= S.x - cv / 2 && pt.x <= S.x + S.s + cv / 2; }"},
    {"file": "index", "expect": "tiles at 1", "find": "          if (v[i] === 1 && !P.locked){ P.lock(P.homeX, P.homeY); slots[i].done = true; }", "replace": "          if (false){ P.lock(P.homeX, P.homeY); slots[i].done = true; }"},
    {"file": "review", "expect": "(order and duplicates count)", "find": "          { a:5, b:9, c:3, d:4, w:[rVal(15,36), rVal(8,13), rVal(5,9)] },\n", "replace": "", "via": "index"},
    {"file": "review", "expect": "no named misconception", "find": "{ n:27, a:2, b:3, w:[iVal(9), iVal(11), iVal(54)] }", "replace": "{ n:27, a:2, b:3, w:[iVal(9), iVal(13), iVal(54)] }", "via": "index"},
    {"file": "index", "expect": "side knife to the nearest line", "find": "        P.rehome(CUT_KNIFE.hx, S.y + cutSnap(pt.y - S.y, S.s, e.d) * chh);", "replace": "        P.rehome(CUT_KNIFE.hx, S.y + cutSnap(pt.x - S.x, S.s, e.d) * chh);"},
    {"file": "review", "expect": "(order and duplicates count)", "find": "          { n:27, a:2, b:3, w:[iVal(9), iVal(11), iVal(54)] }\n", "replace": "          { n:27, a:2, b:3, w:[iVal(9), iVal(11), iVal(54)] },\n          { n:27, a:2, b:3, w:[iVal(9), iVal(11), iVal(54)] }\n", "via": "index"},
    {"file": "review", "expect": "review.html generators are", "find": "{ id:'areaModel', cat:'fracmul',", "replace": "{ id:'areaModel2', cat:'fracmul',", "via": "index"},
    {"file": "review", "expect": "no named misconception", "find": "{ a:5, b:6, c:1, d:4, w:[rVal(6,10), rVal(6,24), rVal(11,12)] }", "replace": "{ a:5, b:6, c:1, d:4, w:[rVal(6,10), rVal(6,24), rVal(13,17)] }"},
    {"file": "index", "expect": "while a knife", "find": "        if (vk.busy() || hk.busy()) return;", "replace": "        if (false) return;"},
    {"file": "index", "expect": "plain whole numbers", "find": "  function canon(s){ s = String(s).trim(); return /^(0|[1-9]\\d*)$/.test(s) ? +s : null; }", "replace": "  function canon(s){ s = String(s).replace(/\\s/g, ''); return /^\\d+$/.test(s) ? +s : null; }"},
    {"file": "index", "expect": "quiet note", "find": "        if (k >= cap){ roundNote(d.gAddFull);", "replace": "        if (k >= cap){ roundMiss(d.gAddFull);"},
    {"file": "index", "expect": "do not snap", "find": "          snap:isV ? function(x){ return S.x + cutSnap(x - S.x, S.s, e.b) * cv; } : function(y){ return S.y + cutSnap(y - S.y, S.s, e.d) * chh; },", "replace": "          snap:function(p){ return p; },"},
    {"file": "index", "expect": "wrong knife is not refused", "find": "        if (k !== e.d){ roundMiss(d.gMixKnife(k, e.n, e.d));", "replace": "        if (false){ roundMiss(d.gMixKnife(k, e.n, e.d));"},
    {"file": "index", "expect": "not refused by the wrong basket", "find": "        if (b.kind !== k){", "replace": "        if (false){"},
    {"file": "index", "expect": "touch-action", "find": "    touch-action:none;cursor:grab;", "replace": "    cursor:grab;"},
    {"file": "index", "expect": "placed pieces", "find": "  .gpiece.locked{cursor:default;pointer-events:none}", "replace": "  .gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "is not refused while something still simplifies", "find": "        var left = canLeft(v);\n        if (left){ roundMiss", "replace": "        var left = null;\n        if (left){ roundMiss"},
    {"file": "index", "expect": "sizeTray()", "find": "      sizeTray(set).forEach(function(ci, slot){", "replace": "      set.cards.map(function(c, i){ return i; }).forEach(function(ci, slot){"},
    {"file": "index", "expect": "this claim is wrong", "find": "      f2p: '1 又 1/2 = 3/2，先變成這樣才能乘：3/2 × 2/3 = 1。',", "replace": "      f2p: '1 又 1/2 = 3/2，先變成這樣才能乘：3/2 × 2/3 = 2。',"},
    {"file": "index", "expect": "resultDisplay(", "find": "    return raw + ' = ' + fracLabel(s.n, s.d);", "replace": "    return raw + ' = ' + fracLabel(s.d, s.n);"},
    {"file": "index", "expect": "not two proper fractions", "find": "    { a:3, b:4, c:2, d:5 }\n  ];", "replace": "    { a:5, b:4, c:2, d:5 }\n  ];"},
    {"file": "index", "expect": "pinned", "find": "      f1p: '×1/2 就是找一半：6 × 1/2 = 3，比 6 小。',", "replace": "      f1p: '×1/2 就是找一半：6 × 1/2 = 3 = 6/2，比 6 小。',"},
    {"file": "reference", "expect": "this claim is wrong", "find": "cancelEx:'例：2/9 × 3/4 —— 2 和 4 可以先約成 1 和 2，3 和 9 可以先約成 1 和 3，變成 1/3 × 1/2 = 1/6（跟直接乘完再約分 6/36=1/6 答案一樣，但數字小很多）。',", "replace": "cancelEx:'例：2/9 × 3/4 —— 2 和 4 可以先約成 1 和 2，3 和 9 可以先約成 1 和 3，變成 1/3 × 1/2 = 1/6（跟直接乘完再約分 6/36=1/5 答案一樣，但數字小很多）。',"},
    {"file": "reference", "expect": "write mixed numbers", "find": "<td data-i18n=\"r3c\">1 又 1/2 × 4 = 3/2 × 4 = 12/2 = 6</td>", "replace": "<td data-i18n=\"r3c\">1又1/2 × 4 = 3/2 × 4 = 12/2 = 6</td>"},
    {"file": "parents", "expect": "this claim is wrong", "find": "\"h1p\": \"With a chocolate bar: “What is half of a half?” (1/2 × 1/2 = 1/4)", "replace": "\"h1p\": \"With a chocolate bar: “What is half of a half?” (1/2 × 1/2 = 1/2)"},
    {"file": "review", "expect": "product kept as", "find": "return { k:p.k, a:p.a, b:p.b, w:p.w, pn:p.k*p.a, pd:p.b };", "replace": "return { k:p.k, a:p.a, b:p.b, w:p.w, pn:p.k*p.a+1, pd:p.b };"},
    {"file": "review", "expect": "product kept as", "find": "var improperN = p.whole * p.b + p.a;", "replace": "var improperN = p.whole + p.a;"},
    {"file": "review", "expect": "copied straight out of the stem", "find": "w:[iVal(8), iVal(11), iVal(96)]", "replace": "w:[iVal(8), iVal(11), iVal(32)]"},
    {"file": "review", "expect": "same value", "find": "decW:['1.5','0.5','0.15']", "replace": "decW:['1.5','0.2','0.15']"},
    {"file": "review", "expect": "class", "find": "var cls = p.a < p.b ? 0 : (p.a > p.b ? 1 : 2);", "replace": "var cls = p.a <= p.b ? 0 : (p.a > p.b ? 1 : 2);"},
    {"file": "review", "expect": "common denominator", "find": "var L = lcm(p.b, p.d);", "replace": "var L = p.b * p.d;"},
    {"file": "review", "expect": "glues 又", "find": "return lang === 'zh' ? (whole + ' 又 ' + fracLabel(rem, s.d))", "replace": "return lang === 'zh' ? (whole + '又' + fracLabel(rem, s.d))"},
    {"file": "review", "expect": "this claim is wrong", "find": "' 剛好等於 1，乘 1 不會改變大小：'+x.base+' × '+x.a+'/'+x.b+' = '+x.base+'。'", "replace": "' 剛好等於 1，乘 1 不會改變大小：'+x.base+' × '+x.a+'/'+x.b+' = '+(x.base+1)+'。'"},
    {"file": "review", "expect": "this claim is wrong", "find": "+x.pn+'/'+x.pd+'，約分後是 '+fmtVal(correct,'zh')+'。'", "replace": "+x.pn+'/'+(x.pd+1)+'，約分後是 '+fmtVal(correct,'zh')+'。'"},
    {"file": "review", "expect": "have the same value", "find": "(lang==='zh' ? '＝？（記得約分）' : ' = ? (remember to simplify)'),\n          opts: m.opts.map(function(o){ return fmtVal(o, lang); }),\n          ans: m.ans,\n          why: lang==='zh'\n            ? x.a+'/'+x.b+' × '", "replace": "(lang==='zh' ? '＝？' : ' = ?'),\n          opts: m.opts.map(function(o){ return fmtVal(o, lang); }),\n          ans: m.ans,\n          why: lang==='zh'\n            ? x.a+'/'+x.b+' × '"},
    {"file": "review", "expect": "not in the pinned pool", "find": "{ a:1, b:2, c:1, d:3, w:[rVal(5,6), rVal(1,2), rVal(1,5)] }", "replace": "{ a:1, b:2, c:2, d:3, w:[rVal(5,6), rVal(1,2), rVal(1,5)] }"},
    {"file": "review", "expect": "same value", "find": "{ k:6, a:5, b:9, w:[mVal(59,9), rVal(30,9), rVal(5,54)] }", "replace": "{ k:6, a:5, b:9, w:[mVal(59,9), mVal(30,9), rVal(5,54)] }"},
    {"file": "review", "expect": "this claim is wrong", "find": "x.k+' × '+x.a+'/'+x.b+' = ('+x.k+'×'+x.a+')/'+x.b+' = '+x.pn+'/'+x.pd+'，也就是 '", "replace": "x.k+' × '+x.a+'/'+x.b+' = ('+x.k+'×'+x.a+')/'+x.b+' = '+x.pn+'/'+(x.pd*2)+'，也就是 '"}
  ],

  sim: {
    INVARIANTS: INVARIANTS,
    expectedCorrect: function(d, id, lang){ return expectedCorrectRef(d, id, lang); },
    optionOk: optionOk,
    renderCheck: renderCheck,
    stemEchoOk: {
      /* 「只乘分數部分」的迷思（2 又 1/3 × 3 → 2 又 3/3 → 3）剛好等於乘數 3：刻意的誘答，只放行那一個值 */
      mixedXint: function(d, opt, lang){ return String(opt) === fracOnlyRef(d, lang) && String(opt) === String(d.k); }
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「分數切切樂」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, GAME_ORDER, shuffle, pick, gcd, simpStr, valStr, ' +
                'ADD_H, ADD_TRACK, ADD_ZONE, ADD_STAMP, GAME_ADD, addWholes, addCap, addJudge, ' +
                'CUT_H, CUT_SQ, CUT_KNIFE, GAME_CUT, cutSnap, cutJudge, ' +
                'SIZE_H, SIZE_BINS, SIZE_BIN, SIZE_LBL, SIZE_CAP, SIZE_CARD, SIZE_PLACED, SIZE_SPOT, SIZE_TRAY, GAME_SIZE, sizeKind, sizeProduct, sizeTray, ' +
                'MIX_H, MIX_BAR, MIX_KNIFE, GAME_MIX, mixKnives, mixAnswer, ' +
                'CAN_H, CAN_TILE, CAN_POS, GAME_CAN, canTop, canPair, canLeft}',
    check: function(data, I18N, fail, src){
      CURRENT.file = process.argv[2] ? path.resolve(process.argv[2]) : null;
      /* simpStr／valStr：資料區的兩個小工具和第二套實作逐一比對 */
      for (let d = 1; d <= 60; d++) for (let n = 1; n <= 150; n++) ['zh', 'en'].forEach(L => {
        if (data.simpStr(n, d, L) !== simpTextRef(n, d, L)) fail('simpStr(' + n + ', ' + d + ', ' + L + ') = "' + data.simpStr(n, d, L) + '", independently "' + simpTextRef(n, d, L) + '"');
        if (data.valStr(n, d, L) !== valTextRef(n, d, L)) fail('valStr(' + n + ', ' + d + ', ' + L + ') = "' + data.valStr(n, d, L) + '"');
      });
      for (let a = 1; a <= 60; a++) for (let b = 1; b <= 60; b++) if (data.gcd(a, b) !== gcdRef(a, b)) { fail('gcd(' + a + ', ' + b + ') = ' + data.gcd(a, b)); return; }
      checkGame(data, I18N, fail, src);
      checkExamples(I18N, fail, src);
      checkClaims(I18N, fail, src);
      try { checkReviewPools(fail, fs.readFileSync(path.join(path.dirname(CURRENT.file), 'review.html'), 'utf8')); }
      catch (e){ fail('cannot read review.html next to index.html: ' + e.message); }
    }
  }
};

module.exports = CONFIG;
