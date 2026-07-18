# 架构窗口交接文档

> 最后更新：2026-07-18（ARCH-07 2048 游戏全部交付）
> Phase 1 全部完成。番茄钟 + 2048 全部交付。代码已推送 origin。

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

### ✅ 已完成（全部在 main 分支）

| 组件 | 窗口 | 备注 |
|------|------|------|
| 基础设施（7 个共享服务） | infra-01~09 | EventBus / PetState / events / module-registry / feed-service / exp-service / satiety-service / overlay-manager / tooltip-manager |
| 宠物移动 + 动画 | pet-01 | CSS 原生拖拽 + 随机走动 + 呼吸/轻晃/waddle 动画 |
| 对话气泡 | pet-02 | 28 条台词 mood×level、300ms 延迟 + 拖拽检测、2s 动画 |
| 窗口缩放 + 高 DPI 修复 | pet-02/03 | 四档缩放(75~150%)、setBounds 原子操作、中心锚点 |
| 双击面板切换 | pet-03 | 双击→toggleWindow→loadFile、面板边缘拖拽缩放 |
| 右键菜单喂食/状态 | pet-04 | 消耗食物→饱腹+亲密度→气泡反馈 |
| 喂食 overlay | pet-05 | FOODS 配置 + foodInventory 数据分离、overlay 选食投喂 |
| 经验系统 | infra-07 + pet-07 | 分段升级/溢出继承/每日上限、互动+喂食经验 |
| 饱腹消耗 | infra-08 | 时间戳差值衰减、离线生效、动态上限、心情联动 |
| 心情系统 | **infra-10** | mood-service.js：0-100 数值、4 档位、衰减/加成/迁移，44 测试 |
| 宠物心情接入 | **pet-08** | 台词池重构(4 tier)、衰减 tick、点击/喂食加心情、经验倍率、旧存档迁移 |
| 面板心情卡片改版 | **dash-05** | emoji+档位文字+进度条+档位标签、修复 MOOD_TIERS 浮点间隙 bug |
| Tooltip 修复 + 仓库交互 | **dash-06/07** | ready-to-show 修复、自动高度、仓库悬停 tooltip + 右键菜单（使用/出售/销毁） |
| 商店页面 | **dash-08** | 金币购买食物、分类 Tab、tooltip + 右键菜单、coins 默认 100 |
| 设置页面 | **dash-09** | tooltip 开关、面板置顶、配置驱动、面板透明度搁置 |
| 面板 RPG 角色卡 | dash-01/02 | 两层布局：形象展示 + 信息数据、经验/饱腹进度条、快速投喂 |
| **面板左侧导航栏** | **dash-03** | nav-config.js 配置驱动、主页/仓库/商店/设置 4 项、多页切换 |
| **仓库页面** | **dash-04** | 分类 Tab（全部/食物/道具）、物品网格、`_pageCleanup` 生命周期 |
| 🍅 番茄钟 | **infra-11 + dash-10 + pet-09** | 主进程状态机 + 面板 SVG 进度环 + 宠物浮动图标 |
| 🎮 2048 | **infra-12 + dash-12** | 收益结算服务（分段+里程碑+心情加成）+ 4×4 游戏（键盘/拖拽/持久化/结算弹窗） |

### ✅ 已完成

Phase 1 宠物核心系统 + 番茄钟 + 2048 全部完成。面板五页（主页/仓库/商店/设置/2048）全部可用。

### 🔨 进行中

无。

### ⏳ 待实现

| 任务 | 说明 |
|------|------|
| 📝 英语单词 | spec 占位，待细化需求 |
| 🌾 农场经营 | spec 占位，待细化需求 |
| 桌宠形象化 + 皮肤系统 | 设计文档已完成，待 Phase 2 |
| 活动监视 | 设计文档已完成，隐私敏感 |
| 躲避光标 | 搁置，需主进程侧方案 |
| 面板透明度设置 | 搁置，CSS 变量无法穿透 transparent:false 窗口 |
| 超市经营 | 待规划 |

### ⏳ 未来模块

单词（Phase 2）、农场（Phase 2）、超市（待规划）、桌宠形象化

---

## 已知问题和交接注意事项

