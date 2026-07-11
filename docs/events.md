# EventBus 事件清单

> 新模块开发前先查此表，避免重复造事件。

## 命名规范

`模块名:动作:状态`

---

## 宠物系统

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `pet:hunger:changed` | `{ value: number }` | 饥饿值变化 |
| `pet:mood:changed` | `{ mood: string }` | 心情变化 |
| `pet:level:up` | `{ level: number }` | 宠物升级 |
| `pet:fed` | `{ food: string }` | 喂食成功 |
| `pet:shooed` | - | 被赶跑 |
| `pet:returned` | - | 赶跑后回来 |

## 经济系统

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `coin:earned` | `{ amount: number, source: string }` | 获得金币 |
| `coin:spent` | `{ amount: number, item: string }` | 花费金币 |

## 游戏：2048

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `game:2048:completed` | `{ score: number }` | 通关 |
| `game:2048:score` | `{ score: number }` | 得分更新 |

## 游戏：农场

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `game:farm:harvest` | `{ crop: string, quantity: number }` | 收获作物 |
| `game:farm:food:synthesized` | `{ food: string }` | 合成食物 |

## 游戏：单词

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `game:word:correct` | `{ word: string }` | 答对单词 |
| `game:word:streak` | `{ count: number }` | 连续答对 |
