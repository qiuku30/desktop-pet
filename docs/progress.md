# 开发进度

> 每次会话结束时更新此文件。
> 当前分支：main

---

## 总体进度

| 模块 | Phase | 状态 |
|------|-------|------|
| 🐾 宠物系统 | Phase 1 | ✅ 已完成 |
| 🎨 桌宠形象化 | Phase 2 | ✅ pet-12 Canvas 动画 + dash-13 portrait；ui-fix-01 比例/flex、pet-fix-02 启动物种闪变已修复 |
| 🍅 番茄钟 | Phase 2 | ✅ 已完成 |
| 📝 英语单词 | Phase 2+ | ⏳ 待定 |
| 🎮 2048 | Phase 2 | ✅ 已完成 |
| 🌾 农场经营 | Phase 2+ | 🚧 设计与六阶段计划已提交；farm-01 已通过 ARCH-10 独立复验 |
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
| docs/architecture.md | ✅ | 8 条 ADR |
| docs/conventions.md | ✅ | 含禁止跨模块 import |
| docs/events.md | ✅ | 14 个事件，含参数和触发时机 |
| docs/progress.md | ✅ | 本文件 |
| specs/pet-system.md | ✅ | 功能 + 交互 + 验收标准 |

### 主进程 (src/main/)

| 任务 | 状态 | 备注 |
|------|------|------|
| index.js — 窗口创建 + 模式切换 | ✅ | 单窗口双状态 + 右键菜单 + IPC；isAutoMoving 标记区分自动/用户拖拽；move 事件推送 user:drag |
| preload.js — 安全 IPC 桥接 | ✅ | contextBridge；moveWindow / getWindowPosition / getCursorPos / onUserDrag |
| store.js — 统一数据存取层 | ✅ | JSON 文件，initStore/getState/setState；新增 game2048 数据结构（highScore/milestones/savedGame） |
| ipc/pet-ipc.js — 宠物 IPC | ✅ | 导出 registerPetIPC(ipcMain)；整体覆盖写盘 + 空快照保护；已接线 |
| ipc/storage-ipc.js — 存储 IPC | ⏳ | 占位，待实现 |
| overlay-manager.js — 通用悬浮面板 | ✅ | showOverlayWindow + initOverlayIPC + Promise Map；同一时间单例 |
| tooltip-manager.js — tooltip 独立窗口 | ✅ | showTooltipWindow + hideTooltipWindow + closeTooltipWindow；data:URL 直出无 preload；focusable:false 不抢焦点 |

### 渲染进程 — 共享层 (src/renderer/shared/)

| 任务 | 状态 | 备注 |
|------|------|------|
| events.js — 事件常量 | ✅ | 14 个事件常量 |
| module-registry.js — 模块注册表 | ✅ | pet-status 已注册 |
| event-bus.js — 事件总线核心 | ✅ | on(返回取消函数)/off/once/emit，逐个 try-catch 隔离，DEBUG 日志 |
| pet-state.js — 宠物状态管理器 | ✅ | 薄：init/get(副本)/set(映射发事件+防抖存盘)/subscribe/flush(立即写盘) |
| constants.js | ⏳ | 占位 |
| utils.js | ⏳ | 占位 |
| feed-service.js | ✅ | FOODS 配置表 + consumeFood / applyFeed / emitFed；消除 pet.js 和 dashboard.js 重复配置；FOODS 加 exp 字段 |
| exp-service.js | ✅ | 经验计算服务：分段升级公式（新手1-5/成长6-20/成熟21+）、溢出继承、每日互动上限 20 次、maxLevel 30 |
| satiety-service.js | ✅ | 饱腹值消耗服务：时间戳差值衰减（0.2/min，8h一轮）、离线生效、动态最大饱腹值（每5级+20）、心情建议（<30→hungry）、主动消耗接口 |
| mood-service.js | ✅ | 心情系统服务（infra-10）：0-100 数值替换旧 string、自然衰减（饱腹<30 翻倍 2/15）、按自然日分段+单日 50 点上限、离线跨天逐日结算、经验倍率三档、低心情互动减半、migrateMood 兼容旧存档、8 函数全部纯函数 |
| game-reward-service.js | ✅ | 2048 收益结算服务（infra-12）：分数分段递减（0~1000/1001~3000/3000+ 三档兑换率）、首达阶梯奖励（128/256/512/1024/2048 终身一次性）、心情倍率四档（≥80→1.2/<30→0.7/其他→1.0）、先汇总再乘、43 个测试全部通过 |

### 渲染进程 — Overlay (src/renderer/overlay/)

| 任务 | 状态 | 备注 |
|------|------|------|
| overlay.html — 骨架 | ✅ | handle（drag）+ content（no-drag） |
| overlay.js — 逻辑 | ✅ | 配置注入 + 事件委托 data-overlay-result |
| overlay.css — 样式 | ✅ | 透明背景 + 毛玻璃 + 暗色主题 |

### 渲染进程 — 宠物 (src/renderer/pet/)

