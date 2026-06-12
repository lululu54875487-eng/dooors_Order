const SPREADSHEET_ID = "1-K1n0-xVvCeQLJl1C1j87lk95NteARijWVk7W_2BrcU";
const SHEET_NAME = "Orders";
const PRODUCT_SHEET_NAME = "Products";

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
  const sheet = getSheet_();
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
    exhibitionName: state.exhibitionName || "",
    exhibitionDate: state.exhibitionDate || "",
    headerImage: state.headerImage || "",
    password: state.password || "",
    paymentAccount: state.paymentAccount || "",
    published: Boolean(state.published),
    products: Array.isArray(state.products) ? state.products : [],
    orders: Array.isArray(state.orders) ? state.orders : []
  };
}

function setState_(state) {
  const next = normalizeState_(state);
  const sheet = getSheet_();
  sheet.getRange("A1").setValue(JSON.stringify(next));
  sheet.getRange("A2").setValue(new Date());
  writeOrders_(sheet, next.orders);
  writeProducts_(next.products);
}

function writeOrders_(sheet, orders) {
  const startRow = 4;
  const header = [["訂單狀態", "收件人", "手機", "地址", "商品", "單價", "數量", "金額", "付款方式", "備註", "下單時間", "收款時間"]];
  sheet.getRange(startRow, 1, 1, header[0].length).setValues(header);

  const lastRow = Math.max(sheet.getLastRow(), startRow + 1);
  sheet.getRange(startRow + 1, 1, lastRow - startRow, header[0].length).clearContent();

  if (!orders.length) return;

  const rows = orders.map((order) => [
    order.status === "paid" ? "已成立" : "待收款",
    order.recipientName || "",
    order.phone || "",
    order.address || "",
    order.productName || "",
    order.price || "",
    order.quantity || "",
    order.total || "",
    order.paymentMethod === "cash" ? "現金" : "轉帳",
    order.note || "",
    order.createdAt || "",
    order.paidAt || ""
  ]);
  sheet.getRange(startRow + 1, 1, rows.length, header[0].length).setValues(rows);
}

function writeProducts_(products) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName(PRODUCT_SHEET_NAME) || spreadsheet.insertSheet(PRODUCT_SHEET_NAME);
  const header = [["商品名稱", "單價", "每單上限"]];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header[0].length).setValues(header);

  if (!products.length) return;

  const rows = products.map((product) => [
    product.name || "",
    product.price || "",
    product.limit || ""
  ]);
  sheet.getRange(2, 1, rows.length, header[0].length).setValues(rows);
}

function getSheet_() {
  const spreadsheet = getSpreadsheet_();
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
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
