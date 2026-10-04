/* grade-4/math/area（平方公分與平方公尺、長方形與正方形的面積公式、複合圖形）的檢查設定。

   範圍取自課程自己說的話（三頁都對讀者講了同一件事）：
   面積單位只有**平方公分**與**平方公尺**（公畝／公頃／平方公里是五年級的「大地測量隊」）；
   圖形只有**長方形、正方形，以及由長方形拼出來或挖掉一塊的複合圖形**
   （平行四邊形／三角形／梯形是五年級的「面積魔術師」）；邊長一律是整數。

   這一課有五個守門重點：

   ① **「面積是鋪滿幾格」必須在畫出來的圖上成立。**
      `cellList`／`lCellList`／`lParts` 是純資料函式，這裡把它們**跑起來**，
      對 1~12 × 1~8 的每一種長方形都數一次格子、比一次座標：
      畫出來的格子數必須剛好等於 w × h，而且格子要**剛好舖滿**外框
      （每個 (r,c) 恰好一次，不多不少）—— 不是數 `<rect>` 有幾個。

   ② **複合圖形的兩條路必須真的會合。**
      「切成兩塊相加」與「補成一大塊相減」是課程明講「答案一定一樣」的兩件事，
      所以這裡把兩塊的格子集合聯集起來，跟 `lCellList` 逐格比對（互斥＋覆蓋），
      再比面積 —— 拿課程自己的減法當標準答案等於自己比自己。

   ③ **畫布的四個方向都要驗。**（2026-08-27 rounding 的教訓：只驗左右等於沒驗）
      版面常數由課程的資料區匯出，渲染函式直接拿它們畫，這裡驗上、下、左、右，
      外加五張 `.fig` 與一張 `.unitfig` 的 viewBox 和 CSS 尺寸。
      邊長標籤的寬度用**字典裡真正會印出來的字串**估，不是估一個好看的數字。

   ④ **周長與面積互相決定不了，是兩句話，要各驗一次。**
      「周長一樣，面積可能不一樣」有 PERIM_SAME_CASES 當例子；
      「面積一樣，周長可能不一樣」有 AREA_SAME_CASES 當例子。
      少了任何一組，課程與速查卡上的那句話就沒有證據。

   ⑤ **「周長」是這一課刻意的誘答，所以面積不可以等於周長的數字。**
      4 × 4 與 3 × 6 的面積剛好等於周長，那時候誘答會撞到正解、孩子選對也被判錯。
      所有產生器都必須避開，這裡逐一驗。（小遊戲 2026-10-04 改成五關動手玩法，沒有選項了，見「遊戲：鋪磚廠闖關」那一段。） */

const fs = require('fs');
const path = require('path');
const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');
/* 小遊戲句子裡的算式逐條驗算（量詞先換掉，它們不是運算元） */
const gameArith = makeArith({ units:['平方公分', '平方公尺', '公分', '公尺', '格', '排'], unitsEn:['cm²', 'm²', 'cm', 'm', 'squares?', 'rows?'] });
/* 小遊戲「貼單位」裡每一個東西真實的大小（公分，第二套來源）：量出來的數字要接近它 */
const GAME_REAL_CM = { stamp:[5, 3], book:[26, 19], rug:[300, 200], classroom:[900, 800], court:[2800, 1500], door:[200, 90], bed:[200, 120] };

/* 這一課自己的常數（第二套來源，不從課程讀）。 */
const CM_PER_M = 100;
const CM2_PER_M2 = CM_PER_M * CM_PER_M;   // 1 平方公尺 ＝ 10000 平方公分

/* ---- 第二套實作：面積、周長、反算一邊、面積單位 ---- */
function areaRef(w, h){ return w * h; }
function perimeterRef(w, h){ return w + h + w + h; }   // 刻意用「四條邊加起來」，不是 2 × (w + h)
function otherSideRef(area, side){
  if (!(side > 0)) return null;
  for (let k = 1; k <= area; k++){ if (k * side === area) return k; }
  return null;
}
function areaUnitRef(lenUnit){
  if (lenUnit === 'm') return 'm2';
  if (lenUnit === 'cm') return 'cm2';
  return null;
}

/* ---- 產生器參數池：和 review.html 的宣告同一份，選項範圍由它們算出來 ---- */
function rangeRef(lo, hi){
  const out = [];
  for (let v = lo; v <= hi; v++) out.push(v);
  return out;
}
const W_POOL = rangeRef(3, 12);
const H_POOL = rangeRef(2, 8);
const S_POOL = [2, 3, 5, 6, 7, 8, 9];
const CA_A = rangeRef(3, 10), CA_B = rangeRef(1, 6);
const CA_C = rangeRef(2, 8),  CA_D = rangeRef(1, 5);
const CS_W = rangeRef(5, 12), CS_H = rangeRef(3, 8);
const CS_NW = rangeRef(1, 4), CS_NH = rangeRef(1, 3);

const W_MAX = W_POOL[W_POOL.length - 1], H_MAX = H_POOL[H_POOL.length - 1];
const S_MAX = S_POOL[S_POOL.length - 1];

/* 選項的上界從參數池算出來，不是隨手給一個大數
   （2026-08-25 的教訓：一個「看起來寬鬆」的界線等於沒有界線）。 */
const RANGE = {
  rectArea:        [1, areaRef(W_MAX, H_MAX) + W_MAX],
  squareArea:      [1, areaRef(S_MAX, S_MAX) + S_MAX],
  missingSide:     [1, areaRef(W_MAX, H_MAX) + W_MAX],
  countCells:      [1, areaRef(W_MAX, H_MAX) + W_MAX],
  perimeterVsArea: [1, areaRef(W_MAX, H_MAX) + W_MAX],
  compositeAdd:    [1, areaRef(CA_A[CA_A.length - 1] + CA_C[CA_C.length - 1],
                                CA_B[CA_B.length - 1] + CA_D[CA_D.length - 1])],
  compositeSub:    [1, areaRef(CS_W[CS_W.length - 1], CS_H[CS_H.length - 1]) +
                       areaRef(CS_NW[CS_NW.length - 1], CS_NH[CS_NH.length - 1])],
  gardenM2:        [1, areaRef(W_MAX, H_MAX) + W_MAX],
  /* 這一課只教「1 平方公尺 ＝ 10000 平方公分」這一個換算，兩個方向都問，
     所以選項最大就是 10000 —— 四年級的數字上限就在這裡（2026-08-27 codex 審查）。 */
  m2Convert:       [1, CM2_PER_M2]
};
/* 每個產生器的選項應該帶哪一個單位（面積題帶面積單位，邊長題帶長度單位）。
   單位寫錯是這一課最大的迷思，所以它必須被驗，不能只驗數字。 */
const OPT_UNIT = {
  rectArea:'cm2', squareArea:'cm2', countCells:'cm2', compositeAdd:'cm2',
  compositeSub:'cm2', gardenM2:'m2',
  missingSide:'cm', perimeterVsArea:'cm'
  /* m2Convert 兩個方向的單位不一樣（問平方公分時是 cm2，問平方公尺時是 m2），
     而 optionOk 拿不到 d，所以那一支的單位由 renderCheck 用 d.unit 逐一驗。 */
};
/* 選項是文字（不是數字＋單位）的產生器。 */
const TEXT_GENS = ['unitPick'];

/* 每一個產生器「問的是什麼」。少了這一張表，把 rectArea 的題幹改成問周長、
   正解卻還是面積，所有數字檢查都還是綠的（2026-08-27 codex 審查）。
   must ＝ 題幹一定要有的字；not ＝ 題幹一定不可以有的字。 */
