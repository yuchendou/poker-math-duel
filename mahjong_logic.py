"""台灣麻將完整規則：吃碰槓、搶槓、胡牌、完整台數。"""

import random
from collections import Counter

SUITS_NUM = ("M", "P", "S")
HONORS = ("Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7")
FLOWERS = ("F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8")
DRAGONS = ("Z5", "Z6", "Z7")
WINDS = ("Z1", "Z2", "Z3", "Z4")

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
SEAT_FLOWERS = {0: ("F5", "F1"), 1: ("F6", "F2"), 2: ("F7", "F3"), 3: ("F8", "F4")}
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
    if tile and tile[0] in order:
        return (order[tile[0]], int(tile[1:]))
    return (9, 0)


def sort_tiles(tiles):
    return sorted(tiles, key=tile_sort_key)


def next_seat(idx):
    return (idx + 1) % 4


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
            t2, t3 = f"{first[0]}{n + 1}", f"{first[0]}{n + 2}"
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


def can_win_tiles(tiles):
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


def all_tiles_for_win(hand, melds, extra=None):
    tiles = list(hand)
    if extra:
        tiles.append(extra)
    for m in melds:
        if m["type"] == "chi":
            tiles.extend(m["tiles"])
        elif m["type"] in ("pon", "minkong", "jiagang", "ankong"):
            n = 4 if m["type"] in ("minkong", "jiagong", "ankong") else 3
            tiles.extend([m["tile"]] * n)
    return tiles


def can_win(hand, melds, extra=None):
    return can_win_tiles(all_tiles_for_win(hand, melds, extra))


def is_menqing(melds):
    """門清：無吃、碰、明槓、加槓（暗槓仍算門清）。"""
    return not any(m["type"] in ("chi", "pon", "minkong", "jiagang") for m in melds)


def draw_from_wall(rnd, seat):
    wall = rnd["wall"]
    if not wall:
        return None
    last = None
    use_tail = rnd.get("drawFromTail", False)
    rnd["drawFromTail"] = False
    while wall:
        tile = wall.pop() if not use_tail else wall.pop(0)
        if is_flower(tile):
            seat["flowers"].append(tile)
            continue
        seat["hand"].append(tile)
        last = tile
        break
    seat["hand"] = sort_tiles(seat["hand"])
    rnd["lastDraw"] = last
    return last


def deal_initial(wall, seats, dealer):
    for seat in seats:
        seat["hand"] = []
        seat["flowers"] = []
        seat["discards"] = []
        seat["melds"] = []
    rnd_stub = {"wall": wall}
    for _ in range(16):
        for seat in seats:
            draw_from_wall(rnd_stub, seat)
    draw_from_wall(rnd_stub, seats[dealer])
    return wall


def create_seats(human_players):
    seats = []
    for i, p in enumerate(human_players):
        seats.append({
            "id": p["id"], "name": p["name"], "isAI": False,
            "seatIndex": i, "hand": [], "flowers": [], "discards": [], "melds": [],
        })
    for j, ai_name in enumerate(AI_NAMES):
        idx = len(human_players) + j
        seats.append({
            "id": f"ai-{idx}", "name": ai_name, "isAI": True,
            "seatIndex": idx, "hand": [], "flowers": [], "discards": [], "melds": [],
        })
    return seats


def start_round(human_players, dealer=0, dealer_streak=0, round_wind=0):
    seats = create_seats(human_players)
    wall = create_wall()
    wall = deal_initial(wall, seats, dealer)
    return {
        "seats": seats,
        "wall": wall,
        "dealer": dealer,
        "dealerStreak": dealer_streak,
        "currentSeat": dealer,
        "phase": "discard",
        "lastDraw": None,
        "lastDiscard": None,
        "discardSeat": None,
        "payerSeat": None,
        "claim": None,
        "robKong": None,
        "drawFromTail": False,
        "winFlags": {},
        "winner": None,
        "winnerSeat": None,
        "winInfo": None,
        "discardCount": 0,
        "roundWind": round_wind,
    }


def seat_by_id(rnd, sid):
    for s in rnd["seats"]:
        if s["id"] == sid:
            return s
    return None


def seat_at(rnd, idx):
    return rnd["seats"][idx]


def meld_label(m):
    t = TILE_LABELS.get(m.get("tile") or m["tiles"][0], "")
    kind = {"chi": "吃", "pon": "碰", "minkong": "明槓", "ankong": "暗槓", "jiagang": "加槓"}[m["type"]]
    if m["type"] == "chi":
        return f"{kind}{''.join(TILE_LABELS[x] for x in m['tiles'])}"
    return f"{kind}{t}"


def tile_obj(tile_id):
    return {"id": tile_id, "label": TILE_LABELS[tile_id]}


def meld_to_client(m, viewer_is_owner):
    kind = {"chi": "吃", "pon": "碰", "minkong": "明槓", "ankong": "暗槓", "jiagang": "加槓"}[m["type"]]
    if m["type"] == "chi":
        return {
            "type": m["type"],
            "kind": kind,
            "tiles": [tile_obj(t) for t in m["tiles"]],
        }
    tile = m["tile"]
    count = 4 if m["type"] in ("minkong", "ankong", "jiagang") else 3
    if m["type"] == "ankong" and not viewer_is_owner:
        return {
            "type": m["type"],
            "kind": kind,
            "faceDown": True,
            "tiles": [{"id": "back", "label": "暗槓"}] * count,
        }
    return {
        "type": m["type"],
        "kind": kind,
        "tiles": [tile_obj(tile)] * count,
    }


