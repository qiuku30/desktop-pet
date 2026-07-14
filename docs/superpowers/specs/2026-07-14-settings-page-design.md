# 设置页面设计

## 概述

把导航栏 ⚙️ 设置占位落地为真实设置页面。首期 3 个设置项，分两个 Tab，配置驱动。

## 文件变更清单

| 文件 | 动作 | 说明 |
|------|------|------|
| `src/renderer/dashboard/settings-config.js` | 新建 | 设置页配置数组 |
| `src/renderer/dashboard/nav-config.js` | 改 1 处 | `enabled: true` |
| `src/renderer/dashboard/dashboard.js` | 新增函数 + 注入 render | `buildSettingsPage()` |
| `src/renderer/dashboard/dashboard.css` | 新增样式块 | 设置页 CSS |
| `src/main/storage/store.js` | 加默认值 | `settings` 字段 |
| `src/main/index.js` | 加 1 个 handler | `settings:setAlwaysOnTop` IPC |
| `src/main/preload.js` | 加 1 行 | 暴露 `setAlwaysOnTop` |
| `docs/progress.md` | 更新 | 进度同步 |
| `docs/session-log.md` | 更新 | 窗口登记 |

## 配置结构

`settings-config.js` — 配置驱动的 Tab + 设置项数组：

```js
export const SETTINGS_TABS = [
  {
    id: 'general', label: '通用',
    items: [
      { id: 'showTooltip', label: '悬浮提示', type: 'toggle', default: true },
    ],
  },
  {
    id: 'window', label: '窗口',
    items: [
      { id: 'alwaysOnTop',  label: '面板置顶',   type: 'toggle', default: false },
      { id: 'panelOpacity', label: '面板透明度',  type: 'slider', default: 1.0, min: 0.3, max: 1.0, step: 0.05 },
    ],
  },
]
```

后续新增分类/设置项只追加配置，不改渲染逻辑。

## 存储

`store.js` DEFAULT_STATE 新增：

```js
settings: {
  showTooltip: true,
  alwaysOnTop: false,
  panelOpacity: 1.0,
}
```

读写统一走 `PetState.get/set('settings', ...)`。修改即自动持久化（已有 500ms 防抖）。

## 数据流

```
设置页 Toggle/Slider 变化
  → PetState.set('settings', {...})     // 即时生效 + 防抖存盘
  → 副作用（按控件类型）:
      Toggle(alwaysOnTop) → IPC send → mainWindow.setAlwaysOnTop(bool)
      Slider(panelOpacity) → document.body.style.setProperty('--panel-opacity', val)
      Toggle(showTooltip)  → 无副作用，下次 showTooltip() 调用时读值判断
```

## 各设置项详细

### 悬浮提示开关

- 零 IPC，纯 JS 守卫
- `dashboard.js` 的 `showTooltip(food, rect)` 函数头加：

```js
function showTooltip(food, rect) {
  const settings = PetState.get('settings')
  if (!settings.showTooltip) return
  // ...原有逻辑
}
```

- 覆盖所有调用场景：主页库存悬停、仓库物品悬停、商店商品悬停

### 面板置顶

- IPC 通道：`settings:setAlwaysOnTop`，使用 `send/on`（fire-and-forget，无返回值，对齐 `tooltip:show` 风格）
- `main/preload.js` 暴露：`setAlwaysOnTop: (val) => ipcRenderer.send('settings:setAlwaysOnTop', val)`
- `main/index.js` handler：`ipcMain.on('settings:setAlwaysOnTop', (_e, val) => { mainWindow.setAlwaysOnTop(val) })`
- 切换回面板态时也需恢复：`switchToDashboard()` 读 `settings.alwaysOnTop` 决定是否置顶（当前硬编码 `false`）

### 面板透明度

- 纯 CSS + JS，零 IPC
- CSS 级联：`html, body { background: #1e1e1e; }` → `body { background: rgba(30, 30, 30, var(--panel-opacity, 1)); }` 覆盖
- `.card`、`#top-bar`、`#nav-bar` 各自有独立 `background`，不被 body 透传
- 恢复时机：`initStatus()` 中 `PetState.init()` 之后立即设 CSS 变量（不等用户切到设置页）：
  ```js
  const s = PetState.get('settings')
  document.body.style.setProperty('--panel-opacity', s?.panelOpacity ?? 1)
  ```
- 滑块 input 事件 → 同时设 CSS 变量 + PetState

## 页面布局

```
┌──────────────────────────────────────────┐
│ [通用] [窗口]                             │  ← 复用 .wh-tabs 样式
├──────────────────────────────────────────┤
│  悬浮提示                        [Toggle] │
│  面板置顶                        [Toggle] │
│  面板透明度          0.85  [━━━━━●━━]    │  ← 滑块 + 实时数值
├──────────────────────────────────────────┤
│               [重置所有设置]   (置灰)      │  ← 预留，后续启用
└──────────────────────────────────────────┘
```

## 扩展预留

- 配置数组预留 `unlockLevel` / `disabled` 字段（未实装功能自动置灰）
- 设置项 `type` 枚举：`toggle` / `slider` / `select`（后两种首期只用 slider）
- 底部「重置所有设置」按钮预留，置灰，后续穿透功能上线时启用

## 设置页渲染函数

`buildSettingsPage(container)` — 放在 `dashboard.js`，模式与 `buildWarehousePage` / `buildShopPage` 一致：

1. 遍历 `SETTINGS_TABS` 生成 Tab 栏（复用 `.wh-tabs` 样式）
2. 读取 `PetState.get('settings')` 当前值（首次访问时可能为 undefined，fallback 到配置里的 default）
3. 遍历当前 Tab 的 items 生成设置行（`.settings-row`）
4. 绑定事件：Toggle 切换 / Slider 拖动 → 更新 PetState + 触发副作用
5. 首次进入设置页时恢复面板置顶（调 IPC）— 透明度恢复在 `initStatus()` 更早完成，不在此处
6. 返回清理函数（如有订阅，首期无）

## 边界情况

- 首次使用无存档：`PetState.get('settings')` 返回 `undefined`，渲染时 fallback 到配置里的 `default` 字段
- 面板态 ↔ 宠物态切换：面板置顶只在面板态生效，切回宠物态时强制 `alwaysOnTop: true`（宠物窗口始终置顶）
- 透明度滑块极值：min 0.3 保证面板内容始终可读
