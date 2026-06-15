const STORAGE_KEY = "exhibition-order-state";
const GAS_URL_KEY = "exhibition-order-gas-url";
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbzPfIdE2OrVtQAr0UabiqYOyVErvrBYkzsEdMS91Tnlbt9wbWGUOAEIOR_zSb12u4uU/exec";

const defaultProducts = [
  { id: "sample-1", name: "範例商品 A", price: 680, limit: 2 },
  { id: "sample-2", name: "範例商品 B", price: 420, limit: 5 }
];

function createEmptyState() {
  return {
    eventId: createId(),
    exhibitionName: "",
    exhibitionDate: "",
    headerImage: "",
    onsiteCode: "",
    paymentAccount: "",
    paymentQrImage: "",
    published: false,
    productsCollapsed: false,
    products: [...defaultProducts],
    orders: []
  };
}

let state = loadInitialState();
let remoteEnabled = false;
let remoteSaveTimer = null;
let remoteKind = "none";
let gasUrl = new URLSearchParams(location.search).get("sync") || localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
let editingProductId = null;

const el = {
  modeStatus: document.querySelector("#modeStatus"),
  setupHint: document.querySelector("#setupHint"),
  adminView: document.querySelector("#adminView"),
  sellerView: document.querySelector("#sellerView"),
  customerView: document.querySelector("#customerView"),
  exhibitionName: document.querySelector("#exhibitionName"),
  exhibitionDate: document.querySelector("#exhibitionDate"),
  headerImageFile: document.querySelector("#headerImageFile"),
  headerPreview: document.querySelector("#headerPreview"),
  heroImage: document.querySelector("#heroImage"),
  removeHeaderImageBtn: document.querySelector("#removeHeaderImageBtn"),
  onsiteCode: document.querySelector("#onsiteCode"),
  paymentAccount: document.querySelector("#paymentAccount"),
  paymentQrFile: document.querySelector("#paymentQrFile"),
  paymentQrPreview: document.querySelector("#paymentQrPreview"),
  paymentQrImage: document.querySelector("#paymentQrImage"),
  removePaymentQrBtn: document.querySelector("#removePaymentQrBtn"),
  publishBtn: document.querySelector("#publishBtn"),
  closeBtn: document.querySelector("#closeBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  gasSettingsBox: document.querySelector("#gasSettingsBox"),
  gasUrl: document.querySelector("#gasUrl"),
  saveGasBtn: document.querySelector("#saveGasBtn"),
  clearGasBtn: document.querySelector("#clearGasBtn"),
  remoteStatus: document.querySelector("#remoteStatus"),
  customerUrl: document.querySelector("#customerUrl"),
  copyUrlBtn: document.querySelector("#copyUrlBtn"),
  openCustomerBtn: document.querySelector("#openCustomerBtn"),
  qrImage: document.querySelector("#qrImage"),
  toggleProductsBtn: document.querySelector("#toggleProductsBtn"),
  productSettingsBody: document.querySelector("#productSettingsBody"),
  addProductBtn: document.querySelector("#addProductBtn"),
  productFile: document.querySelector("#productFile"),
  downloadTemplateBtn: document.querySelector("#downloadTemplateBtn"),
  exportProductsBtn: document.querySelector("#exportProductsBtn"),
  products: document.querySelector("#products"),
  orderCount: document.querySelector("#orderCount"),
  pendingAmount: document.querySelector("#pendingAmount"),
  paidAmount: document.querySelector("#paidAmount"),
  orders: document.querySelector("#orders"),
  totals: document.querySelector("#totals"),
  exportBtn: document.querySelector("#exportBtn"),
  orderPanel: document.querySelector("#orderPanel"),
  successPanel: document.querySelector("#successPanel"),
  customerTitle: document.querySelector("#customerTitle"),
  customerHint: document.querySelector("#customerHint"),
  orderForm: document.querySelector("#orderForm"),
  customerOrderNumber: document.querySelector("#customerOrderNumber"),
  nickname: document.querySelector("#nickname"),
  recipientName: document.querySelector("#recipientName"),
  recipientPhone: document.querySelector("#recipientPhone"),
  recipientAddress: document.querySelector("#recipientAddress"),
  orderAmount: document.querySelector("#orderAmount"),
  paymentMethod: document.querySelector("#paymentMethod"),
  orderOnsiteCode: document.querySelector("#orderOnsiteCode"),
  note: document.querySelector("#note"),
  successMessage: document.querySelector("#successMessage"),
  paymentInfo: document.querySelector("#paymentInfo"),
  productDialog: document.querySelector("#productDialog"),
  productDialogTitle: document.querySelector("#productDialogTitle"),
  productName: document.querySelector("#productName"),
  productPrice: document.querySelector("#productPrice"),
  productLimit: document.querySelector("#productLimit"),
  saveProductBtn: document.querySelector("#saveProductBtn"),
  toast: document.querySelector("#toast")
};

function createId() {
  return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadInitialState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return createEmptyState();
  try {
    return normalizeState(JSON.parse(saved));
  } catch {
    return createEmptyState();
  }
}

function normalizeState(next) {
  return {
    ...createEmptyState(),
    ...next,
    products: Array.isArray(next.products) ? next.products : [],
    orders: Array.isArray(next.orders) ? next.orders : []
  };
}

function isCustomerMode() {
  return new URLSearchParams(location.search).get("mode") === "order";
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleRemoteSave();
}

function scheduleRemoteSave() {
  if (!remoteEnabled) return;
  window.clearTimeout(remoteSaveTimer);
  remoteSaveTimer = window.setTimeout(saveRemoteState, 250);
}

async function saveRemoteState() {
  if (!remoteEnabled) return;
  try {
    if (remoteKind === "gas") {
      await postGas("setState", state);
    } else {
      await postPayload("/api/state", state);
    }
  } catch {
    remoteEnabled = false;
    renderRemoteStatus();
  }
}

async function syncRemoteState() {
  if (!["http:", "https:"].includes(location.protocol)) return;
  try {
    let remoteState;
    if (gasUrl) {
      remoteKind = "gas";
      remoteState = normalizeState(await getGasState());
    } else {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return;
      remoteKind = "local";
      remoteState = normalizeState(await response.json());
    }
    if (!remoteState.eventId) return;
    state = remoteState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    remoteEnabled = true;
    render();
  } catch {
    remoteEnabled = false;
    renderRemoteStatus();
  }
}

async function saveRemoteOrder(order) {
  if (!remoteEnabled) return;
  try {
    if (remoteKind === "gas") {
      await postGas("addOrder", order);
    } else {
      await postPayload("/api/order", order);
      await syncRemoteState();
    }
  } catch {
    remoteEnabled = false;
    renderRemoteStatus();
  }
}

function postPayload(url, data) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
}

