/* grade-1/math/shapes 的檢查設定（形狀：平面圖形辨認、正方形／長方形、邊與直角、立體家族、拼排與規律）。

   這一課的答案幾乎全部是**從畫出來的形狀算出來的**：review.html 的產生器把形狀描述（desc）
   交給 bigShapeSVG() 畫成 200×200 的 <svg>，邊數／直角數／正方形與否都由那組頂點算。
   所以這裡自己帶一份幾何（makeSquare／makeRectangle／邊長／內角／頂點極徑），從 desc
   重算一次再和被標成正解的選項比 —— 不讀課程算好的 count／actualSquare／stillSquare。

   ⚠️ 這一輪查出來的真缺陷（已修在 review.html）：長方形的 w 最大 129、h 最大 198，四個角到
   圓心最遠 118，超過畫布的一半（100）—— **三成的參數組合轉到某些角度會被切掉一塊**。
   資料、選項、算術全對，只有畫出來才看得到（issue #5 那一族）。extentsProblem() 現在守著。

   ⚠️ 三角形的頂點是 makeTriangle() 隨機抖出來的：sideCount／rightAngleCount 把那組點凍在 desc.pts，
   這裡就用 desc.pts 算；identifyShape 的三角形沒有 pts（畫的時候才抽），那一題只問名字，
   這裡只驗它的極徑上限畫得進畫布（size × 1.05 ＋ 尖角上限 20 ≤ 100，寬鬆的上界）。

   ⚠️ 小遊戲**沒有**接 lib/gameshuffle.js：它的按鈕是固定的類別面板（三角形／正方形／長方形／圓形，
   或三個家族），正解每一關不同、位置本來就不固定，洗牌沒有意義；那個守衛會誤報「沒洗牌」。
   選項數：identifyShape 4（畫的是正方形時 3 —— 拿掉「長方形」，因為正方形也是長方形）、
   rotateStillSquare 2、squareOrRectangle 2、sideCount 4、rightAngleCount 4、familyMatch 3、
   planeOrSolid 2、composeTriangleCount 4、patternNext 3。 */

/* canvas.js 只認 rect／circle／line／text；這一課的圖全是 polygon，所以幾何都在這個檔案自己量。 */
const PLANE = ['triangle', 'square', 'rectangle', 'circle'];
const FAMS = ['box', 'ball', 'can'];
/* 物品 → 家族（獨立的參考表；課程的 OBJECT_POOL 要和它一致） */
const REF_FAM = {
  '🎁':'box', '🧊':'box', '📚':'box', '🎲':'box',
  '⚽':'ball', '🍊':'ball', '🔮':'ball', '🎱':'ball',
  '🥫':'can', '🕯️':'can', '🥤':'can', '🛢️':'can'
};
const NAME = {
  zh: { shape:{ triangle:'三角形', square:'正方形', rectangle:'長方形', circle:'圓形' },
        fam:{ box:'像盒子的', ball:'像球的', can:'像罐子的' },
        obj:{ '🎁':'禮物盒','🧊':'冰塊','📚':'書','🎲':'骰子','⚽':'足球','🍊':'橘子','🔮':'水晶球','🎱':'撞球','🥫':'罐頭','🕯️':'蠟燭','🥤':'飲料杯','🛢️':'油桶' },
        plane:'平面圖形（扁扁的）', solid:'立體形體（有厚度）', stillYes:'還是正方形', stillNo:'不是正方形了',
        sq:'正方形', rc:'長方形' },
  en: { shape:{ triangle:'triangle', square:'square', rectangle:'rectangle', circle:'circle' },
        fam:{ box:'box-like', ball:'ball-like', can:'can-like' },
        obj:{ '🎁':'gift box','🧊':'ice cube','📚':'books','🎲':'die','⚽':'soccer ball','🍊':'orange','🔮':'crystal ball','🎱':'billiard ball','🥫':'can','🕯️':'candle','🥤':'cup','🛢️':'drum' },
        plane:'Flat shape (2D)', solid:'Solid (3D)', stillYes:'Still a square', stillNo:'Not a square anymore',
        /* squareOrRectangle 的兩個選項在英文版是大寫開頭的 Square／Rectangle（不是形狀名表裡的小寫） */
        sq:'Square', rc:'Rectangle' }
};
const EMOJI_SHAPE = { '🔺':'triangle', '⬜':'square', '⚪':'circle', '🟦':'rectangle' };

