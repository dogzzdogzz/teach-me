/* grade-5/math/fraction-divide（分數大平分：整數相除的答案是分數、分數除以整數 —— 切細再分、分子整除的捷徑、乘以倒數）的檢查設定。

   這一課在 2026-10-10 小遊戲照 §六之五 改版之前**沒有設定檔**（simgen／verify_lesson_data 一跑就是「no check config」），
   所以這一份同時補上三塊：課程頁的旁白與範例、小遊戲「巧克力大平分」、review.html 的九個產生器。

   守門重點：

   ① **每一句寫出來的算式都要重算一次** —— 四頁的 markup、每一頁的字典（含字典裡的函式代入真的題目），
      用精確有理數的 fracArith（grade-5-fraction-multiply 那一份：帶分數、小數、`(3×2)/5` 的 `/`）。
      驗算器自己的 CLAIM_PROBES 每一次都重跑；每一頁驗過幾條要釘住。

   ② **小遊戲照遊戲的規則把每一題玩一遍**：輪流發的每一種計數狀態、✂️ 的每一個停點（1 ~ max，哪幾個分得開）、
      隔板的每一條線（哪幾條收、收齊了剛好 k − 1 片）、五張數字卡放進兩格的每一種組合、八張卡的值（自己重算）。
      `nearestOpen`、`roundMiss`、`roundSolved`、`shuffle` 從原始碼切出來真的跑；版面與觸控 ≥ 44px 從資料區的版面函式量。

   ③ **畫面要決定得了答案**：發完每人 n 小塊、✂️ 停在 s 就畫 b × s 格、塗色的 a 格是隔板分得開的範圍；
      每一句「為什麼」只在它說的那件事真的成立時才出現（例：「a 格不能整格分成 k 組」只用在 a 不能被 k 整除的題目）。

   ④ **review.html 的九個產生器**：make() 的**每一條路**都確定地走一遍（換掉 rand，把每一種選擇走完，不靠抽樣）；
      正解的第二套實作、選項的值兩兩不同、**每一個誘答都對上一條說得出名字的迷思**（MISCON）、
      誘答不抄題幹（唯一放行：除法題的「沒有分」＝題幹那個分數本身，§六之三第 4 點的刻意誘答）、解釋逐條驗算。

   已知極限：fracArith 把「左邊不是數字的等號」當散文放行；畫面的檢查在 e2e（teaching-workspace/game-harness/g5-fraction-divide），
   這裡只驗資料與原始碼。fracArith 和 grade-5-fraction-multiply 是同一份的複本（還沒有 lib/ 版本）。 */

const fs = require('fs');
const path = require('path');
const { extractFunction } = require('./lib/gameshuffle.js');

/* ---------- 第二套實作：最大公因數走質因數（頁面是輾轉相除） ---------- */
function factorsRef(n){ const f = {}; let x = n; for (let p = 2; p * p <= x; p++) while (x % p === 0){ f[p] = (f[p] || 0) + 1; x /= p; } if (x > 1) f[x] = (f[x] || 0) + 1; return f; }
function gcdRef(a, b){
  if (a === 0) return b; if (b === 0) return a;
  const fa = factorsRef(a), fb = factorsRef(b);
  let g = 1;
  Object.keys(fa).forEach(p => { if (fb[p]) g *= Math.pow(+p, Math.min(fa[p], fb[p])); });
  return g;
}
function simpRef(n, d){ const g = gcdRef(n, d); return { n:n / g, d:d / g }; }
function simpTxt(n, d){ const s = simpRef(n, d); return s.d === 1 ? String(s.n) : s.n + '/' + s.d; }
const disp = (n, d) => d === 1 ? String(n) : n + '/' + d;   /* 迷思算出來的樣子：不約分，分母 1 寫成整數 */
const nums = t => (String(t).match(/\d+/g) || []).map(Number);
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }

/* ===================== 有理數驗算器（grade-5-fraction-multiply 的 fracArith） ===================== */
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
const TERM_SRC = '(?:\\d+(?: 又 | )\\d+\\/\\d+|\\d+\\.\\d+|\\d+\\/\\d+|\\d+|[?？□])';
const OP_SRC = '[×*÷+＋\\-－−–/]';
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
  const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
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
  { text:'3/4 ÷ 2 = 3/(4×2) = 3/8', bad:false },
  { text:'3/4 ÷ 2 = 3/4 × 1/2 = 3/8', bad:false },
  { text:'6/7 ÷ 3 = (6÷3)/7 = 2/7', bad:false },
  { text:'6/7 ÷ 3 = (6 ÷ 3)/7 = 2/7，分母不變。', bad:false },
  { text:'2/3 ÷ 2 = 2/6，約分後是 1/3', bad:false },
  { text:'3 ÷ 4 = 3/4', bad:false },
  { text:'塗色的有 3 × 2 = 6 小格', bad:false },
  { text:'7.2 裡面有 72 個 0.1，72 ÷ 2 = 36 個 0.1', bad:false },
  { text:'5/6÷2=5/12（這是其中一半的長度）', bad:false },
  { text:'2/3 ÷ 4 = 2/3 × 1/4 = 2/12 = 1/6.', bad:false },
  { text:'3/4 ÷ 2 = 3/(4×2) = 3/6', bad:true },
  { text:'3/4 ÷ 2 = 6/4', bad:true },
  { text:'6/7 ÷ 3 = (6÷3)/7 = 2/21', bad:true },
  { text:'3 ÷ 4 = 4/3', bad:true },
  { text:'塗色的有 3 × 2 = 5 小格', bad:true },
  { text:'72 ÷ 2 = 35', bad:true },
  { text:'2/3 ÷ 2 = 2/6 = 1/2', bad:true },
  { text:'1/2 = 0.2', bad:true }
];

/* ===================== 4 頁的文字從哪裡讀 ===================== */
function stripScripts(html){ return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' '); }
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
const CLAIM_COUNTS = { index:44, review:0, reference:24, parents:3 };

