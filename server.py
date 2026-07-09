#!/usr/bin/env python3
"""雙人連線遊戲平台 — 撲克數學、數獨、幾A幾B"""

import os
import random
import re

from flask import Flask, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "docs")

app = Flask(__name__, static_folder=DOCS_DIR, static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "poker-math-duel")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

GAME_TYPES = {"poker", "sudoku", "bulls"}
GAME_LABELS = {"poker": "撲克數學", "sudoku": "雙人數獨", "bulls": "幾A幾B"}

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
RANK_VALUES = {"A": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
               "8": 8, "9": 9, "10": 10}
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


def compute_integer_results(nums):
    """只計算全程可用整數運算（含整除）達成的目標"""
    results = set()

    def solve(remaining):
        if len(remaining) == 1:
            v = remaining[0]
            if isinstance(v, int) and v > 0:
                results.add(v)
            return
        for i in range(len(remaining)):
            for j in range(len(remaining)):
                if i == j:
                    continue
                rest = [remaining[k] for k in range(len(remaining)) if k not in (i, j)]
                a, b = remaining[i], remaining[j]
                candidates = {a + b, a - b, b - a, a * b}
                if b != 0 and a % b == 0:
                    candidates.add(a // b)
                if a != 0 and b % a == 0:
                    candidates.add(b // a)
                for val in candidates:
                    if val > 0:
                        solve(rest + [val])

    solve([int(n) for n in nums])
    return sorted(n for n in results if 1 <= n <= 30)


def pick_friendly_target(targets):
    """偏好常見、好算的整數目標"""
    preferred = [n for n in targets if n in {12, 15, 18, 20, 24, 25, 30}]
    pool = preferred or [n for n in targets if 6 <= n <= 24] or targets
    return random.choice(pool)


def generate_puzzle():
    for _ in range(80):
        cards = draw_cards()
        values = [c["value"] for c in cards]
        possible = compute_integer_results(values)
        if len(possible) >= 3:
            return {
                "cards": cards,
                "target": pick_friendly_target(possible),
                "values": values,
            }
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


def safe_eval(expr):
    sanitized = re.sub(r"\s", "", expr)
    if not re.fullmatch(r"[\d+\-*/().]+", sanitized):
        return None
    if re.search(r"[+\-*/]{2,}", sanitized):
        return None
    try:
        result = eval(sanitized, {"__builtins__": {}}, {})  # noqa: S307
        if not isinstance(result, (int, float)) or abs(result) == float("inf"):
            return None
        if abs(result - round(result)) > 1e-9:
            return None
        return int(round(result))
    except Exception:
        return None


def uses_each_card_once(expression, values):
    used = [int(x) for x in re.findall(r"\d+", expression)]
    if len(used) != len(values):
        return False
    return sorted(used) == sorted(values)


# ── 數獨 ──────────────────────────────────────────────

def _sudoku_valid(grid, row, col, num):
    if num in grid[row]:
        return False
    if num in [grid[r][col] for r in range(9)]:
        return False
    br, bc = 3 * (row // 3), 3 * (col // 3)
    for r in range(br, br + 3):
        for c in range(bc, bc + 3):
            if grid[r][c] == num:
                return False
    return True


def _sudoku_solve(grid):
    for row in range(9):
        for col in range(9):
            if grid[row][col] == 0:
                nums = list(range(1, 10))
                random.shuffle(nums)
                for num in nums:
                    if _sudoku_valid(grid, row, col, num):
                        grid[row][col] = num
                        if _sudoku_solve(grid):
                            return True
                        grid[row][col] = 0
                return False
    return True


def _sudoku_complete():
    grid = [[0] * 9 for _ in range(9)]
    _sudoku_solve(grid)
    return grid


def generate_sudoku_puzzle(clues=36):
    solution = _sudoku_complete()
    puzzle = [row[:] for row in solution]
    cells = [(r, c) for r in range(9) for c in range(9)]
    random.shuffle(cells)
    for r, c in cells[: 81 - clues]:
        puzzle[r][c] = 0
    return {"puzzle": puzzle, "solution": solution}


def validate_sudoku_grid(player_grid, solution, puzzle):
    if len(player_grid) != 9 or any(len(row) != 9 for row in player_grid):
        return False, "格子格式不正確"
    for r in range(9):
        for c in range(9):
            val = player_grid[r][c]
            if not isinstance(val, int) or val < 1 or val > 9:
                return False, "還有空格沒填完"
            if puzzle[r][c] != 0 and val != puzzle[r][c]:
                return False, "不能修改題目給定的數字"
            if val != solution[r][c]:
                return False, "有數字填錯了，再檢查一下"
    return True, "完成！"


# ── 幾A幾B ──────────────────────────────────────────

def calc_ab(secret, guess):
    a = sum(1 for i in range(4) if secret[i] == guess[i])
    secret_rest = []
    guess_rest = []
    for i in range(4):
        if secret[i] != guess[i]:
            secret_rest.append(secret[i])
            guess_rest.append(guess[i])
    b = 0
    for g in guess_rest:
        if g in secret_rest:
            b += 1
            secret_rest.remove(g)
    return a, b


def validate_bulls_guess(guess):
    if not re.fullmatch(r"\d{4}", guess):
        return False, "請輸入 4 位數字"
    if len(set(guess)) != 4:
        return False, "4 個數字不能重複"
    return True, ""


def get_room_state(room):
    return {
        "code": room["code"],
        "gameType": room["gameType"],
        "gameLabel": GAME_LABELS.get(room["gameType"], ""),
        "players": room["players"],
        "isFull": len(room["players"]) == 2,
        "gameState": room["gameState"],
        "round": room["round"],
    }


def broadcast_room(room):
    socketio.emit("room:update", get_room_state(room), room=room["code"])


@app.route("/")
def index():
    return send_from_directory(DOCS_DIR, "index.html")


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
    game_type = data.get("gameType", "poker")
    if game_type not in GAME_TYPES:
        emit("error", {"message": "不支援的遊戲類型"})
        return
    code = generate_room_code()
    room = {
        "code": code,
        "gameType": game_type,
        "players": [{"id": sid, "name": name, "isHost": True}],
        "gameState": "waiting",
        "round": None,
    }
    rooms[code] = room
    sid_to_room[sid] = code
    join_room(code)
    emit("room:created", {"code": code, "gameType": game_type})
    broadcast_room(room)


@socketio.on("room:join")
def on_join(data):
    from flask import request
    sid = request.sid
    code = (data.get("code") or "").strip().upper()
    name = (data.get("name") or "玩家").strip()[:12] or "玩家"
    game_type = data.get("gameType", "poker")
    room = rooms.get(code)

    if not room:
        emit("error", {"message": "找不到這個房間代碼"})
        return
    if room["gameType"] != game_type:
        emit("error", {"message": f"這是「{GAME_LABELS[room['gameType']]}」房間，請選對遊戲再加入"})
        return
    if len(room["players"]) >= 2:
        emit("error", {"message": "房間已滿（最多 2 人）"})
        return

    room["players"].append({"id": sid, "name": name, "isHost": False})
    sid_to_room[sid] = code
    join_room(code)
    emit("room:joined", {"code": code, "gameType": room["gameType"]})
    broadcast_room(room)

    if len(room["players"]) == 2:
        socketio.emit(
            "room:both-connected",
            {"message": "兩位玩家都已連線！可以開始遊戲了"},
            room=code,
        )


def start_poker_round(room, code):
    puzzle = generate_puzzle()
    room["gameState"] = "playing"
    room["round"] = {
        "cards": puzzle["cards"],
        "target": puzzle["target"],
        "values": puzzle["values"],
        "winner": None,
        "submissions": {},
    }
    socketio.emit("game:poker-new-round", {
        "cards": puzzle["cards"],
        "target": puzzle["target"],
    }, room=code)


def start_sudoku_round(room, code):
    sudoku = generate_sudoku_puzzle(clues=36)
    room["gameState"] = "playing"
    room["round"] = {
        "puzzle": sudoku["puzzle"],
        "solution": sudoku["solution"],
        "winner": None,
        "submissions": {},
    }
    socketio.emit("game:sudoku-new-round", {
        "puzzle": sudoku["puzzle"],
    }, room=code)


def start_bulls_round(room, code):
    first = room["players"][0]
    room["gameState"] = "setup"
    room["round"] = {
        "secrets": {},
        "winner": None,
        "turnIndex": 0,
        "currentTurn": first["id"],
        "history": [],
    }
    socketio.emit("game:bulls-setup", {
        "submittedIds": [],
    }, room=code)


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
        emit("error", {"message": "只有房主可以開始"})
        return
    if len(room["players"]) < 2:
        emit("error", {"message": "需要兩位玩家連線才能開始"})
        return

    if room["gameType"] == "poker":
        start_poker_round(room, code)
    elif room["gameType"] == "sudoku":
        start_sudoku_round(room, code)
    else:
        start_bulls_round(room, code)
    broadcast_room(room)


@socketio.on("game:poker-submit")
def on_poker_submit(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "poker" or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return

    expr = (data.get("expression") or "").strip()
    result = safe_eval(expr)
    if result is None:
        emit("game:poker-result", {"correct": False, "message": "算式不正確，且答案必須是整數（除法只能整除）"})
        return
    if not uses_each_card_once(expr, rnd["values"]):
        emit("game:poker-result", {"correct": False, "message": "必須剛好使用四張牌的數字各一次"})
        return

    correct = result == rnd["target"]
    rnd["submissions"][sid] = {"expression": expr, "correct": correct, "result": result}

    if correct:
        rnd["winner"] = sid
        winner = next((p for p in room["players"] if p["id"] == sid), None)
        socketio.emit("game:poker-won", {
            "winnerId": sid,
            "winnerName": winner["name"] if winner else "玩家",
            "expression": expr,
            "result": result,
            "target": rnd["target"],
        }, room=code)
        room["gameState"] = "round-end"
    else:
        emit("game:poker-result", {
            "correct": False,
            "message": f"結果是 {result}，目標是 {rnd['target']}",
            "result": result,
        })
    broadcast_room(room)


@socketio.on("game:sudoku-submit")
def on_sudoku_submit(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "sudoku" or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return

    grid = data.get("grid")
    ok, message = validate_sudoku_grid(grid, rnd["solution"], rnd["puzzle"])
    rnd["submissions"][sid] = {"correct": ok, "message": message}

    if ok:
        rnd["winner"] = sid
        winner = next((p for p in room["players"] if p["id"] == sid), None)
        socketio.emit("game:sudoku-won", {
            "winnerId": sid,
            "winnerName": winner["name"] if winner else "玩家",
        }, room=code)
        room["gameState"] = "round-end"
    else:
        emit("game:sudoku-result", {"correct": False, "message": message})
    broadcast_room(room)


def _bulls_next_turn(room, rnd):
    rnd["turnIndex"] = (rnd["turnIndex"] + 1) % len(room["players"])
    player = room["players"][rnd["turnIndex"]]
    rnd["currentTurn"] = player["id"]
    return player


@socketio.on("game:bulls-set-secret")
def on_bulls_set_secret(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "bulls" or room["gameState"] != "setup":
        return
    rnd = room.get("round")
    if not rnd:
        return

    secret = (data.get("secret") or "").strip()
    ok, message = validate_bulls_guess(secret)
    if not ok:
        emit("game:bulls-result", {"correct": False, "message": message})
        return
    if sid in rnd["secrets"]:
        emit("game:bulls-result", {"correct": False, "message": "你已經出過題了"})
        return

    rnd["secrets"][sid] = secret
    emit("game:bulls-secret-ok", {})

    socketio.emit("game:bulls-setup-update", {
        "submittedIds": list(rnd["secrets"].keys()),
    }, room=code)

    if len(rnd["secrets"]) == len(room["players"]):
        room["gameState"] = "playing"
        first = room["players"][0]
        socketio.emit("game:bulls-new-round", {
            "currentTurnId": first["id"],
            "currentTurnName": first["name"],
            "history": [],
        }, room=code)
    broadcast_room(room)


@socketio.on("game:bulls-guess")
def on_bulls_guess(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "bulls" or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return

    if sid != rnd["currentTurn"]:
        emit("game:bulls-result", {"correct": False, "message": "還沒輪到你，請等待對手猜測"})
        return

    guess = (data.get("guess") or "").strip()
    ok, message = validate_bulls_guess(guess)
    if not ok:
        emit("game:bulls-result", {"correct": False, "message": message})
        return

    opponent = next((p for p in room["players"] if p["id"] != sid), None)
    if not opponent:
        return
    opponent_secret = rnd["secrets"].get(opponent["id"])
    if not opponent_secret:
        emit("game:bulls-result", {"correct": False, "message": "對手尚未出題，請稍候"})
        return

    player = next((p for p in room["players"] if p["id"] == sid), None)
    a, b = calc_ab(opponent_secret, guess)
    entry = {
        "playerId": sid,
        "playerName": player["name"] if player else "玩家",
        "guess": guess,
        "a": a,
        "b": b,
    }
    rnd["history"].append(entry)

    if a == 4:
        rnd["winner"] = sid
        socketio.emit("game:bulls-won", {
            "winnerId": sid,
            "winnerName": player["name"] if player else "玩家",
            "guess": guess,
            "secret": opponent_secret,
            "opponentName": opponent["name"],
            "revealedSecrets": [
                {
                    "playerId": p["id"],
                    "playerName": p["name"],
                    "secret": rnd["secrets"][p["id"]],
                }
                for p in room["players"]
            ],
            "attempts": len(rnd["history"]),
            "history": rnd["history"],
        }, room=code)
        room["gameState"] = "round-end"
    else:
        next_player = _bulls_next_turn(room, rnd)
        socketio.emit("game:bulls-update", {
            "history": rnd["history"],
            "lastResult": entry,
            "currentTurnId": next_player["id"],
            "currentTurnName": next_player["name"],
        }, room=code)
    broadcast_room(room)


# 相容舊版事件名稱
@socketio.on("game:submit")
def on_submit_compat(data):
    on_poker_submit(data)


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
    print(f"🎮 雙人遊戲平台已啟動：http://localhost:{port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
