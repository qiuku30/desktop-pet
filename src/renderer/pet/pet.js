// 宠物渲染进程：原生拖拽 + 随机走动
// 拖拽：-webkit-app-region: drag（OS 原生，零偏移）
// 走动：moveWindow IPC（isAutoMoving，不触发 user:drag）

import {
  centerToTopLeft,
  topLeftToCenter,
  wanderTarget,
} from './pet-motion.mjs'
import { PetState } from '../shared/pet-state.js'

// ── 食物配置表（原则5：配置驱动，静态数据与业务逻辑分离）──
const FOODS = {
  apple:  { id: 'apple',  name: '苹果', emoji: '🍎', satiety: 20 },
  cake:   { id: 'cake',   name: '蛋糕', emoji: '🍰', satiety: 30 },
  fish:   { id: 'fish',   name: '小鱼干', emoji: '🐟', satiety: 25 },
  milk:   { id: 'milk',   name: '牛奶', emoji: '🥛', satiety: 15 },
  cookie: { id: 'cookie', name: '饼干', emoji: '🍪', satiety: 10 },
}

// 动态窗口尺寸（配合 scaleFactor 自适应 + 用户缩放）
function getWinSize() {
  return { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight }
}
const WANDER_MIN_MS = 5000
const WANDER_MAX_MS = 12000
const WANDER_RADIUS = 200
const WANDER_MS = 1200

const body = document.getElementById('pet-body')
let winPos = { x: 0, y: 0 }
let autoPaused = false
let resumeTimer = null
let glideToken = 0
let wanderTimer = null
let wanderEnabled = true

// ── overlay 状态 ──
let overlayActive = false

// ── 工具 ──
function rand(min, max) { return min + Math.random() * (max - min) }

// ── 自动移窗（fire-and-forget）──
function commitMove(pos) {
  winPos = pos
  window.electronAPI.moveWindow(pos.x, pos.y)
}

// ── 缓动滑行 ──
function glideTo(target, durationMs, { moving, onDone } = {}) {
  const token = ++glideToken
  const start = { ...winPos }
  const t0 = performance.now()
  if (moving) body.classList.add('moving')

  function frame(now) {
    if (token !== glideToken) return
    const t = Math.min(1, (now - t0) / durationMs)
    const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
    commitMove({
      x: Math.round(start.x + (target.x - start.x) * e),
      y: Math.round(start.y + (target.y - start.y) * e),
    })
    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      if (moving) body.classList.remove('moving')
      if (onDone) onDone()
    }
  }
  requestAnimationFrame(frame)
}

// ── 随机走动 ──
function scheduleWander() {
  if (wanderTimer) clearTimeout(wanderTimer)
  wanderTimer = setTimeout(doWander, rand(WANDER_MIN_MS, WANDER_MAX_MS))
}

async function doWander() {
  wanderTimer = null
  if (!wanderEnabled) return
  if (autoPaused) { scheduleWander(); return }
  if (overlayActive) { scheduleWander(); return }

  try {
    const mode = await window.electronAPI.getWindowMode()
    if (mode === 'dashboard') { scheduleWander(); return }
  } catch (_) {}

  const sz = getWinSize()
  const center = topLeftToCenter(winPos, sz)
  const target = wanderTarget(center, WANDER_RADIUS, Math.random)

  glideTo(centerToTopLeft(target, sz), WANDER_MS, {
    moving: true,
    onDone: scheduleWander,
  })
}

// ── 走动开关 ──
function onWanderToggle(enabled) {
  wanderEnabled = enabled
  if (!enabled) {
    // 关闭：取消当前走动
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
    glideToken++
    body.classList.remove('moving')
  } else {
    // 开启：恢复走动
    scheduleWander()
  }
}

// ── 用户拖拽：暂停走动，松手 300ms 后恢复 ──
function onUserDrag() {
  if (!autoPaused) {
    autoPaused = true
    glideToken++ // 取消当前滑行
    body.classList.remove('moving')
  }
  if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
  if (resumeTimer) clearTimeout(resumeTimer)
  resumeTimer = setTimeout(async () => {
    autoPaused = false
    resumeTimer = null
    try {
      const pos = await window.electronAPI.getWindowPosition()
      winPos = pos
    } catch (_) {}
    scheduleWander()
  }, 300)
}

// ── 对话气泡 ──

const DIALOGS = {
  happy: {
    low:  ['今天心情真好~', '嘿嘿，开心！', '主人真好！', '阳光真好呀 ☀️'],
    mid:  ['快乐摸鱼中...', '今天效率为零！', '上班好开心（假的）', '嘿嘿，今天运气不错！'],
    high: ['带薪聊天真爽', '已经摸到出神入化了', '跟着主人有肉吃！', '我是摸鱼达人 🏆'],
  },
  neutral: {
    low:  ['嗯？有什么事吗？', '好无聊啊...', '主人在干嘛呢？', '有点想睡觉...'],
    mid:  ['发呆中...', '今天会议真多 😵', '等待投喂', '思考猫生中...'],
  },
  hungry: {
    low:  ['好饿啊...有没有吃的？', '肚子在叫了 🥺', '主人，该喂食了吧？', '零食时间到了吗？'],
  },
  sad: {
    low:  ['今天不太开心...', '陪陪我好不好？😢', '好想出去玩...', '有点孤单...'],
  },
}

function pickDialog(mood, level) {
  const m = mood && DIALOGS[mood] ? mood : 'neutral'
  const tier = level >= 7 ? 'high' : level >= 4 ? 'mid' : 'low'

  // 从对应层级取，没有则向上 fallback，再没有则向下
  let pool = DIALOGS[m][tier]
  if (!pool) pool = DIALOGS[m]['mid'] || DIALOGS[m]['low']
  if (!pool) pool = DIALOGS.neutral.low

  return pool[Math.floor(Math.random() * pool.length)]
}

