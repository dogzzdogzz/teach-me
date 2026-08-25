#!/usr/bin/env python3
"""課程清單一致性檢查。

首頁與年級頁的「N 堂課」現在都是算出來的，不再手動更新數字（2026-08-25）：
  - 年級頁的 {N}  = 該頁自己的 .lesson 課程卡數量
  - 首頁徽章／{N5} = lessons.js 裡的 slug 數量

所以只剩兩件事會讓數字錯掉，這支腳本就是盯這兩件事：
  1. lessons.js 跟磁碟上實際的課程資料夾對不上（新增課程忘了登記）
  2. 年級頁的課程卡數量跟實際課程數對不上（登記了卻忘了加卡片，或反過來）

用法：
    python3 tools/check_lessons.py [repo根目錄]

離開碼 0 = 乾淨；1 = 有問題（每一筆都印出來）。
"""

import os
import re
import sys
import io

GRADES = [1, 2, 3, 4, 5, 6]


def lessons_from_disk(root):
    """磁碟才是真相：grade-N/math/<slug>/index.html 存在才算一堂課。"""
    out = {}
    for g in GRADES:
        d = os.path.join(root, 'grade-%d' % g, 'math')
        slugs = []
        if os.path.isdir(d):
            for name in sorted(os.listdir(d)):
                if os.path.isfile(os.path.join(d, name, 'index.html')):
                    slugs.append(name)
        out[g] = slugs
    return out


def lessons_from_js(root):
    """從 lessons.js 讀出登記的清單。刻意用最笨的解析 —— 檔案格式就是固定的。"""
    path = os.path.join(root, 'lessons.js')
    if not os.path.isfile(path):
        return None, ['lessons.js 不存在（首頁徽章會整個藏起來）']
    src = io.open(path, encoding='utf-8').read()
    out, problems = {}, []
    for g in GRADES:
        m = re.search(r'(?<![0-9])%d\s*:\s*\[' % g, src)
        if not m:
            problems.append('lessons.js 裡沒有 grade %d 的項目' % g)
            out[g] = []
            continue
        # 不能用 \[(.*?)\] —— slug 裡若有 ']' 會提早收尾，變成假的不一致。
        # 從 '[' 往後掃，只有「引號外面」的 ']' 才算結束。
        i, depth, in_str, body = m.end(), 1, None, []
        while i < len(src) and depth:
            ch = src[i]
            if in_str:
                if ch == in_str:
                    in_str = None
                body.append(ch)
            elif ch in "'\"":
                in_str = ch
                body.append(ch)
            elif ch == '[':
                depth += 1; body.append(ch)
            elif ch == ']':
                depth -= 1
                if depth:
                    body.append(ch)
            else:
                body.append(ch)
            i += 1
        if depth:
            problems.append('lessons.js 的 grade %d 陣列沒有收尾' % g)
            out[g] = []
            continue
        out[g] = re.findall(r"'([^']*)'", ''.join(body))
    return out, problems


def cards_on_grade_page(root, g):
    """年級頁上實際畫出來的課程卡數量（{N} 就是這個數）。"""
    path = os.path.join(root, 'grade-%d' % g, 'index.html')
    if not os.path.isfile(path):
        return None
    src = io.open(path, encoding='utf-8').read()
    return len(re.findall(r'<div class="lesson">', src))


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else '.'
    problems = []

    disk = lessons_from_disk(root)
    js, js_problems = lessons_from_js(root)
    problems.extend('[LESSONS] ' + p for p in js_problems)

    if js is not None:
        for g in GRADES:
            # 重複登記同一個 slug 兩次，兩邊的「有沒有」都成立，但 len() 會多算，
            # 首頁徽章就會顯示錯的堂數 —— 所以要另外查重，不能只查集合成員。
            seen = set()
            for s_ in js[g]:
                if s_ in seen:
                    problems.append('[DUPLICATE] lessons.js 的 grade %d 重複登記了 %s'
                                    ' —— 首頁的堂數會多算' % (g, s_))
                seen.add(s_)
            if len(js[g]) != len(disk[g]):
                problems.append('[COUNT] lessons.js 的 grade %d 有 %d 筆，磁碟上有 %d 堂課'
                                ' —— 首頁徽章會顯示 %d'
                                % (g, len(js[g]), len(disk[g]), len(js[g])))
            missing = [s for s in disk[g] if s not in js[g]]
            extra = [s for s in js[g] if s not in disk[g]]
            for s in missing:
                problems.append('[UNREGISTERED] grade-%d/math/%s 存在，但 lessons.js 沒有登記'
                                ' —— 首頁的堂數會少算' % (g, s))
            for s in extra:
                problems.append('[GHOST] lessons.js 登記了 grade %d 的 %s，磁碟上卻沒有'
                                ' —— 首頁的堂數會多算' % (g, s))

    for g in GRADES:
        n_cards = cards_on_grade_page(root, g)
        if n_cards is None:
            problems.append('[NOPAGE] grade-%d/index.html 不存在' % g)
        elif n_cards != len(disk[g]):
            problems.append('[CARDS] grade-%d/index.html 有 %d 張課程卡，實際有 %d 堂課'
                            ' —— 該頁的 {N} 會顯示 %d'
                            % (g, n_cards, len(disk[g]), n_cards))

    # 寫死的堂數是這整套機制要消滅的東西 —— 有人寫回去就報錯。
    # （2026-08-25 Tony 回報：首頁二年級長期停在「1 堂課開課中」，實際已有 2 堂。）
    # 原本只抓 'N lessons live'，漏掉 'N lessons — every unit…' 這種寫法。
    # 這七頁上任何「數字 + 堂課 / lesson(s)」都是堂數，一律視為寫死。
    HARDCODED = re.compile(r'\d+\s*堂課|\d+\s*lessons?\b|Grade\s*5\s*has\s*\d+')
    COMMENT = re.compile(r'<!--.*?-->', re.S)
    pages = [os.path.join(root, 'index.html')]
    pages += [os.path.join(root, 'grade-%d' % g, 'index.html') for g in GRADES]
    for page in pages:
        if not os.path.isfile(page):
            continue
        src = io.open(page, encoding='utf-8').read()
        # 註解裡寫「9 堂課」不會顯示給任何人，不算缺陷 —— 用等長空白蓋掉，行號才不會跑掉。
        src = COMMENT.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), src)
        for m in HARDCODED.finditer(src):
            line = src.count('\n', 0, m.start()) + 1
            problems.append('[HARDCODED] %s:%d 寫死了堂數 %r —— 請改用 {N} 或 {N5}'
                            % (os.path.relpath(page, root), line, m.group(0)))

    # 每一堂課都要是完整四頁
    for g in GRADES:
        for slug in disk[g]:
            for page in ('index.html', 'reference.html', 'review.html', 'parents.html'):
                p = os.path.join(root, 'grade-%d' % g, 'math', slug, page)
                if not os.path.isfile(p):
                    problems.append('[INCOMPLETE] grade-%d/math/%s 缺少 %s' % (g, slug, page))

    for p in problems:
        print(p)
    total = sum(len(v) for v in disk.values())
    print('--- %d problem(s); %d lesson(s) on disk (%s)'
          % (len(problems), total,
             ' / '.join('g%d:%d' % (g, len(disk[g])) for g in GRADES)))
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