1. ✅ ~~dashboard.html 脚本标签~~ 已加 type="module"
2. ✅ ~~-webkit-app-region: drag 与点击冲突~~ 已解决：`#pet-body` 加 `no-drag`，容器 padding 保留拖拽区域。详见 `docs/pet-movement-design.md` 第 6 节。
3. 🟡 **躲避光标已搁置**：IPC 拉光标延迟高，后续考虑主进程侧实现
4. ✅ ~~PET_STATE_CHANGED 通用事件~~ infra-02 已实现
5. ✅ ~~event-bus.js DEBUG=true~~ ARCH-05 已解决：`let DEBUG` + `setEventBusDebug()`/`isEventBusDebugEnabled()` 导出，默认 true，可运行时切换
6. 🟢 **pet-state.js 直接依赖 window.electronAPI**：全局依赖，限制了单测。暂不改
7. 🟡 **整体覆盖写盘风险**：PetState._save() 是完整快照覆盖，新增持久化字段（如 zoomLevel）需在主进程 pet:state:set handler 中保护，防止被渲染端覆盖冲掉。当前 index.js L159-169 有保护逻辑
8. ✅ ~~喂食逻辑重复~~ infra-06 已解决：抽 `shared/feed-service.js`，导出 FOODS 配置表 + consumeFood/applyFeed/emitFed，pet.js 和 dashboard.js 统一引用
9. 🟡 **loadFile 切换 = 渲染进程重建**：EventBus/PetState 不跨页面，需 flush() 保证落盘。Phase 1 够用；Phase 2 如需面板实时同步宠物状态，考虑主进程持有数据或双 webview
10. 🟢 **旧存档 hunger 字段残留**（infra-05 重命名后）：存量 pet-data.json 的 `hunger` key 不再读取，残留无害。Phase 1 开发阶段清档即可，生产环境需做数据迁移
11. 🟢 **exp 进度条假设 0-100 刻度**：dash-01 `renderLevel()` 把 exp 直接当百分比。后续定下成长曲线后统一调整

---

## 待决策事项

- [x] 宠物做完后，下一个模块做哪个？→ 面板四页全部完成（仓库/商店/设置）
- [x] 仓库页面内容实现
- [x] 商店页面内容实现
- [x] 设置页面内容实现
- [x] 番茄钟 → 全部交付（infra-11 + dash-10 + pet-09）
- [ ] 🟡 old: 游戏模块方向选择（2048 ✅ 已完成 / 单词 / 农场）
- [x] 2048 游戏模块 ✅ 全部交付（infra-12 + dash-12）

---

## 分支状态

| 分支 | 状态 | 说明 |
|------|------|------|
| `main` | ✅ 稳定 | Phase 1 + 番茄钟 + 2048 完成 |
| `origin/feature/pet-movement` | ⏳ 待清理 | 远程残留 |
| `origin/feature/shared-event-bus-pet-state` | ⏳ 待清理 | 远程残留 |

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

## 2026-07-14 — ARCH-04 接替 + 分支清理

**处理事项**：接替 ARCH-03，尝试推送代码 + 清理残留分支。

**已执行**：
1. 本地删除 `feature/pet-movement` 残留分支（已合并入 main，比 main 少 1 commit）
2. `git push origin main` 失败 — 网络不通（`Connection was reset`）
3. 更新 `PROJECT_BRIEF.md` 分支状态表
4. `docs/session-log.md` 登记 ARCH-04

**阻塞项**（等网络恢复）：
- `git push origin main`（68 commits）
- `git push origin --delete feature/pet-movement feature/shared-event-bus-pet-state`

**当前全局状态**：
- main 分支，68 commits 领先 origin/main
- 工作区干净，31 测试通过
- 下一步模块方向待用户决定

## 2026-07-14 — ARCH-04 接收 dash-03

**dash-03 成果**：面板左侧导航栏
- 新建 `dashboard/nav-config.js` — 导航配置数组 + 占位渲染器（原则 5 配置驱动）
- `dashboard/dashboard.js` — buildHomePage / switchPage / buildNavBar / updateNavActive，重构 initStatus
- `dashboard/dashboard.css` — 导航栏暗色主题、选中高亮、占位居中、fade 过渡
- 4 个导航项：🏠 主页（可用）、🎒 仓库（置灰占位）、🛒 商店（置灰占位）、⚙️ 设置（底部固定，置灰占位）
- 3 commits，无越界授权，遵守所有约束

**当前全局状态**：
- main 分支，71 commits 领先 origin/main（68 + 3 from dash-03）
- 工作区有 PROJECT_BRIEF.md 未提交（本记录）
- 下一步：仓库/商店/设置任选一个落地实现？

## 2026-07-14 — ARCH-04 接收 dash-04

