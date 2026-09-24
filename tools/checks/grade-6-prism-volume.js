/* grade-6/math/prism-volume —— 柱體疊疊樂（柱體的體積 ＝ 底面積 × 高；表面積 ＝ 底面積 × 2 ＋ 底面周長 × 高）
 *
 * 這份設定是**第二個作者**寫的：下面每一套實作都不呼叫、不複製課程頁的函式，走的是另一條路。
 *
 * 1) 「底面積」：課程頁用乘法（a × b × 100、w × t × 50、(u ＋ w) × t × 50）；這裡用**重複相加**，
 *    而且梯形用**切開**的算法（上底 × 高的長方形 ＋ (下底 － 上底) × 高 ÷ 2 的三角形），不是公式。
 * 2) 「底面周長」：把每一條邊**逐條加起來**（長方形四條、直角三角形三條）；圓把 314 加 2r 次。
 *    「側面積」另外用**每一個側面的面積加起來**再算一次，和「底面周長 × 高」兩條路必須一樣。
 *    長方體的表面積再用五年級的 2 × (長 × 寬 ＋ 長 × 高 ＋ 寬 × 高) 算第三次。
 * 3) 「直角三角形」：課程頁用 w² ＋ t² ＝ c² 檢查；這裡用**歐幾里得公式**
 *    (k(m² － n²), 2kmn, k(m² ＋ n²)) 把 20 以內所有的畢氏三數**生出來**，再查表。
 * 4) 「倒過來求高」：課程頁用 % 與 /；這裡用**重複相減**數次數。
 * 5) 「小數怎麼印」：課程頁拆整數位與百分位；這裡把整數補零成字串再插小數點。
 * 6) ⚠️ **從畫出來的圖量回來**：立體圖與展開圖的每一個圖元都重算一次（在**不經四捨五入**的精確座標上算，
 *    和頁面的座標比到 0.2 px），另外用**幾何量**驗：
 *    - 正面那一片多邊形量回公分（對齊 1/6 公分的格子）後，用**鞋帶公式**算面積，必須等於底面積（真的形狀）；
 *    - 每一條往後的稜都是 (0.4 × h × s, －0.3 × h × s)；
 *    - 看得到／看不到的側面用**另一種方法**判斷（公分座標、逆時針方向的外法線 · (0.4, 0.3)），
 *      和圖上實線／虛線的後緣逐條對；剛好側著看（內積 ＝ 0）的那一面兩種都放行，
 *      但要證明那一條輪廓線一定被實線畫到；
 *    - 尺寸數字等於底面的數字、柱體的高在 hideH 的時候剛好是「?」、分層線 ＝ (h － 1) × 看得到的側面數；
 *    - 展開圖：側面那一條的寬 ＝ 底面周長 × s、高 ＝ h × s，兩個底面貼在上下兩邊，
 *      而且**摺得起來**（貼著的那一條邊，兩端相鄰的邊長要等於長條上相鄰的那兩格）。
 *    最後印成 SVG 字串（帶最長的標籤）餵 lib/canvas.js 驗四個邊。
 *
 * ⚠️ 這一課不能用 lib/arith.js（每一句旁白都是小數算式 `28.26 × 4 ＝ 113.04`）：用 lib/decarith.js。
 *    它的唯一 fail-open 是「左邊不是數字的等號」，所以四頁一律把結果寫成「體積是 113.04 立方公分」。
 * ⚠️ 算式裡不可以夾單位：UNIT_IN_EQ 專門擋。
 *
 * 已知極限（全站共通，這裡明講，不假裝驗過 —— codex 第一輪提出）：
 *  - 沒有真的 DOM：RENDER_PINS／REVIEW_PINS 是**字面掃描**，死碼或字串常值裡的同一行也算數。
 *    複習頁的去重另外把 pickWrongs **跑起來**驗；畫圖那一側（drawPlan）沒有跑。
 *  - CSS 只看得到寫在元素上的 hidden／display:none 與 .prfig／.figwrap 的規則；祖先元素的規則與計算後的樣式看不到。
 *  - 中英文不做語意比對：只驗「兩種語言印出同一組數」、題幹與題目整句重建、題庫整句釘住。
 *  - 跨頁用詞是**整頁次數** ＋ 幾條釘在特定字典鍵上的規則（KEY_PINS）；其餘的句子搬家不會響。
 */

const fs = require('fs');
const path = require('path');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const PI_H_REF = 314, LEN_MAX_REF = 20, R_MAX_REF = 10;
const SHAPES_REF = ['rect', 'tri', 'rtri', 'para', 'trap', 'circ'];
const SURF_SHAPES_REF = ['rect', 'rtri', 'circ'];
const FIG_W_REF = 460, FIG_H_REF = 200;
const LABEL_X_REF = 16, LABEL_A_Y_REF = 20, LABEL_B_Y_REF = 192, LABEL_FS_REF = 14, LABEL_MAX_REF = 26;
const BOX_REF = { x0:40, x1:420, y0:40, y1:150 };
const SC_MIN_REF = 3, SC_MAX_REF = 16;
const DEPTH_X_REF = 0.4, DEPTH_Y_REF = 0.3;
const DIM_FS_REF = 13, STROKE_REF = 2, HID_DASH_REF = '5 4', DIM_DASH_REF = '3 3', DIM_SW_REF = 1.5, LAYER_SW_REF = 1;
const LAYER_MAX_REF = 12;
const MARKS_REF = ['base', 'layers', 'vol', 'lat', 'surf'];
const WANTS_REF = ['vol', 'surf', 'lat'];
const C_REF = { LINE:'#2B2A33', BASE:'#FAD7A8', SIDE:'#E8F0FB', VOL:'#BBD5F4', HI:'#F6B26B', PLAIN:'#FFFFFF', LAYER:'#3B7DD8', DIM:'#6B6875' };
const TOL = 0.2;   /* 頁面把每一個座標四捨五入到 0.1 px，而且有幾層累加：0.2 px 以內算同一個點 */

/* 範例與遊戲的案例（第二份） */
const S1_CASES_REF = [[{ shape:'rect', a:4, b:3 }, 5], [{ shape:'tri', w:6, t:4 }, 6], [{ shape:'para', w:5, t:2 }, 7], [{ shape:'circ', r:3 }, 4]];
const S2_CASES_REF = [[{ shape:'tri', w:8, t:5 }, 9], [{ shape:'trap', u:3, w:7, t:4 }, 6], [{ shape:'para', w:6, t:4 }, 8], [{ shape:'tri', w:5, t:3 }, 4]];
const S3_CASES_REF = [['r', 3, 4], ['r', 5, 10], ['r', 4, 7], ['d', 12, 5]];
const S4_CASES_REF = [[{ shape:'rect', a:5, b:3 }, 4], [{ shape:'rtri', w:4, t:3, c:5 }, 6], [{ shape:'circ', r:3 }, 5], [{ shape:'circ', r:4 }, 3]];
const S5_CASES_REF = [['tank', 'vol', { shape:'circ', r:5 }, 8], ['label', 'lat', { shape:'circ', r:3 }, 7],
                      ['wrap', 'surf', { shape:'rect', a:6, b:4 }, 3], ['sand', 'vol', { shape:'tri', w:8, t:6 }, 10]];
const ROUND_KINDS_REF = ['triVol', 'cylVolD', 'height', 'cylSurf', 'which'];

/* ---------- 1) 第二套實作 ---------- */
function isIntIn(n, lo, hi){ return typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi; }
function okLenRef(n){ return isIntIn(n, 1, LEN_MAX_REF); }
function okRRef(r){ return isIntIn(r, 1, R_MAX_REF); }
function okDRef(d){ return isIntIn(d, 2, 2 * R_MAX_REF) && d % 2 === 0; }
/* 重複相加：v 加 k 次 */
function addTimes(v, k){ let s = 0; for (let i = 0; i < k; i++) s += v; return s; }
/* 20 以內所有的畢氏三數，用歐幾里得公式生出來（兩股可以交換）。 */
const TRIPLES_REF = (function(){
  const out = new Set();
  for (let m = 2; m <= 10; m++) for (let n = 1; n < m; n++) for (let k = 1; k <= 20; k++){
    const a = k * (m * m - n * n), b = k * 2 * m * n, c = k * (m * m + n * n);
    if (c > LEN_MAX_REF) continue;
    out.add(a + ',' + b + ',' + c); out.add(b + ',' + a + ',' + c);
  }
  return out;
})();
function okBaseRef(b){
  if (!b || typeof b !== 'object' || SHAPES_REF.indexOf(b.shape) < 0) return false;
  switch (b.shape){
    case 'rect': return okLenRef(b.a) && okLenRef(b.b);
    case 'tri': case 'para': return okLenRef(b.w) && okLenRef(b.t);
    case 'rtri': return okLenRef(b.w) && okLenRef(b.t) && okLenRef(b.c) && TRIPLES_REF.has(b.w + ',' + b.t + ',' + b.c);
    case 'trap': return okLenRef(b.u) && okLenRef(b.w) && okLenRef(b.t) && b.u < b.w;
    case 'circ': return okRRef(b.r);
  }
  return false;
}
/* 底面積（百分之一平方公分），重複相加；梯形用「長方形 ＋ 三角形」切開算。 */
function areaRefH(b){
  if (!okBaseRef(b)) return null;
  switch (b.shape){
    case 'rect': return addTimes(addTimes(100, b.a), b.b);
    case 'para': return addTimes(addTimes(100, b.w), b.t);
    case 'tri': case 'rtri': return addTimes(addTimes(50, b.w), b.t);
    case 'trap': return addTimes(addTimes(100, b.u), b.t) + addTimes(addTimes(50, b.w - b.u), b.t);
    case 'circ': return addTimes(addTimes(PI_H_REF, b.r), b.r);
  }
  return null;
}
/* 底面的每一條邊（公分）；圓沒有邊。 */
function edgesRef(b){
  if (b.shape === 'rect') return [b.a, b.b, b.a, b.b];
  if (b.shape === 'rtri') return [b.w, b.t, b.c];
  return null;
}
/* 底面周長（百分之一公分），逐條邊加起來；只有這一課算表面積的三種底面才有。 */
function perimRefH(b){
  if (!okBaseRef(b) || SURF_SHAPES_REF.indexOf(b.shape) < 0) return null;
  if (b.shape === 'circ') return addTimes(PI_H_REF, 2 * b.r);
  return edgesRef(b).reduce((s, e) => s + addTimes(100, e), 0);
}
function volRefH(b, h){ const a = areaRefH(b); return (a === null || !okLenRef(h)) ? null : addTimes(a, h); }
function latRefH(b, h){ const p = perimRefH(b); return (p === null || !okLenRef(h)) ? null : addTimes(p, h); }
/* 側面積的第二條路：每一個側面（長方形 邊 × 高）的面積加起來。 */
function latByFacesH(b, h){
  if (!okBaseRef(b) || !okLenRef(h)) return null;
  /* 圓柱沒有「邊」：用圓的另一個性質走第三條路 —— 圓周長 × 半徑 ÷ 2 ＝ 圓面積，所以攤開的側面 ＝ 2 × 圓面積 ÷ 半徑 × 高
     （不經過「2 × 3.14 × 半徑」那一條，兩條路共用同一個錯的話這裡會響）。 */
  if (b.shape === 'circ'){ const twice = addTimes(addTimes(areaRefH(b), 2), h); return twice % b.r === 0 ? twice / b.r : null; }
  const e = edgesRef(b);
  if (e === null) return null;
  return e.reduce((s, x) => s + addTimes(addTimes(100, x), h), 0);
}
function surfRefH(b, h){ const l = latRefH(b, h); return l === null ? null : areaRefH(b) + areaRefH(b) + l; }
/* 長方體的表面積：五年級的「六個面，兩兩一樣」—— 2 × (長 × 寬 ＋ 長 × 高 ＋ 寬 × 高)，每一個面各自用重複相加算 */
function surfCuboidPairsH(a, b, h){
  if (!okLenRef(a) || !okLenRef(b) || !okLenRef(h)) return null;
  const face = (x, y) => addTimes(addTimes(100, x), y);
  const one = face(a, b) + face(a, h) + face(b, h);
  return one + one;
}
/* 倒過來求高：重複相減數次數。 */
function heightFromRef(v, a){
  if (!isIntIn(v, 1, 1e9) || !isIntIn(a, 1, 1e9)) return null;
  let k = 0;
  while (v >= a && k <= LEN_MAX_REF + 1){ v -= a; k++; }
  return (v === 0 && okLenRef(k)) ? k : null;
}
/* 百分之一 → 字：整數補零成至少三位，插小數點，砍掉尾端的 0。 */
function hTextRef(h){
  if (!(typeof h === 'number' && Number.isInteger(h) && h >= 0)) return '?';
  const s = String(h).padStart(3, '0');
  const whole = s.slice(0, -2), frac = s.slice(-2).replace(/0+$/, '');
  return frac ? whole + '.' + frac : whole;
}
function plEnRef(n, w){
  if (String(n) === '1') return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const UNIT_WORD_REF = { zh:{ cm:'公分', sq:'平方公分', cu:'立方公分' }, en:{ cm:'centimetre', sq:'square centimetre', cu:'cubic centimetre' } };
function withUnitRef(lang, kind, t){
  if (!UNIT_WORD_REF[lang] || !UNIT_WORD_REF[lang][kind]) return '?';
  if (lang === 'zh') return t + ' ' + UNIT_WORD_REF.zh[kind];
  return plEnRef(String(t), UNIT_WORD_REF.en[kind]);
}
/* 所有合法的底面（整個定義域） */
function allBasesRef(){
  const out = [];
  for (let a = 1; a <= LEN_MAX_REF; a++) for (let b = 1; b <= LEN_MAX_REF; b++){
    out.push({ shape:'rect', a:a, b:b }, { shape:'tri', w:a, t:b }, { shape:'para', w:a, t:b });
  }
  TRIPLES_REF.forEach(k => { const p = k.split(',').map(Number); out.push({ shape:'rtri', w:p[0], t:p[1], c:p[2] }); });
  for (let w = 2; w <= LEN_MAX_REF; w++) for (let u = 1; u < w; u++) for (let t = 1; t <= LEN_MAX_REF; t++) out.push({ shape:'trap', u:u, w:w, t:t });
  for (let r = 1; r <= R_MAX_REF; r++) out.push({ shape:'circ', r:r });
  return out;
}
function baseTag(b){ return JSON.stringify(b); }

/* ---------- 2) 選項的解析：一個數 ＋ 一個單位 ---------- */
/* ⚠️ 長的單位名要先比：`立方公分`、`平方公分` 不先比的話會被 `公分` 咬掉。 */
const UNIT_PATTERNS = [
  { u:'cu', zh:/^([\d.]+)\s*立方公分$/, en:/^([\d.]+)\s*cubic centimetres?$/ },
  { u:'sq', zh:/^([\d.]+)\s*平方公分$/, en:/^([\d.]+)\s*square centimetres?$/ },
  { u:'cm', zh:/^([\d.]+)\s*公分$/, en:/^([\d.]+)\s*centimetres?$/ }
];
function parseOptRef(s, lang){
  const t = String(s).trim();
  for (const p of UNIT_PATTERNS){
    const m = (lang === 'zh' ? p.zh : p.en).exec(t);
    if (m){
      if (!/^\d+(?:\.\d{1,2})?$/.test(m[1])) return null;
      const parts = m[1].split('.');
      const h = Number(parts[0]) * 100 + (parts[1] ? Number(parts[1].padEnd(2, '0')) : 0);
      return { u:p.u, h:h, num:m[1] };
    }
  }
  return null;
}
function optKeyRef(s, lang){
  const p = parseOptRef(s, lang);
  return p ? p.u + ':' + p.h : 'raw:' + String(s).trim();
}

/* ---------- 3) 複習頁的句庫（第二份）：真值表、情境句 ---------- */
const TRUE_STATEMENTS_REF = {
  volRule:  { zh:'柱體的體積 ＝ 底面積 × 高', en:'Volume of a prism ＝ base area × height' },
  latRule:  { zh:'柱體的側面積 ＝ 底面周長 × 高', en:'Side area of a prism ＝ perimeter of the base × height' },
  surfRule: { zh:'柱體的表面積 ＝ 底面積 × 2 ＋ 側面積', en:'Surface area of a prism ＝ base area × 2 ＋ side area' },
  triHalf:  { zh:'三角柱的底面積要用 底 × 高 ÷ 2 來算', en:'A triangular prism’s base area is base × height ÷ 2' },
  twoBases: { zh:'柱體有兩個一模一樣、互相平行的底面', en:'A prism has two identical, parallel bases' },
  unitCu:   { zh:'體積的單位是立方公分', en:'Volume is measured in cubic centimetres' }
};
const FALSE_STATEMENTS_REF = {
  volTwice:   { zh:'柱體的體積 ＝ 底面積 × 高 × 2', en:'Volume of a prism ＝ base area × height × 2' },
  diamOk:     { zh:'算圓柱的底面積時，可以把直徑當成半徑', en:'For a cylinder’s base area, the diameter can be used as the radius' },
  oneBase:    { zh:'柱體的表面積 ＝ 底面積 ＋ 側面積', en:'Surface area of a prism ＝ base area ＋ side area' },
  sameHeight: { zh:'三角柱的高一定和底面三角形的高一樣長', en:'A triangular prism’s height is always as long as its base triangle’s height' },
  unitSq:     { zh:'體積的單位是平方公分', en:'Volume is measured in square centimetres' },
  hTimes4:    { zh:'柱體的高變成 2 倍，體積會變成 4 倍', en:'Doubling a prism’s height makes its volume 4 times as big' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}
/* 「哪一個情境要算體積」：一句要體積，三句要面積（表面積或側面積）。 */
const ASKS_REF = {
  vol: {
    fillTank:  { zh:'圓柱形水桶裝滿水（不算桶子的厚度），可以裝多少水', en:'How much water fills a cylinder-shaped bucket (ignoring its thickness)' },
    sandMould: { zh:'三角柱形的模子裝滿沙（不算模子的厚度），要用多少立方公分的沙', en:'How many cubic centimetres of sand fill a triangular-prism mould (ignoring its thickness)' },
    cakeBox:   { zh:'長方體的盒子裡面可以放多少立方公分的東西', en:'How many cubic centimetres fit inside a cuboid box' },
    clayBar:   { zh:'做一條實心的圓柱形黏土棒，要用多少立方公分的黏土', en:'How many cubic centimetres of clay make a solid cylinder-shaped clay stick' }
  },
  area: {
    wrapBox:   { zh:'長方體禮物盒整個包起來，要多大一張包裝紙', en:'How big a sheet of paper wraps a cuboid gift box all over' },
    canLabel:  { zh:'圓柱形罐頭旁邊貼一圈標籤，標籤要多大一張', en:'How big a label goes right round the side of a cylinder-shaped can' },
    paintTin:  { zh:'圓柱形的鐵罐外面全部塗上油漆，要塗多大一片', en:'How large an area of paint covers the whole outside of a cylinder-shaped tin' },
    tentCloth: { zh:'底面是直角三角形的三角柱形帳篷，外面全部蓋上布，要用多少布', en:'How much cloth covers the whole outside of a tent shaped like a triangular prism with a right-angled triangle base' }
  }
};
function askKindOfText(text, lang){
  for (const side of ['vol', 'area'])
    for (const k of Object.keys(ASKS_REF[side])) if (ASKS_REF[side][k][lang] === text) return side;
  return null;
}
const GEN_IDS = ['triPrismVol', 'quadPrismVol', 'cylVolR', 'cylVolD', 'heightFromVol', 'cuboidSurf',
                 'cylLateral', 'cylSurf', 'whichQuantity', 'trueStatement', 'interCircle', 'interCuboid'];

/* ---------- 4) 讀者看得到的文字 ---------- */
/* ⚠️ 用一個小的詞法掃描拿掉註解：字串裡的 `//`（網址）與 `/*` 不是註解（codex 抓到：`'https://…'` 以前會被砍掉後半）。
   正規式常值不追蹤 —— 這幾頁的程式碼裡，正規式不含引號或註解記號。 */
function stripJsComments(code){
  const src = String(code);
  let out = '', i = 0, q = null;
  while (i < src.length){
    const c = src[i], d = src[i + 1];
    if (q){
      out += c;
      if (c === '\\'){ out += d || ''; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === "'" || c === '"' || c === '`'){ q = c; out += c; i++; continue; }
    if (c === '/' && d === '*'){ const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += '\n'; continue; }
    if (c === '/' && d === '/' && src[i - 1] !== ':'){ const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; out += '\n'; continue; }
    out += c; i++;
  }
  return out;
}
/* HTML 字元參照：數字的（&#51; &#x33;）與常見的名字，一律先解開再做任何「讀者看得到的字」檢查（codex 抓到 `&#51;` 可以藏住黏字）。 */
const NAMED_ENT = { lt:'<', gt:'>', amp:'&', quot:'"', apos:"'", nbsp:' ', pi:'π', times:'×', divide:'÷', minus:'−', sup2:'²', sup3:'³', middot:'·', ensp:' ', emsp:' ', thinsp:' ' };
function decodeEntities(t){
  return String(t)
    .replace(/&#(\d+);?/g, (m, n) => { try { return String.fromCodePoint(Number(n)); } catch (e){ return m; } })
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch (e){ return m; } })
    .replace(/&([a-z]+\d?);/gi, (m, n) => NAMED_ENT[n.toLowerCase()] !== undefined ? NAMED_ENT[n.toLowerCase()] : m);
}
function visibleText(html){
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section|header|footer|nav)\b[^>]*>/gi, ' ')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[#a-z0-9]+;?/gi, m => decodeEntities(m));
}
/* 一頁的 I18N 字典求值出來。⚠️ 結束點要數大括號（review 頁的 var lang 在 I18N 前面）。 */
function i18nOf(raw){
  const src = String(raw), i = src.indexOf('var I18N = {');
  if (i < 0) return null;
  let depth = 0, end = -1, inStr = null;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    const ch = src[k];
    if (inStr){ if (ch === '\\') k++; else if (ch === inStr) inStr = null; continue; }
    if (ch === "'" || ch === '"'){ inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}'){ depth--; if (depth === 0){ end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return new Function('var hText=function(){return "?";};return ' + src.slice(src.indexOf('{', i), end) + ';')(); } catch (e){ return null; }
}
/* ⚠️ `btn` 是語言切換鈕上的字：英文字典裡本來就是「中」（全站慣例）。 */
const I18N_SKIP_KEYS = ['btn'];
function i18nStrings(obj, out, key){
  if (I18N_SKIP_KEYS.indexOf(key) >= 0) return out;
  if (typeof obj === 'string'){ out.push(obj); return out; }
  if (Array.isArray(obj)){ obj.forEach(v => i18nStrings(v, out)); return out; }
  if (obj && typeof obj === 'object'){ Object.keys(obj).forEach(k => i18nStrings(obj[k], out, k)); return out; }
  return out;
}
const UNIT_WORDS_SRC = '立方公分|平方公分|公分|cm|cubic centimetres?|square centimetres?|centimetres?';
/* ⚠️ 中文單位後面沒有 \b，收尾自己寫：行尾、空白、標點都算結束。 */
/* ⚠️ 單位後面接運算符號或等號（`12 公分 ＝`、`12 cm * 2`，全形與 ASCII 都算）、或運算符號後面直接接單位，都是「算式裡夾單位」。
   **結果後面接單位**（`12 × 5 ＝ 60 立方公分`）是全站的寫法（單位寫在算式的後面），不算。 */
const UNIT_IN_EQ = new RegExp('(?:' + UNIT_WORDS_SRC + ')\\s*[×÷＋*/+－−＝=]|[×÷*/]\\s*(?:' + UNIT_WORDS_SRC + ')(?=$|[\\s，。；：、）)．.,;:!?])');
/* 一段文字裡**印出來的數**（百分之一）：先解開字元參照、NFKC（全形數字變半形），再切數字 —— 不是 indexOf（「120」裡面也找得到「12」）。 */
function numTokens(t){
  return (decodeEntities(String(t).replace(/<[^>]+>/g, ' ')).normalize('NFKC').match(/(?<![\d.])\d+(?:\.\d+)?(?![\d.]*\d)/g) || []).map(v => Math.round(Number(v) * 100));
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object|null|Infinity/.test(t) || /(?<![a-z])-?infinity(?![a-z])/i.test(t)) out.push(where + ' leaks an internal value');
  const shown = decodeEntities(t.replace(/<(?:br|p|div|li)[^>]*>/gi, ' ').replace(/<[^>]+>/g, ''));
  /* ⚠️ 全形數字也是數字：\d 只認 ASCII，`高是３ 公分` 以前會溜過去（codex 抓到）。全形數字本身也不可以出現（全站一律半形）。 */
  if (lang === 'zh' && /\p{Script=Han}\p{Nd}|\p{Nd}\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\p{Nd}|\p{Nd}\p{Script=Han}).{0,6}/u) || [''])[0]);
  if (/[０-９]/.test(shown)) out.push(where + ' uses a full-width digit: ' + (shown.match(/.{0,6}[０-９].{0,6}/) || [''])[0]);
  /* 英文的單複數**照數值判斷**：1、1.0、1.00 都是單數（codex 抓到 `1.0 centimetres`）；前面接著數字或小數點的不算開頭。 */
  if (lang === 'en'){
    const re = /(?<![\d.])(\d+(?:\.\d+)?) (centimetre|square centimetre|cubic centimetre|layer|point|face)(s?)\b/g;
    let m;
    while ((m = re.exec(shown)) !== null){
      const one = Number(m[1]) === 1;
      if (one && m[3] === 's') out.push(where + ' has a singular/plural slip: ' + m[0]);
      else if (!one && m[3] !== 's') out.push(where + ' has a plural slip: ' + m[0]);
    }
  }
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  if (UNIT_IN_EQ.test(shown)) out.push(where + ' puts a unit inside an equation: ' + (shown.match(new RegExp('.{0,14}(?:' + UNIT_WORDS_SRC + ')\\s*[×÷＋*/+－−＝=].{0,10}|.{0,10}[×÷*/]\\s*(?:' + UNIT_WORDS_SRC + ').{0,14}')) || [''])[0]);
  return out;
}

/* ---------- 5) 算式逐條驗算：全站共用的小數求值器 ---------- */
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();
const CLAIM_PROBES = [
  { text:'28.26 × 4 ＝ 113.04', bad:false },
  { text:'(3 ＋ 7) × 4 ÷ 2 ＝ 20', bad:false },
  { text:'8 × 5 ÷ 2 ＝ 20，20 × 9 ＝ 180', bad:false },
  { text:'28.26 × 2 ＋ 18.84 × 5 ＝ 150.72', bad:false },
  { text:'(5 ＋ 3) × 2 ＝ 16', bad:false },
  { text:'2 × (15 ＋ 20 ＋ 12) ＝ 94', bad:false },
  { text:'180 ÷ 20 ＝ 9', bad:false },
  { text:'柱體的體積 ＝ 底面積 × 高', bad:false },
  { text:'高 ＝ 體積 ÷ 底面積：180 ÷ 20 ＝ 9', bad:false },
  { text:'表面積 ＝ 底面積 × 2 ＋ 側面積', bad:false },
  { text:'The volume is 28.26 × 4 = 113.04 cubic centimetres.', bad:false },
  { text:'✅ 答對了！＋20 分', bad:false },
  /* 這一課的算式一定要讀得到，讀不到就是靜靜放行 */
  { text:'28.26 × 4 ＝ 113.4', bad:true },
  { text:'(3 ＋ 7) × 4 ÷ 2 ＝ 40', bad:true },
  { text:'28.26 × 2 ＋ 18.84 × 5 ＝ 150.27', bad:true },
  { text:'2 × (15 ＋ 20 ＋ 12) ＝ 96', bad:true },
  { text:'6 × 4 ÷ 2 ＝ 24', bad:true },
  { text:'體積 ＝ 60', bad:true },
  { text:'78.5 × × 8 ＝ 628', bad:true },
  { text:'The side is 16 × 4 = 60 square centimetres.', bad:true }
];

/* ---------- 6) 立體圖與展開圖：參考圖元（精確座標，不經四捨五入） ---------- */
/* 正面那一片在「公分、y 往上」座標裡的頂點（逆時針），和畫布上的寬與高。
   ⚠️ 三角形的頂點放在 w/3、平行四邊形往右斜 t/2、梯形左右對稱：這三個是**版面的選擇**（釘住），
   它們畫得對不對由下面的幾何斷言驗（面積、底邊、高）。 */
function frontRef(b){
  if (b.shape === 'rect') return { fw:b.a, fh:b.b, pts:[[0, 0], [b.a, 0], [b.a, b.b], [0, b.b]] };
  if (b.shape === 'tri') return { fw:b.w, fh:b.t, pts:[[0, 0], [b.w, 0], [b.w / 3, b.t]], apex:[b.w / 3, b.t] };
  if (b.shape === 'rtri') return { fw:b.w, fh:b.t, pts:[[0, 0], [b.w, 0], [0, b.t]], apex:[0, b.t] };
  if (b.shape === 'para') return { fw:b.w + b.t / 2, fh:b.t, pts:[[0, 0], [b.w, 0], [b.w + b.t / 2, b.t], [b.t / 2, b.t]], apex:[b.t / 2, b.t] };
  if (b.shape === 'trap'){ const o = (b.w - b.u) / 2; return { fw:b.w, fh:b.t, pts:[[0, 0], [b.w, 0], [o + b.u, b.t], [o, b.t]], apex:[o, b.t] }; }
  return { fw:2 * b.r, fh:2 * b.r, pts:null };
}
/* 放得下的最大整數比例尺 */
function fitRef(wCm, hCm){
  let best = null;
  for (let s = SC_MIN_REF; s <= SC_MAX_REF; s++) if (wCm * s <= BOX_REF.x1 - BOX_REF.x0 + 1e-9 && hCm * s <= BOX_REF.y1 - BOX_REF.y0 + 1e-9) best = s;
  return best;
}
/* 第 i 個側面看得到嗎：公分座標（y 往上）、用鞋帶公式的正負號定出方向，外法線 · (0.4, 0.3)。
   回傳 1 看得到、-1 看不到、0 剛好側著（內積 ＝ 0，精確判斷：頂點都是 1/6 的倍數，乘 60 之後是整數）。 */
