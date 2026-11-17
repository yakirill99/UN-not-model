/**
 * qa12 — visual proof of the «все замечания» batch:
 *   1. merged news (3 bot investments → one line) on the player's tabs + ticker;
 *   2. hall-mode kind filters as a SWITCH (radio, not on/off stack);
 *   3. auto-refresh + round banner (checked via unit tests; here: pages load);
 *   4. ticker crawling right (CSS sanity via getComputedStyle);
 *   5. the honeycomb city map: touching cells, size by life×dev, crisp HTML labels.
 * Run: node scripts/qa12_visual_pw.mjs  (serves frontend/dist on :8126)
 */
import { spawn } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const ROOT = '/home/z/my-project/repo/frontend/dist'
mkdirSync(`${ROOT}/play/g1`, { recursive: true })
mkdirSync(`${ROOT}/host/g1`, { recursive: true })
copyFileSync(`${ROOT}/index.html`, `${ROOT}/play/g1/index.html`)
copyFileSync(`${ROOT}/index.html`, `${ROOT}/host/g1/index.html`)

const server = spawn('python3', ['-m', 'http.server', '8126', '--directory', ROOT, '--bind', '127.0.0.1'])
await new Promise((r) => setTimeout(r, 600))

const cities = [
  { id: 'ekb', name: 'Екатеринбург', development: 195, life_level: 7590, destroyed: false, shield: false },
  { id: 'moscow', name: 'Москва', development: 150, life_level: 6105, destroyed: false, shield: true },
  { id: 'spb', name: 'Санкт-Петербург', development: 70, life_level: 3465, destroyed: false, shield: false },
  { id: 'murmansk', name: 'Мурманск', development: 40, life_level: 0, destroyed: true, shield: false },
]
const me = {
  id: 'russia', name: 'Россия', budget: 611, average_life_level: 4290,
  cities, nuclear_tech: true, bombs: 2, bombs_pending: 0, laugh: 5, aid_pending: 0, sanctioned_by: [],
}
const usa = {
  id: 'usa', name: 'США', average_life_level: 6010, laugh: 0,
  cities: [
    { id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6200 },
    { id: 'la', name: 'Лос-Анджелес', destroyed: true, life_level: 0 },
  ],
}
const news = [
  { round: 3, schema_version: 1, type: 'nuclear_strike', actor: null, target: 'nyc', outcome: 'absorbed' },
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'ekb', development_before: 170, development_after: 195 },
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'moscow', development_before: 140, development_after: 150 },
  { round: 3, schema_version: 1, type: 'city_invested', actor: 'russia', target: 'spb', development_before: 60, development_after: 70 },
  { round: 3, schema_version: 1, type: 'ecology_changed', cause: 'eco_program', delta: 5, ecology_after: 35 },
]
const observation = { round: 3, ecology: 35, me, others: [usa], news, income_forecast: 571 }

const opt = (id, over = {}) => ({
  id, cost: 0, available: true, reason: null, requires: null, targets: null,
  max_count: null, max_per_target: null, min_amount: null,
  ui: { title: id, emoji: '•', description: '' }, ...over,
})
const actionSpace = {
  round: 3, country_id: 'russia', budget: 611,
  actions: {
    invest: opt('invest', { cost: 150, targets: ['ekb', 'moscow', 'spb', 'murmansk'] }),
    eco_program: opt('eco_program', { cost: 200 }),
    nuclear_tech: opt('nuclear_tech', { cost: 500, available: false, reason: 'already', requires: 'nuclear_tech' }),
    bomb: opt('bomb', { cost: 150, max_count: 3 }),
    strike: opt('strike', { targets: ['nyc', 'la'], max_count: 3, max_per_target: 1 }),
    shield: opt('shield', { cost: 300, targets: ['ekb', 'moscow', 'spb'], max_per_target: 1 }),
    sanction: opt('sanction', { targets: ['usa'], max_per_target: 1 }),
    aid: opt('aid', { targets: ['usa'], min_amount: 1 }),
  },
}
const roundStatus = { round: 3, phase: 'resolving', status: 'active', submitted: { russia: false }, laugh_winner: null }
const gameInfo = {
  id: 'g1', current_round: 2, host_code: 'HOST', mode: 'classic', phase: 'resolving',
  players: [], rounds_total: 8, rules_version: '1.0.0', scenario_id: 'smolny', seed: 7, status: 'active',
  title: 'Пробная партия',
}

