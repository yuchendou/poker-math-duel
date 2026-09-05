/** 台北新北大富翁 — v4 浮動棋子、逆時針棋盤、業主標記 */
let mpSocket, mpPanels, mpShowPanel;
let mpLastPositions = {};
let mpAnimating = false;
let mpMoveGen = 0;
let mpPositionsInit = false;

const MP_COLORS = {
  brown: '#92400e', lightblue: '#38bdf8', pink: '#ec4899', orange: '#f97316',
  red: '#dc2626', yellow: '#eab308', green: '#16a34a', darkblue: '#1d4ed8', premium: '#a855f7',
};
const PLAYER_TINTS = ['#f87171', '#60a5fa', '#4ade80', '#c084fc'];

function mp$(id) { return document.getElementById(id); }

/** 右下出發，逆時針：pos 0→1→2… 對應 board 陣列索引 */
function boardRing(board) {
  const cell = (pos) => ({ space: board[pos], pos });
  return {
    bottom: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(cell),
    left: [11, 12, 13, 14, 15, 16, 17, 18, 19].map(cell),
    top: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map(cell),
    right: [31, 32, 33, 34, 35, 36, 37, 38, 39].map(cell),
  };
}

function ownerTint(ownerId) {
  return PLAYER_TINTS[ownerId % PLAYER_TINTS.length];
}

function building3D(space, level, ownerId, players) {
  if (!level || !space.price) return '';
  const color = MP_COLORS[space.color] || '#64748b';
  const tint = ownerId != null ? ownerTint(ownerId) : '#64748b';
  const owner = players?.[ownerId];
  const badge = owner ? `<span class="iso-owner" style="--ot:${tint}">${owner.avatar}</span>` : '';
  const tag = level === 3 ? `<span class="iso-tag">${(space.landmark || space.name || '').slice(0, 3)}</span>` : '';
  const spire = level === 3 ? '<div class="iso-spire"></div>' : '';
  const roof = level === 1 ? '<div class="iso-roof"></div>' : '';
  const floors = level === 2 ? 2 : level === 3 ? 3 : 1;
  const blocks = Array.from({ length: floors }, (_, i) =>
    `<div class="iso-block" style="--lift:${i * 10}px"><div class="iso-top"></div><div class="iso-left"></div><div class="iso-right"></div></div>`,
  ).join('');
  return `<div class="iso-build lv${level} owner-p${ownerId}" style="--bc:${color};--owner:${tint}">${badge}${roof}${spire}<div class="iso-scene">${blocks}</div>${tag}</div>`;
}

function centerBuilding3D(space, level, ownerId, players) {
  const color = MP_COLORS[space?.color] || '#fbbf24';
  const tint = ownerId != null ? ownerTint(ownerId) : color;
  const owner = players?.[ownerId];
  const badge = owner ? `<span class="iso-owner lg">${owner.avatar} ${owner.name}</span>` : '';
  const tag = level === 3 ? `<p class="cb3d-name">${space?.landmark || '地標'}</p>` : '';
  const spire = level === 3 ? '<div class="iso-spire lg"></div>' : '';
  const roof = level === 1 ? '<div class="iso-roof lg"></div>' : '';
  const floors = level === 2 ? 2 : level === 3 ? 3 : 1;
  const blocks = Array.from({ length: floors }, (_, i) =>
    `<div class="iso-block lg" style="--lift:${i * 22}px"><div class="iso-top"></div><div class="iso-left"></div><div class="iso-right"></div></div>`,
  ).join('');
  return `<div class="cb3d iso-build lv${level} anim-pop" style="--bc:${color};--owner:${tint}">${badge}${roof}${spire}<div class="iso-scene lg">${blocks}</div>${tag}</div>`;
}

function renderCell(cell, players, propStates, hideTokenFor, gridRow, gridCol) {
  const { space, pos } = cell;
  const ps = propStates[String(space.id)];
  const lv = ps?.level || 0;
  const ownerId = ps?.ownerId;
  const isProp = space.type === 'property';
  const isStart = pos === 0;
  const bar = isProp ? `<div class="mp-bar" style="background:${MP_COLORS[space.color] || '#666'}"></div>` : '';
  const build = isProp && lv ? building3D(space, lv, ownerId, players) : '';
  const price = isProp ? `<span class="mp-price">$${space.price.toLocaleString()}</span>` : '';
  const taxHint = space.type === 'tax' ? `<span class="mp-tax-hint">${space.taxKind === 'luxury' ? '💎' : '🏛️'}</span>` : '';
  const tokens = players.filter((p) => !p.bankrupt && p.position === pos && p.id !== hideTokenFor)
    .map((p) => `<span class="mp-token" data-pid="${p.id}" style="--pt:${ownerTint(p.id)}">${p.avatar || '🙂'}</span>`).join('');
  const ownerAttr = ownerId != null ? ` style="--owner:${ownerTint(ownerId)};grid-row:${gridRow};grid-column:${gridCol}"` : ` style="grid-row:${gridRow};grid-column:${gridCol}"`;
  return `<div class="mp-cell ${space.type}${isStart ? ' mp-start' : ''}${ownerId != null ? ` owned-by-p${ownerId}` : ''}" data-space-id="${pos}"${ownerAttr}>
    ${bar}<div class="mp-cell-body"><span class="mp-name">${space.name}</span>${build}${price}${taxHint}
    <div class="mp-tokens">${tokens}</div></div></div>`;
}

