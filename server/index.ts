import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import { Server } from 'socket.io'
import { createInitialState } from '../shared/game/gameLogic.js'
import {
  applyChanceCard,
  buyProperty,
  payJailBail,
  payRent,
  payTax,
  rollDice,
  skipBuy,
} from '../shared/game/gameLogic.js'
import type { GameState } from '../shared/game/types.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 43123
const isProd = process.env.NODE_ENV === 'production'

interface RoomPlayer {
  socketId: string
  name: string
  playerIndex: number
}

interface Room {
  code: string
  players: RoomPlayer[]
  gameState: GameState | null
  status: 'waiting' | 'playing'
}

const rooms = new Map<string, Room>()

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  if (rooms.has(code)) return generateRoomCode()
  return code
}

function getPlayerIndex(room: Room, socketId: string): number | null {
  const player = room.players.find((p) => p.socketId === socketId)
  return player?.playerIndex ?? null
}

function broadcastGame(io: Server, room: Room) {
  if (!room.gameState) return
  for (const player of room.players) {
    io.to(player.socketId).emit('gameState', {
      state: room.gameState,
      status: room.status,
      roomCode: room.code,
      playerIndex: player.playerIndex,
      players: room.players.map((p) => ({ name: p.name, playerIndex: p.playerIndex })),
    })
  }
}

function applyAction(
  room: Room,
  socketId: string,
  action: (state: GameState) => GameState,
): boolean {
  if (!room.gameState || room.status !== 'playing') return false

  const playerIndex = getPlayerIndex(room, socketId)
  if (playerIndex === null) return false
  if (playerIndex !== room.gameState.currentPlayerIndex) return false

  room.gameState = action(room.gameState)
  return true
}

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: isProd
      ? false
      : ['http://localhost:43124', 'http://127.0.0.1:43124', 'http://localhost:43123'],
    methods: ['GET', 'POST'],
  },
})

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

io.on('connection', (socket) => {
  let currentRoomCode: string | null = null

  socket.on('createRoom', ({ playerName }: { playerName: string }) => {
    const code = generateRoomCode()
    const name = playerName.trim() || '玩家 1'

    const room: Room = {
      code,
      players: [{ socketId: socket.id, name, playerIndex: 0 }],
      gameState: null,
      status: 'waiting',
    }

    rooms.set(code, room)
    currentRoomCode = code
    socket.join(code)

    socket.emit('roomCreated', {
      roomCode: code,
      playerIndex: 0,
      status: 'waiting',
      message: '房間已建立，把房間代碼分享給朋友！',
    })
  })

  socket.on('joinRoom', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
    const code = roomCode.trim().toUpperCase()
    const room = rooms.get(code)

    if (!room) {
      socket.emit('error', { message: '找不到房間，請確認代碼是否正確' })
      return
    }

    if (room.status === 'playing' && !room.players.some((p) => p.socketId === socket.id)) {
      socket.emit('error', { message: '遊戲已開始，無法加入' })
      return
    }

    if (room.players.length >= 2) {
      const existing = room.players.find((p) => p.socketId === socket.id)
      if (!existing) {
        socket.emit('error', { message: '房間已滿（最多 2 人）' })
        return
      }
    }

    const name = playerName.trim() || '玩家 2'
    const existingPlayer = room.players.find((p) => p.socketId === socket.id)

    if (!existingPlayer) {
      room.players.push({ socketId: socket.id, name, playerIndex: 1 })
    } else {
      existingPlayer.name = name
    }

    currentRoomCode = code
    socket.join(code)

    if (room.players.length === 2) {
      const names = room.players
        .sort((a, b) => a.playerIndex - b.playerIndex)
        .map((p) => p.name)
      room.gameState = createInitialState(names)
      room.status = 'playing'
      broadcastGame(io, room)
    } else {
      io.to(code).emit('waiting', {
        roomCode: code,
        message: '等待對手加入…',
        players: room.players.map((p) => ({ name: p.name, playerIndex: p.playerIndex })),
      })
      socket.emit('roomJoined', {
        roomCode: code,
        playerIndex: 1,
        status: 'waiting',
        message: '已加入房間，等待房主開始…',
      })
    }
  })

  socket.on('rollDice', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, rollDice)) {
      broadcastGame(io, room)
    }
  })

  socket.on('buyProperty', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, buyProperty)) {
      broadcastGame(io, room)
    }
  })

  socket.on('skipBuy', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, skipBuy)) {
      broadcastGame(io, room)
    }
  })

  socket.on('payRent', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, payRent)) {
      broadcastGame(io, room)
    }
  })

  socket.on('payTax', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, payTax)) {
      broadcastGame(io, room)
    }
  })

  socket.on('applyChance', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, applyChanceCard)) {
      broadcastGame(io, room)
    }
  })

  socket.on('payJailBail', () => {
    const room = currentRoomCode ? rooms.get(currentRoomCode) : null
    if (!room?.gameState) return
    if (applyAction(room, socket.id, payJailBail)) {
      broadcastGame(io, room)
    }
  })

  socket.on('disconnect', () => {
    if (!currentRoomCode) return
    const room = rooms.get(currentRoomCode)
    if (!room) return

    room.players = room.players.filter((p) => p.socketId !== socket.id)

    if (room.players.length === 0) {
      rooms.delete(currentRoomCode)
      return
    }

    if (room.gameState) {
      room.gameState = {
        ...room.gameState,
        message: '對手已離線，等待重新連線…',
      }
      broadcastGame(io, room)
    } else {
      io.to(currentRoomCode).emit('waiting', {
        roomCode: currentRoomCode,
        message: '對手已離線，等待加入…',
        players: room.players.map((p) => ({ name: p.name, playerIndex: p.playerIndex })),
      })
    }
  })
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