const ev = (round, type, rest = {}) => ({ round, schema_version: 1, actor: null, target: null, type, ...rest })
const state = (round, ecology, countries) => ({
  round, ecology, countries, modules: {}, state_schema_version: 1,
})
const log = {
  log_schema_version: 1, rules_version: '1.0.0',
  rules_snapshot: { version: '1.0.0', actions: {} },
  scenario_id: 'smolny', seed: 7,
  initial_state: state(0, 100, [
    { id: 'russia', name: 'Россия', budget: 1000, cities: cities.map((c, i) => ({ ...c, life_level: [5000, 5000, 5000, 5000][i] })), nuclear_tech: false, bombs: 0, bombs_pending: 0, laugh: 0, aid_pending: 0, sanctioned_by: [] },
    { id: 'usa', name: 'США', budget: 1000, cities: usa.cities.map((c) => ({ ...c, life_level: 5000 })), nuclear_tech: false, bombs: 0, bombs_pending: 0, laugh: 0, aid_pending: 0, sanctioned_by: [] },
  ]),
  rounds: [
    {
      round: 1,
      orders: { orders: {}, host: { laugh_winner: null } },
      state_after: state(1, 85, [
        { id: 'russia', name: 'Россия', budget: 900, cities, nuclear_tech: true, bombs: 1, bombs_pending: 0, laugh: 0, aid_pending: 0, sanctioned_by: [] },
        { id: 'usa', name: 'США', budget: 1100, cities: usa.cities, nuclear_tech: false, bombs: 0, bombs_pending: 0, laugh: 0, aid_pending: 0, sanctioned_by: ['russia'] },
      ]),
      events: [
        ev(1, 'city_invested', { actor: 'usa', target: 'nyc', development_before: 60, development_after: 75 }),
        ev(1, 'city_invested', { actor: 'usa', target: 'la', development_before: 40, development_after: 55 }),
        ev(1, 'city_invested', { actor: 'usa', target: 'nyc', development_before: 75, development_after: 95 }),
        ev(1, 'ecology_changed', { cause: 'bomb_production', delta: -15, ecology_after: 85 }),
      ],
    },
    {
      round: 2,
      orders: { orders: {}, host: { laugh_winner: null } },
      state_after: state(2, 70, [
        { id: 'russia', name: 'Россия', budget: 611, cities, nuclear_tech: true, bombs: 2, bombs_pending: 0, laugh: 5, aid_pending: 0, sanctioned_by: [] },
        { id: 'usa', name: 'США', budget: 700, cities: usa.cities, nuclear_tech: false, bombs: 0, bombs_pending: 0, laugh: 0, aid_pending: 0, sanctioned_by: [] },
      ]),
      events: [
        ev(2, 'nuclear_strike', { actor: 'russia', target: 'la', outcome: 'destroyed' }),
        ev(2, 'city_destroyed', { actor: 'russia', target: 'la', cause: 'nuclear_strike' }),
        ev(2, 'aid_transferred', { actor: 'usa', target: 'russia', amount: 200 }),
        ev(2, 'aid_transferred', { actor: 'usa', target: 'russia', amount: 300 }),
        ev(2, 'ecology_changed', { cause: 'eco_program', delta: 30, ecology_after: 70 }),
      ],
    },
  ],
}

