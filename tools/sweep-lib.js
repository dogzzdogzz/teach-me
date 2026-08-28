
/* ---------------- shared helpers ---------------- */
window.SWEEP_RESULTS = [];

function loadFrame(path){
  return new Promise(function(resolve){
    var f = document.createElement('iframe');
    f.style.width = '1100px'; f.style.height = '900px';
    f.src = path + (path.indexOf('?') < 0 ? '?' : '&') + 'sw=' + Math.random();
    f.onload = function(){ setTimeout(function(){ resolve(f); }, 150); };
    document.body.appendChild(f);
  });
}

function textProblems(doc){
  var bad = [], t = doc.body ? doc.body.innerText : '';
  ['undefined','NaN','[object Object]','<strong>','<b>','function(','&lt;strong&gt;'].forEach(function(p){
    if (t.indexOf(p) >= 0) bad.push('visible text contains "' + p + '"');
  });
  return bad;
}

/* value-aware option key: '1/4' and '2/8' are the SAME option to a child */
window.parseVU = function(sRaw){
  var t = String(sRaw).replace(/　/g,' ').replace(/[−–]/g,'-').trim();
  t = t.replace(/^[約大約]+/,'');
  var m = t.match(/^(-?)(\d+)\s*又\s*(\d+)\s*\/\s*(\d+)/), val = null, rest = null;
  if (m){ val = (m[1]?-1:1) * (parseInt(m[2]) + parseInt(m[3])/parseInt(m[4])); rest = t.slice(m[0].length); }
  else if ((m = t.match(/^(-?)(\d+)\s*\/\s*(\d+)/))){
    if (parseInt(m[3]) === 0) return null;
    val = (m[1]?-1:1) * parseInt(m[2])/parseInt(m[3]); rest = t.slice(m[0].length);
  } else if ((m = t.match(/^-?\d+(?:\.\d+)?/))){ val = parseFloat(m[0]); rest = t.slice(m[0].length); }
  else return null;
  var unit = rest.replace(/\s+/g,'');
  if (unit.charAt(0) === '%' || unit.charAt(0) === '％'){ val = val/100; unit = unit.slice(1); }
  return { v: val, u: unit };   /* units matter: 1 公克 ≠ 1 公斤 */
};

/* ---------------- sweep 1: load, exercise, collect errors ---------------- */
async function exercise(path, lang){
  /* localStorage is same-origin: clear residue BEFORE loading, or the page opens
     in the wrong language and every assertion below is wrong. */
  try { localStorage.setItem('teachme-lang', lang); localStorage.removeItem('teachme-mode'); } catch(e){}
  var f = await loadFrame(path), errs = [], notes = [];
  var win = f.contentWindow, doc = f.contentDocument;
  win.addEventListener('error', function(ev){ errs.push('JS error: ' + (ev.message || ev.error)); });
  win.addEventListener('unhandledrejection', function(ev){ errs.push('rejection: ' + ev.reason); });
  var oldErr = win.console.error;
  win.console.error = function(){ errs.push('console.error: ' + Array.prototype.join.call(arguments,' ')); oldErr.apply(win.console, arguments); };

  if (!doc.getElementById('langBtn')) errs.push('no #langBtn');
  var nav = doc.querySelectorAll('.coursenav > *');
  if (nav.length && nav.length < 3) errs.push('coursenav has only ' + nav.length + ' entries');
  var htmlLang = doc.documentElement.getAttribute('lang');
  if (lang === 'en' && htmlLang !== 'en') errs.push('html lang is ' + htmlLang + ' in en mode');
  if (lang === 'zh' && htmlLang !== 'zh-Hant') errs.push('html lang is ' + htmlLang + ' in zh mode');

  doc.querySelectorAll('.modecard, [data-mode]').forEach(function(c){
    try { c.click(); } catch(e){ errs.push('mode click threw: ' + e.message); }
  });

  var answered = 0;
  doc.querySelectorAll('.q, .quizq, .question').forEach(function(qEl){
    qEl.querySelectorAll('button').forEach(function(b){
      try { b.click(); answered++; } catch(e){ errs.push('option click threw: ' + e.message); }
    });
  });
  notes.push('quiz clicks: ' + answered);

  doc.querySelectorAll('#gAnswers button, #gGrid button, #gOpts button, .gameopt').forEach(function(b){
    try { b.click(); } catch(e){ errs.push('game click threw: ' + e.message); }
  });
  ['gHintBtn','gHint','gNext','gRestart','stepNext','stepReset','stepNewEx','retryBtn'].forEach(function(id){
    var b = doc.getElementById(id);
    if (b) for (var n = 0; n < 3; n++){ try { b.click(); } catch(e){ errs.push(id + ' click threw: ' + e.message); } }
  });

  ['#quiz','#gAnswers','#gGrid'].forEach(function(sel){
    var el = doc.querySelector(sel);
    if (el && el.children.length === 0) errs.push(sel + ' rendered empty');
  });
  textProblems(doc).forEach(function(p){ errs.push(p); });

  try {
    doc.getElementById('langBtn').click();
    if (doc.documentElement.getAttribute('lang') === htmlLang) errs.push('lang toggle did not change html lang');
    textProblems(doc).forEach(function(p){ errs.push('after toggle: ' + p); });
    doc.getElementById('langBtn').click();
  } catch(e){ errs.push('lang toggle threw: ' + e.message); }

  f.remove();
  return { path: path, lang: lang, errors: errs, notes: notes };
}

