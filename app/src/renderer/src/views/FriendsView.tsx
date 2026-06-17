import { useState, useEffect, useCallback } from 'react'
import { Search, UserPlus, Check, X, Clock } from 'lucide-react'
import { backend, FriendStatus, LeaderboardEntry, PendingRequest } from '../api'
import { useAuth } from '../AuthContext'
import { useWebSocket } from '../WebSocketContext'
import SidebarLayout from '../components/SidebarLayout'

const C = {
  card: '#3a2c1e', border: '#4a3a2a',
  text: '#f5e7d3', dim: '#b89e7c', muted: '#8a7560',
  amber: '#e8b855', green: '#10b981',
}

const AVATAR_COLORS = ['#4a8edb','#8b5cf6','#e25a5a','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16']
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length]

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}h ${String(m).padStart(2,'0')}m`
    : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

export default function FriendsView() {
  const { userId } = useAuth()
  const { subscribe } = useWebSocket()
  const [friends, setFriends] = useState<FriendStatus[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [allUsers, setAllUsers] = useState<LeaderboardEntry[]>([])
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [search, setSearch] = useState('')

  const fetchFriends = useCallback(async () => {
    try {
      const { data } = await backend.get<FriendStatus[]>('/api/friends/status')
      setFriends(data)
      setLastUpdated(new Date())
    } catch { /* ignore */ }
  }, [])

  const fetchPending = useCallback(async () => {
    try {
      const { data } = await backend.get<PendingRequest[]>('/api/friends/requests/pending')
      setPending(data)
    } catch { /* ignore */ }
  }, [])

  const fetchAllUsers = useCallback(async () => {
    try {
      const { data } = await backend.get<LeaderboardEntry[]>('/api/leaderboard/global')
      setAllUsers(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchFriends(); fetchPending(); fetchAllUsers()
    // Fallback poll — WebSocket handles instant updates
    const id = setInterval(() => { fetchFriends(); fetchPending() }, 60_000)
    return () => clearInterval(id)
  }, [fetchFriends, fetchPending, fetchAllUsers])

  // Real-time: friend status changes
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
      setLastUpdated(new Date())
    })
  }, [userId, subscribe])

  // Real-time: new friend requests / accepted requests
  useEffect(() => {
    if (!userId) return
    return subscribe(`/topic/friends/${userId}/requests`, () => {
      fetchPending()
      fetchFriends()
    })
  }, [userId, subscribe, fetchPending, fetchFriends])

  async function sendRequest(addresseeId: number) {
    try {
      await backend.post(`/api/friends/request/${addresseeId}`)
      setSentRequests(s => new Set(s).add(addresseeId))
    } catch { /* already sent */ }
  }

  async function respondToRequest(friendshipId: number, accept: boolean) {
    try {
      await backend.patch(`/api/friends/request/${friendshipId}?accept=${accept}`)
      setPending(p => p.filter(r => r.friendshipId !== friendshipId))
      if (accept) fetchFriends()
    } catch { /* ignore */ }
  }

  const friendIds = new Set(friends.map(f => f.userId))
  const discoverList = allUsers.filter(e =>
    e.userId !== userId &&
    !friendIds.has(e.userId) &&
    (search === '' || e.username.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <SidebarLayout eyebrow="Social Hub" title="Friends">

      {/* Pending requests */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', marginBottom: 8 }}>
            FRIEND REQUESTS
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(r => (
              <div key={r.friendshipId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: C.card, border: `1px solid ${C.amber}44`,
                borderRadius: 10, padding: '10px 14px',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: avatarColor(r.requesterUsername),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {r.requesterUsername[0].toUpperCase()}
                </div>
                <span style={{ flex: 1, color: C.text, fontWeight: 600, fontSize: 14 }}>
                  {r.requesterUsername}
                </span>
                <button onClick={() => respondToRequest(r.friendshipId, true)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', borderRadius: 6, border: 'none',
                  background: C.green, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>
                  <Check size={12} /> Accept
                </button>
                <button onClick={() => respondToRequest(r.friendshipId, false)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.border}`,
                  background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                }}>
                  <X size={12} /> Decline
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live friends */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.08em' }}>
            LIVE FRIENDS
          </p>
          {lastUpdated && (
            <p style={{ fontSize: 11, color: C.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {friends.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: '24px 0', fontSize: 14, fontStyle: 'italic' }}>
            No friends yet — find people below to add them!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {friends.map(f => <FriendCard key={f.userId} f={f} />)}
          </div>
        )}
      </div>

      {/* Discover people */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.08em', marginBottom: 10 }}>
          DISCOVER PEOPLE
        </p>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={14} color={C.muted} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
          }} />
          <input
            placeholder="Search by username…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 14px 9px 34px',
              borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card, color: C.text, fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {allUsers.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 14, fontStyle: 'italic' }}>
            No users found — is the backend running?
          </div>
        ) : discoverList.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.muted, padding: '20px 0', fontSize: 14, fontStyle: 'italic' }}>
            {search ? `No users match "${search}"` : 'You\'re already friends with everyone here!'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {discoverList.slice(0, 30).map(e => (
              <div key={e.userId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: avatarColor(e.username),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {e.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{e.username}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Level {e.level} · {e.xpTotal.toLocaleString()} XP</div>
                </div>
                {sentRequests.has(e.userId) ? (
                  <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>Requested</span>
                ) : (
                  <button onClick={() => sendRequest(e.userId)} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 6, border: `1px solid ${C.amber}`,
                    background: 'transparent', color: C.amber, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  }}>
                    <UserPlus size={13} /> Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}

function FriendCard({ f }: { f: FriendStatus }) {
  const isActive = f.sessionState === 'active'
  const isPaused = f.sessionState === 'paused'
  const isHidden = f.sessionState === 'hidden'
  const progress = f.totalSeconds > 0 ? (f.totalSeconds - f.remainingSeconds) / f.totalSeconds : 0

  return (
    <div style={{
      background: C.card, border: `1px solid ${isActive ? C.amber : C.border}`,
      borderRadius: 12, padding: '14px 16px',
      boxShadow: isActive ? `0 0 16px ${C.amber}22` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: avatarColor(f.username),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {f.username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>{f.username}</span>
            <StatusBadge state={f.sessionState} />
          </div>
          <span style={{ fontSize: 12, color: C.muted }}>{f.xpTotal.toLocaleString()} XP</span>
        </div>
        {(isActive || isPaused) && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: isActive ? C.amber : C.dim, fontFamily: 'Consolas, monospace' }}>
              {fmt(f.remainingSeconds)}
            </div>
            <div style={{ fontSize: 10, color: C.muted }}>remaining</div>
          </div>
        )}
        {isHidden && <span style={{ fontSize: 12, color: C.muted, fontStyle: 'italic' }}>private</span>}
      </div>
      {(isActive || isPaused) && f.totalSeconds > 0 && (
        <div style={{ marginTop: 10, height: 4, background: '#2a1f15', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${progress * 100}%`,
            background: isPaused ? '#a87a2c' : C.amber,
            transition: 'width 1s linear',
          }} />
        </div>
      )}
    </div>
  )
}

function StatusBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active: { label: '● Focusing', color: C.green },
    paused: { label: '⏸ Paused',   color: C.amber },
    idle:   { label: 'Idle',        color: C.muted },
    hidden: { label: 'Private',     color: C.muted },
  }
  const s = map[state] ?? map.idle
  return <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</span>
}
