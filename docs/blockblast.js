/**
 * Block Blast 解題模組 — 8×8 棋盤 + 三個自訂方塊
 */
(function () {
  const SIZE = 8;
  const PIECE_SIZE = 5;
  const PIECE_COLORS = ['#5b9bd5', '#3ecf8e', '#f0b429'];
  const MAX_SOLUTIONS = 5;
  const MAX_SEARCH = 400;

  function countFilled(b) {
    return b.flat().filter((v) => v === 1).length;
  }

  function isBoardEmpty(b) {
    return countFilled(b) === 0;
  }

  function clearLinesWithStats(b) {
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
    const linesCleared = fullRows.length + fullCols.length;
    return {
      board: next,
      linesCleared,
      rowsCleared: fullRows.length,
      colsCleared: fullCols.length,
    };
  }

  function placeCells(b, cells, row, col) {
    const next = b.map((rowArr) => [...rowArr]);
    for (const { r, c } of cells) {
      next[row + r][col + c] = 1;
    }
    const stats = clearLinesWithStats(next);
    return {
      board: stats.board,
      linesCleared: stats.linesCleared,
      rowsCleared: stats.rowsCleared,
      colsCleared: stats.colsCleared,
    };
  }

  function scoreSolution(sol) {
    let score = 0;
    let totalLines = 0;
    let maxCombo = 0;
    let streak = 0;
    let maxStreak = 0;

    sol.steps.forEach((step) => {
      const lines = step.linesCleared || 0;
      totalLines += lines;
      if (lines > 0) {
        streak += 1;
        maxStreak = Math.max(maxStreak, streak);
        maxCombo = Math.max(maxCombo, lines);
        score += lines * 50;
        if (lines >= 2) score += lines * lines * 100;
      } else {
        streak = 0;
      }
    });

    score += maxStreak * 80;
    if (maxCombo >= 3) score += 150;

    const fullClear = isBoardEmpty(sol.finalBoard);
    if (fullClear) {
      score += 100000;
    } else {
      score -= countFilled(sol.finalBoard) * 15;
    }

    sol.score = score;
    sol.fullClear = fullClear;
    sol.totalLines = totalLines;
    sol.maxCombo = maxCombo;
    sol.maxStreak = maxStreak;
    return score;
  }

  function formatClearLabel(step) {
    if (!step.linesCleared) return '無消除';
    const parts = [];
    if (step.rowsCleared) parts.push(`${step.rowsCleared} 行`);
    if (step.colsCleared) parts.push(`${step.colsCleared} 列`);
    const combo = step.linesCleared >= 2 ? ` · Combo×${step.linesCleared}` : '';
    return `消除 ${parts.join(' ')}${combo}`;
  }

  function formatScoreSummary(sol) {
    const tags = [];
    if (sol.fullClear) tags.push('全盤消除');
    if (sol.maxCombo >= 2) tags.push(`最大 Combo×${sol.maxCombo}`);
    if (sol.maxStreak >= 2) tags.push(`連續 ${sol.maxStreak} 次消除`);
    if (sol.totalLines) tags.push(`共 ${sol.totalLines} 線`);
    return tags.join(' · ') || '可放置';
  }
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

  function canPlace(b, cells, row, col) {
    for (const { r, c } of cells) {
      const nr = row + r;
      const nc = col + c;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) return false;
      if (b[nr][nc]) return false;
    }
    return true;
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
    if (found.length >= MAX_SEARCH) return;
    if (depth === 3) {
      const sol = {
        steps: steps.map((s) => ({ ...s })),
        finalBoard: currentBoard.map((r) => [...r]),
      };
      scoreSolution(sol);
      found.push(sol);
      return;
    }

    const pieceIdx = order[depth];
    const shape = pieceCellsList[pieceIdx];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!canPlace(currentBoard, shape, r, c)) continue;
        const placed = placeCells(currentBoard, shape, r, c);
        steps.push({
          pieceIdx,
          cells: shape.map((p) => ({ ...p })),
          row: r,
          col: c,
          boardAfter: placed.board.map((row) => [...row]),
          linesCleared: placed.linesCleared,
          rowsCleared: placed.rowsCleared,
          colsCleared: placed.colsCleared,
        });
        dfs(order, depth + 1, placed.board, steps, found, pieceCellsList);
        steps.pop();
        if (found.length >= MAX_SEARCH) return;
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
      card.className = 'bb-solution-card' + (sol.fullClear ? ' full-clear' : '');
      const badge = sol.fullClear ? ' 🌟全盤消除' : '';
      card.innerHTML = `
        <h4>推薦 ${si + 1}${badge}</h4>
        <p class="bb-score-detail">評分 ${sol.score} · ${formatScoreSummary(sol)}</p>
      `;

      let prevBoard = board.map((r) => [...r]);
      sol.steps.forEach((step, i) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'bb-step';
        const label = document.createElement('p');
        label.className = 'bb-step-label';
        label.textContent = `步驟 ${i + 1}：圖形 ${step.pieceIdx + 1} → (${step.row + 1}, ${step.col + 1}) · ${formatClearLabel(step)}`;
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
        if (found.length >= MAX_SEARCH) break;
        dfs(order, 0, board.map((r) => [...r]), [], found, pieceCells);
      }

      found.sort((a, b) => b.score - a.score);
      const top = found.slice(0, MAX_SOLUTIONS);
      solutions = top;

      if (top.length) {
        const total = found.length;
        const fullCount = top.filter((s) => s.fullClear).length;
        let msg = `✅ 找到 ${total} 種放法，推薦評分最高的 ${top.length} 種`;
        if (fullCount) msg += `（含 ${fullCount} 種全盤消除）`;
        $('bbStatus').textContent = msg;
        $('bbStatus').className = 'bb-status ok';
      } else {
        $('bbStatus').textContent = '❌ 找不到解法';
        $('bbStatus').className = 'bb-status error';
      }
      renderSolutions(top);
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
