/* grade-4/math/quadrilateral —— 四邊形家族（垂直、平行、平行四邊形、梯形、菱形）
 *
 * 這一課的正確性幾乎全部是**幾何**，所以這份設定裡有一套**獨立重寫**的向量判定：
 * 頁面說某個形狀是菱形，這裡不看它的標籤，自己從座標算一次。
 *
 * 整數座標讓所有判定完全精確（不需要容差）：
 *   平行 ⟺ 外積 ＝ 0；垂直 ⟺ 內積 ＝ 0；等長 ⟺ 長度平方相等。
 * 唯一的陷阱是**零向量**：它對任何向量的內積與外積都是 0，所以每條邊都要先
 * 確認不是一個點 —— 少了這一關，一個退化的「四邊形」會被判成什麼都是。
 */

/* ---------- 獨立參考實作（不從頁面 import 任何判定） ---------- */
function vsubRef(a, b){ return [b[0] - a[0], b[1] - a[1]]; }
function dotRef(u, v){ return u[0] * v[0] + u[1] * v[1]; }
function crossRef(u, v){ return u[0] * v[1] - u[1] * v[0]; }
function len2Ref(u){ return dotRef(u, u); }
function isSegRef(u){ return u[0] !== 0 || u[1] !== 0; }
function perpRef(u, v){ return isSegRef(u) && isSegRef(v) && dotRef(u, v) === 0; }
function paraRef(u, v){ return isSegRef(u) && isSegRef(v) && crossRef(u, v) === 0; }
function sidesRef(pts){
  const s = [];
  for (let i = 0; i < 4; i++) s.push(vsubRef(pts[i], pts[(i + 1) % 4]));
  return s;
}
function pairsRef(pts){
  const s = sidesRef(pts);
  return (paraRef(s[0], s[2]) ? 1 : 0) + (paraRef(s[1], s[3]) ? 1 : 0);
}
function rightRef(pts){
  const s = sidesRef(pts);
  let n = 0;
  for (let i = 0; i < 4; i++) if (perpRef(s[i], s[(i + 1) % 4])) n++;
  return n;
}
function eq4Ref(pts){
  const s = sidesRef(pts).map(len2Ref);
  return s[0] === s[1] && s[1] === s[2] && s[2] === s[3];
}
/* 梯形採「只有一組對邊平行」的定義 —— 平行四邊形不是梯形。四頁一致。 */
function classifyRef(pts){
  const p = pairsRef(pts);
  if (p === 2){
    const r = rightRef(pts) === 4, e = eq4Ref(pts);
    return (r && e) ? 'square' : r ? 'rect' : e ? 'rhom' : 'para';
  }
  if (p === 1){
    const s = sidesRef(pts).map(len2Ref);
    return (s[0] === s[2] || s[1] === s[3]) ? 'isotrap' : 'trap';
  }
  return 'quad';
}
const PARENTS_REF = { para:[], rect:['para'], rhom:['para'], square:['rect', 'rhom'],
                      trap:[], isotrap:['trap'], quad:[] };
function ancestorsRef(k){
  const out = [], seen = {};
  (function walk(x){
    (PARENTS_REF[x] || []).forEach(p => { if (!seen[p]){ seen[p] = true; out.push(p); walk(p); } });
  })(k);
  return out;
}
/* 退化檢查：沒有零長邊、相鄰邊不共線（共線的話那不是四邊形，是三角形或線段）。 */
function degenerate(pts){
  if (!Array.isArray(pts) || pts.length !== 4) return 'not four points';
  for (const p of pts){
    if (!Array.isArray(p) || p.length !== 2) return 'a vertex is not an [x,y] pair';
    for (const v of p) if (!Number.isFinite(v)) return 'a coordinate is not a finite number: ' + v;
  }
  const s = sidesRef(pts);
  for (let i = 0; i < 4; i++){
    if (!isSegRef(s[i])) return 'side ' + i + ' has zero length';
    if (crossRef(s[i], s[(i + 1) % 4]) === 0) return 'sides ' + i + ' and ' + ((i + 1) % 4) + ' are collinear';
  }
  return null;
}

/* ---------- 選項文字（刻意重抄一份，用來獨立算出「正解應該長什麼樣」） ---------- */
const SHAPE_TXT = {
  zh:{ para:'平行四邊形', rect:'長方形', rhom:'菱形', square:'正方形',
       trap:'梯形', isotrap:'等腰梯形', quad:'一般四邊形' },
  en:{ para:'a parallelogram', rect:'a rectangle', rhom:'a rhombus', square:'a square',
       trap:'a trapezium', isotrap:'an isosceles trapezium', quad:'an ordinary quadrilateral' }
};
const REL_TXT = {
  zh:{ perp:'互相垂直', para:'互相平行', neither:'既不垂直也不平行' },
  en:{ perp:'perpendicular', para:'parallel', neither:'neither perpendicular nor parallel' }
};
const PAIRS_TXT = {
  zh:n => n === 0 ? '一組都沒有' : (n === 1 ? '只有一組' : '兩組'),
  en:n => n === 0 ? 'none' : (n === 1 ? 'exactly one pair' : 'two pairs')
};
const GUARD_TXT = {
  zh:{ oppSide:'對邊一樣長', right4:'四個角都是直角', side4:'四邊都一樣長',
       onePair:'只有一組對邊平行', noPara:'沒有對邊平行' },
  en:{ oppSide:'opposite sides are equal', right4:'all four angles are right angles',
       side4:'all four sides are equal', onePair:'exactly one pair of opposite sides is parallel',
       noPara:'no opposite sides are parallel' }
};
const GUARANTEED_BY = { para:'oppSide', rect:'right4', rhom:'side4' };

const fs = require('fs');
const path = require('path');

/* 要比對的是**讀者看得到的字**，所以三種東西都要先剝掉：
   - 註解：我自己寫在程式裡的「只有一組」不該算進次數；
   - HTML 標籤：`和<strong>長短無關</strong>` 讀起來是「和長短無關」，
     可是當成字串比對時中間卡著一個標籤，永遠對不上（第一版就是這樣漏掉的）；
   - HTML 實體：`&lt;` 之類的不會出現在讀者眼裡的中文詞裡，順手還原。 */
function stripComments(src){
  return src.replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/\/\*[\s\S]*?\*\//g, ' ');
}
/* ⚠️ 剝標籤只能用在「數讀者看到的詞」上，**絕對不可以**拿來掃程式結構：
   `<[^>]+>` 碰到 JS 裡的 `i < 4; i++){ … >` 會把中間整段吃掉，
   於是 GEN_IDS 掃描會以為好幾支產生器不見了（第一版就是這樣自爆的）。 */
