function getServerUrl() {
  const configured = window.GAME_CONFIG?.SERVER_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (window.location.hostname.includes('github.io')) return null;
  return window.location.origin;
}

const GAME_INFO = {
  poker: { label: '撲克數學', icon: '🃏', startText: '翻牌出題' },
  sudoku: { label: '雙人數獨', icon: '🔢', startText: '開始數獨' },
  bulls: { label: '幾A幾B', icon: '🎯', startText: '開始出題對戰' },
  mahjong: { label: '台灣麻將', icon: '🀄', startText: '開始四人麻將' },
  blockblast: { label: 'Block Blast 解題', icon: '🧩', solo: true },
};

const serverUrl = getServerUrl();
const $ = (id) => document.getElementById(id);

const panels = {
  gameSelect: $('gameSelect'),
  lobby: $('lobby'),
  waiting: $('waiting'),
  pokerGame: $('pokerGame'),
  sudokuGame: $('sudokuGame'),
  bullsGame: $('bullsGame'),
  mahjongGame: $('mahjongGame'),
  blockblastGame: $('blockblastGame'),
};

let socket = null;
let myId = null;
let roomState = null;
let isHost = false;
let selectedGame = null;
let sudokuPuzzle = null;
let sudokuGrid = null;
let sudokuSelected = null;
let bullsCurrentTurnId = null;
let bullsSecretSubmitted = false;
let sudokuWrongCells = new Set();
window.mahjongIsHost = false;

function showPanel(panel) {
  if (!panel) return;
  Object.values(panels).forEach((p) => {
    if (p) p.classList.add('hidden');
  });
  panel.classList.remove('hidden');
}

function showPageError(msg) {
  const el = $('pageError');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
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

function showFeedback(elementId, message, type = 'error') {
  const fb = $(elementId);
  fb.classList.remove('hidden', 'success', 'error');
  fb.classList.add(type);
  fb.textContent = message;
}

function sudokuCellKey(r, c) {
  return `${r},${c}`;
}

function setSudokuWrongCells(cells) {
  sudokuWrongCells = new Set((cells || []).map(([r, c]) => sudokuCellKey(r, c)));
}

function showError(msg) {
  if (panels.gameSelect && !panels.gameSelect.classList.contains('hidden')) {
    showPageError(msg);
    return;
  }
  const el = $('lobbyError');
  if (!el) {
    showPageError(msg);
    return;
  }
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
  const info = GAME_INFO[gameType];
  if (!info) {
    showError('此遊戲尚未載入，請強制重新整理頁面（Cmd+Shift+R）');
    return;
  }
  selectedGame = gameType;
  if (info.solo) {
    $('mainSubtitle').textContent = info.label;
    showPanel(panels.blockblastGame);
    if (window.openBlockBlast) window.openBlockBlast();
    return;
  }
  $('selectedGameBadge').textContent = info.label;
  $('mainSubtitle').textContent = `正在玩：${info.label}`;
  document.querySelectorAll('.game-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.game === gameType);
  });
  if (!panels.lobby) {
    showError('頁面載入不完整，請重新整理');
    return;
  }
  showPanel(panels.lobby);
}

window.showGameSelect = function () {
  selectedGame = null;
  $('mainSubtitle').textContent = '選一個遊戲，跟朋友連線對戰！';
  document.querySelectorAll('.game-card').forEach((card) => card.classList.remove('selected'));
  showPanel(panels.gameSelect);
};

function bindGameCards() {
  const container = document.querySelector('.game-cards');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.game-card');
    if (!card?.dataset?.game) return;
    selectGame(card.dataset.game);
  });
}

function bindClick(id, handler) {
  const el = $(id);
  if (el) el.addEventListener('click', handler);
}

function refreshPanels() {
  panels.gameSelect = $('gameSelect');
  panels.lobby = $('lobby');
  panels.waiting = $('waiting');
  panels.pokerGame = $('pokerGame');
  panels.sudokuGame = $('sudokuGame');
  panels.bullsGame = $('bullsGame');
  panels.mahjongGame = $('mahjongGame');
  panels.blockblastGame = $('blockblastGame');
}

