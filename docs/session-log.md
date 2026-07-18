# 窗口会话日志

> 出 bug 时按编号追溯。架构窗口分配编号，实现窗口结束后登记。

## 命名规则

- **ARCH-NN** — 架构窗口
- **infra-NN** — 共享基础设施
- **pet-NN** — 宠物模块
- **dash-NN** — 面板模块
- **2048-NN** / **word-NN** / **farm-NN** — 游戏模块（将来）

---

## ARCH（架构窗口）

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **ARCH-01** | 2026-07-12 | 项目初始化 + 全部架构设计 | 全部文件骨架（35个文件），详见备注 | —（创建者，无越界概念） | 8 条 ADR、EventBus/PetState/store.js 架构决策、单窗口双状态、模块注册表、窗口角色分工规则、文档体系；协调多窗口协作；⚠️ JS拖拽→CSS原生拖拽教训(ADR-007)、实现窗口改完必须同步 DESIGN.md、多窗口并发改 index.js 最危险 |
| **ARCH-02** | 2026-07-12~13 | 架构决策 + 审查 + 直接修复 | `store.js` `docs/architecture.md` `docs/pet-movement-design.md` `docs/session-log.md` `PROJECT_BRIEF.md` `docs/progress.md` `CLAUDE.md` `docs/conventions.md` `src/renderer/pet/pet.js` `src/renderer/shared/module-registry.js` `src/renderer/shared/events.js` | — | 十大原则写入 architecture.md；审查 pet-02/03（补 zoomLevel、ADR-001/005/007/008、no-drag→✅）；建 session-log.md + 窗口命名规则；events.md 补 wander:toggle；conventions.md/architecture.md 示例 hunger→satiety；直接修：pet.js flyout 饱腹上限、module-registry 死链接、IPC 监听器泄漏；Phase 1 合并 main |
| **ARCH-03** | 2026-07-13 | 代码审计 + 文档同步 + 委派 infra-06~09、pet-07、dash-01/02 + 多轮审计修复 | `CLAUDE.md` `PROJECT_BRIEF.md` `docs/progress.md` `docs/session-log.md` `pet/pet.html` `dashboard/dashboard.html` `pet/DESIGN.md` `dashboard/DESIGN.md` `main/DESIGN.md` `shared/feed-service.js` `main/index.js` `main/tooltip-manager.js` | — | **委派**：infra-06 feed-service、infra-07 exp-service、infra-08 satiety-service、infra-09 tooltip IPC、dash-02 RPG布局、pet-07 经验接入、dash-01 多次续修（exp条/饱腹上限/tooltip）；**自己修**：冗余script标签、3份DESIGN同步、progress分支引用、FEED_CONFIG抽出硬编码、session-log按分类重组、CLAUDE.md模板加"先讨论再行动"+收尾检查清单；**三轮审计**（main/renderer/docs）发现并修6项：dashboard硬编码事件字符串→EVENTS常量、main/DESIGN缺tooltip通道、pet/DESIGN状态字段不全、index.js未用dialog import、tooltip窗口复用闪烁、pet:state:set委托描述不准 |
| **ARCH-04** | 2026-07-14 | 接替 ARCH-03，委派 9 窗口 + 分支清理 + 文档同步 | `PROJECT_BRIEF.md` `docs/progress.md` `docs/session-log.md` `main/index.js` `src/renderer/dashboard/dashboard.js` `src/renderer/shared/mood-service.test.mjs` | — | **委派**：dash-03 导航栏、dash-04 仓库页、infra-10 mood-service、pet-08 宠物心情、dash-05 心情卡片、dash-06 tooltip 修复、dash-07 仓库交互、dash-08 商店、dash-09 设置；**自己修**：面板态右键菜单屏蔽、handleFeed 补心情/经验/toast、mood 浮点测试 12 用例、PROJECT_BRIEF 全面审计同步；面板四页全部完成；远程残留分支 `origin/feature/pet-movement` `origin/feature/shared-event-bus-pet-state` 待网络恢复后清理 |
| **ARCH-05** | 2026-07-14~17 | 接替 ARCH-04，零碎修复 + 审计 + 设计讨论 + 委派 dash-11 | `src/renderer/shared/exp-service.js` `src/renderer/shared/exp-service.test.mjs` `src/renderer/shared/event-bus.js` `src/renderer/shared/satiety-service.js` `src/main/overlay-manager.js` `docs/events.md` `src/main/DESIGN.md` `docs/progress.md` `PROJECT_BRIEF.md` `docs/session-log.md` `docs/superpowers/specs/2026-07-15-pet-customization-design.md` `docs/superpowers/specs/2026-07-15-productivity-modules-design.md` | — | ① exp-service 测试日期依赖修复；② event-bus.js DEBUG 开关；③ 删 suggestMood 死代码 + overlay _reject 统一；④ 设计讨论：桌宠形象化 B 方案、皮肤系统 A 方案、番茄钟 & 活动监视，写两份 spec；⑤ 委派 dash-11（自动走动迁移到设置面板）；⑥ dash-11 收尾：清理 wander:toggle 死文档引用；⑦ 接待 ARCH-06 番茄钟交付（pull + 审查） |
| **ARCH-06** | 2026-07-16~17 | 番茄钟立项 + 拆窗委派 + 时长记录追加 | `specs/pomodoro.md` `PROJECT_BRIEF.md` `docs/progress.md` `docs/session-log.md` | — | 讨论确认番茄钟需求细节（5~120min/1~60min/宠物浮动图标/面板SVG进度环/右键动态菜单/时长统计+每日日志）；拆 5 窗口：infra-11（主进程+共享层）、infra-11续（时长+日志）、dash-10（面板页）、dash-10续（时长显示）、pet-09（浮动图标+气泡）；16 文件改动，8 bug 审查阶段全修；全模块无越界授权，0 冲突 |
| **ARCH-07** | 2026-07-18 | 2048 游戏立项 + 需求讨论 + 拆窗委派 + 审查交付 | `specs/game-2048.md` `CLAUDE.md` `PROJECT_BRIEF.md` `docs/progress.md` `docs/session-log.md` | — | 逐项讨论 9 个设计决策（计分/余数/日限/导航/持久化/存档/重新开始/2048后/结算按钮）；收益模型从递减改为递增（难度匹配）；拆 2 窗口：infra-12（收益结算共享服务 + store）+ dash-12（游戏本体 + 面板集成）；审查 136 测试全过；CLAUDE.md 新增"动工前先报告"和"交付前自检"两条规则；dash-12 结算返回按钮修复 |

