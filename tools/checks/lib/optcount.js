/* 每一課自己決定一題有幾個選項。
   一年級是 3 選項（給一年級的孩子看的），有些題型是 2 選項（是非題）；
   二、四年級全部是 4。**沒寫就是 4**，所以既有的設定檔一個字都不用動。

   spec 可以是：
     4                      —— 這一課全部都要 4 個選項
     [2, 3]                 —— 2 或 3 都可以
     { addSub20: 3, '*': 2 } —— 按產生器 id（simgen）或題庫名（verify）分別指定，
                                '*' 是其餘的預設值

   ⚠️ 一定要 fail closed：寫壞的 optCount（0、負數、空陣列、非整數、字串）要直接
   丟錯，不可以退回「什麼都接受」—— 那會讓整條選項數檢查靜悄悄失效，而且因為
   它平常就是綠的，沒有人會發現它已經不在看了。 */
function resolveOptCount(spec, key){
  /* ⚠️ 明確寫 null 是「值被刪掉／打錯字」，要報錯；沒寫（undefined）才是用預設值 4。
     兩者在 JS 裡很容易混為一談，但意思完全相反。 */
  if (spec === null) throw new Error('optCount: 值是 null（沒有要設定就整個不要寫）');
  var v = spec;
  if (v && typeof v === 'object' && !Array.isArray(v)){
    /* ⚠️ 這裡一定要用 hasOwnProperty，不可以用 `key in v` —— `in` 會走原型鏈：
       繼承來的數值（{__proto__:{someGen:3}}）會被靜悄悄當成設定值放行，
       而產生器如果剛好叫 constructor／toString，`in` 也會撈到內建屬性然後丟錯，
       而不是照規則退回預設值 4。 */
    var own = function(o, k){ return Object.prototype.hasOwnProperty.call(o, k); };
    var k = own(v, key) ? key : (own(v, '*') ? '*' : null);
    if (k === null) v = undefined;
    else {
      v = v[k];
      if (v == null) throw new Error('optCount: ' + JSON.stringify(k) + ' 的值是 null／undefined');
    }
  }
  if (v == null) v = 4;
  var list = Array.isArray(v) ? v : [v];
  if (!list.length) throw new Error('optCount: 空的允許清單（key=' + key + '）');
  if (list.length > 9) throw new Error('optCount: 允許清單過長（key=' + key + '）—— 合法值只有 2~10');
  list.forEach(function(n){
    if (!Number.isInteger(n) || n < 2 || n > 10)
      throw new Error('optCount: 不合理的值 ' + JSON.stringify(n) + '（key=' + key + '）');
  });
  return list;
}
module.exports = { resolveOptCount };
