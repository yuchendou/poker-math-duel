import { io, Socket } from 'socket.io-client'
import type { GameState } from '@shared/game/types'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type RoomStatus = 'idle' | 'waiting' | 'playing'

export interface RoomInfo {
  roomCode: string
  playerIndex: number
  status: RoomStatus
  message: string
  players: { name: string; playerIndex: number }[]
}

const SOCKET_URL = import.meta.env.PROD ? window.location.origin : 'http://localhost:43123'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
  }
  return socket
}

export function createRoom(playerName: string): void {
  getSocket().emit('createRoom', { playerName })
}

export function joinRoom(roomCode: string, playerName: string): void {
  getSocket().emit('joinRoom', { roomCode, playerName })
}

export function emitGameAction(action: string): void {
  getSocket().emit(action)
}

export type GameStatePayload = {
  state: GameState
  status: 'waiting' | 'playing'
  roomCode: string
  playerIndex: number
  players: { name: string; playerIndex: number }[]
}

export function onRoomCreated(cb: (data: RoomInfo) => void): () => void {
  const s = getSocket()
  s.on('roomCreated', cb)
  return () => s.off('roomCreated', cb)
}

export function onRoomJoined(cb: (data: RoomInfo) => void): () => void {
  const s = getSocket()
  s.on('roomJoined', cb)
  return () => s.off('roomJoined', cb)
}

export function onWaiting(cb: (data: RoomInfo) => void): () => void {
  const s = getSocket()
  s.on('waiting', cb)
  return () => s.off('waiting', cb)
}

export function onGameState(cb: (data: GameStatePayload) => void): () => void {
  const s = getSocket()
  s.on('gameState', cb)
  return () => s.off('gameState', cb)
}

export function onError(cb: (data: { message: string }) => void): () => void {
  const s = getSocket()
  s.on('error', cb)
  return () => s.off('error', cb)
}

export function onConnectionChange(cb: (status: ConnectionStatus) => void): () => void {
  const s = getSocket()
  const handleConnect = () => cb('connected')
  const handleDisconnect = () => cb('disconnected')
  const handleConnecting = () => cb('connecting')

  if (s.connected) cb('connected')
  else cb('connecting')

  s.on('connect', handleConnect)
  s.on('disconnect', handleDisconnect)
  s.io.on('reconnect_attempt', handleConnecting)

  return () => {
    s.off('connect', handleConnect)
    s.off('disconnect', handleDisconnect)
    s.io.off('reconnect_attempt', handleConnecting)
  }
}
