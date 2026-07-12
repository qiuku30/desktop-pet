# 开发进度

> 每次会话结束时更新此文件。
> 当前分支：feature/pet-movement

---

## 总体进度

| 模块 | Phase | 状态 |
|------|-------|------|
| 🐾 宠物系统 | Phase 1 | 🔨 进行中 |
| 📝 英语单词 | Phase 2+ | ⏳ 待定 |
| 🎮 2048 | Phase 2+ | ⏳ 待定 |
| 🌾 农场经营 | Phase 2+ | ⏳ 待定 |
| 🏪 超市经营 | Phase 2+ | ⏳ 待定 |

---

## 🐾 宠物系统 — Phase 1

### 基础设施

| 任务 | 状态 | 备注 |
|------|------|------|
| 项目初始化 (npm init + electron-forge) | ✅ | electron 43.x, forge 7.x |
| 目录结构搭建 | ✅ | 37 个文件骨架 |
| .gitignore | ✅ | 含 node_modules/ dist/ .claude/ |
| CLAUDE.md | ✅ | 含架构、规则、协作模板 |
| docs/architecture.md | ✅ | 7 条 ADR |
| docs/conventions.md | ✅ | 含禁止跨模块 import |
| docs/events.md | ✅ | 14 个事件，含参数和触发时机 |
| docs/progress.md | ✅ | 本文件 |
| specs/pet-system.md | ✅ | 功能 + 交互 + 验收标准 |

### 主进程 (src/main/)

| 任务 | 状态 | 备注 |
|------|------|------|
| index.js — 窗口创建 + 模式切换 | ✅ | 单窗口双状态 + 右键菜单 + IPC；isAutoMoving 标记区分自动/用户拖拽；move 事件推送 user:drag |
| preload.js — 安全 IPC 桥接 | ✅ | contextBridge；moveWindow / getWindowPosition / getCursorPos / onUserDrag |
| store.js — 统一数据存取层 | ✅ | JSON 文件，initStore/getState/setState |
| ipc/pet-ipc.js — 宠物 IPC | ✅ | 导出 registerPetIPC(ipcMain)；整体覆盖写盘 + 空快照保护；已接线 |
| ipc/storage-ipc.js — 存储 IPC | ⏳ | 占位，待实现 |

### 渲染进程 — 共享层 (src/renderer/shared/)

| 任务 | 状态 | 备注 |
|------|------|------|
| events.js — 事件常量 | ✅ | 14 个事件常量 |
| module-registry.js — 模块注册表 | ✅ | pet-status 已注册 |
| event-bus.js — 事件总线核心 | ✅ | on(返回取消函数)/off/once/emit，逐个 try-catch 隔离，DEBUG 日志 |
| pet-state.js — 宠物状态管理器 | ✅ | 薄：init/get(副本)/set(映射发事件+防抖存盘)/subscribe |
| constants.js | ⏳ | 占位 |
| utils.js | ⏳ | 占位 |

### 渲染进程 — 宠物 (src/renderer/pet/)

| 任务 | 状态 | 备注 |
|------|------|------|
| pet.html — 宠物窗口结构 | ✅ | emoji + 气泡容器 |
| pet.js — 宠物逻辑 | ✅ | 状态机：原生拖拽（CSS -webkit-app-region: drag）/ 随机走动（moveWindow IPC）；躲避光标已搁置；气泡待后续 |
| pet-motion.mjs — 纯几何计算 | ✅ | distance/isCursorNear/fleeCenter/wanderTarget/中心↔左上角换算；node --test 6/6 |
| pet.css — 宠物样式 | ✅ | 透明背景 + 居中 emoji + 呼吸/轻晃闲置动画 + .grabbed/.moving 钩子 |
| DESIGN.md | ✅ | 已细化：状态机、pet-motion 清单、坐标契约、class 钩子 |

### 渲染进程 — 面板 (src/renderer/dashboard/)

| 任务 | 状态 | 备注 |
|------|------|------|
| dashboard.html — 面板框架 | ✅ | 导航 + 内容区 |
| dashboard.js — 面板逻辑 | ⏳ | 导航切换、模块加载（待实现） |
| dashboard.css — 面板样式 | ⏳ | 待实现 |
| DESIGN.md | 🟡 | 有基本结构，待细化 |

---

## 待实现（按优先级）

