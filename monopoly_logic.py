"""台灣大富翁 — 雙人連線遊戲邏輯"""
from __future__ import annotations

import copy
import random
from typing import Any

BOARD_SIZE = 28
START_BONUS = 2000
START_MONEY = 15000
JAIL_POSITION = 7

BOARD: list[dict[str, Any]] = [
    {"type": "start", "id": 0, "name": "起點"},
    {"type": "property", "id": 1, "name": "台北車站", "price": 600, "rent": 200, "color": "brown"},
    {"type": "chance", "id": 2, "name": "機會"},
    {"type": "property", "id": 3, "name": "西門町", "price": 600, "rent": 200, "color": "brown"},
    {"type": "tax", "id": 4, "name": "所得稅", "tax": 500},
    {"type": "property", "id": 5, "name": "淡水", "price": 1000, "rent": 400, "color": "lightblue"},
    {"type": "property", "id": 6, "name": "基隆", "price": 1000, "rent": 400, "color": "lightblue"},
    {"type": "jail", "id": 7, "name": "探監"},
    {"type": "property", "id": 8, "name": "新竹", "price": 1200, "rent": 500, "color": "pink"},
    {"type": "chance", "id": 9, "name": "機會"},
    {"type": "property", "id": 10, "name": "台中", "price": 1200, "rent": 500, "color": "pink"},
    {"type": "property", "id": 11, "name": "彰化", "price": 1400, "rent": 600, "color": "orange"},
    {"type": "property", "id": 12, "name": "嘉義", "price": 1400, "rent": 600, "color": "orange"},
    {"type": "parking", "id": 13, "name": "免費停車"},
    {"type": "property", "id": 14, "name": "台南", "price": 1600, "rent": 800, "color": "red"},
    {"type": "chance", "id": 15, "name": "機會"},
    {"type": "property", "id": 16, "name": "高雄", "price": 1600, "rent": 800, "color": "red"},
    {"type": "property", "id": 17, "name": "墾丁", "price": 1800, "rent": 900, "color": "yellow"},
    {"type": "tax", "id": 18, "name": "奢侈稅", "tax": 800},
    {"type": "property", "id": 19, "name": "花蓮", "price": 1800, "rent": 900, "color": "yellow"},
    {"type": "gotojail", "id": 20, "name": "入獄"},
    {"type": "property", "id": 21, "name": "宜蘭", "price": 2000, "rent": 1000, "color": "green"},
    {"type": "chance", "id": 22, "name": "機會"},
    {"type": "property", "id": 23, "name": "台東", "price": 2000, "rent": 1000, "color": "green"},
    {"type": "property", "id": 24, "name": "101大樓", "price": 2400, "rent": 1200, "color": "darkblue"},
    {"type": "property", "id": 25, "name": "信義區", "price": 2400, "rent": 1200, "color": "darkblue"},
    {"type": "property", "id": 26, "name": "大安區", "price": 2200, "rent": 1100, "color": "green"},
    {"type": "property", "id": 27, "name": "松山區", "price": 2200, "rent": 1100, "color": "green"},
]

PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"]

COLOR_MAP = {
    "brown": "#92400e",
    "lightblue": "#38bdf8",
    "pink": "#ec4899",
    "orange": "#f97316",
    "red": "#dc2626",
    "yellow": "#eab308",
    "green": "#16a34a",
    "darkblue": "#1d4ed8",
}


def _clone_state(state: dict) -> dict:
    return copy.deepcopy(state)


def get_property_owner(property_id: int, players: list[dict]) -> int | None:
    for p in players:
        if property_id in p.get("properties", []):
            return p["id"]
    return None


def calc_rent(space: dict, owner_id: int, players: list[dict]) -> int:
    if space.get("type") != "property":
        return 0
    owner = next((p for p in players if p["id"] == owner_id), None)
    if not owner:
        return space["rent"]
    same = [s for s in BOARD if s.get("type") == "property" and s.get("color") == space["color"]]
    if all(s["id"] in owner.get("properties", []) for s in same):
        return space["rent"] * 2
    return space["rent"]


