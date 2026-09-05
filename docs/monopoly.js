/** 台北新北大富翁 — v3 立體建築 + 動畫 */
let mpSocket, mpPanels, mpShowPanel;
let mpPrevPositions = {};
let mpAnimating = false;

const MP_COLORS = {
  brown: '#92400e', lightblue: '#38bdf8', pink: '#ec4899', orange: '#f97316',
  red: '#dc2626', yellow: '#eab308', green: '#16a34a', darkblue: '#1d4ed8', premium: '#a855f7',
};

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

/** CSS 3D 立體建築 */
function building3D(space, level) {
  if (!level || !space.price) return '';
  const color = MP_COLORS[space.color] || '#64748b';
  if (level === 1) {
    return `<div class="b3d b3d-house" style="--bc:${color}">
      <div class="b3d-roof"></div><div class="b3d-body"></div></div>`;
  }
  if (level === 2) {
    return `<div class="b3d b3d-tower" style="--bc:${color}">
      <div class="b3d-t1"></div><div class="b3d-t2"></div><div class="b3d-t3"></div></div>`;
  }
  return `<div class="b3d b3d-landmark" style="--bc:${color}">
    <div class="b3d-spire"></div><div class="b3d-lbase"></div>
    <span class="b3d-label">${(space.landmark || '').slice(0, 4)}</span></div>`;
}

function centerBuilding3D(space, level) {
  const color = MP_COLORS[space?.color] || '#fbbf24';
  if (level === 1) return `<div class="cb3d cb3d-house anim-pop" style="--bc:${color}"><div class="b3d-roof"></div><div class="b3d-body lg"></div></div>`;
  if (level === 2) return `<div class="cb3d cb3d-tower anim-pop" style="--bc:${color}"><div class="b3d-t1 lg"></div><div class="b3d-t2 lg"></div><div class="b3d-t3 lg"></div></div>`;
  return `<div class="cb3d cb3d-landmark anim-pop" style="--bc:${color}"><div class="b3d-spire lg"></div><div class="b3d-lbase lg"></div><p class="cb3d-name">${space?.landmark || '地標'}</p></div>`;
}

function renderCell(space, players, propStates) {
  const ps = propStates[String(space.id)];
  const lv = ps?.level || 0;
  const isProp = space.type === 'property';
  const bar = isProp ? `<div class="mp-bar" style="background:${MP_COLORS[space.color] || '#666'}"></div>` : '';
  const build = isProp ? building3D(space, lv) : '';
  const price = isProp ? `<span class="mp-price">$${space.price.toLocaleString()}</span>` : '';
  const tax = space.type === 'tax' ? `<span class="mp-price">$${space.tax}</span>` : '';
  const tokens = players.filter((p) => !p.bankrupt && p.position === space.id)
    .map((p) => `<span class="mp-token" data-pid="${p.id}">${p.avatar || '🙂'}</span>`).join('');
  return `<div class="mp-cell ${space.type}" data-space-id="${space.id}">
    ${bar}<div class="mp-cell-body"><span class="mp-name">${space.name}</span>${build}${price}${tax}
    <div class="mp-tokens">${tokens}</div></div></div>`;
}

function renderBoard(state, skipCenter) {
  const { bottom, right, top, left } = boardLayout(state.board);
  const ps = state.propertyStates || {};
  const p = state.players;
  const centerContent = skipCenter && mp$('mpCenterStage') ? mp$('mpCenterStage').innerHTML : `
    <div class="mp-center-title">🎲 北北基大富翁</div>
    <div id="mpCenterStage" class="mp-center-stage"></div>
    <p id="mpCenterMsg" class="mp-center-msg"></p>`;

  mp$('mpBoard').innerHTML = `
    <div class="mp-grid">
      <div class="mp-side mp-top">${top.map((s) => renderCell(s, p, ps)).join('')}</div>
      <div class="mp-middle-row">
        <div class="mp-side mp-left">${left.map((s) => renderCell(s, p, ps)).join('')}</div>
        <div class="mp-center">${centerContent}</div>
        <div class="mp-side mp-right">${right.map((s) => renderCell(s, p, ps)).join('')}</div>
      </div>
      <div class="mp-side mp-bottom">${bottom.map((s) => renderCell(s, p, ps)).join('')}</div>
    </div>`;
}

function showCenter(html, msg) {
  const stage = mp$('mpCenterStage');
  const m = mp$('mpCenterMsg');
  if (stage) stage.innerHTML = html;
  if (m) m.textContent = msg || '';
}

