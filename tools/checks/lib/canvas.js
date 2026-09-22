/* SVG 畫布容不容得下它畫的東西 —— 全站共用。
   2026-09-02 從 tools/checks/grade-2-divide.js 抽出來並補上高度（issue #2）。
   ⚠️ 這裡是**唯一一份**。要改就改這裡，不要複製回設定檔 —— 這個檢查原本只有
   divide 有，而且因為當初那個事故是「寬度」的問題，寫出來的版本只驗寬度。
   後面每一課都照抄，於是**沒有一課看得見高度**：一個 height="1" 的畫布
   可以通過所有幾何斷言。

   用法：
     const { canvasProblems } = require('./lib/canvas.js');
     canvasProblems(svgString).forEach(p => fail(label + ': ' + p));
*/

/* ⚠️ 屬性一定要錨定在「字串開頭或空白」之後。`/width="(\d+)"/` 沒有錨點，
   會先咬到 `stroke-width="3"`，整個畫布就被當成 3px 寬。
   `\b` 也不夠 —— `-` 是非字元，所以 `\bwidth=` 照樣咬得到 `stroke-width=`。 */
/* `width="170px"` 也是合法的。不接受單位的話，剛好是這個檢查要抓的那種
   不一致會因為「讀不到數字」而被跳過。 */
const ROOT_W_RE = /(?:^|\s)width="(\d+(?:\.\d+)?)(?:px)?"/;
const ROOT_H_RE = /(?:^|\s)height="(\d+(?:\.\d+)?)(?:px)?"/;

function attr(attrs, name){
  const m = attrs.match(new RegExp('(?:^|\\s)' + name + '="(-?\\d+(?:\\.\\d+)?)"'));
  return m ? Number(m[1]) : null;
}
/* ⚠️ 「沒寫」和「寫了但讀不懂」是兩回事。沒寫的話 SVG 的預設是 0，可以放心當 0；
   寫了 x="abc" 卻當成 0 的話，那個元素會被擺到左上角，畫出界完全看不到。 */
function present(attrs, name){
  return new RegExp('(?:^|\\s)' + name + '=').test(attrs);
}
function coord(attrs, name, out, what){
  const v = attr(attrs, name);
  if (v !== null) return v;
  if (present(attrs, name)){
    out.push(what + ' has an unreadable ' + name + '= — unchecked, not passing');
    return null;
  }
  return 0;   /* 真的沒寫：SVG 預設 0 */
}

/* 回傳問題清單（空陣列＝沒問題）。
   ⚠️ 讀不到幾何要**回報**，不可以回空陣列 —— 讀不到是「沒檢查」，不是「通過」。 */
function halfStroke(attrs){
  const sw = attr(attrs, 'stroke-width');
  if (sw === null) return 0;
  /* 沒有 stroke 的話 stroke-width 不會畫出任何東西。 */
  if (/(?:^|\s)stroke="none"/.test(attrs)) return 0;
  return sw / 2;
}
/* 一段**正圓弧**畫過的範圍：兩個端點，加上落在掃過範圍裡的正東／正南／正西／正北。
   ⚠️ 只看兩個端點是不夠的 —— 一段弧可以在**中間**凸出畫布，兩個端點卻都在裡面。
   ⚠️ 讀不懂一律回 null（半徑放不下兩個端點、算出來不是有限數），由呼叫端報錯。 */
