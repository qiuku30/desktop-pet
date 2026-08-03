# 农场跨页面物品图标设计

**日期：** 2026-08-03

**状态：** 设计已批准

**架构窗口：** ARCH-11

## 1. 目标

把已经批准的「明亮家园」视觉语言从农场场景和工坊延伸到用户最常看到的物品界面。仓库、商店、Dashboard 首页食物库存和桌宠成熟作物指示器应使用项目自有的圆润、明亮、带体积感的高质量 2D 卡通图标，不再以 Emoji 作为成功路径，同时完整保留当前物品数值、交易、喂食、提醒、无障碍和生命周期合同。

本阶段补齐苹果、蛋糕和小鱼干三种内置物品图标，使现有物品目录形成完整美术家族。本阶段不做全应用范围的 Emoji 清理。

## 2. 已批准路线与备选方案

针对尚无「明亮家园」美术的三种旧食物，讨论过三条路线：

1. **补齐三张新图标——已批准。** 为苹果、蛋糕和小鱼干制作原创项目图标，再统一接入跨页面物品展示。这样现有 21 个物品都有一致的成功路径。
2. 只升级已有 18 张农场图标，旧食物继续使用 Emoji。成本较低，但主要库存界面仍会明显割裂。
3. 旧食物统一显示中性 fallback。可以移除 Emoji，但三种常用食物脱离文字后无法互相区分。

最终选择方案 1。它只增加少量美术成本，同时避免产生二等旧物品视觉路径。

## 3. 固定范围

本阶段包含：

- 苹果、蛋糕、小鱼干三张旧食物图标；
- 现有 21 个物品的不可变 `iconSrc` 元数据；
- 由物品目录统一导出的项目自有中性 fallback URL；
- 仓库、商店和 Dashboard 首页食物库存共用的图标渲染能力；
- 桌宠成熟作物指示器使用项目小麦图标；
- 两级图片回退、无障碍、响应式、生命周期、打包和回归验证。

本阶段不包含：

- 修改物品 ID、名称、类别、买价、卖价、喂食数值、解锁等级、tooltip 字段、库存结构或交易行为；
- 修改农场成熟判定、提醒优先级、提醒时机、去重、睡眠、闲置重置、气泡文案或宠物动作；
- 改造 `pet.js` 中的桌宠右键喂食浮层；该浮层本阶段继续使用现有 Emoji；
- 替换金币、背包、心情、空状态等无关装饰符号，或提醒气泡里的 `🌾`、`⚙️`、`📋` 语义符号；
- 修改 `farm.json`、Pixi 场景代码、FarmService、PetState、EventBus 事件、IPC、持久化、依赖或业务 schema；
- 引入 Godot、Unity、Spine、Rive 或外部皮肤包加载能力。

桌宠喂食浮层和其他 Dashboard Emoji 可在以后作为独立的全局图标系统阶段讨论，不能在本阶段暗中扩围。

## 4. 视觉合同

三张新图标遵循现有「明亮家园」物品家族规范：

- 原创、圆润、明亮、带体积感的高质量 2D 卡通；
- 左上暖中性主光，右下柔和阴影；
- 使用暖深棕描边，不用纯黑描边；
- 透明 192×192 lossless WebP，sRGB；
- 内容限制在 152×152 安全框内，并与现有图标共用光学中心；
- 缩小到 32 逻辑像素后仍能辨认；
- 不烘焙名称、数量、价格、奖励或状态文字；
- 不复制或重构任何商业游戏素材。

苹果必须明确读作新鲜红苹果，而不是泛化圆形水果；蛋糕必须明确读作小份蛋糕，而不是面包或派；小鱼干必须明确读作食物，而不是水族箱里的活鱼。三者不能只靠色相区分身份。

## 5. 美术窗口：`farm-art-04`

`farm-art-04` 是纯资产窗口，交付：

- `src/renderer/assets/farm/bright-homestead/ui/items/food-apple.webp`；
- `src/renderer/assets/farm/bright-homestead/ui/items/food-cake.webp`；
- `src/renderer/assets/farm/bright-homestead/ui/items/food-fish.webp`；
- 独立的白底、黑底和棋盘底审查图；
- 32 像素联系表和确定性审计记录。

