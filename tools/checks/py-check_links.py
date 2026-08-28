# -*- coding: utf-8 -*-
"""`tools/check_links.py` 的改壞測試。

兩條規則：站內連結要指得到東西，以及**孩子看的三頁（index／reference／review）
不可以有任何站外網址**（framework §六之一）。第二條在 2026-08-26 之前
「寫在規範裡但沒有任何檢查在盯」，所以它的反向那一半特別重要 ——
`parents.html` 是全站唯一可以放站外連結的頁（§六之四），誤報它等於擋掉延伸資源。
"""
CHECKER = 'tools/check_links.py'
MODE = 'root'
FIXTURES = []
BASELINE_CLEAN = r'--- 0 broken link\(s\)'

IDX = 'grade-4/math/fraction/index.html'
REF = 'grade-4/math/fraction/reference.html'
REV = 'grade-4/math/fraction/review.html'
PAR = 'grade-4/math/fraction/parents.html'

BREAKS = [
    # ---- 站內連結指不到東西 ----
    dict(file=IDX, expect='[LINK]',
         find='<a href="reference.html" data-i18n="nav2">',
         replace='<a href="reference-does-not-exist.html" data-i18n="nav2">'),

    # ---- 孩子看的三頁出現站外網址 ----
    dict(file=REV, expect='[EXTERNAL]',
         find='  <div id="quiz" class="quiz"></div>',
         replace='  <p><a href="https://www.youtube.com/watch?v=xyz">影片</a></p>\n  <div id="quiz" class="quiz"></div>'),
    # 大寫標籤：用正規式讀 HTML 最常見的 fail-open
    dict(file=REF, expect='[EXTERNAL]',
         find='  <button class="printbtn"',
         replace='  <A HREF="https://example.com/leak">x</A>\n  <button class="printbtn"'),
    # 協定相對的 //host 一樣是離開本站
    dict(file=IDX, expect='[EXTERNAL]',
         find='  <footer data-i18n="footer">',
         replace='  <img src="//cdn.example.com/tracker.gif">\n  <footer data-i18n="footer">'),
    # 非 http(s) 的協定也算（規則是「不可以離開本站」，不是「不可以有 http」）
    dict(file=REV, expect='[EXTERNAL]',
         find='  <footer data-i18n="foot">',
         replace='  <p><a href="ftp://files.example.com/x">x</a></p>\n  <footer data-i18n="foot">'),

    # ---- 反向：必須不要噴 ----
    dict(file=PAR, expect='[EXTERNAL]', negative=True,
         why='parents.html is the one page allowed to carry off-site links (六之四)',
         find='    <p class="resnote" data-i18n="s6note">',
         replace='    <p><a href="https://example.org/extra" target="_blank" rel="noopener noreferrer">x</a></p>\n    <p class="resnote" data-i18n="s6note">'),
    dict(file=IDX, expect='[EXTERNAL]', negative=True,
         why='mailto:/tel:/data: never leave this origin, so they stay allowed',
         find='  <footer data-i18n="footer">',
         replace='  <p><a href="mailto:someone@example.com">x</a></p>\n  <footer data-i18n="footer">'),
]
