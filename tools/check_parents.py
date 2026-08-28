#!/usr/bin/env python3
"""Structural check for parents.html pages (teaching-framework 六之一 五段格式).
Objective stand-in for the fresh-reader test: does the page actually answer the
five questions a parent came for?"""
import sys, re, os
from html.parser import HTMLParser
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jsobj import find_obj

CJK = re.compile('[㐀-鿿豈-﫿　-〿＀-￯]')

# teaching-framework 六之四: r1 and r4 are mandatory and pinned to a host; r2 (Khan) and
# r3 (Numberblocks) are optional because not every lesson has an honest match — 4 pages
# have no Khan unit and 50 have no Numberblocks episode. Optional does NOT mean
# unvalidated: any row that IS present must be one of these, and EVERY anchor in that
# row (including one inside the description) must sit on that row's allowlisted host.
ROW_HOSTS = {'r1': {'junyiacademy.org'},
             'r2': {'khanacademy.org'},
             'r3': {'youtube.com', 'youtu.be'},
             'r4': {'tcool.cc'}}
REQUIRED_ROWS = ('r1', 'r4')


def unescape_js(v):
    r"""Turn \uXXXX, \u{...} and \xNN escapes into real characters.

    Two traps this deliberately avoids:
      * codecs 'unicode_escape' round-trips through latin-1 and DROPS real CJK, which
        would make the check it feeds fail open (found in review round 2);
      * an escaped backslash (\\u4e2d) is literal text, not an escape, so parity of the
        preceding backslashes decides whether we convert (review round 3).
    """
    def sub(m):
        slashes, body = m.group(1), m.group(2)
        if len(slashes) % 2 == 0:          # \\u4e2d — the backslash is escaped
            return m.group(0)
        if body.startswith('u{'):
            cp = int(body[2:-1], 16)
        elif body[0] == 'u':
            cp = int(body[1:], 16)
        else:
            cp = int(body[1:], 16)
        try:
            return slashes[:-1] + chr(cp)
        except ValueError:
            return m.group(0)
    v = re.sub(r'(\\+)(u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})', sub, v)
    # combine surrogate pairs produced by 😀 style escapes
    return re.sub(r'[\ud800-\udbff][\udc00-\udfff]',
                  lambda m: chr((ord(m.group(0)[0]) - 0xD800) * 0x400
                                + ord(m.group(0)[1]) - 0xDC00 + 0x10000), v)


class _ResBlock(HTMLParser):
    """Structural reader for <div class="resblock">.

    An HTML parser rather than regexes because regexes over markup kept failing open:
    uppercase <A>, attribute-looking text inside a quoted value, and a whole fake block
    inside an HTML comment all defeated the previous version. Comments never reach
    handle_starttag, so they cannot satisfy anything here.
    """

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.blocks = []          # one entry per resblock found
        self.b = None             # current block
        self.depth = 0            # div depth inside the block
        self.in_ul = False
        self.row = None
        self.problems = []

    def handle_starttag(self, tag, attrs):
        a = {}
        for k, v in attrs:                      # HTMLParser lowercases names for us
            k = k.lower()
            if k in a:
                if self.b is not None:
                    self.problems.append('延伸資源 tag repeats the %s attribute' % k)
            a[k] = v if v is not None else ''
        if tag == 'div' and a.get('class') == 'resblock' and self.b is None:
            self.b = {'headings': [], 'paras': [], 'rows': [], 'stray_anchors': 0,
                      'nested_div': False, 'ul': False}
            self.depth = 1
            self.blocks.append(self.b)
            return
        if self.b is None:
            return
        if tag == 'div':
            self.depth += 1
            self.b['nested_div'] = True
        elif tag == 'h2':
            self.b['headings'].append(None)
        elif tag == 'span':
            k = a.get('data-i18n')
            if self.b['headings'] and self.b['headings'][-1] is None and k:
                self.b['headings'][-1] = k
            if self.row is not None and 'rdesc' in (a.get('class') or ''):
                self.row['desc'] = k
        elif tag == 'p':
            self.b['paras'].append(a.get('data-i18n'))
        elif tag == 'ul' and a.get('class') == 'reslist':
            self.in_ul = True
            self.b['ul'] = True
        elif tag == 'li' and self.in_ul:
            self.row = {'anchors': [], 'desc': None}
            self.b['rows'].append(self.row)
        elif tag == 'a':
            if self.row is not None:
                self.row['anchors'].append(a)
            elif self.in_ul:
                self.b['stray_anchors'] += 1

    def handle_endtag(self, tag):
        if self.b is None:
            return
        if tag == 'div':
            self.depth -= 1
            if self.depth == 0:
                self.b = None
                self.in_ul = False
                self.row = None
        elif tag == 'ul':
            self.in_ul = False
        elif tag == 'li':
            self.row = None


def _host(url):
    from urllib.parse import urlparse
    try:
        h = (urlparse(url).hostname or '').lower()
    except Exception:
        return None
    return h[4:] if h.startswith('www.') else h


