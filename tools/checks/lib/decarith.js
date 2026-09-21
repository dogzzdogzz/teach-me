/* tools/checks/lib/decarith.js —— 小數算式的逐條驗算器（2026-09-21 從 grade-6-circle.js 抽出來）
 *
 * ⚠️ 為什麼不用 lib/arith.js：那一份看到小數就直接判失敗（它是給整數課用的）。
 *    教小數的課每一句旁白都是小數算式（`10 × 3.14 ＝ 31.4`、`3.6 ÷ 0.4 ＝ 36 ÷ 4 ＝ 9`），
 *    所以需要一份**精確有理數**的求值器：先切出「算式鏈」，每一節用遞迴下降解析
 *    （× ÷ 先於 ＋ －，左結合），值用分子分母整數比較（3.14 ＝ 314/100）。
 *
 * ⚠️ 它**逐個等號記帳**：任何一個 `＝` 左邊貼著數字卻沒有被某一條鏈吃掉，就報錯 ——
 *    靜靜跳過等於替它背書。已知的 fail-open 只有一個：**左邊不是數字的等號**
 *    （`圓周長 ＝ 直徑 × 3.14` 這種規則表寫法）當散文放行，所以用它的課一律把
 *    算出來的結果寫成「圓周長是 31.4 公分」而不是「圓周長 ＝ 31.4」。
 *
 * ⚠️ 這是全站唯一一份，**要改就改這裡，不要複製回設定檔**（複製一份出去就是下一個 issue #2）。
 *
 * 用法（每一份設定檔各拿自己的一份實例，seen 不會互相污染）：
 *   const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();
 * 每一課還是要自己寫 CLAIM_PROBES（bad:false 必須零誤報、bad:true 一定要抓到），
 * 並且在 data.check 開頭跑完 PROBE 之後把 DEC_SEEN 歸零再數覆蓋率 ——
 * PROBE 自己也會把算式推進 seen。
 */

