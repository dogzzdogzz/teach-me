/* 小遊戲的選項有沒有洗牌 —— 全站唯一一份。

   起因（2026-09-14）：一年級六課的設定檔各自寫了一條
   「ROUNDS 的 choices 陣列不可以每一關都把正解放在 index 0」。那條斷言有兩個問題：

   ① **它守錯了東西。** 正解在資料裡排第幾個不重要，重要的是**畫出來的按鈕**順序。
      `2e4dabd92b` 那一輪替四課加上了 `shuffle(round.choices)`，資料照舊把正解放在
      index 0 —— 於是那四課的斷言從此永遠是紅的，`breaktest` 每次都印
      `[BASELINE-FAIL]`，那四課的改壞測試等於跑不完整。而它的訊息還寫著
      「startRound() never shuffles」，那句話已經是假的。
   ② **它漏掉了同一種缺陷的另一半。** `grade-1/length` 的數數關卡把選項排成
      `[count-1, count, count+1, count+2]` 再照順序畫 —— 正解**每一關都是第二顆**。
      `indexOf(正解) === 0` 這條斷言對它一聲都不吭。孩子玩兩關就會發現「按第二個」。

   ⚠️⚠️ **這個模組的第一版是純字面掃描，codex 一次抓出三個洞**，都是同一個道理：
   「原始碼裡寫著 shuffle(...)」和「選項真的被打亂了」是兩件事。
     - `function shuffle(arr){ Math.random(); return arr; }` —— 有 Math.random、
       有呼叫、完全沒洗牌，掃描器全綠。
     - 掃全檔會掃到註解、死碼、測驗區（不是小遊戲）的 shuffle，
       一句過期的註解就足以讓它通過。
     - 固定的出現次數對「掃全檔」沒有意義：測驗區多一個 shuffle 就會誤報。
   所以現在改成：**能執行的就執行，要掃描的就把範圍縮到那一個函式裡面**。

   ⚠️ 仍然存在的限制（不要以為它守得比實際多）：
     - 「畫按鈕那一行有沒有包 shuffle()」**還是字面掃描**，只是範圍縮到
       startRound() 的函式本體、而且先把註解拿掉。它證明得了那一行寫著 shuffle(...)，
       證明不了那個回傳值真的被拿去畫按鈕。
       死碼、或是 startRound() 裡面某個字串常數，仍然會被算成一次命中。
     - 兩個函式都必須寫成 `function 名字(...)` 的形式才切得出來。改成
       `const shuffle = arr => ...` 會切不到 —— 那種情況回報「找不到」當成缺陷
       （fail closed），不會靜靜放行，但需要有人來把這裡一起改。
     - 洗牌函式必須**自足**：它會被單獨抽出來執行，呼叫到同檔別處的 helper
       （`function shuffle(a){ return fisherYatesCopy(a); }`）會在求值時丟錯，
       同樣回報成缺陷而不是放行。
     - `extractFunction()` 是夠用就好的括號配對，會跳過字串與註解，但**不認得
       正規表示式常值**（`/}/`）與**巢狀樣板字串**。這六課都沒有這兩種寫法
       （codex 第四輪逐一確認過），出現時會切錯範圍而不是靜靜放行。 */