def _chi_options(hand, tile):
    if tile[0] not in SUITS_NUM:
        return []
    n = int(tile[1])
    opts = []
    if n >= 3:
        a, b = f"{tile[0]}{n - 2}", f"{tile[0]}{n - 1}"
        if a in hand and b in hand:
            opts.append(sort_tiles([a, b, tile]))
    if 2 <= n <= 8:
        a, b = f"{tile[0]}{n - 1}", f"{tile[0]}{n + 1}"
        if a in hand and b in hand:
            opts.append(sort_tiles([a, tile, b]))
    if n <= 7:
        a, b = f"{tile[0]}{n + 1}", f"{tile[0]}{n + 2}"
        if a in hand and b in hand:
            opts.append(sort_tiles([tile, a, b]))
    return opts


def get_claim_options(rnd, seat_idx):
    claim = rnd.get("claim")
    if not claim:
        return []
    tile, from_seat = claim["tile"], claim["fromSeat"]
    if seat_idx == from_seat:
        return []
    seat = seat_at(rnd, seat_idx)
    opts = []
    if can_win(seat["hand"], seat["melds"], tile):
        opts.append({"action": "hu", "tile": tile})
    if seat["hand"].count(tile) >= 2:
        opts.append({"action": "pon", "tile": tile})
    if seat["hand"].count(tile) >= 3:
        opts.append({"action": "minkong", "tile": tile})
    if next_seat(from_seat) == seat_idx:
        for chi_tiles in _chi_options(seat["hand"], tile):
            opts.append({"action": "chi", "tiles": chi_tiles, "tile": tile})
    return opts


def get_rob_kong_options(rnd, seat_idx):
    rk = rnd.get("robKong")
    if not rk or rk.get("resolved"):
        return []
    if seat_idx == rk["seat"]:
        return []
    seat = seat_at(rnd, seat_idx)
    tile = rk["tile"]
    if can_win(seat["hand"], seat["melds"], tile):
        return [{"action": "qianggang", "tile": tile}]
    return []


def get_self_actions(rnd, seat_idx):
    seat = seat_at(rnd, seat_idx)
    acts = []
    if rnd["phase"] != "discard" or rnd["currentSeat"] != seat_idx:
        return acts
    if can_win(seat["hand"], seat["melds"]):
        acts.append({"action": "zimo"})
    for t in set(seat["hand"]):
        if seat["hand"].count(t) == 4:
            acts.append({"action": "ankong", "tile": t})
    for i, m in enumerate(seat["melds"]):
        if m["type"] == "pon" and seat["hand"].count(m["tile"]) >= 1:
            acts.append({"action": "jiagang", "tile": m["tile"], "meldIndex": i})
    return acts


def open_claim_window(rnd, tile, from_seat):
    rnd["claim"] = {
        "tile": tile,
        "fromSeat": from_seat,
        "responses": {},
    }
    rnd["phase"] = "claim"
    rnd["lastDiscard"] = tile


def _remove_discard(rnd, from_seat, tile):
    disc = rnd["seats"][from_seat]["discards"]
    if disc and disc[-1] == tile:
        disc.pop()


def apply_chi(rnd, seat_idx, tiles):
    claim = rnd["claim"]
    tile = claim["tile"]
    from_seat = claim["fromSeat"]
    if next_seat(from_seat) != seat_idx:
        return False, "只有下家可以吃"
    seat = seat_at(rnd, seat_idx)
    for t in tiles:
        if t != tile and t not in seat["hand"]:
            return False, "手牌不足以吃"
    for t in tiles:
        if t != tile:
            seat["hand"].remove(t)
    _remove_discard(rnd, from_seat, tile)
    seat["melds"].append({"type": "chi", "tiles": sort_tiles(tiles), "from": from_seat})
    seat["hand"] = sort_tiles(seat["hand"])
    rnd["claim"] = None
    rnd["currentSeat"] = seat_idx
    rnd["phase"] = "discard"
    rnd["lastDiscard"] = None
    return True, ""


def apply_pon(rnd, seat_idx, tile):
    seat = seat_at(rnd, seat_idx)
    if seat["hand"].count(tile) < 2:
        return False, "無法碰"
    from_seat = rnd["claim"]["fromSeat"]
    _remove_discard(rnd, from_seat, tile)
    seat["hand"].remove(tile)
    seat["hand"].remove(tile)
    seat["melds"].append({"type": "pon", "tile": tile, "from": from_seat})
    seat["hand"] = sort_tiles(seat["hand"])
    rnd["claim"] = None
    rnd["currentSeat"] = seat_idx
    rnd["phase"] = "discard"
    rnd["lastDiscard"] = None
    return True, ""


def apply_minkong_from_claim(rnd, seat_idx, tile):
    seat = seat_at(rnd, seat_idx)
    if seat["hand"].count(tile) < 3:
        return False, "無法明槓"
    from_seat = rnd["claim"]["fromSeat"]
    _remove_discard(rnd, from_seat, tile)
    for _ in range(3):
        seat["hand"].remove(tile)
    seat["melds"].append({"type": "minkong", "tile": tile, "from": from_seat})
    seat["hand"] = sort_tiles(seat["hand"])
    rnd["claim"] = None
    rnd["currentSeat"] = seat_idx
    rnd["winFlags"] = {"gangShang": True}
    rnd["drawFromTail"] = True
    rnd["phase"] = "draw"
    return True, ""


