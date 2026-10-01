/* grade-3/math/rectangle 的檢查設定（方方正正的祕密：長方形四個直角、對邊相等；正方形再加上四邊相等；
   轉一轉不會變；兩條對角線一樣長，正方形的還交叉成直角；正方形也是長方形）。
   2026-10-01 新增 —— 這一課之前沒有設定檔；和小遊戲「性質檢查員」改成五關五種玩法（§六之五）同一次寫成。

   sim（review.html 的十一個產生器）：八個看圖的產生器用**自己的幾何**（邊長用 hypot、角用內積）重判
   圖是不是題幹說的那一種形狀、離「另一種」夠不夠遠（長方形的長寬差夠大、菱形的角離 90° 夠遠），
   再從**渲染出來的 SVG** 把多邊形、直角記號、等長記號的顏色組數、對角線讀回來比（renderCheck）。
   三個跨課的數字題（周長、乘法、十位數字）各有正解的第二套實作與範圍。

   data（index.html）：小遊戲的題庫與版面常數在 i18n 前面的資料區（從幾何工具開始，dataStart ～ dataEnd）。
   每一關用自己的算法重算、並且**照遊戲的規則把每一題從頭玩一次**：
   做記號把四個記號所有的放法走完（只會停在「上下一組、左右一組」，而且不會卡住）；
   釘板對每一根釘子判斷「收／菱形／不一樣長／兩樣都不對」，收得下的第 3 個角一定有第 4 個角、圍出來一定是正方形；
   對角線的長方形交叉角離 90° 很遠；名牌的每一組都有三類形狀、自己的分類和頁面的 shapeProps 一致；
   填邊長對每一格、每一張錯的數字卡判斷是哪一句、句子裡的數字對不對。
   頁面的純函式（markCorners／markSides／geoThirds／lenSides／tagCardXY …）拿整個題庫去呼叫再和自己的算法比；
   nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、吸附範圍重疊時挑最近的、375px 的實際尺寸由 teaching-workspace/game-harness/g3-rectangle 的
   端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
const hyp = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/* 自己的四邊形分類：四條邊、四個角（內積），不用課程的 shapeProps */
function geom(pts){
  const sides = [], angles = [];
  for (let i = 0; i < 4; i++){
    const p = pts[(i + 3) % 4], c = pts[i], n = pts[(i + 1) % 4];
    sides.push(hyp(c, n));
    const u = [p[0] - c[0], p[1] - c[1]], v = [n[0] - c[0], n[1] - c[1]];
    angles.push(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))))) * 180 / Math.PI);
  }
  const mx = Math.max(...sides), mn = Math.min(...sides);
  const right = angles.every(a => Math.abs(a - 90) < 0.5), anyRight = angles.some(a => Math.abs(a - 90) < 1.5);
  const allEq = mx - mn < 0.5, oppEq = Math.abs(sides[0] - sides[2]) < 0.5 && Math.abs(sides[1] - sides[3]) < 0.5;
  const kind = right ? (allEq ? 'square' : 'rectangle') : allEq ? 'rhombus' : oppEq ? 'parallelogram' : 'other';
  const offRight = Math.min(...angles.map(a => Math.abs(a - 90)));
  return { sides, angles, right, anyRight, allEq, oppEq, kind, ratio:mx / mn, offRight };
}
const svgPolys = html => [...String(html).matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].trim().split(/\s+/).map(p => p.split(',').map(Number)));
const rightMarks = html => (String(html).match(/<path d="M[^"]*Z" fill="#E3F4EB" stroke="#2F9E69"/g) || []).length;
/* 等長記號：短的那幾條線（長度 14）的顏色有幾種 */
function tickColors(html){
  const set = new Set();
  for (const m of String(html).matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="(#[0-9A-F]{6})" stroke-width="3.5"\/>/g)){
    if (Math.abs(Math.hypot(m[3] - m[1], m[4] - m[2]) - 14) < 0.3) set.add(m[5]);
  }
  return set.size;
}
const dashed = html => (String(html).match(/stroke-dasharray="6,5"/g) || []).length;
/* 記號放在哪裡（不只是數有幾個）：
   直角記號 —— 每一個 path 的起點必須是一個多邊形的角、四個起點各不相同、而且那個角真的是直角；
   等長記號 —— 每一條短線的中點歸給最近的一條邊，同一種顏色的邊必須一樣長、不同顏色的邊必須不一樣長，四條邊都要有記號；
   對角線 —— 剛好兩條虛線，各連 0–2 與 1–3 兩個對角。回傳第一個問題，沒有問題回傳 null。 */
function marksPlaced(html, P, wantDiag){
  const g = geom(P), at = (x, y) => P.findIndex(p => Math.abs(p[0] - x) < 0.06 && Math.abs(p[1] - y) < 0.06);
  const starts = [...String(html).matchAll(/<path d="M([\d.-]+),([\d.-]+) L[^"]*Z" fill="#E3F4EB" stroke="#2F9E69"/g)].map(m => at(+m[1], +m[2]));
  if (starts.some(i => i < 0)) return 'a right-angle mark does not start at a corner';
  if (new Set(starts).size !== starts.length) return 'two right-angle marks on the same corner';
  if (starts.some(i => Math.abs(g.angles[i] - 90) >= 1.5)) return 'a right-angle mark on a corner that is not a right angle';
  const sideOf = [];
  for (const m of String(html).matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="(#[0-9A-F]{6})" stroke-width="3.5"\/>/g)){
    if (Math.abs(Math.hypot(m[3] - m[1], m[4] - m[2]) - 14) >= 0.3) continue;
    const mx = (+m[1] + +m[3]) / 2, my = (+m[2] + +m[4]) / 2;
    let best = -1, bd = Infinity;
    for (let k = 0; k < 4; k++){
      const a = P[k], b = P[(k + 1) % 4], vx = b[0] - a[0], vy = b[1] - a[1], t = Math.max(0, Math.min(1, ((mx - a[0]) * vx + (my - a[1]) * vy) / (vx * vx + vy * vy)));
      const dd = Math.hypot(mx - a[0] - t * vx, my - a[1] - t * vy); if (dd < bd){ bd = dd; best = k; }
    }
    if (bd > 1) return 'an equal-side tick is not on a side';
    sideOf.push([best, m[5]]);
  }
  const colourOf = {};
  for (const [k, c] of sideOf){ if (colourOf[k] && colourOf[k] !== c) return 'side ' + k + ' carries two tick colours'; colourOf[k] = c; }
  if (Object.keys(colourOf).length !== 4) return 'only ' + Object.keys(colourOf).length + ' sides carry equal-side ticks';
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++){
    const same = Math.abs(g.sides[a] - g.sides[b]) < 1.5;
    if (same !== (colourOf[a] === colourOf[b])) return 'sides ' + a + ' and ' + b + ' are ' + (same ? 'equal but marked differently' : 'different but marked the same');
  }
  const dl = [...String(html).matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"[^>]*stroke-dasharray="6,5"/g)].map(m => [at(+m[1], +m[2]), at(+m[3], +m[4])].sort().join());
  if (wantDiag ? dl.sort().join('|') !== '0,2|1,3' : dl.length) return 'the dashed diagonals are ' + JSON.stringify(dl);
  return null;
}

const SHAPE_GENS = { rectProps:'rectangle', squareProps:'square', inclusionYesNo:'square', reverseInclusionYesNo:'rectangle',
  rhombusID:'rhombus', parallelogramID:'parallelogram', rotationInvariance:'square', diagonalEqual:'rectOrSquare' };
/* 正解的文字（第二份，自己抄一份；每一題的正解位置由產生器洗牌，這裡只管文字） */
const RIGHT_TEXT = {
  rectProps:{ zh:'4 個角都是直角，對邊相等', en:'All 4 angles right, opposite sides equal' },
  squareProps:{ zh:'4 個角都是直角，四邊都一樣長', en:'All 4 angles right, all 4 sides equal' },
  inclusionYesNo:{ zh:'是，因為正方形也符合「4 個角是直角、對邊相等」的條件', en:'Yes, because a square also meets “4 right angles, opposite sides equal”' },
  reverseInclusionYesNo:{ zh:'不是，因為長方形不一定四邊都一樣長', en:'No, because a rectangle doesn’t always have all 4 sides equal' },
  rhombusID:{ zh:'菱形', en:'Rhombus' },
  parallelogramID:{ zh:'平行四邊形', en:'Parallelogram' },
  rotationInvariance:{ zh:'還是，因為角度和邊長都沒有改變', en:'Still a square — angles and side lengths didn’t change' },
  diagonalEqual:{ zh:'一樣長', en:'Equal in length' }
};

