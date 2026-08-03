# 农场工坊与订单板视觉重设计

**日期：** 2026-08-02

**状态：** 设计已批准

**架构窗口：** ARCH-11

## 1. 目标

把现有加工页和订单页提升到已经完成的「明亮家园」Pixi 农场场景的视觉品质。最终效果应像圆润、明亮、带体积感的高质量 2D 经营游戏，而不是 Emoji 与文字卡片的组合；同时完整保留当前加工、订单、事务、计时、无障碍、回退和清理合同。

已批准方向为 **A：场景英雄区**。工坊以大型加工机器为中心，配方和三槽生产轨道围绕机器组织；订单页使用一块连续木质订单板承载三张实体感订单纸。

## 2. 固定范围

本阶段包含：

- 一套完整的内置工坊与订单板美术资产；
- 首发农场加工和订单使用的 18 种物品图标；
- 工坊模块化 2D spritesheet 动画和一次性反馈；
- 从农场皮肤 manifest 派生的不可变 UI 视觉目录；
- 加工页和订单页的语义化 DOM 重设计；
- Dashboard 内容区域 800×600 和 600×400 两档响应式布局；
- 入队、加工完成、订单完成和放弃订单的局部视觉反馈；
- 视觉、生命周期、无障碍、打包和回归验证。

本阶段不包含：

- 修改加工、订单、库存、奖励、解锁、事务、提醒或持久化规则；
- 新增 EventBus 事件、IPC 通道、运行时依赖或业务 schema 字段；
- 接入仓库、商店、喂食菜单、Dashboard 库存或桌宠提醒图标；
- 把加工页或订单页转换为 Pixi；
- 引入 Godot、Unity、Spine 或 Rive；
- 在现有五种配方、三个加工队列槽和三个订单槽之外扩展加工或订单内容。

新物品资产会为后续跨页面复用做好准备，但本阶段不授权修改其他模块的消费方。

## 3. 视觉方向

全部资产遵循已经批准的「明亮家园」美术规范：

- 圆润、明亮、带体积感的高质量 2D 卡通；
- 左上暖中性主光，右下柔和阴影；
- 使用暖深棕描边，不使用纯黑描边；
- 与农场场景保持一致的比例、透视、材质语言和色温；
- 在 600×400 下仍能辨认轮廓与状态差异；
- 不复制或重构 QQ 农场、Hay Day 或其他商业游戏素材。

名称、数量、倒计时、奖励和按钮标签必须始终由实时 DOM 提供，不能烘焙到栅格资产中。

## 4. 工坊构图

加工页变为纵向可滚动的工坊界面。

1. 上方英雄区放置加工机器，约占首屏可见区域的三分之一。
2. 机器需要表达 `idle`、`working` 和短暂 `completed` 状态。
3. 机器下方紧接固定三槽生产轨道，分别展示 running、queued 和 empty 位置。
4. 配方架位于生产轨道之后，承载现有五种配方。
5. 每张配方继续展示产物、材料、持有/需求数量、耗时或锁定原因，以及现有入队操作。
6. 现有农场等级、金币、库存和跨页 summary 继续作为权威信息；工坊不复制第二套 HUD。

在 800×600 下，英雄区、生产轨道和配方架首段应在不拥挤的情况下可见。在 600×400 下，内容改为纵向滚动，机器和当前任务优先显示，不能为了把全部配方塞进一个视口而缩小关键文字和控件。

## 5. 订单板构图

订单页变为一块连续木质订单板。

- 800×600 下，三张订单纸按三列排列。
- 600×400 下，同一订单板变为单列并允许纵向滚动。
- 每张有效订单纸继续展示需求、持有/需求数量、奖励、放弃和完成操作。
- 可交付订单除按钮状态外，还显示明确的 ready 印章。
- incomplete、cooldown 和 waiting 槽使用克制但可区分的纸张状态。
- cooldown 继续使用实时原生倒计时元素。
- 按钮继续使用原生 button，并保留现有 disabled 行为和 data 属性。

订单板和纸张只是装饰表面。DOM 继续作为无障碍名称、状态、焦点和操作的事实来源。

## 6. 资产包

美术窗口只在 `src/renderer/assets/farm/bright-homestead/**` 下交付文件。

### 6.1 工坊资产

- 机器主体；
- 四帧齿轮循环；
- 四帧蒸汽循环；
- 工作灯光 overlay；
- 完成闪光；
- 配方架；
- running、queued 和 empty 三种生产槽表面；
- 锁定配方 mask。

### 6.2 订单资产

- 连续木质订单板；
- 基础订单纸；
- ready 印章；
- cooldown 纸张处理；
- 图钉装饰；
- 已批准一次性反馈需要的完成和放弃 overlay 元素。

### 6.3 物品图标

首发精确集合为：

