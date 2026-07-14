# EventBus 事件清单

> 新模块开发前先查此表，避免重复造事件。

## 命名规范

`模块名:动作:状态`

---

## 宠物系统

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `pet:satiety:changed` | `{ value: number }` | 饱腹值变化 |
| `pet:mood:changed` | `{ mood: number, tier: object }` | 心情变化（infra-10: mood 从 string 升级为 0-100 number，tier 为 MOOD_TIERS 档位对象） |
| `pet:state:changed` | `{ key: string, value: any }` | 任意宠物状态变更（set() 调用时） |
| `pet:level:up` | `{ level: number }` | 宠物升级 |
| `pet:fed` | `{ food: string }` | 喂食成功 |
| `pet:shooed` | - | 被赶跑 |
| `pet:returned` | - | 赶跑后回来 |

## 窗口系统（主进程 → 渲染进程，非 EventBus）

| 事件名 | 参数 | 触发时机 |
|--------|------|----------|
| `user:drag` | - | 用户拖拽宠物窗口（OS 原生拖拽，通知渲染端暂停自动走动） |
| `wander:toggle` | `{ enabled: boolean }` | 右键菜单切换自动走动开关 |

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
