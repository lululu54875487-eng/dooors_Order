# 展覽訂單系統

這是一個可部署到 GitHub Pages 的展覽下單頁。賣家可設定收款帳戶或收款 QR Code；若未設定，客戶送出訂單後會提示依現場提供的收款方式付款。客戶掃 QR Code 後直接填寫訂單金額與收件資訊；賣家確認收到轉帳或現金後，在後台按「已收到款項」，該筆訂單才算成立。

## 功能

- 客戶直接輸入訂單金額，不需要先建立商品清單
- 上傳收款 QR Code，客戶送出訂單後可直接掃碼付款
- 產生客戶下單 QR Code
- 客戶填寫訂單號碼、暱稱、訂單金額、收件人、手機、地址、付款方式和備註
- 下單完成後顯示賣家收款帳戶
- 賣家可標記「已收到款項」
- 客戶送出後可修改剛送出的訂單，賣家後台也可刪除訂單
- 展後匯出 Excel 可開啟的 `.xls` 訂單表

## GitHub Pages 部署

1. 將檔案放到 `lululu54875487-eng/dooors_Order` 的 `main` branch。
2. 到 GitHub repo 的 `Settings` -> `Pages`。
3. Source 選 `GitHub Actions`。
4. push 後會由 `.github/workflows/pages.yml` 自動部署。

部署完成後，網址通常會是：

```text
https://lululu54875487-eng.github.io/dooors_Order/
```

## 跨手機收單

GitHub Pages 是靜態網站，不能自己接收客戶手機送出的訂單。要讓客戶手機的訂單同步回賣家後台，請搭配 Google Apps Script + Google Sheets：

1. 建立一個 Google Sheet。
2. 在 Google Sheet 選 `擴充功能` -> `Apps Script`。
3. 貼上 `apps-script/Code.gs`。
4. 將檔案最上方的 `SPREADSHEET_ID` 換成你的 Google Sheet ID。
5. 部署為 Web App，權限選「任何人」可存取。
6. 複製結尾是 `/exec` 的 Web App URL。
7. 將 Web App URL 貼到 `app.js` 最上方的 `DEFAULT_GAS_URL`，重新上傳 GitHub Pages。
8. 回到展覽訂單系統後台確認已連線，之後就不用每次輸入同步網址。
9. 再複製或列印畫面上的 QR Code 給客戶掃描。

後台產生的客戶網址會自動帶上同步網址，所以客戶手機掃 QR Code 後能讀到同一場展覽設定並送出訂單。

Apps Script 會固定寫入同一份 Google Sheet。系統設定會存在 `State` 分頁；按下「發布展覽」後，訂單才會依發布日期自動建立分頁，例如 `2026-06-15_展覽訂單`。

如果 `app.js` 的 `DEFAULT_GAS_URL` 已填入網址，後台會自動隱藏 `Google Apps Script Web App URL` 欄位；只有沒有設定預設網址時才會顯示手動輸入欄位。

## 本機預覽

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

開啟：

```text
http://localhost:8787/
```

本機伺服器只適合測試；正式展場建議使用 GitHub Pages + Google Apps Script。