| 任务 | 状态 | 备注 |
|------|------|------|
| pet.html — 宠物窗口结构 | ✅ | pet-12：透明 Canvas + Emoji 失败回退；pet-fix-02：静态 idle 首帧启动层，初始 DOM 不显示 Emoji |
| pet.js — 宠物逻辑 | ✅ | 状态机：原生拖拽 / 随机走动 / 对话气泡 / 双击面板 / PetState / 喂食；pet-12 七类语义动作；pet-fix-02 接入 loading/ready/error 启动视觉与销毁防迟到回调 |
| pet-motion.mjs — 纯几何计算 | ✅ | distance/isCursorNear/fleeCenter/wanderTarget/中心↔左上角换算；node --test pet-motion.test.mjs 6/6 |
| pet.css — 宠物样式 | ✅ | 透明背景 + padding 拖拽手柄 + no-drag；Canvas 不叠加 CSS 动画，breathe/sway/waddle 仅用于 Emoji 回退 |
| pet-animation-runtime.mjs + test | ✅ | pet-12：清单加载/形态选择/七动作预加载、fallback 单次语义、自动移动竞态守卫、level-up 感知的去重一次性动作队列、sleep/sad 调度、朝向、resize、失败销毁；20 项接入测试 |
| pet-startup-visual.mjs + test | ✅ | pet-fix-02：静态首帧→Canvas→Emoji 三态、0.6/anchor 同源几何、resize、失败与 destroy 竞态；10 项测试 |
| DESIGN.md | ✅ | 已细化：移动状态机、动画运行时、七动作映射、用户闲置语义、Canvas 回退与生命周期 |

### 渲染进程 — 面板 (src/renderer/dashboard/)

| 任务 | 状态 | 备注 |
|------|------|------|
| dashboard.html — 面板框架 | ✅ | 顶部栏（标题 + 关闭按钮）+ 导航 + 内容区 |
| dashboard.js — 面板逻辑 | ✅ | 窗口切换 + 边缘拖拽缩放 + 光标控制（RAF 循环）；buildStatusDOM() 重构为 RPG 角色卡两层布局；dash-06 修 tooltip 不显示/闪烁/Mojo 报错 |
| dashboard.css — 面板样式 | ✅ | 顶部栏（标题 drag + 关闭按钮）+ 两层布局（portrait-layer + info-layer）+ 暗色主题 |
| 宠物状态展示卡片 | ✅ | 等级/经验/心情/饱腹/亲密度/金币/食物库存 + 快速投喂；上半区形象展示+下半区信息数据 |
| 左侧导航栏 + 多页切换 | ✅ | dash-03：nav-config.js 配置驱动（原则5）、4 项导航（主页/仓库/商店/设置）、占位页面（即将开放）、暗色主题 + 选中高亮（#2196f3 左边框）+ fade 动画 |
| 仓库页面 | ✅ | dash-04：分类 Tab 栏（全部/食物/道具）+ 物品网格（emoji + 名称 + 数量）+ 订阅生命周期管理（防泄漏）+ FOODS 加 category 字段 + 暗色主题 + fade 过渡 |
| 仓库物品 tooltip + 右键菜单 | ✅ | dash-07：悬停 tooltip（照搬主页 mouseenter/mouseleave 模式，字段驱动 TOOLTIP_FIELDS 扩展）+ 右键 overlay 菜单（使用/出售/销毁，WH_MENU_ACTIONS 配置驱动，show/hide 函数控制显示/置灰）+ FOODS 加 sellPrice + tooltipFields 字段 |
| 心情卡片改版 | ✅ | dash-05：emoji + 档位文字 + 进度条 + 档位标签；迁移旧 string 存档→number；三色进度条（和饱腹条同款）；水平单行布局 |
| 商店页面 | ✅ | dash-08：金币余额栏 + 分类 Tab（复用仓库组件）+ 商品网格（buyPrice 从低到高）+ 购买按钮（金币不足置灰）+ 悬停 tooltip（buyPrice 替换 sellPrice）+ 右键购买菜单 + 状态订阅自动刷新；FOODS 加 buyPrice 字段；store.js coins 默认 100 |
| 设置页面 | ✅ | dash-09：首期 2 个设置项（悬浮提示开关/面板置顶），配置驱动，Tab 分组，即时生效+自动保存；IPC send/on 置顶；扩展预留 reset 按钮 + unlockLevel/disabled 字段。面板透明度已搁置（见已知问题）。dash-11：「自动走动」从右键菜单移入设置面板窗口 Tab，pet.js 改从 PetState settings 读取 + PET_STATE_CHANGED 订阅感知变更
| DESIGN.md | ✅ | 已细化：两层布局结构、行容器语义化 class、滚动策略 |

### 主进程 — 番茄钟 (src/main/pomodoro.js)

