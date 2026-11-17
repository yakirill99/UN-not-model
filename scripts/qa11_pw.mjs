/**
 * QA-пруфы для PR «quick wins #4»: шестигранники, флаг по бокам, тикер,
 * имена в новостях, ранг-бары, города других стран, дуги ударов, замок бомбы,
 * прогноз дохода, страница правил.
 * Запуск: node /home/z/my-project/scripts/qa11_pw.mjs   (dist уже собран и
 * раздаётся: python3 -m http.server 8125 -d frontend/dist)
 */
import { chromium } from '/home/z/.npm-global/lib/node_modules/playwright/index.mjs'

const BASE = 'http://localhost:8125'
const OUT = '/home/z/my-project/download'

const OBS = {
  round: 2,
  ecology: 88,
  income_forecast: 615,
  me: {
    id: 'russia', name: 'Россия', budget: 1445, average_life_level: 4567,
    cities: [
      { id: 'moscow', name: 'Москва', development: 125, life_level: 5000, destroyed: false, shield: false },
      { id: 'spb', name: 'Санкт-Петербург', development: 60, life_level: 4000, destroyed: false, shield: true },
      { id: 'ekb', name: 'Екатеринбург', development: 200, life_level: 6200, destroyed: false, shield: false },
      { id: 'rostov', name: 'Ростов-на-Дону', development: 90, life_level: 0, destroyed: true, shield: false },
    ],
    nuclear_tech: true, bombs: 2, bombs_pending: 1, laugh: 0, aid_pending: 0,
    sanctioned_by: ['США'],
  },
  others: [
    { id: 'usa', name: 'США', average_life_level: 6000, laugh: 0, cities: [
      { id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6000 },
      { id: 'la', name: 'Лос-Анджелес', destroyed: true, life_level: 0 },
    ] },
    { id: 'france', name: 'Франция', average_life_level: 4500, laugh: 2, cities: [{ id: 'paris', name: 'Париж', destroyed: false, life_level: 4500 }] },
    { id: 'iran', name: 'Иран', average_life_level: 3000, laugh: 0, cities: [{ id: 'tehran', name: 'Тегеран', destroyed: false, life_level: 3000 }] },
    { id: 'dprk', name: 'КНДР', average_life_level: 2200, laugh: 0, cities: [{ id: 'pyongyang', name: 'Пхеньян', destroyed: false, life_level: 2200 }] },
  ],
  news: [
    { type: 'nuclear_strike', round: 2, schema_version: 1, actor: 'russia', target: 'nyc', outcome: 'destroyed' },
    { type: 'nuclear_strike', round: 2, schema_version: 1, actor: null, target: 'spb', outcome: 'absorbed' },
    { type: 'sanction_applied', round: 2, schema_version: 1, actor: 'usa', target: 'russia', delta: 5 },
    { type: 'aid_transferred', round: 2, schema_version: 1, actor: 'france', target: 'iran', amount: 200 },
    { type: 'income_credited', round: 2, schema_version: 1, actor: 'russia', amount: 615, budget_after: 1445 },
  ],
}

