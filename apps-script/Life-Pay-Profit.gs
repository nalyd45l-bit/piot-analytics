/** Финансовый модуль Life Pay. Интеграция с doGet / doPost описана в комплекте. */
var LP_PROFIT_SHEET_ = 'Чистая прибыль';
var LP_OLD_PROFIT_SHEET_ = 'Life Pay — расходы v2';
function lifePayExpenseRoute(e) {
  var p = e && e.parameter || {};
  var action = String(p.action || '');
  if (['apiGetProfit','apiSaveProfit','apiSaveProfitBatch','apiSaveNetProfitBatch'].indexOf(action) < 0) return null;
  var body;
  try {
    var args = p.arg ? JSON.parse(p.arg) : {};
    var result = action === 'apiGetProfit' ? apiGetProfit() : action === 'apiSaveProfit' ? apiSaveProfit(args) : apiSaveProfitBatch(args);
    body = {ok:true,result:result};
  } catch (err) { body = {ok:false,error:String(err.message || err)}; }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function lifePayExpenseBook_() {
  var id = PropertiesService.getScriptProperties().getProperty('LIFE_PAY_SPREADSHEET_ID');
  var book = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Укажите ID рабочей таблицы в свойстве скрипта LIFE_PAY_SPREADSHEET_ID.');
  return book;
}
function lifePayExpenseHeaders_() {
  return ['Месяц','Статьи расходов (JSON)','Расходы','Доход LP + ЕСП','Клиенты оплатили СП за настройку','Чистая прибыль LP','Обновлено'];
}

// A custom sheet may already contain notes or calculations. The seven adjacent
// ledger columns are owned by the app; other columns stay outside every write.
function lifePayProfitBlock_(sheet) {
  if (!sheet || !sheet.getLastColumn()) return 0;
  var headings = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
  var expected = lifePayExpenseHeaders_();
  return 1 + headings.findIndex(function(_, i) {
    return expected.every(function(label,j) {
      return headings[i+j] === label || (j === 4 && headings[i+j] === 'Оплаты СП (отдельно)');
    });
  });
}
function lifePayProfitRows_(sheet, first) {
  if (!first || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2,first,sheet.getLastRow()-1,7).getValues();
}
function lifePayStoredMonth_(value, zone) {
  if (value instanceof Date) return Utilities.formatDate(value, zone, 'yyyy-MM');
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value)) ? String(value) : '';
}
function lifePayProfitSnapshot_(book) {
  var sheet = book.getSheetByName(LP_PROFIT_SHEET_);
  var first = lifePayProfitBlock_(sheet);
  var zone = book.getSpreadsheetTimeZone();
  var current = lifePayProfitRows_(sheet, first);
  // Only interpret rows in a positively identified application ledger.
  var old = book.getSheetByName(LP_OLD_PROFIT_SHEET_);
  var legacy = lifePayProfitRows_(old, lifePayProfitBlock_(old));
  var index = Object.create(null);
  var rows = current.slice();
  var origins = Object.create(null);
  function add(row, pos, source) {
    var month = lifePayStoredMonth_(row[0], zone);
    if (!month) return;
    if (month in index) {
      if (source !== origins[month]) return;
      throw Error('В листе «'+source+'» две строки за '+month+'. Проверьте этот месяц.');
    }
    if (source === LP_OLD_PROFIT_SHEET_) {pos = rows.length;rows.push(row.slice());}
    index[month] = pos;
    origins[month] = source;
  }
  current.forEach(function(row,i){add(row,i,LP_PROFIT_SHEET_);});
  legacy.forEach(function(row,i){add(row,i,LP_OLD_PROFIT_SHEET_);});
  return {sheet:sheet,first:first,rows:rows,current:current.length,index:index,origins:origins};
}
function lifePayExpenseMonth_(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) throw new Error('Укажите месяц расхода.');
  return String(value);
}
function lifePayExpenseNumber_(value) {
  var normalized = typeof value === 'string' ? value.replace(/[\s\u00a0\u202f]/g,'').replace(',','.') : value;
  if (normalized === '' || normalized == null) normalized = 0;
  if (typeof normalized === 'string' && !/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error('Неверная сумма.');
  var amount = Number(normalized);
  if (!isFinite(amount) || amount < 0 || amount > 1e12) throw new Error('Неверная сумма.');
  return Math.round(amount * 100) / 100;
}
function lifePayExpensePrepare_(arg) {
  if (!arg || typeof arg !== 'object') throw new Error('Неверный расчёт расходов.');
  var month = lifePayExpenseMonth_(arg.month);
  if (!Array.isArray(arg.items) || arg.items.length > 40) throw new Error('Допускается до 40 статей за месяц.');
  var items = arg.items.map(function(item) {
    if (!item || typeof item !== 'object') throw new Error('Неверная статья расхода.');
    if (item.month != null && item.month !== month) throw new Error('Месяц статьи не совпадает с месяцем расчёта.');
    var id = item.id ? String(item.id) : Utilities.getUuid();
    if (id.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Неверный идентификатор статьи.');
    return {id:id,month:month,name:String(item.name || 'Расходы').trim().slice(0,100) || 'Расходы',amount:lifePayExpenseNumber_(item.amount),schemaVersion:item.schemaVersion === 4 ? 4 : 3};
  });
  var total = Math.round(items.reduce(function(sum,item) {return sum + item.amount;},0) * 100) / 100;
  if (total > 1e12) throw new Error('Общая сумма расходов слишком велика.');
  return {month:month,items:items,total:total,income:lifePayExpenseNumber_(arg.income),sp:lifePayExpenseNumber_(arg.sp)};
}

function lifePayItemList_(value) {
  var items = JSON.parse(String(value || '[]'));
  if (!Array.isArray(items)) throw Error('Проверьте содержимое колонки статей расходов.');
  return items;
}
function lifePayProfitEntry_(month,row,source) {
  return {month:month,items:lifePayItemList_(row[1]),total:Number(row[2]),income:Number(row[3]),
    sp:Number(row[4]),net:Number(row[5]),updated:String(row[6]),sheet:source};
}
function apiGetProfit() {
  var ledger = lifePayProfitSnapshot_(lifePayExpenseBook_());
  return {sheet:LP_PROFIT_SHEET_,entries:Object.keys(ledger.index).sort().map(function(month) {
    return lifePayProfitEntry_(month,ledger.rows[ledger.index[month]],ledger.origins[month]);
  })};
}
function apiSaveNetProfitBatch(arg) {return apiSaveProfitBatch(arg);}
function apiSaveProfitBatch(arg) {
  if (!arg || !Array.isArray(arg.entries) || !arg.entries.length || arg.entries.length > 120)
    throw Error('Укажите от 1 до 120 месяцев.');
  var entries = arg.entries.map(lifePayExpensePrepare_);
  var months = Object.create(null);
  entries.forEach(function(entry) {
    if (entry.month in months) throw Error('Месяц повторяется в запросе.');
    months[entry.month] = true;
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var book = lifePayExpenseBook_();
    var ledger = lifePayProfitSnapshot_(book);
    var rows = ledger.rows, index = ledger.index;
    var updated = new Date().toISOString();
    entries.forEach(function(entry) {
      var month = entry.month;
      var net = Math.round((entry.income-entry.total)*100)/100;
      if (!(month in index)) index[month] = rows.length;
      rows[index[month]] = [month,JSON.stringify(entry.items),entry.total,entry.income,entry.sp,net,updated];
    });
    var ids = Object.create(null);
    Object.keys(index).forEach(function(month) {
      lifePayItemList_(rows[index[month]][1]).forEach(function(item) {
        if (!item.id) return;
        if (ids[item.id]) throw Error('Статья расхода повторяется. Сохраните исходный и новый месяц вместе.');
        ids[item.id] = true;
      });
    });
    var sheet = ledger.sheet || book.insertSheet(LP_PROFIT_SHEET_);
    var first = ledger.first;
    if (!first) {
      first = sheet.getLastColumn()+1;
      var extra = first+6-sheet.getMaxColumns();
      if (extra>0) sheet.insertColumnsAfter(sheet.getMaxColumns(),extra);
      sheet.getRange(1,first,1,7).setValues([lifePayExpenseHeaders_()]).setFontWeight('bold');
      if (first === 1) {sheet.setFrozenRows(1);sheet.hideColumns(2);}
    }
    // Preserve formulas in untouched months even if a user has enriched an owned column.
    if (ledger.current) {
      var formulas = sheet.getRange(2,first,ledger.current,7).getFormulas();
      var changedRows = Object.create(null);
      entries.forEach(function(entry) {changedRows[index[entry.month]]=true;});
      formulas.forEach(function(cells,i) {
        if (!changedRows[i]) cells.forEach(function(formula,j) {if (formula) rows[i][j]=formula;});
      });
    }
    if (rows.length+1>sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),rows.length+1-sheet.getMaxRows());
    sheet.getRange(2,first,rows.length,1).setNumberFormat('@');
    sheet.getRange(2,first,rows.length,7).setValues(rows);
    SpreadsheetApp.flush();
    var stored = sheet.getRange(2,first,rows.length,7).getValues();
    var receipts = entries.map(function(entry) {
      var row = stored[index[entry.month]];
      if (String(row[0])!==entry.month || String(row[1])!==JSON.stringify(entry.items) ||
          Number(row[2])!==entry.total || Number(row[3])!==entry.income || Number(row[4])!==entry.sp ||
          Number(row[5])!==Math.round((entry.income-entry.total)*100)/100)
        throw Error('Не удалось подтвердить запись за '+entry.month+'. Повторите сохранение.');
      return {month:entry.month,total:Number(row[2]),income:Number(row[3]),sp:Number(row[4]),net:Number(row[5]),updated:updated};
    });
    return {saved:true,sheet:sheet.getName(),updated:updated,months:receipts};
  } finally {lock.releaseLock();}
}
function apiSaveProfit(arg) {
  var batch=apiSaveProfitBatch({entries:[arg]});
  return Object.assign({saved:true,sheet:batch.sheet},batch.months[0]);
}

// Use this entry point when the current project has no doPost handler.
function doPost(e) {
  var response = lifePayExpenseRoute(e);
  if (response !== null) return response;
  return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Неизвестный метод.'}))
    .setMimeType(ContentService.MimeType.JSON);
}