function shapeInv(genId){
  return d => {
    if (!Array.isArray(d.pts) || d.pts.length !== 4) return 'no 4-point shape';
    for (const p of d.pts) if (!(p[0] >= 9.5 && p[0] <= 210.5 && p[1] >= 9.5 && p[1] <= 210.5)) return 'a corner at ' + p.map(v => v.toFixed(1)) + ' is outside 10~210 (the marks would leave the 220 canvas)';
    const g = geom(d.pts), want = SHAPE_GENS[genId];
    if (want === 'rectOrSquare'){ if (!g.right) return 'not a rectangle or square: angles ' + g.angles.map(a => a.toFixed(1)); return; }
    if (g.kind !== want) return 'the picture is a ' + g.kind + ', the question says ' + want;
    /* 畫面要決定得了答案：長方形的長寬要看得出不一樣；菱形、平行四邊形的角要看得出不是直角 */
    if (want === 'rectangle' && g.ratio < 1.2) return 'the rectangle is ' + g.ratio.toFixed(2) + ' : 1 — too close to a square to see';
    if ((want === 'rhombus' || want === 'parallelogram') && g.offRight < 10) return 'a corner of the ' + want + ' is only ' + g.offRight.toFixed(1) + '° from a right angle';
    /* 平行四邊形的兩組邊：題幹說「四邊不是都一樣長」，圖上的記號是兩種顏色；長度本身只要求看得出不相等 */
    if (want === 'parallelogram' && g.ratio < 1.05) return 'the parallelogram sides are almost equal (' + g.ratio.toFixed(2) + ') — it looks like a rhombus';
    if (genId === 'rotationInvariance'){
      const t = Math.atan2(d.pts[1][1] - d.pts[0][1], d.pts[1][0] - d.pts[0][0]) * 180 / Math.PI, m = ((t % 90) + 90) % 90;
      if (Math.min(m, 90 - m) < 4) return 'the "rotated" square is not visibly rotated (' + t.toFixed(1) + '°)';
    }
  };
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });", replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['mark', 'geo', 'diag', 'tag', 'len'];", replace:"var GAME_ORDER = ['mark', 'diag', 'geo', 'tag', 'len'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 44;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'not the nearest one', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best && !b.done){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'not the nearest one', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;" },
    { file:'index', expect:'does not show hint level 1 automatically', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'ahead'){ hintLevel = 0; }" },
    { file:'index', expect:'does not clear the stage', find:"    elHint.textContent = '';\n    gameStage.textContent = '';", replace:"    elHint.textContent = '';" },

    /* 做記號 */
    { file:'index', expect:'or it reads as a square', find:'var GAME_MARK = [ { w:6, h:3 },', replace:'var GAME_MARK = [ { w:6, h:5 },' },
    { file:'index', expect:'does not fit the 8 × 6 grid', find:'{ w:7, h:4 }, { w:4, h:2 },', replace:'{ w:9, h:4 }, { w:4, h:2 },' },
    { file:'index', expect:'markCorners() is', find:'var ox = MARK_GRID.x0 + Math.floor((MARK_GRID.cols - w) / 2) * MARK_U,', replace:'var ox = MARK_GRID.x0 + ((MARK_GRID.cols - w) / 2) * MARK_U,' },
    { file:'index', expect:'is not the segment', find:'return { cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2, hw:Math.abs(b[0] - a[0]) / 2,', replace:'return { cx:(a[0] + b[0]) / 2, cy:(a[1] + b[1]) / 2, hw:Math.abs(b[0] - a[0]),' },
    { file:'index', expect:'units, drawn', find:'len:i % 2 ? h : w, vert:i % 2 === 1 };', replace:'len:i % 2 ? w : h, vert:i % 2 === 1 };' },
    { file:'index', expect:'vert flag is wrong', find:'len:i % 2 ? h : w, vert:i % 2 === 1 };', replace:'len:i % 2 ? h : w, vert:false };' },
    { file:'index', expect:'is outside the 300×300 board', find:'MARK_GRID = { x0:30, y0:28, cols:8, rows:6 }', replace:'MARK_GRID = { x0:30, y0:18, cols:8, rows:6 }' },
    { file:'index', expect:'reaches the marks tray', find:'MARK_TRAY = { y:264, step:64, size:52 }', replace:'MARK_TRAY = { y:224, step:64, size:52 }' },
    { file:'index', expect:'mark tray 0 and 1 overlap', find:'MARK_TRAY = { y:264, step:64, size:52 }', replace:'MARK_TRAY = { y:264, step:50, size:52 }' },
    { file:'index', expect:'a side zone (2 × MARK_PAD)', find:'MARK_PAD = 23,', replace:'MARK_PAD = 18,' },
    { file:'index', expect:'the same mark can go on a side of a different length', find:"        if (same && same.len !== s.len){ roundMiss(d.gMarkDiff(K, same.len, s.len)); return false; }\n", replace:'' },
    { file:'index', expect:'a different mark can go on a side as long', find:"        if (other){ roundMiss(d.gMarkSame(other.mark, s.len)); return false; }", replace:"        if (other && false){ roundMiss(d.gMarkSame(other.mark, s.len)); return false; }" },
    { file:'index', expect:'not turned on a vertical side', find:"        if (s.vert) P.el.classList.add('gvert');", replace:'' },
    { file:'index', expect:'two one-line and two two-line marks', find:'renderTray(B, [1, 1, 2, 2], MARK_TRAY.y,', replace:'renderTray(B, [1, 2, 1, 2, 1], MARK_TRAY.y,' },
    { file:'index', expect:'gMarkDiff zh', find:"'」的那一條邊是 ' + a + ' 格，這一條邊是 ' + b + ' 格", replace:"'」的那一條邊是 ' + b + ' 格，這一條邊是 ' + a + ' 格" },
    { file:'index', expect:'gMarkDone en', find:"return 'Opposite sides are equal! Top and bottom are both ' + w + ' units, left and right are both ' + h + ' units.'; }", replace:"return 'Opposite sides are equal! Top and bottom are both ' + h + ' units, left and right are both ' + w + ' units.'; }" },
    { file:'index', expect:'the two marks have the same name', find:"      gSym: function(k){ return k === 1 ? '|' : '||'; },", replace:"      gSym: function(k){ return '|'; }," },

    /* 釘板 */
    { file:'index', expect:'the round gets stuck', find:'{ ax:1, ay:3, vx:2, vy:-1 }, { ax:1, ay:3, vx:2, vy:-2 },', replace:'{ ax:1, ay:4, vx:2, vy:-1 }, { ax:1, ay:3, vx:2, vy:-2 },' },
    { file:'index', expect:'corners 1 and 2 are not two pegs on the board', find:'{ ax:2, ay:1, vx:1, vy:2 },', replace:'{ ax:2, ay:4, vx:1, vy:2 },' },
    { file:'index', expect:'tilted squares', find:'{ ax:2, ay:4, vx:1, vy:-1 }, { ax:1, ay:4, vx:3, vy:0 } ];', replace:'{ ax:2, ay:4, vx:1, vy:-1 }, { ax:1, ay:4, vx:3, vy:1 } ];' },
    { file:'index', expect:'geoThirds() gives', find:'    return [[-e.vy, e.vx], [e.vy, -e.vx]].map(function(w){', replace:'    return [[-e.vy, e.vx]].map(function(w){' },
    { file:'index', expect:'geoThirds() corner 4 is', find:'d:{ x:e.ax + w[0], y:e.ay + w[1] }, w:w };', replace:'d:{ x:e.ax + w[0] + 1, y:e.ay + w[1] }, w:w };' },
    { file:'index', expect:'geoOn() accepts a peg off the board', find:'return p.x >= 0 && p.y >= 0 && p.x < GEO_N && p.y < GEO_N;', replace:'return p.x >= 0 && p.y >= 0 && p.x <= GEO_N && p.y < GEO_N;' },
    { file:'index', expect:'do not overlap at spacing', find:'GEO_PAD = 25,', replace:'GEO_PAD = 22,' },
    { file:'index', expect:'the corner pin at home sits inside a peg zone', find:'GEO_TOKEN = { x:150, y:318, size:52 }', replace:'GEO_TOKEN = { x:150, y:300, size:52 }' },
    { file:'index', expect:'(a rhombus) is accepted', find:"          if (dot !== 0 && w2 === v2){ roundMiss(d.gGeoRhombus); return false; }\n", replace:'' },
    { file:'index', expect:'a right angle with a different length is accepted', find:"          if (dot === 0 && w2 !== v2){ roundMiss(d.gGeoLen(e.vx, e.vy, wx, wy, w2 < v2)); return false; }\n", replace:'' },
    { file:'index', expect:'corner 4 is not checked', find:"        if (q.x !== A.x + C.x - Bc.x || q.y !== A.y + C.y - Bc.y){", replace:"        if (q.x !== A.x + C.x - Bc.x){" },
    { file:'index', expect:'corners 1 and 2 are not taken', find:'      peg(A).done = true; peg(Bc).done = true;', replace:'      peg(Bc).done = true;' },
    { file:'index', expect:'says "tilted"', find:"(tilted ? '它斜斜的，可是轉一轉還是正方形。' : '')", replace:"'它斜斜的，可是轉一轉還是正方形。'" },
    { file:'index', expect:'gGeoD en', find:"return 'Corner 4 must make the opposite sides equal: from corner 1, go ' + I18N.en.gStep(dx, dy)", replace:"return 'Corner 4 must make the opposite sides equal: from corner 1, go ' + I18N.en.gStep(dy, dx)" },
    { file:'index', expect:'gGeo2C zh', find:"return '第 3 個角：從第 2 個角' + I18N.zh.gStep(dx, dy)", replace:"return '第 3 個角：從第 1 個角' + I18N.zh.gStep(dx, dy)" },
    { file:'index', expect:'prints a minus sign', find:"if (dx) s.push((dx > 0 ? '往右 ' : '往左 ') + Math.abs(dx) + ' 格');", replace:"if (dx) s.push((dx > 0 ? '往右 ' : '往左 ') + dx + ' 格');" },
    { file:'index', expect:'does not name the rhombus', find:"gGeoRhombus:'This side is as long as the first side, but corner 2 is not a right angle — that would make a rhombus.", replace:"gGeoRhombus:'This side is as long as the first side, but corner 2 is not a right angle — that would make a diamond." },

    /* 對角線 */
    { file:'index', expect:'too close to a right angle', find:'{ rw:150, rh:76, s:92 },', replace:'{ rw:150, rh:110, s:92 },' },
    { file:'index', expect:'is outside the 300×392 board', find:'DIAG_Y = [80, 234],', replace:'DIAG_Y = [70, 234],' },
    { file:'index', expect:'runs into a corner dot', find:'DIAG_NAME_DY = 76;', replace:'DIAG_NAME_DY = 62;' },
    { file:'index', expect:'overlaps a corner or a name', find:'DIAG_TOOL = { x:150, y:360, size:56 }', replace:'DIAG_TOOL = { x:150, y:330, size:56 }' },
    { file:'index', expect:'neighbouring corners’ zones overlap', find:'DIAG_PAD = 24,', replace:'DIAG_PAD = 40,' },
    { file:'index', expect:'is not the opposite corner', find:'function diagCorners(cx, cy, w, h){ return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]; }', replace:'function diagCorners(cx, cy, w, h){ return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2], [cx + w / 2, cy + h / 2]]; }' },
    { file:'index', expect:'accepted as a diagonal', find:"        if ((c.i + 2) % 4 !== me.i){ roundMiss(d.gDiagSide); return false; }\n", replace:'' },
    { file:'index', expect:'accepted on the rectangle’s crossing', find:"          if (x.s.kind === 'rect'){ roundMiss(d.gDiagNotRight); return false; }\n", replace:'' },
    { file:'index', expect:'does not wait for all four diagonals', find:'        if (drawn === 4){\n          tool = addPiece(', replace:'        if (drawn >= 2){\n          tool = addPiece(' },
    { file:'index', expect:'both ends of a drawn diagonal are not locked', find:'pieceOf(me.s, c.i).lock(b[0], b[1]);', replace:'pieceOf(me.s, c.i);' },
    { file:'index', expect:'is not a way to draw', find:'if (S && S !== P && !S.data.tool && !P.data.tool && S.data.s === P.data.s){', replace:'if (false){' },
    { file:'index', expect:'which shape is on top is not random', find:'rectTop = Math.random() < 0.5,', replace:'rectTop = true,' },
    { file:'index', expect:'does not change as the diagonals are drawn', find:"(n === 2 ? '：兩條一樣長' : n === 3 ? '：一樣長、交叉成直角' : '')", replace:"''" },

    /* 貼名牌 */
    { file:'index', expect:'no shape without right angles', find:"['squareTilt', 'rectTall', 'rhombus', 'para'],\n    ['squareRot', 'rect', 'para', 'rectTall']", replace:"['squareTilt', 'rectTall', 'rhombus', 'para'],\n    ['squareRot', 'rect', 'square', 'rectTall']" },
    { file:'index', expect:'no square', find:"['square', 'rectTall', 'rhombusTilt', 'squareRot'],", replace:"['rect', 'rectTall', 'rhombusTilt', 'para']," },
    { file:'index', expect:'no rectangle that is not a square', find:"['square', 'rectTall', 'rhombusTilt', 'squareRot'],", replace:"['square', 'squareTilt', 'rhombusTilt', 'squareRot']," },
    { file:'index', expect:'reads as a square on a small card', find:'    rectRot:     rectPts(110, 110, 78, 42, 20),', replace:'    rectRot:     rectPts(110, 110, 62, 48, 20),' },
    { file:'index', expect:'from a right angle', find:'    rhombusTilt: rhombusPts(110, 110, 80, 50, 40),', replace:'    rhombusTilt: rhombusPts(110, 110, 70, 62, 40),' },
    { file:'index', expect:'leaves room for no marks', find:'    rect:        rectPts(110, 110, 82, 44, 0),', replace:'    rect:        rectPts(110, 110, 102, 44, 0),' },
    { file:'index', expect:'the page’s shapeProps() says', find:'    squareTilt:  rectPts(110, 110, 60, 60, 25),', replace:'    squareTilt:  rectPts(110, 110, 60, 59.6, 25),' },
    { file:'index', expect:'name-tag cards 0 and 1 overlap', find:'TAG_CARD = { w:140, h:122, gap:12, x:[74, 226],', replace:'TAG_CARD = { w:140, h:122, gap:12, x:[80, 216],' },
    { file:'index', expect:'need about', find:"gTagName: { sq:'Square', rect:'Rectangle' },", replace:"gTagName: { sq:'Square shape', rect:'Rectangle' }," },
    { file:'index', expect:'sits inside a card’s zone', find:'TAG_SRC = { y:298, w:120, h:48, x:[82, 218] }', replace:'TAG_SRC = { y:290, w:120, h:48, x:[82, 218] }' },
    { file:'index', expect:'"Square" sticks on something that is not a square', find:"        if (T === 'sq' && c.name !== 'square'){", replace:"        if (T === 'sq' && c.name !== 'square' && c.name !== 'rectangle'){" },
    { file:'index', expect:'"Rectangle" sticks on a shape without right angles', find:"        if (T === 'rect' && c.name !== 'square' && c.name !== 'rectangle'){", replace:"        if (T === 'rect' && c.name === 'parallelogram'){" },
    { file:'index', expect:'the same tag can be stuck twice', find:'        if (c.has[T]) return false;', replace:'' },
    { file:'index', expect:'"All tagged" is accepted with a square lacking', find:"        if (cards.some(function(c){ return c.name === 'square' && !c.has.rect; })){ roundMiss(d.gTagSqIsRect); return; }\n", replace:'' },
    { file:'index', expect:'2 per square and 1 per rectangle', find:"total += c.name === 'square' ? 2 : c.name === 'rectangle' ? 1 : 0;", replace:"total += c.name === 'square' ? 1 : c.name === 'rectangle' ? 1 : 0;" },
    { file:'index', expect:'the cards are not shuffled', find:'var keys = shuffle(pick(GAME_TAG))', replace:'var keys = pick(GAME_TAG)' },
    { file:'index', expect:'shows a total', find:"gTagNow: function(n){ return '貼好的名牌：' + n + ' 張'; },", replace:"gTagNow: function(n){ return '貼好的名牌：' + n + ' / 6'; }," },
    { file:'index', expect:'gTagMissing en', find:"gTagMissing: function(n){ return n + ' tags are still missing:", replace:"gTagMissing: function(n){ return (n + 1) + ' tags are still missing:" },
    { file:'index', expect:'not sent home', find:'srcs.forEach(function(P){ P.lock(P.homeX, P.homeY); });', replace:'srcs.forEach(function(P){ P.lock(P.cx, P.cy); });' },

    /* 填邊長 */
    { file:'index', expect:'one digit (one card)', find:"{ kind:'rect', a:8, b:5, g:0 },", replace:"{ kind:'rect', a:12, b:5, g:0 }," },
    { file:'index', expect:'too close to a square to draw', find:"{ kind:'rect', a:6, b:4, g:0 },", replace:"{ kind:'rect', a:6, b:5, g:0 }," },
    { file:'index', expect:'is not a valid choice of given sides', find:"{ kind:'rect', a:7, b:3, g:1 },", replace:"{ kind:'rect', a:7, b:3, g:2 }," },
    { file:'index', expect:'should have both rectangles and squares', find:"{ kind:'square', a:6, g:0 }, { kind:'square', a:5, g:3 }, { kind:'square', a:7, g:1 } ];", replace:"{ kind:'rect', a:6, b:2, g:0 }, { kind:'rect', a:5, b:3, g:1 }, { kind:'rect', a:7, b:4, g:1 } ];" },
    { file:'index', expect:'lenSides() side', find:"var given = e.kind === 'rect' ? (e.g === 0 ? [0, 3] : [2, 1]) : [e.g];", replace:"var given = e.kind === 'rect' ? (e.g === 0 ? [0, 2] : [2, 1]) : [e.g];" },
    { file:'index', expect:'runs into the digit cards', find:'LEN_KEYS = { y:282, step:56, rowStep:56, size:48 }', replace:'LEN_KEYS = { y:262, step:56, rowStep:56, size:48 }' },
    { file:'index', expect:'sits on the shape', find:'LEN_OFF = 26, LEN_OFF_V = 36,', replace:'LEN_OFF = 26, LEN_OFF_V = 24,' },
    { file:'index', expect:'lenCorners() is not', find:'    return diagCorners(150, LEN_CY, w, h);', replace:'    return diagCorners(150, LEN_CY, w, w);' },
    { file:'index', expect:'a wrong length is accepted, or has no reason of its own', find:'          else if (v === other(want)) roundMiss(d.gLenAdj(want, v));\n', replace:'' },
    { file:'index', expect:'the card is not compared with the side’s own length', find:'        var v = P.data.v, want = sl.s.len;', replace:'        var v = P.data.v, want = e.a;' },
    { file:'index', expect:'cards must never run out', find:"sl.done = true; sl.el.textContent = String(v); sl.el.classList.add('filled');\n        P.home(); filled++;", replace:"sl.done = true; sl.el.textContent = String(v); sl.el.classList.add('filled');\n        P.lock(sl.cx, sl.cy); filled++;" },
    { file:'index', expect:'no equal-side marks', find:"addLayer(B, LEN_H, shapeSVGMarkup(pts, { rightAngles:true, fill:", replace:"addLayer(B, LEN_H, shapeSVGMarkup(pts, { rightAngles:true, ticks:true, fill:" },
    { file:'index', expect:'gLenAdj zh', find:"是 ' + want + ' 公分；' + v + ' 公分是隔壁那一條邊。'", replace:"是 ' + v + ' 公分；' + want + ' 公分是隔壁那一條邊。'" },
    { file:'index', expect:'gLenDoneSq en', find:"return 'A square’s sides are all equal: all 4 are ' + a + ' cm.'; }", replace:"return 'A square’s sides are all equal: all 4 are ' + (a + 1) + ' cm.'; }" },
    { file:'index', expect:'names the wrong shape', find:"return kind === 'rect' ? 'This is a rectangle. How long is each unlabelled side?' : 'This is a square.", replace:"return kind === 'rect' ? 'This is a square. How long is each unlabelled side?' : 'This is a square." },

    /* ---- review.html：產生器 ---- */
    { file:'review', expect:'too close to a square to see', find:"        do { hh = 25 + rand(46); } while (Math.abs(hw - hh) < 14); // 25..70, keep distinct groups", replace:"        do { hh = 25 + rand(46); } while (Math.abs(hw - hh) < 1); // 25..70, keep distinct groups" },
    { file:'review', expect:'the picture is a square, the question says rectangle', find:"        do { hh = 25 + rand(46); } while (Math.abs(hw - hh) < 14);\n        var rot = randRot();\n        return { pts: fitPts(rectPts(110,110,hw,hh,rot)) };", replace:"        hh = hw;\n        var rot = randRot();\n        return { pts: fitPts(rectPts(110,110,hw,hh,rot)) };" },
    { file:'review', expect:'from a right angle', find:"        do { dv = 45 + rand(35); dh = 30 + rand(35); } while (Math.abs(dv - dh) < 15);", replace:"        do { dv = 45 + rand(35); dh = 30 + rand(35); } while (Math.abs(dv - dh) < 2);" },
    { file:'review', expect:'not visibly rotated', find:"        var rot = 5 + rand(80); // 5..84, clearly non-trivial rotation", replace:"        var rot = rand(80); // 5..84, clearly non-trivial rotation" },
    { file:'review', expect:'outside 10~210', find:"    maxR = maxR || 100;", replace:"    maxR = maxR || 110;" },
    { file:'review', expect:'right-angle marks drawn', find:"        if (Math.abs(props.angles[i]-90) < 1.5){\n          var cur", replace:"        if (Math.abs(props.angles[i]-90) < 30){\n          var cur" },
    { file:'review', expect:'colours of equal-side marks', find:"        var color = groups.length === 1 ? '#2F9E69' : TICK_COLORS[gi % TICK_COLORS.length];", replace:"        var color = '#2F9E69';" },
    { file:'review', expect:'diagonals drawn', find:"          pic: pic(d.pts, { diagonals:true }),", replace:"          pic: pic(d.pts),"},
    { file:'review', expect:'opts[ans] != correct', find:"        var r = shuffleWithAnswer(texts[1], [texts[0], texts[2], texts[3]]);", replace:"        var r = shuffleWithAnswer(texts[0], [texts[1], texts[2], texts[3]]);" },
    { file:'review', expect:'is not a digit', find:"        for (var k = 1; others.length < 3; k++){ var c = (tens + k) % 10; if (others.indexOf(c) < 0) others.push(c); }", replace:"        for (var k = 1; others.length < 3; k++){ var c = tens + k; if (others.indexOf(c) < 0) others.push(c); }" },
    { file:'review', expect:'perimeter', find:"        var per = (l + w) * 2;", replace:"        var per = l + w * 2;" },
    { file:'review', expect:'out of range', find:"        var b = 11 + rand(88); // 11..98", replace:"        var b = 11 + rand(140); // 11..98" },
    { file:'review', expect:'why quotes', find:"'4 個角都標了直角記號，但兩組對邊用不同顏色標記（不同組），代表只有對邊相等，不是四邊都相等。'", replace:"'4 個角都標了直角記號，但兩組對邊用不同顏色標記（不同組），代表只有「對邊」相等。'" }
