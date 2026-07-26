# 农场模块技术设计

> farm-02：无 UI 领域层。页面接入、dashboard 导航、桌宠提醒和旧库存消费者迁移由 farm-03～06 负责。

## 分层

- `farm-config.mjs`：首发数值、解锁表、地图、配方、建筑、订单和奖励配置及启动校验。
- `farm-state.mjs`：schema v1 默认状态、局部修复、幂等迁移和持久化递增 ID 修复。
- `farm-rules.mjs`：网格邻接、生长/产量快照、成熟判断、建筑覆盖和收获奖励纯规则。
- `farm-processing.mjs`：三批串行加工、即时扣料、排队取消与跨多任务离线结算。
- `farm-orders.mjs`：稳定候选池、70/30 单/双项、去重、奖励快照、整单交付和冷却再生。
- `farm-service.js`：唯一读取 PetState 并调用 `setMany()` 的农场协调器。

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