**dash-04 成果**：仓库页面 — 分类 Tab 栏 + 物品网格
- `dashboard/nav-config.js` — 新增 `WAREHOUSE_CATEGORIES` 配置数组 + `buildWarehousePage` 渲染器
- `dashboard/dashboard.js` — 仓库页：Tab 切换筛选 + 物品网格渲染 + `PET_STATE_CHANGED` 自动刷新 + `_pageCleanup` 生命周期
- `dashboard/dashboard.css` — Tab 栏暗色主题、`#2196f3` 底部高亮条、CSS Grid 自适应网格、fade 过渡
- `shared/feed-service.js` — FOODS 5 个条目加 `category: 'food'` 字段（越界授权：ARCH-04 直接给）
- **新模式**：`item.render(container)` 可选返回清理函数，`switchPage` 切页时调 `_pageCleanup()`，防止订阅泄漏

**当前全局状态**：
- main 分支，74 commits 领先 origin/main（71 + 3 from dash-04，待提交确认）
- 工作区有未提交改动（dash-04 的 7 个文件 + PROJECT_BRIEF.md）
- 仓库页可用，道具 Tab 置灰占位
- 下一个：商店页面？

## 2026-07-14 — ARCH-04 接收 infra-10

**infra-10 成果**：心情系统共享层 mood-service.js
- `mood-service.js`：8 个纯函数 + MOOD_CONFIG + MOOD_TIERS（原则 5 配置驱动）
- `mood-service.test.mjs`：44 个测试用例，全部通过
- 心情从 string 升级为 0-100 数值：4 档位（happy/good/neutral/low）、自然衰减（按自然日零点分段 + 单日 50 上限）、饱腹<30 衰减翻倍、离线跨天逐日结算
- 经验倍率三档（≥80→1.2x, 50-79→1.0x, <30→0.7x）、低心情互动减半
- `migrateMood()` 兼容旧 string 存档（happy→85, neutral→60, hungry→25, sad→15）
- 越界授权：`store.js`（mood 默认值）、`events.js`（注释更新）、`events.md`（payload 类型）

**待接入**：pet-08（台词池 + 衰减 tick + 互动/喂食加心情）、dash-05（心情卡片改版）

**当前全局状态**：
- 工作区有 14 个文件未提交（dash-04 + infra-10 + pet-08 + bugfix + PROJECT_BRIEF.md）
- 50 测试通过（44 mood + 6 pet-motion）
- 心情系统：infra-10 地基 + pet-08 + dash-05 全部完成
- Tooltip 修复：dash-06（ready-to-show 只触发一次 → did-finish-load/stop+showInactive）+ dash-07（自动高度 fitToContent、loadURL().then()、overlay blur 自动关闭）

## 2026-07-14 — ARCH-04 接收 dash-05

**dash-05 成果**：面板心情卡片改版
- `dashboard/dashboard.js`：删除 MOOD_MAP、重写 `renderMood()`（emoji + 档位文字 + 进度条 + 数值 + 档位标签）
- `dashboard/dashboard.css`：`.card--mood` 新增 `.mood-header` / `.mood-value` / `.mood-tier-badge`
- 🔧 **修复 MOOD_TIERS 浮点间隙 bug**：infra-10 的边界值 79/49/29 导致衰减浮点值（如 79.3）掉入间隙 fallback 到"低落"，改为 80/50/30 消除间隙。这是越界授权修改 `mood-service.js`
- 手动验证 32 项全部 PASS（浮点间隙 9 + 边界重叠 5 + 颜色阈值 6 + 迁移 12）
- 已知小问题：窄窗口（600-700px）时进度条可能被压缩

**心情系统三连窗口全部完成** ✅

**当前全局状态**：
- 工作区有 ~15 个文件未提交（dash-04 + infra-10 + pet-08 + dash-05 + bugfix + PROJECT_BRIEF.md）

## 2026-07-14 — ARCH-04 接收 dash-06 + dash-07

**dash-06**：tooltip 不显示修复
- 根因：`42dafdd` 引入的 `once('ready-to-show')` 在 Electron 中只在首次渲染触发，后续 loadURL 不触发 → tooltip 永远卡在隐藏
- `tooltip-manager.js` 复用路径改为 `stop()+loadURL()+showInactive()`

