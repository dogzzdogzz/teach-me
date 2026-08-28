#!/usr/bin/env python3
"""刻意改壞測試 —— 給**共用的 Python 檢查**用的（2026-08-28 起）。

`tools/breaktest.js` 只跑得到 `simgen.js` 與 `verify_lesson_data.js`，也就是
**每一課自己的設定檔**。五支共用的 Python 檢查把關全站 272 頁，卻沒有任何
已進版控的證據證明它們的斷言真的會響。

這不是理論風險：2026-08-28 發現 `check_quiz.py` 的等值檢查壞了很久 ——
`[+-−]` 在字元集裡是 `+`(U+002B) 到 `−`(U+2212) 的**範圍**，把 0~9 全包進去，
於是 `13/5` 被讀成「符號 1、分數 3/5」，而 `'' in '-−'` 是 True，沒有符號時
一律當成負數。**每一次執行都是綠的**，沒有人看得出來。

用法：

    python3 tools/breaktest_checks.py            # 全部
    python3 tools/breaktest_checks.py check_i18n # 只跑一支

紀律和 `breaktest.js` 一樣，一條都不能少：

- **先跑原檔**。原檔沒過、或原檔本來就在噴那一句話，就報 `BASELINE-FAIL`／`NO PROOF`
  —— 不然「改壞之後有錯」可能根本不是改壞造成的。
- `find` 在檔案裡必須**剛好出現一次**，否則 `SETUP-FAIL`（斷言失去保護對象，一樣要修）。
- 比對只認**輸出裡真的出現那一句話**，而且那一句話不可以已經在 baseline 裡。
- **反向改壞**（`negative=True`）：改完之後**必須不噴**那一句 —— 沒有這一半，
  「把檢查寫得越來越嚴」會安靜地開始誤報真實頁面。
"""
import sys, os, re, shutil, subprocess, tempfile, importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG_DIR = os.path.join(ROOT, 'tools', 'checks')
SKIP_DIRS = {'.git', 'teaching-workspace', 'node_modules', '.claude'}