1. ~~`pet.js` + `pet.css` — 宠物外观、动画、交互~~ ✅ 已完成（移动系统：拖拽/走动/躲鼠标/闲置）
4. `dashboard.js` + `dashboard.css` — 面板切换和模块加载
5. 对话气泡系统（pet.js 已留 tap 空钩子）
6. 右键菜单交互（IPC 对接）
7. 面板状态页（宠物属性展示）

---

## 暂缓

- 2048 模块 (Phase 2)
- 单词模块 (Phase 2)
- 农场模块 (Phase 2)
- 超市模块 (待规划)
- 窗口边框攀爬 (Phase 2)
- 模块错误隔离 (Phase 3)
- 躲避光标（搁置，IPC 延迟高，后续可考虑在主进程侧做）

---

## 已知问题

- [x] 🔴 **关键（已修复）**: JS 拖拽持续偏移。根因：IPC（renderer → setPosition）每帧有延迟，无法追上用户拖拽速度。
      解决方案：CSS `-webkit-app-region: drag`（OS 原生拖拽，零延迟零偏移）+ 主进程 `isAutoMoving` 标记区分自动/用户移动。

- [x] 🔴 **关键**: pet.html 的 `<script>` 标签缺少 `type="module"`。~~已修复~~
      三个 `<script>`（event-bus.js、pet-state.js、pet.js）均已加 `type="module"`。

- [x] 🔴 **关键（已修复）**: dashboard.html 的 `<script>` 标签缺少 `type="module"`。
      和 pet.html 同样的 bug，加 `type="module"` 解决。
- [ ] 🟡 **后续窗口注意**: `#pet-container` 使用 `-webkit-app-region: drag` 实现原生拖拽，
      但会拦截子元素的 `click`/`mousedown`/`mouseup`。后续做气泡（单击）和面板（双击）时，
      需在交互元素上加 `-webkit-app-region: no-drag`。详见 `docs/pet-movement-design.md` 第 6 节。

---

## 待授权（下一轮）

- [ ] `events.js`: 新增 `PET_STATE_CHANGED` 通用事件，payload `{ key, value, oldValue }`
      用途：面板/新模块不 care 具体哪个 key，只想知道「宠物状态变了」，监听一个即可。
      配合 `pet-state.js` 的 `set()`：每个 key 都额外发此事件（监听方自行按 key 过滤）。
      当前先不加，不阻塞进度。

---

## 设计决策记录 — event-bus.js / pet-state.js（本轮）

**event-bus.js**
- API：`on`（返回取消订阅函数）/ `off` / `once`（触发一次自动移除，也返回取消函数）/ `emit`
- 错误隔离：`emit` 逐个调用监听器，每个包 try-catch，单个报错只 `console.error`，不影响其他监听器与 emit 方（ADR-006）
- 遍历前复制监听器数组，防止回调里 on/off 改动导致漏发/重复
- `const DEBUG = true` 开关：为 true 时打印每次 emit（ADR-002）
- 单例导出 `EventBus`

**pet-state.js（薄）**
- 职责：纯 key-value 存储 + 发事件 + 防抖存盘；**不含升级逻辑**（升级由宠物模块自己算好再 `set('level', n)`）
- API（严格按 ADR-005）：`async init()` / `get(key)` / `set(key, value)` / `subscribe(event, cb)`
- `init()`：启动时 await 一次，走 `getPetState()` 把存档灌进内存
- `get()`：对象/数组返回**副本**，防止外部绕过 `set()` 篡改内部状态（ADR-005）
- `set()`：改内存 → 按映射发事件 → 防抖存盘
  - key→事件映射：`hunger`→`PET_HUNGER_CHANGED{value}`、`mood`→`PET_MOOD_CHANGED{mood}`、`level`→`PET_LEVEL_UP{level}`（payload 字段名对齐 docs/events.md）
  - 其余 key（exp/intimacy/coins/foodInventory）只存不发；金币赚/花等语义由调用方自己 emit
- 持久化：**防抖写盘** 500ms；`_save()` 发整份内存快照给 `setPetState()`（store.js 整体覆盖写）
- 单例导出 `PetState`

> ⚠️ 跨进程契约假设：`_save()` 传的是**完整状态快照**（非增量），由 `src/main/ipc/pet-ipc.js`（待实现，不在本轮授权内）接住转发给 `store.setState()`。主进程实现方注意对齐。

