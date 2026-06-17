interface Props {
  progress: number   // 0–1, how much has elapsed
  remaining: number  // seconds
  total: number      // seconds
  paused: boolean
}

export default function CircularTimer({ progress, remaining, total, paused }: Props) {
  const size = 280
  const stroke = 8
  const r = (size - stroke * 2) / 2
  const circumference = 2 * Math.PI * r
  const elapsed = circumference * progress
  const cx = size / 2
  const cy = size / 2

  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  const pct = Math.round(progress * 100)
  const totalMin = Math.round(total / 60)

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4a3a2a" strokeWidth={stroke} />
        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={paused ? '#a87a2c' : '#e8b855'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - elapsed}
          style={{ transition: 'stroke-dashoffset 0.5s linear' }}
        />
      </svg>

      {/* Centre text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: 36, fontWeight: 700, color: '#f5e7d3', fontFamily: 'Consolas, monospace', letterSpacing: 2 }}>
          {timeStr}
        </span>
        <span style={{ fontSize: 12, color: '#8a7560', marginTop: 6, letterSpacing: '0.08em' }}>
          {pct}%  OF  {totalMin} MIN
        </span>
        {paused && (
          <span style={{ fontSize: 11, color: '#e8b855', marginTop: 4, fontStyle: 'italic' }}>paused</span>
        )}
      </div>
    </div>
  )
}
