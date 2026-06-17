import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { backend, AuthResponse } from '../api'
import { useAuth } from '../AuthContext'

export default function AuthView() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]         = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = tab === 'in'
        ? { username, password }
        : { username, email, password }
      const { data } = await backend.post<AuthResponse>(`/api/auth/${tab === 'in' ? 'login' : 'register'}`, payload)
      login(data.token, data.username, data.userId)
      navigate('/timer')
    } catch (err: any) {
      const d = err.response?.data
      const msg = d?.error ?? d?.message ?? d?.detail
      setError(msg ?? (err.response ? `Error ${err.response.status}` : 'Cannot reach server — is the backend running?'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
      background: 'oklch(0.13 0.018 55)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>

        {/* wordmark */}
        <div style={{ marginBottom: 8, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--amber)' }}>
          Welcome to
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 52, lineHeight: 1, letterSpacing: 0.5, marginBottom: 10, textShadow: '0 0 50px rgba(255,201,123,0.35)' }}>
          Lamp<span style={{ color: 'var(--honey)' }}>light</span>
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--cream-faint)', marginBottom: 30, lineHeight: 1.5 }}>
          {tab === 'in'
            ? 'A quiet desk for late hours. Sign in and light the lamp.'
            : 'Make yourself a desk. It only takes a moment.'}
        </div>

        {/* card */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(60,45,26,0.60), rgba(43,32,19,0.55))',
          border: '1px solid rgba(199,154,87,0.20)',
          borderRadius: 20,
          padding: '28px 28px 24px',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 24px 60px -28px rgba(0,0,0,0.85)',
        }}>
          {/* tab switcher */}
          <div style={{ display: 'flex', gap: 5, padding: 4, borderRadius: 28, background: 'rgba(20,15,9,0.5)', border: '1px solid rgba(199,154,87,0.20)', marginBottom: 22 }}>
            {(['in', 'up'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{
                  flex: 1, padding: 11, border: 'none', borderRadius: 22, cursor: 'pointer',
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
                  background: tab === t ? 'linear-gradient(180deg, var(--honey), var(--amber-deep))' : 'transparent',
                  color: tab === t ? '#231809' : 'var(--cream-faint)',
                  fontWeight: tab === t ? 600 : 400,
                  transition: 'all .22s',
                  boxShadow: tab === t ? '0 6px 16px -8px rgba(240,169,78,0.8)' : 'none',
                }}>
                {t === 'in' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AuthField label="Username" value={username} onChange={setUsername} />
            {tab === 'up' && <AuthField label="Email" type="email" value={email} onChange={setEmail} />}
            <AuthField label="Password" type="password" value={password} onChange={setPassword} />

            {error && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.05em', color: 'oklch(0.70 0.12 24)', marginTop: -6 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                marginTop: 4, padding: '15px', borderRadius: 40, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--mono)', fontSize: 13, letterSpacing: '0.22em', textTransform: 'uppercase',
                fontWeight: 600, color: '#231809',
                background: loading ? 'rgba(60,45,26,0.6)' : 'linear-gradient(180deg, var(--honey), var(--amber-deep))',
                boxShadow: loading ? 'none' : '0 14px 30px -14px rgba(240,169,78,0.9), inset 0 1px 0 rgba(255,255,255,0.45)',
                transition: 'transform .12s',
              }}>
              {loading ? '✦ lighting…' : (tab === 'in' ? 'Light the lamp →' : 'Create my desk →')}
            </button>
          </form>
        </div>

        <div style={{ marginTop: 18, fontFamily: 'var(--serif)', fontSize: 13, color: 'var(--cream-faint)', lineHeight: 1.5 }}>
          {tab === 'in' ? 'New here?' : 'Already have a desk?'}{' '}
          <span
            onClick={() => { setTab(tab === 'in' ? 'up' : 'in'); setError('') }}
            style={{ color: 'var(--amber)', cursor: 'pointer', textDecoration: 'none' }}
          >
            {tab === 'in' ? 'Pull up a chair' : 'Sign in'}
          </span>
        </div>
      </div>
    </div>
  )
}

function AuthField({ label, type = 'text', value, onChange }: {
  label: string; type?: string; value: string; onChange: (v: string) => void
}) {
  const [showPwd, setShowPwd] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPwd ? 'text' : 'password') : type
  return (
    <div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cream-faint)', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <input type={inputType} value={value} onChange={e => onChange(e.target.value)} required
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: isPassword ? '12px 40px 12px 16px' : '12px 16px',
            fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--cream)',
            background: 'rgba(20,15,9,0.6)',
            border: '1px solid rgba(199,154,87,0.18)',
            borderRadius: 12, outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = 'rgba(199,154,87,0.38)')}
          onBlur={e => (e.target.style.borderColor = 'rgba(199,154,87,0.18)')}
        />
        {isPassword && (
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--cream-faint)',
              cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>
            {showPwd ? 'hide' : 'show'}
          </button>
        )}
      </div>
    </div>
  )
}
