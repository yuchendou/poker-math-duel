function getServerUrl() {
  const configured = window.GAME_CONFIG?.SERVER_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (window.location.hostname.includes('github.io')) return null;
  return window.location.origin;
}

const GAME_INFO = {
  poker: { label: '撲克數學', icon: '🃏', startText: '翻牌出題' },
  sudoku: { label: '雙人數獨', icon: '🔢', startText: '開始數獨' },
};

const serverUrl = getServerUrl();
const $ = (id) => document.getElementById(id);

const panels = {
  gameSelect: $('gameSelect'),
  lobby: $('lobby'),
  waiting: $('waiting'),
  pokerGame: $('pokerGame'),
  sudokuGame: $('sudokuGame'),
};

let socket = null;
let myId = null;
let roomState = null;
let isHost = false;
let selectedGame = null;
let sudokuPuzzle = null;
let sudokuGrid = null;
let sudokuSelected = null;

function showPanel(panel) {
  Object.values(panels).forEach((p) => p.classList.add('hidden'));
  panel.classList.remove('hidden');
}

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

function selectGame(gameType) {
  selectedGame = gameType;
  const info = GAME_INFO[gameType];
  $('selectedGameBadge').textContent = info.label;
  $('mainSubtitle').textContent = `正在玩：${info.label}`;
  showPanel(panels.lobby);
}

document.querySelectorAll('.game-card').forEach((btn) => {
  btn.addEventListener('click', () => selectGame(btn.dataset.game));
});

$('btnBackToSelect').addEventListener('click', () => {
  selectedGame = null;
  $('mainSubtitle').textContent = '選一個遊戲，跟朋友連線對戰！';
  showPanel(panels.gameSelect);
});

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
    updateServerStatus('❌ 無法連上伺服器', false);
  });

  bindSocketEvents();
}

function bindSocketEvents() {
  socket.on('room:created', ({ code }) => {
    showPanel(panels.waiting);
    $('displayCode').textContent = code;
    $('roomCode').value = code;
  });

  socket.on('room:joined', () => showPanel(panels.waiting));

  socket.on('room:update', (state) => {
    roomState = state;
    if (state.gameState === 'waiting' || state.gameState === 'round-end') {
      showPanel(panels.waiting);
      updateWaitingUI(state);
    }
  });

  socket.on('room:both-connected', ({ message }) => {
    $('connectionMessage').textContent = `✅ ${message}`;
    $('connectionMessage').classList.add('ready');
  });

  socket.on('room:player-left', ({ message }) => {
    $('connectionMessage').textContent = `⚠️ ${message}`;
    $('connectionMessage').classList.remove('ready');
    showPanel(panels.waiting);
  });

  socket.on('game:poker-new-round', ({ cards, target }) => {
    showPanel(panels.pokerGame);
    $('targetNumber').textContent = target;
    renderCards(cards);
    $('expression').value = '';
    $('expression').disabled = false;
    $('btnPokerSubmit').disabled = false;
    $('pokerFeedback').classList.add('hidden');
    $('pokerRoundResult').classList.add('hidden');
    $('btnPokerNext').classList.add('hidden');
    $('expression').focus();
  });

  socket.on('game:poker-result', ({ message }) => {
    const fb = $('pokerFeedback');
    fb.classList.remove('hidden', 'success', 'error');
    fb.classList.add('error');
    fb.textContent = message;
  });

  socket.on('game:poker-won', ({ winnerName, expression, result, target }) => {
    $('expression').disabled = true;
    $('btnPokerSubmit').disabled = true;
    const el = $('pokerRoundResult');
    el.classList.remove('hidden');
    el.innerHTML = `
      <p class="winner">🎉 ${winnerName} 答對了！</p>
      <p>算式：${expression} = ${result}（目標 ${target}）</p>
    `;
    if (isHost) $('btnPokerNext').classList.remove('hidden');
  });

  socket.on('game:sudoku-new-round', ({ puzzle }) => {
    showPanel(panels.sudokuGame);
    initSudoku(puzzle);
    $('sudokuFeedback').classList.add('hidden');
    $('sudokuRoundResult').classList.add('hidden');
    $('btnSudokuNext').classList.add('hidden');
    $('btnSudokuSubmit').disabled = false;
  });

  socket.on('game:sudoku-result', ({ message }) => {
    const fb = $('sudokuFeedback');
    fb.classList.remove('hidden', 'success', 'error');
    fb.classList.add('error');
    fb.textContent = message;
  });

  socket.on('game:sudoku-won', ({ winnerName }) => {
    $('btnSudokuSubmit').disabled = true;
    const el = $('sudokuRoundResult');
    el.classList.remove('hidden');
    el.innerHTML = `<p class="winner">🎉 ${winnerName} 先完成了！</p>`;
    if (isHost) $('btnSudokuNext').classList.remove('hidden');
  });

  socket.on('error', ({ message }) => {
    if (!panels.waiting.classList.contains('hidden')) {
      $('connectionMessage').textContent = `❌ ${message}`;
    } else {
      showError(message);
    }
  });
}