def apply_ankong(rnd, seat_idx, tile):
    seat = seat_at(rnd, seat_idx)
    if seat["hand"].count(tile) < 4:
        return False, "無法暗槓"
    for _ in range(4):
        seat["hand"].remove(tile)
    seat["melds"].append({"type": "ankong", "tile": tile})
    seat["hand"] = sort_tiles(seat["hand"])
    rnd["winFlags"] = {"gangShang": True}
    rnd["drawFromTail"] = True
    rnd["phase"] = "draw"
    rnd["currentSeat"] = seat_idx
    return True, ""


def start_jiagang(rnd, seat_idx, tile, meld_index):
    seat = seat_at(rnd, seat_idx)
    m = seat["melds"][meld_index]
    if m["type"] != "pon" or m["tile"] != tile:
        return False, "無法加槓"
    if tile not in seat["hand"]:
        return False, "手牌沒有這張牌"
    rnd["robKong"] = {"seat": seat_idx, "tile": tile, "meldIndex": meld_index, "resolved": False}
    rnd["phase"] = "rob_kong"
    return True, ""


def complete_jiagang(rnd):
    rk = rnd["robKong"]
    seat = seat_at(rnd, rk["seat"])
    tile = rk["tile"]
    seat["hand"].remove(tile)
    m = seat["melds"][rk["meldIndex"]]
    m["type"] = "jiagang"
    rnd["robKong"] = None
    rnd["winFlags"] = {"gangShang": True}
    rnd["drawFromTail"] = True
    rnd["phase"] = "draw"
    rnd["currentSeat"] = rk["seat"]


def apply_ron(rnd, seat_idx, tile, qianggang=False):
    rnd["winFlags"] = rnd.get("winFlags") or {}
    if qianggang:
        rnd["winFlags"]["qiangGang"] = True
        rk = rnd.get("robKong")
        rnd["payerSeat"] = rk["seat"] if rk else rnd.get("discardSeat")
    else:
        if len(rnd["wall"]) == 0:
            rnd["winFlags"]["heDi"] = True
        claim = rnd.get("claim")
        rnd["payerSeat"] = claim["fromSeat"] if claim else rnd.get("discardSeat")
    rnd["winnerSeat"] = seat_idx
    rnd["winTile"] = tile
    rnd["winType"] = "qianggang" if qianggang else "ron"
    rnd["claim"] = None
    rnd["robKong"] = None
    rnd["phase"] = "ended"
    return True


def apply_zimo(rnd, seat_idx):
    rnd["winFlags"] = rnd.get("winFlags") or {}
    if not rnd["wall"]:
        rnd["winFlags"]["haiDi"] = True
    rnd["winnerSeat"] = seat_idx
    rnd["winType"] = "zimo"
    rnd["phase"] = "ended"
    return True


def apply_discard(rnd, seat_idx, tile):
    seat = seat_at(rnd, seat_idx)
    if tile not in seat["hand"]:
        return False, "手牌中沒有這張牌"
    seat["hand"].remove(tile)
    seat["discards"].append(tile)
    rnd["discardSeat"] = seat_idx
    rnd["lastDraw"] = None
    rnd["discardCount"] = rnd.get("discardCount", 0) + 1
    if not rnd["wall"] and len(seat["hand"]) == 0:
        pass
    open_claim_window(rnd, tile, seat_idx)
    return True, ""


def apply_pass_claim(rnd, seat_idx):
    if not rnd.get("claim"):
        return
    rnd["claim"]["responses"][seat_idx] = "pass"


def apply_pass_rob_kong(rnd, seat_idx):
    rk = rnd.get("robKong")
    if not rk:
        return
    rk["responses"] = rk.get("responses") or {}
    rk["responses"][seat_idx] = "pass"


def _claim_priority_order(from_seat):
    return [next_seat(from_seat), (from_seat + 2) % 4, (from_seat + 3) % 4]


def resolve_claims(rnd):
    claim = rnd.get("claim")
    if not claim:
        return "none"
    tile, from_seat = claim["tile"], claim["fromSeat"]
    order = _claim_priority_order(from_seat)

    for seat_idx in order:
        resp = claim["responses"].get(seat_idx)
        if resp and resp != "pass" and resp.get("action") == "hu":
            apply_ron(rnd, seat_idx, tile)
            return "win"

    for seat_idx in order:
        resp = claim["responses"].get(seat_idx)
        if resp and resp != "pass":
            if resp.get("action") == "minkong":
                apply_minkong_from_claim(rnd, seat_idx, tile)
                return "kong"
            if resp.get("action") == "pon":
                apply_pon(rnd, seat_idx, tile)
                return "meld"

    chi_seat = next_seat(from_seat)
    resp = claim["responses"].get(chi_seat)
    if resp and resp != "pass" and resp.get("action") == "chi":
        apply_chi(rnd, chi_seat, resp["tiles"])
        return "meld"

    rnd["claim"] = None
    rnd["currentSeat"] = next_seat(from_seat)
    rnd["phase"] = "draw"
    rnd["lastDiscard"] = None
    return "draw"


def resolve_rob_kong(rnd):
    rk = rnd.get("robKong")
    if not rk or rk.get("resolved"):
        return "none"
    order = [i for i in range(4) if i != rk["seat"]]
    for seat_idx in order:
        resp = (rk.get("responses") or {}).get(seat_idx)
        if resp and resp != "pass" and resp.get("action") == "qianggang":
            apply_ron(rnd, seat_idx, rk["tile"], qianggang=True)
            rk["resolved"] = True
            return "win"
    complete_jiagang(rnd)
    return "kong"


def all_claims_passed(rnd):
    claim = rnd.get("claim")
    if not claim:
        return True
    from_seat = claim["fromSeat"]
    for i in range(4):
        if i == from_seat:
            continue
        opts = get_claim_options(rnd, i)
        if not opts:
            continue
        if i not in claim["responses"]:
            return False
    return True


