/** 台灣麻將完整版 UI — 牌面圖案 + 牌桌佈局 */

let mjSelectedTile = null;
let mjState = null;
let mjSocket = null;

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

function seatPositionClass(seatIdx, mySeat) {
  const rel = (seatIdx - mySeat + 4) % 4;
  return ['mj-pos-self', 'mj-pos-right', 'mj-pos-top', 'mj-pos-left'][rel];
}

function bindMahjong(socket, panels, showPanel) {
  mjSocket = socket;

  const bindBtn = (id, handler) => {
    const el = mjEl(id);
    if (el) el.addEventListener('click', handler);
  };

  socket.on('game:mahjong-new-round', (state) => {
    mjState = state;
    mjSelectedTile = null;
    showPanel(panels.mahjongGame);
    mjEl('mjRoundResult').classList.add('hidden');
    mjEl('btnMahjongNext').classList.add('hidden');
    mjEl('mjFeedback').classList.add('hidden');
    renderMahjong(state);
  });

  socket.on('game:mahjong-update', (state) => {
    mjState = state;
    renderMahjong(state);
  });

  socket.on('game:mahjong-win', (state) => {
    mjState = state;
    renderMahjong(state);
    hideClaimActions();
    const info = state.winInfo || {};
    const el = mjEl('mjRoundResult');
    el.classList.remove('hidden');
    if (state.winner === 'draw') {
      el.innerHTML = `<p>${info.message || '流局'}</p>`;
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

      el.innerHTML = `
        <p class="winner">${isMe ? '🎉 你胡牌了！' : `🎉 ${info.winnerName} 胡牌！`}</p>
        <p>${info.message || ''}</p>
        <p class="mj-win-label">手牌</p>
        <p class="mj-win-label">花牌</p>
        <p class="mj-win-label">面子</p>
        <ul class="mj-tai-list">${taiHtml}</ul>
        <p class="mj-tai-total">共 <strong>${info.tai || 0}</strong> 台</p>
      `;
      const labels = el.querySelectorAll('.mj-win-label');
      labels[0]?.insertAdjacentElement('afterend', handRow);
      labels[1]?.insertAdjacentElement('afterend', flowerRow);
      labels[2]?.insertAdjacentElement('afterend', meldWrap);
    }
    if (window.mahjongIsHost) mjEl('btnMahjongNext').classList.remove('hidden');
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
        size: 'xs',
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

  mjEl('mjWallCount').textContent = state.wallCount ?? 0;
  mjEl('mjDealerWind').textContent = state.dealerWind || '東';

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
      <span class="mj-name">${seat.name}${seat.isAI ? ' 🤖' : ''}</span>
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
  (mySeatData?.hand || []).forEach((tile) => {
    const tileId = parseTileId(tile);
    handEl.appendChild(createMjTile(tile, {
      size: 'lg',
      selected: mjSelectedTile === tileId,
      disabled: !state.canDiscard,
      onClick: () => {
        if (!state.canDiscard) return;
        mjSelectedTile = tileId;
        renderMahjong(state);
      },
    }));
  });

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
