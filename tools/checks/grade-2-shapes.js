/* grade-2/math/shapes（邊、頂點與角）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課教的規則：把直的邊接成一圈，**邊有幾條，頂點就有幾個**，每個頂點上有一個角；
   3 條直的邊是三角形，4 條直的邊是四邊形；圓沒有直的邊、沒有頂點、沒有角。
   （「圓有沒有一個邊」各家講法不同，所以全站一律只說「沒有**直的**邊」——
   這個說法在任何講法下都成立。任何一頁都不可以問「圓有幾個邊」。）

   這一課最貴的三個缺陷方向，設定檔要分別擋住：
   1. **規則寫錯**：邊數與頂點數的關係只在「接成一圈」時成立，所以每一個產生器的
      題幹都必須說出「接成一圈」，而不是只給一個數字。這裡用不變條件釘住參數，
      渲染文字由 data.check 逐句比對。
   2. **正方形被排除在四邊形之外**：任何「哪一個是／不是四邊形」的題目，
      四個選項的真假由設定檔自己記一份（BANK_EXPECTED.optsAll），
      改動任何一個選項都必須回來這裡重新宣告一次「我驗過它是假的」。
   3. **圖畫出畫布**：邊數是用眼睛數出來的，圖被切掉就等於答案被改掉。
      所以每一格畫面（lit 0~n、dots 0~n）都要驗右緣與下緣，而且是從 SVG
      真正吐出來的座標重算，不看樣式、不信 data-sides。 */

/* ---------- 設定檔自己的真值表（和課程檔各寫一份，對不上就報錯） ---------- */
/* 名字的「光禿禿」形式。上課頁的籃子按鈕用這一份（按鈕上不寫冠詞），
   review.html 的選項是一個名詞片語，要帶冠詞 —— 由 fName() 補上去。
   兩種形式各只寫一次，不要在兩個地方各抄一份。 */
const NAME_TRUTH = {
  tri:    { zh:'三角形', en:'triangle' },
  quad:   { zh:'四邊形', en:'quadrilateral' },
  circle: { zh:'圓',     en:'circle' },
  square: { zh:'正方形', en:'square' },
  rect:   { zh:'長方形', en:'rectangle' }
};
const nameWord = (k, L) => NAME_TRUTH[k][L];
/* 英文比對一律不分大小寫：句首的 Squares 也算提到了 square。 */
const says = (text, needle, L) => (L === 'en'
  ? String(text).toLowerCase().indexOf(String(needle).toLowerCase())
  : String(text).indexOf(String(needle))) >= 0;
/* 上課頁 FIGS 每一個圖形「應該」有幾條直的邊。圓是 0。
   這一份和 index.html 的座標各自獨立 —— 座標改了、邊數變了，這裡就會對不上。 */
const FIG_SIDES = {
  tri:3, triTilt:3, triThin:3,
  square:4, rect:4, trap:4, diamond:4, wonky:4,
  penta:5, hexa:6,
  circle:0
};

/* 這一課的圖形統一畫在 130 x 130 的方框裡（實際最大座標是 120）。 */
const BOX = 130;
/* 上課頁把每個圖形整體往右下推 OFF 個像素（頂點的圓點半徑 9，有些圖形的最高點在 y = 8，
   不推開就會被上緣切掉）。這裡獨立寫一份 —— 頁面改了位移，渲染座標比對就會報錯。 */
const OFFSET = 6;

/* 「圓有幾個邊」這個問題沒有唯一答案（有的課本說 1 條曲邊，有的說 0 條），
   所以整站任何一頁都不可以問。中文的問法變化多，三種語序都要抓；
   注意錨點一定要從「圓」起算，否則「…邊有幾條頂點就有幾個；圓沒有直的邊」
   這種合法句子會被誤殺。 */
const CIRCLE_SIDE_Q = {
  zh: /圓[^。？！]{0,10}(?:(?:幾|多少)(?:條|個)?(?:直的)?邊|邊[^。？！]{0,8}(?:幾|多少)(?:條|個))/,
  en: /(?:how many|the number of)\s+(?:straight\s+)?sides[^?]{0,24}circle|circle[^?]{0,24}(?:how many|the number of)\s+(?:straight\s+)?sides/i
};
/* 上面那條靠「圓」和「幾條邊」離得夠近。但指涉可以放在問號的另一邊
   （「這個圖形有幾條邊？它是圓。」），那時就沒有任何捕獲 —— 所以再加一條
   「同一個字串裡同時有『數邊的問句』和『它是圓』」的判準，不管前後順序。 */
const SIDE_COUNT_Q = { zh: /(?:幾|多少)(?:條|個)?(?:直的)?邊/, en: /(?:how many|the number of)\s+(?:straight\s+)?sides/i };
const IS_CIRCLE    = { zh: /圓/,                       en: /\bcircle\b/i };
function asksCircleSides(text, lang){
  const t = String(text);
  if (CIRCLE_SIDE_Q[lang].test(t)) return true;
  return SIDE_COUNT_Q[lang].test(t) && IS_CIRCLE[lang].test(t);
}
/* 圓的敘述句不可以「宣稱它有」邊／頂點／角。只擋阿拉伯數字是不夠的：
   「圓有一個頂點」「a circle has one corner」都不含數字，卻是這一課最不能出現的話。 */
/* 數量詞是選配的：「圓有頂點」和 "A circle has corners" 一樣是在教錯的規則。
   否定式（沒有／has no／no）要放行，那正是課程要說的話。 */
const CIRCLE_HAS = {
  zh: /圓[^。！？]{0,12}(?:(?<!沒)有|包含|含有|具有|帶有)\s*(?:[0-9]+|一|二|兩|三|四|五|六|七|八|九|十|幾|很多|許多)?\s*(?:條|個)?\s*(?:直的)?(?:邊|頂點|角)/,
  en: /\bcircle\b[^.!?]{0,24}\b(?:has|have|contains?|includes?|possesses)\b(?!\s+(?:no|neither|none)\b)[^.!?]{0,16}\b(?:sides?|corners?|angles?|vertex|vertices)\b/i
};

/* 渲染後的題幹／解釋必須說出這一課賴以成立的前提。d.text 是 review.html 的 make()
   存下來的「畫面上真正那一份」—— 沒有這個通道，「接成一圈」被刪掉不會有任何檢查響。 */
/* 一定要是**肯定句**。分開比對「直的邊」和「一圈」的話，
   「這些直的邊沒有接成一圈」兩個都命中，前提整個反過來卻全綠（codex 第二輪抓到）。
   所以比對的是一整段連在一起的肯定子句，再另外擋掉附近的否定詞。 */
const LOOP_PHRASE = {
  zh: [/直的邊(?:圍|接)(?:成)?一圈/],
  en: [/straight sides?[^.!?]{0,24}\b(?:in|into)\s+(?:one|a)\s+(?:non-crossing\s+)?loop/i]
};
const LOOP_NEGATED = {
  zh: /(?:沒有|不是|並非|未)[^。！？]{0,6}(?:接成|圍成|圍)一圈/,
  en: /\b(?:not|never|aren't|aren’t|isn't|isn’t|no)\b[^.!?]{0,24}\b(?:in|into)\s+(?:one|a)\s+loop/i
};
/* 哪些產生器的題幹「必須」帶上封閉迴圈的前提：凡是靠「邊數 ＝ 頂點數」或
   「n 條邊就叫某某形」作答的都要，看圖數邊那種不用（圖自己就是前提）。
   nums 是題幹裡一定要出現的參數。 */
const STEM_RULES = {
  countSides:      { loop:false, nums:d => [] },
  countVertices:   { loop:false, nums:d => [] },
  sidesToVertices: { loop:true,  nums:d => [d.n] },
  verticesToSides: { loop:true,  nums:d => [d.n] },
  /* 中文題幹寫「1 個角」（阿拉伯數字），英文寫 "an angle"（沒有數字）——
     所以預期的數字集合要分語言，不能兩邊共用一份。 */
  angleCount:      { loop:false, nums:(d, lang) => lang === 'zh' ? [d.n, 1] : [d.n] },
  nameByCount:     { loop:true,  nums:d => [d.n] },
  noVertex:        { loop:false, nums:d => [] },
  sumSides:        { loop:false, nums:d => [d.a, d.b] },
  strawsToShapes:  { loop:false, nums:d => [d.total, d.s] },
  mustBeQuad:      { loop:false, nums:d => [] },
  sameCountSay:    { loop:true,  nums:d => [d.n] }
};
/* 每個產生器的解釋必須說出「決定這一題答案的那個理由」。少了這一條，
   angleCount 的解釋寫成「每條邊配一個角」也會過 —— 數字剛好一樣，理由卻是錯的。 */
/* 解釋裡「應該出現的數字集合」，全部從 make() 的原始參數重算。
   countSides 的解釋會把 1、2、…、n 數出來，所以整串都算進去。 */
const WHY_NUMS = {
  countSides:      d => Array.from({ length: d.n }, (_, i) => i + 1),
  countVertices:   d => [d.n],
  sidesToVertices: d => [d.n],
  verticesToSides: d => [d.n],
  angleCount:      d => [d.n],
  nameByCount:     d => [d.n],
  noVertex:        d => [],
  sumSides:        d => [3, 4, d.a, d.b, 3 * d.a, 4 * d.b, 3 * d.a + 4 * d.b],
  strawsToShapes:  d => [d.s, d.k, d.total],
  mustBeQuad:      d => [4],
  sameCountSay:    d => [d.n]
};
const WHY_MUST = {
  sidesToVertices: { zh:[/邊[^。]{0,6}頂點/],            en:[/one corner for every side/i] },
  verticesToSides: { zh:[/頂點[^。]{0,6}邊/],            en:[/one side for every corner/i] },
  sameCountSay:    { zh:[/邊有幾條[^。]{0,4}頂點就有幾個/], en:[/one corner for every side/i] },
  angleCount:      { zh:[/一個頂點[^。]{0,4}一個角/],      en:[/one angle for each corner/i] },
  nameByCount:     { zh:[/直的邊/],                      en:[/straight sides/i] },
  countSides:      { zh:[/繞一圈/],                      en:[/all the way round/i] },
  countVertices:   { zh:[/相接又轉彎/],                    en:[/meet and change direction/i] },
  noVertex:        { zh:[/沒有直的邊/],                  en:[/no straight sides/i] },
  sumSides:        { zh:[/三角形 3 條邊/],                en:[/triangle has 3 sides/i] },
  strawsToShapes:  { zh:[/要 \d+ 根吸管/],                en:[/takes \d+ straws/i] },
  mustBeQuad:      { zh:[/4 條直的邊/],                   en:[/4 straight sides/i] }
};
/* 沒有「不共用吸管」這句話，題目就有第二個正確答案：9 根吸管排成邊長 2 的三角網格
   會做出 4 個一樣的小三角形，全部吸管用完 —— 誘答 k＋1 變成真的（codex 第二輪抓到）。 */
const STEM_MUST = {
  strawsToShapes: { zh:[/不共用吸管/], en:[/share no straws/i] }
};
/* 前提被否定掉一樣要響：「不是不共用吸管」「It is false that the shapes share no straws」
   都含有要找的子字串（codex 第三輪抓到）。 */