| 任务 | 状态 | 备注 |
|------|------|------|
| pomodoro.js — 状态机 + 计时器 | ✅ | infra-11：idle/focus/break 三态，setInterval 1000ms tick，phase 切换自动通知，统计含 streak + 时长（todayFocusMs/totalFocusMs）+ dailyLog（按日明细，365 天自动清理） |
| store.js — pomodoroStats + 设置项 | ✅ | pomodoroStats (todayCount/todayFocusMs/todayDate/totalCount/totalFocusMs/streakDays/lastCompletedDate/dailyLog) + pomodoroFocusMin:25 / pomodoroBreakMin:5 |
| preload.js — pomodoro 命名空间 | ✅ | getState/command/updateSettings/onTick/onPhaseChange/onNavigate |
| index.js — IPC 接线 + 右键菜单 | ✅ | 三个 IPC 通道；右键菜单按 phase 动态切换（idle 插入入口 / focus-break 替换全部） |
| events.js — 事件常量 | ✅ | POMODORO_TICK / POMODORO_PHASE_CHANGED |
| 番茄页面（渲染进程） | ✅ | dash-10：SVG 进度环 + 倒计时 + 操作按钮（开始/暂停/继续/跳过/放弃/结束）+ 统计三列（今日/总计含时长 1h 15m 格式 + 连续天数）+ 设置输入框（仅 idle 可改） |
| 宠物浮动图标 + 气泡 | ✅ | pet-09：🍅/☕/⏸ + MM:SS 浮动在宠物上方；onTick 每秒更新；onPhaseChange break→focus 弹出"继续加油！💪" |

### 渲染进程 — 游戏模块 (src/renderer/games/2048/)

| 任务 | 状态 | 备注 |
|------|------|------|
| 2048-game.js — 纯游戏逻辑 | ✅ | dash-12：createGame/move/isGameOver/maxTileOf/serialize/deserialize，6 个导出纯函数 |
| 2048-ui.js — DOM + 事件 + 集成 | ✅ | dash-12：mount/unmount/saveBeforeClose；键盘方向键 + 鼠标拖拽双操作；PetState 持久化；结算弹窗（调 game-reward-service）；重新开始确认弹窗 |
| 2048.css — 游戏样式 | ✅ | dash-12：暗色主题对齐面板，12 级方块颜色，字号递减，弹出动画，结算/确认弹窗样式；运行时由 JS 动态注入 |
| DESIGN.md | ✅ | dash-12：组件树、数据流、状态机、持久化策略、接口契约 |
| nav-config.js — 导航项 | ✅ | dash-12：新增 🎮 2048，排在番茄下方 |
| dashboard.js — 面板集成 | ✅ | dash-12：import + buildGame2048Page + initStatus 注册 + 关闭按钮 saveBeforeClose 钩子 |
| store.js — 重启清除存档 | ✅ | dash-12：initStore 中清除 game2048.savedGame，防跨会话恢复旧局 |

---

## 🎨 桌宠形象化 — Phase 2

> ARCH-08 于 2026-07-24 完成需求和架构设计；pet-10~12、dash-13 及两项专项修复均已交付，奶油星团现已覆盖桌宠态和面板态。

| 任务 | 状态 | 备注 |
|------|------|------|
| 首发角色方向 | ✅ 设计确认 | 原创“奶油星团”：高清手绘 Q 版团子兽 + 少量星灵特征 |
| 动画范围 | ✅ 设计确认 | idle / walk / eat / happy / sad / interact / sleep |
| 素材协议 | ✅ 设计确认 | 独立透明 PNG/WebP 帧 + 版本化 JSON 清单 |
| 动画架构 | ✅ 设计确认 | pet.js 业务映射 → AnimationController → Canvas FrameRenderer |
| 形态与皮肤 | ✅ 设计确认 | 首期单形态，预留进化；养成进度共享 |
| pet-10 实施计划 | ✅ ARCH-08 | 只做可单测动画基础设施，不接 UI/PetState/正式素材 |
| 角色概念定稿 | ✅ pet-11 | 正/侧面视觉基准、配色、禁止漂移项和七类动作关键姿态 |
| 正式角色素材包 | ✅ pet-11 / ARCH-08 | portrait + 52 张 512×512 透明 WebP + schema v1 pet.json；完整 alpha 审计、三背景联系表和 ARCH-08 独立肉眼验收通过 |
| 动画基础设施 | ✅ pet-10 | 清单校验 + 帧时间 + Canvas FrameRenderer + AnimationController；尚未接 UI |
| 动画引擎接入 | ✅ pet-12 | Canvas + Emoji 回退；七类动作、喂食升级 eat→happy、方向翻转、用户闲置 sleep、低心情 sad、高 DPI/四档缩放及销毁清理 |
| 面板立绘接入 | ✅ dash-13 / ui-fix-01 | 使用 cream-star/portrait.webp 替换 Emoji；专项修复正确 flex 层收缩、完整 contain 与 `onerror` 回退 |
| 用户照片生成 | ⏸ 长期 | 本期不做，只预留标准皮肤包协议 |

设计文档：`docs/superpowers/specs/2026-07-24-pet-visualization-design.md`
实施计划：`docs/superpowers/plans/2026-07-24-pet-animation-foundation.md`

---

## 待实现（按优先级）

