# 架构窗口交接文档

> 最后更新：2026-07-13
> Phase 1 已合并 main。网络未推送，恢复后 `git push origin main`。下一任架构窗口启动时读此文件恢复全局上下文。

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
| `docs/architecture.md` | 十大原则 + 8 条 ADR（全项目架构决策） |
| `docs/conventions.md` | 编码规范 + 🚫 跨模块 import 禁止 |
| `docs/events.md` | EventBus 事件清单 + 主进程推送事件 |
| `docs/pet-movement-design.md` | 宠物移动系统详细设计 |
| `docs/session-log.md` | 窗口会话日志（编号、改动文件、越界授权、追溯 bug） |
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
| 对话气泡 | `pet/pet.js` `pet/pet.css` | 28 条台词 mood×level 分层、300ms 延迟 + 拖拽检测(3px)、2s 气泡弹出动画、no-drag 点击穿透 |
| 双击面板 | `pet/pet.js` `main/index.js` `dashboard/*` | 双击→toggleWindow→loadFile、面板顶部栏+✕关闭、面板边缘拖拽缩放 |
| 右键菜单 | `pet/pet.js` | 喂食（消耗食物→hunger-20/intimacy+5→气泡）、状态（→切面板） |
| 喂食 flyout | `pet/pet.js` | 食物库存 C→A、FOODS 配置表（原则 5）、overlay 选食投喂 |
| 窗口动态缩放 | `main/index.js` | getPetSize() = 200 × scaleFactor × zoom；四档右键菜单(75/100/125/150%)；zoomLevel 持久化保护；lockPetSize() min=max 锁定 |
| 响应式布局 | `pet/pet.css` | 所有尺寸从固定 px → vw，窗口变大内容等比放大 |
| Overlay 悬浮面板 | `main/overlay-manager.js` `renderer/overlay/*` | showOverlay(opts)→Promise；独立子 BrowserWindow；data-overlay-result 事件委托；CSS 原生拖拽；单实例 |

### ⏳ 待实现

| 任务 | 依赖 |
|------|------|
| 面板状态页（dash-01）| — |
| 躲避光标（搁置）| 需主进程侧方案 |

### ⏳ 未来模块

单词（Phase 2）、2048（Phase 2）、农场（Phase 2）、超市（待规划）

---

## 已知问题和交接注意事项

1. ✅ ~~dashboard.html 脚本标签~~ 已加 type="module"
2. ✅ ~~-webkit-app-region: drag 与点击冲突~~ 已解决：`#pet-body` 加 `no-drag`，容器 padding 保留拖拽区域。详见 `docs/pet-movement-design.md` 第 6 节。
3. 🟡 **躲避光标已搁置**：IPC 拉光标延迟高，后续考虑主进程侧实现
4. ✅ ~~PET_STATE_CHANGED 通用事件~~ infra-02 已实现
5. 🟡 **event-bus.js DEBUG=true**：开发模式日志，生产环境需要开关
6. 🟢 **pet-state.js 直接依赖 window.electronAPI**：全局依赖，限制了单测。暂不改
7. 🟡 **整体覆盖写盘风险**：PetState._save() 是完整快照覆盖，新增持久化字段（如 zoomLevel）需在主进程 pet:state:set handler 中保护，防止被渲染端覆盖冲掉。当前 index.js L159-169 有保护逻辑
8. ✅ ~~喂食逻辑重复~~ infra-06 已解决：抽 `shared/feed-service.js`，导出 FOODS 配置表 + consumeFood/applyFeed/emitFed，pet.js 和 dashboard.js 统一引用
9. 🟡 **loadFile 切换 = 渲染进程重建**：EventBus/PetState 不跨页面，需 flush() 保证落盘。Phase 1 够用；Phase 2 如需面板实时同步宠物状态，考虑主进程持有数据或双 webview
10. 🟢 **旧存档 hunger 字段残留**（infra-05 重命名后）：存量 pet-data.json 的 `hunger` key 不再读取，残留无害。Phase 1 开发阶段清档即可，生产环境需做数据迁移
11. 🟢 **exp 进度条假设 0-100 刻度**：dash-01 `renderLevel()` 把 exp 直接当百分比。后续定下成长曲线后统一调整

---

## 待决策事项

- [ ] 宠物做完后，下一个模块做哪个？
- [ ] Phase 1 食物价格（初版不需要，先记着）

---

## 分支状态

| 分支 | 状态 | 说明 |
|------|------|------|
| `main` | ✅ 稳定 | Phase 1 完成（本地已合并，待 push） |
| `feature/pet-movement` | ✅ 已合并 | 2026-07-13 合并回 main |

---

## 协作要点

