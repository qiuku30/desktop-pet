import test from 'node:test'
import assert from 'node:assert/strict'

import { createBirdScheduler } from './farm-bird.mjs'

function createFakeTimers() {
  let nextId = 1
  const timers = new Map()
  return {
    setTimer(callback, delay) {
      const id = nextId++
      timers.set(id, { callback, delay })
      return id
    },
    clearTimer(id) {
      timers.delete(id)
    },
    pending() {
      return [...timers.entries()].map(([id, timer]) => ({ id, ...timer }))
    },
    run(id) {
      const timer = timers.get(id)
      assert.ok(timer, `timer ${id} should exist`)
      timers.delete(id)
      timer.callback()
    },
  }
}

function setup(randomValues = []) {
  const timers = createFakeTimers()
  const appearances = []
  const leaves = []
  let randomIndex = 0
  const scheduler = createBirdScheduler({
    now: () => '2026-07-28T12:00:00.000Z',
    random: () => randomValues[randomIndex++] ?? 0,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    onAppear: bird => appearances.push(bird),
    onLeave: bird => leaves.push(bird),
  })
  return { scheduler, timers, appearances, leaves }
}

test('首次出现延迟为 2–5 分钟，停留 8–12 秒', () => {
  const { scheduler, timers, appearances, leaves } = setup([0, 0])

  scheduler.start({ dailyCount: 0 })
  const [appearanceTimer] = timers.pending()
  assert.equal(appearanceTimer.delay, 2 * 60_000)

  timers.run(appearanceTimer.id)
  assert.equal(appearances.length, 1)
  assert.match(appearances[0].birdId, /^bird:/)
  const [leaveTimer] = timers.pending()
  assert.equal(leaveTimer.delay, 8_000)

  timers.run(leaveTimer.id)
  assert.deepEqual(leaves, [appearances[0]])
})

test('随机值上界映射到首次 5 分钟、后续 12 分钟与停留 12 秒', () => {
  const { scheduler, timers } = setup([0.999999, 0.999999, 0.999999])

  scheduler.start({ dailyCount: 0 })
  const [firstTimer] = timers.pending()
  assert.equal(firstTimer.delay, 5 * 60_000)
  timers.run(firstTimer.id)

  const [leaveTimer] = timers.pending()
  assert.equal(leaveTimer.delay, 12_000)
  timers.run(leaveTimer.id)

  const [nextTimer] = timers.pending()
  assert.equal(nextTimer.delay, 12 * 60_000)
})

test('同一时间最多出现一只，重复 start 不增加 timer', () => {
  const { scheduler, timers, appearances } = setup()

  scheduler.start({ dailyCount: 0 })
  scheduler.start({ dailyCount: 0 })
  assert.equal(timers.pending().length, 1)

  timers.run(timers.pending()[0].id)
  scheduler.start({ dailyCount: 0 })
  assert.equal(appearances.length, 1)
  assert.equal(timers.pending().length, 1)
})

test('成功领取后移除当前小鸟并按后续区间重新安排', () => {
  const { scheduler, timers, appearances, leaves } = setup([0, 0, 0])

  scheduler.start({ dailyCount: 0 })
  timers.run(timers.pending()[0].id)
  const bird = appearances[0]

  scheduler.claimed({ birdId: bird.birdId, dailyCount: 1 })
  assert.deepEqual(leaves, [bird])
  assert.equal(timers.pending().length, 1)
  assert.equal(timers.pending()[0].delay, 5 * 60_000)
})

test('隐藏时取消 timer 和当前小鸟，恢复可见后重新按首次区间安排', () => {
  const { scheduler, timers, appearances, leaves } = setup()

  scheduler.start({ dailyCount: 0 })
  scheduler.setVisible(false, { dailyCount: 0 })
  assert.equal(timers.pending().length, 0)

  scheduler.setVisible(true, { dailyCount: 0 })
  timers.run(timers.pending()[0].id)
  scheduler.setVisible(false, { dailyCount: 0 })
  assert.deepEqual(leaves, [appearances[0]])
  assert.equal(timers.pending().length, 0)
})

test('达到每日 10 次上限时不安排，领取第 10 次后也不再安排', () => {
  const capped = setup()
  capped.scheduler.start({ dailyCount: 10 })
  assert.equal(capped.timers.pending().length, 0)
  capped.scheduler.start({ dailyCount: 0 })
  assert.equal(capped.timers.pending().length, 1)

  const finalClaim = setup()
  finalClaim.scheduler.start({ dailyCount: 9 })
  finalClaim.timers.run(finalClaim.timers.pending()[0].id)
  finalClaim.scheduler.claimed({
    birdId: finalClaim.appearances[0].birdId,
    dailyCount: 10,
  })
  assert.equal(finalClaim.timers.pending().length, 0)
})

test('第 10 次领取跨过自然离场后仍取消下一只及其迟到 callback', () => {
  const pendingClaim = setup([0, 0, 0])
  pendingClaim.scheduler.start({ dailyCount: 9 })
  pendingClaim.timers.run(pendingClaim.timers.pending()[0].id)
  const claimedBird = pendingClaim.appearances[0]

  pendingClaim.timers.run(pendingClaim.timers.pending()[0].id)
  const [nextAppearance] = pendingClaim.timers.pending()
  const staleCallback = nextAppearance.callback

  pendingClaim.scheduler.claimed({ birdId: claimedBird.birdId, dailyCount: 10 })
  assert.equal(pendingClaim.timers.pending().length, 0)

  staleCallback()
  assert.equal(pendingClaim.appearances.length, 1)
})

test('destroy 清理全部状态，迟到 callback 不再出现或离开', () => {
  const { scheduler, timers, appearances, leaves } = setup()

  scheduler.start({ dailyCount: 0 })
  const staleCallback = timers.pending()[0].callback
  scheduler.destroy()
  assert.equal(timers.pending().length, 0)

  staleCallback()
  assert.equal(appearances.length, 0)
  assert.equal(leaves.length, 0)
  scheduler.start({ dailyCount: 0 })
  assert.equal(timers.pending().length, 0)
})
