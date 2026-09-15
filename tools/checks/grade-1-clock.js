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
    /* startRound() 兩個分支各洗一次牌；拿掉「這是幾點」那一支，數量對不上要響。 */
    { file:'index', expect:'shuffled option render',
      find:'      shuffle([round.h].concat(round.wrong)).forEach(function(hv){',
      replace:'      ([round.h].concat(round.wrong)).forEach(function(hv){' },
    { file:'index', expect:'ROUNDS[0]',
      find:"      { kind:'clock', h:4, m:0, wrong:[3, 5] },",
      replace:"      { kind:'clock', h:4, m:0, wrong:[4, 5] }," },
    { file:'index', expect:'ROUNDS[1]',
      find:"      { kind:'time', h:7, m:30, wrong:[[3,0],[10,30]] },",
      replace:"      { kind:'time', h:7, m:30, wrong:[[7,30],[10,30]] }," },
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
    dataReturn: '{polar, clockSVG}',
    optionValueMax: 20,
    check: function(data, I18N, fail, src){
      /* --- 小遊戲：startRound() 的 clock／time 兩個分支各洗一次牌 --- */
      gameShuffleProblems(src, 2).forEach(fail);

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

      /* --- 小遊戲關卡（buildRounds 回傳的陣列） --- */
      const rm = src.match(/function buildRounds\(\)\{\s*return (\[[\s\S]*?\]);\s*\}/);
      if (!rm) return fail('cannot find buildRounds() in index.html');
      const ROUNDS = new Function('return ' + rm[1] + ';')();
      if (ROUNDS.length !== 5) fail('ROUNDS should have 5 rounds, got ' + ROUNDS.length);
      ROUNDS.forEach((r, i) => {
        if (!(r.h >= 1 && r.h <= 12) || (r.m !== 0 && r.m !== 30)) fail('ROUNDS[' + i + '] time ' + r.h + ':' + r.m + ' is not a whole/half hour in 1~12');
        if (r.kind === 'clock'){
          if (r.wrong.length !== 2 || new Set(r.wrong).size !== 2 || r.wrong.indexOf(r.h) >= 0 || r.wrong.some(v => !(v >= 1 && v <= 12)))
            fail('ROUNDS[' + i + '] clock: wrong hours must be 2 distinct hours other than ' + r.h);
        } else if (r.kind === 'time'){
          const keys = r.wrong.map(p => p.join(':'));
          if (r.wrong.length !== 2 || new Set(keys).size !== 2 || keys.indexOf(r.h + ':' + r.m) >= 0 ||
              r.wrong.some(p => !(p[0] >= 1 && p[0] <= 12) || (p[1] !== 0 && p[1] !== 30)))
            fail('ROUNDS[' + i + '] time: wrong clocks must be 2 distinct whole/half times other than ' + r.h + ':' + r.m);
        } else fail('ROUNDS[' + i + '] unknown kind ' + r.kind);
      });
    }
  }
};