def all_rob_passed(rnd):
    rk = rnd.get("robKong")
    if not rk:
        return True
    for i in range(4):
        if i == rk["seat"]:
            continue
        if get_rob_kong_options(rnd, i) and i not in (rk.get("responses") or {}):
            return False
    return True


def pending_human_seats(rnd):
    pending = []
    if rnd["phase"] == "claim" and rnd.get("claim"):
        for i in range(4):
            seat = seat_at(rnd, i)
            if seat["isAI"]:
                continue
            if get_claim_options(rnd, i) and i not in rnd["claim"]["responses"]:
                pending.append(i)
    elif rnd["phase"] == "rob_kong" and rnd.get("robKong"):
        for i in range(4):
            seat = seat_at(rnd, i)
            if seat["isAI"]:
                continue
            if get_rob_kong_options(rnd, i) and i not in rnd["robKong"].get("responses", {}):
                pending.append(i)
    elif rnd["phase"] == "discard" and rnd["currentSeat"] is not None:
        seat = seat_at(rnd, rnd["currentSeat"])
        if not seat["isAI"]:
            pending.append(rnd["currentSeat"])
    return pending


def ai_auto_respond_claims(rnd):
    claim = rnd.get("claim")
    if not claim:
        return
    from_seat = claim["fromSeat"]
    order = _claim_priority_order(from_seat)
    for seat_idx in order:
        seat = seat_at(rnd, seat_idx)
        if not seat["isAI"]:
            continue
        opts = get_claim_options(rnd, seat_idx)
        if not opts:
            continue
        hu = next((o for o in opts if o["action"] == "hu"), None)
        if hu:
            claim["responses"][seat_idx] = hu
            return
        pon = next((o for o in opts if o["action"] == "pon"), None)
        if pon and random.random() < 0.55:
            claim["responses"][seat_idx] = pon
            return
        claim["responses"][seat_idx] = "pass"
    chi_seat = next_seat(from_seat)
    seat = seat_at(rnd, chi_seat)
    if seat["isAI"]:
        chi_opts = [o for o in get_claim_options(rnd, chi_seat) if o["action"] == "chi"]
        if chi_opts and random.random() < 0.35:
            claim["responses"][chi_seat] = chi_opts[0]
        elif get_claim_options(rnd, chi_seat):
            claim["responses"][chi_seat] = "pass"


def ai_auto_respond_rob_kong(rnd):
    rk = rnd.get("robKong")
    if not rk:
        return
    for i in range(4):
        seat = seat_at(rnd, i)
        if not seat["isAI"] or i == rk["seat"]:
            continue
        opts = get_rob_kong_options(rnd, i)
        if opts:
            rk.setdefault("responses", {})[i] = {"action": "qianggang", "tile": rk["tile"]}
            return
        rk.setdefault("responses", {})[i] = "pass"


def ai_choose_discard(seat):
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


def ai_take_self_action(rnd, seat_idx):
    acts = get_self_actions(rnd, seat_idx)
    zimo = next((a for a in acts if a["action"] == "zimo"), None)
    if zimo:
        return zimo
    ank = next((a for a in acts if a["action"] == "ankong"), None)
    if ank and random.random() < 0.15:
        return ank
    return None


# ── 台數計算（台灣 16 張，牌型只取最高組合）──────────────────

ALL_WIN_TILES = [f"{s}{i}" for s in SUITS_NUM for i in range(1, 10)] + list(HONORS)


def _hand_stats(hand, melds, extra=None):
    tiles = all_tiles_for_win(hand, melds, extra)
    suits = {t[0] for t in tiles if t[0] in SUITS_NUM}
    honors = [t for t in tiles if t.startswith("Z")]
    nums = [t for t in tiles if t[0] in SUITS_NUM]
    only_honors = len(nums) == 0 and len(honors) > 0
    one_suit_honor = len(suits) == 1 and bool(honors)
    one_suit = len(suits) == 1 and not honors
    return {
        "tiles": tiles,
        "only_honors": only_honors,
        "one_suit": one_suit,
        "one_suit_honor": one_suit_honor,
    }


def _can_form_triplets_only(counts):
    if not counts:
        return True
    first = min(counts.keys(), key=tile_sort_key)
    if counts[first] >= 3:
        c = counts.copy()
        c[first] -= 3
        if c[first] == 0:
            del c[first]
        if _can_form_triplets_only(c):
            return True
    return False


def _is_all_triplets(hand, melds, extra=None):
    if any(m["type"] == "chi" for m in melds):
        return False
    tiles = list(hand)
    if extra:
        tiles.append(extra)
    for m in melds:
        if m["type"] in ("pon", "minkong", "jiagong", "ankong"):
            n = 3 if m["type"] == "pon" else 4
            tiles.extend([m["tile"]] * n)
    counts = Counter(tiles)
    for pair in list(counts.keys()):
        if counts[pair] >= 2:
            c = counts.copy()
            c[pair] -= 2
            if c[pair] == 0:
                del c[pair]
            if _can_form_triplets_only(c):
                return True
    return False


def _count_concealed_pungs(hand, melds):
    """手牌暗刻 + 暗槓（不含碰、明槓）。"""
    n = sum(1 for m in melds if m["type"] == "ankong")
    counts = Counter(hand)
    for t, c in counts.items():
        if c >= 3:
            n += 1
    return n