function showDiceCenter(values) {
  showCenter(
    `<div class="mp-dice-stage">${values.map((d) => `<div class="mp-die-3d rolling">${d}</div>`).join('')}</div>`,
    '骰子轉動中…',
  );
}

function showDiceResult(values) {
  showCenter(
    `<div class="mp-dice-result">${values.map((d) => `<span class="mp-die-show">${d}</span>`).join('')}</div>`,
    `共 ${values[0] + values[1]} 點`,
  );
}

function showBuildCenter(state, anim) {
  const space = state.board.find((s) => s.id === anim.propertyId) || { name: anim.propertyName, landmark: anim.landmark, color: 'green' };
  showCenter(
    centerBuilding3D(space, anim.level),
    `${space.name} → ${['', '小公寓', '高樓', '地標'][anim.level]}`,
  );
}

function showChanceCenter(text) {
  showCenter(`<div class="mp-chance-card anim-pop"><span>🃏</span><p>${text}</p></div>`, '機會卡');
}

function showRentCenter(amount) {
  showCenter(`<div class="mp-rent-flash anim-pop"><span>💸</span><p>過路費<br>$${amount.toLocaleString()}</p></div>`, '');
}

async function animateMove(state, anim) {
  if (!anim?.path?.length) return;
  const idx = anim.playerIndex;
  const player = state.players[idx];
  mpAnimating = true;
  for (const pos of anim.path) {
    player.position = pos;
    renderBoard(state, true);
    highlightCell(pos);
    await sleep(180);
  }
  player.position = anim.to;
  renderBoard(state, true);
  mpAnimating = false;
}

