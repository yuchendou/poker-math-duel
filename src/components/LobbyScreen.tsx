import { useState } from 'react'
import { createRoom, joinRoom } from '../lib/socket'

interface LobbyScreenProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected'
  error: string | null
  roomInfo: { roomCode: string; message: string; status: string } | null
  onReset: () => void
}

export default function LobbyScreen({
  connectionStatus,
  error,
  roomInfo,
  onReset,
}: LobbyScreenProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const handleCreate = () => {
    createRoom(playerName)
  }

  const handleJoin = () => {
    joinRoom(roomCode, playerName)
  }

  if (roomInfo?.status === 'waiting') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-amber-600/30 bg-slate-900/90 p-8 text-center shadow-2xl">
          <div className="text-4xl">⏳</div>
          <h2 className="mt-4 text-xl font-bold text-amber-400">等待對手加入</h2>
          <p className="mt-2 text-slate-400">{roomInfo.message}</p>
          <div className="mt-6 rounded-xl bg-slate-800 p-4">
            <p className="text-sm text-slate-400">房間代碼</p>
            <p className="mt-1 font-mono text-3xl font-black tracking-widest text-white">
              {roomInfo.roomCode}
            </p>
            <p className="mt-3 text-xs text-slate-500">把此代碼傳給朋友，對方選「加入房間」即可</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="mt-6 text-sm text-slate-400 underline hover:text-white"
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-600/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          <div className="text-5xl">🎲</div>
          <h1 className="mt-4 text-3xl font-black text-amber-400">大富翁</h1>
          <p className="mt-2 text-slate-400">線上雙人對戰 — 各用各的裝置一起玩！</p>
          <p className="mt-1 text-xs text-slate-500">
            連線狀態：
            {connectionStatus === 'connected' && <span className="text-emerald-400"> 已連線</span>}
            {connectionStatus === 'connecting' && <span className="text-amber-400"> 連線中…</span>}
            {connectionStatus === 'disconnected' && <span className="text-red-400"> 已斷線</span>}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-300">{error}</div>
        )}

        {mode === 'choose' && (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => setMode('create')}
              disabled={connectionStatus !== 'connected'}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-lg font-bold text-slate-900 shadow-lg transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-40"
            >
              建立房間（房主）
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              disabled={connectionStatus !== 'connected'}
              className="w-full rounded-xl border border-slate-600 py-3 text-lg font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              加入房間
            </button>
          </div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <div className="mt-8 space-y-4">
            <div>
              <label className="block text-sm text-slate-400">你的暱稱</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="輸入暱稱"
                maxLength={12}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-sm text-slate-400">房間代碼</label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="例如 AB12CD"
                  maxLength={6}
                  className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono uppercase tracking-widest text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
            )}

            <button
              type="button"
              onClick={mode === 'create' ? handleCreate : handleJoin}
              disabled={!playerName.trim() || (mode === 'join' && roomCode.trim().length < 4)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 font-bold text-white shadow-lg transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40"
            >
              {mode === 'create' ? '建立並等待朋友' : '加入遊戲'}
            </button>

            <button
              type="button"
              onClick={() => setMode('choose')}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              ← 返回
            </button>
          </div>
        )}

        <div className="mt-6 rounded-lg bg-slate-800/50 p-4 text-xs text-slate-400">
          <p className="font-bold text-slate-300">線上玩法</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>一人建立房間，分享 6 位代碼給朋友</li>
            <li>朋友在另一台裝置加入房間</li>
            <li>兩人到齊後自動開始，輪流擲骰</li>
            <li>輪到你時才能操作，對方即時看到棋盤</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
