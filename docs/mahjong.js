/** 台灣麻將完整版 UI */

let mjSelectedTile = null;
let mjState = null;
let mjSocket = null;

function $(id) {
  return document.getElementById(id);
}

function emitAction(action, extra = {}) {
  if (!mjSocket?.connected) return;
  mjSocket.emit('game:mahjong-action', { action, ...extra });
}

function bindMahjong(socket, panels, showPanel) {
  mjSocket = socket;

  socket.on('game:mahjong-new-round', (state) => {
    mjState = state;
    mjSelectedTile = null;
    showPanel(panels.mahjongGame);
    $('mjRoundResult').classList.add('hidden');
    $('btnMahjongNext').classList.add('hidden');
    $('mjFeedback').classList.add('hidden');
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
    const el = $('mjRoundResult');
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
    if (window.mahjongIsHost) $('btnMahjongNext').classList.remove('hidden');
  });

  socket.on('game:mahjong-self-win', ({ message }) => {
    const fb = $('mjFeedback');
    fb.classList.remove('hidden', 'error');
    fb.classList.add('success');
    fb.textContent = message;
  });

  socket.on('game:mahjong-error', ({ message }) => {
    const fb = $('mjFeedback');
    fb.classList.remove('hidden', 'success');
    fb.classList.add('error');
    fb.textContent = message;
  });

  $('btnMahjongHu').addEventListener('click', () => emitAction('zimo'));
  $('btnMahjongRon').addEventListener('click', () => emitAction('hu'));
  $('btnMahjongPon').addEventListener('click', () => emitAction('pon'));
  $('btnMahjongMinkong').addEventListener('click', () => emitAction('minkong'));
  $('btnMahjongPass').addEventListener('click', () => emitAction('pass'));
  $('btnMahjongQiang').addEventListener('click', () => emitAction('qianggang'));
  $('btnMahjongAnkong').addEventListener('click', () => {
    const tile = mjState?.canAnkong?.[0]?.tile;
    if (tile) emitAction('ankong', { tileId: tile });
  });
  $('btnMahjongJiagang').addEventListener('click', () => {
    const jg = mjState?.canJiagang?.[0];
    if (jg) emitAction('jiagang', { tileId: jg.tile, meldIndex: jg.meldIndex });
  });
  $('btnMahjongDiscard').addEventListener('click', () => {
    if (!mjSelectedTile) return;
    mjSocket.emit('game:mahjong-discard', { tileId: mjSelectedTile });
    mjSelectedTile = null;
  });
}

function hideClaimActions() {
  ['btnMahjongRon', 'btnMahjongPon', 'btnMahjongMinkong', 'btnMahjongPass',
    'btnMahjongQiang', 'mjChiOptions'].forEach((id) => {
    const el = $(id);
    if (el) el.classList.add('hidden');
  });
}

function renderMahjong(state) {
  if (!state) return;

  $('mjWallCount').textContent = state.wallCount ?? 0;
  $('mjDealerWind').textContent = state.dealerWind || '東';

  const inClaim = state.phase === 'claim' && (state.canRon || state.canPon || state.canChi?.length);
  const inRob = state.canQianggang?.length;
  if (inClaim) {
    $('mjTurnStatus').textContent = `有人打 ${state.claimTile || ''}，你要吃碰槓胡嗎？`;
  } else if (inRob) {
    $('mjTurnStatus').textContent = `對手加槓 ${state.robKongTile || ''}，可搶槓胡！`;
  } else if (state.canDiscard || state.canHu) {
    $('mjTurnStatus').textContent = '🎯 輪到你了！';
  } else {
    $('mjTurnStatus').textContent = `⏳ 輪到 ${state.currentName}...`;
  }

  const table = $('mjTable');
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

  const handEl = $('mjHand');
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

  $('btnMahjongHu').classList.toggle('hidden', !state.canHu);
  $('btnMahjongDiscard').disabled = !state.canDiscard || !mjSelectedTile;

  $('btnMahjongRon').classList.toggle('hidden', !state.canRon);
  $('btnMahjongPon').classList.toggle('hidden', !state.canPon);
  $('btnMahjongMinkong').classList.toggle('hidden', !state.canMinkong);
  $('btnMahjongPass').classList.toggle('hidden', !(inClaim || inRob));
  $('btnMahjongQiang').classList.toggle('hidden', !inRob);
  $('btnMahjongAnkong').classList.toggle('hidden', !(state.canAnkong?.length));
  $('btnMahjongJiagang').classList.toggle('hidden', !(state.canJiagang?.length));

  const chiEl = $('mjChiOptions');
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
    $('mjLastDraw').textContent = `剛摸到：${state.lastDraw}`;
    $('mjLastDraw').classList.remove('hidden');
  } else if (state.lastDiscard && inClaim) {
    $('mjLastDraw').textContent = `打出的牌：${state.lastDiscard}`;
    $('mjLastDraw').classList.remove('hidden');
  } else {
    $('mjLastDraw').classList.add('hidden');
  }
}

window.bindMahjong = bindMahjong;
