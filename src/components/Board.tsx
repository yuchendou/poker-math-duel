import { BOARD_SIZE, COLOR_MAP } from '@shared/game/board'
import type { BoardSpace, Player } from '@shared/game/types'

interface BoardProps {
  spaces: BoardSpace[]
  players: Player[]
}

function SpaceCell({
  space,
  players,
  rotation = 0,
}: {
  space: BoardSpace
  players: Player[]
  rotation?: number
}) {
  const occupants = players.filter((p) => !p.bankrupt && p.position === space.id)
  const isProperty = space.type === 'property'

  return (
    <div
      className={`relative flex flex-col border border-slate-600 bg-slate-800 overflow-hidden
        ${isProperty ? 'min-h-[72px]' : 'min-h-[72px] justify-center items-center'}`}
      style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
    >
      {isProperty && (
        <div
          className="h-3 w-full shrink-0"
          style={{ backgroundColor: COLOR_MAP[space.color] }}
        />
      )}
      <div
        className="flex flex-1 flex-col items-center justify-center p-1 text-center"
        style={{ transform: rotation ? `rotate(${-rotation}deg)` : undefined }}
      >
        <span className="text-[10px] font-bold leading-tight text-white sm:text-xs">
          {space.name}
        </span>
        {isProperty && (
          <span className="text-[9px] text-slate-300">${space.price}</span>
        )}
        {space.type === 'tax' && (
          <span className="text-[9px] text-red-400">${space.tax}</span>
        )}
      </div>
      {occupants.length > 0 && (
        <div
          className="absolute bottom-0.5 left-0.5 flex gap-0.5"
          style={{ transform: rotation ? `rotate(${-rotation}deg)` : undefined }}
        >
          {occupants.map((p) => (
            <div
              key={p.id}
              className="h-3 w-3 rounded-full border border-white shadow"
              style={{ backgroundColor: p.color }}
              title={p.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CenterLogo({ roomCode }: { roomCode?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-red-600/20 p-4 text-center">
      <div className="text-4xl">🎲</div>
      <h1 className="mt-2 text-xl font-black text-amber-400 sm:text-2xl">大富翁</h1>
      <p className="mt-1 text-xs text-slate-400">線上雙人對戰</p>
      {roomCode && (
        <p className="mt-2 font-mono text-sm tracking-widest text-slate-300">{roomCode}</p>
      )}
    </div>
  )
}

export default function Board({
  spaces,
  players,
  roomCode,
}: BoardProps & { roomCode?: string }) {
  const bottom = spaces.slice(0, 7)
  const right = spaces.slice(7, 14)
  const top = spaces.slice(14, 21).reverse()
  const left = spaces.slice(21, 28).reverse()

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div
        className="grid gap-0 rounded-xl border-2 border-amber-600/50 bg-slate-900 p-1 shadow-2xl"
        style={{
          gridTemplateColumns: 'repeat(9, 1fr)',
          gridTemplateRows: 'repeat(9, minmax(0, 1fr))',
        }}
      >
        {top.map((space, i) => (
          <div key={space.id} style={{ gridColumn: i + 2, gridRow: 1 }}>
            <SpaceCell space={space} players={players} rotation={180} />
          </div>
        ))}

        {left.map((space, i) => (
          <div key={space.id} style={{ gridColumn: 1, gridRow: i + 2 }}>
            <SpaceCell space={space} players={players} rotation={90} />
          </div>
        ))}

        <div
          className="overflow-hidden rounded-lg"
          style={{ gridColumn: '2 / 9', gridRow: '2 / 9' }}
        >
          <CenterLogo roomCode={roomCode} />
        </div>

        {right.map((space, i) => (
          <div key={space.id} style={{ gridColumn: 9, gridRow: i + 2 }}>
            <SpaceCell space={space} players={players} rotation={-90} />
          </div>
        ))}

        {bottom.map((space, i) => (
          <div key={space.id} style={{ gridColumn: i + 1, gridRow: 9 }}>
            <SpaceCell space={space} players={players} />
          </div>
        ))}
      </div>
    </div>
  )
}

export { BOARD_SIZE }