0. ✅ 桌宠形象化 Phase 2 — pet-12 已完成桌宠态 UI 接入，dash-13 已完成面板 portrait 接入；ui-fix-01 与 pet-fix-02 已完成专项修复
1. ~~`pet.js` + `pet.css` — 宠物外观、动画、交互~~ ✅ 已完成（移动系统：拖拽/走动/躲鼠标/闲置）
4. ~~`dashboard.js` + `dashboard.css` — 面板切换和模块加载~~ ✅ 已完成（双击切换 + loadFile + 顶部栏 + 返回按钮）
5. ~~对话气泡系统~~ ✅ 已完成（mood×level 台词库 16 条、300ms 延迟 + 拖拽检测、2s 气泡动画、窗口动态缩放、右键缩放菜单）
6. ~~右键菜单交互 — 喂食/状态（IPC 对接）~~ ✅ 已完成（pet-04）
7. ~~面板状态页（宠物属性展示）~~ ✅ 已完成（dash-01）

---

## 暂缓

- 单词模块 (Phase 2)
- 农场模块：farm-01 库存与状态基础已验收；farm-02 领域引擎已通过 ARCH-10 第三轮独立复验并以 `ad0da91` 提交；farm-03 农田与建筑 UI 已获授权创建，farm-04～06 待逐阶段授权与分窗
- 超市模块 (待规划)
- 窗口边框攀爬 (Phase 2)
- 模块错误隔离 (Phase 3)
- 躲避光标（搁置，IPC 延迟高，后续可考虑在主进程侧做）

---

## 已知问题

- [x] 🔴 **已修复（pet-fix-02）**：桌宠启动先显示猫 Emoji，再切换奶油星团。
      根因是旧 DOM 默认显示 fallback，Canvas 需等待 manifest 与 52 帧完成后才隐藏它。
      修复为 `idle/001.webp` 静态首帧 → Canvas；仅静态图或动画加载失败时显示 Emoji。
      静态图与 Canvas 共用 `scale: 0.6` / anchor `(0.5, 0.92)` 的锚点矩形公式，
      并用集中三态和 destroy 守卫处理缩放、页面往返及迟到回调。

- [x] 🔴 **已修复（ui-fix-01）**：pet-11 清单 `scale: 1` 使 Canvas 角色视觉过大；
      dash-13 仅在内部 `.portrait-area` 设置 `min-height: 0`，直接纵向 flex 子项
      `.portrait-layer` 仍被 512×512 图片固有高度撑开，且中央区未拉伸导致立绘裁切。
      修复：base form 精确改为 `scale: 0.6`；`.portrait-layer` 增加 `min-height: 0`，
      `.portrait-area` 增加 `align-self: stretch`。53 条 portrait/布局断言及
      Electron 800×600、600×400、拖大/拖小、四档宠物缩放复验通过。

- [x] 🔴 **关键（已修复）**: JS 拖拽持续偏移。根因：IPC（renderer → setPosition）每帧有延迟，无法追上用户拖拽速度。
      解决方案：CSS `-webkit-app-region: drag`（OS 原生拖拽，零延迟零偏移）+ 主进程 `isAutoMoving` 标记区分自动/用户移动。

- [x] 🔴 **关键**: pet.html 的 `<script>` 标签缺少 `type="module"`。~~已修复~~
      三个 `<script>`（event-bus.js、pet-state.js、pet.js）均已加 `type="module"`。

- [x] 🔴 **关键（已修复）**: dashboard.html 的 `<script>` 标签缺少 `type="module"`。
      和 pet.html 同样的 bug，加 `type="module"` 解决。
- [x] 🟡 **已修复**: `#pet-container` 使用 `-webkit-app-region: drag` 会拦截子元素的 `click` 事件。
      解决方案：`#pet-body` 加 `-webkit-app-region: no-drag`，`#pet-container` 加 `padding: 15px` 保留边框拖拽区域。
      同时：窗口尺寸改为动态（基准 200px × scaleFactor × 用户缩放），右键菜单增加缩放四档（0.75/1/1.25/1.5x），zoomLevel 持久化保护。

- [ ] 🟡 **搁置**: 面板透明度无效。面板窗口 `transparent: false`，CSS `--panel-opacity` 无法穿透到桌面。
      如需恢复：① DASHBOARD_MODE.transparent = true + frame: false  ② html 背景改透明  ③ 自己画标题栏和关闭按钮  ④ 拖拽区域重新适配。相关代码已移除，滑块组件保留可复用。

---

## 待授权（下一轮）

- [x] `events.js`: 新增 `PET_STATE_CHANGED` 通用事件，payload `{ key, value }`
      用途：面板/新模块不 care 具体哪个 key，只想知道「宠物状态变了」，监听一个即可。
      配合 `pet-state.js` 的 `set()`：每个 key 都额外发此事件（监听方自行按 key 过滤）。
      ✅ infra-02 已实现。

---

## 设计决策记录 — event-bus.js / pet-state.js（本轮）