- 六种种子：小麦、胡萝卜、玉米、草莓、南瓜、星露果；
- 六种作物：小麦、胡萝卜、玉米、草莓、南瓜、星露果；
- 五种加工食物：饼干、爆米花、胡萝卜汁、草莓奶昔、南瓜派；
- 牛奶，因为它是现有配方材料；
- 一个项目自有的中性 UI 物品 fallback，与 Emoji 分离。

所有图标使用统一透明画布尺寸、统一光学中心规则、sRGB、lossless WebP 和共同安全最小尺寸。相近物品不能只依赖文字标签才能区分。

### 6.4 动画导出

运行时循环采用具有明确帧宽、帧高、帧数和时长元数据的确定性 spritesheet。审查期间可以使用单独源帧，但交付前必须删除候选母版和超大生成板。相同 spritesheet 后续应能被 Godot 直接切分，无需重新制作。

美术 gate 包含白底、黑底、棋盘底透明边缘检查，以及覆盖全部必要状态的真实 800×600 和 600×400 合成图。

## 7. Manifest 合同

`farm.json` 保持 schema version 1，只在 `ui` 下增加纯表现记录：

- `ui.itemIcons[itemId]` 和 `ui.itemFallback`；
- `ui.workshop.machine.base`、`gearSheet`、`steamSheet`、`workGlow` 和 `completionFlash`；
- `ui.workshop.recipeShelf`、`slots.running`、`slots.queued`、`slots.empty` 和 `lockedMask`；
- `ui.orders.board`、`paper`、`readyStamp`、`cooldownPaper`、`pin` 和已批准反馈 overlay。

普通图片记录包含安全相对 `src`。Spritesheet 记录额外包含正有限的 `frameWidth`、`frameHeight`、`frameCount` 和 `durationMs`。任何记录都不得包含价格、产出、材料、奖励、解锁资格、队列、订单、库存、持久化或其他业务数值。

全部路径相对 manifest 所在目录解析，并且必须留在皮肤根目录内。缺失或非法的可选 UI 记录只触发局部视觉回退，不能让农场业务页面失效。

## 8. 运行时架构

加工页和订单页继续使用 DOM；Pixi 只负责农田场景。

### 8.1 UI 皮肤目录

新增纯 UI 皮肤模块，职责为：

- 校验并提取已批准的 `ui` 记录；
- 相对 `manifestUrl` 解析安全的皮肤内资源 URL；
- 返回深度冻结的目录；
- 不读取 FarmService、PetState、库存、订单或加工状态；
- 自身不执行网络或文件系统访问；
- 内容错误返回稳定校验错误，不抛异常。

### 8.2 Manifest 加载

`createFarmSceneRuntime()` 持有每次 mount 共用的 manifest Promise 缓存。场景 loader 和 UI 皮肤 loader 消费同一次 fetch 结果，避免重复请求，同时保持各自独立的校验与回退决策。

加工页或订单页先立即渲染语义文本。有效目录解析完成后，可以增强当前页。所有 continuation 都必须受当前 mount generation 和 disposed 状态保护；cleanup 后的迟到 resolve 或 reject 不能重绘、追加资产、重启动画或产生未处理 rejection。

### 8.3 UI 边界

- `renderProcessingTab(container, viewModel, actions) -> cleanup` 继续作为加工页公共合同。
- `renderOrdersTab(container, viewModel, actions) -> cleanup` 继续作为订单页公共合同。
- 可选视觉目录和 reduced-motion 状态通过现有 `actions` options 对象传递。
- HTML helper 可以接收可选表现参数，但必须保留现有语义 data 属性和原生按钮行为。
- 独立 CSS 文件只使用 `.farm-workshop-*` 或 `.farm-orders-*` 选择器，不增加通用 Dashboard、button 或 card 规则。
- 模块 loader 在现有农场 stylesheet 旁边一次性加载这两份 scoped 样式。

图片只负责表现。如果单张图片在解码或显示阶段失败，其文字等价信息和外围操作仍然可用。正常成功路径不得用 Emoji 替代图标。

## 9. 动效与反馈

已批准动画路线为模块化 2D 帧动画，不增加运行时依赖。

- 加工任务运行时，齿轮和蒸汽 spritesheet 使用低频 CSS `steps()` 循环。
- idle 和 queued 状态不运行不必要的连续动画。
- 成功入队时，新生产槽播放一次短进入反馈。
- 现有事件 `FARM_PROCESSING_COMPLETED` 在加工页当前可见时触发一次机器完成闪光。
- 现有事件 `FARM_ORDER_COMPLETED` 在事务提交后触发一次订单板印章与奖励闪光。
- 确认并成功放弃订单时播放装饰性纸张淡出；业务状态立即更新，不等待动画。
- 失败命令不得播放成功反馈。

一次性反馈使用本地单调递增的表现 token，由当前子 renderer 精确消费一次。它不持久化，也不写入 PetState 或 FarmService。每个页签最多存在一个活动 overlay；替换和 cleanup 必须安全移除上一个自有节点。

