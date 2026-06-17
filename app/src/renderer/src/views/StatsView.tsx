import { useEffect, useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import { backend, sidecar } from '../api'
import { useAuth } from '../AuthContext'
import type { LeaderboardEntry, SidecarStatus } from '../api'

function xpToLevel(xp: number): { level: number; inLevel: number; forNext: number } {
  const level = Math.floor(Math.sqrt(xp / 100))
  const base = level * level * 100
  const next = (level + 1) * (level + 1) * 100
  return { level, inLevel: xp - base, forNext: next - base }
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function StatsView() {
  const { userId } = useAuth()
  const [xpTotal, setXpTotal] = useState<number | null>(null)
  const [globalRank, setGlobalRank] = useState<number | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [meRes, boardRes, sidecarRes] = await Promise.all([
          backend.get('/api/users/me'),
          backend.get<LeaderboardEntry[]>('/api/leaderboard/global'),
          sidecar.get<SidecarStatus>('/status').catch(() => null),
        ])
        const xp = meRes.data.xpTotal as number
        setXpTotal(xp)
        const entry = (boardRes.data as LeaderboardEntry[]).find(e => e.userId === userId)
        if (entry) setGlobalRank(entry.rank)
        if (sidecarRes) setStreak(sidecarRes.data.streak)
      } catch { /* backend offline */ }
      finally { setLoading(false) }
    }
    load()
  }, [userId])

  const lvl = xpTotal != null ? xpToLevel(xpTotal) : null
  const pct = lvl ? Math.round((lvl.inLevel / lvl.forNext) * 100) : 0

  return (
    <SidebarLayout
      eyebrow="Your journey"
      title="Statistics"
      lede="Track your focus habits and watch your depth grow over time."
    >
      {/* Hero stat cards */}
      <div className="ll-grid ll-g-4" style={{ marginBottom: 20 }}>
        {[
          {
            v: loading ? '…' : xpTotal != null ? `${(xpTotal / 600).toFixed(1)} h` : '—',
            l: 'Total focus hours', amber: true,
          },
          { v: loading ? '…' : streak != null ? `${streak}d` : '—', l: 'Day streak', amber: false },
          { v: '—', l: 'Daily average',  amber: false },
          {
            v: loading ? '…' : globalRank != null ? `#${globalRank}` : '—',
            l: 'Global rank', amber: false,
          },
        ].map((s, i) => (
          <div key={i} className="ll-panel">
            <div className="ll-stat-v" style={s.amber ? { color: 'var(--ll-amber)' } : {}}>{s.v}</div>
            <div className="ll-stat-l">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Level + week chart row */}
      <div className="ll-grid ll-g-2" style={{ marginBottom: 20 }}>
        <div className="ll-panel">
          <div className="ll-panel-head">
            <div>
              <div className="ll-panel-title">Level {lvl?.level ?? '—'}</div>
              <div className="ll-panel-sub">
                {lvl ? `${pct}% to level ${lvl.level + 1}` : loading ? 'loading…' : 'No data'}
              </div>
            </div>
            <div className="ll-lvl-badge">
              <div className="ll-lvl-badge-n">{lvl?.level ?? '?'}</div>
            </div>
          </div>
          <div className="ll-bar">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontFamily: 'var(--ll-mono)', fontSize: 10, color: 'var(--ll-ink-faint)' }}>
              {lvl?.inLevel ?? 0} XP
            </span>
            <span style={{ fontFamily: 'var(--ll-mono)', fontSize: 10, color: 'var(--ll-ink-faint)' }}>
              {lvl?.forNext ?? 100} XP
            </span>
          </div>
        </div>

        <div className="ll-panel">
          <div className="ll-panel-head">
            <div>
              <div className="ll-panel-title">This week</div>
              <div className="ll-panel-sub">Focus hours by day</div>
            </div>
          </div>
          <div className="ll-week-chart">
            {WEEK_DAYS.map((day, i) => (
              <div key={i} className="ll-wbar">
                <div className="ll-wbar-col" style={{ height: '0px' }} />
                <div className="ll-wbar-h" />
                <div className="ll-wbar-d">{day}</div>
              </div>
            ))}
          </div>
          <div style={{
            textAlign: 'center', fontSize: 12, color: 'var(--ll-ink-faint)',
            marginTop: 8, fontStyle: 'italic',
          }}>
            Detailed session history coming soon
          </div>
        </div>
      </div>

      {/* Achievements placeholder */}
      <div className="ll-panel">
        <div className="ll-panel-head">
          <div>
            <div className="ll-panel-title">Achievements</div>
            <div className="ll-panel-sub">Milestones &amp; badges</div>
          </div>
        </div>
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--ll-ink-dim)', fontSize: 14, fontStyle: 'italic',
        }}>
          {loading
            ? 'Loading…'
            : xpTotal != null && xpTotal > 0
              ? 'You\'ve started your journey — achievements coming soon.'
              : 'Complete your first focus session to earn achievements.'}
        </div>
      </div>
    </SidebarLayout>
  )
}
