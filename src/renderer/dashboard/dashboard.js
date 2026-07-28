// 主面板 — 关闭按钮 + 窗口缩放

const MIN_W = 600
const MIN_H = 400
const EDGE = 8
const CORNER = 16

// ── 返回宠物 ──
document.getElementById('btn-close').addEventListener('click', async () => {
  disposeCurrentPage()
  window.electronAPI.closeOverlay()      // 关闭可能残留的右键菜单
  hideTooltip()
  Game2048UI.saveBeforeClose()
  await PetState.flush()
  window.electronAPI.toggleWindow()
})

// ── 窗口缩放 ──
let resizing = null     // { dir, sx, sy, bx, by, bw, bh }
let lastX = 0, lastY = 0

function hit(x, y) {
  const w = document.documentElement.clientWidth
  const h = document.documentElement.clientHeight
  let d = ''
  if (y < CORNER) d += 'n'
  else if (y > h - CORNER) d += 's'
  else if (y < EDGE) d += 'n'
  else if (y > h - EDGE) d += 's'
  if (x < CORNER) d += 'w'
  else if (x > w - CORNER) d += 'e'
  else if (x < EDGE) d += 'w'
  else if (x > w - EDGE) d += 'e'
  return d
}

const CURSORS = {
  n: 'ns-resize',  s: 'ns-resize',
  w: 'ew-resize',  e: 'ew-resize',
  nw:'nwse-resize', se:'nwse-resize',
  ne:'nesw-resize', sw:'nesw-resize',
}

// ── 光标刷新：用 rAF 持续设 document.body.style.cursor ──
;(function loop() {
  if (!resizing) {
    document.body.style.cursor = CURSORS[hit(lastX, lastY)] || 'default'
  }
  requestAnimationFrame(loop)
})()

document.addEventListener('mousemove', (e) => {
  lastX = e.clientX; lastY = e.clientY
})

document.addEventListener('pointerdown', (e) => {
  const dir = hit(e.clientX, e.clientY)
  if (!dir) return
  const w = document.documentElement.clientWidth
  const h = document.documentElement.clientHeight
  // 用 clientX/clientY 反推窗口左上角：窗口位置 = 屏幕位置 - 客户区位置
  // 屏幕位置走 IPC，客户区位置就是 clientX/Y
  window.electronAPI.getWindowPosition().then(pos => {
    resizing = {
      dir,
      sx: e.screenX, sy: e.screenY,
      bx: pos.x, by: pos.y, bw: w, bh: h,
    }
  })
  document.body.style.cursor = CURSORS[dir]
  e.preventDefault()
})

document.addEventListener('pointermove', (e) => {
  if (!resizing) return
  const { dir, sx, sy, bx, by, bw, bh } = resizing
  const dx = e.screenX - sx
  const dy = e.screenY - sy

  let x = bx, y = by, w = bw, h = bh
  if (dir.includes('e')) w = Math.max(MIN_W, bw + dx)
  if (dir.includes('s')) h = Math.max(MIN_H, bh + dy)
  if (dir.includes('w')) { w = Math.max(MIN_W, bw - dx); x = bx + (bw - w) }
  if (dir.includes('n')) { h = Math.max(MIN_H, bh - dy); y = by + (bh - h) }

  window.electronAPI.setWindowBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) })
})

document.addEventListener('pointerup', () => {
  resizing = null
})

// ── 宠物状态展示 ──

import { PetState } from '../shared/pet-state.js'
import { FOODS, FEED_CONFIG, calculateFeedTransaction, emitFed } from '../shared/feed-service.js'
import { getItem, listFeedableItems, listItems, listPurchasableItems } from '../shared/item-config.js'
import { addItems, getItemCount, removeItems } from '../shared/inventory-service.js'
import { calcRequiredExp, addExp, getFoodExp } from '../shared/exp-service.js'
import { calcMaxSatiety } from '../shared/satiety-service.js'
import { getMoodTier, migrateMood, boostMood, getExpMultiplier, MOOD_CONFIG } from '../shared/mood-service.js'
import { EVENTS } from '../shared/events.js'
import { loadRegisteredModule } from '../shared/module-registry.js'
import { NAV_ITEMS, WAREHOUSE_CATEGORIES } from './nav-config.js'
import { createPageNavigationCoordinator } from './page-navigation.js'
import { SETTINGS_TABS } from './settings-config.js'
import * as Game2048UI from '../games/2048/2048-ui.js'

// tooltip 字段 → 中文标签映射（字段驱动，加新字段只加一行）
const TOOLTIP_FIELDS = {
  satiety:   { label: '饱腹',   icon: '🍽' },
  exp:       { label: '经验',   icon: '⭐' },
  sellPrice: { label: '售价',   icon: '🪙' },
  buyPrice:  { label: '购买价', icon: '💰' },
  effect:    { label: '效果',   icon: '✨' },  // 道具预留
}

// inventory transaction helpers:start
export function sellInventoryItem({ inventory, coins, item, quantity }) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !item || !Number.isSafeInteger(item.sellPrice) || item.sellPrice <= 0) {
    return { ok: false, error: 'INVALID_QUANTITY' }
  }
  const removed = removeItems(inventory, { [item.id]: quantity })
  if (!removed.ok) return { ok: false, error: 'INSUFFICIENT_ITEMS' }
  const proceeds = item.sellPrice * quantity
  const nextCoins = coins + proceeds
  if (!Number.isSafeInteger(proceeds) || !Number.isSafeInteger(nextCoins) || nextCoins < 0) {
    return { ok: false, error: 'INVALID_QUANTITY' }
  }
  return { ok: true, updates: { inventory: removed.inventory, coins: nextCoins } }
}

export function destroyInventoryItem({ inventory, itemId, quantity }) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || typeof itemId !== 'string') {
    return { ok: false, error: 'INVALID_QUANTITY' }
  }
  const removed = removeItems(inventory, { [itemId]: quantity })
  if (!removed.ok) return { ok: false, error: 'INSUFFICIENT_ITEMS' }
  return { ok: true, updates: { inventory: removed.inventory } }
}

export function buyInventoryItem({ inventory, coins, item, quantity, farmLevel }) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || !item || !Number.isSafeInteger(item.buyPrice) || item.buyPrice <= 0) {
    return { ok: false, error: 'INVALID_QUANTITY' }
  }
  if (Number.isInteger(item.unlockFarmLevel) && farmLevel < item.unlockFarmLevel) {
    return { ok: false, error: 'ITEM_LOCKED' }
  }
  const cost = item.buyPrice * quantity
  if (!Number.isSafeInteger(cost) || cost <= 0) return { ok: false, error: 'INVALID_QUANTITY' }
  if (!Number.isSafeInteger(coins) || coins < cost) return { ok: false, error: 'INSUFFICIENT_COINS' }
  try {
    const nextInventory = addItems(inventory, { [item.id]: quantity })
    return { ok: true, updates: { inventory: nextInventory, coins: coins - cost } }
  } catch (error) {
    if (error?.name === 'RangeError') return { ok: false, error: 'INVALID_QUANTITY' }
    throw error
  }
}
// inventory transaction helpers:end

