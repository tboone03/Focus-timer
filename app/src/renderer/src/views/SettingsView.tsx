import { useState, useEffect } from 'react'
import SidebarLayout from '../components/SidebarLayout'
import { backend } from '../api'
import type { UserProfile } from '../api'
import { useAuth } from '../AuthContext'

export default function SettingsView() {
  const { username, logout } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [liveStatus, setLiveStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    backend.get<UserProfile>('/api/users/me').then((r) => {
      setProfile(r.data)
      setDisplayName(r.data.displayName)
      setEmail(r.data.email)
      setLiveStatus(r.data.liveStatusVisible)
    })
  }, [])

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      const r = await backend.put<UserProfile>('/api/users/me', {
        displayName,
        email,
        liveStatusVisible: liveStatus,
      })
      setProfile(r.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setSaveError(msg ?? 'Failed to save — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const initial = (profile?.displayName ?? username ?? 'U')[0].toUpperCase()

  return (
    <SidebarLayout
      eyebrow="Your space"
      title="Settings"
      lede="Manage your account, study rituals, and privacy preferences."
    >
      {/* Account panel */}
      <div className="ll-panel" style={{ marginBottom: 20 }}>
        <div className="ll-panel-head">
          <div>
            <div className="ll-panel-title">Account</div>
            <div className="ll-panel-sub">Identity &amp; visibility</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="ll-acct-av">{initial}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="ll-grid ll-g-2" style={{ gap: 16, marginBottom: 16 }}>
              <div>
                <label className="ll-label">Display name</label>
                <input
                  className="ll-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="ll-label">Handle</label>
                <input
                  className="ll-field"
                  value={profile?.username ?? ''}
                  disabled
                  placeholder="@handle"
                />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="ll-label">Email address</label>
              <input
                className="ll-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>

        <div className="ll-divider" />

        <div className="ll-setrow">
          <div>
            <div className="ll-setrow-label">Live status visible</div>
            <div className="ll-setrow-desc">Friends can see when you're in a focus session</div>
          </div>
          <button
            className={`ll-switch${liveStatus ? ' on' : ''}`}
            onClick={() => setLiveStatus((v) => !v)}
            aria-label="Toggle live status"
          />
        </div>
      </div>

      {/* Save / sign out */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="ll-btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </button>
        {saveError && (
          <span style={{ fontSize: 13, color: '#c95450' }}>{saveError}</span>
        )}
        <button
          className="ll-btn-soft"
          onClick={logout}
          style={{ color: 'rgba(200,100,80,0.85)', borderColor: 'rgba(200,100,80,0.25)' }}
        >
          Sign out
        </button>
      </div>
    </SidebarLayout>
  )
}
