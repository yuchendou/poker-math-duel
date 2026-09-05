import { useCallback, useState } from 'react'
import ActionPanel from './components/ActionPanel'
import Board from './components/Board'
import PlayerPanel from './components/PlayerPanel'
import SetupScreen from './components/SetupScreen'
import { createInitialState, rollDice } from './game/gameLogic'
import type { GameState } from './game/types'

export default function App() {
  const [screen, setScreen] = useState<'setup' | 'game'>('setup')
  const [playerCount, setPlayerCount] = useState(2)
  const [names, setNames] = useState(['玩家 1', '玩家 2', '玩家 3', '玩家 4'])
  const [gameState, setGameState] = useState<GameState | null>(null)

  const handleStart = useCallback(() => {
    const activeNames = names.slice(0, playerCount)
    setGameState(createInitialState(activeNames))
    setScreen('game')
  }, [names, playerCount])

  const handleRoll = useCallback(() => {
    setGameState((prev) => (prev ? rollDice(prev) : prev))
  }, [])

  const handleAction = useCallback((next: GameState) => {
    setGameState(next)
  }, [])

  const handleRestart = () => {
    setScreen('setup')
    setGameState(null)
  }

  if (screen === 'setup') {
    return (
      <SetupScreen
        playerCount={playerCount}
        names={names}
        onCountChange={setPlayerCount}
        onNameChange={(i, name) => {
          const next = [...names]
          next[i] = name
          setNames(next)
        }}
        onStart={handleStart}
      />
    )
  }

  if (!gameState) return null

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-black text-amber-400 sm:text-2xl">🎲 大富翁</h1>
        <button
          type="button"
          onClick={handleRestart}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          重新開始
        </button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[220px_1fr_220px]">
        <aside className="order-2 lg:order-1">
          <PlayerPanel
            players={gameState.players}
            currentPlayerIndex={gameState.currentPlayerIndex}
          />
        </aside>

        <main className="order-1 lg:order-2">
          <Board spaces={gameState.board} players={gameState.players} />
          <div className="mt-4 lg:hidden">
            <ActionPanel state={gameState} onAction={handleAction} onRoll={handleRoll} />
          </div>
        </main>

        <aside className="order-3 hidden lg:block">
          <ActionPanel state={gameState} onAction={handleAction} onRoll={handleRoll} />
        </aside>
      </div>
    </div>
  )
}
