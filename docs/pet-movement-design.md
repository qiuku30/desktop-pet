# 宠物移动系统设计（pet.js + pet.css）

> 日期：2026-07-11
> 范围：Phase 1 宠物外观、闲置动画、拖拽移动、随机走动、躲避鼠标。
> 不含：气泡、右键菜单对接、双击切面板、赶跑、成长系统（均为独立子任务）。

## 决策摘要

| 决策点 | 结论 |
|--------|------|
| 移动范围 | **桌面级**：整个 BrowserWindow 在屏幕上移动，不是窗口内挪 emoji |
| 主进程改动 | 已授权，仅加「移窗 IPC + 全局光标位置」，不碰其他逻辑 |
| 躲鼠标触发 | **靠近才躲**（光标 <120px），**拖拽时不躲**，弹一下即可（非持续逃） |
| 闲置动画 | 呼吸（scale）+ 偶尔轻晃（rotate），emoji 无法眨眼 |
| 大脑位置 | 渲染进程（pet.js）算一切，主进程只当手脚 |

## 1. 进程职责划分

渲染进程 `pet.js` 是唯一「大脑」，维护窗口当前坐标、判断距离、决定移动目标。主进程保持哑，只提供最小接口。

### preload.js 新增（仅这三项）

```
moveWindow(x, y)        // 移动窗口到屏幕绝对坐标（窗口左上角）
getWindowPosition()     // 返回当前窗口左上角坐标 {x, y}，初始化用
onCursorPos(callback)   // 订阅主进程推送的全局光标坐标 {x, y}
```

### index.js 新增（仅这些，不改现有逻辑）

- `ipcMain.handle('window:move', (_, {x, y}))` → `mainWindow.setPosition(x, y)`，
  **在此 clamp 到当前显示器 workArea**，防止窗口被移出屏幕。
- `ipcMain.handle('window:position:get')` → 返回 `mainWindow.getPosition()`。
- 全局光标轮询：`setInterval(~40ms)` 调 `screen.getCursorScreenPoint()`，
  `mainWindow.webContents.send('cursor:pos', {x, y})`。
  **仅宠物态运行**；切到面板态时暂停轮询，切回时恢复。

> 契约：所有坐标为屏幕绝对像素，窗口左上角为锚点。clamp 逻辑归主进程 move handler，
> 渲染进程无需知道屏幕尺寸。

## 2. 行为状态机

单一 `mode` 变量，优先级从高到低：

```
DRAGGING  >  FLEEING  >  WANDERING  >  IDLE
```

### DRAGGING（拖拽）
- `mousedown`（在 #pet-body）记录光标与窗口原点的偏移量 `offset`。
- 拖拽期间复用全局光标流：每帧 `moveWindow(cursor.x - offset.x, cursor.y - offset.y)`。
- `mouseup` 结束，回 IDLE。
- 拖拽期间 **不触发躲避**。
- 位移 <5px 视为「点一下（tap）」——本轮不做行为，仅留空钩子给后续气泡子任务。

### FLEEING（躲避）
- 触发：非拖拽状态下，光标与宠物中心距离 <120px。
- 反应：沿「光标→宠物中心」的反方向弹开约 150px（缓动滑行），**一次性弹开**，不是持续逃。
- 弹开后若光标仍 <120px，则再弹一次；光标离开后回 WANDERING。

### WANDERING（随机走动）
- 每隔 5~12s（随机）挑一个目标点：当前位置 ±200px 内、由主进程 clamp 保证落在工作区。
- 用缓动在约 1.2s 内滑到目标，然后回 IDLE 等待下次。

### IDLE（闲置）
- 原地播放呼吸/轻晃动画，不移动窗口。

### 面板态暂停
- `getWindowMode() === 'dashboard'` 时，所有移动行为与光标订阅全部暂停；切回宠物态恢复。

## 3. 外观与闲置动画（pet.css）

- 占位 emoji 保持 🐱；`#pet-container` 透明背景、`user-select: none`、`overflow: visible`。
- `#pet-body` 居中显示，字号撑满可视区。
- 闲置动画：
  - **呼吸**：`scale(1 ↔ 1.05)`，约 2.5s 循环。
  - **轻晃**：偶发 `rotate(±5°)`。
- 走动时加方向性 squash & stretch，让滑行有生气。
- 被拖时 emoji 略放大，表示「被抓住」。
- 窗口整体位移由 `moveWindow` 完成；emoji 在窗内基本居中，CSS 动画只做形变、不做大位移。

## 4. 边界与暂停条件汇总

| 条件 | 行为 |
|------|------|
| 面板态 | 全部暂停（含光标轮询） |
| 拖拽中 | 暂停躲避、暂停随机走动 |
| 躲避中 | 暂停随机走动 |
| 光标近 | 触发躲避（除非在拖拽） |

## 5. 明确不在本轮范围

气泡系统、右键菜单 IPC 对接、双击切面板、赶跑（拖到边缘跑出+自动回来）、成长系统。
仅在拖拽逻辑里预留 tap 钩子，供后续气泡子任务接入。