def _dragon_wind_patterns(hand, melds, extra):
    tiles = all_tiles_for_win(hand, melds, extra)
    c = Counter(tiles)
    d_trips = sum(1 for t in DRAGONS if c[t] >= 3)
    w_trips = sum(1 for t in WINDS if c[t] >= 3)
    d_pairs = sum(1 for t in DRAGONS if c[t] == 2)
    w_pairs = sum(1 for t in WINDS if c[t] == 2)
    patterns = []
    if d_trips == 3:
        patterns.append((8, "大三元"))
    elif d_trips == 2 and d_pairs == 1:
        patterns.append((4, "小三元"))
    if w_trips == 4:
        patterns.append((16, "大四喜"))
    elif w_trips == 3 and w_pairs == 1:
        patterns.append((8, "小四喜"))
    return patterns


def _waiting_tiles(hand, melds):
    waits = []
    for t in ALL_WIN_TILES:
        if can_win(hand, melds, t):
            waits.append(t)
    return waits


def _wait_shape_name(hand, melds, extra):
    """邊張、中洞、單吊（各 1 台）。"""
    if not extra:
        return None
    h = list(hand)
    if extra in h:
        h.remove(extra)
    waits = _waiting_tiles(h, melds)
    if len(waits) != 1:
        return None
    w = waits[0]
    if w[0] not in SUITS_NUM:
        return None
    if h.count(w) == 1:
        return "單吊"
    suit, n = w[0], int(w[1])
    if n == 3 and f"{suit}1" in h and f"{suit}2" in h:
        return "邊張"
    if n == 7 and f"{suit}8" in h and f"{suit}9" in h:
        return "邊張"
    if 2 <= n <= 8 and f"{suit}{n - 1}" in h and f"{suit}{n + 1}" in h:
        return "中洞"
    return None


def _is_quanqiuren(hand, melds, is_ron):
    if not is_ron or not melds:
        return False
    if len(hand) != 1:
        return False
    return all(m["type"] in ("chi", "pon", "minkong", "jiagong") for m in melds)


def _is_banqiuren(hand, melds, is_zimo):
    """半求人：全副明牌、自摸最後一張。"""
    if not is_zimo or len(melds) < 4:
        return False
    if any(m["type"] in ("ankong",) for m in melds):
        return False
    if not all(m["type"] in ("chi", "pon", "minkong", "jiagang") for m in melds):
        return False
    return len(hand) == 2


def _is_pinghu(hand, melds, extra, flowers, is_zimo):
    """平胡 2 台：全順子、無字牌、無花、非自摸、非單吊。"""
    if is_zimo or flowers:
        return False
    if any(m["type"] in ("pon", "minkong", "ankong", "jiagong") for m in melds):
        return False
    tiles = all_tiles_for_win(hand, melds, extra)
    if any(t.startswith("Z") for t in tiles):
        return False
    if not can_win(hand, melds, extra) or _is_all_triplets(hand, melds, extra):
        return False
    h = list(hand)
    if extra and extra in h:
        h.remove(extra)
    elif extra and extra not in h:
        pass
    else:
        return False
    if _wait_shape_name(hand, melds, extra) == "單吊":
        return False
    return len(_waiting_tiles(h, melds)) >= 1


def _wind_pung_patterns(hand, melds, extra, seat_idx, round_wind):
    tiles = all_tiles_for_win(hand, melds, extra)
    c = Counter(tiles)
    patterns = []
    round_tile = f"Z{round_wind + 1}"
    seat_tile = f"Z{seat_idx + 1}"
    if c[round_tile] >= 3:
        patterns.append((1, f"圈風{WIND_NAMES[round_wind]}"))
    if c[seat_tile] >= 3:
        patterns.append((1, f"門風{WIND_NAMES[seat_idx]}"))
    return patterns


def _pick_best_pattern(patterns):
    if not patterns:
        return None
    return max(patterns, key=lambda x: x[0])


