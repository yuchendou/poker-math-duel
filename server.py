#!/usr/bin/env python3
"""雙人連線遊戲平台 — 撲克數學、數獨、幾A幾B、台灣麻將"""

import os
import random
import re

from flask import Flask, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room

import mahjong_logic as mj

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BASE_DIR, "docs")

app = Flask(__name__, static_folder=DOCS_DIR, static_url_path="")
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "poker-math-duel")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

GAME_TYPES = {"poker", "sudoku", "bulls", "mahjong"}
GAME_LABELS = {
    "poker": "撲克數學",
    "sudoku": "雙人數獨",
    "bulls": "幾A幾B",
    "mahjong": "台灣麻將",
}
GAME_MAX_HUMANS = {
    "poker": 2,
    "sudoku": 2,
    "bulls": 2,
    "mahjong": 2,
}

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


def analyze_sudoku_grid(player_grid, solution, puzzle):
    wrong_cells = []
    empty_cells = []
    if len(player_grid) != 9 or any(len(row) != 9 for row in player_grid):
        return {
            "ok": False,
            "message": "格子格式不正確",
            "wrongCells": [],
            "emptyCells": [],
        }
    for r in range(9):
        for c in range(9):
            val = player_grid[r][c]
            if puzzle[r][c] != 0:
                if not isinstance(val, int) or val != puzzle[r][c]:
                    return {
                        "ok": False,
                        "message": "不能修改題目給定的數字",
                        "wrongCells": [[r, c]],
                        "emptyCells": [],
                    }
                continue
            if not isinstance(val, int) or val < 1 or val > 9:
                empty_cells.append([r, c])
            elif val != solution[r][c]:
                wrong_cells.append([r, c])

    if wrong_cells:
        parts = [f"第{r + 1}行第{c + 1}列" for r, c in wrong_cells[:6]]
        msg = "填錯了：" + "、".join(parts)
        if len(wrong_cells) > 6:
            msg += f"（共 {len(wrong_cells)} 格錯誤）"
        return {"ok": False, "message": msg, "wrongCells": wrong_cells, "emptyCells": empty_cells}
    if empty_cells:
        return {
            "ok": False,
            "message": f"還有 {len(empty_cells)} 格沒填完",
            "wrongCells": [],
            "emptyCells": empty_cells,
        }
    return {"ok": True, "message": "全部正確！你答對了！", "wrongCells": [], "emptyCells": []}


def validate_sudoku_grid(player_grid, solution, puzzle):
    result = analyze_sudoku_grid(player_grid, solution, puzzle)
    return result["ok"], result["message"]


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


def validate_bulls_number(value):
    if not re.fullmatch(r"\d{4}", value):
        return False, "請輸入 4 位數字"
    if value[0] == "0":
        return False, "第一位不能是 0"
    if len(set(value)) != 4:
        return False, "4 個數字不能重複"
    return True, ""


def get_room_state(room):
    max_h = GAME_MAX_HUMANS.get(room["gameType"], 2)
    human_count = len(room["players"])
    return {
        "code": room["code"],
        "gameType": room["gameType"],
        "gameLabel": GAME_LABELS.get(room["gameType"], ""),
        "players": room["players"],
        "isFull": human_count >= max_h,
        "maxHumans": max_h,
        "gameState": room["gameState"],
        "round": _sanitize_round(room.get("round"), room["gameType"]),
    }


def _sanitize_round(round_data, game_type):
    if not round_data:
        return None
    if game_type == "bulls" and "secrets" in round_data:
        return {k: v for k, v in round_data.items() if k != "secrets"}
    if game_type == "mahjong":
        return {
            "dealer": round_data.get("dealer"),
            "wallCount": len(round_data.get("wall", [])),
            "winner": round_data.get("winner"),
        }
    if game_type == "sudoku" and "solution" in round_data:
        return {k: v for k, v in round_data.items() if k != "solution"}
    return round_data


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
    max_h = GAME_MAX_HUMANS.get(game_type, 2)
    if len(room["players"]) >= max_h:
        emit("error", {"message": f"房間已滿（最多 {max_h} 人）"})
        return

    room["players"].append({"id": sid, "name": name, "isHost": False})
    sid_to_room[sid] = code
    join_room(code)
    emit("room:joined", {"code": code, "gameType": room["gameType"]})
    broadcast_room(room)

    if len(room["players"]) == max_h:
        msg = "兩位玩家都已連線！可以開始遊戲了"
        if game_type == "mahjong":
            msg = "兩位玩家都已連線！開局後會由 2 位電腦補齊四人麻將"
        socketio.emit("room:both-connected", {"message": msg}, room=code)


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