/* ===================== review.html：九個產生器 ===================== */
const GEN_IDS = ['shareAsFraction', 'divideGeneral', 'divideShortcut', 'wordShare', 'twoStepDivide', 'equivalentExpr', 'fractionMultiply', 'fractionAdd', 'decimalDivide'];
/* 每個產生器 pickUnused 的那一個池子（順序、重複都算） */
const POOL_REF = {
  shareAsFraction:[3, 4, 5, 6, 7, 8], divideGeneral:[3, 4, 5, 6, 7], divideShortcut:[5, 7, 8, 9, 10], wordShare:[2, 3, 4, 5, 6, 8, 9, 10],
  twoStepDivide:[2, 3, 4, 5], equivalentExpr:[3, 4, 5, 6, 7], fractionMultiply:[2, 3, 4, 5, 6], fractionAdd:[5, 7, 8, 9, 10], decimalDivide:[2, 3, 4, 5, 6]
};
/* make() 一共走得出幾種不同的題目（把 rand 的每一種選擇走完）。少了就是範圍被砍、多了就是規則被放寬 —— 都要重看。 */
const SPACE_REF = { shareAsFraction:14, divideGeneral:32, divideShortcut:18, wordShare:41, twoStepDivide:54, equivalentExpr:63, fractionMultiply:92, fractionAdd:36, decimalDivide:350 };
/* 每個產生器的範圍（第二份來源）：make() 的每一題都要落在裡面 */
function domainRef(id, d){
  const coprime = (a, b) => gcdRef(a, b) === 1;
  switch (id){
    case 'shareAsFraction': return d.m >= 3 && d.m <= 8 && d.n >= 2 && d.n < d.m && coprime(d.n, d.m);
    case 'divideGeneral': return d.den >= 3 && d.den <= 7 && d.num >= 1 && d.num < d.den && coprime(d.num, d.den) && [2, 3, 4].indexOf(d.k) >= 0 && d.num % d.k !== 0 && d.k % d.den !== 0;
    case 'divideShortcut': return [5, 7, 8, 9, 10].indexOf(d.den) >= 0 && [2, 3, 4].indexOf(d.k) >= 0 && d.num === d.q * d.k && d.num < d.den && coprime(d.num, d.den);
    case 'wordShare': return POOL_REF.wordShare.indexOf(d.total) >= 0 && [3, 4, 5, 6, 7, 8, 9, 10, 12].indexOf(d.people) >= 0 && d.people > d.total;
    case 'twoStepDivide': return d.b >= 2 && d.b <= 5 && d.a >= 1 && d.a < d.b && coprime(d.a, d.b) && [2, 3, 4].indexOf(d.k1) >= 0 && [2, 3, 4].indexOf(d.k2) >= 0 && d.k1 !== d.k2;
    case 'equivalentExpr': return d.den >= 3 && d.den <= 7 && d.num >= 1 && d.num < d.den && coprime(d.num, d.den) && d.k >= 2 && d.k <= 5 && d.den !== d.num * d.k * (d.k - 1);
    case 'fractionMultiply': return d.b >= 2 && d.b <= 6 && d.dd >= 2 && d.dd <= 6 && d.b !== d.dd && d.a < d.b && d.c < d.dd && coprime(d.a, d.b) && coprime(d.c, d.dd) && d.a >= 1 && d.c >= 1;
    case 'fractionAdd': return [5, 7, 8, 9, 10].indexOf(d.den) >= 0 && d.a >= 1 && d.c >= 1 && d.a !== d.c && d.a + d.c < d.den && coprime(d.a, d.den) && coprime(d.c, d.den);
    case 'decimalDivide': return d.k >= 2 && d.k <= 6 && d.qt >= 20 && d.qt <= 89;
  }
  return false;
}
/* 正解（有理數），只用原始參數算 */
function correctValRef(id, d){
  switch (id){
    case 'shareAsFraction': return { n:d.n, d:d.m };
    case 'divideGeneral': return { n:d.num, d:d.den * d.k };
    case 'divideShortcut': return { n:d.num, d:d.den * d.k };
    case 'wordShare': return { n:d.total, d:d.people };
    case 'twoStepDivide': return { n:d.a, d:d.b * d.k1 * d.k2 };
    case 'equivalentExpr': return { n:d.num, d:d.den * d.k };
    case 'fractionMultiply': return { n:d.a * d.c, d:d.b * d.dd };
    case 'fractionAdd': return { n:d.a + d.c, d:d.den };
    case 'decimalDivide': return { n:d.qt, d:10 };
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
function expectedCorrectRef(d, id){
  if (id === 'equivalentExpr') return d.num + '/' + d.den + ' × 1/' + d.k;
  const v = correctValRef(id, d);
  if (id === 'decimalDivide') return decTextRef(v.n, v.d);
  return simpTxt(v.n, v.d);
}
/* 選項讀回有理數：整數、分數、小數；算式（equivalentExpr）也讀；讀不懂回 null */
function parseOptVal(s){
  const t = String(s).trim();
  let m = /^(\d+)\/(\d+) × 1\/(\d+)$/.exec(t); if (m) return { n:+m[1], d:+m[2] * +m[3], shape:'expr' };
  m = /^(\d+)\/(\d+) × (\d+)$/.exec(t); if (m) return { n:+m[1] * +m[3], d:+m[2], shape:'expr' };
  m = /^(\d+) × (\d+)\/(\d+)$/.exec(t); if (m) return { n:+m[1] * +m[2], d:+m[3], shape:'expr' };
  m = /^(\d+)\/(\d+) \+ 1\/(\d+)$/.exec(t); if (m) return { n:+m[1] * +m[3] + +m[2], d:+m[2] * +m[3], shape:'expr' };
  m = /^(\d+)\.(\d+)$/.exec(t); if (m) return { n:Number(m[1] + m[2]), d:Math.pow(10, m[2].length), shape:'dec' };
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return { n:+m[1], d:+m[2], shape:'frac' };
  m = /^(\d+)$/.exec(t); if (m) return { n:+m[1], d:1, shape:'int' };
  return null;
}
function sameVal(p, q){ return p.n * q.d === q.n * p.d; }
const D_K = d => [d.k];
/* 每一個誘答都要是一個說得出名字的迷思（顯示的字串逐字對上）。正解不在這裡面比。 */
const MISCON = {
  shareAsFraction: d => ({ reversed:disp(d.m, d.n), onePiece:disp(1, d.m), onePieceOfAll:disp(1, d.n * d.m), addedUp:disp(d.n, d.n + d.m) }),
  wordShare: d => ({ reversed:disp(d.people, d.total), onePiece:disp(1, d.people), onePieceOfAll:disp(1, d.total * d.people), addedUp:disp(d.total, d.total + d.people) }),
  divideGeneral: d => ({ numTimesK:disp(d.num * d.k, d.den), denPlusK:disp(d.num, d.den + d.k), onePiece:disp(1, d.den * d.k), unchanged:disp(d.num, d.den) }),
  divideShortcut: d => ({ numTimesK:disp(d.num * d.k, d.den), didBoth:disp(d.q, d.den * d.k), denPlusK:disp(d.num, d.den + d.k), unchanged:disp(d.num, d.den) }),
  twoStepDivide: d => ({ onlyFirst:disp(d.a, d.b * d.k1), addedDivisors:disp(d.a, d.b * (d.k1 + d.k2)), numTimesBoth:disp(d.a * d.k1 * d.k2, d.b),
                         onlySecond:disp(d.a, d.b * d.k2), allOnDenominator:disp(d.a, d.b + d.k1 + d.k2), onePiece:disp(1, d.b * d.k1 * d.k2) }),
  equivalentExpr: d => ({ timesK:d.num + '/' + d.den + ' × ' + d.k, flippedTheFraction:d.k + ' × ' + d.den + '/' + d.num, addedReciprocal:d.num + '/' + d.den + ' + 1/' + d.k }),
  fractionMultiply: d => ({ addTopsAndBottoms:disp(d.a + d.c, d.b + d.dd), multiplyTopsAddBottoms:disp(d.a * d.c, d.b + d.dd), crossMultiplied:disp(d.a * d.dd, d.b * d.c),
                            addedInstead:disp(d.a * d.dd + d.c * d.b, d.b * d.dd), addTopsMultiplyBottoms:disp(d.a + d.c, d.b * d.dd),
                            keptFirstDenominator:disp(d.a * d.c, d.b), keptSecondDenominator:disp(d.a * d.c, d.dd) }),
  fractionAdd: d => ({ addedBottomsToo:disp(d.a + d.c, 2 * d.den), addTopsMultiplyBottoms:disp(d.a + d.c, d.den * d.den), multipliedTops:disp(d.a * d.c, d.den),
                       multipliedBoth:disp(d.a * d.c, d.den * d.den), subtracted:disp(Math.abs(d.a - d.c), d.den) }),
  decimalDivide: d => ({ forgotThePoint:String(d.qt), pointTooFarLeft:decTextRef(d.qt, 100), offByATenthUp:decTextRef(d.qt + 1, 10), offByATenthDown:decTextRef(d.qt - 1, 10) })
};
/* 題幹印的數（照順序）與題幹上的分數 */
function stemWant(id, d, lang){
  switch (id){
    case 'shareAsFraction': return [d.n, d.m];
    case 'wordShare': return [d.total, d.people];
    case 'divideGeneral': case 'divideShortcut': case 'equivalentExpr': return [d.num, d.den, d.k];
    case 'twoStepDivide': return [d.a, d.b, d.k1, d.k2];
    case 'fractionMultiply': return [d.a, d.b, d.c, d.dd];
    case 'fractionAdd': return [d.a, d.den, d.c, d.den];
    case 'decimalDivide': return nums(decTextRef(d.qt * d.k, 10)).concat([d.k]);
  }
  return null;
}
/* 選項的上限：從迷思的最大值推出來（不是隨手給的大數，LESSONS 2026-08-25） */
const OPT_MAX = {
  shareAsFraction:4, wordShare:6,                    /* 倒過來除：m/n ≤ 7/2、people/total ≤ 12/2 */
  divideGeneral:4, divideShortcut:4,                 /* 分子乘 k：a × k / b < k ≤ 4 */
  twoStepDivide:12,                                  /* 分子乘兩次：a × k1 × k2 / b < 12 */
  fractionMultiply:5, fractionAdd:3,                 /* 交叉相乘 a × dd / (b × c) ≤ 5；分子相乘 a × c / den < 3 */
  equivalentExpr:35, decimalDivide:90                /* k × den/num ≤ 5 × 7；忘了小數點 qt ≤ 89 */
};
function optionOk(s, id, lang, isCorrect){
  if (/undefined|NaN|null/.test(s)) return 'option "' + s + '" has undefined/NaN';
  const p = parseOptVal(s);
  if (!p) return 'option "' + s + '" is not a number, fraction, decimal or one of the four expression shapes';
  if (id === 'equivalentExpr' ? p.shape !== 'expr' : (id === 'decimalDivide' ? (p.shape !== 'dec' && p.shape !== 'int') : (p.shape !== 'frac' && p.shape !== 'int')))
    return 'option "' + s + '" has the wrong shape for ' + id;
  if (!(p.n > 0 && p.d > 0)) return 'option "' + s + '" is not a positive value';
  if (p.n / p.d > OPT_MAX[id]) return 'option "' + s + '" is above ' + OPT_MAX[id] + ', the largest value this generator\'s own misconceptions can reach';
  if (isCorrect && p.shape === 'frac' && !(p.n < p.d && gcdRef(p.n, p.d) === 1)) return 'the correct option "' + s + '" is not a proper fraction in simplest form';
  return null;
}
/* 刻意抄題幹的誘答：除法題的「沒有分」＝題幹那個分數本身（§六之三第 4 點，只放行這一個值） */
const ECHO_OK = { divideGeneral:['unchanged'], divideShortcut:['unchanged'] };
function renderCheck(d, q, lang, id){
  const plainStem = String(q.stem).replace(/<[^>]+>/g, ' ');
  const vals = q.opts.map(parseOptVal);
  if (vals.some(v => !v)) return 'an option cannot be read back';
  for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++)
    if (sameVal(vals[i], vals[j])) return 'options "' + q.opts[i] + '" and "' + q.opts[j] + '" have the same value';
  const named = MISCON[id](d), names = Object.keys(named);
  /* 題幹上的數（整數、分數、小數）的值 */
  const stemVals = (plainStem.match(/\d+(?:\.\d+)?(?:\/\d+)?/g) || []).map(parseOptVal).filter(Boolean);
  for (let i = 0; i < q.opts.length; i++){
    if (i === q.ans) continue;
    const role = names.filter(k => named[k] === String(q.opts[i]));
    if (!role.length) return 'distractor "' + q.opts[i] + '" matches no named misconception (' + names.map(k => k + '=' + named[k]).join(', ') + ')';
    if (id !== 'equivalentExpr' && stemVals.some(v => sameVal(v, vals[i])) && !role.some(r => (ECHO_OK[id] || []).indexOf(r) >= 0))
      return 'distractor "' + q.opts[i] + '" (' + role.join('/') + ') has the value of a number printed in the stem';
  }
  /* simgen 的抄題幹規則（比的是數字串）：題幹上任何一段數字（含小數點兩邊）都不可以原樣當誘答 */
  const stemRuns = plainStem.match(/\d+/g) || [];
  for (let i = 0; i < q.opts.length; i++) if (i !== q.ans && stemRuns.indexOf(String(q.opts[i])) >= 0) return 'distractor "' + q.opts[i] + '" is a number string printed in the stem';
  const want = stemWant(id, d, lang);
  if (!sameList(nums(plainStem), want)) return 'the stem prints ' + nums(plainStem).join(',') + ', the parameters say ' + want.join(',');
  const r = fracArith(q.why);
  if (r.problems.length) return 'why: ' + r.problems[0];
  if (r.verified < 1) return 'why verifies no equation: ' + q.why.slice(0, 80);
  const ans = expectedCorrectRef(d, id);
  if (String(q.why).replace(/<[^>]+>/g, ' ').indexOf(ans) < 0) return 'why never states the answer ' + ans;
  return null;
}
const INVARIANTS = {};
GEN_IDS.forEach(id => {
  INVARIANTS[id] = function(d){
    if (!domainRef(id, d)) return 'parameters ' + JSON.stringify(d).slice(0, 120) + ' are outside this generator\'s range';
    const v = correctValRef(id, d), s = simpRef(v.n, v.d);
    if (id === 'divideGeneral' && (d.pd !== d.den * d.k || d.sn !== s.n || d.sd !== s.d)) return 'kept ' + d.sn + '/' + d.sd + ' (pd ' + d.pd + '), independently ' + s.n + '/' + s.d;
    if (id === 'divideShortcut' && (d.q * d.k !== d.num)) return 'q ' + d.q + ' × k ' + d.k + ' is not the numerator ' + d.num;
    if (id === 'wordShare' && (d.sn !== s.n || d.sd !== s.d)) return 'kept ' + d.sn + '/' + d.sd;
    if (id === 'twoStepDivide' && (d.pd !== d.b * d.k1 * d.k2 || d.sn !== s.n || d.sd !== s.d || d.mid !== d.a + '/' + (d.b * d.k1))) return 'kept ' + d.sn + '/' + d.sd + ' mid ' + d.mid;
    if (id === 'fractionMultiply' && (d.pn !== d.a * d.c || d.pd !== d.b * d.dd || d.sn !== s.n || d.sd !== s.d)) return 'kept ' + d.pn + '/' + d.pd;
    if (id === 'fractionAdd' && (d.pn !== d.a + d.c || d.sn !== s.n || d.sd !== s.d)) return 'kept ' + d.pn + '/' + d.den;
    if (id === 'decimalDivide' && (d.dividendTenths !== d.qt * d.k || String(d.dividend) !== decTextRef(d.qt * d.k, 10) || String(d.q) !== decTextRef(d.qt, 10))) return 'dividend ' + d.dividend + ' / quotient ' + d.q + ' do not match ' + d.qt + ' tenths × ' + d.k;
    return null;
  };
});

/* review.html 的每一個產生器、每一條 make() 的路都確定地走一遍：換掉 rand，把每一種選擇走完（像里程表一樣進位）。
   每一題兩種語言都過 INVARIANTS、expectedCorrect、optionOk、renderCheck；池子與題目總數釘住。 */
function enumerate(H, make){
  const out = [];
  let pathTo = [];
  for (let guard = 0; guard < 50000; guard++){
    let depth = 0; const ns = [];
    H.setRand(n => { const v = depth < pathTo.length ? pathTo[depth] : 0; ns.push(n); depth++; return v; });
    out.push(make([]));
    const p = ns.map((n, i) => i < pathTo.length ? pathTo[i] : 0);
    let i = p.length - 1;
    while (i >= 0 && p[i] + 1 >= ns[i]) i--;
    if (i < 0) return out;
    pathTo = p.slice(0, i).concat([p[i] + 1]);
  }
  return null;
}
function checkReviewAll(fail, reviewSrc){
  const i = reviewSrc.indexOf('/* ---------- 工具 ---------- */'), j = reviewSrc.indexOf('/* ---------- 出一批');
  if (i < 0 || j < 0) return fail('review.html: cannot cut the GENS block');
  let H;
  try { H = new Function(reviewSrc.slice(i, j) + '\n; return { GENS:GENS, setPick:function(f){ pickUnused = f; }, setRand:function(f){ rand = f; }, pickUnused:pickUnused };')(); }
  catch (e){ return fail('review.html GENS could not run: ' + e.message); }
  const GENS = H.GENS, ids = GENS.map(g => g.id), realPU = H.pickUnused, realRand = n => Math.floor(Math.random() * n);
  if (!sameList(ids, GEN_IDS)) fail('review.html generators are ' + ids.join() + ', expected ' + GEN_IDS.join());
  const counts = {};
  GENS.forEach(g => {
    if (!POOL_REF[g.id]) return;
    let pool = null;
    H.setPick(function(p){ pool = p.slice(); return p[0]; });
    H.setRand(realRand);
    try { g.make([]); } catch (e){ return fail('review ' + g.id + ': make() threw ' + e.message); }
    H.setPick(realPU);
    if (!pool) return fail('review ' + g.id + ': make() never picks from a pool');
    if (!sameList(pool, POOL_REF[g.id])) fail('review ' + g.id + ': the pool is ' + pool.join(' ') + ', pinned ' + POOL_REF[g.id].join(' ') + ' (order and duplicates count)');
    let all;
    try { all = enumerate(H, g.make); } catch (e){ return fail('review ' + g.id + ': make() threw during enumeration ' + e.message); }
    H.setRand(realRand);
    if (!all) return fail('review ' + g.id + ': the choices never run out');
    const seen = {};
    /* decimalDivide 在 make() 裡就把選項洗好了：同一組參數的每一種排法都驗，但題目數只算參數 */
    const pseen = {};
    all.forEach(d => {
      const key = JSON.stringify(d);
      if (seen[key]) return;
      seen[key] = true;
      pseen[JSON.stringify(Object.assign({}, d, { opts:undefined, ans:undefined }))] = true;
      const inv = INVARIANTS[g.id](d);
      if (inv) fail('review ' + g.id + ' ' + key.slice(0, 90) + ': ' + inv);
      ['zh', 'en'].forEach(L => {
        let q;
        try { q = g.fmt(d, L); } catch (e){ return fail('review ' + g.id + ' ' + L + ': fmt() threw ' + e.message); }
        if (!q.opts || q.opts.length !== 4) return fail('review ' + g.id + ' ' + key.slice(0, 90) + ' ' + L + ': ' + (q.opts || []).length + ' options (the named misconceptions ran out)');
        const want = expectedCorrectRef(d, g.id);
        if (String(q.opts[q.ans]) !== want) fail('review ' + g.id + ' ' + key.slice(0, 90) + ' ' + L + ': marked answer "' + q.opts[q.ans] + '", independently "' + want + '"');
        q.opts.forEach((o, oi) => { const bad = optionOk(String(o), g.id, L, oi === q.ans); if (bad) fail('review ' + g.id + ' ' + key.slice(0, 90) + ' ' + L + ': ' + bad); });
        const r = renderCheck(d, q, L, g.id);
        if (r) fail('review ' + g.id + ' ' + key.slice(0, 90) + ' ' + L + ': ' + r);
      });
    });
    counts[g.id] = Object.keys(pseen).length;
    if (counts[g.id] !== SPACE_REF[g.id]) fail('review ' + g.id + ': make() can produce ' + counts[g.id] + ' different questions, pinned ' + SPACE_REF[g.id] + ' — the range changed; re-check and update SPACE_REF');
  });
}

/* ===================== 小遊戲「巧克力大平分」 ===================== */
const GAME_TYPES = ['share', 'finer', 'group', 'build', 'find'];
const BOARD_W = 300, PICK_REF = 44;
const EN_COUNT_NOUNS = ['piece', 'part', 'bar', 'card', 'divider'];
function enPlural(txt){
  for (const w of EN_COUNT_NOUNS){
    if (new RegExp('\\b1 (shaded )?' + w + 's\\b').test(txt)) return 'prints "1 ' + w + 's"';
    const m = new RegExp('(^|[^/\\d])(\\d+) (shaded )?' + w + '\\b(?!s)').exec(txt);
    if (m && +m[2] !== 1) return 'prints "' + m[2] + ' ' + (m[3] || '') + w + '" without the plural s';
  }
  if (/\bThere is (?!1 )\d/.test(txt) || /\bThere are 1 /.test(txt)) return 'is/are does not agree with the number';
  return null;
}
/* 一句旁白：數字照順序、算式全對、英文單複數、中文和數字之間有空格 */
function sayCheck(fail, where, text, want, minVerified){
  if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
  if (want && !sameList(nums(text), want)) fail(where + ': numbers should read ' + want.join(',') + ', got ' + nums(text).join(',') + ' — ' + text);
  const r = fracArith(text);
  r.problems.forEach(p => fail(where + ': ' + p + ' — ' + text));
  if (minVerified && r.verified < minVerified) fail(where + ': verifies only ' + r.verified + ' equation(s), expected ' + minVerified + ' — ' + text);
  if (/[a-z]{3}/.test(text) && !/[一-鿿]/.test(text)){ const pp = enPlural(text); if (pp) fail(where + ': ' + pp + ' — ' + text); }
  if (/[一-鿿]/.test(text)){ const g = text.replace(/<[^>]+>/g, '').match(/[一-鿿]\d|\d[一-鿿]/); if (g) fail(where + ': "' + g[0] + '" — a digit glued to Chinese (the site puts a space between)'); }
}
function overlap(a, b, gap){ gap = gap || 0; return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -gap && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -gap; }
function inBoard(r, H){ return r.x >= 0 && r.y >= 0 && r.x + r.w <= BOARD_W && r.y + r.h <= H; }
const cbox = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
const box = (id, cx, cy, w, h) => ({ id, cx, cy, hw:w / 2, hh:h / 2, done:false });

function checkGame(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  if (!sameList(D.GAME_ORDER, GAME_TYPES)) fail('GAME_ORDER should be ' + GAME_TYPES.join() + ', got ' + (D.GAME_ORDER || []).join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d, ask\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'function')) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'function')) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const needSrc = (re, what) => { if (!re.test(src)) fail(what); };
  ['GAME_SHARE', 'GAME_FINER', 'GAME_GROUP', 'GAME_BUILD', 'GAME_FIND'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 5) fail(k + ' should be a pool of at least 5 entries');
    else { const ks = D[k].map(e => JSON.stringify(e)); if (new Set(ks).size !== ks.length) fail(k + ' has a duplicated entry'); }
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
  needSrc(/if \(P\.busy\(\)\) return;   \/\*/, 'a tap on a destination still places a piece another finger is dragging');
  needSrc(/if \(!moved && dx \* dx \+ dy \* dy > 36\)\{ moved = true;/, 'a move of more than 6px is not what turns a press into a drag (finger jitter or a real drag is misread)');
  needSrc(/board\.addEventListener\('pointerdown', function\(e\)\{\s*if \(e\.target\.closest && e\.target\.closest\('\.gpiece'\)\) return;\s*if \(!e\.isPrimary\) return;/, 'a second finger tapping the board counts as a tap on a destination');
  needSrc(/if \(t\.far \|\| Math\.hypot\(e\.clientX - t\.x, e\.clientY - t\.y\) > 10\) return;/, 'a press that wandered away on the board still counts as a tap on a destination');
  needSrc(/if \(PIECE_PTR\[e\.pointerId\]\) return;/, 'a release of a finger that started on a piece counts as a tap on the board');
  needSrc(/if \(!moved\)\{ if \(B\.onTap\) B\.onTap\(P\); return; \}/, 'a tap (no movement) on a piece is not a tap');
  /* 拖的時候 ✂️ 停在哪裡，判斷用的 s 就是哪裡：place() 每一次都要通知 onPlace（codex 第一輪：刪掉這一行，畫面照樣吸附，判斷卻停在舊的 s） */
  needSrc(/P\.place = function\(cx, cy\)\{\s*P\.cx = cx; P\.cy = cy;\s*el\.style\.transform = [^\n]*\n\s*if \(o\.onPlace\) o\.onPlace\(P\);\s*\};/, 'place() does not report every position change to onPlace (the judged value can differ from the one shown)');
  needSrc(/if \(!\(B\.onDrop && B\.onDrop\(P, \{ x:P\.cx, y:P\.cy \}\)\)\) P\.home\(\);/, 'a drop is not judged at the piece centre');
  ['share', 'finer', 'group', 'build'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'no tap-then-tap alternative for the drag'));
  need('share', /if \(!shareOk\(c, t\.j\)\)\{ roundMiss\(d\.gShareUnfair\(c\[t\.j\], Math\.min\.apply\(null, c\)\)\); return false; \}/, 'a plate is not judged by shareOk() (fair dealing) with the unfair reason');
  need('share', /var t = nearestOpen\(plates, pt, SHARE_PLATE\.pad\);/, 'plates are not chosen by nearestOpen()');
  need('share', /var sp = shareSpot\(Lo, t\.j, t\.n\);\s*P\.lock\(sp\.cx, sp\.cy, sp\.w, sp\.h\);/, 'a dealt piece is not stacked by shareSpot()');
  need('finer', /snap:function\(x\)\{ return finerStopX\(finerSnap\(x\)\); \}/, 'the ✂️ does not snap to the drawn numbers while dragging');
  need('finer', /var v = finerSnap\(K\.cx\);\s*if \(v !== s\)\{ s = v; draw\(\); refreshHint\(\); \}/, 'the ✂️ onPlace does not update the judged s (and redraw) from the snapped position');
  need('finer', /if \(knob\) knob\.el\.querySelector\('\.gkval'\)\.textContent = String\(s\);/, 'the ✂️ does not show the judged s');
  need('finer', /if \(gSolved \|\| knob\.busy\(\)\) return;/, 'the split is judged while the ✂️ is still held');
  need('finer', /if \(!finerOk\(e, s\)\)\{/, 'the split is not judged by finerOk()');
  need('finer', /if \(told\[s\]\)\{ roundNote\(d\.gFinerNo\(e\.a, s, e\.k\)\); return; \}\s*told\[s\] = true;\s*roundMiss\(d\.gFinerNo\(e\.a, s, e\.k\)\);/, 'pressing again with the same cut costs again');
  need('finer', /if \(pt\.tap && !inSlide\(pt\)\) return false;\s*P\.rehome\(finerStopX\(finerSnap\(pt\.x\)\), S\.y\);/, 'tap-tap does not move the ✂️ to the nearest number');
  need('finer', /B\.onFreeTap = function\(pt\)\{\s*if \(gSolved \|\| knob\.busy\(\) \|\| !inSlide\(pt\)\) return;\s*knob\.rehome\(finerStopX\(finerSnap\(pt\.x\)\), S\.y\);/, 'a tap on a number does not move the ✂️ there');
  need('finer', /function inSlide\(pt\)\{ return pt\.x >= S\.x0 - S\.tapPad && pt\.x <= S\.x1 \+ S\.tapPad && pt\.y >= S\.tapTop && pt\.y <= S\.tapBot; \}/, 'the slider tap zone is not the track and its numbers');
  need('group', /var j = groupJudge\(e, t\.g\);\s*if \(j === 'out'\)\{ roundMiss\(d\.gGroupOut\(e\.a\)\); return false; \}\s*if \(j === 'uneven'\)\{ roundMiss\(d\.gGroupUneven\(t\.g, e\.a, e\.k\)\); return false; \}/, 'a divider is not judged by groupJudge() with its reason');
  need('group', /var t = nearestOpen\(gaps, pt, GROUP_GAP\.pad\);/, 'lines are not chosen by nearestOpen()');
  need('group', /if \(placed === need\) roundSolved/, 'the round is not solved when all k − 1 dividers are placed');
  need('build', /if \(!buildOk\(P\.data\.role, t\.part\)\)\{ roundMiss\(d\.gBuildWhy\(P\.data\.role, t\.part, e\.a, e\.b, e\.k\)\); return false; \}/, 'a card is not judged by buildOk() with its reason');
  need('build', /buildTray\(e\)\.forEach/, 'the cards are not laid out through buildTray()');
  need('build', /var t = nearestOpen\(boxes, pt, X\.pad\);/, 'boxes are not chosen by nearestOpen()');
  need('find', /findTray\(e\)\.forEach/, 'the cards are not laid out through findTray()');
  need('find', /if \(gSolved \|\| P\.locked\) return;\s*var c = cards\[P\.data\.ci\];\s*P\.lock\(P\.homeX, P\.homeY\);\s*if \(!c\.ok\)\{ P\.el\.classList\.add\('gwrong'\); roundMiss\(d\.gFindWhy\(c\.role, e\.a, e\.b, e\.k\)\); return; \}/, 'a card is not locked after one tap (a wrong card could cost twice) or a wrong one gives no reason');
  need('find', /B\.onDrop = function\(\)\{ return false; \};/, 'dragging a card is not a no-op');
  GAME_TYPES.forEach(t => {
    need(t, /gCtx\.hint1 = d\.gHints\.\w+\(/, 'no level-1 hint');
    need(t, /gCtx\.hint2 = function\(\)\{ return d\.g\w+2\(/, 'no level-2 hint that follows the board');
  });

  /* ---------- 2. 計分（§三 高年級：有扣分；+20 ／ +10，放錯 −5 最低 0；沒有加碼） ---------- */
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
    const nsrc = extractFunction(src, 'roundNote');
    if (!nsrc) fail('scoring: cannot find roundNote()');
    else [0, 5, 20].forEach(s0 => {
      let r;
      try { r = new Function('var gMistake = false, gAnyMistake = false, gScore = ' + s0 + ', elScore = { textContent:"' + s0 + '" }, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + (fsrc || '') + '\n' + nsrc + '\nroundNote("note"); return { s:gScore, shown:elScore.textContent, html:String(gMsg.innerHTML), m:gMistake, any:gAnyMistake };')(); }
      catch (e){ return fail('scoring: roundNote() could not run: ' + e.message); }
      if (r.s !== s0 || String(r.shown) !== String(s0) || r.m || r.any || r.html.indexOf('@MINUS@') >= 0 || r.html.indexOf('note') < 0 || /class="no"/.test(r.html))
        fail('scoring: roundNote() at ' + s0 + ' points is not a free reminder (score ' + r.s + ', mistake ' + r.m + '/' + r.any + ', html ' + r.html + ')');
    });
    const ssrc = extractFunction(src, 'roundSolved');
    if (!ssrc) fail('scoring: cannot find roundSolved()');
    else [[0, false, false, 20], [0, true, true, 10], [4, false, false, 20], [4, true, true, 10], [4, false, true, 20]].forEach(([round, mis, any, want]) => {
      let r;
      try {
        r = new Function('var gSolved = false, gScore = 0, gMistake = ' + mis + ', gAnyMistake = ' + any + ', gRound = ' + round + ', GAME_ORDER = [1,2,3,4,5];' +
          'var gameStage = { querySelectorAll:function(){ return []; } }, elScore = {}, gHintBtn = {}, elHint = { textContent:"old hint" }, gMsg = {}, gNext = { disabled:true };' +
          'function L(){ return { gPts:function(p){ return "+" + p; }, gWin:function(s, c){ return "WIN" + s + (c ? "C" : ""); }, gClear:"CLEAR" }; }\n' + ssrc +
          '\nroundSolved("ok"); return { s:gScore, hint:elHint.textContent, dis:gHintBtn.disabled, next:gNext.disabled, html:gMsg.innerHTML };')();
      } catch (e){ return fail('scoring: roundSolved() could not run: ' + e.message); }
      if (r.s !== want) fail('scoring: round ' + (round + 1) + (mis ? ' with' : ' without') + ' mistakes gives ' + r.s + ', expected ' + want);
      if (r.hint !== '' || r.dis !== true) fail('scoring: a solved round leaves the hint showing or the hint button enabled');
      if ((round < 4) === r.next) fail('scoring: Next is ' + (r.next ? 'disabled after a cleared round' : 'enabled after the last round'));
      if (round === 4 && /C/.test(r.html) !== (!any)) fail('scoring: the final message is told the run was ' + (any ? 'clean although it had mistakes' : 'not clean although it was'));
    });
  }
  LANGS.forEach(L => {
    sayCheck(fail, 'gPts ' + L, I18N[L].gPts(20), [20]);
    sayCheck(fail, 'gMinus ' + L, I18N[L].gMinus, [5]);
    const w0 = I18N[L].gWin(85, false), w1 = I18N[L].gWin(100, true);
    if (nums(w0).indexOf(85) < 0 || nums(w1).indexOf(100) < 0) fail('gWin ' + L + ' does not show the score');
    if (/(重新開始|Restart)/.test(w1)) fail('gWin ' + L + ': a clean run is still told to try again without mistakes');
    if (!/(重新開始|Restart)/.test(w0)) fail('gWin ' + L + ': a run with mistakes is not invited to try again');
    if (nums(I18N[L].s6lead).join() !== '5,0') fail('s6lead ' + L + ' should state −5 and the floor 0: ' + I18N[L].s6lead);
  });

  /* ---------- 3. nearestOpen()／shuffle()：從原始碼切出來真的跑 ---------- */
  let nearestOpen = null, shuffle = null;
  try { nearestOpen = new Function(extractFunction(src, 'nearestOpen') + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); }
  try { shuffle = new Function(extractFunction(src, 'shuffle') + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); }
  /* 一排相鄰的目標：每一個點都要給「最近的那一個」（量到方框，一樣近才比中心） */
  function rowNearest(tag, list, pad){
    if (!nearestOpen) return;
    let bad = 0, overlapSeen = 0;
    list.forEach(b => { for (let x = b.cx - b.hw + 0.25; x < b.cx + b.hw; x += 1) for (let y = b.cy - b.hh + 0.25; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, pad); if (!g || g.id !== b.id) bad++; } });
    if (bad) fail(tag + ': nearestOpen() gives ' + bad + ' points inside a target to another one (or none)');
    for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) if (i !== j){
      const a = list[i], b = list[j];
      /* 兩個目標中間的縫：離 a 比較近的點給 a */
      for (let t = 0; t <= 1; t += 0.02){
        const x = a.cx + (b.cx - a.cx) * t, y = a.cy + (b.cy - a.cy) * t;
        const da = Math.hypot(Math.max(0, Math.abs(x - a.cx) - a.hw), Math.max(0, Math.abs(y - a.cy) - a.hh));
        const db = Math.hypot(Math.max(0, Math.abs(x - b.cx) - b.hw), Math.max(0, Math.abs(y - b.cy) - b.hh));
        if (da >= db || da === 0) continue;
        const inA = Math.abs(x - a.cx) <= a.hw + pad && Math.abs(y - a.cy) <= a.hh + pad, inB = Math.abs(x - b.cx) <= b.hw + pad && Math.abs(y - b.cy) <= b.hh + pad;
        if (!(inA && inB)) continue;
        overlapSeen++;
        const g = nearestOpen(list, { x, y }, pad);
        if (!g || g.id !== a.id){ fail(tag + ': a point in the overlap of targets ' + a.id + ' and ' + b.id + ', nearer ' + a.id + ', went to ' + (g ? g.id : 'none')); return; }
      }
    }
    return overlapSeen;
  }
  if (nearestOpen){
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
  const P = D.GPICK;
  if (!(P >= PICK_REF)) fail('GPICK ' + P + ' is under 44px');

  /* ---------- 4. 第 1 關：輪流發 ---------- */
  {
    const Q = D.SHARE_PLATE;
    D.GAME_SHARE.forEach(e => {
      const tag = 'share ' + e.n + ' ÷ ' + e.m;
      if (!(e.n >= 1 && e.n < e.m && e.m >= 3 && e.m <= 5 && e.n <= 3 && gcdRef(e.n, e.m) === 1)) fail(tag + ': outside the lesson range (a proper fraction n/m in simplest form, m 3..5, n ≤ 3 rows)');
      const Lo = D.shareLayout(e);
      if (Lo.pieces.length !== e.n * e.m || Lo.bars.length !== e.n || Lo.plates.length !== e.m) fail(tag + ': ' + Lo.pieces.length + ' pieces / ' + Lo.bars.length + ' bars / ' + Lo.plates.length + ' plates');
      if (Lo.H > 330) fail(tag + ': the board is ' + Lo.H + ' tall');
      const pr = Lo.pieces.map(c => cbox(c.cx, c.cy, c.w, c.h));
      pr.forEach((r, i) => {
        if (r.w < P || r.h < P) fail(tag + ': piece ' + i + ' is ' + r.w + '×' + r.h + ', under ' + P);
        if (!inBoard(r, Lo.H)) fail(tag + ': piece ' + i + ' sticks out of the board');
        for (let j = i + 1; j < pr.length; j++) if (overlap(r, pr[j])) fail(tag + ': pieces ' + i + ' and ' + j + ' overlap');
        if (!Lo.bars.some(b => r.x >= b.x && r.x + r.w <= b.x + b.w && r.y >= b.y && r.y + r.h <= b.y + b.h)) fail(tag + ': piece ' + i + ' is not inside its drawn bar');
      });
      /* 每一條巧克力切成 m 塊一樣大的：小塊等寬、剛好排滿那一條 */
      Lo.bars.forEach((b, r) => {
        const row = Lo.pieces.slice(r * e.m, (r + 1) * e.m);
        const cw = b.w / e.m;
        if (!row.every((c, j) => Math.abs(c.cx - (b.x + (j + 0.5) * cw)) < 0.01 && c.w === row[0].w)) fail(tag + ': bar ' + r + ' is not cut into ' + e.m + ' equal pieces');
      });
      const pl = Lo.plates;
      pl.forEach((p, j) => {
        if (!inBoard(p, Lo.H)) fail(tag + ': plate ' + j + ' sticks out of the board');
        if (p.w < P || p.h < P) fail(tag + ': plate ' + j + ' is smaller than ' + P);
        pr.forEach((r, i) => { if (overlap(r, { x:p.x - Q.pad, y:p.y - Q.pad, w:p.w + 2 * Q.pad, h:p.h + 2 * Q.pad })) fail(tag + ': piece ' + i + ' already sits in plate ' + j + '\'s drop zone'); });
        for (let i = 0; i < e.n; i++){
          const s = D.shareSpot(Lo, j, i), sr = cbox(s.cx, s.cy, s.w, s.h);
          if (!(sr.x >= p.x && sr.x + sr.w <= p.x + p.w && sr.y >= p.y + Q.lblH && sr.y + sr.h <= p.y + p.h)) fail(tag + ': dealt piece ' + i + ' of plate ' + j + ' is not inside the plate under its name');
          if (i > 0){ const s0 = D.shareSpot(Lo, j, i - 1); if (overlap(sr, cbox(s0.cx, s0.cy, s0.w, s0.h), -0.5)) fail(tag + ': dealt pieces ' + (i - 1) + ' and ' + i + ' of plate ' + j + ' overlap'); }
        }
        if (j > 0 && !(pl[j].x - (pl[j - 1].x + pl[j - 1].w) < 2 * Q.pad)) fail(tag + ': plates ' + (j - 1) + ' and ' + j + ' drop zones do not overlap — the nearest-plate rule is never exercised');
      });
      const seen = rowNearest(tag + ' plates', pl.map((p, j) => box(j, p.x + p.w / 2, p.y + p.h / 2, p.w, p.h)), Q.pad);
      if (seen === 0) fail(tag + ': no overlap point between plates was tested');
      /* 照規則：每一種計數狀態，shareOk 只收「最少的人」；照規則發完，每人剛好 n 塊 */
      /* 每一種計數（每人 0 ~ n 塊、還沒發完）都問一次每一個盤子（codex 第一輪：原本只走到第 6 塊） */
      let states = 0;
      (function every(c, i){
        if (i === e.m){
          if (c.reduce((a, b) => a + b, 0) >= e.n * e.m) return;
          states++;
          const min = Math.min(...c);
          c.forEach((x, j) => { const ok = D.shareOk(c, j); if (ok !== (x === min)) fail(tag + ': shareOk(' + c.join() + ', ' + j + ') = ' + ok); });
          return;
        }
        for (let v = 0; v <= e.n; v++){ c[i] = v; every(c, i + 1); }
      })(new Array(e.m).fill(0), 0);
      if (states !== Math.pow(e.n + 1, e.m) - 1) fail(tag + ': only ' + states + ' count states were checked');
      for (let t = 0; t < 200; t++){
        const c = new Array(e.m).fill(0);
        for (let k = 0; k < e.n * e.m; k++){ const ok = c.map((x, j) => j).filter(j => D.shareOk(c, j)); if (!ok.length){ fail(tag + ': stuck at ' + c.join()); break; } c[ok[Math.floor(Math.random() * ok.length)]]++; }
        if (!c.every(x => x === e.n)){ fail(tag + ': dealing by the rules ends at ' + c.join() + ', not ' + e.n + ' each'); break; }
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gAsks ' + L, d.gAsks.share(e.n, e.m), [e.n, e.m, e.m]);
        sayCheck(fail, tag + ' gShareNow ' + L, d.gShareNow(0, e.n * e.m), [0, e.n * e.m]);
        for (let has = 1; has <= e.n; has++) for (let min = 0; min < has; min++) sayCheck(fail, tag + ' gShareUnfair(' + has + ',' + min + ') ' + L, d.gShareUnfair(has, min), min === 0 ? [has] : [has, min]);
        for (let min = 0; min < e.n; min++) sayCheck(fail, tag + ' gShare2 ' + L, d.gShare2(min, e.n, e.m), [min, e.n * e.m, e.m, e.n]);
        sayCheck(fail, tag + ' gShareDone ' + L, d.gShareDone(e.n, e.m), e.n === 1 ? [1, 1, e.m, 1, e.m, 1, e.m] : [e.n, 1, e.m, e.n, e.m, e.n, e.m, e.n, e.m], 1);
        sayCheck(fail, tag + ' gPlate ' + L, d.gPlate(e.m), [e.m]);
        sayCheck(fail, tag + ' piece label ' + L, d.frac(1, e.m), [1, e.m]);
      });
    });
  }

  /* ---------- 5. 第 2 關：切細再分 ---------- */
  {
    const F = D.FINER_BAR, S = D.FINER_SLIDE;
    if (!(S.max >= 4 && S.max <= 6)) fail('finer: the slider goes to ' + S.max);
    const stops = [];
    for (let v = 1; v <= S.max; v++) stops.push(D.finerStopX(v));
    if (Math.abs(stops[0] - S.x0) > 1e-9 || Math.abs(stops[S.max - 1] - S.x1) > 1e-9) fail('finer: finerStopX() does not run from x0 to x1');
    for (let v = 1; v < S.max; v++) if (stops[v] - stops[v - 1] < 40) fail('finer: numbers ' + v + ' and ' + (v + 1) + ' are only ' + (stops[v] - stops[v - 1]).toFixed(1) + ' apart');
    /* finerSnap：每一個位置都停在畫得最近的那一個數字（自己量距離，不用頁面的算式） */
    let wrong = 0;
    for (let x = S.x0 - 60; x <= S.x1 + 60; x += 0.25){
      let best = 1, bd = Infinity;
      stops.forEach((sx, i) => { const dd = Math.abs(x - sx); if (dd < bd - 1e-9){ bd = dd; best = i + 1; } });
      const mid = stops.some((sx, i) => i > 0 && Math.abs(x - (stops[i - 1] + sx) / 2) < 1e-9);
      if (!mid && D.finerSnap(x) !== best) wrong++;
    }
    if (wrong) fail('finer: finerSnap() puts ' + wrong + ' positions on a number that is not the nearest one');
    const knob = cbox(S.x0, S.y, P, P), knobR = cbox(S.x1, S.y, P, P);
    if (!inBoard(knob, D.FINER_H) || !inBoard(knobR, D.FINER_H)) fail('finer: the ✂️ sticks out of the board at an end of the slider');
    if (!(S.tapTop <= S.y - P / 2 + 6 && S.tapBot >= S.lblY + 4 && S.tapTop > F.y + F.h)) fail('finer: the tap zone does not cover the track and the numbers (or reaches the bar)');
    if (!(S.capY + S.capH <= S.y - P / 2 && S.capY >= F.y + F.h)) fail('finer: the caption collides with the bar or the ✂️');
    if (!(F.x >= 0 && F.x + F.w <= BOARD_W && S.lblY + 4 <= D.FINER_H)) fail('finer: the bar or the numbers stick out of the board');
    D.GAME_FINER.forEach(e => {
      const tag = 'finer ' + e.a + '/' + e.b + ' ÷ ' + e.k;
      if (!(e.a >= 1 && e.a < e.b && e.b <= 6 && gcdRef(e.a, e.b) === 1 && e.k >= 2 && e.k <= S.max)) fail(tag + ': outside the lesson range (proper a/b in simplest form, b ≤ 6, 2 ≤ k ≤ the slider)');
      if (e.a % e.k === 0) fail(tag + ': the ' + e.a + ' shaded parts already split into ' + e.k + ' — the ask line ("cannot be shared out whole") would be false; that is the shortcut round');
      if (F.w / (e.b * S.max) < 7) fail(tag + ': at ' + S.max + ' pieces per part a cell is only ' + (F.w / (e.b * S.max)).toFixed(1) + 'px');
      let first = 0;
      for (let s = 1; s <= S.max; s++){
        const ok = (e.a * s) % e.k === 0;
        if (D.finerOk(e, s) !== ok) fail(tag + ': finerOk(' + s + ') = ' + D.finerOk(e, s));
        if (ok && !first) first = s;
        LANGS.forEach(L => {
          const d = I18N[L];
          sayCheck(fail, tag + ' gFinerNow(' + s + ') ' + L, d.gFinerNow(e.a, e.b, s), s === 1 ? [e.a, 1, e.b] : [s, e.a, s, e.a * s, 1, e.b * s], s === 1 ? 0 : 1);
          if (!ok) sayCheck(fail, tag + ' gFinerNo(' + s + ') ' + L, d.gFinerNo(e.a, s, e.k), [e.a * s, e.a * s, e.k, e.k, e.k]);
          else {
            const g = e.a * s / e.k, Dn = e.b * s, sm = simpRef(g, Dn);
            if (g * e.b * e.k !== e.a * Dn) fail(tag + ': at ' + s + ' the group ' + g + '/' + Dn + ' is not ' + e.a + '/' + e.b + ' ÷ ' + e.k);
            sayCheck(fail, tag + ' gFinerDone(' + s + ') ' + L, d.gFinerDone(e.a, e.b, e.k, s), [e.k, g, 1, Dn, e.a, e.b, e.k, g, Dn].concat(sm.n === g ? [] : [sm.n, sm.d]), 1);
          }
        });
      }
      if (!first || first < 2) fail(tag + ': no cut on the slider splits evenly (or no cut is needed)');
      if (!D.finerOk(e, e.k)) fail(tag + ': cutting every part into k does not split — the level-2 hint would be false');
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gAsks ' + L, d.gAsks.finer(e.a, e.b, e.k), [e.a, e.b, e.k, e.a, e.k, e.k]);
        sayCheck(fail, tag + ' gFiner2 ' + L, d.gFiner2(e.a, e.k), [e.k, e.a, e.k, e.a * e.k, e.k, e.a], 1);
        sayCheck(fail, tag + ' gHints ' + L, d.gHints.finer(e.a, e.b, e.k), [1, e.k]);
        sayCheck(fail, tag + ' button ' + L, d.gFinerBtn(e.k), [e.k]);
      });
    });
  }

  /* ---------- 6. 第 3 關：直接分組 ---------- */
  {
    const G = D.GROUP_BAR, Z = D.GROUP_GAP, Fc = D.GROUP_FENCE;
    if (Fc.w < P || Fc.h < P) fail('group: dividers smaller than ' + P);
    D.GAME_GROUP.forEach(e => {
      const tag = 'group ' + e.a + '/' + e.b + ' ÷ ' + e.k, q = e.a / e.k, need = e.k - 1;
      if (!(e.a >= 2 && e.a < e.b && e.b <= 10 && gcdRef(e.a, e.b) === 1 && e.k >= 2 && e.a % e.k === 0)) fail(tag + ': outside the lesson range (proper a/b in simplest form, b ≤ 10, k divides a)');
      if (need > 3) fail(tag + ': ' + need + ' dividers do not fit the tray');
      const cw = G.w / e.b;
      if (cw < 26) fail(tag + ': a part is only ' + cw.toFixed(1) + 'px wide');
      const trays = [];
      for (let f = 0; f < need; f++) trays.push(cbox(150 + (f - (need - 1) / 2) * Fc.step, Fc.y, Fc.w, Fc.h));
      trays.forEach((r, i) => { if (!inBoard(r, D.GROUP_H)) fail(tag + ': divider ' + i + ' sticks out'); trays.forEach((r2, j) => { if (j > i && overlap(r, r2)) fail(tag + ': dividers ' + i + ' and ' + j + ' overlap'); }); });
      const gaps = [];
      for (let g = 1; g < e.b; g++) gaps.push(box(g, G.x + g * cw, G.y - Z.top + Z.h / 2, cw, Z.h));
      gaps.forEach(t => {
        if (!(t.cy - t.hh <= G.y && t.cy + t.hh >= G.y + G.h + G.tick)) fail(tag + ': the zone of line ' + t.id + ' does not cover the bar and its tick');
        trays.forEach((r, i) => { if (overlap(r, { x:t.cx - t.hw - Z.pad, y:t.cy - t.hh - Z.pad, w:2 * (t.hw + Z.pad), h:2 * (t.hh + Z.pad) })) fail(tag + ': divider ' + i + ' already sits in the zone of line ' + t.id); });
      });
      rowNearest(tag + ' lines', gaps, Z.pad);
      if (e.b > 2 && !(Z.pad > 0)) fail(tag + ': line zones have no pad, the nearest rule is never exercised');
      /* 每一條線：自己判斷（白色那邊 / 分得不一樣多 / 收），收的剛好是 q 的倍數、剛好 k − 1 條 */
      const acc = [];
      for (let g = 1; g < e.b; g++){
        const want = g >= e.a ? 'out' : (g % q ? 'uneven' : null);
        if (D.groupJudge(e, g) !== want) fail(tag + ': groupJudge(line ' + g + ') = ' + D.groupJudge(e, g) + ', independently ' + want);
        if (want === null) acc.push(g);
        LANGS.forEach(L => {
          const d = I18N[L];
          if (want === 'out') sayCheck(fail, tag + ' gGroupOut ' + L, d.gGroupOut(e.a), [e.a]);
          if (want === 'uneven') sayCheck(fail, tag + ' gGroupUneven(' + g + ') ' + L, d.gGroupUneven(g, e.a, e.k), [g, e.a, e.k, e.a, e.k, q].concat(acc.length === need ? acc : D.groupStops(e)), 1);
        });
      }
      if (acc.length !== need || !sameList(acc, D.groupStops(e))) fail(tag + ': the accepted lines are ' + acc.join() + ', groupStops says ' + D.groupStops(e).join() + ' — ' + need + ' dividers needed');
      /* 分好之後每組一樣多：從 0、隔板、a 量出來 */
      const cuts = [0].concat(acc, [e.a]);
      if (!cuts.slice(1).every((c, i) => c - cuts[i] === q)) fail(tag + ': the groups are ' + cuts.slice(1).map((c, i) => c - cuts[i]).join() + ', not ' + q + ' each');
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gAsks ' + L, d.gAsks.group(e.a, e.b, e.k), [e.a, e.b, e.k, e.a, e.k, e.a, e.k]);
        for (let x = 0; x <= need; x++) sayCheck(fail, tag + ' gGroupNow ' + L, d.gGroupNow(e.a, e.b, e.k, x), [e.a, e.b, e.k, x, need]);
        for (let left = 1; left <= need; left++) sayCheck(fail, tag + ' gGroup2 ' + L, d.gGroup2(e.a, e.k, left), [e.a, e.k, q, q].concat(acc, [left]), 1);
        sayCheck(fail, tag + ' gGroupDone ' + L, d.gGroupDone(e.a, e.b, e.k), [q, 1, e.b, e.a, e.b, e.k, e.a, e.k, e.b, q, e.b], 1);
        sayCheck(fail, tag + ' gHints ' + L, d.gHints.group(e.a, e.b, e.k), [1, e.a, e.k]);
      });
    });
  }

  /* ---------- 7. 第 4 關：分子分母放哪裡 ---------- */
  {
    const X = D.BUILD_BOX, C = D.BUILD_CARD, Ex = D.BUILD_EXPR;
    const boxes = [box('num', X.x, X.yNum, X.w, X.h), box('den', X.x, X.yDen, X.w, X.h)];
    boxes.forEach(b => { if (!inBoard(cbox(b.cx, b.cy, X.w, X.h), D.BUILD_H)) fail('build: the ' + b.id + ' box sticks out'); });
    if (!(X.yNum < X.lineY && X.lineY < X.yDen && X.yNum + X.h / 2 < X.lineY && X.yDen - X.h / 2 > X.lineY)) fail('build: the fraction line is not between the two boxes');
    if (!(X.yDen - X.h / 2 - (X.yNum + X.h / 2) < 2 * X.pad)) fail('build: the two boxes\' zones do not overlap — the nearest-box rule is never exercised');
    rowNearest('build boxes', boxes, X.pad);
    if (!(Ex.x >= 0 && Ex.x + Ex.w <= X.x - X.w / 2 - 4 && inBoard(Ex, D.BUILD_H))) fail('build: the expression label runs into the boxes or out of the board');
    if (C.w < P || C.h < P) fail('build: cards smaller than ' + P);
    const cr = C.xs.map(x => cbox(x, C.y, C.w, C.h));
    cr.forEach((r, i) => {
      if (!inBoard(r, D.BUILD_H)) fail('build: card ' + i + ' sticks out');
      cr.forEach((r2, j) => { if (j > i && overlap(r, r2)) fail('build: cards ' + i + ' and ' + j + ' overlap'); });
      boxes.forEach(b => { if (overlap(r, { x:b.cx - b.hw - X.pad, y:b.cy - b.hh - X.pad, w:2 * (b.hw + X.pad), h:2 * (b.hh + X.pad) })) fail('build: card ' + i + ' already sits in the ' + b.id + ' box zone'); });
    });
    if (C.xs.length !== 5) fail('build: the tray has ' + C.xs.length + ' places for 5 cards');
    const ROLES = ['num', 'den', 'numk', 'same', 'plus'];
    ROLES.forEach(r => ['num', 'den'].forEach(p => { if (D.buildOk(r, p) !== (r === p)) fail('build: buildOk(' + r + ', ' + p + ') = ' + D.buildOk(r, p)); }));
    D.GAME_BUILD.forEach(e => {
      const tag = 'build ' + e.a + '/' + e.b + ' ÷ ' + e.k, bk = e.b * e.k;
      if (!(e.a >= 2 && e.a < e.b && e.b <= 7 && e.k >= 2 && e.k <= 4 && gcdRef(e.a, e.b) === 1)) fail(tag + ': outside the lesson range (a ≥ 2 so a × k is not k itself)');
      if (gcdRef(e.a, bk) !== 1) fail(tag + ': ' + e.a + '/' + bk + ' simplifies — then the boxes would have two right answers');
      const cards = D.buildCards(e), want = { num:e.a, den:bk, numk:e.a * e.k, same:e.b, plus:e.b + e.k };
      if (!sameList(cards.map(c => c.role), ROLES) || cards.some(c => c.v !== want[c.role])) fail(tag + ': buildCards() = ' + JSON.stringify(cards));
      const vs = cards.map(c => c.v);
      if (new Set(vs).size !== vs.length) fail(tag + ': two cards show the same number (' + vs.join() + ')');
      if (e.a * e.k === e.k || e.b + e.k === e.k) fail(tag + ': a card is just the divisor ' + e.k);
      /* 每一種「這張卡放進這一格」：只有分子 a 放上面、b × k 放下面收；兩格都放好時就是 a/(b × k) */
      let solved = 0;
      cards.forEach(c1 => cards.forEach(c2 => { if (c1 !== c2 && D.buildOk(c1.role, 'num') && D.buildOk(c2.role, 'den')){ solved++; if (c1.v * e.b * e.k !== e.a * c2.v || c1.v * bk !== e.a * c2.v) fail(tag + ': ' + c1.v + '/' + c2.v + ' is accepted but is not ' + e.a + '/' + e.b + ' ÷ ' + e.k); } }));
      if (solved !== 1) fail(tag + ': ' + solved + ' ways to fill the boxes are accepted');
      let front = 0;
      for (let t = 0; t < 2000; t++){
        const tr = D.buildTray(e);
        if (tr.slice().sort().join() !== '0,1,2,3,4'){ fail(tag + ': buildTray() is not a permutation: ' + tr.join()); break; }
        if (tr[0] === 0 && tr[1] === 1) front++;
      }
      if (front) fail(tag + ': the tray started with the answer order (numerator, denominator) ' + front + ' times in 2000');
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gAsks ' + L, d.gAsks.build(e.a, e.b, e.k), [e.a, e.b, e.k]);
        sayCheck(fail, tag + ' expr ' + L, d.frac(e.a, e.b), [e.a, e.b]);
        sayCheck(fail, tag + ' gBuildWhy num→den ' + L, d.gBuildWhy('num', 'den', e.a, e.b, e.k), [e.a, e.a]);
        sayCheck(fail, tag + ' gBuildWhy den→num ' + L, d.gBuildWhy('den', 'num', e.a, e.b, e.k), [e.b, e.k, bk, e.k, bk], 1);
        sayCheck(fail, tag + ' gBuildWhy numk→num ' + L, d.gBuildWhy('numk', 'num', e.a, e.b, e.k), [e.a * e.k, e.k, e.a, e.k, e.a * e.k, e.a, e.k, e.k], 1);
        sayCheck(fail, tag + ' gBuildWhy numk→den ' + L, d.gBuildWhy('numk', 'den', e.a, e.b, e.k), [e.a * e.k, e.a, e.a * e.k, 1, e.k, e.k, e.a, e.b, e.a * e.k, e.a, e.k, e.k, e.b, e.b, e.k, bk], 2);
        sayCheck(fail, tag + ' gBuildWhy same→den ' + L, d.gBuildWhy('same', 'den', e.a, e.b, e.k), [e.b, e.a, e.b, e.k, e.k]);
        sayCheck(fail, tag + ' gBuildWhy same→num ' + L, d.gBuildWhy('same', 'num', e.a, e.b, e.k), [e.b, e.a]);
        sayCheck(fail, tag + ' gBuildWhy plus→num ' + L, d.gBuildWhy('plus', 'num', e.a, e.b, e.k), [e.b + e.k, e.b, e.k, e.k, e.a, e.a]);
        sayCheck(fail, tag + ' gBuildWhy plus→den ' + L, d.gBuildWhy('plus', 'den', e.a, e.b, e.k), [e.b, e.k, e.b + e.k, e.k, e.a, e.b + e.k, e.k, e.k, e.k, e.b, e.k, bk], 2);
        sayCheck(fail, tag + ' gBuild2 ' + L, d.gBuild2(e.a, e.b, e.k), [e.a, e.b, e.k, bk], 1);
        sayCheck(fail, tag + ' gBuildDone ' + L, d.gBuildDone(e.a, e.b, e.k), [e.a, e.b, e.k, e.a, e.b, e.k, e.a, bk, e.k], 2);
        sayCheck(fail, tag + ' gBuildNow ' + L, d.gBuildNow(e.a, e.b, e.k, null, bk), [e.a, e.b, e.k, bk]);
      });
    });
  }

  /* ---------- 8. 第 5 關：找出一樣大的 ---------- */
  {
    const C = D.FIND_CARD;
    if (C.w < P || C.h < P) fail('find: cards smaller than ' + P);
    const cr = [];
    for (let s = 0; s < 8; s++) cr.push(cbox(C.xs[s % 2], C.ys[Math.floor(s / 2)], C.w, C.h));
    cr.forEach((r, i) => { if (!inBoard(r, D.FIND_H)) fail('find: card place ' + i + ' sticks out'); cr.forEach((r2, j) => { if (j > i && overlap(r, r2)) fail('find: card places ' + i + ' and ' + j + ' overlap'); }); });
    const ROLE_VAL = {   /* 每一張卡的值（自己算，不讀卡上的字） */
      recip:e => [e.a, e.b * e.k], raw:e => [e.a, e.b * e.k], simp:e => [e.a, e.b * e.k], double:e => [e.a, e.b * e.k],
      timesk:e => [e.a * e.k, e.b], plus:e => [e.a, e.b + e.k], same:e => [e.a, e.b], one:e => [1, e.b * e.k], add:e => [e.a * e.k + e.b, e.b * e.k]
    };
    D.GAME_FIND.forEach(e => {
      const tag = 'find ' + e.a + '/' + e.b + ' ÷ ' + e.k, bk = e.b * e.k;
      if (!(e.a >= 2 && e.a < e.b && e.b <= 7 && e.k >= 2 && e.k <= 4 && gcdRef(e.a, e.b) === 1)) fail(tag + ': outside the lesson range (a ≥ 2 so "one small piece" is not the answer)');
      const cards = D.findCards(e);
      if (cards.length !== 8) return fail(tag + ': ' + cards.length + ' cards');
      const okN = cards.filter(c => c.ok).length;
      if (okN !== 3) fail(tag + ': ' + okN + ' right cards, the ask says 3');
      cards.forEach((c, i) => {
        const v = parseOptVal(c.t), rv = ROLE_VAL[c.role] && ROLE_VAL[c.role](e);
        if (!v || !rv) return fail(tag + ': card "' + c.t + '" (' + c.role + ') cannot be read');
        if (v.n * rv[1] !== rv[0] * v.d) fail(tag + ': card "' + c.t + '" reads ' + v.n + '/' + v.d + ' but a ' + c.role + ' card is ' + rv.join('/'));
        if (sameVal(v, { n:e.a, d:bk }) !== c.ok) fail(tag + ': card "' + c.t + '" is marked ' + (c.ok ? 'right' : 'wrong') + ' but its value ' + (c.ok ? 'is not' : 'is') + ' ' + e.a + '/' + bk);
        cards.forEach((c2, j) => { if (j > i && !(c.ok && c2.ok)){ const v2 = parseOptVal(c2.t); if (v2 && sameVal(v, v2)) fail(tag + ': cards "' + c.t + '" and "' + c2.t + '" have the same value'); } });
        if (new Set(cards.map(x => x.t)).size !== 8) fail(tag + ': two cards show the same text');
      });
      if (!cards.slice(0, 3).every(c => c.ok) || cards.slice(3).some(c => c.ok)) fail(tag + ': the first three cards must be the right ones (findTray relies on it)');
      const third = cards[2];
      const s = simpRef(e.a, bk);
      if (third.role === 'simp' ? third.t !== s.n + '/' + s.d || (s.n === e.a) : third.t !== (2 * e.a) + '/' + (2 * bk) || s.n !== e.a) fail(tag + ': the third right card "' + third.t + '" is not the simplified (or, if already simplest, the doubled) fraction');
      let front = 0;
      for (let t = 0; t < 2000; t++){
        const tr = D.findTray(e);
        if (tr.slice().sort().join() !== '0,1,2,3,4,5,6,7'){ fail(tag + ': findTray() is not a permutation: ' + tr.join()); break; }
        if (tr[0] < 3 && tr[1] < 3 && tr[2] < 3) front++;
      }
      if (front) fail(tag + ': the three right cards came first ' + front + ' times in 2000');
      LANGS.forEach(L => {
        const d = I18N[L];
        sayCheck(fail, tag + ' gAsks ' + L, d.gAsks.find(e.a, e.b, e.k, 3), [e.a, e.b, e.k, 3]);
        cards.forEach(c => { if (!c.ok) sayCheck(fail, tag + ' gFindWhy ' + c.role + ' ' + L, d.gFindWhy(c.role, e.a, e.b, e.k), {
          timesk:[e.k, 1, e.k, e.k, e.a, e.b, e.k, e.a, e.b], plus:[e.a, e.b + e.k, e.k, e.k, e.k, e.a, bk], same:[e.a, e.b, e.k],
          one:[1, bk, e.a, e.a, bk], add:[e.k, 1, e.k, 1, e.k, e.a, e.b, 1, e.k, e.a, e.b] }[c.role]); });
        for (let left = 1; left <= 3; left++) sayCheck(fail, tag + ' gFind2 ' + L, d.gFind2(e.a, e.b, e.k, left), [e.a, e.b, e.k, e.a, bk, left], 1);
        const ts = cards.filter(c => c.ok).map(c => c.t);
        sayCheck(fail, tag + ' gFindDone ' + L, d.gFindDone(e.a, e.b, e.k, ts), [e.a, e.b, e.k].concat(nums(ts.join(' '))), 3);
        sayCheck(fail, tag + ' gHints ' + L, d.gHints.find(e.a, e.b, e.k), [1, e.k, 1, e.k]);
      });
      /* 每一句「比 a/b 還大」都要真的成立 */
      if (!(e.a * e.k / e.b > e.a / e.b && (e.a * e.k + e.b) / bk > e.a / e.b)) fail(tag + ': a "bigger than" claim in the reasons is false');
    });
  }
  /* 不是算式的比較（codex 第一輪：「3/8 比 3/4 大」數字和算式條數都一樣，fracArith 看不出來）：
     每一句講大小的話，用的詞要和自己算出來的大小一致 */
  const BIG = { zh:/還大/, en:/bigger than/ }, SMALL = { zh:/(比它小|小)/, en:/smaller than/ };
  LANGS.forEach(L => {
    const d = I18N[L];
    [[3, 5, 2], [2, 7, 3], [4, 5, 3]].forEach(([a, b, k]) => {
      ['timesk', 'add'].forEach(role => { if (!BIG[L].test(d.gFindWhy(role, a, b, k)) || /(小|smaller)/.test(d.gFindWhy(role, a, b, k))) fail('gFindWhy ' + role + ' ' + L + ' does not say the result is bigger: ' + d.gFindWhy(role, a, b, k)); });
      if (!SMALL[L].test(d.gFindWhy('same', a, b, k)) || /(大|bigger|larger)/.test(d.gFindWhy('same', a, b, k))) fail('gFindWhy same ' + L + ' does not say each share is smaller: ' + d.gFindWhy('same', a, b, k));
      /* 第 4 關的理由只講孩子真的做出來的那個分數（驗證員：分子那一格放 a×k 時分母可能已經是 b×k，「a×k/b 比較大」就不是畫面上的分數） */
      { const tn = d.gBuildWhy('numk', 'num', a, b, k), td = d.gBuildWhy('numk', 'den', a, b, k);
        if (!(L === 'zh' ? /分子不變/ : /numerator stays/).test(tn) || new RegExp('(^|[^\\d])' + (a * k) + '/' + b + '([^\\d]|$)').test(tn)) fail('gBuildWhy numk→num ' + L + ' talks about a fraction the child did not build, or does not say the numerator stays: ' + tn);
        if (!(L === 'zh' ? /不是把 \d+\/\d+ 平分/ : /not \d+\/\d+ shared/).test(td) || td.indexOf(a + '/' + (a * k)) < 0) fail('gBuildWhy numk→den ' + L + ' does not describe the fraction built (' + a + '/' + (a * k) + '): ' + td);
        ['num', 'den'].forEach(p => { const tp = d.gBuildWhy('plus', p, a, b, k); if ((p === 'num') === (tp.indexOf(a + '/' + (b + k)) >= 0)) fail('gBuildWhy plus→' + p + ' ' + L + ' describes the wrong fraction: ' + tp); }); }
      /* 平分之後每一份變小（codex 第二輪：分子那一句和第 4 關的提示也要守） */
      [['gBuildWhy num', d.gBuildWhy('num', 'den', a, b, k)], ['gHints.build', d.gHints.build(a, b, k)], ['gAsks.finer', d.gAsks.finer(a, b, k)]].forEach(([w, t]) => {
        if (w === 'gAsks.finer' && L === 'zh') return;   /* 中文那一句說「切成幾小格」，沒有比大小 */
        if (!(L === 'zh' ? /變小/ : /smaller/).test(t) || /(變大|bigger|larger)/.test(t)) fail(w + ' ' + L + ' does not say each share / piece gets smaller: ' + t);
      });
      const sd = d.gBuildWhy('same', 'den', a, b, k);
      if (!(L === 'zh' ? /一樣大/ : /just as big/).test(sd)) fail('gBuildWhy same ' + L + ' does not say a/b is as big as before sharing: ' + sd);
    });
    /* 範例 4 第三點：除以大於 1 的整數會變小 */
    if (!(L === 'zh' ? /3\/8 比 3\/4 小/ : /3\/8 is smaller than 3\/4/).test(d.f3p)) fail('f3p ' + L + ' does not say 3/8 is smaller than 3/4: ' + d.f3p);
    if (!(L === 'zh' ? /答案會變小/ : /makes it smaller/).test(d.f3h)) fail('f3h ' + L + ' does not say the answer gets smaller: ' + d.f3h);
    if (!(3 * 4 < 3 * 8)) fail('3/8 < 3/4 does not hold');
  });
  /* 第 1 關的提示、第 4 關的提示：不帶數字的只有第 1 關（一定要有字） */
  LANGS.forEach(L => {
    const d = I18N[L];
    if (!(d.gHints.share().length > 10)) fail('gHints.share ' + L + ' is empty');
    sayCheck(fail, 'gHints.build ' + L, d.gHints.build(3, 5, 2), [1]);
  });
}

