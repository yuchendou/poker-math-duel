"""台北新北大富翁 — v3 動畫、立體建築、角色加成"""
from __future__ import annotations

import copy
import random
from typing import Any, Callable

BOARD_SIZE = 40
START_BONUS = 3000
START_MONEY = 25000
BANK_FEE = 500
GOTO_JAIL_FINE = 1500
BANK_BUYBACK_RATIO = 0.5
BANK_POSITION = 30
TAKEOVER_MULT = 1.5
COLOR_SET_BONUS = 1.5

UPGRADE_RATIOS = [1.0, 0.6, 1.0]
RENT_MULT = {1: 1.0, 2: 3.0, 3: 7.0}
LEVEL_NAMES = {1: "小公寓", 2: "高樓大廈", 3: "地標"}

FOOD_AVATARS = [
    {"id": "lurou", "emoji": "🍚", "name": "滷肉飯", "bonus": "經過起點額外 +$800"},
    {"id": "beef", "emoji": "🍜", "name": "牛肉麵", "bonus": "升級費用 -12%"},
    {"id": "boba", "emoji": "🧋", "name": "珍珠奶茶", "bonus": "機會卡獎金 +25%"},
    {"id": "xlb", "emoji": "🥟", "name": "小籠包", "bonus": "搶購費用 -10%"},
    {"id": "oyster", "emoji": "🦪", "name": "蚵仔煎", "bonus": "收到的過路費 +15%"},
    {"id": "pineapple", "emoji": "🍍", "name": "鳳梨酥", "bonus": "被搶購時多收 12%"},
    {"id": "luwei", "emoji": "🍢", "name": "滷味", "bonus": "稅務事件 -20%（地價稅／奢侈稅）"},
    {"id": "chicken", "emoji": "🍗", "name": "雞排", "bonus": "首次購地 -8%"},
    {"id": "tofu", "emoji": "🍮", "name": "豆花", "bonus": "休息區恢復 $500"},
    {"id": "bento", "emoji": "🍱", "name": "便當", "bonus": "同色地產加成 +30%"},
]

CHAR_BONUS = {f["emoji"]: f for f in FOOD_AVATARS}