module.exports = function createDecArith(){
  /* ---------- 6b) 算式逐條驗算：這一課自己的精確有理數（小數）求值器 ---------- */
  function rNorm(x){
    if (!x || !Number.isFinite(x.n) || !Number.isFinite(x.d) || x.d === 0) return null;
    const s = x.d < 0 ? -1 : 1;
    const n = x.n * s, d = x.d * s;
    const g = (function e(a, b){ a = Math.abs(a); while (b){ const t = a % b; a = b; b = t; } return a || 1; })(n, d);
    return { n:n / g, d:d / g };
  }
  function rAdd(a, b){ return (a && b) ? rNorm({ n:a.n * b.d + b.n * a.d, d:a.d * b.d }) : null; }
  function rSub(a, b){ return (a && b) ? rNorm({ n:a.n * b.d - b.n * a.d, d:a.d * b.d }) : null; }
  function rMul(a, b){ return (a && b) ? rNorm({ n:a.n * b.n, d:a.d * b.d }) : null; }
  function rDivR(a, b){ return (a && b && b.n !== 0) ? rNorm({ n:a.n * b.d, d:a.d * b.n }) : null; }
  function rEq(a, b){ return !!(a && b) && a.n * b.d === b.n * a.d; }

  const TERM_SRC = '(?:\\d+(?:\\.\\d+)?|[?？□])';
  const OP_SRC = '[×*÷+＋\\-－−–]';
  const ATOM_SRC = '(?:[()]\\s*)*' + TERM_SRC + '(?:\\s*[()])*';
  /* ⚠️ 收尾的 lookahead 只可以擋「數字還沒讀完」，不可以擋句末的句點：
     `62.8 ÷ 20 ＝ 3.14.` 用 (?![\\d.]) 的話，最後一節讀不完就會回溯成 `62.8 ÷ 20`，
     那個等號整條被丟掉 —— 靜靜不驗。 */
  const CHAIN_RE = new RegExp('(?<!\\d)(?<!\\d\\.)' + ATOM_SRC + '(?:\\s*(?:' + OP_SRC + '|[＝=])\\s*' + ATOM_SRC + ')*(?!\\.?\\d)', 'g');

  function tokensOf(span){
    const toks = [];
    const re = /(\d+(?:\.\d+)?|[?？□]|[×*]|÷|[+＋]|[\-－−–]|[＝=]|[()])/g;
    let m, last = 0;
    while ((m = re.exec(span)) !== null){
      if (span.slice(last, m.index).trim() !== '') return null;
      toks.push(m[0]); last = m.index + m[0].length;
    }
    return span.slice(last).trim() === '' ? toks : null;
  }
  function valueOfTok(t){
    let m = /^(\d+)\.(\d+)$/.exec(t);
    if (m){
      const scale = Math.pow(10, m[2].length);
      return rNorm({ n:Number(m[1]) * scale + Number(m[2]), d:scale });
    }
    m = /^(\d+)$/.exec(t);
    if (m) return { n:Number(m[1]), d:1 };
    return null;
  }
  /* 遞迴下降：expr := term (('+'|'-') term)* ；term := factor (('×'|'÷') factor)* */
  function parseSide(toks){
    let i = 0, err = null;
    function factor(){
      const t = toks[i];
      if (t === undefined){ err = err || 'an operand is missing'; return null; }
      if (t === '('){
        i++;
        const v = expr();
        if (toks[i] !== ')'){ err = err || 'an unclosed bracket'; return null; }
        i++;
        return v;
      }
      i++;
      const v = valueOfTok(t);
      if (v === null) err = err || ('cannot read the operand "' + t + '"');
      return v;
    }
    function term(){
      let v = factor();
      while (i < toks.length && /^[×*÷]$/.test(toks[i])){
        const op = toks[i++]; const r = factor();
        if (op === '÷'){ const q = rDivR(v, r); if (q === null && r && r.n === 0) err = err || 'division by zero'; v = q; }
        else v = rMul(v, r);
      }
      return v;
    }
    function expr(){
      let v = term();
      while (i < toks.length && /^[+＋\-－−–]$/.test(toks[i])){
        const op = toks[i++]; const r = term();
        v = /^[+＋]$/.test(op) ? rAdd(v, r) : rSub(v, r);
      }
      return v;
    }
    const v = expr();
    if (i !== toks.length) err = err || 'the expression did not parse to the end';
    return { v:v, err:err };
  }
  const DEC_SEEN = [];
  function decArith(text){
    const problems = [];
    let verified = 0, questions = 0;
    /* ⚠️ 全形數字要先換成半形，不然 `３.６ ÷ ０.４ ＝ ８` 整條讀不到 —— 那是靜靜放行
       （2026-09-21 codex 抓到）。全形句點與括號同理。 */
    const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48))
      .replace(/．/g, '.');
    const consumed = [];
    const rest = plain.replace(CHAIN_RE, (whole, ...rx) => {
      const at = rx[rx.length - 2], full = rx[rx.length - 1];
      if (!/[＝=]/.test(whole)) return whole;                    /* 沒有等號 → 只是名詞，不是宣稱 */
      let span = whole;
      /* 散文的括號會被一起吃進來：先把**邊緣不成對**的括號剝掉，剝完才是真正的算式。 */
      for (let guard = 0; guard < 8; guard++){
        const opens = (span.match(/\(/g) || []).length, closes = (span.match(/\)/g) || []).length;
        if (opens === closes) break;
        const before = String(full).slice(0, at);
        const proseOpen = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
        if (closes > opens && proseOpen && /\)\s*$/.test(span)) span = span.replace(/\s*\)\s*$/, '');
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
      consumed.push(span.replace(/\s+/g, ' ').trim());
      const sides = span.split(/[＝=]/).map(s => s.trim());
      /* ⚠️ 未知數只讓**貼著它的那一段**變成題目，不是整條鏈：`□ × 3.14 ＝ 31.4 ＝ 99` 裡的
         `31.4 ＝ 99` 是一條實實在在的宣稱，整條跳過等於替它背書（codex 抓到）。 */
      const isQ = sides.map(x => /[?？□]/.test(x));
      const vals = sides.map((x, k) => {
        if (isQ[k]) return { v:null, err:null };
        const tk = tokensOf(x);
        return tk === null ? { v:null, err:'cannot tokenise "' + x + '"' } : parseSide(tk);
      });
      vals.forEach(r => { if (r.err) problems.push(r.err + ' in "' + span + '"'); });
      for (let k = 1; k < vals.length; k++){
        if (isQ[k - 1] || isQ[k]){ questions++; continue; }
        verified++;
        if (!rEq(vals[k - 1].v, vals[k].v)) problems.push('this claim is wrong: "' + span + '"');
      }
      return ' Q ';
    });
    /* 沒有被任何一條鏈吃掉、而且**兩邊都貼著數字**的等號：fail closed。
       ⚠️ 只有一邊是數字的等號當散文放行 —— 規則表就是那樣寫的
          （`圓周長 ＝ 直徑 × 3.14`、`直徑 ＝ 圓周長 ÷ 3.14`）。這是這支驗算器**唯一**的 fail-open，
          四頁因此一律把「算出來的結果」寫成「圓周長是 31.4 公分」而不是「圓周長 ＝ 31.4」。 */
    const leftover = rest.match(/[\d)）]\s*[＝=]\s*[\d(（]/g);
    if (leftover) problems.push('an equals sign with a number on its left was not verified: "' + leftover[0].trim() + '"');
    /* ⚠️ 上面那條只抓「兩邊都是數字」。剩下兩種讀不到的形狀要**直接禁止**，不是跳過：
       ① `圓周長 ＝ 31.5`：左邊是字、右邊是一個光禿禿的數 —— 驗算器算不出左邊是多少，
          所以四頁一律寫成「圓周長是 31.5 公分」。規則表的 `圓周長 ＝ 直徑 × 3.14` 右邊不是光禿禿的數，不受影響。
       ② `10 × × 3.14 ＝ 3.14`：兩個運算子連在一起，鏈會在壞掉的地方斷開，只驗到後面那半截。 */
    /* ⚠️ 括號要一起擋：`圓周長 ＝ (31.4)` 不擋的話一樣繞過去（codex 第二輪抓到）。 */
    /* ⚠️ 收尾不可以放過「右邊是一條算式」的形狀：`商 ＝ 8 + 0` 以前因為後面接運算子而被跳過，
       可是左邊是字，求值器一樣算不出來 —— 那也是靜靜放行（2026-09-21 codex 抓到）。
       只要 ＝ 的右邊**以數字開頭**、左邊是字，就一律禁止；
       `圓周長 ＝ 直徑 × 3.14` 這種規則表寫法右邊不是數字開頭，不受影響。 */
    /* ⚠️ 右括號也要排除：`(3 + 6) ＝ 9` 是一條正當的算式，不是「字 ＝ 數」（2026-09-21 第二輪抓到）。 */
    const wordEq = plain.match(/[^\s\d()（）＝=][ 　]*[＝=][ 　]*[(（]?\d+(?:\.\d+)?/);
    if (wordEq) problems.push('a result is written as "word ＝ number", which cannot be verified: "' + wordEq[0].trim() + '" — write it as 「… 是 …」 instead');
    /* ⚠️ 連兩個運算子要把 ＋ － 也算進去：只擋 × ÷ 的話 `10 × ＋ 3.14 ＝ 3.14` 照樣溜過去，
       後半截還會被當成驗過（codex 第二輪抓到）。 */
    const OPS = '×÷+＋\\-－−–';
    const badOps = plain.match(new RegExp('[' + OPS + '][ 　]*[' + OPS + '＝=]|[＝=][ 　]*[' + OPS + ']'));
    if (badOps) problems.push('a malformed equation: two operators in a row near "' + badOps[0].trim() + '"');
    consumed.forEach(c => DEC_SEEN.push(c));
    return { problems, verified, questions, consumed };
  }

  return { decArith: decArith, seen: DEC_SEEN };
};
