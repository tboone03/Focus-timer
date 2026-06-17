import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sidecar, backend, SidecarStatus, FriendStatus, LeaderboardEntry, RunningApp } from '../api'
import { useAuth } from '../AuthContext'
import { useWebSocket } from '../WebSocketContext'
import SidebarLayout from '../components/SidebarLayout'

// ── constants ──────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Deep Work', mins: 50, note: 'a long, quiet stretch',    isBreak: false },
  { label: 'Pomodoro',  mins: 25, note: 'a single pomodoro',        isBreak: false },
  { label: 'Marathon',  mins: 90, note: 'one full ultradian cycle',  isBreak: false },
  { label: 'Short Rest',mins: 5,  note: 'tea, stretch, look away',  isBreak: true  },
]

const TONE_COLORS: Record<string, string> = {
  a:'#9a6f9c', b:'#6c86a8', c:'#b6694f', d:'#7c3b33',
  e:'#a6ad63', f:'#6f8f6a', g:'#c98a52', h:'#8a4038',
  i:'#9a6f9c', j:'#6c86a8', k:'#b6694f', l:'#a6ad63',
  m:'#9a5b50', n:'#6f8f6a', o:'#c98a52', p:'#7c3b33',
  q:'#6c86a8', r:'#a6ad63', s:'#6c86a8', t:'#6f8f6a',
  u:'#b6694f', v:'#9a6f9c', w:'#c98a52', x:'#8a4038',
  y:'#a6ad63', z:'#6c86a8',
}
function toneColor(s: string): string {
  return TONE_COLORS[s[0].toLowerCase()] || '#9a5b50'
}

function tint(hex: string, amt: number): string {
  const n = parseInt(hex.replace('#',''), 16)
  const r = Math.min(255, (n >> 16) + amt)
  const g = Math.min(255, ((n >> 8) & 255) + amt)
  const b = Math.min(255, (n & 255) + amt)
  return `rgb(${r},${g},${b})`
}
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.replace('#',''), 16)
  return `rgba(${(n >> 16)},${((n >> 8) & 255)},${(n & 255)},${a})`
}