# 原始地塊（id 不變，供 propertyStates 對應）
_RAW_BOARD: list[dict[str, Any]] = [
    {"type": "start", "id": 0, "name": "出發"},
    {"type": "property", "id": 1, "name": "萬華", "price": 1200, "rent": 300, "color": "brown", "landmark": "龍山寺"},
    {"type": "chance", "id": 2, "name": "機會"},
    {"type": "property", "id": 3, "name": "大同", "price": 1200, "rent": 300, "color": "brown", "landmark": "迪化街"},
    {"type": "property", "id": 4, "name": "三重", "price": 1600, "rent": 450, "color": "lightblue", "landmark": "重新橋"},
    {"type": "tax", "id": 5, "name": "地價稅", "taxKind": "land"},
    {"type": "property", "id": 6, "name": "蘆洲", "price": 1800, "rent": 500, "color": "lightblue", "landmark": "廟口"},
    {"type": "property", "id": 7, "name": "五股", "price": 2000, "rent": 550, "color": "lightblue", "landmark": "觀音山"},
    {"type": "property", "id": 8, "name": "泰山", "price": 2200, "rent": 600, "color": "pink", "landmark": "明志科大"},
    {"type": "property", "id": 9, "name": "林口", "price": 2400, "rent": 650, "color": "pink", "landmark": "三井Outlet"},
    {"type": "bank", "id": 10, "name": "銀行", "bankFee": BANK_FEE},
    {"type": "property", "id": 11, "name": "板橋", "price": 2800, "rent": 800, "color": "orange", "landmark": "大遠百"},
    {"type": "chance", "id": 12, "name": "機會"},
    {"type": "property", "id": 13, "name": "中和", "price": 3000, "rent": 850, "color": "orange", "landmark": "環球"},
    {"type": "property", "id": 14, "name": "永和", "price": 3200, "rent": 900, "color": "orange", "landmark": "比漾"},
    {"type": "property", "id": 15, "name": "新店", "price": 3400, "rent": 950, "color": "red", "landmark": "碧潭"},
    {"type": "property", "id": 16, "name": "土城", "price": 3600, "rent": 1000, "color": "red", "landmark": "樂利"},
    {"type": "property", "id": 17, "name": "樹林", "price": 3800, "rent": 1050, "color": "red", "landmark": "山佳"},
    {"type": "property", "id": 18, "name": "汐止", "price": 4000, "rent": 1100, "color": "yellow", "landmark": "iPark"},
    {"type": "property", "id": 19, "name": "內湖", "price": 4500, "rent": 1250, "color": "yellow", "landmark": "Costco"},
    {"type": "parking", "id": 20, "name": "休息"},
    {"type": "property", "id": 21, "name": "南港", "price": 4800, "rent": 1350, "color": "yellow", "landmark": "軟體園區"},
    {"type": "chance", "id": 22, "name": "機會"},
    {"type": "property", "id": 23, "name": "松山", "price": 5200, "rent": 1450, "color": "green", "landmark": "松山文創"},
    {"type": "property", "id": 24, "name": "信義", "price": 6000, "rent": 1700, "color": "green", "landmark": "微風"},
    {"type": "property", "id": 25, "name": "大安", "price": 6500, "rent": 1850, "color": "green", "landmark": "永康街"},
    {"type": "tax", "id": 26, "name": "奢侈稅", "taxKind": "luxury"},
    {"type": "property", "id": 27, "name": "中山", "price": 7000, "rent": 2000, "color": "darkblue", "landmark": "光點台北"},
    {"type": "property", "id": 28, "name": "中正", "price": 7500, "rent": 2100, "color": "darkblue", "landmark": "總統府"},
    {"type": "property", "id": 29, "name": "士林", "price": 8000, "rent": 2250, "color": "darkblue", "landmark": "士林官邸"},
    {"type": "gotojail", "id": 30, "name": "入獄"},
    {"type": "property", "id": 31, "name": "北投", "price": 5500, "rent": 1550, "color": "green", "landmark": "溫泉博物館"},
    {"type": "property", "id": 32, "name": "淡水", "price": 5000, "rent": 1400, "color": "yellow", "landmark": "漁人碼頭"},
    {"type": "chance", "id": 33, "name": "機會"},
    {"type": "property", "id": 34, "name": "八里", "price": 4200, "rent": 1150, "color": "red", "landmark": "左岸"},
    {"type": "property", "id": 35, "name": "新莊", "price": 3800, "rent": 1050, "color": "orange", "landmark": "體育場"},
    {"type": "property", "id": 36, "name": "深坑", "price": 3500, "rent": 980, "color": "pink", "landmark": "豆腐街"},
    {"type": "property", "id": 37, "name": "101大樓", "price": 10000, "rent": 3000, "color": "premium", "landmark": "台北101"},
    {"type": "property", "id": 38, "name": "西門町", "price": 8500, "rent": 2400, "color": "darkblue", "landmark": "紅樓"},
    {"type": "property", "id": 39, "name": "象山", "price": 7200, "rent": 2050, "color": "darkblue", "landmark": "象山步道"},
]

# 逆時針：右下出發 → 底排向左 → 左側(內湖側)向上 → 頂排(南港→信義…)向右 → 右側向下
_CCW_PATH = [
    0, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30,
    19, 18, 17, 16, 15, 14, 13, 12, 11,
    20, 21, 22, 23, 24, 25, 27, 26, 28, 29, 10,
    9, 8, 7, 6, 5, 4, 3, 2, 1,
]
_BY_ID = {s["id"]: s for s in _RAW_BOARD}
BOARD: list[dict[str, Any]] = [copy.deepcopy(_BY_ID[i]) for i in _CCW_PATH]

COLOR_MAP = {
    "brown": "#92400e", "lightblue": "#38bdf8", "pink": "#ec4899", "orange": "#f97316",
    "red": "#dc2626", "yellow": "#eab308", "green": "#16a34a", "darkblue": "#1d4ed8", "premium": "#a855f7",
}


def _clone(state: dict) -> dict:
    return copy.deepcopy(state)


def _prop_key(pid: int) -> str:
    return str(pid)


def get_prop_state(state: dict, pid: int) -> dict | None:
    return state.get("propertyStates", {}).get(_prop_key(pid))


def _player(state: dict, pid: int) -> dict:
    return state["players"][pid]


def owns_color_set(state: dict, owner_id: int, color: str | None) -> bool:
    if not color:
        return False
    props = [s for s in BOARD if s.get("type") == "property" and s.get("color") == color]
    for s in props:
        ps = get_prop_state(state, s["id"])
        if not ps or ps.get("ownerId") != owner_id:
            return False
    return True


