const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_VALUES = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };

/** @type {Map<string, Room>} */
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function drawCards() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: RANK_VALUES[rank], isRed: suit === '♥' || suit === '♦' });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, 4);
}

function computeAllResults(nums) {
  const results = new Set();
  function solve(remaining) {
    if (remaining.length === 1) {
      const v = remaining[0];
      if (Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9) {
        results.add(Math.round(v));
      }
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      for (let j = 0; j < remaining.length; j++) {
        if (i === j) continue;
        const rest = remaining.filter((_, k) => k !== i && k !== j);
        const a = remaining[i];
        const b = remaining[j];
        solve([...rest, a + b]);
        solve([...rest, a - b]);
        solve([...rest, a * b]);
        if (Math.abs(b) > 1e-9) solve([...rest, a / b]);
      }
    }
  }
  solve(nums);
  return [...results].filter((n) => n > 0 && n <= 100);
}

function generatePuzzle() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const cards = drawCards();
    const values = cards.map((c) => c.value);
    const possible = computeAllResults(values);
    if (possible.length === 0) continue;
    const target = possible[Math.floor(Math.random() * possible.length)];
    return { cards, target, values };
  }
  const cards = [
    { suit: '♠', rank: '3', value: 3, isRed: false },
    { suit: '♥', rank: '4', value: 4, isRed: true },
    { suit: '♦', rank: '5', value: 5, isRed: true },
    { suit: '♣', rank: '6', value: 6, isRed: false },
  ];
  return { cards, target: 24, values: [3, 4, 5, 6] };
}

function canReachTarget(values, target) {
  return computeAllResults(values).includes(target);
}

function usesEachCardOnce(expression, values) {
  const used = expression.match(/\d+/g)?.map(Number) || [];
  if (used.length !== values.length) return false;
  const sortedUsed = [...used].sort((a, b) => a - b);
  const sortedValues = [...values].sort((a, b) => a - b);
  return sortedUsed.every((v, i) => v === sortedValues[i]);
}

function safeEval(expr) {
  const sanitized = expr.replace(/\s/g, '');
  if (!/^[\d+\-*/().]+$/.test(sanitized)) return null;
  if (/[+\-*/]{2,}/.test(sanitized)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitized})`)();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function getRoomState(room) {
  return {
    code: room.code,
    players: room.players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost })),
    isFull: room.players.length === 2,
    gameState: room.gameState,
    round: room.round,
    scores: room.scores,
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', getRoomState(room));
}

class Room {
  constructor(code, hostSocket, hostName) {
    this.code = code;
    this.players = [{ id: hostSocket.id, name: hostName, isHost: true }];
    this.gameState = 'waiting';
    this.round = null;
    this.scores = {};
    this.scores[hostSocket.id] = 0;
  }

  addPlayer(socket, name) {
    if (this.players.length >= 2) return false;
    this.players.push({ id: socket.id, name, isHost: false });
    this.scores[socket.id] = 0;
    return true;
  }

  removePlayer(socketId) {
    this.players = this.players.filter((p) => p.id !== socketId);
    delete this.scores[socketId];
    if (this.players.length === 0) return 'empty';
    if (this.players.length === 1) {
      this.players[0].isHost = true;
      this.gameState = 'waiting';
      this.round = null;
    }
    return 'updated';
  }

  getPlayer(socketId) {
    return this.players.find((p) => p.id === socketId);
  }

  startRound() {
    const puzzle = generatePuzzle();
    this.gameState = 'playing';
    this.round = {
      cards: puzzle.cards,
      target: puzzle.target,
      values: puzzle.values,
      winner: null,
      submissions: {},
    };
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('room:create', ({ name }) => {
    const playerName = (name || '玩家').trim().slice(0, 12) || '玩家';
    const code = generateRoomCode();
    const room = new Room(code, socket, playerName);
    rooms.set(code, room);
    currentRoom = code;
    socket.join(code);
    socket.emit('room:created', { code });
    broadcastRoom(room);
  });

  socket.on('room:join', ({ code, name }) => {
    const roomCode = (code || '').trim().toUpperCase();
    const playerName = (name || '玩家').trim().slice(0, 12) || '玩家';
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error', { message: '找不到這個房間代碼' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error', { message: '房間已滿（最多 2 人）' });
      return;
    }

    room.addPlayer(socket, playerName);
    currentRoom = roomCode;
    socket.join(roomCode);
    socket.emit('room:joined', { code: roomCode });
    broadcastRoom(room);

    if (room.players.length === 2) {
      io.to(roomCode).emit('room:both-connected', {
        message: '兩位玩家都已連線！可以開始遊戲了',
      });
    }
  });

  socket.on('game:start-round', () => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    const player = room.getPlayer(socket.id);
    if (!player?.isHost) {
      socket.emit('error', { message: '只有房主可以出題' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: '需要兩位玩家連線才能開始' });
      return;
    }

    room.startRound();
    io.to(room.code).emit('game:new-round', {
      cards: room.round.cards,
      target: room.round.target,
    });
    broadcastRoom(room);
  });

  socket.on('game:submit', ({ expression }) => {
    const room = rooms.get(currentRoom);
    if (!room || room.gameState !== 'playing' || !room.round || room.round.winner) return;

    const expr = (expression || '').trim();
    const result = safeEval(expr);
    if (result === null) {
      socket.emit('game:result', { correct: false, message: '算式格式不正確' });
      return;
    }

    if (!usesEachCardOnce(expr, room.round.values)) {
      socket.emit('game:result', { correct: false, message: '必須剛好使用四張牌的數字各一次' });
      return;
    }

    const correct = Math.abs(result - room.round.target) < 1e-9;
    room.round.submissions[socket.id] = { expression: expr, correct, result };

    if (correct) {
      room.round.winner = socket.id;
      room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
      const winner = room.getPlayer(socket.id);
      io.to(room.code).emit('game:round-won', {
        winnerId: socket.id,
        winnerName: winner?.name,
        expression: expr,
        result,
        target: room.round.target,
        scores: room.scores,
      });
      room.gameState = 'round-end';
    } else {
      socket.emit('game:result', {
        correct: false,
        message: `結果是 ${result}，目標是 ${room.round.target}`,
        result,
      });
    }
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const status = room.removePlayer(socket.id);
    if (status === 'empty') {
      rooms.delete(currentRoom);
    } else {
      io.to(currentRoom).emit('room:player-left', {
        message: '對手已離線，等待重新連線或新玩家加入',
      });
      broadcastRoom(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🃏 撲克數學對戰已啟動：http://localhost:${PORT}`);
});