## infra（共享基础设施）

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **infra-01** | 2026-07-12 | EventBus + PetState 实现 | `shared/event-bus.js` `shared/pet-state.js` `pet/pet.html` | `pet/pet.html`（修 type="module" bug） | on/off/once/emit、try-catch 隔离、PetState 薄接口 init/get/set/subscribe、跨进程整体快照契约、14/14 验证通过、已合并 main |
| **infra-02** | 2026-07-12 | 新增 PET_STATE_CHANGED 通用事件 | `shared/events.js` `shared/pet-state.js` `docs/events.md` `docs/progress.md` | 无 | pet-state.js set() 在映射事件后追加 emit PET_STATE_CHANGED {key, value}，所有 key 触发；events.md 登记新事件 |
| **infra-03** | 2026-07-12 | 通用悬浮面板（overlay）基础设施 | `main/overlay-manager.js` `main/overlay-preload.js` `renderer/overlay/overlay.html` `renderer/overlay/overlay.js` `renderer/overlay/overlay.css` `main/preload.js` `main/index.js` `docs/progress.md` `docs/overlay-design.md` | 无（基础设施任务，有权改 main 和 shared） | showOverlay({html,width,height,x,y})→Promise；独立BrowserWindow(parent=宠物)；CSS原生拖拽；data-overlay-result事件委托；单例+did-fail-load容错；pet-05 喂食flyout将基于此实现 |
| **infra-04** | 2026-07-13 | PetState.flush() 跨页面状态同步 | `shared/pet-state.js` `pet/pet.js` `dashboard/dashboard.js` `docs/progress.md` | 无 | 新增 flush() 方法（清除防抖计时器→立即写盘）；pet.js onMenuStatus / dashboard.js btn-close 在 toggleWindow 前 await flush()，解决喂食后切面板时 500ms 防抖导致存档未落盘的问题 |
| **infra-05** | 2026-07-13 | hunger → satiety 全局重命名，反转数值方向 | `main/storage/store.js` `shared/events.js` `shared/pet-state.js` `pet/pet.js` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/events.md` `docs/progress.md` | 无 | 饥饿→饱腹：初始100，喂食+N，随时间下降（反转了旧设计"越低越饿"）；事件 PET_HUNGER_CHANGED→PET_SATIETY_CHANGED；FOODS/FOOD_META hunger:-N→satiety:+N；去掉 Math.max(0,下界) clamp；CSS class card--hunger→card--satiety；mood 'hungry' 和 DIALOGS.hungry 不动 |
| **infra-06** | 2026-07-13 | 新建 feed-service.js + 清理 pet-ipc.js 死代码 | `shared/feed-service.js` `pet/pet.js` `dashboard/dashboard.js` `main/ipc/pet-ipc.js` `main/index.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `pet/pet.js` `dashboard/dashboard.js`（替换本地 FOODS/FOOD_META→共享 feed-service） | 新建 feed-service.js（FOODS + consumeFood/applyFeed/emitFed），两模块切换引用；pet-ipc.js 删除 pet:state:set 死代码（被 index.js zoomLevel 保护覆盖），导出 isValidSnapshot；index.js 复用校验；emitFed 填补 PET_FED 事件无人 emit 的空白 |
| **infra-07** | 2026-07-13 | 经验系统共享层 | `shared/exp-service.js` `shared/feed-service.js` `main/storage/store.js` `docs/progress.md` `docs/session-log.md` | 无 | 新建 exp-service.js（分段控速公式/溢出继承/每日互动20次上限/maxLevel 30）；feed-service.js FOODS 加 exp 字段（5~25）；store.js DEFAULT_STATE 加 dailyInteractionCount/lastInteractionDate；纯函数不碰 PetState，十原则全过；31 个测试用例全部通过 |
| **infra-08** | 2026-07-13 | 饱腹值消耗系统 | `shared/satiety-service.js` `main/storage/store.js` `shared/feed-service.js` `pet/pet.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `feed-service.js`（applyFeed 改用动态最大饱腹值，level 参数默认 1 向后兼容） | 新建 satiety-service.js（纯函数+配置驱动）；时间戳差值结算离线衰减 0.2/min；在线 60s 定时器；satiety<30→hungry/恢复→neutral 心情建议（不直接改 PetState）；最大饱腹值每5级+20（Lv1=100→Lv30=220）；store.js 加 lastSatietyUpdate；pet.js init() 结算离线+启动在线 tick；feed-service applyFeed 向后兼容 |
| **infra-09** | 2026-07-13 | tooltip 独立 BrowserWindow IPC 通道 | `main/tooltip-manager.js` `main/index.js` `main/preload.js` `docs/progress.md` `docs/session-log.md` | 无 | 新建 tooltip-manager.js（show/hide/close 三个 IPC 通道）；data:URL 直出无 preload；focusable:false 不抢焦点；mouseleave→close 销毁对齐标准 Tooltip 交互范式；dashboard 侧由 dash-01 后续接线 |
| **infra-10** | 2026-07-14 | 心情系统共享层 mood-service.js | `shared/mood-service.js` `shared/mood-service.test.mjs` `main/storage/store.js` `shared/events.js` `docs/events.md` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `store.js`（mood 默认值 'neutral'→70）、`events.js`（PET_MOOD_CHANGED 注释更新 payload 类型） | 新建 mood-service.js（纯函数+配置驱动，8 个函数 + MOOD_CONFIG + MOOD_TIERS）；心情从 string 升级为 0-100 数值；自然衰减按自然日零点分段结算 + 单日 50 点上限（对齐 exp-service 每日重置逻辑）；饱腹<30 衰减翻倍（2/15 vs 1/15）；离线跨天逐日 apply 50 点上限；经验倍率三档 + 低心情互动减半；migrateMood 兼容旧 string 存档；44 个测试用例全部通过；后续 pet-08/dash-05 负责接入 |
| **infra-11** | 2026-07-17 | 番茄钟主进程 + 共享层 + 时长记录 | `main/pomodoro.js` `main/index.js` `main/preload.js` `main/storage/store.js` `shared/events.js` `docs/events.md` `docs/progress.md` `docs/session-log.md` | 无（基础设施任务，有权改 main 和 shared） | 新建 pomodoro.js（纯模块，状态机 idle/focus/break + setInterval 1000ms tick + Electron Notification + 统计 streak + 时长 todayFocusMs/totalFocusMs + dailyLog 按日明细）；store.js 加 pomodoroStats（含时长+日志）+ pomodoroFocusMin/pomodoroBreakMin 设置项；preload.js 加 pomodoro 命名空间 6 个 API；index.js 加 3 个 IPC 通道 + 右键菜单按 phase 动态切换 + initPomodoro 接线；events.js 加 POMODORO_TICK/POMODORO_PHASE_CHANGED；saveStats 自动清理 >365 天 dailyLog；🐛 三轮审查修 3 bug：① handleCommand('start') 漏推 phase:changed ② 右键导航 pomodoro:navigate 时序竞态 ③ store 加载设置值无边界校验；渲染进程番茄页面待后续实现 |
| **infra-12** | 2026-07-18 | 2048 收益结算服务 + store 数据结构 | `shared/game-reward-service.js`（新建） `shared/game-reward-service.test.mjs`（新建） `main/storage/store.js` `docs/progress.md` `docs/session-log.md` | 无 | 新建 game-reward-service.js（纯函数+配置驱动，5 个函数）：① calcScoreRewards 三段分段兑换（0~1000/1001~3000/3000+，四舍五入）② calcMilestoneRewards 首达阶梯 5 档（128~2048，连带触发，不重复）③ getMoodMultiplier 心情四档（≥80→1.2/<30→0.7/其他→1.0）④ applyMoodMultiplier（乘完四舍五入）⑤ calcTotalRewards 完整汇总（先 base+milestone 再乘倍率）；store.js DEFAULT_STATE 新增 game2048: { highScore:0, milestones:{128~2048:false}, savedGame:null }；43 个测试全部通过

## pet（宠物模块）

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **pet-00** | 2026-07-12 | 宠物状态持久化 IPC 接线 | `main/ipc/pet-ipc.js` `main/index.js` `docs/progress.md` | `main/index.js`（删内联handler→registerPetIPC，限接线不动其他逻辑） | registerPetIPC 注册 pet:state:get/set、整体覆盖写盘（非merge）、空快照保护防清档、幂等注册；⚠️ store.setState 会改传入对象挂 lastSaved；并发窗口改同一分支曾互相还原 |
| **pet-01** | 2026-07-12 | 宠物移动系统（JS拖拽→CSS原生） | `pet/pet.js` `pet/pet.css` `main/index.js` `main/preload.js` `docs/progress.md` | `main/index.js` `main/preload.js`（口头） | JS拖拽偏移诊断→CSS -webkit-app-region: drag、isAutoMoving、onUserDrag、随机走动glideTo、wander:toggle开关、躲避光标搁置；⚠️ pet-movement-design.md过时待更新、events.md缺user:drag和wander:toggle |
| **pet-02** | 2026-07-12 | 对话气泡 + 窗口缩放 | `pet/pet.js` `pet/pet.css` `pet/DESIGN.md` `main/index.js` `docs/progress.md` `docs/session-log.md` | 无（`main/index.js` 为架构窗口任务提示词中授权） | 28 条台词 mood×level、no-drag 点击修复、getPetSize() 动态尺寸、右键缩放菜单(75/100/125/150%)、zoomLevel 持久化、走动尺寸防漂移(setBounds+基准尺寸)、缩放/切面板保持位置(中心锚点+savedPetBounds)；🔴 Windows 高 DPI setPosition+frameless+min=max→每帧+1px膨胀 |
| **pet-03** | 2026-07-12 | 双击面板切换 + 面板拖拽缩放 | `pet/pet.js` `main/index.js` `main/preload.js` `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` | `main/preload.js`（口头，加 setWindowBounds/getWindowBounds） | 双击→toggleWindow→loadFile、面板顶部栏(可拖拽)+✕关闭、面板边缘纯JS缩放(setBounds IPC+RAF光标循环)；🔴 去掉了setResizable(true)→Windows原生缩放边框会显示禁止符号；第二次打开面板很小→先loadFile再解锁尺寸；RAF async空指针→同步取尺寸+异步取位置分步 |
| **pet-04** | 2026-07-12 | 右键菜单喂食/状态 IPC 对接 | `pet/pet.js` `docs/progress.md` `docs/session-log.md` | 无 | showBubble 加可选 customText；onMenuFeed 消耗首个食物→hunger-20/intimacy+5→气泡反馈；onMenuStatus→toggleWindow()；init() 注册两监听器 |
| **pet-05** | 2026-07-12 | 食物库存结构改造 + 喂食 overlay | `pet/pet.js` `pet/pet.css` `docs/progress.md` `docs/session-log.md` | 无 | Phase 1: foodInventory C→A分离（FOODS配置+{id,count}数据，原则5）；全量渲染降序+count=0禁用；Phase 2: flyout从pet窗口内DOM→独立BrowserWindow overlay（infra-03 showOverlay）；暂停走动；取消/选食物/开仓库三种路径 |
| **pet-06** | 2026-07-13 | 补两处 toggleWindow 前缺的 flush() | `pet/pet.js` `docs/progress.md` `docs/session-log.md` | 无 | infra-04 漏了 __warehouse__ 分支和双击切面板两处的 flush()；在 toggleWindow() 前加 await PetState.flush()，确保喂食变更落盘后再切面板 |
| **pet-07** | 2026-07-13 | 宠物侧经验获取接入 | `pet/pet.js` `docs/progress.md` `docs/session-log.md` | 无 | 点击气泡→grantInteractionExp()（每日20次上限，首次超限提示）；喂食成功→getFoodExp→addExp 结算；升级→showBubble("🎉 升级了！Lv.X！")叠加显示；连升多级只弹最终等级；_dailyCapHintShown 内存标记跨天重置 |
| **pet-08** | 2026-07-14 | 宠物侧接入新心情系统 | `pet/pet.js` `main/storage/store.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `store.js`（DEFAULT_STATE 加 5 个心情字段） | 基于 infra-10 mood-service.js：1) init() 中 migrateMood 旧 string→number；2) settleMoodDecay() 心情衰减按自然日分界+单日50点上限+饱腹<30翻倍；3) settleSatietyDecay 移除 suggestMood；4) 点击→boostMood+clickDailyCap 20次；5) 喂食→boostMood+3；6) grantInteractionExp 加 getExpMultiplier 心情加成；7) 喂食经验 getExpMultiplier 加成；8) DIALOGS 重构 happy/good/neutral/low 四档，旧 hungry+sad 合并→low；pickDialog 改用 getMoodTier().tier；⚠️ dashboard.js renderMood() 仍用旧 string 模式，dash-05 已跟进修复 |
| **pet-09** | 2026-07-17 | 宠物番茄浮动图标 + 气泡 | `pet/pet.html` `pet/pet.js` `pet/pet.css` `docs/progress.md` `docs/session-log.md` | 无 | 依赖 infra-11（pomodoro API）：① pet.html 加 #pomodoro-indicator ② pet.js init() 中 getState() 初始化 + onTick 每秒更新 🍅/☕/⏸ + MM:SS + onPhaseChange break→focus 弹出"继续加油！💪" ③ pet.css 白色文字 + 阴影定位在宠物上方 72%；idle 自动隐藏；🐛 审计发现 abort→idle 后图标不消失（pomodoro.js 守卫 phase!=='idle' 时不推 tick），onPhaseChange 加 phase==='idle' 分支兜底；退出 App 重置后 getState() 返回 idle 自动隐藏 |