def investment_value(base: int, level: int) -> int:
    if level <= 0:
        return 0
    return sum(int(base * UPGRADE_RATIOS[i]) for i in range(level))


def upgrade_cost(state: dict, base: int, current_level: int, buyer_id: int) -> int | None:
    if current_level >= 3:
        return None
    cost = int(base * UPGRADE_RATIOS[current_level])
    av = _player(state, buyer_id).get("avatar")
    if current_level == 0 and av == "🍗":
        cost = int(cost * 0.92)
    if current_level > 0 and av == "🍜":
        cost = int(cost * 0.88)
    return cost


def takeover_cost(state: dict, base: int, level: int, buyer_id: int) -> int:
    cost = int(investment_value(base, level) * TAKEOVER_MULT)
    if _player(state, buyer_id).get("avatar") == "🥟":
        cost = int(cost * 0.9)
    return cost


def calc_rent(state: dict, space: dict, owner_id: int, level: int) -> int:
    rent = int(space["rent"] * RENT_MULT.get(level, 1))
    owner = _player(state, owner_id)
    if owns_color_set(state, owner_id, space.get("color")):
        mult = COLOR_SET_BONUS
        if owner.get("avatar") == "🍱":
            mult = 1.5 * 1.3
        rent = int(rent * mult)
    if owner.get("avatar") == "🦪":
        rent = int(rent * 1.15)
    return rent


def _count_estate(state: dict, player_id: int) -> tuple[int, int]:
    props = levels = 0
    for ps in state.get("propertyStates", {}).values():
        if ps.get("ownerId") == player_id:
            props += 1
            levels += ps.get("level", 0)
    return props, levels


def _tax_discount(state: dict, player: dict, amount: int) -> int:
    if player.get("avatar") == "🍢":
        return int(amount * 0.8)
    return amount


def _land_tax_base(state: dict, player_id: int) -> int:
    props, levels = _count_estate(state, player_id)
    return max(350, 180 * props + 120 * levels)


def _luxury_tax_pay_amount(state: dict, player: dict) -> int:
    return _tax_discount(state, player, 1200)


def calc_bank_liquidation(state: dict, player_id: int) -> int:
    total = 0
    for k, ps in list(state.get("propertyStates", {}).items()):
        if ps.get("ownerId") != player_id:
            continue
        space = next((s for s in state["board"] if str(s["id"]) == k), None)
        if not space or space.get("type") != "property":
            continue
        base = space["price"]
        level = ps.get("level", 0)
        total += int(base * BANK_BUYBACK_RATIO)
        if level > 0:
            total += int(investment_value(base, level) * BANK_BUYBACK_RATIO)
    return total


def _sell_all_to_bank(state: dict, player_id: int) -> int:
    total = calc_bank_liquidation(state, player_id)
    _remove_props(state, player_id)
    state["players"][player_id]["money"] += total
    return total


def _set_anim(state: dict, anim: dict | None) -> None:
    state["centerAnim"] = anim


def create_initial_state(names: list[str], sids: list[str], avatars: list[str] | None = None) -> dict:
    players = []
    for i, name in enumerate(names):
        av = (avatars[i] if avatars and i < len(avatars) else None) or FOOD_AVATARS[i % 10]["emoji"]
        players.append({
            "id": i, "sid": sids[i] if i < len(sids) else None,
            "name": (name or f"玩家 {i + 1}").strip()[:12] or f"玩家 {i + 1}",
            "avatar": av, "money": START_MONEY, "position": 0,
            "bankrupt": False,
        })
    return {
        "phase": "rolling", "players": players, "currentPlayerIndex": 0,
        "board": BOARD, "propertyStates": {}, "dice": None, "diceRolling": False,
        "message": f"{players[0]['avatar']} {players[0]['name']} 的回合",
        "pendingAction": None, "winner": None, "passStartBonus": START_BONUS,
        "foodAvatars": FOOD_AVATARS, "centerAnim": None,
        "lastChanceCard": None,
    }


def _next_idx(state: dict) -> int:
    idx = state["currentPlayerIndex"]
    for _ in range(len(state["players"])):
        idx = (idx + 1) % len(state["players"])
        if not state["players"][idx].get("bankrupt"):
            return idx
    return state["currentPlayerIndex"]


