# 农场 Pixi 场景正式 UI 接入设计

日期：2026-07-30
架构窗口：ARCH-11
状态：用户已批准

## 1. 目标

把已经完成并通过真实 Electron/Pixi gate 的完整农场场景正式接入现有农场页，让用户在“农田”页看到 snapshot 驱动的高质量 2D 场景，同时保留现有 FarmService 业务权威、DOM 操作面板、加工/订单页面、键盘可访问性和三级回退。

本阶段完成后，用户可以在正式农场页看到：

- 完整 Pixi 农场场景；
- 16 格土地、六作物阶段、三类建筑、奶油星团和小鸟；
- Canvas 点击与原生 DOM 操作面板同步；
- 宽、窄窗口下按需展开的操作面板；
- 成功事务在正确场景位置播放有界反馈；
- Pixi 失败时仍可完成全部既有农场操作。

## 2. 不在本阶段实现

- 不重做加工页与订单页视觉；它们属于后续独立阶段。
- 不重做仓库、商店、桌宠提醒和跨页物品图标。
- 不修改 FarmService、PetState、农场规则、经济数值、计时、提醒、小鸟奖励或桌宠动作语义。
- 不新增事件、IPC、npm 依赖、持久化字段或业务 schema。
- 不引入 Godot、Unity、Spine、Rive 或 bundler。

## 3. 布局方案

采用用户批准的方案 C：场景优先、操作面板按需展开。

### 3.1 宽窗口

- 未选中对象时，Pixi 场景占满农田工作区。
- 选中田块或建筑后，右侧操作面板展开。
- 场景区域重新分配宽度并调用 adapter `resize()`，不得用面板直接遮挡田块。
- 关闭按钮、对象消失或切换页签会收起面板。

### 3.2 窄窗口

- 未选中对象时，场景继续占满可用宽度。
- 选中对象后，操作面板变为底部抽屉。
- 抽屉内容独立滚动，不能制造页面横向溢出。
- 抽屉不得永久占用默认场景空间。

### 3.3 加工与订单

- 顶部“加工”和“订单”页签始终可用。
- 场景中的加工台和订单板分别进入现有加工、订单页。
- 离开农田页时收起操作面板并暂停场景动画；返回农田页时恢复并按容器重新 resize。

## 4. 组件边界

### 4.1 `farm-module.js`

保持公开 `mount(container, options) -> cleanup` 合同不变，仅负责组装生产依赖：

- manifest URL；
- 可信静态背景 URL；
- `loadFarmScene()`；
- Pixi adapter 工厂；
- 静态场景工厂；
- JSON 加载函数。

它不处理田块选择、业务命令或页面状态。

### 4.2 `farm-ui.js`

继续作为唯一页面控制器，持有：

- `activeTab`；
- `selectedTileId`；
- 建筑移动模式；
- mutation/settlement busy；
- 小鸟与反馈状态；
- 场景加载模式和生命周期 generation。

现有 service 命令和确认流程保持不变。新增场景意图必须转发到与 DOM 点击相同的内部处理函数，禁止复制业务分支。

### 4.3 持久场景 Host

页面创建唯一 `.farm-scene-host`。

现有 `render()` 可以继续更新 DOM，但必须在重建前安全保留 host，并在新的场景 slot 中重新插入同一个节点。状态更新不得重复创建 Application、Canvas 或纹理缓存。

切换加工/订单时允许 host 暂时脱离可见布局，但 adapter 保持挂载并暂停；页面 cleanup 才真正 destroy。

### 4.4 Adapter 最小扩展

保持 `mount/update/resize/setPaused/setReducedMotion/playEffect/destroy` 公共接口不变，只补两项接入所需表现：

1. 根据 snapshot 的 `selectedObject` 绘制非纯颜色的田块选中轮廓；
2. `playEffect({ type, tileId })` 能根据当前布局把效果定位到对应田块。

选中轮廓和效果属于 adapter 的表现职责，不进入业务 VM。

## 5. 数据流

正常更新链为：

```text
PetState / FarmService
→ buildFarmViewModel()
→ buildFarmSceneSnapshot()
→ scene.update(snapshot)
→ Pixi reconciliation
```

用户输入链为：

```text
Canvas intent 或原生 DOM click/focus
→ farm-ui 统一选择/页签/领取处理函数
→ 现有 FarmService 命令
→ PetState 原子提交
→ 重新构建 VM 与视觉 snapshot
→ 场景更新
```

Canvas 不读取 FarmService，不修改 snapshot，也不直接写 PetState。

`selectedObject` 由当前 `selectedTileId` 投影；键盘 focus 和 Canvas 点击必须得到相同选中结果。

## 6. 场景加载与三级回退

### 6.1 Loading

- 农田页先显示可信的无田静态背景，避免空白或 Emoji 闪变。
- 异步加载 manifest、Pixi runtime 和关键纹理。
- 迟到结果必须检查页面 generation。

### 6.2 Pixi 模式

