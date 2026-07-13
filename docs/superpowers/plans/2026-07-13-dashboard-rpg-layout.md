# Dashboard RPG 角色卡布局重构 — 实现计划

> **For agentic workers:** 本计划只有 3 个任务，可在当前会话直接执行。

**Goal:** 面板从卡片平铺改为上下分区角色展示式布局

**Architecture:** `#content-area` 内分两层：`.portrait-layer`（上半区，形象展示）和 `.info-layer`（下半区，信息数据），保留所有现有 id 和事件绑定

**Tech Stack:** HTML + CSS, 不动 JavaScript 数据逻辑

## 全局约束

- 只改 `src/renderer/dashboard/dashboard.js`（仅 `buildStatusDOM()` 的 innerHTML）和 `src/renderer/dashboard/dashboard.css`
- 保留所有现有 id：`card-level`, `card-mood`, `card-satiety`, `card-intimacy`, `card-coins`, `card-inventory`
- 不动 `render*()` 函数、`handleFeed()`、`onStateChanged()`、`initStatus()`、事件委托
- `overflow-y: auto` 从 `#content-area` 移到 `.info-layer`
- padding 从 `#content-area` 移除，分别给 `.portrait-layer` 和 `.info-layer`

---

### Task 1: 更新 CSS — 新增两层布局样式 + 调整 overflow/padding

**文件:**
- 修改: `src/renderer/dashboard/dashboard.css`

**改动:**

1. `#content-area` — 去掉 `overflow-y: auto` 和 `padding: 16px`，改为 `flex-direction: column`
2. 新增 `.portrait-layer` — 上半区 flex 布局
3. 新增 `.portrait-area` — 中央立绘区
4. 新增 `.slot-list` / `.slot-item` — 快捷槽位占位
5. 新增 `.info-layer` — 下半区，`overflow-y: auto`
6. 新增 `.info-row--2col` / `.info-row--full` / `.info-row--3col` — 行容器，复用现有 grid 定义

- [ ] **Step 1: 修改 `#content-area` 样式**

找到 `#content-area` 规则，替换为：

```css
#content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

- [ ] **Step 2: 新增上半区样式**

在 `#content-area` 之后、`/* ── 宠物状态卡片 ── */` 之前插入：

```css
/* ── 上半区：形象展示层 ── */

.portrait-layer {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 0;
}

.portrait-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: min(18vw, 140px);
  user-select: none;
}

/* ── 快捷槽位 ── */

.slot-list {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  width: 56px;
  flex-shrink: 0;
}

.slot-item {
  aspect-ratio: 1;
  border: 1px dashed #555;
  border-radius: 8px;
  background: transparent;
}
```

- [ ] **Step 3: 新增下半区样式**

```css
/* ── 下半区：信息数据层 ── */

.info-layer {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-row--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-row--full {
  /* 整行，容器自身 */
}

.info-row--3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}
```

- [ ] **Step 4: 验证 CSS 无语法错误** — 快速目视检查

---

### Task 2: 更新 `buildStatusDOM()` 的 innerHTML 模板

**文件:**
- 修改: `src/renderer/dashboard/dashboard.js` — 仅 `buildStatusDOM()` 函数体

- [ ] **Step 1: 替换 `buildStatusDOM()` 的 innerHTML**

找到 `buildStatusDOM()` 函数（约第 94-108 行），将其 innerHTML 替换为：

```js
function buildStatusDOM() {
  const area = document.getElementById('content-area')
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

- [ ] **Step 2: 确认所有 id 不变** — 与旧代码对比：
  - `card-level` ✅
  - `card-mood` ✅
  - `card-satiety` ✅
  - `card-intimacy` ✅
  - `card-coins` ✅
  - `card-inventory` ✅

---

### Task 3: 启动应用验证

- [ ] **Step 1: 启动应用**

```bash
npm start
```

- [ ] **Step 2: 功能验证清单**

  - [ ] 宠物窗口正常显示
  - [ ] 双击宠物 → 切换到面板态
  - [ ] 上半区：🐱 居中显示，左右各 3 个虚线空框
  - [ ] 下半区：等级/经验 + 心情在同一行，饱腹度完整显示，亲密度/金币/食物库存三列
  - [ ] 点击食物库存 emoji → 快速投喂正常工作
  - [ ] 点击 ✕ → 返回宠物态正常
  - [ ] 窗口边缘拖拽缩放正常
  - [ ] 缩小窗口到很窄 → 下半区出现滚动条，上半区不滚

- [ ] **Step 3: 如发现问题，回到 Task 1/2 调整 CSS 数值后重新验证**
