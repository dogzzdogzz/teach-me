/* 解釋裡的算式逐條驗算 —— 全站共用。
   2026-09-02 從 tools/checks/grade-4-chart.js 抽出來，因為同一份實作被複製到各課的
   設定檔之後就會各自長歪：add-sub／time／length／divide／multiply 這五課的設定檔
   **從來沒有讀過 q.why**，所以解釋裡寫錯的算式一路綠燈（issue #2）。
   ⚠️ 這裡是**唯一一份**。要改就改這裡，不要複製回設定檔。

   用法：
     const { makeArith } = require('./lib/arith.js');
     const arithProblems = makeArith({ units:['盒','枝'], unitsEn:['boxes?','pens?'] });
     const r = arithProblems(text);   // { problems:[...], verified:n }

   `units`／`unitsEn` 是這一課會出現的**量詞**。量詞要先換成非數字記號，
   否則「3 盒」的 3 會被當成運算元。各課的量詞不一樣，所以由各課自己給。
*/
/* ---------- 解釋裡的算式逐條驗算 ----------
   「解釋裡有出現那一句正確的話」擋不住**多加一句錯的**，所以每一條算式都要真的算對。
   ⚠️ 這種驗算器最容易 fail open 的三個地方，這裡都堵住了：
     ① 算不出來就跳過 ＝ 替它背書 → 一律回報 cannot parse；
     ② 只抓兩個運算元 → 抓**整條鏈**；
     ③ 減號有三種寫法（－ U+FF0D、- 半形、− U+2212）—— 全部正規化。
   位置詞（第 N 條／第 N 格）與量詞先換成非數字記號，它們不是運算元。 */
function makeNormArith(units, unitsEn){
  /* 量詞用各課自己給的，不要寫死一份共用清單 —— 共用清單漏掉某一課的量詞時，
     那一課的算式會多出一個假的運算元，而且是**靜靜地**多出來。 */
  const UNIT_RE   = units.length   ? new RegExp('(\\d)\\s*(?:' + units.join('|') + ')', 'g') : null;
  const UNIT_EN_RE = unitsEn.length ? new RegExp('(\\d)\\s*(?:' + unitsEn.join('|') + ')\\b', 'gi') : null;
  return function normArith(s){
  let out = String(s)
    .replace(/<[^>]+>/g, '')
    /* ⚠️ 全形數字不正規化的話，`１ ＋ １ ＝ ３` 連一個等號都登記不到，整條靜靜通過。 */
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/[＋]/g, '+')
    .replace(/[－−–—]/g, '-')
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[＝]/g, '=')
    /* ⚠️ 全形括號**不要**折成半形：散文的括號是全形的，折過去之後
       每一條「括號裡的算式」都會變成不成對，整條鏈被丟掉 ＝ 靜靜不驗。 */
    .replace(/第\s*\d+\s*(條|格|項|段|個)/g, ' P ')
    .replace(/grid line\s+\d+\b(?!\s*[+\-*/=])/gi, ' P ')
    .replace(/\b\d+(st|nd|rd|th)\b/gi, ' P ')
    ;
  if (UNIT_RE) out = out.replace(UNIT_RE, '$1 ');
  if (UNIT_EN_RE) out = out.replace(UNIT_EN_RE, '$1 ');
  return out;
  };
}
/* ⚠️ 帶「未知數」的式子**不是宣稱**，是題目：`25 + 34 = ?`、`6 × □ ＝ 18`、
   `268 = 200 + ? + 8`。拿它去驗算一定會判錯（等號有一邊讀不出來）。
   但是**不可以靜靜跳過** —— 靜靜跳過就是替它背書。這裡把它算進 questions，
   呼叫端可以斷言「這一課應該有幾條題目式」，數量不對就會被抓到。 */
const PLACEHOLDER_RE = /[?？□◻＿_○]/;
/* 未知數也可以是**字**，不只是符號：「6 × 幾包 ＝ 18」「6 × how many bags = 18」。
   這種一樣是題目，不是宣稱。
   ⚠️ 只認「緊貼在算式左邊」的那一個字 —— 用寬鬆的視窗去掃會把整段散文裡別處的
   「幾」也算進來，真的寫錯的算式就被它擋掉了。 */
/* 未知數的字後面可以再接一個量詞（「幾**包**」「how many **bags**」），
   所以允許中間夾幾個字 —— 但**不可以夾到數字或等號**，夾到就表示中間還有
   另一條宣稱，那一條不該被這個未知數擋掉。 */
