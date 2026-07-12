# 宠物模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#pet-container` — 根容器（透明背景，`-webkit-app-region: drag` 整窗可拖）
- `#pet-body` — 宠物本体（emoji，居中显示）
- `#speech-bubbles` — 气泡容器

## 状态

- 心情（happy / neutral / hungry / sad）
- 等级（Lv.1 → Lv.???）
- 亲密度数值

## 动画

- 闲置：呼吸（scale 1↔1.05，2.5s）+ 轻晃（rotate ±5°，6s 循环）
- 走动：`.moving` class → squash & stretch（waddle 0.5s）
- 赶跑：滑出屏幕边缘（Phase 2）
- 回来：从边缘滑入（Phase 2）

## 移动系统（已实现）

> 桌面级：整个 200×200 窗口在屏幕上移动。详见 `docs/pet-movement-design.md` 和 ADR-007。

### 拖拽：CSS 原生方案

使用 `-webkit-app-region: drag`（OS 原生拖拽），零延迟零偏移，不是 JS+IPC。

主进程 `isAutoMoving` 标记区分用户拖拽和自动移动。用户拖拽时推送 `user:drag` 到渲染端暂停走动 300ms。

⚠️ **-webkit-app-region: drag 副作用**：会拦截子元素 click/mousedown。后续做气泡/双击时需在交互元素上加 `no-drag`。
详见 `docs/pet-movement-design.md` 第 6 节。

### 自动移动：IPC 方案

走动通过 `window:move` IPC（fire-and-forget），`glideTo` 用 rAF + easeOutCubic 缓动。

- 躲避光标：已搁置（IPC 延迟高），后续考虑主进程侧实现
- 面板态：全部暂停

### 状态机（优先级）

**用户拖拽（OS 原生）> FLEEING（搁置）> WANDERING > IDLE**

- **用户拖拽**：OS 原生，渲染端收到 `user:drag` 暂停自动化
- **WANDERING**：每 5~12s 随机挑 ±200px 目标 → ~1.2s 缓动滑过去
- **IDLE**：原地呼吸 + 轻晃动画

### 依赖

- 纯几何 `pet-motion.mjs`（无 DOM/IPC，`node --test` 覆盖）
- 主进程 IPC：`getWindowPosition()` / `moveWindow(x,y)` / `getCursorPos()` / `getWindowMode()`
- 主进程推送：`user:drag`（用户拖拽通知，暂停走动用）
- CSS class 钩子：`#pet-body.moving`（走动 squash&stretch）

### 滑行取消

`glideTo` 用自增 `glideToken` 让被更高优先级动作接管的旧帧自我作废。

## 对话系统

> 待实现（后续子任务）

- 台词按心情和等级分类
- 点击时随机抽取对应类别
- 气泡叠加显示，2 秒自动消失