/* ---------- 小工具：把一個具名函式的原始碼整段切出來（大括號配對） ---------- */
function extractFunction(src, name){
  const head = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = head.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  /* 夠用就好的配對：跳過字串與註解，不做完整的 JS 剖析。
     ⚠️ 切不出來就回 null，呼叫端一律當成缺陷處理（fail closed）。 */
  while (i < src.length && depth > 0){
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*'){ i = src.indexOf('*/', i + 2); if (i < 0) return null; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`'){
      const q = c; i++;
      while (i < src.length && src[i] !== q){ if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return depth === 0 ? src.slice(m.index, i) : null;
}

/* 把註解拿掉再掃 —— 一句過期的註解不可以算成「有洗牌」。 */
function stripComments(code){
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/* 畫選項那一行：<洗牌函式>(<任何運算式>).forEach(  ——
   只在 startRound() 的函式本體裡面找，不掃全檔。
   ⚠️ 函式名要跟著 shuffleFn 走，不可以寫死 'shuffle'，否則 shuffleFn 覆寫等於壞掉
   （codex 第四輪抓到：傳 shuffleFn:'randomize' 會回報「沒有洗牌」）。 */
function renderRe(shuffleFn){
  return new RegExp('\\b' + shuffleFn + '\\s*\\([^;]*?\\)\\s*\\.\\s*forEach\\s*\\(', 'g');
}

/* ---------- 主檢查 ----------
   @param src        整份 index.html 原始碼
   @param expected   startRound() 裡預期有幾處「經過 shuffle 的選項 render」
   @param opts       { roundFn:'startRound', shuffleFn:'shuffle' } 可覆寫函式名
   @returns 問題訊息陣列（空陣列 = 沒問題） */
function gameShuffleProblems(src, expected, opts){
  const problems = [];
  const text = String(src);
  const roundFn = (opts && opts.roundFn) || 'startRound';
  const shuffleFn = (opts && opts.shuffleFn) || 'shuffle';

  /* --- 1. 畫按鈕的那一行有沒有經過 shuffle（範圍限定在 roundFn 本體內） --- */
  const roundSrc = extractFunction(text, roundFn);
  if (roundSrc === null){
    problems.push('cannot find function ' + roundFn + '() in the page — the game-shuffle check has nothing to stand on');
  } else {
    const hits = (stripComments(roundSrc).match(renderRe(shuffleFn)) || []).length;
    if (hits === 0){
      problems.push(roundFn + '() renders its options without shuffle(...) — the answer sits at a fixed position every round');
    } else if (expected !== undefined && hits !== expected){
      problems.push('expected ' + expected + ' shuffled option render(s) inside ' + roundFn + '(), found ' + hits +
                    ' — a shuffle was added or removed without updating the config');
    }
  }

  /* --- 2. shuffle() 真的會打亂嗎？**把它跑起來**，不是看它長什麼樣子 ---
     字面掃描擋不住 `function shuffle(a){ Math.random(); return a; }`（codex 抓到的）。
     這裡把函式切出來實際執行：要是排列、不可以改到輸入、而且必須真的產生
     一種以上的順序。 */
  const shufSrc = extractFunction(text, shuffleFn);
  if (shufSrc === null){
    problems.push('cannot find function ' + shuffleFn + '() in the page — cannot prove the options are actually shuffled');
  } else {
    let fn;
    try {
      fn = new Function(shufSrc + '\nreturn ' + shuffleFn + ';')();
    } catch (e){
      problems.push(shuffleFn + '() could not be evaluated on its own: ' + e.message);
      fn = null;
    }
    if (fn){
      const input = [1, 2, 3, 4];
      const orders = new Set();
      const byPos = input.map(() => []);
      let shapeBad = null;
      for (let i = 0; i < 200 && !shapeBad; i++){
        const before = input.join(',');
        let out;
        try { out = fn(input); }
        catch (e){ shapeBad = shuffleFn + '() threw on a plain array: ' + e.message; break; }
        if (!Array.isArray(out)){ shapeBad = shuffleFn + '() did not return an array'; break; }
        if (out.slice().sort().join(',') !== '1,2,3,4'){
          shapeBad = shuffleFn + '() changed the set of options: ' + JSON.stringify(out);
          break;
        }
        if (input.join(',') !== before){
          shapeBad = shuffleFn + '() mutates the array it is given — the caller\'s data order would drift between rounds';
          break;
        }
        orders.add(out.join(','));
        out.forEach((v, pos) => byPos[pos].push(v));
      }
      if (shapeBad) problems.push(shapeBad);
      else if (orders.size < 2){
        problems.push(shuffleFn + '() returned the same order in all 200 runs (' + [...orders][0] +
                      ') — a shuffle that does not shuffle is not a guard');
      } else {
        /* ⚠️ 「整體順序變過」還不夠。只把**錯誤選項**換來換去、正解永遠釘在同一格的
           洗牌，會產生很多種順序卻完全沒有解決這一課的問題（codex 第四輪抓到）。
           這一課要的性質是「**沒有任何一個按鈕位置永遠是同一個選項**」，
           所以逐格檢查：每一格在 200 次裡都必須出現過至少兩種值。 */
        for (let pos = 0; pos < input.length; pos++){
          const seen = new Set(byPos[pos]);
          if (seen.size < 2){
            problems.push(shuffleFn + '() always puts the same value (' + [...seen][0] +
                          ') at position ' + pos + ' — the answer would sit at a fixed button every round');
            break;
          }
        }
      }
    }
  }
  return problems;
}

module.exports = { gameShuffleProblems, extractFunction };
