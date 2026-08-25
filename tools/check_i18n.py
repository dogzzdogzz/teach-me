#!/usr/bin/env python3
"""Checks 1,2,4: data-i18n key binding, CJK leak outside data-i18n, CJK inside I18N.en."""
import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsobj import find_obj, depth1_keys, balanced
from html.parser import HTMLParser

CJK = re.compile(r'[㐀-䶿一-鿿豈-﫿]')  # Han only
VOID = {'br','img','hr','input','meta','link','source','path','circle','rect','line',
        'polygon','polyline','ellipse','use','stop','area','base','col','embed','track','wbr'}

class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # list of (tag, has_i18n)
        self.keys = []           # (key, kind, line)
        self.leaks = []          # (line, text)
        self.skip = 0
    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        has = ('data-i18n' in d)
        if 'data-i18n' in d: self.keys.append((d['data-i18n'],'data-i18n',self.getpos()[0]))
        if 'data-i18n-aria' in d: self.keys.append((d['data-i18n-aria'],'data-i18n-aria',self.getpos()[0]))
        if tag in ('script','style','title'): self.skip += 1
        if tag not in VOID:
            self.stack.append((tag, has))
    def handle_startendtag(self, tag, attrs):
        d = dict(attrs)
        if 'data-i18n' in d: self.keys.append((d['data-i18n'],'data-i18n',self.getpos()[0]))
        if 'data-i18n-aria' in d: self.keys.append((d['data-i18n-aria'],'data-i18n-aria',self.getpos()[0]))
    def handle_endtag(self, tag):
        if tag in ('script','style','title') and self.skip: self.skip -= 1
        if tag in VOID: return
        for i in range(len(self.stack)-1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return
    def handle_data(self, data):
        if self.skip: return
        if not CJK.search(data): return
        if any(h for _, h in self.stack): return
        t = data.strip()
        if t: self.leaks.append((self.getpos()[0], t[:60]))

def check(path):
    src = open(path, encoding='utf-8').read()
    problems = []
    p = Scan(); p.feed(src)
    i18n = find_obj(src, 'I18N')
    if not i18n:
        return [('NO-I18N', path + ' no I18N object found')]
    zh = find_obj(i18n, 'zh'); en = find_obj(i18n, 'en')
    if not zh or not en:
        return [('NO-DICT', path + ' missing zh or en dict')]
    zk, ek = set(depth1_keys(zh)), set(depth1_keys(en))
    for k, kind, ln in p.keys:
        miss = [n for n, s in (('zh',zk),('en',ek)) if k not in s]
        if miss:
            problems.append(('BIND', f'{path}:{ln} {kind}="{k}" missing from {"+".join(miss)}'))
    for ln, t in p.leaks:
        problems.append(('LEAK', f'{path}:{ln} {t}'))
    # key-parity
    for k in sorted(zk - ek): problems.append(('PARITY', f'{path} key {k} in zh only'))
    for k in sorted(ek - zk): problems.append(('PARITY', f'{path} key {k} in en only'))
    # CJK in en dict (skip btn:'中')
    for m in re.finditer(r'''(?:^|[{,]\s*)(?:(["'])([\w$]+)\1|([A-Za-z_$][\w$]*))\s*:''', en):
        pass
    # crude: scan string literals in en for CJK
    for sm in re.finditer(r'''(['"])((?:\\.|(?!\1)[^\\])*)\1''', en):
        s = sm.group(2)
        if CJK.search(s) and s != '中':
            line = en[:sm.start()].count('\n') + src[:src.index(en)].count('\n') + 1
            problems.append(('EN-CJK', f'{path}:~{line} en dict contains {s[:40]!r}'))
    return problems

if __name__ == '__main__':
    tot = 0
    for path in sys.argv[1:]:
        for kind, msg in check(path):
            print(f'[{kind}] {msg}'); tot += 1
    print(f'--- {tot} problem(s) in {len(sys.argv)-1} file(s)')
    sys.exit(1 if tot else 0)