const STEM_MUST_NEGATED = {
  strawsToShapes: {
    zh: /(?:不是|並非|沒有說)[^。！？]{0,6}不共用吸管/,
    en: /\b(?:false|not true|untrue)\b[^.!?]{0,24}share no straws|\bdo(?:es)?n['’]?t\b[^.!?]{0,16}share no straws/i
  }
};
function textOk(d, genId){
  const rule = STEM_RULES[genId];
  if (!rule) return 'no rendered-stem rule recorded for ' + genId;
  if (!d.text || !d.text.zh || !d.text.en) return 'make() did not cache the rendered text on d';
  for (const lang of ['zh','en']){
    const t = d.text[lang];
    if (!t || typeof t.stem !== 'string' || typeof t.why !== 'string') return lang + ' rendered text is missing';
    const stem = t.stem.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
    const why  = t.why.replace(/<[^>]+>/g, ' ');
    if (rule.loop){
      for (const re of LOOP_PHRASE[lang]){
        if (!re.test(stem)) return lang + ' stem drops the closed-loop premise (' + re + '): ' + stem.trim().slice(0, 56);
        if (!re.test(why))  return lang + ' why drops the closed-loop premise (' + re + '): ' + why.trim().slice(0, 56);
      }
    }
    /* 整組數字要「剛剛好」相等。只驗「有出現」的話，
       「有 5 條直的邊 —— 其實是 6 條」照樣通過（codex 第二輪抓到）。 */
    /* 兩邊都去重再比：同一個數字在題幹裡出現兩次是合法的
       （「1 個三角形和 1 個四邊形」），重複不該被當成差異。 */
    const want = [...new Set(rule.nums(d, lang).map(Number))].sort((x, y) => x - y);
    const got = [...new Set((stem.match(/\d+/g) || []).map(Number))].sort((x, y) => x - y);
    if (want.join(',') !== got.join(',')){
      return lang + ' stem numbers are [' + got.join(',') + '], expected exactly [' + want.join(',') + ']: ' + stem.trim().slice(0, 56);
    }
    if (rule.loop && LOOP_NEGATED[lang].test(stem)){
      return lang + ' stem negates the closed-loop premise: ' + stem.trim().slice(0, 56);
    }
    if (rule.loop && LOOP_NEGATED[lang].test(why)){
      return lang + ' why negates the closed-loop premise: ' + why.trim().slice(0, 56);
    }
    /* C4: 每個產生器的解釋都要說出「決定答案的那個理由」，不是隨便一句對的話。 */
    for (const re of (STEM_MUST[genId] || {})[lang] || []){
      if (!re.test(stem)) return lang + ' stem drops the no-sharing premise (' + re + '): ' + stem.trim().slice(0, 56);
    }
    const smNeg = (STEM_MUST_NEGATED[genId] || {})[lang];
    if (smNeg && smNeg.test(stem)) return lang + ' stem negates the no-sharing premise: ' + stem.trim().slice(0, 56);
    for (const re of (WHY_MUST[genId] || {})[lang] || []){
      if (!re.test(why)) return lang + ' why does not give this question\'s decisive reason (' + re + '): ' + why.trim().slice(0, 56);
    }
    /* 解釋裡的每一個數字都要能從原始參數算出來。只比對片語的話，
       「四邊形有 5 條邊 …… 一共 7 條」照樣通過（codex 第三輪抓到）。 */
    const wantWhy = WHY_NUMS[genId] ? [...new Set(WHY_NUMS[genId](d).map(Number))].sort((x, y) => x - y) : null;
    if (!wantWhy) return 'no why-number rule recorded for ' + genId;
    const gotWhy = [...new Set((why.match(/\d+/g) || []).map(Number))].sort((x, y) => x - y);
    if (wantWhy.join(',') !== gotWhy.join(',')){
      return lang + ' why numbers are [' + gotWhy.join(',') + '], expected exactly [' + wantWhy.join(',') +
             '] recomputed from the raw data: ' + why.trim().slice(0, 56);
    }
    if (asksCircleSides(stem, lang) || asksCircleSides(why, lang)){
      return lang + ' asks how many sides a circle has — that has no unique answer';
    }
    if (CIRCLE_HAS[lang].test(stem) || CIRCLE_HAS[lang].test(why)){
      return lang + ' claims a circle HAS sides/corners/angles';
    }
  }
  return null;
}
/* 包在外面而不是在每個不變條件裡加一行 —— 新增產生器時不會忘記接上。 */
function withTextCheck(map){
  const out = {};
  Object.keys(map).forEach(id => { out[id] = d => map[id](d) || textOk(d, id); });
  return out;
}

function fSide(n, lang){ return lang === 'zh' ? (n + ' 條邊') : (n + (n === 1 ? ' side' : ' sides')); }
function fVert(n, lang){ return lang === 'zh' ? (n + ' 個頂點') : (n + (n === 1 ? ' corner' : ' corners')); }
function fAng(n, lang){ return lang === 'zh' ? (n + ' 個角') : (n + (n === 1 ? ' angle' : ' angles')); }
function fCnt(n, s, lang){
  if (lang === 'zh') return n + ' 個' + (s === 3 ? '三角形' : '四邊形');
  const w = s === 3 ? 'triangle' : 'quadrilateral';
  return n + ' ' + (n === 1 ? w : w + 's');
}
function fName(k, lang){ return lang === 'zh' ? NAME_TRUTH[k].zh : ('a ' + NAME_TRUTH[k].en); }
function fSay(p, n, lang){
  if (lang === 'zh'){
    if (p === 'vert')       return '它有 ' + n + ' 個頂點';
    if (p === 'noVert')     return '它沒有頂點';
    if (p === 'sideShape')  return n + ' 條直的邊圍一圈、不交叉、接點都轉彎的圖形';
    if (p === 'noStraight') return '沒有直的邊的圖形';
    return '?';
  }
  if (p === 'vert')       return 'It has ' + n + (n === 1 ? ' corner' : ' corners');
  if (p === 'noVert')     return 'It has no corners';
  if (p === 'sideShape')  return 'a shape made of ' + n + ' straight sides in one non-crossing loop that turns at every join';
  if (p === 'noStraight') return 'a shape with no straight sides';
  return '?';
}

/* 去重鍵含「單位種類」：「4 條邊」和「4 個頂點」數字一樣，卻是兩個完全不同的答案。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'side' || v.u === 'vert' || v.u === 'ang') return v.u + '#' + v.n;
  if (v.u === 'cnt')  return 'cnt#' + v.s + '#' + v.n;
  if (v.u === 'name') return 'name#' + v.k;
  if (v.u === 'say')  return 'say#' + v.p + '#' + v.n;
  return 'bad';
}
function distinctOpts(d){
  const keys = d.opts.map(keyOf);
  for (let i = 0; i < keys.length; i++){
    if (keys[i] === 'bad') return 'option ' + i + ' is not a value object this lesson knows';
    for (let j = i + 1; j < keys.length; j++){
      if (keys[i] === keys[j]) return 'two options are the same answer: ' + keys[i];
    }
  }
  return null;
}
function answerIs(d, want){
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
function base(d, want){ return distinctOpts(d) || answerIs(d, want); }
/* 一句話對不對，要用「這個圖形有 n 條直的邊、圍成一圈」去判定，不是靠白名單。
   回傳 true／false，遇到設定檔不認得的謂詞回傳 null（那本身就是缺陷）。 */
function sayTruth(v, n){
  if (!v || v.u !== 'say') return null;
  if (v.p === 'vert')       return v.n === n;
  if (v.p === 'noVert')     return false;          /* 圍成一圈一定有頂點 */
  if (v.p === 'sideShape')  return v.n === n;
  if (v.p === 'noStraight') return false;          /* 題幹說了它是直的邊圍成的 */
  return null;
}
/* 「恰好一個選項是真的，而且它就是標記的正解」—— 這是所有是非型選項共用的不變條件。 */
function exactlyOneTrue(d, n){
  let trueCount = 0;
  for (const o of d.opts){
    const t = sayTruth(o, n);
    if (t === null) return 'the checker cannot judge whether option "' + keyOf(o) + '" is true';
    if (t) trueCount++;
    if (t && o !== d.correct) return 'distractor "' + keyOf(o) + '" is also a true sentence';
    if (!t && o === d.correct) return 'the marked answer "' + keyOf(o) + '" is not a true sentence';
  }
  if (trueCount !== 1) return 'exactly one option must be true, found ' + trueCount;
  return null;
}
/* 邊數／頂點數／角數一定是 3 以上的整數 —— 2 條直的邊圍不成一個圖形。
   誘答可以是 2（真的有孩子會少數一條），但題目自己的參數不行。 */
function countOk(n, label){
  if (!Number.isInteger(n)) return label + ' must be a whole number, got ' + n;
  if (!(n >= 3 && n <= 8)) return label + ' must be 3~8 for this lesson, got ' + n;
  return null;
}

/* ---------- review.html 的圖：從 SVG 真正吐出來的座標重算，不信 data-sides ---------- */
/* 兩個相鄰頂點重合、三點共線、或邊自己交叉的話，孩子在畫面上數到的邊數
   就不是 pts.length —— 圖和答案對不上，而只比對「點的個數」抓不到。 */
function segCross(p1, p2, p3, p4){
  const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  const onSeg = (a, b, c) =>   /* c 在線段 ab 上（已知三點共線） */
    Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
  const d1 = side(p3, p4, p1), d2 = side(p3, p4, p2);
  const d3 = side(p1, p2, p3), d4 = side(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  /* 只驗「真正穿過去」會漏掉兩種一樣糟的情況：兩條不相鄰的邊剛好碰到端點，
     以及共線重疊。畫面上都會少掉一條看得出來的邊。 */
  if (d1 === 0 && onSeg(p3, p4, p1)) return true;
  if (d2 === 0 && onSeg(p3, p4, p2)) return true;
  if (d3 === 0 && onSeg(p1, p2, p3)) return true;
  if (d4 === 0 && onSeg(p1, p2, p4)) return true;
  return false;
}
function polyProblem(pts){
  const n = pts.length;
  if (n < 3) return 'a closed shape needs at least 3 corners, got ' + n;
  /* 任何兩個頂點重合都不行，不只是相鄰的那一對：不相鄰的重合會把圖形捏成兩塊。 */
  for (let i = 0; i < n; i++){
    for (let j = i + 1; j < n; j++){
      if (pts[i][0] === pts[j][0] && pts[i][1] === pts[j][1]){
        return 'corners ' + i + ' and ' + j + ' sit on the same spot';
      }
    }
  }
  for (let i = 0; i < n; i++){
    const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
    if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0){
      return 'corners ' + i + ', ' + ((i + 1) % n) + ' and ' + ((i + 2) % n) + ' lie in a straight line, so that corner is not a corner';
    }
  }
  for (let i = 0; i < n; i++){
    for (let j = i + 1; j < n; j++){
      if (j === i + 1) continue;
      if (i === 0 && j === n - 1) continue;
      if (segCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])){
        return 'sides ' + i + ' and ' + j + ' cross each other, so the drawing is not one simple shape';
      }
    }
  }
  return null;
}

function drawingOk(d, wantSides){
  const svg = String(d.svg || '');
  const w = Number((svg.match(/(?:^|\s)width="(\d+)"/) || [])[1]);
  const h = Number((svg.match(/(?:^|\s)height="(\d+)"/) || [])[1]);
  const pm = svg.match(/\bpoints="([^"]+)"/);
  if (!Number.isFinite(w) || !Number.isFinite(h) || !pm) return 'the question has no drawable shape';
  const pairs = pm[1].trim().split(/\s+/).map(s => s.split(',').map(Number));
  if (pairs.some(p => p.length !== 2 || !p.every(Number.isFinite))) return 'the drawing has a broken coordinate';
  if (!Array.isArray(d.pts) || pairs.length !== d.pts.length){
    return 'the drawing has ' + pairs.length + ' points but the data has ' + (d.pts || []).length;
  }
  if (pairs.length !== wantSides){
    return 'the drawing has ' + pairs.length + ' sides but the question is about ' + wantSides;
  }
  /* data-sides 是自己報的數字，所以要和真正數出來的點數比一次。 */
  const ds = Number((svg.match(/data-sides="(\d+)"/) || [])[1]);
  if (ds !== pairs.length) return 'data-sides says ' + ds + ' but the drawing has ' + pairs.length + ' points';
  const bad = polyProblem(pairs);
  if (bad) return bad;
  /* 線寬要從 SVG 自己吐出來的屬性讀，不可以寫死 —— 線一加粗，寫死的一半就量少了。 */
  const swm = svg.match(/<polygon[^>]*stroke-width="(\d+(?:\.\d+)?)"/);
  if (!swm) return 'the polygon does not declare a stroke width, so its painted edge cannot be measured';
  const half = Number(swm[1]) / 2;
  const right = Math.max.apply(null, pairs.map(p => p[0])) + half;
  const bottom = Math.max.apply(null, pairs.map(p => p[1])) + half;
  const left = Math.min.apply(null, pairs.map(p => p[0])) - half;
  const top = Math.min.apply(null, pairs.map(p => p[1])) - half;
  if (!(w >= right + 2)) return 'the canvas is ' + w + 'px wide but the shape draws out to x=' + right;
  if (!(h >= bottom + 2)) return 'the canvas is ' + h + 'px tall but the shape draws out to y=' + bottom;
  if (!(left >= 0 && top >= 0)) return 'the shape is clipped by the left or top edge (x=' + left + ', y=' + top + ')';
  return null;
}

/* 每個產生器的選項可以長什麼樣（單位種類），以及數字的範圍。
   每一條範圍都要寫得出「這個上限是怎麼算出來的」—— 隨手給一個大數等於沒有範圍檢查。 */
const SHAPE = {
  countSides:      ['side'],
  countVertices:   ['vert'],
  sidesToVertices: ['vert'],
  verticesToSides: ['side'],
  angleCount:      ['ang'],
  nameByCount:     ['name'],
  noVertex:        ['name'],
  sumSides:        ['side'],
  strawsToShapes:  ['cnt'],
  mustBeQuad:      ['say'],
  sameCountSay:    ['say']
};
/* 範圍一律從「產生器真正走得到的值」推出來，不是從保底分支推出來。
   這六個產生器的三個主要誘答（n－1、n＋1、n＋2）永遠都合法且互不相同，
   所以 mixOpts 的保底分支一次也不會執行 —— 拿保底的上限當範圍等於放寬了檢查。
   （保底留著是為了將來有人放寬參數池時還有安全網，但範圍不跟著它走。） */
const RANGE = {
  /* 圖形是 3~6 邊，選項是 {n－1, n, n＋1, n＋2} → 2~8。 */
  countSides:      [2, 8],
  countVertices:   [2, 8],
  /* 題目給的邊／頂點數是 3~8，選項是 {n－1, n, n＋1, n＋2} → 2~10。 */
  sidesToVertices: [2, 10],
  verticesToSides: [2, 10],
  angleCount:      [2, 10],
  /* 三角形 1~3 個、四邊形 1~3 個：正解 3a ＋ 4b ＝ 7~21，
     最大的誘答是「全部當四邊形」4(a ＋ b) ＝ 24，或 t ＋ 3 ＝ 24；最小是 t － 2 ＝ 5。 */
  sumSides:        [5, 24],
  /* 做出 2~6 個圖形，選項是 {k－1, k, k＋1, k＋2} → 1~8（保底同樣到不了）。 */
  strawsToShapes:  [1, 8],
  /* 選項裡的數字就是邊數 3、4、5、6。 */
  mustBeQuad:      [3, 6],
  /* 句子裡的數字是頂點數 n ± 1，n 是 3~8。 */
  sameCountSay:    [2, 9]
};
/* 選項一定要有數字的產生器 vs 一定不能有數字的（名字題）。
   兩邊都要寫出來 —— 只寫一邊的話，名字題的範圍檢查會靜靜地整條跳過。 */
const NEEDS_NUM = ['countSides','countVertices','sidesToVertices','verticesToSides',
                   'angleCount','sumSides','strawsToShapes'];
const NO_NUM = ['nameByCount','noVertex'];

