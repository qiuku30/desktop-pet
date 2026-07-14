# 设置页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把导航栏设置占位落地为真实设置页面，首期 3 个设置项（悬浮提示/面板置顶/面板透明度），配置驱动。

**Architecture:** 新增 `settings-config.js` 纯配置 → `buildSettingsPage()` 遍历配置生成 Tab + 控件 → 控件变更走 `PetState.set('settings', ...)` 即时生效 + 防抖存盘 → 副作用按控件类型分发（IPC / CSS 变量 / 纯守卫）。

**Tech Stack:** JavaScript ES6, Electron IPC (send/on), CSS custom properties, PetState singleton

## Global Constraints

- 只能改 `src/renderer/dashboard/*`、`src/main/storage/store.js`、`src/main/index.js`、`src/main/preload.js`、`docs/progress.md`、`docs/session-log.md`
- 所有数据走 PetState，不新建独立存储
- IPC fire-and-forget 场景用 `send/on`（对齐 tooltip:show 模式）
- 透明度恢复在 `initStatus()` 中 `PetState.init()` 后立即执行，不等用户切到设置页
- 后续新增设置项只追加配置，不改渲染逻辑

---

### Task 1: 新建 settings-config.js（纯配置，零依赖）

**Files:**
- Create: `src/renderer/dashboard/settings-config.js`

**Interfaces:**
- Produces: `SETTINGS_TABS` — 数组，每项 `{ id, label, items[] }`，items 每项 `{ id, label, type, default [, min, max, step] }`

- [ ] **Step 1: 创建配置文件**

```js
// src/renderer/dashboard/settings-config.js
// 设置页配置 — 原则 5 配置驱动
// 新增分类/设置项只需追加配置，不改渲染逻辑

export const SETTINGS_TABS = [
  {
    id: 'general',
    label: '通用',
    items: [
      { id: 'showTooltip', label: '悬浮提示', type: 'toggle', default: true },
    ],
  },
  {
    id: 'window',
    label: '窗口',
    items: [
      { id: 'alwaysOnTop',  label: '面板置顶',   type: 'toggle', default: false },
      { id: 'panelOpacity', label: '面板透明度',  type: 'slider', default: 1.0, min: 0.3, max: 1.0, step: 0.05 },
    ],
  },
]
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/dashboard/settings-config.js
git commit -m "feat: add settings-config.js"
```

---

### Task 2: store.js — 新增 settings 默认值

**Files:**
- Modify: `src/main/storage/store.js`

**Interfaces:**
- Produces: `DEFAULT_STATE.settings` — `{ showTooltip: true, alwaysOnTop: false, panelOpacity: 1.0 }`

- [ ] **Step 1: 在 DEFAULT_STATE 中添加 settings 字段**

在 `src/main/storage/store.js` 的 `DEFAULT_STATE` 对象中，`lastSaved: null` 之前添加：

```js
  settings: {
    showTooltip: true,
    alwaysOnTop: false,
    panelOpacity: 1.0,
  },
```

注意：在 `DEFAULT_STATE` 大括号内，放在 `lastSaved: null,` 这一行之前即可。确保尾部逗号与现有风格一致。

- [ ] **Step 2: 提交**

```bash
git add src/main/storage/store.js
git commit -m "feat: add settings default to store"
```

---

### Task 3: IPC 布线 — preload.js + index.js

**Files:**
- Modify: `src/main/preload.js`
- Modify: `src/main/index.js`

**Interfaces:**
- Consumes: `settings:setAlwaysOnTop` 通道名（与 settings-config.js 中的 `alwaysOnTop` id 对应）
- Produces: `window.electronAPI.setAlwaysOnTop(val)` → renderer 可调用

- [ ] **Step 1: preload.js — 暴露 setAlwaysOnTop**

在 `src/main/preload.js` 的 `contextBridge.exposeInMainWorld('electronAPI', {` 块内，`closeTooltip` 之后添加：

