# 面板宠物状态展示 — 设计文档

> dash-01 | 2026-07-13

## 概述

在 `#content-area` 渲染宠物状态卡片，展示等级、经验、心情、饥饿、亲密度、金币、食物库存。
监听 `PET_STATE_CHANGED` 事件自动增量刷新。

## 布局

混合布局：

```
┌──────────────────────────────────────────────┐
│  #top-bar  摸鱼面板                        ✕ │
├────────┬─────────────────────────────────────┤
│        │  ┌──────────┐  ┌───────────────┐    │
│  nav   │  │ Lv.3     │  │ 😊            │    │
│  bar   │  │ ████░░░░ │  │   心情：开心   │    │
│        │  │ 经验 42  │  │               │    │
│ 180px  │  └──────────┘  └───────────────┘    │
│        │  ┌──────────────────────────────┐    │
│ (不改) │  │ 🍽 饥饿  ████████░░ 80%      │    │
│        │  └──────────────────────────────┘    │
│        │  ┌──────┐ ┌──────┐ ┌───────────┐    │
│        │  │ 💕   │ │ 🪙   │ │ 🎒 背包   │    │
│        │  │亲密度 │ │金币  │ │ 🍎×3 🍰×1 │    │
│        │  │  15  │ │ 120  │ │ 🐟  🥛  🍪 │    │
│        │  └──────┘ └──────┘ └───────────┘    │
└────────┴─────────────────────────────────────┘
```

- `status-hero`：2 列等宽 grid（等级+经验 / 心情）
- `card--hunger`：独占一行
- `status-compact`：3 列等宽 grid（亲密度 / 金币 / 食物库存）
- 食物库存卡片内部 5 列 grid

## DOM 结构

```html
<main id="content-area">
  <section class="status-hero">
    <div class="card card--level">...</div>
    <div class="card card--mood">...</div>
  </section>
  <section class="card card--hunger">...</section>
  <section class="status-compact">
    <div class="card card--intimacy">...</div>
    <div class="card card--coins">...</div>
    <div class="card card--inventory">...</div>
  </section>
</main>
```

## 数据流

```
PetState.set(key, value)
  → EventBus.emit('pet:state:changed', { key, value })
    → dashboard 监听器收到 → 按 key 局部刷新对应 DOM
```

- **初始化**：`await PetState.init()` → 全量渲染所有卡片
- **增量更新**：收到 `PET_STATE_CHANGED` → 按 `key` 只更新对应卡片
- **投喂**：点击有库存食物 → `PetState.set()` 更新 foodInventory/hunger/intimacy → 事件自动驱动 UI 刷新

## 样式

### 通用卡片

```css
.card {
  background: #2c2c2c;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 14px;
}
```

### 各类卡片

| 卡片 | 要点 |
|------|------|
| 等级+经验 | 左侧大字 Lv.X，右侧经验进度条 + 数值 |
| 心情 | 大 emoji（32px）+ 中文标签 |
| 饥饿 | 进度条，颜色按阈值渐变 |
| 亲密度 | 小 emoji 💕 + 数值 |
| 金币 | 小 emoji 🪙 + 数值 |
| 食物库存 | 5 列 grid 物品格 |

### 饥饿进度条配色

| 范围 | 颜色 | 含义 |
|------|------|------|
| hunger <= 30 | #e81123 红色 | 饿了 |
| hunger <= 60 | #ffc107 黄色 | 一般 |
| hunger > 60  | #4caf50 绿色 | 饱了 |

### 食物库存物品格

- emoji 居中，font-size: 24px
- 右下角标注数量
- 有库存：正常高亮，hover 浅亮背景，可点击投喂
- 无库存：`opacity: 0.30` 置灰（与喂食 overlay 统一）

## 交互

### 快速投喂

左键点击有库存物品格：
1. 消耗该食物 1 个（更新 foodInventory）
2. hunger 减少对应值（clamp 到 0）
3. intimacy +5

投喂逻辑直接操作 PetState，与 pet.js 右键喂食路径一致。

### 食物映射表（dashboard.js 内维护）

```js
const FOOD_META = {
  apple:  { name: '苹果', emoji: '🍎', hunger: -20 },
  cake:   { name: '蛋糕', emoji: '🍰', hunger: -30 },
  fish:   { name: '小鱼干', emoji: '🐟', hunger: -25 },
  milk:   { name: '牛奶', emoji: '🥛', hunger: -15 },
  cookie: { name: '饼干', emoji: '🍪', hunger: -10 },
}
```

值与 pet.js 的 FOODS 保持一致，但不引用。

## 文件改动

| 文件 | 改动 |
|------|------|
| `dashboard.html` | 加 `<script type="module" src="../shared/pet-state.js">` |
| `dashboard.js` | 新增 import PetState、渲染函数、PET_STATE_CHANGED 监听、投喂逻辑 |
| `dashboard.css` | 新增卡片、网格、进度条、物品格、置灰态样式 |
| `docs/progress.md` | 更新进度 |
| `docs/session-log.md` | 登记 dash-01 |

## 不做的事

- 不碰 `#nav-bar`
- 不引入新事件
- 不加手动刷新按钮
- 不实现右键上下文菜单（后续窗口）
- 不改 pet.js 的 FOODS 表
