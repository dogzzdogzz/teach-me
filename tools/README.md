# tools — 上架前的檢查

這六個 Python 檢查 ＋ 三支 Node 腳本（模擬／資料驗證／改壞測試）＋ 一個瀏覽器 harness，是課程上架前的檢查工具。
**每一個都抓得到別人抓不到的東西**，所以請六個都跑，不要只跑靜態的。
（前兩輪審查時它們寫在暫存目錄裡，事後都不見了，只好重寫兩次 —— 所以這次進版控。）

先開一個本機伺服器（瀏覽器 harness 需要）：

```bash
cd <repo root>
python3 -m http.server 8765
```

## 1. inline script 語法檢查

```bash
python3 tools/check_syntax.py .   # 含 tools/sweep.html
```

把每一頁的 inline `<script>` 抽出來丟 `node --check`。抓語法錯誤 —— 頁面壞掉時
瀏覽器只會靜靜地什麼都不做，靜態讀檔看不出來。

## 2. i18n 檢查（綁定 ＋ 中文殘留 ＋ key 對應 ＋ 英文字典裡的中文）

```bash
python3 tools/check_i18n.py $(find . -name '*.html' -not -path './tools/*' | sort)
```

四種問題一次抓（對應 teaching-framework.md §五之一）：

- `BIND` —— markup 引用了兩本字典裡都沒有的 key（key 對應檢查永遠抓不到）
- `LEAK` —— 中文文字節點掉在所有 `data-i18n` 元素之外（用 tag stack 判定，
  巢狀 `<strong>`／`<br>` 不算；void 元素不進 stack —— 這個 bug 曾經藏了 19 個真殘留）
- `PARITY` —— zh／en key 沒有一一對應
- `EN-CJK` —— `I18N.en` 裡有中文。**目前有 39 筆是刻意的**（中文數字、八折這類
  「中文本身就是教材」的字串），`en.btn` 的 `'中'` 也是正常的。

## 3. 題庫與選項檢查

```bash
python3 tools/check_quiz.py $(find . -name '*.html' -not -path './tools/*' | sort)
```

- 題庫張數（`qs` 6 ＋ `qsAdv` 4 ＋ `qsBoost` 2）、選項數、**zh／en 正解索引一致**
- `EQVAL` —— 同一組選項裡有兩個「值」相同的項（有理數比較，**含單位**：
  `1 公克` 和 `1 公斤` 不相等）。目前有 8 筆是 §六之二 的合法例外
  （反向題 `percent`、記法就是考點 `rounding`、題幹已寫「記得約分」`fraction-multiply`）。

## 3b. 給家長那一頁的五段格式

```bash
python3 tools/check_parents.py $(find . -name parents.html | sort)
```

檢查 `parents.html` 有沒有真的回答家長要的五件事（teaching-framework §六之一）：
五段齊備、四個可觀察的行為、三個不需教具的活動、每個迷思都配一句**有引號、家長可以照著念**
的話、精熟標準寫出遊戲名稱與 2/3 門檻、只有語言切換一個互動、可列印。

早期手寫的 29 頁鍵名各自不同，只跑通用檢查並印出 `NOTE:`（不是失敗）。

## 3c. 課程清單與堂數

```bash
python3 tools/check_lessons.py .
```

首頁與年級頁的「N 堂課」都是**算出來的**，不是手寫的（2026-08-25 起）：

- 年級頁的 `{N}` = 該頁自己的 `.lesson` 課程卡數量 —— 不依賴任何外部檔案，
  畫面上有幾張卡就是幾堂課，結構上不可能對不上。
- 首頁徽章與 `{N5}`（跨年級引用）= `lessons.js` 裡的 slug 數量。
  載不到 `lessons.js` 時，首頁徽章**整個藏起來**、`{N5}` 顯示 `?` ——
  寧可不顯示，也不要顯示錯的數字。

這支腳本盯的是剩下的漂移風險：`lessons.js` 對不上磁碟（新增課程忘了登記）、
年級頁卡片數對不上實際課程數、課程缺頁，以及**有人把堂數寫死回頁面裡**
（`[HARDCODED]`）。起因：首頁二年級長期停在「1 堂課開課中」，實際已有 2 堂。

## 3d. 產生器模擬與課程資料驗證（Node，2026-08-25 起）

```bash
node tools/simgen.js grade-2/math/add-sub/review.html 30000
node tools/verify_lesson_data.js grade-2/math/add-sub/index.html
```

`sweepOptions` 連按十批只看得到千分之幾的參數空間。**`simgen.js` 把 `review.html` 的
「工具 ＋ GENS」區塊切出來（`/* ---------- 工具 ---------- */` 到 `/* ---------- 出一批`
之間，那段不碰 DOM）丟進 Node 跑幾萬批**，每一批中英各檢查一次：