// ── 导航状态 ──
let currentPageId = 'home'

function buildHomePage() {
  const area = document.getElementById('content-area')
  area.className = 'page page--home'
  area.innerHTML = `
    <!-- 上半区：形象展示 -->
    <section class="portrait-layer">
      <div class="slot-list" id="slots-left">
        <div class="slot-item"></div>
        <div class="slot-item"></div>
        <div class="slot-item"></div>
      </div>
      <div class="portrait-area" id="portrait-area">
        <img src="../assets/pet/cream-star/portrait.webp"
             alt="宠物立绘"
             class="portrait-img"
             onerror="this.style.display='none';this.nextElementSibling.style.display='';">
        <span class="portrait-fallback" style="display:none">🐱</span>
      </div>
      <div class="slot-list" id="slots-right">
        <div class="slot-item"></div>
        <div class="slot-item"></div>
        <div class="slot-item"></div>
      </div>
    </section>

    <!-- 下半区：信息数据 -->
    <section class="info-layer">
      <div class="info-row--2col">
        <div class="card card--level" id="card-level"></div>
        <div class="card card--mood" id="card-mood"></div>
      </div>
      <div class="info-row--full">
        <div class="card card--satiety" id="card-satiety"></div>
      </div>
      <div class="info-row--3col">
        <div class="card card--intimacy" id="card-intimacy"></div>
        <div class="card card--coins" id="card-coins"></div>
        <div class="card card--inventory" id="card-inventory"></div>
      </div>
    </section>
  `
}

// ── 仓库页面 ──

function quantityOverlayHTML({ action, max, label }) {
  return `
    <style>
      .quantity-picker { display:grid; grid-template-columns:36px 1fr 36px; gap:8px; align-items:center; padding:10px; }
      .quantity-picker input { min-width:0; width:100%; box-sizing:border-box; text-align:center; }
      .quantity-picker__all { grid-column:1 / 2; }
      .quantity-picker__confirm { grid-column:2 / 4; }
      .quantity-picker button { min-height:32px; }
    </style>
    <div class="quantity-picker">
      <button data-quantity-step="-1">－</button>
      <input id="quantity" type="number" min="1" max="${max}" value="1">
      <button data-quantity-step="1">＋</button>
      <button class="quantity-picker__all" data-quantity-all data-quantity-input="quantity">全部</button>
      <button class="quantity-picker__confirm"
              data-overlay-quantity-action="${action}"
              data-overlay-quantity-input="quantity">${label}</button>
    </div>`
}

function showQuantityOverlay({ action, max, label, x, y }) {
  if (!Number.isSafeInteger(max) || max < 1) return Promise.resolve(null)
  return window.electronAPI.showOverlay({
    html: quantityOverlayHTML({ action, max, label }),
    width: 230,
    height: 120,
    x,
    y,
  })
}

