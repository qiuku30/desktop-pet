# 文件索引

> 每个文件一句话说清职责，新窗口/AI 快速定位。
> 最后更新：2026-07-24

---

## src/main/ — Electron 主进程

| 文件 | 职责 |
|------|------|
| `index.js` | 主进程入口：创建 BrowserWindow、宠物态/面板态切换、IPC 接线、右键菜单构建 |
| `preload.js` | contextBridge 安全桥接，向渲染进程暴露所有 API（窗口操作/宠物状态/番茄钟/2048 存档等） |
| `pomodoro.js` | 番茄钟核心：idle/focus/break 三态状态机，setInterval 每秒 tick，Electron Notification 通知 |
| `overlay-manager.js` | 通用悬浮面板：创建/销毁独立 BrowserWindow，Promise 模式返回结果，单例保护 |
| `overlay-preload.js` | overlay 窗口专用的 preload 脚本 |
| `tooltip-manager.js` | Tooltip 窗口：data:URL 直出无 preload，focusable:false 不抢焦点 |
| `storage/store.js` | 统一数据存取层：JSON 文件读写，DEFAULT_STATE 定义所有持久化字段的默认值 |
| `ipc/pet-ipc.js` | 宠物状态 IPC 通道注册（pet:state:get / pet:state:set），整体覆盖写盘 + 空快照保护 |
| `ipc/storage-ipc.js` | ⚠️ 占位文件，未实现 |
| `DESIGN.md` | 主进程技术设计文档 |

---

## src/renderer/shared/ — 共享基础设施

| 文件 | 职责 |
|------|------|
| `event-bus.js` | 模块通信总线：on/off/once/emit，逐个 try-catch 错误隔离，DEBUG 日志 |
| `events.js` | 所有事件常量定义（pet:satiety:changed、game:2048:completed 等） |
| `pet-state.js` | 宠物状态管理器：init/get/set/subscribe/flush，防抖存盘，`_data` 禁止直接访问 |
| `feed-service.js` | 喂食系统：FOODS 配置表 + consumeFood/applyFeed/emitFed |
| `exp-service.js` | 经验计算：分段升级公式、溢出继承、每日互动上限 20 次、maxLevel 30（31 测试） |
| `satiety-service.js` | 饱腹衰减：时间戳差值结算、离线生效、动态最大饱腹值（每 5 级 +20） |
| `mood-service.js` | 心情系统：0-100 数值、happy/good/neutral/low 四档 tier、自然衰减、离线跨天结算、经验倍率（56 测试） |
| `game-reward-service.js` | 2048 收益结算：分数分段兑换、首达阶梯奖励（128~2048）、心情倍率加成（43 测试） |
| `module-registry.js` | ⚠️ 已废弃，面板导航已改用 nav-config.js |
| `constants.js` | ⚠️ 占位文件 |
| `utils.js` | ⚠️ 占位文件 |
| `*-service.test.mjs` | 对应服务的单元测试（node --test） |

---

## src/renderer/pet/ — 宠物窗口

| 文件 | 职责 |
|------|------|
| `pet.html` | 宠物窗口 HTML：emoji 容器 + 气泡容器 + 番茄指示器 |
| `pet.js` | 宠物主逻辑：状态机（拖拽/走动/空闲）、对话气泡、双击面板、喂食 overlay、心情/经验接入 |
| `pet.css` | 宠物窗口样式：透明背景、no-drag 点击区域、拖动 padding、气泡动画 |
| `pet-motion.mjs` | 纯几何工具：距离计算、光标检测、随机走动目标生成、坐标换算（6 测试） |
| `pet-motion.test.mjs` | pet-motion 单元测试 |
| `DESIGN.md` | 宠物模块技术设计文档 |

---

## src/renderer/dashboard/ — 面板窗口

| 文件 | 职责 |
|------|------|
| `dashboard.html` | 面板 HTML 骨架：顶部栏 + 导航区 + 内容区 |
| `dashboard.js` | 面板主逻辑：页面切换（switchPage）、各页面渲染器、事件绑定、IP C 调用的入口 |
| `dashboard.css` | 面板全部样式：暗色主题、导航栏、卡片布局、各页面样式 |
| `nav-config.js` | 导航配置数组（NAV_ITEMS）：定义所有导航项及其渲染器（原则 5 配置驱动） |
| `settings-config.js` | 设置页配置数组（SETTINGS_TABS）：定义设置 Tab 及其控件 |
| `DESIGN.md` | 面板模块技术设计文档 |

---

## src/renderer/games/2048/ — 2048 游戏

| 文件 | 职责 |
|------|------|
| `2048-game.js` | 游戏纯逻辑：棋盘初始化、滑动合并、新方块生成、Game Over 检测、序列化/反序列化 |
| `2048-ui.js` | 游戏 UI：DOM 渲染、键盘+拖拽事件、结算弹窗、重新开始确认弹窗、PetState 持久化集成 |
| `2048.css` | 游戏样式（参考文件，实际由 JS 动态注入） |
| `DESIGN.md` | 2048 模块技术设计文档 |

---

## src/renderer/games/farm/ — 农场（占位）

| 文件 | 职责 |
|------|------|
| `game.js` | ⚠️ 旧占位，农场未开发 |
| `DESIGN.md` | ⚠️ 旧占位，农场未开发 |

---

## src/renderer/overlay/ — 悬浮面板

| 文件 | 职责 |
|------|------|
| `overlay.html` | 悬浮面板 HTML 骨架：拖拽 handle + 内容区 |
| `overlay.js` | 悬浮面板逻辑：配置注入 + data-overlay-result 事件委托 |
| `overlay.css` | 悬浮面板样式：透明背景、毛玻璃效果、暗色主题 |

---

## docs/ — 项目文档

| 文件 | 职责 |
|------|------|
| `architecture.md` | 十大架构原则 + 8 条 ADR（项目最高级技术决策） |
| `conventions.md` | 编码规范：跨模块 import 禁止、事件命名、PetState 使用约束 |
| `events.md` | 所有 EventBus 事件清单（名称、参数、触发时机） |
| `progress.md` | 开发进度追踪：每个文件/模块的完成状态 |
| `session-log.md` | 窗口会话日志：每个 ARCH/infra/pet/dash 窗口的改动记录 |
| `pet-movement-design.md` | 宠物移动系统详细设计（状态机、坐标契约、拖拽方案） |
| `overlay-design.md` | Overlay 悬浮面板设计文档 |
| `file-index.md` | 📍 本文件 — 所有文件的职责索引 |

---

## specs/ — 需求文档（用户视角）

| 文件 | 职责 |
|------|------|
| `pet-system.md` | 宠物系统 Phase 1 需求（功能、交互、验收标准） |
| `pomodoro.md` | 番茄钟需求（计时参数、宠物表现、右键菜单、统计） |
| `game-2048.md` | 2048 游戏需求（收益结算、宠物联动、持久化、验收标准） |
| `word-game.md` | ⚠️ 空占位，待细化 |
| `farm-system.md` | ⚠️ 空占位，待细化 |

---

## 根目录

| 文件 | 职责 |
|------|------|
| `CLAUDE.md` | 项目总纲：技术栈、目录结构、架构概览、窗口角色规则、协作模板 |
| `PROJECT_BRIEF.md` | 架构窗口交接文档：全局状态总览、实现进度、已知问题、分支状态 |
| `package.json` | npm 配置：依赖、脚本（start/package/make） |
| `forge.config.js` | electron-forge 打包配置 |