- 選項數、`opts[ans]` 真的等於 `correct`、沒有垃圾字串
- **兩兩比對**選項的值（兩個誘答彼此相等也算缺陷，不是只比對正解）
- 每個選項都在**這一課自己的數字範圍**裡（`RANGE` 表，預設 0~999）
- **每個產生器一組不變條件**（`INVARIANTS`）：解釋說「個位不夠減要退位」，
  資料就必須真的不夠減。**沒有定義不變條件的產生器會直接被判失敗**（`NO INVARIANT DEFINED`）
  —— 換課程時請把 `INVARIANTS` 與 `RANGE` 改成那一課的
- **誘答不可以把題幹的數字抄回來**（`44 + 10` 的選項裡出現 44）
- **解釋引用的提示詞必須真的在題幹裡**（why 說「一共」，題幹卻問「現在有幾元」）

`verify_lesson_data.js` 驗 `index.html` 的靜態資料：三層題庫的算術（能從題幹解析的
一律重算一次）、zh/en 的 `ans` 一致、選項值不重複、正解位置沒有全押同一個、
以及該課的範例資料與遊戲關卡。

**每一課的檢查設定住在 `tools/checks/<grade>-<slug>.js`**（2026-08-25 起；在那之前
add-sub 的設定是寫死在腳本裡的，換課程就得改壞上一課）。兩支腳本都從課程路徑推出
key（`grade-2/math/time/review.html` → `tools/checks/grade-2-time.js`），**找不到設定
就直接報錯** —— 沒有設定的課程不算驗過。一個設定檔匯出三塊：

- `sim.INVARIANTS`：每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
  沒定義的產生器會被判 `NO INVARIANT DEFINED`。
- `sim.expectedCorrect(d, genId, lang)`：**正解字串的第二套實作**，只用 `make()` 留下的
  原始參數重算，完全不呼叫 `review.html` 的格式化函式。拿產生器自己的格式化函式來比
  等於自己比自己 —— 格式化寫錯（把 31 天印成「30 天」）時不變條件、形狀檢查、
  相等檢查會一起錯過。沒定義的課，選項必須就是 `String(d.correct)`（add-sub 那種純數字）。
- `sim.optionOk(s, genId, lang, isCorrect)`：這一課的選項長什麼樣、範圍多少。
  **正解與誘答分開驗** —— `dateAfter` 的「7 月 33 日」是刻意的誘答，但正解永遠是合法日期。
  範圍要從課程自己的規則推出來（時 1~12、分 0~59、月長只有 28/29/30/31、
  `weeksToDays` 的 k 是 2~5 所以天數上限 42），不要隨手給一個大數。
- `sim.stemEchoOk`：哪些「把題幹的數字放進選項」是刻意的迷思誘答。值可以是布林，
  但**建議寫成謂詞** `function(d, opt, lang, idx)`，只放行那一個值 ——
  整個產生器全開的話，不小心抄回別的數字也會被一起蓋掉。
- `data.check(data, I18N, fail)`：那一課自己的範例資料與遊戲關卡。
- `breaks`：刻意改壞的清單，見下。

通用的那幾條留在 `simgen.js` 裡，所有課共用：選項數、`opts[ans]` 等於獨立算出來的正解、
兩兩不等值、誘答不抄題幹、解釋引用的提示詞真的在題幹裡、`undefined`／`NaN`、
**中文與數字之間要有空格**、**標點不可以連兩個**（英文的 `7:00 p.m.` 後面再補句點會變 `p.m..`）。
後兩條都掃「畫面上真正看得到的文字」：`<svg>` 整塊拿掉、會換行的標籤補一個空白、
行內標籤直接拿掉不補空白（`共<strong>5</strong>個` 畫面上是「共5個」），而且**連選項一起掃**。
最後兩條都是「資料層全對、模擬全綠，只有把句子印出來才看得到」的那一類 ——
產生器的句子是拼出來的，一定要看渲染結果。
批數不是正整數時直接 `exit 2`（`... review.html 0` 會一批都不跑然後回傳成功）。

## 3e. 刻意改壞測試（證明斷言真的會響）

```bash
node tools/breaktest.js grade-2/math/time
```

綠燈的檢查不代表程式對，可能只代表那條斷言永遠不會響。這支腳本把設定檔 `breaks` 裡的
每一筆改壞版本套到暫存副本上，確認對應的檢查**真的會噴出預期的錯誤訊息**。
新增斷言就順手加一筆 break；`find` 字串對不上會報 `SETUP-FAIL`（那表示斷言失去了保護對象，一樣要修）。
跑改壞版本之前會先跑**原檔**：原檔沒過（或原檔本來就在噴同一句話）就報 `BASELINE-FAIL`／`NO PROOF` ——
不然「改壞後有錯」可能根本不是改壞造成的。比對只認 `[FAIL]` 那一行裡出現預期訊息，
不是整份輸出裡隨便一個子字串。原檔與改壞版**跑同一個亂數種子**（`SIMGEN_SEED`），
不然兩次抽到不同參數，「只有改壞版失敗」可能只是運氣。
（`SIMGEN_SEED=42 node tools/simgen.js <review.html> 1000` 也可以自己用來重現某一批。）
目前：add-sub 6 筆、time 27 筆、length 35 筆、divide 57 筆，全部會被抓到。

