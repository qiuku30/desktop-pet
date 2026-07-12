# 架构窗口交接文档

> 最后更新：2026-07-12
> 架构窗口每次会话结束必须更新此文件。下一任架构窗口启动时读此文件恢复全局上下文。

---

## 项目定位

桌面摸鱼伴侣 (Desktop Pet) — Electron 桌面悬浮宠物应用。宠物是核心外壳，游戏是喂养手段（非平级）。

GitHub：https://github.com/qiuku30/desktop-pet

---

## 技术决策（全部已定，不再讨论）

| 决策 | 结论 |
|------|------|
| 框架 | Electron + JavaScript ES6 |
| 打包 | electron-forge |
| 存储 | JSON 文件（用户目录，主进程 IPC 读写）→ 后续升级 SQLite |
| 窗口 | 单窗口双状态（宠物态 ↔ 面板态） |
| 模块通信 | EventBus（模块间不互相 import） |
| 事件命名 | `模块名:动作:状态` |
| 面板导航 | module-registry.js 驱动 |
| 数据存取 | store.js 统一层，模块不直接碰文件系统 |
| PetState | 薄：get/set/subscribe，不含业务逻辑 |
| 拖拽 | CSS `-webkit-app-region: drag`（OS 原生，IPC 延迟无法根除） |
| 自动移动 | window:move IPC（fire-and-forget） |
| 光标 | 拉模型：getCursorPos()（不推流，永远不积压） |

---

## 架构文档索引

| 文档 | 内容 |
|------|------|
| `docs/architecture.md` | 7 条 ADR（全项目架构决策） |
| `docs/conventions.md` | 编码规范 + 🚫 跨模块 import 禁止 |
| `docs/events.md` | EventBus 事件清单 + 主进程推送事件 |
| `docs/pet-movement-design.md` | 宠物移动系统详细设计 |
| `specs/pet-system.md` | 宠物 Phase 1 需求 + 验收标准 |

---

## 实现进度

### ✅ 已完成（在 main 分支）

| 组件 | 文件 | 备注 |
|------|------|------|
| EventBus | `shared/event-bus.js` | on/off/once/emit，try-catch 隔离，DEBUG 日志 |
| PetState | `shared/pet-state.js` | 薄：async init/get(副本)/set(发事件+防抖存盘)/subscribe |
| 事件常量 | `shared/events.js` | 14 个 EventBus 事件 + 注意 PET_SHOOED 已修正 |
| 模块注册表 | `shared/module-registry.js` | 目前只有 pet-status |
| 统一存取 | `main/storage/store.js` | initStore/getState/setState |
| 主进程窗口 | `main/index.js` | 单窗口双状态 + 移窗/光标/状态 IPC |
| 安全桥接 | `main/preload.js` | 所有 IPC 接口（含 onUserDrag 返回取消函数） |
| 宠物 HTML | `pet/pet.html` | type="module" 已加 ✅ |

### 🔨 已完成（在 feature/pet-movement 分支，待合并）

| 组件 | 文件 | 备注 |
|------|------|------|
| 宠物移动 | `pet/pet.js` | CSS 原生拖拽 + 随机走动，~110 行 |
| 宠物样式 | `pet/pet.css` | 呼吸/轻晃/waddle 动画 |
| 纯几何 | `pet/pet-motion.mjs` | distance/isCursorNear/wanderTarget 等，6/6 测试过 |
| 状态 IPC | `main/ipc/pet-ipc.js` | 整体覆盖 + 空快照保护，已接线到 index.js |

### ⏳ 待实现

| 任务 | 依赖 |
|------|------|
| 对话气泡系统 | pet 移动完成 |
| 双击面板切换 | pet 移动完成 |
| 右键菜单 IPC 对接 | — |
| 面板状态页（宠物属性展示）| dashboard.js |
| dashboard.js + dashboard.css | — |
| 躲避光标（搁置）| 需主进程侧方案 |

### ⏳ 未来模块

单词（Phase 2）、2048（Phase 2）、农场（Phase 2）、超市（待规划）

---

## 已知问题和交接注意事项

1. 🔴 **dashboard.html 脚本标签**：已加 type="module" ✅
2. 🟡 **-webkit-app-region: drag 与点击冲突**：拖拽用了 CSS 原生拖拽，会拦截 click/mousedown。后续做气泡（单击）和面板（双击）时，需在交互元素上加 `-webkit-app-region: no-drag`。详见 `docs/pet-movement-design.md` 第 6 节。
3. 🟡 **躲避光标已搁置**：IPC 拉光标延迟高，后续考虑主进程侧实现
4. 🟡 **PET_STATE_CHANGED 通用事件**：待授权事件常量新增
5. 🟡 **event-bus.js DEBUG=true**：开发模式日志，生产环境需要开关
6. 🟢 **pet-state.js 直接依赖 window.electronAPI**：全局依赖，限制了单测。暂不改

---

## 待决策事项

- [ ] 宠物做完后，下一个模块做哪个？
- [ ] Phase 1 食物价格（初版不需要，先记着）

---

## 分支状态

| 分支 | 状态 | 说明 |
|------|------|------|
| `main` | ✅ 稳定 | 含所有基础设施 |
| `feature/pet-movement` | 🔨 进行中 | pet 移动系统，待合并回 main |

---

## 协作要点

- 每一任架构窗口在此文件末尾追加 "202X-XX-XX — 架构窗口会话记录"
- 实现窗口只读不写此文件
- 架构决策变更时更新对应的 docs/* 文件，不要只改此文件