def check_resources(s, zh, en, val):
    """teaching-framework 六之四: the parents-only external resources block."""
    pr = _ResBlock()
    try:
        pr.feed(s)
    except Exception as e:                       # never pass because parsing blew up
        return ['延伸資源 block could not be parsed: %s' % e]
    if not pr.blocks:
        if re.search(r'data-i18n=["\']s6["\']', s):
            return ['延伸資源 keys exist but there is no <div class="resblock"> container '
                    '(六之四: the block is one self-contained container)']
        return ['missing the 延伸資源 block (六之四) — every parents.html must carry one']
    if len(pr.blocks) != 1:
        return ['expected exactly one <div class="resblock">, found %d' % len(pr.blocks)]
    b = pr.blocks[0]
    out = list(pr.problems)
    if b['nested_div']:
        out.append('延伸資源 container has a nested <div>; the block must be flat')
    if 's6' not in [h for h in b['headings']]:
        out.append('延伸資源 has no bound heading (s6)')
    if 's6p1' not in b['paras']:
        out.append('延伸資源 has no bound intro paragraph (s6p1)')
    if 's6note' not in b['paras']:
        out.append('延伸資源 has no bound note (s6note)')
    if not b['ul']:
        return out + ['延伸資源 block has no <ul class="reslist">']
    if b['stray_anchors']:
        out.append('延伸資源 list has %d anchor(s) outside any <li>' % b['stray_anchors'])
    if len(b['rows']) < 2:
        out.append('延伸資源 has only %d row(s); expected at least 2' % len(b['rows']))

    seen = []
    for row in b['rows']:
        keyed = [a for a in row['anchors']
                 if re.fullmatch(r'r\dt', a.get('data-i18n', '') or '')]
        if len(keyed) != 1:
            out.append('延伸資源 row must have exactly one anchor bound to an r<N>t key '
                       '(found %d)' % len(keyed))
            continue
        key = keyed[0]['data-i18n'][:-1]
        if key in seen:
            out.append('%s appears more than once' % key)
        seen.append(key)
        if key not in ROW_HOSTS:
            out.append('%s is not a known row (expected one of %s)' % (key, sorted(ROW_HOSTS)))
        if not row['desc']:
            out.append('%s: row has no bound .rdesc description' % key)
        elif row['desc'] != key + 'd':
            out.append('%st is paired with %s — title and description must carry the '
                       'same row number' % (key, row['desc']))
        for a in row['anchors']:
            u = a.get('href', '') or ''
            if not u.startswith('https://'):
                out.append('%s: anchor href %r is not an absolute https URL' % (key, u[:40]))
                continue
            rel = set((a.get('rel') or '').split())
            if 'noopener' not in rel or 'noreferrer' not in rel:
                out.append('%s: %s rel must contain the tokens noopener and noreferrer'
                           % (key, u[:44]))
            if a.get('target') != '_blank':
                out.append('%s: %s missing target="_blank"' % (key, u[:44]))
            h = _host(u)
            if key in ROW_HOSTS and h not in ROW_HOSTS[key]:
                out.append('%s links to %r; every anchor in this row must be on %s'
                           % (key, h, sorted(ROW_HOSTS[key])))
    for req in REQUIRED_ROWS:
        if req not in seen:
            out.append('延伸資源 is missing the mandatory %s row (%s)'
                       % (req, sorted(ROW_HOSTS[req])[0]))
    if seen != sorted(seen):
        out.append('延伸資源 rows are out of order: %s (六之四 fixes the order r1→r4)' % seen)

    for k in [x + suf for x in seen for suf in ('t', 'd')] + ['s6', 's6p1', 's6note']:
        zv, ev = val(zh, k), val(en, k)
        if zv is None:
            out.append('%s missing from the zh dictionary' % k)
        if ev is None:
            out.append('%s missing from the en dictionary' % k)
        else:
            hit = CJK.search(unescape_js(ev))
            if hit:
                out.append('%s: en value contains Chinese (%s)' % (k, hit.group(0)))
    note_zh, note_en = unescape_js(val(zh, 's6note') or ''), unescape_js(val(en, 's6note') or '')
    dz = re.search(r'連結最後檢查：(\d{4}-\d{2}-\d{2})', note_zh)
    de = re.search(r'[Ll]inks last checked (\d{4}-\d{2}-\d{2})', note_en)
    for tag, hit in (('zh', dz), ('en', de)):
        if not hit:
            out.append('s6note (%s) must state the last-checked date (YYYY-MM-DD)' % tag)
        else:
            try:
                from datetime import date
                date(*(int(x) for x in hit.group(1).split('-')))
            except ValueError:
                out.append('s6note (%s) date %r is not a real calendar date' % (tag, hit.group(1)))
    if dz and de and dz.group(1) != de.group(1):
        out.append('s6note dates disagree: zh %s vs en %s' % (dz.group(1), de.group(1)))
    if '不在本站控制範圍' not in note_zh:
        out.append('s6note (zh) must state that third-party content/ads are outside this site’s control')
    if 'outside this site' not in note_en:
        out.append('s6note (en) must state that third-party content/ads are outside this site’s control')
    return out


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
    # 1b. resources block (teaching-framework 六之四) — applies to EVERY page, templated
    # or not, so this runs before the hand-keyed early return below.
    out += check_resources(s, zh, en, val)
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
    sys.exit(1 if tot else 0)
