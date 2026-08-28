# -*- coding: utf-8 -*-
"""`tools/check_i18n.py` 的改壞測試。

這一支把關全站 272 頁的四件事：BIND（引用了不存在的 key）、LEAK（中文掉在
data-i18n 之外）、PARITY（zh/en key 沒有一一對應）、EN-CJK（英文字典裡有中文）。
四種都要有正向改壞，**而且 LEAK 要有反向的那一半** —— 巢狀在 data-i18n 裡的
<strong>／<br> 是合法的，把檢查寫得太嚴會開始誤報全站每一頁。
"""
CHECKER = 'tools/check_i18n.py'
MODE = 'files'
FIXTURES = ['grade-4/math/fraction/index.html']
BASELINE_CLEAN = r'--- 0 problem\(s\)'

F = FIXTURES[0]

BREAKS = [
    # ---- BIND：markup 引用了兩本字典都沒有的 key ----
    dict(file=F, expect='[BIND]',
         find='<h2 data-i18n="s1h2">三個名字',
         replace='<h2 data-i18n="s1h2NoSuchKey">三個名字'),
    dict(file=F, expect='data-i18n-aria="langAriaNope"',
         find='data-i18n-aria="langAria"',
         replace='data-i18n-aria="langAriaNope"'),

    # ---- LEAK：中文文字節點掉在所有 data-i18n 元素之外 ----
    dict(file=F, expect='[LEAK]',
         find='  <nav class="coursenav">',
         replace='  <p>這一段中文沒有接字典</p>\n  <nav class="coursenav">'),
    # 表格儲存格是歷史上最常藏殘留的地方
    dict(file=F, expect='[LEAK]',
         find='<th data-i18n="s1th0">名字</th>',
         replace='<th>名字</th>'),
    # SVG <text> 同樣適用（§五之一 明文）
    dict(file=F, expect='[LEAK]',
         find='<svg class="barfig" id="s1fig" viewBox="0 0 520 132" xmlns="http://www.w3.org/2000/svg"></svg>',
         replace='<svg class="barfig" id="s1fig" viewBox="0 0 520 132" xmlns="http://www.w3.org/2000/svg"><text x="10" y="10">格子</text></svg>'),
    # void 元素不可以進 tag stack —— 這個 bug 曾經藏了 19 個真殘留
    dict(file=F, expect='[LEAK]',
         find='  <header>\n    <h1 data-i18n="h1">',
         replace='  <header>\n    <br>殘留在 br 後面的中文\n    <h1 data-i18n="h1">'),

    # ---- PARITY：只從一本字典拿掉 key ----
    dict(file=F, expect='[PARITY]',
         find="      narrJoin:' ',\n",
         replace=''),

    # ---- EN-CJK：英文字典裡有中文 ----
    dict(file=F, expect='[EN-CJK]',
         find="      eb1:'Example 1',",
         replace="      eb1:'範例教學 1',"),

    # ---- 反向：這些**必須不要**噴錯，否則全站每一頁都會開始誤報 ----
    dict(file=F, expect='[LEAK]', negative=True,
         why='Chinese nested inside a data-i18n element (<strong>) is legitimate',
         find='<p class="lead" data-i18n="s1lead">一條巧克力',
         replace='<p class="lead" data-i18n="s1lead"><strong>巢狀的中文</strong>一條巧克力'),
    dict(file=F, expect='[LEAK]', negative=True,
         why='<title> is set by JS, so its Chinese is an intentional exception',
         find='<title>教我分數 — 分數變身工廠</title>',
         replace='<title>教我分數 — 另一個中文標題</title>'),
    dict(file=F, expect='[EN-CJK]', negative=True,
         why="en.btn's '中' is the language-toggle label, whitelisted on every page",
         find="htmlLang:'en', title:'Teach Me Fractions — The Fraction Makeover Workshop', btn:'中',",
         replace="htmlLang:'en', title:'Teach Me Fractions — The Makeover Workshop', btn:'中',"),
]
