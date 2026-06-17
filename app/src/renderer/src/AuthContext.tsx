import React, { createContext, useContext, useState, useEffect } from 'react'
import { setAuthHeader } from './api'

interface AuthContextValue {
  token: string | null
  username: string | null
  userId: number | null
  login: (token: string, username: string, userId: number) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('jwt'))
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('username'))
  const [userId, setUserId] = useState<number | null>(() => {
    const v = localStorage.getItem('userId')
    return v ? Number(v) : null
  })

  useEffect(() => { setAuthHeader(token) }, [token])

  function login(t: string, u: string, id: number) {
    localStorage.setItem('jwt', t)
    localStorage.setItem('username', u)
    localStorage.setItem('userId', String(id))
    setToken(t)
    setUsername(u)
    setUserId(id)
    setAuthHeader(t)
  }

  function logout() {
    localStorage.clear()
    setToken(null)
    setUsername(null)
    setUserId(null)
    setAuthHeader(null)
  }

  return (
    <AuthContext.Provider value={{ token, username, userId, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