**event-bus.js**
- API：`on`（返回取消订阅函数）/ `off` / `once`（触发一次自动移除，也返回取消函数）/ `emit`
- 错误隔离：`emit` 逐个调用监听器，每个包 try-catch，单个报错只 `console.error`，不影响其他监听器与 emit 方（ADR-006）
- 遍历前复制监听器数组，防止回调里 on/off 改动导致漏发/重复
- `let DEBUG = true` 开关（ARCH-05：`const` → `let`，新增 `setEventBusDebug()`/`isEventBusDebugEnabled()` 导出，可运行时切换）
- 单例导出 `EventBus`

**pet-state.js（薄）**
- 职责：纯 key-value 存储 + 发事件 + 防抖存盘；**不含升级逻辑**（升级由宠物模块自己算好再 `set('level', n)`）
- API（严格按 ADR-005）：`async init()` / `get(key)` / `set(key, value)` / `subscribe(event, cb)`
- `init()`：启动时 await 一次，走 `getPetState()` 把存档灌进内存
- `get()`：对象/数组返回**副本**，防止外部绕过 `set()` 篡改内部状态（ADR-005）
- `set()`：改内存 → 按映射发事件 → 防抖存盘
  - key→事件映射：`satiety`→`PET_SATIETY_CHANGED{value}`、`mood`→`PET_MOOD_CHANGED{mood}`、`level`→`PET_LEVEL_UP{level}`（payload 字段名对齐 docs/events.md）
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

---

## 设计决策记录 — 对话气泡 + 窗口动态缩放（2026-07-12）

**对话气泡**
- 台词库：~16 条，按 `心情(happy/neutral/hungry/sad)` × `等级(low 1-3 / mid 4-6 / high 7+)` 分层
- 交互：单击 `#pet-body` → 300ms 延迟（为双击预留）→ 弹出气泡；`pointerdown`/`click` 位移 > 3px 视为拖拽不出气泡
- DOM：`#speech-bubbles` 内动态创建 `.speech-bubble`，`flex-direction: column-reverse` 垂直堆叠
- 动画：`@keyframes bubble-pop` 2s ease-out，`animationend` 移除 DOM，`setTimeout` 2500ms 兜底
- no-drag：`#pet-body` 加 `-webkit-app-region: no-drag` 让 click 穿透，父级 padding 保留拖拽区域

**窗口动态缩放**
- 尺寸公式：`getPetSize() = 200 × screen.scaleFactor × zoomLevel`
- 锁定：`lockPetSize()` 用 `min=max` 硬锁定（`resizable:false` + `setBounds` 在 Windows 上不可靠）
- 缩放：右键菜单四档 radio（75/100/125/150%），`applyZoom()` 保持位置不变 + 持久化到 store
- 持久化保护：`pet:state:set` handler 在 index.js 重注册，防止渲染端整体覆盖写盘冲掉 zoomLevel
- 响应式：所有 CSS 尺寸从固定 px → vw 单位，窗口变大内容等比放大

---

## 设计决策记录 — 双击面板切换 + 高 DPI 修复（2026-07-12）

**双击面板切换**
- 交互：pet.js `click` 中 `if (clickTimer)` 分支（300ms 内第二次点击）→ `window.electronAPI.toggleWindow()`
- 主进程：`switchToDashboard()` 保存 `savedPetBounds` + `loadFile(dashboard.html)`；`switchToPet()` 恢复位置 + `loadFile(pet.html)`
- 面板：顶部栏（标题 "摸鱼面板" + ❌ 关闭按钮），关闭按钮调用 `toggleWindow()` 回到宠物态
- pet.js 重初始化：`loadFile` 重新执行脚本，`PetState.init()` 幂等安全，走动从当前位置恢复

**高 DPI 三连修复**（ADR-008）
- **bug 1 — 走动时窗口越变越大**：`window:move` handler 从 `setPosition(x,y)` 改为 `setBounds({x,y,width,height})`，原子设位置+尺寸。用 `currentPetSize` 变量不用 `getSize()`（后者会被漂移污染）
- **bug 2 — 缩放时窗口瞬移**：`applyZoom()` 从左上角锚点 → 中心锚点（`cx = x + w/2` → 新尺寸反推左上角）
- **bug 3 — 切面板瞬移**：`switchToDashboard()` 保存 `savedPetBounds`，`switchToPet()` 恢复（不再无脑 `center()`）
- `currentPetSize` 三处同步：`createWindow` / `applyZoom` / `switchToPet`

**wanderEnabled 开关**
- ~~右键菜单新增 "自动走动" checkbox，主进程 `wanderEnabled` 变量 + `wander:toggle` IPC 推送到渲染端~~（dash-11 已迁移到设置面板）

---

## 设计决策记录 — Overlay 通用悬浮面板（infra-03, 2026-07-12）

- **架构**：独立 BrowserWindow（parent=宠物窗口），frameless transparent alwaysOnTop skipTaskbar resizable:false
- **API**：`showOverlay({ html, width, height, x, y })` → Promise\<result\>
- **定位**：x/y 为相对父窗口左上角偏移量
- **拖拽**：CSS `-webkit-app-region: drag`（对齐 ADR-007）
- **关闭**：仅手动关闭（点 `[data-overlay-result]` 按钮）
- **单例**：同一时间只允许一个 overlay
- **IPC 通道**：`overlay:show` / `overlay:config:get` / `overlay:close`
- **容错**：`did-fail-load` 处理加载失败不挂 Promise；`closed` 事件 resolve null 清理
- **详见**：`docs/overlay-design.md`