$('btnCreate').addEventListener('click', () => {
  if (!requireSocket() || !selectedGame) return;
  socket.emit('room:create', {
    name: $('playerName').value.trim() || '玩家',
    gameType: selectedGame,
  });
});

$('btnJoin').addEventListener('click', () => {
  if (!requireSocket() || !selectedGame) return;
  const code = $('roomCode').value.trim().toUpperCase();
  if (!code) {
    showError('請輸入房間代碼');
    return;
  }
  socket.emit('room:join', {
    name: $('playerName').value.trim() || '玩家',
    code,
    gameType: selectedGame,
  });
});

$('roomCode').addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

$('btnCopy').addEventListener('click', () => {
  navigator.clipboard.writeText($('displayCode').textContent).then(() => {
    $('btnCopy').textContent = '已複製！';
    setTimeout(() => { $('btnCopy').textContent = '複製代碼'; }, 2000);
  });
});

function updateWaitingUI(state) {
  isHost = state.players.find((p) => p.id === myId)?.isHost ?? false;
  $('displayCode').textContent = state.code;
  $('displayGameLabel').textContent = state.gameLabel || GAME_INFO[state.gameType]?.label || '';

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
  const info = GAME_INFO[state.gameType] || GAME_INFO.poker;
  startBtn.textContent = info.startText;

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

function initSudoku(puzzle) {
  sudokuPuzzle = puzzle;
  sudokuGrid = puzzle.map((row) => row.map((v) => v));
  sudokuSelected = null;
  renderSudokuBoard();
  renderSudokuNumpad();
}

function renderSudokuBoard() {
  const board = $('sudokuBoard');
  board.innerHTML = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      const isGiven = sudokuPuzzle[r][c] !== 0;
      const val = sudokuGrid[r][c];
      cell.className = 'sudoku-cell';
      if (isGiven) cell.classList.add('given');
      if (sudokuSelected && sudokuSelected[0] === r && sudokuSelected[1] === c) {
        cell.classList.add('selected');
      }
      if ((r + 1) % 3 === 0 && r < 8) cell.classList.add('border-bottom');
      if ((c + 1) % 3 === 0 && c < 8) cell.classList.add('border-right');
      cell.textContent = val === 0 ? '' : val;
      cell.disabled = isGiven;
      cell.addEventListener('click', () => {
        if (isGiven) return;
        sudokuSelected = [r, c];
        renderSudokuBoard();
      });
      board.appendChild(cell);
    }
  }
}

function renderSudokuNumpad() {
  const pad = $('sudokuNumpad');
  pad.innerHTML = '';
  for (let n = 1; n <= 9; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'numpad-btn';
    btn.textContent = n;
    btn.addEventListener('click', () => setSudokuCell(n));
    pad.appendChild(btn);
  }
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'numpad-btn clear';
  clear.textContent = '清除';
  clear.addEventListener('click', () => setSudokuCell(0));
  pad.appendChild(clear);
}

function setSudokuCell(num) {
  if (!sudokuSelected) return;
  const [r, c] = sudokuSelected;
  if (sudokuPuzzle[r][c] !== 0) return;
  sudokuGrid[r][c] = num;
  renderSudokuBoard();
}

$('btnStart').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:start-round');
});

$('btnPokerNext').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:start-round');
});

$('btnSudokuNext').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:start-round');
});

$('btnPokerSubmit').addEventListener('click', submitPoker);
$('expression').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitPoker();
});

function submitPoker() {
  if (!requireSocket()) return;
  const expression = $('expression').value.trim();
  if (!expression) return;
  socket.emit('game:poker-submit', { expression });
}

$('btnSudokuSubmit').addEventListener('click', () => {
  if (!requireSocket()) return;
  socket.emit('game:sudoku-submit', { grid: sudokuGrid });
});

initSocket();
