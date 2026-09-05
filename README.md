# 大富翁（Monopoly）— 線上雙人版

台灣主題的大富翁桌遊，支援 **2 名玩家在不同裝置上線連線對戰**。

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

### 1. 推到 GitHub

```bash
# 在 GitHub 建立 repo，例如 monopoly-game
git remote add github git@github.com:yuchendou/monopoly-game.git
git push -u github main
```

### 2. Render 設定

1. 登入 [render.com](https://render.com)
2. **New +** → **Web Service**（不是 Static Site）
3. 連接 GitHub repo
4. 設定：
   - **Runtime**：Node
   - **Build Command**：`npm install && npm run build`
   - **Start Command**：`npm start`
5. 部署完成後得到 `https://你的服務名.onrender.com`

> repo 根目錄已有 `render.yaml`，也可用 **New Blueprint** 一鍵部署。

### 3. 怎麼玩

1. 玩家 A 開啟 Render 網址 → **建立房間** → 記下 6 位代碼
2. 玩家 B 在另一台手機／電腦開啟同一網址 → **加入房間** → 輸入代碼
3. 兩人到齊後自動開始，輪流擲骰

## 技術棧

- 前端：Vite + React + TypeScript + Tailwind CSS
- 後端：Express + Socket.io
- 部署：Render Web Service（Node）
