# 农场旧食物图标美术实施计划

> **面向实现窗口：** 必须使用 superpowers:executing-plans 逐任务执行本计划；生成或编辑栅格图时必须同时使用 imagegen skill。所有步骤使用 checkbox（`- [ ]`）追踪。

**目标：** 为苹果、蛋糕和小鱼干制作三张符合「明亮家园」家族规范的项目自有图标，并以确定性审计证明其可以安全进入后续跨页面 UI。

**架构：** 这是纯表现资产任务，不修改 manifest 或生产代码。先锁定现有图标家族和审计合同，再用 chroma-key 生成、官方去背工具和 Pillow 确定性导出三张 192×192 WebP，最后用三底、32 像素联系表和自动审计完成视觉 gate。

**技术栈：** 内置 imagegen、官方 `remove_chroma_key.py`、Codex bundled Python、Pillow、lossless WebP、sRGB、JSON 审计。

## 全局约束

- 启动时依次完整阅读 `AGENTS.md`、`PROJECT_BRIEF.md`、`docs/architecture.md`、`docs/progress.md`、`docs/session-log.md`、`docs/superpowers/specs/2026-08-03-farm-cross-page-icons-design.md`、本计划、皮肤 `README.md`、`reference/art-bible.md` 和 `reference/family-map.md`。
- 动工前先执行并报告 `git status --short --branch`、`git log --oneline --decorate -20`、`git diff --check`，核对 `HEAD` 与 `main`/`origin/main`，再上报用户可见交付、家族 gate、工具链、预计文件和无运行时影响；收到 ARCH-11 明确“可动工”后才生成素材。
- 只允许修改 `src/renderer/assets/farm/bright-homestead/ui/items/**`、`review/**`、该皮肤 `README.md`、`reference/art-bible.md` 和 `reference/family-map.md`。
- 不得修改 `farm.json`、生产 JavaScript/CSS、业务配置、tracker、架构文档、package 或 lockfile。
- 不新增事件、IPC、依赖、持久化字段、业务 schema、价格、产量、奖励、解锁或喂食数值。
- 资产必须原创，不得复制 QQ 农场、Hay Day 或其他商业游戏素材。
- 三张运行时图标固定为透明 192×192 lossless WebP、sRGB，alpha 内容不超过 152×152 安全框，并在 32 逻辑像素下可辨。
- 候选母版、超大生成板、缓存、`__pycache__` 和临时处理脚本不得进入最终皮肤目录。
- 同一图标最多进行两轮聚焦生成；两轮后身份、光影、家族一致性或透明边缘仍失败时停手上报外部 2D 美术需求。
- 不得 stage、commit、merge、push 或创建分支。ARCH-11 在用户批准独立 gate 后负责集成。

## 文件地图

- 新建 `ui/items/food-apple.webp`：新鲜红苹果图标。
- 新建 `ui/items/food-cake.webp`：小份蛋糕图标。
- 新建 `ui/items/food-fish.webp`：明确作为食物的小鱼干图标。
- 新建 `review/legacy-food-icons-alpha-white.webp`：白底透明边缘审查。
- 新建 `review/legacy-food-icons-alpha-black.webp`：黑底透明边缘审查。
- 新建 `review/legacy-food-icons-alpha-checker.webp`：棋盘底透明边缘审查。
- 新建 `review/legacy-food-icons-32px.webp`：32 像素实际显示联系表。
- 新建 `review/legacy-food-icons-audit.json`：尺寸、alpha、ICC、色键、安全框和字节数审计。
- 修改皮肤 `README.md`、`reference/art-bible.md`、`reference/family-map.md`：记录图标家族、来源和交付边界。

---

### Task 1：锁定家族基线与审计合同

**文件：**
- 读取：`src/renderer/assets/farm/bright-homestead/ui/items/*.webp`
- 临时新建：`/tmp/farm-art-04-audit.py`
- 最终新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-audit.json`

**接口：**
- 输入：现有 19 张物品/回退图标与三张待交付图标。
- 输出：稳定 JSON 审计，运行时目标精确为 `food-apple.webp`、`food-cake.webp`、`food-fish.webp`。

- [ ] **Step 1：记录现有家族事实**

用 Pillow 读取现有 19 张图标，记录尺寸、模式、ICC、alpha bbox、透明四角、平均 alpha bounds 和文件大小。至少选择 `food-cookie.webp`、`food-pumpkin-pie.webp`、`food-milk.webp`、`crop-star-dew-fruit.webp` 作为光学中心、材质和安全框参考。

- [ ] **Step 2：编写失败审计**

在 `/tmp/farm-art-04-audit.py` 中锁定精确目标和断言：

```python
from pathlib import Path
from PIL import Image

ROOT = Path('src/renderer/assets/farm/bright-homestead')
TARGETS = ['food-apple.webp', 'food-cake.webp', 'food-fish.webp']

for name in TARGETS:
    path = ROOT / 'ui/items' / name
    assert path.is_file(), f'MISSING:{name}'
    with Image.open(path) as image:
        assert image.size == (192, 192), f'INVALID_SIZE:{name}:{image.size}'
        rgba = image.convert('RGBA')
        assert rgba.getchannel('A').getbbox() is not None, f'EMPTY_ALPHA:{name}'
        assert image.info.get('icc_profile'), f'MISSING_ICC:{name}'
