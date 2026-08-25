#!/usr/bin/env python3
"""Structural check for parents.html pages (teaching-framework 六之一 五段格式).
Objective stand-in for the fresh-reader test: does the page actually answer the
five questions a parent came for?"""
import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsobj import find_obj

def check(path):
    s = open(path, encoding='utf-8').read()
    out = []
    # Pages built from the current template carry .bignum section numbers. The four
    # grade-5 pages written before that template are hand-keyed, so only the universal
    # checks apply to them (reported as NOTE, not failure).
    templated = 'class="bignum"' in s
    i18n = find_obj(s, 'I18N')
    zh, en = find_obj(i18n, 'zh'), find_obj(i18n, 'en')
    def val(d, k):
        m = re.search(r'"' + k + r'"\s*:\s*"((?:\\.|[^"\\])*)"', d) or \
            re.search(r"\b" + k + r"\s*:\s*'((?:\\.|[^'\\])*)'", d)
        return m.group(1) if m else None
    # 1. five numbered sections present in markup
    # heading keys vary per page (s1 / s1h / s1title ...) — accept any of them
    for num in '12345':
        if not re.search(r'data-i18n="s' + num + r'[a-zA-Z0-9]*"', s):
            out.append(f'missing section {num}')
    if not templated:
        out.append('NOTE: predates the shared template (hand-keyed); only universal checks applied')
        return out
    # 2. section 1 must name the curriculum unit and flag the adult misconception
    s1p1, s1p2 = val(zh, 's1p1'), val(zh, 's1p2')
    if not s1p1 or '課綱' not in s1p1:
        out.append('s1p1 does not name the curriculum unit (課綱)')
    if not s1p2 or '大人最容易誤解' not in s1p2:
        out.append('s1p2 missing the "adult misconception" line')
    # 3. four observable behaviours, non-trivial length
    for k in ('b1','b2','b3','b4'):
        v = val(zh, k)
        if not v: out.append(f'{k} missing')
        elif len(v) < 12: out.append(f'{k} too short to be checkable')
    # 4. three home activities with icon + title + body
    for t, p in (('h1t','h1p'), ('h2t','h2p'), ('h3t','h3p')):
        if not val(zh, t) or not val(zh, p): out.append(f'home activity {t}/{p} incomplete')
    if s.count('class="hicon"') != 3:
        out.append('expected 3 home-activity cards, found %d' % s.count('class="hicon"'))
    # 5. three misconceptions, each with a script a parent can read aloud
    for mis, say in (('mis1','say1'), ('mis2','say2'), ('mis3','say3')):
        mv, sv = val(zh, mis), val(zh, say)
        if not mv or not sv:
            out.append(f'{mis}/{say} incomplete'); continue
        if not re.search(r'[「“]', sv):
            out.append(f'{say} has no quoted sentence for the parent to say')
    # 6. mastery bar names the game and the 2/3 threshold
    rb = val(zh, 'readyBox') or ''
    if '2/3' not in rb: out.append('readyBox missing the 2/3 mastery threshold')
    if '小遊戲「' not in rb: out.append('readyBox does not name the game')
    rben = val(en, 'readyBox') or ''
    if 'game' not in rben.lower(): out.append('en readyBox does not name the game')
    # 7. four nav entries, this page marked as current
    if s.count('data-i18n="nav') < 4: out.append('coursenav has fewer than 4 entries')
    if 'data-i18n="nav4">👨' not in s or '<span data-i18n="nav4"' not in s:
        out.append('nav4 is not the current-page marker on this page')
    # 8. printable + adult-facing framing
    if '@media print' not in s: out.append('not printable (no @media print)')
    if 'window.print()' not in s: out.append('no print button')
    if '大人' not in (val(zh,'sub') or ''): out.append('sub does not state the page is for adults')
    # 9. no interaction beyond the language toggle and print
    handlers = re.findall(r"addEventListener\('(\w+)'", s)
    if [h for h in handlers if h != 'click']: out.append('unexpected event handlers: %s' % set(handlers))
    if len([h for h in handlers if h == 'click']) > 1:
        out.append('more than one click handler (should be language toggle only)')
    return out

if __name__ == '__main__':
    tot = 0
    for p in sys.argv[1:]:
        for msg in check(p):
            print(f'[PARENTS] {p}: {msg}'); tot += 1
    print(f'--- {tot} problem(s) in {len(sys.argv)-1} page(s)')
