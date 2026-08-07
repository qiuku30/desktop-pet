# word-01 委派提示词

先读 CLAUDE.md 了解项目全貌和规则。

你的任务是实现英语单词模块的共享层基础设施（word-01），包括：FSRS 间隔重复算法、主进程 SQLite 词库查询服务、PetState 数据结构、词库索引文件、ECDICT 提取脚本。

## 设计文档

先阅读 `specs/word-game.md`，所有技术细节如下。

## 一、FSRS 算法（渲染进程纯服务）

新建 `src/renderer/shared/word-service.js`，纯函数，不碰 PetState，不碰 DOM。

### 核心参数（默认值，常量配置块）

```js
const FSRS_DEFAULTS = {
  requestRetention: 0.9,       // 目标保留率
  maximumInterval: 365,        // 最大间隔（天）
  w: [1.0, 1.0, 5.0, -0.5, -0.5, 0.2, 1.4, -0.12, 0.8, 2.0, -0.2, 0.2, 1.0],
  // FSRS 13 个可拟合参数，使用社区默认值
};
```

### 导出函数

```js
// 初始化 FSRS 参数（后续 Phase 2 可替换为拟合后的参数）
initFSRS(customParams?)

// 核心调度：根据评分（good/again）计算下次复习时间和新的稳定性/难度
// 返回 { stability, difficulty, state, due, reps, lapses, lastReview }
scheduleReview(word, rating, now?)

// 返回所有到期（due <= now）的词
getDueWords(words)

// 从词库索引中取 count 个未学的新词（排除 alreadyLearned）
getNextNewWords(bankWords, count, alreadyLearned)

// 统计：{ totalWords, learnedToday, dueCount, streak, totalReviews, accuracy }
getStats(wordProgress)

// 后续 Phase 2 用：积累足够 review logs 后拟合参数
// fitParameters(reviewLogs)
```

### FSRS 调度逻辑

- rating === 'good': reps+1, lapses 不变, state → 'review',
  stability 按 FSRS 公式增长（基于当前 stability、difficulty、rating）
- rating === 'again': reps 归0, lapses+1, state → 'relearning',
  stability 重置, difficulty 增加, 间隔重置为 1 天
- due = lastReview + stability（天），ISO 8601 格式
- 新词首次学习后 state: 'review', stability: 初始值（约 0.5 天）, due 约为当天稍晚或次日

### 新建 test 文件

`src/renderer/shared/word-service.test.mjs`，node --test 运行。

至少覆盖：
- 初始化 FSRS
- scheduleReview: good 和 again 的基本行为
- getDueWords: 到期/未到期正确分类
- getNextNewWords: 正确排除已学词
- getStats: 统计准确性

---

## 二、主进程 SQLite 词库服务

新建 `src/main/word-service.js`，导出：

```js
// 初始化：打开 ecdict.db，创建查询用的 prepared statements
initWordDB(dbPath)

// 查单个词的完整信息（释义、音标、例句等）
lookupWord(word)

// 批量查词
lookupWords(words)

// 生成选择题干扰项：从词库随机取 count 个词，排除 correctWord
// 返回词条数组
generateChoices(correctWord, count)
```

- 使用 `better-sqlite3`（同步 API，在主进程中）
- ECDICT 的表结构参考：`stardict` 格式，主表 `stardict`（word/phonetic/definition/translation 等），例句在 `stardict_xref` 或类似表。具体表结构需要你实际下载 ECDICT 后确认
- 所有 SQL 查询应使用 prepared statements，防止注入（虽然输入来自本地）
- `dbPath` 从 app 的 extraResources 路径拼接

### ECDICT 获取方式

- GitHub: `https://github.com/skywind3000/ECDICT`
- 下载 `ecdict.db`（或 stardict 格式的原始数据）
- 具体表结构和字段名以实际下载的数据库为准
- 如果 ECDICT 原始格式不是 SQLite，你需要编写转换脚本

---

## 三、词库索引文件

新建目录 `src/renderer/assets/word-banks/`，放入以下索引文件：

```json
// cet4.json
{
  "id": "cet4",
  "name": "CET-4 四级",
  "icon": "📗",
  "count": 4500,
  "words": ["abandon", "ability", "abroad", "..."]
}
```

其他：`cet6.json`、`postgrad.json`（考研）、`ielts.json`、`toefl.json`。

每个文件只存词条 ID 列表（拼写），不存释义。释义通过 IPC 从 SQLite 实时查询。

### 词表来源

常见考试的词汇表在 ECDICT 中通常有 tag 字段可以筛选。如果没有，可以从公开的四六级/考研/雅思/托福词汇表（网上有大量 txt/csv 格式）提取后与 ECDICT 交叉校验。

新建 `scripts/extract-words.mjs`，做两件事：
1. 从 ECDICT 中提取各类考试词条 → 生成 `word-banks/*.json` 索引文件
2. 验证所有索引中的词都在 ECDICT 中有对应记录（打印缺失列表）

