import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { WebSocketProvider } from './WebSocketContext'
import AuthView from './views/AuthView'
import TimerView from './views/TimerView'
import SettingsView from './views/SettingsView'
import RoomsView from './views/RoomsView'
import StatsView from './views/StatsView'
import NookView from './views/NookView'
import FriendsView from './views/FriendsView'
import RanksView from './views/RanksView'

function Guards() {
  const { token } = useAuth()
  return (
    <Routes>
      <Route path="/auth"     element={token ? <Navigate to="/timer" replace /> : <AuthView />} />
      <Route path="/timer"    element={token ? <TimerView />    : <Navigate to="/auth" replace />} />
      <Route path="/social"   element={<Navigate to="/friends" replace />} />
      <Route path="/friends"  element={token ? <FriendsView /> : <Navigate to="/auth" replace />} />
      <Route path="/ranks"    element={token ? <RanksView />   : <Navigate to="/auth" replace />} />
      <Route path="/rooms"    element={token ? <RoomsView />   : <Navigate to="/auth" replace />} />
      <Route path="/stats"    element={token ? <StatsView />   : <Navigate to="/auth" replace />} />
      <Route path="/nook"     element={token ? <NookView />    : <Navigate to="/auth" replace />} />
      <Route path="/settings" element={token ? <SettingsView />: <Navigate to="/auth" replace />} />
      <Route path="*"         element={<Navigate to={token ? '/timer' : '/auth'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <Guards />
      </WebSocketProvider>
    </AuthProvider>
  )
}
