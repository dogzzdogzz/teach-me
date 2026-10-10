/* grade-5/math/weight 的檢查設定（大力士磅秤：認識公噸、公噸 ↔ 公斤 ↔ 公克、化聚、卡車載重）。
   2026-10-10 新增 —— 和小遊戲「載重過磅」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔，
   simgen／verify_lesson_data／breaktest 對這一課一直是「找不到設定」。

   算式驗算：這一課的句子同時有單位換算（「2 公噸 ＝ 2000 公斤」）、小數（「1.2 ＋ 0.4 ＝ 1.6 公噸」）、
   商餘（「4600 ÷ 1000 ＝ 4 餘 600」）與「公噸數 × 1000 ＝ 公斤數」（換算階梯）。lib/arith.js 不收小數、lib/decarith.js 不認得單位，
   所以這裡有一份這一課自己的驗算器 weightClaims()：
     - 每一個量都帶著單位換成公斤（精確有理數），「2 公噸 80 公斤」先合成一個量；
     - 沒有單位的那一邊沿用同一條算式裡最近的那個單位（「1.2 ＋ 0.4 ＝ 1.6 公噸」的左邊是公噸）；
     - 「3 公噸 × 1000 ＝ 3000 公斤」這種階梯句另外驗：數字真的乘得對，而且 × 1000 一定是往小一階的單位、÷ 1000 往大一階；
     - 「餘」：被除數 ＝ 除數 × 商 ＋ 餘數，而且餘數比除數小；
     - 「＜」串：真的由小到大；
     - 沒被任何一條算式吃掉、兩邊又貼著數字的等號一律報錯（fail closed）。
   驗算器自己先跑正反例（CLAIM_PROBES），驗過的條數與指紋都釘住。

   sim（review.html 的九個產生器）：每個產生器一組不變條件、正解的第二套實作（自己的小數字串與「幾公噸幾公斤」）、
   選項的形狀與範圍，renderCheck 把題幹與解釋的算式交給 weightClaims()。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）與範例的句子函式（換算階梯、化聚兩邊、卡車檢查站、秤重大冒險）逐條驗算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍（每一樣東西 × 每一個箱子、每一題的每一個小數點位置、每一格 × 每一張數字卡、
     每一車貨的每一種裝法、每一張重量卡 × 每一格），證明一定解得完、解完一定是對的；
     每一句說明兩種語言逐條驗算，而且它說的那件事要真的成立（說「不到 1」就真的 < 1、說「數字變大了」就真的變大……）；
     shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-weight 的端對端測試驗（合成 PointerEvent）。 */

const crypto = require('crypto');
const { extractFunction } = require('./lib/gameshuffle.js');

/* ---------- 精確有理數 ---------- */
function gcd(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a || 1; }
function rat(n, d){ if (!d) return null; const s = d < 0 ? -1 : 1, g = gcd(n, d); return { n:s * n / g, d:s * d / g }; }
function ratOf(str){ const m = /^(\d+)(?:\.(\d+))?$/.exec(str); if (!m) return null; const f = m[2] || '', sc = Math.pow(10, f.length); return rat(Number(m[1]) * sc + Number(f || 0), sc); }
const rAdd = (a, b) => a && b ? rat(a.n * b.d + b.n * a.d, a.d * b.d) : null;
const rSub = (a, b) => a && b ? rat(a.n * b.d - b.n * a.d, a.d * b.d) : null;
const rMul = (a, b) => a && b ? rat(a.n * b.n, a.d * b.d) : null;
const rDiv = (a, b) => a && b && b.n ? rat(a.n * b.d, a.d * b.n) : null;
const rCmp = (a, b) => a.n * b.d - b.n * a.d;
const KG = { t:rat(1000, 1), kg:rat(1, 1), g:rat(1, 1000) };
const LVL = { g:0, kg:1, t:2 };
const UMAP = { '公噸':'t', '公斤':'kg', '公克':'g', t:'t', kg:'kg', g:'g' };

/* ---------- 這一課的算式驗算器 ---------- */
const NUM = '\\d+(?:\\.\\d+)?', U = '(?:公噸|公斤|公克|t(?![A-Za-z])|kg(?![A-Za-z])|g(?![A-Za-z]))', QM = '[?？□]';
const TERM = '(?:' + NUM + '(?:\\s*' + U + '(?:\\s+' + NUM + '\\s*' + U + ')?)?|' + QM + '(?:\\s*' + U + ')?)';
const CHAIN_RE = new RegExp('(?<![\\d.])' + TERM + '(?:\\s*(?:[×÷+\\-]|[=<])\\s*' + TERM + ')+(?:\\s*(?:餘|remainder)\\s*' + NUM + '(?:\\s*' + U + ')?)?', 'g');
const TERM_RE = new RegExp('^(' + NUM + ')(?:\\s*(' + U + ')(?:\\s+(' + NUM + ')\\s*(' + U + '))?)?$');
const CLAIMS_SEEN = [];
function normClaims(text){
  return String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/＜/g, '<')
    .replace(/(\d)\s*(tonnes?)(?![A-Za-z])/g, '$1 t').replace(/(\d)\s*(kilograms?)(?![A-Za-z])/g, '$1 kg').replace(/(\d)\s*(grams?)(?![A-Za-z])/g, '$1 g')
    .replace(/=\s*商\s*/g, '= ');
}
function parseTerm(s){
  s = s.trim();
  if (new RegExp('^' + QM).test(s)) return { q:true };
  const m = TERM_RE.exec(s);
  if (!m) return null;
  const v = ratOf(m[1]);
  if (!m[2]) return { v:v, u:null, raw:m[1] };
  const u1 = UMAP[m[2]];
  if (!m[3]) return { v:rMul(v, KG[u1]), u:u1, raw:m[1], num:v };
  const u2 = UMAP[m[4]];
  if (!(u1 === 't' && u2 === 'kg' || u1 === 'kg' && u2 === 'g')) return { bad:'a compound "' + s + '" is not "big unit + the next unit"' };
  const v2 = ratOf(m[3]);
  if (v2.n === 0) return { bad:'a compound "' + s + '" with 0 of the small unit — write it as one unit' };
  if (rCmp(v2, rat(1000, 1)) >= 0) return { bad:'a compound "' + s + '" has 1000 or more of the small unit' };
  return { v:rAdd(rMul(v, KG[u1]), rMul(v2, KG[u2])), u:u2, raw:s, compound:true };
}
function weightClaims(text){
  const problems = [];
  let verified = 0, questions = 0;
  const t = normClaims(text);
  const rest = t.replace(CHAIN_RE, whole => {
    if (!/[=<]/.test(whole)) return whole;
    let body = whole, remainder = null, remU = null;
    const rm = body.match(new RegExp('\\s*(?:餘|remainder)\\s*(' + NUM + ')(?:\\s*(' + U + '))?$'));
    if (rm){ remainder = ratOf(rm[1]); remU = rm[2] ? UMAP[rm[2]] : null; body = body.slice(0, rm.index); }
    /* 切成「項」與「運算子／關係」：數字後面可能跟著單位、甚至「2 公噸 80 公斤」 */
    const parts = [], re = new RegExp('(' + TERM + ')|([×÷+\\-])|([=<])', 'g');
    let m, last = 0, broken = false;
    while ((m = re.exec(body))){
      if (body.slice(last, m.index).trim()) broken = true;
      parts.push(m[1] !== undefined ? { term:m[1] } : m[2] !== undefined ? { op:m[2] } : { rel:m[3] });
      last = m.index + m[0].length;
    }
    if (broken || body.slice(last).trim()){ problems.push('cannot read the equation "' + whole.trim() + '"'); return ' Q '; }
    const sides = [[]], rels = [];
    parts.forEach(p => { if (p.rel){ rels.push(p.rel); sides.push([]); } else sides[sides.length - 1].push(p); });
    const S = sides.map(side => {
      const terms = [], ops = [];
      side.forEach((p, i) => { if (i % 2 === 0){ if (!p.term){ terms.push({ bad:'an operator where a number belongs' }); } else terms.push(parseTerm(p.term) || { bad:'cannot read "' + p.term + '"' }); } else ops.push(p.op); });
      if (side.length % 2 === 0) terms.push({ bad:'a dangling operator' });
      return { terms, ops };
    });
    for (const s of S) for (const x of s.terms) if (x.bad){ problems.push(x.bad + ' in "' + whole.trim() + '"'); return ' Q '; }
    if (S.some(s => s.terms.some(x => x.q))){ questions += rels.length; return ' Q '; }
    /* 「餘」：只收「a ÷ b ＝ q 餘 r」 */
    if (remainder){
      if (S.length !== 2 || S[0].terms.length !== 2 || S[0].ops[0] !== '÷' || S[1].terms.length !== 1 || rels[0] !== '='){ problems.push('a remainder after something that is not "a ÷ b = q": "' + whole.trim() + '"'); return ' Q '; }
      const A = S[0].terms[0], Bt = S[0].terms[1], Q = S[1].terms[0];
      /* 商與除數是「幾個 1000」：不帶單位；被除數與餘數要嘛都不帶單位、要嘛同一個單位（codex 第一輪 1b #3） */
      if (Bt.u || Q.u){ problems.push('a quotient or divisor with a unit: "' + whole.trim() + '"'); return ' Q '; }
      if (remU && remU !== A.u){ problems.push('the remainder is not in the dividend\'s unit: "' + whole.trim() + '"'); return ' Q '; }
      const a = A.u ? A.num : A.v, b = Bt.v, q = Q.v;
      verified++;
      if (rCmp(rAdd(rMul(b, q), remainder), a) !== 0 || rCmp(remainder, b) >= 0) problems.push('this claim is wrong: "' + whole.trim() + '"');
      return ' Q ';
    }
    /* 換算階梯：「3 公噸 × 1000 ＝ 3000 公斤」—— 數字對、而且 × 1000 往小一階、÷ 1000 往大一階 */
    if (S.length === 2 && S[0].terms.length === 2 && S[0].terms[0].u && !S[0].terms[0].compound && !S[0].terms[1].u && S[1].terms.length === 1 && S[1].terms[0].u && S[0].terms[0].u !== S[1].terms[0].u){
      const a = S[0].terms[0], f = S[0].terms[1], b = S[1].terms[0], op = S[0].ops[0];
      verified++;
      const got = op === '×' ? rMul(a.num, f.v) : op === '÷' ? rDiv(a.num, f.v) : null;
      if (!got || rCmp(got, b.num) !== 0) problems.push('this claim is wrong: "' + whole.trim() + '"');
      else if (rCmp(f.v, rat(1000, 1)) !== 0 || (op === '×' ? LVL[a.u] - LVL[b.u] : LVL[b.u] - LVL[a.u]) !== 1) problems.push('the units do not match "' + op + ' ' + f.raw + '": "' + whole.trim() + '"');
      return ' Q ';
    }
    /* 一般情形：每一邊算出來（有單位的量換成公斤；× ÷ 的無單位數是倍數），沒有單位的一邊沿用最近的單位 */
    const vals = S.map(s => {
      const hasU = s.terms.some(x => x.u);
      let v = s.terms[0].v, bad = null;
      if (hasU) s.ops.forEach((op, i) => { const L = s.terms[i], R = s.terms[i + 1]; if ((op === '+' || op === '-') && (!L.u || !R.u)) bad = 'adds a number with a unit to one without'; });
      if (hasU && s.ops.length && s.terms.filter(x => x.u).length > 1 && s.ops.some(o => o === '×' || o === '÷')) bad = 'multiplies two quantities with units';
      s.ops.forEach((op, i) => { const r = s.terms[i + 1].v; v = op === '+' ? rAdd(v, r) : op === '-' ? rSub(v, r) : op === '×' ? rMul(v, r) : rDiv(v, r); });
      if (s.ops.length && s.ops.some(o => o === '+' || o === '-') && s.ops.some(o => o === '×' || o === '÷')) bad = bad || 'mixes + − with × ÷ (no precedence here)';
      return { v, hasU, bad, unit:hasU ? s.terms.filter(x => x.u)[0].u : null };
    });
    for (const x of vals) if (x.bad){ problems.push(x.bad + ': "' + whole.trim() + '"'); return ' Q '; }
    const anyU = vals.some(x => x.hasU);
    const kgv = vals.map((x, i) => {
      if (x.hasU || !anyU) return x.v;
      let u = null;
      for (let j = i + 1; j < vals.length && !u; j++) if (vals[j].hasU) u = vals[j].unit;
      for (let j = i - 1; j >= 0 && !u; j--) if (vals[j].hasU) u = vals[j].unit;
      return rMul(x.v, KG[u]);
    });
    for (let k = 1; k < kgv.length; k++){
      verified++;
      const c = kgv[k - 1] && kgv[k] ? rCmp(kgv[k - 1], kgv[k]) : NaN;
      if (rels[k - 1] === '=' ? c !== 0 : !(c < 0)) problems.push('this claim is wrong: "' + whole.trim() + '"');
    }
    CLAIMS_SEEN.push(whole.replace(/\s+/g, ' ').trim());
    return ' Q ';
  });
  const left = rest.match(new RegExp('\\d\\s*' + U + '?\\s*[=<]\\s*\\d'));
  if (left) problems.push('an equals sign between numbers was not verified: "' + left[0] + '"');
  /* 這個驗算器只認得 ＝ 與 ＜；其他比較符號（＞ ≤ ≥ ≠）出現在數字旁邊一律報錯，不靜靜放行（codex 第一輪 1b #2） */
  const other = t.match(new RegExp('\\d\\s*' + U + '?\\s*[>≥≤≠＞≧≦]|[>≥≤≠＞≧≦]\\s*\\d'));
  if (other) problems.push('a comparison sign this checker cannot verify: "' + other[0] + '"');
  return { problems, verified, questions };
}
const CLAIM_PROBES = [
  ['2 公噸 ＝ 2000 公斤', false], ['2 公噸 ＝ 200 公斤', true], ['3 公噸 × 1000 ＝ 3000 公斤', false], ['3 公噸 × 100 ＝ 300 公斤', true],
  ['3 公斤 × 1000 ＝ 3000 公噸', true], ['2350 公斤 ÷ 1000 ＝ 2.35 公噸', false], ['2350 公斤 ÷ 1000 ＝ 23.5 公噸', true],
  ['4600 ÷ 1000 ＝ 4 餘 600', false], ['4600 ÷ 1000 ＝ 4 餘 60', true], ['4600 ÷ 1000 = 商 4 餘 600', false], ['4600 ÷ 1000 = 4 remainder 600', false],
  ['1.2 ＋ 0.4 ＝ 1.6 公噸', false], ['1.2 ＋ 0.4 ＝ 1.7 公噸', true], ['1200 ＋ 400 ＝ 1600 公斤 ＝ 1.6 公噸', false], ['1200 ＋ 400 ＝ 1600 公斤 ＝ 16 公噸', true],
  ['60 公克 ＝ 0.06 公斤', false], ['60 公克 ＝ 0.6 公斤', true], ['2 公噸 80 公斤 ＝ 2080 公斤', false], ['2.8 公噸 ＝ 2080 公斤', true],
  ['2040 ＜ 2080 ＜ 2300 公斤', false], ['2080 ＜ 2040 ＜ 2300 公斤', true], ['2 t 80 kg = 2080 kg', false], ['60 g = 0.06 kg', false],
  ['1 t = 100 kg', true], ['1000 kg = 1 t', false], ['2.35 × 100 = 235', false], ['2.35 × 100 = 23.5', true],
  ['3 公噸 50 公斤 ＝ 3000 ＋ 50 ＝ 3050 公斤', false], ['3 公噸 50 公斤 ＝ 3000 ＋ 50 ＝ 350 公斤', true], ['2.35 ÷ 1000 = 0.00235', false],
  ['5 tonnes = 5000 kilograms', false], ['5 tonnes = 500 kilograms', true], ['2.35 公噸 ＝ ？ 公斤', false], ['3 ＝ 4', true], ['3 公噸 0 公斤 ＝ 3000 公斤', true], ['3000 公斤 ＞ 3001 公斤', true], ['3050 公斤 ÷ 1000 公斤 = 商 3 公斤 餘 50', true], ['3050 公斤 ÷ 1000 = 3 餘 50 公斤', false], ['3050 公斤 ÷ 1000 = 3 餘 50 公克', true]
];

