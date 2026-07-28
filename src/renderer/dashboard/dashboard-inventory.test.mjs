import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

import { WAREHOUSE_CATEGORIES } from './nav-config.js'
import { getItem } from '../shared/item-config.js'
import { addItems, removeItems } from '../shared/inventory-service.js'

const dashboardSource = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8')

function loadTransactionHelpers() {
  const match = dashboardSource.match(
    /\/\/ inventory transaction helpers:start([\s\S]*?)\/\/ inventory transaction helpers:end/,
  )
  assert.ok(match, 'dashboard inventory transaction helpers must exist')
  const source = `${match[1].replaceAll('export function', 'function')}
    globalThis.helpers = { sellInventoryItem, destroyInventoryItem, buyInventoryItem };`
  const context = { addItems, removeItems }
  vm.runInNewContext(source, context)
  return context.helpers
}

function loadTooltipHelpers() {
  const match = dashboardSource.match(
    /\/\/ tooltip behavior helpers:start([\s\S]*?)\/\/ tooltip behavior helpers:end/,
  )
  assert.ok(match, 'dashboard tooltip behavior helpers must exist')
  const source = `${match[1].replaceAll('export function', 'function')}
    globalThis.helpers = { buildShopTooltipItem, buildTooltipHTML, calculateTooltipHeight };`
  const context = {
    FEED_CONFIG: { intimacyPerFeed: 5 },
    TOOLTIP_FIELDS: {
      satiety: { label: '饱腹', icon: '🍽' },
      exp: { label: '经验', icon: '⭐' },
      sellPrice: { label: '售价', icon: '🪙' },
      buyPrice: { label: '购买价', icon: '💰' },
    },
  }
  vm.runInNewContext(source, context)
  return context.helpers
}

test('warehouse categories are exactly all, food, crop, seed and material', () => {
  assert.deepEqual(
    WAREHOUSE_CATEGORIES.map(category => category.id),
    ['all', 'food', 'crop', 'seed', 'material'],
  )
})

test('selling three crops returns one atomic inventory and coins update', () => {
  const { sellInventoryItem } = loadTransactionHelpers()
  const result = sellInventoryItem({
    inventory: { 'crop:carrot': 5 },
    coins: 10,
    item: getItem('crop:carrot'),
    quantity: 3,
  })
  assert.equal(JSON.stringify(result), JSON.stringify({
    ok: true,
    updates: { inventory: { 'crop:carrot': 2 }, coins: 22 },
  }))
})

test('destroying all seeds removes the item without touching coins', () => {
  const { destroyInventoryItem } = loadTransactionHelpers()
  const result = destroyInventoryItem({
    inventory: { 'seed:wheat': 4 },
    itemId: 'seed:wheat',
    quantity: 4,
  })
  assert.equal(JSON.stringify(result), JSON.stringify({
    ok: true,
    updates: { inventory: {} },
  }))
})

test('batch purchase supports unlocked seeds and existing food', () => {
  const { buyInventoryItem } = loadTransactionHelpers()
  assert.equal(JSON.stringify(buyInventoryItem({
    inventory: {},
    coins: 20,
    item: getItem('seed:wheat'),
    quantity: 3,
    farmLevel: 1,
  })), JSON.stringify({
    ok: true,
    updates: { inventory: { 'seed:wheat': 3 }, coins: 8 },
  }))
  assert.equal(JSON.stringify(buyInventoryItem({
    inventory: { 'food:milk': 1 },
    coins: 30,
    item: getItem('food:milk'),
    quantity: 2,
    farmLevel: 1,
  })), JSON.stringify({
    ok: true,
    updates: { inventory: { 'food:milk': 3 }, coins: 10 },
  }))
})

test('locked seed metadata stays visible and transaction rejects it', () => {
  const { buyInventoryItem } = loadTransactionHelpers()
  const seed = getItem('seed:corn')
  assert.equal(seed.unlockFarmLevel, 2)
  assert.equal(
    JSON.stringify(buyInventoryItem({
      inventory: {},
      coins: 100,
      item: seed,
      quantity: 1,
      farmLevel: 1,
    })),
    JSON.stringify({ ok: false, error: 'ITEM_LOCKED' }),
  )
})

