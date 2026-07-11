import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  distance, isCursorNear, fleeCenter, wanderTarget,
  centerToTopLeft, topLeftToCenter,
} from './pet-motion.mjs'

test('distance: 3-4-5 直角三角形', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
})

test('isCursorNear: 阈值内为 true, 阈值外为 false', () => {
  const center = { x: 100, y: 100 }
  assert.equal(isCursorNear(center, { x: 150, y: 100 }, 120), true)
  assert.equal(isCursorNear(center, { x: 300, y: 100 }, 120), false)
})

test('fleeCenter: 沿光标反方向弹开 push 距离', () => {
  // 光标在左, 宠物应向右弹开正好 push
  const out = fleeCenter({ x: 100, y: 100 }, { x: 50, y: 100 }, 150)
  assert.equal(out.x, 250)
  assert.equal(out.y, 100)
})

test('fleeCenter: 光标与中心重合时朝正上方弹', () => {
  const out = fleeCenter({ x: 100, y: 100 }, { x: 100, y: 100 }, 150)
  assert.equal(out.x, 100)
  assert.equal(out.y, -50)
})

test('wanderTarget: rand 注入下确定性输出, 落在 radius 内', () => {
  // rand 依次返回 0 (角度 0) 和 1 (半径=radius) —— 用队列模拟
  const seq = [0, 1]
  let i = 0
  const rand = () => seq[i++]
  const out = wanderTarget({ x: 100, y: 100 }, 200, rand)
  assert.equal(out.x, 300) // cos(0)*200 = 200
  assert.equal(Math.round(out.y), 100) // sin(0)*200 = 0
})

test('centerToTopLeft / topLeftToCenter 互逆', () => {
  const win = { w: 200, h: 200 }
  const tl = centerToTopLeft({ x: 500, y: 400 }, win)
  assert.deepEqual(tl, { x: 400, y: 300 })
  assert.deepEqual(topLeftToCenter(tl, win), { x: 500, y: 400 })
})
