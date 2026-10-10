/* grade-5/math/rounding（差不多剛剛好 —— 小數的概數與四捨五入、無條件進位／捨去、估算抓錯）的檢查設定。
   這一課以前沒有設定檔（simgen／verify_lesson_data／breaktest 對這一課都跑不起來）；2026-10-10 小遊戲照 §六之五 重做時新增。

   範圍取自課程自己的範例：目標位只有「整數、小數第一位、小數第二位」；題目裡的數最多三位小數、整數最多兩位。

   這一課的守門重點：

   ① **課程教的規則有兩個說法，它們必須永遠一致。** 「只看目標位右邊隔壁那一位，0～4 捨、5～9 入」
      與「停在數線上比較近的那一個地標，剛好正中間就往上」。這裡把**數線那一套**獨立實作一次
      （`roundByLine`：把數寫成分數、比兩段距離，不看任何一個數字），再拿去比課程的每一個答案。
   ② **畫面上的每一句說明，數字要對、說的那件事要成立。** 「比較靠近」在正中間是假的；
      「數量級不對」對 71 和 25 是假的；「小數點放錯了」必須真的是放錯了小數點。
   ③ **小遊戲的每一關照遊戲自己的規則玩一遍**，證明一定解得完、解完一定是對的答案；
      收不收的純函式從資料區拿來直接跑，`shuffle()`／`nearestOpen()`／`roundMiss()` 從原始碼切出來真的跑。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();

/* ---------------- 第二套實作：精確的小數（整數 n 除以 10^k） ---------------- */
function dec(s){
  s = String(s).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error('not a plain decimal: ' + s);
  const i = s.indexOf('.');
  return { n:Number(s.replace('.', '')), k:i < 0 ? 0 : s.length - i - 1 };
}
const P10 = k => Math.pow(10, k);
/* 整數 r 寫成 p 位小數（自己的格式化，不呼叫課程的 ticksToStr） */
function fmtP(r, p){
  let s = String(r);
  if (p === 0) return s;
  while (s.length < p + 1) s = '0' + s;
  return s.slice(0, s.length - p) + '.' + s.slice(s.length - p);
}
/* 數線那一套：value 夾在 lower 和 lower + 1（以 10^-p 為單位）中間；比兩段距離，一樣遠就往上。不看任何一個數字。 */
function roundByLineInt(s, p){
  const { n, k } = dec(s);
  if (k <= p) return n * P10(p - k);
  const lower = Math.floor(n / P10(k - p));
  const rest = n - lower * P10(k - p);          // 0 ≤ rest < 10^(k−p)
  return (rest * 2 >= P10(k - p)) ? lower + 1 : lower;
}
function roundByLine(s, p){ return fmtP(roundByLineInt(s, p), p); }
/* 第 q 位的數字（q ＝ 0 個位、1 小數第一位、−1 十位），用字串位置算 */
function digitAtRef(s, q){
  const i = s.indexOf('.'), ip = i < 0 ? s : s.slice(0, i), fp = i < 0 ? '' : s.slice(i + 1);
  if (q >= 1) return q <= fp.length ? +fp[q - 1] : 0;
  const at = ip.length - 1 + q;   // q = 0 → 最後一個整數位
  return at >= 0 ? +ip[at] : 0;
}
/* 精確比較：a、b 兩個小數字串相等？ */
function decEq(a, b){ const x = dec(a), y = dec(b), k = Math.max(x.k, y.k); return x.n * P10(k - x.k) === y.n * P10(k - y.k); }
/* 小數字串 → 以 10^-k 為單位的整數 */
function decAt(s, k){ const x = dec(s); if (x.k > k) throw new Error(s + ' has more than ' + k + ' decimals'); return x.n * P10(k - x.k); }
/* 去掉小數最後的 0 */
function trimDec(s){ return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, ''); }
/* 印出來的數（整數或小數）依序 */
function numsOf(text){ return String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []; }

const PLACE_ZH = ['整數', '小數第一位', '小數第二位'];
const PLACE_EN = ['the nearest whole number', 'the first decimal place', 'the second decimal place'];
const PLACES = { zh:PLACE_ZH, en:PLACE_EN };
function digitNameRef(q, L){
  if (L === 'zh') return q < 0 ? '十位' : (q === 0 ? '個位' : '小數第' + ['一', '二', '三'][q - 1] + '位');
  return q < 0 ? 'tens digit' : (q === 0 ? 'ones digit' : ['first', 'second', 'third'][q - 1] + ' decimal place');
}
function roundNameRef(q, L){
  if (L === 'zh') return q === 0 ? '整數' : digitNameRef(q, L);
  return q === 0 ? 'the nearest whole number' : (q < 0 ? 'the nearest ten' : 'the ' + digitNameRef(q, L));
}

/* 「a ÷ b = q 箱又 r 顆」這種商與餘數的寫法：decArith 會把 a ÷ b = q 當成錯的等式，所以先自己驗、再拿掉。 */
const QR_RE = /(\d+) ÷ (\d+) = (\d+) (?:箱|袋|boxes|bags) ?(?:又 |with )(\d+)/g;
function arithText(text, where, fail){
  let t = String(text).replace(/<[^>]+>/g, ' '), qr = 0;
  t = t.replace(QR_RE, (m, a, b, q, r) => {
    qr++;
    if (!(+b * +q + +r === +a && +r < +b && +r > 0)) fail(where + ': "' + m + '" is not a quotient and remainder of ' + a + ' ÷ ' + b);
    return ' QR ';
  });
  t = t.replace(/(\d+)%/g, '($1 ÷ 100)');
  const r = decArith(t);
  r.problems.forEach(p => fail(where + ': ' + p));
  r.qr = qr;
  return r;
}
/* 算式掃描器自己先跑正反例（掃描器壞掉會讓每一條都靜靜讀不到） */
const CLAIM_PROBES = [
  { t:'20 + 8 = 28', bad:false }, { t:'19.6 + 8.3 = 27.9', bad:false }, { t:'138 ÷ 25 = 5 袋又 13 顆', bad:false },
  { t:'137 ÷ 20 = 6 boxes with 17 left over', bad:false }, { t:'200 × 25% = 200 × 25 ÷ 100 = 50', bad:false },
  { t:'20 + 8 = 29', bad:true }, { t:'138 ÷ 25 = 5 袋又 12 顆', bad:true }, { t:'3.9 × 4 = 1.56', bad:true },
  { t:'137 ÷ 20 = 6 boxes with 27 left over', bad:true }, { t:'200 × 25% = 40', bad:true }
];

/* ---------------- review.html 的產生器 ---------------- */
const RANGE = {
  roundInt:[0, 100], roundTenths:[0, 30], roundHundredths:[0, 20], carryCase:[0, 30], ceilingWord:[1, 300],
  floorWord:[0, 13], estimateProduct:[1, 100], whichDigit:[0, 9], avgSimple:[1, 100], decimalDivideSimple:[0, 200], percentSimple:[0, 200]
};
/* 四捨五入題的選項最多幾位小數（題目最多到小數第三位） */
const MAXDP = { roundInt:1, roundTenths:2, roundHundredths:3, carryCase:2, ceilingWord:0, floorWord:0, estimateProduct:0, whichDigit:0, avgSimple:0, decimalDivideSimple:1, percentSimple:1 };

/* ---------------- index.html 的三層題庫：正解從題幹重算 ---------------- */
/* kind：round（題幹的第一個小數四捨五入到題幹說的位）、floor、ceil、estimateSum（兩個小數各取整數再加） */
const BANK_EXPECTED = {
  qs: [
    { num:'3.847',  p:1, ans:'3.8',  look:4, kind:'round' },
    { num:'12.638', p:0, ans:'13',   look:6, kind:'round' },
    { num:'0.954',  p:2, ans:'0.95', look:4, kind:'round' },
    { num:'9.982',  p:1, ans:'10.0', look:8, kind:'round' },
    { num:'24.505', p:0, ans:'25',   look:5, kind:'round' },
    { num:'3.968',  p:1, ans:'4.0',  look:6, kind:'round' }
  ],
  qsAdv: [
    { num:'1.284', p:2, ans:'1.28', look:4, kind:'round' },
    { num:'6.75',  ans:'6',  kind:'floor' },
    { a:138, b:25, ans:'6',  kind:'ceil' },
    { x:'19.6', y:'8.3', ans:'28', kind:'estimateSum' }
  ],
  qsBoost: [
    { num:'3.847', p:1, ans:'3.8', look:4, kind:'round' },
    { num:'3.46',  p:0, ans:'3',   look:4, kind:'round' }
  ]
};

