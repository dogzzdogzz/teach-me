/* grade-4/math/angle（度、量角器量角與畫角、旋轉角、角度的合成與分解）的檢查設定。

   範圍取自課程自己說的話（三頁都對讀者講了同一件事）：
   這一課用**半圓量角器**，一次量得到的角在 0°~180° 之間；分類講到平角 180° 為止，
   **優角（大於 180°）不在這一課**；旋轉角只算「轉了多少」，轉一整圈是 360°。

   這一課有四個守門重點：

   ① **這是本站第一次畫「需要量測」的圖，所以真值要從畫出來的座標量回來。**
      `tickList`／`labelList`／`armList` 是純資料函式，這裡把它們**跑起來**，
      再用 `atan2` 把每一筆的角度量回去比對 —— 不是數元素的數量，也不是讀座標的字面值。
      最關鍵的一條：畫出來的兩條邊，**它們之間真正的夾角必須等於 a**，
      對 1~179 兩種擺法各驗一次。

   ② **畫布的四個方向都要驗。**（2026-08-27 rounding 那一輪的教訓：只驗左右等於沒驗）
      版面常數由課程的資料區匯出、渲染函式直接拿它們畫，這裡驗上、下、左、右，
      外加**五張** `.prot` 與一張 `.turnfig` 的 viewBox 和 CSS 高度有沒有跟著走。

   ③ **「兩排數字」的規則有兩個說法，必須永遠一致。**
      「你把哪一端的 0 對準邊，就讀那一排」與「同一格的兩個數字加起來是 180」是
      課程明講的兩件事。這裡把讀數獨立實作一次（`readingRef`，從幾何位置算），
      再對 1~179 × 兩種擺法逐一比對；並釘住 **90° 是唯一兩排讀數相同的角**
      ——「讀錯排一定會得到不一樣的答案」那句話在 90° 上是假的，課程有分支處理。

   ④ **鈍角的界線寫得太滿就是錯的。**「比 90° 大」在 180° 上是假的。
      `kindOf` 用第二套寫法重寫一次（`kindRef`），對 0~361 全部比一次，
      並把三頁的措辭釘進 `SIBLING_RULES`。 */

const fs = require('fs');
const path = require('path');

const DEG_MIN = 1, DEG_MAX = 179;
const RIGHT = 90, STRAIGHT = 180, FULL = 360;

/* --- 角的分類：第二套實作。邊界的判斷順序和課程的寫法刻意不同。 --- */
function kindRef(deg){
  if (!(deg > 0 && deg <= STRAIGHT)) return null;
  if (deg === STRAIGHT) return 'straight';
  if (deg === RIGHT) return 'right';
  return (deg < RIGHT) ? 'acute' : 'obtuse';
}
/* --- 量角器的兩排數字：第二套實作。 --- */
function labelRef(theta, scale){ return (scale === 'inner') ? theta : STRAIGHT - theta; }
function scaleRef(from){ return (from === 'right') ? 'inner' : 'outer'; }
function baseRef(from){ return (from === 'right') ? 0 : STRAIGHT; }
function armRef(a, from){ return (from === 'right') ? a : STRAIGHT - a; }
function readingRef(a, from){ return labelRef(armRef(a, from), scaleRef(from)); }

/* 從座標把角度量回來（0~360）。畫布的 y 向下，所以 y 要反過來。 */
function degOfPoint(cx, cy, x, y){
  const d = Math.atan2(cy - y, x - cx) * 180 / Math.PI;
  return (d < 0) ? d + 360 : d;
}
function radiusOf(cx, cy, x, y){ return Math.hypot(x - cx, y - cy); }
/* 兩個方向之間的夾角（0~180）—— 這才是「畫出來的角真的是幾度」。 */
function angleBetween(d1, d2){
  const g = Math.abs(d1 - d2) % 360;
  return (g > 180) ? 360 - g : g;
}
function near(a, b, tol){ return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol); }
/* NaN 和任何數字比都是 false，所以「不在畫布外」會靜靜成立 —— 界線檢查前先確認是有限數。 */
function finite(v){ return typeof v === 'number' && Number.isFinite(v); }

/* --- 旋轉角的真值表：deg 一律是 360 × num ÷ den。 --- */
const TURNS = [
  { num:1, den:12, deg:30 },
  { num:1, den:6,  deg:60 },
  { num:1, den:4,  deg:90 },
  { num:1, den:3,  deg:120 },
  { num:1, den:2,  deg:180 },
  { num:2, den:3,  deg:240 },
  { num:3, den:4,  deg:270 },
  { num:1, den:1,  deg:360 }
];
const TURN_NAMES = {
  zh: ['十二分之一圈','六分之一圈','四分之一圈','三分之一圈','半圈','三分之二圈','四分之三圈','一整圈'],
  en: ['a twelfth of a turn','a sixth of a turn','a quarter turn','a third of a turn',
       'half a turn','two thirds of a turn','three quarters of a turn','a full turn']
};
/* 課程頁與複習頁各有自己的名字表，但講的是同一件事，所以兩邊都拿這一張比。 */
const KIND_NAMES = {
  zh: { acute:'銳角', right:'直角', obtuse:'鈍角', straight:'平角', full:'周角' },
  en: { acute:'an acute angle', right:'a right angle', obtuse:'an obtuse angle',
        straight:'a straight angle', full:'a full turn' }
};
/* 課程頁的界線措辭（寫太滿就是錯的那一條，釘在這裡）。 */
const KIND_RANGE = {
  zh: { acute:'大於 0° 而且小於 90°', right:'剛好 90°',
        obtuse:'大於 90° 而且小於 180°', straight:'剛好 180°（兩條邊拉成一直線）' },
  en: { acute:'more than 0° and less than 90°', right:'exactly 90°',
        obtuse:'more than 90° and less than 180°',
        straight:'exactly 180° (the two sides form a straight line)' }
};
/* 靜態題庫用的是短名（選項寫「鈍角」／「obtuse」，不是「an obtuse angle」）。 */
const QUIZ_KIND = {
  zh: { acute:'銳角', right:'直角', obtuse:'鈍角', straight:'平角' },
  en: { acute:'acute', right:'right', obtuse:'obtuse', straight:'straight' }
};

/* --- review.html 的 toolRule 真值表。拿產生器自己的字典當標準答案等於自己比自己，
       所以這裡完整重抄一份（問題、正解、三個誘答）。 --- */
const RULES = {
  zh: [
    { q:'用量角器量角的時候，量角器的中心點要對準什麼？',
      a:'角的頂點',
      w:['其中一條邊上、離頂點有一段距離的一點','角的開口正中間','量角器的 0 刻度線'] },
    { q:'量角器上有兩排數字，應該讀哪一排？',
      a:'從你對準的那個 0 開始、一路數下去的那一排',
      w:['永遠讀外面那一排','永遠讀裡面那一排','兩排都讀，再把兩個數字加起來'] },
    { q:'用量角器畫角的時候，第一步要做什麼？',
      a:'先畫一條邊，並在它的端點標出頂點',
      w:['先在要的度數那一格點一個點','先把量角器放在紙的正中間','先把兩條邊都畫出來'] },
    { q:'把一整圈平分成幾等份，一份才是 1 度？',
      a:'360 等份',
      w:['100 等份','180 等份','90 等份'] },
    { q:'量角器同一格上的兩個數字，加起來一定是多少？',
      a:'180',
      w:['90','360','100'] }
  ],
  en: [
    { q:'When you measure an angle with a protractor, what does the centre point go on?',
      a:'the vertex of the angle',
      w:['a point on one of the sides, away from the vertex','the middle of the opening','the 0 mark of the protractor'] },
    { q:'A protractor carries two rows of numbers. Which row should you read?',
      a:'the row you get by counting on from the 0 you lined up',
      w:['always the outer row','always the inner row','read both rows and add the two numbers'] },
    { q:'When you draw an angle with a protractor, what is the first step?',
      a:'draw one side first and mark the vertex at its end',
      w:['put a dot at the degree you want first','put the protractor in the middle of the paper first','draw both sides first'] },
    { q:'One full turn has to be split into how many equal parts for one part to be 1 degree?',
      a:'360 parts',
      w:['100 parts','180 parts','90 parts'] },
    { q:'The two numbers on one mark of a protractor always add up to what?',
      a:'180',
      w:['90','360','100'] }
  ]
};

/* 每個產生器的數字選項範圍。沒列到的走預設 [DEG_MIN, STRAIGHT]。 */
const RANGE = {
  protractorRead: [DEG_MIN, DEG_MAX],
  wrongScale:     [DEG_MIN, DEG_MAX],
  partOfWhole:    [DEG_MIN, DEG_MAX],
  pickKind:       [DEG_MIN, STRAIGHT],
  sumAngles:      [DEG_MIN, STRAIGHT],
  turnToDeg:      [DEG_MIN, FULL],
  clockHour:      [15, FULL]
};
/* 選項是文字（不是度數）的產生器。 */
const TEXT_GENS = ['classify', 'degToTurn', 'toolRule'];

/* 數字要比「整個 token」：子字串比對會把 40 認在 140 裡面。 */
function printsNum(text, v){
  return (String(text).match(/\d+/g) || []).indexOf(String(v)) >= 0;
}
/* 「85°」→ 85；不是「純整數＋度」就回 null。 */
function degValue(s){
  const m = /^(\d+)°$/.exec(String(s).trim());
  return m ? Number(m[1]) : null;
}

/* ---------------------------------------------------------------------------
   三層題庫的第二套實作。`verify_lesson_data.js` 內建的算術重算只認得
   「a ＋ b ＝ ?」那種題幹，這一課一題都不符合 —— 沒有這張表，把 ans 改掉
   完全不會被抓到。
   每一題記：題幹裡**剛好**出現哪些數字、答案要怎麼從那些數字重算、
   以及解釋裡一定要講到的字。
   --------------------------------------------------------------------------- */
/* `stemMust` 是**題幹問的是什麼**的守門條件。少了它，神諭就只是位置式模板：
   把「兩個角拼成一個平角」改寫成「拼成一整圈」，題幹的數字沒變，
   神諭照樣要求 65°，解釋也沒動，整題就這樣靜靜錯掉（codex #5）。
   `optMax` 是那一題自己的上界：量角器讀出來的角只到 180，只有**題目本身就在講整圈**
   的那幾題（直角是整圈的四分之一、半圈、四分之三圈、鐘面）才可以放行到 360（codex #7）。
   預設 180。

   ⚠️ 已知限制（第二輪審查提出，判定為可接受）：
   - `stemMust` 是子字串比對，擋得住「把平角改成別的東西」這種漂移，
     擋不住「在同一句話裡加一個『不』」這種敵意改寫。它的定位是漂移守門，不是語意證明。
   - `toolRule` 的選項集合比對是「編輯快照」：換一個一樣合理的誘答也會響。
     這是刻意的 —— 它要擋的是「換成別條規則的誘答」造成的一題兩解。 */
const BANK = {
  qs: [
    { nums:[], kind:'constRight', optMax:FULL,
      stemMust:{ zh:['直角'], en:['right angle'] },
      whyMust:{ zh:['90','360'], en:['90','360'] } },
    { nums:[], kind:'text', text:{ zh:'角的頂點', en:'the vertex of the angle' },
      stemMust:{ zh:['中心點'], en:['centre point'] },
      whyMust:{ zh:['頂點'], en:['vertex'] } },
    { nums:[], kind:'constStraight', optMax:FULL,
      stemMust:{ zh:['半圈'], en:['half a turn'] },
      whyMust:{ zh:['180','360'], en:['180','360'] } },
    { nums:[128], kind:'classify',
      stemMust:{ zh:['什麼角'], en:['What kind of angle'] },
      whyMust:{ zh:['128','鈍角','平角'], en:['128','obtuse','straight'] } },
    { nums:[45], kind:'classify',
      stemMust:{ zh:['什麼角'], en:['What kind of angle'] },
      whyMust:{ zh:['45','銳角'], en:['45','acute'] } },
    /* 「明顯比直角小」＋兩排讀數 → 小於 90 的那一個。 */
    { nums:[55, 125], kind:'acutePick',
      stemMust:{ zh:['比直角小','兩排數字'], en:['smaller than a right angle','on one row'] },
      whyMust:{ zh:['55','125','180','銳角'], en:['55','125','180','acute'] } }
  ],
  qsAdv: [
    { nums:[115], kind:'straightMinus',
      stemMust:{ zh:['平角'], en:['straight angle'] },
      whyMust:{ zh:['180','115','65'], en:['180','115','65'] } },
    { nums:[2, 6], kind:'clock', optMax:FULL,
      stemMust:{ zh:['時針'], en:['hour hand'] },
      whyMust:{ zh:['30','120','12'], en:['30','120','12'] } },
    { nums:[], kind:'constThreeQuarter', optMax:FULL,
      stemMust:{ zh:['四分之三圈'], en:['three quarters of a turn'] },
      whyMust:{ zh:['360','90','270'], en:['360','90','270'] } },
    { nums:[35, 48], kind:'sumThenKind',
      stemMust:{ zh:['比它大'], en:['bigger than it'] },
      whyMust:{ zh:['35','48','83','銳角'], en:['35','48','83','acute'] } }
  ],
  qsBoost: [
    { nums:[40, 140, 140], kind:'acutePick',
      stemMust:{ zh:['比直角小'], en:['smaller than a right angle'] },
      whyMust:{ zh:['40','140','180','銳角'], en:['40','140','180','acute'] } },
    { nums:[90], kind:'text',
      text:{ zh:'大於 90° 而且小於 180° 的角才是鈍角',
             en:'only an angle that is more than 90° and less than 180° is obtuse' },
      stemMust:{ zh:['鈍角'], en:['obtuse'] },
      whyMust:{ zh:['180','90','平角','鈍角'], en:['180','90','straight angle','obtuse'] } }
  ]
};

/* ---------------------------------------------------------------------------
   速查卡與家長頁的措辭。三頁教的是同一條規則，只驗上課頁等於沒在盯另外兩頁。
   `need` 是**出現次數**：中文字串在這些頁面上一定有兩份（markup 的 fallback ＋ 字典），
   只改掉其中一份必須要被抓到；英文只住在 en 字典裡，所以 need 是 1。
   --------------------------------------------------------------------------- */
const SIBLING_RULES = {
  'reference.html': {
    must: [
      ['你把哪一端的 0 對準那條邊，就一路讀那一排', 2],
      ['加起來永遠是 180', 2],
      ['大於 90° <strong>而且</strong>小於 180°', 2],
      ['銳角一定小於 90°、鈍角一定大於 90°', 2],
      ['量角的三個步驟', 2],
      ['畫角的四個步驟', 2],
      ['半圓量角器', 2],
      ['大於 180° 的角（優角）不在這一課', 2],
      ['不分順時針或逆時針', 2],
      ['而且沒有重疊', 2],
      ['Whichever end’s 0 you line up with a side, that is the row you read', 1],
      ['always add up to 180', 1],
      ['more than 90° <strong>and</strong> less than 180°', 1],
      ['semicircular protractor', 1],
      ['reflex angles', 1],
      /* codex 第一輪 #2：內／外圈的對應只是「本課這張圖」的排法，不是通則。 */
      ['真的量角器不一定這樣排', 2],
      ['real protractors are not always arranged that way', 1],
      /* codex 第一輪 #3：換一端量到的 125° 是「斜邊和直線另一半」的角，不是同一個角。 */
      ['直線<strong>另一半</strong>之間的角', 2],
      ['the <strong>other half</strong> of the straight line', 1]
    ],
    forbid: ['比 90° 大的角都是鈍角', '一律讀外圈', '一律讀內圈', '一整圈是 180°',
             'every angle bigger than 90° is obtuse', '優角也算鈍角',
             /* codex 第一輪 #1：對不上不一定是讀錯排 —— 量角器沒擺好也會對不上。 */
             '就是讀錯排了', 'means the wrong row was read',
             /* 同 #3：那不是「另一個角」，是同一條斜邊配另一半直線。 */
             '量的就是另一個角'],
    /* 四種角由小到大的那一張表。 */
    orderedZh: { table:'kindtable', words:['銳角', '直角', '鈍角', '平角'] }
  },
  'parents.html': {
    must: [
      ['中心點對頂點', 2],
      ['同一格的兩個數字加起來一定是 180', 2],
      ['大於 90°，而且小於 180°', 2],
      ['半圓量角器', 2],
      ['優角', 2],
      ['角度闖關', 2],
      ['Whichever end’s 0 you lined up with a side is the row you have to keep reading', 1],
      ['more than 90°, and less than 180°', 1],
      ['semicircular protractor', 1],
      ['Angle Challenge', 1],
      /* codex 第一輪 #2：家長頁本來就講對了這一句，要釘住它。 */
      ['真的量角器兩排的內外位置不一定一樣', 2],
      /* codex 第一輪 #1：對不上要回頭檢查兩件事，不是直接斷定讀錯排。 */
      ['量角器有沒有擺好', 2],
      ['that the protractor is set up properly', 1]
    ],
    forbid: ['這一課也教優角', 'this lesson also covers reflex angles',
             '一整圈是 180°', '鈍角只要比 90° 大就好', '銳角一定大於 90°',
             '就是讀錯排了', 'means the wrong row was read'],
    orderedZh: null
  }
};

/* ===========================================================================
   小遊戲「角度闖關」（§六之五，五關五種玩法）的檢查。
   每一關照遊戲自己的規則把題庫的每一題玩一遍；正解一律用這份設定檔的第二套實作
   （kindRef／labelRef／readingRef／TURNS）重算；**畫出來的圖一律把 SVG 字串量回來**
   （線的端點 → atan2 → 角度），不是相信產生它的資料。
   =========================================================================== */
