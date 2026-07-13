# 面板模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#dashboard` — 面板根容器
- `#top-bar` — 顶部栏（标题拖拽区 + 关闭按钮）
- `#nav-bar` — 导航栏（占位，待 module-registry.js 驱动渲染）
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
- 面板内导航切换（待实现）：替换 `#content-area` 内容

## 模块加载（待实现）

- 读取 `module-registry.js` 的 MODULES 数组
- 渲染导航按钮
- 点击导航按钮时动态加载对应模块
