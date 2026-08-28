# -*- coding: utf-8 -*-
"""`tools/check_parents.py` 的改壞測試。

`tools/README.md` 說這一支有「25 筆改壞測試全過」，但那 25 筆**從來沒有進版控** ——
跑過一次就沒了，等於現在沒有任何證據證明它們還會響。這一份把最值錢的幾筆固定下來。

重點放在「用正規式讀 HTML 一直 fail open」那一類（三輪 codex 審查在這支上抓到的洞
幾乎都是這種），以及**必須不噴**的那一半：註解裡的假區塊不可以被當成真的。
"""
CHECKER = 'tools/check_parents.py'
MODE = 'files'
FIXTURES = ['grade-4/math/fraction/parents.html']
BASELINE_CLEAN = r'--- 0 problem\(s\)'

F = FIXTURES[0]
R1 = '<a href="https://www.junyiacademy.org/topics/math-4" target="_blank" rel="noopener noreferrer" data-i18n="r1t">'

BREAKS = [
    # 連結屬性：少一個就等於把孩子的分頁交給對方網站
    dict(file=F, expect='missing target="_blank"',
         find=R1,
         replace='<a href="https://www.junyiacademy.org/topics/math-4" rel="noopener noreferrer" data-i18n="r1t">'),
    dict(file=F, expect='rel must contain the tokens noopener and noreferrer',
         find=R1,
         replace='<a href="https://www.junyiacademy.org/topics/math-4" target="_blank" rel="noopener" data-i18n="r1t">'),
    # 仿冒網域：rN 和網域是綁死的，用 hostname 比對而不是子字串
    dict(file=F, expect='every anchor in this row must be on',
         find='https://www.junyiacademy.org/topics/math-4',
         replace='https://www.junyiacademy.org.evil.example/topics/math-4'),
    # 標題與描述的編號必須配對
    dict(file=F, expect='title and description must carry the',
         find='<span class="rdesc" data-i18n="r1d">中文、依 108 課綱編排。',
         replace='<span class="rdesc" data-i18n="r4d">中文、依 108 課綱編排。'),
    # 日期是安全聲明的一半，不是裝飾
    # ⚠️ 日期是從**字典**讀的，不是從 markup —— 改 markup 這一條不會響（第一版就寫錯了）
    dict(file=F, expect='must state the last-checked date',
         find='"s6note": "連結最後檢查：2026-08-28。',
         replace='"s6note": "連結最後檢查：最近。'),
    dict(file=F, expect='is not a real calendar date',
         find='"s6note": "連結最後檢查：2026-08-28。',
         replace='"s6note": "連結最後檢查：2026-02-31。'),
    # 容器必須是扁的，而且剛好一個
    dict(file=F, expect='container has a nested <div>',
         find='    <ul class="reslist">',
         replace='    <div><ul class="reslist"></div>\n    <ul class="reslist">'),
    # 英文字典裡不可以有中文（平台名要羅馬拼音）
    dict(file=F, expect='en value contains Chinese',
         find='"r1t": "Junyi Academy · grade 4 maths (in Chinese)"',
         replace='"r1t": "均一教育平台 · grade 4 maths"'),

    # 剛好要有一個容器 —— 多一個也要報錯，不然「註解裡的假區塊不算」那一條
    # 可以被「根本沒在數容器」滿足（codex 2026-08-28）
    dict(file=F, expect='expected exactly one <div class="resblock">',
         find='    <div class="resblock">',
         replace='    <div class="resblock"></div>\n    <div class="resblock">'),

    # ---- 反向：必須不要噴 ----
    dict(file=F, expect='延伸資源', negative=True,
         why='a fake resources block hidden in an HTML comment must not count as the real one',
         find='    <div class="resblock">',
         replace='    <!-- <div class="resblock"><ul class="reslist"><li>fake</li></ul></div> -->\n    <div class="resblock">'),
]
