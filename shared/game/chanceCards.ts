import { BOARD_SIZE, START_BONUS } from './board'
import type { ChanceCard, GameState } from './types'

function movePlayer(state: GameState, steps: number): GameState {
  const players = [...state.players]
  const current = { ...players[state.currentPlayerIndex] }
  const oldPos = current.position
  const newPos = (oldPos + steps + BOARD_SIZE) % BOARD_SIZE
  current.position = newPos

  if (steps > 0 && newPos < oldPos) {
    current.money += state.passStartBonus
  }

  players[state.currentPlayerIndex] = current
  return { ...state, players }
}

export const chanceCards: ChanceCard[] = [
  {
    text: '銀行誤匯，獲得 $800！',
    effect: (state) => {
      const players = [...state.players]
      const p = { ...players[state.currentPlayerIndex] }
      p.money += 800
      players[state.currentPlayerIndex] = p
      return { players, message: `${p.name} 獲得 $800` }
    },
  },
  {
    text: '中獎了！獲得 $1200！',
    effect: (state) => {
      const players = [...state.players]
      const p = { ...players[state.currentPlayerIndex] }
      p.money += 1200
      players[state.currentPlayerIndex] = p
      return { players, message: `${p.name} 中獎獲得 $1200` }
    },
  },
  {
    text: '繳交罰款 $500',
    effect: (state) => {
      const players = [...state.players]
      const p = { ...players[state.currentPlayerIndex] }
      p.money = Math.max(0, p.money - 500)
      players[state.currentPlayerIndex] = p
      return { players, message: `${p.name} 繳交罰款 $500` }
    },
  },
  {
    text: '前進 3 格',
    effect: (state) => {
      const next = movePlayer(state, 3)
      return { ...next, message: `${state.players[state.currentPlayerIndex].name} 前進 3 格` }
    },
  },
  {
    text: '後退 2 格',
    effect: (state) => {
      const next = movePlayer(state, -2)
      return { ...next, message: `${state.players[state.currentPlayerIndex].name} 後退 2 格` }
    },
  },
  {
    text: '直接回到起點，領取 $2000',
    effect: (state) => {
      const players = [...state.players]
      const p = { ...players[state.currentPlayerIndex] }
      p.position = 0
      p.money += START_BONUS
      players[state.currentPlayerIndex] = p
      return { players, message: `${p.name} 回到起點，領取 $${START_BONUS}` }
    },
  },
  {
    text: '免費修繕房屋，支付 $300',
    effect: (state) => {
      const players = [...state.players]
      const p = { ...players[state.currentPlayerIndex] }
      p.money = Math.max(0, p.money - 300)
      players[state.currentPlayerIndex] = p
      return { players, message: `${p.name} 支付修繕費 $300` }
    },
  },
  {
    text: '生日快樂！每位玩家給你 $200',
    effect: (state) => {
      const players = state.players.map((pl) => ({ ...pl }))
      const current = players[state.currentPlayerIndex]
      let total = 0
      players.forEach((pl, i) => {
        if (i !== state.currentPlayerIndex && !pl.bankrupt) {
          const pay = Math.min(200, pl.money)
          pl.money -= pay
          total += pay
        }
      })
      current.money += total
      return { players, message: `${current.name} 收到生日紅包共 $${total}` }
    },
  },
]

export function drawChanceCard(): ChanceCard {
  return chanceCards[Math.floor(Math.random() * chanceCards.length)]
}
