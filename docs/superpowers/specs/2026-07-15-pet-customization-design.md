# 桌宠形象化 & 切换系统设计

> 2026-07-15 ARCH-05 讨论产出
> 状态：设计确认，待 Phase 2 实现

---

## 一、概述

当前宠物是 emoji 🐱 占位。本文档定义：

1. **桌宠形象化**：从 emoji 升级为帧动画角色（方案 B）
2. **切换桌宠**：皮肤式切换，共享养成进度（方案 A）
3. **用户自定义素材**：L1 静态图 → L2 素材包，分步走
4. **账号登录同步**：Phase 3，暂不上

---

## 二、桌宠形象化（帧动画）

### 2.1 技术方案

**渲染方式**：CSS `background-image` + `background-position` 切换帧

```
精灵图 (sprites/pet-default.png)     坐标配置 (sprites/pet-default.json)
┌────────────┐                       { "idle": [{ x:0,  y:0, w:48, h:48 }],
│ 😺😸😹😻 │                         "walk": [{ x:48, y:0, w:48, h:48 }, ...],
│ 🙀😿😾🐱 │                         "eat":  [{ x:96, y:0, w:48, h:48 }, ...] }
└────────────┘
```

- 帧切换用 `requestAnimationFrame` 控制帧率（8-12 fps）
- 精灵图规格对齐窗口尺寸：基准 200px，帧格建议 96-128px（留缩放空间）
- 动画状态机对接现有心情系统：happy → 开心动画，low → 低落动画

### 2.2 动画状态机

| 状态 | 触发条件 | 对应情绪 |
|------|---------|---------|
| `idle` | 默认/静止 | 所有 |
| `walk` | 自动走动中 | — |
| `happy` | 被点击，心情 ≥ 80 | happy |
| `eat` | 喂食成功 | — |
| `sad` | 心情 ≤ 29 | low |
| `sleep` | 长时间无操作（后续） | — |

### 2.3 素材制作工具