/* ⚠️ 視窗**不可以跨過句子的邊界**，也不可以太寬。夾住標點的話，
   「有幾包。另外 3 ＋ 4 ＝ 8」裡那條真的寫錯的算式會被前一句的「幾」擋掉 ——
   一個字就能關掉整條檢查，而「幾」在中文裡到處都是。
   ⚠️ 所以只認「未知數**就是這條算式的一個運算元**」：未知數和算式之間
   只能隔空白或一個量詞，不能隔任何別的字。 */
/* ⚠️ 中英文的窗口寬度不一樣，不可以合成一條：
   中文的量詞是**一個字**（「幾包」「幾盒」），所以 幾 後面最多再放一個字 ——
   放寬到好幾個字的話，「有幾個朋友來 3 ＋ 4 ＝ 8」裡那條真的寫錯的算式
   會被前面的「幾」擋掉。
   英文的量詞是**一個單字**（「how many bags」），所以要允許一整個詞。 */
const WORD_UNKNOWN_ZH_RE = /(?:幾|多少)[\u4e00-\u9fff]{0,3}\s*$/;
const WORD_UNKNOWN_EN_RE = /(?:how many|how much|what)\s*[A-Za-z]{0,10}\s*$/i;
const WORD_UNKNOWN = s => WORD_UNKNOWN_ZH_RE.test(s) || WORD_UNKNOWN_EN_RE.test(s);
const CHAIN_RE = /[0-9+\-*/=() ]{3,}/g;
/* ⚠️ 這一課只有整數。帶小數點的宣稱（`8 / 4 = 2.5`）會被字元集切成 `8 / 4 = 2`
   而「驗過」—— 所以看到小數就直接判失敗，不要讓它被切一半。
   小數只有在**算式裡**才是問題；散文裡的「2.5 版」不該被擋。 */
