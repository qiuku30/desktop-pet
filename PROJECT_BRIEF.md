# Desktop Pet — 项目启动总览

> 所有内容来自本次会话的讨论和决策。本文件持续更新。
> 最后更新：2026-07-11

---

## 一、项目定位

桌面摸鱼伴侣 (Desktop Pet) — Electron 桌面悬浮宠物应用。

- **最终目标**：上线给别人用
- **当前阶段**：不纠结远期，先把最小可玩版本做出来
- **核心体验**：外表是桌宠（能对话、喂食、升级），点开后内置多个摸鱼小模块
- **架构关系**：宠物是核心外壳，游戏是喂养/升级宠物的手段（非平级）

---

## 二、技术栈（已确认）

| 项目 | 选择 |
|------|------|
| 框架 | Electron |
| 语言 | JavaScript ES6 (import/export) |
| 样式 | HTML + CSS |
| 包管理 | npm |
| 打包 | electron-forge |
| 版本管理 | GitHub |
| CI/CD | 暂不需要 |
| 数据存储 | JSON 文件（主进程 IPC 读写，后续升级 SQLite） |

---

## 三、模块规划

共 5 个模块，目前只做第 1 个（宠物系统 Phase 1）：

| # | 模块 | 状态 | 说明 |
|---|------|------|------|
| 1 | 🐾 宠物系统 | 🔨 Phase 1 | 核心：悬浮、对话、喂食、成长 |
| 2 | 📝 英语单词 | ⏳ 待定 | 背单词 → 获得金币 |
| 3 | 🎮 2048 | ⏳ 待定 | 休闲游戏 → 获得金币 |
| 4 | 🌾 农场经营 | ⏳ 待定 | 种田 → 食材 → 合成食物 → 喂宠物 |
| 5 | 🏪 超市经营 | ⏳ 待定 | 买卖管理 |

---

## 四、项目结构（已确认）

```
desktop-pet/
├── CLAUDE.md
├── docs/
│   ├── architecture.md          # 全局架构决策及理由
│   ├── progress.md              # 开发进度追踪
│   ├── conventions.md           # 编码规范
│   └── events.md                # 事件清单（所有 EventBus 事件）
├── specs/                       # 需求文档（用户视角）
│   ├── pet-system.md
│   ├── word-game.md
│   ├── game-2048.md
│   └── farm-system.md
├── src/
│   ├── main/
│   │   ├── index.js              # Electron 入口
│   │   ├── ipc/
│   │   │   ├── pet-ipc.js
│   │   │   └── storage-ipc.js
│   │   ├── storage/
│   │   │   └── store.js          # 统一数据存取层（唯一碰文件的地方）
│   │   └── DESIGN.md
│   ├── renderer/
│   │   ├── pet/
│   │   │   ├── pet.html
│   │   │   ├── pet.js
│   │   │   ├── pet.css
│   │   │   └── DESIGN.md
│   │   ├── dashboard/
│   │   │   ├── dashboard.html
│   │   │   ├── dashboard.js
│   │   │   ├── dashboard.css
│   │   │   └── DESIGN.md
│   │   ├── games/
│   │   │   ├── 2048/
│   │   │   │   ├── game.js
│   │   │   │   ├── game.css
│   │   │   │   └── DESIGN.md
│   │   │   └── farm/
│   │   │       ├── game.js
│   │   │       └── DESIGN.md
│   │   ├── shared/               # 公共代码
│   │   │   ├── event-bus.js      # 事件总线核心
│   │   │   ├── events.js         # 事件常量定义
│   │   │   ├── module-registry.js # 模块注册表（面板导航自动渲染）
│   │   │   ├── pet-state.js      # 宠物状态管理器
│   │   │   ├── constants.js
│   │   │   └── utils.js
│   │   └── assets/
│   │       └── pet/
├── package.json
└── .gitignore
```

---

## 五、文档体系（两层分工）

| 层级 | 位置 | 视角 | 内容 |
|------|------|------|------|
| 需求文档 | `specs/xxx.md` | 用户视角 | 功能列表、交互描述、验收标准 |
| 设计文档 | `src/xxx/DESIGN.md` | 技术视角 | 组件树、数据结构、状态管理、关键算法、模块接口 |

**上下文恢复**（新会话只需读 4 个文件）：
```
CLAUDE.md → 对应模块 spec → 对应模块 DESIGN.md → docs/progress.md
```

**规则**：每次改完代码，同步更新对应 DESIGN.md。

---

## 六、架构设计（核心）

### 6.1 模块通信：EventBus 事件总线

```
┌─────────────────────────────────────────────────┐
│              事件总线 (EventBus)                  │
│    模块之间不直接 import，都通过事件通信            │
└──────┬────────────────┬────────────────┬─────────┘
       │                │                │
  ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
  │ 宠物模块  │     │ 农场模块  │     │ 单词模块  │
  │ pet/    │     │ farm/   │     │ word/   │
  └────┬────┘     └────┬────┘     └────┬────┘
       │                │                │
  ┌────▼────────────────▼────────────────▼─────────┐
  │           宠物状态管理器 (PetState)               │
  │  等级、心情、亲密度、食物库存……统一管理            │
  │  各模块只能通过 getter/setter 方法读写             │
  │  数据变更时自动 emit 事件通知订阅方               │
  └─────────────────────────────────────────────────┘
```

**三条铁律**：
1. 模块之间不互相 import — 农场不改宠物，宠物不改农场
2. 所有通信走 EventBus：`emit(EVENTS.COIN_EARNED, data)`
3. 状态集中管理（PetState 单例），读写都有门

**事件命名规范**：`模块名:动作:状态`
```
pet:hunger:changed     → 宠物饥饿值变了
coin:earned            → 获得金币
game:2048:completed    → 2048 通关
```