/* ---------- 幾何（第二套實作） ---------- */
const CX = 100, CY = 100, VIEW = 200, STROKE = 5;   /* bigShapeSVG：viewBox 0 0 200 200，描邊 5 */
function rot(p, deg){
  const a = deg * Math.PI / 180, dx = p.x - CX, dy = p.y - CY;
  return { x: CX + dx * Math.cos(a) - dy * Math.sin(a), y: CY + dx * Math.sin(a) + dy * Math.cos(a) };
}
function rectPts(w, h, deg){
  const hw = w / 2, hh = h / 2;
  return [{x:CX-hw,y:CY-hh},{x:CX+hw,y:CY-hh},{x:CX+hw,y:CY+hh},{x:CX-hw,y:CY+hh}].map(p => rot(p, deg || 0));
}
function dist(a, b){ return Math.hypot(b.x - a.x, b.y - a.y); }
function sides(pts){ return pts.map((p, i) => dist(p, pts[(i + 1) % pts.length])); }
function angles(pts){
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    const v1x = a.x - p.x, v1y = a.y - p.y, v2x = c.x - p.x, v2y = c.y - p.y;
    const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y))));
    return Math.acos(cos) * 180 / Math.PI;
  });
}
function rightAngles(pts){ return angles(pts).filter(a => Math.abs(a - 90) <= 1).length; }
function isSquarePts(pts){
  const s = sides(pts); const tol = Math.min.apply(null, s) * 0.02;
  return s.every(v => Math.abs(v - s[0]) <= tol) && angles(pts).every(a => Math.abs(a - 90) <= 0.5);
}
/* 描邊在頂點的尖角（SVG 預設 stroke-linejoin: miter）會從頂點往外突出 (描邊/2) ÷ sin(角/2)；
   角尖到 miter 長度超過 miterlimit（4 × 描邊）時瀏覽器改成斜切（bevel），那時突出量只剩描邊/2。
   這裡的上限 4 × 描邊 = 20 是**刻意寬鬆**的上界（真正的最大突出約 10），不是尖角的實際最大值。
   直角是 2.5 × √2 ≈ 3.5。多邊形「畫到哪裡」要算頂點極徑 ＋ 這個突出量。 */
function miterReach(pts){
  const angs = angles(pts);
  return Math.max.apply(null, pts.map((p, i) => {
    const ext = Math.min(STROKE / 2 / Math.sin(angs[i] * Math.PI / 360), STROKE * 4);
    return Math.hypot(p.x - CX, p.y - CY) + ext;
  }));
}
/* 一個 desc（bigShapeSVG 的輸入）畫出來會不會超出 200×200（含描邊與尖角）？回傳問題字串或 null。
   預設值要和頁面的 bigShapeSVG 一樣：triangle size 72、square 96、rectangle 118×62、circle r 58。 */
function extentsProblem(desc, defaults){
  const D = Object.assign({ tri:72, sq:96, rw:118, rh:62, r:58 }, defaults || {});
  const lim = VIEW / 2;   /* 100：描邊最外緣到圓心的距離上限 */
  let pts = null, far = null;
  if (desc.kind === 'circle'){ far = (desc.r || D.r) + STROKE / 2; }
  else if (desc.kind === 'square'){ pts = rectPts(desc.size || D.sq, desc.size || D.sq, desc.rot); }
  else if (desc.kind === 'rectangle'){ pts = rectPts(desc.w || D.rw, desc.h || D.rh, desc.rot); }
  else if (desc.kind === 'triangle'){
    if (desc.pts) pts = desc.pts;
    else far = (desc.size || D.tri) * 1.05 + STROKE * 4;   /* makeTriangle 的極徑最大 size × (0.95 + 0.1)，銳角尖角最多再 20 */
  } else return 'unknown shape kind ' + desc.kind;
  if (pts) far = miterReach(pts);
  if (!(far <= lim)) return desc.kind + ' reaches ' + far.toFixed(1) + ' from the centre (stroke and corner joins included) and leaves the 200×200 canvas (limit ' + lim + ')';
  return null;
}
/* 從 bigShapeSVG 真的畫出來的字串量：polygon 的每個頂點、circle 的 cx/cy/r 都要在畫布裡（含描邊） */
function svgExtentsProblem(svg, tag){
  const lim = VIEW / 2;
  const poly = svg.match(/points="([^"]+)"/);
  if (poly){
    const raw = poly[1].trim().split(/\s+/).map(s => s.split(',').map(Number));
    if (raw.some(p => p.length !== 2 || p.some(isNaN))) return tag + ': unreadable polygon points';
    const far = miterReach(raw.map(p => ({ x:p[0], y:p[1] })));
    if (!(far <= lim)) return tag + ': polygon stroke reaches ' + far.toFixed(1) + ' from the centre and leaves the 200×200 canvas';
    return null;
  }
  const c = svg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
  if (c){
    const far = Math.hypot(Number(c[1]) - CX, Number(c[2]) - CY) + Number(c[3]) + STROKE / 2;
    if (!(far <= lim)) return tag + ': circle reaches ' + far.toFixed(1) + ' from the centre and leaves the 200×200 canvas';
    return null;
  }
  return tag + ': no polygon/circle found in the drawing';
}
/* 小圖示（viewBox 0 0 100 100，描邊 4）：canvas.js 不認 polygon／ellipse／path，這裡自己讀。
   polygon 的每個頂點、circle／ellipse 的邊界、path 裡 M／L／A 的每個端點都要在畫布裡；
   ⚠️ path 的弧線只量端點再加上 ry 的凸出量，不追曲線本身 —— 罐子那條弧是往下凸的，凸出量就是 ry。 */
