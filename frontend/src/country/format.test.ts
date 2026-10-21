import { describe, expect, it } from 'vitest'
import { ecologyTone, lifeLevel, money, percent } from './format'

describe('lifeLevel', () => {
  it('renders hundredths of a percent with two decimals', () => {
    expect(lifeLevel(4567)).toBe('45.67 %')
    expect(lifeLevel(0)).toBe('0.00 %')
    expect(lifeLevel(10000)).toBe('100.00 %')
  })
})

describe('money', () => {
  it('groups thousands and keeps them on one line', () => {
    expect(money(1200)).toBe('1\u202f200 $')
    expect(money(0)).toBe('0 $')
    expect(money(1000000)).toBe('1\u202f000\u202f000 $')
  })
})

describe('percent', () => {
  it('renders whole percent', () => {
    expect(percent(73)).toBe('73 %')
  })
})

describe('ecologyTone', () => {
  it.each([
    [100, 'ok'],
    [60, 'ok'],
    [59, 'warn'],
    [40, 'warn'],
    [39, 'bad'],
    [0, 'bad'],
  ])('%i%% is %s', (value, tone) => {
    expect(ecologyTone(value)).toBe(tone)
  })
})