def create_initial_state(player_names: list[str], player_sids: list[str]) -> dict:
    players = []
    for i, name in enumerate(player_names):
        players.append({
            "id": i,
            "sid": player_sids[i] if i < len(player_sids) else None,
            "name": (name or f"玩家 {i + 1}").strip()[:12] or f"玩家 {i + 1}",
            "color": PLAYER_COLORS[i % len(PLAYER_COLORS)],
            "money": START_MONEY,
            "position": 0,
            "properties": [],
            "inJail": False,
            "jailTurns": 0,
            "bankrupt": False,
        })
    return {
        "phase": "rolling",
        "players": players,
        "currentPlayerIndex": 0,
        "board": BOARD,
        "dice": None,
        "message": f"{players[0]['name']} 的回合，請擲骰子！",
        "pendingAction": None,
        "winner": None,
        "passStartBonus": START_BONUS,
    }


def _active_players(players: list[dict]) -> list[dict]:
    return [p for p in players if not p.get("bankrupt")]


def _next_player_index(state: dict) -> int:
    total = len(state["players"])
    idx = state["currentPlayerIndex"]
    for _ in range(total):
        idx = (idx + 1) % total
        if not state["players"][idx].get("bankrupt"):
            return idx
    return state["currentPlayerIndex"]


def _check_winner(state: dict) -> dict:
    alive = _active_players(state["players"])
    if len(alive) == 1:
        state["phase"] = "gameover"
        state["winner"] = alive[0]
        state["message"] = f"🎉 {alive[0]['name']} 獲勝！成為大富翁！"
    return state


def _end_turn(state: dict, message: str | None = None) -> dict:
    nxt = _next_player_index(state)
    state["phase"] = "rolling"
    state["currentPlayerIndex"] = nxt
    state["dice"] = None
    state["pendingAction"] = None
    state["message"] = message or f"{state['players'][nxt]['name']} 的回合，請擲骰子！"
    return _check_winner(state)


def _set_pending(state: dict, action: dict) -> dict:
    state["phase"] = "action"
    state["pendingAction"] = action
    return state


def _move_current_player(state: dict, steps: int) -> dict:
    current = state["players"][state["currentPlayerIndex"]]
    old_pos = current["position"]
    new_pos = (old_pos + steps + BOARD_SIZE) % BOARD_SIZE
    current["position"] = new_pos
    if steps > 0 and new_pos < old_pos:
        current["money"] += state["passStartBonus"]
    state["phase"] = "moving"
    return state


def _handle_landing(state: dict) -> dict:
    current = state["players"][state["currentPlayerIndex"]]
    space = state["board"][current["position"]]
    stype = space["type"]

    if stype == "start":
        return _end_turn(state, f"{current['name']} 經過起點，領取 ${state['passStartBonus']}！")
    if stype == "property":
        owner_id = get_property_owner(space["id"], state["players"])
        if owner_id is None:
            return _set_pending(state, {
                "kind": "buy",
                "message": f"{space['name']} 待售！價格 ${space['price']}，是否要購買？",
                "amount": space["price"],
                "propertyId": space["id"],
            })
        if owner_id == current["id"]:
            return _end_turn(state, f"{current['name']} 抵達自己的 {space['name']}")
        owner = next(p for p in state["players"] if p["id"] == owner_id)
        rent = calc_rent(space, owner_id, state["players"])
        return _set_pending(state, {
            "kind": "rent",
            "message": f"{current['name']} 需向 {owner['name']} 支付 {space['name']} 租金 ${rent}",
            "amount": rent,
            "propertyId": space["id"],
        })
    if stype == "chance":
        return _set_pending(state, {"kind": "chance", "message": f"{current['name']} 抽到機會卡！"})
    if stype == "tax":
        return _set_pending(state, {
            "kind": "tax",
            "message": f"{current['name']} 需繳交 {space['name']} ${space['tax']}",
            "amount": space["tax"],
        })
    if stype == "jail":
        return _end_turn(state, f"{current['name']} 探監中，純粹路過")
    if stype == "parking":
        return _end_turn(state, f"{current['name']} 在免費停車區休息")
    if stype == "gotojail":
        current["position"] = JAIL_POSITION
        current["inJail"] = True
        current["jailTurns"] = 0
        return _end_turn(state, f"{current['name']} 入獄！被送到探監區")
    return _end_turn(state)


