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
| docs/architecture.md | ✅ | 6 条 ADR |
| docs/conventions.md | ✅ | 含禁止跨模块 import |
| docs/events.md | ✅ | 14 个事件，含参数和触发时机 |
| docs/progress.md | ✅ | 本文件 |
| specs/pet-system.md | ✅ | 功能 + 交互 + 验收标准 |

### 主进程 (src/main/)

| 任务 | 状态 | 备注 |
|------|------|------|
| index.js — 窗口创建 + 模式切换 | ✅ | 单窗口双状态 + 右键菜单 + IPC；宠物状态通道已委托给 pet-ipc；新增移窗 IPC + 全局光标推流（宠物态） |
| preload.js — 安全 IPC 桥接 | ✅ | contextBridge；新增 moveWindow / getWindowPosition / onCursorPos |
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
| pet.js — 宠物逻辑 | ✅ | 状态机：拖拽 / 随机走动 / 靠近才躲鼠标 / 闲置；桌面级移窗（气泡待后续子任务） |
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

- 单词模块 (Phase 2)
- 2048 模块 (Phase 2)
- 农场模块 (Phase 2)
- 超市模块 (待规划)
- 窗口边框攀爬 (Phase 2)
- 模块错误隔离 (Phase 3)

---

## 已知问题

- [x] 🔴 **关键**: pet.html 的 `<script>` 标签缺少 `type="module"`。~~已修复~~
      三个 `<script>`（event-bus.js、pet-state.js、pet.js）均已加 `type="module"`。

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

## 设计决策记录 — 宠物移动系统（pet.js / pet.css / pet-motion.mjs）

详见 `docs/pet-movement-design.md`。要点：

- **桌面级移动**：整个 200×200 窗口在屏幕上移动，非窗口内挪 emoji。渲染进程 `pet.js` 是大脑，
  维护窗口左上角坐标；主进程只当手脚（新增 `window:move` / `window:position:get` / `cursor:pos` 推流）。
- **坐标契约**：屏幕绝对像素，锚点为窗口左上角；clamp 到显示器 workArea 的逻辑在主进程 move handler，
  返回真实落点回填渲染端 `winPos`。
- **状态机优先级**：`DRAGGING > FLEEING > WANDERING > IDLE`。
  - 拖拽：复用全局光标流，`moveWindow(cursor - offset)`，无缓动；位移 <5px 视为 tap（留空钩子给气泡子任务）。
  - 躲避：光标 <120px 时一次性弹开 ~150px（缓动），拖拽时不躲；`fleeing` 标志防连触。
  - 走动：每 5~12s 随机挑附近目标点，~1.2s 缓动滑过去，`.moving` 做 squash&stretch。
  - 面板态：`getWindowMode()==='dashboard'` 全暂停，主进程也停光标推流。
- **纯几何** `pet-motion.mjs`：`distance` / `isCursorNear` / `fleeCenter` / `wanderTarget` /
  `centerToTopLeft` / `topLeftToCenter`，无 DOM/IPC，`node --test` 覆盖。
- **滑行取消**：`glideTo` 用自增 token 让被更高优先级动作接管的旧帧自我作废；非走动滑行开始时归一化清 `.moving`。
- **协作教训**：本轮曾因两个窗口并发改同一 `feature/pet-movement` 分支导致改动互相还原（详见 git 历史 e8b58e4/3adcd92）。
  已按 CLAUDE.md：同一时间只在一个窗口/设备改，切换前先 pull。

### 遗留 Minor（下一轮可清理）
- pet.css：`.moving` 动画列表里的 `breathe` 被 `waddle` 覆盖，是死代码，可删。
- pet.js：`commitMove` 在 await 前先写 `winPos=pos`（未 clamp），屏幕边缘按下抓取可能有小跳；
  在途 glide 帧未做面板态守卫（主进程已 gate 光标流，风险低）。
