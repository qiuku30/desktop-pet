const item = (id, name, emoji, category, sellPrice = null, feed = null, extra = {}) =>
  Object.freeze({ id, name, emoji, category, sellPrice, feed, ...extra })

export const ITEMS = Object.freeze({
  'seed:wheat': item('seed:wheat', '小麦种子', '🌾', 'seed'),
  'seed:carrot': item('seed:carrot', '胡萝卜种子', '🥕', 'seed'),
  'seed:corn': item('seed:corn', '玉米种子', '🌽', 'seed'),
  'seed:strawberry': item('seed:strawberry', '草莓种子', '🍓', 'seed'),
  'seed:pumpkin': item('seed:pumpkin', '南瓜种子', '🎃', 'seed'),
  'seed:star-dew-fruit': item('seed:star-dew-fruit', '星露果种子', '✨', 'seed'),

  'crop:wheat': item('crop:wheat', '小麦', '🌾', 'crop', 2),
  'crop:carrot': item('crop:carrot', '胡萝卜', '🥕', 'crop', 4, { satiety: 8, exp: 3, intimacy: 3 }),
  'crop:corn': item('crop:corn', '玉米', '🌽', 'crop', 8, { satiety: 12, exp: 5, intimacy: 4 }),
  'crop:strawberry': item('crop:strawberry', '草莓', '🍓', 'crop', 16, { satiety: 10, exp: 7, intimacy: 5 }),
  'crop:pumpkin': item('crop:pumpkin', '南瓜', '🎃', 'crop', 45),
  'crop:star-dew-fruit': item('crop:star-dew-fruit', '星露果', '🌟', 'crop', 90, { satiety: 35, exp: 30, intimacy: 8 }),

  'food:apple': item('food:apple', '苹果', '🍎', 'food', 4, { satiety: 20, exp: 10, intimacy: 5 }),
  'food:cake': item('food:cake', '蛋糕', '🍰', 'food', 10, { satiety: 30, exp: 25, intimacy: 5 }),
  'food:fish': item('food:fish', '小鱼干', '🐟', 'food', 8, { satiety: 25, exp: 20, intimacy: 5 }),
  'food:milk': item('food:milk', '牛奶', '🥛', 'food', 3, { satiety: 15, exp: 10, intimacy: 5 }),
  'food:cookie': item('food:cookie', '饼干', '🍪', 'food', 2, { satiety: 10, exp: 5, intimacy: 5 }),
  'food:popcorn': item('food:popcorn', '爆米花', '🍿', 'food', 20, { satiety: 22, exp: 12, intimacy: 6 }),
  'food:carrot-juice': item('food:carrot-juice', '胡萝卜汁', '🥤', 'food', 12, { satiety: 28, exp: 15, intimacy: 7 }),
  'food:strawberry-milkshake': item('food:strawberry-milkshake', '草莓奶昔', '🥛', 'food', 42, { satiety: 40, exp: 30, intimacy: 10 }),
  'food:pumpkin-pie': item('food:pumpkin-pie', '南瓜派', '🥧', 'food', 110, { satiety: 60, exp: 50, intimacy: 15 }),
})
