# 英语单词模块设计

> word-03 | 2026-08-06

## 文件结构

| 文件 | 职责 |
|------|------|
| `word-ui.js` | 全部 UI 逻辑：首页 + 新词学习 + 复习 + 设置 + 单词本入口集成，CSS 自注入 |
| `word-book-ui.js` | 单词本 UI：主页 + 单词列表（字母索引）+ 详情卡片 + 全局搜索，CSS 自注入 |
| `word.css` | 参考样式（实际运行时由 word-ui.js 动态注入 `<style>`） |
| `word-book.css` | 参考样式（实际运行时由 word-book-ui.js 动态注入 `<style>`） |
| `DESIGN.md` | 本文件 |

## 组件树

```
mountWordPage(container)                      — 导出入口
├── 首页 (.word-home)
│   ├── 统计卡片 (.word-stats) × 3
│   │   ├── 📚 已学词汇
│   │   ├── 🔴 待复习
│   │   └── 🔥 连续打卡
│   ├── 入口按钮 (.word-entry-buttons) × 3
│   │   ├── 📋 复习（显示到期数量）
│   │   ├── 📖 学新词
│   │   └── 📖 单词本（word-03 已激活）
│   └── 设置 (.word-settings)
│       ├── 词库多选（checkbox group）
│       ├── 每日新词上限（1-50）
│       ├── 每组学习数量（5-30）
│       └── 每组复习数量（5-50）
├── 学习页 (.word-session)
│   ├── 页头：← 返回 + 进度 (N/M)
│   ├── 翻卡 (.word-card)
│   │   ├── 正面：单词拼写 + "点击翻面查看释义"
│   │   └── 背面：音标 + 释义 + 例句 + ⭐收藏 + [记住了] [不太熟]
│   └── 分组完成弹窗 (.word-overlay)
├── 复习页 (.word-session)
│   ├── 页头：← 返回 + 进度 (N/M)
│   ├── 阶段1：单词 + "点击单词查看选项"
│   ├── 阶段2：4 个中文选项 + "忘了，看答案"
│   ├── 反馈：选对 ✅ 或选错 ❌ 展开完整卡片
│   └── 分组完成弹窗 (.word-overlay)
└── 单词本 (mountWordBook)
    ├── 主页 (.wb-main)
    │   ├── ← 返回 + 📖 单词本 标题
    │   ├── 🔍 全局搜索框（跨词库实时搜索）
    │   ├── 我的（📝 我的单词本 + ⭐ 我的收藏）
    │   └── 词库列表（各词库已学/总数统计）
    ├── 单词列表 (.wb-list)
    │   ├── ← 返回 + 标题 + 搜索框
    │   ├── 筛选 Tab（全部/已学/未学 或 全部/⭐收藏/🕐最近学习）
    │   ├── 首字母分组列表 (A-Z)
    │   ├── 右侧字母索引 (.wb-alpha-index)
    │   └── 单词项：拼写 + 释义 + ✅已学⭐收藏标记
    └── 单词详情 (.wb-detail)
        ├── ← 返回
        ├── 单词拼写（大号）+ 音标
        ├── 释义 + 例句（含中文翻译）
        ├── 来源词库 + 学习状态
        ├── ⭐ 收藏/取消收藏
        └── 🔄 重新学习（二次确认弹窗）
```

## 数据流

```
                   PetState.get('wordProgress')
                   ┌─────────────────────────────┐
                   │   word-ui.js                 │
                   │   模块级变量：无持久状态      │
                   │   - _bankCache (词库缓存)     │
                   │   - _currentPage             │
                   └──────────┬──────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   IPC word:lookup     IPC word:choices    PetState.set('wordProgress')
   word:batch-lookup                       EventBus.emit
          │                   │                   │
   ┌──────┴──────┐   ┌───────┴──────┐   ┌───────┴──────┐
   │ main/       │   │ main/        │   │ store.js     │
   │ word-service│   │ word-service │   │ (JSON 文件)  │
   └─────────────┘   └──────────────┘   └──────────────┘
```

所有数据读写走 PetState。词库索引通过 `import()` 动态加载并缓存到 `_bankCache`。

## 页面导航状态机

```
      mountWordPage()
            │
            ▼
        ┌──────┐  ←返回   ┌────────┐  ←返回   ┌────────┐
        │ Home │──────────→│ Learn  │──────────→│ Review │
        │      │←──────────│        │←──────────│        │
        └──┬───┘  完成/     └────────┘  完成/     └────────┘
           │    今天就到这              今天就到这
           │
           │ 单词本入口
           ▼
     ┌──────────┐  点击词库/    ┌──────────┐  点击单词    ┌──────────┐
     │ WordBook │──────────────→│   List   │──────────────→│  Detail  │
     │  (main)  │←──────────────│          │←──────────────│          │
     └──────────┘    ← 返回     └──────────┘    ← 返回     └──────────┘
           │
           └── ← 返回（回到 Home）
```

