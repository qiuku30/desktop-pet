# 农场跨页面物品图标实施计划

> **面向实现窗口：** 必须使用 superpowers:executing-plans 逐任务执行本计划，并用 test-driven-development 保持每项严格 RED→GREEN。所有步骤使用 checkbox（`- [ ]`）追踪。

**目标：** 让现有 21 个物品在仓库、商店和 Dashboard 首页库存中统一使用「明亮家园」项目图标，并把桌宠成熟作物指示器升级为项目小麦图标，同时保持全部业务与提醒语义不变。

**架构：** shared item catalog 只增加引擎无关的不可变图片 URL；Dashboard-local 纯模块负责安全 markup 与主图→fallback→隐藏的两级错误治理；仓库、商店和首页库存共用该模块。桌宠指示器不改 DOM/运行时，只让 reminder 输出纯数量并由 CSS 伪元素提供小麦图标。

**技术栈：** JavaScript ES modules、语义 HTML、CSS、Node test runner、Electron Chromium、Electron Forge、同 `app.asar` 验证。

## 全局约束

- 只有 `farm-art-04` 通过 ARCH-11 独立 gate、资产已集成到 `main` 且工作区干净后才能启动。
- 启动时依次完整阅读 `AGENTS.md`、`PROJECT_BRIEF.md`、`docs/architecture.md`、`docs/progress.md`、`docs/session-log.md`、`docs/conventions.md`、`docs/events.md`、`docs/superpowers/specs/2026-08-03-farm-cross-page-icons-design.md`、本计划及实际 shared/Dashboard/pet 代码。
- 动工前执行并报告 `git status --short --branch`、`git log --oneline --decorate -20`、`git diff --check`，核对 `HEAD` 与 `main`/`origin/main`；上报用户可见界面、数据输入输出、fallback、生命周期、无障碍、新事件/IPC/依赖/持久化均无，以及精确 10 文件范围。收到 ARCH-11 明确“可动工”后才编码。
- 只允许修改本计划文件地图中的 10 个文件；不同窗口不得同时修改它们。
- 不得修改 `pet.js`、`pet.html`、farm 资产、`farm.json`、FarmService、PetState、EventBus、IPC、持久化、package、lockfile、tracker 或架构文档。
- 不新增事件、IPC、依赖、持久化字段或业务 schema；不改变物品 ID、名称、Emoji、类别、买卖价格、feed 数值、解锁等级、tooltip、库存、事务或提醒语义。
- `emoji` 字段继续保留给本阶段未迁移的消费方；仓库、商店和 Dashboard 首页库存的成功路径与 fallback 路径不得输出物品 Emoji。
- Dashboard 图片错误处理固定为主图→`ITEM_ICON_FALLBACK_SRC`→隐藏图片，最多两步，不重试、不写业务状态。
- 桌宠成熟指示器固定为项目小麦 CSS 图标；图片失败后只保留数字，不引入图片 fallback 状态机。
- 所有新增对象/数组保持现有冻结合同；图片 URL 只能来自仓库内模块常量，不接受持久化或用户输入。
- 每个异步或事件边界必须防止重复监听和 cleanup 后影响；Dashboard 图片错误监听器与 renderer document 同寿命，只安装一次。
- 不得 stage、commit、merge、push 或创建分支。ARCH-11 在用户批准独立 gate 后负责集成。

## 文件地图

- 修改 `src/renderer/shared/item-config.js`：21 条 `iconSrc` 与统一 `ITEM_ICON_FALLBACK_SRC`。
- 修改 `src/renderer/shared/item-config.test.mjs`：精确映射、冻结和业务字段不可变合同。
- 新建 `src/renderer/dashboard/dashboard-item-icons.mjs`：图片 markup、属性转义和两级失败处理。
- 新建 `src/renderer/dashboard/dashboard-item-icons.test.mjs`：纯模块、安全、幂等、detached 行为测试。
- 修改 `src/renderer/dashboard/dashboard.js`：一次安装错误边界，仓库/商店/首页库存共用图片 helper。
- 修改 `src/renderer/dashboard/dashboard-inventory.test.mjs`：三消费方与业务回归合同。
- 修改 `src/renderer/dashboard/dashboard.css`：三类页面的有界图片布局和两档响应式。
- 修改 `src/renderer/pet/pet-farm-reminder.mjs`：成熟指示器只输出数量文本。
- 修改 `src/renderer/pet/pet-farm-reminder.test.mjs`：数量、文案、计时、去重不变合同。
- 修改 `src/renderer/pet/pet.css`：`#farm-indicator::before` 项目小麦图标。

