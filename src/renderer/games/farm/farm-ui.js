import { ITEMS } from '../../shared/item-config.js'
import { EVENTS } from '../../shared/events.js'
import {
  FARM_CONFIG,
} from './farm-config.mjs'
import { canCompleteOrder } from './farm-orders.mjs'
import { canUnlockTile, isCropMature } from './farm-rules.mjs'
import {
  buildProcessingViewModel,
  renderProcessingTab,
} from './farm-processing-ui.js'
import {
  buildOrdersViewModel,
  renderOrdersTab,
} from './farm-orders-ui.js'
import { createBirdScheduler } from './farm-bird.mjs'

const BUILDING_META = Object.freeze({
  'building:sprinkler': { name: '洒水器', emoji: '💦' },
  'building:scarecrow': { name: '稻草人', emoji: '🪆' },
  'building:compost-bin': { name: '堆肥箱', emoji: '🍂' },
})

const ERROR_MESSAGES = Object.freeze({
  TILE_NOT_EMPTY: '这块田目前不能播种。',
  CROP_LOCKED: '该作物尚未解锁。',
  INSUFFICIENT_SEEDS: '种子不足，可选择快捷购种。',
  INSUFFICIENT_COINS: '金币不足。',
  CROP_NOT_FOUND: '作物已不存在，请刷新后重试。',
  CROP_NOT_MATURE: '作物尚未成熟。',
  NO_MATURE_CROPS: '当前没有可收获的成熟作物。',
  TILE_NOT_ADJACENT: '只能解锁与已开放土地上下左右相邻的格子。',
  PET_LEVEL_REQUIRED: '宠物等级尚未达到扩地要求。',
  LAND_NOT_EMPTY: '只有空田可以升级。',
  LAND_MAX_LEVEL: '土地已经达到最高等级。',
  BUILD_TILE_NOT_EMPTY: '建筑只能放在没有作物的开放田地。',
  BUILDING_LOCKED: '该建筑类型尚未解锁。',
  BUILDING_CAPACITY: '当前宠物等级允许的建筑数量已达上限。',
  BUILDING_NOT_FOUND: '建筑已不存在，请刷新后重试。',
  BUILDING_WORKING: '建筑正在为生长作物提供效果，暂时不能移动或拆除。',
  BUILDING_MAX_LEVEL: '建筑已经达到最高等级。',
  BUILDING_LEVEL_LOCKED: '农场等级尚未解锁该建筑升级。',
  UNKNOWN_RECIPE: '配方不存在。',
  QUEUE_FULL: '加工队列已满。',
  INSUFFICIENT_INGREDIENTS: '加工材料不足。',
  TASK_NOT_FOUND: '加工任务已不存在。',
  TASK_RUNNING: '正在加工的任务不能取消。',
  ORDER_NOT_FOUND: '订单已不存在。',
  INSUFFICIENT_ITEMS: '库存不足，无法完整交付。',
})

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildingCapacityFor(petLevel, config) {
  return [...config.rewards.buildingCapacity].reverse()
    .find(entry => petLevel >= entry.petLevel)?.capacity || 0
}

function unlockDetails(tiles, petLevel, coins, tileId, config) {
  const opened = tiles.filter(tile => tile.occupancy !== 'locked').length
  const tier = config.landUnlocks.find(entry => entry.totalUnlocked > opened)
  if (!tier) return { eligible: false, complete: true, petLevel: null, price: null, affordable: false }
  const priceIndex = opened - (tier.totalUnlocked - tier.prices.length)
  const price = tier.prices[priceIndex]
  return {
    eligible: canUnlockTile(tiles, tileId),
    complete: false,
    petLevel: tier.petLevel,
    price,
    affordable: petLevel >= tier.petLevel && coins >= price,
  }
}

