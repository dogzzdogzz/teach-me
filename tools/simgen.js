/* 產生器模擬：把 review.html 的「工具 + GENS」切出來，在 Node 裡跑很多批。
   斷言的範圍用「這一課自己的數字範圍」（0~999；問個位數字的那一題 0~9）。 */
const fs = require('fs');
const path = process.argv[2];
const BATCHES = parseInt(process.argv[3] || '30000', 10);
const src = fs.readFileSync(path, 'utf8');

const START = '/* ---------- 工具 ---------- */';
const END = '/* ---------- 出一批';
const i = src.indexOf(START), j = src.indexOf(END);
if (i < 0 || j < 0) throw new Error('cannot locate GENS block');
const code = src.slice(i, j) + '\n; return {GENS:GENS, mixOpts:mixOpts, makeWrongs:makeWrongs, bigMinusSmall:bigMinusSmall};';
const { GENS } = new Function(code)();
console.log('generators:', GENS.map(g => g.id).join(', '));

function digits(n){ return [n%10, Math.floor(n/10)%10, Math.floor(n/100)%10]; }
function needsBorrow(a,b){ const A=digits(a),B=digits(b); return A.some((d,k)=>d<B[k]); }

const problems = [];
const echoHits = {};   // 誘答原字出現在題幹裡 —— 人工判斷用，不直接算失敗
function fail(id, msg){ problems.push(id + ': ' + msg); }

/* 每個產生器自己的不變條件（解釋文字說了什麼，資料就必須真的是那樣）。 */
const INVARIANTS = {
  addNoCarry: d => {
    if (d.oa + d.ob > 9) return 'ones carry but why says no carry';
    if (d.ta + d.tb > 9) return 'tens overflow but why says no carry';
    if (d.a + d.b !== d.correct) return 'correct != a+b';
  },
  addCarryOnes: d => {
    if (d.oa + d.ob < 10) return 'why claims a ones carry but there is none';
    if (d.ta + d.tb + 1 > 9) return 'result is not 2-digit as the why implies';
    if (d.a + d.b !== d.correct) return 'correct != a+b';
  },
  addCarryTens: d => {
    if (d.oa + d.ob > 9) return 'why says the ones do not carry, but they do';
    if (d.ta + d.tb < 10) return 'why says the tens carry, but they do not';
    if (d.ha + d.hb + 1 > 9) return 'sum exceeds 999';
    if (d.a + d.b !== d.correct) return 'correct != a+b';
  },
  subNoBorrow: d => {
    if (needsBorrow(d.a, d.b)) return 'why says no borrowing, but a borrow is needed';
    if (d.a - d.b !== d.correct) return 'correct != a-b';
    if (d.correct <= 0) return 'non-positive result';
  },
  subBorrowOnes: d => {
    if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
    if (d.ta - 1 < d.tb) return 'tens cannot cover after lending';
    if (d.a - d.b !== d.correct) return 'correct != a-b';
    if (d.correct <= 0) return 'non-positive result';
  },
  subBorrowZero: d => {
    if (Math.floor(d.a / 10) % 10 !== 0) return 'why says the tens are 0, but they are not';
    if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
    if (d.ha - 1 < d.hb) return 'hundreds cannot cover after lending';
    if (d.a - d.b !== d.correct) return 'correct != a-b';
    if (d.correct <= 0) return 'non-positive result';
  },
  onesDigit: d => {
    if (d.oa + d.ob < 10) return 'why says the 1 carries, but the ones do not reach ten';
    if ((d.oa + d.ob) % 10 !== d.correct) return 'correct is not the ones digit';
    if (d.a + d.b > 999) return 'sum out of lesson range';
  },
  missingAddend: d => {
    if (d.b + d.correct !== d.sum) return 'b + correct != sum';
    if (d.sum > 999) return 'sum out of lesson range';
  },
  missingMinuend: d => {
    if (d.correct - d.b !== d.c) return 'correct - b != c';
    if (d.correct > 999) return 'minuend out of lesson range';
  },
  wordAdd: d => {
    if (d.oa + d.ob < 10) return 'why says carry 1, but the ones do not reach ten';
    if (d.x + d.y !== d.correct) return 'correct != x+y';
    if (d.correct > 999) return 'sum out of lesson range';
  },
  wordSub: d => {
    if (d.oa >= d.ob) return 'why says the ones need a borrow, but they do not';
    if (d.x - d.y !== d.correct) return 'correct != x-y';
    if (d.correct <= 0) return 'non-positive result';
  }
};