---

### Task 1：为共享物品目录增加不可变图标元数据

**文件：**
- 修改：`src/renderer/shared/item-config.js`
- 修改：`src/renderer/shared/item-config.test.mjs`

**接口：**
- 新增导出：`ITEM_ICON_FALLBACK_SRC: string`。
- 每条 `ITEMS[itemId]` 新增：`iconSrc: string`。
- 保持：`getItem`、`listItems`、`listFeedableItems`、`listPurchasableItems` 签名和全部既有字段。

- [ ] **Step 1：写图标映射与业务不可变 RED 测试**

在测试中导入 `createHash` 和 `ITEM_ICON_FALLBACK_SRC`。锁定精确 21 项文件映射：

```js
const ICON_FILES = {
  'seed:wheat': 'seed-wheat.webp',
  'seed:carrot': 'seed-carrot.webp',
  'seed:corn': 'seed-corn.webp',
  'seed:strawberry': 'seed-strawberry.webp',
  'seed:pumpkin': 'seed-pumpkin.webp',
  'seed:star-dew-fruit': 'seed-star-dew-fruit.webp',
  'crop:wheat': 'crop-wheat.webp',
  'crop:carrot': 'crop-carrot.webp',
  'crop:corn': 'crop-corn.webp',
  'crop:strawberry': 'crop-strawberry.webp',
  'crop:pumpkin': 'crop-pumpkin.webp',
  'crop:star-dew-fruit': 'crop-star-dew-fruit.webp',
  'food:apple': 'food-apple.webp',
  'food:cake': 'food-cake.webp',
  'food:fish': 'food-fish.webp',
  'food:milk': 'food-milk.webp',
  'food:cookie': 'food-cookie.webp',
  'food:popcorn': 'food-popcorn.webp',
  'food:carrot-juice': 'food-carrot-juice.webp',
  'food:strawberry-milkshake': 'food-strawberry-milkshake.webp',
  'food:pumpkin-pie': 'food-pumpkin-pie.webp',
}

for (const [id, filename] of Object.entries(ICON_FILES)) {
  assert.equal(new URL(ITEMS[id].iconSrc).pathname.endsWith(`/ui/items/${filename}`), true)
}
assert.equal(new URL(ITEM_ICON_FALLBACK_SRC).pathname.endsWith('/ui/items/fallback.webp'), true)
```

增加冻结断言，并在去除 `iconSrc` 后对既有目录做稳定摘要：

```js
const legacy = Object.fromEntries(Object.entries(ITEMS).map(([id, value]) => {
  const { iconSrc, ...business } = value
  return [id, business]
}))
assert.equal(
  createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
  '2fb1a2572cd80567e3c35ab2177d402fb402da3b8e599c5c05ddffa2e162f21b',
)
for (const entry of Object.values(ITEMS)) assert.equal(Object.isFrozen(entry), true)
```

- [ ] **Step 2：运行并确认 RED**

运行：`node --test src/renderer/shared/item-config.test.mjs`

预期：因 `ITEM_ICON_FALLBACK_SRC`/`iconSrc` 不存在而失败；既有目录测试仍通过。

- [ ] **Step 3：最小实现精确映射**

在 `item-config.js` 中加入固定文件表和 URL helper：