function faceSignsRef(pts){
  const n = pts.length;
  let twiceA = 0;
  for (let i = 0; i < n; i++){ const p = pts[i], q = pts[(i + 1) % n]; twiceA += p[0] * q[1] - q[0] * p[1]; }
  const ccw = twiceA > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++){
    const p = pts[i], q = pts[(i + 1) % n];
    const ex = Math.round((q[0] - p[0]) * 60), ey = Math.round((q[1] - p[1]) * 60);
    const nx = ccw * ey, ny = -ccw * ex;            /* 逆時針的外法線 */
    const dot = nx * 4 + ny * 3;                     /* × (0.4, 0.3) 的 10 倍 */
    out.push(dot > 0 ? 1 : (dot < 0 ? -1 : 0));
  }
  return out;
}
function P_(x, y){ return { x:x, y:y }; }
function mkLine(a, b, stroke, sw, dash){ return { k:'line', nums:[a.x, a.y, b.x, b.y, sw], strs:[stroke, dash || ''] }; }
function mkPath(cmds, nums, fill, stroke, sw, dash){ return { k:'path', nums:nums.concat([sw]), strs:[cmds, fill, stroke, dash || ''] }; }
function mkPoly(pts, fill, stroke, sw){
  return mkPath('M' + 'L'.repeat(pts.length - 1) + 'Z', [].concat.apply([], pts.map(p => [p.x, p.y])), fill, stroke, sw, '');
}
function mkCircle(c, r, fill, stroke, sw){ return { k:'circle', nums:[c.x, c.y, r, sw], strs:[fill, stroke] }; }
function mkRect(x, y, w, h, fill, stroke, sw){ return { k:'rect', nums:[x, y, w, h, sw], strs:[fill, stroke] }; }
function mkText(x, y, t, anchor){ return { k:'text', nums:[x, y], strs:[String(t), anchor || 'middle'] }; }
function mkArc(a, R, sweep, b, stroke, sw, dash){ return mkPath('MA', [a.x, a.y, R, R, 0, 0, sweep, b.x, b.y], 'none', stroke, sw, dash); }
/* 頁面的一個圖元 → 同一個形狀的正規化（數字一串、字串一串） */
function normPagePrim(p){
  if (!p || typeof p !== 'object') return { k:'BAD', nums:[], strs:[] };
  if (p.k === 'circle') return { k:'circle', nums:[p.cx, p.cy, p.r, p.sw], strs:[p.fill, p.stroke] };
  if (p.k === 'rect') return { k:'rect', nums:[p.x, p.y, p.w, p.h, p.sw], strs:[p.fill, p.stroke] };
  if (p.k === 'line') return { k:'line', nums:[p.x1, p.y1, p.x2, p.y2, p.sw], strs:[p.stroke, p.dash || ''] };
  if (p.k === 'text') return { k:'text', nums:[p.x, p.y], strs:[String(p.t), p.anchor] };
  if (p.k === 'path'){
    const toks = String(p.d).trim().split(/\s+/);
    const cmds = toks.filter(t => /^[A-Za-z]$/.test(t)).join('');
    const nums = toks.filter(t => !/^[A-Za-z]$/.test(t)).map(Number);
    return { k:'path', nums:nums.concat([p.sw]), strs:[cmds, p.fill, p.stroke, p.dash || ''] };
  }
  return { k:'BAD:' + p.k, nums:[], strs:[] };
}
function primDiff(got, want){
  if (got.k !== want.k) return 'is a ' + got.k + ', the reference draws a ' + want.k;
  if (got.strs.join('|') !== want.strs.join('|')) return 'has [' + got.strs.join(', ') + '], the reference says [' + want.strs.join(', ') + ']';
  if (got.nums.length !== want.nums.length) return 'has ' + got.nums.length + ' numbers, the reference ' + want.nums.length;
  for (let i = 0; i < got.nums.length; i++){
    if (!(typeof got.nums[i] === 'number' && isFinite(got.nums[i])) || Math.abs(got.nums[i] - want.nums[i]) > TOL)
      return 'has ' + got.nums[i] + ' where the reference has ' + (Math.round(want.nums[i] * 100) / 100) + ' (number ' + i + ')';
  }
  return null;
}
/* 立體圖的參考圖元。vis 可以指定（剛好側著的那一面兩種都要試）。 */
function refSolid(b, h, mark, showR, hideH, visOverride){
  if (!okBaseRef(b) || !okLenRef(h) || MARKS_REF.indexOf(mark) < 0) return null;
  if (mark === 'layers' && h > LAYER_MAX_REF) return null;
  const fr = frontRef(b);
  const Wcm = fr.fw + DEPTH_X_REF * h, Hcm = fr.fh + DEPTH_Y_REF * h;
  const s = fitRef(Wcm, Hcm);
  if (s === null) return null;
  const x0 = (BOX_REF.x0 + BOX_REF.x1) / 2 - Wcm * s / 2, yb = (BOX_REF.y0 + BOX_REF.y1) / 2 + Hcm * s / 2;
  const D = P_(DEPTH_X_REF * h * s, -DEPTH_Y_REF * h * s);
  const fillFront = mark === 'vol' ? C_REF.VOL : mark === 'lat' ? C_REF.PLAIN : mark === 'surf' ? C_REF.HI : C_REF.BASE;
  const fillSide = mark === 'vol' ? C_REF.VOL : (mark === 'lat' || mark === 'surf') ? C_REF.HI : C_REF.SIDE;
  const out = [];
  const add = (p, v) => P_(p.x + v.x, p.y + v.y);
  const scl = (v, k) => P_(v.x * k, v.y * k);
  if (b.shape === 'circ'){
    const R = b.r * s;
    const fc = P_(x0 + R, yb - R), bc = add(fc, D);
    const nv = P_(0.6 * R, 0.8 * R), mv = P_(-0.6 * R, -0.8 * R);
    const f1 = add(fc, nv), f2 = add(fc, mv), b1 = add(bc, nv), b2 = add(bc, mv);
    out.push(mkPoly([f1, b1, b2, f2], fillSide, 'none', 0));
    out.push(mkCircle(bc, R, fillSide, 'none', 0));
    out.push(mkCircle(fc, R, fillFront, 'none', 0));
    out.push(mkArc(b1, R, 1, b2, C_REF.LINE, STROKE_REF, HID_DASH_REF));
    if (mark === 'layers') for (let k = 1; k < h; k++){ const l = add(fc, scl(D, k / h)); out.push(mkArc(add(l, nv), R, 0, add(l, mv), C_REF.LAYER, LAYER_SW_REF, '')); }
    out.push(mkArc(b1, R, 0, b2, C_REF.LINE, STROKE_REF, ''));
    out.push(mkLine(f1, b1, C_REF.LINE, STROKE_REF));
    out.push(mkLine(f2, b2, C_REF.LINE, STROKE_REF));
    out.push(mkCircle(fc, R, 'none', C_REF.LINE, STROKE_REF));
    if (showR === 'd'){
      out.push(mkLine(P_(fc.x - R, fc.y), P_(fc.x + R, fc.y), C_REF.DIM, DIM_SW_REF, DIM_DASH_REF));
      out.push(mkText(fc.x - R / 2, fc.y - 5, 2 * b.r));
    } else {
      out.push(mkLine(fc, P_(fc.x + R, fc.y), C_REF.DIM, DIM_SW_REF, DIM_DASH_REF));
      out.push(mkText(fc.x + R / 2, fc.y - 5, b.r));
    }
    out.push(mkCircle(fc, 2.5, C_REF.LINE, 'none', 0));
    out.push(mkText((f1.x + b1.x) / 2 + 10, (f1.y + b1.y) / 2 + 14, hideH ? '?' : h, 'start'));
    return { prims:out, s:s, x0:x0, yb:yb, D:D };
  }
  const P = fr.pts.map(p => P_(x0 + p[0] * s, yb - p[1] * s));
  const Q = P.map(p => add(p, D));
  const n = P.length;
  const sg = faceSignsRef(fr.pts);
  const vis = visOverride || sg.map(v => v > 0);
  const nx = i => (i + 1) % n, pv = i => (i + n - 1) % n;
  for (let i = 0; i < n; i++) if (vis[i]) out.push(mkPoly([P[i], P[nx(i)], Q[nx(i)], Q[i]], fillSide, 'none', 0));
  out.push(mkPoly(P, fillFront, 'none', 0));
  for (let i = 0; i < n; i++) if (!vis[i]) out.push(mkLine(Q[i], Q[nx(i)], C_REF.LINE, STROKE_REF, HID_DASH_REF));
  for (let i = 0; i < n; i++) if (!vis[i] && !vis[pv(i)]) out.push(mkLine(P[i], Q[i], C_REF.LINE, STROKE_REF, HID_DASH_REF));
  if (mark === 'layers') for (let i = 0; i < n; i++){
    if (!vis[i]) continue;
    for (let k = 1; k < h; k++) out.push(mkLine(add(P[i], scl(D, k / h)), add(P[nx(i)], scl(D, k / h)), C_REF.LAYER, LAYER_SW_REF));
  }
  for (let i = 0; i < n; i++) out.push(mkLine(P[i], P[nx(i)], C_REF.LINE, STROKE_REF));
  for (let i = 0; i < n; i++) if (vis[i]) out.push(mkLine(Q[i], Q[nx(i)], C_REF.LINE, STROKE_REF));
  for (let i = 0; i < n; i++) if (vis[i] || vis[pv(i)]) out.push(mkLine(P[i], Q[i], C_REF.LINE, STROKE_REF));
  out.push(mkText((P[0].x + P[1].x) / 2, yb + 15, b.shape === 'rect' ? b.a : b.w));
  if (b.shape === 'rect') out.push(mkText(P[0].x - 6, yb - b.b * s / 2 + 5, b.b, 'end'));
  else {
    const ax = x0 + fr.apex[0] * s, ay = yb - fr.apex[1] * s;
    if (b.shape !== 'rtri') out.push(mkLine(P_(ax, ay), P_(ax, yb), C_REF.DIM, DIM_SW_REF, DIM_DASH_REF));
    out.push(mkText(x0 - 6, yb - b.t * s / 2 + 5, b.t, 'end'));
    if (b.shape === 'trap') out.push(mkText(x0 + (fr.pts[2][0] + fr.pts[3][0]) / 2 * s, ay - 5, b.u));
    if (b.shape === 'rtri') out.push(mkText((P[1].x + P[2].x) / 2 + 6, (P[1].y + P[2].y) / 2 - 4, b.c, 'start'));
  }
  out.push(mkText((P[1].x + Q[1].x) / 2 + 10, (P[1].y + Q[1].y) / 2 + 14, hideH ? '?' : h, 'start'));
  return { prims:out, s:s, x0:x0, yb:yb, D:D, P:P, Q:Q, signs:sg };
}
/* 展開圖的參考圖元 */
function refNet(b, h){
  if (!okBaseRef(b) || !okLenRef(h) || SURF_SHAPES_REF.indexOf(b.shape) < 0) return null;
  const segs = edgesRef(b);
  const baseH = b.shape === 'rect' ? b.b : b.shape === 'rtri' ? b.t : 2 * b.r;
  const stripW = segs ? segs.reduce((x, y) => x + y, 0) : perimRefH(b) / 100;
  const s = fitRef(stripW, h + 2 * baseH);
  if (s === null) return null;
  const x0 = (BOX_REF.x0 + BOX_REF.x1) / 2 - stripW * s / 2;
  const y0 = (BOX_REF.y0 + BOX_REF.y1) / 2 - (h + 2 * baseH) * s / 2;
  const sy = y0 + baseH * s, sh = h * s;
  const out = [];
  if (!segs){
    const R = b.r * s;
    out.push(mkRect(x0, sy, stripW * s, sh, C_REF.HI, C_REF.LINE, STROKE_REF));
    out.push(mkCircle(P_(x0 + R, sy - R), R, C_REF.BASE, C_REF.LINE, STROKE_REF));
    out.push(mkCircle(P_(x0 + R, sy + sh + R), R, C_REF.BASE, C_REF.LINE, STROKE_REF));
    out.push(mkText(x0 + stripW * s / 2, sy + sh / 2 + 5, hTextRef(perimRefH(b))));
  } else {
    let x = x0;
    segs.forEach(e => { out.push(mkRect(x, sy, e * s, sh, C_REF.HI, C_REF.LINE, STROKE_REF)); out.push(mkText(x + e * s / 2, sy + sh / 2 + 5, e)); x += e * s; });
    const bw = segs[0] * s, bh = baseH * s;
    if (b.shape === 'rect'){
      out.push(mkRect(x0, sy - bh, bw, bh, C_REF.BASE, C_REF.LINE, STROKE_REF));
      out.push(mkRect(x0, sy + sh, bw, bh, C_REF.BASE, C_REF.LINE, STROKE_REF));
    } else {
      /* 直角在 w 那一格的右端（w 和 t 相接的地方），摺起來才貼得上 t 那一面。 */
      out.push(mkPoly([P_(x0, sy), P_(x0 + bw, sy), P_(x0 + bw, sy - bh)], C_REF.BASE, C_REF.LINE, STROKE_REF));
      out.push(mkPoly([P_(x0, sy + sh), P_(x0 + bw, sy + sh), P_(x0 + bw, sy + sh + bh)], C_REF.BASE, C_REF.LINE, STROKE_REF));
    }
  }
  out.push(mkText(x0 - 6, sy + sh / 2 + 5, h, 'end'));
  return { prims:out, s:s, x0:x0, sy:sy, sh:sh, stripW:stripW };
}
/* 把 plan 印成 SVG（帶最長的標籤）餵 lib/canvas.js */
function svgOfPlan(pl, labelA, labelB){
  const parts = pl.prims.map(p => {
    if (p.k === 'circle') return '<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'rect') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'path') return '<path d="' + p.d + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'text') return '<text x="' + p.x + '" y="' + p.y + '" font-size="' + DIM_FS_REF + '" text-anchor="' + p.anchor + '">' + p.t + '</text>';
    return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
  });
  pl.labels.forEach(l => parts.push('<text x="' + l.x + '" y="' + l.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start">' + (l.slot === 'a' ? labelA : labelB) + '</text>'));
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + parts.join('') + '</svg>';
}
/* 一張圖的共同檢查：畫布、兩個標籤、圖元逐一比對（可以給好幾個候選：剛好側著的那一面）、四個邊。 */
function planProblems(tag, pl, wants, longLabel, withCanvas){
  const out = [];
  if (!pl || typeof pl !== 'object'){ out.push(tag + ': the plan is not an object'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== FIG_H_REF) out.push(tag + ': canvas is ' + pl.w + 'x' + pl.h + ', expected ' + FIG_W_REF + 'x' + FIG_H_REF);
  const la = (pl.labels || []).find(l => l.slot === 'a'), lb = (pl.labels || []).find(l => l.slot === 'b');
  if (!Array.isArray(pl.labels) || pl.labels.length !== 2 || !la || !lb) out.push(tag + ': the plan does not carry exactly one label slot a and one b');
  else if (la.x !== LABEL_X_REF || lb.x !== LABEL_X_REF || la.y !== LABEL_A_Y_REF || lb.y !== LABEL_B_Y_REF) out.push(tag + ': labels are not at x=' + LABEL_X_REF + ', y=' + LABEL_A_Y_REF + ' and y=' + LABEL_B_Y_REF);
  if (wants === null){
    if (!pl.tooBig) out.push(tag + ': should be tooBig (outside what this lesson draws) but is not');
    if (Array.isArray(pl.prims) && pl.prims.length) out.push(tag + ': tooBig but ' + pl.prims.length + ' shapes were still planned');
    return out;
  }
  if (pl.tooBig){ out.push(tag + ': flagged tooBig although the reference draws it'); return out; }
  const got = (pl.prims || []).map(normPagePrim);
  let best = null;
  for (const w of wants){
    const errs = [];
    if (got.length !== w.prims.length) errs.push(tag + ': ' + got.length + ' shapes, the reference draws ' + w.prims.length);
    for (let i = 0; i < Math.min(got.length, w.prims.length) && errs.length < 3; i++){
      const d = primDiff(got[i], w.prims[i]);
      if (d) errs.push(tag + ': shape ' + i + ' (' + got[i].k + ') ' + d);
    }
    if (!errs.length){ best = []; break; }
    if (best === null) best = errs;
  }
  best.forEach(m => out.push(m));
  if (pl.s !== wants[0].s) out.push(tag + ': the scale is ' + pl.s + ' px per centimetre, the largest that fits is ' + wants[0].s);
  if (withCanvas) canvasProblems(svgOfPlan(pl, longLabel, longLabel)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}

/* ---------- 7) 幾何量的斷言：不靠參考圖元，直接從頁面的圖元量回來 ---------- */
const near = (a, b, tol) => Math.abs(a - b) <= (tol === undefined ? TOL : tol);
const nearPt = (p, q, tol) => near(p.x, q.x, tol) && near(p.y, q.y, tol);
function polyPts(p){
  const toks = String(p.d).trim().split(/\s+/);
  const pts = [];
  for (let i = 0; i < toks.length; i++) if (toks[i] === 'M' || toks[i] === 'L') pts.push(P_(Number(toks[i + 1]), Number(toks[i + 2])));
  return /Z$/.test(String(p.d).trim()) ? pts : null;
}
/* 一段 A 弧（兩個端點剛好是直徑的兩端）往哪一邊凸：回傳弧的中點。 */
function arcMid(p){
  const t = String(p.d).trim().split(/\s+/);
  if (t[0] !== 'M' || t[3] !== 'A' || t.length !== 11) return null;
  const a = P_(Number(t[1]), Number(t[2])), b = P_(Number(t[9]), Number(t[10])), sweep = Number(t[8]);
  const c = P_((a.x + b.x) / 2, (a.y + b.y) / 2), v = P_(a.x - c.x, a.y - c.y);
  /* 畫布的 y 往下：sweep ＝ 1 是角度變大的方向，轉 90 度是 (－v.y, v.x) */
  return { a:a, b:b, c:c, R:Number(t[4]), mid: sweep === 1 ? P_(c.x - v.y, c.y + v.x) : P_(c.x + v.y, c.y - v.x) };
}
/* 實線有沒有把線段 a→b 整段蓋住（共線的實線投影到 [0, 1] 之後的聯集） */
function coveredBySolid(lines, a, b){
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const u = P_((b.x - a.x) / L, (b.y - a.y) / L);
  const iv = [];
  lines.forEach(ln => {
    const p1 = P_(ln.x1, ln.y1), p2 = P_(ln.x2, ln.y2);
    const off = q => Math.abs((q.x - a.x) * u.y - (q.y - a.y) * u.x);
    if (off(p1) > 0.4 || off(p2) > 0.4) return;
    const t1 = ((p1.x - a.x) * u.x + (p1.y - a.y) * u.y) / L, t2 = ((p2.x - a.x) * u.x + (p2.y - a.y) * u.y) / L;
    iv.push([Math.min(t1, t2), Math.max(t1, t2)]);
  });
  iv.sort((x, y) => x[0] - y[0]);
  let reach = 0;
  for (const [lo, hi] of iv){ if (lo > reach + 0.01) break; reach = Math.max(reach, hi); }
  return reach >= 1 - 0.01;
}
function wantFills(mark){
  return { front: mark === 'vol' ? C_REF.VOL : mark === 'lat' ? C_REF.PLAIN : mark === 'surf' ? C_REF.HI : C_REF.BASE,
           side: mark === 'vol' ? C_REF.VOL : (mark === 'lat' || mark === 'surf') ? C_REF.HI : C_REF.SIDE };
}
function geomSolidProblems(tag, pl, b, h, mark, showR, hideH){
  const out = [];
  if (!pl || pl.tooBig || !Array.isArray(pl.prims)) return out;
  const s = pl.s, prims = pl.prims;
  if (!isIntIn(s, SC_MIN_REF, SC_MAX_REF)){ out.push(tag + ': the scale ' + s + ' is not a whole number of px per centimetre in ' + SC_MIN_REF + '..' + SC_MAX_REF); return out; }
  const D = P_(DEPTH_X_REF * h * s, -DEPTH_Y_REF * h * s);
  const fills = wantFills(mark);
  const lines = prims.filter(p => p.k === 'line');
  const texts = prims.filter(p => p.k === 'text');
  const dimVal = t => texts.filter(x => x.t === String(t)).length;
  if (b.shape === 'circ'){
    const R = b.r * s;
    const discs = prims.filter(p => p.k === 'circle' && p.r === R);
    /* ⚠️ 「體積」「表面積」兩張圖的前後兩個圓是同一個顏色：先找外框，再找和外框同心的那一片。 */
    /* ⚠️ 「體積」「表面積」兩張圖的前後兩個圓同一個顏色：正面那一片是**後畫**的那一片（畫在後面的圓之上）。
       先找出來、再**另外**驗它和外框同心（以前用同心去找它，那條斷言永遠不會響 —— codex 抓到）。 */
    const outline = discs.find(p => p.fill === 'none' && p.stroke === C_REF.LINE);
    const filled = discs.filter(p => p.stroke === 'none' && p.fill === fills.front);
    const front = filled[filled.length - 1];
    if (!front || !outline){ out.push(tag + ': the cylinder has no front disc of radius ' + R + 'px (' + b.r + ' × ' + s + ') in the colour for "' + mark + '", or no outline'); return out; }
    if (!nearPt(P_(front.cx, front.cy), P_(outline.cx, outline.cy))) out.push(tag + ': the front disc and its outline are not the same circle');
    const fc = P_(front.cx, front.cy), bc = P_(fc.x + D.x, fc.y + D.y);
    const back = discs.find(p => p !== front && p.fill === fills.side && nearPt(P_(p.cx, p.cy), bc));
    if (!back) out.push(tag + ': the back disc is not the front disc moved by (' + D.x.toFixed(1) + ', ' + D.y.toFixed(1) + ') in the side colour');
    /* 兩條切線：從正面圓上垂直於往後方向的兩點出發、剛好往後延伸 D */
    const tangents = lines.filter(l => l.stroke === C_REF.LINE && !l.dash);
    if (tangents.length !== 2) out.push(tag + ': ' + tangents.length + ' solid straight edges on a cylinder, the outline has exactly 2');
    tangents.forEach((l, i) => {
      const v = P_(l.x1 - fc.x, l.y1 - fc.y);
      if (!near(Math.hypot(v.x, v.y), R, 0.3)) out.push(tag + ': tangent ' + i + ' does not start on the front circle');
      if (Math.abs(v.x * D.x + v.y * D.y) > 0.6 * Math.hypot(D.x, D.y)) out.push(tag + ': tangent ' + i + ' does not start where the outline touches (it must be square to the depth direction)');
      if (!near(l.x2 - l.x1, D.x) || !near(l.y2 - l.y1, D.y)) out.push(tag + ': tangent ' + i + ' does not run back by the prism’s depth');
    });
    const arcs = prims.filter(p => p.k === 'path' && /A/.test(p.d)).map(p => ({ p:p, m:arcMid(p) }));
    const backArcs = arcs.filter(x => x.p.stroke === C_REF.LINE);
    if (backArcs.length !== 2) out.push(tag + ': the back circle is drawn with ' + backArcs.length + ' arcs, expected a solid and a dashed half');
    backArcs.forEach(x => {
      if (!x.m){ out.push(tag + ': an arc cannot be read'); return; }
      if (!nearPt(x.m.c, bc, 0.3) || !near(x.m.R, R)) out.push(tag + ': a back arc is not on the back circle');
      const far = (x.m.mid.x - bc.x) * D.x + (x.m.mid.y - bc.y) * D.y > 0;
      if (far === Boolean(x.p.dash)) out.push(tag + ': the ' + (x.p.dash ? 'dashed' : 'solid') + ' half of the back circle is the ' + (far ? 'far' : 'near') + ' half — the hidden half is the near one');
    });
    const layerArcs = arcs.filter(x => x.p.stroke === C_REF.LAYER);
    const wantLayers = mark === 'layers' ? h - 1 : 0;
    if (layerArcs.length !== wantLayers) out.push(tag + ': ' + layerArcs.length + ' layer lines, expected ' + wantLayers + ' (h − 1)');
    const ks = new Set();
    layerArcs.forEach(x => {
      if (!x.m) return;
      const k = Math.round((x.m.c.x - fc.x) / D.x * h);
      if (!(k >= 1 && k < h) || !nearPt(x.m.c, P_(fc.x + D.x * k / h, fc.y + D.y * k / h), 0.3)) out.push(tag + ': a layer line is not a whole centimetre back');
      ks.add(k);
      if ((x.m.mid.x - x.m.c.x) * D.x + (x.m.mid.y - x.m.c.y) * D.y <= 0) out.push(tag + ': a layer line bulges towards the viewer, where the side is hidden');
    });
    if (ks.size !== wantLayers) out.push(tag + ': the layer lines are not one per centimetre');
    const dim = lines.filter(l => l.stroke === C_REF.DIM);
    if (dim.length !== 1 || dim[0].y1 !== dim[0].y2 || !near(dim[0].y1, fc.y)) out.push(tag + ': the cylinder should carry one horizontal dimension line through the centre');
    else {
      const len = Math.abs(dim[0].x2 - dim[0].x1);
      if (!near(len, showR === 'd' ? 2 * R : R)) out.push(tag + ': the dimension line is ' + len + 'px, a ' + (showR === 'd' ? 'diameter' : 'radius') + ' is ' + (showR === 'd' ? 2 * R : R));
    }
    if (dimVal(showR === 'd' ? 2 * b.r : b.r) < 1) out.push(tag + ': the ' + (showR === 'd' ? 'diameter' : 'radius') + ' ' + (showR === 'd' ? 2 * b.r : b.r) + ' is not written on the base');
    const hText = texts.filter(t => t.anchor === 'start');
    if (hText.length !== 1) out.push(tag + ': ' + hText.length + ' height labels');
    else {
      const wantH = hideH ? '?' : String(h);
      if (hText[0].t !== wantH) out.push(tag + ': the cylinder’s height label says "' + hText[0].t + '", expected "' + wantH + '"');
      const t0 = tangents.find(l => l.y1 > fc.y);
      if (t0 && !near(hText[0].x, (t0.x1 + t0.x2) / 2 + 10, 0.3)) out.push(tag + ': the height label is not beside the lower outline edge');
    }
    return out;
  }
  /* ---- 角柱 ---- */
  const firstLine = prims.findIndex(p => p.k === 'line');
  const fillPaths = prims.slice(0, firstLine < 0 ? prims.length : firstLine).filter(p => p.k === 'path');
  const frontP = fillPaths[fillPaths.length - 1];
  const fp = frontP ? polyPts(frontP) : null;
  const fr = frontRef(b), nWant = fr.pts.length;
  if (!fp || fp.length !== nWant){ out.push(tag + ': the front face is not a closed polygon with ' + nWant + ' corners'); return out; }
  if (frontP.fill !== fills.front) out.push(tag + ': the front face is filled ' + frontP.fill + ', the "' + mark + '" picture fills it ' + fills.front);
  /* 量回公分：對齊 1/6 公分（三角形的頂點在 w/3、平行四邊形斜 t/2、梯形退 (w − u)/2） */
  const minX = Math.min.apply(null, fp.map(p => p.x)), maxY = Math.max.apply(null, fp.map(p => p.y));
  const cm6 = [];
  for (const p of fp){
    const X = (p.x - minX) / s * 6, Y = (maxY - p.y) / s * 6;
    if (Math.abs(X - Math.round(X)) > 6 * TOL / s || Math.abs(Y - Math.round(Y)) > 6 * TOL / s){ out.push(tag + ': a corner of the front face is not on the 1/6-centimetre grid (' + p.x + ', ' + p.y + ')'); return out; }
    cm6.push([Math.round(X), Math.round(Y)]);
  }
  let twice = 0;
  for (let i = 0; i < cm6.length; i++){ const p = cm6[i], q = cm6[(i + 1) % cm6.length]; twice += p[0] * q[1] - q[0] * p[1]; }
  const want72 = areaRefH(b) * 72 / 100;
  if (Math.abs(twice) !== want72) out.push(tag + ': the front face measures ' + (Math.abs(twice) / 72) + ' square centimetres, the base area is ' + hTextRef(areaRefH(b)) + ' — the base is not drawn true to shape');
  const bottom = cm6.filter(p => p[1] === 0).map(p => p[0]).sort((x, y) => x - y);
  const wBottom = b.shape === 'rect' ? b.a : b.w;
  if (String(bottom) !== String([0, wBottom * 6])) out.push(tag + ': the bottom edge of the base is not ' + wBottom + ' centimetres long');
  const topY = Math.max.apply(null, cm6.map(p => p[1]));
  const tWant = b.shape === 'rect' ? b.b : b.t;
  if (topY !== tWant * 6) out.push(tag + ': the base is ' + (topY / 6) + ' centimetres tall, its height is ' + tWant);
  if (b.shape === 'trap'){
    const top = cm6.filter(p => p[1] === topY).map(p => p[0]).sort((x, y) => x - y);
    if (top.length !== 2 || top[1] - top[0] !== b.u * 6) out.push(tag + ': the top side of the trapezium is not ' + b.u + ' centimetres');
  }
  if (b.shape === 'rtri' && !(cm6.some(p => p[0] === 0 && p[1] === 0) && cm6.some(p => p[0] === 0 && p[1] === b.t * 6))) out.push(tag + ': the right angle is not at the bottom-left corner (the two legs must run along the bottom and up the left)');
  /* 看得到／看不到：用公分座標的外法線重算一次，和圖上的實線／虛線後緣逐條對 */
  const signs = faceSignsRef(cm6.map(p => [p[0] / 6, p[1] / 6]));
  const conn = (l, a, c) => (nearPt(P_(l.x1, l.y1), a) && nearPt(P_(l.x2, l.y2), c)) || (nearPt(P_(l.x1, l.y1), c) && nearPt(P_(l.x2, l.y2), a));
  const edgeLines = lines.filter(l => l.stroke === C_REF.LINE && l.sw === STROKE_REF);
  const n = fp.length;
  const Qp = fp.map(p => P_(p.x + D.x, p.y + D.y));
  let visCount = 0, zeroFaces = [];
  /* ⚠️ 剛好側著看的那一面，如果邊長又剛好等於往後的長度，前緣、後緣、往後的稜會疊成同一條線 ——
     那幾條的「剛好一條」不能用計數驗，改由下面的 coveredBySolid 驗輪廓線。 */
  const touchesZero = k => signs[k] === 0 || signs[(k + n - 1) % n] === 0;
  for (let i = 0; i < n; i++){
    const j = (i + 1) % n;
    const fronts = edgeLines.filter(l => conn(l, fp[i], fp[j]));
    if (!fronts.some(l => !l.dash) || (fronts.length !== 1 && signs[i] !== 0)) out.push(tag + ': front edge ' + i + ' is not drawn exactly once as a solid line');
    const backs = edgeLines.filter(l => conn(l, Qp[i], Qp[j]));
    if (backs.length !== 1 && !(signs[i] === 0 && backs.length >= 1)){ out.push(tag + ': back edge ' + i + ' is drawn ' + backs.length + ' times, expected once (the front edge moved back by the height)'); continue; }
    const solid = !backs[0].dash;
    if (signs[i] > 0) visCount++;
    if (signs[i] === 0) zeroFaces.push(i);
    else if (solid !== (signs[i] > 0)) out.push(tag + ': side face ' + i + ' is ' + (signs[i] > 0 ? 'visible' : 'hidden') + ' (its outward normal · (0.4, 0.3) is ' + (signs[i] > 0 ? 'positive' : 'negative') + '), but its back edge is drawn ' + (solid ? 'solid' : 'dashed'));
    /* 往後的稜：每一個頂點剛好一條，向量是 (0.4hs, −0.3hs) */
    const depth = edgeLines.filter(l => conn(l, fp[i], Qp[i]));
    if (depth.length !== 1 && !(touchesZero(i) && depth.length >= 1)) out.push(tag + ': corner ' + i + ' has ' + depth.length + ' edges running back by (0.4 × ' + h + ' × ' + s + ', −0.3 × ' + h + ' × ' + s + '), expected exactly 1');
  }
  /* 剛好側著看的那一面：它是一條輪廓線，兩種畫法都可以，但那一條線一定要被實線整段畫到 */
  zeroFaces.forEach(i => {
    const j = (i + 1) % n, solidLines = edgeLines.filter(l => !l.dash);
    if (!coveredBySolid(solidLines, fp[i], Qp[j]) && !coveredBySolid(solidLines, fp[j], Qp[i]))
      out.push(tag + ': side face ' + i + ' is seen edge-on, and the outline it makes is not covered by solid lines');
  });
  const sideFills = fillPaths.slice(0, -1);
  if (sideFills.length < visCount || sideFills.length > visCount + zeroFaces.length) out.push(tag + ': ' + sideFills.length + ' side faces are painted, ' + visCount + ' can be seen');
  sideFills.forEach(p => { if (p.fill !== fills.side) out.push(tag + ': a side face is filled ' + p.fill + ', the "' + mark + '" picture fills sides ' + fills.side); });
  /* 分層線：看得到的每一個側面，k ＝ 1 … h − 1 各一條，和前緣平行、往後 k/h × D */
  const layers = lines.filter(l => l.stroke === C_REF.LAYER);
  const visFaces = [];
  for (let i = 0; i < n; i++) if (signs[i] > 0) visFaces.push(i);
  if (mark === 'layers'){
    let matched = 0;
    for (const i of visFaces.concat(zeroFaces)){
      const j = (i + 1) % n;
      for (let k = 1; k < h; k++){
        const a = P_(fp[i].x + D.x * k / h, fp[i].y + D.y * k / h), c = P_(fp[j].x + D.x * k / h, fp[j].y + D.y * k / h);
        if (layers.some(l => conn(l, a, c))) matched++;
        else if (visFaces.indexOf(i) >= 0) out.push(tag + ': side face ' + i + ' is missing its layer line ' + k + ' cm back');
      }
    }
    if (layers.length !== matched) out.push(tag + ': ' + layers.length + ' layer lines, ' + matched + ' of them are a whole centimetre back on a visible face');
    if (layers.length < (h - 1) * visFaces.length || layers.length > (h - 1) * (visFaces.length + zeroFaces.length)) out.push(tag + ': ' + layers.length + ' layer lines, expected (h − 1) × visible faces = ' + (h - 1) * visFaces.length);
  } else if (layers.length) out.push(tag + ': a "' + mark + '" picture has ' + layers.length + ' layer lines');
  /* 尺寸數字：和底面的數字一樣，高寫在 P1 往後那一條旁邊 */
  const wantDims = b.shape === 'rect' ? [b.a, b.b] : b.shape === 'trap' ? [b.w, b.t, b.u] : b.shape === 'rtri' ? [b.w, b.t, b.c] : [b.w, b.t];
  const hLab = texts.filter(t => t.anchor === 'start' && near(t.x, (fp[1].x + Qp[1].x) / 2 + 10, 0.3) && near(t.y, (fp[1].y + Qp[1].y) / 2 + 14, 0.3));
  const dims = texts.filter(t => hLab.indexOf(t) < 0).map(t => t.t).sort();
  if (String(dims) !== String(wantDims.map(String).sort())) out.push(tag + ': the dimensions written on the ' + b.shape + ' base are [' + dims + '], the base’s own numbers are [' + wantDims + ']');
  if (hLab.length !== 1) out.push(tag + ': ' + hLab.length + ' height labels beside the bottom-right edge running back, expected 1');
  else {
    const wantH = hideH ? '?' : String(h);
    if (hLab[0].t !== wantH) out.push(tag + ': the prism’s height label says "' + hLab[0].t + '", expected "' + wantH + '"');
    const d1 = edgeLines.filter(l => conn(l, fp[1], Qp[1]));
    if (d1.length === 1 && d1[0].dash) out.push(tag + ': the height is written beside a hidden (dashed) edge');
  }
  /* 底面圖形的高：一條垂直的虛線，從頂點量到底邊，長 t × s */
  const dimLines = lines.filter(l => l.stroke === C_REF.DIM);
  if (b.shape === 'tri' || b.shape === 'para' || b.shape === 'trap'){
    if (dimLines.length !== 1) out.push(tag + ': ' + dimLines.length + ' base-height lines, expected 1');
    else {
      const l = dimLines[0];
      if (!near(l.x1, l.x2) || !near(Math.abs(l.y2 - l.y1), b.t * s) || !fp.some(p => nearPt(p, P_(l.x1, Math.min(l.y1, l.y2)))) || !near(Math.max(l.y1, l.y2), maxY))
        out.push(tag + ': the base-height line is not vertical from a top corner down to the bottom edge (' + b.t + ' × ' + s + ' px)');
      /* 三角形與梯形的頂點一定在底邊正上方；平行四邊形很扁的時候垂足會落在底邊的延長線上（那是合法的畫法）。 */
      if (b.shape !== 'para' && !(l.x1 >= minX - TOL && l.x1 <= minX + wBottom * s + TOL)) out.push(tag + ': the base-height line falls outside the bottom edge');
    }
  } else if (dimLines.length) out.push(tag + ': a ' + b.shape + ' base carries ' + dimLines.length + ' base-height lines, its height is a side');
  return out;
}
function geomNetProblems(tag, pl, b, h){
  const out = [];
  if (!pl || pl.tooBig || !Array.isArray(pl.prims)) return out;
  const s = pl.s, prims = pl.prims;
  const strip = prims.filter(p => p.k === 'rect' && p.fill === C_REF.HI).sort((x, y) => x.x - y.x);
  const texts = prims.filter(p => p.k === 'text');
  if (!strip.length){ out.push(tag + ': the net has no side strip'); return out; }
  const sy = strip[0].y, sh = strip[0].h;
  if (strip.some(r => !near(r.y, sy) || !near(r.h, sh))) out.push(tag + ': the side strip is not one straight band');
  if (!near(sh, h * s)) out.push(tag + ': the side strip is ' + sh + 'px tall, the height is ' + h + ' × ' + s);
  for (let i = 1; i < strip.length; i++) if (!near(strip[i].x, strip[i - 1].x + strip[i - 1].w)) out.push(tag + ': the side faces of the net are not side by side');
  const x0 = strip[0].x, total = strip.reduce((a, r) => a + r.w, 0);
  const perimCm = perimRefH(b) / 100;
  if (!near(total, perimCm * s, 0.15 + 0.05 * strip.length)) out.push(tag + ': the side strip is ' + total.toFixed(1) + 'px wide, the base perimeter is ' + hTextRef(perimRefH(b)) + ' × ' + s);
  const segs = edgesRef(b);
  const hLab = texts.filter(t => t.anchor === 'end');
  if (hLab.length !== 1 || hLab[0].t !== String(h) || !(hLab[0].x < x0)) out.push(tag + ': the net’s height label is not a single "' + h + '" to the left of the strip');
  const onStrip = texts.filter(t => t.anchor === 'middle').map(t => t.t);
  if (b.shape === 'circ'){
    if (strip.length !== 1) out.push(tag + ': a cylinder’s side unrolls into one rectangle, not ' + strip.length);
    if (String(onStrip) !== String([hTextRef(perimRefH(b))])) out.push(tag + ': the strip is labelled [' + onStrip + '], the base perimeter is ' + hTextRef(perimRefH(b)));
    const R = b.r * s;
    const discs = prims.filter(p => p.k === 'circle' && p.fill === C_REF.BASE);
    if (discs.length !== 2) out.push(tag + ': the net has ' + discs.length + ' circle bases, expected 2');
    discs.forEach((c, i) => {
      if (!near(c.r, R)) out.push(tag + ': base ' + i + ' has radius ' + c.r + 'px, the radius is ' + b.r + ' × ' + s);
      const touchTop = near(c.cy + c.r, sy), touchBot = near(c.cy - c.r, sy + sh);
      if (!touchTop && !touchBot) out.push(tag + ': base ' + i + ' is not attached to the strip');
      if (!(c.cx >= x0 && c.cx <= x0 + total)) out.push(tag + ': base ' + i + ' is not over the strip');
    });
    if (discs.length === 2 && !((near(discs[0].cy + discs[0].r, sy) && near(discs[1].cy - discs[1].r, sy + sh)) || (near(discs[1].cy + discs[1].r, sy) && near(discs[0].cy - discs[0].r, sy + sh))))
      out.push(tag + ': the two bases are not one above and one below the strip');
    return out;
  }
  if (strip.length !== segs.length) out.push(tag + ': the strip has ' + strip.length + ' faces, the base has ' + segs.length + ' edges');
  strip.forEach((r, i) => { if (segs[i] !== undefined && !near(r.w, segs[i] * s)) out.push(tag + ': strip face ' + i + ' is ' + r.w + 'px, the matching edge of the base is ' + segs[i] + ' × ' + s); });
  if (String(onStrip) !== String(segs.map(String))) out.push(tag + ': the strip faces are labelled [' + onStrip + '], the base edges are [' + segs + ']');
  /* 兩個底面：多邊形（長方形的 rect 或三角形的 path），貼在長條的上緣與下緣 */
  const bases = prims.filter(p => (p.k === 'rect' || p.k === 'path') && p.fill === C_REF.BASE).map(p => p.k === 'rect'
    ? [P_(p.x, p.y), P_(p.x + p.w, p.y), P_(p.x + p.w, p.y + p.h), P_(p.x, p.y + p.h)] : polyPts(p));
  if (bases.length !== 2 || bases.some(x => !x)){ out.push(tag + ': the net has ' + bases.length + ' readable bases, expected 2'); return out; }
  const edgesY = [sy, sy + sh];
  bases.forEach((pts, bi) => {
    /* 面積：鞋帶公式 ÷ s² ＝ 底面積 */
    let tw = 0;
    for (let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[(i + 1) % pts.length]; tw += p.x * q.y - q.x * p.y; }
    if (!near(Math.abs(tw) / 2 / (s * s), areaRefH(b) / 100, 0.05)) out.push(tag + ': base ' + bi + ' measures ' + (Math.abs(tw) / 2 / s / s).toFixed(2) + ' square centimetres, the base area is ' + hTextRef(areaRefH(b)));
    /* 貼在長條的哪一條邊上：剛好兩個頂點在那一條水平線上，而且是長條上的某一格 */
    const ey = edgesY.find(y => pts.filter(p => near(p.y, y)).length === 2);
    if (ey === undefined){ out.push(tag + ': base ' + bi + ' is not attached along one edge of the strip'); return; }
    const on = pts.map((p, i) => i).filter(i => near(pts[i].y, ey));
    const xa = Math.min(pts[on[0]].x, pts[on[1]].x), xb = Math.max(pts[on[0]].x, pts[on[1]].x);
    const cell = strip.findIndex(r => near(r.x, xa) && near(r.x + r.w, xb));
    if (cell < 0){ out.push(tag + ': base ' + bi + ' is attached along something that is not one strip face'); return; }
    /* ⚠️ 摺得起來嗎：貼著的那一格，右端相鄰的底面邊長要等於長條上右邊那一格，左端要等於左邊那一格（頭尾相接）。 */
    const lenAt = xEnd => {
      const iEnd = on.find(i => near(pts[i].x, xEnd));
      const other = on.find(i => i !== iEnd);
      const nb = [(iEnd + 1) % pts.length, (iEnd + pts.length - 1) % pts.length].find(k => k !== other);
      return Math.hypot(pts[nb].x - pts[iEnd].x, pts[nb].y - pts[iEnd].y) / s;
    };
    const right = segs[(cell + 1) % segs.length], left = segs[(cell + segs.length - 1) % segs.length];
    if (!near(lenAt(xb), right, 0.1) || !near(lenAt(xa), left, 0.1))
      out.push(tag + ': base ' + bi + ' would not fold onto the prism — at the right end of the ' + segs[cell] + ' cm face its next edge is ' + lenAt(xb).toFixed(1) + ' cm but the strip’s next face is ' + right + ' cm; at the left end ' + lenAt(xa).toFixed(1) + ' vs ' + left + ' (the base is drawn mirrored)');
    const above = pts.every(p => p.y <= ey + TOL), below = pts.every(p => p.y >= ey - TOL);
    if (ey === sy && !above) out.push(tag + ': the top base overlaps the strip');
    if (ey === sy + sh && !below) out.push(tag + ': the bottom base overlaps the strip');
  });
  const ys = bases.map(pts => edgesY.find(y => pts.filter(p => near(p.y, y)).length === 2));
  if (!(ys.indexOf(sy) >= 0 && ys.indexOf(sy + sh) >= 0)) out.push(tag + ': the two bases are not one on each side of the strip');
  return out;
}

/* ---------- 8) 複習頁：整句題幹重建（每一支產生器、每一種語言各一份） ---------- */
const cmRef = n => plEnRef(n, 'centimetre');
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'triPrismVol':
      return zh ? '一個三角柱，底面三角形的<strong>底是 ' + d.w + ' 公分</strong>、<strong>高是 ' + d.t + ' 公分</strong>，柱體的<strong>高是 ' + d.h + ' 公分</strong>。它的體積是多少？'
                : 'A triangular prism has a base triangle with a <strong>base of ' + cmRef(d.w) + '</strong> and a <strong>height of ' + cmRef(d.t) + '</strong>; the prism is <strong>' + cmRef(d.h) + ' high</strong>. What is its volume?';
    case 'quadPrismVol': {
      const b = d.base || {};
      if (b.shape === 'trap') return zh ? '一個四角柱的底面是梯形，<strong>上底 ' + b.u + ' 公分、下底 ' + b.w + ' 公分、高 ' + b.t + ' 公分</strong>；柱體的<strong>高是 ' + d.h + ' 公分</strong>。它的體積是多少？'
                                        : 'A four-sided prism has a trapezium base: <strong>top ' + cmRef(b.u) + ', bottom ' + cmRef(b.w) + ', height ' + cmRef(b.t) + '</strong>; the prism is <strong>' + cmRef(d.h) + ' high</strong>. What is its volume?';
      if (b.shape === 'para') return zh ? '一個四角柱的底面是平行四邊形，<strong>底 ' + b.w + ' 公分、高 ' + b.t + ' 公分</strong>；柱體的<strong>高是 ' + d.h + ' 公分</strong>。它的體積是多少？'
                                        : 'A four-sided prism has a parallelogram base: <strong>base ' + cmRef(b.w) + ', height ' + cmRef(b.t) + '</strong>; the prism is <strong>' + cmRef(d.h) + ' high</strong>. What is its volume?';
      return null;
    }
    case 'cylVolR':
      return zh ? '一個圓柱的底面<strong>半徑是 ' + d.r + ' 公分</strong>、<strong>高是 ' + d.h + ' 公分</strong>，它的體積是多少？'
                : 'A cylinder has a base <strong>radius of ' + cmRef(d.r) + '</strong> and a <strong>height of ' + cmRef(d.h) + '</strong>. What is its volume?';
    case 'cylVolD':
      return zh ? '一個圓柱的底面<strong>直徑是 ' + (2 * d.r) + ' 公分</strong>、<strong>高是 ' + d.h + ' 公分</strong>，它的體積是多少？'
                : 'A cylinder has a base <strong>diameter of ' + cmRef(2 * d.r) + '</strong> and a <strong>height of ' + cmRef(d.h) + '</strong>. What is its volume?';
    case 'heightFromVol': {
      const V = d.a * d.b * d.h;
      return zh ? '一個長方體的底面是<strong>長 ' + d.a + ' 公分、寬 ' + d.b + ' 公分</strong>的長方形，<strong>體積是 ' + V + ' 立方公分</strong>。它的<strong>高</strong>是多少？'
                : 'A cuboid’s base is a rectangle <strong>' + cmRef(d.a) + ' long and ' + cmRef(d.b) + ' wide</strong>, and its <strong>volume is ' + plEnRef(V, 'cubic centimetre') + '</strong>. What is its <strong>height</strong>?';
    }
    case 'cuboidSurf':
      return zh ? '一個長方體長 <strong>' + d.a + ' 公分</strong>、寬 <strong>' + d.b + ' 公分</strong>、高 <strong>' + d.h + ' 公分</strong>，它的<strong>表面積</strong>是多少？'
                : 'A cuboid is <strong>' + cmRef(d.a) + '</strong> long, <strong>' + cmRef(d.b) + '</strong> wide and <strong>' + cmRef(d.h) + '</strong> high. What is its <strong>surface area</strong>?';
    case 'cylLateral':
      return zh ? '一個圓柱形的罐頭，底面<strong>半徑 ' + d.r + ' 公分</strong>、<strong>高 ' + d.h + ' 公分</strong>。只在<strong>旁邊貼一圈標籤</strong>（上下兩面不貼），標籤要多大一張？'
                : 'A can is a cylinder with a base <strong>radius of ' + cmRef(d.r) + '</strong> and a <strong>height of ' + cmRef(d.h) + '</strong>. A label goes <strong>right round its side only</strong> (not on the top or bottom). How big is the label?';
    case 'cylSurf':
      return zh ? '一個圓柱的底面<strong>半徑是 ' + d.r + ' 公分</strong>、<strong>高是 ' + d.h + ' 公分</strong>，它的<strong>表面積</strong>是多少？'
                : 'A cylinder has a base <strong>radius of ' + cmRef(d.r) + '</strong> and a <strong>height of ' + cmRef(d.h) + '</strong>. What is its <strong>surface area</strong>?';
    case 'whichQuantity':
      return zh ? '下面四個問題，<strong>只有一個要算體積</strong>。是哪一個？' : 'Of these four questions, <strong>exactly one wants a volume</strong>. Which?';
    case 'trueStatement':
      return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interCircle':
      if (d.wantArea) return zh ? '（六年級）一個<strong>圓</strong>的半徑是 <strong>' + d.r + ' 公分</strong>，它的<strong>面積</strong>是多少？'
                                : '(Grade six) A <strong>circle</strong> has a radius of <strong>' + cmRef(d.r) + '</strong>. What is its <strong>area</strong>?';
      return zh ? '（六年級）一個<strong>圓</strong>的半徑是 <strong>' + d.r + ' 公分</strong>，它的<strong>圓周長</strong>是多少？'
                : '(Grade six) A <strong>circle</strong> has a radius of <strong>' + cmRef(d.r) + '</strong>. What is its <strong>circumference</strong>?';
    case 'interCuboid':
      return zh ? '（五年級）一個長方體長 <strong>' + d.a + ' 公分</strong>、寬 <strong>' + d.b + ' 公分</strong>、高 <strong>' + d.h + ' 公分</strong>，它的體積是多少？'
                : '(Grade five) A cuboid is <strong>' + cmRef(d.a) + '</strong> long, <strong>' + cmRef(d.b) + '</strong> wide and <strong>' + cmRef(d.h) + '</strong> high. What is its volume?';
    default: return null;
  }
}

/* ---------- 9) 產生器：每一支的正解、設計好的誘答、題幹印出來的數 ----------
   正解與誘答全部用上面的第二套實作重算（百分之一 ＋ 單位）。
   ⚠️ 誘答的規則：每一個「設計好的迷思」都必須真的出現在選項裡 —— 唯一的例外是它的值剛好是題幹印出來的數
   （頁面刻意不抄題幹）。它和正解撞在一起（迷思算出來的就是正解）、或被頁面的上限砍掉，都是缺陷。 */
function genModel(genId, d){
  const T = (h, u) => ({ h:h, u:u });
  switch (genId){
    case 'triPrismVol': {
      const b = { shape:'tri', w:d.w, t:d.t }, v = volRefH(b, d.h);
      return { params:[['w', d.w, 2, 12], ['t', d.t, 2, 10], ['h', d.h, 2, 15]], correct:T(v, 'cu'), stem:[d.w, d.t, d.h],
               designed:[['forgot the ÷ 2', T(2 * v, 'cu'), true], ['only the base area', T(areaRefH(b), 'cu')], ['base × prism height (the triangle’s height left out)', T(addTimes(addTimes(100, d.w), d.h), 'cu')]] };
    }
    case 'quadPrismVol': {
      const b = d.base || {};
      if (b.shape === 'trap'){
        const v = volRefH(b, d.h);
        return { params:[['u', b.u, 1, 11], ['w', b.w, 3, 12], ['t', b.t, 2, 8], ['h', d.h, 2, 15]], extra: b.u < b.w ? null : 'the top side is not shorter than the bottom',
                 correct:T(v, 'cu'), stem:[b.u, b.w, b.t, d.h],
                 designed:[['forgot to halve the trapezium', T(2 * v, 'cu'), true], ['only the base area', T(areaRefH(b), 'cu')], ['used only the bottom side', T(addTimes(addTimes(addTimes(100, b.w), b.t), d.h), 'cu')]] };
      }
      if (b.shape === 'para'){
        const v = volRefH(b, d.h);
        return { params:[['w', b.w, 2, 12], ['t', b.t, 2, 10], ['h', d.h, 2, 15]], correct:T(v, 'cu'), stem:[b.w, b.t, d.h],
                 designed:[['halved a parallelogram', T(v / 2, 'cu'), true], ['only the base area', T(areaRefH(b), 'cu')], ['base × prism height (the parallelogram’s height left out)', T(addTimes(addTimes(100, b.w), d.h), 'cu')]] };
      }
      return { bad:'the base is neither a trapezium nor a parallelogram: ' + JSON.stringify(b) };
    }
    case 'cylVolR': {
      const b = { shape:'circ', r:d.r }, v = volRefH(b, d.h);
      return { params:[['r', d.r, 1, 10], ['h', d.h, 2, 15]], correct:T(v, 'cu'), stem:[d.r, d.h],
               designed:[['worked out the side area', T(latRefH(b, d.h), 'cu'), true], ['used the radius only once', T(addTimes(addTimes(PI_H_REF, d.r), d.h), 'cu')], ['only the base area', T(areaRefH(b), 'cu')]] };
    }
    case 'cylVolD': {
      const b = { shape:'circ', r:d.r }, v = volRefH(b, d.h);
      return { params:[['r', d.r, 1, 10], ['h', d.h, 2, 15]], correct:T(v, 'cu'), stem:[2 * d.r, d.h],
               designed:[['used the diameter as the radius', T(volRefH({ shape:'circ', r:2 * d.r }, d.h) === null ? addTimes(addTimes(addTimes(PI_H_REF, 2 * d.r), 2 * d.r), d.h) : volRefH({ shape:'circ', r:2 * d.r }, d.h), 'cu'), true],
                         ['worked out the side area', T(latRefH(b, d.h), 'cu')], ['only the base area', T(areaRefH(b), 'cu')]] };
    }
    case 'heightFromVol': {
      const A = d.a * d.b, V = A * d.h;
      return { params:[['a', d.a, 2, 12], ['b', d.b, 2, 10], ['h', d.h, 2, 15]], correct:T(heightFromRef(V * 100, A * 100) * 100, 'cm'), stem:[d.a, d.b, V],
               designed:[['subtracted instead of dividing', T((V - A) * 100, 'cm')], ['added instead of dividing', T((V + A) * 100, 'cm'), true], [d.h % 2 === 0 ? 'halved once too often' : 'doubled once too often', T(d.h % 2 === 0 ? d.h * 50 : d.h * 200, 'cm')]],
               echoToo:[A] };
    }
    case 'cuboidSurf': {
      const b = { shape:'rect', a:d.a, b:d.b }, A = areaRefH(b), L = latRefH(b, d.h);
      return { params:[['a', d.a, 2, 12], ['b', d.b, 2, 10], ['h', d.h, 2, 15]], correct:T(surfRefH(b, d.h), 'sq'), stem:[d.a, d.b, d.h],
               designed:[['only one base', T(A + L, 'sq'), true], ['only the side', T(L, 'sq')], ['half the perimeter of the base', T(A + A + L / 2, 'sq')]] };
    }
    case 'cylLateral': {
      const b = { shape:'circ', r:d.r }, L = latRefH(b, d.h);
      return { params:[['r', d.r, 1, 10], ['h', d.h, 2, 15]], correct:T(L, 'sq'), stem:[d.r, d.h],
               designed:[['the whole surface area', T(surfRefH(b, d.h), 'sq'), true], ['radius × 3.14 × height (the × 2 dropped)', T(addTimes(addTimes(PI_H_REF, d.r), d.h), 'sq')], ['side plus one base', T(L + areaRefH(b), 'sq')]] };
    }
    case 'cylSurf': {
      const b = { shape:'circ', r:d.r }, A = areaRefH(b), L = latRefH(b, d.h);
      return { params:[['r', d.r, 1, 10], ['h', d.h, 2, 15]], correct:T(surfRefH(b, d.h), 'sq'), stem:[d.r, d.h],
               designed:[['only one base', T(A + L, 'sq'), true], ['only the side', T(L, 'sq')], ['perimeter of the base without the × 2', T(A + A + addTimes(addTimes(PI_H_REF, d.r), d.h), 'sq')]] };
    }
    case 'interCircle': {
      const b = { shape:'circ', r:d.r }, area = areaRefH(b), circ = perimRefH(b);
      if (d.wantArea) return { params:[['r', d.r, 3, 10]], correct:T(area, 'sq'), stem:[d.r],
                               designed:[['gave the circumference', T(circ, 'cm'), true], ['used the radius only once', T(addTimes(PI_H_REF, d.r), 'sq')], ['used the diameter as the radius', T(areaRefH({ shape:'circ', r:2 * d.r }) || addTimes(addTimes(PI_H_REF, 2 * d.r), 2 * d.r), 'sq')]] };
      return { params:[['r', d.r, 3, 10]], correct:T(circ, 'cm'), stem:[d.r],
               designed:[['gave the area', T(area, 'sq'), true], ['forgot the × 2', T(addTimes(PI_H_REF, d.r), 'cm')], ['doubled it', T(circ + circ, 'cm')]] };
    }
    case 'interCuboid': {
      const v = addTimes(addTimes(addTimes(100, d.a), d.b), d.h);
      return { params:[['a', d.a, 2, 12], ['b', d.b, 2, 10], ['h', d.h, 2, 15]], correct:T(v, 'cu'), stem:[d.a, d.b, d.h],
               designed:[['only one layer', T(d.a * d.b * 100, 'cu')], ['added the three numbers', T((d.a + d.b + d.h) * 100, 'cu')], ['doubled it', T(2 * v, 'cu'), true]] };
    }
  }
  return null;
}
function tokRef(t){ return t.h + '|' + t.u; }
/* 產生器內部的編碼 `百分之一|單位`：值與單位都要合法、**值**兩兩不同（60 立方公分 和 60 平方公分 印出來是同一個數） */
function tokProblems(id, opts){
  const seen = new Set();
  for (const o of opts){
    const m = /^(\d+)\|(cm|sq|cu)$/.exec(String(o));
    if (!m) return id + ': option token "' + o + '" is not <hundredths>|<cm|sq|cu>';
    const h = Number(m[1]);
    if (!(h >= 1)) return id + ': option token "' + o + '" is not a positive amount';
    if (!Number.isSafeInteger(h) || h > DISTRACTOR_MAX) return id + ': option token "' + o + '" is above ' + DISTRACTOR_MAX + ' hundredths, more than any designed mistake on this lesson’s lengths can make';
    if (seen.has(h)) return id + ': two options print the same number: ' + opts.join(', ');
    seen.add(h);
  }
  return null;
}
function fourDistinct(id, d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': options are not four';
  if (!(Number.isInteger(d.ans) && d.ans >= 0 && d.ans < 4)) return id + ': ans index out of range';
  if (new Set(d.opts.map(String)).size !== 4) return id + ': options repeat: ' + d.opts;
  return null;
}
/* 一支數值產生器的不變條件：參數在課程的範圍、正解是重算的那一個、設計好的迷思都在、誘答不抄題幹。
   ⚠️ 正解本身的上限從課程自己的規則推：長度 ≤ 20、半徑 ≤ 10，所以體積 ≤ 20 × 20 × 20 ＝ 8000、
      表面積 ≤ 2 × 400 ＋ 80 × 20 ＝ 2400、高 ≤ 20。 */
const CORRECT_MAX = { cu:800000, sq:240000, cm:2000 };
/* 誘答的上限：最大的一個設計好的迷思是「把直徑當半徑」的最大圓柱 —— 半徑 10、高 20，體積 4 倍：4 × 314 × 100 × 20 ＝ 2512000。 */
const DISTRACTOR_MAX = 4 * PI_H_REF * R_MAX_REF * R_MAX_REF * LEN_MAX_REF;
/* 整圓交錯題另外算：半徑 ≤ 10，所以圓周長 ≤ 62.8、面積 ≤ 314。 */
function correctMax(genId, u){ return genId === 'interCircle' ? { cm:addTimes(PI_H_REF, 2 * R_MAX_REF), sq:addTimes(PI_H_REF, R_MAX_REF * R_MAX_REF) }[u] : CORRECT_MAX[u]; }
function numericInvariant(genId, d){
  const f = fourDistinct(genId, d); if (f) return f;
  const t = tokProblems(genId, d.opts); if (t) return t;
  const M = genModel(genId, d);
  if (!M) return genId + ': no model';
  if (M.bad) return genId + ': ' + M.bad;
  for (const p of M.params) if (!isIntIn(p[1], p[2], p[3])) return genId + ': ' + p[0] + '=' + p[1] + ' is outside ' + p[2] + '..' + p[3];
  if (M.extra) return genId + ': ' + M.extra;
  if (!(M.correct.h >= 1 && M.correct.h <= correctMax(genId, M.correct.u))) return genId + ': the answer ' + tokRef(M.correct) + ' leaves what this lesson’s lengths can make';
  if (String(d.opts[d.ans]) !== tokRef(M.correct)) return genId + ': opts[ans]=' + d.opts[d.ans] + ' is not ' + tokRef(M.correct);
  const stemH = M.stem.concat(M.echoToo || []).map(v => v * 100);
  for (const dz of M.designed){
    const name = dz[0], tk = dz[1];
    if (tk.h === M.correct.h) return genId + ': the "' + name + '" mistake gives the correct answer ' + hTextRef(tk.h) + ', so the misconception cannot be told apart (params ' + JSON.stringify(M.params.map(p => p[0] + '=' + p[1])) + ')';
    if (d.opts.indexOf(tokRef(tk)) >= 0) continue;
    if (stemH.indexOf(tk.h) >= 0 && !dz[2]) continue;           /* 刻意不抄題幹 */
    /* 兩個設計好的迷思剛好算出同一個數（整圓半徑 4：面積 16 × 3.14 ＝ 圓周長 × 2）：那個數已經在選項裡，孩子照樣會被抓到 */
    if (M.designed.some(o => o !== dz && o[1].h === tk.h && d.opts.indexOf(tokRef(o[1])) >= 0)) continue;
    return genId + ': the "' + name + '" distractor (' + tokRef(tk) + ') is missing' + (dz[2] ? ' — it is this question’s key misconception' : '') + ' (options ' + d.opts.join(', ') + ')';
  }
  const bad = d.opts.filter((o, i) => i !== d.ans && stemH.indexOf(Number(String(o).split('|')[0])) >= 0);
  if (bad.length) return genId + ': distractor "' + bad[0] + '" copies a number the stem prints';
  return null;
}

/* 解釋裡一定要出現的那一句（每一支的關鍵字，逐語言）：解釋講的必須是這一題的做法。 */
const WHY_MUST = {
  triPrismVol:  { zh:['÷ 2', '立方公分'], en:['÷ 2', 'cubic centimetres'] },
  quadPrismVol: { zh:['立方公分'], en:['cubic centimetres'] },
  cylVolR:      { zh:['× 3.14', '側面積', '立方公分'], en:['× 3.14', 'side area', 'cubic centimetres'] },
  cylVolD:      { zh:['÷ 2', '4 倍', '立方公分'], en:['÷ 2', '4 times', 'cubic centimetres'] },
  heightFromVol:{ zh:['體積 ÷ 底面積', '驗算'], en:['volume ÷ base area', 'Check'] },
  cuboidSurf:   { zh:['兩個底面', '平方公分'], en:['Two bases', 'square centimetres'] },
  cylLateral:   { zh:['底面周長', '不算', '平方公分'], en:['perimeter of the base', 'do not count', 'square centimetres'] },
  cylSurf:      { zh:['兩個底面', '平方公分'], en:['Two bases', 'square centimetres'] },
  whichQuantity:{ zh:['立方公分', '平方公分'], en:['cubic centimetres', 'square centimetres'] },
  trueStatement:{ zh:[], en:[] },
  interCircle:  { zh:['3.14'], en:['3.14'] },
  interCuboid:  { zh:['立方公分', '底面積'], en:['cubic centimetres', 'base area'] }
};
const NUMERIC_GENS = GEN_IDS.filter(g => g !== 'whichQuantity' && g !== 'trueStatement');

const SIM = {
  INVARIANTS: (function(){
    const inv = {};
    NUMERIC_GENS.forEach(g => { inv[g] = d => numericInvariant(g, d); });
    inv.whichQuantity = d => {
      const f = fourDistinct('whichQuantity', d); if (f) return f;
      if (!ASKS_REF.vol[d.v]) return 'whichQuantity: "' + d.v + '" is not a volume question';
      const vols = d.opts.filter(k => String(k).slice(0, 4) === 'vol:');
      if (vols.length !== 1) return 'whichQuantity: ' + vols.length + ' volume questions offered, the stem promises exactly one';
      if (String(d.opts[d.ans]) !== 'vol:' + d.v) return 'whichQuantity: opts[ans] is ' + d.opts[d.ans];
      for (const k of d.opts){ const p = String(k).split(':'); if (!ASKS_REF[p[0]] || !ASKS_REF[p[0]][p[1]]) return 'whichQuantity: option key "' + k + '" is unknown to the reference pool'; }
      return null;
    };
    inv.trueStatement = d => {
      const f = fourDistinct('trueStatement', d); if (f) return f;
      if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
      const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
      if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
      if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
      if (String(d.opts[d.ans]) !== String(d.t)) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      return null;
    };
    return inv;
  })(),

  /* 正解字串由這裡獨立算一次，只用 make() 留下的原始參數。 */
  expectedCorrect: function(d, genId, lang){
    if (genId === 'whichQuantity') return ASKS_REF.vol[d.v] ? ASKS_REF.vol[d.v][lang] : null;
    if (genId === 'trueStatement') return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
    const M = genModel(genId, d);
    if (!M || M.bad) return null;
    return withUnitRef(lang, M.correct.u, hTextRef(M.correct.h));
  },

  /* 這一課的選項：一個數 ＋ 公分／平方公分／立方公分，或一句釘住的句子。 */
  optionOk: function(s, genId, lang, isCorrect){
    const t = String(s).trim();
    if (!t) return 'empty option';
    if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
    if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
    if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
    if (genId === 'trueStatement') return statementTruthOfText(t, lang) !== null ? null : 'trueStatement option is not one of the pinned sentences: ' + t;
    if (genId === 'whichQuantity') return askKindOfText(t, lang) !== null ? null : 'whichQuantity option is not one of the pinned question sentences: ' + t;
    const p = parseOptRef(t, lang);
    if (!p) return genId + ' option is not "<number> <unit>" in this lesson’s writing: ' + t;
    if (!(p.h >= 1)) return genId + ' option ' + t + ' is not a positive amount';
    if (!Number.isSafeInteger(p.h) || p.h > DISTRACTOR_MAX) return genId + ' option ' + t + ' is larger than any designed mistake on this lesson’s lengths can make';
    if (lang === 'en' && (p.num === '1') !== !/s$/.test(t)) return genId + ' option has a singular/plural slip: ' + t;
    const wantUnit = { triPrismVol:'cu', quadPrismVol:'cu', cylVolR:'cu', cylVolD:'cu', interCuboid:'cu', heightFromVol:'cm',
                       cuboidSurf:'sq', cylLateral:'sq', cylSurf:'sq', interCircle:null }[genId];
    if (wantUnit === undefined) return 'unknown generator ' + genId;
    if (isCorrect && wantUnit !== null && p.u !== wantUnit) return genId + ' marked option carries the unit "' + p.u + '", expected "' + wantUnit + '"';
    /* 誘答的單位：體積題全部是立方公分、面積題全部是平方公分、求高全部是公分；只有整圓交錯題刻意混用公分與平方公分。 */
    if (wantUnit !== null && p.u !== wantUnit) return genId + ' option ' + t + ' is in "' + p.u + '", every option of this question is in "' + wantUnit + '"';
    if (genId === 'interCircle' && p.u === 'cu') return 'interCircle option is a volume: ' + t;
    if (isCorrect && !(p.h <= correctMax(genId, p.u))) return genId + ' marked option ' + t + ' leaves what this lesson’s lengths can make';
    return null;
  },

  /* 拿渲染出來的那一題再驗一次：整句題幹、值去重、誘答不抄題幹（比值）、算式、字串、解釋的關鍵句。 */
  renderCheck: function(d, q, lang, genId){
    const out = [];
    if (!q.stem || !q.stem.trim()) out.push('empty stem');
    if (!q.why || !q.why.trim()) out.push('empty explanation');
    if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
    const want = stemRef(genId, d, lang);
    if (want === null || want === undefined) out.push('no stem reference for ' + genId);
    else if (q.stem !== want) out.push('the rendered stem is not the rebuilt sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
    const keys = q.opts.map(o => optKeyRef(o, lang));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
    const nums = q.opts.map(o => { const p = parseOptRef(o, lang); return p ? p.h : null; });
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (nums[i] !== null && nums[i] === nums[j]) out.push('two options print the same number with different units: ' + q.opts[i] + ' / ' + q.opts[j]);
    /* ⚠️ simgen 內建的「抄題幹」比的是整串字，這一課的選項一律帶單位，永遠比不到 —— 真正的比對在這裡（比值）。 */
    if (NUMERIC_GENS.indexOf(genId) >= 0){
      const stemNums = numTokens(q.stem);
      q.opts.forEach((o, oi) => {
        if (oi === q.ans) return;
        const p = parseOptRef(o, lang);
        if (p && stemNums.indexOf(p.h) >= 0) out.push('the distractor "' + o + '" copies a number the stem prints');
      });
    }
    const ar = decArith(q.stem + ' ' + q.why);
    ar.problems.forEach(m => out.push(m));
    /* ⚠️ 只數解釋本身：題幹裡的算式不可以替解釋過關 */
    if (genId !== 'whichQuantity' && decArith(String(q.why || '')).verified < 1) out.push('the explanation should contain an equation to verify, but none was read');
    stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
    stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
    q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
    (WHY_MUST[genId] ? WHY_MUST[genId][lang] : []).forEach(k => { if (q.why.indexOf(k) < 0) out.push('the explanation never says "' + k + '"'); });
    /* 解釋裡印出來的正解數字要是正解（不是別的數） */
    const M = NUMERIC_GENS.indexOf(genId) >= 0 ? genModel(genId, d) : null;
    if (M && !M.bad && numTokens(q.why).indexOf(M.correct.h) < 0) out.push('the explanation never prints the answer ' + hTextRef(M.correct.h));
    FALSE_KEYS_REF.forEach(k => { if (genId !== 'trueStatement' && q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0) out.push('the explanation states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"'); });
    const wantText = SIM.expectedCorrect(d, genId, lang);
    if (wantText !== null && q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
    if (genId === 'trueStatement'){
      let trues = 0;
      q.opts.forEach(o => { const tv = statementTruthOfText(o, lang); if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts'); else if (tv) trues++; });
      if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
    }
    if (genId === 'whichQuantity'){
      let vols = 0;
      q.opts.forEach(o => { const k = askKindOfText(o, lang); if (k === null) out.push('option "' + o + '" is not one of the pinned question sentences'); else if (k === 'vol') vols++; });
      if (vols !== 1) out.push('the rendered options contain ' + vols + ' volume questions');
    }
    return out.length ? out.join('; ') : null;
  },

  /* 選項一律帶單位，simgen 內建的比對永遠比不到；真正的比對在 renderCheck（比值，而且沒有任何放行）。 */
  stemEchoOk: (function(){ const a = {}; GEN_IDS.forEach(g => { a[g] = false; }); return a; })()
};

/* 範例 5 的題幹與遊戲的題目：每一種語言整句重建（codex 抓到：只驗動作詞與數字的話，題幹可以把圓柱說成長方體）。 */
function s5StemRef(sc, lang){
  const b = sc.base, zh = lang === 'zh', c = cmRef;
  if (zh) return {
    tank:'一個圓柱形的水桶，底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + sc.h + ' 公分</b>。要把它<b>裝滿水</b>（不算桶子的厚度），需要多少水？',
    label:'一個圓柱形的罐頭，底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + sc.h + ' 公分</b>。只在<b>旁邊貼一圈標籤</b>（上下兩面不貼），標籤要多大一張？',
    wrap:'一個長方體禮物盒，長 <b>' + b.a + ' 公分</b>、寬 <b>' + b.b + ' 公分</b>、高 <b>' + sc.h + ' 公分</b>。要用包裝紙把它<b>整個包起來</b>（不算重疊），至少要多大一張？',
    sand:'一個三角柱形的模子，底面三角形的底 <b>' + b.w + ' 公分</b>、高 <b>' + b.t + ' 公分</b>，柱體的高 <b>' + sc.h + ' 公分</b>。要把它<b>裝滿沙</b>（不算模子的厚度），需要多少沙？'
  }[sc.id];
  return {
    tank:'A bucket is a cylinder with a base radius of <b>' + c(b.r) + '</b> and a height of <b>' + c(sc.h) + '</b>. How much water <b>fills it up</b> (ignoring the thickness of the bucket)?',
    label:'A can is a cylinder with a base radius of <b>' + c(b.r) + '</b> and a height of <b>' + c(sc.h) + '</b>. A label goes <b>right round its side only</b> (not on the top or bottom). How big is the label?',
    wrap:'A gift box is a cuboid <b>' + c(b.a) + '</b> long, <b>' + c(b.b) + '</b> wide and <b>' + c(sc.h) + '</b> high. It is <b>wrapped all over</b> in paper (ignore any overlap). How big a sheet does it need at least?',
    sand:'A mould is a triangular prism: the base triangle has a base of <b>' + c(b.w) + '</b> and a height of <b>' + c(b.t) + '</b>, and the prism is <b>' + c(sc.h) + '</b> high. How much sand <b>fills it up</b> (ignoring the thickness of the mould)?'
  }[sc.id];
}
function promptRef(rd, lang){
  const b = rd.base, c = cmRef;
  if (lang === 'zh') return {
    triVol:'第 ① 題：底面三角形的底 <b>' + b.w + ' 公分</b>、高 <b>' + b.t + ' 公分</b>，柱體的高 <b>' + rd.h + ' 公分</b>。三角柱的<b>體積</b>是多少？',
    cylVolD:'第 ② 題：圓柱的底面<b>直徑 ' + (2 * b.r) + ' 公分</b>、高 <b>' + rd.h + ' 公分</b>。它的<b>體積</b>是多少？',
    height:'第 ③ 題：底面是長 <b>' + b.a + ' 公分</b>、寬 <b>' + b.b + ' 公分</b>的長方形，<b>體積是 ' + hTextRef(volRefH(b, rd.h)) + ' 立方公分</b>。柱體的<b>高</b>是多少？',
    cylSurf:'第 ④ 題：圓柱的底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + rd.h + ' 公分</b>。它的<b>表面積</b>是多少？',
    which:'第 ⑤ 題：一個圓柱形的罐頭，底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + rd.h + ' 公分</b>。只在<b>旁邊貼一圈標籤</b>，標籤要多大一張？'
  }[rd.kind];
  return {
    triVol:'Question ①: the base triangle has a base of <b>' + c(b.w) + '</b> and a height of <b>' + c(b.t) + '</b>, and the prism is <b>' + c(rd.h) + '</b> high. What is the triangular prism’s <b>volume</b>?',
    cylVolD:'Question ②: a cylinder has a base <b>diameter of ' + c(2 * b.r) + '</b> and a height of <b>' + c(rd.h) + '</b>. What is its <b>volume</b>?',
    height:'Question ③: the base is a rectangle <b>' + c(b.a) + '</b> long and <b>' + c(b.b) + '</b> wide, and the <b>volume is ' + plEnRef(hTextRef(volRefH(b, rd.h)), 'cubic centimetre') + '</b>. What is the prism’s <b>height</b>?',
    cylSurf:'Question ④: a cylinder has a base radius of <b>' + c(b.r) + '</b> and a height of <b>' + c(rd.h) + '</b>. What is its <b>surface area</b>?',
    which:'Question ⑤: a can is a cylinder with a base radius of <b>' + c(b.r) + '</b> and a height of <b>' + c(rd.h) + '</b>. A label goes <b>right round its side only</b>. How big is the label?'
  }[rd.kind];
}

function bnameRef(b, lang){
  if (lang === 'zh') return { rect:'四角柱：底面是長方形（長 ' + b.a + '、寬 ' + b.b + '），柱體高 ' + b.h, tri:'三角柱：底面三角形的底 ' + b.w + '、高 ' + b.t + '，柱體高 ' + b.h,
    para:'四角柱：底面是平行四邊形（底 ' + b.w + '、高 ' + b.t + '），柱體高 ' + b.h, trap:'四角柱：底面是梯形（上底 ' + b.u + '、下底 ' + b.w + '、高 ' + b.t + '），柱體高 ' + b.h, circ:'圓柱：底面半徑 ' + b.r + '，柱體高 ' + b.h }[b.shape];
  return { rect:'four-sided prism: rectangle base (' + b.a + ' by ' + b.b + '), prism height ' + b.h, tri:'triangular prism: base triangle with base ' + b.w + ' and height ' + b.t + ', prism height ' + b.h,
    para:'four-sided prism: parallelogram base (base ' + b.w + ', height ' + b.t + '), prism height ' + b.h, trap:'four-sided prism: trapezium base (parallel sides ' + b.u + ' and ' + b.w + ', height ' + b.t + '), prism height ' + b.h, circ:'cylinder: base radius ' + b.r + ', height ' + b.h }[b.shape];
}
function snameRef(b, lang){
  if (lang === 'zh') return { rect:'長方體：長 ' + b.a + '、寬 ' + b.b + '、高 ' + b.h, rtri:'三角柱：底面是直角三角形（兩條直角邊 ' + b.w + '、' + b.t + '，斜邊 ' + b.c + '），柱體高 ' + b.h, circ:'圓柱：半徑 ' + b.r + '、高 ' + b.h }[b.shape];
  return { rect:'cuboid: ' + b.a + ' long, ' + b.b + ' wide, ' + b.h + ' high', rtri:'triangular prism: right-angled triangle base (sides at the right angle ' + b.w + ' and ' + b.t + ', long side ' + b.c + '), prism height ' + b.h, circ:'cylinder: radius ' + b.r + ', height ' + b.h }[b.shape];
}

/* ---------- 10) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    {"zh":"一個柱體的<strong>底面積</strong>是 <strong>12 平方公分</strong>、<strong>高</strong>是 <strong>5 公分</strong>，它的體積是多少？","en":"A prism has a <strong>base area</strong> of <strong>12 square centimetres</strong> and a <strong>height</strong> of <strong>5 centimetres</strong>. What is its volume?","optsZh":["17 立方公分","60 立方公分","24 立方公分","120 立方公分"],"optsEn":["17 cubic centimetres","60 cubic centimetres","24 cubic centimetres","120 cubic centimetres"],"ansZh":"60 立方公分","ansEn":"60 cubic centimetres","whyZh":"柱體的體積 ＝ 底面積 × 高，所以是 12 × 5 ＝ 60，單位是立方公分。17 是把底面積和高加起來；24 是把底面積乘以 2；120 是多乘了一次 2。","whyEn":"Volume of a prism ＝ base area × height, so it is 12 × 5 ＝ 60, in cubic centimetres. 17 adds the base area and the height; 24 doubles the base area; 120 multiplies by 2 once too often."},
    {"zh":"一個三角柱，底面三角形的<strong>底是 6 公分</strong>、<strong>高是 4 公分</strong>，柱體的<strong>高是 10 公分</strong>。它的體積是多少？","en":"A triangular prism has a base triangle with a <strong>base of 6 centimetres</strong> and a <strong>height of 4 centimetres</strong>; the prism is <strong>10 centimetres high</strong>. What is its volume?","optsZh":["240 立方公分","120 立方公分","12 立方公分","60 立方公分"],"optsEn":["240 cubic centimetres","120 cubic centimetres","12 cubic centimetres","60 cubic centimetres"],"ansZh":"120 立方公分","ansEn":"120 cubic centimetres","whyZh":"先算底面積：6 × 4 ÷ 2 ＝ 12（平方公分）。再乘柱體的高：12 × 10 ＝ 120，單位是立方公分。240 是忘了除以 2；12 只有底面積，還沒乘柱體的高；60 是 6 × 10，把三角形的高漏掉了。","whyEn":"First the base area: 6 × 4 ÷ 2 ＝ 12 square centimetres. Then times the prism’s height: 12 × 10 ＝ 120, in cubic centimetres. 240 forgets to divide by 2; 12 is only the base area, not yet multiplied by the prism’s height; 60 is 6 × 10, which leaves out the triangle’s height."},
    {"zh":"一個圓柱的底面<strong>半徑是 3 公分</strong>、<strong>高是 10 公分</strong>，它的體積是多少？","en":"A cylinder has a base <strong>radius of 3 centimetres</strong> and a <strong>height of 10 centimetres</strong>. What is its volume?","optsZh":["282.6 立方公分","188.4 立方公分","94.2 立方公分","28.26 立方公分"],"optsEn":["282.6 cubic centimetres","188.4 cubic centimetres","94.2 cubic centimetres","28.26 cubic centimetres"],"ansZh":"282.6 立方公分","ansEn":"282.6 cubic centimetres","whyZh":"底面積是 3 × 3 × 3.14 ＝ 28.26（平方公分），再乘高：28.26 × 10 ＝ 282.6，單位是立方公分。188.4 是底面周長 18.84 × 10，那是側面積；94.2 是 3 × 3.14 × 10，半徑只乘了一次；28.26 只有底面積。","whyEn":"The base area is 3 × 3 × 3.14 ＝ 28.26 square centimetres; times the height: 28.26 × 10 ＝ 282.6, in cubic centimetres. 188.4 is the perimeter of the base 18.84 × 10, which is the side area; 94.2 is 3 × 3.14 × 10, using the radius only once; 28.26 is only the base area."},
    {"zh":"一個長方體的底面是<strong>長 5 公分、寬 3 公分</strong>的長方形，<strong>高是 4 公分</strong>。它的<strong>側面積</strong>（四個側面加起來）是多少？","en":"A cuboid has a base that is a rectangle <strong>5 centimetres long and 3 centimetres wide</strong>, and it is <strong>4 centimetres high</strong>. What is its <strong>side area</strong> (the four side faces together)?","optsZh":["94 平方公分","15 平方公分","64 平方公分","16 平方公分"],"optsEn":["94 square centimetres","15 square centimetres","64 square centimetres","16 square centimetres"],"ansZh":"64 平方公分","ansEn":"64 square centimetres","whyZh":"側面攤開是一個長方形，長是底面周長 (5 ＋ 3) × 2 ＝ 16，寬是高 4，所以側面積是 16 × 4 ＝ 64，單位是平方公分。94 是表面積（還加了兩個底面）；15 是一個底面的面積；16 只是底面周長，還沒乘高。","whyEn":"The sides unroll into a rectangle whose length is the perimeter of the base (5 ＋ 3) × 2 ＝ 16 and whose width is the height 4, so the side area is 16 × 4 ＝ 64, in square centimetres. 94 is the surface area (the two bases added as well); 15 is the area of one base; 16 is only the perimeter of the base, not yet times the height."},
    {"zh":"一個柱體的<strong>體積</strong>是 <strong>180 立方公分</strong>、<strong>底面積</strong>是 <strong>20 平方公分</strong>，它的<strong>高</strong>是多少？","en":"A prism has a <strong>volume</strong> of <strong>180 cubic centimetres</strong> and a <strong>base area</strong> of <strong>20 square centimetres</strong>. What is its <strong>height</strong>?","optsZh":["160 公分","9 公分","90 公分","200 公分"],"optsEn":["160 centimetres","9 centimetres","90 centimetres","200 centimetres"],"ansZh":"9 公分","ansEn":"9 centimetres","whyZh":"體積 ＝ 底面積 × 高，倒過來就是 高 ＝ 體積 ÷ 底面積：180 ÷ 20 ＝ 9，所以高是 9 公分。驗算：20 × 9 ＝ 180。160 是 180 － 20，200 是 180 ＋ 20，都不是乘法倒回去；90 是 180 ÷ 2。","whyEn":"Volume ＝ base area × height, so turned round, height ＝ volume ÷ base area: 180 ÷ 20 ＝ 9, so the height is 9 centimetres. Check: 20 × 9 ＝ 180. 160 is 180 － 20 and 200 is 180 ＋ 20 — neither undoes a multiplication; 90 is 180 ÷ 2."},
    {"zh":"一個圓柱形的水杯，底面<strong>直徑是 10 公分</strong>、<strong>高是 8 公分</strong>。<strong>裝滿水</strong>的時候（不算杯子的厚度），水有多少立方公分？","en":"A glass is a cylinder with a base <strong>diameter of 10 centimetres</strong> and a <strong>height of 8 centimetres</strong>. How many cubic centimetres of water <strong>fill it up</strong> (ignoring the thickness of the glass)?","optsZh":["2512 立方公分","251.2 立方公分","78.5 立方公分","628 立方公分"],"optsEn":["2512 cubic centimetres","251.2 cubic centimetres","78.5 cubic centimetres","628 cubic centimetres"],"ansZh":"628 立方公分","ansEn":"628 cubic centimetres","whyZh":"直徑 10 公分，半徑是 10 ÷ 2 ＝ 5（公分）。底面積是 5 × 5 × 3.14 ＝ 78.5，再乘高：78.5 × 8 ＝ 628，單位是立方公分。2512 是把直徑 10 當成半徑，剛好是 4 倍；251.2 是底面周長 31.4 × 8，那是側面積；78.5 只有底面積。","whyEn":"The diameter is 10 centimetres, so the radius is 10 ÷ 2 ＝ 5 centimetres. The base area is 5 × 5 × 3.14 ＝ 78.5; times the height: 78.5 × 8 ＝ 628, in cubic centimetres. 2512 uses the diameter 10 as the radius, exactly 4 times too big; 251.2 is the perimeter of the base 31.4 × 8, which is the side area; 78.5 is only the base area."}
  ],
  qsAdv:[
    {"zh":"一個四角柱的底面是梯形，<strong>上底 4 公分、下底 6 公分、高 5 公分</strong>；柱體的<strong>高是 12 公分</strong>。它的體積是多少？","en":"A four-sided prism has a trapezium base: <strong>top 4 centimetres, bottom 6 centimetres, height 5 centimetres</strong>; the prism is <strong>12 centimetres high</strong>. What is its volume?","optsZh":["600 立方公分","300 立方公分","25 立方公分","360 立方公分"],"optsEn":["600 cubic centimetres","300 cubic centimetres","25 cubic centimetres","360 cubic centimetres"],"ansZh":"300 立方公分","ansEn":"300 cubic centimetres","whyZh":"底面積：(4 ＋ 6) × 5 ÷ 2 ＝ 25（平方公分）。體積：25 × 12 ＝ 300，單位是立方公分。600 是梯形面積忘了除以 2；25 只有底面積；360 是 6 × 5 × 12，只用了下底。","whyEn":"Base area: (4 ＋ 6) × 5 ÷ 2 ＝ 25 square centimetres. Volume: 25 × 12 ＝ 300, in cubic centimetres. 600 forgets to halve the trapezium; 25 is only the base area; 360 is 6 × 5 × 12, using only the bottom side."},
    {"zh":"一個圓柱的底面<strong>半徑是 3 公分</strong>、<strong>高是 5 公分</strong>，它的<strong>表面積</strong>是多少？","en":"A cylinder has a base <strong>radius of 3 centimetres</strong> and a <strong>height of 5 centimetres</strong>. What is its <strong>surface area</strong>?","optsZh":["122.46 平方公分","150.72 平方公分","94.2 平方公分","103.62 平方公分"],"optsEn":["122.46 square centimetres","150.72 square centimetres","94.2 square centimetres","103.62 square centimetres"],"ansZh":"150.72 平方公分","ansEn":"150.72 square centimetres","whyZh":"兩個底面：3 × 3 × 3.14 ＝ 28.26，28.26 × 2 ＝ 56.52。側面：底面周長 3 × 2 × 3.14 ＝ 18.84，18.84 × 5 ＝ 94.2。加起來 56.52 ＋ 94.2 ＝ 150.72，單位是平方公分。122.46 只加了一個底面；94.2 只有側面；103.62 是把底面周長算成 3 × 3.14，少乘了 2。","whyEn":"The two bases: 3 × 3 × 3.14 ＝ 28.26, and 28.26 × 2 ＝ 56.52. The side: the perimeter of the base is 3 × 2 × 3.14 ＝ 18.84, and 18.84 × 5 ＝ 94.2. Together 56.52 ＋ 94.2 ＝ 150.72, in square centimetres. 122.46 adds only one base; 94.2 is only the side; 103.62 takes the perimeter of the base as 3 × 3.14, missing the × 2."},
    {"zh":"一個長方體長 5 公分、寬 4 公分、高 6 公分；一個圓柱底面半徑 3 公分、高 4 公分。哪一句話<strong>對</strong>？","en":"A cuboid is 5 centimetres long, 4 centimetres wide and 6 centimetres high; a cylinder has a base radius of 3 centimetres and a height of 4 centimetres. Which sentence is <strong>true</strong>?","optsZh":["兩個一樣大，因為都是柱體","圓柱比較大，因為圓柱是圓的","長方體比較大：長方體是 120 立方公分，圓柱是 113.04 立方公分","不能比，因為底面的形狀不一樣"],"optsEn":["They are the same size, because both are prisms","The cylinder is bigger, because it is round","The cuboid is bigger: the cuboid is 120 cubic centimetres and the cylinder 113.04 cubic centimetres","They cannot be compared, because their bases are different shapes"],"ansZh":"長方體比較大：長方體是 120 立方公分，圓柱是 113.04 立方公分","ansEn":"The cuboid is bigger: the cuboid is 120 cubic centimetres and the cylinder 113.04 cubic centimetres","whyZh":"長方體的體積是 5 × 4 × 6 ＝ 120；圓柱的底面積是 3 × 3 × 3.14 ＝ 28.26，體積是 28.26 × 4 ＝ 113.04。120 比 113.04 大，所以長方體比較大。形狀不一樣也可以比，因為體積數的都是一樣大的小正方體。","whyEn":"The cuboid’s volume is 5 × 4 × 6 ＝ 120; the cylinder’s base area is 3 × 3 × 3.14 ＝ 28.26 and its volume 28.26 × 4 ＝ 113.04. 120 is more than 113.04, so the cuboid is bigger. Different shapes can still be compared, because volume always counts the same little cubes."},
    {"zh":"小安說：「三角柱的高，就是底面三角形的高。」下面哪一句話的<strong>結論和理由都對</strong>？","en":"Ann says: “A triangular prism’s height is just the height of its base triangle.” Which sentence has <strong>both the right conclusion and the right reason</strong>?","optsZh":["對，因為三角柱只有一個高","不對：三角形的高量在底面上，柱體的高是兩個底面之間的距離，兩個通常不一樣長","對，因為兩個高都叫做「高」","不對，三角柱沒有高，只有長和寬"],"optsEn":["Yes: a triangular prism has only one height","No: the triangle’s height is measured on the base, while the prism’s height is the distance between the two bases, and the two are usually not the same length","Yes: both of them are called “height”","No: a triangular prism has no height, only a length and a width"],"ansZh":"不對：三角形的高量在底面上，柱體的高是兩個底面之間的距離，兩個通常不一樣長","ansEn":"No: the triangle’s height is measured on the base, while the prism’s height is the distance between the two bases, and the two are usually not the same length","whyZh":"三角柱有兩個不一樣的「高」：底面三角形的高量在底面上，是從頂點垂直量到底邊（垂足落在底邊外面的時候，要量到底邊的延長線）的距離，拿來算底面積；柱體的高是兩個三角形底面之間的距離，拿來乘底面積。例如底 6、高 4 的三角形，柱體高 10：底面積是 6 × 4 ÷ 2 ＝ 12，體積是 12 × 10 ＝ 120 —— 4 和 10 用在不同的步驟。","whyEn":"A triangular prism has two different “heights”: the base triangle’s height is measured on the base, straight from the top corner to the base side (or to the line it lies on, when the foot of the height falls outside that side), and is used for the base area; the prism’s height is the distance between the two triangle bases, and multiplies the base area. For a triangle with base 6 and height 4 and a prism 10 high: base area 6 × 4 ÷ 2 ＝ 12, volume 12 × 10 ＝ 120 — the 4 and the 10 are used in different steps."}
  ],
  qsBoost:[
    {"zh":"小華算「底面三角形的<strong>底 6 公分、高 4 公分</strong>、柱體<strong>高 10 公分</strong>」的三角柱體積，寫成「6 × 4 × 10 ＝ 240 立方公分」。他哪裡想錯了？","en":"Ben works out the volume of a triangular prism whose base triangle has a <strong>base of 6 centimetres and a height of 4 centimetres</strong>, with the prism <strong>10 centimetres high</strong>, as “6 × 4 × 10 ＝ 240 cubic centimetres”. What has he got wrong?","optsZh":["他沒有錯，三角柱的體積就是三個數相乘","他把三角形的面積算成 6 × 4，<strong>忘了除以 2</strong>：6 × 4 ÷ 2 ＝ 12，12 × 10 ＝ 120","應該用加的：6 ＋ 4 ＋ 10 ＝ 20","應該再乘以 2：240 × 2 ＝ 480"],"optsEn":["Nothing; a triangular prism’s volume is the three numbers multiplied","He took the triangle’s area as 6 × 4 and <strong>forgot to divide by 2</strong>: 6 × 4 ÷ 2 ＝ 12, and 12 × 10 ＝ 120","He should add: 6 ＋ 4 ＋ 10 ＝ 20","He should double it: 240 × 2 ＝ 480"],"ansZh":"他把三角形的面積算成 6 × 4，<strong>忘了除以 2</strong>：6 × 4 ÷ 2 ＝ 12，12 × 10 ＝ 120","ansEn":"He took the triangle’s area as 6 × 4 and <strong>forgot to divide by 2</strong>: 6 × 4 ÷ 2 ＝ 12, and 12 × 10 ＝ 120","whyZh":"三角形是同底同高的平行四邊形的一半，所以底面積是 6 × 4 ÷ 2 ＝ 12，不是 24。體積是 12 × 10 ＝ 120 立方公分。三個數直接相乘只適合長方體，因為長方形的面積才是長 × 寬。","whyEn":"A triangle is half of the parallelogram with the same base and height, so the base area is 6 × 4 ÷ 2 ＝ 12, not 24. The volume is 12 × 10 ＝ 120 cubic centimetres. Multiplying the three numbers straight only works for a cuboid, because only a rectangle’s area is length × width."},
    {"zh":"小美算「底面<strong>直徑 10 公分</strong>、<strong>高 4 公分</strong>」的圓柱體積，寫成「10 × 10 × 3.14 × 4 ＝ 1256 立方公分」。她哪裡想錯了？","en":"Mia works out the volume of a cylinder with a base <strong>diameter of 10 centimetres</strong> and a <strong>height of 4 centimetres</strong> as “10 × 10 × 3.14 × 4 ＝ 1256 cubic centimetres”. What has she got wrong?","optsZh":["她沒有錯，圓柱的體積就是這樣算","她把<strong>直徑當成半徑</strong>了：半徑是 10 ÷ 2 ＝ 5，5 × 5 × 3.14 × 4 ＝ 314","應該用底面周長：10 × 3.14 × 4 ＝ 125.6","應該除以 2：1256 ÷ 2 ＝ 628"],"optsEn":["Nothing; that is how a cylinder’s volume is worked out","She used <strong>the diameter as the radius</strong>: the radius is 10 ÷ 2 ＝ 5, and 5 × 5 × 3.14 × 4 ＝ 314","She should use the perimeter of the base: 10 × 3.14 × 4 ＝ 125.6","She should divide by 2: 1256 ÷ 2 ＝ 628"],"ansZh":"她把<strong>直徑當成半徑</strong>了：半徑是 10 ÷ 2 ＝ 5，5 × 5 × 3.14 × 4 ＝ 314","ansEn":"She used <strong>the diameter as the radius</strong>: the radius is 10 ÷ 2 ＝ 5, and 5 × 5 × 3.14 × 4 ＝ 314","whyZh":"圓面積要用半徑：直徑 10 公分，半徑是 10 ÷ 2 ＝ 5。底面積是 5 × 5 × 3.14 ＝ 78.5，體積是 78.5 × 4 ＝ 314 立方公分。把直徑代進去，底面積變成 4 倍，所以她算出來的 1256 剛好是 314 的 4 倍 —— 除以 2 也修不回來。10 × 3.14 × 4 是側面積，不是體積。","whyEn":"A circle’s area needs the radius: the diameter is 10 centimetres, so the radius is 10 ÷ 2 ＝ 5. The base area is 5 × 5 × 3.14 ＝ 78.5 and the volume 78.5 × 4 ＝ 314 cubic centimetres. Using the diameter makes the base area 4 times too big, so her 1256 is exactly 4 times 314 — dividing by 2 does not fix it. 10 × 3.14 × 4 is the side area, not the volume."}
  ]
};
/* 題庫裡的每一個數字，用上面的第二套實作重算：正解，以及每一個誘答「是哪一種算錯」（解釋裡說的那一種）。
   順序就是選項的順序；unit 是這一題每一個選項的單位。 */
const R_ = r => ({ shape:'circ', r:r });
const BANK_FACTS = {
  qs:[
    { unit:'cu', opts:[['底面積 ＋ 高', 1200 + 500], ['底面積 × 高', addTimes(1200, 5), 'ans'], ['底面積 × 2', 2400], ['底面積 × 高 × 2', 2 * addTimes(1200, 5)]] },
    { unit:'cu', opts:[['忘了除以 2', 2 * volRefH({ shape:'tri', w:6, t:4 }, 10)], ['體積', volRefH({ shape:'tri', w:6, t:4 }, 10), 'ans'], ['只有底面積', areaRefH({ shape:'tri', w:6, t:4 })], ['底 × 柱體的高', addTimes(addTimes(100, 6), 10)]] },
    { unit:'cu', opts:[['體積', volRefH(R_(3), 10), 'ans'], ['側面積', latRefH(R_(3), 10)], ['半徑只乘一次', addTimes(addTimes(PI_H_REF, 3), 10)], ['只有底面積', areaRefH(R_(3))]] },
    { unit:'sq', opts:[['表面積', surfRefH({ shape:'rect', a:5, b:3 }, 4)], ['一個底面', areaRefH({ shape:'rect', a:5, b:3 })], ['側面積', latRefH({ shape:'rect', a:5, b:3 }, 4), 'ans'], ['底面周長', perimRefH({ shape:'rect', a:5, b:3 })]] },
    { unit:'cm', opts:[['體積 － 底面積', 18000 - 2000], ['體積 ÷ 底面積', heightFromRef(18000, 2000) * 100, 'ans'], ['體積 ÷ 2', 9000], ['體積 ＋ 底面積', 18000 + 2000]] },
    { unit:'cu', opts:[['把直徑當半徑', volRefH(R_(10), 8)], ['側面積', latRefH(R_(5), 8)], ['只有底面積', areaRefH(R_(5))], ['體積', volRefH(R_(5), 8), 'ans']] }
  ],
  qsAdv:[
    { unit:'cu', opts:[['梯形忘了除以 2', 2 * volRefH({ shape:'trap', u:4, w:6, t:5 }, 12)], ['體積', volRefH({ shape:'trap', u:4, w:6, t:5 }, 12), 'ans'], ['只有底面積', areaRefH({ shape:'trap', u:4, w:6, t:5 })], ['只用下底', addTimes(addTimes(addTimes(100, 6), 5), 12)]] },
    { unit:'sq', opts:[['只加一個底面', areaRefH(R_(3)) + latRefH(R_(3), 5)], ['表面積', surfRefH(R_(3), 5), 'ans'], ['只有側面', latRefH(R_(3), 5)], ['底面周長少乘 2', 2 * areaRefH(R_(3)) + addTimes(addTimes(PI_H_REF, 3), 5)]] },
    null, null
  ],
  qsBoost:[null, null]
};

/* plan → DOM 的接線。⚠️ 字面掃描，不是資料流分析：它只證明畫圖那一行還在讀 plan。 */
const RENDER_PINS = [
  { file:'index', text:'drawPlan(s1fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s2fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s3fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s4fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s5fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(gFig, fig,', min:1, max:1 },
  { file:'index', text:"pl = planSolid(sc.base, sc.h, 'layers');", min:1, max:1 },
  { file:'index', text:"pl = planSolid(sc.base, sc.h, 'base');", min:1, max:1 },
  { file:'index', text:"pl = planSolid(cylBase(sc), sc.h, 'base', sc.kind);", min:1, max:1 },
  { file:'index', text:'pl = planNet(sc.base, sc.h);', min:1, max:1 },
  { file:'index', text:'pl = planSolid(sc.base, sc.h, caseMark(sc));', min:1, max:1 },
  { file:'index', text:'var fig = roundFigure(round);', min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:"else if (p.k === 'path') el = svgEl('path', { d:p.d, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw });", min:1 },
  { file:'index', text:"else if (p.k === 'line') el = svgEl('line', { x1:p.x1, y1:p.y1, x2:p.x2, y2:p.y2, stroke:p.stroke, 'stroke-width':p.sw });", min:1 },
  { file:'index', text:"if (p.k === 'circle') el = svgEl('circle', { cx:p.cx, cy:p.cy, r:p.r, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw });", min:1 },
  { file:'index', text:"else if (p.k === 'rect') el = svgEl('rect', { x:p.x, y:p.y, width:p.w, height:p.h, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw });", min:1 },
  { file:'index', text:"el = svgEl('text', { x:p.x, y:p.y, 'font-size':DIM_FS, 'font-weight':'700', 'text-anchor':p.anchor, fill:C_DIM });", min:1 },
  /* ⚠️ 看不到的稜是虛線：這一行拿掉的話，每一條「看不到」都會畫成實線，幾何全對、圖卻是錯的。 */
  { file:'index', text:"if (p.dash) el.setAttribute('stroke-dasharray', p.dash);", min:1 },
  { file:'reference', text:'bbody.appendChild(rowOf([d.bname(b), d.brule(b), baseCalc(b), volCalc(b), d.volU(hText(volH(b)))], 2));', min:1, max:1 },
  { file:'reference', text:'rbody.appendChild(rowOf([String(r), String(2 * r), baseCalc(c), perimCalc(c)], 0));', min:1, max:1 },
  { file:'reference', text:"baseCalc(b) + d.sep + hText(baseAreaH(b)) + ' × 2 ＝ ' + hText(two),", min:1, max:1 },
  { file:'reference', text:"perimCalc(b) + d.sep + hText(basePerimH(b)) + ' × ' + b.h + ' ＝ ' + hText(latH(b)),", min:1, max:1 },
  { file:'reference', text:"hText(two) + ' ＋ ' + hText(latH(b)) + ' ＝ ' + hText(surfH(b)),", min:1, max:1 },
  { file:'reference', text:'d.areaU(hText(surfH(b)))', min:1, max:1 },
  { file:'index', text:'s1fig', min:4, max:4 }, { file:'index', text:'s2fig', min:4, max:4 }, { file:'index', text:'s3fig', min:4, max:4 },
  { file:'index', text:'s4fig', min:4, max:4 }, { file:'index', text:'s5fig', min:4, max:4 }, { file:'index', text:'gFig', min:4, max:4 }
];
/* review.html 的去重與上限要逐字釘住：產生器自己的過濾會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  "if (!isFinite(v) || v < 1 || v > VAL_MAX || v !== Math.floor(v)) return;",
  "      if (shown[v]) return;",
  "    shown[tokVal(correct)] = 1;",
  "(avoid || []).forEach(function(v){ shown[v] = 1; });",
  "var UNIT_WORD = { zh:{ cm:'公分', sq:'平方公分', cu:'立方公分' }, en:{ cm:'centimetre', sq:'square centimetre', cu:'cubic centimetre' } };",
  "return lang === 'zh' ? v + ' ' + UNIT_WORD.zh[u] : plEn(v, UNIT_WORD.en[u]);"
];
/* 複習頁的抽樣池：整個集合逐一比對（只驗「每一個都在範圍裡」的話，空池子也會過）。 */
function rangeRef(a, b){ const o = []; for (let i = a; i <= b; i++) o.push(i); return o; }
const POOLS_REF = {
  POOL_H: rangeRef(2, 15), POOL_TW: rangeRef(2, 12), POOL_RECT_A: rangeRef(2, 12), POOL_RECT_B: rangeRef(2, 10)
};

/* ---------- 10b) 跨頁的釘樁 ---------- */
/* ⚠️ n 寫成**當下真實的出現次數**（讀者看得到的字），比對用 !==。複習頁的字幾乎都是 fmt() 當場拼的，它由 simgen 的 renderCheck 驗。 */
const SIBLING_RULES = [
  { file:'index', text:'底面積 × 高', n:15, why:'is the one rule this lesson teaches' },
  { file:'reference', text:'底面積 × 高', n:8, why:'is the one rule this lesson teaches' },
  { file:'parents', text:'底面積 × 高', n:6, why:'is the one rule this lesson teaches' },
  { file:'index', text:'底面積 × 2 ＋ 底面周長 × 高', n:2, why:'is the surface-area rule this lesson teaches' },
  { file:'reference', text:'底面積 × 2 ＋ 底面周長 × 高', n:6, why:'is the surface-area rule this lesson teaches' },
  { file:'parents', text:'底面積 × 2 ＋ 底面周長 × 高', n:2, why:'is the surface-area rule this lesson teaches' },
  { file:'index', text:'底面周長 × 高', n:9, why:'is how the side is worked out' },
  { file:'reference', text:'底面周長 × 高', n:10, why:'is how the side is worked out' },
  { file:'parents', text:'底面周長 × 高', n:2, why:'is how the side is worked out' },
  { file:'index', text:'兩個底面', n:24, why:'is the part of the surface area everybody drops' },
  { file:'reference', text:'兩個底面', n:21, why:'is the part of the surface area everybody drops' },
  { file:'parents', text:'兩個底面', n:16, why:'is the part of the surface area everybody drops' },
  { file:'index', text:'半徑 × 半徑 × 3.14', n:6, why:'is how a cylinder’s base area is worked out' },
  { file:'reference', text:'半徑 × 半徑 × 3.14', n:7, why:'is how a cylinder’s base area is worked out' },
  { file:'parents', text:'半徑 × 半徑 × 3.14', n:2, why:'is how a cylinder’s base area is worked out' },
  { file:'index', text:'先除以 2', n:4, why:'is the diameter trap' },
  { file:'reference', text:'先除以 2', n:7, why:'is the diameter trap' },
  { file:'parents', text:'先除以 2', n:2, why:'is the diameter trap' },
  { file:'index', text:'立方公分', n:43, why:'is the unit a volume takes' },
  { file:'reference', text:'立方公分', n:17, why:'is the unit a volume takes' },
  { file:'parents', text:'立方公分', n:16, why:'is the unit a volume takes' },
  { file:'index', text:'平方公分', n:23, why:'is the unit an area takes' },
  { file:'reference', text:'平方公分', n:18, why:'is the unit an area takes' },
  { file:'parents', text:'平方公分', n:16, why:'is the unit an area takes' },
  { file:'index', text:'base area × height', n:9, why:'is the English rule' },
  { file:'reference', text:'base area × height', n:5, why:'is the English rule' },
  { file:'parents', text:'base area × height', n:3, why:'is the English rule' },
  { file:'index', text:'perimeter of the base × height', n:5, why:'is the English side-area rule' },
  { file:'reference', text:'perimeter of the base × height', n:5, why:'is the English side-area rule' },
  { file:'parents', text:'perimeter of the base × height', n:1, why:'is the English side-area rule' },
  { file:'index', text:'two bases', n:16, why:'is the English name for what the surface area must count' },
  { file:'reference', text:'two bases', n:13, why:'is the English name for what the surface area must count' },
  { file:'parents', text:'two bases', n:7, why:'is the English name for what the surface area must count' },
  { file:'index', text:'radius × radius × 3.14', n:3, why:'is the English cylinder base area' },
  { file:'reference', text:'radius × radius × 3.14', n:4, why:'is the English cylinder base area' },
  { file:'parents', text:'radius × radius × 3.14', n:1, why:'is the English cylinder base area' },
  { file:'index', text:'cubic centimetres', n:38, why:'is the English unit a volume takes' },
  { file:'reference', text:'cubic centimetres', n:10, why:'is the English unit a volume takes' },
  { file:'parents', text:'cubic centimetres', n:7, why:'is the English unit a volume takes' },
  { file:'index', text:'square centimetres', n:19, why:'is the English unit an area takes' },
  { file:'reference', text:'square centimetres', n:11, why:'is the English unit an area takes' },
  { file:'parents', text:'square centimetres', n:8, why:'is the English unit an area takes' }
];
const FORBIDDEN = (function(){
  const out = [];
  ['index', 'reference', 'review', 'parents'].forEach(f => {
    out.push({ file:f, text:'²', why:'writes a power — this lesson spells out “radius × radius”' });
    out.push({ file:f, text:'³', why:'writes a power — this lesson spells out cubic centimetres' });
    out.push({ file:f, text:'22/7', nfkc:true, why:'uses a second approximation of pi — this lesson only uses 3.14' });
    out.push({ file:f, text:'π', why:'uses the pi symbol — this lesson writes 3.14' });
  });
  /* 把迷思當事實寫出來的句子（速查卡的「很容易這樣想」與複習頁的假句子本來就要寫，所以不在這兩頁） */
  ['index', 'parents'].forEach(f => {
    out.push({ file:f, text:'柱體的體積 ＝ 底面積 ＋ 高', why:'states the “add instead of multiply” misconception as a rule' });
    out.push({ file:f, text:'表面積 ＝ 底面積 ＋ 側面積', why:'states the one-base misconception as a rule' });
    out.push({ file:f, text:'三角柱的高就是底面三角形的高', why:'states the two-heights misconception as a fact' });
    out.push({ file:f, text:'體積的單位是平方公分', why:'states the unit misconception as a fact' });
  });
  return out;
})();
const PAGES3 = ['index', 'reference', 'parents'];
const HANDOFF = [
  { word:'體積積木塔', before:['五年級「'], files:PAGES3, min:1 },
  { word:'面積魔術師', before:['五年級「'], files:PAGES3, min:1 },
  { word:'展開圖工作坊', before:['五年級「'], files:PAGES3, min:1 },
  { word:'柱體錐體俱樂部', before:['五年級「'], files:PAGES3, min:1 },
  { word:'圓周率工作坊', before:['六年級「', '六年級'], files:PAGES3.concat(['review']), min:1 },
  { word:'The Volume Block Tower', before:['grade-5 lesson “'], files:PAGES3, min:1 },
  { word:'The Area Magician', before:['grade-5 lesson “'], files:PAGES3, min:1 },
  { word:'The Net Workshop', before:['grade-5 lesson “'], files:PAGES3, min:1 },
  { word:'The Prism and Pyramid Club', before:['grade-5 lesson “'], files:PAGES3, min:1 },
  { word:'The Pi Workshop', before:['grade-6 lesson “'], files:PAGES3, min:1 },
  /* 不在這一課的概念：**任何一次**出現都要在同一句話裡說「不在這一課」。詞彙放寬到概念本身（錐體／圓錐／cone／pyramid），
     課名「柱體錐體俱樂部」「The Prism and Pyramid Club」裡的那一次不算（codex 抓到：以前只認「錐體的體積」這四個字，「錐體表面積」會溜過去）。 */
  { word:'複合形體', after:['不在這一課'], files:PAGES3, min:1 },
  { word:'錐體', after:['不在這一課'], files:PAGES3, min:1, skipIn:['柱體錐體俱樂部'] },
  { word:'圓錐', after:['不在這一課'], files:PAGES3 },
  { word:'容積', after:['不在這一課'], files:PAGES3, min:1 },
  { word:'joining two or more shapes', after:['not in this lesson'], files:PAGES3, min:1, win:220 },
  { word:'cone', after:['not in this lesson'], files:PAGES3, min:1, win:220 },
  { word:'pyramid', after:['not in this lesson'], files:PAGES3, min:1, win:220 },
  { word:'capacity', after:['not in this lesson'], files:PAGES3, min:1, win:220 }
];
const KEY_PINS = [
  { page:'index', lang:'zh', key:'footer', text:'<strong>柱體的體積 ＝ 底面積 × 高</strong>' },
  { page:'index', lang:'zh', key:'footer', text:'<strong>表面積 ＝ 底面積 × 2 ＋ 底面周長 × 高</strong>' },
  { page:'index', lang:'en', key:'footer', text:'<strong>volume of a prism ＝ base area × height</strong>' },
  { page:'index', lang:'en', key:'footer', text:'<strong>surface area ＝ base area × 2 ＋ perimeter of the base × height</strong>' },
  { page:'index', lang:'zh', key:'s4note', text:'<strong>側面積 ＝ 底面周長 × 高</strong>' },
  { page:'index', lang:'en', key:'s4note', text:'<strong>Side area ＝ perimeter of the base × height</strong>' },
  { page:'index', lang:'zh', key:'s1note', text:'<strong>柱體的體積 ＝ 底面積 × 高</strong>' },
  { page:'reference', lang:'zh', key:'f1', text:'柱體的體積 ＝ 底面積 × 高<span', starts:true },
  { page:'reference', lang:'zh', key:'f3', text:'表面積 ＝ 底面積 × 2 ＋ 底面周長 × 高<span', starts:true },
  { page:'reference', lang:'en', key:'f1', text:'volume of a prism or cylinder ＝ base area × height<span', starts:true },
  { page:'reference', lang:'en', key:'f3', text:'surface area ＝ base area × 2 ＋ perimeter of the base × height<span', starts:true }
];
const MIN_EQ = { index:81, reference:144, parents:24 };
const MARKUP_PAIRS = 171;
/* 速查卡表格的案例（第二份） */
const REF_BASE_ROWS = [{ shape:'rect', a:5, b:3, h:4 }, { shape:'tri', w:6, t:4, h:10 }, { shape:'para', w:6, t:4, h:10 }, { shape:'trap', u:4, w:6, t:5, h:12 }, { shape:'circ', r:3, h:10 }];
const REF_SURF_ROWS = [{ shape:'rect', a:5, b:3, h:4 }, { shape:'rtri', w:3, t:4, c:5, h:10 }, { shape:'circ', r:3, h:5 }];

/* ---------- 11) index.html 的檢查 ---------- */
function lum(hex){ const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null; }
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => String(v) === String(b[i])); }
function sameBase(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
/* 剛好側著看的那一面兩種畫法都要當成候選 */
function solidWants(b, h, mark, showR, hideH){
  const ref = refSolid(b, h, mark, showR, hideH);
  if (ref === null) return null;
  if (!ref.signs || !ref.signs.some(v => v === 0)) return [ref];
  const z = ref.signs.map((v, i) => v === 0 ? i : -1).filter(i => i >= 0), out = [];
  for (let m = 0; m < (1 << z.length); m++){
    const vis = ref.signs.map(v => v > 0);
    z.forEach((i, bi) => { vis[i] = !!(m & (1 << bi)); });
    out.push(refSolid(b, h, mark, showR, hideH, vis));
  }
  return out;
}
function checkSolid(tag, pl, b, h, mark, showR, hideH, longLabel, withCanvas){
  const w = solidWants(b, h, mark, showR, hideH);
  const out = planProblems(tag, pl, w, longLabel, withCanvas);
  if (w) geomSolidProblems(tag, pl, b, h, mark, showR, hideH).forEach(m => out.push(m));
  return out;
}
function checkNet(tag, pl, b, h, longLabel, withCanvas){
  const r = refNet(b, h);
  const out = planProblems(tag, pl, r === null ? null : [r], longLabel, withCanvas);
  if (r) geomNetProblems(tag, pl, b, h).forEach(m => out.push(m));
  return out;
}

const DATA = {
  dataStart: '/* ---------- 語言無關的資料 ---------- */',
  dataEnd: '/* ---------- i18n ---------- */',
  dataReturn: '{PI_H, LEN_MAX, R_MAX, SHAPES, SURF_SHAPES, isPosInt, isNonNegInt, okLen, okR, okD, okH, okBase, hText, ' +
              'baseAreaH, basePerimH, volH, latH, surfH, heightFrom, ' +
              'FIG_W, FIG_H, LABEL_X, LABEL_A_Y, LABEL_B_Y, LABEL_FS, LABEL_MAX, BOX_X0, BOX_X1, BOX_Y0, BOX_Y1, SC_MIN, SC_MAX, ' +
              'DEPTH_X, DEPTH_Y, DIM_FS, STROKE, HID_DASH, LAYER_MAX, MARKS, C_LINE, C_BASE, C_SIDE, C_VOL, C_HI, C_PLAIN, C_LAYER, C_DIM, ' +
              'planSolid, planNet, S1_CASES, S2_CASES, S3_CASES, S4_CASES, S5_CASES, WANTS, caseValueH, caseMark, caseUnit, cylBase, ' +
              'ROUNDS, roundAnswer, roundAnswerIndex, roundFigure, roundUnit, plEn, UNIT_WORD, withUnit, baseCalc, perimCalc, volCalc, surfCalc}',

  check: function(data, I18N, fail, src){
    /* ---- 0. 驗算器自己先過 PROBE ---- */
    CLAIM_PROBES.forEach((pr, i) => {
      const r = decArith(pr.text);
      if ((r.problems.length > 0) !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (r.problems.length ? ': ' + r.problems[0] : ''));
    });
    DEC_SEEN.length = 0;
    const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
    const RAW = {}, TEXT = {}, DICT = {};
    ['index', 'reference', 'review', 'parents'].forEach(pg => {
      try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); }
      catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ') — its cross-page checks did not run'); }
    });
    ['index', 'reference', 'review', 'parents'].forEach(pg => {
      if (RAW[pg] === undefined) return;
      DICT[pg] = pg === 'index' ? I18N : i18nOf(RAW[pg]);
      if (!DICT[pg]) fail(pg + '.html: cannot read its I18N dictionary, so its wording went unchecked');
      const markup = visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'));
      const strings = [];
      if (DICT[pg]) ['zh', 'en'].forEach(lang => i18nStrings(DICT[pg][lang] || {}, []).forEach(t => strings.push(visibleText(t))));
      TEXT[pg] = markup + '\n' + strings.join('\n');
    });

    /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；六張畫布的 viewBox 與 CSS 高度 ---- */
    const CONSTS = { PI_H:PI_H_REF, LEN_MAX:LEN_MAX_REF, R_MAX:R_MAX_REF, FIG_W:FIG_W_REF, FIG_H:FIG_H_REF, LABEL_X:LABEL_X_REF, LABEL_A_Y:LABEL_A_Y_REF,
                     LABEL_B_Y:LABEL_B_Y_REF, LABEL_FS:LABEL_FS_REF, LABEL_MAX:LABEL_MAX_REF, BOX_X0:BOX_REF.x0, BOX_X1:BOX_REF.x1, BOX_Y0:BOX_REF.y0, BOX_Y1:BOX_REF.y1,
                     SC_MIN:SC_MIN_REF, SC_MAX:SC_MAX_REF, DEPTH_X:DEPTH_X_REF, DEPTH_Y:DEPTH_Y_REF, DIM_FS:DIM_FS_REF, STROKE:STROKE_REF, HID_DASH:HID_DASH_REF,
                     LAYER_MAX:LAYER_MAX_REF, C_LINE:C_REF.LINE, C_BASE:C_REF.BASE, C_SIDE:C_REF.SIDE, C_VOL:C_REF.VOL, C_HI:C_REF.HI, C_PLAIN:C_REF.PLAIN,
                     C_LAYER:C_REF.LAYER, C_DIM:C_REF.DIM };
    Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
    if (!sameList(data.SHAPES, SHAPES_REF)) fail('the shape list is ' + data.SHAPES + ', the reference says ' + SHAPES_REF);
    if (!sameList(data.SURF_SHAPES, SURF_SHAPES_REF)) fail('the surface-area shapes are ' + data.SURF_SHAPES + ', the reference says ' + SURF_SHAPES_REF);
    if (!sameList(data.MARKS, MARKS_REF)) fail('the mark list is ' + data.MARKS + ', the reference says ' + MARKS_REF);
    if (!sameList(data.WANTS, WANTS_REF)) fail('the wants list is ' + data.WANTS + ', the reference says ' + WANTS_REF);
    /* 畫面上說的顏色（四頁都這樣講）：底面淺橘、攤開的側面深橘、分層線藍、底面圖形的高灰、側面積那張圖的底面白 */
    /* ⚠️ 量的是**頁面的**顏色：只量參考常數的話，頁面把藍線改成橘線這一條也不會響（改壞測試抓到）。 */
    const [cb, ch, cl, cd, cp] = [data.C_BASE, data.C_HI, data.C_LAYER, data.C_DIM, data.C_PLAIN].map(c => lum(String(c)) || [0, 0, 0]);
    const orange = c => c[0] > c[1] && c[1] > c[2];
    if (!orange(cb) || !orange(ch) || !(ch[1] < cb[1])) fail('the base colour and the unrolled-side colour are not light orange and dark orange');
    if (!(cl[2] > cl[0] && cl[2] > cl[1])) fail('the layer lines are not blue');
    if (Math.max.apply(null, cd) - Math.min.apply(null, cd) > 24) fail('the base-height line is not grey');
    if (cp.some(v => v !== 255)) fail('the unlit base in the side-area picture is not white');
    /* 最長的標籤放得進畫布：用參考常數自己算（一個字最寬 1.2 個字級），不相信 LABEL_MAX 的註解 */
    if (LABEL_X_REF + Math.ceil(LABEL_MAX_REF * LABEL_FS_REF * 1.2) + 2 > FIG_W_REF) fail('a LABEL_MAX-long label does not fit the canvas width');
    if (LABEL_B_Y_REF + LABEL_FS_REF * 0.25 + 2 > FIG_H_REF) fail('the lower label would fall off the bottom of the canvas');
    if (BOX_REF.y0 < LABEL_A_Y_REF + LABEL_FS_REF * 0.25 + 4 || BOX_REF.y1 + 15 + DIM_FS_REF * 0.25 > LABEL_B_Y_REF - LABEL_FS_REF * 0.8) fail('the drawing box overlaps the two label rows');
    const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
    if (svgs.length !== 6) fail('index.html has ' + svgs.length + ' canvases, expected 6 (five examples and the game)');
    svgs.forEach(tag => {
      const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
      const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      if (cls !== 'prfig') fail('a canvas has class "' + cls + '", which this config does not know');
      else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== FIG_H_REF) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + FIG_H_REF);
    });
    const styleBlocks = (liveSrc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
    (styleBlocks.match(/[^{}]*\{[^{}]*\}/g) || []).forEach(rule => {
      const sel = rule.slice(0, rule.indexOf('{'));
      if (!/prfig|figwrap/i.test(sel)) return;
      const body = rule.slice(rule.indexOf('{'));
      if (/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\.0+)?\s*[;}]|transform\s*:[^;}]*scale\(\s*0(?:\.0+)?\s*[,)]|clip-path\s*:|(?:width|height)\s*:\s*0(?:\.0+)?\s*(?:px|%)?\s*[;}]/i.test(body))
        fail('a CSS rule hides the figure: "' + rule.replace(/\s+/g, ' ').trim().slice(0, 80) + '"');
    });
    const rules = liveSrc.match(/\.prfig\s*\{[^}]*\}/g) || [];
    if (rules.length !== 1) fail('index.html declares the .prfig rule ' + rules.length + ' time(s), expected exactly 1');
    else {
      const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
      const ws = rules[0].match(/max-width:\s*(\d+)px/g) || [];
      if (hs.length !== 1) fail('the .prfig rule declares a plain height ' + hs.length + ' time(s)');
      else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== FIG_H_REF) fail('.prfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + FIG_H_REF + ' tall — the drawing would be letterboxed');
      if (ws.length !== 1 || Number(/(\d+)px/.exec(ws[0])[1]) !== FIG_W_REF) fail('.prfig has max-width ' + ws + ', the viewBox is ' + FIG_W_REF + ' wide');
    }

    /* ---- 2. 小數的印法、長度的守門、底面積、周長、體積、側面積、表面積：整個定義域逐一對第二套實作 ---- */
    for (let h = 0; h <= 1000000; h++){
      if (data.hText(h) !== hTextRef(h)){ fail('hText(' + h + ') is "' + data.hText(h) + '", the reference says "' + hTextRef(h) + '"'); break; }
    }
    [-1, 1.5, '7', NaN, Infinity, null].forEach(v => { if (data.hText(v) !== '?') fail('hText does not fail closed on ' + String(v)); });
    for (let n = -2; n <= LEN_MAX_REF + 2; n++){
      if (data.okLen(n) !== okLenRef(n)) fail('okLen(' + n + ') is ' + data.okLen(n) + ', the reference says ' + okLenRef(n));
      if (data.okH(n) !== okLenRef(n)) fail('okH(' + n + ') is ' + data.okH(n) + ', the reference says ' + okLenRef(n));
      if (data.okR(n) !== okRRef(n)) fail('okR(' + n + ') is ' + data.okR(n) + ', the reference says ' + okRRef(n));
      if (data.okD(n) !== okDRef(n)) fail('okD(' + n + ') is ' + data.okD(n) + ', the reference says ' + okDRef(n));
    }
    [2.5, 10.5, '5', null, undefined, NaN, Infinity].forEach(v => {
      if (data.okLen(v) || data.okH(v) || data.okR(v) || data.okD(v)) fail('a length check accepts ' + String(v) + ', which is not a whole number of centimetres');
    });
    /* 底面：整個掃描範圍（含 0、21 這種出界的邊）逐一比對 okBase、底面積、周長 */
    let sweep = 0, okN = 0;
    const cmpBase = b => {
      sweep++;
      const ok = okBaseRef(b);
      if (ok) okN++;
      if (data.okBase(b) !== ok){ fail('okBase(' + baseTag(b) + ') is ' + data.okBase(b) + ', the reference says ' + ok); return; }
      const a = data.baseAreaH(b), p = data.basePerimH(b);
      if (a !== areaRefH(b)) fail('baseAreaH(' + baseTag(b) + ') is ' + a + ', repeated addition says ' + areaRefH(b));
      if (p !== perimRefH(b)) fail('basePerimH(' + baseTag(b) + ') is ' + p + ', adding the edges says ' + perimRefH(b));
    };
    for (let x = 0; x <= LEN_MAX_REF + 1; x++) for (let y = 0; y <= LEN_MAX_REF + 1; y++){
      cmpBase({ shape:'rect', a:x, b:y }); cmpBase({ shape:'tri', w:x, t:y }); cmpBase({ shape:'para', w:x, t:y });
      for (let z = 0; z <= LEN_MAX_REF + 1; z++){ cmpBase({ shape:'rtri', w:x, t:y, c:z }); cmpBase({ shape:'trap', u:x, w:y, t:z }); }
    }
    for (let r = -1; r <= R_MAX_REF + 2; r++) cmpBase({ shape:'circ', r:r });
    /* ⚠️ 不是整數的邊、字串、少一個欄位、不認得的形狀：每一種守門拿掉都會讓這裡的某一筆變成 true */
    [{ shape:'rect', a:2.5, b:4 }, { shape:'rect', a:4, b:2.5 }, { shape:'tri', w:3, t:2.5 }, { shape:'para', w:'4', t:2 },
     { shape:'rtri', w:3, t:4, c:6 }, { shape:'rtri', w:4, t:3, c:5.0001 }, { shape:'rtri', w:6, t:8 }, { shape:'trap', u:5, w:5, t:3 }, { shape:'trap', u:6, w:5, t:3 },
     { shape:'trap', u:2.5, w:5, t:3 }, { shape:'circ', r:2.5 }, { shape:'circ', r:'3' }, { shape:'circ' }, { shape:'hex', a:3 }, { a:3, b:4 }, null, 7]
      .forEach(b => {
        if (data.okBase(b) !== false) fail('okBase accepts ' + JSON.stringify(b) + ', which is not a base this lesson can draw');
        /* ⚠️ 每一個由底面算出來的量都要 fail-closed，不是只有底面積（codex 抓到：半公分的邊長會讓周長算出一個數） */
        [['baseAreaH', () => data.baseAreaH(b)], ['basePerimH', () => data.basePerimH(b)], ['volH', () => data.volH(b, 5)], ['latH', () => data.latH(b, 5)], ['surfH', () => data.surfH(b, 5)]]
          .forEach(([nm, f]) => { let v; try { v = f(); } catch (e){ v = 'threw ' + e.message; } if (v !== null) fail(nm + ' does not fail closed on ' + JSON.stringify(b) + ' (it gives ' + v + ')'); });
      });
    if (okN !== 400 + 400 + 400 + TRIPLES_REF.size + 3800 + 10) fail('the base sweep found ' + okN + ' usable bases');
    if (TRIPLES_REF.size !== 12) fail('Euclid’s formula gives ' + TRIPLES_REF.size + ' right triangles up to 20, expected 12 (3-4-5, 6-8-10, 5-12-13, 9-12-15, 8-15-17, 12-16-20 both ways)');
    /* 體積、側面積、表面積、倒過來求高：每一個合法底面 × 高 －1 ~ 22 */
    const BASES = allBasesRef();
    let volN = 0, surfN = 0;
    for (const b of BASES){
      for (let h = -1; h <= LEN_MAX_REF + 2; h++){
        const v = data.volH(b, h), l = data.latH(b, h), sf = data.surfH(b, h);
        /* 長方體的表面積走五年級的第三條路（六個面兩兩一樣），不管前面哪一條先響都要比 */
        if (b.shape === 'rect' && okLenRef(h) && sf !== surfCuboidPairsH(b.a, b.b, h)) fail('the surface area of the cuboid ' + b.a + ' × ' + b.b + ' × ' + h + ' is ' + sf + ', the grade-5 2 × (lw ＋ lh ＋ wh) gives ' + surfCuboidPairsH(b.a, b.b, h));
        if (v !== volRefH(b, h)){ fail('volH(' + baseTag(b) + ', ' + h + ') is ' + v + ', repeated addition says ' + volRefH(b, h)); continue; }
        if (l !== latRefH(b, h)) fail('latH(' + baseTag(b) + ', ' + h + ') is ' + l + ', the reference says ' + latRefH(b, h));
        if (sf !== surfRefH(b, h)) fail('surfH(' + baseTag(b) + ', ' + h + ') is ' + sf + ', the reference says ' + surfRefH(b, h));
        if (v === null) continue;
        volN++;
        const hf = data.heightFrom(v, data.baseAreaH(b));
        if (hf !== h) fail('heightFrom(' + v + ', ' + data.baseAreaH(b) + ') is ' + hf + ', the height is ' + h);
        if (heightFromRef(v, areaRefH(b)) !== h) fail('repeated subtraction does not get the height back for ' + baseTag(b) + ', h=' + h);
        /* 課程明講的幾句話，逐一證明（拿**頁面算出來的**值去比，不是參考跟自己比） */
        if (h * 2 <= LEN_MAX_REF && data.volH(b, 2 * h) !== 2 * v) fail('doubling the height of ' + baseTag(b) + ' does not double the volume — the review page’s “4 times” sentence is false only if it does');
        if (l !== null){
          surfN++;
          if (l !== latByFacesH(b, h) || latRefH(b, h) !== latByFacesH(b, h)) fail('the side area of ' + baseTag(b) + ' × ' + h + ' is not the side faces added up (for a cylinder: 2 × circle area ÷ radius × height)');
          if (sf !== 2 * data.baseAreaH(b) + l) fail('the surface area of ' + baseTag(b) + ' × ' + h + ' is not two bases plus the side');
          if (b.shape === 'rect' && (sf !== surfCuboidPairsH(b.a, b.b, h) || surfRefH(b, h) !== surfCuboidPairsH(b.a, b.b, h))) fail('the surface area of the cuboid ' + b.a + ' × ' + b.b + ' × ' + h + ' is not the grade-5 2 × (lw ＋ lh ＋ wh)');
        } else if (SURF_SHAPES_REF.indexOf(b.shape) >= 0) fail('a ' + b.shape + ' base has no side area although this lesson works it out');
        if (b.shape === 'rect' && v !== b.a * b.b * h * 100) fail('the cuboid ' + b.a + ' × ' + b.b + ' × ' + h + ' is not length × width × height');
      }
      if (b.shape === 'circ' && 2 * b.r <= R_MAX_REF && data.baseAreaH({ shape:'circ', r:2 * b.r }) !== 4 * data.baseAreaH(b)) fail('using the diameter as the radius does not make the base area 4 times as big for r=' + b.r);
      if (b.shape === 'tri' && data.baseAreaH(b) * 2 !== data.baseAreaH({ shape:'para', w:b.w, t:b.t })) fail('the triangle ' + b.w + ' × ' + b.t + ' is not half of the parallelogram with the same base and height');
      if (SURF_SHAPES_REF.indexOf(b.shape) < 0 && data.basePerimH(b) !== null) fail('basePerimH gives a ' + b.shape + ' base a perimeter although this lesson does not work it out');
    }
    if (volN !== BASES.length * LEN_MAX_REF || surfN !== (400 + TRIPLES_REF.size + 10) * LEN_MAX_REF) fail('the volume domain gave ' + volN + ' and the surface domain ' + surfN + ' cases');
    /* ⚠️ 倒過來求高的守門：每一個探針都挑「守門拿掉就會過」的那一種 */
    if (data.heightFrom(-600, -100) !== null) fail('heightFrom accepts negative amounts (−600 ÷ −100 would give a height of 6)');
    if (data.heightFrom(2100, 100) !== null) fail('heightFrom returns 21, a height longer than this lesson’s lengths');
    if (data.heightFrom(600, 0) !== null || data.heightFrom(0, 100) !== null || data.heightFrom(600.5, 100) !== null || data.heightFrom('600', 100) !== null) fail('heightFrom does not fail closed on a zero, fractional or text amount');
    if (data.volH({ shape:'rect', a:3, b:4 }, 2.5) !== null || data.volH({ shape:'rect', a:3, b:4 }, '5') !== null) fail('volH accepts a height that is not a whole number of centimetres');
    if (data.latH({ shape:'tri', w:3, t:4 }, 5) !== null || data.surfH({ shape:'para', w:3, t:4 }, 5) !== null || data.surfH({ shape:'trap', u:2, w:3, t:4 }, 5) !== null) fail('a side or surface area is worked out for a base this lesson does not do');
    if (data.plEn(1, 'centimetre') !== '1 centimetre' || data.plEn(2, 'centimetre') !== '2 centimetres' || data.plEn('0.5', 'centimetre') !== '0.5 centimetres') fail('plEn is wrong');
    [['zh', 'cu', '60', '60 立方公分'], ['zh', 'sq', '28.26', '28.26 平方公分'], ['zh', 'cm', '8', '8 公分'], ['en', 'cu', '1', '1 cubic centimetre'], ['en', 'sq', '94', '94 square centimetres'], ['en', 'cm', '9', '9 centimetres'], ['en', 'oops', '4', '?'], ['zh', null, '4', '?']]
      .forEach(r => { if (data.withUnit(r[0], r[1], r[2]) !== r[3]) fail('withUnit(' + r.slice(0, 3).join(', ') + ') is "' + data.withUnit(r[0], r[1], r[2]) + '", expected "' + r[3] + '"'); });

    /* ---- 3. 立體圖與展開圖：整個定義域；每一個圖元重算、幾何量量回來、四個邊 ---- */
    const LONG = 'x'.repeat(LABEL_MAX_REF);
    /* 定義域很大：同一種缺陷只印第一個例子和一共幾筆（不然一個缺陷會洗掉整份報告）。 */
    const agg = {};
    const dom = m => { const k = m.replace(/\([^)]*\)/g, '()').replace(/\d+(?:\.\d+)?/g, '#'); if (!agg[k]) agg[k] = { n:0, first:m }; agg[k].n++; };
    let drawn = 0, capped = 0, netDrawn = 0, netWant = 0;
    for (const b of BASES){
      const heavy = b.shape !== 'trap' || b.u === 1 || b.t % 5 === 0;     /* 梯形有 3800 種，其他標記抽一部分 */
      for (let h = 1; h <= LEN_MAX_REF; h++){
        const sr = b.shape === 'circ' ? (h % 2 ? 'r' : 'd') : null;
        const bp = checkSolid('planSolid(' + baseTag(b) + ', ' + h + ', base)', data.planSolid(b, h, 'base', sr), b, h, 'base', sr, false, LONG, true);
        bp.forEach(dom);
        const lastBad = bp.length > 0;
        if (!lastBad) drawn++;
        checkSolid('planSolid(' + baseTag(b) + ', ' + h + ', base, hideH)', data.planSolid(b, h, 'base', sr, true), b, h, 'base', sr, true, LONG, false).forEach(dom);
        const lp = data.planSolid(b, h, 'layers');
        checkSolid('planSolid(' + baseTag(b) + ', ' + h + ', layers)', lp, b, h, 'layers', null, false, LONG, heavy).forEach(dom);
        if (h > LAYER_MAX_REF && lp && lp.tooBig) capped++;
        if (heavy) ['vol', 'lat', 'surf'].forEach(mk => checkSolid('planSolid(' + baseTag(b) + ', ' + h + ', ' + mk + ')', data.planSolid(b, h, mk), b, h, mk, null, false, LONG, false).forEach(dom));
        const np = data.planNet(b, h);
        const nq = checkNet('planNet(' + baseTag(b) + ', ' + h + ')', np, b, h, LONG, SURF_SHAPES_REF.indexOf(b.shape) >= 0);
        nq.forEach(dom);
        if (refNet(b, h) !== null){ netWant++; if (!nq.length && np && !np.tooBig) netDrawn++; }
      }
    }
    Object.keys(agg).forEach(k => fail(agg[k].first + (agg[k].n > 1 ? ' [and ' + (agg[k].n - 1) + ' more of the same kind across the domain]' : '')));
    /* ⚠️ 只數**頁面真的畫出來、而且全部檢查都過**的圖（以前 drawn 是迴圈次數，永遠不會少 —— codex 抓到） */
    if (drawn !== BASES.length * LEN_MAX_REF || capped !== BASES.length * (LEN_MAX_REF - LAYER_MAX_REF) || netDrawn !== netWant || netWant < 4000)
      fail('the figure domain gave ' + drawn + ' clean solids of ' + BASES.length * LEN_MAX_REF + ', ' + capped + ' refused layer pictures of ' + BASES.length * (LEN_MAX_REF - LAYER_MAX_REF) + ' and ' + netDrawn + ' clean nets of ' + netWant + ' drawable');
    /* 壞輸入一律不畫（每一個探針都挑「守門拿掉就會畫出來」的那一種） */
    [[{ shape:'rect', a:3, b:4 }, 0, 'base'], [{ shape:'rect', a:3, b:4 }, 21, 'base'], [{ shape:'rect', a:3, b:4 }, 2.5, 'base'], [{ shape:'rect', a:3, b:4 }, 5, 'nonsense'],
     [{ shape:'rect', a:21, b:4 }, 5, 'base'], [{ shape:'rtri', w:3, t:4, c:6 }, 5, 'base'], [{ shape:'rect', a:3, b:4 }, 13, 'layers'], [{ shape:'circ', r:11 }, 5, 'base']]
      .forEach(x => { const pl = data.planSolid(x[0], x[1], x[2]); if (!pl.tooBig || (pl.prims || []).length) fail('planSolid(' + baseTag(x[0]) + ', ' + x[1] + ', ' + x[2] + ') draws something it should refuse'); });
    [[{ shape:'tri', w:3, t:4 }, 5], [{ shape:'para', w:3, t:4 }, 5], [{ shape:'trap', u:2, w:4, t:3 }, 5], [{ shape:'rect', a:3, b:4 }, 21], [{ shape:'circ', r:11 }, 3], [{ shape:'rtri', w:3, t:4, c:6 }, 5]]
      .forEach(x => { const pl = data.planNet(x[0], x[1]); if (!pl.tooBig || (pl.prims || []).length) fail('planNet(' + baseTag(x[0]) + ', ' + x[1] + ') draws a net this lesson does not do'); });

    /* ---- 4. 每一個標籤：用案例資料重建、逐字比對、不超過 26 個字，連同真正的標籤一起餵 lib/canvas.js ---- */
    const wantLabel = (lang, where, x) => {
      const zh = lang === 'zh', b = x.base;
      switch (where){
        case 's1a': return zh ? '底面積 ' + hTextRef(areaRefH(b)) + ' 平方公分' : 'base area ' + hTextRef(areaRefH(b)) + ' sq cm';
        case 's1b': return zh ? '高 ' + x.h + ' 公分，疊 ' + x.h + ' 層' : 'height ' + x.h + ' cm, ' + x.h + ' layers';
        case 's2a': return b.shape === 'trap' ? (zh ? '梯形：上底 ' + b.u + '、下底 ' + b.w + '、高 ' + b.t : 'trapezium: ' + b.u + ' & ' + b.w + ', height ' + b.t)
                                              : (zh ? { tri:'三角形', para:'平行四邊形' }[b.shape] + '：底 ' + b.w + '、高 ' + b.t : { tri:'triangle', para:'parallelogram' }[b.shape] + ', base ' + b.w + ', h ' + b.t);
        case 's2b': return zh ? '柱體的高 ' + x.h + ' 公分' : 'prism height ' + x.h + ' cm';
        case 's3a': return zh ? (x.kind === 'r' ? '底面半徑 ' : '底面直徑 ') + x.v + ' 公分' : (x.kind === 'r' ? 'base radius ' : 'base diameter ') + x.v + ' cm';
        case 's3b': return zh ? '圓柱的高 ' + x.h + ' 公分' : 'cylinder height ' + x.h + ' cm';
        case 's4a': return zh ? '側面：長 ' + hTextRef(perimRefH(b)) + '、寬 ' + x.h : 'side: ' + hTextRef(perimRefH(b)) + ' by ' + x.h;
        case 's4b': return zh ? '表面積 ' + hTextRef(surfRefH(b, x.h)) + ' 平方公分' : 'surface area ' + hTextRef(surfRefH(b, x.h)) + ' sq cm';
        case 's5a': return (zh ? { tank:'圓柱水桶', label:'圓柱罐頭', wrap:'長方體禮物盒', sand:'三角柱模子' } : { tank:'cylinder bucket', label:'cylinder can', wrap:'cuboid gift box', sand:'triangular prism mould' })[x.id];
        case 's5b': return (zh ? { vol:'要算體積', surf:'要算表面積', lat:'要算側面積' } : { vol:'wants the volume', surf:'wants the surface area', lat:'wants the side area' })[x.want];
        case 'ga': return zh ? { triVol:'三角形：底 ' + b.w + '、高 ' + b.t, cylVolD:'底面直徑 ' + 2 * b.r + ' 公分', height:'底面：長 ' + b.a + '、寬 ' + b.b, cylSurf:'圓柱的展開圖', which:'圓柱罐頭，半徑 ' + b.r + ' 公分' }[x.kind]
                             : { triVol:'triangle, base ' + b.w + ', h ' + b.t, cylVolD:'base diameter ' + 2 * b.r + ' cm', height:'base: ' + b.a + ' by ' + b.b, cylSurf:'net of the cylinder', which:'cylinder can, radius ' + b.r + ' cm' }[x.kind];
        case 'gb': return zh ? { triVol:'柱體的高 ' + x.h + ' 公分', cylVolD:'圓柱的高 ' + x.h + ' 公分', height:'柱體的高是多少？', cylSurf:'半徑 ' + b.r + ' 公分、高 ' + x.h + ' 公分', which:'圓柱的高 ' + x.h + ' 公分' }[x.kind]
                             : { triVol:'prism height ' + x.h + ' cm', cylVolD:'cylinder height ' + x.h + ' cm', height:'how high is the prism?', cylSurf:'radius ' + b.r + ' cm, height ' + x.h + ' cm', which:'cylinder height ' + x.h + ' cm' }[x.kind];
      }
      return null;
    };
    const figOf = {
      s1:sc => data.planSolid(sc.base, sc.h, 'layers'), s2:sc => data.planSolid(sc.base, sc.h, 'base'), s3:sc => data.planSolid(data.cylBase(sc), sc.h, 'base', sc.kind),
      s4:sc => data.planNet(sc.base, sc.h), s5:sc => data.planSolid(sc.base, sc.h, data.caseMark(sc)), g:rd => data.roundFigure(rd)
    };
    let labelN = 0;
    ['zh', 'en'].forEach(lang => {
      const d = I18N[lang];
      [['s1', data.S1_CASES], ['s2', data.S2_CASES], ['s3', data.S3_CASES], ['s4', data.S4_CASES], ['s5', data.S5_CASES], ['g', data.ROUNDS]].forEach(row => {
        const key = row[0];
        row[1].forEach((x, i) => {
          const fa = d[key + (key === 'g' ? 'LabelA' : 'labelA')], fb = d[key + (key === 'g' ? 'LabelB' : 'labelB')];
          if (typeof fa !== 'function' || typeof fb !== 'function'){ fail(key + ' has no label functions in the ' + lang + ' dictionary'); return; }
          const la = fa(x), lb = fb(x);
          [[key === 'g' ? 'ga' : key + 'a', la], [key === 'g' ? 'gb' : key + 'b', lb]].forEach(p => {
            labelN++;
            const where = p[0], t = p[1], wantX = key === 's3' ? Object.assign({ base:data.cylBase(x) }, x) : x;
            if (typeof t !== 'string' || !t.trim()){ fail('label ' + where + '[' + i + '] (' + lang + ') is empty'); return; }
            if ([...t].length > LABEL_MAX_REF) fail('label ' + where + '[' + i + '] (' + lang + ') is ' + [...t].length + ' characters long, over the ' + LABEL_MAX_REF + ' the canvas fits: "' + t + '"');
            const want = wantLabel(lang, where, wantX);
            if (t !== want) fail('label ' + where + '[' + i + '] (' + lang + ') is "' + t + '", the reference rebuilds "' + want + '"');
            stringProblems(t, lang, 'label ' + where + '[' + i + ']').forEach(fail);
          });
          const fig = figOf[key](x);
          if (fig && !fig.tooBig) canvasProblems(svgOfPlan(fig, la, lb)).forEach(m => fail(key + ' case ' + i + ' (' + lang + ') with its own labels: ' + m));
          else fail(key + ' case ' + i + ': the figure is not drawn');
        });
      });
    });
    if (labelN !== 2 * 2 * (4 + 4 + 4 + 4 + 4 + 5)) fail('only ' + labelN + ' labels were measured');

    /* ---- 5. 範例 1～5 的案例：值、圖、旁白 ---- */
    /* 範例的期望值**不抄**：用第二套實作算出來，再和頁面每一筆案例旁邊的註解（最後一個數字）對 —— 註解寫錯也會響。 */
    const CMT = {};
    ['S1_CASES', 'S2_CASES', 'S3_CASES', 'S4_CASES', 'S5_CASES'].forEach(k => {
      const at = src.indexOf('var ' + k + ' = ['), end = src.indexOf('];', at);
      CMT[k] = at < 0 ? [] : src.slice(at, end).split('\n').filter(l => /^\s*\{/.test(l)).map(l => {
        const c = (l.match(/\/\*([^*]*)\*\//) || [])[1] || '';
        const nums = c.match(/\d+(?:\.\d+)?/g) || [];
        return nums.length ? nums[nums.length - 1] : null;
      });
    });
    const caseRows = (name, got, ref, key) => {
      if (!Array.isArray(got) || got.length !== ref.length){ fail(name + ' has ' + (got || []).length + ' cases, the reference ' + ref.length); return; }
      got.forEach((c, i) => { if (key(c) !== key(ref[i])) fail(name + ' case ' + i + ' is ' + key(c) + ', the reference says ' + key(ref[i])); });
    };
    caseRows('S1_CASES', data.S1_CASES, S1_CASES_REF.map(r => ({ base:r[0], h:r[1] })), c => baseTag(c.base) + '×' + c.h);
    caseRows('S2_CASES', data.S2_CASES, S2_CASES_REF.map(r => ({ base:r[0], h:r[1] })), c => baseTag(c.base) + '×' + c.h);
    caseRows('S3_CASES', data.S3_CASES, S3_CASES_REF.map(r => ({ kind:r[0], v:r[1], h:r[2] })), c => c.kind + c.v + '×' + c.h);
    caseRows('S4_CASES', data.S4_CASES, S4_CASES_REF.map(r => ({ base:r[0], h:r[1] })), c => baseTag(c.base) + '×' + c.h);
    caseRows('S5_CASES', data.S5_CASES, S5_CASES_REF.map(r => ({ id:r[0], want:r[1], base:r[2], h:r[3] })), c => c.id + ':' + c.want + ':' + baseTag(c.base) + '×' + c.h);
    const LANGS = ['zh', 'en'];
    const narrate = (tag, strs, minEq) => {
      let v = 0;
      strs.forEach(([lang, t, name]) => {
        if (typeof t !== 'string' || !t.trim()){ fail(tag + ' ' + name + ' (' + lang + ') is empty'); return; }
        stringProblems(t, lang, tag + ' ' + name + ' (' + lang + ')').forEach(fail);
        const ar = decArith(t);
        ar.problems.forEach(m => fail(tag + ' ' + name + ' (' + lang + '): ' + m));
        v += ar.verified;
      });
      if (v < minEq) fail(tag + ': only ' + v + ' equations could be verified in its narration, expected at least ' + minEq);
      /* 兩種語言要說**同一組數**：中英對照不是語意比對（那是已知極限），但至少英文不可以多說或少說一個數 */
      const byKey = {};
      /* 兩種語言各自的說法先拿掉：中文「除以 2」英文說 halve；英文「grade 5」中文說「五年級」 */
      const plainNums = (lang, t) => numTokens(lang === 'zh' ? String(t).replace(/除以 2/g, '') : String(t).replace(/grade[- ]\d/gi, ''));
      strs.forEach(([lang, t, name]) => { (byKey[name] = byKey[name] || {})[lang] = plainNums(lang, t).sort((x, y) => x - y).join(','); });
      Object.keys(byKey).forEach(k => { if (byKey[k].zh !== byKey[k].en) fail(tag + ' ' + k + ': the Chinese and the English print different numbers (' + byKey[k].zh + ' / ' + byKey[k].en + ')'); });
    };
    const texts = (sc, keys) => { const o = []; LANGS.forEach(lang => keys.forEach(k => o.push([lang, I18N[lang][k](sc), k]))); return o; };
    const resultRef = (lang, u, h) => lang === 'zh' ? { cu:'體積是 ', sq:'表面積是 ' }[u] + hTextRef(h) + ' ' + UNIT_WORD_REF.zh[u]
                                                    : { cu:'The volume is ', sq:'The surface area is ' }[u] + plEnRef(hTextRef(h), UNIT_WORD_REF.en[u]);
    data.S1_CASES.forEach((sc, i) => {
      const v = volRefH(sc.base, sc.h);
      if (CMT.S1_CASES[i] !== hTextRef(v)) fail('S1 case ' + i + ': the source comment says ' + CMT.S1_CASES[i] + ', the volume works out to ' + hTextRef(v));
      if (sc.h > LAYER_MAX_REF) fail('S1 case ' + i + ': ' + sc.h + ' layers is more than the layer picture draws');
      checkSolid('S1 case ' + i, figOf.s1(sc), sc.base, sc.h, 'layers', null, false, LONG, true).forEach(fail);
      LANGS.forEach(lang => { if (I18N[lang].s1result(sc) !== resultRef(lang, 'cu', v)) fail('S1 case ' + i + ' (' + lang + '): the result line is "' + I18N[lang].s1result(sc) + '"'); });
      narrate('S1 case ' + i, texts(sc, ['s1narr', 's1calc', 's1result', 's1cap', 's1chip']), 4);
    });
    if (!['rect', 'tri', 'circ'].every(k => data.S1_CASES.some(c => c.base.shape === k))) fail('S1_CASES should show a cuboid, a triangular prism and a cylinder');
    data.S2_CASES.forEach((sc, i) => {
      const v = volRefH(sc.base, sc.h);
      if (CMT.S2_CASES[i] !== hTextRef(v)) fail('S2 case ' + i + ': the source comment says ' + CMT.S2_CASES[i] + ', the volume works out to ' + hTextRef(v));
      checkSolid('S2 case ' + i, figOf.s2(sc), sc.base, sc.h, 'base', null, false, LONG, true).forEach(fail);
      LANGS.forEach(lang => { if (I18N[lang].s2result(sc) !== resultRef(lang, 'cu', v)) fail('S2 case ' + i + ' (' + lang + '): the result line is "' + I18N[lang].s2result(sc) + '"'); });
      /* 「底面積可以是小數」那一句只在底面積真的是小數的時候出現 */
      const dec = areaRefH(sc.base) % 100 !== 0;
      if ((I18N.zh.s2narr(sc).indexOf('底面積可以是小數') >= 0) !== dec || (I18N.en.s2narr(sc).indexOf('A base area can be a decimal') >= 0) !== dec) fail('S2 case ' + i + ': the “a base area can be a decimal” sentence does not follow the base area ' + hTextRef(areaRefH(sc.base)));
      narrate('S2 case ' + i, texts(sc, ['s2narr', 's2calc', 's2result', 's2cap', 's2chip']), 6);
    });
    if (!data.S2_CASES.some(c => areaRefH(c.base) % 100 !== 0)) fail('S2_CASES must include a triangle whose base area is a decimal');
    if (!['tri', 'trap', 'para'].every(k => data.S2_CASES.some(c => c.base.shape === k))) fail('S2_CASES should show a triangle, a trapezium and a parallelogram base');
    data.S3_CASES.forEach((sc, i) => {
      const b = data.cylBase(sc), rWant = sc.kind === 'd' ? sc.v / 2 : sc.v;
      if (!b || b.r !== rWant) fail('S3 case ' + i + ': cylBase gives radius ' + (b && b.r) + ', the ' + (sc.kind === 'd' ? 'diameter halved' : 'radius') + ' is ' + rWant);
      const v = volRefH({ shape:'circ', r:rWant }, sc.h);
      if (CMT.S3_CASES[i] !== hTextRef(v)) fail('S3 case ' + i + ': the source comment says ' + CMT.S3_CASES[i] + ', the volume works out to ' + hTextRef(v));
      checkSolid('S3 case ' + i, figOf.s3(sc), { shape:'circ', r:rWant }, sc.h, 'base', sc.kind, false, LONG, true).forEach(fail);
      LANGS.forEach(lang => { if (I18N[lang].s3result(sc) !== resultRef(lang, 'cu', v)) fail('S3 case ' + i + ' (' + lang + '): the result line is "' + I18N[lang].s3result(sc) + '"'); });
      if (sc.kind === 'd' && I18N.zh.s3narr(sc).indexOf(sc.v + ' ÷ 2 ＝ ') < 0) fail('S3 case ' + i + ': the diameter case never halves the diameter');
      narrate('S3 case ' + i, texts(sc, ['s3narr', 's3calc', 's3result', 's3cap', 's3chip']), 4);
    });
    if (data.cylBase({ kind:'d', v:7 }) !== null || data.cylBase({ kind:'d', v:22 }) !== null || data.cylBase({ kind:'r', v:11 }) !== null || data.cylBase({ kind:'x', v:4 }) !== null) fail('cylBase does not fail closed on an odd or too-large diameter, a too-large radius, or an unknown kind');
    if (!data.S3_CASES.some(c => c.kind === 'd')) fail('S3_CASES must include a diameter case (the halve-it-first trap)');
    data.S4_CASES.forEach((sc, i) => {
      const sf = surfRefH(sc.base, sc.h);
      if (CMT.S4_CASES[i] !== hTextRef(sf)) fail('S4 case ' + i + ': the source comment says ' + CMT.S4_CASES[i] + ', the surface area works out to ' + hTextRef(sf));
      checkNet('S4 case ' + i, figOf.s4(sc), sc.base, sc.h, LONG, true).forEach(fail);
      LANGS.forEach(lang => { if (I18N[lang].s4result(sc) !== resultRef(lang, 'sq', sf)) fail('S4 case ' + i + ' (' + lang + '): the result line is "' + I18N[lang].s4result(sc) + '"'); });
      narrate('S4 case ' + i, texts(sc, ['s4narr', 's4calc', 's4result', 's4cap', 's4chip']), 8);
    });
    if (!SURF_SHAPES_REF.every(k => data.S4_CASES.some(c => c.base.shape === k))) fail('S4_CASES should unroll a cuboid, a right-angled triangular prism and a cylinder');
    const wantsSeen = new Set();
    data.S5_CASES.forEach((sc, i) => {
      wantsSeen.add(sc.want);
      const wantH = sc.want === 'vol' ? volRefH(sc.base, sc.h) : sc.want === 'lat' ? latRefH(sc.base, sc.h) : surfRefH(sc.base, sc.h);
      if (data.caseValueH(sc) !== wantH) fail('S5 case ' + i + ': the value is ' + data.caseValueH(sc) + ', the reference says ' + wantH);
      if (CMT.S5_CASES[i] !== hTextRef(wantH)) fail('S5 case ' + i + ': the source comment says ' + CMT.S5_CASES[i] + ', the value works out to ' + hTextRef(wantH));
      if (data.caseMark(sc) !== sc.want) fail('S5 case ' + i + ': the picture marks "' + data.caseMark(sc) + '" but the case wants "' + sc.want + '"');
      const unit = sc.want === 'vol' ? 'cu' : 'sq';
      if (data.caseUnit(sc) !== unit) fail('S5 case ' + i + ': the unit is "' + data.caseUnit(sc) + '", expected "' + unit + '"');
      checkSolid('S5 case ' + i, figOf.s5(sc), sc.base, sc.h, sc.want, null, false, LONG, true).forEach(fail);
      LANGS.forEach(lang => { if (I18N[lang].s5result(sc) !== withUnitRef(lang, unit, hTextRef(wantH))) fail('S5 case ' + i + ' (' + lang + '): the result is "' + I18N[lang].s5result(sc) + '"'); });
      /* 題幹要說出這個情境的動作，而且印出底面的每一個數與高 */
      const cue = { vol:['裝滿', 'fills it up'], lat:['旁邊貼一圈', 'right round its side only'], surf:['整個包起來', 'wrapped all over'] }[sc.want];
      LANGS.forEach((lang, li) => {
        const stem = I18N[lang].s5stem(sc), plain = stem.replace(/<[^>]+>/g, '');
        if (stem !== s5StemRef(sc, lang)) fail('S5 case ' + i + ' (' + lang + '): the question is not the rebuilt sentence: "' + plain + '"');
        if (plain.indexOf(cue[li]) < 0) fail('S5 case ' + i + ' (' + lang + '): the question never says "' + cue[li] + '", so it does not ask for the ' + sc.want);
        const nums = sc.base.shape === 'circ' ? [sc.base.r] : sc.base.shape === 'rect' ? [sc.base.a, sc.base.b] : [sc.base.w, sc.base.t];
        nums.concat([sc.h]).forEach(n => { if (!new RegExp('(^|[^\\d.])' + n + ' (公分|centimetre)').test(plain)) fail('S5 case ' + i + ' (' + lang + '): the question does not print ' + n + ' centimetres'); });
        stringProblems(stem, lang, 'S5 case ' + i + ' stem').forEach(fail);
      });
      narrate('S5 case ' + i, texts(sc, ['s5narr', 's5calc', 's5result', 's5cap', 's5chip']), 2);
    });
    if (!WANTS_REF.every(w => wantsSeen.has(w))) fail('S5_CASES must show all three: a volume, a surface area and a side area');
    if (data.caseValueH({ want:'oops', base:{ shape:'rect', a:3, b:4 }, h:5 }) !== null || data.caseMark({ want:'oops' }) !== null || data.caseUnit({ want:'oops' }) !== null) fail('a situation with an unknown want is not refused');

    /* ---- 6. 遊戲的五關：正解算得出來、宣告的 ans 對得上、誘答是設計好的那三個、圖是這一關自己的、答案沒有畫出來 ---- */
    if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== ROUND_KINDS_REF.length) fail('the game has ' + (data.ROUNDS || []).length + ' rounds, expected ' + ROUND_KINDS_REF.length);
    else if (String(data.ROUNDS.map(r => r.kind)) !== String(ROUND_KINDS_REF)) fail('the game rounds are ' + data.ROUNDS.map(r => r.kind));
    (data.ROUNDS || []).forEach((rd, i) => {
      const b = rd.base, h = rd.h;
      if (!okBaseRef(b) || !okLenRef(h)){ fail('round ' + i + ' has an unusable base or height'); return; }
      let ans, unit, designed, fig;
      if (rd.kind === 'triVol'){
        if (b.shape !== 'tri') fail('round ' + i + ' is a triangular prism round without a triangle base');
        const v = volRefH(b, h); ans = v; unit = 'cu'; designed = [['forgot the ÷ 2', 2 * v], ['only the base area', areaRefH(b)], ['halved twice', v / 2]];
        fig = ['solid', 'base', null, false];
      } else if (rd.kind === 'cylVolD'){
        const v = volRefH(b, h); ans = v; unit = 'cu';
        designed = [['used the diameter as the radius', addTimes(addTimes(addTimes(PI_H_REF, 2 * b.r), 2 * b.r), h)], ['worked out the side area', latRefH(b, h)], ['only the base area', areaRefH(b)]];
        fig = ['solid', 'base', 'd', false];
      } else if (rd.kind === 'height'){
        const A = areaRefH(b), V = volRefH(b, h); ans = heightFromRef(V, A) * 100; unit = 'cm';
        /* ⚠️ 頁面刻意不用 h ÷ 2（6 × 4 的底面、高 8：4 是題幹印出來的寬），改用多乘一次 2 */
        designed = [['subtracted', V - A], ['added', V + A], ['multiplied by 2 once too often', 2 * h * 100]];
        fig = ['solid', 'base', null, true];
      } else if (rd.kind === 'cylSurf'){
        const A = areaRefH(b), L = latRefH(b, h); ans = surfRefH(b, h); unit = 'sq';
        designed = [['only one base', A + L], ['only the side', L], ['perimeter of the base without the × 2', A + A + addTimes(addTimes(PI_H_REF, b.r), h)]];
        fig = ['net'];
      } else if (rd.kind === 'which'){
        if (WANTS_REF.indexOf(rd.want) < 0){ fail('round ' + i + ': want "' + rd.want + '" is not vol, surf or lat'); return; }
        const A = areaRefH(b), L = latRefH(b, h);
        ans = rd.want === 'vol' ? volRefH(b, h) : rd.want === 'lat' ? L : surfRefH(b, h); unit = rd.want === 'vol' ? 'cu' : 'sq';
        designed = rd.want === 'lat' ? [['the whole surface area', surfRefH(b, h)], ['side plus one base', L + A], ['only one base', A]] : [];
        if (rd.want !== 'lat') fail('round ' + i + ': the label situation only has a reference for the side area');
        fig = ['solid', rd.want, null, false];
      } else { fail('round ' + i + ': unknown kind ' + rd.kind); return; }
      const ansText = hTextRef(ans);
      if (data.roundAnswer(rd) !== ansText) fail('round ' + i + ': roundAnswer is ' + data.roundAnswer(rd) + ', the reference says ' + ansText);
      const at = data.roundAnswerIndex(rd);
      if (at < 0 || String(rd.opts[at]) !== ansText) fail('round ' + i + ': the computed answer is not among the options');
      else if (at !== rd.ans) fail('round ' + i + ': the declared ans is ' + rd.ans + ' but the recomputed answer sits at ' + at);
      if (new Set(rd.opts.map(String)).size !== 4 || rd.opts.length !== 4) fail('round ' + i + ' does not have four different options');
      const wantSet = [ansText].concat(designed.map(x => hTextRef(x[1]))).sort();
      if (String(rd.opts.map(String).slice().sort()) !== String(wantSet)) fail('round ' + i + ': the options are [' + rd.opts + '], the answer and the three designed mistakes are [' + wantSet + ']');
      designed.forEach(x => { if (x[1] === ans) fail('round ' + i + ': the "' + x[0] + '" mistake gives the answer itself'); if (rd.opts.map(String).indexOf(hTextRef(x[1])) < 0) fail('round ' + i + ' is missing the "' + x[0] + '" distractor'); });
      if (data.roundUnit(rd) !== unit) fail('round ' + i + ': the unit is "' + data.roundUnit(rd) + '", expected "' + unit + '"');
      LANGS.forEach(lang => rd.opts.forEach((o, oi) => {
        const got = I18N[lang].gOptText(rd, oi), want = withUnitRef(lang, unit, String(o));
        if (got !== want) fail('round ' + i + ' option ' + oi + ' (' + lang + ') reads "' + got + '", expected "' + want + '"');
      }));
      /* ⚠️ 只驗「畫得下」的話，roundFigure 永遠回同一張圖也會過：用這一關自己的底面、高、標記重算。 */
      const pl = data.roundFigure(rd);
      if (fig[0] === 'net') checkNet('round ' + i + ' figure', pl, b, h, LONG, true).forEach(fail);
      else checkSolid('round ' + i + ' figure', pl, b, h, fig[1], fig[2], fig[3], LONG, true).forEach(fail);
      /* 答案不可以畫出來、也不可以寫在題目、標籤、提示裡（看「那一格」，而且整個數字比對） */
      const figTexts = (pl && pl.prims || []).filter(p => p.k === 'text').map(p => String(p.t));
      if (figTexts.indexOf(ansText) >= 0) fail('round ' + i + ': the answer ' + ansText + ' is written on the figure');
      LANGS.forEach(lang => {
        const d = I18N[lang];
        const says = [['prompt', d.gPrompt[rd.kind](rd)], ['label A', d.gLabelA(rd)], ['label B', d.gLabelB(rd)], ['hint 1', d.gHint1[rd.kind]], ['hint 2', d.gHint2[rd.kind](rd)], ['caption', d.gCap[rd.kind]]];
        says.forEach(([name, t]) => {
          if (typeof t !== 'string' || !t.trim()){ fail('round ' + i + ' ' + name + ' (' + lang + ') is empty'); return; }
          if (numTokens(t).indexOf(ans) >= 0) fail('round ' + i + ' ' + name + ' (' + lang + ') prints the answer ' + ansText + ((t.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).indexOf(ansText) < 0 ? ' (written in full-width digits)' : ''));
          stringProblems(t, lang, 'round ' + i + ' ' + name).forEach(fail);
          decArith(t).problems.forEach(m => fail('round ' + i + ' ' + name + ' (' + lang + '): ' + m));
        });
        if (d.gPrompt[rd.kind](rd) !== promptRef(rd, lang)) fail('round ' + i + ' (' + lang + '): the question is not the rebuilt sentence: "' + d.gPrompt[rd.kind](rd).replace(/<[^>]+>/g, '') + '"');
        const prompt = d.gPrompt[rd.kind](rd).replace(/<[^>]+>/g, '');
        /* 誘答不可以把題目印出來的數抄回來（比值；codex 抓到遊戲這一段沒有比）。求高那一關的「多除一次 2」刻意改成「多乘一次 2」就是為了這一條。 */
        const pn = numTokens(prompt);
        rd.opts.forEach((o, oi) => { if (oi !== rd.ans && pn.indexOf(numTokens(String(o))[0]) >= 0) fail('round ' + i + ' (' + lang + '): the distractor ' + o + ' copies a number the question prints'); });
        const need = { triVol:[b.w, b.t, h], cylVolD:[2 * b.r, h], height:[b.a, b.b], cylSurf:[b.r, h], which:[b.r, h] }[rd.kind];
        need.forEach(n => { if (!new RegExp('(^|[^\\d.])' + n + ' (公分|centimetre)').test(prompt)) fail('round ' + i + ' (' + lang + '): the question does not give ' + n + ' centimetres'); });
        if (rd.kind === 'height' && !new RegExp(hTextRef(volRefH(b, h)) + ' (立方公分|cubic centimetre)').test(prompt)) fail('round ' + i + ' (' + lang + '): the height question does not give the volume');
        const ask = { triVol:['體積', 'volume'], cylVolD:['體積', 'volume'], height:['高', 'height'], cylSurf:['表面積', 'surface area'], which:['旁邊貼一圈', 'right round its side only'] }[rd.kind][lang === 'zh' ? 0 : 1];
        if (prompt.indexOf(ask) < 0) fail('round ' + i + ' (' + lang + '): the question never asks for "' + ask + '"');
        [5, 1].forEach(lost => stringProblems(d.gWrong(lost, rd.kind), lang, 'round ' + i + ' wrong-answer message').forEach(fail));
        if (lang === 'en' && !/－1 point$/.test(d.gWrong(1, rd.kind))) fail('round ' + i + ': the English wrong-answer message for 1 point is "' + d.gWrong(1, rd.kind) + '"');
      });
    });

    /* ---- 7. 題庫：整句題幹、四個選項、正解對神諭；每一個數字重算；每一條算式驗算 ---- */
    ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
      const want = BANK[bank];
      LANGS.forEach(lang => {
        const got = I18N[lang][bank];
        if (!Array.isArray(got) || got.length !== want.length){ fail(bank + ' ' + lang + ': ' + (got || []).length + ' questions, the oracle has ' + want.length); return; }
        got.forEach((q, i) => {
          const w = want[i], tag = bank + '[' + i + '] ' + lang;
          if (q.stem !== w[lang]) fail(tag + ': the stem is not the pinned sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
          const wOpts = lang === 'zh' ? w.optsZh : w.optsEn;
          if (!sameList(q.opts, wOpts)) fail(tag + ': the options are [' + q.opts + '], the oracle says [' + wOpts + ']');
          const wAns = lang === 'zh' ? w.ansZh : w.ansEn;
          if (q.opts[q.ans] !== wAns) fail(tag + ': the marked option is "' + q.opts[q.ans] + '", the oracle says "' + wAns + '"');
          /* ⚠️ 解釋也整句釘住：只驗「誘答的數字後面接著『是』」的話，「17 是正確答案」也會過（codex 抓到）。
             每一個數字從哪裡來，由下面的 BANK_FACTS 用第二套實作重算。 */
          if (q.why !== (lang === 'zh' ? w.whyZh : w.whyEn)) fail(tag + ': the explanation is not the pinned sentence: "' + String(q.why).replace(/<[^>]+>/g, '').slice(0, 60) + '…"');
          if (typeof q.why !== 'string' || !q.why.trim()) fail(tag + ': the explanation is empty');
          const ar = decArith(q.stem + ' ' + q.why + ' ' + q.opts.join(' '));
          ar.problems.forEach(m => fail(tag + ': ' + m));
          /* ⚠️ 「解釋裡至少有一條驗得到的算式」只數**解釋本身**：選項裡的算式不可以替它過關。 */
          if (decArith(String(q.why || '')).verified < 1) fail(tag + ': the explanation itself has no equation that could be verified');
          stringProblems(q.stem, lang, tag + ' stem').forEach(fail);
          stringProblems(q.why, lang, tag + ' why').forEach(fail);
          q.opts.forEach((o, oi) => stringProblems(o, lang, tag + ' option ' + oi).forEach(fail));
          const keys = q.opts.map(o => optKeyRef(String(o).replace(/<[^>]+>/g, ''), lang));
          for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) if (keys[x] === keys[y]) fail(tag + ': two options are the same value: ' + q.opts[x] + ' / ' + q.opts[y]);
          /* 數字題：每一個選項的單位與值、以及哪一個是正解，全部重算 */
          const facts = BANK_FACTS[bank][i];
          if (facts){
            facts.opts.forEach((f, oi) => {
              const p = parseOptRef(q.opts[oi], lang);
              if (!p) fail(tag + ': option ' + oi + ' is not a number with a unit');
              else {
                if (p.u !== facts.unit) fail(tag + ': option ' + oi + ' is in "' + p.u + '", this question is in "' + facts.unit + '"');
                if (p.h !== f[1]) fail(tag + ': option ' + oi + ' is ' + hTextRef(p.h) + ', but "' + f[0] + '" gives ' + hTextRef(f[1]));
              }
              if ((f[2] === 'ans') !== (oi === q.ans)) fail(tag + ': option ' + oi + ' (' + f[0] + ') is ' + (oi === q.ans ? '' : 'not ') + 'marked correct');
              if (f[2] !== 'ans' && f[1] === facts.opts.find(x => x[2] === 'ans')[1]) fail(tag + ': the "' + f[0] + '" mistake gives the answer itself');
              /* 解釋要說出每一個誘答是怎麼錯的：「16 只是底面周長」「16 is only…」—— 只出現在算式裡不算（那是在算正解） */
              if (f[2] !== 'ans' && !new RegExp('(^|[^\\d.])' + hTextRef(f[1]).replace('.', '\\.') + ' (是|只|[a-z])').test(q.why.replace(/<[^>]+>/g, ''))) fail(tag + ': the explanation never says where ' + hTextRef(f[1]) + ' comes from');
            });
          }
        });
      });
    });
    {
      /* 句子題：從題幹的數字重算，正解那一句要寫出重算的結果 */
      const cub = volRefH({ shape:'rect', a:5, b:4 }, 6), cyl = volRefH(R_(3), 4);
      LANGS.forEach(lang => {
        const q = I18N[lang].qsAdv[2];
        const right = q.opts[q.ans];
        if (!(right.indexOf(hTextRef(cub)) >= 0 && right.indexOf(hTextRef(cyl)) >= 0)) fail('qsAdv[2] ' + lang + ': the marked sentence does not state the recomputed volumes ' + hTextRef(cub) + ' and ' + hTextRef(cyl));
        const bigger = cub > cyl ? ['長方體比較大', 'The cuboid is bigger'] : ['圓柱比較大', 'The cylinder is bigger'];
        if (right.indexOf(bigger[lang === 'zh' ? 0 : 1]) < 0) fail('qsAdv[2] ' + lang + ': the marked sentence does not say "' + bigger[lang === 'zh' ? 0 : 1] + '"');
        q.opts.forEach((o, oi) => { if (oi !== q.ans && (o.indexOf(hTextRef(cub)) >= 0 || o.indexOf(bigger[lang === 'zh' ? 0 : 1]) >= 0)) fail('qsAdv[2] ' + lang + ': a wrong sentence also states the true comparison'); });
        const q3 = I18N[lang].qsAdv[3];
        if (q3.opts[q3.ans].indexOf(lang === 'zh' ? '兩個底面之間的距離' : 'distance between the two bases') < 0) fail('qsAdv[3] ' + lang + ': the marked sentence does not say the prism’s height is the distance between the bases');
        const b0 = I18N[lang].qsBoost[0], b1 = I18N[lang].qsBoost[1];
        if (2 * volRefH({ shape:'tri', w:6, t:4 }, 10) !== 24000 || b0.stem.indexOf('6 × 4 × 10 ＝ 240') < 0) fail('qsBoost[0] ' + lang + ': the mistake in the stem is not exactly twice the volume');
        if (b0.opts[b0.ans].indexOf('12 × 10 ＝ ' + hTextRef(volRefH({ shape:'tri', w:6, t:4 }, 10))) < 0) fail('qsBoost[0] ' + lang + ': the marked fix does not reach the recomputed volume');
        if (4 * volRefH(R_(5), 4) !== 125600 || b1.stem.indexOf('＝ 1256') < 0) fail('qsBoost[1] ' + lang + ': the mistake in the stem is not exactly 4 times the volume');
        if (b1.opts[b1.ans].indexOf('＝ ' + hTextRef(volRefH(R_(5), 4))) < 0) fail('qsBoost[1] ' + lang + ': the marked fix does not reach the recomputed volume ' + hTextRef(volRefH(R_(5), 4)));
        if (!b1.opts.some(o => o.indexOf('＝ ' + hTextRef(latRefH(R_(5), 4))) >= 0)) fail('qsBoost[1] ' + lang + ': the side-area distractor ' + hTextRef(latRefH(R_(5), 4)) + ' is missing');
      });
    }

    /* ---- 8. plan → DOM 的接線 ---- */
    const liveIndex = stripJsComments(src);
    RENDER_PINS.forEach(pin => {
      const code = pin.file === 'index' ? liveIndex : (RAW[pin.file] === undefined ? undefined : stripJsComments(RAW[pin.file]));
      if (code === undefined) return;
      const n = code.split(pin.text).length - 1;
      if (pin.min !== undefined && n < pin.min) fail(pin.file + '.html has "' + pin.text.slice(0, 60) + '" ' + n + ' time(s), expected at least ' + pin.min);
      if (pin.max !== undefined && n > pin.max) fail(pin.file + '.html has "' + pin.text.slice(0, 60) + '" ' + n + ' time(s), expected at most ' + pin.max);
    });

    /* ---- 9. 複習頁：產生器、句庫、抽樣池（**確定性**地讀出來逐一看，不靠抽樣碰運氣） ---- */
    if (RAW.review !== undefined){
      const rv = RAW.review;
      let box = null;
      try {
        const i2 = rv.indexOf('/* ---------- 工具 ---------- */'), i3 = rv.indexOf('/* ---------- 出一批');
        box = new Function(rv.slice(i2, i3) + '\n; return {GENS:GENS, ASKS:ASKS, STATEMENTS:STATEMENTS, VAL_MAX:VAL_MAX, POOL_R:POOL_R, POOL_H:POOL_H, POOL_TW:POOL_TW, POOL_TT:POOL_TT, POOL_TRAP:POOL_TRAP, POOL_RECT_A:POOL_RECT_A, POOL_RECT_B:POOL_RECT_B, POOL_R_WHOLE:POOL_R_WHOLE, pickWrongs:pickWrongs};')();
      } catch (e){ fail('cannot read review.html generators and pools: ' + e.message); }
      if (box){
        const ids = box.GENS.map(g => g.id);
        if (String(ids) !== String(GEN_IDS)) fail('review.html generators are [' + ids + '], expected [' + GEN_IDS + ']');
        Object.keys(TRUE_STATEMENTS_REF).forEach(k => { const s = box.STATEMENTS[k]; if (!s || s.truth !== true || s.zh !== TRUE_STATEMENTS_REF[k].zh || s.en !== TRUE_STATEMENTS_REF[k].en) fail('review.html statement "' + k + '" is not the pinned true sentence'); });
        FALSE_KEYS_REF.forEach(k => { const s = box.STATEMENTS[k]; if (!s || s.truth !== false || s.zh !== FALSE_STATEMENTS_REF[k].zh || s.en !== FALSE_STATEMENTS_REF[k].en) fail('review.html statement "' + k + '" is not the pinned false sentence'); });
        if (Object.keys(box.STATEMENTS).length !== Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length) fail('review.html has ' + Object.keys(box.STATEMENTS).length + ' statements, the truth table has ' + (Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length));
        ['vol', 'area'].forEach(side => {
          const keys = Object.keys(box.ASKS[side] || {});
          if (keys.length < (side === 'area' ? 3 : 1)) fail('review.html has only ' + keys.length + ' "' + side + '" question sentences');
          if (String(keys) !== String(Object.keys(ASKS_REF[side]))) fail('review.html "' + side + '" question sentences are [' + keys + ']');
          keys.forEach(k => { const ref = ASKS_REF[side][k]; if (!ref || ref.zh !== box.ASKS[side][k].zh || ref.en !== box.ASKS[side][k].en) fail('review.html question sentence "' + side + '/' + k + '" is not the pinned one'); });
        });
        Object.keys(POOLS_REF).forEach(k => { if (!sameList(box[k], POOLS_REF[k])) fail('the pool ' + k + ' is [' + box[k] + '], the reference says [' + POOLS_REF[k] + ']'); });
        /* 範圍：長度 1 ~ 20、半徑 1 ~ 10，而且不可以是空的 */
        [['POOL_R', 1, R_MAX_REF], ['POOL_TT', 1, LEN_MAX_REF], ['POOL_R_WHOLE', 1, R_MAX_REF]].forEach(([k, lo, hi]) => {
          if (!Array.isArray(box[k]) || box[k].length < 6 || box[k].some(v => !isIntIn(v, lo, hi)) || new Set(box[k]).size !== box[k].length) fail('the pool ' + k + ' [' + box[k] + '] is not six or more different whole numbers in ' + lo + '..' + hi);
        });
        /* 整圓交錯題：半徑 2 的圓周長和面積是同一個數（2 × 2 × 3.14 ＝ 2 × 2 × 3.14），所以一定要排除 */
        (box.POOL_R_WHOLE || []).forEach(r => { if (areaRefH(R_(r)) === perimRefH(R_(r))) fail('the whole-circle pool contains r=' + r + ', where the circle’s area and circumference print the same number'); });
        const wantTrap = [];
        for (let w = 3; w <= 12; w++) for (let u = 1; u < w; u++) for (let t = 2; t <= 8; t++) wantTrap.push(u + '/' + w + '/' + t);
        const gotTrap = (box.POOL_TRAP || []).map(b => (b.shape === 'trap' ? '' : 'X') + b.u + '/' + b.w + '/' + b.t);
        if (String(gotTrap.slice().sort()) !== String(wantTrap.slice().sort())) fail('the trapezium pool has ' + gotTrap.length + ' bases, the reference works out ' + wantTrap.length);
        /* ⚠️ 每一支數值產生器的**整個**抽樣空間逐一走過：設計好的迷思不可以剛好等於正解（那樣迷思答對了），
           關鍵的那一個誘答不可以被頁面的上限 VAL_MAX 砍掉。這是確定性的證明，不是抽樣。 */
        const H = box.POOL_H || [];
        const spaces = {
          triPrismVol: () => { const o = []; box.POOL_TW.forEach(w => box.POOL_TT.forEach(t => H.forEach(h => o.push({ w:w, t:t, h:h })))); return o; },
          quadPrismVol: () => { const o = []; box.POOL_TRAP.forEach(b => H.forEach(h => o.push({ base:b, h:h }))); box.POOL_TW.forEach(w => box.POOL_TT.forEach(t => H.forEach(h => o.push({ base:{ shape:'para', w:w, t:t }, h:h })))); return o; },
          cylVolR: () => { const o = []; box.POOL_R.forEach(r => H.forEach(h => o.push({ r:r, h:h }))); return o; },
          heightFromVol: () => { const o = []; box.POOL_RECT_A.forEach(a => box.POOL_RECT_B.forEach(b => H.forEach(h => o.push({ a:a, b:b, h:h })))); return o; },
          interCircle: () => { const o = []; box.POOL_R_WHOLE.forEach(r => [true, false].forEach(w => o.push({ r:r, wantArea:w }))); return o; }
        };
        spaces.cylVolD = spaces.cylLateral = spaces.cylSurf = spaces.cylVolR;
        spaces.cuboidSurf = spaces.interCuboid = spaces.heightFromVol;
        NUMERIC_GENS.forEach(g => {
          const all = spaces[g]();
          const hits = {};
          all.forEach(d => {
            const M = genModel(g, d);
            if (!M || M.bad){ hits['no model'] = hits['no model'] || [0, JSON.stringify(d)]; hits['no model'][0]++; return; }
            M.designed.forEach(dz => {
              let k = null;
              if (dz[1].h === M.correct.h) k = 'the "' + dz[0] + '" mistake gives the correct answer';
              else if (dz[2] && dz[1].h > box.VAL_MAX) k = 'the key "' + dz[0] + '" distractor is above VAL_MAX (' + box.VAL_MAX + ' hundredths), so pickWrongs drops it';
              if (k){ hits[k] = hits[k] || [0, JSON.stringify(d)]; hits[k][0]++; }
            });
            if (M.correct.h > box.VAL_MAX) { const k = 'the answer is above VAL_MAX'; hits[k] = hits[k] || [0, JSON.stringify(d)]; hits[k][0]++; }
          });
          Object.keys(hits).forEach(k => fail('review.html ' + g + ': ' + k + ' in ' + hits[k][0] + ' of the ' + all.length + ' cases its pools can draw (e.g. ' + hits[k][1] + ')'));
        });
      }
      if (box){
        /* ⚠️ 去重與過濾**跑起來**驗，不只是字面釘住（codex 抓到：死碼裡的那一行照樣會被字面掃描算到）：
           同值不同單位、正解本身、題幹的數、0、負數、小數、超過 VAL_MAX 的，一個都不可以進選項。 */
        try {
          const pw = box.pickWrongs('500|cu', ['500|sq', '700|cu', '700|sq', '900|cu', '0|cu', '-100|cu', '150.5|cu', (box.VAL_MAX + 100) + '|cu'], ['1100|cu', '1300|cu', '1500|cu'], [900]);
          if (String(pw) !== String(['700|cu', '1100|cu', '1300|cu'])) fail('review.html pickWrongs keeps [' + pw + '] from colliding candidates, expected [700|cu, 1100|cu, 1300|cu] (same value in another unit, the answer, a stem number, 0, negatives, fractions and values over VAL_MAX must all be dropped)');
        } catch (e){ fail('review.html pickWrongs cannot be run: ' + e.message); }
        /* ⚠️ 每一支產生器的**整個**抽樣空間都用 fmt() 印一次、用 renderCheck 驗一次（兩種語言）：
           隨機 400 批不一定抽得到邊界（r ＝ 1、最長的邊）—— 這一段是確定性的。 */
        const agg2 = {};
        const note2 = m => { const k = m.replace(/\d+(?:\.\d+)?/g, '#'); if (!agg2[k]) agg2[k] = { n:0, first:m }; agg2[k].n++; };
        const H2 = box.POOL_H || [];
        const space2 = {
          triPrismVol: () => { const o = []; box.POOL_TW.forEach(w => box.POOL_TT.forEach(t => H2.forEach(h => o.push({ w:w, t:t, h:h })))); return o; },
          quadPrismVol: () => { const o = []; box.POOL_TRAP.forEach(b => H2.forEach(h => o.push({ base:b, h:h }))); box.POOL_TW.forEach(w => box.POOL_TT.forEach(t => H2.forEach(h => o.push({ base:{ shape:'para', w:w, t:t }, h:h })))); return o; },
          cyl: () => { const o = []; box.POOL_R.forEach(r => H2.forEach(h => o.push({ r:r, h:h }))); return o; },
          rect: () => { const o = []; box.POOL_RECT_A.forEach(a => box.POOL_RECT_B.forEach(b => H2.forEach(h => o.push({ a:a, b:b, h:h })))); return o; },
          interCircle: () => { const o = []; box.POOL_R_WHOLE.forEach(r => [true, false].forEach(w => o.push({ r:r, wantArea:w }))); return o; }
        };
        const spaceOf = { triPrismVol:'triPrismVol', quadPrismVol:'quadPrismVol', cylVolR:'cyl', cylVolD:'cyl', cylLateral:'cyl', cylSurf:'cyl', heightFromVol:'rect', cuboidSurf:'rect', interCuboid:'rect', interCircle:'interCircle' };
        let rendered = 0;
        box.GENS.forEach(g => {
          let cases;
          if (g.id === 'whichQuantity') cases = Object.keys(ASKS_REF.vol).map(v => ({ v:v, opts:['vol:' + v].concat(Object.keys(ASKS_REF.area).slice(0, 3).map(k => 'area:' + k)), ans:0 }));
          else if (g.id === 'trueStatement') cases = Object.keys(TRUE_STATEMENTS_REF).map(t => ({ t:t, opts:[t].concat(FALSE_KEYS_REF.slice(0, 3)), ans:0 }));
          else if (spaceOf[g.id]) cases = space2[spaceOf[g.id]]().map(p => {
            const M = genModel(g.id, p);
            if (!M || M.bad) return null;
            const stemH = M.stem.concat(M.echoToo || []).map(v => v * 100);
            const toks = [tokRef(M.correct)], seen = new Set([M.correct.h]);
            M.designed.forEach(dz => { if (!seen.has(dz[1].h) && stemH.indexOf(dz[1].h) < 0 && dz[1].h >= 1){ seen.add(dz[1].h); toks.push(tokRef(dz[1])); } });
            for (let k = 1; toks.length < 4 && k < 50; k++){ const hh = M.correct.h + 100 * k; if (!seen.has(hh) && stemH.indexOf(hh) < 0){ seen.add(hh); toks.push(hh + '|' + M.correct.u); } }
            return Object.assign({}, p, { opts:toks.slice(0, 4), ans:0 });
          }).filter(Boolean);
          else { note2('review.html generator ' + g.id + ' has no deterministic case list'); return; }
          cases.forEach(d => LANGS.forEach(lang => {
            let q, r;
            try { q = g.fmt(d, lang); r = SIM.renderCheck(d, q, lang, g.id); } catch (e){ r = 'fmt() threw ' + e.message; }
            rendered++;
            if (r) note2('review.html ' + g.id + ' (' + lang + ') on ' + JSON.stringify(Object.assign({}, d, { opts:undefined, ans:undefined })) + ': ' + r);
          }));
        });
        Object.keys(agg2).forEach(k => fail(agg2[k].first + (agg2[k].n > 1 ? ' [and ' + (agg2[k].n - 1) + ' more cases like it]' : '')));
        if (rendered < 10000) fail('only ' + rendered + ' review questions were rendered deterministically');
      }
      const rvLive = stripJsComments(rv);
      REVIEW_PINS.forEach(p => { if (rvLive.indexOf(p) < 0) fail('review.html no longer contains the line "' + p.slice(0, 60) + '…"'); });
    }

    /* ---- 10. 跨頁：用詞釘樁、禁用詞、交給別課的詞、markup 與字典的中文一致、每一頁的算式與字串 ---- */
    /* ⚠️ 釘的是**讀者看得到的字**（markup 拿掉 <script> ＋ 字典求值之後的字串），次數用 !==：
       只有下界的話，拿掉一份、別處多加一份就過關。 */
    SIBLING_RULES.forEach(rule => {
      const t = TEXT[rule.file];
      if (t === undefined) return;
      const n = t.split(rule.text).length - 1;
      if (n !== rule.n) fail(rule.file + '.html says "' + rule.text + '" ' + n + ' time(s), the pinned count is ' + rule.n + ' — it ' + rule.why);
    });
    /* ⚠️ 先解開字元參照、NFKC（全形變半形），再用容得下空白的比對：`&pi;`、`22 / 7`、`２２／７` 以前都溜得過去（codex 抓到）。 */
    /* ⚠️ 上標 ² ³ 經過 NFKC 會變成 2、3，所以只有 22/7 這種「寫法可以換成全形」的才比 NFKC 之後的字。 */
    const squash = t => decodeEntities(String(t)).replace(/\s+/g, '');
    FORBIDDEN.forEach(rule => {
      const t = TEXT[rule.file];
      const want = squash(rule.text);
      if (t !== undefined && (squash(t).indexOf(want) >= 0 || (rule.nfkc && squash(t).normalize('NFKC').indexOf(want) >= 0))) fail(rule.file + '.html contains "' + rule.text + '", which ' + rule.why);
    });
    /* ⚠️ 逐一**出現的位置**檢查，而且貼著那個詞：年級要緊接在課名前面，「不在這一課」要在同一句話裡、60 個字以內。
       固定寬度的大窗口會被別的句子背書（grade-4-numberline 的教訓）。 */
    HANDOFF.forEach(rule => {
      rule.files.forEach(pg => {
        const t = TEXT[pg];
        if (t === undefined) return;
        let at = t.indexOf(rule.word), seen = 0;
        while (at >= 0){
          if ((rule.skipIn || []).some(w => { const k = w.indexOf(rule.word); return k >= 0 && t.slice(at - k, at - k + w.length) === w; })){ at = t.indexOf(rule.word, at + 1); continue; }
          seen++;
          let ok;
          if (rule.before) ok = rule.before.some(b => t.slice(Math.max(0, at - b.length - 2), at).indexOf(b) >= 0);
          else {
            const tail = t.slice(at, at + rule.word.length + (rule.win || 60));
            const stop = tail.search(/[。．!?！？\n]|\.(?=\s|$)/);
            const clause = stop < 0 ? tail : tail.slice(0, stop);
            ok = rule.after.some(a => clause.indexOf(a) >= 0);
          }
          if (!ok) fail(pg + '.html mentions "' + rule.word + '" without saying ' + (rule.before ? 'which grade it belongs to right before it (' + rule.before.join(' / ') + ')' : 'in the same sentence that it is ' + rule.after.join(' / ')));
          at = t.indexOf(rule.word, at + 1);
        }
        if (rule.min !== undefined && seen < rule.min) fail(pg + '.html never names "' + rule.word + '", which its scope note hands off');
      });
    });
    /* markup 裡的中文 fallback 和字典的 zh 值必須一模一樣（字典才是切換語言時真正寫進去的那一份） */
    let pairs = 0;
    ['index', 'reference', 'review', 'parents'].forEach(pg => {
      if (RAW[pg] === undefined || !DICT[pg]) return;
      const norm = t => String(t).replace(/\s+/g, ' ').trim();
      const re = /<(\w+)[^>]*\sdata-i18n="([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/\1>/g;
      let m, keys = 0;
      const body = String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '');
      while ((m = re.exec(body)) !== null){
        const key = m[2], markupText = norm(m[3]), dictText = (DICT[pg].zh || {})[key];
        keys++;
        if (typeof dictText !== 'string'){ fail(pg + '.html: the key "' + key + '" is used in the markup but has no Chinese dictionary string'); continue; }
        if (!markupText){ fail(pg + '.html: the element for "' + key + '" has no Chinese fallback in the markup'); continue; }
        pairs++;
        if (norm(dictText) !== markupText) fail(pg + '.html: the Chinese in the markup and the dictionary disagree for "' + key + '" — the dictionary has ' + norm(dictText).length + ' characters, the markup has ' + markupText.length);
        if (typeof (DICT[pg].en || {})[key] !== 'string') fail(pg + '.html: the key "' + key + '" has no English dictionary string');
      }
      const all = (body.match(/\sdata-i18n="/g) || []).length;
      if (keys !== all) fail(pg + '.html: ' + all + ' data-i18n attributes but only ' + keys + ' could be paired with their element');
    });
    /* 規則要留在**它該在的那一句**：只數整頁的次數的話，拿掉一處、別處補一處就過關（codex 抓到）。 */
    KEY_PINS.forEach(k => {
      const d = DICT[k.page] && DICT[k.page][k.lang];
      const v = d && d[k.key];
      if (typeof v !== 'string') fail(k.page + '.html has no ' + k.lang + ' string "' + k.key + '"');
      else if (k.starts ? String(v).indexOf(k.text) !== 0 : String(v).indexOf(k.text) < 0) fail(k.page + '.html ' + k.lang + ' "' + k.key + '" no longer ' + (k.starts ? 'starts with' : 'contains') + ' "' + k.text + '"');
    });
    if (pairs !== MARKUP_PAIRS) fail('compared ' + pairs + ' markup/dictionary pairs, the pinned count is ' + MARKUP_PAIRS);
    /* 速查卡的表格是 JS 拼出來的：把那一頁的資料與字典跑起來，逐格重算 */
    const extraChunks = { index:[], reference:[], review:[], parents:[] };
    if (RAW.reference !== undefined){
      const rs = String(RAW.reference);
      let rp = null;
      try {
        const a = rs.indexOf('/* ---------- 語言無關的資料 ---------- */'), bI = rs.indexOf("var lang = 'zh';");
        rp = new Function(rs.slice(a, bI) + '\n; return {BASE_ROWS:BASE_ROWS, RADII:RADII, SURF_ROWS:SURF_ROWS, baseCalc:baseCalc, perimCalc:perimCalc, volCalc:volCalc, hText:hText, baseAreaH:baseAreaH, basePerimH:basePerimH, volH:volH, latH:latH, surfH:surfH, I18N:I18N};')();
      } catch (e){ fail('reference.html: cannot run its table data (' + e.message + ')'); }
      if (rp){
        const strip = o => { const c = Object.assign({}, o); delete c.h; return c; };
        if (JSON.stringify(rp.BASE_ROWS) !== JSON.stringify(REF_BASE_ROWS)) fail('reference.html BASE_ROWS is ' + JSON.stringify(rp.BASE_ROWS));
        if (!sameList(rp.RADII, rangeRef(1, R_MAX_REF))) fail('reference.html RADII is [' + rp.RADII + '], expected every radius 1..' + R_MAX_REF);
        if (JSON.stringify(rp.SURF_ROWS) !== JSON.stringify(REF_SURF_ROWS)) fail('reference.html SURF_ROWS is ' + JSON.stringify(rp.SURF_ROWS));
        const tail = (s, v) => String(s).slice(-(' ＝ ' + v).length) === ' ＝ ' + v;
        LANGS.forEach(lang => {
          const d = rp.I18N[lang];
          (rp.BASE_ROWS || []).forEach((b, i) => {
            const b0 = strip(b), cells = [d.bname(b), d.brule(b), rp.baseCalc(b), rp.volCalc(b), d.volU(rp.hText(rp.volH(b)))];
            if (!tail(cells[2], hTextRef(areaRefH(b0)))) fail('reference.html base row ' + i + ' (' + lang + '): "' + cells[2] + '" does not end in the base area ' + hTextRef(areaRefH(b0)));
            if (!tail(cells[3], hTextRef(volRefH(b0, b.h)))) fail('reference.html base row ' + i + ' (' + lang + '): "' + cells[3] + '" does not end in the volume ' + hTextRef(volRefH(b0, b.h)));
            if (cells[4] !== withUnitRef(lang, 'cu', hTextRef(volRefH(b0, b.h)))) fail('reference.html base row ' + i + ' (' + lang + '): the volume cell is "' + cells[4] + '"');
            /* 名稱整句重建：只比數字的話，長方形那一列寫成「三角形：底 5、高 3」也會過（codex 抓到） */
            if (cells[0] !== bnameRef(b, lang)) fail('reference.html base row ' + i + ' (' + lang + '): the name is "' + cells[0] + '", the reference rebuilds "' + bnameRef(b, lang) + '"');
            cells.forEach(c => extraChunks.reference.push([lang, c]));
          });
          (rp.RADII || []).forEach(r => {
            const c = { shape:'circ', r:r }, cells = [String(r), String(2 * r), rp.baseCalc(c), rp.perimCalc(c)];
            if (!tail(cells[2], hTextRef(areaRefH(c))) || !tail(cells[3], hTextRef(perimRefH(c)))) fail('reference.html radius row ' + r + ': "' + cells[2] + '" / "' + cells[3] + '" do not end in ' + hTextRef(areaRefH(c)) + ' / ' + hTextRef(perimRefH(c)));
            cells.forEach(x => extraChunks.reference.push([lang, x]));
          });
          (rp.SURF_ROWS || []).forEach((b, i) => {
            const b0 = strip(b), two = 2 * rp.baseAreaH(b);
            if (d.sname(b) !== snameRef(b, lang)) fail('reference.html surface row ' + i + ' (' + lang + '): the name is "' + d.sname(b) + '", the reference rebuilds "' + snameRef(b, lang) + '"');
            const cells = [d.sname(b), rp.baseCalc(b) + d.sep + rp.hText(rp.baseAreaH(b)) + ' × 2 ＝ ' + rp.hText(two),
                           rp.perimCalc(b) + d.sep + rp.hText(rp.basePerimH(b)) + ' × ' + b.h + ' ＝ ' + rp.hText(rp.latH(b)),
                           rp.hText(two) + ' ＋ ' + rp.hText(rp.latH(b)) + ' ＝ ' + rp.hText(rp.surfH(b)), d.areaU(rp.hText(rp.surfH(b)))];
            if (!tail(cells[2], hTextRef(latRefH(b0, b.h))) || !tail(cells[3], hTextRef(surfRefH(b0, b.h)))) fail('reference.html surface row ' + i + ' (' + lang + '): the side ' + cells[2] + ' / total ' + cells[3] + ' are not ' + hTextRef(latRefH(b0, b.h)) + ' / ' + hTextRef(surfRefH(b0, b.h)));
            if (cells[4] !== withUnitRef(lang, 'sq', hTextRef(surfRefH(b0, b.h)))) fail('reference.html surface row ' + i + ' (' + lang + '): the surface-area cell is "' + cells[4] + '"');
            cells.forEach(x => extraChunks.reference.push([lang, x]));
          });
        });
      }
    }
    /* 每一頁：markup（拿掉 <script>）＋ 字典求值之後的字串 ＋ 拼出來的表格，逐條驗算、逐條檢查字串 */
    ['index', 'reference', 'review', 'parents'].forEach(pg => {
      if (RAW[pg] === undefined) return;
      const chunks = [['zh', visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'))]];
      if (DICT[pg]) LANGS.forEach(lang => i18nStrings(DICT[pg][lang] || {}, []).forEach((t, i) => {
        stringProblems(t, lang, pg + '.html ' + lang + ' string ' + i).forEach(fail);
        chunks.push([lang, t]);
      }));
      extraChunks[pg].forEach(c => { stringProblems(c[1], c[0], pg + '.html table cell').forEach(fail); chunks.push(c); });
      /* markup 裡寫死的那一份（中文 fallback 與不經字典的字）也要過字串檢查（codex 抓到以前只驗算式） */
      /* 兩個相鄰的 <span>（例：編號圓圈 ＋ 標題）畫出來是分開的兩塊，量字的時候中間補一個空白 */
      stringProblems(visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<\/span>\s*<span/g, '</span> <span')), 'zh', pg + '.html markup').forEach(fail);
      /* 把內容藏起來的 HTML：hidden 屬性、行內的 display:none／visibility:hidden。
         ⚠️ 已知極限：祖先元素的 CSS 規則與計算後的樣式這裡看不到（沒有真的 DOM），只擋寫在元素上的。 */
      const body = String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
      const hid = body.match(/<[a-z][^>]*\s(?:hidden(?=[\s>=])|style="[^"]*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"]*")[^>]*>/i);
      if (hid) fail(pg + '.html hides an element: ' + hid[0].slice(0, 80));
      let verified = 0;
      chunks.forEach(([lang, t]) => {
        const ar = decArith(t);
        ar.problems.forEach(m => fail(pg + '.html: ' + m));
        verified += ar.verified;
      });
      if (MIN_EQ[pg] !== undefined && verified < MIN_EQ[pg]) fail(pg + '.html only offered ' + verified + ' verifiable equations, expected at least ' + MIN_EQ[pg] + ' — the checker may have stopped reading them');
    });

    /* ---- 11. 驗算器的覆蓋率：讀過的算式太少就表示它停止讀了 ---- */
    if (DEC_SEEN.length < 150) fail('the arithmetic checker only read ' + DEC_SEEN.length + ' equations in total — it may have stopped reading them');
  }
};