def roll_dice(state: dict) -> dict:
    state = _clone_state(state)
    if state["phase"] not in ("rolling", "jail"):
        return state
    current = state["players"][state["currentPlayerIndex"]]
    d1, d2 = random.randint(1, 6), random.randint(1, 6)
    total = d1 + d2
    state["dice"] = [d1, d2]

    if current.get("inJail"):
        if d1 == d2:
            current["inJail"] = False
            current["jailTurns"] = 0
            state = _move_current_player(state, total)
            state["message"] = f"{current['name']} 擲出雙骰 {d1}+{d2}={total}，出獄！"
            return _handle_landing(state)
        current["jailTurns"] = current.get("jailTurns", 0) + 1
        if current["jailTurns"] >= 3:
            current["inJail"] = False
            current["jailTurns"] = 0
            current["money"] = max(0, current["money"] - 500)
            state = _move_current_player(state, total)
            state["message"] = f"{current['name']} 擲出 {d1}+{d2}={total}，交 $500 保釋金出獄"
            return _handle_landing(state)
        return _end_turn(state, f"{current['name']} 仍在監獄（{current['jailTurns']}/3），擲出 {d1}+{d2}")

    state = _move_current_player(state, total)
    state["message"] = f"{current['name']} 擲出 {d1} + {d2} = {total}，前進 {total} 格"
    return _handle_landing(state)


def buy_property(state: dict) -> dict:
    state = _clone_state(state)
    action = state.get("pendingAction") or {}
    if action.get("kind") != "buy":
        return state
    current = state["players"][state["currentPlayerIndex"]]
    price = action.get("amount", 0)
    if current["money"] < price:
        return _end_turn(state, f"{current['name']} 資金不足，無法購買")
    current["money"] -= price
    current["properties"].append(action["propertyId"])
    space = state["board"][current["position"]]
    return _end_turn(state, f"{current['name']} 購買 {space['name']}，花費 ${price}")


def skip_buy(state: dict) -> dict:
    state = _clone_state(state)
    name = state["players"][state["currentPlayerIndex"]]["name"]
    return _end_turn(state, f"{name} 放棄購買")


def _pay_amount(state: dict, amount: int, recipient_id: int | None = None) -> dict:
    current = state["players"][state["currentPlayerIndex"]]
    if current["money"] < amount:
        remaining = current["money"]
        current["bankrupt"] = True
        if recipient_id is not None:
            recipient = next(p for p in state["players"] if p["id"] == recipient_id)
            recipient["money"] += remaining
            for prop in current.get("properties", []):
                if prop not in recipient["properties"]:
                    recipient["properties"].append(prop)
            current["properties"] = []
        current["money"] = 0
        return _check_winner(_end_turn(state, f"💸 {current['name']} 破產了！"))
    current["money"] -= amount
    if recipient_id is not None:
        recipient = next(p for p in state["players"] if p["id"] == recipient_id)
        recipient["money"] += amount
    return state


def pay_rent(state: dict) -> dict:
    state = _clone_state(state)
    action = state.get("pendingAction") or {}
    if action.get("kind") != "rent":
        return state
    owner_id = get_property_owner(action["propertyId"], state["players"])
    state = _pay_amount(state, action.get("amount", 0), owner_id)
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"{state['players'][state['currentPlayerIndex']]['name']} 支付租金 ${action.get('amount')}")


def pay_tax(state: dict) -> dict:
    state = _clone_state(state)
    action = state.get("pendingAction") or {}
    if action.get("kind") != "tax":
        return state
    state = _pay_amount(state, action.get("amount", 0))
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"{state['players'][state['currentPlayerIndex']]['name']} 繳稅 ${action.get('amount')}")


