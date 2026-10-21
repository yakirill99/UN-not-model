import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ownCity } from '../test/observation'
import CityList from './CityList'

describe('CityList', () => {
  it('says so when the country has no cities left on the list', () => {
    render(<CityList cities={[]} />)
    expect(screen.getByText('Городов нет.')).toBeTruthy()
  })

  it('shows development, life level and the shield of a living city', () => {
    render(<CityList cities={[ownCity({ development: 70, life_level: 5500, shield: true })]} />)
    const row = screen.getByText('Москва').closest('tr')!
    expect(within(row).getByText('70 %')).toBeTruthy()
    expect(within(row).getByText('55.00 %')).toBeTruthy()
    expect(within(row).getByTitle('Противоракетный щит')).toBeTruthy()
  })

  it('keeps a destroyed city on the list but hides its numbers', () => {
    render(<CityList cities={[ownCity({ destroyed: true, development: 70 })]} />)
    const row = screen.getByText(/Москва/).closest('tr')!
    expect(row.className).toContain('destroyed')
    expect(within(row).getByText('· разрушен')).toBeTruthy()
    expect(within(row).getAllByText('—')).toHaveLength(2)
    expect(within(row).queryByText('70 %')).toBeNull()
  })

  it('renders every city', () => {
    render(<CityList cities={[ownCity(), ownCity({ id: 'spb', name: 'Петербург' })]} />)
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })
})