function showBubble(customText) {
  const mood = PetState.get('mood')
  const level = PetState.get('level')
  const text = customText || pickDialog(mood, level)
  const bubble = document.createElement('div')
  bubble.className = 'speech-bubble'
  bubble.textContent = text
  document.getElementById('speech-bubbles').appendChild(bubble)

  let removed = false
  const remove = () => { if (!removed) { removed = true; bubble.remove() } }
  bubble.addEventListener('animationend', remove)
  setTimeout(remove, 2500) // 兜底：防止 animationend 不触发导致气泡残留
}

// 点击 / 拖拽 区分
let clickTimer = null
let clickDownPos = null

body.addEventListener('pointerdown', (e) => {
  clickDownPos = { x: e.clientX, y: e.clientY }
})

body.addEventListener('click', async (e) => {
  // 拖拽检测：移动超过 3px 视为拖拽，不出气泡
  if (clickDownPos) {
    const dx = e.clientX - clickDownPos.x
    const dy = e.clientY - clickDownPos.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return
  }

  // 300ms 延迟：为未来双击预留，期间第二次点击取消气泡
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
    await PetState.flush()
    window.electronAPI.toggleWindow()  // 双击 → 切换面板
    return
  }
  clickTimer = setTimeout(() => {
    clickTimer = null
    showBubble()
  }, 300)
})

// ── 初始化 ──
async function init() {
  await PetState.init()

  const pos = await window.electronAPI.getWindowPosition()
  winPos = pos

  window.electronAPI.onUserDrag(onUserDrag)
  window.electronAPI.onWanderToggle(onWanderToggle)

  // 右键菜单 — 喂食
  window.electronAPI.onMenuFeed(async () => {
    const foodInventory = PetState.get('foodInventory') || []
    const invMap = {}
    foodInventory.forEach(item => { invMap[item.id] = item.count })

    const items = Object.values(FOODS)
      .map(food => ({ ...food, count: invMap[food.id] || 0 }))
      .sort((a, b) => b.count - a.count)

    const hasFood = items.some(item => item.count > 0)
    if (!hasFood) {
      showBubble('没有食物了... 🥺')
      // 仍然弹 overlay，食物全灰色 ×0，用户可进仓库
    }

    // 防止 overlay 重复打开（showOverlay 单实例，二次调用返回 null）
    if (overlayActive) return

    // 构建 overlay HTML（暗色主题，对齐 infra-03 overlay 风格）
    let html = `<style>
.food-row { display:flex; align-items:center; padding:8px 12px; cursor:pointer; border-radius:6px; margin:2px 0; transition:background 0.15s; }
.food-row:hover { background:rgba(255,255,255,0.08); }
.food-row--empty { opacity:0.30; }
.food-emoji { font-size:18px; margin-right:10px; }
.food-name { flex:1; font-size:14px; }
.food-count { font-size:13px; color:#aaa; }
.food-satiety { font-size:12px; color:#7eb; margin-left:4px; }
.food-divider { margin:8px 0; border-top:1px solid rgba(255,255,255,0.12); }
.food-bottom { display:flex; align-items:center; justify-content:space-between; padding:4px 0; }
.food-warehouse { color:#aaa; font-size:13px; cursor:pointer; padding:6px 4px; }
.food-warehouse:hover { color:#ddd; }
</style>`

    items.forEach(item => {
      const satietyLabel = `+${item.satiety}`
      if (item.count > 0) {
        html += `<div class="food-row" data-overlay-result="${item.id}">
          <span class="food-emoji">${item.emoji}</span>
          <span class="food-name">${item.name}</span>
          <span class="food-count">×${item.count}</span>
          <span class="food-satiety">${satietyLabel}</span>
        </div>`
      } else {
        html += `<div class="food-row food-row--empty">
          <span class="food-emoji">${item.emoji}</span>
          <span class="food-name">${item.name}</span>
          <span class="food-count">×0</span>
          <span class="food-satiety">${satietyLabel}</span>
        </div>`
      }
    })

    html += `<div class="food-divider"></div>
<div class="food-bottom">
  <button data-overlay-result="null">取消</button>
  <span class="food-warehouse" data-overlay-result="__warehouse__">📦 打开仓库 →</span>
</div>`

    // 暂停走动
    overlayActive = true
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
    glideToken++
    body.classList.remove('moving')

    const result = await window.electronAPI.showOverlay({
      html,
      width: 180,
      height: 200,
      x: 160,
      y: 0,
    })

    // 恢复走动
    overlayActive = false
    scheduleWander()

    if (result === null || result === undefined) return

    if (result === '__warehouse__') {
      await PetState.flush()
      window.electronAPI.toggleWindow()
      return
    }

    const food = FOODS[result]
    if (!food) return

    const satiety = PetState.get('satiety') || 0
    if (satiety >= 100) {
      showBubble('已经吃饱了 🍽')
      return
    }

    // 消耗 1 个
    const newInventory = foodInventory
      .map(inv => inv.id === result ? { ...inv, count: inv.count - 1 } : inv)
      .filter(inv => inv.count > 0)
    PetState.set('foodInventory', newInventory)

    PetState.set('satiety', Math.min(100, satiety + food.satiety))

    const intimacy = PetState.get('intimacy') || 0
    PetState.set('intimacy', intimacy + 5)

    showBubble(`投喂了${food.name}！`)
  })

  // 右键菜单 — 状态
  window.electronAPI.onMenuStatus(async () => {
    await PetState.flush()
    window.electronAPI.toggleWindow()
  })

  scheduleWander()
}

init()