- 每一任架构窗口在此文件末尾追加 "202X-XX-XX — 架构窗口会话记录"
- 实现窗口只读不写此文件
- 架构决策变更时更新对应的 docs/* 文件，不要只改此文件

---

## 2026-07-12 — 架构窗口会话记录 (1) 对话气泡

**处理事项**：接收实现窗口（对话气泡）上报的 4 项架构级改动。

**已执行**：
1. `store.js` DEFAULT_STATE 补 `zoomLevel: 1.0`（实现窗口新增了持久化 key 但 store 无默认值）
2. `docs/pet-movement-design.md` 第 6 节：从"⚠️ 已知遗留问题"改为"✅ 已解决"，记录 no-drag 实施方案
3. `docs/architecture.md`：
   - ADR-001：窗口尺寸从固定 200×200 → 动态 `200 × scaleFactor × zoomLevel`
   - ADR-005：新增 PetState.init() 幂等初始化约定
   - ADR-007：补充动态窗口尺寸说明
4. `PROJECT_BRIEF.md`：更新进度、已知问题、本记录

## 2026-07-12 — 架构窗口会话记录 (2) 双击面板 + 高 DPI 修复

**处理事项**：接收实现窗口（双击面板切换 + 高 DPI bug 修复）上报。

**已执行**：
1. `docs/architecture.md` 新增 **ADR-008**：高 DPI 下自动移动使用 `setBounds` 而非 `setPosition`。
   记录 `currentPetSize` 变量模式和三处同步点（createWindow/applyZoom/switchToPet）。
2. `PROJECT_BRIEF.md`：更新进度、已知问题、本记录

**本次实现窗口新增**：
- 双击宠物 → `window:toggle` → `loadFile` 切换 HTML → 面板态（含顶部栏 + 关闭按钮）
- `savedPetBounds`：切面板前保存位置，切回时恢复（不再 center() 瞬移）
- `wanderEnabled`：右键菜单 checkbox 控制自动走动开关
- 三个高 DPI bug 修复：setPosition→setBounds 防尺寸漂移、中心锚点缩放、位置恢复

**当前全局状态**：
- `feature/pet-movement` 分支已完成：移动系统、对话气泡、窗口缩放、双击面板切换、右键菜单喂食/状态、响应式布局
- 宠物 Phase 1 仅剩：面板状态页（宠物属性展示）
- 下一优先级：面板状态页

---

## 2026-07-12 — ARCH-02 十大架构原则

`docs/architecture.md` 新增十大架构原则章节（低耦合、高内聚、单一职责、状态中心化、配置驱动、接口统一、可插拔性、性能隔离、容错降级、持久化统一）。所有 ADR 以此为依据。CLAUDE.md 实现窗口启动流程新增必读 architecture.md。

## 2026-07-12 — infra-02 PET_STATE_CHANGED 通用事件

`pet-state.js` set() 新增通用事件 `PET_STATE_CHANGED {key, value}`，所有 key 触发。映射事件不动，兼容已有监听方。
面板和新模块只需监听一个事件即可感知全部状态变化。

## 2026-07-12 — infra-03 Overlay 通用悬浮面板

`showOverlay({ html, width, height, x, y })` → Promise 模式。独立子 BrowserWindow，CSS 原生拖拽，
`data-overlay-result` 事件委托。单实例保护。覆用场景：喂食 flyout、气泡历史、快捷设置等。

不冲突 ADR-001（临时弹出窗口非独立常驻），不升级为 ADR。

## 2026-07-12 — pet-04 右键菜单 IPC 对接

**改动**：`pet/pet.js` 注册 `onMenuFeed` / `onMenuStatus` 监听。喂食：消耗首个食物→hunger-20/intimacy+5→气泡反馈；状态：toggleWindow() 切面板。

无越界，无新架构决策。

## 2026-07-13 — ARCH-03 代码审计 + 文档同步

**处理事项**：全面审计所有代码，对照十大原则 + 8 条 ADR + 编码规范。

**审计结果**：
- 🔴 2 项真问题：module-registry 死链接 + IPC 监听器泄漏（commit `12a3792` 已修复）
- 🟡 4 项代码问题 + 4 项文档问题
- 撤销 1 项误判（clickDownPos 无需清理，pointerdown 始终先于 click）

**已执行（ARCH-03 直接修）**：
1. `pet/pet.html` — 删两行冗余 `<script>` 标签
2. `dashboard/dashboard.html` — 删三行冗余 `<script>` 标签
3. `pet/DESIGN.md` — 台词数 16→28
4. `dashboard/DESIGN.md` — 修正"导航栏由 registry 驱动"描述
5. `main/DESIGN.md` — 补 5 个缺失的 IPC 通道
6. `docs/progress.md` — 修正分支引用 `feature/pet-movement` → `main`

**委派 infra-06**：
1. 新建 `shared/feed-service.js`（FOODS + consumeFood/applyFeed/emitFed）
2. 清理 `main/ipc/pet-ipc.js` 死代码（pet:state:set 被 index.js 覆盖）
3. `main/index.js` 复用 `isValidSnapshot`
4. `pet/pet.js` + `dashboard/dashboard.js` 切换引用（越界授权）
5. 已确认完成，pet-05 和 dash-01 无需再开

**当前全局状态**：
- 工作区有未提交改动（11 个文件），需 commit
- 36→37 commits 待 push
- Phase 1 已知问题：3 🟡 + 3 🟢（全部已确认，无新增）
- 待决策：下一步做什么模块？
