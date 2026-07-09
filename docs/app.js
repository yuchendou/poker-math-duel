function getServerUrl() {
  const configured = window.GAME_CONFIG?.SERVER_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return window.location.origin;
  }
  return null;
}

const serverUrl = getServerUrl();
const $ = (id) => document.getElementById(id);

const lobby = $('lobby');
const waiting = $('waiting');
const game = $('game');

let socket = null;
let myId = null;
let roomState = null;
let isHost = false;

function showSetupBanner() {
  $('setupBanner').classList.remove('hidden');
  $('btnCreate').disabled = true;
  $('btnJoin').disabled = true;
}

function updateServerStatus(text, ok) {
  const el = $('serverStatus');
  el.textContent = text;
  el.classList.remove('hidden', 'ok', 'error');
  el.classList.add(ok ? 'ok' : 'error');
}

function initSocket() {
  if (!serverUrl) {
    showSetupBanner();
    return;
  }

  updateServerStatus(`正在連線到伺服器 ${serverUrl} ...`, true);

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => {
    myId = socket.id;
    updateServerStatus('✅ 已連上遊戲伺服器，可以開始了', true);
  });

  socket.on('disconnect', () => {
    updateServerStatus('⚠️ 與伺服器斷線，正在重新連線...', false);
  });

  socket.on('connect_error', () => {
    updateServerStatus('❌ 無法連上伺服器，請確認後端已部署且 config.js 網址正確', false);
  });

  bindSocketEvents();
}

function bindSocketEvents() {
  socket.on('room:created', ({ code }) => {
    showPanel(waiting);
    $('displayCode').textContent = code;
    $('roomCode').value = code;
  });

  socket.on('room:joined', () => {
    showPanel(waiting);
  });

  socket.on('room:update', (state) => {
    if (state.gameState === 'waiting' || state.gameState === 'round-end') {
      showPanel(waiting);
      updateWaitingUI(state);
    }
    if (state.gameState === 'playing' || state.gameState === 'round-end') {
      updateScores(state);
    }
  });

  socket.on('room:both-connected', ({ message }) => {
    $('connectionMessage').textContent = `✅ ${message}`;
    $('connectionMessage').classList.add('ready');
  });

  socket.on('room:player-left', ({ message }) => {
    $('connectionMessage').textContent = `⚠️ ${message}`;
    $('connectionMessage').classList.remove('ready');
    showPanel(waiting);
  });

  socket.on('game:new-round', ({ cards, target }) => {
    showPanel(game);
    $('targetNumber').textContent = target;
    renderCards(cards);
    $('expression').value = '';
    $('expression').disabled = false;
    $('btnSubmit').disabled = false;
    $('answerFeedback').classList.add('hidden');
    $('roundResult').classList.add('hidden');
    $('btnNextRound').classList.add('hidden');
    $('expression').focus();
  });

  socket.on('game:result', ({ correct, message }) => {
    const fb = $('answerFeedback');
    fb.classList.remove('hidden', 'success', 'error');
    if (correct) {
      fb.classList.add('success');
      fb.textContent = message;
    } else {
      fb.classList.add('error');
      fb.textContent = message;
    }
  });

  socket.on('game:round-won', ({ winnerName, expression, result, target, scores }) => {
    $('expression').disabled = true;
    $('btnSubmit').disabled = true;

    const resultEl = $('roundResult');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <p class="winner">🏆 ${winnerName} 搶答成功！</p>
      <p>算式：${expression} = ${result}（目標 ${target}）</p>
    `;

    if (roomState) {
      roomState.scores = scores;
      updateScores(roomState);
    }

    if (isHost) {
      $('btnNextRound').classList.remove('hidden');
    }
  });

  socket.on('error', ({ message }) => {
    if (!waiting.classList.contains('hidden')) {
      $('connectionMessage').textContent = `❌ ${message}`;
    } else {
      showError(message);
    }
  });
}

function showPanel(panel) {
  [lobby, waiting, game].forEach((p) => p.classList.add('hidden'));
  panel.classList.remove('hidden');
}

function showError(msg) {
  const el = $('lobbyError');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function requireSocket() {
  if (!socket?.connected) {
    showError('尚未連上伺服器，請稍後再試');
    return false;
  }
  return true;
}

$('btnCreate').addEventListener('click', () => {
  if (!requireSocket()) return;
  const name = $('playerName').value.trim() || '玩家';
  socket.emit('room:create', { name });
});

$('btnJoin').addEventListener('click', () => {
  if (!requireSocket()) return;
  const name = $('playerName').value.trim() || '玩家';
  const code = $('roomCode').value.trim().toUpperCase();
  if (!code) {
    showError('請輸入房間代碼');
    return;
  }
  socket.emit('room:join', { code, name });
});

$('roomCode').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

$('btnCopy').addEventListener('click', () => {
  const code = $('displayCode').textContent;
  navigator.clipboard.writeText(code).then(() => {
    $('btnCopy').textContent = '已複製！';
    setTimeout(() => { $('btnCopy').textContent = '複製代碼'; }, 2000);
  });
});

function updateWaitingUI(state) {
  roomState = state;
  isHost = state.players.find((p) => p.id === myId)?.isHost ?? false;

  $('displayCode').textContent = state.code;

  const slots = [$('slot1'), $('slot2')];
  state.players.forEach((player, i) => {
    const slot = slots[i];
    slot.querySelector('.player-name').textContent = player.name;
    slot.querySelector('.status-dot').className = 'status-dot online';
    slot.classList.add('connected');
  });

  for (let i = state.players.length; i < 2; i++) {
    const slot = slots[i];
    slot.querySelector('.player-name').textContent = '等待中...';
    slot.querySelector('.status-dot').className = 'status-dot offline';
    slot.classList.remove('connected');
  }

  const msg = $('connectionMessage');
  if (state.isFull) {
    msg.textContent = '✅ 兩位玩家已連線！';
    msg.classList.add('ready');
  } else {
    msg.textContent = '等待另一位玩家加入...';
    msg.classList.remove('ready');
  }

  const startBtn = $('btnStart');
  const hostHint = $('hostHint');
  if (isHost) {
    hostHint.classList.remove('hidden');
    startBtn.classList.remove('hidden');
    startBtn.disabled = !state.isFull;
  } else {
    hostHint.classList.add('hidden');
    startBtn.classList.add('hidden');
  }
}

function renderCards(cards) {
  const row = $('cardsRow');
  row.innerHTML = '';
  cards.forEach((card) => {
    const el = document.createElement('div');
    el.className = `card ${card.isRed ? 'red' : 'black'}`;
    el.innerHTML = `
      <span class="card-rank">${card.rank}</span>
      <span class="card-suit">${card.suit}</span>
      <span class="card-value">= ${card.value}</span>
    `;
    row.appendChild(el);
  });
}

function updateScores(state) {
  const players = state.players;
  if (players[0]) {
    $('score1').textContent = `${players[0].name}: ${state.scores[players[0].id] || 0}`;
  }
  if (players[1]) {
    $('score2').textContent = `${players[1].name}: ${state.scores[players[1].id] || 0}`;
  }
}

$('btnStart').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:start-round');
});

$('btnNextRound').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:start-round');
});

$('btnSubmit').addEventListener('click', submitAnswer);
$('expression').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

function submitAnswer() {
  if (!requireSocket()) return;
  const expression = $('expression').value.trim();
  if (!expression) return;
  socket.emit('game:submit', { expression });
}

initSocket();