divide 那一課的 57 筆裡有 9 筆是**第一輪 codex 審查抓到的缺陷**補上的守門條件：
選項必須屬於這一題自己的情境（不然糖果題會冒出「5 籃」）、算式誘答要把 □ 解出來
比一次（`k ＋ □ ＝ 總數` 在 k ＝ 2、答案 ＝ 2 時也成立）、字典的單位詞要跟設定檔的
真值表逐字比對（顆 → 棵 抓不到的話，後面每一條渲染檢查都在拿字典比字典）、
例子的數量要是整數（12.5 顆分成每包 2.5 顆會整除也會過範圍）、
SVG 的寬度要蓋住它自己畫出去的最大 x（一開始那一排散落的東西曾經被整段切掉）、
題庫神諭要記下「題幹裡一定要出現的數字」並從那些數字重算答案（位置式神諭
擋不住「把題幹的 12 改成 13」），而且**每一個選項**都要驗形狀，不只是正解。

**檢查腳本自己也會有洞，而且補洞也會補錯**（2026-08-26 length 那一課，第三輪 codex 審查）：
- `cms[q.ans]` 在 `ans` 越界時是 `undefined`，`undefined > 800` 是 false —— 整題沒被驗到卻是綠的。
  **凡是用索引取值再拿去比較的，先驗索引合法。**
- 靠「渲染結果的樣式」判斷該不該檢查（例如用 `rx="8"` 找長條）會 fail-open：
  樣式一改，檢查就整個靜靜消失。改壞測試證明了這件事。現在改成
  `rulerSVG` 直接輸出 `data-from`／`data-to`，**再加一個和樣式無關的第二偵測器**
  （長條矩形的 y/height），兩個都沒中才算「這一題沒有圖」。
- 神諭表（`BANK_EXPECTED`／`BANK_RULER`）只比對「有的題目」的話，**刪掉一題不會有人發現**。
  要連長度一起比。
- 註解寫的推導和旁邊的常數要一致 —— 審查者第一個抓的就是「註解算出 304，你寫 310」。

**兩支都要先用「刻意改壞」的版本驗過會噴錯再拿去跑真檔** —— 現在用 `tools/breaktest.js`
（§3e）跑，清單進版控。**沒響也要追原因**：add-sub 那一輪有一條沒響，
追下去才發現那個保底路徑實際上到不了。

## 4. 站內連結

```bash
python3 tools/check_links.py .
```

所有 `href`／`src`／meta refresh 指到的本地檔案都要存在。

## 5. 瀏覽器實測（**最重要的一個**）

靜態檢查全綠不代表頁面是對的。上一輪有一個 bug 讓 135 頁的修正完全失效，
只有瀏覽器抓得到；這一輪瀏覽器又抓到 3 個靜態檢查看不到的產生器缺陷
（`polygon` 的「60·2°」保底選項、`fraction`／`percent` 兩個等值誘答）。

開 `http://localhost:8765/tools/sweep.html`，在 console 裡跑：

```js
PATHS = await (await fetch('/tools/paths.json')).json();
await runSweep(PATHS, 'zh');     // 回傳 [] 就是乾淨
await runSweep(PATHS, 'en');     // 兩種語言都要跑
await sweepOptions(PATHS.filter(p => p.endsWith('/review.html')), 10);
```

- `runSweep` —— 每一頁都載入、切語言、點所有模式卡、點完所有試題選項、
  玩過遊戲（提示／下一關／重新開始），收集 JS 錯誤、空的動態容器、
  畫面上看得到的 `undefined`／`NaN`／`<strong>`。
- `sweepOptions` —— 產生器出的題目連按 N 批，檢查選項有沒有
  垃圾字串（`·`、`#`）、字串重複、**值重複**（key 相等且題幹沒說「記得約分」＝ `KEY-EQUAL`，
  最嚴重）。

### 兩個會咬人的坑

1. **`localStorage` 會跨測試殘留**（`teachme-lang`／`teachme-mode`）。harness 會在
   載入前先設定，因為 iframe 同源；自己寫測試時一定要先清，否則頁面用英文開場，
   斷言全部誤判。
2. **`reference.html`／`review.html`／`parents.html` 都要測**，不能只測 `index.html`
   —— 135 頁那個 bug 就是這樣漏掉的。
