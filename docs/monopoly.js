/** 台北新北大富翁 — UI v2 */
let mpView = null;
let mpSocket = null;
let mpPanels = null;
let mpShowPanel = null;
let mpDiceAnimTimer = null;

const MP_COLORS = {
  brown: '#92400e', lightblue: '#38bdf8', pink: '#ec4899', orange: '#f97316',
  red: '#dc2626', yellow: '#eab308', green: '#16a34a', darkblue: '#1d4ed8', premium: '#a855f7',
};
const LEVEL_ICONS = { 1: '🏠', 2: '🏢', 3: '🗼' };

function mp$(id) { return document.getElementById(id); }

function boardLayout(board) {
  const byId = Object.fromEntries(board.map((s) => [s.id, s]));
  return {
    bottom: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => byId[i]),
    right: [11, 12, 13, 14, 15, 16, 17, 18, 19].map((i) => byId[i]),
    top: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((i) => byId[i]).reverse(),
    left: [31, 32, 33, 34, 35, 36, 37, 38, 39].map((i) => byId[i]).reverse(),
  };
}

function buildingDisplay(space, propStates) {
  const ps = propStates[String(space.id)];
  if (!ps || !space.price) return '';
  const lv = ps.level;
  const icon = lv === 3 ? (space.landmark || '🗼') : (LEVEL_ICONS[lv] || '');
  return `<span class="mp-building lv${lv}" title="等級${lv}">${icon}</span>`;
}

function renderCell(space, players, propStates, rot = 0) {
  const occ = players.filter((p) => !p.bankrupt && p.position === space.id);
  const isProp = space.type === 'property';
  const bar = isProp ? `<div class="mp-bar" style="background:${MP_COLORS[space.color] || '#666'}"></div>` : '';
  const price = isProp ? `<span class="mp-price">$${space.price.toLocaleString()}</span>` : '';
  const tax = space.type === 'tax' ? `<span class="mp-price">$${space.tax}</span>` : '';
  const build = isProp ? buildingDisplay(space, propStates) : '';
  const tokens = occ.map((p) =>
    `<span class="mp-token" title="${p.name}">${p.avatar || '🙂'}</span>`,
  ).join('');
  return `<div class="mp-cell ${space.type}" data-rot="${rot}">
    ${bar}
    <div class="mp-cell-body">
      <span class="mp-name">${space.name}</span>
      ${build}${price}${tax}
      <div class="mp-tokens">${tokens}</div>
    </div>
  </div>`;
}

function renderBoard(state) {
  const { bottom, right, top, left } = boardLayout(state.board);
  const ps = state.propertyStates || {};
  const p = state.players;
  const center = mp$('mpDiceStage');
  const diceHtml = center ? center.outerHTML : '';

  mp$('mpBoard').innerHTML = `
    <div class="mp-grid">
      <div class="mp-side mp-top">${top.map((s) => renderCell(s, p, ps, 180)).join('')}</div>
      <div class="mp-middle-row">
        <div class="mp-side mp-left">${left.map((s) => renderCell(s, p, ps, 90)).join('')}</div>
        <div class="mp-center" id="mpDiceStage">
          <div class="mp-center-title">🎲 北北基大富翁</div>
          <div id="mpDiceAnim" class="mp-dice-stage hidden">
            <div class="mp-die-3d rolling">?</div>
            <div class="mp-die-3d rolling">?</div>
          </div>
          <div id="mpDiceResult" class="mp-dice-result hidden"></div>
          <p id="mpCenterMsg" class="mp-center-msg"></p>
        </div>
        <div class="mp-side mp-right">${right.map((s) => renderCell(s, p, ps, -90)).join('')}</div>
      </div>
      <div class="mp-side mp-bottom">${bottom.map((s) => renderCell(s, p, ps, 0)).join('')}</div>
    </div>`;
}

function showDiceAnimation(callback) {
  const anim = mp$('mpDiceAnim');
  const result = mp$('mpDiceResult');
  const msg = mp$('mpCenterMsg');
  if (!anim) { callback(); return; }
  anim.classList.remove('hidden');
  result.classList.add('hidden');
  if (msg) msg.textContent = '骰子轉動中…';
  clearTimeout(mpDiceAnimTimer);
  mpDiceAnimTimer = setTimeout(() => {
    anim.classList.add('hidden');
    callback();
  }, 900);
}

function showDiceResult(dice) {
  const result = mp$('mpDiceResult');
  const msg = mp$('mpCenterMsg');
  if (!result || !dice) return;
  result.classList.remove('hidden');
  result.innerHTML = dice.map((d) => `<span class="mp-die-show">${d}</span>`).join('');
  if (msg) msg.textContent = `共 ${dice[0] + dice[1]} 點`;
}

