# 宠物模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#pet-container` — 根容器（透明背景，`-webkit-app-region: drag` 整窗可拖）
- `#pet-body` — 宠物本体（emoji，居中显示）
- `#speech-bubbles` — 气泡容器

## 状态

- 心情（happy / neutral / hungry / sad）
- 等级（Lv.1 → Lv.30），含经验值（exp）与升级曲线
- 饱腹值（satiety，0-动态上限，随时间衰减）
- 亲密度（intimacy，喂食 +5）
- 金币（coins，待接入）
- 食物库存（foodInventory）
- 每日互动计数（dailyInteractionCount / lastInteractionDate）
- 饱腹衰减时间戳（lastSatietyUpdate）

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

> ✅ 已实现（2026-07-12）

- **台词库**：28 条，按 `心情(happy/neutral/hungry/sad)` × `等级(low 1-3 / mid 4-6 / high 7+)` 分层
- **交互**：单击 `#pet-body` → 300ms 延迟（为双击预留）→ 弹出气泡；双击 → `toggleWindow()` 切换面板；拖拽移动 > 3px 不出气泡
- **气泡**：`#speech-bubbles` 内绝对定位，`flex-direction: column-reverse` 垂直堆叠，最新气泡离宠物最近
- **动画**：`@keyframes bubble-pop`，2s ease-out（弹入 10% → 保持 → 淡出上飘），`animationend` 移除 DOM
- **`no-drag`**：`#pet-body` 加 `-webkit-app-region: no-drag` 让点击事件穿透 drag 拦截；父级 `#pet-container` 的 15px padding 保留拖拽区域
