/** 台灣麻將完整版 UI — 牌面圖案 + 牌桌佈局 */

let mjSelectedTile = null;
let mjState = null;
let mjSocket = null;
let mjDiscardSeq = 0;
let mjFlyTimer = null;
let mjDiscardQueue = [];
let mjDiscardAnimating = false;
let mjRoundEnded = false;

const WAN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const LABEL_TO_ID = {
  ...Object.fromEntries([...Array(9)].map((_, i) => [`${i + 1}萬`, `M${i + 1}`])),
  ...Object.fromEntries([...Array(9)].map((_, i) => [`${i + 1}筒`, `P${i + 1}`])),
  ...Object.fromEntries([...Array(9)].map((_, i) => [`${i + 1}索`, `S${i + 1}`])),
  東: 'Z1', 南: 'Z2', 西: 'Z3', 北: 'Z4', 中: 'Z5', 發: 'Z6', 白: 'Z7',
  梅: 'F1', 蘭: 'F2', 竹: 'F3', 菊: 'F4', 春: 'F5', 夏: 'F6', 秋: 'F7', 冬: 'F8',
};

const DOT_LAYOUTS = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  7: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2], [1, 1]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

/** 索子牌面：3×3 格定位竹條（與實體麻將類似） */
const BAMBOO_LAYOUTS = {
  2: [[0, 1], [2, 1]],
  3: [[0, 1], [1, 1], [2, 1]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
  7: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 1], [2, 2], [0, 1]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

const FLOWER_ART = {
  F1: { glyph: '梅', hue: '#c2185b' },
  F2: { glyph: '蘭', hue: '#7b1fa2' },
  F3: { glyph: '竹', hue: '#2e7d32' },
  F4: { glyph: '菊', hue: '#f57f17' },
  F5: { glyph: '春', hue: '#43a047' },
  F6: { glyph: '夏', hue: '#e53935' },
  F7: { glyph: '秋', hue: '#fb8c00' },
  F8: { glyph: '冬', hue: '#1e88e5' },
};

function mjEl(id) {
  return document.getElementById(id);
}

function parseTileId(ref) {
  if (!ref) return null;
  if (typeof ref === 'object') {
    if (ref.id && ref.id !== 'back') return ref.id;
    if (ref.label) return LABEL_TO_ID[ref.label] || null;
  }
  if (typeof ref === 'string') {
    if (/^[MPSZ]\d/.test(ref) || /^F\d/.test(ref)) return ref;
    return LABEL_TO_ID[ref] || null;
  }
  return null;
}

function tileLabel(ref) {
  if (!ref) return '';
  if (typeof ref === 'object' && ref.label) return ref.label;
  const id = parseTileId(ref);
  if (!id) return String(ref);
  const n = id.slice(1);
  if (id[0] === 'M') return `${n}萬`;
  if (id[0] === 'P') return `${n}筒`;
  if (id[0] === 'S') return `${n}索`;
  const map = { Z1: '東', Z2: '南', Z3: '西', Z4: '北', Z5: '中', Z6: '發', Z7: '白' };
  return map[id] || FLOWER_ART[id]?.glyph || id;
}

function emitAction(action, extra = {}) {
  if (!mjSocket?.connected) return;
  mjSocket.emit('game:mahjong-action', { action, ...extra });
}

function createDotFace(num) {
  const face = document.createElement('div');
  face.className = 'mj-face mj-face-dots';
  const grid = document.createElement('div');
  grid.className = 'mj-dot-grid';
  (DOT_LAYOUTS[num] || []).forEach(([r, c]) => {
    const dot = document.createElement('span');
    dot.className = 'mj-dot';
    if (num === 1 || num === 5 || num === 7 || num === 9) {
      if (num === 5 && r === 1 && c === 1) dot.classList.add('mj-dot-red');
      else if (num === 1) dot.classList.add('mj-dot-red');
      else if (num === 7 && r === 1 && c === 1) dot.classList.add('mj-dot-red');
    }
    dot.style.setProperty('--r', r);
    dot.style.setProperty('--c', c);
    grid.appendChild(dot);
  });
  face.appendChild(grid);
  return face;
}

function createBambooFace(num) {
  const face = document.createElement('div');
  face.className = 'mj-face mj-face-bamboo';
  if (num === 1) {
    const bird = document.createElement('div');
    bird.className = 'mj-bamboo-bird';
    bird.innerHTML = '<span class="mj-bamboo-stem"></span><span class="mj-bamboo-head"></span>';
    face.appendChild(bird);
    return face;
  }
  const grid = document.createElement('div');
  grid.className = 'mj-bamboo-grid';
  (BAMBOO_LAYOUTS[num] || []).forEach(([r, c]) => {
    const stick = document.createElement('span');
    stick.className = 'mj-bamboo-stick';
    stick.style.setProperty('--r', r);
    stick.style.setProperty('--c', c);
    grid.appendChild(stick);
  });
  face.appendChild(grid);
  return face;
}

function createWanFace(num) {
  const face = document.createElement('div');
  face.className = 'mj-face mj-face-wan';
  const top = document.createElement('span');
  top.className = 'mj-wan-num';
  top.textContent = WAN_NUM[num - 1];
  const bottom = document.createElement('span');
  bottom.className = 'mj-wan-char';
  bottom.textContent = '萬';
  face.append(top, bottom);
  return face;
}

function createHonorFace(id) {
  const face = document.createElement('div');
  const label = tileLabel(id);
  const cls = {
    Z1: 'mj-honor-east',
    Z2: 'mj-honor-south',
    Z3: 'mj-honor-west',
    Z4: 'mj-honor-north',
    Z5: 'mj-honor-red',
    Z6: 'mj-honor-green',
    Z7: 'mj-honor-white',
  }[id];
  face.className = `mj-face mj-face-honor ${cls || ''}`;
  if (id === 'Z7') {
    const frame = document.createElement('span');
    frame.className = 'mj-white-frame';
    face.appendChild(frame);
  } else {
    face.textContent = label;
  }
  return face;
}

function createFlowerFace(id) {
  const art = FLOWER_ART[id] || { glyph: tileLabel(id), hue: '#888' };
  const face = document.createElement('div');
  face.className = 'mj-face mj-face-flower';
  face.style.setProperty('--flower-hue', art.hue);
  face.innerHTML = `<span class="mj-flower-glyph">${art.glyph}</span><span class="mj-flower-deco">❀</span>`;
  return face;
}

function createTileFace(tileId) {
  if (!tileId || tileId === 'back') return null;
  const suit = tileId[0];
  const num = parseInt(tileId.slice(1), 10);
  if (suit === 'P') return createDotFace(num);
  if (suit === 'S') return createBambooFace(num);
  if (suit === 'M') return createWanFace(num);
  if (suit === 'Z') return createHonorFace(tileId);
  if (suit === 'F') return createFlowerFace(tileId);
  return null;
}

function createMjTile(ref, opts = {}) {
  const {
    size = 'md',
    selected = false,
    disabled = false,
    faceDown = false,
    highlight = false,
    onClick = null,
    title = '',
  } = opts;

  const tileId = faceDown ? 'back' : parseTileId(ref);
  const label = faceDown ? '牌背' : tileLabel(ref);

  const el = document.createElement(onClick ? 'button' : 'div');
  if (onClick) el.type = 'button';
  el.className = `mj-tile mj-tile-${size}`;
  if (selected) el.classList.add('selected');
  if (highlight) el.classList.add('highlight');
  if (faceDown) el.classList.add('mj-tile-back');
  if (disabled) {
    el.disabled = true;
    el.classList.add('disabled');
  }
  el.title = title || label;
  el.dataset.tileId = tileId || '';

  const body = document.createElement('div');
  body.className = 'mj-tile-body';
  if (faceDown) {
    body.innerHTML = '<span class="mj-back-pattern"></span>';
  } else {
    const face = createTileFace(tileId);
    if (face) body.appendChild(face);
    else body.textContent = label;
  }
  el.appendChild(body);

  if (onClick) el.addEventListener('click', onClick);
  return el;
}

function appendTileRow(container, tiles, opts = {}) {
  const row = document.createElement('div');
  row.className = 'mj-tile-row';
  (tiles || []).forEach((t) => {
    row.appendChild(createMjTile(t, opts));
  });
  container.appendChild(row);
  return row;
}

function renderMeldGroup(meld) {
  const group = document.createElement('div');
  group.className = 'mj-meld-group';
  const tag = document.createElement('span');
  tag.className = 'mj-meld-tag';
  tag.textContent = meld.kind || '';
  group.appendChild(tag);
  const tiles = document.createElement('div');
  tiles.className = 'mj-tile-row';
  (meld.tiles || []).forEach((t) => {
    tiles.appendChild(createMjTile(t, { size: 'sm', faceDown: !!meld.faceDown }));
  });
  group.appendChild(tiles);
  return group;
}

function getDiscardSeq(state) {
  if (state?.discardCount != null) return state.discardCount;
  return (state.seats || []).reduce((n, s) => n + (s.discards?.length || 0), 0);
}

function playDiscardFlyAnim(evt) {
  const fly = mjEl('mjDiscardFly');
  if (!fly || !evt?.lastDiscard) {
    mjDiscardAnimating = false;
    processDiscardQueue();
    return;
  }

  const seat = (evt.seats || []).find((s) => s.seatIndex === evt.discardSeat);
  const who = seat ? `${seat.wind} ${seat.name}` : '有人';
  const isMe = seat?.isMe;

  fly.innerHTML = '';
  fly.classList.remove('hidden', 'mj-discard-fly-out', 'mj-discard-fly-me');
  if (isMe) fly.classList.add('mj-discard-fly-me');

  const label = document.createElement('div');
  label.className = 'mj-discard-fly-label';
  label.textContent = isMe ? '你打出' : `${who} 打出`;

  const tileWrap = document.createElement('div');
  tileWrap.className = 'mj-discard-fly-tile';
  tileWrap.appendChild(createMjTile(evt.lastDiscard, { size: 'xl', highlight: !isMe }));

  fly.append(label, tileWrap);

  if (mjFlyTimer) clearTimeout(mjFlyTimer);
  requestAnimationFrame(() => fly.classList.add('mj-discard-fly-active'));
  mjFlyTimer = setTimeout(() => {
    fly.classList.remove('mj-discard-fly-active');
    fly.classList.add('mj-discard-fly-out');
    setTimeout(() => {
      fly.classList.add('hidden');
      fly.classList.remove('mj-discard-fly-out', 'mj-discard-fly-me');
      fly.innerHTML = '';
      mjDiscardAnimating = false;
      processDiscardQueue();
    }, 320);
  }, 2200);
}

function processDiscardQueue() {
  if (mjDiscardAnimating || !mjDiscardQueue.length) return;
  mjDiscardAnimating = true;
  const evt = mjDiscardQueue.shift();
  playDiscardFlyAnim(evt);
}

function showDiscardFly(state) {
  if (mjRoundEnded || state?.winner) return;
  if (!state?.lastDiscard) return;
  const count = getDiscardSeq(state);
  if (count <= mjDiscardSeq) return;

  mjDiscardQueue.push({
    lastDiscard: state.lastDiscard,
    discardSeat: state.discardSeat,
    seats: state.seats,
  });
  mjDiscardSeq = count;
  processDiscardQueue();
}

function updateTingBar(state) {
  const bar = mjEl('mjTingBar');
  const hint = mjEl('mjTingHint');
  const waits = mjEl('mjTingWaits');
  const btn = mjEl('btnMahjongTing');
  if (!bar) return;

  if (state.isListening) {
    bar.classList.remove('hidden');
    bar.classList.add('mj-ting-bar-active');
    if (hint) hint.textContent = '🔔 已聽牌 — 只能打不破壞聽口的牌';
    if (waits) {
      const labels = (state.listeningDiscards || []).map(tileLabel).join('、');
      waits.textContent = labels ? `可打：${labels}` : '';
    }
    if (btn) btn.classList.add('hidden');
    return;
  }

  const showDeclare = state.canDeclareTing || (state.isTenpai && state.canDiscard);
  if (showDeclare) {
    bar.classList.remove('hidden', 'mj-ting-bar-active');
    if (hint) hint.textContent = '✨ 可以聽牌了！按下面按鈕宣告（+1 台）';
    if (waits) {
      const waitLabels = (state.waitingTiles || []).map(tileLabel).join('、');
      waits.textContent = waitLabels ? `聽：${waitLabels}` : '';
    }
    if (btn) btn.classList.remove('hidden');
    return;
  }

  bar.classList.add('hidden');
  if (btn) btn.classList.add('hidden');
}

function seatPositionClass(seatIdx, mySeat) {
  const rel = (seatIdx - mySeat + 4) % 4;
  return ['mj-pos-self', 'mj-pos-right', 'mj-pos-top', 'mj-pos-left'][rel];
}

function clearDiscardAnim() {
  mjDiscardQueue = [];
  mjDiscardAnimating = false;
  if (mjFlyTimer) {
    clearTimeout(mjFlyTimer);
    mjFlyTimer = null;
  }
  const fly = mjEl('mjDiscardFly');
  if (fly) {
    fly.classList.add('hidden');
    fly.innerHTML = '';
  }
}

function hideWinOverlay() {
  mjEl('mjWinOverlay')?.classList.add('hidden');
}

function mountHandEndButtonsToOverlay() {
  const actions = mjEl('mjWinOverlayActions');
  const host = mjEl('mjHandEndActionsHost');
  if (!actions || !host) return;
  ['btnMahjongNext', 'btnMahjongSettle'].forEach((id) => {
    const btn = mjEl(id);
    if (btn && btn.parentElement !== actions) actions.appendChild(btn);
  });
}

function restoreHandEndButtons() {
  const host = mjEl('mjHandEndActionsHost');
  if (!host) return;
  ['btnMahjongNext', 'btnMahjongSettle'].forEach((id) => {
    const btn = mjEl(id);
    if (btn && btn.parentElement !== host) host.appendChild(btn);
  });
}
function formatChip(n) {
  if (n > 0) return `+${n}`;
  return String(n);
}

function renderSessionBar(session) {
  const bar = mjEl('mjScoreBar');
  if (!bar) return;
  if (!session) {
    bar.innerHTML = '';
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = (session.scores || []).map((s) => {
    const cls = s.isMe ? 'mj-score-me' : (s.isAI ? 'mj-score-ai' : '');
    const sign = s.score > 0 ? 'pos' : (s.score < 0 ? 'neg' : '');
    return `<span class="mj-score-item ${cls} ${sign}">${s.wind} ${s.name}：${formatChip(s.score)}</span>`;
  }).join('');
}

function renderSeatDraw(view) {
  const panel = mjEl('mjSeatDrawPanel');
  const main = mjEl('mjGameMain');
  if (!panel) return;

  if (!view || view.isDone) {
    panel.classList.add('hidden');
    main?.classList.remove('hidden');
    return;
  }

  panel.classList.remove('hidden');
  main?.classList.add('hidden');

  const tempEl = mjEl('mjTempSeats');
  if (tempEl) {
    tempEl.innerHTML = (view.tempSeats || []).map((s, i) => {
      const labels = ['暫東', '暫南', '暫西', '暫北'];
      const drawn = (view.draws || []).find((d) => d.tempIndex === s.tempIndex);
      const extra = drawn ? ` → <strong>${drawn.label}</strong>` : '';
      const me = s.id === mjSocket?.id ? ' mj-temp-me' : '';
      const active = view.currentDrawer?.tempIndex === s.tempIndex ? ' mj-temp-active' : '';
      return `<div class="mj-temp-seat${me}${active}"><span class="mj-temp-label">${labels[i] || `暫${i + 1}`}</span><span class="mj-temp-name">${s.name}${s.isAI ? ' 🤖' : ''}</span>${extra}</div>`;
    }).join('');
  }

  const diceEl = mjEl('mjDiceArea');
  const rollBtn = mjEl('btnMjRollDice');
  if (diceEl) {
    if (view.dice) {
      diceEl.innerHTML = `
        <div class="mj-dice-row">
          ${view.dice.map((d) => `<span class="mj-die">${d}</span>`).join('')}
          <span class="mj-dice-sum">= ${view.diceTotal} 點</span>
        </div>
        <p class="mj-dice-hint">${view.drawHint || ''}</p>
      `;
      rollBtn?.classList.add('hidden');
    } else {
      diceEl.innerHTML = '<p class="mj-dice-hint">請擲三顆骰子，決定誰先抽方位牌</p>';
      rollBtn?.classList.toggle('hidden', !view.canRollDice);
    }
  }

  const statusEl = mjEl('mjDrawStatus');
  if (statusEl) {
    if (view.phase === 'drawing' && view.currentDrawer) {
      const d = view.currentDrawer;
      statusEl.textContent = d.isMe
        ? '🎯 輪到你了！請選一張蓋著的方位牌'
        : `⏳ 輪到 ${d.name} 抽牌...`;
    } else if (view.phase === 'dice') {
      statusEl.textContent = '步驟 3：擲骰決定抽牌順序';
    } else {
      statusEl.textContent = '';
    }
  }

  const windEl = mjEl('mjWindTiles');
  if (windEl) {
    windEl.innerHTML = '';
    const slots = [0, 1, 2, 3];
    slots.forEach((slot) => {
      const taken = !(view.remainingSlots || []).includes(slot);
      const drawn = (view.draws || []).find((d) => d.slot === slot);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mj-wind-pick';
      btn.disabled = taken || !view.canPick;
      if (taken && drawn) {
        const tile = createMjTile(drawn.wind, { size: 'md' });
        btn.appendChild(tile);
        btn.title = `${drawn.name} 抽到 ${drawn.label}`;
      } else if (taken) {
        btn.innerHTML = '<span class="mj-wind-back"></span>';
        btn.disabled = true;
      } else {
        btn.innerHTML = '<span class="mj-wind-back"></span><span class="mj-wind-pick-label">?</span>';
        if (view.canPick) {
          btn.addEventListener('click', () => {
            if (mjSocket?.connected) mjSocket.emit('game:mahjong-seat-pick', { slot });
          });
        }
      }
      windEl.appendChild(btn);
    });
  }

  const resultEl = mjEl('mjSeatDrawResult');
  if (resultEl && view.draws?.length) {
    resultEl.innerHTML = `
      <p class="mj-seat-draw-result-title">已抽取方位</p>
      <ul>${view.draws.map((d) => `<li>${d.name} → <strong>${d.label}</strong>${d.wind === 'Z1' ? '（莊家）' : ''}</li>`).join('')}</ul>
    `;
  } else if (resultEl) {
    resultEl.innerHTML = '';
  }
}

function renderSessionInfo(session) {
  if (!session) return;
  const rw = mjEl('mjRoundWind');
  const hn = mjEl('mjHandNo');
  const cr = mjEl('mjChipRule');
  if (rw) rw.textContent = session.roundWindName || '東風圈';
  if (hn) hn.textContent = session.handCount ?? 0;
  if (cr) cr.textContent = `台${session.chipPerTai}／底${session.chipBase}`;
  renderSessionBar(session);
}

function showHandEndButtons(session) {
  const nextBtn = mjEl('btnMahjongNext');
  const settleBtn = mjEl('btnMahjongSettle');
  if (settleBtn) settleBtn.classList.remove('hidden');
  if (nextBtn) {
    const canNext = window.mahjongIsHost && session?.canNextHand !== false;
    nextBtn.classList.toggle('hidden', !canNext);
    if (session?.jiangComplete) {
      nextBtn.classList.add('hidden');
    }
  }
}

function renderPaymentHtml(payments, chipPerTai, chipBase, tai) {
  if (!payments?.length) {
    const formula = tai != null ? `（${tai}台×${chipPerTai}+${chipBase}）` : '';
    return `<div class="mj-payment-box mj-payment-empty"><p>本局籌碼結算中${formula}…</p></div>`;
  }
  const lines = payments.map((p) => {
    const cls = p.delta > 0 ? 'mj-pay-win' : 'mj-pay-lose';
    const sign = p.delta > 0 ? '+' : '';
    return `<li class="${cls}"><strong>${p.name}</strong>：${sign}${formatChip(p.delta)} <span class="mj-pay-note">${p.reason || ''}</span></li>`;
  }).join('');
  const perHand = tai != null ? tai * chipPerTai + chipBase : null;
  const formula = perHand != null
    ? `<p class="mj-payment-formula">單家應付／實收基準：<strong>${perHand}</strong> 元（${tai}台×${chipPerTai}+${chipBase}）</p>`
    : '';
  return `
    <div class="mj-payment-box">
      <p class="mj-payment-title">💰 本局籌碼結算</p>
      ${formula}
      <ul class="mj-payment-list">${lines}</ul>
    </div>
  `;
}

function renderMyWinAmount(payments, socketId) {
  const mine = (payments || []).find((p) => p.id === socketId);
  if (!mine) return '';
  const cls = mine.delta > 0 ? 'mj-my-win-pos' : 'mj-my-win-neg';
  const label = mine.delta > 0 ? '你贏了' : '你付了';
  return `<p class="mj-my-win-amount ${cls}">${label} <strong>${formatChip(Math.abs(mine.delta))}</strong></p>`;
}

function renderSettlement(data, socket) {
  const el = mjEl('mjSettlement');
  if (!el) return;
  el.classList.remove('hidden');
  const rows = (data.scores || []).map((r) => {
    const isMe = r.id === socket.id;
    const cls = r.score > 0 ? 'pos' : (r.score < 0 ? 'neg' : '');
    const tag = isMe ? '（你）' : (r.isHuman ? '' : ' 🤖');
    return `<tr class="${cls} ${isMe ? 'mj-settle-me' : ''}"><td>${r.name}${tag}</td><td>${formatChip(r.score)}</td></tr>`;
  }).join('');
  const history = (data.history || []).map((h) => {
    const pay = (h.payments || []).map((p) => `${p.name}${formatChip(p.delta)}`).join('、');
    return `<li>第${h.handNo}局：${h.winner} ${h.tai ? `${h.tai}台` : '流局'} ${pay ? `（${pay}）` : ''}</li>`;
  }).join('');
  el.innerHTML = `
    <h3 class="mj-settle-title">💰 一將結算</h3>
    <p class="mj-settle-meta">共 ${data.handCount} 局 · 台${data.chipPerTai}／底${data.chipBase}${data.jiangComplete ? ' · 東南西北打完' : ' · 提前結束'}</p>
    <table class="mj-settle-table"><thead><tr><th>玩家</th><th>淨收支</th></tr></thead><tbody>${rows}</tbody></table>
    ${history ? `<details class="mj-settle-history"><summary>各局紀錄</summary><ul>${history}</ul></details>` : ''}
    <button type="button" class="btn btn-primary mj-settle-back" id="btnMahjongSettleBack">回大廳</button>
  `;
  mjEl('btnMahjongSettleBack')?.addEventListener('click', () => {
    el.classList.add('hidden');
    if (window.showGameSelect) window.showGameSelect();
  });
}

function bindMahjong(socket, panels, showPanel) {
  mjSocket = socket;

  const bindBtn = (id, handler) => {
    const el = mjEl(id);
    if (el) el.addEventListener('click', handler);
  };

  socket.on('game:mahjong-seat-draw', (view) => {
    showPanel(panels.mahjongGame);
    renderSeatDraw(view);
  });

  socket.on('game:mahjong-new-round', (state) => {
    mjState = state;
    mjRoundEnded = false;
    mjSelectedTile = null;
    mjDiscardSeq = getDiscardSeq(state);
    clearDiscardAnim();
    hideWinOverlay();
    restoreHandEndButtons();
    showPanel(panels.mahjongGame);
    mjEl('mjSeatDrawPanel')?.classList.add('hidden');
    mjEl('mjGameMain')?.classList.remove('hidden');
    mjEl('mjRoundResult').classList.add('hidden');
    mjEl('mjSettlement')?.classList.add('hidden');
    mjEl('btnMahjongNext').classList.add('hidden');
    mjEl('btnMahjongSettle').classList.add('hidden');
    mjEl('mjFeedback').classList.add('hidden');
    renderMahjong(state);
  });

  socket.on('game:mahjong-update', (state) => {
    mjState = state;
    if (mjRoundEnded || state.winner) return;
    renderMahjong(state);
  });

  function showMahjongWinResult(state, socket) {
    mjRoundEnded = true;
    clearDiscardAnim();
    hideClaimActions();

    const info = state.winInfo || {};
    const session = state.session || {};
    const chipPerTai = session.chipPerTai || 100;
    const chipBase = session.chipBase || 50;
    const payHtml = renderPaymentHtml(info.payments, chipPerTai, chipBase, info.tai);
    const myAmountHtml = renderMyWinAmount(info.payments, socket.id);

    const overlay = mjEl('mjWinOverlay');
    const overlayBody = mjEl('mjWinOverlayBody');
    const roundEl = mjEl('mjRoundResult');
    if (!overlay || !overlayBody) return;

    if (state.winner === 'draw') {
      const html = `<p class="winner">流局</p><p>${info.message || ''}</p>${payHtml}`;
      overlayBody.innerHTML = html;
      if (roundEl) {
        roundEl.innerHTML = html;
        roundEl.classList.add('hidden');
      }
    } else {
      const taiHtml = (info.taiItems || []).map((t) => `<li>${t}</li>`).join('');
      const isMe = info.winnerId === socket.id;
      const handRow = document.createElement('div');
      handRow.className = 'mj-win-tiles';
      appendTileRow(handRow, info.hand || [], { size: 'sm' });
      const flowerRow = document.createElement('div');
      flowerRow.className = 'mj-win-tiles';
      appendTileRow(flowerRow, info.flowers || [], { size: 'sm' });
      const meldWrap = document.createElement('div');
      meldWrap.className = 'mj-win-melds';
      (info.melds || []).forEach((m) => {
        if (typeof m === 'string') {
          const legacy = document.createElement('div');
          legacy.className = 'mj-meld-legacy';
          legacy.textContent = m;
          meldWrap.appendChild(legacy);
        } else {
          meldWrap.appendChild(renderMeldGroup(m));
        }
      });

      overlayBody.innerHTML = `
        <p class="winner">${isMe ? '🎉 你胡牌了！' : `🎉 ${info.winnerName} 胡牌！`}</p>
        ${myAmountHtml}
        <p>${info.message || ''}</p>
        <ul class="mj-tai-list">${taiHtml}</ul>
        <p class="mj-tai-total">共 <strong>${info.tai || 0}</strong> 台</p>
        ${payHtml}
      `;
      const labels = overlayBody.querySelectorAll('.mj-win-label');
      if (!labels.length) {
        const detail = document.createElement('details');
        detail.className = 'mj-win-detail';
        detail.innerHTML = '<summary>查看胡牌牌型</summary>';
        detail.append(handRow, flowerRow, meldWrap);
        overlayBody.appendChild(detail);
      }

      if (roundEl) {
        roundEl.innerHTML = overlayBody.innerHTML;
        roundEl.classList.add('hidden');
      }

      if (session.jiangComplete) {
        const note = document.createElement('p');
        note.className = 'mj-jiang-done';
        note.textContent = '🀄 東南西北風已打完！請按「不玩了，結算」。';
        overlayBody.appendChild(note);
      }
    }

    showHandEndButtons(session);
    mountHandEndButtonsToOverlay();
    overlay.classList.remove('hidden');
  }

  socket.on('game:mahjong-win', (state) => {
    mjState = state;
    renderSessionInfo(state.session);
    showMahjongWinResult(state, socket);
  });

  bindBtn('btnMjWinDismiss', () => {
    hideWinOverlay();
    const roundEl = mjEl('mjRoundResult');
    if (roundEl && roundEl.innerHTML.trim()) roundEl.classList.remove('hidden');
    restoreHandEndButtons();
    showHandEndButtons(mjState?.session);
  });

  socket.on('game:mahjong-settled', (data) => {
    hideWinOverlay();
    restoreHandEndButtons();
    mjEl('btnMahjongNext')?.classList.add('hidden');
    mjEl('btnMahjongSettle')?.classList.add('hidden');
    mjEl('mjRoundResult')?.classList.add('hidden');
    renderSettlement(data, socket);
  });

  socket.on('game:mahjong-self-win', ({ message }) => {
    const fb = mjEl('mjFeedback');
    fb.classList.remove('hidden', 'error');
    fb.classList.add('success');
    fb.textContent = message;
  });

  socket.on('game:mahjong-error', ({ message }) => {
    const fb = mjEl('mjFeedback');
    fb.classList.remove('hidden', 'success');
    fb.classList.add('error');
    fb.textContent = message;
  });

  bindBtn('btnMjRollDice', () => {
    if (mjSocket?.connected) mjSocket.emit('game:mahjong-seat-dice');
  });
  bindBtn('btnMahjongTing', () => emitAction('ting'));
  bindBtn('btnMahjongHu', () => emitAction('zimo'));
  bindBtn('btnMahjongRon', () => emitAction('hu'));
  bindBtn('btnMahjongPon', () => emitAction('pon'));
  bindBtn('btnMahjongMinkong', () => emitAction('minkong'));
  bindBtn('btnMahjongPass', () => emitAction('pass'));
  bindBtn('btnMahjongQiang', () => emitAction('qianggang'));
  bindBtn('btnMahjongAnkong', () => {
    const tile = mjState?.canAnkong?.[0]?.tile;
    if (tile) emitAction('ankong', { tileId: tile });
  });
  bindBtn('btnMahjongJiagang', () => {
    const jg = mjState?.canJiagang?.[0];
    if (jg) emitAction('jiagang', { tileId: jg.tile, meldIndex: jg.meldIndex });
  });
  bindBtn('btnMahjongDiscard', () => {
    if (!mjSelectedTile) return;
    mjSocket.emit('game:mahjong-discard', { tileId: mjSelectedTile });
    mjSelectedTile = null;
  });
}

function hideClaimActions() {
  ['btnMahjongRon', 'btnMahjongPon', 'btnMahjongMinkong', 'btnMahjongPass',
    'btnMahjongQiang', 'mjChiOptions'].forEach((id) => {
    const el = mjEl(id);
    if (el) el.classList.add('hidden');
  });
}

function renderCentralDiscards(state, claimTileRef, inClaim) {
  const pool = mjEl('mjDiscardTiles');
  if (!pool) return;
  pool.innerHTML = '';
  const lastDiscardId = parseTileId(state.lastDiscard);
  const discardSeat = state.discardSeat;
  let hasAny = false;

  state.seats.forEach((seat) => {
    (seat.discards || []).forEach((tile, idx) => {
      hasAny = true;
      const isClaimTarget = inClaim
        && lastDiscardId
        && parseTileId(tile) === lastDiscardId
        && idx === seat.discards.length - 1
        && (discardSeat == null || discardSeat === seat.seatIndex);
      const el = createMjTile(tile, {
        size: 'sm',
        highlight: isClaimTarget,
        title: `${seat.wind}家打`,
      });
      el.classList.add(`mj-discard-from-${seat.seatIndex}`);
      pool.appendChild(el);
    });
  });

  if (!hasAny) {
    const empty = document.createElement('span');
    empty.className = 'mj-pool-empty';
    empty.textContent = '尚無出牌';
    pool.appendChild(empty);
  }
}

function renderLastDrawTile(container, ref, prefix) {
  container.innerHTML = '';
  if (!ref) {
    container.classList.add('hidden');
    return;
  }
  const label = tileLabel(ref);
  const text = document.createElement('span');
  text.className = 'mj-last-draw-text';
  text.textContent = `${prefix}${label}`;
  const tile = createMjTile(ref, { size: 'md', highlight: true });
  container.append(text, tile);
  container.classList.remove('hidden');
}

function renderMahjong(state) {
  if (!state) return;
  if (state.winner && mjRoundEnded) return;

  mjEl('mjWallCount').textContent = state.wallCount ?? 0;
  mjEl('mjDealerWind').textContent = state.dealerWind || '東';
  renderSessionInfo(state.session);

  const claimTileRef = state.claimTile || state.claimTileId;
  const inClaim = state.phase === 'claim' && (state.canRon || state.canPon || state.canChi?.length);
  const inRob = state.canQianggang?.length;
  if (inClaim) {
    mjEl('mjTurnStatus').textContent = `有人打牌，你要吃碰槓胡嗎？`;
  } else if (inRob) {
    mjEl('mjTurnStatus').textContent = `對手加槓，可搶槓胡！`;
  } else if (state.canDiscard || state.canHu) {
    mjEl('mjTurnStatus').textContent = '🎯 輪到你了！';
  } else {
    mjEl('mjTurnStatus').textContent = `⏳ 輪到 ${state.currentName}...`;
  }

  const table = mjEl('mjTable');
  table.innerHTML = '';
  const mySeat = state.mySeat;

  state.seats.forEach((seat) => {
    if (seat.isMe) return;
    const pos = seatPositionClass(seat.seatIndex, mySeat);
    const el = document.createElement('div');
    el.className = `mj-seat ${pos}`;
    if (seat.isMe) el.classList.add('mj-me');
    if (state.currentSeat === seat.seatIndex) el.classList.add('mj-active');

    const head = document.createElement('div');
    head.className = 'mj-seat-head';
    head.innerHTML = `
      <span class="mj-wind">${seat.wind}</span>
      <span class="mj-name">${seat.name}${seat.isAI ? ' 🤖' : ''}${seat.listening ? ' <span class="mj-ting-badge">聽</span>' : ''}</span>
      <span class="mj-count">${seat.handCount} 張</span>
    `;
    el.appendChild(head);

    if (seat.flowers?.length) {
      const flowers = document.createElement('div');
      flowers.className = 'mj-flowers';
      const flowerLabel = document.createElement('span');
      flowerLabel.className = 'mj-zone-label';
      flowerLabel.textContent = '花';
      flowers.appendChild(flowerLabel);
      appendTileRow(flowers, seat.flowers, { size: 'xs' });
      el.appendChild(flowers);
    }

    if (seat.melds?.length) {
      const melds = document.createElement('div');
      melds.className = 'mj-melds';
      seat.melds.forEach((m) => {
        if (typeof m === 'string') {
          const legacy = document.createElement('div');
          legacy.className = 'mj-meld-legacy';
          legacy.textContent = m;
          melds.appendChild(legacy);
        } else {
          melds.appendChild(renderMeldGroup(m));
        }
      });
      el.appendChild(melds);
    }

    table.appendChild(el);
  });

  renderCentralDiscards(state, claimTileRef, inClaim);

  const myTable = mjEl('mjMyTable');
  myTable.innerHTML = '';
  const mySeatData = state.seats.find((s) => s.isMe);
  if (mySeatData) {
    if (mySeatData.flowers?.length) {
      const flowers = document.createElement('div');
      flowers.className = 'mj-my-zone';
      flowers.innerHTML = '<span class="mj-zone-label">花牌</span>';
      appendTileRow(flowers, mySeatData.flowers, { size: 'xs' });
      myTable.appendChild(flowers);
    }
    if (mySeatData.melds?.length) {
      const melds = document.createElement('div');
      melds.className = 'mj-my-zone mj-my-melds';
      mySeatData.melds.forEach((m) => {
        if (typeof m === 'string') {
          const legacy = document.createElement('div');
          legacy.className = 'mj-meld-legacy';
          legacy.textContent = m;
          melds.appendChild(legacy);
        } else {
          melds.appendChild(renderMeldGroup(m));
        }
      });
      myTable.appendChild(melds);
    }
  }

  const handEl = mjEl('mjHand');
  handEl.innerHTML = '';
  const safeDiscardIds = new Set(
    (state.isListening ? state.listeningDiscards : []).map((t) => parseTileId(t)),
  );
  (mySeatData?.hand || []).forEach((tile) => {
    const tileId = parseTileId(tile);
    const locked = state.isListening && safeDiscardIds.size > 0 && !safeDiscardIds.has(tileId);
    handEl.appendChild(createMjTile(tile, {
      size: 'lg',
      selected: mjSelectedTile === tileId,
      disabled: !state.canDiscard || locked,
      onClick: () => {
        if (!state.canDiscard || locked) return;
        mjSelectedTile = tileId;
        renderMahjong(state);
      },
    }));
  });

  if (state.isListening && state.canDiscard) {
    mjEl('mjTurnStatus').textContent = '🔔 聽牌中 — 只能打不破壞聽口的牌';
  } else if (state.canDeclareTing || (state.isTenpai && state.canDiscard)) {
    mjEl('mjTurnStatus').textContent = '✨ 你已聽牌，可以按「宣告聽牌」！';
  }

  updateTingBar(state);
  showDiscardFly(state);

  mjEl('btnMahjongHu').classList.toggle('hidden', !state.canHu);
  mjEl('btnMahjongDiscard').disabled = !state.canDiscard || !mjSelectedTile;

  mjEl('btnMahjongRon').classList.toggle('hidden', !state.canRon);
  mjEl('btnMahjongPon').classList.toggle('hidden', !state.canPon);
  mjEl('btnMahjongMinkong').classList.toggle('hidden', !state.canMinkong);
  mjEl('btnMahjongPass').classList.toggle('hidden', !(inClaim || inRob));
  mjEl('btnMahjongQiang').classList.toggle('hidden', !inRob);
  mjEl('btnMahjongAnkong').classList.toggle('hidden', !(state.canAnkong?.length));
  mjEl('btnMahjongJiagang').classList.toggle('hidden', !(state.canJiagang?.length));

  const chiEl = mjEl('mjChiOptions');
  chiEl.innerHTML = '';
  if (state.canChi?.length) {
    chiEl.classList.remove('hidden');
    state.canChi.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-small mj-chi-btn';
      const row = document.createElement('span');
      row.className = 'mj-chi-tiles';
      (opt.tiles || []).forEach((tid) => {
        row.appendChild(createMjTile(tid, { size: 'xs' }));
      });
      btn.appendChild(row);
      btn.appendChild(document.createTextNode(' 吃'));
      btn.addEventListener('click', () => emitAction('chi', { tiles: opt.tiles }));
      chiEl.appendChild(btn);
    });
  } else {
    chiEl.classList.add('hidden');
  }

  const lastDrawEl = mjEl('mjLastDraw');
  if (state.lastDraw && (state.canDiscard || state.canHu)) {
    renderLastDrawTile(lastDrawEl, state.lastDraw, '剛摸到：');
  } else if (state.lastDiscard && inClaim) {
    renderLastDrawTile(lastDrawEl, state.lastDiscard, '打出的牌：');
  } else if (inRob && state.robKongTile) {
    renderLastDrawTile(lastDrawEl, state.robKongTile, '加槓牌：');
  } else {
    lastDrawEl.classList.add('hidden');
    lastDrawEl.innerHTML = '';
  }
}

window.bindMahjong = bindMahjong;
