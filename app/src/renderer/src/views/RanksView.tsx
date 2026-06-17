import { useState, useEffect, useCallback } from 'react'
import { backend, LeaderboardEntry } from '../api'
import { useAuth } from '../AuthContext'
import SidebarLayout from '../components/SidebarLayout'

const C = {
  card: '#3a2c1e', border: '#4a3a2a',
  text: '#f5e7d3', muted: '#8a7560',
  amber: '#e8b855',
}

const AVATAR_COLORS = ['#4a8edb','#8b5cf6','#e25a5a','#10b981','#f59e0b','#ec4899','#06b6d4','#84cc16']
const avatarColor = (s: string) => AVATAR_COLORS[s.charCodeAt(0) % AVATAR_COLORS.length]

export default function RanksView() {
  const { userId } = useAuth()
  const [tab, setTab] = useState<'friends' | 'global'>('friends')
  const [friendsBoard, setFriendsBoard] = useState<LeaderboardEntry[]>([])
  const [globalBoard, setGlobalBoard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBoards = useCallback(async () => {
    try {
      const [fr, gl] = await Promise.all([
        backend.get<LeaderboardEntry[]>('/api/leaderboard/friends'),
        backend.get<LeaderboardEntry[]>('/api/leaderboard/global'),
      ])
      setFriendsBoard(fr.data)
      setGlobalBoard(gl.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchBoards()
    const id = setInterval(fetchBoards, 30_000)
    return () => clearInterval(id)
  }, [fetchBoards])

  const board = tab === 'friends' ? friendsBoard : globalBoard

  return (
    <SidebarLayout
      eyebrow="Leaderboard"
      title="Ranks"
      lede="See how you stack up against friends and the wider community."
    >
      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['friends', 'global'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid',
            borderColor: tab === t ? C.amber : C.border,
            background: tab === t ? '#3a2c1e' : 'transparent',
            color: tab === t ? C.amber : C.muted,
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            {t === 'friends' ? 'Friends' : 'Global'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: C.muted, padding: '48px 0', fontStyle: 'italic', fontSize: 14 }}>
          Loading…
        </div>
      ) : board.length === 0 ? (
        <div style={{ textAlign: 'center', color: C.muted, padding: '64px 0' }}>
          <div style={{ fontFamily: 'var(--ll-serif)', fontSize: 20, marginBottom: 10 }}>
            {tab === 'friends' ? 'No friends on the board yet' : 'No users found'}
          </div>
          <div style={{ fontSize: 13, fontStyle: 'italic' }}>
            {tab === 'friends'
              ? 'Add friends in the Friends page to compare your progress.'
              : 'Is the backend running?'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {board.map(e => {
            const isMe = e.userId === userId
            return (
              <div key={e.userId} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: isMe ? `${C.amber}11` : C.card,
                border: `1px solid ${isMe ? C.amber + '44' : C.border}`,
                borderRadius: 10, padding: '12px 16px',
              }}>
                <span style={{
                  width: 28, textAlign: 'center', fontWeight: 700, fontSize: 15,
                  color: e.rank === 1 ? '#fbbf24' : e.rank === 2 ? '#9ca3af' : e.rank === 3 ? '#d97706' : C.muted,
                }}>
                  {e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : `#${e.rank}`}
                </span>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: avatarColor(e.username),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: '#fff',
                }}>
                  {e.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
                    {e.username}
                    {isMe && (
                      <span style={{ color: C.muted, fontWeight: 400, fontSize: 12, marginLeft: 6 }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>Level {e.level}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: C.amber, fontSize: 15 }}>{e.xpTotal.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>XP</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </SidebarLayout>
  )
}
