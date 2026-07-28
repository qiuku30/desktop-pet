# 宠物模块技术设计

> ⚠️ 不确定的地方必须问用户，不要猜测。

## 组件结构

- `#pet-container` — 根容器（透明背景，`-webkit-app-region: drag` 整窗可拖）
- `#pet-body` — 宠物交互区域（`no-drag`，承接点击/双击）
  - `#pet-static-frame` — 奶油星团 `idle/001.webp` 静态首帧；动画加载期间显示
  - `#pet-canvas` — 奶油星团透明帧动画；素材全部就绪后显示
  - `#pet-fallback` — Emoji 回退；静态首帧或动画资源加载失败时显示
- `#speech-bubbles` — 气泡容器
- `#pomodoro-indicator` — 番茄钟浮标；与气泡同为 Canvas 上方 DOM 层

## 状态

- 心情（0-100 数值，四档 tier：happy/good/neutral/low）
- 等级（Lv.1 → Lv.30），含经验值（exp）与升级曲线
- 饱腹值（satiety，0-动态上限，随时间衰减）
- 亲密度（intimacy，喂食 +5）
- 金币（coins，待接入）
- 通用库存（`inventory`，命名空间 itemId → 数量）
- 每日互动计数（dailyInteractionCount / lastInteractionDate）
- 饱腹衰减时间戳（lastSatietyUpdate）

## 动画

> ✅ pet-12 已将 pet-10 基础设施和 pet-11 奶油星团素材接入桌宠态。

- 正常路径：`pet.js` 语义行为 → `PetAnimationRuntime` → `AnimationController`
  → `FrameRenderer` → Canvas。
- 启动路径：静态 `idle/001.webp` → 完整预加载后的 Canvas；初始 DOM 不显示 Emoji。
- 回退路径：静态首帧、清单、Canvas 或任一正式帧预加载失败时切换 Emoji，原点击、
  拖拽、菜单和窗口切换继续可用。
- CSS `breathe/sway/waddle` 只作用于 Emoji 回退；Canvas 不叠加 CSS 形变，避免双重动画。
- 高 DPI：Canvas CSS 尺寸跟随窗口，backing size 使用 `CSS px × devicePixelRatio`。
- 四档缩放触发 resize；当前语义动作通过控制器重新播放，接入层不计算帧时间。
- 奶油星团 `base` 形态显示比例锁定为 `scale: 0.6`；四档窗口缩放只改变窗口与
  Canvas 尺寸，角色相对窗口占比保持一致。
- 赶跑/回来仍属于后续阶段。

### 动画接入运行时（pet-12）

| 文件 | 职责 |
|------|------|
| `pet-animation-runtime.mjs` | 加载/校验清单、选择等级形态、解析并预加载七类动作、用户闲置与 sad 调度、移动朝向、resize、销毁 |
| `pet-animation-runtime.test.mjs` | 加载失败、顺序预加载、fallback 播放语义、自动移动守卫、feed/level-up 队列、sleep/wake、移动/一次性动作延迟、sad 条件、翻转、resize 和计时器清理 |

运行时不读取或写入持久化状态；`level`、`mood` 由 `pet.js` 通过窄接口传入。
当前动作、朝向、用户最后活动时间和调度计时器均为页面内状态。

### 七类动作映射

| 语义 | 触发 |
|------|------|
| `idle` | 默认静止 |
| `walk` | 自动走动期间；横向位移决定 left/right facing |
| `eat` | 成功消耗食物并更新养成状态后 |
| `happy` | 点击或其他非喂食升级时请求；若被更高优先级 `eat` 阻挡则去重排队；喂食同时升级时排为 `eat → happy` |
| `sad` | `mood < 30`、静止且无一次性动作时，每 2–5 分钟随机检查 |
| `interact` | 300ms 单双击判定后的有效单击 |
| `sleep` | 连续 10 分钟无有效用户互动，且移动/一次性动作已经结束 |

