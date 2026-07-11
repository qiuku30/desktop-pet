// 宠物渲染进程 —— 外观、闲置、拖拽、随机走动。
// 大脑在这里：维护窗口坐标 + 状态机（DRAGGING > WANDERING > IDLE）。
// 纯几何在 pet-motion.mjs；窗口移动/光标由主进程 IPC 提供。
// 躲避鼠标暂时禁用（FIXME），待 IPC 稳定性问题解决后再启。

import {
  distance, wanderTarget,
  centerToTopLeft, topLeftToCenter,
} from './pet-motion.mjs'

// ── 常量 ──
const WIN = { w: 200, h: 200 }      // 对齐主进程 PET_MODE
const WANDER_MIN_MS = 5000
const WANDER_MAX_MS = 12000
const WANDER_RADIUS = 200           // 随机目标偏移半径
const WANDER_MS = 1200              // 走动滑行时长
const DRAG_TAP_PX = 5               // 位移小于此值视为「点一下」

// ── 状态 ──
const body = document.getElementById('pet-body')
let winPos = { x: 0, y: 0 }         // 窗口左上角（屏幕坐标），渲染进程侧真值
let lastCursor = { x: 0, y: 0 }
let dragging = false
let dragOffset = { x: 0, y: 0 }
let dragStartCursor = { x: 0, y: 0 }
let glideToken = 0                  // 每次新滑行 +1，旧帧靠它自我作废
let wanderTimer = null

// ── 工具 ──
function rand(min, max) {
  return min + Math.random() * (max - min)
}

// 命令主进程移窗，用 clamp 后的真实落点回填 winPos，保持同步。
// coalesce：上一条 IPC 未返回时记住最新位置，回来后接着发，不丢帧。
let movePending = false
let pendingPos = null
async function commitMove(pos) {
  if (movePending) {
    pendingPos = pos
    return
  }
  movePending = true
  winPos = pos
  const actual = await window.electronAPI.moveWindow(pos.x, pos.y)
  winPos = actual
  movePending = false
  if (pendingPos) {
    const next = pendingPos
    pendingPos = null
    commitMove(next)
  }
}

// 缓动滑行到目标左上角。durationMs 内逐帧 moveWindow。
// 高优先级动作（拖拽）通过 ++glideToken 让当前滑行的后续帧作废。
function glideTo(target, durationMs, { onDone, moving } = {}) {
  const token = ++glideToken
  const start = { ...winPos }
  const t0 = performance.now()
  if (moving) body.classList.add('moving')
  else body.classList.remove('moving')

  function frame(now) {
    if (token !== glideToken) return            // 被更高优先级动作接管
    const t = Math.min(1, (now - t0) / durationMs)
    const e = 1 - Math.pow(1 - t, 3)            // easeOutCubic
    const next = {
      x: Math.round(start.x + (target.x - start.x) * e),
      y: Math.round(start.y + (target.y - start.y) * e),
    }
    commitMove(next)
    if (t < 1) {
      requestAnimationFrame(frame)
    } else {
      if (moving) body.classList.remove('moving')
      if (onDone) onDone()
    }
  }
  requestAnimationFrame(frame)
}

// 取消当前滑行（作废后续帧），并清 moving 视觉。
function cancelGlide() {
  glideToken++
  body.classList.remove('moving')
}

// 是否面板态（面板态暂停一切移动）。
async function isDashboard() {
  if (!window.electronAPI.getWindowMode) return false
  return (await window.electronAPI.getWindowMode()) === 'dashboard'
}

// ── 光标事件：拖拽跟随 ──
function onCursor(cursor) {
  lastCursor = cursor

  if (dragging) {
    commitMove({ x: cursor.x - dragOffset.x, y: cursor.y - dragOffset.y })
  }
}

// ── 拖拽 ──
function onMouseDown() {
  dragging = true
  cancelGlide()
  if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
  dragOffset = { x: lastCursor.x - winPos.x, y: lastCursor.y - winPos.y }
  dragStartCursor = { ...lastCursor }
  body.classList.add('grabbed')
}

function onMouseUp() {
  if (!dragging) return
  dragging = false
  body.classList.remove('grabbed')
  const moved = distance(lastCursor, dragStartCursor)
  if (moved < DRAG_TAP_PX) {
    // TODO(气泡子任务): 这里是「点一下」的钩子，后续弹对话气泡。本轮不做。
  }
  scheduleWander()
}

// ── 随机走动 ──
function scheduleWander() {
  if (wanderTimer) clearTimeout(wanderTimer)
  wanderTimer = setTimeout(doWander, rand(WANDER_MIN_MS, WANDER_MAX_MS))
}

async function doWander() {
  wanderTimer = null
  if (dragging) return
  if (await isDashboard()) { scheduleWander(); return }

  const center = topLeftToCenter(winPos, WIN)
  const target = wanderTarget(center, WANDER_RADIUS, Math.random)
  glideTo(centerToTopLeft(target, WIN), WANDER_MS, {
    moving: true,
    onDone: scheduleWander,
  })
}

// ── 启动 ──
async function init() {
  const pos = await window.electronAPI.getWindowPosition()
  winPos = { x: pos.x, y: pos.y }
  window.electronAPI.onCursorPos((_event, cursor) => onCursor(cursor))
  body.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  scheduleWander()
}

init()
