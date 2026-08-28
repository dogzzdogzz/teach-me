/* 驗證 index.html 的靜態資料：三層題庫（通用）＋ 該課自己的範例與遊戲關卡
   （寫在 tools/checks/<grade>-<slug>.js 的 data.check）。

   用法：node tools/verify_lesson_data.js grade-2/math/time/index.html
*/
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target){ console.error('usage: node tools/verify_lesson_data.js <index.html>'); process.exit(2); }
const src = fs.readFileSync(target, 'utf8');

function configFor(p){
  const m = p.replace(/\\/g, '/').match(/grade-(\d)\/math\/([^/]+)\//);
  if (!m) throw new Error('cannot work out the lesson key from ' + p);
  const key = 'grade-' + m[1] + '-' + m[2];
  const file = path.join(__dirname, 'checks', key + '.js');
  if (!fs.existsSync(file)) throw new Error('no check config for this lesson: ' + file);
  return require(file);
}
const CFG = configFor(target).data;

const problems = [];
const fail = m => problems.push(m);

/* --- 1. 語言無關的資料區（不碰 DOM，可以直接執行） --- */
const dStart = src.indexOf(CFG.dataStart);
const dEnd = src.indexOf(CFG.dataEnd);
if (dStart < 0 || dEnd < 0) throw new Error('cannot locate the data block markers');
const dataSrc = src.slice(dStart, dEnd);
const data = new Function(dataSrc + '\n; return ' + CFG.dataReturn + ';')();

/* --- 2. i18n 字典。題幹可能呼叫資料區的小工具（例如 clockSVG），
       所以把資料區一起帶進來一次執行。 --- */
const iStart = src.indexOf('var I18N = {', dEnd);
const iEnd = src.indexOf("var lang = 'zh';", iStart);
if (iStart < 0 || iEnd < 0) throw new Error('cannot locate the I18N literal');
const { I18N } = new Function(dataSrc + src.slice(iStart, iEnd) + '\n; return {I18N};')();

/* --- 3. 三層題庫：通用檢查（所有課都一樣） --- */
const ARITH = /^\s*(\d+)\s*([+−-])\s*(\d+)\s*=\s*\?\s*$/;
['qs','qsAdv','qsBoost'].forEach(bank => {
  const zh = I18N.zh[bank], en = I18N.en[bank];
  if (!zh || !en){ fail(`${bank}: missing in one language`); return; }
  if (zh.length !== en.length) fail(`${bank}: zh/en length mismatch`);
  zh.forEach((q, i) => {
    const e = en[i];
    /* 題數對不上時，這裡直接讀 en[i] 會丟 TypeError，整份報告變成 stack trace，
       真正的錯誤訊息反而看不到。先擋掉，讓上面那筆 length mismatch 好好印出來。 */
    if (!e){ fail(`${bank}[${i}]: missing in en`); return; }
    if (q.ans !== e.ans) fail(`${bank}[${i}]: ans differs zh=${q.ans} en=${e.ans}`);
    [['zh', q], ['en', e]].forEach(([L, item]) => {
      if (item.opts.length !== 4) fail(`${bank}[${i}] ${L}: ${item.opts.length} options`);
      const vals = item.opts.map(o => o.trim());
      if (new Set(vals).size !== vals.length) fail(`${bank}[${i}] ${L}: duplicate option strings`);
      const nums = vals.filter(v => /^\d+$/.test(v)).map(Number);
      if (new Set(nums).size !== nums.length) fail(`${bank}[${i}] ${L}: duplicate option values`);
      if (typeof CFG.optionValueMax === 'number'){
        nums.forEach(n => {
          if (n > CFG.optionValueMax && bank !== 'qs')
            fail(`${bank}[${i}] ${L}: option ${n} above ${CFG.optionValueMax}`);
        });
      }
      const m = ARITH.exec(item.stem);
      if (m){
        const x = Number(m[1]), y = Number(m[3]);
        const want = m[2] === '+' ? x + y : x - y;
        if (Number(vals[item.ans]) !== want)
          fail(`${bank}[${i}] ${L}: stem "${item.stem}" -> ${want}, but marked answer is ${vals[item.ans]}`);
        if (typeof CFG.optionValueMax === 'number' && (want < 0 || want > CFG.optionValueMax))
          fail(`${bank}[${i}] ${L}: answer ${want} out of lesson range`);
      }
      if (/undefined|NaN/.test(item.stem + item.why)) fail(`${bank}[${i}] ${L}: undefined/NaN in text`);
    });
  });
});

/* 正解位置不可以全部押在同一個選項 */
const spread = {};
['qs','qsAdv','qsBoost'].forEach(b => (I18N.zh[b] || []).forEach(q => { spread[q.ans] = (spread[q.ans]||0)+1; }));
console.log('answer-index spread:', JSON.stringify(spread));
if (Object.keys(spread).length < 3) fail('answer index is not spread across options');

/* --- 4. 這一課自己的範例與遊戲關卡 ---
   第四個參數是**整份原始碼**：有些不變式只有在原始碼層才驗得到
   （例如「這句旁白必須是算出來的，不可以寫死成某一筆的索引」）。
   舊的設定檔只宣告三個參數，多傳一個不會影響它們。 */
CFG.check(data, I18N, fail, src);

console.log('problems:', problems.length);
problems.forEach(p => console.log('  [FAIL]', p));
process.exit(problems.length ? 1 : 0);
