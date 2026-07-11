# 开发进度

> 每次会话结束时更新此文件。
> 当前分支：待建（本地项目尚未关联 Git）

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
| index.js — 窗口创建 + 模式切换 | ✅ | 单窗口双状态 + 右键菜单 + IPC |
| preload.js — 安全 IPC 桥接 | ✅ | contextBridge |
| store.js — 统一数据存取层 | ✅ | JSON 文件，initStore/getState/setState |
| ipc/pet-ipc.js — 宠物 IPC | ⏳ | 占位，待实现 |
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
| pet.js — 宠物逻辑 | ⏳ | 动画、拖拽、走动、气泡（待实现） |
| pet.css — 宠物样式 | ⏳ | 待实现 |
| DESIGN.md | 🟡 | 有基本结构，待细化 |

### 渲染进程 — 面板 (src/renderer/dashboard/)

| 任务 | 状态 | 备注 |
|------|------|------|
| dashboard.html — 面板框架 | ✅ | 导航 + 内容区 |
| dashboard.js — 面板逻辑 | ⏳ | 导航切换、模块加载（待实现） |
| dashboard.css — 面板样式 | ⏳ | 待实现 |
| DESIGN.md | 🟡 | 有基本结构，待细化 |

---

## 待实现（按优先级）

1. `pet.js` + `pet.css` — 宠物外观、动画、交互
4. `dashboard.js` + `dashboard.css` — 面板切换和模块加载
5. 对话气泡系统
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

- [ ] 🔴 **关键**: pet.html 的 `<script>` 标签缺少 `type="module"`。
      不加则浏览器环境无法解析 ES6 import/export，宠物模块一加载就 SyntaxError。
      所有三个 `<script>`（event-bus.js、pet-state.js、pet.js）都要加 `type="module"`。
      pet 模块窗口接到后第一时间修。

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