const ACTIONS = (nuclearTechAvailable) => ({
  round: 2, country_id: 'russia', budget: 1445,
  actions: {
    invest: { ui: { title: 'Инвестировать в развитие города', emoji: '🌆', description: '' }, cost: 150, available: true, reason: null, requires: null, targets: ['moscow', 'spb', 'ekb'], max_count: null, max_per_target: null, min_amount: null },
    eco_program: { ui: { title: 'Запустить экологическую программу', emoji: '♻️', description: '' }, cost: 200, available: true, reason: null, requires: null, targets: null, max_count: null, max_per_target: null, min_amount: null },
    nuclear_tech: { ui: { title: 'Разработать ядерную технологию', emoji: '☢️', description: '' }, cost: 500, available: nuclearTechAvailable, reason: nuclearTechAvailable ? 'already_owned' : null, requires: null, targets: null, max_count: null, max_per_target: null, min_amount: null },
    bomb: { ui: { title: 'Произвести ядерные бомбы', emoji: '💣', description: '' }, cost: 150, available: nuclearTechAvailable, reason: nuclearTechAvailable ? null : 'requires_nuclear_tech', requires: null, targets: null, max_count: 3, max_per_target: null, min_amount: null },
    strike: { ui: { title: 'Нанести ядерный удар', emoji: '🚀', description: '' }, cost: 0, available: nuclearTechAvailable, reason: nuclearTechAvailable ? null : 'no_bombs', requires: null, targets: ['usa', 'france', 'iran', 'dprk'], max_count: 2, max_per_target: 1, min_amount: null },
    shield: { ui: { title: 'Построить ядерный щит', emoji: '🛡️', description: '' }, cost: 300, available: true, reason: null, requires: null, targets: ['moscow', 'spb'], max_count: null, max_per_target: 1, min_amount: null },
    sanction: { ui: { title: 'Наложить экономические санкции', emoji: '❌', description: '' }, cost: 0, available: true, reason: null, requires: null, targets: ['usa', 'france', 'iran', 'dprk'], max_count: null, max_per_target: 1, min_amount: null },
    aid: { ui: { title: 'Материальная помощь', emoji: '💸', description: '' }, cost: 0, available: true, reason: null, requires: null, targets: ['usa', 'france', 'iran', 'dprk'], max_count: null, max_per_target: null, min_amount: 1 },
  },
})

let nuclearTechAvailable = true
const browser = await chromium.launch()

async function newPage(viewport) {
  const page = await browser.newPage({ viewport })
  await page.route('**/api/auth/me', (r) => r.fulfill({ contentType: 'application/json', body: '{}', status: 403 }))
  await page.route('**/api/auth/join', (r) =>
    r.fulfill({ contentType: 'application/json', body: JSON.stringify({ principal: { game_id: 'g1', role: 'player', country_id: 'russia' } }) }))
  await page.route('**/api/games/g1/observation', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(OBS) }))
  await page.route('**/api/games/g1/action-space', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(ACTIONS(nuclearTechAvailable)) }))
  await page.route('**/api/games/g1/round', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ round: 2, phase: 'orders', status: 'active', submitted: { russia: false }, laugh_winner: null }) }))
  await page.goto(BASE)
  await page.getByLabel('Код').fill('DEMO01')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('**/play/g1')
  await page.getByRole('heading', { name: 'Россия' }).waitFor()
  return page
}

const ok = (cond, label) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)

// ---------- 2K: флаг по бокам, центр чистый; тикер; прогноз ----------
const two = await newPage({ width: 2560, height: 1200 })
const flagDisplay = await two.evaluate(() => getComputedStyle(document.querySelector('.flag-bg')).display)
const stripe = await two.evaluate(() => {
  const s = getComputedStyle(document.querySelector('.flag-bg'), '::before')
  return { width: parseFloat(s.width), opacity: Number(s.opacity), display: s.display }
})
ok(flagDisplay === 'block', `2K: флаг-слой включён (display=${flagDisplay})`)
ok(stripe.width === 352, `2K: боковая полоса флага — потолок 22rem (${stripe.width}px)`)
ok(stripe.opacity > 0.1, `2K: флаг видно (${stripe.opacity})`)
const appBox = await two.evaluate(() => {
  const b = document.querySelector('.app').getBoundingClientRect()
  return { left: b.left, right: b.right, width: b.width }
})
ok(appBox.left >= stripe.width, `2K: контент не залезает на флаг (app left=${Math.round(appBox.left)} > stripe=${Math.round(stripe.width)})`)
const ticker = two.locator('.ticker')
await ticker.waitFor()
ok((await ticker.textContent()).includes('удар'), 'тикер в шапке несёт события раунда')
const stripText = await two.locator('.statusbar').textContent()
ok(stripText.includes('Доход') && stripText.includes('615'), `прогноз дохода в плашке: ${stripText.match(/Доход ≈ [\d\s$]+/)?.[0]}`)
await two.screenshot({ path: `${OUT}/qa11-2k-country.png`, fullPage: false })

