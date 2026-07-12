// 宠物渲染进程：原生拖拽 + 随机走动
// 拖拽：-webkit-app-region: drag（OS 原生，零偏移）
// 走动：moveWindow IPC（isAutoMoving，不触发 user:drag）

import {
  centerToTopLeft,
  topLeftToCenter,
  wanderTarget,
} from './pet-motion.mjs'

const WIN = { w: 200, h: 200 }
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

  const center = topLeftToCenter(winPos, WIN)
  const target = wanderTarget(center, WANDER_RADIUS, Math.random)

  glideTo(centerToTopLeft(target, WIN), WANDER_MS, {
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

// ── 初始化 ──
async function init() {
  const pos = await window.electronAPI.getWindowPosition()
  winPos = pos

  window.electronAPI.onUserDrag(onUserDrag)

  scheduleWander()
}

init()