function buildWarehousePage(container) {
  container.className = 'page page--warehouse'

  const inventory = PetState.get('inventory') || {}
  const allItems = listItems().map(item => ({
    ...item,
    count: getItemCount(inventory, item.id),
  }))

  let activeCatId = 'all'
  let pageActive = true
  let renderDelay = null

  // 类别优先级映射（按 WAREHOUSE_CATEGORIES 顺序，不含 'all'）
  const catOrder = Object.fromEntries(
    WAREHOUSE_CATEGORIES.filter(c => c.id !== 'all').map((c, i) => [c.id, i])
  )

  function renderGrid(catId) {
    const grid = container.querySelector('.wh-grid')
    if (!grid) return

    // 先筛再排：副本避免 sort() 改变 allItems 原始顺序
    const filtered = (catId === 'all'
      ? [...allItems]
      : allItems.filter(item => item.category === catId)
    ).sort((a, b) => {
      const catDiff = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99)
      if (catDiff !== 0) return catDiff
      return b.count - a.count
    })

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="wh-empty">📦 暂无物品</div>`
      return
    }

    grid.innerHTML = filtered.map(item => {
      const emptyCls = item.count === 0 ? ' wh-item--empty' : ''
      return `<div class="wh-item${emptyCls}" data-item-id="${item.id}">
        <span class="wh-item-emoji">${item.emoji}</span>
        <span class="wh-item-name">${item.name}</span>
        <span class="wh-item-count">×${item.count}</span>
      </div>`
    }).join('')
  }

  function setActiveTab(catId) {
    container.querySelectorAll('.wh-tab').forEach(tab => {
      tab.classList.toggle('wh-tab--active', tab.dataset.catId === catId)
    })
  }

  // 初始渲染
  container.innerHTML = `
    <div class="wh-tabs">
      ${WAREHOUSE_CATEGORIES.map(cat => `
        <button class="wh-tab${cat.id === 'all' ? ' wh-tab--active' : ''}${!cat.enabled ? ' wh-tab--disabled' : ''}"
                data-cat-id="${cat.id}"
                ${!cat.enabled ? 'disabled' : ''}>${cat.label}</button>
      `).join('')}
    </div>
    <div class="wh-grid"></div>
  `

  renderGrid('all')

  // Tab 点击：切分类 → 筛选 + fade 过渡
  container.querySelector('.wh-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.wh-tab')
    if (!tab || tab.disabled) return
    const catId = tab.dataset.catId
    if (catId === activeCatId) return

    activeCatId = catId
    setActiveTab(catId)

    const grid = container.querySelector('.wh-grid')
    grid.style.opacity = '0'
    renderDelay = setTimeout(() => {
      renderDelay = null
      if (!pageActive) return
      renderGrid(catId)
      requestAnimationFrame(() => { grid.style.opacity = '1' })
    }, 200)
  })

  // ── 仓库物品悬停 tooltip ──
  let _whTooltipItem = null      // 当前悬停的 .wh-item DOM 元素
  let _whContextMenuOpen = false // 右键菜单打开期间暂停 tooltip 触发

  container.querySelector('.wh-grid').addEventListener('mouseenter', (e) => {
    if (_whContextMenuOpen) return  // 右键菜单打开期间不触发 tooltip
    const itemEl = e.target.closest('.wh-item')
    if (itemEl === _whTooltipItem) return  // 同一物品内子元素间移动，跳过
    _whTooltipItem = itemEl
    if (!itemEl) return  // 进入 gap 区域，保持上一个 tooltip
    const itemId = itemEl.dataset.itemId
    const item = getItem(itemId)
    if (!item) return
    showTooltip(item, itemEl.getBoundingClientRect())
  }, true)

  container.querySelector('.wh-grid').addEventListener('mouseleave', (e) => {
    // 进入另一个物品 → 保留；进入 gap/padding/空白 → 隐藏
    if (e.relatedTarget && e.relatedTarget.closest('.wh-item')) return
    _whTooltipItem = null
    hideTooltip()
  }, true)

  // ── 仓库物品右键操作菜单 ──

  const WH_MENU_ACTIONS = [
    { id: 'use',     label: '使用',  icon: '🍽', show: (item, count) => Number.isFinite(item.satiety) && item.satiety > 0 && count > 0 },
    { id: 'sell',    label: '出售',  icon: '🪙', show: (item, count) => item.sellPrice > 0 && count > 0 },
    { id: 'destroy', label: '销毁',  icon: '🗑', show: (item, count) => count > 0 },
  ]

  container.querySelector('.wh-grid').addEventListener('contextmenu', async (e) => {
    const itemEl = e.target.closest('.wh-item')
    if (!itemEl) return
    e.preventDefault()

    // 关闭悬停 tooltip + 暂停后续触发
    hideTooltip()
    _whTooltipItem = null
    _whContextMenuOpen = true

    const itemId = itemEl.dataset.itemId
    const item = getItem(itemId)
    if (!item) { _whContextMenuOpen = false; return }

    // 用实时库存（渲染时的 allItems 可能因订阅更新而滞后，从 PetState 直接读）
    const currentInv = PetState.get('inventory') || {}
    const count = getItemCount(currentInv, itemId)

    // 构建菜单项；全禁用则不弹窗（否则无法关闭 overlay）
    const menuItems = WH_MENU_ACTIONS.map(action => {
      const enabled = action.show(item, count)
      return { action, enabled }
    })

    if (menuItems.every(m => !m.enabled)) { _whContextMenuOpen = false; return }

    const menuHTML = menuItems.map(({ action, enabled }) => {
      const attr = enabled ? `data-overlay-result="${action.id}"` : ''
      const style = enabled ? '' : 'opacity:0.35;pointer-events:none;'
      return `<div class="wh-menu-item" ${attr} style="${style}">
        <span>${action.icon}</span>
        <span>${action.label}</span>
      </div>`
    }).join('')

    const menuHTMLFull = `
      <style>
        #overlay-handle { display: none; }
        #overlay-content { padding: 4px 0; }
        .wh-menu { display: flex; flex-direction: column; }
        .wh-menu-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; cursor: pointer;
          color: #ccc; font-size: 13px;
          font-family: 'Microsoft YaHei','PingFang SC',sans-serif;
          transition: background 0.12s, color 0.12s;
        }
        .wh-menu-item:hover { background: #2196f3; color: #fff; }
        .wh-menu-item:first-child { border-radius: 8px 8px 0 0; }
        .wh-menu-item:last-child { border-radius: 0 0 8px 8px; }
        .wh-menu-item:only-child { border-radius: 8px; }
      </style>
      <div class="wh-menu" data-overlay-result="null">${menuHTML}</div>`

    const result = await window.electronAPI.showOverlay({
      html: menuHTMLFull,
      width: 130,
      height: WH_MENU_ACTIONS.length * 42 + 8,  // 每项 42px + 上下各 4px
      x: e.clientX,
      y: e.clientY,
    })

    // overlay 关闭后恢复 tooltip 悬停
    _whContextMenuOpen = false

    if (!pageActive || !result) return

    // 处理菜单操作
    switch (result) {
      case 'use':
        handleFeed(itemId)
        break

      case 'sell': {
        const quantityResult = await showQuantityOverlay({
          action: 'sell',
          max: count,
          label: '确认出售',
          x: e.clientX,
          y: e.clientY,
        })
        if (!pageActive || quantityResult?.action !== 'sell') break
        const transaction = sellInventoryItem({
          inventory: PetState.get('inventory') || {},
          coins: PetState.get('coins') || 0,
          item,
          quantity: quantityResult.quantity,
        })
        if (!transaction.ok) break
        PetState.setMany(transaction.updates)
        showToast(`出售了 ${quantityResult.quantity} 个${item.name}，获得 ${item.sellPrice * quantityResult.quantity} 🪙`)
        break
      }

      case 'destroy': {
        const quantityResult = await showQuantityOverlay({
          action: 'destroy',
          max: count,
          label: '确认销毁',
          x: e.clientX,
          y: e.clientY,
        })
        if (!pageActive || quantityResult?.action !== 'destroy') break
        const transaction = destroyInventoryItem({
          inventory: PetState.get('inventory') || {},
          itemId,
          quantity: quantityResult.quantity,
        })
        if (!transaction.ok) break
        PetState.setMany(transaction.updates)
        showToast(`销毁了 ${quantityResult.quantity} 个${item.name}`)
        break
      }
    }
  })

  // 订阅库存变更，自动刷新网格
  const unsub = PetState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    if (key !== 'inventory') return
    const inv = PetState.get('inventory') || {}
    allItems.forEach(item => { item.count = getItemCount(inv, item.id) })
    renderGrid(activeCatId)
  })

  // 返回清理函数：切换离开仓库页时取消订阅
  return () => {
    pageActive = false
    if (renderDelay) clearTimeout(renderDelay)
    unsub()
    window.electronAPI.closeOverlay()
  }
}

// ── 商店页面 ──

function buildShopPage(container) {
  container.className = 'page page--shop'

  const inventory = PetState.get('inventory') || {}
  const allItems = listPurchasableItems()
    .map(item => ({
      ...item,
      count: getItemCount(inventory, item.id),
    }))
    .sort((a, b) => a.buyPrice - b.buyPrice || a.id.localeCompare(b.id))

  let activeCatId = 'all'
  let pageActive = true
  let renderDelay = null

  function renderCoinsBar() {
    const el = container.querySelector('#shop-coins-value')
    if (!el) return
    el.textContent = PetState.get('coins') || 0
  }

  function renderGrid(catId) {
    const grid = container.querySelector('.shop-grid')
    if (!grid) return

    const filtered = catId === 'all'
      ? [...allItems]
      : allItems.filter(item => item.category === catId)

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="wh-empty">📦 暂无商品</div>`
      return
    }

    const coins = PetState.get('coins') || 0
    const farmLevel = PetState.get('farm')?.level || 1

    grid.innerHTML = filtered.map(item => {
      const locked = Number.isInteger(item.unlockFarmLevel) && farmLevel < item.unlockFarmLevel
      const canBuy = !locked && coins >= item.buyPrice
      const lockCopy = locked ? `农场 Lv.${item.unlockFarmLevel} 解锁` : ''
      return `<div class="shop-item${locked ? ' shop-item--locked' : ''}" data-item-id="${item.id}">
        <span class="shop-item-emoji">${item.emoji}</span>
        <span class="shop-item-name">${item.name}</span>
        <span class="shop-item-count">×${item.count}</span>
        <span class="shop-item-price">💰${item.buyPrice}</span>
        ${locked ? `<span class="shop-item-lock">${lockCopy}</span>` : ''}
        <button class="shop-btn${canBuy ? '' : ' shop-btn--disabled'}"
                data-action="buy" data-item-id="${item.id}"
                ${canBuy ? '' : 'disabled'}>购买</button>
      </div>`
    }).join('')
  }

  function setActiveTab(catId) {
    container.querySelectorAll('.wh-tab').forEach(tab => {
      tab.classList.toggle('wh-tab--active', tab.dataset.catId === catId)
    })
  }

  // 初始渲染
  container.innerHTML = `
    <div class="shop-coins-bar">
      <span class="shop-coins-label">🪙 金币：<span class="shop-coins-value" id="shop-coins-value">${PetState.get('coins') || 0}</span></span>
    </div>
    <div class="wh-tabs">
      ${WAREHOUSE_CATEGORIES.map(cat => `
        <button class="wh-tab${cat.id === 'all' ? ' wh-tab--active' : ''}${!cat.enabled ? ' wh-tab--disabled' : ''}"
                data-cat-id="${cat.id}"
                ${!cat.enabled ? 'disabled' : ''}>${cat.label}</button>
      `).join('')}
    </div>
    <div class="shop-grid"></div>
  `

  renderGrid('all')

  // Tab 点击：切分类 → 筛选 + fade 过渡
  container.querySelector('.wh-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.wh-tab')
    if (!tab || tab.disabled) return
    const catId = tab.dataset.catId
    if (catId === activeCatId) return

    activeCatId = catId
    setActiveTab(catId)

    const grid = container.querySelector('.shop-grid')
    grid.style.opacity = '0'
    renderDelay = setTimeout(() => {
      renderDelay = null
      if (!pageActive) return
      renderGrid(catId)
      requestAnimationFrame(() => { grid.style.opacity = '1' })
    }, 200)
  })

  // ── 购买按钮点击 ──
  container.querySelector('.shop-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="buy"]')
    if (!btn || btn.disabled) return
    const itemId = btn.dataset.itemId
    const item = getItem(itemId)
    if (!item) return

    const coins = PetState.get('coins') || 0
    const max = Math.floor(coins / item.buyPrice)
    if (max < 1) {
      showToast('金币不足 💰')
      return
    }
    const quantityResult = await showQuantityOverlay({
      action: 'buy',
      max,
      label: '确认购买',
      x: e.clientX,
      y: e.clientY,
    })
    if (!pageActive || quantityResult?.action !== 'buy') return
    const transaction = buyInventoryItem({
      inventory: PetState.get('inventory') || {},
      coins: PetState.get('coins') || 0,
      item,
      quantity: quantityResult.quantity,
      farmLevel: PetState.get('farm')?.level || 1,
    })
    if (!transaction.ok) return
    PetState.setMany(transaction.updates)
    showToast(`购买了 ${quantityResult.quantity} 个${item.name}！`)
  })

  // ── 商品悬停 tooltip ──
  let _shopTooltipItem = null
  let _shopContextMenuOpen = false

  container.querySelector('.shop-grid').addEventListener('mouseenter', (e) => {
    if (_shopContextMenuOpen) return
    const itemEl = e.target.closest('.shop-item')
    if (itemEl === _shopTooltipItem) return
    _shopTooltipItem = itemEl
    if (!itemEl) return
    const itemId = itemEl.dataset.itemId
    const item = getItem(itemId)
    if (!item) return
    // 商店 tooltip：把 sellPrice 替换为 buyPrice
    const shopFood = buildShopTooltipItem(item)
    showTooltip(shopFood, itemEl.getBoundingClientRect())
  }, true)

  container.querySelector('.shop-grid').addEventListener('mouseleave', (e) => {
    if (e.relatedTarget && e.relatedTarget.closest('.shop-item')) return
    _shopTooltipItem = null
    hideTooltip()
  }, true)

  // ── 商品右键操作菜单 ──

  const SHOP_MENU_ACTIONS = [
    { id: 'buy', label: '购买', icon: '💰', show: (item, coins) => coins >= item.buyPrice },
  ]

  container.querySelector('.shop-grid').addEventListener('contextmenu', async (e) => {
    const itemEl = e.target.closest('.shop-item')
    if (!itemEl) return
    e.preventDefault()

    hideTooltip()
    _shopTooltipItem = null
    _shopContextMenuOpen = true

    const itemId = itemEl.dataset.itemId
    const item = getItem(itemId)
    if (!item) { _shopContextMenuOpen = false; return }

    const coins = PetState.get('coins') || 0
    const farmLevel = PetState.get('farm')?.level || 1
    const locked = Number.isInteger(item.unlockFarmLevel) && farmLevel < item.unlockFarmLevel

    const menuItems = SHOP_MENU_ACTIONS.map(action => {
      const enabled = !locked && action.show(item, coins)
      return { action, enabled }
    })

    if (menuItems.every(m => !m.enabled)) { _shopContextMenuOpen = false; return }

    const menuHTML = menuItems.map(({ action, enabled }) => {
      const attr = enabled ? `data-overlay-result="${action.id}"` : ''
      const style = enabled ? '' : 'opacity:0.35;pointer-events:none;'
      return `<div class="wh-menu-item" ${attr} style="${style}">
        <span>${action.icon}</span>
        <span>${action.label}</span>
      </div>`
    }).join('')

    const menuHTMLFull = `
      <style>
        #overlay-handle { display: none; }
        #overlay-content { padding: 4px 0; }
        .wh-menu { display: flex; flex-direction: column; }
        .wh-menu-item {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; cursor: pointer;
          color: #ccc; font-size: 13px;
          font-family: 'Microsoft YaHei','PingFang SC',sans-serif;
          transition: background 0.12s, color 0.12s;
        }
        .wh-menu-item:hover { background: #2196f3; color: #fff; }
        .wh-menu-item:first-child { border-radius: 8px 8px 0 0; }
        .wh-menu-item:last-child { border-radius: 0 0 8px 8px; }
        .wh-menu-item:only-child { border-radius: 8px; }
      </style>
      <div class="wh-menu" data-overlay-result="null">${menuHTML}</div>`

    const result = await window.electronAPI.showOverlay({
      html: menuHTMLFull,
      width: 130,
      height: SHOP_MENU_ACTIONS.length * 42 + 8,
      x: e.clientX,
      y: e.clientY,
    })

    _shopContextMenuOpen = false

    if (!pageActive || result !== 'buy') return

    // 右键购买（与左键逻辑一致）
    const max = Math.floor(coins / item.buyPrice)
    const quantityResult = await showQuantityOverlay({
      action: 'buy',
      max,
      label: '确认购买',
      x: e.clientX,
      y: e.clientY,
    })
    if (!pageActive || quantityResult?.action !== 'buy') return
    const transaction = buyInventoryItem({
      inventory: PetState.get('inventory') || {},
      coins: PetState.get('coins') || 0,
      item,
      quantity: quantityResult.quantity,
      farmLevel: PetState.get('farm')?.level || 1,
    })
    if (!transaction.ok) return
    PetState.setMany(transaction.updates)
    showToast(`购买了 ${quantityResult.quantity} 个${item.name}！`)
  })

  // ── 订阅状态变更，自动刷新 ──
  const unsub = PetState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    if (key === 'coins') {
      renderCoinsBar()
      renderGrid(activeCatId)
    }
    if (key === 'inventory') {
      const inv = PetState.get('inventory') || {}
      allItems.forEach(item => { item.count = getItemCount(inv, item.id) })
      renderGrid(activeCatId)
    }
    if (key === 'farm') renderGrid(activeCatId)
  })

  // 返回清理函数：切换离开商店页时取消订阅
  return () => {
    pageActive = false
    if (renderDelay) clearTimeout(renderDelay)
    unsub()
    window.electronAPI.closeOverlay()
  }
}

