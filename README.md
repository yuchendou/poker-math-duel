# 大富翁（Monopoly）

台灣主題的多人大富翁桌遊，支援 2–4 名玩家在同一裝置上輪流遊玩。

## 功能

- 28 格棋盤，包含台灣各地地產（台北車站、101 大樓、墾丁等）
- 擲骰子移動、購買地產、收取租金
- 同色地產全數持有時租金加倍
- 機會卡、所得稅、奢侈稅
- 入獄／探監機制
- 破產出局，最後倖存者獲勝

## 部署上線（跟朋友一起玩）

> **重要**：之前 Cursor 裡的 `http://127.0.0.1:43123` 只是本機預覽，關掉就失效，**不是** Render 網址。
>
> 目前遊戲是「同一台裝置輪流玩」（傳手機／圍在一起玩）。部署後會得到一個永久網址，任何人用瀏覽器打開就能玩。

### 方法一：Render（推薦，你之前可能用的就是這個）

1. 把程式碼推到 GitHub（見下方「推到 GitHub」）
2. 前往 [render.com](https://render.com) 登入
3. 點 **New +** → **Static Site**
4. 連接你的 GitHub  repo（例如 `poker-math-duel`）
5. 設定如下：
   - **Build Command**：`npm install && npm run build`
   - **Publish Directory**：`dist`
6. 點 **Create Static Site**，等 2–3 分鐘
7. 完成後會得到網址，例如：`https://monopoly-game-xxxx.onrender.com`

若 repo 根目錄已有 `render.yaml`，也可在 Render 選 **New Blueprint** 一鍵部署。

### 方法二：Vercel（更簡單）

1. 程式碼推到 GitHub
2. 前往 [vercel.com](https://vercel.com) 登入
3. **Add New Project** → 選你的 repo → 直接 Deploy（會自動偵測 Vite）
4. 完成後得到 `https://xxx.vercel.app`

### 方法三：Netlify

1. 程式碼推到 GitHub
2. 前往 [netlify.com](https://netlify.com) 登入
3. **Add new site** → **Import an existing project** → 選 repo
4. Build command：`npm run build`，Publish directory：`dist`

### 推到 GitHub

在本機終端機（或 Cursor 終端機）執行：

```bash
# 若還沒建立 GitHub repo，先到 github.com 新建一個（例如 monopoly-game）

git remote add github git@github.com:yuchendou/你的repo名稱.git
git push -u github main
```

若 `poker-math-duel` 已有舊專案，可以新建 repo（例如 `monopoly-game`）避免覆蓋撲克遊戲。

## 開始遊玩

```bash
npm install
npm run dev
```

在瀏覽器開啟 `http://localhost:43123`。

## 建置

```bash
npm run build
npm run preview
```

## 遊戲規則

| 項目 | 說明 |
|------|------|
| 起始資金 | $15,000 |
| 經過起點 | 獲得 $2,000 |
| 破產 | 資金不足以支付時出局，資產轉移給債權人 |
| 監獄 | 擲出雙骰出獄，或連續 3 回合後付 $500 保釋金 |

## 技術棧

- Vite + React + TypeScript
- Tailwind CSS