def _emit_mahjong_to_humans(room, code, event, extra=None):
    session = room.get("mahjongSession")
    for p in room["players"]:
        view = mj.build_client_view(room["round"], p["id"], session)
        if extra:
            view.update(extra)
        socketio.emit(event, view, to=p["id"])


def _finish_mahjong_hand(room, code):
    """手局結束：結算籌碼、更新圈風莊家。"""
    rnd = room["round"]
    session = room.get("mahjongSession")
    if session and rnd:
        mj.apply_hand_to_session(session, rnd)
    room["gameState"] = "round-end"


def _mahjong_loop(room, code, initial=False):
    rnd = room["round"]
    event = "game:mahjong-new-round" if initial else "game:mahjong-update"
    while True:
        status = mj.advance_game(rnd)
        if status == "ended":
            _finish_mahjong_hand(room, code)
            _emit_mahjong_to_humans(room, code, "game:mahjong-win")
            return
        if status == "discard":
            _emit_mahjong_to_humans(room, code, event)
            event = "game:mahjong-update"
            initial = False
            continue
        if status == "wait":
            _emit_mahjong_to_humans(room, code, event)
            initial = False
            return


def _emit_seat_draw(room, code):
    session = room.get("mahjongSession")
    sd = session.get("seatDraw") if session else None
    for p in room["players"]:
        view = mj.build_seat_draw_view(sd, p["id"])
        if view and sd and sd.get("phase") == "dice":
            roller_idx = sd.get("rollerTempIndex", 0)
            roller = sd["tempSeats"][roller_idx] if roller_idx < len(sd["tempSeats"]) else None
            view["canRollDice"] = bool(
                p.get("isHost") or (roller and roller["id"] == p["id"])
            )
        socketio.emit("game:mahjong-seat-draw", view, to=p["id"])


def _begin_mahjong_hand(room, code):
    session = room["mahjongSession"]
    room["gameState"] = "playing"
    room["round"] = mj.start_round(
        room["players"],
        dealer=session["dealer"],
        dealer_streak=session["dealerStreak"],
        round_wind=session["roundWind"],
        seat_assignment=session.get("seatAssignment"),
    )
    mj.init_session_scores(session, room["round"])
    _mahjong_loop(room, code, initial=True)


def start_mahjong_round(room, code):
    if not room.get("mahjongSession"):
        room["mahjongSession"] = mj.create_mahjong_session(room["players"])
    session = room["mahjongSession"]
    # 同一將內只抓位一次；下一局直接開打
    if session.get("seatDrawComplete"):
        _begin_mahjong_hand(room, code)
        return
    if not session.get("seatDraw"):
        session["seatDraw"] = mj.init_seat_draw(room["players"])
    room["gameState"] = "seat-draw"
    _emit_seat_draw(room, code)
    broadcast_room(room)


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
    max_h = GAME_MAX_HUMANS.get(room["gameType"], 2)
    if len(room["players"]) < max_h:
        emit("error", {"message": f"需要 {max_h} 位玩家連線才能開始"})
        return

    if room["gameType"] == "poker":
        start_poker_round(room, code)
    elif room["gameType"] == "sudoku":
        start_sudoku_round(room, code)
    elif room["gameType"] == "mahjong":
        start_mahjong_round(room, code)
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
        emit("game:poker-result", {"correct": True, "message": "🎉 你答對了！"})
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


@socketio.on("game:sudoku-check")
def on_sudoku_check(data):
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
    result = analyze_sudoku_grid(grid, rnd["solution"], rnd["puzzle"])
    emit("game:sudoku-check-result", result)


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
    result = analyze_sudoku_grid(grid, rnd["solution"], rnd["puzzle"])
    rnd["submissions"][sid] = {"correct": result["ok"], "message": result["message"]}

    if result["ok"]:
        rnd["winner"] = sid
        winner = next((p for p in room["players"] if p["id"] == sid), None)
        emit("game:sudoku-result", {
            "correct": True,
            "message": "🎉 你答對了！",
            "wrongCells": [],
            "emptyCells": [],
        })
        socketio.emit("game:sudoku-won", {
            "winnerId": sid,
            "winnerName": winner["name"] if winner else "玩家",
        }, room=code)
        room["gameState"] = "round-end"
    else:
        emit("game:sudoku-result", {
            "correct": False,
            "message": result["message"],
            "wrongCells": result["wrongCells"],
            "emptyCells": result["emptyCells"],
        })
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
        emit("game:bulls-result", {"message": "目前不是出題階段，請等房主重新開始"})
        return
    rnd = room.get("round")
    if not rnd:
        emit("game:bulls-result", {"message": "本局尚未開始，請房主重新開始"})
        return

    secret = (data.get("secret") or "").strip()
    ok, message = validate_bulls_number(secret)
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
    ok, message = validate_bulls_number(guess)
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
        emit("game:bulls-result", {"correct": True, "message": "🎉 你答對了！4A0B！"})
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