// ── 番茄钟页面 ──

function buildPomodoroPage(container) {
  container.className = 'page page--pomodoro'

  // ── SVG 进度环常量 ──
  const R = 80
  const CIRC = 2 * Math.PI * R

  // ── 本地状态快照 ──
  let state = { phase: 'idle', remainingS: 0, isPaused: false, stats: { todayCount: 0, totalCount: 0, streakDays: 0 }, settings: { focusMin: 25, breakMin: 5 } }

  // ── 渲染函数 ──

  function totalSeconds() {
    return (state.phase === 'break' ? state.settings.breakMin : state.settings.focusMin) * 60
  }

  function progress() {
    const total = totalSeconds()
    if (total <= 0) return 0
    return Math.max(0, Math.min(1, state.remainingS / total))
  }

  function ringColor() {
    if (state.phase === 'break') return '#4caf50'
    return '#ff6b6b' // focus
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m'
    if (ms >= 3600000) {
      return Math.floor(ms / 3600000) + 'h ' + Math.round((ms % 3600000) / 60000) + 'm'
    }
    return Math.round(ms / 60000) + 'm'
  }

  function statusText() {
    if (state.phase === 'idle') return '准备开始'
    if (state.isPaused) return '已暂停'
    if (state.phase === 'focus') return '专注中'
    if (state.phase === 'break') return '休息中'
    return ''
  }

  function updateRing(el) {
    const p = progress()
    const offset = CIRC * (1 - p)
    const circle = el.querySelector('.pom-ring-circle')
    if (circle) {
      circle.style.strokeDasharray = CIRC
      circle.style.strokeDashoffset = offset
      circle.style.stroke = ringColor()
    }
    const timeEl = el.querySelector('.pom-timer-text')
    if (timeEl) timeEl.textContent = formatTime(state.remainingS)
  }

  function updateStatus(el) {
    const statusEl = el.querySelector('.pom-status')
    if (statusEl) statusEl.textContent = statusText()
  }

  function updateButtons(el) {
    const bar = el.querySelector('.pom-btn-bar')
    if (!bar) return

    const isIdle = state.phase === 'idle'
    const isPaused = state.isPaused
    const isBreak = state.phase === 'break'

    if (isIdle) {
      bar.innerHTML = `<button class="pom-btn pom-btn--start" data-action="start">▶ 开始</button>`
    } else if (isPaused) {
      bar.innerHTML = `
        <button class="pom-btn pom-btn--start" data-action="resume">▶ 继续</button>
        <button class="pom-btn pom-btn--skip" data-action="skip">⏭ 跳过</button>
        <button class="pom-btn pom-btn--abort" data-action="${isBreak ? 'end' : 'abort'}">✕ ${isBreak ? '结束' : '放弃'}</button>
      `
    } else {
      // running
      bar.innerHTML = `
        <button class="pom-btn pom-btn--pause" data-action="pause">⏸ 暂停</button>
        <button class="pom-btn pom-btn--skip" data-action="skip">⏭ 跳过</button>
        <button class="pom-btn pom-btn--abort" data-action="${isBreak ? 'end' : 'abort'}">✕ ${isBreak ? '结束' : '放弃'}</button>
      `
    }
  }

  function updateStats(el) {
    const s = state.stats
    const todayVal = el.querySelector('.pom-stat--today .pom-stat-value')
    const todayDur = el.querySelector('.pom-stat--today .pom-stat-duration')
    const totalVal = el.querySelector('.pom-stat--total .pom-stat-value')
    const totalDur = el.querySelector('.pom-stat--total .pom-stat-duration')
    const streakVal = el.querySelector('.pom-stat--streak .pom-stat-value')
    if (todayVal) todayVal.textContent = `${s.todayCount} 次`
    if (todayDur) todayDur.textContent = formatDuration(s.todayFocusMs)
    if (totalVal) totalVal.textContent = `${s.totalCount} 次`
    if (totalDur) totalDur.textContent = formatDuration(s.totalFocusMs)
    if (streakVal) streakVal.textContent = `${s.streakDays} 天`
  }

  function updateSettingsInputs(el) {
    const focusInput = el.querySelector('.pom-setting__input--focus')
    const breakInput = el.querySelector('.pom-setting__input--break')
    const isIdle = state.phase === 'idle'
    if (focusInput) {
      focusInput.value = state.settings.focusMin
      focusInput.disabled = !isIdle
    }
    if (breakInput) {
      breakInput.value = state.settings.breakMin
      breakInput.disabled = !isIdle
    }
  }

  function renderAll(el) {
    updateRing(el)
    updateStatus(el)
    updateButtons(el)
    updateStats(el)
    updateSettingsInputs(el)
  }

  // ── 初始 HTML ──
  container.innerHTML = `
    <div class="pom-ring-wrap">
      <svg class="pom-ring-svg" viewBox="0 0 180 180">
        <circle class="pom-ring-bg" cx="90" cy="90" r="${R}"
                fill="none" stroke="#444" stroke-width="8" />
        <circle class="pom-ring-circle" cx="90" cy="90" r="${R}"
                fill="none" stroke="${ringColor()}" stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${CIRC}" stroke-dashoffset="${CIRC}"
                transform="rotate(-90 90 90)" />
      </svg>
      <div class="pom-timer-text">${formatTime(state.remainingS)}</div>
    </div>

    <div class="pom-status">${statusText()}</div>

    <div class="pom-btn-bar"></div>

    <div class="pom-stats">
      <div class="pom-stat pom-stat--today">
        <span class="pom-stat-icon">🍅</span>
        <span class="pom-stat-label">今日</span>
        <span class="pom-stat-value">0 次</span>
        <span class="pom-stat-duration" style="font-size:11px;color:#888">0m</span>
      </div>
      <div class="pom-stat pom-stat--total">
        <span class="pom-stat-icon">📊</span>
        <span class="pom-stat-label">总计</span>
        <span class="pom-stat-value">0 次</span>
        <span class="pom-stat-duration" style="font-size:11px;color:#888">0m</span>
      </div>
      <div class="pom-stat pom-stat--streak">
        <span class="pom-stat-icon">🔥</span>
        <span class="pom-stat-label">连续天数</span>
        <span class="pom-stat-value">0 天</span>
      </div>
    </div>

    <div class="pom-settings">
      <label class="pom-setting">
        <span class="pom-setting__label">专注时长（分钟）</span>
        <input type="number" class="pom-setting__input pom-setting__input--focus"
               min="5" max="120" value="${state.settings.focusMin}">
      </label>
      <label class="pom-setting">
        <span class="pom-setting__label">休息时长（分钟）</span>
        <input type="number" class="pom-setting__input pom-setting__input--break"
               min="1" max="60" value="${state.settings.breakMin}">
      </label>
    </div>
  `

  // ── 初始化：获取当前状态 ──
  window.electronAPI.pomodoro.getState().then(s => {
    state = s
    renderAll(container)
  }).catch(err => {
    console.error('[PomodoroPage] getState failed:', err)
  })

  // 记录上一次的 phase+isPaused 用于按钮刷新
  let _lastPhase = state.phase
  let _lastPaused = state.isPaused

  // ── 每秒 tick ──
  const unsubTick = window.electronAPI.pomodoro.onTick(data => {
    const pausedChanged = data.isPaused !== _lastPaused || data.phase !== _lastPhase
    state.phase = data.phase
    state.remainingS = data.remainingS
    state.isPaused = data.isPaused

    _lastPhase = data.phase
    _lastPaused = data.isPaused

    updateRing(container)
    updateStatus(container)
    if (pausedChanged) updateButtons(container)
  })

  // ── 阶段切换 ──
  const unsubPhase = window.electronAPI.pomodoro.onPhaseChange(data => {
    state.phase = data.phase
    state.stats = data.stats
    // phase change 意味着 isPaused 一定为 false
    state.isPaused = false

    const phaseChanged = data.phase !== _lastPhase
    _lastPhase = data.phase
    _lastPaused = false

    updateRing(container)
    updateStatus(container)
    updateStats(container)
    updateSettingsInputs(container)
    if (phaseChanged) updateButtons(container)
  })

  // ── 按钮点击 ──
  container.querySelector('.pom-btn-bar').addEventListener('click', (e) => {
    const btn = e.target.closest('.pom-btn')
    if (!btn) return
    const action = btn.dataset.action
    if (!action) return
    window.electronAPI.pomodoro.command(action)
  })

  // ── 设置输入变更 ──
  const settingsEl = container.querySelector('.pom-settings')
  settingsEl.addEventListener('change', () => {
    const focusInput = container.querySelector('.pom-setting__input--focus')
    const breakInput = container.querySelector('.pom-setting__input--break')
    const focusMin = Math.max(5, Math.min(120, parseInt(focusInput.value, 10) || 25))
    const breakMin = Math.max(1, Math.min(60, parseInt(breakInput.value, 10) || 5))
    // 修正越界值
    focusInput.value = focusMin
    breakInput.value = breakMin
    state.settings.focusMin = focusMin
    state.settings.breakMin = breakMin
    window.electronAPI.pomodoro.updateSettings({ focusMin, breakMin })
    // 如果是 idle 状态，更新倒计时显示
    if (state.phase === 'idle') {
      state.remainingS = focusMin * 60
      updateRing(container)
    }
  })

  // ── 初始渲染按钮和统计 ──
  updateButtons(container)
  updateStats(container)
  updateSettingsInputs(container)

  // ── 返回清理函数 ──
  return () => {
    unsubTick()
    unsubPhase()
  }
}