**dash-07**：仓库物品 tooltip + 右键菜单 + 8 项 bug 修复
- `dashboard/dashboard.js`：仓库 tooltip（mouseenter 捕获 + TOOLTIP_FIELDS 字段驱动）、右键 overlay 菜单（使用/出售/销毁）、`_whContextMenuOpen` 状态机
- `feed-service.js`：FOODS 加 `sellPrice` + `tooltipFields`
- `tooltip-manager.js`：自动高度（`executeJavaScript('scrollHeight')` + `fitToContent`）、`loadURL().then()` 修监听器泄漏
- `overlay-manager.js`：`closeOverlayWindow()` + blur 自动关闭
- `main/index.js` + `main/preload.js`：`overlay:force-close` IPC（面板销毁时清理菜单）
- ⚠️ 越界授权：main 层 4 个文件，ARCH-04 补登记（修复真 bug，提示词未预料）

**当前全局状态**：
- 工作区有 9 个文件未提交（dash-06 + dash-07 + handleFeed 修复 + ARCH-04 文档）
- 50 测试通过
- 仓库物品交互完成：悬停 tooltip（自动高度、字段驱动）+ 右键菜单（使用/出售/销毁、blur 关闭）
- 50 测试通过（44 mood + 6 pet-motion）
- 建议：mood-service.test.mjs 补充浮点值用例（infra-10 测试只测了整数边界）

## 2026-07-14 — ARCH-04 接收 pet-08

**pet-08 成果**：宠物侧接入新心情系统
- `pet/pet.js`：心情系统全面接入（~120 行改动）
  - init() 中 `migrateMood()` 迁移旧 string 存档 → number
  - `settleMoodDecay()`：离线衰减结算，按自然日分段 + 单日 50 上限，饱腹<30 翻倍
  - `grantClickMoodBoost()`：点击互动 +2 心情，每日 20 上限，低心情减半
  - 喂食 +3 心情（`boostMood`）
  - 经验倍率接入（`getExpMultiplier`）
  - 台词池重构：4 档 happy/good/neutral/low，旧 hungry+sad → low 合并
  - `suggestMood` 全部废弃
- `store.js`：DEFAULT_STATE 新增 5 个心情字段（越界授权）
- 踩坑：跨天 `todayAccumulated` 清零导致衰减过量，已修复
- 边界条件 13 项全部验证通过

**待接**：dash-05（面板心情卡片改版）

## 2026-07-14~17 — ARCH-05 审计 + 设计 + 委派

**处理事项**：接替 ARCH-04，审计修复 + 设计讨论 + 委派 dash-11 + 接待 ARCH-06。

**审计修复（5 项）**：

1. **exp-service 测试日期依赖修复**（4 fail → 0 fail）
   - `checkDailyInteraction(count, lastDate, _now)` 新增可选 `_now` 参数
   - 4 个硬编码日期测试改为注入固定日期，跨天不再影响

2. **event-bus.js DEBUG 开关**
   - `const DEBUG` → `let DEBUG` + `setEventBusDebug()` / `isEventBusDebugEnabled()` 导出

3. **docs/progress.md pet-motion 测试路径修正**

4. **删除死代码 `suggestMood`** — `satiety-service.js`，返回旧 string 心情，无人调用

5. **overlay `_reject` → `resolve(null)`** — `did-fail-load` 和其他关闭路径统一

**设计讨论**：

6. 桌宠形象化 B 方案（帧动画）+ 皮肤系统 A 方案（共享进度）→ `pet-customization-design.md`
7. 番茄钟 + 活动监视 → `productivity-modules-design.md`（ARCH-06 已实现番茄钟）

**委派 + 收尾**：

8. 委派 **dash-11**：自动走动从右键菜单迁移到设置面板
9. 接待 **ARCH-06**：Mac 番茄钟交付（infra-11 + dash-10 + pet-09），pull + 审查通过
10. dash-11 收尾：清理 `wander:toggle` 死文档引用（`events.md` + `main/DESIGN.md`）

**测试结果**：93 全绿（56 mood + 6 pet-motion + 31 exp-service）

**当前全局状态**：
- main 分支，工作区干净，93 测试通过
- 番茄钟 ✅（ARCH-06）+ 自动走动设置化 ✅（dash-11）
- 已知 🟡 问题 4 项：躲避光标、写盘风险、loadFile 切换、面板透明度（全部搁置/Phase 2）
- 设计文档就绪：桌宠形象化、皮肤系统、番茄钟、活动监视
- 下一步待用户决定

## 2026-07-16~17 — ARCH-06 番茄钟立项 + 拆窗