const ASK = {
  rectArea:        { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  squareArea:      { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  countCells:      { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  compositeAdd:    { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  compositeSub:    { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  gardenM2:        { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  m2Convert:       { zh:['面積'], zhNot:['周長'], en:['area'], enNot:['perimeter'] },
  missingSide:     { zh:['寬是幾公分'], zhNot:['周長'], en:['How wide'], enNot:['perimeter'] },
  /* 這一支刻意問周長 —— 所以反過來，題幹裡不可以出現「面積」。 */
  perimeterVsArea: { zh:['周長'], zhNot:['面積'], en:['perimeter'], enNot:['area'] },
  unitPick:        { zh:['面積要用哪一個單位'], zhNot:['周長'], en:['Which unit should its area'], enNot:['perimeter'] }
};

/* 這一課會問到的東西：題幹用哪一個單位報邊長，以及報出來的邊長是多少（第二套真值表）。 */
const OBJECT_SIDES = {
  stamp:[5, 3], coin:[2, 2], bookmark:[15, 5], notebook:[26, 19], towel:[30, 30],
  rug:[3, 2], classroom:[9, 8], court:[28, 15], playground:[60, 40], living:[5, 4]
};
/* 上課頁範例 4 的六個例子：哪一個單位、邊長多少（獨立於課程的表）。 */
const UNIT_CASE_EXPECT = {
  stamp:{ len:'cm', a:5, b:3 }, book:{ len:'cm', a:26, b:19 }, towel:{ len:'cm', a:30, b:30 },
  rug:{ len:'m', a:3, b:2 }, classroom:{ len:'m', a:9, b:8 }, court:{ len:'m', a:28, b:15 }
};
/* review.html 應該有的十個產生器。少了一個，simgen 只會少跑那一支的檢查 ——
   「檢查沒跑」和「檢查通過」在輸出上長得一模一樣（2026-08-27 codex 審查）。 */
const GEN_IDS = ['rectArea','squareArea','missingSide','countCells','perimeterVsArea',
                 'unitPick','m2Convert','compositeAdd','compositeSub','gardenM2'];

/* 這一課會問到的東西，以及量它的邊長時會拿哪一種尺（第二套真值表）。 */
const OBJECT_LEN = {
  stamp:'cm', coin:'cm', bookmark:'cm', notebook:'cm', towel:'cm',
  rug:'m', classroom:'m', court:'m', playground:'m', living:'m'
};
const UNIT_LABELS = {
  zh: { cm2:'平方公分', m2:'平方公尺', cm:'公分', m:'公尺' },
  en: { cm2:'cm²', m2:'m²', cm:'cm', m:'m' }
};

/* 上課頁範例 4 的字典真值表（`unitName` 是完整的單位說法，和產生器的短標籤不同）。 */
const UNIT_NAME = {
  zh: { cm2:'平方公分', m2:'平方公尺' },
  en: { cm2:'square centimetres (cm²)', m2:'square metres (m²)' }
};
/* 上課頁的「邊長的單位」那一欄。⚠️ 不是「該拿哪一把尺」——
   同一個東西兩種單位都量得出來，那是習慣不是規則（2026-08-27 codex 審查）。 */
const UNIT_RULER = {
  zh: { cm2:'公分', m2:'公尺' },
  en: { cm2:'centimetres', m2:'metres' }
};
const UNIT_EXAMPLE = {
  zh: { cm2:'郵票、課本封面、手帕', m2:'地毯、教室地板、籃球場' },
  en: { cm2:'a stamp, a book cover, a handkerchief', m2:'a rug, a classroom floor, a basketball court' }
};
const OBJECT_NAMES = {
  zh: { stamp:'郵票', book:'課本封面', towel:'手帕', rug:'地毯', classroom:'教室地板', court:'籃球場' },
  en: { stamp:'a stamp', book:'a book cover', towel:'a handkerchief', rug:'a rug',
        classroom:'a classroom floor', court:'a basketball court' }
};

/* 負數的寫法：負號**緊貼**數字，而且前面不是數字或字母。
   ⚠️ 三件事都是必要的（2026-08-27 codex 第二、三輪）：
   ① 要含 U+2212 真減號、U+FF0D 全形、U+FE63 小型全形，少一種那一種就會被讀成正數；
   ② 不可以放進 en dash／em dash —— 那是這幾頁的標點（「—— 1 平方公尺」）；
   ③ 不可以允許中間有空白，因為「20 － 6」是這一課自己的減法算式，
      而 `grade-5`／`utf-8` 這種前面接字母數字的也不是負數。 */
const NEG = /(^|[^0-9A-Za-z])[-\u2212\uFF0D\uFE63][0-9]/;

/* 數字要比「整個 token」：子字串比對會把 4 認在 44 裡面。 */
function printsNum(text, v){
  return (String(text).match(/\d+/g) || []).indexOf(String(v)) >= 0;
}
/* 「28 平方公分」／「28 cm²」→ { v:28, unit:'cm2' }；形狀不對就回 null。 */
function valUnit(s, lang){
  const str = String(s).trim();
  if (lang === 'zh'){
    const m = /^(\d+)\s(平方公分|平方公尺|公分|公尺)$/.exec(str);
    if (!m) return null;
    const map = { '平方公分':'cm2', '平方公尺':'m2', '公分':'cm', '公尺':'m' };
    return { v:Number(m[1]), unit:map[m[2]] };
  }
  const m = /^(\d+)\s(cm²|m²|cm|m)$/.exec(str);
  if (!m) return null;
  const map = { 'cm²':'cm2', 'm²':'m2', 'cm':'cm', 'm':'m' };
  return { v:Number(m[1]), unit:map[m[2]] };
}

/* ---------------------------------------------------------------------------
   三層題庫的第二套實作。`verify_lesson_data.js` 內建的算術重算只認得
   「a ＋ b ＝ ?」那種題幹，這一課一題都不符合 —— 沒有這張表，把 ans 改掉
   完全不會被抓到。
   每一題記：題幹裡**剛好**出現哪些數字、答案怎麼從那些數字重算、正解的單位、
   選項允許哪些單位（刻意的「單位寫錯」誘答要出現得了），以及解釋裡一定要講到的字。

   `stemMust` 是**題幹問的是什麼**的守門條件。少了它，神諭就只是位置式模板：
   把「客廳長 5 公尺」和「地毯長 3 公尺」互換，題幹的數字沒變，神諭照樣要求 14。
   ⚠️ 已知限制：`stemMust` 是子字串比對，擋得住這種漂移，擋不住「在同一句話裡加一個
   『不』」這種敵意改寫。它的定位是漂移守門，不是語意證明。
   --------------------------------------------------------------------------- */
const BANK = {
  qs: [
    { nums:[1], kind:'unitSquare', unit:'cm2', optUnits:['cm2','cm'],
      stemMust:{ zh:['邊長 1 公分'], en:['sides of 1 cm'] },
      whyMust:{ zh:['1','4','平方公分'], en:['1','4','square centimetre'] } },
    { nums:[7, 4], kind:'rectArea', sides:[7, 4], unit:'cm2', optUnits:['cm2','cm'],
      stemMust:{ zh:['長 7 公分','寬 4 公分','面積'], en:['7 cm long','4 cm wide','area'] },
      whyMust:{ zh:['7','4','28','22','11'], en:['7','4','28','22','11'] },
      whyExpr:{ zh:['7 × 4'], en:['7 × 4'] } },
    { nums:[6], kind:'squareArea', sides:[6], unit:'cm2', optUnits:['cm2','cm'],
      stemMust:{ zh:['正方形','邊長'], en:['square','sides of'] },
      whyMust:{ zh:['6','36','24','12'], en:['6','36','24','12'] },
      whyExpr:{ zh:['6 × 6'], en:['6 × 6'] } },
    /* 「哪一個東西比較適合用平方公尺」問的是偏好，四個選項都講得通（codex）。
       改成由題幹報出來的邊長單位決定，答案就唯一了。 */
    { nums:[9, 8], kind:'unitLabel', want:'m2', unit:'m2', optUnits:null,
      stemMust:{ zh:['長 9 公尺','寬 8 公尺','面積要用哪一個單位'],
                 en:['9 m long','8 m wide','Which unit should its area'] },
      whyMust:{ zh:['9','8','平方公尺','長度'], en:['9','8','m²','length'] },
      whyExpr:{ zh:['9 公尺 × 8 公尺'], en:['9 m by 8 m'] } },
    { nums:[45, 9], kind:'sideFromArea', unit:'cm', optUnits:['cm','cm2'],
      stemMust:{ zh:['面積是 45 平方公分','長是 9 公分','寬'], en:['area of 45 cm²','9 cm long','wide'] },
      whyMust:{ zh:['45','9','5'], en:['45','9','5'] },
      whyExpr:{ zh:['45 ÷ 9'], en:['45 ÷ 9'] } },
    { nums:[8, 3], kind:'perimeter', sides:[8, 3], unit:'cm', optUnits:['cm','cm2'],
      stemMust:{ zh:['周長'], en:['perimeter'] },
      whyMust:{ zh:['8','3','22','24'], en:['8','3','22','24'] },
      whyExpr:{ zh:['（8 ＋ 3）× 2'], en:['(8 + 3) × 2'] } }
  ],
  qsAdv: [
    /* 每一個數字都要綁在它自己的物件上：只驗「數字集合對不對」的話，
       把客廳改成 5 × 3、地毯改成 4 × 2，集合完全沒變，神諭卻還是要求 14（codex）。 */
    { nums:[5, 4, 3, 2], kind:'wholeMinusPart', whole:[5, 4], part:[3, 2], unit:'m2', optUnits:['m2'],
      stemMust:{ zh:['客廳長 5 公尺','寬 4 公尺','地毯','長 3 公尺','寬 2 公尺'],
                 en:['living room is 5 m long','4 m wide','rug 3 m long','2 m wide'] },
      whyMust:{ zh:['20','6','14'], en:['20','6','14'] },
      whyExpr:{ zh:['5 × 4','3 × 2','20 － 6'], en:['5 × 4','3 × 2','20 − 6'] } },
    { nums:[10, 6, 4], kind:'wholeMinusPart', whole:[10, 6], part:[4, 4], unit:'cm2', optUnits:['cm2'],
      stemMust:{ zh:['長 10 公分','寬 6 公分','邊長 4 公分的正方形'],
                 en:['10 cm long','6 cm wide','square of side 4 cm'] },
      whyMust:{ zh:['10','6','60','16','44'], en:['10','6','60','16','44'] },
      whyExpr:{ zh:['10 × 6','4 × 4','60 － 16'], en:['10 × 6','4 × 4','60 − 16'] } },
    { nums:[1], kind:'m2ToCm2', unit:'cm2', optUnits:['cm2'], optMax:CM2_PER_M2,
      stemMust:{ zh:['1 平方公尺','平方公分'], en:['1 square metre','square centimetres'] },
      whyMust:{ zh:['100','10000'], en:['100','10000'] },
      whyExpr:{ zh:['100 × 100'], en:['100 × 100'] } },
    /* 「差 0」正是這一題要擋的迷思（周長一樣 → 以為面積也一樣），所以下界放到 0。 */
    { nums:[20, 8, 2, 5, 5], kind:'areaDiff', pairs:[[8, 2], [5, 5]], per:20, unit:'cm2', optUnits:['cm2'], optMin:0,
      /* 「兩個周長都是 20」這句話要驗在**題幹印出來的那兩組邊長**上，
         不是驗在神諭自己的 pairs 上 —— 所以兩組邊長都逐字釘住（codex）。 */
      stemMust:{ zh:['周長都是 20 公分','長 8 公分寬 2 公分','長 5 公分寬 5 公分'],
                 en:['perimeter of 20 cm','8 cm by 2 cm','5 cm by 5 cm'] },
      whyMust:{ zh:['16','25','9'], en:['16','25','9'] },
      whyExpr:{ zh:['8 × 2','5 × 5','25 － 16'], en:['8 × 2','5 × 5','25 − 16'] } }
  ],
  qsBoost: [
    { nums:[5, 3, 16], kind:'perimTrap', sides:[5, 3], wrong:16, unit:'cm2', optUnits:['cm2','cm'],
      stemMust:{ zh:['長 5 公分','寬 3 公分','16'], en:['5 cm long','3 cm wide','16'] },
      whyMust:{ zh:['5','3','16','15','周長'], en:['5','3','16','15','perimeter'] },
      whyExpr:{ zh:['（5 ＋ 3）× 2','5 × 3'], en:['(5 + 3) × 2','5 × 3'] } },
    { nums:[], kind:'text', unit:null, optUnits:null,
      text:{ zh:'面積一樣，周長可能不一樣', en:'equal areas can still have different perimeters' },
      stemMust:{ zh:['面積一樣'], en:['same area'] },
      whyMust:{ zh:['12','26','14'], en:['12','26','14'] },
      whyExpr:{ zh:['12 × 1','4 × 3'], en:['12 × 1','4 × 3'] } }
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
      ['裡面鋪滿幾個單位方格', 2],
      ['長 × 寬', 2],
      ['邊長 × 邊長', 2],
      ['面積 ÷ 一邊 ＝ 另一邊', 2],
      ['1 平方公尺 ＝ 10000 平方公分', 2],
      ['周長一樣，面積也可能不一樣', 2],
      ['面積一樣，周長也可能不一樣', 2],
      /* 「單憑一個算不出另一個」——「永遠算不出來」在正方形上是假的（codex）。 */
      ['只知道周長，還不夠算出面積', 2],
      ['除非另外知道別的條件', 2],
      ['<strong>單位裡</strong>看到「平方」', 2],
      ['從長方形挖掉一個<strong>長方形</strong>的角', 2],
      ['習慣，不是規則', 2],
      ['切成兩塊相加', 2],
      ['補成一大塊相減', 2],
      ['公畝、公頃、平方公里', 2],
      ['平行四邊形、三角形、梯形', 2],
      /* 挑單位的規則是「看你拿哪一把尺」，不是「東西看起來大不大」。 */
      ['邊長用哪一個單位，面積就用那個單位的「平方」', 2],
      /* codex 第二輪：規則少了「兩條邊要先用同一個單位」——
         2 公尺 × 30 公分 的長方形沒有一個「邊長的單位」可以跟。 */
      ['兩條邊要先用<strong>同一個單位</strong>說', 2],
      ['how many unit squares fill the inside', 1],
      ['length × width', 1],
      ['side × side', 1],
      ['1 m² = 10000 cm²', 1],
      ['equal perimeters can still have different areas', 1],
      ['equal areas can still have different perimeters', 1],
      ['whichever unit the sides are given in, the area uses that unit', 1],
      ['Both sides have to be given in <strong>the same unit</strong> first', 1],
      ['ares, hectares and square kilometres', 1],
      ['parallelograms, triangles and trapeziums', 1],
      /* codex：英文的宣告也要被盯著，不然拿掉英文那一句，守門員照樣是綠的。 */
      ['area ÷ one side = the other side', 1],
      ['Cut it into two and add', 1],
      ['Fill it in and subtract', 1],
      ['a perimeter on its own is not enough to work out the area', 1],
      ['unless you know something else as well', 1],
      ['habit, not a rule', 1],
      ['rectangular</strong> corner is taken out of a rectangle', 1]
    ],
    forbid: [
      '周長一樣，面積就一定一樣', '面積一樣，周長就一定一樣',
      '1 平方公尺 ＝ 100 平方公分', '面積是繞一圈的長度',
      '周長比較大，面積就比較大',
      'equal areas mean equal perimeters', '1 m² = 100 cm²',
      /* 「東西大就用平方公尺」是猜法，不是這一課的規則。 */
      '東西比較大就用平方公尺', 'bigger things always use square metres',
      /* 「永遠算不出來」在正方形上是假的，所以這幾種說法都不可以出現（codex）。 */
      '知道其中一個，算不出另一個', '周長算不出面積，面積也算不出周長',
      'never gives you the other', 'a perimeter never gives you the area',
      /* 這一課的邊長一律是整數，連舉例也不可以出現小數。 */
      '0.9 公尺', '0.9 m by'
    ],
    /* 兩個面積單位由小到大的那一張表。 */
    orderedZh: { table:'unittable', words:['平方公分', '平方公尺'] }
  },
  'parents.html': {
    must: [
      ['裡面鋪滿幾個單位方格', 2],
      ['10000 平方公分', 2],
      ['只知道周長算不出面積，只知道面積也算不出周長', 2],
      ['如果已經知道它是正方形', 2],
      ['公畝、公頃、平方公里是五年級', 2],
      ['平行四邊形、三角形、梯形的公式也是五年級', 2],
      ['鋪磚廠闖關', 2],
      ['不留空隙也不重疊', 2],
      ['how many unit squares fill the inside', 1],
      ['10000 cm²', 1],
      ['a perimeter on its own does not give you the area', 1],
      ['for a shape you already know is a square', 1],
      ['no gaps and no overlaps', 1],
      ['ares, hectares and square kilometres belong to grade 5', 1],
      ['the formulas for parallelograms, triangles and trapeziums are grade 5 as well', 1],
      ['Tiling Yard Challenge', 1],
      /* 家長頁**引用**了大人常講錯的那句話，所以不能用 forbid 擋 ——
         要反過來要求它把「那句話是錯的」講出來。 */
      ['「1 平方公尺 ＝ 100 平方公分」是錯的', 2],
      ['“1 m² = 100 cm²” is false', 1]
    ],
    forbid: [
      '周長一樣，面積就一定一樣', '面積一樣，周長就一定一樣',
      '這一課也教公頃', 'this lesson also covers hectares',
      '這一課也教三角形的面積', 'this lesson also covers triangles',
      '周長和面積互相決定不了', 'perimeter and area never decide each other',
      '知道其中一個，算不出另一個', 'Knowing one of them never gives you the other'
    ],
    orderedZh: null
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-4/math/area */
  breaks: [
    /* ---------- review.html：共用工具 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'is not w x h',
      find:'  function areaOf(w, h){ return w * h; }',
      replace:'  function areaOf(w, h){ return w * h + 1; }' },
    { file:'review', expect:'is not the perimeter',
      find:'  function perimeterOf(w, h){ return 2 * (w + h); }',
      replace:'  function perimeterOf(w, h){ return 2 * w + h; }' },
    { file:'review', expect:'m2Convert: correct is not the 1 m² = 10000 cm² fact',
      find:'  var CM2_PER_M2 = CM_PER_M * CM_PER_M;   // 1 平方公尺 ＝ 10000 平方公分',
      replace:'  var CM2_PER_M2 = CM_PER_M;   // 1 平方公尺 ＝ 10000 平方公分' },
    { file:'review', expect:'the area equals the perimeter',
      find:'      ok = (w !== h) && (areaOf(w, h) !== perimeterOf(w, h));',
      replace:'      ok = (w !== h);' },
    { file:'review', expect:'is a square, but this generator only draws rectangles',
      find:'      ok = (w !== h) && (areaOf(w, h) !== perimeterOf(w, h));',
      replace:'      ok = (areaOf(w, h) !== perimeterOf(w, h));' },

    /* ---------- review.html：rectArea ---------- */
    { file:'review', expect:'rectArea: correct is not the area',
      find:'        var correct = areaOf(p.w, p.h);\n        var per = perimeterOf(p.w, p.h);\n        var cands = candsWithTrap(per, [p.w + p.h, correct + p.w, correct - p.h], correct, [p.w, p.h]);',
      replace:'        var correct = areaOf(p.w, p.h) + 1;\n        var per = perimeterOf(p.w, p.h);\n        var cands = candsWithTrap(per, [p.w + p.h, correct + p.w, correct - p.h], correct, [p.w, p.h]);' },
    { file:'review', expect:'rectArea stem does not print both sides',
      find:"            ? '一個長方形長 ' + d.w + ' 公分、寬 ' + d.h + ' 公分，面積是多少？'",
      replace:"            ? '一個長方形長 ' + d.w + ' 公分，面積是多少？'" },
    { file:'review', expect:'rectArea why never states the answer',
      find:"            ? '長 × 寬 ＝ ' + d.w + ' × ' + d.h + ' ＝ ' + d.correct + '，面積是 ' + d.correct + ' 平方公分。'",
      replace:"            ? '長 × 寬 ＝ ' + d.w + ' × ' + d.h + '，算出來就是面積。'" },
    { file:'review', expect:'rectArea why does not say the perimeter distractor',
      find:"              + d.per + ' 是繞一圈的周長，單位是公分，不是面積。'",
      replace:"              + '另外那些選項是別的東西，不要選。'" },
    { file:'review', expect:'rectArea does not offer the perimeter',
      find:'candsWithTrap(per, [p.w + p.h, correct + p.w, correct - p.h], correct, [p.w, p.h])',
      replace:'candsWithTrap(p.w + p.h, [correct + p.w, correct - p.h, correct + 2], correct, [p.w, p.h])' },

    /* ---------- review.html：squareArea ---------- */
    { file:'review', expect:'squareArea: correct is not s x s',
      find:'        var s = pickUnused(S_POOL, used);\n        var correct = areaOf(s, s);',
      replace:'        var s = pickUnused(S_POOL, used);\n        var correct = areaOf(s, s + 1);' },
    /* 邊長 4 的正方形面積 16 ＝ 周長 16。守門的是「S_POOL 不含 4」這件事本身，
       所以先響的是池子那一條 —— expect 指向真正會響的那一行（第一個斷言）。 */
    { file:'review', expect:'squareArea: s 4 is outside the declared pool',
      find:'  var S_POOL = [2, 3, 5, 6, 7, 8, 9];',
      replace:'  var S_POOL = [4];' },
    { file:'review', expect:'squareArea stem does not print the side',
      find:"            ? '一個正方形的邊長是 ' + d.s + ' 公分，面積是多少？'",
      replace:"            ? '一個正方形的邊長是 ' + (d.s + 1) + ' 公分，面積是多少？'" },
    { file:'review', expect:'squareArea why does not show the multiplication',
      find:"            ? '正方形的長和寬一樣長，邊長 × 邊長 ＝ ' + d.s + ' × ' + d.s + ' ＝ ' + d.correct + ' 平方公分。'",
      replace:"            ? '正方形的長和寬一樣長，邊長 × 邊長 就是答案。'" },
    { file:'review', expect:'squareArea does not offer the perimeter',
      find:'candsWithTrap(per, [2 * s, correct + s, correct - s], correct, [s])',
      replace:'candsWithTrap(2 * s, [correct + s, correct - s, correct + 2], correct, [s])' },

    /* ---------- review.html：missingSide ---------- */
    { file:'review', expect:'missingSide: area is not w x h',
      find:'        var p = rectPair(used);\n        var area = areaOf(p.w, p.h);\n        var correct = p.h;',
      replace:'        var p = rectPair(used);\n        var area = areaOf(p.w, p.h) + 1;\n        var correct = p.h;' },
    { file:'review', expect:'missingSide: correct is not the area divided by the printed side',
      find:'        var correct = p.h;\n        var cands = notInStem([area - p.w, correct + 1, correct + 2, area + p.w], [p.w, area]);',
      replace:'        var correct = p.h + 1;\n        var cands = notInStem([area - p.w, correct + 1, correct + 2, area + p.w], [p.w, area]);' },
    { file:'review', expect:'missingSide stem does not print the area',
      find:"            ? '一個長方形的面積是 ' + d.area + ' 平方公分，長是 ' + d.w + ' 公分，寬是幾公分？'",
      replace:"            ? '一個長方形的長是 ' + d.w + ' 公分，寬是幾公分？'" },
    { file:'review', expect:'carries the unit cm2, expected cm',
      find:"          opts: d.opts.map(function(v){ return t.len(v, 'cm'); }), ans: d.ans,\n          why: lang === 'zh'\n            ? '面積是長 × 寬，所以反過來用除法：'",
      replace:"          opts: d.opts.map(function(v){ return t.area(v, 'cm2'); }), ans: d.ans,\n          why: lang === 'zh'\n            ? '面積是長 × 寬，所以反過來用除法：'" },
    { file:'review', expect:'missingSide why never states the answer',
      find:"            ? '面積是長 × 寬，所以反過來用除法：' + d.area + ' ÷ ' + d.w + ' ＝ ' + d.correct\n              + '，寬是 ' + d.correct + ' 公分。邊長的單位是公分，不是平方公分。'",
      replace:"            ? '面積是長 × 寬，所以反過來用除法：' + d.area + ' ÷ ' + d.w + ' 就算得出來。邊長的單位是公分，不是平方公分。'" },

    /* ---------- review.html：countCells ---------- */
    { file:'review', expect:'countCells: correct is not rows x columns',
      find:'        var w = pickUnused(W_POOL, used);\n        var h = pick(H_POOL);\n        var correct = areaOf(w, h);',
      replace:'        var w = pickUnused(W_POOL, used);\n        var h = pick(H_POOL);\n        var correct = areaOf(w, h) - 1;' },
    { file:'review', expect:'countCells stem does not print both counts',
      find:"            ? '一個長方形用邊長 1 公分的小方格鋪滿，每一排 ' + d.w + ' 格、一共 ' + d.h + ' 排。它的面積是多少？'",
      replace:"            ? '一個長方形用邊長 1 公分的小方格鋪滿，每一排 ' + d.w + ' 格。它的面積是多少？'" },
    { file:'review', expect:'countCells why does not show the multiplication',
      find:"            ? '每一排 ' + d.w + ' 格、一共 ' + d.h + ' 排，就是 ' + d.w + ' × ' + d.h + ' ＝ ' + d.correct",
      replace:"            ? '每一排 ' + d.w + ' 格、一共 ' + d.h + ' 排，就是 ' + d.correct" },

    /* ---------- review.html：perimeterVsArea ---------- */
    { file:'review', expect:'perimeterVsArea: correct is not the perimeter',
      find:'        var area = areaOf(p.w, p.h);\n        var correct = perimeterOf(p.w, p.h);',
      replace:'        var area = areaOf(p.w, p.h);\n        var correct = perimeterOf(p.w, p.h) + 2;' },
    { file:'review', expect:'perimeterVsArea does not offer the area',
      find:'candsWithTrap(area, [p.w + p.h, correct + 2, correct - 2], correct, [p.w, p.h])',
      replace:'candsWithTrap(p.w + p.h, [correct + 2, correct - 2, correct + 4], correct, [p.w, p.h])' },
    { file:'review', expect:'perimeterVsArea stem no longer asks for what it answers',
      find:"            ? '一個長方形長 ' + d.w + ' 公分、寬 ' + d.h + ' 公分，繞它一圈的周長是多少？'",
      replace:"            ? '一個長方形長 ' + d.w + ' 公分、寬 ' + d.h + ' 公分，裡面鋪滿幾格？'" },

    /* ---------- review.html：unitPick ---------- */
    { file:'review', expect:'unitPick: the marked unit is not the one the ruler decides',
      find:"  function areaUnitOf(lenUnit){ return (lenUnit === 'm') ? 'm2' : 'cm2'; }\n  /* 這一課會問到的東西",
      replace:"  function areaUnitOf(lenUnit){ return (lenUnit === 'm') ? 'cm2' : 'm2'; }\n  /* 這一課會問到的東西" },
    { file:'review', expect:'unitPick: an object is measured with the wrong ruler',
      find:"    { key:'classroom',  len:'m',  a:9,  b:8  },",
      replace:"    { key:'classroom',  len:'cm', a:9,  b:8  }," },
    { file:'review', expect:'unitPick: classroom is 9x80, independently 9x8',
      find:"    { key:'classroom',  len:'m',  a:9,  b:8  },",
      replace:"    { key:'classroom',  len:'m',  a:9,  b:80 }," },
    /* 題幹不報邊長，答案就只剩偏好 —— 這是 codex 抓到的那一筆。 */
    { file:'review', expect:'so the answer would come down to taste',
      find:"            ? name + '量出來是長 ' + t.len(d.a, d.len) + '、寬 ' + t.len(d.b, d.len) + '。它的面積要用哪一個單位？'",
      replace:"            ? name + '的面積要用哪一個單位？'" },
    { file:'review', expect:'unitPick: the options are not the four unit labels',
      find:"  var UNIT_CHOICES = ['cm2', 'm2', 'cm', 'm'];",
      replace:"  var UNIT_CHOICES = ['cm2', 'm2', 'cm', 'cm'];" },
    { file:'review', expect:'unitPick why does not tie the answer to the unit the sides are given in',
      find:"            ? '邊長是用' + sideUnit + '報出來的，邊長的單位是' + sideUnit + '，面積的單位就是'",
      replace:"            ? '看一下邊長就知道了，面積的單位就是'" },

    /* ---------- review.html：m2Convert ---------- */
    { file:'review', expect:'m2Convert: correct is not the 1 m² = 10000 cm² fact',
      find:'        var correct = toCm ? CM2_PER_M2 : 1;',
      replace:'        var correct = toCm ? CM_PER_M : 1;' },
    /* 誘答放大到年段範圍外面 —— 那是 codex 抓到的那一筆。 */
    { file:'review', expect:'is outside 1~10000',
      find:"        var cands = toCm ? [CM_PER_M, 1000, 200] : [CM_PER_M, 10, 2];\n        var m = mixOpts(correct, cands, 1, CM2_PER_M2, 1);",
      replace:"        var cands = toCm ? [CM2_PER_M2 * 5, 1000, 200] : [CM_PER_M, 10, 2];\n        var m = mixOpts(correct, cands, 1, CM2_PER_M2 * 1000, 1);" },
    { file:'review', expect:'the answer unit does not match the direction',
      find:"        var unit = toCm ? 'cm2' : 'm2';",
      replace:"        var unit = toCm ? 'm2' : 'cm2';" },
    { file:'review', expect:'m2Convert stem does not print the quantity it converts from',
      find:"            ? (toCm ? '1 平方公尺的面積是幾平方公分？' : CM2_PER_M2 + ' 平方公分的面積是幾平方公尺？')",
      replace:"            ? (toCm ? '一平方公尺的面積是幾平方公分？' : CM2_PER_M2 + ' 平方公分的面積是幾平方公尺？')" },
    { file:'review', expect:'m2Convert why does not show 100 × 100',
      find:"            ? '1 公尺 ＝ ' + CM_PER_M + ' 公分，長和寬都要換，所以 1 平方公尺 ＝ ' + CM_PER_M + ' × ' + CM_PER_M\n              + ' ＝ ' + CM2_PER_M2 + ' 平方公分。'",
      replace:"            ? '長和寬都要換，所以 1 平方公尺 ＝ ' + CM2_PER_M2 + ' 平方公分。'" },

    /* ---------- review.html：compositeAdd ---------- */
    { file:'review', expect:'compositeAdd: correct is not the two pieces added',
      find:'        var one = areaOf(a, b), two = areaOf(c, e);\n        var correct = one + two;',
      replace:'        var one = areaOf(a, b), two = areaOf(c, e);\n        var correct = one + two + 1;' },
    { file:'review', expect:'compositeAdd: the two pieces have the same area',
      find:'          ok = (areaOf(a, b) !== areaOf(c, e));',
      replace:'          ok = true;' },
    { file:'review', expect:'compositeAdd stem no longer says the pieces do not overlap',
      find:"              + ' 公分的長方形，沒有重疊地拼成一個圖形。這個圖形的面積是多少？'",
      replace:"              + ' 公分的長方形，拼成一個圖形。這個圖形的面積是多少？'" },
    { file:'review', expect:'compositeAdd why does not show the addition',
      find:"            ? '沒有重疊地拼起來，面積就是兩塊相加：' + d.a + ' × ' + d.b + ' ＝ ' + d.one + '，'\n              + d.c + ' × ' + d.e + ' ＝ ' + d.two + '，' + d.one + ' ＋ ' + d.two + ' ＝ ' + d.correct + ' 平方公分。'",
      replace:"            ? '沒有重疊地拼起來，面積就是兩塊相加：' + d.a + ' × ' + d.b + ' ＝ ' + d.one + '，'\n              + d.c + ' × ' + d.e + ' ＝ ' + d.two + '，加起來就好了。'" },

    /* ---------- review.html：compositeSub ---------- */
    { file:'review', expect:'compositeSub: correct is not the big rectangle minus the hole',
      find:'        var big = areaOf(w, h), hole = areaOf(nw, nh);\n        var correct = big - hole;',
      replace:'        var big = areaOf(w, h), hole = areaOf(nw, nh);\n        var correct = big - hole - 1;' },
    { file:'review', expect:'the cut needs at least 2',
      find:'          ok = (nw <= w - 2) && (nh <= h - 1)',
      replace:'          ok = (nh <= h - 1)' },
    { file:'review', expect:'compositeSub: what is left equals the hole',
      find:'               && (areaOf(w, h) - areaOf(nw, nh) !== areaOf(nw, nh))\n',
      replace:'               && true\n' },
    /* 從角上挖掉一塊長方形不會改變周長 —— 面積剛好等於周長時，「算周長」也會走到正解。 */
    { file:'review', expect:"equals the shape's perimeter",
      find:'               && (areaOf(w, h) - areaOf(nw, nh) !== perimeterOf(w, h));',
      replace:'               && true;' },
    { file:'review', expect:'compositeSub does not offer the un-subtracted rectangle',
      find:'candsWithTrap(big, [hole, big + hole, correct + 1], correct, [w, h, nw, nh])',
      replace:'candsWithTrap(hole, [big + hole, correct + 1, correct + 2], correct, [w, h, nw, nh])' },
    { file:'review', expect:'compositeSub why does not show the subtraction',
      find:"              + d.nw + ' × ' + d.nh + ' ＝ ' + d.hole + '；相減 ' + d.big + ' － ' + d.hole + ' ＝ '\n              + d.correct + ' 平方公分。'",
      replace:"              + d.nw + ' × ' + d.nh + ' ＝ ' + d.hole + '；相減就算得出來了。'" },

    /* ---------- review.html：gardenM2 ---------- */
    { file:'review', expect:'gardenM2: correct is not the area',
      find:"    { id:'gardenM2', cat:'unit',\n      make:function(used){\n        var p = rectPair(used);\n        var correct = areaOf(p.w, p.h);",
      replace:"    { id:'gardenM2', cat:'unit',\n      make:function(used){\n        var p = rectPair(used);\n        var correct = areaOf(p.w, p.h) + 1;" },
    { file:'review', expect:'carries the unit cm2, expected m2',
      find:"          opts: d.opts.map(function(v){ return t.area(v, 'm2'); }), ans: d.ans,",
      replace:"          opts: d.opts.map(function(v){ return t.area(v, 'cm2'); }), ans: d.ans," },
    { file:'review', expect:'gardenM2 stem does not print both sides',
      find:"            ? '一塊長方形的菜園長 ' + d.w + ' 公尺、寬 ' + d.h + ' 公尺，面積是多少？'",
      replace:"            ? '一塊長方形的菜園長 ' + d.w + ' 公尺，面積是多少？'" },

    /* ---------- review.html：文字表 ---------- */
    { file:'review', expect:'is not one of the four unit labels',
      find:"      unitLabels:{ cm2:'平方公分', m2:'平方公尺', cm:'公分', m:'公尺' },",
      replace:"      unitLabels:{ cm2:'平方公分', m2:'平方公尺', cm:'公分', m:'米' }," },
    { file:'review', expect:'unitPick why does not point out that the length units are not area units',
      find:"              + '都是長度的單位，不能用來說面積。'",
      replace:"              + '要記得看清楚單位。'" },

    /* ---------- index.html：面積與周長 ---------- */
    { file:'index', expect:'the area is not w x h', via:'index',
      find:'  function areaOf(w, h){ return w * h; }',
      replace:'  function areaOf(w, h){ return w * h + 1; }' },
    { file:'index', expect:'the perimeter is not', via:'index',
      find:'  function perimeterOf(w, h){ return 2 * (w + h); }',
      replace:'  function perimeterOf(w, h){ return 2 * w + h; }' },
    { file:'index', expect:'otherSide(', via:'index',
      find:'    return (side > 0 && area % side === 0) ? area / side : null;',
      replace:'    return (side > 0) ? Math.floor(area / side) : null;' },
    { file:'index', expect:'the ruler you measure the sides with decides the area unit', via:'index',
      find:"  function areaUnitOf(lenUnit){ return (lenUnit === UNIT_M) ? 'm2' : 'cm2'; }",
      replace:"  function areaUnitOf(lenUnit){ return (lenUnit === UNIT_M) ? 'cm2' : 'm2'; }" },
    { file:'index', expect:'the lesson says 1 square metre is', via:'index',
      find:'  var CM2_PER_M2 = CM_PER_M * CM_PER_M;',
      replace:'  var CM2_PER_M2 = CM_PER_M * 10;' },

    /* ---------- index.html：格子圖 ---------- */
    { file:'index', expect:'the picture and the number would disagree', via:'index',
      find:'    for (var r = 0; r < h; r++){\n      for (var c = 0; c < w; c++){\n        out.push({ r:r, c:c, x:GRID_X + c * CELL, y:top + r * CELL, size:CELL });\n      }\n    }\n    return out;\n  }\n  /* 複合圖形',
      replace:'    for (var r = 0; r < h; r++){\n      for (var c = 0; c < w - 1; c++){\n        out.push({ r:r, c:c, x:GRID_X + c * CELL, y:top + r * CELL, size:CELL });\n      }\n    }\n    return out;\n  }\n  /* 複合圖形' },
    { file:'index', expect:'is drawn at', via:'index',
      find:'        out.push({ r:r, c:c, x:GRID_X + c * CELL, y:top + r * CELL, size:CELL });\n      }\n    }\n    return out;\n  }\n  /* 複合圖形',
      replace:'        out.push({ r:r, c:c, x:GRID_X + c * CELL + 1, y:top + r * CELL, size:CELL });\n      }\n    }\n    return out;\n  }\n  /* 複合圖形' },
    { file:'index', expect:'removes the wrong squares', via:'index',
      find:'      return !(cl.r < nh && cl.c >= w - nw);',
      replace:'      return !(cl.r < nh && cl.c < nw);' },
    /* 上面那一條寬到 w：多出來的格子落在缺口裡，所以先響的是「跑出圖形外面」。 */
    { file:'index', expect:'squares of the pieces fall outside the shape', via:'index',
      find:"      { tag:'top',    c0:0, r0:0,  cw:w - nw, ch:nh,     gh:h },",
      replace:"      { tag:'top',    c0:0, r0:0,  cw:w, ch:nh,     gh:h }," },
    /* 上面那一條高一格：完全落在圖形裡，可是和下面那一條重疊 —— 相加會重複算。 */
    { file:'index', expect:'the two pieces overlap', via:'index',
      find:"      { tag:'top',    c0:0, r0:0,  cw:w - nw, ch:nh,     gh:h },",
      replace:"      { tag:'top',    c0:0, r0:0,  cw:w - nw, ch:nh + 1, gh:h }," },
    { file:'index', expect:'the two pieces cover', via:'index',
      find:"      { tag:'bottom', c0:0, r0:nh, cw:w,      ch:h - nh, gh:h }",
      replace:"      { tag:'bottom', c0:0, r0:nh, cw:w,      ch:h - nh - 1, gh:h }" },
    { file:'index', expect:'gridBox(', via:'index',
      find:'  function gridBox(w, h){ return { x:GRID_X, y:gridTop(h), w:w * CELL, h:h * CELL }; }',
      replace:'  function gridBox(w, h){ return { x:GRID_X, y:gridTop(h), w:h * CELL, h:w * CELL }; }' },

    /* ---------- index.html：畫布的四個方向 ---------- */
    { file:'index', expect:'off the right edge', via:'index',
      find:'  var GRID_X = 100;                     // 格子左緣（左邊要留給「寬 …」那個標籤）',
      replace:'  var GRID_X = 200;                     // 格子左緣（左邊要留給「寬 …」那個標籤）' },
    { file:'index', expect:'below the bottom', via:'index',
      find:'  var GRID_MAX_W = 12, GRID_MAX_H = 6;  // 這一課畫得出來的最大格數',
      replace:'  var GRID_MAX_W = 12, GRID_MAX_H = 8;  // 這一課畫得出來的最大格數' },
    /* 貼齊上緣（不居中）：1 排的那一張圖下面會留一大片空白。 */
    { file:'index', expect:'gridTop(1) = 34, independently 115', via:'index',
      find:'    return Math.max(GRID_Y_MIN, Math.round((FIG_H - h * CELL) / 2));',
      replace:'    return GRID_Y_MIN;' },
    { file:'index', expect:'above the top of the canvas', via:'index',
      find:'  var TOP_LBL_DY = 12, LEFT_LBL_DX = 10;',
      replace:'  var TOP_LBL_DY = 30, LEFT_LBL_DX = 10;' },
    { file:'index', expect:'would run off the left edge', via:'index',
      find:'  var GRID_X = 100;                     // 格子左緣（左邊要留給「寬 …」那個標籤）',
      replace:'  var GRID_X = 40;                     // 格子左緣（左邊要留給「寬 …」那個標籤）' },
    { file:'index', expect:'viewBox is', via:'index',
      find:'<svg class="fig" id="s1fig" viewBox="0 0 520 260"',
      replace:'<svg class="fig" id="s1fig" viewBox="0 0 520 270"' },
    { file:'index', expect:'.fig CSS height', via:'index',
      find:'  .fig{width:100%;max-width:520px;height:260px;display:block;margin:0 auto}',
      replace:'  .fig{width:100%;max-width:520px;height:240px;display:block;margin:0 auto}' },
    { file:'index', expect:'.unitfig CSS max-width', via:'index',
      find:'  .unitfig{width:100%;max-width:320px;height:180px;display:block;margin:0 auto}',
      replace:'  .unitfig{width:100%;max-width:300px;height:180px;display:block;margin:0 auto}' },
    { file:'index', expect:'no smaller than 1 square metre', via:'index',
      find:'  var UF_SMALL = 30, UF_BIG = 100;',
      replace:'  var UF_SMALL = 100, UF_BIG = 100;' },
    { file:'index', expect:'do not share their bottom edges', via:'index',
      find:"      { unit:'cm2', len:UNIT_CM, size:UF_SMALL, x:UF_SMALL_X, y:UF_TOP + (UF_BIG - UF_SMALL) },",
      replace:"      { unit:'cm2', len:UNIT_CM, size:UF_SMALL, x:UF_SMALL_X, y:UF_TOP }," },
    { file:'index', expect:'outside the 320x180 unit card', via:'index',
      find:'  var UF_SMALL_X = 34, UF_BIG_X = 172, UF_TOP = 26;',
      replace:'  var UF_SMALL_X = 34, UF_BIG_X = 260, UF_TOP = 26;' },

    /* ---------- index.html：範例資料 ---------- */
    { file:'index', expect:'TILE_CASES has no square', via:'index',
      find:'    { w:5, h:5 },\n    { w:7, h:4 }\n  ];',
      replace:'    { w:5, h:4 },\n    { w:7, h:4 }\n  ];' },
    { file:'index', expect:'TILE_CASES has no two rectangles with the same area', via:'index',
      find:'  var TILE_CASES = [\n    { w:4, h:3 },\n    { w:6, h:2 },',
      replace:'  var TILE_CASES = [\n    { w:4, h:3 },\n    { w:6, h:3 },' },
    { file:'index', expect:'FORMULA_CASES has no square', via:'index',
      find:'  var FORMULA_CASES = [\n    { w:8,  h:3 },\n    { w:5,  h:5 },\n    { w:12, h:2 },\n    { w:6,  h:6 }\n  ];',
      replace:'  var FORMULA_CASES = [\n    { w:8,  h:3 },\n    { w:5,  h:4 },\n    { w:12, h:2 },\n    { w:6,  h:4 }\n  ];' },
    { file:'index', expect:'FORMULA_CASES has no non-square rectangle', via:'index',
      find:'  var FORMULA_CASES = [\n    { w:8,  h:3 },\n    { w:5,  h:5 },\n    { w:12, h:2 },\n    { w:6,  h:6 }\n  ];',
      replace:'  var FORMULA_CASES = [\n    { w:3,  h:3 },\n    { w:5,  h:5 },\n    { w:2, h:2 },\n    { w:6,  h:6 }\n  ];' },
    { file:'index', expect:'but the group claims 24', via:'index',
      find:'  var PERIM_SAME_CASES = [\n    { w:11, h:1 },\n    { w:10, h:2 },',
      replace:'  var PERIM_SAME_CASES = [\n    { w:11, h:1 },\n    { w:10, h:3 },' },
    { file:'index', expect:'s3lead does not print the shared perimeter', via:'index',
      find:'  var PERIM_SAME = 24;',
      replace:'  var PERIM_SAME = 22;' },
    { file:'index', expect:'PERIM_SAME_CASES has two rectangles with the same area', via:'index',
      find:'    { w:8,  h:4 },\n    { w:6,  h:6 }\n  ];',
      replace:'    { w:10,  h:2 },\n    { w:6,  h:6 }\n  ];' },
    { file:'index', expect:'but the group claims 12', via:'index',
      find:'  var AREA_SAME_CASES = [\n    { w:12, h:1 },\n    { w:6,  h:2 },\n    { w:4,  h:3 }\n  ];',
      replace:'  var AREA_SAME_CASES = [\n    { w:12, h:1 },\n    { w:6,  h:2 },\n    { w:4,  h:2 }\n  ];' },
    { file:'index', expect:'AREA_SAME_CASES has two rectangles with the same perimeter', via:'index',
      find:'  var AREA_SAME_CASES = [\n    { w:12, h:1 },\n    { w:6,  h:2 },\n    { w:4,  h:3 }\n  ];',
      replace:'  var AREA_SAME_CASES = [\n    { w:6, h:2 },\n    { w:2,  h:6 },\n    { w:4,  h:3 }\n  ];' },
    /* 字典裡那一句話引用了 AREA_SAME_CASES 真正的周長範圍；改掉其中一個數字就要響。
       （`',` 結尾只出現在字典那一份，markup 的 fallback 不會被這個 find 咬到。） */
    { file:'index', expect:'s3note claims a perimeter range', via:'index',
      find:'周長卻從 14 公分到 26 公分。\',',
      replace:'周長卻從 16 公分到 26 公分。\',' },
    { file:'index', expect:'has an unknown ruler', via:'index',
      find:"    { key:'rug',       len:UNIT_M,  a:3,  b:2  },",
      replace:"    { key:'rug',       len:'inch',  a:3,  b:2  }," },
    { file:'index', expect:'reports its sides in cm, independently m', via:'index',
      find:"    { key:'rug',       len:UNIT_M,  a:3,  b:2  },\n    { key:'classroom', len:UNIT_M,  a:9,  b:8  },\n    { key:'court',     len:UNIT_M,  a:28, b:15 }",
      replace:"    { key:'rug',       len:UNIT_CM,  a:3,  b:2  },\n    { key:'classroom', len:UNIT_CM,  a:9,  b:8  },\n    { key:'court',     len:UNIT_CM, a:28, b:15 }" },
    { file:'index', expect:'the hole is', via:'index',
      find:'    { w:8,  h:5, nw:3, nh:2 },\n    { w:7,  h:4, nw:2, nh:2 },',
      replace:'    { w:8,  h:5, nw:8, nh:2 },\n    { w:7,  h:4, nw:2, nh:2 },' },
    /* ---------- index.html：小遊戲「鋪磚廠闖關」（2026-10-04，§六之五） ---------- */
    { file:"index", via:"index", expect:"a strip of the wrong length is accepted", find:"        if (len !== w){ roundMiss(", replace:"        if (len < w - 1){ roundMiss(" },
    { file:"index", via:"index", expect:"the drawn row says", find:"cy:TILE.y + r * TILE_U + TILE_U / 2, hw:", replace:"cy:TILE.y + r * TILE_U + TILE_U, hw:" },
    { file:"index", via:"index", expect:"not w − 1, w, w + 1", find:"return shuffle([w - 1, w, w + 1]);", replace:"return shuffle([w - 1, w, w + 2]);" },
    { file:"index", via:"index", expect:"does not fit the board", find:"var GAME_TILE = [ { w:4, h:3 }, { w:5, h:3 },", replace:"var GAME_TILE = [ { w:4, h:3 }, { w:6, h:3 }," },
    { file:"index", via:"index", expect:"not given to the nearest row", find:"        var row = nearestOpen(rows, pt, TILE.pad);", replace:"        var row = rows.filter(function(r){ return !r.done && Math.abs(pt.y - r.cy) <= r.hh + TILE.pad; })[0];" },
    { file:"index", via:"index", expect:"not a whole number of rows", find:"{ A:35, w:7 }", replace:"{ A:36, w:7 }" },
    { file:"index", via:"index", expect:"a square", find:"{ A:36, w:9 } ];", replace:"{ A:36, w:6 } ];" },
    { file:"index", via:"index", expect:"a wrong width is accepted", find:"        if (v !== h){ roundMiss(p < e.A ?", replace:"        if (v < h){ roundMiss(p < e.A ?" },
    { file:"index", via:"index", expect:"but the reason says otherwise", find:"' 平方公分，比 ' + A + ' 平方公分少。'; },", replace:"' 平方公分，比 ' + A + ' 平方公分多。'; }," },
    { file:"index", via:"index", expect:"fenceOk(", find:"return w >= 1 && w <= S - 1 && w * (S - w) === e.A; }", replace:"return w >= 1 && w <= S - 1 && w * (S - w) >= e.A; }" },
    { file:"index", via:"index", expect:"unsolvable", find:"{ P:24, A:32 }", replace:"{ P:24, A:33 }" },
    { file:"index", via:"index", expect:"not the nearest", find:"return Math.max(1, Math.min(S - 1, Math.round((x - FENCE.x0) / fenceU(S)))); }", replace:"return Math.max(1, Math.min(S - 1, Math.floor((x - FENCE.x0) / fenceU(S)))); }" },
    { file:"index", via:"index", expect:"does not start at the long thin shape", find:"u = fenceU(S), F = FENCE, w = S - 1;", replace:"u = fenceU(S), F = FENCE, w = S - 3;" },
    { file:"index", via:"index", expect:"judges while ↔ is still held", find:"        if (knob.busy()) return;   /* 另一根手指還拖著 ↔：形狀還沒定，不判、不扣分 */\n", replace:"" },
    { file:"index", via:"index", expect:"wider than the left label", find:"lblH:20, lblW:64 }", replace:"lblH:20, lblW:30 }" },
    { file:"index", via:"index", expect:"wrong basket is accepted", find:"        if (bin.i !== want){ roundMiss(d.gUnitWrong(", replace:"        if (false){ roundMiss(d.gUnitWrong(" },
    { file:"index", via:"index", expect:"unitBin says", find:"function unitBin(c){ return UNIT_ORDER.indexOf(areaUnitOf(c.len)); }", replace:"function unitBin(c){ return c.a >= 100 ? 1 : UNIT_ORDER.indexOf(areaUnitOf(c.len)); }" },
    { file:"index", via:"index", expect:"the tray started", find:"    if (under || first){ var x = t[0]; t[0] = t[3]; t[3] = x; }\n", replace:"" },
    { file:"index", via:"index", expect:"no big thing measured in cm", find:"{ key:'rug', len:UNIT_CM, a:300, b:200 }", replace:"{ key:'book', len:UNIT_CM, a:26, b:19 }" },
    { file:"index", via:"index", expect:"is not its real-life size", find:"{ key:'door', len:UNIT_CM, a:200, b:90 }", replace:"{ key:'door', len:UNIT_CM, a:20, b:9 }" },
    { file:"index", via:"index", expect:"inside a basket's drop zone", find:"UNIT_TRAY = { y:216,", replace:"UNIT_TRAY = { y:180," },
    { file:"index", via:"index", expect:"font size is not", find:"border-radius:12px;font-size:13px;", replace:"border-radius:12px;font-size:15px;" },
    { file:"index", via:"index", expect:"does not name the ruler", find:"return name + '的邊長是用' + ruler + '量的（'", replace:"return name + '的邊長是量的（'" },
    { file:"index", via:"index", expect:"cutResult says", find:"if (L.dir === 'h' && L.k === e.nh) return { ok:true", replace:"if (L.dir === 'h' && L.k >= e.nh) return { ok:true" },
    { file:"index", via:"index", expect:"cutPick() disagrees", find:"    if (close.length === 1) return close[0].L;", replace:"    if (close.length >= 1) return close[0].L;" },
    { file:"index", via:"index", expect:"taps right on a correct cut line are refused", find:"    return good.length ? good[0].L : null;", replace:"    return null;" },
    { file:"index", via:"index", expect:"missing corner's edge", find:"y1:y0 + (c > cw ? e.nh : 0) * U,", replace:"y1:y0 + (c >= cw ? e.nh : 0) * U," },
    { file:"index", via:"index", expect:"non-rectangle is accepted", find:"        if (!r.ok){ roundMiss(d.gCutBad(r.rect.w, r.rect.h)); return; }", replace:"        if (false){ roundMiss(d.gCutBad(r.rect.w, r.rect.h)); return; }" },
    { file:"index", via:"index", expect:"not strictly inside", find:"{ w:5, h:4, nw:2, nh:2 }, { w:6, h:4, nw:2, nh:1 }", replace:"{ w:5, h:4, nw:5, nh:2 }, { w:6, h:4, nw:2, nh:1 }" },
    { file:"index", via:"index", expect:"under 44", find:"var CUT_U = 46,", replace:"var CUT_U = 40," },
    { file:"index", via:"index", expect:"under 44", find:"var TILE_U = 46,", replace:"var TILE_U = 44," },
    { file:"index", via:"index", expect:"measure to the box", find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;", replace:"      var dd = dx * dx + dy * dy, dc = dd;" },
    { file:"index", via:"index", expect:"skips it and lands in the next slot", find:"    return best && !best.done ? best : null;", replace:"    return best;" },
    { file:"index", via:"index", expect:"does not cost 5", find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    gScore = gScore - 5; elScore.textContent = gScore;" },
    { file:"index", via:"index", expect:"+20 with no mistakes", find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:"index", via:"index", expect:"does not start a new board generation", find:"gSolved = false; gMistake = false; gCtx = {}; gGen++;", replace:"gSolved = false; gMistake = false; gCtx = {};" },
    { file:"index", via:"index", expect:"check its board generation", find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:"" },
    { file:"index", via:"index", expect:"GAME_ORDER should be", find:"var GAME_ORDER = ['tile', 'side', 'fence', 'unit', 'cut'];", replace:"var GAME_ORDER = ['tile', 'fence', 'side', 'unit', 'cut'];" },
    { file:"index", via:"index", expect:"does not really shuffle", find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足", replace:"      var k = j;   /* 自足" },
    { file:"index", via:"index", expect:"ahead mode no longer shows", find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'ahead'){ hintLevel = 0; }" },
    { file:"index", via:"index", expect:"numbers should read", find:"' ＝ ' + A + ' 格，面積是 ' + A + ' 平方公分！'; },", replace:"' ＝ ' + (A + 1) + ' 格，面積是 ' + A + ' 平方公分！'; }," },
    { file:"index", via:"index", expect:"numbers should read", find:"a + ' + ' + b + ' = ' + T + ' cm²!'; },", replace:"a + ' + ' + b + ' = ' + (T + 1) + ' cm²!'; }," },
    { file:"index", via:"index", expect:"arithmetic is wrong", find:"' 平方公分，不是 ' + A + '。籬笆一樣長", replace:"' 平方公分，不是 ' + A + '。' + w + ' ＋ ' + h + ' ＝ ' + (w * h) + '。籬笆一樣長" },

    { file:"index", via:"index", expect:"is not marked done", find:"row.done = true; row.el.className = 'growfill'; n++;", replace:"row.el.className = 'growfill'; n++;" },
    { file:"index", via:"index", expect:"a second finger can tap the board", find:"      if (!e.isPrimary) return;   /* 第二根手指：不理", replace:"      if (false) return;   /* 第二根手指：不理" },
    { file:"index", via:"index", expect:"a second finger can pick up a piece", find:"if (!e.isPrimary || P.locked || gSolved", replace:"if (P.locked || gSolved" },
    /* ---------- index.html：字典 ---------- */
    { file:'index', expect:'does not carry the area unit', via:'index',
      find:"      areaText: function(v, u){ return v + ((u === 'm2') ? ' 平方公尺' : ' 平方公分'); },",
      replace:"      areaText: function(v, u){ return v + ((u === 'm2') ? ' 平方公分' : ' 平方公尺'); }," },
    { file:'index', expect:'lenText prints the same thing', via:'index',
      find:"      lenText: function(v, u){ return v + ((u === 'm') ? ' 公尺' : ' 公分'); },",
      replace:"      lenText: function(v, u){ return v + ' 公分'; }," },
    { file:'index', expect:'unitName.cm2 is', via:'index',
      find:"      unitName:{ cm2:'平方公分', m2:'平方公尺' },",
      replace:"      unitName:{ cm2:'平方公尺', m2:'平方公分' }," },
    { file:'index', expect:'unitRuler.cm2 is', via:'index',
      find:"      unitRuler:{ cm2:'公分', m2:'公尺' },",
      replace:"      unitRuler:{ cm2:'公尺', m2:'公分' }," },
    { file:'index', expect:'unitExample.cm2 is', via:'index',
      find:"      unitExample:{ cm2:'郵票、課本封面、手帕', m2:'地毯、教室地板、籃球場' },",
      replace:"      unitExample:{ cm2:'地毯、教室地板、籃球場', m2:'郵票、課本封面、手帕' }," },
    { file:'index', expect:'objectNames.court is', via:'index',
      find:"      objectNames:{ stamp:'郵票', book:'課本封面', towel:'手帕', rug:'地毯', classroom:'教室地板', court:'籃球場' },",
      replace:"      objectNames:{ stamp:'郵票', book:'課本封面', towel:'手帕', rug:'地毯', classroom:'教室地板', court:'球場' }," },
    { file:'index', expect:'s1narr', via:'index',
      find:"        return '每一排 ' + w + ' 格，一共 ' + h + ' 排，所以鋪滿了 ' + w + ' × ' + h + ' ＝ ' + area + ' 格。'\n             + '一格是 1 平方公分，所以面積是 ' + area + ' 平方公分。';",
      replace:"        return '每一排 ' + w + ' 格，一共很多排，所以鋪滿了 ' + area + ' 格。'\n             + '一格是 1 平方公分，所以面積是 ' + area + ' 平方公分。';" },
    { file:'index', expect:'s2back', via:'index',
      find:"      s2back: function(area, w, h){ return area + ' ÷ ' + w + ' ＝ ' + h + '，所以另一邊是 ' + h + ' 公分。'; },",
      replace:"      s2back: function(area, w, h){ return area + ' ÷ ' + w + ' 算出來就是另一邊。'; }," },
    { file:'index', expect:'s3narr', via:'index',
      find:"        return '繞一圈：（' + w + ' ＋ ' + h + '）× 2 ＝ ' + per + ' 公分。'",
      replace:"        return '繞一圈：（' + w + ' ＋ ' + h + '）× 2 公分。'" },
    { file:'index', expect:'s4derive does not show', via:'index',
      find:"      s4derive:'1 公尺 ＝ 100 公分，所以邊長 1 公尺的正方形，也可以看成邊長 100 公分的正方形：<strong>100 × 100 ＝ 10000</strong> —— 1 平方公尺就是 <strong>10000 平方公分</strong>。',",
      replace:"      s4derive:'1 公尺 ＝ 100 公分，所以 1 平方公尺就是很多平方公分。'," },
    { file:'index', expect:'s5same', via:'index',
      find:"      s5same: function(total){ return '兩種做法都是 ' + total + ' 平方公分 —— 切法不會改變面積。'; },",
      replace:"      s5same: function(total){ return '兩種做法的答案是一樣的 —— 切法不會改變面積。'; }," },
    /* ---------- index.html：三層題庫 ---------- */
    { file:'index', expect:'marked answer is', via:'index',
      find:"        { stem:'一個長方形長 7 公分、寬 4 公分，面積是多少？', opts:['22 平方公分','11 平方公分','28 平方公分','28 公分'], ans:2,",
      replace:"        { stem:'一個長方形長 7 公分、寬 4 公分，面積是多少？', opts:['22 平方公分','11 平方公分','28 平方公分','28 公分'], ans:0," },
    { file:'index', expect:'stem prints', via:'index',
      find:"        { stem:'一個長方形長 7 公分、寬 4 公分，面積是多少？'",
      replace:"        { stem:'一個長方形長 7 公分、寬 4 公分、高 2 公分，面積是多少？'" },
    { file:'index', expect:'the stem no longer says', via:'index',
      find:"        { stem:'一個長方形長 8 公分、寬 3 公分，繞它一圈的周長是多少？'",
      replace:"        { stem:'一個長方形長 8 公分、寬 3 公分，裡面鋪滿了幾格？'" },
    { file:'index', expect:'the explanation never states', via:'index',
      find:"          why:'長 × 寬 ＝ 7 × 4 ＝ 28，面積是 28 平方公分。22 是繞一圈的周長（（7 ＋ 4）× 2），11 是 7 ＋ 4，而面積的單位是平方公分不是公分。' },",
      replace:"          why:'長 × 寬 ＝ 7 × 4 ＝ 28，面積是 28 平方公分。11 是 7 ＋ 4，而面積的單位是平方公分不是公分。' }," },
    { file:'index', expect:'is outside 1~10000', via:'index',
      find:"        { stem:'文字題：1 平方公尺是幾平方公分？', opts:['100 平方公分','1000 平方公分','10000 平方公分','200 平方公分'], ans:2,",
      replace:"        { stem:'文字題：1 平方公尺是幾平方公分？', opts:['100 平方公分','1000 平方公分','10000 平方公分','2000000 平方公分'], ans:2," },
    { file:'index', expect:'is not a number with one of this lesson', via:'index',
      find:"        { stem:'一個正方形的邊長是 6 公分，面積是多少？', opts:['36 平方公分','24 平方公分','12 平方公分','36 公分'], ans:0,",
      replace:"        { stem:'一個正方形的邊長是 6 公分，面積是多少？', opts:['36 平方公分','24 平方公分','12 平方公分','三十六'], ans:0," },
    { file:'index', expect:'this question only allows', via:'index',
      find:"        { stem:'文字題：客廳長 5 公尺、寬 4 公尺，中間鋪一塊長 3 公尺、寬 2 公尺的地毯。沒有被地毯蓋住的地板是幾平方公尺？',\n          opts:['26 平方公尺','20 平方公尺','14 平方公尺','6 平方公尺'], ans:2,",
      replace:"        { stem:'文字題：客廳長 5 公尺、寬 4 公尺，中間鋪一塊長 3 公尺、寬 2 公尺的地毯。沒有被地毯蓋住的地板是幾平方公尺？',\n          opts:['26 平方公分','20 平方公尺','14 平方公尺','6 平方公尺'], ans:2," },

    /* ---------- 這一輪 codex 審查補上的斷言，各自配一筆改壞 ---------- */
    /* 刪掉（改名）一整支產生器：simgen 只會少跑那一支，靜靜地什麼都不說。 */
    { file:'review', expect:'no longer declares the generator "gardenM2"', via:'index',
      find:"    { id:'gardenM2', cat:'unit',", replace:"    { id:'gardenM2x', cat:'unit'," },
    /* 題幹改成問周長、正解卻還是面積 —— 所有數字檢查都還會是綠的。 */
    { file:'review', expect:'rectArea stem no longer asks for what it answers',
      find:"            ? '一個長方形長 ' + d.w + ' 公分、寬 ' + d.h + ' 公分，面積是多少？'",
      replace:"            ? '一個長方形長 ' + d.w + ' 公分、寬 ' + d.h + ' 公分，周長是多少？'" },
    /* 上課頁自己要把範圍講給讀者聽（只寫在註解裡不算）。 */
    { file:'index', expect:'scopeNote does not mention "五年級"', via:'index',
      find: '公畝、公頃、平行四邊形和三角形留到<strong>五年級</strong>。\',',
      replace:'公畝、公頃、平行四邊形和三角形留到<strong>高年級</strong>。\',' },
    /* 挑單位那一題的選項要剛好是四個單位標籤（兩個面積、兩個長度）。 */
    { file:'index', expect:'the options are not exactly the four unit labels', via:'index',
      find:"opts:['平方公分','公尺','公分','平方公尺'], ans:3,",
      replace:"opts:['平方公分','公尺','公分','平方英尺'], ans:3," },
    /* 解釋要把算式寫出來：把「7 × 4」拿掉，每一個要求的數字都還在。 */
    { file:'index', expect:'no longer shows "7 × 4"', via:'index',
      find:"          why:'長 × 寬 ＝ 7 × 4 ＝ 28，面積是 28 平方公分。",
      replace:"          why:'長 × 寬 算出來是 28，面積是 28 平方公分。" },
    /* 負號會被 \d+ 吃掉，「-7 公分」看起來還是 7。 */
    { file:'index', expect:'there is a negative number', via:'index',
      find:"        { stem:'一個長方形長 7 公分、寬 4 公分，面積是多少？', opts:['22 平方公分'",
      replace:"        { stem:'一個長方形長 -7 公分、寬 4 公分，面積是多少？', opts:['22 平方公分'" },

    { file:'index', expect:'footer restates the unit rule without the same-unit prerequisite', via:'index',
      find:'兩條邊先用<strong>同一個單位</strong>量，周長就用那個單位，面積用那個單位的「平方」。</strong>\'',
      replace:'周長就用邊長的單位，面積用那個單位的「平方」。</strong>\'' },
    { file:'index', expect:'no longer says the two sides must first be given in the same unit', via:'index',
      find:'面積就是幾平方公尺。兩條邊要先用<strong>同一個單位</strong>說（都用公分，或都用公尺），面積才跟著那個單位走。同一個東西<strong>兩種尺都量得出來</strong> —— 小東西習慣用公分、大東西習慣用公尺，那是<strong>習慣，不是規則</strong>。點一個東西看看。\',',
      replace:'面積就是幾平方公尺。同一個東西<strong>兩種尺都量得出來</strong> —— 小東西習慣用公分、大東西習慣用公尺，那是<strong>習慣，不是規則</strong>。點一個東西看看。\',' },
    { file:'review', expect:'compositeSub why does not show the subtraction',
      find:"              + d.nw + ' × ' + d.nh + ' ＝ ' + d.hole + '；相減 ' + d.big + ' － ' + d.hole + ' ＝ '",
      replace:"              + d.nw + ' × ' + d.nh + ' ＝ ' + d.hole + '；相減 ' + d.big + ' ＋ ' + d.hole + ' ＝ '" },
    { file:'review', expect:'compositeAdd why does not show the addition',
      find:"              + d.c + ' × ' + d.e + ' ＝ ' + d.two + '，' + d.one + ' ＋ ' + d.two + ' ＝ ' + d.correct + ' 平方公分。'",
      replace:"              + d.c + ' × ' + d.e + ' ＝ ' + d.two + '，' + d.one + ' － ' + d.two + ' ＝ ' + d.correct + ' 平方公分。'" },
    /* 註解掉一整支產生器：它不再執行，可是原始碼裡還看得到那個 id。 */
    { file:'review', expect:'no longer declares the generator "gardenM2"', via:'index',
      find:"    { id:'gardenM2', cat:'unit',", replace:"    // { id:'gardenM2', cat:'unit'," },
    { file:'index', expect:'there is a negative number', via:'index',
      find:"        { stem:'一個正方形的邊長是 6 公分，面積是多少？'",
      replace:"        { stem:'一個正方形的邊長是－6 公分，面積是多少？'" },

    /* ---------- reference.html 與 parents.html 的措辭 ---------- */
    /* 中文字串在這些頁面上一定有兩份（markup 的 fallback ＋ 字典），
       所以 find 要帶上只有字典那一份才有的結尾 `',`。 */
    { file:'reference', expect:'no longer says "面積 ÷ 一邊 ＝ 另一邊"', via:'index',
      find:'面積 ÷ 一邊 ＝ 另一邊。\',', replace:'面積 － 一邊 ＝ 另一邊。\',' },
    { file:'reference', expect:'which contradicts the rule this lesson teaches', via:'index',
      find:"      sw3:'<strong>單位裡</strong>看到「平方」兩個字，就是在講面積',",
      replace:"      sw3:'周長比較大，面積就比較大'," },
    { file:'reference', expect:'1 m² = 10000 cm²', via:'index',
      find:'1 m² = 10000 cm²', replace:'1 m² = 1000 cm²' },
    { file:'reference', expect:'unit table has 平方公尺 before 平方公分', via:'index',
      find:'          <td class="eq" data-i18n="u1a">平方公分</td>\n          <td data-i18n="u1b">邊長 1 公分的正方形</td>\n          <td data-i18n="u1c">公分</td>\n          <td data-i18n="u1d">郵票、課本封面、手帕</td>\n        </tr>\n        <tr>\n          <td class="eq" data-i18n="u2a">平方公尺</td>',
      replace:'          <td class="eq" data-i18n="u2a">平方公尺</td>\n          <td data-i18n="u1b">邊長 1 公分的正方形</td>\n          <td data-i18n="u1c">公分</td>\n          <td data-i18n="u1d">郵票、課本封面、手帕</td>\n        </tr>\n        <tr>\n          <td class="eq" data-i18n="u1a">平方公分</td>' },
    { file:'parents', expect:'no longer says "鋪磚廠闖關"', via:'index',
      find:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「鋪磚廠闖關」',
      replace:'"readyBox": "精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「面積闖關」' },
    { file:'parents', expect:'which contradicts the rule this lesson teaches', via:'index',
      find:'<p class="bigline" data-i18n="s1p2">',
      replace:'<p class="bigline" data-i18n="s1p2">面積一樣，周長就一定一樣。' },
    { file:'parents', expect:'10000 cm²', via:'index',
      find:'the answer is <strong>10000 cm²</strong>', replace:'the answer is <strong>1000 cm²</strong>' }
  ],

  sim: {
    /* fmt() 要印單位、物品名稱與尺的名稱，那些表宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    INVARIANTS: {
      rectArea: d => {
        if (W_POOL.indexOf(d.w) < 0) return 'rectArea: w ' + d.w + ' is outside the declared pool';
        if (H_POOL.indexOf(d.h) < 0) return 'rectArea: h ' + d.h + ' is outside the declared pool';
        if (d.w === d.h) return 'rectArea: ' + d.w + ' x ' + d.h + ' is a square, but this generator only draws rectangles';
        if (d.correct !== areaRef(d.w, d.h)) return 'rectArea: correct is not the area (w x h)';
        if (d.per !== perimeterRef(d.w, d.h)) return 'rectArea: per is not the perimeter of the printed sides';
        if (d.correct === d.per) return 'rectArea: the area equals the perimeter, so the perimeter distractor collides with the answer';
        if (d.opts.indexOf(d.per) < 0) return 'rectArea does not offer the perimeter ' + d.per + ' as a distractor';
      },
      squareArea: d => {
        if (S_POOL.indexOf(d.s) < 0) return 'squareArea: s ' + d.s + ' is outside the declared pool';
        if (d.correct !== areaRef(d.s, d.s)) return 'squareArea: correct is not s x s';
        if (d.per !== perimeterRef(d.s, d.s)) return 'squareArea: per is not the perimeter';
        if (d.correct === d.per) return 'squareArea: the area equals the perimeter, so the perimeter distractor collides with the answer';
        if (d.opts.indexOf(d.per) < 0) return 'squareArea does not offer the perimeter ' + d.per + ' as a distractor';
      },
      missingSide: d => {
        if (W_POOL.indexOf(d.w) < 0 || H_POOL.indexOf(d.h) < 0) return 'missingSide: a side is outside the declared pools';
        if (d.area !== areaRef(d.w, d.h)) return 'missingSide: area is not w x h';
        if (d.correct !== otherSideRef(d.area, d.w))
          return 'missingSide: correct is not the area divided by the printed side (' + d.correct + ' vs ' + otherSideRef(d.area, d.w) + ')';
        if (d.correct === d.w) return 'missingSide: the answer equals the side printed in the stem';
      },
      countCells: d => {
        if (W_POOL.indexOf(d.w) < 0 || H_POOL.indexOf(d.h) < 0) return 'countCells: a count is outside the declared pools';
        if (d.correct !== areaRef(d.w, d.h)) return 'countCells: correct is not rows x columns';
      },
      perimeterVsArea: d => {
        if (W_POOL.indexOf(d.w) < 0 || H_POOL.indexOf(d.h) < 0) return 'perimeterVsArea: a side is outside the declared pools';
        if (d.area !== areaRef(d.w, d.h)) return 'perimeterVsArea: area is not w x h';
        if (d.correct !== perimeterRef(d.w, d.h)) return 'perimeterVsArea: correct is not the perimeter';
        if (d.correct === d.area) return 'perimeterVsArea: the perimeter equals the area, so the area distractor collides with the answer';
        if (d.opts.indexOf(d.area) < 0) return 'perimeterVsArea does not offer the area ' + d.area + ' as a distractor';
      },
      unitPick: d => {
        if (!Object.prototype.hasOwnProperty.call(OBJECT_LEN, d.key)) return 'unitPick: unknown object ' + d.key;
        if (d.len !== OBJECT_LEN[d.key])
          return 'unitPick: an object is measured with the wrong ruler (' + d.key + ' says ' + d.len + ', independently ' + OBJECT_LEN[d.key] + ')';
        /* 題幹一定要報出邊長 —— 少了它，答案就只剩「這個東西該用哪一種單位」的偏好（codex）。 */
        const sides = OBJECT_SIDES[d.key];
        if (!sides) return 'unitPick: no side lengths declared for ' + d.key;
        if (d.a !== sides[0] || d.b !== sides[1])
          return 'unitPick: ' + d.key + ' is ' + d.a + 'x' + d.b + ', independently ' + sides[0] + 'x' + sides[1];
        if (!Number.isInteger(d.a) || !Number.isInteger(d.b) || d.a < 1 || d.b < 1)
          return 'unitPick: the printed side lengths are not positive whole numbers';
        if (d.correct !== areaUnitRef(d.len))
          return 'unitPick: the marked unit is not the one the ruler decides (' + d.correct + ' vs ' + areaUnitRef(d.len) + ')';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4)
          return 'unitPick: the options are not the four unit labels (' + d.opts.join(',') + ')';
        /* 這一條同時保證了「長度單位（公分／公尺）也在選項裡」—— 那正是這一題要抓的
           最常見錯誤。四個標籤的宇宙剛好只有四個成員，所以「四個互不相同且都在表裡」
           就等於「四個都在」，不需要再單獨驗一次。 */
        if (['cm2','m2','cm','m'].some(k => d.opts.indexOf(k) < 0))
          return 'unitPick: the options are not the four unit labels (' + d.opts.join(',') + ')';
      },
      m2Convert: d => {
        if (d.dir !== 'toCm' && d.dir !== 'toM2') return 'm2Convert: unknown direction ' + d.dir;
        const toCm = (d.dir === 'toCm');
        if (d.unit !== (toCm ? 'cm2' : 'm2')) return 'm2Convert: the answer unit does not match the direction';
        if (d.correct !== (toCm ? CM2_PER_M2 : 1)) return 'm2Convert: correct is not the 1 m² = 10000 cm² fact';
        /* 這一課只教這一個換算，數字不可以放大到年段範圍外面（codex）。 */
        if (d.opts.some(v => v > CM2_PER_M2 || v < 1))
          return 'm2Convert: an option (' + d.opts.join(',') + ') is outside 1~' + CM2_PER_M2;
      },
      compositeAdd: d => {
        if (CA_A.indexOf(d.a) < 0 || CA_B.indexOf(d.b) < 0 || CA_C.indexOf(d.c) < 0 || CA_D.indexOf(d.e) < 0)
          return 'compositeAdd: a piece size is outside the declared pools';
        if (d.one !== areaRef(d.a, d.b) || d.two !== areaRef(d.c, d.e)) return 'compositeAdd: a piece area is not w x h';
        if (d.one === d.two) return 'compositeAdd: the two pieces have the same area, so the two single-piece distractors collide';
        if (d.correct !== d.one + d.two) return 'compositeAdd: correct is not the two pieces added';
      },
      compositeSub: d => {
        if (CS_W.indexOf(d.w) < 0 || CS_H.indexOf(d.h) < 0) return 'compositeSub: the rectangle is outside the declared pools';
        if (CS_NW.indexOf(d.nw) < 0 || CS_NH.indexOf(d.nh) < 0) return 'compositeSub: the hole is outside the declared pools';
        if (!(d.nw < d.w && d.nh < d.h))
          return 'compositeSub: the hole is not smaller than the rectangle in both directions (' +
                 d.nw + 'x' + d.nh + ' out of ' + d.w + 'x' + d.h + ')';
        /* 缺口最多吃掉 w − 2 欄，所以「切成兩塊」的上面那一條至少還有 2 格寬 ——
           1 格寬的長條看起來不像「缺一角」，孩子也數不出兩塊。 */
        if (!(d.nw <= d.w - 2))
          return 'compositeSub: the hole leaves only ' + (d.w - d.nw) + ' column(s) on top, and the cut needs at least 2';
        if (d.big !== areaRef(d.w, d.h) || d.hole !== areaRef(d.nw, d.nh)) return 'compositeSub: big or hole is not w x h';
        if (d.correct !== d.big - d.hole) return 'compositeSub: correct is not the big rectangle minus the hole';
        if (d.correct === d.hole) return 'compositeSub: what is left equals the hole, so those two distractors collide';
        /* 從角上挖掉一塊長方形不會改變周長，所以「算周長」也可能走到正解上。 */
        if (d.correct === perimeterRef(d.w, d.h))
          return 'compositeSub: the area left (' + d.correct + ') equals the shape\'s perimeter, ' +
                 'so working out the perimeter reaches the key';
        if (d.opts.indexOf(d.big) < 0) return 'compositeSub does not offer the un-subtracted rectangle ' + d.big + ' as a distractor';
      },
      gardenM2: d => {
        if (W_POOL.indexOf(d.w) < 0 || H_POOL.indexOf(d.h) < 0) return 'gardenM2: a side is outside the declared pools';
        if (d.correct !== areaRef(d.w, d.h)) return 'gardenM2: correct is not the area';
        if (d.per !== perimeterRef(d.w, d.h)) return 'gardenM2: per is not the perimeter';
        if (d.correct === d.per) return 'gardenM2: the area equals the perimeter, so the perimeter distractor collides with the answer';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，不呼叫產生器的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      const A = v => v + ' ' + UNIT_LABELS[lang].cm2;
      const M = v => v + ' ' + UNIT_LABELS[lang].m2;
      const Lc = v => v + ' ' + UNIT_LABELS[lang].cm;
      switch (genId){
        case 'rectArea':        return A(areaRef(d.w, d.h));
        case 'squareArea':      return A(areaRef(d.s, d.s));
        case 'missingSide':     return Lc(otherSideRef(areaRef(d.w, d.h), d.w));
        case 'countCells':      return A(areaRef(d.w, d.h));
        case 'perimeterVsArea': return Lc(perimeterRef(d.w, d.h));
        case 'unitPick':        return UNIT_LABELS[lang][areaUnitRef(OBJECT_LEN[d.key])];
        case 'm2Convert':       return (d.dir === 'toCm' ? CM2_PER_M2 : 1) + ' ' + UNIT_LABELS[lang][d.dir === 'toCm' ? 'cm2' : 'm2'];
        case 'compositeAdd':    return A(areaRef(d.a, d.b) + areaRef(d.c, d.e));
        case 'compositeSub':    return A(areaRef(d.w, d.h) - areaRef(d.nw, d.nh));
        case 'gardenM2':        return M(areaRef(d.w, d.h));
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：資料全對、選項全對，印錯一樣會教錯。 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const why = String(q.why).replace(/<[^>]+>/g, ' ');
      const U = UNIT_LABELS[lang];

      if (/\d\.\d/.test(stem) || /\d\.\d/.test(String(q.opts.join(' '))))
        return genId + ' prints a decimal, but every length and area in this lesson is a whole number';
      /* 數字前面的負號會被 \d+ 吃掉，「-7 公分」看起來還是 7（codex）。 */
      /* 全形與 en dash 也要算：`－7`／`–7` 在後面的 \d+ 檢查裡都會被讀成 7
         （2026-08-27 codex 第二輪）。 */
      if (NEG.test(stem) || NEG.test(String(q.opts.join(' '))))
        return genId + ' prints a negative number, but every length and area in this lesson is positive';

      /* 題幹問的是什麼？只驗數字的話，把題幹改成問周長、正解還是面積，全部都是綠的。 */
      const ask = ASK[genId];
      if (!ask) return 'no "what does the stem ask" cues declared for ' + genId;
      for (const cue of ask[lang]){
        if (stem.indexOf(cue) < 0) return genId + ' stem no longer asks for what it answers (missing "' + cue + '")';
      }
      for (const cue of ask[lang + 'Not']){
        if (stem.indexOf(cue) >= 0) return genId + ' stem now says "' + cue + '", which is a different quantity from its answer';
      }

      /* 誘答不可以是題幹印出來的數字。simgen 內建那一條比的是**整個選項字串**，
         而這一課的選項都帶單位（「28 平方公分」），所以它永遠不會命中 ——
         這裡把數值拆出來再比一次。 */
      if (TEXT_GENS.indexOf(genId) < 0){
        const stemNums = (stem.match(/\d+/g) || []).map(Number);
        for (let i = 0; i < q.opts.length; i++){
          if (i === q.ans) continue;
          const p = valUnit(q.opts[i], lang);
          if (p && stemNums.indexOf(p.v) >= 0)
            return genId + ' distractor "' + q.opts[i] + '" repeats a number printed in the stem';
        }
      }

      /* 解釋要把**算式**寫出來，不是只把答案的數字印出來 ——
         把「長 × 寬」改成「長 ＋ 寬」時，每一個要求的數字都還在（codex）。 */
      const MULT = { rectArea:[d.w, d.h], gardenM2:[d.w, d.h], squareArea:[d.s, d.s],
                     countCells:[d.w, d.h], compositeSub:[d.w, d.h] };
      if (MULT[genId]){
        const expr = MULT[genId][0] + ' × ' + MULT[genId][1];
        if (why.indexOf(expr) < 0) return genId + ' why does not show the multiplication "' + expr + '"';
      }
      /* 相加／相減也要看得到算式：只驗「三個數字都出現」的話，
         「40 ＋ 6 ＝ 34」也會過（2026-08-27 codex 第二輪）。 */
      const MINUS = (lang === 'zh') ? ' － ' : ' − ';
      const PLUS = (lang === 'zh') ? ' ＋ ' : ' + ';
      if (genId === 'compositeSub'){
        const expr = d.big + MINUS + d.hole;
        if (why.indexOf(expr) < 0) return 'compositeSub why does not show the subtraction "' + expr + '"';
      }
      if (genId === 'compositeAdd'){
        const expr = d.one + PLUS + d.two;
        if (why.indexOf(expr) < 0) return 'compositeAdd why does not show the addition "' + expr + '"';
      }

      if (genId === 'rectArea' || genId === 'gardenM2'){
        if (!printsNum(stem, d.w) || !printsNum(stem, d.h))
          return genId + ' stem does not print both sides ' + d.w + ' and ' + d.h;
        if (!printsNum(why, d.correct)) return genId + ' why never states the answer ' + d.correct;
        if (!printsNum(why, d.per)) return genId + ' why does not say the perimeter distractor ' + d.per + ' is a perimeter';
      }
      if (genId === 'squareArea'){
        if (!printsNum(stem, d.s)) return 'squareArea stem does not print the side ' + d.s;
        if (!printsNum(why, d.correct)) return 'squareArea why never states the answer ' + d.correct;
        if (!printsNum(why, d.per)) return 'squareArea why does not mention the perimeter ' + d.per;
      }
      if (genId === 'missingSide'){
        if (!printsNum(stem, d.area) || !printsNum(stem, d.w))
          return 'missingSide stem does not print the area ' + d.area + ' and the known side ' + d.w;
        if (!printsNum(why, d.correct)) return 'missingSide why never states the answer ' + d.correct;
        if (why.indexOf('÷') < 0) return 'missingSide why does not show a division';
      }
      if (genId === 'countCells'){
        if (!printsNum(stem, d.w) || !printsNum(stem, d.h))
          return 'countCells stem does not print both counts ' + d.w + ' and ' + d.h;
        if (!printsNum(why, d.correct)) return 'countCells why never states the answer ' + d.correct;
      }
      if (genId === 'perimeterVsArea'){
        const cue = (lang === 'zh') ? '周長' : 'perimeter';
        if (stem.indexOf(cue) < 0) return 'perimeterVsArea stem no longer asks for the perimeter';
        if (!printsNum(why, d.correct)) return 'perimeterVsArea why never states the answer ' + d.correct;
        if (!printsNum(why, d.area)) return 'perimeterVsArea why does not point at the area distractor ' + d.area;
      }
      if (genId === 'unitPick'){
        if (!printsNum(stem, d.a) || !printsNum(stem, d.b))
          return 'unitPick stem does not print the side lengths ' + d.a + ' and ' + d.b +
                 ', so the answer would come down to taste';
        /* 解釋要指著「邊長的單位」，不是指著「該拿哪一把尺」。
           ⚠️ 不可以只比單位名：'公分' 是 '平方公分' 的子字串，那樣永遠是綠的。
           所以比的是把邊長單位和答案綁在一起的**那一句話**。 */
        const bind = (lang === 'zh') ? '邊長的單位是' + U[d.len] : 'The sides are given in ' + U[d.len];
        if (why.indexOf(bind) < 0)
          return 'unitPick why does not tie the answer to the unit the sides are given in ("' + bind + '")';
        if (why.indexOf(U[d.correct]) < 0) return 'unitPick why does not name the answer ' + U[d.correct];
        const notArea = (lang === 'zh') ? '都是長度的單位' : 'are units of length';
        if (why.indexOf(notArea) < 0)
          return 'unitPick why does not point out that the length units are not area units';
      }
      if (genId === 'm2Convert'){
        const toCm = (d.dir === 'toCm');
        if (!printsNum(stem, toCm ? 1 : CM2_PER_M2))
          return 'm2Convert stem does not print the quantity it converts from';
        if (why.indexOf(CM_PER_M + ' × ' + CM_PER_M) < 0)
          return 'm2Convert why does not show ' + CM_PER_M + ' × ' + CM_PER_M + ', which is why it is not just 100';
        if (!printsNum(why, CM2_PER_M2)) return 'm2Convert why never states ' + CM2_PER_M2;
        for (const o of q.opts){
          const pu = valUnit(o, lang);
          if (!pu || pu.unit !== d.unit)
            return 'm2Convert option "' + o + '" does not carry the unit this direction asks for (' + d.unit + ')';
        }
      }
      if (genId === 'compositeAdd'){
        if (!printsNum(stem, d.a) || !printsNum(stem, d.b) || !printsNum(stem, d.c) || !printsNum(stem, d.e))
          return 'compositeAdd stem does not print all four piece sides';
        /* 「拼起來就相加」只有在沒有重疊時才成立 —— 題幹必須把那個條件講出來。 */
        const overlapCue = (lang === 'zh') ? '沒有重疊' : 'without overlapping';
        if (stem.indexOf(overlapCue) < 0)
          return 'compositeAdd stem no longer says the pieces do not overlap, so adding is not justified';
        if (!printsNum(why, d.correct)) return 'compositeAdd why never states the answer ' + d.correct;
        if (!printsNum(why, d.one) || !printsNum(why, d.two)) return 'compositeAdd why does not show both piece areas';
      }
      if (genId === 'compositeSub'){
        if (!printsNum(stem, d.w) || !printsNum(stem, d.h) || !printsNum(stem, d.nw) || !printsNum(stem, d.nh))
          return 'compositeSub stem does not print the rectangle and the hole';
        if (!printsNum(why, d.big) || !printsNum(why, d.hole) || !printsNum(why, d.correct))
          return 'compositeSub why does not show the subtraction ' + d.big + ' - ' + d.hole + ' = ' + d.correct;
      }

      /* 選項的單位：面積題一定是面積單位，邊長題一定是長度單位。 */
      if (TEXT_GENS.indexOf(genId) < 0 && genId !== 'm2Convert'){
        const want = OPT_UNIT[genId];
        if (!want) return 'no option unit declared for ' + genId;
        for (const o of q.opts){
          const p = valUnit(o, lang);
          if (!p) return genId + ' option "' + o + '" is not a number with one of this lesson\'s units';
          if (p.unit !== want)
            return genId + ' option "' + o + '" carries the unit ' + p.unit + ', expected ' + want +
                   (want === 'cm' ? ' — this generator asks for a length, and a length is not an area'
                                  : ' — this generator asks for an area');
        }
      }
      return null;
    },

    /* 這一課的選項都帶著單位，題幹印的是純數字，所以 simgen 內建的「誘答抄題幹」
       （整串字串比對）本來就不會命中；真正的檢查在上面的 renderCheck 裡，
       它把數值拆出來再比一次。 */
    stemEchoOk: {},

    /* 選項的形狀與範圍。 */
    optionOk: function(s, genId, lang){
      const str = String(s);
      if (/[·#]/.test(str)) return 'junk option ' + str;
      if (genId === 'unitPick'){
        const allowed = ['cm2','m2','cm','m'].map(k => UNIT_LABELS[lang][k]);
        return (allowed.indexOf(str) < 0) ? 'unitPick option "' + str + '" is not one of the four unit labels' : null;
      }
      const p = valUnit(str, lang);
      if (!p) return 'option "' + str + '" is not a number with one of this lesson\'s units';
      const want = OPT_UNIT[genId];
      if (want && p.unit !== want) return 'option "' + str + '" carries the unit ' + p.unit + ', expected ' + want;
      /* m2Convert 的單位隨方向變，optionOk 拿不到 d，所以這裡只擋「不是面積單位」，
         「這一批該用哪一個」交給 renderCheck 用 d.unit 驗。 */
      if (genId === 'm2Convert' && p.unit !== 'cm2' && p.unit !== 'm2')
        return 'm2Convert option "' + str + '" is not an area unit';
      const bounds = RANGE[genId];
      if (!bounds) return 'no range declared for ' + genId;
      if (!(p.v >= bounds[0] && p.v <= bounds[1])) return 'option ' + str + ' outside ' + bounds[0] + '~' + bounds[1];
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{UNIT_CM, UNIT_M, areaUnitOf, CM_PER_M, CM2_PER_M2, areaOf, perimeterOf, otherSide, ' +
                'FIG_W, FIG_H, CELL, GRID_X, GRID_Y_MIN, gridTop, GRID_MAX_W, GRID_MAX_H, SIDE_FONT, TOP_LBL_DY, LEFT_LBL_DX, ' +
                'UF_W, UF_H, UF_SMALL, UF_BIG, UF_SMALL_X, UF_BIG_X, UF_TOP, UF_FONT, UF_LBL_DY, ' +
                'gridBox, cellList, lCellList, lParts, partCellList, sideLabels, unitFigBoxes, ' +
                'TILE_CASES, FORMULA_CASES, PERIM_SAME, PERIM_SAME_CASES, AREA_SAME, AREA_SAME_CASES, ' +
                'UNIT_CASES, UNIT_ORDER, COMPOSITE_CASES, ' +
                'GPICK, shuffle, pick, TILE_U, TILE, TILE_TRAY, TILE_H, GAME_TILE, tileX0, tileRows, tileTray, ' +
                'SIDE_U, SIDE, SIDE_KEYS, SIDE_H, GAME_SIDE, sideSlot, FENCE, FENCE_H, GAME_FENCE, fenceU, fenceW, fenceOk, ' +
                'UNIT_BIN, UNIT_CARD, UNIT_TRAY, UNIT_H, UNIT_ICON, GAME_UNIT, unitBin, unitTray, ' +
                'CUT_U, CUT, CUT_H, GAME_CUT, cutX0, cutLines, segDist, cutPick, cutResult, cutInner, cutBoxes}',
    optionValueMax: CM2_PER_M2,

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      /* ---------- 0. 這一課宣告的範圍與常數 ---------- */
      if (data.UNIT_CM !== 'cm' || data.UNIT_M !== 'm')
        fail(`the lesson's length-unit tags are ${data.UNIT_CM}/${data.UNIT_M}, this config assumes cm/m`);
      if (data.CM_PER_M !== CM_PER_M) fail(`the lesson says 1 m is ${data.CM_PER_M} cm, independently ${CM_PER_M}`);
      if (data.CM2_PER_M2 !== CM2_PER_M2)
        fail(`the lesson says 1 square metre is ${data.CM2_PER_M2} square centimetres, independently ${CM2_PER_M2} — ` +
             'both the length and the width change, so it is 100 x 100, not 100');

      /* ---------- 1. 面積、周長、反算一邊、挑單位：兩套寫法要一致 ---------- */
      let arithFails = 0;
      for (let w = 1; w <= 15 && arithFails < 6; w++){
        for (let h = 1; h <= 15 && arithFails < 6; h++){
          if (data.areaOf(w, h) !== areaRef(w, h)){
            arithFails++; fail(`areaOf(${w}, ${h}) = ${data.areaOf(w, h)}, independently ${areaRef(w, h)} — the area is not w x h`);
          }
          if (data.perimeterOf(w, h) !== perimeterRef(w, h)){
            arithFails++;
            fail(`perimeterOf(${w}, ${h}) = ${data.perimeterOf(w, h)}, independently ${perimeterRef(w, h)} — ` +
                 'the perimeter is not the four sides added up');
          }
        }
      }
      let sideFails = 0;
      for (let area = 1; area <= 150 && sideFails < 5; area++){
        for (let side = 1; side <= 15 && sideFails < 5; side++){
          const got = data.otherSide(area, side), want = otherSideRef(area, side);
          if (got !== want){
            sideFails++;
            fail(`otherSide(${area}, ${side}) = ${got}, independently ${want} — ` +
                 'the other side is the area divided by the known side, and it must refuse to answer when it does not divide');
          }
        }
      }
      [['cm', 'cm2'], ['m', 'm2']].forEach(pair => {
        if (data.areaUnitOf(pair[0]) !== pair[1])
          fail(`areaUnitOf('${pair[0]}') = ${data.areaUnitOf(pair[0])}, expected ${pair[1]} — ` +
               'the ruler you measure the sides with decides the area unit');
      });
      if (!Array.isArray(data.UNIT_ORDER) || data.UNIT_ORDER.join(',') !== 'cm2,m2')
        fail('UNIT_ORDER is not cm2,m2 (the table must run from the small unit to the big one)');

      /* ---------- 2. 版面常數 ---------- */
      const NUMS = ['FIG_W','FIG_H','CELL','GRID_X','GRID_Y_MIN','GRID_MAX_W','GRID_MAX_H','SIDE_FONT',
                    'TOP_LBL_DY','LEFT_LBL_DX','UF_W','UF_H','UF_SMALL','UF_BIG','UF_SMALL_X','UF_BIG_X',
                    'UF_TOP','UF_FONT','UF_LBL_DY'];
      NUMS.forEach(n => {
        const v = data[n];
        if (!(typeof v === 'number' && isFinite(v) && v > 0)) fail(`layout constant ${n} is not a positive number (${v})`);
      });

      /* ---------- 3. 格子圖：把函式跑起來數格子、量座標 ---------- */
      const CELL = data.CELL, GX = data.GRID_X;
      /* 格子上下居中，所以每一種高度的上緣都不一樣 —— 第二套實作重算一次。 */
      const topRef = h => Math.max(data.GRID_Y_MIN, Math.round((data.FIG_H - h * CELL) / 2));
      let topFails = 0;
      for (let h = 1; h <= data.GRID_MAX_H; h++){
        if (data.gridTop(h) !== topRef(h) && topFails++ < 3)
          fail(`gridTop(${h}) = ${data.gridTop(h)}, independently ${topRef(h)}`);
        const top = topRef(h);
        if (top < data.GRID_Y_MIN)
          fail(`a ${h}-row grid starts at y=${top}, leaving no room above it for the "length" label`);
        if (top + h * CELL > data.FIG_H)
          fail(`a ${h}-row grid reaches y=${top + h * CELL}, below the bottom of the ${data.FIG_H}px canvas`);
        /* 「上下居中，除非居中會擠掉上面的標籤」這件事就寫在 topRef 裡，
           而 gridTop 每一種高度都要和它一致（上面那一條）—— 貼齊上緣的寫法會被抓到。 */
      }
      let cellFails = 0;
      for (let w = 1; w <= data.GRID_MAX_W && cellFails < 6; w++){
        for (let h = 1; h <= data.GRID_MAX_H && cellFails < 6; h++){
          const cells = data.cellList(w, h);
          if (!Array.isArray(cells)){ cellFails++; fail(`cellList(${w}, ${h}) did not return an array`); continue; }
          /* 這一條就是「面積是鋪滿幾格」在畫面上的意思。 */
          if (cells.length !== areaRef(w, h)){
            cellFails++;
            fail(`cellList(${w}, ${h}) draws ${cells.length} squares, but the area is ${areaRef(w, h)} — ` +
                 'the picture and the number would disagree');
            continue;
          }
          /* 用索引迴圈：`delete cells[3]` 長度不變，forEach 卻會跳過那一格。 */
          const seen = {};
          let bad = false;
          for (let i = 0; i < cells.length; i++){
            if (!Object.prototype.hasOwnProperty.call(cells, i)){
              cellFails++; fail(`cellList(${w}, ${h})[${i}] is a hole in the array, so that square is missing`);
              bad = true; break;
            }
            const cl = cells[i];
            if (!(cl.r >= 0 && cl.r < h && cl.c >= 0 && cl.c < w)){
              cellFails++; fail(`cellList(${w}, ${h}) has a square at row ${cl.r}, column ${cl.c}, outside the ${w}x${h} rectangle`);
              bad = true; break;
            }
            const key = cl.r + ',' + cl.c;
            if (seen[key]){
              cellFails++; fail(`cellList(${w}, ${h}) draws two squares at row ${cl.r}, column ${cl.c}`);
              bad = true; break;
            }
            seen[key] = true;
            if (cl.size !== CELL){
              cellFails++; fail(`a square of cellList(${w}, ${h}) is ${cl.size} wide, the constants say ${CELL}`);
              bad = true; break;
            }
            if (cl.x !== GX + cl.c * CELL || cl.y !== topRef(h) + cl.r * CELL){
              cellFails++;
              fail(`the square at row ${cl.r}, column ${cl.c} of cellList(${w}, ${h}) is drawn at (${cl.x}, ${cl.y}), ` +
                   `expected (${GX + cl.c * CELL}, ${topRef(h) + cl.r * CELL})`);
              bad = true; break;
            }
            if (cl.x < 0 || cl.x + cl.size > data.FIG_W || cl.y < 0 || cl.y + cl.size > data.FIG_H){
              cellFails++;
              fail(`the square at row ${cl.r}, column ${cl.c} of cellList(${w}, ${h}) reaches ` +
                   `(${cl.x + cl.size}, ${cl.y + cl.size}), outside the ${data.FIG_W}x${data.FIG_H} canvas`);
              bad = true; break;
            }
          }
          if (bad) continue;
          if (Object.keys(seen).length !== areaRef(w, h)){
            cellFails++; fail(`cellList(${w}, ${h}) does not tile the rectangle exactly`);
            continue;
          }
          /* 外框：gridBox 要蓋住畫出來的格子，一格不差。 */
          const box = data.gridBox(w, h);
          if (box.x !== GX || box.y !== topRef(h) || box.w !== w * CELL || box.h !== h * CELL)
            fail(`gridBox(${w}, ${h}) is (${box.x}, ${box.y}, ${box.w}, ${box.h}), ` +
                 `expected (${GX}, ${topRef(h)}, ${w * CELL}, ${h * CELL})`);
        }
      }

      /* ---------- 4. 複合圖形：兩條路必須真的會合 ---------- */
      let compFails = 0;
      for (let w = 2; w <= data.GRID_MAX_W && compFails < 6; w++){
        for (let h = 2; h <= data.GRID_MAX_H && compFails < 6; h++){
          for (let nw = 1; nw < w && compFails < 6; nw++){
            for (let nh = 1; nh < h && compFails < 6; nh++){
              const want = areaRef(w, h) - areaRef(nw, nh);
              const cells = data.lCellList(w, h, nw, nh);
              if (!Array.isArray(cells)){ compFails++; fail(`lCellList(${w},${h},${nw},${nh}) did not return an array`); continue; }
              if (cells.length !== want){
                compFails++;
                fail(`lCellList(${w},${h},${nw},${nh}) draws ${cells.length} squares, but the area left is ${want}`);
                continue;
              }
              const set = {};
              cells.forEach(cl => { set[cl.r + ',' + cl.c] = true; });
              /* 挖掉的必須剛好是右上角那一塊。 */
              let holeWrong = 0;
              for (let r = 0; r < h; r++){
                for (let c = 0; c < w; c++){
                  const removed = (r < nh && c >= w - nw);
                  const present = !!set[r + ',' + c];
                  if (removed === present) holeWrong++;
                }
              }
              if (holeWrong){
                compFails++;
                fail(`lCellList(${w},${h},${nw},${nh}) removes the wrong squares (${holeWrong} of them are on the wrong side)`);
                continue;
              }
              /* 切成兩塊：互斥、覆蓋，而且面積相加等於相減。 */
              const parts = data.lParts(w, h, nw, nh);
              if (!Array.isArray(parts) || parts.length !== 2){
                compFails++; fail(`lParts(${w},${h},${nw},${nh}) did not return two rectangles`);
                continue;
              }
              let cut = 0, dup = 0, outside = 0, empty = 0;
              const covered = {};
              parts.forEach(p => {
                if (!(p.cw >= 1 && p.ch >= 1)){ empty++; return; }
                cut += areaRef(p.cw, p.ch);
                data.partCellList(p).forEach(cl => {
                  const key = cl.r + ',' + cl.c;
                  if (covered[key]) dup++;
                  covered[key] = true;
                  if (!set[key]) outside++;
                });
              });
              if (empty){
                compFails++; fail(`lParts(${w},${h},${nw},${nh}) returned an empty piece`);
                continue;
              }
              if (dup){
                compFails++;
                fail(`lParts(${w},${h},${nw},${nh}): the two pieces overlap on ${dup} squares, so adding them double-counts`);
                continue;
              }
              if (outside){
                compFails++;
                fail(`lParts(${w},${h},${nw},${nh}): ${outside} squares of the pieces fall outside the shape`);
                continue;
              }
              if (Object.keys(covered).length !== cells.length){
                compFails++;
                fail(`lParts(${w},${h},${nw},${nh}): the two pieces cover ${Object.keys(covered).length} of the shape's ${cells.length} squares`);
                continue;
              }
              if (cut !== want){
                compFails++;
                fail(`the two routes disagree at ${w}x${h} less ${nw}x${nh}: cutting gives ${cut}, subtracting gives ${want} — ` +
                     'the lesson promises they always agree');
              }
            }
          }
        }
      }

      /* ---------- 5. 邊長標籤與畫布的四個方向 ----------
         寬度用字典裡**真正會印出來的字串**估，不是估一個好看的數字。 */
      function textHalfWidth(str, font){ return String(str).length * font * 0.62 / 2; }
      const MAXW = data.GRID_MAX_W, MAXH = data.GRID_MAX_H;
      if (GX + MAXW * CELL > data.FIG_W)
        fail(`the widest grid (${MAXW} squares) reaches x=${GX + MAXW * CELL}, off the right edge of the ${data.FIG_W}px canvas`);
      if (topRef(MAXH) + MAXH * CELL > data.FIG_H)
        fail(`the tallest grid (${MAXH} squares) reaches y=${topRef(MAXH) + MAXH * CELL}, ` +
             `below the bottom of the ${data.FIG_H}px canvas`);
      let lblFails = 0;
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let w = 1; w <= MAXW && lblFails < 4; w++){
          for (let h = 1; h <= MAXH && lblFails < 4; h++){
            const lb = data.sideLabels(w, h);
            /* 最長的說法（公尺／metres 與最大的數字）才是真正的邊界情形。 */
            const topTxt = d.sideTop(w, data.UNIT_M), leftTxt = d.sideLeft(h, data.UNIT_M);
            [topTxt, leftTxt].forEach(t => { if (/undefined|NaN/.test(t)) fail(`side label ${L}: ${t}`); });
            if (!printsNum(topTxt, w) || !printsNum(leftTxt, h)){
              lblFails++; fail(`side label ${L} does not print the side lengths ${w} and ${h}`); continue;
            }
            if (lb.topY - data.SIDE_FONT < 0){
              lblFails++;
              fail(`the top side label sits at y=${lb.topY}, so its top reaches ${lb.topY - data.SIDE_FONT}, above the top of the canvas`);
              continue;
            }
            const topHalf = textHalfWidth(topTxt, data.SIDE_FONT);
            if (lb.topX - topHalf < 0 || lb.topX + topHalf > data.FIG_W){
              lblFails++; fail(`the top side label "${topTxt}" at x=${lb.topX} would run off the ${data.FIG_W}px canvas`); continue;
            }
            if (lb.leftX - textHalfWidth(leftTxt, data.SIDE_FONT) * 2 < 0){
              lblFails++; fail(`the left side label "${leftTxt}" ends at x=${lb.leftX}, so it would run off the left edge`); continue;
            }
            if (lb.leftY - data.SIDE_FONT < 0 || lb.leftY + data.SIDE_FONT > data.FIG_H){
              lblFails++;
              fail(`the left side label for a ${h}-square-tall grid sits at y=${lb.leftY}, outside the ${data.FIG_H}px canvas`);
              continue;
            }
            if (lb.topX !== GX + w * CELL / 2){
              lblFails++; fail(`the top side label is at x=${lb.topX}, not centred over the ${w}-square grid (${GX + w * CELL / 2})`);
            }
          }
        }
      });

      /* ---------- 6. 單位卡 ---------- */
      const boxes = data.unitFigBoxes();
      if (!Array.isArray(boxes) || boxes.length !== 2) fail('unitFigBoxes() did not return the two unit squares');
      else {
        const byUnit = {};
        boxes.forEach(b => { byUnit[b.unit] = b; });
        if (!byUnit.cm2 || !byUnit.m2) fail('unitFigBoxes() does not carry one square per area unit');
        else {
          if (byUnit.cm2.len !== data.UNIT_CM || byUnit.m2.len !== data.UNIT_M)
            fail('a unit card square is labelled with the wrong length unit');
          if (!(byUnit.cm2.size < byUnit.m2.size))
            fail(`the unit card draws 1 square centimetre (${byUnit.cm2.size}) no smaller than 1 square metre (${byUnit.m2.size})`);
          if (byUnit.cm2.y + byUnit.cm2.size !== byUnit.m2.y + byUnit.m2.size)
            fail('the two unit squares do not share their bottom edges, so the size comparison reads wrong');
        }
        boxes.forEach(b => {
          if (b.x < 0 || b.x + b.size > data.UF_W || b.y < 0 || b.y + b.size > data.UF_H)
            fail(`the ${b.unit} unit square reaches (${b.x + b.size}, ${b.y + b.size}), outside the ${data.UF_W}x${data.UF_H} unit card`);
          LANGS.forEach(L => {
            const d = I18N[L];
            const above = d.ufSide(b.len), below = d.ufArea(b.unit);
            [above, below].forEach(t => { if (/undefined|NaN/.test(t)) fail(`unit card text ${L}: ${t}`); });
            if (b.y - 6 - data.UF_FONT < 0)
              fail(`the unit card label "${above}" would be drawn above the top of the card`);
            if (b.y + b.size + data.UF_LBL_DY + data.UF_FONT > data.UF_H)
              fail(`the unit card label "${below}" would be drawn below the bottom of the card`);
            const half = textHalfWidth(below, data.UF_FONT);
            if (b.x + b.size / 2 - half < 0 || b.x + b.size / 2 + half > data.UF_W)
              fail(`the unit card label "${below}" would run off the ${data.UF_W}px card`);
          });
        });
      }

      /* ---------- 7. markup 的 viewBox 與 CSS 尺寸要跟著常數走 ---------- */
      const target = process.argv[2];
      if (!target){
        fail('cannot locate the lesson file (no target path in argv) — the canvas-size and sibling-page checks did not run');
      } else {
        let src = '';
        try { src = fs.readFileSync(target, 'utf8'); } catch (err){ src = ''; }
        src = src.replace(/<!--[\s\S]*?-->/g, ' ');
        ['s1fig', 's2fig', 's3fig', 's5fig'].forEach(id => {
          const m = new RegExp('id="' + id + '"[^>]*viewBox="0 0 (\\d+) (\\d+)"').exec(src);
          if (!m) fail(`cannot find the ${id} viewBox, so its canvas-size check did not run`);
          else if (Number(m[1]) !== data.FIG_W || Number(m[2]) !== data.FIG_H)
            fail(`the ${id} viewBox is ${m[1]}x${m[2]}, but the layout constants say ${data.FIG_W}x${data.FIG_H}`);
        });
        const um = /id="s4fig"[^>]*viewBox="0 0 (\d+) (\d+)"/.exec(src);
        if (!um) fail('cannot find the s4fig viewBox, so the unit-card size check did not run');
        else if (Number(um[1]) !== data.UF_W || Number(um[2]) !== data.UF_H)
          fail(`the s4fig viewBox is ${um[1]}x${um[2]}, but the unit-card constants say ${data.UF_W}x${data.UF_H}`);
        const fcss = /\.fig\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(src);
        if (!fcss) fail('cannot find the .fig CSS box, so the canvas-size check did not run');
        else {
          if (Number(fcss[1]) !== data.FIG_W) fail(`the .fig CSS max-width is ${fcss[1]}px, the constants say ${data.FIG_W}`);
          if (Number(fcss[2]) !== data.FIG_H) fail(`the .fig CSS height is ${fcss[2]}px, the constants say ${data.FIG_H}`);
        }
        const ucss = /\.unitfig\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(src);
        if (!ucss) fail('cannot find the .unitfig CSS box, so the unit-card size check did not run');
        else {
          if (Number(ucss[1]) !== data.UF_W) fail(`the .unitfig CSS max-width is ${ucss[1]}px, the constants say ${data.UF_W}`);
          if (Number(ucss[2]) !== data.UF_H) fail(`the .unitfig CSS height is ${ucss[2]}px, the constants say ${data.UF_H}`);
        }
      }

      /* ---------- 7b. review.html 的產生器清單 ----------
         simgen 只跑「還在的」產生器，所以刪掉一整支的話，它那一組不變條件、
         expectedCorrect 與 renderCheck 會一起靜靜消失（2026-08-27 codex 審查）。 */
      if (target){
        const rp = path.join(path.dirname(target), 'review.html');
        let rsrc = '';
        try { rsrc = fs.readFileSync(rp, 'utf8'); } catch (err){ rsrc = ''; }
        if (!rsrc) fail('cannot read review.html, so the generator inventory check did not run');
        else {
          /* 先把區塊註解拿掉，再要求 id 出現在**一行的開頭**（前面只有空白）——
             不然 `// { id:'gardenM2', …` 這種註解掉的產生器還是會被算成存在
             （2026-08-27 codex 第二輪）。 */
          const clean = rsrc.replace(/\/\*[\s\S]*?\*\//g, ' ');
          const found = (clean.match(/^\s*\{\s*id\s*:\s*['"][A-Za-z0-9_]+['"]\s*,/gm) || [])
            .map(m => /['"]([A-Za-z0-9_]+)['"]/.exec(m)[1]);
          GEN_IDS.forEach(id => {
            if (found.indexOf(id) < 0)
              fail(`review.html no longer declares the generator "${id}", so every check written for it stopped running`);
          });
          found.forEach(id => {
            if (GEN_IDS.indexOf(id) < 0)
              fail(`review.html declares an extra generator "${id}" that this config has no invariants for`);
          });
          if (found.length !== GEN_IDS.length)
            fail(`review.html declares ${found.length} generators, this config describes ${GEN_IDS.length}`);
        }
      }

      /* ---------- 7c. 上課頁自己要把範圍講給讀者聽 ----------
         只寫在原始碼的註解裡不算 —— 孩子看不到註解（2026-08-27 codex 審查）。 */
      LANGS.forEach(L => {
        const note = String(I18N[L].scopeNote || '');
        if (!note) return fail(`${L}.scopeNote is missing, so the lesson page never tells the reader its own scope`);
        const cues = (L === 'zh')
          ? ['平方公分', '平方公尺', '長方形', '正方形', '整數', '五年級']
          : ['cm²', 'm²', 'rectangles', 'squares', 'whole number', 'grade 5'];
        cues.forEach(c => {
          if (note.indexOf(c) < 0) fail(`${L}.scopeNote does not mention "${c}"`);
        });
      });

      /* ---------- 8. 每一組範例資料的筆數與內容 ---------- */
      const SIZES = { TILE_CASES:4, FORMULA_CASES:4, PERIM_SAME_CASES:4, AREA_SAME_CASES:3,
                      UNIT_CASES:6, COMPOSITE_CASES:3 };
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

      function inGrid(key, c){
        if (!(c.w >= 1 && c.w <= data.GRID_MAX_W)) fail(`${key} ${c.w}x${c.h}: the length is outside 1~${data.GRID_MAX_W}`);
        if (!(c.h >= 1 && c.h <= data.GRID_MAX_H)) fail(`${key} ${c.w}x${c.h}: the width is outside 1~${data.GRID_MAX_H}`);
      }

      /* --- 範例 1：鋪滿幾格 --- */
      let tileSquares = 0;
      const tileAreas = {};
      (data.TILE_CASES || []).forEach(c => {
        inGrid('TILE_CASES', c);
        if (c.w === c.h) tileSquares++;
        tileAreas[areaRef(c.w, c.h)] = (tileAreas[areaRef(c.w, c.h)] || 0) + 1;
        LANGS.forEach(L => {
          const d = I18N[L];
          const area = areaRef(c.w, c.h);
          const narr = d.s1narr(c.w, c.h, area);
          const res = d.s1result(d.areaText(area, 'cm2'));
          [narr, res].forEach(t => { if (/undefined|NaN/.test(t)) fail(`s1 text ${L} ${c.w}x${c.h}: ${t}`); });
          [c.w, c.h, area].forEach(v => {
            if (!printsNum(narr, v)) fail(`s1narr ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          if (!printsNum(res, area)) fail(`s1result ${L} ${c.w}x${c.h} does not print the area ${area}`);
          if (res.indexOf(UNIT_LABELS[L].cm2) < 0) fail(`s1result ${L} does not carry the area unit ${UNIT_LABELS[L].cm2}`);
        });
      });
      if (!tileSquares) fail('TILE_CASES has no square, so the lesson never shows that a square is a kind of rectangle');
      if (!Object.keys(tileAreas).some(k => tileAreas[k] >= 2))
        fail('TILE_CASES has no two rectangles with the same area but different shapes, which Example 3 builds on');

      /* --- 範例 2：兩個公式 --- */
      let fSquare = 0, fRect = 0;
      (data.FORMULA_CASES || []).forEach(c => {
        inGrid('FORMULA_CASES', c);
        if (c.w === c.h) fSquare++; else fRect++;
        const area = areaRef(c.w, c.h);
        const back = data.otherSide(area, c.w);
        if (back !== c.h) fail(`FORMULA_CASES ${c.w}x${c.h}: the reverse step gives ${back}, expected ${c.h}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const isSq = (c.w === c.h);
          const lines = [isSq ? d.s2areaSq(c.w, area) : d.s2area(c.w, c.h, area),
                         d.s2back(area, c.w, c.h),
                         isSq ? d.s2nameSq(c.w) : d.s2nameRect(c.w, c.h)];
          lines.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s2 text ${L} ${c.w}x${c.h}: ${t}`); });
          [c.w, area].forEach(v => {
            if (!printsNum(lines[0], v)) fail(`s2 area line ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          [area, c.w, c.h].forEach(v => {
            if (!printsNum(lines[1], v)) fail(`s2back ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          if (!printsNum(lines[2], c.w)) fail(`s2 name line ${L} ${c.w}x${c.h} does not print the side`);
        });
      });
      if (!fSquare) fail('FORMULA_CASES has no square, so "side x side" is never demonstrated');
      if (!fRect) fail('FORMULA_CASES has no non-square rectangle, so "length x width" is never demonstrated');

      /* --- 範例 3：周長與面積互相決定不了（兩句話各一組例子） --- */
      const perAreas = [];
      (data.PERIM_SAME_CASES || []).forEach(c => {
        inGrid('PERIM_SAME_CASES', c);
        if (perimeterRef(c.w, c.h) !== data.PERIM_SAME)
          fail(`PERIM_SAME_CASES ${c.w}x${c.h} has a perimeter of ${perimeterRef(c.w, c.h)}, but the group claims ${data.PERIM_SAME}`);
        perAreas.push(areaRef(c.w, c.h));
        LANGS.forEach(L => {
          const d = I18N[L];
          const per = perimeterRef(c.w, c.h), area = areaRef(c.w, c.h);
          const narr = d.s3narr(c.w, c.h, per, area);
          const res = d.s3result(per, d.areaText(area, 'cm2'));
          [narr, res].forEach(t => { if (/undefined|NaN/.test(t)) fail(`s3 text ${L} ${c.w}x${c.h}: ${t}`); });
          [c.w, c.h, per, area].forEach(v => {
            if (!printsNum(narr, v)) fail(`s3narr ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          if (!printsNum(res, per) || !printsNum(res, area))
            fail(`s3result ${L} ${c.w}x${c.h} does not print both the perimeter and the area`);
        });
      });
      if (new Set(perAreas).size !== perAreas.length)
        fail('PERIM_SAME_CASES has two rectangles with the same area, so "equal perimeters, different areas" is weaker than it claims');
      const areaPers = [];
      (data.AREA_SAME_CASES || []).forEach(c => {
        inGrid('AREA_SAME_CASES', c);
        if (areaRef(c.w, c.h) !== data.AREA_SAME)
          fail(`AREA_SAME_CASES ${c.w}x${c.h} has an area of ${areaRef(c.w, c.h)}, but the group claims ${data.AREA_SAME}`);
        areaPers.push(perimeterRef(c.w, c.h));
      });
      if (new Set(areaPers).size !== areaPers.length)
        fail('AREA_SAME_CASES has two rectangles with the same perimeter, so "equal areas, different perimeters" is not demonstrated');
      /* 課程與速查卡、家長頁都引用了這一組裡最大與最小的周長，所以它們要對得上。 */
      const perMin = Math.min.apply(null, areaPers), perMax = Math.max.apply(null, areaPers);
      LANGS.forEach(L => {
        const note = String(I18N[L].s3note);
        if (!printsNum(note, data.AREA_SAME)) fail(`${L}.s3note does not print the shared area ${data.AREA_SAME}`);
        if (!printsNum(note, perMin) || !printsNum(note, perMax))
          fail(`${L}.s3note claims a perimeter range that is not ${perMin}~${perMax}, the real range of AREA_SAME_CASES`);
        const lead = String(I18N[L].s3lead);
        if (!printsNum(lead, data.PERIM_SAME))
          fail(`${L}.s3lead does not print the shared perimeter ${data.PERIM_SAME} that PERIM_SAME_CASES actually has`);
      });

      /* --- 範例 4：挑單位 --- */
      let uCm = 0, uM = 0;
      const unitKeysSeen = {};
      (data.UNIT_CASES || []).forEach(c => {
        /* 每一個例子的單位與邊長都對照獨立的表 —— 只數「有沒有兩種單位都出現」的話，
           把地毯改成用公分量也不會有人發現（2026-08-27 codex 審查）。 */
        const want = UNIT_CASE_EXPECT[c.key];
        if (!want) fail(`UNIT_CASES has an object "${c.key}" that this config has no expectation for`);
        else {
          if (unitKeysSeen[c.key]) fail(`UNIT_CASES lists ${c.key} twice`);
          unitKeysSeen[c.key] = true;
          if (c.len !== want.len)
            fail(`UNIT_CASES ${c.key} reports its sides in ${c.len}, independently ${want.len}`);
          if (c.a !== want.a || c.b !== want.b)
            fail(`UNIT_CASES ${c.key} is ${c.a}x${c.b}, independently ${want.a}x${want.b}`);
        }
        if (c.len !== data.UNIT_CM && c.len !== data.UNIT_M) return fail(`UNIT_CASES ${c.key} has an unknown ruler "${c.len}"`);
        if (c.len === data.UNIT_CM) uCm++; else uM++;
        if (!(c.a >= 1 && c.b >= 1)) fail(`UNIT_CASES ${c.key} has a side below 1`);
        if (!Number.isInteger(c.a) || !Number.isInteger(c.b)) fail(`UNIT_CASES ${c.key} has a non-integer side`);
        const unit = data.areaUnitOf(c.len);
        if (unit !== areaUnitRef(c.len)) fail(`UNIT_CASES ${c.key}: the area unit is ${unit}, independently ${areaUnitRef(c.len)}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          if (typeof d.objectNames[c.key] !== 'string' || !d.objectNames[c.key])
            return fail(`${L}.objectNames has no name for ${c.key}`);
          if (d.objectNames[c.key] !== OBJECT_NAMES[L][c.key])
            fail(`${L}.objectNames.${c.key} is "${d.objectNames[c.key]}", the names table says "${OBJECT_NAMES[L][c.key]}"`);
          const area = areaRef(c.a, c.b);
          const narr = d.s4narr(d.objectNames[c.key], d.unitRuler[unit], d.unitName[unit],
                                d.lenText(c.a, c.len), d.lenText(c.b, c.len), d.areaText(area, unit));
          const res = d.s4result(d.objectNames[c.key], d.areaText(area, unit));
          [narr, res].forEach(t => { if (/undefined|NaN/.test(t)) fail(`s4 text ${L} ${c.key}: ${t}`); });
          [c.a, c.b, area].forEach(v => {
            if (!printsNum(narr, v)) fail(`s4narr ${L} ${c.key} does not print ${v}`);
          });
          if (narr.indexOf(UNIT_LABELS[L][c.len]) < 0)
            fail(`s4narr ${L} ${c.key} does not name the unit its sides are given in (${UNIT_LABELS[L][c.len]})`);
          if (narr.indexOf(UNIT_NAME[L][unit]) < 0) fail(`s4narr ${L} ${c.key} does not name the unit ${UNIT_NAME[L][unit]}`);
          if (!printsNum(res, area)) fail(`s4result ${L} ${c.key} does not print the area ${area}`);
        });
      });
      if (!uCm) fail('UNIT_CASES never gives its sides in centimetres, so square centimetres are never chosen');
      if (!uM) fail('UNIT_CASES never gives its sides in metres, so square metres are never chosen');
      Object.keys(UNIT_CASE_EXPECT).forEach(k => {
        if (!unitKeysSeen[k]) fail(`UNIT_CASES no longer shows ${k}, which this config expects`);
      });
      LANGS.forEach(L => {
        ['cm2', 'm2'].forEach(u => {
          if (I18N[L].unitName[u] !== UNIT_NAME[L][u])
            fail(`${L}.unitName.${u} is "${I18N[L].unitName[u]}", the unit table says "${UNIT_NAME[L][u]}"`);
          if (I18N[L].unitRuler[u] !== UNIT_RULER[L][u])
            fail(`${L}.unitRuler.${u} is "${I18N[L].unitRuler[u]}", the ruler table says "${UNIT_RULER[L][u]}"`);
          if (I18N[L].unitExample[u] !== UNIT_EXAMPLE[L][u])
            fail(`${L}.unitExample.${u} is "${I18N[L].unitExample[u]}", the example table says "${UNIT_EXAMPLE[L][u]}"`);
          if (I18N[L].ufArea(u).indexOf(UNIT_LABELS[L][u]) < 0)
            fail(`${L}.ufArea('${u}') does not carry the unit ${UNIT_LABELS[L][u]}`);
          if (I18N[L].areaText(7, u).indexOf(UNIT_LABELS[L][u]) < 0)
            fail(`${L}.areaText(7, '${u}') does not carry the area unit ${UNIT_LABELS[L][u]}`);
        });
        ['cm', 'm'].forEach(u => {
          if (I18N[L].lenText(7, u).indexOf(UNIT_LABELS[L][u]) < 0)
            fail(`${L}.lenText(7, '${u}') does not carry the length unit ${UNIT_LABELS[L][u]}`);
        });
        /* 兩個單位的說法不可以一樣。 */
        if (I18N[L].areaText(1, 'cm2') === I18N[L].areaText(1, 'm2'))
          fail(`${L}.areaText prints the same thing for square centimetres and square metres`);
        if (I18N[L].lenText(1, 'cm') === I18N[L].lenText(1, 'm'))
          fail(`${L}.lenText prints the same thing for centimetres and metres`);
        /* 規則少了「兩條邊要先用同一個單位」的話，2 公尺 × 30 公分 就沒有單位可以跟
           （2026-08-27 codex 第二輪）。上課頁的那一句也要被盯著。 */
        const sameUnit = (L === 'zh') ? '兩條邊要先用<strong>同一個單位</strong>說'
                                      : 'Both sides have to be given in <strong>the same unit</strong> first';
        if (String(I18N[L].s4lead).indexOf(sameUnit) < 0)
          fail(`${L}.s4lead no longer says the two sides must first be given in the same unit, ` +
               'so the rule does not cover a rectangle measured 2 m by 30 cm');
        /* 結語又把規則講了一次 —— 那一份也要帶著同樣的前提（codex 第三輪）。 */
        const footUnit = (L === 'zh') ? '同一個單位' : 'the same unit';
        if (String(I18N[L].footer).indexOf(footUnit) < 0)
          fail(`${L}.footer restates the unit rule without the same-unit prerequisite`);

      /* 1 平方公尺 ＝ 10000 平方公分 的推導：兩個數字都要在畫面上。 */
        const der = String(I18N[L].s4derive);
        if (!printsNum(der, CM_PER_M) || !printsNum(der, CM2_PER_M2))
          fail(`${L}.s4derive does not show ${CM_PER_M} x ${CM_PER_M} = ${CM2_PER_M2}`);
      });

      /* --- 範例 5：複合圖形 --- */
      (data.COMPOSITE_CASES || []).forEach(c => {
        inGrid('COMPOSITE_CASES', c);
        if (!(c.nw >= 1 && c.nw < c.w)) fail(`COMPOSITE_CASES ${c.w}x${c.h}: the hole is ${c.nw} wide, which is not inside 1~${c.w - 1}`);
        if (!(c.nh >= 1 && c.nh < c.h)) fail(`COMPOSITE_CASES ${c.w}x${c.h}: the hole is ${c.nh} tall, which is not inside 1~${c.h - 1}`);
        const big = areaRef(c.w, c.h), hole = areaRef(c.nw, c.nh);
        const parts = data.lParts(c.w, c.h, c.nw, c.nh);
        const cut = (parts || []).reduce((s, p) => s + areaRef(p.cw, p.ch), 0);
        if (cut !== big - hole)
          fail(`COMPOSITE_CASES ${c.w}x${c.h} less ${c.nw}x${c.nh}: cutting gives ${cut}, subtracting gives ${big - hole}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const ta = areaRef(parts[0].cw, parts[0].ch), ba = areaRef(parts[1].cw, parts[1].ch);
          const lines = [d.s5same(ta + ba),
                         d.s5cut(parts[0].cw, parts[0].ch, parts[1].cw, parts[1].ch, ta, ba, ta + ba),
                         d.s5fill(c.w, c.h, big, c.nw, c.nh, hole, big - hole),
                         d.s5chip(c.w, c.h, c.nw, c.nh)];
          lines.forEach(t => { if (/undefined|NaN/.test(t)) fail(`s5 text ${L} ${c.w}x${c.h}: ${t}`); });
          if (!printsNum(lines[0], ta + ba)) fail(`s5same ${L} does not print the total ${ta + ba}`);
          [ta, ba, ta + ba].forEach(v => {
            if (!printsNum(lines[1], v)) fail(`s5cut ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          [big, hole, big - hole].forEach(v => {
            if (!printsNum(lines[2], v)) fail(`s5fill ${L} ${c.w}x${c.h} does not print ${v}`);
          });
          [c.w, c.h, c.nw, c.nh].forEach(v => {
            if (!printsNum(lines[3], v)) fail(`s5chip ${L} ${c.w}x${c.h} does not print ${v}`);
          });
        });
      });

      /* --- 遊戲：鋪磚廠闖關（2026-10-04 改成五關五種玩法，§六之五） ---
         每一關用自己的算法（數格子、列舉兩條邊、看尺的單位、把格子分成兩堆看是不是長方形）重算答案，
         並**照遊戲自己的規則把每一題從頭玩一次**，證明一定解得完、而且解完一定是對的；
         頁面的純函式（tileRows／sideSlot／fenceW／fenceOk／unitBin／unitTray／cutLines／cutPick／cutResult／cutBoxes）
         拿整個題庫去呼叫、再和自己的幾何比；nearestOpen()、roundMiss()、shuffle() 從原始碼切出來真的跑；
         只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字、句子裡的算式逐條重算。
         拖拉、點選、兩根手指、capture 遺失、375px 的實際尺寸由 teaching-workspace/game-harness/g4-area 的端對端測試驗。 */
      {
        const D = data, LANGS = ['zh', 'en'], W = 300;
        let gsrc = '';
        try { gsrc = fs.readFileSync(process.argv[2], 'utf8'); } catch (err){ gsrc = ''; }
        if (!gsrc) fail('GAME: cannot read index.html, so the game checks did not run');
        const src = gsrc.replace(/<!--[\s\S]*?-->/g, ' ');
        const fin = v => typeof v === 'number' && isFinite(v);
        const nums = t => (String(t).match(/\d+/g) || []).map(Number);
        const seq = (where, text, want) => {
          text = typeof text === 'string' ? text.replace(/^(提示|Hint) 2[:：]\s*/, '') : text;
          if (typeof text !== 'string' || /undefined|NaN|null|\[object/.test(text)) return fail('GAME ' + where + ': text has undefined/NaN/null: ' + text);
          if (nums(text).join() !== want.join()) fail('GAME ' + where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
          const r = gameArith(text);
          r.problems.forEach(b => fail('GAME ' + where + ': ' + b + ' in: ' + text));
          return r.verified;
        };
        const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
        const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
        const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
        const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); };
        /* 手機：375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
        const scale = Math.min(1.5, 289 / W);
        const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
        let arithVerified = 0;

        /* --- 五關的順序、RENDER、題目與提示 --- */
        const TYPES = ['tile', 'side', 'fence', 'unit', 'cut'];
        const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
        if (order === undefined) fail('GAME: cannot find GAME_ORDER in index.html');
        else {
          const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
          if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 5), got ' + types.join());
        }
        const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
        const RB = {};
        TYPES.forEach(t => {
          RB[t] = body(t);
          if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
          LANGS.forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('GAME: gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('GAME: gHints.' + t + ' missing in ' + L);
          });
        });
        const need = (k, re, what) => { if (!re.test(RB[k] || '')) fail('GAME ' + k + ': ' + what); };
        ['GAME_TILE', 'GAME_SIDE', 'GAME_FENCE', 'GAME_UNIT', 'GAME_CUT'].forEach(k => {
          if (!Array.isArray(D[k]) || D[k].length < 2) fail('GAME: ' + k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
        });
        if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('GAME: ahead mode no longer shows hint level 1 automatically');
        if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('GAME: the hint button is not disabled after the second level');
        if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('GAME: startRound() does not start a new board generation (gGen++) — a piece held across a restart could solve the new round');
        if (!/if \(!e\.isPrimary\) return;/.test(src)) fail('GAME: a second finger can tap the board while the first finger is held elsewhere (only the first finger counts)');
        if (!/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/.test(src)) fail('GAME: a second finger can pick up a piece while the first finger is held elsewhere');
        if (!/if \(gen !== gGen\) return;/.test(src)) fail('GAME: a released piece does not check its board generation — a piece held across a restart could solve the new round');

        /* --- 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0（§三 中年級） --- */
        if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('GAME scoring: a round should give +20 with no mistakes and +10 after mistakes');
        {
          const fsrc = extractFunction(src, 'roundMiss');
          if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
          else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
            let r;
            try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
            catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
            if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
            if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
            if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
          });
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
          if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
          if (nums(d.gWin(85)).indexOf(85) < 0) fail('GAME gWin ' + L + ' does not show the score');
          if (typeof d.gClear !== 'string' || !d.gClear) fail('GAME gClear missing in ' + L);
        });

        /* --- 觸控 ≥ 44px（版面數字一律從 index.html 讀） --- */
        tooSmall('GPICK ' + D.GPICK, D.GPICK);
        tooSmall('a tile strip (' + D.TILE_U + ' tall)', D.TILE_U);
        tooSmall('a row to drop a strip on (' + D.TILE_U + ' tall)', D.TILE_U);
        tooSmall('a digit card (' + D.SIDE_KEYS.size + ')', D.SIDE_KEYS.size);
        tooSmall('the width box with its pad', D.SIDE.slot + 2 * D.SIDE.pad);
        tooSmall('a unit card (' + D.UNIT_CARD.h + ' tall)', D.UNIT_CARD.h);
        tooSmall('the gap between two grid lines to tap (' + D.CUT_U + ')', D.CUT_U);
        /* 格線不是拿得起來的東西：點的範圍是線的兩邊各 CUT.hit。⚠️ 刻意的例外（和三年級 numbers 的刻度一樣）：
           兩條線只隔一格，範圍不能大到蓋住整格 —— 點在格子中間（沒有瞄準任何一條線）要當成沒點到，不可以被判成切錯扣分。
           所以這裡要的是「至少 32（手機上約 31px）、而且格子中間留一塊空白」，不是 44。 */
        if (!(2 * D.CUT.hit >= 32)) fail('GAME cut: the tap band around a grid line is ' + 2 * D.CUT.hit + ' — under 32');
        if (!(D.CUT.hit < D.CUT_U / 2 - 2)) fail('GAME cut: a grid line\'s tap band (' + D.CUT.hit + ') reaches the middle of a cell, so a tap in a cell would cut');
        [D.SIDE_KEYS.size, D.UNIT_CARD.h].forEach(s => { if (s < D.GPICK) fail('GAME: a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
        need('fence', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:F\.x0 \+ w \* u, cy:F\.knobY,/, 'the ↔ knob is not GPICK × GPICK');
        need('tile', /addPiece\(B, \{ w:len \* U, h:U, cx:150, cy:TILE_TRAY\.y\[i\],/, 'the strips are not len × TILE_U, centred in the tray');
        need('side', /addPiece\(B, \{ w:SIDE_KEYS\.size, h:SIDE_KEYS\.size,/, 'the digit cards are not SIDE_KEYS.size square');
        need('unit', /addPiece\(B, \{ w:UNIT_CARD\.w, h:UNIT_CARD\.h,/, 'the unit cards are not UNIT_CARD sized');

        /* --- shuffle()：切出來真的跑，必須是排列、而且真的會換順序 --- */
        let shuffleFn = null;
        {
          const fsrc = extractFunction(src, 'shuffle');
          if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
          else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
          if (shuffleFn){
            const seen = new Set();
            for (let i = 0; i < 400; i++){
              const a = [1, 2, 3, 4], r = shuffleFn(a);
              if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
              seen.add(r.join());
            }
            if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
          }
        }

        /* --- nearestOpen()：從原始碼切出來真的跑 --- */
        let nearestOpen = null;
        {
          const fsrc = extractFunction(src, 'nearestOpen');
          if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
          else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
          if (nearestOpen){
            const two = [{ id:0, cx:100, cy:100, hw:60, hh:20 }, { id:1, cx:170, cy:100, hw:10, hh:10 }];
            const r0 = nearestOpen(two, { x:155, y:100 }, 6);
            if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
            const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:142, cy:100, hw:20, hh:20 }];
            if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
            if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
            const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20 }];
            if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
            if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
          }
        }
        /* 自己的「最近的方框」：到方框的距離最小；一樣近比到中心 —— 回傳**物件**，不是 id */
        const nearestBox = (list, p, pad) => {
          let best = null, bd = Infinity, bc = Infinity;
          for (const b of list){
            const dx = Math.abs(p.x - b.cx), dy = Math.abs(p.y - b.cy);
            if (dx > b.hw + pad || dy > b.hh + pad) continue;
            const dd = Math.hypot(Math.max(0, dx - b.hw), Math.max(0, dy - b.hh)), dc = Math.hypot(dx, dy);
            if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
          }
          return best;
        };

        /* ================= 第 1 關：鋪一排 ================= */
        {
          const U = D.TILE_U, T = D.TILE;
          need('tile', /var row = nearestOpen\(rows, pt, TILE\.pad\);/, 'a strip is not given to the nearest row');
          need('tile', /if \(len !== w\)\{ roundMiss\(len < w \? d\.gTileShort\(len, w\) : d\.gTileLong\(len, w\)\); return false; \}/, 'a strip of the wrong length is accepted (or explained the wrong way round)');
          need('tile', /if \(n === h\)\{/, 'the round does not end exactly when every row is laid');
          need('tile', /row\.done = true; row\.el\.className = 'growfill'; n\+\+;/, 'a laid row is not marked done, so one row laid h times would finish the round (codex round 1)');
          D.GAME_TILE.forEach((e, i) => {
            const where = 'tile[' + i + '] ' + e.w + '×' + e.h;
            if (!(Number.isInteger(e.w) && Number.isInteger(e.h) && e.w >= 2 && e.h >= 2)) return fail('GAME ' + where + ': sides must be whole numbers ≥ 2');
            if ((e.w + 1) * U > W) fail('GAME ' + where + ': the w + 1 strip (' + (e.w + 1) * U + 'px) does not fit the board');
            /* 排：自己算每一排的位置，和 tileRows() 比 */
            const rows = D.tileRows(e.w, e.h), x0 = D.tileX0(e.w);
            if (rows.length !== e.h) fail('GAME ' + where + ': tileRows gives ' + rows.length + ' rows');
            rows.forEach((r, k) => {
              const want = { cx:x0 + e.w * U / 2, cy:T.y + k * U + U / 2, hw:e.w * U / 2, hh:U / 2 };
              ['cx', 'cy', 'hw', 'hh'].forEach(f => { if (Math.abs(r[f] - want[f]) > 1e-9) fail('GAME ' + where + ' row ' + k + ': ' + f + ' is ' + r[f] + ', the drawn row says ' + want[f]); });
              if (r.done) fail('GAME ' + where + ': a row starts already laid');
            });
            inside({ x:x0, y:T.y, w:e.w * U, h:e.h * U }, where + ' rectangle', D.TILE_H);
            inside({ x:x0, y:T.lblY, w:e.w * U, h:T.lblH }, where + ' length label', D.TILE_H);
            if (T.lblY + T.lblH > T.y) fail('GAME ' + where + ': the length label runs into the rectangle');
            /* 托盤：三條，w − 1、w、w + 1，一定是同一組，在畫板裡、不互相碰、不碰長方形（含 pad） */
            for (let rep = 0; rep < 30; rep++){
              const tray = D.tileTray(e.w);
              if (tray.slice().sort((a, b) => a - b).join() !== [e.w - 1, e.w, e.w + 1].join()){ fail('GAME ' + where + ': the tray is ' + tray.join(',') + ', not w − 1, w, w + 1'); break; }
            }
            if (D.TILE_TRAY.y.length !== 3) fail('GAME tile: TILE_TRAY.y should hold three rows for three strips');
            const boxes = [e.w - 1, e.w, e.w + 1].map((len, k) => sq(150, D.TILE_TRAY.y[k], len * U, U));
            boxes.forEach((b, k) => {
              inside(b, where + ' tray strip ' + k, D.TILE_H);
              if (hit(b, { x:x0 - T.pad, y:T.y - T.pad, w:e.w * U + 2 * T.pad, h:e.h * U + 2 * T.pad })) fail('GAME ' + where + ': a tray strip sits inside the rows\' drop zone, so picking it up and letting go would lay it');
            });
            noHits(boxes.map(b => ({ x:b.x, y:b.y - 4, w:b.w, h:b.h + 8 })), where + ' tray strips (with 4px between)');
            /* nearestOpen() 在每一排：排裡的每一點（每 2px）都判給那一排；兩排之間的重疊帶判給比較近的 */
            if (nearestOpen){
              const list = rows.map((r, k) => Object.assign({ id:k }, r));
              let bad = 0;
              for (let y = T.y - T.pad + 0.5; y < T.y + e.h * U + T.pad; y += 1){
                for (let x = x0 - T.pad + 0.5; x < x0 + e.w * U + T.pad; x += 3){
                  const g = nearestOpen(list, { x, y }, T.pad), o = nearestBox(list, { x, y }, T.pad);
                  if ((g && g.id) !== (o && o.id)) bad++;
                }
              }
              if (bad) fail('GAME ' + where + ': nearestOpen() disagrees with the nearest row at ' + bad + ' points');
            }
            /* 照規則玩一遍：只有 w 格的那一條放得進去；放滿 h 排剛好是 w × h 格 */
            let laid = 0, cells = 0;
            rows.forEach(() => { [e.w - 1, e.w, e.w + 1].forEach(len => { if (len === e.w){ laid++; cells += len; } }); });
            if (laid !== e.h || cells !== areaRef(e.w, e.h)) fail('GAME ' + where + ': playing by the rules lays ' + cells + ' squares, not ' + areaRef(e.w, e.h));
            LANGS.forEach(L => {
              const d = I18N[L];
              const top = d.sideTop(e.w, D.UNIT_CM);
              if (nums(top).join() !== String(e.w)) fail('GAME ' + where + ' ' + L + ': the length label "' + top + '" does not read ' + e.w);
              arithVerified += seq(where + ' gTileDone ' + L, d.gTileDone(e.w, e.h, areaRef(e.w, e.h)), [e.w, e.h, e.w, e.h, areaRef(e.w, e.h), areaRef(e.w, e.h)]);
              seq(where + ' gTileShort ' + L, d.gTileShort(e.w - 1, e.w), L === 'zh' ? [e.w - 1, e.w, 1] : [e.w - 1, e.w, 1]);
              seq(where + ' gTileLong ' + L, d.gTileLong(e.w + 1, e.w), L === 'zh' ? [e.w + 1, e.w, 1] : [e.w + 1, 1, e.w]);
              for (let n = 0; n <= e.h; n++){
                seq(where + ' gTileNow ' + L, d.gTileNow(n, e.w), n ? [n, e.w] : [e.w]);
                if (n < e.h) seq(where + ' gTile2 ' + L, d.gTile2(e.w, e.h, n), [e.w, n, e.h - n]);
                if (n >= 1) seq(where + ' gTileRow ' + L, d.gTileRow(n, e.w), [n, e.w]);
              }
              if (d.unitName && UNIT_LABELS[L] && d.gTileDone(e.w, e.h, 1).indexOf(UNIT_LABELS[L].cm2) < 0) fail('GAME ' + where + ' ' + L + ': the finishing line does not give the area in ' + UNIT_LABELS[L].cm2);
            });
          });
        }

        /* ================= 第 2 關：找寬 ================= */
        {
          const U = D.SIDE_U, S = D.SIDE, K = D.SIDE_KEYS;
          need('side', /if \(!nearestOpen\(\[S\], pt, SIDE\.pad\)\) return false;/, 'a digit card is not dropped by the width box\'s own drop zone');
          need('side', /if \(v !== h\)\{ roundMiss\(p < e\.A \? d\.gSideSmall\(w, v, p, e\.A\) : d\.gSideBig\(w, v, p, e\.A\)\); return false; \}/, 'a wrong width is accepted (or called too small/too big the wrong way round)');
          need('side', /var e = pick\(GAME_SIDE\), w = e\.w, h = otherSide\(e\.A, e\.w\)/, 'the width is not area ÷ length');
          const keys = [];
          for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * K.step, K.y + Math.floor(v / 5) * K.rowStep, K.size, K.size));
          keys.forEach((k, v) => inside(k, 'side digit card ' + v, D.SIDE_H));
          noHits(keys, 'side digit cards');
          D.GAME_SIDE.forEach((e, i) => {
            const where = 'side[' + i + '] ' + e.A + '÷' + e.w;
            const h = otherSideRef(e.A, e.w);
            if (h === null) return fail('GAME ' + where + ': the area is not a whole number of rows of ' + e.w);
            if (D.otherSide(e.A, e.w) !== h) fail('GAME ' + where + ': otherSide says ' + D.otherSide(e.A, e.w) + ', independently ' + h);
            if (!(h >= 1 && h <= 9)) fail('GAME ' + where + ': the width ' + h + ' is not one digit card');
            if (h > e.w) fail('GAME ' + where + ': the width ' + h + ' is longer than the length ' + e.w + ' — the drawing would call the longer side 寬');
            if (h === e.w) fail('GAME ' + where + ': a square — the "length" and "width" labels would both be the same side');
            /* 畫面：長方形照比例、在畫板裡；寬的框在長方形左邊、和它的高置中；面積標籤在下面、不碰數字卡 */
            const rect = { x:S.x0, y:S.y0, w:e.w * U, h:h * U };
            inside(rect, where + ' rectangle', D.SIDE_H);
            inside({ x:S.x0, y:S.lblY, w:e.w * U, h:S.lblH }, where + ' length label', D.SIDE_H);
            if (S.lblY + S.lblH > S.y0) fail('GAME ' + where + ': the length label runs into the rectangle');
            const area = { x:S.x0, y:S.y0 + h * U + S.areaGap, w:e.w * U, h:24 };
            inside(area, where + ' area label', D.SIDE_H);
            if (keys.some(k => hit(k, area))) fail('GAME ' + where + ': the area label runs into the digit cards');
            const slot = D.sideSlot(e);
            if (slot.cx !== S.slotX || Math.abs(slot.cy - (S.y0 + h * U / 2)) > 1e-9) fail('GAME ' + where + ': the width box is not centred on the rectangle\'s height');
            const sb = sq(slot.cx, slot.cy, slot.hw * 2, slot.hh * 2);
            inside(sb, where + ' width box', D.SIDE_H);
            if (sb.x + sb.w + S.pad > S.x0) fail('GAME ' + where + ': the width box\'s drop zone reaches the rectangle');
            inside({ x:0, y:slot.cy - slot.hh - 22, w:S.x0 - 2, h:20 }, where + ' "width" label', D.SIDE_H);
            inside({ x:0, y:slot.cy + slot.hh + 2, w:S.x0 - 2, h:20 }, where + ' unit label under the box', D.SIDE_H);
            if (keys.some(k => hit(k, { x:sb.x - S.pad, y:sb.y - S.pad, w:sb.w + 2 * S.pad, h:sb.h + 2 * S.pad }))) fail('GAME ' + where + ': a digit card sits inside the width box\'s drop zone');
            /* 照規則玩一遍：每一張卡 v，只有 v × 長 ＝ 面積 的那一張收；說「少」「多」要真的少、多 */
            let okCount = 0;
            for (let v = 0; v <= 9; v++){
              if (v * e.w === e.A){ okCount++; continue; }
              LANGS.forEach(L => {
                const d = I18N[L], p = areaRef(e.w, v);
                const t = p < e.A ? d.gSideSmall(e.w, v, p, e.A) : d.gSideBig(e.w, v, p, e.A);
                arithVerified += seq(where + ' wrong card ' + v + ' ' + L, t, [v, e.w, v, p, e.A]);
                const saysLess = L === 'zh' ? /少/.test(t) : /less than/.test(t), saysMore = L === 'zh' ? /多/.test(t) : /more than/.test(t);
                if (p < e.A ? !(saysLess && !saysMore) : !(saysMore && !saysLess)) fail('GAME ' + where + ' ' + L + ': card ' + v + ' gives ' + p + ' vs ' + e.A + ' but the reason says otherwise: ' + t);
              });
            }
            if (okCount !== 1) fail('GAME ' + where + ': ' + okCount + ' digit cards give the area — exactly one should');
            LANGS.forEach(L => {
              const d = I18N[L];
              arithVerified += seq(where + ' gSideDone ' + L, d.gSideDone(e.A, e.w, h), [e.A, e.w, h, h, e.w, h, e.A]);
              arithVerified += seq(where + ' gSideLine ' + L, d.gSideLine(e.w, h, e.A), [e.w, h, e.A]);
              seq(where + ' gSideNow ' + L, d.gSideNow(e.w, e.A), [e.w, e.A]);
              seq(where + ' gSide2 ' + L, d.gSide2(e.A, e.w), [e.w, e.A, e.A, e.w]);
              seq(where + ' gSideArea ' + L, d.gSideArea(e.A), [e.A]);
            });
          });
        }

        /* ================= 第 3 關：拉籬笆 ================= */
        {
          const F = D.FENCE;
          need('fence', /var e = pick\(GAME_FENCE\), S = e\.P \/ 2, u = fenceU\(S\), F = FENCE, w = S - 1;/, 'the fence does not start at the long thin shape');
          need('fence', /if \(knob\.busy\(\)\) return;/, 'the button judges while ↔ is still held');
          need('fence', /if \(!fenceOk\(e, w\)\)\{ roundMiss\(d\.gFenceNo\(w, h, w \* h, e\.A\)\); return; \}/, 'a shape with the wrong area is accepted');
          need('fence', /axis:'x', minX:F\.x0 \+ u, maxX:F\.x0 \+ \(S - 1\) \* u,/, '↔ is not limited to 1 … S − 1 columns');
          need('fence', /onPlace:function\(P\)\{ var nw = fenceW\(S, P\.cx\); if \(nw !== w && !gSolved\)\{ w = nw; draw\(\); \} \}/, 'the drawn shape does not follow ↔');
          D.GAME_FENCE.forEach((e, i) => {
            const where = 'fence[' + i + '] P' + e.P + ' A' + e.A;
            if (!(Number.isInteger(e.P) && e.P % 2 === 0 && e.P >= 8)) return fail('GAME ' + where + ': the fence must be an even whole number ≥ 8');
            const S = e.P / 2, sols = [];
            for (let w = 1; w <= S - 1; w++){
              const h = S - w;
              if (perimeterRef(w, h) !== e.P) fail('GAME ' + where + ': ' + w + ' × ' + h + ' does not have perimeter ' + e.P);
              const ok = areaRef(w, h) === e.A;
              if (ok) sols.push(w);
              if (D.fenceOk(e, w) !== ok) fail('GAME ' + where + ': fenceOk(' + w + ') says ' + D.fenceOk(e, w) + ', independently ' + ok);
            }
            [0, S, -1, S + 1].forEach(w => { if (D.fenceOk(e, w)) fail('GAME ' + where + ': fenceOk accepts ' + w + ' columns, which is not a rectangle of this fence'); });
            if (!sols.length) fail('GAME ' + where + ': no rectangle of this fence has area ' + e.A + ' — unsolvable');
            if (sols.indexOf(S - 1) >= 0) fail('GAME ' + where + ': the starting shape already has the target area');
            if (e.A === e.P) fail('GAME ' + where + ': the target area equals the fence length — perimeter reasoning lands on it');
            const u = D.fenceU(S);
            if (!(u >= 1 && (S - 1) * u <= F.span)) fail('GAME ' + where + ': ' + (S - 1) + ' columns of ' + u + 'px do not fit the span ' + F.span);
            /* 每一種形狀都畫得下：長方形、上面與左邊的邊長標籤、目標標籤、↔ 與軌道 */
            for (let w = 1; w <= S - 1; w++){
              const h = S - w, yt = F.yb - h * u;
              const r = { x:F.x0, y:yt, w:w * u, h:h * u };
              inside(r, where + ' shape ' + w + '×' + h, D.FENCE_H);
              const top = { x:F.x0 + w * u / 2 - 40, y:yt - F.lblH - 2, w:80, h:F.lblH };
              inside(top, where + ' top label for ' + w + '×' + h, D.FENCE_H);
              if (top.y < F.goalY + F.goalH) fail('GAME ' + where + ': the top label of ' + w + '×' + h + ' runs into the target label');
              const left = { x:0, y:yt + h * u / 2 - F.lblH / 2, w:F.lblW, h:F.lblH };
              inside(left, where + ' left label', D.FENCE_H);
              if (left.x + left.w > F.x0) fail('GAME ' + where + ': the left label runs into the shape');
              LANGS.forEach(L => {
                const t = I18N[L].lenText(Math.max(w, h), D.UNIT_CM), est = String(t).length * 9.5;
                if (est > F.lblW) fail('GAME ' + where + ' ' + L + ': "' + t + '" (~' + est + 'px) is wider than the left label ' + F.lblW);
              });
              const knob = sq(F.x0 + w * u, F.knobY, D.GPICK, D.GPICK);
              inside(knob, where + ' ↔ at ' + w, D.FENCE_H);
              if (knob.y < F.yb) fail('GAME ' + where + ': ↔ overlaps the shape\'s bottom edge');
            }
            /* fenceW()：拖到 x 時是幾格寬 —— 和自己的「最近的角」比，每 0.5px */
            let bad = 0;
            for (let x = F.x0 - 30; x <= F.x0 + S * u + 30; x += 0.5){
              let bj = 1, bd = Infinity;
              for (let j = 1; j <= S - 1; j++){ const dd = Math.abs(F.x0 + j * u - x); if (dd < bd - 1e-9){ bd = dd; bj = j; } }
              const got = D.fenceW(S, x);
              if (got !== bj && Math.abs(Math.abs(F.x0 + got * u - x) - bd) > 1e-9) bad++;
            }
            if (bad) fail('GAME ' + where + ': fenceW() picks a corner that is not the nearest at ' + bad + ' points');
            LANGS.forEach(L => {
              const d = I18N[L];
              for (let w = 1; w <= S - 1; w++){
                const h = S - w;
                seq(where + ' gFenceNow ' + L, d.gFenceNow(e.P, w, h), [e.P, w, h]);
                if (sols.indexOf(w) < 0) arithVerified += seq(where + ' gFenceNo ' + w + ' ' + L, d.gFenceNo(w, h, areaRef(w, h), e.A), [w, h, areaRef(w, h), e.A]);
                else arithVerified += seq(where + ' gFenceDone ' + L, d.gFenceDone(w, h, e.A, e.P), [w, h, e.A, e.P]);
              }
              seq(where + ' gFence2 ' + L, d.gFence2(S, e.A), [S, S, e.A]);
              seq(where + ' gFenceGoal ' + L, d.gFenceGoal(e.A), [e.A]);
            });
          });
        }

        /* ================= 第 4 關：貼單位 ================= */
        {
          const BN = D.UNIT_BIN, C = D.UNIT_CARD, T = D.UNIT_TRAY;
          /* 卡片的字級：這裡自己定一份，再對頁面的 CSS 驗 */
          const CARD_FONT = 13;
          if (src.indexOf('.gcard{background:var(--card);border:3px solid var(--orange);border-radius:12px;font-size:' + CARD_FONT + 'px;') < 0) fail('GAME unit: the .gcard font size is not ' + CARD_FONT + 'px, so the card-width estimate is off');
          need('unit', /var bin = nearestOpen\(bins, pt, 8\);/, 'a card is not given to the nearest basket');
          need('unit', /if \(bin\.i !== want\)\{ roundMiss\(d\.gUnitWrong\(/, 'a card in the wrong basket is accepted');
          need('unit', /var c = P\.data, want = unitBin\(c\), u = UNIT_ORDER\[want\];/, 'the basket is not decided by unitBin()');
          need('unit', /unitTray\(set\)\.map\(function\(c, i\)\{/, 'the tray is not laid out by unitTray()');
          if (D.UNIT_ORDER.join() !== 'cm2,m2') fail('GAME unit: the baskets assume UNIT_ORDER cm2, m2');
          const bins = [0, 1].map(i => ({ id:i, cx:BN.x[i] + BN.w / 2, cy:BN.y + BN.h / 2, hw:BN.w / 2, hh:BN.h / 2 }));
          bins.forEach((b, i) => inside(sq(b.cx, b.cy, BN.w, BN.h), 'unit basket ' + i, D.UNIT_H));
          if (BN.x[0] + BN.w > BN.x[1]) fail('GAME unit: the two baskets overlap');
          const tray = [0, 1, 2, 3].map(i => sq(150 + (i % 2 ? 1 : -1) * T.step / 2, T.y + Math.floor(i / 2) * T.rowStep, C.w, C.h));
          tray.forEach((b, i) => {
            inside(b, 'unit tray card ' + i, D.UNIT_H);
            if (b.y < BN.y + BN.h + 8) fail('GAME unit: tray card ' + i + ' sits inside a basket\'s drop zone');
          });
          noHits(tray, 'unit tray cards');
          /* 籃子裡最多兩張：兩個位置都在籃子裡、在標籤下面、不互相碰 */
          const placed = [0, 1].map(n => sq(0, BN.y + BN.first + n * BN.step, C.w, C.h));
          if (placed[0].y < BN.y + BN.lbl) fail('GAME unit: the first placed card covers the basket label');
          if (placed[1].y + placed[1].h > BN.y + BN.h) fail('GAME unit: the second placed card hangs out of the basket');
          if (placed[0].y + placed[0].h > placed[1].y) fail('GAME unit: two placed cards overlap');
          if (C.w > BN.w) fail('GAME unit: a card is wider than a basket');
          if (nearestOpen){
            let bad = 0;
            for (let x = BN.x[0] - 8 + 0.5; x < BN.x[1] + BN.w + 8; x += 0.5){
              const p = { x, y:BN.y + BN.h / 2 }, g = nearestOpen(bins, p, 8), o = nearestBox(bins, p, 8);
              if ((g && g.id) !== (o && o.id)) bad++;
            }
            if (bad) fail('GAME unit: nearestOpen() disagrees with the nearest basket at ' + bad + ' points across the two baskets');
          }
          D.GAME_UNIT.forEach((set, si) => {
            const where = 'unit[' + si + ']';
            if (!Array.isArray(set) || set.length !== 4) return fail('GAME ' + where + ': a set should have 4 cards');
            const want = set.map(c => D.UNIT_ORDER.indexOf(areaUnitRef(c.len)));
            set.forEach((c, k) => { if (D.unitBin(c) !== want[k]) fail('GAME ' + where + ' card ' + k + ': unitBin says ' + D.unitBin(c) + ', the ruler says ' + want[k]); });
            if (want.filter(x => x === 0).length !== 2) fail('GAME ' + where + ': not two cards per basket (' + want.join(',') + ') — a basket holds two');
            if (!set.some(c => c.len === 'cm' && Math.max(c.a, c.b) >= 100)) fail('GAME ' + where + ': no big thing measured in cm — the set never tests "the unit follows the ruler, not the size"');
            set.forEach((c, k) => {
              if (!(Number.isInteger(c.a) && Number.isInteger(c.b) && c.a > 0 && c.b > 0)) fail('GAME ' + where + ' card ' + k + ': sides must be positive whole numbers');
              if (!D.UNIT_ICON[c.key]) fail('GAME ' + where + ': no icon for ' + c.key);
              /* 量出來的數字要是那個東西真實的大小（換成公分比，容許 ±25%／±40%）—— 不然「單位跟著尺走」的例子本身就是假的 */
              const real = GAME_REAL_CM[c.key];
              if (!real) fail('GAME ' + where + ': this config has no real-life size for ' + c.key);
              else {
                const cm = c.len === 'm' ? [c.a * CM_PER_M, c.b * CM_PER_M] : [c.a, c.b];
                if (Math.abs(cm[0] - real[0]) > real[0] * 0.25 || Math.abs(cm[1] - real[1]) > real[1] * 0.4) fail('GAME ' + where + ': ' + c.key + ' measured ' + c.a + ' × ' + c.b + ' ' + c.len + ' is not its real-life size ' + real.join(' × ') + ' cm');
              }
              LANGS.forEach(L => {
                const d = I18N[L], name = d.gObj && d.gObj[c.key];
                if (!name) return fail('GAME ' + where + ': gObj.' + c.key + ' missing in ' + L);
                if (d.objectNames[c.key] && (L === 'zh' ? d.objectNames[c.key] !== name : d.objectNames[c.key].split(' ').indexOf(name.split(' ')[0]) < 0)) fail('GAME ' + where + ' ' + L + ': gObj.' + c.key + ' "' + name + '" is not the lesson\'s name "' + d.objectNames[c.key] + '"');
                const sides = d.lenText(c.a, c.len) + ' × ' + d.lenText(c.b, c.len), u = D.UNIT_ORDER[want[k]];
                if (nums(sides).join() !== [c.a, c.b].join() || sides.indexOf(UNIT_LABELS[L][c.len]) < 0) fail('GAME ' + where + ' ' + L + ': the card reads "' + sides + '"');
                /* 卡片上的字放得下（中文字 14px 寬、其他字 0.62 字寬，故意高估） */
                [D.UNIT_ICON[c.key] + ' ' + name, sides].forEach(t => {
                  let em = 0;
                  for (const ch of t) em += /[　-鿿＀-￯]/.test(ch) ? 1 : /[\u{1F000}-\u{1FFFF}☀-➿]/u.test(ch) ? 1.2 : ch === ' ' ? 0.3 : /[0-9×]/.test(ch) ? 0.6 : 0.62;
                  if (em * CARD_FONT > C.w - 8) fail('GAME ' + where + ' ' + L + ': "' + t + '" (~' + Math.round(em * CARD_FONT) + 'px) does not fit a ' + C.w + 'px card');
                });
                const wrong = d.gUnitWrong(name, sides, d.unitRuler[u], d.unitName[u]);
                seq(where + ' gUnitWrong ' + c.key + ' ' + L, wrong, [c.a, c.b]);
                /* 尺的名字要在「邊長」與「面積單位」之外另外說一次（公分 也藏在 300 公分、平方公分 裡） */
                const rest = wrong.split(sides).join(' ').split(UNIT_NAME[L][u]).join(' ');
                if (rest.indexOf(UNIT_RULER[L][u]) < 0 || wrong.indexOf(UNIT_NAME[L][u]) < 0) fail('GAME ' + where + ' ' + L + ': the reason for ' + c.key + ' does not name the ruler "' + UNIT_RULER[L][u] + '" and the unit "' + UNIT_NAME[L][u] + '"');
                const okT = d.gUnitOk(name, d.unitRuler[u], d.unitName[u]);
                if (okT.indexOf(UNIT_NAME[L][u]) < 0) fail('GAME ' + where + ' ' + L + ': gUnitOk does not name ' + UNIT_NAME[L][u]);
                const h2 = d.gUnit2(name, d.unitRuler[u], d.gBin[u]);
                if (h2.indexOf(d.gBin[u]) < 0 || h2.indexOf(UNIT_RULER[L][u]) < 0) fail('GAME ' + where + ' ' + L + ': hint 2 for ' + c.key + ' does not name the basket and the ruler');
              });
            });
            /* 托盤：每一種洗法都要是這一組的排列；不可以是答案的排法 */
            {
              let under = 0, first = 0;
              for (let rep = 0; rep < 600; rep++){
                const t = D.unitTray(set);
                if (t.length !== 4 || t.some(c => set.indexOf(c) < 0) || new Set(t).size !== 4){ fail('GAME ' + where + ': unitTray() is not a permutation of the set'); break; }
                const b = t.map(c => D.UNIT_ORDER.indexOf(areaUnitRef(c.len)));
                if (b.every((x, i) => x === i % 2)) under++;
                if (b.every((x, i) => i === 0 || b[i - 1] <= x)) first++;
              }
              if (under) fail('GAME ' + where + ': the tray started with every card under its own basket ' + under + ' times in 600');
              if (first) fail('GAME ' + where + ': the tray started with the cm² cards first ' + first + ' times in 600');
            }
          });
          LANGS.forEach(L => {
            const d = I18N[L];
            ['cm2', 'm2'].forEach(u => {
              if (!(d.gBin && d.gBin[u])) return fail('GAME unit: gBin.' + u + ' missing in ' + L);
              if (d.gBin[u].indexOf(UNIT_LABELS[L][u]) < 0) fail('GAME unit ' + L + ': the basket label "' + d.gBin[u] + '" is not ' + UNIT_LABELS[L][u]);
              if (String(d.gBin[u]).length * 16 * (L === 'zh' ? 1 : 0.62) > BN.w - 8) fail('GAME unit ' + L + ': the basket label "' + d.gBin[u] + '" is wider than the basket');
            });
            seq('unit gUnitNow ' + L, d.gUnitNow(3, 4), [3, 4]);
          });
        }

        /* ================= 第 5 關：切一刀 ================= */
        {
          const U = D.CUT_U, C = D.CUT;
          need('cut', /var L = cutPick\(e, pt\);\s*\n\s*if \(!L\) return;/, 'a tap is not resolved by cutPick()');
          need('cut', /if \(!r\.ok\)\{ roundMiss\(d\.gCutBad\(r\.rect\.w, r\.rect\.h\)\); return; \}/, 'a cut that leaves a non-rectangle is accepted');
          if (!/if \(B\.onBoardTap && !gSolved\) B\.onBoardTap\(pt\);/.test(src)) fail('GAME cut: a tap on the board is not passed to the round (or still works after the round is solved)');
          /* 自己的線段距離（軸對齊的線段） */
          const dSeg = (L, p) => L.dir === 'h'
            ? Math.hypot(p.x < L.x1 ? L.x1 - p.x : (p.x > L.x2 ? p.x - L.x2 : 0), p.y - L.y1)
            : Math.hypot(p.x - L.x1, p.y < L.y1 ? L.y1 - p.y : (p.y > L.y2 ? p.y - L.y2 : 0));
          D.GAME_CUT.forEach((e, i) => {
            const where = 'cut[' + i + '] ' + e.w + '×' + e.h + '−' + e.nw + '×' + e.nh;
            if (!(e.nw >= 1 && e.nw < e.w && e.nh >= 1 && e.nh < e.h)) return fail('GAME ' + where + ': the missing corner is not strictly inside');
            const x0 = D.cutX0(e.w), y0 = C.y0;
            if (Math.abs(x0 - (W - e.w * U) / 2) > 1e-9) fail('GAME ' + where + ': the shape is not centred');
            inside({ x:x0, y:y0, w:e.w * U, h:e.h * U }, where + ' shape', D.CUT_H);
            /* 自己的格子：L 形每一格 */
            const cells = [];
            for (let r = 0; r < e.h; r++) for (let c = 0; c < e.w; c++) if (!(r < e.nh && c >= e.w - e.nw)) cells.push([r, c]);
            if (cells.length !== areaRef(e.w, e.h) - areaRef(e.nw, e.nh)) fail('GAME ' + where + ': cell count is off');
            const isRect = cs => {
              if (!cs.length) return null;
              const rs = cs.map(x => x[0]), csx = cs.map(x => x[1]);
              const r0 = Math.min(...rs), r1 = Math.max(...rs), c0 = Math.min(...csx), c1 = Math.max(...csx);
              return (r1 - r0 + 1) * (c1 - c0 + 1) === cs.length ? { w:c1 - c0 + 1, h:r1 - r0 + 1 } : null;
            };
            /* 每一條切得下去的格線：自己列出來，和 cutLines() 比 */
            const own = [];
            for (let r = 1; r < e.h; r++) own.push('h' + r);
            for (let c = 1; c < e.w; c++) own.push('v' + c);
            const lines = D.cutLines(e);
            if (lines.map(L => L.dir + L.k).sort().join() !== own.sort().join()) fail('GAME ' + where + ': cutLines() lists ' + lines.map(L => L.dir + L.k).join(',') + ', the shape has ' + own.join(','));
            let good = 0;
            lines.forEach(L => {
              /* 線段要真的在圖形裡（或剛好沿著缺角的邊、和對的切線在同一直線上） */
              const yIn = (L.y1 - y0) / U, xIn = (L.x1 - x0) / U;
              if (L.dir === 'h' && !(L.y1 === L.y2 && L.x1 === x0 && L.x2 === x0 + (L.k < e.nh ? e.w - e.nw : e.w) * U && yIn === L.k)) fail('GAME ' + where + ': the drawn line h' + L.k + ' is not where that grid line is');
              if (L.dir === 'v' && !(L.x1 === L.x2 && xIn === L.k && L.y2 === y0 + e.h * U && L.y1 === y0 + (L.k > e.w - e.nw ? e.nh : 0) * U)) fail('GAME ' + where + ': the drawn line v' + L.k + ' is not where that grid line is');
              const A = cells.filter(x => L.dir === 'h' ? x[0] < L.k : x[1] < L.k), B = cells.filter(x => L.dir === 'h' ? x[0] >= L.k : x[1] >= L.k);
              const ra = isRect(A), rb = isRect(B), ok = !!(ra && rb);
              const res = D.cutResult(e, L);
              if (res.ok !== ok) fail('GAME ' + where + ': cutting along ' + L.dir + L.k + ' — cutResult says ' + (res.ok ? '' : 'not ') + 'two rectangles, the cells say ' + (ok ? '' : 'not ') + 'two rectangles');
              if (ok){
                good++;
                if (!(res.a.w === ra.w && res.a.h === ra.h && res.b.w === rb.w && res.b.h === rb.h)) fail('GAME ' + where + ': the two pieces of ' + L.dir + L.k + ' are ' + JSON.stringify([res.a, res.b]) + ', the cells say ' + JSON.stringify([ra, rb]));
                /* cutBoxes()：兩塊的位置剛好蓋住那兩堆格子 */
                const bx = D.cutBoxes(e, L);
                [[bx[0], A], [bx[1], B]].forEach(([b, cs], z) => {
                  const cr = isRect(cs), r0 = Math.min(...cs.map(x => x[0])), c0 = Math.min(...cs.map(x => x[1]));
                  if (!(b.x === x0 + c0 * U && b.y === y0 + r0 * U && b.w === cr.w * U && b.h === cr.h * U)) fail('GAME ' + where + ': cutBoxes piece ' + z + ' of ' + L.dir + L.k + ' is not where its cells are');
                });
                LANGS.forEach(Lg => {
                  const d = I18N[Lg], a = areaRef(ra.w, ra.h), b = areaRef(rb.w, rb.h), T = areaRef(e.w, e.h) - areaRef(e.nw, e.nh);
                  if (a + b !== T) fail('GAME ' + where + ': the two pieces add to ' + (a + b) + ', the shape has ' + T + ' cells');
                  arithVerified += seq(where + ' gCutDone ' + L.dir + L.k + ' ' + Lg, d.gCutDone(ra.w, ra.h, rb.w, rb.h, a, b, T), [ra.w, ra.h, a, rb.w, rb.h, b, a, b, T]);
                  arithVerified += seq(where + ' gCutLine ' + Lg, d.gCutLine(a, b, T), [a, b, T]);
                  seq(where + ' gCutPiece ' + Lg, d.gCutPiece(ra.w, ra.h), [ra.w, ra.h]);
                  const pill = sq(bx[0].x + bx[0].w / 2, bx[0].y + bx[0].h / 2, C.pill, 24);
                  inside(pill, where + ' piece label', D.CUT_H);
                  if (String(d.gCutPiece(ra.w, ra.h)).length * 15 * 0.62 > C.pill) fail('GAME ' + where + ': the piece label is wider than its pill');
                });
              } else if (res.rect){
                const rect = ra || rb;
                if (!rect || (ra && rb)) fail('GAME ' + where + ': a wrong cut ' + L.dir + L.k + ' should leave exactly one rectangle');
                else if (!(res.rect.w === rect.w && res.rect.h === rect.h)) fail('GAME ' + where + ': the wrong cut ' + L.dir + L.k + ' says it leaves ' + res.rect.w + '×' + res.rect.h + ', the cells say ' + rect.w + '×' + rect.h);
                LANGS.forEach(Lg => seq(where + ' gCutBad ' + L.dir + L.k + ' ' + Lg, I18N[Lg].gCutBad(res.rect.w, res.rect.h), [res.rect.w, res.rect.h]));
              }
            });
            if (good !== 2) fail('GAME ' + where + ': ' + good + ' cuts give two rectangles — there should be exactly two (across and down)');
            const wrongs = lines.length - good;
            if (wrongs < 2) fail('GAME ' + where + ': only ' + wrongs + ' wrong lines — the round has nothing to get wrong');
            LANGS.forEach(Lg => seq(where + ' gCut2 ' + Lg, I18N[Lg].gCut2(e.nh, e.w - e.nw), [e.nh, e.w - e.nw]));
            /* cutPick()：整塊畫板每 1px —— 和自己的「最近的線」比 */
            const goodLine = L => D.cutResult(e, L).ok;
            let bad = 0, refused = 0, samples = 0;
            for (let y = 0.5; y < D.CUT_H; y += 1){
              for (let x = 0.5; x < W; x += 1){
                const p = { x, y }, got = D.cutPick(e, p);
                const ds = lines.map(L => ({ L, d:dSeg(L, p) })).sort((a, b) => a.d - b.d);
                if (!got){
                  /* 沒點到：一定是離每一條線都超過 hit，或在交叉點附近而且附近沒有對的線 */
                  if (ds[0].d <= C.hit){
                    const close = ds.filter(z => z.d - ds[0].d < C.tie && z.d <= C.hit);
                    if (close.length === 1 || close.some(z => goodLine(z.L))) bad++;
                  }
                  continue;
                }
                const dg = dSeg(got, p);
                if (dg > C.hit + 1e-9 || dg - ds[0].d >= C.tie) bad++;
                else if (!goodLine(got) && ds.some(z => z.d - ds[0].d < C.tie && z.d <= C.hit && goodLine(z.L))) bad++;
              }
            }
            if (bad) fail('GAME ' + where + ': cutPick() disagrees with the nearest grid line at ' + bad + ' points');
            /* 點在對的切線上（裡面那一段，每 1px），一定切得對 */
            lines.filter(goodLine).forEach(L => {
              const ci = D.cutInner(e, L);
              const len = Math.hypot(ci.x2 - ci.x1, ci.y2 - ci.y1);
              if (!(len >= U)) fail('GAME ' + where + ': the inner part of the right cut ' + L.dir + L.k + ' is shorter than one cell');
              for (let s = 0; s <= len; s += 1){
                const p = { x:ci.x1 + (ci.x2 - ci.x1) * s / len, y:ci.y1 + (ci.y2 - ci.y1) * s / len };
                samples++;
                const got = D.cutPick(e, p);
                if (!got || !goodLine(got)) refused++;
              }
              /* 缺角的邊（和對的切線在同一直線上）也算 */
              const ext = L.dir === 'h' ? { x:x0 + (e.w - e.nw / 2) * U, y:y0 + e.nh * U } : { x:x0 + (e.w - e.nw) * U, y:y0 + e.nh * U / 2 };
              const g2 = D.cutPick(e, ext);
              if (!g2 || !goodLine(g2)) fail('GAME ' + where + ': a tap on the missing corner\'s edge that continues the right cut ' + L.dir + L.k + ' is not taken as that cut');
            });
            if (refused) fail('GAME ' + where + ': ' + refused + ' of ' + samples + ' taps right on a correct cut line are refused or taken as a wrong line');
          });
        }

        if (arithVerified < 200) fail('GAME: only ' + arithVerified + ' calculations in the game\'s sentences were checked — the arithmetic scanner is not reading them');
      }

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
              fail(`${bank}[${i}] ${L}: there is a decimal, but every length and area in this lesson is a whole number`);
            if (NEG.test(stem) || q.opts.some(o => NEG.test(String(o))))
              fail(`${bank}[${i}] ${L}: there is a negative number, but every length and area in this lesson is positive`);
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
            /* 選項的形狀與單位。 */
            if (e.kind === 'unitLabel'){
              /* 選項要剛好是四個單位標籤（兩個面積、兩個長度）—— 長度單位是這一題的誘答。 */
              const labels = ['cm2','m2','cm','m'].map(k => UNIT_LABELS[L][k]);
              const got = q.opts.map(String).slice().sort().join('\u0001');
              if (got !== labels.slice().sort().join('\u0001'))
                fail(`${bank}[${i}] ${L}: the options are not exactly the four unit labels (${q.opts.join(',')})`);
            } else if (e.kind === 'text'){
              q.opts.forEach(o => {
                if (!String(o).trim()) fail(`${bank}[${i}] ${L}: an option is empty`);
              });
            } else {
              const hi = e.optMax || areaRef(data.GRID_MAX_W, data.GRID_MAX_H) * 2;
              q.opts.forEach(o => {
                const p = valUnit(o, L);
                if (!p){ fail(`${bank}[${i}] ${L}: option "${o}" is not a number with one of this lesson's units`); return; }
                if (e.optUnits.indexOf(p.unit) < 0)
                  fail(`${bank}[${i}] ${L}: option "${o}" carries the unit ${p.unit}, this question only allows ${e.optUnits.join('/')}`);
                const lo = (typeof e.optMin === 'number') ? e.optMin : 1;
                if (p.v < lo || p.v > hi) fail(`${bank}[${i}] ${L}: option "${o}" is outside ${lo}~${hi}`);
              });
            }
            /* 正解由題幹的數字重算。 */
            let want = null;
            if (e.kind === 'text') want = e.text[L];
            else if (e.kind === 'unitLabel') want = UNIT_LABELS[L][e.want];
            else if (e.kind === 'unitSquare') want = areaRef(1, 1) + ' ' + UNIT_LABELS[L].cm2;
            else if (e.kind === 'rectArea') want = areaRef(e.sides[0], e.sides[1]) + ' ' + UNIT_LABELS[L].cm2;
            else if (e.kind === 'squareArea') want = areaRef(e.sides[0], e.sides[0]) + ' ' + UNIT_LABELS[L].cm2;
            else if (e.kind === 'perimeter') want = perimeterRef(e.sides[0], e.sides[1]) + ' ' + UNIT_LABELS[L].cm;
            else if (e.kind === 'sideFromArea'){
              const big = Math.max.apply(null, nums), small = Math.min.apply(null, nums);
              const other = otherSideRef(big, small);
              if (other === null){
                fail(`${bank}[${i}] ${L}: the printed area ${big} is not a whole number of ${small}s`);
                continue;
              }
              want = other + ' ' + UNIT_LABELS[L].cm;
            }
            else if (e.kind === 'wholeMinusPart')
              want = (areaRef(e.whole[0], e.whole[1]) - areaRef(e.part[0], e.part[1])) + ' ' + UNIT_LABELS[L][e.unit];
            else if (e.kind === 'm2ToCm2') want = (nums[0] * CM2_PER_M2) + ' ' + UNIT_LABELS[L].cm2;
            else if (e.kind === 'areaDiff'){
              /* 題幹說兩個長方形的周長都是 e.per —— 那句話要真的成立。 */
              e.pairs.forEach(pr => {
                if (perimeterRef(pr[0], pr[1]) !== e.per)
                  fail(`${bank}[${i}] ${L}: the stem says both perimeters are ${e.per}, but ${pr[0]}x${pr[1]} has ${perimeterRef(pr[0], pr[1])}`);
              });
              const a0 = areaRef(e.pairs[0][0], e.pairs[0][1]), a1 = areaRef(e.pairs[1][0], e.pairs[1][1]);
              want = Math.abs(a1 - a0) + ' ' + UNIT_LABELS[L].cm2;
            }
            else if (e.kind === 'perimTrap'){
              /* 題幹裡那個「寫錯的數字」必須真的是周長 —— 這一題考的就是那個迷思。 */
              if (perimeterRef(e.sides[0], e.sides[1]) !== e.wrong)
                fail(`${bank}[${i}] ${L}: the stem's wrong answer ${e.wrong} is not the perimeter of ` +
                     `${e.sides[0]}x${e.sides[1]} (${perimeterRef(e.sides[0], e.sides[1])}), so the misconception is not the one described`);
              want = areaRef(e.sides[0], e.sides[1]) + ' ' + UNIT_LABELS[L].cm2;
            }
            else { fail(`${bank}[${i}] ${L}: unknown oracle kind ${e.kind}`); continue; }

            if (String(q.opts[q.ans]).trim() !== String(want))
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", recomputed "${want}"`);
            /* 解釋一定要把答案（與它的理由）講出來。 */
            (e.whyExpr ? e.whyExpr[L] : []).forEach(expr => {
              if (whyPlain.indexOf(expr) < 0)
                fail(`${bank}[${i}] ${L}: the explanation no longer shows "${expr}", so the operation is unchecked`);
            });
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
          /* 中文規則在這些頁面上有兩份：markup 的 fallback ＋ 字典。只數總次數的話，
             把 markup 那一份刪掉、在別的地方多留一份字串也能湊到數（codex），
             所以 markup 那一半和 script 那一半各自都要有。 */
          const cut = html.indexOf('<script>');
          const markupHalf = cut >= 0 ? html.slice(0, cut) : html;
          const scriptHalf = cut >= 0 ? html.slice(cut) : '';
          /* ⚠️ 「markup 那一半／字典那一半各自都要有」這一條沒有單筆改壞可以證明：
             要製造它，得同時把 markup 那一份拿掉**並且**在字典裡多留一份，
             而一筆 break 只做一次 find/replace。它是「總次數」那一條的加強版，
             而總次數那一條有自己的改壞測試（reference/parents 各一筆）。 */
          rule.must.forEach(entry => {
            const t = entry[0], need = entry[1];
            const got = html.split(t).length - 1;
            if (got < need) fail(`${page} no longer says "${t}" the required number of times (${got} of ${need})`);
            else if (need >= 2){
              if (markupHalf.split(t).length - 1 < 1)
                fail(`${page}: "${t}" is gone from the visible markup (only the dictionary still carries it)`);
              if (scriptHalf.split(t).length - 1 < 1)
                fail(`${page}: "${t}" is gone from the dictionary (only the markup fallback still carries it)`);
            }
          });
          rule.forbid.forEach(t => {
            if (html.indexOf(t) >= 0) fail(`${page} says "${t}", which contradicts the rule this lesson teaches`);
          });
          if (rule.orderedZh){
            const tbl = html.match(new RegExp('<table class="' + rule.orderedZh.table + '">[\\s\\S]*?</table>'));
            if (!tbl){ fail(`${page} has no <table class="${rule.orderedZh.table}"> to check the order in`); return; }
            const at = rule.orderedZh.words.map(w => tbl[0].indexOf('>' + w + '<'));
            at.forEach((v, i) => { if (v < 0) fail(`${page} unit table is missing a cell for ${rule.orderedZh.words[i]}`); });
            for (let i = 1; i < at.length; i++){
              if (at[i - 1] >= 0 && at[i] >= 0 && at[i] < at[i - 1])
                fail(`${page} unit table has ${rule.orderedZh.words[i]} before ${rule.orderedZh.words[i - 1]}`);
            }
          }
        });
      }
    }
  }
};
