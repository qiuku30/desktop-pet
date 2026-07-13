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
| **ARCH-04** | 2026-07-14 | 接替 ARCH-03，清理分支 + 尝试推送 | `docs/session-log.md` | — | 本地删除 `feature/pet-movement` 残留分支；`git push origin main` 失败（网络不通，Connection reset）；远程残留分支 `origin/feature/pet-movement` `origin/feature/shared-event-bus-pet-state` 待网络恢复后清理；68 commits 待推送；下一步模块方向待用户决定 |

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

## dash（面板模块）

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **dash-01** | 2026-07-13 | 面板宠物状态展示 + 多次修复与打磨 | `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 初始实现：混合格局卡片 + PET_STATE_CHANGED 增量刷新 + 食物网格+快速投喂；续修：FOOD_META缺id→库存×0、satiety上限+toast、exp→calcRequiredExp+蓝色进度条、硬编码100→calcMaxSatiety(level)、饱腹值取整、tooltip字段驱动+独立BrowserWindow(infra-09配合)；其他窗口改动：flush()、hunger→satiety、feed-service切换、RPG两层布局 |
| **dash-02** | 2026-07-13 | 面板 RPG 角色卡布局重构 | `dashboard/dashboard.js` `dashboard/dashboard.css` `dashboard/DESIGN.md` `docs/progress.md` `docs/session-log.md` | 无 | 卡片平铺→角色展示式两层布局：上半区形象展示（emoji居中+左右各3槽位虚线占位），下半区信息数据（等级/心情/饱腹/亲密度/金币/食物库存）；overflow-y:auto 从#content-area移到.info-layer；padding分给两层；保留所有id、render*()、handleFeed()、事件绑定不动；新增info-row--2col/--full/--3col语义化行容器方便扩展 |
| **dash-03** | 2026-07-14 | 面板左侧导航栏 + 多页切换架构 | `dashboard/nav-config.js` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` `docs/session-log.md` | 无 | 新增 nav-config.js（原则5配置驱动，4项导航含主页/仓库/商店/设置）；refactor dashboard.js：buildStatusDOM→buildHomePage、switchPage()+fade过渡、buildNavBar()+updateNavActive()、bindHomePageEvents()提取；占位页面通用 buildPlaceholderPage()；暗色主题(#252525)+选中高亮(#2196f3左边框)；置灰项 pointer-events:none；先讨论设计再编码 |
