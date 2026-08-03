# 农场视觉升级最终验收执行计划

> **供代理执行：** 必须使用 `executing-plans` 技能逐任务执行本计划并在每个 gate 后停下复核。所有步骤使用复选框跟踪。本计划是只读审计，禁止使用 `subagent-driven-development` 拆分实现，也禁止任何仓库或 Git 写操作。

**目标：** 在同一最终 HEAD 上，对农场视觉升级执行证据驱动的端到端独立验收，并给出 `READY`、`READY WITH FOLLOW-UPS` 或 `NOT READY` 结论。

**架构：** 验收分为静态合同、自动回归、源码态真实运行、同版打包态真实运行四层证据；每层都写入固定临时目录 `/tmp/farm-visual-08`，不向仓库写入报告或探针。任何阻断问题只复现、分级和上报，不在本窗口修复。

**技术栈：** Electron 43.1.0、Chromium 150、JavaScript ES modules、Node.js `node:test`、PixiJS 8.19.0、Electron Forge、ASAR、Computer Use、临时 Node/Electron 探针。

## 全局约束

- 仓库 `/Users/kudoshinichi/desktop-pet` 全程只读；不得修改、暂存、提交、合并、push、建分支或切分支。
- 唯一临时写入根为 `/tmp/farm-visual-08`；所有截图、JSON、日志和探针必须位于该目录，交付前删除整个目录。
- 可以按 `package-lock.json` 执行 `npm ci`，但不得修改 `package.json`、`package-lock.json`，不得执行 `npm audit fix`。
- 自动测试、人工观察和真实打包态证据必须来自启动时锁定的同一 HEAD；旧窗口、旧 worktree 和旧 package 结果只能作为背景。
- 关键命令因网络、沙箱或 GUI 权限失败时，先用 `systematic-debugging` 区分环境失败与代码失败，再按工具规则请求授权重跑。
- 发现 Critical、Important 或违反批准设计的 Minor 时总体结论必须为 `NOT READY`；不违反合同的纯美观建议才可进入 `READY WITH FOLLOW-UPS`。
- 不新增事件、IPC、依赖、持久化字段或业务 schema，不改变经济、库存、事务、计时、提醒、宠物动作或回退语义。
- 不使用 `about:blank` 跨来源探针代替同 `app.asar` 页面来源。
- 每个任务结束时执行 `git status --short --branch` 和 `git diff --check`；任何跟踪文件变化立即停止并上报。
- 本窗口没有 commit 步骤。计划中每个“gate”取代常规实现计划的 commit gate。

---

### Task 1：锁定验收基线并完成静态合同审计

**文件：**

- 只读：`AGENTS.md`
- 只读：`PROJECT_BRIEF.md`
- 只读：`docs/architecture.md`
- 只读：`docs/progress.md`
- 只读：`docs/session-log.md`
- 只读：`docs/conventions.md`
- 只读：`docs/events.md`
- 只读：`specs/farm-system.md`
- 只读：`docs/superpowers/specs/2026-08-03-farm-final-visual-audit-design.md`
- 只读：全部 farm、Dashboard、pet、shared 相关生产代码、测试、CSS、HTML 与 `src/renderer/assets/farm/bright-homestead/**`
- 创建：`/tmp/farm-visual-08/baseline.json`
- 创建：`/tmp/farm-visual-08/static-audit.json`

**接口：**

- 输入：启动时的 `HEAD`、`main`、`origin/main`、工作区状态和已提交农场视觉资产/代码。
- 输出：不可变的 `baseline.json`，字段为 `head`、`main`、`originMain`、`branch`、`statusPorcelain`、`startedAt`；`static-audit.json`，字段为 `requiredCommits`、`assetPaths`、`manifest`、`itemIcons`、`moduleBoundaries`、`forbiddenWrites`、`result`。

- [ ] **Step 1：完整阅读事实来源并记录验收对象**

按以下顺序完整阅读：

```text
AGENTS.md
PROJECT_BRIEF.md
docs/architecture.md
docs/progress.md
docs/session-log.md
docs/superpowers/specs/2026-08-03-farm-final-visual-audit-design.md
```

随后按审计需要阅读 `docs/conventions.md`、`docs/events.md`、`specs/farm-system.md`、相关 farm 设计/spec/plan、`src/renderer/games/farm/DESIGN.md` 以及实际 farm、Dashboard、pet、shared 代码。不得只依赖任务提示词。

