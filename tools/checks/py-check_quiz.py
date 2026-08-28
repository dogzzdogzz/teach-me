# -*- coding: utf-8 -*-
"""`tools/check_quiz.py` 的改壞測試。

⚠️ 這一支是全站唯一在盯 §六之二「同一組選項裡不可以有兩個值相同的項」的東西，
而它的數值解析在 2026-08-28 之前**壞了很久**：`[+-−]` 是字元**範圍**（含 0~9）、
`'' in '-−'` 是 True、而且不認得英文帶分數。每一次執行都是綠的。

所以下面的反向改壞和正向的一樣重要：它們釘住的是「那三個 bug 不可以回來」。
"""
CHECKER = 'tools/check_quiz.py'
MODE = 'files'
FIXTURES = ['grade-4/math/fraction/index.html']
BASELINE_CLEAN = r'--- 0 problem\(s\)'

F = FIXTURES[0]

BREAKS = [
    # ---- EQVAL：不同字串、同一個值 ----
    # 6/4 和 3/2 是同一個數，孩子看到的其實只有三個選項
    dict(file=F, expect='[EQVAL]',
         find="2 又 3/4 換成假分數是多少？', opts:['5/4','6/4','11/4','23/4'], ans:2,",
         replace="2 又 3/4 換成假分數是多少？', opts:['5/4','6/4','3/2','23/4'], ans:2,"),
    # 兩種寫法同值：帶分數 vs 假分數
    dict(file=F, expect='[EQVAL]',
         find="opts:['2 又 3/5','3 又 2/5','3 又 17/5','3'], ans:1,",
         replace="opts:['2 又 3/5','3 又 2/5','3 又 17/5','13/5'], ans:1,"),
    # **英文帶分數**的等值 —— 2026-08-28 之前這一條驗不到（解析器不認得 `1 2/5`）
    dict(file=F, expect='[EQVAL]',
         find="opts:['2 1/4 metres','1 2/4 metres','4 1/4 metres','2 metres'], ans:0,",
         replace="opts:['2 1/4 metres','1 2/4 metres','1 1/2 metres','2 metres'], ans:0,"),

    # ---- 題庫張數與正解索引 ----
    dict(file=F, expect='[ANS]',
         find="        { stem:'What is 2 3/4 as an improper fraction?', opts:['5/4','6/4','11/4','23/4'], ans:2,",
         replace="        { stem:'What is 2 3/4 as an improper fraction?', opts:['5/4','6/4','11/4','23/4'], ans:3,"),
    dict(file=F, expect='[OPTLEN]',
         find="opts:['6/5','13/5','7/5','23/5'], ans:1,\n          why:'帶分數的「又」",
         replace="opts:['6/5','13/5','7/5'], ans:1,\n          why:'帶分數的「又」"),

    # ---- 反向：必須不要噴 ----
    # ⚠️ 兩條 2026-08-28 的解析 bug 其實是被 **baseline 本身**釘住的，不是被改壞測試：
    # 這個 fixture 的 qsBoost[1] 就含有 13/5 和 23/5，舊解析器會把兩個都讀成 3/5，
    # 於是原檔就會噴 EQVAL、整份設定直接 BASELINE-FAIL。那比一筆反向改壞更強，
    # 所以這裡**不再重複**寫那兩筆（寫了也是永遠不會失敗的空斷言）。
    # 同理，英文帶分數的解析由上面第 3 筆**正向**改壞證明。
    dict(file=F, expect='[EQVAL]', negative=True,
         why="a negative and a positive fraction are different values — the old "
             "`'' in '-−'` test made every unsigned value negative too "
             "(the baseline has no negative options, so this one is not covered by it)",
         find="下面哪一個是<strong>真分數</strong>？', opts:['5/5','3/8','9/4','4/3'], ans:1,",
         replace="下面哪一個是<strong>真分數</strong>？', opts:['-3/4','3/4','9/4','4/3'], ans:1,"),
]
