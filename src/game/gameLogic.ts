import {
  BOARD_SIZE,
  JAIL_POSITION,
  START_BONUS,
  START_MONEY,
  board,
  calcRent,
  getPropertyOwner,
  PLAYER_COLORS,
} from './board'
import { drawChanceCard } from './chanceCards'
import type {
  GameState,
  PendingAction,
  Player,
} from './types'

export function createInitialState(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((name, i) => ({
    id: i,
    name: name.trim() || `玩家 ${i + 1}`,
    color: PLAYER_COLORS[i],
    money: START_MONEY,
    position: 0,
    properties: [],
    inJail: false,
    jailTurns: 0,
    bankrupt: false,
  }))

  return {
    phase: 'rolling',
    players,
    currentPlayerIndex: 0,
    board,
    dice: null,
    message: `${players[0].name} 的回合，請擲骰子！`,
    pendingAction: null,
    winner: null,
    passStartBonus: START_BONUS,
  }
}

function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.bankrupt)
}

function nextPlayerIndex(state: GameState): number {
  const total = state.players.length
  let idx = state.currentPlayerIndex
  for (let i = 0; i < total; i++) {
    idx = (idx + 1) % total
    if (!state.players[idx].bankrupt) return idx
  }
  return state.currentPlayerIndex
}

function checkWinner(state: GameState): GameState {
  const alive = activePlayers(state.players)
  if (alive.length === 1) {
    return {
      ...state,
      phase: 'gameover',
      winner: alive[0],
      message: `🎉 ${alive[0].name} 獲勝！成為大富翁！`,
    }
  }
  return state
}

function endTurn(state: GameState, message?: string): GameState {
  const nextIdx = nextPlayerIndex(state)
  const next = state.players[nextIdx]
  const nextState: GameState = {
    ...state,
    phase: 'rolling',
    currentPlayerIndex: nextIdx,
    dice: null,
    pendingAction: null,
    message: message ?? `${next.name} 的回合，請擲骰子！`,
  }
  return checkWinner(nextState)
}

function setPending(state: GameState, action: PendingAction): GameState {
  return { ...state, phase: 'action', pendingAction: action }
}

function moveCurrentPlayer(state: GameState, steps: number): GameState {
  const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
  const current = players[state.currentPlayerIndex]
  const oldPos = current.position
  const newPos = (oldPos + steps + BOARD_SIZE) % BOARD_SIZE
  current.position = newPos

  if (steps > 0 && newPos < oldPos) {
    current.money += state.passStartBonus
  }

  return { ...state, players, phase: 'moving' }
}

function handleLanding(state: GameState): GameState {
  const current = state.players[state.currentPlayerIndex]
  const space = state.board[current.position]

  switch (space.type) {
    case 'start':
      return endTurn(state, `${current.name} 經過起點，領取 $${state.passStartBonus}！`)

    case 'property': {
      const ownerId = getPropertyOwner(space.id, state.players)
      if (ownerId === null) {
        return setPending(state, {
          kind: 'buy',
          message: `${space.name} 待售！價格 $${space.price}，是否要購買？`,
          amount: space.price,
          propertyId: space.id,
        })
      }
      if (ownerId === current.id) {
        return endTurn(state, `${current.name} 抵達自己的 ${space.name}`)
      }
      const rent = calcRent(space, ownerId, state.players)
      const owner = state.players.find((p) => p.id === ownerId)!
      return setPending(state, {
        kind: 'rent',
        message: `${current.name} 需向 ${owner.name} 支付 ${space.name} 租金 $${rent}`,
        amount: rent,
        propertyId: space.id,
      })
    }

    case 'chance':
      return setPending(state, {
        kind: 'chance',
        message: `${current.name} 抽到機會卡！`,
      })

    case 'tax':
      return setPending(state, {
        kind: 'tax',
        message: `${current.name} 需繳交 ${space.name} $${space.tax}`,
        amount: space.tax,
      })

    case 'jail':
      return endTurn(state, `${current.name} 探監中，純粹路過`)

    case 'parking':
      return endTurn(state, `${current.name} 在免費停車區休息`)

    case 'gotojail': {
      const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
      const p = players[state.currentPlayerIndex]
      p.position = JAIL_POSITION
      p.inJail = true
      p.jailTurns = 0
      return endTurn(
        { ...state, players },
        `${p.name} 入獄！被送到探監區`,
      )
    }

    default:
      return endTurn(state)
  }
}