- 显示完整 Canvas 场景。
- 16 个原生田块按钮保留为屏幕外可访问镜像，不使用 `display:none`。
- DOM 操作面板继续可见并响应相同选中状态。

### 6.3 Static 模式

- 显示可信静态背景。
- 原生 `4×4` 网格恢复为可见交互层，确保田块状态和操作可辨。
- 加工、订单继续通过顶部原生页签进入。

### 6.4 DOM 模式

- 不依赖静态场景资源，恢复当前完整可操作 DOM 农场。
- 农田、加工、订单、确认、倒计时和小鸟领取全部保留。

降级不得改变业务状态。同页重新进入和页面往返都必须能重新初始化。

## 7. 场景意图

允许的意图保持：

- `select-tile`
- `open-processing`
- `open-orders`
- `claim-bird`
- `click-pet`

映射规则：

- `select-tile` 进入与 DOM 田块按钮相同的选择或移动建筑流程；
- `open-processing` / `open-orders` 进入与顶部页签相同的切页流程；
- `claim-bird` 进入现有 `claimCurrentBird()`；
- `click-pet` 仅产生本地陪伴反馈，不调用 FarmService、不修改 PetState、不重置桌宠闲置计时。

## 8. 事务反馈

成功效果必须在 service Promise 完成、`result.ok === true` 且页面 generation 仍有效后播放。

| 操作 | 效果 | 位置 |
|------|------|------|
| 播种 | `plant` | 目标田块 |
| 单格收获 | `harvest` | 目标田块 |
| 一键收获 | `harvest` | 场景中心，仅一次 |
| 解锁土地 | `unlock-land` | 目标田块 |
| 土地升级 | `upgrade-land` | 目标田块 |
| 建造/移动/升级/拆除建筑 | `building-change` | 最终目标田块 |
| 小鸟领取 | `coins` | 小鸟区域 |

失败、异常、页面切换、对象消失或过期 generation 不得播放成功效果。adapter 继续使用单槽有界效果，替换时清理上一效果。

加工完成和订单完成效果留给后续加工/订单视觉阶段。

## 9. 可访问性与响应式

- 原生田块镜像保持完整 aria label、`aria-pressed` 和键盘可达性。
- focus 田块会更新 `selectedTileId` 并同步 Canvas 高亮。
- Canvas 选中会更新原生镜像和 DOM 操作面板。
- 选中态使用轮廓/形状，不只依赖颜色。
- `prefers-reduced-motion`、页面可见性、活动页签和 cleanup 共同控制 ticker。
- 800×600 使用按需右侧面板；600×400 使用底部抽屉。
- 两档尺寸都不得横向溢出，主要田块命中区必须可用。

## 10. 生命周期

- 页面只有一个场景加载 generation。
- cleanup 幂等，销毁 scene/static renderer、ResizeObserver、媒体查询监听、DOM 监听和迟到 Promise。
- `render()` 不得造成 Canvas 重建。
- 20 次农田/加工/订单快速切换不得累积 Canvas、ticker 或监听。
- 页面隐藏时暂停；恢复可见且仍在农田页时恢复。
- cleanup 后的 manifest、runtime、纹理、service 或 overlay 回调都不能修改旧页面。

## 11. 文件范围

实现窗口允许修改：

- `src/renderer/games/farm/farm-ui.js`
- `src/renderer/games/farm/farm-ui.test.mjs`
- `src/renderer/games/farm/farm-module.js`
- `src/renderer/games/farm/farm.css`
- `src/renderer/games/farm/farm-scene-adapter.js`
- `src/renderer/games/farm/farm-scene-adapter.test.mjs`
- 新建 `src/renderer/games/farm/farm-scene-integration.test.mjs`

不得修改 loader、manifest/model、FarmService、PetState、shared、main、Dashboard、资产、package、加工/订单 UI 或 tracker。

## 12. 验收

自动与真实运行必须覆盖：

1. 初始 loading 不出现可见 Emoji 网格闪变；
2. Pixi、static、DOM 三模式；
3. 五类 scene intent 与 DOM 共用处理路径；
4. 键盘 focus 与 Canvas 高亮同步；
5. 成功事务播放正确效果，失败与迟到事务不播放；
6. host 在 render 和页签切换间保持同一实例；
7. cleanup 恰好一次且阻止迟到复活；
8. 800×600、600×400 四种方案 C 状态；
9. 20 次快速页签切换和页面往返；
10. 全仓测试、语法、`git diff --check`、Electron Forge package；
11. 同 app.asar 真实 Pixi、三模式回退、五类输入、resize、visibility、reduced-motion 和残留 Canvas 检查。

## 13. 完成定义

只有正式农场页在 Pixi 成功时显示完整场景，且 static/DOM 回退仍能完成全部既有操作，才可宣称“农场完整场景已接入 UI”。

本阶段完成不代表加工/订单、仓库/商店和跨页图标已经完成统一视觉升级。
