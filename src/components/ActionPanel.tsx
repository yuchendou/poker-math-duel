import type { GameState } from '../game/types'
import {
  applyChanceCard,
  buyProperty,
  payJailBail,
  payRent,
  payTax,
  skipBuy,
} from '../game/gameLogic'

interface ActionPanelProps {
  state: GameState
  onAction: (state: GameState) => void
  onRoll: () => void
}

export default function ActionPanel({ state, onAction, onRoll }: ActionPanelProps) {
  const current = state.players[state.currentPlayerIndex]
  const canRoll = (state.phase === 'rolling' || state.phase === 'jail') && !current.bankrupt

  return (
    <div className="rounded-xl border border-slate-600 bg-slate-800/90 p-4">
      {/* Dice display */}
      {state.dice && (
        <div className="mb-4 flex justify-center gap-3">
          {state.dice.map((d, i) => (
            <div
              key={i}
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-2xl font-black text-slate-900 shadow-lg"
            >
              {d}
            </div>
          ))}
        </div>
      )}

      {/* Message */}
      <p className="mb-4 text-center text-sm text-slate-200">{state.message}</p>

      {/* Roll button */}
      {canRoll && !state.pendingAction && (
        <button
          type="button"
          onClick={onRoll}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-lg font-bold text-white shadow-lg transition hover:from-emerald-400 hover:to-teal-400"
        >
          🎲 擲骰子
        </button>
      )}

      {/* Jail bail */}
      {current.inJail && state.phase === 'rolling' && (
        <button
          type="button"
          onClick={() => onAction(payJailBail(state))}
          disabled={current.money < 500}
          className="mt-2 w-full rounded-xl border border-amber-500/50 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-40"
        >
          支付 $500 保釋金出獄
        </button>
      )}

      {/* Pending actions */}
      {state.pendingAction && (
        <div className="space-y-2">
          <p className="text-center text-amber-300">{state.pendingAction.message}</p>

          {state.pendingAction.kind === 'buy' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onAction(buyProperty(state))}
                disabled={current.money < (state.pendingAction.amount ?? 0)}
                className="flex-1 rounded-lg bg-amber-500 py-2 font-bold text-slate-900 disabled:opacity-40"
              >
                購買 ${state.pendingAction.amount}
              </button>
              <button
                type="button"
                onClick={() => onAction(skipBuy(state))}
                className="flex-1 rounded-lg bg-slate-600 py-2 font-medium text-white hover:bg-slate-500"
              >
                放棄
              </button>
            </div>
          )}

          {state.pendingAction.kind === 'rent' && (
            <button
              type="button"
              onClick={() => onAction(payRent(state))}
              className="w-full rounded-lg bg-red-500 py-2 font-bold text-white hover:bg-red-400"
            >
              支付租金 ${state.pendingAction.amount}
            </button>
          )}

          {state.pendingAction.kind === 'tax' && (
            <button
              type="button"
              onClick={() => onAction(payTax(state))}
              className="w-full rounded-lg bg-red-500 py-2 font-bold text-white hover:bg-red-400"
            >
              繳稅 ${state.pendingAction.amount}
            </button>
          )}

          {state.pendingAction.kind === 'chance' && (
            <button
              type="button"
              onClick={() => onAction(applyChanceCard(state))}
              className="w-full rounded-lg bg-purple-500 py-2 font-bold text-white hover:bg-purple-400"
            >
              翻開機會卡
            </button>
          )}
        </div>
      )}

      {/* Game over */}
      {state.phase === 'gameover' && state.winner && (
        <div className="text-center">
          <div className="text-4xl">🏆</div>
          <p className="mt-2 text-xl font-bold text-amber-400">{state.winner.name} 獲勝！</p>
        </div>
      )}
    </div>
  )
}
