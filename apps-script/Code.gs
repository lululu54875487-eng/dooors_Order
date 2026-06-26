const SPREADSHEET_ID = "1-K1n0-xVvCeQLJl1C1j87lk95NteARijWVk7W_2BrcU";
const STATE_SHEET_NAME = "State";

function doGet(e) {
  const action = e.parameter.action || "getState";
  const callback = e.parameter.callback || "callback";

  try {
    if (action === "getState") {
      return jsonp_(callback, getState_());
    }
    return jsonp_(callback, { ok: false, error: "Unknown action" });
  } catch (error) {
    return jsonp_(callback, { ok: false, error: error.message });
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  const action = body.action;
  const payload = body.payload ? decodePayload_(body.payload) : body;

  if (action === "setState") {
    setState_(payload);
    return textJson_({ ok: true });
  }

  if (action === "addOrder") {
    const state = getState_();
    const orders = (state.orders || []).filter((order) => order.id !== payload.id);
    orders.push(payload);
    state.orders = orders;
    setState_(state);
    return textJson_({ ok: true });
  }

  return textJson_({ ok: false, error: "Unknown action" });
}

function getState_() {
  const sheet = getStateSheet_();
  const value = sheet.getRange("A1").getValue();
  if (value) {
    return normalizeState_(JSON.parse(value));
  }

  const state = normalizeState_({});
  setState_(state);
  return state;
}

function normalizeState_(state) {
  return {
    eventId: state.eventId || Utilities.getUuid(),
    exhibitionName: state.exhibitionName || "展覽訂單",
    exhibitionDate: state.exhibitionDate || getTodayValue_(),
    paymentAccount: state.paymentAccount || "",
    paymentQrImage: state.paymentQrImage || "",
    published: Boolean(state.published),
    productsCollapsed: Boolean(state.productsCollapsed),
    products: Array.isArray(state.products) ? state.products : [],
    orders: Array.isArray(state.orders) ? state.orders : []
  };
}

function setState_(state) {
  const next = normalizeState_(state);
  const stateSheet = getStateSheet_();
  stateSheet.getRange("A1").setValue(JSON.stringify(next));
  stateSheet.getRange("A2").setValue(new Date());
  if (next.published) {
    stateSheet.getRange("A3").setValue(getOrderSheetName_(next));
    writeOrders_(getOrderSheet_(next), next.orders);
  } else {
    stateSheet.getRange("A3").setValue("");
  }
}

function writeOrders_(sheet, orders) {
  const startRow = 4;
  const header = [["訂單狀態", "訂單號碼", "暱稱", "收件人", "手機", "地址", "訂單金額", "付款方式", "備註", "下單時間", "收款時間"]];
  sheet.getRange(1, 1).setValue("展覽名稱");
  sheet.getRange(1, 2).setValue(sheet.getName());
  sheet.getRange(2, 1).setValue("最後更新");
  sheet.getRange(2, 2).setValue(new Date());
  sheet.getRange(startRow, 1, 1, header[0].length).setValues(header);

  const lastRow = Math.max(sheet.getLastRow(), startRow + 1);
  sheet.getRange(startRow + 1, 1, lastRow - startRow, header[0].length).clearContent();

  if (!orders.length) return;

  const rows = orders.map((order) => [
    order.status === "paid" ? "已成立" : "待收款",
    order.orderNumber || "",
    order.nickname || "",
    order.recipientName || "",
    order.phone || "",
    order.address || "",
    order.total || "",
    order.paymentMethod === "cash" ? "現金" : "轉帳",
    order.note || "",
    order.createdAt || "",
    order.paidAt || ""
  ]);
  sheet.getRange(startRow + 1, 1, rows.length, header[0].length).setValues(rows);
}

function getStateSheet_() {
  const spreadsheet = getSpreadsheet_();
  return spreadsheet.getSheetByName(STATE_SHEET_NAME) || spreadsheet.insertSheet(STATE_SHEET_NAME);
}

function getOrderSheet_(state) {
  const spreadsheet = getSpreadsheet_();
  const name = getOrderSheetName_(state);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function getOrderSheetName_(state) {
  const date = state.exhibitionDate || getTodayValue_();
  const name = state.exhibitionName || "展覽訂單";
  return sanitizeSheetName_(`${date}_${name}`);
}

function getTodayValue_() {
  const timezone = Session.getScriptTimeZone() || "Asia/Taipei";
  return Utilities.formatDate(new Date(), timezone, "yyyy-MM-dd");
}

function sanitizeSheetName_(name) {
  const cleaned = String(name)
    .replace(/[\[\]\:\*\?\/\\]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "未命名展覽";
  return cleaned.slice(0, 100);
}

function getSpreadsheet_() {
  if (!SPREADSHEET_ID) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error("請先設定 SPREADSHEET_ID");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function decodePayload_(payload) {
  const bytes = Utilities.base64Decode(payload);
  return JSON.parse(Utilities.newBlob(bytes).getDataAsString("UTF-8"));
}

function jsonp_(callback, payload) {
  const safeCallback = String(callback).replace(/[^\w.$]/g, "");
  return ContentService
    .createTextOutput(`${safeCallback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function textJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
