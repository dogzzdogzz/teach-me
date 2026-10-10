/* grade-5/math/big-units 的檢查設定（大地測量隊：公畝、公頃、平方公里、立方公尺）。
   2026-10-10 新增 —— 和小遊戲「土地估價師」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔，
   simgen／verify_lesson_data／breaktest 對這一課一直是「找不到設定」。

   算式驗算：這一課的句子同時有單位換算（「1 公頃 ＝ 10000 平方公尺」）、小數（「0.04 平方公里 ＝ 40000 平方公尺」）、
   換算階梯（「3 平方公里 × 100 ＝ 300 公頃」）與「10 公分 × 10 公分 ＝ 100 平方公分」（長度乘長度是面積）。
   lib/arith.js 不收小數、lib/decarith.js 不認得單位，所以這裡有一份這一課自己的驗算器 areaClaims()：
     - 每一個量都帶著單位換成「最小單位」（公分、平方公分、立方公分；重量是公克）的精確有理數，並記住它是幾維；
     - 長度 × 長度 ＝ 面積、面積 × 長度 ＝ 體積（維度相加）；不同維度的量相加或相等一律報錯；
     - 沒有單位的那一邊沿用同一條算式裡最近的那個單位（「100 × 100 ＝ 10000 平方公分」的左邊是平方公分）；
     - 「3 平方公里 × 100 ＝ 300 公頃」這種階梯句另外驗：數字真的乘得對，而且乘的倍數就是兩個單位之間的倍數；
     - 「＜」串：真的由小到大；
     - 沒被任何一條算式吃掉、兩邊又貼著數字的等號一律報錯；＞ ≤ ≥ ≠ 一律報錯（fail closed）。
   驗算器自己先跑正反例（CLAIM_PROBES），靜態字串驗過的條數與指紋都釘住。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作、選項的形狀與範圍，
   renderCheck 把題幹與解釋的算式交給 areaClaims()，並比對「誘答的數（含小數）不可以原封不動出現在題幹裡」。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）與範例的句子函式（換算階梯、比一比、選對單位、鋪一鋪、疊一疊）逐條驗算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍（每一種地磚 × 每一種寫法、每一題的每一個小數點位置、每一張換算卡 × 每一個箱子、
     每一格 × 每一張數字卡、每一塊地 × 每一列），證明一定解得完、解完一定是對的；
     每一句說明兩種語言逐條驗算，最容易「數字對、意思反過來」的句子和設定檔自己的標準寫法（REF）逐字比；
     shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-big-units 的端對端測試驗（合成 PointerEvent）。 */

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
const r10 = k => rat(Math.pow(10, k), 1);

/* 設定檔自己的單位表（不讀頁面的 POW）：10 的幾次方個最小單位、幾維（L1 長度、L2 面積、L3 體積、M 重量） */
const UPOW = { cm:0, m:2, km:5, cm2:0, m2:4, a:6, ha:8, km2:10, cm3:0, m3:6, g:0, kg:3, t:6 };
const UDIM = { cm:1, m:1, km:1, cm2:2, m2:2, a:2, ha:2, km2:2, cm3:3, m3:3, g:'M', kg:'M', t:'M' };
const UMAP = { '平方公分':'cm2', '平方公尺':'m2', '平方公里':'km2', '立方公分':'cm3', '立方公尺':'m3', '公畝':'a', '公頃':'ha', '公尺':'m', '公分':'cm', '公里':'km', '公噸':'t', '公斤':'kg', '公克':'g',
               'cm²':'cm2', 'm²':'m2', 'km²':'km2', 'cm³':'cm3', 'm³':'m3', 'a':'a', 'ha':'ha', 'm':'m', 'cm':'cm', 'km':'km', 't':'t', 'kg':'kg', 'g':'g' };
const U_W = { zh:{ cm:'公分', m:'公尺', cm2:'平方公分', m2:'平方公尺', a:'公畝', ha:'公頃', km2:'平方公里', cm3:'立方公分', m3:'立方公尺' },
              en:{ cm:'cm', m:'m', cm2:'cm²', m2:'m²', a:'a', ha:'ha', km2:'km²', cm3:'cm³', m3:'m³' } };
const LANGS = ['zh', 'en'];

/* ---------- 這一課的算式驗算器 ---------- */
/* 題目式的空格：？、□、「多少」、「幾」（「1 立方公尺 ＝ 多少立方公分？」不是一條宣稱） */
const NUM = '\\d+(?:\\.\\d+)?', QM = '(?:[?？□]|多少|幾)';
const U = '(?:平方公分|平方公尺|平方公里|立方公分|立方公尺|公畝|公頃|公尺|公分|公里|公噸|公斤|公克|(?:km²|cm²|m²|cm³|m³|km|ha|kg|cm|m|a|t|g)(?![A-Za-z²³]))';
const TERM = '(?:' + NUM + '(?:\\s*' + U + ')?|' + QM + '(?:\\s*' + U + ')?)';
/* 鏈的開頭不可以緊跟在數字、小數點或運算子後面（「底 × 高 ÷ 2 ＝ 3 × 4 ÷ 2」的 2 不是一條算式的開頭） */
const CHAIN_RE = new RegExp('(?<![\\d.]|[×÷+\\-]\\s*)' + TERM + '(?:\\s*(?:[×÷+\\-]|[=<])\\s*' + TERM + ')+', 'g');
const TERM_RE = new RegExp('^(' + NUM + ')(?:\\s*(' + U + '))?$');
const CLAIMS_SEEN = [];
function normClaims(text){
  return String(text).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/＜/g, '<')
    .replace(/(\d)\s*hectares?(?![A-Za-z])/g, '$1 ha').replace(/(\d)\s*ares?(?![A-Za-z])/g, '$1 a')
    .replace(/(\d)\s*(square|cubic)\s+(kilo|centi)?met(?:er|re)s?(?![A-Za-z])/g, (m, d, k, p) => d + ' ' + ({ kilo:'k', centi:'c' }[p] || '') + 'm' + (k === 'square' ? '²' : '³'))
    .replace(/(\d)\s*(kilo|centi)?met(?:er|re)s?(?![A-Za-z])/g, (m, d, p) => d + ' ' + ({ kilo:'k', centi:'c' }[p] || '') + 'm');
}
function parseTerm(s){
  s = s.trim();
  if (new RegExp('^' + QM).test(s)) return { q:true };
  const m = TERM_RE.exec(s);
  if (!m) return null;
  const v = ratOf(m[1]);
  if (!m[2]) return { v:v, dim:0, raw:m[1] };
  const u = UMAP[m[2]];
  return { v:rMul(v, r10(UPOW[u])), dim:UDIM[u], u:u, num:v, raw:m[1] };
}
/* 維度：0 沒有單位、1 2 3 長度面積體積、'M' 重量 */
function dimMul(a, b){
  if (a === 0) return b; if (b === 0) return a;
  if (a === 'M' || b === 'M') return null;
  return a + b <= 3 ? a + b : null;
}
function dimDiv(a, b){
  if (b === 0) return a;
  if (a === 'M' || b === 'M') return a === b ? 0 : null;
  return a - b >= 0 ? a - b : null;
}
function areaClaims(text){
  const problems = [];
  let verified = 0, questions = 0;
  const t = normClaims(text);
  /* 千分位逗號不管在算式的哪一邊都不收：「1,000 m = 0 km」會被讀成「000 m = 0 km」（codex 第二輪） */
  const comma = t.match(/\d[,，]\d/);   /* 逗號直接夾在兩個數字中間（「1,0000」也算，codex 第三輪） */
  if (comma) problems.push('a number written with a thousands comma: "' + comma[0] + '"');
  const rest = t.replace(CHAIN_RE, (whole, offset, str) => {
    if (!/[=<]/.test(whole)) return whole;
    const after = str.slice(offset + whole.length);
    /* 「1,000,000」：鏈只吃到逗號前面的 1，後面的數被丟掉 —— 一律報錯（codex 第一輪 1b #2） */
    if (/\d$/.test(whole) && /^,\d{3}(?!\d)/.test(after)){ problems.push('a number written with a thousands comma (or cut short): "' + whole.trim() + after.slice(0, 12) + '"'); return ' Q '; }
    const parts = [], re = new RegExp('(' + TERM + ')|([×÷+\\-])|([=<])', 'g');
    let m, last = 0, broken = false;
    while ((m = re.exec(whole))){
      if (whole.slice(last, m.index).trim()) broken = true;
      parts.push(m[1] !== undefined ? { term:m[1] } : m[2] !== undefined ? { op:m[2] } : { rel:m[3] });
      last = m.index + m[0].length;
    }
    if (broken || whole.slice(last).trim()){ problems.push('cannot read the equation "' + whole.trim() + '"'); return ' Q '; }
    const sides = [[]], rels = [];
    parts.forEach(p => { if (p.rel){ rels.push(p.rel); sides.push([]); } else sides[sides.length - 1].push(p); });
    const S = sides.map(side => {
      const terms = [], ops = [];
      side.forEach((p, i) => { if (i % 2 === 0){ if (!p.term) terms.push({ bad:'an operator where a number belongs' }); else terms.push(parseTerm(p.term) || { bad:'cannot read "' + p.term + '"' }); } else ops.push(p.op); });
      if (side.length % 2 === 0) terms.push({ bad:'a dangling operator' });
      return { terms, ops };
    });
    for (const s of S) for (const x of s.terms) if (x.bad){ problems.push(x.bad + ' in "' + whole.trim() + '"'); return ' Q '; }
    if (S.some(s => s.terms.some(x => x.q))){ questions += rels.length; return ' Q '; }
    /* 換算階梯：「3 平方公里 × 100 ＝ 300 公頃」—— 數字對，而且乘（除）的就是兩個單位之間的倍數 */
    if (S.length === 2 && S[0].terms.length === 2 && S[0].terms[0].u && !S[0].terms[1].u && S[1].terms.length === 1 && S[1].terms[0].u && S[0].terms[0].u !== S[1].terms[0].u && (S[0].ops[0] === '×' || S[0].ops[0] === '÷')){
      const a = S[0].terms[0], f = S[0].terms[1], b = S[1].terms[0], op = S[0].ops[0];
      verified++;
      const got = op === '×' ? rMul(a.num, f.v) : rDiv(a.num, f.v);
      const want = op === '×' ? UPOW[a.u] - UPOW[b.u] : UPOW[b.u] - UPOW[a.u];
      if (!got || rCmp(got, b.num) !== 0) problems.push('this claim is wrong: "' + whole.trim() + '"');
      else if (a.dim !== b.dim || want < 1 || rCmp(f.v, r10(want)) !== 0) problems.push('the units do not match "' + op + ' ' + f.raw + '": "' + whole.trim() + '"');
      CLAIMS_SEEN.push(whole.replace(/\s+/g, ' ').trim());
      return ' Q ';
    }
    /* 一般情形：每一邊算出來（有單位的量換成最小單位、維度跟著算），沒有單位的一邊沿用最近的單位 */
    const vals = S.map(s => {
      let v = s.terms[0].v, dim = s.terms[0].dim, bad = null;
      s.ops.forEach((op, i) => {
        const R = s.terms[i + 1];
        if (op === '+' || op === '-'){
          if (dim !== R.dim) bad = 'adds quantities of different kinds (or a number with a unit to one without)';
          v = op === '+' ? rAdd(v, R.v) : rSub(v, R.v);
        } else {
          const nd = op === '×' ? dimMul(dim, R.dim) : dimDiv(dim, R.dim);
          if (nd === null) bad = 'multiplies or divides units into something that is not a length, area or volume';
          dim = nd; v = op === '×' ? rMul(v, R.v) : rDiv(v, R.v);
        }
      });
      if (s.ops.some(o => o === '+' || o === '-') && s.ops.some(o => o === '×' || o === '÷')) bad = bad || 'mixes + − with × ÷ (no precedence here)';
      const ut = s.terms.filter(x => x.u);
      return { v, dim, bad, unit:ut.length && UDIM[ut[0].u] === dim ? ut[0].u : null };
    });
    for (const x of vals) if (x.bad){ problems.push(x.bad + ': "' + whole.trim() + '"'); return ' Q '; }
    const anyU = vals.some(x => x.dim !== 0);
    /* 「1 m² = 1 banana」：最後一個數沒有單位、後面卻跟著一個字 —— 那是別的單位，不可以替它沿用 m²（codex 第一輪 1b #2） */
    const lastSide = S[S.length - 1], lastTerm = lastSide.terms[lastSide.terms.length - 1];
    if (anyU && !lastTerm.u && /^\s*[A-Za-z一-鿿]/.test(after)){ problems.push('the last number has a word after it that is not a unit this checker knows: "' + whole.trim() + after.slice(0, 12) + '"'); return ' Q '; }
    const conv = [];
    for (let i = 0; i < vals.length; i++){
      const x = vals[i];
      if (x.dim !== 0 || !anyU){ conv.push({ v:x.v, dim:x.dim }); continue; }
      let u = null;
      for (let j = i + 1; j < vals.length && !u; j++) if (vals[j].dim !== 0) u = vals[j].unit || 'X';
      for (let j = i - 1; j >= 0 && !u; j--) if (vals[j].dim !== 0) u = vals[j].unit || 'X';
      if (u === 'X'){ problems.push('cannot tell which unit the bare number side is in: "' + whole.trim() + '"'); return ' Q '; }
      conv.push({ v:rMul(x.v, r10(UPOW[u])), dim:UDIM[u] });
    }
    for (let k = 1; k < conv.length; k++){
      verified++;
      if (conv[k - 1].dim !== conv[k].dim){ problems.push('compares quantities of different kinds: "' + whole.trim() + '"'); continue; }
      const c = conv[k - 1].v && conv[k].v ? rCmp(conv[k - 1].v, conv[k].v) : NaN;
      if (rels[k - 1] === '=' ? c !== 0 : !(c < 0)) problems.push('this claim is wrong: "' + whole.trim() + '"');
    }
    CLAIMS_SEEN.push(whole.replace(/\s+/g, ' ').trim());
    return ' Q ';
  });
  /* 數字旁邊的等號（任一邊）都必須被一條驗過的算式吃掉（codex 第一輪 1b #2：只看「兩邊都是數字」會放過「1 m² = 1 banana」這種） */
  /* 句尾的「1 平方公尺 ＝」是給孩子填的空格（後面就是輸入框），不是宣稱 */
  const left = rest.replace(/[=<]\s*$/, '').match(new RegExp('\\d\\s*' + U + '?\\s*[=<]|[=<]\\s*\\d'));
  if (left) problems.push('an equals sign between numbers was not verified: "' + left[0] + '"');
  /* 這個驗算器只認得 ＝ 與 ＜；其他比較符號出現在數字旁邊一律報錯，不靜靜放行 */
  const other = t.match(new RegExp('\\d\\s*' + U + '?\\s*[>≥≤≠＞≧≦]|[>≥≤≠＞≧≦]\\s*\\d'));
  if (other) problems.push('a comparison sign this checker cannot verify: "' + other[0] + '"');
  return { problems, verified, questions };
}
const CLAIM_PROBES = [
  ['1 公頃 ＝ 10000 平方公尺', false], ['1 公頃 ＝ 1000 平方公尺', true], ['1 平方公尺 ＝ 10000 平方公分', false], ['1 平方公尺 ＝ 100 平方公分', true],
  ['1 立方公尺 ＝ 1000000 立方公分', false], ['1 立方公尺 ＝ 10000 立方公分', true], ['1 公尺 ＝ 100 公分', false], ['1 公尺 ＝ 100 平方公分', true],
  ['3 平方公里 × 100 ＝ 300 公頃', false], ['3 平方公里 × 100 ＝ 30 公頃', true], ['3 平方公里 × 10000 ＝ 30000 公頃', true], ['300 公頃 ÷ 100 ＝ 3 平方公里', false],
  ['300 公頃 × 100 ＝ 3 平方公里', true], ['2 m² × 100 = 200 a', true], ['5 ha × 100 = 500 a', false], ['10 公分 × 10 公分 ＝ 100 平方公分', false],
  ['10 公分 × 10 公分 ＝ 100 公分', true], ['10 cm × 10 cm × 10 cm = 1000 cm³', false], ['100 × 100 ＝ 10000 平方公分 ＝ 1 平方公尺', false], ['100 × 100 ＝ 1000 平方公分 ＝ 1 平方公尺', true],
  ['0.04 平方公里 ＝ 40000 平方公尺', false], ['0.04 km² = 4000 m²', true], ['25000 ＜ 28000 ＜ 30000 ＜ 40000 平方公尺', false], ['25000 ＜ 30000 ＜ 28000 平方公尺', true],
  ['2.4 立方公尺 ＝ 2.4 × 1000000 ＝ 2400000 立方公分', false], ['2.4 立方公尺 ＝ 2.4 × 1000000 ＝ 240000 立方公分', true], ['1 公頃 ＝ 1 平方公尺 ＋ 3', true],
  ['1 ha = 10000 m²', false], ['1 ha = 100 m²', true], ['3 hectares = 300 ares', false], ['1 公畝 ＝ 1 公尺', true], ['1 公噸 ＝ 1000 公斤', false], ['1 公噸 ＝ 100 公斤', true],
  ['3 ＝ 4', true], ['3000 平方公尺 ＞ 2 公頃', true], ['1 平方公尺 ＝ ？ 平方公分', false], ['20 × 15 ＝ 300 平方公尺', false], ['5000 ÷ 100 ＝ 50 公畝', false], ['5000 ÷ 100 ＝ 5 公畝', true],
  ['3 × 4 ÷ 2 = 6', false], ['3 + 4 × 2 = 14', true], ['三角形面積 ＝ 底 × 高 ÷ 2：3 × 4 ÷ 2 ＝ 6', false], ['三角形面積 ＝ 底 × 高 ÷ 2：3 × 4 ÷ 2 ＝ 7', true],
  ['三角形面積 = 底 × 高 ÷ 2 = 3 × 4 ÷ 2 = 6', true], ['1 平方公里 = 1,000,000 平方公尺', true], ['1 m² = 1 banana', true], ['1 m² = 10000 banana', true],
  ['1 square meter = 10000 square centimeters', false], ['1 square meter = 100 square centimeters', true], ['1 cubic metre = 1000000 cubic centimetres', false], ['2 kilometres = 2000 meters', false],
  ['1,000 m = 1 km', true], ['1,000 m = 0 km', true], ['5 × 1,000 = 5000', true], ['1,0000 m = 0 m', true], ['Choose 1, 2 or 3: 1 m = 100 cm', false], ['1 a = 100 m², 1 ha = 10000 m²', false], ['1 平方公尺 ＝', false], ['1 立方公尺 = 多少立方公分？', false], ['10 × 10 = 100 tiles', false], ['10 × 10 = 101 tiles', true], ['甲 = 30000 平方公尺', true], ['1 are = 100 m²', false]
];

