/* grade-2/math/time 的檢查設定。
   斷言的邊界一律取自這一課自己講出來的規則（時 1~12、分 0~59、一個數字 5 分、
   月份天數表），不是「看起來夠寬」的數字 —— numbers 那一課就是因為上限寫 9999
   才讓 1001 溜進 1000 以內的數。 */

const DIM = [31,28,31,30,31,30,31,31,30,31,30,31];
const WD_ZH = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
const WD_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
/* review.html 的 SCENES 在這裡獨立寫一次 —— 檢查腳本抄產生器的資料就等於沒檢查。 */
const SCENE_HALF = ['am','am','night','night'];
const SCENE_HOURS = [[6,7],[7,8],[6,7],[8,9]];

/* 每個產生器的選項長什麼樣子。正解與誘答分開驗：
   dateAfter 的「7 月 33 日」是刻意的誘答（忘記換月），但正解永遠是合法日期。 */
const SHAPE = {
  readClock:'time', readClockTrap:'time', halfPast:'time',
  minuteOfNumber:'min', numberOfMinute:'num',
  ampmLife:'ampm', weekdayAfter:'wd',
  daysInMonth:'monthdays', dateAfter:'date',
  weeksToDays:'days', birthdayCountdown:'days'
};

function checkShape(shape, s, lang, isCorrect, genId){
  let m;
  switch (shape){
    case 'time':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 點(?: (\d{1,2}) 分|整)$/) : s.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return 'not a clock time: ' + s;
      if (!(Number(m[1]) >= 1 && Number(m[1]) <= 12)) return 'hour outside 1~12: ' + s;
      if (m[2] !== undefined && !(Number(m[2]) >= 0 && Number(m[2]) <= 59)) return 'minute outside 0~59: ' + s;
      if (isCorrect && genId === 'halfPast' && Number(m[2]) !== 30) return 'half past must be :30, got ' + s;
      return null;
    case 'min':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 分$/) : s.match(/^(\d{1,2}) minutes$/);
      if (!m) return 'not a minute count: ' + s;
      if (!(Number(m[1]) >= 1 && Number(m[1]) <= 59)) return 'minutes outside 1~59: ' + s;
      if (isCorrect && Number(m[1]) % 5 !== 0) return 'the correct minute must be a multiple of 5: ' + s;
      return null;
    case 'num':
      if (!/^\d{1,2}$/.test(s)) return 'not a dial number: ' + s;
      if (!(Number(s) >= 1 && Number(s) <= 12)) return 'dial number outside 1~12: ' + s;
      if (isCorrect && Number(s) > 11) return 'the correct dial number here is 1~11 (12 would be 0 minutes): ' + s;
      return null;
    case 'ampm':
      m = (lang === 'zh') ? s.match(/^(上午|晚上) (\d{1,2}) 點$/) : s.match(/^(\d{1,2}):00 (a\.m\.|p\.m\.)$/);
      if (!m) return 'not an a.m./p.m. time: ' + s;
      { const h = Number(lang === 'zh' ? m[2] : m[1]);
        if (!(h >= 1 && h <= 12)) return 'hour outside 1~12: ' + s; }
      return null;
    case 'wd':
      if ((lang === 'zh' ? WD_ZH : WD_EN).indexOf(s) < 0) return 'not a weekday name: ' + s;
      return null;
    case 'monthdays':
      m = (lang === 'zh') ? s.match(/^(\d{2}) 天$/) : s.match(/^(\d{2}) days$/);
      if (!m) return 'not a day count: ' + s;
      if (isCorrect && [30, 31].indexOf(Number(m[1])) < 0) return 'a month (other than February) has 30 or 31 days, got ' + s;
      /* 誘答也必須是「某個月真的有的天數」—— 26 天、27 天不是月長，放進選項只是雜訊。 */
      if ([28, 29, 30, 31].indexOf(Number(m[1])) < 0) return 'not a real month length: ' + s;
      return null;
    case 'date':
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 月 (\d{1,2}) 日$/) : s.match(/^(\d{1,2}) ([A-Z][a-z]+)$/);
      if (!m) return 'not a date: ' + s;
      { const mo = (lang === 'zh') ? Number(m[1]) : MON_EN.indexOf(m[2]) + 1;
        const dd = Number(lang === 'zh' ? m[2] : m[1]);
        if (!(mo >= 1 && mo <= 12)) return 'month outside 1~12: ' + s;
        if (isCorrect){
          if (!(dd >= 1 && dd <= DIM[mo - 1])) return 'the correct date must really exist: ' + s;
        } else if (!(dd >= 1 && dd <= 35)){
          return 'distractor date wildly out of range: ' + s;
        } }
      return null;
    case 'days':
      /* 上限依產生器各自的參數推出來，不是隨手給一個大數：
         weeksToDays 的 k 是 2~5 → 7k 最大 35，誘答最多 7k+7 = 42；
         birthdayCountdown 的日期都在 1~31，誘答最多 n+7，也不可能超過 31。 */
      m = (lang === 'zh') ? s.match(/^(\d{1,2}) 天$/) : s.match(/^(\d{1,2}) days$/);
      if (!m) return 'not a day count: ' + s;
      { const hi = (genId === 'weeksToDays') ? 42 : 31;
        if (!(Number(m[1]) >= 1 && Number(m[1]) <= hi)) return 'day count outside 1~' + hi + ': ' + s; }
      return null;
    default:
      return 'NO SHAPE DEFINED for ' + genId;
  }
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/time
     每一筆都是「這條斷言真的會響嗎」的證據。改課程檔時如果 find 字串對不上，
     breaktest 會直接報 SETUP-FAIL —— 那也是要修的（斷言失去了保護對象）。 */
  breaks: [
    { file:'review', expect:'duplicate option value',
      find:'      if (!seen[k]){ seen[k] = true; out.push(c); }',
      replace:'      out.push(c);' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'the trap needs the long hand past 6',
      find:'        var n = 7 + rand(5);',
      replace:'        var n = 1 + rand(11);' },
    { file:'review', expect:'correct is not the minute count',
      find:'        var correct = m;\n        var cands = [n, m + 5, m - 5, m + 10]',
      replace:'        var correct = n;\n        var cands = [m, m + 5, m - 5, m + 10]' },
    { file:'review', expect:'February has 28 or 29 days',
      find:'        var mo = pickUnused([1,3,4,5,6,7,8,9,10,11,12], used);',
      replace:'        var mo = pickUnused([1,2,3,4,5,6,7,8,9,10,11,12], used);' },
    { file:'review', expect:'correct date is wrong',
      find:'        var correct = over ? { mo:mo + 1, d:y + n - len } : { mo:mo, d:y + n };',
      replace:'        var correct = { mo:mo, d:y + n };' },
    { file:'review', expect:'the scene does not happen in that half of the day',
      find:"    { icon:'🌆', half:'night', hours:[6,7],",
      replace:"    { icon:'🌆', half:'am', hours:[6,7]," },
    { file:'review', expect:'correct != 7 * k',
      find:'        var correct = 7 * k;',
      replace:'        var correct = 7 * k + 1;' },
    { file:'review', expect:'but the stem never says it',
      find:"            ? '半就是 30 分：長針指著 6，短針停在 '",
      replace:"            ? '「一共」就是 30 分：長針指著 6，短針停在 '" },
    { file:'review', expect:'hour outside 1~12',
      find:'        var h = pickUnused([1,2,3,4,5,6,7,8,9,10,11,12], used);\n        var n = 1 + rand(6);',
      replace:'        var h = pickUnused([0,1,2,3,4,5,6,7,8,9,10,11,12], used);\n        var n = 1 + rand(6);' },
    { file:'review', expect:'the birthday must still be ahead',
      find:'        var today = b - n;',
      replace:'        var today = b + n;' },
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? ('今天是 ' + mn + ' ' + d.today + ' 日。",
      replace:"            ? ('今天是' + mn + ' ' + d.today + ' 日。" },
    { file:'review', expect:'opts[ans] != correct',
      find:"  function dayStr(n, lang){ return lang === 'zh' ? (n + ' 天') : (n + ' days'); }",
      replace:"  function dayStr(n, lang){ return lang === 'zh' ? ((n + 1) + ' 天') : ((n + 1) + ' days'); }" },
    { file:'review', expect:'copied straight out of the stem',
      find:"            ? (d.m + ' 分的時候，長針指著哪個數字？')",
      replace:"            ? (d.m + ' 分的時候（不是 ' + (d.k + 1) + '），長針指著哪個數字？')" },
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"          stem: lang === 'zh' ? (d.k + ' 個星期有幾天？')",
      replace:"          stem: lang === 'zh' ? ('共<strong>' + d.k + '</strong>個星期有幾天？')" },
    { file:'review', expect:'not a real month length',
      find:'        var cands = [28,29,30,31].filter(function(x){ return x !== correct; });',
      replace:'        var cands = [26,28,29,30,31].filter(function(x){ return x !== correct; });' },
    { file:'review', expect:'day count outside 1~42',
      find:'        var cands = [ 7 * k - 7, 7 * k + 7, k + 7, 7 * k + 1 ]',
      replace:'        var cands = [ 7 * k - 7, 7 * k + 30, k + 7, 7 * k + 1 ]' },
    { file:'review', expect:'month outside 1~12',
      find:'        var mo = pickUnused([3,4,5,6,9,10,11], used);\n        var w0 = rand(7);',
      replace:'        var mo = pickUnused([3,4,5,6,9,10,13], used);\n        var w0 = rand(7);' },
    { file:'review', expect:'doubled punctuation',
      find:"            : ('One week is 7 days, so ' + d.k + ' weeks is ' + d.k + ' × 7 = ' + d.correct + ' days.')",
      replace:"            : ('One week is 7 days, so ' + d.k + ' weeks is ' + d.k + ' × 7 = ' + d.correct + ' days..')" },
    { file:'index', expect:'minute outside 1~59',
      find:'    { h:3,  m:50 },',
      replace:'    { h:3,  m:65 },' },
    { file:'index', expect:'the short hand is ON a number',
      find:'    { h:2,  m:10 },',
      replace:'    { h:2,  m:0 },' },
    { file:'index', expect:'does not name hour 7',
      find:"        { act:'起床', when:'上午 7 點', note:'同樣的鐘面，晚上 7 點是吃晚餐的時候。' },",
      replace:"        { act:'起床', when:'上午 8 點', note:'同樣的鐘面，晚上 8 點是吃晚餐的時候。' }," },
    { file:'index', expect:'but the question asks for 7:20',
      find:"    { ask:{ half:'am',    h:7,  m:20 }, opts:[{h:7,m:40},{h:7,m:20},{h:8,m:20}],  ans:1 },",
      replace:"    { ask:{ half:'am',    h:7,  m:20 }, opts:[{h:7,m:40},{h:7,m:20},{h:8,m:20}],  ans:0 }," },
    { file:'index', expect:'two options draw the same clock',
      find:"    { ask:{ half:'pm',    h:3,  m:50 }, opts:[{h:3,m:50},{h:4,m:50},{h:3,m:10}],  ans:0 },",
      replace:"    { ask:{ half:'pm',    h:3,  m:50 }, opts:[{h:3,m:50},{h:3,m:50},{h:3,m:10}],  ans:0 }," },
    { file:'index', expect:'should cover 28 / 30 / 31-day months',
      find:'  var CAL_MONTHS = [2, 6, 7];',
      replace:'  var CAL_MONTHS = [6, 9];' },
    { file:'index', expect:'ans differs zh=1 en=0',
      find:"          opts:['2 點 15 分','2 點 3 分','3 點 15 分','2 點 45 分'], ans:0,",
      replace:"          opts:['2 點 15 分','2 點 3 分','3 點 15 分','2 點 45 分'], ans:1," },
    { file:'index', expect:'duplicate option strings',
      find:"          opts:['5 天','7 天','12 天','30 天'], ans:1,",
      replace:"          opts:['7 天','7 天','12 天','30 天'], ans:1," }
  ],

  sim: {
    INVARIANTS: {
      readClock: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.m !== d.n * 5) return 'why says n fives, but m != n*5';
        if (!(d.n >= 1 && d.n <= 6)) return 'this generator promises the first half of the dial (1~6)';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
        if (d.correct.h !== d.h || d.correct.m !== d.m) return 'correct does not match the clock that is drawn';
      },
      readClockTrap: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.m !== d.n * 5) return 'why says n fives, but m != n*5';
        if (!(d.n >= 7 && d.n <= 11)) return 'the trap needs the long hand past 6 (35~55 minutes)';
        if (d.m < 35) return 'why says the hour hand is almost at the next number, but it is not';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
        if (d.correct.h !== d.h || d.correct.m !== d.m) return 'correct does not match the clock that is drawn';
      },
      minuteOfNumber: d => {
        if (!(d.n >= 1 && d.n <= 11)) return 'n outside 1~11';
        if (d.m !== d.n * 5) return 'm != n*5';
        if (d.correct !== d.m) return 'correct is not the minute count';
        if (!(d.h >= 1 && d.h <= 12)) return 'clock hour outside 1~12';
      },
      numberOfMinute: d => {
        if (!(d.k >= 1 && d.k <= 11)) return 'k outside 1~11';
        if (d.m !== d.k * 5) return 'm != k*5';
        if (d.correct !== d.k) return 'correct is not the dial number';
      },
      halfPast: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'raw hour outside 1~12';
        if (d.correct.m !== 30) return 'half past must be 30 minutes';
        if (d.correct.h !== d.h) return 'correct hour does not match the stem';
        if (d.nx !== (d.h % 12) + 1) return 'nx is not the next number on the dial';
      },
      ampmLife: d => {
        if (SCENE_HALF[d.si] !== d.half) return 'the scene does not happen in that half of the day';
        if (SCENE_HOURS[d.si].indexOf(d.h) < 0) return 'hour ' + d.h + ' is not one of the plausible hours for this scene';
        if (d.correct.h !== d.h || d.correct.half !== d.half) return 'correct does not match the clock that is drawn';
      },
      weekdayAfter: d => {
        if (!(d.w0 >= 0 && d.w0 <= 6)) return 'w0 is not a weekday index';
        if (!(d.mo >= 1 && d.mo <= 12)) return 'month outside 1~12';
        if (!(d.y >= 1 && d.y <= 28)) return 'start date outside 1~28';
        if (!(d.n >= 1 && d.n <= 6)) return 'n outside 1~6 (7 would land on the same weekday)';
        if (d.correct !== (d.w0 + d.n) % 7) return 'correct is not w0 + n days later';
        if (d.y + d.n > 28) return 'the second date may not exist in every month';
        if (d.mo === 2) return 'February is excluded from this lesson';
      },
      daysInMonth: d => {
        if (d.mo === 2) return 'February has 28 or 29 days — not a unique answer';
        if (d.correct !== DIM[d.mo - 1]) return 'correct is not the real length of month ' + d.mo;
      },
      dateAfter: d => {
        if (d.mo === 2 || d.mo === 12) return 'February and December are excluded (leap year / year rollover)';
        if (d.len !== DIM[d.mo - 1]) return 'len is not the real length of month ' + d.mo;
        if (!(d.y >= 1 && d.y <= d.len - 1)) return 'start date must leave at least one day in the month';
        if (!(d.n >= 2 && d.n <= 5)) return 'n outside 2~5';
        if (d.over !== (d.y + d.n > d.len)) return 'the over flag disagrees with the arithmetic';
        const want = d.over ? { mo:d.mo + 1, d:d.y + d.n - d.len } : { mo:d.mo, d:d.y + d.n };
        if (d.correct.mo !== want.mo || d.correct.d !== want.d) return 'correct date is wrong';
        if (d.correct.d < 1) return 'correct date is not a real day';
      },
      weeksToDays: d => {
        if (!(d.k >= 2 && d.k <= 5)) return 'k outside 2~5';
        if (d.correct !== 7 * d.k) return 'correct != 7 * k';
      },
      birthdayCountdown: d => {
        if (d.b <= d.today) return 'the birthday must still be ahead';
        if (d.correct !== d.b - d.today) return 'correct != birthday - today';
        if (d.n !== d.correct) return 'n and correct disagree';
        if (!(d.today >= 1 && d.b <= 31)) return 'dates outside 1~31';
      }
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (/undefined|NaN/.test(s)) return 'undefined/NaN option ' + s;
      return checkShape(SHAPE[genId], s, lang, isCorrect, genId);
    },
    /* 刻意的迷思誘答：題幹說「20 分」，選項就放 20 —— 那正是要抓的錯誤讀法。
       只有 k=1、2（5 分、10 分）時 5k 才落在 1~12，所以只有那兩種會觸發。 */
    stemEchoOk: {
      /* 只有「把題幹的分鐘數 m 本身當成盤面數字」這一個值是刻意的迷思誘答
         （只有 k=1、2 時 5k 才落在 1~12）。同一個產生器抄回別的數字仍然要報錯。 */
      numberOfMinute: function(d, opt){ return Number(opt) === d.m; }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不碰 review.html 的格式化函式 —— 那邊寫錯時這邊才會不一樣。 */
    expectedCorrect: function(d, genId, lang){
      const zh = (lang === 'zh');
      const time = (h, m) => zh ? (m === 0 ? (h + ' 點整') : (h + ' 點 ' + m + ' 分'))
                                : (h + ':' + (m < 10 ? '0' : '') + m);
      const mins = (n) => zh ? (n + ' 分') : (n + ' minutes');
      const days = (n) => zh ? (n + ' 天') : (n + ' days');
      const date = (mo, dd) => zh ? (mo + ' 月 ' + dd + ' 日') : (dd + ' ' + MON_EN[mo - 1]);
      switch (genId){
        case 'readClock':
        case 'readClockTrap':   return time(d.h, d.n * 5);
        case 'minuteOfNumber':  return mins(d.n * 5);
        case 'numberOfMinute':  return String(d.k);
        case 'halfPast':        return time(d.h, 30);
        case 'ampmLife':        return zh ? ((SCENE_HALF[d.si] === 'am' ? '上午 ' : '晚上 ') + d.h + ' 點')
                                          : (d.h + ':00 ' + (SCENE_HALF[d.si] === 'am' ? 'a.m.' : 'p.m.'));
        case 'weekdayAfter':    return (zh ? WD_ZH : WD_EN)[(d.w0 + d.n) % 7];
        case 'daysInMonth':     return days(DIM[d.mo - 1]);
        case 'dateAfter': {
          const len = DIM[d.mo - 1];
          return (d.y + d.n > len) ? date(d.mo + 1, d.y + d.n - len) : date(d.mo, d.y + d.n);
        }
        case 'weeksToDays':     return days(7 * d.k);
        case 'birthdayCountdown': return days(d.b - d.today);
        default: return 'NO EXPECTED-CORRECT DEFINED for ' + genId;
      }
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIVE_HOUR, HOUR_CASES, DAY_CASES, CAL_YEAR, CAL_MONTHS, ROUNDS, daysInMonth, firstWeekday, weekdayOf, minuteToNumber, clockSVG}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];

      /* --- 範例 1：長針一次走 5 分 --- */
      if (!(data.FIVE_HOUR >= 1 && data.FIVE_HOUR <= 12)) fail('FIVE_HOUR outside 1~12');
      LANGS.forEach(L => {
        for (let step = 1; step <= 11; step++){
          const t = I18N[L].fiveStep(step, step * 5, data.FIVE_HOUR);
          if (/undefined|NaN/.test(t)) fail(`fiveStep ${L} step ${step}: ${t}`);
          if (t.indexOf(String(step * 5)) < 0) fail(`fiveStep ${L} step ${step} never prints ${step * 5}`);
        }
        const end = I18N[L].fiveEnd(data.FIVE_HOUR + 1);
        if (end.indexOf('60') < 0) fail(`fiveEnd ${L} does not mention the 60 minutes of a full lap`);
      });

      /* --- 範例 2：短針卡在兩個數字中間 --- */
      let trap = 0, early = 0;
      data.HOUR_CASES.forEach(c => {
        if (!(c.h >= 1 && c.h <= 12)) fail(`HOUR_CASES hour ${c.h} outside 1~12`);
        if (c.m % 5 !== 0) fail(`HOUR_CASES ${c.h}:${c.m} minute is not a multiple of 5`);
        if (c.m === 0) fail(`HOUR_CASES ${c.h}:${c.m} — at an exact hour the short hand is ON a number, so the lesson point disappears`);
        if (!(c.m >= 1 && c.m <= 59)) fail(`HOUR_CASES ${c.h}:${c.m} minute outside 1~59`);
        const dial = data.minuteToNumber(c.m);
        if (dial * 5 !== c.m) fail(`minuteToNumber(${c.m}) is not the dial number`);
        if (!(dial >= 1 && dial <= 11)) fail(`HOUR_CASES ${c.h}:${c.m} dial number ${dial} outside 1~11`);
        if (c.m >= 35) trap++;
        if (c.m <= 15) early++;
        LANGS.forEach(L => {
          const nx = (c.h % 12) + 1;
          const a = I18N[L].s2Hour(c.h, nx, c.h);
          const b = I18N[L].s2Min(data.minuteToNumber(c.m), c.m);
          const d3 = I18N[L].s2Done(c.h, c.m);
          [a, b, d3].forEach(t => { if (/undefined|NaN/.test(t)) fail(`s2 text ${L} ${c.h}:${c.m}: ${t}`); });
          if (b.indexOf(String(c.m)) < 0) fail(`s2Min ${L} never prints ${c.m}`);
        });
      });
      if (!trap) fail('HOUR_CASES has no case where the short hand is nearly at the next number (the whole point of example 2)');
      if (!early) fail('HOUR_CASES has no easy case (minute hand in the first quarter)');

      /* --- 範例 3：上午／晚上。字典的 dayCases 和 DAY_CASES 是索引對齊的兩個陣列，
             所以要逐一驗「文字裡的鐘點就是畫出來的那個鐘點」。 --- */
      LANGS.forEach(L => {
        const dc = I18N[L].dayCases;
        if (!dc || dc.length !== data.DAY_CASES.length) fail(`${L} dayCases length != DAY_CASES length`);
        data.DAY_CASES.forEach((c, i) => {
          if (!(c.h >= 1 && c.h <= 12)) fail(`DAY_CASES[${i}] hour outside 1~12`);
          if (c.m !== 0) fail(`DAY_CASES[${i}] should be an exact hour`);
          const t = dc[i] || {};
          if (!t.act || !t.when || !t.note) fail(`${L} dayCases[${i}] incomplete`);
          if (t.when && t.when.indexOf(String(c.h)) < 0)
            fail(`${L} dayCases[${i}].when "${t.when}" does not name hour ${c.h} of the clock that is drawn`);
          if (t.note && t.note.indexOf(String(c.h)) < 0)
            fail(`${L} dayCases[${i}].note "${t.note}" does not name hour ${c.h}`);
        });
      });

      /* --- 範例 4：月曆。用一份獨立的天數表對照 Date 算出來的結果。 --- */
      const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      data.CAL_MONTHS.forEach(mo => {
        if (!(mo >= 1 && mo <= 12)) fail(`CAL_MONTHS ${mo} outside 1~12`);
        const want = (mo === 2 && leap(data.CAL_YEAR)) ? 29 : DIM[mo - 1];
        if (data.daysInMonth(data.CAL_YEAR, mo) !== want)
          fail(`daysInMonth(${data.CAL_YEAR}, ${mo}) = ${data.daysInMonth(data.CAL_YEAR, mo)}, expected ${want}`);
        const f = data.firstWeekday(data.CAL_YEAR, mo);
        if (!(f >= 0 && f <= 6)) fail(`firstWeekday(${data.CAL_YEAR}, ${mo}) = ${f}`);
        if (data.weekdayOf(data.CAL_YEAR, mo, 1) !== f) fail(`weekdayOf day 1 != firstWeekday for month ${mo}`);
        /* 差 7 天一定是同一個星期幾 —— 這是課程頁教的規則，也順便驗 weekdayOf。 */
        if (data.daysInMonth(data.CAL_YEAR, mo) >= 8 &&
            data.weekdayOf(data.CAL_YEAR, mo, 8) !== f)
          fail(`month ${mo}: day 8 is not the same weekday as day 1`);
      });
      if (data.CAL_MONTHS.map(mo => DIM[mo - 1]).filter((v, i, a) => a.indexOf(v) === i).length < 3)
        fail('CAL_MONTHS should cover 28 / 30 / 31-day months');

      /* --- 遊戲關卡 --- */
      const seen = {};
      data.ROUNDS.forEach((r, i) => {
        if (r.opts.length !== 3) fail(`ROUND ${i+1}: ${r.opts.length} clock options (spec 3)`);
        if (!(r.ans >= 0 && r.ans < r.opts.length)) fail(`ROUND ${i+1}: ans index out of range`);
        const win = r.opts[r.ans];
        if (!win || win.h !== r.ask.h || win.m !== r.ask.m)
          fail(`ROUND ${i+1}: opts[ans] is ${win && win.h}:${win && win.m}, but the question asks for ${r.ask.h}:${r.ask.m}`);
        r.opts.forEach((o, oi) => {
          if (!(o.h >= 1 && o.h <= 12)) fail(`ROUND ${i+1} option ${oi}: hour outside 1~12`);
          if (!(o.m >= 0 && o.m <= 59)) fail(`ROUND ${i+1} option ${oi}: minute outside 0~59`);
          if (oi !== r.ans && o.h === r.ask.h && o.m === r.ask.m)
            fail(`ROUND ${i+1} option ${oi}: a distractor shows exactly the asked time`);
        });
        const keys = r.opts.map(o => o.h + ':' + o.m);
        if (new Set(keys).size !== keys.length) fail(`ROUND ${i+1}: two options draw the same clock`);
        if (!(r.ask.m >= 0 && r.ask.m <= 59)) fail(`ROUND ${i+1}: asked minute outside 0~59`);
        seen[r.ans] = true;
        LANGS.forEach(L => {
          if (!I18N[L].halfName[r.ask.half]) fail(`ROUND ${i+1}: ${L} has no label for half "${r.ask.half}"`);
          if (!I18N[L].gHints2[i] || !I18N[L].gWhys[i]) fail(`ROUND ${i+1}: missing ${L} hint/why`);
          const w = I18N[L].whenText(r.ask.half, r.ask.h, r.ask.m);
          if (/undefined|NaN/.test(w)) fail(`ROUND ${i+1} ${L} whenText: ${w}`);
          if (w.indexOf(String(r.ask.h)) < 0) fail(`ROUND ${i+1} ${L} whenText "${w}" does not name hour ${r.ask.h}`);
        });
      });
      if (Object.keys(seen).length < 2) fail('every game round puts the answer in the same position');
    }
  }
};
