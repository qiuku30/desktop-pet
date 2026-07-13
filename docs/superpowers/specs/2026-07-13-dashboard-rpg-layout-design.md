# Dashboard RPG 角色卡布局重构

> dash-02, 2026-07-13

## 目标

面板从"卡片平铺"改为「角色展示式」布局：上半区形象展示，下半区信息数据。

## 整体结构

```
┌──────────┬──────────────────────────────────────┐
│          │         top-bar (保留)                │
│          ├────────┬───────────────┬─────────────┤
│          │        │               │             │
│  nav-bar │ 槽位×3 │   🐱 (60%)   │  槽位×3     │  ← 上半区 50%
│ (保留)   │        │               │             │
│          ├────────┴───────────────┴─────────────┤
│          │                                     │
│          │  Lv/Exp    │    心情                │  ← 下半区 50%
│          │  ─────────────────────────          │
│          │  饱腹度 ████████░░░                 │
│          │  ─────────────────────────          │
│          │  亲密度  │  金币  │  食物库存       │
│          │                                     │
└──────────┴──────────────────────────────────────┘
```

## 上半区 — 形象展示层 (`.portrait-layer`, flex: 1)

- **容器**：flex row，三栏（左槽位 / 中央立绘 / 右槽位）
- **中央** `.portrait-area`：
  - emoji 占位，字号约 60% 上半区高度
  - 独立容器包裹，未来替换为 `<img>` / `<canvas>` / 动画元素
- **左右槽位** `.slot-list`：
  - 各 3 个 `.slot-item`，纵向排列，等大居中
  - 虚线边框占位：`border: 1px dashed #555`
  - 空框，无图标无文字

## 下半区 — 信息数据层 (`.info-layer`, flex: 1, overflow-y: auto)

保持现有信息排列，使用语义化行容器方便扩展：

- **行 1** `.info-row--2col`：等级/经验 + 心情
- **行 2** `.info-row--full`：饱腹度进度条
- **行 3** `.info-row--3col`：亲密度 + 金币 + 食物库存
- 扩展方式：加 `<section class="info-row--xxx">` + 对应 CSS 即可

## CSS 改动

- `#content-area` → `flex-direction: column`（不再 `overflow-y: auto`，滚动下沉到 `.info-layer`）
- 新增 `.portrait-layer` / `.portrait-area` / `.slot-list` / `.slot-item` / `.info-layer` / `.info-row--*`
- 保留所有现有 `.card` / `.progress-bar` / `.progress-fill--*` / `.inventory-*` / `.toast` 样式

## JS 改动

**只改** `buildStatusDOM()` 的 innerHTML 字符串，按新布局生成 DOM。

**不动**：
- 事件委托 `#card-inventory` click → `handleFeed()`
- `render*()` 系列函数（`renderLevel` / `renderMood` / `renderSatiety` / `renderIntimacy` / `renderCoins` / `renderInventory`）
- `handleFeed()` / `showToast()` / `onStateChanged()` / `initStatus()`
- 窗口缩放逻辑
- `PetState.subscribe('pet:state:changed', onStateChanged)` 数据流

## 约束

- 保留 `#nav-bar`（左侧 180px）
- 保留 `#top-bar` + 关闭按钮
- 窗口缩放不动（dashboard.js 边缘拖拽 + setBounds IPC）
- 食物库存快速投喂功能保留，位置在下半区第三行
- 所有现有 id（`card-level` / `card-mood` / `card-satiety` / `card-intimacy` / `card-coins` / `card-inventory`）保持不动，确保 `render*()` 能找到目标元素