用户闲置计时只由有效单击、成功喂食、用户拖拽重置。自动走动及
`happy/sad/eat/interact` 不重置。到期时若正在移动或播放一次性动作，运行时用短间隔
重新检查，不复制动作帧时长；条件满足后进入 `sleep`。睡眠会暂停自动走动，自动走动
不能自行唤醒；任意上述有效用户互动立即唤醒并重新计时。

喂食升级使用运行时的一次性去重队列：成功喂食先播放 `eat`，完成后播放一次
`happy`，再由控制器恢复最新基础动作。队列中的 `happy` 与当前 transient 一样会延后
sleep；页面销毁会清空队列和轮询计时器。`pet.js` 在喂食内部写入 level 时标记来源，
避免同步 `PET_STATE_CHANGED` 订阅重复直播放 happy；点击/外部升级仍由订阅触发，
若此时正在播放 `eat`，则复用或新增唯一一个 queued happy，避免丢失或重复。
队列不改变 `eat > happy/interact > walk > sad/sleep > idle` 的既定优先级。

投喂物品来自共享物品目录的 feedable 能力集合，包含旧食物、可直接投喂作物和加工品。
投喂固定消耗一件，并从单一状态快照计算 `inventory/satiety/intimacy/mood/exp/level`；
`PetState.setMany()` 同步提交未抛异常后才发送 `PET_FED`，不为投喂额外 `flush()`。

### 生命周期

- `pet-startup-visual.mjs` 集中管理互斥的 `loading` / `ready` / `error` 三态；
- `loading` 只在静态首帧加载成功后显示它；`ready` 只显示 Canvas；`error` 只显示 Emoji；
- 静态层与 Canvas 共用 `anchoredDrawRect` 几何语义、`scale: 0.6` 和
  `anchor: (0.5, 0.92)`，resize 时按当前 viewport 重算，避免原子切换跳位；
- 七个动作按语义顺序预加载，避免某动作失败后其他动作晚到写回已销毁渲染器；
- 完整预加载成功并同步当前 viewport 后原子切换 `ready`；
- 静态图、清单或帧失败时切换 `error`；动画失败不会永久停在静态图；
- `ready` 后迟到的静态 error，以及 pagehide/destroy 后所有静态回调均无效；
- 缺失一次性动作回退到循环基础动作时，接入层只把该回退副本改为单次播放，
  避免 transient 永不结束；不修改清单或基础设施；
- 自动走动在异步窗口模式查询前后各检查一次实时状态，sleep/拖拽/overlay/关闭走动
  均可阻止晚到的移动；
- 素材加载结束后使用当前 DOM 尺寸再次同步 Canvas，覆盖加载期间发生的缩放；
- `pagehide` 清理 wander/resume/click/satiety/sad/sleep 计时器、RAF、IPC/PetState/
  番茄钟监听器、待播一次性动作队列，并销毁控制器和渲染器；
- 异步加载使用 token，忽略页面卸载后的旧结果；
- `AnimationController` 自有 token 继续负责一次性动作 stale completion。

## 移动系统（已实现）

> 桌面级：整个 200×200 窗口在屏幕上移动。详见 `docs/pet-movement-design.md` 和 ADR-007。

### 拖拽：CSS 原生方案

使用 `-webkit-app-region: drag`（OS 原生拖拽），零延迟零偏移，不是 JS+IPC。

主进程 `isAutoMoving` 标记区分用户拖拽和自动移动。用户拖拽时推送 `user:drag` 到渲染端暂停走动 300ms。

⚠️ **-webkit-app-region: drag 副作用**：会拦截子元素 click/mousedown。后续做气泡/双击时需在交互元素上加 `no-drag`。
详见 `docs/pet-movement-design.md` 第 6 节。

### 自动移动：IPC 方案

走动通过 `window:move` IPC（fire-and-forget），`glideTo` 用 rAF + easeOutCubic 缓动。