---

## 设计决策记录 — PetState.flush() 跨页面状态同步（infra-04, 2026-07-13）

- **问题**：PetState._save() 有 500ms 防抖，喂食后立即切面板时存档未落盘。EventBus 不跨页面（新页面 loadFile 重建 PetState 实例），新实例的 init() 读到旧数据。
- **方案**：新增 `flush()` 方法 — 清除防抖计时器（如果有）→ `await this._save()` 立即写盘。幂等、可选、不替代防抖机制。
- **调用点**：
  - `pet.js` `onMenuStatus`：右键"状态"→`await PetState.flush()`→`toggleWindow()`
  - `dashboard.js` `btn-close`：✕按钮→`await PetState.flush()`→`toggleWindow()`
  - 喂食 overlay `__warehouse__` 路径也需要 flush() — pet-06 修复：在 toggleWindow() 前加 `await PetState.flush()`，确保喂食后的库存/饥饿/亲密度变更落盘后再切面板。

---

## 设计决策记录 — exp-service.js（infra-07, 2026-07-13）

**新增文件**：`src/renderer/shared/exp-service.js` — 经验计算纯服务，配置驱动，不碰 PetState。

**升级公式（分段控速曲线）**：
- 新手期（1-5级）：`60 × level^1.25`，弱幂次，快速正反馈
- 成长期（6-20级）：`110 × level - 190`，线性增长，节奏稳定
- 成熟期（21-30级）：`150 × level - 990`，低幅增量，长期无压力
- 最大等级 30（当前版本），`calcRequiredExp(30)` 返回 `Infinity`

**核心函数**：
- `calcRequiredExp(level)` — 升到下一级所需经验
- `addExp(exp, level, amount)` — 加经验，溢出自动继承，可连升多级
- `checkDailyInteraction(count, lastDate)` — 每日互动上限检查（20 次），过日归零
- `getFoodExp(food)` — 从食物配置取经验值

**经验获取渠道**：
| 渠道 | 经验 | 每日上限 |
|------|------|----------|
| 互动（点击气泡等） | +5/次 | 20 次 |
| 喂食 | 按食物 exp 字段 | 无上限 |

**食物经验值**（`feed-service.js` FOODS 表新增 `exp` 字段）：
| 食物 | exp |
|------|-----|
| 🍪 饼干 | 5 |
| 🥛 牛奶 | 10 |
| 🍎 苹果 | 10 |
| 🐟 小鱼干 | 20 |
| 🍰 蛋糕 | 25 |

**store.js 新默认字段**：`dailyInteractionCount: 0`、`lastInteractionDate: null`

---

## 设计决策记录 — satiety-service.js（infra-08, 2026-07-13）

**新增文件**：`src/renderer/shared/satiety-service.js` — 饱腹值消耗纯服务，配置驱动，不碰 PetState。

**核心参数**（`SATIETY_CONFIG`）：
| 参数 | 值 | 说明 |
|------|-----|------|
| `decayPerMinute` | 0.2 | 100→0 ≈ 8.3h，约一个工作日一轮 |
| `hungerThreshold` | 30 | 低于此值建议 mood='hungry'（约 2.5h 缓冲） |
| `onlineTickMs` | 60000 | 在线结算间隔 60s |
| `baseMaxSatiety` | 100 | Lv1 基础最大饱腹值 |
| `maxSatietyPer5Levels` | 20 | 每 5 级 +20 上限 |

**最大饱腹值增长表**（`calcMaxSatiety(level)`）：
| 等级 | 上限 |
|------|------|
| 1-4 | 100 |
| 5-9 | 120 |
| 10-14 | 140 |
| 15-19 | 160 |
| 20-24 | 180 |
| 25-29 | 200 |
| 30 | 220 |

**核心函数**：
- `calcMaxSatiety(level)` — 100 + floor(level/5) × 20
- `calcDecay(lastUpdate, now)` — 时间戳差值 → 应扣饱腹值
- `reduceSatiety(satiety, amount)` — 主动消耗，最低 0
- `suggestMood(satiety, currentMood)` — <30→hungry / 恢复→neutral / 否则不变

**工作原理**：
1. **离线衰减**：`pet.js init()` 中 `PetState.init()` 后立即 `settleSatietyDecay()`，用 `lastSatietyUpdate` 和当前时间差值一次性结算。首次启动（lastSatietyUpdate=null）初始化时间戳，不扣。
2. **在线定时**：`startSatietyTick()` 每 60s 调用 `settleSatietyDecay()`，时间戳差值保证精度不受定时器漂移影响。
3. **喂食恢复**：喂食后调用 `boostMood(currentMood, MOOD_CONFIG.feedBoost)` 加心情（pet-08 已切换，不再使用 `suggestMood`）。

