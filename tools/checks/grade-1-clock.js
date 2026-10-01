/* grade-1/math/clock 的檢查設定（時鐘：整點與半點、長針短針、生活作息）。

   這一課的題目是**畫出來的鐘**：review.html 的六個時鐘產生器把 clockSVG(h, m) 直接串進
   q.stem，index.html 的靜態題也是。資料層的 h、m 對不對只是一半 —— 孩子看到的是兩根針的
   **角度**。所以這裡的核心是 readClock()：從 SVG 的兩條 <line> 把時間**量回來**
   （長的那根是分針、短的是時針；時針的角度必須是 (h + m/60) × 30，半點時要走到兩數字中間），
   再和被標成正解的那個選項比。這一條不讀 d.h／d.m，讀的是畫面。靜態題那一側：每一種畫鐘的題型各有
   一條「鐘 → 答案」規則（幾點／靠近／哪一根針／一樣嗎／作息），鐘數不對或對不上任何規則都會響。

   選項數：readWhole／readHalf／activityMatch／placeValue／addSub 3 選項；
   minuteMeaning／compareCloser／sameTime 2 選項（要逐一列出）。

   ⚠️ readClock 認得的是這兩頁的 clockSVG 畫法（圓心在 size/2、兩條從圓心出發的 <line>）。
   畫法改了它會回報「讀不到」（fail closed），不會靜靜放行。
   ⚠️ 觀察（沒有修，也不是這裡守得到的）：compareCloser 的正解**永遠**是「半」那一個選項 ——
   題目每次換數字，但答案的位置雖然洗牌、答案的**種類**不變，孩子玩幾次就會學到「選有半的」。
   這是題型設計的事，記在 HANDOVER。 */

const { gameShuffleProblems } = require('./lib/gameshuffle.js');
const { canvasProblems } = require('./lib/canvas.js');

