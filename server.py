#!/usr/bin/env python3
"""雙人連線撲克牌加減乘除對戰 — WebSocket 伺服器（部署到 Render 等雲端）"""

import os
import random
import re

from flask import Flask, jsonify
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "poker-math-duel")
socketio = SocketIO(app, cors_allowed_origins="*")

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
RANK_VALUES = {"A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
               "8": 8, "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13}
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

rooms: dict = {}
sid_to_room: dict = {}


def generate_room_code() -> str:
    while True:
        code = "".join(random.choice(CODE_CHARS) for _ in range(4))
        if code not in rooms:
            return code


def draw_cards():
    deck = [
        {"suit": s, "rank": r, "value": RANK_VALUES[r], "isRed": s in ("♥", "♦")}
        for s in SUITS for r in RANKS
    ]
    random.shuffle(deck)
    return deck[:4]


def compute_all_results(nums):
    results = set()

    def solve(remaining):
        if len(remaining) == 1:
            v = remaining[0]
            if abs(v - round(v)) < 1e-9:
                results.add(round(v))
            return
        for i in range(len(remaining)):
            for j in range(len(remaining)):
                if i == j:
                    continue
                rest = [remaining[k] for k in range(len(remaining)) if k not in (i, j)]
                a, b = remaining[i], remaining[j]
                for val in (a + b, a - b, a * b):
                    solve(rest + [val])
                if abs(b) > 1e-9:
                    solve(rest + [a / b])

    solve(list(nums))
    return [n for n in results if 0 < n <= 100]


def generate_puzzle():
    for _ in range(50):
        cards = draw_cards()
        values = [c["value"] for c in cards]
        possible = compute_all_results(values)
        if possible:
            return {"cards": cards, "target": random.choice(possible), "values": values}
    return {
        "cards": [
            {"suit": "♠", "rank": "3", "value": 3, "isRed": False},
            {"suit": "♥", "rank": "4", "value": 4, "isRed": True},
            {"suit": "♦", "rank": "5", "value": 5, "isRed": True},
            {"suit": "♣", "rank": "6", "value": 6, "isRed": False},
        ],
        "target": 24,
        "values": [3, 4, 5, 6],
    }


def uses_each_card_once(expression, values):
    used = [int(x) for x in re.findall(r"\d+", expression)]
    if len(used) != len(values):
        return False
    return sorted(used) == sorted(values)


def safe_eval(expr):
    sanitized = re.sub(r"\s", "", expr)
    if not re.fullmatch(r"[\d+\-*/().]+", sanitized):
        return None
    if re.search(r"[+\-*/]{2,}", sanitized):
        return None
    try:
        result = eval(sanitized, {"__builtins__": {}}, {})  # noqa: S307
        return result if isinstance(result, (int, float)) and abs(result) != float("inf") else None
    except Exception:
        return None


def get_room_state(room):
    return {
        "code": room["code"],
        "players": room["players"],
        "isFull": len(room["players"]) == 2,
        "gameState": room["gameState"],
        "round": room["round"],
        "scores": room["scores"],
    }


def broadcast_room(room):
    socketio.emit("room:update", get_room_state(room), room=room["code"])


@app.route("/")
def index():
    return jsonify({"status": "ok", "message": "撲克數學對戰 API 運行中", "health": "/health"})


@app.route("/health")
def health():
    return jsonify({"status": "ok", "rooms": len(rooms)})


@socketio.on("connect")
def on_connect():
    pass


@socketio.on("room:create")
def on_create(data):
    from flask import request
    sid = request.sid
    name = (data.get("name") or "玩家").strip()[:12] or "玩家"
    code = generate_room_code()
    room = {
        "code": code,
        "players": [{"id": sid, "name": name, "isHost": True}],
        "gameState": "waiting",
        "round": None,
        "scores": {sid: 0},
    }
    rooms[code] = room
    sid_to_room[sid] = code
    join_room(code)
    emit("room:created", {"code": code})
    broadcast_room(room)


@socketio.on("room:join")
def on_join(data):
    from flask import request
    sid = request.sid
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "玩家").strip()[:12] or "玩家"
    room = rooms.get(code)

    if not room:
        emit("error", {"message": "找不到這個房間代碼"})
        return
    if len(room["players"]) >= 2:
        emit("error", {"message": "房間已滿（最多 2 人）"})
        return

    room["players"].append({"id": sid, "name": name, "isHost": False})
    room["scores"][sid] = 0
    sid_to_room[sid] = code
    join_room(code)
    emit("room:joined", {"code": code})
    broadcast_room(room)

    if len(room["players"]) == 2:
        socketio.emit(
            "room:both-connected",
            {"message": "兩位玩家都已連線！可以開始遊戲了"},
            room=code,
        )


@socketio.on("game:start-round")
def on_start_round():
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room:
        return
    player = next((p for p in room["players"] if p["id"] == sid), None)
    if not player or not player.get("isHost"):
        emit("error", {"message": "只有房主可以出題"})
        return
    if len(room["players"]) < 2:
        emit("error", {"message": "需要兩位玩家連線才能開始"})
        return

    puzzle = generate_puzzle()
    room["gameState"] = "playing"
    room["round"] = {
        "cards": puzzle["cards"],
        "target": puzzle["target"],
        "values": puzzle["values"],
        "winner": None,
        "submissions": {},
    }
    socketio.emit("game:new-round", {
        "cards": puzzle["cards"],
        "target": puzzle["target"],
    }, room=code)
    broadcast_room(room)


@socketio.on("game:submit")
def on_submit(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return

    expr = (data.get("expression") or "").strip()
    result = safe_eval(expr)
    if result is None:
        emit("game:result", {"correct": False, "message": "算式格式不正確"})
        return
    if not uses_each_card_once(expr, rnd["values"]):
        emit("game:result", {"correct": False, "message": "必須剛好使用四張牌的數字各一次"})
        return

    correct = abs(result - rnd["target"]) < 1e-9
    rnd["submissions"][sid] = {"expression": expr, "correct": correct, "result": result}

    if correct:
        rnd["winner"] = sid
        room["scores"][sid] = room["scores"].get(sid, 0) + 1
        winner = next((p for p in room["players"] if p["id"] == sid), None)
        socketio.emit("game:round-won", {
            "winnerId": sid,
            "winnerName": winner["name"] if winner else "玩家",
            "expression": expr,
            "result": result,
            "target": rnd["target"],
            "scores": room["scores"],
        }, room=code)
        room["gameState"] = "round-end"
    else:
        emit("game:result", {
            "correct": False,
            "message": f"結果是 {result}，目標是 {rnd['target']}",
            "result": result,
        })
    broadcast_room(room)


@socketio.on("disconnect")
def on_disconnect():
    from flask import request
    sid = request.sid
    code = sid_to_room.pop(sid, None)
    if not code:
        return
    room = rooms.get(code)
    if not room:
        return

    room["players"] = [p for p in room["players"] if p["id"] != sid]
    room["scores"].pop(sid, None)

    if not room["players"]:
        rooms.pop(code, None)
    else:
        room["players"][0]["isHost"] = True
        room["gameState"] = "waiting"
        room["round"] = None
        socketio.emit(
            "room:player-left",
            {"message": "對手已離線，等待重新連線或新玩家加入"},
            room=code,
        )
        broadcast_room(room)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"🃏 撲克數學對戰 API 已啟動：http://localhost:{port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
