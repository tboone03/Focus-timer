import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { Client, StompSubscription } from '@stomp/stompjs'
import { BACKEND } from './api'
import { useAuth } from './AuthContext'

interface WebSocketContextValue {
  subscribe: (topic: string, callback: (body: unknown) => void) => () => void
  connected: boolean
}

const WebSocketContext = createContext<WebSocketContextValue>({
  subscribe: () => () => {},
  connected: false,
})

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const clientRef = useRef<Client | null>(null)
  const pendingRef = useRef<Map<string, Set<(body: unknown) => void>>>(new Map())
  const activeSubsRef = useRef<Map<string, StompSubscription>>(new Map())
  const [connected, setConnected] = React.useState(false)

  useEffect(() => {
    if (!token) {
      clientRef.current?.deactivate()
      clientRef.current = null
      setConnected(false)
      return
    }

    const wsUrl = BACKEND.replace(/^http/, 'ws') + '/ws-native'

    const client = new Client({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true)
        // re-subscribe any pending topics
        pendingRef.current.forEach((callbacks, topic) => {
          if (!activeSubsRef.current.has(topic)) {
            const sub = client.subscribe(topic, (msg) => {
              try {
                const body = JSON.parse(msg.body)
                pendingRef.current.get(topic)?.forEach(cb => cb(body))
              } catch { /* ignore malformed */ }
            })
            activeSubsRef.current.set(topic, sub)
          }
        })
      },
      onDisconnect: () => {
        setConnected(false)
        activeSubsRef.current.clear()
      },
      onStompError: () => setConnected(false),
    })

    client.activate()
    clientRef.current = client

    return () => {
      client.deactivate()
      activeSubsRef.current.clear()
      setConnected(false)
    }
  }, [token])

  const subscribe = useCallback((topic: string, callback: (body: unknown) => void) => {
    // register the callback
    if (!pendingRef.current.has(topic)) pendingRef.current.set(topic, new Set())
    pendingRef.current.get(topic)!.add(callback)

    // subscribe on the broker if connected and not already subscribed
    const client = clientRef.current
    if (client?.connected && !activeSubsRef.current.has(topic)) {
      const sub = client.subscribe(topic, (msg) => {
        try {
          const body = JSON.parse(msg.body)
          pendingRef.current.get(topic)?.forEach(cb => cb(body))
        } catch { /* ignore */ }
      })
      activeSubsRef.current.set(topic, sub)
    }

    return () => {
      const cbs = pendingRef.current.get(topic)
      cbs?.delete(callback)
      if (cbs?.size === 0) {
        activeSubsRef.current.get(topic)?.unsubscribe()
        activeSubsRef.current.delete(topic)
        pendingRef.current.delete(topic)
      }
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ subscribe, connected }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocket = () => useContext(WebSocketContext)