/* ===================== 範例 1、2、3 的旁白 ===================== */
function checkExamples(I18N, fail, src){
  const fns = ['gcdFn', 'simplifyFrac'].map(n => extractFunction(src, n));
  if (fns.some(f => !f)) return fail('cannot cut the example helpers (gcdFn, simplifyFrac) out of index.html');
  let H;
  try { H = new Function(fns.join('\n') + '\nreturn { simplifyFrac:simplifyFrac };')(); }
  catch (e){ return fail('example helpers could not run: ' + e.message); }
  const read = name => { const m = src.match(new RegExp('var ' + name + ' = (\\[[^\\n]*\\]);')); try { return m ? new Function('return ' + m[1] + ';')() : null; } catch (e){ return null; } };
  const S1 = read('S1_COMBOS'), S2 = read('S2_COMBOS'), S3 = read('S3_COMBOS');
  if (!Array.isArray(S1) || !Array.isArray(S2) || !Array.isArray(S3)) return fail('cannot read S1_COMBOS / S2_COMBOS / S3_COMBOS');
  S1.forEach(c => {
    if (!(c.n < c.m && gcdRef(c.n, c.m) === 1)) fail('example 1: ' + c.n + ' ÷ ' + c.m + ' is not a proper fraction in simplest form');
    ['zh', 'en'].forEach(L => sayCheck(fail, 'example 1 s1Line(' + c.n + ',' + c.m + ') ' + L, I18N[L].s1Line(c.n, c.m), [c.n, c.m, c.n, c.m, c.n, c.m, c.n, c.m], 1));
  });
  S2.forEach(c => {
    const pd = c.den * c.k, s = simpRef(c.num, pd), hs = H.simplifyFrac(c.num, pd);
    if (hs.n !== s.n || hs.d !== s.d) fail('example 2: simplifyFrac(' + c.num + ', ' + pd + ') = ' + hs.n + '/' + hs.d);
    if (!(c.num < c.den)) fail('example 2: ' + JSON.stringify(c) + ' is not a proper fraction');
    ['zh', 'en'].forEach(L => {
      sayCheck(fail, 'example 2 s2CapB ' + JSON.stringify(c) + ' ' + L, I18N[L].s2CapB(c.num, c.den, c.k, s.n, s.d), null, 0);
      const t = I18N[L].s2CapB(c.num, c.den, c.k, s.n, s.d);
      if (nums(t).indexOf(c.num * c.k) < 0 || nums(t).indexOf(pd) < 0) fail('example 2 s2CapB ' + L + ' does not name ' + pd + ' pieces and ' + (c.num * c.k) + ' shaded: ' + t);
      sayCheck(fail, 'example 2 s2EqLine ' + JSON.stringify(c) + ' ' + L, I18N[L].s2EqLine(c.num, c.den, c.k, s.n, s.d), null, s.n === c.num ? 2 : 3);
    });
  });
  S3.forEach(c => {
    if (c.num % c.k !== 0) return fail('example 3: ' + c.num + ' is not divisible by ' + c.k + ' — the shortcut does not apply');
    const q = c.num / c.k, s = simpRef(c.num, c.den * c.k), hs = H.simplifyFrac(c.num, c.den * c.k);
    if (hs.n !== s.n || hs.d !== s.d) fail('example 3: simplifyFrac(' + c.num + ', ' + (c.den * c.k) + ') = ' + hs.n + '/' + hs.d);
    if (s.n !== q || s.d !== c.den) fail('example 3: ' + c.num + '/' + c.den + ' ÷ ' + c.k + ' simplifies to ' + s.n + '/' + s.d + ', not ' + q + '/' + c.den);
    ['zh', 'en'].forEach(L => {
      sayCheck(fail, 'example 3 s3Cap ' + L, I18N[L].s3Cap(c.num, c.den, c.k, q), [c.num, 1, c.den, c.k, q, 1, c.den, q, c.den]);
      sayCheck(fail, 'example 3 s3EqLine ' + L, I18N[L].s3EqLine(c.num, c.den, c.k, q, s.n, s.d), null, 4);
    });
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
    /* 表格的格子、段落之間補一個分隔號：不然相鄰兩格「1.5/2」「3/4 ÷ 2 = 3/8」會被讀成英文帶分數「2 3/4」 */
    const texts = [{ where:page + ' markup', text:stripScripts(html).replace(/<\/(td|th|li|p|div|h[1-6])>/gi, ' ； ') }];
    if (page === 'index'){ walkStrings(I18N, texts, 'index I18N'); }
    else {
      ['var I18N = ', 'var TXT = ', 'var T = ', 'var DICT = '].forEach(head => {
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
    });
    if (verified !== CLAIM_COUNTS[page]) fail(page + ': ' + verified + ' equations verified, pinned ' + CLAIM_COUNTS[page] + ' — a sentence was added or removed; re-read it and update CLAIM_COUNTS');
  });
}

const CURRENT = { file:null };
const CONFIG = {
  breaks: [
    {"file": "index", "expect": "shareOk(", "find": "function shareOk(counts, j){ return counts[j] === Math.min.apply(null, counts); }", "replace": "function shareOk(counts, j){ return counts[j] <= Math.min.apply(null, counts) + 1; }"},
    {"file": "index", "expect": "under 48", "find": "var SHARE_PIECE = { y0:8, h:52, gapY:8, maxW:62, cut:4 };", "replace": "var SHARE_PIECE = { y0:8, h:52, gapY:8, maxW:62, cut:10 };"},
    {"file": "index", "expect": "drop zones do not overlap", "find": "var SHARE_PLATE = { top:6, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:8, placedH:22 };", "replace": "var SHARE_PLATE = { top:6, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:2, placedH:22 };"},
    {"file": "index", "expect": "dealt pieces", "find": "var SHARE_PLATE = { top:6, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:8, placedH:22 };", "replace": "var SHARE_PLATE = { top:6, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:8, placedH:30 };"},
    {"file": "index", "expect": "already sits in plate", "find": "var SHARE_PLATE = { top:6, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:8, placedH:22 };", "replace": "var SHARE_PLATE = { top:-4, gap:6, maxW:84, lblH:24, stackH:24, padB:6, pad:8, placedH:22 };"},
    {"file": "index", "expect": "outside the lesson range", "find": "{ n:2, m:3 }, { n:3, m:4 }", "replace": "{ n:2, m:4 }, { n:3, m:4 }"},
    {"file": "index", "expect": "not inside the plate under its name", "find": "cy:p.y + Q.lblH + i * Q.stackH + Q.stackH / 2", "replace": "cy:p.y + i * Q.stackH + Q.stackH / 2"},
    {"file": "index", "expect": "is not cut into", "find": "pieces.push({ cx:x0 + (j + 0.5) * pw, cy:y + P.h / 2,", "replace": "pieces.push({ cx:x0 + (j + 0.5) * pw + (j === 1 ? 1 : 0), cy:y + P.h / 2,"},
    {"file": "index", "expect": "finerSnap() puts", "find": "var S = FINER_SLIDE, v = Math.round((x - S.x0) / ((S.x1 - S.x0) / (S.max - 1))) + 1;", "replace": "var S = FINER_SLIDE, v = Math.floor((x - S.x0) / ((S.x1 - S.x0) / (S.max - 1))) + 1;"},
    {"file": "index", "expect": "finerSnap() puts", "find": "return v < 1 ? 1 : (v > S.max ? S.max : v);", "replace": "return v < 1 ? 1 : v;"},
    {"file": "index", "expect": "finerOk(", "find": "function finerOk(e, s){ return (e.a * s) % e.k === 0; }", "replace": "function finerOk(e, s){ return (e.a * s) % e.k <= 1; }"},
    {"file": "index", "expect": "already split", "find": "{ a:2, b:5, k:3 }, { a:5, b:6, k:2 }, { a:1, b:3, k:2 }", "replace": "{ a:3, b:5, k:3 }, { a:5, b:6, k:2 }, { a:1, b:3, k:2 }"},
    {"file": "index", "expect": "tap zone does not cover", "find": "capY:96, capH:26, lblY:190, tapTop:118, tapBot:200, tapPad:22 };", "replace": "capY:96, capH:26, lblY:190, tapTop:118, tapBot:180, tapPad:22 };"},
    {"file": "index", "expect": "at an end of the slider", "find": "var FINER_SLIDE = { x0:40, x1:260,", "replace": "var FINER_SLIDE = { x0:40, x1:282,"},
    {"file": "index", "expect": "groupJudge(line", "find": "function groupJudge(e, g){ return g >= e.a ? 'out'", "replace": "function groupJudge(e, g){ return g > e.a ? 'out'"},
    {"file": "index", "expect": "the accepted lines are", "find": "function groupStops(e){ var q = e.a / e.k, s = []; for (var i = 1; i < e.k; i++) s.push(i * q); return s; }", "replace": "function groupStops(e){ var q = e.a / e.k, s = []; for (var i = 1; i <= e.k; i++) s.push(i * q); return s; }"},
    {"file": "index", "expect": "outside the lesson range", "find": "var GAME_GROUP = [ { a:6, b:7, k:3 },", "replace": "var GAME_GROUP = [ { a:6, b:7, k:4 },"},
    {"file": "index", "expect": "line zones have no pad", "find": "GROUP_GAP = { top:6, h:72, pad:4 };", "replace": "GROUP_GAP = { top:6, h:72, pad:0 };"},
    {"file": "index", "expect": "does not cover the bar and its tick", "find": "GROUP_GAP = { top:6, h:72, pad:4 };", "replace": "GROUP_GAP = { top:6, h:50, pad:4 };"},
    {"file": "index", "expect": "already sits in the zone of line", "find": "var GROUP_FENCE = { w:48, h:56, y:146,", "replace": "var GROUP_FENCE = { w:48, h:56, y:110,"},
    {"file": "index", "expect": "buildCards()", "find": "{ role:'plus', v:e.b + e.k } ];", "replace": "{ role:'plus', v:e.b + e.k + 1 } ];"},
    {"file": "index", "expect": "buildOk(", "find": "function buildOk(role, part){ return role === part; }", "replace": "function buildOk(role, part){ return role === part || role === 'same'; }"},
    {"file": "index", "expect": "answer order", "find": "    if (t[0] === 0 && t[1] === 1){ var x = t[1]; t[1] = t[2]; t[2] = x; }", "replace": ""},
    {"file": "index", "expect": "simplifies", "find": "{ a:3, b:5, k:2 }, { a:3, b:4, k:4 }", "replace": "{ a:3, b:5, k:2 }, { a:3, b:4, k:3 }"},
    {"file": "index", "expect": "zones do not overlap", "find": "yNum:38, yDen:110, lineY:74, pad:8 };", "replace": "yNum:38, yDen:110, lineY:74, pad:4 };"},
    {"file": "index", "expect": "already sits in the den box zone", "find": "var BUILD_CARD = { w:52, h:52, y:186,", "replace": "var BUILD_CARD = { w:52, h:52, y:166,"},
    {"file": "index", "expect": "reads", "find": "{ t:same ? (2 * e.a) + '/' + (2 * bk) : s,", "replace": "{ t:same ? (3 * e.a) + '/' + (2 * bk) : s,"},
    {"file": "index", "expect": "came first", "find": "    if (t[0] < 3 && t[1] < 3 && t[2] < 3){ var x = t[2]; t[2] = t[3]; t[3] = x; }", "replace": ""},
    {"file": "index", "expect": "is marked wrong", "find": "{ t:e.a + '/' + (e.b + e.k), role:'plus', ok:false },", "replace": "{ t:e.a + '/' + (e.b * e.k + e.b * e.k - e.b * e.k), role:'plus', ok:false },"},
    {"file": "index", "expect": "outside the lesson range", "find": "var GAME_FIND = [ { a:2, b:3, k:2 },", "replace": "var GAME_FIND = [ { a:1, b:3, k:2 },"},
    {"file": "index", "expect": "cards smaller than", "find": "var FIND_H = 236, FIND_CARD = { w:132, h:50,", "replace": "var FIND_H = 236, FIND_CARD = { w:132, h:40,"},
    {"file": "index", "expect": "card places", "find": "ys:[30, 88, 146, 204] };", "replace": "ys:[30, 70, 146, 204] };"},
    {"file": "index", "expect": "ascending order", "find": "    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }", "replace": ""},
    {"file": "index", "expect": "nearestOpen()", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (!best){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "nearestOpen()", "find": "      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;", "replace": "      var dd = dx * dx + dy * dy, dc = dd;"},
    {"file": "index", "expect": "skips it", "find": "    return best && !best.done ? best : null;", "replace": "    return best;"},
    {"file": "index", "expect": "shown although nothing was taken", "find": "    var lost = gScore >= 5 ? 5 : 0;", "replace": "    var lost = 5;"},
    {"file": "index", "expect": "does not cost 5", "find": "    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", "replace": "    gScore = Math.max(0, gScore - 10); elScore.textContent = gScore;"},
    {"file": "index", "expect": "gives", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = gMistake ? 15 : 20;"},
    {"file": "index", "expect": "leaves the hint showing", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "record the mistake", "find": "    gMistake = true; gAnyMistake = true;", "replace": "    gMistake = true;"},
    {"file": "index", "expect": "told the run was", "find": "L().gWin(gScore, !gAnyMistake)", "replace": "L().gWin(gScore, gAnyMistake)"},
    {"file": "index", "expect": "no board-generation guard", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", "replace": ""},
    {"file": "index", "expect": "second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "lost pointer capture", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "no document-level release", "find": "      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });", "replace": "      document.addEventListener('pointercancel', onDocEnd);\n    });"},
    {"file": "index", "expect": "ahead mode", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", "replace": "    if (false){ hintLevel = 1; showHint(); }"},
    {"file": "index", "expect": "placed pieces", "find": "  .gpiece.locked{cursor:default;pointer-events:none}", "replace": "  .gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "touch-action", "find": "    touch-action:none;cursor:grab;", "replace": "    cursor:grab;"},
    {"file": "index", "expect": "still held", "find": "        if (gSolved || knob.busy()) return;   /* ✂️ 還拿在手上", "replace": "        if (gSolved) return;   /* ✂️ 還拿在手上"},
    {"file": "index", "expect": "costs again", "find": "          if (told[s]){ roundNote(d.gFinerNo(e.a, s, e.k)); return; }", "replace": "          if (false){ roundNote(d.gFinerNo(e.a, s, e.k)); return; }"},
    {"file": "index", "expect": "does not snap", "find": "snap:function(x){ return finerStopX(finerSnap(x)); },", "replace": "snap:function(x){ return x; },"},
    {"file": "index", "expect": "onPlace", "find": "          if (v !== s){ s = v; draw(); refreshHint(); }", "replace": "          if (v !== s){ draw(); refreshHint(); }"},
    {"file": "index", "expect": "a tap on a number", "find": "        knob.rehome(finerStopX(finerSnap(pt.x)), S.y);\n      };", "replace": "        knob.rehome(finerStopX(1), S.y);\n      };"},
    {"file": "index", "expect": "fair dealing", "find": "        if (!shareOk(c, t.j)){ roundMiss(d.gShareUnfair(c[t.j], Math.min.apply(null, c))); return false; }", "replace": "        if (false){ roundMiss(d.gShareUnfair(c[t.j], Math.min.apply(null, c))); return false; }"},
    {"file": "index", "expect": "groupJudge() with its reason", "find": "        if (j === 'out'){ roundMiss(d.gGroupOut(e.a)); return false; }", "replace": "        if (false){ roundMiss(d.gGroupOut(e.a)); return false; }"},
    {"file": "index", "expect": "buildOk() with its reason", "find": "        if (!buildOk(P.data.role, t.part)){", "replace": "        if (false){"},
    {"file": "index", "expect": "locked after one tap", "find": "        P.lock(P.homeX, P.homeY);\n        if (!c.ok){", "replace": "        if (!c.ok){"},
    {"file": "index", "expect": "gShareDone", "find": "' —— ' + n + ' ÷ ' + m + ' = ' + n + '/' + m + '。'; },", "replace": "' —— ' + n + ' ÷ ' + m + ' = ' + m + '/' + n + '。'; },"},
    {"file": "index", "expect": "gFinerDone", "find": "return 'Split into ' + k + ' groups of ' + g + ' '", "replace": "return 'Split into ' + k + ' groups of ' + (g + 1) + ' '"},
    {"file": "index", "expect": "gGroupUneven", "find": "a + ' ÷ ' + k + ' = ' + q + ' 格，隔板只能放在第 '", "replace": "a + ' ÷ ' + k + ' = ' + (q + 1) + ' 格，隔板只能放在第 '"},
    {"file": "index", "expect": "gBuildWhy numk→num", "find": "' (' + a + ' × ' + k + ' = ' + (a * k) + '): after sharing", "replace": "' (' + a + ' × ' + k + ' = ' + (a + k) + '): after sharing"},
    {"file": "index", "expect": "gFindWhy plus", "find": "if (role === 'plus') return a + '/' + (b + k) + ' 是把分母加了 '", "replace": "if (role === 'plus') return a + '/' + (b * k) + ' 是把分母加了 '"},
    {"file": "index", "expect": "prints \"1 pieces\"", "find": "'This person already has ' + has + ' ' + plural(has, 'piece', 'pieces')", "replace": "'This person already has ' + has + ' pieces'"},
    {"file": "index", "expect": "is/are", "find": "return 'There ' + plural(N, 'is', 'are') + ' ' + N + ' shaded '", "replace": "return 'There are ' + N + ' shaded '"},
    {"file": "index", "expect": "gAsks", "find": "可是塗色的 ' + a + ' 格不能整格分成一樣多的 ' + k + ' 組。", "replace": "可是塗色的格子不能整格分成一樣多的 ' + k + ' 組。"},
    {"file": "index", "expect": "s6lead", "find": "      s6lead: '五關五種玩法：把小塊輪流發給每一個人、把每一格切細再平分、用隔板直接分組、把數字卡放進分子和分母、點出所有一樣大的算式。放錯扣 5 分（最低 0 分），但遊戲不會結束。',", "replace": "      s6lead: '五關五種玩法：把小塊輪流發給每一個人、把每一格切細再平分、用隔板直接分組、把數字卡放進分子和分母、點出所有一樣大的算式。放錯扣 10 分（最低 0 分），但遊戲不會結束。',"},
    {"file": "index", "expect": "clean run is still told", "find": "('All five rounds cleared without a single wrong move! Final score: ' + s + ' 🏆')", "replace": "('All five rounds cleared without a single wrong move! Final score: ' + s + ' 🏆 Press “Restart” to play again.')"},
    {"file": "index", "expect": "a digit glued to Chinese", "find": "gShareNow: function(x, t){ return '發了 ' + x + ' / ' + t + ' 小塊'; },", "replace": "gShareNow: function(x, t){ return '發了 ' + x + ' / ' + t + '小塊'; },"},
    {"file": "index", "expect": "example 3 s3EqLine", "find": "' = ' + gn + '/' + gd + ' = ' + q + '/' + den + ' ✓ 一樣！';", "replace": "' = ' + gn + '/' + gd + ' = ' + q + '/' + (den + 1) + ' ✓ 一樣！';"},
    {"file": "index", "expect": "example 3", "find": "var S3_COMBOS = [ {num:6,den:7,k:3},", "replace": "var S3_COMBOS = [ {num:6,den:7,k:4},"},
    {"file": "index", "expect": "example 1", "find": "var S1_COMBOS = [ {n:1,m:2}, {n:2,m:3},", "replace": "var S1_COMBOS = [ {n:2,m:2}, {n:2,m:3},"},
    {"file": "index", "expect": "this claim is wrong", "find": "      f1p: '3/4 ÷ 2 = 3/(4×2) = 3/8，分子 3 不變。", "replace": "      f1p: '3/4 ÷ 2 = 3/(4×2) = 3/6，分子 3 不變。"},
    {"file": "index", "expect": "equations verified, pinned", "find": "      f3p: '3/4 平分成 2 份，每份一定比 3/4 小：3/8 比 3/4 小。", "replace": "      f3p: '3/4 平分成 2 份，每份一定比 3/4 小：3/4 ÷ 2 = 3/8，比 3/4 小。"},
    {"file": "reference", "expect": "this claim is wrong", "find": "ex2:'例：3/4 ÷ 2 = 3/(4×2) = 3/8。", "replace": "ex2:'例：3/4 ÷ 2 = 3/(4×2) = 3/6。", "via": "index"},
    {"file": "parents", "expect": "this claim is wrong", "find": "s3a2p:'量米或量水時，量出半杯（1/2），問孩子「如果這半杯要平分給 3 個杯子，每杯裝多少？」帶孩子推導 1/2÷3=1/6。',", "replace": "s3a2p:'量米或量水時，量出半杯（1/2），問孩子「如果這半杯要平分給 3 個杯子，每杯裝多少？」帶孩子推導 1/2÷3=1/5。',", "via": "index"},
    {"file": "review", "expect": "has the value of a number printed in the stem", "find": "      for (var i = 0; i < seen.length; i++) if (c[0] * seen[i][1] === seen[i][0] * c[1]) return;", "replace": "      for (var i = 0; i < seen.length; i++) if (c[0] === seen[i][0] && c[1] === seen[i][1]) return;", "via": "index"},
    {"file": "review", "expect": "number string printed in the stem", "find": "        String(dividend).split('.').forEach(function(part){ seen[part] = true; });", "replace": "", "via": "index"},
    {"file": "review", "expect": "has the value of a number printed in the stem", "find": "        seen[String(k)] = true; seen[String(dividend)] = true;", "replace": "", "via": "index"},
    {"file": "review", "expect": "outside this generator's range", "find": "if (a % kk !== 0 && gcdFn(a, den) === 1 && kk % den !== 0) pairs.push([a, kk]);", "replace": "if (a % kk !== 0 && gcdFn(a, den) === 1) pairs.push([a, kk]);", "via": "index"},
    {"file": "review", "expect": "outside this generator's range", "find": "        for (var i = 2; i < m; i++){ if (gcdFn(i, m) === 1) cands.push(i); }", "replace": "        for (var i = 1; i < m; i++){ if (gcdFn(i, m) === 1) cands.push(i); }", "via": "index"},
    {"file": "review", "expect": "matches no named misconception", "find": "[[d.m, d.n], [1, d.m], [1, d.n * d.m], [d.n, d.n + d.m]]", "replace": "[[d.m, d.n], [1, d.m], [1, d.n * d.m + 1], [d.n, d.n + d.m]]", "via": "index"},
    {"file": "review", "expect": "the pool is", "find": "var den = pickUnused([5,7,8,9,10], used);   /* 4 和 6", "replace": "var den = pickUnused([5,7,9,8,10], used);   /* 4 和 6", "via": "index"},
    {"file": "review", "expect": "mid", "find": "mid: a + '/' + (b*k1) };", "replace": "mid: a + '/' + (b*k2) };", "via": "index"},
    {"file": "review", "expect": "why:", "find": "' + d.c + '/' + d.dd + ' = ' + d.pn + '/' + d.pd + (reduced ? '。' : '，約分後是 ' + d.sn + '/' + d.sd + '。')", "replace": "' + d.c + '/' + d.dd + ' = ' + d.pn + '/' + (d.pd + 1) + (reduced ? '。' : '，約分後是 ' + d.sn + '/' + d.sd + '。')", "via": "index"},
    {"file": "review", "expect": "matches no named misconception", "find": "[String(qt), String(qt / 100), String(round1(q + 0.1)), String(round1(q - 0.1))]", "replace": "[String(round1(q * 2)), String(qt / 100), String(round1(q + 0.1)), String(round1(q - 0.1))]", "via": "index"},
    {"file": "review", "expect": "have the same value", "find": "var k = pick([2,3,4,5].filter(function(x){ return den !== num * x * (x - 1); }));", "replace": "var k = pick([2,3,4,5]);", "via": "index"},
        {"file": "review", "expect": "generators are", "find": "{ id:'wordShare', cat:'fdiv',", "replace": "{ id:'wordShare2', cat:'fdiv',", "via": "index"},
    {"file": "review", "expect": "kept", "find": "var simp = simplifyFrac(total, people);", "replace": "var simp = { n: total, d: people };", "via": "index"},
    {"file": "review", "expect": "can produce", "find": "for (var a = 1; a < den; a++) [2,3,4].forEach(function(kk){", "replace": "for (var a = 1; a < den; a++) [2,3].forEach(function(kk){", "via": "index"},
    {"file": "review", "expect": "the named misconceptions ran out", "find": "[[d.a, d.b * d.k1], [d.a, d.b * (d.k1 + d.k2)], [d.a * d.k1 * d.k2, d.b], [d.a, d.b * d.k2], [d.a, d.b + d.k1 + d.k2], [1, d.pd]]", "replace": "[[d.a, d.b * d.k1], [d.a, d.b * (d.k1 + d.k2)]]", "via": "index"},
    {"file": "review", "expect": "above", "find": "var k1 = pick([2,3,4]);", "replace": "var k1 = pick([2,3,4]) * 3;", "via": "index"},
    {"file": "index", "expect": "does not report every position change to onPlace", "find": "      if (o.onPlace) o.onPlace(P);\n    };", "replace": "    };"},
    {"file": "index", "expect": "is not a free reminder", "find": "  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", "replace": "  function roundNote(text){ roundMiss(text); }"},
    {"file": "index", "expect": "shareOk(", "find": "function shareOk(counts, j){ return counts[j] === Math.min.apply(null, counts); }", "replace": "function shareOk(counts, j){ var t = counts.reduce(function(a, b){ return a + b; }, 0); return counts[j] === Math.min.apply(null, counts) || (counts.length === 5 && t === 7); }"},
    {"file": "index", "expect": "does not say 3/8 is smaller", "find": "f3p: '3/4 平分成 2 份，每份一定比 3/4 小：3/8 比 3/4 小。", "replace": "f3p: '3/4 平分成 2 份，每份一定比 3/4 小：3/8 比 3/4 大。"},
    {"file": "index", "expect": "gFindWhy same en", "find": "' is the amount before sharing; each of the ' + k + ' shares is smaller than that.'", "replace": "' is the amount before sharing; each of the ' + k + ' shares is larger than that.'"},
    {"file": "index", "expect": "talks about a fraction the child did not build", "find": "'）：平分之後還是 ' + a + ' 份，分子不變；要乘 '", "replace": "'）：' + (a * k) + '/' + b + ' 比 ' + a + '/' + b + ' 還大，分子不變；要乘 '"},
    {"file": "review", "expect": "outside this generator's range", "find": "if (x !== a && gcdFn(x, den) === 1) cs.push(x);", "replace": "if (x !== a) cs.push(x);", "via": "index"},
    {"file": "index", "expect": "gBuildWhy num zh", "find": "' 份，只是每一份變小了 —— 分數線下面要放切細之後的分母。'", "replace": "' 份，只是每一份變大了 —— 分數線下面要放切細之後的分母。'"},
    {"file": "index", "expect": "gBuildWhy num en", "find": "' ' + plural(a, 'part', 'parts') + ', each just smaller — the box under the line needs the finer denominator.'", "replace": "' ' + plural(a, 'part', 'parts') + ', each just bigger — the box under the line needs the finer denominator.'"},
    {"file": "index", "expect": "gHints.build en", "find": "'Hint 1: after sharing, each share is smaller.", "replace": "'Hint 1: after sharing, each share is larger."},
    {"file": "index", "expect": "does not describe the fraction built", "find": "' 放在分母的話是 ' + a + '/' + (a * k) + ' = 1/' + k + '，那是把一整塊平分成 '", "replace": "' 放在分母的話是 ' + (a * k) + '/' + b + ' = ' + (a * k) + '/' + b + '，那是把一整塊平分成 '"},
    {"file": "index", "expect": "describes the wrong fraction", "find": "' to it (' + a + '/' + (b + k) + '). Sharing into '", "replace": "' to it. Sharing into '"},
    {"file": "index", "expect": "more than 6px", "find": "      if (!moved && dx * dx + dy * dy > 36){", "replace": "      if (!moved && dx * dx + dy * dy > 0){"},
    {"file": "index", "expect": "second finger tapping the board", "find": "      if (!e.isPrimary) return;   /* 第二根手指：不理 */\n      BOARD_TAP", "replace": "      BOARD_TAP"},
    {"file": "index", "expect": "wandered away", "find": "      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", "replace": ""},
    {"file": "index", "expect": "skips it", "find": "    list.forEach(function(b){\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;", "replace": "    list.forEach(function(b){\n      if (b.done) return;\n      var dx = pt.x - b.cx, dy = pt.y - b.cy;"}
  ],

  sim: {
    INVARIANTS: INVARIANTS,
    expectedCorrect: function(d, id){ return expectedCorrectRef(d, id); },
    optionOk: optionOk,
    renderCheck: renderCheck
  },

  data: {
    dataStart: '  /* ---- 小遊戲「巧克力大平分」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, GAME_ORDER, shuffle, pick, gcd, simpFr, plural, enList, ' +
                'SHARE_PIECE, SHARE_PLATE, GAME_SHARE, shareLayout, shareSpot, shareOk, ' +
                'FINER_H, FINER_BAR, FINER_SLIDE, GAME_FINER, finerStopX, finerSnap, finerOk, ' +
                'GROUP_H, GROUP_BAR, GROUP_GAP, GROUP_FENCE, GAME_GROUP, groupJudge, groupStops, ' +
                'BUILD_H, BUILD_EXPR, BUILD_BOX, BUILD_CARD, GAME_BUILD, buildCards, buildOk, buildTray, ' +
                'FIND_H, FIND_CARD, GAME_FIND, findCards, findTray}',
    check: function(data, I18N, fail, src){
      CURRENT.file = process.argv[2] ? path.resolve(process.argv[2]) : null;
      for (let a = 1; a <= 60; a++) for (let b = 1; b <= 60; b++){
        if (data.gcd(a, b) !== gcdRef(a, b)) { fail('gcd(' + a + ', ' + b + ') = ' + data.gcd(a, b)); return; }
        if (data.simpFr(a, b) !== simpRef(a, b).n + '/' + simpRef(a, b).d) { fail('simpFr(' + a + ', ' + b + ') = ' + data.simpFr(a, b)); return; }
      }
      if (data.enList([2]) !== '2' || data.enList([2, 4]) !== '2 and 4' || data.enList([2, 4, 6]) !== '2, 4 and 6') fail('enList() does not write an English list');
      if (data.plural(1, 'a', 'b') !== 'a' || data.plural(2, 'a', 'b') !== 'b' || data.plural(0, 'a', 'b') !== 'b') fail('plural() is wrong');
      checkGame(data, I18N, fail, src);
      checkExamples(I18N, fail, src);
      checkClaims(I18N, fail, src);
      try { checkReviewAll(fail, fs.readFileSync(path.join(path.dirname(CURRENT.file), 'review.html'), 'utf8')); }
      catch (e){ fail('cannot read review.html next to index.html: ' + e.message); }
    }
  }
};

module.exports = CONFIG;