def load_cfg(name):
    path = os.path.join(CFG_DIR, 'py-%s.py' % name)
    if not os.path.isfile(path):
        return None
    spec = importlib.util.spec_from_file_location('cfg_' + name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def build_sandbox(cfg, tmp):
    """三種模式：
       files     —— 只複製 FIXTURES，把複製後的檔案路徑當參數（check_i18n／check_quiz）
       rootfiles —— 只複製 FIXTURES，把沙箱根目錄當參數（check_syntax）
       root      —— 整個 repo 複製一份，根目錄當參數（check_links／check_lessons，
                    它們要走訪整棵樹才判得出連結與堂數）"""
    mode = cfg.MODE
    if mode == 'root':
        for entry in sorted(os.listdir(ROOT)):
            if entry in SKIP_DIRS:
                continue
            src = os.path.join(ROOT, entry)
            dst = os.path.join(tmp, entry)
            if os.path.isdir(src):
                # symlinks=True：預設會把 symlink 解參考成一般檔案，那會改變
                # check_links／check_lessons 對同一棵樹的判斷（目前 repo 沒有
                # symlink，但這條不該靠「剛好沒有」成立）。
                shutil.copytree(src, dst, symlinks=True,
                                ignore=shutil.ignore_patterns(*SKIP_DIRS))
            else:
                shutil.copy2(src, dst)
        return [tmp]

    copied = []
    for rel in cfg.FIXTURES:
        dst = os.path.join(tmp, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dst)
        copied.append(dst)
    return copied if mode == 'files' else [tmp]


def run_checker(cfg, args, cwd):
    """回傳 (輸出, 離開碼, 有沒有 traceback)。

    ⚠️ 三件事都要回傳，缺一不可：
    - **離開碼**：檢查可以把訊息印出來卻回傳 0，那樣腳本呼叫端根本偵測不到失敗
      （2026-08-28 發現六支裡有四支就是這樣）。
    - **traceback**：檢查**當掉**的時候什麼都不會印，於是「反向改壞」會看起來
      像「正確地保持安靜」—— 一支只在某種輸入下當掉的檢查可以拿到滿分。
    - `cwd` 指到沙箱，不是真的 repo：用相對路徑的檢查才不會摸到真檔案。"""
    r = subprocess.run([sys.executable, os.path.join(ROOT, cfg.CHECKER)] + args,
                       capture_output=True, text=True, cwd=cwd)
    out = r.stdout + r.stderr
    crashed = ('Traceback (most recent call last)' in out)
    return out, r.returncode, crashed


def apply_break(tmp, brk):
    """回傳 None 表示成功，否則回傳 SETUP-FAIL 的理由。"""
    # 沙箱圍堵：絕對路徑或 ../ 會改到**真的 repo**。
    rel = brk['file']
    if os.path.isabs(rel) or os.path.normpath(rel).startswith('..'):
        return 'break path %r escapes the sandbox' % rel
    target = os.path.realpath(os.path.join(tmp, rel))
    if os.path.commonpath([os.path.realpath(tmp), target]) != os.path.realpath(tmp):
        return 'break path %r resolves outside the sandbox' % rel
    if not os.path.isfile(target):
        return 'fixture %s is not in the sandbox' % brk['file']
    src = open(target, encoding='utf-8').read()
    n = src.count(brk['find'])
    if n != 1:
        return 'find string occurs %d time(s), expected exactly 1' % n
    open(target, 'w', encoding='utf-8').write(src.replace(brk['find'], brk['replace']))
    return None


def run_config(name, cfg):
    print('\n=== %s (%s) ===' % (name, cfg.CHECKER))

    # ---- baseline：原檔必須乾淨，而且不可以已經在噴我們要證明的那些話 ----
    tmp = tempfile.mkdtemp(prefix='btpy_base_')
    try:
        args = build_sandbox(cfg, tmp)
        baseline, base_rc, base_crash = run_checker(cfg, args, tmp)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if base_crash:
        print('  [CHECKER-CRASH] the unmodified files make the checker throw:')
        for line in baseline.strip().split('\n')[-6:]:
            print('      ' + line)
        return 0, len(cfg.BREAKS)
    # 錨在整行上：`--- 0 problem(s)` 出現在某一行、後面再接一個 traceback，
    # 用沒有錨點的 search 會當成乾淨。
    if cfg.BASELINE_CLEAN and not any(re.match(cfg.BASELINE_CLEAN, ln.strip())
                                      for ln in baseline.split('\n')):
        print('  [BASELINE-FAIL] the unmodified files do not come back clean:')
        for line in baseline.strip().split('\n')[-6:]:
            print('      ' + line)
        return 0, len(cfg.BREAKS)
    if base_rc != 0:
        print('  [BASELINE-FAIL] the unmodified files exit %d; a clean run must exit 0' % base_rc)
        return 0, len(cfg.BREAKS)

    ok = bad = 0
    for i, brk in enumerate(cfg.BREAKS, 1):
        want = brk['expect']
        negative = brk.get('negative', False)
        label = '%s%s' % ('(must NOT fire) ' if negative else '', want)

        if not negative and want in baseline:
            print('  [NO PROOF] break %d: baseline already says %r' % (i, want))
            bad += 1
            continue

        tmp = tempfile.mkdtemp(prefix='btpy_%d_' % i)
        try:
            args = build_sandbox(cfg, tmp)
            why = apply_break(tmp, brk)
            if why:
                print('  [SETUP-FAIL] break %d: %s — %s' % (i, why, label))
                bad += 1
                continue
            out, rc, crashed = run_checker(cfg, args, tmp)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

        # 當掉不算「抓到」，也不算「正確地保持安靜」—— 它自成一類。
        if crashed:
            print('  [CHECKER-CRASH] break %d: the checker threw instead of reporting — %s' % (i, label))
            print('      ' + next((l for l in out.split('\n') if 'Error' in l or 'error' in l), '')[:160])
            bad += 1
            continue

        hit = want in out
        if negative:
            if rc != 0:
                print('  [FALSE ALARM] break %d: checker exited %d on content it should accept — %s'
                      % (i, rc, label))
                bad += 1
                continue
            if hit:
                print('  [FALSE ALARM] break %d: %s — the checker reported it on legitimate content' % (i, label))
                print('      ' + next((l for l in out.split('\n') if want in l), '')[:160])
                bad += 1
            else:
                print('  [ok] break %d: correctly stayed quiet — %s' % (i, brk.get('why', want)))
                ok += 1
        else:
            if hit and rc == 0:
                # 訊息印出來了卻回傳 0：腳本呼叫端偵測不到，等於沒擋住。
                print('  [SILENT PASS] break %d: reported %r but exited 0 — a scripted caller '
                      'cannot tell this run failed' % (i, want))
                bad += 1
            elif hit:
                print('  [ok] break %d: caught (exit %d) — %s' % (i, rc, want))
                ok += 1
            else:
                print('  [NOT CAUGHT] break %d: expected %r — the checker stayed green' % (i, want))
                bad += 1
    return ok, bad


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    names = [only] if only else [
        'check_i18n', 'check_quiz', 'check_parents', 'check_links',
        'check_lessons', 'check_syntax']
    tot_ok = tot_bad = 0
    missing = []
    for name in names:
        cfg = load_cfg(name)
        if cfg is None:
            missing.append(name)
            continue
        o, b = run_config(name, cfg)
        tot_ok += o
        tot_bad += b
    if missing:
        print('\n  [NO CONFIG] no tools/checks/py-<name>.py for: %s' % ', '.join(missing))
        print('  A shared checker with no break tests is a checker nobody has proved fires.')
    print('\n--- %d/%d deliberate breaks behaved as expected' % (tot_ok, tot_ok + tot_bad))
    sys.exit(1 if (tot_bad or missing) else 0)


if __name__ == '__main__':
    main()
