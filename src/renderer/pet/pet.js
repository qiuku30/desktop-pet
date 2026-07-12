// 宠物渲染进程：原生拖拽 + 随机走动
// 拖拽：-webkit-app-region: drag（OS 原生，零偏移）
// 走动：moveWindow IPC（isAutoMoving，不触发 user:drag）

import {
  centerToTopLeft,
  topLeftToCenter,
  wanderTarget,
} from './pet-motion.mjs'
import { PetState } from '../shared/pet-state.js'

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
  if (autoPaused) { scheduleWander(); return }

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

function showBubble() {
  const mood = PetState.get('mood')
  const level = PetState.get('level')
  const text = pickDialog(mood, level)
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

body.addEventListener('click', (e) => {
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

  scheduleWander()
}

init()
