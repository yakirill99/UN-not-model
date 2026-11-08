import rules from '../rules/rules.json'

/** One action from the generated rules.json — optional keys vary per action. */
type RuleAction = {
  id: string
  title: string
  emoji: string
  cost?: number
  effect?: Record<string, number>
  target?: string
  max_per_round?: number | null
  max_per_city_per_round?: number | null
  max_per_target_city_per_round?: number | null
  min_amount?: number
  requires?: string
  once_per_game?: boolean
  duration_rounds?: number
  usable?: string
  active?: string
  available?: string
}

const BOOK = rules.actions as unknown as Record<string, RuleAction>

/**
 * The in-platform rules page (#19 of the playtest feedback): «чтобы можно
 * было удобно и быстро посмотреть правила… организаторы будут немного
 * разгружены от банальных вопросов». The numbers come from the generated
 * `src/rules/rules.json` — the same YAML the engine enforces, so the page
 * cannot drift from the game (regenerate: `uv run python scripts/gen_rules_json.py`).
 */
export default function RulesPage() {
  const order = [
    'invest',
    'eco_program',
    'nuclear_tech',
    'bomb',
    'strike',
    'shield',
    'sanction',
    'aid',
  ]
  const actions = order.filter((id) => id in BOOK).map((id) => BOOK[id])
  for (const [id, spec] of Object.entries(BOOK)) {
    if (!order.includes(id)) actions.push(spec)
  }

  return (
    <main className="app narrow-rules">
      <header className="row header">
        <div>
          <h1>Правила</h1>
          <p className="muted">
            Версия {rules.version} · {rules.rounds} раундов · источник: rules/v1.0.yaml
          </p>
        </div>
      </header>

      <section className="card stack">
        <h2>Показатели</h2>
        <ul className="facts">
          <li>
            Уровень жизни = {rules.life_weights.development} % развитие +{' '}
            {rules.life_weights.ecology} % экология + {rules.life_weights.laugh} % смех; считается
            при подведении итогов раунда.
          </li>
          <li>
            Доход за раунд = {rules.income.k_development} × развитие + {rules.income.k_ecology} ×
            экология (в процентах, за каждый целый город). Разрушенный город не приносит дохода.
          </li>
          <li>
            Экология держится в пределах {rules.ecology.min}–{rules.ecology.max} %; бомбы и удары её
            снижают, программы — поднимают.
          </li>
          <li>Приз за юмор: +{rules.laugh_bonus} к уровню жизни самой весёлой команде раунда.</li>
          <li>
            Бюджет тратится в порядке приоритета: {rules.budget_priority.join(' → ')}; что не влезло
            — отклоняется, приказ вернётся в новостях.
          </li>
          <li>
            {rules.last_round.unlimited_bombs
              ? 'В последнем раунде лимит бомб снят.'
              : 'Лимит бомб действует и в последнем раунде (ведущий может его снять правилами).'}
          </li>
        </ul>
      </section>

      <section className="card stack">
        <h2>Что можно приказать за раунд</h2>
        <table className="rules-table">
          <thead>
            <tr>
              <th>Действие</th>
              <th>Цена</th>
              <th>Эффект и лимиты</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.title}
                  {a.requires ? <span className="muted"> · нужна: {a.requires}</span> : null}
                </td>
                <td className="num">{(a.cost ?? 0) > 0 ? `${a.cost} $` : 'бесплатно'}</td>
                <td>{describeLimits(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card stack">
        <h2>Как считается раунд</h2>
        <ol className="facts">
          {rules.pipeline.map((step) => (
            <li key={step}>{PIPELINE_WORDS[step] ?? step}</li>
          ))}
        </ol>
      </section>
    </main>
  )
}

type ActionSpec = RuleAction

/** YAML effect keys in the words the players read. */
const EFFECT_WORDS: Record<string, string> = {
  development: 'развитие',
  development_all_cities: 'развитие всех городов',
  ecology: 'экология',
}

/** Limits in one human line; the raw YAML stays one click away. */
function describeLimits(a: ActionSpec): string {
  const bits: string[] = []
  const effect = Object.entries(a.effect ?? {})
    .map(([k, v]) => `${EFFECT_WORDS[k] ?? k} ${v > 0 ? '+' : '−'}${Math.abs(v)}`)
    .join(', ')
  if (effect) bits.push(effect)
  if (a.max_per_round != null) bits.push(`до ${a.max_per_round} за раунд`)
  if (a.max_per_city_per_round != null) bits.push(`до ${a.max_per_city_per_round} на город`)
  if (a.max_per_target_city_per_round != null)
    bits.push(`до ${a.max_per_target_city_per_round} на город цели`)
  if (a.min_amount != null) bits.push(`шаг ${a.min_amount} $`)
  if (a.once_per_game) bits.push('один раз за игру')
  if (a.target === 'own_city') bits.push('на свои города')
  if (a.usable === 'next_round') bits.push('вступает в дело со следующего раунда')
  if (a.active === 'same_round') bits.push('работает уже в этом раунде')
  if (a.duration_rounds != null) bits.push(`держится ${a.duration_rounds} раунд(а)`)
  return bits.join(' · ') || '—'
}

const PIPELINE_WORDS: Record<string, string> = {
  budget: 'проверка бюджета: исполняются только оплаченные приказы',
  aid: 'помощь уходит получателям',
  build: 'технологии, щиты, производство бомб',
  develop: 'инвестиции в города и экологические программы',
  strikes: 'ядерные удары; щиты поглощают',
  sanctions: 'санкции режут развитие',
  clamp: 'показатели обрезаются по границам',
  life_level: 'пересчёт уровня жизни',
  income: 'начисление дохода',
  laugh: 'приз за юмор',
  end_of_round: 'конец раунда: бомбы готовы, помощь в бюджете, санкции сняты',
}