const ZH_NAMES = '三角形|四邊形|圓|正方形|長方形';
const EN_SING = ['side','corner','angle','triangle','quadrilateral'];
const EN_PLUR = ['sides','corners','angles','triangles','quadrilaterals'];
const SHAPES = {
  zh: {
    side: /^\d+ 條邊$/,
    vert: /^\d+ 個頂點$/,
    ang:  /^\d+ 個角$/,
    cnt:  /^\d+ 個(?:三角形|四邊形)$/,
    name: new RegExp('^(?:' + ZH_NAMES + ')$'),
    say:  /^(?:它有 \d+ 個頂點|它沒有頂點|\d+ 條直的邊圍一圈、不交叉、接點都轉彎的圖形|沒有直的邊的圖形)$/
  },
  en: {
    side: /^\d+ sides?$/,
    vert: /^\d+ corners?$/,
    ang:  /^\d+ angles?$/,
    cnt:  /^\d+ (?:triangles?|quadrilaterals?)$/,
    name: /^a (?:triangle|quadrilateral|circle|square|rectangle)$/,
    say:  /^(?:It has \d+ corners?|It has no corners|a shape made of \d+ straight sides in one non-crossing loop that turns at every join|a shape with no straight sides)$/
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/shapes */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'two options are the same answer',
      find:'      if (ok(c)){ seen[vkeyOf(c)] = true; out.push(c); }',
      replace:'      if (c){ out.push(c); }' },
    { file:'review', expect:'option count',
      find:'    var i = 0;\n    while (out.length < 3 && i < 60){',
      replace:'    var i = 0;\n    while (out.length < 3 && i < 0){' },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.u === 'side') return lang === 'zh' ? (v.n + ' 條邊') : (v.n + (v.n === 1 ? ' side' : ' sides'));",
      replace:"    if (v.u === 'side') return lang === 'zh' ? (v.n + ' 個頂點') : (v.n + (v.n === 1 ? ' side' : ' sides'));" },
    { file:'review', expect:'plural does not match',
      find:"    if (v.u === 'vert') return lang === 'zh' ? (v.n + ' 個頂點') : (v.n + (v.n === 1 ? ' corner' : ' corners'));",
      replace:"    if (v.u === 'vert') return lang === 'zh' ? (v.n + ' 個頂點') : (v.n + ' corner');" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (v.p === 'sideShape')  return v.n + ' 條直的邊圍一圈、不交叉、接點都轉彎的圖形';",
      replace:"      if (v.p === 'sideShape')  return (v.n + 1) + ' 條直的邊圍一圈、不交叉、接點都轉彎的圖形';" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (lang === 'zh') return s === 3 ? '三角形' : '四邊形';",
      replace:"    if (lang === 'zh') return s === 3 ? '四邊形' : '三角形';" },

    /* --- review.html：圖畫出畫布，或圖跟題目對不上 --- */
    { file:'review', expect:'px wide but the shape draws out to x=',
      find:'    var w = Math.ceil(maxX + STROKE / 2 + PAD), h = Math.ceil(maxY + STROKE / 2 + PAD);\n    return \'<svg data-sides="\'',
      replace:'    var w = Math.ceil(maxX / 2), h = Math.ceil(maxY + STROKE / 2 + PAD);\n    return \'<svg data-sides="\'' },
    { file:'review', expect:'px tall but the shape draws out to y=',
      find:'    var w = Math.ceil(maxX + STROKE / 2 + PAD), h = Math.ceil(maxY + STROKE / 2 + PAD);\n    return \'<svg data-sides="\'',
      replace:'    var w = Math.ceil(maxX + STROKE / 2 + PAD), h = Math.ceil(maxY / 2);\n    return \'<svg data-sides="\'' },
    { file:'review', expect:'data-sides says',
      find:"    return '<svg data-sides=\"' + pts.length + '\" width=\"' + w + '\" height=\"' + h +",
      replace:"    return '<svg data-sides=\"4\" width=\"' + w + '\" height=\"' + h +" },
    { file:'review', expect:'sides but the question is about',
      find:'        var pts = pick(POLYS[n]);\n        var correct = SD(n);',
      replace:'        var pts = pick(POLYS[3]);\n        var correct = SD(n);' },

    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'the answer must be the number of sides drawn',
      find:'        var correct = SD(n);\n        /* 誘答：多數一條、少數一條、把頂點也算進去多算兩條。 */',
      replace:'        var correct = SD(n + 1);\n        /* 誘答：多數一條、少數一條、把頂點也算進去多算兩條。 */' },
    { file:'review', expect:'the answer must be the number of corners drawn',
      find:'        var correct = VX(n);\n        var cands = [ VX(n + 1), VX(n - 1), VX(n + 2) ];\n        var mix = mixOpts(correct, cands, function(i){\n          var alt = [n + 3, n - 2, n + 4, 2];',
      replace:'        var correct = VX(n + 1);\n        var cands = [ VX(n + 1), VX(n - 1), VX(n + 2) ];\n        var mix = mixOpts(correct, cands, function(i){\n          var alt = [n + 3, n - 2, n + 4, 2];' },
    { file:'review', expect:'the answer must have as many corners as the sides given',
      find:'        var correct = VX(n);\n        var cands = [ VX(n + 1), VX(n - 1), VX(n + 2) ];\n        var mix = mixOpts(correct, cands, function(i){\n          var alt = [n + 3, n - 2, 2, 3];',
      replace:'        var correct = VX(n + 1);\n        var cands = [ VX(n + 1), VX(n - 1), VX(n + 2) ];\n        var mix = mixOpts(correct, cands, function(i){\n          var alt = [n + 3, n - 2, 2, 3];' },
    { file:'review', expect:'the answer must have as many sides as the corners given',
      find:'        var correct = SD(n);\n        var cands = [ SD(n - 1), SD(n + 1), SD(n + 2) ];',
      replace:'        var correct = SD(n + 1);\n        var cands = [ SD(n - 1), SD(n + 1), SD(n + 2) ];' },
    { file:'review', expect:'one angle for every corner',
      find:'        var correct = AG(n);',
      replace:'        var correct = AG(n + 1);' },
    { file:'review', expect:'nameByCount only names 3-sided and 4-sided shapes',
      find:'        var n = pickUnused([3,4], used);',
      replace:'        var n = pickUnused([3,4,5], used);' },
    { file:'review', expect:'the name must match the number of sides',
      find:"        var correct = NM(n === 3 ? 'tri' : 'quad');",
      replace:"        var correct = NM(n === 3 ? 'quad' : 'tri');" },
    { file:'review', expect:'every distractor must be a shape that has corners',
      find:"        var others = shuffle(['tri','quad','square','rect']).slice(0, 3);",
      replace:"        var others = shuffle(['tri','quad','square','circle']).slice(0, 3);" },
    { file:'review', expect:'total sides is not 3 for each triangle plus 4 for each quadrilateral',
      find:'        var t = 3 * a + 4 * b;',
      replace:'        var t = 3 * a + 3 * b;' },
    { file:'review', expect:'outside 5~24',
      find:'        return { a:a, b:b, total:t, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'        mix.opts[(mix.ans + 1) % 4] = SD(40);\n        return { a:a, b:b, total:t, correct:correct, opts:mix.opts, ans:mix.ans };' },
    { file:'review', expect:'the straw total is not sides x shapes',
      find:'        var total = s * k;\n        var correct = CT(k, s);',
      replace:'        var total = s + k;\n        var correct = CT(k, s);' },
    { file:'review', expect:'the answer must be how many shapes were made',
      find:'        var cands = [ CT(k + 1, s), CT(k - 1, s), CT(k + 2, s) ];',
      replace:'        var cands = [ CT(k + 1, s), CT(k - 1, s), CT(k + 2, s) ];\n        correct = CT(k + 1, s);' },
    { file:'review', expect:'the certain quadrilateral must be the 4-straight-sides one',
      find:"        var correct = SY('sideShape', 4);",
      replace:"        var correct = SY('sideShape', 3);" },
    { file:'review', expect:'no distractor may itself be a quadrilateral',
      find:"        var pool = [ SY('sideShape', 3), SY('sideShape', 5), SY('sideShape', 6), SY('noStraight') ];",
      replace:"        var pool = [ SY('sideShape', 4), SY('sideShape', 5), SY('sideShape', 6), SY('noStraight') ];" },
    { file:'review', expect:'the true sentence must give the same number as the sides',
      find:"        var correct = SY('vert', n);\n        var opts = shuffle([correct, SY('vert', n + 1), SY('vert', n - 1), SY('noVert')]);",
      replace:"        var correct = SY('vert', n + 1);\n        var opts = shuffle([correct, SY('vert', n + 1), SY('vert', n - 1), SY('noVert')]);" },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? ('直的邊接成一圈時，邊有幾條，頂點就有幾個：' + d.n + ' 條邊就有 ' + d.n + ' 個頂點。')",
      replace:"            ? ('直的邊接成一圈時，邊有幾條，頂點就有幾個：' + d.n + ' 條邊就有' + d.n + ' 個頂點。')" },
    { file:'review', expect:'doubled punctuation',
      find:"            : ('One angle for each corner: ' + d.n + ' corners means ' + d.n + ' angles.')",
      replace:"            : ('One angle for each corner: ' + d.n + ' corners means ' + d.n + ' angles..')" },

    /* --- index.html：圖形資料 --- */
    { file:'index', expect:'the checker expects 4 straight sides',
      find:'    square:  { kind:\'quad\',   pts:[[18,18],[106,18],[106,106],[18,106]] },',
      replace:'    square:  { kind:\'quad\',   pts:[[18,18],[106,18],[18,106]] },' },
    /* 座標爆掉時畫布只會跟著變大，寬度檢查抓不到 —— 只有方框上限抓得到。 */
    { file:'index', expect:'outside the 130 x 130 drawing box',
      find:'    tri:     { kind:\'tri\',    pts:[[62,12],[116,104],[8,104]] },',
      replace:'    tri:     { kind:\'tri\',    pts:[[62,12],[400,104],[8,104]] },' },
    /* 留白拿掉之後，頂點的圓點（r ＝ 9）就會被切掉 —— 只驗多邊形座標抓不到。 */
    { file:'index', expect:'draws out to x=',
      find:'  var STROKE = 5, PAD = 20, OFF = 6;',
      replace:'  var STROKE = 5, PAD = 0, OFF = 6;' },
    /* 只驗頭尾兩格的話，中間那一格被切掉不會有人發現。 */
    { file:'index', expect:'draws out to x=',
      find:"    var w = Math.ceil(maxX + PAD), h = Math.ceil(maxY + PAD);",
      replace:"    var w = (verts === 4 && sides === 4) ? 40 : Math.ceil(maxX + PAD), h = Math.ceil(maxY + PAD);" },
    { file:'index', expect:'draws out to x=',
      find:"      body += '<circle cx=\"' + p[i][0] + '\" cy=\"' + p[i][1] + '\" r=\"9\" fill=\"#8A5A2B\"/>';",
      replace:"      body += '<circle cx=\"' + p[i][0] + '\" cy=\"' + p[i][1] + '\" r=\"40\" fill=\"#8A5A2B\"/>';" },
    { file:'index', expect:'STRAW_STEPS must be 3, 4, 5, 6',
      find:'  var STRAW_STEPS = [3, 4, 5, 6];',
      replace:'  var STRAW_STEPS = [4, 5, 6, 7];' },
    { file:'index', expect:'the circle row must record 0 straight sides',
      find:"    { key:'circle', sides:0, figs:['circle'] }",
      replace:"    { key:'circle', sides:1, figs:['circle'] }" },
    { file:'index', expect:'has 3 sides but the row is for 4',
      find:"    { key:'quad',   sides:4, figs:['square','rect','trap','wonky'] },",
      replace:"    { key:'quad',   sides:4, figs:['square','rect','trap','tri'] }," },
    { file:'index', expect:'ROUNDS must cover all three baskets',
      find:"    { fig:'circle' },",
      replace:"    { fig:'trap' }," },
    { file:'index', expect:'has no basket in this game',
      find:"    { fig:'diamond' },",
      replace:"    { fig:'penta' }," },
    { file:'index', expect:'SIDE_FIGS needs a 3-sided and a 4-sided figure',
      find:"  var SIDE_FIGS = ['tri', 'square', 'trap', 'penta'];",
      replace:"  var SIDE_FIGS = ['square', 'trap', 'wonky', 'penta'];" },
    { file:'index', expect:'the checker expects',
      find:"      names:{ tri:'三角形', quad:'四邊形', circle:'圓' },",
      replace:"      names:{ tri:'三角型', quad:'四邊形', circle:'圓' }," },
    /* 字典整個不見時要乾淨地報出來，不可以丟 TypeError 把報告蓋掉。 */
    { file:'index', expect:'zh has no names dictionary',
      find:"      /* 圖形的名字。索引和資料區的 FIGS 用 id 對齊。 */\n      names:{ tri:'三角形',",
      replace:"      /* 圖形的名字。索引和資料區的 FIGS 用 id 對齊。 */\n      namez:{ tri:'三角形'," },
    /* 幾何解析器要為畫面上每一個元素負責。把自閉合標籤改寫成成對標籤時，
       那些線就整批從寬度計算裡消失 —— 沒有這一條的話檢查會靜靜地保持綠色。 */
    { file:'index', expect:'the rest are unmeasured',
      find:"'\" font-size=\"15\" text-anchor=\"middle\" ' +\n              'fill=\"#E8871E\" font-weight=\"800\">' + (i + 1) + '</text>';",
      replace:"'\" font-size=\"15\" text-anchor=\"middle\" ' +\n              'fill=\"#E8871E\" font-weight=\"800\">' + (i + 1) + '</tspan>';" },

    /* --- index.html：範例的文字說了什麼 --- */
    { file:'index', expect:'never states the corner count',
      find:"               '<span class=\"bigans\">' + n + ' 條邊、' + n + ' 個頂點</span>，一樣多。' +",
      replace:"               '<span class=\"bigans\">' + n + ' 條邊</span>。' +" },
    { file:'index', expect:'never links the corner count back to the sides',
      find:"               '每個頂點上都張開一個角，所以也有 ' + n + ' 個角。<br>邊 ' + n + ' 條、頂點 ' + n +\n               ' 個 —— 一樣多。';",
      replace:"               '每個頂點上都張開一個角，所以也有 ' + n + ' 個角。';" },
    { file:'index', expect:'the circle line must say it has no straight sides',
      find:"        if (key === 'circle') return '圓是彎彎的一圈，<strong>沒有直的邊</strong>。';",
      replace:"        if (key === 'circle') return '圓是彎彎的一圈。';" },
    { file:'index', expect:'the circle line must say it has no corners and no angles',
      find:"        if (key === 'circle') return '圓<strong>沒有頂點</strong>，也<strong>沒有角</strong>。';",
      replace:"        if (key === 'circle') return '圓有 1 個頂點。';" },
    { file:'index', expect:'must say, in these exact words',
      find:"        return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>4 條這樣的邊，就叫<strong>四邊形</strong>。正方形、長方形、梯形都是四邊形。';",
      replace:"        return '4 條直的邊圍一圈、不交叉，就叫<strong>四邊形</strong>。';" },
    { file:'index', expect:'gWhy for the circle must not count straight sides',
      find:"        if (sides === 0) return '它沒有直的邊，也沒有頂點。不是三角形，也不是四邊形 —— 它是圓。';",
      replace:"        if (sides === 0) return '它有 0 條直的邊，所以是圓。';" },
    { file:'index', expect:'gHint2 never gives the side count',
      find:"        return '提示：它有 ' + sides + ' 條直的邊、' + sides + ' 個頂點。';",
      replace:"        return '提示：仔細看一看。';" },

    /* --- index.html：三層題庫 --- */
    { file:'index', expect:'marked answer is',
      find:"          opts:['3 條邊','4 條邊','5 條邊','6 條邊'], ans:2,",
      replace:"          opts:['3 條邊','4 條邊','5 條邊','6 條邊'], ans:1," },
    { file:'index', expect:'the option list does not match the checker',
      find:"          opts:['三角形','圓','正方形','長方形'], ans:1,",
      replace:"          opts:['三角形','圓','正方形','梯形'], ans:1," },
    { file:'index', expect:'the number 5 never appears in the stem',
      find:"        { stem:'一個圖形用直的邊接成一圈，有 5 個頂點。<br>它有幾條直的邊？',",
      replace:"        { stem:'一個圖形用直的邊接成一圈，有 6 個頂點。<br>它有幾條直的邊？'," },
    { file:'index', expect:'unexpected number',
      find:"        { stem:'三角形有幾條邊、幾個頂點？',",
      replace:"        { stem:'三角形有幾條邊、幾個頂點？（提示：少於 9 條）'," },
    { file:'index', expect:'questions but 6 expected',
      find:"        { stem:'Which sentence is true?',\n          opts:['A triangle has 4 corners','A circle has 3 corners','A quadrilateral has 3 sides','A square is a quadrilateral'], ans:3,\n          why:'A square has 4 straight sides and 4 corners, so it belongs to the quadrilateral family.' }\n      ],",
      replace:"      ]," },
    /* --- codex 審查之後補的斷言，每一條都要有自己的改壞版本 --- */
    /* 位移拿掉之後，最高的那顆頂點圓點（r ＝ 9，圖形最高點 y ＝ 8）會被上緣切掉。 */
    { file:'index', expect:'clipped by the top edge',
      find:'  var STROKE = 5, PAD = 20, OFF = 6;',
      replace:'  var STROKE = 5, PAD = 20, OFF = 0;' },
    /* 兩個頂點重合：畫出來少一條邊，數出來卻還是 3。 */
    { file:'index', expect:'sit on the same spot',
      find:"    tri:     { kind:'tri',    pts:[[62,12],[116,104],[8,104]] },",
      replace:"    tri:     { kind:'tri',    pts:[[62,12],[62,12],[8,104]] }," },
    /* 三點共線：畫出來看起來是一條邊，資料卻說有兩條。 */
    { file:'index', expect:'lie in a straight line',
      find:"    square:  { kind:'quad',   pts:[[18,18],[106,18],[106,106],[18,106]] },",
      replace:"    square:  { kind:'quad',   pts:[[18,18],[62,18],[106,18],[18,106]] }," },
    /* 邊自己交叉（蝴蝶結）：孩子數到的邊數和頂點數都不是 4。 */
    { file:'index', expect:'cross each other',
      find:"    wonky:   { kind:'quad',   pts:[[30,10],[118,34],[96,112],[10,88]] },",
      replace:"    wonky:   { kind:'quad',   pts:[[30,10],[96,112],[118,34],[10,88]] }," },
    /* 字典多一個沒有人顯示、也沒有人驗的名字。 */
    /* --- 第五輪（codex 第三輪審查）之後補的斷言 --- */
    /* pages#1：頂點的定義退回成「兩條邊碰在一起」，和速查卡的 sw5 自相矛盾。 */
    { file:'review', expect:'decisive reason',
      find:"('兩段直線相接又轉彎的地方就是頂點，繞一圈數到 ' + d.n + ' 個。它有 ' + d.n + ' 條邊，所以也有 ' + d.n + ' 個頂點。')",
      replace:"('兩條邊碰在一起的地方就是頂點，繞一圈數到 ' + d.n + ' 個。它有 ' + d.n + ' 條邊，所以也有 ' + d.n + ' 個頂點。')" },
    /* C1：定義句只說「不交叉、每個接點都轉彎」，一條開放的折線也滿足。 */
    { file:'index', expect:'never says the sides form a closed loop',
      find:"        if (key === 'tri') return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';",
      replace:"        if (key === 'tri') return '直的邊不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';" },
    /* C1b：把「圍一圈」否定掉。 */
    { file:'index', expect:'negates the closed-loop clause',
      find:"        if (key === 'tri') return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';",
      replace:"        if (key === 'tri') return '直的邊沒有圍成一圈、不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';" },
    /* C2：前提被否定掉（中英各一筆）。 */
    { file:'review', expect:'stem negates the no-sharing premise',
      find:"<br>每個圖形都分開做，不共用吸管。<br>可以做幾個",
      replace:"<br>不是不共用吸管。<br>可以做幾個" },
    { file:'review', expect:'stem negates the no-sharing premise',
      find:"<br>The shapes are separate and share no straws.<br>How many ",
      replace:"<br>It is false that the shapes share no straws.<br>How many " },
    /* C3：解釋裡的數量和原始資料對不上（四邊形寫成 5 條邊）。 */
    { file:'review', expect:'why numbers are',
      find:"            ? ('一個三角形 3 條邊、一個四邊形 4 條邊：3 × ' + d.a + ' ＝ ' + (3 * d.a) + '，4 × ' + d.b +",
      replace:"            ? ('一個三角形 3 條邊、一個四邊形 5 條邊：3 × ' + d.a + ' ＝ ' + (3 * d.a) + '，4 × ' + d.b +" },
    /* C4：原始資料合法，渲染卻把同一個點吐兩次 —— 孩子只看得到兩條邊。 */
    { file:'index', expect:'as rendered',
      find:"    for (i = 0; i < n; i++) pstr.push(p[i][0] + ',' + p[i][1]);",
      replace:"    for (i = 0; i < n; i++) pstr.push(p[0][0] + ',' + p[0][1]);" },
    /* C4b：吐出壞掉的座標，原本會被默默跳過。 */
    { file:'index', expect:'invalid point token',
      find:"    var pstr = [];",
      replace:"    var pstr = ['x,y'];" },
    /* C5：改用 style 上色 —— 屬性讀不到線寬，量成 0。 */
    { file:'index', expect:'carries style/class',
      find:"'\" fill=\"#FDF0E0\" stroke=\"#E8871E\" stroke-width=\"' + STROKE + '\"/>';",
      replace:"'\" fill=\"#FDF0E0\" style=\"stroke:#E8871E;stroke-width:20px\"/>';" },
    /* C6：換一個動詞（包含／contains）宣稱圓有頂點。 */
    { file:'index', expect:'asserts that a circle HAS',
      find:"        if (key === 'circle') return '圓<strong>沒有頂點</strong>，也<strong>沒有角</strong>。';",
      replace:"        if (key === 'circle') return '圓<strong>沒有頂點</strong>，也<strong>沒有角</strong>。圓包含一個頂點。';" },
    { file:'index', expect:'asserts that a circle HAS',
      find:"        if (key === 'circle') return 'A circle has <strong>no corners</strong> and <strong>no angles</strong>.';",
      replace:"        if (key === 'circle') return 'A circle has <strong>no corners</strong> and <strong>no angles</strong>. A circle contains one corner.';" },
    /* C7：縮寫與別的否定動詞。 */
    { file:'index', expect:'denies its own claim',
      find:"        return 'Every one of them has <span class=\"bigans\">' + sides + ' straight sides</span>, however long or short they are.';",
      replace:"        return 'They don’t have <span class=\"bigans\">' + sides + ' straight sides</span>, however long or short they are.';" },
    { file:'index', expect:'denies its own claim',
      find:"        return '每一個都有 <span class=\"bigans\">' + sides + ' 條直的邊</span>，長短不一樣沒關係。';",
      replace:"        return '每一個都不具有 <span class=\"bigans\">' + sides + ' 條直的邊</span>，長短不一樣沒關係。';" },

    /* --- 第四輪（codex 第二輪審查）之後補的斷言 --- */
    /* C2：前提被否定掉。分開比對「直的邊」和「一圈」的話兩個都命中，全綠。 */
    { file:'review', expect:'stem drops the closed-loop premise',
      find:"            ? ('一個圖形用直的邊接成一圈，一共有 ' + d.n + ' 個頂點。<br>它有幾條直的邊？')",
      replace:"            ? ('一個圖形的這些直的邊沒有接成一圈，一共有 ' + d.n + ' 個頂點。<br>它有幾條直的邊？')" },
    /* C3：題幹多一個數字，原本的「有出現就好」放行。 */
    { file:'review', expect:'stem numbers are',
      find:"            ? ('一個圖形用直的邊接成一圈，一共有 ' + d.n + ' 條邊。<br>它有幾個頂點？')",
      replace:"            ? ('一個圖形用直的邊接成一圈，一共有 ' + d.n + ' 條邊（其實是 ' + (d.n + 1) + ' 條）。<br>它有幾個頂點？')" },
    /* C4：解釋換成「數字剛好對、理由是錯的」那一種。 */
    { file:'review', expect:'decisive reason',
      find:"            ? ('一個頂點配一個角：' + d.n + ' 個頂點就有 ' + d.n + ' 個角。')",
      replace:"            ? ('一條邊配一個角：' + d.n + ' 條邊就有 ' + d.n + ' 個角。')" },
    /* C5：換成「多少」與 "the number of sides" 的問法。 */
    { file:'index', expect:'asks how many sides a circle has',
      find:"      gAsk:'這個圖形要放進哪一個籃子？',",
      replace:"      gAsk:'圓有多少條邊？'," },
    { file:'index', expect:'asks how many sides a circle has',
      find:"      gAsk:'Which basket does this shape belong in?',",
      replace:"      gAsk:'What is the number of sides on a circle?'," },
    /* C6：不帶數量詞的錯誤宣稱。 */
    { file:'index', expect:'asserts that a circle HAS',
      find:"        if (key === 'circle') return '圓是彎彎的一圈，<strong>沒有直的邊</strong>。';",
      replace:"        if (key === 'circle') return '圓是彎彎的一圈，<strong>沒有直的邊</strong>。圓有頂點。';" },
    { file:'index', expect:'asserts that a circle HAS',
      find:"        if (key === 'circle') return 'A circle has <strong>no corners</strong> and <strong>no angles</strong>.';",
      replace:"        if (key === 'circle') return 'A circle has <strong>no corners</strong> and <strong>no angles</strong>. A circle has corners.';" },
    /* C7：把自己的主張否定掉，字串卻還在。 */
    { file:'index', expect:'denies its own claim',
      find:"        return '每一個都有 <span class=\"bigans\">' + sides + ' 條直的邊</span>，長短不一樣沒關係。';",
      replace:"        return '每一個都沒有 <span class=\"bigans\">' + sides + ' 條直的邊</span>，長短不一樣沒關係。';" },
    /* C8：三個選項序列化成和四個選項一樣的字串。 */
    { file:'index', expect:'options but the checker records',
      find:"          opts:['3 條邊','4 條邊','5 條邊','6 條邊'], ans:2,",
      replace:"          opts:['3 條邊 | 4 條邊','5 條邊','6 條邊'], ans:2," },
    /* C9：圓跑出方框。畫布跟著長大，canvasOk 抓不到。 */
    { file:'index', expect:'outside the 130 x 130 drawing box',
      find:"    circle:  { kind:'circle', cx:64, cy:64, r:56 }",
      replace:"    circle:  { kind:'circle', cx:400, cy:64, r:56 }" },
    /* C10：少一個座標的 <line> 仍然被算成「量到了」。 */
    { file:'index', expect:'cannot be measured',
      find:"      body += '<line x1=\"' + a[0] + '\" y1=\"' + a[1] + '\" x2=\"' + b[0] + '\" y2=\"' + b[1] +\n              '\" stroke=\"#E8871E\" stroke-width=\"9\" stroke-linecap=\"round\"/>';",
      replace:"      body += '<line x1=\"' + a[0] + '\" y1=\"' + a[1] + '\" y2=\"' + b[1] +\n              '\" stroke=\"#E8871E\" stroke-width=\"9\" stroke-linecap=\"round\"/>';" },
    /* C11：籃子清單長度不對時要乾淨地停下來，不可以丟 TypeError。 */
    { file:'index', expect:'BASKETS should be tri, quad, circle',
      find:"  var BASKETS = ['tri', 'quad', 'circle'];",
      replace:"  var BASKETS = ['tri', 'quad'];" },
    /* G1：拿掉「不共用吸管」，9 根吸管排成三角網格真的做得出 4 個三角形。 */
    { file:'review', expect:'stem drops the no-sharing premise',
      find:"<br>每個圖形都分開做，不共用吸管。<br>可以做幾個",
      replace:"<br>可以做幾個" },
    /* 頁面：定義句少了「每個接點都轉彎」。 */
    { file:'index', expect:'must state that every join turns',
      find:"        if (key === 'tri') return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';",
      replace:"        if (key === 'tri') return '直的邊圍一圈、不交叉。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';" },

    /* --- 第三輪 codex 審查之後補的斷言 --- */
    /* 題幹拿掉「接成一圈」：規則就變成對開放折線也成立，而舊版只看 d.n，全綠。 */
    { file:'review', expect:'stem drops the closed-loop premise',
      find:"            ? ('一個圖形用直的邊接成一圈，一共有 ' + d.n + ' 條邊。<br>它有幾個頂點？')",
      replace:"            ? ('一個圖形有 ' + d.n + ' 條直的邊。<br>它有幾個頂點？')" },
    { file:'review', expect:'stem drops the closed-loop premise',
      find:"            : ('A shape is made of straight sides joined into a loop, and it has ' + d.n +\n               ' corners.<br>How many straight sides does it have?'),",
      replace:"            : ('A figure has ' + d.n + ' corners.<br>How many straight sides does it have?')," },
    /* 解釋裡的前提被拿掉也一樣要響。 */
    { file:'review', expect:'why drops the closed-loop premise',
      find:"            ? ('直的邊接成一圈時，邊有幾條，頂點就有幾個：' + d.n + ' 條邊就有 ' + d.n + ' 個頂點。')",
      replace:"            ? ('邊有幾條，頂點就有幾個：' + d.n + ' 條邊就有 ' + d.n + ' 個頂點。')" },
    /* 題幹把自己的數字改掉，答案卻沒動。 */
    { file:'review', expect:'stem numbers are',
      find:"            ? ('一個圖形有 ' + d.n + ' 個頂點，每個頂點上都張開 1 個角。<br>它一共有幾個角？')",
      replace:"            ? ('一個圖形有 ' + (d.n + 1) + ' 個頂點，每個頂點上都張開 1 個角。<br>它一共有幾個角？')" },
    /* 產生器裡問「圓有幾條邊」—— 舊版完全掃不到產生器的題幹。 */
    { file:'review', expect:'asks how many sides a circle has',
      find:"          stem:lang === 'zh' ? '下面哪一個圖形沒有頂點？' : 'Which of these shapes has no corners?',",
      replace:"          stem:lang === 'zh' ? '圓有幾條邊？下面哪一個圖形沒有頂點？' : 'How many sides does it have? It is a circle. Which of these shapes has no corners?'," },
    /* 產生器的解釋宣稱「圓有一個頂點」—— 中文數字，不含阿拉伯數字。 */
    { file:'review', expect:'claims a circle HAS',
      find:"            ? '圓是彎彎的一圈，沒有直的邊，也沒有相接又轉彎的地方，所以沒有頂點。'",
      replace:"            ? '圓是彎彎的一圈，沒有直的邊。其實圓有一個頂點。'" },
    /* 選項把吸管總數抄回來當「做了幾個」。 */
    { file:'review', expect:'copies the straw total',
      find:'        var cands = [ CT(k + 1, s), CT(k - 1, s), CT(k + 2, s) ];',
      replace:'        var cands = [ CT(total, s), CT(k - 1, s), CT(k + 2, s) ];' },
    /* 上課頁用中文數字宣稱「圓有一個頂點」。 */
    { file:'index', expect:'asserts that a circle HAS',
      find:"        if (key === 'circle') return '圓<strong>沒有頂點</strong>，也<strong>沒有角</strong>。';",
      replace:"        if (key === 'circle') return '圓<strong>沒有頂點</strong>，也<strong>沒有角</strong>。其實圓有一個頂點。';" },
    /* 問句的指涉放在問號的另一邊 —— 舊的鄰近判準抓不到。 */
    { file:'index', expect:'asks how many sides a circle has',
      find:"      gAsk:'這個圖形要放進哪一個籃子？',",
      replace:"      gAsk:'這個圖形有幾條邊？它是圓。'," },
    /* 整頁掃描原本只叫 p2End(n,'tri')，square/trap/penta 三條分支完全沒掃到。 */
    { file:'index', expect:'asks how many sides a circle has',
      find:"        var tail = (n === 3) ? '有 3 條直的邊，所以它是<strong>三角形</strong>。'\n                 : (n === 4) ? '有 4 條直的邊，所以它是<strong>四邊形</strong>。'",
      replace:"        var tail = (n === 3) ? '有 3 條直的邊，所以它是<strong>三角形</strong>。'\n                 : (n === 4 && key === 'square') ? '圓有幾條邊呢？'\n                 : (n === 4) ? '有 4 條直的邊，所以它是<strong>四邊形</strong>。'" },
    /* 定義句少了「不交叉」：蝴蝶結形也符合。 */
    { file:'index', expect:'must rule out self-crossing',
      find:"        if (key === 'tri') return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>3 條這樣的邊，就叫<strong>三角形</strong>。';",
      replace:"        if (key === 'tri') return '3 條直的邊圍一圈，就叫<strong>三角形</strong>。';" },
    /* 有描邊的圓沒有宣告線寬 —— 舊版當成 0，量少了。 */
    { file:'index', expect:'declares no stroke width',
      find:"              '\" fill=\"#FDF0E0\" stroke=\"#E8871E\" stroke-width=\"' + STROKE + '\"/>';",
      replace:"              '\" fill=\"#FDF0E0\" stroke=\"#E8871E\"/>';" },

    /* --- 第二輪審查（審「修正本身」）之後補的斷言 --- */
    /* 不相鄰的兩個頂點重合：把圖形捏成兩塊，只驗相鄰那一對抓不到。 */
    { file:'index', expect:'sit on the same spot',
      find:"    trap:    { kind:'quad',   pts:[[36,16],[92,16],[120,108],[8,108]] },",
      replace:"    trap:    { kind:'quad',   pts:[[36,16],[92,16],[36,16],[8,108]] }," },
    /* 兩條不相鄰的邊剛好碰到端點：不是「穿過去」，但畫面上一樣少一條邊。 */
    { file:'index', expect:'cross each other',
      find:"    hexa:    { kind:'poly',   pts:[[64,8],[112,36],[112,92],[64,120],[16,92],[16,36]] },",
      replace:"    hexa:    { kind:'poly',   pts:[[64,8],[112,36],[112,92],[88,22],[16,92],[16,36]] }," },
    /* 畫一個解析器量不到的元素：舊的守門員把它從兩邊的計數裡一起漏掉。 */
    { file:'index', expect:'which the geometry reader cannot measure',
      find:"    var body = '', maxX = 0, maxY = 0, i;",
      replace:"    var body = '<rect x=\"0\" y=\"0\" width=\"4\" height=\"4\"/>', maxX = 0, maxY = 0, i;" },
    /* 線寬不見了：舊版當成 0，量到的邊緣比實際窄。 */
    { file:'index', expect:'declares no stroke width',
      find:"'\" stroke=\"#E8871E\" stroke-width=\"8\" stroke-linecap=\"round\"/>';",
      replace:"'\" stroke=\"#E8871E\" stroke-linecap=\"round\"/>';" },
    /* 說完「都是四邊形」再否定掉：找子字串的版本照樣通過。 */
    { file:'index', expect:'states the inclusion and then negates it',
      find:"        return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>4 條這樣的邊，就叫<strong>四邊形</strong>。正方形、長方形、梯形都是四邊形。';",
      replace:"        return '4 條直的邊圍一圈、不交叉，就叫<strong>四邊形</strong>。正方形、長方形、梯形都是四邊形，不過長方形不是四邊形。';" },
    /* 把那句話放在 lead（題庫以外）—— 只掃題庫的版本會靜靜放行。 */
    { file:'index', expect:'a page string asks how many sides a circle has',
      find:"      s4h2:'三角形、四邊形和圓', s4lead:'長得不一樣沒關係。數邊和頂點就知道。',",
      replace:"      s4h2:'三角形、四邊形和圓', s4lead:'圓有幾條邊呢？數邊和頂點就知道。'," },
    /* 換一種問法（「圓的邊有幾條」），而且藏在解釋裡而不是題幹裡。 */
    { file:'index', expect:'never ask how many sides a circle has',
      find:"          why:'圓是彎彎的一圈，沒有直的邊，也沒有相接又轉彎的地方，所以沒有頂點。' },",
      replace:"          why:'圓的邊有幾條呢？圓是彎彎的一圈，沒有直的邊。' }," },
    { file:'index', expect:'reports data-sides=',
      find:"    return '<svg data-sides=\"' + sides + '\" data-verts=\"' + verts + '\" width=\"' + w",
      replace:"    return '<svg data-sides=\"9\" data-verts=\"' + verts + '\" width=\"' + w" },
    { file:'index', expect:'this lesson displays exactly',
      find:"      names:{ tri:'三角形', quad:'四邊形', circle:'圓' },",
      replace:"      names:{ tri:'三角形', quad:'四邊形', circle:'圓', trap:'梯型' }," },
    /* 把肯定句改成否定句：光看「有沒有出現那幾個詞」的話這一句照樣通過。 */
    { file:'index', expect:'must say, in these exact words',
      find:"        return '直的邊圍一圈、不交叉，每個接點都轉彎。<br>4 條這樣的邊，就叫<strong>四邊形</strong>。正方形、長方形、梯形都是四邊形。';",
      replace:"        return '有 4 條直的邊、4 個頂點，就叫<strong>四邊形</strong>。正方形、長方形、梯形不是四邊形。';" },
    /* 線寬要從屬性讀出來。寫死一半的話，線一加粗就量少了。 */
    { file:'review', expect:'draws out to x=',
      find:"           '<polygon points=\"' + s.join(' ') + '\" fill=\"#E3F4EB\" stroke=\"#2F9E69\" stroke-width=\"' +\n           STROKE + '\" stroke-linejoin=\"round\"/></svg>';",
      replace:"           '<polygon points=\"' + s.join(' ') + '\" fill=\"#E3F4EB\" stroke=\"#2F9E69\" stroke-width=\"60\" stroke-linejoin=\"round\"/></svg>';" },
    /* 誘答換成一句「其實也是真的」的話 —— 只擋重複那一句的話它會靜靜通過。 */
    { file:'review', expect:'is also a true sentence',
      find:"        var opts = shuffle([correct, SY('vert', n + 1), SY('vert', n - 1), SY('noVert')]);",
      replace:"        var opts = shuffle([correct, SY('vert', n + 1), SY('sideShape', n), SY('noVert')]);" },
    /* 把「圓」和「幾條邊」放進同一個選項 —— 這一課最不能出現的一句話。 */
    { file:'review', expect:'pairs the circle with a side count',
      find:"    circle: { zh:'圓',     en:'a circle' },",
      replace:"    circle: { zh:'圓有 1 條邊',     en:'a circle with 1 side' }," },
    /* 選項超出這一課真正走得到的範圍。 */
    { file:'review', expect:'outside 2~8',
      find:'          return (v >= 2 && v <= 9) ? SD(v) : null;\n        });\n        return { n:n, pts:pts, svg:polySVG(pts), correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'          return (v >= 2 && v <= 9) ? SD(v) : null;\n        });\n        mix.opts[(mix.ans + 1) % 4] = SD(9);\n        return { n:n, pts:pts, svg:polySVG(pts), correct:correct, opts:mix.opts, ans:mix.ans };' },
    { file:'index', expect:'outside 1~12',
      find:"          opts:['3 條邊','2 條邊','4 條邊','5 條邊'], ans:2,",
      replace:"          opts:['3 條邊','2 條邊','4 條邊','40 條邊'], ans:2," },
    /* 這一課最貴的一條規則：任何一頁都不可以問「圓有幾個邊」（各家講法不同，
       答案不唯一）。守門員自己要有一筆改壞版本證明它會響。 */
    { file:'index', expect:'never ask how many sides a circle has',
      find:"        { stem:'四邊形有幾條直的邊？',",
      replace:"        { stem:'圓有幾條邊？'," },
    { file:'index', expect:'never ask how many sides a circle has',
      find:"        { stem:'How many straight sides does a quadrilateral have?',",
      replace:"        { stem:'A circle: how many sides does it have?'," }
  ],

  sim: {
    /* simgen 的通用「誘答把題幹的數字抄回來」檢查在這一課永遠比不到：選項一律帶單位
       （「5 條邊」而不是「5」），字串不會等於 '5'。所以「誘答等於題幹裡的數字」這件事
       要自己推一次，結論是每一個產生器都到不了：
       - countSides／countVertices：題幹沒有數字（圖是 SVG，標籤被剝掉）。
       - sidesToVertices／verticesToSides／angleCount／sameCountSay：題幹只有 n，
         誘答是 n±1、n+2，永遠 ≠ n。
       - sumSides：題幹只有 a、b（1~3），選項是 5~24，兩者不相交。
       - strawsToShapes：選項**可以**等於題幹裡的 s（例如 6 根吸管、每個 3 根，
         選項有「3 個三角形」）—— 那正是「把每個要幾根當成做了幾個」這個真實迷思，
         單位與命題都不同，正確推理走不到。等於 total 則到不了（total ≥ 6 > k＋2）。
         這兩件事現在由 strawsToShapes 的不變條件實際檢查，不是靠這段推導。
       - nameByCount／noVertex／mustBeQuad：選項是名字或句子，沒有可抄的數字。
       因此不需要白名單；有一天參數池放寬了，這段推導就要重做一次。 */
    stemEchoOk: {},

    INVARIANTS: withTextCheck({
      /* 1. 看圖數邊：正解就是「畫出來的多邊形有幾個頂點座標」。 */
      countSides: d => countOk(d.n, 'the shape') || drawingOk(d, d.n) ||
        (keyOf(d.correct) !== 'side#' + d.pts.length
          ? 'the answer must be the number of sides drawn (' + d.pts.length + ')' : null) ||
        (d.n > 6 ? 'the drawn shapes only go up to 6 sides, got ' + d.n : null) ||
        base(d, 'side#' + d.pts.length),
      /* 2. 看圖數頂點：邊數 ＝ 頂點數，所以正解一樣是點的個數。 */
      countVertices: d => countOk(d.n, 'the shape') || drawingOk(d, d.n) ||
        (keyOf(d.correct) !== 'vert#' + d.pts.length
          ? 'the answer must be the number of corners drawn (' + d.pts.length + ')' : null) ||
        (d.n > 6 ? 'the drawn shapes only go up to 6 sides, got ' + d.n : null) ||
        base(d, 'vert#' + d.pts.length),
      /* 3. 給邊數找頂點數 —— 這一課的核心規則。 */
      sidesToVertices: d => countOk(d.n, 'the side count') ||
        (keyOf(d.correct) !== 'vert#' + d.n
          ? 'the answer must have as many corners as the sides given (' + d.n + ')' : null) ||
        base(d, 'vert#' + d.n),
      /* 4. 給頂點數找邊數 —— 同一條規則反過來。 */
      verticesToSides: d => countOk(d.n, 'the corner count') ||
        (keyOf(d.correct) !== 'side#' + d.n
          ? 'the answer must have as many sides as the corners given (' + d.n + ')' : null) ||
        base(d, 'side#' + d.n),
      /* 5. 一個頂點配一個角。 */
      angleCount: d => countOk(d.n, 'the corner count') ||
        (keyOf(d.correct) !== 'ang#' + d.n
          ? 'one angle for every corner: expected ' + d.n + ' angles' : null) ||
        base(d, 'ang#' + d.n),
      /* 6. 由邊數說出名字。只有 3 和 4 有名字可以說 —— 5、6 邊在這一課沒有教名字，
         放進來的話「一定可以叫它什麼」就沒有正確答案了。 */
      nameByCount: d => {
        if (d.n !== 3 && d.n !== 4) return 'nameByCount only names 3-sided and 4-sided shapes, got ' + d.n;
        const want = d.n === 3 ? 'name#tri' : 'name#quad';
        if (keyOf(d.correct) !== want) return 'the name must match the number of sides (' + d.n + ')';
        /* 誘答不可以是另一個「一定對」的名字。3 邊時 quad 是假的、4 邊時 tri 是假的，
           circle 與 square 兩種情況下都是假的（4 條邊不一定一樣長）。 */
        const allowed = d.n === 3 ? ['name#tri','name#quad','name#circle','name#square']
                                  : ['name#quad','name#tri','name#circle','name#square'];
        for (const o of d.opts){
          if (allowed.indexOf(keyOf(o)) < 0) return 'unexpected name option ' + keyOf(o);
        }
        return base(d, want);
      },
      /* 7. 沒有頂點的只有圓。其他三個選項一定要是「有頂點」的圖形。 */
      noVertex: d => {
        if (keyOf(d.correct) !== 'name#circle') return 'the shape with no corners must be the circle';
        for (const o of d.opts){
          if (o === d.correct) continue;
          if (keyOf(o) === 'name#circle') return 'every distractor must be a shape that has corners';
          if (['name#tri','name#quad','name#square','name#rect'].indexOf(keyOf(o)) < 0){
            return 'unexpected distractor ' + keyOf(o);
          }
        }
        return base(d, 'name#circle');
      },
      /* 8. 邊數相加：三角形 3 條、四邊形 4 條。 */
      sumSides: d => {
        if (!(Number.isInteger(d.a) && d.a >= 1 && d.a <= 3)) return 'triangle count must be 1~3, got ' + d.a;
        if (!(Number.isInteger(d.b) && d.b >= 1 && d.b <= 3)) return 'quadrilateral count must be 1~3, got ' + d.b;
        if (d.total !== 3 * d.a + 4 * d.b){
          return 'total sides is not 3 for each triangle plus 4 for each quadrilateral (' +
                 d.total + ' vs 3 x ' + d.a + ' + 4 x ' + d.b + ')';
        }
        return base(d, 'side#' + (3 * d.a + 4 * d.b));
      },
      /* 9. 吸管：每個圖形用「邊數」根吸管，剛好用完。 */
      strawsToShapes: d => {
        if (d.s !== 3 && d.s !== 4) return 'straws per shape must be 3 or 4, got ' + d.s;
        if (!(Number.isInteger(d.k) && d.k >= 2 && d.k <= 6)) return 'shape count must be 2~6, got ' + d.k;
        if (d.total !== d.s * d.k){
          return 'the straw total is not sides x shapes (' + d.total + ' vs ' + d.s + ' x ' + d.k + ')';
        }
        if (keyOf(d.correct) !== 'cnt#' + d.s + '#' + d.k){
          return 'the answer must be how many shapes were made (' + d.k + ')';
        }
        /* 選項的數字不可以等於題幹的吸管總數（那是把總數抄回來）。
           等於「每個要幾根」（d.s）是允許的 —— 那是刻意的迷思誘答，單位不同。 */
        for (const o of d.opts){
          if (o.u === 'cnt' && o.n === d.total){
            return 'an option copies the straw total (' + d.total + ') back out of the stem';
          }
        }
        return base(d, 'cnt#' + d.s + '#' + d.k);
      },
      /* 10. 「一定是四邊形」的只有「4 條直的邊」。其他選項都不可以是四邊形 ——
         這裡是這一課最容易寫錯的地方（正方形、歪斜四邊形其實都是四邊形）。 */
      mustBeQuad: d => {
        if (keyOf(d.correct) !== 'say#sideShape#4'){
          return 'the certain quadrilateral must be the 4-straight-sides one';
        }
        const okDistractor = ['say#sideShape#3','say#sideShape#5','say#sideShape#6',
                              'say#noStraight#null'];
        for (const o of d.opts){
          if (o === d.correct) continue;
          if (keyOf(o) === 'say#sideShape#4') return 'no distractor may itself be a quadrilateral';
          if (okDistractor.indexOf(keyOf(o)) < 0) return 'unexpected distractor ' + keyOf(o);
        }
        return base(d, 'say#sideShape#4');
      },
      /* 11. 哪一句話對：頂點數要等於邊數。 */
      sameCountSay: d => {
        const bad = countOk(d.n, 'the side count');
        if (bad) return bad;
        if (keyOf(d.correct) !== 'say#vert#' + d.n){
          return 'the true sentence must give the same number as the sides (' + d.n + ')';
        }
        /* 逐句判定真假，而不是白名單一種寫法：SY('sideShape', n) 之類的句子其實
           也是真的，放進來就有兩個正確答案。 */
        const oneTrue = exactlyOneTrue(d, d.n);
        if (oneTrue) return oneTrue;
        return base(d, 'say#vert#' + d.n);
      }
    }),

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的格式化函式重算，
       完全不呼叫 review.html 的 valStr —— 拿產生器自己的格式化函式來比等於自己比自己。
       看圖的兩題刻意從「畫出來的點數」重算，而不是從 d.n，多一條獨立的路。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'countSides':      return fSide(d.pts.length, lang);
        case 'countVertices':   return fVert(d.pts.length, lang);
        case 'sidesToVertices': return fVert(d.n, lang);
        case 'verticesToSides': return fSide(d.n, lang);
        case 'angleCount':      return fAng(d.n, lang);
        case 'nameByCount':     return fName(d.n === 3 ? 'tri' : 'quad', lang);
        case 'noVertex':        return fName('circle', lang);
        case 'sumSides':        return fSide(3 * d.a + 4 * d.b, lang);
        case 'strawsToShapes':  return fCnt(d.total / d.s, d.s, lang);
        case 'mustBeQuad':      return fSay('sideShape', 4, lang);
        case 'sameCountSay':    return fSay('vert', d.n, lang);
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀（單位種類）要是這個產生器允許的，數字要落在範圍裡，
       英文還要單複數一致。正解與誘答用同一組規則。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      /* 選項是這個設定檔唯一看得到的產生器輸出。這一課絕對不能把「圓」和「幾條邊」
         放在同一句話裡（圓有沒有一個邊，各家講法不同）—— 中文的數字也要認。 */
      if (/圓/.test(t) && /[0-9一二三四五六七八九十]\s*條?\s*邊/.test(t)){
        return 'an option pairs the circle with a side count: ' + t;
      }
      if (/circle/i.test(t) && /\b(?:\d+|one|two|three|four|five)\s+(?:straight\s+)?sides?\b/i.test(t)){
        return 'an option pairs the circle with a side count: ' + t;
      }
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      /* 英文的單複數：2 個以上一定要用複數，1 個一定要用單數。
         「4 side」看起來像小事，但它是「複數規則整條被拿掉」的唯一症狀。 */
      if (lang === 'en'){
        const m = t.match(/(\d+) ([a-z]+)/);
        if (m){
          const n = Number(m[1]), w = m[2];
          if (EN_SING.indexOf(w) >= 0 && n !== 1) return 'plural does not match the number: ' + t;
          if (EN_PLUR.indexOf(w) >= 0 && n === 1) return 'plural does not match the number: ' + t;
        }
      }
      const nums = (t.match(/\d+/g) || []).map(Number);
      if (NEEDS_NUM.indexOf(genId) >= 0 && !nums.length) return 'no number in option ' + t;
      if (NO_NUM.indexOf(genId) >= 0 && nums.length) return 'a name option must not contain a number: ' + t;
      const bounds = RANGE[genId];
      if (!bounds){
        if (nums.length) return 'no number range recorded for ' + genId;
        return null;
      }
      for (const v of nums){
        if (!(v >= bounds[0] && v <= bounds[1])){
          return 'option ' + t + ' contains ' + v + ', outside ' + bounds[0] + '~' + bounds[1];
        }
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIGS, STRAW_STEPS, SIDE_FIGS, VERT_FIGS, TABLE_ROWS, ROUNDS, BASKETS, figSVG, strawSVG, sidesOf, kindIndex}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];

      /* 名字字典是後面每一條渲染檢查的前提（gOpt 直接讀它）。缺了就先報出來再停 ——
         不然後面會丟 TypeError，整份報告變成 stack trace，真正的錯誤反而看不到。
         逐字比對真值表：只驗「有沒有填」的話，三角形寫成三角型照樣通過，
         而後面每一條渲染檢查用的又是同一本字典 —— 等於自己比自己。 */
      let namesOk = true;
      LANGS.forEach(L => {
        const nm = I18N[L] && I18N[L].names;
        if (!nm){ fail(`${L} has no names dictionary`); namesOk = false; return; }
        /* 只有這三個名字會被畫到畫面上（gOpt 只讀籃子的鍵）。字典裡多出來的條目
           沒有人驗、也沒有人看，寫錯了不會有任何症狀 —— 所以鍵的集合要「剛剛好」。 */
        const shown = ['tri','quad','circle'];
        const got = Object.keys(nm).sort().join(',');
        if (got !== shown.slice().sort().join(',')){
          fail(`${L} names has keys [${got}]; this lesson displays exactly [${shown.join(',')}]`);
          namesOk = false;
          return;
        }
        shown.forEach(k => {
          if (nm[k] !== NAME_TRUTH[k][L]){
            fail(`${L} names.${k} is "${nm[k]}", the checker expects "${NAME_TRUTH[k][L]}"`);
          }
        });
      });
      if (!namesOk) return;

      /* --- 圖形目錄：邊數一律從座標數出來，再跟設定檔自己的真值表比一次 --- */
      const ids = Object.keys(data.FIGS);
      if (ids.length !== Object.keys(FIG_SIDES).length){
        fail(`FIGS has ${ids.length} figures but the checker knows ${Object.keys(FIG_SIDES).length}`);
      }
      ids.forEach(id => {
        const f = data.FIGS[id];
        const want = FIG_SIDES[id];
        if (want === undefined){ fail(`FIGS.${id} is not in the checker catalogue`); return; }
        if (f.kind === 'circle'){
          if (want !== 0) fail(`FIGS.${id} is drawn as a circle but the checker expects ${want} straight sides`);
          ['cx','cy','r'].forEach(k => {
            if (!Number.isInteger(f[k]) || f[k] <= 0) fail(`FIGS.${id}.${k} must be a positive whole number`);
          });
          /* 圓也要待在方框裡。畫布是從座標算出來的，所以圓跑掉時畫布只會跟著變大 ——
             canvasOk 抓不到，只有這一條抓得到（多邊形那邊本來就有）。 */
          if (Number.isInteger(f.cx) && Number.isInteger(f.cy) && Number.isInteger(f.r)){
            if (f.cx - f.r < 0 || f.cy - f.r < 0 || f.cx + f.r > BOX || f.cy + f.r > BOX){
              fail(`FIGS.${id} spans x ${f.cx - f.r}~${f.cx + f.r}, y ${f.cy - f.r}~${f.cy + f.r}, outside the ${BOX} x ${BOX} drawing box`);
            }
          }
          if (f.pts) fail(`FIGS.${id} is a circle and must not carry corner coordinates`);
        } else {
          if (!Array.isArray(f.pts)) { fail(`FIGS.${id} has no corner coordinates`); return; }
          if (f.pts.length !== want){
            fail(`FIGS.${id} has ${f.pts.length} corners; the checker expects ${want} straight sides`);
          }
          f.pts.forEach((p, i) => {
            if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger) || p.some(v => v < 0)){
              fail(`FIGS.${id} corner ${i} is not a whole-number coordinate pair`);
              return;
            }
            /* 每個圖形都畫在 130 x 130 的方框裡 —— 四邊形家族那一排要並排放進手機畫面，
               所以座標不能亂跑。畫布是從座標算出來的，座標爆掉時畫布只會跟著變大，
               寬度檢查抓不到，只有這一條抓得到。 */
            if (p[0] > BOX || p[1] > BOX){
              fail(`FIGS.${id} corner ${i} is at ${p.join(',')}, outside the ${BOX} x ${BOX} drawing box`);
            }
          });
          /* 兩個頂點不可以重合 —— 重合的話畫出來少一條邊，數出來卻還是 n。 */
          const seen = {};
          f.pts.forEach(p => {
            const k = p.join(',');
            if (seen[k]) fail(`FIGS.${id} has two corners at the same spot (${k})`);
            seen[k] = true;
          });
          const shapeBad = polyProblem(f.pts);
          if (shapeBad) fail(`FIGS.${id}: ${shapeBad}`);
          const kindWant = want === 3 ? 'tri' : (want === 4 ? 'quad' : 'poly');
          if (f.kind !== kindWant) fail(`FIGS.${id} is tagged "${f.kind}" but has ${want} sides (expected "${kindWant}")`);
        }
        /* sidesOf 是遊戲與範例共用的那一個函式，也要驗一次。 */
        if (data.sidesOf(id) !== want) fail(`sidesOf("${id}") is ${data.sidesOf(id)}, the checker expects ${want}`);
      });

      /* --- 圖畫得下嗎：從 SVG 真正吐出來的座標重算右緣與下緣，不看樣式 --- */
      /* xs/ys 是「畫出去的最右／最下緣」，xsL/ysT 是「最左／最上緣」。
         只量右下的話，一個 r ＝ 9 的頂點圓點畫在 y ＝ 8 上會被上緣切掉而檢查全綠。 */
      const edgesOf = (svg) => {
        const xs = [], ys = [], xsL = [], ysT = [], noWidth = [], malformed = [], styled = [];
        let seen = 0;
        let m;
        /* 抓「整個標籤」，不是只抓到 points 為止 —— 只抓一半的話，寫在 points 後面的
           stroke-width 會讀不到，量出來的邊緣就比實際窄（而且會誤報成沒有線寬）。 */
        const rePoly = /<polygon([^>]*?)\/?>/g;
        while ((m = rePoly.exec(svg)) !== null){
          seen++;
          const attrs = m[1];
          const sw = Number((attrs.match(/stroke-width="(\d+(?:\.\d+)?)"/) || [])[1] || 0) / 2;
          if (!/stroke-width="/.test(attrs)) noWidth.push('polygon');
          if (/\bstyle="/.test(attrs) || /\bclass="/.test(attrs)) styled.push('polygon');
          const ptm = attrs.match(/\bpoints="([^"]+)"/);
          if (!ptm) continue;
          ptm[1].trim().split(/\s+/).forEach(pair => {
            const xy = pair.split(',').map(Number);
            if (xy.length === 2 && xy.every(Number.isFinite)){
              xs.push(xy[0] + sw); ys.push(xy[1] + sw);
              xsL.push(xy[0] - sw); ysT.push(xy[1] - sw);
            }
          });
        }
        const reLine = /<line([^>]*?)\/?>/g;
        while ((m = reLine.exec(svg)) !== null){
          seen++;
          const a = m[1];
          /* 有畫線就一定要宣告線寬。少了它就當成 0，量到的邊緣會比實際窄。 */
          if (!/stroke-width="/.test(a)) noWidth.push('line');
          const sw = Number((a.match(/stroke-width="(\d+(?:\.\d+)?)"/) || [])[1] || 0) / 2;
          /* 每一個必要座標都要存在。少一個就當成畫壞了 —— 原本是「有就記、沒有就跳過」，
             seen 照樣加一，那條邊完全沒被量到卻全綠（codex 第二輪抓到）。 */
          if (/\bstyle="/.test(a) || /\bclass="/.test(a)) styled.push('line');
          const lv = ['x1','x2','y1','y2'].map(k =>
            Number((a.match(new RegExp('\\b' + k + '="(-?\\d+(?:\\.\\d+)?)"')) || [])[1]));
          if (!lv.every(Number.isFinite)){ malformed.push('line'); continue; }
          xs.push(lv[0] + sw, lv[1] + sw); xsL.push(lv[0] - sw, lv[1] - sw);
          ys.push(lv[2] + sw, lv[3] + sw); ysT.push(lv[2] - sw, lv[3] - sw);
        }
        const reCirc = /<circle([^>]*?)\/?>/g;
        while ((m = reCirc.exec(svg)) !== null){
          seen++;
          const a = m[1];
          /* 靠 style／class 上色的話，這裡量到的線寬會是 0，畫面卻真的畫粗了 ——
             這就是「靠樣式判斷」的 fail-open。幾何元素一律只准用呈現屬性。 */
          if (/\bstyle="/.test(a) || /\bclass="/.test(a)) styled.push('circle');
          const cx = Number((a.match(/\bcx="(-?\d+(?:\.\d+)?)"/) || [])[1]);
          const cy = Number((a.match(/\bcy="(-?\d+(?:\.\d+)?)"/) || [])[1]);
          const r  = Number((a.match(/\br="(-?\d+(?:\.\d+)?)"/) || [])[1]);
          const sw = Number((a.match(/stroke-width="(\d+(?:\.\d+)?)"/) || [])[1] || 0) / 2;
          /* 有 stroke 就一定要有 stroke-width。沒有 stroke 的圓（頂點的實心圓點）
             本來就不描邊，當成 0 是對的 —— 但「有描邊卻沒宣告寬度」會量少。 */
          if (/\bstroke="/.test(a) && !/stroke-width="/.test(a)) noWidth.push('circle');
          if (![cx, cy, r].every(Number.isFinite)){ malformed.push('circle'); continue; }
          xs.push(cx + r + sw); ys.push(cy + r + sw);
          xsL.push(cx - r - sw); ysT.push(cy - r - sw);
        }
        /* 文字的右緣不是 x —— 還要看有幾個字，以及 text-anchor 把字擺在 x 的哪一邊。 */
        const reText = /<text([^>]*)>([^<]*)<\/text>/g;
        while ((m = reText.exec(svg)) !== null){
          seen++;
          const a = m[1], body = m[2];
          const x = Number((a.match(/\bx="(-?\d+(?:\.\d+)?)"/) || [])[1]);
          const y = Number((a.match(/\by="(-?\d+(?:\.\d+)?)"/) || [])[1]);
          if (!Number.isFinite(x) || !Number.isFinite(y)){ malformed.push('text'); continue; }
          const fs = Number((a.match(/\bfont-size="(\d+)"/) || [])[1] || 20);
          const anchor = (a.match(/\btext-anchor="([a-z]+)"/) || [])[1] || 'start';
          const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
          xs.push(anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide));
          xsL.push(anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x));
          /* 文字的上緣大約在基線往上一個字級的地方，下緣再往下一點點。 */
          if (Number.isFinite(y)){ ys.push(y + 2); ysT.push(y - fs); }
        }
        /* 解析器認得幾個元素，畫面上就有幾個 —— 對不上就表示有一種元素沒有被量到。
           少了這一條，把 `<line ... />` 改寫成 `<line ...></line>` 就會讓那些線
           整批從寬度計算裡消失，檢查照樣是綠的（fail-open）。 */
        /* 列舉 SVG 裡「每一個」元素，而不是只數解析器已經認得的那四種 ——
           不然多一個 <rect> 或 <path> 會同時從兩邊的計數裡消失，守門員自己看不見它。 */
        const MEASURABLE = ['polygon','line','circle','text'];
        const tags = (svg.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
        const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
        const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
        return { xs, ys, xsL, ysT, seen, rawCount, unsupported, noWidth, malformed, styled };
      };
      const canvasOk = (label, svg) => {
        const w = Number((svg.match(/(?:^|\s)width="(\d+)"/) || [])[1]);
        const h = Number((svg.match(/(?:^|\s)height="(\d+)"/) || [])[1]);
        const vb = (svg.match(/viewBox="0 0 (\d+) (\d+)"/) || []);
        const e = edgesOf(svg);
        if (!Number.isFinite(w) || !Number.isFinite(h) || !e.xs.length){
          fail(`${label}: cannot read the drawing geometry`); return;
        }
        if (e.styled.length){
          fail(`${label}: a <${e.styled[0]}> carries style/class, so its painted stroke cannot be measured from attributes`);
          return;
        }
        if (e.malformed.length){
          fail(`${label}: a <${e.malformed[0]}> is missing a required coordinate, so its painted edge cannot be measured`);
          return;
        }
        if (e.noWidth.length){
          fail(`${label}: a <${e.noWidth[0]}> declares no stroke width, so its painted edge cannot be measured`);
          return;
        }
        if (e.unsupported.length){
          fail(`${label}: draws <${e.unsupported[0]}>, which the geometry reader cannot measure`);
          return;
        }
        if (e.seen !== e.rawCount){
          fail(`${label}: the geometry reader measured ${e.seen} of ${e.rawCount} drawn elements — the rest are unmeasured`);
          return;
        }
        if (Number(vb[1]) !== w || Number(vb[2]) !== h){
          fail(`${label}: the viewBox (${vb[1]} x ${vb[2]}) does not match the canvas (${w} x ${h})`);
        }
        const right = Math.max.apply(null, e.xs), bottom = Math.max.apply(null, e.ys);
        const left = Math.min.apply(null, e.xsL), top = Math.min.apply(null, e.ysT);
        if (!(w >= right + 2)) fail(`${label} is ${w}px wide but draws out to x=${right}`);
        if (!(h >= bottom + 2)) fail(`${label} is ${h}px tall but draws out to y=${bottom}`);
        if (!(left >= 0)) fail(`${label} is clipped by the left edge (draws out to x=${left})`);
        if (!(top >= 0)) fail(`${label} is clipped by the top edge (draws out to y=${top})`);
      };
      /* 每一格畫面都要驗，不只頭尾 —— 中間那一格被切掉一樣是缺陷。 */
      ids.forEach(id => {
        const n = FIG_SIDES[id];
        /* data-sides / data-verts 是圖自己報的數字，沒有人讀它，所以寫錯了不會有症狀。
           跟真正畫出來的點數比一次 —— 不然它會慢慢跟圖形脫節。 */
        const svg0 = data.figSVG(id);
        const pm = svg0.match(/\bpoints="([^"]+)"/);
        const drawn = pm ? pm[1].trim().split(/\s+/).length : 0;
        /* 驗「畫出來的座標」本身，不是只驗原始資料：原始資料合法、渲染卻吐出
           points="62,12 62,12 8,104" 時，點數還是 3、畫布也還在，
           但孩子看到的只有兩條邊（codex 第三輪抓到）。每一格畫面都要驗。 */
        if (pm){
          const frames = [{ }, { lit:n }, { dots:n }, { lit:n, dots:n }];
          for (let k = 0; k <= n; k++){ frames.push({ lit:k }); frames.push({ dots:k }); }
          frames.forEach(opt => {
            const svgF = data.figSVG(id, opt);
            const pf = svgF.match(/\bpoints="([^"]+)"/);
            if (!pf){ fail(`figSVG(${id}, ${JSON.stringify(opt)}) lost its polygon`); return; }
            const toks = pf[1].trim().split(/\s+/);
            const pts = [];
            for (const tk of toks){
              /* 壞掉的座標要報錯，不可以默默跳過 —— 跳過的話點數就對不上了。 */
              if (!/^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/.test(tk)){
                fail(`figSVG(${id}, ${JSON.stringify(opt)}) has an invalid point token "${tk}"`); return;
              }
              pts.push(tk.split(',').map(Number));
            }
            const bad = polyProblem(pts);
            if (bad){ fail(`figSVG(${id}, ${JSON.stringify(opt)}) as rendered: ${bad}`); return; }
            /* 渲染出來的點必須就是原始點整體平移的結果，不多不少。 */
            const wantPts = (data.FIGS[id].pts || []).map(q => [q[0] + OFFSET, q[1] + OFFSET]);
            if (pts.length !== wantPts.length || pts.some((q, i) => q[0] !== wantPts[i][0] || q[1] !== wantPts[i][1])){
              fail(`figSVG(${id}, ${JSON.stringify(opt)}) draws ${JSON.stringify(pts)}, expected the raw points shifted by ${OFFSET}`);
            }
          });
        }
        const ds = Number((svg0.match(/data-sides="(\d+)"/) || [])[1]);
        const dv = Number((svg0.match(/data-verts="(\d+)"/) || [])[1]);
        if (ds !== drawn) fail(`figSVG(${id}) reports data-sides=${ds} but draws ${drawn} corners`);
        if (dv !== drawn) fail(`figSVG(${id}) reports data-verts=${dv} but draws ${drawn} corners`);
        if (drawn !== n) fail(`figSVG(${id}) draws ${drawn} corners; the checker expects ${n}`);
        canvasOk(`figSVG(${id})`, svg0);
        for (let k = 0; k <= n; k++){
          canvasOk(`figSVG(${id}, lit=${k})`, data.figSVG(id, { lit:k }));
          canvasOk(`figSVG(${id}, dots=${k})`, data.figSVG(id, { dots:k }));
        }
        canvasOk(`figSVG(${id}, all)`, data.figSVG(id, { lit:n, dots:n }));
      });

      /* --- 範例 1：吸管與黏土。吸管數 ＝ 黏土球數，3~6 根 --- */
      const steps = data.STRAW_STEPS;
      if (steps.join(',') !== '3,4,5,6') fail(`STRAW_STEPS must be 3, 4, 5, 6 — got ${steps.join(', ')}`);
      steps.forEach(n => {
        const svg = data.strawSVG(n);
        canvasOk(`strawSVG(${n})`, svg);
        /* 畫出來的線（吸管）與圓點（黏土球）各要有 n 個 —— 這張圖就是規則本身。 */
        const lines = (svg.match(/<line /g) || []).length;
        const balls = (svg.match(/<circle /g) || []).length;
        if (lines !== n) fail(`strawSVG(${n}) draws ${lines} straws, expected ${n}`);
        if (balls !== n) fail(`strawSVG(${n}) draws ${balls} clay balls, expected ${n}`);
        LANGS.forEach(L => {
          const s = I18N[L].p1Line(n);
          if (/undefined|NaN/.test(s)) fail(`p1Line ${L}(${n}): ${s}`);
          const sideW = L === 'zh' ? `${n} 條邊` : `${n} sides`;
          const vertW = L === 'zh' ? `${n} 個頂點` : `${n} corners`;
          if (s.indexOf(sideW) < 0) fail(`p1Line ${L}(${n}) never states the side count (${sideW})`);
          if (s.indexOf(vertW) < 0) fail(`p1Line ${L}(${n}) never states the corner count (${vertW})`);
          if (n === 3 && !says(s, nameWord('tri', L), L)) fail(`p1Line ${L}(3) never names the triangle`);
          if (n === 4 && !says(s, nameWord('quad', L), L)) fail(`p1Line ${L}(4) never names the quadrilateral`);
        });
      });

      /* --- 範例 2／3：數邊與數頂點的圖形清單 --- */
      const listOk = (name, list) => {
        if (!Array.isArray(list) || list.length !== 4) fail(`${name} should offer 4 figures, has ${(list||[]).length}`);
        (list || []).forEach(id => {
          if (FIG_SIDES[id] === undefined) fail(`${name} refers to unknown figure ${id}`);
          else if (FIG_SIDES[id] === 0) fail(`${name} cannot include the circle — it has no sides to count`);
        });
        const counts = (list || []).map(id => FIG_SIDES[id]);
        if (counts.indexOf(3) < 0 || counts.indexOf(4) < 0){
          fail(`${name} needs a 3-sided and a 4-sided figure so the two names both appear`);
        }
        if (new Set(counts).size < 3) fail(`${name} only offers ${new Set(counts).size} different side counts`);
      };
      listOk('SIDE_FIGS', data.SIDE_FIGS);
      listOk('VERT_FIGS', data.VERT_FIGS);
      LANGS.forEach(L => {
        const d = I18N[L];
        data.SIDE_FIGS.forEach(id => {
          const n = FIG_SIDES[id];
          const chip = d.sideChip(id, n), end = d.p2End(n, id);
          [chip, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`side example ${L}/${id}: ${s}`); });
          if (chip.indexOf(String(n)) < 0) fail(`sideChip ${L}/${id} never states the side count ${n}`);
          const sideW = L === 'zh' ? `${n} 條邊` : `${n} sides`;
          if (end.indexOf(sideW) < 0) fail(`p2End ${L}/${id} never states the side count (${sideW})`);
          if (n === 3 && !says(end, nameWord('tri', L), L)){
            fail(`p2End ${L}: a 3-sided figure must be named a triangle`);
          }
          if (n === 4 && !says(end, nameWord('quad', L), L)){
            fail(`p2End ${L}: a 4-sided figure must be named a quadrilateral`);
          }
          /* 5、6 邊的圖形在這一課沒有名字。用「正面斷言」而不是「禁止出現那兩個字」——
             正確的說法本來就會提到它們（「不是三角形也不是四邊形」），
             禁止出現的話反而會把對的句子判成錯的。 */
          if (n > 4){
            const deny = L === 'zh' ? '不是三角形也不是四邊形' : 'neither a triangle nor a quadrilateral';
            if (!says(end, deny, L)){
              fail(`p2End ${L}: a ${n}-sided figure must be told it is "${deny}"`);
            }
          }
        });
        data.VERT_FIGS.forEach(id => {
          const n = FIG_SIDES[id];
          const chip = d.vertChip(id, n), end = d.p3End(n);
          [chip, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`vert example ${L}/${id}: ${s}`); });
          const vertW = L === 'zh' ? `${n} 個頂點` : `${n} corners`;
          const sideW = L === 'zh' ? `${n} 條` : `${n} sides`;
          const angW  = L === 'zh' ? `${n} 個角` : `${n} angles`;
          if (end.indexOf(vertW) < 0) fail(`p3End ${L}(${n}) never states the corner count (${vertW})`);
          if (end.indexOf(angW) < 0) fail(`p3End ${L}(${n}) never states the angle count (${angW})`);
          /* 這一段的重點是「邊和頂點一樣多」，所以結語一定要把邊數也講出來。 */
          if (end.indexOf(sideW) < 0) fail(`p3End ${L}(${n}) never links the corner count back to the sides`);
        });
      });

      /* --- 範例 4：三個家族 --- */
      const rows = data.TABLE_ROWS;
      if (rows.length !== 3) fail(`TABLE_ROWS should have 3 families, has ${rows.length}`);
      const rowKeys = rows.map(r => r.key).join(',');
      if (rowKeys !== 'tri,quad,circle') fail(`TABLE_ROWS keys should be tri, quad, circle — got ${rowKeys}`);
      rows.forEach(row => {
        if (row.key === 'circle'){
          if (row.sides !== 0) fail('the circle row must record 0 straight sides');
          if (row.figs.length !== 1 || row.figs[0] !== 'circle') fail('the circle row must show exactly the circle');
        } else {
          const want = row.key === 'tri' ? 3 : 4;
          if (row.sides !== want) fail(`the ${row.key} row records ${row.sides} sides, expected ${want}`);
          if (row.figs.length < 3) fail(`the ${row.key} row shows only ${row.figs.length} figures; show at least 3 different-looking ones`);
          row.figs.forEach(id => {
            if (FIG_SIDES[id] !== want) fail(`${row.key} row: ${id} has ${FIG_SIDES[id]} sides but the row is for ${want}`);
          });
          /* 同一家族裡的圖形不可以長得一樣 —— 這一段就是要讓孩子看到「長相不重要」。 */
          if (new Set(row.figs).size !== row.figs.length) fail(`the ${row.key} row repeats a figure`);
        }
      });
      /* 四邊形那一家一定要同時有正方形和長方形，這是「正方形也是四邊形」的證據。 */
      const quadRow = rows.filter(r => r.key === 'quad')[0] || { figs:[] };
      ['square','rect'].forEach(id => {
        if (quadRow.figs.indexOf(id) < 0) fail(`the quadrilateral family must show ${id} so the inclusion is visible`);
      });
      LANGS.forEach(L => {
        const d = I18N[L];
        rows.forEach(row => {
          const chip = d.tabChip(row.key), t1 = d.t1(row.key, row.sides),
                t2 = d.t2(row.key, row.sides), t3 = d.t3(row.key, row.sides);
          [chip, t1, t2, t3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`table ${L}/${row.key}: ${s}`); });
          if (row.key === 'circle'){
            /* 圓的三句話裡都不可以出現數字 —— 「圓有 0 條邊」「圓有 1 個邊」都是這一課
               明確避開的說法（各家講法不同）。「沒有直的邊」才是任何講法下都成立的。 */
            [t1, t2, t3].forEach((s, i) => {
              if (/\d/.test(s.replace(/<[^>]+>/g, ''))) fail(`the circle line t${i + 1} ${L} must not count anything: ${s}`);
            });
            const noStraight = L === 'zh' ? '沒有直的邊' : 'no straight sides';
            const noCorner = L === 'zh' ? '沒有頂點' : 'no corners';
            const noAngle = L === 'zh' ? '沒有角' : 'no angles';
            if (t1.replace(/<[^>]+>/g, '').indexOf(noStraight) < 0){
              fail(`the circle line must say it has no straight sides (${L})`);
            }
            const t2p = t2.replace(/<[^>]+>/g, '');
            if (t2p.indexOf(noCorner) < 0 || t2p.indexOf(noAngle) < 0){
              fail(`the circle line must say it has no corners and no angles (${L})`);
            }
          } else {
            const sideW = L === 'zh' ? `${row.sides} 條直的邊` : `${row.sides} straight sides`;
            const vertW = L === 'zh' ? `${row.sides} 個頂點` : `${row.sides} corners`;
            const t1p = t1.replace(/<[^>]+>/g, ''), t2p = t2.replace(/<[^>]+>/g, '');
            if (t1p.indexOf(sideW) < 0) fail(`t1 ${L}/${row.key} never states "${sideW}"`);
            if (t2p.indexOf(vertW) < 0) fail(`t2 ${L}/${row.key} never states "${vertW}"`);
            /* 找子字串抓不到極性：「它沒有 4 條直的邊」同樣含有「4 條直的邊」。 */
            const denies = (text, claim) => {
              const at = text.indexOf(claim);
              if (at < 0) return false;
              const before = text.slice(Math.max(0, at - 12), at);
              return L === 'zh'
                ? /(?:沒有|不具有|未具有|不含|不帶|不是|並非|不到|缺少)[^，。]{0,6}$/.test(before)
                : /(?:\b(?:not|no|never|without|lacks?|lacking)\b|n['’]t\b)[^.!?]{0,10}$/i.test(before);
            };
            if (denies(t1p, sideW)) fail(`t1 ${L}/${row.key} denies its own claim "${sideW}": ${t1p}`);
            if (denies(t2p, vertW)) fail(`t2 ${L}/${row.key} denies its own claim "${vertW}": ${t2p}`);
            if (!says(t3.replace(/<[^>]+>/g, ''), nameWord(row.key, L), L)){
              fail(`t3 ${L}/${row.key} never names the family`);
            }
            /* 定義句要同時排除三種反例：開放的折線（沒有圍成一圈）、蝴蝶結（自我交叉），
               以及「兩根吸管接成一直線」（閉合又不交叉，卻只有 3 條邊 3 個頂點）。
               三個條件要各自獨立驗一次 —— 原本只驗了「不交叉」，卻把它命名成 closed，
               所以一個開放的三段折線也能滿足「三角形」的定義（codex 第三輪抓到）。 */
            const t3p = t3.replace(/<[^>]+>/g, '');
            const loopClause = L === 'zh' ? /直的邊(?:圍|接)(?:成)?一圈/ : /straight sides[^.!?]{0,24}\bin (?:one|a) loop\b/i;
            if (!loopClause.test(t3p)) fail(`t3 ${L}/${row.key} never says the sides form a closed loop`);
            const loopNeg = L === 'zh' ? /(?:沒有|不是|並非|未)[^。！？]{0,6}(?:接成|圍成|圍)一圈/
                                       : /\b(?:not|never|no)\b[^.!?]{0,24}\bin (?:one|a) loop\b/i;
            if (loopNeg.test(t3p)) fail(`t3 ${L}/${row.key} negates the closed-loop clause`);
            const nocross = L === 'zh' ? '不交叉' : 'never cross';
            if (!says(t3p, nocross, L)) fail(`t3 ${L}/${row.key} must rule out self-crossing ("${nocross}")`);
            const turns = L === 'zh' ? '每個接點都轉彎' : 'turning at every join';
            if (!says(t3p, turns, L)) fail(`t3 ${L}/${row.key} must state that every join turns ("${turns}")`);
            /* 四邊形那一段一定要明講正方形和長方形也是四邊形 —— 這是這一課最貴的迷思。
               只驗「有沒有出現那幾個詞」是 fail-open：「正方形、長方形不是四邊形」
               同樣含有全部的詞，照樣通過。所以比對的是整句肯定句。 */
            if (row.key === 'quad'){
              const p = t3.replace(/<[^>]+>/g, '');
              const affirm = L === 'zh' ? '正方形、長方形、梯形都是四邊形'
                                        : 'Squares, rectangles and trapeziums are all quadrilaterals';
              if (!says(p, affirm, L)){
                fail(`t3 ${L}/quad must say, in these exact words, "${affirm}"`);
              }
              /* 光找子字串是 fail-open：「正方形…不是四邊形」和「It is false that …」
                 都含有那一整串字。所以再擋一次否定詞。 */
              /* 只找「否定掉四邊形這件事」的說法，不要見到 never 就開槍 ——
                 定義句本身就有「never cross」，一律擋會把正確的句子判成缺陷。 */
              const negated = L === 'zh'
                ? /(?:不是|並非|不算|沒有一個是)[^。]{0,8}四邊形/
                : /(?:\b(?:not|never|aren|isn|don|doesn|aren’t|aren't|isn’t|isn't)\b|n['’]t\b)[^.!?]{0,12}\bquadrilaterals?\b|\bfalse that\b/i;
              if (negated.test(p)){
                fail(`t3 ${L}/quad states the inclusion and then negates it: "${p}"`);
              }
            }
          }
        });
      });

      /* --- 遊戲關卡 --- */
      const rounds = data.ROUNDS;
      if (rounds.length !== 5) fail(`ROUNDS should have 5 rounds, has ${rounds.length}`);
      if (data.BASKETS.join(',') !== 'tri,quad,circle'){
        /* 這裡一定要 return。繼續往下跑的話 BASKETS[2] 會是 undefined，
           nameWord(undefined) 直接丟 TypeError，整份報告變成 stack trace。 */
        fail(`BASKETS should be tri, quad, circle — got ${data.BASKETS.join(', ')}`);
        return;
      }
      const seenBasket = {};
      rounds.forEach((r, idx) => {
        const i = idx + 1;
        const want = FIG_SIDES[r.fig];
        if (want === undefined){ fail(`ROUND ${i} uses unknown figure ${r.fig}`); return; }
        const wantIdx = want === 0 ? 2 : (want === 3 ? 0 : (want === 4 ? 1 : -1));
        if (wantIdx < 0){
          /* 這裡一定要 return。繼續往下跑的話 BASKETS[-1] 是 undefined，
             NAME_TRUTH[undefined] 直接丟 TypeError，整份報告變成 stack trace，
             真正的錯誤訊息反而看不到。 */
          fail(`ROUND ${i}: a ${want}-sided figure has no basket in this game`);
          return;
        }
        if (data.kindIndex(r.fig) !== wantIdx){
          fail(`ROUND ${i}: kindIndex("${r.fig}") is ${data.kindIndex(r.fig)}, the checker expects ${wantIdx}`);
        }
        seenBasket[wantIdx] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const opt = d.gOpt(data.BASKETS[wantIdx]);
          const h2 = d.gHint2(want), why = d.gWhy(want, data.BASKETS[wantIdx]);
          [d.gAsk, d.gHint1, h2, why, opt].forEach(s => {
            if (/undefined|NaN/.test(s)) fail(`ROUND ${i} ${L}: ${s}`);
          });
          if (opt !== nameWord(data.BASKETS[wantIdx], L)){
            fail(`ROUND ${i} ${L}: the basket label is "${opt}", the checker expects "${nameWord(data.BASKETS[wantIdx], L)}"`);
          }
          if (!says(why, opt, L)) fail(`ROUND ${i} ${L}: gWhy never names the answer "${opt}"`);
          if (want === 0){
            /* 圓那一關的提示與解說都不可以出現數字（同上：不去碰「圓有幾個邊」）。 */
            if (/\d/.test(h2)) fail(`ROUND ${i} ${L}: gHint2 for the circle must not count straight sides`);
            if (/\d/.test(why)) fail(`ROUND ${i} ${L}: gWhy for the circle must not count straight sides`);
          } else {
            if (h2.indexOf(String(want)) < 0) fail(`ROUND ${i} ${L}: gHint2 never gives the side count ${want}`);
            if (why.indexOf(String(want)) < 0) fail(`ROUND ${i} ${L}: gWhy never gives the side count ${want}`);
          }
        });
      });
      if (Object.keys(seenBasket).length !== 3) fail('ROUNDS must cover all three baskets at least once');
      const ansIdx = rounds.map(r => data.kindIndex(r.fig));
      if (new Set(ansIdx).size < 2) fail('every game round has the same answer position');

      /* --- 整頁掃描：任何一個字典字串都不可以問「圓有幾個邊」 ---
         只掃題庫的話，把那句話搬到 lead、footer、提示或解說就溜過去了。
         字典裡也有函式，所以把每個函式用這一課會用到的參數各叫一次。 */
      LANGS.forEach(L => {
        const d = I18N[L];
        /* 兩個桶子分開：assertions 是「課程主張為真」的散文（題幹、解釋、說明、表格、提示），
           candidates 是選項字串 —— 其中有些是**刻意寫錯**的（qsBoost 就是要孩子認出
           「圓有 1 個頂點」是假的）。問句的檢查兩邊都要跑，
           但「宣稱圓有邊／頂點／角」只能對 assertions 跑，否則會把刻意的錯誤選項判成缺陷。 */
        const strings = [], candidates = [];
        const push = v => { if (typeof v === 'string') strings.push(v); };
        const pushOpt = v => { if (typeof v === 'string') candidates.push(v); };
        Object.keys(d).forEach(k => {
          const v = d[k];
          if (typeof v === 'string') push(v);
          else if (Array.isArray(v)) v.forEach(q => { push(q && q.stem); push(q && q.why); (q && q.opts || []).forEach(pushOpt); });
        });
        /* 會產生文字的函式：把「這一課真的到得了的每一組參數」都叫過一次。
           少列一個函式或少列一組參數，那條路徑上的字就完全沒被掃到
           （原本只叫了 p2End(n,'tri')，square/trap/penta 三條分支整個沒掃）。 */
        const figIds = Object.keys(data.FIGS);
        const sideCounts = [...new Set(figIds.map(id => FIG_SIDES[id]))];
        data.STRAW_STEPS.forEach(n => push(d.p1Line(n)));
        data.SIDE_FIGS.forEach(id => { push(d.sideChip(id, FIG_SIDES[id])); push(d.p2End(FIG_SIDES[id], id)); });
        data.VERT_FIGS.forEach(id => { push(d.vertChip(id, FIG_SIDES[id])); push(d.p3End(FIG_SIDES[id])); });
        /* p2End／p3End 對每一個圖形都叫一次，不只清單裡那四個 —— 換清單時才不會漏。 */
        figIds.forEach(id => { if (FIG_SIDES[id] > 0){ push(d.p2End(FIG_SIDES[id], id)); push(d.p3End(FIG_SIDES[id])); } });
        data.TABLE_ROWS.forEach(row => {
          push(d.tabChip(row.key));
          push(d.t1(row.key, row.sides)); push(d.t2(row.key, row.sides)); push(d.t3(row.key, row.sides));
        });
        data.BASKETS.forEach(k => push(d.gOpt(k)));
        sideCounts.forEach(n => {
          push(d.gHint2(n));
          data.BASKETS.forEach(k => push(d.gWhy(n, k)));
        });
        [d.p2Start, d.p3Start, d.t0, d.gAsk, d.gHint1].forEach(push);
        const flat = t => String(t).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
        strings.concat(candidates).forEach(t => {
          if (asksCircleSides(flat(t), L)){
            fail(`${L}: a page string asks how many sides a circle has — that has no unique answer ("${flat(t).trim().slice(0, 46)}")`);
          }
        });
        /* 正面宣稱「圓有…」，即使寫的是中文數字或英文數字，也要擋下來 ——
           只掃阿拉伯數字的話，「圓有一個頂點」會整句溜過去。 */
        strings.forEach(t => {
          if (CIRCLE_HAS[L].test(flat(t))){
            fail(`${L}: the lesson asserts that a circle HAS sides/corners/angles ("${flat(t).trim().slice(0, 46)}")`);
          }
        });
      });

      /* --- 三層題庫的神諭表 ---
         每一題記四件事，都跟題目本身分開維護：
         - nums：題幹裡「一定要出現、而且只能出現」的數字（中英各驗一次）。
         - rel：從 nums 或從圖形把答案「算出來」的方式，不是抄答案。
         - correct：標為正解的那一個字串。
         - optsAll：四個選項的完整清單。**改動任何一個選項都必須回來這裡改一次** ——
           這一欄就是「我逐一驗過其他三個都是假的」的簽名。這一課最貴的缺陷
           （正方形被排除在四邊形之外）只有這種逐字清單擋得住：光看正解對不對，
           多一個「長方形也是四邊形」的選項照樣是綠的。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[], fig:'penta', rel:'figSides',
            zh:'5 條邊', en:'5 sides',
            optsZh:['3 條邊','4 條邊','5 條邊','6 條邊'],
            optsEn:['3 sides','4 sides','5 sides','6 sides'] },
          { nums:[], fig:'wonky', rel:'figVerts',
            zh:'4 個頂點', en:'4 corners',
            optsZh:['3 個頂點','5 個頂點','6 個頂點','4 個頂點'],
            optsEn:['3 corners','5 corners','6 corners','4 corners'] },
          { nums:[], rel:'triDef',
            zh:'3 條邊、3 個頂點', en:'3 sides and 3 corners',
            optsZh:['3 條邊、3 個頂點','3 條邊、4 個頂點','4 條邊、3 個頂點','4 條邊、4 個頂點'],
            optsEn:['3 sides and 3 corners','3 sides and 4 corners','4 sides and 3 corners','4 sides and 4 corners'] },
          { nums:[], rel:'nameCircle',
            zh:'圓', en:'a circle',
            optsZh:['三角形','圓','正方形','長方形'],
            optsEn:['a triangle','a circle','a square','a rectangle'] },
          { nums:[], rel:'quadDef',
            zh:'4 條邊', en:'4 sides',
            optsZh:['3 條邊','2 條邊','4 條邊','5 條邊'],
            optsEn:['3 sides','2 sides','4 sides','5 sides'] },
          { nums:[], rel:'saying',
            zh:'正方形是四邊形', en:'A square is a quadrilateral',
            optsZh:['三角形有 4 個頂點','圓有 3 個頂點','四邊形有 3 條邊','正方形是四邊形'],
            optsEn:['A triangle has 4 corners','A circle has 3 corners','A quadrilateral has 3 sides','A square is a quadrilateral'] }
        ],
        qsAdv: [
          { nums:[3,4], rel:'sum',
            zh:'7 條邊', en:'7 sides',
            optsZh:['6 條邊','7 條邊','8 條邊','12 條邊'],
            optsEn:['6 sides','7 sides','8 sides','12 sides'] },
          { nums:[12,3], rel:'quot',
            zh:'4 個', en:'4 triangles',
            optsZh:['4 個','3 個','9 個','6 個'],
            optsEn:['4 triangles','3 triangles','9 triangles','6 triangles'] },
          { nums:[5], rel:'same',
            zh:'5 條邊', en:'5 sides',
            optsZh:['4 條邊','6 條邊','5 條邊','10 條邊'],
            optsEn:['4 sides','6 sides','5 sides','10 sides'] },
          { nums:[], rel:'saying',
            /* 逐一驗過：4 條直的邊圍一圈是四邊形；歪斜不等長的是四邊形；
               4 邊等長的（菱形／正方形）也是四邊形 —— 只有 3 條邊的一定不是。 */
            zh:'3 條直的邊圍成一圈的圖形', en:'a shape made of 3 straight sides in a loop',
            optsZh:['4 條直的邊圍成一圈的圖形','歪歪斜斜、4 條邊不一樣長的圖形','4 條邊一樣長的圖形','3 條直的邊圍成一圈的圖形'],
            optsEn:['a shape made of 4 straight sides in a loop','a wonky shape whose 4 sides are all different lengths','a shape whose 4 sides are all the same length','a shape made of 3 straight sides in a loop'] }
        ],
        qsBoost: [
          { nums:[], rel:'saying',
            zh:'是，它有 4 條直的邊、4 個頂點', en:'Yes — it has 4 straight sides and 4 corners',
            optsZh:['不是，正方形和四邊形不一樣','是，它有 4 條直的邊、4 個頂點','不是，四邊形的邊不能一樣長','不是，四邊形只有 3 條邊'],
            optsEn:['No — a square and a quadrilateral are different things','Yes — it has 4 straight sides and 4 corners','No — a quadrilateral’s sides cannot all be equal','No — a quadrilateral has only 3 sides'] },
          { nums:[], rel:'saying',
            zh:'圓沒有直的邊，也沒有頂點', en:'A circle has no straight sides and no corners',
            optsZh:['圓沒有直的邊，也沒有頂點','圓有 4 個頂點','圓有 3 條直的邊','圓有 1 個頂點'],
            optsEn:['A circle has no straight sides and no corners','A circle has 4 corners','A circle has 3 straight sides','A circle has 1 corner'] }
        ]
      };
      /* 答案是算出來的，不是抄的。 */
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      const recompute = (o) => {
        if (o.rel === 'figSides' || o.rel === 'figVerts') return FIG_SIDES[o.fig];
        if (o.rel === 'triDef') return 3;
        if (o.rel === 'quadDef') return 4;
        if (o.rel === 'sum') return o.nums[0] + o.nums[1];
        if (o.rel === 'quot') return o.nums[0] / o.nums[1];
        if (o.rel === 'same') return o.nums[0];
        return null;   /* nameCircle / saying 沒有數字可以重算 */
      };
      /* 選項裡的數字上限：最大的是 qsAdv[0] 的「3 × 4 ＝ 12」那個錯運算誘答。 */
      const OPT_MIN = 1, OPT_MAX = 12;
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次長度。只比中文的話，刪掉最後一題英文題目時中文長度還是對的，
           而英文那一圈 forEach 會少跑一題 —— 那一題和它的選項就整個沒被驗到。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            /* ans 先驗合法，否則 q.opts[q.ans] 會是 undefined，接下來的檢查
               都在比對 undefined —— 整題沒被驗到卻是綠的。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。
               這一條只看阿拉伯數字；圖形是用 SVG 畫的，SVG 標籤整段被剝掉，
               所以看圖的題目 nums 是空的，多塞一個數字進題幹就會被抓到。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            const stemNums = [...new Set((plain.match(/\d+/g) || []).map(Number))];
            stemNums.forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ') || 'none'})`);
              }
            });
            /* 2. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 3. 神諭寫下的字串本身要能重算出來（圖形題從座標數、算術題從 nums 算）。 */
            const v = recompute(o);
            if (v !== null){
              if (!Number.isInteger(v)){
                fail(`${bank}[${i}]: ${o.nums.join(' / ')} does not give a whole-number answer`);
              } else if (!hasNum(want, v)){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain ${v}, recomputed from ${o.rel}`);
              }
              /* 三角形那一題要同時說出邊數與頂點數，所以那個 3 要出現兩次。 */
              if (o.rel === 'triDef' && (want.split('3').length - 1) < 2){
                fail(`${bank}[${i}] ${L}: "${want}" should give both the side count and the corner count`);
              }
            } else if (o.rel === 'nameCircle'){
              /* 上課頁的選項是名詞片語，英文帶冠詞；fName() 是同一套規則。 */
              if (want !== fName('circle', L)){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not the circle's name`);
              }
            }
            /* 4. 四個選項的完整清單要逐字對上（順序不計）。改任何一個選項都要回設定檔
               重新宣告一次 —— 這一欄就是「其他三個我驗過都是假的」的簽名。 */
            const wantOpts = (L === 'zh' ? o.optsZh : o.optsEn).slice().sort();
            const gotOpts = q.opts.slice().sort();
            /* 長度要先比。只比對接起來的字串的話，三個選項裡有一個含分隔符
               就會和四個選項序列化成同一串（codex 第二輪抓到）。 */
            if (wantOpts.length !== gotOpts.length){
              fail(`${bank}[${i}] ${L}: ${gotOpts.length} options but the checker records ${wantOpts.length}`);
            } else if (wantOpts.some((w, k) => w !== gotOpts[k])){
              fail(`${bank}[${i}] ${L}: the option list does not match the checker\n      got:  ${gotOpts.join(' | ')}\n      want: ${wantOpts.join(' | ')}`);
            }
            if (wantOpts.indexOf(want) < 0){
              fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not in the recorded option list`);
            }
            /* 5. 每一個選項的數字都要落在這一課的範圍裡，誘答也要驗。 */
            q.opts.forEach(opt => {
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= OPT_MIN && x <= OPT_MAX)){
                  fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside ${OPT_MIN}~${OPT_MAX}`);
                }
              });
            });
            /* 6. 選項字串兩兩不同（含空白正規化的版本）。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
              }
            }
            /* 7. 這一課絕對不可以問「圓有幾個邊」—— 各家講法不同，沒有唯一答案。
               中文的問法變化多（「圓有幾條邊」「圓的邊有幾條」「圓形有幾個邊」都要抓），
               而且題幹、解釋、選項三個地方都要掃：只掃題幹的話，把那句話搬到 why
               就會靜靜地溜過去。 */
            [plain, String(q.why).replace(/<[^>]+>/g, ' ')].forEach(text => {
              if (asksCircleSides(text, L)){
                fail(`${bank}[${i}] ${L}: never ask how many sides a circle has — the answer is not unique ("${text.trim().slice(0, 40)}")`);
              }
            });
            /* 選項只擋「問句」，不擋「圓有 3 條直的邊」這種刻意的錯誤敘述 ——
               qsBoost 就是要孩子把它認出來是錯的。 */
            q.opts.map(String).forEach(text => {
              if (asksCircleSides(text, L)){
                fail(`${bank}[${i}] ${L}: an option asks how many sides a circle has ("${text.trim().slice(0, 40)}")`);
              }
            });
          });
        });
      });
    }
  }
};