module.exports = {
  sim: SIM,
  data: DATA,
  /* 刻意改壞的清單：證明上面每一條斷言真的會響（node tools/breaktest.js grade-6/math/prism-volume）。 */
  breaks: [
    {"file": "index", "via": "index", "expect": "would not fold onto the prism", "find": "prims.push(prPath(polyD([{ x:x0, y:sy }, { x:r1(x0 + bw), y:sy }, { x:r1(x0 + bw), y:r1(sy - bh) }]), C_BASE, C_LINE, STROKE));", "replace": "prims.push(prPath(polyD([{ x:x0, y:sy }, { x:r1(x0 + bw), y:sy }, { x:x0, y:r1(sy - bh) }]), C_BASE, C_LINE, STROKE));", "why": "the triangle base of the net would be drawn mirrored (right angle at the wrong end of the w face), so the net would not fold into the prism — the defect the first version shipped with"},
    {"file": "index", "via": "index", "expect": "characters long, over the 26", "find": "        return ({ tri:'triangle', para:'parallelogram' })[b.shape] + ', base ' + b.w + ', h ' + b.t;", "replace": "        return ({ tri:'triangle', para:'parallelogram' })[b.shape] + ': base ' + b.w + ', height ' + b.t;", "why": "the English parallelogram label would run 31 characters, off the right edge of the canvas"},
    {"file": "index", "via": "index", "expect": "layout constant PI_H", "find": "var PI_H = 314;          /* 圓周率 3.14，存成百分之一 */", "replace": "var PI_H = 315;          /* 圓周率 3.14，存成百分之一 */", "why": "pi would no longer be 3.14, so every cylinder answer would drift"},
    {"file": "index", "via": "index", "expect": "okLen(20) is false", "find": "var LEN_MAX = 20;        /* 長度的上限（公分） */", "replace": "var LEN_MAX = 19;        /* 長度的上限（公分） */", "why": "a 20-centimetre length, which the scope note promises, would be refused"},
    {"file": "index", "via": "index", "expect": "okR(11) is true", "find": "var R_MAX = 10;          /* 圓柱半徑的上限（公分） */", "replace": "var R_MAX = 12;          /* 圓柱半徑的上限（公分） */", "why": "a radius beyond the 1-to-10 range the pages state would be accepted"},
    {"file": "index", "via": "index", "expect": "okD(22) is true", "find": "function okD(d){ return isPosInt(d) && d % 2 === 0 && okR(d / 2); }", "replace": "function okD(d){ return isPosInt(d) && d % 2 === 0; }", "why": "a diameter of 22, whose radius leaves the range, would be accepted"},
    {"file": "index", "via": "index", "expect": "okBase accepts {\"shape\":\"rtri\",\"w\":3,\"t\":4,\"c\":6}", "find": " && b.w * b.w + b.t * b.t === b.c * b.c;", "replace": ";", "why": "a 3-4-6 triangle would be treated as right-angled, so its surface area would be a lie"},
    {"file": "index", "via": "index", "expect": "okBase accepts {\"shape\":\"trap\",\"u\":5,\"w\":5,\"t\":3}", "find": "okLen(b.t) && b.u < b.w;", "replace": "okLen(b.t);", "why": "a trapezium whose top equals its bottom would be accepted"},
    {"file": "index", "via": "index", "expect": "okBase({\"shape\":\"rect\",\"a\":21,\"b\":1}) is true", "find": "if (b.shape === 'rect') return okLen(b.a) && okLen(b.b);", "replace": "if (b.shape === 'rect') return isPosInt(b.a) && okLen(b.b);", "why": "a 21-centimetre side would slip past the length limit"},
    {"file": "index", "via": "index", "expect": "a length check accepts 2.5", "find": "function isPosInt(n){ return typeof n === 'number' && isFinite(n) && n === Math.floor(n) && n >= 1; }", "replace": "function isPosInt(n){ return typeof n === 'number' && isFinite(n) && n >= 1; }", "why": "half-centimetre lengths would be accepted in a lesson whose lengths are whole"},
    {"file": "index", "via": "index", "expect": "baseAreaH({\"shape\":\"tri\"", "find": "if (b.shape === 'tri' || b.shape === 'rtri') return b.w * b.t * 50;\n    if (b.shape === 'para') return b.w * b.t * 100;", "replace": "if (b.shape === 'tri' || b.shape === 'rtri') return b.w * b.t * 100;\n    if (b.shape === 'para') return b.w * b.t * 100;", "why": "every triangle would forget the ÷ 2 — the misconception the lesson is built around"},
    {"file": "index", "via": "index", "expect": "baseAreaH({\"shape\":\"trap\"", "find": "if (b.shape === 'trap') return (b.u + b.w) * b.t * 50;", "replace": "if (b.shape === 'trap') return (b.w + b.w) * b.t * 50;", "why": "a trapezium would be worked out with the bottom side twice"},
    {"file": "index", "via": "index", "expect": "baseAreaH({\"shape\":\"para\"", "find": "if (b.shape === 'para') return b.w * b.t * 100;\n    if (b.shape === 'trap')", "replace": "if (b.shape === 'para') return b.w * b.t * 50;\n    if (b.shape === 'trap')", "why": "a parallelogram would be halved like a triangle"},
    {"file": "index", "via": "index", "expect": "baseAreaH({\"shape\":\"circ\"", "find": "if (b.shape === 'circ') return b.r * b.r * PI_H;\n    return null;", "replace": "if (b.shape === 'circ') return b.r * 2 * PI_H;\n    return null;", "why": "a cylinder's base area would be its circumference"},
    {"file": "index", "via": "index", "expect": "basePerimH({\"shape\":\"rect\"", "find": "if (b.shape === 'rect') return (b.a + b.b) * 2 * 100;", "replace": "if (b.shape === 'rect') return (b.a + b.b) * 100;", "why": "the perimeter of a rectangle would count two sides instead of four"},
    {"file": "index", "via": "index", "expect": "basePerimH({\"shape\":\"rtri\"", "find": "if (b.shape === 'rtri') return (b.w + b.t + b.c) * 100;", "replace": "if (b.shape === 'rtri') return (b.w + b.t) * 100;", "why": "the long side of the right triangle would be left out of the side strip"},
    {"file": "index", "via": "index", "expect": "basePerimH({\"shape\":\"circ\"", "find": "if (b.shape === 'circ') return b.r * 2 * PI_H;\n    return null;", "replace": "if (b.shape === 'circ') return b.r * PI_H;\n    return null;", "why": "a circle's perimeter would lose its × 2"},
    {"file": "index", "via": "index", "expect": "basePerimH({\"shape\":\"tri\"", "find": "if (b.shape === 'circ') return b.r * 2 * PI_H;\n    return null;", "replace": "if (b.shape === 'circ') return b.r * 2 * PI_H;\n    if (b.shape === 'tri') return (b.w + b.t) * 100;\n    return null;", "why": "a triangle with no known third side would be given a perimeter"},
    {"file": "index", "via": "index", "expect": "volH({\"shape\":\"rect\",\"a\":1,\"b\":1}, -1) is -100", "find": "return (a === null || !okH(h)) ? null : a * h;", "replace": "return (a === null) ? null : a * h;", "why": "a negative height would give a negative volume instead of being refused"},
    {"file": "index", "via": "index", "expect": "latH({\"shape\":\"rect\"", "find": "return (p === null || !okH(h)) ? null : p * h;", "replace": "return (p === null || !okH(h)) ? null : p * h * 2;", "why": "the side would be counted twice"},
    {"file": "index", "via": "index", "expect": "surfH({\"shape\":\"rect\"", "find": "return l === null ? null : baseAreaH(b) * 2 + l;", "replace": "return l === null ? null : baseAreaH(b) + l;", "why": "the surface area would count one base — the misconception the lesson warns about"},
    {"file": "index", "via": "index", "expect": "heightFrom accepts negative amounts", "find": "if (!isPosInt(vH) || !isPosInt(aH) || vH % aH !== 0) return null;", "replace": "if (vH % aH !== 0) return null;", "why": "a negative volume and base area would give a height"},
    {"file": "index", "via": "index", "expect": "heightFrom returns 21", "find": "return okH(h) ? h : null;", "replace": "return h;", "why": "a height longer than the lesson's lengths would be returned"},
    {"file": "index", "via": "index", "expect": "hText(10) is \"0.10\"", "find": "if (f % 10 === 0) return w + '.' + (f / 10);", "replace": "if (f % 10 === 0) return w + '.' + f;", "why": "78.5 would be printed as 78.50, so every answer string would stop matching"},
    {"file": "index", "via": "index", "expect": "hText does not fail closed", "find": "    if (!isNonNegInt(h)) return '?';\n    var w", "replace": "    if (false) return '?';\n    var w", "why": "a broken value would be printed as NaN instead of a visible ?"},
    {"file": "index", "via": "index", "expect": "layout constant DEPTH_X", "find": "var DEPTH_X = 0.4, DEPTH_Y = 0.3;", "replace": "var DEPTH_X = 0.5, DEPTH_Y = 0.3;", "why": "the prism would run back at a different angle from the one the checker measures"},
    {"file": "index", "via": "index", "expect": "is visible (its outward normal", "find": "vis.push(nx2 * dx + ny2 * dy > 0);", "replace": "vis.push(nx2 * dx + ny2 * dy < 0);", "why": "every visible side would be drawn as hidden and every hidden one as visible"},
    {"file": "index", "via": "index", "expect": "is hidden (its outward normal", "find": "if (!vis[i]) prims.push(prLine(Q[i].x, Q[i].y, Q[(i + 1) % n].x, Q[(i + 1) % n].y, C_LINE, STROKE, HID_DASH));", "replace": "if (!vis[i]) prims.push(prLine(Q[i].x, Q[i].y, Q[(i + 1) % n].x, Q[(i + 1) % n].y, C_LINE, STROKE));", "why": "hidden back edges would be drawn solid, so the picture would show edges you cannot see"},
    {"file": "index", "via": "index", "expect": "the base is not drawn true to shape", "find": "pts:[[0, 0], [b.w, 0], [b.w / 3, b.t]], apex:[b.w / 3, b.t] };", "replace": "pts:[[0, 0], [b.w, 0], [b.w / 3, b.t + 1]], apex:[b.w / 3, b.t] };", "why": "the triangle would be drawn a centimetre too tall, so the picture's base area would not be the one computed"},
    {"file": "index", "via": "index", "expect": "the front face measures", "find": "pts:[[0, 0], [b.w, 0], [b.w + b.t / 2, b.t], [b.t / 2, b.t]]", "replace": "pts:[[0, 0], [b.w, 0], [b.w + b.t / 2 + 1, b.t], [b.t / 2, b.t]]", "why": "the parallelogram's top would be a centimetre longer than its bottom — no longer a parallelogram"},
    {"file": "index", "via": "index", "expect": "the top side of the trapezium is not", "find": "pts:[[0, 0], [b.w, 0], [off + b.u, b.t], [off, b.t]]", "replace": "pts:[[0, 0], [b.w, 0], [off + b.u + 1, b.t], [off, b.t]]", "why": "the trapezium's top side would be drawn a centimetre longer than it is labelled"},
    {"file": "index", "via": "index", "expect": "the right angle is not at the bottom-left corner", "find": "pts:[[0, 0], [b.w, 0], [0, b.t]], apex:[0, b.t] };", "replace": "pts:[[0, 0], [b.w, 0], [b.w, b.t]], apex:[0, b.t] };", "why": "the right angle would move to the other corner while the labels still say it is on the left"},
    {"file": "index", "via": "index", "expect": "of them are a whole centimetre back", "find": "for (k = 1; k < h; k++){\n          prims.push(prLine(", "replace": "for (k = 1; k <= h; k++){\n          prims.push(prLine(", "why": "one layer line too many would be drawn — on the back edge, making h + 1 layers"},
    {"file": "index", "via": "index", "expect": "(h − 1)", "find": "for (k = 1; k < h; k++){\n          var lx", "replace": "for (k = 2; k < h; k++){\n          var lx", "why": "the cylinder would show one layer line too few"},
    {"file": "index", "via": "index", "expect": "half of the back circle is the near half", "find": "prims.push(prPath('M ' + b1.x + ' ' + b1.y + ' A ' + R + ' ' + R + ' 0 0 0 ' + b2.x + ' ' + b2.y, 'none', C_LINE, STROKE));", "replace": "prims.push(prPath('M ' + b1.x + ' ' + b1.y + ' A ' + R + ' ' + R + ' 0 0 1 ' + b2.x + ' ' + b2.y, 'none', C_LINE, STROKE));", "why": "the visible half of the back circle would be drawn on the hidden side — the coordinates stay right, only the flag is wrong"},
    {"file": "index", "via": "index", "expect": "square to the depth direction", "find": "var nx = r1(0.6 * R), ny = r1(0.8 * R);", "replace": "var nx = r1(0.8 * R), ny = r1(0.6 * R);", "why": "the cylinder's outline would not touch the circles where the outline really is"},
    {"file": "index", "via": "index", "expect": "the answer 8 is written on the figure", "find": "prims.push(prText(r1((P[1].x + Q[1].x) / 2 + 10), r1((P[1].y + Q[1].y) / 2 + 14), hideH ? '?' : h, 'start'));", "replace": "prims.push(prText(r1((P[1].x + Q[1].x) / 2 + 10), r1((P[1].y + Q[1].y) / 2 + 14), h, 'start'));", "why": "the find-the-height round would print its own answer on the picture"},
    {"file": "index", "via": "index", "expect": "cylinder’s height label says", "find": "prims.push(prText(r1((f1.x + b1.x) / 2 + 10), r1((f1.y + b1.y) / 2 + 14), hideH ? '?' : h, 'start'));", "replace": "prims.push(prText(r1((f1.x + b1.x) / 2 + 10), r1((f1.y + b1.y) / 2 + 14), '?', 'start'));", "why": "every cylinder would hide its height"},
    {"file": "index", "via": "index", "expect": "the dimensions written on the rect base are", "find": "prims.push(prText(r1(P[0].x - 6), r1(yb - b.b * s / 2 + 5), b.b, 'end'));", "replace": "prims.push(prText(r1(P[0].x - 6), r1(yb - b.b * s / 2 + 5), b.a, 'end'));", "why": "the rectangle's width would be labelled with its length"},
    {"file": "index", "via": "index", "expect": "the dimensions written on the trap base are", "find": "r1(ay - 5), b.u));", "replace": "r1(ay - 5), b.w));", "why": "the trapezium's top side would be labelled with the bottom side's length"},
    {"file": "index", "via": "index", "expect": "is not written on the base", "find": "prims.push(prText(r1(fc.x - R / 2), r1(fc.y - 5), 2 * b.r));", "replace": "prims.push(prText(r1(fc.x - R / 2), r1(fc.y - 5), b.r));", "why": "a diameter line would be labelled with the radius"},
    {"file": "index", "via": "index", "expect": "a diameter is", "find": "prims.push(prLine(r1(fc.x - R), fc.y, r1(fc.x + R), fc.y, C_DIM, 1.5, '3 3'));", "replace": "prims.push(prLine(r1(fc.x - R / 2), fc.y, r1(fc.x + R), fc.y, C_DIM, 1.5, '3 3'));", "why": "the diameter line would stop short of the circle"},
    {"file": "index", "via": "index", "expect": "the base-height line is not vertical", "find": "if (b.shape !== 'rtri') prims.push(prLine(ax, ay, ax, yb, C_DIM, 1.5, '3 3'));", "replace": "if (b.shape !== 'rtri') prims.push(prLine(ax, ay, r1(ax + 5), yb, C_DIM, 1.5, '3 3'));", "why": "the base shape's height would be drawn slanted, so it would no longer be a height"},
    {"file": "index", "via": "index", "expect": "the largest that fits is", "find": "var SC_MIN = 3, SC_MAX = 16;", "replace": "var SC_MIN = 3, SC_MAX = 14;", "why": "small prisms would be drawn smaller than the drawing box allows"},
    {"file": "index", "via": "index", "expect": " canvas: the canvas is 200px tall", "find": "var yb = r1((BOX_Y0 + BOX_Y1) / 2 + hPx / 2);", "replace": "var yb = r1((BOX_Y0 + BOX_Y1) / 2 + hPx / 2 + 30);", "why": "the solid would be pushed down off the bottom of the canvas"},
    {"file": "index", "via": "index", "expect": "px wide, the base perimeter is", "find": "else { segs = null; baseH = 2 * b.r; stripW = b.r * 2 * PI_H / 100; }", "replace": "else { segs = null; baseH = 2 * b.r; stripW = b.r * PI_H / 100; }", "why": "the cylinder's unrolled side would be half as long as the circle it wraps"},
    {"file": "index", "via": "index", "expect": "is attached along something that is not one strip face", "find": "var bw = segs[0] * s, bh = baseH * s;", "replace": "var bw = segs[1] * s, bh = baseH * s;", "why": "the bases of the net would no longer sit on a side face"},
    {"file": "index", "via": "index", "expect": "is not attached to the strip", "find": "prims.push(prCircle(cx, r1(sy - R), R, C_BASE, C_LINE, STROKE));", "replace": "prims.push(prCircle(cx, r1(sy - R - 4), R, C_BASE, C_LINE, STROKE));", "why": "the top circle would float above the strip instead of touching it"},
    {"file": "index", "via": "index", "expect": "px tall, the height is", "find": "var sy = r1(y0 + baseH * s), sh = r1(h * s);", "replace": "var sy = r1(y0 + baseH * s), sh = r1((h + 1) * s);", "why": "the unrolled side would be a centimetre taller than the prism"},
    {"file": "index", "via": "index", "expect": "the strip faces are labelled", "find": "prims.push(prText(r1(x + segs[i] * s / 2), r1(sy + sh / 2 + 5), segs[i]));", "replace": "prims.push(prText(r1(x + segs[i] * s / 2), r1(sy + sh / 2 + 5), segs[0]));", "why": "every side face would be labelled with the first edge"},
    {"file": "index", "via": "index", "expect": "the strip is labelled", "find": "prims.push(prText(r1(x0 + wPx / 2), r1(sy + sh / 2 + 5), hText(b.r * 2 * PI_H)));", "replace": "prims.push(prText(r1(x0 + wPx / 2), r1(sy + sh / 2 + 5), hText(b.r * PI_H)));", "why": "the unrolled side would be labelled with half the circumference"},
    {"file": "index", "via": "index", "expect": "height label is not a single", "find": "prims.push(prText(r1(x0 - 6), r1(sy + sh / 2 + 5), h, 'end'));", "replace": "prims.push(prText(r1(x0 - 6), r1(sy + sh / 2 + 5), h + 1, 'end'));", "why": "the net would state a different height from the prism"},
    {"file": "index", "via": "index", "expect": "the surface-area shapes are", "find": "var SURF_SHAPES = ['rect', 'rtri', 'circ'];", "replace": "var SURF_SHAPES = ['rect', 'rtri', 'circ', 'para'];", "why": "a parallelogram prism, whose slanted side the lesson never gives, would be unrolled"},
    {"file": "index", "via": "index", "expect": "should be tooBig", "find": "if (mark === 'layers' && h > LAYER_MAX) return emptyPlan();", "replace": "", "why": "a 20-layer picture would squeeze its layer lines together"},
    {"file": "index", "via": "index", "expect": "5, nonsense) draws something it should refuse", "find": "if (!okBase(b) || !okH(h) || MARKS.indexOf(mark) < 0) return emptyPlan();", "replace": "if (!okBase(b) || !okH(h)) return emptyPlan();", "why": "a misspelt mark would silently draw the default picture"},
    {"file": "index", "via": "index", "expect": "the \"lat\" picture fills it", "find": "var fillFront = mark === 'vol' ? C_VOL : (mark === 'lat' ? C_PLAIN : (mark === 'surf' ? C_HI : C_BASE));", "replace": "var fillFront = mark === 'vol' ? C_VOL : (mark === 'lat' ? C_HI : (mark === 'surf' ? C_HI : C_BASE));", "why": "the side-area picture would light up the bases it is meant to leave out"},
    {"file": "index", "via": "index", "expect": "the \"surf\" picture fills sides", "find": "var fillSide = mark === 'vol' ? C_VOL : ((mark === 'lat' || mark === 'surf') ? C_HI : C_SIDE);", "replace": "var fillSide = mark === 'vol' ? C_VOL : ((mark === 'lat') ? C_HI : C_SIDE);", "why": "the surface-area picture would leave the sides unlit"},
    {"file": "index", "via": "index", "expect": "the layer lines are not blue", "find": "C_PLAIN = '#FFFFFF', C_LAYER = '#3B7DD8'", "replace": "C_PLAIN = '#FFFFFF', C_LAYER = '#E8871E'", "why": "the page says the layers are marked by blue lines; they would be orange"},
    {"file": "index", "via": "index", "expect": "the cylinder has no front disc of radius", "find": "var R = b.r * s;\n      var fc", "replace": "var R = b.r * s + 2;\n      var fc", "why": "the cylinder would be drawn bigger than its radius"},
    {"file": "index", "via": "index", "expect": "has \"if (p.dash) el.setAttribute", "find": "      if (p.dash) el.setAttribute('stroke-dasharray', p.dash);\n", "replace": "", "why": "every hidden edge would be drawn as a solid line, while every plan check stayed green"},
    {"file": "index", "via": "index", "expect": "has \"pl = planSolid(sc.base, sc.h, 'layers');\" 0", "find": "pl = planSolid(sc.base, sc.h, 'layers');", "replace": "pl = planSolid(sc.base, sc.h, 'base');", "why": "example 1 would stop drawing the layers it talks about"},
    {"file": "index", "via": "index", "expect": "expected at most 1", "find": "    drawPlan(s1fig, pl, d.s1labelA(sc), d.s1labelB(sc));", "replace": "    drawPlan(s1fig, pl, d.s1labelA(sc), d.s1labelB(sc));\n    drawPlan(s1fig, pl, d.s1labelA(sc), d.s1labelB(sc));", "why": "a second, unchecked drawing path would appear"},
    {"file": "index", "via": "index", "expect": "in CSS but the viewBox is", "find": ".prfig{width:100%;max-width:460px;height:200px;display:block;margin:0 auto}", "replace": ".prfig{width:100%;max-width:460px;height:240px;display:block;margin:0 auto}", "why": "every figure would be letterboxed and silently shrink"},
    {"file": "index", "via": "index", "expect": "a canvas viewBox is", "find": "<svg class=\"prfig\" id=\"s1fig\" viewBox=\"0 0 460 200\"", "replace": "<svg class=\"prfig\" id=\"s1fig\" viewBox=\"0 0 460 180\"", "why": "the first figure would be drawn in a shorter coordinate system than it uses"},
    {"file": "index", "via": "index", "expect": "labels are not at x=", "find": "var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 192, LABEL_FS = 14;", "replace": "var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 150, LABEL_FS = 14;", "why": "the lower label would be written across the drawing"},
    {"file": "index", "via": "index", "expect": "label s1a[0] (zh) is", "find": "s1labelA:function(sc){ return '底面積 ' + hText(baseAreaH(sc.base)) + ' 平方公分'; },", "replace": "s1labelA:function(sc){ return '底面積 ' + hText(baseAreaH(sc.base)) + ' 平方公分（一層就有這麼大的一片）'; },", "why": "the label would run off the right-hand edge of the drawing"},
    {"file": "index", "via": "index", "expect": "the reference rebuilds", "find": "s4labelB:function(sc){ return '表面積 ' + hText(surfH(sc.base, sc.h)) + ' 平方公分'; },", "replace": "s4labelB:function(sc){ return '表面積 ' + hText(latH(sc.base, sc.h)) + ' 平方公分'; },", "why": "the surface-area label would show the side area"},
    {"file": "index", "via": "index", "expect": "more than the layer picture draws", "find": "{ base:{ shape:'rect', a:4, b:3 }, h:5 },   /* 底面積 12，疊 5 層 → 60 */", "replace": "{ base:{ shape:'rect', a:4, b:3 }, h:13 },   /* 底面積 12，疊 5 層 → 60 */", "why": "example 1 would pick a prism too tall for the layer picture"},
    {"file": "index", "via": "index", "expect": "must include a triangle whose base area is a decimal", "find": "{ base:{ shape:'tri', w:5, t:3 }, h:4 }           /* 5 × 3 ÷ 2 ＝ 7.5，7.5 × 4 ＝ 30 */", "replace": "{ base:{ shape:'tri', w:6, t:3 }, h:4 }           /* 5 × 3 ÷ 2 ＝ 7.5，7.5 × 4 ＝ 30 */", "why": "no example would show a base area that is a decimal"},
    {"file": "index", "via": "index", "expect": "sentence does not follow the base area", "find": "var half = (b.shape === 'tri' && (b.w * b.t) % 2 === 1) ? '底面積可以是小數，照樣乘下去就好。' : '';", "replace": "var half = (b.shape === 'tri' && (b.w * b.t) % 2 === 0) ? '底面積可以是小數，照樣乘下去就好。' : '';", "why": "the “a base area can be a decimal” remark would appear on whole-number areas and vanish on the decimal one"},
    {"file": "index", "via": "index", "expect": "S3_CASES must include a diameter case", "find": "{ kind:'d', v:12, h:5 }     /* 直徑 12 → 半徑 6：113.04 × 5 ＝ 565.2 */", "replace": "{ kind:'r', v:6, h:5 }     /* 直徑 12 → 半徑 6：113.04 × 5 ＝ 565.2 */", "why": "the cylinder examples would never show the halve-the-diameter step"},
    {"file": "index", "via": "index", "expect": "cylBase gives radius", "find": "if (sc.kind === 'd') return okD(sc.v) ? { shape:'circ', r:sc.v / 2 } : null;", "replace": "if (sc.kind === 'd') return okD(sc.v) ? { shape:'circ', r:sc.v } : null;", "why": "the diameter would be used as the radius — the exact trap the example warns about"},
    {"file": "index", "via": "index", "expect": "cylBase does not fail closed", "find": "if (sc.kind === 'r') return okR(sc.v) ? { shape:'circ', r:sc.v } : null;", "replace": "if (sc.kind === 'r') return { shape:'circ', r:sc.v };", "why": "a radius of 11 would be accepted by the cylinder example"},
    {"file": "index", "via": "index", "expect": "S4_CASES case 3 is", "find": "{ base:{ shape:'circ', r:4 }, h:3 }                /* 50.24 × 2 ＋ 25.12 × 3 ＝ 175.84 */", "replace": "{ base:{ shape:'circ', r:4 }, h:4 }                /* 50.24 × 2 ＋ 25.12 × 3 ＝ 175.84 */", "why": "the surface-area example would stop matching its pinned value"},
    {"file": "index", "via": "index", "expect": "S5_CASES must show all three", "find": "{ id:'label', want:'lat',  base:{ shape:'circ', r:3 }, h:7 },", "replace": "{ id:'label', want:'surf',  base:{ shape:'circ', r:3 }, h:7 },", "why": "the deciding example would lose its side-area situation"},
    {"file": "index", "via": "index", "expect": "the picture marks", "find": "function caseMark(sc){ return WANTS.indexOf(sc.want) < 0 ? null : sc.want; }", "replace": "function caseMark(sc){ return WANTS.indexOf(sc.want) < 0 ? null : 'base'; }", "why": "the deciding example's picture would stop showing which faces the question wants"},
    {"file": "index", "via": "index", "expect": "a situation with an unknown want is not refused", "find": "function caseUnit(sc){ return sc.want === 'vol' ? 'cu' : (WANTS.indexOf(sc.want) < 0 ? null : 'sq'); }", "replace": "function caseUnit(sc){ return sc.want === 'vol' ? 'cu' : 'sq'; }", "why": "a misspelt want would be answered in square centimetres"},
    {"file": "index", "via": "index", "expect": "the question never says \"旁邊貼一圈\"", "find": "label:'一個圓柱形的罐頭，底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + sc.h + ' 公分</b>。只在<b>旁邊貼一圈標籤</b>", "replace": "label:'一個圓柱形的罐頭，底面半徑 <b>' + b.r + ' 公分</b>、高 <b>' + sc.h + ' 公分</b>。要把它<b>整個包起來</b>", "why": "the side-area situation would ask a surface-area question"},
    {"file": "index", "via": "index", "expect": "the declared ans is", "find": "{ kind:'triVol', base:{ shape:'tri', w:10, t:6 }, h:7, opts:['420', '210', '30', '105'], ans:1 },", "replace": "{ kind:'triVol', base:{ shape:'tri', w:10, t:6 }, h:7, opts:['420', '210', '30', '105'], ans:2 },", "why": "the round would declare the wrong option as its answer"},
    {"file": "index", "via": "index", "expect": "round 1 is missing the \"used the diameter as the radius\" distractor", "find": "opts:['1004.8', '251.2', '125.6', '50.24'], ans:1 },", "replace": "opts:['1000', '251.2', '125.6', '50.24'], ans:1 },", "why": "the cylinder round would lose the distractor that catches the diameter trap"},
    {"file": "index", "via": "index", "expect": "roundAnswer is", "find": "if (rd.kind === 'cylSurf') return hText(surfH(rd.base, rd.h));", "replace": "if (rd.kind === 'cylSurf') return hText(latH(rd.base, rd.h));", "why": "the surface-area round would mark the side-only option as correct"},
    {"file": "index", "via": "index", "expect": "the unit is \"cu\", expected \"cm\"", "find": "if (rd.kind === 'height') return 'cm';", "replace": "if (rd.kind === 'height') return 'cu';", "why": "a height would be offered in cubic centimetres"},
    {"file": "index", "via": "index", "expect": "round 4 figure", "find": "if (rd.kind === 'which') return planSolid(rd.base, rd.h, caseMark(rd));", "replace": "if (rd.kind === 'which') return planSolid(rd.base, rd.h, 'surf');", "why": "the label round would light up the bases, contradicting its own caption"},
    {"file": "index", "via": "index", "expect": "only has a reference for the side area", "find": "{ kind:'which', want:'lat', base:{ shape:'circ', r:4 }, h:9, opts:['326.56', '226.08', '276.32', '50.24'], ans:1 }", "replace": "{ kind:'which', want:'vol', base:{ shape:'circ', r:4 }, h:9, opts:['326.56', '226.08', '276.32', '50.24'], ans:1 }", "why": "the label round would turn into a volume question while its options stay areas"},
    {"file": "index", "via": "index", "expect": "hint 2 (zh) prints the answer 8", "find": "height:function(rd){ return '底面積是 ' + baseCalc(rd.base) + '，再 ' + hText(volH(rd.base, rd.h)) + ' ÷ ' + hText(baseAreaH(rd.base)) + '。'; },", "replace": "height:function(rd){ return '底面積是 ' + baseCalc(rd.base) + '，再 ' + hText(volH(rd.base, rd.h)) + ' ÷ ' + hText(baseAreaH(rd.base)) + ' ＝ ' + rd.h + '。'; },", "why": "the second hint would give the answer away"},
    {"file": "index", "via": "index", "expect": "the height question does not give the volume", "find": "的長方形，<b>體積是 ' + hText(volH(rd.base, rd.h)) + ' 立方公分</b>。", "replace": "的長方形，<b>體積很大</b>。", "why": "the find-the-height question would no longer give the volume it needs"},
    {"file": "index", "via": "index", "expect": "wrong-answer message for 1 point", "find": "' －' + lost + ' ' + (lost === 1 ? 'point' : 'points'); },", "replace": "' －' + lost + ' points'; },", "why": "losing a single point would read “1 points”"},
    {"file": "index", "via": "index", "expect": "the stem is not the pinned sentence", "find": "{ stem:'一個柱體的<strong>底面積</strong>是 <strong>12 平方公分</strong>、<strong>高</strong>是 <strong>5 公分</strong>，它的體積是多少？'", "replace": "{ stem:'一個柱體的<strong>底面積</strong>是 <strong>12 平方公分</strong>、<strong>高</strong>是 <strong>5 公分</strong>，它的表面積是多少？'", "why": "the question would ask for a surface area while the marked answer is still the volume"},
    {"file": "index", "via": "index", "expect": "option 0 is 282.8", "find": "opts:['282.6 立方公分', '188.4 立方公分', '94.2 立方公分', '28.26 立方公分'], ans:0,", "replace": "opts:['282.8 立方公分', '188.4 立方公分', '94.2 立方公分', '28.26 立方公分'], ans:0,", "why": "the marked answer would be a number the cylinder does not give"},
    {"file": "index", "via": "index", "expect": "this claim is wrong", "find": "再乘柱體的高：12 × 10 ＝ 120，單位是立方公分。240 是忘了除以 2", "replace": "再乘柱體的高：12 × 10 ＝ 130，單位是立方公分。240 是忘了除以 2", "why": "the explanation would state a product that is not what the numbers give"},
    {"file": "index", "via": "index", "expect": "the marked option is \"122.46", "find": "opts:['122.46 平方公分', '150.72 平方公分', '94.2 平方公分', '103.62 平方公分'], ans:1,", "replace": "opts:['122.46 平方公分', '150.72 平方公分', '94.2 平方公分', '103.62 平方公分'], ans:0,", "why": "the surface-area question would mark the one-base option — the misconception itself"},
    {"file": "index", "via": "index", "expect": "the explanation never says where 16 comes from", "find": "15 是一個底面的面積；16 只是底面周長，還沒乘高。", "replace": "15 是一個底面的面積。", "why": "a distractor would be left without an explanation of the mistake behind it"},
    {"file": "index", "via": "index", "expect": "the marked sentence does not say \"長方體比較大\"", "find": "'長方體比較大：長方體是 120 立方公分，圓柱是 113.04 立方公分'", "replace": "'圓柱比較大：長方體是 120 立方公分，圓柱是 113.04 立方公分'", "why": "the marked comparison would contradict its own numbers"},
    {"file": "index", "via": "index", "expect": "puts a unit inside an equation", "find": "s3note:'💬 圓柱的體積 ＝ <strong>半徑 × 半徑 × 3.14 × 高</strong>。", "replace": "s3note:'💬 圓柱的體積 ＝ <strong>半徑 公分 × 半徑 × 3.14 × 高</strong>。", "why": "a unit inside the equation would split it in two for the checker and for the reader"},
    {"file": "index", "via": "index", "expect": "glues Chinese to a digit", "find": "next3:'🧑‍🏫 <strong>換你當老師</strong>：找一個圓柱形的罐子（或一盒面紙），用尺量出底面和高，算出它的體積；再說說看「為什麼三角柱要先除以 2」、「表面積為什麼要算 2 個底面」。", "replace": "next3:'🧑‍🏫 <strong>換你當老師</strong>：找一個圓柱形的罐子（或一盒面紙），用尺量出底面和高，算出它的體積；再說說看「為什麼三角柱要先除以 2」、「表面積為什麼要算2 個底面」。", "why": "the site-wide space between Chinese and a digit would go missing"},
    {"file": "index", "via": "index", "expect": "has a plural slip", "find": "(' + plEn(sc.h, 'centimetre') + ') — two different things.'; },", "replace": "(' + sc.h + ' centimetre) — two different things.'; },", "why": "the English caption would say “9 centimetre”"},
    {"file": "index", "via": "index", "expect": "has doubled punctuation", "find": "層，每一層都厚 1 公分、都和底面一樣大。'; },", "replace": "層，每一層都厚 1 公分、都和底面一樣大。。'; },", "why": "the caption would end with two full stops"},
    {"file": "index", "via": "index", "expect": "the Chinese in the markup and the dictionary disagree for \"s5h2\"", "find": "<h2 data-i18n=\"s5h2\">這一題要算體積、表面積，還是側面積？</h2>", "replace": "<h2 data-i18n=\"s5h2\">這一題要算體積還是表面積？</h2>", "why": "the heading shown before the script runs would differ from the one the dictionary writes"},
    {"file": "index", "via": "index", "expect": "writes a power", "find": "data-i18n=\"s3note\">💬 圓柱的體積 ＝ <strong>半徑 × 半徑 × 3.14 × 高</strong>", "replace": "data-i18n=\"s3note\">💬 圓柱的體積 ＝ <strong>半徑² × 3.14 × 高</strong>", "why": "a power would appear in a lesson that spells the multiplication out"},
    {"file": "index", "via": "index", "expect": "mentions \"圓周率工作坊\" without saying which grade", "find": "（半徑 × 半徑 × 3.14，六年級「圓周率工作坊」學過），再乘<strong>圓柱的高</strong>。</p>", "replace": "（半徑 × 半徑 × 3.14，「圓周率工作坊」學過），再乘<strong>圓柱的高</strong>。</p>", "why": "the page would name a sibling lesson without saying which grade teaches it"},
    {"file": "index", "via": "index", "expect": "mentions \"容積\" without saying", "find": "data-i18n=\"scopeNote\">這一課只做五件事：", "replace": "data-i18n=\"scopeNote\">容積也很有趣。這一課只做五件事：", "why": "the page would mention capacity without saying it is not in this lesson"},
    {"file": "parents", "via": "index", "expect": "states the “add instead of multiply” misconception as a rule", "find": "foot:'回到<a class=\"home\" href=\"index.html\">課程</a>或<a class=\"home\" href=\"reference.html\">速查卡</a>。下次", "replace": "foot:'記住：柱體的體積 ＝ 底面積 ＋ 高。回到<a class=\"home\" href=\"index.html\">課程</a>或<a class=\"home\" href=\"reference.html\">速查卡</a>。下次", "why": "the parents page would teach the misconception as the rule"},
    {"file": "reference", "via": "index", "expect": "says \"底面積 × 2 ＋ 底面周長 × 高\" 5 time(s)", "find": "f3:'表面積 ＝ 底面積 × 2 ＋ 底面周長 × 高<span", "replace": "f3:'表面積 ＝ 兩個底面 ＋ 側面<span", "why": "the cheat sheet's formula line would stop using the wording the other pages use"},
    {"file": "reference", "via": "index", "expect": "reference.html BASE_ROWS is", "find": "    { shape:'tri',  w:6, t:4, h:10 },\n    { shape:'para'", "replace": "    { shape:'tri',  w:6, t:4, h:11 },\n    { shape:'para'", "why": "the cheat sheet's table would stop using the quiz's numbers"},
    {"file": "reference", "via": "index", "expect": "does not end in the base area", "find": "if (b.shape === 'tri' || b.shape === 'rtri') return b.w * b.t * 50;", "replace": "if (b.shape === 'tri' || b.shape === 'rtri') return b.w * b.t * 100;", "why": "the cheat sheet's triangle rows would forget the ÷ 2"},
    {"file": "reference", "via": "index", "expect": "reference.html has \"bbody.appendChild", "find": "bbody.appendChild(rowOf([d.bname(b), d.brule(b), baseCalc(b), volCalc(b), d.volU(hText(volH(b)))], 2));", "replace": "bbody.appendChild(rowOf([d.bname(b), d.brule(b), baseCalc(b), baseCalc(b), d.volU(hText(volH(b)))], 2));", "why": "the table would print the base area where it promises the volume, and the checker's copy of the table would no longer be the page's"},
    {"file": "reference", "via": "index", "expect": "reference.html: this claim is wrong", "find": "['柱體的體積 ＝ 底面積 × 高', '<strong>對</strong>', '底面積 12、高 5：12 × 5 ＝ 60'],", "replace": "['柱體的體積 ＝ 底面積 × 高', '<strong>對</strong>', '底面積 12、高 5：12 × 5 ＝ 50'],", "why": "the cheat sheet's example would state a wrong product"},
    {"file": "review", "via": "index", "expect": "is used in the markup but has no Chinese dictionary string", "find": "data-i18n=\"retryBtn\">", "replace": "data-i18n=\"retryBtn2\">", "why": "a button would keep its Chinese text after switching to English"},
    {"file": "review", "via": "index", "expect": "review.html cylVolR: the \"worked out the side area\" mistake gives the correct answer", "find": "var POOL_R = [3, 4, 5, 6, 7, 8, 9, 10];", "replace": "var POOL_R = [2, 3, 4, 5, 6, 7, 8, 9, 10];", "why": "radius 2, where the side area and the volume per centimetre coincide, would come back"},
    {"file": "review", "via": "index", "expect": "the pool POOL_H is", "find": "var POOL_H = range(2, 15);", "replace": "var POOL_H = range(2, 16);", "why": "the heights the review draws from would silently change"},
    {"file": "review", "via": "index", "expect": "is not the pinned false sentence", "find": "hTimes4:    { truth:false,", "replace": "hTimes4:    { truth:true, ", "why": "a false sentence would be declared true, so the “only one is true” question would have two"},
    {"file": "review", "via": "index", "expect": "is not the pinned one", "find": "cakeBox:   { zh:'長方體的盒子裡面可以放多少立方公分的東西'", "replace": "cakeBox:   { zh:'長方體的盒子外面要包多大一張紙'", "why": "a volume situation would start describing a surface"},
    {"file": "review", "via": "index", "expect": "the whole-circle pool contains r=2", "find": "var POOL_R_WHOLE = range(3, 10);", "replace": "var POOL_R_WHOLE = range(2, 10);", "why": "radius 2, where a circle's area and circumference print the same number, would come back"},
    {"file": "review", "via": "index", "expect": "triPrismVol: the key \"forgot the ÷ 2\" distractor is above VAL_MAX", "find": "var VAL_MAX = 2000000;", "replace": "var VAL_MAX = 150000;", "why": "the cap would silently drop the key distractor of big prisms"},
    {"file": "review", "via": "index", "expect": "no longer contains the line", "find": "      if (shown[v]) return;", "replace": "", "why": "two options could print the same number"},
    {"file": "review", "via": "review", "expect": "the \"forgot the ÷ 2\" distractor", "find": "var cands = [tok(2 * v, 'cu'), tok(baseAreaH(b), 'cu'), tok(w * h * 100, 'cu')];", "replace": "var cands = [tok(baseAreaH(b), 'cu'), tok(w * h * 100, 'cu')];", "why": "the triangular prism question would lose its key misconception"},
    {"file": "review", "via": "review", "expect": "the \"added instead of dividing\" distractor", "find": "var cands = [tok((V - A) * 100, 'cm'), tok((V + A) * 100, 'cm'), tok(h % 2 === 0 ? h * 50 : h * 200, 'cm')];", "replace": "var cands = [tok((V - A) * 100, 'cm'), tok((V + 1) * 100, 'cm'), tok(h % 2 === 0 ? h * 50 : h * 200, 'cm')];", "why": "the find-the-height question would lose the added-instead-of-divided distractor"},
    {"file": "review", "via": "review", "expect": "copies a number the stem prints", "find": "var wrongs = pickWrongs(correct, cands, [1, 2, 3, 4, 5, 6, -1, -2].map(function(k){ return tok((h + k) * 100, 'cm'); }), [a * 100, bb * 100, A * 100, V * 100]);", "replace": "var wrongs = pickWrongs(correct, cands, [1, 2, 3, 4, 5, 6, -1, -2].map(function(k){ return tok((h + k) * 100, 'cm'); }), []);", "why": "a length printed in the stem would be offered back as the height"},
    {"file": "review", "via": "review", "expect": "the rendered stem is not the rebuilt sentence", "find": "? '一個圓柱的底面<strong>半徑是 ' + d.r + ' 公分</strong>、<strong>高是 ' + d.h + ' 公分</strong>，它的體積是多少？'", "replace": "? '一個圓柱的底面<strong>半徑是 ' + d.r + ' 公分</strong>、<strong>高是 ' + d.h + ' 公分</strong>，它的容積是多少？'", "why": "the question would ask for a capacity, which the lesson does not teach"},
    {"file": "review", "via": "review", "expect": "this claim is wrong", "find": "'。加起來 ' + hText(2 * A) + ' ＋ ' + hText(l) + ' ＝ ' + hText(s) + '，單位是平方公分。'", "replace": "'。加起來 ' + hText(2 * A) + ' ＋ ' + hText(l) + ' ＝ ' + hText(s + 100) + '，單位是平方公分。'", "why": "the explanation's total would not be the sum it shows"},
    {"file": "review", "via": "review", "expect": "the explanation never says \"不算\"", "find": "上下兩個底面沒有貼，不算。'", "replace": "上下兩個底面也要算。'", "why": "the side-area explanation would tell the child to add the bases"},
    {"file": "review", "via": "review", "expect": "stem has a plural slip", "find": "function cm(n){ return plEn(n, 'centimetre'); }", "replace": "function cm(n){ return n + ' centimetre'; }", "why": "every English stem would say “5 centimetre”"},
    {"file": "review", "via": "review", "expect": "every option of this question is in \"cu\"", "find": "var cands = [tok(latH(b, h), 'cu'), tok(r * PI_H * h, 'cu'), tok(baseAreaH(b), 'cu')];", "replace": "var cands = [tok(latH(b, h), 'sq'), tok(r * PI_H * h, 'cu'), tok(baseAreaH(b), 'cu')];", "why": "a volume question would offer one option in square centimetres"},
    {"file": "review", "via": "review", "expect": "true sentences offered", "find": "var o = optsOf(t, shuffle(FALSE_KEYS).slice(0, 3));", "replace": "var o = optsOf(t, shuffle(TRUE_KEYS.filter(function(k){ return k !== t; })).slice(0, 1).concat(shuffle(FALSE_KEYS).slice(0, 2)));", "why": "the “only one is true” question would offer two true sentences"},
    {"file": "review", "via": "review", "expect": "volume questions offered", "find": "var keys = ['vol:' + v].concat(others.map(function(k){ return 'area:' + k; }));", "replace": "var keys = ['vol:' + v, 'vol:' + (v === ASK_VOL_KEYS[0] ? ASK_VOL_KEYS[1] : ASK_VOL_KEYS[0])].concat(others.slice(0, 2).map(function(k){ return 'area:' + k; }));", "why": "the “only one wants a volume” question would offer two volume situations"},
    {"file": "review", "via": "review", "expect": "more than any designed mistake", "find": "if (!isFinite(v) || v < 1 || v > VAL_MAX || v !== Math.floor(v)) return;", "replace": "if (!isFinite(v) || v < 1 || v !== Math.floor(v)) return;\n      if (out.length === 0 && !shown[900000000000000]){ shown[900000000000000] = 1; out.push(tok(900000000000000, tokUnit(c))); return; }", "why": "with the cap gone, an absurdly large number would be offered as an option"},
    {"file": "index", "via": "index", "expect": "the distractor 6 copies a number the question prints", "find": "{ kind:'height', base:{ shape:'rect', a:6, b:4 }, h:8, opts:['168', '8', '16', '216'], ans:1 },", "replace": "{ kind:'height', base:{ shape:'rect', a:6, b:4 }, h:8, opts:['168', '8', '6', '216'], ans:1 },", "why": "the height round would offer the printed length 6 back as a distractor"},
    {"file": "index", "via": "index", "expect": "basePerimH does not fail closed on {\"shape\":\"rect\",\"a\":2.5,\"b\":4}", "find": "  function basePerimH(b){\n    if (!okBase(b)) return null;", "replace": "  function basePerimH(b){\n    if (!okBase(b) && b && b.shape !== 'rect') return null;", "why": "a half-centimetre rectangle would be given a perimeter"},
    {"file": "index", "via": "index", "expect": "surfH({\"shape\":\"circ\",\"r\":3}, 5) is", "find": "    var l = latH(b, h);\n    return l === null ? null : baseAreaH(b) * 2 + l;", "replace": "    var l = latH(b, h);\n    if (b && b.shape === 'circ' && b.r === 3 && h === 5) return baseAreaH(b) * 2 + l + 100;\n    return l === null ? null : baseAreaH(b) * 2 + l;", "why": "one cylinder surface area would be a whole square centimetre off"},
    {"file": "index", "via": "index", "expect": "is not the side faces added up (for a cylinder", "find": "if (b.shape === 'circ') return b.r * 2 * PI_H;\n    return null;", "replace": "if (b.shape === 'circ') return b.r * 2 * PI_H + (b.r === 7 ? 100 : 0);\n    return null;", "why": "the radius-7 cylinder’s side would be a centimetre too long — only the second path through the circle’s area sees it"},
    {"file": "index", "via": "index", "expect": "the grade-5 2 × (lw ＋ lh ＋ wh) gives", "find": "if (b.shape === 'rect') return b.a * b.b * 100;", "replace": "if (b.shape === 'rect') return b.a * b.b * 100 + (b.a === 5 && b.b === 3 ? 100 : 0);", "why": "the 5 × 3 base would be a square centimetre too big"},
    {"file": "index", "via": "index", "expect": "the front disc and its outline are not the same circle", "find": "prims.push(prCircle(fc.x, fc.y, R, fillFront, 'none', 0));", "replace": "prims.push(prCircle(r1(fc.x + 3), fc.y, R, fillFront, 'none', 0));", "why": "the painted front disc would slide off its outline"},
    {"file": "index", "via": "index", "expect": "glues Chinese to a digit: ", "find": "s1cap:function(sc){ return '橘色的是底面，藍線把柱體切成 ' + sc.h + ' 層，每一層都厚 1 公分、都和底面一樣大。'; },", "replace": "s1cap:function(sc){ return '橘色的是底面，藍線把柱體切成 ' + sc.h + ' 層，每一層都厚 1 公分、都和底面一樣大（高是&#51;公分的柱體就是 3 層）。'; },", "why": "a numeric entity would hide a glued digit"},
    {"file": "index", "via": "index", "expect": "has a singular/plural slip: 1.0 centimetres", "find": "s1cap:function(sc){ return 'The orange face is the base.", "replace": "s1cap:function(sc){ return '(1.0 centimetres per layer) The orange face is the base.", "why": "an English caption would say “1.0 centimetres”"},
    {"file": "index", "via": "index", "expect": "leaks an internal value", "find": "s1result:function(sc){ return '體積是 ' + hText(volH(sc.base, sc.h)) + ' 立方公分'; },", "replace": "s1result:function(sc){ return '體積是 ' + hText(volH(sc.base, sc.h)) + ' 立方公分' + (sc.h === 5 ? '（不是 ' + (1 / 0) + '）' : ''); },", "why": "a non-finite number would reach the reader"},
    {"file": "index", "via": "index", "expect": "uses a full-width digit", "find": "s1result:function(sc){ return '體積是 ' + hText(volH(sc.base, sc.h)) + ' 立方公分'; },", "replace": "s1result:function(sc){ return '體積是 ' + hText(volH(sc.base, sc.h)) + ' 立方公分，高是３ 公分'; },", "why": "a full-width digit would slip past the half-width checks"},
    {"file": "index", "via": "index", "expect": "S5 case 0 (zh): the question is not the rebuilt sentence", "find": "tank:'一個圓柱形的水桶，底面半徑 <b>' + b.r + ' 公分</b>", "replace": "tank:'一個長方體的水桶，底面半徑 <b>' + b.r + ' 公分</b>", "why": "the cylinder bucket would be described as a cuboid while the picture stays a cylinder"},
    {"file": "index", "via": "index", "expect": "round 3 (en): the question is not the rebuilt sentence", "find": "cylSurf:function(rd){ return 'Question ④: a cylinder has a base radius of <b>'", "replace": "cylSurf:function(rd){ return 'Question ④: a triangular prism has a base radius of <b>'", "why": "the surface-area round would describe a different solid from its picture"},
    {"file": "index", "via": "index", "expect": "prints the answer 8 (written in full-width digits)", "find": "height:function(rd){ return '底面積是 ' + baseCalc(rd.base) + '，再 ' + hText(volH(rd.base, rd.h)) + ' ÷ ' + hText(baseAreaH(rd.base)) + '。'; },", "replace": "height:function(rd){ return '底面積是 ' + baseCalc(rd.base) + '，再 ' + hText(volH(rd.base, rd.h)) + ' ÷ ' + hText(baseAreaH(rd.base)) + '，答案是 ８。'; },", "why": "a full-width answer in the hint would give the round away"},
    {"file": "reference", "via": "index", "expect": "reference.html base row 4 (zh): the name is", "find": "        return '圓柱：底面半徑 ' + b.r + '，柱體高 ' + b.h;", "replace": "        return '三角柱：底面半徑 ' + b.r + '，柱體高 ' + b.h;", "why": "a cylinder row would be named a triangular prism while its numbers stay right"},
    {"file": "index", "via": "index", "expect": "\"s4note\" no longer contains \"<strong>側面積 ＝ 底面周長 × 高</strong>\"", "find": "s4note:'💬 <strong>側面積 ＝ 底面周長 × 高</strong>，", "replace": "s4note:'💬 <strong>側面積 ＝ 底面周長 ＋ 高</strong>，", "why": "the side-area rule would be replaced in the note that states it"},
    {"file": "index", "via": "index", "expect": "\"footer\" no longer contains \"<strong>volume of a prism ＝ base area × height</strong>\"", "find": "footer:'The whole page in one line: <strong>volume of a prism ＝ base area × height</strong>", "replace": "footer:'The whole page in one line: <strong>volume of a prism ＝ base area ＋ height</strong>", "why": "the English summary line would state the wrong rule"},
    {"file": "parents", "via": "index", "expect": "parents.html markup glues Chinese to a digit", "find": "<span data-i18n=\"s1\">這一課在教什麼</span>", "replace": "<span data-i18n=\"s1\">這一課在教什麼</span><span>第1課</span>", "why": "static markup outside the dictionary would glue Chinese to a digit"},
    {"file": "index", "via": "index", "expect": "index.html hides an element", "find": "<section id=\"secLayers\">", "replace": "<section id=\"secLayers\" hidden>", "why": "the first example would be hidden with the hidden attribute"},
    {"file": "index", "via": "index", "expect": "mentions \"錐體\" without saying", "find": "s1note:'💬 <strong>柱體的體積 ＝ 底面積 × 高</strong>。", "replace": "s1note:'💬 錐體表面積也可以這樣算。<strong>柱體的體積 ＝ 底面積 × 高</strong>。", "why": "the page would teach something about cones without handing it off"},
    {"file": "index", "via": "index", "expect": "mentions \"cone\" without saying", "find": "<strong>the volume of pyramids and cones</strong>, and <strong>converting capacity into litres and millilitres</strong> are <strong>not in this lesson</strong>", "replace": "and <strong>converting capacity into litres and millilitres</strong> are <strong>not in this lesson</strong>. The volume of cones works the same way", "why": "the English page would claim cones are covered"},
    {"file": "index", "via": "index", "expect": "which uses a second approximation of pi", "find": "data-i18n=\"s3note\">💬 圓柱的體積 ＝ <strong>半徑 × 半徑 × 3.14 × 高</strong>", "replace": "data-i18n=\"s3note\">💬 圓柱的體積 ＝ <strong>半徑 × 半徑 × 3.14 × 高</strong>（有人用 ２２／７）", "why": "a full-width 22/7 would slip past a literal check"},
    {"file": "index", "via": "index", "expect": "the Chinese and the English print different numbers", "find": "s1narr:function(sc){\n        var b = sc.base, a = baseAreaH(b), v = volH(b, sc.h);\n        var how = { rect:'a rectangle", "replace": "s1narr:function(sc){\n        var b = sc.base, a = baseAreaH(b), v = volH(b, sc.h) + 0 * 7;\n        if (sc.h === 5) return 'Each layer is 2 centimetres thick. ' + I18N.en.s1narr({ base:b, h:4 }).replace(/4/g, '5');\n        var how = { rect:'a rectangle", "why": "the English narration would add a number the Chinese does not say"},
    {"file": "index", "via": "index", "expect": "unit inside an equation: 12 公分 ＝", "find": "s1narr:function(sc){\n        var b = sc.base, a = baseAreaH(b), v = volH(b, sc.h);\n        var how = { rect:'長方形", "replace": "s1narr:function(sc){\n        var b = sc.base, a = baseAreaH(b), v = volH(b, sc.h);\n        if (sc.h === 5) return '12 公分 ＝ 12 × 1 公分。' + '先算底面積';\n        var how = { rect:'長方形", "why": "a unit before an equals sign would sit inside the equation"},
    {"file": "index", "via": "index", "expect": "S1 case 0: the source comment says 61", "find": "{ base:{ shape:'rect', a:4, b:3 }, h:5 },   /* 底面積 12，疊 5 層 → 60 */", "replace": "{ base:{ shape:'rect', a:4, b:3 }, h:5 },   /* 底面積 12，疊 5 層 → 61 */", "why": "the case comment would state a volume the numbers do not give"},
    {"file": "index", "via": "index", "expect": "volH does not fail closed on {\"shape\":\"rect\",\"a\":2.5,\"b\":4}", "find": "if (b.shape === 'rect') return okLen(b.a) && okLen(b.b);", "replace": "if (b.shape === 'rect') return okLen(b.a) && okLen(b.b) || b.a === 2.5;", "why": "a half-centimetre side would flow into a volume"},
    {"file": "review", "via": "index", "expect": "review.html pickWrongs keeps", "find": "      if (shown[v]) return;\n      shown[v] = 1;", "replace": "      if (shown[v] && false) return;\n      shown[v] = 1;", "why": "the dedup line would still be there, but dead — only running pickWrongs sees it"}
  ]
};
