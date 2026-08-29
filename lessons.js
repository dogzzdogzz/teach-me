/* teach-me 課程清單 —— 全站唯一的「哪個年級有哪些課」來源。
   新增一堂課 = 在這裡加一個 slug（資料夾名），首頁與年級頁的堂數就會跟著變。
   `tools/check_lessons.py` 會拿這份清單跟磁碟上的資料夾逐一比對，對不上就報錯。 */
window.TEACHME_LESSONS = {
  1: ['add-sub', 'clock', 'length', 'money', 'number-bonds', 'numbers', 'pattern', 'shapes', 'two-digit'],
  2: ['add-sub', 'capacity-weight', 'divide', 'length', 'multiply', 'numbers', 'shapes', 'solid', 'table', 'time', 'two-step'],
  3: ['add-sub', 'angle', 'capacity', 'circle', 'decimal', 'divide', 'equation', 'fraction', 'length', 'multiply', 'numbers', 'perimeter', 'rectangle', 'table', 'time', 'two-step', 'weight'],
  4: ['angle', 'area', 'decimal', 'fraction', 'numbers', 'quadrilateral', 'rounding', 'time', 'triangle'],
  5: ['angle-sum', 'area', 'average', 'big-units', 'common-factor', 'decimal', 'factor', 'fraction-add', 'fraction-divide', 'fraction-multiply', 'multiple', 'operations', 'percent', 'polygon', 'prisms', 'rounding', 'solid', 'statistics', 'symbol', 'symmetry', 'time', 'volume', 'weight'],
  6: []
};
