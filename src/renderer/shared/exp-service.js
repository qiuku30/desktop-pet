// 经验计算服务（纯函数，配置驱动，不碰 PetState）
// 职责：升级公式、溢出继承、每日互动上限。
// 调用方负责从 PetState 读写状态，exp-service 只做计算。

// ── 配置 ──
export const EXP_CONFIG = {
  dailyInteractionLimit: 20,   // 每日互动经验上限（次数）
  interactionExp: 5,           // 每次互动获得经验
  maxLevel: 30,                // 当前版本最大等级
}

// ── 分段升级公式 ──
// 新手期（1-5级）：弱幂次增长，快速建立养成习惯
// 成长期（6-20级）：线性增长，节奏稳定可预期
// 成熟期（21级+）：低幅固定增量，长期陪伴无压力
export function calcRequiredExp(level) {
  if (level < 1) return 0
  if (level >= EXP_CONFIG.maxLevel) return Infinity
  if (level <= 5) return Math.round(60 * Math.pow(level, 1.25))
  if (level <= 20) return Math.round(110 * level - 190)
  return Math.round(150 * level - 990)
}

// ── 每日互动上限检查 ──
// count: 当前 dailyInteractionCount
// lastDate: 上次互动日期（YYYY-MM-DD 字符串，本地时间）
// 返回 { canGain, newCount, newDate }
export function checkDailyInteraction(count, lastDate, _now) {
  const now = _now || new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  if (lastDate !== today) {
    // 过日归零
    return { canGain: true, newCount: 1, newDate: today }
  }
  if (count >= EXP_CONFIG.dailyInteractionLimit) {
    return { canGain: false, newCount: count, newDate: today }
  }
  return { canGain: true, newCount: count + 1, newDate: today }
}

// ── 加经验（含溢出继承） ──
// exp: 当前等级已有经验
// level: 当前等级
// amount: 要加的经验
// 返回 { newExp, newLevel, leveledUp }
// 溢出经验自动继承，可连升多级；达到 maxLevel 后不再增加经验
export function addExp(exp, level, amount) {
  if (amount <= 0) return { newExp: exp, newLevel: level, leveledUp: false }

  let curExp = exp
  let curLevel = level
  let remaining = amount
  let leveledUp = false

  while (remaining > 0) {
    const required = calcRequiredExp(curLevel)
    if (required === Infinity) {
      // 已达最大等级，保留已有经验，不再增加
      break
    }

    const capacity = required - curExp
    if (remaining < capacity) {
      // 经验不够升级，全部加到当前等级
      curExp += remaining
      remaining = 0
    } else {
      // 升级：消耗所需经验，等级+1
      remaining -= capacity
      curLevel += 1
      curExp = 0
      leveledUp = true
    }
  }

  return { newExp: curExp, newLevel: curLevel, leveledUp }
}

// ── 喂食获得经验 ──
// food: FOODS 表中的食物条目（含 exp 字段）
// 返回该食物提供的经验值
// 喂食不受每日互动上限限制
export function getFoodExp(food) {
  return food.exp || 0
}
