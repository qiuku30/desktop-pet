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
| **ARCH-01** | 2026-07-12 | 项目初始化 + 架构设计 | `CLAUDE.md` `PROJECT_BRIEF.md` `docs/architecture.md` `docs/conventions.md` `docs/events.md` `docs/progress.md` `docs/pet-movement-design.md` `specs/pet-system.md` `src/main/index.js` `src/main/preload.js` `src/main/storage/store.js` `src/renderer/shared/events.js` `src/renderer/shared/module-registry.js` | — | 7 条 ADR、目录结构、窗口框架、store.js；actual shared code by infra-01 |
| **infra-01** | 2026-07-12 | EventBus + PetState 实现 | `shared/event-bus.js` `shared/pet-state.js` `pet/pet.html` | `pet/pet.html`（修 type="module" bug） | on/off/once/emit、try-catch 隔离、PetState 薄接口 init/get/set/subscribe、跨进程整体快照契约、14/14 验证通过、已合并 main |
| **pet-01** | 2026-07-12 | 宠物移动系统（JS拖拽→CSS原生） | `pet/pet.js` `pet/pet.css` `main/index.js` `main/preload.js` `docs/progress.md` | `main/index.js` `main/preload.js`（口头） | JS拖拽偏移诊断→CSS -webkit-app-region: drag、isAutoMoving、onUserDrag、随机走动glideTo、wander:toggle开关、躲避光标搁置；⚠️ pet-movement-design.md过时待更新、events.md缺user:drag和wander:toggle |
| **pet-02** | 2026-07-12 | 对话气泡 + 窗口缩放 + 高 DPI 修复 | `pet/pet.js` `pet/pet.css` `pet/DESIGN.md` `main/index.js` `docs/progress.md` | `main/index.js` | 28 条台词、no-drag 修复、getPetSize()、右键缩放菜单、zoomLevel 持久化；**高 DPI 三连坑**：①`setPosition`+min=max→1px/帧漂移→`setBounds`+`currentPetSize` ②左上角锚点缩放→中心锚点 ③切面板`center()`→`savedPetBounds`恢复原位 |
| **ARCH-02** | 2026-07-12 | 审查 pet-02 + 补架构 | `store.js` `docs/architecture.md` `docs/pet-movement-design.md` `PROJECT_BRIEF.md` `docs/progress.md` | — | DEFAULT_STATE 补 zoomLevel、ADR-001/005/007 更新、no-drag → ✅ |
| **pet-03** | 2026-07-12 | 双击面板 + 高 DPI 修复 | `pet/pet.js` `main/index.js` `dashboard/dashboard.html` `dashboard/dashboard.js` `dashboard/dashboard.css` `dashboard/DESIGN.md` | `main/index.js` `dashboard/*` | 双击→toggleWindow→loadFile、savedPetBounds、wanderEnabled、setBounds→ADR-008 |
| **ARCH-02** | 2026-07-12 | 审查 pet-03 | `docs/architecture.md` `PROJECT_BRIEF.md` `docs/progress.md` `docs/session-log.md` | — | 新增 ADR-008、建 session-log.md |