function readerText(src){
  return stripComments(src)
            .replace(/<[^>]+>/g, '')
            .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

/* 四頁必須用同一句話講同一條規則。min 是**剝掉註解之後**實際出現的次數 ——
   少於它就表示有一頁被改鬆了或整段被刪掉。 */
const SIBLING_RULES = [
  /* 「只有一組」是這一課唯一**四頁都必須逐字相同**的說法 —— 梯形和平行四邊形的
     分界全靠這四個字，任何一頁鬆口成「有一組」，整個家族分類就垮了。 */
  { file:'index',     text:'只有一組',       min:12, why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'reference', text:'只有一組',       min:6,  why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'review',    text:'只有一組',       min:4,  why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'parents',   text:'只有一組',       min:3,  why:'is the whole boundary between a trapezium and a parallelogram' },
  /* 其餘的規則允許各頁用自己的語氣（給孩子看的和給大人看的本來就不同），
     但每一頁自己的說法要在，被刪掉或改弱就要噴。 */
  { file:'index',     text:'兩組對邊都平行', min:5, why:'is the definition of a parallelogram' },
  { file:'reference', text:'兩組對邊都平行', min:2, why:'is the definition of a parallelogram' },
  { file:'review',    text:'兩組對邊都平行', min:4, why:'is the definition of a parallelogram' },
  { file:'parents',   text:'兩組都平行',     min:2, why:'is how the parents page states the parallelogram definition' },
  { file:'index',     text:'不再算梯形',     min:2, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'reference', text:'不再算梯形',     min:1, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'review',    text:'不再算梯形',     min:1, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'parents',   text:'不算梯形',       min:2, why:'is how the parents page states the same exclusion' },
  { file:'index',     text:'和長短無關',     min:2, why:'kills the "parallel means the same length" misconception' },
  { file:'reference', text:'和長短無關',     min:1, why:'kills the "parallel means the same length" misconception' },
  /* codex 2026-08-28：只問「叫什麼」的話，正方形同時也是長方形、菱形、平行四邊形，
     好幾個選項都答得通。題幹一定要問「最精確」。 */
  { file:'review',    text:'最精確',         min:2, why:'is what makes a naming question have exactly one correct answer' }
];

/* 產生器清單：改名或刪掉一整支，它那一組不變式、expectedCorrect 與
   renderCheck 會一起靜靜消失，什麼都不會噴。 */
const GEN_IDS = ['relation', 'perpTurned', 'paraLength', 'countPairs', 'nameByRule',
                 'nameShape', 'alsoIs', 'notAlways', 'trapBases', 'isoTrap',
                 'guaranteed', 'oddOneOut'];

/* ================= 小遊戲「形狀鑑定所」（§六之五：五關五種玩法） =================
   每一關照遊戲自己的規則（頁面資料區的純函式）把題庫的每一題玩一遍，正解一律用這份設定**自己的幾何**重算：
   方向向量的內積／外積、整數座標的平行與等長（上面的 *Ref 函式），角度用 cos／sin 帶容差。
   畫板座標、收的範圍、觸控大小都從資料區讀，用這裡自己的距離公式掃過整個畫板驗。 */
const { extractFunction } = require('./lib/gameshuffle.js');
/* 375px 手機上畫板的縮放：卡片 16＋內距 22×2＋邊框 → 舞台約 286px 寬（e2e 在 375px 實際量到 44 × k ＝ 42）。取下界。 */
const PHONE_K = Math.min(1.5, 286 / 300);
const GAME_TYPES = ['perp', 'para', 'mark', 'trap', 'family'];

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== GAME_TYPES.join())
    fail('GAME_ORDER should be ' + GAME_TYPES.join() + ' (the order of the five examples), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t].trim())) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && /^(提示 1|Hint 1)/.test(I18N[L].gHints[t]))) fail('gHints.' + t + ' missing in ' + L + ' (it must start with 提示 1 / Hint 1)');
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const touch = (what, sz) => { if (!(sz * PHONE_K >= 44)) fail(what + ' is ' + (sz * PHONE_K).toFixed(1) + 'px on a 375px phone — under 44'); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i][1], list[j][1])) return fail(what + ': ' + list[i][0] + ' and ' + list[j][0] + ' overlap'); };
  const segDistRef = (x, y, a, b) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], L2 = ux * ux + uy * uy;
    let t = ((x - a[0]) * ux + (y - a[1]) * uy) / L2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - a[0] - ux * t, y - a[1] - uy * t);
  };
  const boxDistRef = (x, y, b) => Math.hypot(Math.max(0, b.x - x, x - (b.x + b.w)), Math.max(0, b.y - y, y - (b.y + b.h)));
  const textOk = (where, s) => { if (typeof s !== 'string' || !s.trim() || /undefined|NaN|null|\[object/.test(s)) fail(where + ': bad text: ' + s); };
  const has = (where, s, words) => words.forEach(w => { if (String(s).indexOf(w) < 0) fail(where + ' should say "' + w + '": ' + s); });

  /* ---------- 共用：shuffle() 真的跑：是排列、不改輸入、永遠不會由小到大，每一張到過每一個位置 ---------- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated on its own: ' + e.message); } }
    if (shuffle){
      [[0, 1, 2], [0, 1, 2, 3], [0, 1, 2, 3, 4]].forEach(input => {
        const seen = {}, before = input.join(), perms = new Set();
        for (let i = 0; i < 4000; i++){
          const out = shuffle(input);
          if (input.join() !== before) return fail('shuffle() mutates its input');
          if (out.slice().sort((a, b) => a - b).join() !== before) return fail('shuffle() changed the set: ' + out);
          if (out.join() === before) return fail('shuffle() returned ' + out.join(',') + ' — the tray would start in the chart order');
          out.forEach((v, p) => { seen[v + '@' + p] = true; });
          perms.add(out.join());
        }
        const n = input.length, fact = [1, 1, 2, 6, 24, 120][n];
        if (n <= 4 && perms.size !== fact - 1) fail('shuffle() of ' + n + ' items produced ' + perms.size + ' orders, expected every order except the increasing one (' + (fact - 1) + ')');
        for (let v = 0; v < n; v++) for (let p = 0; p < n; p++) if (!seen[v + '@' + p]) return fail('shuffle(): item ' + v + ' never lands at position ' + p);
      });
    }
    need('family', /shuffle\(keys\.map\(function\(k, i\)\{ return i; \}\)\)\.forEach\(/, 'the shape cards are not shuffled into the tray');
  }
  /* ---------- 共用：計分（中年級 §三：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0）---------- */
  {
    const fsrc = extractFunction(src, 'roundSolved');
    if (!fsrc) fail('scoring: cannot find roundSolved() in index.html');
    else [[false, 0, 20], [true, 15, 25], [false, 40, 60]].forEach(([mis, s0, want]) => {
      let r;
      try { r = new Function('var gSolved = false, gMistake = ' + mis + ', gScore = ' + s0 + ', gRound = 1, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gHintBtn = {}, gNext = { disabled:true },' +
        ' gameStage = { querySelectorAll:function(){ return []; } }; function L(){ return { gPts:function(p){ return "@" + p + "@"; }, gClear:"", gWin:function(){ return ""; } }; }\n' + fsrc +
        '\nroundSolved("done"); roundSolved("again"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, solved:gSolved, next:gNext.disabled };')(); }
      catch (e){ return fail('scoring: roundSolved() could not run: ' + e.message); }
      const pts = mis ? 10 : 20;
      if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a round ' + (mis ? 'with' : 'without') + ' mistakes from ' + s0 + ' ends at ' + r.s + ', expected +' + pts + ' = ' + want + ' (and only once)');
      if (r.html.indexOf('@' + pts + '@') < 0 || r.html.indexOf('done') < 0 || !r.solved || r.next) fail('scoring: roundSolved() does not show "+' + pts + '", mark the round solved or enable Next');
    });
  }
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
  /* ---------- 共用：拖拉引擎（字面釘樁；真正的行為由 e2e 和改壞頁證明） ---------- */
  if (!/if \(gen !== gGen\) return;/.test(src) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src))
    fail('the drag engine has no board-generation guard: a piece held across Restart could act on the new board');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('startRound() does not bump gGen');
  if ((src.match(/if \(!start \|\| e\.pointerId !== pid\) return;/g) || []).length !== 2) fail('the drag engine does not follow only the first finger (move and end must both check pointerId)');
  if (!/document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(src)) fail('the drag engine has no document-level release while dragging');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on lostpointercapture');
  if (!/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on pointercancel');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('placed pieces still take pointer events');
  if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('pieces do not set touch-action:none');
  if (!/if \(P\.busy\(\)\) return;/.test(src)) fail('a tap-then-tap destination is taken while another finger still drags that piece');
  /* 拖的時候就吸在停車位上，放開判的就是看得到的那一個：follow 一定在 pointermove 裡呼叫 */
  if (!/if \(o\.follow\)\{ var f = o\.follow\(p\); P\.place\(f\.x, f\.y\); \}/.test(src)) fail('the drag engine does not snap a knob while it is being dragged (o.follow)');
  GAME_TYPES.forEach(t => { if ((B[t].match(/useTapSelect\(B, function\(P, pt\)\{/g) || []).length !== 1) fail(t + ': the round does not install its drop / tap-then-tap handler (useTapSelect)'); });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/gameStage\.textContent = '';/.test(src)) fail('startRound() does not clear the stage before rendering');
  LANGS.forEach(L => {
    if (!/20/.test(I18N[L].gPts(20))) fail('gPts ' + L + ' does not show the points');
    if (!/5/.test(I18N[L].gMinus)) fail('gMinus ' + L + ' does not say 5');
    if (String(I18N[L].gWin(85)).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score');
  });

  /* ---------- 每一關的收／不收／靜靜回去，照順序寫在 handler 裡（字面釘樁；行為由 e2e 與改壞頁證明） ---------- */
  const order = (k, lines, what) => {
    let at = -1;
    for (const l of lines){ const i = (B[k] || '').indexOf(l, at + 1); if (i < 0){ fail(k + ': ' + what + ' — missing or out of order: ' + l); return; } at = i; }
  };
  order('perp', ["if (pt.tap && !perpRing(pt.x, pt.y)) return false;", "if (k === 'start') return false;", "if (k !== 'ok'){ roundMiss(d.gPerpWhy[k]); return false; }", "P.lock(q.x, q.y);", "roundSolved(d.gPerpOk);"], 'only a perpendicular spot is accepted; the start is a silent bounce');
  order('para', ["if (!g) return false;", "if (k === 'start') return false;", "if (k !== 'ok'){ roundMiss(d.gParaWhy[k]); return false; }", "P.lock(q.x, q.y);", "roundSolved(d.gParaOk + ' ' + d.gParaDone("], 'only a parallel grid point is accepted; off-grid and the start are silent');
  order('mark', ["if (pt.fx !== undefined) cand.push(markPick(pts, kind, pt.fx, pt.fy));", "if (!r){ at = cand[c]; rule = null; break; }", "if (at === null || (rule && rule.key === 'full')) return false;", "if (rule){ roundMiss(markWhy(d, kind, at, rule)); return false; }", "P.lock(sc.x, sc.y);", "if (left === 0) roundSolved(d.gMarkDone);"], 'a sticker is placed where its centre OR the finger is allowed; empty/filled are silent');
  order('trap', ["if (pt.tap && !trapOnRail(e, pt.x, pt.y)) return false;", "if (k === 'start') return false;", "if (k === 'para'){ roundMiss(d.gTrapWhy.para); return false; }", "if (k === 'plain'){", "P.lock(trapX(cd), yt);", "roundSolved(d.gTrapOk);"], 'only the isosceles spot is accepted; the parallelogram and unequal legs are refused');
  order('family', ["if (!r) return false;", "if (r !== want){ roundMiss(d.gFamWhy[famWhy(kind, r)]); return false; }", "P.lock(G.home[r][0], G.home[r][1]);", "if (left === 0) roundSolved(d.gFamDone);"], 'only the most specific part is accepted; outside the chart is silent');
  const SAYS = {
    zh:{ perpSame:['疊'], perpOther:['不是直角'], paraPerp:['延長', '直角', '垂直'], paraOther:['延長', '相交'],
         notPara:['只有一組', '梯形'], notTrap:['兩組', '不算梯形'], noRight:['不是直角', '長方形'], noEq:['沒有都一樣長', '菱形'],
         isBoth:['直角', '一樣長', '重疊'], isRect:['直角', '也是長方形'], isRhom:['一樣長', '也是菱形'] },
    en:{ perpSame:['on top'], perpOther:['not a right angle'], paraPerp:['xtend', 'right angle', 'perpendicular'], paraOther:['xtend', 'meets'],
         notPara:['only one pair', 'trapezium'], notTrap:['both pairs', 'does not count'], noRight:['not right angles', 'rectangle'], noEq:['not all equal', 'rhombus'],
         isBoth:['right angles', 'four equal sides', 'overlap'], isRect:['right angles', 'rectangle too'], isRhom:['four equal sides', 'rhombus too'] }
  };
  /* 字詞清單分不出「是」和「不是」：再列出每一句**不可以**出現的否定說法（codex 第二輪） */
  const NOT = {
    zh:{ perpSame:['沒有疊'], paraPerp:['不會交出', '不是垂直'], paraOther:['不會和 AB 相交', '不會相交'], notTrap:['沒有兩組', '不是平行四邊形'],
         isBoth:['沒有', '不是'], isRect:['沒有', '不是直角'], isRhom:['沒有', '不一樣長'] },
    en:{ perpSame:['not on top', 'not lying'], paraPerp:['never meet at', 'not perpendicular'], paraOther:['never meets', 'does not meet'], notTrap:['not both', 'not a parallelogram'],
         isBoth:[' no ', 'not'], isRect:[' no ', 'not'], isRhom:[' no ', 'not'] }
  };
  /* 字詞清單擋得住刪掉、換掉，擋不住換個說法的否定句（codex 第三輪）。所以每一句放錯的理由（兩種語言）都用指紋釘住：
     改了任何一句，這裡就會響 —— 重新逐句確認那句話對每一種會叫到它的情況都是真的，再更新指紋。 */
  {
    const pickWhy = d => JSON.stringify([d.gPerpWhy, d.gParaWhy, d.gFamWhy, d.gTrapWhy.para, String(d.gTrapWhy.plain),
      String(d.gMarkAdjSide), String(d.gMarkMateSide), String(d.gMarkAdjAng), String(d.gMarkMateAng)]);
    const fp = require('crypto').createHash('sha1').update(pickWhy(I18N.zh) + pickWhy(I18N.en)).digest('hex');
    if (fp !== 'cdc13249672eca12a3da8a5d0690b75a9c26026e') fail('the game\'s mistake reasons changed (fingerprint ' + fp + ') — re-check every reason sentence against every case that calls it, then update the fingerprint');
  }
  const lacks = (where, s, words) => words.forEach(w => { if (String(s).indexOf(w) >= 0) fail(where + ' must not say "' + w + '" (it would deny the reason): ' + s); });
  LANGS.forEach(L => {
    const d = I18N[L], S = SAYS[L], X = NOT[L];
    lacks('gPerpWhy.same ' + L, d.gPerpWhy.same, X.perpSame); lacks('gParaWhy.perp ' + L, d.gParaWhy.perp, X.paraPerp); lacks('gParaWhy.other ' + L, d.gParaWhy.other, X.paraOther);
    ['notTrap', 'isBoth', 'isRect', 'isRhom'].forEach(k => lacks('gFamWhy.' + k + ' ' + L, d.gFamWhy[k], X[k]));
    has('gPerpWhy.same ' + L, d.gPerpWhy.same, S.perpSame); has('gPerpWhy.other ' + L, d.gPerpWhy.other, S.perpOther);
    has('gParaWhy.perp ' + L, d.gParaWhy.perp, S.paraPerp); has('gParaWhy.other ' + L, d.gParaWhy.other, S.paraOther);
    ['notPara', 'notTrap', 'noRight', 'noEq', 'isBoth', 'isRect', 'isRhom'].forEach(k => has('gFamWhy.' + k + ' ' + L, d.gFamWhy[k], S[k]));
  });

  /* ================= 第 1 關：轉一轉 ================= */
  {
    const G = D.PERP_G;
    const rad = s => s * Math.PI / 180, dir = s => [Math.cos(rad(s)), -Math.sin(rad(s))];
    if (!(Array.isArray(D.GAME_PERP) && D.GAME_PERP.length >= 4)) fail('GAME_PERP should hold at least 4 slanted directions');
    if (G.stop !== 30 || 360 % G.stop) fail('PERP_G.stop should be 30 (12 parking spots)');
    const stops = []; for (let s = 0; s < 360; s += G.stop) stops.push(s);
    /* 自己的分類：紅棒的方向和藍棒的方向 —— 內積 0 是垂直、外積 0 是疊在一起；紅點在一開始那一條線上（橫的）不算放 */
    const own = (base, s) => {
      const r = dir(s), b = dir(base), c = r[0] * b[0] + r[1] * b[1], x = r[0] * b[1] - r[1] * b[0], st = dir(G.start);
      if (Math.abs(c) < 1e-9) return 'ok';
      if (Math.abs(x) < 1e-9) return 'same';
      if (Math.abs(r[0] * st[1] - r[1] * st[0]) < 1e-9) return 'start';
      if (Math.abs(r[0]) < 1e-9) return 'upright';
      return 'other';
    };
    D.GAME_PERP.forEach(base => {
      const b = dir(base);
      if (Math.abs(b[0]) < 1e-6 || Math.abs(b[1]) < 1e-6) fail('GAME_PERP ' + base + ' is not slanted — the blue stick must be neither across nor upright');
      const kinds = stops.map(s => own(base, s));
      if (kinds.filter(k => k === 'ok').length !== 2) fail('GAME_PERP ' + base + ': ' + kinds.filter(k => k === 'ok').length + ' perpendicular spots, expected 2');
      if (kinds.filter(k => k === 'upright').length !== 2) fail('GAME_PERP ' + base + ': the upright spots are missing (the "upright = perpendicular" misconception is never tested)');
      if (kinds.filter(k => k === 'same').length !== 2) fail('GAME_PERP ' + base + ': the "on top of the blue stick" spots are missing');
      if (own(base, G.start) !== 'start') fail('GAME_PERP ' + base + ': the red knob would start on a spot that is judged');
      stops.forEach((s, i) => {
        if (D.perpKind(base, s) !== kinds[i]) fail('perpKind(' + base + ', ' + s + ') = ' + D.perpKind(base, s) + ', the own geometry says ' + kinds[i]);
      });
      ['same', 'upright', 'other'].forEach(k => LANGS.forEach(L => textOk('gPerpWhy.' + k + ' ' + L, I18N[L].gPerpWhy[k])));
    });
    /* 每一個停車位自己一塊：圓周上每 0.25° 判給最近的停車位；停車位正中、±35% 間距都判給它自己 */
    stops.forEach(s => {
      const q = D.perpXY(s);
      if (Math.abs(q.x - (G.cx + G.R * Math.cos(rad(s)))) > 1e-9 || Math.abs(q.y - (G.cy - G.R * Math.sin(rad(s)))) > 1e-9) fail('perpXY(' + s + ') is not on the circle');
      if (D.perpStop(q.x, q.y) !== s) fail('perpStop() of the spot ' + s + ' itself is ' + D.perpStop(q.x, q.y));
      inside(box(q.x, q.y, G.knob, G.knob), 'the knob on spot ' + s, G.H);
      if (!D.perpRing(q.x, q.y)) fail('spot ' + s + ' is outside the tap ring');
    });
    for (let a = 0; a < 360; a += 0.25){
      const want = Math.round(a / G.stop) * G.stop % 360;
      if (Math.abs(a - Math.round(a / G.stop) * G.stop) === G.stop / 2) continue;   /* 正好在兩個停車位中間 */
      [G.ringIn + 0.5, G.R, G.ringOut - 0.5].forEach(r => {
        const x = G.cx + r * Math.cos(rad(a)), y = G.cy - r * Math.sin(rad(a));
        if (D.perpStop(x, y) !== want) fail('perpStop at ' + a + '° (r ' + r + ') gives ' + D.perpStop(x, y) + ', the nearest spot is ' + want);
        if (!D.perpRing(x, y)) fail('perpRing() refuses a tap at ' + a + '°, r ' + r);
      });
    }
    if (D.perpRing(G.cx, G.cy) || D.perpRing(G.cx + G.ringOut + 2, G.cy)) fail('perpRing() accepts the crossing point or a tap far outside the ring');
    if (!(G.ringIn < G.R - 3 * G.dotR && G.ringOut > G.R + G.knob / 2)) fail('the tap ring ' + G.ringIn + '..' + G.ringOut + ' does not cover the drawn spots and the knob');
    inside(box(G.cx, G.cy, 2 * G.ringOut, 2 * G.ringOut), 'the tap ring', G.H);
    inside(box(G.cx, G.cy, 2 * G.line, 2 * G.line), 'the blue stick', G.H);
    touch('the round-1 knob', G.knob);
    need('perp', /var s = pt\.tap \? perpStop\(pt\.x, pt\.y\) : perpStop\(P\.cx, P\.cy\);/, 'a drag must be judged on the spot the knob is SHOWN on (perpStop of the knob centre)');
    need('perp', /follow:function\(p\)\{ return perpXY\(perpStop\(p\.x, p\.y\)\); \}/, 'the knob does not snap to the nearest spot while dragging');
    need('perp', /if \(pt\.tap && !perpRing\(pt\.x, pt\.y\)\) return false;/, 'a tap outside the ring is taken as a spot');
    LANGS.forEach(L => { has('gPerpWhy.upright ' + L, I18N[L].gPerpWhy.upright, [L === 'zh' ? '不是直角' : 'not a right angle']); has('gPerpOk ' + L, I18N[L].gPerpOk, [L === 'zh' ? '垂直' : 'perpendicular']); });
  }

  /* ================= 第 2 關：拉平行線 ================= */
  {
    const G = D.PARA_G;
    if (!(Array.isArray(D.GAME_PARA) && D.GAME_PARA.length >= 5)) fail('GAME_PARA should be a pool of at least 5 entries');
    const inGrid = p => p[0] >= 0 && p[0] < G.cols && p[1] >= 0 && p[1] < G.rows && Number.isInteger(p[0]) && Number.isInteger(p[1]);
    const ownKind = (e, st, g) => {
      const u = [e.b[0] - e.a[0], e.b[1] - e.a[1]], v = [g[0] - st[0], g[1] - st[1]];
      if (!v[0] && !v[1]) return 'start';
      if (crossRef(u, v) === 0) return 'ok';
      if (dotRef(u, v) === 0) return 'perp';
      return 'other';
    };
    const onLine = (p, a, u) => crossRef(u, [p[0] - a[0], p[1] - a[1]]) === 0;
    D.GAME_PARA.forEach((e, ei) => {
      const u = [e.b[0] - e.a[0], e.b[1] - e.a[1]], w = 'GAME_PARA[' + ei + ']';
      if (![e.a, e.b].concat(e.starts).every(inGrid)) return fail(w + ': a point is off the ' + G.cols + '×' + G.rows + ' grid');
      if (!u[0] || !u[1]) fail(w + ': AB is not slanted');
      if (!(u[0] > 0)) fail(w + ': AB must go to the right (the hint says "right ' + u[0] + '")');
      if (e.starts.length !== 2) fail(w + ': two red starts expected');
      e.starts.forEach((st, i) => {
        if (onLine(st, e.a, u)) fail(w + ': start ' + i + ' is on line AB — a line from it could lie on AB');
        const goods = [], perps = [];
        for (let c = 0; c < G.cols; c++) for (let r = 0; r < G.rows; r++){
          const k = ownKind(e, st, [c, r]), pk = D.paraKind(e, i, [c, r]);
          if (pk !== k) fail('paraKind(' + w + ', start ' + i + ', [' + c + ',' + r + ']) = ' + pk + ', own cross/dot gives ' + k);
          if (k === 'ok') goods.push(len2Ref([c - st[0], r - st[1]]));
          if (k === 'perp') perps.push([c, r]);
        }
        if (goods.length < 2) fail(w + ': start ' + i + ' has ' + goods.length + ' parallel grid points, expected at least 2');
        if (new Set(goods).size < 2 && goods.length) fail(w + ': start ' + i + '\'s parallel lines are all the same length — "parallel has nothing to do with length" is never shown');
      });
      const perpAny = e.starts.some((st, i) => { for (let c2 = 0; c2 < G.cols; c2++) for (let r2 = 0; r2 < G.rows; r2++) if (ownKind(e, st, [c2, r2]) === 'perp') return true; return false; });
      if (!perpAny) fail(w + ': no start can reach a perpendicular grid point — the "perpendicular is not parallel" reason is never reachable');
      if (onLine(e.starts[1], e.starts[0], u)) fail(w + ': the two starts are on one parallel — one line could end on the other start');
      const ks = e.starts.map(st => { const p = D.paraXY(st[0], st[1]); return box(p.x, p.y, G.knob, G.knob); });
      if (hit(ks[0], ks[1])) fail(w + ': the two knobs overlap');
      const L = D.paraLetters(e), A = D.paraXY(e.a[0], e.a[1]), Bq = D.paraXY(e.b[0], e.b[1]), half = D.MARK_G.letter / 2;
      if (!L.A || !L.B) { fail(w + ': no free place for the letter ' + (L.A ? 'B' : 'A')); return; }
      [['A', L.A, A], ['B', L.B, Bq]].forEach(([n, q, end]) => {
        const lb = box(q.x, q.y, 2 * half, 2 * half);
        inside(lb, w + ' letter ' + n, G.H);
        ks.forEach((k, i) => { if (hit(lb, k)) fail(w + ': letter ' + n + ' sits on knob ' + i); });
        if (segDistRef(q.x, q.y, [A.x, A.y], [Bq.x, Bq.y]) < half) fail(w + ': letter ' + n + ' sits on AB');
        if (Math.hypot(q.x - end.x, q.y - end.y) > 20) fail(w + ': letter ' + n + ' is not beside its end of AB');
      });
      if (hit(box(L.A.x, L.A.y, 2 * half, 2 * half), box(L.B.x, L.B.y, 2 * half, 2 * half))) fail(w + ': letters A and B overlap');
      LANGS.forEach(Lg => {
        const h = I18N[Lg].gPara2(u[0], u[1]);
        textOk('gPara2 ' + Lg, h);
        const ns = (h.match(/\d+/g) || []).map(Number);
        if (ns[1] !== u[0] || ns[2] !== Math.abs(u[1])) fail(w + ' hint ' + Lg + ' should say ' + u[0] + ' and ' + Math.abs(u[1]) + ': ' + h);
        const upWord = Lg === 'zh' ? '上' : 'up';
        if ((u[1] < 0) !== (h.indexOf(upWord) >= 0)) fail(w + ' hint ' + Lg + ' says up/down the wrong way (dy ' + u[1] + '): ' + h);
      });
    });
    /* 每一個格子點自己一塊：畫板上每 0.5px，paraDot 判給的點 ＝ 自己算的「哪一格」 */
    for (let x = 0.25; x < W; x += 0.5) for (let y = 0.25; y < G.H; y += 0.5){
      const c = (x - G.x0) / G.pitch, r = (y - G.y0) / G.pitch, rc = Math.round(c), rr = Math.round(r);
      const want = (rc >= 0 && rc < G.cols && rr >= 0 && rr < G.rows) ? rc + ',' + rr : null;
      const got = D.paraDot(x, y);
      if ((got ? got.join() : null) !== want){ fail('paraDot(' + x + ',' + y + ') = ' + got + ', the cell there is ' + want); x = W; break; }
      const sn = D.paraSnap(x, y), wc = Math.max(0, Math.min(G.cols - 1, rc)), wr = Math.max(0, Math.min(G.rows - 1, rr));
      if (sn.join() !== wc + ',' + wr){ fail('paraSnap(' + x + ',' + y + ') = ' + sn + ', expected ' + wc + ',' + wr); x = W; break; }
    }
    inside(box(G.x0, G.y0, G.knob, G.knob), 'a knob on the top-left grid point', G.H);
    inside(box(G.x0 + G.pitch * (G.cols - 1), G.y0 + G.pitch * (G.rows - 1), G.knob, G.knob), 'a knob on the bottom-right grid point', G.H);
    touch('the round-2 knob', G.knob);
    if (G.pitch * PHONE_K < 38) fail('round-2 grid points are ' + (G.pitch * PHONE_K).toFixed(1) + 'px apart on a phone — too close to tap');
    need('para', /var g = pt\.tap \? paraDot\(pt\.x, pt\.y\) : paraDot\(P\.cx, P\.cy\);/, 'a drag must be judged on the grid point the knob is SHOWN on');
    need('para', /follow:function\(p\)\{ var g = paraSnap\(p\.x, p\.y\); return paraXY\(g\[0\], g\[1\]\); \}/, 'the knob does not snap to the nearest grid point while dragging');
  }

  /* ================= 第 3 關：貼記號 ================= */
  {
    const G = D.MARK_G, N = 'ABCD';
    if (D.MARK_KINDS.slice().sort().join() !== 'a1,a1,a2,a2,p1,p1,p2,p2') fail('MARK_KINDS should be two of each sticker, got ' + D.MARK_KINDS);
    if (!(Array.isArray(D.GAME_MARK) && D.GAME_MARK.length >= 4)) fail('GAME_MARK should hold at least 4 parallelograms');
    const trayTop = Math.min(...G.trayY) - G.sticker / 2;
    const tray = D.MARK_KINDS.map((k, j) => ['sticker ' + j, box(G.trayX[j % 4], G.trayY[Math.floor(j / 4)], G.sticker, G.sticker)]);
    tray.forEach(t => inside(t[1], 'round-3 ' + t[0], G.H)); noHits(tray, 'round-3 tray'); touch('a round-3 sticker', G.sticker);
    const angDeg = (pts, i) => { const V = pts[i], u = vsubRef(V, pts[(i + 3) % 4]), v = vsubRef(V, pts[(i + 1) % 4]); return Math.acos(dotRef(u, v) / Math.sqrt(len2Ref(u) * len2Ref(v))) * 180 / Math.PI; };
    D.GAME_MARK.forEach((e, ei) => {
      const pts = e.pts, w = 'GAME_MARK[' + ei + ']', bad = degenerate(pts);
      if (bad) return fail(w + ': ' + bad);
      if (classifyRef(pts) !== 'para') fail(w + ' is ' + classifyRef(pts) + ' — it must be a plain parallelogram (no right angles, neighbouring sides different)');
      const s = sidesRef(pts);
      /* 邊的方向一路同一個轉向（凸的），而且 A 左下、B 右下、C、D 在上面 */
      const turns = [0, 1, 2, 3].map(i => Math.sign(crossRef(s[i], s[(i + 1) % 4])));
      if (new Set(turns).size !== 1) fail(w + ' is not convex');
      if (!(pts[0][1] === pts[1][1] && pts[0][0] < pts[1][0] && pts[2][1] < pts[1][1])) fail(w + ': A, B should be the bottom side left to right, C and D on top');
      for (let i = 0; i < 4; i++){
        const a = angDeg(pts, i), b = angDeg(pts, (i + 1) % 4);
        if (!(Math.abs(a - b) >= 30)) fail(w + ': ∠' + N[i] + ' and ∠' + N[(i + 1) % 4] + ' (' + a.toFixed(0) + '°, ' + b.toFixed(0) + '°) are too alike — the reason says "one sharp, one wide"');
        if ((a < 90) === (b < 90)) fail(w + ': ∠' + N[i] + ' and ∠' + N[(i + 1) % 4] + ' are not one sharp and one wide');
      }
      /* 位置：邊的虛線框在邊的正中、角的虛線圈在角裡面、字母在角外面；全部不重疊、在畫板裡、在托盤上面 */
      const parts = [];
      for (let i = 0; i < 4; i++){
        const m = D.markMid(pts, i), A = D.markAngle(pts, i), a = pts[i], b = pts[(i + 1) % 4];
        if (Math.abs(m.x - (a[0] + b[0]) / 2) > 1e-9 || Math.abs(m.y - (a[1] + b[1]) / 2) > 1e-9) fail(w + ': the slot for ' + N[i] + N[(i + 1) % 4] + ' is not at its midpoint');
        parts.push([N[i] + N[(i + 1) % 4] + ' slot', box(m.x, m.y, G.slotW, G.slotH)], ['∠' + N[i] + ' slot', box(A.slot.x, A.slot.y, 2 * G.angR, 2 * G.angR)], ['letter ' + N[i], box(A.letter.x, A.letter.y, G.letter, G.letter)]);
        /* 角的圈在形狀裡面、字母在外面（自己的判定：對每一條邊都在同一側） */
        const inPoly = (x, y) => [0, 1, 2, 3].every(j => Math.sign(crossRef(s[j], [x - pts[j][0], y - pts[j][1]])) === turns[0]);
        if (!inPoly(A.slot.x, A.slot.y)) fail(w + ': the ∠' + N[i] + ' slot is not inside the shape');
        if (inPoly(A.letter.x, A.letter.y)) fail(w + ': the letter ' + N[i] + ' is drawn inside the shape');
        /* 字母不壓到邊：字母中心到相鄰兩條邊至少 8（字本身約 12 寬） */
        [(i + 3) % 4, i].forEach(j => { if (segDistRef(A.letter.x, A.letter.y, pts[j], pts[(j + 1) % 4]) < 8) fail(w + ': the letter ' + N[i] + ' sits on a side'); });
        /* 角的圈不壓到邊：圓心到兩條邊的距離 ≥ 半徑 */
        [(i + 3) % 4, i].forEach(j => { if (segDistRef(A.slot.x, A.slot.y, pts[j], pts[(j + 1) % 4]) < G.angR - 1) fail(w + ': the ∠' + N[i] + ' slot crosses a side'); });
      }
      parts.forEach(p => { inside(p[1], w + ' ' + p[0], G.H); if (p[1].y + p[1].h > trayTop - 2) fail(w + ': ' + p[0] + ' reaches into the sticker tray'); });
      noHits(parts, w);
      /* 收的範圍（markPick）掃整個畫板每 1px：箭頭 → 最近的邊（距離 ＝ 到邊、到虛線框的較小值），弧線 → 最近的角（字母—頂點—虛線圈那一段），都在 reach 以內 */
      const ownPick = (kind, x, y) => {
        let best = null, bd = Infinity;
        for (let i = 0; i < 4; i++){
          let d;
          if (kind[0] === 'p'){ const m = D.markMid(pts, i); d = Math.min(segDistRef(x, y, pts[i], pts[(i + 1) % 4]), boxDistRef(x, y, box(m.x, m.y, G.slotW, G.slotH))); }
          else { const A = D.markAngle(pts, i); d = segDistRef(x, y, [A.letter.x, A.letter.y], [A.slot.x, A.slot.y]); }
          if (d <= G.reach && d < bd){ bd = d; best = i; }
        }
        return best;
      };
      let miss = 0;
      for (let x = 0.5; x < W && miss < 1; x += 1) for (let y = 0.5; y < trayTop; y += 1){
        for (const kind of ['p1', 'a1']) if (D.markPick(pts, kind, x, y) !== ownPick(kind, x, y)){ fail(w + ': markPick(' + kind + ', ' + x + ', ' + y + ') = ' + D.markPick(pts, kind, x, y) + ', the nearest target is ' + ownPick(kind, x, y)); miss++; break; }
        if (miss) break;
      }
      /* 看得到的東西一定收：邊的虛線框（每一點）、整條邊（每 2%），角的虛線圈、字母（每一點）、頂點 */
      for (let i = 0; i < 4 && !miss; i++){
        const m = D.markMid(pts, i), A = D.markAngle(pts, i);
        const pick = (k, x, y, what) => { if (!miss && D.markPick(pts, k, x, y) !== i){ fail(w + ': ' + what + ' of ' + (k[0] === 'p' ? N[i] + N[(i + 1) % 4] : '∠' + N[i]) + ' at (' + x.toFixed(1) + ',' + y.toFixed(1) + ') is judged as ' + D.markPick(pts, k, x, y)); miss++; } };
        for (let dx = -G.slotW / 2; dx <= G.slotW / 2; dx += 1) for (let dy = -G.slotH / 2; dy <= G.slotH / 2; dy += 1) pick('p1', m.x + dx, m.y + dy, 'the slot box');
        for (let f = 0.12; f <= 0.88; f += 0.02) pick('p1', pts[i][0] + (pts[(i + 1) % 4][0] - pts[i][0]) * f, pts[i][1] + (pts[(i + 1) % 4][1] - pts[i][1]) * f, 'the side line');
        for (let dx = -G.angR; dx <= G.angR; dx += 1) for (let dy = -G.angR; dy <= G.angR; dy += 1) if (dx * dx + dy * dy <= G.angR * G.angR) pick('a1', A.slot.x + dx, A.slot.y + dy, 'the slot circle');
        for (let dx = -G.letter / 2; dx <= G.letter / 2; dx += 1) for (let dy = -G.letter / 2; dy <= G.letter / 2; dy += 1) pick('a1', A.letter.x + dx, A.letter.y + dy, 'the letter');
        pick('a1', pts[i][0], pts[i][1], 'the vertex');
      }
    });
    /* markRule：把「放到哪裡」的每一種順序都走一遍（深度優先）。自己的規則：放完之後每一種貼紙都只在一組對面，
       每一組對面只有一種 —— 收 ⟺ 這樣還成立。每一個走得到的狀態都不會卡住，放滿的時候對面一樣、相鄰不一樣。 */
    {
      const keyOf = st => st.side.join() + '|' + st.ang.join();
      const seen = new Set(); let states = 0, fulls = 0;
      const consistent = (arr) => {
        const pairOf = {};
        for (let i = 0; i < 4; i++){ if (!arr[i]) continue; const p = i % 2; if (pairOf[arr[i]] !== undefined && pairOf[arr[i]] !== p) return false; pairOf[arr[i]] = p; }
        for (const p of [0, 1]){ const a = arr[p], b = arr[p + 2]; if (a && b && a !== b) return false; }
        return true;
      };
      const walk = st => {
        const k = keyOf(st); if (seen.has(k)) return; seen.add(k); states++;
        let moves = 0;
        const left = { p1:2, p2:2, a1:2, a2:2 };
        st.side.concat(st.ang).forEach(x => { if (x) left[x]--; });
        if (!Object.values(left).some(n => n > 0)){
          fulls++;
          for (const arr of [st.side, st.ang]) if (!(arr[0] === arr[2] && arr[1] === arr[3] && arr[0] !== arr[1])) fail('markRule lets a finished board have the wrong pairs: ' + keyOf(st));
          return;
        }
        for (const kind of ['p1', 'p2', 'a1', 'a2']){
          if (!left[kind]) continue;
          const arr = kind[0] === 'p' ? st.side : st.ang;
          for (let i = 0; i < 4; i++){
            const r = D.markRule(st, kind, i);
            if (arr[i]){ if (!r || r.key !== 'full') fail('markRule(' + keyOf(st) + ', ' + kind + ', ' + i + ') on a filled place is not "full"'); continue; }
            const next = arr.slice(); next[i] = kind;
            const ok = consistent(next);
            if (!r !== ok){ fail('markRule(' + keyOf(st) + ', ' + kind + ' on ' + i + ') ' + (r ? 'refuses (' + r.key + ')' : 'accepts') + ' but the own rule says ' + (ok ? 'right' : 'wrong')); continue; }
            if (r){
              /* 理由的內容要真的成立：adj ＝ 同一種已經在相鄰的 at，mate ＝ 對面已經是另一種 */
              if (r.key === 'adj' && !(next.indexOf(kind) >= 0 && arr[r.at] === kind && Math.abs(r.at - i) % 2 === 1 && r.mate === (r.at + 2) % 4)) fail('markRule adj reason does not hold: ' + JSON.stringify(r));
              if (r.key === 'mate' && !(r.mate === (i + 2) % 4 && arr[r.mate] && arr[r.mate] !== kind && r.has === arr[r.mate])) fail('markRule mate reason does not hold: ' + JSON.stringify(r));
              /* 兩種語言的理由：說出這一邊（角）、相關的那一邊（角），數字／名字對得上 */
              LANGS.forEach(L => {
                const t = D.markWhy(I18N[L], kind, i, r), nm = j => kind[0] === 'p' ? N[j] + N[(j + 1) % 4] : '∠' + N[j];
                textOk('markWhy ' + L, t);
                has('markWhy ' + L + ' ' + kind + '@' + i, t, r.key === 'adj' ? [nm(i), nm(r.at), nm(r.mate), I18N[L].gMarkSym[kind]] : [nm(i), nm(r.mate), I18N[L].gMarkSym[r.has]]);
                /* 順序也要對：「這一個」和「已經貼了同一種的那一個」相鄰，「對面那一個」才是該貼的地方 */
                const lead = L === 'zh' ? nm(i) + (r.key === 'adj' ? ' 和 ' + nm(r.at) : (kind[0] === 'p' ? ' 和它的對邊 ' : ' 和斜對面的 ') + nm(r.mate)) : nm(i) + (r.key === 'adj' ? ' and ' + nm(r.at) : (kind[0] === 'p' ? ' is parallel to its opposite side ' : ' is equal to the opposite angle ') + nm(r.mate));
                const tail = r.key !== 'adj' ? '' : (L === 'zh' ? (kind[0] === 'p' ? '它的對邊 ' : '斜對面的 ') + nm(r.mate) : (kind[0] === 'p' ? 'opposite side ' : 'opposite one, ') + nm(r.mate));
                if (t.indexOf(lead) !== 0 || (tail && t.indexOf(tail) < 0)) fail('markWhy ' + L + ' names the places in the wrong order (expected to start "' + lead + '"' + (tail ? ' and say "' + tail + '"' : '') + '): ' + t);
                if (r.key === 'adj' && kind[0] === 'p'){
                  const v = r.at === (i + 1) % 4 ? N[(i + 1) % 4] : N[i];   /* 自己算：兩條相鄰的邊共用哪一個頂點 */
                  if (nm(i).indexOf(v) < 0 || nm(r.at).indexOf(v) < 0) fail('own shared-vertex check broke');
                  const said = L === 'zh' ? ' 在 ' + v + ' 接在一起' : ' meet at ' + v;
                  if (t.indexOf(said) < 0) fail('markWhy ' + L + ': ' + nm(i) + ' and ' + nm(r.at) + ' meet at ' + v + ', the reason says: ' + t);
                }
              });
              continue;
            }
            moves++;
            const ns = { side:st.side.slice(), ang:st.ang.slice() };
            (kind[0] === 'p' ? ns.side : ns.ang)[i] = kind;
            walk(ns);
          }
        }
        if (!moves) fail('markRule: the board can get stuck at ' + keyOf(st));
      };
      walk({ side:[null, null, null, null], ang:[null, null, null, null] });
      if (fulls !== 4) fail('markRule: ' + fulls + ' different finished boards, expected 4 (which arrow on which pair × which arc on which pair)');
    }
    need('mark', /var kind = P\.data\.kind, cand = \[markPick\(pts, kind, pt\.x, pt\.y\)\];/, 'a sticker drop is not judged by markPick of its centre');
    need('mark', /if \(at === null \|\| \(rule && rule\.key === 'full'\)\) return false;/, 'a sticker on a filled place is not a silent bounce');
    need('mark', /if \(rule\)\{ roundMiss\(markWhy\(d, kind, at, rule\)\); return false; \}/, 'a refused sticker does not show markWhy()');
  }

  /* ================= 第 4 關：推一推 ================= */
  {
    const G = D.TRAP_G;
    if (!(Array.isArray(D.GAME_TRAP) && D.GAME_TRAP.length >= 4)) fail('GAME_TRAP should hold at least 4 entries');
    D.GAME_TRAP.forEach((e, ei) => {
      const w = 'GAME_TRAP[' + ei + ']', yb = G.yb, yt = G.yb - G.pitch * e.h, X = c => G.gx + G.pitch * c;
      if (!(e.c0 >= 0 && e.c1 < G.cols && e.c0 < e.c1 && e.ca >= 0 && e.ca + 1 < G.cols && e.h >= 2)) return fail(w + ': corners off the grid');
      if (e.ca === e.c0) fail(w + ': the left leg is upright — the parallelogram spot would be a rectangle');
      if (!(yt - G.knob / 2 >= 0)) fail(w + ': the top line is too high for the knob');
      /* 自己的判定：左腰 D−A、右腰 C−B；兩腰平行 → 平行四邊形；一樣長 → 等腰梯形 */
      const kinds = {}, lean = Math.abs(e.ca - e.c0);
      for (let cd = e.ca + 1; cd < G.cols; cd++){
        const A = [X(e.c0), yb], Dv = [X(e.ca), yt], C = [X(cd), yt], Bv = [X(e.c1), yb];
        const l = vsubRef(A, Dv), r = vsubRef(Bv, C);
        const k = crossRef(l, r) === 0 ? 'para' : (len2Ref(l) === len2Ref(r) ? 'ok' : 'plain');
        kinds[cd] = k;
        const want = cd === e.cs ? 'start' : k;
        if (D.trapKind(e, cd) !== want) fail('trapKind(' + w + ', ' + cd + ') = ' + D.trapKind(e, cd) + ', own legs give ' + want);
        const pts = D.trapPts(e, cd);
        if (JSON.stringify(pts) !== JSON.stringify([A, Dv, C, Bv])) fail(w + ': trapPts(' + cd + ') is not left-bottom, left-top, right-top, right-bottom: ' + JSON.stringify(pts));
        if (k === 'ok'){
          const g = D.eqGroups(pts, true).map(x => x.join()).join(' | ');
          if (g !== eqGroupsRef(pts) || g !== '0,2') fail(w + ': at the isosceles spot the page ticks sides [' + g + '], the legs (own) are [' + eqGroupsRef(pts) + ']');
        }
        if (k === 'plain') LANGS.forEach(L => {
          const rl = len2Ref(r) > len2Ref(l), t = I18N[L].gTrapWhy.plain(Math.abs(cd - e.c1) > lean);
          has(w + ' plain reason at ' + cd + ' ' + L, t, [L === 'zh' ? (rl ? '比左腰長' : '比左腰短') : (rl ? 'longer' : 'shorter')]);
        });
        inside(box(X(cd), yt, G.knob, G.knob), w + ' knob at column ' + cd, G.H);
      }
      const ks = Object.values(kinds);
      if (ks.filter(k => k === 'ok').length !== 1) fail(w + ': ' + ks.filter(k => k === 'ok').length + ' isosceles spots on the rail, expected exactly 1');
      if (ks.filter(k => k === 'para').length !== 1) fail(w + ': the parallelogram spot (equal legs, two pairs) is not on the rail — the "exactly one pair" trap never shows');
      if (kinds[e.cs] !== 'plain') fail(w + ': the knob starts on a ' + kinds[e.cs] + ' spot, it must start on an ordinary trapezium');
      /* 提示 2：左腰偏幾格、往哪邊；右腰往反方向偏一樣多 —— 就是那一個等腰的位置 */
      const iso = +Object.keys(kinds).filter(c => kinds[c] === 'ok')[0];
      if (Math.abs(iso - e.c1) !== lean || Math.sign(iso - e.c1) !== -Math.sign(e.ca - e.c0)) fail(w + ': the isosceles spot is not the mirror of the left leg');
      LANGS.forEach(L => {
        const t = I18N[L].gTrap2(lean, e.ca > e.c0), ns = (t.match(/\d+/g) || []).map(Number);
        if (ns.filter(n => n === lean).length < 2) fail(w + ' hint ' + L + ' should say ' + lean + ' twice: ' + t);
        const first = L === 'zh' ? t.indexOf(e.ca > e.c0 ? '往右' : '往左') : t.indexOf(e.ca > e.c0 ? 'to the right' : 'to the left');
        const second = L === 'zh' ? t.indexOf(e.ca > e.c0 ? '往左' : '往右') : t.lastIndexOf(e.ca > e.c0 ? 'to the left' : 'to the right');
        if (!(first >= 0 && second > first)) fail(w + ' hint ' + L + ' gets the lean directions wrong: ' + t);
      });
      /* trapCol：每一個 x 判給最近的那一欄（夾在軌道裡）；trapOnRail：停車位上下 band 以內才算點到 */
      for (let x = 0; x <= W; x += 0.5){
        const want = Math.max(e.ca + 1, Math.min(G.cols - 1, Math.round((x - G.gx) / G.pitch)));
        if (D.trapCol(e, x) !== want){ fail(w + ': trapCol(' + x + ') = ' + D.trapCol(e, x) + ', expected ' + want); break; }
      }
      for (let cd = e.ca + 1; cd < G.cols; cd++) for (const f of [-0.35, 0, 0.35]) for (const dy of [-G.band + 1, 0, G.band - 1]){
        if (!D.trapOnRail(e, X(cd) + f * G.pitch, yt + dy)) fail(w + ': a tap at column ' + cd + ' (' + f + ', ' + dy + ') is not taken as the rail');
        if (D.trapCol(e, X(cd) + f * G.pitch) !== cd) fail(w + ': a tap 35% beside column ' + cd + ' goes to another column');
      }
      if (D.trapOnRail(e, X(e.ca + 1), yb) || D.trapOnRail(e, X(e.ca) - G.pitch, yt)) fail(w + ': a tap far from the rail is taken as the rail');
      if (!(G.yb - G.pitch * e.h - G.band > 0 && G.band < G.pitch * (e.h) / 2)) fail(w + ': the rail tap band reaches the other row');
      inside(box(X(e.c0), yb, 12, 12), w + ' bottom-left corner', G.H);
    });
    touch('the round-4 knob', G.knob);
    if (G.pitch * PHONE_K < 34) fail('round-4 rail spots are ' + (G.pitch * PHONE_K).toFixed(1) + 'px apart on a phone');
    need('trap', /var cd = trapCol\(e, pt\.tap \? pt\.x : P\.cx\), k = trapKind\(e, cd\);/, 'a drag must be judged on the column the knob is SHOWN on');
    need('trap', /follow:function\(p\)\{ return \{ x:trapX\(trapCol\(e, p\.x\)\), y:yt \}; \}/, 'the knob does not snap to a spot while dragging');
    need('trap', /if \(k === 'plain'\)\{ roundMiss\(d\.gTrapWhy\.plain\(Math\.abs\(cd - e\.c1\) > lean\)\); return false; \}/, 'the ordinary-trapezium reason is not tied to the right leg');
    need('trap', /var lean = Math\.abs\(e\.ca - e\.c0\);\n\s*gCtx\.hint2 = function\(\)\{ return d\.gTrap2\(lean, e\.ca > e\.c0\); \};/, 'the second hint is not computed from the left leg');
    LANGS.forEach(L => has('gTrapWhy.para ' + L, I18N[L].gTrapWhy.para, [L === 'zh' ? '只有一組' : 'exactly one']));
  }

  /* ================= 第 5 關：分家族 ================= */
  {
    const G = D.FAM_G, H = G.H;
    const inB = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    const own = (x, y) => {
      if (inB(G.T, x, y)) return 'trap';
      const r = inB(G.Rr, x, y), h = inB(G.Rh, x, y);
      if (r && h) return 'both'; if (r) return 'rect'; if (h) return 'rhom';
      return inB(G.P, x, y) ? 'para' : null;
    };
    [G.P, G.Rr, G.Rh, G.T].forEach((b, i) => inside(b, 'family box ' + i, H));
    if (!(inB(G.P, G.Rr.x, G.Rr.y) && inB(G.P, G.Rr.x + G.Rr.w, G.Rr.y + G.Rr.h) && inB(G.P, G.Rh.x, G.Rh.y) && inB(G.P, G.Rh.x + G.Rh.w, G.Rh.y + G.Rh.h)))
      fail('the rectangle and rhombus loops must sit inside the parallelogram box');
    if (!(G.Rh.x < G.Rr.x + G.Rr.w && G.Rr.x < G.Rh.x)) fail('the rectangle and rhombus loops must overlap (the square goes there)');
    if (hit(G.T, G.P)) fail('the trapezium box overlaps the parallelogram box');
    for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= H; y += 0.5){
      if (D.famRegion(x, y) !== own(x, y)){ fail('famRegion(' + x + ',' + y + ') = ' + D.famRegion(x, y) + ', the drawn boxes give ' + own(x, y)); x = W + 1; break; }
    }
    /* 每一個名字整個在自己那一格；每一格放好的卡片（縮小後）整個在自己那一格、不壓到名字 */
    Object.keys(G.lbl).forEach(k => {
      const b = G.lbl[k];
      [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([x, y]) => { if (own(x, y) !== k) fail('the "' + k + '" name box corner (' + x + ',' + y + ') is in the ' + own(x, y) + ' part'); });
    });
    const cw = G.card.w * G.placed, ch = G.card.h * G.placed;
    Object.keys(G.home).forEach(k => {
      const [x, y] = G.home[k], b = box(x, y, cw, ch);
      [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([px, py]) => { if (own(px, py) !== k) fail('a card placed in "' + k + '" reaches into the ' + own(px, py) + ' part'); });
      Object.keys(G.lbl).forEach(l => { const lb = G.lbl[l]; if (hit(b, lb)) fail('a card placed in "' + k + '" covers the "' + l + '" name'); });
    });
    const tray = G.tray.map((t, j) => ['card ' + j, box(t[0], t[1], G.card.w, G.card.h)]);
    tray.forEach(t => { inside(t[1], 'round-5 ' + t[0], H); if (t[1].y < G.T.y + G.T.h + 6) fail('round-5 ' + t[0] + ' touches the trapezium box'); });
    noHits(tray, 'round-5 tray'); touch('a round-5 card', Math.min(G.card.w, G.card.h));
    if (Math.abs(G.card.w / G.card.h - G.vb[0] / G.vb[1]) > 0.02) fail('the card is ' + G.card.w + '×' + G.card.h + ' but its picture is ' + G.vb.join('×') + ' — the shape would be squeezed');
    /* 卡片：每一張的種類由座標算（自己的 classifyRef），畫得下（四邊留 4） */
    const WANT = { para:'para', rect:'rect', rhom:'rhom', square:'both', trap:'trap', isotrap:'trap' };
    if (Object.keys(D.GAME_FAM).sort().join() !== 'para,rect,rhom,square,trap') fail('GAME_FAM must hold exactly para, rect, rhom, square, trap (one card each), got ' + Object.keys(D.GAME_FAM));
    Object.keys(D.GAME_FAM).forEach(k => { if (!Array.isArray(D.GAME_FAM[k]) || !D.GAME_FAM[k].length) fail('GAME_FAM.' + k + ' must be a non-empty array'); });
    need('family', /var G = FAM_G, keys = \['para', 'rect', 'rhom', 'square', 'trap'\], total = keys\.length, left = total;/, 'the family round does not deal exactly one card of each of the five kinds');
    Object.keys(D.GAME_FAM).forEach(k => {
      if (!D.GAME_FAM[k].length) fail('GAME_FAM.' + k + ' is empty');
      D.GAME_FAM[k].forEach((pts, i) => {
        const w = 'GAME_FAM.' + k + '[' + i + ']', bad = degenerate(pts);
        if (bad) return fail(w + ': ' + bad);
        const c = classifyRef(pts);
        if (!(c === k || (k === 'trap' && c === 'isotrap'))) fail(w + ' is drawn as ' + c);
        if (data_classify_ok(D, pts) !== c) fail(w + ': the page classify() says ' + data_classify_ok(D, pts) + ', own ' + c);
        pts.forEach(p => { if (!(p[0] >= 4 && p[0] <= G.vb[0] - 4 && p[1] >= 4 && p[1] <= G.vb[1] - 4)) fail(w + ': a corner is too close to the card edge for its marks: ' + p); });
        if (D.famWant(c) !== WANT[c]) fail('famWant(' + c + ') = ' + D.famWant(c) + ', expected ' + WANT[c]);
        /* 放錯的理由：自己的規則選理由，再驗那一句話對這張卡是真的 */
        ['para', 'rect', 'rhom', 'both', 'trap'].forEach(r => {
          if (r === WANT[c]) return;
          const two = pairsRef(pts) === 2, right = rightRef(pts) === 4, eq = eq4Ref(pts);
          let ownWhy;
          if (!two) ownWhy = 'notPara';
          else if (r === 'trap') ownWhy = 'notTrap';
          else if ((r === 'rect' || r === 'both') && !right) ownWhy = 'noRight';
          else if ((r === 'rhom' || r === 'both') && !eq) ownWhy = 'noEq';
          else if (right && eq) ownWhy = 'isBoth';
          else ownWhy = right ? 'isRect' : 'isRhom';
          const got = D.famWhy(c, r);
          if (got !== ownWhy) fail('famWhy(' + c + ' in ' + r + ') = ' + got + ', own facts give ' + ownWhy);
          const truth = { notPara:pairsRef(pts) === 1, notTrap:two, noRight:rightRef(pts) === 0, noEq:!eq, isBoth:right && eq, isRect:right && !eq, isRhom:eq && !right }[ownWhy];
          if (!truth) fail(w + ': the "' + ownWhy + '" reason is not true for this card');
          LANGS.forEach(L => textOk('gFamWhy.' + ownWhy + ' ' + L, I18N[L].gFamWhy[ownWhy]));
        });
      });
    });
    /* famPick：卡片中心或手指任一個在自己那一格就收；都不是 → 中心那一格（中心不在任何一格才看手指） */
    const R5 = [null, 'para', 'rect', 'rhom', 'both', 'trap'];
    R5.forEach(rc => R5.forEach(rf => ['para', 'both', 'trap'].forEach(want => {
      const exp = (rc === want || rf === want) ? want : (rc || rf || null);
      if (D.famPick(rc, rf, want) !== exp) fail('famPick(' + rc + ', ' + rf + ', ' + want + ') = ' + D.famPick(rc, rf, want) + ', expected ' + exp);
    })));
    need('family', /var r = famPick\(famRegion\(pt\.x, pt\.y\), pt\.fx !== undefined \? famRegion\(pt\.fx, pt\.fy\) : null, want\);/, 'a card drop is not judged on the card centre and the finger');
    need('family', /var pts = pick\(GAME_FAM\[keys\[ki\]\]\), kind = classify\(pts\);/, 'a card\'s kind is not computed from its drawn corners');
    LANGS.forEach(L => {
      ['para', 'rect', 'rhom', 'trap'].forEach(k => textOk('gFamName.' + k + ' ' + L, I18N[L].gFamName[k]));
      ['para', 'rect', 'rhom', 'square', 'trap'].forEach(k => textOk('gFam2.' + k + ' ' + L, I18N[L].gFam2[k]));
    });
    /* 英文名字放得進自己的框：字寬粗估 13px 粗體 ≈ 0.56 × 13 每個字母（真正的量測在 e2e 的「文字不超出框」） */
    Object.keys(G.lbl).forEach(k => { const t = I18N.en.gFamName[k]; if (t.length * 13 * 0.56 > G.lbl[k].w) fail('the English name "' + t + '" (~' + (t.length * 13 * 0.56).toFixed(0) + 'px) does not fit its ' + G.lbl[k].w + 'px box'); });
  }
}
/* 頁面的 classify()（資料區的）—— 卡片的種類是它算的，和自己的 classifyRef 對照 */
function data_classify_ok(D, pts){ return D.classify(pts); }
/* 梯形要標哪兩邊（等腰時）：自己算 —— 對邊等長的那一組，且不是平行的那一組 */
function eqGroupsRef(pts){
  const s = sidesRef(pts);
  const legs = paraRef(s[0], s[2]) ? [1, 3] : [0, 2];
  return len2Ref(s[legs[0]]) === len2Ref(s[legs[1]]) ? legs.join() : '';
}

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 幾何核心：判定寫錯必須被抓到 --- */
    { file:'index', via:'index', expect:'but the coordinates give',
      find:'if (isPara(s[0], s[2])) out.para.push([0, 2]);',
      replace:'if (isPerp(s[0], s[2])) out.para.push([0, 2]);',
      why:'marksOf uses perpendicular where it means parallel' },
    { file:'index', via:'index', expect:'zero vector',
      find:'function isPerp(u, v){ return isSeg(u) && isSeg(v) && dot(u, v) === 0; }',
      replace:'function isPerp(u, v){ return dot(u, v) === 0; }',
      why:'dropping the zero-vector guard makes a degenerate edge perpendicular to everything' },
    { file:'index', via:'index', expect:'zero vector',
      find:'function isPara(u, v){ return isSeg(u) && isSeg(v) && cross(u, v) === 0; }',
      replace:'function isPara(u, v){ return cross(u, v) === 0; }',
      why:'same guard on the parallel test' },
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:"      if (right === 4 && eq4) return 'square';",
      replace:"      if (right === 4 && eq4) return 'rect';",
      /* 抓到它的是「頁面的 classify() 和參考實作不一致」——
         比 QUADS.square 自己的標籤更早、也更準地指出問題。 */
      why:'a square would be reported as a rectangle' },
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:"    if (pairs === 1) return (len2(s[0]) === len2(s[2]) || len2(s[1]) === len2(s[3])) ? 'isotrap' : 'trap';",
      replace:"    if (pairs === 1) return 'isotrap';",
      why:'every trapezium would claim to be isosceles' },
    /* --- 梯形的定義：兩組平行不可以還算梯形 --- */
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:'    if (pairs === 2){\n      if (right === 4 && eq4)',
      replace:'    if (pairs === 2 && false){\n      if (right === 4 && eq4)',
      why:'parallelograms would fall through into the trapezium branch' },
    /* --- 圖上的記號 --- */
    { file:'index', via:'index', expect:'UNEQUAL yet the figure ticks them',
      find:'if (legs) return (len2(s[0]) === len2(s[2])) ? [[0, 2]] : [];',
      replace:'if (legs) return [[0, 2]];',
      why:'an ordinary trapezium would be drawn with equal-leg ticks' },
    { file:'index', via:'index', expect:'arrow/tick positions',
      find:'var T_ARROW = 0.50, T_TICK = 0.28;',
      replace:'var T_ARROW = 0.50, T_TICK = 0.50;',
      why:'arrows and ticks would be drawn on top of each other again' },
    /* --- 家族圖 --- */
    { file:'index', via:'index', expect:'ancestors(square) missing',
      find:"    { key:'square', parents:['rect', 'rhom'] }",
      replace:"    { key:'square', parents:['rect'] }",
      why:'a square would stop being a rhombus' },
    { file:'index', via:'index', expect:'para should have no ancestors',
      find:"    { key:'para',   parents:[] },",
      replace:"    { key:'para',   parents:['rect'] },",
      why:'the family tree would gain a cycle upwards' },
    { file:'index', via:'index', expect:'equal-length narration',
      find:"    var sameLen = (len2(vsub(c.a[0], c.a[1])) === len2(vsub(c.b[0], c.b[1])));",
      replace:"    var sameLen = (s2idx === 0);",
      why:'the slanted pair is equal-length too, but would be narrated as "very different lengths"' },
    /* --- 小遊戲「形狀鑑定所」（§六之五）：每一筆改壞一條規則、一個版面或引擎的一個保險 --- */
    { file:'index', via:'index', expect:"chart order",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }",
      replace:"",
      why:"shuffle() could leave the tray in the chart order" },
    { file:'index', via:'index', expect:"never lands at position",
      find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足",
      replace:"      var k = j - 1 + Math.floor(Math.random() * 2);   /* 自足",
      why:"a shuffle that only swaps neighbours never moves the first card far" },
    { file:'index', via:'index', expect:"does not cost 5",
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;",
      why:"a mistake would cost nothing" },
    { file:'index', via:'index', expect:"shown although nothing was taken",
      find:"    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    var lost = 5;",
      why:"\"−5\" would be shown at 0 points" },
    { file:'index', via:'index', expect:"board-generation guard",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */",
      replace:"",
      why:"a knob held across Restart could act on the new board" },
    { file:'index', via:'index', expect:"lostpointercapture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });",
      replace:"",
      why:"a lost capture would leave the piece stuck" },
    { file:'index', via:'index', expect:"snap a knob while it is being dragged",
      find:"      if (o.follow){ var f = o.follow(p); P.place(f.x, f.y); }\n      else P.place(orig.x + dx, orig.y + dy);",
      replace:"      P.place(orig.x + dx, orig.y + dy);",
      why:"the knob would not show the spot it will be judged on" },
    { file:'index', via:'index', expect:"ahead mode",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"",
      why:"ahead mode would not show the first hint" },
    { file:'index', via:'index', expect:"perpKind(",
      find:"    if (rel === 90) return 'ok';",
      replace:"    if (rel === 90 || s % 180 === 90) return 'ok';",
      why:"an upright red stick would count as perpendicular" },
    { file:'index', via:'index', expect:"perpKind(",
      find:"    if (rel === 0) return 'same';           /* 疊在藍棒上 */",
      replace:"",
      why:"a red stick on top of the blue one would be judged as some other angle" },
    { file:'index', via:'index', expect:"the nearest spot is",
      find:"    var s = Math.round(a / PERP_G.stop) * PERP_G.stop;",
      replace:"    var s = Math.floor(a / PERP_G.stop) * PERP_G.stop;",
      why:"a tap beside a spot would go to the spot before it" },
    { file:'index', via:'index', expect:"is not slanted",
      find:"  var GAME_PERP = [30, 60, 120, 150];",
      replace:"  var GAME_PERP = [30, 60, 90, 150];",
      why:"an upright blue stick: its perpendicular is the across start position" },
    { file:'index', via:'index', expect:"tap ring",
      find:"ringIn:36, ringOut:132,",
      replace:"ringIn:36, ringOut:104,",
      why:"the tap ring would not cover the knob" },
    { file:'index', via:'index', expect:"under 44",
      find:"R:100, line:116, stop:30, start:0, dotR:5, ringIn:36, ringOut:132, knob:48,",
      replace:"R:100, line:116, stop:30, start:0, dotR:5, ringIn:36, ringOut:132, knob:44,",
      why:"the round-1 knob would be under 44px on a phone" },
    { file:'index', via:'index', expect:"SHOWN on",
      find:"        var s = pt.tap ? perpStop(pt.x, pt.y) : perpStop(P.cx, P.cy);",
      replace:"        var s = pt.tap ? perpStop(pt.x, pt.y) : perpStop(pt.fx, pt.fy);",
      why:"a drag would be judged on the finger, not on the spot the knob shows" },
    { file:'index', via:'index', expect:"own cross/dot gives",
      find:"    if (isPara(u, v)) return 'ok';",
      replace:"    if (isPara(u, v) || isPerp(u, v)) return 'ok';",
      why:"a perpendicular line would count as parallel" },
    { file:'index', via:'index', expect:"parallel grid points",
      find:"    { a:[0, 2], b:[2, 0], starts:[[4, 0], [6, 2]] },",
      replace:"    { a:[0, 2], b:[2, 0], starts:[[4, 0], [6, 4]] },",
      why:"a start with only one parallel grid point" },
    { file:'index', via:'index', expect:"on line AB",
      find:"    { a:[0, 0], b:[1, 2], starts:[[3, 0], [6, 4]] },",
      replace:"    { a:[0, 0], b:[1, 2], starts:[[3, 0], [2, 4]] },",
      why:"a start on line AB" },
    { file:'index', via:'index', expect:"the cell there is",
      find:"    var G = PARA_G, c = Math.round((x - G.x0) / G.pitch), r = Math.round((y - G.y0) / G.pitch);",
      replace:"    var G = PARA_G, c = Math.floor((x - G.x0) / G.pitch), r = Math.round((y - G.y0) / G.pitch);",
      why:"a tap on the right half of a grid point would go to the point before it" },
    { file:'index', via:'index', expect:"no free place for the letter",
      find:"      var dirs = [[u[1], -u[0]], [-u[1], u[0]], [out * u[0], out * u[1]], [r2, -r2], [-r2, -r2], [r2, r2], [-r2, r2]];",
      replace:"      var dirs = [[u[1], -u[0]]];",
      why:"a letter with no place to go" },
    { file:'index', via:'index', expect:"sits on knob",
      find:"        if (e.starts.some(function(s){ var c = paraXY(s[0], s[1]); return Math.abs(c.x - q.x) < G.knob / 2 + half && Math.abs(c.y - q.y) < G.knob / 2 + half; })) continue;\n",
      replace:"",
      why:"a letter could hide under a knob" },
    { file:'index', via:'index', expect:"up/down the wrong way",
      find:"        return '提示 2：從 A 到 B 是往右 ' + dx + ' 格、往' + (dy < 0 ? '上 ' + (-dy) : '下 ' + dy) + ' 格。",
      replace:"        return '提示 2：從 A 到 B 是往右 ' + dx + ' 格、往' + (dy > 0 ? '上 ' + dy : '下 ' + (-dy)) + ' 格。",
      why:"the zh hint would say up for down" },
    { file:'index', via:'index', expect:"is outside the",
      find:"var PARA_G = { H:224, x0:24,",
      replace:"var PARA_G = { H:224, x0:18,",
      why:"a knob on the left column would hang off the board" },
    { file:'index', via:'index', expect:"own rule says wrong",
      find:"    if (at >= 0) return (at === mate) ? null : { key:'adj', at:at, mate:(at + 2) % 4 };",
      replace:"    if (at >= 0) return null;",
      why:"the same sticker would be accepted on a neighbouring side" },
    { file:'index', via:'index', expect:"own rule says wrong",
      find:"    if (arr[mate] && arr[mate] !== kind) return { key:'mate', mate:mate, has:arr[mate] };\n",
      replace:"",
      why:"two different stickers would be accepted on opposite sides" },
    { file:'index', via:'index', expect:"the nearest target is",
      find:"      if (dd <= G.reach && dd < bd){ bd = dd; best = i; }",
      replace:"      if (dd <= G.reach && best === null){ bd = dd; best = i; }",
      why:"a drop between two sides would go to the first side, not the nearer one" },
    { file:'index', via:'index', expect:"the nearest target is",
      find:"        dd = segDist(x, y, [A.letter.x, A.letter.y], [A.slot.x, A.slot.y]);",
      replace:"        dd = segDist(x, y, [A.slot.x, A.slot.y], [A.slot.x, A.slot.y]);",
      why:"the corner letter would not be part of its angle's target" },
    { file:'index', via:'index', expect:"the nearest target is",
      find:"        dd = Math.min(segDist(x, y, pts[i], pts[(i + 1) % 4]), boxDist(x, y, m.x, m.y, G.slotW / 2, G.slotH / 2));",
      replace:"        dd = boxDist(x, y, m.x, m.y, G.slotW / 2, G.slotH / 2);",
      why:"a sticker dropped on the drawn side (not its box) would be refused" },
    { file:'index', via:'index', expect:"plain parallelogram",
      find:"    { pts:[[36, 224], [196, 224], [256, 74], [96, 74]] },",
      replace:"    { pts:[[36, 224], [196, 224], [196, 74], [36, 74]] },",
      why:"a rectangle in the parallelogram pool (adjacent angles equal)" },
    { file:'index', via:'index', expect:"meet at",
      find:"      if (r.key === 'adj') return d.gMarkAdjSide(side(i), side(r.at), N.charAt(r.at === (i + 1) % 4 ? (i + 1) % 4 : i), side(r.mate), d.gMarkSym[kind]);",
      replace:"      if (r.key === 'adj') return d.gMarkAdjSide(side(i), side(r.at), N.charAt(r.at === (i + 1) % 4 ? i : (i + 1) % 4), side(r.mate), d.gMarkSym[kind]);",
      why:"the reason would name the wrong shared corner" },
    { file:'index', via:'index', expect:"in the wrong order",
      find:"    if (r.key === 'adj') return d.gMarkAdjAng(ang(i), ang(r.at), ang(r.mate), d.gMarkSym[kind]);",
      replace:"    if (r.key === 'adj') return d.gMarkAdjAng(ang(i), ang(r.mate), ang(r.at), d.gMarkSym[kind]);",
      why:"the angle reason would swap the neighbour and the opposite angle" },
    { file:'index', via:'index', expect:"sits on a side",
      find:"letterOut:20, letter:26,",
      replace:"letterOut:4, letter:26,",
      why:"the corner letters would sit on the slots" },
    { file:'index', via:'index', expect:"under 44",
      find:"sticker:50, trayX:[45, 115, 185, 255], trayY:[298, 360] };",
      replace:"sticker:44, trayX:[45, 115, 185, 255], trayY:[298, 360] };",
      why:"stickers under 44px on a phone" },
    { file:'index', via:'index', expect:"own legs give",
      find:"    if (k === 'isotrap') return 'ok';",
      replace:"    if (k === 'isotrap' || k === 'para') return 'ok';",
      why:"the parallelogram spot (equal legs, two pairs) would count as an isosceles trapezium" },
    { file:'index', via:'index', expect:"parallelogram spot",
      find:"    { c0:1, c1:5, ca:2, h:3, cs:7 },",
      replace:"    { c0:1, c1:7, ca:2, h:3, cs:7 },",
      why:"a pool entry where the parallelogram trap is off the rail" },
    { file:'index', via:'index', expect:"trapPts(",
      find:"    return [[trapX(e.c0), yb], [trapX(e.ca), yt], [trapX(cd), yt], [trapX(e.c1), yb]];",
      replace:"    return [[trapX(e.c0), yb], [trapX(e.c1), yb], [trapX(cd), yt], [trapX(e.ca), yt]];",
      why:"the vertex order would put the leg ticks on the bases" },
    { file:'index', via:'index', expect:"tied to the right leg",
      find:"        if (k === 'plain'){ roundMiss(d.gTrapWhy.plain(Math.abs(cd - e.c1) > lean)); return false; }",
      replace:"        if (k === 'plain'){ roundMiss(d.gTrapWhy.plain(Math.abs(cd - e.c1) < lean)); return false; }",
      why:"the reason would say longer for shorter" },
    { file:'index', via:'index', expect:"starts on a",
      find:"    { c0:0, c1:5, ca:1, h:3, cs:7 },",
      replace:"    { c0:0, c1:5, ca:1, h:3, cs:4 },",
      why:"the knob would start on the answer" },
    { file:'index', via:'index', expect:"trapCol(",
      find:"    return Math.max(e.ca + 1, Math.min(TRAP_G.cols - 1, c));",
      replace:"    return Math.max(e.ca, Math.min(TRAP_G.cols - 1, c));",
      why:"the corner could be pushed onto the pinned corner (a triangle)" },
    { file:'index', via:'index', expect:"the drawn boxes give",
      find:"    if (r && h) return 'both';",
      replace:"",
      why:"the overlap would count as the rectangle part only" },
    { file:'index', via:'index', expect:"own facts give",
      find:"    if (kind === 'square') return 'isBoth';",
      replace:"",
      why:"a square in one loop would be sent to the other loop instead of the overlap" },
    { file:'index', via:'index', expect:"famPick(",
      find:"    if (rc === want || rf === want) return want;",
      replace:"    if (rc === want) return want;",
      why:"a card picked up by its edge with the finger on its place would be refused" },
    { file:'index', via:'index', expect:"name box corner",
      find:"rhom:{ x:212, y:45, w:76, h:22 }",
      replace:"rhom:{ x:140, y:45, w:76, h:22 }",
      why:"the rhombus name would sit over the overlap" },
    { file:'index', via:'index', expect:"reaches into the",
      find:"    home:{ para:[37, 140], rect:[110, 140], both:[180, 140],",
      replace:"    home:{ para:[37, 140], rect:[110, 140], both:[160, 140],",
      why:"a placed square would hang into the rectangle part" },
    { file:'index', via:'index', expect:"is drawn as",
      find:"    rhom:   [ [[66, 8], [114, 44], [66, 80], [18, 44]],",
      replace:"    rhom:   [ [[66, 8], [102, 44], [66, 80], [30, 44]],",
      why:"a 'rhombus' card that is really a square" },
    { file:'index', via:'index', expect:"drawn corners",
      find:"        var pts = pick(GAME_FAM[keys[ki]]), kind = classify(pts);",
      replace:"        var pts = pick(GAME_FAM[keys[ki]]), kind = keys[ki];",
      why:"a card's kind would come from its label, not its drawing" },
    /* --- codex 第一輪（設定）：handler 的收／不收、計分、題庫完整、理由的內容 --- */
    { file:'index', via:'index', expect:"ends at",
      find:"    gScore += pts; elScore.textContent = gScore;",
      replace:"    gScore += 0; elScore.textContent = gScore;",
      why:"a cleared round would award nothing" },
    { file:'index', via:'index', expect:"and only once",
      find:"    if (gSolved) return;\n    gSolved = true;",
      replace:"    gSolved = true;",
      why:"a round could be scored twice" },
    { file:'index', via:'index', expect:"perpendicular grid point",
      find:"    { a:[1, 2], b:[2, 0], starts:[[4, 0], [6, 0]] },",
      replace:"    { a:[1, 2], b:[2, 0], starts:[[5, 0], [0, 4]] },",
      why:"a pool entry where no perpendicular point is reachable" },
    { file:'index', via:'index', expect:"exactly para, rect, rhom, square, trap",
      find:"    square: [ [[36, 20], [96, 20], [96, 80], [36, 80]], [[60, 4], [96, 52], [48, 88], [12, 40]] ],\n",
      replace:"",
      why:"the square card pool would be missing" },
    { file:'index', via:'index', expect:"only a perpendicular spot is accepted",
      find:"        if (k !== 'ok'){ roundMiss(d.gPerpWhy[k]); return false; }",
      replace:"        if (k === 'same'){ roundMiss(d.gPerpWhy[k]); return false; }",
      why:"round 1 would accept an upright or slanted wrong stick" },
    { file:'index', via:'index', expect:"only a parallel grid point is accepted",
      find:"        if (k === 'start') return false;\n        if (k !== 'ok'){ roundMiss(d.gParaWhy[k]); return false; }",
      replace:"        if (k !== 'ok'){ roundMiss(d.gParaWhy[k] || ''); return false; }",
      why:"pulling the band back to its start would count as a mistake" },
    { file:'index', via:'index', expect:"centre OR the finger",
      find:"        if (pt.fx !== undefined) cand.push(markPick(pts, kind, pt.fx, pt.fy));\n",
      replace:"",
      why:"a sticker grabbed by its edge, finger on the place, would be judged on its centre only" },
    { file:'index', via:'index', expect:"only the isosceles spot is accepted",
      find:"        if (pt.tap && !trapOnRail(e, pt.x, pt.y)) return false;\n",
      replace:"",
      why:"a tap anywhere would push the corner" },
    { file:'index', via:'index', expect:"only the isosceles spot is accepted",
      find:"        if (k === 'para'){ roundMiss(d.gTrapWhy.para); return false; }\n",
      replace:"",
      why:"the parallelogram spot would be accepted" },
    { file:'index', via:'index', expect:"most specific part is accepted",
      find:"        if (r !== want){ roundMiss(d.gFamWhy[famWhy(kind, r)]); return false; }",
      replace:"        if (false){ roundMiss(d.gFamWhy[famWhy(kind, r)]); return false; }",
      why:"any part of the chart would take any card" },
    { file:'index', via:'index', expect:"gFamWhy.noRight zh should say",
      find:"        noRight:'這一張的角不是直角（沒有小方框），不能放進長方形那一圈。',\n        noEq:'這一張的四邊沒有都一樣長（短撇不一樣），不能放進菱形那一圈。',",
      replace:"        noRight:'這一張的四邊沒有都一樣長（短撇不一樣），不能放進菱形那一圈。',\n        noEq:'這一張的角不是直角（沒有小方框），不能放進長方形那一圈。',",
      why:"the two family reasons would be swapped" },
    { file:'index', via:'index', expect:"gPerpWhy.same en should say",
      find:"        same:'The red stick is lying on top of the blue one — they have to cross at a <strong>right angle</strong> to be perpendicular.',",
      replace:"        same:'The angle at the crossing is not a right angle.',",
      why:"the on-top reason would be replaced by a generic one" },
    { file:'index', via:'index', expect:"exactly one card of each",
      find:"    var G = FAM_G, keys = ['para', 'rect', 'rhom', 'square', 'trap'], total = keys.length, left = total;",
      replace:"    var G = FAM_G, keys = ['para', 'rect', 'rhom', 'trap'], total = keys.length, left = total;",
      why:"the square card would never be dealt" },
    /* --- codex 第二輪：每一關的過關呼叫、理由不可以是否定句 --- */
    { file:'index', via:'index', expect:"roundSolved(d.gPerpOk);",
      find:"        roundSolved(d.gPerpOk);",
      replace:"",
      why:"round 1 would lock the knob but never finish the round" },
    { file:'index', via:'index', expect:"must not say",
      find:"        isBoth:'這一張有直角、四邊又一樣長 —— 它是長方形，<strong>也是</strong>菱形，要放在兩圈重疊的地方。',",
      replace:"        isBoth:'這一張沒有直角、四邊也不一樣長 —— 不要放在兩圈重疊的地方。',",
      why:"a negated overlap reason that still names its key words" },
    { file:'index', via:'index', expect:"must not say",
      find:"        other:'Extend this line and it meets AB: the width between the two lines is not the same all the way, so they are not parallel.'",
      replace:"        other:'Extend the line: it never meets AB, so they are not parallel.'",
      why:"a negated 'meets AB' reason" },
    /* --- 題庫：選項重複、答案索引越界 --- */
    { file:'index', via:'index', expect:'duplicate options',
      find:"opts:['互相平行','互相垂直','一樣長','不相交'], ans:1,",
      replace:"opts:['互相平行','互相平行','一樣長','不相交'], ans:1,",
      why:'two identical options in the quiz' },
    { file:'index', via:'index', expect:'answer index differs',
      find:"        { stem:'下面哪一句話是對的？', opts:['正方形是長方形，也是菱形','長方形一定是正方形','平行四邊形一定是長方形','菱形的四個角一定是直角'], ans:0,",
      replace:"        { stem:'下面哪一句話是對的？', opts:['正方形是長方形，也是菱形','長方形一定是正方形','平行四邊形一定是長方形','菱形的四個角一定是直角'], ans:2,",
      why:'zh and en would disagree about which option is correct' },
    /* --- review 的產生器 --- */
    { file:'review', via:'review', expect:'is not the shape it claims',
      find:"      if (pts && classify(pts) === kind) return pts;",
      replace:"      if (pts) return pts;",
      why:'makeShape would stop verifying what it produced' },
    { file:'review', via:'review', expect:'not an ancestor',
      find:"        var right = pick(ups);",
      replace:"        var right = pick(SHAPES);",
      why:'alsoIs could mark a non-ancestor as the answer' },
    { file:'review', via:'review', expect:'reachable by correct reasoning',
      find:"          return k !== kind && ups.indexOf(k) < 0;      // 只有「不是它上層」的才能當誘答",
      replace:"          return k !== kind;",
      why:'a distractor in alsoIs could itself be a correct ancestor' },
    { file:'review', via:'review', expect:'is not a trapezium',
      find:"        var odd = pick(['trap', 'isotrap']);",
      replace:"        var odd = pick(['trap', 'isotrap', 'rhom']);",
      why:'oddOneOut could pick a parallelogram as the odd one out' },
    { file:'review', via:'review', expect:'bases are equal',
      find:"        var bot = top + pick(rangeList(2, 6));",
      replace:"        var bot = top;",
      why:'the trapezium in trapBases would have equal bases, contradicting its own explanation' },
    { file:'review', via:'review', expect:'legs',
      find:"          var leg2 = iso ? leg : leg + pick(rangeList(1, 4));",
      replace:"          var leg2 = leg;",
      why:'isoTrap would call an isosceles trapezium an ordinary one half the time' },
    /* --- codex review 2026-08-28 找到的十件事，每一件配一筆改壞 --- */
    { file:'review', via:'review', expect:'triangle inequality',
      find:"          if (Math.abs(leg - leg2) < diff && diff < leg + leg2){",
      replace:"          if (true){",
      why:'isoTrap would emit side lengths no trapezium can actually have' },
    { file:'review', via:'review', expect:'must ask for the',
      find:"          stem: lang === 'zh' ? '圖上這個四邊形，<strong>最精確</strong>的名字是什麼？（箭頭＝平行，短撇＝等長，小方框＝直角）'",
      replace:"          stem: lang === 'zh' ? '圖上這個四邊形叫什麼？（箭頭＝平行，短撇＝等長，小方框＝直角）'",
      why:'nameShape would go back to asking a question with several correct answers' },
    { file:'review', via:'review', expect:'which is one of the three options shown',
      find:"              + d.fam.map(function(k){ return bareName(t, k); }).join('、')",
      replace:"              + ['長方形', '菱形', '正方形'].join('、')",
      why:'oddOneOut would name shapes that are not among the three options shown' },
    { file:'review', via:'review', expect:'article was mangled',
      find:"  function capName(t, k){ var s = t.shape[k]; return s.charAt(0).toUpperCase() + s.slice(1); }",
      replace:"  function capName(t, k){ return t.shape[k].replace(/^an? /, 'A '); }",
      why:'"an isosceles trapezium" would render as "A isosceles trapezium"' }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      relation: d => {
        if (!Array.isArray(d.u) || !Array.isArray(d.v)) return 'relation: missing a direction vector';
        if (!isSegRef(d.u) || !isSegRef(d.v)) return 'relation: a direction vector is the zero vector';
        const want = perpRef(d.u, d.v) ? 'perp' : (paraRef(d.u, d.v) ? 'para' : 'neither');
        if (d.key !== want) return 'relation: marked ' + d.key + ' but the vectors are ' + want;
        if (d.key === 'para') return 'relation: two crossing lines can never be the parallel case';
        if (d.opts.indexOf('sameLen') < 0) return 'relation: the length distractor is missing';
        if (d.dp !== dotRef(d.u, d.v)) return 'relation: the reported dot product is wrong';
        if (d.cp !== crossRef(d.u, d.v)) return 'relation: the reported cross product is wrong';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'relation: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'relation: opts[ans] is not the computed relation';
      },
      perpTurned: d => {
        if (!(d.deg > 0 && d.deg < 90)) return 'perpTurned: the turn ' + d.deg + ' should be a visible turn under a right angle';
        if (d.opts[d.ans] !== 'still') return 'perpTurned: the answer must be that it stays perpendicular';
        if (new Set(d.opts).size !== d.opts.length) return 'perpTurned: duplicate options';
      },
      paraLength: d => {
        if (!(d.a > d.b)) return 'paraLength: the two lengths must differ visibly (' + d.a + ' vs ' + d.b + ')';
        if (d.opts[d.ans] !== 'yes') return 'paraLength: same width everywhere always means parallel';
      },
      countPairs: d => {
        const bad = degenerate(d.pts);
        if (bad) return 'countPairs: ' + bad;
        if (classifyRef(d.pts) !== d.kind) return 'countPairs: the shape is not the shape it claims (' + classifyRef(d.pts) + ' vs ' + d.kind + ')';
        if (d.n !== pairsRef(d.pts)) return 'countPairs: the marked count is not what the coordinates give';
        if (d.n === 0) return 'countPairs: this lesson never shows a quadrilateral with no parallel pair';
        if (d.opts.indexOf(3) < 0) return 'countPairs: the impossible "three pairs" distractor is missing';
        if (d.opts.length !== 4) return 'countPairs: there must be four counts to choose from';
        if (new Set(d.opts).size !== d.opts.length) return 'countPairs: duplicate options';
        if (d.opts[d.ans] !== d.n) return 'countPairs: opts[ans] is not the computed count';
      },
      nameByRule: d => {
        if (!SHAPE_TXT.zh[d.kind]) return 'nameByRule: unknown shape ' + d.kind;
        if (d.kind === 'isotrap') return 'nameByRule: the stated rule set does not distinguish an isosceles trapezium';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nameByRule: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.kind) return 'nameByRule: opts[ans] is not the described shape';
      },
      nameShape: d => {
        const bad = degenerate(d.pts);
        if (bad) return 'nameShape: ' + bad;
        if (classifyRef(d.pts) !== d.kind) return 'nameShape: the shape is not the shape it claims (' + classifyRef(d.pts) + ' vs ' + d.kind + ')';
        if (d.pairs !== pairsRef(d.pts)) return 'nameShape: the quoted parallel-pair count is wrong';
        if (d.right !== rightRef(d.pts)) return 'nameShape: the quoted right-angle count is wrong';
        if (d.eq4 !== eq4Ref(d.pts)) return 'nameShape: the quoted "all sides equal" flag is wrong';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nameShape: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.kind) return 'nameShape: opts[ans] is not the drawn shape';
        /* 題幹唸出來的三個事實必須**剛好**指向一個名字，否則誘答也講得通。 */
        const fits = d.opts.filter(k => {
          const facts = { para:[2,0,false], rect:[2,4,false], rhom:[2,0,true], square:[2,4,true],
                          trap:[1,0,false], isotrap:[1,0,false] }[k];
          return facts && facts[0] === d.pairs && (facts[1] === 4) === (d.right === 4) && facts[2] === d.eq4;
        });
        if (fits.length !== 1 && !(d.kind === 'trap' || d.kind === 'isotrap'))
          return 'nameShape: the quoted facts fit ' + fits.length + ' of the options (' + fits + ')';
      },
      alsoIs: d => {
        const ups = ancestorsRef(d.kind);
        if (!ups.length) return 'alsoIs: ' + d.kind + ' has no ancestor to ask about';
        /* 上層太多的形狀（正方形有三個）湊不出三個「不是上層」的誘答 —— 不該進這個產生器。 */
        if (ups.length > 6 - 1 - 3) return 'alsoIs: ' + d.kind + ' has ' + ups.length +
          ' ancestors, too many to build three distractors that are all genuinely wrong';
        if (ups.indexOf(d.right) < 0) return 'alsoIs: ' + d.right + ' is not an ancestor of ' + d.kind;
        /* 先問「誘答本身是不是也講得通」，再問相異 —— 順序反了的話，
           訊息會變成籠統的「選項重複」，看不出真正壞掉的是誘答的挑選規則。 */
        for (let i2 = 0; i2 < d.opts.length; i2++){
          if (i2 === d.ans) continue;            // 只跳過「正解那一格」，不是跳過所有等於正解的字
          const o = d.opts[i2];
          if (ups.indexOf(o) >= 0) return 'alsoIs: distractor ' + o + ' is reachable by correct reasoning — it is also an ancestor of ' + d.kind;
          if (o === d.kind) return 'alsoIs: the shape itself is offered as a distractor';
        }
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'alsoIs: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.right) return 'alsoIs: opts[ans] is not the chosen ancestor';
      },
      notAlways: d => {
        if (ancestorsRef(d.b).indexOf(d.a) < 0)
          return 'notAlways: ' + d.b + ' is not ' + d.a + ' plus a condition, so "not necessarily" is not the answer';
        if (ancestorsRef(d.a).indexOf(d.b) >= 0)
          return 'notAlways: the pair is the wrong way round (' + d.a + ' is already ' + d.b + ')';
        if (d.opts[d.ans] !== 'maybe') return 'notAlways: the answer must be "not necessarily"';
        if (new Set(d.opts).size !== d.opts.length) return 'notAlways: duplicate options';
      },
      trapBases: d => {
        if (d.top === d.bot) return 'trapBases: the bases are equal, which the explanation says is impossible';
        if (!(d.bot > d.top)) return 'trapBases: the bottom base should be the longer one';
        if (d.opts[d.ans] !== 'no') return 'trapBases: a trapezium can never have equal bases';
      },
      isoTrap: d => {
        if (d.iso !== (d.leg === d.leg2)) return 'isoTrap: the isosceles flag disagrees with the two legs';
        if (d.top === d.bot) return 'isoTrap: the bases must differ or it is not a trapezium at all';
        /* 這些邊長要真的畫得出來：把一支腰平移過去會得到邊長為
           (腰1, 腰2, 下底−上底) 的三角形，必須滿足三角不等式。 */
        const diff = d.bot - d.top;
        if (!(Math.abs(d.leg - d.leg2) < diff && diff < d.leg + d.leg2))
          return 'isoTrap: no trapezium can have bases ' + d.top + '/' + d.bot + ' with legs ' +
                 d.leg + '/' + d.leg2 + ' — the triangle inequality |leg-leg2| < bot-top < leg+leg2 fails';
        const want = d.iso ? 'iso' : 'plain';
        if (d.opts[d.ans] !== want) return 'isoTrap: opts[ans] is ' + d.opts[d.ans] + ' but the legs say ' + want;
        if (d.opts.indexOf('paraq') < 0) return 'isoTrap: the parallelogram distractor is missing';
        if (new Set(d.opts).size !== d.opts.length) return 'isoTrap: duplicate options';
      },
      guaranteed: d => {
        if (GUARANTEED_BY[d.kind] !== d.right)
          return 'guaranteed: ' + d.right + ' is not the property ' + d.kind + ' guarantees';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'guaranteed: options are not four distinct properties';
        /* 誘答不可以是這個形狀也保證的性質。 */
        const alsoTrue = { para:['oppSide'], rect:['oppSide', 'right4'], rhom:['oppSide', 'side4'] }[d.kind] || [];
        for (const o of d.opts){
          if (o === d.right) continue;
          if (alsoTrue.indexOf(o) >= 0) return 'guaranteed: distractor ' + o + ' is also guaranteed for ' + d.kind;
        }
        if (d.opts[d.ans] !== d.right) return 'guaranteed: opts[ans] is not the guaranteed property';
      },
      oddOneOut: d => {
        if (pairsRefOfKind(d.odd) !== 1) return 'oddOneOut: ' + d.odd + ' is not a trapezium, so it is not the odd one out';
        if (d.fam.length !== 3 || new Set(d.fam).size !== 3) return 'oddOneOut: the three parallelograms are not three distinct shapes';
        for (const k of d.fam){
          if (pairsRefOfKind(k) !== 2) return 'oddOneOut: distractor ' + k + ' is not a parallelogram';
        }
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'oddOneOut: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.odd) return 'oddOneOut: opts[ans] is not the trapezium';
      }
    },

    /* 正解的文字由這裡**獨立算一次**，不看 d.ans 指到哪個選項。 */
    expectedCorrect: function(d, genId, lang){
      const S = SHAPE_TXT[lang], R = REL_TXT[lang];
      switch (genId){
        case 'relation':   return R[perpRef(d.u, d.v) ? 'perp' : (paraRef(d.u, d.v) ? 'para' : 'neither')];
        // 'sameLen' 永遠不是正解：它講長度，不是兩條線的關係
        case 'perpTurned': return lang === 'zh' ? '還是垂直' : 'Still perpendicular';
        case 'paraLength': return lang === 'zh' ? '平行' : 'They are parallel';
        case 'countPairs': return PAIRS_TXT[lang](pairsRef(d.pts));
        case 'nameByRule': return S[d.kind];
        case 'nameShape':  return S[classifyRef(d.pts)];
        case 'alsoIs':     return S[d.right];
        case 'notAlways':  return lang === 'zh' ? '不一定' : 'Not necessarily';
        case 'trapBases':  return lang === 'zh' ? '不可能，一定不一樣長' : 'Impossible — they are never equal';
        case 'isoTrap':    return (d.leg === d.leg2)
                                   ? (lang === 'zh' ? '等腰梯形' : 'An isosceles trapezium')
                                   : (lang === 'zh' ? '一般的梯形（不是等腰）' : 'An ordinary trapezium (not isosceles)');
        case 'guaranteed': return GUARD_TXT[lang][GUARANTEED_BY[d.kind]];
        case 'oddOneOut':  return S[d.odd];
        default: return null;
      }
    },

    /* 選項字串本身的健康檢查：不可以漏字、不可以印出程式內部的值。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (!s || !s.trim()) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(s)) return 'option leaks an internal value: ' + s;
      if (/<[a-z]/i.test(s)) return 'option contains markup: ' + s;
      if (lang === 'en' && /[㐀-鿿]/.test(s)) return 'English option contains Chinese: ' + s;
      return null;
    },

    /* 渲染後再驗一次：選項兩兩相異、題幹與說明都在、圖形是合法四邊形。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length < 3) out.push('fewer than three options');
      if (new Set(q.opts).size !== q.opts.length) out.push('two options render to the same text: ' + q.opts.join(' | '));
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      if (lang === 'en' && /[㐀-鿿]/.test(q.stem + q.why)) out.push('English question contains Chinese');
      if (q.fig){
        const bad = degenerate(q.fig);
        if (bad) out.push('figure is not a valid quadrilateral: ' + bad);
        else {
          /* 圖上畫的形狀，必須就是說明裡講的那一個。 */
          const drawn = classifyRef(q.fig);
          if (SHAPE_TXT[lang][drawn] && q.why.indexOf(SHAPE_TXT[lang][drawn]) < 0 && genId === 'nameShape')
            out.push('the explanation never names the shape that is actually drawn (' + drawn + ')');
        }
      }
      /* 問「叫什麼」而選項裡有它的上層，等於好幾個答案都對 ——
         題幹一定要問「最精確」的名字。 */
      if (genId === 'nameShape' || genId === 'nameByRule'){
        const cue = (lang === 'zh') ? '最精確' : 'most specific';
        if (q.stem.indexOf(cue) < 0)
          out.push('a naming question whose options include ancestor families must ask for the ' + cue + ' name');
      }
      /* oddOneOut 的說明要列出「畫面上真的出現的那三個」，不可以寫死。
         ⚠️ 不可以一個一個名字去比對：說明裡本來就有「所以不是平行四邊形」，
         單獨比對「平行四邊形」會命中那一句，寫死的清單照樣過關。
         要比對的是**整串照 d.fam 順序接起來的清單**。 */
      if (genId === 'oddOneOut'){
        const listed = d.fam.map(k => SHAPE_TXT[lang][k].replace(/^an? /, ''))
                            .join(lang === 'zh' ? '、' : ', ');
        if (q.why.indexOf(listed) < 0)
          out.push('the explanation does not list the three options actually shown (' + listed +
                   '), which is one of the three options shown');
      }
      /* 英文冠詞：句首大寫不可以把 "an isosceles" 變成 "A isosceles"。 */
      if (lang === 'en' && /\bA (?=[aeiou])/.test(q.why + ' ' + q.stem))
        out.push('English text has "A" before a vowel — the article was mangled by capitalisation');
      /* 說明如果引用了數字，那個數字要真的在題幹裡出現過。 */
      const nums = (q.why.match(/\d+/g) || []);
      for (const n of nums){
        if (n.length >= 2 && q.stem.indexOf(n) < 0 && q.why.indexOf(n + ' 度') < 0)
          out.push('the explanation cites ' + n + ' but the stem never says it');
      }
      /* ⚠️ 一定要回字串或 null：空陣列 [] 在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」，
         而且訊息是空的 —— 看起來像每一題都壞了。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{PERP_CASES, PARA_CASES, QUADS, PARA_FAMILY, TRAP_FAMILY, FAMILY, ' +
                'sidesOf, classify, marksOf, eqGroups, ancestors, ' +
                'isPerp, isPara, isSeg, len2, dot, cross, T_ARROW, T_TICK, ' +
                'GAME_ORDER, GAME_W, GAME_PERP, PERP_G, perpXY, perpStop, perpRing, perpKind, ' +
                'GAME_PARA, PARA_G, paraXY, paraDot, paraSnap, paraKind, paraLetters, ' +
                'GAME_MARK, MARK_KINDS, MARK_G, markAngle, markMid, markPick, markRule, markWhy, ' +
                'GAME_TRAP, TRAP_G, trapPts, trapCol, trapOnRail, trapKind, ' +
                'FAM_G, GAME_FAM, famRegion, famWant, famPick, famWhy}',

    check: function(data, I18N, fail, src){
      const { QUADS, PERP_CASES, PARA_CASES, PARA_FAMILY, TRAP_FAMILY } = data;

      /* 1. 每個形狀都必須是它自己宣告的那一種 —— 由座標獨立算。 */
      for (const k of Object.keys(QUADS)){
        const bad = degenerate(QUADS[k]);
        if (bad) fail('QUADS.' + k + ': ' + bad);
        else if (classifyRef(QUADS[k]) !== k) fail('QUADS.' + k + ' classifies as ' + classifyRef(QUADS[k]));
        if (data.classify(QUADS[k]) !== classifyRef(QUADS[k]))
          fail('QUADS.' + k + ': the page classify() disagrees with the reference implementation');
      }
      /* 1a. marksOf 決定圖上畫哪些記號 —— 它和分類是兩段獨立的程式，要分別驗。
             （只驗 classify 的話，記號畫錯的圖可以一路綠燈。） */
      for (const k of Object.keys(QUADS)){
        const pts = QUADS[k], s2 = sidesRef(pts), m = data.marksOf(pts);
        const wantPara = [];
        if (paraRef(s2[0], s2[2])) wantPara.push('0,2');
        if (paraRef(s2[1], s2[3])) wantPara.push('1,3');
        const gotPara = m.para.map(x => x.join(',')).sort().join(' | ');
        if (gotPara !== wantPara.sort().join(' | '))
          fail('marksOf(' + k + ').para = [' + gotPara + '] but the coordinates give [' + wantPara.join(' | ') + ']');
        const wantRight = [];
        for (let i = 0; i < 4; i++) if (perpRef(s2[i], s2[(i + 1) % 4])) wantRight.push((i + 1) % 4);
        if (m.right.slice().sort().join(',') !== wantRight.sort().join(','))
          fail('marksOf(' + k + ').right = [' + m.right + '] but the right angles are at [' + wantRight + ']');
      }
      /* 1b. 箭頭和短撇不可以畫在邊上的同一點。 */
      if (!(data.T_ARROW > 0 && data.T_ARROW < 1) || !(data.T_TICK > 0 && data.T_TICK < 1))
        fail('arrow/tick positions must be fractions strictly inside the edge');
      if (data.T_ARROW === data.T_TICK)
        fail('arrow/tick positions are identical — the two marks would be drawn on top of each other');
      /* 2. 零向量必須被擋下來。 */
      if (data.isPara([0, 0], [1, 1]) || data.isPerp([0, 0], [1, 1]))
        fail('a zero vector is treated as a segment — every degenerate edge would count as parallel and perpendicular');
      /* 3. 梯形與平行四邊形互斥。 */
      for (const k of PARA_FAMILY){
        if (TRAP_FAMILY.indexOf(classifyRef(QUADS[k])) >= 0) fail(k + ' is classified as a trapezium');
      }
      /* 4. 梯形：剛好一組平行，上底下底不等長；兩腰只在真的等長時才標短撇。 */
      for (const k of TRAP_FAMILY){
        const pts = QUADS[k], s = sidesRef(pts).map(len2Ref);
        if (pairsRef(pts) !== 1){ fail(k + ' has ' + pairsRef(pts) + ' parallel pairs, expected exactly 1'); continue; }
        const bases = paraRef(sidesRef(pts)[0], sidesRef(pts)[2]) ? [0, 2] : [1, 3];
        if (s[bases[0]] === s[bases[1]]) fail(k + ': the two bases are equal — that makes it a parallelogram');
        const legs = [0, 1, 2, 3].filter(i => bases.indexOf(i) < 0);
        const marked = data.eqGroups(pts, true).flat();
        for (const m of marked) if (bases.indexOf(m) >= 0) fail(k + ': a leg tick is drawn on a base');
        if ((s[legs[0]] === s[legs[1]]) && marked.length !== 2) fail(k + ': legs are equal but ' + marked.length + ' ticked');
        if ((s[legs[0]] !== s[legs[1]]) && marked.length) fail(k + ': legs are UNEQUAL yet the figure ticks them as equal');
      }
      /* 5. 家族樹。 */
      const a = data.ancestors('square');
      if (new Set(a).size !== a.length) fail('ancestors(square) has duplicates: ' + a);
      for (const k of ['rect', 'rhom', 'para']) if (a.indexOf(k) < 0) fail('ancestors(square) missing ' + k);
      if (data.ancestors('para').length) fail('para should have no ancestors');
      for (const k of ['para', 'rect', 'rhom', 'square']){
        const mine = data.ancestors(k).slice().sort().join(','), ref = ancestorsRef(k).slice().sort().join(',');
        if (mine !== ref) fail('ancestors(' + k + ') = [' + mine + '] but the reference gives [' + ref + ']');
      }
      /* 6. 垂直與平行的樣本。 */
      PERP_CASES.forEach((c, i) => {
        if (!perpRef(c.u, c.v)) fail('PERP_CASES[' + i + '] dot=' + dotRef(c.u, c.v) + ', not perpendicular');
      });
      if (!PERP_CASES.some(c => c.turned)) fail('no turned perpendicular case — the "must be one across, one upright" misconception is never challenged');
      PARA_CASES.forEach((c, i) => {
        const u = vsubRef(c.a[0], c.a[1]), v = vsubRef(c.b[0], c.b[1]);
        if (paraRef(u, v) !== !!c.para) fail('PARA_CASES[' + i + '].para=' + c.para + ' but cross=' + crossRef(u, v));
      });
      if (!PARA_CASES.some(c => !c.para)) fail('PARA_CASES has no counter-example, so "parallel" is never contrasted');
      if (!PARA_CASES.some(c => c.para && len2Ref(vsubRef(c.a[0], c.a[1])) !== len2Ref(vsubRef(c.b[0], c.b[1]))))
        fail('no parallel pair with different lengths — the "parallel means same length" misconception is never challenged');
      /* 旁白說「一樣長 / 長短差很多」，那句話必須和座標一致。原本它是用
         「是不是第 0 筆」判斷的，於是第 2 筆（斜的，其實一樣長）被講成長短差很多。 */
      if (!/var sameLen = \(len2\(vsub\(c\.a\[0\], c\.a\[1\]\)\) === len2\(vsub\(c\.b\[0\], c\.b\[1\]\)\)\);/.test(src))
        fail('the equal-length narration is not computed from the coordinates');
      /* 7. 遊戲「形狀鑑定所」的五關（§六之五：五種玩法；見 gameChecks） */
      gameChecks(data, I18N, fail, src);
      /* 8. 靜態題庫：zh/en 完全對齊，選項不重複，答案索引在範圍內。 */
      for (const bank of ['qs', 'qsAdv', 'qsBoost']){
        if (I18N.zh[bank].length !== I18N.en[bank].length){ fail(bank + ' length differs between zh and en'); continue; }
        I18N.zh[bank].forEach((q, i) => {
          const e = I18N.en[bank][i];
          if (q.ans !== e.ans) fail(bank + '[' + i + '] answer index differs: zh=' + q.ans + ' en=' + e.ans);
          if (q.opts.length !== e.opts.length) fail(bank + '[' + i + '] option count differs');
          for (const [tag, x] of [['zh', q], ['en', e]]){
            if (new Set(x.opts).size !== x.opts.length) fail(bank + '[' + i + '] ' + tag + ': duplicate options');
            if (!(x.ans >= 0 && x.ans < x.opts.length)) fail(bank + '[' + i + '] ' + tag + ': answer index out of range');
            if (!x.why || !x.why.trim()) fail(bank + '[' + i + '] ' + tag + ': no explanation');
          }
          if (/[㐀-鿿]/.test(e.stem + e.opts.join('') + e.why)) fail(bank + '[' + i + '] en contains Chinese');
        });
      }
      /* 9. zh/en 頂層鍵必須一一對應。 */
      const zk = Object.keys(I18N.zh).sort().join(','), ek = Object.keys(I18N.en).sort().join(',');
      if (zk !== ek) fail('zh and en have different key sets');

      /* 10. 四頁的措辭。⚠️ 路徑要從 process.argv[2] 推：用 __dirname 會讀到**真的 repo**，
             改壞測試複製出去的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
      const dir = path.dirname(process.argv[2]);
      const SRC = {}, TEXT = {};
      for (const f of ['index', 'reference', 'parents', 'review']){
        const fp = path.join(dir, f + '.html');
        if (!fs.existsSync(fp)){ fail(f + '.html is missing, so its wording was never checked'); continue; }
        const raw = fs.readFileSync(fp, 'utf8');
        SRC[f] = stripComments(raw);      // 結構掃描用：保留程式碼原樣
        TEXT[f] = readerText(raw);        // 詞語比對用：只剩讀者看得到的字
      }
      SIBLING_RULES.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        let count = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) count++;
        if (count < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + count + ' time(s), expected at least ' +
               rule.min + ' — it ' + rule.why);
      });

      /* 11. 產生器一支都不能少，也不能多出設定檔沒描述的。 */
      const rv = SRC['review'];
      if (rv !== undefined){
        const found = [];
        rv.split('\n').forEach(line => {
          const m = /^\s*\{ id:'([A-Za-z0-9_]+)',/.exec(line);
          if (m) found.push(m[1]);
        });
        GEN_IDS.forEach(id => {
          if (found.indexOf(id) < 0) fail('review.html no longer declares the generator "' + id + '"');
        });
        found.forEach(id => {
          if (GEN_IDS.indexOf(id) < 0) fail('review.html declares an extra generator "' + id + '" that this config does not describe');
        });
        const makes = (rv.match(/\n\s*make:function\(/g) || []).length;
        const fmts = (rv.match(/\n\s*fmt:function\(/g) || []).length;
        if (makes !== GEN_IDS.length) fail('review.html has ' + makes + ' make() functions, expected ' + GEN_IDS.length);
        if (fmts !== GEN_IDS.length) fail('review.html has ' + fmts + ' fmt() functions, expected ' + GEN_IDS.length);
      }
    }
  },

  /* ================= 跨頁用詞釘樁 =================
     同一條規則在四頁必須用同一句話講。這一課最危險的是「梯形只有一組」——
     只要有一頁鬆口說成「有一組」，整個家族的分界就垮了。
     實際的比對在 data.check 裡（SIBLING_RULES 只是資料，沒有人跑它就等於沒釘）。 */
  SIBLING_RULES: SIBLING_RULES,
  GEN_IDS: GEN_IDS
};

/* 一個 kind 名義上有幾組對邊平行 —— 給 oddOneOut 用（它只拿名字，沒有座標）。 */
function pairsRefOfKind(k){
  return { para:2, rect:2, rhom:2, square:2, trap:1, isotrap:1, quad:0 }[k];
}
