#!/usr/bin/env python3
"""Checks 3 + Chinese-bank structure: bank sizes (6/4/2), option counts,
zh/en `ans` index parity, and equal-value options (rational compare WITH units),
across quiz banks and game ROUNDS."""
import sys, re, os
from fractions import Fraction
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsobj import find_obj, balanced

STRRE = re.compile(r'''(['"])((?:\\.|(?!\1)[^\\])*)\1''')
# ⚠️ 符號的字元集要寫成 [+\-−]：`[+-−]` 會被當成 '+'(U+002B) 到 '−'(U+2212) 的**範圍**，
# 那個範圍把 0~9 全部包進去了 —— '13/5' 會被讀成「符號 1、分數 3/5」，
# 於是 13/5 和 23/5 被判成同一個值（假警報），而真正等值的兩位數選項反而驗不到。
# 帶分數有兩種寫法：中文「1 又 2/5」、英文「1 2/5」（用空白隔開）。
# 少了英文那一種，`1 2/4` 和 `1 1/2` 會被當成「整數 1、單位不同」而**驗不出等值**。
NUM = re.compile(
    r'^([+\-−]?)(\d+)\s*又\s*(\d+)\s*/\s*(\d+)'          # 1 又 2/5
    r'|^([+\-−]?)(\d+)[ \u3000]+(\d+)\s*/\s*(\d+)'          # 1 2/5（英文帶分數）
    r'|^([+\-−]?)(\d+)\s*/\s*(\d+)'                         # 7/5
    r'|^([+\-−]?\d+(?:\.\d+)?)')                             # 3 / 3.5

def norm(s):
    return s.replace('　',' ').replace('−','-').replace('“','"').replace('”','"').strip()

def value_unit(s):
    """Return (Fraction, unit_string) or None."""
    t = norm(s)
    t = re.sub(r'^[約大約]+', '', t)
    m = NUM.match(t)
    if not m: return None
    if m.group(2):     # 中文帶分數 1 又 2/5
        sign = -1 if m.group(1) in ('-', '−') else 1   # 不可以用 in '-−'：'' 也會命中
        if int(m.group(4)) == 0: return None
        v = sign * (Fraction(int(m.group(2))) + Fraction(int(m.group(3)), int(m.group(4))))
    elif m.group(6):   # 英文帶分數 1 2/5
        sign = -1 if m.group(5) in ('-', '−') else 1
        if int(m.group(8)) == 0: return None
        v = sign * (Fraction(int(m.group(6))) + Fraction(int(m.group(7)), int(m.group(8))))
    elif m.group(10):  # 分數 7/5
        sign = -1 if m.group(9) in ('-', '−') else 1
        if int(m.group(11)) == 0: return None
        v = sign * Fraction(int(m.group(10)), int(m.group(11)))
    else:
        v = Fraction(m.group(12).replace('−','-'))
    unit = t[m.end():].strip()
    unit = re.sub(r'\s+', '', unit)
    if unit.startswith('%') or unit.startswith('％'):
        v = v / 100; unit = unit[1:].strip() + '__pct_normalized'
        unit = unit.replace('__pct_normalized','')
    return (v, unit)

def opts_of(entry):
    m = re.search(r'\bopts\s*:\s*\[', entry)
    if not m: return None
    arr, _ = balanced(entry, entry.index('[', m.end()-1))
    if '{' in arr:  # object-valued options (e.g. shape descriptors) - not comparable
        return None
    return [sm.group(2) for sm in STRRE.finditer(arr)]

def ans_of(entry):
    m = re.search(r'\bans\s*:\s*(\d+)', entry)
    return int(m.group(1)) if m else None

def split_entries(arrtext):
    """Split a JS array literal into its top-level {...} element texts."""
    out, i, n = [], 1, len(arrtext)
    while i < n:
        if arrtext[i] == '{':
            t, e = balanced(arrtext, i); out.append(t); i = e
        else:
            i += 1
    return out

def bank(dicttext, name):
    m = re.search(r'\b' + name + r'\s*:\s*\[', dicttext)
    if not m: return None
    arr, _ = balanced(dicttext, dicttext.index('[', m.end()-1))
    return split_entries(arr)

def equal_value_problems(label, opts):
    probs = []
    parsed = [(i, value_unit(o)) for i, o in enumerate(opts)]
    for a in range(len(parsed)):
        for b in range(a+1, len(parsed)):
            ia, va = parsed[a]; ib, vb = parsed[b]
            if va and vb and va == vb:
                probs.append(f'{label}: opts[{ia}]={opts[ia]!r} == opts[{ib}]={opts[ib]!r}')
    return probs

def check(path):
    src = open(path, encoding='utf-8').read()
    out = []
    i18n = find_obj(src, 'I18N')
    if not i18n: return out
    zh, en = find_obj(i18n,'zh'), find_obj(i18n,'en')
    if not zh or not en: return out
    for bname, want in (('qs',6), ('qsAdv',4), ('qsBoost',2)):
        bz, be = bank(zh, bname), bank(en, bname)
        if bz is None and be is None: continue
        if (bz is None) != (be is None):
            out.append(('BANK', f'{path} {bname} present in only one language')); continue
        if len(bz) != len(be):
            out.append(('BANK', f'{path} {bname} zh={len(bz)} en={len(be)}'))
        if 'index.html' in path and len(bz) != want:
            out.append(('BANK', f'{path} {bname} has {len(bz)} entries (spec {want})'))
        for i,(ez, ee) in enumerate(zip(bz, be)):
            oz, oe = opts_of(ez), opts_of(ee)
            az, ae = ans_of(ez), ans_of(ee)
            if oz and oe and len(oz) != len(oe):
                out.append(('OPTLEN', f'{path} {bname}[{i}] zh {len(oz)} opts vs en {len(oe)}'))
            if oz and 'index.html' in path and len(oz) not in (2,3,4):
                out.append(('OPTLEN', f'{path} {bname}[{i}] has {len(oz)} options'))
            if az is not None and ae is not None and az != ae:
                out.append(('ANS', f'{path} {bname}[{i}] ans zh={az} en={ae}'))
            for lab, oo in ((f'{bname}[{i}] zh', oz), (f'{bname}[{i}] en', oe)):
                if oo:
                    for p in equal_value_problems(lab, oo):
                        out.append(('EQVAL', f'{path} {p}'))
    # game ROUNDS / generator static option arrays anywhere in file
    for m in re.finditer(r'\bopts\s*:\s*\[', src):
        arr, _ = balanced(src, src.index('[', m.end()-1))
        if '{' in arr: continue
        opts = [sm.group(2) for sm in STRRE.finditer(arr)]
        if len(opts) < 2: continue
        line = src[:m.start()].count('\n') + 1
        for p in equal_value_problems(f'line {line}', opts):
            out.append(('EQVAL-ANY', f'{path} {p}'))
    return out

if __name__ == '__main__':
    seen = set(); tot = 0
    for path in sys.argv[1:]:
        for kind, msg in check(path):
            key = (kind, msg)
            if key in seen: continue
            seen.add(key); print(f'[{kind}] {msg}'); tot += 1
    print(f'--- {tot} problem(s)')
    sys.exit(1 if tot else 0)