运行时循环由 CSS spritesheet 动画提供，不增加新的 JavaScript interval；现有一秒 interval 继续只负责加工和 cooldown 倒计时显示。

启用 `prefers-reduced-motion` 时，循环动画暂停，一次性移动反馈改为静态高亮或短透明度变化。离开页签时销毁其子 DOM，并停止所有局部动画。

## 10. 错误与回退行为

视觉增强使用以下局部降级链：

1. 完整「明亮家园」UI 资产；
2. 项目自有中性物品 fallback 或纯文本表面；
3. 当前语义 DOM 结构和原生控件。

该链路与农田场景的 `pixi -> static -> DOM` 回退相互独立。农田场景失败时，只要 UI 视觉目录有效，就不能移除工坊或订单视觉；UI 视觉失败也不能改变农田场景模式。

manifest fetch、解析、校验、图片、spritesheet、动画和 cleanup 错误都必须被观察并限制在局部。Cleanup 错误不能覆盖主要业务错误或加载错误。任何视觉错误都不能阻止事务反馈、倒计时结算、键盘访问或原生按钮状态。

## 11. 无障碍

- 每张图标的文字等价信息已经存在于 DOM；装饰图片从无障碍树中隐藏。
- 状态通过文字和原生 disabled/pressed 语义表达，不能只依赖颜色、动画或图片。
- 两档尺寸下，配方和订单的阅读顺序都必须与视觉顺序一致。
- 三个生产槽和三张订单纸继续使用语义 article 或等价的带标签区域。
- 现有键盘焦点、确认浮层、操作标签和倒计时归属保持不变。
- reduced-motion 行为必须独立于操作系统动画节流进行验证。

## 12. 实现窗口

两窗口必须串行，因为它们依赖同一份最终资产合同。

### `farm-art-03`

创建并验证美术资产包、manifest 增量、家族映射、alpha 审计和两档合成图。不得修改生产 JavaScript、CSS、业务代码、依赖、tracker 或架构文档。

### `farm-visual-06`

只有在 `farm-art-03` 通过 ARCH-11 独立视觉与 manifest gate 并完成集成后才能开始。负责实现 UI 皮肤目录、共用 manifest 缓存、语义 DOM 重设计、scoped CSS、反馈桥接、响应式行为和测试。不得重新生成美术或修改业务规则。

后续跨页面图标阶段如果获得批准，必须另写设计，明确 shared、Dashboard 和 pet 文件授权，并使用独立实现窗口。

## 13. 验收与验证

### 13.1 美术 gate

- 所有必要资源都存在，并使用唯一 manifest 路径；
- 透明 WebP、sRGB、统一图标画布与光学对齐；
- 没有色键边缘、意外组件、破损轮廓、烘焙文字或不一致光源；
- spritesheet 帧几何和时长元数据精确；
- running、queued、empty、locked、缺料、ready、cooldown 和 waiting 状态在 600×400 下仍可读；
- 白、黑、棋盘、800×600 和 600×400 审查输出全部通过视觉检查；
- 最终运行时包中不存在候选母版和无用构建产物。

### 13.2 合同与行为 gate

- 精确三个加工槽和三个订单槽；
- 当前 action 名称、ID、槽位索引、持有/需求文本、原生 disabled 状态和倒计时属性全部保留；
- 入队、queued 取消、整单交付、放弃确认、cooldown 再生成和 settlement 行为不变；
- 加工页和订单页 cleanup 继续幂等；
- 视觉代码不得 import 或修改 FarmService、PetState、storage、transaction 或 reminder 状态。

### 13.3 生命周期与响应式 gate

- 快速执行 20 次 field/processing/orders 循环后只保留一个农场 mount，不残留子 interval 或动画节点；
- 覆盖页面隐藏、页面恢复、reduced motion、正常 motion、目录迟到 resolve/reject、图片缺失和 cleanup 竞态；
- 800×600 使用宽版构图，无重叠和横向溢出；
- 600×400 使用纵向滚动，原生控件可读且无横向溢出；
- 完整资产与纯文本 fallback 两种模式下，键盘遍历和确认浮层都可用。

### 13.4 最终回归 gate

- 加工、订单、UI 皮肤、farm UI、scene integration 和 Dashboard 定向测试；
- GUI 全仓测试；
- 生产 JavaScript 语法检查和 `git diff --check`；
- 范围和禁止 import 扫描；
- Electron Forge 打包；
- 同一 `app.asar` 下可见验证两档尺寸、正常与 fallback 资产、实时倒计时、交互、reduced motion 和 cleanup。

## 14. 长期兼容性

DOM/Pixi 分离、manifest 驱动的 UI 目录、安全相对资源记录、固定 spritesheet 元数据和文字覆盖美术的原则，使本阶段能够兼容未来外部皮肤包。相同栅格 spritesheet 也可以导入未来可能采用的 Godot 农场实现。本阶段不承诺采用 Godot，也不增加任何引擎专属业务依赖。
