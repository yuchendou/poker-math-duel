interface SetupScreenProps {
  playerCount: number
  names: string[]
  onCountChange: (n: number) => void
  onNameChange: (i: number, name: string) => void
  onStart: () => void
}

export default function SetupScreen({
  playerCount,
  names,
  onCountChange,
  onNameChange,
  onStart,
}: SetupScreenProps) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-600/30 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
        <div className="text-center">
          <div className="text-5xl">🎲</div>
          <h1 className="mt-4 text-3xl font-black text-amber-400">大富翁</h1>
          <p className="mt-2 text-slate-400">台灣地產大亨 — 成為最富有的玩家！</p>
        </div>

        <div className="mt-8">
          <label className="block text-sm font-medium text-slate-300">玩家人數</label>
          <div className="mt-2 flex gap-2">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onCountChange(n)}
                className={`flex-1 rounded-lg py-2 font-bold transition ${
                  playerCount === n
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {n} 人
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {names.slice(0, playerCount).map((name, i) => (
            <div key={i}>
              <label className="block text-sm text-slate-400">玩家 {i + 1}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(i, e.target.value)}
                placeholder={`玩家 ${i + 1}`}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-lg font-bold text-slate-900 shadow-lg transition hover:from-amber-400 hover:to-orange-400"
        >
          開始遊戲
        </button>

        <div className="mt-6 rounded-lg bg-slate-800/50 p-4 text-xs text-slate-400">
          <p className="font-bold text-slate-300">遊戲規則</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>每位玩家起始資金 $15,000</li>
            <li>經過起點領取 $2,000</li>
            <li>購買地產，向其他玩家收租</li>
            <li>擁有同色全部地產，租金加倍</li>
            <li>破產者出局，最後倖存者獲勝</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
