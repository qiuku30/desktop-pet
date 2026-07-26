import test from 'node:test'
import assert from 'node:assert/strict'
import { ITEMS } from './item-config.js'

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
