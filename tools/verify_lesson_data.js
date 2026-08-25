/* 驗證 index.html 的靜態資料：範例的逐步計算、遊戲關卡、驗算範例、三層題庫的算術。 */
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'grade-2/math/add-sub/index.html', 'utf8');
const problems = [];
const fail = m => problems.push(m);

/* --- 1. 語言無關的資料區（不碰 DOM，可以直接執行） --- */
const dStart = src.indexOf('/* ---------- 語言無關的資料 ---------- */');
const dEnd = src.indexOf('/* ---------- i18n ---------- */');
const data = new Function(src.slice(dStart, dEnd) +
  '\n; return {ADD_CASES, SUB_CASES, CHECK_CASES, ROUNDS, planAdd, planSub, digitsOf};')();

/* --- 2. i18n 字典（只有字串與純函式） --- */
const iStart = src.indexOf('var I18N = {', dEnd);
const iEnd = src.indexOf("var lang = 'zh';", iStart);
const { I18N } = new Function(src.slice(iStart, iEnd) + '\n; return {I18N};')();

/* --- 範例 1：加法逐步 --- */
data.ADD_CASES.forEach(c => {
  const p = data.planAdd(c.a, c.b);
  if (p.res !== c.a + c.b) fail(`planAdd ${c.a}+${c.b} res=${p.res}`);
  const digits = String(p.res).split('').reverse().map(Number);
  p.steps.forEach(st => {
    if (st.digit !== (digits[st.p] || 0)) fail(`planAdd ${c.a}+${c.b} place ${st.p} digit ${st.digit} != ${digits[st.p]}`);
    if (st.da + st.db + st.cin !== st.sum) fail(`planAdd ${c.a}+${c.b} step sum mismatch`);
    ['zh','en'].forEach(L => {
      const t = I18N[L].addWhy(st, I18N[L].places[st.p], I18N[L].places[st.p+1] || '');
      if (/undefined|NaN/.test(t)) fail(`addWhy ${L} ${c.a}+${c.b}: ${t}`);
    });
  });
  if (p.steps.length !== String(p.res).length && p.steps.length !== Math.max(String(c.a).length, String(c.b).length))
    fail(`planAdd ${c.a}+${c.b} step count ${p.steps.length}`);
});

/* --- 範例 2：減法逐步（含連續退位） --- */
data.SUB_CASES.forEach(c => {
  const p = data.planSub(c.a, c.b);
  if (p.res !== c.a - c.b) fail(`planSub ${c.a}-${c.b} res=${p.res}`);
  if (p.res < 0) fail(`planSub ${c.a}-${c.b} negative`);
  const digits = String(p.res).split('').reverse().map(Number);
  p.steps.forEach(st => {
    if (st.digit !== (digits[st.p] || 0)) fail(`planSub ${c.a}-${c.b} place ${st.p} digit ${st.digit} != ${digits[st.p]}`);
    if (st.digit < 0 || st.digit > 9) fail(`planSub ${c.a}-${c.b} bad digit ${st.digit}`);
    if (st.from !== null && st.da - 10 >= st.db) fail(`planSub ${c.a}-${c.b} borrowed when it did not need to`);
    if (st.from === null && st.da < st.db) fail(`planSub ${c.a}-${c.b} did not borrow when needed`);
    ['zh','en'].forEach(L => {
      const t = I18N[L].subWhy(st, I18N[L].places[st.p], st.from === null ? '' : I18N[L].places[st.from]);
      if (/undefined|NaN/.test(t)) fail(`subWhy ${L} ${c.a}-${c.b}: ${t}`);
    });
  });
});
/* 三個範例必須各自涵蓋：不退位、個位退位、連續退位（十位是 0） */
const kinds = data.SUB_CASES.map(c => {
  const st = data.planSub(c.a, c.b).steps;
  if (st.every(s => s.from === null)) return 'none';
  if (st.some(s => s.across)) return 'across';
  return 'simple';
});
['none','simple','across'].forEach(k => { if (kinds.indexOf(k) < 0) fail('SUB_CASES missing kind ' + k); });