const DECIMAL_RE = /[=+\-*/]\s*\d+\.\d|\d+\.\d\s*[=+\-*/]/;
function trimChain(s){
  let t = String(s);
  const count = (x, ch) => x.split(ch).length - 1;
  for (let guard = 0; guard < 40; guard++){
    const before = t;
    t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
    if (count(t, '(') > count(t, ')') && t[0] === '(') t = t.slice(1);
    else if (count(t, ')') > count(t, '(') && t[t.length - 1] === ')') t = t.slice(0, -1);
    if (t === before) break;
  }
  t = t.replace(/^[^0-9(]+/, '').replace(/[^0-9)]+$/, '');
  /* ⚠️ 半形括號在字元集裡，所以英文版的「（6 ＝ 6）」會連著括號被整串切出來
     （`(6 = 6)`）。用等號切開之後兩邊各自都不成對，整條鏈就變成 cannot parse ——
     那是**靜靜不驗**。外層剛好包住整條鏈的那一對要先剝掉。
     只有「剝掉之後裡面仍然成對」時才剝，`(1+2)*(3)` 這種不會被誤剝。 */
  const balanced = x => {
    let dep = 0;
    for (const ch of x){
      if (ch === '(') dep++;
      else if (ch === ')') dep--;
      if (dep < 0) return false;
    }
    return dep === 0;
  };
  for (let guard = 0; guard < 20; guard++){
    if (t.length > 2 && t[0] === '(' && t[t.length - 1] === ')' && balanced(t.slice(1, -1))) t = t.slice(1, -1);
    else break;
  }
  return balanced(t) ? t : '';
}
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
function makeArithProblems(normArith){
  return function arithProblems(text){
  const out = [];
  let verified = 0, questionChains = 0;
  const verifiedList = [];
  const norm = normArith(text);
  /* ⚠️ 千分位逗號不在字元集裡，`1,000 = 0` 會被切成 `000 = 0` 而「驗過」——
     驗到的是另一條算式。這一課的數字都是兩位數以內，看到就直接判失敗。 */
  if (/\d,\d/.test(norm))
    out.push('a number with a thousands separator appears in an arithmetic claim; this lesson never prints one, and the separator would split the equation');
  if (DECIMAL_RE.test(norm))
    out.push('a decimal number appears in an arithmetic claim, but this lesson only uses whole numbers: ' +
             norm.slice(Math.max(0, norm.search(DECIMAL_RE) - 20), norm.search(DECIMAL_RE) + 20));
  /* ⚠️ 等號的數量是「宣稱了幾次相等」。每一條鏈都要對得上一個等號，
     對不上就表示有一條宣稱被字元集丟掉了 —— 那是靜靜不驗，不是通過。 */
  /* ⚠️ 等號旁邊也可能是括號（`(2 + 2) = (5)`）。只數「緊鄰數字」的等號的話，
     這種宣稱 equalsTotal 會是 0，整條就被靜靜丟掉而不是被驗算。 */
  const EQ_RE = /[\d)]\s*=|=\s*[\d(]/g;
  const equalsTotal = (norm.match(EQ_RE) || []).length;
  let equalsSeen = 0;
  /* ⚠️ 用 matchAll 拿**位置**，不是只拿字串。要知道這條鏈的左右鄰居是不是未知數
     （`25 + 34 = ?` 的 `?` 會落在鏈的外面，因為它不在字元集裡），
     只有位置才看得出來。 */
  const chains = [];
  CHAIN_RE.lastIndex = 0;
  for (let mm; (mm = CHAIN_RE.exec(norm)) !== null; ){
    chains.push({ raw: mm[0], at: mm.index });
    if (mm.index === CHAIN_RE.lastIndex) CHAIN_RE.lastIndex++;
  }
  for (const item of chains){
    const raw = item.raw;
    const eqs = (raw.match(EQ_RE) || []).length;
    if (eqs === 0) continue;
    /* ⚠️ 先加再決定跳不跳，等於把「沒驗的」也算成「看過的」——
       equalsSeen === equalsTotal 就會在有宣稱被丟掉的時候仍然成立。
       只有真的走到驗算那一步才登記。 */
    /* 鏈的緊鄰左右若是未知數，這條鏈就是被未知數截斷的**題目**，不是宣稱。
       算進 questions 交給呼叫端斷言數量 —— 不是靜靜跳過。 */
    /* ⚠️ 未知數只有在**它站在運算元的位置上**時才讓這條鏈變成「題目」。
       用「附近有沒有問號／幾」去判斷是行不通的，兩邊都會出事：
         ① 太鬆：「小明算 71 － 28 ＝ 57，對不對？」句尾的問號會把一條**刻意寫錯**
            的算式靜靜放行 —— 那條本來必須靠 wrongOnPurpose 明講才能放行。
         ② 太緊：「幾公分 ＝ 100」的量詞有兩個字，窗口放不下就變成假警報。
       正確的判準是**這條鏈自己的形狀**：鏈的開頭是運算子（表示左運算元被切走了）
       而且緊鄰左邊真的是未知數，才算數；右邊同理。
       鏈以數字開頭、後面跟著一個問號的，那個問號是**標點**，不是運算元。 */
    const trimmedRaw = raw.replace(/^\s+|\s+$/g, '');
    const opensWithOp = /^[=+\-*/]/.test(trimmedRaw);
    const endsWithOp  = /[=+\-*/]$/.test(trimmedRaw);
    const beforeTxt = norm.slice(Math.max(0, item.at - 16), item.at);
    const afterTxt  = norm.slice(item.at + raw.length, item.at + raw.length + 16);
    const unknownLeft  = PLACEHOLDER_RE.test(beforeTxt.slice(-1)) || WORD_UNKNOWN(beforeTxt);
    const unknownRight = PLACEHOLDER_RE.test(afterTxt.slice(0, 1));
    if ((opensWithOp && unknownLeft) || (endsWithOp && unknownRight)){
      questionChains++; equalsSeen += eqs; continue;
    }
    equalsSeen += eqs;
    const chain = trimChain(raw.trim());
    if (!chain || chain.indexOf('=') < 0){
      out.push('cannot parse the equation in "' + raw.trim() + '"');
      continue;
    }
    /* 這一條鏈本身沒有未知數，但整段文字裡有的話，被切掉的很可能就是那個未知數
       （`25 + 34 = ?` 會切成 `25 + 34 =`）。這種要交給外層算成「題目式」，
       不是判它算錯。 */
    /* ⚠️ trimChain 會把懸空的等號一起修掉（`2 = 2 =` → `2 = 2`），那條宣稱就
       靜靜消失了。修剪前後的等號數量必須一樣，少掉就是被丟掉而不是被驗算。 */
    const eqsAfter = (chain.match(EQ_RE) || []).length;
    if (eqsAfter !== eqs){
      out.push('an equals sign was trimmed away from "' + raw.trim() + '" instead of being verified');
      continue;
    }
    /* ⚠️ 不可以把空的一側 filter 掉：`2 == 2` 會變成 ["2","2"] 而「驗過」。
       空的一側就是一條讀不出來的宣稱。 */
    const parts = chain.split('=').map(x => x.trim());
    if (parts.some(x => !x.length)){ out.push('an equals sign with nothing on one side in "' + chain + '"'); continue; }
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
    if (!bad){ verified++; verifiedList.push(chain.replace(/\s+/g, ' ').trim()); }
  }
  if (equalsSeen !== equalsTotal)
    out.push('the text claims ' + equalsTotal + ' equalities but only ' + equalsSeen +
             ' reached the checker — one of them was dropped instead of verified');
  return { problems:out, verified, questionChains, verifiedList };
  };
}

