# tools — 上架前的檢查

這六個腳本 ＋ 一個瀏覽器 harness，是 2026-08-25 課程審查用的檢查工具。
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
- `EN-CJK` —— `I18N.en` 裡有中文。**目前有 36 筆是刻意的**（中文數字、八折這類
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