---

## 四、新增依赖和打包配置

### package.json

```json
"dependencies": {
  "better-sqlite3": "^11.0.0"
}
```

### forge.config.js

在 `makers` 或 `plugins` 配置中：
- 将 `ecdict.db` 和 `assets/word-banks/` 目录加入 `extraResources`（或等效的打包资源路径），使运行时能访问
- 确保 `better-sqlite3` 的 native module 在打包时正确 rebuild

具体配置取决于 electron-forge 的版本和现有配置，请阅读当前 `forge.config.js` 后适配。

---

## 五、Store 数据

在 `src/main/storage/store.js` 的 `DEFAULT_STATE` 中新增：

```js
wordProgress: {
  settings: {
    dailyNewWordsLimit: 10,
    learnGroupSize: 10,
    reviewGroupSize: 15,
    selectedBanks: ["cet4"]
  },
  streak: {
    current: 0,
    lastStudyDate: null
  },
  words: {}  // key 为单词拼写，value 为 FSRS 状态对象
}
```

---

## 六、IPC 通道

在 `src/main/preload.js` 中新增：

```js
word: {
  lookup: (word) => ipcRenderer.invoke('word:lookup', word),
  batchLookup: (words) => ipcRenderer.invoke('word:batch-lookup', words),
  choices: (correct, count) => ipcRenderer.invoke('word:choices', correct, count),
}
```

在 `src/main/index.js` 中注册 3 个 IPC handler：
- `word:lookup` → wordService.lookupWord(word)
- `word:batch-lookup` → wordService.lookupWords(words)
- `word:choices` → wordService.generateChoices(correct, count)

主进程启动时调用 `initWordDB(dbPath)`，dbPath 指向 extraResources 中的 `ecdict.db`。

---

## 七、EventBus 事件

在 `src/renderer/shared/events.js` 中新增：

```js
WORD_LEARNED: 'word:learned',
WORD_REVIEWED: 'word:reviewed',
WORD_STREAK_CHANGED: 'word:streak:changed',
WORD_MILESTONE: 'word:milestone',
```

在 `docs/events.md` 中登记这 4 个事件（名称、参数、触发时机）。

---

## 八、任务清单

- [ ] 获取 ECDICT 数据库（下载 ecict.db），确认表结构
- [ ] 编写 `scripts/extract-words.mjs`：提取考试词表 → 生成索引 JSON + 验证
- [ ] 生成 `assets/word-banks/{cet4,cet6,postgrad,ielts,toefl}.json`
- [ ] 安装 `better-sqlite3`
- [ ] 新建 `src/main/word-service.js`：SQLite 初始化 + 3 个查询函数
- [ ] 新建 `src/renderer/shared/word-service.js`：FSRS 纯函数
- [ ] 新建测试文件：node --test 全部通过
- [ ] 修改 `src/main/storage/store.js`：DEFAULT_STATE 加 wordProgress
- [ ] 修改 `src/main/preload.js`：暴露 word 命名空间
- [ ] 修改 `src/main/index.js`：注册 IPC 通道 + 初始化 wordService
- [ ] 修改 `src/renderer/shared/events.js`：新增 4 个事件常量
- [ ] 修改 `package.json`：加 better-sqlite3 依赖
- [ ] 修改 `forge.config.js`：extraResources 配置
- [ ] 更新 `docs/events.md`：登记新事件
- [ ] 更新 `docs/progress.md` 和 `docs/session-log.md`
- [ ] 手工验证：启动 App，IPC 查一个词能返回正确数据

## 可以改的文件

- `src/renderer/shared/word-service.js`（新建）
- `src/renderer/shared/word-service.test.mjs`（新建）
- `src/renderer/shared/events.js`
- `src/main/word-service.js`（新建）
- `src/main/storage/store.js`
- `src/main/preload.js`
- `src/main/index.js`
- `src/renderer/assets/word-banks/*.json`（新建）
- `scripts/extract-words.mjs`（新建）
- `package.json`（越界授权：ARCH-09）
- `forge.config.js`（越界授权：ARCH-09）
- `docs/events.md`
- `docs/progress.md`
- `docs/session-log.md`

## 不能改的文件

- 其他所有未在上方列出的文件

## 特别注意事项

1. **先确认 ECDICT 表结构再写 SQL 查询**。不同版本的 ECDICT 表结构可能不同，不要假设
2. better-sqlite3 是 native module，在 macOS 上安装一般没问题，但需要 Xcode Command Line Tools
3. `forge.config.js` 的具体 extraResources 配置方式取决于当前 electron-forge 版本，请阅读现有配置后适配，不要盲目添加
4. FSRS 的 13 个 w 参数有特定含义，不要随意改动默认值
5. word-service.js 所有导出函数必须是纯函数（或需要显式注入依赖如 Date.now），方便单测
6. 不确定的地方必须问用户（人类），不要猜
7. 先讨论，商量出结果后再行动，总体设计可能会与局部详细设计有偏差
