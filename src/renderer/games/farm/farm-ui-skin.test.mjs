import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildFarmUiSkin } from './farm-ui-skin.mjs'

const manifestUrl = new URL('../../assets/farm/bright-homestead/farm.json', import.meta.url).href
const manifest = JSON.parse(await readFile(new URL(manifestUrl), 'utf8'))

test('real manifest yields all approved immutable UI records', () => {
  const before = structuredClone(manifest)
  const result = buildFarmUiSkin(manifest, manifestUrl)
  assert.deepEqual(result.errors, [])
  assert.equal(Object.keys(result.catalog.itemIcons).length, 18)
  assert.equal(result.catalog.itemIcons['crop:wheat'].src.endsWith('/ui/items/crop-wheat.webp'), true)
  assert.equal(result.catalog.workshop.machine.gearSheet.frameCount, 4)
  assert.equal(result.catalog.orders.board.src.endsWith('/ui/orders/board.webp'), true)
  assert.equal(Object.isFrozen(result), true)
  assert.equal(Object.isFrozen(result.catalog.itemIcons['crop:wheat']), true)
  assert.equal(Object.isFrozen(result.catalog.workshop.machine.gearSheet), true)
  assert.deepEqual(manifest, before)
})

test('missing optional records degrade locally with stable lexical errors', () => {
  const result = buildFarmUiSkin({ ui: { itemIcons: {} } }, 'file:///skin/farm.json')
  assert.deepEqual(result.catalog.itemIcons, {})
  assert.ok(result.errors.includes('MISSING_UI_RECORD:ui.itemFallback'))
  assert.deepEqual(result.errors, [...result.errors].sort())
})

test('unsafe paths and invalid sheet metadata are rejected without poisoning siblings', () => {
  const broken = structuredClone(manifest)
  broken.ui.itemIcons['crop:wheat'].src = '../outside.webp'
  broken.ui.itemIcons['crop:carrot'].src = 'https://example.test/foreign.webp'
  broken.ui.workshop.machine.gearSheet.frameCount = 0
  broken.ui.workshop.machine.steamSheet.durationMs = Number.MAX_VALUE
  const result = buildFarmUiSkin(broken, 'file:///skin/farm.json')
  assert.equal(result.catalog.itemIcons['crop:wheat'], undefined)
  assert.equal(result.catalog.itemIcons['crop:carrot'], undefined)
  assert.ok(result.catalog.itemIcons['crop:corn'])
  assert.ok(result.errors.includes('INVALID_UI_SHEET:ui.workshop.machine.gearSheet'))
  assert.ok(result.errors.includes('INVALID_UI_SHEET:ui.workshop.machine.steamSheet'))
  assert.deepEqual(result.errors, [...result.errors].sort())
})

test('invalid bases and encoded path escapes cannot produce URLs', () => {
  const copy = structuredClone(manifest)
  copy.ui.itemFallback.src = '%2e%2e/outside.webp'
  const escaped = buildFarmUiSkin(copy, 'file:///skin/farm.json')
  assert.equal(escaped.catalog.itemFallback, null)
  assert.ok(escaped.errors.includes('INVALID_UI_URL:ui.itemFallback'))
  const invalid = buildFarmUiSkin(manifest, 'not a url')
  assert.deepEqual(invalid.catalog.itemIcons, {})
  assert.ok(invalid.errors.includes('INVALID_UI_BASE'))
})

test('CSS-breaking and query-bearing paths are rejected before style consumption', () => {
  const copy = structuredClone(manifest)
  copy.ui.orders.board.src = "ui/orders/x');color:red;/*.webp"
  copy.ui.workshop.machine.base.src = 'ui/workshop/machine.webp?variant=1'
  const result = buildFarmUiSkin(copy, manifestUrl)
  assert.equal(result.catalog.orders.board, undefined)
  assert.equal(result.catalog.workshop.machine.base, undefined)
  assert.ok(result.errors.includes('INVALID_UI_URL:ui.orders.board'))
  assert.ok(result.errors.includes('INVALID_UI_URL:ui.workshop.machine.base'))
})

test('UI records are relative-only and reject decoded controls, authority and separators', () => {
  const rejected = [
    '//evil/skin/ui/fallback.webp',
    'file:inside.webp',
    'file:///skin/ui/fallback.webp',
    'https://example.test/ui/fallback.webp',
    '%00ui/fallback.webp',
    '%1fui/fallback.webp',
    '%7fui/fallback.webp',
    '%20ui/fallback.webp',
    'ui/fallback.webp%20',
    'ui\\fallback.webp',
    'ui%2ffallback.webp',
    'ui%5cfallback.webp',
    '%2e%2e/outside.webp',
  ]
  for (const src of rejected) {
    const copy = structuredClone(manifest)
    copy.ui.itemFallback.src = src
    const result = buildFarmUiSkin(copy, 'file:///skin/farm.json')
    assert.equal(result.catalog.itemFallback, null, src)
    assert.ok(result.errors.includes('INVALID_UI_URL:ui.itemFallback'), src)
    assert.ok(result.catalog.itemIcons['crop:wheat'], `sibling survived ${src}`)
  }
})

test('ordinary and normalized relative paths remain inside the exact skin base', () => {
  const copy = structuredClone(manifest)
  copy.ui.itemFallback.src = 'ui/workshop/../fallback.webp'
  copy.ui.itemIcons['crop:wheat'].src = './ui/items/crop-wheat.webp'
  const result = buildFarmUiSkin(copy, 'file:///skin/farm.json')
  assert.equal(result.catalog.itemFallback.src, 'file:///skin/ui/fallback.webp')
  assert.equal(result.catalog.itemIcons['crop:wheat'].src, 'file:///skin/ui/items/crop-wheat.webp')
})