/* ---------------- 小遊戲 ---------------- */
const PHONE_K = Math.min(1.5, 289 / 300);
function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  const TYPES = ['line', 'cut', 'build', 'pack', 'est'];
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join())
    fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  /* 說明的「意思」：每一句除了數字對，還要說對那件事（必須說／不可以說），兩種語言各自釘住。
     ⚠️ 已知極限（codex 第二輪）：這是子字串比對，不懂否定與語境 —— 「neither stop is nearer」這種正確的改寫會被誤擋，
     而同時寫出所有必須說的詞、卻在別處自相矛盾的句子擋不住。改寫說明時連清單一起改；語意由 codex 審查把關。 */
  const says = (where, text, must, mustNot) => {
    (must || []).forEach(w => { if (!(w instanceof RegExp ? w.test(text) : String(text).indexOf(w) >= 0)) fail(where + ' does not say ' + w + ': ' + text); });
    (mustNot || []).forEach(w => { if (w instanceof RegExp ? w.test(text) : String(text).indexOf(w) >= 0) fail(where + ' must not say ' + w + ': ' + text); });
  };
  const MEAN = {
    zh: {
      hint: { line:[['比較近', '正中間', '約定往上', '下面那一站', '上面那一站'], ['比較遠', '往下']],
              cut:[['目標位要留下來', '剪在目標位的右邊', '決定捨或入'], ['剪在目標位的左邊']],
              build:[['只看目標位右邊隔壁那一位', '0～4 捨', '5～9 入', '往左進位', '整個不要', '0 也要寫出來'], ['寫 0', '一位一位']],
              pack:[['不滿一箱的那一堆也要一箱', '不到 1 公尺的那一段剪不出來'], ['四捨五入']],
              est:[['四捨五入到整數', '小數點放錯', '一定算錯了'], []] },
      line2:[['離'], ['比較遠']], line2half:[['剛好正中間', '約定往上'], ['比較近']],
      leadNo:[['空著'], []], leadYes:[['一路進位', '1'], ['空著']], keep:[['照抄'], ['加 1']], carry:[['進上來', '加 1'], ['照抄']],
      packLeft:[['沒有箱子', '也要一個箱子'], []], packMore:[['整堆', '沒有蓋上箱子'], []], ropeShort:[['不到 1 公尺', '剪不出'], []], ropeMore:[['完整的 1 公尺沒剪'], []],
      pack2:[['一共要'], []], rope2:[['只有', '完整的 1 公尺'], []], est2:[['估計'], ['不可以']], cut2:[['留下來', '剪在'], []]
    },
    en: {
      hint: { line:[['nearer', 'halfway', 'go up', 'lower stop', 'upper stop'], ['farther', 'go down']],
              cut:[['target place is kept', 'cut just to its right', 'decides down or up'], ['to its left']],
              build:[['only at the digit right after the target place', '0–4 goes down', '5–9 goes up', 'carrying left', 'dropped', 'must still be written'], ['becomes 0']],
              pack:[['even the heap that is not a full box gets one', 'shorter than 1 m cannot be cut'], ['ordinary rounding']],
              est:[['round each decimal to a whole number', 'misplaced decimal point', 'must be wrong'], []] },
      line2:[['from'], ['farther']], line2half:[['exactly halfway', 'goes up'], ['nearer']],
      leadNo:[['stays empty'], []], leadYes:[['carry runs all the way', '1'], ['empty']], keep:[['copy'], ['added']], carry:[['carried in', '1 added'], ['copy']],
      packLeft:[['no box', 'needs a box'], []], packMore:[['full heap', 'no box yet'], []], ropeShort:[['less than 1 m', 'cannot be cut'], []], ropeMore:[['whole metre is still uncut'], []],
      pack2:[['in all'], []], rope2:[['only', 'whole metres'], []], est2:[['estimate is'], ['must not']], cut2:[['stays', 'cut between'], []]
    }
  };
  LANGS.forEach(L => {
    const d = I18N[L], M = MEAN[L];
    TYPES.forEach(t => says('gHints.' + t + ' ' + L, d.gHints[t], M.hint[t][0], M.hint[t][1]));
    says('gLine2 ' + L, d.gLine2('3.83', '3.8', '3.9', '0.03', '0.07'), M.line2[0], M.line2[1]);
    says('gLine2 halfway ' + L, d.gLine2('3.85', '3.8', '3.9', '0.05', '0.05'), M.line2half[0], M.line2half[1]);
    says('gBuildLeadNo ' + L, d.gBuildLeadNo, M.leadNo[0], M.leadNo[1]);
    says('gBuildLeadYes ' + L, d.gBuildLeadYes, M.leadYes[0], M.leadYes[1]);
    says('gBuildKeep ' + L, d.gBuildKeep(3), M.keep[0], M.keep[1]);
    says('gBuildCarry ' + L, d.gBuildCarry(3), M.carry[0], M.carry[1]);
    says('gPackLeft ' + L, d.gPackLeft(2), M.packLeft[0], M.packLeft[1]);
    says('gPackMore ' + L, d.gPackMore, M.packMore[0], M.packMore[1]);
    says('gRopeShort ' + L, d.gRopeShort('0.75'), M.ropeShort[0], M.ropeShort[1]);
    says('gRopeMore ' + L, d.gRopeMore, M.ropeMore[0], M.ropeMore[1]);
    says('gPack2 ' + L, d.gPack2(21, 5, 4, 1), M.pack2[0], M.pack2[1]);
    says('gRope2 ' + L, d.gRope2('4.75', 4), M.rope2[0], M.rope2[1]);
    says('gEst2 ' + L, d.gEst2('3.9', 4, '×', '4', null, 16), M.est2[0], M.est2[1]);
    says('gCut2 ' + L, d.gCut2('3.847', d.gDigitName(1), d.gDigitName(2)), M.cut2[0], M.cut2[1]);
    /* 每一個分支各驗一次（codex 第二輪）：9 進位又滿十、目標位的 9 加 1、兩個小數都要取整數的估計 */
    says('gBuildCarry(9) ' + L, d.gBuildCarry(9), L === 'zh' ? ['又滿十', '寫 0 再往左進 1'] : ['makes ten again', 'write 0 and carry 1 further left'], []);
    says('gBuildUp(9) ' + L, d.gBuildUp(d.gDigitName(2), 8, 9), L === 'zh' ? ['要入', '滿十', '寫 0、往左進 1'] : ['goes up', 'makes ten', 'carry 1 to the left'], L === 'zh' ? ['不變'] : ['stays']);
    says('gBuildDown ' + L, d.gBuildDown(d.gDigitName(2), 4, 6), L === 'zh' ? ['要捨', '不變'] : ['goes down', 'stays'], L === 'zh' ? ['加 1'] : ['added']);
    says('gEst2 two decimals ' + L, d.gEst2('19.8', 20, '+', '5.2', '5', 25), (L === 'zh' ? ['19.8 ≈ 20', '5.2 ≈ 5', '估計 20 + 5 是 25'] : ['19.8 ≈ 20', '5.2 ≈ 5', 'estimate is 20 + 5, which is 25']), []);
  });
  /* 英文單複數：1 顆糖 */
  says('gPackOk en r=1', I18N.en.gPackOk(21, 5, 4, 1), ['1 candy left over is'], ['1 left over are']);
  says('gPackOk en r=2', I18N.en.gPackOk(22, 5, 4, 2), ['2 candies left over are'], []);
  says('gPackLeft en r=1', I18N.en.gPackLeft(1), ['1 candy still has'], []);
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    const got = numsOf(text).join();
    if (got !== want.map(String).join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
  };
  const hasWord = (where, text, w) => { if (String(text).indexOf(w) < 0) fail(where + ' does not say "' + w + '": ' + text); };
  const lacks = (where, text, w) => { if (String(text).indexOf(w) >= 0) fail(where + ' must not say "' + w + '": ' + text); };
  const touch = (what, sz) => { if (!(sz * PHONE_K >= 44)) fail(what + ' is ' + (sz * PHONE_K).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  /* 題庫的筆數釘住（刪掉一筆不會有任何一條斷言響）；陣列不可以有洞 */
  const SIZES = { GAME_LINE:7, GAME_CUT:8, GAME_BUILD:10, GAME_PACK:7, GAME_ROPE:6, GAME_EST:5 };
  Object.keys(SIZES).forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length !== SIZES[k]) fail(k + ' has ' + (D[k] ? D[k].length : 'no') + ' entries, this config expects ' + SIZES[k]);
    else for (let i = 0; i < D[k].length; i++) if (!Object.prototype.hasOwnProperty.call(D[k], i)) fail(k + '[' + i + '] is a hole in the array');
  });

  /* ---------- 共用：資料區的小數工具，和自己的算法比 ---------- */
  ['3.847', '12.638', '0.954', '9.982', '24.505', '0.996', '7.25', '19.96', '0.635', '2.095', '5.95', '12.45', '6.449', '3.46', '1.284', '45.27'].forEach(s => {
    const k = dec(s).k;
    if (D.decDp(s) !== k) fail('decDp(' + s + ') = ' + D.decDp(s));
    for (let dp = k; dp <= 4; dp++) if (D.decInt(s, dp) !== decAt(s, dp)) fail('decInt(' + s + ', ' + dp + ') = ' + D.decInt(s, dp));
    for (let p = 0; p < k; p++){
      const got = D.ticksToStr(D.roundT(decAt(s, k), k, p), p);
      if (got !== roundByLine(s, p)) fail('roundT(' + s + ' → place ' + p + ') = ' + got + ', the number-line rule says ' + roundByLine(s, p));
      if (D.roundDecimalStr(s, p) !== roundByLine(s, p)) fail('roundDecimalStr(' + s + ', ' + p + ') = ' + D.roundDecimalStr(s, p) + ', the number-line rule says ' + roundByLine(s, p));
    }
    for (let q = -1; q <= k; q++) if (D.digitOf(s, q) !== digitAtRef(s, q)) fail('digitOf(' + s + ', ' + q + ') = ' + D.digitOf(s, q) + ', expected ' + digitAtRef(s, q));
  });
  /* 整個定義域：0.000 ～ 30.000 每一個三位小數 × 三個目標位，兩套規則一致 */
  {
    let bad = 0;
    for (let t = 0; t <= 30000 && bad < 3; t++){
      const s = fmtP(t, 3);
      for (let p = 0; p <= 2; p++) if (D.roundT(t, 3, p) !== roundByLineInt(s, p)){ bad++; fail('roundT(' + s + ', place ' + p + ') disagrees with the number-line rule'); }
    }
  }
  [[20, 2, '0.2'], [0, 2, '0'], [1074, 2, '10.74'], [9200, 2, '92'], [40, 1, '4']].forEach(([t, dp, want]) => { if (D.decTrim(t, dp) !== want) fail('decTrim(' + t + ', ' + dp + ') = ' + D.decTrim(t, dp) + ', expected ' + want); });

  /* ---------- 共用：shuffle() 真的跑：是排列、不改輸入、而且永遠不會由小到大 ---------- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated on its own: ' + e.message); } }
    if (shuffle){
      [['3.83', '3.86', '3.85'], ['0.634', '0.637', '0.635'], ['19.3', '19.6', '19.5'], [1, 2, 3, 4]].forEach(input => {
        const orders = new Set(), before = input.join();
        for (let i = 0; i < 3000; i++){
          const out = shuffle(input);
          if (input.join() !== before) return fail('shuffle() mutates its input');
          if (out.slice().sort().join() !== input.slice().sort().join()) return fail('shuffle() changed the set: ' + out);
          let up = true; for (let k = 1; k < out.length; k++) if (!(Number(out[k - 1]) < Number(out[k]))) up = false;
          if (up) return fail('shuffle() returned ' + out.join(',') + ' — already in increasing order');
          orders.add(out.join());
        }
        if (orders.size < 3) fail('shuffle() of ' + input.join(',') + ' produced only ' + orders.size + ' orders in 3000 runs');
      });
    }
    need('line', /shuffle\(e\.ns\)\.forEach\(/, 'the trains are not shuffled into rows');
    need('est', /shuffle\(set\)\.forEach\(/, 'the cards are not shuffled into the tray');
  }

  /* ---------- 共用：nearestOpen() 真的跑 ---------- */
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    let nearestOpen = null;
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
    if (nearestOpen){
      /* 排出概數的格子（最寬的那一題）：每一格裡的每一點都判給那一格；兩格中間的縫裡，比較靠後面那一格的點判給它 */
      const G = D.BUILD_G, s = '9.982', h = G.slot / 2;
      const list = []; for (let q = D.buildQmin(s); q <= 2; q++) list.push({ id:q, cx:D.buildColX(s, q), cy:G.slotY + h, hw:h, hh:h, done:false });
      let bad = 0;
      list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 1) { const g = nearestOpen(list, { x, y:b.cy }, 6); if (!g || g.id !== b.id) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside a build box are given to another box (or none)');
      const a = list[0], b = list[1], gapL = a.cx + h, gapR = b.cx - h;
      if (!(gapR > gapL)) fail('build boxes touch — no gap to test the overlap zone in');
      else {
        const px = gapL + (gapR - gapL) * 0.7, g = nearestOpen(list, { x:px, y:a.cy }, 6);
        if (!g || g.id !== b.id) fail('nearestOpen(): a drop in the gap nearer the later box goes to ' + (g ? g.id : 'none') + ' (first match, not nearest)');
      }
      const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
      const r0 = nearestOpen(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every box is accepted');
    }
  }

  /* ---------- 共用：計分（沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0）---------- */
  if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
  {
    const fsrc = extractFunction(src, 'roundMiss');
    if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
    else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
      let r;
      try { r = new Function('var gMistake = false, gSolved = false, gRound = 0, gScore = ' + s0 + ', elScore = {}, gMsg = {}, gNext = { disabled:true }; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake, solved:gSolved, round:gRound, next:gNext.disabled };')(); }
      catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
      if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
      if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
      if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
      if (r.solved || r.round !== 0 || !r.next) fail('scoring: a mistake at ' + s0 + ' points ends or skips the round — the game must never be over');
    });
    /* 過關：沒犯錯 +20、犯過錯 +10，只加一次；最後一關不開「下一關」 */
    const ssrc = extractFunction(src, 'roundSolved');
    if (!ssrc) fail('scoring: cannot find roundSolved() in index.html');
    else [[false, 0, 40, 60], [true, 0, 40, 50], [false, 4, 80, 100], [true, 4, 0, 10]].forEach(([mist, rd, s0, want]) => {
      let r;
      try { r = new Function('var gMistake = ' + mist + ', gSolved = false, gRound = ' + rd + ', gScore = ' + s0 + ', GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, elHint = { textContent:"old hint" }, gHintBtn = {}, gNext = { disabled:true },\n' +
        'gameStage = { querySelectorAll:function(){ return []; } }; function L(){ return { gPts:function(n){ return "+" + n; }, gWin:function(s){ return "WIN " + s; }, gClear:"NEXT" }; }\n' + ssrc +
        '\nroundSolved("ok"); var once = gScore; roundSolved("ok"); return { s:gScore, once:once, shown:elScore.textContent, html:gMsg.innerHTML, next:gNext.disabled, hint:elHint.textContent, solved:gSolved };')(); }
      catch (e){ return fail('scoring: roundSolved() could not run: ' + e.message); }
      if (r.once !== want || r.s !== want || String(r.shown) !== String(want)) fail('scoring: solving ' + (mist ? 'after mistakes' : 'cleanly') + ' from ' + s0 + ' gives ' + r.once + ' (then ' + r.s + '), expected ' + want + ' once');
      if (!r.solved || r.hint !== '') fail('scoring: roundSolved() does not mark the round solved or clear the hint');
      if (r.next !== (rd === 4)) fail('scoring: after round ' + (rd + 1) + ' "Next" is ' + (r.next ? 'off' : 'on'));
      if ((r.html.indexOf('WIN') >= 0) !== (rd === 4)) fail('scoring: the final message shows on the wrong round');
    });
    const nsrc = extractFunction(src, 'roundNote');
    if (!nsrc) fail('scoring: cannot find roundNote() in index.html');
    else {
      let r;
      try { r = new Function('var gMistake = false, gScore = 20, elScore = {}, gMsg = {};\n' + nsrc + '\nroundNote("why"); return { s:gScore, m:gMistake, html:gMsg.innerHTML };')(); } catch (e){ fail('roundNote() could not run: ' + e.message); }
      if (r && (r.s !== 20 || r.m)) fail('scoring: a reminder (roundNote) costs points or records a mistake');
      if (r && r.html.indexOf('why') < 0) fail('scoring: roundNote() does not show its text');
    }
  }
  /* 換畫板之後，還拿在手上的舊積木放開時不可以動到新的那一關 */
  if (!/if \(gen !== gGen\) return;/.test(src) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src))
    fail('the drag engine has no board-generation guard: a piece held across Restart could act on the new board');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('startRound() does not bump gGen');
  if (!/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/.test(src)) fail('a second finger can pick up a piece (pointerdown does not check isPrimary)');
  if ((src.match(/if \(!start \|\| e\.pointerId !== pid\) return;/g) || []).length !== 2) fail('the drag engine does not follow only the first finger (move and end must both check pointerId)');
  if (!/document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(src)) fail('the drag engine has no document-level release while dragging');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on lostpointercapture');
  if (!/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on pointercancel');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('placed pieces still take pointer events');
  /* 放開時判的是那一塊畫出來的位置（中心點），不是按下去的地方 */
  if (!/if \(!\(B\.onDrop && B\.onDrop\(P, \{ x:P\.cx, y:P\.cy \}\)\)\) P\.home\(\);/.test(src)) fail('a drop is not judged where the piece is drawn (its centre) when released');
  if (!/if \(o\.axis === 'x'\) P\.place\(Math\.max\(o\.minX, Math\.min\(o\.maxX, orig\.x \+ dx\)\), orig\.y\);\n\s*else P\.place\(orig\.x \+ dx, orig\.y \+ dy\);/.test(src)) fail('a dragged piece does not follow the finger');
  /* 拿不完的卡用點的放好之後繼續選著；孩子照說明再點它一下，要還是選著（第二個 0），不可以被當成「取消」 */
  if (!/if \(B\.selected === P && B\.kept === P\)\{ B\.kept = null; return; \}/.test(src) || !/B\.selected = P; B\.kept = P; P\.el\.classList\.add\('sel'\);/.test(src))
    fail('re-tapping a kept-selected reusable card (as the instruction says) unselects it — the next tap on a box does nothing');
  if ((src.match(/e\.target\.closest\('\.gpiece, button'\)/g) || []).length !== 2) fail('pressing a button on the board counts as tapping a destination (it drops / unselects the held piece)');
  if (!/elHint\.textContent = '';   \/\* 過關了/.test(src)) fail('the hint is not cleared when a round is solved');
  TYPES.forEach(t => { if ((B[t].match(/useTapSelect\(B, function\(P, pt\)\{/g) || []).length !== 1) fail(t + ': the round does not install its drop / tap-then-tap handler (useTapSelect)'); });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/gameStage\.textContent = '';/.test(src)) fail('startRound() does not clear the stage before drawing');
  LANGS.forEach(L => {
    seq('gPts ' + L, I18N[L].gPts(20), [20]);
    seq('gMinus ' + L, I18N[L].gMinus, [5]);
    if (numsOf(I18N[L].gWin(85)).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score');
  });

  /* ================= 第 1 關：開進站 ================= */
  {
    const G = D.LINE_G;
    touch('a train (' + G.trainW + '×' + G.trainH + ')', Math.min(G.trainW, G.trainH));
    if (G.rowY.length !== 3) fail('LINE_G.rowY should have 3 rows');
    for (let r = 1; r < G.rowY.length; r++) if (G.rowY[r] - G.rowY[r - 1] < Math.max(G.trainH, G.stH)) fail('line rows ' + r + ' and ' + (r + 1) + ' are closer than a train/stop');
    for (let x = G.X0; x <= G.X1; x += 0.25){
      const want = Math.abs(x - G.X0) <= G.dock ? 'lo' : (Math.abs(x - G.X1) <= G.dock ? 'hi' : null);
      if (D.lineDock(x) !== want){ fail('lineDock(' + x + ') = ' + D.lineDock(x) + ', expected ' + want); break; }
    }
    if (G.dock >= (G.X1 - G.X0) / 2) fail('LINE_G.dock reaches past halfway');
    const places = new Set();
    D.GAME_LINE.forEach((e, i) => {
      const w = 'GAME_LINE[' + i + ']', p = e.place;
      places.add(p);
      if (!(p >= 0 && p <= 2)) return fail(w + ': place ' + p + ' out of 0~2');
      if (dec(e.lo).k !== p) fail(w + ': the lower stop ' + e.lo + ' should have exactly ' + p + ' decimals');
      const lo = e.lo, hi = fmtP(decAt(lo, p) + 1, p), mid = fmtP(decAt(lo, p) * 10 + 5, p + 1);
      if (D.lineHi(e) !== hi) fail(w + ': lineHi = ' + D.lineHi(e) + ', expected ' + hi);
      if (D.lineMid(e) !== mid) fail(w + ': lineMid = ' + D.lineMid(e) + ', expected ' + mid);
      if (!Array.isArray(e.ns) || e.ns.length !== 3) return fail(w + ': needs exactly 3 trains');
      if (new Set(e.ns).size !== 3) fail(w + ': duplicate trains');
      const cnt = { below:0, above:0, half:0 };
      e.ns.forEach(n => {
        if (dec(n).k !== p + 1) return fail(w + ': train ' + n + ' should have exactly one more decimal than the stops');
        const t = decAt(n, p + 1), lt = decAt(lo, p + 1), ht = decAt(hi, p + 1);
        if (!(t > lt && t < ht)) return fail(w + ': train ' + n + ' is not strictly between ' + lo + ' and ' + hi);
        const rel = t - lt;
        if (D.lineRel(e, n) !== rel) fail(w + ': lineRel(' + n + ') = ' + D.lineRel(e, n) + ', expected ' + rel);
        /* 第二套：比距離 */
        const goal = roundByLine(n, p);
        if (!decEq(goal, lo) && !decEq(goal, hi)) fail(w + ': ' + n + ' rounds to ' + goal + ', not one of the two stops');
        const want = D.lineWant(rel);
        if (!decEq(want === 'hi' ? hi : lo, goal)) fail(w + ': the game would accept ' + want + ' for ' + n + ', the nearer stop is ' + goal);
        if (rel * 2 === 10) cnt.half++; else if (rel < 5) cnt.below++; else cnt.above++;
        const x = D.lineTrainX(rel), xm = (G.X0 + G.X1) / 2;
        if (Math.abs(x - (G.X0 + (G.X1 - G.X0) * (t - lt) / (ht - lt))) > 1e-9) fail(w + ': lineTrainX(' + rel + ') is not ' + n + '\'s place on the line');
        if (rel * 2 !== 10 && Math.abs(x - xm) < (G.X1 - G.X0) / 10 - 1e-9) fail(w + ': train ' + n + ' sits within 1/10 of halfway — the picture hardly decides');
        if (Math.abs(x - G.X0) <= G.dock || Math.abs(x - G.X1) <= G.dock) fail(w + ': train ' + n + ' starts inside a stop\'s dock range');
        const tb = box(x, 0, G.trainW, G.trainH), s0 = box(G.X0, 0, G.stW, G.stH), s1 = box(G.X1, 0, G.stW, G.stH);
        if (hit(tb, s0) || hit(tb, s1)) fail(w + ': train ' + n + ' covers a stop at the start');
        /* 距離的字：兩段加起來剛好是兩站的距離，而且寫成小數 */
        const ds = D.lineDist(e, rel), dLo = fmtP(rel, p + 1), dHi = fmtP(10 - rel, p + 1);
        if (ds.lo !== dLo || ds.hi !== dHi) fail(w + ': lineDist(' + n + ') = ' + JSON.stringify(ds) + ', expected ' + dLo + ' / ' + dHi);
        LANGS.forEach(L => {
          const d = I18N[L];
          if (rel * 2 === 10){
            if (dLo !== dHi) fail(w + ': ' + n + ' is called halfway but is not');
            seq('gLineHalf ' + L + ' ' + n, d.gLineHalf(n, lo, hi, dLo), [n, lo, hi, dLo, hi]);
            seq('gLineOkHalf ' + L + ' ' + n, d.gLineOkHalf(n, hi), [n, hi]);
          } else {
            const nearSt = want === 'lo' ? lo : hi, far = want === 'lo' ? hi : lo, dNear = want === 'lo' ? dLo : dHi, dFar = want === 'lo' ? dHi : dLo;
            if (!(dec(dNear).n < dec(dFar).n)) fail(w + ': the reason calls ' + nearSt + ' nearer to ' + n + ' but it is not');
            const t2 = d.gLineFar(n, far, nearSt, dFar, dNear);
            if (L === 'zh') seq('gLineFar zh ' + n, t2, [n, far, dFar, nearSt, dNear, nearSt, nearSt]);
            else seq('gLineFar en ' + n, t2, [n, dFar, far, dNear, nearSt, nearSt, nearSt]);
            seq('gLineOk ' + L + ' ' + n, d.gLineOk(n, nearSt), [n, nearSt]);
          }
          const h2 = d.gLine2(n, lo, hi, dLo, dHi);
          seq('gLine2 ' + L + ' ' + n, h2, dLo === dHi ? (L === 'zh' ? [n, lo, hi, dLo] : [n, dLo, lo, hi]) : (L === 'zh' ? [n, lo, dLo, hi, dHi] : [n, dLo, lo, dHi, hi]));
        });
      });
      if (cnt.below !== 1 || cnt.above !== 1 || cnt.half !== 1) fail(w + ': needs one train below halfway, one above, one exactly halfway — got ' + JSON.stringify(cnt));
      LANGS.forEach(L => [lo, hi].forEach(v => { const t = I18N[L].gStation(v); if (numsOf(t).join() !== v) fail('gStation ' + L + ' ' + v + ': ' + t); }));
    });
    if (places.size !== 3) fail('GAME_LINE should round to all three places (whole number, 1st and 2nd decimal place)');
    if (!D.GAME_LINE.some(e => /\.0$|\.\d0$/.test(D.lineHi(e)) || (e.place > 0 && D.lineHi(e).slice(-1) === '0'))) fail('GAME_LINE has no upper stop that carries (like 5.9 → 6.0)');
    G.rowY.forEach((y, r) => {
      inside(box(G.X0, y, G.stW, G.stH), 'line row ' + (r + 1) + ' lower stop', G.H);
      inside(box(G.X1, y, G.stW, G.stH), 'line row ' + (r + 1) + ' upper stop', G.H);
      inside(box(G.X0, y, G.trainW, G.trainH), 'a train docked at the lower stop of row ' + (r + 1), G.H);
      inside(box(G.X1, y, G.trainW, G.trainH), 'a train docked at the upper stop of row ' + (r + 1), G.H);
    });
    if (G.axisY <= G.rowY[2] + G.stH / 2) fail('the number line runs through the bottom row of stops');
    [G.X0, G.X1].forEach(x => inside({ x:x - 28, y:G.axisY + G.lblDy, w:56, h:G.lblH }, 'the number-line label at ' + x, G.H));
    inside({ x:(G.X0 + G.X1) / 2 - 50, y:G.axisY + G.midDy, w:100, h:G.midH }, 'the "halfway" label', G.H);
    if (G.lblDy + G.lblH > G.midDy) fail('the halfway label runs into the stop labels');
    need('line', /addZone\(B, v\[0\] - 28, G\.axisY \+ G\.lblDy, 56, G\.lblH, v\[2\], v\[1\]\);/, 'the stop labels are not 56 wide under their ticks');
    need('line', /var n = P\.data\.n, rel = P\.data\.rel, want = lineWant\(rel\), ds = lineDist\(e, rel\);/, 'the accepted stop is not lineWant()');
    need('line', /if \(kind !== want\)\{/, 'a train driven to the wrong stop is not refused');
    need('line', /: want === 'lo' \? d\.gLineFar\(n, hi, lo, ds\.hi, ds\.lo\) : d\.gLineFar\(n, lo, hi, ds\.lo, ds\.hi\)\);/, 'the far-stop reason is not given as (number, far stop, near stop, far distance, near distance)');
    need('line', /roundMiss\(rel \* 2 === 10 \? d\.gLineHalf\(n, lo, hi, ds\.lo\)/, 'the halfway train is not told "equally far, go up"');
    need('line', /\} else kind = lineDock\(P\.cx\);\n\s*if \(!kind\) return false;/, 'a train stopped halfway along is not sent back silently');
    need('line', /if \(!st \|\| st\.row !== P\.data\.row\) return false;/, 'a tap on another row\'s stop is not ignored');
    need('line', /axis:'x', minX:G\.X0, maxX:G\.X1,/, 'the trains are not kept on their track (axis x between the stops)');
    need('line', /addPiece\(B, \{ w:G\.trainW, h:G\.trainH, cx:lineTrainX\(rel\), cy:y, text:n,/, 'a train is not drawn at lineTrainX() with its own number');
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(rel => { const want = rel * 2 >= 10 ? 'hi' : 'lo'; if (D.lineWant(rel) !== want) fail('lineWant(' + rel + ') = ' + D.lineWant(rel) + ', expected ' + want); });
  }

  /* ================= 第 2 關：剪一刀 ================= */
  {
    const G = D.CUT_G;
    touch('the scissors (' + G.knob + ')', G.knob);
    if (G.boxW > G.pitch - 2) fail('cut digit boxes touch (box ' + G.boxW + ', pitch ' + G.pitch + ')');
    if (G.pointD + 4 > G.pitch + G.dot - G.boxW) fail('the decimal point does not fit in the gap after the ones digit');
    const places = new Set();
    D.GAME_CUT.forEach((e, i) => {
      const w = 'GAME_CUT[' + i + '] ' + e.n, s = e.n, k = dec(s).k, ip = s.indexOf('.'), len = s.length - 1;
      places.add(e.place);
      if (ip < 1 || ip > 2) return fail(w + ': needs a decimal point and 1~2 whole-number digits');
      if (!(e.place >= 0 && e.place <= 2 && e.place < k)) return fail(w + ': place ' + e.place + ' does not fit (needs a digit after it)');
      if (D.cutLen(s) !== len) fail(w + ': cutLen = ' + D.cutLen(s));
      if (!D.GAME_CUT.some(x => x.place !== e.place)) fail(w + ': no other entry with a different place');
      for (let j = 0; j <= len; j++) if (D.cutNearest(s, D.cutX(s, j)) !== j) fail(w + ': cutNearest(cutX(' + j + ')) is not ' + j);
      /* 縫的位置：縫 j 在「右邊剩 j 個數字」的兩個數字中間；個位和小數第一位中間那一條比較寬（小數點畫在那裡） */
      const dx = []; for (let a = 0; a < len; a++) dx.push(D.cutDigitX(s, a));
      for (let a = 1; a < len; a++){
        const gap = dx[a] - dx[a - 1], wantGap = G.pitch + (a === ip ? G.dot : 0);
        if (Math.abs(gap - wantGap) > 1e-9) fail(w + ': digits ' + (a - 1) + ' and ' + a + ' are ' + gap + ' apart, expected ' + wantGap);
      }
      for (let j = 1; j < len; j++){ const want = (dx[len - j - 1] + dx[len - j]) / 2; if (Math.abs(D.cutX(s, j) - want) > 1e-9) fail(w + ': cutX(' + j + ') is not between its two digits'); }
      const minX = Math.max(D.cutX(s, len), G.knob / 2 + 2), maxX = Math.min(D.cutX(s, 0), W - G.knob / 2 - 2);
      for (let x = minX; x <= maxX; x += 0.25){
        let bj = 0, bd = Infinity, tie = false;
        for (let j = 0; j <= len; j++){ const dd = Math.abs(x - D.cutX(s, j)); if (dd < bd - 1e-9){ bd = dd; bj = j; tie = false; } else if (Math.abs(dd - bd) < 1e-9) tie = true; }
        if (tie) continue;
        if (D.cutNearest(s, x) !== bj){ fail(w + ': cutNearest(' + x + ') = ' + D.cutNearest(s, x) + ', the nearest gap is ' + bj); break; }
      }
      [0, 1].forEach(row => {
        const y0 = 4 + row * G.rowH;
        [minX, maxX].forEach(x => inside(box(x, y0 + G.knobY, G.knob, G.knob), w + ' scissors at its end in row ' + (row + 1), G.H));
        for (let a = 0; a < len; a++) inside({ x:dx[a] - G.boxW / 2, y:y0 + G.digitY, w:G.boxW, h:G.boxH }, w + ' digit box ' + a + ' in row ' + (row + 1), G.H);
        inside({ x:dx[ip - 1 + e.place] - 60, y:y0, w:120, h:G.badgeH }, w + ' badge in row ' + (row + 1), G.H);
      });
      [minX, maxX].forEach(x => { const j = D.cutNearest(s, x); if (j !== 0 && j !== len) fail(w + ': a scissors end at ' + x + ' falls on gap ' + j); });
      /* 該剪的縫：留下來的最後一位就是目標位；剪下來的第一位就是要看的那一位 */
      const want = D.cutWant(e);
      if (want !== k - e.place) fail(w + ': cutWant = ' + want + ', expected ' + (k - e.place));
      if (D.cutKeptQ(s, want) !== e.place) fail(w + ': cutting at the right gap keeps place ' + D.cutKeptQ(s, want));
      for (let j = 1; j < len; j++) if (D.cutKeptQ(s, j) !== k - j) fail(w + ': cutKeptQ(' + j + ') = ' + D.cutKeptQ(s, j));
      const ti = ip - 1 + e.place;   /* 目標位是第幾個數字 */
      if (Math.abs(D.cutX(s, want) - (dx[ti] + dx[ti + 1]) / 2) > 1e-9) fail(w + ': the right gap is not between the target digit and the next one');
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let j = 1; j < len; j++){
          if (j === want) continue;
          const q = k - j, t = d.gCutWrong(d.gDigitName(q), d.gRoundName(q), d.placeName(e.place), j > want);
          hasWord(w + ' gCutWrong ' + L + ' j=' + j, t, digitNameRef(q, L)); hasWord(w + ' gCutWrong ' + L + ' j=' + j, t, roundNameRef(q, L)); hasWord(w + ' gCutWrong ' + L + ' j=' + j, t, PLACES[L][e.place]);
          if (L === 'zh' && t.indexOf(j > want ? '往右' : '往左') < 0) fail(w + ' gCutWrong zh j=' + j + ' points the wrong way: ' + t);
          if (L === 'en' && !new RegExp('further ' + (j > want ? 'right' : 'left')).test(t)) fail(w + ' gCutWrong en j=' + j + ' points the wrong way: ' + t);
        }
        const look = digitAtRef(s, e.place + 1), r = roundByLine(s, e.place);
        const okT = d.gCutOk(s, d.gDigitName(e.place), d.placeName(e.place), d.gDigitName(e.place + 1), look, r);
        seq(w + ' gCutOk ' + L, okT, [s, look, s, r]);
        hasWord(w + ' gCutOk ' + L, okT, digitNameRef(e.place + 1, L)); hasWord(w + ' gCutOk ' + L, okT, PLACES[L][e.place]);
        if (okT.indexOf(L === 'zh' ? (look >= 5 ? '，入 →' : '，捨 →') : (look >= 5 ? 'goes up →' : 'goes down →')) < 0) fail(w + ' gCutOk ' + L + ': says the wrong one of down/up: ' + okT);
        const h2 = d.gCut2(s, d.gDigitName(e.place), d.gDigitName(e.place + 1));
        seq(w + ' gCut2 ' + L, h2, [s]); hasWord(w + ' gCut2 ' + L, h2, digitNameRef(e.place, L)); hasWord(w + ' gCut2 ' + L, h2, digitNameRef(e.place + 1, L));
      });
    });
    if (places.size !== 3) fail('GAME_CUT should cut for all three places');
    LANGS.forEach(L => [0, 1, 2].forEach(p => { const b = I18N[L].gBadge(p); if (b.indexOf(digitNameRef(p, L).split(' ')[0].replace('first', '1st').replace('second', '2nd')) < 0 && b.indexOf(digitNameRef(p, L)) < 0) fail('gBadge ' + L + ' ' + p + ' does not name the ' + digitNameRef(p, L) + ': ' + b); }));
    if (4 + 2 * G.rowH > G.H) fail('two cut rows do not fit CUT_G.H');
    if (G.knobY + G.knob / 2 > G.rowH) fail('the scissors run into the next row');
    if (G.digitY < G.badgeH) fail('the badge overlaps the digits');
    if (G.digitY + G.boxH > G.knobY - G.knob / 2) fail('the scissors overlap the digits');
    need('cut', /var e1 = pick\(GAME_CUT\), e2 = pick\(GAME_CUT\.filter\(function\(x\)\{ return x\.place !== e1\.place; \}\)\);/, 'the two numbers are not picked with different places');
    need('cut', /if \(j <= 0 \|\| j >= D\.len\) return false;/, 'scissors left at an end are not sent back silently');
    need('cut', /if \(j !== want\)\{\n\s*var q = cutKeptQ\(s, j\);\n\s*roundMiss\(d\.gCutWrong\(d\.gDigitName\(q\), d\.gRoundName\(q\), d\.placeName\(e\.place\), j > want\)\);/, 'a cut in the wrong gap is not refused with its reason');
    need('cut', /var j = cutNearest\(s, pt\.x\), want = cutWant\(e\);/, 'the cut is not judged at the nearest gap');
    need('cut', /cutLine\.style\.left = \(cutX\(s, j\) - 1\.5\) \+ 'px';/, 'the dashed cut line does not snap to the gap that will be judged');
    need('cut', /D\.boxes\[i\]\.classList\.add\(i <= D\.ti \? 'keep' : i === D\.ti \+ 1 \? 'look' : 'skip'\);/, 'after the cut, the kept / look / skipped digits are not coloured keep / look / skip');
    need('cut', /if \(pt\.tap && \(pt\.y < D\.y0 \+ G\.digitY - 6 \|\| pt\.y > D\.y0 \+ G\.knobY \+ G\.knob \/ 2\)\) return false;/, 'a tap outside this number\'s row is not ignored');
    need('cut', /point\(B, cutX\(s, decDp\(s\)\), /, 'the decimal point is not drawn in the gap after the ones digit');
  }

  /* ================= 第 3 關：排出概數 ================= */
  {
    const G = D.BUILD_G;
    touch('a digit card (' + G.card + ')', G.card);
    touch('a box to drop into (' + G.slot + ')', G.slot);
    const has = { down:0, up:0, five:0, carry:0, newDigit:0, endsZero:0, chain:0, leadingZero:0 };
    D.GAME_BUILD.forEach((e, i) => {
      const w = 'GAME_BUILD[' + i + '] ' + e.n, s = e.n, k = dec(s).k, il = s.indexOf('.');
      if (!(il >= 1 && il <= 2)) return fail(w + ': needs a decimal point and 1~2 whole-number digits');
      if (!(e.place >= 0 && e.place < k && e.place <= 2)) return fail(w + ': place ' + e.place + ' does not fit');
      const qmin = -il, cols = k - qmin + 1;
      if (D.buildQmin(s) !== qmin) fail(w + ': buildQmin = ' + D.buildQmin(s));
      if (cols > 5) fail(w + ': ' + cols + ' columns do not fit the board');
      const r = roundByLine(s, e.place), rd = r.replace('.', ''), look = digitAtRef(s, e.place + 1), up = look >= 5;
      /* 第二套：結果的每一位，從目標位往左對齊到每一欄 */
      const mine = {};
      for (let q = qmin; q <= e.place; q++){ const at = rd.length - 1 - (e.place - q); mine[q] = at >= 0 ? +rd[at] : null; }
      if (rd.length > e.place - qmin + 1) fail(w + ': the result ' + r + ' needs more boxes than there are');
      const want = D.buildWant(e);
      for (let q = qmin; q <= e.place; q++) if (want[q] !== mine[q]) fail(w + ': buildWant[' + q + '] = ' + want[q] + ', expected ' + mine[q]);
      if (Object.keys(want).length !== e.place - qmin + 1) fail(w + ': buildWant has boxes for ' + Object.keys(want).join(',') + ' — only up to the target place');
      /* 照遊戲的規則玩：每一格只收 want；全部收完讀出來就是 r（含小數點後的 0） */
      let got = ''; for (let q = qmin; q <= e.place; q++){ if (want[q] === null) continue; got += String(want[q]); if (q === 0 && e.place > 0) got += '.'; }
      if (got !== r) fail(w + ': filling every box reads ' + got + ', not ' + r);
      if (D.ticksToStr(D.buildResult(e), e.place) !== r) fail(w + ': buildResult reads ' + D.ticksToStr(D.buildResult(e), e.place) + ', expected ' + r);
      if (D.buildUp(e) !== up) fail(w + ': buildUp is ' + D.buildUp(e) + ', the look digit is ' + look);
      if (up) has.up++; else has.down++;
      if (look === 5 && k === e.place + 1) has.five++;
      if (up && digitAtRef(s, e.place) === 9) has.carry++;
      if (want[qmin] !== null) has.newDigit++;
      if (e.place > 0 && r.slice(-1) === '0') has.endsZero++;
      if (!up && k === e.place + 2 && digitAtRef(s, e.place + 1) === 4 && digitAtRef(s, e.place + 2) >= 5) has.chain++;
      if (s.charAt(0) === '0') has.leadingZero++;
      /* 每一格放錯的理由：種類對、數字逐個比、說的那件事成立 */
      for (let q = qmin; q <= e.place; q++){
        let kind = q === qmin ? 'lead' : (q === e.place ? 'target' : null);
        if (!kind){ let c = up; for (let z = e.place; z > q; z--) if (digitAtRef(s, z) !== 9) c = false; kind = c ? 'carry' : 'keep'; }
        if (D.buildKind(e, q) !== kind) fail(w + ': buildKind(' + q + ') = ' + D.buildKind(e, q) + ', expected ' + kind);
        const orig = digitAtRef(s, q);
        if (kind === 'carry' && want[q] !== (orig + 1) % 10) fail(w + ': a carried box ' + q + ' is not ' + orig + ' + 1');
        if (kind === 'keep' && want[q] !== orig) fail(w + ': a kept box ' + q + ' changed');
        if (kind === 'target' && want[q] !== (up ? (orig + 1) % 10 : orig)) fail(w + ': the target box is not ' + orig + (up ? ' + 1' : ''));
        LANGS.forEach(L => {
          const d = I18N[L], lname = d.gDigitName(e.place + 1);
          if (kind === 'target'){
            const t = up ? d.gBuildUp(lname, look, orig) : d.gBuildDown(lname, look, orig);
            hasWord(w + ' target reason ' + L, t, digitNameRef(e.place + 1, L));
            if (up) seq(w + ' gBuildUp ' + L, t, L === 'zh' ? [look, 5, 5, orig, 1].concat(orig === 9 ? [9, 1, 0, 1] : []) : [look, 5, orig, 1].concat(orig === 9 ? [9, 1, 0, 1] : []));
            else seq(w + ' gBuildDown ' + L, t, [look, 5, orig]);
          }
          if (kind === 'carry') seq(w + ' gBuildCarry ' + L, d.gBuildCarry(orig), [1, orig, 1].concat(orig === 9 ? [0, 1] : []));
          if (kind === 'keep') seq(w + ' gBuildKeep ' + L, d.gBuildKeep(orig), [orig]);
        });
      }
      for (let q = qmin; q <= k; q++){
        inside(box(D.buildColX(s, q), G.numY + G.numH / 2, G.numW, G.numH), w + ' digit ' + q, G.H);
        if (q <= e.place) inside(box(D.buildColX(s, q), G.slotY + G.slot / 2, G.slot, G.slot), w + ' box ' + q, G.H);
        if (q > qmin){
          const gap = D.buildColX(s, q) - D.buildColX(s, q - 1), wantGap = G.pitch + (q === 1 ? G.dot : 0);
          if (Math.abs(gap - wantGap) > 1e-9) fail(w + ': columns ' + (q - 1) + ' and ' + q + ' are ' + gap + ' apart, expected ' + wantGap);
          if (gap - G.slot <= 0) fail(w + ': build boxes touch');
        }
      }
      inside({ x:D.buildColX(s, e.place) - 60, y:G.badgeY, w:120, h:G.badgeH }, w + ' badge', G.H);
      if (G.badgeY + G.badgeH > G.numY) fail(w + ': the badge runs into the digits');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gBuildDone ' + L, d.gBuildDone(s, d.placeName(e.place), r), [s, r]);
        seq(w + ' gBuildNow ' + L, d.gBuildNow(s, d.placeName(e.place)), [s]);
        hasWord(w + ' gBuildNow ' + L, d.gBuildNow(s, d.placeName(e.place)), PLACES[L][e.place]);
        seq(w + ' gBuild2 ' + L, d.gBuild2(d.gDigitName(e.place + 1), look, up), up ? [look, 1] : [look]);
      });
    });
    Object.keys(has).forEach(key => { if (!has[key]) fail('GAME_BUILD has no "' + key + '" case'); });
    LANGS.forEach(L => {
      seq('gBuildLeadYes ' + L, I18N[L].gBuildLeadYes, [1]);
      seq('gBuildLeadNo ' + L, I18N[L].gBuildLeadNo, []);
      hasWord('gBuildDown ' + L, I18N[L].gBuildDown('x', 4, 6), L === 'zh' ? '更右邊的不管' : 'not the ones further right');
      hasWord('gBuild2 ' + L, I18N[L].gBuild2('x', 4, false), L === 'zh' ? '都不要了' : 'are dropped');
      lacks('gBuild2 ' + L, I18N[L].gBuild2('x', 4, false), L === 'zh' ? '寫 0' : 'becomes 0');
    });
    const cards = []; for (let k = 0; k <= 9; k++) cards.push(box(W / 2 + ((k % 5) - 2) * G.trayStep, G.trayY[Math.floor(k / 5)], G.card, G.card));
    noHits(cards, 'build digit cards'); cards.forEach((c, k) => inside(c, 'build card ' + k, G.H));
    if (G.trayY[0] - G.card / 2 <= G.slotY + G.slot + 6) fail('the digit cards touch the boxes\' drop pad');
    if (G.numY + G.numH + 12 + 3 >= G.slotY) fail('the rule under the number runs into the boxes');
    need('build', /if \(v !== want\[slot\.q\]\)\{ roundMiss\(why\(slot\.q\)\); return false; \}/, 'a card in the wrong box is not refused with its reason');
    need('build', /var slot = nearestOpen\(slots, pt, 6\);\n\s*if \(!slot\) return false;/, 'a drop on empty space / a filled box is not sent back silently');
    need('build', /if \(k === 'lead'\) return want\[q\] === null \? d\.gBuildLeadNo : d\.gBuildLeadYes;/, 'the front box reason is wrong');
    need('build', /if \(k === 'target'\) return up \? d\.gBuildUp\(lname, look, orig\) : d\.gBuildDown\(lname, look, orig\);/, 'the target-box reason is wrong');
    need('build', /return k === 'carry' \? d\.gBuildCarry\(orig\) : d\.gBuildKeep\(orig\);/, 'the left-of-target reason is wrong');
    need('build', /for \(var q2 = qmin; q2 <= e\.place; q2\+\+\)/, 'the boxes do not stop at the target place');
    need('build', /for \(var q0 = qmin; q0 <= e\.place; q0\+\+\) if \(want\[q0\] !== null\) left\+\+;/, 'the round can finish before every box (including a last 0 like 10.0) is filled');
    need('build', /if \(e\.place > 0\) point\(B, pxm, G\.slotY \+ G\.slot - 4, G\.pointD\);/, 'the answer row has no decimal point between the ones and the first decimal place');
  }

  /* ================= 第 4 關：裝一裝、剪一剪 ================= */
  {
    const G = D.PACK_G;
    touch('the 📦 to drag (' + G.src + ')', G.src);
    touch('the "1 m" card to drag (' + G.srcW + '×' + G.src + ')', Math.min(G.srcW, G.src));
    touch('a heap to drop on (' + (G.seg - 2) + ')', G.seg - 2);
    touch('a "Packed / Cut" button (' + G.doneW + '×' + G.doneH + ')', Math.min(G.doneW, G.doneH));
    D.GAME_PACK.forEach((e, i) => {
      const w = 'GAME_PACK[' + i + '] ' + e.n + '/' + e.k, q = Math.floor(e.n / e.k), r = e.n % e.k;
      const pp = D.packParts(e);
      if (pp.q !== q || pp.r !== r) fail(w + ': packParts = ' + JSON.stringify(pp));
      if (!(r > 0)) fail(w + ': nothing left over — the round would not need the extra box');
      /* 四捨五入會給錯答案：剩下的不到半箱（四捨五入 → q，要的是 q + 1） */
      if (!(r * 2 < e.k)) fail(w + ': ' + r + ' left over is half a box or more, so ordinary rounding would already say ' + (q + 1));
      const ceil = Math.ceil(e.n / e.k);
      if (ceil !== q + 1) fail(w + ': the boxes needed is ' + ceil + ', not ' + (q + 1));
      if (ceil > 5 || e.k > 6 || e.k < 3) fail(w + ': ' + ceil + ' heaps of ' + e.k + ' do not fit the board');
      if (G.x0 + ceil * G.seg > W) fail(w + ': the heaps run off the board');
      /* 照遊戲的規則玩：蓋箱子的順序都試一遍（每一堆蓋或不蓋），「裝好了」只在全部蓋好時收；只剩不滿的那一堆 → 算錯；還有整堆 → 只提醒 */
      for (let m = 0; m < (1 << ceil); m++){
        const cov = []; for (let h = 0; h < ceil; h++) cov.push(!!(m & (1 << h)));
        const fullsDone = cov.slice(0, q).every(Boolean), all = cov.every(Boolean);
        const want = all ? null : (fullsDone ? 'left' : 'more');
        if (D.packCheck(cov, e) !== want){ fail(w + ': packCheck(' + JSON.stringify(cov) + ') = ' + D.packCheck(cov, e) + ', expected ' + want); break; }
      }
      /* 一堆裡的糖：個數就是那一堆的數，不出那一堆、不互相重疊 */
      for (let h = 0; h < ceil; h++){
        const cnt = h < q ? e.k : r, dots = [];
        for (let t = 0; t < cnt; t++){ const c = D.candyXY(e.k, t); dots.push({ x:c.x, y:c.y, w:G.candy, h:G.candy }); if (!(c.x >= 1 && c.y >= 1 && c.x + G.candy <= G.seg - 1 && c.y + G.candy <= G.heapH - 1)) fail(w + ': candy ' + t + ' is outside its heap'); }
        noHits(dots, w + ' candies');
      }
      LANGS.forEach(L => {
        const d = I18N[L], ok = d.gPackOk(e.n, e.k, q, r);
        seq(w + ' gPackOk ' + L, ok, L === 'zh' ? [e.n, e.k, q, r, r, q, q + 1] : [e.n, e.k, q, r, r, q, q + 1]);
        hasWord(w + ' gPackOk ' + L, ok, L === 'zh' ? '無條件進位' : 'round up');
        seq(w + ' gPackLeft ' + L, d.gPackLeft(r), [r]);
        seq(w + ' gPack2 ' + L, d.gPack2(e.n, e.k, q, r), [q, r, q + 1]);
        seq(w + ' gPackTitle ' + L, d.gPackTitle(e.n, e.k), [e.n, e.k]);
      });
    });
    D.GAME_ROPE.forEach((Ls, i) => {
      const w = 'GAME_ROPE[' + i + '] ' + Ls, x = dec(Ls), f = Math.floor(x.n / P10(x.k)), restT = x.n - f * P10(x.k), rest = fmtP(restT, x.k);
      const rp = D.ropeParts(Ls);
      if (rp.f !== f || rp.rest !== rest || rp.restT !== restT || rp.dp !== x.k) fail(w + ': ropeParts = ' + JSON.stringify(rp));
      if (!(restT > 0)) fail(w + ': a whole number of metres — there is no short piece to refuse');
      /* 四捨五入會給錯答案：剩下的有半公尺以上（四捨五入 → f + 1，只剪得出 f 段） */
      if (!(restT * 2 >= P10(x.k))) fail(w + ': the leftover ' + rest + ' m is under half a metre, so ordinary rounding would already say ' + f);
      if (roundByLine(Ls, 0) !== String(f + 1)) fail(w + ': rounding ' + Ls + ' to a whole number does not give ' + (f + 1));
      if (G.x0 + Number(Ls) * G.seg > W - 4) fail(w + ': the rope runs off the board');
      if (f + 1 > 5) fail(w + ': too many metres for the board');
      for (let s = 0; s <= f; s++) if (!!D.ropeRefuse(Ls, s) !== (s >= f)) fail(w + ': ropeRefuse(' + s + ') is ' + D.ropeRefuse(Ls, s) + ' — only the short piece is refused');
      for (let m = 0; m < (1 << f); m++){
        const cov = []; for (let s = 0; s < f; s++) cov.push(!!(m & (1 << s)));
        const want = cov.every(Boolean) ? null : 'more';
        if (D.ropeCheck(cov, Ls) !== want){ fail(w + ': ropeCheck(' + JSON.stringify(cov) + ') = ' + D.ropeCheck(cov, Ls) + ', expected ' + want); break; }
      }
      /* 短的那一段畫出來真的比 1 公尺短（畫面決定得了答案） */
      if (!(restT / P10(x.k) * G.seg < G.seg - 4)) fail(w + ': the short piece is drawn almost as long as a whole metre');
      LANGS.forEach(L => {
        const d = I18N[L], ok = d.gRopeOk(Ls, f, rest);
        seq(w + ' gRopeOk ' + L, ok, L === 'zh' ? [Ls, f, 1, rest, f + 1, f] : [Ls, f, rest, f + 1, f]);
        hasWord(w + ' gRopeOk ' + L, ok, L === 'zh' ? '無條件捨去' : 'round down');
        seq(w + ' gRopeShort ' + L, d.gRopeShort(rest), [rest, 1]);
        seq(w + ' gRope2 ' + L, d.gRope2(Ls, f), L === 'zh' ? [Ls, f, 1] : [Ls, f]);
        seq(w + ' gRopeTitle ' + L, d.gRopeTitle(Ls), [Ls, 1]);
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      seq('gPackNow ' + L, d.gPackNow(3, 2), [3, 2]);
      seq('gPackMore ' + L, d.gPackMore, []);
      seq('gRopeMore ' + L, d.gRopeMore, L === 'zh' ? [1] : []);
      hasWord('gPackDone ' + L, d.gPackDone, L === 'zh' ? '無條件進位' : 'round up'); hasWord('gPackDone ' + L, d.gPackDone, L === 'zh' ? '無條件捨去' : 'round down');
    });
    /* 版面：上面一排（標題、糖、📦、按鈕）與下面一排（標題、繩子、刻度、1 公尺、按鈕）不重疊、都在畫板裡 */
    const top = [ { x:0, y:0, w:W, h:G.titleH }, { x:G.x0, y:G.heapY, w:5 * G.seg, h:G.heapH }, box(G.srcX, G.srcY, G.src, G.src), { x:G.doneX, y:G.doneY, w:G.doneW, h:G.doneH } ];
    const bot = [ { x:0, y:G.ropeTop, w:W, h:G.titleH }, { x:G.x0, y:G.segY, w:5 * G.seg, h:G.segH }, { x:G.x0 - 12, y:G.lblY, w:5 * G.seg + 24, h:G.lblH }, box(G.srcX, G.src2Y, G.srcW, G.src), { x:G.doneX, y:G.done2Y, w:G.doneW, h:G.doneH } ];
    noHits(top.concat(bot), 'pack board parts');
    top.concat(bot).forEach((o, k) => inside(o, 'pack board part ' + k, G.H));
    if (G.srcY + G.src / 2 + 6 > G.ropeTop) fail('the 📦 runs into the rope row');
    need('pack', /if \(res === 'left'\)\{\n\s*if \(packMissAt === boxes\)\{ roundNote\(d\.gPackLeft\(pp\.r\)\); return; \}/, 'pressing "Packed" again in the same state costs points again');
    need('pack', /packMissAt = boxes; roundMiss\(d\.gPackLeft\(pp\.r\)\); return;/, 'leaving the last candies without a box is not a mistake');
    need('pack', /if \(res === 'more'\)\{ roundNote\(d\.gPackMore\); return; \}/, 'pressing "Packed" with a full heap left is not just a reminder');
    need('pack', /if \(ropeRefuse\(L, sg\.i\)\)\{ roundMiss\(d\.gRopeShort\(rp\.rest\)\); return false; \}/, 'a 1 m piece on the short end is not refused with its reason');
    need('pack', /if \(ropeCheck\(segs\.map\(function\(s\)\{ return s\.done; \}\), L\) === 'more'\)\{ roundNote\(d\.gRopeMore\); return; \}/, 'pressing "Cut" with a whole metre left is not just a reminder');
    need('pack', /var h = nearestOpen\(heaps, pt, 6\);\n\s*if \(!h\) return false;/, 'a 📦 dropped off the heaps is not sent back silently');
    need('pack', /var sg = nearestOpen\(segs, pt, 6\);\n\s*if \(!sg\) return false;/, 'a 1 m piece dropped off the rope is not sent back silently');
    need('pack', /if \(done\.pack && done\.rope\) roundSolved\(/, 'the round does not finish only when both rows are done');
    need('pack', /var w = j < rp\.f \? G\.seg : G\.seg \* rp\.restT \/ Math\.pow\(10, rp\.dp\);/, 'the short piece of rope is not drawn to scale');
  }

  /* ================= 第 5 關：估一估 ================= */
  {
    const G = D.EST_G;
    touch('an answer card (' + G.cardW + '×' + G.cardH + ')', Math.min(G.cardW, G.cardH));
    let maxKind = 0;
    const ops = new Set();
    D.GAME_EST.forEach((set, i) => {
      const w = 'GAME_EST[' + i + ']';
      if (!Array.isArray(set) || set.length !== 4) return fail(w + ': needs 4 cards');
      let close = 0;
      set.forEach((c, k) => {
        const [a, op, b, claim] = c, ww = w + '[' + k + '] ' + a + op + b + '=' + claim;
        ops.add(op);
        if (['+', '−', '×'].indexOf(op) < 0) return fail(ww + ': op must be +, − or ×');
        if (op === '×' && dec(b).k !== 0) fail(ww + ': × must be by a whole number');
        if (dec(a).k !== 1 || (op !== '×' && dec(b).k !== 1)) fail(ww + ': the decimals should have one decimal place');
        if (dec(a).k > 0 && dec(a).n % 10 === 5) fail(ww + ': ' + a + ' is exactly halfway — keep the estimate unambiguous');
        if (op !== '×' && dec(b).n % 10 === 5) fail(ww + ': ' + b + ' is exactly halfway');
        /* 第二套：以 0.01 為單位 */
        const A = decAt(a, 2), Bv = decAt(b, 2), C = decAt(claim, 2);
        const ra = roundByLineInt(a, 0), rb = roundByLineInt(b, 0);
        const exact = op === '+' ? A + Bv : op === '−' ? A - Bv : A * (Bv / 100);
        const est = op === '+' ? ra + rb : op === '−' ? ra - rb : ra * rb;
        const bound = op === '×' ? 50 * rb : 100;
        if (Math.abs(exact - est * 100) > bound) fail(ww + ': the exact answer is further from the estimate than the bound — the rule would be false');
        const o = D.estOf(c);
        if (o.ra !== ra || o.rb !== rb || o.est !== est || o.exact !== exact || o.bound !== bound) fail(ww + ': estOf = ' + JSON.stringify(o) + ', expected ' + JSON.stringify({ ra, rb, est, exact, bound }));
        const gap = Math.abs(C - est * 100), isClose = gap <= bound;
        if (D.estGap(c) !== gap) fail(ww + ': estGap = ' + D.estGap(c) + ', expected ' + gap);
        if (D.estClose(c) !== isClose) fail(ww + ': estClose disagrees with |c − estimate| ≤ bound');
        if (isClose && C !== exact) fail(ww + ': a close card that is not the exact answer — sorting it ✅ would bless a wrong answer');
        if (!isClose){
          if (C === exact) fail(ww + ': the exact answer is far from the estimate');
          /* 「小數點放錯位置了」必須真的是：答案 ＝ 精確答案 × 10、× 100、÷ 10 或 ÷ 100 */
          if (![10, 100].some(f => C * f === exact || exact * f === C)) fail(ww + ': the reason says the decimal point is misplaced, but ' + claim + ' is not the exact answer with the point moved');
          if (!(gap > 2 * bound)) fail(ww + ': only just outside the bound — "far too far" is not clear in the picture');
        } else close++;
        LANGS.forEach(L => {
          const d = I18N[L], rbShown = dec(b).k === 0 ? null : String(rb), gapS = trimDec(fmtP(gap, 2));
          const t = d.gEstWhy(a, ra, op, b, rbShown, est, claim, gapS, isClose);
          seq(ww + ' gEstWhy ' + L, t, rbShown === null ? [a, ra, ra, b, est, claim, gapS] : [a, ra, b, rb, ra, rb, est, claim, gapS]);
          if (!new RegExp('(^|[^\\d.])' + (ra + ' ' + op + ' ' + (rbShown === null ? b : rb)).replace(/[.+]/g, '\\$&') + '(?=[ ,，])').test(t)) fail(ww + ' gEstWhy ' + L + ' does not show the estimate as ' + ra + ' ' + op + ' ' + (rbShown === null ? b : rb) + ': ' + t);
          const saysWrong = L === 'zh' ? /一定是哪裡算錯了/.test(t) : /must have gone wrong/.test(t);
          if (saysWrong !== !isClose) fail(ww + ' gEstWhy ' + L + ' says ' + (saysWrong ? 'must be wrong' : 'reasonable') + ' with gap ' + gapS);
          if (rbShown === null && t.indexOf(b + ' ≈') >= 0) fail(ww + ' gEstWhy ' + L + ' rounds the whole number ' + b);
          seq(ww + ' gEst2 ' + L, d.gEst2(a, ra, op, b, rbShown, est), rbShown === null ? [a, ra, ra, b, est] : [a, ra, b, rb, ra, rb, est]);
        });
      });
      if (close !== 2) fail(w + ': ' + close + ' close cards — need 2 of each kind');
      maxKind = Math.max(maxKind, close, 4 - close);
    });
    ['+', '−', '×'].forEach(op => { if (!ops.has(op)) fail('GAME_EST has no ' + op + ' card'); });
    LANGS.forEach(L => seq('gEstNow ' + L, I18N[L].gEstNow(1, 4), [1, 4]));
    if (G.lbl + 4 + maxKind * (G.cardH + 4) > G.binH) fail('a box cannot hold ' + maxKind + ' cards');
    if (G.cardW > G.binW - 4) fail('an answer card is wider than its box');
    const tray = [0, 1, 2, 3].map(i => box(G.trayX[i % 2], G.trayY[Math.floor(i / 2)], G.cardW, G.cardH));
    noHits(tray, 'est tray cards'); tray.forEach((c, i) => inside(c, 'est tray card ' + i, G.H));
    if (G.trayY[1] + G.cardH / 2 + 6 >= G.binY) fail('the tray touches the boxes\' drop pad');
    G.binX.forEach((x, i) => inside({ x, y:G.binY, w:G.binW, h:G.binH }, 'est box ' + i, G.H));
    if (G.binX[1] - (G.binX[0] + G.binW) <= 0) fail('the two est boxes touch');
    need('est', /if \(bin\.close !== estClose\(c\)\)\{ roundMiss\(whyOf\(c\)\); return false; \}/, 'a card in the wrong box is not refused with its reason');
    need('est', /var bin = nearestOpen\(bins, pt, 6\);\n\s*if \(!bin\) return false;/, 'a drop on empty space is not sent back silently');
    need('est', /\[true, false\]\.map\(function\(close, i\)\{/, 'the ✅ box is not the left one');
    need('est', /return d\.gEstWhy\(c\[0\], o\.ra, c\[1\], c\[2\], rbOf\(c\), o\.est, c\[3\], decTrim\(estGap\(c\), 2\), estClose\(c\)\);/, 'the reason is not built from the card\'s own numbers');
    need('est', /var txt = c\[0\] \+ ' ' \+ c\[1\] \+ ' ' \+ c\[2\] \+ '\\n= ' \+ c\[3\];/, 'a card does not show its own operator');
  }
}

module.exports = {
  breaks: [
    { file:"index", expect:"re-tapping a kept-selected reusable card",
      find:"      if (B.selected === P && B.kept === P){ B.kept = null; return; }",
      replace:"" },
    { file:"index", expect:"pressing a button on the board",
      find:"      if (e.target.closest && e.target.closest('.gpiece, button')) return;   /* 「裝好了」「剪好了」是按鈕，不是目的地 */",
      replace:"      if (e.target.closest && e.target.closest('.gpiece')) return;   /* 「裝好了」「剪好了」是按鈕，不是目的地 */" },
    { file:"index", expect:"including a last 0 like 10.0",
      find:"      for (var q0 = qmin; q0 <= e.place; q0++) if (want[q0] !== null) left++;",
      replace:"      for (var q0 = qmin; q0 <= e.place; q0++) if (want[q0] !== null && !(q0 === e.place && e.place > 0 && want[q0] === 0)) left++;" },
    { file:"review", expect:"outside 0~100",
      find:"        var c = decStep(correct, k);",
      replace:"        var c = correct + k;" },
    { file:"review", expect:"copied straight out of the stem",
      find:"        var m = mixOpts(boxes, [wrongFloor, boxes + 1], [total, boxSize]);",
      replace:"        var m = mixOpts(boxes, [wrongFloor, boxes + 1, total]);" },
    { file:"review", expect:"appears more than once",
      find:"        } while (numStr.replace('.', '').split(String(lookDigit)).length !== 2);",
      replace:"        } while (false);" },
    { file:"review", expect:"a number is not positive",
      find:"        if (nums[nums.length - 1] < 1) return this.make(used);",
      replace:"" },
    { file:"review", expect:"why does not name the deciding digit",
      find:"            ? '小數點後第二位是 ' + d.numStr.slice(-1) + '，滿 5 要進位：",
      replace:"            ? '小數點後第二位滿 5 要進位：" },
    { file:"review", expect:"does not match the number-line rule",
      find:"    var lookDigit = Number(fracPart.charAt(places));\n    var kept = intPart + fracPart.slice(0, places);\n    if (lookDigit >= 5) kept = incStr(kept);",
      replace:"    var lookDigit = Number(fracPart.charAt(places));\n    var kept = intPart + fracPart.slice(0, places);\n    if (lookDigit > 5) kept = incStr(kept);" },
    { file:"review", expect:"opts[ans] != correct",
      find:"    return { opts: opts, ans: opts.indexOf(correct) };",
      replace:"    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };" },
    { file:"review", expect:"boxes is not the ceiling",
      find:"        var boxes = Math.floor(total / boxSize) + (total % boxSize === 0 ? 0 : 1);",
      replace:"        var boxes = Math.floor(total / boxSize);" },
    { file:"review", expect:"lookDigit is not the 2nd decimal digit",
      find:"        return { numStr:numStr, correct:correct, lookDigit:String(d2), opts:m.opts, ans:m.ans };",
      replace:"        return { numStr:numStr, correct:correct, lookDigit:String(d1), opts:m.opts, ans:m.ans };" },
    { file:"review", expect:"copied straight out of the stem",
      find:"        var m = mixOpts(val, [val * 2, val / 2 === Math.floor(val / 2) ? val / 2 : val - 1], [base, pct]);",
      replace:"        var m = mixOpts(val, [val * 2, val / 2 === Math.floor(val / 2) ? val / 2 : val - 1, base]);" },
    { file:"review", expect:"copied straight out of the stem",
      find:"        if ([a * b, correct + b, correct - b].some(function(v){ return v === aFrac || v === b || v === a; })) return this.make(used);\n        var m = mixOpts(correct, [a * b, correct + b, correct - b], [a, aFrac, b]);",
      replace:"        var m = mixOpts(correct, [a * b, correct + b, correct - b]);" },
    { file:"review", expect:"pieces is not the whole metres",
      find:"        var pieces = intPart;",
      replace:"        var pieces = intPart + 1;" },
    { file:"review", expect:"is not a plain non-negative number",
      find:"    if (t < 0) return null;\n",
      replace:"" },
    { file:"index", expect:"disagrees with the number-line rule",
      find:"    return Math.floor(t / (u / 10)) % 10 >= 5 ? lower + 1 : lower;",
      replace:"    return Math.floor(t / (u / 10)) % 10 > 5 ? lower + 1 : lower;" },
    { file:"index", expect:"the number-line rule says",
      find:"    var lookDigit = Number(fracPart.charAt(places));\n    var kept = intPart + fracPart.slice(0, places);\n    if (lookDigit >= 5) kept = incStr(kept);",
      replace:"    var lookDigit = Number(fracPart.charAt(places));\n    var kept = intPart + fracPart.slice(0, places);\n    if (lookDigit > 5) kept = incStr(kept);" },
    { file:"index", expect:"exactly halfway must not be called",
      find:"        if (lookDigit === '5') return valStr + ' 剛好在 ' + other",
      replace:"        if (lookDigit === 'x') return valStr + ' 剛好在 ' + other" },
    { file:"index", expect:"exactly halfway must not be called",
      find:"        if (lookDigit === '5') return valStr + ' is exactly halfway between ' + other",
      replace:"        if (lookDigit === 'x') return valStr + ' is exactly halfway between ' + other" },
    { file:"index", expect:"not the right answer with the decimal point moved",
      find:"    { expr: '19.8 + 5.2', claimed: '250', correct: '25',",
      replace:"    { expr: '19.8 + 5.2', claimed: '71', correct: '25'," },
    { file:"index", expect:"an order of magnitude",
      find:"所以正確答案應該接近 28；小華的 18 少了 10，估錯了。",
      replace:"所以正確答案應該接近 28，小華的 18 抓錯了數量級。" },
    { file:"index", expect:"an order of magnitude",
      find:"Hua’s 18 is 10 too small.",
      replace:"Hua’s 18 is off by an order of magnitude." },
    { file:"index", expect:"the marked answer is",
      find:"          opts: ['4.8', '3.9', '3.85', '3.8'], ans:3,\n          why: '要看小數點後「第二位」",
      replace:"          opts: ['4.8', '3.9', '3.85', '3.8'], ans:1,\n          why: '要看小數點後「第二位」" },
    { file:"index", expect:"is not a quotient and remainder",
      find:"137 ÷ 20 = 6 箱又 17 顆 —— 剩下的 17 顆也要裝箱，所以要準備 <strong>7</strong> 個箱子。',",
      replace:"137 ÷ 20 = 6 箱又 18 顆 —— 剩下的 17 顆也要裝箱，所以要準備 <strong>7</strong> 個箱子。'," },
    { file:"index", expect:"this claim is wrong",
      find:"19.6 四捨五入到整數約 20，8.3 約 8，20 + 8 = 28，",
      replace:"19.6 四捨五入到整數約 20，8.3 約 8，20 + 8 = 29，" },
    { file:"index", expect:"this config expects 2 and 5",
      find:"          why: '138 ÷ 25 = 5 袋又 13 顆，",
      replace:"          why: '138 ÷ 25 = 5 袋又 13 顆，共 138 ＝ 5 × 25 ＋ 13，" },
    { file:"index", expect:"GAME_ORDER should be",
      find:"  var GAME_ORDER = ['line', 'cut', 'build', 'pack', 'est'];",
      replace:"  var GAME_ORDER = ['line', 'build', 'cut', 'pack', 'est'];" },
    { file:"index", expect:"already in increasing order",
      find:"    for (var i = 1; i < a.length; i++) if (!(Number(a[i - 1]) < Number(a[i]))) up = false;\n    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }",
      replace:"    for (var i = 1; i < a.length; i++) if (!(Number(a[i - 1]) < Number(a[i]))) up = false;" },
    { file:"index", expect:"the trains are not shuffled",
      find:"      shuffle(e.ns).forEach(function(n, r){",
      replace:"      e.ns.slice().forEach(function(n, r){" },
    { file:"index", expect:"the cards are not shuffled",
      find:"      shuffle(set).forEach(function(c, i){",
      replace:"      set.forEach(function(c, i){" },
    { file:"index", expect:"first match, not nearest",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"measure to the box",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"      var dd = dx * dx + dy * dy, dc = dd;" },
    { file:"index", expect:"skips it and lands",
      find:"    return best && !best.done ? best : null;\n  }",
      replace:"    return best;\n  }" },
    { file:"index", expect:"shown although nothing was taken",
      find:"    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    var lost = 5;" },
    { file:"index", expect:"a mistake does not cost 5",
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;" },
    { file:"index", expect:"a reminder (roundNote) costs points",
      find:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }",
      replace:"  function roundNote(text){ gMistake = true; gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }" },
    { file:"index", expect:"scoring: a round should give",
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = gMistake ? 15 : 20;" },
    { file:"index", expect:"board-generation guard",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */",
      replace:"" },
    { file:"index", expect:"a second finger can pick up",
      find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;",
      replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:"index", expect:"lostpointercapture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });",
      replace:"" },
    { file:"index", expect:"placed pieces still take pointer events",
      find:"  .gpiece.locked{cursor:default;pointer-events:none}",
      replace:"  .gpiece.locked{cursor:default}" },
    { file:"index", expect:"the hint is not cleared",
      find:"    elHint.textContent = '';   /* 過關了",
      replace:"    /* 過關了" },
    { file:"index", expect:"ahead mode does not show hint level 1",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'boost'){ hintLevel = 1; showHint(); }" },
    { file:"index", expect:"lineWant(5)",
      find:"  function lineWant(rel){ return rel * 2 >= 10 ? 'hi' : 'lo'; }",
      replace:"  function lineWant(rel){ return rel * 2 > 10 ? 'hi' : 'lo'; }" },
    { file:"index", expect:"needs one train below halfway, one above",
      find:"    { place:1, lo:'3.8',  ns:['3.83', '3.86', '3.85'] },",
      replace:"    { place:1, lo:'3.8',  ns:['3.83', '3.84', '3.85'] }," },
    { file:"index", expect:"starts inside a stop",
      find:"    { place:1, lo:'5.9',  ns:['5.94', '5.97', '5.95'] },",
      replace:"    { place:1, lo:'5.9',  ns:['5.94', '5.99', '5.95'] }," },
    { file:"index", expect:"one more decimal than the stops",
      find:"    { place:2, lo:'2.09', ns:['2.093', '2.096', '2.095'] }",
      replace:"    { place:2, lo:'2.09', ns:['2.093', '2.096', '2.0955'] }" },
    { file:"index", expect:"lineDock(",
      find:"    if (Math.abs(x - LINE_G.X0) <= LINE_G.dock) return 'lo';",
      replace:"    if (Math.abs(x - LINE_G.X0) < LINE_G.dock) return 'lo';" },
    { file:"index", expect:"lineDist(",
      find:"  function lineDist(e, rel){ return { lo:ticksToStr(rel, e.place + 1), hi:ticksToStr(10 - rel, e.place + 1) }; }",
      replace:"  function lineDist(e, rel){ return { lo:ticksToStr(10 - rel, e.place + 1), hi:ticksToStr(rel, e.place + 1) }; }" },
    { file:"index", expect:"lineHi =",
      find:"  function lineHi(e){ return ticksToStr(decInt(e.lo, e.place) + 1, e.place); }",
      replace:"  function lineHi(e){ return ticksToStr(decInt(e.lo, e.place) + 1, e.place + 1); }" },
    { file:"index", expect:"gLineFar zh",
      find:"        return num + ' 離 ' + wrongSt + ' 差 ' + dWrong + '，離 ' + rightSt + ' 只差 ' + dRight + ' —— ' + rightSt + ' 比較近，要開到 ' + rightSt + '。';",
      replace:"        return num + ' 離 ' + wrongSt + ' 差 ' + dRight + '，離 ' + rightSt + ' 只差 ' + dWrong + ' —— ' + rightSt + ' 比較近，要開到 ' + rightSt + '。';" },
    { file:"index", expect:"gLineHalf en",
      find:"        return num + ' is exactly halfway between ' + lo + ' and ' + hi + ', ' + half + ' from each",
      replace:"        return num + ' is exactly halfway between ' + lo + ' and ' + hi + ', ' + lo + ' from each" },
    { file:"index", expect:"the halfway train is not told",
      find:"          roundMiss(rel * 2 === 10 ? d.gLineHalf(n, lo, hi, ds.lo)",
      replace:"          roundMiss(rel * 2 === 11 ? d.gLineHalf(n, lo, hi, ds.lo)" },
    { file:"index", expect:"another row's stop is not ignored",
      find:"          if (!st || st.row !== P.data.row) return false;",
      replace:"          if (!st) return false;" },
    { file:"index", expect:"is not between its two digits",
      find:"    return (cutDigitX(s, len - j - 1) + cutDigitX(s, len - j)) / 2;",
      replace:"    return (cutDigitX(s, len - j - 1) + cutDigitX(s, len - j)) / 2 + 3;" },
    { file:"index", expect:"cutWant =",
      find:"  function cutWant(e){ return decDp(e.n) - e.place; }",
      replace:"  function cutWant(e){ return decDp(e.n) - e.place - 1; }" },
    { file:"index", expect:"apart, expected",
      find:"  function cutDigitX(s, i){ return cutX0(s) + i * CUT_G.pitch + CUT_G.pitch / 2 + (i >= intLen(s) ? CUT_G.dot : 0); }",
      replace:"  function cutDigitX(s, i){ return cutX0(s) + i * CUT_G.pitch + CUT_G.pitch / 2; }" },
    { file:"index", expect:"points the wrong way",
      find:"+ '，剪刀要再往' + (right ? '右' : '左') + '。';",
      replace:"+ '，剪刀要再往' + (right ? '左' : '右') + '。';" },
    { file:"index", expect:"says the wrong one of down/up",
      find:"'，' + (look >= 5 ? '入' : '捨') + ' → ' + num + ' 四捨五入到' + pname",
      replace:"'，' + (look > 5 ? '入' : '捨') + ' → ' + num + ' 四捨五入到' + pname" },
    { file:"index", expect:"does not snap to the gap",
      find:"            cutLine.style.left = (cutX(s, j) - 1.5) + 'px';",
      replace:"            cutLine.style.left = (P.cx - 1.5) + 'px';" },
    { file:"index", expect:"a cut in the wrong gap is not refused",
      find:"        if (j !== want){\n          var q = cutKeptQ(s, j);",
      replace:"        if (false){\n          var q = cutKeptQ(s, j);" },
    { file:"index", expect:"different places",
      find:"      var e1 = pick(GAME_CUT), e2 = pick(GAME_CUT.filter(function(x){ return x.place !== e1.place; }));",
      replace:"      var e1 = pick(GAME_CUT), e2 = pick(GAME_CUT);" },
    { file:"index", expect:"does not fit",
      find:"    { n:'12.638', place:0 }, { n:'3.847', place:1 }, { n:'0.954', place:2 }, { n:'9.982', place:1 },",
      replace:"    { n:'12.638', place:0 }, { n:'3.847', place:1 }, { n:'0.954', place:3 }, { n:'9.982', place:1 }," },
    { file:"index", expect:"digitOf(",
      find:"  function digitOf(s, q){ var dp = decDp(s); return Math.floor(decInt(s, dp) / Math.pow(10, dp - q)) % 10; }",
      replace:"  function digitOf(s, q){ var dp = decDp(s); return Math.floor(decInt(s, dp) / Math.pow(10, dp - q + 1)) % 10; }" },
    { file:"index", expect:"buildWant[",
      find:"      out[q] = (q === qmin && r < pos) ? null : Math.floor(r / pos) % 10;",
      replace:"      out[q] = Math.floor(r / pos) % 10;" },
    { file:"index", expect:"buildKind(",
      find:"    for (var k = e.place; k > q; k--) if (digitOf(e.n, k) !== 9) return false;",
      replace:"    for (var k = e.place; k > q + 1; k--) if (digitOf(e.n, k) !== 9) return false;" },
    { file:"index", expect:"更右邊的不管",
      find:"目標位的 ' + orig + ' 不變 —— 只看隔壁那一位，更右邊的不管。'; },",
      replace:"目標位的 ' + orig + ' 不變。'; }," },
    { file:"index", expect:"都不要了",
      find:"(up ? '要入：目標位加 1' : '要捨：目標位不變') + '；目標位右邊的數字都不要了。'; },",
      replace:"(up ? '要入：目標位加 1' : '要捨：目標位不變') + '，目標位右邊全部寫 0。'; }," },
    { file:"index", expect:"no \"chain\" case",
      find:"{ n:'3.847', place:1 }, { n:'0.996', place:2 },\n    { n:'7.25',  place:1 }, { n:'6.449', place:1 },",
      replace:"{ n:'3.817', place:1 }, { n:'0.996', place:2 },\n    { n:'7.25',  place:1 }, { n:'6.429', place:1 }," },
    { file:"index", expect:"no \"five\" case",
      find:"    { n:'7.25',  place:1 }, { n:'6.449', place:1 }, { n:'12.63', place:0 }, { n:'19.96', place:1 }, { n:'24.5',  place:0 }",
      replace:"    { n:'7.24',  place:1 }, { n:'6.449', place:1 }, { n:'12.63', place:0 }, { n:'19.96', place:1 }, { n:'24.4',  place:0 }" },
    { file:"index", expect:"no \"newDigit\" case",
      find:"    { n:'9.982', place:1 }, { n:'3.968', place:1 },",
      replace:"    { n:'9.942', place:1 }, { n:'3.968', place:1 }," },
    { file:"index", expect:"under 44",
      find:"var BUILD_G = { pitch:52, slot:46,",
      replace:"var BUILD_G = { pitch:52, slot:44," },
    { file:"index", expect:"a card in the wrong box is not refused",
      find:"        if (v !== want[slot.q]){ roundMiss(why(slot.q)); return false; }",
      replace:"        if (v !== want[slot.q] && slot.q !== qmin){ roundMiss(why(slot.q)); return false; }" },
    { file:"index", expect:"the boxes do not stop at the target place",
      find:"      for (var q2 = qmin; q2 <= e.place; q2++)",
      replace:"      for (var q2 = qmin; q2 <= dp; q2++)" },
    { file:"index", expect:"no decimal point between the ones",
      find:"      if (e.place > 0) point(B, pxm, G.slotY + G.slot - 4, G.pointD);",
      replace:"" },
    { file:"index", expect:"packParts =",
      find:"  function packParts(e){ return { q:Math.floor(e.n / e.k), r:e.n % e.k }; }",
      replace:"  function packParts(e){ return { q:Math.ceil(e.n / e.k), r:e.n % e.k }; }" },
    { file:"index", expect:"half a box or more",
      find:"{ n:21, k:5 }, { n:13, k:4 },",
      replace:"{ n:23, k:5 }, { n:13, k:4 }," },
    { file:"index", expect:"under half a metre",
      find:"  var GAME_ROPE = ['4.75', '3.6',",
      replace:"  var GAME_ROPE = ['4.25', '3.6'," },
    { file:"index", expect:"packCheck(",
      find:"    return (p.r > 0 && !cov[p.q]) ? 'left' : null;",
      replace:"    return null;" },
    { file:"index", expect:"ropeRefuse(",
      find:"  function ropeRefuse(L, i){ return i >= ropeParts(L).f ? 'short' : null; }",
      replace:"  function ropeRefuse(L, i){ return i > ropeParts(L).f ? 'short' : null; }" },
    { file:"index", expect:"ropeCheck(",
      find:"  function ropeCheck(cov, L){ for (var i = 0; i < ropeParts(L).f; i++) if (!cov[i]) return 'more'; return null; }",
      replace:"  function ropeCheck(cov, L){ for (var i = 1; i < ropeParts(L).f; i++) if (!cov[i]) return 'more'; return null; }" },
    { file:"index", expect:"candies",
      find:"heapH:50, candy:8, candyGap:4,",
      replace:"heapH:50, candy:8, candyGap:-2," },
    { file:"index", expect:"無條件進位",
      find:"' 箱 —— 可是它們也要裝：無條件進位，要 ' + (q + 1) + ' 箱。';",
      replace:"' 箱 —— 可是它們也要裝：要 ' + (q + 1) + ' 箱。';" },
    { file:"index", expect:"gRopeShort zh",
      find:"      gRopeShort: function(rest){ return '這一段只有 ' + rest + ' 公尺，不到 1 公尺，剪不出完整的一段。'; },",
      replace:"      gRopeShort: function(rest){ return '這一段太短，剪不出完整的一段。'; }," },
    { file:"index", expect:"costs points again",
      find:"          if (packMissAt === boxes){ roundNote(d.gPackLeft(pp.r)); return; }",
      replace:"          if (false){ roundNote(d.gPackLeft(pp.r)); return; }" },
    { file:"index", expect:"not just a reminder",
      find:"        if (res === 'more'){ roundNote(d.gPackMore); return; }",
      replace:"        if (res === 'more'){ roundMiss(d.gPackMore); return; }" },
    { file:"index", expect:"short end is not refused",
      find:"          if (ropeRefuse(L, sg.i)){ roundMiss(d.gRopeShort(rp.rest)); return false; }",
      replace:"          if (ropeRefuse(L, sg.i)){ roundNote(d.gRopeShort(rp.rest)); return false; }" },
    { file:"index", expect:"under 44",
      find:"doneX:170, doneY:92, doneW:116, doneH:48,",
      replace:"doneX:170, doneY:92, doneW:116, doneH:44," },
    { file:"index", expect:"not drawn to scale",
      find:"        var w = j < rp.f ? G.seg : G.seg * rp.restT / Math.pow(10, rp.dp);",
      replace:"        var w = G.seg;" },
    { file:"index", expect:"estClose disagrees",
      find:"  function estClose(c){ return estGap(c) <= estOf(c).bound; }",
      replace:"  function estClose(c){ return estGap(c) <= estOf(c).bound * 100; }" },
    { file:"index", expect:"a close card that is not the exact answer",
      find:"['2.1', '×', '6', '1.26']",
      replace:"['2.1', '×', '6', '12.5']" },
    { file:"index", expect:"not the exact answer with the point moved",
      find:"['7.6', '+', '2.7', '103']",
      replace:"['7.6', '+', '2.7', '20']" },
    { file:"index", expect:"estOf =",
      find:"    return { ra:ra, rb:rb, est:ra * rb, exact:a * rb, bound:50 * rb };",
      replace:"    return { ra:ra, rb:rb, est:ra * rb, exact:a * rb, bound:100 };" },
    { file:"index", expect:"says reasonable",
      find:"(close ? '很接近，合理。' : '差太多了 —— 一定是哪裡算錯了（小數點放錯位置了）。');",
      replace:"(close ? '很接近，合理。' : '差太多了（小數點放錯位置了）。');" },
    { file:"index", expect:"a card in the wrong box is not refused",
      find:"        if (bin.close !== estClose(c)){ roundMiss(whyOf(c)); return false; }",
      replace:"        if (bin.close !== estClose(c) && false){ roundMiss(whyOf(c)); return false; }" },
    { file:"index", expect:"under 44",
      find:"var LINE_G = { X0:30, X1:270, rowY:[34, 92, 150], trainW:52, trainH:48,",
      replace:"var LINE_G = { X0:30, X1:270, rowY:[34, 92, 150], trainW:52, trainH:44," },
    { file:"index", expect:"outside the 300×300 board",
      find:"binY:146, binH:228, lbl:52, H:380 };",
      replace:"binY:146, binH:228, lbl:52, H:300 };" },
    { file:"index", expect:"gives",
      find:"    gScore += pts; elScore.textContent = gScore;",
      replace:"    gScore += pts; gScore += pts; elScore.textContent = gScore;" },
    { file:"index", expect:"the game must never be over",
      find:"    gMistake = true;\n    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    gMistake = true;\n    if (gScore === 0) gSolved = true;\n    var lost = gScore >= 5 ? 5 : 0;" },
    { file:"index", expect:"judged where the piece is drawn",
      find:"      if (!(B.onDrop && B.onDrop(P, { x:P.cx, y:P.cy }))) P.home();",
      replace:"      if (!(B.onDrop && B.onDrop(P, { x:orig.x, y:orig.y }))) P.home();" },
    { file:"index", expect:"outside the 300×270 board",
      find:"rowH:132, badgeH:24, digitY:28,",
      replace:"rowH:132, badgeH:24, digitY:100," },
    { file:"index", expect:"pressing a button on the board",
      find:"      if (e.target.closest && e.target.closest('.gpiece, button')) return;   /* 按按鈕",
      replace:"      if (e.target.closest && e.target.closest('.gpiece')) return;   /* 按按鈕" },
    { file:"index", expect:"gHints.line zh does not say 比較近",
      find:"在右邊就開到上面那一站（在哪一邊，那一站就比較近）；",
      replace:"在右邊就開到上面那一站（在哪一邊，那一站就比較遠）；" },
    { file:"index", expect:"gHints.line en must not say go down",
      find:"the agreed rule is to go up.',\n        cut:",
      replace:"the agreed rule is to go down.',\n        cut:" },
    { file:"index", expect:"gHints.cut zh",
      find:"        cut: '提示 1：目標位要留下來，所以剪在目標位的右邊；",
      replace:"        cut: '提示 1：目標位要剪掉，所以剪在目標位的左邊；" },
    { file:"index", expect:"gHints.cut en",
      find:"        cut: 'Hint 1: the target place is kept, so cut just to its right;",
      replace:"        cut: 'Hint 1: the target place is cut off, so cut just to its left;" },
    { file:"index", expect:"gHints.build zh",
      find:"目標位右邊的數字整個不要；目標位是 0 也要寫出來。',",
      replace:"目標位右邊的數字全部寫 0。'," },
    { file:"index", expect:"gHints.build en",
      find:"the digits right of the target place are dropped; a 0 in the target place must still be written.',",
      replace:"the digits right of the target place each becomes 0.'," },
    { file:"index", expect:"gHints.pack zh",
      find:"        pack: '提示 1：糖要每一顆都有箱子 —— 不滿一箱的那一堆也要一箱；",
      replace:"        pack: '提示 1：糖照四捨五入裝箱 —— 不滿半箱的那一堆不用裝；" },
    { file:"index", expect:"gHints.pack en",
      find:"        pack: 'Hint 1: every candy needs a box — even the heap that is not a full box gets one;",
      replace:"        pack: 'Hint 1: pack by ordinary rounding — a heap under half a box can stay out;" },
    { file:"index", expect:"gHints.est zh",
      find:"        est: '提示 1：每個小數先四捨五入到整數，再算一次；算好的答案和估計差得太多（小數點放錯了），就一定算錯了。'",
      replace:"        est: '提示 1：每個小數先四捨五入到整數，再算一次；和估計差一點點就一定算錯了。'" },
    { file:"index", expect:"gHints.est en",
      find:"        est: 'Hint 1: round each decimal to a whole number and work it out again; a worked answer far too far from the estimate (a misplaced decimal point) must be wrong.'",
      replace:"        est: 'Hint 1: round each decimal to a whole number and work it out again; any answer not equal to the estimate is wrong.'" },
    { file:"index", expect:"gBuildLeadNo zh",
      find:"      gBuildLeadNo: '沒有進位到這麼前面，最前面這一格要空著。',",
      replace:"      gBuildLeadNo: '最前面這一格也要寫一個數字。'," },
    { file:"index", expect:"gPackLeft zh",
      find:"      gPackLeft: function(r){ return '還有 ' + r + ' 顆糖沒有箱子 —— 不滿一箱也要一個箱子裝，不能丟下它們。'; },",
      replace:"      gPackLeft: function(r){ return '還有 ' + r + ' 顆糖 —— 不滿半箱，可以丟下它們。'; }," },
    { file:"index", expect:"gEst2 en",
      find:"      gEst2: function(a, ra, op, b, rb, est){ return 'The first card not yet sorted: ' + a + ' ≈ ' + ra + (rb === null ? '' : ' and ' + b + ' ≈ ' + rb) + ', so the estimate is '",
      replace:"      gEst2: function(a, ra, op, b, rb, est){ return 'The first card not yet sorted: ' + a + ' ≈ ' + ra + (rb === null ? '' : ' and ' + b + ' ≈ ' + rb) + ' — these must not be used, the estimate is '" },
    { file:"index", expect:"gLine2 halfway zh",
      find:"          ? num + ' 離 ' + lo + ' 和 ' + hi + ' 都差 ' + dLo + '，剛好正中間 —— 約定往上。'",
      replace:"          ? num + ' 離 ' + lo + ' 和 ' + hi + ' 都差 ' + dLo + '，比較近的是 ' + hi + '。'" },
    { file:"index", expect:"gPackOk en r=1",
      find:"+ (r === 1 ? ' candy left over is' : ' candies left over are') +",
      replace:"+ ' left over are' +" },
    { file:"index", expect:"gBuildCarry(9) en",
      find:"      gBuildCarry: function(orig){ return 'A 1 is carried in from the right: this ' + orig + ' gets 1 added' + (orig === 9 ? ' — that makes ten again, so write 0 and carry 1 further left' : '') + '.'; },",
      replace:"      gBuildCarry: function(orig){ return 'A 1 is carried in from the right: this ' + orig + ' gets 1 added' + (orig === 9 ? ' — that makes ten again, so write 10' : '') + '.'; }," },
    { file:"index", expect:"gEstWhy zh",
      find:"        return a + ' ≈ ' + ra + (rb === null ? '' : '、' + b + ' ≈ ' + rb) + '，估計 ' + ra + ' ' + op + ' ' + (rb === null ? b : rb) + ' 是 ' + est + '；' +",
      replace:"        return a + ' ≈ ' + ra + (rb === null ? '' : '、' + b + ' ≈ ' + b) + '，估計 ' + ra + ' ' + op + ' ' + (rb === null ? b : rb) + ' 是 ' + est + '；' +" },
    { file:"index", expect:"gEst2 two decimals zh",
      find:"      gEst2: function(a, ra, op, b, rb, est){ return '看還沒分的第一張：' + a + ' ≈ ' + ra + (rb === null ? '' : '、' + b + ' ≈ ' + rb)",
      replace:"      gEst2: function(a, ra, op, b, rb, est){ return '看還沒分的第一張：' + a + ' ≈ ' + ra + (rb === null ? '' : '、' + b)" },
  ],

  sim: {
    /* fmt() 用到「四捨五入核心」與 TXT（位名），都宣告在「工具」那一段之前，而且都不碰 DOM。 */
    blockStart: '  /* ---------- 四捨五入核心（字串／整數運算，不用浮點數） ---------- */',

    INVARIANTS: {
      roundInt: d => {
        if (!/^\d+\.\d$/.test(d.numStr)) return 'roundInt: ' + d.numStr + ' should have exactly one decimal place';
        if (d.correct !== roundByLine(d.numStr, 0)) return 'roundInt: correct ' + d.correct + ' does not match the number-line rule ' + roundByLine(d.numStr, 0);
      },
      roundTenths: d => {
        if (!/^\d+\.\d\d$/.test(d.numStr)) return 'roundTenths: ' + d.numStr + ' should have exactly two decimal places';
        if (d.correct !== roundByLine(d.numStr, 1)) return 'roundTenths: correct ' + d.correct + ' does not match the number-line rule ' + roundByLine(d.numStr, 1);
        if (Number(d.lookDigit) !== digitAtRef(d.numStr, 2)) return 'roundTenths: lookDigit is not the 2nd decimal digit';
      },
      roundHundredths: d => {
        if (!/^\d+\.\d{3}$/.test(d.numStr)) return 'roundHundredths: ' + d.numStr + ' should have exactly three decimal places';
        if (d.correct !== roundByLine(d.numStr, 2)) return 'roundHundredths: correct ' + d.correct + ' does not match the number-line rule ' + roundByLine(d.numStr, 2);
        if (Number(d.lookDigit) !== digitAtRef(d.numStr, 3)) return 'roundHundredths: lookDigit is not the 3rd decimal digit';
      },
      carryCase: d => {
        if (!/^\d+\.9[5-9]$/.test(d.numStr)) return 'carryCase: ' + d.numStr + ' is not x.9 followed by 5~9 — the "carry into the whole number" story would be false';
        if (d.correct !== roundByLine(d.numStr, 1)) return 'carryCase: correct ' + d.correct + ' does not match the number-line rule';
        if (!/\.0$/.test(d.correct)) return 'carryCase: the answer ' + d.correct + ' does not keep its one decimal place';
      },
      ceilingWord: d => {
        if (d.total % d.boxSize === 0) return 'ceilingWord: nothing is left over, so "the rest still needs a bag" is false';
        if (d.boxes !== Math.ceil(d.total / d.boxSize)) return 'ceilingWord: boxes is not the ceiling of total ÷ size';
      },
      floorWord: d => {
        if (!/^\d+\.\d\d$/.test(d.lenStr) || /\.00$/.test(d.lenStr)) return 'floorWord: ' + d.lenStr + ' should have a non-zero leftover';
        if (d.pieces !== Math.floor(dec(d.lenStr).n / 100)) return 'floorWord: pieces is not the whole metres in ' + d.lenStr;
      },
      estimateProduct: d => {
        if (!/^\d+\.[1-9]$/.test(d.aStr)) return 'estimateProduct: ' + d.aStr + ' should have one non-zero decimal place';
        if (d.aStr.slice(-1) === '5') return 'estimateProduct: ' + d.aStr + ' is exactly halfway';
        if (d.aRounded !== roundByLineInt(d.aStr, 0)) return 'estimateProduct: aRounded is not ' + d.aStr + ' rounded to a whole number';
        if (d.correct !== d.aRounded * d.b) return 'estimateProduct: correct is not aRounded × b';
      },
      whichDigit: d => {
        if (!/^\d+\.\d{3}$/.test(d.numStr)) return 'whichDigit: ' + d.numStr + ' should have three decimal places';
        if (!(d.place >= 0 && d.place <= 2)) return 'whichDigit: place out of 0~2';
        if (d.lookDigit !== digitAtRef(d.numStr, d.place + 1)) return 'whichDigit: lookDigit is not the digit right after the target place';
        const ds = d.numStr.replace('.', '').split('');
        if (ds.filter(x => +x === d.lookDigit).length > 1) return 'whichDigit: the deciding digit ' + d.lookDigit + ' appears more than once in ' + d.numStr + ' — the answer does not say which one';
      },
      avgSimple: d => {
        if (d.nums.length !== d.n) return 'avgSimple: n is not the count of numbers';
        if (d.nums.reduce((a, b) => a + b, 0) !== d.sum) return 'avgSimple: sum is wrong';
        if (d.sum !== d.avg * d.n) return 'avgSimple: avg × n is not the sum';
        if (d.nums.some(v => !(v > 0))) return 'avgSimple: a number is not positive';
      },
      decimalDivideSimple: d => {
        if (d.dividendTenths !== d.qt * d.k) return 'decimalDivideSimple: dividend is not quotient × divisor';
        if (decAt(d.dividend, 1) !== d.dividendTenths || decAt(d.q, 1) !== d.qt) return 'decimalDivideSimple: the printed numbers do not match the tenths';
      },
      percentSimple: d => {
        if (d.base * d.pct !== d.val * 100) return 'percentSimple: val is not base × pct%';
        if (!Number.isInteger(d.val)) return 'percentSimple: the answer is not a whole number';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，完全不讀 d.correct。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'roundInt':        return roundByLine(d.numStr, 0);
        case 'roundTenths':
        case 'carryCase':       return roundByLine(d.numStr, 1);
        case 'roundHundredths': return roundByLine(d.numStr, 2);
        case 'ceilingWord':     return String(Math.floor((d.total + d.boxSize - 1) / d.boxSize));
        case 'floorWord':       return String(Math.floor(dec(d.lenStr).n / P10(dec(d.lenStr).k)));
        case 'estimateProduct': return String(roundByLineInt(d.aStr, 0) * d.b);
        case 'whichDigit':      return String(digitAtRef(d.numStr, d.place + 1));
        case 'avgSimple':       return String(d.nums.reduce((a, b) => a + b, 0) / d.nums.length);
        case 'decimalDivideSimple': return fmtP(decAt(d.dividend, 1) / d.k, 1);
        case 'percentSimple':   return String(d.base * d.pct / 100);
        default: return null;
      }
    },

    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' '), why = String(q.why).replace(/<[^>]+>/g, ' ');
      const sn = numsOf(stem), wn = numsOf(why);
      const ROUNDING = { roundInt:0, roundTenths:1, roundHundredths:2, carryCase:1 };
      if (genId in ROUNDING){
        const p = ROUNDING[genId], look = digitAtRef(d.numStr, p + 1), up = look >= 5;
        if (sn.indexOf(d.numStr) < 0) return genId + ' stem does not print ' + d.numStr;
        if (stem.indexOf(PLACES[lang][p]) < 0) return genId + ' stem does not name ' + PLACES[lang][p];
        if (wn.indexOf(String(look)) < 0) return genId + ' why does not name the deciding digit ' + look;
        const saysUp = lang === 'zh' ? /滿 5/.test(why) : /5 or more/.test(why);
        if (saysUp !== up) return genId + ' why says ' + (saysUp ? 'up' : 'down') + ' for the deciding digit ' + look;
      }
      if (genId === 'whichDigit'){
        if (sn.indexOf(d.numStr) < 0) return 'whichDigit stem does not print ' + d.numStr;
        if (stem.indexOf(PLACES[lang][d.place]) < 0) return 'whichDigit stem does not name ' + PLACES[lang][d.place];
      }
      if (genId === 'ceilingWord' && (sn.indexOf(String(d.total)) < 0 || sn.indexOf(String(d.boxSize)) < 0)) return 'ceilingWord stem does not print both numbers';
      if (genId === 'floorWord' && sn.indexOf(d.lenStr) < 0) return 'floorWord stem does not print the length';
      if (genId === 'estimateProduct'){
        if (sn.indexOf(d.aStr) < 0 || sn.indexOf(String(d.b)) < 0) return 'estimateProduct stem does not print both numbers';
        if (sn.indexOf(String(d.correct)) >= 0) return 'estimateProduct stem prints the answer ' + d.correct;
      }
      /* 解釋必須把正解自己印出來 */
      const want = module.exports.sim.expectedCorrect(d, genId, lang);
      if (want !== null && wn.indexOf(want) < 0) return genId + ' why never prints the correct answer ' + want;
      /* 題幹與解釋裡的每一條算式逐條驗算（商與餘數的寫法先自己驗） */
      const probs = [];
      arithText(stem + ' ' + why, genId, m => probs.push(m));
      if (probs.length) return probs[0];
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的迷思誘答 —— 各自只放行那一個值。 */
    stemEchoOk: {
      /* 12.7 → 只看整數部分、直接截掉（12）：「無條件捨去」的迷思 */
      roundInt: function(d, opt){ return opt === d.numStr.split('.')[0]; },
      /* 四捨五入到錯的那一位（到整數）：題幹 8.23 印出 8，而 8 就是「四捨五入到整數」的結果 */
      roundTenths: function(d, opt){ return opt === roundByLine(d.numStr, 0); },
      /* 「要看哪一個數字」：選項本來就是題幹裡的數字 */
      whichDigit: function(d, opt){ return d.numStr.replace('.', '').indexOf(String(opt)) >= 0; }
    },

    optionOk: function(s, genId){
      if (!/^\d+(\.\d+)?$/.test(s)) return 'option "' + s + '" is not a plain non-negative number';
      const [lo, hi] = RANGE[genId] || [0, 100], v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      if (dec(s).k > MAXDP[genId]) return 'option ' + s + ' has more decimal places than this question can produce';
      return null;
    }
  },

  data: {
    dataStart: '  /* ---------- 語言無關的四捨五入核心（字串／整數運算，不用浮點數） ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{incStr, roundDecimalStr, ticksToStr, SCENARIOS, LN_SCENES, STEP_NUMS, EST_CASES, ' +
                'GAME_ORDER, GAME_W, shuffle, pick, decDp, decInt, roundT, decTrim, digitOf, intLen, ' +
                'GAME_LINE, LINE_G, lineRel, lineHi, lineMid, lineTrainX, lineDock, lineWant, lineDist, ' +
                'GAME_CUT, CUT_G, cutLen, cutX0, cutDigitX, cutX, cutNearest, cutWant, cutKeptQ, ' +
                'GAME_BUILD, BUILD_G, buildQmin, buildColX, buildUp, buildResult, buildWant, buildCarried, buildKind, ' +
                'GAME_PACK, GAME_ROPE, PACK_G, packParts, ropeParts, candyXY, packCheck, ropeRefuse, ropeCheck, ' +
                'GAME_EST, EST_G, estOf, estGap, estClose}',

    check: function(data, I18N, fail, src){
      const LANGS = ['zh', 'en'];

      /* --- 算式掃描器自己先跑正反例，然後歸零覆蓋率 --- */
      CLAIM_PROBES.forEach(pr => {
        const got = []; arithText(pr.t, 'probe', m => got.push(m));
        if (pr.bad !== (got.length > 0)) fail('the arithmetic scanner ' + (pr.bad ? 'misses' : 'wrongly flags') + ' "' + pr.t + '"' + (got.length ? ': ' + got[0] : ''));
      });
      DEC_SEEN.length = 0;

      /* --- 1. 每一個靜態字串（兩種語言）裡的算式逐條驗算 --- */
      let verified = 0, qrs = 0;
      const walk = (v, where) => {
        if (typeof v === 'string'){ const r = arithText(v, where, fail); verified += r.verified; qrs += r.qr; }
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']'));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k));
      };
      LANGS.forEach(L => walk(I18N[L], L));
      /* 「數量級不對」只對小數點放錯的那幾張說（範例 5 的 estDetail 是函式，由下面的 EST_CASES 驗）；
         靜態字串裡不可以拿它形容 18 和 28 這種差一點的估計（舊版 qsAdv 第 4 題就是這樣說錯的）。 */
      const magn = (v, where) => {
        if (typeof v === 'string'){ if (/數量級|order of magnitude/.test(v)) fail(where + ' calls a gap "an order of magnitude": ' + v.slice(0, 80)); }
        else if (Array.isArray(v)) v.forEach((x, i) => magn(x, where + '[' + i + ']'));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => magn(v[k], where + '.' + k));
      };
      LANGS.forEach(L => magn(I18N[L], L));
      /* markup 裡寫死的那一份（字典載入前看到的）也要驗 */
      const markup = src.slice(0, src.indexOf('<script>')).replace(/<style>[\s\S]*?<\/style>/, '');
      { const r = arithText(markup, 'markup', fail); verified += r.verified; qrs += r.qr; }
      /* 20 + 8 = 28（zh、en）；137 ÷ 20 = 6 箱又 17 顆（markup、zh、en）與 138 ÷ 25 = 5 袋又 13 顆（zh、en） */
      if (verified !== 2 || qrs !== 5) fail('the arithmetic scanner verified ' + verified + ' equations and ' + qrs + ' quotient-and-remainder statements in the static text, this config expects 2 and 5 — a claim was added, removed or stopped being readable');

      /* --- 2. 三層題庫：正解從題幹重算（數線那一套），zh／en 同一題 --- */
      Object.keys(BANK_EXPECTED).forEach(bank => {
        const exp = BANK_EXPECTED[bank];
        LANGS.forEach(L => {
          const qs = I18N[L][bank];
          if (!Array.isArray(qs) || qs.length !== exp.length) return fail(bank + ' ' + L + ': ' + (qs ? qs.length : 'no') + ' questions, this config expects ' + exp.length);
          qs.forEach((q, i) => {
            const e = exp[i], w = bank + '[' + i + '] ' + L, sn = numsOf(q.stem);
            let want;
            if (e.kind === 'round'){
              if (sn.indexOf(e.num) < 0) return fail(w + ': the stem does not print ' + e.num);
              want = roundByLine(e.num, e.p);
              const names = L === 'zh' ? [PLACE_ZH[e.p]] : [['whole number'], ['first decimal place'], ['second decimal place', '2 decimal places']][e.p];
              if (!names.some(nm => q.stem.indexOf(nm) >= 0)) fail(w + ': the stem does not name the target place');
              if (e.look !== digitAtRef(e.num, e.p + 1)) fail(w + ': this config\'s look digit is wrong');
              if (numsOf(q.why).indexOf(String(e.look)) < 0) fail(w + ': the explanation does not name the deciding digit ' + e.look);
            } else if (e.kind === 'floor'){ want = String(Math.floor(Number(e.num))); if (sn.indexOf(e.num) < 0) fail(w + ': the stem does not print ' + e.num); }
            else if (e.kind === 'ceil'){ want = String(Math.ceil(e.a / e.b)); if (sn.indexOf(String(e.a)) < 0 || sn.indexOf(String(e.b)) < 0) fail(w + ': the stem does not print ' + e.a + ' and ' + e.b); }
            else if (e.kind === 'estimateSum'){ want = String(roundByLineInt(e.x, 0) + roundByLineInt(e.y, 0)); if (sn.indexOf(e.x) < 0 || sn.indexOf(e.y) < 0) fail(w + ': the stem does not print both numbers'); }
            if (want !== e.ans) fail(w + ': this config expects ' + e.ans + ' but the second implementation says ' + want);
            if (q.opts[q.ans] !== want) fail(w + ': the marked answer is ' + q.opts[q.ans] + ', the second implementation says ' + want);
            if (numsOf(q.why).indexOf(want) < 0) fail(w + ': the explanation never prints the answer ' + want);
            /* 選項兩兩不同值（9 與 9.0 一樣），只有一個是正解 */
            const vals = q.opts.map(o => { try { return dec(o); } catch (er){ return null; } });
            for (let x = 0; x < vals.length; x++) for (let y = x + 1; y < vals.length; y++)
              if (vals[x] && vals[y] && decEq(q.opts[x], q.opts[y])) fail(w + ': options ' + q.opts[x] + ' and ' + q.opts[y] + ' are the same value');
          });
        });
      });

      /* --- 3. 範例 1～5 的資料與說明 --- */
      const SIZES = { SCENARIOS:3, STEP_NUMS:6, EST_CASES:3 };
      Object.keys(SIZES).forEach(k => { if (!Array.isArray(data[k]) || data[k].length !== SIZES[k]) fail(k + ' has ' + (data[k] ? data[k].length : 'no') + ' entries, this config expects ' + SIZES[k]); });
      /* 範例 2：每一個場景 × 每一個滑桿位置，說明的「比較靠近」要真的比較近；剛好正中間不可以說比較靠近 */
      Object.keys(data.LN_SCENES).forEach(pk => {
        const p = +pk;
        data.LN_SCENES[pk].forEach((sc, i) => {
          const lo = fmtP(sc.landmarkScaled, p), hi = fmtP(sc.landmarkScaled + 1, p);
          for (let dg = 0; dg <= 9; dg++){
            const val = fmtP(sc.landmarkScaled * 10 + dg, p + 1), res = roundByLine(val, p), nearer = dg >= 5 ? hi : lo;
            LANGS.forEach(L => {
              const t = I18N[L].lnLine(val, p, String(dg), nearer, data.roundDecimalStr(val, p), lo).replace(/<[^>]+>/g, '');
              const w = 'lnLine ' + L + ' ' + val + ' → place ' + p;
              if (numsOf(t).indexOf(res) < 0) fail(w + ': does not print the rounded value ' + res + ': ' + t);
              const saysNearer = L === 'zh' ? /比較靠近/.test(t) : /is closer to/.test(t);
              const saysHalf = L === 'zh' ? /正中間/.test(t) : /exactly halfway/.test(t);
              if (dg === 5 && (saysNearer || !saysHalf)) fail(w + ': exactly halfway must not be called "closer" — ' + t);
              if (dg !== 5 && (!saysNearer || saysHalf)) fail(w + ': should say which landmark is closer — ' + t);
              if (dg !== 5 && numsOf(t)[1] !== (dg > 5 ? hi : lo)) fail(w + ': names ' + numsOf(t)[1] + ' as closer');
            });
          }
        });
      });
      /* 範例 3：每一個數 × 每一個目標位，結果與「要看哪一位」 */
      data.STEP_NUMS.forEach(s => [0, 1, 2].forEach(p => {
        LANGS.forEach(L => {
          const look = digitAtRef(s, p + 1), res = roundByLine(s, p);
          const t = I18N[L].stepWhy(s, p, String(look), data.roundDecimalStr(s, p)).replace(/<[^>]+>/g, '');
          if (numsOf(t).indexOf(res) < 0) fail('stepWhy ' + L + ' ' + s + ' → ' + p + ': does not print ' + res);
          const up = L === 'zh' ? /滿 5/.test(t) : /5 or more/.test(t);
          if (up !== (look >= 5)) fail('stepWhy ' + L + ' ' + s + ' → ' + p + ': says ' + (up ? 'up' : 'down') + ' for the digit ' + look);
        });
      }));
      if (!data.STEP_NUMS.some(s => roundByLine(s, 1).slice(-2) === '.0')) fail('STEP_NUMS has no number whose rounding carries into a .0');
      /* 範例 5：估計用整數；「不合理」那幾張必須真的是小數點放錯了（數量級不對才說得出口） */
      data.EST_CASES.forEach((c, i) => {
        const w = 'EST_CASES[' + i + '] ' + c.expr, m = /^(\d+(?:\.\d+)?) ([×+÷]) (\d+(?:\.\d+)?)$/.exec(c.expr);
        if (!m) return fail(w + ': cannot read the expression');
        const [, a, op, b] = m;
        if (c.roundA !== String(roundByLineInt(a, 0)) || c.roundB !== String(roundByLineInt(b, 0))) fail(w + ': roundA/roundB are not the whole-number roundings');
        if (c.roundOp !== op) fail(w + ': roundOp differs from the expression');
        const A = decAt(a, 2), Bv = decAt(b, 2), C = decAt(c.correct, 2), K = decAt(c.claimed, 2);
        const exact = op === '+' ? A + Bv : op === '×' ? A * Bv / 100 : A * 100 / Bv;
        if (Math.abs(exact - C) > 1e-9) fail(w + ': correct ' + c.correct + ' is not the exact answer');
        const ra = +c.roundA, rb = +c.roundB, est = op === '+' ? ra + rb : op === '×' ? ra * rb : ra / rb;
        if (Math.abs(Number(c.roundResult) - est) > 0.5) fail(w + ': roundResult ' + c.roundResult + ' is not about ' + ra + ' ' + op + ' ' + rb);
        if (![10, 100].some(f => K * f === C || C * f === K)) fail(w + ': the claimed ' + c.claimed + ' is not the right answer with the decimal point moved — "the order of magnitude is wrong" would be false');
      });

      /* --- 4. 小遊戲 --- */
      gameChecks(data, I18N, fail, src);
    }
  }
};
