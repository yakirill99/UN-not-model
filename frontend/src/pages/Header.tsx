import { useNavigate } from 'react-router'
import { useSession } from '../session-core'

export default function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const { logout } = useSession()
  const navigate = useNavigate()
  return (
    <header className="row header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="row header-actions">
        {/* The rules one click away: fewer «а как?» questions to the host (#19). */}
        <button className="ghost" onClick={() => navigate('/rules')}>
          Правила
        </button>
        <button className="ghost" onClick={() => logout().then(() => navigate('/'))}>
          Выйти
        </button>
      </div>
    </header>
  )
}