## dash（面板模块）

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **dash-01** | 2026-07-13 | 面板宠物状态展示 + 多次修复与打磨 | `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 初始实现：混合格局卡片 + PET_STATE_CHANGED 增量刷新 + 食物网格+快速投喂；续修：FOOD_META缺id→库存×0、satiety上限+toast、exp→calcRequiredExp+蓝色进度条、硬编码100→calcMaxSatiety(level)、饱腹值取整、tooltip字段驱动+独立BrowserWindow(infra-09配合)；其他窗口改动：flush()、hunger→satiety、feed-service切换、RPG两层布局 |
| **dash-02** | 2026-07-13 | 面板 RPG 角色卡布局重构 | `dashboard/dashboard.js` `dashboard/dashboard.css` `dashboard/DESIGN.md` `docs/progress.md` `docs/session-log.md` | 无 | 卡片平铺→角色展示式两层布局：上半区形象展示（emoji居中+左右各3槽位虚线占位），下半区信息数据（等级/心情/饱腹/亲密度/金币/食物库存）；overflow-y:auto 从#content-area移到.info-layer；padding分给两层；保留所有id、render*()、handleFeed()、事件绑定不动；新增info-row--2col/--full/--3col语义化行容器方便扩展 |
| **dash-03** | 2026-07-14 | 面板左侧导航栏 + 多页切换架构 | `dashboard/nav-config.js` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 新增 nav-config.js（原则5配置驱动，4项导航含主页/仓库/商店/设置）；refactor dashboard.js：buildStatusDOM→buildHomePage、switchPage()+fade过渡、buildNavBar()+updateNavActive()、bindHomePageEvents()提取；占位页面通用 buildPlaceholderPage()；暗色主题(#252525)+选中高亮(#2196f3左边框)；置灰项 pointer-events:none；先讨论设计再编码 |
| **dash-04** | 2026-07-14 | 仓库页面：分类 Tab 栏 + 物品网格 | `dashboard/nav-config.js` `dashboard/dashboard.js` `dashboard/dashboard.css` `shared/feed-service.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `shared/feed-service.js`（FOODS 每个条目加 `category: 'food'` 字段，纯增量不破坏现有代码） | WAREHOUSE_CATEGORIES 配置数组（原则5）+ buildWarehousePage 渲染器；switchPage 新增 _pageCleanup 机制（页面切换时调旧页清理函数，防订阅泄漏）；Tab（全部/食物/道具，道具置灰占位）+ 物品网格（自适应 auto-fill + emoji+名称+数量 + fade 200ms）+ PET_STATE_CHANGED 订阅自动刷新；暗色主题对齐面板；FOODS 加 category 字段为未来分类扩展做准备 |
| **dash-05** | 2026-07-14 | 心情卡片改版：emoji + 进度条 + 档位 + 修复 MOOD_TIERS 浮点间隙 bug | `dashboard/dashboard.js` `dashboard/dashboard.css` `shared/mood-service.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `shared/mood-service.js`（MOOD_TIERS 边界从 79/49/29 → 80/50/30，消除浮点值掉到 fallback "低落" 的 bug） | 基于 infra-10 的 mood-service.js：renderMood() 改为水平单行布局（emoji + 档位文字 + 三色进度条 + 数值 + 档位标签）；旧 string 存档自动迁移→number（migrateMood）；删除旧 MOOD_MAP 常量；mood-header/mood-value/mood-tier-badge 新样式；🐛 发现并修复 MOOD_TIERS 间隙 bug（79.3→低落的严重错误） |
| **dash-06** | 2026-07-14 | 🐛 修复 tooltip：不显示 / 闪烁 / 快速滑动 Mojo 报错 | `main/tooltip-manager.js` `dashboard/dashboard.js` `docs/session-log.md` | ✅ 越界授权：用户授权改 `src/main/tooltip-manager.js` | 三个子问题：①不显示 — `42dafdd` 复用路径 `hide()+ready-to-show`，Electron 中 `ready-to-show` 仅首次渲染触发→窗口永远隐藏，回退为 `setPosition→stop→loadURL→showInactive`；②闪烁 — `mouseleave` 捕获在子元素间/穿过 gap 时误触发 hide，加 `relatedTarget.closest('#card-inventory')` 守卫，只在真正离开库存区时隐藏；③快速滑动 Mojo 报错 — 多个 `loadURL` 抢占，旧导航取消后残留 IPC 消息，加 `webContents.stop()` 清理。 |
| **dash-07** | 2026-07-14 | 仓库物品悬停 tooltip + 右键操作菜单 + 多轮 bug 修复 | `dashboard/dashboard.js` `shared/feed-service.js` `main/tooltip-manager.js` `main/overlay-manager.js` `main/index.js` `main/preload.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `shared/feed-service.js`（FOODS 加 sellPrice + tooltipFields 字段）+ 修 bug 需改 `main/` 四个文件 | ①悬停 tooltip：照搬主页 mouseenter/mouseleave 捕获模式，_whTooltipItem 防抖；TOOLTIP_FIELDS 扩展为字段驱动；buildTooltipHTML 按 food.tooltipFields 声明顺序渲染；②右键菜单：WH_MENU_ACTIONS 配置驱动，show() 控制显示/置灰，overlay 弹出；hover #2196f3 高亮；操作 use/sell/destroy；③tooltip 自动高度（方案B）：executeJavaScript 取 scrollHeight→fitToContent→setBounds；模块级 _targetX/Y/W 防竞态；ready-to-show await 消除首次闪烁；④mouseleave 守卫：closest('.wh-grid')→closest('.wh-item')，修垂直方向不消失 bug；⑤右键关闭三道保险：点菜单项/点菜单空白(data-overlay-result="null")/点外部(blur)；overlay-manager closeOverlayWindow() + force-close IPC；dashboard 切页/关闭调 closeOverlay；⑥tooltip 复用路径 loadURL().then() 替代 once('did-finish-load')，防监听器累积 |
| **dash-08** | 2026-07-14 | 商店页面：食物购买 | `dashboard/dashboard.js` `dashboard/dashboard.css` `dashboard/nav-config.js` `shared/feed-service.js` `main/storage/store.js` `docs/progress.md` `docs/session-log.md` | ✅ 越界授权：改 `shared/feed-service.js`（FOODS 加 buyPrice）+ `main/storage/store.js`（coins 默认 0→100）+ `nav-config.js`（shop enabled: true） | 商店页面落地：金币余额栏（#252525 暗色背景）+ 分类 Tab（完全复用仓库 wh-tabs 组件/样式/交互）+ 商品网格（shop-grid, minmax(100px,1fr)）+ 商品卡片（emoji + 名称 + 持有数量弱显示 #666 + 购买价金黄色 #ffc107 + 购买按钮绿色边框）；排序按 buyPrice 从低到高；购买按钮金币不足置灰 disabled；悬停 tooltip 复用主页 mouseenter/mouseleave 捕获模式，动态替换 tooltipFields（sellPrice→buyPrice）；右键菜单 SHOP_MENU_ACTIONS 配置驱动，首期仅「💰 购买」一项；状态订阅 PET_STATE_CHANGED（coins/foodInventory）自动刷新；_pageCleanup 防订阅泄漏；buildTooltipHTML 前缀逻辑扩展（buyPrice 同 sellPrice 不加 +） |

