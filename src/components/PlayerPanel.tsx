import type { Player } from '@shared/game/types'
import { board, COLOR_MAP } from '@shared/game/board'

interface PlayerPanelProps {
  players: Player[]
  currentPlayerIndex: number
  myPlayerIndex: number
}

export default function PlayerPanel({
  players,
  currentPlayerIndex,
  myPlayerIndex,
}: PlayerPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {players.map((player, i) => (
        <div
          key={player.id}
          className={`rounded-xl border p-3 transition-all ${
            player.bankrupt
              ? 'border-slate-700 bg-slate-800/50 opacity-50'
              : i === currentPlayerIndex
                ? 'border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-400/20'
                : 'border-slate-600 bg-slate-800/80'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border-2 border-white"
              style={{ backgroundColor: player.color }}
            />
            <span className="font-bold text-white">
              {player.name}
              {i === myPlayerIndex && '（你）'}
              {player.inJail && ' 🔒'}
              {player.bankrupt && ' 💸'}
            </span>
            {i === currentPlayerIndex && !player.bankrupt && (
              <span className="ml-auto text-xs text-amber-400">回合中</span>
            )}
          </div>
          <div className="mt-2 font-mono text-lg font-bold text-emerald-400">
            ${player.money.toLocaleString()}
          </div>
          {player.properties.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {player.properties.map((propId) => {
                const space = board.find((s) => s.id === propId)
                if (!space || space.type !== 'property') return null
                return (
                  <span
                    key={propId}
                    className="rounded px-1.5 py-0.5 text-[10px] text-white"
                    style={{ backgroundColor: COLOR_MAP[space.color] }}
                    title={space.name}
                  >
                    {space.name}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
