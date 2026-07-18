# 2048 游戏模块设计

> dash-12 | 2026-07-18

## 文件结构

| 文件 | 职责 |
|------|------|
| `2048-game.js` | 纯游戏逻辑：棋盘、滑动合并、随机方块、Game Over 检测、序列化 |
| `2048-ui.js` | DOM 渲染 + 事件绑定 + PetState 集成 + 结算弹窗 |
| `2048.css` | 参考样式（实际运行时由 2048-ui.js 动态注入 `<style>`） |
| `DESIGN.md` | 本文件 |

## 组件树

```
buildGame2048Page(container)          — nav-config 注册的 render 函数
└── Game2048UI.mount(container)       — 2048-ui.js 入口
    ├── 信息栏 (.game2048-info-bar)
    │   ├── 本局分数
    │   ├── 历史最高分
    │   └── 心情倍率
    ├── 棋盘 (.game2048-board)
    │   └── 16 × .game2048-cell
    ├── 底部按钮
    │   └── 重新开始 → 确认弹窗
    └── 弹窗层（动态创建/销毁）
        ├── 结算弹窗 — Game Over 自动弹出
        └── 确认弹窗 — 重新开始二次确认
```

## 数据流

```
mount()时读                            
┌─────────────┐  savedGame   ┌──────────────┐
│  PetState   │──────────────→│  2048-ui.js  │
│  .game2048  │←──────────────│  模块级变量   │
│  .exp       │  settle写    │  _game        │
│  .coins     │              │  _highScore   │
│  .mood      │              │  _milestones  │
└─────────────┘              └──────┬───────┘
                                   │
                                   │ Game.move()
                                   ↓
                            ┌──────────────┐
                            │ 2048-game.js │
                            │ 纯函数       │
                            └──────────────┘

结算时：
  game-reward-service.calcTotalRewards(score, maxTile, mood, milestones)
  → 写入 PetState (exp / coins / highScore / milestones)
```

## 游戏状态机

```
  createGame()         Game.move()
  ┌──────┐            ┌─────────┐     gameOver=true    ┌────────────┐
  │ 新局 │───────────→│ playing │─────────────────────→│ settlement │
  └──────┘            └────┬────┘                      └─────┬──────┘
      ↑                    │                                │
      │ "再来一局"          │ 重新开始（不计收益）             │ "返回"
      │ (直接开)            │ (二次确认)                      │ (留页面)
      │                    │                                │
      └────────────────────┘              ┌─────────────────┘
                                          │ 关弹窗，按钮变为
                                          ↓ "再来一局"（蓝色主按钮）
                                     ┌─────────┐
                                     │ 终局面  │ ← 可查看棋盘
                                     └─────────┘
```

## 持久化策略

| 场景 | 机制 | 存储位置 |
|------|------|----------|
| 面板内切页 | 模块变量 `_game` | 内存（同渲染进程） |
| 关面板 | `saveBeforeClose()` → PetState.game2048.savedGame → flush() | 磁盘 |
| 开面板 | mount() → PetState.savedGame → 反序列化 | 磁盘→内存 |
| App 重启 | store.js initStore 清除 savedGame | 主进程 |
| 首达标记 | PetState.game2048.milestones | 磁盘永久 |
| 最高分 | PetState.game2048.highScore | 磁盘永久 |

## 防重复发收益

- `_game.rewardsClaimed`：结算弹窗点按钮后置 true
- 恢复 gameOver 局时，弹窗检测 `rewardsClaimed`：已发放则提示，不重复
- 重新开始 `createGame()` 绕过结算，不计任何收益

## 底部按钮

| 游戏状态 | 按钮 | 说明 |
|----------|------|------|
| 进行中 | [结算] [重新开始] | 结算=主动领奖（确认弹窗后进结算）；重新开始=放弃本局（二次确认，不计收益）|
| Game Over | [再来一局] | 蓝色主按钮，直接开新局（无需确认） |

## 预估收益栏

信息栏和棋盘之间，实时显示当前能获得的 EXP/金币/首达奖励：
- 每步移动后通过 `calcTotalRewards` 更新
- 首达奖励显示具体里程碑明细（如 "🎉 首次合成 256 (+10 EXP +6 🪙)"）
- 收益到账后自动消失

## 接口契约

对外暴露两个函数（dashboard.js 调用）：

| 函数 | 说明 |
|------|------|
| `mount(container)` | 渲染 + 绑定事件，返回 cleanup 函数 |
| `saveBeforeClose()` | 面板关闭前保存当前游戏到 PetState |

不对外暴露内部细节。样式通过 mount 时注入 `<style>` 标签自包含。

## 操作方式

- **键盘**：document keydown，只拦截方向键，弹窗显示时屏蔽
- **鼠标拖拽**：棋盘区域 pointerdown→pointermove→pointerup，位移 ≥30px 触发
- **两操作等效**，都走 `_doMove(direction)` → `Game.move()`