def _check_winner(state: dict) -> dict:
    alive = [p for p in state["players"] if not p.get("bankrupt")]
    if len(alive) == 1:
        w = alive[0]
        state["phase"] = "gameover"
        state["winner"] = w
        state["message"] = f"🎉 {w['avatar']} {w['name']} 獲勝！"
    return state


def _end_turn(state: dict, message: str | None = None) -> dict:
    nxt = _next_idx(state)
    p = state["players"][nxt]
    state.update({"phase": "rolling", "currentPlayerIndex": nxt, "dice": None,
                  "diceRolling": False, "pendingAction": None, "centerAnim": None})
    state["message"] = message or f"{p['avatar']} {p['name']} 的回合"
    return _check_winner(state)


def _pending_kind(state: dict) -> str | None:
    act = state.get("pendingAction")
    return act.get("kind") if act else None


def _set_pending(state: dict, action: dict) -> dict:
    state["phase"] = "action"
    state["pendingAction"] = action
    return state


def _move_with_anim(state: dict, steps: int) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    old = cur["position"]
    new = (old + steps + BOARD_SIZE) % BOARD_SIZE
    path = [(old + i + 1) % BOARD_SIZE for i in range(abs(steps))] if steps > 0 else []
    cur["position"] = new
    bonus = 0
    if steps > 0 and new < old:
        bonus = state["passStartBonus"]
        buffs = state.setdefault("buffs", {})
        if buffs.pop(str(cur["id"]), None) == "double_start":
            bonus *= 2
        if cur.get("avatar") == "🍚":
            bonus += 800
        cur["money"] += bonus
    state["phase"] = "moving"
    _set_anim(state, {
        "type": "move", "from": old, "to": new, "path": path,
        "playerIndex": state["currentPlayerIndex"], "passBonus": bonus,
    })
    return state


def _transfer_prop(state: dict, pid: int, owner: int, level: int) -> None:
    state.setdefault("propertyStates", {})[_prop_key(pid)] = {"ownerId": owner, "level": level}


def _remove_props(state: dict, player_id: int, to_id: int | None = None) -> None:
    for k, ps in list(state.get("propertyStates", {}).items()):
        if ps.get("ownerId") == player_id:
            if to_id is not None:
                ps["ownerId"] = to_id
            else:
                del state["propertyStates"][k]


def _handle_landing(state: dict) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    space = state["board"][cur["position"]]
    st, pid = space["type"], space["id"]

    if st == "start":
        return _end_turn(state, f"經過起點 +${state.get('centerAnim', {}).get('passBonus', state['passStartBonus'])}")
    if st == "chance":
        return _set_pending(state, {"kind": "chance", "message": "抽到機會卡！翻開看看"})
    if st == "tax":
        kind = space.get("taxKind", "land")
        if kind == "land":
            props, levels = _count_estate(state, cur["id"])
            base = _land_tax_base(state, cur["id"])
            amount = _tax_discount(state, cur, base)
            return _set_pending(state, {
                "kind": "tax_land",
                "message": f"🏛️ 地價稅稽查！持有 {props} 塊地、{levels} 級建設",
                "amount": amount, "baseAmount": base, "props": props, "levels": levels,
            })
        pay_amt = _luxury_tax_pay_amount(state, cur)
        return _set_pending(state, {
            "kind": "tax_luxury",
            "message": "💎 奢侈稅！老實繳清或轉盤一搏？",
            "payAmount": pay_amt,
        })
    if st == "bank":
        fee = space.get("bankFee", BANK_FEE)
        return _set_pending(state, {
            "kind": "bank_fee",
            "message": f"🏦 銀行業務手續費 ${fee}",
            "amount": fee,
        })
    if st == "parking":
        if cur.get("avatar") == "🍮":
            cur["money"] += 500
            return _end_turn(state, "休息區恢復 $500（豆花加成）")
        return _end_turn(state, "在休息區")
    if st == "gotojail":
        return _set_pending(state, {
            "kind": "gotojail_fine",
            "message": f"⚠️ 入獄罰款 ${GOTO_JAIL_FINE}（付清後送往銀行）",
            "amount": GOTO_JAIL_FINE,
        })

    if st != "property":
        return _end_turn(state)

    ps = get_prop_state(state, pid)
    base = space["price"]

    if not ps:
        cost = upgrade_cost(state, base, 0, cur["id"])
        return _set_pending(state, {
            "kind": "buy", "message": f"「{space['name']}」空地，蓋小公寓 ${cost}",
            "amount": cost, "propertyId": pid, "nextLevel": 1,
            "rentPreview": calc_rent(state, space, cur["id"], 1),
        })

    owner_id, level = ps["ownerId"], ps["level"]

    if owner_id == cur["id"]:
        if level >= 3:
            return _end_turn(state, f"{space['name']} 已是地標「{space.get('landmark')}」")
        cost = upgrade_cost(state, base, level, cur["id"])
        nxt = level + 1
        return _set_pending(state, {
            "kind": "upgrade",
            "message": f"升級 {space['name']} → {LEVEL_NAMES[nxt]} ${cost}",
            "amount": cost, "propertyId": pid, "nextLevel": nxt,
            "rentPreview": calc_rent(state, space, cur["id"], nxt),
        })

    owner = _player(state, owner_id)
    rent = calc_rent(state, space, owner_id, level)
    action = {
        "kind": "rent",
        "message": f"停在 {owner['avatar']}{owner['name']} 的 {space['name']}（{LEVEL_NAMES[level]}）過路費 ${rent}",
        "amount": rent, "propertyId": pid, "rentLevel": level,
    }
    if level < 3:
        tcost = takeover_cost(state, base, level, cur["id"])
        action["takeoverAmount"] = tcost
        action["takeoverLevel"] = level + 1
        action["sellerId"] = owner_id
        action["message"] += f"　或搶購 ${tcost}"
    return _set_pending(state, action)


