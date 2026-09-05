import type { BoardSpace } from './types'

export const BOARD_SIZE = 28
export const START_BONUS = 2000
export const START_MONEY = 15000
export const JAIL_POSITION = 7
export const GOTO_JAIL_POSITION = 21

export const board: BoardSpace[] = [
  { type: 'start', id: 0, name: '起點' },
  { type: 'property', id: 1, name: '台北車站', price: 600, rent: 200, color: 'brown' },
  { type: 'chance', id: 2, name: '機會' },
  { type: 'property', id: 3, name: '西門町', price: 600, rent: 200, color: 'brown' },
  { type: 'tax', id: 4, name: '所得稅', tax: 500 },
  { type: 'property', id: 5, name: '淡水', price: 1000, rent: 400, color: 'lightblue' },
  { type: 'property', id: 6, name: '基隆', price: 1000, rent: 400, color: 'lightblue' },
  { type: 'jail', id: 7, name: '探監' },
  { type: 'property', id: 8, name: '新竹', price: 1200, rent: 500, color: 'pink' },
  { type: 'chance', id: 9, name: '機會' },
  { type: 'property', id: 10, name: '台中', price: 1200, rent: 500, color: 'pink' },
  { type: 'property', id: 11, name: '彰化', price: 1400, rent: 600, color: 'orange' },
  { type: 'property', id: 12, name: '嘉義', price: 1400, rent: 600, color: 'orange' },
  { type: 'parking', id: 13, name: '免費停車' },
  { type: 'property', id: 14, name: '台南', price: 1600, rent: 800, color: 'red' },
  { type: 'chance', id: 15, name: '機會' },
  { type: 'property', id: 16, name: '高雄', price: 1600, rent: 800, color: 'red' },
  { type: 'property', id: 17, name: '墾丁', price: 1800, rent: 900, color: 'yellow' },
  { type: 'tax', id: 18, name: '奢侈稅', tax: 800 },
  { type: 'property', id: 19, name: '花蓮', price: 1800, rent: 900, color: 'yellow' },
  { type: 'gotojail', id: 20, name: '入獄' },
  { type: 'property', id: 21, name: '宜蘭', price: 2000, rent: 1000, color: 'green' },
  { type: 'chance', id: 22, name: '機會' },
  { type: 'property', id: 23, name: '台東', price: 2000, rent: 1000, color: 'green' },
  { type: 'property', id: 24, name: '101大樓', price: 2400, rent: 1200, color: 'darkblue' },
  { type: 'property', id: 25, name: '信義區', price: 2400, rent: 1200, color: 'darkblue' },
  { type: 'property', id: 26, name: '大安區', price: 2200, rent: 1100, color: 'green' },
  { type: 'property', id: 27, name: '松山區', price: 2200, rent: 1100, color: 'green' },
]

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308']

export const COLOR_MAP: Record<string, string> = {
  brown: '#92400e',
  lightblue: '#38bdf8',
  pink: '#ec4899',
  orange: '#f97316',
  red: '#dc2626',
  yellow: '#eab308',
  green: '#16a34a',
  darkblue: '#1d4ed8',
}

export function getPropertyOwner(
  propertyId: number,
  players: { id: number; properties: number[] }[],
): number | null {
  for (const player of players) {
    if (player.properties.includes(propertyId)) return player.id
  }
  return null
}

export function calcRent(
  space: BoardSpace,
  ownerId: number,
  players: { id: number; properties: number[] }[],
): number {
  if (space.type !== 'property') return 0
  const owner = players.find((p) => p.id === ownerId)
  if (!owner) return space.rent

  const sameColor = board.filter(
    (s) => s.type === 'property' && s.color === space.color,
  ) as Extract<BoardSpace, { type: 'property' }>[]

  const ownsAll = sameColor.every((s) => owner.properties.includes(s.id))
  return ownsAll ? space.rent * 2 : space.rent
}
