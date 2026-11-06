import { describe, expect, it } from 'vitest'
import { flagUrl, hash, isoOf } from './flags'
import { geoOf } from './geo'

describe('geo', () => {
  it('knows the scenario countries', () => {
    expect(geoOf('Россия')?.iso).toBe('ru')
    expect(geoOf('США')?.iso).toBe('us')
    expect(geoOf('Франция')?.iso).toBe('fr')
    expect(geoOf('Иран')?.iso).toBe('ir')
    expect(geoOf('КНДР')?.iso).toBe('kp')
  })

  it('resolves aliases', () => {
    expect(geoOf('Северная Корея')?.iso).toBe('kp')
    expect(geoOf('Российская Федерация')?.iso).toBe('ru')
  })

  it('leaves unknown countries to the caller', () => {
    expect(geoOf('Атлантида')).toBeUndefined()
  })

  it('keeps coordinates on the globe', () => {
    for (const name of ['Россия', 'США', 'Бразилия', 'Австралия', 'ЮАР']) {
      const geo = geoOf(name)
      expect(geo).toBeDefined()
      expect(geo!.lat).toBeGreaterThanOrEqual(-90)
      expect(geo!.lat).toBeLessThanOrEqual(90)
      expect(geo!.lon).toBeGreaterThanOrEqual(-180)
      expect(geo!.lon).toBeLessThanOrEqual(180)
    }
  })
})

describe('flags', () => {
  it('maps a known country to its file', () => {
    expect(isoOf('Россия')).toBe('ru')
    expect(flagUrl('Россия')).toBe('/flags/ru.svg')
  })

  it('falls back to a stable generic pennant for unknown countries', () => {
    expect(isoOf('Атлантида')).toMatch(/^generic-[123]$/)
    expect(isoOf('Атлантида')).toBe(isoOf('Атлантида'))
    expect(flagUrl('Атлантида')).toMatch(/^\/flags\/generic-[123]\.svg$/)
  })

  it('hashes deterministically', () => {
    expect(hash('abc')).toBe(hash('abc'))
    expect(hash('abc')).toBeGreaterThan(0)
  })
})
