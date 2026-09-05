#!/bin/bash
# 將大富翁遊戲推送到 yuchendou/poker-math-duel
set -e

REMOTE="git@github.com:yuchendou/poker-math-duel.git"

if git remote | grep -q '^github$'; then
  git remote set-url github "$REMOTE"
else
  git remote add github "$REMOTE"
fi

echo "推送到 $REMOTE ..."
git push github main --force

echo ""
echo "✅ 推送完成！"
echo "Render 會自動重新部署（若已連接 GitHub）。"
echo "網址：https://poker-math-duel.onrender.com"
echo ""
echo "若 Render 仍顯示 Python，請到 Dashboard 確認："
echo "  Runtime: Node"
echo "  Build: npm install && npm run build"
echo "  Start: npm start"