它只允许修改：

- `src/renderer/assets/farm/bright-homestead/ui/items/**`；
- `src/renderer/assets/farm/bright-homestead/review/**`；
- `src/renderer/assets/farm/bright-homestead/README.md`；
- `src/renderer/assets/farm/bright-homestead/reference/art-bible.md`；
- `src/renderer/assets/farm/bright-homestead/reference/family-map.md`。

不得修改 `farm.json`。这三张图属于跨页面内置物品资产，不是农场场景或工坊 manifest 运行时记录。

候选母版、超大生成板、缓存和临时处理脚本不得进入最终交付。美术 gate 必须检查尺寸、alpha bounds、透明四角、ICC/sRGB、安全框、色键残留、边缘 halo、32 像素可读性和包体，并在白、黑、棋盘三种背景上逐图检查。

同一图标经过两轮聚焦生成后，如果身份、光影、家族一致性或透明边缘仍不合格，窗口必须停手并上报需要外部 2D 美术支持，不得自行切换生成模型或替换成第三方素材。

## 6. 物品目录合同

`src/renderer/shared/item-config.js` 继续作为物品表现元数据的唯一事实来源。现有 21 条物品记录全部新增不可变的 `iconSrc` 字符串；URL 根据 `import.meta.url` 指向仓库内已提交的「明亮家园」资产。

该模块同时统一导出项目 fallback URL，名称锁定为 `ITEM_ICON_FALLBACK_SRC`。消费方不得各自重新拼接 fallback 路径。

精确映射范围为：

- 六种种子：小麦、胡萝卜、玉米、草莓、南瓜、星露果；
- 六种作物：小麦、胡萝卜、玉米、草莓、南瓜、星露果；
- 九种食物：苹果、蛋糕、小鱼干、牛奶、饼干、爆米花、胡萝卜汁、草莓奶昔、南瓜派。

旧有 `emoji` 字段继续保留，用于兼容桌宠喂食浮层等本阶段未迁移的消费方，不能隐式强迫所有旧界面同时迁移。所有物品对象、嵌套 feed 对象和 tooltip 数组继续保持冻结。

测试必须用锁定基线比对全部既有业务字段，确保增加图标时不会误改交易、喂食、解锁或 tooltip 语义。

## 7. Dashboard 图标模块

新增 Dashboard 内部纯模块 `dashboard-item-icons.mjs`，统一负责物品图片 markup 与失败处理。DOM 表现逻辑不放入共享业务目录；共享物品目录只提供元数据。

模块提供边界清晰的小接口，用于：

- 根据 `item.iconSrc` 和目录 fallback URL 生成物品图标；
- 转义属性内容；
- 在需要时为外层物品节点提供无障碍标签；
- 每个阶段只处理一次图片加载失败。

失败状态记录在图片节点上：

1. 初始图片使用 `item.iconSrc`；
2. 首次错误切换到 `ITEM_ICON_FALLBACK_SRC`，并标记已经尝试 fallback；
3. fallback 再次错误时只隐藏装饰图片，使其退出交互和无障碍树；
4. 任何错误路径都不得插入旧 Emoji，也不得无限重试。

当界面已有可见物品名称时，图片属于装饰，使用空 `alt`，避免读屏重复。Dashboard 首页食物库存单元格没有逐项可见名称，因此外层节点必须通过 `aria-label` 提供稳定的“物品名称 + 数量”。数量、焦点、tooltip、点击、右键菜单、购买、批量操作和喂食行为仍由原 Dashboard 代码负责。

## 8. Dashboard 接入与生命周期

仓库、商店和 Dashboard 首页食物库存共用同一个 Dashboard 图标模块。现有名称、数量、价格、锁定提示、按钮、data 属性和排序全部保持。

