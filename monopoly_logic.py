"""台北新北大富翁 — 雙人連線（三階建設、搶購機制）"""
from __future__ import annotations

import copy
import random
from typing import Any

BOARD_SIZE = 40
START_BONUS = 3000
START_MONEY = 25000
JAIL_POSITION = 10
TAKEOVER_MULT = 1.5

# 升級成本：第1次=地價，第2次=60%地價，第3次=100%地價
UPGRADE_RATIOS = [1.0, 0.6, 1.0]
RENT_MULT = {1: 1.0, 2: 2.8, 3: 6.0}
LEVEL_NAMES = {1: "小公寓", 2: "高樓大廈", 3: "地標"}
LEVEL_ICONS = {1: "🏠", 2: "🏢", 3: "🗼"}

FOOD_AVATARS = [
    {"id": "lurou", "emoji": "🍚", "name": "滷肉飯"},
    {"id": "beef", "emoji": "🍜", "name": "牛肉麵"},
    {"id": "boba", "emoji": "🧋", "name": "珍珠奶茶"},
    {"id": "xlb", "emoji": "🥟", "name": "小籠包"},
    {"id": "oyster", "emoji": "🦪", "name": "蚵仔煎"},
    {"id": "pineapple", "emoji": "🍍", "name": "鳳梨酥"},
    {"id": "luwei", "emoji": "🍢", "name": "滷味"},
    {"id": "chicken", "emoji": "🍗", "name": "雞排"},
    {"id": "tofu", "emoji": "🍮", "name": "豆花"},
    {"id": "bento", "emoji": "🍱", "name": "便當"},
]

BOARD: list[dict[str, Any]] = [
    {"type": "start", "id": 0, "name": "出發"},
    {"type": "property", "id": 1, "name": "萬華", "price": 1200, "rent": 300, "color": "brown", "landmark": "🏮"},
    {"type": "chance", "id": 2, "name": "機會"},
    {"type": "property", "id": 3, "name": "大同", "price": 1200, "rent": 300, "color": "brown", "landmark": "🎭"},
    {"type": "property", "id": 4, "name": "三重", "price": 1600, "rent": 450, "color": "lightblue", "landmark": "🌉"},
    {"type": "tax", "id": 5, "name": "地價稅", "tax": 800},
    {"type": "property", "id": 6, "name": "蘆洲", "price": 1800, "rent": 500, "color": "lightblue", "landmark": "⛩️"},
    {"type": "property", "id": 7, "name": "五股", "price": 2000, "rent": 550, "color": "lightblue", "landmark": "🏭"},
    {"type": "property", "id": 8, "name": "泰山", "price": 2200, "rent": 600, "color": "pink", "landmark": "🌸"},
    {"type": "property", "id": 9, "name": "林口", "price": 2400, "rent": 650, "color": "pink", "landmark": "✈️"},
    {"type": "jail", "id": 10, "name": "探監"},
    {"type": "property", "id": 11, "name": "板橋", "price": 2800, "rent": 800, "color": "orange", "landmark": "🚉"},
    {"type": "chance", "id": 12, "name": "機會"},
    {"type": "property", "id": 13, "name": "中和", "price": 3000, "rent": 850, "color": "orange", "landmark": "🌳"},
    {"type": "property", "id": 14, "name": "永和", "price": 3200, "rent": 900, "color": "orange", "landmark": "🏪"},
    {"type": "property", "id": 15, "name": "新店", "price": 3400, "rent": 950, "color": "red", "landmark": "🌲"},
    {"type": "property", "id": 16, "name": "土城", "price": 3600, "rent": 1000, "color": "red", "landmark": "🛤️"},
    {"type": "property", "id": 17, "name": "樹林", "price": 3800, "rent": 1050, "color": "red", "landmark": "🚂"},
    {"type": "property", "id": 18, "name": "汐止", "price": 4000, "rent": 1100, "color": "yellow", "landmark": "🏔️"},
    {"type": "property", "id": 19, "name": "內湖", "price": 4500, "rent": 1250, "color": "yellow", "landmark": "💻"},
    {"type": "parking", "id": 20, "name": "休息"},
    {"type": "property", "id": 21, "name": "南港", "price": 4800, "rent": 1350, "color": "yellow", "landmark": "🎵"},
    {"type": "chance", "id": 22, "name": "機會"},
    {"type": "property", "id": 23, "name": "松山", "price": 5200, "rent": 1450, "color": "green", "landmark": "🛫"},
    {"type": "property", "id": 24, "name": "信義", "price": 6000, "rent": 1700, "color": "green", "landmark": "🏙️"},
    {"type": "property", "id": 25, "name": "大安", "price": 6500, "rent": 1850, "color": "green", "landmark": "🌿"},
    {"type": "tax", "id": 26, "name": "奢侈稅", "tax": 1500},
    {"type": "property", "id": 27, "name": "中山", "price": 7000, "rent": 2000, "color": "darkblue", "landmark": "🎨"},
    {"type": "property", "id": 28, "name": "中正", "price": 7500, "rent": 2100, "color": "darkblue", "landmark": "🏛️"},
    {"type": "property", "id": 29, "name": "士林", "price": 8000, "rent": 2250, "color": "darkblue", "landmark": "🎡"},
    {"type": "gotojail", "id": 30, "name": "入獄"},
    {"type": "property", "id": 31, "name": "北投", "price": 5500, "rent": 1550, "color": "green", "landmark": "♨️"},
    {"type": "property", "id": 32, "name": "淡水", "price": 5000, "rent": 1400, "color": "yellow", "landmark": "🌅"},
    {"type": "chance", "id": 33, "name": "機會"},
    {"type": "property", "id": 34, "name": "八里", "price": 4200, "rent": 1150, "color": "red", "landmark": "🚴"},
    {"type": "property", "id": 35, "name": "新莊", "price": 3800, "rent": 1050, "color": "orange", "landmark": "🏟️"},
    {"type": "property", "id": 36, "name": "深坑", "price": 3500, "rent": 980, "color": "pink", "landmark": "🧀"},
    {"type": "property", "id": 37, "name": "101大樓", "price": 10000, "rent": 3000, "color": "premium", "landmark": "🏬"},
    {"type": "property", "id": 38, "name": "西門町", "price": 8500, "rent": 2400, "color": "darkblue", "landmark": "🛍️"},
    {"type": "property", "id": 39, "name": "象山", "price": 7200, "rent": 2050, "color": "darkblue", "landmark": "🌃"},
]

