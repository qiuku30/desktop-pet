# 窗口会话日志

> 出 bug 时按编号追溯。架构窗口分配编号，实现窗口结束后登记。

## 命名规则

- **ARCH-NN** — 架构窗口
- **infra-NN** — 共享基础设施
- **pet-NN** — 宠物模块
- **dash-NN** — 面板模块
- **2048-NN** / **word-NN** / **farm-NN** — 游戏模块（将来）

---

| 编号 | 日期 | 功能 | 改动文件 | 越界授权 | 备注 |
|------|------|------|----------|----------|------|
| **ARCH-01** | 2026-07-12 | 项目初始化 + 全部架构设计 | 全部文件骨架（35个文件），详见备注 | —（创建者，无越界概念） | 7 条 ADR、EventBus/PetState/store.js 架构决策、单窗口双状态、模块注册表、窗口角色分工规则、文档体系；协调多窗口协作；⚠️ JS拖拽→CSS原生拖拽教训(ADR-007)、实现窗口改完必须同步 DESIGN.md、多窗口并发改 index.js 最危险 |
| **infra-01** | 2026-07-12 | EventBus + PetState 实现 | `shared/event-bus.js` `shared/pet-state.js` `pet/pet.html` | `pet/pet.html`（修 type="module" bug） | on/off/once/emit、try-catch 隔离、PetState 薄接口 init/get/set/subscribe、跨进程整体快照契约、14/14 验证通过、已合并 main |
| **pet-00** | 2026-07-12 | 宠物状态持久化 IPC 接线 | `main/ipc/pet-ipc.js` `main/index.js` `docs/progress.md` | `main/index.js`（删内联handler→registerPetIPC，限接线不动其他逻辑） | registerPetIPC 注册 pet:state:get/set、整体覆盖写盘（非merge）、空快照保护防清档、幂等注册；⚠️ store.setState 会改传入对象挂 lastSaved；并发窗口改同一分支曾互相还原 |
| **pet-01** | 2026-07-12 | 宠物移动系统（JS拖拽→CSS原生） | `pet/pet.js` `pet/pet.css` `main/index.js` `main/preload.js` `docs/progress.md` | `main/index.js` `main/preload.js`（口头） | JS拖拽偏移诊断→CSS -webkit-app-region: drag、isAutoMoving、onUserDrag、随机走动glideTo、wander:toggle开关、躲避光标搁置；⚠️ pet-movement-design.md过时待更新、events.md缺user:drag和wander:toggle |
| **pet-02** | 2026-07-12 | 对话气泡 + 窗口缩放 | `pet/pet.js` `pet/pet.css` `pet/DESIGN.md` `main/index.js` `docs/progress.md` `docs/session-log.md` | 无（`main/index.js` 为架构窗口任务提示词中授权） | 28 条台词 mood×level、no-drag 点击修复、getPetSize() 动态尺寸、右键缩放菜单(75/100/125/150%)、zoomLevel 持久化、走动尺寸防漂移(setBounds+基准尺寸)、缩放/切面板保持位置(中心锚点+savedPetBounds)；🔴 Windows 高 DPI setPosition+frameless+min=max→每帧+1px膨胀 |
| **ARCH-02** | 2026-07-12 | 审查实现窗口 + 补架构决策 | `store.js` `docs/architecture.md` `docs/pet-movement-design.md` `docs/session-log.md` `PROJECT_BRIEF.md` `docs/progress.md` `CLAUDE.md` | — | 审查 pet-02（补 zoomLevel、ADR-001/005/007 更新、no-drag→✅）/ 审查 pet-03（ADR-008 setBounds高DPI）/ 建 session-log.md + CLAUDE.md/PROJECT_BRIEF.md 加引用 + 窗口命名规则 |
| **pet-04** | 2026-07-12 | 右键菜单喂食/状态 IPC 对接 | `pet/pet.js` `docs/progress.md` `docs/session-log.md` | 无 | showBubble 加可选 customText；onMenuFeed 消耗首个食物→hunger-20/intimacy+5→气泡反馈；onMenuStatus→toggleWindow()；init() 注册两监听器 |
| **infra-02** | 2026-07-12 | 新增 PET_STATE_CHANGED 通用事件 | `shared/events.js` `shared/pet-state.js` `docs/events.md` `docs/progress.md` | 无 | pet-state.js set() 在映射事件后追加 emit PET_STATE_CHANGED {key, value}，所有 key 触发；events.md 登记新事件 |
| **pet-05** | 2026-07-12 | 食物库存结构改造 + 喂食 flyout（⏸️ 暂停，等 infra-03） | `pet/pet.js` `pet/pet.css` `docs/progress.md` `docs/session-log.md` | 无 | foodInventory 字符串数组→对象数组分离（FOODS配置+{id,count}数据，原则5）；FOODS 5种食物全量渲染降序排列；count=0灰色禁用；flyout 暂停走动；⏸️ 定位受宠物窗口尺寸限制→ARCH决定改用独立BrowserWindow overlay，等 infra-03 做通用 showOverlay API 后继续 |
| **pet-03** | 2026-07-12 | 双击面板切换 + 面板拖拽缩放 | `pet/pet.js` `main/index.js` `main/preload.js` `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `docs/progress.md` | `main/preload.js`（口头，加 setWindowBounds/getWindowBounds） | 双击→toggleWindow→loadFile、面板顶部栏(可拖拽)+✕关闭、面板边缘纯JS缩放(setBounds IPC+RAF光标循环)；🔴 去掉了setResizable(true)→Windows原生缩放边框会显示禁止符号；第二次打开面板很小→先loadFile再解锁尺寸；RAF async空指针→同步取尺寸+异步取位置分步 |
| **infra-03** | 2026-07-12 | 通用悬浮面板（overlay）基础设施 | `main/overlay-manager.js` `main/overlay-preload.js` `renderer/overlay/overlay.html` `renderer/overlay/overlay.js` `renderer/overlay/overlay.css` `main/preload.js` `main/index.js` `docs/progress.md` `docs/overlay-design.md` | 无（基础设施任务，有权改 main 和 shared） | showOverlay({html,width,height,x,y})→Promise；独立BrowserWindow(parent=宠物)；CSS原生拖拽；data-overlay-result事件委托；单例+did-fail-load容错；pet-05 喂食flyout将基于此实现 |