function postGas(action, data) {
  return fetch(gasUrl, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ action, payload: encodePayload(data) })
  });
}

function getGasState() {
  return new Promise((resolve, reject) => {
    const callbackName = `exhibitionOrderCallback_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    const separator = gasUrl.includes("?") ? "&" : "?";
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Apps Script 讀取逾時"));
    }, 10000);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      if (payload?.ok === false) {
        reject(new Error(payload.error || "Google Apps Script 回傳錯誤"));
        return;
      }
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Google Apps Script 無法讀取"));
    };

    script.src = `${gasUrl}${separator}action=getState&callback=${callbackName}&t=${Date.now()}`;
    document.body.append(script);
  });
}

function encodePayload(data) {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

function getCustomerUrl() {
  const url = new URL(location.href);
  url.searchParams.set("mode", "order");
  if (gasUrl) {
    url.searchParams.set("sync", gasUrl);
  } else {
    url.searchParams.delete("sync");
  }
  url.hash = "";
  return url.href;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("zh-TW")}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.toast.classList.remove("show"), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    el.customerUrl.select();
    document.execCommand("copy");
  }
  toast("已複製");
}

function render() {
  const customer = isCustomerMode();
  el.adminView.classList.toggle("hidden", customer);
  el.sellerView.classList.toggle("hidden", customer);
  el.customerView.classList.toggle("hidden", !customer);
  el.modeStatus.textContent = customer ? "客戶下單" : state.published ? "展覽開放中" : "佈展設定";
  el.modeStatus.classList.toggle("locked", state.published);

  if (customer) {
    renderCustomer();
    return;
  }

  el.setupHint.textContent = state.exhibitionDate ? `展覽日期：${formatDisplayDate(state.exhibitionDate)}` : "可提前完成展覽資訊、商品與收款設定";
  el.exhibitionName.value = state.exhibitionName;
  el.exhibitionDate.value = state.exhibitionDate || "";
  el.onsiteCode.value = state.onsiteCode || "";
  el.paymentAccount.value = state.paymentAccount;
  el.gasSettingsBox.classList.toggle("hidden", Boolean(DEFAULT_GAS_URL));
  el.gasUrl.value = gasUrl;
  el.customerUrl.value = getCustomerUrl();
  el.publishBtn.disabled = !state.exhibitionName.trim() || !state.onsiteCode.trim();
  el.closeBtn.disabled = !state.published;

  renderProducts();
  renderProductPanelState();
  renderOrders();
  renderTotals();
  renderHeaderImage();
  renderPaymentQr();
  renderQr(el.customerUrl.value);
  renderRemoteStatus();
}

function renderProductPanelState() {
  const collapsed = Boolean(state.productsCollapsed);
  el.productSettingsBody.classList.toggle("hidden", collapsed);
  el.toggleProductsBtn.textContent = collapsed ? "⌄" : "⌃";
  el.toggleProductsBtn.title = collapsed ? "展開商品設定" : "收合商品設定";
  el.toggleProductsBtn.setAttribute("aria-label", collapsed ? "展開商品設定" : "收合商品設定");
  el.toggleProductsBtn.setAttribute("aria-expanded", String(!collapsed));
}

function renderHeaderImage() {
  const hasImage = Boolean(state.headerImage);
  el.heroImage.src = hasImage ? state.headerImage : "";
  el.headerPreview.src = hasImage ? state.headerImage : "";
  el.heroImage.classList.toggle("hidden", !hasImage);
  el.headerPreview.classList.toggle("hidden", !hasImage);
  document.querySelector(".topbar").classList.toggle("has-hero-image", hasImage);
  el.removeHeaderImageBtn.disabled = !hasImage;
}

function renderPaymentQr() {
  const hasQr = Boolean(state.paymentQrImage);
  el.paymentQrPreview.src = hasQr ? state.paymentQrImage : "";
  el.paymentQrImage.src = hasQr ? state.paymentQrImage : "";
  el.paymentQrPreview.classList.toggle("hidden", !hasQr);
  el.paymentQrImage.classList.toggle("hidden", !hasQr);
  el.removePaymentQrBtn.disabled = !hasQr;
}

function renderRemoteStatus() {
  if (!el.remoteStatus) return;
  if (remoteEnabled && remoteKind === "gas") {
    el.remoteStatus.textContent = "已連線 Google Sheets，客戶手機送出的訂單會同步回賣家後台。";
  } else if (remoteEnabled && remoteKind === "local") {
    el.remoteStatus.textContent = "已連線本機伺服器，適合展場同一台電腦測試。";
  } else if (DEFAULT_GAS_URL && gasUrl === DEFAULT_GAS_URL) {
    el.remoteStatus.textContent = "已使用程式內建的 Google Apps Script URL，正在嘗試連線。";
  } else if (gasUrl) {
    el.remoteStatus.textContent = "已儲存同步網址，正在嘗試連線。";
  } else {
    el.remoteStatus.textContent = "尚未設定雲端同步。只放 GitHub Pages 時，建議搭配 Google Sheets 收單。";
  }
}

function renderProducts() {
  el.products.innerHTML = "";
  if (!state.products.length) {
    el.products.innerHTML = '<div class="empty">尚未建立商品。可手動新增，或上傳商品 CSV。</div>';
    return;
  }

  state.products.forEach((product) => {
    const node = document.createElement("div");
    node.className = "product-row";
    node.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${formatMoney(product.price)} · 每單上限 ${product.limit ? product.limit : "不限"}</small>
      </div>
      <div class="row-actions">
        <button class="secondary" type="button" data-action="edit">編輯</button>
        <button class="delete-order" type="button" data-action="delete" title="刪除" aria-label="刪除">×</button>
      </div>
    `;
    node.querySelector('[data-action="edit"]').addEventListener("click", () => openProductDialog(product));
    node.querySelector('[data-action="delete"]').addEventListener("click", () => {
      state.products = state.products.filter((item) => item.id !== product.id);
      render();
      persist();
    });
    el.products.append(node);
  });
}