function formatRemaining(readyAt, now) {
  const remainingMs = Math.max(0, Date.parse(readyAt) - Date.parse(now))
  if (!Number.isFinite(remainingMs) || remainingMs === 0) return '已成熟'
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`
}

function farmSummary(farm, inventory, now) {
  const tiles = farm.farms[farm.activeFarmId].tiles
  const activeProcessing = farm.processor.queue[0] || null
  return {
    matureFieldCount: tiles.filter(tile => tile.crop && isCropMature(tile.crop, now)).length,
    processing: {
      queuedCount: farm.processor.queue.length,
      nextCompletionAt: activeProcessing?.completesAt || null,
    },
    orders: {
      readyCount: farm.orders.slots.filter(slot =>
        slot.order && canCompleteOrder(slot.order, inventory)).length,
    },
    farmLevel: farm.level,
    farmExp: farm.exp,
  }
}

export function buildFarmViewModel(snapshot, config = FARM_CONFIG, now = new Date().toISOString()) {
  const { farm, inventory = {}, coins = 0, petLevel = 1 } = snapshot
  const sourceTiles = farm.farms[farm.activeFarmId].tiles
  const workingBuildingIds = new Set(sourceTiles.flatMap(tile =>
    tile.crop?.snapshot?.contributingBuildingIds || []))
  const buildingCount = sourceTiles.filter(tile => tile.building).length
  const buildingCapacity = buildingCapacityFor(petLevel, config)

  const crops = Object.entries(config.crops).map(([id, crop]) => ({
    id,
    name: config.items[id]?.name || id,
    emoji: config.items[id]?.emoji || '🌱',
    seedId: crop.seedId,
    seedCount: inventory[crop.seedId] || 0,
    quickBuyPrice: crop.seedPrice,
    unlockFarmLevel: crop.unlockFarmLevel,
    unlocked: farm.level >= crop.unlockFarmLevel,
  }))

  const buildings = Object.entries(config.buildings).map(([id, building]) => ({
    id,
    name: BUILDING_META[id]?.name || id,
    emoji: BUILDING_META[id]?.emoji || '🏠',
    unlocked: farm.level >= building.unlockFarmLevel,
    unlockFarmLevel: building.unlockFarmLevel,
    cost: building.levels[1].cost,
  }))

  const tiles = sourceTiles.map(tile => {
    const cropMeta = tile.crop ? config.items[tile.crop.cropId] : null
    const mature = Boolean(tile.crop && isCropMature(tile.crop, now))
    const buildingMeta = tile.building ? BUILDING_META[tile.building.typeId] : null
    const nextLandLevel = tile.landLevel && tile.landLevel < 3 ? tile.landLevel + 1 : null
    const nextBuildingLevel = tile.building && tile.building.level < 3
      ? tile.building.level + 1
      : null
    const nextBuildingConfig = nextBuildingLevel
      ? config.buildings[tile.building.typeId].levels[nextBuildingLevel]
      : null
    return {
      ...structuredClone(tile),
      cropView: tile.crop ? {
        name: cropMeta?.name || tile.crop.cropId,
        emoji: cropMeta?.emoji || '🌱',
        mature,
        remaining: formatRemaining(tile.crop.readyAt, now),
        quantity: tile.crop.snapshot.quantity,
      } : null,
      unlock: tile.occupancy === 'locked'
        ? unlockDetails(sourceTiles, petLevel, coins, tile.id, config)
        : null,
      land: tile.occupancy !== 'locked' ? {
        level: tile.landLevel,
        nextLevel: nextLandLevel,
        nextCost: nextLandLevel ? config.rewards.landUpgradeCosts[nextLandLevel] : null,
      } : null,
      building: tile.building ? {
        ...structuredClone(tile.building),
        name: buildingMeta?.name || tile.building.typeId,
        emoji: buildingMeta?.emoji || '🏠',
        working: workingBuildingIds.has(tile.building.id),
        refundPreview: Math.floor(tile.building.investedCoins * config.rewards.buildingRefundRate),
        nextLevel: nextBuildingLevel,
        nextCost: nextBuildingConfig?.cost ?? null,
        nextUnlockFarmLevel: nextBuildingConfig?.unlockFarmLevel ?? null,
      } : null,
    }
  })

  return {
    tiles,
    crops,
    buildings,
    summary: farmSummary(farm, inventory, now),
    coins,
    petLevel,
    buildingCount,
    buildingCapacity,
    farmLevelRequiredExp: config.farmLevels[farm.level - 1]?.requiredExp ?? null,
    now,
  }
}

function tileAriaLabel(tile, eligibleMoveTarget = false) {
  if (tile.occupancy === 'locked') {
    if (tile.unlock.complete) return `${tile.id}，锁定，农田已全部开放`
    const relation = tile.unlock.eligible ? '可扩建' : '未与开放土地相邻'
    return `${tile.id}，锁定，${relation}，需要宠物 ${tile.unlock.petLevel} 级和 ${tile.unlock.price} 金币`
  }
  if (tile.building) {
    return `${tile.id}，${tile.building.name} ${tile.building.level} 级${tile.building.working ? '，工作中' : ''}`
  }
  if (tile.cropView) {
    return `${tile.id}，${tile.cropView.name}，${tile.cropView.mature ? '已成熟' : `生长中，剩余${tile.cropView.remaining}`}`
  }
  return `${tile.id}，${tile.land.level} 级空田${eligibleMoveTarget ? '，可作为建筑移动目标' : ''}`
}

export function renderFieldGrid(vm, mode = null, selectedTileId = null) {
  return vm.tiles.map(tile => {
    const moving = mode?.type === 'move-building'
    const eligibleMoveTarget = moving && tile.occupancy === 'field' && !tile.crop
    const classes = [
      'farm-tile',
      `farm-tile--${tile.occupancy}`,
      tile.cropView?.mature ? 'farm-tile--mature' : '',
      tile.id === selectedTileId ? 'farm-tile--selected' : '',
      eligibleMoveTarget ? 'farm-tile--move-target' : '',
    ].filter(Boolean).join(' ')
    let body = `<span class="farm-tile-land">田 Lv.${tile.land?.level || '-'}</span>`
    if (tile.occupancy === 'locked') {
      body = `<span class="farm-tile-icon">🔒</span><span class="farm-tile-label">${tile.unlock.eligible ? '可扩建' : '锁定'}</span>`
    } else if (tile.building) {
      body = `<span class="farm-building farm-building--${escapeHtml(tile.building.typeId.split(':')[1])}">
        <span class="farm-tile-icon">${tile.building.emoji}</span>
        <span class="farm-tile-label">${escapeHtml(tile.building.name)} Lv.${tile.building.level}</span>
        ${tile.building.working ? '<span class="farm-tile-badge">工作中</span>' : ''}
      </span>`
    } else if (tile.cropView) {
      body = `<span class="farm-crop${tile.cropView.mature ? ' farm-crop--mature' : ''}">
        <span class="farm-tile-icon">${tile.cropView.emoji}</span>
        <span class="farm-tile-label">${escapeHtml(tile.cropView.name)}</span>
        <span class="farm-tile-time">${escapeHtml(tile.cropView.remaining)}</span>
      </span>`
    }
    return `<button type="button" class="${classes}" data-tile-id="${escapeHtml(tile.id)}"
      aria-label="${escapeHtml(tileAriaLabel(tile, eligibleMoveTarget))}" aria-pressed="${tile.id === selectedTileId}">
      ${body}
    </button>`
  }).join('')
}

function summaryHtml(vm) {
  const required = vm.farmLevelRequiredExp
  const expLabel = required === null ? 'MAX' : `${vm.summary.farmExp}/${required}`
  const queueLabel = vm.summary.processing.queuedCount
    ? `${vm.summary.processing.queuedCount} 批`
    : '空闲'
  const queueTime = vm.summary.processing.nextCompletionAt
    ? formatRemaining(vm.summary.processing.nextCompletionAt, vm.now)
    : ''
  return `<section class="farm-summary" aria-label="农场摘要">
    <div class="farm-summary-item"><span>农场</span><strong>Lv.${vm.summary.farmLevel}</strong><small>${expLabel}</small></div>
    <div class="farm-summary-item"><span>成熟</span><strong>${vm.summary.matureFieldCount}</strong><small>块田</small></div>
    <div class="farm-summary-item"><span>加工</span><strong>${queueLabel}</strong>${queueTime ? `<small>${escapeHtml(queueTime)}</small>` : ''}</div>
    <div class="farm-summary-item"><span>订单</span><strong>${vm.summary.orders.readyCount}</strong><small>可交付</small></div>
    <div class="farm-summary-item"><span>金币</span><strong>${vm.coins}</strong><small>🪙</small></div>
  </section>`
}

export function renderFarmShell(vm, ui = {}) {
  const harvestDisabled = vm.summary.matureFieldCount === 0 ? ' disabled' : ''
  const activeTab = ui.activeTab || 'field'
  const tab = (id, label) => `<button type="button" class="farm-tab${activeTab === id ? ' farm-tab--active' : ''}"
    role="tab" aria-selected="${activeTab === id}" data-farm-tab="${id}">${label}</button>`
  let fieldContent = `<div class="farm-toolbar">
      <span>建筑 ${vm.buildingCount}/${vm.buildingCapacity}</span>
      <span class="farm-feedback" role="status" aria-live="polite">${escapeHtml(ui.feedback || '')}</span>
      <button type="button" class="farm-btn farm-btn--primary" data-action="harvest-all"${harvestDisabled}${ui.busy ? ' disabled' : ''}>收获全部</button>
      <button type="button" class="farm-btn" data-action="open-warehouse">前往仓库</button>
    </div>
    <div class="farm-workspace">
      <div class="farm-grid" role="grid" aria-label="4×4 农田">
        ${renderFieldGrid(vm, ui.mode, ui.selectedTileId)}
      </div>
      <aside class="farm-actions" aria-label="田地操作">
        ${renderActionPanel(vm, ui)}
      </aside>
    </div>`
  if (ui.busy) {
    fieldContent = fieldContent.replace(
      /<button(?=[^>]*data-action="(?!open-warehouse)[^"]+")[^>]*>/g,
      tag => tag.includes(' disabled') ? tag : tag.replace('>', ' disabled>'),
    )
  }
  return `<div class="farm-page">
    ${summaryHtml(vm)}
    ${ui.bird || ui.birdRewardText ? `<div class="farm-bird-visit">
      ${ui.bird ? `<button type="button" class="farm-bird" data-action="claim-bird"
        data-bird-id="${escapeHtml(ui.bird.birdId)}"
        aria-label="点击小鸟获得金币"${ui.birdClaimBusy ? ' disabled' : ''}>🐦</button>` : ''}
      ${ui.birdRewardText ? `<span class="farm-bird-reward" role="status">${escapeHtml(ui.birdRewardText)}</span>` : ''}
    </div>` : ''}
    <div class="farm-tabs" role="tablist" aria-label="农场区域">
      ${tab('field', '农田')}
      ${tab('processing', '加工')}
      ${tab('orders', '订单')}
    </div>
    <div class="farm-tab-content" data-active-farm-tab="${activeTab}">
      ${activeTab === 'field' ? fieldContent : ''}
    </div>
  </div>`
}

function cropButtons(vm, tile) {
  return vm.crops.map(crop => {
    const disabled = !crop.unlocked
    const countText = crop.seedCount > 0 ? `种子 ×${crop.seedCount}` : `快捷购种 ${crop.quickBuyPrice}🪙`
    return `<button type="button" class="farm-choice" data-action="plant"
      data-tile-id="${escapeHtml(tile.id)}" data-crop-id="${escapeHtml(crop.id)}"
      data-quick-buy="${crop.seedCount === 0}" ${disabled ? 'disabled' : ''}>
      <span>${crop.emoji} ${escapeHtml(crop.name)}</span>
      <small>${disabled ? `农场 Lv.${crop.unlockFarmLevel} 解锁` : countText}</small>
    </button>`
  }).join('')
}

function buildingButtons(vm, tile) {
  const capacityReached = vm.buildingCount >= vm.buildingCapacity
  return vm.buildings.map(building =>
    `<button type="button" class="farm-choice" data-action="build"
      data-tile-id="${escapeHtml(tile.id)}" data-building-type="${escapeHtml(building.id)}"
      ${!building.unlocked || capacityReached ? 'disabled' : ''}>
      <span>${building.emoji} ${escapeHtml(building.name)}</span>
      <small>${capacityReached
        ? '建筑容量已满'
        : (building.unlocked ? `${building.cost}🪙` : `农场 Lv.${building.unlockFarmLevel} 解锁`)}</small>
    </button>`).join('')
}

function renderActionPanel(vm, ui) {
  if (ui.mode?.type === 'move-building') {
    return `<div class="farm-action-title">移动建筑</div>
      <p>请选择高亮的空田作为目标位置。</p>
      <button type="button" class="farm-btn" data-action="cancel-mode">取消移动</button>`
  }
  const tile = vm.tiles.find(entry => entry.id === ui.selectedTileId)
  if (!tile) return '<div class="farm-action-empty">选择一块田查看可用操作</div>'
  if (tile.occupancy === 'locked') {
    if (!tile.unlock.eligible) {
      return `<div class="farm-action-title">锁定土地</div><p>需要与已开放土地上下左右相邻。</p>`
    }
    return `<div class="farm-action-title">扩建土地</div>
      <p>需要宠物 Lv.${tile.unlock.petLevel}，花费 ${tile.unlock.price} 金币。</p>
      <button type="button" class="farm-btn farm-btn--primary" data-action="unlock"
        data-tile-id="${escapeHtml(tile.id)}">解锁土地</button>`
  }
  if (tile.building) {
    const building = tile.building
    const upgradeDisabled = !building.nextLevel
      || vm.summary.farmLevel < building.nextUnlockFarmLevel
      || vm.coins < building.nextCost
    return `<div class="farm-action-title">${building.emoji} ${escapeHtml(building.name)} Lv.${building.level}</div>
      <p>${building.working ? '正在为生长作物提供效果，移动和拆除已锁定。' : `空闲；拆除预计返还 ${building.refundPreview} 金币。`}</p>
      <div class="farm-action-buttons">
        <button type="button" class="farm-btn" data-action="move-building" data-building-id="${escapeHtml(building.id)}"
          ${building.working ? 'disabled' : ''}>移动</button>
        <button type="button" class="farm-btn" data-action="upgrade-building" data-building-id="${escapeHtml(building.id)}"
          ${upgradeDisabled ? 'disabled' : ''}>${building.nextLevel ? `升级 Lv.${building.nextLevel}（${building.nextCost}🪙）` : '已满级'}</button>
        <button type="button" class="farm-btn farm-btn--danger" data-action="demolish-building"
          data-building-id="${escapeHtml(building.id)}" data-refund="${building.refundPreview}"
          data-building-name="${escapeHtml(building.name)}" ${building.working ? 'disabled' : ''}>拆除</button>
      </div>`
  }
  if (tile.cropView) {
    if (tile.cropView.mature) {
      return `<div class="farm-action-title">${tile.cropView.emoji} ${escapeHtml(tile.cropView.name)}已成熟</div>
        <p>预计收获 ×${tile.cropView.quantity}</p>
        <button type="button" class="farm-btn farm-btn--primary" data-action="harvest"
          data-tile-id="${escapeHtml(tile.id)}">收获</button>`
    }
    return `<div class="farm-action-title">${tile.cropView.emoji} ${escapeHtml(tile.cropView.name)}生长中</div>
      <p>剩余 ${escapeHtml(tile.cropView.remaining)}</p>
      <button type="button" class="farm-btn farm-btn--danger" data-action="remove-crop"
        data-tile-id="${escapeHtml(tile.id)}" data-crop-name="${escapeHtml(tile.cropView.name)}">移除作物</button>`
  }
  const upgradeDisabled = !tile.land.nextLevel || vm.coins < tile.land.nextCost
  return `<div class="farm-action-title">空田 Lv.${tile.land.level}</div>
    <div class="farm-action-section"><h3>播种</h3>${cropButtons(vm, tile)}</div>
    <div class="farm-action-section"><h3>土地与建筑</h3>
      <button type="button" class="farm-choice" data-action="upgrade-land" data-tile-id="${escapeHtml(tile.id)}"
        ${upgradeDisabled ? 'disabled' : ''}>
        <span>${tile.land.nextLevel ? `升级为 Lv.${tile.land.nextLevel}` : '土地已满级'}</span>
        <small>${tile.land.nextCost ? `${tile.land.nextCost}🪙` : ''}</small>
      </button>
      ${buildingButtons(vm, tile)}
    </div>`
}

function confirmationHtml({ title, body, bodyHtml, confirmLabel = '确认' }) {
  return `<style>
    body{margin:0;background:#2c2c2c;color:#ddd;font-family:'Microsoft YaHei','PingFang SC',sans-serif}
    #overlay-handle{display:none}.farm-confirm{padding:16px}.farm-confirm h2{font-size:15px;margin:0 0 10px;color:#fff}
    .farm-confirm p{font-size:13px;line-height:1.6;margin:0 0 16px}.farm-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
    .farm-confirm button{padding:7px 16px;border:1px solid #555;border-radius:6px;background:transparent;color:#ddd}
    .farm-confirm .danger{border-color:#e57373;color:#ef9a9a}
  </style><div class="farm-confirm">
    <h2>${escapeHtml(title)}</h2><p>${bodyHtml || escapeHtml(body)}</p>
    <div class="farm-confirm-actions">
      <button type="button" data-overlay-result="cancel">取消</button>
      <button type="button" class="danger" data-overlay-result="confirm">${escapeHtml(confirmLabel)}</button>
    </div>
  </div>`
}

export function mountFarm(container, {
  service,
  petState,
  eventBus,
  onNavigateWarehouse = () => {},
  showOverlay = options => window.electronAPI.showOverlay(options),
  closeOverlay = () => window.electronAPI.closeOverlay(),
  now = () => new Date().toISOString(),
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  createBirdSchedulerFn = createBirdScheduler,
  documentRef = globalThis.document,
} = {}) {
  let disposed = false
  let generation = 0
  let tabGeneration = 0
  let activeTab = 'field'
  let activeTabCleanup = null
  const processingBoundaries = new Set()
  const orderBoundaries = new Set()
  let selectedTileId = null
  let mode = null
  let feedback = ''
  let mutationBusy = false
  let settlementInFlight = null
  let settlementPending = false
  let currentBird = null
  let birdClaimBusy = false
  let birdRewardText = ''

  const snapshot = () => ({
    farm: petState.get('farm'),
    inventory: petState.get('inventory') || {},
    coins: petState.get('coins') || 0,
    petLevel: petState.get('level') || 1,
  })

  const render = () => {
    if (disposed) return
    activeTabCleanup?.()
    activeTabCleanup = null
    const vm = buildFarmViewModel(snapshot(), FARM_CONFIG, now())
    if (selectedTileId && !vm.tiles.some(tile => tile.id === selectedTileId)) selectedTileId = null
    container.className = 'page page--farm'
    container.innerHTML = renderFarmShell(vm, {
      selectedTileId,
      mode,
      feedback,
      activeTab,
      busy: mutationBusy,
      bird: currentBird,
      birdClaimBusy,
      birdRewardText,
    })
    const childContainer = container.querySelector?.('.farm-tab-content')
    if (!childContainer || activeTab === 'field') return
    const childActions = {
      now,
      isBusy: () => mutationBusy,
      requestSettlement,
      setIntervalFn,
      clearIntervalFn,
    }
    if (activeTab === 'processing') {
      activeTabCleanup = renderProcessingTab(
        childContainer,
        buildProcessingViewModel(snapshot(), FARM_CONFIG, now()),
        {
          ...childActions,
          boundaryTracker: processingBoundaries,
          onEnqueue: recipeId => execute(() => service.enqueue({ recipeId })),
          onCancel: taskId => confirmCancelProcessing(taskId),
        },
      )
    } else {
      activeTabCleanup = renderOrdersTab(
        childContainer,
        buildOrdersViewModel(snapshot(), now()),
        {
          ...childActions,
          boundaryTracker: orderBoundaries,
          onComplete: slotIndex => execute(() => service.completeOrder({ slotIndex })),
          onAbandon: slotIndex => confirmAbandonOrder(slotIndex),
        },
      )
    }
  }

  const execute = async command => {
    if (disposed || mutationBusy) return
    mutationBusy = true
    const callGeneration = generation
    const blockingSettlement = settlementInFlight
    render()
    try {
      if (blockingSettlement) await blockingSettlement
      if (disposed || callGeneration !== generation) return
      const result = await command()
      if (disposed || callGeneration !== generation) return
      feedback = result.ok
        ? (result.uiSuccessMessage || '操作成功')
        : (ERROR_MESSAGES[result.error] || '操作失败，请重试。')
    } catch (error) {
      if (!disposed && callGeneration === generation) {
        console.error('[Farm UI] mutation failed:', error)
        feedback = '操作失败，请重试。'
      }
    } finally {
      if (!disposed && callGeneration === generation) {
        mutationBusy = false
        render()
        if (settlementPending) requestSettlement()
      }
    }
  }

  const confirmThen = async (options, command) => {
    const callGeneration = generation
    const callTabGeneration = tabGeneration
    const result = await showOverlay({
      html: confirmationHtml(options),
      width: 360,
      height: 180,
      x: 120,
      y: 100,
    })
    if (disposed || callGeneration !== generation || callTabGeneration !== tabGeneration
        || result !== 'confirm') return
    await execute(command)
  }

  function requestSettlement() {
    if (disposed) return Promise.resolve()
    if (mutationBusy) {
      settlementPending = true
      return Promise.resolve()
    }
    if (settlementInFlight) {
      settlementPending = true
      return settlementInFlight
    }
    settlementPending = false
    const callGeneration = generation
    settlementInFlight = Promise.resolve(service.settle())
      .catch(error => {
        if (!disposed && callGeneration === generation) {
          console.error('[Farm UI] settlement failed:', error)
          feedback = '结算失败，将稍后重试。'
        }
      })
      .finally(() => {
        settlementInFlight = null
        if (!disposed && callGeneration === generation) {
          birdScheduler?.start({ dailyCount: birdDailyCount() })
          render()
          if (settlementPending && !mutationBusy) requestSettlement()
        }
      })
    return settlementInFlight
  }

  function confirmCancelProcessing(taskId) {
    const task = snapshot().farm.processor.queue.find(entry => entry.id === taskId)
    if (!task || task.status !== 'queued') return
    const details = Object.entries(task.inputs).map(([id, count]) => {
      const item = ITEMS[id]
      return `${escapeHtml(item?.name || id)} × ${count}`
    }).join('、')
    confirmThen({
      title: '取消排队任务',
      bodyHtml: `将全部返还：${details}。确定取消吗？`,
      confirmLabel: '确认取消',
    }, () => service.cancelQueued({ taskId }))
  }

  function confirmAbandonOrder(slotIndex) {
    const order = snapshot().farm.orders.slots[slotIndex]?.order
    if (!order) return
    const details = Object.entries(order.requirements).map(([id, count]) => {
      const item = ITEMS[id]
      return `${escapeHtml(item?.name || id)} × ${count}`
    }).join('、')
    confirmThen({
      title: '放弃订单',
      bodyHtml: `订单需求：${details}。放弃后本槽进入 30 分钟冷却，期间无订单。`,
      confirmLabel: '确认放弃',
    }, () => service.abandonOrder({ slotIndex }))
  }

  const onClick = event => {
    const tabButton = event.target.closest('[data-farm-tab]')
    if (tabButton) {
      const nextTab = tabButton.dataset.farmTab
      if (['field', 'processing', 'orders'].includes(nextTab) && nextTab !== activeTab) {
        tabGeneration += 1
        activeTab = nextTab
        selectedTileId = null
        mode = null
        feedback = ''
        render()
      }
      return
    }
    const tileButton = event.target.closest('[data-tile-id].farm-tile')
    const action = event.target.closest('[data-action]')
    if (tileButton && !action) {
      const tileId = tileButton.dataset.tileId
      if (mode?.type === 'move-building') {
        const vm = buildFarmViewModel(snapshot(), FARM_CONFIG, now())
        const tile = vm.tiles.find(entry => entry.id === tileId)
        if (tile?.occupancy === 'field' && !tile.crop) {
          const buildingId = mode.buildingId
          mode = null
          execute(() => service.moveBuilding({ buildingId, targetTileId: tileId }))
        } else {
          feedback = '请选择没有作物的开放田地。'
          render()
        }
        return
      }
      selectedTileId = tileId
      feedback = ''
      render()
      return
    }
    if (!action || action.disabled) return
    if (mutationBusy && action.dataset.action !== 'open-warehouse') return
    const data = action.dataset
    switch (data.action) {
      case 'claim-bird':
        claimCurrentBird(data.birdId)
        break
      case 'harvest-all':
        execute(() => service.harvestAll())
        break
      case 'open-warehouse':
        onNavigateWarehouse()
        break
      case 'plant':
        execute(() => service.plant({
          tileId: data.tileId,
          cropId: data.cropId,
          quickBuy: data.quickBuy === 'true',
        }))
        break
      case 'harvest':
        execute(() => service.harvest({ tileId: data.tileId }))
        break
      case 'remove-crop':
        confirmThen({
          title: `移除${data.cropName}`,
          body: '当前作物及本轮种子投入不会返还。确定要移除吗？',
          confirmLabel: '确认移除',
        }, () => service.removeCrop({ tileId: data.tileId }))
        break
      case 'unlock':
        execute(() => service.unlockTile({ tileId: data.tileId }))
        break
      case 'upgrade-land':
        execute(() => service.upgradeLand({ tileId: data.tileId }))
        break
      case 'build':
        execute(() => service.build({ tileId: data.tileId, typeId: data.buildingType }))
        break
      case 'move-building':
        mode = { type: 'move-building', buildingId: data.buildingId }
        feedback = '请选择一个高亮的空田。'
        render()
        break
      case 'cancel-mode':
        mode = null
        feedback = ''
        render()
        break
      case 'upgrade-building':
        execute(() => service.upgradeBuilding({ buildingId: data.buildingId }))
        break
      case 'demolish-building':
        confirmThen({
          title: `拆除${data.buildingName}`,
          body: `预计返还 ${data.refund} 金币（累计投入的 50%，向下取整）。确定要拆除吗？`,
          confirmLabel: '确认拆除',
        }, async () => {
          const result = await service.demolishBuilding({ buildingId: data.buildingId })
          return result.ok
            ? { ...result, uiSuccessMessage: `已返还 ${result.refund} 金币。` }
            : result
        })
        break
    }
  }

  async function claimCurrentBird(birdId) {
    if (disposed || birdClaimBusy || !currentBird || currentBird.birdId !== birdId) return
    birdClaimBusy = true
    const callGeneration = generation
    render()
    try {
      const result = await service.claimBird({ birdId })
      if (disposed || callGeneration !== generation) return
      if (!result.ok) {
        birdClaimBusy = false
        feedback = ERROR_MESSAGES[result.error] || '小鸟已经飞走了。'
        render()
        return
      }
      birdRewardText = `+${result.amount} 🪙`
      birdClaimBusy = false
      birdScheduler.claimed({
        birdId,
        dailyCount: birdDailyCount(),
      })
      render()
    } catch (error) {
      if (!disposed && callGeneration === generation) {
        console.error('[Farm UI] bird claim failed:', error)
        birdClaimBusy = false
        feedback = '领取失败，请重试。'
        render()
      }
    }
  }

  container.addEventListener('click', onClick)
  const unsubscribeFarm = eventBus?.on?.(EVENTS.FARM_STATE_CHANGED, () => render()) || (() => {})
  const unsubscribePet = petState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    if (['farm', 'inventory', 'coins', 'level'].includes(key)) render()
  })
  const tick = setIntervalFn(requestSettlement, 30_000)
  const birdScheduler = documentRef
    ? createBirdSchedulerFn({
        onAppear(bird) {
          if (disposed) return
          currentBird = bird
          birdClaimBusy = false
          birdRewardText = ''
          render()
        },
        onLeave(bird) {
          if (disposed || currentBird?.birdId !== bird.birdId) return
          currentBird = null
          birdClaimBusy = false
          render()
        },
      })
    : null
  const birdDailyCount = () => {
    const daily = snapshot().farm?.daily
    const date = new Date(now())
    if (!Number.isFinite(date.getTime())) return 0
    const today = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')
    return daily?.birdRewardDate === today
      ? Math.max(0, Math.min(10, daily.birdRewardCount || 0))
      : 0
  }
  const onVisibilityChange = () => {
    birdScheduler?.setVisible(!documentRef.hidden, { dailyCount: birdDailyCount() })
  }
  documentRef?.addEventListener?.('visibilitychange', onVisibilityChange)
  if (documentRef?.hidden) {
    birdScheduler?.setVisible(false, { dailyCount: birdDailyCount() })
  }
  birdScheduler?.start({ dailyCount: birdDailyCount() })
  render()

  return () => {
    if (disposed) return
    disposed = true
    generation += 1
    mode = null
    activeTabCleanup?.()
    activeTabCleanup = null
    clearIntervalFn(tick)
    container.removeEventListener('click', onClick)
    unsubscribeFarm()
    unsubscribePet()
    documentRef?.removeEventListener?.('visibilitychange', onVisibilityChange)
    birdScheduler?.destroy()
    closeOverlay()
  }
}