// ---------- 2K мир: шестигранники, дуги ударов ----------
await two.getByRole('tab', { name: 'Мир' }).click()
await two.locator('.world-map .ctr.us').first().waitFor()
const hexes = await two.locator('.citymap polygon.cell').count()
const rects = await two.locator('.citymap rect.cell').count()
ok(hexes >= 4 && rects === 0, `города — шестигранники (polygon=${hexes}, rect=${rects})`)
const rotated = await two.locator('.citymap text[transform]').count()
ok(rotated === 0, 'перевёрнутого текста нет (text[transform]=0)')
const arcs = await two.locator('.world-map .arc').count()
const booms = await two.locator('.world-map .boom').count()
ok(arcs === 2 && booms === 2, `дуги ударов на карте (arc=${arcs}, boom=${booms})`)
await two.screenshot({ path: `${OUT}/qa11-2k-world.png`, fullPage: true })
// тёмная тема
await two.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await two.waitForTimeout(200)
await two.screenshot({ path: `${OUT}/qa11-2k-world-dark.png`, fullPage: false })
await two.close()

// ---------- ноутбук: участники, новости ----------
const lap = await newPage({ width: 900, height: 1100 })
await lap.getByRole('tab', { name: 'Участники' }).click()
const bars = await lap.locator('.rankbars .bar-row').count()
ok(bars === 5, `ранг-диаграмма: 4 страны + «Вы» (bar-row=${bars})`)
const chips = await lap.locator('.city-chips .chip').count()
const gone = await lap.locator('.city-chips .chip.gone').count()
ok(chips === 5 && gone === 1, `города других стран чипами (chips=${chips}, разрушено=${gone})`)
const meRow = await lap.locator('.rankbars .bar-row.me .bar-name').textContent()
ok(meRow.includes('Вы'), 'в диаграмме есть строка «Вы»')
await lap.screenshot({ path: `${OUT}/qa11-others.png`, fullPage: true })

await lap.getByRole('tab', { name: 'Новости' }).click()
const newsText = await lap.locator('#panel-news').textContent()
ok(newsText.includes('Санкт-Петербург') && !newsText.includes('над городом spb'), 'новости говорят именами, не id')
ok(newsText.includes('Санкции от США → Россия'), `автор санкций назван: ${newsText.match(/Санкции от США → Россия[^,]*/)?.[0] ?? '—'}`)
ok(newsText.includes('Помощь 200 $: Франция → Иран'), 'помощь с именами донора и получателя')
await lap.screenshot({ path: `${OUT}/qa11-news.png`, fullPage: true })
await lap.close()

// ---------- телефон ----------
const phone = await newPage({ width: 375, height: 800 })
await phone.getByRole('tab', { name: 'Мир' }).click()
await phone.locator('.world-map .ctr.us').first().waitFor()
const phoneFlag = await phone.evaluate(() => getComputedStyle(document.querySelector('.flag-bg')).display)
ok(phoneFlag === 'none', `телефон: флага нет, центр чистый (display=${phoneFlag})`)
await phone.screenshot({ path: `${OUT}/qa11-phone-world.png`, fullPage: false })
await phone.close()

// ---------- замок бомбы (переключаем сценарий: технологии нет) ----------
nuclearTechAvailable = false
const lock = await newPage({ width: 820, height: 1100 })
const lockIcons = await lock.locator('img[src*="/icons/lock.svg"]').count()
ok(lockIcons >= 1, `замок на бомбе без технологии (lock icons=${lockIcons})`)
await lock.locator('.action.off').first().scrollIntoViewIfNeeded()
await lock.screenshot({ path: `${OUT}/qa11-bomb-lock.png`, fullPage: false })
await lock.close()

// ---------- страница правил (кнопка в шапке игровой страницы, SPA-роутинг) ----
const rules = await newPage({ width: 900, height: 1000 })
await rules.getByRole('button', { name: 'Правила' }).click()
await rules.getByRole('heading', { name: 'Правила' }).waitFor()
const rows = await rules.locator('.rules-table tbody tr').count()
ok(rows >= 8, `страница правил: все действия в таблице (${rows} строк)`)
await rules.screenshot({ path: `${OUT}/qa11-rules.png`, fullPage: true })
await rules.close()

await browser.close()
console.log('qa11 done')
