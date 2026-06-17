import { useState } from 'react'
import SidebarLayout from '../components/SidebarLayout'

const WALL_COLORS = [
  { name: 'Mahogany', value: '#3b1a0f' },
  { name: 'Walnut',   value: '#2a1a0e' },
  { name: 'Oak',      value: '#5c3d20' },
  { name: 'Ebony',    value: '#14100a' },
  { name: 'Forest',   value: '#1a2a1a' },
  { name: 'Midnight', value: '#12141e' },
]

const WOOD_TONES = [
  { name: 'Warm oak',   value: '#c87a42' },
  { name: 'Dark walnut',value: '#6b3f1e' },
  { name: 'Bleached',   value: '#d4b896' },
  { name: 'Ebonised',   value: '#2a1c12' },
]

const WINDOW_MOODS = [
  { key: 'clear', label: 'Clear day' },
  { key: 'rain',  label: 'Rainy'    },
  { key: 'snow',  label: 'Snow'     },
  { key: 'dusk',  label: 'Dusk'     },
  { key: 'night', label: 'Night city'},
]

const DESK_ITEMS = [
  { key: 'plant',  label: 'Succulent'   },
  { key: 'candle', label: 'Candle'      },
  { key: 'books',  label: 'Books stack' },
  { key: 'mug',    label: 'Coffee mug'  },
]

const LAMP_COLOR = '#f0a94e'
const NOOK_KEY = 'lamplight_nook'

function readNook() {
  try {
    const raw = localStorage.getItem(NOOK_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function NookView() {
  const saved = readNook()

  const [wall, setWall] = useState<string>(saved?.wall ?? WALL_COLORS[0].value)
  const [wood, setWood] = useState<string>(saved?.wood ?? WOOD_TONES[0].value)
  const [window_, setWindow] = useState<string>(saved?.window ?? 'rain')
  const [items, setItems] = useState<Record<string, boolean>>(
    saved?.items ?? { plant: true, candle: true, books: true, mug: false }
  )
  const [lampWarmth, setLampWarmth] = useState<number>(
    saved?.warmth != null
      ? (saved.warmth > 1 ? Math.round(saved.warmth) : Math.round(saved.warmth * 100))
      : 75
  )
  const [lampGlow, setLampGlow] = useState<number>(saved?.glow ?? 60)
  const [justSaved, setJustSaved] = useState(false)

  function toggleItem(key: string) {
    setItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSave() {
    const prefs = { lamp: LAMP_COLOR, warmth: lampWarmth, glow: lampGlow, wall, wood, window: window_, items }
    localStorage.setItem(NOOK_KEY, JSON.stringify(prefs))
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2200)
  }

  const selectedMood = WINDOW_MOODS.find(m => m.key === window_)
  const activeItems = DESK_ITEMS.filter(i => items[i.key]).map(i => i.label)

  return (
    <SidebarLayout
      eyebrow="Your space"
      title="The Nook"
      lede="Make your study corner feel like home — colours, light, and little details."
    >
      <div className="ll-grid ll-g-2" style={{ gap: 20 }}>

        {/* Left: controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="ll-panel">
            <div className="ll-panel-head">
              <div>
                <div className="ll-panel-title">Lamp</div>
                <div className="ll-panel-sub">Light warmth &amp; intensity</div>
              </div>
            </div>
            <div className="ll-setrow">
              <div>
                <div className="ll-setrow-label">Warmth</div>
                <div className="ll-setrow-desc">{lampWarmth}%</div>
              </div>
              <input type="range" min={20} max={100} value={lampWarmth}
                onChange={e => setLampWarmth(Number(e.target.value))}
                style={{ accentColor: 'var(--ll-amber)', width: 120 }} />
            </div>
            <div className="ll-setrow">
              <div>
                <div className="ll-setrow-label">Glow radius</div>
                <div className="ll-setrow-desc">{lampGlow}%</div>
              </div>
              <input type="range" min={20} max={100} value={lampGlow}
                onChange={e => setLampGlow(Number(e.target.value))}
                style={{ accentColor: 'var(--ll-amber)', width: 120 }} />
            </div>
          </div>

          <div className="ll-panel">
            <div className="ll-panel-head">
              <div><div className="ll-panel-title">Wall colour</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {WALL_COLORS.map(c => (
                <button key={c.value}
                  className={`ll-swatch${wall === c.value ? ' sel' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setWall(c.value)}
                  title={c.name} />
              ))}
            </div>
          </div>

          <div className="ll-panel">
            <div className="ll-panel-head">
              <div><div className="ll-panel-title">Desk wood</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {WOOD_TONES.map(c => (
                <button key={c.value}
                  className={`ll-swatch${wood === c.value ? ' sel' : ''}`}
                  style={{ background: c.value }}
                  onClick={() => setWood(c.value)}
                  title={c.name} />
              ))}
            </div>
          </div>

          <div className="ll-panel">
            <div className="ll-panel-head">
              <div>
                <div className="ll-panel-title">Window</div>
                <div className="ll-panel-sub">Ambient scenery</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WINDOW_MOODS.map(m => (
                <button key={m.key}
                  className={`ll-opt${window_ === m.key ? ' sel' : ''}`}
                  onClick={() => setWindow(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ll-panel">
            <div className="ll-panel-head">
              <div>
                <div className="ll-panel-title">Desk items</div>
                <div className="ll-panel-sub">What's on your desk</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DESK_ITEMS.map(item => (
                <button key={item.key}
                  className={`ll-itoggle${items[item.key] ? ' sel' : ''}`}
                  onClick={() => toggleItem(item.key)}>
                  <span className="ll-itoggle-nm">{item.label}</span>
                  <div className="ll-itoggle-tick" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: preview + save */}
        <div>
          <div className="ll-room-scene" style={{ aspectRatio: '4/3', background: wall }}>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '38%',
              background: wood, borderTop: '1px solid rgba(255,255,255,0.06)',
            }} />
            <div style={{
              position: 'absolute', top: '12%', left: '18%',
              width: `${lampGlow * 2.4}px`, height: `${lampGlow * 1.6}px`,
              borderRadius: '50%',
              background: `radial-gradient(ellipse at 50% 30%, rgba(255,${Math.round(150 + lampWarmth)},80,0.55), rgba(255,180,80,0) 70%)`,
              filter: 'blur(22px)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '39%', left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'var(--ll-mono)', fontSize: 10, color: 'rgba(243,231,205,0.35)',
              letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap',
            }}>
              {activeItems.length > 0 ? activeItems.join(' · ') : 'empty desk'}
            </div>
            <div style={{
              position: 'absolute', top: 12, right: 14,
              fontFamily: 'var(--ll-mono)', fontSize: 9, color: 'rgba(243,231,205,0.4)',
              letterSpacing: 2, textTransform: 'uppercase',
            }}>
              {selectedMood?.label ?? window_}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="ll-btn-primary" onClick={handleSave}>
              {justSaved ? 'Saved ✓' : 'Save nook'}
            </button>
            {justSaved && (
              <span style={{ fontSize: 13, color: 'var(--ll-ink-dim)', fontStyle: 'italic' }}>
                Changes applied to your desk.
              </span>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
