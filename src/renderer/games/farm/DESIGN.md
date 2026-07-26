# 农场模块技术设计

> farm-02 提供领域层；farm-03 增加农田与建筑页面；farm-04 增加加工、订单与跨页摘要。桌宠提醒和旧库存消费者迁移仍由 farm-05～06 负责。

## 分层

- `farm-config.mjs`：首发数值、解锁表、地图、配方、建筑、订单和奖励配置及启动校验。
- `farm-state.mjs`：schema v1 默认状态、局部修复、幂等迁移和持久化递增 ID 修复。
- `farm-rules.mjs`：网格邻接、生长/产量快照、成熟判断、建筑覆盖和收获奖励纯规则。
- `farm-processing.mjs`：三批串行加工、即时扣料、排队取消与跨多任务离线结算。
- `farm-orders.mjs`：稳定候选池、70/30 单/双项、去重、奖励快照、整单交付和冷却再生。
- `farm-service.js`：唯一读取 PetState 并调用 `setMany()` 的农场协调器。
- `farm-ui.js`：农田 view model、HTML 渲染、事件委托、确认流程与页面生命周期。
- `farm-processing-ui.js`：配方/材料 view model、三槽队列、运行倒计时与排队取消交互。
- `farm-orders-ui.js`：三槽订单、持有/需求、奖励快照、交付与冷却倒计时交互。
- `farm-module.js`：唯一公开 Dashboard 挂载入口，负责初始化 PetState、创建 service 和注入样式。
- `farm.css`：响应式 `4×4` 网格、农田/建筑状态、低频动画和减少动态效果适配。

纯模块不得访问 DOM、Electron、timer、localStorage 或文件系统。当前时间和随机源由调用方注入；实例 ID 使用持久化 `nextIds`，不使用随机数。

## 持久化状态

`store.js` 只提供 `farm: null`。首次 `initialize()` 在渲染端创建 schema v1：

```js
{
  schemaVersion: 1,
  level: 1,
  exp: 0,
  activeFarmId: 'basic-farm',
  farms: { 'basic-farm': { tiles: [] } },
  processor: { level: 1, queue: [] },
  orders: { slots: [] },
  daily: {
    birdRewardDate: null,
    birdRewardCount: 0,
    claimedBirdIds: []
  },
  notificationState: {
    notifiedReadyOrderIds: [],
    lastCompletedProcessingTaskId: null
  },
  nextIds: { order: 1, processingTask: 1, building: 1 },
  starterGranted: false
}
```

地图固定 16 个稳定格 ID，中央四格初始开放。种植、加工和订单记录创建时快照；只持久化稳定 ID、时间戳和数值快照，不持久化配置对象。

迁移逐记录修复：已开放格的非法占用恢复为空田并保留合法土地等级；作物会校验稳定 crop/seed ID、时间顺序、产量/经验及完整计算快照，任一非法只清该作物；建筑、加工任务和订单 ID 每类只保留首条合法记录；非法或重复建筑恢复为空田，非法或重复任务删除，非法或重复订单槽改为到期空槽。加工输入/输出和订单需求只接受统一 `ITEMS` 中的稳定 ID；队列仅首项可为 running，后续记录统一规范为 queued 且运行时间为 null。运行任务时间必须满足 `completesAt = startedAt + durationMs`，首项不是有效 running 时从迁移时刻重排剩余队列；`nextIds` 只按保留记录修复且永不低于最大序号加一。订单 `materialValue` 是创建时快照，迁移只验证为正安全整数，不按当前售价重算；种子奖励只接受已知种子 ID 的 `{ itemId, count: 1 }`；每日小鸟 ID 会清理非法值、去重并裁剪到每日上限。迁移第二次运行不继续改变状态。

## 事务协调器

```js
createFarmService({ petState, eventBus, now, random })
```

命令：

- 初始化与结算：`initialize`、`settle`
- 农田：`plant`、`harvest`、`harvestAll`、`removeCrop`、`unlockTile`、`upgradeLand`
- 建筑：`build`、`moveBuilding`、`upgradeBuilding`、`demolishBuilding`
- 加工：`enqueue`、`cancelQueued`
- 订单与彩蛋：`completeOrder`、`abandonOrder`、`claimBird({ birdId })`

