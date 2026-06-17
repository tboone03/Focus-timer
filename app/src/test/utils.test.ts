import { describe, it, expect } from 'vitest'

// ── xpToLevel (copied from StatsView) ────────────────────────────────────────
function xpToLevel(xp: number) {
  const level   = Math.floor(Math.sqrt(xp / 100))
  const base    = level * level * 100
  const next    = (level + 1) * (level + 1) * 100
  return { level, inLevel: xp - base, forNext: next - base }
}

// ── fmtCountdown (copied from TimerView) ─────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')
function fmtCountdown(s: number) {
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('xpToLevel', () => {
  it('level 0 at 0 XP', () => {
    expect(xpToLevel(0).level).toBe(0)
  })

  it('level 1 at 100 XP', () => {
    expect(xpToLevel(100).level).toBe(1)
  })

  it('level 2 at 400 XP', () => {
    expect(xpToLevel(400).level).toBe(2)
  })

  it('inLevel resets at level boundary', () => {
    const { inLevel } = xpToLevel(100) // exactly level 1
    expect(inLevel).toBe(0)
  })

  it('inLevel counts within level', () => {
    const { inLevel } = xpToLevel(150)
    expect(inLevel).toBe(50)
  })

  it('forNext is distance to next level', () => {
    const { forNext } = xpToLevel(100) // level 1, next at 400 → 300 XP gap
    expect(forNext).toBe(300)
  })

  it('progress % never exceeds 100', () => {
    const { inLevel, forNext } = xpToLevel(399)
    expect(Math.round((inLevel / forNext) * 100)).toBeLessThanOrEqual(100)
  })
})

describe('fmtCountdown', () => {
  it('formats seconds only', () => {
    expect(fmtCountdown(45)).toBe('00:45')
  })

  it('formats minutes and seconds', () => {
    expect(fmtCountdown(90)).toBe('01:30')
  })

  it('formats 25 minutes', () => {
    expect(fmtCountdown(25 * 60)).toBe('25:00')
  })

  it('includes hours when >= 3600', () => {
    expect(fmtCountdown(3661)).toBe('01:01:01')
  })

  it('zero shows 00:00', () => {
    expect(fmtCountdown(0)).toBe('00:00')
  })

  it('pads single-digit minutes', () => {
    expect(fmtCountdown(9 * 60 + 5)).toBe('09:05')
  })
})
