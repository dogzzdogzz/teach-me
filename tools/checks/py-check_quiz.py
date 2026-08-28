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

    # ---- 反向：這三條釘住 2026-08-28 修掉的三個解析 bug，不可以回來 ----
    dict(file=F, expect='[EQVAL]', negative=True,
         why="two-digit numerators must stay distinct — the old [+-−] character RANGE "
             "swallowed the leading digit, so 13/5 and 23/5 both parsed as 3/5",
         find="2 又 3/5 換成假分數應該是多少？',\n          opts:['6/5','13/5','7/5','23/5'], ans:1,",
         replace="2 又 3/5 換成假分數應該是多少？',\n          opts:['13/5','23/5','43/5','53/5'], ans:1,"),
    dict(file=F, expect='[EQVAL]', negative=True,
         why="a negative and a positive fraction are different values — the old "
             "`'' in '-−'` test made every unsigned value negative",
         find="下面哪一個是<strong>真分數</strong>？', opts:['5/5','3/8','9/4','4/3'], ans:1,",
         replace="下面哪一個是<strong>真分數</strong>？', opts:['-3/4','3/4','9/4','4/3'], ans:1,"),
    dict(file=F, expect='[EQVAL]', negative=True,
         why='English mixed numbers that really differ must not be flagged',
         find="opts:['2 1/4 metres','1 2/4 metres','4 1/4 metres','2 metres'], ans:0,",
         replace="opts:['2 1/4 metres','1 2/4 metres','4 1/4 metres','3 3/4 metres'], ans:0,"),
]
