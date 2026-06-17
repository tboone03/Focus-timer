import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../renderer/src/api', () => ({
  backend: { get: vi.fn(), put: vi.fn() },
  sidecar: { get: vi.fn(), post: vi.fn() },
  setAuthHeader: vi.fn(),
}))

vi.mock('../renderer/src/AuthContext', () => ({
  useAuth: () => ({ username: 'alice', userId: 1, logout: vi.fn() }),
}))

import SettingsView from '../renderer/src/views/SettingsView'
import { backend } from '../renderer/src/api'

const mockGet = vi.mocked(backend.get)
const mockPut = vi.mocked(backend.put)

const fakeProfile = {
  id: 1, username: 'alice', displayName: 'Alice',
  email: 'alice@test.com', xpTotal: 0, liveStatusVisible: true,
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <SettingsView />
    </MemoryRouter>
  )
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockResolvedValue({ data: fakeProfile })
  })

  it('renders save button', async () => {
    renderSettings()
    await waitFor(() => expect(screen.getByText(/save changes/i)).toBeInTheDocument())
  })

  it('shows Saved on successful save', async () => {
    mockPut.mockResolvedValue({ data: fakeProfile })
    renderSettings()
    await waitFor(() => screen.getByText(/save changes/i))
    fireEvent.click(screen.getByText(/save changes/i))
    await waitFor(() => expect(screen.getByText(/saved/i)).toBeInTheDocument())
  })

  it('shows error message when save fails with server message', async () => {
    mockPut.mockRejectedValue({
      response: { data: { error: 'Email is already in use' } },
    })
    renderSettings()
    await waitFor(() => screen.getByText(/save changes/i))
    fireEvent.click(screen.getByText(/save changes/i))
    await waitFor(() =>
      expect(screen.getByText('Email is already in use')).toBeInTheDocument()
    )
  })

  it('shows generic error when backend gives no message', async () => {
    mockPut.mockRejectedValue(new Error('Network Error'))
    renderSettings()
    await waitFor(() => screen.getByText(/save changes/i))
    fireEvent.click(screen.getByText(/save changes/i))
    await waitFor(() =>
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    )
  })
})
