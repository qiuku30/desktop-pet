import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

import {
  buildFarmViewModel,
  escapeHtml,
  mountFarm,
  renderFarmShell,
  renderFieldGrid,
} from './farm-ui.js'
import { createBirdScheduler } from './farm-bird.mjs'
import { createDefaultFarmState } from './farm-state.mjs'
import { FARM_CONFIG } from './farm-config.mjs'

const NOW = '2026-07-26T08:00:00.000Z'
const FARM_CSS_PATH = fileURLToPath(new URL('./farm.css', import.meta.url))
const FARM_WORKSHOP_CSS_PATH = fileURLToPath(new URL('./farm-workshop.css', import.meta.url))
const FARM_ORDERS_CSS_PATH = fileURLToPath(new URL('./farm-orders.css', import.meta.url))

async function measureFarmLayouts() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'desktop-pet-farm-layout-'))
  const entryPath = path.join(tempRoot, 'layout-check.cjs')
  const userDataPath = path.join(tempRoot, 'user-data')
  const timeoutMs = 30_000
  const entrySource = `
const { app, BrowserWindow } = require('electron')
const { readFile } = require('node:fs/promises')

app.commandLine.appendSwitch('disable-gpu')
app.setPath('userData', process.env.FARM_LAYOUT_USER_DATA)

const fieldMarkup = selected => \`
  <div class="farm-toolbar"><span>建筑 1/2</span><span class="farm-feedback"></span><button class="farm-btn">收获全部</button></div>
  <div class="farm-workspace farm-scene--pixi\${selected ? ' farm-workspace--panel-open' : ''}">
    <div class="farm-scene-slot"><div class="farm-scene-host"></div></div>
    <div class="farm-grid farm-grid--mirror">\${Array.from({ length: 16 }, (_, index) => \`<button class="farm-tile">块\${index + 1}</button>\`).join('')}</div>
    <aside class="farm-actions"><div class="farm-action-title">田地操作</div></aside>
  </div>\`
const childMarkup = {
  processing: '<div class="farm-workshop-view farm-processing-view"><section class="farm-workshop-hero">加工机器</section><aside class="farm-workshop-track farm-processing-queue"><h2>加工队列</h2><div class="farm-workshop-slots">' + Array.from({ length: 3 }, (_, index) => '<article class="farm-workshop-slot farm-queue-slot"><div>槽位' + (index + 1) + '</div><small>材料详情</small><button>操作</button></article>').join('') + '</div></aside><section class="farm-workshop-shelf farm-processing-recipes">' + Array.from({ length: 5 }, (_, index) => '<article class="farm-workshop-recipe"><div class="farm-card-title">配方' + (index + 1) + '</div><div class="farm-material-list"><span class="farm-material--missing">材料不足</span></div><div class="farm-card-footer"><small>耗时</small><button>加入队列</button></div></article>').join('') + '</section></div>',
  orders: '<div class="farm-orders-board farm-orders-view">' + Array.from({ length: 3 }, (_, index) => index === 2 ? '<article class="farm-orders-paper farm-order-card--cooldown"><div class="farm-card-title">订单3</div><div class="farm-order-cooldown">冷却中</div><div class="farm-card-footer"><button>刷新</button></div></article>' : '<article class="farm-orders-paper"><div class="farm-card-title">订单' + (index + 1) + '</div><ul class="farm-order-requirements"><li>普通材料</li><li class="farm-material--missing">材料不足</li></ul><div class="farm-order-rewards">奖励</div><div class="farm-card-footer"><button>完整交付</button></div></article>').join('') + '</div>',
}
const rect = element => {
  const value = element.getBoundingClientRect()
  return { top: value.top, right: value.right, bottom: value.bottom, left: value.left, width: value.width, height: value.height }
}

async function loadCase(win, css, markup) {
  const html = \`<!doctype html><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body, .page--farm { width: 100%; height: 100%; margin: 0; }
    \${css}
  </style><main class="page--farm"><section class="farm-page">
    <div class="farm-summary">\${Array.from({ length: 5 }, () => '<div class="farm-summary-item">摘要</div>').join('')}</div>
    <div class="farm-tabs"><button class="farm-tab">农田</button><button class="farm-tab">加工</button><button class="farm-tab">订单</button></div>
    <div class="farm-tab-content">\${markup}</div>
  </section></main>\`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

async function main() {
  await app.whenReady()
  const css = (await Promise.all(JSON.parse(process.env.FARM_LAYOUT_CSS_PATHS).map(file => readFile(file, 'utf8')))).join('\\n')
  const win = new BrowserWindow({ show: false, useContentSize: true, webPreferences: { sandbox: true } })
  const results = {}
  for (const [width, height] of [[800, 600], [600, 400]]) {
    win.setContentSize(width, height)
    results[\`\${width}x\${height}\`] = {}
    for (const selected of [false, true]) {
      await loadCase(win, css, fieldMarkup(selected))
      results[\`\${width}x\${height}\`][selected ? 'selected' : 'unselected'] = await win.webContents.executeJavaScript(\`(() => {
      const content = document.querySelector('.farm-tab-content')
      const toolbar = document.querySelector('.farm-toolbar')
      const workspace = document.querySelector('.farm-workspace')
      const grid = document.querySelector('.farm-grid')
      const scene = document.querySelector('.farm-scene-slot')
      const actions = document.querySelector('.farm-actions')
      return {
        flexDirection: getComputedStyle(content).flexDirection,
        content: (\${rect.toString()})(content),
        toolbar: (\${rect.toString()})(toolbar),
        workspace: (\${rect.toString()})(workspace),
        scene: (\${rect.toString()})(scene),
        grid: (\${rect.toString()})(grid),
        actions: (\${rect.toString()})(actions),
        contentScrollWidth: content.scrollWidth,
        contentClientWidth: content.clientWidth,
      }
    })()\`)
    }
    for (const [name, markup] of Object.entries(childMarkup)) {
      await loadCase(win, css, markup)
      results[\`\${width}x\${height}\`][name] = await win.webContents.executeJavaScript(\`(() => {
        const content = document.querySelector('.farm-tab-content')
        const child = content.firstElementChild
        const buttons = [...child.querySelectorAll('button')]
        buttons.at(-1)?.focus()
        const childRect = child.getBoundingClientRect()
        const focusedRect = document.activeElement?.getBoundingClientRect()
        const hero = child.querySelector('.farm-workshop-hero')
        const track = child.querySelector('.farm-workshop-track')
        const shelf = child.querySelector('.farm-workshop-shelf')
        const colorOf = selector => getComputedStyle(child.querySelector(selector)).color
        return {
          content: (\${rect.toString()})(content),
          child: (\${rect.toString()})(child),
          contentScrollWidth: content.scrollWidth,
          contentClientWidth: content.clientWidth,
          childScrollWidth: child.scrollWidth,
          childClientWidth: child.clientWidth,
          childScrollHeight: child.scrollHeight,
          childClientHeight: child.clientHeight,
          slotCount: child.querySelectorAll('.farm-workshop-slot').length,
          recipeCount: child.querySelectorAll('.farm-workshop-recipe').length,
          orderCount: child.querySelectorAll('.farm-orders-paper').length,
          shelfColumns: child.querySelector('.farm-workshop-shelf') ? getComputedStyle(child.querySelector('.farm-workshop-shelf')).gridTemplateColumns.split(' ').length : null,
          orderColumns: child.matches('.farm-orders-board') ? getComputedStyle(child).gridTemplateColumns.split(' ').length : null,
          fallbackColor: getComputedStyle(child.matches('.farm-orders-board') ? child : child.querySelector('.farm-workshop-hero')).backgroundColor,
          focusInsideHorizontal: focusedRect ? focusedRect.left - 3 >= childRect.left && focusedRect.right + 3 <= childRect.right : false,
          rootColumns: getComputedStyle(child).gridTemplateColumns,
          rootOverflowX: getComputedStyle(child).overflowX,
          rootOverflowY: getComputedStyle(child).overflowY,
          heroRect: hero ? (\${rect.toString()})(hero) : null,
          trackRect: track ? (\${rect.toString()})(track) : null,
          shelfRect: shelf ? (\${rect.toString()})(shelf) : null,
          trackOverflowY: track ? getComputedStyle(track).overflowY : null,
          shelfOverflowY: shelf ? getComputedStyle(shelf).overflowY : null,
          titleColor: colorOf('.farm-card-title'),
          detailColor: colorOf(child.matches('.farm-orders-board') ? '.farm-order-requirements li:not(.farm-material--missing)' : '.farm-material-list'),
          footerColor: colorOf('.farm-card-footer'),
          slotTitleColor: hero ? colorOf('.farm-workshop-slot > div') : null,
          slotDetailColor: hero ? colorOf('.farm-workshop-slot > small') : null,
          cooldownColor: child.matches('.farm-orders-board') ? colorOf('.farm-order-cooldown') : null,
          trackBackground: track ? getComputedStyle(track).backgroundColor : null,
          trackHeadingColor: track ? colorOf('.farm-workshop-track h2') : null,
          missingColor: colorOf('.farm-material--missing'),
          missingBackground: getComputedStyle(child.querySelector(child.matches('.farm-orders-board') ? '.farm-orders-paper' : '.farm-workshop-recipe')).backgroundColor,
        }
      })()\`)
      results[\`\${width}x\${height}\`][name].screenshotBytes = (await win.webContents.capturePage()).toPNG().byteLength
    }
  }
  process.stdout.write('FARM_LAYOUT_RESULT:' + JSON.stringify(results) + '\\n')
  win.destroy()
  app.quit()
}

main().catch(error => {
  process.stderr.write(error.stack + '\\n')
  app.exit(1)
})
`

  let child
  try {
    await mkdir(userDataPath)
    await writeFile(entryPath, entrySource, 'utf8')
    const result = await new Promise((resolve, reject) => {
      child = spawn(electronPath, [entryPath], {
        env: {
          ...process.env,
          FARM_LAYOUT_CSS_PATHS: JSON.stringify([FARM_CSS_PATH, FARM_WORKSHOP_CSS_PATH, FARM_ORDERS_CSS_PATH]),
          FARM_LAYOUT_USER_DATA: userDataPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Electron layout test timed out after ${timeoutMs}ms\n${stderr}`))
      }, timeoutMs)
      child.stdout.on('data', chunk => { stdout += chunk })
      child.stderr.on('data', chunk => { stderr += chunk })
      child.on('error', error => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code, signal) => {
        clearTimeout(timer)
        if (code !== 0) {
          reject(new Error(`Electron layout test exited with code ${code}, signal ${signal}\n${stderr}`))
          return
        }
        const marker = stdout.split('\n').find(line => line.startsWith('FARM_LAYOUT_RESULT:'))
        if (!marker) {
          reject(new Error(`Electron layout test produced no result\nstdout:\n${stdout}\nstderr:\n${stderr}`))
          return
        }
        resolve(JSON.parse(marker.slice('FARM_LAYOUT_RESULT:'.length)))
      })
    })
    return result
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    await rm(tempRoot, { recursive: true, force: true })
  }
}

test('farm tabs preserve responsive layout contracts in Chromium', { timeout: 35_000 }, async t => {
  const layouts = await measureFarmLayouts()
  if (process.env.FARM_LAYOUT_DIAGNOSTICS === '1') t.diagnostic(JSON.stringify(layouts))
  const epsilon = 1
  const contrast = (foreground, background) => {
    const luminance = color => {
      const channels = color.match(/\d+/g).slice(0, 3).map(value => Number(value) / 255)
        .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
    return (values[0] + 0.05) / (values[1] + 0.05)
  }

  for (const viewport of ['800x600', '600x400']) {
    const layout = layouts[viewport]
    const unselected = layout.unselected
    const selected = layout.selected
    assert.equal(unselected.flexDirection, 'column', `${viewport}: tab content must stack vertically`)
    assert.ok(unselected.toolbar.bottom <= unselected.workspace.top + epsilon, `${viewport}: toolbar must be above workspace`)
    assert.ok(unselected.scene.width > selected.scene.width || viewport === '600x400',
      `${viewport}: wide selection narrows the scene`)
    if (viewport === '800x600') {
      assert.ok(selected.actions.left >= selected.scene.right - epsilon,
        `${viewport}: side panel must not overlay scene`)
    } else {
      assert.ok(selected.actions.top >= selected.scene.top - epsilon,
        `${viewport}: drawer must remain inside scene workspace`)
      assert.ok(selected.actions.bottom <= selected.workspace.bottom + epsilon,
        `${viewport}: drawer must be bounded`)
    }
    for (const field of [unselected, selected]) {
      assert.ok(field.workspace.right <= field.content.right + epsilon, `${viewport}: workspace must fit content`)
      assert.ok(field.contentScrollWidth <= field.contentClientWidth, `${viewport}: field tab must not overflow horizontally`)
    }

    for (const childName of ['processing', 'orders']) {
      const child = layout[childName]
      assert.ok(child.child.left >= child.content.left - epsilon, `${viewport} ${childName}: child must start inside content`)
      assert.ok(child.child.right <= child.content.right + epsilon, `${viewport} ${childName}: child must fit content width`)
      assert.ok(child.child.bottom <= child.content.bottom + epsilon, `${viewport} ${childName}: child must fit content height`)
      assert.ok(child.contentScrollWidth <= child.contentClientWidth, `${viewport} ${childName}: content must not overflow horizontally`)
      assert.ok(child.childScrollWidth <= child.childClientWidth, `${viewport} ${childName}: child must not be horizontally clipped`)
      assert.equal(child.focusInsideHorizontal, true, `${viewport} ${childName}: focus ring must not be clipped horizontally`)
      assert.notEqual(child.fallbackColor, 'rgba(0, 0, 0, 0)', `${viewport} ${childName}: fallback surface must remain opaque`)
      assert.ok(child.screenshotBytes > 0, `${viewport} ${childName}: Chromium screenshot must be non-empty`)
    }
    assert.equal(layout.processing.slotTitleColor, 'rgb(75, 46, 32)')
    assert.equal(layout.processing.slotDetailColor, 'rgb(75, 46, 32)')
    assert.equal(layout.processing.trackHeadingColor, 'rgb(75, 46, 32)')
    assert.equal(layout.processing.trackBackground, 'rgb(243, 217, 164)')
    assert.equal(layout.orders.cooldownColor, 'rgb(75, 46, 32)')
    for (const childName of ['processing', 'orders']) {
      assert.equal(layout[childName].missingColor, 'rgb(163, 63, 63)')
      assert.ok(contrast(layout[childName].missingColor, layout[childName].missingBackground) >= 4.5,
        `${viewport} ${childName}: missing material contrast`)
    }
    assert.equal(layout.processing.slotCount, 3)
    assert.equal(layout.processing.recipeCount, 5)
    assert.equal(layout.orders.orderCount, 3)
    assert.equal(layout.processing.shelfColumns, viewport === '800x600' ? 5 : 1)
    assert.equal(layout.orders.orderColumns, viewport === '800x600' ? 3 : 1)
    assert.equal(layout.processing.rootColumns.split(' ').length, 1, `${viewport}: workshop root is one column`)
    assert.ok(layout.processing.heroRect.bottom <= layout.processing.trackRect.top, `${viewport}: hero precedes track`)
    assert.ok(layout.processing.trackRect.bottom <= layout.processing.shelfRect.top, `${viewport}: track precedes shelf`)
    assert.equal(layout.processing.rootOverflowX, 'hidden')
    assert.equal(layout.processing.rootOverflowY, 'auto')
    assert.equal(layout.processing.trackOverflowY, 'visible')
    assert.equal(layout.processing.shelfOverflowY, 'visible')
    for (const childName of ['processing', 'orders']) {
      for (const key of ['titleColor', 'detailColor', 'footerColor']) {
        assert.equal(layout[childName][key], 'rgb(75, 46, 32)', `${viewport} ${childName}: ${key}`)
      }
    }
    if (viewport === '600x400') {
      assert.ok(layout.processing.childScrollHeight > layout.processing.childClientHeight, '600x400: workshop must scroll vertically')
      assert.ok(layout.orders.childScrollHeight > layout.orders.childClientHeight, '600x400: orders must scroll vertically')
    }
  }
})

function sampleState() {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tiles = farm.farms['basic-farm'].tiles
  tiles.find(tile => tile.id === 'r1c1').crop = {
    cropId: 'crop:wheat',
    seedId: 'seed:wheat',
    plantedAt: '2026-07-26T07:00:00.000Z',
    readyAt: '2026-07-26T07:15:00.000Z',
    baseYield: 4,
    harvestExp: 1,
    snapshot: {
      baseDurationMs: 900000,
      durationMs: 900000,
      baseYield: 4,
      landMultiplier: 1,
      scarecrow: 0,
      farmYieldMultiplier: 1,
      quantity: 4,
      bonusDropChance: 0.03,
      contributingBuildingIds: [],
    },
  }
  tiles.find(tile => tile.id === 'r1c2').crop = {
    ...structuredClone(tiles.find(tile => tile.id === 'r1c1').crop),
    cropId: 'crop:carrot',
    seedId: 'seed:carrot',
  }
  farm.exp = 4
  return farm
}

test('view model exposes exactly sixteen stable tiles and farm-02 summary semantics', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: { 'seed:wheat': 3 },
    coins: 100,
    petLevel: 2,
  }, FARM_CONFIG, NOW)

  assert.equal(vm.tiles.length, 16)
  assert.deepEqual(vm.tiles.map(tile => tile.id), FARM_CONFIG.farms['basic-farm'].tiles.map(tile => tile.id))
  assert.deepEqual(vm.summary, {
    matureFieldCount: 2,
    processing: { queuedCount: 0, nextCompletionAt: null },
    orders: { readyCount: 0 },
    farmLevel: 1,
    farmExp: 4,
  })
})

test('view model derives unlock, seed, land, building and work-lock presentation data', () => {
  const farm = sampleState()
  const tiles = farm.farms['basic-farm'].tiles
  tiles.find(tile => tile.id === 'r1c1').crop.snapshot.contributingBuildingIds = ['building:1']
  const buildingTile = tiles.find(tile => tile.id === 'r2c2')
  buildingTile.occupancy = 'building'
  buildingTile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }

  const vm = buildFarmViewModel({
    farm,
    inventory: { 'seed:wheat': 0 },
    coins: 100,
    petLevel: 2,
  }, FARM_CONFIG, NOW)

  assert.equal(vm.crops.find(crop => crop.id === 'crop:wheat').quickBuyPrice, 4)
  assert.equal(vm.tiles.find(tile => tile.id === 'r0c1').unlock.eligible, true)
  assert.equal(vm.tiles.find(tile => tile.id === 'r0c0').unlock.eligible, false)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c1').land.nextCost, 80)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c2').building.working, true)
  assert.equal(vm.tiles.find(tile => tile.id === 'r2c2').building.refundPreview, 30)
})

test('shell enables all three tabs, keeps the summary and exposes a child tab host', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFarmShell(vm)

  assert.match(html, /data-farm-tab="processing"/)
  assert.match(html, /data-farm-tab="orders"/)
  assert.doesNotMatch(html, /data-farm-tab="(?:processing|orders)"[^>]*disabled/)
  assert.match(html, /class="farm-tab-content"/)
  assert.match(html, /aria-label="农场摘要"/)
  assert.match(html, /data-action="harvest-all"/)
  assert.doesNotMatch(html, /data-action="harvest-all"[^>]*disabled/)
})

test('summary persists with identical values across every selected tab', () => {
  const vm = buildFarmViewModel({
    farm: sampleState(),
    inventory: {},
    coins: 7,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const summaries = ['field', 'processing', 'orders'].map(activeTab => {
    const html = renderFarmShell(vm, { activeTab })
    return html.match(/<section class="farm-summary"[\s\S]*?<\/section>/)?.[0]
  })
  assert.equal(new Set(summaries).size, 1)
  assert.match(summaries[0], /Lv\.1/)
  assert.match(summaries[0], /可交付/)
})

test('field renderer emits sixteen keyboard-focusable tile buttons', () => {
  const vm = buildFarmViewModel({
    farm: createDefaultFarmState(NOW, () => 0.5),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFieldGrid(vm)

  assert.equal((html.match(/data-tile-id=/g) || []).length, 16)
  assert.equal((html.match(/<button/g) || []).length, 16)
  assert.match(html, /aria-label=".*锁定/)
})

test('only legal building move targets expose the move-target accessible name', () => {
  const vm = buildFarmViewModel({
    farm: createDefaultFarmState(NOW, () => 0.5),
    inventory: {},
    coins: 0,
    petLevel: 1,
  }, FARM_CONFIG, NOW)
  const html = renderFieldGrid(vm, { type: 'move-building', buildingId: 'building:1' })
  const targetButton = html.match(/<button[^>]*data-tile-id="r1c1"[\s\S]*?<\/button>/)?.[0] || ''
  const lockedButton = html.match(/<button[^>]*data-tile-id="r0c0"[\s\S]*?<\/button>/)?.[0] || ''

  assert.match(targetButton, /aria-label="[^"]*可作为建筑移动目标"/)
  assert.doesNotMatch(lockedButton, /可作为建筑移动目标/)
})

test('dynamic overlay text escaping covers confirmation content', () => {
  assert.equal(
    escapeHtml(`<作物 & "建筑" '测试'>`),
    '&lt;作物 &amp; &quot;建筑&quot; &#39;测试&#39;&gt;',
  )
})

function createHarness(farm = createDefaultFarmState(NOW, () => 0.5), {
  level = 12,
  birdSchedulerFactory,
  documentRef,
  claimBirdImpl,
} = {}) {
  const state = {
    farm,
    inventory: {},
    coins: 500,
    level,
  }
  let clickHandler = null
  let childClickHandler = null
  const childContainer = {
    innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') childClickHandler = handler },
    removeEventListener(type, handler) {
      if (type === 'click' && childClickHandler === handler) childClickHandler = null
    },
  }
  const container = {
    className: '',
    innerHTML: '',
    addEventListener(type, handler) {
      if (type === 'click') clickHandler = handler
    },
    removeEventListener(type, handler) {
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
    querySelector(selector) {
      return selector === '.farm-tab-content' ? childContainer : null
    },
  }
  const calls = []
  const service = Object.fromEntries([
    'plant', 'harvest', 'harvestAll', 'removeCrop', 'unlockTile', 'upgradeLand',
    'build', 'moveBuilding', 'upgradeBuilding', 'demolishBuilding',
    'enqueue', 'cancelQueued', 'completeOrder', 'abandonOrder', 'settle', 'claimBird',
  ].map(name => [name, async args => {
    calls.push([name, args])
    if (name === 'claimBird') {
      if (claimBirdImpl) return claimBirdImpl(args, state)
      state.farm.daily.birdRewardDate = '2026-07-26'
      state.farm.daily.birdRewardCount += 1
      return { ok: true, amount: 2 }
    }
    return name === 'demolishBuilding' ? { ok: true, refund: 30 } : { ok: true }
  }]))
  const petState = {
    get(key) { return structuredClone(state[key]) },
    subscribe() { return () => {} },
  }
  const eventBus = { on() { return () => {} } }
  const overlays = []
  const cleanup = mountFarm(container, {
    service,
    petState,
    eventBus,
    now: () => NOW,
    showOverlay: options => new Promise(resolve => overlays.push({ options, resolve })),
    closeOverlay: () => {},
    createBirdSchedulerFn: birdSchedulerFactory,
    documentRef,
  })
  const click = dataset => {
    const action = { dataset, disabled: false }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-action]') return action
          return null
        },
      },
    })
  }
  const clickTile = tileId => {
    const tile = { dataset: { tileId } }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-tile-id].farm-tile') return tile
          return null
        },
      },
    })
  }
  const clickTab = farmTab => {
    const tab = { dataset: { farmTab } }
    clickHandler({
      target: {
        closest(selector) {
          if (selector === '[data-farm-tab]') return tab
          return null
        },
      },
    })
  }
  const clickChild = dataset => {
    const action = { dataset, disabled: false }
    childClickHandler?.({
      target: { closest: selector => selector === '[data-action]' ? action : null },
    })
  }
  return {
    state, container, childContainer, calls, overlays, cleanup, click, clickTile, clickTab, clickChild,
  }
}

test('bird UI is accessible, claims once through FarmService and cleans visibility lifecycle', async () => {
  let schedulerOptions
  const schedulerCalls = []
  let visibilityHandler = null
  const documentRef = {
    hidden: false,
    addEventListener(type, handler) {
      if (type === 'visibilitychange') visibilityHandler = handler
    },
    removeEventListener(type, handler) {
      if (type === 'visibilitychange' && visibilityHandler === handler) visibilityHandler = null
    },
  }
  const harness = createHarness(createDefaultFarmState(NOW, () => 0.5), {
    documentRef,
    birdSchedulerFactory(options) {
      schedulerOptions = options
      return {
        start(args) { schedulerCalls.push(['start', args]) },
        setVisible(visible, args) { schedulerCalls.push(['setVisible', visible, args]) },
        claimed(args) {
          schedulerCalls.push(['claimed', args])
          schedulerOptions.onLeave({ birdId: args.birdId })
        },
        destroy() { schedulerCalls.push(['destroy']) },
      }
    },
  })

  assert.deepEqual(schedulerCalls, [['start', { dailyCount: 0 }]])
  schedulerOptions.onAppear({ birdId: 'bird:test' })
  assert.match(harness.container.innerHTML, /<button[^>]*data-action="claim-bird"/)
  assert.match(harness.container.innerHTML, /aria-label="点击小鸟获得金币"/)

  harness.click({ action: 'claim-bird', birdId: 'bird:test' })
  harness.click({ action: 'claim-bird', birdId: 'bird:test' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.filter(([name]) => name === 'claimBird').length, 1)
  assert.deepEqual(harness.calls.find(([name]) => name === 'claimBird'), [
    'claimBird',
    { birdId: 'bird:test' },
  ])
  assert.match(harness.container.innerHTML, /\+2 🪙/)
  assert.deepEqual(schedulerCalls.at(-1), ['claimed', { birdId: 'bird:test', dailyCount: 1 }])

  documentRef.hidden = true
  visibilityHandler()
  assert.deepEqual(schedulerCalls.at(-1), ['setVisible', false, { dailyCount: 1 }])

  harness.cleanup()
  assert.deepEqual(schedulerCalls.at(-1), ['destroy'])
  assert.equal(visibilityHandler, null)
  schedulerOptions.onAppear({ birdId: 'bird:late' })
  assert.doesNotMatch(harness.container.innerHTML, /bird:late/)
})

test('bird daily cap is treated as zero after the local date changes', () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.daily.birdRewardDate = '2026-07-25'
  farm.daily.birdRewardCount = 10
  farm.daily.claimedBirdIds = Array.from({ length: 10 }, (_, index) => `bird:${index}`)
  const schedulerCalls = []
  const harness = createHarness(farm, {
    documentRef: {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
    },
    birdSchedulerFactory() {
      return {
        start(args) { schedulerCalls.push(args) },
        setVisible() {},
        claimed() {},
        destroy() {},
      }
    },
  })

  assert.deepEqual(schedulerCalls, [{ dailyCount: 0 }])
  harness.cleanup()
})

test('bird claim uses committed cross-day count instead of the click-time count', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.daily.birdRewardDate = '2026-07-25'
  farm.daily.birdRewardCount = 9
  const schedulerCalls = []
  let schedulerOptions
  const harness = createHarness(farm, {
    documentRef: {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
    },
    claimBirdImpl(args, state) {
      state.farm.daily.birdRewardDate = '2026-07-26'
      state.farm.daily.birdRewardCount = 1
      return { ok: true, amount: 1 }
    },
    birdSchedulerFactory(options) {
      schedulerOptions = options
      return {
        start() {},
        setVisible() {},
        claimed(args) { schedulerCalls.push(args) },
        destroy() {},
      }
    },
  })

  schedulerOptions.onAppear({ birdId: 'bird:cross-day' })
  harness.click({ action: 'claim-bird', birdId: 'bird:cross-day' })
  await new Promise(resolve => setImmediate(resolve))

  assert.deepEqual(schedulerCalls, [{ birdId: 'bird:cross-day', dailyCount: 1 }])
  harness.cleanup()
})

test('pending 9-to-10 bird claim cancels the next timer after natural departure', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.daily.birdRewardDate = '2026-07-26'
  farm.daily.birdRewardCount = 9
  let resolveClaim
  const claimPromise = new Promise(resolve => { resolveClaim = resolve })
  let nextTimerId = 1
  const timers = new Map()
  const setTimer = (callback, delay) => {
    const id = nextTimerId++
    timers.set(id, { callback, delay })
    return id
  }
  const clearTimer = id => timers.delete(id)
  let appearedBirdId = null
  const runNextTimer = () => {
    const [id, timer] = timers.entries().next().value
    timers.delete(id)
    timer.callback()
  }
  const harness = createHarness(farm, {
    documentRef: {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
    },
    claimBirdImpl: () => claimPromise,
    birdSchedulerFactory: options => createBirdScheduler({
      ...options,
      onAppear(bird) {
        appearedBirdId = bird.birdId
        options.onAppear(bird)
      },
      random: () => 0,
      setTimer,
      clearTimer,
    }),
  })

  runNextTimer()
  harness.click({ action: 'claim-bird', birdId: appearedBirdId })
  runNextTimer()
  assert.equal(timers.size, 1)
  const staleAppearance = timers.values().next().value.callback

  harness.state.farm.daily.birdRewardCount = 10
  resolveClaim({ ok: true, amount: 3 })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(timers.size, 0)

  staleAppearance()
  assert.doesNotMatch(harness.container.innerHTML, /data-action="claim-bird"/)
  harness.cleanup()
})

test('farm mounted while document is hidden never starts a visible bird timer', () => {
  const schedulerCalls = []
  const harness = createHarness(createDefaultFarmState(NOW, () => 0.5), {
    documentRef: {
      hidden: true,
      addEventListener() {},
      removeEventListener() {},
    },
    birdSchedulerFactory() {
      return {
        start(args) { schedulerCalls.push(['start', args]) },
        setVisible(visible, args) { schedulerCalls.push(['setVisible', visible, args]) },
        claimed() {},
        destroy() {},
      }
    },
  })

  assert.deepEqual(schedulerCalls, [
    ['setVisible', false, { dailyCount: 0 }],
    ['start', { dailyCount: 0 }],
  ])
  harness.cleanup()
})

test('plant forwards quick-buy intent and harvest-all remains one service command', async () => {
  const harness = createHarness()
  harness.click({
    action: 'plant',
    tileId: 'r1c1',
    cropId: 'crop:wheat',
    quickBuy: 'true',
  })
  await new Promise(resolve => setImmediate(resolve))
  harness.click({ action: 'harvest-all' })
  await new Promise(resolve => setImmediate(resolve))

  assert.deepEqual(harness.calls, [
    ['plant', { tileId: 'r1c1', cropId: 'crop:wheat', quickBuy: true }],
    ['harvestAll', undefined],
  ])
  harness.cleanup()
})

test('remaining farm actions forward exact service parameters and rerender feedback', async () => {
  const harness = createHarness(sampleState())
  const actions = [
    [{ action: 'harvest', tileId: 'r1c1' }, ['harvest', { tileId: 'r1c1' }]],
    [{ action: 'unlock', tileId: 'r0c1' }, ['unlockTile', { tileId: 'r0c1' }]],
    [{ action: 'upgrade-land', tileId: 'r2c1' }, ['upgradeLand', { tileId: 'r2c1' }]],
    [{ action: 'build', tileId: 'r2c1', buildingType: 'building:sprinkler' },
      ['build', { tileId: 'r2c1', typeId: 'building:sprinkler' }]],
    [{ action: 'upgrade-building', buildingId: 'building:1' },
      ['upgradeBuilding', { buildingId: 'building:1' }]],
  ]

  for (const [dataset, expected] of actions) {
    harness.click(dataset)
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(harness.calls.at(-1), expected)
    assert.match(harness.container.innerHTML, /操作成功/)
  }
  harness.cleanup()
})

test('working building locks move and demolition controls', () => {
  const farm = sampleState()
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r2c2')
  tile.occupancy = 'building'
  tile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }
  farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
    .crop.snapshot.contributingBuildingIds = ['building:1']
  const harness = createHarness(farm)
  harness.clickTile('r2c2')

  assert.match(harness.container.innerHTML, /正在为生长作物提供效果/)
  assert.match(harness.container.innerHTML, /data-action="move-building"[^>]*disabled/)
  assert.match(harness.container.innerHTML, /data-action="demolish-building"[\s\S]*?disabled/)
  harness.cleanup()
})

test('building capacity limit is explicit and disables build choices', () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const buildingTile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  buildingTile.occupancy = 'building'
  buildingTile.building = {
    id: 'building:1',
    typeId: 'building:sprinkler',
    level: 1,
    investedCoins: 60,
  }
  const harness = createHarness(farm, { level: 1 })
  harness.clickTile('r1c2')

  assert.match(harness.container.innerHTML, /建筑容量已满/)
  assert.match(harness.container.innerHTML, /data-action="build"[\s\S]*?disabled/)
  harness.cleanup()
})

test('crop removal executes only after explicit confirmation', async () => {
  const harness = createHarness(sampleState())
  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '<小麦>' })
  assert.equal(harness.calls.length, 0)
  assert.match(harness.overlays[0].options.html, /当前作物及本轮种子投入不会返还/)
  assert.doesNotMatch(harness.overlays[0].options.html, /<小麦>/)

  harness.overlays[0].resolve('cancel')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.length, 0)

  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '小麦' })
  harness.overlays[1].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), ['removeCrop', { tileId: 'r1c1' }])
  harness.cleanup()
})

test('late confirmation after cleanup never executes a destructive command', async () => {
  const harness = createHarness(sampleState())
  harness.click({ action: 'remove-crop', tileId: 'r1c1', cropName: '小麦' })
  harness.cleanup()
  harness.overlays[0].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.length, 0)
})

test('demolition confirmation displays derived refund and trusts service result', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.occupancy = 'building'
  tile.building = { id: 'building:1', typeId: 'building:sprinkler', level: 1, investedCoins: 61 }
  const harness = createHarness(farm)

  harness.click({
    action: 'demolish-building',
    buildingId: 'building:1',
    buildingName: '洒水器',
    refund: '30',
  })
  assert.match(harness.overlays[0].options.html, /预计返还 30 金币（累计投入的 50%，向下取整）/)
  harness.overlays[0].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), ['demolishBuilding', { buildingId: 'building:1' }])
  assert.match(harness.container.innerHTML, /已返还 30 金币/)
  harness.cleanup()
})

test('building move mode accepts only an empty open field target', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const tile = farm.farms['basic-farm'].tiles.find(entry => entry.id === 'r1c1')
  tile.occupancy = 'building'
  tile.building = { id: 'building:1', typeId: 'building:sprinkler', level: 1, investedCoins: 60 }
  const harness = createHarness(farm)

  harness.click({ action: 'move-building', buildingId: 'building:1' })
  assert.match(harness.container.innerHTML, /farm-tile--move-target/)
  harness.clickTile('r0c0')
  assert.equal(harness.calls.length, 0)
  harness.clickTile('r1c2')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(harness.calls.at(-1), [
    'moveBuilding',
    { buildingId: 'building:1', targetTileId: 'r1c2' },
  ])
  harness.cleanup()
})

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function createGateHarness() {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const state = { farm, inventory: {}, coins: 0, level: 1 }
  const callbacks = []
  const settlements = []
  const mutations = []
  let settleCalls = 0
  let mutationCalls = 0
  let clickHandler = null
  let renderCount = 0
  const container = {
    className: '',
    get innerHTML() { return '' },
    set innerHTML(_value) { renderCount += 1 },
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener(type, handler) {
      if (type === 'click' && clickHandler === handler) clickHandler = null
    },
    querySelector() { return null },
  }
  const service = {
    settle() {
      settleCalls += 1
      const gate = deferred()
      settlements.push(gate)
      return gate.promise
    },
    harvestAll() {
      mutationCalls += 1
      const gate = deferred()
      mutations.push(gate)
      return gate.promise
    },
  }
  const cleanup = mountFarm(container, {
    service,
    petState: {
      get(key) { return structuredClone(state[key]) },
      subscribe() { return () => {} },
    },
    eventBus: { on() { return () => {} } },
    now: () => NOW,
    setIntervalFn(callback, delay) {
      callbacks.push({ callback, delay })
      return callbacks.length
    },
    clearIntervalFn() {},
    closeOverlay() {},
  })
  const lowFrequency = callbacks.find(entry => entry.delay === 30_000)
  const clickMutation = () => clickHandler({
    target: {
      closest(selector) {
        if (selector === '[data-action]') {
          return { dataset: { action: 'harvest-all' }, disabled: false }
        }
        return null
      },
    },
  })
  return {
    cleanup,
    lowFrequency,
    settlements,
    mutations,
    clickMutation,
    settleCalls: () => settleCalls,
    mutationCalls: () => mutationCalls,
    renderCount: () => renderCount,
  }
}

test('settlement requests during an active settlement coalesce into exactly one follow-up', async () => {
  const harness = createGateHarness()
  assert.ok(harness.lowFrequency)
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  assert.equal(harness.settleCalls(), 1)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 2)
  harness.settlements[1].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 2)
  harness.cleanup()
})

test('mutation clicked during settlement waits, locks immediately and runs exactly once', async () => {
  const harness = createGateHarness()
  harness.lowFrequency.callback()
  harness.clickMutation()
  harness.clickMutation()
  assert.equal(harness.mutationCalls(), 0)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.mutationCalls(), 1)
  harness.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.mutationCalls(), 1)
  harness.cleanup()
})

test('settlement requests during mutation coalesce into exactly one follow-up', async () => {
  const harness = createGateHarness()
  harness.clickMutation()
  assert.equal(harness.mutationCalls(), 1)
  harness.lowFrequency.callback()
  harness.lowFrequency.callback()
  assert.equal(harness.settleCalls(), 0)
  harness.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 1)
  harness.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.settleCalls(), 1)
  harness.cleanup()
})

test('cleanup cancels queued follow-ups and late settlement or mutation side effects', async () => {
  const settlementCase = createGateHarness()
  settlementCase.lowFrequency.callback()
  settlementCase.lowFrequency.callback()
  const settlementRenders = settlementCase.renderCount()
  settlementCase.cleanup()
  settlementCase.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settlementCase.settleCalls(), 1)
  assert.equal(settlementCase.renderCount(), settlementRenders)

  const waitingMutationCase = createGateHarness()
  waitingMutationCase.lowFrequency.callback()
  waitingMutationCase.clickMutation()
  const waitingRenders = waitingMutationCase.renderCount()
  waitingMutationCase.cleanup()
  waitingMutationCase.settlements[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(waitingMutationCase.mutationCalls(), 0)
  assert.equal(waitingMutationCase.renderCount(), waitingRenders)

  const mutationCase = createGateHarness()
  mutationCase.clickMutation()
  mutationCase.lowFrequency.callback()
  const mutationRenders = mutationCase.renderCount()
  mutationCase.cleanup()
  mutationCase.mutations[0].resolve({ ok: true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(mutationCase.settleCalls(), 0)
  assert.equal(mutationCase.renderCount(), mutationRenders)
})

test('processing cancellation and order abandonment confirmations show escaped exact details', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.processor.queue = [
    {
      id: 'processing-task:1', recipeId: 'recipe:cookie', status: 'running',
      inputs: { 'crop:wheat': 2 }, outputs: { 'food:cookie': 3 },
      completesAt: '2026-07-26T08:30:00.000Z',
    },
    {
      id: 'processing-task:2', recipeId: 'recipe:cookie', status: 'queued',
      inputs: { 'crop:wheat': 2, '<unsafe>': 1 }, outputs: { 'food:cookie': 3 },
      completesAt: null,
    },
  ]
  farm.orders.slots[0] = {
    order: {
      id: 'order:1',
      requirements: { 'crop:carrot': 2, '<unsafe>': 1 },
      rewards: { coins: 10, farmExp: 8, seedReward: null },
    },
    regenerateAt: null,
  }
  const harness = createHarness(farm)

  harness.clickTab('processing')
  harness.clickChild({ action: 'cancel-processing', taskId: 'processing-task:2' })
  assert.match(harness.overlays[0].options.html, /小麦 × 2/)
  assert.match(harness.overlays[0].options.html, /&lt;unsafe&gt; × 1/)
  assert.match(harness.overlays[0].options.html, /全部返还/)
  harness.overlays[0].resolve('cancel')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.some(([name]) => name === 'cancelQueued'), false)

  harness.clickTab('orders')
  harness.clickChild({ action: 'abandon-order', slotIndex: '0' })
  assert.match(harness.overlays[1].options.html, /胡萝卜 × 2/)
  assert.match(harness.overlays[1].options.html, /&lt;unsafe&gt; × 1/)
  assert.match(harness.overlays[1].options.html, /30 分钟冷却，期间无订单/)
  harness.clickTab('field')
  harness.overlays[1].resolve('confirm')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(harness.calls.some(([name]) => name === 'abandonOrder'), false)
  harness.cleanup()
})

test('controller keeps UI catalog and feedback visual-only and generation guarded', async () => {
  const source = await readFile(new URL('./farm-ui.js', import.meta.url), 'utf8')
  assert.match(source, /uiSkinPromise/)
  assert.match(source, /uiLoadGeneration !== generation/)
  assert.match(source, /pendingUiFeedback\?\.id === id/)
  assert.match(source, /activeTab !== 'processing'/)
  assert.match(source, /activeTab !== 'orders'/)
  assert.doesNotMatch(source, /petState\.(?:set|setMany)\(/)
})

test('synchronous UI skin loader failure stays inside fallback lifecycle and returns cleanup', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const child = { innerHTML: '', addEventListener() {}, removeEventListener() {} }
  let clickHandler = null
  let removed = 0
  let cleared = 0
  const host = { classList: { add() {} }, remove() {} }
  const container = {
    className: '', innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener() { removed += 1 },
    querySelector(selector) { return selector === '.farm-tab-content' ? child : null },
  }
  let cleanup
  assert.doesNotThrow(() => {
    cleanup = mountFarm(container, {
      service: { settle: async () => ({ ok: true }) },
      petState: {
        get(key) { return structuredClone({ farm, inventory: {}, coins: 0, level: 1 }[key]) },
        subscribe() { return () => { removed += 1 } },
      },
      eventBus: { on() { return () => { removed += 1 } } },
      documentRef: { createElement() { return host } },
      sceneRuntime: {
        loadUiSkin() { throw new Error('synchronous skin failure') },
        loadScene: async () => ({ mode: 'dom' }),
      },
      setIntervalFn: () => 1,
      clearIntervalFn() { cleared += 1 },
      closeOverlay() {},
    })
  })
  await new Promise(resolve => setImmediate(resolve))
  clickHandler({ target: { closest(selector) {
    return selector === '[data-farm-tab]' ? { dataset: { farmTab: 'processing' } } : null
  } } })
  assert.match(child.innerHTML, /加工机器/)
  assert.doesNotMatch(child.innerHTML, /<img class="farm-workshop-visual"/)
  cleanup()
  cleanup()
  assert.ok(removed >= 6)
  assert.equal(cleared >= 2, true)
})

test('order completion emitted inside mutation survives final render for one bounded visual period', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  farm.orders.slots[0] = {
    order: {
      id: 'order:gate', requirements: { 'crop:wheat': 1 },
      rewards: { coins: 2, farmExp: 1, seedReward: null }, createdAt: NOW,
    },
    regenerateAt: null,
  }
  const listeners = new Map()
  const eventBus = {
    on(type, handler) { listeners.set(type, handler); return () => listeners.delete(type) },
  }
  let clickHandler = null
  let childClickHandler = null
  const child = {
    innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') childClickHandler = handler },
    removeEventListener(type, handler) { if (type === 'click' && childClickHandler === handler) childClickHandler = null },
  }
  const container = {
    className: '', innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener() {},
    querySelector(selector) { return selector === '.farm-tab-content' ? child : null },
  }
  const visualTimers = new Map()
  let nextTimer = 1
  const cleanup = mountFarm(container, {
    service: {
      settle: async () => ({ ok: true }),
      completeOrder: async () => {
        listeners.get('farm:order:completed')?.()
        listeners.get('farm:state:changed')?.()
        return { ok: true }
      },
    },
    petState: {
      get(key) { return structuredClone({ farm, inventory: { 'crop:wheat': 1 }, coins: 0, level: 1 }[key]) },
      subscribe() { return () => {} },
    },
    eventBus,
    documentRef: null,
    setIntervalFn: () => 1,
    clearIntervalFn() {},
    setTimeoutFn(callback) { const id = nextTimer++; visualTimers.set(id, callback); return id },
    clearTimeoutFn(id) { visualTimers.delete(id) },
    closeOverlay() {},
  })
  clickHandler({ target: { closest: selector => selector === '[data-farm-tab]' ? { dataset: { farmTab: 'orders' } } : null } })
  childClickHandler({ target: { closest: selector => selector === '[data-action]'
    ? { dataset: { action: 'complete-order', slotIndex: '0' }, disabled: false } : null } })
  await new Promise(resolve => setImmediate(resolve))
  assert.match(child.innerHTML, /farm-orders-board--order-complete/)
  assert.equal(visualTimers.size, 1)
  ;[...visualTimers.values()][0]()
  assert.doesNotMatch(child.innerHTML, /farm-orders-board--order-complete/)
  cleanup()
  assert.equal(visualTimers.size, 0)
})

test('processing completion emitted inside settlement survives settlement-final render then expires', async () => {
  const farm = createDefaultFarmState(NOW, () => 0.5)
  const listeners = new Map()
  let clickHandler = null
  let childClickHandler = null
  const child = {
    innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') childClickHandler = handler },
    removeEventListener(type, handler) { if (type === 'click' && childClickHandler === handler) childClickHandler = null },
  }
  const container = {
    className: '', innerHTML: '',
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler },
    removeEventListener() {},
    querySelector(selector) { return selector === '.farm-tab-content' ? child : null },
  }
  const intervals = []
  const visualTimers = new Map()
  let nextTimer = 1
  const cleanup = mountFarm(container, {
    service: {
      settle: async () => {
        listeners.get('farm:processing:completed')?.()
        listeners.get('farm:state:changed')?.()
        return { ok: true }
      },
    },
    petState: {
      get(key) { return structuredClone({ farm, inventory: {}, coins: 0, level: 1 }[key]) },
      subscribe() { return () => {} },
    },
    eventBus: { on(type, handler) { listeners.set(type, handler); return () => listeners.delete(type) } },
    documentRef: null,
    setIntervalFn(callback, delay) { intervals.push({ callback, delay }); return intervals.length },
    clearIntervalFn() {},
    setTimeoutFn(callback) { const id = nextTimer++; visualTimers.set(id, callback); return id },
    clearTimeoutFn(id) { visualTimers.delete(id) },
    closeOverlay() {},
  })
  clickHandler({ target: { closest: selector => selector === '[data-farm-tab]' ? { dataset: { farmTab: 'processing' } } : null } })
  intervals.find(entry => entry.delay === 30_000).callback()
  await new Promise(resolve => setImmediate(resolve))
  assert.match(child.innerHTML, /farm-workshop-view--processing-complete/)
  assert.equal(visualTimers.size, 1)
  ;[...visualTimers.values()][0]()
  assert.doesNotMatch(child.innerHTML, /farm-workshop-view--processing-complete/)
  cleanup()
  assert.equal(visualTimers.size, 0)
})
