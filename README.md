# 大富翁（Monopoly）— 線上雙人版

台灣主題的大富翁桌遊，支援 **2 名玩家在不同裝置上線連線對戰**。

**線上網址（Render）：** https://poker-math-duel.onrender.com

## 功能

- 建立／加入房間（6 位房間代碼）
- 即時同步棋盤、骰子、購地、收租
- 28 格台灣地產棋盤
- 機會卡、稅金、入獄等完整規則

## 本地開發

```bash
npm install
npm run dev
```

- 前端：http://localhost:43124
- 後端（WebSocket）：http://localhost:43123

用兩個瀏覽器分頁或兩台裝置測試連線。

## 部署到 Render（跟朋友一起玩）

### 1. 推到 GitHub（repo：`yuchendou/poker-math-duel`）

在本機終端機（需已登入 GitHub）執行：

```bash
chmod +x deploy-to-github.sh
./deploy-to-github.sh
```

或手動：

```bash
git remote add github git@github.com:yuchendou/poker-math-duel.git
git push github main --force
```

### 2. Render 設定（你已有 `poker-math-duel` 服務）

推送後 Render 通常會自動重新部署。若仍是舊版（Python／麻將），到 Dashboard 手動改：

| 項目 | 值 |
|------|-----|
| Runtime | **Node** |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |

然後點 **Manual Deploy → Deploy latest commit**。

### 3. 怎麼玩

1. 玩家 A 開啟 Render 網址 → **建立房間** → 記下 6 位代碼
2. 玩家 B 在另一台手機／電腦開啟同一網址 → **加入房間** → 輸入代碼
3. 兩人到齊後自動開始，輪流擲骰

## 技術棧

- 前端：Vite + React + TypeScript + Tailwind CSS
- 後端：Express + Socket.io
- 部署：Render Web Service（Node）