const LANGS = ['zh', 'en'];
const U_W = { zh:{ t:'公噸', kg:'公斤', g:'公克' }, en:{ t:'t', kg:'kg', g:'g' } };
/* 自己的小數字串（公克數 → 某個單位），只用字串移位 */
function inUnit(g, u){
  const p = { g:0, kg:3, t:6 }[u];
  let s = String(g);
  if (!p) return s;
  while (s.length <= p) s = '0' + s;
  const ip = s.slice(0, s.length - p), fp = s.slice(s.length - p).replace(/0+$/, '');
  return fp ? ip + '.' + fp : ip;
}
function shiftStr(s, k){
  const q = s.split('.'); let ip = q[0], fp = q[1] || '', all = ip + fp, pt = ip.length + k;
  while (pt > all.length) all += '0';
  while (pt < 1){ all = '0' + all; pt++; }
  const a = all.slice(0, pt).replace(/^0+(?=\d)/, ''), b = all.slice(pt).replace(/0+$/, '');
  return b ? a + '.' + b : a;
}
const wRef = (g, u, L) => inUnit(g, u) + ' ' + U_W[L][u];
const tkgRef = (kg, L) => Math.floor(kg / 1000) + ' ' + U_W[L].t + ' ' + (kg % 1000) + ' ' + U_W[L].kg;
const cardRef = (c, L) => c.f === 'tkg' ? tkgRef(c.kg, L) : wRef(c.kg * 1000, c.f, L);
/* 第 4、5 關最容易「數字對、意思反過來」的三句：設定檔自己的一份標準寫法，逐字比對（codex 第三輪：
   關鍵字黑名單永遠列不完 —「並未超過」「Not over」「It is not completely full」都溜得過去） */
const REF = {
  loadOver: (L, card, kg, sum, total, limitT, limitKg, isKg) => L === 'zh'
    ? '裝不下：' + (isKg ? '' : card + ' ＝ ' + kg + ' 公斤，') + '已經裝了 ' + sum + ' 公斤，' + sum + ' ＋ ' + kg + ' ＝ ' + total + ' 公斤，超過上限 ' + limitT + ' 公噸 ＝ ' + limitKg + ' 公斤。'
    : 'It will not fit: ' + (isKg ? '' : card + ' = ' + kg + ' kg; ') + 'already loaded ' + sum + ' kg, and ' + sum + ' + ' + kg + ' = ' + total + ' kg — over the limit of ' + limitT + ' t = ' + limitKg + ' kg.',
  loadDone: (L, list, total, limitT) => L === 'zh'
    ? '剛好滿載！' + list.join(' ＋ ') + ' ＝ ' + total + ' 公斤 ＝ ' + limitT + ' 公噸。'
    : 'Exactly full! ' + list.join(' + ') + ' = ' + total + ' kg = ' + limitT + ' t.',
  orderBad: (L, card, kg, isKg, r, want, here) => L === 'zh'
    ? (isKg ? card : card + ' ＝ ' + kg + ' 公斤') + '：' + (r ? '四張裡比它輕的有 ' + r + ' 張' : '四張裡沒有比它輕的') + '，它是「' + want + '」，不是「' + here + '」。'
    : (isKg ? card : card + ' = ' + kg + ' kg') + ': ' + (r ? r + ' of the four ' + (r === 1 ? 'is' : 'are') + ' lighter' : 'none of the four is lighter') + ', so it goes in "' + want + '", not "' + here + '".'
};
function unitRef(g){ return g >= 1000000 ? 't' : g >= 1000 ? 'kg' : 'g'; }
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []); }
const isInt = v => Number.isInteger(v);
/* 「1.5 公噸」「800 公斤」「2 公噸 80 公斤」→ 公斤；讀不懂 → NaN */
function kgOfText(s, L){
  s = String(s).trim();
  let m = s.match(L === 'zh' ? /^(\d+) 公噸 (\d+) 公斤$/ : /^(\d+) t (\d+) kg$/);
  if (m) return +m[1] * 1000 + +m[2];
  m = s.match(L === 'zh' ? /^(\d+(?:\.\d+)?) (公噸|公斤)$/ : /^(\d+(?:\.\d+)?) (t|kg)$/);
  if (!m) return NaN;
  const r = rMul(ratOf(m[1]), KG[UMAP[m[2]]]);
  return r.d === 1 ? r.n : NaN;
}

