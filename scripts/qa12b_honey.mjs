/** qa12b — close-up of the honeycomb card only. */
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = '/home/z/my-project/repo/frontend/dist'
mkdirSync(`${ROOT}/play/g1`, { recursive: true })
copyFileSync(`${ROOT}/index.html`, `${ROOT}/play/g1/index.html`)
const server = spawn('python3', ['-m', 'http.server', '8127', '--directory', ROOT, '--bind', '127.0.0.1'])
await new Promise((r) => setTimeout(r, 500))

const cities = [
  { id: 'ekb', name: 'Екатеринбург', development: 195, life_level: 7590, destroyed: false, shield: false },
  { id: 'moscow', name: 'Москва', development: 150, life_level: 6105, destroyed: false, shield: true },
  { id: 'spb', name: 'Санкт-Петербург', development: 70, life_level: 3465, destroyed: false, shield: false },
  { id: 'murmansk', name: 'Мурманск', development: 40, life_level: 0, destroyed: true, shield: false },
]
const me = { id: 'russia', name: 'Россия', budget: 611, average_life_level: 4290, cities, nuclear_tech: true, bombs: 2, bombs_pending: 0, laugh: 5, aid_pending: 0, sanctioned_by: [] }
const usa = { id: 'usa', name: 'США', average_life_level: 6010, laugh: 0, cities: [{ id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6200 }, { id: 'la', name: 'Лос-Анджелес', destroyed: true, life_level: 0 }] }
const news = [
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'ekb', development_before: 170, development_after: 195 },
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'moscow', development_before: 140, development_after: 150 },
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'spb', development_before: 60, development_after: 70 },
]
const opt = (id, over = {}) => ({ id, cost: 0, available: true, reason: null, requires: null, targets: null, max_count: null, max_per_target: null, min_amount: null, ui: { title: id, emoji: '•', description: '' }, ...over })
const actionSpace = { round: 3, country_id: 'russia', budget: 611, actions: { invest: opt('invest', { cost: 150, targets: ['ekb', 'moscow', 'spb'] }), eco_program: opt('eco_program', { cost: 200 }), nuclear_tech: opt('nuclear_tech', { cost: 500 }), bomb: opt('bomb', { cost: 150, max_count: 3 }), strike: opt('strike', { targets: [], max_count: 0 }), shield: opt('shield', { cost: 300, targets: ['ekb', 'moscow', 'spb'], max_per_target: 1 }), sanction: opt('sanction', { targets: ['usa'], max_per_target: 1 }), aid: opt('aid', { targets: ['usa'], min_amount: 1 }) } }
const roundStatus = { round: 3, phase: 'resolving', status: 'active', submitted: { russia: false }, laugh_winner: null }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url()
    const json = (data) => route.fulfill({ json: data })
    if (url.includes('/auth/me')) return json({ game_id: 'g1', role: 'player', country_id: 'russia', name: 'Россия' })
    if (url.includes('/observation')) return json({ round: 3, ecology: 35, me, others: [usa], news, income_forecast: 571 })
    if (url.includes('/action-space')) return json(actionSpace)
    if (url.includes('/round')) return json(roundStatus)
    return json({})
  })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:8127/play/g1')
  await page.waitForSelector('.statusbar')
  await page.click('button[role="tab"]:has-text("Мир")')
  await page.waitForSelector('.citymap-label')
  const card = page.locator('section.card', { hasText: 'Мои города на карте' })
  await card.screenshot({ path: '/home/z/my-project/download/qa12/honeycomb.png' })
  console.log('saved honeycomb.png')
} finally {
  await browser.close()
  server.kill()
}