```js
const ITEM_ICON_FILES = Object.freeze({
  'seed:wheat': 'seed-wheat.webp',
  'seed:carrot': 'seed-carrot.webp',
  'seed:corn': 'seed-corn.webp',
  'seed:strawberry': 'seed-strawberry.webp',
  'seed:pumpkin': 'seed-pumpkin.webp',
  'seed:star-dew-fruit': 'seed-star-dew-fruit.webp',
  'crop:wheat': 'crop-wheat.webp',
  'crop:carrot': 'crop-carrot.webp',
  'crop:corn': 'crop-corn.webp',
  'crop:strawberry': 'crop-strawberry.webp',
  'crop:pumpkin': 'crop-pumpkin.webp',
  'crop:star-dew-fruit': 'crop-star-dew-fruit.webp',
  'food:apple': 'food-apple.webp',
  'food:cake': 'food-cake.webp',
  'food:fish': 'food-fish.webp',
  'food:milk': 'food-milk.webp',
  'food:cookie': 'food-cookie.webp',
  'food:popcorn': 'food-popcorn.webp',
  'food:carrot-juice': 'food-carrot-juice.webp',
  'food:strawberry-milkshake': 'food-strawberry-milkshake.webp',
  'food:pumpkin-pie': 'food-pumpkin-pie.webp',
})
const itemIconUrl = filename => new URL(
  `../assets/farm/bright-homestead/ui/items/${filename}`,
  import.meta.url,
).href

export const ITEM_ICON_FALLBACK_SRC = itemIconUrl('fallback.webp')
```

在 `item()` 返回的冻结对象中加入：

```js
iconSrc: itemIconUrl(ITEM_ICON_FILES[id]),
```

不得改变其余字段顺序和值；不得根据运行时输入拼接文件名。

- [ ] **Step 4：运行并确认 GREEN**

运行：`node --test src/renderer/shared/item-config.test.mjs`

预期：全部 PASS，业务摘要仍为锁定 hash，21 项与 fallback URL 精确匹配。

### Task 2：建立 Dashboard-local 图标与错误边界模块

**文件：**
- 新建：`src/renderer/dashboard/dashboard-item-icons.mjs`
- 新建：`src/renderer/dashboard/dashboard-item-icons.test.mjs`

**接口：**
- `buildDashboardItemIcon(item, options) -> string`，其中 `options = { className, fallbackSrc }`。
- `buildDashboardItemAriaLabel(item, count) -> string`，返回已经完成属性转义的“名称，数量 N”。
- `handleDashboardItemIconError(root, event, fallbackSrc) -> 'ignored' | 'fallback' | 'hidden'`。
- `installDashboardItemIconBoundary(root, fallbackSrc) -> { dispose() }`；同一 live root 重复安装返回同一控制器，生产中控制器与 document 同寿命。

- [ ] **Step 1：写纯模块 RED 测试**

覆盖：图片和 `aria-label` 属性转义、空 `alt`、`draggable="false"`、`pointer-events` 由 CSS 管理、缺失主图直接从 fallback stage 开始、首次错误切 fallback、第二次隐藏、无 Emoji、非标记图片 ignored、detached target ignored、同 root 重复安装只调用一次 `addEventListener('error', ..., true)`、dispose 幂等且允许之后重新安装。

```js
const html = buildDashboardItemIcon(
  { iconSrc: 'file:///skin/a.webp', emoji: '🍎' },
  { className: 'wh-item-icon', fallbackSrc: 'file:///skin/fallback.webp' },
)
assert.match(html, /<img[^>]+data-farm-item-icon="primary"/)
assert.match(html, /alt=""/)
assert.doesNotMatch(html, /🍎/u)
assert.equal(
  buildDashboardItemAriaLabel({ name: '苹果"<&' }, 3),
  '苹果&quot;&lt;&amp;，数量 3',
)
```

Fake image 必须实现 `dataset`、`hidden`、`src`、`removeAttribute`、`matches`，fake root 必须实现 `contains`、`addEventListener`、`removeEventListener`，以验证真实状态转换而不是只扫源码。

- [ ] **Step 2：运行并确认 RED**