```js
    // 设置
    setAlwaysOnTop: (val) => ipcRenderer.send('settings:setAlwaysOnTop', val),
```

完整插入位置：`closeTooltip: () => ipcRenderer.send('tooltip:close'),` 之后，闭合大括号 `});` 之前。

- [ ] **Step 2: index.js — 注册 IPC handler + 修改 switchToDashboard**

在 `src/main/index.js` 的 `setupIPC()` 函数末尾（`}` 闭合之前）添加：

```js
  // 设置：面板置顶
  ipcMain.on('settings:setAlwaysOnTop', (_event, val) => {
    if (currentMode === 'dashboard') {
      mainWindow.setAlwaysOnTop(val)
    }
  })
```

然后修改 `switchToDashboard()` 函数，将硬编码的 `mainWindow.setAlwaysOnTop(false)` 改为读设置：

找到 `switchToDashboard()` 函数（约第 140 行）：

```js
function switchToDashboard() {
  currentMode = 'dashboard';

  // 保存宠物态位置，切回时恢复
  savedPetBounds = mainWindow.getBounds();

  // 先加载面板页面，再展开窗口，避免宠物闪现
  mainWindow.loadFile(path.join(__dirname, '../renderer/dashboard/dashboard.html'));

  mainWindow.setMaximumSize(0, 0);
  mainWindow.setMinimumSize(600, 400);
  mainWindow.setAlwaysOnTop(false);   // ← 这行
```

将 `mainWindow.setAlwaysOnTop(false);` 替换为：

```js
  // 读取用户设置决定是否置顶
  const state = await getState()
  const alwaysOnTop = state.settings?.alwaysOnTop ?? false
  mainWindow.setAlwaysOnTop(alwaysOnTop);
```

注意：`switchToDashboard` 原本是普通函数（非 async），需要加 `async`：

```js
async function switchToDashboard() {
```

- [ ] **Step 3: 提交**

```bash
git add src/main/preload.js src/main/index.js
git commit -m "feat: add setAlwaysOnTop IPC channel"
```

---

### Task 4: nav-config.js — 启用设置导航项

**Files:**
- Modify: `src/renderer/dashboard/nav-config.js`

- [ ] **Step 1: 把 settings 的 enabled 改为 true**

在 `src/renderer/dashboard/nav-config.js` 中，找到：

```js
  { id: 'settings',  icon: '⚙️', label: '设置',  section: 'bottom', enabled: false, render: buildSettingsPlaceholder },
```

改为：

```js
  { id: 'settings',  icon: '⚙️', label: '设置',  section: 'bottom', enabled: true,  render: null },
```

`render: null` 表示由 `dashboard.js` 的 `initStatus()` 注入（与 home/warehouse/shop 一致）。

- [ ] **Step 2: 提交**

```bash
git add src/renderer/dashboard/nav-config.js
git commit -m "feat: enable settings nav item"
```

---

### Task 5: dashboard.css — 添加 body 透明度 + 设置页样式

**Files:**
- Modify: `src/renderer/dashboard/dashboard.css`

- [ ] **Step 1: 修改 body 背景为可变透明度**

在 `src/renderer/dashboard/dashboard.css` 开头找到：

```css
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
  color: #ccc;
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  -webkit-app-region: no-drag;
  cursor: default;
}
```

在 `html, body` 块**之后**新增一行覆盖 body 背景：

```css
body {
  background: rgba(30, 30, 30, var(--panel-opacity, 1));
}
```

注意：`html, body` 块保持原来的 `background: #1e1e1e;`（作为 fallback），新增的 `body` 块用 `var(--panel-opacity, 1)` 覆盖。`.card`、`#top-bar`、`#nav-bar` 各自有独立的 `background` 属性，不受 body 透传影响。

- [ ] **Step 2: 在文件末尾添加设置页样式**

