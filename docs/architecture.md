# Architecture Decision Record

## ADR-001: Electron 单窗口双状态

**决策**：使用一个 BrowserWindow，在"宠物态"和"面板态"之间切换。

**理由**：
- 简化窗口管理（无需多窗口同步）
- 宠物始终可见（面板态时宠物缩到角落）
- 用户体验连贯（不是弹新窗口的突兀感）

**替代方案**：双窗口（宠物窗 + 面板窗），被否决因为窗口管理更复杂。

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
PetState.set('hunger', 80)      // 写入（内部自动 emit 事件）
PetState.subscribe(EVENTS.PET_HUNGER_CHANGED, callback)  // 订阅
```

**禁止**：任何模块直接修改 `PetState._data` 或绕过 `set()` 方法。

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