- [ ] **Step 2：执行只读 Git 基线**

运行：

```bash
git status --short --branch
git log --oneline --decorate -20
git diff --check
git rev-parse HEAD main origin/main
```

预期：工作区 porcelain 为空；`HEAD == main`；`origin/main` 可以落后，但必须如实记录；`git diff --check` 无输出。

- [ ] **Step 3：确认全部视觉交付位于当前 HEAD**

运行：

```bash
for commit in c3725bc 0d60c0b c6b1204 92ce4a1 01acf67 a70f1ef ca26e54; do git merge-base --is-ancestor "$commit" HEAD || exit 1; done
```

预期：退出码 0。七个提交分别对应完整农场资产、snapshot 场景、UI 接入、工坊/订单资产、工坊/订单 UI、旧食物图标和跨页面图标。

- [ ] **Step 4：创建固定临时证据目录和基线 JSON**

先确认目标只在 `/tmp`：

```bash
test ! -e /tmp/farm-visual-08
mkdir -p /tmp/farm-visual-08/screenshots /tmp/farm-visual-08/logs
```

使用 `apply_patch` 创建 `/tmp/farm-visual-08/baseline.json`，写入 Step 2 得到的完整 SHA、分支、状态和 ISO 时间，不允许写占位符。创建后运行：

```bash
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/baseline.json')); if(!/^[0-9a-f]{40}$/.test(b.head)||b.head!==b.main||b.statusPorcelain!=='') process.exit(1); console.log('baseline PASS', b.head)"
```

预期：输出 `baseline PASS`，后跟与 `git rev-parse HEAD` 相同的 40 位 SHA。

- [ ] **Step 5：审计资产、manifest 和 21 项图标映射**

检查：

```bash
node --test src/renderer/games/farm/farm-scene-manifest.test.mjs src/renderer/shared/item-config.test.mjs
```

再用只读 Node 探针导入 `farm.json` 与 `item-config.js`，记录：manifest 所有路径存在且非空；21 个 `iconSrc` 唯一映射存在；`ITEM_ICON_FALLBACK_SRC` 存在；所有 URL 为仓库内 `file:` URL；物品对象、feed 对象和 tooltip 数组仍冻结。探针代码只允许位于 `/tmp/farm-visual-08/static-audit.mjs`。

预期：测试退出码 0、fail 0；22 个物品图片 URL 全部解析到非空文件。

- [ ] **Step 6：审计模块边界与禁业务写入**

运行：

```bash
rg -n "localStorage|sessionStorage|writeFile|appendFile|FarmService|PetState|setMany" src/renderer/games/farm/farm-scene-*.js src/renderer/games/farm/farm-scene-*.mjs src/renderer/dashboard/dashboard-item-icons.mjs src/renderer/pet/pet-farm-reminder.mjs
rg -n "from ['\"]\.\./(pet|dashboard|games)/|from ['\"][^'\"]*/renderer/(pet|dashboard|games)/" src/renderer/games/farm src/renderer/dashboard src/renderer/pet
git diff -- package.json package-lock.json src/main src/renderer/shared/events.js docs/events.md
```

预期：第一、二个扫描没有生产越界命中；第三个 diff 为空。若扫描出现允许的测试文本或注释，必须逐条记录并用文件/行号解释，不能直接忽略。