/* 各課的入口。units／unitsEn 預設為空 —— 沒給就是「這一課沒有量詞」，
   不是「用一份猜的清單」。 */
/* 單位換算。`1 公尺 ＝ 100 公分` 是對的，但把單位當量詞剝掉之後會變成 `1 = 100`
   而被判成算錯 —— 這正是 length 那一課的情形。
   ⚠️ 正確做法不是跳過它，是**真的換算**：把每一個「數字＋單位」換成基本單位的量，
   換完再驗。這樣 `1 公尺 ＝ 100 公分` 會變成 `100 = 100`（真的驗過），
   而寫錯成 `1 公尺 ＝ 10 公分` 會被抓到 —— 跳過的話兩種都不會抓到。 */
/* 全形數字要**先**折成半形。單位換算跑在正規化之前，`１ 公尺` 的 `１` 不是
   ASCII 數字，換算的正規式咬不到，那條換算就整條靜靜跳過。 */
function foldDigits(s){
  return String(s).replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
}
function makeConvert(conversions){
  const keys = Object.keys(conversions || {});
  if (!keys.length) return null;
  /* 長的單位名要排前面，否則 `公分` 會先被 `分` 吃掉。 */
  keys.sort((a, b) => b.length - a.length);
  const re = new RegExp('(\\d+)\\s*(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z\\u4e00-\\u9fff])', 'g');
  return s => foldDigits(s).replace(re, (m, n, u) => ' ' + (Number(n) * conversions[u]) + ' ');
}

function makeArith(opts){
  opts = opts || {};
  const norm = makeNormArith(opts.units || [], opts.unitsEn || []);
  const convert = makeConvert(opts.conversions);
  const inner = makeArithProblems(norm);
  /* wrongOnPurpose：這一課**刻意寫錯**的算式（「小明算 71 － 28 ＝ 57，對不對？」）。
     ⚠️ 兩個方向都要卡死：宣告過的錯式子不算問題，但**宣告了卻其實是對的**也要報錯 ——
     否則課文後來改對了，這裡的宣告會變成一個永遠擋著的洞。 */
  const wrong = (opts.wrongOnPurpose || []).map(x => normSpace(x));
  const used = {};
  const seenAll = [];
  function arithProblems(text){
    const src = convert ? convert(text) : text;
    const r = inner(src);
    const problems = [];
    let excused = 0;
    r.problems.forEach(p => {
      const m = p.match(/^arithmetic is wrong: "([^"]+)"/);
      if (m && wrong.indexOf(normSpace(m[1])) >= 0){
        const k = normSpace(m[1]);
        used[k] = (used[k] || 0) + 1;
        excused++;
        return;
      }
      problems.push(p);
    });
    seenAll.push.apply(seenAll, r.verifiedList);
    return { problems, verified:r.verified, questions:r.questionChains, excused, verifiedList:r.verifiedList };
  }
  /* ⚠️ 宣告了卻從來沒對上的「刻意寫錯」是一個**永遠擋著的洞**：課文改對了以後，
     這一筆還在，下次真的寫錯同一條式子時就會被它靜靜放行。
     呼叫端跑完整課之後一定要問一次 unmatched()，非空就是錯。 */
  arithProblems.unmatched = () => wrong.filter(w => !used[w]);
  /* ⚠️ 「刻意寫錯」是**整課通用**的放行，不是只放行原本那一題。同一條錯式子
     後來出現在別的地方也會被一起放行 —— 所以要把「放行了幾次」也釘住，
     多出一次就會被抓到。 */
  arithProblems.excuseCounts = () => {
    const out = {};
    wrong.forEach(w => { out[w] = used[w] || 0; });
    return out;
  };
  /* ⚠️ 只釘「驗過幾條」擋不住「換掉一條、再補一條」：數字一樣，驗的卻是別的宣稱。
     所以把**驗過的每一條算式本身**排序後接起來當指紋。 */
  arithProblems.fingerprint = () => seenAll.slice().sort().join(' | ');
  arithProblems.verifiedAll = () => seenAll.slice().sort();
  return arithProblems;
}

function normSpace(s){ return String(s).replace(/\s+/g, ' ').trim(); }

module.exports = { makeArith };

