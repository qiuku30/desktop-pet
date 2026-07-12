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

---

## 窗口角色与文件权限

### 🏛️ 架构决策窗口

- 讨论需求、做架构决策
- 启动必读：`CLAUDE.md` → `PROJECT_BRIEF.md`（总览全局状态）
- 唯一有权修改：`CLAUDE.md`、`PROJECT_BRIEF.md`、`docs/architecture.md`、`docs/conventions.md`、`specs/*`
- 每次会话结束必须更新 `PROJECT_BRIEF.md` 和 `docs/progress.md`

### 🔨 实现窗口

#### 启动时必读（按顺序）

| 顺序 | 文件 | 目的 |
|------|------|------|
| 1 | `CLAUDE.md` | 了解项目全貌、规则、架构 |
| 2 | `specs/<模块名>.md` | 理解这个模块"要做什么" |
| 3 | `src/<模块路径>/DESIGN.md` | 理解"怎么实现的" |
| 4 | `docs/progress.md` | 了解当前进度 |

#### 可以改的文件 ✅

- 自己模块目录下的**所有文件**（如 `src/renderer/pet/*`）
- `src/renderer/shared/events.js` — 新增事件常量
- `src/renderer/shared/module-registry.js` — 注册新模块
- `docs/progress.md` — 会话结束时更新进度
- `docs/events.md` — 登记新事件

#### 绝对不能改的文件 🚫

- `CLAUDE.md` — 架构窗口专属
- `docs/architecture.md` — 架构窗口专属
- `docs/conventions.md` — 架构窗口专属
- **其他模块的目录** — 只碰自己的
- `src/main/` — 除非明确指派
- `package.json` — 除非明确指派

#### 遇到不确定时 ⚠️

- spec 里没覆盖到的重要问题 → **停手，问用户**，先标记 TODO
- 需要改共享文件（events.js 等）→ 可以改，但要在 progress.md 里记录
- 想新加一个事件 → 先查 `docs/events.md` 是否有现成的，避免重复
- **不同窗口绝不改同一个文件**

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

只能改 [在此填写允许的目录]，改完更新 docs/progress.md。
不确定的地方必须问我，不要猜。
```

**示例 — 实现窗口写宠物气泡**：

```
先读 CLAUDE.md。

任务是实现 src/renderer/pet/ 下的宠物点击气泡：单击弹出气泡、根据心情选台词、叠加显示、2 秒消失。

只能改 src/renderer/pet/* 和 docs/progress.md。
不确定就问我。
```

### 进度追踪
每次会话结束时必须更新 `docs/progress.md`。