function renderOrders() {
  const pending = state.orders.filter((order) => order.status !== "paid");
  const paid = state.orders.filter((order) => order.status === "paid");
  const pendingAmount = pending.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidAmount = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);
  el.orderCount.textContent = `${state.orders.length} 筆訂單，${paid.length} 筆已成立`;
  el.pendingAmount.textContent = formatMoney(pendingAmount);
  el.paidAmount.textContent = formatMoney(paidAmount);
  el.orders.innerHTML = "";

  if (!state.orders.length) {
    el.orders.innerHTML = '<div class="empty">還沒有訂單。</div>';
    return;
  }

  state.orders
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .forEach((order) => {
      const node = document.createElement("div");
      node.className = `order-row ${order.status === "paid" ? "paid" : ""}`;
      node.innerHTML = `
        <div>
          <strong>${escapeHtml(order.orderNumber || "未填號碼")} · ${escapeHtml(order.nickname || "未填暱稱")} · ${formatMoney(order.total)}</strong>
          <small>${escapeHtml(order.recipientName)} · ${order.paymentMethod === "cash" ? "現金" : "轉帳"} · ${escapeHtml(order.phone)} · ${escapeHtml(order.address)}</small>
          ${order.note ? `<small>備註：${escapeHtml(order.note)}</small>` : ""}
        </div>
        <div class="row-actions">
          <span class="order-status">${order.status === "paid" ? "已成立" : "待收款"}</span>
          <button class="primary" type="button" data-action="paid" ${order.status === "paid" ? "disabled" : ""}>已收到款項</button>
          <button class="delete-order" type="button" data-action="delete" title="刪除" aria-label="刪除">×</button>
        </div>
      `;
      node.querySelector('[data-action="paid"]').addEventListener("click", () => markOrderPaid(order.id));
      node.querySelector('[data-action="delete"]').addEventListener("click", () => {
        state.orders = state.orders.filter((item) => item.id !== order.id);
        render();
        persist();
      });
      el.orders.append(node);
    });
}

