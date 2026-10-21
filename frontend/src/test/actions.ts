/** Builders for ActionSpace / RoundStatus fixtures: sane defaults, override per test. */
import type { ActionOption, ActionSpace, RoundStatus, Schemas } from '../api/client'

type Ui = Schemas['UiSpec']

const ui = (title: string, emoji: string): Ui => ({ title, emoji, description: '' })

export function option(over: Partial<ActionOption> & { id: string }): ActionOption {
  return {
    ui: ui(over.id, '•'),
    cost: 0,
    available: true,
    reason: null,
    requires: null,
    targets: null,
    max_count: null,
    max_per_target: null,
    min_amount: null,
    ...over,
  }
}

/** The v1.0 rule set as the engine reports it for a country with two own cities. */
export function actionSpace(over: Partial<ActionSpace> = {}): ActionSpace {
  return {
    round: 1,
    country_id: 'russia',
    budget: 1200,
    actions: {
      invest: option({
        id: 'invest',
        cost: 150,
        targets: ['moscow', 'spb'],
        ui: ui('Инвестировать в развитие города', '🏙'),
      }),
      eco_program: option({
        id: 'eco_program',
        cost: 200,
        ui: ui('Запустить экологическую программу', '♻️'),
      }),
      nuclear_tech: option({
        id: 'nuclear_tech',
        cost: 500,
        ui: ui('Разработать ядерную технологию', '☢️'),
      }),
      bomb: option({
        id: 'bomb',
        cost: 150,
        available: false,
        reason: 'requires_nuclear_tech',
        requires: 'nuclear_tech',
        max_count: 3,
        ui: ui('Произвести ядерные бомбы', '💣'),
      }),
      strike: option({
        id: 'strike',
        available: false,
        reason: 'no_bombs',
        requires: 'bomb',
        targets: [],
        max_count: 0,
        max_per_target: 1,
        ui: ui('Нанести ядерный удар', '🚀'),
      }),
      shield: option({
        id: 'shield',
        cost: 300,
        targets: ['moscow', 'spb'],
        max_per_target: 1,
        ui: ui('Построить ядерный щит', '🛡'),
      }),
      sanction: option({
        id: 'sanction',
        targets: ['usa'],
        max_per_target: 1,
        ui: ui('Наложить экономические санкции', '❌'),
      }),
      aid: option({
        id: 'aid',
        targets: ['usa'],
        min_amount: 1,
        ui: ui('Материальная помощь', '💸'),
      }),
    },
    ...over,
  }
}

export function roundStatus(over: Partial<RoundStatus> = {}): RoundStatus {
  return {
    round: 1,
    phase: 'orders',
    status: 'active',
    submitted: { russia: false },
    laugh_winner: null,
    ...over,
  }
}
