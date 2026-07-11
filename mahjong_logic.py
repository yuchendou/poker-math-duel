"""台灣麻將簡化版：16 張手牌、花牌、自摸胡、基本台數。"""

import random
from collections import Counter

# 萬 M1-9、筒 P1-9、索 S1-9、字 Z1-7、花 F1-8
SUITS_NUM = ("M", "P", "S")
HONORS = ("Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7")  # 東南西北中發白
FLOWERS = ("F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8")  # 梅蘭竹菊春夏秋冬

TILE_LABELS = {
    **{f"M{i}": f"{i}萬" for i in range(1, 10)},
    **{f"P{i}": f"{i}筒" for i in range(1, 10)},
    **{f"S{i}": f"{i}索" for i in range(1, 10)},
    "Z1": "東", "Z2": "南", "Z3": "西", "Z4": "北",
    "Z5": "中", "Z6": "發", "Z7": "白",
    "F1": "梅", "F2": "蘭", "F3": "竹", "F4": "菊",
    "F5": "春", "F6": "夏", "F7": "秋", "F8": "冬",
}

WIND_NAMES = ("東", "南", "西", "北")
# 各風位正花
SEAT_FLOWERS = {
    0: ("F5", "F1"),  # 東：春、梅
    1: ("F6", "F2"),  # 南：夏、蘭
    2: ("F7", "F3"),  # 西：秋、竹
    3: ("F8", "F4"),  # 北：冬、菊
}

AI_NAMES = ("電腦西", "電腦北")


def create_wall():
    wall = []
    for suit in SUITS_NUM:
        for i in range(1, 10):
            wall.extend([f"{suit}{i}"] * 4)
    for tile in HONORS:
        wall.extend([tile] * 4)
    for tile in FLOWERS:
        wall.append(tile)
    random.shuffle(wall)
    return wall


def is_flower(tile):
    return tile in FLOWERS


def tile_sort_key(tile):
    order = {"M": 0, "P": 1, "S": 2, "Z": 3, "F": 4}
    if tile[0] in order:
        return (order[tile[0]], int(tile[1:]))
    return (9, 0)


def sort_tiles(tiles):
    return sorted(tiles, key=tile_sort_key)


def _can_form_melds(counts):
    if not counts:
        return True
    first = min(counts.keys(), key=tile_sort_key)
    if counts[first] >= 3:
        c = counts.copy()
        c[first] -= 3
        if c[first] == 0:
            del c[first]
        if _can_form_melds(c):
            return True
    if first[0] in SUITS_NUM:
        n = int(first[1])
        if n <= 7:
            t2 = f"{first[0]}{n + 1}"
            t3 = f"{first[0]}{n + 2}"
            if counts.get(t2, 0) > 0 and counts.get(t3, 0) > 0:
                c = counts.copy()
                c[first] -= 1
                c[t2] -= 1
                c[t3] -= 1
                for k in (first, t2, t3):
                    if c.get(k, 0) == 0:
                        c.pop(k, None)
                if _can_form_melds(c):
                    return True
    return False


def can_win(tiles):
    """標準胡牌：5 面子 + 1 將（不含花牌）。"""
    if len(tiles) % 3 != 2:
        return False
    counts = Counter(tiles)
    for pair in list(counts.keys()):
        if counts[pair] >= 2:
            c = counts.copy()
            c[pair] -= 2
            if c[pair] == 0:
                del c[pair]
            if _can_form_melds(c):
                return True
    return False


def draw_from_wall(wall, seat):
    """摸牌並處理花牌補牌。回傳最後摸到的非花牌或 None。"""
    last = None
    while wall:
        tile = wall.pop()
        if is_flower(tile):
            seat["flowers"].append(tile)
            continue
        seat["hand"].append(tile)
        last = tile
        break
    seat["hand"] = sort_tiles(seat["hand"])
    return last


def deal_initial(wall, seats, dealer):
    for seat in seats:
        seat["hand"] = []
        seat["flowers"] = []
        seat["discards"] = []
    for _ in range(16):
        for seat in seats:
            draw_from_wall(wall, seat)
    # 莊家多摸一張
    draw_from_wall(wall, seats[dealer])
    return wall


def calc_tai(seat, dealer_seat, zimo):
    tai = 1  # 底台
    items = ["底台 1 台"]
    if seat["seatIndex"] == dealer_seat:
        tai += 1
        items.append("莊家 1 台")
    if zimo:
        tai += 1
        items.append("自摸 1 台")
    if not seat.get("melds"):
        tai += 1
        items.append("門清 1 台")
    wind = seat["seatIndex"]
    for flower in seat["flowers"]:
        if flower in SEAT_FLOWERS[wind]:
            tai += 1
            items.append(f"正花 {TILE_LABELS[flower]} 1 台")
        else:
            tai += 1
            items.append(f"花牌 {TILE_LABELS[flower]} 1 台")
    items.append("平胡 1 台")
    tai += 1
    return tai, items