let failures = 0
const check = (name, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`)
  if (!cond) failures++
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
  await ctx.route('**/api/**', (route) => {
    const url = route.request().url()
    const json = (data) => route.fulfill({ json: data })
    if (url.includes('/auth/me')) return json({ game_id: 'g1', role: 'player', country_id: 'russia', name: 'Россия' })
    if (url.includes('/observation')) return json(observation)
    if (url.includes('/action-space')) return json(actionSpace)
    if (url.includes('/round')) return json(roundStatus)
    if (url.includes('/log')) return json(log)
    if (url.endsWith('/api/games/g1')) return json(gameInfo)
    return json({})
  })
  const page = await ctx.newPage()

  // --- player page: ticker + tabs -------------------------------------------
  await page.goto('http://127.0.0.1:8126/play/g1')
  await page.waitForSelector('.statusbar')
  const dir = await page.$eval('.ticker-track', (el) => {
    const a = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules] } catch { return [] } })
      .filter((r) => r.name === 'ticker-move')[0]
    if (!a) return 'none'
    const [from, to] = a.cssRules
    return `${from.keyText}=${from.style.transform} → ${to.keyText}=${to.style.transform}`
  })
  check(`п.4 тикер едет вправо медленно (${dir}; duration ${await page.$eval('.ticker-track', (el) => getComputedStyle(el).animationDuration)})`,
    dir.includes('-50%') && (dir.split('→')[1] ?? '').includes('0') && !(dir.split('→')[1] ?? '').includes('-50%') && (await page.$eval('.ticker-track', (el) => getComputedStyle(el).animationDuration)) === '55s')

  // Ticker carries the MERGED investments line, not three lines.
  const tickerText = await page.$eval('.ticker', (el) => el.textContent)
  check('п.1 тикер: одна новость про 3 инвестиции', tickerText.includes('Развитие городов (3)') && !tickerText.split('Развитие городов (3)').slice(1).join('').includes('Развитие города выросло'))

  // --- news tab: merged stories ---------------------------------------------
  await page.click('button[role="tab"]:has-text("Новости")')
  await page.waitForSelector('#panel-news:not([hidden])')
  const newsPanel = await page.$eval('#panel-news', (el) => el.textContent)
  check('п.1 сводка: 3 инвестиции → одна запись «Развитие городов (3)»', newsPanel.includes('Развитие городов (3)'))
  check('п.1 сводка: эффект сложен (60 → 70 % по СПб в перечислении)', newsPanel.includes('Санкт-Петербург 60 % → 70 %'))
  const liCount = await page.$$eval('#panel-news .changes li', (els) => els.length)
  check(`п.1 сводка: записей в «Что изменилось» — ${liCount} (было бы 5 без склейки)`, liCount === 3)
  await page.screenshot({ path: '/home/z/my-project/download/qa12/news-tab.png', clip: { x: 0, y: 0, width: 1440, height: 1000 } })

  // --- world tab: honeycomb --------------------------------------------------
  await page.click('button[role="tab"]:has-text("Мир")')
  await page.waitForSelector('.citymap-label')
  const cells = await page.$$eval('.citymap polygon', (els) => els.length)
  const labels = await page.$$eval('.citymap-label', (els) => els.map((e) => e.textContent))
  const svgTexts = await page.$$eval('.citymap text', (els) => els.length)
  check(`п.5 карта: ${cells} сот в мозаике, подписи HTML (${labels.join(' | ')}), SVG-текста нет`, cells > 40 && svgTexts === 0 && labels.length === 4)
  const cellInfo = await page.$$eval('.citymap polygon', (els) => {
    const pts = els.map((e) => e.getAttribute('points').split(' ').map((p) => p.split(',').map(Number)))
    const areas = pts.map((p) => {
      let s = 0
      for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i]; const [x2, y2] = p[(i + 1) % p.length]; s += x1 * y2 - x2 * y1 }
      return Math.abs(s / 2)
    })
    return { min: Math.min(...areas), max: Math.max(...areas) }
  })
  check(`п.5 соты одинаковые (площадь ${cellInfo.min.toFixed(1)}…${cellInfo.max.toFixed(1)}), размер города = число сот`, cellInfo.max - cellInfo.min < 1)
  await page.screenshot({ path: '/home/z/my-project/download/qa12/world-tab.png', clip: { x: 0, y: 0, width: 1440, height: 1000 } })

  await ctx.close()

  // --- host page: hall filters as a switch -----------------------------------
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 })
  await ctx2.route('**/api/**', (route) => {
    const url = route.request().url()
    const json = (data) => route.fulfill({ json: data })
    if (url.includes('/auth/me')) return json({ game_id: 'g1', role: 'host', country_id: null, name: 'Ведущий' })
    if (url.includes('/log')) return json(log)
    if (url.includes('/round')) return json({ round: 2, phase: 'resolving', status: 'active', submitted: {}, laugh_winner: null })
    if (url.endsWith('/api/games/g1')) return json(gameInfo)
    return json({})
  })
  const page2 = await ctx2.newPage()
  await page2.goto('http://127.0.0.1:8126/host/g1')
  await page2.click('button:has-text("Экран для зала")')
  await page2.waitForSelector('.feed li')
  const allCount = await page2.$$eval('.feed li', (els) => els.length)
  await page2.click('.chips button:has-text("Оружие")')
  const warItems = await page2.$$eval('.feed li', (els) => els.map((e) => e.textContent))
  check(`п.2 фильтр-переключатель: всего ${allCount} → «Оружие» показывает ${warItems.length} (только война)`, allCount === 6 && warItems.length === 2)
  await page2.click('.chips button:has-text("Дипломатия")')
  const dealItems = await page2.$$eval('.feed li', (els) => els.map((e) => e.textContent))
  check(`п.2 переключение: «Дипломатия» заменяет «Оружие» — ${dealItems.length} запись, помощь сложена (${dealItems[0]})`, dealItems.length === 1 && dealItems[0].includes('500 $'))
  await page2.screenshot({ path: '/home/z/my-project/download/qa12/hall-filtered.png', clip: { x: 0, y: 0, width: 1440, height: 1100 } })
  await ctx2.close()
} finally {
  await browser.close()
  server.kill()
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
