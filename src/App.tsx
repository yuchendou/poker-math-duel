import ActionPanel from './components/ActionPanel'
import Board from './components/Board'
import LobbyScreen from './components/LobbyScreen'
import PlayerPanel from './components/PlayerPanel'
import { useOnlineGame } from './hooks/useOnlineGame'

export default function App() {
  const { connectionStatus, roomInfo, gamePayload, error, setError, setRoomInfo, setGamePayload } =
    useOnlineGame()

  const handleReset = () => {
    setRoomInfo(null)
    setGamePayload(null)
    setError(null)
    window.location.reload()
  }

  if (!gamePayload) {
    return (
      <LobbyScreen
        connectionStatus={connectionStatus}
        error={error}
        roomInfo={roomInfo}
        onReset={handleReset}
      />
    )
  }

  const { state, roomCode } = gamePayload
  const myPlayerIndex = gamePayload.playerIndex
  const isMyTurn = state.currentPlayerIndex === myPlayerIndex

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-amber-400 sm:text-2xl">🎲 大富翁</h1>
          <p className="text-xs text-slate-400">
            房間 {roomCode}
            {isMyTurn ? ' · 輪到你了！' : ' · 等待對手…'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          離開
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[220px_1fr_220px]">
        <aside className="order-2 lg:order-1">
          <PlayerPanel
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            myPlayerIndex={myPlayerIndex}
          />
        </aside>

        <main className="order-1 lg:order-2">
          <Board spaces={state.board} players={state.players} roomCode={roomCode} />
          <div className="mt-4 lg:hidden">
            <ActionPanel state={state} isMyTurn={isMyTurn} />
          </div>
        </main>

        <aside className="order-3 hidden lg:block">
          <ActionPanel state={state} isMyTurn={isMyTurn} />
        </aside>
      </div>
    </div>
  )
}
