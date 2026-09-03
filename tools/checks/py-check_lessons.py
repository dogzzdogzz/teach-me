# -*- coding: utf-8 -*-
"""`tools/check_lessons.py` 的改壞測試。

這一支盯的是「堂數會不會漂移」：`lessons.js` 對不上磁碟、年級頁的課程卡數對不上、
或有人把堂數**寫死**回頁面裡。起因是首頁二年級長期停在「1 堂課開課中」，
實際已經有 2 堂 —— 那種錯不會讓任何頁面壞掉，只是一直在對讀者說謊。
"""
CHECKER = 'tools/check_lessons.py'
MODE = 'root'
FIXTURES = []
BASELINE_CLEAN = r'--- 0 problem\(s\)'

BREAKS = [
    # 磁碟上有、lessons.js 沒登記（＝新課忘了登記，這一輪差點就發生）
    # ⚠️ 這兩筆把 lessons.js 的四年級那一行整行寫死。**每次新增四年級的課都要更新**——
    #    不更新的話會噴 SETUP-FAIL（find 找不到），這是刻意的：
    #    斷言失去保護對象的時候要大聲壞掉，不可以安靜地變成永遠通過。
    dict(file='lessons.js', expect='[UNREGISTERED]',
         find="  4: ['angle', 'angle-shape', 'area', 'chart', 'congruent', 'decimal', 'figurate', 'fraction', 'multiply-divide', 'numbers', 'pattern', 'quadrilateral', 'rounding', 'time', 'triangle'],",
         replace="  4: ['angle', 'area', 'numbers', 'rounding', 'time'],"),
    # lessons.js 登記了、磁碟上沒有
    dict(file='lessons.js', expect='[GHOST]',
         find="  4: ['angle', 'angle-shape', 'area', 'chart', 'congruent', 'decimal', 'figurate', 'fraction', 'multiply-divide', 'numbers', 'pattern', 'quadrilateral', 'rounding', 'time', 'triangle'],",
         replace="  4: ['angle', 'angle-shape', 'area', 'chart', 'congruent', 'decimal', 'figurate', 'fraction', 'ghost-lesson', 'multiply-divide', 'numbers', 'pattern', 'quadrilateral', 'rounding', 'time', 'triangle'],"),
    # 年級頁的課程卡數對不上實際堂數
    dict(file='grade-4/index.html', expect='[CARDS]',
         find='      <div class="lesson"><span class="badge">🍫</span>',
         replace='      <div class="lessonX"><span class="badge">🍫</span>'),
    # 有人把堂數寫死回頁面裡，而不是用 {N}
    dict(file='grade-4/index.html', expect='[HARDCODED]',
         find='"sub": "已經有 {N} 堂課了！',
         replace='"sub": "已經有 6 堂課了！'),
]