function iconExtentsProblem(svg, tag){
  const vb = (svg.match(/viewBox="0 0 (\d+) (\d+)"/) || []);
  const W = Number(vb[1]), H = Number(vb[2]);
  if (!W || !H) return tag + ': cannot read the icon viewBox';
  const lim = 2;   /* 描邊 4 → 邊緣留 2 */
  const inside = (x, y) => x >= lim && x <= W - lim && y >= lim && y <= H - lim;
  let seen = 0, m;
  for (const pm of svg.matchAll(/points="([^"]+)"/g)){
    for (const pair of pm[1].trim().split(/\s+/)){
      const [x, y] = pair.split(',').map(Number); seen++;
      if (!inside(x, y)) return tag + ': polygon vertex (' + x + ',' + y + ') leaves the ' + W + '×' + H + ' icon';
    }
  }
  for (const cm of svg.matchAll(/<circle[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*r="([\d.]+)"/g)){
    const cx = Number(cm[1]), cy = Number(cm[2]), r = Number(cm[3]); seen++;
    if (!inside(cx - r, cy - r) || !inside(cx + r, cy + r)) return tag + ': circle leaves the icon';
  }
  for (const em of svg.matchAll(/<ellipse[^>]*cx="([\d.]+)"[^>]*cy="([\d.]+)"[^>]*rx="([\d.]+)"[^>]*ry="([\d.]+)"/g)){
    const cx = Number(em[1]), cy = Number(em[2]), rx = Number(em[3]), ry = Number(em[4]); seen++;
    if (!inside(cx - rx, cy - ry) || !inside(cx + rx, cy + ry)) return tag + ': ellipse leaves the icon';
  }
  for (const dm of svg.matchAll(/ d="([^"]+)"/g)){
    const d = dm[1];
    for (const pt of d.matchAll(/[ML]\s*([\d.]+),([\d.]+)/g)){ seen++; if (!inside(Number(pt[1]), Number(pt[2]))) return tag + ': path point leaves the icon'; }
    for (const arc of d.matchAll(/A\s*([\d.]+),([\d.]+)\s+[\d.]+\s+[01]\s+[01]\s+([\d.]+),([\d.]+)/g)){
      seen++; const ry = Number(arc[2]), ex = Number(arc[3]), ey = Number(arc[4]);
      if (!inside(ex, ey) || !inside(ex, ey + ry)) return tag + ': path arc leaves the icon';
    }
  }
  if (!seen) return tag + ': no readable geometry in the icon';
  return null;
}
/* 規律：最短的週期 p，要求整串都符合、而且至少看得到一整組再加兩個 */
function period(seq){
  for (let p = 1; p <= seq.length - 2; p++){
    let ok = true;
    for (let i = 0; i < seq.length; i++) if (seq[i] !== seq[i % p]){ ok = false; break; }
    if (ok) return p;
  }
  return null;
}
function extractVar(src, name){
  const m = src.match(new RegExp('var ' + name + ' = ([\\[{][\\s\\S]*?[\\]}]);'));
  if (!m) throw new Error('cannot find var ' + name + ' in source');
  return new Function('return ' + m[1] + ';')();
}