module.exports = {
  _weightClaims: weightClaims,
  breaks: [
    /* ---- 小遊戲「載重過磅」：引擎與計分 ---- */
    {"file": "index", "expect": "GAME_ORDER should be", "find": "var GAME_ORDER = ['unit', 'point', 'write', 'load', 'order'];", "replace": "var GAME_ORDER = ['point', 'unit', 'write', 'load', 'order'];"},
    {"file": "index", "expect": "under 44", "find": "  var GPICK = 48;", "replace": "  var GPICK = 44;"},
    {"file": "index", "expect": "shuffle(): only", "find": "      var k = Math.floor(Math.random() * (j + 1));   /* 自足", "replace": "      var k = j;   /* 自足"},
    {"file": "index", "expect": "starts in the answer order", "find": "    if (sorted) t.reverse();\n", "replace": ""},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = 20;"},
    {"file": "index", "expect": "a mistake does not cost 5", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = 0;"},
    {"file": "index", "expect": "the same mistake again is charged again", "find": "    var lost = !again && gScore >= 5 ? 5 : 0;", "replace": "    var lost = gScore >= 5 ? 5 : 0;"},
    {"file": "index", "expect": "shown although nothing was taken", "find": "'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", "replace": "'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');"},
    {"file": "index", "expect": "does not clear the hint", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "nearestOpen(): a point inside the big box", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (dc < bc){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "goes to the first match", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (!best){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "board generation", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", "replace": ""},
    {"file": "index", "expect": "second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "losing pointer capture", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "placed pieces still catch taps", "find": "  .gpiece.locked{cursor:default;pointer-events:none}", "replace": "  .gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "does not snap", "find": "      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);", "replace": "      if (o.axis === 'x') P.place(orig.x + dx, orig.y);"},
    {"file": "index", "expect": "ahead mode", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", "replace": "    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式"},

    /* ---- 第 1 關：選單位 ---- */
    {"file": "index", "expect": "unitOf(", "find": "  function unitOf(g){ return g >= 1000000 ? 't' : (g >= 1000 ? 'kg' : 'g'); }", "replace": "  function unitOf(g){ return g > 1000000 ? 't' : (g >= 1000 ? 'kg' : 'g'); }"},
    {"file": "index", "expect": "does not match example 1", "find": "{ id:'egg', icon:'🥚', g:60 },", "replace": "{ id:'egg', icon:'🥚', g:600 },"},
    {"file": "index", "expect": "a round needs two", "find": "{ id:'elephant', icon:'🐘', g:4000000 },\n    { id:'car', icon:'🚗', g:1500000 },     { id:'bus', icon:'🚌', g:12000000 }", "replace": "{ id:'elephant', icon:'🐘', g:4000000 },\n    { id:'car', icon:'🚗', g:150000 },     { id:'bus', icon:'🚌', g:120000 }"},
    {"file": "index", "expect": "unitWhy", "find": "    return UNITS.indexOf(bin) > UNITS.indexOf(u) ? d.gUnitBadBig(name, right, there, bin, u, mid) : d.gUnitBadSmall(name, right, there, bin, u, mid);", "replace": "    return UNITS.indexOf(bin) < UNITS.indexOf(u) ? d.gUnitBadBig(name, right, there, bin, u, mid) : d.gUnitBadSmall(name, right, there, bin, u, mid);"},
    {"file": "index", "expect": "unitWhy", "find": "    if (bin === u) return null;\n    var name = d.gUnitNames[o.id]", "replace": "    if (bin === u || bin === 'kg') return null;\n    var name = d.gUnitNames[o.id]"},
    {"file": "index", "expect": "unitPick(): not two different things per unit", "find": "      out = out.concat(shuffle(GAME_UNIT.filter(function(o){ return unitOf(o.g) === u; })).slice(0, 2));", "replace": "      out = out.concat(shuffle(GAME_UNIT.filter(function(o){ return unitOf(o.g) === u; })).slice(0, u === 'g' ? 3 : 2));"},
    {"file": "index", "expect": "the thing / box judged", "find": "        var o = P.data.o, why = unitWhy(d, o, bin.u, lang);", "replace": "        var o = P.data.o, why = unitWhy(d, o, 'kg', lang);"},
    {"file": "index", "expect": "does not show its weight in the box", "find": "'gchip', o.icon + ' ' + wStr(o.g, bin.u, lang));", "replace": "'gchip', o.icon + ' ' + wStr(o.g, 'g', lang));"},
    {"file": "index", "expect": "must say \"不到 1 ", "find": "'，不到 1 ' + UNIT.zh[bin] + (mid ?", "replace": "'，超過 1 ' + UNIT.zh[bin] + (mid ?"},
    {"file": "index", "expect": "must say \"1000 kg or more", "find": "' — that is 1000 ' + UNIT.en[bin] + ' or more' + (mid ?", "replace": "' — that is under 1000 ' + UNIT.en[bin] + (mid ?"},
    {"file": "index", "expect": "gUnitBins zh must read exactly", "find": "      gUnitBins: { g:'公克', kg:'公斤', t:'公噸' },", "replace": "      gUnitBins: { g:'公斤', kg:'公克', t:'公噸' },"},
    {"file": "index", "expect": "gHints.unit", "find": "        unit: '提示 1：想一想它大概多重。不到 1000 公克用公克；", "replace": "        unit: '提示 1：想一想它大概多重。不到 100 公克用公克；"},
    {"file": "index", "expect": "covers the box label", "find": "lblH:44, chipW:84, chipH:40, chipY:[56, 104], pad:8,", "replace": "lblH:44, chipW:84, chipH:40, chipY:[40, 104], pad:8,"},
    {"file": "index", "expect": "unit boxes: the drop zones never overlap", "find": "lblH:44, chipW:84, chipH:40, chipY:[56, 104], pad:8,", "replace": "lblH:44, chipW:84, chipH:40, chipY:[56, 104], pad:1,"},
    {"file": "index", "expect": "unit cards / boxes", "find": "cardW:88, cardH:62, trayX:[52, 150, 248], trayY:[200, 270] }, UNIT_H = 304;", "replace": "cardW:88, cardH:62, trayX:[52, 150, 248], trayY:[170, 270] }, UNIT_H = 304;"},
    {"file": "index", "expect": "unitOkText", "find": "        kg: function(name, w){ return name + '大約 ' + w + '：1000 公克以上、不到 1000 公斤，用公斤。'; },", "replace": "        kg: function(name, w){ return name + '大約 ' + w + '：1000 公克以上、不到 1000 公斤，用公噸。'; },"},

    /* ---- 第 2 關：小數點搬家 ---- */
    {"file": "index", "expect": "at the answer gap", "find": "  function pointTarget(it){ return pointCells(it.v).g0 + (LV[it.from] > LV[it.to] ? 3 : -3); }", "replace": "  function pointTarget(it){ return pointCells(it.v).g0 + (LV[it.from] > LV[it.to] ? 2 : -2); }"},
    {"file": "index", "expect": "pointRead(", "find": "    var ip = digits.slice(0, g).replace(/^0+(?=\\d)/, ''), fp = digits.slice(g).replace(/0+$/, '');", "replace": "    var ip = digits.slice(0, g).replace(/^0+(?=\\d)/, ''), fp = digits.slice(g);"},
    {"file": "index", "expect": "pointGap(", "find": "  function pointGap(n, x){ return Math.max(1, Math.min(n, Math.round((x - pointX0(n)) / POINT.cw))); }", "replace": "  function pointGap(n, x){ return Math.max(1, Math.min(n, Math.floor((x - pointX0(n)) / POINT.cw))); }"},
    {"file": "index", "expect": "should only remind", "find": "    if (m === 0) return 'still';\n", "replace": ""},
    {"file": "index", "expect": "not one step on the ladder", "find": "{ v:'500', from:'g', to:'kg' }\n  ];", "replace": "{ v:'500', from:'g', to:'t' }\n  ];"},
    {"file": "index", "expect": "must compute", "find": "    return (m > 0) === up ? d.gPointSize(it.v, it.from, it.to, m > 0, k, f, r) : d.gPointDir(it.v, it.from, it.to, m > 0, k, f, r);", "replace": "    return (m > 0) === up ? d.gPointSize(it.v, it.from, it.to, m > 0, k, f, it.v) : d.gPointDir(it.v, it.from, it.to, m > 0, k, f, r);"},
    {"file": "index", "expect": "must say \"數字變", "find": "'，數字變' + (right ? '大' : '小') + '了。'", "replace": "'，數字變' + (right ? '小' : '大') + '了。'"},
    {"file": "index", "expect": "must say \"moved the point", "find": "return 'You moved the point ' + k + (k === 1 ? ' place ' : ' places ')", "replace": "return 'You moved the point ' + (k + 1) + (k === 1 ? ' place ' : ' places ')"},
    {"file": "index", "expect": "gPointYes", "find": "return '換好了！' + v + ' ' + UNIT.zh[from] + ' ＝ ' + r + ' ' + UNIT.zh[to] + '（' + v + ' ' + op + ' 1000 ＝ ' + r + '）。'; },", "replace": "return '換好了！' + v + ' ' + UNIT.zh[from] + ' ＝ ' + r + ' ' + UNIT.zh[to] + '（' + v + ' ' + op + ' 100 ＝ ' + r + '）。'; },"},
    {"file": "index", "expect": "gPoint2", "find": "(LV[from] > LV[to] ? ' is × 1000: count 3 places right from where the point started.'", "replace": "(LV[from] > LV[to] ? ' is × 1000: count 3 places left from where the point started.'"},
    {"file": "index", "expect": "the reading line runs into", "find": "readY:92, readH:28, gripH:48,", "replace": "readY:92, readH:40, gripH:48,"},
    {"file": "index", "expect": "Done does not judge", "find": "        var why = pointWhy(d, it, g);", "replace": "        var why = pointWhy(d, it, pointTarget(it));"},
    {"file": "index", "expect": "the dot does not follow", "find": "onPlace:function(P){ var ng = pointGap(n, P.cx); if (ng !== g && !gSolved){ g = ng; clearNote(); draw(); } } });", "replace": "onPlace:function(P){} });"},
    {"file": "index", "expect": "\"0.x\" number", "find": "{ v:'0.8', from:'t', to:'kg' },", "replace": "{ v:'1.8', from:'t', to:'kg' },"},

    /* ---- 第 3 關：拆開來寫 ---- */
    {"file": "index", "expect": "writeDigits(", "find": "  function writeDigits(t, kg){ var s = String(t * 1000 + kg); return s.split('').map(Number); }", "replace": "  function writeDigits(t, kg){ var s = String(t * 1000) + String(kg); return s.split('').map(Number); }"},
    {"file": "index", "expect": "writeWhy(", "find": "    if (w[i] === v) return null;\n", "replace": "    if (w[i] === v || v === 0) return null;\n"},
    {"file": "index", "expect": "fewer than half", "find": "var GAME_WRITE = [[3, 50], [2, 350], [4, 8], [1, 200], [5, 75], [6, 5], [2, 40], [7, 320]];", "replace": "var GAME_WRITE = [[3, 150], [2, 350], [4, 8], [1, 200], [5, 175], [6, 5], [2, 140], [7, 320]];"},
    {"file": "index", "expect": "out of range", "find": "var GAME_WRITE = [[3, 50], [2, 350], [4, 8], [1, 200], [5, 75], [6, 5], [2, 40], [7, 320]];", "replace": "var GAME_WRITE = [[3, 50], [2, 350], [4, 8], [1, 200], [5, 75], [6, 5], [2, 40], [7, 1320]];"},
    {"file": "index", "expect": "GAME writeWhy", "find": "return kg + ' 公斤有 ' + h + ' 個百、' + te + ' 個十、' + o + ' 個一：'", "replace": "return kg + ' 公斤有 ' + te + ' 個百、' + h + ' 個十、' + o + ' 個一：'"},
    {"file": "index", "expect": "GAME gWriteZero", "find": "return 'The 0 in the middle cannot be left out — written as ' + bad + ' it would be only ' + bad + ' kg.'; },", "replace": "return 'The 0 in the middle cannot be left out — written as ' + bad + ' it would be only ' + bad + '0 kg.'; },"},
    {"file": "index", "expect": "gWriteDone", "find": "return '寫好了！' + t + ' 公噸 ' + kg + ' 公斤 ＝ ' + (t * 1000) + ' ＋ ' + kg + ' ＝ ' + total + ' 公斤。'; },", "replace": "return '寫好了！' + t + ' 公噸 ' + kg + ' 公斤 ＝ ' + (t * 100) + ' ＋ ' + kg + ' ＝ ' + total + ' 公斤。'; },"},
    {"file": "index", "expect": "write boxes: the drop zones never overlap", "find": "unitX:246, unitW:50, pad:4,", "replace": "unitX:246, unitW:50, pad:2,"},
    {"file": "index", "expect": "the box plus its place label", "find": "        return { i:i, z:z, cx:WRITE.slotX[i] + WRITE.slotW / 2, cy:(WRITE.lblY + WRITE.slotY + WRITE.slotH) / 2, hw:WRITE.slotW / 2, hh:(WRITE.slotY + WRITE.slotH - WRITE.lblY) / 2, done:false };", "replace": "        return { i:i, z:z, cx:WRITE.slotX[i] + WRITE.slotW / 2, cy:WRITE.slotY + WRITE.slotH / 2, hw:WRITE.slotW / 2, hh:WRITE.slotH / 2, done:false };"},
    {"file": "index", "expect": "gPlaceLbl en", "find": "      gPlaceLbl: ['Th', 'H', 'T', 'O'],", "replace": "      gPlaceLbl: ['O', 'T', 'H', 'Th'],"},
    {"file": "index", "expect": "the digit / box judged", "find": "        var v = P.data.v, why = writeWhy(d, t, kg, s.i, v);", "replace": "        var v = P.data.v, why = writeWhy(d, t, kg, 0, v);"},

    /* ---- 第 4 關：裝到剛好滿載 ---- */
    {"file": "index", "expect": "loadRefuse(", "find": "  function loadRefuse(limitT, loadedKg, kg){ return loadedKg + kg > limitT * 1000 ? loadedKg + kg : null; }", "replace": "  function loadRefuse(limitT, loadedKg, kg){ return loadedKg + kg >= limitT * 1000 ? loadedKg + kg : null; }"},
    {"file": "index", "expect": "loadPlan(", "find": "        if (bits.length === size && s === need) return bits;", "replace": "        if (bits.length === size && s === need && size > 1) return bits;"},
    {"file": "index", "expect": "no way to load exactly", "find": "{ limitT:3, cargo:[{ icon:'🪵', kg:2000, f:'t' }, { icon:'🪨', kg:800, f:'kg' }, { icon:'🧱', kg:200, f:'t' }, { icon:'🌾', kg:1500, f:'t' }, { icon:'📦', kg:500, f:'kg' }] },", "replace": "{ limitT:3, cargo:[{ icon:'🪵', kg:2100, f:'t' }, { icon:'🪨', kg:800, f:'kg' }, { icon:'🧱', kg:200, f:'t' }, { icon:'🌾', kg:1600, f:'t' }, { icon:'📦', kg:500, f:'kg' }] },"},
    {"file": "index", "expect": "alone is over the limit", "find": "{ icon:'🧱', kg:1200, f:'t' }, { icon:'🪨', kg:800, f:'kg' }, { icon:'🌾', kg:500, f:'t' }, { icon:'📦', kg:300, f:'kg' }, { icon:'🪵', kg:700, f:'kg' }] }", "replace": "{ icon:'🧱', kg:2200, f:'t' }, { icon:'🪨', kg:800, f:'kg' }, { icon:'🌾', kg:500, f:'t' }, { icon:'📦', kg:300, f:'kg' }, { icon:'🪵', kg:700, f:'kg' }] }"},
    {"file": "index", "expect": "no \"0.x t\" card", "find": "{ icon:'🧱', kg:800, f:'t' }, { icon:'🌾', kg:1500, f:'kg' },", "replace": "{ icon:'🧱', kg:800, f:'kg' }, { icon:'🌾', kg:1500, f:'t' },"},
    {"file": "index", "expect": "GAME gLoadOver", "find": "'已經裝了 ' + sum + ' 公斤，' + sum + ' ＋ ' + kg + ' ＝ ' + total + ' 公斤，超過上限 '", "replace": "'已經裝了 ' + sum + ' 公斤，' + sum + ' ＋ ' + kg + ' ＝ ' + (total + 100) + ' 公斤，超過上限 '"},
    {"file": "index", "expect": "GAME gLoadDone", "find": "return 'Exactly full! ' + list.join(' + ') + ' = ' + total + ' kg = ' + limitT + ' t.'; },", "replace": "return 'Exactly full! ' + list.join(' + ') + ' = ' + total + ' kg = ' + (limitT * 10) + ' t.'; },"},
    {"file": "index", "expect": "GAME gLoadOk", "find": "return isKg ? '裝上了 ' + card + '。' : '裝上了：' + card + ' ＝ ' + kg + ' 公斤。'; },", "replace": "return isKg ? '裝上了 ' + card + '。' : '裝上了：' + card + '。'; },"},
    {"file": "index", "expect": "solved exactly at the limit", "find": "        if (sumKg === limitKg){", "replace": "        if (sumKg >= limitKg - 500){"},
    {"file": "index", "expect": "sits in the truck", "find": "trayX:[52, 150, 248, 101, 199], trayY:[208, 208, 208, 274, 274] }, LOAD_H = 310;", "replace": "trayX:[52, 150, 248, 101, 199], trayY:[170, 208, 208, 274, 274] }, LOAD_H = 310;"},
    {"file": "index", "expect": "cardStr(", "find": "  function tkgStr(kg, L){ return Math.floor(kg / 1000) + ' ' + UNIT[L].t + ' ' + (kg % 1000) + ' ' + UNIT[L].kg; }", "replace": "  function tkgStr(kg, L){ return Math.ceil(kg / 1000) + ' ' + UNIT[L].t + ' ' + (kg % 1000) + ' ' + UNIT[L].kg; }"},
    {"file": "index", "expect": "Unload all does not empty", "find": "        loaded = []; sumKg = 0;", "replace": "        loaded = [];"},
    {"file": "index", "expect": "the cargo judged", "find": "        var c = P.data.c, total = loadRefuse(e.limitT, sumKg, c.kg);", "replace": "        var c = P.data.c, total = loadRefuse(e.limitT, 0, c.kg);"},

    /* ---- 第 5 關：排輕重 ---- */
    {"file": "index", "expect": "orderRank(", "find": "  function orderRank(set, c){ return set.filter(function(x){ return x.kg < c.kg; }).length; }", "replace": "  function orderRank(set, c){ return set.filter(function(x){ return x.kg <= c.kg; }).length - 1 + (c.f === 'tkg' ? 1 : 0); }"},
    {"file": "index", "expect": "four different weights", "find": "    [{ kg:2500, f:'t' }, { kg:2080, f:'tkg' }, { kg:2300, f:'kg' }, { kg:2040, f:'t' }],", "replace": "    [{ kg:2500, f:'t' }, { kg:2080, f:'tkg' }, { kg:2080, f:'kg' }, { kg:2040, f:'t' }],"},
    {"file": "index", "expect": "the trap", "find": "    [{ kg:3400, f:'t' }, { kg:3050, f:'tkg' }, { kg:3150, f:'kg' }, { kg:3200, f:'t' }],", "replace": "    [{ kg:3400, f:'t' }, { kg:3500, f:'tkg' }, { kg:3150, f:'kg' }, { kg:3200, f:'t' }],"},
    {"file": "index", "expect": "are lighter", "find": "(r ? '四張裡比它輕的有 ' + r + ' 張' : '四張裡沒有比它輕的')", "replace": "(r ? '四張裡比它輕的有 ' + (r + 1) + ' 張' : '四張裡沒有比它輕的')"},
    {"file": "index", "expect": "GAME gOrderDone", "find": "      gOrderDone: function(list){ return 'In order! ' + list.join(' < ') + ' kg.'; },", "replace": "      gOrderDone: function(list){ return 'In order! ' + list.slice().reverse().join(' < ') + ' kg.'; },"},
    {"file": "index", "expect": "the whole row", "find": "        return { i:i, z:z, cx:(ORDER.lblX + ORDER.slotX + ORDER.slotW) / 2, cy:y + ORDER.slotH / 2, hw:(ORDER.slotX + ORDER.slotW - ORDER.lblX) / 2, hh:ORDER.slotH / 2,", "replace": "        return { i:i, z:z, cx:ORDER.slotX + ORDER.slotW / 2, cy:y + ORDER.slotH / 2, hw:ORDER.slotW / 2, hh:ORDER.slotH / 2,"},
    {"file": "index", "expect": "order rows: the drop zones never overlap", "find": "    cardW:140, cardH:46, trayX:[78, 222], trayY:[256, 310] }, ORDER_H = 340;", "replace": "    cardW:140, cardH:46, trayX:[78, 222], trayY:[256, 310] }, ORDER_H = 340; ORDER.pad = 3;"},
    {"file": "index", "expect": "orderTray(): the tray starts", "find": "  function orderTray(set){ return unsorted(set, function(c){ return c.kg; }); }", "replace": "  function orderTray(set){ return set.slice().sort(function(a, b){ return a.kg - b.kg; }); }"},
    {"file": "index", "expect": "gOrderSlots en", "find": "      gOrderSlots: ['Lightest', '2nd', '3rd', 'Heaviest'],", "replace": "      gOrderSlots: ['Heaviest', '3rd', '2nd', 'Lightest'],"},
    {"file": "index", "expect": "the card / box judged", "find": "        var c = P.data.c, why = orderWhy(d, set, c, s.i, lang);", "replace": "        var c = P.data.c, why = orderWhy(d, set, c, 0, lang);"},

    /* ---- 範例與題庫的句子 ---- */
    {"file": "index", "expect": "missing space between Chinese and a digit", "find": "      fmtW: function(v, u){ return v + ' ' + UNIT.zh[u]; },", "replace": "      fmtW: function(v, u){ return v + UNIT.zh[u]; },"},
    {"file": "index", "expect": "the units do not match", "find": "      eqDown: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.en[fromU] + ' × 1000 = <b>' + toV + ' ' + UNIT.en[toU] + '</b>'; },", "replace": "      eqDown: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.en[toU] + ' × 1000 = <b>' + toV + ' ' + UNIT.en[fromU] + '</b>'; },"},
    {"file": "index", "expect": "this claim is wrong", "find": "      compBLine1: function(total){ return total + ' ÷ 1000 = 商 ' + Math.floor(total/1000) + ' 餘 ' + (total - Math.floor(total/1000)*1000); },", "replace": "      compBLine1: function(total){ return total + ' ÷ 1000 = 商 ' + Math.floor(total/1000) + ' 餘 ' + (total - Math.floor(total/1000)*100); },"},
    {"file": "index", "expect": "this claim is wrong", "find": "          why:'2 公噸 = 2000 公斤，2000 + 350 = 2350，所以是 2350 公斤。' },", "replace": "          why:'2 公噸 = 2000 公斤，2000 + 350 = 2530，所以是 2350 公斤。' },"},
    {"file": "index", "expect": "this claim is wrong", "find": "          why:'2350 ÷ 1000 = 2.35. Converting kg to t moves the decimal point three places", "replace": "          why:'2350 ÷ 1000 = 23.5. Converting kg to t moves the decimal point three places"},
    {"file": "index", "expect": "never reaches the marked answer", "find": "        { stem:'5000 公斤 = 多少公噸？', opts:['500 公噸','50 公噸','0.5 公噸','5 公噸'], ans:3,", "replace": "        { stem:'5000 公斤 = 多少公噸？', opts:['500 公噸','50 公噸','0.5 公噸','5 公噸'], ans:2,"},
    {"file": "index", "expect": "the verified static equations changed", "find": "          why:'1 公噸 = 1000 公斤，2 × 1000 = 2000，所以是 2000 公斤。' },", "replace": "          why:'1 公噸 = 1000 公斤，2 × 1000 = 2000 = 1000 × 2，所以是 2000 公斤。' },"},
    {"file": "index", "expect": "example 4 truckOk", "find": "      truckOk: function(remain){ return '✅ 還可以再裝 ' + remain + ' 公斤。'; },", "replace": "      truckOk: function(remain){ return '✅ 還可以再裝 ' + (remain + 100) + ' 公斤。'; },"},
    {"file": "index", "expect": "example 1: ", "find": "    { id:'cow',      icon:'🐄', grams:600000,  unit:'kg' },", "replace": "    { id:'cow',      icon:'🐄', grams:600000,  unit:'t' },"},

    /* ---- review.html ---- */
    {"file": "review", "expect": "copies the number", "find": "        var m = mixOpts(v, [l * w, w * h, l + w + h, l * w * (h + 1)], [l, w, h]);", "replace": "        var m = mixOpts(v, [l * w, w * h, l + w + h, l * w * (h + 1)]);"},
    {"file": "review", "expect": "copied straight out of the stem", "find": "        var m = mixOpts(avg, [avg - 1, avg + 1, s], nums);", "replace": "        var m = mixOpts(avg, [avg - 1, avg + 1, s]);"},
    {"file": "review", "expect": "copied straight out of the stem", "find": "        var m = mixOpts(qt, [qt - 1, qt + 1, qt * 10], [dividendTenths].concat(stemTok));", "replace": "        var m = mixOpts(qt, [qt - 1, qt + 1, qt * 10], [dividendTenths]);"},
    {"file": "review", "expect": "is not \"a t b kg\"", "find": "    return lang === 'zh' ? (t + ' 公噸 ' + kgRem + ' 公斤') : (t + ' t ' + kgRem + ' kg');", "replace": "    return lang === 'zh' ? (t + '公噸' + kgRem + '公斤') : (t + ' t ' + kgRem + ' kg');"},
    {"file": "review", "expect": "kg (must be 1~999)", "find": "        if (total % 100 > 0) wrongEncs.push(encodeTKg(t, total % 100));", "replace": "        wrongEncs.push(encodeTKg(t, total % 100));"},
    {"file": "review", "expect": "outside 1~9", "find": "        if (t > 1) wrongEncs.push(encodeTKg(t - 1, kgRem));   /* 不出「0 公噸 …」 */", "replace": "        if (t > 0) wrongEncs.push(encodeTKg(t - 1, kgRem));   /* 不出「0 公噸 …」 */"},
    {"file": "review", "expect": "with 0 of the small unit", "find": "        var compoundStr = d.t === 0 ? d.kgRem + (lang === 'zh' ? ' 公斤' : ' kg')\n          : d.kgRem === 0 ? d.t + (lang === 'zh' ? ' 公噸' : ' t') : fmtCompound(d.t, d.kgRem, lang);", "replace": "        var compoundStr = d.t > 0 ? fmtCompound(d.t, d.kgRem, lang) : (lang === 'zh' ? d.kgRem + ' 公斤' : d.kgRem + ' kg');"},
    {"file": "review", "expect": "tonStr", "find": "        var tonStr = divExact(kg, 1000);\n        var wrong100 = divExact(kg, 100); // 誤把 ÷1000 當成 ÷100\n        var candidates = [wrong100, divExact(kg + 100, 1000), divExact(kg - 100, 1000)];", "replace": "        var tonStr = divExact(kg, 100);\n        var wrong100 = divExact(kg, 1000); // 誤把 ÷1000 當成 ÷100\n        var candidates = [wrong100, divExact(kg + 100, 1000), divExact(kg - 100, 1000)];"},
    {"file": "review", "expect": "is not \"number + space + tonnes\"", "find": "          opts: d.optsStr.map(function(v){ return lang === 'zh' ? v + ' 公噸' : v + ' t'; }),\n          ans: d.ans,\n          why: lang === 'zh'\n            ? d.kg1", "replace": "          opts: d.optsStr.map(function(v){ return lang === 'zh' ? v + '公噸' : v + ' t'; }),\n          ans: d.ans,\n          why: lang === 'zh'\n            ? d.kg1"},
    {"file": "review", "expect": "claims", "find": "            ? d.t + ' 公噸 = ' + (d.t * 1000) + ' 公斤，' + (d.t * 1000) + ' + ' + d.kgRem + ' = ' + d.total + ' 公斤。'", "replace": "            ? d.t + ' 公噸 = ' + (d.t * 100) + ' 公斤，' + (d.t * 1000) + ' + ' + d.kgRem + ' = ' + d.total + ' 公斤。'"},
    {"file": "review", "expect": "copied straight out of the stem", "find": "    (avoid || []).forEach(function(a){ seen[String(a)] = true; });", "replace": ""},

    /* ---- codex 第一輪 ---- */
    {"file": "index", "expect": "mistake key: a cargo onto the truck", "find": "c.f === 'kg'), P.data.j + '>truck'); return false; }", "replace": "c.f === 'kg'), P.data.j + '@' + sumKg); return false; }"},
    {"file": "index", "expect": "Done does not end a held grip", "find": "        dotP.rehome(pointGapX(n, g), POINT.dotY); grip.rehome(pointGapX(n, g), POINT.knobY);   /* 換好了：先收把手 */\n", "replace": ""},
    {"file": "index", "expect": "GAME gLoadOver", "find": "return '裝不下：' + (isKg ? '' : card + ' ＝ ' + kg + ' 公斤，')", "replace": "return '裝得下：' + (isKg ? '' : card + ' ＝ ' + kg + ' 公斤，')"},
    {"file": "index", "expect": "GAME gLoadOver", "find": "' kg — over the limit of ' + limitT + ' t = ' + limitKg + ' kg.';", "replace": "' kg — not over the limit of ' + limitT + ' t = ' + limitKg + ' kg.';"},
    {"file": "index", "expect": "GAME orderWhy", "find": "'，它是「' + want + '」，不是「' + here + '」。';", "replace": "'，它是「' + here + '」，不是「' + want + '」。';"},
    {"file": "index", "expect": "GAME orderWhy", "find": "' lighter' : 'none of the four is lighter') + ', so it goes in \"' + want + '\", not \"' + here + '\".';", "replace": "' heavier' : 'none of the four is lighter') + ', so it goes in \"' + want + '\", not \"' + here + '\".';"},
    {"file": "index", "expect": "GAME gLoadDone", "find": "return '剛好滿載！' + list.join(' ＋ ')", "replace": "return '還差一點！' + list.join(' ＋ ')"},

    /* ---- codex 第三輪 ---- */
    {"file": "index", "expect": "canonical sentence", "find": "' ＝ ' + total + ' 公斤，超過上限 ' + limitT + ' 公噸 ＝ ' + limitKg + ' 公斤。';", "replace": "' ＝ ' + total + ' 公斤，並未超過上限 ' + limitT + ' 公噸 ＝ ' + limitKg + ' 公斤。';"},
    {"file": "index", "expect": "canonical sentence", "find": "' kg — over the limit of ' + limitT + ' t = ' + limitKg + ' kg.';", "replace": "' kg — Not over the limit of ' + limitT + ' t = ' + limitKg + ' kg.';"},
    {"file": "index", "expect": "canonical sentence", "find": "' = ' + total + ' kg = ' + limitT + ' t.'; },", "replace": "' = ' + total + ' kg = ' + limitT + ' t. It is not completely full.'; },"},
    {"file": "index", "expect": "canonical sentence", "find": "' ＝ ' + total + ' 公斤 ＝ ' + limitT + ' 公噸。'; },", "replace": "' ＝ ' + total + ' 公斤 ＝ ' + limitT + ' 公噸。其實尚未滿。'; },"},

    /* ---- codex 第四輪 ---- */
    {"file": "index", "expect": "canonical sentence", "find": "return 'Exactly full! ' + list.join(' + ')", "replace": "return 'Exactly full! ' + (list[0] < list[1] ? list.slice(1).concat([0]) : list).join(' + ')"},

    /* ---- 驗證者那一輪 ---- */
    {"file": "index", "expect": "the red dot itself cannot be dragged", "find": "      dotP = handle(POINT.dotY, GPICK, GPICK, 'gdotp', undefined, d.gPointAria.grip);", "replace": "      dotP = handle(POINT.dotY, GPICK, GPICK, 'gdotp', undefined, d.gPointAria.grip); dotP.el.style.pointerEvents = 'none';"},
    {"file": "index", "expect": "a tap between two digits", "find": "        if (!onDigits && !onRail) return;", "replace": "        if (!onRail) return;"},
    {"file": "index", "expect": "the red dot is not drawn at the gap", "find": "        [dotP, grip].forEach(function(P){ if (P && !P.busy()", "replace": "        [grip].forEach(function(P){ if (P && !P.busy()"},
    {"file": "index", "expect": "the red dot is not drawn on the digits", "find": "dotY:64, railY:134,", "replace": "dotY:90, railY:134,"},
    {"file": "index", "expect": "covers the reading line", "find": "dotY:64, railY:134,", "replace": "dotY:74, railY:134,"},
    {"file": "index", "expect": "gAsks.point", "find": "        point: '把紅色的小數點拖到對的位置（也可以拖下面的紅色把手、點兩個數字中間或刻度、按 ◀ ▶），換好了按「換好了」。',", "replace": "        point: '把紅色把手拖到對的位置（也可以點刻度、按 ◀ ▶），換好了按「換好了」。',"},
    {"file": "index", "expect": "gPointRead", "find": "      gPointRead: function(r, to){ return '現在是：' + r + ' ' + UNIT.zh[to]; },", "replace": "      gPointRead: function(r, to){ return '你寫的是：' + r + ' ' + UNIT.zh[to]; },"},
    {"file": "index", "expect": "a two-step miss must also say it in kilograms", "find": "    var mid = Math.abs(UNITS.indexOf(bin) - UNITS.indexOf(u)) === 2 ? wStr(o.g, 'kg', L) : null;", "replace": "    var mid = null;"},
    {"file": "index", "expect": "也有 1000 公斤以上", "find": "'；換成公斤是 ' + mid + '，也有 1000 公斤以上'", "replace": "'；換成公斤是 ' + mid + '，不到 1000 公斤'"},
    {"file": "index", "expect": "s6lead", "find": "練的都是<strong>公噸、公斤、公克之間怎麼換</strong>。放錯會扣分，但不會結束。',", "replace": "每一關都要<strong>先把單位換成一樣</strong>。放錯會扣分，但不會結束。',"},

    /* ---- codex 第六輪 ---- */
    {"file": "index", "expect": "two different places", "find": "        if (ng !== g){ g = ng; clearNote(); }\n        dotP.rehome(pointGapX(n, g), POINT.dotY); grip.rehome(pointGapX(n, g), POINT.knobY);\n        draw();", "replace": "        if (ng !== g){ g = ng; clearNote(); }\n        draw();"},
    {"file": "index", "expect": "is swallowed", "find": "      B.onTap = function(P, pt){ if (pt) setG(pointGap(n, pt.x)); };", "replace": "      B.onTap = function(){};"},
    {"file": "index", "expect": "does not pass where it was tapped", "find": "      if (!moved){ if (B.onTap) B.onTap(P, B.toBoard(e)); return; }", "replace": "      if (!moved){ if (B.onTap) B.onTap(P); return; }"},
    {"file": "index", "expect": "gPointStill", "find": "再按「換好了」。',", "replace": "再按「換好了」。'.replace('紅色把手', '把手'),"}
  ],

  sim: {
    INVARIANTS: {
      kgToTon: d => {
        if (d.tonStr !== inUnit(d.kg * 1000, 't')) return 'tonStr ' + d.tonStr + ' is not ' + d.kg + ' kg in tonnes';
        if (d.optsStr.indexOf(d.tonStr) !== d.ans) return 'the marked option is not the answer';
      },
      tonToKg: d => {
        if (d.tonStr !== inUnit(d.kg * 1000, 't')) return 'tonStr ' + d.tonStr + ' is not ' + d.kg + ' kg in tonnes';
        if (d.opts.some(o => !(isInt(o) && o > 0))) return 'an option is not a positive whole number of kg';
      },
      compoundToKg: d => {
        if (d.total !== d.t * 1000 + d.kgRem) return 'total != t × 1000 + kg';
        if (!(d.kgRem > 0 && d.kgRem < 1000)) return 'kgRem ' + d.kgRem + ' is not 1~999';
        if (d.opts.some(o => !(isInt(o) && o > 0))) return 'an option is not a positive whole number of kg';
      },
      kgToCompound: d => {
        if (d.t * 1000 + d.kgRem !== d.total || d.kgRem >= 1000) return d.total + ' kg is not ' + d.t + ' t ' + d.kgRem + ' kg';
      },
      truckTotal: d => {
        if (d.total !== d.kg1 + d.kg2 || d.tonStr !== inUnit(d.total * 1000, 't')) return 'total / tonStr wrong';
      },
      splitShares: d => {
        if (d.perBox * d.n !== d.total || d.t * 1000 + d.kgRem !== d.total) return 'perBox × n != total, or the compound is wrong';
      },
      decimalDivide: d => {
        if (d.dividendTenths !== d.qt * d.k || d.dividend !== inUnit(d.dividendTenths * 100, 'kg').replace(/(\.\d)0*$/, '$1') && d.dividend !== shiftStr(String(d.dividendTenths), -1)) return 'dividend is not qt × k tenths';
        if (d.q !== shiftStr(String(d.qt), -1)) return 'q is not qt tenths';
      },
      cuboidVolume: d => { if (d.v !== d.l * d.w * d.h) return 'v != l × w × h'; },
      avgCalc: d => {
        if (d.sum !== d.nums.reduce((a, b) => a + b, 0) || d.sum !== d.avg * d.n || d.nums.length !== d.n) return 'the numbers do not average to ' + d.avg;
        if (d.nums.some(v => !(v > 0))) return 'a number is not positive';
      }
    },
    /* 正解的第二套實作：只用原始參數重算，自己的小數字串與「幾公噸幾公斤」，不呼叫頁面的 divExact／fmtCompound */
    expectedCorrect: function(d, genId, L){
      switch (genId){
        case 'kgToTon': return wRef(d.kg * 1000, 't', L);
        case 'tonToKg': return String(d.kg);
        case 'compoundToKg': return String(d.t * 1000 + d.kgRem);
        case 'kgToCompound': return tkgRef(d.total, L);
        case 'truckTotal': return wRef((d.kg1 + d.kg2) * 1000, 't', L);
        case 'splitShares': return String(d.total / d.n);
        case 'decimalDivide': return shiftStr(String(d.dividendTenths / d.k), -1);
        case 'cuboidVolume': return d.l * d.w * d.h + ' ' + (L === 'zh' ? '立方公分' : 'cm³');
        case 'avgCalc': return String(d.sum / d.n);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, L){
      const range = (v, lo, hi) => (v >= lo && v <= hi) ? null : 'option ' + s + ' outside ' + lo + '~' + hi;
      if (genId === 'kgToTon' || genId === 'truckTotal'){
        const m = s.match(L === 'zh' ? /^(\d+(?:\.\d+)?) 公噸$/ : /^(\d+(?:\.\d+)?) t$/);
        if (!m) return 'option "' + s + '" is not "number + space + tonnes"';
        return range(+m[1], 0.1, 80);
      }
      if (genId === 'kgToCompound'){
        const m = s.match(L === 'zh' ? /^(\d+) 公噸 (\d+) 公斤$/ : /^(\d+) t (\d+) kg$/);
        if (!m) return 'option "' + s + '" is not "a t b kg"';
        if (!(+m[2] >= 1 && +m[2] <= 999)) return 'option "' + s + '" has ' + m[2] + ' kg (must be 1~999)';
        return range(+m[1], 1, 9);   /* 總重 1010～6450 公斤：「0 公噸 …」不是寫法 */
      }
      if (genId === 'decimalDivide'){
        if (!/^\d+(?:\.\d)?$/.test(s)) return 'option "' + s + '" is not a number with at most one decimal place';
        return range(+s, 0.1, 100);
      }
      if (genId === 'cuboidVolume'){
        const m = s.match(L === 'zh' ? /^(\d+) 立方公分$/ : /^(\d+) cm³$/);
        if (!m) return 'option "' + s + '" is not "n cm³"';
        return range(+m[1], 1, 300);
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      if (genId === 'tonToKg') return range(+s, 100, 80000);
      if (genId === 'compoundToKg') return range(+s, 100, 8080);   /* 1～7 公噸、10～980 公斤：正解最多 7980，誘答多 100 */
      if (genId === 'splitShares') return range(+s, 50, 10000);
      if (genId === 'avgCalc') return range(+s, 1, 100);
    },
    /* 題幹與解釋的算式交給這一課的驗算器（單位真的換算、小數、商餘） */
    renderCheck: function(d, q, L, genId){
      /* simgen 共用的「誘答抄題幹」只比純數字的選項；這一課的選項多半帶單位或是小數（「4.6」「6 立方公分」），
         那條檢查一次都不會響 —— 這裡把每個誘答的數（含小數）和題幹裡印出來的數（含小數）比。 */
      const stemNums = nums(q.stem);
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const v = nums(q.opts[i]);
        if (v.length === 1 && stemNums.indexOf(v[0]) >= 0) return 'distractor "' + q.opts[i] + '" copies the number ' + v[0] + ' out of the stem';
      }
      const r = weightClaims(q.stem + '\n' + q.why);
      if (r.problems.length) return 'claims: ' + r.problems[0];
      if (!r.verified) return 'the explanation has no verifiable equation: ' + q.why;
    }
  },

  data: {
    dataStart: '  /* ---------- 語言無關的資料',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{UNIT, divExact, gTo, OBJS, LADDER_STARTS, COMPOUNDS, TRUCK_LIMITS, CARGO, GAME_ORDER, GPICK, shuffle, pick, unsorted, wStr, tkgStr, cardStr, UNITS, GAME_UNIT, UNITB, UNIT_H, unitOf, unitPick, unitWhy, unitOkText, LV, POINT, POINT_H, GAME_POINT, pointCells, pointRead, pointTarget, pointX0, pointGapX, pointGap, pointWhy, WRITE, WRITE_H, GAME_WRITE, writeDigits, writeWhy, LOAD, LOAD_H, GAME_LOAD, loadRefuse, loadPlan, ORDER, ORDER_H, GAME_ORDERW, orderTray, orderRank, orderWhy}',
    check: function(data, I18N, fail, src){
      const D = data, W = 300, EPS = 1e-9;
      /* 一句話：沒有 undefined／NaN、英文沒有中文、算式全部驗得過；want 給了就逐個比數字 */
      let claimCount = 0;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: missing space between Chinese and a digit in "' + s + '"');
        const r = weightClaims(s);
        claimCount += r.verified;
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p));
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r;
      };
      const has = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (s.indexOf(w) < 0) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 驗算器自己先證明會響（正反例） --- */
      CLAIM_PROBES.forEach(([t, bad]) => {
        const r = weightClaims(t);
        if (bad !== (r.problems.length > 0)) fail('weightClaims() self-test: "' + t + '" should be ' + (bad ? 'rejected' : 'accepted') + ', got ' + JSON.stringify(r.problems));
        if (!bad && !r.verified && !/？/.test(t)) fail('weightClaims() self-test: "' + t + '" verified nothing');
      });
      CLAIMS_SEEN.length = 0;

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）逐條驗算；驗過的條數與指紋釘住 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let staticClaims = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => { if (/\.(btn|htmlLang)$/.test(where)) return; staticClaims += say(where, L, s).verified; }));
      const staticSeen = CLAIMS_SEEN.slice().sort();
      const fp = crypto.createHash('sha1').update(staticSeen.join('\n')).digest('hex').slice(0, 12);
      if (staticClaims < 20) fail('only ' + staticClaims + ' equations verified in the I18N strings — the claim scan is not reading them');
      if (module.exports.data.STATIC_PIN && (staticClaims !== module.exports.data.STATIC_PIN.n || fp !== module.exports.data.STATIC_PIN.fp))
        fail('the verified static equations changed: ' + staticClaims + ' / ' + fp + ' (pinned ' + module.exports.data.STATIC_PIN.n + ' / ' + module.exports.data.STATIC_PIN.fp + ') — re-check them and update STATIC_PIN');

      /* 遊戲的引言要對五關都成立：第 1 關是選單位，不是「先把單位換成一樣」（驗證者 D2） */
      LANGS.forEach(L => { const t = I18N[L].s6lead; hasNot('s6lead', L, t, { zh:['每一關都要', '先把單位換成一樣'], en:['every one starts with', 'making the units the same'] }); });
      if (/先把單位換成一樣|making the units the same/.test(src)) fail('s6lead: the old claim "every round starts with making the units the same" is still in index.html');

      /* 題庫：解釋裡要真的出現被標成正解的那個數 */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => LANGS.forEach(L => (I18N[L][bank] || []).forEach((q, i) => {
        const v = nums(q.opts[q.ans])[0];
        if (v === undefined || nums(q.why).indexOf(v) < 0) fail(bank + '[' + i + '] ' + L + ': the explanation never reaches the marked answer ' + q.opts[q.ans]);
      })));

      /* --- 2. 範例的句子函式：拿這一課自己的資料呼叫，逐條驗算 --- */
      LANGS.forEach(L => {
        const d = I18N[L];
        /* 換算階梯：每一個起點、往下兩階、再往上兩階 */
        (D.LADDER_STARTS || []).forEach(t => {
          const g = t * 1000000;
          const down1 = d.eqDown(D.gTo(g, 't'), 't', D.gTo(g, 'kg'), 'kg'), down2 = d.eqDown(D.gTo(g, 'kg'), 'kg', D.gTo(g, 'g'), 'g');
          const up1 = d.eqUp(D.gTo(g, 'g'), 'g', D.gTo(g, 'kg'), 'kg'), up2 = d.eqUp(D.gTo(g, 'kg'), 'kg', D.gTo(g, 't'), 't');
          [down1, down2, up1, up2].forEach((s, i) => { const r = say('example 2 ladder ' + t + ' t #' + i, L, s); if (r.verified !== 1) fail('example 2 ladder ' + L + ': "' + s + '" did not verify exactly one claim'); });
        });
        /* 化聚：拆開來／合起來 */
        (D.COMPOUNDS || []).forEach(c => {
          const total = c.t * 1000 + c.kgRem, q = Math.floor(total / 1000), r = total % 1000;
          say('example 3 compA1', L, d.compALine1(c.t), [String(c.t), String(c.t * 1000)]);
          say('example 3 compA2', L, d.compALine2(c.t * 1000, c.kgRem, total), [String(c.t * 1000), String(c.kgRem), String(total)]);
          say('example 3 compAFinal', L, d.compAFinal(total), [String(total)]);
          const rB = say('example 3 compB1', L, d.compBLine1(total), [String(total), '1000', String(q), String(r)]);
          if (rB.verified !== 1) fail('example 3 compB1 ' + L + ': the quotient/remainder line was not verified');
          say('example 3 compBFinal', L, d.compBFinal(q, r), [String(c.t), String(c.kgRem)]);
          if (q !== c.t || r !== c.kgRem) fail('example 3: ' + total + ' kg is not ' + c.t + ' t ' + c.kgRem + ' kg');
        });
        /* 卡車檢查站：上限、目前總重、還可以裝／超重 */
        (D.TRUCK_LIMITS || []).forEach(t => {
          say('example 4 limitLine', L, d.limitLine(t), [String(t), String(t * 1000)]);
          const n = D.CARGO.length;
          for (let mask = 1; mask < (1 << n); mask++){
            let kg = 0; for (let i = 0; i < n; i++) if (mask & (1 << i)) kg += D.CARGO[i].kg;
            say('example 4 truckLabel', L, d.truckLabel(String(kg), inUnit(kg * 1000, 't')), [String(kg), inUnit(kg * 1000, 't')]);
            if (kg <= t * 1000) say('example 4 truckOk', L, d.truckOk(t * 1000 - kg), [String(t * 1000 - kg)]);
            else say('example 4 truckOver', L, d.truckOver(kg - t * 1000), [String(kg - t * 1000)]);
          }
        });
        /* 秤重大冒險：每一樣東西的單位就是「讓數字不小於 1 的最大單位」，句子裡的重量就是那個單位寫出來的樣子 */
        (D.OBJS || []).forEach(o => {
          if (o.unit !== unitRef(o.grams)) fail('example 1: ' + o.id + ' (' + o.grams + ' g) is marked ' + o.unit + ', the rule says ' + unitRef(o.grams));
          const w = d.fmtW(D.gTo(o.grams, o.unit), o.unit);
          const rt = d.objRight(d.objs[o.id], w);
          say('example 1 objRight', L, rt);
          if (rt.indexOf(inUnit(o.grams, o.unit) + ' ' + U_W[L][o.unit]) < 0) fail('example 1 objRight ' + L + ': "' + rt + '" does not say ' + inUnit(o.grams, o.unit) + ' ' + U_W[L][o.unit]);
          const wr = d.objWrong(d.objs[o.id], w, o.unit);
          say('example 1 objWrong', L, wr);
          if (wr.indexOf(inUnit(o.grams, o.unit) + ' ' + U_W[L][o.unit]) < 0) fail('example 1 objWrong ' + L + ': "' + wr + '" does not say the weight');
        });
        /* 卡車的貨物卡：公噸寫的那幾樣，寫出來的數就是 kg ÷ 1000 */
        (D.CARGO || []).forEach(c => { if (D.gTo(c.kg * 1000, c.unit) !== inUnit(c.kg * 1000, c.unit)) fail('example 4 cargo ' + c.id + ': gTo() wrote ' + D.gTo(c.kg * 1000, c.unit)); });
      });

      /* ================= 3. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：載重過磅');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['unit', 'point', 'write', 'load', 'order'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 3+4), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };
      /* 第一層提示的意思：必須說／不可以說（數字不變、意思反過來的改法也要抓得到） */
      const HINT_SEM = {
        unit: { has:{ zh:['不到 1000 公克用公克', '1000 公克（1 公斤）以上用公斤', '1000 公斤（1 公噸）以上用公噸'], en:['Under 1000 g, use grams', '1000 g (1 kg) or more, use kilograms', '1000 kg (1 t) or more, use tonnes'] }, not:{ zh:['100 公克'], en:['100 g'] } },
        point: { has:{ zh:['× 1000 或 ÷ 1000', '比較小的單位，數字變大，小數點往右移 3 位', '比較大的單位，數字變小，往左移 3 位'], en:['× 1000 or ÷ 1000', 'smaller unit makes the number bigger — move the point 3 places right', 'bigger unit makes it smaller — 3 places left'] }, not:{ zh:['移 2 位', '往左移 3 位；換成比較大'], en:['2 places'] } },
        write: { has:{ zh:['× 1000', '寫 0'], en:['× 1000', 'writing 0'] }, not:{ zh:['× 100）'], en:['× 100)'] } },
        load: { has:{ zh:['換成公斤', '剛好等於上限'], en:['into kilograms', 'exactly the limit'] }, not:{ zh:['超過上限的'], en:['over the limit'] } },
        order: { has:{ zh:['換成公斤', '1 公噸是 1000 公斤'], en:['into kilograms', '1 tonne is 1000 kg'] }, not:{ zh:['100 公斤'], en:['100 kg'] } }
      };
      TYPES.forEach(t => LANGS.forEach(L => {
        const h = I18N[L].gHints && I18N[L].gHints[t];
        if (typeof h !== 'string') return;
        say('gHints.' + t, L, h);
        has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not);
        say('gAsks.' + t, L, I18N[L].gAsks[t]);
      }));
      /* 畫出來的字和被判斷的值綁在一起 */
      need('unit', /parts:\[\['gic', o\.icon\], \['gnm', d\.gUnitNames\[o\.id\]\]\], cls:'gcard', label:d\.gUnitNames\[o\.id\], data:\{ o:o \} \}\);/, 'a card does not show the thing it is judged as');
      need('unit', /addZone\(B, UNITB\.x\[i\] \+ 4, UNITB\.y \+ 4, UNITB\.w - 8, UNITB\.lblH, 'gbinlbl', d\.gUnitBins\[u\]\);\s*return \{ u:u, i:i,/, 'a box does not show the unit it is judged as');
      need('unit', /var o = P\.data\.o, why = unitWhy\(d, o, bin\.u, lang\);/, 'the thing / box judged is not the one dropped');
      need('unit', /'gchip', o\.icon \+ ' ' \+ wStr\(o\.g, bin\.u, lang\)\);/, 'a placed thing does not show its weight in the box\'s unit');
      need('point', /cells\.push\(addZone\(B, x0 \+ i \* POINT\.cw, POINT\.y, POINT\.cw, POINT\.h, 'gdig', c\.digits\.charAt\(i\)\)\);/, 'the digit cells do not show the number\'s digits');
      /* 紅點本身拖得動、和把手一樣吸縫；兩個都停在被判斷的那一個縫（驗證者 D1） */
      need('point', /dotP = handle\(POINT\.dotY, GPICK, GPICK, 'gdotp', undefined, d\.gPointAria\.grip\);\n\s*var dotMark = document\.createElement\('span'\); dotMark\.className = 'gdot'; dotP\.el\.appendChild\(dotMark\);\n/, 'the red dot itself cannot be dragged');
      if (/dotP\.el\.style\.pointerEvents|\.gdotp\{[^}]*pointer-events:none/.test(src)) fail('GAME point: the red dot itself cannot be dragged (pointer-events off)');
      need('point', /function handle\(cy, w, h, cls, text, label\)\{\s*return addPiece\(B, \{ w:w, h:h, cx:pointGapX\(n, g\), cy:cy, text:text, cls:cls, label:label, axis:'x',/, 'the dot / handle is not a piece that drags along the strip');
      need('point', /\[dotP, grip\]\.forEach\(function\(P\)\{ if \(P && !P\.busy\(\) && P\.homeX !== pointGapX\(n, g\)\) P\.rehome\(pointGapX\(n, g\), P\.homeY\); \}\);/, 'the red dot is not drawn at the gap being judged (the other handle does not follow)');
      need('point', /var onDigits = pt\.y >= POINT\.y && pt\.y <= POINT\.y \+ POINT\.h, onRail = pt\.y >= POINT\.railY - 22 && pt\.y <= POINT\.railY \+ 22;\s*if \(!onDigits && !onRail\) return;/, 'a tap between two digits does not move the point');
      need('point', /read\.textContent = d\.gPointRead\(pointRead\(c\.digits, g\), it\.to\);/, 'the line under the digits does not show what is judged');
      need('point', /var why = pointWhy\(d, it, g\);/, 'Done does not judge the gap that is shown');
      need('point', /snapX:function\(x\)\{ return pointGapX\(n, pointGap\(n, x\)\); \},/, 'the grip does not snap to a gap while dragged');
      need('point', /onPlace:function\(P\)\{ var ng = pointGap\(n, P\.cx\); if \(ng !== g && !gSolved\)\{ g = ng; clearNote\(\); draw\(\); \} \} \}\);/, 'the dot does not follow the grip while it is dragged');
      need('write', /addZone\(B, WRITE\.slotX\[i\], WRITE\.lblY, WRITE\.slotW, WRITE\.lblH, 'gslotlbl', d\.gPlaceLbl\[i\]\);/, 'a box does not show its place');
      need('write', /text:String\(v\), cls:'gcard gdigcard', data:\{ v:v \} \}\);/, 'a digit card does not show the digit it is judged as');
      need('write', /var v = P\.data\.v, why = writeWhy\(d, t, kg, s\.i, v\);/, 'the digit / box judged is not the one dropped');
      need('write', /s\.z\.textContent = String\(v\);/, 'a filled box does not show the digit placed');
      need('load', /parts:\[\['gic', c\.icon\], \['gwt', cardStr\(c, lang\)\]\], cls:'gcard', label:cardStr\(c, lang\), data:\{ c:c, j:j \} \}\);/, 'a cargo card does not show the weight it is judged by');
      need('load', /var c = P\.data\.c, total = loadRefuse\(e\.limitT, sumKg, c\.kg\);/, 'the cargo judged is not the one dropped');
      need('load', /line\.textContent = d\.gLoadNow\(e\.limitT, sumKg\);\s*fill\.style\.width = \(sumKg \/ limitKg \* 100\) \+ '%';/, 'the trail / gauge does not show the load judged');
      need('load', /if \(sumKg === limitKg\)\{/, 'the round is not solved exactly at the limit');
      need('load', /loaded\.forEach\(function\(P\)\{ P\.unlock\(\); \}\);\s*loaded = \[\]; sumKg = 0;/, 'Unload all does not empty the truck');
      need('order', /text:cardStr\(c, lang\), cls:'gcard gwcard', data:\{ c:c \} \}\);/, 'a card does not show the weight it is judged by');
      need('order', /var c = P\.data\.c, why = orderWhy\(d, set, c, s\.i, lang\);/, 'the card / box judged is not the one dropped');
      need('order', /addZone\(B, ORDER\.lblX, y, ORDER\.lblW, ORDER\.slotH, 'gslotlbl', d\.gOrderSlots\[i\]\);/, 'a box does not show its rank');
      /* 「同一個錯」的鍵就是「哪一樣東西放進哪裡」—— 不可以帶進會變的東西（現在的重量），不然同一個錯會重複扣分（codex 第一輪 1a #1／1b #1） */
      need('unit', /roundMiss\(why, o\.id \+ '>' \+ bin\.u\);/, 'mistake key: a thing into a box is not keyed by (thing, box)');
      need('point', /roundMiss\(why, 'g' \+ g\); return; \}/, 'mistake key: Done is not keyed by the gap');
      need('write', /roundMiss\(why, s\.i \+ ':' \+ v\);/, 'mistake key: a digit into a box is not keyed by (box, digit)');
      need('load', /c\.f === 'kg'\), P\.data\.j \+ '>truck'\); return false; \}/, 'mistake key: a cargo onto the truck is not keyed by the cargo alone (the same cargo is charged again at another load)');
      need('order', /roundMiss\(why, c\.kg \+ '@' \+ s\.i\);/, 'mistake key: a card into a row is not keyed by (card, row)');
      if ((gsrc.match(/roundMiss\(/g) || []).length !== 6) fail('GAME: roundMiss() is called ' + (gsrc.match(/roundMiss\(/g) || []).length + ' times, expected 6 (the definition + one per round) — a new call has an unchecked key');
      need('point', /dotP\.rehome\(pointGapX\(n, g\), POINT\.dotY\); grip\.rehome\(pointGapX\(n, g\), POINT\.knobY\);   \/\* 換好了：先收把手 \*\/\s*var why = pointWhy\(d, it, g\);/, 'Done does not end a held grip — the grip can snap back to the start while the dot stays on the answer');

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.axis === 'x'\) P\.place\(o\.snapX\(orig\.x \+ dx\), orig\.y\);/, 'the decimal point does not snap to a gap while it is dragged');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      ['unit', 'write', 'load', 'order'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint — a level-2 hint stays on the solved board');
      }
      need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(gsrc, 'roundMiss');
        if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
        else {
          const run = (s0, keys) => new Function('var gMistake = false, gScore = ' + s0 + ', gCtx = {}, elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc +
            '\nvar out = []; ' + JSON.stringify(keys) + '.forEach(function(k){ roundMiss("why " + k, k); out.push({ s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake }); }); return out;')();
          let r;
          try {
            [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
              r = run(s0, ['a'])[0];
              if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
              if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
              if (r.html.indexOf('why a') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
            });
            r = run(20, ['a', 'a', 'b', 'a']);
            if (r.map(x => x.s).join() !== '15,15,10,10') fail('GAME scoring: the same mistake again is charged again (scores ' + r.map(x => x.s).join() + ', expected 15,15,10,10)');
            if (r[1].html.indexOf('@MINUS@') >= 0 || r[1].html.indexOf('why a') < 0) fail('GAME scoring: a repeated mistake should show its reason again without "−5"');
          } catch (e){ fail('GAME scoring: roundMiss() could not run: ' + e.message); }
        }
      }
      if (/function roundNote\(text\)\{[^}]*(gMistake|gScore)/.test(gsrc)) fail('GAME: roundNote() changes the score or records a mistake');
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85), L === 'zh' ? ['85'] : ['5', '85']);
        say('gClear', L, d.gClear, []);
      });

      /* --- shuffle()：切出來真的跑；托盤不可以一開始就照答案排好 --- */
      let shuffleFn = null;
      {
        const fsrc = extractFunction(src, 'shuffle');
        if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
        else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
        if (shuffleFn){
          const seen = new Set();
          for (let i = 0; i < 400; i++){
            const a = [1, 2, 3, 4], r = shuffleFn(a);
            if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
            seen.add(r.join());
          }
          if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
        }
      }

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(gsrc, 'nearestOpen');
        if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const two = [{ id:0, cx:60, cy:100, hw:60, hh:40, done:false }, { id:1, cx:140, cy:100, hw:20, hh:20, done:false }];
          const r0 = nearestOpen(two, { x:115, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:144, cy:100, hw:20, hh:20, done:false }];
          if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
          const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:false }];
          if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
          if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
          const pair = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:false }, { id:1, cx:146, cy:100, hw:20, hh:20, done:false }];
          const r1 = nearestOpen(pair, { x:124.5, y:100 }, 6);
          if (!r1 || r1.id !== 1) fail('GAME nearestOpen(): a drop in the overlap nearer to the second box goes to the first match');
        }
      }
      /* 收件範圍整片每 0.5px：和自己的「最近的方框」比，而且要真的有重疊的地方 */
      const nearestBox = (list, p, pad) => {
        let best = null, bd = Infinity, bc = Infinity;
        for (const b of list){
          const dx = Math.abs(p.x - b.cx), dy = Math.abs(p.y - b.cy);
          if (dx > b.hw + pad || dy > b.hh + pad) continue;
          const dd = Math.hypot(Math.max(0, dx - b.hw), Math.max(0, dy - b.hh)), dc = Math.hypot(dx, dy);
          if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
        }
        return best;
      };
      const sweepZones = (what, list, pad, H) => {
        if (!nearestOpen) return;
        let overlap = 0, bad = null;
        for (let y = 0; y <= H && !bad; y += 0.5) for (let x = 0; x <= W && !bad; x += 0.5){
          const p = { x, y }, a = nearestOpen(list, p, pad), b = nearestBox(list, p, pad);
          if ((a && a.id) !== (b && b.id)) bad = '(' + x + ', ' + y + ') goes to ' + (a ? a.id : 'none') + ', the nearest box is ' + (b ? b.id : 'none');
          if (list.filter(z => Math.abs(x - z.cx) <= z.hw + pad && Math.abs(y - z.cy) <= z.hh + pad).length > 1) overlap++;
        }
        if (bad) fail('GAME ' + what + ': ' + bad);
        /* 設計：相鄰兩格之間的縫要歸給比較近的那一格（卡片跨在兩格中間放下，不可以靜靜彈回）—— 所以放寬之後一定要重疊 */
        if (!overlap) fail('GAME ' + what + ': the drop zones never overlap — the gap between two adjacent boxes belongs to neither box (a drop straddling them would bounce), and the nearest-box rule is never exercised');
        for (const z of list) for (let y = z.cy - z.hh; y <= z.cy + z.hh; y += 1) for (let x = z.cx - z.hw; x <= z.cx + z.hw; x += 1){
          const a = nearestOpen(list, { x, y }, pad);
          if (!a || a.id !== z.id){ fail('GAME ' + what + ': a point inside box ' + z.id + ' (' + x + ', ' + y + ') goes to ' + (a ? a.id : 'none')); return; }
        }
      };

      const d0 = I18N.zh, d1 = I18N.en;

      /* ===== 第 1 關：選單位 ===== */
      {
        const G = D.GAME_UNIT || [];
        const ids = new Set(G.map(o => o.id));
        /* 單位的分界：999 公克還是公克、1000 公克就是公斤……（整條規則，不只題庫裡的那幾個數） */
        [1, 10, 999, 1000, 1001, 35000, 999999, 1000000, 1000001, 12000000].forEach(g => { if (D.unitOf(g) !== unitRef(g)) fail('GAME unitOf(' + g + ') is ' + D.unitOf(g) + ', the rule says ' + unitRef(g)); });
        /* 和範例 1 是同一樣東西的，重量要一樣（雞蛋在範例裡 60 公克，遊戲裡也是） */
        G.forEach(o => (D.OBJS || []).forEach(e => { if (e.id === o.id && e.grams !== o.g) fail('GAME unit: ' + o.id + ' weighs ' + o.g + ' g in the game but ' + e.grams + ' g in example 1 — it does not match example 1'); }));
        if (G.filter(o => (D.OBJS || []).some(e => e.id === o.id)).length < 4) fail('GAME unit: fewer than four things are shared with example 1 — nothing pins their weights');
        if (ids.size !== G.length) fail('GAME unit: two things share an id');
        ['g', 'kg', 't'].forEach(u => { const k = G.filter(o => unitRef(o.g) === u).length; if (k < 2) fail('GAME unit: only ' + k + ' things weigh in ' + u + ' — a round needs two'); });
        G.forEach(o => {
          if (!(isInt(o.g) && o.g > 0)) fail('GAME unit: ' + o.id + ' has weight ' + o.g);
          if (D.unitOf(o.g) !== unitRef(o.g)) fail('GAME unitOf(' + o.g + ') is ' + D.unitOf(o.g) + ', the rule says ' + unitRef(o.g));
          /* 邊界上的數讓規則說不清：不放剛好 1000 公克或 1 公噸的東西 */
          if (o.g === 1000 || o.g === 1000000) fail('GAME unit: ' + o.id + ' sits exactly on a unit boundary');
          LANGS.forEach(L => {
            const d = I18N[L], name = d.gUnitNames && d.gUnitNames[o.id];
            if (!name) fail('GAME unit: gUnitNames.' + o.id + ' missing in ' + L);
            const u = unitRef(o.g);
            ['g', 'kg', 't'].forEach(bin => {
              const why = D.unitWhy(d, o, bin, L);
              if (bin === u){ if (why !== null) fail('GAME unitWhy(' + o.id + ', ' + bin + ') ' + L + ' refuses the right box'); return; }
              if (typeof why !== 'string'){ fail('GAME unitWhy(' + o.id + ', ' + bin + ') ' + L + ' accepts the wrong box'); return; }
              const right = wRef(o.g, u, L), there = wRef(o.g, bin, L);
              say('GAME unitWhy ' + o.id + '→' + bin, L, why);
              if (why.indexOf(right) < 0 || why.indexOf(there) < 0 || why.indexOf(name.toLowerCase ? (L === 'en' ? name.toLowerCase() : name) : name) < 0) fail('GAME unitWhy ' + L + ': "' + why + '" must name ' + name + ', ' + right + ' and ' + there);
              const bigger = LVL[bin] > LVL[u];
              /* 說的那件事要成立：大的箱子 → 換過去不到 1；小的箱子 → 換過去 1000 以上 */
              const val = ratOf(inUnit(o.g, bin));
              if (bigger && !(rCmp(val, rat(1, 1)) < 0)) fail('GAME unitWhy ' + o.id + '→' + bin + ': says "less than 1" but it is ' + inUnit(o.g, bin));
              if (!bigger && !(rCmp(val, rat(1000, 1)) >= 0)) fail('GAME unitWhy ' + o.id + '→' + bin + ': says "1000 or more" but it is ' + inUnit(o.g, bin));
              if (bigger) has('GAME unitWhy ' + o.id + '→' + bin, L, why, { zh:['不到 1 ' + U_W.zh[bin]], en:['less than 1 ' + U_W.en[bin]] });
              else has('GAME unitWhy ' + o.id + '→' + bin, L, why, { zh:['1000 ' + U_W.zh[bin] + '以上'], en:['1000 ' + U_W.en[bin] + ' or more'] });
              has('GAME unitWhy ' + o.id + '→' + bin, L, why, { zh:['用' + U_W.zh[u]], en:['use ' + ({ g:'grams', kg:'kilograms', t:'tonnes' })[u]] });
              /* 差兩階：中間的公斤也要說，而且說的那件事要成立（驗證者：大象放進公克不可以跳過公斤） */
              if (Math.abs(LVL[bin] - LVL[u]) === 2){
                const mid = wRef(o.g, 'kg', L), mv = ratOf(inUnit(o.g, 'kg'));
                if (why.indexOf(mid) < 0) fail('GAME unitWhy ' + o.id + '→' + bin + ' ' + L + ': a two-step miss must also say it in kilograms (' + mid + '): ' + why);
                if (bigger){ has('GAME unitWhy two-step', L, why, { zh:['也不到 1 公斤'], en:['also less than 1 kg'] }); if (!(rCmp(mv, rat(1, 1)) < 0)) fail('GAME unitWhy ' + o.id + ': says "also less than 1 kg", it is ' + mid); }
                else { has('GAME unitWhy two-step', L, why, { zh:['也有 1000 公斤以上'], en:['also 1000 kg or more'] }); if (!(rCmp(mv, rat(1000, 1)) >= 0)) fail('GAME unitWhy ' + o.id + ': says "also 1000 kg or more", it is ' + mid); }
              } else hasNot('GAME unitWhy one-step', L, why, { zh:['換成公斤是'], en:['in kilograms it is'] });
            });
            const okT = D.unitOkText(d, o, L);
            say('GAME unitOkText ' + o.id, L, okT, [inUnit(o.g, u)].concat(u === 'g' ? ['1000'] : u === 'kg' ? (L === 'zh' ? ['1000', '1000'] : ['1000', '1000']) : ['1000']));
            has('GAME unitOkText ' + o.id, L, okT, { zh:['用' + U_W.zh[u]], en:[({ g:'so grams', kg:'so kilograms', t:'so tonnes' })[u]] });
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          ['g', 'kg', 't'].forEach(u => { if (typeof d.gUnitBins[u] !== 'string' || d.gUnitBins[u].indexOf(L === 'zh' ? U_W.zh[u] : '(' + U_W.en[u] + ')') < 0) fail('GAME gUnitBins.' + u + ' ' + L + ' does not name the unit: ' + d.gUnitBins[u]); });
          if (L === 'zh' && ['g', 'kg', 't'].some(u => d.gUnitBins[u] !== U_W.zh[u])) fail('GAME gUnitBins zh must read exactly 公克／公斤／公噸');
          say('gUnitNow', L, d.gUnitNow(3, 6), ['3', '6']);
          say('gUnitDone', L, d.gUnitDone, ['1']);
          say('gUnit2', L, d.gUnit2(d.gUnitNames.egg, d.gUnitBins.g), ['2']);
        });
        /* 每一次抽：每一種單位兩樣、托盤不照答案排好（3000 次） */
        for (let i = 0; i < 3000; i++){
          const t = D.unitPick();
          const us = t.map(o => unitRef(o.g));
          if (t.length !== 6 || ['g', 'kg', 't'].some(u => us.filter(x => x === u).length !== 2) || new Set(t.map(o => o.id)).size !== 6){ fail('GAME unitPick(): not two different things per unit: ' + t.map(o => o.id)); break; }
          if (us.every((u, j) => j === 0 || LVL[us[j - 1]] <= LVL[u])){ fail('GAME unitPick(): the tray starts in the answer order (' + t.map(o => o.id) + ')'); break; }
        }
        /* 版面 */
        const B = D.UNITB, H = D.UNIT_H;
        const bins = B.x.map((x, i) => ({ x, y:B.y, w:B.w, h:B.h }));
        bins.forEach((b, i) => inside(b, 'unit box ' + i, H));
        noHits(bins, 'unit boxes');
        const tray = [];
        for (let j = 0; j < 6; j++) tray.push(sq(B.trayX[j % 3], B.trayY[Math.floor(j / 3)], B.cardW, B.cardH));
        tray.forEach((c, j) => inside(c, 'unit card ' + j, H));
        noHits(tray.concat(bins), 'unit cards / boxes');
        tooSmall('unit card', Math.min(B.cardW, B.cardH));
        bins.forEach((b, i) => {
          if (B.lblH + 4 > B.chipY[0]) fail('GAME unit: the first placed chip covers the box label');
          B.chipY.forEach((cy, k) => { if (B.y + cy + B.chipH > B.y + B.h - 2) fail('GAME unit: placed chip ' + k + ' runs out of its box'); if (k && B.chipY[k - 1] + B.chipH > cy) fail('GAME unit: placed chips overlap'); });
          if (B.chipW > B.w - 6) fail('GAME unit: a placed chip is wider than its box');
        });
        sweepZones('unit boxes', bins.map((b, i) => ({ id:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2, done:false })), B.pad, H);
      }

      /* ===== 第 2 關：小數點搬家 ===== */
      {
        const P = D.POINT, H = D.POINT_H;
        const kinds = new Set();
        (D.GAME_POINT || []).forEach(it => {
          const lv = { g:0, kg:1, t:2 };
          if (!(it.from in lv) || !(it.to in lv) || Math.abs(lv[it.from] - lv[it.to]) !== 1) fail('GAME point: ' + it.v + ' ' + it.from + ' → ' + it.to + ' is not one step on the ladder');
          if (!/^\d+(?:\.\d+)?$/.test(it.v) || /^0\d/.test(it.v) || /\.\d*0$/.test(it.v)) fail('GAME point: "' + it.v + '" is not a plainly written number');
          kinds.add((lv[it.from] > lv[it.to] ? 'down' : 'up') + it.from);
          const c = D.pointCells(it.v), n = c.digits.length, down = lv[it.from] > lv[it.to];
          const want = shiftStr(it.v, down ? 3 : -3), tg = D.pointTarget(it);
          if (D.pointRead(c.digits, c.g0) !== it.v) fail('GAME point: the start reads ' + D.pointRead(c.digits, c.g0) + ', not ' + it.v);
          if (!(tg >= 1 && tg <= n)) fail('GAME point: the answer gap ' + tg + ' for ' + it.v + ' is off the strip (1~' + n + ')');
          if (D.pointRead(c.digits, tg) !== want) fail('GAME point: ' + it.v + ' ' + it.from + ' → ' + it.to + ' reads ' + D.pointRead(c.digits, tg) + ' at the answer gap, should be ' + want);
          if (!/^000/.test(c.digits) || !/000$/.test(c.digits)) fail('GAME point: ' + it.v + ' is not padded with three zeros each side');
          /* 畫得下：數字條在畫板裡、刻度範圍和數字條一樣寬 */
          inside({ x:D.pointX0(n), y:P.y, w:n * P.cw, h:P.h }, 'point digits for ' + it.v, H);
          /* 每一個縫都按一次「換好了」 */
          for (let g = 1; g <= n; g++){
            const r = shiftStr(it.v, g - c.g0);
            if (D.pointRead(c.digits, g) !== r) fail('GAME pointRead(' + it.v + ', ' + g + ') is ' + D.pointRead(c.digits, g) + ', should be ' + r);
            LANGS.forEach(L => {
              const d = I18N[L], why = D.pointWhy(d, it, g);
              if (g === tg){ if (why !== null) fail('GAME pointWhy(' + it.v + ', ' + g + ') refuses the right gap'); return; }
              if (g === c.g0){ if (why !== 'still') fail('GAME pointWhy(' + it.v + ', start) should only remind (still), got ' + why); return; }
              if (typeof why !== 'string' || why === 'still'){ fail('GAME pointWhy(' + it.v + ', ' + g + ') accepts a wrong gap'); return; }
              const m = g - c.g0, k = Math.abs(m), f = '1' + '0'.repeat(k), right = m > 0, op = right ? '×' : '÷';
              const rr = say('GAME pointWhy ' + it.v + ' @' + g, L, why);
              if (rr.verified < 1) fail('GAME pointWhy ' + L + ': no equation verified in "' + why + '"');
              if (why.indexOf(it.v + ' ' + op + ' ' + f + (L === 'zh' ? ' ＝ ' : ' = ') + r) < 0) fail('GAME pointWhy ' + L + ': "' + why + '" must compute ' + it.v + ' ' + op + ' ' + f + ' = ' + r);
              if (right === down){
                has('GAME pointWhy size ' + it.v, L, why, { zh:['移了 ' + k + ' 位', '要 ' + (down ? '×' : '÷') + ' 1000'], en:['moved the point ' + k + ' place', (down ? '×' : '÷') + ' 1000'] });
              } else {
                has('GAME pointWhy direction ' + it.v, L, why, { zh:['數字變' + (right ? '大' : '小') + '了', '數字要變' + (right ? '小' : '大')], en:['got ' + (right ? 'bigger' : 'smaller'), 'has to get ' + (right ? 'smaller' : 'bigger')] });
                /* 方向那一句說的事要成立：往右移 → 讀到的數真的比較大 */
                if ((rCmp(ratOf(r), ratOf(it.v)) > 0) !== right) fail('GAME pointWhy ' + it.v + ' @' + g + ': says the number got ' + (right ? 'bigger' : 'smaller') + ', it did not');
              }
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            const y = d.gPointYes(it.v, it.from, it.to, want);
            const ry = say('GAME gPointYes ' + it.v, L, y, [it.v, want, it.v, '1000', want]);
            has('GAME gPointYes', L, y, { zh:['換好了', (down ? '×' : '÷') + ' 1000'], en:['Done', (down ? '×' : '÷') + ' 1000'] });
            if (ry.verified < 2) fail('GAME gPointYes ' + L + ': "' + y + '" verified ' + ry.verified + ' equations, expected 2');
            say('GAME gPointNow ' + it.v, L, d.gPointNow(it.v, it.from, it.to), [it.v]);
            say('GAME gPointRead', L, d.gPointRead(want, it.to), [want]);
            const h2 = d.gPoint2(it.from, it.to);
            say('GAME gPoint2', L, h2, ['2', '1000', '3']);
            has('GAME gPoint2', L, h2, down ? { zh:['× 1000', '往右數 3 格'], en:['× 1000', '3 places right'] } : { zh:['÷ 1000', '往左數 3 格'], en:['÷ 1000', '3 places left'] });
          });
          /* 拖／點到 x：每一個縫（刻度）管它左右各半格；整條每 0.25px 和自己的「最近的刻度」比 */
          const x0 = D.pointX0(n);
          for (let x = x0 - P.cw; x <= x0 + (n + 1) * P.cw; x += 0.25){
            let best = 1;
            for (let gg = 1; gg <= n; gg++) if (Math.abs(x - (x0 + gg * P.cw)) < Math.abs(x - (x0 + best * P.cw)) - 1e-9) best = gg;
            const got = D.pointGap(n, x);
            const mid = Math.abs(((x - x0) / P.cw) % 1 - 0.5) < 1e-9;   /* 剛好在兩條刻度正中間：哪一條都可以 */
            if (got !== best && !mid){ fail('GAME pointGap(' + n + ', ' + x + ') = ' + got + ', the nearest tick is ' + best); break; }
            if (D.pointGapX(n, got) !== x0 + got * P.cw){ fail('GAME pointGapX() is not the tick position'); break; }
          }
        });
        ['downt', 'upkg'].forEach(k => { if (!kinds.has(k)) fail('GAME point: the pool has no ' + (k === 'downt' ? 'tonnes → kilograms' : 'kilograms → tonnes') + ' question'); });
        if (!kinds.has('downkg') && !kinds.has('upg')) fail('GAME point: the pool has no kilograms ↔ grams question');
        if (!(D.GAME_POINT || []).some(it => /^0\./.test(it.v)) || !(D.GAME_POINT || []).some(it => !/\./.test(it.v) && /0$/.test(it.v))) fail('GAME point: the pool needs a "0.x" number and a whole number ending in 0 (the zeros that come and go)');
        /* 版面：刻度、把手、讀數一行、數字條不重疊；把手夠大 */
        tooSmall('point grip', Math.min(D.GPICK, P.gripH));
        if (P.y + P.h > P.readY - 2 || P.readY + P.readH > P.railY - P.tickH / 2 - 2) fail('GAME point: the reading line runs into the digits or the ticks');
        if (P.railY + P.tickH / 2 > P.knobY - P.gripH / 2 + 2) fail('GAME point: the grip covers the ticks');
        if (P.knobY + P.gripH / 2 > H) fail('GAME point: the grip runs off the board');
        if (!(P.dotY > P.y && P.dotY < P.y + P.h)) fail('GAME point: the red dot is not drawn on the digits');
        if (P.dotY + D.GPICK / 2 > P.readY - 2) fail('GAME point: the red dot\'s pick-up area covers the reading line');
        tooSmall('point red dot', D.GPICK);
        LANGS.forEach(L => { const a = I18N[L].gAsks.point; has('gAsks.point', L, a, { zh:['把紅色的小數點拖到對的位置', '點兩個數字中間'], en:['Drag the red decimal point', 'tap between two digits'] }); });
        LANGS.forEach(L => has('gPointRead', L, I18N[L].gPointRead('2350', 'kg'), { zh:['現在是：2350 公斤'], en:['Now: 2350 kg'] }));
        LANGS.forEach(L => has('gPointStill', L, I18N[L].gPointStill, { zh:['拖紅點', '紅色把手', '點兩個數字中間', '刻度', '◀ ▶'], en:['drag the red dot', 'red handle', 'between two digits', 'on a tick', '◀ ▶'] }));
        /* 換縫之前先結束兩個把手的拖拉、兩個都停到新的縫；點紅點／把手照點的位置換縫（codex 第六輪） */
        need('point', /if \(ng !== g\)\{ g = ng; clearNote\(\); \}\s*dotP\.rehome\(pointGapX\(n, g\), POINT\.dotY\); grip\.rehome\(pointGapX\(n, g\), POINT\.knobY\);\s*draw\(\);/, 'changing the gap by a button or a tap does not end a held handle — the dot and the handle can show two different places');
        need('point', /B\.onTap = function\(P, pt\)\{ if \(pt\) setG\(pointGap\(n, pt\.x\)\); \};/, 'a tap on the edge of the dot / handle pick-up area is swallowed instead of moving to that gap');
        need(null, /if \(!moved\)\{ if \(B\.onTap\) B\.onTap\(P, B\.toBoard\(e\)\); return; \}/, 'a tap on a piece does not pass where it was tapped');
        LANGS.forEach(L => { const d = I18N[L]; if (!d.gPointBtns || !d.gPointBtns.ok || !d.gPointAria || !d.gPointAria.left) fail('GAME point: button labels missing in ' + L); say('gPointStill', L, d.gPointStill, []); });
      }

      /* ===== 第 3 關：拆開來寫 ===== */
      {
        const P = D.WRITE, H = D.WRITE_H, G = D.GAME_WRITE || [];
        if (G.filter(q => q[1] < 100).length * 2 < G.length) fail('GAME write: fewer than half the questions have under 100 kg (the middle 0)');
        if (!G.some(q => q[1] < 10)) fail('GAME write: no question has under 10 kg (two middle zeros)');
        G.forEach(([t, kg]) => {
          if (!(isInt(t) && t >= 1 && t <= 9 && isInt(kg) && kg >= 1 && kg <= 999)) fail('GAME write: ' + t + ' t ' + kg + ' kg is out of range (1~9 t, 1~999 kg)');
          const want = String(t * 1000 + kg).split('').map(Number);
          if (D.writeDigits(t, kg).join() !== want.join()) fail('GAME writeDigits(' + t + ', ' + kg + ') = ' + D.writeDigits(t, kg) + ', should be ' + want);
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let i = 0; i < 4; i++) for (let v = 0; v <= 9; v++){
              const why = D.writeWhy(d, t, kg, i, v);
              if (v === want[i]){ if (why !== null) fail('GAME writeWhy(' + t + ', ' + kg + ', ' + i + ', ' + v + ') refuses the right digit'); continue; }
              if (typeof why !== 'string'){ fail('GAME writeWhy(' + t + ', ' + kg + ', ' + i + ', ' + v + ') accepts a wrong digit'); continue; }
              if (i === 0) say('GAME writeWhy thousands', L, why, [String(t), String(t * 1000), String(t), String(v)]);
              else {
                say('GAME writeWhy ' + i, L, why, [String(kg), String(want[1]), String(want[2]), String(want[3]), String(want[i]), String(v)]);
                has('GAME writeWhy ' + i, L, why, { zh:[d.gPlaces[i] + '位要寫 ' + want[i]], en:['the ' + d.gPlaces[i] + ' digit is ' + want[i]] });
              }
            }
            const done = d.gWriteDone(t, kg, t * 1000 + kg);
            say('GAME gWriteDone', L, done, [String(t), String(kg), String(t * 1000), String(kg), String(t * 1000 + kg)]);
            if (kg < 100){
              const bad = String(t) + String(kg), z = d.gWriteZero(bad);
              say('GAME gWriteZero', L, z, ['0', bad, bad]);
              if (Number(bad) === t * 1000 + kg) fail('GAME gWriteZero: "' + bad + '" is not actually wrong');
            }
            say('GAME gWrite2', L, d.gWrite2(t, t * 1000, kg), ['2', String(t), String(t * 1000), String(kg)]);
            say('GAME gWriteNow', L, d.gWriteNow(t, kg), [String(t), String(kg)]);
            for (let i = 0; i < 4; i++) say('GAME gWriteOk', L, d.gWriteOk(d.gPlaces[i], want[i]), [String(want[i])]);
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!Array.isArray(d.gPlaces) || d.gPlaces.length !== 4 || !Array.isArray(d.gPlaceLbl) || d.gPlaceLbl.length !== 4) fail('GAME write: gPlaces / gPlaceLbl must have four entries in ' + L);
          const exp = L === 'zh' ? ['千', '百', '十', '個'] : ['Th', 'H', 'T', 'O'];
          if (d.gPlaceLbl.join() !== exp.join()) fail('GAME write: gPlaceLbl ' + L + ' must read ' + exp.join());
        });
        const slots = P.slotX.map(x => ({ x, y:P.slotY, w:P.slotW, h:P.slotH }));
        slots.forEach((s, i) => { inside(s, 'write box ' + i, H); inside({ x:s.x, y:P.lblY, w:P.slotW, h:P.lblH }, 'write place label ' + i, H); });
        noHits(slots.concat([{ x:P.unitX, y:P.slotY, w:P.unitW, h:P.slotH }]), 'write boxes / unit');
        if (P.lblY + P.lblH > P.slotY) fail('GAME write: the place labels run into the boxes');
        const tiles = [];
        for (let v = 0; v <= 9; v++) tiles.push(sq(P.tileX[v % 5], P.tileY[Math.floor(v / 5)], P.tile, P.tile));
        tiles.forEach((c, i) => inside(c, 'write digit card ' + i, H));
        noHits(tiles.concat(slots), 'write digit cards / boxes');
        tooSmall('write digit card', P.tile);
        sweepZones('write boxes', P.slotX.map((x, i) => ({ id:i, cx:x + P.slotW / 2, cy:(P.lblY + P.slotY + P.slotH) / 2, hw:P.slotW / 2, hh:(P.slotY + P.slotH - P.lblY) / 2, done:false })), P.pad, H);
        need('write', /cy:\(WRITE\.lblY \+ WRITE\.slotY \+ WRITE\.slotH\) \/ 2, hw:WRITE\.slotW \/ 2, hh:\(WRITE\.slotY \+ WRITE\.slotH - WRITE\.lblY\) \/ 2/, 'the drop zone is not the box plus its place label');
      }

      /* ===== 第 4 關：裝到剛好滿載 ===== */
      {
        const P = D.LOAD, H = D.LOAD_H;
        (D.GAME_LOAD || []).forEach((e, ei) => {
          const L0 = e.limitT * 1000, kgs = e.cargo.map(c => c.kg), n = kgs.length;
          if (!(isInt(e.limitT) && e.limitT >= 1 && e.limitT <= 9)) fail('GAME load set ' + ei + ': limit ' + e.limitT + ' t');
          if (n !== 5) fail('GAME load set ' + ei + ': ' + n + ' cargo cards, the tray holds 5');
          if (kgs.reduce((a, b) => a + b, 0) <= L0) fail('GAME load set ' + ei + ': everything together fits — just load it all');
          kgs.forEach((k, i) => { if (!(isInt(k) && k > 0 && k <= L0)) fail('GAME load set ' + ei + ': card ' + i + ' (' + k + ' kg) alone is over the limit or not whole'); });
          if (!e.cargo.some(c => c.f === 't') || !e.cargo.some(c => c.f === 'kg')) fail('GAME load set ' + ei + ': the cards must mix tonnes and kilograms');
          if (!e.cargo.some(c => c.f === 't' && c.kg < 1000)) fail('GAME load set ' + ei + ': no "0.x t" card (the decimal that hides 100s of kg)');
          e.cargo.forEach(c => { if (['t', 'kg'].indexOf(c.f) < 0) fail('GAME load set ' + ei + ': card form ' + c.f); });
          /* 每一種裝法（子集合）：裝得下的一定收、超過一定擋，至少一種剛好滿載；loadPlan() 和自己的搜尋一致 */
          let exact = 0;
          for (let mask = 0; mask < (1 << n); mask++){
            let s = 0; const rest = [];
            for (let i = 0; i < n; i++) if (mask & (1 << i)) s += kgs[i]; else rest.push(kgs[i]);
            if (s > L0) continue;
            if (s === L0) exact++;
            rest.forEach(k => {
              const r = D.loadRefuse(e.limitT, s, k);
              if (s + k > L0 ? r !== s + k : r !== null) fail('GAME loadRefuse(' + e.limitT + ', ' + s + ', ' + k + ') = ' + r);
            });
            const need = L0 - s;
            let canFinish = false;
            for (let m2 = 0; m2 < (1 << rest.length) && !canFinish; m2++){ let t = 0; for (let j = 0; j < rest.length; j++) if (m2 & (1 << j)) t += rest[j]; if (t === need) canFinish = true; }
            const plan = D.loadPlan(e.limitT, s, rest);
            if (s < L0 && canFinish !== !!plan) fail('GAME loadPlan(' + e.limitT + ', ' + s + ', ' + rest + ') = ' + plan + ' but a completion ' + (canFinish ? 'exists' : 'does not exist'));
            if (s < L0 && plan && plan.reduce((a, j) => a + rest[j], 0) !== need) fail('GAME loadPlan(' + e.limitT + ', ' + s + ') does not add up to the missing ' + need + ' kg');
            LANGS.forEach(L => {
              const d = I18N[L];
              say('GAME gLoadNow', L, d.gLoadNow(e.limitT, s), [String(e.limitT), String(s)]);
              if (s < L0){
                const h = plan ? d.gLoad2(need, plan.map(j => cardRef(e.cargo.filter((c, i) => !(mask & (1 << i)))[j], L)).join(d.gSep)) : d.gLoadStuck(e.limitT);
                say('GAME load hint 2', L, h);
                if (plan && nums(h)[1] !== String(need)) fail('GAME gLoad2 ' + L + ': "' + h + '" does not say the missing ' + need + ' kg');
              }
              rest.forEach((k, j) => {
                const c = e.cargo.filter((x, i) => !(mask & (1 << i)))[j];
                if (s + k > L0){
                  const w = d.gLoadOver(cardRef(c, L), k, s, s + k, e.limitT, L0, c.f === 'kg');
                  const r = say('GAME gLoadOver', L, w);
                  if (r.verified < (c.f === 'kg' ? 2 : 3)) fail('GAME gLoadOver ' + L + ': "' + w + '" verified only ' + r.verified + ' equations');
                  [String(s), String(k), String(s + k), String(L0)].forEach(x => { if (nums(w).indexOf(x) < 0) fail('GAME gLoadOver ' + L + ': "' + w + '" never says ' + x); });
                  has('GAME gLoadOver', L, w, { zh:['裝不下', '超過上限'], en:['will not fit', 'over the limit'] });
                  const wr = REF.loadOver(L, cardRef(c, L), k, s, s + k, e.limitT, L0, c.f === 'kg');
                  if (w !== wr) fail('GAME gLoadOver ' + L + ': "' + w + '" is not the canonical sentence "' + wr + '"');
                  if (!(s + k > L0)) fail('GAME gLoadOver: says over the limit, it is not');
                } else {
                  const w = d.gLoadOk(cardRef(c, L), k, c.f === 'kg');
                  const r = say('GAME gLoadOk', L, w);
                  if (c.f !== 'kg' && r.verified !== 1) fail('GAME gLoadOk ' + L + ': "' + w + '" does not convert the card to kg');
                }
              });
            });
          }
          if (!exact) fail('GAME load set ' + ei + ': no way to load exactly ' + e.limitT + ' t');
          LANGS.forEach(L => {
            const d = I18N[L];
            e.cargo.forEach(c => { if (kgOfText(cardRef(c, L), L) !== c.kg) fail('GAME load: the card "' + cardRef(c, L) + '" does not read ' + c.kg + ' kg'); if (D.cardStr(c, L) !== cardRef(c, L)) fail('GAME cardStr(' + JSON.stringify(c) + ', ' + L + ') = "' + D.cardStr(c, L) + '", should be "' + cardRef(c, L) + '"'); });
            for (let mask = 1; mask < (1 << n); mask++){
              let s = 0; const ks = [];
              for (let i = 0; i < n; i++) if (mask & (1 << i)){ s += kgs[i]; ks.push(kgs[i]); }
              if (s !== L0) continue;
              /* 頁面依「裝上去的順序」列出來：每一種裝法的每一種順序都要比（codex 第四輪） */
              const perms = a => a.length <= 1 ? [a] : a.reduce((acc, x, i) => acc.concat(perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p))), []);
              perms(ks).forEach(order => {
                const w = d.gLoadDone(order, s, e.limitT);
                const r = say('GAME gLoadDone', L, w);
                has('GAME gLoadDone', L, w, { zh:['剛好滿載'], en:['Exactly full'] });
                if (w !== REF.loadDone(L, order, s, e.limitT)) fail('GAME gLoadDone ' + L + ': "' + w + '" is not the canonical sentence "' + REF.loadDone(L, order, s, e.limitT) + '"');
                if (r.verified !== 2) fail('GAME gLoadDone ' + L + ': "' + w + '" verified ' + r.verified + ' equations, expected 2');
              });
            }
          });
        });
        /* 版面 */
        const truck = { x:P.truckX, y:P.truckY, w:P.truckW, h:P.truckH };
        inside(truck, 'load truck', H);
        inside({ x:P.barX, y:P.barY, w:P.barW, h:P.barH }, 'load gauge', H);
        if (P.truckY + P.truckH + P.pad > P.barY + 2) fail('GAME load: the truck\'s drop zone covers the gauge');
        const tray = P.trayX.map((x, j) => sq(x, P.trayY[j], P.cardW, P.cardH));
        tray.forEach((c, j) => inside(c, 'load card ' + j, H));
        noHits(tray.concat([{ x:P.barX, y:P.barY, w:P.barW, h:P.barH }, truck]), 'load cards / gauge / truck');
        tray.forEach((c, j) => { if (c.y < P.truckY + P.truckH + P.pad) fail('GAME load: card ' + j + ' sits in the truck\'s drop zone'); });
        tooSmall('load card', Math.min(P.cardW, P.cardH));
        const chips = [];
        for (let k = 0; k < 5; k++) chips.push({ x:P.chipX[k % 2], y:P.chipY[Math.floor(k / 2)], w:P.chipW, h:P.chipH });
        chips.forEach((c, k) => { if (!(c.x >= P.bedX + 2 && c.y >= P.bedY + 2 && c.x + c.w <= P.bedX + P.bedW - 2 && c.y + c.h <= P.bedY + P.bedH - 2)) fail('GAME load: loaded chip ' + k + ' is not inside the truck bed'); });
        noHits(chips, 'load chips');
        if (P.bedX + P.bedW > P.cabX) fail('GAME load: the bed runs into the cab');
      }

      /* ===== 第 5 關：排輕重 ===== */
      {
        const P = D.ORDER, H = D.ORDER_H;
        (D.GAME_ORDERW || []).forEach((set, si) => {
          const kgs = set.map(c => c.kg);
          if (set.length !== 4 || new Set(kgs).size !== 4) fail('GAME order set ' + si + ': needs four different weights');
          const forms = set.map(c => c.f);
          if (forms.filter(f => f === 't').length !== 2 || forms.indexOf('tkg') < 0 || forms.indexOf('kg') < 0) fail('GAME order set ' + si + ': needs two decimal tonnes, one "t + kg" and one kg card');
          /* 迷思：「2 公噸 80 公斤」不是 2.8 公噸 —— 那一張拿去當小數公噸讀，排的位置就不一樣 */
          const tk = set.filter(c => c.f === 'tkg')[0];
          if (tk){
            if (!(tk.kg % 1000 < 100)) fail('GAME order set ' + si + ': the "t + kg" card has ' + (tk.kg % 1000) + ' kg — the trap needs under 100 kg');
            const misread = Math.floor(tk.kg / 1000) * 1000 + Number(('0.' + (tk.kg % 1000)).slice(0)) * 1000;
            const rankTrue = kgs.filter(k => k < tk.kg).length, rankMis = kgs.filter(k => k !== tk.kg && k < misread).length;
            if (rankTrue === rankMis) fail('GAME order set ' + si + ': reading ' + cardRef(tk, 'zh') + ' as a decimal (' + misread + ' kg) puts it in the same place — the trap does nothing');
          }
          set.forEach(c => { if (!(isInt(c.kg) && c.kg > 0 && c.kg < 10000)) fail('GAME order set ' + si + ': weight ' + c.kg); if (c.f === 't' && !/\./.test(inUnit(c.kg * 1000, 't'))) fail('GAME order set ' + si + ': the tonnes card ' + c.kg + ' is a whole number of tonnes'); });
          const sorted = kgs.slice().sort((a, b) => a - b);
          LANGS.forEach(L => {
            const d = I18N[L];
            set.forEach(c => {
              if (D.cardStr(c, L) !== cardRef(c, L) || kgOfText(D.cardStr(c, L), L) !== c.kg) fail('GAME order: cardStr(' + JSON.stringify(c) + ', ' + L + ') = "' + D.cardStr(c, L) + '", should be "' + cardRef(c, L) + '"');
              if (D.orderRank(set, c) !== sorted.indexOf(c.kg)) fail('GAME orderRank(' + c.kg + ') is not its place among ' + kgs);
              for (let i = 0; i < 4; i++){
                const why = D.orderWhy(d, set, c, i, L);
                const r = sorted.indexOf(c.kg);
                if (i === r){ if (why !== null) fail('GAME orderWhy(' + c.kg + ', ' + i + ') refuses the right box'); continue; }
                if (typeof why !== 'string'){ fail('GAME orderWhy(' + c.kg + ', ' + i + ') accepts a wrong box'); continue; }
                const rr = say('GAME orderWhy', L, why);
                if (c.f !== 'kg' && rr.verified !== 1) fail('GAME orderWhy ' + L + ': "' + why + '" does not convert to kg');
                if (why.indexOf(String(c.kg)) < 0 || why.indexOf(d.gOrderSlots[r]) < 0 || why.indexOf(d.gOrderSlots[i]) < 0) fail('GAME orderWhy ' + L + ': "' + why + '" must say ' + c.kg + ' kg, its place and the wrong place');
                if (r && nums(why).indexOf(String(r)) < 0) fail('GAME orderWhy ' + L + ': "' + why + '" must say ' + r + ' are lighter');
                if (!r) has('GAME orderWhy lightest', L, why, { zh:['沒有比它輕的'], en:['none of the four is lighter'] });
                else has('GAME orderWhy', L, why, { zh:['四張裡比它輕的有 ' + r + ' 張'], en:[r + ' of the four ' + (r === 1 ? 'is' : 'are') + ' lighter'] });
                has('GAME orderWhy', L, why, { zh:['它是「' + d.gOrderSlots[r] + '」', '不是「' + d.gOrderSlots[i] + '」'], en:['goes in "' + d.gOrderSlots[r] + '"', 'not "' + d.gOrderSlots[i] + '"'] });
                const wr = REF.orderBad(L, cardRef(c, L), c.kg, c.f === 'kg', r, d.gOrderSlots[r], d.gOrderSlots[i]);
                if (why !== wr) fail('GAME orderWhy ' + L + ': "' + why + '" is not the canonical sentence "' + wr + '"');
              }
              say('GAME gOrderOk', L, d.gOrderOk(cardRef(c, L), c.kg, c.f === 'kg', d.gOrderSlots[sorted.indexOf(c.kg)]));
              say('GAME gOrder2', L, d.gOrder2(cardRef(c, L), c.kg, c.f === 'kg'));
            });
            const w = d.gOrderDone(sorted);
            const r = say('GAME gOrderDone', L, w, sorted.map(String));
            if (r.verified !== 3) fail('GAME gOrderDone ' + L + ': "' + w + '" verified ' + r.verified + ' comparisons, expected 3');
            say('GAME gOrderNow', L, d.gOrderNow(2, 4), ['2', '4']);
          });
          for (let i = 0; i < 3000; i++){
            const t = D.orderTray(set);
            if (t.length !== 4 || t.map(c => c.kg).sort((a, b) => a - b).join() !== sorted.join()){ fail('GAME orderTray(): not the set\'s own cards'); break; }
            if (t.every((c, j) => j === 0 || t[j - 1].kg <= c.kg)){ fail('GAME orderTray(): the tray starts in the answer order (' + t.map(c => c.kg) + ')'); break; }
          }
        });
        LANGS.forEach(L => {
          const exp = L === 'zh' ? ['最輕', '第 2 輕', '第 3 輕', '最重'] : ['Lightest', '2nd', '3rd', 'Heaviest'];
          if ((I18N[L].gOrderSlots || []).join() !== exp.join()) fail('GAME order: gOrderSlots ' + L + ' must read ' + exp.join());
        });
        const rows = P.y.map(y => ({ x:P.lblX, y, w:P.slotX + P.slotW - P.lblX, h:P.slotH }));
        rows.forEach((r, i) => inside(r, 'order row ' + i, H));
        noHits(rows, 'order rows');
        if (P.lblX + P.lblW > P.slotX) fail('GAME order: the rank label runs into its box');
        if (P.cardW > P.slotW - 4 || P.cardH > P.slotH) fail('GAME order: a placed card is bigger than its box');
        const tray = [];
        for (let j = 0; j < 4; j++) tray.push(sq(P.trayX[j % 2], P.trayY[Math.floor(j / 2)], P.cardW, P.cardH));
        tray.forEach((c, j) => inside(c, 'order card ' + j, H));
        noHits(tray.concat(rows), 'order cards / rows');
        tray.forEach((c, j) => { if (c.y < P.y[3] + P.slotH + P.pad) fail('GAME order: card ' + j + ' sits in the last row\'s drop zone'); });
        tooSmall('order card', Math.min(P.cardW, P.cardH));
        sweepZones('order rows', P.y.map((y, i) => ({ id:i, cx:(P.lblX + P.slotX + P.slotW) / 2, cy:y + P.slotH / 2, hw:(P.slotX + P.slotW - P.lblX) / 2, hh:P.slotH / 2, done:false })), P.pad, H);
        need('order', /cx:\(ORDER\.lblX \+ ORDER\.slotX \+ ORDER\.slotW\) \/ 2, cy:y \+ ORDER\.slotH \/ 2, hw:\(ORDER\.slotX \+ ORDER\.slotW - ORDER\.lblX\) \/ 2, hh:ORDER\.slotH \/ 2,/, 'the drop zone is not the whole row (rank label + box)');
      }
      tooSmall('the smallest piece (GPICK)', D.GPICK);
      if (claimCount < 1200) fail('GAME: only ' + claimCount + ' equations verified across the lesson — the claim scan is not reading the game sentences');
    },
    /* 靜態字串裡驗過的算式：條數＋指紋（拿掉一條、再補一條別的，條數一樣，指紋不一樣） */
    STATIC_PIN: { n:40, fp:'ac418c417ffa' }
  }
};