内部使用 `_cleanupCurrent` 机制：切换子页面时先调用当前页的清理函数，再渲染新页。
单词本内部使用 `goBack()` 机制：从 backStack 弹出上一个视图状态并直接渲染（不经过 navigate 推入，避免重复）。

## 学习流程

1. Home 点击「学新词」→ `navigateTo('learn')` → `renderLearn()`
2. `loadLearnBatch()`：遍历 selectedBanks，用 `getNextNewWords` 选新词，通过 IPC `word:batch-lookup` 获取完整词条
3. 卡片正面 → 点击翻面 → 完整信息 + 自评按钮
4. 点 [记住了] → `initLearnedWord` 或 `scheduleReview(existing, 'good')` → 写 PetState → 更新 streak → 发事件 → 下一张
5. 点 [不太熟] → `scheduleReview(existing, 'again')` → 下一张
6. 组完 → 弹窗三选一

## 复习流程

1. Home 点击「复习」→ `navigateTo('review')` → `renderReview()`
2. `loadReviewBatch()`：用 `getDueWords` 取到期词，IPC `word:batch-lookup` 获取完整词条
3. 阶段1：显示单词 → 点击 → 阶段2
4. 阶段2：IPC `word:choices` 获取 3 个干扰项 → 随机排列 4 个选项
5. 选对 → `scheduleReview('good')` → 写 PetState → 更新 streak → 发事件 → 下一张
6. 选错/忘 → `scheduleReview('again')` → 展示完整卡片 → 用户确认 → 下一张
7. 组完 → 弹窗三选一

## 设置

集成在首页，即时保存。每项修改 → 直接写 `PetState.set('wordProgress', ...)`。
- 词库至少保留一个选中（取消最后一个时自动恢复）。
- 数值输入越界自动 clamp。

## 接口契约

对外暴露一个函数（dashboard.js 调用）：

| 函数 | 说明 |
|------|------|
| `mountWordPage(container)` | 渲染 + 绑定事件，返回 cleanup 函数 |

样式通过 mount 时注入 `<style>` 标签自包含。

## 单词本设计 (word-03)

### 接口

| 函数 | 说明 |
|------|------|
| `mountWordBook(container, { onBack })` | 渲染单词本到容器，返回 cleanup 函数 |

`word-ui.js` 的 `navigateTo('wordbook')` 调用 `mountWordBook(container, { onBack: () => navigateTo('home') })`。

### 内部视图

单词本内部有三个视图，通过 `navigate(view, params)` 和 `goBack()` 管理：

| 视图 | 功能 |
|------|------|
| `main` | 全局搜索 + 我的（单词本/收藏）入口 + 词库列表 |
| `list` | 单词列表（首字母分组 + 字母索引 + 筛选 Tab + 搜索） |
| `detail` | 单词详情卡片（完整信息 + 收藏 + 重新学习） |

### 数据流

```
Bank JSON (词库单词列表)
    │
    ├─→ 词库列表（已学/总数统计）
    ├─→ 单词列表（拼写 + 状态标记）
    └─→ 搜索（拼写匹配）
    
PetState.wordProgress.words
    │
    ├─→ 已学/收藏/来源词库判断
    └─→ 收藏切换 / 重新学习（写）

IPC word:batchLookup
    │
    └─→ 释义获取（缓存到 _defCache Map）
```

### 释义缓存

`_defCache: Map<string, entry>` — 单词拼写 → ECDICT 词条。
- 批量查词前先过滤已缓存项
- 每次最多 150 个一批
- 重新学习时清除对应缓存

### 导航机制

- `navigate(view, params)`: 推入当前状态到 backStack → 更新状态 → 渲染新视图
- `goBack()`: 弹出 backStack 最后一个状态 → 恢复 → 渲染（不推入）
- 各视图返回按钮调用 `goBack()`，主页返回按钮调用 `onBack()`（回到单词首页）

## 词库加载

词库索引文件（`assets/word-banks/*.json`）通过动态 `import()` 加载，使用 `{ with: { type: 'json' } }` 导入断言。
结果缓存到 `_bankCache` Map，重复加载直接返回缓存。

## 持久化

所有状态存储在 `PetState.wordProgress`：
- `settings`：词库选择、每日上限、组大小
- `streak`：连续打卡天数
- `words`：每个词的 FSRS 状态 + `isFavorited`

每次学习/复习操作后立即 `PetState.set('wordProgress', ...)` 写内存（500ms 防抖写盘由 PetState 内部处理）。

## 事件发布

| 操作 | 事件 | payload |
|------|------|---------|
| 学完新词 | `word:learned` | `{ word }` |
| 复习完成 | `word:reviewed` | `{ word, rating }` |
| 连续天数变化 | `word:streak:changed` | `{ current }` |
| 词汇量里程碑 | `word:milestone` | `{ total, milestone }` |

## Phase 2 预留

- 填空题功能（复习页暂无相关 UI）
- ~~单词本页面（入口按钮已激活，word-03 完成）~~
- 宠物联动（已发布 EventBus 事件，宠物模块可直接订阅）