def calc_tai(seat, rnd, win_type="zimo", extra_tile=None):
    """
    台灣麻將 16 張計台。
    牌型類（清一色、碰碰胡、三元喜等）只取最高一項；胡牌狀況類可疊加。
    """
    items = []
    tai = 0
    flags = rnd.get("winFlags") or {}
    is_zimo = win_type == "zimo"
    is_ron = win_type in ("ron", "qianggang")
    menqing = is_menqing(seat["melds"])
    hand, melds = seat["hand"], seat["melds"]
    dealer = rnd["dealer"]
    dc = rnd.get("discardCount", 0)
    round_wind = rnd.get("roundWind", 0)

    def add(n, name):
        nonlocal tai
        tai += n
        items.append(f"{name} {n} 台")

    # ── 牌型組合（互斥，只取最高）──
    patterns = []

    if len(seat["flowers"]) >= 8:
        patterns.append((8, "八仙過海"))

    if is_zimo and seat["seatIndex"] == dealer and dc == 0:
        patterns.append((16, "天胡"))
    if is_ron and seat["seatIndex"] != dealer and dc == 1 and rnd.get("discardSeat") == dealer:
        patterns.append((16, "地胡"))

    patterns.extend(_dragon_wind_patterns(hand, melds, extra_tile))

    stats = _hand_stats(hand, melds, extra_tile)
    if stats["only_honors"]:
        patterns.append((16, "字一色"))
    elif stats["one_suit"]:
        patterns.append((8, "清一色"))
    elif stats["one_suit_honor"]:
        patterns.append((4, "湊一色"))

    if _is_all_triplets(hand, melds, extra_tile):
        patterns.append((4, "碰碰胡"))

    concealed = _count_concealed_pungs(hand, melds)
    if concealed >= 5:
        patterns.append((16, "五暗刻"))
    elif concealed >= 4:
        patterns.append((8, "四暗刻"))
    elif concealed >= 3:
        patterns.append((2, "三暗刻"))

    if _is_quanqiuren(hand, melds, is_ron):
        patterns.append((2, "全求人"))
    elif _is_banqiuren(hand, melds, is_zimo):
        patterns.append((2, "半求人"))

    if _is_pinghu(hand, melds, extra_tile, seat["flowers"], is_zimo):
        patterns.append((2, "平胡"))

    best = _pick_best_pattern(patterns)
    if best:
        add(best[0], best[1])

    # ── 胡牌狀況（可疊加）──
    if seat["seatIndex"] == dealer:
        add(1, "莊家")

    streak = rnd.get("dealerStreak", 0)
    if streak > 0 and seat["seatIndex"] == dealer:
        lai = 2 * streak
        add(lai, f"連{streak}拉{streak}")

    if is_zimo:
        if menqing:
            add(3, "門清自摸")
        else:
            add(1, "自摸")
    elif menqing:
        add(1, "門清")

    for wt, wname in _wind_pung_patterns(hand, melds, extra_tile, seat["seatIndex"], round_wind):
        add(wt, wname)

    for f in seat["flowers"]:
        if f in SEAT_FLOWERS.get(seat["seatIndex"], ()):
            add(1, f"花台{TILE_LABELS[f]}")

    wait_name = _wait_shape_name(hand, melds, extra_tile)
    if wait_name:
        add(1, wait_name)

    if flags.get("haiDi") and is_zimo:
        add(1, "海底撈月")
    if flags.get("heDi") and is_ron:
        add(1, "河底撈魚")
    if flags.get("gangShang") and is_zimo:
        add(1, "槓上開花")
    if flags.get("qiangGang"):
        add(1, "搶槓")

    return tai, items


# ── 籌碼與一將（東南西北）────────────────────────────────

CHIP_PER_TAI = 100
CHIP_BASE = 50
ROUND_WIND_NAMES = ("東", "南", "西", "北")


def create_mahjong_session(chip_per_tai=CHIP_PER_TAI, chip_base=CHIP_BASE):
    return {
        "roundWind": 0,
        "dealer": 0,
        "dealerStreak": 0,
        "scores": {},
        "history": [],
        "handCount": 0,
        "chipPerTai": chip_per_tai,
        "chipBase": chip_base,
        "jiangComplete": False,
        "active": True,
    }


def init_session_scores(session, rnd):
    for s in rnd["seats"]:
        session["scores"].setdefault(s["id"], 0)


def _hand_payment_amount(tai, session):
    return tai * session["chipPerTai"] + session["chipBase"]


def calc_hand_payments(rnd, winner_seat_idx, win_info, session):
    """計算本局四家籌碼變動。自摸三家付；放槍／搶槓由放槍者全賠。"""
    if winner_seat_idx is None or not win_info:
        return []
    tai = win_info.get("tai", 0)
    win_type = win_info.get("winType", "zimo")
    amount = _hand_payment_amount(tai, session)
    seats = rnd["seats"]
    deltas = {i: 0 for i in range(4)}

    if win_type == "zimo":
        for i in range(4):
            if i != winner_seat_idx:
                deltas[i] = -amount
        deltas[winner_seat_idx] = amount * 3
        payer_note = "自摸（三家各付）"
    else:
        payer = rnd.get("payerSeat")
        if payer is None or payer == winner_seat_idx:
            payer = rnd.get("discardSeat", 0)
        total = amount * 3
        deltas[payer] = -total
        deltas[winner_seat_idx] = total
        payer_note = "放槍全賠" if win_type == "ron" else "搶槓全賠"

    payments = []
    for i in range(4):
        s = seats[i]
        delta = deltas[i]
        if delta == 0:
            continue
        reason = payer_note if delta > 0 else (
            f"付給{s['name']}" if delta < 0 else ""
        )
        payments.append({
            "seatIndex": i,
            "id": s["id"],
            "name": s["name"],
            "isAI": s["isAI"],
            "delta": delta,
            "reason": reason,
        })
    return payments


def advance_dealer_and_wind(session, rnd, winner):
    """手局結束後推進莊家與圈風。"""
    dealer = rnd["dealer"]
    if winner == "draw":
        session["dealerStreak"] = session.get("dealerStreak", 0) + 1
        session["dealer"] = dealer
        return

    winner_seat = rnd.get("winnerSeat")
    if winner_seat is None:
        return

    if winner_seat == dealer:
        session["dealerStreak"] = session.get("dealerStreak", 0) + 1
        session["dealer"] = dealer
        return

    session["dealerStreak"] = 0
    next_dealer = (dealer + 1) % 4
    if next_dealer == 0:
        session["roundWind"] = session.get("roundWind", 0) + 1
        if session["roundWind"] >= 4:
            session["jiangComplete"] = True
    session["dealer"] = next_dealer


def apply_hand_to_session(session, rnd):
    """結算本局籌碼並更新莊家／圈風。"""
    init_session_scores(session, rnd)
    winner = rnd.get("winner")
    session["handCount"] = session.get("handCount", 0) + 1

    if winner != "draw" and rnd.get("winInfo") and rnd.get("winnerSeat") is not None:
        payments = calc_hand_payments(rnd, rnd["winnerSeat"], rnd["winInfo"], session)
        rnd["winInfo"]["payments"] = payments
        for p in payments:
            session["scores"][p["id"]] = session["scores"].get(p["id"], 0) + p["delta"]
        session["history"].append({
            "handNo": session["handCount"],
            "winner": rnd["winInfo"].get("winnerName"),
            "tai": rnd["winInfo"].get("tai", 0),
            "winType": rnd["winInfo"].get("winType"),
            "payments": payments,
        })
    else:
        session["history"].append({
            "handNo": session["handCount"],
            "winner": "流局",
            "tai": 0,
            "winType": "draw",
            "payments": [],
        })

    advance_dealer_and_wind(session, rnd, winner)
    rnd["roundWind"] = session["roundWind"]