COLOR_MAP = {
    "brown": "#92400e",
    "lightblue": "#38bdf8",
    "pink": "#ec4899",
    "orange": "#f97316",
    "red": "#dc2626",
    "yellow": "#eab308",
    "green": "#16a34a",
    "darkblue": "#1d4ed8",
    "premium": "#a855f7",
}


def _clone(state: dict) -> dict:
    return copy.deepcopy(state)


def _prop_key(pid: int) -> str:
    return str(pid)


def get_prop_state(state: dict, pid: int) -> dict | None:
    return state.get("propertyStates", {}).get(_prop_key(pid))


def investment_value(base: int, level: int) -> int:
    if level <= 0:
        return 0
    total = 0
    for i in range(level):
        total += int(base * UPGRADE_RATIOS[i])
    return total


def upgrade_cost(base: int, current_level: int) -> int | None:
    if current_level >= 3:
        return None
    return int(base * UPGRADE_RATIOS[current_level])


def takeover_cost(base: int, level: int) -> int:
    return int(investment_value(base, level) * TAKEOVER_MULT)


def calc_rent(space: dict, level: int) -> int:
    return int(space["rent"] * RENT_MULT.get(level, 1))


def building_icon(space: dict, level: int) -> str:
    if level == 3:
        return space.get("landmark", "🗼")
    return LEVEL_ICONS.get(level, "")


def create_initial_state(
    player_names: list[str],
    player_sids: list[str],
    avatars: list[str] | None = None,
) -> dict:
    players = []
    for i, name in enumerate(player_names):
        av = (avatars[i] if avatars and i < len(avatars) else None) or FOOD_AVATARS[i % 10]["emoji"]
        players.append({
            "id": i,
            "sid": player_sids[i] if i < len(player_sids) else None,
            "name": (name or f"玩家 {i + 1}").strip()[:12] or f"玩家 {i + 1}",
            "avatar": av,
            "money": START_MONEY,
            "position": 0,
            "inJail": False,
            "jailTurns": 0,
            "bankrupt": False,
        })
    return {
        "phase": "rolling",
        "players": players,
        "currentPlayerIndex": 0,
        "board": BOARD,
        "propertyStates": {},
        "dice": None,
        "diceRolling": False,
        "message": f"{players[0]['avatar']} {players[0]['name']} 的回合，請擲骰子！",
        "pendingAction": None,
        "winner": None,
        "passStartBonus": START_BONUS,
        "foodAvatars": FOOD_AVATARS,
    }


def _active_players(players: list[dict]) -> list[dict]:
    return [p for p in players if not p.get("bankrupt")]


def _next_idx(state: dict) -> int:
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
        w = alive[0]
        state["phase"] = "gameover"
        state["winner"] = w
        state["message"] = f"🎉 {w['avatar']} {w['name']} 獲勝！"
    return state


def _end_turn(state: dict, message: str | None = None) -> dict:
    nxt = _next_idx(state)
    p = state["players"][nxt]
    state["phase"] = "rolling"
    state["currentPlayerIndex"] = nxt
    state["dice"] = None
    state["diceRolling"] = False
    state["pendingAction"] = None
    state["message"] = message or f"{p['avatar']} {p['name']} 的回合，請擲骰子！"
    return _check_winner(state)