/* ---------- 設定檔自己的字串移位與標準寫法 ---------- */
function shiftStr(s, k){
  const q = String(s).split('.'); let all = q[0] + (q[1] || ''), pt = q[0].length + k;
  while (pt > all.length) all += '0';
  while (pt < 1){ all = '0' + all; pt++; }
  const a = all.slice(0, pt).replace(/^0+(?=\d)/, ''), b = all.slice(pt).replace(/0+$/, '');
  return b ? a + '.' + b : a;
}
const aRef = (v, u, L) => v + ' ' + U_W[L][u];
const ten = k => '1' + '0'.repeat(k);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []); }
const isInt = v => Number.isInteger(v);
const m2Ref = c => Number(shiftStr(c.v, UPOW[c.u] - UPOW.m2));
const LADDER_REF = ['km2', 'ha', 'a', 'm2'];
/* 第 3 關：為什麼是這個倍數（設定檔自己的一份），第 5 關：放錯列（標準寫法，逐字比） */
const REF = {
  sortHow: (L, from, to) => {
    if (UDIM[from] === 1) return L === 'zh' ? '長度只有一個方向，× 100。' : 'length has one direction, × 100.';
    if (UDIM[from] === 3) return L === 'zh' ? '邊長 100 公分的正方體，100 × 100 × 100 ＝ 1000000。' : 'a cube with 100 cm edges, 100 × 100 × 100 = 1000000.';
    if (to === 'cm2') return L === 'zh' ? '邊長 100 公分的正方形，100 × 100 ＝ 10000。' : 'a square with 100 cm sides, 100 × 100 = 10000.';
    const i = LADDER_REF.indexOf(from), j = LADDER_REF.indexOf(to), k = j - i, path = LADDER_REF.slice(i, j + 1).map(u => U_W[L][u]).join(' → ');
    if (k === 1) return L === 'zh' ? path + '，往下 1 階，× 100。' : path + ', 1 step down, × 100.';
    const f = Array(k).fill('100').join(' × '), p = ten(2 * k);
    return L === 'zh' ? path + '，往下 ' + k + ' 階，' + f + ' ＝ ' + p + '。' : path + ', ' + k + ' steps down, ' + f + ' = ' + p + '.';
  },
  sortBad: (L, from, to, F, f) => L === 'zh'
    ? '1 ' + U_W.zh[from] + ' ＝ ' + F + ' ' + U_W.zh[to] + '：' + REF.sortHow(L, from, to) + '要放進「× ' + F + '」，不是「× ' + f + '」。'
    : '1 ' + U_W.en[from] + ' = ' + F + ' ' + U_W.en[to] + ': ' + REF.sortHow(L, from, to) + ' It goes in "× ' + F + '", not "× ' + f + '".',
  orderBad: (L, card, m2, isM2, r, want, here) => L === 'zh'
    ? (isM2 ? card : card + ' ＝ ' + m2 + ' 平方公尺') + '：' + (r ? '四塊裡比它小的有 ' + r + ' 塊' : '四塊裡沒有比它小的') + '，它是「' + want + '」，不是「' + here + '」。'
    : (isM2 ? card : card + ' = ' + m2 + ' m²') + ': ' + (r ? r + ' of the four ' + (r === 1 ? 'is' : 'are') + ' smaller' : 'none of the four is smaller') + ', so it goes in "' + want + '", not "' + here + '".',
  tileDone: (L, n, N, s, A) => L === 'zh'
    ? '鋪滿了！' + n + ' × ' + n + ' ＝ ' + N + ' 塊，每塊 ' + s + ' × ' + s + ' ＝ ' + A + ' 平方公分，' + N + ' × ' + A + ' ＝ 10000 平方公分 ＝ 1 平方公尺。'
    : 'Full! ' + n + ' × ' + n + ' = ' + N + ' tiles, each ' + s + ' × ' + s + ' = ' + A + ' cm², and ' + N + ' × ' + A + ' = 10000 cm² = 1 m².'
};

/* ---------- review.html 的誘答：每一個產生器自己的迷思公式（設定檔的一份，用字串移位算小數，不用浮點） ---------- */
const S_ = (v, k) => shiftStr(String(v), k || 0);
const half = v => v % 2 ? (v - 1) / 2 + '.5' : String(v / 2);
const DISTRACTORS = {
  areaLadderStep: d => d.down ? [S_(d.hiVal * 10), S_(d.hiVal * 1000), S_(d.hiVal * 10000)] : [S_(d.hiVal * 10), S_(d.hiVal, -1), S_(d.hiVal, -2)],
  areaCm2M2: d => d.down ? [S_(d.m2Val * 100), S_(d.m2Val * 1000), S_(d.m2Val * 100000)] : [S_(d.m2Val * 100), S_(d.m2Val * 10), S_(d.m2Val, -1)],
  volM3Cm3: d => d.down ? [S_(d.m3Val * 10000), S_(d.m3Val * 1000), S_(d.m3Val * 100000)] : [S_(d.m3Val * 100), S_(d.m3Val * 1000), S_(d.m3Val * 10)],
  wordRectToA: d => [S_(d.l * d.w), S_(d.l * d.w / 10), S_(d.l * d.w, -4), S_(2 * (d.l + d.w))],
  multiplierCheck: () => ['100', '1000', '10000', '1000000'],
  chainedLadder: d => d.toUnit === 'a' ? [S_(d.kmVal * 100), S_(d.kmVal * 1000), S_(d.kmVal * 100000)] : [S_(d.kmVal * 10000), S_(d.kmVal * 100000), S_(d.kmVal * 10000000)],
  areaFormula: d => d.shape === 'rect' ? [S_(d.base + d.height), S_(2 * (d.base + d.height)), half(d.base * d.height), S_(2 * d.base * d.height)]
                                       : [S_(d.base * d.height), S_(d.base + d.height), S_(2 * (d.base + d.height)), S_(2 * d.base * d.height)],
  boxVolume: d => { const l = d.l, w = d.w, h = d.h; return [S_(l + w + h), S_(l * w), S_(2 * (l * w + w * h + l * h)), S_(l * w + w * h + l * h), S_(4 * (l + w + h))]; },
  tonneKg: d => d.down ? [S_(d.tVal * 100), S_(d.tVal * 10000), S_(d.tVal * 10)] : [S_(d.tVal * 10), S_(d.tVal * 100), S_(d.tVal, -1)]
};
/* 每一個產生器的整個參數範圍（照 review.html 的題庫抄一份）：扣掉正解和題幹裡的數之後，迷思公式至少還有三個不同的值 ——
   這樣 makeWrongs 的保底（正解 ± 1）一定走不到。這是逐一列舉，不是抽樣。 */
function domainProblems(){
  const out = [];
  const enough = (id, d, ans, stem) => {
    const s = new Set(DISTRACTORS[id](d).filter(v => v !== String(ans) && stem.map(String).indexOf(v) < 0));
    if (s.size < 3) out.push(id + ' ' + JSON.stringify(d) + ': only ' + s.size + ' distinct misconception values');
  };
  const H = [1,2,3,4,5,6,7,8,9,10,12,15,18,20], N9 = [1,2,3,4,5,6,7,8,9];
  H.forEach(h => { enough('areaLadderStep', { down:true, hiVal:h }, h * 100, [h]); enough('areaLadderStep', { down:false, hiVal:h }, h, [h * 100]); });
  N9.forEach(m => { enough('areaCm2M2', { down:true, m2Val:m }, m * 10000, [m]); enough('areaCm2M2', { down:false, m2Val:m }, m, [m * 10000]);
                    enough('volM3Cm3', { down:true, m3Val:m }, m * 1000000, [m]); enough('volM3Cm3', { down:false, m3Val:m }, m, [m * 1000000]);
                    enough('tonneKg', { down:true, tVal:m }, m * 1000, [m]); enough('tonneKg', { down:false, tVal:m }, m, [m * 1000]); });
  [20,40,60,80,100].forEach(l => [5,10,15,20,25,30].forEach(w => enough('wordRectToA', { l, w }, l * w / 100, [l, w])));
  [1,2,3,4,5,6,7,8].forEach(k => { enough('chainedLadder', { kmVal:k, toUnit:'a' }, k * 10000, [k]); enough('chainedLadder', { kmVal:k, toUnit:'m2' }, k * 1000000, [k]); });
  ['rect', 'tri'].forEach(shape => [3,4,5,6,7,8,9,10,12].forEach(b => [2,3,4,5,6,7,8].forEach(h0 => {
    const h = shape === 'tri' && (b * h0) % 2 ? h0 + 1 : h0;
    if ((b - 2) * (h - 2) === 4) return;   /* review.html 重抽這三組 */
    enough('areaFormula', { shape, base:b, height:h }, shape === 'rect' ? b * h : half(b * h), [b, h]);
  })));
  [2,3,4,5,6,7,8].forEach(l => [2,3,4,5,6].forEach(w => [2,3,4,5,6].forEach(h => enough('boxVolume', { l, w, h }, l * w * h, [l, w, h]))));
  return out;
}
const DOMAIN_PROBLEMS = domainProblems();

/* 課文要孩子找出錯誤的那幾句（迷思）：在哪一個字串、哪一條算式。放行是逐句的，而且每一句都要真的被用到一次 */
const WRONG_ON_PURPOSE = [
  ['zh.s2mis', '1 平方公尺 = 100 平方公分'], ['en.s2mis', '1 m² = 100 cm²'],
  ['zh.qsBoost[0].stem', '1 平方公尺 = 100 平方公分'], ['zh.qsBoost[1].stem', '1 立方公尺 = 10000 立方公分'],
  ['en.qsBoost[0].stem', '1 m² = 100 cm²'], ['en.qsBoost[1].stem', '1 m³ = 10000 cm³']
];