```css
/* ── 设置页面 ── */

.page--settings {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 设置行容器 */
.settings-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 单行设置项 */
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #2c2c2c;
  border: 1px solid #333;
  border-radius: 8px;
  user-select: none;
}

.settings-row-label {
  font-size: 14px;
  color: #ddd;
}

/* ── Toggle 开关 ── */

.settings-toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.settings-toggle input {
  display: none;
}

.settings-toggle-track {
  display: block;
  width: 100%;
  height: 100%;
  background: #555;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.settings-toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.settings-toggle input:checked + .settings-toggle-track {
  background: #2196f3;
}

.settings-toggle input:checked + .settings-toggle-track::after {
  transform: translateX(20px);
}

/* ── 滑块 ── */

.settings-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.settings-slider-value {
  font-size: 13px;
  color: #aaa;
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.settings-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 120px;
  height: 6px;
  background: #555;
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #2196f3;
  cursor: pointer;
  border: none;
}

/* ── 重置按钮（预留） ── */

.settings-footer {
  padding: 12px 16px;
  border-top: 1px solid #333;
  flex-shrink: 0;
}

.settings-reset-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid #555;
  border-radius: 6px;
  background: transparent;
  color: #555;
  font-size: 13px;
  font-family: inherit;
  cursor: default;
  pointer-events: none;
  transition: none;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/dashboard/dashboard.css
git commit -m "feat: add settings page styles + body opacity CSS variable"
```

---

### Task 6: dashboard.js — 核心逻辑（tooltip 守卫 + 透明度恢复 + buildSettingsPage + 注入 render）

**Files:**
- Modify: `src/renderer/dashboard/dashboard.js`

**Interfaces:**
- Consumes: `SETTINGS_TABS` (from `./settings-config.js`), `PetState`, `window.electronAPI.setAlwaysOnTop`
- Produces: `buildSettingsPage(container)` → cleanup function

- [ ] **Step 1: 在 import 区域添加 settings-config 导入**

在 `dashboard.js` 顶部 import 块，`nav-config.js` 导入行之后添加：

```js
import { SETTINGS_TABS } from './settings-config.js'
```

- [ ] **Step 2: showTooltip 添加开关守卫**

在 `dashboard.js` 中找到 `showTooltip` 函数定义（约第 988 行），在函数体开头 `function showTooltip(food, rect) {` 之后添加：

```js
function showTooltip(food, rect) {
  const settings = PetState.get('settings')
  if (!settings || !settings.showTooltip) return
  // 根据内容行数动态计算高度，避免溢出滚动条
```

- [ ] **Step 3: initStatus 中恢复透明度**

在 `dashboard.js` 的 `initStatus` 函数中，`await PetState.init()` 之后（约第 1009 行），添加透明度恢复逻辑：

```js
  await PetState.init()

  // 恢复面板透明度（必须在 init 之后、渲染之前，避免闪默认值）
  const settings = PetState.get('settings')
  if (settings && settings.panelOpacity != null) {
    document.body.style.setProperty('--panel-opacity', settings.panelOpacity)
  }
```

- [ ] **Step 4: 添加 buildSettingsPage 函数**

把以下函数插入到 `dashboard.js` 中 `buildShopPage` 函数之后、`switchPage` 函数之前（约第 633 行附近）：