module.exports = {
  breaks: [
    /* ---- review.html ---- */
    /* 長方形畫出畫布：把對角線上限放寬到 197，w 129 × h 198 那種長方形又會回來，轉一轉就被切掉。 */
    { file:'review', expect:'leaves the 200×200 canvas',
      find:'  var HALF_DIAG_MAX = 96;',
      replace:'  var HALF_DIAG_MAX = 196;' },
    /* 三角形重抽到每個角都離 90° 至少 8°；拿掉那個門檻，89.x° 的角又會被算成直角。 */
    /* 直接塞一個直角三角形進去（不靠亂數抽到）：三角形的角在 90° ± 8° 裡，設定檔那條要響。 */
    { file:'review', expect:'within 8',
      find:"            near = polygonAngles(pts).some(function(a){ return Math.abs(a - 90) < 8; });",
      replace:"            near = false; pts = [{x:60,y:60},{x:140,y:60},{x:60,y:130}];" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        var ans = opts.indexOf(d.actualSquare ? sq : rc);",
      replace:"        var ans = opts.indexOf(d.actualSquare ? rc : sq);" },
    { file:'review', expect:'opts[ans] != correct',
      find:'        return { desc:desc, count: pts.length };',
      replace:'        return { desc:desc, count: pts.length + 1 };' },
    /* 直角的判定放寬到 ±40°：課程會把斜角也算成直角，和這裡自己算的直角數對不上。 */
    { file:'review', expect:'right-angle count',
      find:'        var rightCount = angs.filter(function(a){ return approxEq(a,90,1); }).length;',
      replace:'        var rightCount = angs.filter(function(a){ return approxEq(a,90,40); }).length;' },
    { file:'review', expect:'opts[ans] != correct',
      find:'        var next = kinds[len%2];',
      replace:'        var next = kinds[(len+1)%2];' },
    { file:'review', expect:'opts[ans] != correct',
      find:'        return { size:size, pieces:pieces, count: pieces.length };',
      replace:'        return { size:size, pieces:pieces, count: pieces.length + 1 };' },
    /* 物品分錯家族：禮物盒被放進「像球的」（OBJECT_FAM 由 pool 反推，後面的覆蓋前面的）。 */
    { file:'review', expect:'family',
      find:"    ball: ['⚽','🍊','🔮','🎱'],",
      replace:"    ball: ['⚽','🍊','🔮','🎁']," },
    /* 畫的是正方形卻把「長方形」放進選項：正方形也是長方形，用正確推理可以走到那個「錯誤」選項。 */
    { file:'review', expect:'rectangle offered',
      find:"        var pool = d.correctKind === 'square' ? PLANE_KINDS.filter(function(k){ return k !== 'rectangle'; }) : PLANE_KINDS;",
      replace:"        var pool = PLANE_KINDS;" },
    /* 規律不是兩種形狀交替：seq 全部同一種，「接下去」就沒有規律可推。 */
    { file:'review', expect:'alternate',
      find:'        for (var i=0;i<len;i++) seq.push(kinds[i%2]);',
      replace:'        for (var i=0;i<len;i++) seq.push(kinds[0]);' },

    /* ---- index.html ---- */
    /* 靜態題：問「哪一個是正方形」卻把正解標到長方形。 */
    { file:'index', expect:'marked answer',
      find:"        { kind:'shape', stem:'哪一個是正方形？',\n          opts:[{kind:'rectangle',rot:0},{kind:'square',rot:45},{kind:'triangle',rot:0,variant:'wide'},{kind:'circle'}], ans:1,",
      replace:"        { kind:'shape', stem:'哪一個是正方形？',\n          opts:[{kind:'rectangle',rot:0},{kind:'square',rot:45},{kind:'triangle',rot:0,variant:'wide'},{kind:'circle'}], ans:0," },
    /* 問「哪一個是長方形」的選項裡混進一個正方形 —— 正方形也是長方形，答案就不唯一了。 */
    { file:'index', expect:'square is also a rectangle',
      find:"        { kind:'shape', stem:'哪一個是長方形？',\n          opts:[{kind:'triangle',rot:0},{kind:'rectangle',rot:15},{kind:'circle'},{kind:'triangle',rot:140,variant:'thin'}], ans:1,",
      replace:"        { kind:'shape', stem:'哪一個是長方形？',\n          opts:[{kind:'triangle',rot:0},{kind:'rectangle',rot:15},{kind:'circle'},{kind:'square',rot:140}], ans:1," },
    { file:'index', expect:'PATTERNS[0]',
      find:"    { seq:['triangle','square','triangle','square'], next:'triangle', decoys:['circle','square'] },",
      replace:"    { seq:['triangle','square','triangle','square'], next:'square', decoys:['circle','triangle'] }," },
    /* 大圖的圓心偏掉：靜態題、分類站、小遊戲的形狀都會有一邊被切掉。 */
    { file:'index', expect:'leaves the 200×200 canvas',
      find:"    px = px || 130;\n    var cx=100, cy=100, body;",
      replace:"    px = px || 130;\n    var cx=140, cy=100, body;" },
    { file:'index', expect:'sorterRounds',
      find:"      { kind:'rectangle', rot: Math.random()*360 },\n      { kind:'circle' },",
      replace:"      { kind:'oval', rot: Math.random()*360 },\n      { kind:'circle' }," },
    /* 物品放錯家族（骰子跑到像球的） */
    { file:'index', expect:'OBJECT_POOL',
      find:"    ball: ['⚽','🍊','🔮','🎱'],",
      replace:"    ball: ['⚽','🍊','🔮','🎲']," }
  ],

  sim: {
    optCount: { identifyShape: [3, 4], rotateStillSquare: 2, squareOrRectangle: 2, familyMatch: 3, planeOrSolid: 2, patternNext: 3, '*': 4 },
    /* GENS 用到最前面的幾何工具、OBJECT_FAM 與 TXT（fmt 的第三個參數，simgen 不傳時自己補） */
    blockStart: '  /* ---- shape geometry (identical to index.html, verified via scratchpad/test-shapegeo.js) ---- */',
    INVARIANTS: {
      identifyShape: d => {
        const k = d.desc.kind;
        if (PLANE.indexOf(k) < 0) return 'unknown kind ' + k;
        if (d.correctKind !== k) return 'correctKind is not the drawn kind';
        if (k === 'rectangle' && !(d.desc.h >= d.desc.w + 25)) return 'a "rectangle" must be clearly taller than wide (h >= w + 25), got ' + d.desc.w + '×' + d.desc.h;
        if (k === 'triangle' && ['normal', 'thin', 'wide'].indexOf(d.desc.variant) < 0) return 'unknown triangle variant';
        return extentsProblem(d.desc);
      },
      rotateStillSquare: d => {
        if (!(d.rot >= 10 && d.rot <= 349)) return 'rot outside 10~349 (a visibly rotated square)';
        const pts = rectPts(d.desc.size, d.desc.size, d.rot);
        if (!isSquarePts(pts)) return 'the rotated square is not a square by this file\'s own geometry';
        if (d.stillSquare !== true) return 'rotation never breaks a square, stillSquare must be true';
        return extentsProblem(d.desc);
      },
      squareOrRectangle: d => {
        const { w, h, rot: r } = d.desc;
        const sq = isSquarePts(rectPts(w, h, r));
        if (d.actualSquare !== sq) return 'actualSquare disagrees with the geometry (w=' + w + ', h=' + h + ')';
        if (!sq && !(h >= w + 25)) return 'a non-square must be clearly taller (h >= w + 25)';
        return extentsProblem(d.desc);
      },
      sideCount: d => {
        if (!d.desc.pts) return 'sideCount must freeze its points (desc.pts) so the drawing matches the count';
        const want = d.desc.kind === 'triangle' ? 3 : 4;
        if (d.desc.pts.length !== want) return 'a ' + d.desc.kind + ' should have ' + want + ' vertices, got ' + d.desc.pts.length;
        if (sides(d.desc.pts).some(s => s < 8)) return 'a side is shorter than 8px — the child cannot see it';
        return extentsProblem(d.desc);
      },
      rightAngleCount: d => {
        if (!d.desc.pts) return 'rightAngleCount must freeze its points (desc.pts)';
        const mine = rightAngles(d.desc.pts);
        if (mine !== d.count) return 'right-angle count ' + d.count + ' disagrees with this file\'s geometry (' + mine + ')';
        /* 三角形：沒有一個角可以在 90° ± 8° 裡 —— 89.x° 兩邊都會算成直角，孩子卻看不出來 */
        if (d.desc.kind === 'triangle' && angles(d.desc.pts).some(a => Math.abs(a - 90) < 8)) return 'a triangle angle is within 8° of 90° — the right-angle question is not decidable by eye';
        if (d.desc.kind !== 'triangle' && mine !== 4) return 'a ' + d.desc.kind + ' should have 4 right angles';
        return extentsProblem(d.desc);
      },
      familyMatch: d => {
        if (!REF_FAM[d.obj]) return 'unknown object ' + d.obj;
        if (REF_FAM[d.obj] !== d.fam) return 'family for ' + d.obj + ' should be ' + REF_FAM[d.obj] + ', got ' + d.fam;
      },
      planeOrSolid: d => {
        if (d.isPlane){ if (!d.desc || PLANE.indexOf(d.desc.kind) < 0) return 'plane question without a plane shape'; return extentsProblem(d.desc); }
        if (!REF_FAM[d.obj]) return 'solid question with an unknown object ' + d.obj;
      },
      composeTriangleCount: d => {
        if (d.pieces.length !== 2 || d.count !== 2) return 'the square is made of exactly 2 triangles';
        const s = d.size;
        const ok = d.pieces.every(p => p.pts.length === 3 && rightAngles(p.pts) === 1) &&
                   Math.abs(sides(d.pieces[0].pts)[0] - s) < 1e-6;
        if (!ok) return 'the two pieces are not right triangles that tile an s×s square';
      },
      patternNext: d => {
        const kinds = [...new Set(d.seq)];
        if (kinds.length !== 2) return 'the pattern should alternate exactly 2 shapes, got ' + kinds.join(',');
        if (!(d.seq.length >= 4 && d.seq.length <= 5)) return 'seq length outside 4~5';
        if (period(d.seq) !== 2) return 'the sequence does not alternate';
        if (d.next !== d.seq[d.seq.length % 2]) return 'next does not continue the alternation';
        if (d.decoy === d.next || d.seq.indexOf(d.decoy) < 0) return 'decoy must be the other shape in the pattern';
      }
    },
    /* 正解的第二套實作：從 desc（畫出來的形狀）重算，不讀 count／actualSquare。 */
    expectedCorrect: function(d, genId, lang){
      const N = NAME[lang];
      switch (genId){
        /* 畫一個形狀，「這是什麼形狀？」 */
        case 'identifyShape':        return N.shape[d.desc.kind];
        /* 正方形轉了 rot 度，「還是正方形嗎？」—— 轉動不改變邊長與角度，一定還是 */
        case 'rotateStillSquare':    return isSquarePts(rectPts(d.desc.size, d.desc.size, d.rot)) ? N.stillYes : N.stillNo;
        /* 畫一個四邊形，「正方形還是長方形？」 */
        case 'squareOrRectangle':    return isSquarePts(rectPts(d.desc.w, d.desc.h, d.desc.rot)) ? N.sq : N.rc;
        /* 「這個形狀有幾個邊？」—— 數凍住的頂點 */
        case 'sideCount':            return String(d.desc.pts.length);
        /* 「有幾個直角？」—— 從凍住的頂點算內角 */
        case 'rightAngleCount':      return String(rightAngles(d.desc.pts));
        /* 「<物品> 是像什麼家族？」 */
        case 'familyMatch':          return N.fam[REF_FAM[d.obj]];
        /* 「平面圖形還是立體形體？」 */
        case 'planeOrSolid':         return d.desc ? N.plane : N.solid;
        /* 「幾個三角形合成這個正方形？」 */
        case 'composeTriangleCount': return String(d.pieces.length);
        /* 「規律接下去，下一個是誰？」 */
        case 'patternNext':          return N.shape[d.seq[d.seq.length % 2]];
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId, lang){
      const N = NAME[lang];
      const inSet = (set) => Object.values(set).indexOf(s) < 0 ? ('unexpected option ' + s) : null;
      switch (genId){
        case 'identifyShape': case 'patternNext': return inSet(N.shape);
        case 'rotateStillSquare': return [N.stillYes, N.stillNo].indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'squareOrRectangle': return [N.sq, N.rc].indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'familyMatch': return inSet(N.fam);
        case 'planeOrSolid': return [N.plane, N.solid].indexOf(s) < 0 ? ('unexpected option ' + s) : null;
        case 'sideCount': case 'composeTriangleCount': return /^[1-9]$/.test(s) ? null : ('option ' + s + ' is not a small count');
        case 'rightAngleCount': return /^[0-4]$/.test(s) ? null : ('option ' + s + ' outside 0~4 right angles');
        default: return 'unknown genId ' + genId;
      }
    },
    /* 選項都是名字或小數字，題幹只有 rotateStillSquare 印了度數（選項是文字）：沒有刻意抄題幹的誘答。 */
    stemEchoOk: {},
    /* 畫面那一側：畫的東西（stemShape／stemObj／stemPattern／stemCombo）要和選項對得上。
       SVG 是渲染時才由 bigShapeSVG(stemShape) 畫的，這裡用同一組 desc 自己算頂點。 */
    renderCheck: function(d, q, lang, genId){
      const N = NAME[lang];
      const want = q.opts[q.ans];
      if (q.stemShape){
        const ext = extentsProblem(q.stemShape);
        if (ext) return ext;
        if (genId === 'identifyShape'){
          if (want !== N.shape[q.stemShape.kind]) return 'the drawn ' + q.stemShape.kind + ' is marked as ' + want;
          if (q.stemShape.kind === 'square' && q.opts.indexOf(N.shape.rectangle) >= 0) return 'a square is drawn but "rectangle" is offered as a wrong option — a square IS a rectangle, so that option is reachable by correct reasoning (rectangle offered)';
          if (new Set(q.opts).size !== q.opts.length) return 'duplicate shape names among options';
        }
        if (genId === 'squareOrRectangle' && want !== (isSquarePts(rectPts(q.stemShape.w, q.stemShape.h, q.stemShape.rot)) ? N.sq : N.rc)) return 'drawn quadrilateral disagrees with the marked answer ' + want;
        if (genId === 'sideCount' && String(q.stemShape.pts.length) !== want) return 'drawn polygon has ' + q.stemShape.pts.length + ' sides but the marked answer is ' + want;
        if (genId === 'rightAngleCount' && String(rightAngles(q.stemShape.pts)) !== want) return 'drawn polygon has ' + rightAngles(q.stemShape.pts) + ' right angles but the marked answer is ' + want;
        if (genId === 'planeOrSolid' && want !== N.plane) return 'a flat shape is drawn but the marked answer is ' + want;
      } else if (['identifyShape', 'rotateStillSquare', 'squareOrRectangle', 'sideCount', 'rightAngleCount'].indexOf(genId) >= 0){
        return genId + ' has no stemShape — the shape is the question';
      }
      if (q.stemObj){
        if (!REF_FAM[q.stemObj]) return 'stemObj ' + q.stemObj + ' is not one of the taught objects';
        if (genId === 'familyMatch' && want !== N.fam[REF_FAM[q.stemObj]]) return 'shown object ' + q.stemObj + ' belongs to ' + REF_FAM[q.stemObj] + ' but the marked answer is ' + want + ' (family)';
        if (genId === 'planeOrSolid' && want !== N.solid) return 'a solid object is shown but the marked answer is ' + want;
        if (genId === 'familyMatch' && q.stem.indexOf(N.obj[q.stemObj]) < 0) return 'familyMatch stem does not name the shown object (' + N.obj[q.stemObj] + ')';
      } else if (genId === 'familyMatch') return 'familyMatch has no stemObj';
      if (genId === 'planeOrSolid' && !q.stemShape && !q.stemObj) return 'planeOrSolid shows nothing';
      if (q.stemPattern){
        const seq = q.stemPattern;
        const p = period(seq);
        if (p !== 2 || new Set(seq).size !== 2) return 'the drawn pattern does not alternate two shapes (alternate): ' + seq.join(',');
        if (want !== N.shape[seq[seq.length % 2]]) return 'the drawn pattern continues with ' + seq[seq.length % 2] + ' but the marked answer is ' + want;
      } else if (genId === 'patternNext') return 'patternNext has no stemPattern';
      if (genId === 'composeTriangleCount'){
        if (!(q.stemCombo > 0)) return 'composeTriangleCount has no stemCombo size';
        if (want !== '2') return 'two triangles are drawn but the marked answer is ' + want;
      }
      return null;
    }
  },

  data: {
    /* qs：4 張圖選一（4）、家族 3、是非 2；qsAdv 4／3／4／4；qsBoost 2／4。 */
    optCount: { qs: [2, 3, 4], qsAdv: [3, 4], qsBoost: [2, 4] },
    dataStart: '  /* ================= shape geometry (verified numerically, see scratchpad/test-shapegeo.js) ================= */',
    dataEnd: '  var I18N = {',
    dataReturn: '{bigShapeSVG, shapeIconSVG, familyIconSVG, ICON_PTS, CAT_KINDS, FAMILIES, OBJECT_POOL, makeSquare, makeRectangle, makeTriangle}',
    optionValueMax: 10,
    check: function(data, I18N, fail, src){
      /* --- 物品 → 家族表要和參考表一致 --- */
      const seenObj = {};
      FAMS.forEach(f => {
        (data.OBJECT_POOL[f] || []).forEach(o => {
          if (seenObj[o]) fail('OBJECT_POOL lists ' + o + ' in two families');
          seenObj[o] = true;
          if (REF_FAM[o] !== f) fail('OBJECT_POOL puts ' + o + ' in ' + f + ', reference says ' + REF_FAM[o]);
        });
      });
      Object.keys(REF_FAM).forEach(o => { if (!seenObj[o]) fail('OBJECT_POOL is missing ' + o); });
      if (data.CAT_KINDS.join() !== PLANE.join()) fail('CAT_KINDS is not the four plane shapes');

      /* --- 大圖／小圖示都要畫在畫布裡：預設 desc 在這裡畫一次再量；靜態題的每一個選項在下面
             的題庫迴圈裡也真的用 bigShapeSVG 畫出來量（不是只算 desc）。三角形的頂點每次畫都不同，
             量到的是這一次的樣本，加上 size × 1.05 ＋ 尖角的上限一起看。 --- */
      const descs = [ {kind:'triangle', rot:0}, {kind:'square', rot:0}, {kind:'rectangle', rot:0}, {kind:'circle'},
                      {kind:'square', rot:45}, {kind:'rectangle', rot:45}, {kind:'rectangle', rot:0, w:130, h:60} ];
      descs.forEach((desc, i) => {
        const p = svgExtentsProblem(data.bigShapeSVG(desc, 130), 'bigShapeSVG(' + JSON.stringify(desc) + ')');
        if (p) fail(p);
        const q = extentsProblem(desc);
        if (q) fail('default desc #' + i + ': ' + q);
      });
      PLANE.forEach(k => { const p = iconExtentsProblem(data.shapeIconSVG(k), 'shapeIconSVG(' + k + ')'); if (p) fail(p); });
      FAMS.forEach(f => { const p = iconExtentsProblem(data.familyIconSVG(f), 'familyIconSVG(' + f + ')'); if (p) fail(p); });

      /* --- 靜態題（選項是形狀描述物件）：問哪一種就要正好一個那一種、畫得進畫布；
             問長方形時不可以有正方形（正方形也是長方形）；家族題與規律題各自對照。 --- */
      const ASK = { zh: { 三角形:'triangle', 正方形:'square', 長方形:'rectangle', 圓形:'circle' },
                    en: { triangle:'triangle', square:'square', rectangle:'rectangle', circle:'circle' } };
      ['zh', 'en'].forEach(L => {
        const N = NAME[L];
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const tag = bank + '[' + i + '] ' + L;
            const stem = String(q.stem).replace(/<[^>]+>/g, '');
            if (q.kind === 'shape'){
              q.opts.forEach((o, k) => {
                const p = extentsProblem(o); if (p) fail(tag + ' opts[' + k + ']: ' + p);
                const s2 = svgExtentsProblem(data.bigShapeSVG(o, 130), tag + ' opts[' + k + '] drawn'); if (s2) fail(s2);
                if (o.kind === 'rectangle' && isSquarePts(rectPts(o.w || 118, o.h || 62, o.rot))) fail(tag + ' opts[' + k + ']: a "rectangle" with equal sides renders as a square');
              });
              const m = stem.match(/哪一個是(三角形|正方形|長方形|圓形)|Which one is (?:a |the )?(triangle|square|rectangle|circle)/);
              if (!m) return fail(tag + ': shape question stem does not name a shape: ' + stem);
              const askKind = ASK[L][m[1] || m[2]];
              const hits = q.opts.filter(o => o.kind === askKind).length;
              if (hits !== 1) fail(tag + ': ' + hits + ' options are a ' + askKind + ' (need exactly 1)');
              if (q.opts[q.ans].kind !== askKind) fail(tag + ': asks for a ' + askKind + ' but the marked answer is a ' + q.opts[q.ans].kind);
              if (askKind === 'rectangle' && q.opts.some(o => o.kind === 'square')) fail(tag + ': a square is also a rectangle — offering one makes the answer ambiguous');
              if (askKind === 'square' && q.opts.some(o => o.kind === 'rectangle' && isSquarePts(rectPts(o.w || 118, o.h || 62, o.rot)))) fail(tag + ': a "rectangle" option with equal sides is a square');
            } else if (q.kind === 'family'){
              if (q.opts.slice().sort().join() !== FAMS.slice().sort().join()) fail(tag + ': family options are not the three families');
              const obj = Object.keys(N.obj).find(o => stem.indexOf(N.obj[o]) >= 0);
              if (!obj) fail(tag + ': family stem names no known object: ' + stem);
              else if (q.opts[q.ans] !== REF_FAM[obj]) fail(tag + ': ' + N.obj[obj] + ' is ' + REF_FAM[obj] + ' but the marked answer is ' + q.opts[q.ans]);
            } else if (q.kind === 'pattern'){
              const em = stem.match(/[\u{1F53A}\u{2B1C}\u{26AA}\u{1F7E6}]/gu) || [];
              const seq = em.map(e => EMOJI_SHAPE[e]);
              if (seq.length < 4 || seq.some(s => !s)) return fail(tag + ': cannot read the pattern emoji in the stem: ' + stem);
              const p = period(seq);
              if (!p) return fail(tag + ': the stem pattern has no repeating unit');
              if (new Set(seq).size < 2) return fail(tag + ': a pattern of one shape has nothing to continue');
              const next = seq[seq.length % p];
              if (q.opts[q.ans].kind !== next) fail(tag + ': pattern continues with ' + next + ' but the marked answer is ' + q.opts[q.ans].kind);
              if (new Set(q.opts.map(o => o.kind)).size !== q.opts.length) fail(tag + ': duplicate shapes among pattern options');
              q.opts.forEach((o, k) => { const s2 = svgExtentsProblem(data.bigShapeSVG(o, 130), tag + ' opts[' + k + '] drawn'); if (s2) fail(s2); });
            } else if (q.kind === 'compose'){
              if (q.opts[q.ans].kind !== 'square') fail(tag + ': two right isosceles triangles make a square, marked answer is ' + q.opts[q.ans].kind);
              q.opts.forEach((o, k) => {
                const p = extentsProblem(o); if (p) fail(tag + ' opts[' + k + ']: ' + p);
                const s2 = svgExtentsProblem(data.bigShapeSVG(o, 130), tag + ' opts[' + k + '] drawn'); if (s2) fail(s2);
              });
            }
          });
        });
      });

      /* --- 分類站、規律表、小遊戲關卡 --- */
      const sorter = (src.match(/function buildSorterRounds\(\)\{\s*sorterRounds = (\[[\s\S]*?\]);/) || [])[1];
      if (!sorter) fail('cannot find sorterRounds in index.html');
      else new Function('return ' + sorter + ';')().forEach((r, i) => {
        if (PLANE.indexOf(r.kind) < 0) fail('sorterRounds[' + i + '] unknown kind ' + r.kind);
        const p = extentsProblem(r); if (p) fail('sorterRounds[' + i + ']: ' + p);
      });
      const PATTERNS = extractVar(src, 'PATTERNS');
      if (PATTERNS.length < 3) fail('PATTERNS should have at least 3 patterns');
      PATTERNS.forEach((pat, i) => {
        if (pat.seq.some(k => PLANE.indexOf(k) < 0)) fail('PATTERNS[' + i + '] unknown shape');
        const p = period(pat.seq);
        if (!p) return fail('PATTERNS[' + i + '] has no repeating unit visible in ' + pat.seq.join(','));
        if (new Set(pat.seq).size < 2) return fail('PATTERNS[' + i + '] uses one shape only — nothing to continue');
        if (pat.next !== pat.seq[pat.seq.length % p]) fail('PATTERNS[' + i + '] next should be ' + pat.seq[pat.seq.length % p] + ', got ' + pat.next);
        if (pat.decoys.length !== 2 || pat.decoys.indexOf(pat.next) >= 0 || new Set(pat.decoys).size !== 2) fail('PATTERNS[' + i + '] decoys must be 2 distinct shapes other than next');
        if (pat.decoys.some(k => PLANE.indexOf(k) < 0)) fail('PATTERNS[' + i + '] decoy is not a plane shape: ' + pat.decoys.join(','));
      });
      const gm = src.match(/function buildGameRounds\(\)\{\s*GAME_ROUNDS = (\[[\s\S]*?\]);/);
      if (!gm) fail('cannot find GAME_ROUNDS in index.html');
      else {
        const rows = gm[1].split('\n').filter(l => /type:/.test(l));
        if (rows.length !== 5) fail('GAME_ROUNDS should have 5 rounds, got ' + rows.length);
        rows.forEach((l, i) => {
          const fm = l.match(/obj: pick\(OBJECT_POOL\.(\w+)\), fam:'(\w+)'/);
          if (fm && fm[1] !== fm[2]) fail('GAME_ROUNDS[' + i + '] draws from OBJECT_POOL.' + fm[1] + ' but says fam ' + fm[2]);
          if (/type:'2d'/.test(l)){
            const km = l.match(/kind:\s*(?:pick\(\[([^\]]*)\]\)|'([a-z]+)')/);
            if (!km) fail('GAME_ROUNDS[' + i + '] 2d round has no readable kind');
            else {
              const kinds = km[1] !== undefined ? km[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [km[2]];
              kinds.forEach(k => { if (PLANE.indexOf(k) < 0) fail('GAME_ROUNDS[' + i + '] draws an unknown kind ' + k); });
            }
          }
        });
      }
    }
  }
};