window.runSweep = async function(paths, lang){
  var out = [];
  for (var i = 0; i < paths.length; i++){
    try { out.push(await exercise(paths[i], lang)); }
    catch(e){ out.push({ path: paths[i], lang: lang, errors: ['harness threw: ' + e.message], notes: [] }); }
  }
  window.SWEEP_RESULTS = window.SWEEP_RESULTS.concat(out);
  return out.filter(function(r){ return r.errors.length; });
};

/* ---------------- sweep 2: option quality on generated questions ---------------- */
var SIMPLIFY_RE = /記得約分|最簡|simplify|simplest form|whole or mixed number/i;

function optionProblems(doc){
  var probs = [];
  doc.querySelectorAll('.q, .quizq, .question').forEach(function(qEl, qi){
    var btns = Array.prototype.slice.call(qEl.querySelectorAll('button'));
    if (btns.length < 2) return;
    /* picture options (e.g. grade-1 shapes) carry no text — skip them */
    if (btns.every(function(b){ return b.querySelector('svg') || b.textContent.trim() === ''; })) return;
    var stem = (qEl.querySelector('.stem') || qEl).textContent || '';
    var saysSimplify = SIMPLIFY_RE.test(stem);
    var texts = btns.map(function(b){ return b.textContent.trim(); });
    texts.forEach(function(t){
      ['·','#','NaN','undefined','[object'].forEach(function(bad){
        if (t.indexOf(bad) >= 0) probs.push({ sev:'GARBAGE', msg:'q' + qi + ' option "' + t + '"' });
      });
    });
    btns.forEach(function(b){ try { b.click(); } catch(e){} });   /* reveals the key */
    var rightEl = qEl.querySelector('button.right, .opt.right');
    var key = rightEl ? rightEl.textContent.trim() : null;
    var seen = {};
    texts.forEach(function(t){ if (seen[t]) probs.push({ sev:'DUPTEXT', msg:'q' + qi + ' "' + t + '"' }); seen[t] = true; });
    var parsed = texts.map(window.parseVU);
    for (var a = 0; a < parsed.length; a++) for (var b = a+1; b < parsed.length; b++){
      if (!parsed[a] || !parsed[b]) continue;
      if (parsed[a].v !== parsed[b].v || parsed[a].u !== parsed[b].u) continue;
      if (texts[a] === texts[b]) continue;
      var involvesKey = key !== null && (texts[a] === key || texts[b] === key);
      if (involvesKey && saysSimplify) continue;      /* framework §六之二 legal exception */
      probs.push({ sev: involvesKey ? 'KEY-EQUAL' : 'WRONG-WRONG',
                   msg: 'q' + qi + ' "' + texts[a] + '" == "' + texts[b] + '"' + (key ? ' (key=' + key + ')' : '') });
    }
  });
  return probs;
}

window.sweepOptions = async function(paths, batches){
  var results = [];
  for (var pi = 0; pi < paths.length; pi++){
    var found = [];
    for (var i = 0; i < (batches || 8); i++){
      var f = await loadFrame(paths[pi]);
      optionProblems(f.contentDocument).forEach(function(p){ found.push(p); });
      f.remove();
    }
    if (found.length){
      var bySev = {};
      found.forEach(function(p){ (bySev[p.sev] = bySev[p.sev] || {})[p.msg.replace(/^q\d+ /,'')] = 1; });
      var summary = {};
      Object.keys(bySev).forEach(function(k){ summary[k] = Object.keys(bySev[k]).slice(0, 5); });
      results.push({ path: paths[pi], summary: summary, total: found.length });
    }
  }
  return results;
};
