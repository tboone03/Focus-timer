import { ReactNode, useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import '../lamplight.css'

interface NavItem {
  label: string
  path: string
  svg: string
}

const NAV: NavItem[] = [
  {
    label: 'Desk',
    path: '/timer',
    svg: '<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>',
  },
  {
    label: 'Rooms',
    path: '/rooms',
    svg: '<circle cx="9" cy="8" r="2.4"/><circle cx="16" cy="9" r="2"/><path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5"/><path d="M14.5 19c0-2.2 1.4-4 3.5-4 1.8 0 3 1.4 3 3"/>',
  },
  {
    label: 'Friends',
    path: '/friends',
    svg: '<circle cx="8.5" cy="8" r="3"/><path d="M3 19c0-3 2.5-5.5 5.5-5.5S14 16 14 19"/><path d="M16 6.5a3 3 0 0 1 0 5.6"/><path d="M18 13.6c2 .6 3.4 2.4 3.4 4.4"/>',
  },
  {
    label: 'Ranks',
    path: '/ranks',
    svg: '<path d="M7 4h10v3a5 5 0 0 1-10 0Z"/><path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 4"/><path d="M17 5h2.5a2.5 2.5 0 0 1-2.5 4"/><path d="M12 12v3"/><path d="M8.5 20h7l-1-3h-5Z"/>',
  },
  {
    label: 'Stats',
    path: '/stats',
    svg: '<path d="M4 20V5"/><path d="M4 20h16"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="10" width="3" height="7"/>',
  },
  {
    label: 'Nook',
    path: '/nook',
    svg: '<path d="M12 21c4-2.5 6-5.5 6-9a6 6 0 0 0-12 0c0 3.5 2 6.5 6 9Z"/><path d="M12 12c0-2 1-3.5 2.5-4"/><path d="M12 12c0-1.5-1-2.8-2.5-3.4"/>',
  },
  {
    label: 'Settings',
    path: '/settings',
    svg: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8"/>',
  },
]

interface Props {
  children: ReactNode
  eyebrow?: string
  title: string
  lede?: string
}

export default function SidebarLayout({ children, eyebrow, title, lede }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { username } = useAuth()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const initial = (username ?? 'U')[0].toUpperCase()

  const hh = String(time.getHours()).padStart(2, '0')
  const mm = String(time.getMinutes()).padStart(2, '0')
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()

  return (
    <div className="ll-page">
      <div className="ll-titlebar">
        <div className="ll-win-controls">
          <button
            className="ll-wc-btn ll-wc-min"
            onClick={() => window.electronAPI?.minimize()}
            aria-label="Minimize"
          />
          <button
            className="ll-wc-btn ll-wc-close"
            onClick={() => window.electronAPI?.close()}
            aria-label="Close"
          />
        </div>
      </div>
      <div className="ll-lamp-glow" />
      <div className="ll-vignette" />
      <div className="ll-grain" />

      {/* Sidebar */}
      <nav className="ll-sidebar">
        <button
          className="ll-logo"
          onClick={() => navigate('/timer')}
          aria-label="Go to timer"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#ffce86" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15 15" />
          </svg>
        </button>

        <div className="ll-nav">
          {NAV.map((item) => (
            <button
              key={item.path}
              className={`ll-nav-btn${location.pathname === item.path ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <svg
                viewBox="0 0 24 24"
                dangerouslySetInnerHTML={{ __html: item.svg }}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="ll-sidebar-spacer" />

        <button
          className="ll-me-av"
          onClick={() => navigate('/settings')}
          aria-label="Go to settings"
        >
          {initial}
        </button>
      </nav>

      {/* Main content */}
      <main className="ll-content">
        <div className="ll-wrap ll-rise">
          <header className="ll-page-head">
            <div>
              {eyebrow && <p className="ll-eyebrow">{eyebrow}</p>}
              <h1 className="ll-page-title">{title}</h1>
              {lede && <p className="ll-page-lede">{lede}</p>}
            </div>
            <div className="ll-head-clock">
              <div className="t">{hh}:{mm}</div>
              <div className="d">{dateStr}</div>
            </div>
          </header>

          {children}
        </div>
      </main>
    </div>
  )
}
