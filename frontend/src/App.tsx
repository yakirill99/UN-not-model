import { Navigate, Route, Routes } from 'react-router'
import HostPage from './pages/HostPage'
import JoinPage from './pages/JoinPage'
import NewGamePage from './pages/NewGamePage'
import PlayPage from './pages/PlayPage'
import RequireRole from './pages/RequireRole'
import { ThemeToggle } from './ThemeToggle'

export default function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/new" element={<NewGamePage />} />
        <Route element={<RequireRole role="host" />}>
          <Route path="/host/:gameId" element={<HostPage />} />
        </Route>
        <Route element={<RequireRole role="player" />}>
          <Route path="/play/:gameId" element={<PlayPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
