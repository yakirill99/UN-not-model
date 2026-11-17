import { useNavigate, useSearchParams } from 'react-router'
import rulesV1 from '../rules/rules-v1.0.json'
import rulesV2 from '../rules/rules-v2.0.json'

/** One action from the generated rules JSON — optional keys vary per action. */
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

type RulesDoc = {
  version: string
  rounds: number
  ecology: { min: number; max: number }
  life_weights: { development: number; ecology: number; laugh: number }
  income: { k_development: number; k_ecology: number }
  laugh_bonus: number
  budget_priority: string[]
  last_round: { unlimited_bombs: boolean }
  pipeline: string[]
  tech_from_round?: number
  actions: Record<string, RuleAction>
  stability?: {
    dynamics_percent: number
    good_life: number
    good_bonus: number
    poor_life: number
    poor_penalty: number
    sanction_penalty: number
    first_city_loss: number
    city_loss: number
    crisis_below: number
    transition_stability: number
  }
  rating?: { sanction: number; nuclear_tech: number; bomb: number; eco_program: number }
  private_pool?: { base: number; jitter_percent: number }
  climate?: {
    unstable_below: number
    catastrophe_below: number
    unstable_city_loss: number
    catastrophe_stability: number
    catastrophe_income: number
  }
  traits?: Record<string, number | string>
  invest_returns?: { up_to: number | null; gain: number }[]
  charisma_bonus?: number
}

const BOOKS: Record<'1.0' | '2.0', RulesDoc> = {
  '1.0': rulesV1 as unknown as RulesDoc,
  '2.0': rulesV2 as unknown as RulesDoc,
}

/**
 * The in-platform rules page (#19 of the playtest feedback): «чтобы можно
 * было удобно и быстро посмотреть правила… организаторы будут немного
 * разгружены от банальных вопросов». The numbers come from the generated
 * `src/rules/rules-v<X>.json` — the same YAML the engine enforces, so the
 * page cannot drift from the game (regenerate: `uv run python scripts/gen_rules_json.py`).
 *
 * The version follows the party the reader came from (?v=2.0 — the «Правила»
 * button passes the game's version) — «чтобы динамически версия подтягивалась
 * в зависимости от версии старта». A direct visit shows the base rules.
 */
