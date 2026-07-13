# Dashboard Left Navigation Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add left navigation bar to dashboard, upgrading from single-page to multi-page switching architecture.

**Architecture:** Navigation config array (`nav-config.js`) drives rendering. `#content-area` becomes a page container. `dashboard.js` manages page switching with fade transitions. Placeholder items are greyed out with `pointer-events: none`.

**Tech Stack:** Vanilla JS ES6 modules, CSS animations, Electron renderer

## Global Constraints

- Only modify: `src/renderer/dashboard/*`, `docs/progress.md`, `docs/session-log.md`
- Follow principle 5 (config-driven): nav items defined in `nav-config.js`
- Follow principle 1 (low coupling): nav bar and content area decoupled
- Follow ADR-002: event naming `模块名:动作:状态`
- No cross-module imports
- All CSS uses existing dark theme colors (`#252525`, `#333`, `#2c2c2c`)
- Commit language: English

---

### Task 1: Create nav-config.js — navigation configuration

**Files:**
- Create: `src/renderer/dashboard/nav-config.js`

**Interfaces:**
- Consumes: nothing
- Produces: `NAV_ITEMS` array — each item `{ id, icon, label, section, enabled, render }`
- Produces: `buildWarehousePlaceholder()`, `buildShopPlaceholder()`, `buildSettingsPlaceholder()`

- [ ] **Step 1: Create the file with config array and placeholder renderers**

```js
// 面板导航配置 — 原则 5 配置驱动
// 加新导航项只需在此数组中加一行

import { FOODS } from '../shared/feed-service.js'

/**
 * 导航配置项
 * @typedef {{ id: string, icon: string, label: string, section: 'top'|'bottom', enabled: boolean, render: (container: HTMLElement) => void }} NavItem
 */

/**
 * 通用占位页面渲染器
 * @param {HTMLElement} container
 * @param {string} icon
 * @param {string} label
 */
function buildPlaceholderPage(container, icon, label) {
  container.innerHTML = `
    <div class="placeholder-page">
      <div class="placeholder-icon">${icon}</div>
      <div class="placeholder-label">${label}</div>
      <div class="placeholder-hint">即将开放，敬请期待</div>
    </div>
  `
}

function buildWarehousePlaceholder(container) {
  buildPlaceholderPage(container, '🎒', '仓库')
}

function buildShopPlaceholder(container) {
  buildPlaceholderPage(container, '🛒', '商店')
}

function buildSettingsPlaceholder(container) {
  buildPlaceholderPage(container, '⚙️', '设置')
}

export const NAV_ITEMS = [
  { id: 'home',     icon: '🏠', label: '主页', section: 'top',    enabled: true,  render: null }, // render 在 dashboard.js 注入
  { id: 'warehouse', icon: '🎒', label: '仓库', section: 'top',    enabled: false, render: buildWarehousePlaceholder },
  { id: 'shop',     icon: '🛒', label: '商店', section: 'top',    enabled: false, render: buildShopPlaceholder },
  { id: 'settings', icon: '⚙️', label: '设置', section: 'bottom', enabled: false, render: buildSettingsPlaceholder },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/dashboard/nav-config.js
git commit -m "feat: add nav-config.js with navigation items and placeholder renderers"
```

### Task 2: Refactor dashboard.js — page switching architecture

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`

**Interfaces:**
- Consumes: `NAV_ITEMS` from `nav-config.js`, `PetState` from `pet-state.js`, `EVENTS` from `events.js`
- Produces: `buildHomePage()` — sets `#content-area` innerHTML and wires up event listeners

- [ ] **Step 1: Add nav imports and state variables**

At the top of `dashboard.js`, add after existing imports:

```js
import { NAV_ITEMS } from './nav-config.js'
```

Add after the `TOOLTIP_FIELDS` constant:

```js
// ── 导航状态 ──
let currentPageId = 'home'
```

- [ ] **Step 2: Rename buildStatusDOM to buildHomePage, wrap with page container class**

Replace `buildStatusDOM()` with `buildHomePage()`:

```js
function buildHomePage() {
  const area = document.getElementById('content-area')
  area.className = 'page page--home'
  area.innerHTML = `
    <!-- 上半区：形象展示 -->
    <section class="portrait-layer">
      <div class="slot-list" id="slots-left">
        <div class="slot-item"></div>
        <div class="slot-item"></div>
        <div class="slot-item"></div>
      </div>
      <div class="portrait-area" id="portrait-area">🐱</div>
      <div class="slot-list" id="slots-right">
        <div class="slot-item"></div>
        <div class="slot-item"></div>
        <div class="slot-item"></div>
      </div>
    </section>

    <!-- 下半区：信息数据 -->
    <section class="info-layer">
      <div class="info-row--2col">
        <div class="card card--level" id="card-level"></div>
        <div class="card card--mood" id="card-mood"></div>
      </div>
      <div class="info-row--full">
        <div class="card card--satiety" id="card-satiety"></div>
      </div>
      <div class="info-row--3col">
        <div class="card card--intimacy" id="card-intimacy"></div>
        <div class="card card--coins" id="card-coins"></div>
        <div class="card card--inventory" id="card-inventory"></div>
      </div>
    </section>
  `
}
```

- [ ] **Step 3: Add page switching function**

Add after `buildHomePage()`:

```js
// ── 页面切换 ──
function switchPage(pageId) {
  if (currentPageId === pageId) return

  const item = NAV_ITEMS.find(n => n.id === pageId)
  if (!item || !item.enabled) return

  const area = document.getElementById('content-area')

  // fade out
  area.style.opacity = '0'

  setTimeout(() => {
    // 渲染目标页面
    if (pageId === 'home') {
      buildHomePage()
      // 重新绑定主页事件（库存点击/悬停）
      bindHomePageEvents()
      // 重新渲染所有卡片值
      renderAll()
    } else {
      item.render(area)
    }

    currentPageId = pageId

    // fade in
    requestAnimationFrame(() => {
      area.style.opacity = '1'
    })

    // 更新导航高亮
    updateNavActive()
  }, 150)
}
```

- [ ] **Step 4: Add nav bar rendering and active state update**

Add:

```js
// ── 导航栏渲染 ──
function buildNavBar() {
  const nav = document.getElementById('nav-bar')
  if (!nav) return

  const topItems = NAV_ITEMS.filter(n => n.section === 'top')
  const bottomItems = NAV_ITEMS.filter(n => n.section === 'bottom')

  nav.innerHTML = `
    <div class="nav-section nav-section--top">
      ${topItems.map(item => `
        <button class="nav-item${!item.enabled ? ' nav-item--disabled' : ''}${item.id === currentPageId ? ' nav-item--active' : ''}"
                data-nav-id="${item.id}"
                ${!item.enabled ? 'disabled' : ''}>
          <span class="nav-item-icon">${item.icon}</span>
          <span class="nav-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
    <div class="nav-section nav-section--bottom">
      ${bottomItems.map(item => `
        <button class="nav-item${!item.enabled ? ' nav-item--disabled' : ''}${item.id === currentPageId ? ' nav-item--active' : ''}"
                data-nav-id="${item.id}"
                ${!item.enabled ? 'disabled' : ''}>
          <span class="nav-item-icon">${item.icon}</span>
          <span class="nav-item-label">${item.label}</span>
        </button>
      `).join('')}
    </div>
  `

  // 事件委托：导航点击
  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item')
    if (!btn) return
    const pageId = btn.dataset.navId
    if (!pageId) return
    switchPage(pageId)
  })
}