def roll_dice(state: dict) -> dict:
    state = _clone(state)
    if state["phase"] not in ("rolling", "moving"):
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    d1, d2 = random.randint(1, 6), random.randint(1, 6)
    total = d1 + d2
    state["dice"] = [d1, d2]
    state["diceRolling"] = True
    state = _move_with_anim(state, total)
    state["diceRolling"] = False
    state["message"] = f"擲出 {d1}+{d2}={total}"
    state["centerAnim"] = {"type": "dice", "values": [d1, d2]}
    return _handle_landing(state)


def _apply_build(state: dict, pid: int, cost: int, level: int, seller: int | None = None) -> bool:
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < cost:
        return False
    cur["money"] -= cost
    if seller is not None:
        pay = cost
        if _player(state, seller).get("avatar") == "🍍":
            pay = int(pay * 1.12)
        state["players"][seller]["money"] += pay
    _transfer_prop(state, pid, cur["id"], level)
    space = next(s for s in state["board"] if s["id"] == pid)
    _set_anim(state, {
        "type": "build", "level": level, "propertyId": pid,
        "propertyName": space["name"], "landmark": space.get("landmark", ""),
    })
    return True


def buy_property(state: dict) -> dict:
    return _do_build(state, "buy")


def upgrade_property(state: dict) -> dict:
    return _do_build(state, "upgrade")