- [ ] **Step 7：写入静态审计结果并执行 Task 1 gate**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/static-audit.json`，必须包含每项的 `expected`、`actual`、`status` 和证据命令。运行：

```bash
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/static-audit.json')); if(a.result!=='PASS') process.exit(1); console.log('static audit PASS')"
git status --short --branch
git diff --check
```

预期：`static audit PASS`；工作区继续无跟踪文件变化。若不通过，停止并上报 `NOT READY` 候选问题，不进入 Task 2。

---

### Task 2：执行聚焦、相关和 GUI 全仓自动回归

**文件：**

- 只读：仓库全部 `*.test.mjs`、生产 JavaScript 和 package 配置
- 创建：`/tmp/farm-visual-08/logs/focused-tests.log`
- 创建：`/tmp/farm-visual-08/logs/related-tests.log`
- 创建：`/tmp/farm-visual-08/logs/full-gui-tests.log`
- 创建：`/tmp/farm-visual-08/automated-audit.json`

**接口：**

- 输入：Task 1 锁定的完整 HEAD。
- 输出：三层测试日志与 `automated-audit.json`，字段为 `head`、`nodeVersion`、`electronVersion`、`focused`、`related`、`fullGui`、`syntax`、`diffCheck`、`result`。

- [ ] **Step 1：确认依赖状态，不足时只按 lockfile 安装**

运行：

```bash
node -e "for (const name of ['electron','pixi.js','@electron/asar']) { console.log(name, require.resolve(name)) }"
```

预期：三个模块都能解析。若缺失，运行 `npm ci`；如果网络或 cache 权限失败，按 `systematic-debugging` 区分环境并申请授权重跑。安装前后都必须运行：

```bash
git diff -- package.json package-lock.json
```

预期：始终为空。

- [ ] **Step 2：运行视觉运行时聚焦测试**

运行并保存完整输出：

```bash
set -o pipefail
node --test \
  src/renderer/games/farm/farm-scene-manifest.test.mjs \
  src/renderer/games/farm/farm-scene-model.test.mjs \
  src/renderer/games/farm/farm-scene-layout.test.mjs \
  src/renderer/games/farm/farm-scene-objects.test.mjs \
  src/renderer/games/farm/farm-scene-adapter.test.mjs \
  src/renderer/games/farm/farm-scene-loader.test.mjs \
  src/renderer/games/farm/farm-scene-static.test.mjs \
  src/renderer/games/farm/farm-scene-integration.test.mjs \
  src/renderer/games/farm/farm-ui-skin.test.mjs \
  src/renderer/games/farm/farm-processing-ui.test.mjs \
  src/renderer/games/farm/farm-orders-ui.test.mjs \
  src/renderer/dashboard/dashboard-item-icons.test.mjs \
  src/renderer/dashboard/dashboard-inventory.test.mjs \
  src/renderer/pet/pet-farm-reminder.test.mjs \
  src/renderer/shared/item-config.test.mjs \
  2>&1 | tee /tmp/farm-visual-08/logs/focused-tests.log