def _chance_effects(state: dict) -> list[dict]:
    idx = state["currentPlayerIndex"]
    name = state["players"][idx]["name"]

    def eff_bonus(amount: int, msg: str):
        def fn(s: dict) -> dict:
            s = _clone_state(s)
            s["players"][idx]["money"] += amount
            s["message"] = msg
            return s
        return {"text": msg, "apply": fn}

    def eff_pay(amount: int, msg: str):
        def fn(s: dict) -> dict:
            s = _clone_state(s)
            s["players"][idx]["money"] = max(0, s["players"][idx]["money"] - amount)
            s["message"] = msg
            return s
        return {"text": msg, "apply": fn}

    return [
        eff_bonus(800, f"{name} 獲得 $800"),
        eff_bonus(1200, f"{name} 中獎獲得 $1200"),
        eff_pay(500, f"{name} 繳交罰款 $500"),
        {"text": f"{name} 前進 3 格", "apply": lambda s: _move_player_chance(s, 3, f"{name} 前進 3 格")},
        {"text": f"{name} 後退 2 格", "apply": lambda s: _move_player_chance(s, -2, f"{name} 後退 2 格")},
        {"text": f"{name} 回到起點", "apply": lambda s: _goto_start(s, name)},
        eff_pay(300, f"{name} 支付修繕費 $300"),
        {"text": "生日紅包", "apply": lambda s: _birthday(s, idx, name)},
    ]


def _move_player_chance(state: dict, steps: int, msg: str) -> dict:
    s = _clone_state(state)
    s["currentPlayerIndex"] = state["currentPlayerIndex"]
    s = _move_current_player(s, steps)
    s["message"] = msg
    return s


def _goto_start(state: dict, name: str) -> dict:
    s = _clone_state(state)
    idx = state["currentPlayerIndex"]
    s["players"][idx]["position"] = 0
    s["players"][idx]["money"] += START_BONUS
    s["message"] = f"{name} 回到起點，領取 ${START_BONUS}"
    return s


def _birthday(state: dict, idx: int, name: str) -> dict:
    s = _clone_state(state)
    total = 0
    for i, p in enumerate(s["players"]):
        if i != idx and not p.get("bankrupt"):
            pay = min(200, p["money"])
            p["money"] -= pay
            total += pay
    s["players"][idx]["money"] += total
    s["message"] = f"{name} 收到生日紅包共 ${total}"
    return s


def apply_chance_card(state: dict) -> dict:
    state = _clone_state(state)
    card = random.choice(_chance_effects(state))
    state = card["apply"](state)
    state["pendingAction"] = None
    state["phase"] = "rolling"
    current = state["players"][state["currentPlayerIndex"]]
    space = state["board"][current["position"]]
    if space["type"] == "property":
        owner_id = get_property_owner(space["id"], state["players"])
        if owner_id is None:
            return _set_pending(state, {
                "kind": "buy",
                "message": f"機會卡後抵達 {space['name']}，價格 ${space['price']}，是否購買？",
                "amount": space["price"],
                "propertyId": space["id"],
            })
        if owner_id != current["id"]:
            owner = next(p for p in state["players"] if p["id"] == owner_id)
            rent = calc_rent(space, owner_id, state["players"])
            return _set_pending(state, {
                "kind": "rent",
                "message": f"需向 {owner['name']} 支付 {space['name']} 租金 ${rent}",
                "amount": rent,
                "propertyId": space["id"],
            })
    if space["type"] == "tax":
        return _set_pending(state, {
            "kind": "tax",
            "message": f"需繳交 {space['name']} ${space['tax']}",
            "amount": space["tax"],
        })
    return _end_turn(state, state.get("message", card["text"]))


def pay_jail_bail(state: dict) -> dict:
    state = _clone_state(state)
    current = state["players"][state["currentPlayerIndex"]]
    if not current.get("inJail") or current["money"] < 500:
        return state
    current["money"] -= 500
    current["inJail"] = False
    current["jailTurns"] = 0
    state["phase"] = "rolling"
    state["message"] = f"{current['name']} 支付 $500 保釋金，可以擲骰了"
    return state


def build_client_view(state: dict, sid: str) -> dict:
    my_index = next((i for i, p in enumerate(state["players"]) if p.get("sid") == sid), 0)
    return {
        "state": state,
        "myIndex": my_index,
        "isMyTurn": state["currentPlayerIndex"] == my_index and state["phase"] != "gameover",
        "colorMap": COLOR_MAP,
    }


def player_index_for_sid(state: dict, sid: str) -> int | None:
    for i, p in enumerate(state["players"]):
        if p.get("sid") == sid:
            return i
    return None
