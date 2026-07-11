# 宠物移动系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让桌宠在桌面上有生命感——emoji 外观 + 呼吸/轻晃闲置动画 + 拖拽移动 + 随机走动 + 靠近才躲鼠标，全部为桌面级窗口移动。

**Architecture:** 渲染进程 `pet.js` 是唯一大脑：维护窗口坐标、跑状态机（`DRAGGING > FLEEING > WANDERING > IDLE`）、算移动目标。纯几何计算抽到 `pet-motion.mjs`（无 DOM/IPC，可单测）。主进程只当手脚：加「移窗 + 取窗坐标 + 全局光标推送」三个最小 IPC，move 时 clamp 到工作区。

**Tech Stack:** Electron 43，渲染进程 ES Module，主进程 CommonJS，`node --test`（Node v24 内置）跑纯函数单测，无新依赖。

## Global Constraints

- 只改这些文件：`src/renderer/pet/*`、`src/main/index.js`、`src/main/preload.js`、`docs/progress.md`、`src/renderer/pet/DESIGN.md`。（main/preload 已获用户明确授权，仅加移窗 IPC + 光标位置，不碰其他逻辑。）
- 模块间禁止直接 import 业务模块；移动逻辑不依赖其他渲染模块。
- 坐标契约：屏幕绝对像素，锚点为窗口左上角。clamp 到显示器 workArea 的逻辑归主进程 move handler。
- 窗口尺寸固定 `200×200`（对齐 `src/main/index.js` 的 `PET_MODE`）。宠物中心 = 窗口中心。
- 本轮不实现：气泡、右键菜单对接、双击切面板、赶跑、成长系统。仅在拖拽逻辑留一个 tap 空钩子。
- Commit 英文，格式 `<type>: <description>`。分支 `feature/pet-movement`。

---

### Task 1: 纯几何模块 `pet-motion.mjs`（TDD）

**Files:**
- Create: `src/renderer/pet/pet-motion.mjs`
- Test: `src/renderer/pet/pet-motion.test.mjs`

**Interfaces:**
- Consumes: 无。
- Produces（`pet.js` 依赖这些签名）：
  - `distance(a, b) -> number` — a/b 为 `{x,y}`。
  - `isCursorNear(petCenter, cursor, threshold) -> boolean`。
  - `fleeCenter(petCenter, cursor, push) -> {x,y}` — 返回沿光标反方向弹开 `push` 后的新中心；光标恰在中心时朝正上方弹。
  - `wanderTarget(center, radius, rand) -> {x,y}` — `rand: () => number` 注入以便确定性测试。
  - `centerToTopLeft(center, winSize) -> {x,y}` — `winSize` 为 `{w,h}`，返回四舍五入的左上角。
  - `topLeftToCenter(pos, winSize) -> {x,y}`。

- [ ] **Step 1: 写失败测试**

创建 `src/renderer/pet/pet-motion.test.mjs`：

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  distance, isCursorNear, fleeCenter, wanderTarget,
  centerToTopLeft, topLeftToCenter,
} from './pet-motion.mjs'

test('distance: 3-4-5 直角三角形', () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
})

test('isCursorNear: 阈值内为 true, 阈值外为 false', () => {
  const center = { x: 100, y: 100 }
  assert.equal(isCursorNear(center, { x: 150, y: 100 }, 120), true)
  assert.equal(isCursorNear(center, { x: 300, y: 100 }, 120), false)
})

test('fleeCenter: 沿光标反方向弹开 push 距离', () => {
  // 光标在左, 宠物应向右弹开正好 push
  const out = fleeCenter({ x: 100, y: 100 }, { x: 50, y: 100 }, 150)
  assert.equal(out.x, 250)
  assert.equal(out.y, 100)
})

test('fleeCenter: 光标与中心重合时朝正上方弹', () => {
  const out = fleeCenter({ x: 100, y: 100 }, { x: 100, y: 100 }, 150)
  assert.equal(out.x, 100)
  assert.equal(out.y, -50)
})

test('wanderTarget: rand 注入下确定性输出, 落在 radius 内', () => {
  // rand 依次返回 0 (角度 0) 和 1 (半径=radius) —— 用队列模拟
  const seq = [0, 1]
  let i = 0
  const rand = () => seq[i++]
  const out = wanderTarget({ x: 100, y: 100 }, 200, rand)
  assert.equal(out.x, 300) // cos(0)*200 = 200
  assert.equal(Math.round(out.y), 100) // sin(0)*200 = 0
})

