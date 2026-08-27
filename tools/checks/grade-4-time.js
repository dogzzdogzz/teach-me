/* grade-4/math/time（24 時制，以及日、時、分、秒的複名數加減）的檢查設定。

   範圍取自課程自己說的話（四頁都對讀者講了同一件事）：
   看鐘面說幾點幾分是二年級的「時間小管家」；同一天之內的時刻加減是三年級的
   「時間偵察兵」；時間量的乘除與小數時間是五年級的「時間管理局」。
   這一課只做 24 時制的時刻，以及日／時／分／秒的整數複名數加減。

   這一課有六個守門重點：

   ① **12 時制 ↔ 24 時制必須是一個雙射，而且要對整個定義域驗。**
      「下午加 12」聽起來像規則，可是中午 12 點加 12 會變成 24 時、半夜 12 點是 0 時
      不是 12 時。這裡有一張**逐格寫死的真值表**（0~23 每一個小時該怎麼說），
      read12 對 0~23 每一格都要對得上，to24 對每一個合法的（時段, 鐘點）都要反得回去。

   ② **「每一級的滿數不一樣」也要對整個定義域驗。**
      「時間都是 60 進位」是這一課最大的迷思。階梯表（日24／時60／分60）在設定檔裡
      獨立寫一份，`toSmallest`／`fromSmallest` 要互為反函數、`addSteps`／`subSteps`
      的總量要守恆，而且**借過來的 1 一定等於那一級自己的滿數**（不是一律 60）。

   ③ **選項要比「換算成同一個最小單位之後的值」，不是比字串。**
      「3 小時 75 分」和「4 小時 15 分」字串不同、長度卻一樣 —— 兩個都放進選項，
      孩子算對也會被判錯（§六之二）。所以每一個選項都解析回值再兩兩比一次。

   ④ **選項的形狀本身就是斷言。** 解析出來之後**再用設定檔自己的格式化函式印回去**，
      必須逐字相同 —— 這樣英文的單複數（1 hour ／ 2 hours）、補零（07:05）、
      多餘的空白都一起被驗到了，不需要另外寫規則。

   ⑤ **時間軸的四個方向都要驗。**（rounding 那一輪的教訓：只驗左右等於沒驗）
      版面常數由課程的資料區匯出，標籤的寬度用**字典裡真正會印出來的字串**估。

   ⑥ **題幹問的是什麼要單獨驗一次。** 只驗數字的話，把 `clockDiff` 的題幹改成問
      「再過多久是幾時幾分」、正解還是時間量，所有數字檢查都還是綠的。 */

const fs = require('fs');
const path = require('path');

/* ---- 這一課自己的常數（第二套來源，不從課程讀） ---- */
const SEC_PER_MIN = 60;
const MIN_PER_HOUR = 60;
const HOUR_PER_DAY = 24;
const MIN_PER_DAY = MIN_PER_HOUR * HOUR_PER_DAY;   // 1440
const NOON_SHIFT = 12;

/* 單位階梯：一個大單位裡有幾個小單位。**逐行寫死**，不從課程算。 */
const CHAIN = ['day', 'hour', 'min', 'sec'];
const FULL = { hour:HOUR_PER_DAY, min:MIN_PER_HOUR, sec:SEC_PER_MIN };
const BIG_OF = { hour:'day', min:'hour', sec:'min' };
function fullRef(small){
  return Object.prototype.hasOwnProperty.call(FULL, small) ? FULL[small] : null;
}
/* 1 個 unit 等於幾個 target（target 一定要在 unit 下面或等於它）。 */
function factorRef(unit, target){
  const i = CHAIN.indexOf(unit), j = CHAIN.indexOf(target);
  if (i < 0 || j < 0 || i > j) return null;
  let f = 1;
  for (let k = i + 1; k <= j; k++) f *= fullRef(CHAIN[k]);
  return f;
}
function toSmallRef(units, vals){
  const target = units[units.length - 1];
  let t = 0;
  for (let i = 0; i < units.length; i++){
    const f = factorRef(units[i], target);
    if (f === null) return null;
    t += vals[i] * f;
  }
  return t;
}
function fromSmallRef(units, total){
  const out = new Array(units.length);
  let rest = total;
  for (let i = units.length - 1; i >= 1; i--){
    const f = fullRef(units[i]);
    out[i] = rest % f;
    rest = Math.floor(rest / f);
  }
  out[0] = rest;
  return out;
}
/* 印出來的時候，是 0 的那一級不印（沒有人說「3 日 0 小時」）；全是 0 就只印最小的。 */
function keepRef(units, vals){
  const keep = [];
  for (let i = 0; i < units.length; i++) if (vals[i] !== 0) keep.push(i);
  return keep.length ? keep : [units.length - 1];
}
/* 相加／相減的第二套實作：直接在最小單位上算，完全不看「進位／借位」那一套寫法。
   拿課程自己的 addSteps 當標準答案等於自己比自己。 */
function addRef(units, a, b){
  return fromSmallRef(units, toSmallRef(units, a) + toSmallRef(units, b));
}
function subRef(units, a, b){
  return fromSmallRef(units, toSmallRef(units, a) - toSmallRef(units, b));
}

/* ---- 24 時制的真值表：0~23 每一個小時該怎麼說，逐格寫死 ---- */
const READ_TABLE = {
  0:['midnight', 12],
  1:['am', 1], 2:['am', 2], 3:['am', 3], 4:['am', 4], 5:['am', 5], 6:['am', 6],
  7:['am', 7], 8:['am', 8], 9:['am', 9], 10:['am', 10], 11:['am', 11],
  12:['noon', 12],
  13:['pm', 1], 14:['pm', 2], 15:['pm', 3], 16:['pm', 4], 17:['pm', 5], 18:['pm', 6],
  19:['pm', 7], 20:['pm', 8], 21:['pm', 9], 22:['pm', 10], 23:['pm', 11]
};
const PERIOD_ORDER_REF = ['midnight', 'am', 'noon', 'pm'];

/* ---- 字典的真值表（第二套來源）＋ 第二套格式化函式 ----
   解析選項之後**再用這些函式印回去**逐字比對，英文單複數與補零就一起被驗到了。 */
const UNIT_NAME = {
  zh:{ day:'日', hour:'小時', min:'分', sec:'秒' },
  en:{ day:'day', hour:'hour', min:'minute', sec:'second' }
};
const PERIOD_NAME = {
  zh:{ midnight:'半夜', am:'上午', noon:'中午', pm:'下午' },
  en:{ midnight:'a.m.', am:'a.m.', noon:'p.m.', pm:'p.m.' }
};
const DAY_TAG = { zh:['今天', '隔天'], en:['today', 'the next day'] };
function pad2Ref(n){ return (n < 10 ? '0' : '') + n; }
function clock24Ref(lang, h, m){
  return (lang === 'zh') ? (h + ' 時 ' + m + ' 分') : (pad2Ref(h) + ':' + pad2Ref(m));
}
function hour24Ref(lang, h){
  return (lang === 'zh') ? (h + ' 時') : (pad2Ref(h) + ':00');
}
function clock12Ref(lang, period, h12, m){
  return (lang === 'zh')
    ? PERIOD_NAME.zh[period] + ' ' + h12 + ' 點 ' + m + ' 分'
    : h12 + ':' + pad2Ref(m) + ' ' + PERIOD_NAME.en[period];
}
function hour12Ref(lang, period, h12){
  return (lang === 'zh') ? PERIOD_NAME.zh[period] + ' ' + h12 + ' 點'
                         : h12 + ' ' + PERIOD_NAME.en[period];
}
function clockDayRef(lang, day, h, m){
  return (lang === 'zh') ? DAY_TAG.zh[day] + ' ' + clock24Ref('zh', h, m)
                         : clock24Ref('en', h, m) + ' ' + DAY_TAG.en[day];
}
function durRef(lang, units, vals){
  return keepRef(units, vals).map(function(i){
    return (lang === 'zh')
      ? vals[i] + ' ' + UNIT_NAME.zh[units[i]]
      : vals[i] + ' ' + UNIT_NAME.en[units[i]] + (vals[i] === 1 ? '' : 's');
  }).join(' ');
}

/* ---- 選項的解析器 ----
   四種形狀：時刻（clock）、12 時制的說法（read）、帶今天／隔天的時刻（stamp）、
   時間量（dur）。形狀不對就回 null —— 形狀本身就是斷言。 */
const ZH_TO_PERIOD = { '半夜':'midnight', '上午':'am', '中午':'noon', '下午':'pm' };
const ZH_TO_UNIT = { '日':'day', '小時':'hour', '分':'min', '秒':'sec' };
const EN_TO_UNIT = { day:'day', hour:'hour', minute:'min', second:'sec' };

function parseDur(str, lang){
  const units = [], vals = [];
  const re = (lang === 'zh') ? /(\d+) (日|小時|分|秒)/g : /(\d+) (day|hour|minute|second)s?/g;
  const map = (lang === 'zh') ? ZH_TO_UNIT : EN_TO_UNIT;
  let m, at = 0;
  while ((m = re.exec(str)) !== null){
    if (m.index !== at) return null;                 // 中間夾了別的字
    units.push(map[m[2]]); vals.push(Number(m[1]));
    at = m.index + m[0].length;
    if (str[at] === ' ') at++;
  }
  if (at !== str.length || !units.length) return null;
  return { kind:'dur', units:units, vals:vals };
}
function parseOpt(s, lang){
  const str = String(s);
  if (lang === 'zh'){
    let m = /^(今天|隔天) (\d+) 時 (\d+) 分$/.exec(str);
    if (m) return { kind:'stamp', day:(m[1] === '今天' ? 0 : 1), h:Number(m[2]), min:Number(m[3]) };
    m = /^(半夜|上午|中午|下午) (\d+) 點 (\d+) 分$/.exec(str);
    if (m) return { kind:'read', period:ZH_TO_PERIOD[m[1]], h12:Number(m[2]), min:Number(m[3]) };
    m = /^(\d+) 時 (\d+) 分$/.exec(str);
    if (m) return { kind:'clock', h:Number(m[1]), min:Number(m[2]) };
    return parseDur(str, 'zh');
  }
  let m = /^(\d{2}):(\d{2}) (today|the next day)$/.exec(str);
  if (m) return { kind:'stamp', day:(m[3] === 'today' ? 0 : 1), h:Number(m[1]), min:Number(m[2]) };
  m = /^(\d+):(\d{2}) (a\.m\.|p\.m\.)$/.exec(str);
  if (m) return { kind:'read', period:(m[3] === 'a.m.' ? 'am' : 'pm'), h12:Number(m[1]), min:Number(m[2]) };
  m = /^(\d{2}):(\d{2})$/.exec(str);
  if (m) return { kind:'clock', h:Number(m[1]), min:Number(m[2]) };
  return parseDur(str, 'en');
}
/* 解析出來之後印回去，必須逐字相同。 */
function reprint(p, lang){
  if (!p) return null;
  if (p.kind === 'clock') return clock24Ref(lang, p.h, p.min);
  if (p.kind === 'stamp') return clockDayRef(lang, p.day, p.h, p.min);
  if (p.kind === 'read') return clock12Ref(lang, p.period, p.h12, p.min);
  return durRef(lang, p.units, p.vals);
}
/* 一個選項換算成指定最小單位之後的值（跨兩種寫法比值就靠這一個）。 */
function optValue(p, target){
  if (!p) return null;
  if (p.kind === 'clock') return p.h * MIN_PER_HOUR + p.min;
  if (p.kind === 'stamp') return p.day * MIN_PER_DAY + p.h * MIN_PER_HOUR + p.min;
  if (p.kind === 'read'){
    const h24 = (p.period === 'midnight') ? 0
              : (p.period === 'noon') ? NOON_SHIFT
              : (p.period === 'am') ? p.h12 : p.h12 + NOON_SHIFT;
    return h24 * MIN_PER_HOUR + p.min;
  }
  let t = 0;
  for (let i = 0; i < p.units.length; i++){
    const f = factorRef(p.units[i], target);
    if (f === null) return null;
    t += p.vals[i] * f;
  }
  return t;
}

/* ---- 產生器的參數池（和 review.html 的宣告同一份，範圍由它們算出來） ---- */
function rangeRef(lo, hi){
  const out = [];
  for (let v = lo; v <= hi; v++) out.push(v);
  return out;
}
const H12_POOL = rangeRef(1, 11);
const MIN_POOL = rangeRef(1, 59);
const H24_PM_POOL = rangeRef(13, 23);
const DH_D_POOL = rangeRef(2, 6);
const DH_H_POOL = rangeRef(1, 23);
const HM_H_POOL = rangeRef(1, 5);
const HM_M_POOL = rangeRef(1, 59);
const MS_M_POOL = rangeRef(1, 5);
const MS_S_POOL = rangeRef(1, 59);
const ADD_BIG_POOL = rangeRef(2, 5);
const SUB_BIG_POOL = rangeRef(3, 6);
const CLOCK_H_POOL = rangeRef(6, 23);
const CLOCK_ADD_H = rangeRef(1, 4);
const DIFF_FROM_H = rangeRef(6, 11);
const DIFF_TO_H = rangeRef(13, 22);

/* review.html 應該有的十二個產生器。少了一個，simgen 只會少跑那一支的檢查 ——
   「檢查沒跑」和「檢查通過」在輸出上長得一模一樣。 */
const GEN_IDS = ['to24', 'to12', 'dayToHour', 'hourToDay', 'hourToMin', 'minToSec',
                 'addHM', 'addMS', 'subHM', 'subDH', 'clockAdd', 'clockDiff'];

/* 上界一律從參數池與**具名誘答的算式**推出來，不是隨手給一個大數
   （codex 第二輪：addHM 的具名誘答最大 718，卻放行到 800 —— 一個 799 分的
   保底數字就進得來，形狀、去重、範圍全綠）。 */
function ADD_MAX(full){
  const ab = ADD_BIG_POOL[ADD_BIG_POOL.length - 1];
  return (ab + (ab - 1)) * full + (full + 58) + full;
}
function SUB_MAX(full){
  const ab = SUB_BIG_POOL[SUB_BIG_POOL.length - 1];
  return (ab + (ab - 2)) * full + Math.floor(full / 2) + (full - 1);
}
function DIFF_MAX(){
  const th = DIFF_TO_H[DIFF_TO_H.length - 1], fh = DIFF_FROM_H[0];
  const naive = (th - fh) * MIN_PER_HOUR + 58;
  const plus = (th * MIN_PER_HOUR + 58) - (fh * MIN_PER_HOUR + 20) + MIN_PER_HOUR;
  return Math.max(naive, plus);
}

/* 每一支產生器的選項長什麼形狀、換算成哪一個最小單位、值落在哪裡。 */
const OPT_SHAPE = {
  to24:      { kind:'clock', target:'min', range:[1, MIN_PER_DAY - 1] },
  /* 「忘了減 12」那個誘答會印成「下午 23 點」，換算回來是 35 時 —— 上界要蓋得住它。 */
  to12:      { kind:'read',  target:'min', range:[1, 36 * MIN_PER_HOUR - 1] },   // 「忘了減 12」→ 35 時 59 分
  clockAdd:  { kind:'stamp', target:'min', range:[1, 2 * MIN_PER_DAY - 1] },
  /* 「用 60 去乘」那個誘答最大到 6 × 60 ＋ 23，上界要蓋得住它。 */
  dayToHour: { kind:'dur', units:['hour'], target:'hour',
               range:[1, DH_D_POOL[DH_D_POOL.length - 1] * MIN_PER_HOUR + DH_H_POOL[DH_H_POOL.length - 1]] },
  /* 最大的具名誘答是 [d0 + 1, r]。 */
  hourToDay: { kind:'dur', units:['day', 'hour'], target:'hour',
               range:[1, (DH_D_POOL[DH_D_POOL.length - 1] + 1) * HOUR_PER_DAY +
                         DH_H_POOL[DH_H_POOL.length - 1]] },
  /* 上界從參數池算出來：最大的總量再加一個滿數（保底的候選之一）。 */
  hourToMin: { kind:'dur', units:['min'], target:'min',
               range:[1, HM_H_POOL[HM_H_POOL.length - 1] * MIN_PER_HOUR + (MIN_PER_HOUR - 1) + MIN_PER_HOUR] },
  minToSec:  { kind:'dur', units:['sec'], target:'sec',
               range:[1, MS_M_POOL[MS_M_POOL.length - 1] * SEC_PER_MIN + (SEC_PER_MIN - 1) + SEC_PER_MIN] },
  /* 相加最大的具名誘答是「忘了扣掉滿數」：(ab + bb) × 滿數 ＋ raw ＋ 滿數。 */
  addHM:     { kind:'dur', units:['hour', 'min'], target:'min', range:[1, ADD_MAX(MIN_PER_HOUR)] },
  addMS:     { kind:'dur', units:['min', 'sec'], target:'sec', range:[1, ADD_MAX(SEC_PER_MIN)] },
  /* 相減最大的具名誘答是「相加而不是相減」：(ab + bb) × 滿數 ＋ as ＋ bs。 */
  subHM:     { kind:'dur', units:['hour', 'min'], target:'min', range:[1, SUB_MAX(MIN_PER_HOUR)] },
  subDH:     { kind:'dur', units:['day', 'hour'], target:'hour', range:[1, SUB_MAX(HOUR_PER_DAY)] },
  /* 最大的是「分反過來減」與「多算一小時」中的較大者。 */
  clockDiff: { kind:'dur', units:['hour', 'min'], target:'min', range:[1, DIFF_MAX()] }
};

/* 每一支產生器「問的是什麼」。少了這一張表，把 clockDiff 的題幹改成問「是幾時幾分」、
   正解卻還是時間量，所有數字檢查都還是綠的。 */
const ASK = {
  to24:      { zh:['24 時制'], zhNot:['多久'], en:['24-hour clock'], enNot:['how long'] },
  to12:      { zh:['12 時制'], zhNot:['多久'], en:['12-hour clock'], enNot:['how long'] },
  dayToHour: { zh:['是幾小時'], zhNot:['幾日幾小時'], en:['How many hours'], enNot:['days and hours'] },
  hourToDay: { zh:['是幾日幾小時'], zhNot:['是幾分'], en:['how many days and hours'], enNot:['How many minutes'] },
  hourToMin: { zh:['是幾分'], zhNot:['幾秒'], en:['How many minutes'], enNot:['seconds are'] },
  minToSec:  { zh:['是幾秒'], zhNot:['幾小時'], en:['How many seconds'], enNot:['hours are'] },
  addHM:     { zh:['＋', '是多久'], zhNot:['－'], en:['+', 'how long'], enNot:['−'] },
  addMS:     { zh:['＋', '是多久'], zhNot:['－'], en:['+', 'how long'], enNot:['−'] },
  subHM:     { zh:['－', '是多久'], zhNot:['＋'], en:['−', 'how long'], enNot:['+'] },
  subDH:     { zh:['－', '是多久'], zhNot:['＋'], en:['−', 'how long'], enNot:['+'] },
  clockAdd:  { zh:['再過', '是幾時幾分'], zhNot:['一共經過多久'],
               en:['go by', 'What time is it then'], enNot:['how long is that'] },
  clockDiff: { zh:['一共經過多久'], zhNot:['再過'], en:['how long is that'], enNot:['go by'] }
};

/* 負數的寫法：負號**緊貼**數字，而且前面不是數字或字母。
   要含真減號、全形與小型全形；不可以放進 en dash／em dash（那是這幾頁的標點），
   也不可以允許中間有空白（「29 － 20」是這一課自己的減法算式）。 */
const NEG = /(^|[^0-9A-Za-z])[-−－﹣][0-9]/;

/* 數字要比「整個 token」的值：子字串比對會把 5 認在 15 裡面，
   而 '05' 和 '5' 是同一個數（英文的補零）。 */
/* 去標籤要**認得引號**：`<[^>]+>` 會在屬性值裡的第一個 `>` 就收尾，於是
   `<span title=">21 時 40 分">` 的屬性文字會漏進「畫面上的字」裡，
   讓題幹的斷言被一段孩子看不到的字滿足（codex 第二輪）。 */
function stripTags(html){
  return String(html).replace(/<[^>"']*(?:(?:"[^"]*"|'[^']*')[^>"']*)*>/g, ' ');
}
/* 英文把數字接在單位前面就有單複數問題，而 1 是唯一會出錯的那一個值 ——
   「1 hours」「1 minutes are left」這一類，資料層全對、模擬全綠，只有把句子印出來
   才看得到（codex 第二輪在產生器的解釋裡抓到四處）。 */
const BAD_PLURAL = /\b1 (day|hour|minute|second)s\b/;
function pluralProblem(txt, lang){
  if (lang !== 'en') return null;
  const m = BAD_PLURAL.exec(String(txt));
  return m ? ('says "' + m[0] + '" — 1 takes the singular') : null;
}
function numTokens(text){
  return (String(text).match(/\d+/g) || []).map(Number);
}
function printsNum(text, v){ return numTokens(text).indexOf(Number(v)) >= 0; }
function sortedNums(arr){
  return arr.map(Number).slice().sort(function(a, b){ return a - b; }).join(',');
}

function invAdd(d, units, id){
  const full = fullRef(units[1]);
  if (!d.units || d.units.join('/') !== units.join('/')) return id + ': the units are ' + d.units + ', expected ' + units;
  if (ADD_BIG_POOL.indexOf(d.a[0]) < 0) return id + ': the first big value is outside the declared pool';
  if (!(d.b[0] >= 1 && d.b[0] < d.a[0])) return id + ': the second big value is not smaller than the first';
  if (!(d.a[1] >= 31 && d.a[1] <= full - 1)) return id + ': the first small value is outside 31~' + (full - 1);
  if (!(d.b[1] >= 2 && d.b[1] < d.a[1])) return id + ': the second small value is not below the first';
  if (d.raw !== d.a[1] + d.b[1]) return id + ': raw is not the two small values added';
  if (!(d.raw >= full + 2 && d.raw <= full + 58))
    return id + ': the small values add to ' + d.raw + ', which does not carry with a remainder of at least 2';
  const want = addRef(units, d.a, d.b);
  if (d.correct[0] !== want[0] || d.correct[1] !== want[1])
    return id + ': the marked answer is not the sum (' + d.correct + ' vs ' + want + ')';
  /* 兩個有名字的錯法都要真的在選項裡。 */
  const vals = d.opts.map(v => toSmallRef(units, v));
  const C = toSmallRef(units, want);
  if (vals.indexOf(C - full) < 0) return id + ' does not offer the forgot-the-carry distractor';
  if (vals.indexOf(C + full) < 0) return id + ' does not offer the forgot-to-take-the-full-number-off distractor';
}

function invSub(d, units, id){
  const full = fullRef(units[1]);
  if (!d.units || d.units.join('/') !== units.join('/')) return id + ': the units are ' + d.units + ', expected ' + units;
  if (SUB_BIG_POOL.indexOf(d.a[0]) < 0) return id + ': the first big value is outside the declared pool';
  if (!(d.b[0] >= 1 && d.b[0] <= d.a[0] - 2)) return id + ': the borrow would leave nothing on the top rung';
  if (!(d.a[1] >= 1 && d.a[1] <= Math.floor(full / 2))) return id + ': the first small value is outside 1~' + Math.floor(full / 2);
  if (!(d.b[1] > d.a[1] && d.b[1] <= full - 1)) return id + ': the small rung does not need a borrow';
  if (d.full !== full) return id + ': the borrow is worth ' + d.full + ', independently ' + full;
  const want = subRef(units, d.a, d.b);
  if (d.correct[0] !== want[0] || d.correct[1] !== want[1])
    return id + ': the marked answer is not the difference (' + d.correct + ' vs ' + want + ')';
  const vals = d.opts.map(v => toSmallRef(units, v));
  const C = toSmallRef(units, want);
  if (vals.indexOf(C + full) < 0) return id + ' does not offer the forgot-to-pay-the-borrow-back distractor';
  /* 日時那一支一定要放「借了 60」那個誘答 —— 這一課最貴的迷思。
     時分的滿數本來就是 60，那個候選會等於正解，所以只在滿數不是 60 的那一級要求它。 */
  if (full !== MIN_PER_HOUR && vals.indexOf(C + (MIN_PER_HOUR - full)) < 0)
    return id + ' does not offer the borrowed-60-instead-of-' + full + ' distractor';
}