function highlightCell(pos) {
  document.querySelectorAll('.mp-cell').forEach((c) => c.classList.remove('highlight'));
  document.querySelector(`.mp-cell[data-space-id="${pos}"]`)?.classList.add('highlight');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function renderPlayers(state, myIndex) {
  mp$('mpPlayers').innerHTML = state.players.map((p, i) => {
    const bonus = (window.FOOD_AVATARS || []).find((f) => f.emoji === p.avatar)?.bonus || '';
    const props = Object.entries(state.propertyStates || {}).filter(([, ps]) => ps.ownerId === i)
      .map(([id]) => state.board.find((s) => String(s.id) === id)?.name).filter(Boolean);
    return `<div class="mp-player-card ${i === state.currentPlayerIndex ? 'active' : ''} ${p.bankrupt ? 'out' : ''}">
      <span class="mp-avatar-lg">${p.avatar || '🙂'}</span>
      <div><strong>${p.name}${i === myIndex ? '（你）' : ''}</strong>
      <span class="mp-bonus-tag">${bonus}</span>
      <span class="mp-money">$${p.money.toLocaleString()}</span></div>
      <div class="mp-prop-list">${props.map((n) => `<span class="mp-prop-tag">${n}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function renderActions(view) {
  const { state, isMyTurn } = view;
  const cur = state.players[state.currentPlayerIndex];
  const act = state.pendingAction;
  mp$('mpMessage').textContent = state.message || '';
  let html = '';
  if (!isMyTurn && state.phase !== 'gameover') html = `<p class="mp-wait">${cur.avatar} 等待 ${cur.name}…</p>`;
  else if (state.phase === 'gameover' && state.winner) html = `<div class="mp-win">🏆 ${state.winner.avatar} ${state.winner.name} 獲勝！</div>`;
  else if (isMyTurn) {
    const canRoll = (state.phase === 'rolling' || state.phase === 'jail') && !cur.bankrupt;
    if (canRoll && !act) html += `<button type="button" class="btn btn-primary" id="mpBtnRoll">🎲 擲骰子</button>`;
    if (cur.inJail && state.phase === 'rolling') html += `<button type="button" class="btn btn-secondary" id="mpBtnJail" ${cur.money < 800 ? 'disabled' : ''}>付 $800 保釋</button>`;
    if (act) {
      html += `<p class="mp-pending">${act.message}</p>`;
      if (act.rentPreview) html += `<p class="mp-rent-hint">升級後過路費：$${act.rentPreview.toLocaleString()}</p>`;
      if (act.kind === 'rent' && act.rentLevel) {
        const labels = { 1: '小公寓 ×1', 2: '高樓 ×3', 3: '地標 ×7' };
        html += `<p class="mp-rent-hint">${labels[act.rentLevel] || ''}（三種等級費率不同）</p>`;
      }
      const amt = act.amount;
      if (act.kind === 'buy' || act.kind === 'upgrade') {
        html += `<div class="mp-btn-row"><button class="btn btn-primary" id="mpBtnBuild" ${cur.money < amt ? 'disabled' : ''}>${act.kind === 'buy' ? '🏠 蓋房' : '🏢 升級'} $${amt.toLocaleString()}</button><button class="btn btn-secondary" id="mpBtnSkip">放棄</button></div>`;
      } else if (act.kind === 'rent') {
        html += `<button class="btn btn-primary" id="mpBtnPay">💸 付過路費 $${amt.toLocaleString()}</button>`;
        if (act.takeoverAmount) html += `<button class="btn btn-secondary" id="mpBtnTake" ${cur.money < act.takeoverAmount ? 'disabled' : ''}>⚔️ 搶購 $${act.takeoverAmount.toLocaleString()}</button>`;
      } else if (act.kind === 'tax') html += `<button class="btn btn-primary" id="mpBtnPay">繳稅 $${amt.toLocaleString()}</button>`;
      else if (act.kind === 'chance') html += `<button class="btn btn-primary" id="mpBtnChance">🃏 翻開機會卡</button>`;
    }
  }
  mp$('mpActions').innerHTML = html;
  mp$('mpBtnRoll')?.addEventListener('click', () => {
    showDiceCenter(['?', '?']);
    setTimeout(() => mpSocket.emit('game:monopoly-roll'), 400);
  });
  mp$('mpBtnJail')?.addEventListener('click', () => mpSocket.emit('game:monopoly-jail-bail'));
  mp$('mpBtnBuild')?.addEventListener('click', () => mpSocket.emit(act.kind === 'buy' ? 'game:monopoly-buy' : 'game:monopoly-upgrade'));
  mp$('mpBtnTake')?.addEventListener('click', () => mpSocket.emit('game:monopoly-takeover'));
  mp$('mpBtnSkip')?.addEventListener('click', () => mpSocket.emit('game:monopoly-skip'));
  mp$('mpBtnPay')?.addEventListener('click', () => mpSocket.emit(act.kind === 'rent' ? 'game:monopoly-pay-rent' : 'game:monopoly-pay-tax'));
  mp$('mpBtnChance')?.addEventListener('click', () => mpSocket.emit('game:monopoly-chance'));
}

async function handleUpdate(view) {
  mpShowPanel(mpPanels.monopolyGame);
  const state = view.state;
  const anim = state.centerAnim;

  if (anim?.type === 'dice' && anim.values) {
    showDiceCenter(anim.values.map(() => '?'));
    await sleep(500);
    showDiceResult(anim.values);
  }
  if (anim?.type === 'move' && anim.path?.length && !mpAnimating) {
    await animateMove(state, anim);
  }
  if (anim?.type === 'build') showBuildCenter(state, anim);
  if (anim?.type === 'chance') showChanceCenter(state.lastChanceCard || anim.text || '機會卡');
  if (anim?.type === 'rent') showRentCenter(anim.amount);

  renderBoard(state);
  renderPlayers(state, view.myIndex);
  renderActions(view);
}

window.bindMonopoly = function (socket, panels, showPanel) {
  mpSocket = socket; mpPanels = panels; mpShowPanel = showPanel;
  socket.on('game:monopoly-update', (view) => handleUpdate(view));
  socket.on('game:monopoly-error', ({ message }) => {
    const fb = mp$('mpFeedback');
    if (fb) { fb.textContent = message; fb.classList.remove('hidden'); setTimeout(() => fb.classList.add('hidden'), 3000); }
  });
};

window.FOOD_AVATARS = [
  { emoji: '🍚', name: '滷肉飯', bonus: '經過起點額外 +$800' },
  { emoji: '🍜', name: '牛肉麵', bonus: '升級費用 -12%' },
  { emoji: '🧋', name: '珍珠奶茶', bonus: '機會卡獎金 +25%' },
  { emoji: '🥟', name: '小籠包', bonus: '搶購費用 -10%' },
  { emoji: '🦪', name: '蚵仔煎', bonus: '收到的過路費 +15%' },
  { emoji: '🍍', name: '鳳梨酥', bonus: '被搶購時多收 12%' },
  { emoji: '🍢', name: '滷味', bonus: '稅金 -20%' },
  { emoji: '🍗', name: '雞排', bonus: '首次購地 -8%' },
  { emoji: '🍮', name: '豆花', bonus: '休息區恢復 $500' },
  { emoji: '🍱', name: '便當', bonus: '同色地產加成 +30%' },
];