function renderTotals() {
  const paidOrders = state.orders.filter((order) => order.status === "paid");
  const totalAmount = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

  el.totals.innerHTML = "";
  if (!paidOrders.length) {
    el.totals.innerHTML = '<div class="empty">尚無成立訂單。</div>';
    return;
  }

  const countRow = document.createElement("div");
  countRow.className = "total-row";
  countRow.innerHTML = `<span>成立訂單數</span><strong>${paidOrders.length}</strong>`;
  el.totals.append(countRow);

  const amountRow = document.createElement("div");
  amountRow.className = "total-row";
  amountRow.innerHTML = `<span>成立訂單金額</span><strong>${formatMoney(totalAmount)}</strong>`;
  el.totals.append(amountRow);
}

function renderCustomer() {
  el.customerTitle.textContent = state.exhibitionName || "填寫訂單";
  const eventLabel = [state.exhibitionName || "本次展覽", state.exhibitionDate ? formatDisplayDate(state.exhibitionDate) : ""].filter(Boolean).join(" · ");
  el.customerHint.textContent = state.published ? `${eventLabel} 開放下單中` : "目前尚未開放下單";
  el.orderPanel.classList.toggle("hidden", !state.published);
  el.successPanel.classList.add("hidden");
  renderHeaderImage();
  renderPaymentQr();
}