module.exports = {
  breaks: [
    /* ---------- index.html：常數與階梯 ---------- */
    { file:'index', expect:'a day is not base 60', via:'index',
      find:'  var HOUR_PER_DAY = 24;', replace:'  var HOUR_PER_DAY = 60;' },
    { file:'index', expect:'1 minute is 100 seconds', via:'index',
      find:'  var SEC_PER_MIN = 60;', replace:'  var SEC_PER_MIN = 100;' },
    { file:'index', expect:'says hour fills up at 60, independently 24', via:'index',
      find:"    { small:'hour', big:'day',  full:HOUR_PER_DAY },",
      replace:"    { small:'hour', big:'day',  full:MIN_PER_HOUR }," },
    { file:'index', expect:'says min carries into day, independently hour', via:'index',
      find:"    { small:'min',  big:'hour', full:MIN_PER_HOUR },",
      replace:"    { small:'min',  big:'day', full:MIN_PER_HOUR }," },
    { file:'index', expect:'but the top rung has no full number', via:'index',
      find:"    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].small === small) return STEPS[i].full;\n    return null;   // 'day' 是最上面一級，沒有滿數",
      replace:"    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].small === small) return STEPS[i].full;\n    return 60;   // 'day' 是最上面一級，沒有滿數" },
    { file:'index', expect:'the step between day and hour is 24', via:'index',
      find:'    for (var i = 1; i < units.length; i++) t = t * fullOf(units[i]) + vals[i];',
      replace:'    for (var i = 1; i < units.length; i++) t = t * MIN_PER_HOUR + vals[i];' },
    { file:'index', expect:'the quotient is the bigger unit and the remainder is the smaller one', via:'index',
      find:'      out[i] = rest % f;\n      rest = Math.floor(rest / f);',
      replace:'      out[i] = Math.floor(rest / f);\n      rest = rest % f;' },
    { file:'index', expect:'keepLevels(day/hour, 3,0)', via:'index',
      find:'    for (var i = 0; i < units.length; i++) if (vals[i] !== 0) keep.push(i);\n    if (!keep.length) keep = [units.length - 1];\n    return keep;\n  }\n\n  /* 相加',
      replace:'    for (var i = 0; i < units.length; i++) keep.push(i);\n    if (!keep.length) keep = [units.length - 1];\n    return keep;\n  }\n\n  /* 相加' },
    /* day/hour 是掃描的第一組，所以先響的是那一級。 */
    { file:'index', expect:'the hour rung carries at 24', via:'index',
      find:'      var out = (f === null) ? raw : raw % f;\n      var up = (f === null) ? 0 : Math.floor(raw / f);',
      replace:'      var out = (f === null) ? raw : raw % MIN_PER_HOUR;\n      var up = (f === null) ? 0 : Math.floor(raw / MIN_PER_HOUR);' },
    /* ★ 這一課最貴的迷思：借過來的 1 一律當成 60。 */
    { file:'index', expect:'borrowing 1 day has to give 24 hour, not always 60', via:'index',
      find:'      var val = need ? top + f : top;',
      replace:'      var val = need ? top + MIN_PER_HOUR : top;' },
    /* 只動「有沒有借」這個旗標，算術照舊 —— 不然總量守恆那一條會先響。 */
    { file:'index', expect:'borrowed=0, but', via:'index',
      find:'borrowIn:borrow, borrowed:need ? 1 : 0,',
      replace:'borrowIn:borrow, borrowed:0,' },

    /* ---------- index.html：12 時制 ↔ 24 時制 ---------- */
    { file:'index', expect:'the two directions have to be inverses', via:'index',
      find:"    if (period === 'pm') return h12 + NOON_SHIFT;",
      replace:"    if (period === 'pm') return h12 + NOON_SHIFT + 1;" },
    { file:'index', expect:'adding 12 to noon would give 24', via:'index',
      find:"    if (period === 'noon') return NOON_SHIFT;",
      replace:"    if (period === 'noon') return NOON_SHIFT + NOON_SHIFT;" },
    { file:'index', expect:'midnight starts the day, it is not 12', via:'index',
      find:"    if (period === 'midnight') return 0;\n    if (period === 'am') return h12;",
      replace:"    if (period === 'midnight') return NOON_SHIFT;\n    if (period === 'am') return h12;" },
    { file:'index', expect:'the truth table says noon 12', via:'index',
      find:"    if (h24 < NOON_SHIFT) return { period:'am', h12:h24 };",
      replace:"    if (h24 <= NOON_SHIFT) return { period:'am', h12:h24 };" },
    { file:'index', expect:"h12Range('am')", via:'index',
      find:"    return (period === 'midnight' || period === 'noon') ? [12, 12] : [1, 11];",
      replace:"    return (period === 'midnight' || period === 'noon') ? [12, 12] : [1, 12];" },
    { file:'index', expect:'pad2(', via:'index',
      find:"  function pad2(n){ return (n < 10 ? '0' : '') + n; }",
      replace:"  function pad2(n){ return '' + n; }" },

    /* ---------- index.html：字典的單位詞與格式化函式 ---------- */
    { file:'index', expect:'the unit table says "小時"', via:'index',
      find:"      unitName:{ day:'日', hour:'小時', min:'分', sec:'秒' },",
      replace:"      unitName:{ day:'日', hour:'時', min:'分', sec:'秒' }," },
    { file:'index', expect:'the period table says "半夜"', via:'index',
      find:"      periodName:{ midnight:'半夜', am:'上午', noon:'中午', pm:'下午' },",
      replace:"      periodName:{ midnight:'凌晨', am:'上午', noon:'中午', pm:'下午' }," },
    { file:'index', expect:'the table says 今天,隔天', via:'index',
      find:"      dayTag:['今天', '隔天'],",
      replace:"      dayTag:['今天', '明天']," },
    { file:'index', expect:'zh.clock24(', via:'index',
      find:"      clock24: function(h, m){ return h + ' 時 ' + m + ' 分'; },",
      replace:"      clock24: function(h, m){ return h + ' 點 ' + m + ' 分'; }," },
    { file:'index', expect:'en.clock24(', via:'index',
      find:"      clock24: function(h, m){ return pad2(h) + ':' + pad2(m); },",
      replace:"      clock24: function(h, m){ return h + ':' + pad2(m); }," },
    /* 英文的單複數：1 hour ／ 2 hours。 */
    { file:'index', expect:'en.dur(', via:'index',
      find:"          return vals[i] + ' ' + self.unitName[units[i]] + (vals[i] === 1 ? '' : 's');",
      replace:"          return vals[i] + ' ' + self.unitName[units[i]] + 's';" },
    { file:'index', expect:'en.hour12(', via:'index',
      find:"      hour12: function(period, h12){ return h12 + ' ' + this.periodName[period]; },",
      replace:"      hour12: function(period, h12){ return this.periodName[period] + ' ' + h12; }," },
    { file:'index', expect:'en.clockDay(', via:'index',
      find:"      clockDay: function(day, h, m){ return this.clock24(h, m) + ' ' + this.dayTag[day]; },",
      replace:"      clockDay: function(day, h, m){ return this.dayTag[day] + ' ' + this.clock24(h, m); }," },

    /* ---------- index.html：時間軸的四個方向 ---------- */
    { file:'index', expect:'below the bottom of the', via:'index',
      find:'  var DL_W = 520, DL_H = 132;', replace:'  var DL_W = 520, DL_H = 100;' },
    { file:'index', expect:'above the top of the canvas', via:'index',
      find:'  var DL_Y = 62;                    // 主線的 y',
      replace:'  var DL_Y = 20;                    // 主線的 y' },
    { file:'index', expect:'off the right edge of the', via:'index',
      find:'  var DL_X0 = 44, DL_X1 = 476;      // 0 時與 24 時的 x',
      replace:'  var DL_X0 = 44, DL_X1 = 560;      // 0 時與 24 時的 x' },
    { file:'index', expect:'would run off the left edge', via:'index',
      find:'  var DL_X0 = 44, DL_X1 = 476;      // 0 時與 24 時的 x\n  var DL_Y = 62;',
      replace:'  var DL_X0 = 2, DL_X1 = 476;      // 0 時與 24 時的 x\n  var DL_Y = 62;' },
    /* 12 時制那一排標籤太密就會擠成一團 —— angle 那一輪的教訓。 */
    { file:'index', expect:'overlap:', via:'index',
      find:'  var DL_READ_HOURS = [0, 6, 12, 18, 24];',
      replace:'  var DL_READ_HOURS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];' },
    { file:'index', expect:'minX is not strictly increasing', via:'index',
      find:'  function minX(t){ return DL_X0 + (DL_X1 - DL_X0) * t / MIN_PER_DAY; }',
      replace:'  function minX(t){ return DL_X0 + (DL_X1 - DL_X0) * Math.floor(t / 120) * 120 / MIN_PER_DAY; }' },
    { file:'index', expect:'dlTicks() draws', via:'index',
      find:'    for (var h = 0; h <= HOUR_PER_DAY; h++){\n      var big = DL_NUM_HOURS.indexOf(h) >= 0;',
      replace:'    for (var h = 0; h < HOUR_PER_DAY; h++){\n      var big = DL_NUM_HOURS.indexOf(h) >= 0;' },
    { file:'index', expect:'not the declared tick length', via:'index',
      find:'      out.push({ h:h, x:hourX(h), y1:DL_Y, y2:DL_Y + (big ? DL_TICK_BIG : DL_TICK), big:big });',
      replace:'      out.push({ h:h, x:hourX(h), y1:DL_Y, y2:DL_Y + DL_TICK, big:big });' },
    { file:'index', expect:'is not centred on its tick', via:'index',
      find:'    return DL_NUM_HOURS.map(function(h){ return { h:h, x:hourX(h), y:DL_Y + DL_NUM_DY }; });',
      replace:'    return DL_NUM_HOURS.map(function(h){ return { h:h, x:hourX(h) + 3, y:DL_Y + DL_NUM_DY }; });' },
    { file:'index', expect:'the truth table says', via:'index',
      find:'      return { h:h, x:hourX(h), y:DL_Y - DL_READ_DY, read:read12(h % HOUR_PER_DAY) };',
      replace:'      return { h:h, x:hourX(h), y:DL_Y - DL_READ_DY, read:read12((h + 1) % HOUR_PER_DAY) };' },
    { file:'index', expect:'not in the middle of its half', via:'index',
      find:"  var DL_PERIOD_MID = [{ key:'am', hour:6 }, { key:'pm', hour:18 }];",
      replace:"  var DL_PERIOD_MID = [{ key:'am', hour:5 }, { key:'pm', hour:18 }];" },
    { file:'index', expect:'expected am,pm (morning first)', via:'index',
      find:"  var DL_PERIOD_MID = [{ key:'am', hour:6 }, { key:'pm', hour:18 }];\n",
      replace:"  var DL_PERIOD_MID = [{ key:'pm', hour:18 }, { key:'am', hour:6 }];\n" },
    { file:'index', expect:'does not use the declared mark height', via:'index',
      find:'    return { t:t, x:minX(t), y1:DL_Y - DL_MARK_H, y2:DL_Y + DL_MARK_H, cy:DL_Y, r:DL_MARK_R };',
      replace:'    return { t:t, x:minX(t), y1:DL_Y - DL_MARK_H, y2:DL_Y + DL_MARK_H + 4, cy:DL_Y, r:DL_MARK_R };' },
    /* 色塊必須剛好蓋住那一段時間量 —— divide 那一輪的教訓（配角也會被切掉）。 */
    { file:'index', expect:'the coloured pieces have to add up to exactly the time that goes by', via:'index',
      find:'      var to = Math.min(MIN_PER_DAY, from + left);',
      replace:'      var to = Math.min(MIN_PER_DAY, from + left + 1);' },
    { file:'index', expect:'reads as a line rather than a stretch of time', via:'index',
      find:'  var DL_BAND_H = 13;', replace:'  var DL_BAND_H = 3;' },
    { file:'index', expect:'too thin to read as a stretch of time', via:'index',
      find:'    { start:[9, 15],  add:[0, 40] },   // 9 時 55 分（分不用進位，時間量只有一級）',
      replace:'    { start:[23, 55],  add:[0, 10] },   // 9 時 55 分（分不用進位，時間量只有一級）' },
    { file:'index', expect:'is not drawn where minX puts it', via:'index',
      find:'                 x:minX(from), w:minX(to) - minX(from),',
      replace:'                 x:minX(from) + 2, w:minX(to) - minX(from),' },
    { file:'index', expect:'viewBox is', via:'index',
      find:'<svg class="dayfig" id="s1fig" viewBox="0 0 520 132"',
      replace:'<svg class="dayfig" id="s1fig" viewBox="0 0 520 140"' },
    { file:'index', expect:'.dayfig CSS height', via:'index',
      find:'  .dayfig{width:100%;max-width:520px;height:132px;display:block;margin:0 auto}',
      replace:'  .dayfig{width:100%;max-width:520px;height:120px;display:block;margin:0 auto}' },

    /* ---------- index.html：範例資料 ---------- */
    { file:'index', expect:'DAY_CASES never shows a noon time', via:'index',
      find:'  var DAY_CASES = [0, 7, 12, 15, 21, 23];',
      replace:'  var DAY_CASES = [0, 7, 13, 15, 21, 23];' },
    { file:'index', expect:'DAY_CASES never shows a midnight time', via:'index',
      find:'  var DAY_CASES = [0, 7, 12, 15, 21, 23];\n',
      replace:'  var DAY_CASES = [1, 7, 12, 15, 21, 23];\n' },
    { file:'index', expect:'divides exactly, so it never shows a remainder', via:'index',
      find:"    { units:['day', 'hour'], total:50  },   // 50 小時 ＝ 2 日 2 小時",
      replace:"    { units:['day', 'hour'], total:48  },   // 50 小時 ＝ 2 日 2 小時" },
    { file:'index', expect:'CONVERT_CASES never shows the min/sec pair', via:'index',
      find:"    { units:['min', 'sec'],  total:200 }    // 200 秒 ＝ 3 分 20 秒",
      replace:"    { units:['hour', 'min'],  total:200 }    // 200 秒 ＝ 3 分 20 秒" },
    { file:'index', expect:'does not carry, so the carry step has nothing to show', via:'index',
      find:"    { units:['hour', 'min'], a:[2, 45], b:[1, 30] },   // 75 分 → 進 1，剩 15",
      replace:"    { units:['hour', 'min'], a:[2, 15], b:[1, 30] },   // 75 分 → 進 1，剩 15" },
    { file:'index', expect:'ADD_CASES never uses the day/hour pair', via:'index',
      find:"    { units:['day', 'hour'], a:[2, 15], b:[1, 20] }    // 35 小時 → 滿 24 進 1，剩 11",
      replace:"    { units:['hour', 'min'], a:[2, 15], b:[1, 20] }    // 35 小時 → 滿 24 進 1，剩 11" },
    { file:'index', expect:'does not borrow, so the borrow step has nothing to show', via:'index',
      find:"    { units:['hour', 'min'], a:[3, 10], b:[1, 40] },   // 借 60 → 1 小時 30 分",
      replace:"    { units:['hour', 'min'], a:[3, 50], b:[1, 40] },   // 借 60 → 1 小時 30 分" },
    { file:'index', expect:'SUB_CASES never uses the day/hour pair', via:'index',
      find:"    { units:['day', 'hour'], a:[3, 5],  b:[1, 20] },   // 借 24 → 1 日 9 小時",
      replace:"    { units:['hour', 'min'], a:[3, 5],  b:[1, 20] },   // 借 24 → 1 日 9 小時" },
    /* 四筆全部跨午夜，而且每一段都還夠寬（不然「太細」那一條會先響）。 */
    { file:'index', expect:'CROSS_CASES never stays inside one day', via:'index',
      find:'    { start:[13, 50], add:[2, 25] },   // 16 時 15 分\n    { start:[22, 40], add:[1, 50] },   // 隔天 0 時 30 分\n    { start:[9, 15],  add:[0, 40] },   // 9 時 55 分（分不用進位，時間量只有一級）',
      replace:'    { start:[20, 40], add:[4, 50] },   // 16 時 15 分\n    { start:[22, 40], add:[1, 50] },   // 隔天 0 時 30 分\n    { start:[21, 15], add:[3, 40] },   // 9 時 55 分（分不用進位，時間量只有一級）' },
    { file:'index', expect:'CROSS_CASES never crosses midnight', via:'index',
      find:'    { start:[22, 40], add:[1, 50] },   // 隔天 0 時 30 分\n    { start:[9, 15],  add:[0, 40] },   // 9 時 55 分（分不用進位，時間量只有一級）\n    { start:[18, 30], add:[7, 20] }    // 隔天 1 時 50 分',
      replace:'    { start:[12, 40], add:[1, 50] },   // 隔天 0 時 30 分\n    { start:[9, 15],  add:[0, 40] },   // 9 時 55 分（分不用進位，時間量只有一級）\n    { start:[8, 30], add:[7, 20] }    // 隔天 1 時 50 分' },
    { file:'index', expect:'crossResult(', via:'index',
      find:'    var t = c.start[0] * MIN_PER_HOUR + c.start[1] + c.add[0] * MIN_PER_HOUR + c.add[1];\n    return { day:Math.floor(t / MIN_PER_DAY),',
      replace:'    var t = c.start[0] * MIN_PER_HOUR + c.start[1] + c.add[0] * MIN_PER_HOUR;\n    return { day:Math.floor(t / MIN_PER_DAY),' },

    /* ---------- index.html：遊戲的五關 ---------- */
    { file:'index', expect:'the marked option is worth', via:'index',
      find:"      opts:[{ h:4, m:20 }, { h:16, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:1 },",
      replace:"      opts:[{ h:4, m:20 }, { h:16, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:2 }," },
    { file:'index', expect:'does not offer the forgot-the-12 distractor', via:'index',
      find:"      opts:[{ h:4, m:20 }, { h:16, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:1 },\n",
      replace:"      opts:[{ h:14, m:20 }, { h:16, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:1 },\n" },
    { file:'index', expect:'does not offer the wrong-half-of-the-day distractor', via:'index',
      find:"      opts:[{ period:'pm', h12:9, m:5 }, { period:'am', h12:9, m:5 },",
      replace:"      opts:[{ period:'pm', h12:9, m:5 }, { period:'pm', h12:10, m:5 }," },
    { file:'index', expect:'is outside 13~23, so "take 12 off" is not the taught step', via:'index',
      find:"    { kind:'to12', h24:21, m:5,", replace:"    { kind:'to12', h24:11, m:5," },
    { file:'index', expect:'does not offer the right time on the wrong day as a distractor', via:'index',
      find:"      opts:[{ day:1, h:0, m:30 }, { day:0, h:0, m:30 },",
      replace:"      opts:[{ day:1, h:0, m:30 }, { day:1, h:3, m:30 }," },
    { file:'index', expect:'does not offer the reversed-minutes distractor', via:'index',
      find:"      opts:[{ h:5, m:15 }, { h:4, m:45 }, { h:5, m:45 }, { h:4, m:15 }], ans:1 }",
      replace:"      opts:[{ h:5, m:16 }, { h:4, m:45 }, { h:5, m:45 }, { h:4, m:15 }], ans:1 }" },
    { file:'index', expect:'the minutes do not need a borrow, so this round does not train the taught step', via:'index',
      find:"    { kind:'diff', from:[9, 40], to:[14, 25],",
      replace:"    { kind:'diff', from:[9, 20], to:[14, 25]," },
    { file:'index', expect:'roundAnswer says', via:'index',
      find:"    if (r.kind === 'to24') return { h:to24(r.period, r.h12), m:r.m };",
      replace:"    if (r.kind === 'to24') return { h:r.h12, m:r.m };" },
    { file:'index', expect:'the time line marks the answer, which gives it away', via:'index',
      find:"    if (r.kind === 'add') return [r.start[0] * MIN_PER_HOUR + r.start[1]];",
      replace:"    if (r.kind === 'add') return [roundAnswer(r).h * MIN_PER_HOUR + roundAnswer(r).m];" },
    { file:'index', expect:'expected exactly the times the prompt states', via:'index',
      find:"    if (r.kind === 'to12') return [r.h24 * MIN_PER_HOUR + r.m];",
      replace:"    if (r.kind === 'to12') return [];" },
    { file:'index', expect:'every game round has the answer first', via:'index',
      find:"      opts:[{ h:4, m:20 }, { h:16, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:1 },\n    { kind:'to12', h24:21, m:5,\n      opts:[{ period:'pm', h12:9, m:5 }, { period:'am', h12:9, m:5 },\n            { period:'pm', h12:21, m:5 }, { period:'pm', h12:8, m:5 }], ans:0 },\n    { kind:'add', start:[9, 35], add:[3, 40],\n      opts:[{ day:0, h:12, m:15 }, { day:0, h:13, m:75 },\n            { day:0, h:13, m:15 }, { day:1, h:13, m:15 }], ans:2 },\n    { kind:'add', start:[22, 40], add:[1, 50],\n      opts:[{ day:1, h:0, m:30 }, { day:0, h:0, m:30 },\n            { day:1, h:1, m:30 }, { day:0, h:23, m:30 }], ans:0 },\n    { kind:'diff', from:[9, 40], to:[14, 25],\n      opts:[{ h:5, m:15 }, { h:4, m:45 }, { h:5, m:45 }, { h:4, m:15 }], ans:1 }",
      replace:"      opts:[{ h:16, m:20 }, { h:4, m:20 }, { h:17, m:20 }, { h:15, m:20 }], ans:0 },\n    { kind:'to12', h24:21, m:5,\n      opts:[{ period:'pm', h12:9, m:5 }, { period:'am', h12:9, m:5 },\n            { period:'pm', h12:21, m:5 }, { period:'pm', h12:8, m:5 }], ans:0 },\n    { kind:'add', start:[9, 35], add:[3, 40],\n      opts:[{ day:0, h:13, m:15 }, { day:0, h:13, m:75 },\n            { day:0, h:12, m:15 }, { day:1, h:13, m:15 }], ans:0 },\n    { kind:'add', start:[22, 40], add:[1, 50],\n      opts:[{ day:1, h:0, m:30 }, { day:0, h:0, m:30 },\n            { day:1, h:1, m:30 }, { day:0, h:23, m:30 }], ans:0 },\n    { kind:'diff', from:[9, 40], to:[14, 25],\n      opts:[{ h:4, m:45 }, { h:5, m:15 }, { h:5, m:45 }, { h:4, m:15 }], ans:0 }" },
    { file:'index', expect:'the two hint levels print the same thing', via:'index',
      find:"        to12: function(h24){ return '提示 2：' + h24 + ' － 12 ＝ ' + (h24 - 12) + '，所以是下午。'; },",
      replace:"        to12: function(h24){ return '提示 1：13 時到 23 時是中午過後，減掉 12 就回到鐘面上的數字，前面要記得說下午。'; }," },

    /* ---------- index.html：三層題庫 ---------- */
    { file:'index', expect:'marked answer is', via:'index',
      find:"        { stem:'「下午 3 點 20 分」用 24 時制怎麼寫？', opts:['3 時 20 分','15 時 20 分','16 時 20 分','20 時 3 分'], ans:1,",
      replace:"        { stem:'「下午 3 點 20 分」用 24 時制怎麼寫？', opts:['3 時 20 分','15 時 20 分','16 時 20 分','20 時 3 分'], ans:2," },
    { file:'index', expect:'the oracle expects exactly', via:'index',
      find:"        { stem:'21 時 40 分用 12 時制怎麼說？',",
      replace:"        { stem:'21 時 45 分用 12 時制怎麼說？'," },
    { file:'index', expect:'the stem no longer says', via:'index',
      find:"        { stem:'2 日 5 小時是幾小時？',",
      replace:"        { stem:'2 日又 5 小時是幾小時？'," },
    { file:'index', expect:'the explanation no longer shows', via:'index',
      find:"          why:'1 小時 ＝ 60 分，所以 2 小時 ＝ 2 × 60 ＝ 120 分，再加 15 分：120 ＋ 15 ＝ 135 分。",
      replace:"          why:'1 小時 ＝ 60 分，所以 2 小時是 120 分，再加 15 分就是 135 分。" },
    { file:'index', expect:'the explanation never states', via:'index',
      find:"          why:'100 ÷ 60 ＝ 1 餘 40：商 1 是小時，餘數 40 就是剩下的分，所以是 1 小時 40 分。1 小時 60 分不可以那樣寫 —— 分到了 60 就一定要進位，而且它是 120 分，比 100 分還多。' }",
      replace:"          why:'100 ÷ 60 ＝ 1 餘 40：商 1 是小時，餘數 40 就是剩下的分，所以是 1 小時 40 分。' }" },
    { file:'index', expect:'are the same length of time', via:'index',
      find:"        { stem:'100 分是幾小時幾分？', opts:['1 小時 20 分','2 小時 20 分','1 小時 60 分','1 小時 40 分'], ans:3,",
      replace:"        { stem:'100 分是幾小時幾分？', opts:['1 小時 20 分','2 小時 20 分','100 分','1 小時 40 分'], ans:3," },
    { file:'index', expect:'this question never asks for', via:'index',
      find:"        { stem:'2 小時 15 分是幾分？', opts:['63 分','135 分','215 分','75 分'], ans:1,",
      replace:"        { stem:'2 小時 15 分是幾分？', opts:['63 分','135 分','215 分','75 秒'], ans:1," },
    /* ⚠️「這一題沒有今天／隔天標籤，答案卻落在隔天」這一條沒有單筆改壞可以證明：
       要讓答案跨天就一定要改題幹的數字，而那會先撞到「題幹的數字集合」那一條。
       它是那一條的加強版（下游守門），而那一條有自己的改壞測試。 */
    { file:'index', expect:"is not one of this lesson's shapes", via:'index',
      find:"          opts:['隔天 1 時 30 分','隔天 0 時 30 分','今天 1 時 30 分','隔天 2 時 30 分'], ans:0,",
      replace:"          opts:['隔天 1 時 30 分','隔天 0 時 30 分','今天 1 時 30 分','隔天 2 時30 分'], ans:0," },
    /* 「解析得出來、印回去卻不一樣」要拿一個**錯誤選項**來證明：英文的單複數。
       改到正解的寫法上，會先撞到「正解重算」那一條。 */
    { file:'index', expect:'is not spelled the way this lesson spells it', via:'index',
      find:"        { stem:'100 minutes is how many hours and minutes?', opts:['1 hour 20 minutes',",
      replace:"        { stem:'100 minutes is how many hours and minutes?', opts:['1 hours 20 minutes'," },
    { file:'index', expect:'scopeNote does not mention "三年級"', via:'index',
      find:'同一天之內的時刻加減是<strong>三年級</strong>的「時間偵察兵」；時間量的<strong>乘除</strong>和小數時間（1.5 小時）是<strong>五年級</strong>的「時間管理局」。\',',
      replace:'同一天之內的時刻加減是中年級的「時間偵察兵」；時間量的<strong>乘除</strong>和小數時間（1.5 小時）是<strong>五年級</strong>的「時間管理局」。\',' },
    { file:'index', expect:'does not say "不加 12"', via:'index',
      find:"        noon:'不加 12，寫成 12 時',",
      replace:"        noon:'寫成 12 時'," },

    /* ---------- reference.html 與 parents.html 的措辭 ---------- */
    { file:'reference', expect:'no longer says "每一級的滿數不一樣</b>：小時滿 <b>24</b> 進成日"', via:'index',
      find:'每一級的滿數不一樣</b>：小時滿 <b>24</b> 進成日，分和秒滿 <b>60</b> 才進位。<b>進位只在寫成複名數（日＋小時、小時＋分…）的時候要做</b>；寫成單名數的「53 小時」本來就合法，不用進位。\',',
      replace:'每一級都有自己的滿數</b>：小時滿 <b>24</b> 進成日，分和秒滿 <b>60</b> 才進位。<b>進位只在寫成複名數（日＋小時、小時＋分…）的時候要做</b>；寫成單名數的「53 小時」本來就合法，不用進位。\',' },
    { file:'reference', expect:'no longer says "借過來的 1 要換成那一級自己的滿數</strong>，而且上一級要記得扣掉那 1"', via:'index',
      find:"      a3:'<strong>相減</strong>：不夠減就<strong>向上一級借 1</strong>。<strong>借過來的 1 要換成那一級自己的滿數</strong>，而且上一級要記得扣掉那 1。',",
      replace:"      a3:'<strong>相減</strong>：不夠減就<strong>向上一級借 1</strong>。<strong>借過來的 1 換成 60</strong>，而且上一級要記得扣掉那 1。'," },
    { file:'reference', expect:'which contradicts the rule this lesson teaches', via:'index',
      find:"      s1:'一句話規則',", replace:"      s1:'一句話規則（借 1 就是借 60）'," },
    { file:'reference', expect:'ladder table is missing a cell for 小時', via:'index',
      find:'          <td class="eq" data-i18n="l2a">小時</td>\n          <td data-i18n="l2b">24</td>',
      replace:'          <td class="eq" data-i18n="l3a">分</td>\n          <td data-i18n="l2b">24</td>' },
    /* 真正的「順序反了」：把兩列的第一格對調，四個單位還是都在。 */
    { file:'reference', expect:'ladder table has 分 before 小時', via:'index',
      find:'          <td class="eq" data-i18n="l2a">小時</td>\n          <td data-i18n="l2b">24</td>\n          <td data-i18n="l2c">24 小時 ＝ 1 日</td>\n          <td data-i18n="l2d">1 小時 ＝ 60 分</td>\n        </tr>\n        <tr>\n          <td class="eq" data-i18n="l3a">分</td>',
      replace:'          <td class="eq" data-i18n="l3a">分</td>\n          <td data-i18n="l2b">24</td>\n          <td data-i18n="l2c">24 小時 ＝ 1 日</td>\n          <td data-i18n="l2d">1 小時 ＝ 60 分</td>\n        </tr>\n        <tr>\n          <td class="eq" data-i18n="l2a">小時</td>' },
    /* ⚠️「markup 那一半和字典那一半各自都要有」沒有單筆改壞可以證明：要製造它得同時
       拿掉一半**並且**在別處多留一份。它是「總次數」那一條的加強版，而總次數那一條
       有自己的改壞測試（就是下面這一筆）。 */
    { file:'reference', expect:'the required number of times', via:'index',
      find:"      k2:'<strong>往上一級（小 → 大）</strong>：<strong>除</strong>那個滿數。商是大單位，<strong>餘數就是剩下的小單位</strong>。例：100 分 ÷ 60 ＝ 1 餘 40 → 1 小時 40 分。',",
      replace:"      k2:'<strong>往上一級（小 → 大）</strong>：<strong>除</strong>那個滿數。商是大單位，剩下的就是小單位。例：100 分 ÷ 60 ＝ 1 餘 40 → 1 小時 40 分。'," },
    { file:'reference', expect:'no longer says "not always 60"', via:'index',
      find:'(it is <strong>not always 60</strong>), 5 + 24 = 29',
      replace:'(it is <strong>not sixty</strong>), 5 + 24 = 29' },
    { file:'parents', expect:'no longer says "調度中心闖關"', via:'index',
      find:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「調度中心闖關」',
      replace:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「24 時闖關」' },
    /* 中文那一句在這一頁有兩份（markup ＋ 字典），一筆 find 咬不到單一份；
       英文只住在字典裡，所以用英文那一句來證明同一條斷言。 */
    { file:'parents', expect:'no longer says "1 day is 24 hours, not 60"', via:'index',
      find:'<strong>1 day is 24 hours, not 60</strong>',
      replace:'<strong>1 day is 24 hours</strong>' },
    { file:'parents', expect:'no longer says "the 1 borrowed is always 10"', via:'index',
      find:'<strong>the 1 borrowed is always 10</strong>. Time subtraction is not like that',
      replace:'<strong>the 1 borrowed is 10</strong>. Time subtraction is not like that' },
    /* codex 第一輪：三年級已經借過 60 分，所以「第一次借 1 不是 10」是假的。 */
    /* 中文那一句在這一頁有兩份（markup ＋ 字典），一筆 find 咬不到單一份；
       英文只住在字典裡，所以用英文那一句證明同一條斷言。 */
    { file:'parents', expect:'no longer says "Grade 3 already borrowed 60 minutes"', via:'index',
      find:'Grade 3 already borrowed 60 minutes; what this lesson adds is',
      replace:'Children have never borrowed 60 minutes; what this lesson adds is' },
    { file:'parents', expect:'which contradicts the rule this lesson teaches', via:'index',
      find:'        "s3": "在家可以怎麼陪",', replace:'        "s3": "在家可以怎麼陪（借 1 就是借 60）",' },

    /* ---------- review.html：共用工具 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs.slice(0, 3)));\n    var keys = opts.map(keyOf);\n    return { opts:opts, ans:keys.indexOf(keyOf(correct)) };',
      replace:'    var opts = shuffle([correct].concat(wrongs.slice(0, 3)));\n    var keys = opts.map(keyOf);\n    return { opts:opts, ans:(keys.indexOf(keyOf(correct)) + 1) % 4 };' },
    { file:'review', expect:'are the same length of time',
      find:'      var k = keyOf(c);\n      if (!seen[k]){ seen[k] = true; wrongs.push(c); }',
      replace:'      var k = keyOf(c);\n      if (true){ seen[k] = true; wrongs.push(c); }' },
    { file:'review', expect:'opts[ans] != correct',
      find:"      clock24:function(h, m){ return h + ' 時 ' + m + ' 分'; },",
      replace:"      clock24:function(h, m){ return h + '時 ' + m + ' 分'; }," },

    /* ---------- review.html：每一支產生器 ---------- */
    { file:'review', expect:'to24: the 24-hour value is',
      find:"        var h = to24(period, h12);\n        var noShift = (period === 'pm') ? h12 : h12 + NOON_SHIFT;",
      replace:"        var h = to24(period, h12) + 1;\n        var noShift = (period === 'pm') ? h12 : h12 + NOON_SHIFT;" },
    { file:'review', expect:'to24 does not offer the forgot-the-12 distractor',
      find:'        var mx = mixBy([h, m], [[noShift, m]], K, function(step){',
      replace:'        var mx = mixBy([h, m], [[noShift, m < 59 ? m + 1 : m - 1]], K, function(step){' },
    { file:'review', expect:'to24 stem no longer asks for what it answers',
      find:"            ? readTxt + ' 用 24 時制怎麼寫？'",
      replace:"            ? readTxt + ' 是幾點幾分？'" },
    { file:'review', expect:'to24 why does not show',
      find:"                ? '下午 1 點到 11 點，鐘面上的數字要加 12：' + d.h12 + ' ＋ 12 ＝ ' + d.h + '，所以是 ' + ansTxt + '，分不用動。'",
      replace:"                ? '下午 1 點到 11 點，鐘面上的數字要加 12，所以是 ' + ansTxt + '，分不用動。'" },
    { file:'review', expect:'to12 does not offer the wrong-half-of-the-day distractor',
      find:"          { period:'am', h12:rd.h12, m:m },\n          { period:'pm', h12:h24, m:m }",
      replace:"          { period:'pm', h12:(rd.h12 % 11) + 1, m:m },\n          { period:'pm', h12:h24, m:m }" },
    { file:'review', expect:'to12 why does not show',
      find:"            ? '13 時到 23 時是中午過後，減掉 12 就回到鐘面上的數字：' + d.h24 + ' － 12 ＝ ' + d.h12",
      replace:"            ? '13 時到 23 時是中午過後，減掉 12 就回到鐘面上的數字：算出來是 ' + d.h12" },
    { file:'review', expect:'dayToHour: the multiplied-by-60 distractor is not d x 60 + r',
      find:"        var wrong60 = d0 * MIN_PER_HOUR + r;\n        var K = keyComp(['hour']);",
      replace:"        var wrong60 = d0 * MIN_PER_HOUR + r + 1;\n        var K = keyComp(['hour']);" },
    { file:'review', expect:'dayToHour: the total is not d x 24 + r',
      find:'        var total = d0 * HOUR_PER_DAY + r;\n        var wrong60 = d0 * MIN_PER_HOUR + r;',
      replace:'        var total = d0 * HOUR_PER_DAY;\n        var wrong60 = d0 * MIN_PER_HOUR + r;' },
    { file:'review', expect:'dayToHour why does not show',
      find:"            ? '1 日 ＝ 24 小時，所以 ' + d.d0 + ' 日 ＝ ' + d.d0 + ' × 24 ＝ ' + (d.d0 * HOUR_PER_DAY)",
      replace:"            ? '1 日 ＝ 24 小時，所以 ' + d.d0 + ' 日 ＝ ' + (d.d0 * HOUR_PER_DAY)" },
    { file:'review', expect:'dayToHour stem no longer asks for what it answers',
      find:"            ? srcTxt + ' 是幾小時？'\n            : 'How many hours are ' + srcTxt + '?',",
      replace:"            ? srcTxt + ' 是幾日幾小時？'\n            : 'How many hours are ' + srcTxt + '?'," },
    { file:'review', expect:'hourToDay: the divided-by-60 distractor has no hours left over',
      find:'          ok = (total >= MIN_PER_HOUR) && (total % MIN_PER_HOUR !== 0);',
      replace:'          ok = (total >= MIN_PER_HOUR); if (ok){ d0 = 2; r = 12; total = 60; }' },
    /* 正解字串的第二套實作先響（expectedCorrect），那就是這一筆要證明的那一條。 */
    { file:'review', expect:'hourToDay: zh opts[ans] != correct',
      find:'        var mx = mixBy([d0, r], [wrong60, [d0 + 1, r], near], K, function(step){',
      replace:'        var mx = mixBy([d0, r + 1], [wrong60, [d0 + 1, r], near], K, function(step){' },
    { file:'review', expect:'hourToDay why does not show',
      find:"            ? d.total + ' ÷ 24 ＝ ' + d.d0 + ' 餘 ' + d.r + '：商 ' + d.d0 + ' 是日，餘數 ' + d.r",
      replace:"            ? d.total + ' 除以 24 之後，商 ' + d.d0 + ' 是日，餘數 ' + d.r" },
    { file:'review', expect:'hourToMin: the multiplied-by-24 distractor is not h x 24 + m',
      find:"        var wrong24 = h * HOUR_PER_DAY + m;\n        var K = keyComp(['min']);",
      replace:"        var wrong24 = h * HOUR_PER_DAY;\n        var K = keyComp(['min']);" },
    { file:'review', expect:'hourToMin why does not show',
      find:"            ? '1 小時 ＝ 60 分，所以 ' + d.h + ' 小時 ＝ ' + d.h + ' × 60 ＝ ' + (d.h * MIN_PER_HOUR)",
      replace:"            ? '1 小時 ＝ 60 分，所以 ' + d.h + ' 小時 ＝ ' + (d.h * MIN_PER_HOUR)" },
    { file:'review', expect:'minToSec: the multiplied-by-24 distractor is not m x 24 + s',
      find:"        var wrong24 = m * HOUR_PER_DAY + s;\n        var K = keyComp(['sec']);",
      replace:"        var wrong24 = m * HOUR_PER_DAY + s + 1;\n        var K = keyComp(['sec']);" },
    { file:'review', expect:'minToSec why does not show',
      find:"            ? '1 分 ＝ 60 秒，所以 ' + d.m + ' 分 ＝ ' + d.m + ' × 60 ＝ ' + (d.m * SEC_PER_MIN)",
      replace:"            ? '1 分 ＝ 60 秒，所以 ' + d.m + ' 分 ＝ ' + (d.m * SEC_PER_MIN)" },
    { file:'review', expect:'the small values add to',
      find:'      if (raw < full + 2 || raw > full + 58) continue;',
      replace:'      if (raw < 2) continue;' },
    { file:'review', expect:'addHM does not offer the forgot-the-carry distractor',
      find:"        var cands = [\n          [p.a[0] + p.b[0], raw - MIN_PER_HOUR],\n          [p.a[0] + p.b[0] + 1, raw],\n          [p.a[0] - p.b[0], p.a[1] - p.b[1]]\n        ];",
      replace:"        var cands = [\n          [p.a[0] + p.b[0] + 2, raw - MIN_PER_HOUR],\n          [p.a[0] + p.b[0] + 1, raw],\n          [p.a[0] - p.b[0], p.a[1] - p.b[1]]\n        ];" },
    { file:'review', expect:'addMS does not offer the forgot-to-take-the-full-number-off distractor',
      find:"        var cands = [\n          [p.a[0] + p.b[0], raw - SEC_PER_MIN],\n          [p.a[0] + p.b[0] + 1, raw],\n          [p.a[0] - p.b[0], p.a[1] - p.b[1]]\n        ];",
      replace:"        var cands = [\n          [p.a[0] + p.b[0], raw - SEC_PER_MIN],\n          [p.a[0] + p.b[0] + 2, raw - SEC_PER_MIN * 2],\n          [p.a[0] - p.b[0], p.a[1] - p.b[1]]\n        ];" },
    { file:'review', expect:'addHM why does not show',
      find:"        ? sName + '先加：' + d.a[1] + ' ＋ ' + d.b[1] + ' ＝ ' + d.raw + '，到了 ' + full",
      replace:"        ? sName + '先加：' + d.a[1] + ' 加 ' + d.b[1] + '，到了 ' + full" },
    { file:'review', expect:'the small rung does not need a borrow',
      find:'      bs = pick(rangeList(as + 1, full - 1));',
      replace:'      bs = pick(rangeList(1, full - 1));' },
    /* ⚠️「借完之後上一級還有東西」被參數池與 ok 條件雙重擋住，沒有單筆改壞到得了它
       （它是防呆的第二層）。同一段裡真正驗得到的是「借過來的 1 值多少」。 */
    { file:'review', expect:'the borrow is worth 60, independently 24',
      find:'    var correct = stepVals(rows);\n    var full = fullOf(units[1]);',
      replace:'    var correct = stepVals(rows);\n    var full = MIN_PER_HOUR;' },
    /* ★ 這一課最貴的迷思：日時那一支一定要放「借了 60」那個誘答。 */
    { file:'review', expect:'does not offer the borrowed-60-instead-of-24 distractor',
      find:'      [p.a[0] - 1 - p.b[0], p.a[1] + MIN_PER_HOUR - p.b[1]],      // 借了 60（日時才是錯的）',
      replace:'      [p.a[0] - 1 - p.b[0], p.a[1] + full - p.b[1] + 1],      // 借了 60（日時才是錯的）' },
    { file:'review', expect:'does not offer the forgot-to-pay-the-borrow-back distractor',
      find:'      [p.a[0] - p.b[0], p.a[1] + full - p.b[1]],                  // 借了卻沒把上一級扣掉',
      replace:'      [p.a[0] - p.b[0] - 1, p.a[1] + full - p.b[1]],                  // 借了卻沒把上一級扣掉' },
    { file:'review', expect:'the marked answer is not the difference',
      find:'    var correct = stepVals(rows);\n    var full = fullOf(units[1]);\n    var K = keyComp(units);',
      replace:'    var correct = stepVals(rows);\n    correct[1] = correct[1] + 1;\n    var full = fullOf(units[1]);\n    var K = keyComp(units);' },
    { file:'review', expect:'why does not show',
      find:"        ? sName + '不夠減，向' + bName + '借 1。借過來的 1 ' + bName + ' 換成 ' + full + ' ' + sName\n          + '：' + d.a[1] + ' ＋ ' + full + ' ＝ ' + borrowed + '，' + borrowed + ' － ' + d.b[1] + ' ＝ '",
      replace:"        ? sName + '不夠減，向' + bName + '借 1。借過來的 1 ' + bName + ' 換成 ' + full + ' ' + sName\n          + '：算出來是 ' + borrowed + '，再減掉 ' + d.b[1] + ' ＝ '" },
    { file:'review', expect:'clockAdd: the marked answer is not the total wrapped at 24',
      find:'        var correct = stampOf(total);\n        var cands = [',
      replace:'        var correct = stampOf(total + MIN_PER_HOUR);\n        var cands = [' },
    { file:'review', expect:'clockAdd does not offer the same time on the wrong day as a distractor',
      find:'          { day:1 - correct.day, h:correct.h, m:correct.m },',
      replace:'          { day:correct.day, h:(correct.h + 2) % 24, m:correct.m },' },
    { file:'review', expect:'clockAdd: the answer lands on 0 minutes',
      find:'          ok = (total % MIN_PER_HOUR !== 0) && (total < 2 * MIN_PER_DAY) && (total >= 2 * MIN_PER_HOUR);',
      replace:'          ok = (total < 2 * MIN_PER_DAY) && (total >= 2 * MIN_PER_HOUR); if (ok){ sh = 10; sm = 20; dh = 1; dm = 40; total = 720; }' },
    { file:'review', expect:'clockAdd stem no longer asks for what it answers',
      find:"            ? startTxt + ' 再過 ' + addTxt + ' 是幾時幾分？（時刻要寫在 0 時到 23 時之間，跨過午夜就要說是隔天）'",
      replace:"            ? startTxt + ' 加上 ' + addTxt + ' 是幾時幾分？（時刻要寫在 0 時到 23 時之間，跨過午夜就要說是隔天）'" },
    { file:'review', expect:'clockAdd why does not show',
      find:"            ? '分先加：' + d.sm + ' ＋ ' + d.dm + ' ＝ ' + raw",
      replace:"            ? '分先加，算出來是 ' + raw" },
    { file:'review', expect:'clockDiff does not offer the reversed-minutes distractor',
      find:'        var cands = [\n          [th - fh, fm - tm],',
      replace:'        var cands = [\n          [th - fh, fm - tm + 1],' },
    { file:'review', expect:'the reversed-minutes distractor collides with the one-hour-too-many one',
      find:'          ok = (diff - MIN_PER_HOUR >= 1) && (fm - tm !== 30);',
      replace:'          ok = (diff - MIN_PER_HOUR >= 1); if (ok){ fh = 9; fm = 40; th = 14; tm = 10; diff = 270; }' },
    { file:'review', expect:'clockDiff: the marked answer is not the gap in hours and minutes',
      find:'        var correct = fromSmallest(units, diff);\n        var cands = [',
      replace:'        var correct = fromSmallest(units, diff + 1);\n        var cands = [' },
    { file:'review', expect:'clockDiff stem no longer asks for what it answers',
      find:"            ? '從 ' + fromTxt + ' 到 ' + toTxt + '，一共經過多久？'",
      replace:"            ? fromTxt + ' 再過到 ' + toTxt + ' 是幾時幾分？'" },
    { file:'review', expect:'clockDiff why does not show',
      find:"            ? '分不夠減，向小時借 1，換成 60 分：' + d.tm + ' ＋ 60 ＝ ' + borrowed + '，'",
      replace:"            ? '分不夠減，向小時借 1，換成 60 分：算出來是 ' + borrowed + '，'" },

    /* ---------- codex 第二輪補的斷言，各自配一筆改壞 ---------- */
    /* 選項的上界從具名誘答的算式推出來：一個保底的大數字要被擋下來。 */
    { file:'review', expect:'outside 1~',
      find:'          [p.a[0] + p.b[0], raw - MIN_PER_HOUR],\n          [p.a[0] + p.b[0] + 1, raw],',
      replace:'          [p.a[0] + p.b[0], raw - MIN_PER_HOUR],\n          [p.a[0] + p.b[0] + 10, raw],' },
    /* 解釋要把**完整的**答案講出來：「14 小時 15 分」含有「4 小時 15 分」。 */
    { file:'review', expect:'as a whole value',
      find:"          + d.a[0] + ' ＋ ' + d.b[0] + ' ＋ 進位的 1 ＝ ' + d.correct[0] + '。答案是 ' + ansTxt + '。'",
      replace:"          + d.a[0] + ' ＋ ' + d.b[0] + ' ＋ 進位的 1 ＝ ' + d.correct[0] + '。答案是 1' + ansTxt + '。'" },
    /* 掃描迴圈要走到參數池的頂端（池子到 5，迴圈只到 4 的話這一筆抓不到）。 */
    { file:'index', expect:'the min rung carries at 60', via:'index',
      find:'      var raw = a[i] + b[i] + carry;',
      replace:"      var raw = a[i] + b[i] + carry + (a[0] === 5 && i === 1 && units[1] === 'min' ? 1 : 0);" },
    /* 每一個選項的欄位都要驗，不只是正解。 */
    { file:'index', expect:'has bad fields', via:'index',
      find:"      opts:[{ period:'pm', h12:9, m:5 }, { period:'am', h12:9, m:5 },\n            { period:'pm', h12:21, m:5 }, { period:'pm', h12:8, m:5 }], ans:0 },",
      replace:"      opts:[{ period:'pm', h12:9, m:5 }, { period:'bogus', h12:9, m:5 },\n            { period:'pm', h12:21, m:5 }, { period:'pm', h12:8, m:5 }], ans:0 }," },
    /* 光有 id 不算一支產生器：make() 也要在。 */
    { file:'review', expect:'make() functions, this config describes', via:'index',
      find:"    { id:'minToSec', cat:'convert',\n      make:function(used){",
      replace:"    { id:'minToSec', cat:'convert',\n      makeX:function(used){" },
    /* 參數池的宣告被改小 —— 設定檔的上界就在描述一個產生器沒在用的定義域。 */
    { file:'review', expect:'no longer declares the pool', via:'index',
      find:'  var HM_H_POOL = rangeList(1, 5);      // 化聚：小時',
      replace:'  var HM_H_POOL = rangeList(1, 4);      // 化聚：小時' },
    /* 把一支產生器寫死成一組參數：每一條不變條件都還是綠的，定義域卻整片消失。 */
    { file:'review', expect:'never draws from a pool', via:'index',
      find:"        var period = pickUnused(['am', 'pm'], used);\n        var h12 = pick(H12_POOL), m = pick(MIN_POOL);",
      replace:"        var period = 'pm';\n        var h12 = 3, m = 20;" },
    /* 用孩子看不到的節點湊「出現次數」。 */
    { file:'reference', expect:'hides content from the reader', via:'index',
      find:'    <h2 data-i18n="s1">一句話規則</h2>',
      replace:'    <h2 data-i18n="s1" hidden>一句話規則</h2>' },
    /* 禁字要不分大小寫 —— 同一句話換個大小寫還是同一句話。 */
    { file:'reference', expect:'which contradicts the rule this lesson teaches', via:'index',
      find:"      s1:'The Rules in One Line',",
      replace:"      s1:'The Rules in One Line (Borrowing 1 ALWAYS Gives You 60)'," },

    /* ---------- codex 第二輪：英文的單複數（1 hour ／ 2 hours） ---------- */
    { file:'index', expect:'1 takes the singular', via:'index',
      find:"        return bigTxt + 's: one was borrowed away, so ' + av + ' − 1 − ' + bv + ' = '\n             + plEn(out, bigTxt) + '.';",
      replace:"        return bigTxt + 's: one was borrowed away, so ' + av + ' − 1 − ' + bv + ' = ' + out + ' ' + bigTxt + 's.';" },
    { file:'review', expect:'1 takes the singular',
      find:"            : '1 hour = 60 minutes, so ' + t.plu(d.h, 'hour') + ' = '",
      replace:"            : '1 hour = 60 minutes, so ' + d.h + ' hours = '" },
    { file:'review', expect:'1 takes the singular',
      find:"            : '1 minute = 60 seconds, so ' + t.plu(d.m, 'min') + ' = '",
      replace:"            : '1 minute = 60 seconds, so ' + d.m + ' minutes = '" },
    { file:'review', expect:'1 takes the singular',
      find:"              + ' hours, plus the ' + t.plu(d.r, 'hour') + ' left over: '",
      replace:"              + ' hours, plus the ' + d.r + ' hours left over: '" },
    { file:'review', expect:'1 takes the singular',
      find:"so carry 1 to the hours and ' + t.plu(raw % MIN_PER_HOUR, 'min') + t.isAre(raw % MIN_PER_HOUR) + ' left'",
      replace:"so carry 1 to the hours and ' + (raw % MIN_PER_HOUR) + ' minutes are left'" },

    /* ---------- review.html：產生器清單 ----------
       刪掉（或註解掉）一整支產生器，simgen 只會少跑那一支的檢查，靜靜地什麼都不說。 */
    { file:'review', expect:'no longer declares the generator "clockDiff"', via:'index',
      find:"    { id:'clockDiff', cat:'cross',", replace:"    { id:'clockDiffX', cat:'cross'," },
    { file:'review', expect:'no longer declares the generator "subDH"', via:'index',
      find:"    { id:'subDH', cat:'sub',", replace:"    // { id:'subDH', cat:'sub'," }
  ],

  sim: {
    /* fmt() 要印單位名稱與時段名稱，那些表宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    INVARIANTS: {
      to24: d => {
        if (d.period !== 'am' && d.period !== 'pm') return 'to24: unknown period ' + d.period;
        if (H12_POOL.indexOf(d.h12) < 0) return 'to24: h12 ' + d.h12 + ' is outside the declared pool';
        if (MIN_POOL.indexOf(d.m) < 0) return 'to24: m ' + d.m + ' is outside the declared pool';
        const want = (d.period === 'pm') ? d.h12 + NOON_SHIFT : d.h12;
        if (d.h !== want) return 'to24: the 24-hour value is ' + d.h + ', independently ' + want;
        const row = READ_TABLE[d.h];
        if (!row || row[0] !== d.period || row[1] !== d.h12)
          return 'to24: ' + d.period + ' ' + d.h12 + ' does not sit at hour ' + d.h + ' in the truth table';
        const noShift = (d.period === 'pm') ? d.h12 : d.h12 + NOON_SHIFT;
        if (d.noShift !== noShift) return 'to24: the forgot-the-12 distractor is not ' + noShift;
        if (d.noShift === d.h) return 'to24: the forgot-the-12 distractor equals the answer';
        if (d.opts.map(v => v[0] * MIN_PER_HOUR + v[1]).indexOf(noShift * MIN_PER_HOUR + d.m) < 0)
          return 'to24 does not offer the forgot-the-12 distractor as an option';
      },
      to12: d => {
        if (H24_PM_POOL.indexOf(d.h24) < 0) return 'to12: h24 ' + d.h24 + ' is outside the declared pool';
        if (MIN_POOL.indexOf(d.m) < 0) return 'to12: m ' + d.m + ' is outside the declared pool';
        const row = READ_TABLE[d.h24];
        if (!row) return 'to12: hour ' + d.h24 + ' is not in the truth table';
        if (row[0] !== 'pm') return 'to12: this generator only asks about times after noon';
        if (d.h12 !== row[1]) return 'to12: the clock-face number is ' + d.h12 + ', independently ' + row[1];
        if (!d.correct || d.correct.period !== 'pm' || d.correct.h12 !== row[1] || d.correct.m !== d.m)
          return 'to12: the marked reading is not the truth-table one';
        const wrongPeriod = d.opts.some(o => o.period === 'am' && o.h12 === row[1] && o.m === d.m);
        if (!wrongPeriod) return 'to12 does not offer the wrong-half-of-the-day distractor';
        const noShift = d.opts.some(o => o.h12 === d.h24);
        if (!noShift) return 'to12 does not offer the forgot-to-take-12-off distractor';
      },
      dayToHour: d => {
        if (DH_D_POOL.indexOf(d.d0) < 0 || DH_H_POOL.indexOf(d.r) < 0)
          return 'dayToHour: a parameter is outside the declared pools';
        if (d.total !== toSmallRef(['day', 'hour'], [d.d0, d.r]))
          return 'dayToHour: the total is not d x 24 + r';
        if (d.wrong60 !== d.d0 * MIN_PER_HOUR + d.r)
          return 'dayToHour: the multiplied-by-60 distractor is not d x 60 + r';
        if (d.wrong60 === d.total) return 'dayToHour: the multiplied-by-60 distractor equals the answer';
        if (d.opts.map(v => v[0]).indexOf(d.wrong60) < 0)
          return 'dayToHour does not offer the multiplied-by-60 distractor ' + d.wrong60;
      },
      hourToDay: d => {
        if (DH_D_POOL.indexOf(d.d0) < 0 || DH_H_POOL.indexOf(d.r) < 0)
          return 'hourToDay: a parameter is outside the declared pools';
        if (d.total !== toSmallRef(['day', 'hour'], [d.d0, d.r]))
          return 'hourToDay: the total is not d x 24 + r';
        const want = fromSmallRef(['day', 'hour'], d.total);
        if (d.correct[0] !== want[0] || d.correct[1] !== want[1])
          return 'hourToDay: the marked answer is not the total divided by 24';
        if (d.total < MIN_PER_HOUR)
          return 'hourToDay: the total is below 60, so the divided-by-60 distractor collapses to no days';
        if (d.total % MIN_PER_HOUR === 0)
          return 'hourToDay: the divided-by-60 distractor has no hours left over, so it changes shape';
        if (d.wrong60[0] !== Math.floor(d.total / MIN_PER_HOUR) || d.wrong60[1] !== d.total % MIN_PER_HOUR)
          return 'hourToDay: the divided-by-60 distractor is not floor(t/60) and t%60';
        if (d.opts.map(v => toSmallRef(['day', 'hour'], v)).indexOf(toSmallRef(['day', 'hour'], d.wrong60)) < 0)
          return 'hourToDay does not offer the divided-by-60 distractor';
      },
      hourToMin: d => {
        if (HM_H_POOL.indexOf(d.h) < 0 || HM_M_POOL.indexOf(d.m) < 0)
          return 'hourToMin: a parameter is outside the declared pools';
        if (d.total !== toSmallRef(['hour', 'min'], [d.h, d.m]))
          return 'hourToMin: the total is not h x 60 + m';
        if (d.wrong24 !== d.h * HOUR_PER_DAY + d.m)
          return 'hourToMin: the multiplied-by-24 distractor is not h x 24 + m';
        if (d.wrong24 === d.total) return 'hourToMin: the multiplied-by-24 distractor equals the answer';
        if (d.opts.map(v => v[0]).indexOf(d.wrong24) < 0)
          return 'hourToMin does not offer the multiplied-by-24 distractor ' + d.wrong24;
      },
      minToSec: d => {
        if (MS_M_POOL.indexOf(d.m) < 0 || MS_S_POOL.indexOf(d.s) < 0)
          return 'minToSec: a parameter is outside the declared pools';
        if (d.total !== toSmallRef(['min', 'sec'], [d.m, d.s]))
          return 'minToSec: the total is not m x 60 + s';
        if (d.wrong24 !== d.m * HOUR_PER_DAY + d.s)
          return 'minToSec: the multiplied-by-24 distractor is not m x 24 + s';
        if (d.wrong24 === d.total) return 'minToSec: the multiplied-by-24 distractor equals the answer';
        if (d.opts.map(v => v[0]).indexOf(d.wrong24) < 0)
          return 'minToSec does not offer the multiplied-by-24 distractor ' + d.wrong24;
      },
      addHM: d => invAdd(d, ['hour', 'min'], 'addHM'),
      addMS: d => invAdd(d, ['min', 'sec'], 'addMS'),
      subHM: d => invSub(d, ['hour', 'min'], 'subHM'),
      subDH: d => invSub(d, ['day', 'hour'], 'subDH'),
      clockAdd: d => {
        if (CLOCK_H_POOL.indexOf(d.sh) < 0 || MIN_POOL.indexOf(d.sm) < 0)
          return 'clockAdd: the start time is outside the declared pools';
        if (CLOCK_ADD_H.indexOf(d.dh) < 0 || MIN_POOL.indexOf(d.dm) < 0)
          return 'clockAdd: the amount added is outside the declared pools';
        const total = d.sh * MIN_PER_HOUR + d.sm + d.dh * MIN_PER_HOUR + d.dm;
        if (d.total !== total) return 'clockAdd: the total is not the start plus the amount added';
        if (total >= 2 * MIN_PER_DAY)
          return 'clockAdd: the answer runs past the next day, which this lesson does not cover';
        const day = Math.floor(total / MIN_PER_DAY);
        const h = Math.floor((total % MIN_PER_DAY) / MIN_PER_HOUR);
        const m = total % MIN_PER_HOUR;
        if (d.correct.day !== day || d.correct.h !== h || d.correct.m !== m)
          return 'clockAdd: the marked answer is not the total wrapped at 24';
        if (m < 1) return 'clockAdd: the answer lands on 0 minutes, which this lesson never prints';
        const flipped = d.opts.some(o => o.day !== day && o.h === h && o.m === m);
        if (!flipped) return 'clockAdd does not offer the same time on the wrong day as a distractor';
      },
      clockDiff: d => {
        if (DIFF_FROM_H.indexOf(d.fh) < 0 || DIFF_TO_H.indexOf(d.th) < 0)
          return 'clockDiff: an hour is outside the declared pools';
        if (!(d.fm >= 20 && d.fm <= 59) || !(d.tm >= 1 && d.tm <= 59))
          return 'clockDiff: a minute is outside the declared pools';
        if (!(d.tm < d.fm))
          return 'clockDiff: the minutes do not need a borrow, so the reversed-minutes distractor is not the taught mistake';
        const diff = (d.th * MIN_PER_HOUR + d.tm) - (d.fh * MIN_PER_HOUR + d.fm);
        if (d.diff !== diff) return 'clockDiff: the gap is not the end time minus the start time';
        if (diff < 1) return 'clockDiff: the end time is not after the start time';
        const want = fromSmallRef(['hour', 'min'], diff);
        if (d.correct[0] !== want[0] || d.correct[1] !== want[1])
          return 'clockDiff: the marked answer is not the gap in hours and minutes';
        const naive = [d.th - d.fh, d.fm - d.tm];
        if (toSmallRef(['hour', 'min'], naive) === diff)
          return 'clockDiff: the reversed-minutes distractor equals the answer';
        if (!d.opts.some(v => v[0] === naive[0] && v[1] === naive[1]))
          return 'clockDiff does not offer the reversed-minutes distractor';
        /* 三個誘答要**各自是一個有名字的錯法**。差剛好 30 分時，「分反過來減」和
           「多算一小時」會變成同一個選項，其中一個就退化成保底的數字。 */
        if (d.fm - d.tm === 30)
          return 'clockDiff: the reversed-minutes distractor collides with the one-hour-too-many one';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，不呼叫產生器的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'to24':      return clock24Ref(lang, (d.period === 'pm') ? d.h12 + NOON_SHIFT : d.h12, d.m);
        case 'to12':      return clock12Ref(lang, 'pm', READ_TABLE[d.h24][1], d.m);
        case 'dayToHour': return durRef(lang, ['hour'], [toSmallRef(['day', 'hour'], [d.d0, d.r])]);
        case 'hourToDay': return durRef(lang, ['day', 'hour'], fromSmallRef(['day', 'hour'], d.total));
        case 'hourToMin': return durRef(lang, ['min'], [toSmallRef(['hour', 'min'], [d.h, d.m])]);
        case 'minToSec':  return durRef(lang, ['sec'], [toSmallRef(['min', 'sec'], [d.m, d.s])]);
        case 'addHM':     return durRef(lang, ['hour', 'min'], addRef(['hour', 'min'], d.a, d.b));
        case 'addMS':     return durRef(lang, ['min', 'sec'], addRef(['min', 'sec'], d.a, d.b));
        case 'subHM':     return durRef(lang, ['hour', 'min'], subRef(['hour', 'min'], d.a, d.b));
        case 'subDH':     return durRef(lang, ['day', 'hour'], subRef(['day', 'hour'], d.a, d.b));
        case 'clockAdd':  return clockDayRef(lang, d.correct.day, d.correct.h, d.correct.m);
        case 'clockDiff': return durRef(lang, ['hour', 'min'],
                            fromSmallRef(['hour', 'min'],
                              (d.th * MIN_PER_HOUR + d.tm) - (d.fh * MIN_PER_HOUR + d.fm)));
        default: return null;
      }
    },

    /* 選項的形狀與範圍。正解與誘答分開驗：刻意的迷思誘答（4 小時 75 分、1 日 45 小時）
       是這一課在教的東西，可是**正解永遠是合法的寫法**。 */
    optionOk: function(s, genId, lang, isCorrect){
      const str = String(s);
      if (/[·#]/.test(str)) return 'junk option ' + str;
      if (NEG.test(str)) return 'option "' + str + '" carries a negative number, but this lesson is all positive';
      const shape = OPT_SHAPE[genId];
      if (!shape) return 'no option shape declared for ' + genId;
      const p = parseOpt(str, lang);
      if (!p) return 'option "' + str + '" is not one of this lesson\'s shapes (a time, a 12-hour reading, or an amount of time)';
      const back = reprint(p, lang);
      if (back !== str)
        return 'option "' + str + '" is not spelled the way this lesson spells it (reprinted as "' + back + '")';
      if (p.kind !== shape.kind)
        return 'option "' + str + '" is a ' + p.kind + ', but ' + genId + ' asks for a ' + shape.kind;
      if (p.kind === 'dur'){
        for (let i = 0; i < p.units.length; i++){
          if (shape.units.indexOf(p.units[i]) < 0)
            return 'option "' + str + '" uses the unit ' + p.units[i] + ', which ' + genId + ' never asks for';
          if (i > 0 && shape.units.indexOf(p.units[i]) <= shape.units.indexOf(p.units[i - 1]))
            return 'option "' + str + '" lists its units out of order (they run big to small)';
          if (p.vals[i] < 0) return 'option "' + str + '" has a negative level';
        }
        if (isCorrect){
          for (let i = 1; i < p.units.length; i++){
            if (p.vals[i] >= fullRef(p.units[i]))
              return 'the marked answer "' + str + '" leaves ' + p.vals[i] + ' ' + p.units[i] +
                     ', which has reached its full number ' + fullRef(p.units[i]) + ' and has to carry';
          }
        }
      }
      if (p.kind === 'clock' || p.kind === 'stamp'){
        if (p.kind === 'stamp' && p.day !== 0 && p.day !== 1)
          return 'option "' + str + '" is neither today nor the next day';
        if (!(p.h >= 0 && p.h <= HOUR_PER_DAY - 1)) return 'option "' + str + '" has an hour outside 0~23';
        if (!(p.min >= 1 && p.min <= MIN_PER_HOUR - 1)) return 'option "' + str + '" has minutes outside 1~59';
      }
      if (p.kind === 'read'){
        if (!(p.min >= 1 && p.min <= MIN_PER_HOUR - 1)) return 'option "' + str + '" has minutes outside 1~59';
        if (isCorrect && !(p.h12 >= 1 && p.h12 <= 11))
          return 'the marked answer "' + str + '" has a clock-face number outside 1~11';
        if (!(p.h12 >= 1 && p.h12 <= HOUR_PER_DAY - 1))
          return 'option "' + str + '" has a clock-face number outside 1~23';
      }
      const val = optValue(p, shape.target);
      if (val === null) return 'option "' + str + '" cannot be turned into a single value';
      if (!(val >= shape.range[0] && val <= shape.range[1]))
        return 'option ' + str + ' is worth ' + val + ', outside ' + shape.range[0] + '~' + shape.range[1];
      return null;
    },

    /* 這一課的選項都帶著單位詞，所以 simgen 內建的「誘答整串等於題幹的數字」永遠不會
       命中；真正的檢查在 renderCheck 裡，它把值拆出來再比一次（只對單名數的化聚題，
       因為時刻題的每一個選項本來就共用題幹印出來的那個分鐘數）。 */
    stemEchoOk: {},

    renderCheck: function(d, q, lang, genId){
      const stem = stripTags(q.stem);
      const why = stripTags(q.why);
      const shape = OPT_SHAPE[genId];
      if (!shape) return 'no option shape declared for ' + genId;

      if (/\d\.\d/.test(stem) || /\d\.\d/.test(q.opts.join(' ')))
        return genId + ' prints a decimal, but every time in this lesson is a whole number';
      if (NEG.test(stem)) return genId + ' stem prints a negative number';
      for (const t of [stem, why].concat(q.opts.map(String))){
        const pp = pluralProblem(t, lang);
        if (pp) return genId + ' ' + pp;
      }

      /* 題幹問的是什麼？只驗數字的話，把題幹改成問另一種量、正解不動，全部都是綠的。 */
      const ask = ASK[genId];
      if (!ask) return 'no "what does the stem ask" cues declared for ' + genId;
      for (const cue of ask[lang]){
        if (stem.indexOf(cue) < 0) return genId + ' stem no longer asks for what it answers (missing "' + cue + '")';
      }
      for (const cue of ask[lang + 'Not']){
        if (stem.indexOf(cue) >= 0) return genId + ' stem now says "' + cue + '", which is a different question from its answer';
      }

      /* 選項要**依值**兩兩相異。「3 小時 75 分」和「4 小時 15 分」字串不同、長度一樣，
         兩個一起出現的話，孩子算對也會被判錯（§六之二）。 */
      const vals = q.opts.map(o => optValue(parseOpt(String(o), lang), shape.target));
      for (let i = 0; i < vals.length; i++){
        if (vals[i] === null)
          return genId + ' option "' + q.opts[i] + '" cannot be valued, so the duplicate check did not run';
      }
      for (let i = 0; i < vals.length; i++){
        for (let j = i + 1; j < vals.length; j++){
          if (vals[i] === vals[j])
            return genId + ' options "' + q.opts[i] + '" and "' + q.opts[j] + '" are the same length of time';
        }
      }

      /* 單名數的化聚題：誘答不可以剛好是題幹印出來的數字（看起來像抄來的提示）。 */
      if (['dayToHour', 'hourToMin', 'minToSec'].indexOf(genId) >= 0){
        const stemNums = numTokens(stem);
        for (let i = 0; i < q.opts.length; i++){
          if (i === q.ans) continue;
          if (stemNums.indexOf(vals[i]) >= 0)
            return genId + ' distractor "' + q.opts[i] + '" repeats a number printed in the stem';
        }
      }

      /* 解釋要把**算式**寫出來，不是只把答案的數字印出來。 */
      const PLUS = (lang === 'zh') ? ' ＋ ' : ' + ';
      const MINUS = (lang === 'zh') ? ' － ' : ' − ';
      const EQ = (lang === 'zh') ? ' ＝ ' : ' = ';
      const CARRY = (lang === 'zh') ? '進位的 1' : 'the 1 carried';
      let miss = null;
      function need(expr){ if (!miss && why.indexOf(expr) < 0) miss = expr; }
      if (genId === 'to24'){
        if (d.period === 'pm') need(d.h12 + PLUS + NOON_SHIFT + EQ + d.h);
        else if (!printsNum(why, d.h)) miss = 'the 24-hour hour ' + d.h;
      } else if (genId === 'to12'){
        need(d.h24 + MINUS + NOON_SHIFT + EQ + d.h12);
      } else if (genId === 'dayToHour'){
        need(d.d0 + ' × ' + HOUR_PER_DAY + EQ + (d.d0 * HOUR_PER_DAY));
        need((d.d0 * HOUR_PER_DAY) + PLUS + d.r + EQ + d.total);
      } else if (genId === 'hourToDay'){
        need(d.total + ' ÷ ' + HOUR_PER_DAY + EQ + d.d0);
      } else if (genId === 'hourToMin'){
        need(d.h + ' × ' + MIN_PER_HOUR + EQ + (d.h * MIN_PER_HOUR));
        need((d.h * MIN_PER_HOUR) + PLUS + d.m + EQ + d.total);
      } else if (genId === 'minToSec'){
        need(d.m + ' × ' + SEC_PER_MIN + EQ + (d.m * SEC_PER_MIN));
        need((d.m * SEC_PER_MIN) + PLUS + d.s + EQ + d.total);
      } else if (genId === 'addHM' || genId === 'addMS'){
        const units = (genId === 'addHM') ? ['hour', 'min'] : ['min', 'sec'];
        const out = addRef(units, d.a, d.b);
        need(d.a[1] + PLUS + d.b[1] + EQ + (d.a[1] + d.b[1]));
        need(d.a[0] + PLUS + d.b[0] + PLUS + CARRY + EQ + out[0]);
      } else if (genId === 'subHM' || genId === 'subDH'){
        const units = (genId === 'subHM') ? ['hour', 'min'] : ['day', 'hour'];
        const full = fullRef(units[1]);
        const out = subRef(units, d.a, d.b);
        need(d.a[1] + PLUS + full + EQ + (d.a[1] + full));
        need((d.a[1] + full) + MINUS + d.b[1] + EQ + out[1]);
        need(d.a[0] + MINUS + '1' + MINUS + d.b[0] + EQ + out[0]);
      } else if (genId === 'clockAdd'){
        need(d.sm + PLUS + d.dm + EQ + (d.sm + d.dm));
        if (d.correct.day){
          const hSum = d.sh + d.dh + Math.floor((d.sm + d.dm) / MIN_PER_HOUR);
          need(hSum + MINUS + HOUR_PER_DAY + EQ + d.correct.h);
        }
      } else if (genId === 'clockDiff'){
        need(d.tm + PLUS + MIN_PER_HOUR + EQ + (d.tm + MIN_PER_HOUR));
        need((d.tm + MIN_PER_HOUR) + MINUS + d.fm + EQ + d.correct[1]);
        need(d.th + MINUS + '1' + MINUS + d.fh + EQ + d.correct[0]);
      }
      if (miss) return genId + ' why does not show "' + miss + '", so the working is unchecked';

      /* 解釋一定要把答案原封不動地講出來 —— 而且要是**完整的**那一個數：
         「153 hours」含有「53 hours」，子字串比對會把改壞的答案放過去（codex 第二輪）。 */
      const ansTxt = String(q.opts[q.ans]);
      let at = -1, found = false;
      while ((at = why.indexOf(ansTxt, at + 1)) >= 0){
        const before = at > 0 ? why[at - 1] : ' ';
        if (!/[0-9]/.test(before)){ found = true; break; }
      }
      if (!found) return genId + ' why never states the answer "' + ansTxt + '" as a whole value';
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{SEC_PER_MIN, MIN_PER_HOUR, HOUR_PER_DAY, MIN_PER_DAY, NOON_SHIFT, ' +
                'UNIT_CHAIN, STEPS, fullOf, bigOf, toSmallest, fromSmallest, keepLevels, ' +
                'addSteps, subSteps, stepVals, PERIOD_ORDER, to24, read12, h12Range, pad2, ' +
                'DL_W, DL_H, DL_X0, DL_X1, DL_Y, DL_TICK, DL_TICK_BIG, DL_READ_DY, DL_NUM_DY, ' +
                'DL_PERIOD_DY, DL_FONT, DL_FONT_BIG, DL_MARK_R, DL_MARK_H, DL_BAND_H, ' +
                'DL_NUM_HOURS, DL_READ_HOURS, DL_PERIOD_MID, ' +
                'minX, hourX, dlTicks, dlNumLabels, dlReadLabels, dlPeriodLabels, dlMark, spanBands, ' +
                'DAY_CASES, CONVERT_CASES, ADD_CASES, SUB_CASES, CROSS_CASES, crossResult, ' +
                'ROUNDS, roundAnswer, roundMarks}',
    optionValueMax: 2 * MIN_PER_DAY,

    check: function(data, I18N, fail){
      checkCore(data, I18N, fail);
      checkFigure(data, I18N, fail);
      checkExamples(data, I18N, fail);
      checkRounds(data, I18N, fail);
      checkBankAndSiblings(data, I18N, fail);
    }
  }
};

/* ===================== 1. 常數、階梯、加減、時制轉換 ===================== */
function checkCore(data, I18N, fail){
  if (data.SEC_PER_MIN !== SEC_PER_MIN) fail(`the lesson says 1 minute is ${data.SEC_PER_MIN} seconds, independently ${SEC_PER_MIN}`);
  if (data.MIN_PER_HOUR !== MIN_PER_HOUR) fail(`the lesson says 1 hour is ${data.MIN_PER_HOUR} minutes, independently ${MIN_PER_HOUR}`);
  if (data.HOUR_PER_DAY !== HOUR_PER_DAY)
    fail(`the lesson says 1 day is ${data.HOUR_PER_DAY} hours, independently ${HOUR_PER_DAY} — a day is not base 60`);
  if (data.MIN_PER_DAY !== MIN_PER_DAY) fail(`the lesson says a day is ${data.MIN_PER_DAY} minutes, independently ${MIN_PER_DAY}`);
  if (data.NOON_SHIFT !== NOON_SHIFT) fail(`the lesson shifts afternoon times by ${data.NOON_SHIFT}, independently ${NOON_SHIFT}`);
  if (!Array.isArray(data.UNIT_CHAIN) || data.UNIT_CHAIN.join(',') !== CHAIN.join(','))
    fail(`UNIT_CHAIN is ${data.UNIT_CHAIN}, expected ${CHAIN.join(',')} (big to small)`);

  /* 階梯表：三級各自的滿數與上一級，逐格比對。 */
  if (!Array.isArray(data.STEPS) || data.STEPS.length !== 3)
    fail(`STEPS has ${data.STEPS ? data.STEPS.length : 'no'} rungs, expected 3`);
  else {
    ['hour', 'min', 'sec'].forEach((small, i) => {
      const st = data.STEPS[i];
      if (!st || st.small !== small) return fail(`STEPS[${i}] is not the ${small} rung`);
      if (st.full !== FULL[small]) fail(`STEPS[${i}] says ${small} fills up at ${st.full}, independently ${FULL[small]}`);
      if (st.big !== BIG_OF[small]) fail(`STEPS[${i}] says ${small} carries into ${st.big}, independently ${BIG_OF[small]}`);
    });
  }
  ['hour', 'min', 'sec'].forEach(u => {
    if (data.fullOf(u) !== FULL[u]) fail(`fullOf('${u}') = ${data.fullOf(u)}, independently ${FULL[u]}`);
    if (data.bigOf(u) !== BIG_OF[u]) fail(`bigOf('${u}') = ${data.bigOf(u)}, independently ${BIG_OF[u]}`);
  });
  if (data.fullOf('day') !== null)
    fail(`fullOf('day') = ${data.fullOf('day')}, but the top rung has no full number`);

  /* 化聚：兩個方向必須互為反函數，三個單位對都要掃，除不盡也要對。 */
  const PAIRS = [['day', 'hour'], ['hour', 'min'], ['min', 'sec']];
  let convFails = 0;
  PAIRS.forEach(units => {
    const full = fullRef(units[1]);
    for (let big = 0; big <= 7 && convFails < 6; big++){
      for (let small = 0; small < full && convFails < 6; small++){
        const total = toSmallRef(units, [big, small]);
        const got = data.toSmallest(units, [big, small]);
        if (got !== total){
          convFails++;
          fail(`toSmallest(${units.join('/')}, ${big},${small}) = ${got}, independently ${total} — ` +
               `the step between ${units[0]} and ${units[1]} is ${full}`);
        }
      }
    }
    for (let t = 1; t <= 400 && convFails < 6; t++){
      const got = data.fromSmallest(units, t), want = fromSmallRef(units, t);
      if (got[0] !== want[0] || got[1] !== want[1]){
        convFails++;
        fail(`fromSmallest(${units.join('/')}, ${t}) = ${got}, independently ${want} — ` +
             'the quotient is the bigger unit and the remainder is the smaller one');
      }
    }
  });
  if (data.toSmallest(['hour'], [7]) !== 7)
    fail('toSmallest with a single level does not return the value itself');

  /* 印出來要跳過 0 的那一級。 */
  [[['day', 'hour'], [3, 0], [0]],
   [['day', 'hour'], [0, 5], [1]],
   [['day', 'hour'], [2, 2], [0, 1]],
   [['day', 'hour'], [0, 0], [1]],
   [['min'], [0], [0]]].forEach(c => {
    const got = data.keepLevels(c[0], c[1]);
    if (got.join(',') !== c[2].join(','))
      fail(`keepLevels(${c[0].join('/')}, ${c[1]}) = [${got}], independently [${c[2]}]`);
  });

  /* 相加：總量守恆，而且每一級的進位用的是**它自己的滿數**。 */
  let addFails = 0;
  PAIRS.forEach(units => {
    const full = fullRef(units[1]);
    const smalls = [0, 1, full - 1, Math.floor(full / 2)];
    /* 迴圈的上界要**從參數池推出來**，不然池子頂端的那幾個值永遠沒被算過
       （codex 第二輪：池子到 5，迴圈只到 4）。 */
    const addTop = ADD_BIG_POOL[ADD_BIG_POOL.length - 1];
    for (let ab = 0; ab <= addTop && addFails < 6; ab++){
      for (let bb = 0; bb <= addTop && addFails < 6; bb++){
        smalls.forEach(as => smalls.forEach(bs => {
          if (addFails >= 6) return;
          const rows = data.addSteps(units, [ab, as], [bb, bs]);
          if (!Array.isArray(rows) || rows.length !== 2){
            addFails++; fail(`addSteps(${units.join('/')}) did not return one row per rung`); return;
          }
          const got = data.stepVals(rows), want = addRef(units, [ab, as], [bb, bs]);
          if (got[0] !== want[0] || got[1] !== want[1]){
            addFails++;
            fail(`addSteps(${units.join('/')}, ${ab},${as} + ${bb},${bs}) = ${got}, independently ${want} — ` +
                 `the ${units[1]} rung carries at ${full}`);
            return;
          }
          const small = rows[1];
          if (small.full !== full){
            addFails++;
            fail(`addSteps: the ${units[1]} rung reports a full number of ${small.full}, independently ${full}`);
          } else if (small.raw !== as + bs){
            addFails++;
            fail(`addSteps: the ${units[1]} rung adds to ${small.raw}, independently ${as + bs}`);
          } else if (small.carryOut !== Math.floor((as + bs) / full)){
            addFails++;
            fail(`addSteps: the ${units[1]} rung carries ${small.carryOut}, independently ${Math.floor((as + bs) / full)}`);
          }
        }));
      }
    }
  });

  /* 相減：總量守恆，而且**借過來的 1 一定等於那一級自己的滿數**（不是一律 60）。 */
  let subFails = 0;
  PAIRS.forEach(units => {
    const full = fullRef(units[1]);
    const smalls = [0, 1, full - 1, Math.floor(full / 2)];
    const subTop = SUB_BIG_POOL[SUB_BIG_POOL.length - 1];
    for (let ab = 0; ab <= subTop && subFails < 6; ab++){
      for (let bb = 0; bb <= ab && subFails < 6; bb++){
        smalls.forEach(as => smalls.forEach(bs => {
          if (subFails >= 6) return;
          if (toSmallRef(units, [ab, as]) < toSmallRef(units, [bb, bs])) return;
          const rows = data.subSteps(units, [ab, as], [bb, bs]);
          const got = data.stepVals(rows), want = subRef(units, [ab, as], [bb, bs]);
          if (got[0] !== want[0] || got[1] !== want[1]){
            subFails++;
            fail(`subSteps(${units.join('/')}, ${ab},${as} - ${bb},${bs}) = ${got}, independently ${want} — ` +
                 `borrowing 1 ${units[0]} has to give ${full} ${units[1]}, not always 60`);
            return;
          }
          const small = rows[1];
          const need = as < bs;
          if (small.borrowed !== (need ? 1 : 0)){
            subFails++;
            fail(`subSteps(${units.join('/')}, ${ab},${as} - ${bb},${bs}): borrowed=${small.borrowed}, ` +
                 `but ${as} ${need ? 'is' : 'is not'} short of ${bs}`);
          } else if (small.val !== (need ? as + full : as)){
            subFails++;
            fail(`subSteps: after borrowing, the ${units[1]} rung holds ${small.val}, ` +
                 `independently ${need ? as + full : as} — the 1 borrowed has to turn into ${full}`);
          }
        }));
      }
    }
  });

  /* 12 時制 ↔ 24 時制：對 0~23 每一格比真值表，再把每一格反著算回去。 */
  if (!Array.isArray(data.PERIOD_ORDER) || data.PERIOD_ORDER.join(',') !== PERIOD_ORDER_REF.join(','))
    fail(`PERIOD_ORDER is ${data.PERIOD_ORDER}, expected ${PERIOD_ORDER_REF.join(',')}`);
  let clockFails = 0;
  for (let h = 0; h < HOUR_PER_DAY; h++){
    const row = READ_TABLE[h];
    const got = data.read12(h);
    if (!got || got.period !== row[0] || got.h12 !== row[1]){
      if (clockFails++ < 5)
        fail(`read12(${h}) says ${got && got.period} ${got && got.h12}, the truth table says ${row[0]} ${row[1]}`);
      continue;
    }
    const back = data.to24(row[0], row[1]);
    if (back !== h && clockFails++ < 5)
      fail(`to24('${row[0]}', ${row[1]}) = ${back}, but the truth table puts it at hour ${h} — ` +
           'the two directions have to be inverses');
  }
  /* 「一律加 12」的兩個反例，各自單獨釘一次。 */
  if (data.to24('noon', 12) !== NOON_SHIFT)
    fail(`to24('noon', 12) = ${data.to24('noon', 12)}, expected ${NOON_SHIFT} — adding 12 to noon would give 24`);
  if (data.to24('midnight', 12) !== 0)
    fail(`to24('midnight', 12) = ${data.to24('midnight', 12)}, expected 0 — midnight starts the day, it is not 12`);
  [['midnight', [12, 12]], ['noon', [12, 12]], ['am', [1, 11]], ['pm', [1, 11]]].forEach(pair => {
    const got = data.h12Range(pair[0]);
    if (!Array.isArray(got) || got[0] !== pair[1][0] || got[1] !== pair[1][1])
      fail(`h12Range('${pair[0]}') = ${got}, independently ${pair[1]}`);
  });
  for (let n = 0; n <= 23; n++){
    if (data.pad2(n) !== pad2Ref(n)) fail(`pad2(${n}) = ${data.pad2(n)}, independently ${pad2Ref(n)}`);
  }

  /* 字典的單位詞、時段詞、今天／隔天，以及五個格式化函式，逐一對照第二套實作。 */
  ['zh', 'en'].forEach(L => {
    const d = I18N[L];
    CHAIN.forEach(u => {
      if (d.unitName[u] !== UNIT_NAME[L][u])
        fail(`${L}.unitName.${u} is "${d.unitName[u]}", the unit table says "${UNIT_NAME[L][u]}"`);
    });
    PERIOD_ORDER_REF.forEach(p => {
      if (d.periodName[p] !== PERIOD_NAME[L][p])
        fail(`${L}.periodName.${p} is "${d.periodName[p]}", the period table says "${PERIOD_NAME[L][p]}"`);
    });
    if (!Array.isArray(d.dayTag) || d.dayTag.join('|') !== DAY_TAG[L].join('|'))
      fail(`${L}.dayTag is ${d.dayTag}, the table says ${DAY_TAG[L]}`);
    for (let h = 0; h < HOUR_PER_DAY; h++){
      [1, 5, 30, 59].forEach(m => {
        if (d.clock24(h, m) !== clock24Ref(L, h, m))
          fail(`${L}.clock24(${h}, ${m}) = "${d.clock24(h, m)}", independently "${clock24Ref(L, h, m)}"`);
      });
      if (d.hour24(h) !== hour24Ref(L, h))
        fail(`${L}.hour24(${h}) = "${d.hour24(h)}", independently "${hour24Ref(L, h)}"`);
      const rd = READ_TABLE[h];
      if (d.hour12(rd[0], rd[1]) !== hour12Ref(L, rd[0], rd[1]))
        fail(`${L}.hour12('${rd[0]}', ${rd[1]}) = "${d.hour12(rd[0], rd[1])}", independently "${hour12Ref(L, rd[0], rd[1])}"`);
      if (d.clock12(rd[0], rd[1], 5) !== clock12Ref(L, rd[0], rd[1], 5))
        fail(`${L}.clock12('${rd[0]}', ${rd[1]}, 5) = "${d.clock12(rd[0], rd[1], 5)}", independently "${clock12Ref(L, rd[0], rd[1], 5)}"`);
      [0, 1].forEach(day => {
        if (d.clockDay(day, h, 30) !== clockDayRef(L, day, h, 30))
          fail(`${L}.clockDay(${day}, ${h}, 30) = "${d.clockDay(day, h, 30)}", independently "${clockDayRef(L, day, h, 30)}"`);
      });
    }
    /* 時間量：兩級與一級、含 0 的那幾種寫法，還有英文的單複數（1 vs 2）。 */
    [[['day', 'hour'], [1, 1]], [['day', 'hour'], [2, 2]], [['day', 'hour'], [3, 0]],
     [['day', 'hour'], [0, 5]], [['hour', 'min'], [2, 45]], [['hour', 'min'], [1, 1]],
     [['min', 'sec'], [1, 30]], [['min', 'sec'], [3, 20]], [['min'], [135]],
     [['sec'], [200]], [['hour'], [1]], [['hour'], [72]], [['day'], [1]]
    ].forEach(c => {
      const got = d.dur(c[0], c[1]), want = durRef(L, c[0], c[1]);
      if (got !== want) fail(`${L}.dur(${c[0].join('/')}, ${c[1]}) = "${got}", independently "${want}"`);
    });
    if (d.dur(['hour'], [1]) === d.dur(['min'], [1]))
      fail(`${L}.dur prints the same thing for 1 hour and 1 minute`);
  });
}

/* ===================== 2. 時間軸：把畫圖的純資料函式跑起來量位置 =====================
   版面常數由課程的資料區匯出，這裡驗**四個方向**（上、下、左、右），標籤的寬度用
   字典裡真正會印出來的字串估，而不是估一個好看的數字。
   （rounding 那一輪的教訓：只驗左右和沒驗長得一模一樣。） */
function textHalfWidth(str, font){
  /* 中文字大約一個字寬，英數大約 0.55 個字寬。取兩者的較寬估法。 */
  let w = 0;
  for (const ch of String(str)) w += /[　-鿿＀-￯]/.test(ch) ? 1 : 0.55;
  return w * font / 2;
}
function checkFigure(data, I18N, fail){
  const NUMS = ['DL_W', 'DL_H', 'DL_X0', 'DL_X1', 'DL_Y', 'DL_TICK', 'DL_TICK_BIG',
                'DL_READ_DY', 'DL_NUM_DY', 'DL_PERIOD_DY', 'DL_FONT', 'DL_FONT_BIG',
                'DL_MARK_R', 'DL_MARK_H', 'DL_BAND_H'];
  NUMS.forEach(n => {
    const v = data[n];
    if (!(typeof v === 'number' && isFinite(v) && v > 0))
      fail(`layout constant ${n} is not a positive number (${v})`);
  });
  if (!(data.DL_X0 < data.DL_X1)) fail('the time line does not run left to right');
  /* 色塊要比主線粗，不然它讀起來只是一條線（截圖看出來的）。 */
  if (!(data.DL_BAND_H >= 6))
    fail(`the coloured band is only ${data.DL_BAND_H}px thick, which reads as a line rather than a stretch of time`);
  if (data.DL_X1 > data.DL_W) fail(`the time line ends at x=${data.DL_X1}, off the right edge of the ${data.DL_W}px canvas`);

  /* minX：0 分在左端、一整天在右端，而且嚴格遞增。 */
  if (data.minX(0) !== data.DL_X0) fail(`minX(0) = ${data.minX(0)}, expected the left end ${data.DL_X0}`);
  if (data.minX(MIN_PER_DAY) !== data.DL_X1)
    fail(`minX(${MIN_PER_DAY}) = ${data.minX(MIN_PER_DAY)}, expected the right end ${data.DL_X1}`);
  let monoFails = 0;
  for (let t = 1; t <= MIN_PER_DAY && monoFails < 3; t++){
    if (!(data.minX(t) > data.minX(t - 1))){
      monoFails++;
      fail(`minX is not strictly increasing at ${t} minutes (${data.minX(t - 1)} then ${data.minX(t)})`);
    }
  }
  for (let h = 0; h <= HOUR_PER_DAY; h++){
    if (data.hourX(h) !== data.minX(h * MIN_PER_HOUR))
      fail(`hourX(${h}) does not agree with minX(${h * MIN_PER_HOUR})`);
  }

  /* 刻度：0~24 每一個小時都要有一根，只有標了數字的那幾根是長的，而且都在畫布裡。 */
  const ticks = data.dlTicks();
  if (!Array.isArray(ticks) || ticks.length !== HOUR_PER_DAY + 1)
    fail(`dlTicks() draws ${ticks ? ticks.length : 'no'} ticks, expected one per hour boundary (${HOUR_PER_DAY + 1})`);
  else {
    const seen = {};
    ticks.forEach(t => {
      if (seen[t.h]) fail(`dlTicks() draws two ticks at hour ${t.h}`);
      seen[t.h] = true;
      if (t.x !== data.hourX(t.h)) fail(`the tick for hour ${t.h} is at x=${t.x}, expected ${data.hourX(t.h)}`);
      const wantBig = data.DL_NUM_HOURS.indexOf(t.h) >= 0;
      if (t.big !== wantBig)
        fail(`the tick for hour ${t.h} is ${t.big ? 'long' : 'short'}, but it ${wantBig ? 'does' : 'does not'} carry a number`);
      if (t.y2 !== data.DL_Y + (wantBig ? data.DL_TICK_BIG : data.DL_TICK))
        fail(`the tick for hour ${t.h} reaches y=${t.y2}, not the declared tick length`);
      if (t.y2 > data.DL_H) fail(`the tick for hour ${t.h} reaches y=${t.y2}, below the bottom of the ${data.DL_H}px canvas`);
      if (t.x < 0 || t.x > data.DL_W) fail(`the tick for hour ${t.h} is at x=${t.x}, outside the ${data.DL_W}px canvas`);
    });
    for (let h = 0; h <= HOUR_PER_DAY; h++) if (!seen[h]) fail(`dlTicks() has no tick at hour ${h}`);
  }

  /* 三排標籤：24 時制的數字、12 時制的說法、上午／下午。四個方向都要驗。 */
  const numLabels = data.dlNumLabels();
  if (!Array.isArray(numLabels) || numLabels.length !== data.DL_NUM_HOURS.length)
    fail(`dlNumLabels() has ${numLabels ? numLabels.length : 'no'} labels, expected ${data.DL_NUM_HOURS.length}`);
  else numLabels.forEach(lb => {
    if (data.DL_NUM_HOURS.indexOf(lb.h) < 0) fail(`dlNumLabels() labels hour ${lb.h}, which is not in DL_NUM_HOURS`);
    if (lb.x !== data.hourX(lb.h)) fail(`the number label for hour ${lb.h} is not centred on its tick`);
    if (lb.y !== data.DL_Y + data.DL_NUM_DY) fail(`the number label for hour ${lb.h} is not on the declared row`);
    if (lb.y + data.DL_FONT > data.DL_H)
      fail(`the number label for hour ${lb.h} reaches y=${lb.y + data.DL_FONT}, below the bottom of the ${data.DL_H}px canvas`);
    const half = textHalfWidth(String(lb.h), data.DL_FONT);
    if (lb.x - half < 0) fail(`the number label "${lb.h}" would run off the left edge`);
    if (lb.x + half > data.DL_W) fail(`the number label "${lb.h}" would run off the right edge`);
  });

  const readLabels = data.dlReadLabels();
  if (!Array.isArray(readLabels) || readLabels.length !== data.DL_READ_HOURS.length)
    fail(`dlReadLabels() has ${readLabels ? readLabels.length : 'no'} labels, expected ${data.DL_READ_HOURS.length}`);
  else readLabels.forEach(lb => {
    if (data.DL_READ_HOURS.indexOf(lb.h) < 0) fail(`dlReadLabels() labels hour ${lb.h}, which is not in DL_READ_HOURS`);
    /* 24 時那一格畫的是隔天的 0 時，所以真值表要對 h % 24 查。 */
    const row = READ_TABLE[lb.h % HOUR_PER_DAY];
    if (!lb.read || lb.read.period !== row[0] || lb.read.h12 !== row[1])
      fail(`the 12-hour label at hour ${lb.h} says ${lb.read && lb.read.period} ${lb.read && lb.read.h12}, ` +
           `the truth table says ${row[0]} ${row[1]}`);
    if (lb.y !== data.DL_Y - data.DL_READ_DY) fail(`the 12-hour label at hour ${lb.h} is not on the declared row`);
    if (lb.y - data.DL_FONT_BIG < 0)
      fail(`the 12-hour label at hour ${lb.h} reaches y=${lb.y - data.DL_FONT_BIG}, above the top of the canvas`);
    ['zh', 'en'].forEach(L => {
      const txt = I18N[L].hour12(lb.read.period, lb.read.h12);
      if (/undefined|NaN/.test(txt)) fail(`the 12-hour label at hour ${lb.h} (${L}) prints "${txt}"`);
      const half = textHalfWidth(txt, data.DL_FONT_BIG);
      if (lb.x - half < 0) fail(`the 12-hour label "${txt}" at hour ${lb.h} would run off the left edge`);
      if (lb.x + half > data.DL_W) fail(`the 12-hour label "${txt}" at hour ${lb.h} would run off the right edge`);
    });
  });
  /* 上下兩排標籤之間不可以擠在一起：相鄰兩個 12 時制標籤要留得下最寬的那一個。 */
  ['zh', 'en'].forEach(L => {
    for (let i = 1; i < readLabels.length; i++){
      const a = readLabels[i - 1], b = readLabels[i];
      const wa = textHalfWidth(I18N[L].hour12(a.read.period, a.read.h12), data.DL_FONT_BIG);
      const wb = textHalfWidth(I18N[L].hour12(b.read.period, b.read.h12), data.DL_FONT_BIG);
      if (b.x - a.x < wa + wb + 4)
        fail(`the 12-hour labels at hours ${a.h} and ${b.h} (${L}) overlap: ${(b.x - a.x).toFixed(1)}px apart, ` +
             `they need ${(wa + wb + 4).toFixed(1)}px`);
    }
  });

  const periodLabels = data.dlPeriodLabels();
  if (!Array.isArray(periodLabels) || periodLabels.length !== 2)
    fail(`dlPeriodLabels() has ${periodLabels ? periodLabels.length : 'no'} labels, expected one per half of the day`);
  else {
    const keys = periodLabels.map(p => p.key).join(',');
    if (keys !== 'am,pm') fail(`the half-of-day labels are ${keys}, expected am,pm (morning first)`);
    periodLabels.forEach(lb => {
      const midHour = (lb.key === 'am') ? 6 : 18;
      if (lb.x !== data.hourX(midHour))
        fail(`the ${lb.key} label is at x=${lb.x}, not in the middle of its half (${data.hourX(midHour)})`);
      if (lb.y !== data.DL_Y + data.DL_PERIOD_DY) fail(`the ${lb.key} label is not on the declared row`);
      if (lb.y + data.DL_FONT > data.DL_H)
        fail(`the ${lb.key} label reaches y=${lb.y + data.DL_FONT}, below the bottom of the ${data.DL_H}px canvas`);
      ['zh', 'en'].forEach(L => {
        const txt = I18N[L].periodName[lb.key];
        const half = textHalfWidth(txt, data.DL_FONT);
        if (lb.x - half < 0 || lb.x + half > data.DL_W)
          fail(`the half-of-day label "${txt}" would run off the ${data.DL_W}px canvas`);
      });
    });
    /* 兩排標籤不可以疊在一起（12 時制那一排在線上面，這一排在線下面）。 */
    if (periodLabels[0].y - data.DL_FONT <= data.DL_Y + data.DL_NUM_DY)
      fail('the half-of-day row overlaps the 24-hour number row');
  }

  /* 標出來的時刻：垂直線與圓點都要在畫布裡，位置由 minX 決定。 */
  let markFails = 0;
  for (let t = 0; t <= MIN_PER_DAY && markFails < 3; t += 7){
    const mk = data.dlMark(t);
    if (mk.x !== data.minX(t)){ markFails++; fail(`dlMark(${t}) is at x=${mk.x}, expected ${data.minX(t)}`); continue; }
    if (mk.y1 !== data.DL_Y - data.DL_MARK_H || mk.y2 !== data.DL_Y + data.DL_MARK_H){
      markFails++; fail(`dlMark(${t}) does not use the declared mark height`); continue;
    }
    if (mk.y1 < 0 || mk.y2 > data.DL_H){
      markFails++; fail(`dlMark(${t}) reaches y=${mk.y1}~${mk.y2}, outside the ${data.DL_H}px canvas`); continue;
    }
    if (mk.r !== data.DL_MARK_R){ markFails++; fail(`dlMark(${t}) has radius ${mk.r}, expected ${data.DL_MARK_R}`); continue; }
    if (mk.x - mk.r < 0 || mk.x + mk.r > data.DL_W){
      markFails++; fail(`the dot of dlMark(${t}) reaches x=${mk.x + mk.r}, outside the ${data.DL_W}px canvas`);
    }
  }

  /* 時間段：一段時間量最多切成兩條（今天的尾巴 ＋ 隔天的開頭），
     加起來必須**剛好等於**那一段時間量，而且每一條都在畫布裡。 */
  let bandFails = 0;
  for (let start = 0; start < MIN_PER_DAY && bandFails < 4; start += 53){
    for (const add of [1, 30, 90, 600, MIN_PER_DAY - 1]){
      if (bandFails >= 4) break;
      const bands = data.spanBands(start, add);
      if (!Array.isArray(bands) || !bands.length){
        bandFails++; fail(`spanBands(${start}, ${add}) returned nothing`); continue;
      }
      if (bands.length > 2){
        bandFails++; fail(`spanBands(${start}, ${add}) returned ${bands.length} pieces; this lesson never runs past the next day`); continue;
      }
      let covered = 0, bad = false;
      bands.forEach((b, i) => {
        covered += (b.to - b.from);
        if (b.day !== i){ bad = true; fail(`spanBands(${start}, ${add}) piece ${i} is labelled day ${b.day}`); }
        if (b.from < 0 || b.to > MIN_PER_DAY){ bad = true; fail(`spanBands(${start}, ${add}) piece ${i} runs outside one day`); }
        if (!(b.to > b.from)){ bad = true; fail(`spanBands(${start}, ${add}) piece ${i} is empty`); }
        if (Math.abs(b.x - data.minX(b.from)) > 1e-9 || Math.abs(b.w - (data.minX(b.to) - data.minX(b.from))) > 1e-9){
          bad = true; fail(`spanBands(${start}, ${add}) piece ${i} is not drawn where minX puts it`);
        }
        if (b.y < 0 || b.y + b.h > data.DL_H){ bad = true; fail(`spanBands(${start}, ${add}) piece ${i} is outside the canvas vertically`); }
        if (b.x < 0 || b.x + b.w > data.DL_W + 1e-9){ bad = true; fail(`spanBands(${start}, ${add}) piece ${i} is outside the canvas horizontally`); }
      });
      if (bad){ bandFails++; continue; }
      if (bands[0].from !== start){ bandFails++; fail(`spanBands(${start}, ${add}) does not start at the start time`); continue; }
      if (bands.length === 2 && bands[1].from !== 0){
        bandFails++; fail(`spanBands(${start}, ${add}) does not restart the next day at 0`); continue;
      }
      if (covered !== add){
        bandFails++;
        fail(`spanBands(${start}, ${add}) covers ${covered} minutes, but the amount of time is ${add} — ` +
             'the coloured pieces have to add up to exactly the time that goes by');
      }
    }
  }

  /* markup 的 viewBox 與 CSS 尺寸要跟著常數走。 */
  const target = process.argv[2];
  if (!target){
    fail('cannot locate the lesson file (no target path in argv) — the canvas-size and sibling-page checks did not run');
    return;
  }
  let src = '';
  try { src = fs.readFileSync(target, 'utf8'); } catch (err){ src = ''; }
  src = src.replace(/<!--[\s\S]*?-->/g, ' ');
  ['s1fig', 's5fig', 'gFig'].forEach(id => {
    const m = new RegExp('id="' + id + '"[^>]*viewBox="0 0 (\\d+) (\\d+)"').exec(src);
    if (!m) fail(`cannot find the ${id} viewBox, so its canvas-size check did not run`);
    else if (Number(m[1]) !== data.DL_W || Number(m[2]) !== data.DL_H)
      fail(`the ${id} viewBox is ${m[1]}x${m[2]}, but the layout constants say ${data.DL_W}x${data.DL_H}`);
  });
  const css = /\.dayfig\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(src);
  if (!css) fail('cannot find the .dayfig CSS box, so the canvas-size check did not run');
  else {
    if (Number(css[1]) !== data.DL_W) fail(`the .dayfig CSS max-width is ${css[1]}px, the constants say ${data.DL_W}`);
    if (Number(css[2]) !== data.DL_H) fail(`the .dayfig CSS height is ${css[2]}px, the constants say ${data.DL_H}`);
  }
}

/* ===================== 3. 五組範例資料 ===================== */
function checkExamples(data, I18N, fail){
  const LANGS = ['zh', 'en'];
  const SIZES = { DAY_CASES:6, CONVERT_CASES:5, ADD_CASES:4, SUB_CASES:4, CROSS_CASES:4, ROUNDS:5 };
  Object.keys(SIZES).forEach(key => {
    const arr = data[key];
    if (!Array.isArray(arr) || arr.length !== SIZES[key])
      fail(key + ' has ' + (arr ? arr.length : 'no') + ' entries, this config expects ' + SIZES[key]);
    if (Array.isArray(arr)){
      for (let i = 0; i < arr.length; i++){
        if (!Object.prototype.hasOwnProperty.call(arr, i))
          fail(key + '[' + i + '] is a hole in the array, so every check below would skip it');
      }
    }
  });

  /* --- 範例 1：四種說法都要出現，不然「一律加 12」的兩個反例沒有例子。 --- */
  const seenPeriods = {};
  (data.DAY_CASES || []).forEach(h24 => {
    if (!(Number.isInteger(h24) && h24 >= 0 && h24 <= HOUR_PER_DAY - 1))
      return fail('DAY_CASES has ' + h24 + ', which is not an hour between 0 and 23');
    const row = READ_TABLE[h24];
    seenPeriods[row[0]] = true;
    LANGS.forEach(L => {
      const d = I18N[L];
      const readTxt = hour12Ref(L, row[0], row[1]);
      const numTxt = hour24Ref(L, h24);
      const narr = d.s1narr(readTxt, numTxt, d.s1shift[row[0]]);
      const res = d.s1result(numTxt, readTxt);
      const chip = d.s1chip(h24);
      [narr, res, chip].forEach(t => { if (pluralProblem(t, L)) fail(pluralProblem(t, L) + ' in: ' + String(t).slice(0, 110));
        if (/undefined|NaN/.test(t)) fail('s1 text ' + L + ' hour ' + h24 + ': ' + t); });
      if (d.hour12(row[0], row[1]) !== readTxt)
        fail(L + '.hour12 disagrees with the reference formatter at hour ' + h24);
      if (d.hour24(h24) !== numTxt)
        fail(L + '.hour24 disagrees with the reference formatter at hour ' + h24);
      if (narr.indexOf(readTxt) < 0 || narr.indexOf(numTxt) < 0)
        fail('s1narr ' + L + ' hour ' + h24 + ' does not print both readings ("' + readTxt + '" and "' + numTxt + '")');
      if (res.indexOf(readTxt) < 0 || res.indexOf(numTxt) < 0)
        fail('s1result ' + L + ' hour ' + h24 + ' does not put the two readings side by side');
      if (!printsNum(chip, h24)) fail('s1chip ' + L + ' hour ' + h24 + ' does not print the hour');
      if (!d.s1shift[row[0]]) fail(L + '.s1shift has no line for the ' + row[0] + ' half of the day');
      if (!d.s1rowRead[row[0]] || !d.s1rowNum[row[0]] || !d.s1row[row[0]])
        fail(L + ': the comparison table has no row for ' + row[0]);
    });
  });
  PERIOD_ORDER_REF.forEach(p => {
    if (!seenPeriods[p])
      fail('DAY_CASES never shows a ' + p + ' time, so that row of the 12-hour/24-hour table is never demonstrated');
  });
  /* 表格的四列要把「加不加 12」講清楚：中午與半夜那兩列一定要說「不加 12」。 */
  LANGS.forEach(L => {
    const d = I18N[L];
    const noAdd = (L === 'zh') ? '不加 12' : 'no 12 added';
    ['midnight', 'noon'].forEach(p => {
      if (String(d.s1row[p]).indexOf(noAdd) < 0)
        fail(L + '.s1row.' + p + ' does not say "' + noAdd + '", so the reader could add 12 to it as well');
    });
    const doAdd = (L === 'zh') ? '加 12' : 'add 12';
    if (String(d.s1row.pm).indexOf(doAdd) < 0) fail(L + '.s1row.pm does not say "' + doAdd + '"');
    if (String(d.s1row.am).indexOf(noAdd) < 0 && String(d.s1row.am).indexOf(doAdd) >= 0)
      fail(L + '.s1row.am tells the reader to add 12, but morning times keep their number');
  });

  /* --- 範例 2：三個單位對都要出現，而且**餘數不可以是 0**（不然「除不盡時餘數就是
         小單位」那句話沒有例子），除得盡的話印出來的形狀也會跟著變。 --- */
  const seenPairs = {};
  (data.CONVERT_CASES || []).forEach(c => {
    const key = (c.units || []).join('/');
    if (['day/hour', 'hour/min', 'min/sec'].indexOf(key) < 0)
      return fail('CONVERT_CASES has the unit pair "' + key + '", which is not on the ladder');
    seenPairs[key] = true;
    const full = fullRef(c.units[1]);
    if (!(Number.isInteger(c.total) && c.total > full))
      fail('CONVERT_CASES ' + key + ' has a total of ' + c.total + ', which does not need converting');
    if (c.total % full === 0)
      fail('CONVERT_CASES ' + key + ' total ' + c.total + ' divides exactly, so it never shows a remainder');
    const parts = fromSmallRef(c.units, c.total);
    if (data.toSmallest(c.units, parts) !== c.total)
      fail('CONVERT_CASES ' + key + ' total ' + c.total + ' does not round-trip through the lesson conversion');
    LANGS.forEach(L => {
      const d = I18N[L];
      const compound = durRef(L, c.units, parts);
      const lines = [d.s2same(compound, c.total, UNIT_NAME[L][c.units[1]]),
                     d.s2upLine(c.total, UNIT_NAME[L][c.units[1]], full, parts[0], parts[1],
                                UNIT_NAME[L][c.units[0]], compound),
                     d.s2downLine(parts[0], UNIT_NAME[L][c.units[0]], full, parts[0] * full, parts[1],
                                  UNIT_NAME[L][c.units[1]], c.total)];
      lines.forEach(t => { if (pluralProblem(t, L)) fail(pluralProblem(t, L) + ' in: ' + String(t).slice(0, 110));
        if (/undefined|NaN/.test(t)) fail('s2 text ' + L + ' ' + key + ' ' + c.total + ': ' + t); });
      if (lines[0].indexOf(compound) < 0 || !printsNum(lines[0], c.total))
        fail('s2same ' + L + ' ' + key + ' ' + c.total + ' does not put the two ways of writing it side by side');
      [c.total, full, parts[0], parts[1]].forEach(v => {
        if (!printsNum(lines[1], v)) fail('s2upLine ' + L + ' ' + key + ' ' + c.total + ' does not print ' + v);
      });
      [parts[0], full, parts[0] * full, parts[1], c.total].forEach(v => {
        if (!printsNum(lines[2], v)) fail('s2downLine ' + L + ' ' + key + ' ' + c.total + ' does not print ' + v);
      });
      if (d.dur(c.units, parts) !== compound)
        fail(L + '.dur disagrees with the reference formatter on ' + key + ' ' + parts);
      if (lines[1] === lines[2])
        fail('s2 ' + L + ' ' + key + ' ' + c.total + ': both directions print the same sentence');
    });
  });
  ['day/hour', 'hour/min', 'min/sec'].forEach(k => {
    if (!seenPairs[k]) fail('CONVERT_CASES never shows the ' + k + ' pair, so that rung of the ladder is never converted');
  });
  /* 階梯表那一段的三列：每一列的滿數要跟獨立的表對得上。 */
  LANGS.forEach(L => {
    const d = I18N[L];
    ['hour', 'min', 'sec'].forEach(small => {
      const full = FULL[small], big = BIG_OF[small];
      const line = d.s2full(UNIT_NAME[L][big], full, UNIT_NAME[L][small]);
      if (!printsNum(line, full)) fail(L + '.s2full for the ' + small + ' rung does not print its full number ' + full);
      if (line.indexOf(UNIT_NAME[L][big]) < 0 || line.indexOf(UNIT_NAME[L][small]) < 0)
        fail(L + '.s2full for the ' + small + ' rung does not name both units');
      if (!printsNum(d.s2down(full, UNIT_NAME[L][small]), full))
        fail(L + '.s2down for the ' + small + ' rung does not print ' + full);
      if (!printsNum(d.s2up(full, UNIT_NAME[L][big]), full))
        fail(L + '.s2up for the ' + small + ' rung does not print ' + full);
    });
    if (d.s2down(24, 'x') === d.s2up(24, 'x'))
      fail(L + ': going down and going up the ladder print the same thing');
  });

  /* --- 範例 3／4：相加與相減。三個單位對都要出現，相減一定要有一筆向日借 24。 --- */
  ['ADD_CASES', 'SUB_CASES'].forEach(key => {
    const isAdd = (key === 'ADD_CASES');
    const pairs = {};
    (data[key] || []).forEach(c => {
      const u = (c.units || []).join('/');
      if (['day/hour', 'hour/min', 'min/sec'].indexOf(u) < 0)
        return fail(key + ' has the unit pair "' + u + '", which is not on the ladder');
      pairs[u] = true;
      const full = fullRef(c.units[1]);
      [c.a, c.b].forEach((v, vi) => {
        if (!Array.isArray(v) || v.length !== 2) return fail(key + ' ' + u + ': operand ' + vi + ' is not a two-level amount');
        if (!(Number.isInteger(v[0]) && v[0] >= 0)) fail(key + ' ' + u + ': operand ' + vi + ' has a bad big value');
        if (!(Number.isInteger(v[1]) && v[1] >= 0 && v[1] < full))
          fail(key + ' ' + u + ': operand ' + vi + ' has ' + v[1] + ' ' + c.units[1] +
               ', which is not written between 0 and ' + (full - 1));
      });
      const rows = isAdd ? data.addSteps(c.units, c.a, c.b) : data.subSteps(c.units, c.a, c.b);
      const got = data.stepVals(rows);
      const want = isAdd ? addRef(c.units, c.a, c.b) : subRef(c.units, c.a, c.b);
      if (got[0] !== want[0] || got[1] !== want[1])
        fail(key + ' ' + u + ' ' + c.a + (isAdd ? ' + ' : ' - ') + c.b + ' = ' + got + ', independently ' + want);
      const small = rows[1], big = rows[0];
      if (isAdd){
        if (small.carryOut !== 1)
          fail(key + ' ' + u + ' ' + c.a + ' + ' + c.b + ' does not carry, so the carry step has nothing to show');
        if (small.out < 1)
          fail(key + ' ' + u + ' ' + c.a + ' + ' + c.b + ' leaves 0 ' + c.units[1] + ', so the remainder is invisible');
      } else {
        if (small.borrowed !== 1)
          fail(key + ' ' + u + ' ' + c.a + ' - ' + c.b + ' does not borrow, so the borrow step has nothing to show');
        if (small.val !== c.a[1] + full)
          fail(key + ' ' + u + ': the borrow turned into ' + (small.val - c.a[1]) + ', independently ' + full);
        if (want[0] < 1) fail(key + ' ' + u + ' ' + c.a + ' - ' + c.b + ' leaves nothing on the top rung');
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        const aTxt = durRef(L, c.units, c.a), bTxt = durRef(L, c.units, c.b), ansTxt = durRef(L, c.units, want);
        if (d.dur(c.units, want) !== ansTxt)
          fail(L + '.dur disagrees with the reference formatter on ' + key + ' ' + u + ' ' + want);
        const lines = isAdd
          ? [d.s3ans(aTxt, bTxt, ansTxt),
             d.s3step1(UNIT_NAME[L][small.unit], small.a, small.b, small.raw, small.full, small.out),
             d.s3step2(UNIT_NAME[L][big.unit], big.a, big.b, small.carryOut, big.out)]
          : [d.s4ans(aTxt, bTxt, ansTxt),
             d.s4step1(UNIT_NAME[L][small.unit], small.a, small.b, UNIT_NAME[L][big.unit],
                       small.full, small.val, small.out),
             d.s4step2(UNIT_NAME[L][big.unit], big.a, big.b, big.out)];
        lines.forEach(t => { if (pluralProblem(t, L)) fail(pluralProblem(t, L) + ' in: ' + String(t).slice(0, 110));
        if (/undefined|NaN/.test(t)) fail(key + ' text ' + L + ' ' + u + ': ' + t); });
        if (lines[0].indexOf(aTxt) < 0 || lines[0].indexOf(bTxt) < 0 || lines[0].indexOf(ansTxt) < 0)
          fail(key + ' answer line ' + L + ' ' + u + ' does not print both operands and the answer');
        [small.a, small.b, small.full, small.out].forEach(v => {
          if (!printsNum(lines[1], v)) fail(key + ' step 1 ' + L + ' ' + u + ' does not print ' + v);
        });
        [big.a, big.b, big.out].forEach(v => {
          if (!printsNum(lines[2], v)) fail(key + ' step 2 ' + L + ' ' + u + ' does not print ' + v);
        });
        /* 借位那一段一定要講出「向哪一級借」，因為借幾就是由那一級決定的。 */
        if (!isAdd && lines[1].indexOf(UNIT_NAME[L][big.unit]) < 0)
          fail(key + ' step 1 ' + L + ' ' + u + ' does not say which rung the 1 was borrowed from');
      });
    });
    ['day/hour', 'hour/min', 'min/sec'].forEach(k => {
      if (!pairs[k]) fail(key + ' never uses the ' + k + ' pair, so that rung own full number is never exercised');
    });
  });

  /* --- 範例 5：時刻 ＋ 時間量。至少一筆不跨午夜、至少一筆跨午夜。 --- */
  let noWrap = 0, wrap = 0;
  (data.CROSS_CASES || []).forEach(c => {
    if (!Array.isArray(c.start) || !Array.isArray(c.add)) return fail('CROSS_CASES entry is missing start or add');
    if (!(c.start[0] >= 0 && c.start[0] <= 23 && c.start[1] >= 1 && c.start[1] <= 59))
      fail('CROSS_CASES start ' + c.start + ' is not a time with 1~59 minutes');
    if (!(c.add[0] >= 0 && c.add[1] >= 1 && c.add[1] <= 59))
      fail('CROSS_CASES add ' + c.add + ' is not an amount with 1~59 minutes');
    const total = c.start[0] * MIN_PER_HOUR + c.start[1] + c.add[0] * MIN_PER_HOUR + c.add[1];
    const want = { day:Math.floor(total / MIN_PER_DAY),
                   h:Math.floor((total % MIN_PER_DAY) / MIN_PER_HOUR),
                   m:total % MIN_PER_HOUR };
    const got = data.crossResult(c);
    if (got.day !== want.day || got.h !== want.h || got.m !== want.m)
      fail('crossResult(' + c.start + ' + ' + c.add + ') = ' + JSON.stringify(got) +
           ', independently ' + JSON.stringify(want));
    if (want.day > 1) fail('CROSS_CASES ' + c.start + ' + ' + c.add + ' runs past the next day, which this lesson does not cover');
    if (want.m < 1) fail('CROSS_CASES ' + c.start + ' + ' + c.add + ' lands on 0 minutes, which this lesson never prints');
    if (want.day) wrap++; else noWrap++;
    /* 圖上的色塊必須剛好蓋住那一段時間量。 */
    const bands = data.spanBands(c.start[0] * MIN_PER_HOUR + c.start[1], c.add[0] * MIN_PER_HOUR + c.add[1]);
    const covered = bands.reduce((s, b) => s + (b.to - b.from), 0);
    if (covered !== c.add[0] * MIN_PER_HOUR + c.add[1])
      fail('CROSS_CASES ' + c.start + ' + ' + c.add + ': the coloured pieces cover ' + covered +
           ' minutes, not the amount added');
    /* 最短的那一段也要看得出來 —— 這是把頁面截圖出來才發現的問題。 */
    bands.forEach((b, bi) => {
      if (b.w < 6)
        fail('CROSS_CASES ' + c.start + ' + ' + c.add + ': coloured piece ' + bi + ' is only ' +
             b.w.toFixed(1) + 'px wide, too thin to read as a stretch of time');
    });
    if ((bands.length === 2) !== (want.day === 1))
      fail('CROSS_CASES ' + c.start + ' + ' + c.add + ': ' + bands.length +
           ' coloured pieces but ' + (want.day ? 'a' : 'no') + ' day change');
    LANGS.forEach(L => {
      const d = I18N[L];
      const raw = c.start[1] + c.add[1];
      const hSum = c.start[0] + c.add[0] + Math.floor(raw / MIN_PER_HOUR);
      const ansTxt = clockDayRef(L, want.day, want.h, want.m);
      const startTxt = clock24Ref(L, c.start[0], c.start[1]);
      const addTxt = durRef(L, ['hour', 'min'], c.add);
      const lines = [d.s5ans(ansTxt),
                     d.s5add(c.start[1], c.add[1], raw, hSum, MIN_PER_HOUR),
                     want.day ? d.s5wrap(hSum, want.h) : d.s5noWrap(hSum),
                     d.s5narr(startTxt, addTxt),
                     d.s5chip(startTxt, addTxt)];
      lines.forEach(t => { if (pluralProblem(t, L)) fail(pluralProblem(t, L) + ' in: ' + String(t).slice(0, 110));
        if (/undefined|NaN/.test(t)) fail('s5 text ' + L + ' ' + c.start + '+' + c.add + ': ' + t); });
      if (d.clockDay(want.day, want.h, want.m) !== ansTxt)
        fail(L + '.clockDay disagrees with the reference formatter on ' + JSON.stringify(want));
      if (lines[0].indexOf(ansTxt) < 0) fail('s5ans ' + L + ' ' + c.start + '+' + c.add + ' does not print the answer');
      [c.start[1], c.add[1], raw, hSum].forEach(v => {
        if (!printsNum(lines[1], v)) fail('s5add ' + L + ' ' + c.start + '+' + c.add + ' does not print ' + v);
      });
      if (want.day){
        [hSum, HOUR_PER_DAY, want.h].forEach(v => {
          if (!printsNum(lines[2], v)) fail('s5wrap ' + L + ' ' + c.start + '+' + c.add + ' does not print ' + v);
        });
        const tag = (L === 'zh') ? '隔天' : 'the next day';
        if (lines[2].indexOf(tag) < 0) fail('s5wrap ' + L + ' does not say "' + tag + '"');
      } else if (!printsNum(lines[2], hSum)){
        fail('s5noWrap ' + L + ' ' + c.start + '+' + c.add + ' does not print ' + hSum);
      }
      if (lines[3].indexOf(startTxt) < 0 || lines[3].indexOf(addTxt) < 0)
        fail('s5narr ' + L + ' ' + c.start + '+' + c.add + ' does not print the start time and the amount added');
      if (lines[4].indexOf(startTxt) < 0 || lines[4].indexOf(addTxt) < 0)
        fail('s5chip ' + L + ' ' + c.start + '+' + c.add + ' does not print the start time and the amount added');
    });
  });
  if (!noWrap) fail('CROSS_CASES never stays inside one day, so "it is still today" is never demonstrated');
  if (!wrap) fail('CROSS_CASES never crosses midnight, so the whole point of Example 5 is never demonstrated');

  /* 上課頁自己也要把兩條規則的**前提**講出來（codex 第一輪）：
     加 12 只用在 1 點到 11 點，而且這一課加的時間量不超過 24 小時。 */
  LANGS.forEach(L => {
    const lead1 = String(I18N[L].s1lead || ''), lead5 = String(I18N[L].s5lead || '');
    const cues1 = (L === 'zh') ? ['1 點到 11 點', '12 點'] : ['1 to 11', '12'];
    cues1.forEach(c => {
      if (lead1.indexOf(c) < 0)
        fail(`${L}.s1lead does not key the add-12 rule on the clock-face number ("${c}") — ` +
             '"after noon" also covers 12:20 p.m., which stays 12:20');
    });
    const cue5 = (L === 'zh') ? '不超過 24 小時' : 'never more than 24 hours';
    if (lead5.indexOf(cue5) < 0)
      fail(`${L}.s5lead does not say the amounts added are ${cue5}, so "take 24 off and say the next day" ` +
           'would be false for an amount over a day');
  });

  /* 上課頁自己要把範圍講給讀者聽 —— 只寫在原始碼的註解裡不算，孩子看不到註解。 */
  LANGS.forEach(L => {
    const note = String(I18N[L].scopeNote || '');
    if (!note) return fail(L + '.scopeNote is missing, so the lesson page never tells the reader its own scope');
    const cues = (L === 'zh')
      ? ['24 時制', '整數', '二年級', '三年級', '五年級']
      : ['24-hour clock', 'whole number', 'grade-2', 'grade-3', 'grade-5'];
    cues.forEach(c => { if (note.indexOf(c) < 0) fail(L + '.scopeNote does not mention "' + c + '"'); });
  });
}

/* ===================== 4. 遊戲的五關 ===================== */
function roundAnswerRef(r){
  if (r.kind === 'to24'){
    const h = (r.period === 'pm') ? r.h12 + NOON_SHIFT : r.h12;
    return { kind:'clock', h:h, min:r.m, day:0, row:READ_TABLE[h] };
  }
  if (r.kind === 'to12'){
    const row = READ_TABLE[r.h24];
    return { kind:'read', period:row[0], h12:row[1], min:r.m, day:0 };
  }
  if (r.kind === 'add'){
    const t = r.start[0] * MIN_PER_HOUR + r.start[1] + r.add[0] * MIN_PER_HOUR + r.add[1];
    return { kind:'stamp', day:Math.floor(t / MIN_PER_DAY),
             h:Math.floor((t % MIN_PER_DAY) / MIN_PER_HOUR), min:t % MIN_PER_HOUR };
  }
  if (r.kind === 'diff'){
    const diff = (r.to[0] * MIN_PER_HOUR + r.to[1]) - (r.from[0] * MIN_PER_HOUR + r.from[1]);
    return { kind:'dur', units:['hour', 'min'], vals:fromSmallRef(['hour', 'min'], diff), diff:diff, day:0 };
  }
  return { day:0 };
}
function roundOptValue(r, o){
  if (r.kind === 'to24') return o.h * MIN_PER_HOUR + o.m;
  if (r.kind === 'to12'){
    const h24 = (o.period === 'midnight') ? 0 : (o.period === 'noon') ? NOON_SHIFT
              : (o.period === 'am') ? o.h12 : o.h12 + NOON_SHIFT;
    return h24 * MIN_PER_HOUR + o.m;
  }
  if (r.kind === 'add') return o.day * MIN_PER_DAY + o.h * MIN_PER_HOUR + o.m;
  return o.h * MIN_PER_HOUR + o.m;
}
function checkRounds(data, I18N, fail){
  const LANGS = ['zh', 'en'];
  const kinds = {};
  (data.ROUNDS || []).forEach((r, i) => {
    const tag = 'ROUND ' + (i + 1);
    if (['to24', 'to12', 'add', 'diff'].indexOf(r.kind) < 0) return fail(tag + ': unknown kind "' + r.kind + '"');
    kinds[r.kind] = (kinds[r.kind] || 0) + 1;

    const want = roundAnswerRef(r);
    const got = data.roundAnswer(r);
    if (!got) return fail(tag + ': roundAnswer returned nothing');
    if (r.kind === 'to24'){
      if (['am', 'pm'].indexOf(r.period) < 0) fail(tag + ': the period is "' + r.period + '"');
      if (!(r.h12 >= 1 && r.h12 <= 11)) fail(tag + ': the clock-face number ' + r.h12 + ' is outside 1~11');
      if (!(r.m >= 1 && r.m <= 59)) fail(tag + ': the minutes ' + r.m + ' are outside 1~59');
      if (got.h !== want.h || got.m !== want.min)
        fail(tag + ': roundAnswer says ' + got.h + ':' + got.m + ', independently ' + want.h + ':' + want.min);
      if (!(want.row && want.row[0] === r.period && want.row[1] === r.h12))
        fail(tag + ': the stated period and clock-face number do not sit at hour ' + want.h + ' in the truth table');
    } else if (r.kind === 'to12'){
      if (!(r.h24 >= 13 && r.h24 <= 23))
        fail(tag + ': h24 ' + r.h24 + ' is outside 13~23, so "take 12 off" is not the taught step');
      if (!(r.m >= 1 && r.m <= 59)) fail(tag + ': the minutes ' + r.m + ' are outside 1~59');
      if (got.period !== want.period || got.h12 !== want.h12 || got.m !== want.min)
        fail(tag + ': roundAnswer says ' + got.period + ' ' + got.h12 + ', the truth table says ' +
             want.period + ' ' + want.h12);
    } else if (r.kind === 'add'){
      if (!(r.start[0] >= 0 && r.start[0] <= 23 && r.start[1] >= 1 && r.start[1] <= 59))
        fail(tag + ': the start time ' + r.start + ' is not a time with 1~59 minutes');
      if (!(r.add[0] >= 0 && r.add[1] >= 1 && r.add[1] <= 59))
        fail(tag + ': the amount added ' + r.add + ' is not an amount with 1~59 minutes');
      if (got.day !== want.day || got.h !== want.h || got.m !== want.min)
        fail(tag + ': roundAnswer says day ' + got.day + ' ' + got.h + ':' + got.m +
             ', independently day ' + want.day + ' ' + want.h + ':' + want.min);
      if (want.day > 1) fail(tag + ': the answer runs past the next day, which this lesson does not cover');
      if (want.min < 1) fail(tag + ': the answer lands on 0 minutes, which this lesson never prints');
    } else {
      if (!(r.from[0] >= 0 && r.from[0] <= 23 && r.from[1] >= 1 && r.from[1] <= 59))
        fail(tag + ': the start time ' + r.from + ' is not a time with 1~59 minutes');
      if (!(r.to[0] >= 0 && r.to[0] <= 23 && r.to[1] >= 1 && r.to[1] <= 59))
        fail(tag + ': the end time ' + r.to + ' is not a time with 1~59 minutes');
      if (want.diff < 1) fail(tag + ': the end time is not after the start time');
      if (got.h !== want.vals[0] || got.m !== want.vals[1])
        fail(tag + ': roundAnswer says ' + got.h + 'h' + got.m + ', independently ' +
             want.vals[0] + 'h' + want.vals[1]);
      if (r.to[1] >= r.from[1])
        fail(tag + ': the minutes do not need a borrow, so this round does not train the taught step');
    }

    /* 選項：四個、依值兩兩相異、正解就是重算出來的那一個。 */
    if (!Array.isArray(r.opts) || r.opts.length !== 4)
      return fail(tag + ': ' + (r.opts ? r.opts.length : 'no') + ' options, expected 4');
    for (let k = 0; k < 4; k++){
      if (!Object.prototype.hasOwnProperty.call(r.opts, k))
        return fail(tag + ': option ' + k + ' is a hole in the array, so the button would be blank');
    }
    const vals = r.opts.map(o => roundOptValue(r, o));
    for (let a = 0; a < 4; a++){
      for (let b = a + 1; b < 4; b++){
        if (vals[a] === vals[b])
          fail(tag + ': options ' + a + ' and ' + b + ' are the same length of time (' + vals[a] + ')');
      }
    }
    if (!(r.ans >= 0 && r.ans < 4)) return fail(tag + ': the answer index is out of range');
    const wantVal = (r.kind === 'to24') ? want.h * MIN_PER_HOUR + want.min
                  : (r.kind === 'to12') ? roundOptValue(r, { period:want.period, h12:want.h12, m:want.min })
                  : (r.kind === 'add') ? want.day * MIN_PER_DAY + want.h * MIN_PER_HOUR + want.min
                  : want.vals[0] * MIN_PER_HOUR + want.vals[1];
    if (vals[r.ans] !== wantVal)
      fail(tag + ': the marked option is worth ' + vals[r.ans] + ', recomputed ' + wantVal);

    /* 每一關都要放它自己那一個有名字的誘答。 */
    if (r.kind === 'to24'){
      const noShift = (r.period === 'pm') ? r.h12 : r.h12 + NOON_SHIFT;
      if (vals.indexOf(noShift * MIN_PER_HOUR + r.m) < 0)
        fail(tag + ': does not offer the forgot-the-12 distractor, which is what this round trains');
    }
    if (r.kind === 'to12'){
      if (!r.opts.some(o => o.period === 'am' && o.h12 === want.h12))
        fail(tag + ': does not offer the wrong-half-of-the-day distractor');
      if (!r.opts.some(o => o.h12 === r.h24))
        fail(tag + ': does not offer the forgot-to-take-12-off distractor');
    }
    if (r.kind === 'add'){
      if (!r.opts.some(o => o.day !== want.day && o.h === want.h && o.m === want.min))
        fail(tag + ': does not offer the right time on the wrong day as a distractor');
    }
    if (r.kind === 'diff'){
      const naive = [r.to[0] - r.from[0], r.from[1] - r.to[1]];
      if (!r.opts.some(o => o.h === naive[0] && o.m === naive[1]))
        fail(tag + ': does not offer the reversed-minutes distractor');
    }

    /* 圖上標出來的時刻只能是**題目已經給的**，不可以標到答案上。 */
    const marks = data.roundMarks(r);
    if (!Array.isArray(marks)) return fail(tag + ': roundMarks did not return an array');
    const allowed = (r.kind === 'to12') ? [r.h24 * MIN_PER_HOUR + r.m]
                  : (r.kind === 'add') ? [r.start[0] * MIN_PER_HOUR + r.start[1]]
                  : (r.kind === 'diff') ? [r.from[0] * MIN_PER_HOUR + r.from[1],
                                           r.to[0] * MIN_PER_HOUR + r.to[1]]
                  : [];
    if (marks.join(',') !== allowed.join(','))
      fail(tag + ': the marks on the time line are [' + marks + '], expected exactly the times the prompt states [' +
           allowed + ']');
    marks.forEach(t => {
      if (!(t >= 0 && t <= MIN_PER_DAY)) fail(tag + ': a mark at ' + t + ' minutes is outside one day');
      /* 只有 add 那一種的答案是**另一個瞬間**；to12 標的就是題目給的那個時刻，
         答案只是同一個瞬間的另一種寫法，標出來是鷹架不是洩題。 */
      if (r.kind === 'add' && t === wantVal)
        fail(tag + ': the time line marks the answer, which gives it away');
    });

    LANGS.forEach(L => {
      const d = I18N[L];
      const prompt = (r.kind === 'to24') ? d.gPrompt.to24(clock12Ref(L, r.period, r.h12, r.m))
                   : (r.kind === 'to12') ? d.gPrompt.to12(clock24Ref(L, r.h24, r.m))
                   : (r.kind === 'add') ? d.gPrompt.add(clock24Ref(L, r.start[0], r.start[1]),
                                                        durRef(L, ['hour', 'min'], r.add))
                   : d.gPrompt.diff(clock24Ref(L, r.from[0], r.from[1]), clock24Ref(L, r.to[0], r.to[1]));
      const hint1 = d.gHint1[r.kind];
      const hint2 = (r.kind === 'to24') ? d.gHint2.to24(r.period, r.h12)
                  : (r.kind === 'to12') ? d.gHint2.to12(r.h24)
                  : (r.kind === 'add') ? d.gHint2.add(r.start[1], r.add[1])
                  : d.gHint2.diff(r.from[1], r.to[1]);
      [prompt, hint1, hint2].forEach(t => {
        if (!t || /undefined|NaN/.test(t)) fail(tag + ' ' + L + ': "' + t + '"');
      });
      /* 提示 2 一定要比提示 1 更接近答案 —— 兩層提示的規格。 */
      if (hint1 === hint2) fail(tag + ' ' + L + ': the two hint levels print the same thing');
      /* 選項印出來的字要跟第二套格式化函式逐字相同。 */
      r.opts.forEach((o, oi) => {
        const shown = (r.kind === 'to24') ? d.clock24(o.h, o.m)
                    : (r.kind === 'to12') ? d.clock12(o.period, o.h12, o.m)
                    : (r.kind === 'add') ? d.clockDay(o.day, o.h, o.m)
                    : d.dur(['hour', 'min'], [o.h, o.m]);
        const wantTxt = (r.kind === 'to24') ? clock24Ref(L, o.h, o.m)
                      : (r.kind === 'to12') ? clock12Ref(L, o.period, o.h12, o.m)
                      : (r.kind === 'add') ? clockDayRef(L, o.day, o.h, o.m)
                      : durRef(L, ['hour', 'min'], [o.h, o.m]);
        if (shown !== wantTxt)
          fail(tag + ' ' + L + ' option ' + oi + ' prints "' + shown + '", independently "' + wantTxt + '"');
      });
      /* **每一個**選項的欄位都要合法 —— 只驗正解的話，一個 period:'bogus' 的誘答
         會印成「8:05 undefined」而檢查全綠（codex 第二輪）。 */
      r.opts.forEach((o, oi) => {
        const bad = [];
        /* 誘答可以是刻意的迷思寫法（13 時 75 分 ＝ 忘了扣掉 60），所以只擋「連一次進位
           都放不下」的數字；正解的 1~59 由下面那一條單獨驗。 */
        const mTop = (oi === r.ans) ? MIN_PER_HOUR - 1 : 2 * MIN_PER_HOUR - 1;
        if (!(Number.isInteger(o.m) && o.m >= 0 && o.m <= mTop)) bad.push('m=' + o.m);
        if (r.kind === 'to12'){
          if (PERIOD_ORDER_REF.indexOf(o.period) < 0) bad.push('period=' + o.period);
          if (!(Number.isInteger(o.h12) && o.h12 >= 1 && o.h12 <= HOUR_PER_DAY - 1)) bad.push('h12=' + o.h12);
        } else {
          if (!Number.isInteger(o.h) || o.h < 0) bad.push('h=' + o.h);
          if (r.kind === 'add' && o.day !== 0 && o.day !== 1) bad.push('day=' + o.day);
          if (r.kind !== 'diff' && o.h > HOUR_PER_DAY - 1) bad.push('h=' + o.h);
        }
        if (bad.length) fail(tag + ' option ' + oi + ' has bad fields: ' + bad.join(', '));
      });
      /* 正解的寫法一定要合法：時刻的分在 1~59、時間量的分不可以到 60。 */
      const ansOpt = r.opts[r.ans];
      if (r.kind === 'diff' && ansOpt.m >= MIN_PER_HOUR)
        fail(tag + ': the marked answer leaves ' + ansOpt.m + ' minutes, which has to carry');
      if (r.kind !== 'diff' && !(ansOpt.m >= 1 && ansOpt.m <= 59))
        fail(tag + ': the marked answer has minutes outside 1~59');
    });
  });
  ['to24', 'to12', 'add', 'diff'].forEach(k => {
    if (!kinds[k]) fail('ROUNDS never asks a "' + k + '" question, so that part of the lesson is untested by the game');
  });
  if (!(data.ROUNDS || []).some(r => roundAnswerRef(r).day === 1))
    fail('no game round crosses midnight, so the rule this lesson adds is never played');
  if ((data.ROUNDS || []).map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');
}

/* ===================== 5. 三層題庫的第二套實作 =====================
   `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，這一課一題都
   不符合 —— 沒有這張表，把 ans 改掉完全不會被抓到。
   每一題記：題幹裡**剛好**出現哪些數字（兩種語言各一份，因為英文的 00:00 會多印兩個 0）、
   答案怎麼從那些參數重算、解釋裡一定要出現的算式與字。 */
const BANK = {
  qs: [
    { kind:'to24', period:'pm', h12:3, m:20, shape:'clock',
      nums:{ zh:[3, 20, 24], en:[3, 20, 24] },
      stemMust:{ zh:['下午 3 點 20 分', '24 時制'], en:['3:20 p.m.', '24-hour clock'] },
      whyExpr:{ zh:['3 ＋ 12 ＝ 15'], en:['3 + 12 = 15'] },
      whyMust:{ zh:['15', '下午 1 點到 11 點'], en:['15', '1 to 11 p.m.'] } },
    { kind:'to24', period:'am', h12:7, m:5, shape:'clock',
      nums:{ zh:[7, 5, 24], en:[7, 5, 24] },
      stemMust:{ zh:['上午 7 點 5 分', '24 時制'], en:['7:05 a.m.', '24-hour clock'] },
      whyMust:{ zh:['7', '5', '19', '上午 1 點到 11 點'], en:['7', '5', '19', '1 to 11 a.m.'] } },
    { kind:'to12', h24:21, m:40, shape:'read',
      nums:{ zh:[21, 40, 12], en:[21, 40, 12] },
      stemMust:{ zh:['21 時 40 分', '12 時制'], en:['21:40', '12-hour clock'] },
      whyExpr:{ zh:['21 － 12 ＝ 9'], en:['21 − 12 = 9'] },
      whyMust:{ zh:['9', '中午過後'], en:['9', 'after noon'] } },
    { kind:'toSmall', units:['day', 'hour'], vals:[2, 5], shape:{ units:['hour'], target:'hour' },
      nums:{ zh:[2, 5], en:[2, 5] },
      stemMust:{ zh:['2 日 5 小時', '是幾小時'], en:['2 days 5 hours', 'How many hours'] },
      whyExpr:{ zh:['2 × 24 ＝ 48', '48 ＋ 5 ＝ 53'], en:['2 × 24 = 48', '48 + 5 = 53'] },
      whyMust:{ zh:['24', '125', '60'], en:['24', '125', '60'] } },
    { kind:'toSmall', units:['hour', 'min'], vals:[2, 15], shape:{ units:['min'], target:'min' },
      nums:{ zh:[2, 15], en:[2, 15] },
      stemMust:{ zh:['2 小時 15 分', '是幾分'], en:['2 hours 15 minutes', 'How many minutes'] },
      whyExpr:{ zh:['2 × 60 ＝ 120', '120 ＋ 15 ＝ 135'], en:['2 × 60 = 120', '120 + 15 = 135'] },
      whyMust:{ zh:['60', '63', '24'], en:['60', '63', '24'] } },
    { kind:'toBig', units:['hour', 'min'], total:100, shape:{ units:['hour', 'min'], target:'min' },
      nums:{ zh:[100], en:[100] },
      stemMust:{ zh:['100 分', '幾小時幾分'], en:['100 minutes', 'how many hours and minutes'] },
      whyExpr:{ zh:['100 ÷ 60 ＝ 1 餘 40'], en:['100 ÷ 60 = 1 remainder 40'] },
      whyMust:{ zh:['1', '40', '120'], en:['1', '40', '120'] } }
  ],
  qsAdv: [
    { kind:'clockAdd', start:[14, 50], add:[2, 25], shape:'clock',
      nums:{ zh:[14, 50, 2, 25, 0, 23], en:[14, 50, 2, 25, 0, 0, 23, 59] },
      stemMust:{ zh:['14 時 50 分', '2 小時 25 分', '0 時到 23 時'],
                 en:['14:50', '2 hours 25 minutes', '00:00 and 23:59'] },
      whyExpr:{ zh:['50 ＋ 25 ＝ 75', '14 ＋ 2 ＋ 進位的 1 ＝ 17'],
                en:['50 + 25 = 75', '14 + 2 + the 1 carried = 17'] },
      whyMust:{ zh:['15', '60', '16'], en:['15', '60', '16'] } },
    { kind:'clockAddDay', start:[23, 40], add:[1, 50], shape:'stamp',
      nums:{ zh:[23, 40, 1, 50, 0, 23], en:[23, 40, 1, 50, 0, 0, 23, 59] },
      stemMust:{ zh:['23 時 40 分', '1 小時 50 分', '隔天'],
                 en:['23:40', '1 hour 50 minutes', 'the next day'] },
      whyExpr:{ zh:['40 ＋ 50 ＝ 90', '23 ＋ 1 ＋ 進位的 1 ＝ 25', '25 － 24 ＝ 1'],
                en:['40 + 50 = 90', '23 + 1 + the 1 carried = 25', '25 − 24 = 1'] },
      whyMust:{ zh:['30'], en:['30'] } },
    { kind:'clockDiff', from:[8, 25], to:[10, 10], shape:{ units:['hour', 'min'], target:'min' },
      nums:{ zh:[8, 25, 10, 10], en:[8, 25, 10, 10] },
      stemMust:{ zh:['8 時 25 分', '10 時 10 分', '一共寫了多久'],
                 en:['08:25', '10:10', 'How long'] },
      whyExpr:{ zh:['10 ＋ 60 ＝ 70', '70 － 25 ＝ 45', '10 － 1 － 8 ＝ 1'],
                en:['10 + 60 = 70', '70 − 25 = 45', '10 − 1 − 8 = 1'] },
      whyMust:{ zh:['45'], en:['45'] } },
    { kind:'compSub', units:['day', 'hour'], a:[3, 5], b:[1, 20],
      shape:{ units:['day', 'hour'], target:'hour' },
      nums:{ zh:[3, 5, 1, 20], en:[3, 5, 1, 20] },
      stemMust:{ zh:['3 日 5 小時', '1 日 20 小時', '多開了多久'],
                 en:['3 days 5 hours', '1 day 20 hours', 'How much longer'] },
      whyExpr:{ zh:['5 ＋ 24 ＝ 29', '29 － 20 ＝ 9', '3 － 1 － 1 ＝ 1'],
                en:['5 + 24 = 29', '29 − 20 = 9', '3 − 1 − 1 = 1'] },
      whyMust:{ zh:['24', '60', '45'], en:['24', '60', '45'] } }
  ],
  qsBoost: [
    { kind:'compAdd', units:['hour', 'min'], a:[2, 45], b:[1, 30],
      shape:{ units:['hour', 'min'], target:'min' },
      nums:{ zh:[2, 45, 1, 30, 3, 75, 0, 59], en:[2, 45, 1, 30, 3, 75, 0, 59] },
      stemMust:{ zh:['2 小時 45 分 ＋ 1 小時 30 分', '3 小時 75 分', '0～59'],
                 en:['2 hours 45 minutes + 1 hour 30 minutes', '3 hours 75 minutes', 'between 0 and 59'] },
      whyExpr:{ zh:['45 ＋ 30 ＝ 75', '2 ＋ 1 ＋ 1 ＝ 4'], en:['45 + 30 = 75', '2 + 1 + 1 = 4'] },
      whyMust:{ zh:['15', '60', '59'], en:['15', '60', '59'] } },
    { kind:'text', shape:'text',
      text:{ zh:'1 日 ＝ 24 小時，只有分和秒才是滿 60 進位',
             en:'1 day = 24 hours, and only minutes and seconds carry at 60' },
      nums:{ zh:[60, 1, 60], en:[60, 1, 60] },
      stemMust:{ zh:['時間都是 60 進位', '1 日 ＝ 60 小時'],
                 en:['time is all base 60', '1 day = 60 hours'] },
      whyMust:{ zh:['24', '60'], en:['24', '60'] } }
  ]
};

/* 速查卡與家長頁的措辭。三頁教的是同一條規則，只驗上課頁等於沒在盯另外兩頁。
   `need` 是**出現次數**：中文字串在這些頁面上一定有兩份（markup 的 fallback ＋ 字典），
   只改掉其中一份必須要被抓到；英文只住在 en 字典裡，所以 need 是 1。 */
const SIBLING_RULES = {
  'reference.html': {
    must: [
      ['一天有 24 個小時，24 時制從 0 時數到 23 時', 2],
      ['半夜 12 點是 <b>0 時</b>', 2],
      ['中午 12 點是 <b>12 時</b>', 2],
      ['鐘面上是 1 點到 11 點</b>：上午不用改、下午<b>加 12</b>', 2],
      ['鐘面上是 12 點</b>就要看是哪一個 12', 2],
      ['不是一律加 12', 2],
      /* codex 第一輪：規則要說「這一課加的時間量不超過 24 小時」，不然「減掉 24 就是隔天」
         在加 50 小時的時候是假的。 */
      ['這一課加的時間量都不超過 24 小時', 2],
      /* codex 第一輪：進位是**複名數寫法**的規則；單名數的「53 小時」本來就合法。 */
      ['進位只在寫成複名數', 2],
      /* codex 第一輪：時刻相減要說清楚哪一個在前面。 */
      ['晚的時刻 － 早的時刻', 2],
      ['1 日 ＝ 24 小時、1 小時 ＝ 60 分、1 分 ＝ 60 秒', 2],
      /* ⚠️ 短字串在這一頁出現四次（規則段與易混淆表各一組），required 2 等於沒在盯：
         改掉規則段那一份還剩三份。所以要釘**帶著上下文的那一整句**。 */
      ['每一級的滿數不一樣</b>：小時滿 <b>24</b> 進成日', 2],
      ['借過來的 1 要換成那一級自己的滿數</strong>，而且上一級要記得扣掉那 1', 2],
      ['不是一律借 60', 2],
      ['跨過午夜就要說是隔天', 2],
      ['餘數就是剩下的小單位', 2],
      ['不可以寫成 3 小時 75 分', 2],
      ['看鐘面說幾點幾分是二年級', 2],
      ['時間量的乘除是五年級', 2],
      ['A day has 24 hours, and the 24-hour clock counts from 0 to 23', 1],
      ['Midnight is <b>0</b> and noon is <b>12</b>', 1],
      ['1 to 11 p.m., add 12 to the clock-face number', 1],
      ['clock-face 12</b> depends on which 12 it is', 1],
      ['not always add 12', 1],
      ['never more than 24 hours', 1],
      ['Carrying is only needed when an amount is written as a compound', 1],
      ['the later time − the earlier time', 1],
      ['1 day = 24 hours, 1 hour = 60 minutes, 1 minute = 60 seconds', 1],
      ['every rung has its own full number', 1],
      ['The 1 you borrow turns into that rung’s own full number', 1],
      ['not always 60', 1],
      ['say it is the next day once it goes past midnight', 1],
      ['the remainder is the smaller units left over', 1],
      ['It may not be written as 3 hours 75 minutes', 1],
      ['Reading a clock face belongs to grade 2', 1],
      ['multiplying and dividing amounts of time belongs to grade 5', 1]
    ],
    forbid: [
      '1 日 ＝ 60 小時', '一律滿 60 就進位', '每一個時刻都要加 12', '所有的時刻都加 12',
      '半夜 12 點是 12 時', '借 1 就是借 60',
      /* ⚠️ 'always add 12' 是正確句子「not always add 12」的子字串 —— 拿它當禁字
         會誤報。禁字一定要挑**不可能出現在正確句子裡**的那一句。 */
      '1 day = 60 hours', 'always add 12 to the clock-face', 'midnight is 12 on the 24-hour clock',
      /* codex 第一輪：這兩句在 12 點多的時刻上是假的，不可以再回來。 */
      '中午過後的時刻，鐘面上的數字加 12', '中午以前不用改',
      'a time after noon, add 12', 'before noon nothing changes',
      'borrowing 1 always gives you 60',
      /* 這一課的時間量一律是整數，連舉例也不可以出現小數。 */
      '1.5 小時 ＝ 1 小時 50 分', '1.5 hours is 1 hour 50 minutes'
    ],
    /* 階梯表要由大到小排：日 → 小時 → 分 → 秒。 */
    orderedZh: { table:'ladder', words:['日', '小時', '分', '秒'] }
  },
  'parents.html': {
    must: [
      ['24 時制', 2],
      ['借過來的 1 要換成那一級自己的滿數', 2],
      ['中午 12 點就是 12 時', 2],
      ['半夜 12 點是 0 時', 2],
      ['1 日 ＝ 24 小時，不是 60 小時', 2],
      ['0 時和 24 時指的是同一個瞬間', 2],
      ['借過來的 1 一直都是 10', 2],
      ['調度中心闖關', 2],
      ['時間量的乘除和小數時間（1.5 小時）是五年級', 2],
      ['the 1 you borrow turns into that rung’s own full number', 1],
      ['12 noon is simply 12', 1],
      ['12 midnight is 0', 1],
      ['1 day is 24 hours, not 60', 1],
      ['0 and 24 name the same instant', 1],
      ['the 1 borrowed is always 10', 1],
      /* codex 第一輪：三年級的時刻加減已經借過 60 分，所以「第一次借 1 不是 10」是假的。 */
      ['三年級的時刻加減已經借過 60 分', 2],
      ['Grade 3 already borrowed 60 minutes', 1],
      ['這一課加的時間量都不超過 24 小時', 2],
      ['at most 24 hours', 1],
      ['Control Room Challenge', 1],
      ['decimal hours (1.5 hours), belong to grade 5', 1]
    ],
    forbid: [
      '一律加 12 就好', '借 1 就是借 60',
      '這一課第一次出現', 'This is the first time borrowing 1 does not give 10',
      '這一課也教時間量的乘除', 'this lesson also covers multiplying',
      'you always add 12'
    ],
    orderedZh: null
  }
};

function checkBankAndSiblings(data, I18N, fail){
  const LANGS = ['zh', 'en'];
  const target = process.argv[2];

  /* --- 題庫：從題幹的參數重算一次正解 --- */
  Object.keys(BANK).forEach(bank => {
    const spec = BANK[bank];
    LANGS.forEach(L => {
      const items = I18N[L][bank];
      if (!Array.isArray(items) || items.length !== spec.length)
        return fail(bank + ' ' + L + ': ' + (items ? items.length : 'no') +
                    ' questions, the oracle describes ' + spec.length);
      for (let i = 0; i < spec.length; i++){
        if (!Object.prototype.hasOwnProperty.call(items, i)){
          fail(bank + '[' + i + '] ' + L + ': the question is missing (a hole in the array)');
          continue;
        }
        const q = items[i], e = spec[i];
        const stem = stripTags(q.stem);
        const why = stripTags(q.why);
        if (!Array.isArray(q.opts) || q.opts.length !== 4){
          fail(bank + '[' + i + '] ' + L + ': ' + (q.opts ? q.opts.length : 'no') + ' options, expected 4');
          continue;
        }
        for (let k = 0; k < 4; k++){
          if (!Object.prototype.hasOwnProperty.call(q.opts, k))
            fail(bank + '[' + i + '] ' + L + ': option ' + k + ' is a hole in the array');
        }
        if (/\d\.\d/.test(stem) || q.opts.some(o => /\d\.\d/.test(String(o))))
          fail(bank + '[' + i + '] ' + L + ': there is a decimal, but every time in this lesson is a whole number');
        if (NEG.test(stem) || q.opts.some(o => NEG.test(String(o))))
          fail(bank + '[' + i + '] ' + L + ': there is a negative number, but this lesson is all positive');

        /* 題幹問的是什麼，也要被盯著 —— 不然神諭只是在對位置。 */
        (e.stemMust ? e.stemMust[L] : []).forEach(cue => {
          if (stem.indexOf(cue) < 0)
            fail(bank + '[' + i + '] ' + L + ': the stem no longer says "' + cue +
                 '", so it may not be asking what the oracle assumes');
        });
        /* 題幹的數字集合必須**剛好是**神諭列的那些。 */
        const nums = numTokens(stem);
        if (sortedNums(nums) !== sortedNums(e.nums[L]))
          fail(bank + '[' + i + '] ' + L + ': stem prints [' + nums.join(',') +
               '], the oracle expects exactly [' + e.nums[L].join(',') + ']');

        /* 正解由參數重算。 */
        let want = null;
        if (e.kind === 'text') want = e.text[L];
        else if (e.kind === 'to24') want = clock24Ref(L, (e.period === 'pm') ? e.h12 + NOON_SHIFT : e.h12, e.m);
        else if (e.kind === 'to12') want = clock12Ref(L, READ_TABLE[e.h24][0], READ_TABLE[e.h24][1], e.m);
        else if (e.kind === 'toSmall') want = durRef(L, [e.units[1]], [toSmallRef(e.units, e.vals)]);
        else if (e.kind === 'toBig') want = durRef(L, e.units, fromSmallRef(e.units, e.total));
        else if (e.kind === 'compAdd') want = durRef(L, e.units, addRef(e.units, e.a, e.b));
        else if (e.kind === 'compSub') want = durRef(L, e.units, subRef(e.units, e.a, e.b));
        else if (e.kind === 'clockAdd' || e.kind === 'clockAddDay'){
          const t = e.start[0] * MIN_PER_HOUR + e.start[1] + e.add[0] * MIN_PER_HOUR + e.add[1];
          const day = Math.floor(t / MIN_PER_DAY);
          const h = Math.floor((t % MIN_PER_DAY) / MIN_PER_HOUR), m = t % MIN_PER_HOUR;
          if (e.kind === 'clockAdd'){
            if (day !== 0) fail(bank + '[' + i + '] ' + L + ': this question is written without a day tag, ' +
                                'but the answer falls on the next day');
            want = clock24Ref(L, h, m);
          } else {
            if (day !== 1) fail(bank + '[' + i + '] ' + L + ': this question promises the next day, ' +
                                'but the answer stays inside today');
            want = clockDayRef(L, day, h, m);
          }
        }
        else if (e.kind === 'clockDiff'){
          const diff = (e.to[0] * MIN_PER_HOUR + e.to[1]) - (e.from[0] * MIN_PER_HOUR + e.from[1]);
          if (diff < 1) fail(bank + '[' + i + '] ' + L + ': the end time is not after the start time');
          want = durRef(L, ['hour', 'min'], fromSmallRef(['hour', 'min'], diff));
        }
        else { fail(bank + '[' + i + '] ' + L + ': unknown oracle kind ' + e.kind); continue; }

        if (String(q.opts[q.ans]).trim() !== String(want))
          fail(bank + '[' + i + '] ' + L + ': marked answer is "' + q.opts[q.ans] + '", recomputed "' + want + '"');

        /* 選項的形狀與**依值**兩兩相異。 */
        if (e.shape !== 'text'){
          const tgt = (typeof e.shape === 'string') ? 'min' : e.shape.target;
          const wantKind = (typeof e.shape === 'string') ? e.shape : 'dur';
          const seen = {};
          q.opts.forEach(o => {
            const p = parseOpt(String(o), L);
            if (!p){
              fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is not one of this lesson\'s shapes');
              return;
            }
            if (reprint(p, L) !== String(o))
              fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is not spelled the way this lesson spells it');
            if (p.kind !== wantKind)
              fail(bank + '[' + i + '] ' + L + ': option "' + o + '" is a ' + p.kind + ', expected a ' + wantKind);
            if (p.kind === 'dur'){
              p.units.forEach(u => {
                if (e.shape.units.indexOf(u) < 0)
                  fail(bank + '[' + i + '] ' + L + ': option "' + o + '" uses the unit ' + u +
                       ', which this question never asks for');
              });
            }
            const v = optValue(p, tgt);
            if (seen[v] !== undefined)
              fail(bank + '[' + i + '] ' + L + ': options "' + seen[v] + '" and "' + o +
                   '" are the same length of time');
            seen[v] = String(o);
          });
        } else {
          const strs = q.opts.map(o => String(o).trim());
          strs.forEach(o => { if (!o) fail(bank + '[' + i + '] ' + L + ': an option is empty'); });
          if (new Set(strs).size !== strs.length)
            fail(bank + '[' + i + '] ' + L + ': duplicate option strings');
        }

        /* 解釋要把算式寫出來，也要把該講的字講出來。 */
        (e.whyExpr ? e.whyExpr[L] : []).forEach(expr => {
          if (why.indexOf(expr) < 0)
            fail(bank + '[' + i + '] ' + L + ': the explanation no longer shows "' + expr +
                 '", so the operation is unchecked');
        });
        e.whyMust[L].forEach(piece => {
          const ok = /^\d+$/.test(piece) ? printsNum(why, piece)
                                         : why.toLowerCase().indexOf(piece.toLowerCase()) >= 0;
          if (!ok) fail(bank + '[' + i + '] ' + L + ': the explanation never states "' + piece + '"');
        });
      }
    });
  });

  if (!target){
    fail('cannot locate the lesson file (no target path in argv) — the sibling-page and generator checks did not run');
    return;
  }

  /* --- review.html 的產生器清單 ---
     simgen 只跑「還在的」產生器，所以刪掉（或註解掉）一整支的話，
     它那一組不變條件、expectedCorrect 與 renderCheck 會一起靜靜消失。 */
  const rp = path.join(path.dirname(target), 'review.html');
  let rsrc = '';
  try { rsrc = fs.readFileSync(rp, 'utf8'); } catch (err){ rsrc = ''; }
  if (!rsrc) fail('cannot read review.html, so the generator inventory check did not run');
  else {
    const clean = rsrc.replace(/\/\*[\s\S]*?\*\//g, ' ');
    const found = (clean.match(/^\s*\{\s*id\s*:\s*['"][A-Za-z0-9_]+['"]\s*,/gm) || [])
      .map(m => /['"]([A-Za-z0-9_]+)['"]/.exec(m)[1]);
    /* ⚠️ 光數 id 是可以造假的：刪掉真的產生器、另外放一行 `{ id:'clockDiff',` 的
       字面文字，清單就湊回十二個，可是 simgen 從來沒跑過它（codex 第二輪）。
       所以連「有幾個 make／fmt」一起數。 */
    const makes = (clean.match(/\bmake\s*:\s*function\s*\(/g) || []).length;
    const fmts = (clean.match(/\bfmt\s*:\s*function\s*\(/g) || []).length;
    if (makes !== GEN_IDS.length)
      fail('review.html has ' + makes + ' make() functions, this config describes ' +
           GEN_IDS.length + ' generators — an id on its own is not a generator');
    if (fmts !== GEN_IDS.length)
      fail('review.html has ' + fmts + ' fmt() functions, this config describes ' + GEN_IDS.length + ' generators');
    GEN_IDS.forEach(id => {
      if (found.indexOf(id) < 0)
        fail('review.html no longer declares the generator "' + id + '", so every check written for it stopped running');
    });
    found.forEach(id => {
      if (GEN_IDS.indexOf(id) < 0)
        fail('review.html declares an extra generator "' + id + '" that this config has no invariants for');
    });
    if (found.length !== GEN_IDS.length)
      fail('review.html declares ' + found.length + ' generators, this config describes ' + GEN_IDS.length);
  }

  /* --- 產生器真的有在抽樣嗎？ ---
     每一條不變條件都只看 make() **回傳**的值，所以把一支產生器寫死成一個合法的
     參數組合，所有斷言都還是綠的，只是定義域整片消失（codex 第二輪）。
     這裡把參數池的宣告逐字釘住，並要求每一支 make() 真的呼叫 pick／pickUnused。 */
  if (rsrc){
    const POOL_DECLS = [
      'var H12_POOL  = rangeList(1, 11);', 'var MIN_POOL  = rangeList(1, 59);',
      'var H24_PM_POOL = rangeList(13, 23);', 'var DH_D_POOL = rangeList(2, 6);',
      'var DH_H_POOL = rangeList(1, 23);', 'var HM_H_POOL = rangeList(1, 5);',
      'var HM_M_POOL = rangeList(1, 59);', 'var MS_M_POOL = rangeList(1, 5);',
      'var MS_S_POOL = rangeList(1, 59);', 'var ADD_BIG_POOL = rangeList(2, 5);',
      'var SUB_BIG_POOL = rangeList(3, 6);', 'var CLOCK_H_POOL = rangeList(6, 23);',
      'var CLOCK_ADD_H  = rangeList(1, 4);', 'var DIFF_FROM_H  = rangeList(6, 11);',
      'var DIFF_TO_H    = rangeList(13, 22);'
    ];
    POOL_DECLS.forEach(d => {
      if (rsrc.indexOf(d) < 0)
        fail('review.html no longer declares the pool "' + d.trim() +
             '", so this config\'s bounds are describing a domain the generator does not use');
    });
    /* 每一支產生器的 make() 內文都要有 pick( 或 pickUnused( —— 寫死一組參數就會被抓到。 */
    const bodies = rsrc.split(/\n    \{ id:'/).slice(1);
    bodies.forEach(b => {
      const id = /^[A-Za-z0-9_]+/.exec(b);
      if (!id) return;
      const body = b.split(/\n      fmt:/)[0];
      if (!/\bpick[A-Za-z]*\s*\(/.test(body) && !/\bmakeSub\s*\(/.test(body))
        fail('the make() of generator "' + id[0] + '" never draws from a pool, so every batch ' +
             'would use the same numbers');
    });
  }

  /* --- 速查卡與家長頁的措辭 --- */
  const dir = path.dirname(target);
  Object.keys(SIBLING_RULES).forEach(page => {
    const rule = SIBLING_RULES[page];
    let html;
    try { html = fs.readFileSync(path.join(dir, page), 'utf8'); }
    catch (err){ fail('cannot read ' + page + ': ' + err.code); return; }
    html = html.replace(/<!--[\s\S]*?-->/g, ' ');   // 註解裡的字畫面上看不到
    const cut = html.indexOf('<script>');
    const markupHalf = cut >= 0 ? html.slice(0, cut) : html;
    const scriptHalf = cut >= 0 ? html.slice(cut) : '';
    rule.must.forEach(entry => {
      const t = entry[0], need = entry[1];
      const got = html.split(t).length - 1;
      if (got < need) fail(page + ' no longer says "' + t + '" the required number of times (' + got + ' of ' + need + ')');
      else if (need >= 2){
        if (markupHalf.split(t).length - 1 < 1)
          fail(page + ': "' + t + '" is gone from the visible markup (only the dictionary still carries it)');
        if (scriptHalf.split(t).length - 1 < 1)
          fail(page + ': "' + t + '" is gone from the dictionary (only the markup fallback still carries it)');
      }
    });
    /* 英文的禁字要不分大小寫比（'Borrowing 1 ALWAYS gives you 60' 也是同一句話）。 */
    const lower = html.toLowerCase();
    rule.forbid.forEach(t => {
      const hit = /[A-Za-z]/.test(t) ? lower.indexOf(t.toLowerCase()) >= 0 : html.indexOf(t) >= 0;
      if (hit) fail(page + ' says "' + t + '", which contradicts the rule this lesson teaches');
    });
    /* 「出現次數」可以用一個孩子看不到的節點湊到（codex 第二輪：把真的規則改成假的，
       再把必須出現的那一句塞進 <span hidden>）。這幾頁本來就沒有隱藏內容，所以直接禁掉。 */
    /* 只擋**元素上**的隱藏（hidden 屬性或行內 style），不擋 @media print 的樣式表 ——
       那一段是「印出來的時候不要印導覽」，是規範要求的。 */
    if (/<[^>]*\shidden[\s=>]/.test(html) || /style="[^"]*display\s*:\s*none/.test(html))
      fail(page + ' hides content from the reader; the required-wording counts can then be met by text nobody sees');
    if (rule.orderedZh){
      const tbl = html.match(new RegExp('<table class="' + rule.orderedZh.table + '">[\\s\\S]*?</table>'));
      if (!tbl){ fail(page + ' has no <table class="' + rule.orderedZh.table + '"> to check the order in'); return; }
      const at = rule.orderedZh.words.map(w => tbl[0].indexOf('>' + w + '<'));
      at.forEach((v, i) => { if (v < 0) fail(page + ' ladder table is missing a cell for ' + rule.orderedZh.words[i]); });
      for (let i = 1; i < at.length; i++){
        if (at[i - 1] >= 0 && at[i] >= 0 && at[i] < at[i - 1])
          fail(page + ' ladder table has ' + rule.orderedZh.words[i] + ' before ' + rule.orderedZh.words[i - 1]);
      }
    }
  });
}
