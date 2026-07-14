# 面板模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `nav-config.js` — 导航配置（原则 5 配置驱动）
- `#dashboard` — 面板根容器
- `#top-bar` — 顶部栏（标题拖拽区 + 关闭按钮）
- `#nav-bar` — 导航栏（nav-config.js 配置驱动，上下分区 + 事件委托切换页面）
- `#content-area` — 内容区，flex column 分为上下两层：
  - `.portrait-layer` — 上半区：形象展示层（左槽位 + 中央立绘 + 右槽位）
  - `.info-layer` — 下半区：信息数据层（等级/经验、心情、饱腹度、亲密度、金币、食物库存），`overflow-y: auto` 独立滚动

## 上半区 — 形象展示层

- **容器** `.portrait-layer`：flex row，`flex: 1`
- **中央** `.portrait-area`：emoji 占位 🐱，`font-size: min(18vw, 140px)`，独立容器包裹，未来替换为 `<img>` / `<canvas>`
- **左右槽位** `.slot-list` > `.slot-item` × 3：56px 宽，纵向排列，`border: 1px dashed #555` 占位

## 下半区 — 信息数据层

- **容器** `.info-layer`：flex column，`flex: 1`，`overflow-y: auto`（只有下半区滚动，上半区固定）
- **行容器** 语义化 class，通过 grid 控制列数：
  - `.info-row--2col`：2 列 grid（等级+心情）
  - `.info-row--full`：整行（饱腹度）
  - `.info-row--3col`：3 列 grid（亲密度+金币+食物库存）
- **扩展**：新增行只需 `<section class="info-row--xxx">` + 对应 CSS

## 状态切换

- 宠物态 ↔ 面板态：loadFile 切换 HTML + 窗口 resize
- 面板内导航切换：`switchPage(pageId)` → fade 动画 → 替换 `#content-area` 内容，PetState 订阅不销毁

## 导航配置

- `nav-config.js` — 导航配置数组 `NAV_ITEMS`（原则 5 配置驱动）
  - 每项：`{ id, icon, label, section, enabled, render }`
  - `section: 'top'` — 上部区域；`section: 'bottom'` — `margin-top: auto` 推到底部
  - `enabled: false` → `.nav-item--disabled`（`pointer-events: none` + 半透明）
  - 占位页面统一使用 `buildPlaceholderPage(container, icon, label)` 渲染

## 设置页面

- `settings-config.js` — 配置驱动的 Tab + 设置项数组 `SETTINGS_TABS`
  - 每项：`{ id, label, type, default [, min, max, step] }`
  - type 枚举：`toggle` | `slider` | `select`（select 未实装）
- `buildSettingsPage(container)` — 遍历配置生成 Tab（复用 `.wh-tabs`）+ 设置行
- 数据流：控件变更 → `PetState.set('settings', ...)` → 即时生效 + 500ms 防抖存盘
- 副作用按控件类型分发：alwaysOnTop → IPC send/on → `mainWindow.setAlwaysOnTop()`；showTooltip → 无副作用，`showTooltip()` 调用时读值判断
- 扩展预留：底部"重置所有设置"按钮（置灰）、配置项 `unlockLevel` / `disabled` 字段
- 🟡 搁置：面板透明度（CSS `--panel-opacity` 无法穿透 `transparent:false` 窗口，恢复需窗口透明 + frame:false + 自绘标题栏）
