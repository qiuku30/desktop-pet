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
| event-bus.js — 事件总线核心 | ⏳ | 占位，待实现 |
| pet-state.js — 宠物状态管理器 | ⏳ | 占位，接口已定 (get/set/subscribe) |
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

1. `event-bus.js` — 事件总线核心
2. `pet-state.js` — 宠物状态管理器
3. `pet.js` + `pet.css` — 宠物外观、动画、交互
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