- 躲避光标：已搁置（IPC 延迟高），后续考虑主进程侧实现
- 面板态：全部暂停

### 状态机（优先级）

**用户拖拽（OS 原生）> FLEEING（搁置）> WANDERING > IDLE**

- **用户拖拽**：OS 原生，渲染端收到 `user:drag` 暂停自动化
- **WANDERING**：每 5~12s 随机挑 ±200px 目标 → ~1.2s 缓动滑过去
- **IDLE**：原地呼吸 + 轻晃动画

### 依赖

- 纯几何 `pet-motion.mjs`（无 DOM/IPC，`node --test` 覆盖）
- 主进程 IPC：`getWindowPosition()` / `moveWindow(x,y)` / `getCursorPos()` / `getWindowMode()`
- 主进程推送：`user:drag`（用户拖拽通知，暂停走动用）
- CSS class 钩子：`#pet-body.moving`（走动 squash&stretch）

### 滑行取消

`glideTo` 用自增 `glideToken` 让被更高优先级动作接管的旧帧自我作废。

## 对话系统

> ✅ 已实现（2026-07-12）

- **台词库**：28 条，按 `心情四档(happy/good/neutral/low)` × `等级(low 1-3 / mid 4-6 / high 7+)` 分层
- **交互**：单击 `#pet-body` → 300ms 延迟（为双击预留）→ 弹出气泡；双击 → `toggleWindow()` 切换面板；拖拽移动 > 3px 不出气泡
- **气泡**：`#speech-bubbles` 内绝对定位，`flex-direction: column-reverse` 垂直堆叠，最新气泡离宠物最近
- **动画**：`@keyframes bubble-pop`，2s ease-out（弹入 10% → 保持 → 淡出上飘），`animationend` 移除 DOM
- **`no-drag`**：`#pet-body` 加 `-webkit-app-region: no-drag` 让点击事件穿透 drag 拦截；父级 `#pet-container` 的 15px padding 保留拖拽区域

## 帧动画基础设施（pet-10）

> 基础设施由 pet-10 实现，pet-12 已完成 UI 接入；基础设施文件本窗口未修改。

目录：`src/renderer/pet/animation/`

| 文件 | 职责 |
|------|------|
| `skin-manifest.mjs` | 版本 1 皮肤清单校验、安全相对路径、等级形态选择、动作回退 |
| `frame-timing.mjs` | 时间驱动帧索引、高 DPI backing size、锚点绘制矩形 |
| `frame-renderer.mjs` | 帧预加载、Canvas 绘制、水平翻转、播放生命周期 |
| `animation-controller.mjs` | 基础动作、一次性动作优先级、打断与恢复 |

接口边界：

- `pet.js` 后续只调用语义动作，不直接计算帧序号；
- `AnimationController` 只依赖 renderer 的 `hasAnimation/play/setFacing/stop`；
- `FrameRenderer` 通过构造参数注入图片加载、RAF 和时钟，Node 测试不依赖 DOM；
- 本阶段不含皮肤素材、PetState 字段、面板立绘或 UI 接入。

## 奶油星团正式素材包（pet-11）

> 2026-07-24：已产出角色视觉基准、七类动作关键姿态、portrait 和 52 张动画帧；
> schema v1 清单校验及 ARCH-08 多背景肉眼验收通过，尚未接入 UI。

素材位于 `src/renderer/assets/pet/cream-star/`：

- `reference/character-anchor.webp`：正面、侧面、三分之四视角基准；
- `reference/action-key-poses.webp`：七类动作关键姿态；
- `portrait.webp`：正式立绘；
- `forms/base/`：512×512 无损透明 WebP 动画帧；
- `pet.json`：schema v1 清单，包含七类标准动作、帧率、循环方式、锚点和回退。

`review/` 保留完整 alpha 审计和黑/白/棋盘格联系表作为验收记录。素材制作窗口
pet-11 未修改 `pet.html` / `pet.js`；正式素材现已由 pet-12 接入桌宠态。