Dashboard 在持久 document 边界上安装一个捕获阶段的图片错误监听器。安装必须幂等，页面切换或重复渲染不得按卡片、按页面重复注册。监听器与 Dashboard renderer document 同寿命，document 销毁时自然释放；单个页面 cleanup 不负责移除或替换它。处理器只响应带指定标记的物品图片，不影响其他图片和模块。

CSS 用有界图片框替换旧成功路径的 Emoji 尺寸规则，使用 `object-fit: contain`，保持宽高比，并禁止图片截获指针输入。空库存和锁定状态可以降低整张卡片的视觉强调，但不能损失文字对比度和无障碍名称。

在 800×600 和 600×400 下必须满足：

- 仓库和商店网格不产生新的横向溢出；
- 图标不拉伸、不裁切，也不把原生按钮挤出卡片；
- Dashboard 首页库存保持当前点击和 tooltip 目标尺寸；
- fallback 或图片完全隐藏时，名称、数量和操作仍然可用。

## 9. 桌宠成熟作物指示器

成熟作物指示器继续使用现有 `#farm-indicator` DOM 节点。`formatFarmIndicator()` 只返回实时成熟数量文本，CSS 通过 `#farm-indicator::before` 提供小麦图标。

伪元素只使用仓库内的小麦作物图标。如果图片无法解码，伪元素不显示图片，但数字数量仍然可读。不得把中性 fallback 叠在透明小麦图标下方，因为 fallback 会从小麦的透明像素中同时透出。真正的两级图片回退需要修改宠物 DOM 和运行时 JavaScript，明确不属于本阶段。

不得修改 `pet.js` 或 `pet.html`。现有订阅、summary 计算、显示切换、timer、cleanup、气泡回调、闲置行为和睡眠行为全部保持。提醒气泡文案精确保持为：

- `农场有作物成熟啦～ 🌾`；
- `加工台忙完啦～ ⚙️`；
- `有订单可以交付啦～ 📋`。

这里有意区分两类内容：成熟状态的成功路径图标升级为项目资产，文字层的语义提示符号不在本阶段处理。

## 10. 错误处理与安全边界

所有生产图标 URL 都是相对模块 URL 创建的仓库内常量。运行时物品状态、持久化库存和用户内容不能提供图片 URL；不得请求外部 host，不得使用 data URL，也不得根据物品名称或 ID 动态拼接路径。

图片解码或显示失败只能影响表现。它不能让交易失败、隐藏数量、改变物品记录或触发状态写入。Dashboard fallback 处理器观察失败并在第二阶段后终止；其 document 生命周期安装必须幂等，页面重绘不能制造重复处理器。

宠物 CSS 图片同样只影响表现。图片缺失时保留数字，不能改变提醒可见性或 summary 状态。

## 11. 无障碍合同

- 当可见名称已经提供等价信息时，装饰物品图片使用空 `alt`。
- Dashboard 首页库存单元格通过 `aria-label` 提供物品名称和数量。
- 现有原生按钮、disabled 状态、键盘顺序、tooltip、右键菜单和焦点轮廓全部保留。
- 图片隐藏的最终 fallback 状态仍保留同一套可读文字和操作目标。
- 状态不能只靠图片或颜色表达。
- 装饰性小麦图标失败时，桌宠成熟数量仍是实时文本。

## 12. 实现窗口：`farm-visual-07`

只有在 `farm-art-04` 通过 ARCH-11 独立美术 gate 并集成到 `main` 后，才能启动 `farm-visual-07`。

它只允许修改以下 10 个文件：

- `src/renderer/shared/item-config.js`；
- `src/renderer/shared/item-config.test.mjs`；
- `src/renderer/dashboard/dashboard-item-icons.mjs`；
- `src/renderer/dashboard/dashboard-item-icons.test.mjs`；
- `src/renderer/dashboard/dashboard.js`；
- `src/renderer/dashboard/dashboard-inventory.test.mjs`；
- `src/renderer/dashboard/dashboard.css`；
- `src/renderer/pet/pet.css`；
- `src/renderer/pet/pet-farm-reminder.mjs`；
- `src/renderer/pet/pet-farm-reminder.test.mjs`。