const RANGE = { onesDigit: [0, 9] };

for (let batch = 0; batch < BATCHES; batch++){
  for (const g of GENS){
    const d = g.make([]);
    const inv = INVARIANTS[g.id] ? INVARIANTS[g.id](d) : 'NO INVARIANT DEFINED';
    if (inv) fail(g.id, inv);

    for (const lang of ['zh', 'en']){
      const q = g.fmt(d, lang);
      const [lo, hi] = RANGE[g.id] || [0, 999];

      if (!q.opts || q.opts.length !== 4) fail(g.id, lang + ' option count ' + (q.opts||[]).length);
      if (!(q.ans >= 0 && q.ans < q.opts.length)) fail(g.id, lang + ' ans index out of range');
      if (String(q.opts[q.ans]) !== String(d.correct)) fail(g.id, lang + ' opts[ans] != correct');

      q.opts.forEach(o => {
        const s = String(o);
        if (/[·#]/.test(s)) fail(g.id, lang + ' junk option ' + s);
        if (!/^-?\d+$/.test(s)) fail(g.id, lang + ' non-numeric option ' + s);
        const v = Number(s);
        if (!(v >= lo && v <= hi)) fail(g.id, lang + ' option ' + s + ' outside ' + lo + '~' + hi);
      });

      /* 兩兩比對，不是只比對正解 —— 兩個誘答彼此相等一樣是缺陷。 */
      for (let x = 0; x < q.opts.length; x++){
        for (let y = x + 1; y < q.opts.length; y++){
          if (Number(q.opts[x]) === Number(q.opts[y])){
            fail(g.id, lang + ' duplicate option value ' + q.opts[x]);
          }
        }
      }

      /* 誘答把題幹的數字抄回來？只記錄，人工判斷是不是刻意的迷思誘答。 */
      const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []);
      q.opts.forEach((o, oi) => {
        if (oi === q.ans) return;
        if (stemNums.indexOf(String(o)) >= 0){
          const key = g.id + '/' + lang;
          echoHits[key] = (echoHits[key] || 0) + 1;
          fail(g.id, lang + ' distractor ' + o + ' is copied straight out of the stem');
        }
      });

      if (/undefined|NaN/.test(q.stem + q.why)) fail(g.id, lang + ' undefined/NaN in text: ' + q.why.slice(0, 80));

      /* 解釋若引用了題幹的提示詞（「…」/ “…”），那個提示詞必須真的在題幹裡。
         codex 2026-08-25 抓到：wordAdd 的 why 說「一共」，但 kind=1 的題幹問的是
         「現在有幾元」—— 解釋等於在說一個孩子根本沒看到的線索。 */
      const plain = q.stem.replace(/<[^>]+>/g, ' ');
      const quotes = (q.why.match(/[「“]([^」”]{2,40})[」”]/g) || [])
        .map(x => x.replace(/^[「“]|[」”]$/g, ''));
      quotes.forEach(cue => {
        if (/[\u4e00-\u9fff]/.test(cue)){
          if (plain.indexOf(cue) < 0) fail(g.id, lang + ' why quotes "' + cue + '" but the stem never says it');
        } else {
          const words = cue.toLowerCase().match(/[a-z]{4,}/g) || [];
          const stemLow = plain.toLowerCase();
          words.forEach(w => {
            if (stemLow.indexOf(w) < 0) fail(g.id, lang + ' why quotes "' + cue + '" but the stem lacks "' + w + '"');
          });
        }
      });
    }
  }
}

const uniq = [...new Set(problems)];
console.log('batches:', BATCHES, ' problems:', problems.length, ' unique:', uniq.length);
uniq.slice(0, 40).forEach(p => console.log('  [FAIL]', p));
console.log('stem-echo distractors (manual review):', JSON.stringify(echoHits));
process.exit(uniq.length ? 1 : 0);
