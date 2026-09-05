# 雙人遊戲坊（poker-math-duel）

雙人線上連線遊戲平台，部署於 Render。

**線上網址：** https://poker-math-duel.onrender.com

## 包含遊戲

| 遊戲 | 說明 |
|------|------|
| 🃏 撲克數學 | 四張牌加減乘除，湊出目標整數 |
| 🔢 雙人數獨 | 同一題比誰先填完 |
| 🎯 幾A幾B | 各自出題，輪流猜 |
| 🀄 台灣麻將 | 吃碰槓胡、完整台數 |
| 🎲 **大富翁** | 擲骰買地、收租（台灣地標棋盤） |
| 🧩 Block Blast | 單人解題 |

## 怎麼跟朋友玩

1. 兩人開啟同一網址
2. **選同一個遊戲**（例如大富翁）
3. 玩家 A 建立房間 → 把 4 位代碼給 B
4. 玩家 B 加入 → 房主按「開始遊戲」

## Render 部署（無需改 Runtime）

此 repo 使用 **Python 3**，Render 設定維持：

- Build：`pip install -r requirements.txt`
- Start：`python server.py`

推送 `main` 分支後 Render 會自動重新部署。

## 本地開發

```bash
pip install -r requirements.txt
python server.py
```

開啟 http://localhost:5000