```

预期：退出码 0、fail 0；日志包含 adapter/loader 竞态、回退、UI skin URL、安全回退、跨页面图片状态机和 pet 纯数字合同。

- [ ] **Step 3：运行 farm、Dashboard、pet 相关回归**

运行：

```bash
set -o pipefail
node --test \
  src/renderer/games/farm/*.test.mjs \
  src/renderer/dashboard/*.test.mjs \
  src/renderer/pet/*.test.mjs \
  src/renderer/pet/animation/*.test.mjs \
  src/renderer/shared/*.test.mjs \
  2>&1 | tee /tmp/farm-visual-08/logs/related-tests.log
```

预期：退出码 0、fail 0；加工、订单、鸟、FarmService、库存、喂食、summary、提醒和 Dashboard 集成全部通过。

- [ ] **Step 4：在 GUI 环境运行全仓测试**

运行：

```bash
set -o pipefail
node --test 2>&1 | tee /tmp/farm-visual-08/logs/full-gui-tests.log
```

预期：退出码 0、fail 0。若 Electron 子进程在沙箱内以 `SIGABRT`、`SIGTRAP` 或 GPU 初始化失败，必须申请 GUI/沙箱外权限重跑同一命令；只有重跑通过才可继续。

- [ ] **Step 5：执行生产模块语法检查**

运行：

```bash
for file in \
  src/renderer/games/farm/farm-module.js \
  src/renderer/games/farm/farm-ui.js \
  src/renderer/games/farm/farm-processing-ui.js \
  src/renderer/games/farm/farm-orders-ui.js \
  src/renderer/games/farm/farm-scene-adapter.js \
  src/renderer/games/farm/farm-scene-loader.js \
  src/renderer/games/farm/farm-scene-static.js \
  src/renderer/games/farm/farm-scene-objects.js \
  src/renderer/dashboard/dashboard.js \
  src/renderer/dashboard/dashboard-item-icons.mjs \
  src/renderer/pet/pet-farm-reminder.mjs \
  src/renderer/shared/item-config.js; do node --check "$file" || exit 1; done
git diff --check
```

预期：全部退出码 0，`git diff --check` 无输出。

- [ ] **Step 6：记录自动化证据并执行 Task 2 gate**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/automated-audit.json`，逐组记录 tests/pass/fail/duration/command/log。禁止只写“测试通过”。验证：

```bash
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/automated-audit.json')); if(a.head!==JSON.parse(fs.readFileSync('/tmp/farm-visual-08/baseline.json')).head||a.result!=='PASS') process.exit(1); console.log('automated audit PASS')"
git status --short --branch
git diff --check
```

预期：`automated audit PASS`，仓库仍无跟踪文件变化。

---

### Task 3：完成源码态真实视觉、交互、回退与生命周期验收

**文件：**

- 只读：`src/renderer/dashboard/dashboard.html`
- 只读：`src/renderer/pet/pet.html`
- 只读：全部适用 CSS、模块、资产和 preload/main 入口
- 创建：`/tmp/farm-visual-08/source-audit.json`
- 创建：`/tmp/farm-visual-08/screenshots/source-800x600-*.png`
- 创建：`/tmp/farm-visual-08/screenshots/source-600x400-*.png`
- 创建：`/tmp/farm-visual-08/logs/source-console.log`

**接口：**

- 输入：Task 1 的 HEAD 和 Task 2 全绿结果。
- 输出：`source-audit.json`，包含 `visualMatrix`、`responsive`、`accessibility`、`intents`、`fallbacks`、`motion`、`cycles20`、`cleanup`、`screenshots`、`result`。

- [ ] **Step 1：用隔离用户数据启动当前源码应用**

确保 `/tmp/farm-visual-08/user-data-source` 不存在后启动：

```bash
npm start -- --user-data-dir=/tmp/farm-visual-08/user-data-source
```

使用 Computer Use 操作真实可见窗口。不得使用用户日常数据目录；不得为方便验证修改生产代码或持久化结构。

预期：桌宠启动，能进入 Dashboard 和农场；控制台没有未解释的 unhandled rejection 或崩溃。

- [ ] **Step 2：完成 800×600 视觉矩阵并截图**

把 Dashboard 内容尺寸设为 800×600，依次检查并记录：

```text
农田未选中
农田选中一格并展开右侧详情
加工 running/queued/empty 三槽与五配方
订单 ready/incomplete/cooldown 三纸
仓库 21 项
商店全部可购买项
Dashboard 首页 13 个可喂食库存单元
桌宠 matureCount > 0 指示器
```

每个画面检查：无横向溢出、关键文字对比清楚、图片 contain、无物品 Emoji、无拉伸/裁切/halo、按钮与焦点不被遮挡。截图文件固定为：

```text
/tmp/farm-visual-08/screenshots/source-800x600-field.png
/tmp/farm-visual-08/screenshots/source-800x600-field-selected.png
/tmp/farm-visual-08/screenshots/source-800x600-processing.png
/tmp/farm-visual-08/screenshots/source-800x600-orders.png
/tmp/farm-visual-08/screenshots/source-800x600-warehouse.png
/tmp/farm-visual-08/screenshots/source-800x600-shop.png
/tmp/farm-visual-08/screenshots/source-800x600-home.png
/tmp/farm-visual-08/screenshots/source-800x600-pet-indicator.png
```

预期：八张截图非空，全部满足设计合同。

- [ ] **Step 3：完成 600×400 视觉矩阵并截图**

把 Dashboard 内容尺寸设为 600×400，重复 Step 2。额外测量：

```text
document.documentElement.scrollWidth === document.documentElement.clientWidth
农田详情为有界底部抽屉且不遮住整块场景
加工与订单根节点 overflow-y 可滚动
加工 track/shelf 不独立取得 overflow-y:auto
仓库与商店项目图框为 36×36 CSS px
```

预期：八张窄屏截图非空；无横向溢出；页面根承担纵向滚动；焦点环不裁切。

- [ ] **Step 4：验证 Canvas、DOM、键盘和无障碍同步**

依次执行并记录：

```text
键盘 Tab 到 r0c0 原生镜像按钮
Enter 选择 r0c0
检查 aria-pressed=true、Canvas 同格轮廓、详情同步
再次 Enter 与 Space，确认焦点不丢失且不重复重建
Tab 到下一格，确认焦点可继续移动
Canvas 点击 processing、orders、pet、bird 和 tile 五类目标
```

五类 Canvas intent 的精确断言为：

```json
[
  {"type":"select-tile","tileId":"r0c0"},
  {"type":"open-processing"},
  {"type":"open-orders"},
  {"type":"claim-bird"},
  {"type":"click-pet"}
]
```

其中 `claim-bird` 记录必须额外满足 `typeof birdId === 'string' && birdId.length > 0`，并在证据 JSON 中保存运行时观察到的精确值。预期：Canvas 与 DOM/键盘进入同一控制器路径；`click-pet` 不改变 PetState/FarmService 或闲置计时。

- [ ] **Step 5：验证业务成功、失败和效果定位**

在隔离用户数据中准备可控状态，分别验证：种植、单格收获、批量收获、解锁、土地升级、建筑建造/移动/升级/拆除、小鸟领取；加工入队与 queued 取消确认；订单交付与放弃确认。每次记录操作前后可见状态和效果中心。

预期：效果映射严格为 plant→目标格、harvest→目标格、harvest-all→中心一次、unlock-land→目标格、upgrade-land→目标格、building-change→最终格、coins→小鸟位置；失败或取消没有成功效果；加工/订单事务与 30 分钟冷却语义不变。

- [ ] **Step 6：验证回退和图片两级错误状态**

使用 DevTools/受控 in-page 注入只改变资源加载结果，不修改仓库文件，依次验证：

```text
Pixi 正常 → mode=pixi
关键场景资源失败且 trusted background 可用 → mode=static
关键场景资源与 trusted background 均不可用 → mode=dom
单 optional 对象失败 → mode=pixi 且该对象 fallback/隐藏
物品 primary 图片 error → data-farm-item-icon=fallback
同一图片 fallback 再 error → data-farm-item-icon=hidden 且无 src
detached 旧图片 error → ignored
```

预期：回退只影响表现；文字、数量和操作保持；没有外部 URL、无限重试、重复监听器或 unhandled rejection。

- [ ] **Step 7：验证动效、20 次往返和 cleanup**

依次检查正常、`document.hidden`、离开农田、`prefers-reduced-motion: reduce`。随后执行 20 次：

```text
field → processing → orders → field → home → warehouse → shop → home
```

每轮记录 scene host 数、Canvas 数、document 图片 error listener 数、当前 observer 目标和 ticker 状态。完成后关闭页面并记录 cleanup。

预期：20 次后仍为单一 scene host、最多一个 live Canvas、单一 document 图片 listener；隐藏/reduced 时非必要动效停止；cleanup 后 Canvas/observer/media listener/timer 为 0，迟到 resolve/reject 不复活且无 unhandled rejection。

- [ ] **Step 8：写入源码态审计并执行 Task 3 gate**

使用 `apply_patch` 创建 `source-audit.json`，每项包含 `expected`、`actual`、`status`、`screenshot` 或日志位置。运行：

```bash
node -e "const fs=require('fs'); const a=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/source-audit.json')); if(a.result!=='PASS'||a.screenshots.length<16) process.exit(1); for(const p of a.screenshots){if(!fs.statSync(p).size)process.exit(1)} console.log('source audit PASS')"
git status --short --branch
git diff --check
```

预期：`source audit PASS`；仓库无跟踪变化。任一必要项缺证据则不能继续签收。

---

### Task 4：从同一 HEAD 生成 package 并审计 app.asar

**文件：**

- 只读：`package.json`
- 只读：`package-lock.json`
- 只读：`forge.config.js`
- 生成但不提交：`out/desktop-pet-darwin-arm64/desktop-pet.app/**`
- 创建：`/tmp/farm-visual-08/asar-audit.cjs`
- 创建：`/tmp/farm-visual-08/package-audit.json`
- 创建：`/tmp/farm-visual-08/logs/package.log`

**接口：**

- 输入：Task 1 锁定的 HEAD 与全绿源码态审计。
- 输出：同一 HEAD 的 `.app`/`app.asar` 和 `package-audit.json`，字段为 `head`、`forgeDurationMs`、`appPath`、`asarPath`、`outputKiB`、`appKiB`、`asarBytes`、`requiredEntries: { count, missing }`、`result`。

- [ ] **Step 1：删除旧 package 证据，避免复用旧包**

先只读确认目标精确为项目内 ignored `out`：

```bash
pwd
git check-ignore -v out
```

预期：`pwd` 为 `/Users/kudoshinichi/desktop-pet`，`out` 被 `.gitignore` 忽略。使用 Forge 自身重新生成产物；不得把已有 `out` 的时间戳或结果当作新鲜证据。

- [ ] **Step 2：运行最终 HEAD 的 Forge package**

运行：

```bash
set -o pipefail
npm run package 2>&1 | tee /tmp/farm-visual-08/logs/package.log
```

预期：退出码 0；日志包含 Copying、Preparing native dependencies、Packaging application、Running postPackage hook；产物为 `out/desktop-pet-darwin-arm64/desktop-pet.app`。

- [ ] **Step 3：创建精确 ASAR 审计脚本**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/asar-audit.cjs`，内容如下：

```js
const fs = require('node:fs')
const path = require('node:path')
const asar = require('@electron/asar')

const appPath = path.resolve('out/desktop-pet-darwin-arm64/desktop-pet.app')
const asarPath = path.join(appPath, 'Contents/Resources/app.asar')
const entries = new Set(asar.listPackage(asarPath).map((entry) => entry.replace(/^\//, '')))

const itemNames = [
  'seed-wheat', 'seed-carrot', 'seed-corn', 'seed-strawberry', 'seed-pumpkin', 'seed-star-dew-fruit',
  'crop-wheat', 'crop-carrot', 'crop-corn', 'crop-strawberry', 'crop-pumpkin', 'crop-star-dew-fruit',
  'food-cookie', 'food-popcorn', 'food-carrot-juice', 'food-strawberry-milkshake', 'food-pumpkin-pie',
  'food-milk', 'food-apple', 'food-cake', 'food-fish', 'fallback',
]

const required = [
  'node_modules/pixi.js/dist/pixi.mjs',
  'src/renderer/assets/farm/bright-homestead/farm.json',
  'src/renderer/games/farm/farm-module.js',
  'src/renderer/games/farm/farm-ui.js',
  'src/renderer/games/farm/farm.css',
  'src/renderer/games/farm/farm-workshop.css',
  'src/renderer/games/farm/farm-orders.css',
  'src/renderer/dashboard/dashboard.html',
  'src/renderer/dashboard/dashboard.js',
  'src/renderer/dashboard/dashboard-item-icons.mjs',
  'src/renderer/dashboard/dashboard.css',
  'src/renderer/pet/pet.html',
  'src/renderer/pet/pet.js',
  'src/renderer/pet/pet-farm-reminder.mjs',
  'src/renderer/pet/pet.css',
  'src/renderer/shared/item-config.js',
  ...itemNames.map((name) => `src/renderer/assets/farm/bright-homestead/ui/items/${name}.webp`),
]

const missing = required.filter((entry) => !entries.has(entry))
const result = {
  appPath,
  asarPath,
  asarBytes: fs.statSync(asarPath).size,
  requiredEntries: required.length,
  missing,
  result: missing.length === 0 ? 'PASS' : 'FAIL',
}
console.log(JSON.stringify(result, null, 2))
if (missing.length) process.exitCode = 1
```

- [ ] **Step 4：执行 archive 审计并记录包体**

运行：

```bash
node /tmp/farm-visual-08/asar-audit.cjs
du -sk out/desktop-pet-darwin-arm64 out/desktop-pet-darwin-arm64/desktop-pet.app
stat -f '%z %N' out/desktop-pet-darwin-arm64/desktop-pet.app/Contents/Resources/app.asar
```

预期：脚本 `result=PASS`、`missing=[]`；Pixi、manifest、三份 farm CSS、跨页面模块、21 项物品图标和 fallback 全部入包。

- [ ] **Step 5：写入 package 审计并执行 Task 4 gate**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/package-audit.json`，填入真实完整 HEAD、耗时和包体，不得用依赖磁盘占用冒充 package 增量。运行：

```bash
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/baseline.json')); const p=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/package-audit.json')); if(p.head!==b.head||p.result!=='PASS'||p.requiredEntries.missing.length)process.exit(1); console.log('package audit PASS')"
git status --short --branch
git diff --check
```

预期：`package audit PASS`；任何 Git 变化都必须停止上报。

---

### Task 5：完成同版 app.asar 的真实运行验收

**文件：**

- 只读：`out/desktop-pet-darwin-arm64/desktop-pet.app/Contents/Resources/app.asar`
- 创建：`/tmp/farm-visual-08/packaged-audit.json`
- 创建：`/tmp/farm-visual-08/screenshots/packaged-800x600-*.png`
- 创建：`/tmp/farm-visual-08/screenshots/packaged-600x400-*.png`
- 创建：`/tmp/farm-visual-08/logs/packaged-console.log`

**接口：**

- 输入：Task 4 新鲜生成且 HEAD 匹配的 `app.asar`。
- 输出：`packaged-audit.json`，字段为 `head`、`pageUrls`、`runtimeImports`、`renderer`、`sizes`、`visualMatrix`、`intents`、`fallbacks`、`cycles20`、`lateAsync`、`cleanup`、`screenshots`、`result`。

- [ ] **Step 1：用隔离用户数据启动新鲜 packaged app**

启动：

```bash
out/desktop-pet-darwin-arm64/desktop-pet.app/Contents/MacOS/desktop-pet --user-data-dir=/tmp/farm-visual-08/user-data-packaged
```

若 macOS GUI 权限阻止启动，按工具规则申请授权。使用 Computer Use 操作真实可见窗口。

预期：应用来源为 Task 4 的 `.app`；用户数据与日常应用隔离；能从桌宠进入 Dashboard。

- [ ] **Step 2：证明同 archive 模块与资源链**

在真实 Dashboard 页面记录：

```text
location.href 指向 .../Contents/Resources/app.asar/src/renderer/dashboard/dashboard.html
farm-pixi-runtime.js 首层动态 import 成功
loadPixiRuntime() 内部 pixi.mjs import 成功
Application / Assets / Container / Sprite / Texture 均存在
renderer 为 WebGLRenderer 或已批准的 Pixi 可用 renderer
manifest URL 指向同 app.asar 的 bright-homestead/farm.json
```

记录首层 import、Pixi runtime 和首次 scene mount 的实际耗时。预期：完整链通过；不得使用 `about:blank` 来源替代。

- [ ] **Step 3：复验两档视觉、响应式和无障碍**

在 800×600 和 600×400 重复 Task 3 的农田、加工、订单、仓库、商店、首页库存和桌宠指示器矩阵。每档至少保存：field、field-selected、processing、orders、warehouse、shop、home、pet-indicator 八张截图。

预期：共至少 16 张打包态截图非空；与源码态合同一致；所有项目图片 `naturalWidth > 0`；21 项图标和 fallback 的实际解码尺寸为 192×192。

- [ ] **Step 4：用真实输入验证五类 Canvas intent 与键盘路径**

使用可见窗口和 Electron `webContents.sendInputEvent` 的 mouseMove/down/up，按真实 Canvas rect、逻辑缩放与 offset 计算中心，依次触发：

```text
select-tile(r0c0)
open-processing
open-orders
claim-bird(真实 birdId)
click-pet
```

随后用 Tab、Enter、Space 复验原生镜像的焦点、`aria-pressed`、Canvas 轮廓和重复激活幂等。

预期：五类 intent 顺序和载荷准确；键盘焦点不丢失；图片不截获指针。

- [ ] **Step 5：复验打包态回退、动效和迟到异步**

从同 `app.asar` Dashboard 页面导入实际 runtime/loader/adapter 和 Dashboard icon helper，在页面内以受控依赖注入执行：

```text
normal=pixi
critical failure=static
critical + trusted static unavailable=dom
optional asset failure=pixi + local fallback
primary item error=fallback
fallback item error=hidden + no src
destroy 后 late resolve/reject 不复活
hidden/reduced-motion 时 ticker 与 spritesheet 停止
```

预期：所有回退准确；未处理拒绝数组为空；cleanup error 不替换 primary error；最终 Canvas/host child 为 0。

- [ ] **Step 6：执行打包态 20 次生命周期循环**

执行 20 次：

```text
field → processing → orders → field → home → warehouse → shop → home
```

每轮包含一次 800×600↔600×400 resize、pause/resume 和 reduced-motion on/off。记录 Canvas CSS/backing 尺寸、DPR、scene host 数、Canvas 数和 listener 数。

预期：DPR clamp ≤2；800×600 最大 backing 不超过 1600×1200；600×400 最大 backing 不超过 1200×800；20/20 cleanup；最终 Canvas=0、host children=0、unhandled=[]。

- [ ] **Step 7：写入打包态审计并执行 Task 5 gate**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/packaged-audit.json`，记录真实 URL、版本、耗时、尺寸、五类 intent、回退矩阵、20 次结果和截图。运行：

```bash
node -e "const fs=require('fs'); const b=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/baseline.json')); const a=JSON.parse(fs.readFileSync('/tmp/farm-visual-08/packaged-audit.json')); if(a.head!==b.head||a.result!=='PASS'||a.screenshots.length<16||a.cycles20.passed!==20||a.cleanup.canvas!==0||a.cleanup.unhandled.length)process.exit(1); console.log('packaged audit PASS')"
git status --short --branch
git diff --check
```

预期：`packaged audit PASS`；仓库无跟踪变化。

---

### Task 6：独立复核证据、形成结论并清理临时文件

**文件：**

- 只读：Task 1～5 的所有 `/tmp/farm-visual-08/*.json`、日志和截图
- 创建后删除：`/tmp/farm-visual-08/final-report.md`
- 不修改：仓库全部文件

**接口：**

- 输入：baseline、static、automated、source、package、packaged 六组证据。
- 输出：向 ARCH-11 提交的完整中文报告与最终判定；临时目录清理证明；仓库零修改证明。

- [ ] **Step 1：核对六组证据属于同一 HEAD**

运行：

```bash
node - <<'NODE'
const fs = require('node:fs')
const root = '/tmp/farm-visual-08'
const baseline = JSON.parse(fs.readFileSync(`${root}/baseline.json`))
for (const name of ['automated-audit.json', 'package-audit.json', 'packaged-audit.json']) {
  const value = JSON.parse(fs.readFileSync(`${root}/${name}`))
  if (value.head !== baseline.head) throw new Error(`${name}: HEAD mismatch`)
}
for (const name of ['static-audit.json', 'automated-audit.json', 'source-audit.json', 'package-audit.json', 'packaged-audit.json']) {
  const value = JSON.parse(fs.readFileSync(`${root}/${name}`))
  if (value.result !== 'PASS') throw new Error(`${name}: ${value.result}`)
}
console.log('evidence head/result PASS', baseline.head)
NODE
```

预期：输出 `evidence head/result PASS`，后跟与基线 JSON 相同的 40 位 SHA。

- [ ] **Step 2：按严重度复核所有异常与建议**

逐条检查测试日志、console、截图和 JSON 中的 warning、failure、fallback、knownIssues。分类规则必须使用设计文档第 8 节：Critical、Important、Minor；违反已批准合同的 Minor 仍阻断。

预期：没有未分级异常。如果存在阻断项，最终结论固定为 `NOT READY`，报告必须给出最小复现、影响范围、疑似文件和建议 `farm-fix-*` 范围，但不得创建窗口。

- [ ] **Step 3：写完整临时最终报告**

使用 `apply_patch` 创建 `/tmp/farm-visual-08/final-report.md`，固定包含：

```markdown
# farm-visual-08 最终验收报告

## 结论
## 验收 HEAD 与环境
## 静态合同
## 自动测试计数
## 800×600 与 600×400 视觉结果
## 键盘与无障碍
## 业务交互与效果定位
## 回退矩阵
## 动效、20 次生命周期与迟到异步
## Forge 与同版 app.asar
## 问题分级与已知事项
## 仓库改动、越界授权与 Git 状态
## 临时证据索引与清理
```

所有章节必须填入实际数值和路径，不得写“见上文”“同此前窗口”或占位符。

- [ ] **Step 4：执行最终 Git 零修改 gate**

运行：

```bash
git status --short --branch
git diff --check
git diff --exit-code
git diff --cached --exit-code
test "$(git rev-parse HEAD)" = "$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/farm-visual-08/baseline.json')).head)")"
```

预期：所有命令退出码 0；没有 tracked、staged 或 HEAD 变化。

- [ ] **Step 5：向 ARCH-11 上报并等待接收确认**

上报内容必须包括：完整结论、测试总数、两档人工验证、源码态/打包态证据、回退、五类 intent、20 次生命周期、已知问题、环境失败诊断、仓库零修改、未执行 Git 写操作，以及临时目录尚待清理。ARCH-11 未确认已接收关键信息前，不得删除证据。

- [ ] **Step 6：接收确认后清理固定临时目录**

先核对目标：

```bash
test -d /tmp/farm-visual-08
find /tmp/farm-visual-08 -maxdepth 2 -type f -print
```

确认列表只包含本任务探针、日志、截图和 JSON 后，删除精确固定目录：

```bash
rm -rf /tmp/farm-visual-08
test ! -e /tmp/farm-visual-08
git status --short --branch
git diff --check
```

预期：临时目录不存在；仓库仍无跟踪变化。向 ARCH-11 补充“临时证据已清理”，然后回复“收尾完毕”。

## 执行交接

本计划只允许在独立 `farm-visual-08` 窗口中使用 `executing-plans` 执行。它不是实现任务，不使用子代理，不允许在 ARCH-11 当前窗口内联执行，也不存在提交或合并步骤。

执行前必须由 ARCH-11 向用户报告推荐执行方、难度、工具/技能、窗口编号、只读范围与临时目录；只有用户明确批准创建窗口后才能启动。
