import { useState, useEffect, useCallback } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import { backend, Room } from '../api'
import { useAuth } from '../AuthContext'
import { useWebSocket } from '../WebSocketContext'

const COLORS = ['#c87d3a', '#6a9c6a', '#5a6a9c', '#9c5a7a', '#7a9c5a', '#9c7a5a']
const cardColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length]

export default function RoomsView() {
  const { userId } = useAuth()
  const { subscribe } = useWebSocket()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPublic, setCreatePublic] = useState(true)
  const [creating, setCreating] = useState(false)

  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await backend.get<Room[]>('/api/rooms')
      setRooms(data)
      setError(null)
    } catch {
      setError('Could not load rooms — is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    // Fallback poll — WebSocket handles instant updates
    const id = setInterval(fetchRooms, 60_000)
    return () => clearInterval(id)
  }, [fetchRooms])

  // Real-time: any room created, joined, or left
  useEffect(() => {
    return subscribe('/topic/rooms/lobby', () => fetchRooms())
  }, [subscribe, fetchRooms])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createName.trim()) return
    setCreating(true)
    try {
      await backend.post('/api/rooms', { name: createName.trim(), isPublic: createPublic })
      setCreateName('')
      setShowCreate(false)
      fetchRooms()
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      await backend.post(`/api/rooms/join/${joinCode.trim().toUpperCase()}`)
      setJoinCode('')
      fetchRooms()
    } catch {
      setJoinError('Room not found or no longer active.')
    } finally {
      setJoining(false)
    }
  }

  async function handleLeave(roomId: number) {
    setLeaveError(null)
    try {
      await backend.delete(`/api/rooms/${roomId}/leave`)
      fetchRooms()
    } catch {
      setLeaveError('Could not leave room — please try again.')
    }
  }

  async function handleJoinByCode(code: string) {
    try {
      await backend.post(`/api/rooms/join/${code}`)
      fetchRooms()
    } catch {
      setJoinError('Could not join room — it may no longer be active.')
    }
  }

  const isMember = (room: Room) => room.members.some(m => m.userId === userId)

  return (
    <SidebarLayout
      eyebrow="Study together"
      title="Rooms"
      lede="Create a study room and share the code with friends to focus together."
    >
      {/* Actions bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="ll-btn-primary" onClick={() => setShowCreate(true)}>
          + Create room
        </button>
        <form onSubmit={handleJoin} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="ll-field"
            placeholder="Room code…"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={8}
            style={{ width: 140, fontFamily: 'var(--ll-mono)', letterSpacing: '0.12em', textTransform: 'uppercase' }}
          />
          <button className="ll-btn-soft" type="submit" disabled={!joinCode.trim() || joining}>
            {joining ? 'Joining…' : 'Join by code'}
          </button>
        </form>
        {joinError && (
          <span style={{ fontSize: 13, color: '#c95450' }}>{joinError}</span>
        )}
        {leaveError && (
          <span style={{ fontSize: 13, color: '#c95450' }}>{leaveError}</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--ll-ink-dim)', padding: '48px 0', fontStyle: 'italic', fontSize: 14 }}>
          Loading rooms…
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', color: 'var(--ll-ink-dim)', padding: '48px 0', fontSize: 14 }}>
          {error}
        </div>
      ) : rooms.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--ll-ink-dim)', padding: '64px 0' }}>
          <div style={{ fontFamily: 'var(--ll-serif)', fontSize: 22, marginBottom: 10 }}>No rooms yet</div>
          <div style={{ fontSize: 14, fontStyle: 'italic' }}>
            Create one above and share the code with your friends.
          </div>
        </div>
      ) : (
        <div className="ll-grid ll-g-2" style={{ marginBottom: 28 }}>
          {rooms.map(room => {
            const color = cardColor(room.name)
            const member = isMember(room)
            return (
              <div key={room.id} className="ll-room-card"
                style={{ background: `linear-gradient(160deg, ${color}1a, rgba(20,15,9,0.90))` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="ll-chip" style={{ color: 'var(--ll-amber)', borderColor: 'rgba(240,169,78,0.35)' }}>
                    <span className="ll-pdot live" /> Live
                  </div>
                  <div className="ll-chip">
                    {room.memberCount} {room.memberCount === 1 ? 'person' : 'people'}
                  </div>
                </div>

                <div style={{ fontFamily: 'var(--ll-serif)', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                  {room.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ll-ink-dim)', marginBottom: 14 }}>
                  Host: {room.hostUsername} · {room.isPublic ? 'Public' : 'Private'}
                </div>

                {/* Member avatars */}
                <div style={{ display: 'flex', marginBottom: 14 }}>
                  {room.members.slice(0, 5).map((m, j) => (
                    <div key={m.userId} className="ll-av sm"
                      style={{
                        background: `radial-gradient(circle at 38% 30%, ${COLORS[m.userId % COLORS.length]}88, ${COLORS[m.userId % COLORS.length]}44)`,
                        marginLeft: j > 0 ? -8 : 0,
                        border: '2px solid rgba(15,11,6,0.7)',
                        fontSize: 11, color: 'var(--ll-ink)',
                      }}
                      title={m.username}
                    >
                      {m.username[0].toUpperCase()}
                    </div>
                  ))}
                  {room.memberCount > 5 && (
                    <span style={{ fontSize: 11, color: 'var(--ll-ink-dim)', marginLeft: 10, alignSelf: 'center' }}>
                      +{room.memberCount - 5}
                    </span>
                  )}
                </div>

                {/* Invite code */}
                <div style={{
                  fontFamily: 'var(--ll-mono)', fontSize: 13, letterSpacing: '0.2em',
                  color: 'var(--ll-amber)', marginBottom: 14,
                }}>
                  {room.code}
                </div>

                {member ? (
                  <button className="ll-btn-soft"
                    style={{ fontSize: 11, padding: '7px 14px', color: '#c95450', borderColor: 'rgba(201,84,80,0.25)' }}
                    onClick={() => handleLeave(room.id)}>
                    Leave room
                  </button>
                ) : (
                  <button className="ll-btn-soft" style={{ fontSize: 11, padding: '7px 14px' }}
                    onClick={() => handleJoinByCode(room.code)}>
                    Join room
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create room modal */}
      {showCreate && (
        <div className="ll-modal-scrim" onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
          <div className="ll-modal">
            <div className="ll-modal-head">
              <div>
                <div className="eyebrow">Study together</div>
                <h2>Create a room</h2>
              </div>
              <button className="modal-x" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <p className="modal-lede">
              A unique invite code will be generated automatically. Share it with friends so they can join.
            </p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="ll-label">Room name</label>
                <input
                  className="ll-field"
                  placeholder="e.g. Late-night Library"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="ll-setrow" style={{ marginTop: 4 }}>
                <div>
                  <div className="ll-setrow-label">Public room</div>
                  <div className="ll-setrow-desc">Visible to everyone — anyone can join</div>
                </div>
                <button
                  type="button"
                  className={`ll-switch${createPublic ? ' on' : ''}`}
                  onClick={() => setCreatePublic(v => !v)}
                />
              </div>
              <div className="ll-modal-foot" style={{ marginTop: 8 }}>
                <span />
                <button className="btn-primary" type="submit" disabled={!createName.trim() || creating}>
                  {creating ? 'Creating…' : 'Create room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SidebarLayout>
  )
}
