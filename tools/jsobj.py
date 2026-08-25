"""Minimal JS-object utilities: locate a balanced {...} and list depth-1 keys."""
import re

def balanced(src, start):
    """start = index of the opening '{'. Returns (text, end_index_exclusive)."""
    assert src[start] in '{[('
    i = start
    depth = 0
    n = len(src)
    while i < n:
        c = src[i]
        if c in '"\'':
            q = c; i += 1
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == q: break
                i += 1
        elif c == '`':
            i += 1
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == '`': break
                i += 1
        elif c == '/' and i + 1 < n and src[i+1] == '/':
            while i < n and src[i] != '\n': i += 1
            continue
        elif c == '/' and i + 1 < n and src[i+1] == '*':
            j = src.find('*/', i + 2)
            i = (j + 1) if j != -1 else n
        elif c in '{[(':
            depth += 1
        elif c in '}])':
            depth -= 1
            if depth == 0:
                return src[start:i+1], i + 1
        i += 1
    raise ValueError('unbalanced at %d' % start)

KEYRE = re.compile(r'''(?:^|[{,]\s*)(?:(["'])([^"'\\]+)\1|([A-Za-z_$][\w$]*))\s*:''')

def depth1_keys(objtext):
    """Keys at depth 1 of a JS object literal text (starts with '{')."""
    keys = []
    i = 1
    n = len(objtext)
    depth = 0
    seg_start = 1
    # walk, tracking depth; collect key tokens only when depth==0 (relative to obj body)
    while i < n:
        c = objtext[i]
        if c in '"\'':
            q = c; i += 1
            while i < n:
                if objtext[i] == '\\': i += 2; continue
                if objtext[i] == q: break
                i += 1
            i += 1
            continue
        if c == '`':
            i += 1
            while i < n:
                if objtext[i] == '\\': i += 2; continue
                if objtext[i] == '`': break
                i += 1
            i += 1
            continue
        if c == '/' and i+1 < n and objtext[i+1] == '/':
            while i < n and objtext[i] != '\n': i += 1
            continue
        if c == '/' and i+1 < n and objtext[i+1] == '*':
            j = objtext.find('*/', i+2); i = (j+2) if j != -1 else n
            continue
        if c in '{[(':
            depth += 1
        elif c in '}])':
            depth -= 1
        elif c == ':' and depth == 0:
            # backtrack for key token
            j = i - 1
            while j >= 0 and objtext[j] in ' \t\r\n': j -= 1
            if j >= 0 and objtext[j] in '"\'':
                q = objtext[j]; k = j - 1
                while k >= 0 and objtext[k] != q: k -= 1
                keys.append(objtext[k+1:j])
            else:
                e = j + 1
                while j >= 0 and (objtext[j].isalnum() or objtext[j] in '_$'): j -= 1
                tok = objtext[j+1:e]
                if tok: keys.append(tok)
        i += 1
    return keys

def find_obj(src, name):
    """Find `name = {`, `name: {`, `"name": {` and return the balanced object text."""
    for m in re.finditer(re.escape(name), src):
        a, b = m.start(), m.end()
        # left boundary
        if a > 0 and (src[a-1].isalnum() or src[a-1] in '_$'):
            continue
        j = b
        if j < len(src) and src[j] in '"\'':
            j += 1
        while j < len(src) and src[j] in ' \t\r\n':
            j += 1
        if j >= len(src) or src[j] not in ':=':
            continue
        j += 1
        while j < len(src) and src[j] in ' \t\r\n':
            j += 1
        if j < len(src) and src[j] == '{':
            return balanced(src, j)[0]
    return None