function renderBoard(state, skipCenter, hideTokenFor) {
  const ring = boardRing(state.board);
  const ps = state.propertyStates || {};
  const p = state.players;
  const centerContent = skipCenter && mp$('mpCenterStage') ? mp$('mpCenterStage').innerHTML : `
    <div class="mp-center-title">🎲 北北基</div>
    <div id="mpCenterStage" class="mp-center-stage"></div>
    <p id="mpCenterMsg" class="mp-center-msg"></p>`;

  const grid = Array.from({ length: 11 }, () => Array(11).fill(null));
  ring.top.forEach((c, i) => { grid[0][i] = c; });
  ring.bottom.forEach((c, i) => { grid[10][i] = c; });
  ring.left.forEach((c, i) => { grid[i + 1][0] = c; });
  ring.right.forEach((c, i) => { grid[i + 1][10] = c; });

  let html = '<div class="mp-grid">';
  for (let r = 0; r < 11; r++) {
    for (let c = 0; c < 11; c++) {
      if (r >= 1 && r <= 9 && c >= 1 && c <= 9) {
        if (r === 1 && c === 1) html += `<div class="mp-center">${centerContent}</div>`;
        continue;
      }
      const cell = grid[r][c];
      if (cell) html += renderCell(cell, p, ps, hideTokenFor, r + 1, c + 1);
    }
  }
  html += '</div>';
  mp$('mpBoard').innerHTML = html;
}

function buildMovePath(from, to) {
  const path = [];
  if (from === to) return path;
  let pos = from;
  while (pos !== to) {
    pos = (pos + 1) % 40;
    path.push(pos);
  }
  return path;
}

function getCellCenter(spaceId) {
  const cell = document.querySelector(`.mp-cell[data-space-id="${spaceId}"]`);
  const board = mp$('mpBoard');
  if (!cell || !board) return null;
  const cr = cell.getBoundingClientRect();
  const br = board.getBoundingClientRect();
  return { x: cr.left + cr.width / 2 - br.left, y: cr.top + cr.height / 2 - br.top };
}

function ensureFloater() {
  let floater = mp$('mpTokenFloater');
  if (!floater) {
    floater = document.createElement('div');
    floater.id = 'mpTokenFloater';
    floater.className = 'mp-token-floater';
    mp$('mpBoard').style.position = 'relative';
    mp$('mpBoard').appendChild(floater);
  }
  return floater;
}

