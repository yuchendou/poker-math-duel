/** 台灣大富翁 — 雙人連線 UI */
let mpView = null;
let mpSocket = null;
let mpPanels = null;
let mpShowPanel = null;

const MP_COLOR_MAP = {
  brown: '#92400e',
  lightblue: '#38bdf8',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#dc2626',
  yellow: '#eab308',
  green: '#16a34a',
  darkblue: '#1d4ed8',
};

function mp$(id) {
  return document.getElementById(id);
}

function renderMonopolyBoard(state, colorMap) {
  const board = state.board;
  const players = state.players;
  const bottom = board.slice(0, 7);
  const right = board.slice(7, 14);
  const top = board.slice(14, 21).reverse();
  const left = board.slice(21, 28).reverse();

  function cell(space, rot = 0) {
    const occ = players.filter((p) => !p.bankrupt && p.position === space.id);
    const isProp = space.type === 'property';
    const colorBar = isProp
      ? `<div class="mp-color" style="background:${(colorMap || MP_COLOR_MAP)[space.color]}"></div>`
      : '';
    const price = isProp ? `<span class="mp-price">$${space.price}</span>` : '';
    const tax = space.type === 'tax' ? `<span class="mp-price">$${space.tax}</span>` : '';
    const tokens = occ
      .map((p) => `<span class="mp-token" style="background:${p.color}" title="${p.name}"></span>`)
      .join('');
    return `<div class="mp-cell" style="transform:rotate(${rot}deg)">
      ${colorBar}
      <div class="mp-cell-inner" style="transform:rotate(${-rot}deg)">
        <span class="mp-name">${space.name}</span>${price}${tax}
        <div class="mp-tokens">${tokens}</div>
      </div>
    </div>`;
  }

  const rows = [];
  rows.push(`<div class="mp-row mp-top">${top.map((s) => cell(s, 180)).join('')}</div>`);
  rows.push(`<div class="mp-mid">
    <div class="mp-col">${left.map((s) => cell(s, 90)).join('')}</div>
    <div class="mp-center"><div class="mp-logo">🎲<br>大富翁</div></div>
    <div class="mp-col">${right.map((s) => cell(s, -90)).join('')}</div>
  </div>`);
  rows.push(`<div class="mp-row mp-bottom">${bottom.map((s) => cell(s, 0)).join('')}</div>`);
  mp$('mpBoard').innerHTML = rows.join('');
}

function renderMonopolyPlayers(state, myIndex) {
  mp$('mpPlayers').innerHTML = state.players
    .map(
      (p, i) => `
    <div class="mp-player-card ${i === state.currentPlayerIndex ? 'active' : ''} ${p.bankrupt ? 'out' : ''}">
      <span class="mp-player-dot" style="background:${p.color}"></span>
      <strong>${p.name}${i === myIndex ? '（你）' : ''}</strong>
      <span class="mp-money">$${p.money.toLocaleString()}</span>
      <div class="mp-props">${(p.properties || [])
        .map((id) => {
          const s = state.board.find((x) => x.id === id);
          return s ? `<span class="mp-prop" style="background:${MP_COLOR_MAP[s.color]}">${s.name}</span>` : '';
        })
        .join('')}</div>
    </div>`,
    )
    .join('');
}

function renderMonopolyActions(view) {
  const state = view.state;
  const current = state.players[state.currentPlayerIndex];
  const pending = state.pendingAction;
  const actions = mp$('mpActions');
  const diceEl = mp$('mpDice');
  const msgEl = mp$('mpMessage');

  msgEl.textContent = state.message || '';

  if (state.dice) {
    diceEl.innerHTML = state.dice
      .map((d) => `<span class="mp-die">${d}</span>`)
      .join('');
    diceEl.classList.remove('hidden');
  } else {
    diceEl.classList.add('hidden');
  }

  let html = '';
  if (!view.isMyTurn && state.phase !== 'gameover') {
    html = `<p class="mp-wait">等待 ${current.name} 行動…</p>`;
  } else if (state.phase === 'gameover' && state.winner) {
    html = `<div class="mp-win">🏆 ${state.winner.name} 獲勝！</div>`;
  } else if (view.isMyTurn) {
    const canRoll = (state.phase === 'rolling' || state.phase === 'jail') && !current.bankrupt;
    if (canRoll && !pending) {
      html += `<button type="button" class="btn btn-primary" id="mpBtnRoll">🎲 擲骰子</button>`;
    }
    if (current.inJail && state.phase === 'rolling') {
      html += `<button type="button" class="btn btn-secondary" id="mpBtnJail" ${current.money < 500 ? 'disabled' : ''}>支付 $500 保釋金出獄</button>`;
    }
    if (pending) {
      html += `<p class="mp-pending">${pending.message}</p>`;
      if (pending.kind === 'buy') {
        html += `<div class="mp-btn-row">
          <button type="button" class="btn btn-primary" id="mpBtnBuy" ${current.money < pending.amount ? 'disabled' : ''}>購買 $${pending.amount}</button>
          <button type="button" class="btn btn-secondary" id="mpBtnSkip">放棄</button>
        </div>`;
      } else if (pending.kind === 'rent') {
        html += `<button type="button" class="btn btn-primary" id="mpBtnRent">支付租金 $${pending.amount}</button>`;
      } else if (pending.kind === 'tax') {
        html += `<button type="button" class="btn btn-primary" id="mpBtnTax">繳稅 $${pending.amount}</button>`;
      } else if (pending.kind === 'chance') {
        html += `<button type="button" class="btn btn-primary" id="mpBtnChance">翻開機會卡</button>`;
      }
    }
  }

  actions.innerHTML = html;
  mp$('mpBtnRoll')?.addEventListener('click', () => mpSocket.emit('game:monopoly-roll'));
  mp$('mpBtnJail')?.addEventListener('click', () => mpSocket.emit('game:monopoly-jail-bail'));
  mp$('mpBtnBuy')?.addEventListener('click', () => mpSocket.emit('game:monopoly-buy'));
  mp$('mpBtnSkip')?.addEventListener('click', () => mpSocket.emit('game:monopoly-skip'));
  mp$('mpBtnRent')?.addEventListener('click', () => mpSocket.emit('game:monopoly-pay-rent'));
  mp$('mpBtnTax')?.addEventListener('click', () => mpSocket.emit('game:monopoly-pay-tax'));
  mp$('mpBtnChance')?.addEventListener('click', () => mpSocket.emit('game:monopoly-chance'));
}

function renderMonopoly(view) {
  mpView = view;
  renderMonopolyBoard(view.state, view.colorMap);
  renderMonopolyPlayers(view.state, view.myIndex);
  renderMonopolyActions(view);
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
    if (fb) {
      fb.textContent = message;
      fb.classList.remove('hidden');
      setTimeout(() => fb.classList.add('hidden'), 3000);
    }
  });
};
