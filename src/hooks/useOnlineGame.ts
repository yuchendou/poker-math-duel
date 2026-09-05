import { useEffect, useState } from 'react'
import {
  onConnectionChange,
  onError,
  onGameState,
  onRoomCreated,
  onRoomJoined,
  onWaiting,
  type ConnectionStatus,
  type GameStatePayload,
  type RoomInfo,
} from '../lib/socket'

export function useOnlineGame() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting')
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null)
  const [gamePayload, setGamePayload] = useState<GameStatePayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cleanups = [
      onConnectionChange(setConnectionStatus),
      onRoomCreated((data) => {
        setRoomInfo(data)
        setError(null)
      }),
      onRoomJoined((data) => {
        setRoomInfo(data)
        setError(null)
      }),
      onWaiting((data) => {
        setRoomInfo(data)
      }),
      onGameState((data) => {
        setGamePayload(data)
        setRoomInfo({
          roomCode: data.roomCode,
          playerIndex: data.playerIndex,
          status: 'playing',
          message: data.state.message,
          players: data.players,
        })
      }),
      onError((data) => setError(data.message)),
    ]
    return () => cleanups.forEach((fn) => fn())
  }, [])

  return { connectionStatus, roomInfo, gamePayload, error, setError, setRoomInfo, setGamePayload }
}
