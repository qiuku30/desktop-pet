# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

> ## ⚠️⚠️⚠️ 核心铁律 ⚠️⚠️⚠️
>
> # 不要猜测用户意图。
>
> 不确定、不知道、重要决策点 → **必须询问用户**。
> 宁可多问一句，不要自作主张。
>
> 此规则优先级高于一切。

---

## 项目概述

桌面摸鱼伴侣 (Desktop Pet) — Electron 桌面悬浮宠物应用。
外表是桌宠（能对话、喂食、升级），点开后内置摸鱼小模块。

## 技术栈

| 项目 | 选择 |
|------|------|
| 框架 | Electron |
| 语言 | JavaScript ES6 (import/export) |
| 包管理 | npm |
| 打包 | electron-forge |
| 存储 | JSON 文件（主进程 IPC，后续可升级 SQLite） |

## 常用命令

```bash
npm start              # 启动开发模式
npm run package        # 打包应用
npm run make           # 生成安装包
```

## 目录结构

```
desktop-pet/
├── CLAUDE.md                    # 本文件 — 项目总纲
├── package.json
├── forge.config.js
├── .gitignore
├── docs/
│   ├── architecture.md          # 全局架构决策 (ADR)
│   ├── progress.md              # 开发进度追踪
│   ├── conventions.md           # 编码规范
│   ├── events.md                # EventBus 事件清单
│   └── pet-movement-design.md   # 宠物移动系统设计
├── specs/                       # 需求文档（用户视角："要做什么"）
│   ├── pet-system.md
│   ├── word-game.md
│   ├── game-2048.md
│   └── farm-system.md
├── src/
│   ├── main/                    # Electron 主进程（Node.js）
│   │   ├── index.js             # 入口：窗口创建、模式切换、IPC
│   │   ├── preload.js           # 安全桥梁（contextBridge）
│   │   ├── ipc/                 # IPC 处理器
│   │   ├── storage/store.js     # 统一数据存取层
│   │   └── DESIGN.md
│   ├── renderer/
│   │   ├── pet/                 # 宠物模块
│   │   │   ├── pet.html
│   │   │   ├── pet.js
│   │   │   ├── pet.css
│   │   │   ├── pet-motion.mjs   # 纯几何工具
│   │   │   └── DESIGN.md
│   │   ├── dashboard/           # 面板模块
│   │   ├── games/               # 游戏模块
│   │   ├── shared/              # 公共基础设施
│   │   │   ├── event-bus.js     # 事件总线核心
│   │   │   ├── events.js        # 事件常量定义
│   │   │   ├── module-registry.js # 模块注册表
│   │   │   ├── pet-state.js     # 宠物状态管理器
│   │   │   ├── constants.js
│   │   │   └── utils.js
│   │   └── assets/              # 静态资源
└── .gitignore
```

---

## 架构

### 模块通信：EventBus 事件总线

模块之间**禁止直接 import**，所有通信走 EventBus。

- 事件常量：`src/renderer/shared/events.js`
- 事件总线：`src/renderer/shared/event-bus.js`
- 事件清单：`docs/events.md`

命名规范：`模块名:动作:状态`（如 `pet:hunger:changed`）

### 窗口：单窗口双状态

一个 BrowserWindow，在宠物态（小窗悬浮）和面板态（展开功能界面）之间切换。

### 模块注册表

`src/renderer/shared/module-registry.js` — 加模块只需注册一行，面板导航自动渲染。

### 数据存取

所有文件读写走 `src/main/storage/store.js`。模块不直接碰文件系统。渲染进程通过 IPC 调用。

---

## 文档体系

| 层级 | 位置 | 视角 |
|------|------|------|
| 需求文档 | `specs/xxx.md` | 用户视角（功能、交互、验收标准） |
| 设计文档 | `src/xxx/DESIGN.md` | 技术视角（组件树、数据结构、状态管理） |
| 会话日志 | `docs/session-log.md` | 运维视角（每个窗口改了啥、越界授权、追溯 bug） |

---

## 窗口角色与文件权限

### 🏛️ 架构决策窗口

- 讨论需求、做架构决策
- 启动必读：`CLAUDE.md` → `PROJECT_BRIEF.md`（总览全局状态）→ `docs/architecture.md`（十大原则 + ADR）→ `docs/file-index.md`（快速定位文件）
- 唯一有权修改：`CLAUDE.md`、`PROJECT_BRIEF.md`、`docs/architecture.md`、`docs/conventions.md`、`docs/session-log.md`、`specs/*`
- 每次会话结束必须更新 `PROJECT_BRIEF.md` 和 `docs/progress.md`
- 每开一个新窗口或做完一次改动，提醒用户并同步更新 `PROJECT_BRIEF.md`、`docs/progress.md`、`docs/session-log.md`