function bindAllUi() {
  bindClick('btnBackToSelect', () => {
    selectedGame = null;
    $('mainSubtitle').textContent = '選一個遊戲，跟朋友連線對戰！';
    document.querySelectorAll('.game-card').forEach((card) => card.classList.remove('selected'));
    showPanel(panels.gameSelect);
  });

  bindClick('btnCreate', () => {
    if (!requireSocket() || !selectedGame) return;
    socket.emit('room:create', {
      name: $('playerName').value.trim() || '玩家',
      gameType: selectedGame,
    });
  });

  bindClick('btnJoin', () => {
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

  const roomCode = $('roomCode');
  if (roomCode) {
    roomCode.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  bindClick('btnCopy', () => {
    navigator.clipboard.writeText($('displayCode').textContent).then(() => {
      const btn = $('btnCopy');
      if (!btn) return;
      btn.textContent = '已複製！';
      setTimeout(() => { btn.textContent = '複製代碼'; }, 2000);
    });
  });

  bindClick('btnStart', () => {
    if (!requireSocket()) return;
    socket.emit('game:start-round');
  });

  bindClick('btnPokerNext', () => {
    if (!requireSocket()) return;
    socket.emit('game:start-round');
  });

  bindClick('btnSudokuNext', () => {
    if (!requireSocket()) return;
    socket.emit('game:start-round');
  });

  bindClick('btnBullsNext', () => {
    if (!requireSocket()) return;
    socket.emit('game:start-round');
  });

  bindClick('btnMahjongNext', () => {
    if (!requireSocket()) return;
    socket.emit('game:start-round');
  });

  bindClick('btnPokerSubmit', submitPoker);
  const expression = $('expression');
  if (expression) {
    expression.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPoker();
    });
  }

  bindClick('btnSudokuCheck', () => {
    if (!requireSocket()) return;
    socket.emit('game:sudoku-check', { grid: sudokuGrid });
  });

  bindClick('btnSudokuSubmit', () => {
    if (!requireSocket()) return;
    socket.emit('game:sudoku-submit', { grid: sudokuGrid });
  });

  bindClick('btnBullsSubmit', submitBulls);
  bindClick('btnBullsSecret', submitBullsSecret);

  const bullsSecret = $('bullsSecret');
  if (bullsSecret) {
    bullsSecret.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
    bullsSecret.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBullsSecret();
    });
  }

  const bullsGuess = $('bullsGuess');
  if (bullsGuess) {
    bullsGuess.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    });
    bullsGuess.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBulls();
    });
  }
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
    updateServerStatus('❌ 無法連上伺服器', false);
  });

  bindSocketEvents();
  if (window.bindMahjong) window.bindMahjong(socket, panels, showPanel);
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
    if (state.gameType === 'bulls' && ['setup', 'playing', 'round-end'].includes(state.gameState)) {
      return;
    }
    if (state.gameType === 'mahjong' && ['playing', 'round-end'].includes(state.gameState)) {
      return;
    }
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

  socket.on('game:poker-result', ({ correct, message }) => {
    showFeedback('pokerFeedback', message, correct ? 'success' : 'error');
  });

  socket.on('game:poker-won', ({ winnerId, winnerName, expression, result, target }) => {
    if (winnerId === myId) {
      showFeedback('pokerFeedback', '🎉 你答對了！', 'success');
    }
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
    setSudokuWrongCells([]);
    initSudoku(puzzle);
    $('sudokuFeedback').classList.add('hidden');
    $('sudokuRoundResult').classList.add('hidden');
    $('btnSudokuNext').classList.add('hidden');
    $('btnSudokuSubmit').disabled = false;
    $('btnSudokuCheck').disabled = false;
  });

  socket.on('game:sudoku-check-result', ({ ok, message, wrongCells, emptyCells }) => {
    setSudokuWrongCells(wrongCells);
    renderSudokuBoard();
    if (ok) {
      showFeedback('sudokuFeedback', message, 'success');
    } else if (wrongCells?.length) {
      showFeedback('sudokuFeedback', message, 'error');
    } else if (emptyCells?.length) {
      showFeedback('sudokuFeedback', message, 'error');
    } else {
      showFeedback('sudokuFeedback', message, 'error');
    }
  });

  socket.on('game:sudoku-result', ({ correct, message, wrongCells }) => {
    if (wrongCells?.length) setSudokuWrongCells(wrongCells);
    renderSudokuBoard();
    showFeedback('sudokuFeedback', message, correct ? 'success' : 'error');
  });

  socket.on('game:sudoku-won', ({ winnerId, winnerName }) => {
    if (winnerId === myId) {
      showFeedback('sudokuFeedback', '🎉 你答對了！', 'success');
    }
    $('btnSudokuSubmit').disabled = true;
    $('btnSudokuCheck').disabled = true;
    const el = $('sudokuRoundResult');
    el.classList.remove('hidden');
    el.innerHTML = `<p class="winner">🎉 ${winnerName} 先完成了！</p>`;
    if (isHost) $('btnSudokuNext').classList.remove('hidden');
  });

  socket.on('game:bulls-setup', ({ submittedIds }) => {
    showPanel(panels.bullsGame);
    bullsSecretSubmitted = (submittedIds || []).includes(myId);
    $('bullsRoundResult').classList.add('hidden');
    $('btnBullsNext').classList.add('hidden');
    $('bullsPlay').classList.add('hidden');
    $('bullsSetup').classList.remove('hidden');
    $('bullsSecret').value = '';
    $('bullsGuess').value = '';
    $('btnBullsSecret').textContent = '出題';
    $('bullsFeedback').classList.add('hidden');
    renderBullsHistory([]);
    updateBullsSetupUI(submittedIds || []);
  });

  socket.on('game:bulls-setup-update', ({ submittedIds }) => {
    bullsSecretSubmitted = (submittedIds || []).includes(myId);
    updateBullsSetupUI(submittedIds || []);
  });

  socket.on('game:bulls-secret-ok', () => {
    bullsSecretSubmitted = true;
    $('bullsSecret').value = '';
    $('btnBullsSecret').disabled = true;
    $('bullsSecret').disabled = true;
    showBullsFeedback('✅ 已出題！等待對手出題...', 'success');
    updateBullsSetupUI([myId]);
  });

  socket.on('game:bulls-new-round', ({ currentTurnId, currentTurnName, history }) => {
    showPanel(panels.bullsGame);
    bullsCurrentTurnId = currentTurnId;
    $('bullsSetup').classList.add('hidden');
    $('bullsPlay').classList.remove('hidden');
    $('bullsGuess').value = '';
    $('bullsFeedback').classList.add('hidden');
    $('bullsRoundResult').classList.add('hidden');
    $('btnBullsNext').classList.add('hidden');
    renderBullsHistory(history || []);
    updateBullsTurnUI(currentTurnId, currentTurnName);
  });

  socket.on('game:bulls-update', ({ history, lastResult, currentTurnId, currentTurnName }) => {
    bullsCurrentTurnId = currentTurnId;
    showBullsFeedback(`${lastResult.playerName} 猜 ${lastResult.guess} → ${lastResult.a}A${lastResult.b}B`, 'success');
    renderBullsHistory(history);
    updateBullsTurnUI(currentTurnId, currentTurnName);
    if (currentTurnId === myId) $('bullsGuess').focus();
  });

  socket.on('game:bulls-result', ({ correct, message }) => {
    if (correct) {
      showBullsFeedback(message, 'success');
    } else {
      showBullsFeedback(message, 'error');
    }
    if (!bullsSecretSubmitted && !$('bullsSetup').classList.contains('hidden')) {
      $('btnBullsSecret').disabled = false;
      $('btnBullsSecret').textContent = '出題';
    }
  });

  socket.on('game:bulls-won', ({ winnerId, winnerName, guess, secret, opponentName, revealedSecrets, attempts, history }) => {
    if (winnerId === myId) {
      showBullsFeedback('🎉 你答對了！4A0B！', 'success');
    }
    renderBullsHistory(history || []);
    updateBullsTurnUI(null, null, true);
    const el = $('bullsRoundResult');
    el.classList.remove('hidden');
    const secretsHtml = (revealedSecrets || [])
      .map((item) => `<li><strong>${item.playerName}</strong> 的題目：<strong>${item.secret}</strong></li>`)
      .join('');
    el.innerHTML = `
      <p class="winner">🎉 ${winnerName} 猜中了 ${opponentName} 的題目！</p>
      <p>最後一猜：<strong>${guess}</strong>（4A0B）· 本局共猜 ${attempts} 次</p>
      <p>${opponentName} 的答案是：<strong>${secret}</strong></p>
      <ul class="bulls-revealed">${secretsHtml}</ul>
    `;
    if (isHost) $('btnBullsNext').classList.remove('hidden');
  });

  socket.on('error', ({ message }) => {
    if (!panels.waiting.classList.contains('hidden')) {
      $('connectionMessage').textContent = `❌ ${message}`;
    } else {
      showError(message);
    }
  });
}