```

继续加入以下精确断言：四角 alpha 为 0；alpha bbox 宽高均不超过 152；绿色/洋红色键残留为 0；交付 review 尺寸存在；audit 中只有三条运行时记录且路径唯一。

- [ ] **Step 3：运行审计并确认 RED**

运行：`/Users/kudoshinichi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /tmp/farm-art-04-audit.py`

预期：首先以 `MISSING:food-apple.webp` 失败，证明审计确实覆盖尚未交付的资产。

- [ ] **Step 4：向 ARCH-11 上报正式动工合同**

上报精确资产、两轮停手规则、imagegen→官方去背→Pillow 导出链、三底/32px gate、无 manifest/代码/依赖/业务影响和唯一允许文件。等待明确“可动工”。

### Task 2：生成、去背并导出三张图标

**文件：**
- 新建：`src/renderer/assets/farm/bright-homestead/ui/items/food-apple.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/ui/items/food-cake.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/ui/items/food-fish.webp`

**接口：**
- 三张图共用 192×192 画布、152×152 安全框、光学中心、左上主光、右下柔影和暖深棕描边。
- 不含文字、数量、盘子边框、背景卡片或其他物品。

- [ ] **Step 1：使用 imagegen 生成同族 chroma-key 母版**

提示必须同时约束：三格独立对象、flat chroma-key 背景、固定正面略斜俯视、相同比例和光学中心、左上暖中性光、右下柔影、暖深棕描边、无标签、无伪字、对象不接触格线。身份要求：红苹果带短梗和叶；蛋糕为一份可辨认的蛋糕切块或小蛋糕；小鱼干呈干制食物质感，不表现水花或游泳姿态。

- [ ] **Step 2：先做结构 gate，再允许去背**

用 `view_image` 检查母版。以下任一情况必须拒绝并计入一轮：对象融合或重复、苹果像番茄、蛋糕像面包/派、小鱼干像活鱼、透视或主光不一致、对象裁切、存在文字或 AI 伪字、32px 轮廓不可辨。不得用裁切掩盖结构错误。

- [ ] **Step 3：使用官方工具去背**

按 imagegen skill 指定的 `remove_chroma_key.py` 对采用母版执行 soft matte/despill。透明边缘若出现连续色键 halo，可在同一透明处理轮次内使用一次 `--edge-contract 1`；复杂边缘两轮仍失败必须停手，不能自行换模型或第三方修图工具。

- [ ] **Step 4：用 Pillow 确定性导出**

将三个对象按 alpha component 分离，拒绝跨格碎片；以 alpha bbox 等比缩放到 152×152 内，按家族光学中心放入 192×192 透明画布；保留抗锯齿 alpha，嵌入 sRGB ICC，并使用 lossless WebP 导出。不得通过非等比 warp 改变结构。

- [ ] **Step 5：运行审计并确认运行时资产 GREEN**

运行：`/Users/kudoshinichi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /tmp/farm-art-04-audit.py`

预期：三个运行时文件的尺寸、alpha、透明角、ICC、安全框和色键断言通过；review 文件仍以缺失状态 RED。

### Task 3：生成审查证据、同步说明并交付

**文件：**
- 新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-alpha-white.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-alpha-black.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-alpha-checker.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-32px.webp`
- 新建：`src/renderer/assets/farm/bright-homestead/review/legacy-food-icons-audit.json`
- 修改：`src/renderer/assets/farm/bright-homestead/README.md`
- 修改：`src/renderer/assets/farm/bright-homestead/reference/art-bible.md`
- 修改：`src/renderer/assets/farm/bright-homestead/reference/family-map.md`

**接口：**
- Review 只合成真实运行时图层，不绘制第二套概念图。
- Audit 记录每张图的 path、size、mode、alphaBounds、transparentCorners、icc、safeBox、chromaHits、bytes 和人工 gate 结果。

- [ ] **Step 1：构建三底与 32px 联系表**

白、黑、棋盘审查图以原尺寸展示三张图，并附带 32px 实际尺寸副本；单独的 `legacy-food-icons-32px.webp` 使用三张 32×32 图标等距排列，不使用文字帮助识别。

- [ ] **Step 2：逐张人工视觉 gate**

用 `view_image` 分别检查三张运行时图、白底、黑底、棋盘底和 32px 联系表。必须确认无连续色边、白/黑 halo、不透明底板、断裂 alpha、意外碎片、身份混淆或家族光影漂移。

- [ ] **Step 3：写入确定性审计 JSON**

`legacy-food-icons-audit.json` 使用以下固定顶层结构：

```json
{
  "schemaVersion": 1,
  "assets": [],
  "reviewFiles": [],
  "checks": {
    "dimensions": true,
    "safeBox": true,
    "transparentCorners": true,
    "icc": true,
    "chroma": true,
    "manualIdentityAt32px": true
  },
  "knownIssues": []
}
```

`assets` 精确三条，按文件名字典序排列；`knownIssues` 只能记录真实未解决项，不能用空泛文字代替失败。

- [ ] **Step 4：同步皮肤说明**

在 README、art bible 和 family map 中增加三种旧食物的家族归属、导出规格、用途和 provenance。明确它们不进入 `farm.json`，候选生成板已删除，后续由共享 item catalog 直接引用。

- [ ] **Step 5：执行最终验证**

运行：

```bash
/Users/kudoshinichi/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /tmp/farm-art-04-audit.py
node --test src/renderer/games/farm/farm-scene-manifest.test.mjs
git diff --check
git status --short -uall
```

预期：审计 PASS；既有 manifest 测试 PASS；改动全部位于授权皮肤目录；`farm.json` 无 diff；无 master、candidate、脚本、缓存或 Git 写操作。

- [ ] **Step 6：向 ARCH-11 交付并停手**

报告完整文件、采用/拒绝的生成轮次、三张图身份 gate、三底与 32px 结果、alpha/ICC/色键/安全框审计、运行时与交付字节数、越界授权、已知问题和 Git 状态。等待 ARCH-11 独立视觉复验，不得自行提交。