async function animateTokenMove(state, playerIndex, from, to) {
  const path = buildMovePath(from, to);
  if (!path.length) return;
  const player = state.players[playerIndex];
  const gen = ++mpMoveGen;
  mpAnimating = true;

  renderBoard(state, true, playerIndex);
  await sleep(50);

  const floater = ensureFloater();
  floater.textContent = player.avatar || '🙂';
  floater.style.setProperty('--pt', ownerTint(playerIndex));
  floater.classList.add('moving');
  floater.style.display = 'grid';

  const steps = [from, ...path];
  for (let i = 0; i < steps.length; i++) {
    if (gen !== mpMoveGen) break;
    const pos = steps[i];
    highlightCell(pos);
    const pt = getCellCenter(pos);
    if (pt) {
      floater.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%) scale(${i === steps.length - 1 ? 1.15 : 1})`;
    }
    await sleep(i === 0 ? 120 : 400);
  }

  await sleep(200);
  floater.classList.remove('moving');
  floater.style.display = 'none';
  document.querySelectorAll('.mp-cell').forEach((c) => c.classList.remove('highlight'));
  mpAnimating = false;
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
  const ps = state.propertyStates?.[String(anim.propertyId)];
  const ownerId = ps?.ownerId ?? state.currentPlayerIndex;
  showCenter(
    centerBuilding3D(space, anim.level, ownerId, state.players),
    `${space.name} → ${['', '小公寓', '高樓', '地標'][anim.level]}`,
  );
}

function showChanceCenter(text) {
  showCenter(`<div class="mp-chance-card anim-pop"><span>🃏</span><p>${text}</p></div>`, '機會卡');
}

function showRentCenter(amount) {
  showCenter(`<div class="mp-rent-flash anim-pop"><span>💸</span><p>過路費<br>$${amount.toLocaleString()}</p></div>`, '');
}

function showTaxCenter(text, amount) {
  showCenter(`<div class="mp-tax-flash anim-pop"><span>🏛️</span><p>${text}<br>$${amount.toLocaleString()}</p></div>`, '稅務事件');
}

function highlightCell(pos) {
  document.querySelectorAll('.mp-cell').forEach((c) => c.classList.remove('highlight'));
  document.querySelector(`.mp-cell[data-space-id="${pos}"]`)?.classList.add('highlight');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function renderPlayers(state, myIndex) {
  mp$('mpPlayers').innerHTML = state.players.map((p, i) => {
    const bonus = (window.FOOD_AVATARS || []).find((f) => f.emoji === p.avatar)?.bonus || '';
    const tint = ownerTint(i);
    const props = Object.entries(state.propertyStates || {}).filter(([, ps]) => ps.ownerId === i)
      .map(([id]) => state.board.find((s) => String(s.id) === id)?.name).filter(Boolean);
    return `<div class="mp-player-card ${i === state.currentPlayerIndex ? 'active' : ''} ${p.bankrupt ? 'out' : ''}" style="--pt:${tint}">
      <span class="mp-avatar-lg">${p.avatar || '🙂'}</span>
      <div><strong>${p.name}${i === myIndex ? '（你）' : ''}</strong>
      <span class="mp-bonus-tag">${bonus}</span>
      <span class="mp-money">$${p.money.toLocaleString()}</span></div>
      <div class="mp-prop-list">${props.map((n) => `<span class="mp-prop-tag" style="border-color:${tint}">${n}</span>`).join('')}</div>
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
      } else if (act.kind === 'tax_land') {
        html += `<div class="mp-btn-row"><button class="btn btn-primary" id="mpBtnTaxFull">📋 全額申報 $${amt.toLocaleString()}</button><button class="btn btn-secondary" id="mpBtnTaxGamble">🎲 抽稽查（半價或加碼）</button></div>`;
      } else if (act.kind === 'tax_luxury') {
        html += `<div class="mp-btn-row"><button class="btn btn-primary" id="mpBtnTaxPay">💳 老實繳 $${act.payAmount.toLocaleString()}</button><button class="btn btn-secondary" id="mpBtnTaxSpin">🎡 奢侈轉盤</button></div>`;
      } else if (act.kind === 'tax') {
        html += `<button class="btn btn-primary" id="mpBtnPay">繳稅 $${amt.toLocaleString()}</button>`;
      } else if (act.kind === 'chance') {
        html += `<button class="btn btn-primary" id="mpBtnChance">🃏 翻開機會卡</button>`;
      }
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
  mp$('mpBtnTaxFull')?.addEventListener('click', () => mpSocket.emit('game:monopoly-tax-choice', { choice: 'full' }));
  mp$('mpBtnTaxGamble')?.addEventListener('click', () => mpSocket.emit('game:monopoly-tax-choice', { choice: 'gamble' }));
  mp$('mpBtnTaxPay')?.addEventListener('click', () => mpSocket.emit('game:monopoly-tax-choice', { choice: 'pay' }));
  mp$('mpBtnTaxSpin')?.addEventListener('click', () => mpSocket.emit('game:monopoly-tax-choice', { choice: 'spin' }));
  mp$('mpBtnChance')?.addEventListener('click', () => mpSocket.emit('game:monopoly-chance'));
}

async function handleUpdate(view) {
  mpShowPanel(mpPanels.monopolyGame);
  const state = view.state;
  const anim = state.centerAnim;

  if (!mpPositionsInit) {
    state.players.forEach((p, i) => { if (!p.bankrupt) mpLastPositions[i] = p.position; });
    mpPositionsInit = true;
    renderBoard(state);
    renderPlayers(state, view.myIndex);
    renderActions(view);
    return;
  }

  const movers = [];
  state.players.forEach((p, i) => {
    if (p.bankrupt) return;
    const prev = mpLastPositions[i];
    if (prev !== undefined && prev !== p.position) movers.push({ i, from: prev, to: p.position });
  });

  if (movers.length && !mpAnimating) {
    renderBoard(state, true, movers[0].i);
    for (const m of movers) {
      await animateTokenMove(state, m.i, m.from, m.to);
    }
  } else {
    renderBoard(state);
  }

  state.players.forEach((p, i) => { if (!p.bankrupt) mpLastPositions[i] = p.position; });

  renderPlayers(state, view.myIndex);
  renderActions(view);

  if (anim?.type === 'dice' && anim.values) {
    showDiceCenter(anim.values.map(() => '?'));
    await sleep(650);
    showDiceResult(anim.values);
  } else if (anim?.type === 'build') {
    showBuildCenter(state, anim);
  } else if (anim?.type === 'chance') {
    showChanceCenter(state.lastChanceCard || anim.text || '機會卡');
  } else if (anim?.type === 'rent') {
    showRentCenter(anim.amount);
  } else if (anim?.type === 'tax') {
    showTaxCenter(anim.text || '稅務', anim.amount || 0);
  }
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
  { emoji: '🍢', name: '滷味', bonus: '稅務事件 -20%（地價稅／奢侈稅）' },
  { emoji: '🍗', name: '雞排', bonus: '首次購地 -8%' },
  { emoji: '🍮', name: '豆花', bonus: '休息區恢復 $500' },
  { emoji: '🍱', name: '便當', bonus: '同色地產加成 +30%' },
];