// ── 设置页面 ──

function buildSettingsPage(container) {
  container.className = 'page page--settings'

  // 从 PetState 读取当前设置，首次访问时 fallback 到配置 default
  const resolve = (item) => {
    const s = PetState.get('settings') || {}
    if (s[item.id] != null) return s[item.id]
    return item.default
  }

  let activeTabId = SETTINGS_TABS[0].id

  // ── 副作用分发 ──
  function applySideEffect(item, value) {
    switch (item.id) {
      case 'alwaysOnTop':
        window.electronAPI.setAlwaysOnTop(value)
        break
      // showTooltip: 无副作用，下次 showTooltip() 调用时读值
    }
  }

  // ── 更新设置（统一入口）──
  function updateSetting(itemId, value) {
    const settings = PetState.get('settings') || {}
    const newSettings = { ...settings, [itemId]: value }
    PetState.set('settings', newSettings)
  }

  // ── 渲染当前 Tab 的设置项 ──
  function renderSettingsList(tabId) {
    const list = container.querySelector('.settings-list')
    if (!list) return

    const tab = SETTINGS_TABS.find(t => t.id === tabId)
    if (!tab) return

    list.innerHTML = tab.items.map(item => {
      const val = resolve(item)

      let controlHTML = ''
      switch (item.type) {
        case 'toggle':
          controlHTML = `
            <label class="settings-toggle">
              <input type="checkbox" data-setting-id="${item.id}" ${val ? 'checked' : ''}>
              <span class="settings-toggle-track"></span>
            </label>`
          break
        case 'slider':
          controlHTML = `
            <div class="settings-slider-row">
              <span class="settings-slider-value" data-slider-value="${item.id}">${val}</span>
              <input type="range" class="settings-slider"
                     data-setting-id="${item.id}"
                     min="${item.min}" max="${item.max}" step="${item.step}"
                     value="${val}">
            </div>`
          break
      }

      return `<div class="settings-row">
        <span class="settings-row-label">${item.label}</span>
        ${controlHTML}
      </div>`
    }).join('')
  }

  function setActiveTab(tabId) {
    container.querySelectorAll('.wh-tab').forEach(tab => {
      tab.classList.toggle('wh-tab--active', tab.dataset.catId === tabId)
    })
  }

  // ── 初始渲染 ──
  container.innerHTML = `
    <div class="wh-tabs">
      ${SETTINGS_TABS.map(tab => `
        <button class="wh-tab${tab.id === activeTabId ? ' wh-tab--active' : ''}"
                data-cat-id="${tab.id}">${tab.label}</button>
      `).join('')}
    </div>
    <div class="settings-list"></div>
    <div class="settings-footer">
      <button class="settings-reset-btn" disabled>重置所有设置</button>
    </div>
  `

  renderSettingsList(activeTabId)

  // ── Tab 切换 ──
  container.querySelector('.wh-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.wh-tab')
    if (!tab) return
    const tabId = tab.dataset.catId
    if (tabId === activeTabId) return

    activeTabId = tabId
    setActiveTab(tabId)

    const list = container.querySelector('.settings-list')
    list.style.opacity = '0'
    setTimeout(() => {
      renderSettingsList(tabId)
      requestAnimationFrame(() => { list.style.opacity = '1' })
    }, 150)
  })

  // ── 设置列表事件委托 ──
  container.querySelector('.settings-list').addEventListener('change', (e) => {
    // Toggle 切换
    const checkbox = e.target.closest('.settings-toggle input[type="checkbox"]')
    if (checkbox) {
      const itemId = checkbox.dataset.settingId
      const checked = checkbox.checked
      updateSetting(itemId, checked)
      const tab = SETTINGS_TABS.find(t => t.items.some(i => i.id === itemId))
      const item = tab ? tab.items.find(i => i.id === itemId) : null
      if (item) applySideEffect(item, checked)
      return
    }
  })

  container.querySelector('.settings-list').addEventListener('input', (e) => {
    // 滑块拖动
    const slider = e.target.closest('.settings-slider')
    if (!slider) return
    const itemId = slider.dataset.settingId
    const val = parseFloat(slider.value)
    // 更新数值显示
    const valEl = container.querySelector(`[data-slider-value="${itemId}"]`)
    if (valEl) valEl.textContent = val
    updateSetting(itemId, val)
    const tab = SETTINGS_TABS.find(t => t.items.some(i => i.id === itemId))
    const item = tab ? tab.items.find(i => i.id === itemId) : null
    if (item) applySideEffect(item, val)
  })

  // ── 首次进入设置页时恢复面板置顶 ──
  const alwaysOnTopItem = SETTINGS_TABS
    .flatMap(t => t.items)
    .find(i => i.id === 'alwaysOnTop')
  if (alwaysOnTopItem) {
    applySideEffect(alwaysOnTopItem, resolve(alwaysOnTopItem))
  }

  // 返回清理函数（首期无订阅，预留）
  return () => {}
}

