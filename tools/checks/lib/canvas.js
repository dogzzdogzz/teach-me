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
    out.push('cannot read the drawing geometry — no rect/circle/line/text with usable coordinates');
    return out;
  }

  /* ⚠️ 認得的標籤都算過了，但**認不得的標籤要 fail-closed**：畫布上有 polygon
     或 path 而這裡讀不到，就等於那一塊沒被檢查 —— 要說出來，不要默默放行。 */
  const UNSUPPORTED = ['polygon', 'polyline', 'path', 'ellipse', 'image', 'use', 'foreignObject'];
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
