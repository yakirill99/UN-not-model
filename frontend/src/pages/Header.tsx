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
      <button className="ghost" onClick={() => logout().then(() => navigate('/'))}>
        Выйти
      </button>
    </header>
  )
}