// ── 2048 游戏页面 ──

function buildGame2048Page(container) {
  const cleanup = Game2048UI.mount(container)
  return () => { if (cleanup) cleanup() }
}

// ── 页面切换 ──
const pageNavigation = createPageNavigationCoordinator({
  initialPageId: currentPageId,
  resolvePage(pageId) {
    const item = NAV_ITEMS.find(entry => entry.id === pageId)
    if (!item?.enabled) return null
    const area = document.getElementById('content-area')
    return { render: () => item.render(area) }
  },
  async beforeNavigate() {
    const area = document.getElementById('content-area')
    area.style.opacity = '0'
    window.electronAPI.closeOverlay()
    hideTooltip()
    await new Promise(resolve => setTimeout(resolve, 150))
  },
  onDeactivate() {
    currentPageId = null
    updateNavActive()
  },
  onActivate(pageId) {
    currentPageId = pageId
    updateNavActive()
    const area = document.getElementById('content-area')
    requestAnimationFrame(() => {
      if (pageNavigation.currentPageId === pageId) area.style.opacity = '1'
    })
  },
  onError(pageId, error) {
    const area = document.getElementById('content-area')
    area.className = 'page page--placeholder'
    area.innerHTML = `
      <div class="placeholder-page" role="alert">
        <div class="placeholder-icon">⚠️</div>
        <div class="placeholder-label">页面加载失败</div>
        <div class="placeholder-hint">请稍后重试，其他功能不受影响</div>
      </div>`
    area.style.opacity = '1'
    console.error(`[Dashboard] 页面 ${pageId} 加载失败:`, error)
  },
})