function arcBox(x1, y1, x2, y2, r0, large, sweep){
  if (![x1, y1, x2, y2, r0].every(Number.isFinite) || !(r0 > 0)) return null;
  const hx = (x1 - x2) / 2, hy = (y1 - y2) / 2;
  const d2 = hx * hx + hy * hy;
  /* ⚠️ 兩個端點重合：SVG 規定整段弧當作沒畫（不是讀不懂），所以只留那一個點。 */
  if (!(d2 > 0)) return { x0:x1, y0:y1, x1:x1, y1:y1 };
  /* ⚠️ 半徑太小裝不下兩個端點：SVG 規定**把半徑放大**到剛好裝得下，瀏覽器就是這樣畫的。
     照原本那個小半徑去算極值點，框會算得比實際小 —— 那才是 fail-open。 */
  const r = Math.max(r0, Math.sqrt(d2));
  const k0 = Math.sqrt(Math.max(0, (r * r - d2) / d2));
  const k = (large === sweep) ? -k0 : k0;
  const cx = k * hy + (x1 + x2) / 2;
  const cy = -k * hx + (y1 + y2) / 2;
  if (![cx, cy].every(Number.isFinite)) return null;
  const th1 = Math.atan2(y1 - cy, x1 - cx);
  const th2 = Math.atan2(y2 - cy, x2 - cx);
  const TAU = Math.PI * 2;
  /* sweep ＝ 1 是角度**變大**的方向（畫布的 y 往下，所以看起來是順時針）。 */
  let delta = th2 - th1;
  if (sweep === 1 && delta < 0) delta += TAU;
  if (sweep === 0 && delta > 0) delta -= TAU;
  const xs = [x1, x2], ys = [y1, y2];
  [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(ang => {
    /* 這個極值角落在掃過的範圍裡嗎（照掃的方向量距離）。 */
    let t = (ang - th1) * (sweep === 1 ? 1 : -1);
    t = ((t % TAU) + TAU) % TAU;
    if (t <= Math.abs(delta) + 1e-9){
      xs.push(cx + r * Math.cos(ang));
      ys.push(cy + r * Math.sin(ang));
    }
  });
  return { x0:Math.min.apply(null, xs), y0:Math.min.apply(null, ys),
           x1:Math.max.apply(null, xs), y1:Math.max.apply(null, ys) };
}
/* 一條 <path> 的 d= 拆成一串外框。認得的只有絕對座標的 M／L／A／Z。 */
function pathBoxes(d){
  const toks = String(d).trim().split(/[\s,]+/).filter(t => t !== '');
  if (!toks.length) return { error:'has an empty d=' };
  const boxes = [];
  let i = 0, cx = null, cy = null, sx = null, sy = null;
  const num = () => {
    const t = toks[i];
    if (t === undefined || !/^-?\d+(?:\.\d+)?$/.test(t)) return null;
    i++;
    return Number(t);
  };
  const seg = (ax, ay, bx, by) => boxes.push({ x0:Math.min(ax, bx), y0:Math.min(ay, by), x1:Math.max(ax, bx), y1:Math.max(ay, by) });
  while (i < toks.length){
    const cmd = toks[i++];
    if (cmd === 'M' || cmd === 'L'){
      const x = num(), y = num();
      if (x === null || y === null) return { error:'has an unreadable ' + cmd + ' command' };
      if (cmd === 'L'){
        if (cx === null) return { error:'starts with L before any M' };
        seg(cx, cy, x, y);
      } else { sx = x; sy = y; boxes.push({ x0:x, y0:y, x1:x, y1:y }); }
      cx = x; cy = y;
    } else if (cmd === 'A'){
      const rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), x = num(), y = num();
      if ([rx, ry, rot, large, sweep, x, y].some(v => v === null)) return { error:'has an unreadable A command' };
      if (cx === null) return { error:'starts with A before any M' };
      if (rx !== ry) return { error:'draws an elliptical arc (rx ≠ ry), which this checker does not bound' };
      if (rot !== 0) return { error:'draws a rotated arc, which this checker does not bound' };
      if ((large !== 0 && large !== 1) || (sweep !== 0 && sweep !== 1)) return { error:'has an arc flag that is neither 0 nor 1' };
      const b = arcBox(cx, cy, x, y, rx, large, sweep);
      if (b === null) return { error:'has an arc whose centre cannot be worked out (radius too small, or the two ends coincide)' };
      boxes.push(b);
      cx = x; cy = y;
    } else if (cmd === 'Z' || cmd === 'z'){
      if (cx === null || sx === null) return { error:'closes a subpath that never started' };
      seg(cx, cy, sx, sy);
      cx = sx; cy = sy;
    } else {
      return { error:'uses the path command "' + cmd + '", which this checker does not read (only absolute M, L, A and Z)' };
    }
  }
  if (!boxes.length) return { error:'draws nothing this checker can bound' };
  return { boxes:boxes };
}