def _session_view(session, rnd, viewer_sid):
    if not session:
        return None
    seats = rnd.get("seats") or []
    score_rows = []
    for s in seats:
        score_rows.append({
            "id": s["id"],
            "name": s["name"],
            "wind": WIND_NAMES[s["seatIndex"]],
            "isAI": s["isAI"],
            "isMe": s["id"] == viewer_sid,
            "score": session["scores"].get(s["id"], 0),
        })
    rw = session.get("roundWind", 0)
    wind_label = f"{ROUND_WIND_NAMES[rw]}風圈" if rw < 4 else "一將打完"
    return {
        "roundWind": rw,
        "roundWindName": wind_label,
        "dealerStreak": session.get("dealerStreak", 0),
        "handCount": session.get("handCount", 0),
        "chipPerTai": session["chipPerTai"],
        "chipBase": session["chipBase"],
        "scores": score_rows,
        "jiangComplete": session.get("jiangComplete", False),
        "canNextHand": not session.get("jiangComplete", False),
    }


def build_settlement(session, human_ids, rnd=None):
    """一將結束或玩家提前結算。"""
    name_map = {}
    if rnd and rnd.get("seats"):
        for s in rnd["seats"]:
            name_map[s["id"]] = s["name"]
    for h in session.get("history", []):
        for p in h.get("payments", []):
            name_map.setdefault(p["id"], p["name"])
    rows = []
    for sid, score in session.get("scores", {}).items():
        rows.append({
            "id": sid,
            "name": name_map.get(sid, "玩家"),
            "score": score,
            "isHuman": sid in human_ids,
        })
    rows.sort(key=lambda r: -r["score"])
    return {
        "scores": rows,
        "history": session.get("history", []),
        "handCount": session.get("handCount", 0),
        "chipPerTai": session.get("chipPerTai", CHIP_PER_TAI),
        "chipBase": session.get("chipBase", CHIP_BASE),
        "jiangComplete": session.get("jiangComplete", False),
        "roundWind": session.get("roundWind", 0),
    }


def build_client_view(rnd, viewer_sid, session=None):
    viewer = seat_by_id(rnd, viewer_sid)
    my_idx = viewer["seatIndex"] if viewer else -1
    claim = rnd.get("claim")
    rob = rnd.get("robKong")

    seats_view = []
    for s in rnd["seats"]:
        is_me = s["id"] == viewer_sid
        seats_view.append({
            "id": s["id"],
            "name": s["name"],
            "wind": WIND_NAMES[s["seatIndex"]],
            "seatIndex": s["seatIndex"],
            "isAI": s["isAI"],
            "isMe": is_me,
            "handCount": len(s["hand"]),
            "flowers": [tile_obj(f) for f in s["flowers"]],
            "discards": [tile_obj(t) for t in s["discards"]],
            "melds": [meld_to_client(m, is_me) for m in s["melds"]],
            "hand": [tile_obj(t) for t in s["hand"]] if is_me else None,
        })

    my_claim_opts = get_claim_options(rnd, my_idx) if my_idx >= 0 else []
    my_rob_opts = get_rob_kong_options(rnd, my_idx) if my_idx >= 0 else []
    my_self = get_self_actions(rnd, my_idx) if my_idx >= 0 else []

    def _fmt_chi(opt):
        return "".join(TILE_LABELS[t] for t in opt["tiles"])

    can_discard = (
        rnd["phase"] == "discard"
        and rnd["currentSeat"] == my_idx
        and not rnd.get("winner")
        and not rob
    )

    return {
        "dealer": rnd["dealer"],
        "dealerWind": WIND_NAMES[rnd["dealer"]],
        "currentSeat": rnd["currentSeat"],
        "currentName": rnd["seats"][rnd["currentSeat"]]["name"] if rnd["currentSeat"] is not None else "",
        "phase": rnd["phase"],
        "wallCount": len(rnd["wall"]),
        "seats": seats_view,
        "mySeat": my_idx,
        "canDiscard": can_discard,
        "canHu": any(a["action"] in ("zimo",) for a in my_self),
        "canRon": any(a["action"] == "hu" for a in my_claim_opts),
        "canPon": any(a["action"] == "pon" for a in my_claim_opts),
        "canChi": [{"tiles": a["tiles"], "label": _fmt_chi(a)} for a in my_claim_opts if a["action"] == "chi"],
        "canMinkong": any(a["action"] == "minkong" for a in my_claim_opts),
        "canAnkong": [{"tile": a["tile"], "label": TILE_LABELS[a["tile"]]} for a in my_self if a["action"] == "ankong"],
        "canJiagang": [
            {"tile": a["tile"], "meldIndex": a["meldIndex"], "label": TILE_LABELS[a["tile"]]}
            for a in my_self if a["action"] == "jiagang"
        ],
        "canQianggang": my_rob_opts,
        "claimTile": tile_obj(claim["tile"]) if claim else None,
        "claimTileId": claim["tile"] if claim else None,
        "robKongTile": tile_obj(rob["tile"]) if rob and not rob.get("resolved") else None,
        "lastDraw": tile_obj(rnd["lastDraw"]) if rnd.get("lastDraw") else None,
        "lastDiscard": tile_obj(rnd["lastDiscard"]) if rnd.get("lastDiscard") else None,
        "discardSeat": rnd.get("discardSeat"),
        "winner": rnd.get("winner"),
        "winInfo": rnd.get("winInfo"),
        "session": _session_view(session, rnd, viewer_sid),
    }