所有命令通过内部 Promise 队列串行化。时间结算与用户命令先在内存合并，最后最多一次 `PetState.setMany()`；失败命令若已有结算变化，只提交结算。完全无变化不提交。

提交成功后的事件顺序固定为：

```text
结算语义事件
→ 用户命令语义事件
→ 用户命令结果产生的订单 ready 事件
→ farm:state:changed（一次）
```

`farm:state:changed` 摘要即时推导，不持久化。提交前不发送任何语义事件。

## 防重

首发不保存 transaction ledger，使用持久状态变化作为等价防重条件：

- 收获后格子作物清空。
- 完成订单后旧订单被替换。
- 完成加工任务移出队列。
- 小鸟奖励在同一事务增加本地自然日计数并记录 `birdId`；同一 ID 当日只能领取一次，跨日同时重置计数和 ID。
- `notifiedReadyOrderIds` 与 `lastCompletedProcessingTaskId` 提供跨重启弱提醒去重键。

库存增减复用 farm-01 的不可变门面及安全整数 `RangeError` 契约。

## farm-03 页面层

公开合约：

```js
mount(container, { onNavigateWarehouse }) -> Promise<cleanup>
```

Dashboard 只从共享模块注册表动态加载该合约，不直接 import 农场内部文件。
页面内部通过 `createFarmService()` 执行播种、收获、扩地、土地升级和建筑命令；
UI 不调用 `PetState.set/setMany()`，也不重写生长、产量、邻接或奖励公式。

页面由顶部摘要、三个内部页签、响应式 `4×4` 按钮网格和操作区组成。
“加工 / 订单”在 farm-03 保持可见但为可访问的禁用按钮。建筑移动使用显式
`{ type: 'move-building', buildingId }` 模式，只接受空的开放田地。

移除生长作物和拆除建筑通过现有 overlay 双按钮确认；只有结果精确为
`confirm` 且页面仍存活时才执行 service 命令。拆除预览由
`investedCoins × buildingRefundRate` 向下取整派生，实际到账以
`demolishBuilding()` 返回的 `refund` 为准。

`cleanup` 清除事件订阅、DOM 监听、低频时间刷新、移动模式和迟到确认，并关闭残留
overlay。洒水器、堆肥箱、成熟作物和移动目标仅使用克制的低频动画；
`prefers-reduced-motion: reduce` 下全部禁用。

## farm-04 加工与订单页面

三个页签全部可用，顶部摘要不随页签切换销毁。加工页按配置展示配方解锁、
输入材料 `owned/required`、输出、耗时和三任务串行队列；只有 queued 任务提供取消，
确认框从任务 `inputs` 快照逐项展示全额退款。订单页固定展示三个持久槽，
逐项展示 `owned/required` 和创建时奖励快照；完整交付无需确认，放弃确认展示需求并
明确该槽进入 30 分钟无订单冷却。

`mountFarm` 是结算入口和全局 mutation busy lock 的唯一所有者：

- 30 秒低频 interval 调用同一个 single-flight `requestSettlement()`。
- child tab 只有 1 秒显示 timer；加工完成或冷却边界首次到零时请求同一个 gate，
  不创建周期性结算 loop。
- settlement 与 mutation 共用串行门控：settlement/mutation 在途期间收到的 settlement
  请求只合并为一个 pending 标记；当前操作结束时先消费并清除该标记，再恰好补跑一次。
  补跑期间到达的新请求可以重新登记下一次 pending。
- settlement 在途时首次 mutation 点击立即占用全局 busy lock，等待该 settlement 完成后
  才调用业务 command；重复点击不会排入第二个 mutation。mutation 在途时的 settlement
  请求则统一留到 command 完成后补跑。
- service 业务命令内部已在同一事务中先结算，UI 不额外调用 `settle()`。
- mutation 期间所有农场业务操作由全局 busy lock 防重；页签仍可切换。
- child cleanup 清除自己的 DOM listener 和 1 秒 timer；mount cleanup 再清除当前
  child、30 秒 interval、订阅、overlay 和迟到异步回调。
- 页签 generation 使切页后的迟到确认失效；mount generation 使卸载后的 settlement、
  mutation 和确认 Promise 不得重绘或恢复旧 busy 状态。