/* --- 範例 3：驗算 --- */
let wrongCount = 0;
data.CHECK_CASES.forEach(c => {
  const back = (c.op === '-') ? c.given + c.b : c.given - c.b;
  const right = (c.op === '-') ? c.a - c.b : c.a + c.b;
  const ok = back === c.a;
  if (!ok) wrongCount++;
  if (ok && c.given !== right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check passes but the given answer is not the right one`);
  if (!ok && c.given === right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check fails but the given answer IS right`);
  if (right < 0 || right > 999) fail(`CHECK ${c.a}${c.op}${c.b} out of lesson range`);
});
if (wrongCount !== 1) fail(`CHECK_CASES should contain exactly one wrong answer, found ${wrongCount}`);

/* --- 遊戲關卡 --- */
data.ROUNDS.forEach((r, i) => {
  const expect = r.op === '+' ? r.a + r.b : r.a - r.b;
  if (expect !== r.res) fail(`ROUND ${i+1}: ${r.a}${r.op}${r.b} != ${r.res}`);
  if (r.res < 0 || r.res > 999) fail(`ROUND ${i+1} out of lesson range`);
  const target = r.row === 'a' ? r.a : r.row === 'b' ? r.b : r.res;
  const digit = data.digitsOf(target)[r.p];
  if (digit !== r.ans) fail(`ROUND ${i+1}: smudged digit of ${target} at place ${r.p} is ${digit}, ans says ${r.ans}`);
  if (String(target).length <= r.p) fail(`ROUND ${i+1}: place ${r.p} is not printed for ${target}`);
  if (r.opts.indexOf(r.ans) < 0) fail(`ROUND ${i+1}: ans not among opts`);
  if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate opts`);
  r.opts.forEach(o => { if (o < 0 || o > 9) fail(`ROUND ${i+1}: option ${o} is not a digit`); });
  ['zh','en'].forEach(L => {
    if (!I18N[L].gHints2[i] || !I18N[L].gWhys[i]) fail(`ROUND ${i+1}: missing ${L} hint/why`);
  });
});
if (data.ROUNDS.map(r => r.opts.indexOf(r.ans)).every(x => x === 0))
  fail('every game round has the answer first');

/* --- 三層題庫：能算的都算一次 --- */
const ARITH = /^\s*(\d+)\s*([+−-])\s*(\d+)\s*=\s*\?\s*$/;
['qs','qsAdv','qsBoost'].forEach(bank => {
  const zh = I18N.zh[bank], en = I18N.en[bank];
  if (zh.length !== en.length) fail(`${bank}: zh/en length mismatch`);
  zh.forEach((q, i) => {
    const e = en[i];
    if (q.ans !== e.ans) fail(`${bank}[${i}]: ans differs zh=${q.ans} en=${e.ans}`);
    [['zh', q], ['en', e]].forEach(([L, item]) => {
      if (item.opts.length !== 4) fail(`${bank}[${i}] ${L}: ${item.opts.length} options`);
      const vals = item.opts.map(o => o.trim());
      if (new Set(vals).size !== vals.length) fail(`${bank}[${i}] ${L}: duplicate option strings`);
      const nums = vals.filter(v => /^\d+$/.test(v)).map(Number);
      if (new Set(nums).size !== nums.length) fail(`${bank}[${i}] ${L}: duplicate option values`);
      nums.forEach(n => { if (n > 999 && bank !== 'qs') fail(`${bank}[${i}] ${L}: option ${n} above 999`); });
      const m = ARITH.exec(item.stem);
      if (m){
        const x = Number(m[1]), y = Number(m[3]);
        const want = m[2] === '+' ? x + y : x - y;
        if (Number(vals[item.ans]) !== want)
          fail(`${bank}[${i}] ${L}: stem "${item.stem}" -> ${want}, but marked answer is ${vals[item.ans]}`);
        if (want < 0 || want > 999) fail(`${bank}[${i}] ${L}: answer ${want} out of lesson range`);
      }
      if (/undefined|NaN/.test(item.stem + item.why)) fail(`${bank}[${i}] ${L}: undefined/NaN in text`);
    });
  });
});

/* 正解位置不可以全部押在同一個選項 */
const spread = {};
['qs','qsAdv','qsBoost'].forEach(b => I18N.zh[b].forEach(q => { spread[q.ans] = (spread[q.ans]||0)+1; }));
console.log('answer-index spread:', JSON.stringify(spread));
if (Object.keys(spread).length < 3) fail('answer index is not spread across options');

console.log('problems:', problems.length);
problems.forEach(p => console.log('  [FAIL]', p));
process.exit(problems.length ? 1 : 0);
