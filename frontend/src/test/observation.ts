/** Builders for Observation fixtures: start from a sane default, override what the test is about. */
import type { Observation, Schemas } from '../api/client'

type OwnCity = Schemas['OwnCityView']
type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

export function ownCity(over: Partial<OwnCity> = {}): OwnCity {
  return {
    id: 'moscow',
    name: 'Москва',
    development: 70,
    life_level: 5500,
    destroyed: false,
    shield: false,
    ...over,
  }
}

export function me(over: Partial<Me> = {}): Me {
  return {
    id: 'russia',
    name: 'Россия',
    budget: 1200,
    average_life_level: 4567,
    cities: [ownCity()],
    nuclear_tech: false,
    bombs: 0,
    bombs_pending: 0,
    laugh: 0,
    aid_pending: 0,
    sanctioned_by: [],
    ...over,
  }
}

export function foreign(over: Partial<Foreign> = {}): Foreign {
  return {
    id: 'usa',
    name: 'США',
    average_life_level: 6000,
    laugh: 0,
    cities: [{ id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6000 }],
    ...over,
  }
}

export function observation(over: Partial<Observation> = {}): Observation {
  return { round: 2, ecology: 72, me: me(), others: [], news: [], ...over }
}