---

## 设计决策记录 — pet-ipc.js（宠物状态 IPC 接线）

对齐上面 pet-state.js 的跨进程契约，实现并接线 `src/main/ipc/pet-ipc.js`。

- **形态**：导出 `registerPetIPC(ipcMain)`，由 `index.js` 的 `setupIPC()` 调用一次。
- **写盘语义**：**整体覆盖**（`store.setState(snapshot)`），对齐「完整快照」契约，不做 merge。
  替换了 `index.js` 里原来的 `{ ...current, ...updates }` 内联 merge handler。
- **空快照保护**：`{}` / `null` / 数组 / 非对象一律拒绝写盘，`console.warn` 后返回当前存档，
  防止渲染端 `init()` 失败（`_data` 退化为 `{}`）时 `_save()` 发来空对象把磁盘存档清空。
- **幂等注册**：每个通道先 `removeHandler` 再 `handle`，可安全重入。
- **通道**：`pet:state:get`（返回完整状态，供 `PetState.init()` 灌入）、`pet:state:set`（接完整快照写盘）。
- **接线**：`index.js` 删除内联的 `pet:state:get` / `pet:state:set` handler（及其专用的
  `getState`/`setState` import），改为 `require('./ipc/pet-ipc')` + 在 `setupIPC()` 中调用
  `registerPetIPC(ipcMain)`。只动 IPC 接线，未碰窗口移动 / 光标推流等其他逻辑。
- **验证**：mock `ipcMain` + stub `store` 驱动真实模块 + stub electron 启动真实 `index.js`，
  断言：覆盖非 merge / lastSaved 回填 / 空·null·数组保护 / 幂等注册 / 其他 IPC 通道不受影响。

---

## 设计决策记录 — 宠物移动系统 v2（pet.js / pet.css / pet-motion.mjs）

详见 `docs/pet-movement-design.md`。要点：

- **桌面级移动**：整个 200×200 窗口在屏幕上移动；渲染进程 `pet.js` 是大脑，主进程当手脚。
- **拖拽方案（已修复偏移 bug）**：
  - ❌ v1：JS 驱动拖拽（`pointermove` → `ipcRenderer.invoke('window:move')` → `mainWindow.setPosition`）。
    根因：IPC 链路每帧有延迟，累积即偏移，无论推/拉模型、coalesce、DPI 换算均无法根治。
  - ✅ v2：CSS `-webkit-app-region: drag`（OS 原生拖拽）。窗口管理器直接移动，零延迟零偏移。
    配合主进程 `isAutoMoving` 标记 + `mainWindow.on('move')` 事件 + `user:drag` IPC 推送，
    渲染端感知用户拖拽后暂停自动化（走动等），松手 300ms 后恢复。
- **坐标契约**：所有坐标为屏幕绝对像素（设备像素），窗口左上角为锚点。
- **状态机优先级**：`DRAGGING > FLEEING > WANDERING > IDLE`。
  - 拖拽：OS 原生，渲染端收到 `user:drag` 时暂停走动、取消当前滑行；恢复时重新 `getWindowPosition()` 同步真实位置。
  - 躲避：⚠️ 已搁置。IPC 拉光标延迟高，后续可考虑在主进程侧做检测。
  - 走动：每 5~12s 随机挑附近目标点（`wanderTarget`），~1.2s 缓动（easeOutCubic），`glideTo` 用自增 token 取消旧帧。
    `doWander` 检查面板态（dashboard 不走）和 `autoPaused`（用户拖拽中不走）。
  - 面板态：`getWindowMode()==='dashboard'` 时走动暂停。
- **纯几何** `pet-motion.mjs`：`distance` / `isCursorNear` / `fleeCenter` / `wanderTarget` /
  `centerToTopLeft` / `topLeftToCenter`，无 DOM/IPC，`node --test` 6/6 覆盖。
- **主进程改动**：
  - `isAutoMoving` 标记：`window:move` handler 设为 true → setPosition → false，防止自动移动被误判为用户拖拽。
  - `mainWindow.on('move')`：`!isAutoMoving` 时推送 `user:drag` 到渲染端。
  - `preload.js`：暴露 `onUserDrag(callback)` — 注册/取消 `user:drag` 事件监听。