def build_win_info(rnd, seat_idx):
    seat = seat_at(rnd, seat_idx)
    win_type = rnd.get("winType", "zimo")
    extra = rnd.get("winTile")
    tai, tai_items = calc_tai(seat, rnd, win_type, extra)
    return {
        "winnerId": seat["id"],
        "winnerName": seat["name"],
        "winType": win_type,
        "zimo": win_type == "zimo",
        "tai": tai,
        "taiItems": tai_items,
        "hand": [tile_obj(t) for t in sort_tiles(seat["hand"] + ([extra] if extra and extra not in seat["hand"] else []))],
        "flowers": [tile_obj(f) for f in seat["flowers"]],
        "melds": [meld_to_client(m, True) for m in seat["melds"]],
        "message": f"{seat['name']} {('自摸' if win_type == 'zimo' else '胡牌' if win_type == 'ron' else '搶槓')}！共 {tai} 台",
    }


def advance_game(rnd):
    """推進到下一個需要等待的狀態。回傳 'wait' | 'ended' | 'draw'。"""
    if rnd.get("phase") == "ended" or rnd.get("winner"):
        return "ended"

    while True:
        if rnd["phase"] == "claim":
            ai_auto_respond_claims(rnd)
            for i in range(4):
                s = seat_at(rnd, i)
                if s["isAI"] and i not in rnd["claim"].get("responses", {}):
                    opts = get_claim_options(rnd, i)
                    if not opts:
                        rnd["claim"]["responses"][i] = "pass"
            if not all_claims_passed(rnd):
                return "wait"
            result = resolve_claims(rnd)
            if result == "win":
                seat_idx = rnd["winnerSeat"]
                rnd["winner"] = rnd["seats"][seat_idx]["id"]
                rnd["winInfo"] = build_win_info(rnd, seat_idx)
                return "ended"
            if result in ("meld", "kong"):
                if rnd["phase"] == "draw":
                    continue
                s = seat_at(rnd, rnd["currentSeat"])
                if s["isAI"]:
                    act = ai_take_self_action(rnd, rnd["currentSeat"])
                    if act and act["action"] == "zimo":
                        apply_zimo(rnd, rnd["currentSeat"])
                        rnd["winner"] = s["id"]
                        rnd["winInfo"] = build_win_info(rnd, rnd["currentSeat"])
                        return "ended"
                    tile = ai_choose_discard(s)
                    if tile:
                        apply_discard(rnd, rnd["currentSeat"], tile)
                    continue
                return "wait"
            continue

        if rnd["phase"] == "rob_kong":
            ai_auto_respond_rob_kong(rnd)
            rk = rnd["robKong"]
            for i in range(4):
                s = seat_at(rnd, i)
                if s["isAI"] and i != rk["seat"] and i not in rk.get("responses", {}):
                    if get_rob_kong_options(rnd, i):
                        rk.setdefault("responses", {})[i] = "pass"
            if not all_rob_passed(rnd):
                return "wait"
            result = resolve_rob_kong(rnd)
            if result == "win":
                seat_idx = rnd["winnerSeat"]
                rnd["winner"] = rnd["seats"][seat_idx]["id"]
                rnd["winInfo"] = build_win_info(rnd, seat_idx)
                return "ended"
            continue

        if rnd["phase"] == "draw":
            seat_idx = rnd["currentSeat"]
            seat = seat_at(rnd, seat_idx)
            if not rnd["wall"]:
                rnd["winner"] = "draw"
                rnd["winInfo"] = {"message": "流局，牌牆用完了"}
                return "ended"
            tile = draw_from_wall(rnd, seat)
            if not tile:
                rnd["winner"] = "draw"
                rnd["winInfo"] = {"message": "流局"}
                return "ended"
            rnd["phase"] = "discard"
            if can_win(seat["hand"], seat["melds"]):
                if seat["isAI"]:
                    apply_zimo(rnd, seat_idx)
                    rnd["winner"] = seat["id"]
                    rnd["winInfo"] = build_win_info(rnd, seat_idx)
                    return "ended"
                return "wait"
            if seat["isAI"]:
                act = ai_take_self_action(rnd, seat_idx)
                if act and act["action"] == "ankong":
                    apply_ankong(rnd, seat_idx, act["tile"])
                    continue
                tile = ai_choose_discard(seat)
                apply_discard(rnd, seat_idx, tile)
                continue
            return "wait"

        if rnd["phase"] == "discard":
            seat = seat_at(rnd, rnd["currentSeat"])
            if seat["isAI"]:
                act = ai_take_self_action(rnd, rnd["currentSeat"])
                if act and act["action"] == "zimo":
                    apply_zimo(rnd, rnd["currentSeat"])
                    rnd["winner"] = seat["id"]
                    rnd["winInfo"] = build_win_info(rnd, rnd["currentSeat"])
                    return "ended"
                if act and act["action"] == "ankong":
                    apply_ankong(rnd, rnd["currentSeat"], act["tile"])
                    continue
                tile = ai_choose_discard(seat)
                apply_discard(rnd, rnd["currentSeat"], tile)
                continue
            return "wait"

        return "wait"