运行：`node --test src/renderer/dashboard/dashboard-item-icons.test.mjs`

预期：因模块不存在而失败。

- [ ] **Step 3：实现最小 markup 与两级状态机**

固定标记为 `data-farm-item-icon="primary|fallback|hidden"`，并把 fallback URL 放入经过转义的 `data-fallback-src`。错误处理顺序必须为：

```js
if (!root?.contains?.(image) || !image?.matches?.('img[data-farm-item-icon]')) return 'ignored'
if (image.dataset.farmItemIcon === 'primary') {
  image.dataset.farmItemIcon = 'fallback'
  image.src = fallbackSrc
  return 'fallback'
}
image.dataset.farmItemIcon = 'hidden'
image.hidden = true
image.removeAttribute('src')
return 'hidden'
```

markup helper 与 `buildDashboardItemAriaLabel()` 共用局部 `escapeAttribute()`，依次转义 `&`、`"`、`<`、`>`；不得读取 PetState、库存或业务服务。`count` 不是非负安全整数时，label 数量固定为 `0`。

- [ ] **Step 4：实现幂等 document 边界安装**

使用模块私有 `WeakMap` 以 root 为键。捕获阶段 listener 调用纯错误处理函数；`dispose()` 只移除一次监听并从 WeakMap 删除。生产调用一次但测试必须覆盖重复安装和 dispose 后重装。

- [ ] **Step 5：运行并确认 GREEN**

运行：

```bash
node --test src/renderer/dashboard/dashboard-item-icons.test.mjs
node --check src/renderer/dashboard/dashboard-item-icons.mjs
```

预期：全部 PASS，无未处理异常。

### Task 3：把仓库、商店和首页库存接入统一图片组件

**文件：**
- 修改：`src/renderer/dashboard/dashboard.js`
- 修改：`src/renderer/dashboard/dashboard-inventory.test.mjs`
- 修改：`src/renderer/dashboard/dashboard.css`

**接口：**
- 消费：Task 1 的 `ITEM_ICON_FALLBACK_SRC` 与 Task 2 的 `buildDashboardItemIcon`/`installDashboardItemIconBoundary`。
- 保持：全部现有 `data-item-id`、`data-food-id`、`data-action`、数量、tooltip、右键、交易和喂食函数。

- [ ] **Step 1：写三消费方 RED 合同**

在 `dashboard-inventory.test.mjs` 中读取源码并断言：

```js
assert.match(dashboardSource, /installDashboardItemIconBoundary\(document, ITEM_ICON_FALLBACK_SRC\)/)
assert.match(dashboardSource, /buildDashboardItemIcon\(item, \{ className: 'wh-item-icon'/)
assert.match(dashboardSource, /buildDashboardItemIcon\(item, \{ className: 'shop-item-icon'/)
assert.match(dashboardSource, /buildDashboardItemIcon\(food, \{ className: 'inventory-item-icon'/)
assert.doesNotMatch(dashboardSource, /wh-item-emoji">\$\{item\.emoji\}/)
assert.doesNotMatch(dashboardSource, /shop-item-emoji">\$\{item\.emoji\}/)
```

增加首页 `aria-label` 断言，并保留现有事务、tooltip、右键和 feed 顺序测试。

- [ ] **Step 2：运行并确认 RED**

运行：

```bash
node --test src/renderer/dashboard/dashboard-item-icons.test.mjs \
  src/renderer/dashboard/dashboard-inventory.test.mjs
```

预期：纯模块测试 PASS，Dashboard 消费合同因仍使用 Emoji 而失败。

- [ ] **Step 3：接入 import 与唯一错误边界**

在现有 import 区加入：

```js
import {
  ITEM_ICON_FALLBACK_SRC,
  getItem,
  listFeedableItems,
  listItems,
  listPurchasableItems,
} from '../shared/item-config.js'
import {
  buildDashboardItemAriaLabel,
  buildDashboardItemIcon,
  installDashboardItemIconBoundary,
} from './dashboard-item-icons.mjs'

installDashboardItemIconBoundary(document, ITEM_ICON_FALLBACK_SRC)
```