def takeover_property(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") == "rent" and act.get("takeoverAmount"):
        act = {
            "kind": "takeover", "amount": act["takeoverAmount"],
            "nextLevel": act["takeoverLevel"], "propertyId": act["propertyId"],
            "sellerId": act.get("sellerId"),
        }
    elif act.get("kind") != "takeover":
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < act["amount"]:
        rescue = _offer_bank_rescue(state, act["amount"], act.get("sellerId"), "搶購", copy.deepcopy(act))
        if rescue:
            return state
        return _end_turn(state, "資金不足")
    if not _apply_build(state, act["propertyId"], act["amount"], act["nextLevel"], act.get("sellerId")):
        return _end_turn(state, "資金不足")
    space = next(s for s in state["board"] if s["id"] == act["propertyId"])
    return _end_turn(state, f"{cur['avatar']} 搶購 {space['name']} → {LEVEL_NAMES[act['nextLevel']]}")


def _do_build(state: dict, kind: str) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != kind:
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < act["amount"]:
        rescue = _offer_bank_rescue(state, act["amount"], act.get("sellerId"), "建設", copy.deepcopy(act))
        if rescue:
            return state
        return _end_turn(state, "資金不足")
    if not _apply_build(state, act["propertyId"], act["amount"], act["nextLevel"], act.get("sellerId")):
        return _end_turn(state, "資金不足")
    space = next(s for s in state["board"] if s["id"] == act["propertyId"])
    return _end_turn(state, f"{cur['avatar']} {space['name']} → {LEVEL_NAMES[act['nextLevel']]}")


def skip_action(state: dict) -> dict:
    return _end_turn(_clone(state), "放棄")


def _do_bankrupt(state: dict, amount: int, recipient: int | None) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    rem = cur["money"]
    cur.update({"bankrupt": True, "money": 0})
    if recipient is not None:
        state["players"][recipient]["money"] += rem
        _remove_props(state, cur["id"], recipient)
    else:
        _remove_props(state, cur["id"])
    return _check_winner(_end_turn(state, f"💸 {cur['name']} 破產！"))


def _offer_bank_rescue(state: dict, amount: int, recipient: int | None, reason: str, resume: dict | None = None) -> dict | None:
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] >= amount:
        return None
    liq = calc_bank_liquidation(state, cur["id"])
    if cur["money"] + liq < amount:
        return None
    pending: dict[str, Any] = {
        "kind": "bank_rescue",
        "message": f"{reason} 資金不足！可將所有地產售予銀行得 ${liq}",
        "amount": amount,
        "liquidation": liq,
        "recipient": recipient,
    }
    if resume:
        pending["resumeAction"] = resume
    return _set_pending(state, pending)


def _pay(state: dict, amount: int, recipient: int | None = None) -> dict:
    cur = state["players"][state["currentPlayerIndex"]]
    if cur["money"] < amount:
        rescue = _offer_bank_rescue(state, amount, recipient, "付款")
        if rescue:
            return rescue
        return _do_bankrupt(state, amount, recipient)
    cur["money"] -= amount
    if recipient is not None:
        state["players"][recipient]["money"] += amount
    _set_anim(state, {"type": "rent", "amount": amount, "playerIndex": state["currentPlayerIndex"]})
    return state


def pay_rent(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "rent":
        return state
    ps = get_prop_state(state, act["propertyId"])
    owner = ps["ownerId"] if ps else None
    state = _pay(state, act["amount"], owner)
    if _pending_kind(state) == "bank_rescue":
        return state
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"支付過路費 ${act['amount']}")


