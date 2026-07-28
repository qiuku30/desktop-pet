import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ITEMS,
  getItem,
  listFeedableItems,
  listItems,
  listPurchasableItems,
} from './item-config.js'

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