**关联改动**：
- `store.js` DEFAULT_STATE 加 `lastSatietyUpdate: null`
- `feed-service.js` `applyFeed` 新增可选 `level` 参数（默认 1），上限由硬编码 100 → `calcMaxSatiety(level)`，向后兼容 `dashboard.js`
- `pet.js` 新增 `settleSatietyDecay()` / `startSatietyTick()`，喂食逻辑改用动态上限 + 心情恢复

---

## 设计决策记录 — mood-service.js（infra-10, 2026-07-14）

**新增文件**：`src/renderer/shared/mood-service.js` — 心情纯计算服务，配置驱动，不碰 PetState。

**核心参数**（`MOOD_CONFIG`）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `decayPerMinute` | 1/15 | 饱腹≥30：每 15 分钟降 1 点 |
| `decayPerMinuteHungry` | 2/15 | 饱腹<30：翻倍，每 7.5 分钟降 1 点 |
| `dailyDecayCap` | 50 | 单日自然衰减上限（用户确认值） |
| `hungerAccelThreshold` | 30 | 饱腹低于此触发加速（对齐 satiety-service） |
| `initialMood` | 70 | 新存档默认心情值 |

**核心函数**（8 个，全部纯函数）：

| 函数 | 签名 | 说明 |
|------|------|------|
| `getMoodTier(mood)` | number → { tier, label, emoji, min, max } | 数值→档位（happy/good/neutral/low） |
| `calcMoodDecay(lastUpdate, now, isHungry, todayAccumulatedDecay)` | (string\|null, string, boolean, number) → number | 按自然日零点分段结算，逐日 apply 50 点上限；isHungry 切换速率；首次启动不扣 |
| `reduceMood(mood, amount)` | (number, number) → number | 减少心情，最低 0 |
| `boostMood(mood, amount)` | (number, number) → number | 增加心情，最高 100 |
| `getExpMultiplier(mood)` | number → number | ≥80→1.2, 50-79→1.0, <30→0.7 |
| `getClickBoost(mood)` | number → number | <30→减半，否则全量 |
| `migrateMood(oldMood)` | string\|number\|undefined → number | 旧 string 映射（happy→85/neutral→60/hungry→25/sad→15），number 直通 + clamp，null/undefined→70 |
| `clampMood(mood)` | number → number | clamp 到 0-100 |

**心情档位**（`MOOD_TIERS`）：

| tier | label | 范围 | emoji |
|------|-------|------|-------|
| happy | 开心 | 80-100 | 😊 |
| good | 良好 | 50-79 | 🙂 |
| neutral | 一般 | 30-49 | 😐 |
| low | 低落 | 0-29 | 😢 |

**离线结算算法**：
1. 将 `[lastUpdate, now]` 按本地时间 00:00 分界切成若干段
2. 每段：`min(段分钟数 × 速率, 当日剩余额度)`；段 1 的当日额度 = `50 − todayAccumulatedDecay`
3. 跨入新一天：当日额度重置为满额 50
4. 返回各段实扣之和

**关联改动**：
- `store.js` DEFAULT_STATE：`mood: 'neutral'` → `mood: 70`
- `events.js`：`PET_MOOD_CHANGED` 注释更新 payload 为 `{ mood: number, tier: object }`
- 后续 `pet-08` / `dash-05` 负责接入 PetState 和 UI
- `satiety-service.js` 的 `suggestMood()`（返回旧 string）已废弃，pet-08 已切换所有调用到 mood-service ✅ ARCH-05 已删除死代码
- ✅ **pet-08 已完成**（2026-07-14）：宠物侧全部接入（迁移、衰减、点击/喂食加成、经验倍率、台词重构）

---

## 🌾 农场经营 — farm-01 库存与状态基础（2026-07-26）

- ✅ 新增通用库存纯服务：规范化、查询、可扣减判断、不可变增减和缺货原子失败；加法合计不是正的安全整数时抛 `RangeError`，整批不返回部分库存。
- ✅ 旧 `foodInventory` 幂等迁移到 `inventory`；五个现有食物映射到 `food:*`，合法未知字符串 ID 以 `legacy:*` 保留并警告，缺失/空白/非字符串 ID 静默跳过，`inventoryMigrationVersion: 1` 防止重复累加。
- ✅ `PetState.setMany(updates)`：全部字段先可见，再按输入字段顺序发映射事件与 `PET_STATE_CHANGED`；一次调用只安排一次保存；`set()` 保持兼容并复用该路径。
- ✅ `PetState.init()` 采用完整迁移后状态并持久化完整快照，避免整体覆盖存储契约下丢失旧字段。
- ✅ `store.js` 新存档默认值增加 `inventory: {}`、`inventoryMigrationVersion: 0`，保留 `foodInventory` 供 Farm 05 之前的旧消费者使用。
- ✅ 旧农场占位事件无实际消费者，已替换为六个正式 `farm:*` 事件常量；本窗口只定义、不触发。
- ✅ TDD：库存服务 RED（模块缺失）→ 3/3 GREEN；迁移 RED（导出缺失）→ 6/6 GREEN；`setMany` RED（方法缺失）→ shared 141/141 GREEN；启动迁移/默认值/事件 RED（三项断言失败）→ 定向 8/8；复验返修先复现溢出不报错与 malformed ID 污染 3 项 RED，再修复至库存 9/9；最终全仓回归 211/211 GREEN。
- ⏸ 本窗口未实现农场规则、UI 或现有喂食/仓库/商店的通用库存接入；这些按 farm-02～06 后续计划处理。