```js
// ── 设置页面 ──

function buildSettingsPage(container) {
  container.className = 'page page--settings'

  // 从 PetState 读取当前设置，首次访问时 fallback 到配置 default
  const currentSettings = PetState.get('settings') || {}
  const resolve = (item) => {
    if (currentSettings && currentSettings[item.id] != null) return currentSettings[item.id]
    return item.default
  }

  let activeTabId = SETTINGS_TABS[0].id

  // ── 副作用分发 ──
  function applySideEffect(item, value) {
    switch (item.id) {
      case 'alwaysOnTop':
        window.electronAPI.setAlwaysOnTop(value)
        break
      case 'panelOpacity':
        document.body.style.setProperty('--panel-opacity', value)
        break
      // showTooltip: 无副作用，下次 showTooltip() 调用时读值
    }
  }

  // ── 更新设置（统一入口）──
  function updateSetting(itemId, value) {
    const settings = PetState.get('settings') || {}
    const newSettings = { ...settings, [itemId]: value }
    PetState.set('settings', newSettings)
  }

  // ── 渲染当前 Tab 的设置项 ──
  function renderSettingsList(tabId) {
    const list = container.querySelector('.settings-list')
    if (!list) return

    const tab = SETTINGS_TABS.find(t => t.id === tabId)
    if (!tab) return

    list.innerHTML = tab.items.map(item => {
      const val = resolve(item)

      let controlHTML = ''
      switch (item.type) {
        case 'toggle':
          controlHTML = `
            <label class="settings-toggle">
              <input type="checkbox" data-setting-id="${item.id}" ${val ? 'checked' : ''}>
              <span class="settings-toggle-track"></span>
            </label>`
          break
        case 'slider':
          controlHTML = `
            <div class="settings-slider-row">
              <span class="settings-slider-value" data-slider-value="${item.id}">${val}</span>
              <input type="range" class="settings-slider"
                     data-setting-id="${item.id}"
                     min="${item.min}" max="${item.max}" step="${item.step}"
                     value="${val}">
            </div>`
          break
      }

      return `<div class="settings-row">
        <span class="settings-row-label">${item.label}</span>
        ${controlHTML}
      </div>`
    }).join('')
  }

  function setActiveTab(tabId) {
    container.querySelectorAll('.wh-tab').forEach(tab => {
      tab.classList.toggle('wh-tab--active', tab.dataset.catId === tabId)
    })
  }

  // ── 初始渲染 ──
  container.innerHTML = `
    <div class="wh-tabs">
      ${SETTINGS_TABS.map(tab => `
        <button class="wh-tab${tab.id === activeTabId ? ' wh-tab--active' : ''}"
                data-cat-id="${tab.id}">${tab.label}</button>
      `).join('')}
    </div>
    <div class="settings-list"></div>
    <div class="settings-footer">
      <button class="settings-reset-btn" disabled>重置所有设置</button>
    </div>
  `

  renderSettingsList(activeTabId)

  // ── Tab 切换 ──
  container.querySelector('.wh-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.wh-tab')
    if (!tab) return
    const tabId = tab.dataset.catId
    if (tabId === activeTabId) return

    activeTabId = tabId
    setActiveTab(tabId)

    const list = container.querySelector('.settings-list')
    list.style.opacity = '0'
    setTimeout(() => {
      renderSettingsList(tabId)
      requestAnimationFrame(() => { list.style.opacity = '1' })
    }, 150)
  })

  // ── 设置列表事件委托 ──
  container.querySelector('.settings-list').addEventListener('change', (e) => {
    // Toggle 切换
    const checkbox = e.target.closest('.settings-toggle input[type="checkbox"]')
    if (checkbox) {
      const itemId = checkbox.dataset.settingId
      const checked = checkbox.checked
      updateSetting(itemId, checked)
      const tab = SETTINGS_TABS.find(t => t.items.some(i => i.id === itemId))
      const item = tab ? tab.items.find(i => i.id === itemId) : null
      if (item) applySideEffect(item, checked)
      return
    }
  })

  container.querySelector('.settings-list').addEventListener('input', (e) => {
    // 滑块拖动
    const slider = e.target.closest('.settings-slider')
    if (!slider) return
    const itemId = slider.dataset.settingId
    const val = parseFloat(slider.value)
    // 更新数值显示
    const valEl = container.querySelector(`[data-slider-value="${itemId}"]`)
    if (valEl) valEl.textContent = val
    updateSetting(itemId, val)
    const tab = SETTINGS_TABS.find(t => t.items.some(i => i.id === itemId))
    const item = tab ? tab.items.find(i => i.id === itemId) : null
    if (item) applySideEffect(item, val)
  })

  // ── 首次进入设置页时恢复面板置顶 ──
  const alwaysOnTopItem = SETTINGS_TABS
    .flatMap(t => t.items)
    .find(i => i.id === 'alwaysOnTop')
  if (alwaysOnTopItem) {
    applySideEffect(alwaysOnTopItem, resolve(alwaysOnTopItem))
  }

  // 返回清理函数（首期无订阅，预留）
  return () => {}
}
```

