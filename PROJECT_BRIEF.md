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
- ~工作区有未提交改动（11 个文件），需 commit~ 已提交
- ~36→37 commits 待 push~ 38 commits 待 push
- Phase 1 已知问题：3 🟡 + 3 🟢（全部已确认，无新增）
- 待决策：下一步做什么模块？

## 2026-07-13 — dash-02 RPG 角色卡布局重构

**处理事项**：dash-02 完成面板布局重构，上报确认。

**改动文件**：`dashboard/dashboard.js` `dashboard/dashboard.css` `dashboard/DESIGN.md` `docs/progress.md` `docs/session-log.md`

**内容**：
- 卡片平铺 → 两层 RPG 角色展示式布局
- 上半区：emoji 居中 + 左右各 3 槽位虚线占位（立绘区用独立容器，未来可替换为图片/动画）
- 下半区：info-row--2col / --full / --3col 语义化行容器，`.info-layer` 独立 overflow-y: auto
- 保留所有 card id、render*()、handleFeed()、事件绑定不变

**审查**：dash-02 遵守了约束，只改 buildStatusDOM() 模板 + CSS，蓝图/逻辑未碰。session-log.md 被覆盖一行已修复。

## 2026-07-13 — infra-07 经验系统共享层

**改动文件**：`shared/exp-service.js`（新建）、`shared/exp-service.test.mjs`（新建）、`shared/feed-service.js`（FOODS +exp 字段）、`main/storage/store.js`（DEFAULT_STATE +2 字段）、`docs/progress.md`、`docs/session-log.md`

**越界授权**：`main/storage/store.js` ✅ 已在提示词中授权

**内容**：
- 分段升级公式：新手期(1-5)弱幂次、成长期(6-20)线性、成熟期(21+)低幅固定
- 溢出经验自动继承，maxLevel 30
- 每日互动上限 20 次 × 5exp，本地日期 YYYY-MM-DD 过日归零
- FOODS 各加 exp 字段（cookie:5 / apple:10 / milk:10 / fish:20 / cake:25）
- 31 个测试用例全部通过
- ⚠️ UTC 日期坑：`toISOString().slice(0,10)` 在中国凌晨会错一天，改用 getFullYear/getMonth/getDate

**当前全局状态**：
- 41 commits 待 push
- exp 共享层就绪，pet-07 + dash-01 续已接入完成

## 2026-07-13 — pet-07 + dash-01 续 经验系统接入

**pet-07**（新开）：`pet/pet.js`
- 点击气泡 → grantInteractionExp()，每日 20 次上限，首次超限提示
- 喂食成功 → getFoodExp() → addExp() 结算
- 升级 → showBubble("🎉 升级了！Lv.X！")，连升多级只弹最终等级

**dash-01 续**：`dashboard/dashboard.js` `dashboard/dashboard.css`
- renderLevel() 经验区域改为蓝色进度条，和饱腹条同款样式
- 进度条末尾显示 "当前 / 所需" 数值
- 踩坑：升级所需经验改用 calcRequiredExp(level) 而非原来的 exp 当百分比

**当前全局状态**：
- 49 commits 待 push

## 2026-07-13 — infra-08 + dash-01 续 饱腹消耗系统

**infra-08**（新开）：`shared/satiety-service.js`（新建）、`shared/feed-service.js`、`main/storage/store.js`、`pet/pet.js`
- 时间戳差值结算：避免高频定时器，离线也生效
- calcMaxSatiety = 100 + floor(level/5)×20（每5级+20上限）
- reduceSatiety(satiety, amount) 统一消耗接口，最低 0
- suggestMood() 纯函数，不直接改 PetState
- 在线 60s 定时结算；饱腹 < 30 自动切 hungry；喂食恢复后心情恢复
- feed-service applyFeed 加可选 level 参数（默认 1 向后兼容）

**dash-01 续**：`dashboard/dashboard.js`
- 三处硬编码 100 → calcMaxSatiety(level)
- renderSatiety() 进度条改为百分比计算

## 2026-07-13 — ARCH-03 最终交接

### ARCH-03 完整成果