function renderPlayers(state, myIndex) {
  mp$('mpPlayers').innerHTML = state.players.map((p, i) => {
    const props = Object.entries(state.propertyStates || {})
      .filter(([, ps]) => ps.ownerId === i)
      .map(([id]) => state.board.find((s) => String(s.id) === id)?.name)
      .filter(Boolean);
    return `<div class="mp-player-card ${i === state.currentPlayerIndex ? 'active' : ''} ${p.bankrupt ? 'out' : ''}">
      <span class="mp-avatar-lg">${p.avatar || '🙂'}</span>
      <div><strong>${p.name}${i === myIndex ? '（你）' : ''}</strong>
      <span class="mp-money">$${p.money.toLocaleString()}</span></div>
      <div class="mp-prop-list">${props.map((n) => `<span class="mp-prop-tag">${n}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function renderActions(view) {
  const { state, isMyTurn } = view;
  const cur = state.players[state.currentPlayerIndex];
  const act = state.pendingAction;
  const box = mp$('mpActions');
  mp$('mpMessage').textContent = state.message || '';

  if (state.dice && !state.diceRolling) showDiceResult(state.dice);

  let html = '';
  if (!isMyTurn && state.phase !== 'gameover') {
    html = `<p class="mp-wait">${cur.avatar} 等待 ${cur.name}…</p>`;
  } else if (state.phase === 'gameover' && state.winner) {
    html = `<div class="mp-win">🏆 ${state.winner.avatar} ${state.winner.name} 獲勝！</div>`;
  } else if (isMyTurn) {
    const canRoll = (state.phase === 'rolling' || state.phase === 'jail') && !cur.bankrupt;
    if (canRoll && !act) {
      html += `<button type="button" class="btn btn-primary" id="mpBtnRoll">🎲 擲骰子</button>`;
    }
    if (cur.inJail && state.phase === 'rolling') {
      html += `<button type="button" class="btn btn-secondary" id="mpBtnJail" ${cur.money < 800 ? 'disabled' : ''}>付 $800 保釋</button>`;
    }
    if (act) {
      html += `<p class="mp-pending">${act.message}</p>`;
      const amt = act.amount;
      if (act.kind === 'buy' || act.kind === 'upgrade') {
        html += `<div class="mp-btn-row">
          <button class="btn btn-primary" id="mpBtnBuild" ${cur.money < amt ? 'disabled' : ''}>
            ${act.kind === 'buy' ? '購買' : '升級'} $${amt.toLocaleString()}
          </button>
          <button class="btn btn-secondary" id="mpBtnSkip">放棄</button></div>`;
      } else if (act.kind === 'takeover') {
        html += `<div class="mp-btn-row">
          <button class="btn btn-primary" id="mpBtnTake" ${cur.money < amt ? 'disabled' : ''}>搶購 $${amt.toLocaleString()}</button>
          <button class="btn btn-secondary" id="mpBtnSkip">放棄</button></div>`;
      } else if (act.kind === 'rent' || act.kind === 'tax') {
        html += `<button class="btn btn-primary" id="mpBtnPay">支付 $${amt.toLocaleString()}</button>`;
      } else if (act.kind === 'chance') {
        html += `<button class="btn btn-primary" id="mpBtnChance">翻開機會卡</button>`;
      }
    }
  }

  box.innerHTML = html;
  mp$('mpBtnRoll')?.addEventListener('click', () => {
    showDiceAnimation(() => mpSocket.emit('game:monopoly-roll'));
  });
  mp$('mpBtnJail')?.addEventListener('click', () => mpSocket.emit('game:monopoly-jail-bail'));
  mp$('mpBtnBuild')?.addEventListener('click', () => {
    mpSocket.emit(act.kind === 'buy' ? 'game:monopoly-buy' : 'game:monopoly-upgrade');
  });
  mp$('mpBtnTake')?.addEventListener('click', () => mpSocket.emit('game:monopoly-takeover'));
  mp$('mpBtnSkip')?.addEventListener('click', () => mpSocket.emit('game:monopoly-skip'));
  mp$('mpBtnPay')?.addEventListener('click', () => {
    mpSocket.emit(act.kind === 'rent' ? 'game:monopoly-pay-rent' : 'game:monopoly-pay-tax');
  });
  mp$('mpBtnChance')?.addEventListener('click', () => mpSocket.emit('game:monopoly-chance'));
}

function renderMonopoly(view) {
  mpView = view;
  renderBoard(view.state);
  renderPlayers(view.state, view.myIndex);
  renderActions(view);
}

window.bindMonopoly = function (socket, panels, showPanel) {
  mpSocket = socket;
  mpPanels = panels;
  mpShowPanel = showPanel;
  socket.on('game:monopoly-update', (view) => {
    showPanel(panels.monopolyGame);
    renderMonopoly(view);
  });
  socket.on('game:monopoly-error', ({ message }) => {
    const fb = mp$('mpFeedback');
    if (fb) { fb.textContent = message; fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 3000); }
  });
};

window.FOOD_AVATARS = [
  { emoji: '🍚', name: '滷肉飯' }, { emoji: '🍜', name: '牛肉麵' }, { emoji: '🧋', name: '珍珠奶茶' },
  { emoji: '🥟', name: '小籠包' }, { emoji: '🦪', name: '蚵仔煎' }, { emoji: '🍍', name: '鳳梨酥' },
  { emoji: '🍢', name: '滷味' }, { emoji: '🍗', name: '雞排' }, { emoji: '🍮', name: '豆花' }, { emoji: '🍱', name: '便當' },
];
