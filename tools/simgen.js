/* 產生器模擬：把 review.html 的「工具 + GENS」切出來，在 Node 裡跑很多批。
   每一課的不變條件、選項形狀與範圍寫在 tools/checks/<grade>-<slug>.js，
   這支腳本只負責「所有課都一樣」的那幾條（選項數、正解對得上、兩兩不等值、
   誘答不抄題幹、解釋引用的提示詞真的在題幹裡）。

   用法：node tools/simgen.js grade-2/math/time/review.html 30000
*/
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const BATCHES = parseInt(process.argv[3] || '30000', 10);
if (!target){ console.error('usage: node tools/simgen.js <review.html> [batches]'); process.exit(2); }
/* 批數不檢查的話，`... review.html 0` 會一批都不跑然後回傳成功 ——
   「檢查全綠」和「檢查沒跑」長得一模一樣。（2026-08-25 codex 審查抓到） */
if (!Number.isInteger(BATCHES) || BATCHES < 1){
  console.error('batches must be a positive integer, got: ' + process.argv[3]); process.exit(2);
}
const src = fs.readFileSync(target, 'utf8');

/* 每一課都要有自己的檢查設定 —— 沒有設定就不算驗過。 */
function configFor(p){
  const m = p.replace(/\\/g, '/').match(/grade-(\d)\/math\/([^/]+)\//);
  if (!m) throw new Error('cannot work out the lesson key from ' + p);
  const key = 'grade-' + m[1] + '-' + m[2];
  const file = path.join(__dirname, 'checks', key + '.js');
  if (!fs.existsSync(file)) throw new Error('no check config for this lesson: ' + file);
  return require(file);
}
const CFG = configFor(target).sim;
const INVARIANTS = CFG.INVARIANTS || {};
const STEM_ECHO_OK = CFG.stemEchoOk || {};
/* 可選：拿到「渲染出來的那一題」再驗一次。INVARIANTS 只看得到資料，
   看不到題幹與解釋 —— 題幹是拼出來的，資料對不代表印出來的字是對的
   （例如連加題印了幾個加項，就必須等於資料說的次數）。 */
const RENDER_CHECK = CFG.renderCheck || null;

/* 可選的固定亂數種子。tools/breaktest.js 會用同一個種子跑「原檔」與「改壞版」，
   這樣「只有改壞版失敗」才真的是改壞造成的，不是抽到不同的參數。 */
if (process.env.SIMGEN_SEED){
  const seed = parseInt(process.env.SIMGEN_SEED, 10);
  if (!Number.isInteger(seed)){ console.error('SIMGEN_SEED must be an integer'); process.exit(2); }
  let a = seed >>> 0;
  Math.random = function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 預設從「工具」那一段開始切。少數課的 fmt() 會用到更前面宣告的文字表
   （grade-2/numbers 的 TXT：題幹要印「百位／十位／個位」），那種課在自己的
   設定檔裡用 blockStart 把起點往前移。起點往前移的區段必須也是不碰 DOM 的，
   不然這裡跑不起來 —— 換句話說，這個選項只允許「純資料」往前擴，不是萬用逃生門。 */
const START = CFG.blockStart || '/* ---------- 工具 ---------- */';
const END = '/* ---------- 出一批';
const i = src.indexOf(START), j = src.indexOf(END);
if (i < 0) throw new Error('cannot locate the block start marker: ' + START);
if (j < 0) throw new Error('cannot locate GENS block');
if (i > j) throw new Error('blockStart appears after the GENS block: ' + START);
const { GENS } = new Function(src.slice(i, j) + '\n; return {GENS:GENS};')();
console.log('generators:', GENS.map(g => g.id).join(', '));

/* 值 + 單位的去重鍵（和 review.html 與 tools/sweep.html 同一套判準）。 */
function vkey(s){
  const t = String(s).replace(/　/g, ' ').replace(/[−–]/g, '-').trim();
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return 'raw:' + t.replace(/\s+/g, '');
  /* 數字部分要正規化成「值」，不是原字：`05 分` 和 `5 分` 是同一個答案，
     字面比對卻會放它們一起進選項。（2026-08-25 codex 審查抓到） */
  return String(Number(m[0])) + '|' + t.slice(m[0].length).replace(/\s+/g, '');
}

/* 畫面上真正看得到的文字：<svg> 整塊拿掉（那是圖不是字），會換行的標籤補一個空白，
   其餘行內標籤直接拿掉不補空白 —— `共<strong>5</strong>個` 畫面上是「共5個」，
   用空白取代標籤就會把黏在一起的字看成分開的。 */
function rendered(html){
  return String(html)
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '');
}

const problems = [];
const echoHits = {};   // 刻意的迷思誘答（設定檔允許的），只記次數供人工複核
function fail(id, msg){ problems.push(id + ': ' + msg); }

for (let batch = 0; batch < BATCHES; batch++){
  for (const g of GENS){
    const d = g.make([]);
    const inv = INVARIANTS[g.id] ? INVARIANTS[g.id](d) : 'NO INVARIANT DEFINED';
    if (inv) fail(g.id, inv);

    for (const lang of ['zh', 'en']){
      const q = g.fmt(d, lang);

      if (!q.opts || q.opts.length !== 4) fail(g.id, lang + ' option count ' + (q.opts||[]).length);
      if (!(q.ans >= 0 && q.ans < q.opts.length)) fail(g.id, lang + ' ans index out of range');
      /* 正解字串要由「設定檔自己的第二套實作」從原始參數重算出來。
         拿產生器自己的格式化函式來比，等於自己比自己：格式化寫錯（把 31 天印成
         「30 天」）時三個檢查會一起錯過。（2026-08-25 codex 審查抓到）
         沒有 expectedCorrect 的課，選項必須就是 String(d.correct)（add-sub 那種純數字）。 */
      const want = CFG.expectedCorrect ? CFG.expectedCorrect(d, g.id, lang) : String(d.correct);
      if (String(q.opts[q.ans]) !== String(want)) fail(g.id, lang + ' opts[ans] != correct (' + q.opts[q.ans] + ' vs ' + want + ')');

      q.opts.forEach((o, oi) => {
        const bad = CFG.optionOk(String(o), g.id, lang, oi === q.ans);
        if (bad) fail(g.id, lang + ' ' + bad);
      });

      /* 兩兩比對，不是只比對正解 —— 兩個誘答彼此相等一樣是缺陷。
         比「值＋單位」的鍵，也比純數字，兩種都要。 */
      for (let x = 0; x < q.opts.length; x++){
        for (let y = x + 1; y < q.opts.length; y++){
          const a = String(q.opts[x]), b = String(q.opts[y]);
          if (vkey(a) === vkey(b)) fail(g.id, lang + ' duplicate option value ' + a);
          else if (/^-?\d+(\.\d+)?$/.test(a) && /^-?\d+(\.\d+)?$/.test(b) && Number(a) === Number(b))
            fail(g.id, lang + ' duplicate numeric option ' + a);
        }
      }

      /* 誘答把題幹的數字抄回來？除非設定檔說那是刻意的迷思誘答。 */
      const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []);
      q.opts.forEach((o, oi) => {
        if (oi === q.ans) return;
        if (stemNums.indexOf(String(o)) >= 0){
          const key = g.id + '/' + lang;
          /* 白名單是「這一個值、這一種情況」的謂詞，不是整個產生器全開 ——
             不然同一個產生器不小心抄回別的數字也會被一起蓋掉。 */
          const allow = STEM_ECHO_OK[g.id];
          const ok = (typeof allow === 'function') ? allow(d, o, lang, oi) : Boolean(allow);
          if (ok) echoHits[key] = (echoHits[key] || 0) + 1;
          else fail(g.id, lang + ' distractor ' + o + ' is copied straight out of the stem');
        }
      });

      if (RENDER_CHECK){
        const r = RENDER_CHECK(d, q, lang, g.id);
        if (r) fail(g.id, lang + ' ' + r);
      }

      if (/undefined|NaN/.test(q.stem + q.why)) fail(g.id, lang + ' undefined/NaN in text: ' + q.why.slice(0, 80));

      /* 標點連兩個。字串是拼出來的，英文的 “7:00 p.m.” 後面再補一個句點就變成
         “p.m..” —— 只有把句子印出來才看得到。（2026-08-25 自驗抓到）
         `(?<!\.)\.\.(?!\.)` 是為了放過三點的刪節號 `...`。選項也要掃。 */
      const shown = rendered(q.stem) + ' ' + rendered(q.why) + ' ' + q.opts.map(rendered).join(' ');
      const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
      if (dbl) fail(g.id, lang + ' doubled punctuation "' + dbl[0] + '" in: ' +
        (q.why.length > 90 ? q.why.slice(0, 90) + '…' : q.why));

      const plain = q.stem.replace(/<[^>]+>/g, ' ');

      /* 中文和數字之間要有空格（全站慣例）。字串是拼出來的，'今天是' + '4 月' 會黏成
         「今天是4 月」—— 資料層全對，只有把句子印出來才看得到。2026-08-25 在 time
         這一課真的發生過三次。 */
      if (lang === 'zh'){
        const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
        if (glued) fail(g.id, lang + ' missing space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
      }

      /* 解釋若引用了題幹的提示詞（「…」/ “…”），那個提示詞必須真的在題幹裡。 */
      const quotes = (q.why.match(/[「“]([^」”]{2,40})[」”]/g) || [])
        .map(x => x.replace(/^[「“]|[」”]$/g, ''));
      quotes.forEach(cue => {
        if (/[一-鿿]/.test(cue)){
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
console.log('stem-echo distractors (allowed by config, manual review):', JSON.stringify(echoHits));
process.exit(uniq.length ? 1 : 0);