function renderProductOptions() {
  el.productSelect.innerHTML = "";
  if (!state.products.length) {
    const option = document.createElement("option");
    option.value = "__none__";
    option.textContent = "未設定商品";
    el.productSelect.append(option);
    return;
  }
  state.products.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} ${formatMoney(product.price)}${product.limit ? ` / 上限 ${product.limit}` : ""}`;
    el.productSelect.append(option);
  });
}

function formatDisplayDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

function updateCheckout() {
  if (!el.productSelect || !el.checkoutTotal || !el.quantity) return;
  const product = state.products.find((item) => item.id === el.productSelect.value) || state.products[0];
  if (!product) {
    el.checkoutTotal.textContent = "$0";
    el.quantity.value = 1;
    el.quantity.removeAttribute("max");
    return;
  }
  if (product.limit) {
    el.quantity.max = product.limit;
  } else {
    el.quantity.removeAttribute("max");
  }
  const quantity = Math.max(1, Number(el.quantity.value) || 1);
  el.checkoutTotal.textContent = formatMoney(Number(product.price || 0) * quantity);
}

function openProductDialog(product = null) {
  editingProductId = product?.id || null;
  el.productDialogTitle.textContent = product ? "編輯商品" : "新增商品";
  el.productName.value = product?.name || "";
  el.productPrice.value = product?.price ?? "";
  el.productLimit.value = product?.limit ?? "";
  el.productDialog.showModal();
}

function saveProductFromDialog() {
  const name = el.productName.value.trim();
  const price = Number(el.productPrice.value) || 0;
  const limit = Number(el.productLimit.value) || "";
  if (!name) {
    toast("請輸入商品名稱");
    return;
  }

  const product = { id: editingProductId || createId(), name, price, limit };
  if (editingProductId) {
    state.products = state.products.map((item) => (item.id === editingProductId ? product : item));
  } else {
    state.products = [...state.products, product];
  }
  render();
  persist();
  el.productDialog.close();
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

async function importProducts(file) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  const dataRows = rows[0]?.some((cell) => cell.includes("商品")) ? rows.slice(1) : rows;
  const products = dataRows
    .map(([name, price, limit]) => ({
      id: createId(),
      name: String(name || "").trim(),
      price: Number(String(price || "").replace(/[^\d.]/g, "")) || 0,
      limit: Number(String(limit || "").replace(/[^\d]/g, "")) || ""
    }))
    .filter((product) => product.name);

  if (!products.length) {
    toast("沒有讀到商品資料");
    return;
  }

  state.products = products;
  render();
  persist();
  toast(`已匯入 ${products.length} 個商品`);
}

function downloadProductTemplate() {
  downloadText("商品設定範本.csv", "\ufeff商品名稱,單價,每單上限\n手作耳環,680,2\n香氛蠟燭,420,5\n", "text/csv;charset=utf-8");
}

function exportProductsCsv() {
  if (!state.products.length) {
    toast("目前沒有商品可匯出");
    return;
  }

  const header = ["商品名稱", "單價", "每單上限"];
  const rows = state.products.map((product) => [
    product.name || "",
    product.price || 0,
    product.limit || ""
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const safeName = (state.exhibitionName || "展覽").replace(/[\\/:*?"<>|]/g, "_");
  downloadText(`${safeName}商品設定.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function submitOrder() {
  if (el.orderOnsiteCode.value.trim() !== state.onsiteCode) {
    toast("現場驗證碼不正確，請向攤位確認");
    return;
  }

  const amount = Number(el.orderAmount.value) || 0;
  if (amount <= 0) {
    toast("請輸入訂單金額");
    return;
  }

  const order = {
    id: createId(),
    eventId: state.eventId,
    orderNumber: el.customerOrderNumber.value.trim(),
    nickname: el.nickname.value.trim(),
    recipientName: el.recipientName.value.trim(),
    phone: el.recipientPhone.value.trim(),
    address: el.recipientAddress.value.trim(),
    productId: "",
    productName: "自填金額",
    price: amount,
    quantity: 1,
    total: amount,
    paymentMethod: el.paymentMethod.value,
    onsiteVerified: true,
    note: el.note.value.trim(),
    status: "pending",
    createdAt: new Date().toISOString(),
    paidAt: ""
  };

  state.orders = [...state.orders, order];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveRemoteOrder(order);
  el.orderForm.reset();
  el.successMessage.textContent = `訂單金額 ${formatMoney(order.total)}。`;
  el.paymentInfo.textContent = state.paymentAccount || "現場可洽賣家付款。";
  el.orderPanel.classList.add("hidden");
  el.successPanel.classList.remove("hidden");
}

function markOrderPaid(orderId) {
  state.orders = state.orders.map((order) => {
    if (order.id !== orderId) return order;
    return { ...order, status: "paid", paidAt: new Date().toISOString() };
  });
  render();
  persist();
}

function exportExcel() {
  const header = ["訂單狀態", "訂單號碼", "暱稱", "收件人", "手機", "地址", "訂單金額", "付款方式", "備註", "下單時間", "收款時間"];
  const rows = state.orders.map((order) => [
    order.status === "paid" ? "已成立" : "待收款",
    order.orderNumber || "",
    order.nickname || "",
    order.recipientName,
    order.phone,
    order.address,
    order.total,
    order.paymentMethod === "cash" ? "現金" : "轉帳",
    order.note || "",
    order.createdAt || "",
    order.paidAt || ""
  ]);
  const table = [header, ...rows]
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table>${table}</table></body></html>`;
  downloadText(`${state.exhibitionName || "展覽"}訂單.xls`, html, "application/vnd.ms-excel;charset=utf-8");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function readCompressedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("圖片讀取失敗"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("圖片格式無法讀取"));
      image.onload = () => {
        const maxWidth = 1000;
        const maxHeight = 320;
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = "#fffaf3";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        let quality = 0.78;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 42000 && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        if (dataUrl.length > 42000) {
          reject(new Error("圖片仍然太大，請換一張較小或較簡潔的圖片"));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function readCompressedQrImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("QR Code 圖片讀取失敗"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("QR Code 圖片格式無法讀取"));
      image.onload = () => {
        const maxSize = 520;
        const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        let quality = 0.86;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > 42000 && quality > 0.5) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        if (dataUrl.length > 42000) {
          reject(new Error("QR Code 圖片仍然太大，請換一張較小的圖片"));
          return;
        }
        resolve(dataUrl);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderQr(text) {
  if (!el.qrImage) return;
  el.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(text)}`;
}

