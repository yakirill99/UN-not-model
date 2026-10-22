import { describe, expect, it } from 'vitest'
import { gameInfo, hostStatus, player } from '../test/host'
import { allSubmitted, humans, phaseText, resolvableRound, submittedCount, teams } from './core'

describe('teams', () => {
  it('joins the player list with the round status', () => {
    const list = teams(gameInfo(), hostStatus({ submitted: { russia: true, dprk: true } }))
    expect(list.map((t) => t.name)).toEqual(['Россия', 'США', 'КНДР'])
    expect(list[0]).toMatchObject({
      id: 'russia',
      code: 'RUS-L75WVG',
      joined: true,
      submitted: true,
    })
    expect(list[1].submitted).toBe(false)
  })

  it('never exposes a code for a bot', () => {
    const list = teams(gameInfo(), hostStatus())
    expect(list[2]).toMatchObject({ isBot: true, code: null })
  })

  it('treats a human without a code as codeless rather than crashing', () => {
    const game = gameInfo({ players: [player({ country_id: 'russia', join_code: null })] })
    expect(teams(game, null)[0].code).toBeNull()
  })

  it('marks nobody as submitted while the status is unknown', () => {
    expect(teams(gameInfo(), null).every((t) => !t.submitted)).toBe(true)
  })

  it('flags the laugh winner', () => {
    const list = teams(gameInfo(), hostStatus({ laugh_winner: 'usa' }))
    expect(list.map((t) => t.laughWinner)).toEqual([false, true, false])
  })
})

describe('humans / submittedCount', () => {
  it('counts only the teams that can hold the round up', () => {
    const list = teams(gameInfo(), hostStatus({ submitted: { russia: true, dprk: true } }))
    expect(humans(list)).toHaveLength(2)
    expect(submittedCount(list)).toEqual({ done: 1, total: 2 })
  })

  it('counts zero of zero in a game of bots only', () => {
    const game = gameInfo({ players: [player({ country_id: 'dprk', kind: 'bot' })] })
    expect(submittedCount(teams(game, hostStatus()))).toEqual({ done: 0, total: 0 })
  })
})

describe('allSubmitted', () => {
  it('is true once every human has sent orders', () => {
    const status = hostStatus({ submitted: { russia: true, usa: true, dprk: true } })
    expect(allSubmitted(teams(gameInfo(), status))).toBe(true)
  })

  it('ignores the bots that are always reported as submitted', () => {
    expect(allSubmitted(teams(gameInfo(), hostStatus()))).toBe(false)
  })

  it('is false with nobody to wait for, so the label stays neutral', () => {
    const game = gameInfo({ players: [player({ country_id: 'dprk', kind: 'bot' })] })
    expect(allSubmitted(teams(game, hostStatus()))).toBe(false)
  })
})

describe('resolvableRound', () => {
  it('is the round on screen while orders are open', () => {
    expect(resolvableRound(gameInfo({ current_round: 3 }), hostStatus())).toBe(3)
  })

  it('is nothing while the engine is already resolving', () => {
    expect(resolvableRound(gameInfo(), hostStatus({ phase: 'resolving' }))).toBeNull()
  })

  it('is nothing without a round status', () => {
    expect(resolvableRound(gameInfo(), null)).toBeNull()
  })

  it.each([
    ['phase', gameInfo({ phase: 'done' })],
    ['status', gameInfo({ status: 'finished' })],
  ])('is nothing once the game is over by %s', (_name, game) => {
    expect(resolvableRound(game, hostStatus())).toBeNull()
  })
})

describe('phaseText', () => {
  it.each([
    ['orders', 'приём приказов'],
    ['resolving', 'подведение итогов'],
    ['done', 'игра завершена'],
  ])('translates %s', (phase, expected) => {
    expect(phaseText(phase)).toBe(expected)
  })

  it('passes an unknown phase through', () => {
    expect(phaseText('hibernating')).toBe('hibernating')
  })
})