| 用途 | 推荐工具 | 说明 |
|------|---------|------|
| 画像素角色 + 帧动画 | [Piskel](https://www.piskelapp.com/) | 免费在线，专门为精灵图设计 |
| 打包精灵图 | Free Texture Packer / CLI | 多帧合成一张大图 + JSON 坐标 |
| AI 辅助出原型 | Mixels.ai / SpriteForge | 快速生成参考素材 |

### 2.4 窗口适配

- 精灵图帧格尺寸 × 窗口缩放 = 实际渲染大小
- 走动用 `transform: scaleX(-1)` 翻转朝向（比准备两套精灵图省事）
- 现有 `zoomLevel` 机制不变

---

## 三、切换桌宠（皮肤系统）

### 3.1 设计决策

**方案 A：皮肤式切换** — 全局只有一套养成进度，切换只是换形象。

| 属性 | 切换后 |
|------|--------|
| 等级、经验 | 保留 |
| 心情、饱腹 | 保留 |
| 金币、库存 | 保留 |
| 亲密度 | 保留 |
| 外观、动画、台词 | 更换 |

### 3.2 数据结构

```js
// PetState 新增字段
activeSkinId: 'default',    // 当前皮肤 ID
skins: ['default'],          // 已拥有的皮肤列表

// 皮肤配置表（独立文件 skin-config.js，原则 5）
export const SKINS = {
  'default': {
    id: 'default',
    name: '小橘',
    emoji: '🐱',
    spriteSheet: 'sprites/pet-default.png',
    spriteData: 'sprites/pet-default.json',
    portrait: '🐱',               // 面板展示图（可替换为图片）
    unlockCondition: null,        // null = 默认拥有
  },
  'husky': {
    id: 'husky',
    name: '二哈',
    emoji: '🐕',
    spriteSheet: 'sprites/pet-husky.png',
    spriteData: 'sprites/pet-husky.json',
    portrait: '🐕',
    unlockCondition: { type: 'coins', amount: 500 },
  },
}
```

### 3.3 UI 交互

- 面板主页：形象展示区（`#portrait-area`）加切换按钮
- 切换弹窗：网格展示已拥有皮肤 + 未解锁（灰显 + 解锁条件）
- 选中 → 设置 `activeSkinId` → 宠物窗口和面板同步刷新

### 3.4 升级到方案 B 的预留

当前 `PetState` 的所有属性（level/exp/mood/satiety/intimacy）保持平铺。将来升级方案 B 时：

```js
// Phase 2（当前）→ Phase 3（升级）
{ level: 10, activeSkinId: 'default' }
// → 
{ activePetId: 'default', coins: 200, foodInventory: [...],
  pets: { 'default': { level: 10, ... }, 'husky': { level: 1, ... } } }
```

迁移脚本：现有字段包进 `pets[activeSkinId]`，一键完成。

---

## 四、用户自定义素材

### 4.1 分步路线

| 层级 | 用户做什么 | 我们做什么 | 优先级 |
|------|-----------|-----------|--------|
| L1 静态图 | 选一张本地图片 | 替换精灵图，静态显示（无动画） | 可随 Phase 2 |
| L2 素材包 | 按规范准备一组图片 | 读取文件夹，按命名规则匹配动作 | Phase 2 后半 |
| L3 AI 生成 | 上传照片生成桌宠 | 接 AI API（Replicate/Stability） | Phase 3+ |

### 4.2 L1 — 静态图替换

- 用户选择图片文件（对话框 or 拖拽）
- 复制到用户数据目录 `{userData}/skins/custom/`
- 等同于一个无帧动画的特殊皮肤
- 安全性：只读不执行，文件类型校验

### 4.3 L2 — 素材包规范

用户准备一个文件夹，按以下命名：

```
my-pet/
├── pet.json         # 皮肤元数据 { "name": "...", "author": "..." }
├── idle.png         # 或 idle_1.png, idle_2.png（多帧）
├── walk_1.png
├── walk_2.png
├── eat_1.png
├── happy_1.png
└── sad_1.png
```

导入流程：
1. 用户选择文件夹
2. 校验 `pet.json` 存在 + 图片格式
3. 打包到 `{userData}/skins/{skinId}/`
4. 注册到 `SKINS` 配置（动态追加）
5. 即时可选用

---

## 五、账号登录同步（Phase 3，暂不上）

### 5.1 为什么暂缓

- 需要后端服务（服务器 + 数据库 + 认证）→ 开始烧钱
- 游戏核心玩法未经验证（自己还没真正用）
- 有用户就有数据安全责任

### 5.2 将来方案

推荐 **Supabase**（BaaS）：
- 数据库 + 用户认证 + API 开箱即用
- 免费额度够小规模使用
- 客户端只需写同步逻辑（本地 ↔ 云端双向同步）

---

## 六、实现顺序建议

| 阶段 | 内容 | 预估 |
|------|------|------|
| Phase 2a | 精灵图渲染引擎 + 帧动画 + 状态机 | 先做，打通形象化 |
| Phase 2b | 皮肤配置表 + 切换 UI | 在 2a 基础上加 |
| Phase 2c | 默认皮肤素材制作（Piskel 画小橘） | 和 2a/2b 并行 |
| Phase 2d | L1 自定义图片导入 | 快速加 |
| Phase 2e | L2 素材包导入 | L1 做完再做 |
| Phase 3 | 账号登录同步 | 等反馈再说 |

---

## 七、相关文件

| 文件 | 改动 |
|------|------|
| `src/renderer/pet/pet.js` | 精灵图渲染 + 动画状态机 + 皮肤切换 |
| `src/renderer/pet/pet.css` | 精灵图样式替换 emoji |
| `src/renderer/shared/skin-config.js` | **新建**，皮肤配置表（原则 5） |
| `src/main/storage/store.js` | DEFAULT_STATE 加 activeSkinId + skins |
| `src/renderer/dashboard/dashboard.js` | 面板形象区 + 皮肤切换 UI |
| `src/renderer/pet/sprites/` | **新建**，精灵图资源目录 |
| `specs/pet-system.md` | 同步更新验收标准 |
