import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import RulesPage from './RulesPage'
import rulesV1 from '../rules/rules-v1.0.json'
import rulesV2 from '../rules/rules-v2.0.json'

describe('RulesPage', () => {
  it('shows the rules version and the numbers the engine enforces', () => {
    const { container } = render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const text = container.textContent ?? ''
    expect(text).toContain(`Версия ${rulesV1.version}`)
    // The income line spells the real coefficients out.
    expect(text).toContain(`${rulesV1.income.k_development} × развитие`)
    expect(text).toContain(`${rulesV1.income.k_ecology} ×`)
  })

  it('lists every player action with its price from the YAML', () => {
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    expect(screen.getByText('Произвести ядерные бомбы')).toBeTruthy()
    expect(screen.getByText('Наложить экономические санкции')).toBeTruthy()
    // Sanctions and strikes are free; invest and bomb cost the same 150 $.
    expect(screen.getAllByText('бесплатно').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText(`${rulesV1.actions.bomb.cost} $`).length).toBeGreaterThanOrEqual(2)
  })

  it('walks the round pipeline in the engine order', () => {
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const steps = [...document.querySelectorAll('.facts ol li, ol.facts li')]
    expect(steps.length).toBe(rulesV1.pipeline.length)
    expect(steps[0].textContent).toContain('бюджет')
  })

  it('without a version parameter shows the base edition', () => {
    const { container } = render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Правила 1.0')
    expect(text).not.toContain('Черты стран')
    expect(text).toContain('Приз за юмор')
  })

  it('?v=2.0 pulls the second edition with its sections — «версия подтягивалась»', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/rules?v=2.0']}>
        <RulesPage />
      </MemoryRouter>,
    )
    const text = container.textContent ?? ''
    expect(text).toContain(`Версия ${rulesV2.version}`)
    expect(text).toContain('Устойчивость и смена власти')
    expect(text).toContain('Инвестиционный рейтинг и частный капитал')
    expect(text).toContain('Черты стран')
    expect(text).toContain('Мобилизационная экономика')
    // v1-only facts do not appear under v2.
    expect(text).not.toContain('Приз за юмор +')
  })
})
