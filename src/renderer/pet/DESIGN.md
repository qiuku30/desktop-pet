# 宠物模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#pet-container` — 根容器（透明背景）
- `#pet-body` — 宠物本体（emoji，可拖拽）
- `#speech-bubbles` — 气泡容器

## 状态

- 心情（happy / neutral / hungry / sad）
- 等级（Lv.1 → Lv.???）
- 亲密度数值

## 动画

- 闲置：轻微晃动
- 走路：translate 位移
- 赶跑：滑出屏幕边缘
- 回来：从边缘滑入

## 移动系统（已实现）

> 桌面级：整个 200×200 窗口在屏幕上移动，非窗口内挪 emoji。详见 `docs/pet-movement-design.md`。

### 坐标契约
- 屏幕绝对像素，锚点为窗口**左上角**；`WIN = { w:200, h:200 }`，宠物中心 = 窗口中心。
- clamp 到显示器 workArea 的逻辑在主进程 `window:move` handler，返回真实落点回填渲染端 `winPos`。

### 状态机（优先级 DRAGGING > FLEEING > WANDERING > IDLE）
- **DRAGGING**：`mousedown` 记录光标与窗口原点偏移 → 复用全局光标流 `moveWindow(cursor - offset)`（无缓动）→ `mouseup` 结束。位移 <5px 视为 tap（留空钩子给气泡子任务，本轮不做）。拖拽期间不躲。
- **FLEEING**：非拖拽下光标 <120px → 沿反方向一次性弹开 ~150px（缓动 ~300ms）；`fleeing` 标志防连触，弹完仍近则再弹。
- **WANDERING**：每 5~12s 随机挑当前 ±200px 内目标 → ~1.2s 缓动滑过去，`.moving` 做 squash & stretch。
- **IDLE**：原地呼吸 + 偶尔轻晃。
- **面板态**：`getWindowMode()==='dashboard'` 全暂停（主进程也停光标推流）。

### 依赖
- 纯几何 `pet-motion.mjs`：`distance` / `isCursorNear` / `fleeCenter` / `wanderTarget` / `centerToTopLeft` / `topLeftToCenter`（无 DOM/IPC，`node --test` 覆盖）。
- 主进程 IPC：`getWindowPosition()` / `moveWindow(x,y)`（返回 clamp 后真实坐标）/ `onCursorPos(cb)` / `getWindowMode()`。
- CSS class 钩子：`#pet-body.grabbed`（被拖，放大 + 暂停闲置）、`#pet-body.moving`（走动，squash&stretch）。

### 滑行取消
- `glideTo` 用自增 `glideToken` 让被更高优先级动作接管的旧帧自我作废；非走动滑行开始时归一化清 `.moving`。

## 对话系统

- 台词按心情和等级分类
- 点击时随机抽取对应类别
- 气泡叠加显示，2 秒自动消失
