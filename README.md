# 展覽訂單系統

這是一個可部署到 GitHub Pages 的展覽下單頁。賣家在佈展前設定商品、單價、每單數量上限、現場驗證碼和收款帳戶；客戶掃 QR Code 後可直接填單，送出前需輸入現場驗證碼；賣家收到轉帳或現金後，在後台按「已收到款項」，該筆訂單才算成立。

## 功能

- 上傳 CSV 商品設定：商品名稱、單價、每單上限
- 商品設定區可收合，方便先快速建立展覽資訊
- 匯出商品設定 CSV，可用 Excel 暫存、編輯後再匯入
- 設定展覽日期與現場驗證碼，方便提前完成佈展準備
- 設定現場驗證碼，客戶下單時必填以降低連結轉傳風險
- 上傳頁首圖片，作為品牌圖、攤位主視覺或商品氛圍照
- 上傳收款 QR Code，客戶送出訂單後可直接掃碼付款
- 產生客戶下單 QR Code
- 客戶填寫收件人、手機、地址、付款方式和備註
- 客戶填寫訂單號碼、暱稱、收件人、手機、地址、付款方式和備註
- 下單完成後顯示賣家收款帳戶
- 賣家可標記「已收到款項」
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
7. 回到展覽訂單系統後台，貼到 `Google Apps Script Web App URL` 並儲存。
8. 再複製或列印畫面上的 QR Code 給客戶掃描。

後台產生的客戶網址會自動帶上同步網址，所以客戶手機掃 QR Code 後能讀到同一場展覽設定並送出訂單。

## 商品 CSV 格式

```csv
商品名稱,單價,每單上限
手作耳環,680,2
香氛蠟燭,420,5
```

`每單上限` 可留空，代表不限。

商品設定區的「匯出商品設定」會下載目前商品清單。用 Excel 開啟後可新增或修改商品，再另存為 CSV，回到網頁用「選擇檔案」匯入即可。

## 本機預覽

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```

開啟：

```text
http://localhost:8787/
```

本機伺服器只適合測試；正式展場建議使用 GitHub Pages + Google Apps Script。