## 🌾 农场经营 — farm-02 领域引擎准备（2026-07-26）

- 📝 已创建 farm-02，实现前锁定订单可行候选池、奖励快照、提醒去重、持久化递增 ID、状态式防重、最小状态摘要、schema v1 局部修复及结算/命令合并单次提交。
- ✅ 架构补充语义已回传并据此完成实现；本准备项关闭。

## 🌾 农场经营 — farm-02 领域引擎实现（2026-07-26）

- ✅ 新增统一物品元数据和经启动校验的首发农场配置；六种作物、五个配方、三类三级建筑、16 格地图、等级/土地/订单/奖励数值均配置化。
- ✅ 新增 schema v1 默认状态、逐记录局部修复、迁移幂等、三槽订单、提醒去重状态和 `nextIds` 递增 ID 修复；主进程默认值仅增加 `farm: null`。
- ✅ 新增纯网格、生长、建筑、收获、加工与订单规则；时间和随机源注入，无 DOM/Electron/timer/localStorage/文件系统依赖。
- ✅ 加工支持三批串行队列、即时扣料、排队任务全额退款及一次跨多任务离线结算；订单支持稳定候选池、70/30 分支、去重、确定性回退和精确奖励快照。
- ✅ 新增串行事务协调器；结算与命令内存合并，最多一次 `PetState.setMany()`，提交成功后按结算事件→命令事件→一次状态事件发送。
- ✅ 状态占用变化提供收获、订单、加工和小鸟奖励防重；首次初始化种子赠礼只发一次。
- ✅ 定向领域与共享回归 180/180、最终全仓回归 244/244 通过；既有 `MODULE_TYPELESS_PACKAGE_JSON` warning 因本窗口禁止修改 `package.json` 保留。
- ⏸ 未实现农场 UI、dashboard 接入、桌宠提醒或旧喂食/仓库/商店消费者切换；这些属于 farm-03～06。
- ✅ ARCH-10 独立复验返修：先以新鲜探针得到 10/18、8 项 RED；修复种子奖励迁移、命令结果 ready 同事务去重、小鸟 `birdId` 当日防重/跨日重置、建筑/任务/订单 ID 唯一修复、加工时间链校验和已开放损坏地块保级恢复。定向领域与 shared 187/187、全仓 251/251。
- ✅ ARCH-10 第二轮复验返修：迁移完整形状审计先得到状态测试 8/11、3 项 RED；补齐 crop 运行时快照、订单稳定物品 ID/`materialValue` 快照、加工输入输出物品 ID 与仅首项 running 规范化。定向状态与协调器 21/21、领域与 shared 190/190、全仓 254/254。
- ✅ ARCH-10 第三轮独立复验通过：对抗迁移探针覆盖不完整 crop、非法订单、多个 running 加工任务及二次迁移幂等；7 个生产文件语法检查、纯模块禁用 API 扫描、`git diff --check` 均通过；新鲜全仓测试 254/254。farm-02 已以 `ad0da91` 提交，未 merge/push。

## 🌾 农场经营 — farm-03 农田与建筑 UI（2026-07-26）

- 📝 用户已确认由 Codex 执行高难度 farm-03，范围为农场页面、`4×4` 农田交互、土地解锁/升级、建筑建造/移动/升级/拆除、Dashboard 导航与异步生命周期。
- ⏸ 加工台、订单、小鸟奖励和桌宠提醒不在本窗口范围；实现窗口须先报告功能、界面、数据及事件/依赖边界，等待 ARCH-10 确认后再编码。
- 🔄 首轮实现全仓 267/267，语法与 `git diff --check` 通过；ARCH-10 独立复验发现加载失败后同页无法重试、移动目标缺少可访问名称、Dashboard 生命周期仅有源码正则而缺少行为测试，以及部分土地/建筑 UI 命令覆盖不足，已退回 farm-03 返修。
- 🔄 第一轮返修后全仓 274/274，原四项缺口关闭；ARCH-10 第二轮失败链探针发现旧页已 cleanup 后仍保留旧 current ID、点击旧入口无法恢复，以及 `activate()` 抛错不调用新页面 cleanup，已再次退回返修。新增 `dashboard/page-navigation.js` 未提前申请文件扩围，ARCH-10 基于最小可测试生命周期模块需要予以后补授权并要求交付如实记录。
- ✅ 第二轮返修后通过 ARCH-10 第三轮独立复验：旧入口恢复、activate 异常 cleanup、dispose 与迟到 render 的对抗探针通过；全仓 277/277，生产 JS 语法和 `git diff --check` 通过；Electron 冷启动、农场挂载、16 格/禁用页签、主页往返和重新挂载通过。farm-03 当前未 commit/merge/push。