---

## dash-09 — 2026-07-14

**功能**：设置页面（首期 2 个设置项：悬浮提示开关 / 面板置顶。面板透明度搁置 — CSS 变量无法穿透 `transparent: false` 的窗口到达桌面，恢复需同时改窗口透明 + frame:false）
**改动文件**：
- `src/renderer/dashboard/settings-config.js`（新建）
- `src/renderer/dashboard/nav-config.js`
- `src/renderer/dashboard/dashboard.js`
- `src/renderer/dashboard/dashboard.css`
- `src/main/storage/store.js`
- `src/main/preload.js`
- `src/main/index.js`
- `docs/progress.md`
- `docs/session-log.md`
**越界授权**：`store.js`（settings 默认值）、`index.js`（setAlwaysOnTop IPC）、`preload.js`（暴露 setAlwaysOnTop）
**备注**：透明度在 initStatus() 中恢复避免闪烁；IPC 用 send/on 对齐项目风格；Tab 复用 .wh-tabs 样式

---

## dash-10 — 2026-07-17

**功能**：面板番茄钟页面
**改动文件**：
- `src/renderer/dashboard/nav-config.js`
- `src/renderer/dashboard/dashboard.js`
- `src/renderer/dashboard/dashboard.css`
- `docs/progress.md`
- `docs/session-log.md`
**越界授权**：无
**备注**：SVG 进度环（circle stroke-dashoffset）+ 倒计时 MM:SS 居中叠加；操作按钮按状态切换（idle→开始 / running→暂停+跳过+放弃/结束 / paused→继续+跳过+放弃/结束）；统计三列 grid（今日/总计含时长 1h 15m 格式 + 连续天数）；设置输入框仅 idle 可改（5~120 / 1~60）；tick 检测 isPaused 变化触发按钮刷新；phaseChange 更新统计和设置输入 disabled 状态；onNavigate 注册在 initStatus 常驻；清理函数取消 tick+phaseChange 订阅；🐛 自审修 3 bug：① tick handler 重复注册泄漏 ② break+paused 状态 data-action 写死 "abort" 而非 "end"→静默无响应 ③ progress() 无 clamp→phase 切换后 dashoffset 负数环溢出
**续（同日）**：统计行今日/总计加专注时长显示（formatDuration ms→"1h 15m"/"35m"），依赖 infra-11 续新增 todayFocusMs/totalFocusMs 字段；连续天数加"天"后缀；改动 dashboard.js + docs×2，无越界授权

