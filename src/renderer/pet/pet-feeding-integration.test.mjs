import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const petSource = await readFile(new URL('./pet.js', import.meta.url), 'utf8')
const dashboardSource = await readFile(new URL('../dashboard/dashboard.js', import.meta.url), 'utf8')

test('pet feeding uses universal inventory and one atomic commit', () => {
  assert.doesNotMatch(petSource, /foodInventory/)
  assert.match(petSource, /listFeedableItems\(\)/)
  assert.match(petSource, /PetState\.setMany\(transaction\.updates\)/)
  const feedStart = petSource.indexOf('_unsubMenuFeed = window.electronAPI.onMenuFeed')
  const feedEnd = petSource.indexOf('// 右键菜单 — 状态', feedStart)
  const feedSource = petSource.slice(feedStart, feedEnd)
  assert.doesNotMatch(feedSource, /PetState\.set\('(satiety|intimacy|mood|exp|level)'/)
})

test('PET_FED emits only after synchronous setMany succeeds in both feeding paths', () => {
  for (const source of [petSource, dashboardSource]) {
    const commitIndex = source.indexOf('PetState.setMany(transaction.updates)')
    const emitIndex = source.indexOf('emitFed(', commitIndex)
    assert.ok(commitIndex >= 0)
    assert.ok(emitIndex > commitIndex)
  }
})

test('pet preserves feed level source and eat then happy runtime ordering', () => {
  const sourceMarker = petSource.indexOf("levelChangeSource = 'feed'")
  const commitMarker = petSource.indexOf('PetState.setMany(transaction.updates)', sourceMarker)
  const clearMarker = petSource.indexOf('levelChangeSource = null', commitMarker)
  const animationMarker = petSource.indexOf('animationRuntime?.playFeedResult', clearMarker)
  assert.ok(sourceMarker >= 0)
  assert.ok(commitMarker > sourceMarker)
  assert.ok(clearMarker > commitMarker)
  assert.ok(animationMarker > clearMarker)
  assert.match(petSource, /playFeedResult\(\{ leveledUp: transaction\.leveledUp \}\)/)
})