def ai_choose_discard(seat):
    """簡單 AI：優先打字牌，否則打最大孤立牌。"""
    hand = seat["hand"]
    if not hand:
        return None
    honors = [t for t in hand if t.startswith("Z")]
    if honors:
        return honors[-1]
    counts = Counter(hand)
    singles = [t for t in hand if counts[t] == 1]
    if singles:
        return max(singles, key=tile_sort_key)
    return hand[-1]


def create_seats(human_players):
    """human_players: [{id, name}, ...] 最多 2 人，補 2 AI。"""
    seats = []
    for i, p in enumerate(human_players):
        seats.append({
            "id": p["id"],
            "name": p["name"],
            "isAI": False,
            "seatIndex": i,
            "hand": [],
            "flowers": [],
            "discards": [],
            "melds": [],
        })
    for j, ai_name in enumerate(AI_NAMES):
        idx = len(human_players) + j
        seats.append({
            "id": f"ai-{idx}",
            "name": ai_name,
            "isAI": True,
            "seatIndex": idx,
            "hand": [],
            "flowers": [],
            "discards": [],
            "melds": [],
        })
    return seats


def start_round(human_players):
    dealer = random.randint(0, 3)
    seats = create_seats(human_players)
    wall = create_wall()
    wall = deal_initial(wall, seats, dealer)
    return {
        "seats": seats,
        "wall": wall,
        "dealer": dealer,
        "currentSeat": dealer,
        "phase": "discard",
        "lastDraw": None,
        "winner": None,
        "winInfo": None,
        "zimo": False,
    }


def seat_by_id(round_state, sid):
    for s in round_state["seats"]:
        if s["id"] == sid:
            return s
    return None


def seat_index_by_id(round_state, sid):
    for i, s in enumerate(round_state["seats"]):
        if s["id"] == sid:
            return i
    return -1


def build_client_view(round_state, viewer_sid):
    viewer_seat = seat_by_id(round_state, viewer_sid)
    my_index = viewer_seat["seatIndex"] if viewer_seat else -1
    current = round_state["currentSeat"]
    phase = round_state["phase"]

    seats_view = []
    for s in round_state["seats"]:
        is_me = s["id"] == viewer_sid
        seats_view.append({
            "id": s["id"],
            "name": s["name"],
            "wind": WIND_NAMES[s["seatIndex"]],
            "seatIndex": s["seatIndex"],
            "isAI": s["isAI"],
            "isMe": is_me,
            "handCount": len(s["hand"]),
            "flowers": [TILE_LABELS[f] for f in s["flowers"]],
            "discards": [TILE_LABELS[t] for t in s["discards"]],
            "hand": [{"id": t, "label": TILE_LABELS[t]} for t in s["hand"]] if is_me else None,
        })

    can_act = (
        viewer_seat
        and not viewer_seat["isAI"]
        and viewer_seat["seatIndex"] == current
        and round_state["winner"] is None
    )
    can_hu = can_act and phase == "discard" and can_win(viewer_seat["hand"])

    return {
        "dealer": round_state["dealer"],
        "dealerWind": WIND_NAMES[round_state["dealer"]],
        "currentSeat": current,
        "currentName": round_state["seats"][current]["name"],
        "phase": phase,
        "wallCount": len(round_state["wall"]),
        "seats": seats_view,
        "mySeat": my_index,
        "canDiscard": can_act and phase == "discard",
        "canHu": can_hu,
        "lastDraw": TILE_LABELS[round_state["lastDraw"]] if round_state.get("lastDraw") else None,
        "winner": round_state.get("winner"),
        "winInfo": round_state.get("winInfo"),
    }


def apply_discard(round_state, seat_idx, tile):
    seat = round_state["seats"][seat_idx]
    if tile not in seat["hand"]:
        return False, "手牌中沒有這張牌"
    seat["hand"].remove(tile)
    seat["discards"].append(tile)
    round_state["lastDraw"] = None
    round_state["currentSeat"] = (seat_idx + 1) % 4
    round_state["phase"] = "draw"
    return True, ""


def apply_draw(round_state):
    seat = round_state["seats"][round_state["currentSeat"]]
    if not round_state["wall"]:
        round_state["winner"] = "draw"
        round_state["winInfo"] = {"message": "流局，無人胡牌"}
        return None
    tile = draw_from_wall(round_state["wall"], seat)
    round_state["lastDraw"] = tile
    round_state["phase"] = "discard"
    if can_win(seat["hand"]):
        return "win"
    return tile