function canvasProblems(svgRaw, opts){
  opts = opts || {};
  const svg = String(svgRaw || '');
  const out = [];
  /* ⚠️ 尺寸只能讀**根 <svg> 自己**的標籤。整份字串亂找的話，內層 <g> 或巢狀
     <svg> 上的 width／height 會被當成畫布大小，而根本的畫布其實小得多。 */
  const rootTag = (svg.match(/<svg\b[^>]*>/) || [])[0];
  if (!rootTag){ out.push('cannot find the root <svg> tag'); return out; }
  const w0 = Number((rootTag.match(ROOT_W_RE) || [])[1]);
  const h0 = Number((rootTag.match(ROOT_H_RE) || [])[1]);
  /* preserveAspectRatio="none" 就是明講「我要被拉伸」，那不是缺陷。 */
  const stretches = /(?:^|\s)preserveAspectRatio\s*=\s*["'][^"']*\bnone\b/.test(rootTag);
  /* ⚠️ 座標是畫在 viewBox 的座標系裡，不是 CSS 像素裡。兩者不一樣時，
     拿畫出來的座標去和 width／height 比是比錯對象。有 viewBox 就以它為準。 */
  const vb = (rootTag.match(/(?:^|\s)viewBox="([^"]+)"/) || [])[1];
  let vx = 0, vy = 0, w = w0, h = h0;
  if (vb){
    const n = vb.trim().split(/[\s,]+/).map(Number);
    if (n.length !== 4 || n.some(x => !Number.isFinite(x))){
      out.push('the root <svg> has an unreadable viewBox="' + vb + '"');
      return out;
    }
    vx = n[0]; vy = n[1]; w = n[2]; h = n[3];
    /* ⚠️ width/height 和 viewBox 的長寬比不一樣時，瀏覽器會把整張圖等比縮小
       再置中（preserveAspectRatio 的預設），圖就**無聲地變小**了。
       體重計就是這樣：viewBox 加寬到 210，width 還寫死 170，整個錶面縮成 8 成。
       比例對不上一定要報出來 —— 兩個數字都是對的，錯的是它們不一致。 */
    if (!stretches && Number.isFinite(w0) && Number.isFinite(h0) && w0 > 0 && h0 > 0 && w > 0 && h > 0){
      const aVB = w / h, aPX = w0 / h0;
      if (Math.abs(aVB - aPX) > 0.01 * Math.max(aVB, aPX)){
        out.push('the root <svg> is ' + w0 + 'x' + h0 + ' but its viewBox is ' + w + 'x' + h +
                 ' — the aspect ratios differ, so the whole drawing is silently scaled down and letterboxed');
      }
    }
  }
  if (!Number.isFinite(w) || !Number.isFinite(h)){
    out.push('cannot read the canvas size (root width/height or viewBox)');
    return out;
  }
  /* ⚠️ 讀不懂的東西一律回報，不可以當作沒事：<g transform> 會把整組圖形搬走，
     這裡讀的是搬移**前**的座標，量到的就是錯的位置。 */
  /* 屬性可以用單引號、也可以在等號旁留空白。只認 `transform="` 的話，
     `transform ='...'` 就整個溜過去了。 */
  if (/\stransform\s*=/.test(svg) && !(opts.allow || []).includes('transform')){
    out.push('the drawing uses transform=, which moves shapes in ways this checker does not follow — it is unchecked, not passing');
  }
  if (/<tspan[\s>\/]/.test(svg) && !(opts.allow || []).includes('tspan')){
    out.push('the drawing uses <tspan>, whose text this checker does not measure — it is unchecked, not passing');
  }
  if ((svg.match(/<svg\b/g) || []).length > 1){
    out.push('the drawing contains a nested <svg>, which this checker cannot bound');
  }
  if (!(w > 0) || !(h > 0)){
    out.push('the canvas is ' + w + 'x' + h + ' — a collapsed canvas draws nothing');
    return out;
  }

  /* 每一個元素都算出四個邊，四邊都要驗。只驗右緣的話，畫到畫布下面的東西
     完全看不到 —— 那正是 divide 之後每一課繼承下來的洞。 */
  const box = [];   /* {x0,y0,x1,y1,what} */
  let m;

  const reRect = /<rect([^>]*)\/?>/g;
  while ((m = reRect.exec(svg)) !== null){
    const a = m[1];
    /* ⚠️ SVG 的 x／y 省略時預設是 0，不是「沒有」。原本 continue 掉的話，
       一個 <rect width="500" height="500">（沒寫 x/y）完全不會被量到。 */
    const x = coord(a, 'x', out, 'a <rect>'), y = coord(a, 'y', out, 'a <rect>');
    if (x === null || y === null) continue;
    const rw = attr(a, 'width'), rh = attr(a, 'height');
    if (rw === null || rh === null){ out.push('a <rect> has no readable width/height — unchecked, not passing'); continue; }
    box.push({ x0:x, y0:y, x1:x + rw, y1:y + rh, half:halfStroke(a), what:'a rect' });
  }

  const reCircle = /<circle([^>]*)\/?>/g;
  while ((m = reCircle.exec(svg)) !== null){
    const a = m[1];
    const cx = coord(a, 'cx', out, 'a <circle>'), cy = coord(a, 'cy', out, 'a <circle>');
    if (cx === null || cy === null) continue;
    const r = attr(a, 'r');
    if (r === null){ out.push('a <circle> has no readable r — unchecked, not passing'); continue; }
    box.push({ x0:cx - r, y0:cy - r, x1:cx + r, y1:cy + r, half:halfStroke(a), what:'a circle' });
  }

  const reLine = /<line([^>]*)\/?>/g;
  while ((m = reLine.exec(svg)) !== null){
    const a = m[1];
    const x1 = coord(a, 'x1', out, 'a <line>'), y1 = coord(a, 'y1', out, 'a <line>');
    const x2 = coord(a, 'x2', out, 'a <line>'), y2 = coord(a, 'y2', out, 'a <line>');
    if ([x1,y1,x2,y2].some(v => v === null)) continue;
    box.push({ x0:Math.min(x1,x2), y0:Math.min(y1,y2), x1:Math.max(x1,x2), y1:Math.max(y1,y2), half:halfStroke(a), what:'a line' });
  }

  /* <path>：只認**絕對座標**的 M／L／A／Z，而且弧一律是**正圓**（rx ＝ ry、旋轉 0）。
     其餘（相對座標、C／Q／S／T／H／V、橢圓弧、讀不到的數）一律回報 ——
     讀不懂是「沒檢查」，不是「通過」。2026-09-21 為了六年級「扇形」那一課加上去的。 */
  const rePath = /<path([^>]*?)\/?>/g;
  while ((m = rePath.exec(svg)) !== null){
    const a = m[1];
    const dm = a.match(/(?:^|\s)d="([^"]*)"/);
    if (!dm){ out.push('a <path> has no readable d= — unchecked, not passing'); continue; }
    /* ⚠️ 會改幾何、而這裡讀不到的東西一律回報（transform 由上面那條全域檢查擋）：
       style／class 可能改 d 或線寬，marker 會在端點多畫東西。 */
    /* ⚠️ 只擋**會改幾何**的宣告：`style="fill:red"` 這種純外觀的不算（不然全是假警報）。
       `class=` 一律回報，因為 CSS 可能在別處把線寬或 d 改掉，這裡讀不到。 */
    const styleAttr = (a.match(/(?:^|\s)style="([^"]*)"/) || [])[1] || '';
    if (/(?:^|[;\s])(?:d|stroke-width|transform|marker[a-z-]*|stroke-linejoin|stroke-miterlimit|stroke-linecap)\s*:/i.test(styleAttr)){
      out.push('a <path> has a style= that changes its geometry, which this checker does not follow — unchecked, not passing'); continue;
    }
    if (/(?:^|\s)class=/.test(a)){ out.push('a <path> carries class=, whose CSS this checker cannot resolve — unchecked, not passing'); continue; }
    if (/(?:^|\s)marker(?:-start|-mid|-end)?=/.test(a)){ out.push('a <path> carries a marker, which draws extra geometry this checker does not bound — unchecked, not passing'); continue; }
    const seg = pathBoxes(dm[1]);
    if (seg.error){ out.push('a <path> ' + seg.error + ' — unchecked, not passing'); continue; }
    /* ⚠️ 描邊的**折點**會伸得比半個線寬遠：miter 接法伸出去最多是
       stroke-miterlimit（預設 4）× 半個線寬。只有**真的有折點**（兩段以上）而且接法是 miter
       才要這樣墊；round／bevel 不會超過半個線寬，單獨一段弧也沒有折點。
       （線帽 round／square 往外伸的長度就是半個線寬，已經含在 halfStroke 裡。） */
    const hs0 = halfStroke(a);
    const join = (a.match(/(?:^|\s)stroke-linejoin="([a-z]+)"/) || [])[1] || 'miter';
    const mlRaw = Number((a.match(/(?:^|\s)stroke-miterlimit="([\d.]+)"/) || [])[1]);
    const miterLimit = Number.isFinite(mlRaw) && mlRaw >= 1 ? mlRaw : 4;
    let hs = hs0;
    if (hs0 > 0 && seg.boxes.length > 1 && join === 'miter') hs = hs0 * miterLimit;
    seg.boxes.forEach(b => box.push({ x0:b.x0, y0:b.y0, x1:b.x1, y1:b.y1, half:hs, what:'a path' }));
  }

  /* 文字：屬性要各自抓，不要寫成一條含選擇性群組的正規式 —— x 後面接的是 y，
     選擇性的 font-size 群組永遠抓不到，每個字都會被當成預設字級。
     而且 x ＋ 字級不是文字的右緣：還要看有幾個字、以及 text-anchor 把字擺在
     x 的哪一邊。一個字最寬算 1.2 個字級（emoji 比一個全形字略寬）。
     ⚠️ 直的方向：SVG 的 y 是**基線**，字身大約從 y - 0.8em 到 y + 0.25em。 */
  const reText = /<text([^>]*)>([^<]*)<\/text>/g;
  while ((m = reText.exec(svg)) !== null){
    const a = m[1], body = m[2];
    const x = coord(a, 'x', out, 'a <text>'), y = coord(a, 'y', out, 'a <text>');
    if (x === null || y === null) continue;
    const fs = attr(a, 'font-size') !== null ? attr(a, 'font-size') : (opts.defaultFontSize || 20);
    const anchor = (a.match(/(?:^|\s)text-anchor="([a-z]+)"/) || [])[1] || 'start';
    /* ⚠️ 數「字」要數**畫得出來的**那些。`[...'🖍️']` 是兩個碼點 —— emoji 本體
       再加一個變化選擇子（U+FE0F），但畫出來只有一個字。照碼點數的話這個字
       會被當成兩倍寬，好好的圖被誤判成畫出界。
       變化選擇子、零寬連接符、膚色修飾都不是字，要先扣掉。 */
    /* ⚠️ ZWJ 連起來的整串是**一個字**（👨‍👩‍👧‍👦 是四個人再加三個 ZWJ，畫出來只有一個）。
       只把 ZWJ 濾掉、留下四個碼點的話，寬度會被算成四倍。整串先收成一個字。 */
    const joined = body.replace(/(?:\p{Extended_Pictographic}(?:\uFE0F)?\u200D)+\p{Extended_Pictographic}(?:\uFE0F)?/gu, 'x');
    const glyphs = [...joined].filter(ch => {
      const c = ch.codePointAt(0);
      if (c === 0xFE0E || c === 0xFE0F || c === 0x200D) return false;   /* 變化選擇子、ZWJ */
      if (c >= 0x1F3FB && c <= 0x1F3FF) return false;                   /* 膚色修飾 */
      return true;
    }).length;
    const wide = Math.ceil((glyphs || 1) * fs * 1.2);
    const x0 = anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x);
    box.push({ x0, y0:y - fs * 0.8, x1:x0 + wide, y1:y + fs * 0.25, half:0, what:'the text "' + body.slice(0, 12) + '"' });
  }

  if (!box.length){
    out.push('cannot read the drawing geometry — no rect/circle/line/path/text with usable coordinates');
    return out;
  }

  /* ⚠️ 認得的標籤都算過了，但**認不得的標籤要 fail-closed**：畫布上有 polygon
     或 path 而這裡讀不到，就等於那一塊沒被檢查 —— 要說出來，不要默默放行。 */
  /* `path` 不在這一份清單裡：上面**真的量過**它（只認絕對座標的 M／L／A／Z，
     其餘形狀在那裡就回報了）。 */
  const UNSUPPORTED = ['polygon', 'polyline', 'ellipse', 'image', 'use', 'foreignObject'];
  UNSUPPORTED.forEach(tag => {
    if (new RegExp('<' + tag + '[\\s>]').test(svg) && !(opts.allow || []).includes(tag)){
      out.push('the drawing contains <' + tag + '>, whose extent this checker cannot read — it is unchecked, not passing');
    }
  });

  const pad = opts.pad != null ? opts.pad : 2;
  /* ⚠️ 線的粗細要**逐個元素**算。拿全圖最粗的那一條去墊每一個元素的話，
     一條 12px 粗的底線會讓每一個小圖示都多出 6px，好好的圖被誤判成畫出界。 */
  const right = Math.max.apply(null, box.map(b => b.x1 + b.half));
  const bottom = Math.max.apply(null, box.map(b => b.y1 + b.half));
  const left = Math.min.apply(null, box.map(b => b.x0 - b.half));
  const top = Math.min.apply(null, box.map(b => b.y0 - b.half));
  const worstR = box.reduce((a, b) => b.x1 > a.x1 ? b : a);
  const worstB = box.reduce((a, b) => b.y1 > a.y1 ? b : a);
  const worstL = box.reduce((a, b) => b.x0 < a.x0 ? b : a);
  const worstT = box.reduce((a, b) => b.y0 < a.y0 ? b : a);

  if (!(vx + w >= right + pad)) out.push('the canvas is ' + w + 'px wide but ' + worstR.what + ' draws out to x=' + Math.round(right));
  if (!(vy + h >= bottom + pad)) out.push('the canvas is ' + h + 'px tall but ' + worstB.what + ' draws down to y=' + Math.round(bottom));
  if (left < vx - pad) out.push(worstL.what + ' starts at x=' + Math.round(left) + ', off the left edge');
  if (top < vy - pad) out.push(worstT.what + ' starts at y=' + Math.round(top) + ', off the top edge');
  return out;
}

module.exports = { canvasProblems };