/* 生活作息的參考表（獨立於課程的 DAILY_G／DAILY，兩邊都拿這張對） */
const REF_DAILY = [
  { key:'wake',      h:7,  m:0,  icon:'🛌', zh:'起床',   en:'wake up' },
  { key:'breakfast', h:7,  m:30, icon:'🍳', zh:'吃早餐', en:'have breakfast' },
  { key:'school',    h:8,  m:0,  icon:'🎒', zh:'上學',   en:'go to school' },
  { key:'lunch',     h:12, m:0,  icon:'🍚', zh:'吃午餐', en:'have lunch' },
  { key:'sleep',     h:21, m:0,  icon:'😴', zh:'睡覺',   en:'go to sleep' }
];
const ZH_NUM = { '一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12 };

function hour12(h){ return ((h % 12) + 12) % 12 || 12; }
/* 這一課自己的時間唸法（第二套實作，不呼叫課程的 timeLabel）：zh「5 點」「5 點半」（中文和數字之間要有空格），
   en「5 o’clock」「half past 5」 */
function label(h, m, lang){
  h = hour12(h);
  if (lang === 'zh') return h + ' 點' + (m === 30 ? '半' : '');
  return m === 30 ? 'half past ' + h : h + ' o’clock';
}
/* 把一個選項字串讀成 {h, m}；讀不出來回 null。中文數字（三點半）也認。 */
function parseLabel(s){
  let m = s.match(/^(\d{1,2}) 點(半?)$/);
  if (m) return { h:Number(m[1]), m: m[2] ? 30 : 0 };
  m = s.match(/^(十一|十二|十|[一二三四五六七八九])點(半?)$/);
  if (m) return { h:ZH_NUM[m[1]], m: m[2] ? 30 : 0 };
  m = s.match(/^(\d{1,2}) o’clock$/);
  if (m) return { h:Number(m[1]), m:0 };
  m = s.match(/^half past (\d{1,2})$/);
  if (m) return { h:Number(m[1]), m:30 };
  return null;
}

/* ---------- 把鐘量回來 ---------- */
function svgsIn(html){ return String(html).match(/<svg[\s\S]*?<\/svg>/g) || []; }
function attrNum(tag, name){ const m = tag.match(new RegExp('(?:^|\\s)' + name + '="(-?[\\d.]+)"')); return m ? Number(m[1]) : null; }

/* 回 { h, m } 或 { error }。角度：12 點方向是 0°，順時針。 */
function readClock(svg){
  const root = (svg.match(/<svg\b[^>]*>/) || [])[0] || '';
  const size = attrNum(root, 'width');
  if (!size) return { error:'cannot read the clock size' };
  const cx = size / 2, cy = size / 2;
  const lines = [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map(m => m[1]);
  if (lines.length !== 2) return { error:'expected 2 hands, found ' + lines.length + ' <line>' };
  const hands = lines.map(a => {
    const x1 = attrNum(a, 'x1'), y1 = attrNum(a, 'y1'), x2 = attrNum(a, 'x2'), y2 = attrNum(a, 'y2');
    if ([x1, y1, x2, y2].some(v => v === null)) return null;
    if (Math.abs(x1 - cx) > 0.6 || Math.abs(y1 - cy) > 0.6) return { error:'a hand does not start at the centre' };
    const len = Math.hypot(x2 - cx, y2 - cy);
    let ang = Math.atan2(x2 - cx, cy - y2) * 180 / Math.PI;   /* 0° = 12 點方向 */
    if (ang < 0) ang += 360;
    return { len, ang, width: attrNum(a, 'stroke-width') || 1 };
  });
  if (hands.some(h => !h)) return { error:'a hand has unreadable coordinates' };
  const bad = hands.find(h => h.error); if (bad) return bad;
  hands.sort((a, b) => a.len - b.len);
  const hour = hands[0], minute = hands[1];
  if (minute.len - hour.len < size * 0.05) return { error:'the two hands are almost the same length — cannot tell hour from minute' };
  const m = Math.round(minute.ang / 6) % 60;
  if (Math.abs(minute.ang - m * 6) > 1.5) return { error:'minute hand at ' + minute.ang.toFixed(1) + '° is not on a minute mark' };
  /* 時針必須落在 (h + m/60) × 30 這個位置；半點時就是兩個數字中間。找不到這樣的 h 就是畫錯。 */
  let found = null;
  for (let h = 1; h <= 12; h++){
    const want = ((h % 12) + m / 60) * 30;
    let d = Math.abs(hour.ang - want); d = Math.min(d, 360 - d);
    if (d < 2){ found = h; break; }
  }
  if (found === null) return { error:'hour hand at ' + hour.ang.toFixed(1) + '° is not where a ' + m + '-minute clock puts it (must be (h + ' + m + '/60) × 30)' };
  return { h: found, m };
}

/* 鐘面本身：畫在畫布裡、針在圓裡、12 個數字在對的角度而且不相疊 */
function clockGeometryProblems(svg, tag){
  const out = [];
  canvasProblems(svg).forEach(p => out.push(tag + ': ' + p));
  const root = (svg.match(/<svg\b[^>]*>/) || [])[0] || '';
  const size = attrNum(root, 'width');
  if (!size){ out.push(tag + ': cannot read size'); return out; }
  const cx = size / 2, cy = size / 2;
  const circles = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map(m => attrNum(m[1], 'r')).filter(r => r !== null);
  if (!circles.length){ out.push(tag + ': no dial circle'); return out; }
  const R = Math.max.apply(null, circles);
  /* 針要留在錶面裡（含線寬） */
  [...svg.matchAll(/<line\b([^>]*)\/?>/g)].forEach(m => {
    const a = m[1];
    const x2 = attrNum(a, 'x2'), y2 = attrNum(a, 'y2'), w = attrNum(a, 'stroke-width') || 1;
    if (x2 === null || y2 === null) return;
    if (Math.hypot(x2 - cx, y2 - cy) + w / 2 > R - 2) out.push(tag + ': a hand reaches the rim of the dial');
  });
  /* 12 個數字：正好 1~12 各一個、每個都在自己的角度上、不貼錶框；相疊用字框投影判（見下） */
  const nums = [...svg.matchAll(/<text\b([^>]*)>(\d{1,2})<\/text>/g)].map(m => ({
    x: attrNum(m[1], 'x'), y: attrNum(m[1], 'y'), fs: attrNum(m[1], 'font-size'), v: Number(m[2])
  }));
  if (nums.length !== 12){ out.push(tag + ': expected 12 numerals, found ' + nums.length); return out; }
  if (nums.map(n => n.v).sort((a, b) => a - b).join() !== '1,2,3,4,5,6,7,8,9,10,11,12'){ out.push(tag + ': the numerals are not exactly 1..12 once each: ' + nums.map(n => n.v).join(',')); return out; }
  const byV = {};
  nums.forEach(n => {
    if (n.x === null || n.y === null || n.fs === null){ out.push(tag + ': numeral ' + n.v + ' has unreadable geometry'); return; }
    byV[n.v] = n;
    /* y 是基線，字的中心大約在 y − 0.36 em（clockSVG 就是這樣擺的） */
    let ang = Math.atan2(n.x - cx, cy - (n.y - n.fs * 0.36)) * 180 / Math.PI; if (ang < 0) ang += 360;
    let d = Math.abs(ang - (n.v % 12) * 30); d = Math.min(d, 360 - d);
    if (d > 3) out.push(tag + ': numeral ' + n.v + ' sits at ' + ang.toFixed(1) + '°, not at ' + (n.v % 12) * 30 + '°');
    if (Math.hypot(n.x - cx, n.y - cy) + n.fs * 0.6 > R) out.push(tag + ': numeral ' + n.v + ' reaches the rim');
  });
  /* 相疊要用**字框**判，不是圓心距離：兩個字框左右投影和上下投影都重疊才算疊在一起。每一對都比。
     字框尺寸是 2026-09-15 用無頭 Chrome 對課程頁的字型（PingFang TC 粗體）量 getBBox 校準的：
     數字的前進寬 0.60 em（0、2~9）、「1」0.41 em；getBBox 的高 1.43 em 是**行框**不是墨跡，
     數字的墨跡高約 0.72 em（大寫高），中心在基線上方 0.36 em —— 課程也是這樣擺的。
     用行框算會把 130 那個鐘的 2-3、10-11 判成相疊（實際墨跡沒碰到），所以這裡用墨跡：
     寬「1」0.42 em、其他 0.60 em，高 0.75 em。 */
  const digitW = ch => (ch === '1' ? 0.42 : 0.60);
  const box = n => {
    const hw = [...String(n.v)].reduce((a, ch) => a + digitW(ch), 0) * n.fs / 2;
    const cy2 = n.y - n.fs * 0.36, hh = n.fs * 0.375;
    return { x0:n.x - hw, x1:n.x + hw, y0:cy2 - hh, y1:cy2 + hh };
  };
  const list = Object.values(byV);
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++){
    const A = box(list[i]), B = box(list[j]);
    if (A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1)
      out.push(tag + ': numerals ' + list[i].v + ' and ' + list[j].v + ' have overlapping text boxes — they overlap');
  }
  return out;
}

/* 一個 stem 裡的每一個鐘：幾何 ＋ 量回來的時間 */
function clocksIn(stem, tag){
  const problems = [];
  const times = [];
  svgsIn(stem).forEach((svg, i) => {
    clockGeometryProblems(svg, tag + ' clock#' + (i + 1)).forEach(p => problems.push(p));
    const r = readClock(svg);
    if (r.error) problems.push(tag + ' clock#' + (i + 1) + ': ' + r.error);
    else times.push(r);
  });
  return { problems, times };
}

/* 從 index.html 切出 `var NAME = [...]` 或 `{...}` */
function extractVar(src, name){
  const m = src.match(new RegExp('var ' + name + ' = ([\\[{][\\s\\S]*?[\\]}]);'));
  if (!m) throw new Error('cannot find var ' + name + ' in source');
  return new Function('return ' + m[1] + ';')();
}

module.exports = {
  breaks: [
    /* ---- index.html ---- */
    { file:'index', expect:'DAILY',
      find:"    { key:'lunch', h:12, m:0 },",
      replace:"    { key:'lunch', h:11, m:0 }," },
    /* 靜態題：鐘畫的是 3 點，正解卻標到「2 點」—— 只有把鐘量回來才看得到。 */
    { file:'index', expect:'marked answer',
      find:"        { stem:'看時鐘，現在幾點？' + clockSVG(3, 0), opts:['3 點','2 點','4 點'], ans:0,",
      replace:"        { stem:'看時鐘，現在幾點？' + clockSVG(3, 0), opts:['3 點','2 點','4 點'], ans:1," },
    /* 時針忘了 m/60 那一項：半點時時針停在整點的位置，量回來對不上。 */
    { file:'index', expect:'not where a 30-minute clock puts it',
      find:'    var hourAngle = ((h % 12) + m / 60) * 30;\n    var minAngle = m * 6;\n    var hp = polar(cx, cy, hourAngle, r * 0.52);\n    var mp = polar(cx, cy, minAngle, r * 0.82);\n    var hourColor',
      replace:'    var hourAngle = (h % 12) * 30;\n    var minAngle = m * 6;\n    var hp = polar(cx, cy, hourAngle, r * 0.52);\n    var mp = polar(cx, cy, minAngle, r * 0.82);\n    var hourColor' },
    /* 鐘面數字字級寫死成 30：「10」「11」的墨跡就疊在一起（字還在畫布裡，所以一定會響到相疊那一條；
       110 的小鐘上同時也會貼到錶框，那一條一起響沒關係）。 */
    { file:'index', expect:'they overlap',
      find:'    var numFS = size * 16 / 168;\n    var numR = r * 50 / 70;',
      replace:'    var numFS = 30;\n    var numR = r * 50 / 70;' },

    /* --- 小遊戲（2026-10-01 改成五關五種玩法）：每一條新的不變量一筆 --- */
    { file:'index', expect:'GAME_ORDER should be',
      find:"var GAME_ORDER = ['set', 'find', 'half', 'match', 'day'];", replace:"var GAME_ORDER = ['find', 'set', 'half', 'match', 'day'];" },
    { file:'index', expect:'gAsks.day missing in zh',
      find:"        day:'第 5 關", replace:"        dayX:'第 5 關" },
    { file:'index', expect:'gWin missing in en',
      find:"      gWin:function(score){ return 'All 5 rounds cleared!", replace:"      gWin0:function(score){ return 'All 5 rounds cleared!" },
    { file:'index', expect:'五關全破',
      find:"return '五關全破！一共收集了 '", replace:"return '過關！一共收集了 '" },
    { file:'index', expect:'renderTray() renders its options without shuffle',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
    /* 時鐘模型 */
    { file:'index', expect:'reads back as',
      find:"return clockSVG(Math.floor(T / 60), T % 60, { size: size });", replace:"return clockSVG(Math.floor(T / 60), 0, { size: size });" },
    { file:'index', expect:'mid-turn',
      find:"T = normT(T); return clockSVG(", replace:"T = Math.round(normT(T) / 30) * 30; return clockSVG(" },
    { file:'index', expect:'the grab ring is not on the drawn hand tip',
      find:"polar(cx, cy, T / 2, r * 0.52)", replace:"polar(cx, cy, T / 2, r * 0.6)" },
    { file:'index', expect:'must not count',
      find:"    if (which === 'min' && Math.abs(T - s) * 6 > LONG_TOL) return null;\n", replace:"" },
    { file:'index', expect:'LONG_TOL',
      find:"KNOB = 48, LONG_TOL = 20,", replace:"KNOB = 48, LONG_TOL = 35," },
    { file:'index', expect:'grab ring (KNOB',
      find:"KNOB = 48, LONG_TOL = 20,", replace:"KNOB = 40, LONG_TOL = 20," },
    { file:'index', expect:'release accepts any time',
      find:"      if (normT(s) !== normT(c.to)){ roundMiss(c.wrong(normT(s))); return; }\n", replace:"" },
    { file:'index', expect:'a geared clock',
      find:"return which === 'hour' ? 2 : 1 / 6;", replace:"return which === 'hour' ? 1 : 1 / 6;" },
    { file:'index', expect:'angle unwrap',
      find:"    if (d > 180) d -= 360; else if (d < -180) d += 360;\n    return d;", replace:"    return d;" },
    { file:'index', expect:'does not reach half past',
      find:"      if (s !== null && normT(s) === normT(target)) turn = t;", replace:"      if (false) turn = t;" },
    { file:'index', expect:'tapping 12 with the long hand',
      find:"    if (Math.abs(Math.abs(turn) - 180) > LONG_TOL) return T + turn * rt;", replace:"" },
    { file:'index', expect:'tap aimed at 6 rule too loose',
      find:"    if (Math.abs(Math.abs(turn) - 180) > LONG_TOL) return T + turn * rt;", replace:"    if (which === 'hour' && Math.abs(turn) < 40) return target;\n    if (Math.abs(Math.abs(turn) - 180) > LONG_TOL) return T + turn * rt;" },
    { file:'index', expect:'center re-anchor missing',
      find:"        if (da === null) return;\n", replace:"" },
    { file:'index', expect:'every coalesced pointer sample',
      find:"var pts = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents().map(function(ce){ return B.toBoard(ce); }) : [p];", replace:"var pts = [p];" },
    { file:'index', expect:'an oblique jump',
      find:"    if (nx * nx + ny * ny < CENTER_SKIP * CENTER_SKIP) return null;", replace:"    if (nx * nx + ny * ny < 1) return null;" },
    { file:'index', expect:'must not count as a half turn',
      find:"    if (nx * nx + ny * ny < CENTER_SKIP * CENTER_SKIP) return null;", replace:"    if (b.x * 0 + (b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy) < CENTER_SKIP * CENTER_SKIP) return null;" },
    { file:'index', expect:'CENTER_SKIP',
      find:"LONG_TOL = 20, CENTER_SKIP = 30;", replace:"LONG_TOL = 20, CENTER_SKIP = 50;" },
    { file:'index', expect:'second hint must follow',
      find:"return open.m ? d.gMatch2(open.h, next12(open.h)) : d.gMatch2w(open.h);", replace:"return d.gMatch2(g.half, next12(g.half));" },
    { file:'index', expect:'gMatch2w',
      find:"return '短針指著 ' + k + '、長針指著 12 的鐘，是「' + k + ' 點」。';", replace:"return '短針指著 ' + k + '、長針指著 12 的鐘。';" },
    { file:'index', expect:'the daily table says',
      find:"{ k:'breakfast', am:true, icon:'🍳', h:7, m:30 }", replace:"{ k:'breakfast', am:true, icon:'🍳', h:8, m:30 }" },
    { file:'index', expect:'same clock time',
      find:"{ k:'dinner', am:false, icon:'🍽️', h:7, m:0, pair:true }", replace:"{ k:'dinner', am:false, icon:'🍽️', h:6, m:0, pair:true }" },
    { file:'index', expect:'always deal the same-time pair',
      find:"return p.concat(shuffle(GAME_DAY.filter(function(a){ return a.am === isAm && !a.pair; })).slice(0, 2 - p.length));", replace:"return shuffle(GAME_DAY.filter(function(a){ return a.am === isAm; })).slice(0, 2);" },
    { file:'index', expect:'cards do not show the time',
      find:"text:tl(a.h, a.m) + '\\n' + a.icon", replace:"text:a.icon" },
    /* 第 1 關：撥整點 */
    { file:'index', expect:'snap to whole hours',
      find:"step:60, offMsg:d.gSetLong", replace:"step:30, offMsg:d.gSetLong" },
    { file:'index', expect:'must name the hour',
      find:"d.gSetWrong(Math.floor(t / 60) || 12, g.to)", replace:"d.gSetWrong(g.to, g.to)" },
    { file:'index', expect:'two different hours',
      find:"{ from:3, to:7 }", replace:"{ from:7, to:7 }" },
    { file:'index', expect:'grab rings overlap',
      find:"{ from:9, to:4 }", replace:"{ from:12, to:4 }" },
    { file:'index', expect:'gSetWrong(',
      find:"'，這是 ' + k + ' 點，不是 ' + h + ' 點。'", replace:"'，這是 ' + h + ' 點，不是 ' + h + ' 點。'" },
    { file:'index', expect:'gSetLong zh does not say',
      find:"說「幾點」的是短針，轉短針就好。", replace:"說「幾點」的是另一根針。" },
    /* 第 2 關：找半點 */
    { file:'index', expect:'the half past clocks sit in fixed places',
      find:"shuffle(all).forEach(function(t, i){", replace:"all.forEach(function(t, i){" },
    { file:'index', expect:'gFindSix',
      find:"roundMiss(t.h === 6 ? d.gFindSix : d.gFindWhole(t.h))", replace:"roundMiss(d.gFindWhole(t.h))" },
    { file:'index', expect:'clock cells overlap',
      find:"addZone(B, 2 + (i % 2) * 150,", replace:"addZone(B, 2 + (i % 2) * 140," },
    { file:'index', expect:'does not fit inside its cell',
      find:"FIND_CLOCK = 136,", replace:"FIND_CLOCK = 146," },
    { file:'index', expect:'no 6 o’clock',
      find:"{ half:[2, 9], whole:[6, 4] }", replace:"{ half:[2, 9], whole:[5, 4] }" },
    { file:'index', expect:'not 4 different times',
      find:"{ half:[5, 12], whole:[6, 11] }", replace:"{ half:[5, 5], whole:[6, 11] }" },
    { file:'index', expect:'gFindSix en does not say',
      find:"the hand on 6 is the SHORT hand", replace:"the hand on 6 is the hour hand" },
    /* 第 3 關：撥半點 */
    { file:'index', expect:'the half target is not half past',
      find:"to:h * 60 + 30, step:30", replace:"to:h * 60 + 60, step:30" },
    { file:'index', expect:'between j and j+1',
      find:"return t % 60 ? d.gHalfWrongHalf(k, next12(k), h)", replace:"return t % 60 ? d.gHalfWrongHalf(next12(k), k, h)" },
    { file:'index', expect:'GAME_HALF[2]: at the start the two grab rings overlap',
      find:"var GAME_HALF = [3, 8, 10, 2, 7, 4];", replace:"var GAME_HALF = [3, 8, 12, 2, 7, 4];" },
    { file:'index', expect:'gHalfWrongHalf(',
      find:"return '短針在 ' + j + ' 和 ' + nj + ' 中間", replace:"return '短針在 ' + nj + ' 和 ' + j + ' 中間" },
    { file:'index', expect:'gHalfLong zh does not say',
      find:"gHalfLong:'半點的時候，長針指著 6。'", replace:"gHalfLong:'半點的時候，長針要轉一下。'" },
    /* 第 4 關：時間卡配對 */
    { file:'index', expect:'the next-number trap',
      find:"{ h:next12(g.half), m:30 }];", replace:"{ h:g.half, m:0 }];" },
    { file:'index', expect:'two clocks without shuffle',
      find:"var targets = shuffle([", replace:"var targets = ([" },
    { file:'index', expect:'describe THAT clock',
      find:"d.gMatchWhyHalf(hit.h, next12(hit.h), card)", replace:"d.gMatchWhyHalf(hit.h, hit.h, card)" },
    { file:'index', expect:'the two clocks overlap',
      find:"var cx = i ? 222 : 78;", replace:"var cx = i ? 200 : 78;" },
    { file:'index', expect:'match: cards in the tray overlap',
      find:"      }, 140, 2);", replace:"      }, 120, 2);" },
    { file:'index', expect:'tray is inside the drop targets',
      find:"renderTray(B, cards, 244,", replace:"renderTray(B, cards, 228," },
    { file:'index', expect:'does not fit its slot',
      find:"addZone(B, cx - 64, 152, 128, 54, 'gslot')", replace:"addZone(B, cx - 64, 152, 100, 54, 'gslot')" },
    { file:'index', expect:'must be hours 1..12',
      find:"{ half:4, whole:9 }", replace:"{ half:4, whole:13 }" },
    { file:'index', expect:'timeLabel(',
      find:"timeLabel:function(h, m){ return h + ' 點' + (m === 30 ? '半' : ''); },", replace:"timeLabel:function(h, m){ return h + '點' + (m === 30 ? '半' : ''); }," },
    { file:'index', expect:'gMatchWhyWhole',
      find:"、短針指著 ' + k + '，不是「'", replace:"、短針指著 ' + (k + 1) + '，不是「'" },
    /* 第 5 關：早上還是晚上 */
    { file:'index', expect:'is marked evening',
      find:"{ k:'school', am:true, icon:'🎒',", replace:"{ k:'school', am:false, icon:'🎒'," },
    { file:'index', expect:'bed/sleep glyph',
      find:"{ k:'wake', am:true, icon:'⏰',", replace:"{ k:'wake', am:true, icon:'🛌'," },
    { file:'index', expect:'gDayWhy zh',
      find:"'，不是' + (am ? '晚上' : '早上') + '。'", replace:"'，不是' + (am ? '早上' : '晚上') + '。'" },
    { file:'index', expect:'gDayWhy(act, a.am)',
      find:"roundMiss(d.gDayWhy(act, a.am)); return false;", replace:"roundMiss(d.gDayWhy(act, hit.am)); return false;" },
    { file:'index', expect:'day: placed cards overlap',
      find:"74 + hit.n * 58", replace:"74 + hit.n * 40" },
    { file:'index', expect:'tray is inside a box',
      find:"renderTray(B, left, 214,", replace:"renderTray(B, left, 196," },
    { file:'index', expect:'gAct.stars missing in en',
      find:"stars:'look at the stars'", replace:"starz:'look at the stars'" },

    /* ---- review.html ---- */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var wrongs = pickHours(2, [h]);\n        var opts = shuffle([h].concat(wrongs));\n        return { h:h, opts:opts, ans:opts.indexOf(h) };',
      replace:'        var wrongs = pickHours(2, [h]);\n        var opts = shuffle([h].concat(wrongs));\n        return { h:h, opts:opts, ans:(opts.indexOf(h) + 1) % 3 };' },
    /* 半點題畫成整點的鐘：資料說 h 點半、圖畫的是 h 點 —— 只有量回來才看得到。 */
    { file:'review', expect:'clock#1 shows',
      find:"          stem: (lang === 'zh' ? '看時鐘，現在幾點半？' : 'Look at the clock — what time is it?') + clockSVG(d.h, 30),",
      replace:"          stem: (lang === 'zh' ? '看時鐘，現在幾點半？' : 'Look at the clock — what time is it?') + clockSVG(d.h, 0)," },
    { file:'review', expect:'m does not match pos',
      find:'        var m = pos === 12 ? 0 : 30;',
      replace:'        var m = pos === 12 ? 30 : 0;' },
    /* compareCloser 兩個鐘要一個整點一個半點 */
    { file:'review', expect:'compareCloser clocks show',
      find:"            + clockSVG(d.h, 0) + clockSVG(d.h, 30),",
      replace:"            + clockSVG(d.h, 0) + clockSVG(d.h, 0)," },
    /* 作息表寫錯（起床 7 點 → 6 點）：鐘會畫成 6 點，量回來和「起床 = 7 點」對不上。 */
    { file:'review', expect:'activityMatch clock#1 shows',
      find:"    { h:7, m:0, icon:'🛌', zh:'起床', en:'wake up' },",
      replace:"    { h:6, m:0, icon:'🛌', zh:'起床', en:'wake up' }," },
    { file:'review', expect:'same flag',
      find:'        var shownH = same ? factH : pickHours(1, [factH])[0];',
      replace:'        var shownH = same ? pickHours(1, [factH])[0] : factH;' },
    { file:'review', expect:'opts[ans] != correct',
      find:'        var correct = askTens ? tens : ones;',
      replace:'        var correct = askTens ? ones : tens;' },
    { file:'review', expect:'ans != a + b',
      find:"          ans = a + b; op = '+';",
      replace:"          ans = a + b + 1; op = '+';" },
    /* addSub 的誘答不可以抄題幹上的 a、b；把那一行的 a、b 拿掉，±1 保底又會撞回去。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'        var seen = {}; seen[String(ans)] = true; seen[String(a)] = true; seen[String(b)] = true;',
      replace:'        var seen = {}; seen[String(ans)] = true;' },
    /* review 那一份 clockSVG 的時針公式 */
    { file:'review', expect:'not where a 30-minute clock puts it',
      find:'    var hourAngle = ((h % 12) + m / 60) * 30;\n    var minAngle = m * 6;\n    var hp = polar(cx, cy, hourAngle, r * 0.52);\n    var mp = polar(cx, cy, minAngle, r * 0.82);\n    var svg =',
      replace:'    var hourAngle = (h % 12) * 30;\n    var minAngle = m * 6;\n    var hp = polar(cx, cy, hourAngle, r * 0.52);\n    var mp = polar(cx, cy, minAngle, r * 0.82);\n    var svg =' },
    /* 字級放大到 22/130：相鄰數字相疊但還在畫布裡（40/130 會先出界，響的就不是這一條了）。 */
    { file:'review', expect:'they overlap',
      find:'    var numFS = size * 14 / 130;\n    var numR = r * 33 / 51;',
      replace:'    var numFS = size * 22 / 130;\n    var numR = r * 33 / 51;' }
  ],

  sim: {
    optCount: { minuteMeaning: 2, compareCloser: 2, sameTime: 2, '*': 3 },
    /* GENS 的 fmt() 要用到最前面的 clockSVG／polar，還有 工具 段的 timeLabel 與 DAILY_G。 */
    blockStart: '  /* ---------- 時鐘 SVG（跟上課頁用同一套角度公式） ---------- */',
    INVARIANTS: {
      readWhole: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'h outside 1~12';
        if (d.opts.length !== 3 || new Set(d.opts).size !== 3 || d.opts.some(v => !(v >= 1 && v <= 12))) return 'opts are not 3 distinct hours';
        if (d.opts[d.ans] !== d.h) return 'ans does not point at h';
      },
      readHalf: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'h outside 1~12';
        if (d.opts.length !== 3 || new Set(d.opts).size !== 3 || d.opts.some(v => !(v >= 1 && v <= 12))) return 'opts are not 3 distinct hours';
        if (d.opts[d.ans] !== d.h) return 'ans does not point at h';
      },
      minuteMeaning: d => {
        if (d.pos !== 12 && d.pos !== 6) return 'pos is not 12 or 6';
        if (d.m !== (d.pos === 12 ? 0 : 30)) return 'm does not match pos (12 → 0, 6 → 30)';
        if (d.isWhole !== (d.pos === 12)) return 'isWhole does not match pos';
        if (d.opts.slice().sort().join() !== 'half,whole') return 'opts are not whole/half';
        if (d.opts[d.ans] !== (d.pos === 12 ? 'whole' : 'half')) return 'ans does not match pos';
      },
      compareCloser: d => {
        if (!(d.h >= 1 && d.h <= 12)) return 'h outside 1~12';
        if (d.opts.slice().sort().join() !== 'half,whole') return 'opts are not whole/half';
        if (d.opts[d.ans] !== 'half') return 'the closer-to-next-numeral time is the half hour';
      },
      activityMatch: d => {
        if (!(d.idx >= 0 && d.idx < REF_DAILY.length)) return 'idx outside the daily table';
        if (d.opts.length !== 3 || new Set(d.opts).size !== 3) return 'opts are not 3 distinct activities';
        if (d.opts[d.ans] !== d.idx) return 'ans does not point at idx';
      },
      sameTime: d => {
        if (!(d.factH >= 1 && d.factH <= 12 && d.shownH >= 1 && d.shownH <= 12)) return 'hours outside 1~12';
        if (d.same !== (d.factH === d.shownH)) return 'same flag does not match factH/shownH';
      },
      placeValue: d => {
        if (!(d.num >= 10 && d.num <= 99)) return 'num outside 10~99';
        if (d.tens !== Math.floor(d.num / 10) || d.ones !== d.num % 10) return 'tens/ones are not the digits of num';
        if (d.opts.length !== 3 || new Set(d.opts).size !== 3 || d.opts.some(v => !(v >= 0 && v <= 9))) return 'opts are not 3 distinct digits';
      },
      addSub: d => {
        if (d.op === '+'){
          if (!(d.a >= 1 && d.a <= 9 && d.b >= 1 && d.b <= 9)) return 'addends outside 1~9';
          if (d.ans !== d.a + d.b) return 'ans != a + b';
        } else if (d.op === '−'){
          if (!(d.a >= 10 && d.a <= 20 && d.b >= 1 && d.b < d.a)) return 'subtraction operands outside the lesson range';
          if (d.ans !== d.a - d.b) return 'ans != a - b';
        } else return 'unknown op ' + d.op;
        if (d.ans > 20) return 'result above 20';
        if (d.opts.length !== 3 || new Set(d.opts).size !== 3) return 'opts are not 3 distinct numbers';
      }
    },
    /* 正解的第二套實作。每一行上面的註解是「孩子看到的題目」；時間唸法用這個檔案自己的 label()。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        /* 鐘畫 h 點整，「現在幾點？」 */
        case 'readWhole':     return label(d.h, 0, lang);
        /* 鐘畫 h 點半，「現在幾點半？」 */
        case 'readHalf':      return label(d.h, 30, lang);
        /* 「長針指著 pos，這是整點還是半點？」 */
        case 'minuteMeaning': return d.pos === 12 ? (lang === 'zh' ? '整點' : 'o’clock') : (lang === 'zh' ? '半點' : 'half past');
        /* 「h 點和 h 點半，短針比較靠近下一個數字的是哪一個？」—— 永遠是半點 */
        case 'compareCloser': return label(d.h, 30, lang);
        /* 鐘畫某個作息的時間，「這是做什麼的時間？」—— 查這個檔案自己的作息表 */
        case 'activityMatch': { const r = REF_DAILY[d.idx]; return r.icon + (lang === 'zh' ? r.zh : r.en); }
        /* 「上學時間是 factH 點整。〔鐘畫 shownH〕現在的時間跟上學時間一樣嗎？」 */
        case 'sameTime':      return d.factH === d.shownH ? (lang === 'zh' ? '一樣' : 'Yes, the same') : (lang === 'zh' ? '不一樣' : 'No, different');
        /* 「num 裡面，有幾個十／一？」 */
        case 'placeValue':    return String(d.askTens ? Math.floor(d.num / 10) : d.num % 10);
        /* 「a + b = ?」／「a − b = ?」 */
        case 'addSub':        return String(d.op === '+' ? d.a + d.b : d.a - d.b);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId, lang){
      switch (genId){
        case 'readWhole': { const p = parseLabel(s); return (p && p.m === 0 && p.h >= 1 && p.h <= 12) ? null : ('unexpected time label ' + s); }
        case 'readHalf':
        case 'compareCloser': { const p = parseLabel(s); return (p && p.h >= 1 && p.h <= 12) ? null : ('unexpected time label ' + s); }
        case 'minuteMeaning': return (lang === 'zh' ? ['整點','半點'] : ['o’clock','half past']).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'activityMatch': return REF_DAILY.some(r => s === r.icon + (lang === 'zh' ? r.zh : r.en)) ? null : ('unexpected activity ' + s);
        case 'sameTime': return (lang === 'zh' ? ['一樣','不一樣'] : ['Yes, the same','No, different']).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'placeValue': return /^[0-9]$/.test(s) ? null : ('option ' + s + ' is not a single digit');
        case 'addSub': return (/^\d+$/.test(s) && Number(s) <= 20) ? null : ('option ' + s + ' outside 0~20');
        default: return 'unknown genId ' + genId;
      }
    },
    /* 沒有刻意抄題幹的誘答：時間題的選項是「5 點半」這種字串，不會和題幹數字整個相等；
       placeValue 的選項是個位數，題幹印的是兩位數；addSub 的 a、b 已經在 review.html 擋掉。 */
    stemEchoOk: {},
    /* 把鐘量回來，和正解比。這一條不看 d.h／d.m，看的是 <line> 的角度。 */
    renderCheck: function(d, q, lang, genId){
      const noClock = ['placeValue', 'addSub'];
      const { problems, times } = clocksIn(q.stem, genId);
      /* 幾何問題常常一次好幾條（相疊、貼邊）；全部報出來，不要只報第一條 —— 改壞測試要靠訊息對得上 */
      if (problems.length) return problems.slice(0, 4).join(' | ');
      if (noClock.indexOf(genId) >= 0){ return times.length ? genId + ' unexpectedly draws a clock' : null; }
      const want = q.opts[q.ans];
      switch (genId){
        case 'readWhole':
        case 'readHalf': {
          if (times.length !== 1) return genId + ' should draw exactly 1 clock, drew ' + times.length;
          const p = parseLabel(want);
          if (!p) return 'cannot parse the marked answer "' + want + '"';
          if (times[0].h !== p.h || times[0].m !== p.m) return genId + ' clock#1 shows ' + times[0].h + ':' + times[0].m + ' but the marked answer reads ' + want;
          return null;
        }
        case 'minuteMeaning': {
          if (times.length !== 1) return 'minuteMeaning should draw exactly 1 clock';
          const stemPos = Number((q.stem.replace(/<svg[\s\S]*?<\/svg>/g, '').match(/(\d+)/) || [])[1]);
          if (times[0].m !== (stemPos === 12 ? 0 : 30)) return 'minuteMeaning clock#1 minute hand shows ' + times[0].m + ' but the stem says the long hand points at ' + stemPos;
          const isWhole = times[0].m === 0;
          const wantLabel = isWhole ? (lang === 'zh' ? '整點' : 'o’clock') : (lang === 'zh' ? '半點' : 'half past');
          if (want !== wantLabel) return 'minuteMeaning marked answer ' + want + ' disagrees with the drawn clock';
          return null;
        }
        case 'compareCloser': {
          if (times.length !== 2) return 'compareCloser should draw 2 clocks, drew ' + times.length;
          const p = parseLabel(want);
          if (!p || p.m !== 30) return 'compareCloser marked answer should be the half hour, got ' + want;
          if (!(times[0].h === p.h && times[0].m === 0 && times[1].h === p.h && times[1].m === 30))
            return 'compareCloser clocks show ' + times.map(t => t.h + ':' + t.m).join(' and ') + ', expected ' + p.h + ':0 and ' + p.h + ':30';
          return null;
        }
        case 'activityMatch': {
          if (times.length !== 1) return 'activityMatch should draw exactly 1 clock';
          const r = REF_DAILY.find(x => x.icon + (lang === 'zh' ? x.zh : x.en) === want);
          if (!r) return 'activityMatch marked answer "' + want + '" is not in the daily table';
          if (times[0].h !== hour12(r.h) || times[0].m !== r.m) return 'activityMatch clock#1 shows ' + times[0].h + ':' + times[0].m + ' but "' + want + '" is at ' + hour12(r.h) + ':' + r.m;
          return null;
        }
        case 'sameTime': {
          if (times.length !== 1) return 'sameTime should draw exactly 1 clock';
          const factH = Number((q.stem.replace(/<svg[\s\S]*?<\/svg>/g, '').match(/(\d+)/) || [])[1]);
          if (!(factH >= 1 && factH <= 12)) return 'sameTime stem has no readable hour';
          if (times[0].m !== 0) return 'sameTime clock#1 is not on the hour';
          const same = times[0].h === factH;
          const wantLabel = same ? (lang === 'zh' ? '一樣' : 'Yes, the same') : (lang === 'zh' ? '不一樣' : 'No, different');
          if (want !== wantLabel) return 'sameTime: the clock shows ' + times[0].h + ':00 vs ' + factH + ' o’clock in the stem, but the marked answer is ' + want;
          return null;
        }
        default: return 'unknown genId ' + genId;
      }
    }
  },

  data: {
    /* qs：3 選項為主，兩題是非題（2）；qsAdv 3／2；qsBoost 兩題迷思檢查都是 4 選項。 */
    optCount: { qs: [2, 3], qsAdv: [2, 3], qsBoost: 4 },
    dataStart: '  /* ---------- 語言無關的小工具：時鐘 SVG ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    /* 小遊戲的時鐘模型、題庫與版面常數放在 clockSVG 後面、i18n 前面（「語言無關的資料」區）。 */
    dataReturn: '{polar, clockSVG, CLOCK_BIG, CLOCK_X, CLOCK_Y, KNOB, LONG_TOL, FIND_CLOCK, FIND_CELL, MATCH_CLOCK, CENTER_SKIP, normT, dragStep, clockAt, handTip, settle, tapTo, GAME_SET, GAME_FIND, GAME_HALF, GAME_MATCH, GAME_DAY}',
    optionValueMax: 20,
    check: function(data, I18N, fail, src){
      /* --- 鐘面：12 × 2 個時間 × 幾種尺寸／樣式都畫得下，而且量回來就是它宣稱的時間 --- */
      const variants = [ {}, { size: 110 }, { hourHighlight: true, dim: 'minute' }, { minHighlight: true, dim: 'hour' } ];
      for (let h = 1; h <= 12; h++) [0, 30].forEach(m => variants.forEach((o, vi) => {
        const svg = data.clockSVG(h, m, o);
        const tag = 'clockSVG(' + h + ',' + m + ',variant' + vi + ')';
        clockGeometryProblems(svg, tag).forEach(fail);
        const r = readClock(svg);
        if (r.error) fail(tag + ': ' + r.error);
        else if (r.h !== h || r.m !== m) fail(tag + ' reads back as ' + r.h + ':' + r.m);
      }));
      /* 24 小時制的作息時間（21 點）也要畫成 9 點 */
      const r21 = readClock(data.clockSVG(21, 0));
      if (r21.error || r21.h !== 9 || r21.m !== 0) fail('clockSVG(21,0) should read back as 9:00, got ' + JSON.stringify(r21));

      /* --- 靜態題：stem 裡的鐘量回來，要對得上被標成正解的選項（規則見檔頭；沒規則可對的畫鐘題也會響） --- */
      ['zh', 'en'].forEach(L => {
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const tag = bank + '[' + i + '] ' + L;
            const { problems, times } = clocksIn(q.stem, tag);
            problems.forEach(fail);
            const text = String(q.stem).replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, '');
            const want = q.opts[q.ans];
            const asTime = parseLabel(want);
            const nClocks = svgsIn(q.stem).length;
            /* 每一種畫鐘的題型都要有一條「鐘 → 答案」的規則，而且鐘的數量要正好是規則要的；
               鐘數不對就直接響（不是靜靜跳過），對不上任何一條規則的畫鐘題也要響。 */
            let rule = null;
            const needClocks = (n, why) => { if (nClocks !== n || times.length !== n){ fail(tag + ': ' + why + ' needs exactly ' + n + ' readable clock(s), found ' + nClocks + ' drawn / ' + times.length + ' readable'); return false; } return true; };
            if (/現在(?:是)?幾點|what time is it/.test(text)){
              rule = '幾點';
              if (needClocks(1, 'a "what time" question')){
                if (!asTime) fail(tag + ': answer "' + want + '" is not a time label');
                else if (times[0].h !== asTime.h || times[0].m !== asTime.m)
                  fail(tag + ': the clock reads ' + times[0].h + ':' + times[0].m + ' but the marked answer is "' + want + '"');
              }
            }
            if (/比較靠近|closer to/.test(text)){
              rule = '靠近';
              if (needClocks(2, 'a "closer to" question')){
                if (!asTime || asTime.m !== 30) fail(tag + ': the closer-to-next time must be the half hour, answer is "' + want + '"');
                else if (!(times[0].h === asTime.h && times[0].m === 0 && times[1].h === asTime.h && times[1].m === 30))
                  fail(tag + ': compare clocks show ' + times.map(t => t.h + ':' + t.m).join(' and '));
              }
            }
            if (/哪一根針|Which hand/.test(text)){
              rule = '哪一根針';
              if (needClocks(1, 'a "which hand" question')){
                if (times[0].m !== 0) fail(tag + ': the which-hand demo clock should be on the hour, reads ' + times[0].h + ':' + times[0].m);
                if (!/短針|Short hand/.test(want)) fail(tag + ': the hand that tells the hour is the short hand, marked answer is "' + want + '"');
              }
            }
            const same = text.match(/上學時間是 (\d+) 點|School starts at (\d+) o’clock/);
            if (same){ rule = '一樣嗎'; }
            if (same && needClocks(1, 'a "same time?" question')){
              const factH = Number(same[1] || same[2]);
              const isSame = times[0].h === factH && times[0].m === 0;
              const okAns = L === 'zh' ? (isSame ? '一樣' : '不一樣') : (isSame ? 'Yes, the same' : 'No, different');
              if (want !== okAns) fail(tag + ': clock shows ' + times[0].h + ':' + times[0].m + ', school at ' + factH + ', but the marked answer is "' + want + '"');
            }
            const act = text.match(/(\d+) 點，通常在做什麼|At (\d+)am|At noon \((\d+) o’clock\)/);
            if (act){ rule = '作息'; }
            if (act && needClocks(1, 'an activity question')){
              const hh = Number(act[1] || act[2] || act[3]);
              if (times[0].h !== hour12(hh) || times[0].m !== 0) fail(tag + ': activity clock shows ' + times[0].h + ':' + times[0].m + ' but the stem says ' + hh);
              const ref = REF_DAILY.find(x => want === x.icon + (L === 'zh' ? x.zh : x.en));
              if (!ref) fail(tag + ': activity answer "' + want + '" is not in the daily table');
              else if (hour12(ref.h) !== hour12(hh) || ref.m !== 0) fail(tag + ': "' + want + '" is at ' + ref.h + ':' + ref.m + ', not ' + hh);
            }
            if (nClocks > 0 && !rule) fail(tag + ': draws a clock but matches no clock→answer rule (unchecked, not passing): ' + text);
          });
        });
      });

      /* --- 生活作息表：和參考表一致，兩種語言的 label 都要有 --- */
      const DAILY = extractVar(src, 'DAILY');
      if (DAILY.length !== REF_DAILY.length) fail('DAILY has ' + DAILY.length + ' entries, expected ' + REF_DAILY.length);
      DAILY.forEach((d, i) => {
        const ref = REF_DAILY.find(x => x.key === d.key);
        if (!ref) return fail('DAILY[' + i + '] unknown key ' + d.key);
        if (d.h !== ref.h || d.m !== ref.m) fail('DAILY[' + i + '] ' + d.key + ' is ' + d.h + ':' + d.m + ', expected ' + ref.h + ':' + ref.m);
        ['zh', 'en'].forEach(L => {
          const lab = I18N[L].daily && I18N[L].daily[d.key];
          if (!lab || !lab.icon || !lab.label) fail('I18N.' + L + '.daily.' + d.key + ' missing icon/label');
          else if (lab.icon !== ref.icon) fail('I18N.' + L + '.daily.' + d.key + ' icon ' + lab.icon + ' != ' + ref.icon);
        });
      });

      /* --- 小遊戲：幾點了？（五關五種玩法，§六之五；2026-10-01 從選擇題改版）——
             鐘一律**量回來**（readClock：兩條 <line> 的角度），不讀頁面的 h／m；
             版面數字從 index.html 讀（資料區的常數＋RENDER 函式本體），不在這裡另抄一份。 --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const isInt = v => Number.isInteger(v);
      const hr = v => isInt(v) && v >= 1 && v <= 12;
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'set,find,half,match,day') fail('GAME_ORDER should be set,find,half,match,day, got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      /* 最後一關與過關的字：兩邊字典一起少的話 check_i18n 看不到（numbers 改版時真的發生過）；
         parents.html 的精熟標準寫「五關全破」，gWin 要真的這樣說 */
      ['zh','en'].forEach(L => {
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        if (typeof I18N[L].gWin !== 'function' || !/5/.test(I18N[L].gWin(5))) fail('gWin missing in ' + L);
      });
      if (typeof I18N.zh.gWin === 'function' && I18N.zh.gWin(5).indexOf('五關全破') < 0) fail('gWin zh does not say 五關全破 (parents.html mastery line)');
      /* 句子裡的數字照順序比 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = (text.match(/\d+/g) || []).map(Number).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
      };
      const has = (where, text, part) => { if (typeof text !== 'string' || text.indexOf(part) < 0) fail(where + ' does not say "' + part + '": ' + text); };
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; ['set','find','half','match','day'].forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const fnSrc = name => {
        const one = src.match(new RegExp('\\n  function ' + name + '\\([^)]*\\)\\{[^\\n]*\\}\\n'));
        if (one) return one[0];
        const m = src.match(new RegExp('\\n  function ' + name + '\\([^)]*\\)\\{\\n[\\s\\S]*?\\n  \\}\\n'));
        return m ? m[0] : '';
      };
      const dial = fnSrc('dialRound');
      if (!dial) fail('cannot cut dialRound() out of index.html');
      const boardH = k => { const m = B[k].match(/makeBoard\(300, (\d+)\)/); if (!m) fail('RENDER.' + k + ' has no 300-wide makeBoard'); return m ? +m[1] : 0; };
      /* 手機上拿得起來、點得到的東西至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍。
         實際量測在端對端測試裡（375px 寬再跑一次）。 */
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const rx = (k, re, what) => { const m = B[k].match(re); if (!m) fail('cannot read ' + what + ' from RENDER.' + k); return m ? m.slice(1).map(Number) : null; };
      const lbl = (h, m, L) => label(h, m, L);
      /* next12() 是「下一個數」（12 的下一個是 1）：切出來跑 */
      let next12 = null;
      { const m = fnSrc('next12'); if (!m) fail('cannot cut next12() out of index.html'); else next12 = new Function(m + '\nreturn next12;')(); }
      if (next12) for (let h = 1; h <= 12; h++) if (next12(h) !== (h === 12 ? 1 : h + 1)) fail('next12(' + h + ') is ' + next12(h));
      const nx = h => (h === 12 ? 1 : h + 1);

      /* ---- 時鐘模型（第 1、3 關的大鐘）：兩根針都從同一個 T 畫 ----
         (a) clockAt(T) 量回來就是 T：整點、半點每一個都量（readClock 會要求時針在 (h + m/60) × 30）；
         (b) 拖到一半的時間（T 不是 30 的倍數，甚至不是整數）兩根針的角度也要是真的：長針 (T mod 60) × 6、短針 T ÷ 2 ——
             這裡從 <line> 的端點自己算角度，不用頁面的公式；
         (c) 拿取圈的中心（handTip）就在畫出來的針尖上；
         (d) 三種大小的鐘面（撥針、找半點、配對）都畫得下、數字不相疊。 */
      const lineEnds = svg => {
        const root = (svg.match(/<svg\b[^>]*>/) || [])[0] || '', size = attrNum(root, 'width');
        return { size, hands: [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map(m => ({ x:attrNum(m[1], 'x2'), y:attrNum(m[1], 'y2') }))
          .map(p => ({ x:p.x, y:p.y, len:Math.hypot(p.x - size / 2, p.y - size / 2), ang:((Math.atan2(p.x - size / 2, size / 2 - p.y) * 180 / Math.PI) + 360) % 360 }))
          .sort((a, b) => a.len - b.len) };
      };
      const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
      if (typeof data.clockAt !== 'function' || typeof data.handTip !== 'function' || typeof data.settle !== 'function' || typeof data.normT !== 'function')
        fail('the clock model (normT／clockAt／handTip／settle) is missing from the data block');
      else {
        [data.CLOCK_BIG, data.FIND_CLOCK, data.MATCH_CLOCK].forEach(sz => {
          for (let T = 0; T < 720; T += 30){
            const svg = data.clockAt(T, sz), tag = 'clockAt(' + T + ', ' + sz + ')';
            clockGeometryProblems(svg, tag).forEach(fail);
            const r = readClock(svg), want = { h:hour12(Math.floor(T / 60)), m:T % 60 };
            if (r.error) fail(tag + ': ' + r.error);
            else if (r.h !== want.h || r.m !== want.m) fail(tag + ' reads back as ' + r.h + ':' + r.m + ', expected ' + want.h + ':' + want.m);
          }
        });
        for (let T = -725; T < 1450; T += 7.25){
          const svg = data.clockAt(T, data.CLOCK_BIG), e = lineEnds(svg), n = ((T % 720) + 720) % 720;
          if (e.hands.length !== 2){ fail('clockAt(' + T + ') does not draw 2 hands'); break; }
          if (angDiff(e.hands[0].ang, n / 2) > 0.3 || angDiff(e.hands[1].ang, (n % 60) * 6) > 0.3){
            fail('mid-turn clockAt(' + T + '): hands at ' + e.hands[0].ang.toFixed(1) + '° / ' + e.hands[1].ang.toFixed(1) + '°, a real clock at ' + n + ' min has ' + (n / 2).toFixed(1) + '° / ' + ((n % 60) * 6).toFixed(1) + '°');
            break;
          }
          const tipOk = ['hour', 'min'].every((w, i) => {
            const p = data.handTip(T, w), q = e.hands[i];
            return Math.abs(p.x - (data.CLOCK_X + q.x)) < 0.2 && Math.abs(p.y - (data.CLOCK_Y + q.y)) < 0.2;
          });
          if (!tipOk){ fail('handTip(' + T + ') — the grab ring is not on the drawn hand tip'); break; }
        }
        /* settle()：放開時對齊到這一關的刻度。和這裡自己的一份規則比（每 0.25 分鐘一個點，前後各一圈多）：
           短針一律對齊最近的刻度；長針離最近的刻度超過 LONG_TOL 度 → null（沒指好）。
           LONG_TOL 要小於 30°（長針指到隔壁的數字一定要被擋下來），也不可以小到手指放不準（≥ 10°）。 */
        if (!(data.LONG_TOL >= 10 && data.LONG_TOL < 30)) fail('LONG_TOL ' + data.LONG_TOL + '° must be 10..29 — a long hand on the neighbouring numeral (30° away) must not count');
        let bad = null;
        [60, 30].forEach(step => ['hour', 'min'].forEach(w => {
          for (let q = -800 * 4; q <= 1500 * 4 && !bad; q++){
            const T = q / 4, s = Math.round(T / step) * step;
            const want = (w === 'min' && Math.abs(T - s) * 6 > data.LONG_TOL + 1e-9) ? null : s;
            const got = data.settle(T, step, w);
            if (got !== want && !(got !== null && want !== null && Math.abs(got - want) < 1e-9)) bad = 'settle(' + T + ', ' + step + ', ' + w + ') = ' + got + ', expected ' + want + ' — a long hand left off the ' + (step === 60 ? '12' : '12/6') + ' must not count';
          }
        }));
        if (bad) fail(bad);
        /* tapTo()（先點針、再點鐘面）：行為逐點驗，不看程式長相。
           (1) 對準目標方向的點一定收：撥半點的長針點在 6 左右各 LONG_TOL − 2 度以內、短針點在 h 和 h+1 中間 ±6 度；撥整點的短針點在 to ±10 度。
           (2) 只有對準目標的點才收：任何一點只要對齊後是目標，點的方向就必須在目標針的方向附近（長針 LONG_TOL、短針 step/4 度）。
           (3) 點 12 附近（長針不動）永遠是「不動」：任何整點、任何目標都一樣 —— 不可以變成倒轉一整圈、短針退一格。 */
        if (typeof data.tapTo !== 'function') fail('tapTo() is missing from the data block');
        else {
          const hit = (T, w, a, step, to) => { const s = data.settle(data.tapTo(T, w, a, step, to), step, w); return s === null ? null : data.normT(s); };
          let tbad = null;
          data.GAME_HALF.forEach(h => {
            const T = h * 60, to = T + 30;
            for (let d = -(data.LONG_TOL - 2); d <= data.LONG_TOL - 2 && !tbad; d++) if (hit(T, 'min', 180 + d, 30, to) !== to) tbad = 'GAME_HALF ' + h + ': a long-hand tap aimed at 6 (' + (180 + d) + '°) does not reach half past ' + h;
            for (let d = -6; d <= 6 && !tbad; d++) if (hit(T, 'hour', (h % 12) * 30 + 15 + d, 30, to) !== to) tbad = 'GAME_HALF ' + h + ': a short-hand tap between ' + h + ' and ' + nx(h) + ' does not reach half past ' + h;
          });
          data.GAME_SET.forEach(g => {
            for (let d = -10; d <= 10 && !tbad; d++) if (hit(g.from * 60, 'hour', (g.to % 12) * 30 + d, 60, g.to * 60) !== data.normT(g.to * 60)) tbad = 'GAME_SET ' + g.from + '→' + g.to + ': a short-hand tap at ' + g.to + ' does not reach ' + g.to + ' o’clock';
          });
          for (let from = 1; from <= 12 && !tbad; from++) for (let to = 1; to <= 12 && !tbad; to++){
            [[60, to * 60], [30, to * 60 + 30]].forEach(([step, tgt]) => {
              const T = from * 60;
              for (let a = 0; a < 360 && !tbad; a += 0.5){
                ['min', 'hour'].forEach(w => {
                  if (tbad) return;
                  const r = hit(T, w, a, step, tgt);
                  if (w === 'min' && step === 60 && angDiff(a, 0) <= 10 && r !== data.normT(T)) tbad = 'tapTo: tapping 12 with the long hand at ' + from + ':00 moved the clock to ' + r + ' min (target ' + to + ':00)';
                  if (r !== data.normT(tgt)) return;
                  const want = w === 'min' ? (tgt % 60) * 6 : data.normT(tgt) / 2, tol = w === 'min' ? data.LONG_TOL : step / 4;
                  if (angDiff(a, want) > tol + 1e-9) tbad = 'tapTo: a ' + w + '-hand tap at ' + a + '° reached the target ' + tgt + ' min although it points away from it (want ' + want + '° ± ' + tol + ') — tap aimed at 6 rule too loose';
                });
              }
            });
          }
          if (tbad) fail(tbad);
        }
      }
      /* dialRound：放開之後只有「對齊後剛好是目標」才算過；轉回原來的時間是靜靜回去；其他一律彈回＋說原因。
         這三條判斷寫在 release() 裡 —— 用原始碼的形狀守住（不然把比對拿掉，任何時間都會過關）。 */
      if (dial){
        if (!/var s = settle\(raw, c\.step, H\.which\);\s*draw\(T\);\s*if \(s === null\)\{ roundMiss\(c\.offMsg\); return; \}\s*if \(normT\(s\) === normT\(T\)\) return;\s*(?:\/\*[^*]*\*\/\s*)?if \(normT\(s\) !== normT\(c\.to\)\)\{ roundMiss\(c\.wrong\(normT\(s\)\)\); return; \}/.test(dial))
          fail('dialRound release() no longer checks: off → reason, same time → silent, not the target → reason (release accepts any time)');
        /* 拖的時候：長針轉 6° ＝ 1 分鐘，短針轉 1° ＝ 2 分鐘（連動的鐘） */
        if (!/function rate\(which\)\{ return which === 'hour' \? 2 : 1 \/ 6; \}/.test(dial)) fail('dialRound rate(): the hour hand must move 2 min per degree and the long hand 1/6 min per degree (a geared clock)');
        if (!/release\(H, tapTo\(T, H\.which, angleOf\(pt\), c\.step, c\.to\)\);/.test(dial)) fail('dialRound tap: the tap path must turn the hand with tapTo()');
        /* 拖過圓心：在圓心附近不轉，出來之後從那裡重新起算 —— 不然「穿過圓心」會變成一下子轉半圈 */
        if (!/var pts = \(e\.getCoalescedEvents && e\.getCoalescedEvents\(\)\.length\) \? e\.getCoalescedEvents\(\)\.map\(function\(ce\)\{ return B\.toBoard\(ce\); \}\) : \[p\];\s*pts\.forEach\(function\(q\)\{/.test(dial)) fail('dialRound: the drag must walk every coalesced pointer sample (getCoalescedEvents) with [p] as fallback');
        if (!/var da = dragStep\(prev, q, CX, CY\);\s*prev = q;\s*if \(da === null\) return;\s*acc \+= da;/.test(dial)) fail('dialRound: the drag must turn by dragStep() between consecutive pointer points (center re-anchor missing)');
        /* dragStep() 的行為：穿過圓心的一段（不管取樣多稀疏）不算轉；沿著圓走一圈小步加起來剛好 360°；跨過 12 是小角度 */
        if (typeof data.dragStep !== 'function') fail('dragStep() is missing from the data block');
        else {
          const C = 150, at = (deg, r) => ({ x:C + r * Math.sin(deg * Math.PI / 180), y:C - r * Math.cos(deg * Math.PI / 180) });
          let dbad = null;
          [103, 65].forEach(r => {
            for (let a = 0; a < 360 && !dbad; a += 5){
              const v = data.dragStep(at(a, r), at(a + 180, r), C, C);
              if (v !== null) dbad = 'dragStep: one jump from ' + a + '° straight through the centre to ' + (a + 180) + '° counted as ' + v + '° (dragging through the centre must not count as a half turn)';
              /* 斜斜穿過圓心附近、兩端都在 CENTER_SKIP 外面的一段（例如錶框上 a → a+170°）也不可以算 */
              const p1 = at(a, r), p2 = at(a + 170, r);
              if (Math.hypot(p1.x - C, p1.y - C) <= data.CENTER_SKIP || Math.hypot(p2.x - C, p2.y - C) <= data.CENTER_SKIP) dbad = dbad || 'dragStep test geometry: endpoints must stay outside CENTER_SKIP';
              else if (r === 103 && data.dragStep(p1, p2, C, C) !== null) dbad = 'dragStep: an oblique jump ' + a + '° → ' + (a + 170) + '° passing near the centre counted (dragging through the centre must not count as a half turn)';
            }
            let sum = 0; for (let a = 0; a < 360; a += 4){ const v = data.dragStep(at(a, r), at(a + 4, r), C, C); if (v === null){ dbad = dbad || 'dragStep: a small step along the rim was refused'; break; } sum += v; }
            if (!dbad && Math.abs(sum - 360) > 1e-6) dbad = 'dragStep: a full lap along the rim sums to ' + sum + '°, not 360° (angle unwrap)';
            const w = data.dragStep(at(350, r), at(10, r), C, C);
            if (!dbad && Math.abs(w - 20) > 1e-6) dbad = 'dragStep: crossing 12 (350° → 10°) is ' + w + '°, not +20° (angle unwrap)';
          });
          if (dbad) fail(dbad);
        }
        if (!(data.CENTER_SKIP >= 20 && data.CENTER_SKIP < data.CLOCK_BIG / 2 * 0.52 - data.KNOB / 2)) fail('CENTER_SKIP ' + data.CENTER_SKIP + ' must be ≥ 20 and stay inside the short hand’s grab ring');
        const kn = dial.match(/addZone\(B, CLOCK_X, CLOCK_Y, CLOCK_BIG, CLOCK_BIG, 'gface'\)/);
        if (!kn) fail('dialRound does not draw the clock face at CLOCK_X, CLOCK_Y, CLOCK_BIG');
        if (!/var B = makeBoard\(300, 300\)/.test(dial) || data.CLOCK_X + data.CLOCK_BIG > 300 || data.CLOCK_Y + data.CLOCK_BIG > 300) fail('the big clock does not fit its 300 × 300 board');
      }
      tooSmall('a grab ring (KNOB ' + data.KNOB + ')', data.KNOB);
      /* 一開始兩個拿取圈不可以疊在一起（不然拿到的可能是另一根針） */
      const knobsApart = (T, where) => {
        const a = data.handTip(T, 'hour'), b = data.handTip(T, 'min');
        if (Math.hypot(a.x - b.x, a.y - b.y) < data.KNOB) fail(where + ': at the start the two grab rings overlap (' + Math.hypot(a.x - b.x, a.y - b.y).toFixed(1) + ' < ' + data.KNOB + ')');
      };

      /* 第 1 關：撥整點。from、to 都是 1~12 的整數、不一樣；目標畫出來長針在 12、短針在 to；
         RENDER.set 用整點的刻度（step 60）、目標是 to × 60。 */
      {
        if (!/dialRound\(d, \{ from:g\.from \* 60, to:g\.to \* 60, step:60, offMsg:d\.gSetLong,/.test(B.set)) fail('RENDER.set does not snap to whole hours from from:00 to to:00 (step 60)');
        if (!/wrong:function\(t\)\{ return d\.gSetWrong\(Math\.floor\(t \/ 60\) \|\| 12, g\.to\); \}/.test(B.set)) fail('RENDER.set wrong(): the reason must name the hour the short hand points at');
        if (data.GAME_SET.length < 4) fail('GAME_SET has fewer than 4 entries');
        data.GAME_SET.forEach((g, i) => {
          if (!hr(g.from) || !hr(g.to) || g.from === g.to) return fail('GAME_SET[' + i + '] from/to must be two different hours 1..12');
          knobsApart(g.from * 60, 'GAME_SET[' + i + ']');
          const r = readClock(data.clockAt(g.to * 60, data.CLOCK_BIG));
          if (r.error || r.h !== g.to || r.m !== 0) fail('GAME_SET[' + i + '] target clock reads ' + JSON.stringify(r));
          ['zh','en'].forEach(L => {
            seq('GAME_SET[' + i + '] ' + L + ' gSetDone', I18N[L].gSetDone(g.to), L === 'zh' ? [12, g.to, g.to] : [12, g.to, g.to]);
            seq('GAME_SET[' + i + '] ' + L + ' gSet2', I18N[L].gSet2(g.to), [g.to, 12]);
            for (let k = 1; k <= 12; k++) if (k !== g.to) seq('GAME_SET[' + i + '] ' + L + ' gSetWrong(' + k + ')', I18N[L].gSetWrong(k, g.to), [k, k, g.to]);
          });
        });
        has('gSetLong zh', I18N.zh.gSetLong, '長針指著 12'); has('gSetLong zh', I18N.zh.gSetLong, '短針');
        has('gSetLong en', I18N.en.gSetLong, 'long hand points at 12'); has('gSetLong en', I18N.en.gSetLong, 'short hand');
      }

      /* 第 2 關：找半點。四個時間兩兩不同；兩個半點、兩個整點，整點裡一定有 6 點（「有一根針指著 6」不等於半點）；
         四個鐘的位置洗牌；2 × 2 的格子放得下、不重疊。 */
      {
        if (!/shuffle\(all\)\.forEach\(function\(t, i\)\{/.test(B.find)) fail('RENDER.find draws the four clocks without shuffle(...) — the half past clocks sit in fixed places');
        if (!/roundMiss\(t\.h === 6 \? d\.gFindSix : d\.gFindWhole\(t\.h\)\)/.test(B.find)) fail('RENDER.find: tapping 6 o’clock must give the short-hand-on-6 reason (gFindSix)');
        const cell = rx('find', /addZone\(B, 2 \+ \(i % 2\) \* (\d+), 2 \+ Math\.floor\(i \/ 2\) \* (\d+), FIND_CELL, FIND_CELL, 'gpick'\)/, 'the 2 × 2 grid');
        const H = boardH('find');
        if (cell){
          if (cell[0] < data.FIND_CELL + 2 || cell[1] < data.FIND_CELL + 2) fail('find: the clock cells overlap');
          if (2 + cell[0] + data.FIND_CELL > 300 || 2 + cell[1] + data.FIND_CELL > H) fail('find: the clock cells stick out of the board');
        }
        if (data.FIND_CLOCK > data.FIND_CELL - 6) fail('find: FIND_CLOCK does not fit inside its cell (with the border)');
        tooSmall('a find-cell', data.FIND_CELL);
        data.GAME_FIND.forEach((g, i) => {
          if (g.half.length !== 2 || g.whole.length !== 2 || !g.half.concat(g.whole).every(hr)) return fail('GAME_FIND[' + i + '] must be 2 half + 2 whole hours in 1..12');
          if (g.whole.indexOf(6) < 0) fail('GAME_FIND[' + i + '] has no 6 o’clock (the short-hand-on-6 trap)');
          const keys = g.half.map(h => h + ':30').concat(g.whole.map(h => h + ':00'));
          if (new Set(keys).size !== 4) fail('GAME_FIND[' + i + '] times are not 4 different times: ' + keys.join());
          g.half.map(h => [h, 30]).concat(g.whole.map(h => [h, 0])).forEach(([h, m]) => {
            const svg = data.clockSVG(h, m, { size: data.FIND_CLOCK }), r = readClock(svg);
            clockGeometryProblems(svg, 'GAME_FIND[' + i + '] ' + h + ':' + m).forEach(fail);
            if (r.error || r.h !== h || r.m !== m) fail('GAME_FIND[' + i + '] clock ' + h + ':' + m + ' reads ' + JSON.stringify(r));
          });
          ['zh','en'].forEach(L => {
            g.whole.forEach(k => { if (k !== 6) seq('GAME_FIND[' + i + '] ' + L + ' gFindWhole', I18N[L].gFindWhole(k), [12, k]); });
            g.half.forEach(h => seq('GAME_FIND[' + i + '] ' + L + ' gFindOne', I18N[L].gFindOne(h), [6, h]));
          });
        });
        seq('gFindSix zh', I18N.zh.gFindSix, [6, 6, 12]); has('gFindSix zh', I18N.zh.gFindSix, '短針');
        seq('gFindSix en', I18N.en.gFindSix, [6, 6, 12]); has('gFindSix en', I18N.en.gFindSix, 'SHORT hand');
      }

      /* 第 3 關：撥半點。一開始 h 點整、目標 h 點半（step 30）；目標畫出來長針在 6、短針**剛好在 h 和 h+1 中間**
         （角度 h × 30 + 15，這裡自己量）。「不是 h 點半」的說明：對齊後是 j 點半就說「短針在 j 和 j+1 中間」，是 k 點就說「長針指著 12」——
         每一個可能停下來的時間都代入一次。 */
      {
        if (!/dialRound\(d, \{ from:h \* 60, to:h \* 60 \+ 30, step:30, offMsg:d\.gHalfLong,/.test(B.half)) fail('RENDER.half does not go from h:00 to h:30 on half-hour steps (the half target is not half past)');
        if (!/return t % 60 \? d\.gHalfWrongHalf\(k, next12\(k\), h\) : d\.gHalfWrongWhole\(k, h\);/.test(B.half)) fail('RENDER.half wrong(): half past j must say between j and j+1, o’clock k must say the long hand is on 12');
        if (data.GAME_HALF.length < 4) fail('GAME_HALF has fewer than 4 entries');
        data.GAME_HALF.forEach((h, i) => {
          if (!hr(h)) return fail('GAME_HALF[' + i + '] ' + h + ' is not an hour 1..12');
          knobsApart(h * 60, 'GAME_HALF[' + i + ']');
          const svg = data.clockAt(h * 60 + 30, data.CLOCK_BIG), r = readClock(svg), e = lineEnds(svg);
          if (r.error || r.h !== h || r.m !== 30) fail('GAME_HALF[' + i + '] target clock reads ' + JSON.stringify(r));
          if (angDiff(e.hands[0].ang, (h % 12) * 30 + 15) > 0.3) fail('GAME_HALF[' + i + '] at half past ' + h + ' the short hand is at ' + e.hands[0].ang.toFixed(1) + '°, not halfway between ' + h + ' and ' + nx(h));
          if (angDiff(e.hands[1].ang, 180) > 0.3) fail('GAME_HALF[' + i + '] at half past ' + h + ' the long hand is not on 6');
          ['zh','en'].forEach(L => {
            seq('GAME_HALF[' + i + '] ' + L + ' gHalfDone', I18N[L].gHalfDone(h, nx(h)), [6, h, nx(h), h]);
            seq('GAME_HALF[' + i + '] ' + L + ' gHalf2', I18N[L].gHalf2(h, nx(h)), [6, h, nx(h)]);
            for (let k = 1; k <= 12; k++){
              if (k !== h) seq('GAME_HALF[' + i + '] ' + L + ' gHalfWrongHalf(' + k + ')', I18N[L].gHalfWrongHalf(k, nx(k), h), [k, nx(k), k, h]);
              seq('GAME_HALF[' + i + '] ' + L + ' gHalfWrongWhole(' + k + ')', I18N[L].gHalfWrongWhole(k, h), [12, k, h]);
            }
          });
        });
        has('gHalfLong zh', I18N.zh.gHalfLong, '長針指著 6'); has('gHalfLong en', I18N.en.gHalfLong, 'long hand points at 6');
      }

      /* 第 4 關：時間卡配對。兩個鐘：half 點半、whole 點整（左右洗牌）；三張卡：兩個時間＋(half 的下一個數) 點半，三張兩兩不同；
         多的那張不可以剛好是某一個鐘的時間。版面：兩個鐘不重疊、卡片一排兩張不重疊、都在畫板裡、托盤在放卡片的範圍外面。 */
      {
        if (!/var cards = \[\{ h:g\.half, m:30 \}, \{ h:g\.whole, m:0 \}, \{ h:next12\(g\.half\), m:30 \}\];/.test(B.match)) fail('RENDER.match: the cards must be half:30, whole:00 and next12(half):30 (the next-number trap)');
        if (!/return open\.m \? d\.gMatch2\(open\.h, next12\(open\.h\)\) : d\.gMatch2w\(open\.h\);/.test(B.match)) fail('RENDER.match: the second hint must follow the clock that is still open');
        if (!/var targets = shuffle\(\[/.test(B.match)) fail('RENDER.match draws the two clocks without shuffle(...)');
        if (!/roundMiss\(hit\.m \? d\.gMatchWhyHalf\(hit\.h, next12\(hit\.h\), card\) : d\.gMatchWhyWhole\(hit\.h, card\)\);/.test(B.match)) fail('RENDER.match: the wrong-clock reason must describe THAT clock’s hands');
        const H = boardH('match');
        const cz = rx('match', /var cx = i \? (\d+) : (\d+);/, 'the clock centres');
        const sl = rx('match', /addZone\(B, cx - (\d+), (\d+), (\d+), (\d+), 'gslot'\)/, 'the card slots');
        const tg = rx('match', /cx:cx, cy:(\d+), hw:(\d+), hh:(\d+), sx:cx, sy:(\d+)/, 'the drop targets');
        const card = rx('match', /addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:tl\(t\.h, t\.m\), cls:'gcard gtime'/, 'the card size');
        const tray = rx('match', /renderTray\(B, cards, (\d+), function\(t, cx, cy\)\{[\s\S]*?\}, (\d+), (\d+)\);/, 'the card tray');
        if (cz){
          if (cz[0] - cz[1] < data.MATCH_CLOCK + 2) fail('match: the two clocks overlap');
          if (cz[1] - data.MATCH_CLOCK / 2 < 0 || cz[0] + data.MATCH_CLOCK / 2 > 300) fail('match: a clock sticks out of the board');
        }
        if (card){
          tooSmall('a time card', Math.min(card[0], card[1]));
          if (tray){
            if (tray[1] < card[0] + 2) fail('match: cards in the tray overlap');
            if ((300 - tray[1]) / 2 - card[0] / 2 < 0 || tray[0] + 56 + card[1] / 2 > H) fail('match: the card tray sticks out of the board');
            if (tg && tray[0] - card[1] / 2 <= tg[0] + tg[2]) fail('match: the card tray is inside the drop targets');
          }
          if (sl && (sl[2] < card[0] || sl[3] < card[1])) fail('match: a card does not fit its slot');
        }
        if (tg && cz && tg[1] * 2 > cz[0] - cz[1] + 2) fail('match: the two drop targets overlap by more than the gap');
        data.GAME_MATCH.forEach((g, i) => {
          if (!hr(g.half) || !hr(g.whole)) return fail('GAME_MATCH[' + i + '] half/whole must be hours 1..12');
          const cards = [[g.half, 30], [g.whole, 0], [nx(g.half), 30]].map(t => t.join(':'));
          if (new Set(cards).size !== 3) fail('GAME_MATCH[' + i + '] cards are not 3 different times: ' + cards.join());
          [[g.half, 30], [g.whole, 0]].forEach(([h, m]) => {
            const svg = data.clockSVG(h, m, { size: data.MATCH_CLOCK }), r = readClock(svg);
            clockGeometryProblems(svg, 'GAME_MATCH[' + i + '] ' + h + ':' + m).forEach(fail);
            if (r.error || r.h !== h || r.m !== m) fail('GAME_MATCH[' + i + '] clock ' + h + ':' + m + ' reads ' + JSON.stringify(r));
          });
          ['zh','en'].forEach(L => {
            const cardsTxt = [lbl(g.half, 30, L), lbl(g.whole, 0, L), lbl(nx(g.half), 30, L)];
            cardsTxt.forEach(c => {
              const cn = (c.match(/\d+/g) || []).map(Number);
              if (c !== lbl(g.half, 30, L)) seq('GAME_MATCH[' + i + '] ' + L + ' gMatchWhyHalf', I18N[L].gMatchWhyHalf(g.half, nx(g.half), c), [6, g.half, nx(g.half)].concat(cn));
              if (c !== lbl(g.whole, 0, L)) seq('GAME_MATCH[' + i + '] ' + L + ' gMatchWhyWhole', I18N[L].gMatchWhyWhole(g.whole, c), [12, g.whole].concat(cn));
            });
            seq('GAME_MATCH[' + i + '] ' + L + ' gMatch2w', I18N[L].gMatch2w(g.whole), [g.whole, 12, g.whole]);
            seq('GAME_MATCH[' + i + '] ' + L + ' gMatch2', I18N[L].gMatch2(g.half, nx(g.half)), L === 'zh' ? [g.half, nx(g.half), 6, g.half, nx(g.half)] : [6, g.half, nx(g.half), g.half, nx(g.half)]);
          });
        });
        /* 課程自己的時間唸法 timeLabel 要和這個檔案的 label() 一樣（卡片上的字就是它） */
        ['zh','en'].forEach(L => { for (let h = 1; h <= 12; h++) [0, 30].forEach(m => { if (I18N[L].timeLabel(h, m) !== label(h, m, L)) fail('timeLabel(' + h + ',' + m + ') ' + L + ' is "' + I18N[L].timeLabel(h, m) + '", expected "' + label(h, m, L) + '"'); }); });
      }

      /* 第 5 關：早上還是晚上。早上、晚上各三件事（這裡自己一份對照；有在作息表 REF_DAILY 裡的，早晚要和那張表的鐘點一致）；
         每件事兩種語言都有字；圖示兩兩不同，「起床」不可以用床（🛌 看起來像在睡覺）；放錯的說明說對的那一個時候。
         版面：兩個框各放兩張卡片（放好的卡片在框裡、不重疊），托盤一排兩張不重疊、在框的外面。 */
      {
        const REF_DAY = { wake:true, breakfast:true, school:true, sleep:false, dinner:false, stars:false };
        const keys = data.GAME_DAY.map(a => a.k);
        if (keys.slice().sort().join() !== Object.keys(REF_DAY).sort().join()) fail('GAME_DAY keys ' + keys.join() + ' differ from the reference');
        data.GAME_DAY.forEach(a => {
          if (REF_DAY[a.k] !== undefined && a.am !== REF_DAY[a.k]) fail('GAME_DAY ' + a.k + ' is marked ' + (a.am ? 'morning' : 'evening'));
          const ref = REF_DAILY.find(x => x.key === a.k);
          if (ref && a.am !== (ref.h < 12)) fail('GAME_DAY ' + a.k + ' disagrees with the daily table (' + ref.h + ':00)');
          ['zh','en'].forEach(L => { if (!(I18N[L].gAct && I18N[L].gAct[a.k])) fail('gAct.' + a.k + ' missing in ' + L); });
        });
        /* 卡片上寫的時間：在作息表裡的要和表一樣（21 點畫成 9 點）；早上、晚上各剛好一件 pair，而且兩件的鐘面一樣 ——
           每一局都有「同一個鐘面，一個早上一個晚上」 */
        data.GAME_DAY.forEach(a => {
          if (!hr(a.h) || (a.m !== 0 && a.m !== 30)) return fail('GAME_DAY ' + a.k + ' time ' + a.h + ':' + a.m + ' is not a whole/half hour');
          const ref = REF_DAILY.find(x => x.key === a.k);
          if (ref && (hour12(ref.h) !== a.h || ref.m !== a.m)) fail('GAME_DAY ' + a.k + ' card says ' + a.h + ':' + a.m + ' but the daily table says ' + hour12(ref.h) + ':' + ref.m);
        });
        const pa = data.GAME_DAY.filter(a => a.pair && a.am), pp = data.GAME_DAY.filter(a => a.pair && !a.am);
        if (pa.length !== 1 || pp.length !== 1 || pa[0].h !== pp[0].h || pa[0].m !== pp[0].m) fail('GAME_DAY needs exactly one morning and one evening pair with the same clock time');
        if (!/return p\.concat\(shuffle\(GAME_DAY\.filter\(function\(a\)\{ return a\.am === isAm && !a\.pair; \}\)\)\.slice\(0, 2 - p\.length\)\);/.test(B.day)) fail('RENDER.day does not always deal the same-time pair');
        if (!/text:tl\(a\.h, a\.m\) \+ '\\n' \+ a\.icon \+ ' ' \+ d\.gAct\[a\.k\]/.test(B.day)) fail('RENDER.day cards do not show the time');
        if (pa.length === 1) ['zh','en'].forEach(L => seq('gDayDone ' + L, I18N[L].gDayDone, [pa[0].h, pp[0].h]));
        if (data.GAME_DAY.filter(a => a.am).length !== 3 || data.GAME_DAY.filter(a => !a.am).length !== 3) fail('GAME_DAY needs 3 morning and 3 evening things');
        if (new Set(data.GAME_DAY.map(a => a.icon)).size !== data.GAME_DAY.length) fail('GAME_DAY icons are not all different');
        const wake = data.GAME_DAY.find(a => a.k === 'wake');
        if (wake && /🛌|😴|🛏/.test(wake.icon)) fail('GAME_DAY wake uses a bed/sleep glyph — it reads as sleeping');
        ['zh','en'].forEach(L => {
          const w = I18N[L].gDayWhy('X', true), e = I18N[L].gDayWhy('X', false);
          if (L === 'zh'){ has('gDayWhy zh (am)', w, '通常在早上，不是晚上'); has('gDayWhy zh (pm)', e, '通常在晚上，不是早上'); }
          else { has('gDayWhy en (am)', w, 'in the morning, not in the evening'); has('gDayWhy en (pm)', e, 'in the evening, not in the morning'); }
        });
        if (!/if \(a\.am !== hit\.am\)\{ roundMiss\(d\.gDayWhy\(act, a\.am\)\); return false; \}/.test(B.day)) fail('RENDER.day: a card in the wrong box must bounce with gDayWhy(act, a.am)');
        const H = boardH('day');
        const box = rx('day', /var x = i \? (\d+) : (\d+);\s*addZone\(B, x, (\d+), (\d+), (\d+), 'gbox/, 'the boxes');
        const lock = rx('day', /P\.lock\(hit\.cx, (\d+) \+ hit\.n \* (\d+)\);/, 'where placed cards go');
        const card = rx('day', /addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:tl\(a\.h, a\.m\)/, 'the card size');
        const tray = rx('day', /renderTray\(B, left, (\d+), function\(a, cx, cy\)\{[\s\S]*?\}, (\d+), (\d+)\);/, 'the card tray');
        if (box && card && lock && tray){
          const [x1, x0, y0, bw, bh] = box, [cw, ch] = card;
          tooSmall('a thing card', Math.min(cw, ch));
          if (x0 + bw > x1 || x1 + bw > 300 || y0 + bh > H) fail('day: the boxes overlap or stick out');
          if (cw > bw - 4) fail('day: a card is wider than its box');
          if (lock[1] < ch + 2) fail('day: placed cards overlap');
          if (lock[0] - ch / 2 < y0 + 28 || lock[0] + lock[1] + ch / 2 > y0 + bh) fail('day: a placed card is outside its box or covers the box label');
          if (tray[1] < cw + 2) fail('day: cards in the tray overlap');
          if (tray[0] - ch / 2 <= y0 + bh || tray[0] + 56 + ch / 2 > H || (300 - tray[1]) / 2 - cw / 2 < 0) fail('day: the card tray is inside a box or sticks out of the board');
        }
      }
    }
  }
};