def _set_pending(state: dict, action: dict) -> dict:
    state["phase"] = "action"
    state["pendingAction"] = action
    return state


def _move(state: dict, steps: int) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    old = cur["position"]
    new = (old + steps + BOARD_SIZE) % BOARD_SIZE
    cur["position"] = new
    if steps > 0 and new < old:
        cur["money"] += state["passStartBonus"]
    state["phase"] = "moving"
    return state


def _transfer_prop(state: dict, pid: int, new_owner: int, new_level: int) -> None:
    state["propertyStates"][_prop_key(pid)] = {
        "ownerId": new_owner,
        "level": new_level,
    }


def _remove_props_of_player(state: dict, player_id: int, recipient_id: int | None = None) -> None:
    for key, ps in list(state.get("propertyStates", {}).items()):
        if ps.get("ownerId") == player_id:
            if recipient_id is not None:
                ps["ownerId"] = recipient_id
            else:
                del state["propertyStates"][key]


def _handle_landing(state: dict) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    space = state["board"][cur["position"]]
    st = space["type"]
    pid = space["id"]

    if st == "start":
        return _end_turn(state, f"{cur['avatar']} {cur['name']} 經過起點 +${state['passStartBonus']}")
    if st != "property":
        if st == "chance":
            return _set_pending(state, {"kind": "chance", "message": f"{cur['avatar']} 抽到機會卡！"})
        if st == "tax":
            return _set_pending(state, {
                "kind": "tax",
                "message": f"繳交 {space['name']} ${space['tax']}",
                "amount": space["tax"],
            })
        if st == "jail":
            return _end_turn(state, f"{cur['name']} 路過探監")
        if st == "parking":
            return _end_turn(state, f"{cur['name']} 在休息區")
        if st == "gotojail":
            cur["position"] = JAIL_POSITION
            cur["inJail"] = True
            cur["jailTurns"] = 0
            return _end_turn(state, f"{cur['name']} 入獄！")
        return _end_turn(state)

    ps = get_prop_state(state, pid)
    base = space["price"]

    if not ps:
        cost = upgrade_cost(base, 0)
        return _set_pending(state, {
            "kind": "buy",
            "message": f"「{space['name']}」空地！${cost} 蓋小公寓 🏠",
            "amount": cost,
            "propertyId": pid,
            "nextLevel": 1,
        })

    owner_id = ps["ownerId"]
    level = ps["level"]

    if owner_id == cur["id"]:
        if level >= 3:
            icon = building_icon(space, 3)
            return _end_turn(state, f"{space['name']} 已是地標 {icon}，無法再升級")
        cost = upgrade_cost(base, level)
        nxt = level + 1
        label = LEVEL_NAMES[nxt]
        icon = LEVEL_ICONS.get(nxt, "🗼") if nxt < 3 else building_icon(space, 3)
        return _set_pending(state, {
            "kind": "upgrade",
            "message": f"升級 {space['name']} → {label} {icon}，費用 ${cost}",
            "amount": cost,
            "propertyId": pid,
            "nextLevel": nxt,
        })

    if level >= 3:
        owner = state["players"][owner_id]
        rent = calc_rent(space, 3)
        return _set_pending(state, {
            "kind": "rent",
            "message": f"{space['name']} 地標 {building_icon(space,3)}！向 {owner['avatar']}{owner['name']} 付 ${rent}",
            "amount": rent,
            "propertyId": pid,
        })

    cost = takeover_cost(base, level)
    owner = state["players"][owner_id]
    nxt = level + 1
    label = LEVEL_NAMES.get(nxt, "地標")
    return _set_pending(state, {
        "kind": "takeover",
        "message": f"搶購 {space['name']}！向 {owner['avatar']}{owner['name']} 付 ${cost}（1.5倍）→ {label}",
        "amount": cost,
        "propertyId": pid,
        "nextLevel": nxt,
        "sellerId": owner_id,
    })


def roll_dice(state: dict) -> dict:
    state = _clone(state)
    if state["phase"] not in ("rolling", "jail"):
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    d1, d2 = random.randint(1, 6), random.randint(1, 6)
    total = d1 + d2
    state["dice"] = [d1, d2]
    state["diceRolling"] = True

    if cur.get("inJail"):
        if d1 == d2:
            cur["inJail"] = False
            cur["jailTurns"] = 0
            state = _move(state, total)
            state["diceRolling"] = False
            state["message"] = f"雙骰出獄！{d1}+{d2}={total}"
            return _handle_landing(state)
        cur["jailTurns"] = cur.get("jailTurns", 0) + 1
        if cur["jailTurns"] >= 3:
            cur["inJail"] = False
            cur["jailTurns"] = 0
            cur["money"] = max(0, cur["money"] - 800)
            state = _move(state, total)
            state["diceRolling"] = False
            return _handle_landing(state)
        state["diceRolling"] = False
        return _end_turn(state, f"監獄中（{cur['jailTurns']}/3）")

    state = _move(state, total)
    state["diceRolling"] = False
    state["message"] = f"擲出 {d1}+{d2}={total}"
    return _handle_landing(state)


