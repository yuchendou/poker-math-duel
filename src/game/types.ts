export type PropertyColor =
  | 'brown'
  | 'lightblue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkblue'

export type SpaceType =
  | 'start'
  | 'property'
  | 'chance'
  | 'tax'
  | 'jail'
  | 'parking'
  | 'gotojail'

export interface PropertySpace {
  type: 'property'
  id: number
  name: string
  price: number
  rent: number
  color: PropertyColor
}

export interface SpecialSpace {
  type: Exclude<SpaceType, 'property'>
  id: number
  name: string
  tax?: number
}

export type BoardSpace = PropertySpace | SpecialSpace

export interface Player {
  id: number
  name: string
  color: string
  money: number
  position: number
  properties: number[]
  inJail: boolean
  jailTurns: number
  bankrupt: boolean
}

export type GamePhase =
  | 'setup'
  | 'rolling'
  | 'moving'
  | 'action'
  | 'jail'
  | 'gameover'

export interface PendingAction {
  kind: 'buy' | 'rent' | 'chance' | 'tax' | 'jail' | 'bankrupt'
  message: string
  amount?: number
  propertyId?: number
}

export interface GameState {
  phase: GamePhase
  players: Player[]
  currentPlayerIndex: number
  board: BoardSpace[]
  dice: [number, number] | null
  message: string
  pendingAction: PendingAction | null
  winner: Player | null
  passStartBonus: number
}

export interface ChanceCard {
  text: string
  effect: (state: GameState) => Partial<GameState> & { message: string }
}
