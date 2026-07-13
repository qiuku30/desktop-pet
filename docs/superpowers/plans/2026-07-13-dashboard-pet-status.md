# 面板宠物状态展示 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 dashboard `#content-area` 渲染宠物状态卡片，展示等级、经验、心情、饥饿、亲密度、金币、食物库存，支持快速投喂。

**Architecture:** 混合布局（关键属性大卡片 + 紧凑小卡片），通过 `PET_STATE_CHANGED` 事件驱动增量 DOM 刷新。食物库存用 5 列网格物品格，左键点击有库存物品触发快速投喂。

**Tech Stack:** JavaScript ES6 modules, CSS Grid, PetState API, EventBus

## Global Constraints

- 只能改 `src/renderer/dashboard/` 下的文件 + `docs/progress.md` + `docs/session-log.md`
- 不改 `#nav-bar`
- 不改 pet.js 的 FOODS 表
- 不引入新事件常量
- 不实现右键上下文菜单（后续窗口）
- hunger 语义：0-100，越低越饿（store.js 注释确认）
- 暗色主题：`#1e1e1e` 底，`#2c2c2c` 卡片，`#ccc` 字

---

### Task 1: dashboard.html — 加载 pet-state.js

**Files:**
- Modify: `src/renderer/dashboard/dashboard.html`

**Interfaces:**
- Produces: `PetState` 可通过 ES module import 在 dashboard.js 中使用

- [ ] **Step 1: 添加 script 标签**

在 `dashboard.html` 的 `<body>` 底部，`event-bus.js` 之后、`dashboard.js` 之前，添加：

```html
<script type="module" src="../shared/pet-state.js"></script>
```

改后文件结构：

```html
<body>
  <header id="top-bar">
    <span id="drag-area">摸鱼面板</span>
    <button id="btn-close" title="返回宠物">✕</button>
  </header>
  <div id="dashboard">
    <nav id="nav-bar"></nav>
    <main id="content-area"></main>
  </div>
  <script type="module" src="../shared/event-bus.js"></script>
  <script type="module" src="../shared/pet-state.js"></script>   <!-- 新增 -->
  <script type="module" src="../shared/module-registry.js"></script>
  <script type="module" src="dashboard.js"></script>
</body>
```

- [ ] **Step 2: 验证加载**

启动应用，打开 DevTools Console，确认无 "Failed to resolve module" 错误。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/dashboard/dashboard.html
git commit -m "feat(dashboard): add pet-state.js module script tag"
```

---

### Task 2: dashboard.css — 卡片与布局样式

**Files:**
- Modify: `src/renderer/dashboard/dashboard.css`

**Interfaces:**
- Produces: CSS class `.card`, `.status-hero`, `.status-compact`, `.card--level`, `.card--mood`, `.card--hunger`, `.card--intimacy`, `.card--coins`, `.card--inventory`, `.inventory-grid`, `.inventory-item`, `.inventory-item--empty`, `.progress-bar`, `.progress-fill`

- [ ] **Step 1: 在 dashboard.css 末尾追加所有新样式**

```css
/* ── 宠物状态卡片 ── */

/* 布局容器 */
.status-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.status-compact {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}

/* 通用卡片 */
.card {
  background: #2c2c2c;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 14px;
}

