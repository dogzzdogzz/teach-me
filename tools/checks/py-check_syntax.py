# -*- coding: utf-8 -*-
"""`tools/check_syntax.py` 的改壞測試。

每一頁都是自足的 inline JS。語法一壞，瀏覽器只會**靜靜地什麼都不做** ——
頁面看起來還在，互動全死，靜態讀檔看不出來。所以這一支要證明它真的抓得到，
而且**不可以**對合法的現代語法誤報（誤報的話大家就會開始忽略它）。
"""
CHECKER = 'tools/check_syntax.py'
MODE = 'rootfiles'
FIXTURES = ['grade-4/math/fraction/index.html', 'grade-4/math/fraction/review.html']
BASELINE_CLEAN = r'--- 0 script\(s\) with syntax errors'

IDX = 'grade-4/math/fraction/index.html'

BREAKS = [
    dict(file=IDX, expect='[SYNTAX]',
         find='  function isProper(n, d){ return n < d; }',
         replace='  function isProper(n, d){ return n < ; }'),
    dict(file=IDX, expect='[SYNTAX]',
         find="  function kindOf(n, d){ return isProper(n, d) ? 'proper' : 'improper'; }",
         replace="  function kindOf(n, d){ return isProper(n, d) ? 'proper' : 'improper'; "),
    dict(file=IDX, expect='[SYNTAX]', negative=True,
         why='valid modern syntax (arrow function, template literal) must not be flagged',
         find='  function isProper(n, d){ return n < d; }',
         replace='  var _probe = (a, b) => `${a}/${b}`;\n  function isProper(n, d){ return n < d; }'),
]