async function switchPage(pageId) {
  return pageNavigation.navigate(pageId)
}

function disposeCurrentPage() {
  pageNavigation.dispose()
}

// ── 导航栏渲染 ──
function buildNavBar() {
  const nav = document.getElementById('nav-bar')
  if (!nav) return

  const topItems = NAV_ITEMS.filter(n => n.section === 'top')
  const bottomItems = NAV_ITEMS.filter(n => n.section === 'bottom')

  nav.innerHTML = `
    <div class="nav-section nav-section--top">
      ${topItems.map(item => `
        <button class="nav-item${!item.enabled ? ' nav-item--disabled' : ''}${item.id === currentPageId ? ' nav-item--active' : ''}"
                data-nav-id="${item.id}"
                ${!item.enabled ? 'disabled' : ''}>
          <span class="nav-item-icon">${item.icon}</span>
          <span class="nav-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
    <div class="nav-section nav-section--bottom">
      ${bottomItems.map(item => `
        <button class="nav-item${!item.enabled ? ' nav-item--disabled' : ''}${item.id === currentPageId ? ' nav-item--active' : ''}"
                data-nav-id="${item.id}"
                ${!item.enabled ? 'disabled' : ''}>
          <span class="nav-item-icon">${item.icon}</span>
          <span class="nav-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
  `

  // 事件委托：导航点击
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item')
    if (!btn) return
    const pageId = btn.dataset.navId
    if (!pageId) return
    switchPage(pageId)
  })
}

function updateNavActive() {
  const nav = document.getElementById('nav-bar')
  if (!nav) return
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('nav-item--active', btn.dataset.navId === currentPageId)
  })
}

// ── 主页事件绑定（库存点击/悬停，切回主页时需重新绑定） ──
function bindHomePageEvents() {
  // 库存点击：事件委托
  document.getElementById('card-inventory').addEventListener('click', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) return
    const foodId = item.dataset.foodId
    if (item.classList.contains('inventory-item--empty')) return
    handleFeed(foodId)
  })

  // 库存悬停：tooltip（捕获阶段，处理子元素事件）
  let _tooltipItem = null  // 当前悬停的 .inventory-item DOM 元素

  document.getElementById('card-inventory').addEventListener('mouseenter', (e) => {
    const item = e.target.closest('.inventory-item')
    if (item === _tooltipItem) return  // 同一物品内子元素间移动，跳过
    _tooltipItem = item
    // 进入 gap 区域时不隐藏，保持上一个物品的 tooltip 显示
    if (!item) return
    const food = FOODS[item.dataset.foodId]
    if (!food) return
    showTooltip(food, item.getBoundingClientRect())
  }, true)

  document.getElementById('card-inventory').addEventListener('mouseleave', (e) => {
    // 进入另一个物品 → 保留；进入 gap/padding/空白 → 隐藏
    if (e.relatedTarget && e.relatedTarget.closest('.inventory-item')) return
    _tooltipItem = null
    hideTooltip()
  }, true)
}

function renderLevel() {
  const card = document.getElementById('card-level')
  if (!card) return
  const level = PetState.get('level') || 1
  const exp = PetState.get('exp') || 0
  const required = calcRequiredExp(level)
  const pct = required === Infinity ? 100 : Math.min(100, Math.round((exp / required) * 100))
  const label = required === Infinity ? 'MAX' : `${exp} / ${required}`
  card.innerHTML = `
    <span class="level-value">Lv.${level}</span>
    <div class="progress-bar">
      <div class="progress-fill progress-fill--blue" style="width:${pct}%"></div>
    </div>
    <span class="exp-value">${label}</span>
  `
}

function renderMood() {
  const card = document.getElementById('card-mood')
  if (!card) return

  let mood = PetState.get('mood')

  // 迁移旧 string 存档 → number
  if (mood === undefined || mood === null || typeof mood === 'string') {
    mood = migrateMood(mood)
    PetState.set('mood', mood)
  }

  const tier = getMoodTier(mood)
  const pct = Math.min(100, Math.max(0, Math.round(mood)))

  // 进度条颜色（和饱腹条同款三色）
  let fillCls = 'progress-fill--high'
  if (mood <= 30) fillCls = 'progress-fill--low'
  else if (mood <= 60) fillCls = 'progress-fill--mid'

  card.innerHTML = `
    <div class="mood-header">
      <span class="mood-emoji">${tier.emoji}</span>
      <span class="mood-label">心情：${tier.label}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ${fillCls}" style="width:${pct}%"></div>
    </div>
    <span class="mood-value">${Math.round(mood)}/100</span>
    <span class="mood-tier-badge">${tier.label}</span>
  `
}

function renderSatiety() {
  const card = document.getElementById('card-satiety')
  if (!card) return
  const satiety = PetState.get('satiety')
  const val = (satiety != null) ? satiety : 100
  const level = PetState.get('level') || 1
  const maxSatiety = calcMaxSatiety(level)
  const pct = Math.min(100, Math.round((val / maxSatiety) * 100))
  let cls = 'progress-fill--high'
  if (val <= 30) cls = 'progress-fill--low'
  else if (val <= 60) cls = 'progress-fill--mid'
  card.innerHTML = `
    <span class="satiety-label">🍽 饱腹</span>
    <div class="progress-bar">
      <div class="progress-fill ${cls}" style="width:${pct}%"></div>
    </div>
    <span class="satiety-value">${Math.round(val)}</span>
  `
}

