import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../renderer/src/AuthContext', () => ({
  useAuth: () => ({ username: 'alice', userId: 1, logout: vi.fn() }),
}))

import SidebarLayout from '../renderer/src/components/SidebarLayout'

function renderLayout(children = <div>content</div>) {
  return render(
    <MemoryRouter>
      <SidebarLayout title="Test Page">{children}</SidebarLayout>
    </MemoryRouter>
  )
}

describe('SidebarLayout', () => {
  it('renders the page title', () => {
    renderLayout()
    expect(screen.getByText('Test Page')).toBeInTheDocument()
  })

  it('renders nav items', () => {
    renderLayout()
    expect(screen.getByText('Desk')).toBeInTheDocument()
    expect(screen.getByText('Rooms')).toBeInTheDocument()
    expect(screen.getByText('Friends')).toBeInTheDocument()
    expect(screen.getByText('Ranks')).toBeInTheDocument()
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders eyebrow when provided', () => {
    render(
      <MemoryRouter>
        <SidebarLayout eyebrow="Welcome back" title="Test">children</SidebarLayout>
      </MemoryRouter>
    )
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('renders children', () => {
    renderLayout(<span>hello world</span>)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('calls electronAPI.minimize on minimize button click', () => {
    renderLayout()
    fireEvent.click(screen.getByLabelText('Minimize'))
    expect(window.electronAPI.minimize).toHaveBeenCalled()
  })

  it('calls electronAPI.close on close button click', () => {
    renderLayout()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(window.electronAPI.close).toHaveBeenCalled()
  })

  it('shows user initial in avatar', () => {
    renderLayout()
    // 'A' for 'alice'
    expect(screen.getByLabelText('Go to settings')).toHaveTextContent('A')
  })
})