### 🔨 实现窗口

#### 启动时必读（按顺序）

| 顺序 | 文件 | 目的 |
|------|------|------|
| 1 | `CLAUDE.md` | 了解项目全貌、规则、架构 |
| 2 | `docs/architecture.md` | 了解十大架构原则 + 8 条 ADR |
| 3 | `docs/file-index.md` | 快速定位任何文件 |
| 4 | `specs/<模块名>.md` | 理解这个模块"要做什么" |
| 5 | `src/<模块路径>/DESIGN.md` | 理解"怎么实现的" |
| 6 | `docs/progress.md` | 了解当前进度 |

#### 可以改的文件 ✅

- 自己模块目录下的**所有文件**（如 `src/renderer/pet/*`）
- `src/renderer/shared/events.js` — 新增事件常量
- `src/renderer/shared/module-registry.js` — 注册新模块
- `docs/progress.md` — 会话结束时更新进度
- `docs/events.md` — 登记新事件
- `docs/session-log.md` — 会话结束时登记窗口记录

#### 绝对不能改的文件 🚫

- `CLAUDE.md` — 架构窗口专属
- `docs/architecture.md` — 架构窗口专属
- `docs/conventions.md` — 架构窗口专属
- **其他模块的目录** — 只碰自己的
- `src/main/` — 除非明确指派
- `package.json` — 除非明确指派

#### 动工前先对齐 ⚠️

以下情况**先问架构窗口**，不要自己猜：
- 涉及新的数据结构（如食物库存长什么样）
- 涉及新的交互流程（如选食物再喂、还是直接喂第一个）
- spec 没有明确覆盖的实现细节

架构窗口给一个简短的设计锁死（几行就行），再动手。

#### 动工前先报告 📋

**拿到任务后，第一件事不是写代码。** 必须先向架构窗口报告你打算实现的东西：

- 这个模块有哪些功能点（用户能做什么）
- 界面长什么样（布局结构、有哪些元素）
- 涉及哪些数据（读写什么、存什么）

用自然语言描述，不要贴代码，不要列技术细节（函数名、文件结构等）。

架构窗口确认对 spec 的理解没有偏差后，再动手。

#### 遇到不确定时 ⚠️

- spec 里没覆盖到的重要问题 → **停手，问用户**，先标记 TODO
- 需要改共享文件（events.js 等）→ 可以改，但要在 progress.md 里记录
- 想新加一个事件 → 先查 `docs/events.md` 是否有现成的，避免重复
- **不同窗口绝不改同一个文件**

---

## 窗口命名规则

每个会话窗口有唯一编号，记录在 `docs/session-log.md`。

| 前缀 | 类型 | 谁分配 |
|------|------|--------|
| `ARCH-NN` | 架构窗口 | 自取（递增） |
| `infra-NN` | 共享基础设施 | 架构窗口在任务提示词中分配 |
| `pet-NN` / `dash-NN` 等 | 实现窗口 | 架构窗口在任务提示词中分配 |

**如果没被分配**：用 `模块前缀-YYYYMMDD`（如 `pet-20260712`），不会冲突。

#### 何时开模块专属前缀

一个模块涉及 **两种以上** 窗口类型（infra + dash + pet 中 ≥2 个）时，开专属前缀统一管理：

| 前缀 | 适用场景 |
|------|----------|
| `farm-NN` | 农场同时有 infra（种植逻辑/生长计时）+ dash（田地页/合成页）+ pet（宠物联动） |
| `word-NN` | 单词同时有 infra（词库/进度追踪）+ dash（答题页/统计页） |

一个模块只涉及单一窗口类型（如 2048 只有 dash），沿用 `infra-NN` + `dash-NN` 即可，不开专属前缀。

---

## 协作规则

### Win + Mac 双机
- GitHub 同步，各开 feature 分支
- 同一时间只在一台设备改代码
- 切换设备前先 `git pull`

### Git
- 分支命名：`feature/xxx`
- Commit 语言：英文
- Commit 格式：`<type>: <description>`
- main 保持稳定可运行

### 子代理
项目初期不用。需要搜索大量文件、代码审查、研究技术方案时再考虑。

