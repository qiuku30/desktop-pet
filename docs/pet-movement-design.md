# 宠物移动系统设计（pet.js + pet.css）

> 日期：2026-07-11 最后更新：2026-07-12
> 范围：Phase 1 宠物外观、闲置动画、拖拽移动、随机走动、躲避鼠标。
> 不含：气泡、右键菜单对接、双击切面板、赶跑、成长系统（均为独立子任务）。

## 决策摘要

| 决策点 | 结论 |
|--------|------|
| 拖拽方式 | **CSS `-webkit-app-region: drag`（OS 原生）**，不用 JS+IPC。理由见 ADR-007 |
| 自动移动 | `window:move` IPC（fire-and-forget），走动/躲避精度要求不高 |
| 拖拽/自动互斥 | 主进程 `isAutoMoving` 标记 + `user:drag` 事件通知渲染端暂停 |
| 闲置动画 | 呼吸（scale）+ 偶尔轻晃（rotate） |

## 1. 拖拽：CSS 原生方案

### 为什么不用 JS 驱动

JS 拖拽 = `pointermove` → `ipcRenderer.invoke('window:move')` → `setPosition`。这条 IPC 链路有不可消除的延迟，导致拖拽时持续偏移。尝试过 5 个版本的坐标计算（含 DPI 对齐），均无法解决。**桌面级拖拽必须用 OS 原生机制。**

### 方案

```css
#pet-container {
  -webkit-app-region: drag;    /* 整窗可拖（OS 原生，零延迟） */
}
```

### 主进程配合

`mainWindow.on('move')` 监听窗口位移。`isAutoMoving` 标记区分：
- `window:move` handler → `isAutoMoving = true` → `setPosition` → `isAutoMoving = false`
- `mainWindow.on('move')` → `!isAutoMoving` → 用户拖拽 → `webContents.send('user:drag')`

渲染端收到 `user:drag` 后暂停走动 300ms，避免自动走动和用户拖拽打架。

### 新事件

| 事件 | 方向 | 时机 |
|------|------|------|
| `user:drag` | 主进程 → 渲染 | 用户拖拽宠物窗口（非自动移动） |

## 2. 自动移动：IPC 方案

走动（随机）、躲避（光标靠近弹开）继续走 `window:move` IPC：
- `commitMove` 为 fire-and-forget（不等返回值）
- `glideTo` 用 rAF + easeOutCubic 缓动
- 更高优先级动作通过 `glideToken` 作废旧的滑行帧

走动和躲避不需要实时精度，IPC 延迟在这里可接受。

## 3. 行为状态机

优先级：**用户拖拽（OS 原生）> 走动（WANDERING）> 闲置（IDLE）**

- **用户拖拽**：OS 原生，收到 `user:drag` 后暂停走动 300ms
- **躲避**：⚠️ 已搁置（IPC 延迟高，后续考虑主进程侧实现）
- **走动**：每 5~12s 随机挑 ±200px 目标 → ~1.2s 缓动滑过去
- **闲置**：原地呼吸 + 轻晃动画

面板态全部暂停。

## 4. 外观与闲置动画（pet.css）

- 占位 emoji 🐱；`#pet-container` 透明、`user-select: none`
- 闲置：`scale(1 ↔ 1.05)` 呼吸（2.5s）+ `rotate(±5°)` 轻晃（6s 循环）
- 走动：`.moving` class → squash & stretch（waddle 0.5s）

## 5. 明确不在本轮范围

气泡系统、右键菜单 IPC 对接、双击切面板、赶跑、成长系统。

## 6. ⚠️ 已知遗留问题：`-webkit-app-region: drag` 与点击事件冲突

`#pet-container` 使用 `-webkit-app-region: drag` 让 Electron 把整个窗口变成原生拖拽手柄。
**副作用**：该元素及其子元素上的 `click`、`mousedown`、`mouseup` 事件被 Electron 拦截，不触发。

这意味着后续做对话气泡（单击说话）和双击面板时，**点击事件收不到**。

### 解决方案（后续窗口实施）

在需要点击交互的子元素上加 `-webkit-app-region: no-drag`：

```css
/* 宠物本体：需要双击 → 加 no-drag 让事件穿透 */
#pet-body {
  -webkit-app-region: no-drag;
}

/* 对话气泡：需要单击关闭 → 加 no-drag */
.speech-bubble {
  -webkit-app-region: no-drag;
}
```

**但注意**：`no-drag` 区域内不能拖拽窗口。所以宠物本体加 `no-drag` 后，
需要通过其他区域（如 `#pet-container` 的 padding/边缘）保持拖拽能力。

**推荐布局**：
```
┌──────────────────────────┐ ← #pet-container (drag)
│  padding: 10px           │ ← 边框保留 drag，用户拖这里
│  ┌──────────────────┐   │
│  │  #pet-body       │   │ ← no-drag，可接收点击/双击
│  │  (no-drag)       │   │
│  └──────────────────┘   │
│  padding: 10px           │
└──────────────────────────┘
```

用户拖拽窗口时抓边框，点击时点中间宠物。这是明确给气泡/面板窗口的交接事项。