module.exports = {
  _areaClaims: areaClaims,
  breaks: [
    {"file": "index", "expect": "GAME_ORDER should be", "find": "var GAME_ORDER = ['tile', 'point', 'sort', 'write', 'order'];", "replace": "var GAME_ORDER = ['point', 'tile', 'sort', 'write', 'order'];"},
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
    {"file": "index", "expect": "roundNote() changes the score", "find": "  function roundNote(text){ gMsg.innerHTML", "replace": "  function roundNote(text){ gMistake = true; gMsg.innerHTML"},
    {"file": "index", "expect": "second level", "find": "    if (hintLevel >= 2) gHintBtn.disabled = true;", "replace": "    if (hintLevel >= 3) gHintBtn.disabled = true;"},
    {"file": "index", "expect": "no 10 cm tile", "find": "  var GAME_TILE = [10, 20, 25];", "replace": "  var GAME_TILE = [20, 25, 50];"},
    {"file": "index", "expect": "does not fit 100 cm", "find": "  var GAME_TILE = [10, 20, 25];", "replace": "  var GAME_TILE = [10, 20, 30];"},
    {"file": "index", "expect": "accepts a wrong answer", "find": "    if (v === 10000) return null;\n    if (v === N)", "replace": "    if (v === 10000 || v === N) return null;\n    if (v === N)"},
    {"file": "index", "expect": "is not only a reminder", "find": "    if (!/^[1-9]\\d*$/.test(t)) return 'format';", "replace": "    if (!/^\\d+$/.test(t)) return 'format';"},
    {"file": "index", "expect": "refuses the right answer", "find": "    var t = String(str).trim();", "replace": "    var t = String(str);"},
    {"file": "index", "expect": "GAME tileWhy count", "find": "    if (v === N) return d.gTileCount(N, s, A);", "replace": "    if (v === N) return d.gTileOther(t, N, A);"},
    {"file": "index", "expect": "this claim is wrong", "find": "return N + ' 是地磚的塊數。每一塊是 ' + s + ' 公分 × ' + s + ' 公分 ＝ ' + A + ' 平方公分", "replace": "return N + ' 是地磚的塊數。每一塊是 ' + s + ' 公分 × ' + s + ' 公分 ＝ ' + (A * 10) + ' 平方公分"},
    {"file": "index", "expect": "gTileDone", "find": "' ＝ 10000 平方公分 ＝ 1 平方公尺。'; },", "replace": "' ＝ 1000 平方公分 ＝ 1 平方公尺。'; },"},
    {"file": "index", "expect": "canonical sentence", "find": "return 'Full! ' + n + ' × ' + n", "replace": "return 'Almost! ' + n + ' × ' + n"},
    {"file": "index", "expect": "must say \"one side\"", "find": "gTileSide: '1 m = 100 cm is only the length of one side.", "replace": "gTileSide: '1 m = 100 cm is only the length of the area."},
    {"file": "index", "expect": "checked before the square is full", "find": "        if (gSolved || done < n) return;", "replace": "        if (gSolved) return;"},
    {"file": "index", "expect": "a row's drop zone is not the drawn row", "find": "cy:TILE.sqY + rh * (r + 0.5), hw:TILE.side / 2, hh:rh / 2, done:false });", "replace": "cy:TILE.sqY + rh * (r + 0.5), hw:TILE.side / 2, hh:rh, done:false });"},
    {"file": "index", "expect": "a laid row does not draw", "find": "addZone(B, TILE.sqX + j * rh + 1, TILE.sqY + rw.i * rh + 1, rh - 2, rh - 2, 'gtile');", "replace": "addZone(B, TILE.sqX + j * rh + 1, TILE.sqY + 1, rh - 2, rh - 2, 'gtile');"},
    {"file": "index", "expect": "mistake key: an answer", "find": "roundMiss(why, 'v' + inp.value.trim());", "replace": "roundMiss(why, 'v' + gScore);"},
    {"file": "index", "expect": "mini squares", "find": "      var ms = Math.min(rh, 24) - 4;", "replace": "      var ms = Math.min(rh, 24) - 1;"},
    {"file": "index", "expect": "tile strip", "find": "pad:8, stripW:200, stripH:56, stripY:304 }, TILE_H = 336;", "replace": "pad:8, stripW:200, stripH:56, stripY:250 }, TILE_H = 336;"},
    {"file": "index", "expect": "the drop zone pad", "find": "pad:8, stripW:200, stripH:56, stripY:304 }, TILE_H = 336;", "replace": "pad:0, stripW:200, stripH:56, stripY:304 }, TILE_H = 336;"},
    {"file": "index", "expect": "gTileEq zh must read", "find": "gTileEq: { pre:'1 平方公尺 ＝', post:'平方公分',", "replace": "gTileEq: { pre:'1 平方公尺 ＝', post:'平方公尺',"},
    {"file": "index", "expect": "gTileTop", "find": "gTileTop: '1 公尺 ＝ 100 公分',", "replace": "gTileTop: '1 公尺 ＝ 10 公分',"},
    {"file": "index", "expect": "must say \"塊數 × 一塊的面積\"", "find": "再想一想每一塊地磚是幾平方公分 —— 塊數 × 一塊的面積。", "replace": "再想一想每一塊地磚是幾平方公分 —— 塊數 ＋ 一塊的面積。"},
    {"file": "index", "expect": "answer box is not off", "find": "inp.setAttribute('aria-label', d.gTileEq.aria); inp.disabled = true;", "replace": "inp.setAttribute('aria-label', d.gTileEq.aria);"},
    {"file": "index", "expect": "padded with four zeros", "find": "return { digits:'0000' + ip + fp + '0000', g0:4 + ip.length }; }", "replace": "return { digits:'000' + ip + fp + '000', g0:3 + ip.length }; }"},
    {"file": "index", "expect": "pointShift(", "find": "  function pointShift(it){ return POW[it.from] - POW[it.to]; }", "replace": "  function pointShift(it){ return POW[it.to] - POW[it.from]; }"},
    {"file": "index", "expect": "at the answer gap", "find": "  function pointTarget(it){ return pointCells(it.v).g0 + pointShift(it); }", "replace": "  function pointTarget(it){ return pointCells(it.v).g0 + pointShift(it) / 2; }"},
    {"file": "index", "expect": "pointRead(", "find": "    var ip = digits.slice(0, g).replace(/^0+(?=\\d)/, ''), fp = digits.slice(g).replace(/0+$/, '');", "replace": "    var ip = digits.slice(0, g).replace(/^0+(?=\\d)/, ''), fp = digits.slice(g);"},
    {"file": "index", "expect": "pointGap(", "find": "  function pointGap(n, x){ return Math.max(1, Math.min(n, Math.round((x - pointX0(n)) / POINT.cw))); }", "replace": "  function pointGap(n, x){ return Math.max(1, Math.min(n, Math.floor((x - pointX0(n)) / POINT.cw))); }"},
    {"file": "index", "expect": "should only remind", "find": "    if (m === 0) return 'still';\n", "replace": ""},
    {"file": "index", "expect": "is not one or two steps", "find": "{ v:'60', from:'a', to:'ha' },", "replace": "{ v:'60', from:'m2', to:'km2' },"},
    {"file": "index", "expect": "must compute", "find": "d.gPointSize(it.v, it.from, it.to, m > 0, k, tenTo(k), r, tenTo(Math.abs(sh)), Math.abs(sh))", "replace": "d.gPointSize(it.v, it.from, it.to, m > 0, k, tenTo(k), it.v, tenTo(Math.abs(sh)), Math.abs(sh))"},
    {"file": "index", "expect": "must say \"數字變", "find": "'，數字變' + (right ? '大' : '小') + '了。'", "replace": "'，數字變' + (right ? '小' : '大') + '了。'"},
    {"file": "index", "expect": "moved the point", "find": "return 'You moved the point ' + k + (k === 1 ? ' place ' : ' places ')", "replace": "return 'You moved the point ' + (k + 1) + (k === 1 ? ' place ' : ' places ')"},
    {"file": "index", "expect": "gPointYes", "find": "'（' + v + ' ' + op + ' ' + tenTo(Math.abs(K)) + ' ＝ ' + r + '）。'; },", "replace": "'（' + v + ' ' + op + ' ' + tenTo(2) + ' ＝ ' + r + '）。'; },"},
    {"file": "index", "expect": "gPoint2", "find": "' places right from where the point started.'", "replace": "' places left from where the point started.'"},
    {"file": "index", "expect": "the reading line runs into", "find": "readY:80, readH:30, gripH:48,", "replace": "readY:80, readH:40, gripH:48,"},
    {"file": "index", "expect": "Done does not judge", "find": "        var why = pointWhy(d, it, g);", "replace": "        var why = pointWhy(d, it, pointTarget(it));"},
    {"file": "index", "expect": "the dot does not follow", "find": "onPlace:function(P){ var ng = pointGap(n, P.cx); if (ng !== g && !gSolved){ g = ng; clearNote(); draw(); } } });", "replace": "onPlace:function(P){} });"},
    {"file": "index", "expect": "4 places right", "find": "    { v:'0.8', from:'ha', to:'m2' },     { v:'7500', from:'m2', to:'ha' },  { v:'1.2', from:'m2', to:'cm2' },", "replace": "    { v:'0.8', from:'ha', to:'a' },     { v:'7500', from:'m2', to:'ha' },  { v:'1.2', from:'ha', to:'a' },"},
    {"file": "index", "expect": "Done does not end a held grip", "find": "        grip.rehome(pointGapX(n, g), POINT.knobY);   /* 另一根手指還拿著把手時按「換好了」：拖拉一律結束，把手停在判斷的那一個縫 */\n", "replace": ""},
    {"file": "index", "expect": "mistake key: Done", "find": "        if (why){ roundMiss(why, 'g' + g); return; }", "replace": "        if (why){ roundMiss(why, 'g' + gScore); return; }"},
    {"file": "index", "expect": "the boxes must be", "find": "  var SORT_F = ['100', '10000', '1000000'];", "replace": "  var SORT_F = ['100', '1000000', '10000'];"},
    {"file": "index", "expect": "sortFactor(", "find": "  function sortFactor(c){ return tenTo(POW[c.from] - POW[c.to]); }", "replace": "  function sortFactor(c){ return tenTo(POW[c.from] - POW[c.to] - (DIM[c.from] === 3 ? 2 : 0)); }"},
    {"file": "index", "expect": "sortKind(", "find": "c.to === 'cm2' ? 'square' : 'ladder'; }", "replace": "c.to === 'm2' ? 'square' : 'ladder'; }"},
    {"file": "index", "expect": "sortHow(", "find": "    return d.gSortLadder(LADDER.slice(i, j + 1).map(", "replace": "    return d.gSortLadder(LADDER.slice(i, j).map("},
    {"file": "index", "expect": "this claim is wrong", "find": "square:'邊長 100 公分的正方形，100 × 100 ＝ 10000。'", "replace": "square:'邊長 100 公分的正方形，100 × 100 ＝ 1000。'"},
    {"file": "index", "expect": "canonical sentence", "find": "how + ' It goes in \"× ' + F + '\", not \"× ' + f + '\".'; },", "replace": "how + ' It belongs in \"× ' + F + '\", not \"× ' + f + '\".'; },"},
    {"file": "index", "expect": "accepts the wrong box", "find": "    return F === f ? null : d.gSortBad(", "replace": "    return true ? null : d.gSortBad("},
    {"file": "index", "expect": "sortPick(): not two", "find": "return sortFactor(c) === f; })).slice(0, 2)); });", "replace": "return sortFactor(c) === f; })).slice(0, f === '100' ? 3 : 2)); });"},
    {"file": "index", "expect": "sortPick(): the tray starts", "find": "    return unsorted(out, function(c){ return SORT_F.indexOf(sortFactor(c)); });", "replace": "    return out;"},
    {"file": "index", "expect": "no length card", "find": "    { from:'m', to:'cm' },    { from:'a', to:'m2' },", "replace": "    { from:'km2', to:'a' },    { from:'a', to:'m2' },"},
    {"file": "index", "expect": "covers the box label", "find": "lblH:40, chipW:86, chipH:44, chipY:[50, 98], pad:8,", "replace": "lblH:40, chipW:86, chipH:44, chipY:[30, 98], pad:8,"},
    {"file": "index", "expect": "sort boxes: the drop zones never overlap", "find": "lblH:40, chipW:86, chipH:44, chipY:[50, 98], pad:8,", "replace": "lblH:40, chipW:86, chipH:44, chipY:[50, 98], pad:1,"},
    {"file": "index", "expect": "the card / box judged", "find": "        var c = P.data.c, why = sortWhy(d, c, bin.f, lang);", "replace": "        var c = P.data.c, why = sortWhy(d, c, '100', lang);"},
    {"file": "index", "expect": "does not show its conversion", "find": "'gchip', d.gSortChip(c.from, c.to));", "replace": "'gchip', d.gSortChip(c.to, c.from));"},
    {"file": "index", "expect": "mistake key: a card into a box", "find": "roundMiss(why, c.from + '>' + c.to + '@' + bin.f);", "replace": "roundMiss(why, c.from + '@' + gScore);"},
    {"file": "index", "expect": "gSortQ", "find": "gSortQ: function(from, to){ return ['1 ' + UNIT.en[from], '= ?', UNIT.en[to]]; },", "replace": "gSortQ: function(from, to){ return ['1 ' + UNIT.en[from], '= 100', UNIT.en[to]]; },"},
    {"file": "index", "expect": "gSortBins", "find": "      gSortBins: ['× 100', '× 10000', '× 1000000'],\n      gSortQ: function(from, to){ return ['1 ' + UNIT.zh[from]", "replace": "      gSortBins: ['× 100', '× 1000000', '× 10000'],\n      gSortQ: function(from, to){ return ['1 ' + UNIT.zh[from]"},
    {"file": "index", "expect": "must say \"往下兩階就是 100 × 100\"", "find": "面積的階梯每往下一階 × 100，往下兩階就是 100 × 100；", "replace": "面積的階梯每往下一階 × 100，往下兩階就是 100 ＋ 100；"},
    {"file": "index", "expect": "must say \"m² to cm² is × 10000\"", "find": "gSortDone: 'All six sorted! m to cm is × 100, m² to cm² is × 10000,", "replace": "gSortDone: 'All six sorted! m to cm is × 100, m² to cm² is × 100,"},
    {"file": "index", "expect": "sits in a box", "find": "cardW:88, cardH:64, trayX:[52, 150, 248], trayY:[200, 272] }, SORT_H = 308;", "replace": "cardW:88, cardH:64, trayX:[52, 150, 248], trayY:[150, 272] }, SORT_H = 308;"},
    {"file": "index", "expect": "writeDigits(", "find": "  function writeDigits(v){ return shiftDec(v, 6).split('').map(Number); }", "replace": "  function writeDigits(v){ return shiftDec(v, 4).split('').map(Number); }"},
    {"file": "index", "expect": "accepts a wrong digit", "find": "    if (w[i] === x) return null;\n    if (i === 0)", "replace": "    if (w[i] === x || x === 0) return null;\n    if (i === 0)"},
    {"file": "index", "expect": "GAME writeWhy decimal", "find": "d.gWriteBadDec(v, i, fp.charAt(i - 1), d.gPlaces[i], x)", "replace": "d.gWriteBadDec(v, i, fp.charAt(i), d.gPlaces[i], x)"},
    {"file": "index", "expect": "must say \"補 0\"", "find": "位沒有數字 —— 要補 0，不是 ' + x + '。'; },", "replace": "位沒有數字 —— 不用寫，不是 ' + x + '。'; },"},
    {"file": "index", "expect": "this claim is wrong", "find": "return '1 立方公尺 ＝ 1000000 立方公分：' + v + ' 立方公尺的整數部分是 '", "replace": "return '1 立方公尺 ＝ 10000 立方公分：' + v + ' 立方公尺的整數部分是 '"},
    {"file": "index", "expect": "no question with a 0 inside", "find": "  var GAME_WRITE = ['1.05', '2.4', '3.006', '1.5', '4.25', '2.08', '5.3', '1.205', '6.07'];", "replace": "  var GAME_WRITE = ['1.15', '2.4', '3.316', '1.5', '4.25', '2.18', '5.3', '1.215', '6.17'];"},
    {"file": "index", "expect": "is not 1~9.999", "find": "  var GAME_WRITE = ['1.05', '2.4', '3.006', '1.5', '4.25', '2.08', '5.3', '1.205', '6.07'];", "replace": "  var GAME_WRITE = ['1.05', '2.4', '3.006', '1.5', '4.25', '2.08', '5.3', '1.205', '16.07'];"},
    {"file": "index", "expect": "write boxes: the drop zones never overlap", "find": "unitW:120, unitH:36, pad:4,", "replace": "unitW:120, unitH:36, pad:0.5,"},
    {"file": "index", "expect": "the box plus its place label", "find": "        return { i:i, z:z, cx:WRITE.slotX[i] + WRITE.slotW / 2, cy:(WRITE.lblY + WRITE.slotY + WRITE.slotH) / 2, hw:WRITE.slotW / 2, hh:(WRITE.slotY + WRITE.slotH - WRITE.lblY) / 2, done:false };", "replace": "        return { i:i, z:z, cx:WRITE.slotX[i] + WRITE.slotW / 2, cy:WRITE.slotY + WRITE.slotH / 2, hw:WRITE.slotW / 2, hh:WRITE.slotH / 2, done:false };"},
    {"file": "index", "expect": "gPlaceLbl en", "find": "      gPlaceLbl: ['M', 'HTh', 'TTh', 'Th', 'H', 'T', 'O'],", "replace": "      gPlaceLbl: ['O', 'T', 'H', 'Th', 'TTh', 'HTh', 'M'],"},
    {"file": "index", "expect": "the digit / box judged", "find": "        var x = P.data.v, why = writeWhy(d, v, s.i, x);", "replace": "        var x = P.data.v, why = writeWhy(d, v, 0, x);"},
    {"file": "index", "expect": "the unit label zh", "find": "      gWriteUnit: '立方公分',", "replace": "      gWriteUnit: '平方公分',"},
    {"file": "index", "expect": "the unit label sits in", "find": "unitX:90, unitY:100, unitW:120", "replace": "unitX:90, unitY:90, unitW:120"},
    {"file": "index", "expect": "mistake key: a digit", "find": "        if (why){ roundMiss(why, s.i + ':' + x); return false; }", "replace": "        if (why){ roundMiss(why, s.i + ':' + gScore); return false; }"},
    {"file": "index", "expect": "GAME gWriteDone", "find": "return '寫好了！' + v + ' 立方公尺 ＝ ' + v + ' × 1000000 ＝ ' + total + ' 立方公分。'; },", "replace": "return '寫好了！' + v + ' 立方公尺 ＝ ' + v + ' × 10000 ＝ ' + total + ' 立方公分。'; },"},
    {"file": "index", "expect": "orderRank(", "find": "  function orderRank(set, c){ return set.filter(function(x){ return m2Of(x) < m2Of(c); }).length; }", "replace": "  function orderRank(set, c){ return set.filter(function(x){ return Number(x.v) < Number(c.v); }).length; }"},
    {"file": "index", "expect": "m2Of(", "find": "  function m2Of(c){ return Number(shiftDec(c.v, POW[c.u] - POW.m2)); }", "replace": "  function m2Of(c){ return Number(shiftDec(c.v, POW[c.u] - POW.m2 - (c.u === 'a' ? 2 : 0))); }"},
    {"file": "index", "expect": "one plot in each", "find": "{ v:'28000', u:'m2' }, { v:'0.04', u:'km2' }],", "replace": "{ v:'28000', u:'m2' }, { v:'400', u:'a' }],"},
    {"file": "index", "expect": "the trap does nothing", "find": "    [{ v:'3', u:'ha' }, { v:'250', u:'a' }, { v:'28000', u:'m2' }, { v:'0.04', u:'km2' }],", "replace": "    [{ v:'0.03', u:'km2' }, { v:'4', u:'ha' }, { v:'500', u:'a' }, { v:'60000', u:'m2' }],"},
    {"file": "index", "expect": "orderTray(): the tray starts", "find": "  function orderTray(set){ return unsorted(set, m2Of); }", "replace": "  function orderTray(set){ return set.slice().sort(function(a, b){ return m2Of(a) - m2Of(b); }); }"},
    {"file": "index", "expect": "canonical sentence", "find": "(r === 1 ? 'is' : 'are') + ' smaller' : 'none of the four is smaller')", "replace": "(r === 1 ? 'is' : 'are') + ' bigger' : 'none of the four is smaller')"},
    {"file": "index", "expect": "GAME gOrderDone", "find": "      gOrderDone: function(list){ return '排好了！' + list.join(' ＜ ') + ' 平方公尺。'; },", "replace": "      gOrderDone: function(list){ return '排好了！' + list.slice().reverse().join(' ＜ ') + ' 平方公尺。'; },"},
    {"file": "index", "expect": "the whole row", "find": "        return { i:i, z:z, cx:(ORDER.lblX + ORDER.slotX + ORDER.slotW) / 2, cy:y + ORDER.slotH / 2, hw:(ORDER.slotX + ORDER.slotW - ORDER.lblX) / 2, hh:ORDER.slotH / 2,", "replace": "        return { i:i, z:z, cx:ORDER.slotX + ORDER.slotW / 2, cy:y + ORDER.slotH / 2, hw:ORDER.slotW / 2, hh:ORDER.slotH / 2,"},
    {"file": "index", "expect": "order rows: the drop zones never overlap", "find": "cardW:140, cardH:46, trayX:[78, 222], trayY:[256, 310] }, ORDER_H = 340;", "replace": "cardW:140, cardH:46, trayX:[78, 222], trayY:[256, 310] }, ORDER_H = 340; ORDER.pad = 3;"},
    {"file": "index", "expect": "gOrderSlots en", "find": "      gOrderSlots: ['Smallest', '2nd', '3rd', 'Largest'],", "replace": "      gOrderSlots: ['Largest', '3rd', '2nd', 'Smallest'],"},
    {"file": "index", "expect": "the card / row judged", "find": "        var c = P.data.c, why = orderWhy(d, set, c, s.i, lang);", "replace": "        var c = P.data.c, why = orderWhy(d, set, c, 0, lang);"},
    {"file": "index", "expect": "mistake key: a card into a row", "find": "        if (why){ roundMiss(why, c.v + c.u + '@' + s.i); return false; }", "replace": "        if (why){ roundMiss(why, c.v + c.u + '@' + gScore); return false; }"},
    {"file": "index", "expect": "a card does not show the area", "find": "text:aStr(c.v, c.u, lang), cls:'gcard gacard', data:{ c:c } });", "replace": "text:aStr(c.v, 'm2', lang), cls:'gcard gacard', data:{ c:c } });"},
    {"file": "index", "expect": "fmtArea() wrote", "find": "  function fmtArea(v, u, lang){ return v + ' ' + UNIT[lang][u]; }", "replace": "  function fmtArea(v, u, lang){ return v + UNIT[lang][u]; }"},
    {"file": "index", "expect": "the units do not match", "find": "eqDown: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.zh[fromU] + ' × 100 = <b>' + toV + ' ' + UNIT.zh[toU] + '</b>'; },", "replace": "eqDown: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.zh[toU] + ' × 100 = <b>' + toV + ' ' + UNIT.zh[fromU] + '</b>'; },"},
    {"file": "index", "expect": "the two plots are equal", "find": "bIcon:'🍊', bId:'orchard', bVal:25000, bUnit:'m2' },", "replace": "bIcon:'🍊', bId:'orchard', bVal:30000, bUnit:'m2' },"},
    {"file": "index", "expect": "this claim is wrong", "find": "          why:'1 公頃 = 10000 平方公尺，3 × 10000 = 30000 平方公尺。' },", "replace": "          why:'1 公頃 = 10000 平方公尺，3 × 10000 = 3000 平方公尺。' },"},
    {"file": "index", "expect": "the verified static equations changed", "find": "          why:'1 公畝 = 100 平方公尺（公畝的符號是 a），這是課綱定義的換算關係。' },", "replace": "          why:'1 公畝 = 100 平方公尺（公畝的符號是 a），這是課綱定義的換算關係（1 公頃 = 10000 平方公尺）。' },"},
    {"file": "index", "expect": "wrongOnPurpose", "find": "      s2mis: '很多人會猜：1 平方公尺 = 100 平方公分。", "replace": "      s2mis: '很多人會猜：1 平方公尺 = 1000 平方公分。"},
    {"file": "index", "expect": "never reaches the marked answer", "find": "        { stem:'1 公畝 等於多少平方公尺？', opts:['10 平方公尺','100 平方公尺','1000 平方公尺','10000 平方公尺'], ans:1,", "replace": "        { stem:'1 公畝 等於多少平方公尺？', opts:['10 平方公尺','100 平方公尺','1000 平方公尺','10000 平方公尺'], ans:2,"},
    {"file": "index", "expect": "this claim is wrong", "find": "eqUp: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.zh[fromU] + ' ÷ 100 = <b>'", "replace": "eqUp: function(fromV, fromU, toV, toU){ return fromV + ' ' + UNIT.zh[fromU] + ' ÷ 1000 = <b>'"},
    {"file": "review", "expect": "copies the number", "find": "    (avoid || []).forEach(function(a){ seen[String(a)] = true; });", "replace": ""},
    {"file": "review", "expect": "missing space between Chinese and a digit", "find": "  function withUnit(v, unit, lang){ return v + ' ' + u(unit, lang); }", "replace": "  function withUnit(v, unit, lang){ return lang === 'zh' ? v + u(unit, lang) : v + ' ' + u(unit, lang); }"},
    {"file": "review", "expect": "loVal != hiVal × 100", "find": "        var loVal = hiVal * 100;", "replace": "        var loVal = hiVal * 1000;"},
    {"file": "review", "expect": "does not convert both plots", "find": "' ＝ ' + d.m2A + ' 平方公尺，乙地 '", "replace": "'，合 ' + d.m2A + ' 平方公尺，乙地 '"},
    {"file": "review", "expect": "per step", "find": "        var factor = Math.pow(100, skip);", "replace": "        var factor = Math.pow(10, skip);"},
    {"file": "review", "expect": "area is not", "find": "        var area = shape === 'rect' ? base * height : (base * height) / 2;", "replace": "        var area = shape === 'rect' ? base * height : base * height;"},
    {"file": "review", "expect": "correct ", "find": "        var correct = kind === 'ladder' ? 100 : kind === 'areaSpecial' ? 10000 : 1000000;", "replace": "        var correct = kind === 'ladder' ? 100 : kind === 'areaSpecial' ? 10000 : 10000;"},
    {"file": "review", "expect": "claims", "find": "why = lang === 'zh' ? '1 公噸 = 1000 公斤：'", "replace": "why = lang === 'zh' ? '1 公噸 = 100 公斤：'"},
    {"file": "review", "expect": "outside", "find": "[l + w + h, l * w, 2 * (l * w + w * h + l * h), l * w + w * h + l * h, 4 * (l + w + h)], [l, w, h]);", "replace": "[l + w + h, l * w, 2 * (l * w + w * h + l * h), l * w + w * h + l * h, 400 * (l + w + h)], [l, w, h]);"},
    {"file": "review", "expect": "distractor", "find": "          var m2 = mixOpts(hiVal, [hiVal * 10, hiVal / 10, hiVal / 100], [loVal]);", "replace": "          var m2 = mixOpts(hiVal, [loVal, hiVal / 10, hiVal / 100]);"},
    {"file": "index", "expect": "thousands comma", "find": "why:'1 平方公里 = 100 公頃，272 × 100 = 27200 公頃。' },", "replace": "why:'1 平方公里 = 100 公頃，272 × 100 = 27,200 公頃。' },"},
    {"file": "index", "expect": "not a unit this checker knows", "find": "1 ha = 10000 m², 1 km² = 1000000 m².'", "replace": "1 ha = 10000 m², 1 km² = 1000000 squares.'"},
    {"file": "index", "expect": "wrongOnPurpose", "find": "s2mis: 'Many people guess: 1 square meter = 100 square centimeters.", "replace": "s2mis: 'Many people guess: 1 square meter = 1000 square centimeters."},
    {"file": "index", "expect": "◀ ▶ do not end a held grip", "find": "        grip.rehome(pointGapX(n, g), POINT.knobY);   /* 另一根手指還拿著把手時按 ◀ ▶", "replace": "        if (!grip.busy()) grip.rehome(pointGapX(n, g), POINT.knobY);   /* 另一根手指還拿著把手時按 ◀ ▶"},
    {"file": "review", "expect": "is not one of the misconceptions", "find": "[areaM2, aVal * 10, areaM2 / 10000, 2 * (l + w)], [l, w]);", "replace": "[areaM2, aVal * 10, aVal + 1, aVal * 100], [l, w]);"},
    {"file": "review", "expect": "is not one of the misconceptions", "find": "        } while ((base - 2) * (height - 2) === 4);", "replace": "        } while (false);"},
    {"file": "review", "expect": "naming the bigger plot", "find": "' 平方公尺，' + (d.aWins ? '甲地' : '乙地') + '比較大。'", "replace": "' 平方公尺，' + (d.aWins ? '乙地' : '甲地') + '比較大。'"},
    {"file": "review", "expect": "is not one of the misconceptions", "find": "l * w + w * h + l * h, 4 * (l + w + h)], [l, w, h]);", "replace": "l * w + w * h + l * h, vol + 1], [l, w, h]);"},
    {"file": "index", "expect": "must say \"還在原來的位置\"", "find": "gPointStill: '小數點還在原來的位置：", "replace": "gPointStill: '小數點還沒動："},
    {"file": "index", "expect": "must not say \"not moved\"", "find": "gPointStill: 'The decimal point is still where it started", "replace": "gPointStill: 'The decimal point has not moved; it is still where it started"},
    {"file": "index", "expect": "non-breaking space", "find": "(or tap a tick below, or press ◀ ▶), then press", "replace": "(or tap a tick below, or press ◀ ▶), then press"},
    {"file": "index", "expect": "GAME gPointRead", "find": "gPointRead: function(r, to){ return 'Now: ' + r + ' ' + UNIT.en[to]; },", "replace": "gPointRead: function(r, to){ return 'You wrote: ' + r + ' ' + UNIT.en[to]; },"}
  ],

  sim: {
    optCount: { compareAreas: 2, '*': 4 },
    INVARIANTS: {
      areaLadderStep: d => {
        const i = LADDER_REF.indexOf(d.hiUnit), j = LADDER_REF.indexOf(d.loUnit);
        if (i < 0 || j !== i + 1) return d.hiUnit + ' → ' + d.loUnit + ' is not one step down the area ladder';
        if (d.loVal !== d.hiVal * 100) return 'loVal != hiVal × 100';
      },
      areaCm2M2: d => { if (d.cm2Val !== d.m2Val * 10000) return 'cm2Val != m2Val × 10000'; },
      volM3Cm3: d => { if (d.cm3Val !== d.m3Val * 1000000) return 'cm3Val != m3Val × 1000000'; },
      compareAreas: d => {
        if (d.uA === d.uB) return 'both plots use the same unit — nothing to unify';
        if (d.m2A !== m2Ref({ v:String(d.vA), u:d.uA }) || d.m2B !== m2Ref({ v:String(d.vB), u:d.uB })) return 'm2A / m2B are not the conversions';
        if (d.m2A === d.m2B) return 'the two plots are equal';
        if (d.aWins !== (d.m2A > d.m2B)) return 'aWins is wrong';
      },
      wordRectToA: d => { if (d.areaM2 !== d.l * d.w || d.aVal * 100 !== d.areaM2 || !isInt(d.aVal)) return 'areaM2 / aVal wrong (or not a whole number of ares)'; },
      multiplierCheck: d => { if (d.correct !== { ladder:100, areaSpecial:10000, volSpecial:1000000 }[d.kind]) return 'correct ' + d.correct + ' is not the factor for ' + d.kind; },
      chainedLadder: d => {
        if (d.toVal !== d.kmVal * Math.pow(100, d.toUnit === 'a' ? 2 : 3) || (d.toUnit !== 'a' && d.toUnit !== 'm2')) return 'toVal is not km² × 100 per step';
        if (d.factor !== Math.pow(100, d.toUnit === 'a' ? 2 : 3)) return 'factor is not 100 per step';
      },
      areaFormula: d => {
        const a = d.shape === 'rect' ? d.base * d.height : d.base * d.height / 2;
        if (d.area !== a || !isInt(a)) return 'area is not base × height' + (d.shape === 'rect' ? '' : ' ÷ 2 (or not whole)');
      },
      boxVolume: d => { if (d.vol !== d.l * d.w * d.h) return 'vol != l × w × h'; },
      tonneKg: d => { if (d.kgVal !== d.tVal * 1000) return 'kgVal != tVal × 1000'; }
    },
    /* 正解的第二套實作：只用原始參數重算 */
    expectedCorrect: function(d, genId, L){
      switch (genId){
        case 'areaLadderStep': return String(d.down ? d.hiVal * 100 : d.hiVal);
        case 'areaCm2M2': return String(d.down ? d.m2Val * 10000 : d.m2Val);
        case 'volM3Cm3': return String(d.down ? d.m3Val * 1000000 : d.m3Val);
        case 'compareAreas': { const a = m2Ref({ v:String(d.vA), u:d.uA }), b = m2Ref({ v:String(d.vB), u:d.uB }); return a > b ? (L === 'zh' ? '甲地' : 'Plot A') : (L === 'zh' ? '乙地' : 'Plot B'); }
        case 'wordRectToA': return String(d.l * d.w / 100);
        case 'multiplierCheck': return String({ ladder:100, areaSpecial:10000, volSpecial:1000000 }[d.kind]);
        case 'chainedLadder': return String(d.kmVal * Math.pow(100, d.toUnit === 'a' ? 2 : 3));
        case 'areaFormula': return (d.shape === 'rect' ? d.base * d.height : d.base * d.height / 2) + ' ' + U_W[L].cm2;
        case 'boxVolume': return d.l * d.w * d.h + ' ' + U_W[L].cm3;
        case 'tonneKg': return String(d.down ? d.tVal * 1000 : d.tVal);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, L){
      const range = (v, lo, hi) => (v >= lo && v <= hi) ? null : 'option ' + s + ' outside ' + lo + '~' + hi;
      if (genId === 'compareAreas') return ((L === 'zh' ? ['甲地', '乙地'] : ['Plot A', 'Plot B']).indexOf(s) < 0) ? 'option "' + s + '" is not one of the two plots' : null;
      if (genId === 'areaFormula' || genId === 'boxVolume'){
        const u = genId === 'areaFormula' ? U_W[L].cm2 : U_W[L].cm3, m = s.match(genId === 'areaFormula' ? /^(\d+(?:\.5)?) (\S+)$/ : /^(\d+) (\S+)$/);
        if (!m || m[2] !== u) return 'option "' + s + '" is not "n ' + u + '"';
        return genId === 'areaFormula' ? range(+m[1], 1, 250) : range(+m[1], 4, 1200);   /* 長、寬、高 2～8：長 × 寬 最小 4 */
      }
      if (!/^\d+(?:\.\d{1,2})?$/.test(s) || /^0\d/.test(s)) return 'option "' + s + '" is not a plainly written number';
      const v = +s;
      if (genId === 'multiplierCheck') return ['100', '1000', '10000', '1000000'].indexOf(s) < 0 ? 'option ' + s + ' is not a power of ten the lesson uses' : null;
      if (genId === 'areaLadderStep') return range(v, 0.01, 200000);   /* 1～20 的 × 10000 ／ ÷ 100 */
      if (genId === 'areaCm2M2') return range(v, 0.1, 900000);
      if (genId === 'volM3Cm3') return range(v, 1, 9000000);
      if (genId === 'wordRectToA') return range(v, 0.01, 3000);   /* 多 ÷ 100 的迷思：100 ～ 3000 平方公尺 ÷ 10000 ＝ 0.01 ～ 0.3 */
      if (genId === 'chainedLadder') return range(v, 100, 80000000);
      if (genId === 'tonneKg') return range(v, 0.1, 90000);
      return 'no option rule for ' + genId;
    },
    /* 題幹與解釋的算式交給這一課的驗算器（單位真的換算、小數、階梯） */
    renderCheck: function(d, q, L, genId){
      /* simgen 共用的「誘答抄題幹」只比純整數的選項；這一課有小數選項與帶單位的選項 —— 這裡把每個誘答的數（含小數）和題幹裡的數比 */
      const stemNums = nums(q.stem);
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const v = nums(q.opts[i]);
        if (v.length === 1 && stemNums.indexOf(v[0]) >= 0) return 'distractor "' + q.opts[i] + '" copies the number ' + v[0] + ' out of the stem';
      }
      if (DOMAIN_PROBLEMS.length) return 'distractor domain: ' + DOMAIN_PROBLEMS[0];
      const r = areaClaims(q.stem + '\n' + q.why);
      if (r.problems.length) return 'claims: ' + r.problems[0];
      if (!r.verified) return 'the explanation has no verifiable equation: ' + q.why;
      if (genId === 'compareAreas'){
        if (r.verified !== 2) return 'the explanation does not convert both plots: ' + q.why;
        /* 結論那一句要說對是哪一塊比較大（兩塊的名字在換算裡都出現過，所以比句尾） */
        const aWins = m2Ref({ v:String(d.vA), u:d.uA }) > m2Ref({ v:String(d.vB), u:d.uB });
        const tail = L === 'zh' ? '，' + (aWins ? '甲地' : '乙地') + '比較大。' : ', so ' + (aWins ? 'Plot A' : 'Plot B') + ' is bigger.';
        if (!q.why.endsWith(tail)) return 'the explanation does not end by naming the bigger plot ("' + tail + '"): ' + q.why;
      }
      /* 每一個誘答都要是一個說得出名字的迷思（設定檔自己的公式），不可以是 makeWrongs 保底的「正解 ± 1」（codex 第一輪 1b #1、#4） */
      const allowed = DISTRACTORS[genId] ? DISTRACTORS[genId](d) : null;
      if (allowed){
        for (let i = 0; i < q.opts.length; i++){
          if (i === q.ans) continue;
          const v = nums(q.opts[i])[0];
          if (allowed.indexOf(v) < 0) return 'distractor "' + q.opts[i] + '" is not one of the misconceptions ' + allowed.join('/');
        }
      } else if (genId !== 'compareAreas') return 'no distractor rule for ' + genId;
      /* 解釋裡要真的出現正解的數 */
      const a = nums(q.opts[q.ans])[0];
      if (a !== undefined && nums(q.why).indexOf(a) < 0) return 'the explanation never reaches the answer ' + q.opts[q.ans];
    }
  },

  data: {
    dataStart: '  /* ---------- 語言無關的資料',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{UNIT, divExact, m2To, toM2, fmtArea, LANDMARKS, LADDER_STARTS, LEVELS, PLOTS, GAME_ORDER, GPICK, shuffle, pick, unsorted, shiftDec, aStr, POW, DIM, tenTo, TILE, TILE_H, GAME_TILE, tileWhy, POINT, POINT_H, GAME_POINT, pointCells, pointRead, pointShift, pointTarget, pointX0, pointGapX, pointGap, pointWhy, SORTB, SORT_H, SORT_F, LADDER, GAME_SORT, sortFactor, sortPick, sortKind, sortHow, sortWhy, WRITE, WRITE_H, GAME_WRITE, writeDigits, writeWhy, ORDER, ORDER_H, GAME_ORDERA, m2Of, orderTray, orderRank, orderWhy}',
    check: function(data, I18N, fail, src){
      const D = data, W = 300, EPS = 1e-9;
      /* 一句話：沒有 undefined／NaN、英文沒有中文、中文和數字之間有空格、算式全部驗得過；want 給了就逐個比數字 */
      let claimCount = 0;
      const excused = {};
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: missing space between Chinese and a digit in "' + s + '"');
        const r = areaClaims(s);
        claimCount += r.verified;
        r.problems.forEach(p => {
          const k = WRONG_ON_PURPOSE.findIndex(w => w[0] === where && p === 'this claim is wrong: "' + w[1] + '"');
          if (k >= 0){ excused[k] = (excused[k] || 0) + 1; return; }
          fail(where + ' ' + L + ': ' + p);
        });
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r;
      };
      const has = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (s.indexOf(w) < 0) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 驗算器自己先證明會響（正反例） --- */
      CLAIM_PROBES.forEach(([t, bad]) => {
        const r = areaClaims(t);
        if (bad !== (r.problems.length > 0)) fail('areaClaims() self-test: "' + t + '" should be ' + (bad ? 'rejected' : 'accepted') + ', got ' + JSON.stringify(r.problems));
        if (!bad && !r.verified && !/[？?]|多少|[=＝]\s*$/.test(t)) fail('areaClaims() self-test: "' + t + '" verified nothing');
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
      /* 刻意寫錯的迷思句（範例 2 的「很多人會猜」、補強題的「小美說」）：每一句都要真的對上一次，不多不少 */
      WRONG_ON_PURPOSE.forEach((w, k) => { if (excused[k] !== 1) fail('wrongOnPurpose ' + w[0] + ' "' + w[1] + '" matched ' + (excused[k] || 0) + ' times, expected exactly 1'); });
      const staticSeen = CLAIMS_SEEN.slice().sort();
      const fp = crypto.createHash('sha1').update(staticSeen.join('\n')).digest('hex').slice(0, 12);
      if (staticClaims < 20) fail('only ' + staticClaims + ' equations verified in the I18N strings — the claim scan is not reading them');
      if (module.exports.data.STATIC_PIN && (staticClaims !== module.exports.data.STATIC_PIN.n || fp !== module.exports.data.STATIC_PIN.fp))
        fail('the verified static equations changed: ' + staticClaims + ' / ' + fp + ' (pinned ' + module.exports.data.STATIC_PIN.n + ' / ' + module.exports.data.STATIC_PIN.fp + ') — re-check them and update STATIC_PIN');

      /* 題庫：解釋裡要真的出現被標成正解的那個數 */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => LANGS.forEach(L => (I18N[L][bank] || []).forEach((q, i) => {
        const v = nums(q.opts[q.ans])[0];
        if (v !== undefined && nums(q.why).indexOf(v) < 0) fail(bank + '[' + i + '] ' + L + ': the explanation never reaches the marked answer ' + q.opts[q.ans]);
      })));

      /* --- 2. 範例的句子函式：拿這一課自己的資料呼叫，逐條驗算 --- */
      LANGS.forEach(L => {
        const d = I18N[L];
        /* 換算階梯：每一個起點、每一階往下、再每一階往上 */
        (D.LADDER_STARTS || []).forEach(k => {
          const base = k * 1000000;
          for (let i = 0; i + 1 < D.LEVELS.length; i++){
            const hi = D.LEVELS[i], lo = D.LEVELS[i + 1];
            const dn = d.eqDown(D.m2To(base, hi), hi, D.m2To(base, lo), lo), up = d.eqUp(D.m2To(base, lo), lo, D.m2To(base, hi), hi);
            [dn, up].forEach(s => { const r = say('example 3 ladder ' + k + ' km²', L, s); if (r.verified !== 1) fail('example 3 ladder ' + L + ': "' + s + '" did not verify exactly one claim'); });
            if (D.m2To(base, hi) !== shiftStr(String(base), UPOW.m2 - UPOW[hi]) || D.m2To(base, lo) !== shiftStr(String(base), UPOW.m2 - UPOW[lo])) fail('example 3: m2To() wrote ' + D.m2To(base, hi) + ' / ' + D.m2To(base, lo));
          }
        });
        /* 比一比：兩塊地換成平方公尺 */
        (D.PLOTS || []).forEach(p => {
          const a = D.toM2(p.aVal, p.aUnit), b = D.toM2(p.bVal, p.bUnit);
          if (a !== m2Ref({ v:String(p.aVal), u:p.aUnit }) || b !== m2Ref({ v:String(p.bVal), u:p.bUnit })) fail('example 5: toM2() is not the conversion for ' + JSON.stringify(p));
          if (a === b) fail('example 5: the two plots are equal — nothing to compare');
          const win = a > b ? d.plotNames[p.aId] : d.plotNames[p.bId];
          const s = d.cmpLine(d.plotNames[p.aId], p.aVal, p.aUnit, d.plotNames[p.bId], p.bVal, p.bUnit, { aM2:D.m2To(a, 'm2'), bM2:D.m2To(b, 'm2') }, win, 'm2');
          const r = say('example 5 cmpLine', L, s);
          if (r.verified !== 2) fail('example 5 cmpLine ' + L + ': "' + s + '" verified ' + r.verified + ' conversions, expected 2');
          if (s.indexOf(win) < 0) fail('example 5 cmpLine ' + L + ': does not name the bigger plot');
        });
        /* 選對單位：句子裡的面積就是那個單位寫出來的樣子 */
        (D.LANDMARKS || []).forEach(o => {
          const w = D.fmtArea(D.m2To(o.valueM2, o.unit), o.unit, L);
          const want = shiftStr(String(o.valueM2), UPOW.m2 - UPOW[o.unit]) + ' ' + U_W[L][o.unit];
          if (w !== want) fail('example 1: fmtArea() wrote "' + w + '", should be "' + want + '"');
          say('example 1 objRight', L, d.objRight(d.objs[o.id], w));
          say('example 1 objWrong', L, d.objWrong(d.objs[o.id], w, o.unit));
          say('example 1 objAsk', L, d.objAsk(d.objs[o.id]));
        });
        for (let k = 1; k <= 10; k++){ say('example 2 areaRowEq', L, d.areaRowEq(k), L === 'zh' ? [String(k), '10', String(k * 10)] : [String(k), '10', String(k * 10)]); say('example 4 stackCount', L, d.stackCount(k), [String(k), String(k * 100), '10']); }
      });

      /* ================= 3. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：土地估價師');
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
      const TYPES = ['tile', 'point', 'sort', 'write', 'order'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 2, 3, 2+3+4, 4, 5), got ' + D.GAME_ORDER);
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
      /* 第一層提示的意思：必須說／不可以說 */
      const HINT_SEM = {
        tile: { has:{ zh:['一排有幾塊', '一共有幾排', '相乘就是一共幾塊', '每一塊地磚是幾平方公分', '塊數 × 一塊的面積'], en:['tiles in a row', 'the rows', 'number of tiles', 'how many cm² one tile covers', 'number of tiles × the area of one tile'] }, not:{ zh:['10000', '兩個'], en:['10000', 'the two'] } },
        point: { has:{ zh:['每一階差 100 倍，小數點移 2 位', '差 10000 倍，移 4 位', '比較小的單位，數字變大，小數點往右移', '比較大的單位，數字變小，往左移'], en:['is 100 times, so the point moves 2 places', '10000 times apart, 4 places', 'smaller unit makes the number bigger — move the point right', 'bigger unit makes it smaller — move it left'] }, not:{ zh:['移 3 位', '× 1000，'], en:['3 places'] } },
        sort: { has:{ zh:['長度只有一個方向，× 100', '每往下一階 × 100', '往下兩階就是 100 × 100', '平方公尺換平方公分是 100 × 100', '100 × 100 × 100'], en:['length has one direction, × 100', 'each step down the area ladder is × 100', 'two steps down is 100 × 100', 'm² to cm² is 100 × 100', '100 × 100 × 100'] }, not:{ zh:['× 1000，'], en:['× 1000,'] } },
        write: { has:{ zh:['100 × 100 × 100', '往右移 6 位', '不是面積的 × 10000', '寫 0'], en:['100 × 100 × 100', '6 places right', 'not the area\'s × 10000', 'writing 0'] }, not:{ zh:['移 4 位'], en:['4 places'] } },
        order: { has:{ zh:['換成平方公尺', '1 公畝 ＝ 100 平方公尺', '1 公頃 ＝ 10000 平方公尺', '1 平方公里 ＝ 1000000 平方公尺'], en:['into square metres', '1 a = 100 m²', '1 ha = 10000 m²', '1 km² = 1000000 m²'] }, not:{ zh:['比數字'], en:['compare the numbers'] } }
      };
      TYPES.forEach(t => LANGS.forEach(L => {
        const h = I18N[L].gHints && I18N[L].gHints[t];
        if (typeof h !== 'string') return;
        say('gHints.' + t, L, h);
        has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not);
        say('gAsks.' + t, L, I18N[L].gAsks[t]);
      }));
      /* 畫出來的字和被判斷的值綁在一起 */
      need('tile', /var s = pick\(GAME_TILE\), n = 100 \/ s, N = n \* n, A = s \* s, rh = TILE\.side \/ n, done = 0;/, 'the tile size drawn is not the one judged');
      need('tile', /addZone\(B, TILE\.legX, TILE\.legY, TILE\.legW, TILE\.legH, 'glbl', d\.gTileLeg\(s\)\);/, 'the legend does not show the tile size judged');
      need('tile', /for \(var r = 0; r < n; r\+\+\) rows\.push\(\{ id:r, i:r, cx:TILE\.sqX \+ TILE\.side \/ 2, cy:TILE\.sqY \+ rh \* \(r \+ 0\.5\), hw:TILE\.side \/ 2, hh:rh \/ 2, done:false \}\);/, 'a row\'s drop zone is not the drawn row');
      need('tile', /var why = tileWhy\(d, s, inp\.value\);/, 'Check does not judge what is typed');
      need('tile', /if \(gSolved \|\| done < n\) return;/, 'the answer can be checked before the square is full');
      need('tile', /inp\.setAttribute\('aria-label', d\.gTileEq\.aria\); inp\.disabled = true;/, 'the answer box is not off until the square is full');
      need('tile', /var ok = actionBtn\(row, d\.gTileEq\.ok\);\s*ok\.disabled = true;/, 'the Check button is not off until the square is full');
      need('tile', /var ms = Math\.min\(rh, 24\) - 4;/, 'the mini squares on the strip are not the size the layout check assumes');
      need('tile', /if \(why === 'format'\)\{ roundNote\(d\.gTileFormat\); return; \}/, 'a badly written number is not only a reminder');
      need('tile', /for \(var j = 0; j < n; j\+\+\) addZone\(B, TILE\.sqX \+ j \* rh \+ 1, TILE\.sqY \+ rw\.i \* rh \+ 1, rh - 2, rh - 2, 'gtile'\);/, 'a laid row does not draw n tiles in that row');
      need('point', /cells\.push\(addZone\(B, x0 \+ i \* POINT\.cw, POINT\.y, POINT\.cw, POINT\.h, 'gdig', c\.digits\.charAt\(i\)\)\);/, 'the digit cells do not show the number\'s digits');
      need('point', /dot\.style\.left = \(pointGapX\(n, g\) - 6\) \+ 'px';/, 'the red dot is not drawn at the gap being judged');
      need('point', /read\.textContent = d\.gPointRead\(pointRead\(c\.digits, g\), it\.to\);/, 'the line under the digits does not show what is judged');
      need('point', /var why = pointWhy\(d, it, g\);/, 'Done does not judge the gap that is shown');
      need('point', /snapX:function\(x\)\{ return pointGapX\(n, pointGap\(n, x\)\); \},/, 'the grip does not snap to a gap while dragged');
      need('point', /onPlace:function\(P\)\{ var ng = pointGap\(n, P\.cx\); if \(ng !== g && !gSolved\)\{ g = ng; clearNote\(\); draw\(\); \} \} \}\);/, 'the dot does not follow the grip while it is dragged');
      need('sort', /parts:q\.map\(function\(t\)\{ return \['gl', t\]; \}\), cls:'gcard', label:q\.join\(' '\), data:\{ c:c \} \}\);/, 'a card does not show the conversion it is judged as');
      need('sort', /addZone\(B, SORTB\.x\[i\] \+ 4, SORTB\.y \+ 4, SORTB\.w - 8, SORTB\.lblH, 'gbinlbl', d\.gSortBins\[i\]\);\s*return \{ f:f, i:i,/, 'a box does not show the factor it is judged as');
      need('sort', /var c = P\.data\.c, why = sortWhy\(d, c, bin\.f, lang\);/, 'the card / box judged is not the one dropped');
      need('sort', /'gchip', d\.gSortChip\(c\.from, c\.to\)\);/, 'a placed card does not show its conversion in the box');
      need('write', /addZone\(B, WRITE\.slotX\[i\], WRITE\.lblY, WRITE\.slotW, WRITE\.lblH, 'gslotlbl', d\.gPlaceLbl\[i\]\);/, 'a box does not show its place');
      need('write', /text:String\(x\), cls:'gcard gdigcard', data:\{ v:x \} \}\);/, 'a digit card does not show the digit it is judged as');
      need('write', /var x = P\.data\.v, why = writeWhy\(d, v, s\.i, x\);/, 'the digit / box judged is not the one dropped');
      need('write', /s\.z\.textContent = String\(x\);/, 'a filled box does not show the digit placed');
      need('order', /text:aStr\(c\.v, c\.u, lang\), cls:'gcard gacard', data:\{ c:c \} \}\);/, 'a card does not show the area it is judged by');
      need('order', /var c = P\.data\.c, why = orderWhy\(d, set, c, s\.i, lang\);/, 'the card / row judged is not the one dropped');
      need('order', /addZone\(B, ORDER\.lblX, y, ORDER\.lblW, ORDER\.slotH, 'gslotlbl', d\.gOrderSlots\[i\]\);/, 'a row does not show its rank');
      /* 「同一個錯」的鍵就是「哪一樣放進哪裡」 */
      need('tile', /roundMiss\(why, 'v' \+ inp\.value\.trim\(\)\);/, 'mistake key: an answer is not keyed by the value written');
      need('point', /roundMiss\(why, 'g' \+ g\); return; \}/, 'mistake key: Done is not keyed by the gap');
      need('sort', /roundMiss\(why, c\.from \+ '>' \+ c\.to \+ '@' \+ bin\.f\);/, 'mistake key: a card into a box is not keyed by (card, box)');
      need('write', /roundMiss\(why, s\.i \+ ':' \+ x\);/, 'mistake key: a digit into a box is not keyed by (box, digit)');
      need('order', /roundMiss\(why, c\.v \+ c\.u \+ '@' \+ s\.i\);/, 'mistake key: a card into a row is not keyed by (card, row)');
      if ((gsrc.match(/roundMiss\(/g) || []).length !== 6) fail('GAME: roundMiss() is called ' + (gsrc.match(/roundMiss\(/g) || []).length + ' times, expected 6 (the definition + one per round) — a new call has an unchecked key');
      need('point', /grip\.rehome\(pointGapX\(n, g\), POINT\.knobY\);   \/\* 另一根手指還拿著把手時按「換好了」/, 'Done does not end a held grip — the grip can snap back to the start while the dot stays on the answer');
      need('point', /function setG\(ng\)\{[\s\S]*?\n        grip\.rehome\(pointGapX\(n, g\), POINT\.knobY\);   \/\* 另一根手指還拿著把手時按 ◀ ▶/, '◀ ▶ do not end a held grip — the grip stays at one gap while the dot shows another (codex round 1)');

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
      ['tile', 'sort', 'write', 'order'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
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

      /* --- shuffle()：切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'shuffle');
        let shuffleFn = null;
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
      /* 收件範圍整片每 0.5px：和自己的「最近的方框」比，而且要真的有重疊的地方；每一格裡面的點都收在自己那一格 */
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
        if (!overlap) fail('GAME ' + what + ': the drop zones never overlap — the gap between two adjacent boxes belongs to neither box (a drop straddling them would bounce), and the nearest-box rule is never exercised');
        for (const z of list) for (let y = z.cy - z.hh; y <= z.cy + z.hh; y += 1) for (let x = z.cx - z.hw; x <= z.cx + z.hw; x += 1){
          /* 相鄰兩格共用的那一條邊（地磚的每一排上下貼在一起）：兩格都算「在框裡」，歸哪一格都對 */
          if (list.some(o => o !== z && Math.abs(x - o.cx) <= o.hw + EPS && Math.abs(y - o.cy) <= o.hh + EPS)) continue;
          const a = nearestOpen(list, { x, y }, pad);
          if (!a || a.id !== z.id){ fail('GAME ' + what + ': a point inside box ' + z.id + ' (' + x + ', ' + y + ') goes to ' + (a ? a.id : 'none')); return; }
        }
      };

      /* ===== 第 1 關：鋪地磚 ===== */
      {
        const P = D.TILE, H = D.TILE_H, G = D.GAME_TILE || [];
        if (G.indexOf(10) < 0) fail('GAME tile: the pool has no 10 cm tile (example 2\'s own tile)');
        if (G.length < 3) fail('GAME tile: fewer than three tile sizes — the tile count never changes');
        const BAD_FORMS = ['', ' ', '1 0000', '10,000', '010000', '10000.0', '1e4', 'abc', '-10000', '１００００'];
        G.forEach(s => {
          const n = 100 / s, N = n * n, A = s * s;
          if (!(isInt(n) && n >= 2 && n <= 10)) fail('GAME tile: a ' + s + ' cm tile does not fit 100 cm a whole number of times (2~10)');
          if (A * N !== 10000) fail('GAME tile: ' + N + ' tiles of ' + A + ' cm² do not make 10000 cm²');
          LANGS.forEach(L => {
            const d = I18N[L];
            if (D.tileWhy(d, s, '10000') !== null || D.tileWhy(d, s, ' 10000 ') !== null) fail('GAME tileWhy(' + s + ', 10000) ' + L + ' refuses the right answer');
            BAD_FORMS.forEach(f => { if (D.tileWhy(d, s, f) !== 'format') fail('GAME tileWhy(' + s + ', "' + f + '") ' + L + ' is not only a reminder'); });
            /* 每一種錯的寫法：說明的那件事要成立 */
            const cases = [[N, 'count'], [100, 'side'], [A, 'one'], [1000, 'other'], [100000, 'other'], [9999, 'other'], [1, 'other'], [1000000, 'other']];
            cases.forEach(([v, kind]) => {
              if (v === 10000) return;
              const why = D.tileWhy(d, s, String(v));
              if (typeof why !== 'string' || why === 'format'){ fail('GAME tileWhy(' + s + ', ' + v + ') ' + L + ' accepts a wrong answer'); return; }
              const k = v === N ? 'count' : v === 100 ? 'side' : v === A ? 'one' : 'other';
              const r = say('GAME tileWhy ' + s + ' ' + v, L, why);
              if (k === 'count'){
                say('GAME tileWhy count', L, why, [String(N), String(s), String(s), String(A), '1']);
                if (r.verified !== 1) fail('GAME tileWhy count ' + L + ': "' + why + '" does not verify ' + s + ' × ' + s + ' = ' + A);
                has('GAME tileWhy count', L, why, { zh:['塊數'], en:['number of tiles'] });
              } else if (k === 'side'){
                if (r.verified !== 1) fail('GAME tileWhy side ' + L + ': "' + why + '" does not verify 1 m = 100 cm');
                has('GAME tileWhy side', L, why, { zh:['一條邊', '長 × 寬'], en:['one side', 'length × width'] });
              } else if (k === 'one'){
                say('GAME tileWhy one', L, why, [String(A), String(s), String(s), String(N)]);
                has('GAME tileWhy one', L, why, { zh:['一塊地磚'], en:['one tile'] });
              } else {
                say('GAME tileWhy other', L, why, [String(N), String(A), String(N), String(A), String(v)]);
              }
            });
            const done = d.gTileDone(n, N, s, A);
            const rd = say('GAME gTileDone ' + s, L, done, [String(n), String(n), String(N), String(s), String(s), String(A), String(N), String(A), '10000', '1']);
            if (rd.verified !== 4) fail('GAME gTileDone ' + L + ': "' + done + '" verified ' + rd.verified + ' equations, expected 4');
            if (done !== REF.tileDone(L, n, N, s, A)) fail('GAME gTileDone ' + L + ': "' + done + '" is not the canonical sentence "' + REF.tileDone(L, n, N, s, A) + '"');
            const full = d.gTileFull(n, N);
            const rf = say('GAME gTileFull', L, full, (L === 'zh' ? [String(n), String(n), String(n), String(n), String(N), '1'] : [String(n), String(n), String(n), String(n), String(N), '1']));
            if (rf.verified !== 1) fail('GAME gTileFull ' + L + ': the tile count ' + n + ' × ' + n + ' = ' + N + ' is not verified');
            say('GAME gTile2', L, d.gTile2(N, s, A), ['2', String(N), String(s), String(s), String(A)]);
            say('GAME gTileLeg', L, d.gTileLeg(s), [String(s), String(s)]);
            say('GAME gTileStrip', L, d.gTileStrip(n), [String(n)]);
            for (let k = 0; k <= n; k++) say('GAME gTileNow', L, d.gTileNow(k, n), [String(k), String(n)]);
          });
          /* 地磚條上的小方塊放得進地磚條 */
          const rh = P.side / n, ms = Math.min(rh, 24) - 4;
          if (!(n * ms + (n - 1) * 2 <= P.stripW - 10)) fail('GAME tile: ' + n + ' mini squares of ' + ms + 'px do not fit the ' + P.stripW + 'px strip');
          if (!(ms + 3 + 13 * 1.2 + 6 + 4 <= P.stripH)) fail('GAME tile: the strip is not tall enough for its mini squares and caption');
          sweepZones('tile rows (' + s + ' cm)', Array.from({ length:n }, (x, r) => ({ id:r, cx:P.sqX + P.side / 2, cy:P.sqY + rh * (r + 0.5), hw:P.side / 2, hh:rh / 2, done:false })), P.pad, H);
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          const top = say('GAME gTileTop', L, d.gTileTop, ['1', '100']);
          if (top.verified !== 1) fail('GAME gTileTop ' + L + ': "' + d.gTileTop + '" is not "1 m = 100 cm"');
          say('GAME gTileLeft', L, d.gTileLeft, ['1']);
          say('GAME gTileSide', L, d.gTileSide, ['1', '100', '100']);
          say('GAME gTileFormat', L, d.gTileFormat, ['0']);
          ['pre', 'post', 'ok', 'aria'].forEach(k => { if (!d.gTileEq || typeof d.gTileEq[k] !== 'string' || !d.gTileEq[k]) fail('GAME gTileEq.' + k + ' missing in ' + L); });
          if (d.gTileEq.pre.indexOf(L === 'zh' ? '1 平方公尺' : '1 m²') < 0 || d.gTileEq.post !== U_W[L].cm2) fail('GAME gTileEq ' + L + ' must read "1 m² = □ cm²"');
        });
        /* 版面 */
        const sqr = { x:P.sqX, y:P.sqY, w:P.side, h:P.side };
        inside(sqr, 'tile square', H);
        const top = { x:P.sqX, y:P.topY, w:P.side, h:P.topH }, left = { x:P.leftX, y:P.sqY, w:P.leftW, h:P.side }, leg = { x:P.legX, y:P.legY, w:P.legW, h:P.legH };
        [top, left, leg].forEach((z, i) => inside(z, 'tile label ' + i, H));
        noHits([sqr, top, left, leg], 'tile square / labels');
        const strip = sq(150, P.stripY, P.stripW, P.stripH);
        inside(strip, 'tile strip', H);
        noHits([strip, sqr, leg, top, left], 'tile strip / square / labels');
        if (strip.y < P.sqY + P.side + P.pad) fail('GAME tile: the strip sits in the bottom row\'s drop zone');
        tooSmall('tile strip', Math.min(P.stripW, P.stripH));
        if (!(P.pad >= 6)) fail('GAME tile: the drop zone pad is ' + P.pad + ' — a strip let go on the square\'s edge would bounce');
        if (Math.abs(P.side - 200) > EPS || P.sqX + P.side / 2 !== 150) fail('GAME tile: the square is not the 200px square centred on the board');
      }

      /* ===== 第 2 關：小數點搬家 ===== */
      {
        const P = D.POINT, H = D.POINT_H;
        const kinds = new Set();
        (D.GAME_POINT || []).forEach(it => {
          if (UDIM[it.from] !== 2 || UDIM[it.to] !== 2) fail('GAME point: ' + it.v + ' ' + it.from + ' → ' + it.to + ' is not an area conversion');
          const sh = UPOW[it.from] - UPOW[it.to];
          const oneStep = Math.abs(LADDER_REF.indexOf(it.from) - LADDER_REF.indexOf(it.to));
          const special = (it.from === 'cm2' && it.to === 'm2') || (it.from === 'm2' && it.to === 'cm2');
          if (!special && !(LADDER_REF.indexOf(it.from) >= 0 && LADDER_REF.indexOf(it.to) >= 0 && (oneStep === 1 || oneStep === 2))) fail('GAME point: ' + it.from + ' → ' + it.to + ' is not one or two steps on the ladder (or m² ↔ cm²)');
          if (D.pointShift(it) !== sh) fail('GAME pointShift(' + it.from + ' → ' + it.to + ') = ' + D.pointShift(it) + ', should be ' + sh);
          if (!/^\d+(?:\.\d+)?$/.test(it.v) || /^0\d/.test(it.v) || /\.\d*0$/.test(it.v)) fail('GAME point: "' + it.v + '" is not a plainly written number');
          kinds.add(sh);
          const c = D.pointCells(it.v), n = c.digits.length;
          const want = shiftStr(it.v, sh), tg = D.pointTarget(it);
          if (D.pointRead(c.digits, c.g0) !== it.v) fail('GAME point: the start reads ' + D.pointRead(c.digits, c.g0) + ', not ' + it.v);
          if (!(tg >= 1 && tg <= n)) fail('GAME point: the answer gap ' + tg + ' for ' + it.v + ' is off the strip (1~' + n + ')');
          if (D.pointRead(c.digits, tg) !== want) fail('GAME point: ' + it.v + ' ' + it.from + ' → ' + it.to + ' reads ' + D.pointRead(c.digits, tg) + ' at the answer gap, should be ' + want);
          if (!/^0000/.test(c.digits) || !/0000$/.test(c.digits)) fail('GAME point: ' + it.v + ' is not padded with four zeros each side');
          inside({ x:D.pointX0(n), y:P.y, w:n * P.cw, h:P.h }, 'point digits for ' + it.v, H);
          for (let g = 1; g <= n; g++){
            const r = shiftStr(it.v, g - c.g0);
            if (D.pointRead(c.digits, g) !== r) fail('GAME pointRead(' + it.v + ', ' + g + ') is ' + D.pointRead(c.digits, g) + ', should be ' + r);
            LANGS.forEach(L => {
              const d = I18N[L], why = D.pointWhy(d, it, g);
              if (g === tg){ if (why !== null) fail('GAME pointWhy(' + it.v + ', ' + g + ') refuses the right gap'); return; }
              if (g === c.g0){ if (why !== 'still') fail('GAME pointWhy(' + it.v + ', start) should only remind (still), got ' + why); return; }
              if (typeof why !== 'string' || why === 'still'){ fail('GAME pointWhy(' + it.v + ', ' + g + ') accepts a wrong gap'); return; }
              const m = g - c.g0, k = Math.abs(m), f = ten(k), right = m > 0, op = right ? '×' : '÷', down = sh > 0;
              const rr = say('GAME pointWhy ' + it.v + ' @' + g, L, why);
              if (rr.verified < 1) fail('GAME pointWhy ' + L + ': no equation verified in "' + why + '"');
              if (why.indexOf(it.v + ' ' + op + ' ' + f + (L === 'zh' ? ' ＝ ' : ' = ') + r) < 0) fail('GAME pointWhy ' + L + ': "' + why + '" must compute ' + it.v + ' ' + op + ' ' + f + ' = ' + r);
              if (right === down){
                const F = ten(Math.abs(sh));
                if (rr.verified !== 2) fail('GAME pointWhy size ' + L + ': "' + why + '" must verify both the move and "1 unit = ' + F + ' units"');
                has('GAME pointWhy size ' + it.v, L, why, { zh:['移了 ' + k + ' 位', '要 ' + op + ' ' + F + '，移 ' + Math.abs(sh) + ' 位'], en:['moved the point ' + k + ' place', op + ' ' + F + ' — ' + Math.abs(sh) + ' places'] });
              } else {
                has('GAME pointWhy direction ' + it.v, L, why, { zh:['數字變' + (right ? '大' : '小') + '了', '數字要變' + (right ? '小' : '大')], en:['got ' + (right ? 'bigger' : 'smaller'), 'has to get ' + (right ? 'smaller' : 'bigger')] });
                if ((rCmp(ratOf(r), ratOf(it.v)) > 0) !== right) fail('GAME pointWhy ' + it.v + ' @' + g + ': says the number got ' + (right ? 'bigger' : 'smaller') + ', it did not');
                /* 「換成比較大／小的單位」要成立 */
                if ((UPOW[it.to] > UPOW[it.from]) !== right) fail('GAME pointWhy ' + it.v + ': says the unit is ' + (right ? 'bigger' : 'smaller') + ', it is not');
              }
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L], op = sh > 0 ? '×' : '÷', F = ten(Math.abs(sh));
            const y = d.gPointYes(it.v, it.from, it.to, want);
            const ry = say('GAME gPointYes ' + it.v, L, y, [it.v, want, it.v, F, want]);
            has('GAME gPointYes', L, y, { zh:['換好了', op + ' ' + F], en:['Done', op + ' ' + F] });
            if (ry.verified !== 2) fail('GAME gPointYes ' + L + ': "' + y + '" verified ' + ry.verified + ' equations, expected 2');
            say('GAME gPointNow ' + it.v, L, d.gPointNow(it.v, it.from, it.to), [it.v]);
            say('GAME gPointRead', L, d.gPointRead(want, it.to), [want]);
            /* 回合一開始就畫出來（孩子什麼都還沒做）：只能說「現在是」，不可以說「你寫的是」（codex 第五輪） */
            hasNot('GAME gPointRead', L, d.gPointRead(want, it.to), { zh:['寫'], en:['wrote', 'You '] });
            const h2 = d.gPoint2(it.from, it.to);
            say('GAME gPoint2', L, h2, ['2', F, String(Math.abs(sh))]);
            has('GAME gPoint2', L, h2, sh > 0 ? { zh:['× ' + F, '往右數 ' + sh + ' 格'], en:['× ' + F, sh + ' places right'] } : { zh:['÷ ' + F, '往左數 ' + (-sh) + ' 格'], en:['÷ ' + F, (-sh) + ' places left'] });
          });
          const x0 = D.pointX0(n);
          for (let x = x0 - P.cw; x <= x0 + (n + 1) * P.cw; x += 0.25){
            let best = 1;
            for (let gg = 1; gg <= n; gg++) if (Math.abs(x - (x0 + gg * P.cw)) < Math.abs(x - (x0 + best * P.cw)) - 1e-9) best = gg;
            const got = D.pointGap(n, x);
            const mid = Math.abs(((x - x0) / P.cw) % 1 - 0.5) < 1e-9;
            if (got !== best && !mid){ fail('GAME pointGap(' + n + ', ' + x + ') = ' + got + ', the nearest tick is ' + best); break; }
            if (D.pointGapX(n, got) !== x0 + got * P.cw){ fail('GAME pointGapX() is not the tick position'); break; }
          }
        });
        [2, -2, 4, -4].forEach(k => { if (!kinds.has(k)) fail('GAME point: the pool has no question that moves the point ' + Math.abs(k) + ' places ' + (k > 0 ? 'right' : 'left')); });
        if (!(D.GAME_POINT || []).some(it => (it.from === 'm2' && it.to === 'cm2') || (it.from === 'cm2' && it.to === 'm2'))) fail('GAME point: the pool has no m² ↔ cm² question (example 2\'s × 10000)');
        if (!(D.GAME_POINT || []).some(it => /^0\./.test(it.v)) || !(D.GAME_POINT || []).some(it => !/\./.test(it.v) && /0$/.test(it.v))) fail('GAME point: the pool needs a "0.x" number and a whole number ending in 0 (the zeros that come and go)');
        tooSmall('point grip', Math.min(D.GPICK, P.gripH));
        if (P.y + P.h > P.readY - 2 || P.readY + P.readH > P.railY - P.tickH / 2 - 2) fail('GAME point: the reading line runs into the digits or the ticks');
        if (P.railY + P.tickH / 2 > P.knobY - P.gripH / 2 + 2) fail('GAME point: the grip covers the ticks');
        if (P.knobY + P.gripH / 2 > H) fail('GAME point: the grip runs off the board');
        LANGS.forEach(L => { const d = I18N[L]; if (!d.gPointBtns || !d.gPointBtns.ok || !d.gPointAria || !d.gPointAria.left) fail('GAME point: button labels missing in ' + L); say('gPointStill', L, d.gPointStill, []);
          /* 'still' 也會出現在「移了又移回原來的縫」之後：只能說「還在原來的位置」，不可以說「還沒動」（驗證者抓到的） */
          has('gPointStill', L, d.gPointStill, { zh:['還在原來的位置'], en:['still where it started'] }); hasNot('gPointStill', L, d.gPointStill, { zh:['還沒動', '沒有動'], en:['not moved', 'has not', 'hasn\'t'] });
          if (L === 'en' && /◀ ▶/.test(d.gPointBtns && I18N.en.gAsks.point + d.gPointStill)) fail('GAME en: "◀ ▶" can break between the arrows — use a non-breaking space'); });
      }

      /* ===== 第 3 關：倍數分類 ===== */
      {
        const P = D.SORTB, H = D.SORT_H, G = D.GAME_SORT || [];
        const FAC = ['100', '10000', '1000000'];
        if ((D.SORT_F || []).join() !== FAC.join()) fail('GAME sort: the boxes must be × 100, × 10000, × 1000000');
        const keyOf = c => c.from + '>' + c.to;
        if (new Set(G.map(keyOf)).size !== G.length) fail('GAME sort: two cards are the same conversion');
        G.forEach(c => {
          if (!(c.from in UPOW) || !(c.to in UPOW) || UDIM[c.from] !== UDIM[c.to] || UPOW[c.from] <= UPOW[c.to]) fail('GAME sort: ' + keyOf(c) + ' is not "1 big unit = ? small units" of one kind');
          const F = ten(UPOW[c.from] - UPOW[c.to]);
          if (D.sortFactor(c) !== F) fail('GAME sortFactor(' + keyOf(c) + ') = ' + D.sortFactor(c) + ', should be ' + F);
          if (FAC.indexOf(F) < 0) fail('GAME sort: ' + keyOf(c) + ' is × ' + F + ' — there is no such box');
          const kind = UDIM[c.from] === 1 ? 'len' : UDIM[c.from] === 3 ? 'cube' : c.to === 'cm2' ? 'square' : 'ladder';
          if (D.sortKind(c) !== kind) fail('GAME sortKind(' + keyOf(c) + ') = ' + D.sortKind(c) + ', should be ' + kind);
          LANGS.forEach(L => {
            const d = I18N[L];
            const how = D.sortHow(d, c, L);
            if (how !== REF.sortHow(L, c.from, c.to)) fail('GAME sortHow(' + keyOf(c) + ') ' + L + ': "' + how + '" is not "' + REF.sortHow(L, c.from, c.to) + '"');
            FAC.forEach((f, bi) => {
              const why = D.sortWhy(d, c, f, L);
              if (f === F){ if (why !== null) fail('GAME sortWhy(' + keyOf(c) + ', ' + f + ') ' + L + ' refuses the right box'); return; }
              if (typeof why !== 'string'){ fail('GAME sortWhy(' + keyOf(c) + ', ' + f + ') ' + L + ' accepts the wrong box'); return; }
              const r = say('GAME sortWhy ' + keyOf(c) + '→' + f, L, why);
              if (r.verified < 1) fail('GAME sortWhy ' + L + ': "' + why + '" verifies nothing');
              if (why !== REF.sortBad(L, c.from, c.to, F, f)) fail('GAME sortWhy ' + L + ': "' + why + '" is not the canonical sentence "' + REF.sortBad(L, c.from, c.to, F, f) + '"');
            });
            const okT = d.gSortOk(c.from, c.to, F, how);
            say('GAME gSortOk ' + keyOf(c), L, okT);
            if (okT.indexOf('1 ' + U_W[L][c.from] + (L === 'zh' ? ' ＝ ' : ' = ') + F + ' ' + U_W[L][c.to]) !== 0) fail('GAME gSortOk ' + L + ': "' + okT + '" must start with 1 ' + c.from + ' = ' + F + ' ' + c.to);
            const q = d.gSortQ(c.from, c.to), chip = d.gSortChip(c.from, c.to);
            if (!Array.isArray(q) || q.length !== 3 || q[0] !== '1 ' + U_W[L][c.from] || q[2] !== U_W[L][c.to] || !/^[=＝] [?？]$/.test(q[1])) fail('GAME gSortQ ' + L + ': ' + JSON.stringify(q) + ' is not "1 ' + c.from + ' = ? ' + c.to + '"');
            if (!Array.isArray(chip) || chip.length !== 2 || chip[0] !== U_W[L][c.from] || chip[1] !== '→ ' + U_W[L][c.to]) fail('GAME gSortChip ' + L + ': ' + JSON.stringify(chip));
            say('GAME gSort2', L, d.gSort2(q.join(' '), d.gSortBins[FAC.indexOf(F)]));
          });
        });
        FAC.forEach(f => { const k = G.filter(c => ten(UPOW[c.from] - UPOW[c.to]) === f).length; if (k < 2) fail('GAME sort: only ' + k + ' cards are × ' + f + ' — a round needs two'); });
        if (!G.some(c => c.from === 'm' && c.to === 'cm')) fail('GAME sort: no length card (m → cm) — the "length × 100" side of the footer is never played');
        if (!G.some(c => c.from === 'm2' && c.to === 'cm2') || !G.some(c => c.from === 'm3' && c.to === 'cm3')) fail('GAME sort: the m² → cm² and m³ → cm³ cards (examples 2 and 4) must both be in the pool');
        if (!G.some(c => UDIM[c.from] === 2 && c.to !== 'cm2' && ten(UPOW[c.from] - UPOW[c.to]) === '100')) fail('GAME sort: no one-step area ladder card in × 100 (the trap that area is not always × 10000)');
        LANGS.forEach(L => {
          const d = I18N[L];
          if ((d.gSortBins || []).join('|') !== FAC.map(f => '× ' + f).join('|')) fail('GAME gSortBins ' + L + ' must read × 100 | × 10000 | × 1000000');
          say('gSortNow', L, d.gSortNow(3, 6), ['3', '6']);
          say('gSortDone', L, d.gSortDone, ['100', '10000', '1000000', '100']);
          has('gSortDone', L, d.gSortDone, { zh:['公尺換公分 × 100', '平方公尺換平方公分 × 10000', '立方公尺換立方公分 × 1000000'], en:['m to cm is × 100', 'm² to cm² is × 10000', 'm³ to cm³ is × 1000000'] });
          Object.keys(d.gSortHow).forEach(k => say('gSortHow.' + k, L, d.gSortHow[k]));
        });
        for (let i = 0; i < 3000; i++){
          const t = D.sortPick();
          const fs = t.map(c => ten(UPOW[c.from] - UPOW[c.to]));
          if (t.length !== 6 || FAC.some(f => fs.filter(x => x === f).length !== 2) || new Set(t.map(keyOf)).size !== 6){ fail('GAME sortPick(): not two different cards per box: ' + t.map(keyOf)); break; }
          if (fs.every((f, j) => j === 0 || FAC.indexOf(fs[j - 1]) <= FAC.indexOf(f))){ fail('GAME sortPick(): the tray starts in the answer order (' + t.map(keyOf) + ')'); break; }
        }
        const bins = P.x.map(x => ({ x, y:P.y, w:P.w, h:P.h }));
        bins.forEach((b, i) => inside(b, 'sort box ' + i, H));
        noHits(bins, 'sort boxes');
        const tray = [];
        for (let j = 0; j < 6; j++) tray.push(sq(P.trayX[j % 3], P.trayY[Math.floor(j / 3)], P.cardW, P.cardH));
        tray.forEach((c, j) => inside(c, 'sort card ' + j, H));
        noHits(tray.concat(bins), 'sort cards / boxes');
        tray.forEach((c, j) => { if (c.y < P.y + P.h + P.pad) fail('GAME sort: card ' + j + ' sits in a box\'s drop zone'); });
        tooSmall('sort card', Math.min(P.cardW, P.cardH));
        if (P.lblH + 4 > P.chipY[0]) fail('GAME sort: the first placed chip covers the box label');
        P.chipY.forEach((cy, k) => { if (cy + P.chipH > P.h - 2) fail('GAME sort: placed chip ' + k + ' runs out of its box'); if (k && P.chipY[k - 1] + P.chipH > cy) fail('GAME sort: placed chips overlap'); });
        if (P.chipW > P.w - 6) fail('GAME sort: a placed chip is wider than its box');
        sweepZones('sort boxes', bins.map((b, i) => ({ id:i, cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2, done:false })), P.pad, H);
      }

      /* ===== 第 4 關：寫成立方公分 ===== */
      {
        const P = D.WRITE, H = D.WRITE_H, G = D.GAME_WRITE || [];
        if (!G.some(v => /\.\d*0\d/.test(v))) fail('GAME write: no question with a 0 inside its decimals (1.05 → 1050000)');
        if (!G.some(v => /\.\d$/.test(v))) fail('GAME write: no question with one decimal place');
        if (new Set(G).size !== G.length) fail('GAME write: a question appears twice');
        G.forEach(v => {
          if (!/^[1-9](?:\.\d{1,3})?$/.test(v) || /0$/.test(v)) fail('GAME write: "' + v + '" is not 1~9.999 m³ written plainly');
          const want = shiftStr(v, 6).split('').map(Number);
          if (want.length !== 7) fail('GAME write: ' + v + ' m³ is not a 7-digit number of cm³');
          if (D.writeDigits(v).join() !== want.join()) fail('GAME writeDigits(' + v + ') = ' + D.writeDigits(v) + ', should be ' + want);
          const q = v.split('.'), fpart = q[1] || '';
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let i = 0; i < 7; i++) for (let x = 0; x <= 9; x++){
              const why = D.writeWhy(d, v, i, x);
              if (x === want[i]){ if (why !== null) fail('GAME writeWhy(' + v + ', ' + i + ', ' + x + ') refuses the right digit'); continue; }
              if (typeof why !== 'string'){ fail('GAME writeWhy(' + v + ', ' + i + ', ' + x + ') accepts a wrong digit'); continue; }
              const place = d.gPlaces[i];
              if (i === 0){
                const r = say('GAME writeWhy millions', L, why, ['1', '1000000', v, q[0], q[0], String(x)]);
                if (r.verified !== 1) fail('GAME writeWhy millions ' + L + ': "' + why + '" must verify 1 m³ = 1000000 cm³');
                if (String(want[0]) !== q[0]) fail('GAME writeWhy: the millions digit of ' + v + ' is not its whole-number part');
              } else if (i <= fpart.length){
                say('GAME writeWhy decimal', L, why, L === 'zh' ? ['1000000', '6', v, String(i), fpart.charAt(i - 1), fpart.charAt(i - 1), String(x)] : ['1000000', '6', String(i), v, fpart.charAt(i - 1), fpart.charAt(i - 1), String(x)]);
                if (String(want[i]) !== fpart.charAt(i - 1)) fail('GAME writeWhy: decimal digit ' + i + ' of ' + v + ' is not the ' + place + ' digit');
                has('GAME writeWhy decimal', L, why, { zh:[place + '位要寫 ' + want[i]], en:['the ' + place + ' digit is ' + want[i]] });
              } else {
                say('GAME writeWhy zero', L, why, [v, String(fpart.length), '6', '0', String(x)]);
                if (want[i] !== 0) fail('GAME writeWhy: says the ' + place + ' place of ' + v + ' is 0, it is ' + want[i]);
                has('GAME writeWhy zero', L, why, { zh:['補 0'], en:['write 0'] });
              }
            }
            const total = shiftStr(v, 6);
            const rd = say('GAME gWriteDone', L, d.gWriteDone(v, total), [v, v, '1000000', total]);
            if (rd.verified !== 2) fail('GAME gWriteDone ' + L + ': verified ' + rd.verified + ' equations, expected 2');
            say('GAME gWrite2', L, d.gWrite2(v, q[0]), ['2', v, '1000000', '6', q[0], '0']);
            say('GAME gWriteNow', L, d.gWriteNow(v), [v]);
            for (let i = 0; i < 7; i++) say('GAME gWriteOk', L, d.gWriteOk(d.gPlaces[i], want[i]), [String(want[i])]);
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          const expP = L === 'zh' ? ['百萬', '十萬', '萬', '千', '百', '十', '個'] : ['millions', 'hundred-thousands', 'ten-thousands', 'thousands', 'hundreds', 'tens', 'ones'];
          const expL = L === 'zh' ? expP : ['M', 'HTh', 'TTh', 'Th', 'H', 'T', 'O'];
          if ((d.gPlaces || []).join() !== expP.join()) fail('GAME write: gPlaces ' + L + ' must read ' + expP.join());
          if ((d.gPlaceLbl || []).join() !== expL.join()) fail('GAME write: gPlaceLbl ' + L + ' must read ' + expL.join());
          if (d.gWriteUnit !== U_W[L].cm3) fail('GAME write: the unit label ' + L + ' must be ' + U_W[L].cm3);
        });
        const slots = P.slotX.map(x => ({ x, y:P.slotY, w:P.slotW, h:P.slotH }));
        slots.forEach((s, i) => { inside(s, 'write box ' + i, H); inside({ x:s.x, y:P.lblY, w:P.slotW, h:P.lblH }, 'write place label ' + i, H); });
        if (slots.length !== 7) fail('GAME write: ' + slots.length + ' boxes, needs 7');
        const unit = { x:P.unitX, y:P.unitY, w:P.unitW, h:P.unitH };
        inside(unit, 'write unit label', H);
        noHits(slots.concat([unit]), 'write boxes / unit');
        if (P.lblY + P.lblH > P.slotY) fail('GAME write: the place labels run into the boxes');
        if (unit.y < P.slotY + P.slotH + P.pad) fail('GAME write: the unit label sits in a box\'s drop zone');
        const tiles = [];
        for (let x = 0; x <= 9; x++) tiles.push(sq(P.tileX[x % 5], P.tileY[Math.floor(x / 5)], P.tile, P.tile));
        tiles.forEach((c, i) => inside(c, 'write digit card ' + i, H));
        noHits(tiles.concat(slots, [unit]), 'write digit cards / boxes / unit');
        tiles.forEach((c, i) => { if (c.y < P.slotY + P.slotH + P.pad) fail('GAME write: digit card ' + i + ' sits in a box\'s drop zone'); });
        tooSmall('write digit card', P.tile);
        sweepZones('write boxes', P.slotX.map((x, i) => ({ id:i, cx:x + P.slotW / 2, cy:(P.lblY + P.slotY + P.slotH) / 2, hw:P.slotW / 2, hh:(P.slotY + P.slotH - P.lblY) / 2, done:false })), P.pad, H);
        need('write', /cy:\(WRITE\.lblY \+ WRITE\.slotY \+ WRITE\.slotH\) \/ 2, hw:WRITE\.slotW \/ 2, hh:\(WRITE\.slotY \+ WRITE\.slotH - WRITE\.lblY\) \/ 2/, 'the drop zone is not the box plus its place label');
      }

      /* ===== 第 5 關：比大小 ===== */
      {
        const P = D.ORDER, H = D.ORDER_H;
        (D.GAME_ORDERA || []).forEach((set, si) => {
          const m2 = set.map(m2Ref);
          if (set.length !== 4 || new Set(m2).size !== 4) fail('GAME order set ' + si + ': needs four different areas');
          if (set.map(c => c.u).sort().join() !== ['a', 'ha', 'km2', 'm2'].join()) fail('GAME order set ' + si + ': needs one plot in each of m², a, ha, km²');
          set.forEach(c => {
            if (!/^\d+(?:\.\d+)?$/.test(c.v) || /^0\d/.test(c.v) || /\.\d*0$/.test(c.v)) fail('GAME order set ' + si + ': "' + c.v + '" is not a plainly written number');
            if (!(isInt(m2Ref(c)) && m2Ref(c) > 0)) fail('GAME order set ' + si + ': ' + c.v + ' ' + c.u + ' is not a whole number of m²');
            if (D.m2Of(c) !== m2Ref(c)) fail('GAME m2Of(' + c.v + ' ' + c.u + ') = ' + D.m2Of(c) + ', should be ' + m2Ref(c));
          });
          /* 陷阱：只比數字（不換單位）排出來的順序一定不對 */
          const byNum = set.slice().sort((a, b) => Number(a.v) - Number(b.v)).map(m2Ref), byArea = m2.slice().sort((a, b) => a - b);
          if (byNum.join() === byArea.join()) fail('GAME order set ' + si + ': comparing the bare numbers gives the right order — the trap does nothing');
          LANGS.forEach(L => {
            const d = I18N[L];
            set.forEach(c => {
              const card = aRef(c.v, c.u, L);
              if (D.aStr(c.v, c.u, L) !== card) fail('GAME aStr(' + c.v + ', ' + c.u + ', ' + L + ') = "' + D.aStr(c.v, c.u, L) + '", should be "' + card + '"');
              const r = byArea.indexOf(m2Ref(c));
              if (D.orderRank(set, c) !== r) fail('GAME orderRank(' + c.v + ' ' + c.u + ') is not its place among ' + m2);
              for (let i = 0; i < 4; i++){
                const why = D.orderWhy(d, set, c, i, L);
                if (i === r){ if (why !== null) fail('GAME orderWhy(' + c.v + c.u + ', ' + i + ') refuses the right row'); continue; }
                if (typeof why !== 'string'){ fail('GAME orderWhy(' + c.v + c.u + ', ' + i + ') accepts a wrong row'); continue; }
                const rr = say('GAME orderWhy', L, why);
                if (c.u !== 'm2' && rr.verified !== 1) fail('GAME orderWhy ' + L + ': "' + why + '" does not convert to m²');
                const wr = REF.orderBad(L, card, m2Ref(c), c.u === 'm2', r, d.gOrderSlots[r], d.gOrderSlots[i]);
                if (why !== wr) fail('GAME orderWhy ' + L + ': "' + why + '" is not the canonical sentence "' + wr + '"');
              }
              say('GAME gOrderOk', L, d.gOrderOk(card, m2Ref(c), c.u === 'm2', d.gOrderSlots[r]));
              say('GAME gOrder2', L, d.gOrder2(card, m2Ref(c), c.u === 'm2'));
            });
            const w = d.gOrderDone(byArea);
            const rr = say('GAME gOrderDone', L, w, byArea.map(String));
            if (rr.verified !== 3) fail('GAME gOrderDone ' + L + ': "' + w + '" verified ' + rr.verified + ' comparisons, expected 3');
            say('GAME gOrderNow', L, d.gOrderNow(2, 4), ['2', '4']);
          });
          for (let i = 0; i < 3000; i++){
            const t = D.orderTray(set);
            if (t.length !== 4 || t.map(m2Ref).sort((a, b) => a - b).join() !== byArea.join()){ fail('GAME orderTray(): not the set\'s own cards'); break; }
            if (t.every((c, j) => j === 0 || m2Ref(t[j - 1]) <= m2Ref(c))){ fail('GAME orderTray(): the tray starts in the answer order (' + t.map(m2Ref) + ')'); break; }
          }
        });
        LANGS.forEach(L => {
          const exp = L === 'zh' ? ['最小', '第 2 小', '第 3 小', '最大'] : ['Smallest', '2nd', '3rd', 'Largest'];
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
      if (claimCount < 800) fail('GAME: only ' + claimCount + ' equations verified across the lesson — the claim scan is not reading the game sentences');
    },
    /* 靜態字串裡驗過的算式：條數＋指紋（拿掉一條、再補一條別的，條數一樣，指紋不一樣） */
    STATIC_PIN: { n:88, fp:'ceb074c89241' }
  }
};
