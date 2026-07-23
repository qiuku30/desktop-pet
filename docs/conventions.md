# 编码规范

## JavaScript

- ES6 模块语法（import/export）
- 变量命名：camelCase
- 常量命名：UPPER_SNAKE_CASE（如 `EVENTS.PET_SATIETY_CHANGED`）
- 文件名：kebab-case（如 `event-bus.js`, `pet-state.js`）

## 文件组织

- 每个模块自包含：自己的 .js / .css / .html（如需要）/ DESIGN.md
- 公共代码放 `src/renderer/shared/`
- 静态资源放 `src/renderer/assets/`

## 模块规则

### 🚫 禁止跨模块 import（最高优先级）

**模块之间禁止直接 import。** 这是硬性规定，不是建议。

```js
// ❌ 禁止：2048 直接引用宠物模块
import { petState } from '../../shared/pet-state.js'

// ✅ 正确：通过 EventBus 通信
import { EVENTS } from '../shared/events.js'
EventBus.emit(EVENTS.COIN_EARNED, { amount: 100 })
EventBus.on(EVENTS.PET_LEVEL_UP, (data) => { ... })
```

**允许的 import**：
- 本模块自己的文件
- `src/renderer/shared/` 下的公共基础设施（event-bus.js、events.js、module-registry.js）
- `src/renderer/shared/pet-state.js` — 读写都走 `get()`/`set()`/`subscribe()`，**禁止直接访问 `_data`**

**代码审查检查点**：每次 review 检查是否有跨模块 import，发现即打回。

### 其他模块规则

- 通过 EventBus 通信
- 数据存取走 store.js（IPC），不直接碰文件系统

## Git

- 分支命名：`feature/xxx`
- Commit 语言：英文
- Commit 格式：`<type>: <description>`（如 `feat: add pet dialogue bubble`）

## 文档

- 需求文档：`specs/xxx.md`（用户视角，功能列表 + 交互描述 + 验收标准）
- 设计文档：`src/xxx/DESIGN.md`（技术视角，组件树 + 数据结构 + 状态管理）
- 改完代码同步更新对应 DESIGN.md
