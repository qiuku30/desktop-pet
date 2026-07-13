// 主面板 — 关闭按钮 + 窗口缩放

const MIN_W = 600
const MIN_H = 400
const EDGE = 8
const CORNER = 16

// ── 返回宠物 ──
document.getElementById('btn-close').addEventListener('click', async () => {
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
import { calcRequiredExp } from '../shared/exp-service.js'
import { calcMaxSatiety } from '../shared/satiety-service.js'

// tooltip 字段 → 中文标签映射（字段驱动，加新字段只加一行）
const TOOLTIP_FIELDS = {
  satiety:  '饱腹',
  exp:      '经验',
}

function buildStatusDOM() {
  const area = document.getElementById('content-area')
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

const MOOD_MAP = {
  happy:   { emoji: '😊', label: '开心' },
  neutral: { emoji: '😐', label: '一般' },
  hungry:  { emoji: '😋', label: '饥饿' },
  sad:     { emoji: '😢', label: '难过' },
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
  const mood = PetState.get('mood') || 'neutral'
  const m = MOOD_MAP[mood] || MOOD_MAP.neutral
  card.innerHTML = `
    <span class="mood-emoji">${m.emoji}</span>
    <span class="mood-label">心情：${m.label}</span>
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

  // 发投喂事件
  emitFed(foodId)
}

// ── tooltip ──

function buildTooltipHTML(food) {
  let html = `<style>body{margin:0;padding:10px 14px;background:#2c2c2c;font-family:'Microsoft YaHei','PingFang SC',sans-serif;color:#ccc;border-radius:8px;}</style>`
  html += `<div style="font-size:14px;color:#fff;margin-bottom:6px">${food.name}</div>`
  for (const [key, label] of Object.entries(TOOLTIP_FIELDS)) {
    html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">${label}</span><span style="color:#7eb">+${food[key]}</span></div>`
  }
  html += `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:#999">亲密度</span><span style="color:#7eb">+${FEED_CONFIG.intimacyPerFeed}</span></div>`
  return html
}

function showTooltip(food, rect) {
  window.electronAPI.showTooltip({
    html: buildTooltipHTML(food),
    x: rect.right + 8,
    y: rect.top,
  })
}

function hideTooltip() {
  window.electronAPI.hideTooltip()
}

// ── 初始化 ──
async function initStatus() {
  await PetState.init()
  buildStatusDOM()

  // 库存点击：事件委托
  document.getElementById('card-inventory').addEventListener('click', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) return
    const foodId = item.dataset.foodId
    if (item.classList.contains('inventory-item--empty')) return
    handleFeed(foodId)
  })

  // 库存悬停：tooltip（捕获阶段，处理子元素事件）
  document.getElementById('card-inventory').addEventListener('mouseenter', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) { hideTooltip(); return }
    const food = FOODS[item.dataset.foodId]
    if (!food) { hideTooltip(); return }
    showTooltip(food, item.getBoundingClientRect())
  }, true)

  document.getElementById('card-inventory').addEventListener('mouseleave', () => {
    hideTooltip()
  }, true)

  // 监听状态变化
  PetState.subscribe('pet:state:changed', onStateChanged)

  renderAll()
}

initStatus().catch(err => console.error('[Dashboard] 状态初始化失败:', err))