不得把该安装放进页面 render 或 `bindHomePageEvents()`。

- [ ] **Step 4：替换三处成功路径 markup**

仓库、商店分别使用 `wh-item-icon`、`shop-item-icon`；首页库存使用 `inventory-item-icon`，并为外层节点增加：

```js
aria-label="${buildDashboardItemAriaLabel(food, count)}"
```

所有图片 helper 都显式传入 `fallbackSrc: ITEM_ICON_FALLBACK_SRC`。不得删除可见名称、数量、价格、锁定文案、按钮或 data 属性；空状态中的背包 Emoji 不属于物品成功路径，不在本任务修改。

- [ ] **Step 5：替换 CSS 尺寸规则**

删除或停止使用 `.wh-item-emoji`、`.shop-item-emoji` 的成功路径规则，增加：

```css
.wh-item-icon,
.shop-item-icon {
  width: 40px;
  height: 40px;
  display: block;
  object-fit: contain;
  pointer-events: none;
}

.inventory-item-icon {
  width: min(70%, 40px);
  height: min(70%, 40px);
  display: block;
  object-fit: contain;
  pointer-events: none;
}

img[data-farm-item-icon="hidden"] {
  visibility: hidden;
}
```

选择器必须限定在现有 Dashboard 物品区域，不能影响导航、心情、金币或其他图片。

- [ ] **Step 6：运行并确认 GREEN**

运行：

```bash
node --test src/renderer/shared/item-config.test.mjs \
  src/renderer/dashboard/dashboard-item-icons.test.mjs \
  src/renderer/dashboard/dashboard-inventory.test.mjs
node --check src/renderer/dashboard/dashboard.js
```

预期：图标和现有交易/tooltip/feed 测试全部 PASS。

### Task 4：升级桌宠成熟作物指示器

**文件：**
- 修改：`src/renderer/pet/pet-farm-reminder.mjs`
- 修改：`src/renderer/pet/pet-farm-reminder.test.mjs`
- 修改：`src/renderer/pet/pet.css`

**接口：**
- `formatFarmIndicator({ matureCount: n }) -> { visible: true, text: String(n) }`。
- 零、负数、非安全整数和空值继续返回 `{ visible: false, text: '' }`。
- 气泡文案、`createPetFarmReminder()` 接口和 30 秒 timer 不变。

- [ ] **Step 1：写纯数量与 CSS RED 合同**

把正数期望改为：

```js
assert.deepEqual(formatFarmIndicator({ matureCount: 3 }), {
  visible: true,
  text: '3',
})
```

测试读取 `pet.css` 并断言 `#farm-indicator::before`、`crop-wheat.webp`、固定尺寸和 `background-size: contain`；同时断言源码仍保留三条精确气泡文案，且不修改 `pet.js`/`pet.html`。

- [ ] **Step 2：运行并确认 RED**

运行：`node --test src/renderer/pet/pet-farm-reminder.test.mjs`

预期：正数文本仍为 `🌾 3`，CSS 伪元素不存在，因此失败；其余计时、去重、优先级测试通过。

- [ ] **Step 3：最小修改 formatter**

只把正数返回改为：

```js
return { visible: true, text: String(count) }
```

不得修改 `BUBBLE_TEXT`、`REFRESH_MS`、订阅、refresh 或 destroy。

- [ ] **Step 4：增加单层 CSS 小麦图标**

在现有 `#farm-indicator` 之后加入：

```css
#farm-indicator::before {
  content: '';
  display: inline-block;
  width: 1.25em;
  height: 1.25em;
  margin-right: .25em;
  vertical-align: -.25em;
  background-image: url('../assets/farm/bright-homestead/ui/items/crop-wheat.webp');
  background-position: center;
  background-size: contain;
  background-repeat: no-repeat;
}
```

不得叠加 fallback 背景，不增加 animation，不改拖拽区域和 pointer 语义。图片失败时伪元素为空，数字继续显示。