function renderIntimacy() {
  const card = document.getElementById('card-intimacy')
  if (!card) return
  const val = PetState.get('intimacy') || 0
  card.innerHTML = `
    <span class="stat-emoji">💕</span>
    <span class="stat-label">亲密度</span>
    <span class="stat-value">${val}</span>
  `
}

function renderCoins() {
  const card = document.getElementById('card-coins')
  if (!card) return
  const val = PetState.get('coins') || 0
  card.innerHTML = `
    <span class="stat-emoji">🪙</span>
    <span class="stat-label">金币</span>
    <span class="stat-value">${val}</span>
  `
}

function renderInventory() {
  const card = document.getElementById('card-inventory')
  if (!card) return
  const inventory = PetState.get('inventory') || {}

  const items = listFeedableItems()
  const cells = items.map(food => {
    const count = getItemCount(inventory, food.id)
    const emptyCls = count === 0 ? ' inventory-item--empty' : ''
    return `<div class="inventory-item${emptyCls}" data-food-id="${food.id}">
      <span>${food.emoji}</span>
      <span class="inventory-count">×${count}</span>
    </div>`
  }).join('')

  card.innerHTML = `
    <div class="inventory-title">🎒 食物库存</div>
    <div class="inventory-grid">${cells}</div>
  `
}

function renderAll() {
  renderLevel()
  renderMood()
  renderSatiety()
  renderIntimacy()
  renderCoins()
  renderInventory()
}

// ── 事件监听：按 key 增量刷新 ──
function onStateChanged({ key }) {
  switch (key) {
    case 'level':
    case 'exp':
      renderLevel()
      break
    case 'mood':
      renderMood()
      break
    case 'satiety':
      renderSatiety()
      break
    case 'intimacy':
      renderIntimacy()
      break
    case 'coins':
      renderCoins()
      break
    case 'inventory':
      renderInventory()
      break
  }
}

// ── 简易 toast ──
function showToast(msg) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 2000)
}

// ── 快速投喂 ──
function handleFeed(foodId) {
  const transaction = calculateFeedTransaction({
    inventory: PetState.get('inventory') || {},
    itemId: foodId,
    satiety: PetState.get('satiety') || 0,
    intimacy: PetState.get('intimacy') || 0,
    mood: PetState.get('mood') ?? MOOD_CONFIG.initialMood,
    exp: PetState.get('exp') || 0,
    level: PetState.get('level') || 1,
  })
  if (!transaction.ok) {
    if (transaction.error === 'SATIETY_FULL') {
      showToast('已经吃饱了 🍽')
    }
    return
  }

  PetState.setMany(transaction.updates)
  emitFed(foodId)
  if (transaction.leveledUp) {
    showToast(`🎉 升级了！Lv.${transaction.updates.level}！`)
  } else {
    showToast(`投喂了${transaction.item.name}！`)
  }
}

// ── tooltip ──

// tooltip behavior helpers:start
export function buildShopTooltipItem(item) {
  const fields = (item.tooltipFields || [])
    .filter(field => field !== 'sellPrice' && field !== 'buyPrice')
  if (Number.isFinite(item.buyPrice)) fields.push('buyPrice')
  return { ...item, tooltipFields: fields }
}

function getTooltipFields(food) {
  return (food.tooltipFields || []).filter(key =>
    TOOLTIP_FIELDS[key] && food[key] !== null && food[key] !== undefined
  )
}

function getTooltipIntimacy(food) {
  if (!Number.isFinite(food.satiety) || food.satiety <= 0) return null
  return food.intimacy ?? FEED_CONFIG.intimacyPerFeed
}

export function buildTooltipHTML(food) {
  let html = `<style>body{margin:0;padding:10px 14px;background:#2c2c2c;font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#ccc;border-radius:8px;}</style>`
  html += `<div style="font-size:14px;color:#fff;margin-bottom:6px">${food.name}</div>`

  for (const key of getTooltipFields(food)) {
    const cfg = TOOLTIP_FIELDS[key]
    const prefix = (key === 'sellPrice' || key === 'buyPrice') ? '' : '+'
    html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">${cfg.icon} ${cfg.label}</span><span style="color:#7eb">${prefix}${food[key]}</span></div>`
  }

  const intimacy = getTooltipIntimacy(food)
  if (intimacy !== null) {
    html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">💕 亲密度</span><span style="color:#7eb">+${intimacy}</span></div>`
  }
  return html
}

export function calculateTooltipHeight(food) {
  const fieldCount = getTooltipFields(food).length
  const intimacyCount = getTooltipIntimacy(food) === null ? 0 : 1
  return 26 + (fieldCount + intimacyCount) * 20 + 24
}
// tooltip behavior helpers:end

function showTooltip(food, rect) {
  const settings = PetState.get('settings')
  if (settings && settings.showTooltip === false) return
  window.electronAPI.showTooltip({
    html: buildTooltipHTML(food),
    x: Math.round(rect.right + 8),
    y: Math.round(rect.top),
    width: 175,
    height: Math.round(calculateTooltipHeight(food)),
  })
}

function hideTooltip() {
  window.electronAPI.hideTooltip()
}

// ── 初始化 ──
async function initStatus() {
  await PetState.init()

  // 注入页面渲染函数到 nav-config（配置驱动，render 在 init 时绑定）
  const homeItem = NAV_ITEMS.find(n => n.id === 'home')
  if (homeItem) homeItem.render = (container) => {
    buildHomePage()
    bindHomePageEvents()
    renderAll()
  }

  const whItem = NAV_ITEMS.find(n => n.id === 'warehouse')
  if (whItem) whItem.render = buildWarehousePage

  const shopItem = NAV_ITEMS.find(n => n.id === 'shop')
  if (shopItem) shopItem.render = buildShopPage

  const settingsItem = NAV_ITEMS.find(n => n.id === 'settings')
  if (settingsItem) settingsItem.render = buildSettingsPage

  const pomodoroItem = NAV_ITEMS.find(n => n.id === 'pomodoro')
  if (pomodoroItem) pomodoroItem.render = buildPomodoroPage

  const farmItem = NAV_ITEMS.find(n => n.id === 'farm')
  if (farmItem) farmItem.render = async container => {
    const farmModule = await loadRegisteredModule('farm')
    const staging = document.createElement('div')
    const cleanup = await farmModule.mount(staging, {
      onNavigateWarehouse: () => switchPage('warehouse'),
    })
    return {
      cleanup,
      activate() {
        container.replaceChildren(staging)
      },
    }
  }

  const g2048Item = NAV_ITEMS.find(n => n.id === 'game2048')
  if (g2048Item) g2048Item.render = buildGame2048Page

  // 番茄钟：主进程切番茄页（右键菜单"专注中"/"休息中"点击 → navigate IPC）
  window.electronAPI.pomodoro.onNavigate(() => switchPage('pomodoro'))

  // 渲染导航栏
  buildNavBar()

  // 加载默认页面（主页）
  buildHomePage()
  bindHomePageEvents()

  // 监听状态变化
  PetState.subscribe(EVENTS.PET_STATE_CHANGED, onStateChanged)

  renderAll()
}

initStatus().catch(err => console.error('[Dashboard] 状态初始化失败:', err))