def _apply_build(state: dict, pid: int, cost: int, level: int, seller_id: int | None = None) -> dict | None:
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < cost:
        return None
    cur["money"] -= cost
    if seller_id is not None:
        state["players"][seller_id]["money"] += cost
    _transfer_prop(state, pid, cur["id"], level)
    return state


def buy_property(state: dict) -> dict:
    return _do_build(state, "buy")


def upgrade_property(state: dict) -> dict:
    return _do_build(state, "upgrade")


def takeover_property(state: dict) -> dict:
    return _do_build(state, "takeover")


def _do_build(state: dict, kind: str) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != kind:
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    pid = act["propertyId"]
    cost = act["amount"]
    level = act["nextLevel"]
    seller = act.get("sellerId")
    space = next(s for s in state["board"] if s.get("id") == pid)

    result = _apply_build(state, pid, cost, level, seller)
    if not result:
        return _end_turn(state, f"{cur['name']} 資金不足")

    icon = building_icon(space, level) if level == 3 else LEVEL_ICONS.get(level, "🏠")
    label = LEVEL_NAMES.get(level, "")
    if kind == "takeover":
        msg = f"{cur['avatar']} 搶購 {space['name']}！升級為 {label}{icon}"
    elif kind == "upgrade":
        msg = f"{cur['avatar']} 升級 {space['name']} → {label}{icon}"
    else:
        msg = f"{cur['avatar']} 在 {space['name']} 蓋了 {label}{icon}"
    return _end_turn(state, msg)


def skip_action(state: dict) -> dict:
    state = _clone(state)
    name = state["players"][state["currentPlayerIndex"]]["name"]
    return _end_turn(state, f"{name} 放棄")


def _pay(state: dict, amount: int, recipient: int | None = None) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < amount:
        rem = cur["money"]
        cur["bankrupt"] = True
        cur["money"] = 0
        if recipient is not None:
            state["players"][recipient]["money"] += rem
            _remove_props_of_player(state, cur["id"], recipient)
        else:
            _remove_props_of_player(state, cur["id"])
        return _check_winner(_end_turn(state, f"💸 {cur['name']} 破產！"))
    cur["money"] -= amount
    if recipient is not None:
        state["players"][recipient]["money"] += amount
    return state


def pay_rent(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "rent":
        return state
    ps = get_prop_state(state, act["propertyId"])
    owner_id = ps["ownerId"] if ps else 0
    state = _pay(state, act["amount"], owner_id)
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"支付過路費 ${act['amount']}")


def pay_tax(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "tax":
        return state
    state = _pay(state, act["amount"])
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"繳稅 ${act['amount']}")


def apply_chance_card(state: dict) -> dict:
    state = _clone(state)
    idx = state["currentPlayerIndex"]
    name = state["players"][idx]["name"]
    effects = [
        lambda s: _money(s, idx, 1000, f"{name} 獲得 $1000"),
        lambda s: _money(s, idx, -600, f"{name} 罰款 $600"),
        lambda s: _move(_clone(s), 3),
        lambda s: _move(_clone(s), -2),
    ]
    state = random.choice(effects)(state)
    state["pendingAction"] = None
    return _handle_landing(state)


def _money(state: dict, idx: int, amt: int, msg: str) -> dict:
    state["players"][idx]["money"] = max(0, state["players"][idx]["money"] + amt)
    state["message"] = msg
    return state


def pay_jail_bail(state: dict) -> dict:
    state = _clone(state)
    cur = state["players"][state["currentPlayerIndex"]]
    if not cur.get("inJail") or cur["money"] < 800:
        return state
    cur["money"] -= 800
    cur["inJail"] = False
    cur["jailTurns"] = 0
    state["phase"] = "rolling"
    state["message"] = f"{cur['name']} 付 $800 保釋"
    return state


def build_client_view(state: dict, sid: str) -> dict:
    my_index = next((i for i, p in enumerate(state["players"]) if p.get("sid") == sid), 0)
    return {
        "state": state,
        "myIndex": my_index,
        "isMyTurn": state["currentPlayerIndex"] == my_index and state["phase"] != "gameover",
        "colorMap": COLOR_MAP,
        "levelIcons": LEVEL_ICONS,
    }


def player_index_for_sid(state: dict, sid: str) -> int | None:
    for i, p in enumerate(state["players"]):
        if p.get("sid") == sid:
            return i
    return None

# 相容舊函式名
skip_buy = skip_action
