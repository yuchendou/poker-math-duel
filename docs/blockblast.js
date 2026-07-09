/**
 * Block Blast 解題模組 — 8×8 棋盤 + 三個自訂方塊
 */
(function () {
  const SIZE = 8;
  const PIECE_SIZE = 5;
  const PIECE_COLORS = ['#5b9bd5', '#3ecf8e', '#f0b429'];
  const MAX_SOLUTIONS = 5;

  let board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  let pieces = [newPiece(), newPiece(), newPiece()];
  let solutions = [];

  function $(id) {
    return document.getElementById(id);
  }

  function newPiece() {
    return Array.from({ length: PIECE_SIZE }, () => Array(PIECE_SIZE).fill(0));
  }

  function pieceToCells(grid) {
    const cells = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c]) cells.push({ r, c });
      }
    }
    return normalizeCells(cells);
  }

  function normalizeCells(cells) {
    if (!cells.length) return [];
    const minR = Math.min(...cells.map((p) => p.r));
    const minC = Math.min(...cells.map((p) => p.c));
    return cells.map((p) => ({ r: p.r - minR, c: p.c - minC }));
  }

  function clearLines(b) {
    const next = b.map((row) => [...row]);
    const fullRows = [];
    const fullCols = [];
    for (let r = 0; r < SIZE; r++) {
      if (next[r].every((v) => v === 1)) fullRows.push(r);
    }
    for (let c = 0; c < SIZE; c++) {
      if (next.every((row) => row[c] === 1)) fullCols.push(c);
    }
    fullRows.forEach((r) => next[r].fill(0));
    fullCols.forEach((c) => {
      for (let r = 0; r < SIZE; r++) next[r][c] = 0;
    });
    return next;
  }

  function canPlace(b, cells, row, col) {
    for (const { r, c } of cells) {
      const nr = row + r;
      const nc = col + c;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return false;
      if (b[nr][nc]) return false;
    }
    return true;
  }

  function placeCells(b, cells, row, col) {
    const next = b.map((rowArr) => [...rowArr]);
    for (const { r, c } of cells) {
      next[row + r][col + c] = 1;
    }
    return clearLines(next);
  }

  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    arr.forEach((item, i) => {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      permutations(rest).forEach((p) => result.push([item, ...p]));
    });
    return result;
  }

  function dfs(order, depth, currentBoard, steps, found, pieceCellsList) {
    if (found.length >= MAX_SOLUTIONS) return;
    if (depth === 3) {
      found.push({
        steps: steps.map((s) => ({ ...s })),
        finalBoard: currentBoard.map((r) => [...r]),
      });
      return;
    }

    const pieceIdx = order[depth];
    const shape = pieceCellsList[pieceIdx];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!canPlace(currentBoard, shape, r, c)) continue;
        const nextBoard = placeCells(currentBoard, shape, r, c);
        steps.push({
          pieceIdx,
          cells: shape.map((p) => ({ ...p })),
          row: r,
          col: c,
          boardAfter: nextBoard.map((row) => [...row]),
        });
        dfs(order, depth + 1, nextBoard, steps, found, pieceCellsList);
        steps.pop();
        if (found.length >= MAX_SOLUTIONS) return;
      }
    }
  }

  function renderBoard() {
    const el = $('bbBoard');
    if (!el) return;
    el.innerHTML = '';
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'bb-cell' + (board[r][c] ? ' filled' : '');
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener('click', () => {
          board[r][c] = board[r][c] ? 0 : 1;
          renderBoard();
        });
        el.appendChild(cell);
      }
    }
  }

  function renderPieceEditors() {
    pieces.forEach((grid, idx) => {
      const el = $(`bbPiece${idx}`);
      if (!el) return;
      el.innerHTML = '';
      for (let r = 0; r < PIECE_SIZE; r++) {
        for (let c = 0; c < PIECE_SIZE; c++) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'bb-piece-cell' + (grid[r][c] ? ' filled' : '');
          cell.style.setProperty('--piece-color', PIECE_COLORS[idx]);
          cell.addEventListener('click', () => {
            pieces[idx][r][c] = pieces[idx][r][c] ? 0 : 1;
            renderPieceEditors();
          });
          el.appendChild(cell);
        }
      }
    });
  }

  function renderSolutionBoard(container, baseBoard, step, pieceIdx) {
    container.innerHTML = '';
    const display = baseBoard.map((row) => [...row]);
    for (const { r, c } of step.cells) {
      display[step.row + r][step.col + c] = 2 + pieceIdx;
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'bb-cell readonly';
        if (display[r][c] === 1) cell.classList.add('filled');
        if (display[r][c] >= 2) {
          cell.classList.add('piece');
          cell.style.background = PIECE_COLORS[pieceIdx];
        }
        container.appendChild(cell);
      }
    }
  }

  function renderSolutions(list) {
    const wrap = $('bbSolutions');
    wrap.innerHTML = '';
    if (!list.length) {
      wrap.innerHTML = '<p class="bb-no-solution">找不到可放置三個圖形的解法，試試調整棋盤或圖形。</p>';
      return;
    }

    list.forEach((sol, si) => {
      const card = document.createElement('div');
      card.className = 'bb-solution-card';
      card.innerHTML = `<h4>解法 ${si + 1}</h4>`;

      let prevBoard = board.map((r) => [...r]);
      sol.steps.forEach((step, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'bb-step';
        const label = document.createElement('p');
        label.className = 'bb-step-label';
        label.textContent = `步驟 ${i + 1}：放圖形 ${step.pieceIdx + 1} 於 (${step.row + 1}, ${step.col + 1})`;
        const mini = document.createElement('div');
        mini.className = 'bb-board mini';
        renderSolutionBoard(mini, prevBoard, step, step.pieceIdx);
        stepEl.appendChild(label);
        stepEl.appendChild(mini);
        card.appendChild(stepEl);
        prevBoard = step.boardAfter;
      });

      wrap.appendChild(card);
    });
  }

  const PRESETS = {
    dot: [[2, 2]],
    line2: [[2, 1], [2, 2]],
    line3: [[2, 0], [2, 1], [2, 2]],
    line4: [[2, 0], [2, 1], [2, 2], [2, 3]],
    line5: [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]],
    square2: [[1, 1], [1, 2], [2, 1], [2, 2]],
    square3: [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [3, 3]],
    L: [[1, 1], [2, 1], [3, 1], [3, 2]],
    T: [[1, 1], [1, 2], [1, 3], [2, 2]],
  };

  function applyPreset(pieceIdx, name) {
    const coords = PRESETS[name];
    if (!coords) return;
    pieces[pieceIdx] = newPiece();
    coords.forEach(([r, c]) => {
      pieces[pieceIdx][r][c] = 1;
    });
    renderPieceEditors();
  }

  function runSolve() {
    const pieceCells = pieces.map(pieceToCells);
    if (pieceCells.some((p) => p.length === 0)) {
      $('bbStatus').textContent = '⚠️ 請先畫好三個圖形（至少各 1 格）';
      $('bbStatus').className = 'bb-status error';
      return;
    }

    $('bbStatus').textContent = '計算中...';
    $('bbStatus').className = 'bb-status';
    $('bbSolutions').innerHTML = '';

    setTimeout(() => {
      const found = [];
      const orders = permutations([0, 1, 2]);
      for (const order of orders) {
        if (found.length >= MAX_SOLUTIONS) break;
        dfs(order, 0, board.map((r) => [...r]), [], found, pieceCells);
      }
      solutions = found;
      if (found.length) {
        $('bbStatus').textContent = `✅ 找到 ${found.length} 種放法${found.length >= MAX_SOLUTIONS ? '（僅顯示前 ' + MAX_SOLUTIONS + ' 種）' : ''}`;
        $('bbStatus').className = 'bb-status ok';
      } else {
        $('bbStatus').textContent = '❌ 找不到解法';
        $('bbStatus').className = 'bb-status error';
      }
      renderSolutions(found);
    }, 30);
  }

  let initialized = false;

  function init() {
    renderBoard();
    renderPieceEditors();
    if (initialized) return;
    initialized = true;

    $('btnBbClearBoard')?.addEventListener('click', () => {
      board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      renderBoard();
    });

    $('btnBbFillBoard')?.addEventListener('click', () => {
      board = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
      renderBoard();
    });

    document.querySelectorAll('.bb-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyPreset(Number(btn.dataset.piece), btn.dataset.shape);
      });
    });

    document.querySelectorAll('.bb-clear-piece').forEach((btn) => {
      btn.addEventListener('click', () => {
        pieces[Number(btn.dataset.piece)] = newPiece();
        renderPieceEditors();
      });
    });

    $('btnBbSolve')?.addEventListener('click', runSolve);

    $('btnBackFromBlockblast')?.addEventListener('click', () => {
      if (window.showGameSelect) window.showGameSelect();
    });
  }

  window.openBlockBlast = function () {
    init();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {});
  }
})();