不得修改 `pet.js`、`pet.html`、农场资产、farm manifest、业务服务、共享状态、事件、IPC、依赖、持久化、tracker 或架构文档。

不同窗口不得同时修改上述文件。

## 13. 验收与验证

### 13.1 美术 gate

- 三张图标均为 192×192、透明、lossless WebP，并带 sRGB/ICC；
- alpha 内容位于 152×152 安全框内，并与家族共用光学中心；
- 白底、黑底、棋盘底和 32 像素审查中没有 halo、色键残留、破损轮廓或意外组件；
- 苹果、蛋糕和小鱼干脱离标签后仍可辨认；
- 最终交付中不存在候选母版、临时脚本或无用运行时资产。

### 13.2 目录兼容 gate

- 现有 21 个物品全部具有精确的仓库内 `iconSrc`；
- fallback URL 指向已提交的中性物品 fallback；
- 物品对象、feed 对象和 tooltip 数组继续冻结；
- 全部既有 ID、名称、Emoji、类别、价格、喂食值、解锁等级和 tooltip 字段保持不变；
- 不改变库存或交易 schema。

### 13.3 Dashboard 行为 gate

- 仓库、商店和首页库存的成功路径使用项目图片；
- 首次失败只切换一次 fallback，第二次失败只隐藏图片；
- 成功路径和 fallback 路径均不得注入物品 Emoji；
- 重复页面渲染时监听器仍只安装一次；
- 已脱离 DOM 或无关图片的错误不能修改当前物品界面；
- 名称、数量、价格、锁定、按钮、批量操作、tooltip、右键菜单、购买和喂食入口行为全部保持；
- 有效图片、fallback 图片和图片隐藏三种状态都通过键盘与无障碍树检查。

### 13.4 桌宠提醒 gate

- 无效、零或负数成熟数量继续隐藏；
- 正数只返回并显示数量文本，不带前导 Emoji；
- CSS 引用小麦图标，图片失败时数量仍可读；
- 提醒气泡文案、时机、优先级、去重、订阅和 cleanup 测试全部保持；
- `pet.js` 和 `pet.html` 必须没有 diff。

### 13.5 响应式、打包与回归 gate

- 真实 Chromium 在 800×600 和 600×400 下验证图标比例、无横向溢出、数量可读和焦点不裁切；
- shared、Dashboard、pet、farm 和跨模块定向测试全部通过；
- GUI 全仓测试全部通过；
- 生产 JavaScript 语法检查和 `git diff --check` 通过；
- 范围、禁用 import 和状态写入扫描通过；
- Electron Forge 打包成功；
- 同一 `app.asar` 验证 21 张图标和 fallback 均已入包，并验证仓库、商店、首页库存、桌宠指示器、Dashboard 两级回退、页面切换与生命周期行为。

## 14. 执行顺序与停手条件

执行顺序锁定为：

1. 创建并独立验收 `farm-art-04`；
2. 把批准的资产集成到 `main`；
3. 创建并独立验收 `farm-visual-07`；
4. 把批准的代码集成到 `main`；
5. 创建 `farm-visual-08`，完成农场整体视觉、交互、打包和文档终验。

实现窗口遇到以下情况必须停手上报：

- 两轮美术尝试后仍不符合锁定的家族合同；
- 完成任务必须改变物品 ID、业务数值、库存结构、交易或提醒语义；
- 必须修改未授权文件；
- 开发态与打包态资源解析结果不同；
- 图片失败导致操作、焦点、名称、数量或无障碍等价信息丢失；
- 生命周期竞态造成重复监听、迟到回调、未处理 rejection 或 cleanup 后状态变化。

## 15. 长期兼容性

与引擎无关的目录 URL 和独立栅格图标可兼容未来外部皮肤包，也能被可能采用的 Godot 农场 renderer 使用。本阶段不设计皮肤选择，不把业务逻辑迁入引擎，也不承诺采用 Godot。保留旧 `emoji` 字段，是为了在剩余消费方获得单独批准迁移前维持向后兼容。