el.exhibitionName.addEventListener("input", () => {
  state.exhibitionName = el.exhibitionName.value.trim();
  render();
  persist();
});

el.exhibitionDate.addEventListener("input", () => {
  state.exhibitionDate = el.exhibitionDate.value;
  render();
  persist();
});

el.headerImageFile.addEventListener("change", async () => {
  const file = el.headerImageFile.files[0];
  if (!file) return;
  try {
    state.headerImage = await readCompressedImage(file);
    el.headerImageFile.value = "";
    render();
    persist();
    toast("已更新頁首圖片");
  } catch (error) {
    el.headerImageFile.value = "";
    toast(error.message || "圖片上傳失敗");
  }
});

el.removeHeaderImageBtn.addEventListener("click", () => {
  state.headerImage = "";
  render();
  persist();
  toast("已移除頁首圖片");
});

el.onsiteCode.addEventListener("input", () => {
  state.onsiteCode = el.onsiteCode.value.trim();
  render();
  persist();
});

el.paymentAccount.addEventListener("input", () => {
  state.paymentAccount = el.paymentAccount.value.trim();
  persist();
});

el.paymentQrFile.addEventListener("change", async () => {
  const file = el.paymentQrFile.files[0];
  if (!file) return;
  try {
    state.paymentQrImage = await readCompressedQrImage(file);
    el.paymentQrFile.value = "";
    render();
    persist();
    toast("已更新收款 QR Code");
  } catch (error) {
    el.paymentQrFile.value = "";
    toast(error.message || "QR Code 上傳失敗");
  }
});

el.removePaymentQrBtn.addEventListener("click", () => {
  state.paymentQrImage = "";
  render();
  persist();
  toast("已移除收款 QR Code");
});

el.publishBtn.addEventListener("click", () => {
  state.published = true;
  render();
  persist();
  toast("展覽已開放下單");
});

el.closeBtn.addEventListener("click", () => {
  state.published = false;
  render();
  persist();
  toast("已關閉下單");
});

el.resetBtn.addEventListener("click", () => {
  if (!confirm("確定要重新建立本次展覽？既有訂單會清空。")) return;
  state = createEmptyState();
  render();
  persist();
});

el.saveGasBtn.addEventListener("click", () => {
  gasUrl = el.gasUrl.value.trim();
  localStorage.setItem(GAS_URL_KEY, gasUrl);
  remoteKind = gasUrl ? "gas" : "none";
  remoteEnabled = Boolean(gasUrl);
  renderRemoteStatus();
  saveRemoteState();
  window.setTimeout(syncRemoteState, 800);
  toast("已儲存同步網址");
});

el.clearGasBtn.addEventListener("click", () => {
  gasUrl = DEFAULT_GAS_URL;
  localStorage.removeItem(GAS_URL_KEY);
  remoteEnabled = Boolean(gasUrl);
  remoteKind = gasUrl ? "gas" : "none";
  renderRemoteStatus();
  toast("已清除同步網址");
  if (gasUrl) {
    saveRemoteState();
    window.setTimeout(syncRemoteState, 800);
  }
});

el.copyUrlBtn.addEventListener("click", () => copyText(getCustomerUrl()));
el.openCustomerBtn.addEventListener("click", () => window.open(getCustomerUrl(), "_blank", "noopener"));
el.toggleProductsBtn.addEventListener("click", () => {
  state.productsCollapsed = !state.productsCollapsed;
  render();
  persist();
});
el.addProductBtn.addEventListener("click", () => openProductDialog());
el.productFile.addEventListener("change", () => importProducts(el.productFile.files[0]));
el.downloadTemplateBtn.addEventListener("click", downloadProductTemplate);
el.exportProductsBtn.addEventListener("click", exportProductsCsv);
el.saveProductBtn.addEventListener("click", (event) => {
  event.preventDefault();
  saveProductFromDialog();
});
el.exportBtn.addEventListener("click", exportExcel);

if (el.productSelect) el.productSelect.addEventListener("change", updateCheckout);
if (el.quantity) el.quantity.addEventListener("input", updateCheckout);
el.orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitOrder();
});

render();
if (gasUrl) {
  localStorage.setItem(GAS_URL_KEY, gasUrl);
}
syncRemoteState();
window.setInterval(syncRemoteState, 2500);
