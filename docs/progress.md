# 开发进度

> 每次会话结束时更新此文件。
> 当前分支：main

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
| store.js — 统一数据存取层 | ✅ | JSON 文件，initStore/getState/setState |
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

### 渲染进程 — Overlay (src/renderer/overlay/)

| 任务 | 状态 | 备注 |
|------|------|------|
| overlay.html — 骨架 | ✅ | handle（drag）+ content（no-drag） |
| overlay.js — 逻辑 | ✅ | 配置注入 + 事件委托 data-overlay-result |
| overlay.css — 样式 | ✅ | 透明背景 + 毛玻璃 + 暗色主题 |

### 渲染进程 — 宠物 (src/renderer/pet/)

| 任务 | 状态 | 备注 |
|------|------|------|
| pet.html — 宠物窗口结构 | ✅ | emoji + 气泡容器 |
| pet.js — 宠物逻辑 | ✅ | 状态机：原生拖拽 / 随机走动 / 对话气泡（新心情四档 happy/good/neutral/low）/ 双击面板 / PetState.init() / 喂食 flyout（原则5：FOODS 配置 + foodInventory 数据分离）/ 互动经验接入 + 心情加成 / 喂食经验结算 + 心情加成 + 升级气泡 / 心情衰减结算（每日50点上限）+ 点击/喂食心情加成 |
| pet-motion.mjs — 纯几何计算 | ✅ | distance/isCursorNear/fleeCenter/wanderTarget/中心↔左上角换算；node --test pet-motion.test.mjs 6/6 |
| pet.css — 宠物样式 | ✅ | 透明背景 + padding 拖拽手柄 + no-drag 点击穿透 + 闲置/走动动画 + 气泡样式 |
| DESIGN.md | ✅ | 已细化：状态机、pet-motion 清单、坐标契约、class 钩子 |

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
| 设置页面 | ✅ | dash-09：首期 2 个设置项（悬浮提示开关/面板置顶），配置驱动，Tab 分组，即时生效+自动保存；IPC send/on 置顶；扩展预留 reset 按钮 + unlockLevel/disabled 字段。面板透明度已搁置（见已知问题） |
| DESIGN.md | ✅ | 已细化：两层布局结构、行容器语义化 class、滚动策略 |

---

## 待实现（按优先级）

1. ~~`pet.js` + `pet.css` — 宠物外观、动画、交互~~ ✅ 已完成（移动系统：拖拽/走动/躲鼠标/闲置）
4. ~~`dashboard.js` + `dashboard.css` — 面板切换和模块加载~~ ✅ 已完成（双击切换 + loadFile + 顶部栏 + 返回按钮）
5. ~~对话气泡系统~~ ✅ 已完成（mood×level 台词库 16 条、300ms 延迟 + 拖拽检测、2s 气泡动画、窗口动态缩放、右键缩放菜单）
6. ~~右键菜单交互 — 喂食/状态（IPC 对接）~~ ✅ 已完成（pet-04）
7. ~~面板状态页（宠物属性展示）~~ ✅ 已完成（dash-01）

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
- 右键菜单新增 "自动走动" checkbox，主进程 `wanderEnabled` 变量 + `wander:toggle` IPC 推送到渲染端

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
