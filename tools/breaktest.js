/* 「刻意改壞」測試：把課程檔改壞，確認檢查腳本真的會噴錯。
   綠燈的檢查不代表程式對，可能只代表那條斷言永遠不會響 —— 這支腳本就是驗那件事。

   改壞的清單寫在 tools/checks/<grade>-<slug>.js 的 breaks 陣列，每一筆：
     { file:'review'|'index', find:'原字串', replace:'改壞後', expect:'預期錯誤訊息的片段' }

   用法：node tools/breaktest.js grade-2/math/time
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const lessonDir = (process.argv[2] || '').replace(/\/+$/, '');
const m = lessonDir.match(/grade-(\d)\/math\/([^/]+)$/);
if (!m){ console.error('usage: node tools/breaktest.js grade-2/math/time'); process.exit(2); }
const key = 'grade-' + m[1] + '-' + m[2];
const cfg = require(path.join(__dirname, 'checks', key + '.js'));
const breaks = cfg.breaks || [];
if (!breaks.length){ console.error('no breaks defined in tools/checks/' + key + '.js'); process.exit(2); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'breaktest-'));
const dir = path.join(root, 'grade-' + m[1], 'math', m[2]);
fs.mkdirSync(dir, { recursive: true });

const SRC = {
  review: fs.readFileSync(path.join(lessonDir, 'review.html'), 'utf8'),
  index:  fs.readFileSync(path.join(lessonDir, 'index.html'), 'utf8')
};

/* 原檔與改壞版跑同一個種子：這樣「只有改壞版失敗」才真的是改壞造成的，
   而不是兩次抽到不同的參數。（2026-08-25 codex 審查抓到） */
const SEED = '20260825';

function run(which, file){
  const script = which === 'review' ? 'simgen.js' : 'verify_lesson_data.js';
  const args = which === 'review' ? [path.join(__dirname, script), file, '400']
                                  : [path.join(__dirname, script), file];
  const opts = { encoding:'utf8', stdio:['ignore','pipe','pipe'],
                 env: Object.assign({}, process.env, { SIMGEN_SEED: SEED }) };
  try {
    /* 成功時也要留著 stdout —— baseline 要拿它掃 [FAIL]，丟掉就等於沒比對。 */
    const out = execFileSync(process.execPath, args, opts);
    return { code:0, out: out || '' };
  } catch (e){
    return { code: e.status === undefined ? -1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

/* 先驗未改壞的原檔是綠的。原檔本來就在噴同一句話的話，
   任何「改壞」都會被誤判成抓到了 —— 那等於什麼都沒證明。 */
let bad = 0;
const baseline = {};
['review','index'].forEach(which => {
  fs.writeFileSync(path.join(dir, 'review.html'), SRC.review, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), SRC.index, 'utf8');
  const r = run(which, path.join(dir, which + '.html'));
  baseline[which] = r;
  if (r.code !== 0){
    console.log(`  [BASELINE-FAIL] the unmodified ${which}.html already fails its checker — fix that first`);
    bad++;
  }
});

breaks.forEach((b, i) => {
  const src = SRC[b.file];
  const count = src.split(b.find).length - 1;
  if (count !== 1){
    console.log(`  [SETUP-FAIL] break ${i+1}: find string occurs ${count} time(s), expected exactly 1 — ${b.expect}`);
    bad++; return;
  }
  /* 兩個檔案都寫進去（腳本會從同一個資料夾找另一支的檔案），只有一個被改壞。 */
  fs.writeFileSync(path.join(dir, 'review.html'), b.file === 'review' ? src.replace(b.find, b.replace) : SRC.review, 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), b.file === 'index' ? src.replace(b.find, b.replace) : SRC.index, 'utf8');
  const r = run(b.file, path.join(dir, b.file + '.html'));
  /* 只認「[FAIL] 那一行裡出現預期訊息」，不是整份輸出裡隨便一個子字串 ——
     不相干的 stack trace 也可能剛好含有那幾個字。 */
  const failLines = r.out.split('\n').filter(l => l.indexOf('[FAIL]') >= 0);
  const hit = failLines.some(l => l.indexOf(b.expect) >= 0);
  const baseHit = (baseline[b.file].out || '').split('\n')
    .filter(l => l.indexOf('[FAIL]') >= 0).some(l => l.indexOf(b.expect) >= 0);
  if (baseHit){
    console.log(`  [NO PROOF] break ${i+1}: the unmodified file already reports "${b.expect}"`);
    bad++;
  } else if (r.code === 0){
    console.log(`  [NOT CAUGHT] break ${i+1}: expected "${b.expect}" — the checker stayed green`);
    bad++;
  } else if (!hit){
    console.log(`  [WRONG ERROR] break ${i+1}: expected "${b.expect}" on a [FAIL] line, got:\n${(failLines.length ? failLines : r.out.split('\n').filter(l => /Error/.test(l))).slice(0,3).join('\n')}`);
    bad++;
  } else {
    console.log(`  [ok] break ${i+1}: caught — ${b.expect}`);
  }
});

fs.rmSync(root, { recursive:true, force:true });
console.log(`--- ${breaks.length - bad}/${breaks.length} deliberate breaks were caught`);
process.exit(bad ? 1 : 0);
