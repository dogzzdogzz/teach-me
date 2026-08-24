# teach-me — 互動數學教室

給國小學生的互動數學課程網站（繁體中文）。每一課都是一個獨立的網頁，
包含**範例教學**、**試題**、**小遊戲**三個部分，讓孩子看得懂、玩得動、記得住。

🌐 **網站**：<https://dogzzdogzz.github.io/teach-me/>

## 資料夾結構

課程依台灣 108 課綱（台北市公立國小適用）分成一到六年級，
每個年級的 `math/README.md` 記錄該年級數學的主要學習單元與內容：

```
index.html                 # 網站首頁（課程目錄）
grade-1/math/              # 一年級數學：單元整理
grade-2/math/              # 二年級數學：單元整理
grade-3/math/              # 三年級數學：單元整理
grade-4/math/              # 四年級數學：單元整理
grade-5/math/              # 五年級數學：單元整理＋課程
│   ├── factor/factor-1.html      # 因數 — 因數工廠
│   └── multiple/multiple-1.html  # 倍數 — 跳跳蛙數字樂園
grade-6/math/              # 六年級數學：單元整理
```

## 各年級數學單元整理

| 年級 | 重點內容 | 單元整理 |
|------|----------|----------|
| 一年級 | 100 以內的數、加減法、形狀、時鐘整點半點 | [grade-1/math](grade-1/math/README.md) |
| 二年級 | 1000 以內的數、直式加減、九九乘法、公分公尺 | [grade-2/math](grade-2/math/README.md) |
| 三年級 | 萬以內的數、乘除直式、分數與小數入門、周長、圓 | [grade-3/math](grade-3/math/README.md) |
| 四年級 | 大數與概數、四則混合、帶分數、角度、面積公式 | [grade-4/math](grade-4/math/README.md) |
| 五年級 | **因數與倍數**、通分與異分母加減、分數小數乘除、體積 | [grade-5/math](grade-5/math/README.md) |
| 六年級 | 質數與質因數分解、分數小數除法、比與比值、圓面積、速率 | [grade-6/math](grade-6/math/README.md) |

## 目前的課程

| 年級 | 課程 | 連結 |
|------|------|------|
| 五年級 | 因數 — 因數工廠 | [grade-5/math/factor/factor-1.html](https://dogzzdogzz.github.io/teach-me/grade-5/math/factor/factor-1.html) |
| 五年級 | 倍數 — 跳跳蛙數字樂園 | [grade-5/math/multiple/multiple-1.html](https://dogzzdogzz.github.io/teach-me/grade-5/math/multiple/multiple-1.html) |

## 課程頁面慣例

- 路徑：`grade-X/math/<主題>/<主題>-N.html`，一課一個自足的 HTML（行內 CSS ＋原生 JS，無外部相依）。
- 三段式結構：範例教學（互動示範）→ 試題（六題即時回饋＋計分）→ 小遊戲（五關計分）。
- 淺色暖色系：背景 `#FAF7F0`、卡片 `#FFF`、強調綠 `#2F9E69` ／橘 `#E8871E`；大字體、SVG 插圖。
- 每課頁首連回首頁；新增課程時同步在 `index.html` 加上課程卡片。

## 發佈

`main` 分支根目錄由 GitHub Pages 直接服務，push 後約一分鐘自動更新，無建置步驟。
