# 架构设计原则与决策记录

> 以下十大原则是所有架构决策（ADR）的底层依据。新功能设计、代码审查、重构时须对照检查。

---

## 十大架构原则

### 1. 低耦合

模块间仅通过统一接口通信，不侵入对方内部逻辑，依赖关系清晰。

- 落地：各业务模块通过 EventBus 通信（ADR-002）；Electron 多窗口所有数据交互走主进程中转，禁止跨渲染进程直接通信。

### 2. 高内聚

强关联逻辑收拢在同一模块内，单个模块只负责一类完整的独立能力。

- 落地：宠物渲染、属性计算、食物库存、玩法逻辑各自闭环，避免交互代码与业务逻辑混杂散落。

### 3. 单一职责

单个文件/类/函数仅承担一个职责，修改它的动因唯一。

- 落地：静态配置、库存服务、状态计算拆分独立文件；新增食物品类仅需修改配置表，无需改动业务逻辑代码。

### 4. 状态中心化（单一数据源）

全局共享数据统一存储，所有窗口、模块均从同一可信数据源读写。

- 落地：金币、宠物属性、背包库存等全局状态统一存放于主进程；渲染进程通过 PetState + IPC 读写，订阅事件感知变更（ADR-005）。

### 5. 配置驱动（数据与逻辑分离）

将易变的内容抽离为配置数据，与核心业务逻辑代码剥离。

- 落地：食物属性、合成配方、升级阈值、对话文案全部配置化；调整数值、新增内容仅修改配置文件，无需重构核心逻辑。

### 6. 接口统一（门面模式）

每个模块对外仅暴露有限、稳定的接口，内部实现细节完全对外透明。

- 落地：PetState 只暴露 init/get/set/subscribe（ADR-005）；store.js 只暴露 initStore/getState/setState；内部重构时只要接口不变，所有调用方无需同步修改。

### 7. 可插拔性

非核心功能模块可独立启用、禁用或移除，不会导致核心系统崩溃。

- 落地：宠物系统为核心底座，单词、2048、农场等玩法均为可插拔插件；核心系统不反向依赖任何玩法模块；module-registry.js 驱动面板导航（ADR-004）。

### 8. 性能隔离

重计算、重渲染逻辑与宠物主窗口运行隔离，避免卡顿影响常驻体验。

- 落地：复杂数值运算、存档读写放在主进程执行；宠物动画采用 CSS 实现（无 JS 动画开销）；闲置游戏窗口自动挂起释放资源。

### 9. 容错降级

单个模块出现异常仅影响自身功能，不会拖垮整个桌面应用。

- 落地：event-bus.js emit 逐个 try-catch 隔离（ADR-006）；IPC 调用统一错误捕获；存档读取失败自动回退默认值。

### 10. 持久化统一

所有本地存档数据走统一存储层，禁止各模块私自读写本地文件。

- 落地：store.js 封装统一存储服务（ADR-003），统一处理存档版本兼容、自动备份、数据校验，避免数据分散混乱。

---

## ADR 决策记录

### ADR-001: Electron 单窗口双状态

**决策**：使用一个 BrowserWindow，在"宠物态"和"面板态"之间切换。

**理由**：
- 简化窗口管理（无需多窗口同步）
- 宠物始终可见（面板态时宠物缩到角落）
- 用户体验连贯（不是弹新窗口的突兀感）

**替代方案**：双窗口（宠物窗 + 面板窗），被否决因为窗口管理更复杂。

**窗口尺寸**（2026-07-12 更新）：宠物态窗口不再是固定 200×200，改为动态计算：
`200 × screen.scaleFactor × zoomLevel`。其中 zoomLevel 支持用户四档调节（75%/100%/125%/150%），持久化到 store。`lockPetSize()` 用 `min=max` 硬锁定正方形，防止 OS 干扰。

---

## ADR-002: EventBus 事件总线

**决策**：模块之间不直接 import，通过 EventBus 通信。

**理由**：
- 模块解耦：加新模块不改旧模块代码
- 通信可追踪：开发模式 console.log 每个 emit/on
- 便于调试：事件链清晰

**配套规范**：
- 事件命名：`模块名:动作:状态`
- 事件常量文件：`src/renderer/shared/events.js`
- 事件清单文档：`docs/events.md`

---

## ADR-003: JSON 文件存储

**决策**：第一版使用 JSON 文件存储数据，存于用户目录。

**理由**：
- 简单可靠，不会被浏览器清缓存影响
- 无容量限制
- 方便备份迁移

**未来迁移路径**：数据复杂后升级 SQLite，只需改 `store.js` 一个文件。