**事件常量文件** `src/renderer/shared/events.js`：
```js
export const EVENTS = {
  PET_HUNGER_CHANGED:  'pet:hunger:changed',
  PET_MOOD_CHANGED:    'pet:mood:changed',
  PET_LEVEL_UP:        'pet:level:up',
  COIN_EARNED:         'coin:earned',
  COIN_SPENT:          'coin:spent',
  GAME_2048_COMPLETED: 'game:2048:completed',
  GAME_FARM_HARVEST:   'game:farm:harvest',
}
```
使用时：`EventBus.emit(EVENTS.COIN_EARNED, { amount: 100 })` — 杜绝拼写错误

**事件清单文档**：`docs/events.md` — 所有事件名、参数、触发时机，新模块开发先查表

**开发模式调试**：每个 `emit` 和 `on` 打 `console.log`，方便追踪事件链

### 6.2 窗口架构：单窗口双状态

```
宠物态（小窗，悬浮）          面板态（展开，功能界面）
┌──────────┐              ┌─────────────────────┐
│   🐱    │   双击 →     │ 🐱  Lv.3  ❤️❤️❤️   │
│          │   ← 关闭    │─────────────────────│
│ "你好!"  │              │ 喂食 │ 农场 │ 单词  │
└──────────┘              │─────────────────────│
                          │    (当前页面内容)    │
                          └─────────────────────┘
```

- 只有一个 BrowserWindow，大小和内容在两种状态间切换
- 宠物态：透明无边框、置顶、小尺寸
- 面板态：正常窗口、可调大小、导航由模块注册表驱动

### 6.3 模块注册表

`src/renderer/shared/module-registry.js`：
```js
export const MODULES = [
  { id: 'pet-status',  label: '宠物状态', path: 'pet/status' },
  { id: 'farm',        label: '农场',     path: 'games/farm' },
  { id: 'word',        label: '背单词',   path: 'games/word' },
  { id: 'travel',      label: '旅游小屋', path: 'games/travel-cabin' },  // ← 加一行即注册
]
```
dashboard 自动遍历渲染导航，加模块不改逻辑。

### 6.4 数据存取

- 所有数据读写走 `src/main/storage/store.js`
- 渲染进程通过 IPC 调用，绝不直接碰文件系统
- 以后切 SQLite 只改 store.js 一个文件

---

## 七、宠物系统详细规格

### 7.1 Phase 1 范围（更多版）

- 悬浮宠物窗口（透明无边框、置顶）
- 外观：Emoji 占位，先跑通逻辑
- 闲置动画 + 可拖拽 + 随机走动 + 躲避鼠标
- 单击：对话气泡（心情/等级驱动，叠加显示，2秒消失）
- 双击：窗口变形展开为面板
- 右键菜单：喂食、状态、退出
- 亲密度数值 + 基础喂食功能
- 拖到屏幕边缘 → 赶跑（跑出屏幕，30秒~1分钟后回来）
- 窗口边框攀爬：Phase 2 再做

### 7.2 宠物成长系统

| 维度 | 说明 |
|------|------|
| 等级 | 数字变大，外观进化（团子 → 长大 → 进化形态） |
| 解锁 | 新台词、新动作、服饰/道具购买、新游戏模块 |
| 经济 | 农场产食材合成食物喂宠物；其他游戏产金币买服饰 |

### 7.3 台词系统

- 10~20 条基础台词库
- 根据宠物心情和等级选择台词类别
- 连续点击叠加气泡

---

## 八、协作规则

### 8.1 Win + Mac 双机协作

- 代码通过 GitHub 同步（本地跑通后关联仓库）
- 每次切换设备前先 `git pull`
- 同一时间只在一台设备上改代码
- 两头都要改 → 各开 feature 分支，不直接在 main 上改

### 8.2 多 Claude Code 窗口协作

| 窗口 | 角色 | 职责 |
|------|------|------|
| 🏛️ 架构窗口（本窗口） | 决策中心 | 讨论需求、做架构决策、更新 CLAUDE.md / specs / architecture.md |
| 🔨 实现窗口 | 写代码 | 读文档、按 spec 实现、不自作主张做重大决策 |

**所有窗口通用铁律**：
> ⚠️ **不要猜测用户意图。不确定、不知道、重要决策点 → 必须询问用户。**

- 每个窗口只负责自己模块的文件
- 不同窗口绝不改同一个文件
- 每次会话结束更新 `docs/progress.md`

### 8.3 Win + Mac 并行开发

```
Win:  feature/pet-system     → 核心系统（主进程、宠物）
Mac:  feature/word-game      → 独立模块（游戏、specs）
```

注意：`src/main/` 和 `package.json` 是共享区，需协调谁改

### 8.4 Git 工作流

- 分支命名：`feature/xxx`
- Commit 语言：英文
- main 保持稳定可运行

### 8.5 子代理使用时机

项目初期不用。以下场景再考虑：
- 需要同时搜索/阅读大量文件
- 修改完成后需要代码审查
- 需要研究某个技术方案

---

## 九、本会话实施步骤

| # | 步骤 | 状态 |
|---|------|------|
| 1 | 讨论并确认所有规则和架构 | ✅ 基本完成 |
| 2 | 生成 CLAUDE.md | ⏳ |
| 3 | 初始化 Electron 项目（npm init + electron-forge） | ⏳ |
| 4 | 创建目录结构和基础文档 | ⏳ |
| 5 | 写出宠物悬浮窗口最小可运行版本 | ⏳ |
| 6 | 验证 | ⏳ |

---

## 十、仍需讨论

- [ ] 宠物初始屏幕位置？（右下角？）
- [ ] Phase 1 "喂食"功能具体怎么交互？
- [ ] 模块做完宠物后，下一个做哪个？
