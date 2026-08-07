// 事件常量定义
// 所有事件名集中管理，杜绝拼写错误

export const EVENTS = {
  // 宠物状态
  PET_STATE_CHANGED:   'pet:state:changed',
  PET_SATIETY_CHANGED:  'pet:satiety:changed',
  PET_MOOD_CHANGED:    'pet:mood:changed',      // payload: { mood: number, tier: object }  — infra-10: mood 从 string 升级为 0-100 number
  PET_LEVEL_UP:        'pet:level:up',
  PET_FED:             'pet:fed',
  PET_SHOOED:          'pet:shooed',
  PET_RETURNED:        'pet:returned',

  // 经济系统
  COIN_EARNED:         'coin:earned',
  COIN_SPENT:          'coin:spent',

  // 2048
  GAME_2048_COMPLETED: 'game:2048:completed',
  GAME_2048_SCORE:     'game:2048:score',

  // 农场
  FARM_STATE_CHANGED:        'farm:state:changed',
  FARM_CROP_HARVESTED:       'farm:crop:harvested',
  FARM_PROCESSING_COMPLETED: 'farm:processing:completed',
  FARM_ORDER_COMPLETED:      'farm:order:completed',
  FARM_ORDER_READY:          'farm:order:ready',
  FARM_BIRD_REWARDED:        'farm:bird:rewarded',

  // 单词
  WORD_LEARNED:         'word:learned',
  WORD_REVIEWED:        'word:reviewed',
  WORD_STREAK_CHANGED:  'word:streak:changed',
  WORD_MILESTONE:       'word:milestone',


  // 番茄钟（主进程 → 渲染进程 IPC 推送，非 EventBus 事件，但常量集中管理）
  POMODORO_TICK:          'pomodoro:tick',
  POMODORO_PHASE_CHANGED: 'pomodoro:phase:changed',
}