---

## dash-11 — 2026-07-17

**功能**：将「自动走动」开关从右键菜单移到设置面板
**改动文件**：
- `src/renderer/dashboard/settings-config.js`
- `src/main/storage/store.js`
- `src/main/index.js`
- `src/main/preload.js`
- `src/renderer/pet/pet.js`
- `docs/progress.md`
- `docs/session-log.md`
**越界授权**：`store.js`（settings 加 wanderEnabled 默认值）、`index.js`（删右键菜单 checkbox + wanderEnabled 变量）、`preload.js`（删 onWanderToggle）、`pet.js`（改从 PetState settings 读取 + EVENTS 订阅）
**备注**：wander:toggle IPC 已移除，`docs/events.md` L28 的 wander:toggle 条目待后续窗口清理；pet.js 新增 `import { EVENTS }`，onWanderToggle() 函数保留，仅供 PetState 订阅回调驱动

---

## dash-12 — 2026-07-18

**功能**：2048 游戏模块（游戏逻辑 + UI + 面板集成）

**改动文件**：
- `src/renderer/games/2048/2048-game.js`（新建）
- `src/renderer/games/2048/2048-ui.js`（新建）
- `src/renderer/games/2048/2048.css`（新建）
- `src/renderer/games/2048/DESIGN.md`（新建）
- `src/renderer/dashboard/nav-config.js`
- `src/renderer/dashboard/dashboard.js`
- `src/main/storage/store.js`
- `docs/progress.md`
- `docs/session-log.md`

**越界授权**：`store.js`（initStore 中清除 game2048.savedGame，防止 App 重启后恢复旧局）

**备注**：
- 游戏逻辑 6 个纯函数（createGame/move/isGameOver/maxTileOf/serialize/deserialize），不碰 DOM/PetState
- 操作方式：键盘方向键 + 鼠标拖拽（≥30px 阈值，水平/垂直主导方向判定）
- 集成 game-reward-service：分段兑换 + 首达阶梯 + 心情倍率，先汇总再乘
- 持久化：面板内切页内存保留（_game 模块变量）→ 关面板序列化到 PetState.savedGame → 开面板反序列化 → App 重启 store.js 清除
- rewardsClaimed 标记防重复发收益
- 结算弹窗：再来一局（新局+收益到账）或返回（回主页+收益到账）
- 重新开始：任意时刻可点，二次确认，本局不计收益
- 样式通过 JS 动态注入 <style> 标签自包含，不依赖 dashboard.css
- 导航项排在番茄（🍅）下方、设置（⚙️）上方
- 替换了 game.js/game.css 旧占位文件