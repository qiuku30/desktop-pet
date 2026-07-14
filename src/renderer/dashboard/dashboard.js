// 主面板 — 关闭按钮 + 窗口缩放

const MIN_W = 600
const MIN_H = 400
const EDGE = 8
const CORNER = 16

// ── 返回宠物 ──
document.getElementById('btn-close').addEventListener('click', async () => {
  window.electronAPI.closeOverlay()      // 关闭可能残留的右键菜单
  hideTooltip()
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
import { FOODS, FEED_CONFIG, consumeFood, applyFeed, emitFed } from '../shared/feed-service.js'
import { calcRequiredExp, addExp, getFoodExp } from '../shared/exp-service.js'
import { calcMaxSatiety } from '../shared/satiety-service.js'
import { getMoodTier, migrateMood, boostMood, getExpMultiplier, MOOD_CONFIG } from '../shared/mood-service.js'
import { EVENTS } from '../shared/events.js'
import { NAV_ITEMS, WAREHOUSE_CATEGORIES } from './nav-config.js'

// tooltip 字段 → 中文标签映射（字段驱动，加新字段只加一行）
const TOOLTIP_FIELDS = {
  satiety:   { label: '饱腹',   icon: '🍽' },
  exp:       { label: '经验',   icon: '⭐' },
  sellPrice: { label: '售价',   icon: '🪙' },
  effect:    { label: '效果',   icon: '✨' },  // 道具预留
}

// ── 导航状态 ──
let currentPageId = 'home'
let _pageCleanup = null   // 当前页面的清理函数（切页时调用，防订阅泄漏）

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
      <div class="portrait-area" id="portrait-area">🐱</div>
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

function buildWarehousePage(container) {
  container.className = 'page page--warehouse'

  // 数据源：FOODS 配置 + foodInventory 库存
  const foodInventory = PetState.get('foodInventory') || []
  const invMap = {}
  foodInventory.forEach(item => { invMap[item.id] = item.count })

  const allItems = Object.values(FOODS).map(food => ({
    ...food,
    count: invMap[food.id] || 0,
  }))

  let activeCatId = 'all'

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
    setTimeout(() => {
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
    const food = FOODS[itemId]
    if (!food) return
    showTooltip(food, itemEl.getBoundingClientRect())
  }, true)

  container.querySelector('.wh-grid').addEventListener('mouseleave', (e) => {
    // 进入另一个物品 → 保留；进入 gap/padding/空白 → 隐藏
    if (e.relatedTarget && e.relatedTarget.closest('.wh-item')) return
    _whTooltipItem = null
    hideTooltip()
  }, true)

  // ── 仓库物品右键操作菜单 ──

  const WH_MENU_ACTIONS = [
    { id: 'use',     label: '使用',  icon: '🍽', show: (item, count) => item.category === 'food' && count > 0 },
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
    const food = FOODS[itemId]
    if (!food) { _whContextMenuOpen = false; return }

    // 用实时库存（渲染时的 allItems 可能因订阅更新而滞后，从 PetState 直接读）
    const currentInv = PetState.get('foodInventory') || []
    const entry = currentInv.find(item => item.id === itemId)
    const count = entry ? entry.count : 0

    // 构建菜单项；全禁用则不弹窗（否则无法关闭 overlay）
    const menuItems = WH_MENU_ACTIONS.map(action => {
      const enabled = action.show(food, count)
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

    if (!result) return

    // 处理菜单操作
    switch (result) {
      case 'use':
        handleFeed(itemId)
        break

      case 'sell': {
        const inv = PetState.get('foodInventory') || []
        const { newInventory, consumed } = consumeFood(itemId, inv)
        if (!consumed) break
        PetState.set('foodInventory', newInventory)
        const coins = PetState.get('coins') || 0
        PetState.set('coins', coins + food.sellPrice)
        showToast(`出售了${food.name}，获得 ${food.sellPrice} 🪙`)
        break
      }

      case 'destroy': {
        const inv = PetState.get('foodInventory') || []
        const { newInventory, consumed } = consumeFood(itemId, inv)
        if (!consumed) break
        PetState.set('foodInventory', newInventory)
        showToast(`销毁了${food.name}`)
        break
      }
    }
  })

  // 订阅库存变更，自动刷新网格
  const unsub = PetState.subscribe(EVENTS.PET_STATE_CHANGED, ({ key }) => {
    if (key !== 'foodInventory') return
    const inv = PetState.get('foodInventory') || []
    const map = {}
    inv.forEach(item => { map[item.id] = item.count })
    allItems.forEach(item => { item.count = map[item.id] || 0 })
    renderGrid(activeCatId)
  })

  // 返回清理函数：切换离开仓库页时取消订阅
  return () => { unsub() }
}

// ── 页面切换 ──
function switchPage(pageId) {
  if (currentPageId === pageId) return

  const item = NAV_ITEMS.find(n => n.id === pageId)
  if (!item || !item.enabled) return

  const area = document.getElementById('content-area')

  // fade out
  area.style.opacity = '0'

  // 关闭可能残留的右键菜单 overlay（切页时清理）
  window.electronAPI.closeOverlay()
  hideTooltip()

  setTimeout(() => {
    // 清理旧页面（取消订阅等，防泄漏 — ADR-006 精神）
    if (_pageCleanup) {
      _pageCleanup()
      _pageCleanup = null
    }

    // 渲染目标页面（配置驱动：所有页面统一走 item.render）
    // render 可返回清理函数（仓库等有内部订阅的页面）
    const cleanup = item.render(area)
    if (typeof cleanup === 'function') _pageCleanup = cleanup

    currentPageId = pageId

    // fade in
    requestAnimationFrame(() => {
      area.style.opacity = '1'
    })

    // 更新导航高亮
    updateNavActive()
  }, 150)
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
  const foodInventory = PetState.get('foodInventory') || []
  const invMap = {}
  foodInventory.forEach(item => { invMap[item.id] = item.count })

  const items = Object.values(FOODS)
  const cells = items.map(food => {
    const count = invMap[food.id] || 0
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
    case 'foodInventory':
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
  const food = FOODS[foodId]
  if (!food) return

  // 饱腹值上限检查（先检查，避免浪费食物）
  const satiety = PetState.get('satiety') || 0
  const level = PetState.get('level') || 1
  if (satiety >= calcMaxSatiety(level)) {
    showToast('已经吃饱了 🍽')
    return
  }

  const foodInventory = PetState.get('foodInventory') || []
  const { newInventory, consumed } = consumeFood(foodId, foodInventory)
  if (!consumed) return

  PetState.set('foodInventory', newInventory)

  // 更新饱腹 + 亲密度
  const intimacy = PetState.get('intimacy') || 0
  const { newSatiety, newIntimacy } = applyFeed(satiety, intimacy, food, level)
  PetState.set('satiety', newSatiety)
  PetState.set('intimacy', newIntimacy)

  // 喂食加心情
  const currentMood = PetState.get('mood') ?? MOOD_CONFIG.initialMood
  const newMoodVal = boostMood(currentMood, MOOD_CONFIG.feedBoost)
  if (newMoodVal !== currentMood) {
    PetState.set('mood', newMoodVal)
  }

  // 喂食经验结算（带心情倍率）
  const foodExp = getFoodExp(food)
  if (foodExp > 0) {
    const exp = PetState.get('exp') || 0
    const adjustedExp = Math.round(foodExp * getExpMultiplier(newMoodVal))
    const addResult = addExp(exp, level, adjustedExp)
    PetState.set('exp', addResult.newExp)
    if (addResult.leveledUp) {
      PetState.set('level', addResult.newLevel)
      showToast(`🎉 升级了！Lv.${addResult.newLevel}！`)
    }
  }

  // 发投喂事件
  emitFed(foodId)
  showToast(`投喂了${food.name}！`)
}

// ── tooltip ──

function buildTooltipHTML(food) {
  let html = `<style>body{margin:0;padding:10px 14px;background:#2c2c2c;font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#ccc;border-radius:8px;}</style>`
  html += `<div style="font-size:14px;color:#fff;margin-bottom:6px">${food.name}</div>`

  // 字段驱动：物品声明 tooltipFields → 按声明顺序渲染；否则兜底展示售价
  const fields = food.tooltipFields
  if (fields && fields.length > 0) {
    for (const key of fields) {
      const cfg = TOOLTIP_FIELDS[key]
      if (!cfg) continue
      const prefix = key === 'sellPrice' ? '' : '+'
      html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">${cfg.icon} ${cfg.label}</span><span style="color:#7eb">${prefix}${food[key]}</span></div>`
    }
  } else if (food.sellPrice) {
    // 兜底：未声明 tooltipFields 但有售价
    html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">🪙 售价</span><span style="color:#7eb">${food.sellPrice}</span></div>`
  }

  html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">💕 亲密度</span><span style="color:#7eb">+${FEED_CONFIG.intimacyPerFeed}</span></div>`
  return html
}

function showTooltip(food, rect) {
  // 根据内容行数动态计算高度，避免溢出滚动条
  const fields = food.tooltipFields
  const fieldCount = (fields && fields.length > 0) ? fields.length : (food.sellPrice ? 1 : 0)
  // 名称行(~26px) + N 个字段行(~20px each) + 亲密度行(~20px) + padding(~24px)
  const h = 26 + fieldCount * 20 + 20 + 24
  window.electronAPI.showTooltip({
    html: buildTooltipHTML(food),
    x: Math.round(rect.right + 8),
    y: Math.round(rect.top),
    width: 175,
    height: Math.round(h),
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