/* ── 等级+经验 ── */
.card--level {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.level-value {
  font-size: 28px;
  font-weight: bold;
  color: #fff;
}

.level-exp {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  min-width: 120px;
}

.exp-label {
  font-size: 12px;
  color: #999;
}

/* ── 心情 ── */
.card--mood {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mood-emoji {
  font-size: 32px;
  line-height: 1;
}

.mood-label {
  font-size: 16px;
  color: #ddd;
}

/* ── 饥饿 ── */
.card--hunger {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hunger-label {
  font-size: 14px;
  color: #ccc;
  white-space: nowrap;
}

.hunger-value {
  font-size: 12px;
  color: #999;
  min-width: 36px;
  text-align: right;
}

/* 进度条 */
.progress-bar {
  flex: 1;
  height: 10px;
  background: #444;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease, background 0.3s ease;
}

.progress-fill--high {
  background: #4caf50;  /* > 60：饱了 */
}

.progress-fill--mid {
  background: #ffc107;  /* 31-60：一般 */
}

.progress-fill--low {
  background: #e81123;  /* ≤ 30：饿了 */
}

/* ── 亲密度 ── */
.card--intimacy {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-emoji {
  font-size: 22px;
  line-height: 1;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #fff;
  margin-left: auto;
}

/* ── 金币 ── */
.card--coins {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── 食物库存 ── */
.card--inventory {
  /* 容器自适应 */
}

.inventory-title {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.inventory-item {
  aspect-ratio: 1;
  background: #333;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
  user-select: none;
}

.inventory-item:hover {
  background: rgba(255,255,255,0.12);
}

.inventory-item--empty {
  opacity: 0.30;
  cursor: default;
}

.inventory-item--empty:hover {
  background: #333;
}

.inventory-count {
  position: absolute;
  right: 4px;
  bottom: 2px;
  font-size: 11px;
  color: #ccc;
  line-height: 1;
}
```

- [ ] **Step 2: 验证样式加载**

启动应用，打开 DevTools → Elements 面板，确认 CSS 文件无 404，所有新 class 出现在 Styles 面板中。

- [ ] **Step 3: Commit**

```bash
git add src/renderer/dashboard/dashboard.css
git commit -m "feat(dashboard): add pet status card and inventory grid styles"
```

---

### Task 3: dashboard.js — 渲染函数

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`

**Interfaces:**
- Consumes: `PetState` from `../shared/pet-state.js`
- Produces: `FOOD_META`, `renderAll()`, `renderLevel()`, `renderMood()`, `renderHunger()`, `renderIntimacy()`, `renderCoins()`, `renderInventory()`, `initStatus()`

- [ ] **Step 1: 在 dashboard.js 末尾追加 import 和 FOOD_META**

```js
// ── 宠物状态展示 ──

import { PetState } from '../shared/pet-state.js'

const FOOD_META = {
  apple:  { name: '苹果', emoji: '🍎', hunger: -20 },
  cake:   { name: '蛋糕', emoji: '🍰', hunger: -30 },
  fish:   { name: '小鱼干', emoji: '🐟', hunger: -25 },
  milk:   { name: '牛奶', emoji: '🥛', hunger: -15 },
  cookie: { name: '饼干', emoji: '🍪', hunger: -10 },
}
```

- [ ] **Step 2: 追加 DOM 构建函数**

```js
function buildStatusDOM() {
  const area = document.getElementById('content-area')
  area.innerHTML = `
    <section class="status-hero">
      <div class="card card--level" id="card-level"></div>
      <div class="card card--mood" id="card-mood"></div>
    </section>
    <section class="card card--hunger" id="card-hunger"></section>
    <section class="status-compact">
      <div class="card card--intimacy" id="card-intimacy"></div>
      <div class="card card--coins" id="card-coins"></div>
      <div class="card card--inventory" id="card-inventory"></div>
    </section>
  `
}
```

- [ ] **Step 3: 追加各卡片渲染函数**

```js
const MOOD_MAP = {
  happy:   { emoji: '😊', label: '开心' },
  neutral: { emoji: '😐', label: '一般' },
  hungry:  { emoji: '😋', label: '饥饿' },
  sad:     { emoji: '😢', label: '难过' },
}

function renderLevel() {
  const card = document.getElementById('card-level')
  if (!card) return
  const level = PetState.get('level') || 1
  const exp = PetState.get('exp') || 0
  card.innerHTML = `
    <span class="level-value">Lv.${level}</span>
    <div class="level-exp">
      <div class="progress-bar">
        <div class="progress-fill progress-fill--high" style="width:${exp}%"></div>
      </div>
      <span class="exp-label">经验 ${exp}</span>
    </div>
  `
}

function renderMood() {
  const card = document.getElementById('card-mood')
  if (!card) return
  const mood = PetState.get('mood') || 'neutral'
  const m = MOOD_MAP[mood] || MOOD_MAP.neutral
  card.innerHTML = `
    <span class="mood-emoji">${m.emoji}</span>
    <span class="mood-label">心情：${m.label}</span>
  `
}

function renderHunger() {
  const card = document.getElementById('card-hunger')
  if (!card) return
  const hunger = PetState.get('hunger')
  const val = (hunger != null) ? hunger : 100
  const pct = Math.max(0, Math.min(100, val))
  let cls = 'progress-fill--high'
  if (val <= 30) cls = 'progress-fill--low'
  else if (val <= 60) cls = 'progress-fill--mid'
  card.innerHTML = `
    <span class="hunger-label">🍽 饥饿</span>
    <div class="progress-bar">
      <div class="progress-fill ${cls}" style="width:${pct}%"></div>
    </div>
    <span class="hunger-value">${val}</span>
  `
}

function renderIntimacy() {
  const card = document.getElementById('card-intimacy')
  if (!card) return
  const val = PetState.get('intimacy') || 0
  card.innerHTML = `
    <span class="stat-emoji">💕</span>
    <span class="stat-label">亲密度</span>
    <span class="stat-value">${val}</span>
  `
}

function renderCoins() {
  const card = document.getElementById('card-coins')
  if (!card) return
  const val = PetState.get('coins') || 0
  card.innerHTML = `
    <span class="stat-emoji">🪙</span>
    <span class="stat-label">金币</span>
    <span class="stat-value">${val}</span>
  `
}

function renderInventory() {
  const card = document.getElementById('card-inventory')
  if (!card) return
  const foodInventory = PetState.get('foodInventory') || []
  const invMap = {}
  foodInventory.forEach(item => { invMap[item.id] = item.count })

  const items = Object.values(FOOD_META)
  const cells = items.map(food => {
    const count = invMap[food.id] || 0
    const emptyCls = count === 0 ? ' inventory-item--empty' : ''
    return `<div class="inventory-item${emptyCls}" data-food-id="${food.id}">
      <span>${food.emoji}</span>
      <span class="inventory-count">×${count}</span>
    </div>`
  }).join('')

  card.innerHTML = `
    <div class="inventory-title">🎒 食物库存</div>
    <div class="inventory-grid">${cells}</div>
  `
}

function renderAll() {
  renderLevel()
  renderMood()
  renderHunger()
  renderIntimacy()
  renderCoins()
  renderInventory()
}
```

- [ ] **Step 4: 运行应用并验证静态渲染**

启动应用 `npm start`，打开面板，确认 6 张卡片全部渲染，数据正确。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/dashboard/dashboard.js
git commit -m "feat(dashboard): add pet status card rendering functions"
```

---

### Task 4: dashboard.js — 事件监听与快速投喂

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`

**Interfaces:**
- Consumes: `renderAll()`, `renderLevel()`, etc. (from Task 3)
- Produces: `initStatus()` — 初始化入口，事件监听器，快速投喂处理器

- [ ] **Step 1: 追加事件监听与投喂逻辑**

在 Task 3 的代码之后追加：

```js
// ── 事件监听：按 key 增量刷新 ──
function onStateChanged({ key }) {
  switch (key) {
    case 'level':
    case 'exp':
      renderLevel()
      break
    case 'mood':
      renderMood()
      break
    case 'hunger':
      renderHunger()
      break
    case 'intimacy':
      renderIntimacy()
      break
    case 'coins':
      renderCoins()
      break
    case 'foodInventory':
      renderInventory()
      break
  }
}

// ── 快速投喂 ──
function handleFeed(foodId) {
  const food = FOOD_META[foodId]
  if (!food) return

  const foodInventory = PetState.get('foodInventory') || []
  const entry = foodInventory.find(item => item.id === foodId)
  if (!entry || entry.count <= 0) return

  // 消耗 1 个食物
  const newInventory = foodInventory
    .map(item => item.id === foodId ? { ...item, count: item.count - 1 } : item)
    .filter(item => item.count > 0)
  PetState.set('foodInventory', newInventory)

  // 更新饥饿值（饥饿值减小 = 吃饱，clamp 到 0）
  const hunger = PetState.get('hunger') || 0
  PetState.set('hunger', Math.max(0, hunger + food.hunger))

  // 亲密度 +5
  const intimacy = PetState.get('intimacy') || 0
  PetState.set('intimacy', intimacy + 5)
}

// ── 初始化 ──
async function initStatus() {
  await PetState.init()
  buildStatusDOM()

  // 库存点击：事件委托
  document.getElementById('card-inventory').addEventListener('click', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) return
    const foodId = item.dataset.foodId
    if (item.classList.contains('inventory-item--empty')) return
    handleFeed(foodId)
  })

  // 监听状态变化
  PetState.subscribe('pet:state:changed', onStateChanged)

  renderAll()
}

initStatus()
```

- [ ] **Step 2: 验证事件驱动刷新**

启动应用，打开面板，在 pet 窗口右键喂食，观察面板卡片是否实时更新（hunger/intimacy/foodInventory）。

- [ ] **Step 3: 验证快速投喂**

在面板食物库存卡片点击有库存物品格，确认：
- 数量 -1
- 饥饿值减少
- 亲密度 +5
- 切换到 pet 窗口，右键喂食菜单也同步更新（因为 PetState 是同一实例）

- [ ] **Step 4: 验证增量渲染**

在浏览器 DevTools 的 Elements 面板中，观察点击投喂后只有对应卡片 DOM 变化（其他卡片不变）。

- [ ] **Step 5: Commit**

```bash
git add src/renderer/dashboard/dashboard.js
git commit -m "feat(dashboard): add PET_STATE_CHANGED listener and quick feed interaction"
```

---

### Task 5: 更新文档

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

- [ ] **Step 1: 更新 progress.md**

在 `docs/progress.md` 的 "渲染进程 — 面板" 表格中，将状态展示行改为已完成：

```markdown
| 宠物状态展示卡片 | ✅ | 等级/经验/心情/饥饿/亲密度/金币/食物库存 + 快速投喂 |
```

在 `docs/progress.md` 的 "待实现" 列表中，将第 7 项（面板状态页）标记为完成：

```markdown
7. ~~面板状态页（宠物属性展示）~~ ✅ 已完成（dash-01）
```

- [ ] **Step 2: 更新 session-log.md**

在 `docs/session-log.md` 表格末尾追加一行：

```markdown
| **dash-01** | 2026-07-13 | 面板宠物状态展示卡片 | `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 混合布局（等级+经验/心情大卡片 + 饥饿进度条 + 亲密度/金币/食物库存小卡片）；PET_STATE_CHANGED 事件驱动增量刷新；食物 5 列网格物品格 + 左键快速投喂；hunger 颜色反转修正（高=饱=绿，低=饿=红） |
```

- [ ] **Step 3: Commit**

```bash
git add docs/progress.md docs/session-log.md
git commit -m "docs: update progress and session-log for dash-01 pet status display"
```

---

## 验证清单

全部 Task 完成后：

1. **启动应用** `npm start` → 宠物窗口正常显示
2. **双击宠物** → 切换到面板，`#content-area` 显示 6 张状态卡片
3. **数据正确** → 等级/经验/心情/饥饿/亲密度/金币/食物库存与宠物状态一致
4. **饥饿颜色** → hunger > 60 绿色、31-60 黄色、≤ 30 红色
5. **快速投喂** → 点击有库存食物格 → 数量 -1、饥饿减少、亲密度 +5
6. **置灰食物** → 库存为 0 的食物 opacity 0.30，点击无反应
7. **事件联动** → 在 pet 窗口右键喂食后，面板状态自动刷新
8. **nav-bar 不受影响** → 左侧 180px 导航栏保持空白不变
