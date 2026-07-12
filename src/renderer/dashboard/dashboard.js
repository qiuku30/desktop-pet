// 主面板 — 关闭按钮 + 窗口缩放

const MIN_W = 600
const MIN_H = 400
const EDGE = 8
const CORNER = 16

// ── 返回宠物 ──
document.getElementById('btn-close').addEventListener('click', () => {
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

const FOOD_META = {
  apple:  { name: '苹果', emoji: '🍎', hunger: -20 },
  cake:   { name: '蛋糕', emoji: '🍰', hunger: -30 },
  fish:   { name: '小鱼干', emoji: '🐟', hunger: -25 },
  milk:   { name: '牛奶', emoji: '🥛', hunger: -15 },
  cookie: { name: '饼干', emoji: '🍪', hunger: -10 },
}

function buildStatusDOM() {
  const area = document.getElementById('content-area')
  area.innerHTML = `
    <section class="status-hero">
      <div class="card card--level" id="card-level"></div>
      <div class="card card--mood" id="card-mood"></div>
    </section>
    <section class="card card--hunger" id="card-hunger"></section>
    <section class="status-compact">
      <div class="card card--intimacy" id="card-intimacy"></div>
      <div class="card card--coins" id="card-coins"></div>
      <div class="card card--inventory" id="card-inventory"></div>
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
  card.innerHTML = `
    <span class="level-value">Lv.${level}</span>
    <div class="level-exp">
      <div class="progress-bar">
        <div class="progress-fill progress-fill--high" style="width:${exp}%"></div>
      </div>
      <span class="exp-label">经验 ${exp}</span>
    </div>
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

function renderHunger() {
  const card = document.getElementById('card-hunger')
  if (!card) return
  const hunger = PetState.get('hunger')
  const val = (hunger != null) ? hunger : 100
  const pct = Math.max(0, Math.min(100, val))
  let cls = 'progress-fill--high'
  if (val <= 30) cls = 'progress-fill--low'
  else if (val <= 60) cls = 'progress-fill--mid'
  card.innerHTML = `
    <span class="hunger-label">🍽 饥饿</span>
    <div class="progress-bar">
      <div class="progress-fill ${cls}" style="width:${pct}%"></div>
    </div>
    <span class="hunger-value">${val}</span>
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

  const items = Object.values(FOOD_META)
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
  renderHunger()
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
    case 'hunger':
      renderHunger()
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

// ── 快速投喂 ──
function handleFeed(foodId) {
  const food = FOOD_META[foodId]
  if (!food) return

  const foodInventory = PetState.get('foodInventory') || []
  const entry = foodInventory.find(item => item.id === foodId)
  if (!entry || entry.count <= 0) return

  // 消耗 1 个食物
  const newInventory = foodInventory
    .map(item => item.id === foodId ? { ...item, count: item.count - 1 } : item)
    .filter(item => item.count > 0)
  PetState.set('foodInventory', newInventory)

  // 更新饥饿值（饥饿值减小 = 吃饱，clamp 到 0）
  const hunger = PetState.get('hunger') || 0
  PetState.set('hunger', Math.max(0, hunger + food.hunger))

  // 亲密度 +5
  const intimacy = PetState.get('intimacy') || 0
  PetState.set('intimacy', intimacy + 5)
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

  // 监听状态变化
  PetState.subscribe('pet:state:changed', onStateChanged)

  renderAll()
}

initStatus().catch(err => console.error('[Dashboard] 状态初始化失败:', err))