export default function RulesPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const v = params.get('v') === '2.0' ? '2.0' : '1.0'
  const rules = BOOKS[v as keyof typeof BOOKS]
  const isV2 = v === '2.0'

  const order = [
    'invest',
    'eco_program',
    'social_program',
    'nuclear_tech',
    'bomb',
    'strike',
    'shield',
    'sanction',
    'aid',
  ]
  const BOOK = rules.actions as unknown as Record<string, RuleAction>
  const actions = order.filter((id) => id in BOOK).map((id) => BOOK[id])
  for (const [id, spec] of Object.entries(BOOK)) {
    if (!order.includes(id)) actions.push(spec)
  }

  const priority = rules.budget_priority.map((id) => BOOK[id]?.title ?? id)

  return (
    <main className="app narrow-rules">
      <header className="row header">
        <div>
          <h1>Правила {isV2 ? '2.0' : '1.0'}</h1>
          <p className="muted">
            Версия {rules.version}, {rules.rounds} раундов, источник rules/{v}.yaml
            {!isV2 && ' (вторая редакция доступна у партий, начатых по правилам 2.0)'}
          </p>
        </div>
        {/* «После вкладки "правила" нужна вкладка "назад"»: back to wherever the
            reader came from — the play page, the host panel or the front door. */}
        <button
          className="ghost"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        >
          ← Назад
        </button>
      </header>

      <section className="card stack">
        <h2>Показатели</h2>
        <ul className="facts">
          <li>
            Уровень жизни = {rules.life_weights.development} % развитие +{' '}
            {rules.life_weights.ecology} % экология
            {rules.life_weights.laugh > 0 && ` + ${rules.life_weights.laugh} % смех`}; считается при
            подведении итогов раунда.
          </li>
          <li>
            Доход за раунд = {rules.income.k_development} × развитие + {rules.income.k_ecology} ×
            экология (в процентах, за каждый целый город). Разрушенный город не приносит дохода.
          </li>
          <li>
            Экология держится в пределах {rules.ecology.min}–{rules.ecology.max} %; бомбы и удары её
            снижают, программы поднимают.
          </li>
          {rules.life_weights.laugh > 0 && (
            <li>Приз за юмор +{rules.laugh_bonus} к уровню жизни самой весёлой команде раунда.</li>
          )}
          <li>
            Бюджет тратится в порядке приоритета: {priority.join(' → ')}; что не влезло,
            отклоняется, приказ вернётся в новостях.
          </li>
          <li>
            Ядерную технологию можно изучать с раунда {rules.tech_from_round ?? 1}
            {(rules.tech_from_round ?? 1) > 1 && ' (задано ведущим при старте партии)'}.
          </li>
          <li>
            {rules.last_round.unlimited_bombs
              ? 'В последнем раунде лимит бомб снят.'
              : 'Лимит бомб действует и в последнем раунде (ведущий может его снять правилами).'}
          </li>
        </ul>
      </section>

      {isV2 && rules.stability && (
        <section className="card stack">
          <h2>Устойчивость и смена власти (правила 2.0)</h2>
          <ul className="facts">
            <li>
              Устойчивость меняется за раунд на динамику ({rules.stability.dynamics_percent / 100} ×
              изменение уровня жизни), уровень (≥ {rules.stability.good_life} % жизни:{' '}
              {rules.stability.good_bonus > 0 ? '+' : ''}
              {rules.stability.good_bonus}; &lt; {rules.stability.poor_life} %:{' '}
              {rules.stability.poor_penalty}), потрясения и действия.
            </li>
            <li>
              Потрясения: санкция {rules.stability.sanction_penalty}, потеря первого города{' '}
              {rules.stability.first_city_loss}, каждого следующего {rules.stability.city_loss}.
            </li>
            <li>
              При устойчивости {rules.stability.crisis_below} п.п. и ниже — кризис, армия
              отказывается наносить ядерные удары.
            </li>
            <li>
              На 0 п.п. — смена власти: бюджет урезается вдвое, счёт партии теряет 10, устойчивость
              сбрасывается до {rules.stability.transition_stability} п.п.
            </li>
            <li>
              Социальная программа (150 $, раз за раунд) даёт устойчивости{' '}
              {BOOK.social_program?.effect?.stability ?? 10}, харизма ведущего +
              {rules.charisma_bonus}.
            </li>
          </ul>
        </section>
      )}

      {isV2 && rules.rating && (
        <section className="card stack">
          <h2>Инвестиционный рейтинг и частный капитал (правила 2.0)</h2>
          <ul className="facts">
            <li>
              Оценка = 0,5 × устойчивость + 0,5 × уровень жизни. Модификаторы: санкция{' '}
              {rules.rating.sanction}, ядерная технология {rules.rating.nuclear_tech}, бомба в
              производстве {rules.rating.bomb}, экопрограмма{' '}
              {rules.rating.eco_program > 0 ? '+' : ''}
              {rules.rating.eco_program}.
            </li>
            <li>
              Уровни A–E определяют вес в пуле частного капитала: {rules.private_pool?.base} $ ×
              экология / 100 делится по весам с разбросом ±{rules.private_pool?.jitter_percent} % —
              чем выше рейтинг, тем больше доля.
            </li>
            <li>
              Инвестиции дают убывающую отдачу:{' '}
              {(rules.invest_returns ?? [])
                .map((t) => `${t.gain > 0 ? '+' : ''}${t.gain} % до ${t.up_to ?? '∞'} %`)
                .join(', ')}{' '}
              развития.
            </li>
          </ul>
        </section>
      )}

      {isV2 && rules.climate && (
        <section className="card stack">
          <h2>Климат (правила 2.0)</h2>
          <ul className="facts">
            <li>
              Экология ниже {rules.climate.unstable_below} % — нестабильность: каждый раунд
              случайный город каждой страны теряет {rules.climate.unstable_city_loss} п.п. развития.
            </li>
            <li>
              Ниже {rules.climate.catastrophe_below} % — катастрофа: устойчивость всех стран{' '}
              {rules.climate.catastrophe_stability}, доходы {rules.climate.catastrophe_income} %.
            </li>
            <li>Экология 0 % — коллапс: частный капитал исчезает, счёт теряет 15.</li>
          </ul>
        </section>
      )}

      {isV2 && rules.traits && (
        <section className="card stack">
          <h2>Черты стран (правила 2.0)</h2>
          <p className="muted">
            У каждой страны один бонус и одно ограничение — страны разные по стилю игры.
          </p>
          <table className="rules-table">
            <thead>
              <tr>
                <th>Страна</th>
                <th>Бонус</th>
                <th>Ограничение</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TRAIT_TEXT) as (keyof typeof TRAIT_TEXT)[]).map((country) => (
                <tr key={country}>
                  <td>{country}</td>
                  <td>{TRAIT_TEXT[country][0]}</td>
                  <td>{TRAIT_TEXT[country][1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
                  {a.requires ? (
                    <span className="muted">, нужна {BOOK[a.requires]?.title ?? a.requires}</span>
                  ) : null}
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
  stability: 'устойчивость',
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
  return bits.join(', ') || '—'
}

const PIPELINE_WORDS: Record<string, string> = {
  budget: 'проверка бюджета: исполняются только оплаченные приказы',
  aid: 'помощь уходит получателям',
  build: 'технологии, щиты, производство бомб',
  develop: 'инвестиции в города и экологические программы',
  strikes: 'ядерные удары; щиты поглощают',
  sanctions: 'санкции режут развитие',
  climate: 'климатические пороги бьют по городам и устойчивости',
  clamp: 'показатели обрезаются по границам',
  life_level: 'пересчёт уровня жизни',
  stability: 'пересчёт устойчивости; на нуле — смена власти',
  rating: 'пересчёт инвестиционного рейтинга',
  income: 'начисление дохода',
  capital: 'пул частного капитала делится по рейтингам',
  charisma: 'харизма ведущего добавляет устойчивость',
  laugh: 'приз за юмор',
  end_of_round: 'конец раунда: бомбы готовы, помощь в бюджете, санкции сняты',
}

/** The §9 trait wording (GAME_RULES_2.md) — the ids live in the scenarios. */
const TRAIT_TEXT: Record<string, [string, string]> = {
  Россия: [
    'Ресурсная держава — +100 $ к доходу каждый раунд',
    'Сырьевая зависимость — события кризиса и нефтяного шока для России удваиваются',
  ],
  США: [
    'Финансовый центр — вес в пуле частного капитала +1',
    'Избирательный цикл — динамика устойчивости считается с коэффициентом 0,75 вместо 0,5',
  ],
  Франция: [
    'Дипломатическая традиция — сможет выдвигать две резолюции за раунд (в разработке)',
    'Экологическая повестка — при экологии ниже 60 % теряет 5 устойчивости каждый раунд',
  ],
  Иран: [
    'Опыт жизни под санкциями — санкции против Ирана действуют вдвое слабее',
    'Ограниченный доступ к капиталу — рейтинг не выше B',
  ],
  КНДР: [
    'Мобилизационная экономика — бомбы стоят 100 $, санкции не снижают устойчивость, старт с 70 п.п.',
    'Изоляция — рейтинг всегда E',
  ],
}