,
    /* codex 第一輪之後加的 */
    { file:'index', expect:'the tie-break is missing', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dd < bd){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'would be called a rhombus', find:"          if (wx * e.vy - wy * e.vx === 0){ roundMiss(d.gGeoStraight); return false; }\n", replace:'' },
    { file:'index', expect:'gGeoStraight', find:"gGeoStraight:'That puts corners 1, 2 and 3 on one straight line", replace:"gGeoStraight:'That puts corners 1, 2 and 4 on one straight line" },
    { file:'index', expect:'does not give the steps', find:"return 'Corner 4 must make the opposite sides equal: from corner 1, go ' + I18N.en.gStep(dx, dy)", replace:"return 'Corner 4 must make the opposite sides equal: from corner 1, go ' + I18N.en.gStep(-dx, -dy)" },
    { file:'index', expect:'does not give the steps', find:"return '第 3 個角：從第 2 個角' + I18N.zh.gStep(dx, dy)", replace:"return '第 3 個角：從第 2 個角' + I18N.zh.gStep(-dx, -dy)" },
    { file:'index', expect:'gTagDone en does not say', find:"gTagDone:'A square is also a rectangle, so it gets two tags;", replace:"gTagDone:'A square is not a rectangle, so it gets two tags;" },
    { file:'index', expect:'gTagDone zh does not say', find:"長方形貼一張；角不是直角的形狀一張都不能貼。'", replace:"長方形貼一張。'" },
    { file:'index', expect:'not to scale', find:"    return diagCorners(150, LEN_CY, w, h);", replace:"    return diagCorners(150, LEN_CY, w * 1.1, h);" },
    { file:'review', expect:'right-angle mark', find:"          var cur = pts[i], prev = pts[(i-1+n)%n], next = pts[(i+1)%n];", replace:"          var cur = pts[0], prev = pts[(0-1+n)%n], next = pts[(0+1)%n];" },
    { file:'review', expect:'are different but marked the same', find:"          var a = pts[sideIdx], b = pts[(sideIdx+1)%n];", replace:"          var a = pts[sideIdx], b = pts[(sideIdx+1)%n]; if (groups.length > 1) color = TICK_COLORS[sideIdx < 2 ? 0 : 1];" },
    { file:'index', expect:'are different but marked the same', find:"          var a = pts[sideIdx], b = pts[(sideIdx+1)%n];", replace:"          var a = pts[sideIdx], b = pts[(sideIdx+1)%n]; if (groups.length > 1) color = TICK_COLORS[sideIdx < 2 ? 0 : 1];" },
    { file:'review', expect:'the dashed diagonals are', find:"      parts.push('<line x1=\"'+pts[1][0].toFixed(1)+'\" y1=\"'+pts[1][1].toFixed(1)+'\" x2=\"'+pts[3][0].toFixed(1)+'\" y2=\"'+pts[3][1].toFixed(1)+'\" stroke=\"#D64545\" stroke-width=\"2.5\" stroke-dasharray=\"6,5\"/>');", replace:"      parts.push('<line x1=\"'+pts[1][0].toFixed(1)+'\" y1=\"'+pts[1][1].toFixed(1)+'\" x2=\"'+pts[2][0].toFixed(1)+'\" y2=\"'+pts[2][1].toFixed(1)+'\" stroke=\"#D64545\" stroke-width=\"2.5\" stroke-dasharray=\"6,5\"/>');" }
  ],

  sim: {
    blockStart: '  /* ================= 幾何工具',
    INVARIANTS: Object.assign({}, ...Object.keys(SHAPE_GENS).map(k => ({ [k]:shapeInv(k) })), {
      perimeter: d => {
        if (!(isInt(d.l) && isInt(d.w) && d.l >= 4 && d.l <= 40 && d.w >= 3 && d.w <= 32)) return 'sides ' + d.l + ', ' + d.w + ' out of range';
        if (d.l === d.w) return 'a "rectangle" with equal sides';
        if (d.per !== 2 * d.l + 2 * d.w) return 'perimeter ' + d.per + ' != 2 × (' + d.l + ' + ' + d.w + ')';
      },
      multiply: d => {
        if (!(isInt(d.a) && d.a >= 2 && d.a <= 9 && isInt(d.b) && d.b >= 11 && d.b <= 98)) return 'factors out of range';
        if (d.prod !== d.a * d.b) return 'product wrong';
      },
      placeValue: d => {
        if (!(isInt(d.n) && d.n >= 1000 && d.n <= 9999)) return 'not a 4-digit number';
        if (d.tens !== Math.floor(d.n / 10) % 10) return 'tens digit wrong';
      }
    }),
    expectedCorrect: function(d, genId, lang){
      if (RIGHT_TEXT[genId]) return RIGHT_TEXT[genId][lang];
      if (genId === 'perimeter') return (2 * (d.l + d.w)) + (lang === 'zh' ? ' 公分' : ' cm');
      if (genId === 'multiply') return String(d.a * d.b);
      if (genId === 'placeValue') return String(Math.floor(d.n / 10) % 10);
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (SHAPE_GENS[genId]){ if (!s || /undefined|NaN/.test(s)) return 'option "' + s + '" is empty'; return; }
      if (genId === 'perimeter'){
        const m = s.match(lang === 'zh' ? /^(\d+) 公分$/ : /^(\d+) cm$/);
        if (!m) return 'option "' + s + '" is not a length in ' + lang;
        /* 上限是「長 × 寬」那個刻意的誘答（把周長算成乘起來）：長 ≤ 40、寬 ≤ 32 */
        if (+m[1] < 1 || +m[1] > 40 * 32) return 'option ' + s + ' out of range';
        return;
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      if (genId === 'placeValue' && +s > 9) return 'option ' + s + ' is not a digit';
      if (genId === 'multiply' && (+s < 1 || +s > 999)) return 'option ' + s + ' out of range';
    },
    /* 渲染出來的那一題：圖裡的多邊形就是資料裡的那一個，直角記號、等長記號、對角線跟題目說的一樣 */
    renderCheck: function(d, q, lang, genId){
      if (!SHAPE_GENS[genId]){ if (q.pic) return 'a number question should not carry a picture'; return; }
      const polys = svgPolys(q.pic);
      if (polys.length !== 1) return 'the picture has ' + polys.length + ' polygons';
      const P = polys[0];
      if (P.some((p, i) => Math.abs(p[0] - d.pts[i][0]) > 0.06 || Math.abs(p[1] - d.pts[i][1]) > 0.06)) return 'the drawn polygon is not the generated shape';
      const g = geom(P), rm = rightMarks(q.pic), tc = tickColors(q.pic);
      const wantRM = g.angles.filter(a => Math.abs(a - 90) < 1.5).length;
      if (rm !== wantRM) return rm + ' right-angle marks drawn, the shape has ' + wantRM + ' right angles';
      if (tc !== (g.allEq ? 1 : 2)) return tc + ' colours of equal-side marks, the shape has ' + (g.allEq ? 'all sides equal (1)' : 'two pairs (2)');
      if (dashed(q.pic) !== (genId === 'diagonalEqual' ? 2 : 0)) return 'diagonals drawn ' + dashed(q.pic) + ' times';
      const placed = marksPlaced(q.pic, P, genId === 'diagonalEqual');
      if (placed) return placed;
      if (!/viewBox="0 0 220 220"/.test(q.pic)) return 'the picture is not on the 220 canvas';
    }
  },

  data: {
    dataStart: '  /* ================= 幾何工具',
    dataEnd: '  /* ================= i18n ================= */',
    dataReturn: '{shapeProps, shapeSVGMarkup, SHP, GPICK, MARK_H, MARK_U, MARK_GRID, MARK_PAD, MARK_TRAY, GAME_MARK, markCorners, markSides, GEO_H, GEO_S, GEO_N, GEO_X0, GEO_Y0, GEO_PAD, GEO_TOKEN, GAME_GEO, geoXY, geoOn, geoThirds, DIAG_H, DIAG_X, DIAG_Y, DIAG_PAD, DIAG_TOOL, DIAG_TOOL_PAD, DIAG_NAME_DY, GAME_DIAG, diagCorners, TAG_H, TAG_CARD, TAG_PAD, TAG_SRC, TAG_SHAPES, GAME_TAG, tagCardXY, LEN_H, LEN_PX, LEN_CY, LEN_SLOT, LEN_OFF, LEN_OFF_V, LEN_PAD, LEN_KEYS, GAME_LEN, lenSides, lenCorners}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;
      const near = (a, b, t) => Math.abs(a - b) < (t || 1e-6);
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board (' + JSON.stringify(o) + ')'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      ['GAME_MARK', 'GAME_GEO', 'GAME_DIAG', 'GAME_TAG', 'GAME_LEN'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 3) fail(k + ' should be a pool of at least 3 entries');
      });
      /* 每一句說明：數字照順序逐個比 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
      };

      /* --- 1. 五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['mark', 'geo', 'diag', 'tag', 'len'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the four examples), got ' + types.join());
      }
      TYPES.forEach(t => {
        if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
        LANGS.forEach(L => {
          if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
          if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
        });
      });
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
      if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
      if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');
      if (!/restartGame\(\);\s*\}/.test(extractFunction(src, 'renderAll') || '')) fail('renderAll() (language switch) does not rebuild the game');

      /* --- 2. 觸控：375px 手機上卡片內寬（.wrap 與 .card 的左右 padding、1px 邊框從 CSS 讀），畫板縮成多少倍 --- */
      const wrapPad = +((src.match(/\.wrap\{[^}]*padding:\d+px (\d+)px/) || [])[1]), cardPad = +((src.match(/\.card\{[^}]*padding:(\d+)px/) || [])[1]);
      if (!(wrapPad > 0 && cardPad > 0)) fail('cannot read the .wrap / .card padding from the CSS');
      const scale = Math.min(1.5, (375 - 2 * wrapPad - 2 * cardPad - 2) / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a mark (' + D.MARK_TRAY.size + ')', D.MARK_TRAY.size);
      tooSmall('the corner pin (' + D.GEO_TOKEN.size + ')', D.GEO_TOKEN.size);
      tooSmall('the set square (' + D.DIAG_TOOL.size + ')', D.DIAG_TOOL.size);
      tooSmall('a name tag (' + D.TAG_SRC.h + ')', Math.min(D.TAG_SRC.w, D.TAG_SRC.h));
      tooSmall('a digit card (' + D.LEN_KEYS.size + ')', D.LEN_KEYS.size);
      tooSmall('a side-length box with its pad', D.LEN_SLOT + 2 * D.LEN_PAD);
      tooSmall('a side zone (2 × MARK_PAD)', 2 * D.MARK_PAD);
      tooSmall('a peg zone (2 × GEO_PAD)', 2 * D.GEO_PAD);
      need('diag', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:p\[0\], cy:p\[1\], cls:'gcorner'/, 'the corners you pull are not GPICK × GPICK on the corner');
      need('mark', /addPiece\(B, \{ w:MARK_TRAY\.size, h:MARK_TRAY\.size, cx:x, cy:y, cls:'gstamp'/, 'the marks are not MARK_TRAY.size');
      need('geo', /addPiece\(B, \{ w:GEO_TOKEN\.size, h:GEO_TOKEN\.size, cx:GEO_TOKEN\.x, cy:GEO_TOKEN\.y,/, 'the corner pin is not GEO_TOKEN');
      need('diag', /tool = addPiece\(B, \{ w:DIAG_TOOL\.size, h:DIAG_TOOL\.size, cx:DIAG_TOOL\.x, cy:DIAG_TOOL\.y,/, 'the set square is not DIAG_TOOL');
      need('tag', /addPiece\(B, \{ w:TAG_SRC\.w, h:TAG_SRC\.h, cx:TAG_SRC\.x\[i\], cy:TAG_SRC\.y,/, 'the name tags are not TAG_SRC');
      need('len', /addPiece\(B, \{ w:LEN_KEYS\.size, h:LEN_KEYS\.size, cx:150 \+ \(\(v % 5\) - 2\) \* LEN_KEYS\.step, cy:LEN_KEYS\.y \+ Math\.floor\(v \/ 5\) \* LEN_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');

      /* --- 3. 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0（§三 中年級） --- */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(src, 'roundMiss');
        if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      LANGS.forEach(L => {
        seq('gPts ' + L, I18N[L].gPts(20), [20]);
        seq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
      });

      /* --- 4. nearestOpen()：從原始碼切出來真的跑（邊是半高 0 的框、釘子和角是點） --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const segDist = (b, p) => Math.hypot(Math.max(0, Math.abs(p.x - b.cx) - b.hw), Math.max(0, Math.abs(p.y - b.cy) - b.hh));
          /* 自己挑：到框的距離最小；一樣近比到中心的距離；再一樣才是排在前面的那個 */
          const myPick = (list, p, pad) => {
            let best = null;
            list.forEach(b => {
              if (Math.abs(p.x - b.cx) > b.hw + pad || Math.abs(p.y - b.cy) > b.hh + pad) return;
              const k = [segDist(b, p), Math.hypot(p.x - b.cx, p.y - b.cy)];
              if (!best || k[0] < best.k[0] - 1e-9 || (Math.abs(k[0] - best.k[0]) <= 1e-9 && k[1] < best.k[1] - 1e-9)) best = { b, k };
            });
            return best && !best.b.done ? best.b : null;
          };
          /* 一樣近的時候要比中心：兩個框都包住那一點（到框的距離都是 0），中心比較近的是後面那一個 */
          const ties = [ { id:0, cx:100, cy:100, hw:60, hh:40, done:false }, { id:1, cx:130, cy:100, hw:20, hh:20, done:false } ];
          const rt = nearestOpen(ties, { x:128, y:100 }, 4);
          if (!rt || rt.id !== 1) fail('nearestOpen(): a point inside two boxes is not given to the one whose centre is nearer (the tie-break is missing)');
          /* 做記號：方格紙上每 1px 一個點，結果必須是「離得最近、而且在範圍裡」的那一條邊（自己量到線段的距離） */
          let bad = 0, overlapPts = 0;
          D.GAME_MARK.forEach(e => {
            const sides = D.markSides(e.w, e.h).map((s, i) => Object.assign({ id:i, done:false }, s));
            for (let x = 0; x <= W; x += 1) for (let y = 0; y <= D.MARK_H; y += 1){
              const p = { x, y }, inZone = sides.filter(s => Math.abs(x - s.cx) <= s.hw + D.MARK_PAD && Math.abs(y - s.cy) <= s.hh + D.MARK_PAD);
              if (inZone.length > 1) overlapPts++;
              const g = nearestOpen(sides, p, D.MARK_PAD);
              if (!inZone.length){ if (g) bad++; continue; }
              if (g !== myPick(sides, p, D.MARK_PAD)) bad++;
            }
          });
          if (bad) fail('nearestOpen(): ' + bad + ' points on the squared paper are given to a side that is not the nearest one');
          if (!overlapPts) fail('nearestOpen(): the side zones never overlap — the corner case the e2e test drops into does not exist');
          /* 釘板：任何一點都判給最近的釘子（釘子的範圍要重疊，不能有吸不到的縫） */
          const pegs = [];
          for (let gy = 0; gy < D.GEO_N; gy++) for (let gx = 0; gx < D.GEO_N; gx++){ const q = D.geoXY(gx, gy); pegs.push({ id:gy * D.GEO_N + gx, cx:q.x, cy:q.y, hw:0, hh:0, done:false }); }
          if (!(2 * D.GEO_PAD > D.GEO_S)) fail('peg zones (2 × ' + D.GEO_PAD + ') do not overlap at spacing ' + D.GEO_S + ' — a drop between two pegs snaps to nothing');
          let badP = 0;
          for (let x = D.GEO_X0; x <= D.GEO_X0 + (D.GEO_N - 1) * D.GEO_S; x += 1.5) for (let y = D.GEO_Y0; y <= D.GEO_Y0 + (D.GEO_N - 1) * D.GEO_S; y += 1.5){
            const g = nearestOpen(pegs, { x, y }, D.GEO_PAD), dmin = Math.min(...pegs.map(q => Math.hypot(x - q.cx, y - q.cy)));
            if (!g || Math.hypot(x - g.cx, y - g.cy) > dmin + 1e-9) badP++;
          }
          if (badP) fail('nearestOpen(): ' + badP + ' points on the geoboard are not given to the nearest peg');
          const done = [ { id:0, cx:100, cy:100, hw:0, hh:0, done:true }, { id:1, cx:136, cy:100, hw:0, hh:0, done:false } ];
          if (nearestOpen(done, { x:117, y:100 }, D.GEO_PAD) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, D.GEO_PAD) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
          /* 名牌：兩張卡片中間的縫，放寬之後重疊；縫裡每一點判給比較近的那一張 */
          const cards = [0, 1, 2, 3].map(i => { const a = D.tagCardXY(i); return { id:i, cx:a.x, cy:a.y, hw:D.TAG_CARD.w / 2, hh:D.TAG_CARD.h / 2, done:false }; });
          let badT = 0, ovT = 0;
          for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= D.TAG_H; y += 2){
            const p = { x, y }, inZone = cards.filter(c => Math.abs(x - c.cx) <= c.hw + D.TAG_PAD && Math.abs(y - c.cy) <= c.hh + D.TAG_PAD);
            if (inZone.length > 1) ovT++;
            const g = nearestOpen(cards, p, D.TAG_PAD);
            if (!inZone.length){ if (g) badT++; continue; }
            if (g !== myPick(cards, p, D.TAG_PAD)) badT++;
          }
          if (badT) fail('nearestOpen(): ' + badT + ' points around the name-tag cards are not given to the nearest card');
          if (!ovT) fail('name-tag card zones never overlap — the gap case the e2e test drops into does not exist');
        }
      }

      /* --- 5. 第 1 關：做記號（範例 1：對邊相等） --- */
      {
        const G = D.MARK_GRID, U = D.MARK_U;
        D.GAME_MARK.forEach((e, i) => {
          const w = 'GAME_MARK[' + i + ']';
          if (!(isInt(e.w) && isInt(e.h) && e.w >= 2 && e.h >= 2)) return fail(w + ': sides should be whole grid units ≥ 2');
          if (Math.abs(e.w - e.h) < 2) fail(w + ': ' + e.w + ' × ' + e.h + ' — the two pairs must differ by at least 2 units, or it reads as a square');
          if (e.w > G.cols || e.h > G.rows) return fail(w + ': ' + e.w + ' × ' + e.h + ' does not fit the ' + G.cols + ' × ' + G.rows + ' grid');
          const ox = G.x0 + Math.floor((G.cols - e.w) / 2) * U, oy = G.y0 + Math.floor((G.rows - e.h) / 2) * U;
          const mine = [[ox, oy], [ox + e.w * U, oy], [ox + e.w * U, oy + e.h * U], [ox, oy + e.h * U]];
          const got = D.markCorners(e.w, e.h);
          if (JSON.stringify(got) !== JSON.stringify(mine)) fail(w + ': markCorners() is ' + JSON.stringify(got) + ', should be ' + JSON.stringify(mine));
          /* 四個角都在格點上（孩子是數格子的） */
          mine.forEach(p => { if ((p[0] - G.x0) % U || (p[1] - G.y0) % U) fail(w + ': corner ' + p + ' is not on a grid dot'); });
          const sides = D.markSides(e.w, e.h);
          const wantLen = [e.w, e.h, e.w, e.h];
          sides.forEach((s, k) => {
            const a = mine[k], b = mine[(k + 1) % 4];
            if (!near(s.cx, (a[0] + b[0]) / 2) || !near(s.cy, (a[1] + b[1]) / 2) || !near(s.hw * 2, Math.abs(b[0] - a[0])) || !near(s.hh * 2, Math.abs(b[1] - a[1]))) fail(w + ': markSides() side ' + k + ' is not the segment ' + a + ' → ' + b);
            if (s.len !== wantLen[k] || hyp(a, b) !== wantLen[k] * U) fail(w + ': side ' + k + ' is ' + s.len + ' units, drawn ' + hyp(a, b) / U);
            if (s.vert !== (k % 2 === 1)) fail(w + ': side ' + k + ' vert flag is wrong (the mark would not turn)');
            /* 放好的記號（MARK_TRAY.size 見方、中心在邊的中點）在畫板裡、不碰到托盤 */
            inside(box(s.cx, s.cy, D.MARK_TRAY.size), w + ' a placed mark on side ' + k, W, D.MARK_H);
            if (s.cy + s.hh + D.MARK_PAD >= D.MARK_TRAY.y - D.MARK_TRAY.size / 2) fail(w + ': side ' + k + '’s zone reaches the marks tray');
          });
          /* 遊戲的規則從頭玩到尾：所有放法（四個記號、四條邊、任何順序），規則只會停在「上下一組、左右一组」，而且不會卡住 */
          const rule = (marks, k, side) => {
            if (marks[side]) return 'done';
            const same = marks.findIndex(m => m === k);
            if (same >= 0 && wantLen[same] !== wantLen[side]) return 'diff';
            if (marks.some((m, j) => m && m !== k && wantLen[j] === wantLen[side])) return 'same';
            return 'ok';
          };
          const seen = new Set(), stack = [{ marks:[0, 0, 0, 0], left:{ 1:2, 2:2 } }];
          let ends = 0;
          while (stack.length){
            const st = stack.pop(), key = st.marks.join(); if (seen.has(key)) continue; seen.add(key);
            if (st.marks.every(m => m)){
              ends++;
              if (!(st.marks[0] === st.marks[2] && st.marks[1] === st.marks[3] && st.marks[0] !== st.marks[1])) fail(w + ': the marking rule can end as ' + key);
              continue;
            }
            let moves = 0;
            [1, 2].forEach(k => { if (!st.left[k]) return; [0, 1, 2, 3].forEach(sd => { if (rule(st.marks, k, sd) !== 'ok') return; moves++; const m = st.marks.slice(); m[sd] = k; stack.push({ marks:m, left:Object.assign({}, st.left, { [k]:st.left[k] - 1 }) }); }); });
            if (!moves) fail(w + ': stuck at ' + key);
          }
          if (ends !== 2) fail(w + ': the marking rule should end in exactly 2 ways (which pair gets which mark), got ' + ends);
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let n = 0; n <= 4; n++) seq(w + ' gMarkNow ' + L, d.gMarkNow(n), [n, 4]);
            seq(w + ' gMarkDone ' + L, d.gMarkDone(e.w, e.h), [e.w, e.h]);
            seq(w + ' gMark2 ' + L, d.gMark2(e.w, e.h), [e.w, e.h]);
            [1, 2].forEach(k => { seq(w + ' gMarkDiff ' + L, d.gMarkDiff(k, e.w, e.h), [e.w, e.h]); seq(w + ' gMarkSame ' + L, d.gMarkSame(k, e.h), [e.h]); });
          });
        });
        LANGS.forEach(L => { if (I18N[L].gSym(1) === I18N[L].gSym(2)) fail('gSym ' + L + ': the two marks have the same name'); });
        /* 托盤：四個記號在畫板裡、互不碰到、離方格紙夠遠 */
        const tray = [0, 1, 2, 3].map(i => box((W - 3 * D.MARK_TRAY.step) / 2 + i * D.MARK_TRAY.step, D.MARK_TRAY.y, D.MARK_TRAY.size));
        tray.forEach((r, i) => inside(r, 'mark tray ' + i, W, D.MARK_H)); noHits(tray, 'mark tray');
        if (D.MARK_GRID.x0 < 0 || D.MARK_GRID.x0 + D.MARK_GRID.cols * D.MARK_U > W || D.MARK_GRID.y0 + D.MARK_GRID.rows * D.MARK_U > D.MARK_H) fail('the squared paper does not fit the board');
        need('mark', /renderTray\(B, \[1, 1, 2, 2\], MARK_TRAY\.y,/, 'the tray is not two one-line and two two-line marks');
        need('mark', /var s = nearestOpen\(sides, pt, MARK_PAD\);\s*if \(!s\) return false;/, 'a drop away from every side is not silent');
        need('mark', /if \(same && same\.len !== s\.len\)\{ roundMiss\(d\.gMarkDiff\(K, same\.len, s\.len\)\); return false; \}/, 'the same mark can go on a side of a different length');
        need('mark', /var other = sides\.filter\(function\(x\)\{ return x\.mark && x\.mark !== K && x\.len === s\.len; \}\)\[0\];\s*if \(other\)\{ roundMiss\(d\.gMarkSame\(other\.mark, s\.len\)\); return false; \}/, 'a different mark can go on a side as long as a marked one');
        need('mark', /s\.mark = K; s\.done = true;\s*P\.lock\(s\.cx, s\.cy\);\s*if \(s\.vert\) P\.el\.classList\.add\('gvert'\);/, 'a placed mark is not locked on the side (or not turned on a vertical side)');
        need('mark', /if \(placed === 4\) roundSolved\(d\.gMarkDone\(e\.w, e\.h\)\);/, 'the round is not solved exactly when all four sides are marked');
        need('mark', /var e = pick\(GAME_MARK\), G = MARK_GRID, U = MARK_U, sides = markSides\(e\.w, e\.h\), corners = markCorners\(e\.w, e\.h\)/, 'the rectangle is not drawn from markCorners()/markSides()');
      }

      /* --- 6. 第 2 關：釘板（範例 2：正方形四邊一樣長、四個直角，斜放也一樣） --- */
      {
        const on = q => q.x >= 0 && q.y >= 0 && q.x < D.GEO_N && q.y < D.GEO_N;
        let tilted = 0, straight = 0, rhombusSeen = 0, lenSeen = 0, straightSeen = 0;
        for (let gy = 0; gy < D.GEO_N; gy++) for (let gx = 0; gx < D.GEO_N; gx++){
          const q = D.geoXY(gx, gy);
          if (!near(q.x, D.GEO_X0 + gx * D.GEO_S) || !near(q.y, D.GEO_Y0 + gy * D.GEO_S)) fail('geoXY(' + gx + ', ' + gy + ') is off the grid');
          if (D.geoOn({ x:gx, y:gy }) !== true) fail('geoOn() rejects a peg on the board');
        }
        if (D.geoOn({ x:-1, y:0 }) || D.geoOn({ x:0, y:D.GEO_N }) || D.geoOn({ x:D.GEO_N, y:0 })) fail('geoOn() accepts a peg off the board');
        const pegBox = { x:D.GEO_X0 - D.GEO_PAD, y:D.GEO_Y0 - D.GEO_PAD, w:(D.GEO_N - 1) * D.GEO_S + 2 * D.GEO_PAD, h:(D.GEO_N - 1) * D.GEO_S + 2 * D.GEO_PAD };
        inside(pegBox, 'the geoboard with its peg zones', W, D.GEO_H);
        const tk = box(D.GEO_TOKEN.x, D.GEO_TOKEN.y, D.GEO_TOKEN.size);
        inside(tk, 'the corner pin', W, D.GEO_H);
        if (hit(tk, pegBox)) fail('the corner pin at home sits inside a peg zone — tapping it would also tap a peg');
        D.GAME_GEO.forEach((e, i) => {
          const w = 'GAME_GEO[' + i + ']', A = { x:e.ax, y:e.ay }, Bq = { x:e.ax + e.vx, y:e.ay + e.vy }, v2 = e.vx * e.vx + e.vy * e.vy;
          if (!on(A) || !on(Bq) || !v2) return fail(w + ': corners 1 and 2 are not two pegs on the board');
          if (e.vx && e.vy) tilted++; else straight++;
          /* 自己的第 3 個角：一樣長、和第一邊垂直（整數向量：只有 ±(−vy, vx) 兩個） */
          const mine = [];
          for (let y = 0; y < D.GEO_N; y++) for (let x = 0; x < D.GEO_N; x++){
            const wx = x - Bq.x, wy = y - Bq.y; if (!wx && !wy) continue;
            if (x === A.x && y === A.y) continue;
            const dot = wx * e.vx + wy * e.vy, w2 = wx * wx + wy * wy, cross = wx * e.vy - wy * e.vx;
            if (cross === 0) straightSeen++;
            else if (dot === 0 && w2 === v2) mine.push({ x, y });
            else if (dot !== 0 && w2 === v2){
              rhombusSeen++;
              /* 「會圍成菱形」要是真的：照平行四邊形補出第 4 個角，四邊一樣長、沒有直角 */
              const Dq = { x:A.x + wx, y:A.y + wy }, g4 = geom([A, Bq, { x, y }, Dq].map(q => [q.x, q.y]));
              if (g4.kind !== 'rhombus') fail(w + ': peg ' + x + ',' + y + ' gets the rhombus message but would make a ' + g4.kind);
            }
            else if (dot === 0) lenSeen++;
          }
          const th = D.geoThirds(e);
          if (JSON.stringify(th.map(t => t.c).sort((a, b) => a.x - b.x || a.y - b.y)) !== JSON.stringify(mine.sort((a, b) => a.x - b.x || a.y - b.y))) fail(w + ': geoThirds() gives ' + JSON.stringify(th.map(t => t.c)) + ', the pegs that make a right angle and the same length are ' + JSON.stringify(mine));
          if (!mine.length) fail(w + ': no peg can be corner 3');
          th.forEach(t => {
            const Dq = { x:A.x + t.c.x - Bq.x, y:A.y + t.c.y - Bq.y };
            if (t.d.x !== Dq.x || t.d.y !== Dq.y) fail(w + ': geoThirds() corner 4 is ' + JSON.stringify(t.d) + ', should be ' + JSON.stringify(Dq));
            if (!on(Dq)) fail(w + ': corner 3 at ' + JSON.stringify(t.c) + ' is accepted but corner 4 ' + JSON.stringify(Dq) + ' is off the board — the round gets stuck');
            const px = [A, Bq, t.c, Dq].map(q => { const p = D.geoXY(q.x, q.y); return [p.x, p.y]; }), g = geom(px);
            if (g.kind !== 'square') fail(w + ': corners ' + JSON.stringify([A, Bq, t.c, Dq]) + ' make a ' + g.kind + ', not a square');
            LANGS.forEach(L => {
              const d = I18N[L], sx = t.c.x - Bq.x, sy = t.c.y - Bq.y, st = [sx, sy].filter(Boolean).map(Math.abs);
              seq(w + ' gGeoD ' + L, d.gGeoD(sx, sy), [4, 1].concat(st, [2, 3]));
              /* 方向也要對：句子裡的步數必須就是 gStep(那個向量) 的原字（「往左」寫成「往右」數字一樣、意思相反） */
              [['gGeoD', d.gGeoD(sx, sy), sx, sy], ['gGeo2D', d.gGeo2D(sx, sy), sx, sy], ['gGeo2C', d.gGeo2C(t.w[0], t.w[1]), t.w[0], t.w[1]]].forEach(([nm, txt, x, y]) => {
                if (txt.indexOf(d.gStep(x, y)) < 0) fail(w + ' ' + nm + ' ' + L + ': does not give the steps ' + d.gStep(x, y) + ' — ' + txt);
              });
              seq(w + ' gGeo2D ' + L, d.gGeo2D(sx, sy), [4, 1].concat(st, [2, 3]));
              seq(w + ' gGeo2C ' + L, d.gGeo2C(t.w[0], t.w[1]), [3, 2].concat(st));
            });
          });
          LANGS.forEach(L => {
            const d = I18N[L], st = a => a.filter(Boolean).map(Math.abs);
            [[-e.vy * 2, e.vx * 2, false], [Math.sign(-e.vy), Math.sign(e.vx), true]].forEach(([wx, wy, sh]) => {
              const txt = d.gGeoLen(e.vx, e.vy, wx, wy, sh);
              seq(w + ' gGeoLen ' + L, txt, [2].concat(st([e.vx, e.vy]), st([wx, wy]), L === 'en' ? [4] : []));
              if (txt.indexOf(d.gStep(e.vx, e.vy)) < 0 || txt.indexOf(d.gStep(wx, wy)) < 0) fail(w + ' gGeoLen ' + L + ': the steps are not the two sides’ own steps — ' + txt);
            });
            seq(w + ' gGeoDone ' + L, d.gGeoDone(!!(e.vx && e.vy)), [4, 4]);
            if (/斜|tilted/.test(d.gGeoDone(!!(e.vx && e.vy))) !== !!(e.vx && e.vy)) fail(w + ' gGeoDone ' + L + ': says "tilted" for a square that is ' + (e.vx && e.vy ? 'tilted' : 'straight') + ' or the other way round');
          });
        });
        if (!tilted || !straight) fail('GAME_GEO should have tilted squares (rotation, example 2) and at least one straight one, got ' + tilted + ' tilted / ' + straight + ' straight');
        if (!rhombusSeen) fail('no GAME_GEO peg makes the rhombus mistake — gGeoRhombus is never reachable');
        if (!lenSeen) fail('no GAME_GEO peg makes the right-angle-wrong-length mistake');
        if (!straightSeen) fail('no GAME_GEO peg lies on the first side’s line — gGeoStraight is never reachable');
        /* 步數的說法：方向對、數字是正的（「往左 -1 格」數字掃描看不出來） */
        LANGS.forEach(L => {
          const words = L === 'zh' ? ['往右', '往左', '往下', '往上'] : ['right', 'left', 'down', 'up'];
          for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++){
            if (!dx && !dy) continue;
            const t = I18N[L].gStep(dx, dy), has = k => t.indexOf(words[k]) >= 0;
            if (/[-−]/.test(t)) fail('gStep ' + L + '(' + dx + ', ' + dy + ') prints a minus sign: ' + t);
            if (has(0) !== dx > 0 || has(1) !== dx < 0 || has(2) !== dy > 0 || has(3) !== dy < 0) fail('gStep ' + L + '(' + dx + ', ' + dy + ') goes the wrong way: ' + t);
            seq('gStep ' + L, t, [dx, dy].filter(Boolean).map(Math.abs));
          }
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let n = 2; n <= 4; n++) seq('gGeoNow ' + L, d.gGeoNow(n), [n, 4]);
          seq('gGeoRhombus ' + L, d.gGeoRhombus, [2]); seq('gGeoBoth ' + L, d.gGeoBoth, [2]); seq('gGeoStraight ' + L, d.gGeoStraight, [1, 2, 3, 2]);
          if (!/菱形|rhombus/.test(d.gGeoRhombus)) fail('gGeoRhombus ' + L + ' does not name the rhombus');
          if (!/短/.test(d.gGeoLen(2, 0, 0, 1, true) + d.gGeoLen(1, 0, 0, 2, false)) && L === 'zh') fail('gGeoLen zh does not say shorter');
        });
        need('geo', /if \(wx \* e\.vy - wy \* e\.vx === 0\)\{ roundMiss\(d\.gGeoStraight\); return false; \}\s*if \(dot !== 0 && w2 === v2\)\{ roundMiss\(d\.gGeoRhombus\); return false; \}/, 'a peg on the first side’s line is not caught before the rhombus message (it would be called a rhombus)');
        need('geo', /if \(dot !== 0 && w2 === v2\)\{ roundMiss\(d\.gGeoRhombus\); return false; \}/, 'the same length without a right angle (a rhombus) is accepted');
        need('geo', /if \(dot === 0 && w2 !== v2\)\{ roundMiss\(d\.gGeoLen\(e\.vx, e\.vy, wx, wy, w2 < v2\)\); return false; \}/, 'a right angle with a different length is accepted');
        need('geo', /if \(dot !== 0\)\{ roundMiss\(d\.gGeoBoth\); return false; \}/, 'a corner 3 that is neither is accepted');
        need('geo', /var wx = q\.x - Bc\.x, wy = q\.y - Bc\.y, dot = wx \* e\.vx \+ wy \* e\.vy, w2 = wx \* wx \+ wy \* wy;/, 'corner 3 is not measured from corner 2');
        need('geo', /if \(q\.x !== A\.x \+ C\.x - Bc\.x \|\| q\.y !== A\.y \+ C\.y - Bc\.y\)\{ roundMiss\(d\.gGeoD\(C\.x - Bc\.x, C\.y - Bc\.y\)\); return false; \}/, 'corner 4 is not checked to be corner 1 + (corner 3 − corner 2)');
        need('geo', /peg\(A\)\.done = true; peg\(Bc\)\.done = true;/, 'corners 1 and 2 are not taken (a pin could land on them)');
        need('geo', /var pg = nearestOpen\(pegs, pt, GEO_PAD\);\s*if \(!pg\) return false;/, 'a drop away from the pegs is not silent');
        need('geo', /roundSolved\(d\.gGeoDone\(e\.vx !== 0 && e\.vy !== 0\)\);/, 'the done message is not told whether the square is tilted');
        need('geo', /var t = geoThirds\(e\)\[0\]; return d\.gGeo2C\(t\.w\[0\], t\.w\[1\]\);/, 'hint 2 for corner 3 does not come from geoThirds()');
      }

      /* --- 7. 第 3 關：對角線（範例 3） --- */
      {
        const rows = D.DIAG_Y;
        if (!Array.isArray(rows) || rows.length !== 2) fail('DIAG_Y should be two rows');
        D.GAME_DIAG.forEach((e, i) => {
          const w = 'GAME_DIAG[' + i + ']';
          if (!(e.rw > e.rh && e.rh > 0 && e.s > 0)) return fail(w + ': not a wide rectangle and a square');
          const rect = D.diagCorners(D.DIAG_X, rows[0], e.rw, e.rh), sqr = D.diagCorners(D.DIAG_X, rows[1], e.s, e.s);
          const gr = geom(rect), gs = geom(sqr);
          if (gr.kind !== 'rectangle' || gs.kind !== 'square') fail(w + ': diagCorners() draws a ' + gr.kind + ' and a ' + gs.kind);
          /* 對角線交叉的角：自己算兩條對角線的夾角。長方形要離 90° 夠遠，直角尺放上去才看得出對不齊 */
          const cross = P => { const a = [P[2][0] - P[0][0], P[2][1] - P[0][1]], b = [P[3][0] - P[1][0], P[3][1] - P[1][1]]; return Math.acos(Math.abs(a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))) * 180 / Math.PI; };
          if (Math.abs(cross(sqr) - 90) > 1e-6) fail(w + ': the square’s diagonals cross at ' + cross(sqr));
          if (cross(rect) > 65) fail(w + ': the rectangle’s diagonals cross at ' + cross(rect).toFixed(1) + '° — too close to a right angle to see that the set square does not fit');
          if (!near(hyp(rect[0], rect[2]), hyp(rect[1], rect[3]))) fail(w + ': the rectangle’s diagonals are not equal');
          /* 對角線 = 編號差 2 的兩個角（形狀是照順序繞一圈的） */
          [rect, sqr].forEach((P, k) => P.forEach((p, j) => { const o = P[(j + 2) % 4], n = P[(j + 1) % 4]; if (p[0] === o[0] || p[1] === o[1] || (p[0] !== n[0] && p[1] !== n[1])) fail(w + ': corner ' + j + ' + 2 is not the opposite corner'); }));
          /* 兩種擺法（長方形在上／在下），角的積木、名字、交叉點都在畫板裡、互不碰到 */
          [[rows[0], rows[1]], [rows[1], rows[0]]].forEach(([ry, sy]) => {
            const R = D.diagCorners(D.DIAG_X, ry, e.rw, e.rh), S = D.diagCorners(D.DIAG_X, sy, e.s, e.s);
            const pieces = R.concat(S).map(p => box(p[0], p[1], D.GPICK));
            pieces.forEach((r, k) => inside(r, w + ' corner piece ' + k, W, D.DIAG_H)); noHits(pieces, w + ' corner pieces');
            /* 名字是畫在畫板上的字（點不到）：用兩種語言、四種狀態裡最寬的那一句估字寬，不可以碰到角的圓點（20px 見方）或另一個形狀 */
            const nameW = Math.max(...LANGS.map(L => Math.max(...['rect', 'square'].map(k => Math.max(...[0, 1, 2, 3].map(n => [...I18N[L].gDiagName(k, n)].reduce((a, ch) => a + (/[\u4e00-\u9fff：、]/.test(ch) ? 1 : 0.6) * 16, 0)))))));
            if (nameW > W - 8) fail(w + ': the longest shape name is about ' + nameW.toFixed(0) + 'px wide');
            const dots = R.concat(S).map(p => box(p[0], p[1], 20));
            const names = [box(D.DIAG_X, ry + D.DIAG_NAME_DY, nameW, 24), box(D.DIAG_X, sy + D.DIAG_NAME_DY, nameW, 24)];
            const shapesBox = [{ x:D.DIAG_X - e.rw / 2 - 3, y:ry - e.rh / 2 - 3, w:e.rw + 6, h:e.rh + 6 }, { x:D.DIAG_X - e.s / 2 - 3, y:sy - e.s / 2 - 3, w:e.s + 6, h:e.s + 6 }];
            names.forEach(n => { inside(n, w + ' a shape name', W, D.DIAG_H); dots.forEach(p => { if (hit(n, p)) fail(w + ': a shape name runs into a corner dot'); }); shapesBox.forEach(sb => { if (hit(n, sb)) fail(w + ': a shape name runs into a shape'); }); });
            const tool = box(D.DIAG_TOOL.x, D.DIAG_TOOL.y, D.DIAG_TOOL.size);
            inside(tool, w + ' the set square', W, D.DIAG_H);
            pieces.concat(names).forEach(p => { if (hit(tool, p)) fail(w + ': the set square at home overlaps a corner or a name'); });
            if (hit(shapesBox[0], shapesBox[1])) fail(w + ': the two shapes overlap');
            /* 同一個形狀相鄰的兩個角，吸附範圍不重疊（不然拖到對角也可能被當成隔壁的角） */
            [R, S].forEach(P => P.forEach((p, j) => { const n = P[(j + 1) % 4]; if (Math.abs(p[0] - n[0]) <= 2 * D.DIAG_PAD && Math.abs(p[1] - n[1]) <= 2 * D.DIAG_PAD) fail(w + ': neighbouring corners’ zones overlap'); }));
            R.forEach(p => S.forEach(q => { if (Math.abs(p[0] - q[0]) <= 2 * D.DIAG_PAD && Math.abs(p[1] - q[1]) <= 2 * D.DIAG_PAD) fail(w + ': a rectangle corner and a square corner share a zone'); }));
            if (Math.abs(ry - sy) <= 2 * D.DIAG_TOOL_PAD) fail(w + ': the two crossings’ set-square zones overlap');
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let n = 0; n <= 4; n++) seq('gDiagNow ' + L, d.gDiagNow(n), [n, 4]);
          for (let n = 1; n <= 4; n++) seq('gDiag2Line ' + L, d.gDiag2Line(n), [n]);
          ['rect', 'square'].forEach(k => { if (d.gDiagName(k, 2) === d.gDiagName(k, 0) || d.gDiagName(k, 3) === d.gDiagName(k, 2)) fail('gDiagName ' + L + ' does not change as the diagonals are drawn'); });
          if (d.gDiagName('rect', 0) === d.gDiagName('square', 0)) fail('gDiagName ' + L + ': the two shapes have the same name');
        });
        need('diag', /if \(\(c\.i \+ 2\) % 4 !== me\.i\)\{ roundMiss\(d\.gDiagSide\); return false; \}/, 'a corner pulled to the corner next to it is accepted as a diagonal');
        need('diag', /if \(!c \|\| c\.s !== me\.s \|\| c\.i === me\.i\) return false;/, 'a pull to the other shape or back to itself is not silent');
        need('diag', /if \(x\.s\.kind === 'rect'\)\{ roundMiss\(d\.gDiagNotRight\); return false; \}/, 'the set square is accepted on the rectangle’s crossing');
        need('diag', /if \(drawn === 4\)\{\s*tool = addPiece\(/, 'the set square does not wait for all four diagonals');
        need('diag', /c\.done = true; cornerOf\(me\.s, me\.i\)\.done = true;\s*P\.lock\(P\.homeX, P\.homeY\); pieceOf\(me\.s, c\.i\)\.lock\(b\[0\], b\[1\]\);/, 'both ends of a drawn diagonal are not locked');
        need('diag', /if \(S && S !== P && !S\.data\.tool && !P\.data\.tool && S\.data\.s === P\.data\.s\)\{/, 'tap a corner, then tap the opposite corner is not a way to draw');
        need('diag', /var e = pick\(GAME_DIAG\), rectTop = Math\.random\(\) < 0\.5/, 'which shape is on top is not random');
        need('diag', /s\.cx = DIAG_X; s\.pts = diagCorners\(s\.cx, s\.cy, s\.w, s\.h\);/, 'the shapes are not drawn with diagCorners()');
      }

      /* --- 8. 第 4 關：貼名牌（範例 4：正方形也是長方形） --- */
      {
        const C = D.TAG_CARD;
        const cards = [0, 1, 2, 3].map(i => { const a = D.tagCardXY(i); return box(a.x, a.y, C.w, C.h); });
        cards.forEach((r, i) => inside(r, 'name-tag card ' + i, W, D.TAG_H)); noHits(cards, 'name-tag cards');
        [0, 1, 2, 3].forEach(i => { const a = D.tagCardXY(i); if (a.x !== C.x[i % 2] || a.y !== C.y[Math.floor(i / 2)]) fail('tagCardXY(' + i + ') is off'); });
        if (!(C.gap > 0 && C.x[1] - C.x[0] - C.w === C.gap && C.y[1] - C.y[0] - C.h === C.gap)) fail('TAG_CARD.gap does not match the card positions');
        const srcs = D.TAG_SRC.x.map(x => box(x, D.TAG_SRC.y, D.TAG_SRC.w, D.TAG_SRC.h));
        srcs.forEach((r, i) => inside(r, 'tag source ' + i, W, D.TAG_H)); noHits(srcs, 'tag sources');
        srcs.forEach(r => cards.forEach(c => { if (hit(r, { x:c.x - D.TAG_PAD, y:c.y - D.TAG_PAD, w:c.w + 2 * D.TAG_PAD, h:c.h + 2 * D.TAG_PAD })) fail('a tag at home sits inside a card’s zone'); }));
        if (C.pic + 26 > C.h) fail('the card is too short for the picture and a row of tags');
        /* 一列名牌放得下（兩種語言都估一次寬度：中文 1 字一個字級、英文 0.62 字級；padding 與間隔從 CSS 讀） */
        const chipFont = +((src.match(/\.gchip\{font-size:(\d+)px/) || [])[1]), chipPad = +((src.match(/\.gchip\{[^}]*padding:0 (\d+)px/) || [])[1]), chipGap = +((src.match(/\.gchips\{[^}]*gap:(\d+)px/) || [])[1]);
        if (!(chipFont && chipPad && chipGap)) fail('cannot read the chip font / padding / gap from the CSS');
        LANGS.forEach(L => {
          const t = I18N[L].gTagName, est = s => [...s].reduce((a, ch) => a + (/[一-鿿]/.test(ch) ? 1 : 0.62) * chipFont, 0) + 2 * chipPad + 4;
          const widthAll = est(t.sq) + est(t.rect) + chipGap;
          if (widthAll > C.w - 8) fail('name tags ' + L + ': "' + t.sq + '" + "' + t.rect + '" need about ' + widthAll.toFixed(0) + 'px, the card is ' + C.w);
          const srcW = [...t.rect].reduce((a, ch) => a + (/[\u4e00-\u9fff]/.test(ch) ? 1 : 0.62) * 18, 0) + 14;
          if (srcW > D.TAG_SRC.w) fail('the "' + t.rect + '" tag source needs about ' + srcW.toFixed(0) + 'px, it is ' + D.TAG_SRC.w + ' in ' + L);
        });
        const mineKind = {};
        Object.keys(D.TAG_SHAPES).forEach(k => {
          const P = D.TAG_SHAPES[k], g = geom(P), pr = D.shapeProps(P);
          mineKind[k] = g.kind;
          if (pr.name !== g.kind) fail('TAG_SHAPES.' + k + ': the page’s shapeProps() says ' + pr.name + ', my own geometry says ' + g.kind);
          if (['square', 'rectangle', 'rhombus', 'parallelogram'].indexOf(g.kind) < 0) fail('TAG_SHAPES.' + k + ' is a ' + g.kind);
          if (g.kind === 'rectangle' && g.ratio < 1.5) fail('TAG_SHAPES.' + k + ': the rectangle is ' + g.ratio.toFixed(2) + ' : 1 — it reads as a square on a small card');
          if ((g.kind === 'rhombus' || g.kind === 'parallelogram') && g.offRight < 20) fail('TAG_SHAPES.' + k + ': a corner is only ' + g.offRight.toFixed(1) + '° from a right angle');
          P.forEach(p => { if (!(p[0] >= 12 && p[0] <= 208 && p[1] >= 12 && p[1] <= 208)) fail('TAG_SHAPES.' + k + ': corner ' + p.map(v => v.toFixed(1)) + ' leaves room for no marks on the 220 canvas'); });
          const html = D.shapeSVGMarkup(P, { ticks:true, rightAngles:true, fill:'#FFF' });
          if (rightMarks(html) !== (g.right ? 4 : 0)) fail('TAG_SHAPES.' + k + ': ' + rightMarks(html) + ' right-angle marks drawn on a ' + g.kind);
          if (tickColors(html) !== (g.allEq ? 1 : 2)) fail('TAG_SHAPES.' + k + ': ' + tickColors(html) + ' colours of side marks on a ' + g.kind);
          const placed = marksPlaced(html, P, false);
          if (placed) fail('TAG_SHAPES.' + k + ': ' + placed);
        });
        D.GAME_TAG.forEach((set, i) => {
          const w = 'GAME_TAG[' + i + ']';
          if (!Array.isArray(set) || set.length !== 4) return fail(w + ' should be four shapes');
          if (new Set(set).size !== 4) fail(w + ': the same shape twice');
          set.forEach(k => { if (!D.TAG_SHAPES[k]) fail(w + ': unknown shape ' + k); });
          const kinds = set.map(k => mineKind[k]);
          /* gTagDone 說的三件事都要真的出現在這一組裡 */
          if (kinds.indexOf('square') < 0) fail(w + ': no square — the "a square is also a rectangle" step never happens');
          if (kinds.indexOf('rectangle') < 0) fail(w + ': no rectangle that is not a square');
          if (!kinds.some(k => k === 'rhombus' || k === 'parallelogram')) fail(w + ': no shape without right angles');
          /* 規則：「正方形」只收正方形；「長方形」收長方形與正方形 —— 全部貼完的張數 */
          const total = kinds.reduce((a, k) => a + (k === 'square' ? 2 : k === 'rectangle' ? 1 : 0), 0);
          LANGS.forEach(L => { for (let n = 1; n <= total; n++) seq(w + ' gTagMissing ' + L, I18N[L].gTagMissing(n), [n]); for (let n = 0; n <= total; n++) seq(w + ' gTagNow ' + L, I18N[L].gTagNow(n), [n]); });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          seq('gTagSqIsRect ' + L, d.gTagSqIsRect, [4]);
          seq('gTagSqRect ' + L, d.gTagSqRect, [4]);
          for (let n = 1; n <= 6; n++) seq('gTag2 ' + L, d.gTag2(n), [n, 2, 1]);
          if (d.gTagNow(3).indexOf('/') >= 0) fail('gTagNow ' + L + ' shows a total — that gives away how many tags a square takes');
          if (d.gTagName.sq === d.gTagName.rect) fail('gTagName ' + L + ': the two tags have the same name');
          /* 過關那一句說了三件事：正方形兩張（也是長方形）、長方形一張、沒有直角的一張都不貼 */
          const done = d.gTagDone, need3 = L === 'zh' ? [/正方形同時是長方形/, /兩張/, /長方形貼一張/, /角不是直角的形狀一張都不能貼/] : [/square is also a rectangle/i, /two tags/, /rectangle gets one/, /without right angles gets none/];
          need3.forEach(re => { if (!re.test(done)) fail('gTagDone ' + L + ' does not say ' + re + ': ' + done); });
        });
        need('tag', /if \(T === 'sq' && c\.name !== 'square'\)\{ roundMiss\(c\.name === 'rectangle' \? d\.gTagSqRect : c\.name === 'rhombus' \? d\.gTagSqRhom : d\.gTagSqPara\); return false; \}/, '"Square" sticks on something that is not a square');
        need('tag', /if \(T === 'rect' && c\.name !== 'square' && c\.name !== 'rectangle'\)\{ roundMiss\(c\.name === 'rhombus' \? d\.gTagRectRhom : d\.gTagRectPara\); return false; \}/, '"Rectangle" sticks on a shape without right angles (or not on a square)');
        need('tag', /if \(c\.has\[T\]\) return false;/, 'the same tag can be stuck twice on one card');
        need('tag', /if \(cards\.some\(function\(c\)\{ return c\.name === 'square' && !c\.has\.rect; \}\)\)\{ roundMiss\(d\.gTagSqIsRect\); return; \}\s*if \(placed < total\)\{ roundMiss\(d\.gTagMissing\(total - placed\)\); return; \}/, '"All tagged" is accepted with a square lacking "Rectangle" or with tags missing');
        need('tag', /total \+= c\.name === 'square' \? 2 : c\.name === 'rectangle' \? 1 : 0;/, 'the number of tags to stick is not 2 per square and 1 per rectangle');
        need('tag', /var at = tagCardXY\(i\), pr = shapeProps\(TAG_SHAPES\[k\]\);/, 'the cards are not drawn at tagCardXY() / classified by shapeProps()');
        need('tag', /var keys = shuffle\(pick\(GAME_TAG\)\)/, 'the cards are not shuffled');
        need('tag', /var c = nearestOpen\(cards, pt, TAG_PAD\);\s*if \(!c\) return false;/, 'a drop away from the cards is not silent');
        need('tag', /srcs\.forEach\(function\(P\)\{ P\.lock\(P\.homeX, P\.homeY\); \}\);/, 'a tag being dragged when the round ends is not sent home');
      }

      /* --- 9. 第 5 關：填邊長（範例 1＋2） --- */
      {
        const keys = [];
        for (let v = 0; v <= 9; v++) keys.push(box(150 + ((v % 5) - 2) * D.LEN_KEYS.step, D.LEN_KEYS.y + Math.floor(v / 5) * D.LEN_KEYS.rowStep, D.LEN_KEYS.size));
        keys.forEach((r, v) => inside(r, 'digit card ' + v, W, D.LEN_H)); noHits(keys, 'digit cards');
        let rects = 0, squares = 0;
        D.GAME_LEN.forEach((e, i) => {
          const w = 'GAME_LEN[' + i + ']';
          const isRect = e.kind === 'rect';
          if (!isRect && e.kind !== 'square') return fail(w + ': kind ' + e.kind);
          if (isRect) rects++; else squares++;
          if (!(isInt(e.a) && e.a >= 2 && e.a <= 9) || (isRect && !(isInt(e.b) && e.b >= 2 && e.b <= 9))) return fail(w + ': side lengths must be one digit (one card) and at least 2');
          if (isRect && Math.abs(e.a - e.b) < 2) fail(w + ': ' + e.a + ' × ' + e.b + ' — too close to a square to draw');
          const S = D.lenSides(e), lens = isRect ? [e.a, e.b, e.a, e.b] : [e.a, e.a, e.a, e.a];
          const wpx = e.a * D.LEN_PX, hpx = (isRect ? e.b : e.a) * D.LEN_PX;
          const L0 = 150 - wpx / 2, R0 = 150 + wpx / 2, T0 = D.LEN_CY - hpx / 2, B0 = D.LEN_CY + hpx / 2;
          const at = [[150, T0 - D.LEN_OFF], [R0 + D.LEN_OFF_V, D.LEN_CY], [150, B0 + D.LEN_OFF], [L0 - D.LEN_OFF_V, D.LEN_CY]];
          const given = isRect ? (e.g === 0 ? [0, 3] : e.g === 1 ? [2, 1] : null) : (isInt(e.g) && e.g >= 0 && e.g <= 3 ? [e.g] : null);
          if (!given) return fail(w + ': g ' + e.g + ' is not a valid choice of given sides');
          if (isRect && (given[0] + given[1]) % 2 === 0) fail(w + ': the two given sides are opposite — the other two could not be worked out');
          const pcs = D.lenCorners(e);
          S.forEach((s, k) => {
            if (s.i !== k || s.len !== lens[k] || s.given !== (given.indexOf(k) >= 0) || !near(s.x, at[k][0]) || !near(s.y, at[k][1])) fail(w + ': lenSides() side ' + k + ' is ' + JSON.stringify(s) + ', should be len ' + lens[k] + ' given ' + (given.indexOf(k) >= 0) + ' at ' + at[k]);
            /* 畫成比例：那一條邊畫出來的 px ÷ LEN_PX 就是它的公分 */
            if (!near(hyp(pcs[k], pcs[(k + 1) % 4]) / D.LEN_PX, lens[k])) fail(w + ': side ' + k + ' is drawn ' + (hyp(pcs[k], pcs[(k + 1) % 4]) / D.LEN_PX) + ' cm long, it is ' + lens[k] + ' cm — not to scale');
            const r = s.given ? box(at[k][0], at[k][1], k % 2 ? 60 : 80, 32) : box(at[k][0], at[k][1], D.LEN_SLOT);
            inside(r, w + ' side ' + k + (s.given ? ' label' : ' box'), W, D.LEN_H);
            const shape = { x:L0 - 3, y:T0 - 3, w:wpx + 6, h:hpx + 6 };
            if (hit(r, shape)) fail(w + ': side ' + k + '’s ' + (s.given ? 'label' : 'box') + ' sits on the shape');
            keys.forEach(kb => { if (hit(r, kb)) fail(w + ': side ' + k + '’s ' + (s.given ? 'label' : 'box') + ' runs into the digit cards'); });
          });
          const pc = D.lenCorners(e), gm = geom(pc);
          if (gm.kind !== (isRect ? 'rectangle' : 'square') || !near(hyp(pc[0], pc[1]), wpx) || !near(hyp(pc[1], pc[2]), hpx)) fail(w + ': lenCorners() is not the ' + wpx + ' × ' + hpx + ' shape');
          /* 每一格、每一張錯的數字卡：是哪一句、句子裡的數字 */
          LANGS.forEach(L => {
            const d = I18N[L];
            S.filter(s => !s.given).forEach(s => {
              for (let v = 0; v <= 9; v++){
                if (v === s.len) continue;
                if (!isRect) seq(w + ' gLenSq ' + L, d.gLenSq(s.len, v), [s.len, v]);
                else if (v === (s.len === e.a ? e.b : e.a)) seq(w + ' gLenAdj ' + L, d.gLenAdj(s.len, v), [s.len, v]);
                else seq(w + ' gLenOpp ' + L, d.gLenOpp(s.len, v), [s.len, v]);
              }
              /* 正解一定能從畫面上推出來：長方形的對邊是寫出來的那一條，正方形任何一條寫出來的就是 */
              const opp = S[(s.i + 2) % 4];
              if (isRect && !opp.given) fail(w + ': side ' + s.i + ' and its opposite side are both blank — the picture does not determine it');
            });
            if (isRect) seq(w + ' gLenDoneRect ' + L, d.gLenDoneRect(e.a, e.b), [e.a, e.b]); else seq(w + ' gLenDoneSq ' + L, d.gLenDoneSq(e.a), [4, e.a]);
            if (isRect) seq(w + ' gLen2Rect ' + L, d.gLen2Rect(e.a, e.b), [e.a, e.b]); else seq(w + ' gLen2Sq ' + L, d.gLen2Sq(e.a), [e.a]);
            S.filter(s => s.given).forEach(s => seq(w + ' gLenCm ' + L, d.gLenCm(s.len), [s.len]));
            if (/正方形|square/i.test(d.gLenNow(e.kind)) === isRect) fail(w + ' gLenNow ' + L + ' names the wrong shape');
          });
        });
        if (!rects || !squares) fail('GAME_LEN should have both rectangles and squares');
        need('len', /if \(e\.kind === 'square'\) roundMiss\(d\.gLenSq\(want, v\)\);\s*else if \(v === other\(want\)\) roundMiss\(d\.gLenAdj\(want, v\)\);\s*else roundMiss\(d\.gLenOpp\(want, v\)\);\s*return false;/, 'a wrong length is accepted, or has no reason of its own');
        need('len', /var v = P\.data\.v, want = sl\.s\.len;\s*if \(v !== want\)\{/, 'the card is not compared with the side’s own length');
        need('len', /sl\.done = true; sl\.el\.textContent = String\(v\); sl\.el\.classList\.add\('filled'\);\s*P\.home\(\); filled\+\+;/, 'a filled box is not marked done, or the card does not go back (cards must never run out)');
        need('len', /if \(filled === slots\.length\) roundSolved\(/, 'the round is not solved exactly when every box is filled');
        need('len', /addLayer\(B, LEN_H, shapeSVGMarkup\(pts, \{ rightAngles:true, fill:/, 'the shape must show right angles but no equal-side marks (the property is used, not read off)');
        need('len', /var sl = nearestOpen\(slots, pt, LEN_PAD\);\s*if \(!sl\) return false;/, 'a drop away from the boxes is not silent');
      }
    }
  }
};