---

## ADR-004: 模块注册表

**决策**：面板导航通过模块注册表自动渲染。

**理由**：
- 加新模块只需注册一行，不改 dashboard 逻辑
- 避免硬编码导航列表

---

## ADR-005: PetState 接口边界

**决策**：pet-state.js 只暴露 `get(key)` / `set(key, value)` / `subscribe(event, callback)`，
不暴露内部实现细节。

**理由**：
- 防止 pet-state.js 膨胀为上帝对象（所有模块都依赖它 → 改一行炸一片）
- 外部模块无法绕过 EventBus 直接篡改状态
- 状态结构变更时加版本号，旧数据可迁移

**接口规范**：
```js
// pet-state.js 对外只暴露这三个
PetState.get('level')           // 读取
PetState.set('satiety', 80)      // 写入（内部自动 emit 事件）
PetState.subscribe(EVENTS.PET_SATIETY_CHANGED, callback)  // 订阅
```

**禁止**：任何模块直接修改 `PetState._data` 或绕过 `set()` 方法。

**初始化约定**（2026-07-12）：
- `PetState.init()` 是**幂等的**（第二次调用直接 return，不重复加载）
- 首个调用点：`pet.js` 的 `init()` 中 `await PetState.init()`（宠物窗口启动即加载）
- 后续模块（dashboard 等）也应在使用前 `await PetState.init()`，确保数据就绪
- 不依赖模块加载顺序 — 谁先跑谁触发初始化，后来者安全跳过

---

## ADR-006: 模块错误隔离（Phase 3 实施）

**风险**：单窗口架构下，一个游戏模块的未捕获异常会炸掉整个渲染进程，
导致宠物也一起消失。

**当前状态**：已知风险，Phase 3 解决（当前只有宠物一个模块，风险可控）。

**解决方案**（届时实施）：
```js
// dashboard.js 中加载模块时加 try-catch
function loadModule(moduleId) {
  try {
    modules[moduleId].mount()
  } catch (err) {
    console.error(`Module ${moduleId} crashed:`, err)
    showErrorPlaceholder(moduleId)  // 显示错误占位，不影响其他模块
  }
}
```

**Phase 3 触发条件**：模块数量 ≥ 3 时强制执行。

---

## ADR-007: 桌面悬浮窗拖拽使用 CSS 原生，不通过 IPC

**决策**：宠物窗口拖拽使用 CSS `-webkit-app-region: drag`（OS 原生），
自动移动（走动、躲避）通过 `window:move` IPC。两者通过主进程 `isAutoMoving`
标记互斥。

**理由**：
- JS 驱动拖拽 = `pointermove` → `ipcRenderer.invoke('window:move')` → `setPosition`。
  这条 IPC 链路有不可消除的延迟，5 个版本的坐标计算（含 DPI 对齐）均无法消除偏移。
- OS 原生拖拽零延迟，完美跟随光标。
- 自动移动不需要实时精度，IPC 延迟可接受。

**教训**：桌面级应用的实时交互优先使用 OS 原生机制。IPC 适合自动化，不适合
帧级实时操作。

**窗口尺寸**（2026-07-12）：`getPetSize()` = `200 × scaleFactor × zoomLevel`，动态计算非固定值。`lockPetSize()` 用 `min=max` 锁定，确保 resize 和缩放时窗口保持正方形。

---

## ADR-008: 高 DPI 下自动移动使用 setBounds 而非 setPosition

**决策**：`window:move` IPC handler 中自动移动窗口使用
`mainWindow.setBounds({ x, y, width, height })` 而非 `mainWindow.setPosition(x, y)`。
同时用 `currentPetSize` 变量存储当前基准尺寸，不用 `getSize()` 取值。

**理由**：
- 在 Windows 高 DPI 下，frameless + transparent + `min=max` 锁定的窗口，
  `setPosition` 单独调用时会触发每帧 +1px 的尺寸漂移（Electron/Chromium 内部
  DPI 取整 bug），走动几秒后窗口明显变大。
- `setBounds` 一次性设定位置和尺寸，原子操作杜绝了中间的取整丢失。
- `getSize()` 返回的是已被漂移污染的尺寸，所以必须用独立变量 `currentPetSize` 记录基准值。

**适用场景**：`window:move`（自动走动）、`applyZoom`（缩放）、`switchToPet`（面板切回）。
这三处都需同步更新 `currentPetSize`。

**教训**：Electron 的 frameless + transparent + min=max 组合在 Windows 高 DPI 下
是已知雷区。永远用 `setBounds` 替代 `setPosition`，且尺寸走内存变量不走 `getSize()`。