| 类别 | 窗口 | 内容 |
|------|------|------|
| 审计 | ARCH-03 | 全面审计（10原则+8ADR），发现修6项，撤1项误判 |
| 共享层 | infra-06 | feed-service.js（统一食物配置+喂食逻辑） |
| 共享层 | infra-07 | exp-service.js（经验系统，31测试） |
| 共享层 | infra-08 | satiety-service.js（饱腹衰减系统） |
| 共享层 | infra-09 | tooltip-manager.js（独立BrowserWindow Tooltip） |
| 宠物 | pet-07 | 互动经验+喂食经验+升级气泡 |
| 面板 | dash-02 | RPG角色卡两层布局重构 |
| 面板 | dash-01 | exp蓝色进度条、饱腹上限动态化、食物Tooltip、多次修复 |
| 架构 | ARCH-03 | CLAUDE.md模板+收尾检查清单、session-log按分类重组、FEED_CONFIG重构 |
| 审计 | ARCH-03 | 三轮审计（main/renderer/docs），修6项 |

### 当前全局状态

```
main 分支，67 commits 领先 origin/main（未推送）
工作区干净，37 测试全部通过
22 个窗口全部登记在 session-log.md
```

### 共享层服务总览

| 服务 | 文件 | 职责 |
|------|------|------|
| EventBus | event-bus.js | 模块通信总线 |
| PetState | pet-state.js | 宠物状态管理（init/get/set/subscribe/flush） |
| 事件常量 | events.js | 15 个事件定义 |
| 模块注册 | module-registry.js | 面板导航驱动（当前空，等子模块） |
| 喂食服务 | feed-service.js | FOODS配置 + consumeFood/applyFeed/emitFed |
| 经验服务 | exp-service.js | 升级公式 + 溢出继承 + 每日互动上限 |
| 饱腹服务 | satiety-service.js | 衰减结算 + 最大饱腹值 + 心情建议 |

### 待 ARCH-04 处理

- [ ] **推送 GitHub**：网络恢复后 `git push origin main`（67 commits）
- [ ] **删除远程残留分支**：`origin/feature/shared-event-bus-pet-state`、`origin/feature/pet-movement`
- [ ] **删除本地残留分支**：`feature/pet-movement`（比 main 少 1 commit，已无价值）
- [ ] **决定下一步**：宠物核心系统（喂食/经验/饱腹）已完成，下一个模块？
- [ ] 🟡 **已知问题 #5**：event-bus.js DEBUG=true 生产环境开关
- [ ] 🟡 **已知问题 #7**：整体覆盖写盘风险（Phase 2 升级 SQLite 时解决）
- [ ] 🟡 **已知问题 #9**：loadFile 切换 = 渲染进程重建（Phase 2 考虑双 webview）
- [ ] 🟢 **低优先级**：constants.js/utils.js 空占位、storage-ipc.js 空占位、coins 字段有 UI 无逻辑
- [ ] 🟢 **docs/superpowers/** 目录为自动生成，是否纳入 .gitignore

### ARCH-03 重要设计决策

1. **原则 5 深化**：FEED_CONFIG / EXP_CONFIG / SATIETY_CONFIG 全部配置化，和 EXP_CONFIG 同级
2. **Tooltip vs Overlay**：tooltip 不复用 overlay-manager，走独立轻量 IPC 通道（fire-and-forget + data:URL）
3. **饱腹衰减用时间戳差值**：避免高频定时器，离线也生效，比 setInterval 方案更优
4. **最大饱腹值随等级增长**：`calcMaxSatiety = 100 + floor(level/5)×20`，applyFeed 向后兼容
5. **新窗口启动模板**：末尾加"先讨论，商量出结果后再行动"；架构窗口加"每改动同步文档"
6. **收尾检查清单**：每个实现窗口结束需逐项完成代码合规自查 + 改动总结 + 文档同步 + 上报架构窗口

### 协作提醒

- 所有新功能从 main 切 feature 分支，不要直接在 main 改
- 实现窗口超过模块边界改文件 → 必须在 session-log 登记越界授权
- 每开新窗口/做完改动 → 同步 PROJECT_BRIEF、progress、session-log
- 具体设计细节在实现窗口内讨论，架构窗口只锁死方向
