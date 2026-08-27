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
      ['量角器闖關', 2],
      ['Whichever end’s 0 you lined up with a side is the row you have to keep reading', 1],
      ['more than 90°, and less than 180°', 1],
      ['semicircular protractor', 1],
      ['Protractor Challenge', 1],
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
    { file:'index', expect:'is a hole in the array, so the button would be blank',
      find:"    { deg:125, from:'left',  opts:[55, 115, 125, 135], ans:2 },",
      replace:"    { deg:125, from:'left',  opts:[55, 115, , 135], ans:2 }," },
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

    /* ---------- index.html：遊戲 ---------- */
    { file:'index', expect:'the marked option is',
      find:"    { deg:70,  from:'left',  opts:[70, 110, 80, 60],   ans:0 },",
      replace:"    { deg:70,  from:'left',  opts:[70, 110, 80, 60],   ans:1 }," },
    { file:'index', expect:'does not offer the wrong-row reading',
      find:"    { deg:35,  from:'right', opts:[45, 35, 145, 25],   ans:1 }",
      replace:"    { deg:35,  from:'right', opts:[45, 35, 155, 25],   ans:1 }" },
    { file:'index', expect:'ROUNDS never puts the 0 on the left',
      find:"    { deg:125, from:'left',  opts:[55, 115, 125, 135], ans:2 },\n    { deg:70,  from:'left',  opts:[70, 110, 80, 60],   ans:0 },",
      replace:"    { deg:125, from:'right',  opts:[55, 115, 125, 135], ans:2 },\n    { deg:70,  from:'right',  opts:[70, 110, 80, 60],   ans:0 }," },
    { file:'index', expect:'the angle is exactly 90',
      find:"    { deg:40,  from:'right', opts:[140, 40, 50, 30],   ans:1 },",
      replace:"    { deg:90,  from:'right', opts:[140, 90, 50, 30],   ans:1 }," },

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
    { file:'parents', expect:'no longer says "量角器闖關"',
      find:'<div class="readybox" data-i18n="readyBox">精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「量角器闖關」有通關</strong>',
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
    { file:'parents', expect:'no longer says "Protractor Challenge"',
      find:'and <strong>clearing the “Protractor Challenge” game</strong>',
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
                'CLASS_CASES, kindOf, KIND_ORDER, COMBO_CASES, ROUNDS}',
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
        ['s2fig', 's3fig', 's4fig', 's5fig', 'gFig'].forEach(id => {
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
      const SIZES = { TURN_TABLE:8, MEASURE_CASES:5, DRAW_CASES:4, CLASS_CASES:6, COMBO_CASES:4, ROUNDS:5 };
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

      /* --- 遊戲：量角器闖關 --- */
      let gRight = 0, gLeft = 0;
      (data.ROUNDS || []).forEach((r, i) => {
        if (r.deg < DEG_MIN || r.deg > DEG_MAX) fail(`ROUND ${i+1}: ${r.deg}° is outside 1~179`);
        if (r.deg === RIGHT) fail(`ROUND ${i+1}: the angle is exactly 90°, where the wrong-row distractor collides with the answer`);
        if (r.from === 'right') gRight++; else if (r.from === 'left') gLeft++; else fail(`ROUND ${i+1}: unknown side "${r.from}"`);
        if (!Array.isArray(r.opts) || r.opts.length !== 4){ fail(`ROUND ${i+1}: ${r.opts ? r.opts.length : 'no'} options, expected 4`); return; }
        for (let k = 0; k < 4; k++){
          if (!Object.prototype.hasOwnProperty.call(r.opts, k)){
            fail(`ROUND ${i+1}: option ${k} is a hole in the array, so the button would be blank`);
          } else if (!Number.isInteger(r.opts[k])) {
            fail(`ROUND ${i+1}: option ${k} is not a whole number (${JSON.stringify(r.opts[k])})`);
          } else if (r.opts[k] < DEG_MIN || r.opts[k] > DEG_MAX) {
            fail(`ROUND ${i+1}: option ${r.opts[k]} is outside 1~179`);
          }
        }
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate option values`);
        if (r.ans < 0 || r.ans >= r.opts.length){ fail(`ROUND ${i+1}: ans index out of range`); return; }
        const want = readingRef(r.deg, r.from);
        if (r.opts[r.ans] !== want) fail(`ROUND ${i+1}: the marked option is ${r.opts[r.ans]}, recomputed ${want}`);
        /* 每一關都要有「讀錯排」那個誘答 —— 那正是這個遊戲要練的判斷。 */
        if (r.opts.indexOf(STRAIGHT - r.deg) < 0)
          fail(`ROUND ${i+1}: does not offer the wrong-row reading ${STRAIGHT - r.deg} as a distractor`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const side = (r.from === 'right') ? d.sideRight : d.sideLeft;
          const scale = (data.scaleOf(r.from) === 'inner') ? d.scaleInner : d.scaleOuter;
          const theta = data.armDeg(r.deg, r.from);
          const prompt = d.gPrompt(side);
          const hint2 = d.gHint2(scale, data.labelAt(theta, 'inner'), data.labelAt(theta, 'outer'));
          [prompt, hint2].forEach(t => { if (/undefined|NaN/.test(t)) fail(`ROUND ${i+1} ${L}: ${t}`); });
          if (prompt.indexOf(side) < 0) fail(`ROUND ${i+1} ${L} prompt does not say which side the 0 is on`);
          if (hint2.indexOf(scale) < 0) fail(`ROUND ${i+1} ${L} hint 2 does not name the row to read`);
          if (!printsNum(hint2, data.labelAt(theta, 'inner')) || !printsNum(hint2, data.labelAt(theta, 'outer')))
            fail(`ROUND ${i+1} ${L} hint 2 does not print both readings`);
        });
      });
      if (!gRight) fail('ROUNDS never puts the 0 on the right');
      if (!gLeft) fail('ROUNDS never puts the 0 on the left');
      if ((data.ROUNDS || []).map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');

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