function updateWaitingUI(state) {
  isHost = state.players.find((p) => p.id === myId)?.isHost ?? false;
  window.mahjongIsHost = isHost;
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
      if (sudokuWrongCells.has(sudokuCellKey(r, c))) {
        cell.classList.add('wrong');
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
  sudokuWrongCells.delete(sudokuCellKey(r, c));
  renderSudokuBoard();
}

function renderBullsHistory(history) {
  const list = $('bullsHistory');
  list.innerHTML = '';
  (history || []).slice().reverse().forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="bulls-player">${item.playerName}</span> ${item.guess} → <strong>${item.a}A${item.b}B</strong>`;
    list.appendChild(li);
  });
}

function validateBullsNumber(value) {
  if (!/^\d{4}$/.test(value)) return '請輸入 4 位數字';
  if (value[0] === '0') return '第一位不能是 0';
  if (new Set(value).size !== 4) return '4 個數字不能重複';
  return '';
}

function showBullsFeedback(message, type = 'error') {
  const fb = $('bullsFeedback');
  fb.classList.remove('hidden', 'success', 'error');
  fb.classList.add(type);
  fb.textContent = message;
}

function updateBullsSetupUI(submittedIds) {
  const status = $('bullsSetupStatus');
  const hasMine = bullsSecretSubmitted || submittedIds.includes(myId);
  const waitingOpponent = hasMine && submittedIds.length < 2;

  $('bullsSecret').disabled = hasMine;
  $('btnBullsSecret').disabled = hasMine;

  if (waitingOpponent) {
    status.textContent = '✅ 已出題，等待對手出題...';
    status.classList.add('wait-turn');
    status.classList.remove('my-turn');
    return;
  }

  status.textContent = '📝 請輸入你要出的 4 位數字（第一位不能是 0）';
  status.classList.add('my-turn');
  status.classList.remove('wait-turn');
  if (!hasMine) $('bullsSecret').focus();
}

function updateBullsTurnUI(currentTurnId, currentTurnName, gameOver = false) {
  const status = $('bullsTurnStatus');
  const isMyTurn = currentTurnId === myId;
  const canPlay = !gameOver && isMyTurn;

  $('bullsGuess').disabled = !canPlay;
  $('btnBullsSubmit').disabled = !canPlay;

  if (gameOver) {
    status.textContent = '本局結束';
    status.classList.remove('my-turn', 'wait-turn');
    return;
  }

  if (isMyTurn) {
    status.textContent = '🎯 輪到你了，猜對手的數字！';
    status.classList.add('my-turn');
    status.classList.remove('wait-turn');
    $('bullsGuess').value = '';
    $('bullsGuess').focus();
  } else {
    status.textContent = `⏳ 輪到 ${currentTurnName} 猜測...`;
    status.classList.add('wait-turn');
    status.classList.remove('my-turn');
    $('bullsGuess').value = '';
  }
}

function submitPoker() {
  if (!requireSocket()) return;
  const expression = $('expression').value.trim();
  if (!expression) return;
  socket.emit('game:poker-submit', { expression });
}

function submitBullsSecret() {
  if (!requireSocket() || bullsSecretSubmitted) return;
  const secret = $('bullsSecret').value.trim();
  const err = validateBullsNumber(secret);
  if (err) {
    showBullsFeedback(err, 'error');
    return;
  }
  $('btnBullsSecret').disabled = true;
  $('btnBullsSecret').textContent = '送出中...';
  showBullsFeedback('正在送出題目...', 'success');
  socket.emit('game:bulls-set-secret', { secret });
}

function submitBulls() {
  if (!requireSocket()) return;
  const guess = $('bullsGuess').value.trim();
  const err = validateBullsNumber(guess);
  if (err) {
    showBullsFeedback(err, 'error');
    return;
  }
  socket.emit('game:bulls-guess', { guess });
}

function bootApp() {
  refreshPanels();
  bindGameCards();
  bindAllUi();
  if (!window.__APP_BOOTED__) {
    window.__APP_BOOTED__ = true;
    try {
      if (typeof io === 'undefined') {
        showPageError('連線元件載入失敗，請重新整理頁面');
        return;
      }
      initSocket();
    } catch (err) {
      console.error(err);
      showPageError('遊戲啟動失敗，請強制重新整理（Cmd+Shift+R）');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