### 新窗口启动模板

开新 Claude Code 窗口时，粘贴以下模板，填上具体任务即可：

```
先读 CLAUDE.md 了解项目全貌和规则。

你的任务是：[在此填写具体任务]

只能改 [在此填写允许的目录]，改完更新 docs/progress.md 和 docs/session-log.md。
不确定的地方必须问用户，不要猜。
先讨论，商量出结果后再行动，总体设计可能会与局部详细设计有偏差。
```

**示例 — 实现窗口写宠物气泡**：

```
先读 CLAUDE.md。

任务是实现 src/renderer/pet/ 下的宠物点击气泡：单击弹出气泡、根据心情选台词、叠加显示、2 秒消失。

只能改 src/renderer/pet/* 和 docs/progress.md。
不确定就问用户。
先讨论，商量出结果后再行动，总体设计可能会与局部详细设计有偏差。
```

### 进度追踪
每次会话结束时必须更新 `docs/progress.md` 和 `docs/session-log.md`。

### 交付前自检（收尾前必须完成）

**代码写完 ≠ 做完了。** 收尾前必须反复逐项检查、验证、修正，直到没有任何问题为止：

- 跑测试 → 有 fail 就修 → 再跑 → 全部 pass 为止
- 逐条对照 spec 验收标准 → 有漏就补 → 再对照 → 全部满足为止
- 逐条过收尾检查清单（下方 1~4）→ 有不合规就修 → 再过 → 全部通过为止
- 手工跑一遍完整流程（正常路径 + 边界情况）→ 有 bug 就修 → 再跑 → 无问题为止

**这个循环不限次数，直到所有检查项全部通过，才能进入收尾。**

### 收尾检查清单（每个实现窗口结束时逐项完成）

#### 1. 代码合规自查

- [ ] 搜索是否跨模块 import（禁止 `import` 其他模块目录的文件）— 原则 1
- [ ] 新增数据是否走 PetState / EventBus，没有私自存 localStorage 或直接写文件 — 原则 4/10
- [ ] IPC 通道是否在 preload.js 有对应暴露，命名是否一致
- [ ] 新事件是否在 `shared/events.js` 定义常量、`docs/events.md` 登记
- [ ] 事件命名是否遵循 `模块名:动作:状态` — ADR-002
- [ ] CSS 拖拽是否用 `-webkit-app-region: drag`，不用 JS+IPC 拖拽 — ADR-007
- [ ] 配置数据是否与逻辑分离（如食物表、台词库写在配置块而非硬编码在函数里）— 原则 5

#### 2. 改动总结

请列出：
- **改了哪些文件**（完整相对路径，一行一个）
- **有没有越界授权**（碰了非本模块目录的文件？谁授权的？）
- **踩了什么坑**（给后续窗口的备忘）

#### 3. 文档同步

- [ ] `docs/progress.md` — 更新进度表和待实现列表
- [ ] `docs/session-log.md` — 按格式登记本窗口（编号、日期、功能、改动文件、越界授权、备注）
- [ ] 本模块 `DESIGN.md` — 如果有架构/接口变更，同步更新
- [ ] `docs/events.md` — 如果新增或修改了事件
- [ ] `src/renderer/shared/module-registry.js` — 如果是新模块

#### 4. 上报架构窗口

如有以下情况，必须向架构窗口报告：
- 修改了共享层文件（`shared/`、`main/`）
- 新增了数据结构或改了现有数据结构的字段
- 发现已有代码的 bug 或架构问题
- 做出了 spec 里没有覆盖的设计决策
- 需要其他窗口配合的改动

以上全部完成后回复"收尾完毕"。

### 收集历史窗口信息（架构窗口用）

向已关闭的窗口收集信息，用于补登 `docs/session-log.md`：

**实现窗口用：**
```
你是本项目的一个实现窗口。架构窗口在建立 session-log.md 做窗口索引。

请回答（精简）：

1. 你做了什么功能？
2. 实际改了哪些文件？（完整相对路径）
3. 架构窗口给了你哪些越界授权？（没给就写"无"）
4. 踩了什么坑或重要备注？
```

**架构窗口用：**
```
你是本项目的架构窗口。现在 ARCH-XX 在建立 session-log.md 做窗口索引。

请如实回答（精简）：

1. 你做了什么？
2. 实际改了哪些文件？（完整相对路径）
3. 踩了什么坑或重要备注？
```