test('transactions reject invalid quantity, missing stock, coins and unsafe totals', () => {
  const { sellInventoryItem, destroyInventoryItem, buyInventoryItem } = loadTransactionHelpers()
  assert.equal(sellInventoryItem({
    inventory: { 'crop:carrot': 1 }, coins: 0, item: getItem('crop:carrot'), quantity: 0,
  }).error, 'INVALID_QUANTITY')
  assert.equal(destroyInventoryItem({
    inventory: {}, itemId: 'seed:wheat', quantity: 1,
  }).error, 'INSUFFICIENT_ITEMS')
  assert.equal(buyInventoryItem({
    inventory: {}, coins: 3, item: getItem('seed:wheat'), quantity: 1, farmLevel: 1,
  }).error, 'INSUFFICIENT_COINS')
  assert.equal(sellInventoryItem({
    inventory: { 'crop:star-dew-fruit': 1 },
    coins: Number.MAX_SAFE_INTEGER,
    item: getItem('crop:star-dew-fruit'),
    quantity: 1,
  }).error, 'INVALID_QUANTITY')
  assert.equal(buyInventoryItem({
    inventory: { 'food:milk': Number.MAX_SAFE_INTEGER },
    coins: 10,
    item: getItem('food:milk'),
    quantity: 1,
    farmLevel: 1,
  }).error, 'INVALID_QUANTITY')
})

test('Dashboard inventory consumers use universal inventory and atomic commits', () => {
  assert.doesNotMatch(dashboardSource, /PetState\.get\('foodInventory'\)/)
  assert.doesNotMatch(dashboardSource, /PetState\.set\('foodInventory'/)
  assert.match(dashboardSource, /农场 Lv\.\$\{item\.unlockFarmLevel\} 解锁/)
  assert.match(dashboardSource, /PetState\.setMany\(transaction\.updates\)/)
  assert.match(dashboardSource, /data-overlay-quantity-action=/)
})

test('Dashboard quick feeding uses one setMany and emits after commit', () => {
  const feedStart = dashboardSource.indexOf('function handleFeed')
  const feedEnd = dashboardSource.indexOf('function buildTooltipHTML', feedStart)
  const feedSource = dashboardSource.slice(feedStart, feedEnd)
  assert.match(feedSource, /PetState\.setMany\(transaction\.updates\)/)
  assert.doesNotMatch(feedSource, /PetState\.set\(/)
  assert.ok(feedSource.indexOf('emitFed(') > feedSource.indexOf('PetState.setMany(transaction.updates)'))
})

test('tooltip renders configured feed effects, commerce, real intimacy and matching height', () => {
  const { buildShopTooltipItem, buildTooltipHTML, calculateTooltipHeight } = loadTooltipHelpers()
  const cases = [
    {
      item: getItem('food:milk'),
      contains: ['饱腹</span><span style="color:#7eb">+15', '经验</span><span style="color:#7eb">+10', '售价</span><span style="color:#7eb">3', '亲密度</span><span style="color:#7eb">+5'],
      height: 130,
    },
    {
      item: getItem('crop:carrot'),
      contains: ['亲密度</span><span style="color:#7eb">+3'],
      height: 130,
    },
    {
      item: getItem('food:pumpkin-pie'),
      contains: ['亲密度</span><span style="color:#7eb">+15'],
      height: 130,
    },
    {
      item: getItem('crop:wheat'),
      contains: ['售价</span><span style="color:#7eb">2'],
      excludes: ['亲密度'],
      height: 70,
    },
  ]
  for (const entry of cases) {
    const html = buildTooltipHTML(entry.item)
    for (const text of entry.contains) assert.ok(html.includes(text), `missing tooltip text: ${text}`)
    for (const text of entry.excludes || []) assert.ok(!html.includes(text), `unexpected tooltip text: ${text}`)
    assert.equal(calculateTooltipHeight(entry.item), entry.height)
  }

  const milkShop = buildShopTooltipItem(getItem('food:milk'))
  const milkShopHTML = buildTooltipHTML(milkShop)
  assert.match(milkShopHTML, /购买价<\/span><span style="color:#7eb">10/)
  assert.doesNotMatch(milkShopHTML, /售价<\/span>/)
  assert.equal(calculateTooltipHeight(milkShop), 130)

  const seedShop = buildShopTooltipItem(getItem('seed:wheat'))
  const seedShopHTML = buildTooltipHTML(seedShop)
  assert.match(seedShopHTML, /购买价<\/span><span style="color:#7eb">4/)
  assert.doesNotMatch(seedShopHTML, /亲密度/)
  assert.equal(calculateTooltipHeight(seedShop), 70)
})
