/** 台灣麻將完整版 UI */

let mjSelectedTile = null;
let mjState = null;
let mjSocket = null;

function mjEl(id) {
  return document.getElementById(id);
}

function emitAction(action, extra = {}) {
  if (!mjSocket?.connected) return;
  mjSocket.emit('game:mahjong-action', { action, ...extra });
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
      el.innerHTML = `
        <p class="winner">${isMe ? '🎉 你胡牌了！' : `🎉 ${info.winnerName} 胡牌！`}</p>
        <p>${info.message || ''}</p>
        <p>手牌：${(info.hand || []).join(' ')}</p>
        <p>花牌：${(info.flowers || []).join(' ') || '無'}</p>
        <p>面子：${(info.melds || []).join(' · ') || '無'}</p>
        <ul class="mj-tai-list">${taiHtml}</ul>
        <p class="mj-tai-total">共 <strong>${info.tai || 0}</strong> 台</p>
      `;
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

function renderMahjong(state) {
  if (!state) return;

  mjEl('mjWallCount').textContent = state.wallCount ?? 0;
  mjEl('mjDealerWind').textContent = state.dealerWind || '東';

  const inClaim = state.phase === 'claim' && (state.canRon || state.canPon || state.canChi?.length);
  const inRob = state.canQianggang?.length;
  if (inClaim) {
    mjEl('mjTurnStatus').textContent = `有人打 ${state.claimTile || ''}，你要吃碰槓胡嗎？`;
  } else if (inRob) {
    mjEl('mjTurnStatus').textContent = `對手加槓 ${state.robKongTile || ''}，可搶槓胡！`;
  } else if (state.canDiscard || state.canHu) {
    mjEl('mjTurnStatus').textContent = '🎯 輪到你了！';
  } else {
    mjEl('mjTurnStatus').textContent = `⏳ 輪到 ${state.currentName}...`;
  }

  const table = mjEl('mjTable');
  table.innerHTML = '';
  const mySeat = state.mySeat;
  const displayOrder = [(mySeat + 2) % 4, (mySeat + 1) % 4, mySeat, (mySeat + 3) % 4];

  displayOrder.forEach((seatIdx) => {
    const seat = state.seats.find((s) => s.seatIndex === seatIdx);
    if (!seat) return;
    const el = document.createElement('div');
    el.className = `mj-seat mj-seat-${seat.seatIndex}`;
    if (seat.isMe) el.classList.add('mj-me');
    if (state.currentSeat === seat.seatIndex) el.classList.add('mj-active');
    const melds = (seat.melds || []).join(' · ');
    const discards = (seat.discards || []).slice(-10).join(' ');
    el.innerHTML = `
      <div class="mj-seat-head">
        <span class="mj-wind">${seat.wind}</span>
        <span class="mj-name">${seat.name}${seat.isAI ? ' 🤖' : ''}</span>
        <span class="mj-count">${seat.handCount} 張</span>
      </div>
      ${seat.flowers?.length ? `<div class="mj-flowers">花：${seat.flowers.join(' ')}</div>` : ''}
      ${melds ? `<div class="mj-melds">面子：${melds}</div>` : ''}
      <div class="mj-discards">${discards || '（尚無出牌）'}</div>
    `;
    table.appendChild(el);
  });

  const handEl = mjEl('mjHand');
  handEl.innerHTML = '';
  const mySeatData = state.seats.find((s) => s.isMe);
  (mySeatData?.hand || []).forEach((tile) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mj-tile';
    if (mjSelectedTile === tile.id) btn.classList.add('selected');
    btn.textContent = tile.label;
    btn.disabled = !state.canDiscard;
    btn.addEventListener('click', () => {
      if (!state.canDiscard) return;
      mjSelectedTile = tile.id;
      renderMahjong(state);
    });
    handEl.appendChild(btn);
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
      btn.textContent = `吃 ${opt.label}`;
      btn.addEventListener('click', () => emitAction('chi', { tiles: opt.tiles }));
      chiEl.appendChild(btn);
    });
  } else {
    chiEl.classList.add('hidden');
  }

  if (state.lastDraw && (state.canDiscard || state.canHu)) {
    mjEl('mjLastDraw').textContent = `剛摸到：${state.lastDraw}`;
    mjEl('mjLastDraw').classList.remove('hidden');
  } else if (state.lastDiscard && inClaim) {
    mjEl('mjLastDraw').textContent = `打出的牌：${state.lastDiscard}`;
    mjEl('mjLastDraw').classList.remove('hidden');
  } else {
    mjEl('mjLastDraw').classList.add('hidden');
  }
}

window.bindMahjong = bindMahjong;
