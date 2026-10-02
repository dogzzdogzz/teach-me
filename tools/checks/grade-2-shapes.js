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

/* ---------- 小遊戲「圖形分類大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   圍一圈（吸管是邊、黏土球是頂點）、繞一圈（從一個頂點出發數邊）、黏頂點（轉彎才是頂點）、
   分家族（三角形／四邊形／圓）、找四邊形（4 條直的邊、圍一圈、不交叉）。做法照 grade-2-two-step.js／grade-2-length.js：
   - 每一關「收不收」的規則都是頁面資料區的純函式（loopRule／loopDone／walkStep／isTurn／clayDrop／clayLeft／familyOf／findWhy），
     這裡拿**每一題、每一種動作**去呼叫，結果和設定檔自己的第二套規則比，證明一定解得完、而且只有對的做法收得進去；
   - 那句說明說的事要成立：「穿過中間會交叉」→ 把 n 顆球每一種圍法都列出來，不交叉的只有沿著外面那一種；
     「直直接下去的算同一條邊」→ 自己數一數直線段，真的是 n 條；
   - nearestOpen()／nearestSeg()／roundSolved()／roundMiss()／shuffle() 從原始碼切出來**真的跑**；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯）與單複數；
   - 版面與觸控 ≥ 44px 從 index.html 的常數與 CSS 讀（不在這裡另抄一份數字）。
   已知極限：RENDER 函式本體（畫面那一層）只用 need() 字面掃描守住「它呼叫了哪一個規則、拿回來的結果怎麼用」；
   拖拉、點選、兩根手指、capture 遺失、畫板不跳動、375px 的實際尺寸由
   teaching-workspace/game-harness/g2-shapes 的端對端測試驗。 */
const { extractFunction } = require('./lib/gameshuffle.js');

function gameCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const has = (where, text, re) => { if (!re.test(String(text))) fail(where + ': should say ' + re + ' — ' + text); };
  const hasNot = (where, text, re) => { if (re.test(String(text))) fail(where + ': must not say ' + re + ' — ' + text); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const inside = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board (' + JSON.stringify(o) + ')'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const grow = (R, p) => ({ x:R.x - p, y:R.y - p, w:R.w + 2 * p, h:R.h + 2 * p });
  const W = D.GAME_W, PAD = D.GPAD;
  const name = (k, L) => NAME_TRUTH[k][L];
  /* 自己的「邊數 → 名字」那一句（不讀頁面）：3 三角形、4 四邊形、其他「比 4 條多，都不是」 */
  const tailOk = (where, text, n, L) => {
    if (n === 3) has(where, text, L === 'zh' ? /三角形/ : /\btriangle\b/);
    else if (n === 4) has(where, text, L === 'zh' ? /四邊形/ : /\bquadrilateral\b/);
    else has(where, text, L === 'zh' ? /比 4 條多，不是三角形也不是四邊形/ : /more than 4, so it is neither a triangle nor a quadrilateral/);
  };
  const plural = (where, text, n, sing, plur) => {
    const re = new RegExp('(?<![0-9])' + n + ' (' + sing + '|' + plur + ')\\b');
    const m = String(text).match(re);
    if (!m) return fail(where + ': cannot find "' + n + ' ' + sing + '/' + plur + '" in "' + text + '"');
    if ((n === 1) !== (m[1] === sing)) fail(where + ': "' + n + ' ' + m[1] + '" — singular/plural is wrong');
  };
  const vec = (a, b) => [b[0] - a[0], b[1] - a[1]];
  const crs = (u, v) => u[0] * v[1] - u[1] * v[0];
  /* 自己的「兩條線段真的交叉」（端點相碰不算） */
  const properCross = (p1, p2, p3, p4) => {
    const o = (a, b, c) => crs(vec(a, b), vec(a, c));
    return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
  };
  const polySimple = p => {
    const n = p.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (properCross(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return false;
    }
    return true;
  };

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['loop', 'walk', 'clay', 'sort', 'find'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = nm => (src.match(new RegExp('\\n {4}' + nm + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
      if (/\d/.test((I18N[L].gHints || {})[t] || '') && t !== 'sort' && t !== 'find') fail('gHints.' + t + ' ' + L + ' gives a number away at level 1');
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
    if (!/glow\(/.test(B[t])) fail(t + ': the second-level hint does not make the next target glow (glow())');
    if (!/\broundSolved\(/.test(B[t].replace(/\/\*[\s\S]*?\*\//g, ''))) fail(t + ': the round never calls roundSolved()');
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 第 5 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外）；其他四關要寫出「先點、再點」 */
  if (!/這一關用點的/.test(I18N.zh.gAsks.find) || !/all taps/.test(I18N.en.gAsks.find)) fail('find: the round has no drag — its instructions must say it is all taps');
  ['loop', 'walk', 'clay', 'sort'].forEach(t => {
    if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way');
  });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(extractFunction(src, 'startRound') || '')) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;(?:\s*\/\*[\s\S]*?\*\/)*\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); return; \}/.test(src))
    fail('a piece that was tapped and then dragged stays selected — a later tap would drop it again');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/el\.addEventListener\('pointermove', function\(e\)\{\s*if \(!start \|\| e\.pointerId !== pid\) return;/.test(src)) fail('a move from another finger drags the piece (first pointer only)');
  if (!/function end\(e, cancelled\)\{\s*if \(!start \|\| e\.pointerId !== pid\) return;/.test(src)) fail('a release from another finger ends the drag (first pointer only)');
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src) || !/gCtx = \{\}; gGen\+\+;/.test(extractFunction(src, 'startRound') || ''))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');
  if (/\bmouse(down|up|move)\b|\btouch(start|end|move)\b/.test(src)) fail('the game must use pointer events only (found mouse/touch listeners)');

  /* --- 觸控：375px 手機上畫板能用的寬度從頁面的 CSS 算（.wrap 左右 padding、.card 的 padding 與邊框、.gstage 左右 padding） --- */
  const cssPx = (sel, re) => { const m = src.match(new RegExp('\\n\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); const v = m && m[1].match(re); return v ? v.slice(1).map(Number) : null; };
  const wrapPad = cssPx('.wrap', /padding:(\d+)px (\d+)px/), cardPad = cssPx('.card', /padding:(\d+)px/), cardBorder = cssPx('.card', /border:(\d+)px/), stagePad = cssPx('.gstage', /padding:\s*(\d+)px (\d+)/);
  if (!wrapPad || !cardPad || !cardBorder || !stagePad) fail('touch: cannot read .wrap / .card / .gstage padding from the CSS');
  const avail = 375 - 2 * ((wrapPad || [0, 0])[1] + (cardPad || [0])[0] + (cardBorder || [0])[0] + (stagePad || [0, 0])[1]);
  const scale = Math.min(1.5, avail / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK (the ant)', D.GPICK);
  small('the straw (' + D.LOOP_SRC.w + '×' + D.LOOP_SRC.h + ')', Math.min(D.LOOP_SRC.w, D.LOOP_SRC.h));
  small('the clay', D.CLAY_SRC.size);
  small('a shape card (' + D.SORT_CARD.w + '×' + D.SORT_CARD.h + ')', Math.min(D.SORT_CARD.w, D.SORT_CARD.h));
  small('a find-the-quadrilateral shape', D.FIND_CELL.size);
  small('a basket', Math.min(D.SORT_BIN.w, D.SORT_BIN.h));
  [D.LOOP_SRC.w, D.LOOP_SRC.h, D.CLAY_SRC.size, D.SORT_CARD.w, D.SORT_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece side of ' + s + ' is smaller than GPICK ' + D.GPICK); });
  { const m = src.match(/\.btn\{[^}]*min-height:(\d+)px/); if (!m || +m[1] < 46) fail('loop: the Loop-done button (.btn) is not at least 46px tall'); }
  need('loop', /addPiece\(B, \{ w:LOOP_SRC\.w, h:LOOP_SRC\.h, cx:GAME_W \/ 2, cy:LOOP_SRC\.y, cls:'gstrawsrc'/, 'the straw is not LOOP_SRC.w × LOOP_SRC.h at (GAME_W / 2, LOOP_SRC.y)');
  need('walk', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:s0\[0\], cy:s0\[1\], text:'🐜'/, 'the ant is not GPICK × GPICK on the ★ corner');
  need('clay', /addPiece\(B, \{ w:CLAY_SRC\.size, h:CLAY_SRC\.size, cx:GAME_W \/ 2, cy:CLAY_SRC\.y, cls:'gclaysrc'/, 'the clay is not CLAY_SRC.size at (GAME_W / 2, CLAY_SRC.y)');
  need('sort', /addPiece\(B, \{ w:C\.w, h:C\.h, cx:C\.xs\[c % 3\], cy:C\.ys\[Math\.floor\(c \/ 3\)\], html:figSVG\(ids\[i\]\)/, 'the cards are not SORT_CARD.w × h on the SORT_CARD grid, drawn with figSVG');
  need('find', /b\.style\.left = \(F\.xs\[c % 3\] - F\.size \/ 2\) \+ 'px'; b\.style\.top = \(F\.ys\[Math\.floor\(c \/ 3\)\] - F\.size \/ 2\) \+ 'px';\s*b\.style\.width = b\.style\.height = F\.size \+ 'px';/, 'the shapes are not FIND_CELL.size on the FIND_CELL grid');

  /* --- 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = 0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = {}, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves) => new Function(env.replace('S0', s0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
      } catch (e){ fail('stars: roundSolved()/roundMiss() could not run: ' + e.message); }
    }
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    seq('gStars ' + L, d.gStars(2), [2]);
    seq('gStars ' + L, d.gStars(1), [1]);
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' missing or has a number in it');
  });

  /* --- shuffle()：從原始碼切出來真的跑。「一定洗回原樣」的假亂數也不可以照資料的順序排（第 4 關三角形永遠排最前面）；
     真亂數 2000 次一定是原陣列的排列 --- */
  let shuffle = null;
  {
    const f = extractFunction(src, 'shuffle');
    if (!f) fail('cannot find shuffle() in index.html');
    else {
      try {
        const mk = rnd => new Function('Math', f + '\nreturn shuffle;')(Object.assign(Object.create(Math), { random:rnd }));
        const same = mk(() => 0.999999), real = mk(Math.random.bind(Math));
        [2, 3, 6, 9].forEach(n => {
          const a = Array.from({ length:n }, (_, i) => i), r = same(a);
          if (r.every((v, i) => v === i)) fail('shuffle(): an rng that never moves anything leaves ' + n + ' items in data order — the tray would start in the answer order');
          if (r.slice().sort((x, y) => x - y).join() !== a.join()) fail('shuffle(): the result is not a permutation');
        });
        for (let t = 0; t < 2000; t++){
          const a = [0, 1, 2, 3, 4, 5], r = real(a);
          if (r.slice().sort().join() !== a.join() || r.join() === a.join()) { fail('shuffle(): bad result ' + r.join()); break; }
        }
        shuffle = real;
      } catch (e){ fail('shuffle() could not run: ' + e.message); }
    }
  }
  need('sort', /shuffle\(order\(ids\.length\)\)\.forEach\(function\(i, c\)\{/, 'the cards are not dealt in shuffled order');
  need('find', /shuffle\(order\(items\.length\)\)\.forEach\(function\(i, c\)\{/, 'the shapes are not laid out in shuffled order');
  if (!/function pickN\(arr, n\)\{ return shuffle\(arr\)\.slice\(0, n\); \}/.test(src)) fail('pickN() does not draw from a shuffled pool');

  /* --- nearestOpen()／nearestSeg()：從原始碼切出來真的跑 --- */
  let nearestOpen = null, nearestSeg = null;
  {
    const f1 = extractFunction(src, 'nearestOpen'), f2 = extractFunction(src, 'nearestSeg');
    if (!f1) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(f1 + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
    if (!f2) fail('cannot find nearestSeg() in index.html');
    else { try { nearestSeg = new Function('SEG_END', f2 + '\nreturn nearestSeg;')(D.SEG_END); } catch (e){ fail('nearestSeg() could not be evaluated: ' + e.message); } }
  }
  /* 自己的「最近的方框」：到方框的距離（框裡是 0），一樣近比到中心；最近的那一個已經放好就不收 */
  const ownNearestBox = (list, pt, pad) => {
    let best = null, bd = Infinity, bc = Infinity;
    list.forEach(b => {
      const dx = pt.x - b.cx, dy = pt.y - b.cy;
      if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return;
      const ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh), dd = Math.hypot(ex, ey), dc = Math.hypot(dx, dy);
      if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
    });
    return best && !best.done ? best : null;
  };
  const sweepBoxes = (list, H, what, step) => {
    if (!nearestOpen) return;
    let bad = 0, first = '';
    for (let x = -4; x <= W + 4; x += step) for (let y = -4; y <= H + 4; y += step){
      const a = nearestOpen(list, { x, y }, PAD), b = ownNearestBox(list, { x, y }, PAD);
      if (a !== b){ bad++; if (!first) first = '(' + x + ',' + y + ')'; }
    }
    if (bad) fail(what + ': nearestOpen() disagrees with the nearest-box rule at ' + bad + ' points, first ' + first);
  };

  /* --- 每一個池子裡不可以有重複的題目（重複的話 pickN() 會發出兩張一樣的卡；codex 第一輪） --- */
  [['GAME_LOOP', D.GAME_LOOP], ['GAME_WALK', D.GAME_WALK], ['SORT_TRI', D.SORT_TRI], ['SORT_QUAD', D.SORT_QUAD], ['FIND_QUAD', D.FIND_QUAD], ['FIND_OTHER', D.FIND_OTHER],
   ['GAME_CLAY', D.GAME_CLAY.map(e => JSON.stringify(e.pts))]].forEach(([nm, list]) => {
    if (new Set(list).size !== list.length) fail(nm + ' has a repeated entry: ' + list.join(' | '));
  });
  if (new Set(D.SORT_TRI.concat(D.SORT_QUAD, ['square', 'circle'])).size !== D.SORT_TRI.length + D.SORT_QUAD.length + 2) fail('sort: a card is in two pools');
  if (new Set(D.FIND_QUAD.concat(D.FIND_OTHER, ['square'])).size !== D.FIND_QUAD.length + D.FIND_OTHER.length + 1) fail('find: a shape is in two pools');

  /* ================= 第 1 關：圍一圈（範例 1：吸管是邊、黏土球是頂點） ================= */
  {
    const F = D.LOOP_FIG, H = D.LOOP_H;
    const S = D.LOOP_SRC, srcBox = box(W / 2, S.y, S.w, S.h);
    inside(srcBox, 'loop: the straw', W, H);
    if (!(D.SEG_END > 0.1 && D.SEG_END < 0.4)) fail('loop: SEG_END ' + D.SEG_END + ' — a drop on a clay ball must be silent and the middle of a straw must count');
    need('loop', /var id = pick\(GAME_LOOP\), n = FIGS\[id\]\.pts\.length, k = 0;/, 'the round is not one of GAME_LOOP with n = its corner count');
    need('loop', /var p = figXY\(id, i, LOOP_FIG\);\s*balls\.push\(addZone\(B, p\[0\] - LOOP_BALL \/ 2, p\[1\] - LOOP_BALL \/ 2, LOOP_BALL, LOOP_BALL, 'gball'\)\);/, 'the clay balls are not drawn at figXY(id, i, LOOP_FIG)');
    need('loop', /var segs = loopSegs\(id\), balls = \[\];/, 'the drop targets are not loopSegs(id)');
    need('loop', /var s = nearestSeg\(segs, pt, LOOP_PAD\), r = loopRule\(s\);\s*if \(r === 'none'\) return false;\s*if \(r === 'cross'\)\{ roundMiss\(d\.gLoopCross\); return false; \}\s*s\.done = true; k\+\+;/, 'a straw is not judged by nearestSeg() + loopRule() (silent / cross-with-a-reason / put)');
    need('loop', /return svgLine\(\[s\.ax, s\.ay\], \[s\.bx, s\.by\], '#E8871E', 9, ' class="gstraw"'\);/, 'a placed straw is not drawn from ball centre to ball centre');
    need('loop', /var r = loopDone\(n, k\);\s*if \(r === 'empty'\)\{ gMsg\.textContent = d\.gLoopEmpty; return; \}\s*if \(r === 'gap'\)\{ roundMiss\(d\.gLoopGap\(n - k\)\); return; \}\s*doneBtn\.disabled = true;\s*roundSolved\(d\.gLoopDone\(n\)\);/, '"Loop done" is not judged by loopDone() (empty = reminder, gap = mistake with the gap count, ok = solved)');
    need('loop', /P\.home\(\);\s*line\.textContent = d\.gLoopNow\(k\);/, 'the straw does not go back to its place after a drop (it must never run out)');
    if (D.GAME_LOOP.length < 3) fail('loop: GAME_LOOP needs at least 3 figures');
    D.GAME_LOOP.forEach(id => {
      let anyOverlap = false;
      const f = D.FIGS[id];
      if (!f || f.kind === 'circle' || !(f.pts.length >= 4 && f.pts.length <= 5)){ fail('loop: GAME_LOOP figure ' + id + ' must have 4 or 5 corners (a triangle has no wrong straw to block)'); return; }
      const n = f.pts.length, P = f.pts.map(q => [F.x + q[0] * F.s, F.y + q[1] * F.s]);
      P.forEach((p, i) => {
        const xy = D.figXY(id, i, F);
        if (Math.abs(xy[0] - p[0]) > 1e-9 || Math.abs(xy[1] - p[1]) > 1e-9) fail('loop ' + id + ': figXY(' + i + ') is ' + xy + ', should be ' + p);
        inside(box(p[0], p[1], D.LOOP_BALL, D.LOOP_BALL), 'loop ' + id + ': clay ball ' + i, W, H);
        if (hit(box(p[0], p[1], D.LOOP_BALL, D.LOOP_BALL), grow(srcBox, 4))) fail('loop ' + id + ': clay ball ' + i + ' touches the straw');
      });
      noHits(P.map(p => box(p[0], p[1], D.LOOP_BALL + 20, D.LOOP_BALL + 20)), 'loop ' + id + ': clay balls');
      /* 凸的：每三個相鄰的頂點都往同一邊轉 */
      const turns = P.map((p, i) => crs(vec(P[(i + n - 1) % n], p), vec(p, P[(i + 1) % n])));
      if (!(turns.every(t => t > 0) || turns.every(t => t < 0))) fail('loop ' + id + ': the balls are not in convex position — "next to each other" would not decide the loop');
      /* 說明「穿過中間會交叉」與「只有沿著外面圍一圈」：把 n 顆球的每一種圍法（哈密頓迴圈）列出來 */
      const perms = [], rest = Array.from({ length:n - 1 }, (_, i) => i + 1);
      const permute = (a, k) => { if (k === a.length){ if (a[0] < a[a.length - 1]) perms.push([0].concat(a)); return; } for (let i = k; i < a.length; i++){ [a[k], a[i]] = [a[i], a[k]]; permute(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
      permute(rest.slice(), 0);
      const good = perms.filter(cyc => polySimple(cyc.map(v => P[v])));
      const isBoundary = cyc => cyc.every((v, i) => { const w = cyc[(i + 1) % n], d = (w - v + n) % n; return d === 1 || d === n - 1; });
      if (good.length !== 1 || !isBoundary(good[0])) fail('loop ' + id + ': ' + good.length + ' non-crossing loops through the balls — the only one must go round the outside');
      perms.filter(c => !isBoundary(c)).forEach(c => { if (polySimple(c.map(v => P[v]))) fail('loop ' + id + ': the loop ' + c.join('-') + ' uses a diagonal and does not cross — gLoopCross would be false'); });
      /* loopSegs()：每兩顆球一條，邊 n 條、對角線 n(n−3)/2 條，對角線排在前面 */
      const segs = D.loopSegs(id);
      const nd = n * (n - 3) / 2;
      if (segs.length !== n + nd) fail('loop ' + id + ': loopSegs() has ' + segs.length + ' lines, should be ' + (n + nd));
      segs.forEach((s, k) => {
        const d = (s.j - s.i + n) % n, edge = d === 1 || d === n - 1;
        if (s.edge !== edge) fail('loop ' + id + ': ' + s.i + '-' + s.j + ' is marked edge=' + s.edge + ', should be ' + edge);
        if (Math.hypot(s.ax - P[s.i][0], s.ay - P[s.i][1]) > 1e-9 || Math.hypot(s.bx - P[s.j][0], s.by - P[s.j][1]) > 1e-9) fail('loop ' + id + ': line ' + s.i + '-' + s.j + ' does not join the two ball centres');
        if ((k < nd) !== !edge) fail('loop ' + id + ': the diagonals are not listed before the edges (the e2e overlap test relies on it)');
        if (s.done) fail('loop ' + id + ': a line starts as already done');
        if (D.loopRule(s) !== (edge ? 'put' : 'cross')) fail('loop ' + id + ': loopRule(' + s.i + '-' + s.j + ') is ' + D.loopRule(s));
      });
      if (D.loopRule(null) !== 'none') fail('loop: loopRule(null) must be none (silent)');
      for (let k = 0; k <= n; k++){ const want = k === 0 ? 'empty' : (k < n ? 'gap' : 'ok'); if (D.loopDone(n, k) !== want) fail('loop ' + id + ': loopDone(' + n + ', ' + k + ') is ' + D.loopDone(n, k) + ', should be ' + want); }
      /* nearestSeg()：畫板上每 1px 一點，和自己的規則比；兩條線一樣近時，頁面挑先列的那一條（同樣是那一種線就不影響結果） */
      if (nearestSeg){
        const own = (list, pt) => {
          let best = null, bd = Infinity;
          list.forEach(s => {
            const vx = s.bx - s.ax, vy = s.by - s.ay, t = ((pt.x - s.ax) * vx + (pt.y - s.ay) * vy) / (vx * vx + vy * vy);
            if (t < D.SEG_END || t > 1 - D.SEG_END) return;
            const dd = Math.hypot(s.ax + t * vx - pt.x, s.ay + t * vy - pt.y);
            if (dd <= D.LOOP_PAD && dd < bd){ bd = dd; best = s; }
          });
          return best && !best.done ? best : null;
        };
        const ownAll = (list, pt) => list.filter(s => {
          const vx = s.bx - s.ax, vy = s.by - s.ay, t = ((pt.x - s.ax) * vx + (pt.y - s.ay) * vy) / (vx * vx + vy * vy);
          return t >= D.SEG_END && t <= 1 - D.SEG_END && Math.hypot(s.ax + t * vx - pt.x, s.ay + t * vy - pt.y) <= D.LOOP_PAD;
        });
        [[], [segs.length - 1], segs.map((_, k) => k).filter(k => segs[k].edge && k % 2)].forEach(doneSet => {
          const L2 = segs.map((s, k) => Object.assign({}, s, { done:doneSet.indexOf(k) >= 0 }));
          let bad = 0, first = '';
          for (let x = 0; x <= W; x += 1) for (let y = 0; y <= H; y += 1){
            const a = nearestSeg(L2, { x, y }, D.LOOP_PAD), b = own(L2, { x, y });
            if ((a && a.i + '-' + a.j) !== (b && b.i + '-' + b.j)){ bad++; if (!first) first = '(' + x + ',' + y + ')'; }
            if (!doneSet.length && !anyOverlap){
              const all = ownAll(L2, { x, y });
              if (all.some(s => s.edge) && all.some(s => !s.edge)) anyOverlap = true;
            }
          }
          if (bad) fail('loop ' + id + ': nearestSeg() disagrees with the nearest-line rule at ' + bad + ' points (done ' + doneSet.join(',') + '), first ' + first);
        });
        /* 吸管放回原位（沒有拖到哪裡）一定是靜靜的 */
        if (nearestSeg(segs, { x:W / 2, y:S.y }, D.LOOP_PAD)) fail('loop ' + id + ': the straw\'s own place is inside a drop zone — putting it back would place a straw');
        /* 每一顆球的正上方：分不出要接哪兩顆，一定是靜靜的 */
        P.forEach((p, i) => { if (nearestSeg(segs, { x:p[0], y:p[1] }, D.LOOP_PAD)) fail('loop ' + id + ': a drop right on clay ball ' + i + ' places a straw'); });
        if (!anyOverlap) fail('loop ' + id + ': no point is within reach of both a diagonal and an edge — the nearest-line rule is never exercised (the e2e overlap test needs one)');
      }
      /* 照遊戲的規則玩一遍：先試每一條對角線（都彈回），再照任意順序放邊；放完 n 條才 ok */
      const put = {};
      let k = 0;
      segs.forEach(s => { if (!s.edge && D.loopRule(s) !== 'cross') fail('loop ' + id + ': diagonal accepted'); });
      segs.filter(s => s.edge).reverse().forEach(s => {
        if (D.loopDone(n, k) === 'ok') fail('loop ' + id + ': "Loop done" is accepted with only ' + k + ' straws');
        if (put[s.i + '-' + s.j]) fail('loop ' + id + ': the same edge twice'); put[s.i + '-' + s.j] = true; k++;
      });
      if (k !== n || D.loopDone(n, k) !== 'ok') fail('loop ' + id + ': ' + n + ' edges do not close the loop');
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      [d.gLoopCross, d.gLoopEmpty, d.gLoopBtn, d.gStrawLabel].forEach((t, i) => { if (typeof t !== 'string' || !t || /\d/.test(t)) fail('loop ' + L + ': string ' + i + ' missing or has a number: ' + t); });
      has('loop ' + L + ' gLoopCross', d.gLoopCross, L === 'zh' ? /交叉/ : /cross/);
      for (let n = 3; n <= 6; n++){
        seq('loop ' + L + ' gLoopDone(' + n + ')', d.gLoopDone(n), [n, n, n].concat(n > 4 ? [4] : []));
        tailOk('loop ' + L + ' gLoopDone(' + n + ')', d.gLoopDone(n), n, L);
        for (let k = 0; k <= n; k++){
          seq('loop ' + L + ' gLoopNow(' + k + ')', d.gLoopNow(k), [k]);
          if (L === 'en') plural('loop en gLoopNow(' + k + ')', d.gLoopNow(k), k, 'straw', 'straws');
        }
        for (let g = 1; g < n; g++){
          seq('loop ' + L + ' gLoopGap(' + g + ')', d.gLoopGap(g), [g]);
          seq('loop ' + L + ' gLoop2(' + g + ')', d.gLoop2(g), [g]);
          if (L === 'en'){ plural('loop en gLoopGap(' + g + ')', d.gLoopGap(g), g, 'gap', 'gaps'); plural('loop en gLoop2(' + g + ')', d.gLoop2(g), g, 'gap', 'gaps'); has('loop en gLoopGap', d.gLoopGap(g), g === 1 ? /there is still 1 gap/ : /there are still \d+ gaps/); }
        }
      }
      if (typeof d.gLoopReady !== 'string' || /\d/.test(d.gLoopReady) || d.gLoopReady.indexOf(d.gLoopBtn) < 0) fail('loop ' + L + ': gLoopReady (the hint once the loop is closed) must tell the child to press "' + d.gLoopBtn + '" and give no number: ' + d.gLoopReady);
      has('loop ' + L + ' gLoopDone(4)', d.gLoopDone(4), L === 'zh' ? /4 條邊、4 個頂點，一樣多/ : /4 sides and 4 corners — the same number of each/);
    });
  }

  /* ================= 第 2 關：繞一圈（範例 2：從一個頂點開始，繞一圈回到原點） ================= */
  {
    const F = D.WALK_FIG, H = D.WALK_H, G = D.GPICK, BG = D.WALK_BADGE;
    need('walk', /var id = pick\(GAME_WALK\), n = FIGS\[id\]\.pts\.length, path = \[WALK_STAR\];/, 'the walk does not start at WALK_STAR with n = the corner count');
    need('walk', /var corners = xy\.map\(function\(p, i\)\{ return target\(B, p\[0\] - GPICK \/ 2, p\[1\] - GPICK \/ 2, GPICK, GPICK, 'gcorner', \{ v:i \}\); \}\);/, 'the corner targets are not GPICK boxes on figXY(id, i, WALK_FIG)');
    need('walk', /var xy = order\(n\)\.map\(function\(i\)\{ return figXY\(id, i, WALK_FIG\); \}\);/, 'the corners are not figXY(id, i, WALK_FIG)');
    need('walk', /var c = nearestOpen\(corners, pt, GPAD\);\s*if \(!c\) return false;\s*var r = walkStep\(n, path, c\.v\);\s*if \(r === 'stay'\) return false;\s*if \(r === 'skip'\)\{ roundMiss\(d\.gWalkSkip\); return false; \}\s*if \(r === 'back'\)\{ roundMiss\(d\.gWalkBack\); return false; \}\s*path\.push\(c\.v\);/, 'a move is not judged by walkStep() (stay silent / skip and back with a reason / step)');
    need('walk', /if \(r === 'home'\)\{\s*P\.lock\(c\.cx, c\.cy\);\s*line\.textContent = d\.gWalkTotal\(n\);\s*roundSolved\(d\.gWalkDone\(n\)\);/, 'the walk is not solved exactly when walkStep() says home');
    need('walk', /P\.homeX = c\.cx; P\.homeY = c\.cy; P\.home\(\);/, 'the ant does not stay on the corner it walked to');
    need('walk', /out \+= svgLine\(a, b, '#E8871E', 8, ' class="gwalked"'\);/, 'a walked side is not drawn from corner to corner');
    if (!(D.WALK_STAR === 0)) fail('walk: WALK_STAR should be corner 0');
    D.GAME_WALK.forEach(id => {
      const f = D.FIGS[id];
      if (!f || f.kind === 'circle' || f.pts.length < 3){ fail('walk: GAME_WALK figure ' + id + ' must be a polygon'); return; }
      const n = f.pts.length, P = f.pts.map(q => [F.x + q[0] * F.s, F.y + q[1] * F.s]);
      P.forEach((p, i) => inside(box(p[0], p[1], G, G), 'walk ' + id + ': corner ' + i, W, H));
      noHits(P.map(p => grow(box(p[0], p[1], G, G), PAD)), 'walk ' + id + ': padded corner targets');
      const s0 = P[D.WALK_STAR], badge = box(s0[0] + BG.dx, s0[1] + BG.dy, BG.size, BG.size);
      inside(badge, 'walk ' + id + ': the ★ badge', W, H);
      P.forEach((p, i) => { if (i !== D.WALK_STAR && hit(badge, box(p[0], p[1], G, G))) fail('walk ' + id + ': the ★ badge sits on corner ' + i); });
      if (Math.hypot(BG.dx, BG.dy) > 45) fail('walk: the ★ badge is too far from its corner');
      if (!polySimple(P)) fail('walk ' + id + ': the drawn shape crosses itself');
      if (nearestOpen){
        const list = P.map((p, i) => ({ cx:p[0], cy:p[1], hw:G / 2, hh:G / 2, v:i, done:false }));
        sweepBoxes(list, H, 'walk ' + id, 1);
        let cx = 0, cy = 0; P.forEach(p => { cx += p[0] / n; cy += p[1] / n; });
        if (nearestOpen(list, { x:cx, y:cy }, PAD)) fail('walk ' + id + ': the middle of the shape is a corner target — "cut across the middle" could not be dropped on empty space');
      }
      /* 照遊戲的規則把每一條走法都走一遍（DFS，每一步試每一個頂點），和自己的規則比 */
      const ownStep = (path, to) => {
        const cur = path[path.length - 1];
        if (to === cur) return 'stay';
        const dd = (to - cur + n) % n;
        if (dd !== 1 && dd !== n - 1) return 'skip';
        for (let i = 1; i < path.length; i++){ const a = path[i - 1], b = path[i]; if ((a === cur && b === to) || (a === to && b === cur)) return 'back'; }
        return to === path[0] && path.length === n ? 'home' : 'step';
      };
      let homes = 0, states = 0, bad = 0;
      const dfs = path => {
        states++;
        if (states > 5000) return;
        for (let to = 0; to < n; to++){
          const before = path.join();
          const r = D.walkStep(n, path, to), w = ownStep(path, to);
          if (path.join() !== before) { fail('walk ' + id + ': walkStep() changed the path it was given'); return; }
          if (r !== w){ if (bad++ < 3) fail('walk ' + id + ': walkStep(' + path.join('>') + ' → ' + to + ') is ' + r + ', should be ' + w); continue; }
          if (r === 'home'){
            homes++;
            const done = path.concat([to]);
            const edges = new Set(); for (let i = 1; i < done.length; i++){ const a = done[i - 1], b = done[i]; edges.add(Math.min(a, b) + '-' + Math.max(a, b)); }
            if (done.length !== n + 1 || edges.size !== n) fail('walk ' + id + ': "home" after ' + (done.length - 1) + ' steps / ' + edges.size + ' sides — it must be exactly ' + n);
          } else if (r === 'step') dfs(path.concat([to]));
        }
      };
      dfs([D.WALK_STAR]);
      if (homes !== 2) fail('walk ' + id + ': ' + homes + ' ways to finish the walk — there must be exactly 2 (one each way round)');
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      [d.gWalkSkip, d.gWalkBack, d.gAntLabel].forEach((t, i) => { if (typeof t !== 'string' || !t || /\d/.test(t)) fail('walk ' + L + ': string ' + i + ' missing or has a number: ' + t); });
      has('walk ' + L + ' gWalkSkip', d.gWalkSkip, L === 'zh' ? /旁邊的頂點/ : /next to you/);
      has('walk ' + L + ' gWalkBack', d.gWalkBack, L === 'zh' ? /已經數過/ : /already counted/);
      seq('walk ' + L + ' gWalkNow(0)', d.gWalkNow(0), []);
      has('walk ' + L + ' gWalkNow(0)', d.gWalkNow(0), /★/);
      for (let n = 3; n <= 6; n++){
        seq('walk ' + L + ' gWalkDone(' + n + ')', d.gWalkDone(n), [n].concat(n > 4 ? [4] : []));
        tailOk('walk ' + L + ' gWalkDone(' + n + ')', d.gWalkDone(n), n, L);
        seq('walk ' + L + ' gWalkTotal(' + n + ')', d.gWalkTotal(n), [n]);
        for (let k = 1; k <= n; k++) seq('walk ' + L + ' gWalkNow(' + k + ')', d.gWalkNow(k), [k]);
        for (let r = 1; r <= n; r++){ seq('walk ' + L + ' gWalk2(' + r + ')', d.gWalk2(r), [r]); if (L === 'en') plural('walk en gWalk2(' + r + ')', d.gWalk2(r), r, 'side is', 'sides are'); }
      }
    });
  }

  /* ================= 第 3 關：黏頂點（範例 3 ＋ 速查卡「直直接下去不算轉彎，那兩段是同一條邊」） ================= */
  {
    const H = D.CLAY_H, J = D.CLAY_JOINT, srcBox = box(W / 2, D.CLAY_SRC.y, D.CLAY_SRC.size, D.CLAY_SRC.size);
    inside(srcBox, 'clay: the clay', W, H);
    need('clay', /var e = pick\(GAME_CLAY\), pts = e\.pts, m = pts\.length, filled = \{\}, k = 0;/, 'the round is not one of GAME_CLAY');
    need('clay', /var joints = pts\.map\(function\(p, j\)\{ return target\(B, p\[0\] - CLAY_JOINT \/ 2, p\[1\] - CLAY_JOINT \/ 2, CLAY_JOINT, CLAY_JOINT, 'gjoint', \{ j:j \}\); \}\);/, 'the joint targets are not CLAY_JOINT boxes on every join');
    need('clay', /var t = nearestOpen\(joints, pt, GPAD\), r = clayDrop\(pts, filled, t \? t\.j : null\);\s*if \(r === 'none' \|\| r === 'dup'\) return false;\s*if \(r === 'straight'\)\{ roundMiss\(d\.gClayStraight\); return false; \}\s*filled\[t\.j\] = true; t\.done = true; k\+\+;/, 'a drop is not judged by clayDrop() (none/dup silent, straight with a reason, put)');
    need('clay', /if \(clayLeft\(pts, filled\) === 0\)\{ roundSolved\(d\.gClayDone\(k, m\)\); return true; \}/, 'the round is not solved exactly when clayLeft() is 0, or the message is not gClayDone(corners, straws)');
    need('clay', /out \+= svgLine\(\[a\[0\] \+ ux, a\[1\] \+ uy\], \[b\[0\] - ux, b\[1\] - uy\], i % 2 \? '#F2B36B' : '#E8871E', 9, ' class="gstraw"'\);/, 'the straws are not drawn joint to joint');
    if (D.GAME_CLAY.length < 4) fail('clay: GAME_CLAY needs at least 4 figures');
    const cornerCounts = new Set();
    D.GAME_CLAY.forEach((e, q) => {
      const p = e.pts, m = p.length;
      const own = p.map((b, j) => crs(vec(p[(j + m - 1) % m], b), vec(b, p[(j + 1) % m])) !== 0);
      p.forEach((b, j) => {
        if (D.isTurn(p, j) !== own[j]) fail('clay #' + q + ': isTurn(' + j + ') is ' + D.isTurn(p, j) + ', the joint ' + (own[j] ? 'turns' : 'goes straight on'));
        inside(box(b[0], b[1], J, J), 'clay #' + q + ': joint ' + j, W, H);
        if (hit(grow(box(b[0], b[1], J, J), PAD), srcBox)) fail('clay #' + q + ': joint ' + j + ' reaches the clay — putting the clay back would stick it');
      });
      noHits(p.map(b => grow(box(b[0], b[1], J, J), PAD)), 'clay #' + q + ': padded joint targets');
      if (!polySimple(p)) fail('clay #' + q + ': the straws cross each other');
      const n = own.filter(Boolean).length, flat = m - n;
      if (n < 3) fail('clay #' + q + ': only ' + n + ' corners');
      if (flat < 1) fail('clay #' + q + ': no straight join — the round never asks "is this a corner?"');
      /* 兩個直直接下去的接點不可以相鄰：那會是三根吸管連成一條，畫面上分不出來（也不需要） */
      own.forEach((t, j) => { if (!t && !own[(j + 1) % m]) fail('clay #' + q + ': two straight joins in a row'); });
      /* 吸管不可以往回折（180°）、不可以疊在別的吸管上、接點不可以落在別的吸管上 —— 只擋「真的交叉」的話，
         [[40,50],[260,50],[150,50],…] 這種往回折、疊在一起的圖照樣通過（codex 第一輪） */
      p.forEach((b, j) => {
        const u = vec(p[(j + m - 1) % m], b), v = vec(b, p[(j + 1) % m]);
        if (crs(u, v) === 0 && u[0] * v[0] + u[1] * v[1] <= 0) fail('clay #' + q + ': the straws fold back on themselves at joint ' + j);
      });
      const onSeg = (r, a, c) => crs(vec(a, c), vec(a, r)) === 0 && Math.min(a[0], c[0]) <= r[0] && r[0] <= Math.max(a[0], c[0]) && Math.min(a[1], c[1]) <= r[1] && r[1] <= Math.max(a[1], c[1]);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++){
        if (j === i || j === (i + 1) % m) continue;
        if (onSeg(p[j], p[i], p[(i + 1) % m])) fail('clay #' + q + ': joint ' + j + ' lies on straw ' + i);
      }
      /* 「直直接下去的接點，兩邊的吸管算同一條邊，所以一共 n 條邊」：自己把同方向、相連的吸管併成一段來數，不從轉彎數推 */
      const dirKey = j => { const v = vec(p[j], p[(j + 1) % m]), g = (x, y) => y ? g(y, x % y) : Math.abs(x), k = g(v[0], v[1]); return (v[0] / k) + ',' + (v[1] / k); };
      let runs = 0;
      for (let j = 0; j < m; j++) if (dirKey(j) !== dirKey((j + m - 1) % m)) runs++;
      if (runs !== n) fail('clay #' + q + ': the straws make ' + runs + ' straight sides but there are ' + n + ' corners');
      cornerCounts.add(n);
      /* 照遊戲的規則玩：每一個接點先試一次（直的要彈回），再把轉彎的照任意順序黏完 */
      const filled = {};
      if (D.clayDrop(p, filled, null) !== 'none' || D.clayDrop(p, filled, undefined) !== 'none') fail('clay #' + q + ': a drop on no joint is not silent');
      p.forEach((b, j) => { const r = D.clayDrop(p, filled, j); if (r !== (own[j] ? 'put' : 'straight')) fail('clay #' + q + ': clayDrop(joint ' + j + ') is ' + r); });
      if (D.clayLeft(p, filled) !== n) fail('clay #' + q + ': clayLeft() at the start is ' + D.clayLeft(p, filled) + ', should be ' + n);
      own.map((t, j) => t ? j : -1).filter(j => j >= 0).reverse().forEach((j, i) => {
        filled[j] = true;
        if (D.clayLeft(p, filled) !== n - i - 1) fail('clay #' + q + ': clayLeft() is ' + D.clayLeft(p, filled) + ' after ' + (i + 1) + ' corners');
        if (D.clayDrop(p, filled, j) !== 'dup') fail('clay #' + q + ': a second clay ball on joint ' + j + ' is not "dup"');
        own.forEach((t, s) => { if (!t && D.clayDrop(p, filled, s) !== 'straight') fail('clay #' + q + ': the straight join ' + s + ' is accepted later on'); });
      });
      LANGS.forEach(L => {
        const d = I18N[L];
        seq('clay #' + q + ' ' + L + ' gClayDone', d.gClayDone(n, m), [n, n, m, n]);
        for (let k = 0; k <= n; k++){ seq('clay ' + L + ' gClayNow(' + k + ')', d.gClayNow(k), [k]); if (L === 'en') plural('clay en gClayNow(' + k + ')', d.gClayNow(k), k, 'clay ball', 'clay balls'); }
        for (let r = 1; r <= n; r++){ seq('clay ' + L + ' gClay2(' + r + ')', d.gClay2(r), [r]); if (L === 'en') plural('clay en gClay2(' + r + ')', d.gClay2(r), r, 'turn still has', 'turns still have'); }
      });
    });
    if (cornerCounts.size < 2) fail('clay: every figure has the same number of corners');
    LANGS.forEach(L => {
      const d = I18N[L];
      if (typeof d.gClayStraight !== 'string' || /\d/.test(d.gClayStraight)) fail('clay ' + L + ': gClayStraight missing or has a number');
      has('clay ' + L + ' gClayStraight', d.gClayStraight, L === 'zh' ? /一直線[\s\S]*沒有轉彎[\s\S]*不是頂點[\s\S]*同一條邊/ : /straight on[\s\S]*not a corner[\s\S]*one side/);
      has('clay ' + L + ' gClayDone', d.gClayDone(4, 6), L === 'zh' ? /直直接下去的接點，兩邊的吸管算同一條邊/ : /at each join that goes straight on, the two straws are one side/);
    });
  }

  /* ================= 第 4 關：分家族（範例 4：長得不一樣沒關係，數邊就知道） ================= */
  {
    const S = D.SORT_BIN, C = D.SORT_CARD, H = D.SORT_H;
    const ownFam = id => { const s = FIG_SIDES[id]; return s === 0 ? 'circle' : (s === 3 ? 'tri' : (s === 4 ? 'quad' : null)); };
    Object.keys(D.FIGS).forEach(id => { if (D.familyOf(id) !== ownFam(id)) fail('sort: familyOf(' + id + ') is ' + D.familyOf(id) + ', should be ' + ownFam(id)); });
    if (D.SORT_BINS.join() !== 'tri,quad,circle') fail('sort: SORT_BINS should be tri, quad, circle — got ' + D.SORT_BINS.join());
    D.SORT_TRI.forEach(id => { if (ownFam(id) !== 'tri') fail('sort: SORT_TRI has ' + id + ', which is not a triangle'); });
    D.SORT_QUAD.forEach(id => { if (ownFam(id) !== 'quad') fail('sort: SORT_QUAD has ' + id + ', which is not a quadrilateral'); if (id === 'square') fail('sort: square is dealt on its own — it must not also be in SORT_QUAD'); });
    if (D.SORT_TRI.length < 2 || D.SORT_QUAD.length < 2) fail('sort: the pools are too small to deal 2 + 2');
    /* 正方形一定在：「正方形也是四邊形」是這一課最貴的迷思（家長頁 s1p2）。從座標驗它真的是正方形 */
    { const p = D.FIGS.square.pts; if (p.length !== 4) fail('sort: FIGS.square does not have 4 corners'); else { const L4 = p.map((a, i) => Math.hypot(...vec(a, p[(i + 1) % 4]))), dots = p.map((a, i) => { const u = vec(p[(i + 3) % 4], a), v = vec(a, p[(i + 1) % 4]); return u[0] * v[0] + u[1] * v[1]; });
      if (!(L4.every(l => Math.abs(l - L4[0]) < 1e-9) && dots.every(x => x === 0))) fail('sort: FIGS.square is not a square'); } }
    need('sort', /var ids = pickN\(SORT_TRI, 2\)\.concat\(\['square'\], pickN\(SORT_QUAD, 2\), \['circle'\]\)/, 'the deal is not 2 triangles + the square + 2 quadrilaterals + the circle');
    need('sort', /var t = target\(B, S\.x\[b\], S\.y, S\.w, S\.h, 'gbin', \{ key:key, b:b, n:0 \}\);\s*addZone\(B, S\.x\[b\], S\.y \+ 6, S\.w, 26, 'glbl', d\.names\[key\]\);/, 'the baskets are not SORT_BIN boxes labelled with d.names');
    need('sort', /var b = nearestOpen\(bins, pt, GPAD\), id = P\.data\.id;\s*if \(!b\) return false;\s*if \(b\.key !== familyOf\(id\)\)\{ roundMiss\(d\.gSortWrong\(sidesOf\(id\), familyOf\(id\)\)\); return false; \}/, 'a card is not judged by familyOf() (empty silent, wrong basket with a reason)');
    need('sort', /var at = sortSlotXY\(b\.b, b\.n\); b\.n\+\+;[\s\S]*?P\.lock\(at\[0\], at\[1\]\);/, 'a sorted card is not put at sortSlotXY() inside its basket');
    need('sort', /if \(placed === ids\.length\) roundSolved\(d\.gSortDone\);/, 'the round is not solved when every card is sorted');
    const bins = S.x.map(x => ({ x, y:S.y, w:S.w, h:S.h }));
    if (S.x.length !== 3) fail('sort: there must be 3 baskets');
    bins.forEach((b, i) => inside(b, 'sort: basket ' + i, W, H));
    noHits(bins, 'sort: baskets');
    for (let i = 0; i + 1 < bins.length; i++){
      const gap = bins[i + 1].x - (bins[i].x + bins[i].w);
      if (!(gap > 0 && gap < 2 * PAD)) fail('sort: baskets ' + i + ' and ' + (i + 1) + ' are ' + gap + 'px apart — the drop pads (' + PAD + ') no longer overlap, the nearest-basket rule is never exercised');
    }
    const cells = []; C.ys.forEach(y => C.xs.forEach(x => cells.push(box(x, y, C.w, C.h))));
    if (cells.length !== 6) fail('sort: the tray has ' + cells.length + ' places for 6 cards');
    cells.forEach((c, i) => { inside(c, 'sort: tray place ' + i, W, H); bins.forEach((b, j) => { if (hit(c, grow(b, PAD))) fail('sort: tray place ' + i + ' is inside basket ' + j + '\'s drop zone — a card would be sorted without moving'); }); });
    noHits(cells, 'sort: tray places');
    /* 放好的卡：每一家最多 3 張（四邊形），排在籃子裡、在標籤下面、不互相蓋住 */
    bins.forEach((b, j) => {
      const slots = [0, 1, 2].map(i => { const xy = D.sortSlotXY(j, i); return box(xy[0], xy[1], C.small, C.small); });
      slots.forEach((s, i) => { if (!(s.x >= b.x && s.y >= b.y + 32 && s.x + s.w <= b.x + b.w && s.y + s.h <= b.y + b.h)) fail('sort: basket ' + j + ' place ' + i + ' is not inside the basket under its label (' + JSON.stringify(s) + ')'); });
      noHits(slots, 'sort: basket ' + j + ' places');
    });
    if (nearestOpen){
      const list = bins.map((b, i) => ({ cx:b.x + b.w / 2, cy:b.y + b.h / 2, hw:b.w / 2, hh:b.h / 2, key:D.SORT_BINS[i], done:false }));
      sweepBoxes(list, H, 'sort', 0.5);
      /* 第 1、2 個籃子之間的縫、離第 2 個比較近：一定進第 2 個（第 1 個排在清單前面） */
      const gx = bins[0].x + bins[0].w + (bins[1].x - bins[0].x - bins[0].w) * 0.75, gy = S.y + S.h / 2;
      const g = nearestOpen(list, { x:gx, y:gy }, PAD);
      if (!g || g.key !== 'quad') fail('sort: a drop in the gap nearer the quadrilateral basket goes to ' + (g && g.key));
    }
    LANGS.forEach(L => {
      const d = I18N[L];
      D.SORT_BINS.forEach(k => { if (d.names[k] !== name(k, L)) fail('sort ' + L + ': basket label ' + k + ' is ' + d.names[k]); });
      Object.keys(D.FIGS).forEach(id => {
        const f = ownFam(id); if (!f) return;
        const n = FIG_SIDES[id], t = d.gSortWrong(n, f);
        if (f === 'circle'){ seq('sort ' + L + ' gSortWrong(circle)', t, []); has('sort ' + L + ' gSortWrong(circle)', t, L === 'zh' ? /沒有直的邊/ : /no straight sides/); }
        else { seq('sort ' + L + ' gSortWrong(' + id + ')', t, [n]); if (!says(t, name(f, L), L)) fail('sort ' + L + ': gSortWrong(' + id + ') does not name the ' + name(f, L)); }
      });
      for (let k = 0; k <= 6; k++) seq('sort ' + L + ' gSortNow(' + k + ')', d.gSortNow(k, 6), [k, 6]);
      [3, 4].forEach(n => seq('sort ' + L + ' gSort2(' + n + ')', d.gSort2(n), [n]));
      seq('sort ' + L + ' gSort2(0)', d.gSort2(0), []);
      has('sort ' + L + ' gSort2(0)', d.gSort2(0), L === 'zh' ? /沒有直的邊/ : /no straight sides/);
      seq('sort ' + L + ' gSortDone', d.gSortDone, []);
      if (typeof d.gCardLabel !== 'string' || /三角|四邊|圓|triangle|quadrilateral|circle/i.test(d.gCardLabel)) fail('sort ' + L + ': the card label must not name the shape (it would give the answer away to a screen reader): ' + d.gCardLabel);
    });
  }

  /* ================= 第 5 關：找四邊形（範例 4 第 3 步：直的邊圍一圈、不交叉，4 條就是四邊形） ================= */
  {
    const F = D.FIND_CELL, H = D.FIND_H;
    /* 自己的分類：圓／沒有圍成一圈／交叉／邊數 */
    const ownWhy = it => {
      const f = it.src === 'odd' ? D.GAME_ODD[it.id] : D.FIGS[it.id];
      if (!f) return 'missing';
      if (f.kind === 'circle') return 'circle';
      const closed = it.src === 'odd' ? f.closed : true;
      if (!closed) return 'open';
      if (!polySimple(f.pts)) return 'cross';
      return f.pts.length === 4 ? 'ok' : 'count';
    };
    Object.keys(D.FIGS).forEach(id => { const it = { src:'fig', id }; if (D.findWhy(it) !== ownWhy(it)) fail('find: findWhy(' + id + ') is ' + D.findWhy(it) + ', should be ' + ownWhy(it)); });
    Object.keys(D.GAME_ODD).forEach(id => { const it = { src:'odd', id }; if (D.findWhy(it) !== ownWhy(it)) fail('find: findWhy(odd ' + id + ') is ' + D.findWhy(it) + ', should be ' + ownWhy(it)); });
    const gap = D.GAME_ODD.gap, crossing = D.GAME_ODD.cross;
    if (!gap || ownWhy({ src:'odd', id:'gap' }) !== 'open' || gap.pts.length !== 5 || Math.hypot(...vec(gap.pts[0], gap.pts[4])) < 20) fail('find: the gap shape must be 4 straight lines (5 points) whose ends do not meet');
    if (!crossing || ownWhy({ src:'odd', id:'cross' }) !== 'cross' || crossing.pts.length !== 4) fail('find: the crossing shape must be 4 straight lines that cross');
    D.FIND_QUAD.forEach(id => { if (ownWhy({ src:'fig', id }) !== 'ok') fail('find: FIND_QUAD has ' + id + ', which is not a quadrilateral'); if (id === 'square') fail('find: square is added on its own'); });
    D.FIND_OTHER.forEach(id => { if (ownWhy({ src:'fig', id }) === 'ok') fail('find: FIND_OTHER has ' + id + ', which IS a quadrilateral'); });
    if (D.FIND_QUAD.length < 3 || D.FIND_OTHER.length < 3) fail('find: the pools are too small to deal 3 + 3');
    need('find', /var items = \[fig\('square'\)\]\.concat\(pickN\(FIND_QUAD, 3\)\.map\(fig\), \[\{ src:'odd', id:'gap' \}, \{ src:'odd', id:'cross' \}\], pickN\(FIND_OTHER, 3\)\.map\(fig\)\);/, 'the nine shapes are not the square + 3 quadrilaterals + the gap + the crossing + 3 others');
    need('find', /var total = items\.filter\(function\(it\)\{ return findWhy\(it\) === 'ok'; \}\)\.length, found = 0,/, 'the number to find is not counted with findWhy()');
    need('find', /if \(gSolved \|\| b\.classList\.contains\('found'\) \|\| b\.classList\.contains\('nope'\)\) return;\s*if \(why !== 'ok'\)\{\s*b\.classList\.add\('nope'\); b\.classList\.remove\('ghint'\);\s*roundMiss\(d\.gFindWhy\(why, it\.src === 'odd' \? GAME_ODD\[it\.id\]\.pts\.length : sidesOf\(it\.id\)\)\);\s*return;\s*\}/, 'a tap is not judged by findWhy() (a shape tapped before does nothing; a wrong one says why once)');
    need('find', /if \(found === total\) roundSolved\(d\.gFindDone\(total\)\);/, 'the round is not solved when every quadrilateral is found');
    need('find', /var it = items\[i\], why = findWhy\(it\);/, 'each shape is not classified with findWhy()');
    need('find', /b\.innerHTML = it\.src === 'odd' \? oddSVG\(it\.id\) : figSVG\(it\.id\);/, 'the shapes are not drawn with oddSVG()/figSVG()');
    const cells = []; F.ys.forEach(y => F.xs.forEach(x => cells.push(box(x, y, F.size, F.size))));
    if (cells.length !== 9) fail('find: the grid has ' + cells.length + ' places for 9 shapes');
    cells.forEach((c, i) => inside(c, 'find: place ' + i, W, H));
    noHits(cells, 'find: places');
    /* 兩個「不是四邊形」的畫：畫布容得下（自己從 points 算右緣與下緣，含半個線寬） */
    Object.keys(D.GAME_ODD).forEach(id => {
      const svg = D.oddSVG(id), w = +(svg.match(/<svg[^>]*\bwidth="(\d+)"/) || [])[1], h = +(svg.match(/<svg[^>]*\bheight="(\d+)"/) || [])[1];
      const pts = ((svg.match(/points="([^"]+)"/) || [])[1] || '').trim().split(/\s+/).map(t => t.split(',').map(Number));
      const sw = +(svg.match(/stroke-width="(\d+)"/) || [])[1];
      if (!w || !h || !sw || pts.length !== D.GAME_ODD[id].pts.length) fail('find: cannot read oddSVG(' + id + ')');
      else pts.forEach(p => { if (p[0] - sw / 2 < 0 || p[1] - sw / 2 < 0 || p[0] + sw / 2 > w || p[1] + sw / 2 > h) fail('find: oddSVG(' + id + ') draws ' + p + ' outside its ' + w + '×' + h + ' canvas'); });
      if (D.GAME_ODD[id].closed !== /<polygon/.test(svg)) fail('find: oddSVG(' + id + ') draws ' + (D.GAME_ODD[id].closed ? 'an open line' : 'a closed shape') + ' — the picture must show what closed says');
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      [3, 5, 6].forEach(n => { const t = d.gFindWhy('count', n); seq('find ' + L + ' gFindWhy(count ' + n + ')', t, [n, 4]); });
      seq('find ' + L + ' gFindWhy(circle)', d.gFindWhy('circle', 0), []);
      has('find ' + L + ' gFindWhy(circle)', d.gFindWhy('circle', 0), L === 'zh' ? /沒有直的邊/ : /no straight sides/);
      seq('find ' + L + ' gFindWhy(open)', d.gFindWhy('open', 5), [4]);
      has('find ' + L + ' gFindWhy(open)', d.gFindWhy('open', 5), L === 'zh' ? /沒有圍成一圈/ : /do not make a loop/);
      seq('find ' + L + ' gFindWhy(cross)', d.gFindWhy('cross', 4), [4]);
      has('find ' + L + ' gFindWhy(cross)', d.gFindWhy('cross', 4), L === 'zh' ? /交叉/ : /cross/);
      seq('find ' + L + ' gFindDone(4)', d.gFindDone(4), [4, 4]);
      for (let x = 0; x <= 4; x++) seq('find ' + L + ' gFindNow(' + x + ')', d.gFindNow(x, 4), [x, 4]);
      for (let r = 1; r <= 4; r++){ seq('find ' + L + ' gFind2(' + r + ')', d.gFind2(r), [r]); if (L === 'en') plural('find en gFind2(' + r + ')', d.gFind2(r), r, 'quadrilateral is', 'quadrilaterals are'); }
      for (let k = 1; k <= 9; k++){
        seq('find ' + L + ' gShapeLabel(' + k + ')', d.gShapeLabel(k), [k]);
        hasNot('find ' + L + ' gShapeLabel(' + k + ')', d.gShapeLabel(k), /三角|四邊|圓|邊|頂點|triangle|quadrilateral|circle|side|corner/i);
      }
    });
  }
}

/* ---------- RENDER 的五個函式本體真的跑一次（codex 第一輪：need() 只證明那一行寫著，`find: function(d){ return;` 照樣全綠）----------
   把頁面的資料區、RENDER 物件和它用到的純函式（target／svgLayer／setSVG／svgLine／nearestOpen／shuffle／pickN／order）
   原封不動切出來，放進一個假的 DOM：makeBoard／addZone／addPiece／useTapSelect／actionButton／trailLine／glow／roundMiss／roundSolved
   換成記錄用的替身。pick() 換成「依序挑」，每一題都跑到。然後照孩子會做的事去呼叫頁面自己的 tryDrop／按鈕／點擊，
   看頁面自己的程式收不收、說哪一句、畫了什麼、什麼時候過關。 */
function renderRun(D, I18N, fail, src){
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); return i >= 0 && j > i ? src.slice(i, j) : null; };
  const dataSrc = cut('/* ---------- 語言無關的資料 ---------- */', '/* ---------- i18n ---------- */');
  const renderSrc = cut('  var RENDER = {', '\n  function startRound(){');
  const fns = ['target', 'svgLayer', 'setSVG', 'svgLine', 'nearestOpen', 'shuffle', 'pickN', 'order'].map(n => extractFunction(src, n));
  if (!dataSrc || !renderSrc || fns.some(f => !f)) return fail('render: cannot cut the data block / RENDER / its helpers out of index.html');
  const STUB = `
    var LOG, PICK = 0, gSolved = false, gCtx = {}, GEN = null;
    function pick(arr){ return arr[PICK % arr.length]; }
    function mkEl(){
      var e = { style:{}, cls:{}, listeners:{}, kids:[], html:'', text:'' };
      e.classList = { add:function(c){ e.cls[c] = 1; }, remove:function(c){ delete e.cls[c]; }, contains:function(c){ return !!e.cls[c]; },
                      toggle:function(c, on){ if (on) e.cls[c] = 1; else delete e.cls[c]; } };
      e.setAttribute = function(){}; e.addEventListener = function(t, f){ e.listeners[t] = f; }; e.remove = function(){ e.removed = true; };
      e.appendChild = function(c){ e.kids.push(c); };
      Object.defineProperty(e, 'innerHTML', { set:function(v){ e.html = String(v); }, get:function(){ return e.html; } });
      Object.defineProperty(e, 'textContent', { set:function(v){ e.text = String(v); e.html = String(v); }, get:function(){ return e.text; } });
      Object.defineProperty(e, 'className', { set:function(v){ String(v).split(/\\s+/).forEach(function(c){ if (c) e.cls[c] = 1; }); }, get:function(){ return Object.keys(e.cls).join(' '); } });
      return e;
    }
    var document = { createElement:function(){ return mkEl(); } };
    var gMsg = mkEl();
    function trailLine(t){ var e = mkEl(); e.textContent = t; LOG.line = e; return e; }
    function makeBoard(W, H){ var B = { el:mkEl(), W:W, H:H, selected:null }; LOG.B = B; LOG.H = H; return B; }
    function addZone(B, x, y, w, h, cls, text){ var z = mkEl(); z.className = cls; z.box = { x:x, y:y, w:w, h:h }; if (text !== undefined) z.textContent = text; B.el.appendChild(z); LOG.zones.push(z); return z; }
    function addPiece(B, o){
      var P = { el:mkEl(), o:o, w:o.w, h:o.h, homeX:o.cx, homeY:o.cy, cx:o.cx, cy:o.cy, locked:false, data:o.data || {} };
      P.el.className = 'gpiece ' + (o.cls || '');
      P.home = function(){ P.cx = P.homeX; P.cy = P.homeY; };
      P.lock = function(x, y){ P.locked = true; P.cx = x; P.cy = y; };
      LOG.pieces.push(P); return P;
    }
    function useTapSelect(B, f){ LOG.drop = f; }
    function keepSelected(){}
    function glow(els){ LOG.glow = els; }
    function refreshHint(){}
    function actionButton(text, f){ var b = mkEl(); b.textContent = text; b.press = f; LOG.action = b; return b; }
    function roundMiss(t){ LOG.miss.push(t); gMsg.innerHTML = t; }
    function roundSolved(t){ if (gSolved) return; gSolved = true; LOG.solved.push(t); }
  `;
  /* sort／find 的發牌是隨機的：用固定種子的亂數（每一次都一樣、可以重現），並且記下發過哪些卡 ——
     每一張卡都要至少被發到一次，不然那一張的畫法／判斷從來沒有跑過（codex 第二輪） */
  let seed = 20261002;
  const SEEDED = Object.create(Math);
  SEEDED.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const seenSort = new Set(), seenFind = new Set();
  let RUN;
  try {
    RUN = new Function('MathR', 'var Math = MathR;\n' + dataSrc + '\n' + STUB + '\n' + fns.join('\n') + '\n' + renderSrc + `
      return function(type, d, k){
        LOG = { miss:[], solved:[], zones:[], pieces:[], line:null, B:null, H:0, drop:null, action:null, glow:null };
        PICK = k; gSolved = false; gCtx = {}; gMsg.innerHTML = '';
        RENDER[type](d);
        LOG.ctx = gCtx; LOG.msg = function(){ return gMsg.innerHTML; }; LOG.solvedNow = function(){ return gSolved; };
        return LOG;
      };`)(SEEDED);
  } catch (e){ return fail('render: the RENDER block could not be evaluated: ' + e.message); }
  const play = (type, d, k) => { try { return RUN(type, d, k); } catch (e){ fail('render ' + type + ' #' + k + ': threw ' + e.message); return null; } };
  const H = { loop:D.LOOP_H, walk:D.WALK_H, clay:D.CLAY_H, sort:D.SORT_H, find:D.FIND_H };
  const hint2 = (r, w) => { try { return r.ctx.hint2(); } catch (e){ fail(w + ': hint 2 threw ' + e.message); return null; } };
  const count = (html, cls) => (String(html).match(new RegExp('class="' + cls + '"', 'g')) || []).length;
  ['zh', 'en'].forEach(L => {
    const d = I18N[L];
    /* --- 第 1 關 --- */
    D.GAME_LOOP.forEach((id, k) => {
      const r = play('loop', d, k); if (!r) return;
      const w = 'render loop ' + id + ' ' + L;
      if (r.H !== H.loop) fail(w + ': the board is ' + r.H + ' high, LOOP_H is ' + H.loop);
      const n = D.FIGS[id].pts.length, segs = D.loopSegs(id), P = r.pieces[0], svg = r.zones.filter(z => z.cls.gsvg)[0];
      const balls = r.zones.filter(z => z.cls.gball);
      if (balls.length !== n || !P || !svg || !r.action || !r.drop) return fail(w + ': not drawn as ' + n + ' balls + the straw + "Loop done"');
      balls.forEach((b, i) => { const xy = D.figXY(id, i, D.LOOP_FIG); if (Math.abs(b.box.x + b.box.w / 2 - xy[0]) > 1e-6 || Math.abs(b.box.y + b.box.h / 2 - xy[1]) > 1e-6) fail(w + ': clay ball ' + i + ' is not on corner ' + i); });
      const mid = s => ({ x:(s.ax + s.bx) / 2, y:(s.ay + s.by) / 2 });
      r.action.press();
      if (r.miss.length || r.msg() !== d.gLoopEmpty || r.solvedNow()) fail(w + ': "Loop done" with nothing placed must only remind');
      if (r.drop(P, { x:4, y:4 }) !== false || r.miss.length) fail(w + ': a drop on empty space must bounce silently');
      segs.filter(s => !s.edge).forEach(s => { const m0 = r.miss.length; if (r.drop(P, mid(s)) !== false || r.miss.length !== m0 + 1 || r.miss[m0] !== d.gLoopCross) fail(w + ': the diagonal ' + s.i + '-' + s.j + ' is not bounced with gLoopCross'); });
      if (count(svg.innerHTML, 'gstraw') !== 0) fail(w + ': a bounced straw was drawn');
      const edges = segs.filter(s => s.edge);
      edges.forEach((s, i) => {
        if (r.drop(P, i % 2 ? Object.assign(mid(s), { tap:true }) : mid(s)) !== true) fail(w + ': the edge ' + s.i + '-' + s.j + ' is not accepted');
        if (P.cx !== P.homeX || P.cy !== P.homeY) fail(w + ': the straw does not go back home (it never runs out)');
        if (r.line.textContent !== d.gLoopNow(i + 1)) fail(w + ': the line reads "' + r.line.textContent + '" after ' + (i + 1) + ' straws');
        if (count(svg.innerHTML, 'gstraw') !== i + 1) fail(w + ': ' + count(svg.innerHTML, 'gstraw') + ' straws drawn after ' + (i + 1));
        if (i === 0){ const m0 = r.miss.length; r.action.press(); if (r.miss.length !== m0 + 1 || r.miss[m0] !== d.gLoopGap(n - 1) || r.solvedNow()) fail(w + ': "Loop done" with gaps is not a mistake with the gap count'); }
        if (i < n - 1){ const h = hint2(r, w); if (h !== d.gLoop2(n - i - 1) || !r.glow || r.glow.length !== 2) fail(w + ': hint 2 after ' + (i + 1) + ' straws is "' + h + '" / ' + (r.glow && r.glow.length) + ' glowing'); }
      });
      if (r.drop(P, mid(edges[0])) !== false || r.miss.length !== 1 + segs.length - n) fail(w + ': a straw on a side that already has one is not silent');
      if (hint2(r, w) !== d.gLoopReady || !r.glow || r.glow[0] !== r.action) fail(w + ': once closed, hint 2 does not point at "Loop done"');
      if (r.solvedNow()) fail(w + ': the round solved itself without "Loop done"');
      r.action.press();
      if (!r.solvedNow() || r.solved[0] !== d.gLoopDone(n)) fail(w + ': "Loop done" on a closed loop does not solve with gLoopDone(' + n + ')');
    });
    /* --- 第 2 關 --- */
    D.GAME_WALK.forEach((id, k) => {
      const r = play('walk', d, k); if (!r) return;
      const w = 'render walk ' + id + ' ' + L, n = D.FIGS[id].pts.length, P = r.pieces[0], svg = r.zones.filter(z => z.cls.gsvg)[0];
      if (r.H !== H.walk) fail(w + ': the board is ' + r.H + ' high, WALK_H is ' + H.walk);
      const V = Array.from({ length:n }, (_, i) => { const xy = D.figXY(id, i, D.WALK_FIG); return { x:xy[0], y:xy[1] }; });
      if (!P || P.cx !== V[0].x || P.cy !== V[0].y || P.o.text !== '🐜') return fail(w + ': the ant does not start on corner 0');
      if (r.zones.filter(z => z.cls.gcorner).length !== n) fail(w + ': not one ring per corner');
      const star = r.zones.filter(z => z.cls.gstar)[0]; if (!star || star.textContent !== '★') fail(w + ': no ★ badge');
      if (n > 3){ if (r.drop(P, V[2]) !== false || r.miss.slice(-1)[0] !== d.gWalkSkip) fail(w + ': cutting across to corner 2 is not bounced with gWalkSkip'); }
      if (r.drop(P, { x:V[0].x + 3, y:V[0].y + 3 }) !== false || r.miss.length !== (n > 3 ? 1 : 0)) fail(w + ': putting the ant back on its own corner is not silent');
      { const h = hint2(r, w); if (!r.glow || r.glow.length !== 1 || h !== d.gWalk2(n)) fail(w + ': hint 2 at the start must make ONE corner glow and say ' + n + ' sides to go'); }
      for (let i = 1; i <= n; i++){
        const to = i % n;
        if (r.drop(P, i % 2 ? V[to] : Object.assign({}, V[to], { tap:true })) !== true) { fail(w + ': step ' + i + ' to corner ' + to + ' is not accepted'); return; }
        if (count(svg.innerHTML, 'gwalked') !== i) fail(w + ': ' + count(svg.innerHTML, 'gwalked') + ' sides lit after ' + i + ' steps');
        if (i === 1){ const m0 = r.miss.length; if (r.drop(P, V[0]) !== false || r.miss.length !== m0 + 1 || r.miss[m0] !== d.gWalkBack) fail(w + ': walking back to ★ is not bounced with gWalkBack'); }
        if (i < n){
          if (P.cx !== V[to].x || P.cy !== V[to].y || P.locked) fail(w + ': the ant does not stand on corner ' + to);
          if (r.line.textContent !== d.gWalkNow(i)) fail(w + ': the line reads "' + r.line.textContent + '" after ' + i + ' sides');
          if (r.solvedNow()) fail(w + ': solved after only ' + i + ' sides');
        }
      }
      if (!r.solvedNow() || r.solved[0] !== d.gWalkDone(n) || !P.locked || r.line.textContent !== d.gWalkTotal(n)) fail(w + ': back at ★ after ' + n + ' sides does not solve with gWalkDone(' + n + ')');
    });
    /* --- 第 3 關 --- */
    D.GAME_CLAY.forEach((e, k) => {
      const r = play('clay', d, k); if (!r) return;
      const w = 'render clay #' + k + ' ' + L, p = e.pts, m = p.length, P = r.pieces[0], svg = r.zones.filter(z => z.cls.gsvg)[0];
      if (r.H !== H.clay) fail(w + ': the board is ' + r.H + ' high, CLAY_H is ' + H.clay);
      if (!P || count(svg && svg.innerHTML, 'gstraw') !== m || r.zones.filter(z => z.cls.gjoint).length !== m) return fail(w + ': not drawn as ' + m + ' straws with a ring on every joint');
      const turn = p.map((_, j) => D.isTurn(p, j)), n = turn.filter(Boolean).length;
      p.forEach((b, j) => { if (!turn[j]){ const m0 = r.miss.length; if (r.drop(P, { x:b[0], y:b[1] }) !== false || r.miss.length !== m0 + 1 || r.miss[m0] !== d.gClayStraight) fail(w + ': the straight joint ' + j + ' is not bounced with gClayStraight'); } });
      if (r.drop(P, { x:150, y:130 }) !== false) fail(w + ': a drop in the middle is not silent');
      let c = 0;
      p.forEach((b, j) => {
        if (!turn[j]) return;
        c++;
        if (r.drop(P, c % 2 ? { x:b[0], y:b[1] } : { x:b[0], y:b[1], tap:true }) !== true) fail(w + ': the corner ' + j + ' is not accepted');
        if (c < n){
          if (r.solvedNow() || r.line.textContent !== d.gClayNow(c)) fail(w + ': after ' + c + ' corners: solved=' + r.solvedNow() + ', line "' + r.line.textContent + '"');
          const m0 = r.miss.length; if (r.drop(P, { x:b[0], y:b[1] }) !== false || r.miss.length !== m0) fail(w + ': clay on a filled corner is not silent');
        }
      });
      if (!r.solvedNow() || r.solved[0] !== d.gClayDone(n, m)) fail(w + ': all ' + n + ' corners filled does not solve with gClayDone(' + n + ', ' + m + ')');
      if (r.zones.filter(z => z.cls.gjoint && z.cls.filled).length !== n) fail(w + ': ' + n + ' corners are not drawn as filled');
    });
    /* --- 第 4 關（發牌用固定種子的亂數：每種語言 30 次，兩種語言共 60 次） --- */
    for (let t = 0; t < 30; t++){
      const r = play('sort', d, 0); if (!r) break;
      const w = 'render sort ' + L;
      if (r.H !== H.sort) fail(w + ': the board is ' + r.H + ' high, SORT_H is ' + H.sort);
      const S = D.SORT_BIN, ctr = b => ({ x:S.x[b] + S.w / 2, y:S.y + S.h / 2 }), fam = id => D.familyOf(id);
      const ids = r.pieces.map(P => P.data.id);
      const tally = f => ids.filter(id => fam(id) === f).length;
      ids.forEach(id => seenSort.add(id));
      if (r.pieces.length !== 6 || tally('tri') !== 2 || tally('quad') !== 3 || tally('circle') !== 1 || ids.indexOf('square') < 0 || new Set(ids).size !== 6) { fail(w + ': the deal is ' + ids.join(',')); break; }
      if (new Set(r.pieces.map(P => P.cx + ',' + P.cy)).size !== 6) fail(w + ': two cards are dealt onto the same place');
      if (r.drop(r.pieces[0], { x:150, y:186 }) !== false || r.miss.length) fail(w + ': a drop between the baskets and the tray is not silent');
      r.pieces.forEach((P, i) => {
        D.SORT_BINS.forEach((key, b) => {
          if (key === fam(P.data.id)) return;
          const m0 = r.miss.length;
          if (r.drop(P, ctr(b)) !== false || r.miss.length !== m0 + 1 || r.miss[m0] !== d.gSortWrong(D.sidesOf(P.data.id), fam(P.data.id))) fail(w + ': ' + P.data.id + ' in the ' + key + ' basket is not bounced with gSortWrong');
        });
        const b = D.SORT_BINS.indexOf(fam(P.data.id));
        if (r.drop(P, i % 2 ? Object.assign(ctr(b), { tap:true }) : ctr(b)) !== true || !P.locked) fail(w + ': ' + P.data.id + ' is not accepted by its own basket');
        if (!(P.cx >= S.x[b] && P.cx <= S.x[b] + S.w && P.cy >= S.y && P.cy <= S.y + S.h)) fail(w + ': ' + P.data.id + ' is locked outside its basket');
        if (i < 5 && (r.solvedNow() || r.line.textContent !== d.gSortNow(i + 1, 6))) fail(w + ': after ' + (i + 1) + ' cards: solved=' + r.solvedNow() + ', line "' + r.line.textContent + '"');
      });
      if (!r.solvedNow() || r.solved[0] !== d.gSortDone) fail(w + ': six sorted cards do not solve with gSortDone');
      if (new Set(r.pieces.map(P => P.cx + ',' + P.cy)).size !== 6) fail(w + ': two sorted cards sit on the same place');
    }
    /* --- 第 5 關（同上，固定種子，共 60 次） --- */
    const oddHtml = {}; Object.keys(D.GAME_ODD).forEach(id => { oddHtml[D.oddSVG(id)] = { src:'odd', id }; });
    const figHtml = {}; Object.keys(D.FIGS).forEach(id => { figHtml[D.figSVG(id)] = { src:'fig', id }; });
    for (let t = 0; t < 30; t++){
      const r = play('find', d, 0); if (!r) break;
      const w = 'render find ' + L;
      if (r.H !== H.find) fail(w + ': the board is ' + r.H + ' high, FIND_H is ' + H.find);
      if (!r.B) { fail(w + ': no board was drawn'); break; }
      const btns = r.B.el.kids.filter(b => b.cls.gfind);
      const items = btns.map(b => oddHtml[b.innerHTML] || figHtml[b.innerHTML]);
      if (btns.length !== 9 || items.some(x => !x)) { fail(w + ': not 9 recognisable shapes'); break; }
      items.forEach(it => seenFind.add(it.src + ':' + it.id));
      const whys = items.map(it => D.findWhy(it)), quads = whys.filter(x => x === 'ok').length;
      if (quads !== 4 || whys.indexOf('open') < 0 || whys.indexOf('cross') < 0 || items.filter(it => it.id === 'square').length !== 1) { fail(w + ': the nine are ' + items.map(it => it.id).join(',')); break; }
      if (r.line.textContent !== d.gFindNow(0, 4)) fail(w + ': the line reads "' + r.line.textContent + '"');
      let found = 0;
      btns.forEach((b, i) => {
        const why = whys[i], it = items[i];
        if (why === 'ok') return;
        const m0 = r.miss.length;
        b.listeners.click();
        const want = d.gFindWhy(why, it.src === 'odd' ? D.GAME_ODD[it.id].pts.length : D.sidesOf(it.id));
        if (r.miss.length !== m0 + 1 || r.miss[m0] !== want || !b.classList.contains('nope')) fail(w + ': tapping ' + it.id + ' is not one mistake with "' + want + '"');
        b.listeners.click();
        if (r.miss.length !== m0 + 1) fail(w + ': tapping ' + it.id + ' again counts another mistake');
      });
      btns.forEach((b, i) => {
        if (whys[i] !== 'ok') return;
        b.listeners.click(); found++;
        if (!b.classList.contains('found') || r.line.textContent !== d.gFindNow(found, 4)) fail(w + ': tapping ' + items[i].id + ' does not count it (' + r.line.textContent + ')');
        if (found < 4 && r.solvedNow()) fail(w + ': solved after ' + found + ' quadrilaterals');
        if (found < 4){ const m0 = r.miss.length; b.listeners.click(); if (r.miss.length !== m0 || r.line.textContent !== d.gFindNow(found, 4)) fail(w + ': tapping a found one again changes something'); }
      });
      if (!r.solvedNow() || r.solved[0] !== d.gFindDone(4)) fail(w + ': four found does not solve with gFindDone(4)');
    }
  });
  D.SORT_TRI.concat(D.SORT_QUAD, ['square', 'circle']).forEach(id => { if (!seenSort.has(id)) fail('render sort: the card ' + id + ' was never dealt in 60 seeded deals — its drawing and judgement never ran'); });
  D.FIND_QUAD.concat(D.FIND_OTHER, ['square']).map(id => 'fig:' + id).concat(Object.keys(D.GAME_ODD).map(id => 'odd:' + id)).forEach(k => { if (!seenFind.has(k)) fail('render find: the shape ' + k + ' was never dealt in 60 seeded deals'); });
}

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
      find:"        find:'點出所有的四邊形。這一關用點的。'",
      replace:"        find:'圓有多少條邊？點出所有的四邊形。這一關用點的。'" },
    { file:'index', expect:'asks how many sides a circle has',
      find:"        find:'Tap every quadrilateral. This round is all taps.'",
      replace:"        find:'What is the number of sides on a circle? Tap every quadrilateral. This round is all taps.'" },
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
      find:"        sort:'數一數直的邊，把圖形放進它的家族。也可以先點圖形、再點籃子。',",
      replace:"        sort:'這個圖形有幾條邊？它是圓。數一數直的邊，把圖形放進它的家族。也可以先點圖形、再點籃子。'," },
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
      replace:"        { stem:'A circle: how many sides does it have?'," },
    /* --- index.html：小遊戲（§六之五，2026-10-02 改版）。每一筆只改壞一條規則 --- */
    /* 第 1 關：挑第一條符合的線，不是最近的（對角線排在前面，靠近邊放下去會被判成交叉） */
    { file:'index', expect:"nearestSeg() disagrees",
      find:"      if (dd <= pad && dd < bd){ bd = dd; best = s; }",
      replace:"      if (dd <= pad && !best){ bd = dd; best = s; }" },
    /* 挑第一個符合的籃子，不是最近的 */
    { file:'index', expect:"nearestOpen() disagrees",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    /* 放在黏土球上面也算接了一根（分不出要接哪兩顆） */
    { file:'index', expect:"a drop right on clay ball",
      find:"      if (t < SEG_END || t > 1 - SEG_END) return;",
      replace:"      if (t < 0 || t > 1) return;" },
    /* 對角線（穿過中間、會交叉）也收 */
    { file:'index', expect:"diagonal accepted",
      find:"  function loopRule(seg){ return !seg ? 'none' : (seg.edge ? 'put' : 'cross'); }",
      replace:"  function loopRule(seg){ return !seg ? 'none' : 'put'; }" },
    /* 還有一個缺口就按「圍好了」也過關 */
    { file:'index', expect:"is accepted with only",
      find:"  function loopDone(n, k){ return k === 0 ? 'empty' : (k < n ? 'gap' : 'ok'); }",
      replace:"  function loopDone(n, k){ return k === 0 ? 'empty' : (k < n - 1 ? 'gap' : 'ok'); }" },
    /* 一根都沒放就按「圍好了」算成犯錯（應該只提醒） */
    { file:'index', expect:"loopDone(4, 0) is gap",
      find:"  function loopDone(n, k){ return k === 0 ? 'empty' : (k < n ? 'gap' : 'ok'); }",
      replace:"  function loopDone(n, k){ return k < n ? 'gap' : 'ok'; }" },
    { file:'index', expect:"the diagonals are not listed before the edges",
      find:"    return diag.concat(edge);",
      replace:"    return edge.concat(diag);" },
    /* 第 2 關：穿過中間走到不相鄰的頂點也收 */
    { file:'index', expect:"should be skip",
      find:"    if (d !== 1 && d !== n - 1) return 'skip';",
      replace:"    if (d === 0) return 'skip';" },
    /* 走回頭路也收 */
    { file:'index', expect:"should be back",
      find:"      if ((a === cur && b === to) || (a === to && b === cur)) return 'back';",
      replace:"      if (false) return 'back';" },
    /* 回到 ★ 的那一步算錯了（走完一圈也不會過關） */
    { file:'index', expect:"ways to finish the walk",
      find:"    return (to === path[0] && path.length === n) ? 'home' : 'step';",
      replace:"    return (to === path[0] && path.length === n - 1) ? 'home' : 'step';" },
    /* 第 3 關：轉不轉彎看錯了 */
    { file:'index', expect:"the joint goes straight on",
      find:"    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0;",
      replace:"    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) >= 0;" },
    /* 直直接下去的接點也收黏土 */
    { file:'index', expect:"clayDrop(joint",
      find:"    return isTurn(pts, j) ? 'put' : 'straight';",
      replace:"    return 'put';" },
    /* 直直接下去的接點也要黏才過關（永遠過不了） */
    { file:'index', expect:"clayLeft() at the start is",
      find:"    for (var j = 0; j < pts.length; j++) if (isTurn(pts, j) && !filled[j]) left++;",
      replace:"    for (var j = 0; j < pts.length; j++) if (!filled[j]) left++;" },
    /* 同一個接點黏兩次 */
    { file:'index', expect:"is not \"dup\"",
      find:"    if (filled[j]) return 'dup';\n",
      replace:"" },
    /* 第 4 關：五邊形也算四邊形 */
    { file:'index', expect:"familyOf(penta)",
      find:"    return s === 0 ? 'circle' : (s === 3 ? 'tri' : (s === 4 ? 'quad' : null));",
      replace:"    return s === 0 ? 'circle' : (s === 3 ? 'tri' : (s >= 4 ? 'quad' : null));" },
    /* 第 5 關：交叉的 4 條線也算四邊形 */
    { file:'index', expect:"findWhy(odd cross) is",
      find:"      if (segCrossAt(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return 'cross';",
      replace:"      if (false) return 'cross';" },
    /* 沒有圍成一圈也不管 */
    { file:'index', expect:"findWhy(odd gap) is",
      find:"    if (!closed) return 'open';",
      replace:"    if (false) return 'open';" },
    /* 缺口那一個寫成圍好的 */
    { file:'index', expect:"the gap shape must be 4 straight lines",
      find:"    gap:   { pts:[[34,20],[108,20],[108,108],[20,108],[20,44]], closed:false },",
      replace:"    gap:   { pts:[[34,20],[108,20],[108,108],[20,108],[20,44]], closed:true }," },
    /* 缺口小到看不出來（畫面決定不了答案） */
    { file:'index', expect:"the gap shape must be 4 straight lines",
      find:"    gap:   { pts:[[34,20],[108,20],[108,108],[20,108],[20,44]], closed:false },",
      replace:"    gap:   { pts:[[22,20],[108,20],[108,108],[20,108],[20,24]], closed:false }," },
    { file:'index', expect:"FIND_OTHER has rect, which IS a quadrilateral",
      find:"FIND_OTHER = ['tri', 'triThin', 'penta', 'hexa', 'circle'];",
      replace:"FIND_OTHER = ['tri', 'triThin', 'penta', 'rect', 'circle'];" },
    { file:'index', expect:"SORT_QUAD has tri",
      find:"  var SORT_TRI = ['tri', 'triTilt', 'triThin'], SORT_QUAD = ['rect', 'trap', 'diamond', 'wonky'];",
      replace:"  var SORT_TRI = ['tri', 'triTilt', 'triThin'], SORT_QUAD = ['rect', 'trap', 'diamond', 'tri'];" },
    /* 三角形沒有對角線：那一題沒有任何錯的放法可以擋 */
    { file:'index', expect:"GAME_LOOP figure triTilt must have 4 or 5 corners",
      find:"  var GAME_LOOP = ['square', 'rect', 'trap', 'diamond', 'wonky', 'penta'];",
      replace:"  var GAME_LOOP = ['square', 'rect', 'trap', 'diamond', 'wonky', 'triTilt'];" },
    { file:'index', expect:"GAME_WALK figure circle must be a polygon",
      find:"  var GAME_WALK = ['triTilt', 'trap', 'wonky', 'rect', 'penta', 'hexa'];",
      replace:"  var GAME_WALK = ['triTilt', 'trap', 'wonky', 'rect', 'penta', 'circle'];" },
    /* 第 3 關的一題沒有直直接下去的接點 */
    { file:'index', expect:"no straight join",
      find:"    { pts:[[150,26],[262,214],[150,214],[38,214]] },",
      replace:"    { pts:[[150,26],[262,214],[150,222],[38,214]] }," },
    { file:'index', expect:"two straight joins in a row",
      find:"    { pts:[[40,50],[150,50],[260,50],[260,200],[150,200],[40,200]] },",
      replace:"    { pts:[[40,50],[150,50],[200,50],[260,50],[260,200],[40,200]] }," },
    /* 放好的卡全部疊在籃子裡同一個位置 */
    { file:'index', expect:"a sorted card is not put at sortSlotXY",
      find:"        var at = sortSlotXY(b.b, b.n); b.n++;",
      replace:"        var at = sortSlotXY(b.b, 0); b.n++;" },
    { file:'index', expect:"places 0 and 1 overlap",
      find:"  function sortSlotXY(b, i){ return [SORT_BIN.x[b] + 23 + (i % 2) * 46, SORT_BIN.y + 54 + Math.floor(i / 2) * 46]; }",
      replace:"  function sortSlotXY(b, i){ return [SORT_BIN.x[b] + 23 + (i % 2) * 30, SORT_BIN.y + 54 + Math.floor(i / 2) * 46]; }" },
    /* 籃子之間的縫太寬：「挑最近的籃子」那一條規則永遠用不到 */
    { file:'index', expect:"the drop pads (6) no longer overlap",
      find:"  var SORT_H = 330, SORT_BIN = { x:[8, 104, 200], y:10, w:92, h:150 };",
      replace:"  var SORT_H = 330, SORT_BIN = { x:[8, 110, 212], y:10, w:80, h:150 };" },
    /* 第 4 關不一定有正方形 */
    { file:'index', expect:"the deal is not 2 triangles + the square",
      find:"      var ids = pickN(SORT_TRI, 2).concat(['square'], pickN(SORT_QUAD, 2), ['circle'])",
      replace:"      var ids = pickN(SORT_TRI, 2).concat(pickN(SORT_QUAD, 3), ['circle'])" },
    /* 第 5 關少了交叉的那一個 */
    { file:'index', expect:"the nine shapes are not the square",
      find:"      var items = [fig('square')].concat(pickN(FIND_QUAD, 3).map(fig), [{ src:'odd', id:'gap' }, { src:'odd', id:'cross' }], pickN(FIND_OTHER, 3).map(fig));",
      replace:"      var items = [fig('square')].concat(pickN(FIND_QUAD, 3).map(fig), [{ src:'odd', id:'gap' }], pickN(FIND_OTHER, 4).map(fig));" },
    /* 點錯的那一個再點一次又算一次錯 */
    { file:'index', expect:"a tap is not judged by findWhy()",
      find:"          if (gSolved || b.classList.contains('found') || b.classList.contains('nope')) return;",
      replace:"          if (gSolved || b.classList.contains('found')) return;" },
    /* 螞蟻放回原來的頂點（等於沒走）算成犯錯 */
    { file:'index', expect:"a move is not judged by walkStep()",
      find:"        if (r === 'stay') return false;\n        if (r === 'skip')",
      replace:"        if (r === 'stay'){ roundMiss(d.gWalkBack); return false; }\n        if (r === 'skip')" },
    /* 黏在已經黏好的接點算成犯錯 */
    { file:'index', expect:"a drop is not judged by clayDrop()",
      find:"        if (r === 'none' || r === 'dup') return false;",
      replace:"        if (r === 'none') return false;\n        if (r === 'dup'){ roundMiss(d.gClayStraight); return false; }" },
    /* 四邊形的籃子什麼都收 */
    { file:'index', expect:"a card is not judged by familyOf()",
      find:"        if (b.key !== familyOf(id)){ roundMiss(d.gSortWrong(sidesOf(id), familyOf(id))); return false; }",
      replace:"        if (b.key !== familyOf(id) && b.key !== 'quad'){ roundMiss(d.gSortWrong(sidesOf(id), familyOf(id))); return false; }" },
    /* 有缺口按「圍好了」說了為什麼，還是過關 */
    { file:'index', expect:"\"Loop done\" is not judged by loopDone()",
      find:"        if (r === 'gap'){ roundMiss(d.gLoopGap(n - k)); return; }",
      replace:"        if (r === 'gap'){ roundMiss(d.gLoopGap(n - k)); }" },
    { file:'index', expect:"GPICK (the ant) is",
      find:"  var GAME_W = 300, GPICK = 48, GPAD = 6;",
      replace:"  var GAME_W = 300, GPICK = 40, GPAD = 6;" },
    { file:'index', expect:"the straw (80×36)",
      find:"  var LOOP_SRC = { y:274, w:80, h:GPICK };",
      replace:"  var LOOP_SRC = { y:274, w:80, h:36 };" },
    { file:'index', expect:"a shape card (40×40)",
      find:"  var SORT_CARD = { w:70, h:70, xs:[54, 150, 246], ys:[212, 290], small:40 };",
      replace:"  var SORT_CARD = { w:40, h:40, xs:[54, 150, 246], ys:[212, 290], small:40 };" },
    { file:'index', expect:"a find-the-quadrilateral shape is",
      find:"  var FIND_H = 296, FIND_CELL = { size:88, xs:[54, 150, 246], ys:[50, 148, 246] };",
      replace:"  var FIND_H = 296, FIND_CELL = { size:40, xs:[54, 150, 246], ys:[50, 148, 246] };" },
    /* 吸管放在最下面那顆黏土球上 */
    { file:'index', expect:"touches the straw",
      find:"  var LOOP_SRC = { y:274, w:80, h:GPICK };",
      replace:"  var LOOP_SRC = { y:248, w:80, h:GPICK };" },
    { file:'index', expect:"places 0 and 1 overlap",
      find:"  var FIND_H = 296, FIND_CELL = { size:88, xs:[54, 150, 246], ys:[50, 148, 246] };",
      replace:"  var FIND_H = 296, FIND_CELL = { size:88, xs:[54, 120, 246], ys:[50, 148, 246] };" },
    { file:'index', expect:"the ★ badge",
      find:"  var WALK_H = 276, WALK_FIG = { x:28, y:22, s:1.9 }, WALK_STAR = 0, WALK_BADGE = { dx:-30, dy:-24, size:24 };",
      replace:"  var WALK_H = 276, WALK_FIG = { x:28, y:22, s:1.9 }, WALK_STAR = 0, WALK_BADGE = { dx:-30, dy:44, size:24 };" },
    /* 低年級不扣分 */
    { file:'index', expect:"a mistake changed the score",
      find:"  function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"  function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    { file:'index', expect:"stars: a round with 1 mistake(s) gives 2 stars",
      find:"    var stars = gMistakes === 0 ? 2 : 1;",
      replace:"    var stars = 2;" },
    /* 舊畫板的積木替新的一關過關 */
    { file:'index', expect:"can still drop onto the new round",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    { file:'index', expect:"lost pointer capture does not put the piece back",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }\n  }",
      replace:"  }" },
    /* 托盤可能照資料的順序排 */
    { file:'index', expect:"an rng that never moves anything leaves",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"" },
    { file:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"" },
    /* 另一根手指的移動也拖得動 */
    { file:'index', expect:"(first pointer only)",
      find:"      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e)",
      replace:"      if (!start) return;\n      var p = B.toBoard(e)" },
    { file:'index', expect:"gLoopDone(4): numbers should read 4,4,4",
      find:"        return n + ' 根吸管圍成一圈：' + n + ' 條邊、' + n + ' 個頂點，一樣多。' + tail;",
      replace:"        return n + ' 根吸管圍成一圈：' + (n - 1) + ' 條邊、' + n + ' 個頂點，一樣多。' + tail;" },
    { file:'index', expect:"singular/plural is wrong",
      find:"      gLoopGap:function(g){ return 'Not a loop yet: ' + (g === 1 ? 'there is still 1 gap.' : ('there are still ' + g + ' gaps.')); },",
      replace:"      gLoopGap:function(g){ return 'Not a loop yet: there are still ' + g + ' gaps.'; }," },
    /* 第 3 關說「吸管幾根就是幾條邊」（這一關要擋的迷思） */
    { file:'index', expect:"gClayDone: numbers should read",
      find:"所以一共 ' + n + ' 條邊。';",
      replace:"所以一共 ' + m + ' 條邊。';" },
    { file:'index', expect:"gWalkDone(5): numbers should read 5,4",
      find:"        return 'Back at ★! That is ' + n + ' sides in all. ' + tail;",
      replace:"        return 'Back at ★! That is ' + (n + 1) + ' sides in all. ' + tail;" },
    /* 圓不數「幾條邊」 */
    { file:'index', expect:"gSortWrong(circle): numbers should read",
      find:"        if (n === 0) return '它沒有直的邊，也沒有頂點，是圓。';",
      replace:"        if (n === 0) return '它有 0 條直的邊，是圓。';" },
    { file:'index', expect:"does not name the quadrilateral",
      find:"        return 'It has ' + n + ' straight sides, so it is a ' + this.names[key] + '.';",
      replace:"        return 'It has ' + n + ' straight sides.';" },
    { file:'index', expect:"gFindWhy(count 3): numbers should read 3,4",
      find:"        return '它有 ' + n + ' 條直的邊，不是 4 條。';",
      replace:"        return '它有 ' + n + ' 條直的邊。';" },
    { file:'index', expect:"gFindWhy(open)",
      find:"        if (why === 'open') return '4 條直的線沒有圍成一圈，有一個缺口，不是四邊形。';",
      replace:"        if (why === 'open') return '4 條直的線，不是四邊形。';" },
    { file:'index', expect:"gClayStraight",
      find:"      gClayStraight:'這裡兩根吸管接成一直線，沒有轉彎 —— 不是頂點。這兩根是同一條邊。',",
      replace:"      gClayStraight:'這裡不是頂點。'," },
    { file:'index', expect:"the round has no drag",
      find:"        find:'點出所有的四邊形。這一關用點的。'",
      replace:"        find:'點出所有的四邊形。'" },
    { file:'index', expect:"do not mention the tap-then-tap way",
      find:"        clay:'Stick a clay ball on every corner. Drag the clay onto a join. Or tap the clay, then tap the join.',",
      replace:"        clay:'Stick a clay ball on every corner. Drag the clay onto a join.'," },
    { file:'index', expect:"the card label must not name the shape",
      find:"gCardLabel:'圖形卡',",
      replace:"gCardLabel:'三角形卡'," },
    { file:'index', expect:"gives a number away at level 1",
      find:"        walk:'一次只走到旁邊的頂點，沿著邊走。',",
      replace:"        walk:'一次只走到旁邊的頂點，沿著邊走，一共 5 條。'," },
    /* 吸附範圍小到邊和對角線從不重疊：「挑最近的線」永遠用不到，端對端的重疊測試也無從驗起 */
    { file:'index', expect:"the nearest-line rule is never exercised",
      find:"  var LOOP_H = 304, LOOP_FIG = { x:28, y:8, s:1.9 }, LOOP_BALL = 26, LOOP_PAD = 22, SEG_END = 0.2;",
      replace:"  var LOOP_H = 304, LOOP_FIG = { x:28, y:8, s:1.9 }, LOOP_BALL = 26, LOOP_PAD = 8, SEG_END = 0.2;" },
    /* codex 第一輪：RENDER 本體一開始就 return，need() 的字面掃描照樣全綠 —— 只有真的跑起來才抓得到 */
    { file:'index', expect:"render find zh: the board is 0 high",
      find:"    find: function(d){\n",
      replace:"    find: function(d){ return;\n" },
    /* 第 1 關一開始就把外框畫好了（畫面洩漏答案） */
    { file:'index', expect:"straws drawn after",
      find:"        setSVG(svg, LOOP_H, segs.filter(function(s){ return s.done; }).map(function(s){",
      replace:"        setSVG(svg, LOOP_H, segs.filter(function(s){ return s.edge; }).map(function(s){" },
    { file:'index', expect:"sides lit after",
      find:"          out += svgLine(a, b, '#E8871E', 8, ' class=\"gwalked\"');",
      replace:"          out += svgLine(a, a, '#E8871E', 8, ' class=\"gwalk\"');" },
    { file:'index', expect:"the line reads",
      find:"        line.textContent = d.gWalkNow(path.length - 1);",
      replace:"        line.textContent = d.gWalkNow(path.length);" },
    { file:'index', expect:"corners are not drawn as filled",
      find:"        t.z.classList.add('filled'); t.z.classList.remove('ghint');",
      replace:"        t.z.classList.remove('ghint');" },
    { file:'index', expect:"render sort",
      find:"        placed++;\n        line.textContent = d.gSortNow(placed, ids.length);",
      replace:"        placed += 2;\n        line.textContent = d.gSortNow(placed, ids.length);" },
    { file:'index', expect:"render find",
      find:"          b.classList.add('found'); b.classList.remove('ghint'); found++;",
      replace:"          b.classList.add('found'); b.classList.remove('ghint'); found += 2;" },
    /* codex 第一輪：圍好了還說「還有 0 個缺口」 */
    { file:'index', expect:"hint 2 threw",
      find:"        if (!g.length){ glow([doneBtn]); return d.gLoopReady; }\n",
      replace:"" },
    /* codex 第一輪：說「那一個」卻亮兩個 */
    { file:'index', expect:"must make ONE corner glow",
      find:"}).slice(0, 1).map(function(c){ return c.z; }));",
      replace:"}).map(function(c){ return c.z; }));" },
    { file:'index', expect:"is not bounced with gClayStraight",
      find:"        if (r === 'straight'){ roundMiss(d.gClayStraight); return false; }",
      replace:"        if (r === 'straight'){ roundMiss(d.gClayStraight); return true; }" },
    /* codex 第一輪：池子裡重複的題目 */
    { file:'index', expect:"GAME_CLAY has a repeated entry",
      find:"    { pts:[[150,26],[206,120],[262,214],[38,214]] },",
      replace:"    { pts:[[150,26],[262,214],[150,214],[38,214]] }," },
    /* codex 第一輪：重複的卡 */
    { file:'index', expect:"SORT_TRI has a repeated entry",
      find:"  var SORT_TRI = ['tri', 'triTilt', 'triThin'],",
      replace:"  var SORT_TRI = ['tri', 'tri', 'triThin']," },
    /* codex 第一輪：吸管往回折、疊在一起 */
    { file:'index', expect:"fold back on themselves",
      find:"    { pts:[[40,50],[150,50],[260,50],[260,200],[150,200],[40,200]] },",
      replace:"    { pts:[[40,50],[260,50],[150,50],[260,200],[150,200],[40,200]] }," },
    /* codex 第一輪：一顆星的那一句沒有人驗 */
    { file:'index', expect:"gStars zh: numbers should read 1",
      find:"      gStars:function(n){ return '⭐ +' + n; },\n      gClear:'按「下一關」繼續。',",
      replace:"      gStars:function(n){ return '⭐ +' + (n === 1 ? 2 : n); },\n      gClear:'按「下一關」繼續。'," },
    /* codex 第一輪：第 9 格的無障礙標籤洩漏答案 */
    { file:'index', expect:"gShapeLabel(9)",
      find:"      gShapeLabel:function(k){ return 'shape ' + k; },",
      replace:"      gShapeLabel:function(k){ return k === 9 ? 'quadrilateral 9' : ('shape ' + k); }," },
    { file:'index', expect:"gLoopReady",
      find:"      gLoopReady:'已經圍成一圈了，按「圍好了」。',",
      replace:"      gLoopReady:'已經圍成一圈了。'," },
    /* codex 第二輪：池子最後一張永遠發不到 —— 那一張的畫法與判斷從來沒跑過 */
    { file:'index', expect:"was never dealt",
      find:"  function pickN(arr, n){ return shuffle(arr).slice(0, n); }",
      replace:"  function pickN(arr, n){ return shuffle(arr.slice(0, n + 1)).slice(0, n); }" }
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
    dataReturn: '{FIGS, STRAW_STEPS, SIDE_FIGS, VERT_FIGS, TABLE_ROWS, figSVG, strawSVG, sidesOf, GAME_W, GPICK, GPAD, GAME_ORDER, figXY, familyOf, GAME_LOOP, LOOP_H, LOOP_FIG, LOOP_BALL, LOOP_PAD, SEG_END, LOOP_SRC, loopSegs, nearestSeg, loopRule, loopDone, GAME_WALK, WALK_H, WALK_FIG, WALK_STAR, WALK_BADGE, walkStep, GAME_CLAY, CLAY_H, CLAY_JOINT, CLAY_SRC, isTurn, clayDrop, clayLeft, SORT_TRI, SORT_QUAD, SORT_BINS, SORT_H, SORT_BIN, SORT_CARD, sortSlotXY, GAME_ODD, FIND_QUAD, FIND_OTHER, FIND_H, FIND_CELL, findWhy, oddSVG}',
    check: function(data, I18N, fail, src){
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

      /* --- 小遊戲（§六之五：五關五種玩法）--- */
      try { gameCheck(data, I18N, fail, src); } catch (e){ fail('game: the check could not finish (' + e.message + ')'); }
      try { renderRun(data, I18N, fail, src); } catch (e){ fail('render: the check could not finish (' + e.message + ')'); }

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
        data.STRAW_STEPS.forEach(n => push(d.p1Line(n)));
        data.SIDE_FIGS.forEach(id => { push(d.sideChip(id, FIG_SIDES[id])); push(d.p2End(FIG_SIDES[id], id)); });
        data.VERT_FIGS.forEach(id => { push(d.vertChip(id, FIG_SIDES[id])); push(d.p3End(FIG_SIDES[id])); });
        /* p2End／p3End 對每一個圖形都叫一次，不只清單裡那四個 —— 換清單時才不會漏。 */
        figIds.forEach(id => { if (FIG_SIDES[id] > 0){ push(d.p2End(FIG_SIDES[id], id)); push(d.p3End(FIG_SIDES[id])); } });
        data.TABLE_ROWS.forEach(row => {
          push(d.tabChip(row.key));
          push(d.t1(row.key, row.sides)); push(d.t2(row.key, row.sides)); push(d.t3(row.key, row.sides));
        });
        /* 小遊戲：每一關的說明、提示，和每一個函式在這一課到得了的每一組參數 */
        data.GAME_ORDER.forEach(t => { push(d.gAsks[t]); push(d.gHints[t]); });
        data.SORT_BINS.forEach(k => push(d.names[k]));
        [3, 4, 5, 6].forEach(n => { push(d.gLoopDone(n)); push(d.gWalkDone(n)); push(d.gWalkTotal(n)); push(d.gFindWhy('count', n)); });
        [0, 1, 2, 3, 4, 5, 6].forEach(k => { push(d.gLoopNow(k)); push(d.gLoopGap(k)); push(d.gLoop2(k)); push(d.gWalkNow(k)); push(d.gWalk2(k));
          push(d.gClayNow(k)); push(d.gClay2(k)); push(d.gSortNow(k, 6)); push(d.gSort2(k)); push(d.gFindNow(k, 4)); push(d.gFind2(k)); });
        data.GAME_CLAY.forEach(e => { const m = e.pts.length, n = e.pts.filter((_, j) => data.isTurn(e.pts, j)).length; push(d.gClayDone(n, m)); });
        figIds.forEach(id => { const f = data.familyOf(id); if (f) push(d.gSortWrong(FIG_SIDES[id], f)); });
        ['circle', 'open', 'cross'].forEach(w => push(d.gFindWhy(w, 4)));
        [d.gLoopCross, d.gLoopEmpty, d.gLoopBtn, d.gWalkSkip, d.gWalkBack, d.gClayStraight, d.gSortDone, d.gFindDone(4), d.gClear, d.gWin(10)].forEach(push);
        [d.p2Start, d.p3Start, d.t0].forEach(push);
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