**处理事项**：选定番茄钟为 Phase 2 首个模块，讨论需求细节，拆分三窗口 + 两次续窗口。

**讨论确认**：
- 主进程常驻计时，面板开关不影响，退出 App 重置
- 宠物态浮动图标（🍅/☕/⏸ + 倒计时）
- 面板新增"🍅 番茄"导航页（SVG 进度环 + 按钮 + 统计 + 设置）
- 右键菜单动态切换（按 phase 显示不同菜单项）
- 专注 5~120min，休息 1~60min，首期不做长休息
- 设置放在番茄页内部，不放设置页
- 通知走主进程 Electron Notification

**拆窗方案（全部交付）**：
| 窗口 | 状态 | 内容 |
|------|------|------|
| infra-11 | ✅ | 主进程 pomodoro.js + IPC + 右键菜单 + store + events |
| infra-11 续 | ✅ | 时长记录 todayFocusMs/totalFocusMs + dailyLog + getPublicStats 隔离 |
| dash-10 | ✅ | 面板番茄页（SVG 进度环 + 按钮 + 统计 + 设置） |
| dash-10 续 | ✅ | 统计格式"次数 + 时长" |
| pet-09 | ✅ | 宠物浮动图标 + 气泡 |

**全模块共修 8 bug**（全部审查阶段发现修复）：
- infra-11: start 漏推 phase:changed / 右键导航竞态 / 设置无边界校验
- dash-10: tick handler 泄漏 / break+paused data-action 写错 / progress 无 clamp
- pet-09: abort→idle 图标不消失
- infra-11 续: dailyLog 泄漏到渲染进程（getPublicStats 修复）

**新增文件**：`specs/pomodoro.md`

**当前全局状态**：
- main 分支，与 origin/main 同步
- 🍅 番茄钟全部交付，8 窗口（含续），0 越界
- 93 测试通过

## 2026-07-18 — ARCH-07 2048 游戏立项 + 拆窗委派

**处理事项**：选定 2048 为 Phase 2 首个小游戏，逐项讨论确认需求，拆 2 窗口委派。

**讨论确认（9 项）**：
1. 计分：标准 2048（合并值累加）
2. 余数：四舍五入
3. 日限：仅游戏经验不限，保留点互 20 次上限
4. 导航：直接"🎮 2048"，后续多了再二级结构
5. 持久化：导航内切页=恢复 / 关面板=恢复 / 重启=重置；恢复内容=棋盘+分数+GameOver标记；恢复时已死→展示结算弹窗
6. 存档：highScore + milestones + savedGame
7. 重新开始：任意时刻 / 需确认弹窗 / 不计收益
8. 2048 后：继续玩冲更高分
9. 结算按钮：两个按钮都到账

**收益模型**：
- 分数分段递增（200→120→80 exp/分，匹配后期难度）
- 首达阶梯 5 档（128/256/512/1024/2048，终身一次性）
- 心情加成（开心+20%、良好/一般正常、低落-30%）
- 全部配置化，后续调数值改一行

**拆窗方案（全部交付）**：

| 窗口 | 内容 |
|------|------|
| infra-12 | 收益结算共享服务（game-reward-service.js，5 函数 + 3 配置，43 测试）+ store 新增 game2048 |
| dash-12 | 2048 游戏本体（games/2048/ 目录）+ 面板集成（导航 + 结算弹窗 + 持久化 + store.js 重启清除） |

**新增/修改文件**：
- 新建：`specs/game-2048.md`、`src/renderer/shared/game-reward-service.js`、`game-reward-service.test.mjs`
- 新建：`src/renderer/games/2048/2048-game.js`、`2048-ui.js`、`2048.css`、`DESIGN.md`
- 修改：`store.js`（game2048 + 重启清除）、`nav-config.js`、`dashboard.js`
- 修改：`CLAUDE.md`（新增"动工前先报告"规则）

**审查**：136 测试全部通过。两个窗口 0 越界授权。

**当前全局状态**：
- main 分支，工作区干净（已 commit + push）
- 136 测试通过（43 game-reward + 56 mood + 31 exp + 6 pet-motion）
- 🎮 2048 全部交付
- 面板五页全部可用（主页/仓库/商店/设置/2048）
- 下一步待用户决定：单词 / 农场 / 桌宠形象化？

**规则变更**：
- CLAUDE.md "动工前先报告"：每个实现窗口动手前必须先向架构窗口报告功能点、界面布局、涉及数据，确认对齐后再动手