def pay_bank_fee(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    kind = act.get("kind")
    if kind not in ("bank_fee", "gotojail_fine"):
        return state
    state = _pay(state, act["amount"])
    if _pending_kind(state) == "bank_rescue":
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    if cur.get("bankrupt"):
        return state
    if kind == "gotojail_fine":
        cur["position"] = BANK_POSITION
        _set_anim(state, {"type": "bank", "text": "前往銀行"})
        return _handle_landing(state)
    return _end_turn(state, f"銀行手續費 ${act['amount']}")


def sell_to_bank(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "bank_rescue":
        return state
    cur = state["players"][state["currentPlayerIndex"]]
    got = _sell_all_to_bank(state, cur["id"])
    state["pendingAction"] = None
    amount = act["amount"]
    recipient = act.get("recipient")
    state = _pay(state, amount, recipient)
    if _pending_kind(state) == "bank_rescue":
        return state
    if cur.get("bankrupt"):
        return state
    _set_anim(state, {"type": "bank", "text": f"售地套現 +${got}", "amount": got})
    msg = f"售地套現 ${got}，完成付款 ${amount}"
    resume = act.get("resumeAction")
    if resume and resume.get("kind") in ("buy", "upgrade", "takeover"):
        state["pendingAction"] = resume
        if resume["kind"] == "takeover":
            return takeover_property(state)
        return _do_build(state, resume["kind"])
    return _end_turn(state, msg)


def declare_bankrupt(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "bank_rescue":
        return state
    return _do_bankrupt(state, act["amount"], act.get("recipient"))


def pay_tax(state: dict) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    if act.get("kind") != "tax":
        return state
    state = _pay(state, act["amount"])
    if _pending_kind(state) == "bank_rescue":
        return state
    if state["players"][state["currentPlayerIndex"]].get("bankrupt"):
        return state
    return _end_turn(state, f"繳稅 ${act['amount']}")


def choose_tax(state: dict, choice: str) -> dict:
    state = _clone(state)
    act = state.get("pendingAction") or {}
    cur = state["players"][state["currentPlayerIndex"]]
    kind = act.get("kind")

    if kind == "tax_land":
        if choice == "gamble":
            die = random.randint(1, 6)
            mult = 0.5 if die <= 3 else 1.8
            amount = _tax_discount(state, cur, int(act["baseAmount"] * mult))
            label = "稽查過關減半" if die <= 3 else "稽查加碼"
            msg = f"🎲 稽查骰 {die} 點 → {label}"
        else:
            amount = act["amount"]
            msg = "📋 全額申報"
        _set_anim(state, {"type": "tax", "text": msg, "amount": amount})
        state = _pay(state, amount)
        if _pending_kind(state) == "bank_rescue":
            return state
        if cur.get("bankrupt"):
            return state
        return _end_turn(state, f"{msg} ${amount}")

    if kind == "tax_luxury":
        if choice == "spin":
            roll = random.randint(1, 100)
            if roll <= 15:
                amount, msg = 0, "🎡 轉盤：免稅！"
            elif roll <= 45:
                amount = _tax_discount(state, cur, 600)
                msg = "🎡 轉盤：小罰"
            elif roll <= 75:
                amount = _tax_discount(state, cur, 2200)
                msg = "🎡 轉盤：大出血"
            else:
                total = 0
                for i, pl in enumerate(state["players"]):
                    if i != cur["id"] and not pl.get("bankrupt"):
                        pay = min(250, pl["money"])
                        pl["money"] -= pay
                        total += pay
                cur["money"] += total
                amount, msg = 0, f"🎡 轉盤：大家請客 +${total}"
            if amount > 0:
                _set_anim(state, {"type": "tax", "text": msg, "amount": amount})
                state = _pay(state, amount)
            if _pending_kind(state) == "bank_rescue":
                return state
        else:
            amount = act["payAmount"]
            msg = "💳 老實繳清"
            _set_anim(state, {"type": "tax", "text": msg, "amount": amount})
            state = _pay(state, amount)
            if _pending_kind(state) == "bank_rescue":
                return state
        if cur.get("bankrupt"):
            return state
        return _end_turn(state, msg if amount == 0 else f"{msg} ${amount}")

    return state


def _chance_cards(state: dict) -> list[tuple[str, Callable[[dict], dict]]]:
    idx = state["currentPlayerIndex"]
    p = state["players"][idx]
    name = p["name"]

    def money(amt: int, msg: str):
        def fn(s: dict) -> dict:
            mult = 1.25 if p.get("avatar") == "🧋" and amt > 0 else 1.0
            s["players"][idx]["money"] = max(0, s["players"][idx]["money"] + int(amt * mult))
            s["lastChanceCard"] = msg
            return s
        return msg, fn

    return [
        money(1500, f"{name} 中樂透 +$1500"),
        money(2000, f"{name} 政府補助 +$2000"),
        money(2500, f"{name} 股票分紅 +$2500"),
        money(800, f"{name} 撿到錢 +$800"),
        money(600, f"{name} 夜市攤販小賺 +$600"),
        money(-700, f"{name} 修車 -$700"),
        money(-1000, f"{name} 罰單 -$1000"),
        money(-500, f"{name} 醫藥費 -$500"),
        money(-1200, f"{name} 水電費 -$1200"),
        money(-800, f"{name} 被詐騙 -$800"),
        (f"{name} 前進 4 格", lambda s: _move_with_anim(_clone(s), 4)),
        (f"{name} 前進 2 格", lambda s: _move_with_anim(_clone(s), 2)),
        (f"{name} 前進 6 格", lambda s: _move_with_anim(_clone(s), 6)),
        (f"{name} 後退 3 格", lambda s: _move_with_anim(_clone(s), -3)),
        (f"{name} 後退 5 格", lambda s: _move_with_anim(_clone(s), -5)),
        (f"{name} 回到起點", lambda s: _goto_start(_clone(s), idx)),
        (f"{name} 去銀行", lambda s: _send_bank(_clone(s), idx)),
        (f"全員給 {name} $300", lambda s: _collect_all(_clone(s), idx, 300)),
        (f"全員給 {name} $500", lambda s: _collect_all(_clone(s), idx, 500)),
        (f"{name} 免費升級一塊地", lambda s: _free_upgrade(_clone(s), idx)),
        (f"{name} 免費蓋小公寓", lambda s: _free_buy(_clone(s), idx)),
        money(1200, f"{name} 地產稅退稅 +$1200"),
        (f"{name} 下次起點雙倍", lambda s: _double_start(_clone(s), idx)),
        (f"{name} 休息區補給 +$400", lambda s: _rest_bonus(_clone(s), idx, 400)),
        (f"{name} 交換位置（隨機）", lambda s: _swap_random(_clone(s), idx)),
    ]


def _goto_start(s: dict, idx: int) -> dict:
    s["players"][idx]["position"] = 0
    bonus = s["passStartBonus"] + (800 if s["players"][idx].get("avatar") == "🍚" else 0)
    s["players"][idx]["money"] += bonus
    s["lastChanceCard"] = "回到起點"
    return s


def _send_bank(s: dict, idx: int) -> dict:
    s["players"][idx]["position"] = BANK_POSITION
    s["lastChanceCard"] = "被送去銀行"
    return s


def _collect_all(s: dict, idx: int, amt: int) -> dict:
    total = 0
    for i, pl in enumerate(s["players"]):
        if i != idx and not pl.get("bankrupt"):
            pay = min(amt, pl["money"])
            pl["money"] -= pay
            total += pay
    s["players"][idx]["money"] += total
    s["lastChanceCard"] = f"收到紅包 ${total}"
    return s


def _free_upgrade(s: dict, idx: int) -> dict:
    for k, ps in s.get("propertyStates", {}).items():
        if ps.get("ownerId") == idx and ps.get("level", 0) < 3:
            ps["level"] += 1
            s["lastChanceCard"] = "免費升級一塊地產"
            return s
    s["lastChanceCard"] = "沒有可升級的地產"
    return s


def _double_start(s: dict, idx: int) -> dict:
    s.setdefault("buffs", {})[str(idx)] = "double_start"
    s["lastChanceCard"] = "下次起點獎金雙倍"
    return s


def _free_buy(s: dict, idx: int) -> dict:
    for space in s["board"]:
        if space.get("type") != "property":
            continue
        pid = space["id"]
        if not get_prop_state(s, pid):
            _transfer_prop(s, pid, idx, 1)
            s["lastChanceCard"] = f"免費在 {space['name']} 蓋小公寓"
            _set_anim(s, {"type": "build", "level": 1, "propertyId": pid,
                          "propertyName": space["name"], "landmark": space.get("landmark", "")})
            return s
    s["lastChanceCard"] = "沒有空地可蓋"
    return s


def _rest_bonus(s: dict, idx: int, amt: int) -> dict:
    s["players"][idx]["money"] += amt
    s["lastChanceCard"] = f"休息補給 +${amt}"
    return s


def _swap_random(s: dict, idx: int) -> dict:
    others = [i for i, pl in enumerate(s["players"]) if i != idx and not pl.get("bankrupt")]
    if not others:
        s["lastChanceCard"] = "沒有可交換的玩家"
        return s
    other = random.choice(others)
    s["players"][idx]["position"], s["players"][other]["position"] = (
        s["players"][other]["position"], s["players"][idx]["position"],
    )
    s["lastChanceCard"] = f"與 {s['players'][other]['name']} 交換位置"
    return s


def apply_chance_card(state: dict) -> dict:
    state = _clone(state)
    cards = _chance_cards(state)
    msg, fn = random.choice(cards)
    idx = state["currentPlayerIndex"]
    old_pos = state["players"][idx]["position"]
    state = fn(state)
    state["pendingAction"] = None
    if state.get("centerAnim", {}).get("type") != "build":
        _set_anim(state, {"type": "chance", "text": state.get("lastChanceCard", msg)})
    new_pos = state["players"][idx]["position"]
    if new_pos != old_pos:
        return _handle_landing(state)
    return _end_turn(state, state.get("lastChanceCard", msg))


def build_client_view(state: dict, sid: str) -> dict:
    my_index = next((i for i, p in enumerate(state["players"]) if p.get("sid") == sid), 0)
    return {
        "state": state, "myIndex": my_index,
        "isMyTurn": state["currentPlayerIndex"] == my_index and state["phase"] != "gameover",
        "colorMap": COLOR_MAP, "foodAvatars": FOOD_AVATARS,
    }


def player_index_for_sid(state: dict, sid: str) -> int | None:
    for i, p in enumerate(state["players"]):
        if p.get("sid") == sid:
            return i
    return None


skip_buy = skip_action
