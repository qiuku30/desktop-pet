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

- **容器** `.portrait-layer`：flex row，`flex: 1; min-height: 0`，允许其作为
  `#content-area` 的直接纵向 flex 子项收缩，避免图片固有高度挤压信息区
- **中央** `.portrait-area`：`align-self: stretch; overflow: hidden; min-height: 0`，
  高度受形象层可用空间约束
  - `<img class="portrait-img">` 加载 `../assets/pet/cream-star/portrait.webp`，`max-width/max-height: 100%` + `object-fit: contain` 保持透明背景和原始宽高比
  - `<span class="portrait-fallback">` 默认 `display: none`，图片加载失败时 `onerror` 显示 🐱 emoji（`font-size: min(18vw, 140px)`）
  - 不加载动画帧，不创建 Canvas，不复用宠物窗口运行时
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
- 面板内导航切换：`switchPage(pageId)` → fade 动画 → 替换 `#content-area` 内容。
- `page-navigation.js` 集中管理单调递增 navigation token 和页面 cleanup。异步模块
  先挂载到离屏 staging 容器，只有 token 仍有效时才激活；迟到模块立即执行 cleanup，
  不能覆盖当前页面或当前 cleanup。
- mounted page 身份只在渲染与激活成功后提交；旧页开始 cleanup 时立即清空。加载或
  激活失败后，失败目标与旧入口都可重新渲染，错误结果不会注册为 current page 或
  current cleanup；若 render 已产生 cleanup 而 activate 失败，该 cleanup 恰好执行一次。
- 关闭面板会使当前 token 失效并调用当前页面 cleanup。

## 导航配置

- `nav-config.js` — 导航配置数组 `NAV_ITEMS`（原则 5 配置驱动）
  - 每项：`{ id, icon, label, section, enabled, render }`
  - `section: 'top'` — 上部区域；`section: 'bottom'` — `margin-top: auto` 推到底部
  - `enabled: false` → `.nav-item--disabled`（`pointer-events: none` + 半透明）
  - 占位页面统一使用 `buildPlaceholderPage(container, icon, label)` 渲染

## 动态模块

- `src/renderer/shared/module-registry.js` 保存 `{ id, modulePath }`。
- 农场注册为 `{ id: 'farm', modulePath: '../games/farm/farm-module.js' }`。
- Dashboard 只通过 `loadRegisteredModule()` 加载模块，并只调用公开
  `mount(container, options)` 合约。
- 农场导航固定在番茄之后、2048 之前；Dashboard 通过
  `onNavigateWarehouse` 回调提供仓库跳转，不允许农场直接 import 仓库实现。
- 配置、动态 import 或 mount 失败时只在内容区显示错误占位，其他页面继续可用。

## 设置页面

- `settings-config.js` — 配置驱动的 Tab + 设置项数组 `SETTINGS_TABS`
  - 每项：`{ id, label, type, default [, min, max, step] }`
  - type 枚举：`toggle` | `slider` | `select`（select 未实装）
- `buildSettingsPage(container)` — 遍历配置生成 Tab（复用 `.wh-tabs`）+ 设置行
- 数据流：控件变更 → `PetState.set('settings', ...)` → 即时生效 + 500ms 防抖存盘
- 副作用按控件类型分发：alwaysOnTop → IPC send/on → `mainWindow.setAlwaysOnTop()`；showTooltip → 无副作用，`showTooltip()` 调用时读值判断
- 扩展预留：底部"重置所有设置"按钮（置灰）、配置项 `unlockLevel` / `disabled` 字段
- 🟡 搁置：面板透明度（CSS `--panel-opacity` 无法穿透 `transparent:false` 窗口，恢复需窗口透明 + frame:false + 自绘标题栏）

## 统一仓库与商店

- 仓库和主页库存卡只读取通用 `inventory`，物品展示、分类、投喂能力、买价和售价统一来自共享物品目录。
- 仓库分类固定为全部、食物、作物、种子、材料；出售和销毁通过通用数量 overlay 选择数量，确认后各自只调用一次 `PetState.setMany()`。
- 商店保留五种普通食物并展示六种种子；普通食物和已解锁种子都支持批量购买。锁定种子仍可见，置灰并显示 `农场 Lv.X 解锁`。
- 购买事务同时提交金币和库存；页面离开时取消订阅、延迟分类渲染并关闭未完成 overlay。