- [ ] **Step 5: initStatus 中注入 settings render + 恢复面板置顶**

在 `initStatus()` 中，`shopItem` 的 render 注入之后（约第 1023 行），添加：

```js
  const settingsItem = NAV_ITEMS.find(n => n.id === 'settings')
  if (settingsItem) settingsItem.render = buildSettingsPage
```

- [ ] **Step 6: 提交**

```bash
git add src/renderer/dashboard/dashboard.js
git commit -m "feat: add settings page — buildSettingsPage, tooltip guard, opacity recovery"
```

---

### Task 7: 文档更新

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/session-log.md`

- [ ] **Step 1: 更新 progress.md**

在 `docs/progress.md` 的「渲染进程 — 面板」表中，仓库页面条目之后新增一行：

```markdown
| 设置页面 | ✅ | dash-09：首期 3 个设置项（悬浮提示开关/面板置顶/面板透明度），配置驱动，Tab 分组，即时生效+自动保存；IPC send/on 置顶，CSS 变量透明度；扩展预留 reset 按钮 + unlockLevel/disabled 字段 |
```

同时在「待实现」列表中移除设置相关条目（如果有的话）。

- [ ] **Step 2: 更新 session-log.md**

在 `docs/session-log.md` 末尾追加：

```markdown
## dash-09 — 2026-07-14

**功能**：设置页面（首期 3 个设置项：悬浮提示开关 / 面板置顶 / 面板透明度）
**改动文件**：
- `src/renderer/dashboard/settings-config.js`（新建）
- `src/renderer/dashboard/nav-config.js`
- `src/renderer/dashboard/dashboard.js`
- `src/renderer/dashboard/dashboard.css`
- `src/main/storage/store.js`
- `src/main/preload.js`
- `src/main/index.js`
- `docs/progress.md`
- `docs/session-log.md`
**越界授权**：`store.js`（settings 默认值）、`index.js`（setAlwaysOnTop IPC）、`preload.js`（暴露 setAlwaysOnTop）
**备注**：透明度在 initStatus() 中恢复避免闪烁；IPC 用 send/on 对齐项目风格；Tab 复用 .wh-tabs 样式
```

- [ ] **Step 3: 提交**

```bash
git add docs/progress.md docs/session-log.md
git commit -m "docs: update progress and session-log for settings page"
```

---

### Task 8: 应用启动验证

- [ ] **Step 1: 启动应用**

```bash
npm start
```

- [ ] **Step 2: 验证清单**

按顺序检查：
1. 桌面宠物正常显示，右键菜单正常
2. 双击进入面板，导航栏底部「⚙️ 设置」可点击（非置灰）
3. 点击设置 → 显示「通用」Tab（默认选中），1 个设置项「悬浮提示」，Toggle 默认开启
4. 切换到「窗口」Tab → 2 个设置项：面板置顶（Toggle 默认关闭）、面板透明度（滑块默认 1.0）
5. 拖动透明度滑块 → 面板底色实时变透明，文字/卡片/导航栏保持实色
6. 关闭面板再打开 → 透明度保持上次设定值（无闪烁）
7. 关闭悬浮提示 → 鼠标悬停主页库存/仓库物品不弹 tooltip
8. 勾选面板置顶 → 切换到面板态时窗口置顶（可用其他窗口覆盖测试）
9. 关闭应用重启 → 所有设置保持
10. 切回宠物态 → 宠物仍然置顶（不受面板置顶设置影响）
