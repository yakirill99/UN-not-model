import { useNavigate } from 'react-router'
import { useSession } from '../session-core'

export default function Header({
  title,
  subtitle,
  rulesVersion,
}: {
  title: string
  subtitle?: string
  rulesVersion?: string
}) {
  const { logout } = useSession()
  const navigate = useNavigate()
  // The rules page shows the edition this game was started with
  // («чтобы динамически версия подтягивалась в зависимости от версии старта»).
  const rulesHref = rulesVersion
    ? `/rules?v=${rulesVersion.split('.').slice(0, 2).join('.')}`
    : '/rules'
  return (
    <header className="row header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="row header-actions">
        {/* The rules one click away: fewer «а как?» questions to the host (#19). */}
        <button className="ghost" onClick={() => navigate(rulesHref)}>
          Правила
        </button>
        <button className="ghost" onClick={() => logout().then(() => navigate('/'))}>
          Выйти
        </button>
      </div>
    </header>
  )
}