const { extractFunction } = require('./lib/gameshuffle.js');
const PHONE_K300 = Math.min(1.5, 289 / 300), PHONE_K320 = Math.min(1.5, 289 / 320);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
/* 從頁面自己畫的 SVG 字串裡讀出元素（屬性順序就是 gLine／gText 寫的順序；讀不到就是數量對不上 → fail） */
function svgLines(svg, cls){
  const out = [], re = /<line class="([^"]*)" x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g;
  let m; while ((m = re.exec(svg))) if (m[1] === cls) out.push({ x1:+m[2], y1:+m[3], x2:+m[4], y2:+m[5] });
  return out;
}
function svgTexts(svg, cls){
  const out = [], re = /<text class="([^"]*)" x="([-\d.]+)" y="([-\d.]+)" text-anchor="middle" font-size="([\d.]+)"[^>]*>([^<]*)<\/text>/g;
  let m; while ((m = re.exec(svg))) if (m[1] === cls){ const sz = +m[4]; out.push({ x:+m[2], y:+m[3] - sz * 0.35, size:sz, txt:m[5] }); }
  return out;
}
function svgPaths(svg, cls){
  const out = [], re = /<path class="([^"]*)" d="([^"]*)"/g;
  let m; while ((m = re.exec(svg))) if (m[1] === cls) out.push(m[2]);
  return out;
}
/* 「M x y A r r 0 large sweep x y」 */
function arcOf(d){
  const m = /^M ([-\d.]+) ([-\d.]+) A ([\d.]+) ([\d.]+) 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)$/.exec(String(d).trim());
  return m ? { x1:+m[1], y1:+m[2], r:+m[3], large:+m[5], sweep:+m[6], x2:+m[7], y2:+m[8] } : null;
}
/* 「M cx cy L x y A r r 0 0 0 x y Z」 */
function sectorOf(d){
  const m = /^M ([-\d.]+) ([-\d.]+) L ([-\d.]+) ([-\d.]+) A ([\d.]+) [\d.]+ 0 0 0 ([-\d.]+) ([-\d.]+) Z$/.exec(String(d).trim());
  return m ? { cx:+m[1], cy:+m[2], x1:+m[3], y1:+m[4], r:+m[5], x2:+m[6], y2:+m[7] } : null;
}
function dirOf(l){ return degOfPoint(l.x1, l.y1, l.x2, l.y2); }
function circDiff(a, b){ const g = Math.abs(a - b) % 360; return g > 180 ? 360 - g : g; }
const textW = t => String(t.txt).length * t.size * 0.62;   /* 保守：每個字 0.62 字寬（°、數字都比這窄） */
function textBox(t){ const w = textW(t); return { x:t.x - w / 2 - 1.5, y:t.y - t.size * 0.6 - 1.5, w:w + 3, h:t.size * 1.2 + 3 }; }
const boxIn = (b, W, H) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
const boxHit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
const sq = (cx, cy, s) => ({ x:cx - s / 2, y:cy - s / 2, w:s, h:s });

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'];
  const TYPES = ['turn', 'read', 'draw', 'kind', 'combo'];
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join())
    fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    const got = nums(text).join();
    if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
  };
  const has = (where, text, w) => { if (String(text).indexOf(w) < 0) fail(where + ' does not say "' + w + '": ' + text); };
  const touch = (what, sz, k) => { if (!(sz * k >= 44)) fail(what + ' is ' + (sz * k).toFixed(1) + 'px on a 375px phone — under 44'); };
  /* 遊戲程式裡用到的每一個 d.xxx 都要在兩種語言的字典裡（三年級 angle：舊鍵刪掉時按鈕變空白） */
  const gameSrc = (src.split('小遊戲：角度闖關（五關五種玩法')[1] || '');
  if (!gameSrc) fail('cannot find the game section of index.html');
  Array.from(new Set((gameSrc.match(/\bd\.([A-Za-z0-9]+)/g) || []).map(s => s.slice(2)))).forEach(k => {
    LANGS.forEach(L => { if (I18N[L][k] === undefined) fail('the game uses d.' + k + ' but the ' + L + ' dictionary has no ' + k); });
  });
  /* 外層和內層都要驗洞：forEach／every 會跳過洞，`[2, , 5]` 的長度、Set、every 全都照樣綠（codex 第一輪 #1） */
  const holes = (arr, where, n) => {
    if (!Array.isArray(arr)) return fail(where + ' is not an array'), true;
    if (n !== undefined && arr.length !== n) return fail(where + ' has ' + arr.length + ' entries, expected ' + n), true;
    for (let i = 0; i < arr.length; i++) if (!Object.prototype.hasOwnProperty.call(arr, i)) return fail(where + '[' + i + '] is a hole in the array'), true;
    return false;
  };
  ['GAME_TURN', 'GAME_READ', 'GAME_DRAW', 'GAME_KIND', 'GAME_COMBO'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 5) fail(k + ' should be a pool of at least 5 entries');
    else if (!holes(D[k], k)) D[k].forEach((e, i) => {
      if (k === 'GAME_TURN') holes(e, k + '[' + i + ']', 3);
      else if (k === 'GAME_READ' || k === 'GAME_DRAW') holes(e, k + '[' + i + ']', 2);
      else if (k === 'GAME_KIND') holes(e, k + '[' + i + ']', 5);
      else holes(e && e.x, k + '[' + i + '].x', 3);
    });
  });
  ['tray', 'rowY'].forEach(n => { const o = n === 'tray' ? D.KIND_G.tray : D.PROT_G.rowY; holes(o, n, n === 'tray' ? 5 : 2); });
  holes(D.COMBO_G.trayX, 'COMBO_G.trayX', 4);

  /* ---------- 共用：shuffle() 真的跑：是排列、不改輸入、而且永遠不會由小到大 ---------- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated on its own: ' + e.message); } }
    if (shuffle){
      [[35, 89, 90, 91, 180], [55, 65, 75, 115], [1, 2]].forEach(input => {
        const orders = new Set(), before = input.join();
        for (let i = 0; i < 3000; i++){
          const out = shuffle(input);
          if (input.join() !== before) return fail('shuffle() mutates its input');
          if (out.slice().sort((a, b) => a - b).join() !== input.slice().sort((a, b) => a - b).join()) return fail('shuffle() changed the set: ' + out);
          let up = true; for (let k = 1; k < out.length; k++) if (!(out[k - 1] < out[k])) up = false;
          if (up) return fail('shuffle() returned ' + out.join(',') + ' — already in increasing order (the tray must never start sorted)');
          orders.add(out.join());
        }
        if (orders.size < (input.length > 2 ? 3 : 1)) fail('shuffle() of ' + input.join(',') + ' produced only ' + orders.size + ' orders in 3000 runs');
      });
    }
    need('kind', /shuffle\(pick\(GAME_KIND\)\)/, 'the angle cards are not shuffled into the tray');
    need('combo', /shuffle\(\[b\]\.concat\(e\.x\)\)/, 'the pieces are not shuffled into the tray');
    need('read', /shuffle\(pick\(GAME_READ\)\)/, 'the two angles are not shuffled (the 0 would always be on the same side first)');
    need('draw', /shuffle\(pick\(GAME_DRAW\)\)/, 'the two angles are not shuffled (the 0 would always be on the same side first)');
  }

  /* ---------- 共用：nearestOpen() 真的跑（分一分的四個籃子放寬之後會重疊） ---------- */
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    let nearestOpen = null;
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
    if (nearestOpen){
      const G = D.KIND_G, pad = D.GAME_PAD;
      const list = [0, 1, 2, 3].map(i => ({ id:i, cx:D.kindBinX(i) + G.binW / 2, cy:G.binY + G.binH / 2, hw:G.binW / 2, hh:G.binH / 2, done:false }));
      let bad = 0;
      list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1){ const g = nearestOpen(list, { x, y:b.cy }, pad); if (!g || g.id !== b.id) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside a bin are given to another bin (or none)');
      const a = list[0], b = list[1], gapL = a.cx + a.hw, gapR = b.cx - b.hw;
      if (!(gapR > gapL)) fail('the bins touch — there is no gap between them');
      if (!(gapR - gapL < 2 * pad)) fail('the padded bins do not overlap — the overlap-zone rule is never exercised (gap ' + (gapR - gapL) + ', pad ' + pad + ')');
      else {
        const px = gapR - (gapR - gapL) * 0.3, g = nearestOpen(list, { x:px, y:a.cy }, pad);
        if (!g || g.id !== 1) fail('nearestOpen(): a drop in the gap nearer the later bin goes to ' + (g ? g.id : 'none') + ' (first match, not nearest)');
      }
      const two = [{ id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false }];
      const r0 = nearestOpen(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [{ id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false }];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every box is accepted');
    }
  }

  /* ---------- 共用：計分（中年級 §三：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0） ---------- */
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
  /* 換畫板之後，還拿在手上的舊積木放開時不可以動到新的那一關；拼一拼的「下一題」也換畫板 */
  if (!/if \(gen !== gGen\) return;/.test(src) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src))
    fail('the drag engine has no board-generation guard: a piece held across Restart could act on the new board');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('startRound() does not bump gGen');
  need('combo', /if \(k > 0\) gGen\+\+;/, 'the second puzzle does not get a new board generation (a piece held from puzzle 1 could act on puzzle 2)');
  if ((src.match(/if \(!start \|\| e\.pointerId !== pid\) return;/g) || []).length !== 2) fail('the drag engine does not follow only the first finger (move and end must both check pointerId)');
  if (!/document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(src)) fail('the drag engine has no document-level release while dragging');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on lostpointercapture');
  if (!/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on pointercancel');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('placed pieces still take pointer events');
  if (!/if \(cancelled \|\| gSolved\)\{ if \(o\.rotor\) o\.rotor\.cancel\(\); else P\.home\(\); return; \}/.test(src)) fail('a cancelled drag does not put a handle/bead back');
  TYPES.forEach(t => { if ((B[t].match(/useTapSelect\(B, function\(P, pt\)\{/g) || []).length !== 1) fail(t + ': the round does not install its drop / tap-then-tap handler (useTapSelect)'); });
  /* useTapSelect() 真的跑（codex 第一輪 #2）：點一下選起來、再點一下取消、點別塊換選、點目的地 → tryDrop 收到 {x, y, tap:true} 一次、選取清掉；
     那一塊正被另一根手指拖著時點目的地不算 */
  {
    const fsrc = extractFunction(src, 'useTapSelect');
    let uts = null;
    /* 切出來驗的那一份必須就是唯一的那一份；而且裡面不可以改掉 tryDrop（codex 第四輪） —— 這是漂移守門，不是對敵意改寫的證明；
       行為由 e2e 的拖拉（每一關都真的拖放）與 broken-Bstale 頁守住 */
    ['useTapSelect', 'end', 'addPiece', 'nearestOpen'].forEach(n => { const c = (src.match(new RegExp('function\\s+' + n + '\\s*\\(', 'g')) || []).length; if (c !== 1) fail('index.html declares function ' + n + '() ' + c + ' times — the checked copy must be the only one'); });
    if (fsrc && /tryDrop\s*=[^=]/.test(fsrc.replace(/^function useTapSelect\(B, tryDrop\)/, ''))) fail('useTapSelect() reassigns tryDrop');
    if (!fsrc) fail('cannot find useTapSelect() in index.html');
    else if (!/\n\s*B\.onDrop = tryDrop;\n\s*\}$/.test(fsrc)) fail('useTapSelect() does not end with `B.onDrop = tryDrop;` — onDrop is not the round\'s own drop handler');
    else { try { uts = new Function('var gSolved = false;\n' + fsrc + '\nreturn useTapSelect;')(); } catch (e){ fail('useTapSelect() could not be evaluated: ' + e.message); } }
    if (uts){
      const cls = () => { const set = new Set(); return { add:c => set.add(c), remove:c => set.delete(c), contains:c => set.has(c) }; };
      const piece = busy => ({ el:{ classList:cls() }, busy:() => busy });
      /* 假的畫板長得和真的一樣（有 el／wrap／k）：不可以靠「有沒有 el」分辨測試和真的畫板（codex 第三輪 #1） */
      const calls = [], Bf = { selected:null, el:{ addEventListener(){}, appendChild(){} }, wrap:{}, k:1, W:300 }, fakeDrop = (P, pt) => { calls.push({ P, pt }); return true; };
      uts(Bf, fakeDrop);
      const A = piece(false), C = piece(false), H = piece(true);
      /* 拖過去放開走的是 B.onDrop：它必須就是這一關的放下判斷本身（codex 第二輪 #1：`B.onDrop = () => false` 會讓所有拖拉都彈回） */
      if (Bf.onDrop !== fakeDrop || typeof Bf.onTap !== 'function' || typeof Bf.onPointTap !== 'function') fail('useTapSelect() does not install onTap / onPointTap, or onDrop is not the round\'s own drop handler');
      else {
        Bf.onTap(A);
        if (Bf.selected !== A || !A.el.classList.contains('sel')) fail('useTapSelect(): tapping a piece does not select it (with an outline)');
        Bf.onTap(A);
        if (Bf.selected !== null || A.el.classList.contains('sel')) fail('useTapSelect(): tapping the selected piece again does not deselect it');
        Bf.onTap(A); Bf.onTap(C);
        if (Bf.selected !== C || A.el.classList.contains('sel')) fail('useTapSelect(): tapping another piece does not move the selection');
        Bf.onPointTap(C, { x:12, y:34 });
        if (calls.length !== 1 || calls[0].P !== C || calls[0].pt.x !== 12 || calls[0].pt.y !== 34 || calls[0].pt.tap !== true) fail('useTapSelect(): tapping a destination does not call the drop once with {x, y, tap:true}');
        if (Bf.selected !== null || C.el.classList.contains('sel')) fail('useTapSelect(): the selection is not cleared after tapping a destination');
        Bf.selected = H; Bf.onPointTap(H, { x:1, y:1 });
        if (calls.length !== 1) fail('useTapSelect(): a destination tap places a piece that another finger is still dragging');
      }
    }
  }
  /* 第一根手指：按下去時已經在拖就不理（不然第二根手指會蓋掉 pid）；換畫板的保險要在 end() 做任何事之前（codex 第一輪 #3） */
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('pointerdown does not ignore a second finger on a piece that is already being dragged');
  /* end() 一開頭只准做「結束這一次拖拉」的收尾，緊接著就是換畫板的保險 —— 整段開頭逐行釘住，
     中間插進任何會動到遊戲的東西（roundMiss、加減分、callback）都會響（codex 第二輪 #2） */
  if (!/^function end\(e, cancelled\)\{\n\s*if \(!start \|\| e\.pointerId !== pid\) return;\n\s*start = null; pid = null;\n\s*document\.removeEventListener\('pointerup', onDocEnd\);\n\s*document\.removeEventListener\('pointercancel', onDocEnd\);\n\s*el\.classList\.remove\('dragging'\);\n\s*if \(gen !== gGen\) return;/.test(extractFunction(src, 'end') || ''))
    fail('end(): the board-generation guard does not come before everything else the release does');
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  LANGS.forEach(L => {
    seq('gPts ' + L, I18N[L].gPts(20), [20]);
    seq('gMinus ' + L, I18N[L].gMinus, [5]);
    if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score');
  });

  /* ================= 第 1 關：轉一轉 ================= */
  {
    const G = D.TURN_G;
    if (G.W !== 300) fail('TURN_G.W is ' + G.W + ', the board is designed for 300');
    if (G.step !== 30 || 360 % G.step) fail('the dial must have 12 steps of 30° (TURN_G.step ' + G.step + ')');
    touch('the turn handle (' + G.knob + ')', G.knob, Math.min(1.5, 289 / G.W));
    /* turnAngleAt：在轉盤上每 1° 一點，量回來要是那個角 */
    for (let a = 0; a < 360; a++){
      const x = G.cx + 60 * Math.cos(a * Math.PI / 180), y = G.cy - 60 * Math.sin(a * Math.PI / 180);
      const g = D.turnAngleAt(x, y);
      if (!(circDiff(g, a) < 1e-6 && g >= 0 && g < 360)){ fail('turnAngleAt() at ' + a + '° returns ' + g); break; }
    }
    /* turnSnap：每 0.25° 一點，吸到的一定是最近的一格（一圈繞回 0） */
    for (let a = 0; a < 360; a += 0.25){
      const s = D.turnSnap(a);
      if (!(s % G.step === 0 && s >= 0 && s < 360 && circDiff(s, a) <= G.step / 2 + 1e-9)){ fail('turnSnap(' + a + ') = ' + s + ', not the nearest 30° step'); break; }
    }
    /* 題庫：三個不一樣的轉法、沒有一整圈、至少一個不是直角的倍數（不能只靠 90／180／270 的標籤） */
    D.GAME_TURN.forEach((ids, i) => {
      const w = 'GAME_TURN[' + i + ']';
      if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3) return fail(w + ': needs 3 different turns');
      ids.forEach(id => {
        const t = D.TURN_TABLE[id], ref = TURNS[id];
        if (!t || !ref) return fail(w + ': ' + id + ' is not a row of the turn table');
        if (t.deg !== ref.deg || FULL * ref.num / ref.den !== ref.deg) fail(w + ': turn ' + id + ' says ' + t.deg + '°, recomputed ' + (FULL * ref.num / ref.den));
        if (!(ref.deg > 0 && ref.deg < FULL)) fail(w + ': a full turn ends where it started — the dial cannot show it');
        if (ref.deg % G.step) fail(w + ': ' + ref.deg + '° is not on a 30° step, the handle can never reach it');
      });
      if (ids.every(id => TURNS[id] && TURNS[id].deg % 90 === 0)) fail(w + ': every turn is a multiple of 90° — the labelled 90/180/270 marks give the answer away');
    });
    /* 畫出來的轉盤：每一個位置都量回來 */
    for (let th = 0; th < 360; th += G.step){
      const s = D.turnSVG(th), w = 'turnSVG(' + th + ')';
      const base = svgLines(s, 'gt-base'), arm = svgLines(s, 'gt-arm'), ticks = svgLines(s, 'gt-tick'), lbls = svgTexts(s, 'gt-lbl'), arc = svgPaths(s, 'gt-arc');
      if (base.length !== 1 || arm.length !== 1){ fail(w + ': expected one fixed side and one turned side'); continue; }
      [base[0], arm[0]].forEach(l => { if (!near(l.x1, G.cx, 0.01) || !near(l.y1, G.cy, 0.01)) fail(w + ': a side does not start at the vertex'); });
      if (circDiff(dirOf(base[0]), 0) > 0.05) fail(w + ': the fixed side points along ' + dirOf(base[0]).toFixed(2) + '°, not 0°');
      if (circDiff(dirOf(arm[0]), th) > 0.05) fail(w + ': the turned side is drawn at ' + dirOf(arm[0]).toFixed(2) + '°, the handle says ' + th + '°');
      if (ticks.length !== 12) fail(w + ': ' + ticks.length + ' ticks, expected 12');
      const tdirs = new Set(ticks.map(l => Math.round(degOfPoint(G.cx, G.cy, l.x1, l.y1)) % 360));
      for (let k = 0; k < 360; k += 30) if (!tdirs.has(k)) fail(w + ': no tick at ' + k + '°');
      if (lbls.length !== 4) fail(w + ': ' + lbls.length + ' labels, expected 0°/90°/180°/270°');
      lbls.forEach(t => {
        const at = Math.round(degOfPoint(G.cx, G.cy, t.x, t.y)) % 360;
        if (t.txt !== at + '°') fail(w + ': the label "' + t.txt + '" sits at ' + at + '°');
        if (!boxIn(textBox(t), G.W, G.H)) fail(w + ': the label "' + t.txt + '" is outside the board');
      });
      if (th === 0 ? arc.length !== 0 : arc.length !== 1) fail(w + ': the green arc should be drawn exactly when the side has turned');
      if (arc.length === 1){
        const A = arcOf(arc[0]);
        if (!A) fail(w + ': cannot read the arc');
        else {
          if (circDiff(degOfPoint(G.cx, G.cy, A.x1, A.y1), 0) > 0.05 || circDiff(degOfPoint(G.cx, G.cy, A.x2, A.y2), th) > 0.05) fail(w + ': the arc does not run from 0° to ' + th + '°');
          if (A.sweep !== 0 || A.large !== (th > 180 ? 1 : 0)) fail(w + ': the arc goes the wrong way round (sweep ' + A.sweep + ', large ' + A.large + ') — it must turn ↺ like example 1');
        }
      }
      ticks.concat(base, arm).forEach(l => { if ([l.x1, l.x2].some(v => v < 0 || v > G.W) || [l.y1, l.y2].some(v => v < 0 || v > G.H)) fail(w + ': a line leaves the board'); });
      const kb = sq(D.polarX(G.cx, th, G.r), D.polarY(G.cy, th, G.r), G.knob);
      if (!boxIn(kb, G.W, G.H)) fail(w + ': the handle at ' + th + '° pokes out of the board');
      const dir = svgTexts(s, 'gt-dir');
      if (dir.length !== 1 || dir[0].txt !== '↺') fail(w + ': the ↺ direction mark is missing');
      else if (boxHit(textBox(dir[0]), kb)) fail(w + ': the ↺ mark is under the handle at ' + th + '°');
    }
    /* 照遊戲的規則玩：轉到每一格按「轉好了」—— 只有該轉的那一格收，其他每一格的說明數字都要對 */
    need('turn', /if \(cur === 0\)\{ roundInfo\(d\.gTurnZero\); return; \}/, 'pressing Done without turning must be a reminder, not a mistake');
    need('turn', /if \(cur !== t\.deg\)\{ roundMiss\(d\.gTurnNo\(name, cur \/ G\.step, cur, t\.den, t\.num, t\.deg\) \+ \(cur === FULL_TURN - t\.deg \? d\.gTurnDir : ''\)\); return; \}/, 'Done does not refuse a wrong turn with its reason (and the ↻-turn note)');
    /* 往 ↻ 轉了剛好那麼多的那一格：轉的量對、方向和這一關的約定相反 —— 那一句不可以帶數字（數字由 gTurnNo 給），要提到兩個方向 */
    LANGS.forEach(L => {
      const t = I18N[L].gTurnDir;
      if (typeof t !== 'string' || !t) fail('gTurnDir missing in ' + L);
      else { if (nums(t).length) fail('gTurnDir ' + L + ' carries numbers: ' + t); if (t.indexOf('↻') < 0 || t.indexOf('↺') < 0) fail('gTurnDir ' + L + ' does not name both directions'); }
    });
    need('turn', /knob\.abort\(\);/, 'Done does not first put back a handle still held by another finger');
    need('turn', /setTurn\(turnSnap\(turnAngleAt\(p\.x, p\.y\)\)\)/, 'dragging the handle does not snap to the 30° steps');
    for (let id = 0; id < 7; id++){
      const ref = TURNS[id];
      LANGS.forEach(L => {
        const d = I18N[L], name = d.turnNames[id];
        for (let p = G.step; p < 360; p += G.step){
          if (p === ref.deg) continue;
          const k = p / G.step;
          seq('gTurnNo ' + L + ' ' + ref.deg + '/' + p, d.gTurnNo(name, k, p, ref.den, ref.num, ref.deg), [k, k, G.step, p, FULL, ref.den, ref.num, FULL, ref.den, ref.num, ref.deg]);
        }
        const ok = d.gTurnOk(name, ref.deg, ref.deg / G.step);
        seq('gTurnOk ' + L + ' ' + ref.deg, ok, [ref.deg, ref.deg / G.step]);
        has('gTurnOk ' + L, ok.toLowerCase(), name.toLowerCase());
        seq('gTurn2 ' + L + ' ' + ref.deg, d.gTurn2(name, ref.den, ref.num, ref.deg, ref.deg / G.step), L === 'zh' ? [2, FULL, ref.den, ref.num, ref.deg, 0, ref.deg / G.step] : [2, FULL, ref.den, ref.num, ref.deg, ref.deg / G.step, 0]);
        seq('gTurnAsk ' + L, d.gTurnAsk(name, 2, 3), [2, 3]);
      });
    }
  }

  /* ================= 第 2、3 關共用：量角器 ================= */
  const G = D.PROT_G;
  const KP = Math.min(1.5, 289 / G.W);
  {
    if (G.rowY.length !== 2) fail('PROT_G.rowY should hold 2 rows');
    /* 第 1 列最低的東西（珠子、標籤）要在第 2 列最高的東西（另一條邊的尾巴）上面 */
    const low0 = Math.max(G.rowY[0] + G.bead / 2, G.rowY[0] + G.badgeDy + G.badgeH), top1 = G.rowY[1] - Math.max(G.arm, G.r + G.bandOut);
    if (!(low0 < top1)) fail('the two protractor rows overlap (' + low0 + ' vs ' + top1 + ')');
    if (!(G.rowY[1] + Math.max(G.bead / 2, G.badgeDy + G.badgeH) <= G.H)) fail('the second row pokes out of the bottom of the board');
    if (!(G.rowY[0] - G.arm >= 0)) fail('the first row\'s side pokes out of the top of the board');
    touch('a bead (' + G.bead + ')', G.bead, KP);
    touch('the ✏️ dot (' + G.dot + ')', G.dot, KP);
    /* 珠子在 0～180 每一個位置都在畫板裡 */
    G.rowY.forEach(cy => { for (let th = 0; th <= 180; th += 1){ if (!boxIn(sq(G.cx + G.r * Math.cos(th * Math.PI / 180), cy - G.r * Math.sin(th * Math.PI / 180), G.bead), G.W, G.H)){ fail('a bead at ' + th + '° pokes out of the board'); break; } } });
    if (!(D.beadStart('in') === 0 && D.beadStart('out') === 180)) fail('the beads do not start at the two ends (in ' + D.beadStart('in') + ', out ' + D.beadStart('out') + ')');
    /* 每一顆珠子出發的地方，正好是它那一排的 0 */
    if (labelRef(D.beadStart('in'), 'inner') !== 0 || labelRef(D.beadStart('out'), 'outer') !== 0) fail('a bead does not start at the 0 of its own row');
    ['right', 'left'].forEach(from => {
      const k = D.beadOf(from), row = k === 'in' ? 'inner' : 'outer';
      if (labelRef(baseRef(from), row) !== 0) fail('beadOf(' + from + ') = ' + k + ', but that row\'s 0 is not on the ' + from + ' side');
    });
    /* beadAngle：上半圈就是那個角；手指跑到底線下面，停在比較近的那一端 */
    G.rowY.forEach(cy => {
      for (let x = 0; x <= G.W; x += 4) for (let y = cy - 160; y <= cy + 60; y += 4){
        const g = D.beadAngle(cy, x, y), raw = Math.atan2(cy - y, x - G.cx) * 180 / Math.PI;
        const want = raw < 0 ? (x < G.cx ? 180 : 0) : raw;
        if (!(Math.abs(g - want) < 1e-9 && g >= 0 && g <= 180)) return fail('beadAngle(' + x + ',' + y + ') = ' + g + ', expected ' + want);
      }
    });
    if (!(G.near > 0 && G.near < 15)) fail('PROT_G.near = ' + G.near + ' — a bead would count as arriving far from the side');
    /* 量角器畫出來的樣子（兩種擺法、每一個會出現的角都量） */
    const measure = (o, w, deg) => {
      const s = D.gSvgOpen ? D.gSvgOpen(G.W, G.H) + D.protSVG(o) + '</svg>' : D.protSVG(o);
      const base = svgLines(s, 'gp-base'), ticks = svgLines(s, 'gp-tick'), outs = svgTexts(s, 'gp-out'), ins = svgTexts(s, 'gp-in');
      if (base.length !== 1) return fail(w + ': expected one bottom side');
      if (!near(base[0].x1, G.cx, 0.01) || !near(base[0].y1, o.cy, 0.01) || circDiff(dirOf(base[0]), baseRef(o.from)) > 0.05) fail(w + ': the bottom side is not drawn from the vertex towards the ' + o.from);
      if (ticks.length !== 37) fail(w + ': ' + ticks.length + ' ticks, expected 37');
      ticks.forEach(l => { const a = degOfPoint(G.cx, o.cy, l.x1, l.y1), b = degOfPoint(G.cx, o.cy, l.x2, l.y2); if (Math.abs(a / 5 - Math.round(a / 5)) > 0.01 || circDiff(a, b) > 0.01 || (a > 180.01 && a < 359.99)) fail(w + ': a tick at ' + a.toFixed(2) + '°'); });
      if (outs.length !== 19 || ins.length !== 19) fail(w + ': each row needs 19 numbers (0~180 every 10)');
      const read = (list, row) => list.forEach(t => {
        const at = degOfPoint(G.cx, o.cy, t.x, t.y), u = Math.round(at / 10) * 10;
        if (Math.abs(at - u) > 0.05 && !(u === 180 && at > 179.9) && !(u === 0 && at > 359.9)) fail(w + ': a ' + row + ' number sits at ' + at.toFixed(2) + '°');
        if (String(labelRef(u % 360 === 0 && at > 180 ? 0 : u, row)) !== t.txt) fail(w + ': the ' + row + ' number at ' + u + '° says ' + t.txt + ', expected ' + labelRef(u, row));
        if (!boxIn(textBox(t), G.W, G.H)) fail(w + ': the ' + row + ' number ' + t.txt + ' leaves the board');
      });
      read(outs, 'outer'); read(ins, 'inner');
      /* 同一排、兩排之間的數字字形都不可以疊在一起（量字形本身：白邊互相蓋住不算） */
      const glyph = t => { const gw = String(t.txt).length * t.size * 0.6; return { x:t.x - gw / 2, y:t.y - t.size * 0.375, w:gw, h:t.size * 0.75 }; };   /* 實測：數字每個字 0.6 字寬（Chrome、PingFang），字身約 0.75 字高 */
      const allL = outs.concat(ins);
      for (let i = 0; i < allL.length; i++) for (let j = i + 1; j < allL.length; j++) if (boxHit(glyph(allL[i]), glyph(allL[j]))){ fail(w + ': numbers ' + allL[i].txt + ' and ' + allL[j].txt + ' overlap'); break; }
      if (o.arm !== null){
        const arm = svgLines(s, o.armCls);
        if (arm.length !== 1) return fail(w + ': expected one other side (' + o.armCls + ')');
        if (!near(arm[0].x1, G.cx, 0.01) || !near(arm[0].y1, o.cy, 0.01)) fail(w + ': the other side does not start at the vertex');
        /* 最關鍵的一條：畫出來的兩條邊之間真正的夾角，就是題目的度數 */
        const got = angleBetween(dirOf(base[0]), dirOf(arm[0]));
        if (Math.abs(got - deg) > 0.05) fail(w + ': the drawn angle is ' + got.toFixed(2) + '°, the game says ' + deg + '°');
        /* 從畫出來的數字讀：對準底邊的那一個 0 那一排，在另一條邊上寫的就是度數；另一排寫的是 180 − 度數 */
        const at = Math.round(dirOf(arm[0]));
        const zeroRow = [['outer', outs], ['inner', ins]].filter(p => p[1].some(t => t.txt === '0' && circDiff(degOfPoint(G.cx, o.cy, t.x, t.y), baseRef(o.from)) < 0.1))[0];
        if (!zeroRow) fail(w + ': no row has its 0 on the bottom side');
        else {
          const onArm = zeroRow[1].filter(t => circDiff(degOfPoint(G.cx, o.cy, t.x, t.y), at) < 0.1)[0];
          if (at % 10 === 0 && (!onArm || +onArm.txt !== deg)) fail(w + ': the row whose 0 is on the bottom side reads ' + (onArm ? onArm.txt : 'nothing') + ' at the other side, not ' + deg);
          if ((zeroRow[0] === 'inner' ? 'in' : 'out') !== D.beadOf(o.from)) fail(w + ': the bead that counts along the row with the 0 on the side is not beadOf(' + o.from + ')');
        }
        [arm[0], base[0]].forEach(l => { if ([l.x1, l.x2].some(v => v < 0 || v > G.W) || [l.y1, l.y2].some(v => v < 0 || v > G.H)) fail(w + ': a side leaves the board'); });
      }
      if (o.ans !== null){
        const t = svgTexts(s, 'gp-ans'), A = arcOf(svgPaths(s, 'gp-ansarc')[0] || '');
        if (t.length !== 1 || t[0].txt !== o.ans + '°') fail(w + ': the answer label should say ' + o.ans + '°');
        if (!A || circDiff(degOfPoint(G.cx, o.cy, A.x1, A.y1), baseRef(o.from)) > 0.05 || circDiff(degOfPoint(G.cx, o.cy, A.x2, A.y2), o.arm) > 0.05)
          fail(w + ': the answer arc does not run from the bottom side to the other side');
      }
      return s;
    };
    const items = D.GAME_READ.concat(D.GAME_DRAW);
    items.forEach((pair, pi) => (pair || []).forEach((it, i) => {
      const cy = G.rowY[i], arm = D.armDeg(it.deg, it.from);
      if (arm !== armRef(it.deg, it.from)) fail('armDeg(' + it.deg + ', ' + it.from + ') = ' + arm + ', recomputed ' + armRef(it.deg, it.from));
      measure({ cy, from:it.from, arm, armCls:'gp-arm', ans:null, trails:[] }, 'protractor ' + pi + '/' + i + ' (' + it.deg + '°, 0 on the ' + it.from + ')', it.deg);
      measure({ cy, from:it.from, arm, armCls:'gp-drawn', ans:it.deg, trails:[] }, 'finished protractor ' + it.deg + '°', it.deg);
      /* 珠子走過的那一段：從自己的 0 沿著外緣到珠子 */
      ['in', 'out'].forEach(k => {
        const s = D.protSVG({ cy, from:it.from, arm, armCls:'gp-arm', ans:null, trails:[{ k, th:arm }] }), A = arcOf(svgPaths(s, 'gp-trail')[0] || '');
        if (!A || !near(A.r, G.r, 0.01) || circDiff(degOfPoint(G.cx, cy, A.x1, A.y1), D.beadStart(k)) > 0.05 || circDiff(degOfPoint(G.cx, cy, A.x2, A.y2), arm) > 0.05)
          fail('the ' + k + ' bead\'s trail does not run along the rim from its 0 to the bead');
      });
    }));
    const pools = [['GAME_READ', D.GAME_READ], ['GAME_DRAW', D.GAME_DRAW]];
    pools.forEach(([name, pool]) => pool.forEach((pair, i) => {
      const w = name + '[' + i + ']';
      if (!Array.isArray(pair) || pair.length !== 2) return fail(w + ': needs exactly 2 angles');
      if (pair.map(p => p.from).sort().join() !== 'left,right') fail(w + ': needs one angle with the 0 on the right and one on the left');
      if (!pair.some(p => p.deg < RIGHT) || !pair.some(p => p.deg > RIGHT)) fail(w + ': needs one acute and one obtuse angle');
      pair.forEach(p => {
        if (!(Number.isInteger(p.deg) && p.deg % 5 === 0 && p.deg >= 20 && p.deg <= 160)) fail(w + ': ' + p.deg + '° is not a multiple of 5 between 20 and 160');
        /* 90° 時兩排讀數一樣（讀錯排也對）；離 90° 太近，兩排的那一格又分不太出來 */
        if (Math.abs(p.deg - RIGHT) < 15) fail(w + ': ' + p.deg + '° is within 15° of a right angle — the two rows nearly agree there');
      });
      if (name === 'GAME_DRAW' && pair.every(p => p.deg % 10 === 0)) fail(w + ': every angle is on a printed number — nothing asks the child to find a 5° mark between two numbers');
    }));
  }

  /* ================= 第 2 關：量一量 ================= */
  {
    need('read', /if \(r\.done \|\| Math\.abs\(P\.data\.th - r\.arm\) > G\.near\)\{ setBead\(r, P, home\); return; \}/, 'a bead stopped away from the other side must go back silently');
    need('read', /if \(k !== beadOf\(r\.it\.from\)\)\{\n\s*setBead\(r, P, home\);\n\s*roundMiss\(d\.gReadNo\(endWord\(k === 'in' \? 'right' : 'left'\), labelAt\(r\.arm, k === 'in' \? 'inner' : 'outer'\), endWord\(r\.it\.from\)\)\);/,
      'the bead from the 0 that is not on a side is not refused with what it counts to');
    need('read', /move: function\(p\)\{ setBead\(r, P, beadAngle\(r\.cy, p\.x, p\.y\)\); \}/, 'a bead does not follow the finger along the rim');
    need('read', /if \(!pt\.tap \|\| r\.done \|\| !onArm\(r, pt\)\) return false;/, 'tap-then-tap must take the bead to the other side of ITS OWN angle only');
    /* 照規則玩：每一題，正確的珠子（beadOf）收；另一顆到了另一條邊，數到的是它那一排在那裡的數字 —— 一定是 180 − 度數 */
    D.GAME_READ.forEach(pair => pair.forEach(it => {
      const arm = armRef(it.deg, it.from), good = D.beadOf(it.from), bad = good === 'in' ? 'out' : 'in';
      if (readingRef(it.deg, it.from) !== labelRef(arm, good === 'in' ? 'inner' : 'outer')) fail('read ' + it.deg + ': the right bead does not count to ' + it.deg);
      const got = labelRef(arm, bad === 'in' ? 'inner' : 'outer');
      if (got !== STRAIGHT - it.deg) fail('read ' + it.deg + ': the wrong bead counts to ' + got + ', expected ' + (STRAIGHT - it.deg));
      if (Math.min(arm, 180 - arm) <= G.near) fail('read ' + it.deg + ': the other side is within ' + G.near + '° of a bead\'s start');
      LANGS.forEach(L => {
        const d = I18N[L];
        const sideOf = k => d.gEnd[k === 'in' ? 'right' : 'left'];
        const no = d.gReadNo(sideOf(bad), got, d.gEnd[it.from]);
        seq('gReadNo ' + L + ' ' + it.deg, no, [0, 0, got, 0]);
        has('gReadNo ' + L, no, sideOf(bad)); has('gReadNo ' + L, no, d.gEnd[it.from]);
        const row = scaleRef(it.from) === 'inner' ? d.scaleInner : d.scaleOuter;
        const ok = d.gReadOk(d.gEnd[it.from], row, it.deg);
        seq('gReadOk ' + L + ' ' + it.deg, ok, [0, it.deg]); has('gReadOk ' + L, ok, row);
        const h2 = d.gRead2(d.gEnd[it.from], row);
        has('gRead2 ' + L, h2, d.gEnd[it.from]); has('gRead2 ' + L, h2, row);
        /* 第二層提示說的珠子，就是對的那一顆 */
        if (sideOf(good) !== d.gEnd[it.from]) fail('gRead2 ' + L + ': the hint names the ' + d.gEnd[it.from] + ' bead, but the right bead starts on the ' + sideOf(good));
      });
    }));
    LANGS.forEach(L => seq('gReadNow ' + L, I18N[L].gReadNow(1, 2), [1, 2]));
  }

  /* ================= 第 3 關：畫一畫 ================= */
  {
    need('draw', /if \(th === armDeg\(r\.it\.deg, otherSide\(r\.it\.from\)\)\)\n\s*roundMiss\(d\.gDrawRow\(r\.it\.deg, endWord\(otherSide\(r\.it\.from\)\), endWord\(r\.it\.from\), row, STRAIGHT_DEG - r\.it\.deg\)\);\n\s*else roundMiss\(d\.gDrawNo\(labelAt\(th, scaleOf\(r\.it\.from\)\), r\.it\.deg, row\)\);/,
      'a dot on a wrong mark is not refused with its reason');
    need('draw', /if \(th !== r\.want\)\{/, 'the dot is accepted on a mark other than the asked angle');
    need('draw', /rows\.forEach\(function\(r\)\{ if \(!hit && !r\.done\)\{ var th = drawPick\(r\.cy, x, y\); if \(th !== null\) hit = \{ r:r, th:th \}; \} \}\);/, 'a dot off the protractor (or on a finished one) must go back silently; drag and tap must both use drawPick()');
    /* 驗證者第一輪：一邊拖一邊吸，放開判斷的就是畫面上那一格。⚠️ 這裡只守原始碼的形狀與純幾何（codex 第五輪：這不是行為測試）；
       拖拉的行為（拖到刻度旁 ±35% 格距、手指抓偏 7px、拿著點經過印出來的數字、第二根手指、capture 遺失）在
       teaching-workspace/game-harness/g4-angle/body.js 的合成 PointerEvent 測試裡跑，broken-Bsnap.html（只在放開時才吸）8/8 被抓到。 */
    need('draw', /move: function\(p, fx, fy\)\{\n\s*var h = hitAt\(fx, fy\);\n\s*aim = h;\n\s*if \(h\) P\.place\(polarX\(G\.cx, h\.th, G\.markR\), polarY\(h\.r\.cy, h\.th, G\.markR\)\);\n\s*else P\.place\(fx, fy\);\n\s*draw\(\);/,
      'the ✏️ dot does not snap to the mark WHILE it is dragged (it must sit on the mark it will be judged on)');
    need('draw', /release: function\(\)\{ var h = aim; aim = null; if \(!\(h && judge\(P, h\)\)\) P\.home\(\); draw\(\); \}/, 'releasing the dot does not judge exactly the mark it was shown on');
    need('draw', /arm:\(aim && aim\.r === r\) \? aim\.th : null, armCls:'gp-aim'/, 'the side is not drawn live to the mark the dot is on');
    need('draw', /var h = hitAt\(pt\.x, pt\.y\);\n\s*return h \? judge\(P, h\) : false;/, 'tap-then-tap does not judge the tapped number / tick (drawPick)');
    /* 驗證者第二輪：點在印出來的數字上，判斷的就是那個數字的那一格。數字的方框從頁面自己畫的 <text> 量（中心、字數、字級），不是讀 protNumbers 的資料 */
    G.rowY.forEach(cy => {
      const s = D.protSVG({ cy, from:'right', arm:null, ans:null, trails:[] });
      const drawn = svgTexts(s, 'gp-out').map(t => Object.assign(t, { row:'outer' })).concat(svgTexts(s, 'gp-in').map(t => Object.assign(t, { row:'inner' })));
      const boxes = drawn.map(t => {
        const f = t.row === 'outer' ? G.fontOut : G.fontIn, at = degOfPoint(G.cx, cy, t.x, t.y), u = Math.round((at > 359 ? 0 : at) / 10) * 10;
        return { t, u, f, w:t.txt.length * f * 0.6 + 2 * G.numPad, up:f * 0.75 + G.numPad, down:f * 0.65 + G.numPad };
      });
      const pn = D.protNumbers(cy);
      if (pn.length !== boxes.length) fail('protNumbers() lists ' + pn.length + ' numbers, the protractor draws ' + boxes.length);
      pn.forEach(n => { const b = boxes.filter(q => q.t.row === n.row && q.u === n.u)[0]; if (!b || Math.abs(b.t.x - n.x) > 0.02 || Math.abs(b.t.y - n.y) > 0.02 || b.t.txt !== String(n.v) || Math.abs(b.w - n.w) > 0.01 || Math.abs(b.up - n.up) > 0.01 || Math.abs(b.down - n.down) > 0.01) fail('protNumbers(): the box for ' + n.row + ' ' + n.v + ' is not where/what the protractor draws');
        /* 位置一致（上一行驗過，差 ≤ 0.02）之後改用不經四捨五入的座標，免得兩個方框幾乎一樣近時因為字串的兩位小數翻過去 */
        else { b.t.x = n.x; b.t.y = n.y; } });
      /* 方框 ＝ 字的外框（Chrome 實測：往上 0.75、往下 0.65 字高）＋ numPad —— 驗證者第二輪的探針點的是外框邊內 1px */
      const inBox = (b, x, y) => Math.abs(x - b.t.x) <= b.w / 2 && y >= b.t.y - b.up && y <= b.t.y + b.down;
      /* 方框放寬之後，頂上幾個三位數的方框會和隔壁重疊（字形本身不重疊，另一條檢查守著）：重疊的地方挑中心比較近的 —— 下面逐點驗。
         但不可以重疊到蓋住隔壁的字：每一個字的中心一定只屬於自己 */
      /* 第二套實作：字本身（不放寬）→ 刻度（固定 3px，不讀頁面的常數）→ 放寬的方框（先比到字的距離、再比中心）→ 最近的 5° */
      const TOL = 3;
      const glyphD = (b, x, y) => { const gx = Math.max(0, Math.abs(x - b.t.x) - (b.w / 2 - G.numPad)), gy = Math.max(0, (b.t.y - (b.up - G.numPad)) - y, y - (b.t.y + (b.down - G.numPad))); return Math.hypot(gx, gy); };
      const tickAt = (x, y) => { const p = D.protPolar(cy, x, y); let best = null, bd = Infinity; for (let t = 0; t <= 180; t += 5){ const a = (p.th - t) * Math.PI / 180, len = t % 10 ? G.t5 : G.t10, al = p.r * Math.cos(a), pp = Math.abs(p.r * Math.sin(a)); if (al >= G.r - len - TOL && al <= G.r + TOL && pp <= TOL && pp < bd){ bd = pp; best = t; } } return best; };
      const expectPick = (x, y) => {
        const own = boxes.filter(q => inBox(q, x, y)).sort((p1, p2) => (glyphD(p1, x, y) - glyphD(p2, x, y)) || (Math.hypot(x - p1.t.x, y - p1.t.y) - Math.hypot(x - p2.t.x, y - p2.t.y)));
        if (own.length && glyphD(own[0], x, y) === 0) return own[0].u;
        const tk = tickAt(x, y); if (tk !== null) return tk;
        if (own.length) return own[0].u;
        return D.drawSnap(cy, x, y);
      };
      if (G.numPad !== 0.5 || G.tickTol !== 3 || G.tapMinR !== 6) fail('drawPick constants changed (numPad ' + G.numPad + ', tickTol ' + G.tickTol + ', tapMinR ' + G.tapMinR + ') — the tap targets were verified for 0.5 / 3 / 6');
      let bad = 0;
      boxes.forEach(b => {
        /* 每一個字的中心、方框 ±35% 的點：一定是這個數字的那一格（被另一個方框蓋住的點，挑中心比較近的） */
        const cw = b.w - 2 * G.numPad, pts = [];
        for (let i = 0; i < b.t.txt.length; i++) pts.push([b.t.x - cw / 2 + (i + 0.5) * cw / b.t.txt.length, b.t.y]);
        const bh = b.up + b.down, bc = b.t.y + (b.down - b.up) / 2;
        [[-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35], [-0.35, -0.35], [0.35, 0.35], [-0.35, 0.35], [0.35, -0.35]].forEach(k => pts.push([b.t.x + k[0] * b.w, bc + k[1] * bh]));
        for (let x = b.t.x - b.w / 2 + 0.02; x <= b.t.x + b.w / 2 - 0.02; x += 0.5) for (let y = b.t.y - b.up + 0.02; y <= b.t.y + b.down - 0.02; y += 0.5) pts.push([x, y]);
        for (let i = 0; i < b.t.txt.length; i++){
          const x = pts[i][0], y = pts[i][1];
          if (D.drawPick(cy, x, y) !== b.u && bad++ < 3) fail('a tap on the centre of the digit "' + b.t.txt[i] + '" of the printed ' + b.t.row + ' "' + b.t.txt + '" picks ' + D.drawPick(cy, x, y) + '°, not ' + b.u + '°');
        }
        pts.forEach(([x, y]) => {
          const want = expectPick(x, y), got = D.drawPick(cy, x, y);
          if (got !== want && bad++ < 3) fail('a tap at (' + x.toFixed(1) + ',' + y.toFixed(1) + ') on the printed ' + b.t.row + ' "' + b.t.txt + '" picks the ' + got + '° mark, not ' + want + '°');
        });
      });
      /* 刻度：點在每一根刻度上（不在數字方框裡的那幾點）就是那一根 */
      svgLines(s, 'gp-tick').forEach(l => {
        const t0 = degOfPoint(G.cx, cy, l.x1, l.y1), t = t0 > 359 ? 0 : Math.round(t0 / 5) * 5;
        [0, 0.5, 1].forEach(q => { const x = l.x1 + (l.x2 - l.x1) * q, y = l.y1 + (l.y2 - l.y1) * q; if (!boxes.some(b => glyphD(b, x, y) === 0 && inBox(b, x, y)) && D.drawPick(cy, x, y) !== t && bad++ < 3) fail('a tap on the ' + t + '° tick picks ' + D.drawPick(cy, x, y)); });
      });
      /* 其他地方：和放開時一樣吸到最近的 5° */
      /* 刻度那一圈：離一根刻度不到 35% 格距的點（拖、點都一樣）一定是那一根 —— 數字的放寬框不可以伸過來搶（e2e 在手機上抓到 numPad 1.5 時會搶） */
      for (let t = 0; t <= 180; t += 5) for (let k = -0.35; k <= 0.351; k += 0.07) for (let rr = G.r - G.t5; rr <= G.r; rr += 1){
        const x = G.cx + rr * Math.cos((t + k * 5) * Math.PI / 180), y = cy - rr * Math.sin((t + k * 5) * Math.PI / 180);
        if (boxes.some(q => glyphD(q, x, y) === 0 && inBox(q, x, y)) || t + k * 5 < 0 || t + k * 5 > 180) continue;
        const got = D.drawPick(cy, x, y);
        if (got !== t && bad++ < 3) fail('a point ' + Math.round(k * 100) + '% of a mark beside the ' + t + '° tick (r ' + rr + ') picks ' + got + '° — a number\'s tap box reaches over the ticks');
      }
      /* 整張畫板每 1px：和第二套實作一樣（含「離數字、刻度都遠 → 最近的 5° 或什麼都不是」） */
      for (let x = 0; x <= G.W; x += 1) for (let y = cy - 160; y <= cy + 20; y += 1){
        const w2 = expectPick(x, y), g2 = D.drawPick(cy, x, y);
        if (w2 !== g2 && bad++ < 3) fail('a tap at (' + x + ',' + y + ') picks ' + g2 + ', expected ' + w2);
      }
    });
    if (!(G.tapMinR > 0 && G.tapMinR <= 10)) fail('read: a tap on the other side near the vertex is ignored (tapMinR ' + G.tapMinR + ')');
    need('read', /return Math\.hypot\(vx, vy\) >= G\.tapMinR && along > 0 && along <= G\.arm \+ G\.tapTol && perp <= G\.tapTol && toArm < toBase;/, 'a tap near the vertex must go to the other side only when it is closer to it than to the bottom side');
    if (!/if \(o\.rotor\) o\.rotor\.move\(p, orig\.x \+ dx, orig\.y \+ dy\);/.test(src)) fail('the drag engine does not tell a rotor where the piece would be (the ✏️ dot cannot follow the finger off the rim)');
    /* 畫面上的點就是判斷的那一格：點停的位置（markR）再吸一次，一定吸回同一格；預覽的虛線邊畫在那一格 */
    G.rowY.forEach(cy => {
      for (let th = 0; th <= 180; th += 5){
        const x = D.polarX(G.cx, th, G.markR), y = D.polarY(cy, th, G.markR);
        if (D.drawPick(cy, x, y) !== th){ fail('a dot shown on the ' + th + '° mark would be judged as ' + D.drawPick(cy, x, y)); break; }
        const s = D.protSVG({ cy, from:'right', arm:th, armCls:'gp-aim', ans:null, trails:[] }), aimL = svgLines(s, 'gp-aim');
        if (aimL.length !== 1 || circDiff(degOfPoint(G.cx, cy, aimL[0].x2, aimL[0].y2), th) > 0.05){ fail('the live side for the ' + th + '° mark is not drawn at ' + th + '°'); break; }
        if (!/class="gp-aim"[^>]*stroke-dasharray/.test(s)){ fail('the live side is not dashed (it must look different from a drawn side)'); break; }
      }
    });
    /* drawSnap：第二套實作，掃整張畫板每 1px */
    const ref = (cy, x, y) => {
      const r = Math.hypot(x - G.cx, y - cy);
      if (r < G.r - G.bandIn || r > G.r + G.bandOut || y - cy > G.bandBelow) return null;
      let th = Math.atan2(cy - y, x - G.cx) * 180 / Math.PI;
      th = th < -90 ? 180 : Math.max(0, Math.min(180, th));
      return Math.round(th / 5) * 5;
    };
    let bad = 0, both = 0;
    for (let x = 0; x <= G.W; x += 1) for (let y = 0; y <= G.H; y += 1){
      const a = D.drawSnap(G.rowY[0], x, y), b = D.drawSnap(G.rowY[1], x, y);
      if (a !== ref(G.rowY[0], x, y) || b !== ref(G.rowY[1], x, y)){ if (bad++ < 3) fail('drawSnap at (' + x + ',' + y + ') = ' + a + '/' + b + ', expected ' + ref(G.rowY[0], x, y) + '/' + ref(G.rowY[1], x, y)); }
      if (a !== null && b !== null) both++;
    }
    if (both) fail(both + ' points of the board count as being on BOTH protractors');
    /* 自然的動作：把點放在畫出來的刻度或數字上，就是那一格（BRIEF：接受範圍要蓋住孩子看到的目標） */
    G.rowY.forEach(cy => {
      const s = D.protSVG({ cy, from:'right', arm:null, ans:null, trails:[] });
      svgLines(s, 'gp-tick').forEach(l => {
        const a0 = degOfPoint(G.cx, cy, l.x1, l.y1), want = a0 > 359 ? 0 : Math.round(a0 / 5) * 5;
        [[l.x1, l.y1], [l.x2, l.y2]].forEach(p => { if (D.drawSnap(cy, p[0], p[1]) !== want) fail('a dot on the tick at ' + want + '° snaps to ' + D.drawSnap(cy, p[0], p[1])); });
      });
      svgTexts(s, 'gp-in').concat(svgTexts(s, 'gp-out')).forEach(t => {
        const want = Math.round(degOfPoint(G.cx, cy, t.x, t.y) / 10) * 10 % 360;
        const got = D.drawSnap(cy, t.x, t.y);
        if (got !== (want === 0 && t.x < G.cx ? 180 : want)) fail('a dot dropped on the printed number ' + t.txt + ' (at ' + want + '°) snaps to ' + got + ' — the drop zone does not cover what the child sees');
      });
    });
    if (D.drawSnap(G.rowY[0], G.dotX, G.dotY) !== null || D.drawSnap(G.rowY[1], G.dotX, G.dotY) !== null) fail('the ✏️ dot\'s home is on a protractor');
    const dotBox = sq(G.dotX, G.dotY, G.dot);
    if (!boxIn(dotBox, G.W, G.H)) fail('the ✏️ dot\'s home pokes out of the board');
    G.rowY.forEach(cy => {
      const bd = { x:G.cx - G.badgeW / 2, y:cy + G.badgeDy, w:G.badgeW, h:G.badgeH };
      if (!boxIn(bd, G.W, G.H)) fail('a "draw" badge leaves the board');
      if (boxHit(bd, dotBox)) fail('a "draw" badge is under the ✏️ dot');
      if (!(G.badgeDy > 2)) fail('the "draw" badge touches the bottom side');
      for (let th = 0; th <= 180; th += 5) if (!boxIn(sq(D.polarX(G.cx, th, G.markR), D.polarY(cy, th, G.markR), G.dot), G.W, G.H)){ fail('a dot placed at ' + th + '° pokes out of the board'); break; }
    });
    /* 照規則玩：每一格放一次 */
    D.GAME_DRAW.forEach(pair => pair.forEach(it => {
      const want = armRef(it.deg, it.from), wrongRow = armRef(it.deg, it.from === 'right' ? 'left' : 'right');
      const myRow = scaleRef(it.from), other = myRow === 'inner' ? 'outer' : 'inner';
      if (labelRef(want, myRow) !== it.deg) fail('draw ' + it.deg + ': the mark the game wants does not read ' + it.deg + ' on the row with the 0 on the side');
      if (labelRef(wrongRow, other) !== it.deg) fail('draw ' + it.deg + ': the "other row" mark does not read ' + it.deg + ' on the other row');
      if (angleBetween(baseRef(it.from), wrongRow) !== STRAIGHT - it.deg) fail('draw ' + it.deg + ': a dot on the other row would not draw ' + (STRAIGHT - it.deg) + '°');
      LANGS.forEach(L => {
        const d = I18N[L], row = myRow === 'inner' ? d.scaleInner : d.scaleOuter, oth = d.gEnd[it.from === 'right' ? 'left' : 'right'];
        const m = d.gDrawRow(it.deg, oth, d.gEnd[it.from], row, STRAIGHT - it.deg);
        seq('gDrawRow ' + L + ' ' + it.deg, m, [it.deg, 0, 0, STRAIGHT - it.deg]);
        has('gDrawRow ' + L, m, row); has('gDrawRow ' + L, m, oth);
        for (let th = 0; th <= 180; th += 5){
          if (th === want || th === wrongRow) continue;
          const v = labelRef(th, myRow);
          if (v === it.deg) fail('draw ' + it.deg + ': mark ' + th + '° also reads ' + it.deg + ' — two right answers');
          seq('gDrawNo ' + L + ' ' + it.deg + '@' + th, d.gDrawNo(v, it.deg, row), [v, it.deg]);
        }
        seq('gDrawOk ' + L + ' ' + it.deg, d.gDrawOk(it.deg, d.gEnd[it.from], row), [0, it.deg, it.deg]);
        seq('gDraw2 ' + L + ' ' + it.deg, d.gDraw2(it.deg, d.gEnd[it.from], row, STRAIGHT - it.deg), [2, it.deg, 0, it.deg, STRAIGHT - it.deg]);
        seq('gDrawBadge ' + L, d.gDrawBadge(it.deg), [it.deg]);
      });
    }));
  }

  /* ================= 第 4 關：分一分 ================= */
  {
    const K = D.KIND_G;
    touch('an angle card (' + K.card + ')', K.card, Math.min(1.5, 289 / K.W));
    const bins = [0, 1, 2, 3].map(i => ({ x:D.kindBinX(i), y:K.binY, w:K.binW, h:K.binH }));
    bins.forEach((b, i) => { if (!boxIn(b, K.W, K.H)) fail('bin ' + i + ' leaves the board'); if (i && boxHit(bins[i - 1], b)) fail('bins ' + (i - 1) + ' and ' + i + ' overlap'); });
    const cards = K.tray.map(p => sq(p[0], p[1], K.card));
    if (cards.length !== 5) fail('the tray has ' + cards.length + ' places, expected 5');
    cards.forEach((c, i) => {
      if (!boxIn(c, K.W, K.H)) fail('tray place ' + i + ' leaves the board');
      cards.forEach((c2, j) => { if (j > i && boxHit(c, c2)) fail('tray places ' + i + ' and ' + j + ' overlap'); });
      bins.forEach((b, j) => { const pb = { x:b.x - D.GAME_PAD, y:b.y - D.GAME_PAD, w:b.w + 2 * D.GAME_PAD, h:b.h + 2 * D.GAME_PAD }; if (boxHit(c, pb)) fail('tray place ' + i + ' is inside the drop zone of bin ' + j + ' — releasing it unmoved would sort it'); });
    });
    [0, 1, 2, 3].forEach(i => {
      const lbl = { x:D.kindBinX(i), y:K.binY + 2, w:K.binW, h:K.lblH };
      [0, 1].forEach(j => {
        const s = D.kindSlot(i, j), c = sq(s.x, s.y, K.card);
        if (!(c.x >= bins[i].x && c.y >= bins[i].y && c.x + c.w <= bins[i].x + bins[i].w && c.y + c.h <= bins[i].y + bins[i].h)) fail('slot ' + j + ' of bin ' + i + ' is not inside the bin');
        if (boxHit(c, lbl)) fail('slot ' + j + ' of bin ' + i + ' covers the bin\'s name');
        if (j && boxHit(c, sq(D.kindSlot(i, 0).x, D.kindSlot(i, 0).y, K.card))) fail('the two slots of bin ' + i + ' overlap');
      });
    });
    if (!Array.isArray(D.KIND_ORDER) || D.KIND_ORDER.join() !== 'acute,right,obtuse,straight') fail('the bins must run acute, right, obtuse, straight');
    const allDegs = new Set();
    D.GAME_KIND.forEach((set, i) => {
      const w = 'GAME_KIND[' + i + ']';
      if (!Array.isArray(set) || set.length !== 5 || new Set(set).size !== 5) return fail(w + ': needs 5 different cards');
      const cnt = { acute:0, right:0, obtuse:0, straight:0 };
      set.forEach(v => { allDegs.add(v); const k = kindRef(v); if (!k || !Number.isInteger(v)) fail(w + ': ' + v + ' is not a whole angle between 1 and 180'); else cnt[k]++; });
      Object.keys(cnt).forEach(k => { if (cnt[k] < 1) fail(w + ': no ' + k + ' card'); if (cnt[k] > 2) fail(w + ': ' + cnt[k] + ' ' + k + ' cards — a bin holds only 2'); });
      if (!set.some(v => v !== RIGHT && v !== STRAIGHT && (Math.abs(v - RIGHT) <= 5 || STRAIGHT - v <= 5))) fail(w + ': no card right next to a boundary (within 5° of 90° or 180°)');
    });
    /* 卡片上畫的角：量回來就是卡片上寫的度數 */
    allDegs.forEach(v => {
      const s = D.kindCardSVG(v), base = svgLines(s, 'gk-base'), arm = svgLines(s, 'gk-arm'), t = svgTexts(s, 'gk-num'), A = arcOf(svgPaths(s, 'gk-arc')[0] || '');
      if (base.length !== 1 || arm.length !== 1) return fail('kindCardSVG(' + v + '): expected two sides');
      const got = angleBetween(dirOf(base[0]), dirOf(arm[0]));
      if (Math.abs(got - v) > 0.05) fail('kindCardSVG(' + v + '): the card draws ' + got.toFixed(2) + '°');
      if (!near(base[0].x1, arm[0].x1, 0.01) || !near(base[0].y1, arm[0].y1, 0.01)) fail('kindCardSVG(' + v + '): the two sides do not share a vertex');
      if (t.length !== 1 || t[0].txt !== v + '°') fail('kindCardSVG(' + v + '): the card should say ' + v + '°');
      if (!A || A.sweep !== 0) fail('kindCardSVG(' + v + '): the angle arc is missing or turns the wrong way');
      [base[0], arm[0]].forEach(l => { if ([l.x1, l.x2, l.y1, l.y2].some(c => c < 0 || c > K.svg)) fail('kindCardSVG(' + v + '): a side leaves the card'); });
      if (t.length === 1){
        if (!boxIn(textBox(t[0]), K.svg, K.svg)) fail('kindCardSVG(' + v + '): the number leaves the card');
        const tb = textBox(t[0]);
        [base[0], arm[0]].forEach(l => { for (let q = 0; q <= 1; q += 0.05){ const x = l.x1 + (l.x2 - l.x1) * q, y = l.y1 + (l.y2 - l.y1) * q; if (x > tb.x && x < tb.x + tb.w && y > tb.y && y < tb.y + tb.h) return fail('kindCardSVG(' + v + '): a side runs through the number'); } });
      }
      /* 照規則玩：只有 kindRef 的那個籃子收；其他籃子的說明都要對 */
      LANGS.forEach(L => {
        const d = I18N[L], want = kindRef(v), why = d.gKindWhy(want, v);
        const whyNums = want === 'acute' ? [v, RIGHT] : want === 'right' ? [RIGHT] : want === 'obtuse' ? [v, RIGHT, STRAIGHT] : [STRAIGHT];
        seq('gKindWhy ' + L + ' ' + v, why, whyNums);
        /* 句子說的比較方向也要對（codex 第一輪 #4：把「小」改成「大」數字一樣、意思相反） */
        const PH = L === 'zh' ? { acute:'比 90° 小', right:'剛好 90°', obtuse:'大於 90° 而且小於 180°', straight:'剛好 180°' }
                              : { acute:'is less than 90°', right:'exactly 90°', obtuse:'is more than 90° and less than 180°', straight:'exactly 180°' };
        has('gKindWhy ' + L + ' ' + v, why, PH[want]);
        if (want === 'acute' && /比 90° 大|more than 90°|greater than 90°/.test(why)) fail('gKindWhy ' + L + ' says an acute angle is bigger than 90°');
        if (want === 'acute' && !(v < RIGHT)) fail('gKindWhy says ' + v + ' is less than 90');
        D.KIND_ORDER.forEach(bin => {
          if (bin === want) return;
          let m = d.gKindNo(v, d.kinds[bin], why, d.kinds[want]);
          if (want === 'straight' && bin === 'obtuse') m += d.gKindStraight;
          seq('gKindNo ' + L + ' ' + v + '→' + bin, m, [v].concat(whyNums).concat(want === 'straight' && bin === 'obtuse' ? [STRAIGHT] : []));
          has('gKindNo ' + L, m, d.kinds[bin]); has('gKindNo ' + L, m, d.kinds[want]);
        });
        seq('gKind2 ' + L + ' ' + v, d.gKind2(v, d.gKindName[want], why), [2, v].concat(whyNums));
      });
    });
    need('kind', /if \(k !== b\.kind\)\{\n\s*roundMiss\(d\.gKindNo\(v, d\.kinds\[b\.kind\], d\.gKindWhy\(k, v\), d\.kinds\[k\]\) \+ \(\(k === 'straight' && b\.kind === 'obtuse'\) \? d\.gKindStraight : ''\)\);/,
      'a card in the wrong bin is not refused with its reason (incl. "an obtuse angle must be less than 180°")');
    need('kind', /var b = nearestOpen\(bins, pt, GAME_PAD\);/, 'the drop does not pick the NEAREST bin');
    need('kind', /var v = P\.data\.deg, k = kindOf\(v\);/, 'the bin is not chosen by kindOf() of the card');
    LANGS.forEach(L => {
      const n = I18N[L].gKindName;
      if (!n || ['acute', 'right', 'obtuse', 'straight'].some(k => !n[k])) fail('gKindName ' + L + ' is missing a bin name');
      else if (['acute', 'right', 'obtuse', 'straight'].some(k => n[k] !== QUIZ_KIND[L][k])) fail('gKindName ' + L + ' does not use the lesson\'s four kind names');
    });
  }

  /* ================= 第 5 關：拼一拼 ================= */
  {
    const C = D.COMBO_G;
    touch('a piece (' + C.piece + ')', C.piece, Math.min(1.5, 289 / C.W));
    if (!(D.GAME_COMBO.filter(e => e.W === STRAIGHT).length >= 2 && D.GAME_COMBO.filter(e => e.W !== STRAIGHT).length >= 2)) fail('GAME_COMBO needs at least 2 puzzles whose whole is a straight angle and 2 whose whole is not');
    need('combo', /pick\(GAME_COMBO\.filter\(function\(e\)\{ return e\.W === STRAIGHT_DEG; \}\)\),\n\s*pick\(GAME_COMBO\.filter\(function\(e\)\{ return e\.W !== STRAIGHT_DEG; \}\)\)/, 'a round must have one straight-angle puzzle and one other');
    need('combo', /if \(filled \|\| !comboInGap\(e, pt\.x, pt\.y\)\) return false;/, 'a drop outside the "?" (or after it is filled) must go back silently');
    need('combo', /if \(v !== b\)\{ roundMiss\(d\.gComboNo\(e\.a, v, e\.a \+ v, e\.W\)\); return false; \}/, 'a piece that does not fill the gap exactly is accepted (or refused without its reason)');
    const trays = C.trayX.map(x => sq(x, C.trayY, C.piece));
    trays.forEach((t, i) => {
      if (!boxIn(t, C.W, C.H)) fail('tray place ' + i + ' leaves the board');
      if (!(t.y > C.vy + 4)) fail('tray place ' + i + ' is not below the bottom side');
      trays.forEach((t2, j) => { if (j > i && boxHit(t, t2)) fail('tray places ' + i + ' and ' + j + ' overlap'); });
    });
    D.GAME_COMBO.forEach((e, i) => {
      const w = 'GAME_COMBO[' + i + '] (' + e.W + '° = ' + e.a + '° + ?)', b = e.W - e.a;
      if (!(e.W >= 60 && e.W <= STRAIGHT && e.a > 0 && e.a < e.W)) return fail(w + ': the whole must be 60~180 and the part inside it');
      if (b === e.a) fail(w + ': the missing piece is as big as the given one');
      if (!Array.isArray(e.x) || e.x.length !== 3 || new Set(e.x).size !== 3) return fail(w + ': needs 3 different other pieces');
      if (e.x.indexOf(b) >= 0) fail(w + ': a distractor is the answer ' + b);
      e.x.concat([b]).forEach(v => { if (!(Number.isInteger(v) && v >= 10 && v <= 170)) fail(w + ': piece ' + v + '° is not 10~170'); });
      if (e.x.indexOf(e.a) < 0) fail(w + ': no piece as big as the given part (the "copy the part I see" mistake)');
      if (e.W !== STRAIGHT && e.x.indexOf(STRAIGHT - e.a) < 0) fail(w + ': no ' + (STRAIGHT - e.a) + '° piece (the "the whole is always a straight angle" mistake)');
      /* comboInGap：第二套實作，掃整張畫板 */
      let bad = 0;
      for (let x = 0; x <= C.W; x += 1) for (let y = 0; y <= C.H; y += 1){
        const r = Math.hypot(x - C.vx, y - C.vy), th = Math.atan2(C.vy - y, x - C.vx) * 180 / Math.PI;
        const want = r >= C.inR && r <= C.arm && th > e.a && th < e.W;
        if (D.comboInGap(e, x, y) !== want && bad++ < 2) fail(w + ': comboInGap(' + x + ',' + y + ') = ' + !want);
      }
      trays.forEach((t, j) => { if (D.comboInGap(e, t.x + t.w / 2, t.y + t.h / 2)) fail(w + ': tray place ' + j + ' is inside the gap'); });
      /* 畫出來的大圖 */
      [0, b].forEach(fill => {
        const s = D.comboSVG(e.W, e.a, fill), base = svgLines(s, 'gc-base'), part = svgLines(s, 'gc-part'), whole = svgLines(s, 'gc-whole');
        if (base.length !== 1 || part.length !== 1 || whole.length !== 1) return fail(w + ': expected three sides');
        if (circDiff(dirOf(base[0]), 0) > 0.05) fail(w + ': the bottom side is not at 0°');
        if (Math.abs(angleBetween(dirOf(base[0]), dirOf(part[0])) - e.a) > 0.05) fail(w + ': the placed part is drawn as ' + angleBetween(dirOf(base[0]), dirOf(part[0])).toFixed(2) + '°');
        if (Math.abs(angleBetween(dirOf(base[0]), dirOf(whole[0])) - e.W) > 0.05) fail(w + ': the whole is drawn as ' + angleBetween(dirOf(base[0]), dirOf(whole[0])).toFixed(2) + '°');
        if (Math.abs(angleBetween(dirOf(part[0]), dirOf(whole[0])) - b) > 0.05) fail(w + ': the gap is drawn as ' + angleBetween(dirOf(part[0]), dirOf(whole[0])).toFixed(2) + '°');
        base.concat(part, whole).forEach(l => { if ([l.x1, l.x2].some(v => v < 0 || v > C.W) || [l.y1, l.y2].some(v => v < 0 || v > C.H)) fail(w + ': a side leaves the board'); });
        const lbl = (cls, txt, lo, hi) => {
          const t = svgTexts(s, cls);
          if (t.length !== 1 || t[0].txt !== txt) return fail(w + ': ' + cls + ' should say ' + txt + ', got ' + (t[0] ? t[0].txt : 'nothing'));
          const at = degOfPoint(C.vx, C.vy, t[0].x, t[0].y);
          if (!(at > lo && at < hi)) fail(w + ': the label ' + txt + ' is not inside its angle (' + at.toFixed(1) + '°)');
          if (!boxIn(textBox(t[0]), C.W, C.H)) fail(w + ': the label ' + txt + ' leaves the board');
          /* 字不可以壓在任何一條邊上 */
          const tb = textBox(t[0]);
          base.concat(part, whole).forEach(l => { for (let q = 0; q <= 1; q += 0.02){ const x = l.x1 + (l.x2 - l.x1) * q, y = l.y1 + (l.y2 - l.y1) * q; if (x > tb.x && x < tb.x + tb.w && y > tb.y && y < tb.y + tb.h) return fail(w + ': a side runs through the label ' + txt); } });
          return t[0];
        };
        lbl('gc-albl', e.a + '°', 0, e.a);
        const q = lbl('gc-blbl', fill ? b + '°' : '?', e.a, e.W);
        lbl('gc-wlbl', e.W + '°', 0, e.W);
        if (q && !D.comboInGap(e, q.x, q.y)) fail(w + ': the "?" label itself is not inside the drop zone');
        const gap = sectorOf(svgPaths(s, fill ? 'gc-gfill' : 'gc-gap')[0] || '');
        if (!gap || circDiff(degOfPoint(C.vx, C.vy, gap.x1, gap.y1), e.a) > 0.05 || circDiff(degOfPoint(C.vx, C.vy, gap.x2, gap.y2), e.W) > 0.05) fail(w + ': the gap sector is not drawn from ' + e.a + '° to ' + e.W + '°');
        const pf = sectorOf(svgPaths(s, 'gc-pfill')[0] || '');
        if (!pf || circDiff(degOfPoint(C.vx, C.vy, pf.x1, pf.y1), 0) > 0.05 || circDiff(degOfPoint(C.vx, C.vy, pf.x2, pf.y2), e.a) > 0.05) fail(w + ': the placed part is not drawn from 0° to ' + e.a + '°');
      });
      /* 托盤的每一塊：畫出來的角就是寫的度數 */
      e.x.concat([b]).forEach(v => {
        const s = D.wedgeSVG(v), arms = svgLines(s, 'gw-arm'), t = svgTexts(s, 'gw-num');
        if (arms.length !== 2) return fail('wedgeSVG(' + v + '): expected two sides');
        const got = angleBetween(dirOf(arms[0]), dirOf(arms[1]));
        if (Math.abs(got - v) > 0.05) fail('wedgeSVG(' + v + '): the piece is drawn as ' + got.toFixed(2) + '°');
        if (t.length !== 1 || t[0].txt !== v + '°') fail('wedgeSVG(' + v + '): the piece should say ' + v + '°');
        else if (!boxIn(textBox(t[0]), C.svg, C.svg)) fail('wedgeSVG(' + v + '): the number leaves the piece');
        arms.forEach(l => { if ([l.x1, l.x2, l.y1, l.y2].some(c => c < 0 || c > C.svg)) fail('wedgeSVG(' + v + '): a side leaves the piece'); });
      });
      /* 照規則玩：只有 b 收；其他三塊的說明 */
      LANGS.forEach(L => {
        const d = I18N[L];
        e.x.forEach(v => {
          const s = e.a + v, diff = Math.abs(s - e.W), m = d.gComboNo(e.a, v, s, e.W);
          seq('gComboNo ' + L + ' ' + w + ' +' + v, m, L === 'zh' ? [e.a, v, s, e.W, diff] : [e.a, v, s, diff, e.W]);
          has('gComboNo ' + L, m, s > e.W ? (L === 'zh' ? '多' : 'more') : (L === 'zh' ? '少' : 'less'));
        });
        seq('gComboOk ' + L, d.gComboOk(e.W, e.a, b), [e.W, e.a, b, e.a, b, e.W]);
        seq('gCombo2 ' + L, d.gCombo2(e.W, e.a, b), [2, e.W, e.a, b, b]);
      });
    });
  }
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-4/math/angle */
  breaks: [
    /* ---------- review.html：共用工具 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'classify: correct is not the kind of',
      find:"    if (deg > RIGHT_DEG && deg < STRAIGHT_DEG) return 'obtuse';\n    if (deg === STRAIGHT_DEG) return 'straight';\n    return null;\n  }\n  /* 鐘面",
      replace:"    if (deg > RIGHT_DEG) return 'obtuse';\n    if (deg === STRAIGHT_DEG) return 'straight';\n    return null;\n  }\n  /* 鐘面" },
    { file:'review', expect:'clockHour: correct is not k x 30',
      find:'  var CLOCK_STEP = FULL_TURN / CLOCK_SLOTS;',
      replace:'  var CLOCK_STEP = FULL_TURN / CLOCK_SLOTS + 1;' },
    { file:'review', expect:'deg does not match the turn table',
      find:'    { num:2, den:3,  deg:240 },',
      replace:'    { num:2, den:3,  deg:250 },' },
    { file:'review', expect:'not clearly on one side of a right angle',
      find:'  var CLEAR_GAP = 20;',
      replace:'  var CLEAR_GAP = 0;' },
    { file:'review', expect:'both rows read the same',
      find:'  var ANY_DEGS = degsBy5(DEG_MIN, DEG_MAX, [RIGHT_DEG]);',
      replace:'  var ANY_DEGS = degsBy5(DEG_MIN, DEG_MAX, []);' },

    /* ---------- review.html：protractorRead ---------- */
    { file:'review', expect:'protractorRead: other is not 180 minus the answer',
      find:'        var other = STRAIGHT_DEG - correct;\n        var acute = (correct < RIGHT_DEG);',
      replace:'        var other = STRAIGHT_DEG - correct + 5;\n        var acute = (correct < RIGHT_DEG);' },
    { file:'review', expect:'protractorRead: acute does not match the answer',
      find:'        var acute = (correct < RIGHT_DEG);\n        var cands = [other, correct + 10, correct - 10, correct + 5, correct - 5];',
      replace:'        var acute = (correct > RIGHT_DEG);\n        var cands = [other, correct + 10, correct - 10, correct + 5, correct - 5];' },
    { file:'review', expect:'protractorRead stem does not print both readings',
      find:'        var lo = Math.min(d.correct, d.other), hi = Math.max(d.correct, d.other);',
      replace:'        var lo = Math.min(d.correct, d.other) + 1, hi = Math.max(d.correct, d.other);' },
    { file:'review', expect:'protractorRead why never states the answer',
      find:"            ? '這個角' + look + '，而' + rule + '，所以只可能是 ' + d.correct + '°。'",
      replace:"            ? '這個角' + look + '，而' + rule + '，所以答案就出來了。'" },
    { file:'review', expect:'protractorRead why does not mention the other row',
      find:"              + d.other + '° 是讀錯一排的結果 —— 同一格的兩個數字加起來永遠是 ' + STRAIGHT_DEG + '。'",
      replace:"              + '讀錯一排就會答錯 —— 同一格的兩個數字加起來永遠是 ' + STRAIGHT_DEG + '。'" },

    /* ---------- review.html：wrongScale ---------- */
    { file:'review', expect:'wrongScale: correct is not 180 minus a',
      find:'        var a = pickUnused(ANY_DEGS, used);\n        var correct = STRAIGHT_DEG - a;',
      replace:'        var a = pickUnused(ANY_DEGS, used);\n        var correct = RIGHT_DEG - a;' },
    { file:'review', expect:'wrongScale stem does not print',
      find:"            ? '量角器同一格上有兩個數字。其中一排寫著 ' + d.a + '，另一排會寫著幾？'",
      replace:"            ? '量角器同一格上有兩個數字。其中一排寫著 ' + (d.a + 1) + '，另一排會寫著幾？'" },
    { file:'review', expect:'wrongScale why never states the answer',
      find:"            ? '同一格的兩個數字加起來永遠是 ' + STRAIGHT_DEG + '，所以另一排是 ' + STRAIGHT_DEG + ' － ' + d.a + ' ＝ ' + d.correct + '。'",
      replace:"            ? '同一格的兩個數字加起來永遠是 ' + STRAIGHT_DEG + '，所以另一排用減的就算得出來。'" },

    /* ---------- review.html：classify / pickKind ---------- */
    { file:'review', expect:'classify stem does not print the angle',
      find:"            ? '一個角是 ' + d.deg + '°，它是什麼角？'",
      replace:"            ? '一個角是 ' + (d.deg + 1) + '°，它是什麼角？'" },
    { file:'review', expect:"classify why does not use this lesson's range wording",
      find:"            ? d.deg + '° ' + t.kindRange[d.correct] + '，所以它是' + t.kinds[d.correct] + '。'",
      replace:"            ? d.deg + '° 是這一種，所以它是' + t.kinds[d.correct] + '。'" },
    { file:'review', expect:'pickKind: 2 options are',
      find:"        var outPool = (want === 'acute') ? degsBy5(95, 175, []).concat([RIGHT_DEG, STRAIGHT_DEG])\n                                         : degsBy5(5, 85, []).concat([RIGHT_DEG, STRAIGHT_DEG]);",
      replace:"        var outPool = (want === 'acute') ? degsBy5(5, 85, []).concat([RIGHT_DEG, STRAIGHT_DEG])\n                                         : degsBy5(5, 85, []).concat([RIGHT_DEG, STRAIGHT_DEG]);" },
    { file:'review', expect:'pickKind: the marked answer is not',
      find:'        var correct = pick(inPool);\n        var wrongs = [];',
      replace:'        var correct = pick(inPool.concat([RIGHT_DEG]));\n        var wrongs = [];' },

    /* ---------- review.html：turnToDeg / degToTurn ---------- */
    { file:'review', expect:'turnToDeg: correct is not 360 x',
      find:'        var correct = FULL_TURN * row.num / row.den;\n        /* 誘答：只算一份就交卷',
      replace:'        var correct = STRAIGHT_DEG * row.num / row.den;\n        /* 誘答：只算一份就交卷' },
    { file:'review', expect:'turnToDeg stem does not name the turn',
      find:"            ? '轉了' + name + '，是轉了幾度？'",
      replace:"            ? '轉了那麼多，是轉了幾度？'" },
    { file:'review', expect:'turnToDeg why never states the answer',
      find:"              + name + '是 ' + d.num + ' 份，' + d.num + ' × ' + part + '° ＝ ' + d.correct + '°。'",
      replace:"              + name + '是 ' + d.num + ' 份，乘起來就是答案。'" },
    { file:'review', expect:'degToTurn: deg does not match the turn table',
      find:'        return { idx:i, deg:TURN_TABLE[i].deg, num:TURN_TABLE[i].num, den:TURN_TABLE[i].den, opts:m.opts, ans:m.ans };',
      replace:'        return { idx:i, deg:TURN_TABLE[i].deg + 5, num:TURN_TABLE[i].num, den:TURN_TABLE[i].den, opts:m.opts, ans:m.ans };' },
    { file:'review', expect:'degToTurn stem does not print',
      find:"            ? '轉了 ' + d.deg + '°，等於轉了多少？'",
      replace:"            ? '轉了那麼多度，等於轉了多少？'" },

    /* ---------- review.html：clockHour ---------- */
    { file:'review', expect:'clockHour why never states the answer',
      find:"              + ' 走到 ' + d.h2 + ' 走了 ' + d.k + ' 格，' + d.k + ' × ' + CLOCK_STEP + '° ＝ ' + d.correct + '°。'",
      replace:"              + ' 走到 ' + d.h2 + ' 走了 ' + d.k + ' 格，乘起來就是答案。'" },
    { file:'review', expect:'clockHour: h2 is not h1 plus k',
      find:'        var h2 = h1 + k;\n        var correct = k * CLOCK_STEP;',
      replace:'        var h2 = h1 + k - 1;\n        var correct = k * CLOCK_STEP;' },
    { file:'review', expect:'clockHour stem does not print both hours',
      find:"            ? '時鐘的時針從 ' + d.h1 + ' 走到 ' + d.h2 + '，走過的角是幾度？'",
      replace:"            ? '時鐘的時針從 ' + d.h1 + ' 走到下一個鐘點，走過的角是幾度？'" },

    /* ---------- review.html：sumAngles / partOfWhole ---------- */
    { file:'review', expect:'sumAngles: correct is not a plus b',
      find:'          correct = a + b;\n          /* a ＝ b 的話',
      replace:'          correct = a + b + 5;\n          /* a ＝ b 的話' },
    { file:'review', expect:'sumAngles: the two angles are equal',
      find:'          ok = (a !== b) && correct <= STRAIGHT_DEG;',
      replace:'          ok = correct <= STRAIGHT_DEG;' },
    { file:'review', expect:'sumAngles stem does not print both angles',
      find:"            ? '兩個角頂點相同、共用一條邊、而且沒有重疊地拼在一起，一個是 ' + d.a + '°、另一個是 ' + d.b + '°。合起來的角是幾度？'",
      replace:"            ? '兩個角頂點相同、共用一條邊、而且沒有重疊地拼在一起，一個是 ' + d.a + '°、另一個也知道。合起來的角是幾度？'" },
    { file:'review', expect:'sumAngles stem no longer says the two angles do not overlap',
      find:"            : 'Two angles are joined at the same vertex, sharing one side and not overlapping. One is ' + d.a + '° and the other is ' + d.b + '°. How many degrees is the whole angle?',",
      replace:"            : 'Two angles are put together. One is ' + d.a + '° and the other is ' + d.b + '°. How many degrees is the whole angle?'," },
    { file:'review', expect:'partOfWhole: correct is not the whole minus',
      find:"        var a = pick(degsBy5(5, whole - 5, [whole / 2]));\n        var correct = whole - a;",
      replace:"        var a = pick(degsBy5(5, whole - 5, [whole / 2]));\n        var correct = whole - a + 5;" },
    { file:'review', expect:'partOfWhole: the answer equals the angle printed in the stem',
      find:"        var a = pick(degsBy5(5, whole - 5, [whole / 2]));",
      replace:"        var a = whole / 2;" },
    /* 「whole 必須是 90 或 180」那一條是防呆：把它改壞會讓 fmt 先在
       `wholeName[120]` 上炸掉（大聲失敗，但不是 [FAIL] 行），所以這裡改證
       旁邊那一條 —— 已知的那一個角超出整個角。 */
    { file:'review', expect:'partOfWhole: the known part is outside the whole',
      find:"        var a = pick(degsBy5(5, whole - 5, [whole / 2]));\n        var correct = whole - a;",
      replace:"        var a = whole + 5;\n        var correct = whole - a;" },
    { file:'review', expect:'partOfWhole stem does not name the whole angle',
      find:"            ? '兩個角頂點相同、共用一條邊、而且沒有重疊地拼在一起，合起來剛好是一個' + wn + '。其中一個角是 ' + d.a + '°，另一個角是幾度？'",
      replace:"            ? '兩個角頂點相同、共用一條邊、而且沒有重疊地拼在一起，合起來剛好是一個大角。其中一個角是 ' + d.a + '°，另一個角是幾度？'" },

    /* ---------- review.html：toolRule ---------- */
    { file:'review', expect:'toolRule: the explanation does not state the rule table answer',
      find:"            ? '正確的做法是：' + r.a + '。'",
      replace:"            ? '正確的做法就在上面那一句。'" },
    { file:'review', expect:'toolRule: stem does not match the rule table',
      find:"        var r = t.rules[d.rid];\n        return {\n          stem: r.q,",
      replace:"        var r = t.rules[(d.rid + 1) % 5];\n        return {\n          stem: r.q," },
    { file:'review', expect:'toolRule option',
      find:"          a:'從你對準的那個 0 開始、一路數下去的那一排',\n          w:['永遠讀外面那一排','永遠讀裡面那一排','兩排都讀，再把兩個數字加起來'] },",
      replace:"          a:'從你對準的那個 0 開始、一路數下去的那一排',\n          w:['看情況決定','永遠讀裡面那一排','兩排都讀，再把兩個數字加起來'] }," },
    /* codex #6：換成**別條規則**的誘答時，全表白名單放行，但那一題就變成兩個選項都講得通。 */
    { file:'review', expect:'own answer plus its three distractors',
      find:"          w:['其中一條邊上、離頂點有一段距離的一點','角的開口正中間','量角器的 0 刻度線'] },",
      replace:"          w:['其中一條邊上、離頂點有一段距離的一點','100 等份','量角器的 0 刻度線'] }," },

    /* ---------- index.html：規則與版面常數 ---------- */
    { file:'index', expect:'kindOf(180)',
      find:"    if (deg > RIGHT_DEG && deg < STRAIGHT_DEG) return 'obtuse';\n    if (deg === STRAIGHT_DEG) return 'straight';",
      replace:"    if (deg > RIGHT_DEG) return 'obtuse';\n    if (deg === STRAIGHT_DEG) return 'straight';" },
    { file:'index', expect:'row reads 170, independently 180',
      find:"  function labelAt(theta, scale){ return (scale === 'inner') ? theta : 180 - theta; }",
      replace:"  function labelAt(theta, scale){ return (scale === 'inner') ? theta : 170 - theta; }" },
    /* 只改 readingOf，labelList 不動 —— 這樣才孤立得到「讀回來要等於原角」那一條。 */
    { file:'index', expect:'reading the row whose 0 you lined up must give the angle back',
      find:'  function readingOf(a, from){ return labelAt(armDeg(a, from), scaleOf(from)); }',
      replace:"  function readingOf(a, from){ return labelAt(armDeg(a, from), 'inner'); }" },
    { file:'index', expect:'armDeg(',
      find:"  function armDeg(a, from){ return (from === 'right') ? a : 180 - a; }",
      replace:"  function armDeg(a, from){ return a; }" },
    { file:'index', expect:"scaleOf('left')",
      find:"  function scaleOf(from){ return (from === 'right') ? 'inner' : 'outer'; }",
      replace:"  function scaleOf(from){ return 'inner'; }" },
    { file:'index', expect:'but the mark it must cross is at',
      find:"      { kind:'other', deg:o, x1:PROT_CX, y1:PROT_CY, x2:polarX(PROT_CX, o, ARM_LEN), y2:polarY(PROT_CY, o, ARM_LEN) }",
      replace:"      { kind:'other', deg:o, x1:PROT_CX, y1:PROT_CY, x2:polarX(PROT_CX, o + 2, ARM_LEN), y2:polarY(PROT_CY, o + 2, ARM_LEN) }" },
    /* codex #1：兩條邊一起轉，夾角不變、卻整個對不上刻度。驗每一條邊自己的方向才抓得到。 */
    { file:'index', expect:'but the 0 mark it must lie on is at',
      find:"      { kind:'base',  deg:b, x1:PROT_CX, y1:PROT_CY, x2:polarX(PROT_CX, b, ARM_LEN), y2:polarY(PROT_CY, b, ARM_LEN) },",
      replace:"      { kind:'base',  deg:b, x1:PROT_CX, y1:PROT_CY, x2:polarX(PROT_CX, b + 2, ARM_LEN), y2:polarY(PROT_CY, b + 2, ARM_LEN) }," },
    /* codex #2：標籤不可以拿自己回報的 deg 當神諭 —— 換成每 5 度一個、只標到 90，
       數量、半徑、配對和全都還是對的，上半圈的數字卻整片不見。 */
    { file:'index', expect:'which is not one of the 10-degree marks on either row',
      find:'    for (var t = 0; t <= 180; t += 10){\n      out.push({ deg:t, scale:\'outer\'',
      replace:'    for (var t = 0; t <= 90; t += 5){\n      out.push({ deg:t, scale:\'outer\'' },
    /* codex #4：scale 打錯字時，半徑與參考值會一起掉進「外圈」那一支，兩邊一起錯。 */
    { file:'index', expect:'on the "otuer" row',
      find:"      out.push({ deg:t, scale:'outer', value:labelAt(t, 'outer'),",
      replace:"      out.push({ deg:t, scale:'otuer', value:labelAt(t, 'outer')," },
    /* codex #8：large-arc 寫死成 1，端點與掃描方向全對，畫出來卻是繞遠路的那一段。 */
    { file:'index', expect:'it would draw the long way round',
      find:'    var large = (Math.abs(toDeg - fromDeg) > 180) ? 1 : 0;',
      replace:'    var large = 1;' },
    /* 第二輪 #4：反方向也要探測到 —— 寫死成 0 時，240°／270° 的旋轉弧會繞短的那一邊。 */
    { file:'index', expect:'the short way round instead of the reflex sweep',
      find:'    var large = (Math.abs(toDeg - fromDeg) > 180) ? 1 : 0;\n    var sweep = (toDeg > fromDeg) ? 0 : 1;',
      replace:'    var large = 0;\n    var sweep = (toDeg > fromDeg) ? 0 : 1;' },
    /* 第二輪 #3：複合選項的度數也要受上界管。 */
    { file:'index', expect:'is outside 1~180',
      find:"          opts:['83°，銳角','83°，鈍角','13°，銳角','73°，銳角'], ans:0,",
      replace:"          opts:['83°，銳角','83°，鈍角','13°，銳角','273°，銳角'], ans:0," },
    /* codex #3：遊戲選項是稀疏陣列時，按鈕會是空的，Set 卻把 undefined 算成第四個相異值。 */
    /* codex #3：題庫選項同理。 */
    { file:'index', expect:'is a hole in the array, so that button would be blank',
      find:"        { stem:'一個角是 45°，它是什麼角？', opts:['直角','鈍角','平角','銳角'], ans:3,",
      replace:"        { stem:'一個角是 45°，它是什麼角？', opts:['直角','鈍角', ,'銳角'], ans:3," },
    /* codex #5：題幹問的是什麼，神諭要盯著 —— 不然它只是在對位置。 */
    { file:'index', expect:'so it may not be asking what the oracle assumes',
      find:'合起來剛好是一個平角。其中一個角是 115°，另一個角是幾度？',
      replace:'合起來剛好是一個大角。其中一個角是 115°，另一個角是幾度？' },
    /* codex #7：量角器讀數只到 180，那幾題的選項不可以吃到 360。 */
    { file:'index', expect:'is outside 1~180',
      find:"          opts:['140°','100°','40°','180°'], ans:2,\n          why:'那個角比直角小",
      replace:"          opts:['140°','100°','40°','300°'], ans:2,\n          why:'那個角比直角小" },
    { file:'index', expect:'is drawn along',
      find:'        x2:polarX(PROT_CX, t, PROT_R - len), y2:polarY(PROT_CY, t, PROT_R - len)',
      replace:'        x2:polarX(PROT_CX, t + 1, PROT_R - len), y2:polarY(PROT_CY, t, PROT_R - len)' },
    { file:'index', expect:'independently',
      find:"      out.push({ deg:t, scale:'outer', value:labelAt(t, 'outer'),\n                 x:polarX(PROT_CX, t, LBL_R_OUT), y:polarY(PROT_CY, t, LBL_R_OUT) });",
      replace:"      out.push({ deg:t, scale:'outer', value:labelAt(t, 'outer') + 1,\n                 x:polarX(PROT_CX, t, LBL_R_OUT), y:polarY(PROT_CY, t, LBL_R_OUT) });" },
    { file:'index', expect:'the two rows of numbers sit at the same radius',
      find:'  var LBL_R_OUT = 168, LBL_R_IN = 143, LBL_FONT = 11;',
      replace:'  var LBL_R_OUT = 168, LBL_R_IN = 168, LBL_FONT = 11;' },
    { file:'index', expect:'reaches (',
      find:'  var ARM_LEN = 232;',
      replace:'  var ARM_LEN = 320;' },
    /* 弧線標籤往外推：這一筆不碰邊，所以孤立得到「整張圖的上緣」那一條。 */
    { file:'index', expect:'above the top of the',
      find:'  var ARC_R = 56, ARC_GAP = 20, ARC_LBL_R = 80, ARC_LBL_GAP = 26, ARC_LBL_FONT = 14;',
      replace:'  var ARC_R = 56, ARC_GAP = 20, ARC_LBL_R = 80, ARC_LBL_GAP = 200, ARC_LBL_FONT = 14;' },
    { file:'index', expect:'the vertex label reaches y=',
      find:'  var VERTEX_R = 4, VERTEX_LBL_DY = 22, VERTEX_FONT = 12;',
      replace:'  var VERTEX_R = 4, VERTEX_LBL_DY = 80, VERTEX_FONT = 12;' },
    { file:'index', expect:'viewBox is 560x320, but the layout constants say',
      find:'  var PROT_W = 560, PROT_H = 320;',
      replace:'  var PROT_W = 570, PROT_H = 320;' },
    { file:'index', expect:'.prot CSS height',
      find:'  .prot{width:100%;max-width:560px;height:320px;display:block;margin:0 auto}',
      replace:'  .prot{width:100%;max-width:560px;height:330px;display:block;margin:0 auto}' },
    { file:'index', expect:'turn canvas label',
      find:'  var TURN_TICK_LEN = 10, TURN_LBL_R = 112, TURN_LBL_FONT = 12, TURN_ARC_R = 40;',
      replace:'  var TURN_TICK_LEN = 10, TURN_LBL_R = 128, TURN_LBL_FONT = 12, TURN_ARC_R = 40;' },
    { file:'index', expect:'sweeps the wrong way',
      find:'    var sweep = (toDeg > fromDeg) ? 0 : 1;',
      replace:'    var sweep = 0;' },

    /* ---------- index.html：範例資料 ---------- */
    { file:'index', expect:'cases at exactly 90',
      find:"    { deg:90,  from:'right' }\n  ];",
      replace:"    { deg:80,  from:'right' }\n  ];" },
    { file:'index', expect:'MEASURE_CASES never puts the 0 on the left',
      find:"    { deg:65,  from:'left'  },\n    { deg:150, from:'left'  },",
      replace:"    { deg:65,  from:'right'  },\n    { deg:150, from:'right'  }," },
    { file:'index', expect:'measureSteps() is',
      find:"  function measureSteps(){ return [{ kind:'center' }, { kind:'zero' }, { kind:'read' }]; }",
      replace:"  function measureSteps(){ return [{ kind:'center' }, { kind:'read' }]; }" },
    { file:'index', expect:'drawSteps() is',
      find:"  function drawSteps(){ return [{ kind:'side' }, { kind:'place' }, { kind:'mark' }, { kind:'join' }]; }",
      replace:"  function drawSteps(){ return [{ kind:'side' }, { kind:'place' }, { kind:'join' }]; }" },
    { file:'index', expect:'DRAW_CASES has no obtuse angle to draw',
      find:"    { deg:110, from:'right' },\n    { deg:35,  from:'left'  },\n    { deg:145, from:'left'  }",
      replace:"    { deg:70,  from:'right' },\n    { deg:35,  from:'left'  },\n    { deg:45,  from:'left'  }" },
    { file:'index', expect:'CLASS_CASES is missing the boundary probe',
      find:'  var CLASS_CASES = [35, 89, 90, 91, 128, 180];',
      replace:'  var CLASS_CASES = [35, 88, 90, 92, 128, 180];' },
    { file:'index', expect:'COMBO_CASES has no pair that adds up to 180',
      find:'    { a:50, b:130 },',
      replace:'    { a:50, b:120 },' },
    { file:'index', expect:'which is over 180 and cannot be drawn on a semicircle',
      find:'    { a:70, b:40 }\n  ];',
      replace:'    { a:170, b:40 }\n  ];' },
    { file:'index', expect:'is not 360 x',
      find:'    { num:3, den:4,  deg:270 },',
      replace:'    { num:3, den:4,  deg:280 },' },
    { file:'index', expect:'has no special name',
      find:"    if (deg === FULL_TURN) return 'full';\n    return null;",
      replace:"    if (deg === FULL_TURN) return 'full';\n    return 'right';" },

    /* ---------- index.html：遊戲（角度闖關） ---------- */
    { file:'index', expect:'not the nearest 30° step',
      find:'  function turnSnap(a){ return (Math.round(a / TURN_G.step) * TURN_G.step) % 360; }',
      replace:'  function turnSnap(a){ return (Math.floor(a / TURN_G.step) * TURN_G.step) % 360; }' },
    { file:'index', expect:'a full turn ends where it started',
      find:'  var GAME_TURN = [[2, 3, 5],', replace:'  var GAME_TURN = [[2, 7, 5],' },
    { file:'index', expect:'the labelled 90/180/270 marks give the answer away',
      find:'  var GAME_TURN = [[2, 3, 5],', replace:'  var GAME_TURN = [[2, 4, 6],' },
    { file:'index', expect:'the turned side is drawn at',
      find:"    s += gLine('gt-arm', G.cx, G.cy, polarX(G.cx, th, G.r), polarY(G.cy, th, G.r), '#E8871E', 5);",
      replace:"    s += gLine('gt-arm', G.cx, G.cy, polarX(G.cx, th + 15, G.r), polarY(G.cy, th + 15, G.r), '#E8871E', 5);" },
    { file:'index', expect:'the arc goes the wrong way round',
      find:"    if (th > 0) s += '<path class=\"gt-arc\" d=\"' + arcPath(G.cx, G.cy, 0, th, G.arcR)",
      replace:"    if (th > 0) s += '<path class=\"gt-arc\" d=\"' + arcPath(G.cx, G.cy, th, 0, G.arcR)" },
    { file:'index', expect:'the handle at',
      find:'  var TURN_G = { W:300, H:290, cx:150, cy:145, r:100,', replace:'  var TURN_G = { W:300, H:290, cx:150, cy:145, r:130,' },
    { file:'index', expect:'gTurnNo zh',
      find:"        return '照 ↺ 數，橘色的邊停在第 ' + k + ' 格：' + k + ' × 30° ＝ ' + got + '°。'",
      replace:"        return '照 ↺ 數，橘色的邊停在第 ' + k + ' 格：' + k + ' × 30° ＝ ' + want + '°。'" },
    { file:'index', expect:'and the ↻-turn note',
      find:"(cur === FULL_TURN - t.deg ? d.gTurnDir : '')", replace:"''" },
    { file:'index', expect:'pressing Done without turning must be a reminder',
      find:'        if (cur === 0){ roundInfo(d.gTurnZero); return; }', replace:'        if (cur === 0){ roundMiss(d.gTurnZero); return; }' },
    { file:'index', expect:'is within 15° of a right angle',
      find:"    [{ deg:40, from:'right' }, { deg:125, from:'left' }],", replace:"    [{ deg:40, from:'right' }, { deg:95, from:'left' }]," },
    { file:'index', expect:'needs one angle with the 0 on the right and one on the left',
      find:"    [{ deg:135, from:'right' }, { deg:55, from:'left' }],", replace:"    [{ deg:135, from:'right' }, { deg:55, from:'right' }]," },
    { file:'index', expect:'needs one acute and one obtuse angle',
      find:"    [{ deg:70, from:'right' }, { deg:150, from:'left' }],", replace:"    [{ deg:70, from:'right' }, { deg:30, from:'left' }]," },
    { file:'index', expect:'nothing asks the child to find a 5° mark',
      find:"    [{ deg:45, from:'right' }, { deg:120, from:'left' }],", replace:"    [{ deg:40, from:'right' }, { deg:120, from:'left' }]," },
    { file:'index', expect:'is not a multiple of 5',
      find:"    [{ deg:65, from:'right' }, { deg:145, from:'left' }],", replace:"    [{ deg:63, from:'right' }, { deg:145, from:'left' }]," },
    { file:'index', expect:'number at',
      find:"      s += gText('gp-in', polarX(cx, u, G.lblIn), polarY(cy, u, G.lblIn), String(labelAt(u, 'inner')),",
      replace:"      s += gText('gp-in', polarX(cx, u, G.lblIn), polarY(cy, u, G.lblIn), String(labelAt(u, 'outer'))," },
    { file:'index', expect:'the drawn angle is',
      find:"      s += gLine(o.armCls || 'gp-arm', cx, cy, polarX(cx, o.arm, G.arm), polarY(cy, o.arm, G.arm),",
      replace:"      s += gLine(o.armCls || 'gp-arm', cx, cy, polarX(cx, o.arm + 5, G.arm), polarY(cy, o.arm + 5, G.arm)," },
    { file:'index', expect:'a bead does not start at the 0 of its own row',
      find:"  function beadStart(k){ return (k === 'in') ? 0 : 180; }", replace:"  function beadStart(k){ return (k === 'in') ? 180 : 0; }" },
    { file:'index', expect:'but that row\'s 0 is not on the',
      find:"  function beadOf(from){ return (scaleOf(from) === 'inner') ? 'in' : 'out'; }", replace:"  function beadOf(from){ return (scaleOf(from) === 'inner') ? 'out' : 'in'; }" },
    { file:'index', expect:'beadAngle(',
      find:'    if (p.th < 0) return (x < PROT_G.cx) ? 180 : 0;', replace:'    if (p.th < 0) return (x < PROT_G.cx) ? 0 : 180;' },
    { file:'index', expect:'a bead would count as arriving far from the side',
      find:'bead:50, near:5,', replace:'bead:50, near:20,' },
    { file:'index', expect:'a bead (46) is',
      find:'bead:50, near:5,', replace:'bead:46, near:5,' },
    { file:'index', expect:'the two protractor rows overlap',
      find:'rowY:[160, 345]', replace:'rowY:[160, 335]' },
    { file:'index', expect:'points of the board count as being on BOTH protractors',
      find:'bandIn:46, bandOut:18, bandBelow:10,', replace:'bandIn:46, bandOut:18, bandBelow:80,' },
    { file:'index', expect:'drawSnap at',
      find:'    return Math.round(th / G.snap) * G.snap;', replace:'    return Math.floor(th / G.snap) * G.snap;' },
    { file:'index', expect:'the drop zone does not cover what the child sees',
      find:'bandIn:46, bandOut:18', replace:'bandIn:20, bandOut:18' },
    { file:'index', expect:'home is on a protractor',
      find:'dotX:34, dotY:202,', replace:'dotX:34, dotY:150,' },
    { file:'index', expect:'gDrawRow zh',
      find:"點在那裡畫出來會是 ' + got + '°。';", replace:"點在那裡畫出來會是 ' + a + '°。';" },
    { file:'index', expect:'the bead from the 0 that is not on a side is not refused',
      find:"        if (k !== beadOf(r.it.from)){\n", replace:"        if (false){\n" },
    { file:'index', expect:'a dot on a wrong mark is not refused',
      find:"          if (th === armDeg(r.it.deg, otherSide(r.it.from)))\n", replace:"          if (th === armDeg(r.it.deg, r.it.from))\n" },
    { file:'index', expect:'the card draws',
      find:"    s += gLine('gk-arm', G.vx, G.vy, polarX(G.vx, deg, G.armLen), polarY(G.vy, deg, G.armLen), '#2B2A33', 2.5);",
      replace:"    s += gLine('gk-arm', G.vx, G.vy, polarX(G.vx, deg * 0.9, G.armLen), polarY(G.vy, deg * 0.9, G.armLen), '#2B2A33', 2.5);" },
    { file:'index', expect:'no right card',
      find:'  var GAME_KIND = [[35, 89, 90, 91, 180],', replace:'  var GAME_KIND = [[35, 89, 92, 91, 180],' },
    { file:'index', expect:'a bin holds only 2',
      find:'  var GAME_KIND = [[35, 89, 90, 91, 180],', replace:'  var GAME_KIND = [[35, 89, 90, 25, 180],' },
    { file:'index', expect:'no card right next to a boundary',
      find:'[60, 90, 95, 170, 180],', replace:'[60, 90, 120, 150, 180],' },
    { file:'index', expect:'gKindWhy zh',
      find:"        return k === 'acute' ? deg + '° 比 90° 小'", replace:"        return k === 'acute' ? deg + '° 比 80° 小'" },
    { file:'index', expect:'"an obtuse angle must be less than 180°"',
      find:"((k === 'straight' && b.kind === 'obtuse') ? d.gKindStraight : '')", replace:"''" },
    { file:'index', expect:'there is no gap between them',
      find:'binX0:4, binW:70, binGap:4,', replace:'binX0:4, binW:70, binGap:0,' },
    { file:'index', expect:'the padded bins do not overlap',
      find:'binX0:4, binW:70, binGap:4,', replace:'binX0:4, binW:66, binGap:14,' },
    { file:'index', expect:'is not inside the bin',
      find:'slotY0:200, slotDy:60 };', replace:'slotY0:200, slotDy:80 };' },
    { file:'index', expect:'tray places 0 and 1 overlap',
      find:'tray:[[50, 38], [150, 38],', replace:'tray:[[50, 38], [90, 38],' },
    { file:'index', expect:'comboInGap(',
      find:'    return r >= G.inR && r <= G.arm && th > e.a && th < e.W;', replace:'    return r >= G.inR && r <= G.arm && th > 0 && th < e.W;' },
    { file:'index', expect:'a distractor is the answer',
      find:'    { W:180, a:115, x:[115, 75, 55] },', replace:'    { W:180, a:115, x:[115, 65, 55] },' },
    { file:'index', expect:'no piece as big as the given part',
      find:'    { W:180, a:50,  x:[50, 140, 120] },', replace:'    { W:180, a:50,  x:[60, 140, 120] },' },
    { file:'index', expect:'the "the whole is always a straight angle" mistake',
      find:'    { W:90,  a:35,  x:[145, 35, 65] },', replace:'    { W:90,  a:35,  x:[75, 35, 65] },' },
    { file:'index', expect:'the gap is drawn as',
      find:"    s += gLine('gc-part', G.vx, G.vy, polarX(G.vx, a, G.arm), polarY(G.vy, a, G.arm), '#E8871E', 4);",
      replace:"    s += gLine('gc-part', G.vx, G.vy, polarX(G.vx, a + 10, G.arm), polarY(G.vy, a + 10, G.arm), '#E8871E', 4);" },
    { file:'index', expect:'the piece is drawn as',
      find:"    s += gLine('gw-arm', G.pvx, G.pvy, polarX(G.pvx, deg, G.pr), polarY(G.pvy, deg, G.pr), '#2B2A33', 2);",
      replace:"    s += gLine('gw-arm', G.pvx, G.pvy, polarX(G.pvx, deg + 10, G.pr), polarY(G.pvy, deg + 10, G.pr), '#2B2A33', 2);" },
    { file:'index', expect:'gComboNo zh',
      find:"(s > W ? '比合起來的 ' + W + '° 多了 ' + (s - W) + '°。' : '比合起來的 ' + W + '° 少了 ' + (W - s) + '°。')",
      replace:"(s < W ? '比合起來的 ' + W + '° 多了 ' + (W - s) + '°。' : '比合起來的 ' + W + '° 少了 ' + (s - W) + '°。')" },
    { file:'index', expect:'a drop outside the "?" (or after it is filled)',
      find:'          if (filled || !comboInGap(e, pt.x, pt.y)) return false;', replace:'          if (!comboInGap(e, pt.x, pt.y)) return false;' },
    { file:'index', expect:'is not below the bottom side',
      find:'trayY:246, trayX:[39, 113, 187, 261]', replace:'trayY:200, trayX:[39, 113, 187, 261]' },
    { file:'index', expect:'already in increasing order',
      find:'    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n', replace:'    a.sort(function(x, y){ return x < y ? -1 : 1; });\n' },
    { file:'index', expect:'first match, not nearest',
      find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (!best){ bd = dd; bc = dc; best = b; }' },
    { file:'index', expect:'a mistake does not cost 5',
      find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;\n', replace:'    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;\n' },
    { file:'index', expect:'board-generation guard',
      find:'      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n', replace:'' },
    { file:'index', expect:'the second puzzle does not get a new board generation',
      find:'        if (k > 0) gGen++;', replace:'        if (k < 0) gGen++;' },
    { file:'index', expect:'GAME_TURN[0][1] is a hole',
      find:'  var GAME_TURN = [[2, 3, 5],', replace:'  var GAME_TURN = [[2, , 5],' },
    { file:'index', expect:'GAME_KIND[0][1] is a hole',
      find:'  var GAME_KIND = [[35, 89, 90, 91, 180],', replace:'  var GAME_KIND = [[35, , 90, 91, 180],' },
    { file:'index', expect:'GAME_COMBO[0].x[1] is a hole',
      find:'    { W:180, a:115, x:[115, 75, 55] },', replace:'    { W:180, a:115, x:[115, , 55] },' },
    { file:'index', expect:'tapping a destination does not call the drop once',
      find:'      if (!gSolved) tryDrop(P, { x:pt.x, y:pt.y, tap:true });', replace:'      if (!gSolved) tryDrop(P, { x:pt.x, y:pt.y });' },
    { file:'index', expect:'places a piece that another finger is still dragging',
      find:'      if (P.busy()) return;   /* 這一塊正被另一根手指拖著：點目的地不算數，等它放開 */\n', replace:'' },
    { file:'index', expect:'pointerdown does not ignore a second finger',
      find:'      if (P.locked || gSolved || start) return;', replace:'      if (P.locked || gSolved) return;' },
    { file:'index', expect:'the board-generation guard does not come before',
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n      /* 先點選", replace:"      /* 先點選" },
    { file:'index', expect:'gKindWhy zh 35',
      find:"        return k === 'acute' ? deg + '° 比 90° 小'", replace:"        return k === 'acute' ? deg + '° 比 90° 大'" },
    { file:'index', expect:'onDrop is not the round\'s own drop handler',
      find:'    B.onDrop = tryDrop;\n  }', replace:'    B.onDrop = function(){ return false; };\n  }' },
    { file:'index', expect:'the board-generation guard does not come before',
      find:"      el.classList.remove('dragging');\n      if (gen !== gGen) return;", replace:"      el.classList.remove('dragging');\n      if (gen !== gGen && cancelled) roundMiss('x');\n      if (gen !== gGen) return;" },
    { file:'index', expect:'onDrop is not the round\'s own drop handler',
      find:'    B.onDrop = tryDrop;\n  }', replace:'    B.onDrop = B.el ? function(){ return false; } : tryDrop;\n  }' },
    { file:'index', expect:'useTapSelect() reassigns tryDrop',
      find:'    B.onDrop = tryDrop;\n  }', replace:'    if (B.el.nodeType) tryDrop = function(){ return false; };\n    B.onDrop = tryDrop;\n  }' },
    { file:'index', expect:'declares function end() 2 times',
      find:'  function useTapSelect(B, tryDrop){', replace:'  function end(e, cancelled){ return; }\n  function useTapSelect(B, tryDrop){' },
    { file:'index', expect:'does not snap to the mark WHILE it is dragged',
      find:'            if (h) P.place(polarX(G.cx, h.th, G.markR), polarY(h.r.cy, h.th, G.markR));\n            else P.place(fx, fy);', replace:'            P.place(fx, fy);' },
    { file:'index', expect:'does not judge exactly the mark it was shown on',
      find:'release: function(){ var h = aim; aim = null;', replace:'release: function(){ var h = hitAt(P.cx + 6, P.cy); aim = null;' },
    { file:'index', expect:'the side is not drawn live',
      find:"arm:(aim && aim.r === r) ? aim.th : null, armCls:'gp-aim'", replace:"arm:null, armCls:'gp-aim'" },
    { file:'index', expect:'would be judged as',
      find:'markR:127,', replace:'markR:160,' },
    { file:'index', expect:'the live side is not dashed',
      find:".replace('/>', o.armCls === 'gp-aim' ? ' stroke-dasharray=\"7 5\"/>' : '/>');", replace:";" },
    { file:'index', expect:'of the printed',
      find:'numPad:0.5, tickTol:3 };', replace:'numPad:-3, tickTol:3 };' },
    { file:'index', expect:'a tap at (',
      find:'numPad:0.5, tickTol:3 };', replace:'numPad:0.5, tickTol:0 };' },
    { file:'index', expect:'drag and tap must both use drawPick()',
      find:'var th = drawPick(r.cy, x, y); if (th !== null) hit', replace:'var th = drawSnap(r.cy, x, y); if (th !== null) hit' },
    { file:'index', expect:'is not where/what the protractor draws',
      find:"                   w:String(v).length * f * 0.6 + 2 * G.numPad, up:f * 0.75 + G.numPad, down:f * 0.65 + G.numPad });", replace:"                   w:String(v).length * f * 0.6 + 2 * G.numPad, up:f * 0.35 + G.numPad, down:f * 0.65 + G.numPad });" },
    { file:'index', expect:'near the vertex is ignored',
      find:'near:5, tapTol:16, tapMinR:6,', replace:'near:5, tapTol:16, tapMinR:30,' },
    { file:'index', expect:'closer to it than to the bottom side',
      find:' && perp <= G.tapTol && toArm < toBase;', replace:' && perp <= G.tapTol;' },
    { file:'index', expect:'a number\'s tap box reaches over the ticks',
      find:'numPad:0.5, tickTol:3 };', replace:'numPad:1.5, tickTol:3 };' },
    { file:'index', expect:'drawPick constants changed',
      find:'numPad:0.5, tickTol:3 };', replace:'numPad:0.5, tickTol:40 };' },
    { file:'index', expect:'a tap at (',
      find:'    if (tk !== null) return tk;                         /* 點在刻度上 */\n', replace:'' },
    { file:'index', expect:'lostpointercapture',
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'combo: the round does not install',
      find:"        useTapSelect(B, function(P, pt){\n          if (filled", replace:"        B.onDrop = (function(P, pt){\n          if (filled" },
    { file:'index', expect:'ahead mode does not show hint level 1',
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'ahead'){ hintLevel = 0; }" },
    { file:'index', expect:'but the en dictionary has no gTurnBtn',
      find:"      gTurnBtn:'Done ✔',\n", replace:'' },

    /* ---------- index.html：字典與題庫 ---------- */
    { file:'index', expect:'the range table says',
      find:"        obtuse:'大於 90° 而且小於 180°',\n        straight:'剛好 180°（兩條邊拉成一直線）'",
      replace:"        obtuse:'大於 90°',\n        straight:'剛好 180°（兩條邊拉成一直線）'" },
    { file:'index', expect:'does not name 鈍角',
      find:"      kinds:{ acute:'銳角', right:'直角', obtuse:'鈍角', straight:'平角', full:'周角' },",
      replace:"      kinds:{ acute:'銳角', right:'直角', obtuse:'平角', straight:'鈍角', full:'周角' }," },
    /* 只動 full（分類的敘述用不到它），才孤立得到「字典的名字表要逐字相同」那一條。 */
    { file:'index', expect:'the kinds table says',
      find:"straight:'平角', full:'周角' },\n      kindRange:{",
      replace:"straight:'平角', full:'圓角' },\n      kindRange:{" },
    { file:'index', expect:'the turn table says',
      find:"      turnNames:['十二分之一圈','六分之一圈','四分之一圈','三分之一圈','半圈','三分之二圈','四分之三圈','一整圈'],",
      replace:"      turnNames:['十二分之一圈','六分之一圈','四分之一圈','三分之一圈','半圈','三分之二圈','三分之四圈','一整圈']," },
    { file:'index', expect:'marked answer is',
      find:"        { stem:'一個角是 128°，它是什麼角？', opts:['鈍角','銳角','直角','平角'], ans:0,",
      replace:"        { stem:'一個角是 128°，它是什麼角？', opts:['鈍角','銳角','直角','平角'], ans:1," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'一個角是 45°，它是什麼角？', opts:['直角','鈍角','平角','銳角'], ans:3,",
      replace:"        { stem:'一個角是 145°，它是什麼角？', opts:['直角','鈍角','平角','銳角'], ans:3," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'文字題：時鐘的時針從 2 走到 6，走過的角是幾度？', opts:['40°','60°','90°','120°'], ans:3,",
      replace:"        { stem:'文字題：時鐘的時針從 2 走到 5，走過的角是幾度？', opts:['40°','60°','90°','120°'], ans:3," },
    /* 題幹不動、只改 ans —— 這樣才孤立得到「鐘面題的正解由鐘點重算」那一條。 */
    { file:'index', expect:'recomputed "120°"',
      find:"        { stem:'文字題：時鐘的時針從 2 走到 6，走過的角是幾度？', opts:['40°','60°','90°','120°'], ans:3,\n          why:'鐘面一整圈",
      replace:"        { stem:'文字題：時鐘的時針從 2 走到 6，走過的角是幾度？', opts:['40°','60°','90°','120°'], ans:2,\n          why:'鐘面一整圈" },
    { file:'index', expect:'the explanation never states',
      find:"          why:'平角是 180°。合成是相加，所以分解就是相減：180° － 115° ＝ 65°。' }",
      replace:"          why:'平角是 180°。合成是相加，所以分解就是相減，用減的就算得出來。' }" },
    { file:'index', expect:'s2h2 no longer says',
      find:"      s2h2:'量角器：三個步驟量出角度',",
      replace:"      s2h2:'量角器：兩個步驟量出角度'," },
    { file:'index', expect:'s3h2 no longer says',
      find:"      s3h2:'用量角器畫角：四個步驟',",
      replace:"      s3h2:'用量角器畫角：三個步驟'," },
    { file:'index', expect:'does not print the answer',
      find:"      s2result: function(ans){ return '這個角是 ' + ans + '°'; },",
      replace:"      s2result: function(ans){ return '這個角量好了'; }," },
    { file:'index', expect:'does not print the reading both rows agree on',
      find:"      s2same: function(ans){ return '　這一格剛好是兩排數字一樣的那一格（都是 ' + ans + '），所以讀哪一排都得到同一個答案。'; },",
      replace:"      s2same: function(ans){ return '　讀哪一排都一樣。'; }," },
    { file:'index', expect:'does not print',
      find:"      s5add: function(a, b, t){ return a + '° ＋ ' + b + '° ＝ ' + t + '°'; },",
      replace:"      s5add: function(a, b, t){ return a + '° ＋ ' + b + '° 合起來'; }," },
    { file:'index', expect:'s1result',
      find:"      s1result: function(name, deg){ return name + ' ＝ ' + deg + '°'; },",
      replace:"      s1result: function(name, deg){ return name + ' 算好了'; }," },

    /* ---------- reference.html ---------- */
    { file:'reference', expect:'no longer says "你把哪一端的 0 對準那條邊，就一路讀那一排"',
      find:'<b>你把哪一端的 0 對準那條邊，就一路讀那一排。</b><br>同一格的兩個數字<b>加起來永遠是 180</b>。</p>\n\n    <h2 data-i18n="s2">',
      replace:'<b>看情況決定要讀哪一排。</b><br>同一格的兩個數字<b>加起來永遠是 180</b>。</p>\n\n    <h2 data-i18n="s2">' },
    { file:'reference', expect:'no longer says "大於 90° <strong>而且</strong>小於 180°"',
      find:'          <td data-i18n="k3b">大於 90° <strong>而且</strong>小於 180°</td>',
      replace:'          <td data-i18n="k3b">比 90° 大</td>' },
    { file:'reference', expect:'no longer says "半圓量角器"',
      find:'    <p class="scopebox" data-i18n="scope">這一課用的是<strong>半圓量角器</strong>',
      replace:'    <p class="scopebox" data-i18n="scope">這一課用的是<strong>量角器</strong>' },
    { file:'reference', expect:'says "比 90° 大的角都是鈍角"',
      find:'      <div class="swapcard" data-i18n="sw2">「比 90° 大」還不夠 —— 180° 也比 90° 大</div>',
      replace:'      <div class="swapcard" data-i18n="sw2">比 90° 大的角都是鈍角</div>' },
    { file:'reference', expect:'kind table has 直角 before 銳角',
      find:'          <td data-i18n="k1a">銳角</td>\n          <td data-i18n="k1b">大於 0° 而且小於 90°</td>\n          <td class="eq" data-i18n="k1c">35°、89°</td>\n        </tr>\n        <tr>\n          <td data-i18n="k2a">直角</td>',
      replace:'          <td data-i18n="k1a">直角</td>\n          <td data-i18n="k1b">大於 0° 而且小於 90°</td>\n          <td class="eq" data-i18n="k1c">35°、89°</td>\n        </tr>\n        <tr>\n          <td data-i18n="k2a">銳角</td>' },
    { file:'reference', expect:'no longer says "semicircular protractor"',
      find:"      scope:'This lesson uses a <strong>semicircular protractor</strong>",
      replace:"      scope:'This lesson uses a <strong>protractor</strong>" },
    /* codex 第一輪 #2：速查卡不可以把「內外圈」講成通則。 */
    { file:'reference', expect:'no longer says "真的量角器不一定這樣排"',
      find:'（本課圖上的量角器是右端的 0 在內圈、左端的 0 在外圈；<strong>真的量角器不一定這樣排</strong>，所以要看 0 在哪一端，不是背內外。）讀錯排會得到 180 減掉答案的那個數。</td>',
      replace:'對準右邊那條邊就讀內圈，對準左邊那條邊就讀外圈。讀錯排會得到 180 減掉答案的那個數。</td>' },
    /* codex 第一輪 #3：125° 不是「同一個角換一端量」的結果。 */
    { file:'reference', expect:'no longer says "直線<strong>另一半</strong>之間的角"',
      find:'      <span class="small" data-i18n="mdemos">注意這張圖的直邊躺在一條直線上：從右端的 0 數到那條斜邊是 55°，從左端的 0 數到<strong>同一條斜邊</strong>是 125°—— 那量的是斜邊和直線<strong>另一半</strong>之間的角，兩個合起來剛好 180°。所以題目一定要先講清楚 0 對準的是哪一條邊。</span>',
      replace:'      <span class="small" data-i18n="mdemos">如果 0 對準的是左邊那條邊，量的就是另一個角，同一張圖要讀外圈的 125°。</span>' },
    { file:'reference', expect:'no longer says "量角的三個步驟"',
      find:"      s2:'量角的三個步驟',",
      replace:"      s2:'量角的幾個步驟'," },

    /* ---------- parents.html ---------- */
    { file:'parents', expect:'no longer says "角度闖關"',
      find:'<div class="readybox" data-i18n="readyBox">精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「角度闖關」有通關</strong>',
      replace:'<div class="readybox" data-i18n="readyBox">精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲有通關</strong>' },
    { file:'parents', expect:'no longer says "同一格的兩個數字加起來一定是 180"',
      find:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的那一點：</strong>大人覺得量角器「就是把它放上去讀數字」，於是孩子讀錯排時只會說「你看錯了」。真正的關鍵是<strong>量角器左右兩端各有一個 0，所以有兩排數字，同一格的兩個數字加起來一定是 180</strong>',
      replace:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的那一點：</strong>大人覺得量角器「就是把它放上去讀數字」，於是孩子讀錯排時只會說「你看錯了」。真正的關鍵是<strong>量角器左右兩端各有一個 0，所以有兩排數字</strong>' },
    { file:'parents', expect:'says "銳角一定大於 90°"',
      find:'銳角一定小於 90°、鈍角一定大於 90°；數字和眼睛看到的不合，就回頭檢查兩件事：量角器有沒有擺好（中心點對頂點、0 對準邊），以及讀的是不是該讀的那一排。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>',
      replace:'銳角一定大於 90°、鈍角一定小於 90°；數字和眼睛看到的不合，就回頭檢查兩件事：量角器有沒有擺好（中心點對頂點、0 對準邊），以及讀的是不是該讀的那一排。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>' },
    /* codex 第一輪 #1：「對不上就是讀錯排」太滿 —— 量角器沒擺好也會對不上。 */
    { file:'parents', expect:'says "就是讀錯排了"',
      find:'數字和眼睛看到的不合，就回頭檢查兩件事：量角器有沒有擺好（中心點對頂點、0 對準邊），以及讀的是不是該讀的那一排。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>',
      replace:'數字和眼睛看到的不合，就是讀錯排了。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>' },
    /* codex 第一輪 #2：家長頁不可以把「內外圈」講成通則。 */
    { file:'parents', expect:'no longer says "真的量角器兩排的內外位置不一定一樣"',
      find:'這句話才是規則，「一律讀內圈」或「一律讀外圈」都不是（真的量角器兩排的內外位置不一定一樣）。教孩子一個永遠管用的自我檢查：<strong>先用眼睛判斷這個角比直角大還是小</strong>，銳角一定小於 90°、鈍角一定大於 90°；數字和眼睛看到的不合，就回頭檢查兩件事：量角器有沒有擺好（中心點對頂點、0 對準邊），以及讀的是不是該讀的那一排。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>',
      replace:'這句話才是規則。教孩子一個永遠管用的自我檢查：<strong>先用眼睛判斷這個角比直角大還是小</strong>，銳角一定小於 90°、鈍角一定大於 90°；數字和眼睛看到的不合，就回頭檢查兩件事：量角器有沒有擺好（中心點對頂點、0 對準邊），以及讀的是不是該讀的那一排。另外還有一個大人自己也會講錯的地方：<strong>「比 90° 大的就是鈍角」是錯的</strong>——180° 也比 90° 大，可是它是平角。鈍角要同時滿足兩個條件：大於 90°，而且小於 180°。</p>' },
    { file:'parents', expect:'no longer says "more than 90°, and less than 180°"',
      find:'An obtuse angle has to satisfy both conditions: more than 90°, and less than 180°.',
      replace:'An obtuse angle just has to be bigger than 90°.' },
    { file:'parents', expect:'no longer says "Angle Challenge"',
      find:'and <strong>clearing the “Angle Challenge” game</strong>',
      replace:'and <strong>clearing the game</strong>' },
    { file:'parents', expect:'no longer says "優角"',
      find:'分類也只講到平角 180°，<strong>大於 180° 的角（優角）刻意不碰</strong>。三年級的「角度大搜查」已經教過角是什麼、怎麼不用度數比大小；三角形的<strong>內角和</strong>則是五年級的單元。",',
      replace:'分類也只講到平角 180°。三年級的「角度大搜查」已經教過角是什麼、怎麼不用度數比大小；三角形的<strong>內角和</strong>則是五年級的單元。",' }
  ],

  sim: {
    /* fmt() 要印角的名字與轉法的名字，那些表宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    INVARIANTS: {
      protractorRead: d => {
        if (d.correct < DEG_MIN || d.correct > DEG_MAX) return 'protractorRead: the angle is outside 1~179';
        if (d.correct % 5 !== 0) return 'protractorRead: the angle is not on a 5-degree mark';
        if (d.other !== STRAIGHT - d.correct) return 'protractorRead: other is not 180 minus the answer';
        if (d.correct === RIGHT) return 'protractorRead: at 90 both rows read the same, so there is nothing to pick';
        if (d.acute !== (d.correct < RIGHT)) return 'protractorRead: acute does not match the answer';
        /* 題幹說「明顯比直角小／大」—— 那句話必須真的成立。 */
        if (Math.abs(d.correct - RIGHT) < 20)
          return 'protractorRead: ' + d.correct + ' is not clearly on one side of a right angle, so the stem is not true';
      },
      wrongScale: d => {
        if (d.a < DEG_MIN || d.a > DEG_MAX) return 'wrongScale: a is outside 1~179';
        if (d.a === RIGHT) return 'wrongScale: at 90 both rows read the same, so there is nothing to ask';
        if (d.correct !== STRAIGHT - d.a) return 'wrongScale: correct is not 180 minus a';
        if (d.correct < DEG_MIN || d.correct > DEG_MAX) return 'wrongScale: the answer is outside 1~179';
      },
      classify: d => {
        if (d.deg < DEG_MIN || d.deg > STRAIGHT) return 'classify: the angle is outside 1~180';
        const want = kindRef(d.deg);
        if (want === null) return 'classify: the angle has no name in this lesson';
        if (d.correct !== want) return 'classify: correct is not the kind of ' + d.deg + ' (' + d.correct + ' vs ' + want + ')';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'classify: the four names are not all different';
        if (['acute','right','obtuse','straight'].some(k => d.opts.indexOf(k) < 0))
          return 'classify: the options are not the four kind names';
      },
      pickKind: d => {
        if (d.want !== 'acute' && d.want !== 'obtuse') return 'pickKind: want must be acute or obtuse';
        if (kindRef(d.correct) !== d.want) return 'pickKind: the marked answer is not ' + d.want;
        const hits = d.opts.filter(v => kindRef(v) === d.want);
        if (hits.length !== 1) return 'pickKind: ' + hits.length + ' options are ' + d.want + ' (' + hits.join(',') + ')';
        if (new Set(d.opts).size !== d.opts.length) return 'pickKind: duplicate option values';
        if (d.opts.some(v => v < DEG_MIN || v > STRAIGHT)) return 'pickKind: an option is outside 1~180';
      },
      turnToDeg: d => {
        const row = TURNS[d.idx];
        if (!row) return 'turnToDeg: idx out of the turn table';
        if (d.num !== row.num || d.den !== row.den) return 'turnToDeg: num/den do not match the turn table';
        if (d.correct !== FULL * row.num / row.den)
          return 'turnToDeg: correct is not 360 x ' + row.num + '/' + row.den;
        if (!Number.isInteger(d.correct) || d.correct < DEG_MIN || d.correct > FULL)
          return 'turnToDeg: the answer is outside 1~360';
      },
      degToTurn: d => {
        const row = TURNS[d.idx];
        if (!row) return 'degToTurn: idx out of the turn table';
        if (d.deg !== row.deg) return 'degToTurn: deg does not match the turn table (' + d.deg + ' vs ' + row.deg + ')';
        if (d.deg !== FULL * row.num / row.den) return 'degToTurn: the turn table row is not 360 x num/den';
        if (new Set(d.opts).size !== d.opts.length) return 'degToTurn: duplicate option rows';
        if (d.opts.indexOf(d.idx) < 0) return 'degToTurn: the answer is not among the options';
      },
      clockHour: d => {
        if (d.k < 1 || d.k > 6) return 'clockHour: the hand moves ' + d.k + ' slots, expected 1~6';
        if (d.h1 < 1 || d.h2 > 12) return 'clockHour: the hours are outside 1~12';
        if (d.h2 !== d.h1 + d.k) return 'clockHour: h2 is not h1 plus k';
        if (d.correct !== d.k * (FULL / 12)) return 'clockHour: correct is not k x 30';
        if (d.correct > STRAIGHT) return 'clockHour: the answer is over 180, but this generator only ever spans 1~6 slots';
      },
      sumAngles: d => {
        if (d.a === d.b) return 'sumAngles: the two angles are equal, so the difference distractor collapses';
        if (d.a < DEG_MIN || d.b < DEG_MIN) return 'sumAngles: an angle is below 1 degree';
        if (d.correct !== d.a + d.b) return 'sumAngles: correct is not a plus b';
        if (d.correct > STRAIGHT) return 'sumAngles: the whole angle is over 180, outside this lesson';
      },
      partOfWhole: d => {
        if (d.whole !== RIGHT && d.whole !== STRAIGHT) return 'partOfWhole: whole must be 90 or 180';
        if (d.correct !== d.whole - d.a) return 'partOfWhole: correct is not the whole minus the known part';
        if (d.a < DEG_MIN || d.a >= d.whole) return 'partOfWhole: the known part is outside the whole';
        if (d.correct === d.a) return 'partOfWhole: the answer equals the angle printed in the stem';
        if (d.correct < DEG_MIN || d.correct > DEG_MAX) return 'partOfWhole: the answer is outside 1~179';
      },
      toolRule: d => {
        if (!Number.isInteger(d.rid) || d.rid < 0 || d.rid >= RULES.zh.length)
          return 'toolRule: rid out of the rule table';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'toolRule: the four option slots are not distinct';
        if (d.opts.indexOf(0) < 0) return 'toolRule: the correct slot is not among the options';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，不呼叫產生器的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'protractorRead':
          return (d.acute ? Math.min(d.correct, d.other) : Math.max(d.correct, d.other)) + '°';
        case 'wrongScale':  return (STRAIGHT - d.a) + '°';
        case 'classify':    return KIND_NAMES[lang][kindRef(d.deg)];
        case 'pickKind': {
          const hits = d.opts.filter(v => kindRef(v) === d.want);
          return hits.length === 1 ? hits[0] + '°' : null;
        }
        case 'turnToDeg':   return (FULL * TURNS[d.idx].num / TURNS[d.idx].den) + '°';
        case 'degToTurn': {
          const hit = TURNS.map((r, i) => (r.deg === d.deg ? i : -1)).filter(i => i >= 0);
          return hit.length === 1 ? TURN_NAMES[lang][hit[0]] : null;
        }
        case 'clockHour':   return ((d.h2 - d.h1) * (FULL / 12)) + '°';
        case 'sumAngles':   return (d.a + d.b) + '°';
        case 'partOfWhole': return (d.whole - d.a) + '°';
        case 'toolRule':    return RULES[lang][d.rid].a;
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：資料全對、選項全對，印錯一樣會教錯。 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const why = String(q.why).replace(/<[^>]+>/g, ' ');
      const T = RULES[lang];

      if (/\d\.\d/.test(stem) || /\d\.\d/.test(String(q.opts.join(' '))))
        return genId + ' prints a decimal, but every angle in this lesson is a whole number of degrees';

      if (genId === 'protractorRead'){
        const lo = Math.min(d.correct, d.other), hi = Math.max(d.correct, d.other);
        if (!printsNum(stem, lo) || !printsNum(stem, hi))
          return 'protractorRead stem does not print both readings ' + lo + ' and ' + hi;
        if (!printsNum(why, d.correct)) return 'protractorRead why never states the answer ' + d.correct;
        if (!printsNum(why, d.other)) return 'protractorRead why does not mention the other row ' + d.other;
        if (!printsNum(why, STRAIGHT)) return 'protractorRead why does not say the two rows add up to 180';
      }
      if (genId === 'wrongScale'){
        if (!printsNum(stem, d.a)) return 'wrongScale stem does not print ' + d.a;
        if (!printsNum(why, d.correct)) return 'wrongScale why never states the answer ' + d.correct;
        if (!printsNum(why, STRAIGHT)) return 'wrongScale why does not say the two rows add up to 180';
      }
      if (genId === 'classify'){
        if (!printsNum(stem, d.deg)) return 'classify stem does not print the angle ' + d.deg;
        const k = kindRef(d.deg);
        if (why.indexOf(KIND_NAMES[lang][k]) < 0) return 'classify why does not name ' + KIND_NAMES[lang][k];
        const rangeWord = KIND_RANGE[lang][k].replace(/（[\s\S]*$/, '').replace(/ \([\s\S]*$/, '');
        if (why.indexOf(rangeWord) < 0)
          return 'classify why does not use this lesson\'s range wording for ' + k + ' ("' + rangeWord + '")';
      }
      if (genId === 'pickKind'){
        if (stem.indexOf(KIND_NAMES[lang][d.want]) < 0)
          return 'pickKind stem does not name ' + KIND_NAMES[lang][d.want];
        if (!printsNum(why, d.correct)) return 'pickKind why never states the answer ' + d.correct;
      }
      if (genId === 'turnToDeg'){
        if (stem.indexOf(TURN_NAMES[lang][d.idx]) < 0)
          return 'turnToDeg stem does not name the turn "' + TURN_NAMES[lang][d.idx] + '"';
        if (!printsNum(why, d.correct)) return 'turnToDeg why never states the answer ' + d.correct;
        if (!printsNum(why, FULL / d.den)) return 'turnToDeg why does not state the size of one part';
      }
      if (genId === 'degToTurn'){
        if (!printsNum(stem, d.deg)) return 'degToTurn stem does not print ' + d.deg;
        if (why.indexOf(TURN_NAMES[lang][d.idx]) < 0)
          return 'degToTurn why does not name the turn "' + TURN_NAMES[lang][d.idx] + '"';
      }
      if (genId === 'clockHour'){
        if (!printsNum(stem, d.h1) || !printsNum(stem, d.h2))
          return 'clockHour stem does not print both hours ' + d.h1 + ' and ' + d.h2;
        if (!printsNum(why, d.correct)) return 'clockHour why never states the answer ' + d.correct;
        if (!printsNum(why, FULL / 12)) return 'clockHour why does not state that one slot is 30 degrees';
        /* 選項是度數，鐘點只到 12 —— 冒出一個和鐘點一樣的選項會讓題目變含糊。 */
        if (d.opts.some(v => v === d.h1 || v === d.h2))
          return 'clockHour offers an option that is also one of the clock numbers in the stem';
      }
      if (genId === 'sumAngles'){
        if (!printsNum(stem, d.a) || !printsNum(stem, d.b))
          return 'sumAngles stem does not print both angles ' + d.a + ' and ' + d.b;
        if (!printsNum(why, d.correct)) return 'sumAngles why never states the answer ' + d.correct;
        /* 「拼在一起就相加」只有在沒有重疊時才成立 —— 題幹必須把那個條件講出來。 */
        const overlapCue = (lang === 'zh') ? '沒有重疊' : 'not overlapping';
        if (stem.indexOf(overlapCue) < 0)
          return 'sumAngles stem no longer says the two angles do not overlap, so adding is not justified';
      }
      if (genId === 'partOfWhole'){
        if (!printsNum(stem, d.a)) return 'partOfWhole stem does not print the known part ' + d.a;
        const wn = KIND_NAMES[lang][d.whole === RIGHT ? 'right' : 'straight'];
        if (stem.indexOf(wn) < 0) return 'partOfWhole stem does not name the whole angle "' + wn + '"';
        if (!printsNum(why, d.whole) || !printsNum(why, d.correct))
          return 'partOfWhole why does not show ' + d.whole + ' minus ' + d.a + ' = ' + d.correct;
      }
      if (genId === 'toolRule'){
        if (String(q.stem) !== T[d.rid].q)
          return 'toolRule: stem does not match the rule table for rule ' + d.rid;
        if (why.indexOf(T[d.rid].a) < 0)
          return 'toolRule: the explanation does not state the rule table answer';
        /* 選項要剛好是**這一條規則自己的**正解＋三個誘答。只比「有沒有出現在整張表裡」
           的話，換成別條規則的誘答（例如把「角的開口正中間」換成「100 等份」）也會過，
           那一題就變成兩個選項都講得通（codex #6）。 */
        const wantSet = [T[d.rid].a].concat(T[d.rid].w).slice().sort().join('\u0001');
        const gotSet = q.opts.map(String).slice().sort().join('\u0001');
        if (wantSet !== gotSet)
          return 'toolRule: the options are not exactly rule ' + d.rid + " own answer plus its three distractors";
      }

      /* 度數選項一律是「整數＋度」。 */
      if (TEXT_GENS.indexOf(genId) < 0){
        for (const o of q.opts){
          if (degValue(o) === null) return genId + ' option "' + o + '" is not a whole number of degrees';
        }
      }
      return null;
    },

    /* 這一課的選項都帶著「°」，題幹印的是純數字，所以 simgen 的「誘答抄題幹」
       （字串比對）本來就不會命中；刻意的迷思誘答（讀錯排的 180 − a、
       以為兩排一樣的 a）由上面的 renderCheck 與 INVARIANTS 各自盯著。 */
    stemEchoOk: {},

    /* 選項的形狀與範圍。文字題的選項要落在這一課自己的真值表裡。 */
    optionOk: function(s, genId, lang){
      const str = String(s);
      if (/[·#]/.test(str)) return 'junk option ' + str;
      if (genId === 'classify'){
        const allowed = ['acute','right','obtuse','straight'].map(k => KIND_NAMES[lang][k]);
        return (allowed.indexOf(str) < 0) ? 'classify option "' + str + '" is not one of the four kind names' : null;
      }
      if (genId === 'degToTurn'){
        return (TURN_NAMES[lang].indexOf(str) < 0) ? 'degToTurn option "' + str + '" is not in the turn table' : null;
      }
      if (genId === 'toolRule'){
        const ok = RULES[lang].some(r => r.a === str || r.w.indexOf(str) >= 0);
        return ok ? null : 'toolRule option "' + str + '" is not in the rule table';
      }
      const v = degValue(str);
      if (v === null) return 'option "' + str + '" is not a whole number of degrees';
      const [lo, hi] = RANGE[genId] || [DEG_MIN, STRAIGHT];
      if (!(v >= lo && v <= hi)) return 'option ' + str + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{DEG_MIN, DEG_MAX, RIGHT_DEG, STRAIGHT_DEG, FULL_TURN, ' +
                'PROT_W, PROT_H, PROT_CX, PROT_CY, PROT_R, TICK_LEN_LONG, TICK_LEN_MID, ' +
                'LBL_R_OUT, LBL_R_IN, LBL_FONT, ARM_LEN, ARC_R, ARC_GAP, ARC_LBL_R, ARC_LBL_GAP, ARC_LBL_FONT, ' +
                'VERTEX_R, VERTEX_LBL_DY, VERTEX_FONT, MARK_R, ' +
                'TURN_W, TURN_H, TURN_CX, TURN_CY, TURN_R, TURN_TICK_LEN, TURN_LBL_R, TURN_LBL_FONT, TURN_ARC_R, ' +
                'polarX, polarY, labelAt, scaleOf, baseDeg, armDeg, readingOf, ' +
                'tickList, labelList, armList, arcPath, ' +
                'TURN_TABLE, turnKind, MEASURE_CASES, DRAW_CASES, measureSteps, drawSteps, ' +
                'CLASS_CASES, kindOf, KIND_ORDER, COMBO_CASES, ' +
                'GAME_ORDER, GAME_PAD, gSvgOpen, protNumbers, drawPick, TURN_G, GAME_TURN, turnAngleAt, turnSnap, turnSVG, ' +
                'PROT_G, GAME_READ, GAME_DRAW, beadStart, beadOf, protPolar, beadAngle, drawSnap, protSVG, ' +
                'KIND_G, GAME_KIND, kindBinX, kindSlot, kindCardSVG, COMBO_G, GAME_COMBO, comboInGap, comboSVG, wedgeSVG}',
    optionValueMax: FULL,

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      /* ---------- 0. 這一課宣告的範圍 ---------- */
      if (data.DEG_MIN !== DEG_MIN || data.DEG_MAX !== DEG_MAX)
        fail(`the lesson measures ${data.DEG_MIN}~${data.DEG_MAX}, this config assumes ${DEG_MIN}~${DEG_MAX}`);
      if (data.RIGHT_DEG !== RIGHT || data.STRAIGHT_DEG !== STRAIGHT || data.FULL_TURN !== FULL)
        fail('the lesson\'s right/straight/full-turn constants do not match this config');

      /* ---------- 1. 分類的界線：兩套寫法必須對整個定義域一致 ----------
         「比 90° 大就是鈍角」在 180° 上是假的，所以整段掃過去，不是只驗幾個好記的值。 */
      let kindFails = 0;
      for (let deg = 0; deg <= 361; deg++){
        const a = data.kindOf(deg), b = kindRef(deg);
        if (a !== b && kindFails++ < 5)
          fail(`kindOf(${deg}) = ${a} disagrees with the second implementation (${b})`);
      }
      if (!Array.isArray(data.KIND_ORDER) || data.KIND_ORDER.join(',') !== 'acute,right,obtuse,straight')
        fail('KIND_ORDER is not acute,right,obtuse,straight (the table must run from small to large)');

      /* ---------- 2. 版面常數 ---------- */
      const NUMS = ['PROT_W','PROT_H','PROT_CX','PROT_CY','PROT_R','TICK_LEN_LONG','TICK_LEN_MID',
                    'LBL_R_OUT','LBL_R_IN','LBL_FONT','ARM_LEN','ARC_R','ARC_GAP','ARC_LBL_R',
                    'ARC_LBL_GAP','ARC_LBL_FONT','VERTEX_R','VERTEX_LBL_DY','VERTEX_FONT','MARK_R',
                    'TURN_W','TURN_H','TURN_CX','TURN_CY','TURN_R','TURN_TICK_LEN','TURN_LBL_R',
                    'TURN_LBL_FONT','TURN_ARC_R'];
      NUMS.forEach(n => {
        const v = data[n];
        if (!(typeof v === 'number' && isFinite(v) && v > 0)) fail(`layout constant ${n} is not a positive number (${v})`);
      });
      if (!(data.LBL_R_IN < data.LBL_R_OUT))
        fail(`the two rows of numbers sit at the same radius or the wrong way round (in ${data.LBL_R_IN}, out ${data.LBL_R_OUT})`);
      if (!(data.LBL_R_OUT < data.PROT_R - data.TICK_LEN_LONG))
        fail('the outer row of numbers is drawn on top of the tick marks');
      if (!(data.TICK_LEN_MID < data.TICK_LEN_LONG))
        fail('the 5-degree ticks are not shorter than the 10-degree ticks');
      if (!(data.ARC_R < data.PROT_R && data.ARC_LBL_R < data.ARM_LEN))
        fail('the angle arc or its label is drawn outside the protractor');

      /* ---------- 3. 量角器的幾何：把函式跑起來，用 atan2 量回去 ---------- */
      const CX = data.PROT_CX, CY = data.PROT_CY;
      const ticks = data.tickList();
      if (!Array.isArray(ticks) || ticks.length !== 37)
        fail(`tickList() returned ${ticks ? ticks.length : 'no'} ticks, expected 37 (0~180 every 5 degrees)`);
      let tickFails = 0;
      /* 用索引迴圈：`delete ticks[10]` 長度不變，forEach 卻會跳過那一根，
         畫面上少一根刻度也是綠的（codex：稀疏陣列）。 */
      for (let i = 0; i < (ticks || []).length; i++){
        if (tickFails > 4) break;
        if (!Object.prototype.hasOwnProperty.call(ticks, i)){
          tickFails++; fail(`tick ${i} is a hole in the array, so the whole mark is missing`); continue;
        }
        const tk = ticks[i];
        const want = i * 5;
        if (tk.deg !== want){ tickFails++; fail(`tick ${i} says deg ${tk.deg}, expected ${want}`); continue; }
        const outDeg = degOfPoint(CX, CY, tk.x1, tk.y1);
        const inDeg = degOfPoint(CX, CY, tk.x2, tk.y2);
        if (!near(outDeg, want) || !near(inDeg, want)){
          tickFails++;
          fail(`tick at ${want}° is drawn along ${outDeg.toFixed(3)}°/${inDeg.toFixed(3)}° instead`); continue;
        }
        const rOut = radiusOf(CX, CY, tk.x1, tk.y1), rIn = radiusOf(CX, CY, tk.x2, tk.y2);
        if (!near(rOut, data.PROT_R)){ tickFails++; fail(`tick at ${want}° does not start on the protractor rim`); continue; }
        const wantLen = (want % 10 === 0) ? data.TICK_LEN_LONG : data.TICK_LEN_MID;
        if (!near(rOut - rIn, wantLen)){ tickFails++; fail(`tick at ${want}° is ${(rOut - rIn).toFixed(2)} long, expected ${wantLen}`); continue; }
        if (tk.major !== (want % 10 === 0)){ tickFails++; fail(`tick at ${want}° has major=${tk.major}`); continue; }
        [[tk.x1, tk.y1], [tk.x2, tk.y2]].forEach(pt => {
          if (!finite(pt[0]) || !finite(pt[1])){
            tickFails++;
            return fail(`tick at ${want}° has a non-finite endpoint (${pt[0]}, ${pt[1]})`);
          }
          if (pt[0] < 0 || pt[0] > data.PROT_W || pt[1] < 0 || pt[1] > data.PROT_H){
            tickFails++;
            fail(`tick at ${want}° reaches (${pt[0].toFixed(1)}, ${pt[1].toFixed(1)}), outside the ${data.PROT_W}x${data.PROT_H} canvas`);
          }
        });
      }

      const labels = data.labelList();
      if (!Array.isArray(labels) || labels.length !== 38)
        fail(`labelList() returned ${labels ? labels.length : 'no'} labels, expected 38 (19 marks x 2 rows)`);
      let lblFails = 0;
      const pairSum = {};
      /* 每 10 度一格、兩排各一個 —— 這張表是**獨立**算出來的。
         只比 `lb.deg` 是拿它自己當神諭：把 19 個 10 度標籤換成 19 個 5 度標籤，
         數量、半徑、配對和都還是對的，上半圈的數字卻整片不見（codex #2）。 */
      const wantLabels = {};
      for (let t = 0; t <= 180; t += 10){ wantLabels[t + '|outer'] = 0; wantLabels[t + '|inner'] = 0; }
      for (let li = 0; li < (labels || []).length; li++){
        if (lblFails > 4) break;
        if (!Object.prototype.hasOwnProperty.call(labels, li)){
          lblFails++; fail(`label ${li} is a hole in the array, so that number is missing`); continue;
        }
        const lb = labels[li];
        const key = lb.deg + '|' + lb.scale;
        if (!Object.prototype.hasOwnProperty.call(wantLabels, key)){
          lblFails++;
          fail(`a label claims ${lb.deg}° on the "${lb.scale}" row, which is not one of the 10-degree marks on either row`);
          continue;
        }
        wantLabels[key]++;
        const at = degOfPoint(CX, CY, lb.x, lb.y);
        if (!near(at, lb.deg)){ lblFails++; fail(`label ${lb.value} claims ${lb.deg}° but sits at ${at.toFixed(3)}°`); continue; }
        const wantR = (lb.scale === 'inner') ? data.LBL_R_IN : data.LBL_R_OUT;
        if (!near(radiusOf(CX, CY, lb.x, lb.y), wantR)){ lblFails++; fail(`label ${lb.value} is not on the ${lb.scale} row`); continue; }
        const wantV = labelRef(lb.deg, lb.scale);
        if (lb.value !== wantV){ lblFails++; fail(`label at ${lb.deg}° on the ${lb.scale} row reads ${lb.value}, independently ${wantV}`); continue; }
        if (lb.value < 0 || lb.value > STRAIGHT){ lblFails++; fail(`label value ${lb.value} is outside 0~180`); continue; }
        pairSum[lb.deg] = (pairSum[lb.deg] || 0) + lb.value;
        const halfW = String(lb.value).length * data.LBL_FONT * 0.6 / 2;
        if (!finite(lb.x) || !finite(lb.y)){
          lblFails++; fail(`label "${lb.value}" has a non-finite position (${lb.x}, ${lb.y})`); continue;
        }
        if (lb.x - halfW < 0 || lb.x + halfW > data.PROT_W ||
            lb.y - data.LBL_FONT < 0 || lb.y + data.LBL_FONT > data.PROT_H){
          lblFails++;
          fail(`label "${lb.value}" at (${lb.x.toFixed(1)}, ${lb.y.toFixed(1)}) would be drawn outside the ${data.PROT_W}x${data.PROT_H} canvas`);
        }
      }
      Object.keys(wantLabels).forEach(k => {
        if (wantLabels[k] !== 1)
          fail(`the protractor carries ${wantLabels[k]} labels at ${k.replace('|', '° on the ')} row, expected exactly 1`);
      });
      Object.keys(pairSum).forEach(k => {
        if (pairSum[k] !== STRAIGHT)
          fail(`the two numbers at ${k}° add up to ${pairSum[k]}, but this lesson teaches that they always add up to 180`);
      });

      /* ---------- 4. 讀數與畫出來的夾角：整個定義域 × 兩種擺法 ---------- */
      let armFails = 0, readFails = 0;
      for (let a = DEG_MIN; a <= DEG_MAX; a++){
        ['right', 'left'].forEach(from => {
          if (data.baseDeg(from) !== baseRef(from) && readFails++ < 3)
            fail(`baseDeg('${from}') = ${data.baseDeg(from)}, independently ${baseRef(from)}`);
          if (data.armDeg(a, from) !== armRef(a, from) && readFails++ < 3)
            fail(`armDeg(${a}, '${from}') = ${data.armDeg(a, from)}, independently ${armRef(a, from)}`);
          if (data.scaleOf(from) !== scaleRef(from) && readFails++ < 3)
            fail(`scaleOf('${from}') = ${data.scaleOf(from)}, independently ${scaleRef(from)}`);
          /* 課程的核心恆等式：擺好之後從那一排讀回來，一定等於原來的角度。 */
          if (data.readingOf(a, from) !== a && readFails++ < 3)
            fail(`readingOf(${a}, '${from}') = ${data.readingOf(a, from)} — reading the row whose 0 you lined up must give the angle back`);
          /* 讀錯一排剛好是 180 − a，而且只有 90° 那一格兩排讀數相同。 */
          const other = data.labelAt(data.armDeg(a, from), data.scaleOf(from) === 'inner' ? 'outer' : 'inner');
          if (other !== STRAIGHT - a && readFails++ < 3)
            fail(`reading the other row at ${a}° gives ${other}, expected ${STRAIGHT - a}`);
          if ((other === a) !== (a === RIGHT) && readFails++ < 3)
            fail(`the two rows read the same at ${a}°, but 90° must be the only angle where that happens`);

          /* **畫出來的兩條邊，夾角必須真的是 a。** 這是「圖畫對了嗎」那一條。 */
          const arms = data.armList(a, from);
          if (!Array.isArray(arms) || arms.length !== 2){
            if (armFails++ < 3) fail(`armList(${a}, '${from}') did not return two sides`);
            return;
          }
          const base = arms.filter(x => x.kind === 'base')[0], oth = arms.filter(x => x.kind === 'other')[0];
          if (!base || !oth){ if (armFails++ < 3) fail(`armList(${a}, '${from}') is missing a base or other side`); return; }
          [base, oth].forEach(arm => {
            if ((arm.x1 !== CX || arm.y1 !== CY) && armFails++ < 3)
              fail(`the ${arm.kind} side at ${a}°/${from} does not start at the vertex`);
            if (!near(radiusOf(CX, CY, arm.x2, arm.y2), data.ARM_LEN) && armFails++ < 3)
              fail(`the ${arm.kind} side at ${a}°/${from} is not ${data.ARM_LEN} long`);
            if ((!finite(arm.x2) || !finite(arm.y2)) && armFails++ < 3)
              fail(`the ${arm.kind} side at ${a}°/${from} ends at a non-finite point (${arm.x2}, ${arm.y2})`);
            else if ((arm.x2 < 0 || arm.x2 > data.PROT_W || arm.y2 < 0 || arm.y2 > data.PROT_H) && armFails++ < 3)
              fail(`the ${arm.kind} side at ${a}°/${from} reaches (${arm.x2.toFixed(1)}, ${arm.y2.toFixed(1)}), outside the canvas`);
          });
          /* 兩條邊各自的方向也要驗：只比夾角的話，兩條邊一起轉 1° 會完全看不到，
             可是那時候邊就對不上量角器的刻度了（codex #1）。 */
          const baseAt = degOfPoint(CX, CY, base.x2, base.y2);
          const othAt = degOfPoint(CX, CY, oth.x2, oth.y2);
          if (!near(baseAt, baseRef(from)) && armFails++ < 3)
            fail(`the base side at ${a}°/${from} points ${baseAt.toFixed(4)}°, but the 0 mark it must lie on is at ${baseRef(from)}°`);
          if (!near(othAt, armRef(a, from)) && armFails++ < 3)
            fail(`the other side at ${a}°/${from} points ${othAt.toFixed(4)}°, but the mark it must cross is at ${armRef(a, from)}°`);
          if (base.deg !== baseRef(from) && armFails++ < 3)
            fail(`the base side at ${a}°/${from} reports deg ${base.deg}, independently ${baseRef(from)}`);
          if (oth.deg !== armRef(a, from) && armFails++ < 3)
            fail(`the other side at ${a}°/${from} reports deg ${oth.deg}, independently ${armRef(a, from)}`);
          const drawn = angleBetween(baseAt, othAt);
          if (!near(drawn, a, 1e-6) && armFails++ < 3)
            fail(`the drawn angle measures ${drawn.toFixed(4)}° but the data says ${a}° (${from})`);
        });
      }

      /* ---------- 5. 弧線：起點、終點與掃描方向 ---------- */
      function parseArc(dstr){
        const m = /^M ([-\d.]+) ([-\d.]+) A ([-\d.]+) ([-\d.]+) 0 ([01]) ([01]) ([-\d.]+) ([-\d.]+)$/.exec(String(dstr));
        return m ? { x1:+m[1], y1:+m[2], r:+m[3], large:+m[5], sweep:+m[6], x2:+m[7], y2:+m[8] } : null;
      }
      /* 後兩組刻意大於 180°：範例 1 的旋轉圖真的會畫 240° 與 270°，
         少了它們，large-arc 的「1」那一支永遠探測不到（第二輪 #4）。 */
      [[0, 40], [0, 90], [0, 179], [180, 55], [180, 130], [90, 10], [0, 240], [0, 270]].forEach(pair => {
        const f = pair[0], t = pair[1];
        const p = parseArc(data.arcPath(CX, CY, f, t, data.ARC_R));
        if (!p) return fail(`arcPath(${f} -> ${t}) does not look like a single arc command`);
        if (!near(degOfPoint(CX, CY, p.x1, p.y1), f)) fail(`arcPath starts at ${degOfPoint(CX, CY, p.x1, p.y1).toFixed(3)}°, expected ${f}°`);
        if (!near(degOfPoint(CX, CY, p.x2, p.y2), t)) fail(`arcPath ends at ${degOfPoint(CX, CY, p.x2, p.y2).toFixed(3)}°, expected ${t}°`);
        if (!near(p.r, data.ARC_R)) fail(`arcPath radius is ${p.r}, expected ${data.ARC_R}`);
        /* SVG 的 y 向下，所以角度變大（逆時針）要用 sweep 0。 */
        const wantSweep = (t > f) ? 0 : 1;
        if (p.sweep !== wantSweep) fail(`arcPath(${f} -> ${t}) sweeps the wrong way (${p.sweep}, expected ${wantSweep})`);
        /* large-arc 旗標寫死成 1 的話，端點、半徑、掃描方向全對，畫出來卻是繞遠路的那一段。 */
        const wantLarge = (Math.abs(t - f) > 180) ? 1 : 0;
        if (p.large !== wantLarge)
          fail(`arcPath(${f} -> ${t}) uses large-arc ${p.large}, expected ${wantLarge} — ` +
               (wantLarge === 1 ? 'it would draw the short way round instead of the reflex sweep'
                                : 'it would draw the long way round'));
      });

      /* ---------- 6. 四個方向的畫布邊界（只驗一半和沒驗長得一模一樣） ---------- */
      const topMost = CY - Math.max(data.ARM_LEN, data.ARC_LBL_R + data.ARC_LBL_GAP + data.ARC_LBL_FONT);
      if (topMost < 0) fail(`the drawing reaches y=${topMost.toFixed(1)}, above the top of the ${data.PROT_H}px canvas`);
      const bottomMost = CY + data.VERTEX_LBL_DY + data.VERTEX_FONT;
      if (bottomMost > data.PROT_H) fail(`the vertex label reaches y=${bottomMost.toFixed(1)}, below the ${data.PROT_H}px canvas`);
      if (CX - data.ARM_LEN < 0) fail(`the left-hand side reaches x=${(CX - data.ARM_LEN).toFixed(1)}, off the left edge`);
      if (CX + data.ARM_LEN > data.PROT_W) fail(`the right-hand side reaches x=${(CX + data.ARM_LEN).toFixed(1)}, off the right edge`);
      if (CY > data.PROT_H) fail('the protractor baseline is drawn below the canvas');
      if (CY - data.PROT_R < 0) fail('the top of the protractor is drawn above the canvas');

      /* 旋轉角的畫布。 */
      if (!(data.TURN_ARC_R < data.TURN_R)) fail('the turn arc is drawn outside the turn circle');
      if (!(data.TURN_R < data.TURN_LBL_R)) fail('the turn labels are drawn inside the circle instead of outside it');
      if (!(data.TURN_TICK_LEN < data.TURN_R)) fail('the turn ticks are longer than the circle radius');
      for (let k = 0; k < 12; k++){
        const th = k * 30;
        const x = data.polarX(data.TURN_CX, th, data.TURN_R), y = data.polarY(data.TURN_CY, th, data.TURN_R);
        if (!finite(x) || !finite(y))
          fail(`the turn canvas tick at ${th}° lands on a non-finite point (${x}, ${y})`);
        else if (x < 0 || x > data.TURN_W || y < 0 || y > data.TURN_H)
          fail(`the turn canvas tick at ${th}° reaches (${x.toFixed(1)}, ${y.toFixed(1)}), outside ${data.TURN_W}x${data.TURN_H}`);
      }
      [0, 90, 180, 270].forEach(th => {
        const x = data.polarX(data.TURN_CX, th, data.TURN_LBL_R), y = data.polarY(data.TURN_CY, th, data.TURN_LBL_R);
        const halfW = String(th + '°').length * data.TURN_LBL_FONT * 0.6 / 2;
        if (!finite(x) || !finite(y))
          fail(`the turn canvas label "${th}°" lands on a non-finite point (${x}, ${y})`);
        else if (x - halfW < 0 || x + halfW > data.TURN_W || y - data.TURN_LBL_FONT < 0 || y + data.TURN_LBL_FONT > data.TURN_H)
          fail(`the turn canvas label "${th}°" would be drawn outside the ${data.TURN_W}x${data.TURN_H} canvas`);
      });

      /* ---------- 7. markup 的 viewBox 與 CSS 尺寸要跟著常數走 ---------- */
      const target = process.argv[2];
      if (!target){
        fail('cannot locate the lesson file (no target path in argv) — the canvas-size and sibling-page checks did not run');
      } else {
        let src = '';
        try { src = fs.readFileSync(target, 'utf8'); } catch (err){ src = ''; }
        src = src.replace(/<!--[\s\S]*?-->/g, ' ');
        ['s2fig', 's3fig', 's4fig', 's5fig'].forEach(id => {
          const m = new RegExp('id="' + id + '"[^>]*viewBox="0 0 (\\d+) (\\d+)"').exec(src);
          if (!m) fail(`cannot find the ${id} viewBox, so its canvas-size check did not run`);
          else if (Number(m[1]) !== data.PROT_W || Number(m[2]) !== data.PROT_H)
            fail(`the ${id} viewBox is ${m[1]}x${m[2]}, but the layout constants say ${data.PROT_W}x${data.PROT_H}`);
        });
        const tm = /id="s1fig"[^>]*viewBox="0 0 (\d+) (\d+)"/.exec(src);
        if (!tm) fail('cannot find the s1fig viewBox, so the turn canvas-size check did not run');
        else if (Number(tm[1]) !== data.TURN_W || Number(tm[2]) !== data.TURN_H)
          fail(`the s1fig viewBox is ${tm[1]}x${tm[2]}, but the turn canvas constants say ${data.TURN_W}x${data.TURN_H}`);
        const pcss = /\.prot\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(src);
        if (!pcss) fail('cannot find the .prot CSS box, so the canvas-size check did not run');
        else {
          if (Number(pcss[1]) !== data.PROT_W) fail(`the .prot CSS max-width is ${pcss[1]}px, the constants say ${data.PROT_W}`);
          if (Number(pcss[2]) !== data.PROT_H) fail(`the .prot CSS height is ${pcss[2]}px, the constants say ${data.PROT_H}`);
        }
        const tcss = /\.turnfig\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(src);
        if (!tcss) fail('cannot find the .turnfig CSS box, so the turn canvas-size check did not run');
        else {
          if (Number(tcss[1]) !== data.TURN_W) fail(`the .turnfig CSS max-width is ${tcss[1]}px, the constants say ${data.TURN_W}`);
          if (Number(tcss[2]) !== data.TURN_H) fail(`the .turnfig CSS height is ${tcss[2]}px, the constants say ${data.TURN_H}`);
        }
      }

      /* ---------- 8. 每一組範例資料的筆數與內容 ---------- */
      const SIZES = { TURN_TABLE:8, MEASURE_CASES:5, DRAW_CASES:4, CLASS_CASES:6, COMBO_CASES:4 };
      Object.keys(SIZES).forEach(key => {
        const arr = data[key];
        if (!Array.isArray(arr) || arr.length !== SIZES[key])
          fail(`${key} has ${arr ? arr.length : 'no'} entries, this config expects ${SIZES[key]}`);
        if (Array.isArray(arr)){
          for (let i = 0; i < arr.length; i++){
            if (!Object.prototype.hasOwnProperty.call(arr, i))
              fail(`${key}[${i}] is a hole in the array, so every check below would skip it`);
          }
        }
      });

      /* --- 旋轉角的表 --- */
      (data.TURN_TABLE || []).forEach((t, i) => {
        const ref = TURNS[i];
        if (!ref) return;
        if (t.num !== ref.num || t.den !== ref.den)
          fail(`TURN_TABLE[${i}] is ${t.num}/${t.den}, this config expects ${ref.num}/${ref.den}`);
        /* 用這份設定自己那一列的 num/den 算，不是拿課程的 num/den 算它自己的 deg。 */
        if (t.deg !== FULL * ref.num / ref.den)
          fail(`TURN_TABLE[${i}] deg ${t.deg} is not 360 x ${ref.num}/${ref.den} (${FULL * ref.num / ref.den})`);
        if (!Number.isInteger(t.deg) || t.deg < DEG_MIN || t.deg > FULL)
          fail(`TURN_TABLE[${i}] deg ${t.deg} is outside 1~360`);
      });
      if (new Set((data.TURN_TABLE || []).map(t => t.deg)).size !== (data.TURN_TABLE || []).length)
        fail('TURN_TABLE has two rows with the same number of degrees');
      [[RIGHT, 'right'], [STRAIGHT, 'straight'], [FULL, 'full']].forEach(pair => {
        if ((data.TURN_TABLE || []).every(t => t.deg !== pair[0]))
          fail(`TURN_TABLE has no row at ${pair[0]}°, so the lesson never shows ${pair[1]}`);
        if (data.turnKind(pair[0]) !== pair[1]) fail(`turnKind(${pair[0]}) = ${data.turnKind(pair[0])}, expected ${pair[1]}`);
      });
      [30, 60, 120, 240, 270, 1, 359].forEach(deg => {
        if (data.turnKind(deg) !== null) fail(`turnKind(${deg}) returned a name, but ${deg}° has no special name`);
      });

      /* --- 量角與畫角的步驟數：標題上寫幾步，就要真的有幾步 --- */
      const mSteps = data.measureSteps();
      if (!Array.isArray(mSteps) || mSteps.map(s => s.kind).join(',') !== 'center,zero,read')
        fail(`measureSteps() is ${mSteps ? mSteps.map(s => s.kind).join(',') : 'missing'}, expected center,zero,read`);
      const dSteps = data.drawSteps();
      if (!Array.isArray(dSteps) || dSteps.map(s => s.kind).join(',') !== 'side,place,mark,join')
        fail(`drawSteps() is ${dSteps ? dSteps.map(s => s.kind).join(',') : 'missing'}, expected side,place,mark,join`);

      let mRight = 0, mLeft = 0, mAcute = 0, mObtuse = 0, mNinety = 0;
      (data.MEASURE_CASES || []).forEach(c => {
        if (c.deg < DEG_MIN || c.deg > DEG_MAX) fail(`MEASURE_CASES ${c.deg}° is outside 1~179`);
        if (c.from !== 'right' && c.from !== 'left') return fail(`MEASURE_CASES has an unknown side "${c.from}"`);
        if (c.from === 'right') mRight++; else mLeft++;
        const k = kindRef(c.deg);
        if (k === 'acute') mAcute++;
        if (k === 'obtuse') mObtuse++;
        if (c.deg === RIGHT) mNinety++;
        if (data.readingOf(c.deg, c.from) !== c.deg) fail(`MEASURE_CASES ${c.deg}°/${c.from} does not read back as ${c.deg}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const theta = data.armDeg(c.deg, c.from);
          const inner = data.labelAt(theta, 'inner'), outer = data.labelAt(theta, 'outer');
          const ans = data.readingOf(c.deg, c.from);
          const side = (c.from === 'right') ? d.sideRight : d.sideLeft;
          const scale = (data.scaleOf(c.from) === 'inner') ? d.scaleInner : d.scaleOuter;
          const texts = [d.s2chip(c.deg, side), d.s2step2(side, scale), d.s2step3(inner, outer, scale, ans), d.s2result(ans)];
          texts.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s2 text ${L} ${c.deg}: ${t}`); });
          if (!printsNum(texts[2], inner) || !printsNum(texts[2], outer))
            fail(`s2 text ${L} ${c.deg} does not print both readings ${inner} and ${outer}`);
          if (!printsNum(texts[2], ans)) fail(`s2 step 3 ${L} ${c.deg} does not print the answer ${ans}`);
          if (!printsNum(texts[3], ans)) fail(`s2 result ${L} ${c.deg} does not print the answer ${ans}`);
          if (texts[1].indexOf(scale) < 0) fail(`s2 text ${L} ${c.deg} does not name the row to read`);
          /* 「讀錯排會得到不一樣的答案」在 90° 上是假的 —— 課程必須走另一句話。 */
          const same = (inner === outer);
          if (same !== (c.deg === RIGHT)) fail(`s2 ${c.deg}°: the two rows agree=${same}, but only 90° may do that`);
          const line = same ? d.s2same(ans) : d.s2diff(inner === ans ? outer : inner);
          if (/undefined|NaN/.test(line)) fail(`s2 same/diff text ${L} ${c.deg}: ${line}`);
          if (!same && !printsNum(line, STRAIGHT - c.deg))
            fail(`s2 diff text ${L} ${c.deg} does not print the wrong-row reading ${STRAIGHT - c.deg}`);
          if (same && !printsNum(line, ans))
            fail(`s2 same text ${L} ${c.deg} does not print the reading both rows agree on`);
        });
      });
      if (!mRight) fail('MEASURE_CASES never puts the 0 on the right');
      if (!mLeft) fail('MEASURE_CASES never puts the 0 on the left');
      if (!mAcute) fail('MEASURE_CASES has no acute angle');
      if (!mObtuse) fail('MEASURE_CASES has no obtuse angle');
      if (mNinety !== 1) fail(`MEASURE_CASES has ${mNinety} cases at exactly 90°, expected exactly 1 (the both-rows-agree case)`);

      /* --- 畫角 --- */
      let wRight = 0, wLeft = 0, wAcute = 0, wObtuse = 0;
      (data.DRAW_CASES || []).forEach(c => {
        if (c.deg < DEG_MIN || c.deg > DEG_MAX) fail(`DRAW_CASES ${c.deg}° is outside 1~179`);
        if (c.from === 'right') wRight++; else if (c.from === 'left') wLeft++; else return fail(`DRAW_CASES unknown side "${c.from}"`);
        if (kindRef(c.deg) === 'acute') wAcute++;
        if (kindRef(c.deg) === 'obtuse') wObtuse++;
        LANGS.forEach(L => {
          const d = I18N[L];
          const side = (c.from === 'right') ? d.sideRight : d.sideLeft;
          const scale = (data.scaleOf(c.from) === 'inner') ? d.scaleInner : d.scaleOuter;
          const texts = [d.s3chip(c.deg, side), d.s3start(c.deg), d.s3step2(side, scale),
                         d.s3step3(scale, c.deg), d.s3step4(c.deg), d.s3result(c.deg)];
          texts.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s3 text ${L} ${c.deg}: ${t}`); });
          [0, 1, 3, 4, 5].forEach(i => {
            if (!printsNum(texts[i], c.deg)) fail(`s3 text ${L} ${c.deg} piece ${i} does not print the target degree`);
          });
          if (texts[3].indexOf(scale) < 0) fail(`s3 step 3 ${L} ${c.deg} does not name the row to read`);
          if (texts[2].indexOf(side) < 0) fail(`s3 step 2 ${L} ${c.deg} does not say which end the 0 goes on`);
        });
      });
      if (!wRight) fail('DRAW_CASES never puts the 0 on the right');
      if (!wLeft) fail('DRAW_CASES never puts the 0 on the left');
      if (!wAcute) fail('DRAW_CASES has no acute angle to draw');
      if (!wObtuse) fail('DRAW_CASES has no obtuse angle to draw');

      /* --- 分類的六個例子與四個名字 --- */
      const seenKinds = {};
      (data.CLASS_CASES || []).forEach(deg => {
        if (deg < DEG_MIN || deg > STRAIGHT) return fail(`CLASS_CASES ${deg}° is outside 1~180`);
        const k = kindRef(deg);
        if (k === null) return fail(`CLASS_CASES ${deg}° has no name in this lesson`);
        if (data.kindOf(deg) !== k) fail(`kindOf(${deg}) = ${data.kindOf(deg)}, independently ${k}`);
        seenKinds[k] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const line = d.s4kind(deg, d.kinds[k], d.kindRange[k]);
          if (/undefined|NaN/.test(line)) fail(`s4kind ${L} ${deg}: ${line}`);
          if (!printsNum(line, deg)) fail(`s4kind ${L} ${deg} does not print the angle`);
          if (line.indexOf(KIND_NAMES[L][k]) < 0) fail(`s4kind ${L} ${deg} does not name ${KIND_NAMES[L][k]}`);
        });
      });
      ['acute','right','obtuse','straight'].forEach(k => {
        if (!seenKinds[k]) fail(`CLASS_CASES never shows ${k}`);
      });
      [89, 90, 91].forEach(deg => {
        if ((data.CLASS_CASES || []).indexOf(deg) < 0)
          fail(`CLASS_CASES is missing the boundary probe ${deg}° — 89/90/91 is where the three names split`);
      });
      /* 字典的名字、界線措辭與例子，都要和這份設定的真值表逐字相同。 */
      LANGS.forEach(L => {
        ['acute','right','obtuse','straight'].forEach(k => {
          if (I18N[L].kinds[k] !== KIND_NAMES[L][k])
            fail(`${L}.kinds.${k} is "${I18N[L].kinds[k]}", the kinds table says "${KIND_NAMES[L][k]}"`);
          if (I18N[L].kindRange[k] !== KIND_RANGE[L][k])
            fail(`${L}.kindRange.${k} is "${I18N[L].kindRange[k]}", the range table says "${KIND_RANGE[L][k]}"`);
          const ex = String(I18N[L].kindExample[k]).match(/\d+/g) || [];
          if (!ex.length) fail(`${L}.kindExample.${k} lists no example`);
          ex.forEach(v => {
            if (kindRef(Number(v)) !== k)
              fail(`${L}.kindExample.${k} lists ${v}°, which is ${kindRef(Number(v))}, not ${k}`);
          });
        });
        if (I18N[L].kinds.full !== KIND_NAMES[L].full)
          fail(`${L}.kinds.full is "${I18N[L].kinds.full}", the kinds table says "${KIND_NAMES[L].full}"`);
        const names = I18N[L].turnNames;
        if (!Array.isArray(names) || names.length !== 8) return fail(`${L}.turnNames is not an 8-entry table`);
        for (let i = 0; i < 8; i++){
          if (!Object.prototype.hasOwnProperty.call(names, i)) fail(`${L}.turnNames[${i}] is missing (a hole in the array)`);
          else if (names[i] !== TURN_NAMES[L][i])
            fail(`${L}.turnNames[${i}] is "${names[i]}", the turn table says "${TURN_NAMES[L][i]}"`);
        }
        /* 步驟數寫在標題上：說三步就要真的有三步。 */
        const wantM = (L === 'zh') ? '三個步驟' : 'Three Steps';
        const wantD = (L === 'zh') ? '四個步驟' : 'Four Steps';
        if (String(I18N[L].s2h2).indexOf(wantM) < 0)
          fail(`${L}.s2h2 no longer says "${wantM}", but measureSteps() has ${mSteps.length} steps`);
        if (String(I18N[L].s3h2).indexOf(wantD) < 0)
          fail(`${L}.s3h2 no longer says "${wantD}", but drawSteps() has ${dSteps.length} steps`);
      });

      /* --- 合成與分解 --- */
      let cRight = 0, cStraight = 0, cPlain = 0;
      (data.COMBO_CASES || []).forEach(c => {
        const total = c.a + c.b;
        if (c.a < DEG_MIN || c.b < DEG_MIN) fail(`COMBO_CASES ${c.a}/${c.b} has a part below 1°`);
        if (total > STRAIGHT) fail(`COMBO_CASES ${c.a} + ${c.b} = ${total}°, which is over 180 and cannot be drawn on a semicircle`);
        if (total === RIGHT) cRight++;
        else if (total === STRAIGHT) cStraight++;
        else cPlain++;
        /* 兩個弧的標籤都要留在畫布裡。 */
        [[c.a / 2, data.ARC_LBL_R], [c.a + c.b / 2, data.ARC_LBL_R + data.ARC_LBL_GAP]].forEach(pair => {
          const x = data.polarX(CX, pair[0], pair[1]), y = data.polarY(CY, pair[0], pair[1]);
          if (x < 0 || x > data.PROT_W || y - data.ARC_LBL_FONT < 0 || y + data.ARC_LBL_FONT > data.PROT_H)
            fail(`COMBO_CASES ${c.a}/${c.b}: an arc label lands at (${x.toFixed(1)}, ${y.toFixed(1)}), outside the canvas`);
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          const k = kindRef(total);
          const lines = [d.s5chip(c.a, c.b), d.s5add(c.a, c.b, total), d.s5sub(total, c.a, c.b),
                         k ? d.s5named(total, d.kinds[k]) : d.s5plain(total)];
          lines.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s5 text ${L} ${c.a}/${c.b}: ${t}`); });
          [c.a, c.b, total].forEach(v => {
            if (!printsNum(lines[1], v)) fail(`s5add ${L} ${c.a}/${c.b} does not print ${v}`);
          });
          if (!printsNum(lines[2], total) || !printsNum(lines[2], c.a) || !printsNum(lines[2], c.b))
            fail(`s5sub ${L} ${c.a}/${c.b} does not show the subtraction`);
          if (k && lines[3].indexOf(KIND_NAMES[L][k]) < 0)
            fail(`s5named ${L} ${total} does not name ${KIND_NAMES[L][k]}`);
          if (!printsNum(lines[3], total)) fail(`s5 summary ${L} ${total} does not print the total`);
        });
      });
      if (!cRight) fail('COMBO_CASES has no pair that adds up to a right angle');
      if (!cStraight) fail('COMBO_CASES has no pair that adds up to 180');
      if (!cPlain) fail('COMBO_CASES has no pair whose total has no special name');

      /* --- 遊戲：角度闖關（§六之五，五關五種玩法） --- */
      {
        let gsrc = '';
        try { gsrc = fs.readFileSync(process.argv[2], 'utf8'); } catch (err){ gsrc = ''; }
        if (!gsrc) fail('cannot read index.html, so the game checks did not run');
        else gameChecks(data, I18N, fail, gsrc);
      }

      /* --- 範例 1 的敘述 --- */
      (data.TURN_TABLE || []).forEach((t, i) => {
        LANGS.forEach(L => {
          const d = I18N[L];
          const name = d.turnNames[i];
          const narr = d.s1narr(name, t.num, t.den, t.deg);
          const res = d.s1result(name, t.deg);
          [narr, res].forEach(x => { if (/undefined|NaN/.test(x)) fail(`s1 text ${L} ${t.deg}: ${x}`); });
          [FULL, t.den, FULL / t.den, t.num, t.deg].forEach(v => {
            if (!printsNum(narr, v)) fail(`s1narr ${L} ${t.deg}° does not print ${v}`);
          });
          if (!printsNum(res, t.deg)) fail(`s1result ${L} ${t.deg}° does not print the answer`);
          if (narr.indexOf(name) < 0 || res.indexOf(name) < 0) fail(`s1 text ${L} ${t.deg}° does not name the turn`);
          const nk = data.turnKind(t.deg);
          if (nk){
            const named = d.s1named(d.kinds[nk]);
            if (/undefined|NaN/.test(named)) fail(`s1named ${L} ${t.deg}: ${named}`);
            if (named.indexOf(KIND_NAMES[L][nk]) < 0) fail(`s1named ${L} ${t.deg}° does not say ${KIND_NAMES[L][nk]}`);
          }
        });
      });

      /* ---------- 9. 三層題庫：從題幹的數字重算一次正解 ---------- */
      Object.keys(BANK).forEach(bank => {
        const spec = BANK[bank];
        LANGS.forEach(L => {
          const items = I18N[L][bank];
          if (!Array.isArray(items) || items.length !== spec.length){
            fail(`${bank} ${L}: ${items ? items.length : 'no'} questions, the oracle describes ${spec.length}`);
            return;
          }
          for (let i = 0; i < spec.length; i++){
            if (!Object.prototype.hasOwnProperty.call(items, i)){
              fail(`${bank}[${i}] ${L}: the question is missing (a hole in the array)`);
              continue;
            }
            const q = items[i], e = spec[i];
            const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
            const whyPlain = String(q.why).replace(/<[^>]+>/g, ' ');
            if (!Array.isArray(q.opts) || q.opts.length !== 4){
              fail(`${bank}[${i}] ${L}: ${q.opts ? q.opts.length : 'no'} options, expected 4`);
              continue;
            }
            for (let k = 0; k < 4; k++){
              if (!Object.prototype.hasOwnProperty.call(q.opts, k))
                fail(`${bank}[${i}] ${L}: option ${k} is a hole in the array, so that button would be blank`);
            }
            if (/\d\.\d/.test(stem) || q.opts.some(o => /\d\.\d/.test(String(o))))
              fail(`${bank}[${i}] ${L}: there is a decimal, but every angle in this lesson is a whole number of degrees`);
            /* 題幹問的是什麼，也要被盯著 —— 不然神諭只是在對位置。 */
            (e.stemMust ? e.stemMust[L] : []).forEach(cue => {
              if (stem.toLowerCase().indexOf(cue.toLowerCase()) < 0)
                fail(`${bank}[${i}] ${L}: the stem no longer says "${cue}", so it may not be asking what the oracle assumes`);
            });
            /* 題幹的數字集合必須**剛好是**神諭列的那些。 */
            const nums = (stem.match(/\d+/g) || []).map(Number);
            const srt = a => a.slice().sort((x, y) => x - y).join(',');
            if (srt(nums) !== srt(e.nums))
              fail(`${bank}[${i}] ${L}: stem prints [${nums.join(',')}], the oracle expects exactly [${e.nums.join(',')}]`);
            /* 選項形狀。 */
            if (e.kind === 'classify'){
              const allowed = ['acute','right','obtuse','straight'].map(k => QUIZ_KIND[L][k]);
              q.opts.forEach(o => {
                if (allowed.indexOf(String(o)) < 0) fail(`${bank}[${i}] ${L}: option "${o}" is not one of the four kind names`);
              });
            } else if (e.kind !== 'text' && e.kind !== 'sumThenKind'){
              const hi = e.optMax || STRAIGHT;
              q.opts.forEach(o => {
                const v = degValue(o);
                if (v === null) fail(`${bank}[${i}] ${L}: option "${o}" is not a whole number of degrees`);
                else if (v < DEG_MIN || v > hi) fail(`${bank}[${i}] ${L}: option "${o}" is outside 1~${hi}`);
              });
            } else if (e.kind === 'sumThenKind'){
              /* 「83°，銳角」這種複合選項不是純度數，但前面那個數字一樣受這一題的上界管
                 —— 不然 300°，鈍角 會整個跳過範圍檢查（第二輪 #3）。 */
              const hi2 = e.optMax || STRAIGHT;
              const names = ['acute','right','obtuse','straight'].map(k => QUIZ_KIND[L][k]);
              q.opts.forEach(o => {
                const m = /^(\d+)°(?:，|, )(.+)$/.exec(String(o).trim());
                if (!m){ fail(`${bank}[${i}] ${L}: option "${o}" is not "<degrees>° + a kind name"`); return; }
                const v = Number(m[1]);
                if (v < DEG_MIN || v > hi2) fail(`${bank}[${i}] ${L}: option "${o}" is outside 1~${hi2}`);
                if (names.indexOf(m[2]) < 0) fail(`${bank}[${i}] ${L}: option "${o}" does not end in one of the four kind names`);
              });
            } else {
              q.opts.forEach(o => {
                if (!String(o).trim()) fail(`${bank}[${i}] ${L}: an option is empty`);
              });
            }
            /* 正解由題幹的數字重算。 */
            let want = null;
            if (e.kind === 'constRight') want = RIGHT + '°';
            else if (e.kind === 'constStraight') want = STRAIGHT + '°';
            else if (e.kind === 'constThreeQuarter') want = (FULL * 3 / 4) + '°';
            else if (e.kind === 'text') want = e.text[L];
            else if (e.kind === 'classify') want = QUIZ_KIND[L][kindRef(nums[0])];
            else if (e.kind === 'acutePick'){
              const hit = Array.from(new Set(nums)).filter(v => v < RIGHT);
              if (hit.length !== 1){
                fail(`${bank}[${i}] ${L}: ${hit.length} of the printed readings are under 90, expected exactly 1`);
                continue;
              }
              want = hit[0] + '°';
            }
            else if (e.kind === 'straightMinus') want = (STRAIGHT - nums[0]) + '°';
            else if (e.kind === 'clock'){
              const hrs = nums.slice().sort((x, y) => x - y);
              want = ((hrs[1] - hrs[0]) * (FULL / 12)) + '°';
            }
            else if (e.kind === 'sumThenKind'){
              const total = nums[0] + nums[1];
              want = (L === 'zh') ? `${total}°，${QUIZ_KIND.zh[kindRef(total)]}`
                                  : `${total}°, ${QUIZ_KIND.en[kindRef(total)]}`;
            }
            else { fail(`${bank}[${i}] ${L}: unknown oracle kind ${e.kind}`); continue; }

            if (String(q.opts[q.ans]).trim() !== String(want))
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", recomputed "${want}"`);
            /* 解釋一定要把答案（與它的理由）講出來。 */
            e.whyMust[L].forEach(piece => {
              const ok = /^\d+$/.test(piece)
                ? (whyPlain.match(/\d+/g) || []).indexOf(piece) >= 0
                : whyPlain.toLowerCase().indexOf(piece.toLowerCase()) >= 0;
              if (!ok) fail(`${bank}[${i}] ${L}: the explanation never states "${piece}"`);
            });
          }
        });
      });

      /* ---------- 10. 速查卡與家長頁：規則的措辭 ----------
         三頁教的是同一條規則，只驗上課頁等於沒在盯另外兩頁。資料夾用
         `process.argv[2]` 推出來，改壞測試才會讀到它自己複製出來的那一份。 */
      if (target){
        const dir = path.dirname(target);
        Object.keys(SIBLING_RULES).forEach(page => {
          const rule = SIBLING_RULES[page];
          let html;
          try { html = fs.readFileSync(path.join(dir, page), 'utf8'); }
          catch (err){ fail('cannot read ' + page + ': ' + err.code); return; }
          html = html.replace(/<!--[\s\S]*?-->/g, ' ');   // 註解裡的字畫面上看不到
          rule.must.forEach(entry => {
            const t = entry[0], need = entry[1];
            const got = html.split(t).length - 1;
            if (got < need) fail(`${page} no longer says "${t}" the required number of times (${got} of ${need})`);
          });
          rule.forbid.forEach(t => {
            if (html.indexOf(t) >= 0) fail(`${page} says "${t}", which contradicts the rule this lesson teaches`);
          });
          if (rule.orderedZh){
            const tbl = html.match(new RegExp('<table class="' + rule.orderedZh.table + '">[\\s\\S]*?</table>'));
            if (!tbl){ fail(`${page} has no <table class="${rule.orderedZh.table}"> to check the order in`); return; }
            const at = rule.orderedZh.words.map(w => tbl[0].indexOf('>' + w + '<'));
            at.forEach((v, i) => { if (v < 0) fail(`${page} kind table is missing a cell for ${rule.orderedZh.words[i]}`); });
            for (let i = 1; i < at.length; i++){
              if (at[i - 1] >= 0 && at[i] >= 0 && at[i] < at[i - 1])
                fail(`${page} kind table has ${rule.orderedZh.words[i]} before ${rule.orderedZh.words[i - 1]}`);
            }
          }
        });
      }
    }
  }
};
