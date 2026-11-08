import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import RulesPage from './RulesPage'
import rules from '../rules/rules.json'

describe('RulesPage', () => {
  it('shows the rules version and the numbers the engine enforces', () => {
    const { container } = render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const text = container.textContent ?? ''
    expect(text).toContain(`Версия ${rules.version}`)
    // The income line spells the real coefficients out.
    expect(text).toContain(`${rules.income.k_development} × развитие`)
    expect(text).toContain(`${rules.income.k_ecology} ×`)
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
    expect(screen.getAllByText(`${rules.actions.bomb.cost} $`).length).toBeGreaterThanOrEqual(2)
  })

  it('walks the round pipeline in the engine order', () => {
    render(
      <MemoryRouter>
        <RulesPage />
      </MemoryRouter>,
    )
    const steps = [...document.querySelectorAll('.facts ol li, ol.facts li')]
    expect(steps.length).toBe(rules.pipeline.length)
    expect(steps[0].textContent).toContain('бюджет')
  })
})
