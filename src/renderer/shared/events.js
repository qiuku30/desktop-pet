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
  GAME_FARM_HARVEST:   'game:farm:harvest',
  GAME_FARM_FOOD_SYNTHESIZED: 'game:farm:food:synthesized',

  // 单词
  GAME_WORD_CORRECT:   'game:word:correct',
  GAME_WORD_STREAK:    'game:word:streak',
}
