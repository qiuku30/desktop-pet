import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  ITEM_ICON_FALLBACK_SRC,
  ITEMS,
  getItem,
  listFeedableItems,
  listItems,
  listPurchasableItems,
} from './item-config.js'

const ICON_FILES = Object.freeze({
  'seed:wheat': 'seed-wheat.webp',
  'seed:carrot': 'seed-carrot.webp',
  'seed:corn': 'seed-corn.webp',
  'seed:strawberry': 'seed-strawberry.webp',
  'seed:pumpkin': 'seed-pumpkin.webp',
  'seed:star-dew-fruit': 'seed-star-dew-fruit.webp',
  'crop:wheat': 'crop-wheat.webp',
  'crop:carrot': 'crop-carrot.webp',
  'crop:corn': 'crop-corn.webp',
  'crop:strawberry': 'crop-strawberry.webp',
  'crop:pumpkin': 'crop-pumpkin.webp',
  'crop:star-dew-fruit': 'crop-star-dew-fruit.webp',
  'food:apple': 'food-apple.webp',
  'food:cake': 'food-cake.webp',
  'food:fish': 'food-fish.webp',
  'food:milk': 'food-milk.webp',
  'food:cookie': 'food-cookie.webp',
  'food:popcorn': 'food-popcorn.webp',
  'food:carrot-juice': 'food-carrot-juice.webp',
  'food:strawberry-milkshake': 'food-strawberry-milkshake.webp',
  'food:pumpkin-pie': 'food-pumpkin-pie.webp',
})

test('catalog exposes exact immutable project icon URLs without changing business fields', () => {
  assert.equal(Object.keys(ITEMS).length, Object.keys(ICON_FILES).length)
  for (const [id, filename] of Object.entries(ICON_FILES)) {
    assert.equal(new URL(ITEMS[id].iconSrc).pathname.endsWith(`/ui/items/${filename}`), true)
  }
  assert.equal(new URL(ITEM_ICON_FALLBACK_SRC).pathname.endsWith('/ui/items/fallback.webp'), true)

  const legacy = Object.fromEntries(Object.entries(ITEMS).map(([id, value]) => {
    const { iconSrc, ...business } = value
    return [id, business]
  }))
  assert.equal(
    createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
    '2fb1a2572cd80567e3c35ab2177d402fb402da3b8e599c5c05ddffa2e162f21b',
  )
  assert.equal(Object.isFrozen(ITEMS), true)
  for (const entry of Object.values(ITEMS)) {
    assert.equal(Object.isFrozen(entry), true)
    if (entry.feed) assert.equal(Object.isFrozen(entry.feed), true)
    assert.equal(Object.isFrozen(entry.tooltipFields), true)
  }
})

test('item table contains stable IDs for every launch crop seed and output', () => {
  for (const name of ['wheat', 'carrot', 'corn', 'strawberry', 'pumpkin', 'star-dew-fruit']) {
    assert.equal(ITEMS[`seed:${name}`].category, 'seed')
    assert.equal(ITEMS[`crop:${name}`].category, 'crop')
  }
  for (const id of ['food:cookie', 'food:popcorn', 'food:carrot-juice', 'food:strawberry-milkshake', 'food:pumpkin-pie']) {
    assert.equal(ITEMS[id].category, 'food')
  }
})

test('feedable farm items use the exact approved effects', () => {
  assert.deepEqual(ITEMS['crop:carrot'].feed, { satiety: 8, exp: 3, intimacy: 3 })
  assert.deepEqual(ITEMS['crop:star-dew-fruit'].feed, { satiety: 35, exp: 30, intimacy: 8 })
  assert.deepEqual(ITEMS['food:pumpkin-pie'].feed, { satiety: 60, exp: 50, intimacy: 15 })
  assert.equal(ITEMS['crop:wheat'].feed, null)
  assert.equal(ITEMS['crop:pumpkin'].feed, null)
})

test('catalog helpers expose flattened feed and commerce capabilities', () => {
  assert.equal(getItem('food:milk').buyPrice, 10)
  assert.equal(getItem('seed:wheat').buyPrice, 4)
  assert.equal(getItem('seed:corn').unlockFarmLevel, 2)
  assert.equal(getItem('crop:carrot').intimacy, 3)
  assert.equal(getItem('crop:wheat').satiety, undefined)
  assert.equal(getItem('missing:item'), null)
  assert.equal(listItems().length, Object.keys(ITEMS).length)
  assert.deepEqual(
    listFeedableItems().map(item => item.id).sort(),
    [
      'crop:carrot', 'crop:corn', 'crop:star-dew-fruit', 'crop:strawberry',
      'food:apple', 'food:cake', 'food:carrot-juice', 'food:cookie', 'food:fish',
      'food:milk', 'food:popcorn', 'food:pumpkin-pie', 'food:strawberry-milkshake',
    ],
  )
  assert.deepEqual(
    listPurchasableItems().map(item => item.id).sort(),
    [
      'food:apple', 'food:cake', 'food:cookie', 'food:fish', 'food:milk',
      'seed:carrot', 'seed:corn', 'seed:pumpkin', 'seed:star-dew-fruit',
      'seed:strawberry', 'seed:wheat',
    ],
  )
})

test('catalog configures tooltip fields from feed and sell capabilities', () => {
  assert.deepEqual(getItem('food:milk').tooltipFields, ['satiety', 'exp', 'sellPrice'])
  assert.deepEqual(getItem('crop:carrot').tooltipFields, ['satiety', 'exp', 'sellPrice'])
  assert.deepEqual(getItem('food:pumpkin-pie').tooltipFields, ['satiety', 'exp', 'sellPrice'])
  assert.deepEqual(getItem('crop:wheat').tooltipFields, ['sellPrice'])
  assert.deepEqual(getItem('seed:wheat').tooltipFields, [])
  for (const entry of listFeedableItems()) {
    assert.deepEqual(entry.tooltipFields.slice(0, 2), ['satiety', 'exp'])
    if (Number.isFinite(entry.sellPrice)) assert.ok(entry.tooltipFields.includes('sellPrice'))
  }
})