const pad = (n: number) => String(n).padStart(2, '0')
function fmtCountdown(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
function fmtElapsed(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
function greeting(name: string) {
  const h = new Date().getHours()
  const period = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
  return `Good ${period}, ${name}`
}

// ── NookPrefs ────────────────────────────────────────────────────────────────

interface NookPrefs {
  lamp: string; warmth: number; wall: string; wood: string; window: string
  items: Record<string, boolean>
}
function loadNook(): NookPrefs {
  const D: NookPrefs = {
    lamp: '#f0a94e', warmth: 0.8, wall: '#241a0f', wood: '#3a2817',
    window: 'rain', items: { plant: true, candle: true, books: true, mug: false, vinyl: false, cat: false }
  }
  try {
    const s = JSON.parse(localStorage.getItem('lamplight_nook') || '{}')
    return { ...D, ...s, items: { ...D.items, ...(s.items || {}) }, warmth: s.warmth > 1 ? s.warmth / 100 : (s.warmth ?? D.warmth) }
  } catch { return D }
}

// ── Room Scene ───────────────────────────────────────────────────────────────

const ITEM_SVGS: Record<string, string> = {
  plant: `<svg width="56" height="76" viewBox="0 0 56 76"><g fill="none" stroke="#7e9a5e" stroke-width="3" stroke-linecap="round"><path d="M28 50C28 34 18 26 12 22"/><path d="M28 50C28 32 38 24 46 22"/><path d="M28 50C28 38 28 28 28 16"/></g><g fill="#8aa766"><path d="M12 22c-7-3-10 4-10 4s7 4 11 1Z"/><path d="M46 22c7-3 10 4 10 4s-7 4-11 1Z"/><path d="M28 16c-4-6 2-12 2-12s5 7 1 12Z"/></g><path d="M16 50h24l-3 18a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3Z" fill="#9a5b3a"/><path d="M16 50h24l-1 6H17Z" fill="#7c4830"/></svg>`,
  candle: `<svg width="34" height="74" viewBox="0 0 34 74"><ellipse cx="17" cy="14" rx="9" ry="3" fill="#e0892f" opacity=".25"/><g class="r-flame"><path d="M17 2c4 5 5 9 0 14-5-5-4-9 0-14Z" fill="#ffd98a"/><path d="M17 6c2 3 2 6 0 9-2-3-2-6 0-9Z" fill="#e0892f"/></g><rect x="11" y="22" width="12" height="34" rx="3" fill="#efe2c4"/><path d="M11 24c4 2 8 2 12 0v4c-4 2-8 2-12 0Z" fill="#d8c8a0"/><path d="M8 56h18l-2 12a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3Z" fill="#7a5a2e"/></svg>`,
  books: `<svg width="60" height="56" viewBox="0 0 60 56"><rect x="6" y="40" width="48" height="12" rx="2" fill="#7c3b33"/><rect x="6" y="40" width="6" height="12" fill="#5e2a24"/><rect x="10" y="28" width="42" height="12" rx="2" fill="#6f8f6a"/><rect x="10" y="28" width="6" height="12" fill="#557252"/><rect x="14" y="16" width="40" height="12" rx="2" fill="#c98a52"/><rect x="14" y="16" width="6" height="12" fill="#a76f3c"/><rect x="20" y="6" width="22" height="10" rx="2" fill="#6c86a8" transform="rotate(-6 31 11)"/></svg>`,
  mug: `<svg width="48" height="48" viewBox="0 0 48 48"><path d="M19 8c0 4 0 4-2 8M27 8c0 4 0 4-2 8" stroke="#cbbfa6" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/><path d="M8 20h26v12a8 8 0 0 1-8 8H16a8 8 0 0 1-8-8Z" fill="#9a5b50"/><path d="M34 22h4a6 6 0 0 1 0 12h-4" fill="none" stroke="#9a5b50" stroke-width="4"/><ellipse cx="21" cy="20" rx="13" ry="3" fill="#3a2a18"/></svg>`,
}

function RoomScene({ active }: { active: boolean }) {
  const nook = loadNook()
  const w = nook.warmth
  const wallBg = `linear-gradient(180deg, ${tint(nook.wall, 16)}, ${nook.wall})`
  const deskBg = `linear-gradient(180deg, ${tint(nook.wood, 26)}, ${nook.wood} 60%, ${tint(nook.wood, -14)})`
  const shadeBg = `linear-gradient(175deg, ${tint(nook.lamp, 30)}, ${tint(nook.lamp, -30)} 55%, ${tint(nook.lamp, -60)})`
  const glowBg = `radial-gradient(50% 70% at 16% 12%, ${hexA(nook.lamp, 0.5 * w)}, transparent 62%)`
  const glowOpacity = 0.4 + w * 0.6
  const weatherCls = nook.window !== 'clear' ? `r-weather w-${nook.window}` : 'r-weather'

  return (
    <div className="r-scene">
      <div className="r-wall" style={{ background: wallBg }} />
      <div className="r-window">
        <div className="r-moon" />
        <div className={weatherCls} />
      </div>
      <div className="r-lampglow" style={{ background: glowBg, opacity: glowOpacity }} />
      <div className="r-desk" style={{ background: deskBg }} />
      <div className="r-lamp">
        <div className="arm" />
        <div className="shade" style={{ background: shadeBg }} />
      </div>
      <div className="r-desk-items">
        {Object.entries(nook.items).map(([key, on]) =>
          ITEM_SVGS[key] ? (
            <div key={key} className={`r-desk-item${on ? ' on' : ''}`}
              dangerouslySetInnerHTML={{ __html: ITEM_SVGS[key] }} />
          ) : null
        )}
      </div>
    </div>
  )
}

// ── AllowChip ────────────────────────────────────────────────────────────────

function AllowChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const c = toneColor(label)
  return (
    <span className="ll-a-chip">
      <span className="ll-a-ic" style={{ background: `radial-gradient(circle at 34% 30%, ${tint(c,34)}, ${c})` }}>
        {label[0].toUpperCase()}
      </span>
      {label.length > 14 ? label.slice(0, 13) + '…' : label}
      <button className="ll-a-x" onClick={onRemove} title="Remove">×</button>
    </span>
  )
}

// ── FriendMiniRow ────────────────────────────────────────────────────────────

function FriendMiniRow({ f }: { f: FriendStatus }) {
  const elapsed0 = f.totalSeconds - f.remainingSeconds
  const [s, setS] = useState(elapsed0)
  useEffect(() => {
    if (f.sessionState !== 'active') return
    const id = setInterval(() => setS(v => v + 1), 1000)
    return () => clearInterval(id)
  }, [f.sessionState])
  const c = toneColor(f.username)
  return (
    <div className="ll-mini-row">
      <div className="ll-av-ring">
        <div className="ll-av sm" style={{ background: `radial-gradient(circle at 32% 28%, ${tint(c,28)}, ${c})` }}>
          {f.username[0].toUpperCase()}
        </div>
        {f.sessionState === 'active' ? <div className="ll-av-pulse" /> : <div className="ll-av-dot-off" />}
      </div>
      <div>
        <div className="ll-mini-nm">{f.username}</div>
        <div className="ll-mini-task">in session</div>
      </div>
      <div className="ll-mini-t">{fmtElapsed(s)}</div>
    </div>
  )
}

// ── LeaderboardMiniRow ───────────────────────────────────────────────────────

function LeaderboardMiniRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const c = toneColor(entry.username)
  const medalClass = rank === 1 ? 'll-medal ll-m1' : rank === 2 ? 'll-medal ll-m2' : rank === 3 ? 'll-medal ll-m3' : undefined
  return (
    <div className="ll-mini-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {medalClass
          ? <div className={medalClass}>{rank}</div>
          : <div style={{ width: 26, textAlign: 'center', fontFamily: 'var(--ll-mono)', fontSize: 12, color: 'var(--ll-ink-faint)' }}>{rank}</div>
        }
        <div className="ll-av sm" style={{ background: `radial-gradient(circle at 32% 28%, ${tint(c,28)}, ${c})` }}>
          {entry.username[0].toUpperCase()}
        </div>
      </div>
      <div className="ll-mini-nm">{entry.username}</div>
      <div className="ll-mini-t">{entry.xpTotal.toLocaleString()}</div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function TimerView() {
  const { username, userId } = useAuth()
  const navigate = useNavigate()
  const { subscribe } = useWebSocket()

  // sidecar state
  const [status, setStatus]       = useState<SidecarStatus | null>(null)
  const [connected, setConnected] = useState(false)
  const [whitelist, setWhitelist] = useState<string[]>([])

  // timer UI state
  const [presetIdx, setPresetIdx] = useState(0)

  // give-up hold
  const [giveUpHeld, setGiveUpHeld]   = useState(false)
  const holdTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdCountIntervalRef          = useRef<ReturnType<typeof setInterval> | null>(null)
  const [holdCount, setHoldCount]     = useState(3)

  // social
  const [friends, setFriends]     = useState<FriendStatus[]>([])
  const [board, setBoard]         = useState<LeaderboardEntry[]>([])
  const [socialOffline, setSocialOffline] = useState(false)

  // toast
  const [toast, setToast] = useState<string | null>(null)
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // allow modal
  const [showModal, setShowModal]     = useState(false)
  const [modalTab, setModalTab]       = useState<'apps' | 'sites'>('apps')
  const [runningApps, setRunningApps] = useState<RunningApp[]>([])
  const [appSearch, setAppSearch]     = useState('')
  const [appsLoading, setAppsLoading] = useState(false)
  const [siteInput, setSiteInput]     = useState('')

  // ── effects ──────────────────────────────────────────────────────────────

  const pollSidecar = useCallback(async () => {
    try {
      const { data } = await sidecar.get<SidecarStatus>('/status')
      setStatus(data)
      setConnected(true)
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    pollSidecar()
    const id = setInterval(pollSidecar, 1000)
    return () => clearInterval(id)
  }, [pollSidecar])

  useEffect(() => {
    if (!connected) return
    sidecar.get<{ whitelist: string[] }>('/whitelist')
      .then(r => setWhitelist(r.data.whitelist))
      .catch(() => {})
  }, [connected])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [fr, lb] = await Promise.all([
          backend.get<FriendStatus[]>('/api/friends/status'),
          backend.get<LeaderboardEntry[]>('/api/leaderboard/friends'),
        ])
        if (!cancelled) { setFriends(fr.data); setBoard(lb.data); setSocialOffline(false) }
      } catch {
        if (!cancelled) setSocialOffline(true)
      }
    }
    load()
    // Fallback poll — WebSocket handles instant updates
    const id = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // Real-time: friend status changes on the peek panel
  useEffect(() => {
    if (!userId) return
    return subscribe(`/topic/friends/${userId}`, (body) => {
      const update = body as FriendStatus
      setFriends(prev => {
        const idx = prev.findIndex(f => f.userId === update.userId)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], ...update }
        return next
      })
    })
  }, [userId, subscribe])

  // ── session actions ───────────────────────────────────────────────────────

  async function handleStart() {
    if (!connected) {
      showToast('Focus Shield is niet actief — sidecar niet gevonden. Sessie loopt zonder blokkering.')
      return
    }
    const preset = PRESETS[presetIdx]
    const sessionMode = preset.isBreak ? 'soft' : 'strict'
    await sidecar.post('/start', { minutes: preset.mins, mode: sessionMode })
    pollSidecar()
  }

  async function handlePause() {
    if (!status?.token) return
    await sidecar.post('/pause', {}, { headers: { 'X-Focus-Token': status.token } })
    pollSidecar()
  }

  function startGiveUpHold() {
    setGiveUpHeld(true); setHoldCount(3)
    const start = Date.now()
    holdCountIntervalRef.current = setInterval(() => {
      setHoldCount(Math.max(0, 3 - Math.floor((Date.now() - start) / 1000)))
    }, 200)
    holdTimerRef.current = setTimeout(async () => {
      clearInterval(holdCountIntervalRef.current!)
      setGiveUpHeld(false)
      if (!status?.token) return
      await sidecar.post('/stop', { aborted: true }, { headers: { 'X-Focus-Token': status.token } })
      pollSidecar()
    }, 3000)
  }

  function releaseGiveUp() {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null }
    if (holdCountIntervalRef.current) { clearInterval(holdCountIntervalRef.current); holdCountIntervalRef.current = null }
    setGiveUpHeld(false); setHoldCount(3)
  }

  // ── allow-list helpers ────────────────────────────────────────────────────

  async function addEntry(entry: string) {
    const { data } = await sidecar.post<{ whitelist: string[] }>('/whitelist/add', { entry: entry.toLowerCase().trim() })
    setWhitelist(data.whitelist)
  }

  async function removeEntry(entry: string) {
    const { data } = await sidecar.post<{ whitelist: string[] }>('/whitelist/remove', { entry })
    setWhitelist(data.whitelist)
  }

  async function openModal() {
    setShowModal(true); setModalTab('apps'); setAppSearch(''); setAppsLoading(true)
    try {
      const { data } = await sidecar.get<{ apps: RunningApp[] }>('/running-apps')
      setRunningApps(data.apps)
    } catch { setRunningApps([]) }
    finally { setAppsLoading(false) }
  }

  function handleAddSite(e: React.FormEvent) {
    e.preventDefault()
    let d = siteInput.trim().toLowerCase()
    if (!d) return
    if (!d.startsWith('http://') && !d.startsWith('https://')) d = 'http://' + d
    try { const url = new URL(d); d = url.hostname.replace(/^www\./, '') } catch { /* raw input */ }
    if (d) addEntry(d)
    setSiteInput('')
  }

  // ── derived state ─────────────────────────────────────────────────────────

  const active    = status?.active    ?? false
  const paused    = status?.paused    ?? false
  const remaining = status?.remaining_seconds ?? 0
  const total     = status?.total_seconds     ?? 0

  const preset     = PRESETS[presetIdx]
  const idleTotal  = preset.mins * 60
  const dialTotal  = (active || paused) ? total    : idleTotal
  const dialRemain = (active || paused) ? remaining : idleTotal
  const progress   = dialTotal > 0 ? (dialTotal - dialRemain) / dialTotal : 0
  const isDone     = remaining === 0 && (active || paused)

  const R = 140
  const C = 2 * Math.PI * R
  const arcOffset = (active || paused) ? C * (1 - progress) : C

  const activeFriends = friends.filter(f => f.sessionState === 'active' || f.sessionState === 'paused')
  const domains = whitelist.filter(e => !e.includes('\\') && !e.includes('/') && e.includes('.'))
  const filteredApps = appSearch
    ? runningApps.filter(a => a.name.toLowerCase().includes(appSearch.toLowerCase()) || a.key.toLowerCase().includes(appSearch.toLowerCase()))
    : runningApps

  const lede = activeFriends.length > 0
    ? `The lamp is warm and ${activeFriends.length} friend${activeFriends.length > 1 ? 's are' : ' is'} already at their desk${activeFriends.length > 1 ? 's' : ''}. Settle in and begin.`
    : 'The lamp is warm. Settle into your nook and begin.'

  const shieldActive = active || paused

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <SidebarLayout eyebrow="Welcome back" title={greeting(username ?? 'there')} lede={lede}>

      {/* ── Room with timer inside ── */}
      <section className={`ll-room${shieldActive ? ' up' : ''}`}>
        <RoomScene active={shieldActive} />

        <div className="ll-room-timer">
          {/* Session tabs */}
          <div className="ll-stabs">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                className={`ll-stab${presetIdx === i ? ' on' : ''}${(active || paused) ? '' : ''}`}
                onClick={() => { if (!active && !paused) setPresetIdx(i) }}
                disabled={active || paused}
                style={{ opacity: (active || paused) && presetIdx !== i ? 0.5 : 1 }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Dial */}
          <div className="ll-dial-room">
            <svg viewBox="0 0 300 300">
              <defs>
                <linearGradient id="llAmberGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffce86" />
                  <stop offset="100%" stopColor="#e0892f" />
                </linearGradient>
              </defs>
              <circle cx="150" cy="150" r={R}
                fill="none" stroke="rgba(243,231,205,0.10)" strokeWidth="9" />
              <circle cx="150" cy="150" r={R}
                fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth="9"
                strokeDasharray="2 12" strokeLinecap="round" />
              <circle cx="150" cy="150" r={R}
                fill="none" stroke="url(#llAmberGrad)" strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={arcOffset}
                style={{ transition: active ? 'stroke-dashoffset 0.85s linear' : 'none' }}
              />
            </svg>
            <div className="ll-dial-center">
              <div className="ll-session-name">
                {active || paused ? preset.label : preset.label}
              </div>
              <div className={`ll-digits${isDone ? ' done' : ''}`}>
                {isDone ? 'done' : fmtCountdown(dialRemain)}
              </div>
              <div className="ll-phase">
                {isDone ? 'session complete · well done'
                  : active ? preset.note
                  : paused ? 'take a breath'
                  : preset.note}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="ll-room-controls">
            {/* Left: reset when idle, give-up when active */}
            {!active && !paused ? (
              <button className="ll-ghost-round" title="Reset"
                onClick={() => setPresetIdx(presetIdx)}>
                <svg viewBox="0 0 24 24">
                  <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4" />
                </svg>
              </button>
            ) : (
              <button
                className={`ll-ghost-round${giveUpHeld ? ' danger' : ''}`}
                title="Give up (hold 3s)"
                onMouseDown={startGiveUpHold} onMouseUp={releaseGiveUp} onMouseLeave={releaseGiveUp}
                onTouchStart={startGiveUpHold} onTouchEnd={releaseGiveUp}
              >
                {giveUpHeld
                  ? <span style={{ fontFamily: 'var(--ll-mono)', fontSize: 13, fontWeight: 600 }}>{holdCount}s</span>
                  : <svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1.5" /></svg>
                }
              </button>
            )}

            {/* Centre: Begin / Pause / Resume */}
            {!active && !paused ? (
              <button className="ll-begin-btn" onClick={handleStart}>
                Begin
              </button>
            ) : (
              <button className="ll-begin-btn" onClick={handlePause}>
                {paused ? 'Resume' : 'Pause'}
              </button>
            )}

            {/* Right: skip when idle, spacer when active */}
            {!active && !paused ? (
              <button className="ll-ghost-round" title="Next preset"
                onClick={() => setPresetIdx((presetIdx + 1) % PRESETS.length)}>
                <svg viewBox="0 0 24 24">
                  <path d="M5 5.5v13a1 1 0 0 0 1.5.86L15 14v4.5a1 1 0 0 0 2 0v-13a1 1 0 0 0-2 0V10L6.5 4.64A1 1 0 0 0 5 5.5Z" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <div style={{ width: 48 }} />
            )}
          </div>
        </div>

        {/* Nook link */}
        <button className="ll-room-tag" onClick={() => navigate('/nook')}>
          your nook · rearrange
        </button>

        {/* Shield flag */}
        <div className="ll-room-flag">
          <span className="ll-lock-sq" />
          {shieldActive ? `shield up · ${whitelist.length} allowed` : 'shield resting'}
        </div>
      </section>

      {/* ── Focus shield ── */}
      <section className={`ll-shield${shieldActive ? ' up' : ''}`}>
        <div className="ll-shield-left">
          <span className="ll-shield-label">allowed while focusing</span>
          <div className="ll-allow-chips">
            {whitelist.length === 0
              ? <span style={{ fontFamily: 'var(--ll-mono)', fontSize: 10, color: 'var(--ll-ink-faint)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>all dark</span>
              : whitelist.slice(0, 6).map(e => (
                  <AllowChip key={e} label={e} onRemove={() => removeEntry(e)} />
                ))
            }
            {whitelist.length > 6 && (
              <span style={{ fontFamily: 'var(--ll-mono)', fontSize: 10, color: 'var(--ll-ink-faint)' }}>
                +{whitelist.length - 6} more
              </span>
            )}
          </div>
          <button className="ll-manage-btn" onClick={openModal} disabled={!connected}>
            manage apps &amp; sites
          </button>
        </div>
        <div className="ll-shield-state">
          <span className="ll-lock-sq" />
          {shieldActive ? `shield up · ${whitelist.length} allowed` : `shield resting · ${whitelist.length} allowed`}
        </div>
      </section>

      {/* ── Peek panels ── */}
      <div className="ll-desk-peeks">
        {/* Friends peek */}
        <aside className="ll-panel ll-peek">
          <div className="ll-panel-head">
            <div>
              <div className="ll-panel-title">By the lamp</div>
              <div className="ll-panel-sub">focusing now</div>
            </div>
            <span className="ll-chip">
              <i className="ll-pdot live" />
              <span>{activeFriends.length}</span>
            </span>
          </div>
          {activeFriends.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--ll-ink-faint)', fontSize: 13, padding: '10px 4px' }}>
              {socialOffline ? 'Backend offline' : 'No friends focusing right now'}
            </p>
          ) : (
            activeFriends.slice(0, 5).map(f => <FriendMiniRow key={f.userId} f={f} />)
          )}
          <button className="ll-peek-more" onClick={() => navigate('/friends')}>
            all friends →
          </button>
        </aside>

        {/* Leaderboard peek */}
        <aside className="ll-panel ll-peek">
          <div className="ll-panel-head">
            <div>
              <div className="ll-panel-title">This week</div>
              <div className="ll-panel-sub">midnight oil</div>
            </div>
          </div>
          {board.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--ll-ink-faint)', fontSize: 13, padding: '10px 4px' }}>
              {socialOffline ? 'Backend offline' : 'No friends on the board yet'}
            </p>
          ) : (
            board.slice(0, 3).map((e, i) => <LeaderboardMiniRow key={e.userId} entry={e} rank={i + 1} />)
          )}
          <button className="ll-peek-more" onClick={() => navigate('/ranks')}>
            full ranks →
          </button>
        </aside>
      </div>

      {/* ── Sidecar toast ── */}
      {toast && (
        <div className="ll-toast" onClick={() => setToast(null)}>
          <span className="ll-toast-icon">⚠</span>
          {toast}
        </div>
      )}

      {/* ── Allow-list modal ── */}
      {showModal && (
        <div className="ll-modal-scrim" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="ll-modal">
            <div className="ll-modal-head">
              <div>
                <div className="eyebrow">Focus shield</div>
                <h2>What stays open</h2>
              </div>
              <button className="modal-x" onClick={() => setShowModal(false)}>×</button>
            </div>
            <p className="modal-lede">
              While the lamp is lit, only the apps and sites you allow stay reachable. Everything else is gently shut until the timer runs out.
            </p>
            <div className="modal-seg">
              <button className={modalTab === 'apps' ? 'on' : ''} onClick={() => setModalTab('apps')}>Apps</button>
              <button className={modalTab === 'sites' ? 'on' : ''} onClick={() => setModalTab('sites')}>Websites</button>
            </div>

            {modalTab === 'apps' && (
              <div className="mtab">
                <input className="field modal-search" type="text" placeholder="Search running apps…"
                  value={appSearch} onChange={e => setAppSearch(e.target.value)} />
                <div className="applist">
                  {appsLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--ll-ink-faint)', fontStyle: 'italic', padding: 20 }}>Scanning processes…</div>
                  ) : filteredApps.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--ll-ink-faint)', fontStyle: 'italic', padding: 20 }}>
                      {appSearch ? 'No matches.' : 'No apps found.'}
                    </div>
                  ) : filteredApps.map(app => {
                    const isOn = whitelist.includes(app.key)
                    const c = toneColor(app.name)
                    const [baseName, titleSuffix] = app.name.split('  —  ')
                    return (
                      <div key={app.key} className={`approw${isOn ? ' on' : ''}`}
                        onClick={() => isOn ? removeEntry(app.key) : addEntry(app.key)}>
                        <div className="appicon" style={{ background: `radial-gradient(circle at 34% 30%, ${tint(c,34)}, ${c})` }}>
                          {baseName[0].toUpperCase()}
                        </div>
                        <div className="meta">
                          <div className="anm">{baseName}</div>
                          <div className="asub">{titleSuffix || (app.exe ? app.exe.split('\\').pop() : app.key)}</div>
                        </div>
                        <div className="appcheck">
                          {isOn && (
                            <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="#1a130b" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="2,6 5,9 10,3" />
                            </svg>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {modalTab === 'sites' && (
              <div className="mtab">
                <form className="siteform" onSubmit={handleAddSite}>
                  <input className="field" type="text"
                    placeholder="toledo.kuleuven.be or https://…"
                    value={siteInput} onChange={e => setSiteInput(e.target.value)} />
                  <button type="submit" className="btn-primary" disabled={!siteInput.trim()}>Add</button>
                </form>
                <div className="sitelist">
                  {domains.length === 0 ? (
                    <div className="site-empty">No websites allowed yet.</div>
                  ) : domains.map(d => (
                    <div key={d} className="siterow">
                      <span className="sdom">{d}</span>
                      <button className="srm" onClick={() => removeEntry(d)} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ll-modal-foot">
              <span className="cnt">{whitelist.length} item{whitelist.length !== 1 ? 's' : ''} allowed</span>
              <button className="btn-primary" onClick={() => setShowModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