- [ ] **Step 5：运行并确认 GREEN**

运行：

```bash
node --test src/renderer/pet/pet-farm-reminder.test.mjs
node --check src/renderer/pet/pet-farm-reminder.mjs
git diff -- src/renderer/pet/pet.js src/renderer/pet/pet.html
```

预期：reminder 全部 PASS；最后一条命令无输出。

### Task 5：跨模块、真实 Chromium 与打包终验

**文件：**
- 只验证前四个 Task 的 10 个授权文件，不新增第 11 个文件。
- 临时 harness 只允许放在 `/tmp/farm-visual-07-*`，结束后清理。

**接口：**
- 正常路径：21 张项目图标。
- Dashboard 错误路径：主图→项目 fallback→隐藏图片，业务 DOM 始终存在。
- 宠物错误路径：小麦图片缺失时保留数字。

- [ ] **Step 1：运行聚焦与跨模块测试**

运行：

```bash
node --test src/renderer/shared/*.test.mjs \
  src/renderer/dashboard/*.test.mjs \
  src/renderer/pet/*.test.mjs \
  src/renderer/pet/animation/*.test.mjs
```

预期：全部 PASS；既有 MODULE_TYPELESS_PACKAGE_JSON warning 可记录但不得通过修改 package 消除。

- [ ] **Step 2：运行 GUI 全仓与语法检查**

运行仓库全部 `*.test.mjs`，Electron/Chromium 测试需要时在 GUI 权限环境执行；再运行：

```bash
node --check src/renderer/shared/item-config.js
node --check src/renderer/dashboard/dashboard-item-icons.mjs
node --check src/renderer/dashboard/dashboard.js
node --check src/renderer/pet/pet-farm-reminder.mjs
git diff --check
```

预期：全仓零失败，四个生产模块语法通过，diff check 无输出。环境失败必须与代码失败分开复现和上报。

- [ ] **Step 3：真实 Chromium 两档验证**

使用当前源码启动真实 Dashboard，分别设置 800×600 和 600×400，检查仓库、商店和首页库存：21 项图片比例正确、无横向溢出、按钮和焦点不裁切、首页 `aria-label` 包含名称和数量、tooltip/右键/购买/喂食入口保持。用故障注入依次验证主图失败显示 fallback、fallback 再失败只隐藏图片，名称/数量/按钮仍存在。

- [ ] **Step 4：生命周期与桌宠验证**

连续 20 次切换 home/warehouse/shop，断言 document 上只有一个图标错误 listener；重复 render 不增加监听；无关图片错误保持 ignored。启动桌宠，验证成熟数为正时显示小麦+数字，模拟小麦缺失时只剩数字；零成熟时仍隐藏。确认气泡文本、提醒去重、睡眠和闲置相关测试未变化。

- [ ] **Step 5：打包与同 `app.asar` 验证**

运行：`npm run package`

检查最终 `app.asar` 包含 21 张 `ui/items/*.webp`、`fallback.webp`、两份新/改生产模块与 CSS。由同 archive 的 Dashboard 和 pet 页面验证模块 URL 与图片 URL 均能解析；不得使用 `about:blank` 跨来源模型代替真实同源链。

- [ ] **Step 6：范围与业务合规扫描**

运行 `git status --short -uall` 并确认只出现精确 10 文件；扫描新增代码不得包含 `PetState.set`、`setMany`、`localStorage`、FarmService、IPC、新 EventBus 事件、外部 `http:`/`https:` 图片或其他模块业务 import。确认 `pet.js`、`pet.html`、farm 资产和 manifest 无 diff。

- [ ] **Step 7：向 ARCH-11 交付并停手**

报告完整文件、用户可见结果、图标/业务字段合同、两级 fallback、监听器生命周期、桌宠纯数字回退、800×600/600×400、GUI 全仓测试、打包与同 `app.asar`、越界授权、已知问题和 Git 状态。不得自行 stage/commit/merge/push，等待 ARCH-11 独立复验。