test('centerToTopLeft / topLeftToCenter 互逆', () => {
  const win = { w: 200, h: 200 }
  const tl = centerToTopLeft({ x: 500, y: 400 }, win)
  assert.deepEqual(tl, { x: 400, y: 300 })
  assert.deepEqual(topLeftToCenter(tl, win), { x: 500, y: 400 })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test src/renderer/pet/pet-motion.test.mjs`
Expected: FAIL — `Cannot find module './pet-motion.mjs'`（文件还没建）。

- [ ] **Step 3: 写最小实现**

创建 `src/renderer/pet/pet-motion.mjs`：

```js
// 宠物移动的纯几何计算。无 DOM、无 IPC —— 可用 node --test 直接单测。
// 坐标皆为 {x,y}（屏幕绝对像素）；winSize 为 {w,h}。

// 两点欧氏距离。
export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// 光标是否落在宠物中心 threshold 像素内。
export function isCursorNear(petCenter, cursor, threshold) {
  return distance(petCenter, cursor) < threshold
}

// 沿「光标 → 宠物中心」反方向弹开 push 像素后的新中心。
// 光标与中心重合（方向未定义）时，默认朝正上方弹。
export function fleeCenter(petCenter, cursor, push) {
  let dx = petCenter.x - cursor.x
  let dy = petCenter.y - cursor.y
  const len = Math.hypot(dx, dy)
  if (len === 0) {
    dx = 0
    dy = -1
  } else {
    dx /= len
    dy /= len
  }
  return { x: petCenter.x + dx * push, y: petCenter.y + dy * push }
}

// 在当前中心 radius 内随机挑一个目标中心。
// rand: () => [0,1)，注入以便测试确定性。
export function wanderTarget(center, radius, rand) {
  const angle = rand() * Math.PI * 2
  const r = rand() * radius
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  }
}

// 中心 → 窗口左上角（四舍五入到整数像素）。
export function centerToTopLeft(center, winSize) {
  return {
    x: Math.round(center.x - winSize.w / 2),
    y: Math.round(center.y - winSize.h / 2),
  }
}

// 窗口左上角 → 中心。
export function topLeftToCenter(pos, winSize) {
  return { x: pos.x + winSize.w / 2, y: pos.y + winSize.h / 2 }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test src/renderer/pet/pet-motion.test.mjs`
Expected: PASS — 6 个测试全绿（`# pass 6`）。

- [ ] **Step 5: 提交**

```bash
git add src/renderer/pet/pet-motion.mjs src/renderer/pet/pet-motion.test.mjs
git commit -m "feat: add pure geometry module for pet motion"
```

---

### Task 2: 主进程移窗 IPC + 全局光标推送

**Files:**
- Modify: `src/main/index.js`
- Modify: `src/main/preload.js`

**Interfaces:**
- Consumes: 现有 `mainWindow`、`currentMode`、`switchToDashboard`/`switchToPet`。
- Produces（`pet.js` 依赖）：
  - `window.electronAPI.getWindowPosition() -> Promise<{x,y}>`
  - `window.electronAPI.moveWindow(x, y) -> Promise<{x,y}>` — 返回 clamp 后的真实位置。
  - `window.electronAPI.onCursorPos(cb)` — `cb(event, {x,y})`，主进程每 ~16ms 推一次全局光标。仅宠物态推送。

- [ ] **Step 1: index.js —— 引入 screen，加光标轮询与移窗 handler**

在 `src/main/index.js` 顶部 require 增加 `screen`：

```js
const { app, BrowserWindow, ipcMain, Menu, dialog, screen } = require('electron');
```

在 `let currentMode = 'pet';` 下面加光标轮询状态与开关函数：

```js
let cursorTimer = null; // 全局光标轮询句柄

// 每 ~16ms 把全局光标坐标推给渲染进程。仅宠物态运行。
function startCursorPolling() {
  if (cursorTimer) return;
  cursorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const { x, y } = screen.getCursorScreenPoint();
    mainWindow.webContents.send('cursor:pos', { x, y });
  }, 16);
}

function stopCursorPolling() {
  if (cursorTimer) {
    clearInterval(cursorTimer);
    cursorTimer = null;
  }
}
```

- [ ] **Step 2: index.js —— 把轮询挂到窗口生命周期与模式切换**

在 `createWindow()` 里 `mainWindow.loadFile(...)` 之后，加载完成再开轮询，并在窗口关闭时停：

```js
  mainWindow.webContents.on('did-finish-load', () => {
    startCursorPolling();
  });

  mainWindow.on('closed', () => {
    stopCursorPolling();
    mainWindow = null;
  });
```

在 `switchToDashboard()` 函数体开头加 `stopCursorPolling();`，在 `switchToPet()` 函数体末尾加 `startCursorPolling();`（面板态不追光标，回宠物态恢复）。

- [ ] **Step 3: index.js —— 在 setupIPC() 内加两个 handler**

在 `setupIPC()` 里追加：

```js
  // 取窗口左上角坐标
  ipcMain.handle('window:position:get', () => {
    const [x, y] = mainWindow.getPosition();
    return { x, y };
  });

  // 移窗到屏幕绝对坐标，clamp 到当前显示器工作区，返回真实落点
  ipcMain.handle('window:move', (_, { x, y }) => {
    const [w, h] = mainWindow.getSize();
    const { workArea } = screen.getDisplayNearestPoint({ x, y });
    const clampedX = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - w));
    const clampedY = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - h));
    mainWindow.setPosition(Math.round(clampedX), Math.round(clampedY));
    const [ax, ay] = mainWindow.getPosition();
    return { x: ax, y: ay };
  });
```

- [ ] **Step 4: preload.js —— 暴露三个接口**

在 `src/main/preload.js` 的 `exposeInMainWorld('electronAPI', {...})` 对象里追加：

```js
  // 窗口移动（桌面级）
  getWindowPosition: () => ipcRenderer.invoke('window:position:get'),
  moveWindow: (x, y) => ipcRenderer.invoke('window:move', { x, y }),
  onCursorPos: (callback) => ipcRenderer.on('cursor:pos', callback),
```

- [ ] **Step 5: 冒烟验证（跑应用 + DevTools 控制台）**

Run: `npm start`
在宠物窗口打开 DevTools（临时在 `createWindow` 后加 `mainWindow.webContents.openDevTools({mode:'detach'})`，验证完删掉，或用快捷键）。在控制台执行：

```js
await window.electronAPI.getWindowPosition()   // 期望：{x: <num>, y: <num>}
await window.electronAPI.moveWindow(0, 0)      // 期望：返回 clamp 后坐标，窗口跳到左上工作区角
window.electronAPI.onCursorPos((_, c) => console.log(c)) // 期望：移动鼠标时持续打印 {x,y}
```

确认：移窗生效、越界被 clamp、光标持续推送。验证后移除临时的 openDevTools 行。

- [ ] **Step 6: 提交**

```bash
git add src/main/index.js src/main/preload.js
git commit -m "feat: add window-move IPC and global cursor stream in main"
```

---

### Task 3: `pet.css` —— 外观与闲置动画

**Files:**
- Modify: `src/renderer/pet/pet.css`

**Interfaces:**
- Produces（`pet.js` 依赖的 class 钩子）：`#pet-body` 上加 `.grabbed`（被拖，放大）、`.moving`（走动，squash & stretch）。

- [ ] **Step 1: 写样式**

覆盖 `src/renderer/pet/pet.css` 全文：

```css
/* 宠物窗口样式 —— 透明背景、居中 emoji、呼吸/轻晃闲置动画 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
}

#pet-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: visible;
}

#pet-body {
  font-size: 72px;
  line-height: 1;
  cursor: grab;
  /* 闲置：呼吸 + 偶尔轻晃。transform-origin 底部中心，晃动更自然 */
  transform-origin: 50% 90%;
  animation: breathe 2.5s ease-in-out infinite, sway 6s ease-in-out infinite;
  will-change: transform;
}

/* 被拖拽：放大表示「被抓住」，暂停闲置动画 */
#pet-body.grabbed {
  cursor: grabbing;
  animation: none;
  transform: scale(1.15);
}

/* 走动：轻微 squash & stretch，让滑行有生气 */
#pet-body.moving {
  animation: breathe 2.5s ease-in-out infinite, waddle 0.5s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.05); }
}

@keyframes sway {
  0%, 92%, 100% { rotate: 0deg; }
  95%           { rotate: 5deg; }
  98%           { rotate: -5deg; }
}

@keyframes waddle {
  0%, 100% { transform: scale(1, 1); }
  25%      { transform: scale(1.08, 0.92); }
  75%      { transform: scale(0.94, 1.06); }
}

#speech-bubbles {
  /* 气泡容器占位 —— 本轮不实现气泡，仅保留结构不影响布局 */
  position: absolute;
  pointer-events: none;
}
```

- [ ] **Step 2: 目视验证**

Run: `npm start`
期望：窗口透明无边框，🐱 居中显示，能看到轻微呼吸缩放，偶尔轻晃。无白色背景块、无滚动条。

- [ ] **Step 3: 提交**

```bash
git add src/renderer/pet/pet.css
git commit -m "feat: add pet appearance and idle animation styles"
```

---

### Task 4: `pet.js` —— 状态机与交互

**Files:**
- Modify: `src/renderer/pet/pet.js`

**Interfaces:**
- Consumes: Task 1 的 `pet-motion.mjs` 全部导出；Task 2 的 `electronAPI.{getWindowPosition, moveWindow, onCursorPos, getWindowMode}`；Task 3 的 `.grabbed`/`.moving` class。
- Produces: 无（终端行为，供后续气泡子任务在 `onMouseUp` 的 tap 分支接入）。

- [ ] **Step 1: 写完整逻辑**

覆盖 `src/renderer/pet/pet.js` 全文：

```js
// 宠物渲染进程 —— 外观、闲置、拖拽、随机走动、靠近才躲鼠标。
// 大脑在这里：维护窗口坐标 + 状态机（DRAGGING > FLEEING > WANDERING > IDLE）。
// 纯几何在 pet-motion.mjs；窗口移动/光标由主进程 IPC 提供。

import {
  distance, isCursorNear, fleeCenter, wanderTarget,
  centerToTopLeft, topLeftToCenter,
} from './pet-motion.mjs'

// ── 常量 ──
const WIN = { w: 200, h: 200 }      // 对齐主进程 PET_MODE
const FLEE_THRESHOLD = 120          // 光标进入此半径触发躲避
const FLEE_PUSH = 150               // 一次弹开距离
const FLEE_MS = 300                 // 弹开滑行时长
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
let fleeing = false
let dragOffset = { x: 0, y: 0 }
let dragStartCursor = { x: 0, y: 0 }
let glideToken = 0                  // 每次新滑行 +1，旧帧靠它自我作废
let wanderTimer = null

// ── 工具 ──
function rand(min, max) {
  return min + Math.random() * (max - min)
}

// 命令主进程移窗，用 clamp 后的真实落点回填 winPos，保持同步。
async function commitMove(pos) {
  winPos = pos
  const actual = await window.electronAPI.moveWindow(pos.x, pos.y)
  winPos = actual
}

// 缓动滑行到目标左上角。durationMs 内逐帧 moveWindow。
// 高优先级动作（拖拽/新的躲避）通过 ++glideToken 让当前滑行的后续帧作废。
function glideTo(target, durationMs, { onDone, moving } = {}) {
  const token = ++glideToken
  const start = { ...winPos }
  const t0 = performance.now()
  if (moving) body.classList.add('moving')

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

// ── 光标事件：拖拽跟随 / 躲避 ──
function onCursor(cursor) {
  lastCursor = cursor

  if (dragging) {
    // 拖拽：窗口原点 = 光标 - 抓取偏移，直接跟随不缓动
    commitMove({ x: cursor.x - dragOffset.x, y: cursor.y - dragOffset.y })
    return
  }

  if (fleeing) return // 正在弹开，等它结束再判断

  const center = topLeftToCenter(winPos, WIN)
  if (isCursorNear(center, cursor, FLEE_THRESHOLD)) {
    fleeing = true
    if (wanderTimer) { clearTimeout(wanderTimer); wanderTimer = null }
    const fleeC = fleeCenter(center, cursor, FLEE_PUSH)
    glideTo(centerToTopLeft(fleeC, WIN), FLEE_MS, {
      onDone: () => {
        fleeing = false
        // 弹完若光标仍近会在下一帧再弹；否则回归走动
        scheduleWander()
      },
    })
  }
}

// ── 拖拽 ──
function onMouseDown() {
  dragging = true
  fleeing = false
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
  if (dragging || fleeing) return
  if (await isDashboard()) { scheduleWander(); return }
  // 光标近时不走动（交给躲避），稍后再试
  const center = topLeftToCenter(winPos, WIN)
  if (isCursorNear(center, lastCursor, FLEE_THRESHOLD)) { scheduleWander(); return }

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
```

- [ ] **Step 2: 加 getWindowMode 兜底确认**

确认 `preload.js` 已有 `getWindowMode`（Task 前的现状里已存在 `getWindowMode: () => ipcRenderer.invoke('window:mode')`）。若无则不属本轮范围，`isDashboard()` 的 `if (!...getWindowMode) return false` 兜底会让功能照常工作（本轮面板态尚未接入）。无需改动，确认即可。

- [ ] **Step 3: 行为验证（跑应用）**

Run: `npm start`
逐项确认（对齐 spec 验收）：
1. 宠物悬浮桌面，🐱 呼吸/轻晃。
2. **随机走动**：静置 5~12s 后宠物平滑滑到附近新位置，带轻微 squash。
3. **拖拽**：按住 🐱 拖动，窗口跟随光标；松开后恢复走动。
4. **靠近才躲**：鼠标（不按键）靠近到 ~120px，宠物弹开一段；持续逼近会连续弹；鼠标离开后恢复走动。
5. **拖拽时不躲**：按住拖动时不会因靠近而逃，能稳稳抓住。
6. **不越界**：把宠物赶/拖到屏幕边缘，被 clamp 在工作区内，不跑出屏幕。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/pet/pet.js
git commit -m "feat: implement pet drag, wander, and mouse-avoidance state machine"
```

---

### Task 5: 文档收尾

**Files:**
- Modify: `src/renderer/pet/DESIGN.md`
- Modify: `docs/progress.md`

- [ ] **Step 1: 更新模块技术设计**

把 `src/renderer/pet/DESIGN.md` 的「状态」「动画」小节细化为本轮实现：状态机 `DRAGGING > FLEEING > WANDERING > IDLE`、`pet-motion.mjs` 纯函数清单、坐标契约（左上角锚点、主进程 clamp）、`.grabbed`/`.moving` class 约定。（追加，不删除已有对话系统等后续小节。）

- [ ] **Step 2: 更新进度**

在 `docs/progress.md` 的「渲染进程 — 宠物」表把 `pet.js`/`pet.css` 标 ✅，新增一行 `pet-motion.mjs ✅ 纯几何 + node --test`。在合适处登记：主进程本轮新增 `window:move`/`window:position:get`/`cursor:pos` 三个 IPC（已获授权）；preload 新增 `moveWindow/getWindowPosition/onCursorPos`。

- [ ] **Step 3: 提交**

```bash
git add docs/progress.md src/renderer/pet/DESIGN.md
git commit -m "docs: update pet module design and progress for movement system"
```

---

## Self-Review

**Spec coverage:**
- 外观 emoji → Task 3 ✅
- 闲置动画（呼吸/轻晃）→ Task 3 ✅
- 拖拽移动 → Task 4（onMouseDown/onCursor/onMouseUp）✅
- 随机走动 → Task 4（scheduleWander/doWander）✅
- 靠近才躲鼠标、拖拽时不躲 → Task 4（onCursor 的 fleeing 分支 + dragging 短路）✅
- 桌面级移动所需主进程能力 → Task 2 ✅
- 不越界 clamp → Task 2 move handler ✅
- 面板态暂停 → Task 4 `isDashboard()` + Task 2 切面板停光标 ✅

**Placeholder scan:** 仅 Task 4 的 tap 分支是**有意**的空钩子（本轮明确不做气泡），已注释说明；其余步骤均含完整代码/命令/期望输出。无 TBD。

**Type consistency:** `pet-motion.mjs` 导出的 `distance/isCursorNear/fleeCenter/wanderTarget/centerToTopLeft/topLeftToCenter` 在 Task 4 import 与调用签名一致；`winPos` 全程为窗口左上角 `{x,y}`；`WIN={w,h}` 与各转换函数的 `winSize` 字段一致；IPC 名 `window:move`/`window:position:get`/`cursor:pos` 在 index.js 与 preload.js 两侧一致。