@socketio.on("game:mahjong-discard")
def on_mahjong_discard(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong" or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return
    seat = mj.seat_by_id(rnd, sid)
    if not seat:
        return
    if rnd["phase"] != "discard" or rnd["currentSeat"] != seat["seatIndex"]:
        emit("game:mahjong-error", {"message": "還沒輪到你打牌"})
        return
    tile_id = (data.get("tileId") or "").strip()
    ok, msg = mj.apply_discard(rnd, seat["seatIndex"], tile_id)
    if not ok:
        emit("game:mahjong-error", {"message": msg})
        return
    _emit_mahjong_to_humans(room, code, "game:mahjong-update")
    _mahjong_loop(room, code)
    broadcast_room(room)


@socketio.on("game:mahjong-action")
def on_mahjong_action(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong" or room["gameState"] != "playing":
        return
    rnd = room.get("round")
    if not rnd or rnd.get("winner"):
        return
    seat = mj.seat_by_id(rnd, sid)
    if not seat:
        return
    action = (data.get("action") or "").strip()
    idx = seat["seatIndex"]

    if action == "pass":
        if rnd["phase"] == "claim":
            mj.apply_pass_claim(rnd, idx)
        elif rnd["phase"] == "rob_kong":
            mj.apply_pass_rob_kong(rnd, idx)
        else:
            emit("game:mahjong-error", {"message": "目前不能跳過"})
            return
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "ting":
        ok, msg = mj.apply_declare_ting(rnd, idx)
        if not ok:
            emit("game:mahjong-error", {"message": msg})
            return
        emit("game:mahjong-self-win", {"message": "🔔 聽牌！（+1 台，不可再吃碰槓換牌）"})
        _emit_mahjong_to_humans(room, code, "game:mahjong-update")
        broadcast_room(room)
        return

    if action == "zimo":
        if not mj.can_win(seat["hand"], seat["melds"]):
            emit("game:mahjong-error", {"message": "牌型還不能胡"})
            return
        mj.apply_zimo(rnd, idx)
        rnd["winner"] = seat["id"]
        rnd["winnerSeat"] = idx
        rnd["winInfo"] = mj.build_win_info(rnd, idx)
        _finish_mahjong_hand(room, code)
        emit("game:mahjong-self-win", {"message": "🎉 你胡牌了！自摸！"})
        _emit_mahjong_to_humans(room, code, "game:mahjong-win")
        broadcast_room(room)
        return

    if action == "hu":
        opts = mj.get_claim_options(rnd, idx)
        if not any(o["action"] == "hu" for o in opts):
            emit("game:mahjong-error", {"message": "現在不能胡這張牌"})
            return
        tile = rnd["claim"]["tile"]
        rnd["claim"]["responses"][idx] = {"action": "hu", "tile": tile}
        emit("game:mahjong-self-win", {"message": "🎉 你胡牌了！"})
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "pon":
        tile = rnd["claim"]["tile"]
        rnd["claim"]["responses"][idx] = {"action": "pon", "tile": tile}
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "minkong":
        tile = rnd["claim"]["tile"]
        rnd["claim"]["responses"][idx] = {"action": "minkong", "tile": tile}
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "chi":
        tiles = data.get("tiles")
        if not tiles:
            emit("game:mahjong-error", {"message": "請選擇要吃的組合"})
            return
        rnd["claim"]["responses"][idx] = {"action": "chi", "tiles": tiles, "tile": rnd["claim"]["tile"]}
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "ankong":
        tile = data.get("tileId")
        ok, msg = mj.apply_ankong(rnd, idx, tile)
        if not ok:
            emit("game:mahjong-error", {"message": msg})
            return
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "jiagang":
        tile = data.get("tileId")
        meld_index = data.get("meldIndex", 0)
        ok, msg = mj.start_jiagang(rnd, idx, tile, meld_index)
        if not ok:
            emit("game:mahjong-error", {"message": msg})
            return
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    if action == "qianggang":
        rk = rnd.get("robKong")
        if not rk:
            emit("game:mahjong-error", {"message": "目前不能搶槓"})
            return
        rk.setdefault("responses", {})[idx] = {"action": "qianggang", "tile": rk["tile"]}
        emit("game:mahjong-self-win", {"message": "🎉 你搶槓胡牌了！"})
        _mahjong_loop(room, code)
        broadcast_room(room)
        return

    emit("game:mahjong-error", {"message": "不支援的操作"})


@socketio.on("game:mahjong-seat-dice")
def on_mahjong_seat_dice():
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong" or room["gameState"] != "seat-draw":
        return
    session = room.get("mahjongSession")
    sd = session.get("seatDraw") if session else None
    if not sd:
        emit("error", {"message": "抓位尚未開始"})
        return
    # 房主或暫時座位 0 的玩家可擲骰
    player = next((p for p in room["players"] if p["id"] == sid), None)
    if not player:
        return
    roller_idx = sd.get("rollerTempIndex", 0)
    roller_seat = sd["tempSeats"][roller_idx] if roller_idx < len(sd["tempSeats"]) else None
    if not player.get("isHost") and (not roller_seat or roller_seat["id"] != sid):
        emit("error", {"message": "請由房主或暫時東位玩家擲骰"})
        return
    ok, msg = mj.roll_seat_dice(sd)
    if not ok:
        emit("error", {"message": msg})
        return
    mj.process_ai_seat_draws(sd)
    _emit_seat_draw(room, code)
    if sd["phase"] == "done":
        mj.apply_seat_draw_to_session(session)
        _begin_mahjong_hand(room, code)
    broadcast_room(room)


@socketio.on("game:mahjong-seat-pick")
def on_mahjong_seat_pick(data):
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong" or room["gameState"] != "seat-draw":
        return
    session = room.get("mahjongSession")
    sd = session.get("seatDraw") if session else None
    if not sd:
        return
    drawer = mj.current_seat_drawer(sd)
    if not drawer or drawer["id"] != sid:
        emit("error", {"message": "還沒輪到你抽牌"})
        return
    slot = data.get("slot")
    if slot is None:
        emit("error", {"message": "請選擇一張方位牌"})
        return
    ok, msg = mj.pick_wind_tile(sd, int(slot))
    if not ok:
        emit("error", {"message": msg})
        return
    mj.process_ai_seat_draws(sd)
    _emit_seat_draw(room, code)
    if sd["phase"] == "done":
        mj.apply_seat_draw_to_session(session)
        _begin_mahjong_hand(room, code)
    broadcast_room(room)


@socketio.on("game:mahjong-next-hand")
def on_mahjong_next_hand():
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong":
        return
    player = next((p for p in room["players"] if p["id"] == sid), None)
    if not player or not player.get("isHost"):
        emit("error", {"message": "只有房主可以開下一局"})
        return
    if room["gameState"] != "round-end":
        emit("error", {"message": "目前不是局間狀態"})
        return
    session = room.get("mahjongSession")
    if not session:
        emit("error", {"message": "沒有進行中的將"})
        return
    if session.get("jiangComplete"):
        emit("error", {"message": "東南西北風已打完，請結算"})
        return
    _begin_mahjong_hand(room, code)
    broadcast_room(room)


@socketio.on("game:mahjong-settle")
def on_mahjong_settle():
    from flask import request
    sid = request.sid
    code = sid_to_room.get(sid)
    room = rooms.get(code)
    if not room or room["gameType"] != "mahjong":
        return
    if room["gameState"] != "round-end":
        emit("error", {"message": "請在本局結束後再結算"})
        return
    session = room.get("mahjongSession")
    if not session:
        emit("error", {"message": "沒有進行中的將"})
        return
    human_ids = {p["id"] for p in room["players"]}
    settlement = mj.build_settlement(session, human_ids, room.get("round"))
    room["gameState"] = "waiting"
    room["round"] = None
    room["mahjongSession"] = None
    socketio.emit("game:mahjong-settled", settlement, room=code)
    broadcast_room(room)


@socketio.on("game:mahjong-hu")
def on_mahjong_hu_compat():
    """相容舊版自摸按鈕。"""
    on_mahjong_action({"action": "zimo"})


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