function updateNavActive() {
  const nav = document.getElementById('nav-bar')
  if (!nav) return
  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('nav-item--active', btn.dataset.navId === currentPageId)
  })
}
```

- [ ] **Step 5: Extract homepage event binding into a function**

Add `bindHomePageEvents()`:

```js
function bindHomePageEvents() {
  // 库存点击：事件委托
  document.getElementById('card-inventory').addEventListener('click', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) return
    const foodId = item.dataset.foodId
    if (item.classList.contains('inventory-item--empty')) return
    handleFeed(foodId)
  })

  // 库存悬停：tooltip（捕获阶段，处理子元素事件）
  document.getElementById('card-inventory').addEventListener('mouseenter', (e) => {
    const item = e.target.closest('.inventory-item')
    if (!item) { hideTooltip(); return }
    const food = FOODS[item.dataset.foodId]
    if (!food) { hideTooltip(); return }
    showTooltip(food, item.getBoundingClientRect())
  }, true)

  document.getElementById('card-inventory').addEventListener('mouseleave', () => {
    hideTooltip()
  }, true)
}
```

- [ ] **Step 6: Update initStatus to use new functions**

Replace the old `initStatus()`:

```js
// ── 初始化 ──
async function initStatus() {
  await PetState.init()

  // 注入主页渲染函数到 nav-config
  const homeItem = NAV_ITEMS.find(n => n.id === 'home')
  if (homeItem) homeItem.render = (container) => {
    buildHomePage()
    bindHomePageEvents()
    renderAll()
  }

  // 渲染导航栏
  buildNavBar()

  // 加载默认页面（主页）
  buildHomePage()
  bindHomePageEvents()

  // 监听状态变化
  PetState.subscribe(EVENTS.PET_STATE_CHANGED, onStateChanged)

  renderAll()
}

initStatus().catch(err => console.error('[Dashboard] 状态初始化失败:', err))
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/dashboard/dashboard.js
git commit -m "feat: add page switching architecture with nav bar integration"
```

### Task 3: Update dashboard.css — navigation bar styles

**Files:**
- Modify: `src/renderer/dashboard/dashboard.css`

**Interfaces:**
- Consumes: nav bar DOM structure (`#nav-bar`, `.nav-section`, `.nav-item`, `.nav-item--active`, `.nav-item--disabled`)
- Produces: visual styling for navigation bar, placeholder page, fade transitions

- [ ] **Step 1: Update #nav-bar and #content-area styles**

Replace the existing `#nav-bar` and `#content-area` blocks:

```css
#nav-bar {
  width: 180px;
  flex-shrink: 0;
  background: #252525;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.15s ease;
}
```

- [ ] **Step 2: Add nav section and nav item styles**

Add after `#content-area`:

```css
/* ── 导航栏 ── */

.nav-section {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
}

.nav-section--top {
  flex: 0 0 auto;
}

.nav-section--bottom {
  margin-top: auto;
  border-top: 1px solid #333;
  padding-top: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #999;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  text-align: left;
  width: 100%;
  border-left: 3px solid transparent;
}

.nav-item:hover:not(.nav-item--disabled) {
  background: #333;
  color: #ddd;
}

.nav-item--active {
  background: #3a3a3a;
  color: #fff;
  border-left-color: #2196f3;
}

.nav-item--disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

.nav-item-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.nav-item-label {
  font-size: 14px;
  white-space: nowrap;
}
```

- [ ] **Step 3: Add placeholder page styles**

Add:

```css
/* ── 占位页面 ── */

.placeholder-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #666;
  user-select: none;
}

.placeholder-icon {
  font-size: 48px;
  line-height: 1;
}

.placeholder-label {
  font-size: 20px;
  color: #888;
}

.placeholder-hint {
  font-size: 13px;
  color: #555;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/dashboard/dashboard.css
git commit -m "feat: add nav bar and placeholder page styles"
```

### Task 4: Update docs

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

- [ ] **Step 1: Update progress.md**

Add to the dashboard table in `docs/progress.md`:

```markdown
| 左侧导航栏 + 多页切换 | ✅ | dash-03：nav-config.js 配置驱动、4 项导航（主页/仓库/商店/设置）、占位页面、暗色主题 + 选中高亮 + fade 动画 |
```

- [ ] **Step 2: Update session-log.md**

Add to the dash section:

```markdown
| **dash-03** | 2026-07-14 | 面板左侧导航栏 + 多页切换架构 | `dashboard/nav-config.js` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 新增 nav-config.js（原则5配置驱动，4项导航）；refactor dashboard.js：buildStatusDOM→buildHomePage、switchPage()、导航渲染/高亮、fade 过渡；占位页面通用函数；暗色主题(#252525)+选中高亮(#2196f3左边框)；置灰项 pointer-events:none；先讨论设计再编码 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/progress.md docs/session-log.md
git commit -m "docs: update progress and session log for dash-03 nav bar"
```
