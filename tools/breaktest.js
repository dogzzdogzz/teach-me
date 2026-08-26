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

/* 四頁都複製進暫存目錄。以前只複製 index／review，於是任何針對
   reference.html／parents.html 的斷言在這裡永遠跑不到 —— 那些斷言等於沒有被證明過
   （2026-08-26，grade-2/solid 那一課把這個洞挖出來）。
   注意：下面 baseline 迴圈的 ['review','index'] 是「要跑哪一支檢查腳本」
   （simgen vs verify_lesson_data），不是「要複製哪些檔案」，兩者不可以混為一談。 */
const PAGES = ['index', 'review', 'reference', 'parents'];
/* 讀不到就當場報 SETUP-FAIL 收工，不要讓 readFileSync 在 baseline 之前就把整個 run
   炸掉 —— 以前只需要 index／review，改成四頁之後任何一頁缺席都會變成硬當機。 */
const SRC = {};
const missing = [];
PAGES.forEach(function(pg){
  try {
    SRC[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8');
  } catch (e){
    missing.push(pg + '.html (' + e.code + ')');
  }
});
if (missing.length){
  console.log('  [SETUP-FAIL] cannot read ' + missing.join(', ') + ' in ' + lessonDir);
  fs.rmSync(root, { recursive:true, force:true });
  process.exit(2);
}
function writePages(mutatedFile, mutatedText){
  PAGES.forEach(function(pg){
    fs.writeFileSync(path.join(dir, pg + '.html'),
                     pg === mutatedFile ? mutatedText : SRC[pg], 'utf8');
  });
}

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
  writePages(null, null);
  const r = run(which, path.join(dir, which + '.html'));
  baseline[which] = r;
  if (r.code !== 0){
    console.log(`  [BASELINE-FAIL] the unmodified ${which}.html already fails its checker — fix that first`);
    bad++;
  }
});

breaks.forEach((b, i) => {
  /* 不認得的 file 以前會讓 SRC[b.file] 是 undefined，下一行 .split 直接丟
     TypeError 打死整個 run，其他幾十筆結果一起不見。要響亮地失敗，不要靜靜地爆炸。 */
  if (!Object.prototype.hasOwnProperty.call(SRC, b.file)){
    console.log(`  [SETUP-FAIL] break ${i+1}: unknown file '${b.file}' — expected one of ${PAGES.join('/')}`);
    bad++; return;
  }
  /* 改壞的「頁面」和跑起來的「檢查腳本」是兩件事：只有 index／review 各自有一支
     腳本，reference／parents 是被 data.check 從旁邊讀進來的，所以要指定由誰去跑。
     預設：index／review 跑自己，其餘兩頁交給 verify_lesson_data（也就是 'index'）。
     break 可以用 via 明講。 */
  /* 只有「沒寫」才套預設。用 `b.via || ...` 的話，via:'' 會靜靜地掉進 index，
     而那一支剛好也噴同一句話時，這一筆就被誤判成「證明過了」。 */
  const via = Object.prototype.hasOwnProperty.call(b, 'via')
    ? b.via
    : (b.file === 'review' ? 'review' : 'index');
  if (via !== 'review' && via !== 'index'){
    console.log(`  [SETUP-FAIL] break ${i+1}: via '${via}' must be 'index' or 'review'`);
    bad++; return;
  }
  const src = SRC[b.file];
  const count = src.split(b.find).length - 1;
  if (count !== 1){
    console.log(`  [SETUP-FAIL] break ${i+1}: find string occurs ${count} time(s), expected exactly 1 — ${b.expect}`);
    bad++; return;
  }
  /* 兩個檔案都寫進去（腳本會從同一個資料夾找另一支的檔案），只有一個被改壞。 */
  writePages(b.file, src.replace(b.find, b.replace));
  const r = run(via, path.join(dir, via + '.html'));
  /* 只認「[FAIL] 那一行裡出現預期訊息」，不是整份輸出裡隨便一個子字串 ——
     不相干的 stack trace 也可能剛好含有那幾個字。 */
  const failLines = r.out.split('\n').filter(l => l.indexOf('[FAIL]') >= 0);
  const hit = failLines.some(l => l.indexOf(b.expect) >= 0);
  const baseHit = (baseline[via].out || '').split('\n')
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
