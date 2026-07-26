import { ITEMS } from '../../shared/item-config.js'
import { EVENTS } from '../../shared/events.js'
import {
  FARM_CONFIG,
} from './farm-config.mjs'
import { canCompleteOrder } from './farm-orders.mjs'
import { canUnlockTile, isCropMature } from './farm-rules.mjs'

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
  return {
    matureFieldCount: tiles.filter(tile => tile.crop && isCropMature(tile.crop, now)).length,
    processing: { queuedCount: farm.processor.queue.length },
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
  return `<section class="farm-summary" aria-label="农场摘要">
    <div class="farm-summary-item"><span>农场</span><strong>Lv.${vm.summary.farmLevel}</strong><small>${expLabel}</small></div>
    <div class="farm-summary-item"><span>成熟</span><strong>${vm.summary.matureFieldCount}</strong><small>块田</small></div>
    <div class="farm-summary-item"><span>加工</span><strong>${queueLabel}</strong></div>
    <div class="farm-summary-item"><span>订单</span><strong>${vm.summary.orders.readyCount}</strong><small>可交付</small></div>
    <div class="farm-summary-item"><span>金币</span><strong>${vm.coins}</strong><small>🪙</small></div>
  </section>`
}

export function renderFarmShell(vm, ui = {}) {
  const harvestDisabled = vm.summary.matureFieldCount === 0 ? ' disabled' : ''
  return `<div class="farm-page">
    ${summaryHtml(vm)}
    <div class="farm-tabs" role="tablist" aria-label="农场区域">
      <button type="button" class="farm-tab farm-tab--active" role="tab" aria-selected="true" data-farm-tab="field">农田</button>
      <button type="button" class="farm-tab" role="tab" data-farm-tab="processing" disabled aria-disabled="true">加工</button>
      <button type="button" class="farm-tab" role="tab" data-farm-tab="orders" disabled aria-disabled="true">订单</button>
    </div>
    <div class="farm-toolbar">
      <span>建筑 ${vm.buildingCount}/${vm.buildingCapacity}</span>
      <span class="farm-feedback" role="status" aria-live="polite">${escapeHtml(ui.feedback || '')}</span>
      <button type="button" class="farm-btn farm-btn--primary" data-action="harvest-all"${harvestDisabled}>收获全部</button>
      <button type="button" class="farm-btn" data-action="open-warehouse">前往仓库</button>
    </div>
    <div class="farm-workspace">
      <div class="farm-grid" role="grid" aria-label="4×4 农田">
        ${renderFieldGrid(vm, ui.mode, ui.selectedTileId)}
      </div>
      <aside class="farm-actions" aria-label="田地操作">
        ${renderActionPanel(vm, ui)}
      </aside>
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

function confirmationHtml({ title, body, confirmLabel = '确认' }) {
  return `<style>
    body{margin:0;background:#2c2c2c;color:#ddd;font-family:'Microsoft YaHei','PingFang SC',sans-serif}
    #overlay-handle{display:none}.farm-confirm{padding:16px}.farm-confirm h2{font-size:15px;margin:0 0 10px;color:#fff}
    .farm-confirm p{font-size:13px;line-height:1.6;margin:0 0 16px}.farm-confirm-actions{display:flex;justify-content:flex-end;gap:8px}
    .farm-confirm button{padding:7px 16px;border:1px solid #555;border-radius:6px;background:transparent;color:#ddd}
    .farm-confirm .danger{border-color:#e57373;color:#ef9a9a}
  </style><div class="farm-confirm">
    <h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p>
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
} = {}) {
  let disposed = false
  let generation = 0
  let selectedTileId = null
  let mode = null
  let feedback = ''

  const snapshot = () => ({
    farm: petState.get('farm'),
    inventory: petState.get('inventory') || {},
    coins: petState.get('coins') || 0,
    petLevel: petState.get('level') || 1,
  })

  const render = () => {
    if (disposed) return
    const vm = buildFarmViewModel(snapshot(), FARM_CONFIG, now())
    if (selectedTileId && !vm.tiles.some(tile => tile.id === selectedTileId)) selectedTileId = null
    container.className = 'page page--farm'
    container.innerHTML = renderFarmShell(vm, { selectedTileId, mode, feedback })
  }

  const execute = async command => {
    const callGeneration = generation
    const result = await command()
    if (disposed || callGeneration !== generation) return
    feedback = result.ok
      ? (result.uiSuccessMessage || '操作成功')
      : (ERROR_MESSAGES[result.error] || '操作失败，请重试。')
    render()
  }

  const confirmThen = async (options, command) => {
    const callGeneration = generation
    const result = await showOverlay({
      html: confirmationHtml(options),
      width: 360,
      height: 180,
      x: 120,
      y: 100,
    })
    if (disposed || callGeneration !== generation || result !== 'confirm') return
    await execute(command)
  }

  const onClick = event => {
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
    const data = action.dataset
    switch (data.action) {
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

  container.addEventListener('click', onClick)
  const unsubscribeFarm = eventBus?.on?.(EVENTS.FARM_STATE_CHANGED, () => render()) || (() => {})
  const unsubscribePet = petState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    if (['farm', 'inventory', 'coins', 'level'].includes(key)) render()
  })
  const tick = setInterval(render, 30_000)
  render()

  return () => {
    if (disposed) return
    disposed = true
    generation += 1
    mode = null
    clearInterval(tick)
    container.removeEventListener('click', onClick)
    unsubscribeFarm()
    unsubscribePet()
    closeOverlay()
  }
}
