/** 台灣麻將（2 人連線 + 2 電腦） */

let mjSelectedTile = null;
let mjState = null;

function $(id) {
  return document.getElementById(id);
}

function bindMahjong(socket, panels, showPanel) {
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

  $('btnMahjongHu').addEventListener('click', () => {
    if (!socket?.connected) return;
    socket.emit('game:mahjong-hu');
  });

  $('btnMahjongDiscard').addEventListener('click', () => {
    if (!socket?.connected || !mjSelectedTile) return;
    socket.emit('game:mahjong-discard', { tileId: mjSelectedTile });
    mjSelectedTile = null;
  });
}

function renderMahjong(state) {
  if (!state) return;

  $('mjWallCount').textContent = state.wallCount ?? 0;
  $('mjDealerWind').textContent = state.dealerWind || '東';
  $('mjTurnStatus').textContent = state.canDiscard || state.canHu
    ? '🎯 輪到你了！'
    : `⏳ 輪到 ${state.currentName}...`;

  const table = $('mjTable');
  table.innerHTML = '';

  const order = [2, 1, 0, 3]; // 上、右、下、左視角（自己在下方 seat 0/1 對應調整）
  const mySeat = state.mySeat;
  const displayOrder = [
    (mySeat + 2) % 4,
    (mySeat + 1) % 4,
    mySeat,
    (mySeat + 3) % 4,
  ];

  displayOrder.forEach((seatIdx) => {
    const seat = state.seats.find((s) => s.seatIndex === seatIdx);
    if (!seat) return;
    const el = document.createElement('div');
    el.className = `mj-seat mj-seat-${seat.seatIndex}`;
    if (seat.isMe) el.classList.add('mj-me');
    if (state.currentSeat === seat.seatIndex) el.classList.add('mj-active');

    const discards = (seat.discards || []).slice(-8).join(' ');
    el.innerHTML = `
      <div class="mj-seat-head">
        <span class="mj-wind">${seat.wind}</span>
        <span class="mj-name">${seat.name}${seat.isAI ? ' 🤖' : ''}</span>
        <span class="mj-count">${seat.handCount} 張</span>
      </div>
      ${seat.flowers?.length ? `<div class="mj-flowers">花：${seat.flowers.join(' ')}</div>` : ''}
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

  if (state.lastDraw && (state.canDiscard || state.canHu)) {
    $('mjLastDraw').textContent = `剛摸到：${state.lastDraw}`;
    $('mjLastDraw').classList.remove('hidden');
  } else {
    $('mjLastDraw').classList.add('hidden');
  }
}

window.bindMahjong = bindMahjong;