export function rollDice(state: GameState): GameState {
  if (state.phase !== 'rolling' && state.phase !== 'jail') return state

  const current = state.players[state.currentPlayerIndex]
  const d1 = Math.floor(Math.random() * 6) + 1
  const d2 = Math.floor(Math.random() * 6) + 1
  const total = d1 + d2
  const isDouble = d1 === d2

  if (current.inJail) {
    const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
    const p = players[state.currentPlayerIndex]

    if (isDouble) {
      p.inJail = false
      p.jailTurns = 0
      const moved = moveCurrentPlayer({ ...state, players, dice: [d1, d2] }, total)
      return handleLanding({
        ...moved,
        message: `${p.name} 擲出雙骰 ${d1}+${d2}=${total}，出獄！`,
      })
    }

    p.jailTurns += 1
    if (p.jailTurns >= 3) {
      p.inJail = false
      p.jailTurns = 0
      p.money = Math.max(0, p.money - 500)
      const moved = moveCurrentPlayer({ ...state, players, dice: [d1, d2] }, total)
      return handleLanding({
        ...moved,
        message: `${p.name} 擲出 ${d1}+${d2}=${total}，交 $500 保釋金出獄`,
      })
    }

    const next = endTurn(
      { ...state, players, dice: [d1, d2] },
      `${p.name} 仍在監獄（${p.jailTurns}/3），擲出 ${d1}+${d2}`,
    )
    return next
  }

  const moved = moveCurrentPlayer({ ...state, dice: [d1, d2] }, total)
  return handleLanding({
    ...moved,
    message: `${current.name} 擲出 ${d1} + ${d2} = ${total}，前進 ${total} 格`,
  })
}

export function buyProperty(state: GameState): GameState {
  const action = state.pendingAction
  if (!action || action.kind !== 'buy' || action.propertyId === undefined) return state

  const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
  const current = players[state.currentPlayerIndex]
  const price = action.amount ?? 0

  if (current.money < price) {
    return endTurn(state, `${current.name} 資金不足，無法購買`)
  }

  current.money -= price
  current.properties.push(action.propertyId)
  const space = state.board[current.position]
  const name = space.type === 'property' ? space.name : '地產'
  return endTurn(
    { ...state, players },
    `${current.name} 購買 ${name}，花費 $${price}`,
  )
}

export function skipBuy(state: GameState): GameState {
  return endTurn(state, `${state.players[state.currentPlayerIndex].name} 放棄購買`)
}

function payAmount(state: GameState, amount: number, recipientId?: number): GameState {
  const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
  const current = players[state.currentPlayerIndex]

  if (current.money < amount) {
    current.bankrupt = true
    current.money = 0
    if (recipientId !== undefined) {
      const recipient = players.find((p) => p.id === recipientId)!
      recipient.money += current.money
      current.properties.forEach((propId) => {
        if (!recipient.properties.includes(propId)) {
          recipient.properties.push(propId)
        }
      })
      current.properties = []
    }
    return checkWinner(
      endTurn(
        { ...state, players },
        `💸 ${current.name} 破產了！`,
      ),
    )
  }

  current.money -= amount
  if (recipientId !== undefined) {
    const recipient = players.find((p) => p.id === recipientId)!
    recipient.money += amount
  }

  return { ...state, players }
}

export function payRent(state: GameState): GameState {
  const action = state.pendingAction
  if (!action || action.kind !== 'rent' || action.propertyId === undefined) return state

  const ownerId = getPropertyOwner(action.propertyId, state.players)!
  const paid = payAmount(state, action.amount ?? 0, ownerId)
  const current = paid.players[state.currentPlayerIndex]
  if (current.bankrupt) return paid
  return endTurn(paid, `${current.name} 支付租金 $${action.amount}`)
}

export function payTax(state: GameState): GameState {
  const action = state.pendingAction
  if (!action || action.kind !== 'tax') return state

  const paid = payAmount(state, action.amount ?? 0)
  const current = paid.players[state.currentPlayerIndex]
  if (current.bankrupt) return paid
  return endTurn(paid, `${current.name} 繳稅 $${action.amount}`)
}

export function applyChanceCard(state: GameState): GameState {
  const card = drawChanceCard()
  const result = card.effect(state)
  const merged: GameState = {
    ...state,
    ...result,
    pendingAction: null,
    phase: 'rolling',
  }

  const current = merged.players[merged.currentPlayerIndex]
  const space = merged.board[current.position]

  if (space.type === 'property') {
    const ownerId = getPropertyOwner(space.id, merged.players)
    if (ownerId === null) {
      return setPending(merged, {
        kind: 'buy',
        message: `機會卡後抵達 ${space.name}，價格 $${space.price}，是否購買？`,
        amount: space.price,
        propertyId: space.id,
      })
    }
    if (ownerId !== current.id) {
      const rent = calcRent(space, ownerId, merged.players)
      const owner = merged.players.find((p) => p.id === ownerId)!
      return setPending(merged, {
        kind: 'rent',
        message: `需向 ${owner.name} 支付 ${space.name} 租金 $${rent}`,
        amount: rent,
        propertyId: space.id,
      })
    }
  }

  if (space.type === 'tax') {
    return setPending(merged, {
      kind: 'tax',
      message: `需繳交 ${space.name} $${space.tax}`,
      amount: space.tax,
    })
  }

  return endTurn(merged, result.message)
}

export function payJailBail(state: GameState): GameState {
  const players = state.players.map((p) => ({ ...p, properties: [...p.properties] }))
  const current = players[state.currentPlayerIndex]
  if (!current.inJail || current.money < 500) return state

  current.money -= 500
  current.inJail = false
  current.jailTurns = 0
  return {
    ...state,
    players,
    phase: 'rolling',
    message: `${current.name} 支付 $500 保釋金，可以擲骰了`,
  }
}
